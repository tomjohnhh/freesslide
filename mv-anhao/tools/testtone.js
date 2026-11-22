'use strict';
// Writes a synthetic, royalty-free test track (kick / hat / pad with loud and quiet sections)
// so the renderer can be exercised without any real recording.
const fs = require('fs');

const out = process.argv[2] || 'test/tone.wav';
const seconds = Number(process.argv[3] || 64);
const bpm = Number(process.argv[4] || 76);
const sr = 44100;
const n = Math.round(seconds * sr);
const beat = 60 / bpm;
const data = new Float32Array(n);

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

const sections = [
  { until: 0.12, gain: 0.25, drums: 0 },
  { until: 0.36, gain: 0.55, drums: 0.7 },
  { until: 0.56, gain: 1.0, drums: 1 },
  { until: 0.68, gain: 0.35, drums: 0.3 },
  { until: 0.92, gain: 1.0, drums: 1 },
  { until: 1.01, gain: 0.3, drums: 0 },
];
const chords = [
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
  [196.0, 246.94, 293.66],
  [164.81, 207.65, 246.94],
];

for (let i = 0; i < n; i++) {
  const t = i / sr;
  const pos = t / seconds;
  const sec = sections.find((s) => pos < s.until);
  const bt = t / beat;
  const inBeat = (bt % 1) * beat;
  const chord = chords[Math.floor(bt / 4) % chords.length];
  let v = 0;
  for (const f of chord) v += 0.09 * Math.sin(2 * Math.PI * f * t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.2 * t));
  v += 0.12 * Math.sin(2 * Math.PI * (chord[0] / 2) * t) * sec.gain;
  const kickEnv = Math.exp(-inBeat * 18);
  v += sec.drums * 0.9 * kickEnv * Math.sin(2 * Math.PI * (48 + 70 * Math.exp(-inBeat * 30)) * inBeat);
  const off = ((bt + 0.5) % 1) * beat;
  v += sec.drums * 0.22 * Math.exp(-off * 60) * rnd();
  if (Math.floor(bt) % 2 === 1) v += sec.drums * 0.3 * Math.exp(-inBeat * 25) * rnd();
  const fade = Math.min(1, t / 1.5, (seconds - t) / 3);
  data[i] = Math.tanh(v * sec.gain * 1.4) * fade * 0.8;
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + n * 4, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(sr, 24);
header.writeUInt32LE(sr * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(n * 4, 40);
const body = Buffer.alloc(n * 4);
for (let i = 0; i < n; i++) {
  const s = Math.max(-1, Math.min(1, data[i])) * 32767;
  body.writeInt16LE(s | 0, i * 4);
  body.writeInt16LE(s | 0, i * 4 + 2);
}
fs.mkdirSync(require('path').dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, body]));
console.log(`wrote ${out}: ${seconds}s at ${bpm} BPM`);
