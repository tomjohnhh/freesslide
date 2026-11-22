'use strict';
// Renders the show to a video.
//   node render.js --config work/show.json --out out/video.mp4 [--ffmpeg path] [--audio file]
//                  [--scale 1] [--from 0] [--to end] [--preset slow] [--crf 19]
// --audio is any file ffmpeg can read; only its sound is used, from the same position as the picture.
// --scale 0.5 gives a quick half-size preview. Run from this folder.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { FB } = require('./lib/canvas');
const { createShow } = require('./lib/show');
const { createAssets } = require('./lib/assets');
const ass = require('./lib/ass');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.config) { console.error('usage: node render.js --config show.json --out video.mp4 [--audio file] [--ffmpeg path] [--scale 1]'); process.exit(2); }

const ffmpeg = args.ffmpeg || 'ffmpeg';
const scale = Number(args.scale || 1);
const fps = 30;
const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8').replace(/^\uFEFF/, ''));
const assets = createAssets({ root: __dirname, ffmpeg, enlarge: scale > 0.7 ? 1.5 : 1 });
const show = createShow(cfg, { assets });
const from = Number(args.from || 0), to = Math.min(show.duration, Number(args.to || show.duration));
const total = Math.round((to - from) * fps);
const fb = new FB(scale);

async function main() {
  const out = path.resolve(args.out || path.join('out', 'video.mp4'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'work'), { recursive: true });
  const script = path.join('work', `captions-${process.pid}.ass`);
  fs.writeFileSync(path.join(__dirname, script), ass.build({ lines: show.lines, texts: show.texts, shift: from }), 'utf8');
  const a = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${fb.w}x${fb.h}`, '-r', String(fps), '-i', 'pipe:0'];
  if (args.audio) a.push('-ss', String(from), '-t', (to - from).toFixed(3), '-i', path.resolve(args.audio));
  a.push('-map', '0:v');
  if (args.audio) {
    const fadeOut = to >= show.duration - 0.01 ? `,afade=t=out:st=${(to - from - 0.7).toFixed(3)}:d=0.7` : '';
    a.push('-map', '1:a:0', '-af', `afade=t=in:d=0.05${fadeOut}`, '-c:a', 'aac', '-b:a', '192k');
  }
  const vf = `subtitles=${script.replace(/\\/g, '/')}:fontsdir=assets/fonts,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`;
  a.push('-vf', vf, '-c:v', 'libx264', '-preset', args.preset || 'slow', '-crf', String(args.crf || 19), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-r', String(fps), '-movflags', '+faststart', '-t', (to - from).toFixed(3), out);
  const child = spawn(ffmpeg, a, { stdio: ['pipe', 'inherit', 'inherit'], cwd: __dirname });
  const started = Date.now();
  for (let f = 0; f < total; f++) {
    show.frame(fb, from + f / fps);
    if (!child.stdin.write(Buffer.from(fb.d))) await new Promise((r) => child.stdin.once('drain', r));
    else if (f % 8 === 0) await new Promise((r) => setImmediate(r));
  }
  child.stdin.end();
  const code = await new Promise((r) => child.on('close', r));
  fs.rmSync(path.join(__dirname, script), { force: true });
  if (code !== 0) { console.error('ffmpeg exited with ' + code); process.exit(1); }
  console.log(`${total} frames, ${(to - from).toFixed(2)} s, ${fb.w}x${fb.h}, ${((Date.now() - started) / 1000).toFixed(1)} s to render`);
}

main().catch((err) => { console.error(err); process.exit(1); });
