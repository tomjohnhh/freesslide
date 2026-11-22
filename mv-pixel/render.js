'use strict';
// Renders the show to a video. Frames are drawn at 320x180 and enlarged by whole pixels.
//   node render.js --config work/show.json --out out/sample.mp4 [--ffmpeg path] [--audio file]
//                  [--from 0] [--scale 6] [--fps 30] [--raw frames.rgb]
// --audio is any file ffmpeg can read; only its sound is used, starting at --from seconds.
// --raw writes the unscaled frames instead of encoding (for inspection).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { FB } = require('./lib/fb');
const { createShow, W, H } = require('./lib/show');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.config) { console.error('usage: node render.js --config show.json --out video.mp4 [--audio file] [--ffmpeg path]'); process.exit(2); }

const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8').replace(/^\uFEFF/, ''));
const show = createShow(cfg);
const fps = Number(args.fps || 30);
const scale = Number(args.scale || 6);
const from = Number(args.from || 0);
const total = Math.round(show.duration * fps);
const fb = new FB(W, H);

async function main() {
  let sink, child;
  if (args.raw) {
    sink = fs.createWriteStream(args.raw);
  } else {
    const out = args.out || path.join('out', 'sample.mp4');
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    const a = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(fps), '-i', 'pipe:0'];
    if (args.audio) a.push('-ss', String(from), '-t', show.duration.toFixed(3), '-i', args.audio);
    a.push('-map', '0:v');
    if (args.audio) a.push('-map', '1:a', '-af', `afade=t=in:d=0.05,afade=t=out:st=${(show.duration - 0.6).toFixed(3)}:d=0.6`, '-c:a', 'aac', '-b:a', '192k');
    a.push('-vf', `scale=${W * scale}:${H * scale}:flags=neighbor`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', '-t', show.duration.toFixed(3), out);
    child = spawn(args.ffmpeg || 'ffmpeg', a, { stdio: ['pipe', 'inherit', 'inherit'] });
    sink = child.stdin;
  }
  for (let f = 0; f < total; f++) {
    show.frame(fb, from + f / fps);
    if (!sink.write(Buffer.from(fb.d))) await new Promise((r) => sink.once('drain', r));
  }
  sink.end();
  if (child) {
    const code = await new Promise((r) => child.on('close', r));
    if (code !== 0) { console.error('ffmpeg exited with ' + code); process.exit(1); }
  } else {
    await new Promise((r) => sink.on('finish', r));
  }
  console.log(`${total} frames, ${show.duration.toFixed(2)} s, marks ${JSON.stringify(show.marks)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
