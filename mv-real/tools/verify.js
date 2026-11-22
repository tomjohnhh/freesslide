'use strict';
// Checks a finished video against the show it was rendered from. Every decoded frame is
// compared, at quarter size and above the caption area, with the frame the renderer draws for
// that time; the sound is compared with the same passage of the audio source.
//   node tools/verify.js --config work/show.json --video out/video.mp4 [--audio source] [--ffmpeg path]
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const { FB } = require('../lib/canvas');
const { createShow } = require('../lib/show');
const { createAssets } = require('../lib/assets');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.config || !args.video) { console.error('usage: node tools/verify.js --config show.json --video video.mp4 [--audio source] [--ffmpeg path]'); process.exit(2); }

const ffmpeg = args.ffmpeg || 'ffmpeg';
const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8').replace(/^\uFEFF/, ''));
cfg.grain = 0;
const show = createShow(cfg, { assets: createAssets({ root, ffmpeg, enlarge: 1 }) });
const fps = 30, RATE = 22050, SCALE = 0.25;

function decode(ffArgs, onData) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-hide_banner', '-v', 'error', ...ffArgs, 'pipe:1'], { stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with ' + code))));
  });
}

async function checkVideo() {
  const fb = new FB(SCALE), prev = new FB(SCALE);
  const size = fb.w * fb.h * 3, rows = Math.floor(fb.h * 0.72), n = rows * fb.w * 3;
  const frame = Buffer.alloc(size);
  const diff = (a, b) => { let s = 0; for (let i = 0; i < n; i++) { const d = a[i] - b[i]; s += d < 0 ? -d : d; } return s / n; };
  let filled = 0, count = 0, total = 0, shifted = 0, havePrev = false;
  const worst = [];
  const onFrame = () => {
    show.frame(fb, count / fps);
    const own = diff(frame, fb.d);
    if (havePrev && diff(frame, prev.d) + 0.5 < own) shifted++;
    prev.set(fb); havePrev = true;
    total += own;
    worst.push({ frame: count, t: Math.round((count / fps) * 100) / 100, diff: Math.round(own * 100) / 100 });
    worst.sort((x, y) => y.diff - x.diff);
    if (worst.length > 5) worst.length = 5;
    count++;
  };
  await decode(['-i', args.video, '-map', '0:v:0', '-vf', `scale=${fb.w}:${fb.h}:flags=area:in_color_matrix=bt709,format=rgb24`, '-f', 'rawvideo', '-pix_fmt', 'rgb24'], (chunk) => {
    let pos = 0;
    while (pos < chunk.length) {
      const k = Math.min(size - filled, chunk.length - pos);
      chunk.copy(frame, filled, pos, pos + k);
      filled += k; pos += k;
      if (filled === size) { onFrame(); filled = 0; }
    }
  });
  return { frames: count, expectedFrames: Math.round(show.duration * fps), meanDiff: Math.round((total / count) * 100) / 100, worst, closerToPreviousFrame: shifted };
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

const db = (x) => (x > 0 ? Math.round(200 * Math.log10(x)) / 10 : null);
function level(s, from, to) {
  let e = 0, peak = 0;
  const a = Math.max(0, Math.floor(from * RATE)), b = Math.min(s.length, Math.floor(to * RATE));
  for (let i = a; i < b; i++) { e += s[i] * s[i]; const v = Math.abs(s[i]); if (v > peak) peak = v; }
  return { rmsDb: db(Math.sqrt(e / Math.max(1, b - a))), peakDb: db(peak) };
}

async function checkAudio() {
  const out = await pcm(args.video);
  const res = { seconds: Math.round((out.length / RATE) * 100) / 100, level: level(out, 0, out.length / RATE) };
  if (!args.audio) return res;
  const src = await pcm(args.audio, show.duration);
  res.sourceLevel = level(src, 0, src.length / RATE);
  const win = 2 * RATE, maxLag = Math.round(0.03 * RATE), step = Math.max(3, Math.min(9, (show.duration - 6) / 4));
  const lags = [];
  for (let t = 2; t + 2 < show.duration - 1; t += step) {
    const a0 = Math.floor(t * RATE);
    let best = -2, bestLag = 0;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let xy = 0, xx = 0, yy = 0;
      for (let i = 0; i < win; i += 2) { const x = src[a0 + i] || 0, y = out[a0 + i + lag] || 0; xy += x * y; xx += x * x; yy += y * y; }
      const c = xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
      if (c > best) { best = c; bestLag = lag; }
    }
    lags.push({ t: Math.round(t * 10) / 10, lagMs: Math.round((bestLag / RATE) * 10000) / 10, corr: Math.round(best * 1000) / 1000 });
  }
  res.againstSource = { windows: lags.length, minCorr: Math.min(...lags.map((l) => l.corr)), lagMsMin: Math.min(...lags.map((l) => l.lagMs)), lagMsMax: Math.max(...lags.map((l) => l.lagMs)) };
  return res;
}

(async () => {
  const started = Date.now();
  const video = await checkVideo();
  const audio = await checkAudio();
  console.log(JSON.stringify({ duration: show.duration, video, audio, seconds: Math.round((Date.now() - started) / 1000) }, null, 1));
})().catch((err) => { console.error(err); process.exit(1); });
