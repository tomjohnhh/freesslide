'use strict';
const { spawnSync } = require('child_process');

const SR = 22050;
const HOP = 441; // 20 ms -> 50 analysis frames per second
const NFFT = 1024;
const FPS_A = SR / HOP;

function decode(ffmpeg, file) {
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], {
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0 || !r.stdout || r.stdout.length < SR) {
    throw new Error('ffmpeg could not decode the audio file: ' + String(r.stderr || r.error || '').slice(0, 400));
  }
  const buf = r.stdout;
  const n = buf.length >> 1;
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) pcm[i] = buf.readInt16LE(i * 2) / 32768;
  return pcm;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

function smooth(src, radius) {
  const n = src.length;
  const out = new Float32Array(n);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + src[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - radius), b = Math.min(n, i + radius + 1);
    out[i] = (pre[b] - pre[a]) / (b - a);
  }
  return out;
}

function percentile(arr, p) {
  const s = Float32Array.from(arr).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

function normalise(src, lo, hi) {
  const a = percentile(src, lo), b = percentile(src, hi);
  const out = new Float32Array(src.length);
  const d = Math.max(1e-9, b - a);
  for (let i = 0; i < src.length; i++) out[i] = Math.min(1, Math.max(0, (src[i] - a) / d));
  return out;
}

// Band edges (Hz) for a coarse, roughly logarithmic filterbank.
const BAND_EDGES = [30, 60, 90, 130, 180, 250, 350, 500, 700, 1000, 1400, 2000, 2800, 4000, 5600, 8000, 10500];

function analyse(pcm) {
  const frames = Math.max(1, Math.floor((pcm.length - NFFT) / HOP) + 1);
  const win = new Float32Array(NFFT);
  for (let i = 0; i < NFFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (NFFT - 1));
  const binHz = SR / NFFT;
  const bandBins = BAND_EDGES.map((hz) => Math.max(1, Math.round(hz / binHz)));
  const nb = BAND_EDGES.length - 1;
  const re = new Float32Array(NFFT), im = new Float32Array(NFFT);
  const prev = new Float32Array(nb);
  const flux = new Float32Array(frames);
  const bassFlux = new Float32Array(frames);
  const rms = new Float32Array(frames);
  const bass = new Float32Array(frames);
  const treble = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    let sq = 0;
    for (let i = 0; i < NFFT; i++) {
      const v = pcm[off + i] || 0;
      sq += v * v;
      re[i] = v * win[i];
      im[i] = 0;
    }
    rms[f] = Math.sqrt(sq / NFFT);
    fft(re, im);
    let fl = 0, bfl = 0, lowE = 0, highE = 0;
    for (let b = 0; b < nb; b++) {
      let e = 0;
      for (let k = bandBins[b]; k < bandBins[b + 1]; k++) e += re[k] * re[k] + im[k] * im[k];
      const v = Math.log1p(1000 * Math.sqrt(e / Math.max(1, bandBins[b + 1] - bandBins[b])));
      const d = v - prev[b];
      if (d > 0) {
        fl += d;
        if (b < 4) bfl += d;
      }
      prev[b] = v;
      if (b < 4) lowE += v;
      if (b >= 11) highE += v;
    }
    flux[f] = fl;
    bassFlux[f] = bfl;
    bass[f] = lowE / 4;
    treble[f] = highE / (nb - 11);
  }
  return { frames, flux, bassFlux, rms, bass, treble };
}

function onsetEnvelope(flux) {
  const n = flux.length;
  const local = smooth(flux, Math.round(FPS_A * 0.5));
  const o = new Float32Array(n);
  let sum = 0, sq = 0;
  for (let i = 0; i < n; i++) {
    o[i] = Math.max(0, flux[i] - local[i]);
    sum += o[i];
  }
  const mean = sum / n;
  for (let i = 0; i < n; i++) sq += (o[i] - mean) ** 2;
  const sd = Math.sqrt(sq / n) || 1;
  for (let i = 0; i < n; i++) o[i] /= sd;
  return o;
}

function estimatePeriod(o) {
  const minLag = Math.round((60 / 190) * FPS_A), maxLag = Math.round((60 / 45) * FPS_A);
  let best = minLag, bestScore = -Infinity;
  const scores = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0;
    for (let i = lag; i < o.length; i++) ac += o[i] * o[i - lag];
    ac /= o.length - lag;
    const bpm = (60 * FPS_A) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 92) / 0.7) ** 2);
    const s = ac * prior;
    scores.push([lag, s]);
    if (s > bestScore) {
      bestScore = s;
      best = lag;
    }
  }
  return best;
}

function trackBeats(o, period) {
  const n = o.length;
  const tight = 100;
  const score = new Float32Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.round(period / 2), hi = Math.round(period * 2);
  const penalty = new Float32Array(hi + 1);
  for (let d = lo; d <= hi; d++) penalty[d] = -tight * Math.log(d / period) ** 2;
  for (let i = 0; i < n; i++) {
    let bestV = -Infinity, bestP = -1;
    for (let d = lo; d <= hi; d++) {
      const p = i - d;
      if (p < 0) break;
      const v = score[p] + penalty[d];
      if (v > bestV) {
        bestV = v;
        bestP = p;
      }
    }
    if (bestP >= 0 && bestV > 0) {
      score[i] = o[i] + bestV;
      back[i] = bestP;
    } else {
      score[i] = o[i];
    }
  }
  let end = n - 1, bestEnd = -Infinity;
  for (let i = Math.max(0, n - Math.round(period * 1.5)); i < n; i++) {
    if (score[i] > bestEnd) {
      bestEnd = score[i];
      end = i;
    }
  }
  const beats = [];
  for (let i = end; i >= 0; i = back[i]) beats.push(i);
  beats.reverse();
  return beats;
}

/**
 * Full analysis of a decoded mono signal.
 * All per-frame curves are sampled at FPS_A (50 Hz).
 */
function analyseTrack(pcm) {
  const a = analyse(pcm);
  const duration = pcm.length / SR;
  const onset = onsetEnvelope(a.flux);
  const period = estimatePeriod(onset);
  const beatFrames = trackBeats(onset, period);
  const beats = beatFrames.map((f) => (f * HOP + NFFT / 2) / SR);

  const db = new Float32Array(a.frames);
  for (let i = 0; i < a.frames; i++) db[i] = 20 * Math.log10(a.rms[i] + 1e-5);
  const level = normalise(smooth(db, Math.round(FPS_A * 0.15)), 0.05, 0.98);
  const intensity = normalise(smooth(db, Math.round(FPS_A * 3)), 0.08, 0.95);
  const bassN = normalise(smooth(a.bass, 2), 0.1, 0.98);
  const trebleN = normalise(smooth(a.treble, 3), 0.1, 0.98);
  const kick = normalise(onsetEnvelope(a.bassFlux), 0.5, 0.995);

  // First and last moments with real signal.
  const gate = percentile(db, 0.5) - 32;
  let first = 0, last = a.frames - 1;
  while (first < a.frames - 1 && db[first] < gate) first++;
  while (last > 0 && db[last] < gate) last--;

  // Structural novelty: difference between the mean loudness of the next and previous 6 s.
  const wide = smooth(db, Math.round(FPS_A * 3));
  const novelty = new Float32Array(a.frames);
  const k = Math.round(FPS_A * 3);
  for (let i = 0; i < a.frames; i++) {
    novelty[i] = Math.abs(wide[Math.min(a.frames - 1, i + k)] - wide[Math.max(0, i - k)]);
  }

  const strength = beatFrames.map((f) => {
    let m = 0;
    for (let i = Math.max(0, f - 2); i <= Math.min(a.frames - 1, f + 2); i++) m = Math.max(m, onset[i]);
    return m;
  });
  const sMax = Math.max(1e-6, percentile(Float32Array.from(strength), 0.9));

  return {
    sampleRate: SR,
    fps: FPS_A,
    duration,
    musicStart: (first * HOP) / SR,
    musicEnd: Math.min(duration, (last * HOP + NFFT) / SR),
    bpm: (60 * FPS_A) / period,
    beatPeriod: period / FPS_A,
    beats,
    beatStrength: strength.map((s) => Math.min(1, s / sMax)),
    level,
    intensity,
    bass: bassN,
    treble: trebleN,
    kick,
    novelty,
    pcm,
  };
}

function sampler(curve, fps) {
  return (t) => {
    const x = t * fps;
    const i = Math.floor(x);
    if (i < 0) return curve[0];
    if (i >= curve.length - 1) return curve[curve.length - 1];
    const f = x - i;
    return curve[i] * (1 - f) + curve[i + 1] * f;
  };
}

module.exports = { decode, analyseTrack, sampler, SR, FPS_A };
