'use strict';
// Finds the tempo and beat phase of a song so the animation can move on the beat.
//   node analyze.js <audio.wav> [out.json]
// The WAV must be 16-bit PCM (any rate, mono or stereo). Nothing but numbers is written out.
const fs = require('fs');

function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('latin1', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(pos + 8), channels: buf.readUInt16LE(pos + 10), rate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) };
    else if (id === 'data') { data = buf.subarray(pos + 8, Math.min(buf.length, pos + 8 + size)); break; }
    pos += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16 || (fmt.format !== 1 && fmt.format !== 0xfffe)) throw new Error('expected 16-bit PCM');
  const n = Math.floor(data.length / 2 / fmt.channels);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) s += data.readInt16LE((i * fmt.channels + c) * 2);
    x[i] = s / fmt.channels / 32768;
  }
  return { rate: fmt.rate, x };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

function analyze(file) {
  const { rate, x } = readWav(file);
  const N = 1024;
  const hop = Math.round(rate / 100);
  const frames = Math.max(0, Math.floor((x.length - N) / hop));
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const env = new Float32Array(frames);
  const low = new Float32Array(frames);
  const rms = new Float32Array(frames);
  const lowBins = Math.max(2, Math.round((180 / rate) * N));
  let prev = new Float32Array(N / 2);
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = 0; i < N; i++) { const s = x[f * hop + i]; re[i] = s * win[i]; im[i] = 0; e += s * s; }
    rms[f] = Math.sqrt(e / N);
    fft(re, im);
    const mag = new Float32Array(N / 2);
    let flux = 0, lflux = 0;
    for (let k = 1; k < N / 2; k++) {
      mag[k] = Math.log1p(60 * Math.hypot(re[k], im[k]));
      const d = mag[k] - prev[k];
      if (d > 0) { flux += d; if (k <= lowBins) lflux += d; }
    }
    env[f] = flux;
    low[f] = lflux;
    prev = mag;
  }
  // remove the slow trend so the autocorrelation sees the pulses
  const detrend = (a) => {
    const out = new Float32Array(a.length);
    const R = 50;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i];
      if (i >= 2 * R + 1) sum -= a[i - 2 * R - 1];
      const mean = sum / Math.min(i + 1, 2 * R + 1);
      out[i] = Math.max(0, a[i] - mean);
    }
    return out;
  };
  const o = detrend(env);
  const fps = rate / hop;

  const blur = (a, r) => {
    const out = new Float32Array(a.length);
    let sum = 0;
    for (let i = 0; i < a.length + r; i++) {
      if (i < a.length) sum += a[i];
      if (i - 2 * r - 1 >= 0) sum -= a[i - 2 * r - 1];
      if (i - r >= 0 && i - r < a.length) out[i - r] = sum / (2 * r + 1);
    }
    return out;
  };

  // Comb response: the mean of the envelope sampled once per period, at the best phase.
  const score = (sig, period, limit) => {
    let best = -1, bestPhase = 0;
    const steps = Math.max(8, Math.round(period));
    const end = Math.min(sig.length - 1, limit || sig.length - 1);
    for (let p = 0; p < steps; p++) {
      const phase = (p / steps) * period;
      let sum = 0, n = 0;
      for (let t = phase; t < end; t += period) {
        const i = Math.floor(t), fr = t - i;
        sum += sig[i] * (1 - fr) + sig[i + 1] * fr;
        n++;
      }
      sum /= n || 1;
      if (sum > best) { best = sum; bestPhase = phase; }
    }
    return { s: best, phase: bestPhase };
  };

  // Coarse pass on a heavily smoothed envelope over the first 90 s (tolerates a small tempo
  // error), then a fine pass over the whole song so the grid does not drift by the end.
  const coarseSig = blur(o, 4);
  const fineSig = blur(o, 2);
  const cands = [];
  for (let bpm = 50; bpm <= 190; bpm += 0.1) {
    const r = score(coarseSig, (60 / bpm) * fps, 90 * fps);
    cands.push({ bpm: Math.round(bpm * 10) / 10, s: r.s });
  }
  const mean = cands.reduce((a, c) => a + c.s, 0) / cands.length;
  const coarse = cands
    .filter((c, i) => i > 1 && i < cands.length - 2 && c.s >= cands[i - 1].s && c.s >= cands[i + 1].s && c.s >= cands[i - 2].s && c.s >= cands[i + 2].s)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6);
  const fineMean = (() => {
    let sum = 0, n = 0;
    for (let bpm = 50; bpm <= 190; bpm += 2.37) { sum += score(fineSig, (60 / bpm) * fps).s; n++; }
    return sum / n;
  })();
  const peaks = coarse.map((c) => {
    let best = { bpm: c.bpm, s: -1, phase: 0 };
    for (let bpm = c.bpm - 0.12; bpm <= c.bpm + 0.12; bpm += 0.004) {
      const r = score(fineSig, (60 / bpm) * fps);
      if (r.s > best.s) best = { bpm: Math.round(bpm * 1000) / 1000, s: r.s, phase: r.phase / fps };
    }
    return { ...best, coarse: c.s / mean, fine: best.s / fineMean };
  });
  peaks.sort((a, b) => b.fine - a.fine);
  const best = peaks[0];

  const head = [];
  for (let s = 0; s < 20 && (s + 0.25) * fps < frames; s += 0.25) {
    let m = 0;
    for (let i = Math.floor(s * fps); i < Math.floor((s + 0.25) * fps); i++) m = Math.max(m, rms[i]);
    head.push(Math.round(m * 1000) / 1000);
  }
  const onsets = [];
  const thr = [...o].sort((a, b) => a - b)[Math.floor(o.length * 0.9)];
  for (let i = 2; i < Math.min(frames - 2, 20 * fps); i++) {
    if (o[i] > thr && o[i] >= o[i - 1] && o[i] >= o[i + 1] && o[i] >= o[i - 2] && o[i] >= o[i + 2]) onsets.push({ t: Math.round((i / fps + N / 2 / rate) * 100) / 100, s: Math.round(o[i] * 10) / 10, low: Math.round(low[i] * 10) / 10 });
  }
  const toOffset = (p) => Math.round(((p.phase + N / 2 / rate) % (60 / p.bpm)) * 1000) / 1000;
  return {
    duration: Math.round((x.length / rate) * 100) / 100,
    bpm: best.bpm,
    period: Math.round((60 / best.bpm) * 100000) / 100000,
    // time of the first beat in the file (centre of the analysis window)
    offset: toOffset(best),
    candidates: peaks.map((p) => ({ bpm: p.bpm, period: Math.round((60 / p.bpm) * 10000) / 10000, offset: toOffset(p), fine: Math.round(p.fine * 100) / 100, coarse: Math.round(p.coarse * 100) / 100 })),
    rmsQuarterSeconds: head,
    onsets,
  };
}

if (require.main === module) {
  const [file, out] = process.argv.slice(2);
  if (!file) { console.error('usage: node analyze.js <audio.wav> [out.json]'); process.exit(2); }
  const res = analyze(file);
  if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res));
}

module.exports = { analyze };
