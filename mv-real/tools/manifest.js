'use strict';
// Writes assets/images.json (picture id -> file and size) and manifest.json (file -> SHA-256)
// for sync.js. Needs ffprobe.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const images = {};
for (const f of fs.readdirSync(path.join(root, 'assets', 'img')).sort()) {
  if (!/\.(jpg|png)$/.test(f)) continue;
  const res = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(root, 'assets', 'img', f)]);
  const [w, h] = res.stdout.toString().trim().split(',').map(Number);
  const id = f.replace(/\.\w+$/, '');
  images[id] = { file: f, w, h };
  if (id === 'desk') images[id].noise = 0.35;
}
fs.writeFileSync(path.join(root, 'assets', 'images.json'), JSON.stringify(images, null, 1) + '\n');

const files = ['package.json', 'render.js', 'sync.js', 'assets/images.json', 'assets/fonts/RiversideKai.ttf', 'assets/fonts/FONT-LICENSE.txt'];
for (const dir of ['lib', 'tools']) for (const f of fs.readdirSync(path.join(root, dir)).sort()) if (f.endsWith('.js')) files.push(dir + '/' + f);
for (const id of Object.keys(images)) files.push('assets/img/' + images[id].file);
const manifest = {};
for (const f of files) manifest[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(Object.keys(images).length + ' pictures, ' + Object.keys(manifest).length + ' files listed');
