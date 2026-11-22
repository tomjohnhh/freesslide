'use strict';
// Contact sheet of chosen moments, for reviewing shots without encoding a video.
//   node tools/sheet.js --config work/show.json --out sheet.png --times 16.2,17,18.5
//   node tools/sheet.js --config work/show.json --out sheet.png --from 16 --to 32 --step 0.5
//   [--cols 4] [--scale 2] [--label 1]
const fs = require('fs');
const { save } = require('./png');
const { FB } = require('../lib/fb');
const { text } = require('../lib/font');
const { createShow, W, H } = require('../lib/show');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8').replace(/^\uFEFF/, ''));
const show = createShow(cfg);
let times;
if (args.times) times = args.times.split(',').map(Number);
else {
  times = [];
  const step = Number(args.step || 1);
  for (let t = Number(args.from || 0); t < Number(args.to || show.duration) - 1e-6; t += step) times.push(Math.round(t * 1000) / 1000);
}
const cols = Number(args.cols || 4);
const scale = Number(args.scale || 2);
const rows = Math.ceil(times.length / cols);
const sheet = new FB(cols * W * scale, rows * H * scale);
const fb = new FB(W, H);
times.forEach((t, i) => {
  show.frame(fb, t);
  if (args.label !== '0') text(fb, t.toFixed(2), W - 4, 2, 0xffff66, { align: 'right', outline: 0x000000 });
  sheet.blit(fb, 0, 0, W, H, (i % cols) * W * scale, Math.floor(i / cols) * H * scale, scale);
});

const out = args.out || 'sheet.png';
save(out, sheet);
console.log(`${times.length} frames -> ${out} (${sheet.w}x${sheet.h})`);
