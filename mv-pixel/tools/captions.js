'use strict';
// Finds when a burned-in caption changes in a video, so lines can be timed.
//   node tools/captions.js <video> <ffmpeg> <outPrefix> [crop=720:80:280:580]
// Writes <outPrefix>.json ([{ t0, t1 }]) and <outPrefix>.gray (one 360x40 strip per
// caption, stacked) plus its size, for a person to read. No text recognition is done.
const fs = require('fs');
const { spawnSync } = require('child_process');

const [video, ffmpeg, prefix, crop = '720:80:280:580'] = process.argv.slice(2);
if (!video || !ffmpeg || !prefix) { console.error('usage: node tools/captions.js <video> <ffmpeg> <outPrefix> [crop]'); process.exit(2); }

const SW = 360, SH = 40, FPS = 10;
const res = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', `fps=${FPS},crop=${crop},scale=${SW}:${SH},format=gray`, '-f', 'rawvideo', 'pipe:1'], { maxBuffer: 1 << 30 });
if (res.status !== 0) { console.error(String(res.stderr)); process.exit(1); }
const buf = res.stdout;
const frames = Math.floor(buf.length / (SW * SH));

const mask = (f) => {
  const m = new Uint8Array(SW * SH);
  let ink = 0;
  const base = f * SW * SH;
  for (let i = 0; i < SW * SH; i++) if (buf[base + i] > 150) { m[i] = 1; ink++; }
  return { m, ink };
};

const segs = [];
let cur = null;
for (let f = 0; f < frames; f++) {
  const { m, ink } = mask(f);
  if (ink < 60) { if (cur) { cur.end = f; segs.push(cur); cur = null; } continue; }
  if (cur) {
    let outside = 0;
    for (let i = 0; i < m.length; i++) if (m[i] && !cur.ref[i]) outside++;
    if (outside > 0.3 * ink && outside > 50) { cur.end = f; segs.push(cur); cur = null; }
  }
  if (!cur) cur = { start: f, ref: new Uint8Array(SW * SH), best: f, bestInk: 0, inks: [] };
  for (let i = 0; i < m.length; i++) if (m[i]) cur.ref[i] = 1;
  cur.inks.push(ink);
  if (ink > cur.bestInk) { cur.bestInk = ink; cur.best = f; }
}
if (cur) { cur.end = frames; segs.push(cur); }

const kept = segs.filter((s) => s.end - s.start >= 4 && s.bestInk > 150);
const out = kept.map((s) => {
  // the caption counts as visible once it reaches a third of its full brightness
  let a = 0;
  while (a < s.inks.length && s.inks[a] < s.bestInk / 3) a++;
  let b = s.inks.length - 1;
  while (b > a && s.inks[b] < s.bestInk / 3) b--;
  return { t0: Math.round(((s.start + a) / FPS) * 10) / 10, t1: Math.round(((s.start + b + 1) / FPS) * 10) / 10 };
});
fs.writeFileSync(prefix + '.json', JSON.stringify(out));
const sheet = Buffer.alloc(SW * SH * kept.length);
kept.forEach((s, i) => buf.copy(sheet, i * SW * SH, s.best * SW * SH, (s.best + 1) * SW * SH));
fs.writeFileSync(prefix + '.gray', sheet);
console.log(JSON.stringify({ frames, captions: kept.length, width: SW, height: SH * kept.length, times: out }));
