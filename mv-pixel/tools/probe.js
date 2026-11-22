'use strict';
// Audio checks that replace listening: loudness over a time range, and how alike two
// passages are (band-energy patterns compared frame by frame).
//   node tools/probe.js <audio.wav> rms <from> <to>
//   node tools/probe.js <audio.wav> similar <aStart> <bStart> <seconds> [more bStart ...]
const fs = require('fs');

const [file, mode, ...rest] = process.argv.slice(2);
const buf = fs.readFileSync(file);
let pos = 12, rate = 0, channels = 1, data = null;
while (pos + 8 <= buf.length) {
  const id = buf.toString('latin1', pos, pos + 4), size = buf.readUInt32LE(pos + 4);
  if (id === 'fmt ') { channels = buf.readUInt16LE(pos + 10); rate = buf.readUInt32LE(pos + 12); }
  else if (id === 'data') { data = buf.subarray(pos + 8, Math.min(buf.length, pos + 8 + size)); break; }
  pos += 8 + size + (size & 1);
}
const total = Math.floor(data.length / 2 / channels);
const sample = (i) => (i < 0 || i >= total ? 0 : data.readInt16LE(i * channels * 2) / 32768);

if (mode === 'rms') {
  const [from, to] = rest.map(Number);
  const out = [];
  for (let t = from; t < Math.min(to, total / rate); t += 0.25) {
    let e = 0;
    const a = Math.floor(t * rate), n = Math.floor(0.25 * rate);
    for (let i = 0; i < n; i++) { const s = sample(a + i); e += s * s; }
    out.push(Math.round(Math.sqrt(e / n) * 1000));
  }
  console.log(JSON.stringify({ duration: Math.round((total / rate) * 100) / 100, from, step: 0.25, rmsPerMille: out }));
} else if (mode === 'similar') {
  const [aStart, bFirst, seconds, ...more] = rest.map(Number);
  const N = 1024, hop = Math.round(rate / 50), BANDS = 20;
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const edges = Array.from({ length: BANDS + 1 }, (_, b) => Math.round((80 * Math.pow(4000 / 80, b / BANDS) / rate) * N));
  const features = (start) => {
    const frames = Math.floor((seconds * rate) / hop);
    const out = [];
    for (let f = 0; f < frames; f++) {
      const re = new Float32Array(N), im = new Float32Array(N);
      const a = Math.floor(start * rate) + f * hop;
      for (let i = 0; i < N; i++) re[i] = sample(a + i) * win[i];
      for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
      for (let len = 2; len <= N; len <<= 1) {
        const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
        for (let i = 0; i < N; i += len) {
          let cr = 1, ci = 0;
          for (let k = 0; k < len / 2; k++) {
            const p = i + k, q = p + len / 2;
            const xr = re[q] * cr - im[q] * ci, xi = re[q] * ci + im[q] * cr;
            re[q] = re[p] - xr; im[q] = im[p] - xi; re[p] += xr; im[p] += xi;
            const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
          }
        }
      }
      const v = new Float32Array(BANDS);
      let norm = 0;
      for (let b = 0; b < BANDS; b++) {
        let e = 0;
        for (let k = edges[b]; k < Math.max(edges[b] + 1, edges[b + 1]); k++) e += re[k] * re[k] + im[k] * im[k];
        v[b] = Math.log1p(1000 * e);
        norm += v[b] * v[b];
      }
      norm = Math.sqrt(norm) || 1;
      for (let b = 0; b < BANDS; b++) v[b] /= norm;
      out.push(v);
    }
    // remove each band's mean so the comparison follows the changes, not the overall timbre
    for (let b = 0; b < BANDS; b++) {
      let m = 0;
      for (const v of out) m += v[b];
      m /= out.length;
      for (const v of out) v[b] -= m;
    }
    return out;
  };
  const A = features(aStart);
  const corr = (B, lag) => {
    let s = 0, na = 0, nb = 0;
    for (let f = 0; f < A.length; f++) {
      const g = f + lag;
      if (g < 0 || g >= B.length) continue;
      for (let b = 0; b < BANDS; b++) { s += A[f][b] * B[g][b]; na += A[f][b] * A[f][b]; nb += B[g][b] * B[g][b]; }
    }
    return s / (Math.sqrt(na * nb) || 1);
  };
  const res = [bFirst, ...more].map((bStart) => {
    const B = features(bStart);
    let best = -2, bestLag = 0;
    for (let lag = -15; lag <= 15; lag++) { const c = corr(B, lag); if (c > best) { best = c; bestLag = lag; } }
    return { bStart, similarity: Math.round(best * 1000) / 1000, lagSeconds: Math.round((bestLag * hop / rate) * 100) / 100 };
  });
  console.log(JSON.stringify({ aStart, seconds, results: res }));
} else {
  console.error('modes: rms | similar');
  process.exit(2);
}
