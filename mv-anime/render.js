'use strict';
// Renders the show to a video.
//   node render.js --config work/show.json --out out/video.mp4 [--ffmpeg path] [--audio file]
//                  [--scale 1] [--from 0] [--to end] [--workers 4] [--preset slow] [--crf 18]
// --audio is any file ffmpeg can read; only its sound is used, from the same position as the picture.
// --scale 0.5 gives a quick half-size preview. Frames are drawn by several worker threads and
// handed to ffmpeg in order. Run from this folder.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { FB } = require('./lib/raster');
const { createShow } = require('./lib/show');
const ass = require('./lib/ass');

if (!isMainThread) {
  const show = createShow(workerData.cfg), fb = new FB(workerData.scale);
  parentPort.on('message', (f) => {
    show.frame(fb, workerData.from + f / show.fps);
    const copy = new Uint8Array(fb.d.length);
    copy.set(fb.d);
    parentPort.postMessage({ f, data: copy }, [copy.buffer]);
  });
  return;
}

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.config) { console.error('usage: node render.js --config show.json --out video.mp4 [--audio file] [--ffmpeg path] [--scale 1] [--workers 4]'); process.exit(2); }

const ffmpeg = args.ffmpeg || 'ffmpeg';
const scale = Number(args.scale || 1);
const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8').replace(/^\uFEFF/, ''));
const show = createShow(cfg), fps = show.fps;
const from = Number(args.from || 0), to = Math.min(show.duration, Number(args.to || show.duration));
const total = Math.round((to - from) * fps);
const size = new FB(scale);
const workers = Math.max(1, Math.min(total, Number(args.workers || Math.max(1, Math.min(6, os.cpus().length - 2)))));

async function main() {
  const out = path.resolve(args.out || path.join('out', 'video.mp4'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'work'), { recursive: true });
  const script = path.join('work', `captions-${process.pid}.ass`);
  fs.writeFileSync(path.join(__dirname, script), ass.build({ lines: show.lines, texts: show.texts, shift: from }), 'utf8');
  const a = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${size.w}x${size.h}`, '-r', String(fps), '-i', 'pipe:0'];
  if (args.audio) a.push('-ss', String(from), '-t', (to - from).toFixed(3), '-i', path.resolve(args.audio));
  a.push('-map', '0:v');
  if (args.audio) {
    const fadeOut = to >= show.duration - 0.01 ? `,afade=t=out:st=${(to - from - 0.7).toFixed(3)}:d=0.7` : '';
    a.push('-map', '1:a:0', '-af', `afade=t=in:d=0.05${fadeOut}`, '-c:a', 'aac', '-b:a', '192k');
  }
  const vf = `subtitles=${script.replace(/\\/g, '/')}:fontsdir=assets/fonts,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`;
  a.push('-vf', vf, '-c:v', 'libx264', '-preset', args.preset || 'slow', '-crf', String(args.crf || 18), '-profile:v', 'high', '-level', '4.2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(fps), '-movflags', '+faststart', '-t', (to - from).toFixed(3), out);
  const child = spawn(ffmpeg, a, { stdio: ['pipe', 'inherit', 'inherit'], cwd: __dirname });
  const started = Date.now();

  // frames come back in any order; they are written in theirs
  const ready = new Map();
  let next = 0, asked = 0, failed = null, done;
  const finished = new Promise((r) => { done = r; });
  const pool = [];
  const ask = (w) => { if (asked < total && asked - next < workers * 3) { w.busy = true; w.postMessage(asked++); } else w.busy = false; };
  let writing = false;
  const flush = async () => {
    if (writing) return;
    writing = true;
    while (ready.has(next)) {
      const data = ready.get(next);
      ready.delete(next);
      next++;
      if (!child.stdin.write(Buffer.from(data.buffer))) await new Promise((r) => child.stdin.once('drain', r));
      for (const w of pool) if (!w.busy) ask(w);
    }
    writing = false;
    if (next >= total) done();
  };
  for (let i = 0; i < workers; i++) {
    const w = new Worker(__filename, { workerData: { cfg, scale, from } });
    w.on('message', (m) => { ready.set(m.f, m.data); ask(w); flush(); });
    w.on('error', (err) => { failed = err; done(); });
    pool.push(w);
    ask(w);
  }
  await finished;
  for (const w of pool) await w.terminate();
  if (failed) { child.stdin.destroy(); throw failed; }
  child.stdin.end();
  const code = await new Promise((r) => child.on('close', r));
  fs.rmSync(path.join(__dirname, script), { force: true });
  if (code !== 0) { console.error('ffmpeg exited with ' + code); process.exit(1); }
  console.log(`${total} frames at ${fps} fps, ${(to - from).toFixed(2)} s, ${size.w}x${size.h}, ${workers} workers, ${((Date.now() - started) / 1000).toFixed(1)} s to render`);
}

main().catch((err) => { console.error(err); process.exit(1); });
