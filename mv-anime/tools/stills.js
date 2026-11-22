'use strict';
// Contact sheet for checking: draws the frames at the given times, with the on-screen text,
// and tiles them into one picture. Each frame is labelled with its time.
//   node tools/stills.js --config work/show.json --times 1.5,4.2,8 --out sheet.jpg [--scale 0.5] [--cols 2] [--ffmpeg path]
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const { FB } = require('../lib/raster');
const { createShow } = require('../lib/show');
const ass = require('../lib/ass');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const ffmpeg = args.ffmpeg || 'ffmpeg';
const scale = Number(args.scale || 0.5), cols = Number(args.cols || 2);
const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8').replace(/^\uFEFF/, ''));
const show = createShow(cfg);
const times = String(args.times).split(',').map(Number).sort((a, b) => a - b);
const fb = new FB(scale);

(async () => {
  const labels = times.map((t) => ({ t0: t - 0.005, t1: t + 0.005, style: 'UI', text: t.toFixed(2), pos: [1840, 40], an: 9, fade: [0, 0], tags: '\\c&H00FFFF&\\fs40', layer: 9 }));
  const script = path.join('work', `stills-${process.pid}.ass`);
  fs.mkdirSync(path.join(root, 'work'), { recursive: true });
  fs.writeFileSync(path.join(root, script), ass.build({ lines: show.lines, texts: show.texts.concat(labels) }), 'utf8');
  const pts = '(' + times.map((t, i) => `eq(N,${i})*${t.toFixed(4)}`).join('+') + ')/TB';
  const rows = Math.ceil(times.length / cols);
  const vf = `setpts='${pts}',subtitles=${script.replace(/\\/g, '/')}:fontsdir=assets/fonts,tile=${cols}x${rows}`;
  const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${fb.w}x${fb.h}`, '-r', '1000', '-i', 'pipe:0', '-vf', vf, '-frames:v', '1', '-q:v', '3', path.resolve(args.out)], { stdio: ['pipe', 'inherit', 'inherit'], cwd: root });
  const started = Date.now();
  for (const t of times) {
    show.frame(fb, t);
    if (!child.stdin.write(Buffer.from(fb.d))) await new Promise((r) => child.stdin.once('drain', r));
  }
  child.stdin.end();
  const code = await new Promise((r) => child.on('close', r));
  fs.rmSync(path.join(root, script), { force: true });
  console.log(`${times.length} frames -> ${args.out} (${Math.round((Date.now() - started) / times.length)} ms per frame)${code ? ' ffmpeg exit ' + code : ''}`);
})().catch((err) => { console.error(err); process.exit(1); });
