'use strict';
// Checks a finished video against the show it was rendered from: every decoded frame is
// compared with the frame the renderer draws for that time, and the sound is compared with
// the audio source (same passage, same position).
//   node tools/verify.js --config work/show.json --video out/full.mp4 [--audio source] [--ffmpeg path]
const fs = require('fs');
const { spawn } = require('child_process');
const { FB } = require('../lib/fb');
const { createShow, W, H } = require('../lib/show');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.config || !args.video) { console.error('usage: node tools/verify.js --config show.json --video video.mp4 [--audio source] [--ffmpeg path]'); process.exit(2); }

const ffmpeg = args.ffmpeg || 'ffmpeg';
const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8').replace(/^\uFEFF/, ''));
const show = createShow(cfg);
const fps = Number(args.fps || 30);
const RATE = 22050;

function decode(ffArgs, onData) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-hide_banner', '-v', 'error', ...ffArgs, 'pipe:1'], { stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with ' + code))));
  });
}

function diff(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d < 0 ? -d : d; }
  return sum / a.length;
}

async function checkVideo() {
  const size = W * H * 3;
  const fb = new FB(W, H);
  const frame = Buffer.alloc(size);
  let prev = null;
  let filled = 0, count = 0, total = 0, shifted = 0;
  const worst = [];
  const onFrame = () => {
    show.frame(fb, count / fps);
    const own = diff(frame, fb.d);
    if (prev && diff(frame, prev) + 0.5 < own) shifted++;
    prev = Buffer.from(fb.d);
    total += own;
    worst.push({ frame: count, t: Math.round((count / fps) * 100) / 100, diff: Math.round(own * 100) / 100 });
    worst.sort((x, y) => y.diff - x.diff);
    if (worst.length > 5) worst.length = 5;
    count++;
  };
  await decode(['-i', args.video, '-map', '0:v:0', '-vf', `scale=${W}:${H}:flags=neighbor`, '-f', 'rawvideo', '-pix_fmt', 'rgb24'], (chunk) => {
    let pos = 0;
    while (pos < chunk.length) {
      const n = Math.min(size - filled, chunk.length - pos);
      chunk.copy(frame, filled, pos, pos + n);
      filled += n; pos += n;
      if (filled === size) { onFrame(); filled = 0; }
    }
  });
  const expected = Math.round(show.duration * fps);
  return { frames: count, expectedFrames: expected, meanDiff: Math.round((total / count) * 100) / 100, worst, closerToPreviousFrame: shifted };
}

async function pcm(file, seconds) {
  const parts = [];
  const a = ['-i', file, '-map', '0:a:0'];
  if (seconds) a.push('-t', seconds.toFixed(3));
  await decode([...a, '-ac', '1', '-ar', String(RATE), '-f', 's16le'], (c) => parts.push(c));
  const buf = Buffer.concat(parts);
  const out = new Float32Array(buf.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

const db = (x) => (x > 0 ? Math.round(200 * Math.log10(x)) / 10 : -Infinity);
function level(s, from, to) {
  let e = 0, peak = 0;
  const a = Math.max(0, Math.floor(from * RATE)), b = Math.min(s.length, Math.floor(to * RATE));
  for (let i = a; i < b; i++) { e += s[i] * s[i]; const v = Math.abs(s[i]); if (v > peak) peak = v; }
  return { rmsDb: db(Math.sqrt(e / Math.max(1, b - a))), peakDb: db(peak) };
}

async function checkAudio() {
  const out = await pcm(args.video);
  const res = { seconds: Math.round((out.length / RATE) * 100) / 100, level: level(out, 0, out.length / RATE) };
  const tail = [];
  for (let t = show.duration - 1.2; t < show.duration - 0.01; t += 0.2) tail.push(level(out, t, t + 0.2).rmsDb);
  res.lastSecondRmsDb = tail;
  if (!args.audio) return res;
  const src = await pcm(args.audio, show.duration);
  res.sourceLevel = level(src, 0, src.length / RATE);
  const win = 2 * RATE, maxLag = Math.round(0.03 * RATE);
  const lags = [];
  let minCorr = 1;
  for (let t = 3; t + 2 < show.duration - 1; t += 9) {
    const a0 = Math.floor(t * RATE);
    let best = -2, bestLag = 0;
    for (let lag = -maxLag; lag <= maxLag; lag += 1) {
      let xy = 0, xx = 0, yy = 0;
      for (let i = 0; i < win; i += 2) {
        const x = src[a0 + i] || 0, y = out[a0 + i + lag] || 0;
        xy += x * y; xx += x * x; yy += y * y;
      }
      const c = xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
      if (c > best) { best = c; bestLag = lag; }
    }
    lags.push({ t, lagMs: Math.round((bestLag / RATE) * 10000) / 10, corr: Math.round(best * 1000) / 1000 });
    if (best < minCorr) minCorr = best;
  }
  res.againstSource = { windows: lags.length, minCorr: Math.round(minCorr * 1000) / 1000, lagMsMin: Math.min(...lags.map((l) => l.lagMs)), lagMsMax: Math.max(...lags.map((l) => l.lagMs)), detail: lags };
  return res;
}

(async () => {
  const video = await checkVideo();
  const audio = await checkAudio();
  console.log(JSON.stringify({ duration: show.duration, video, audio }, null, 1));
})().catch((err) => { console.error(err); process.exit(1); });
