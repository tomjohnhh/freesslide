'use strict';
// Writes manifest.json (file -> SHA-256) for sync.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const files = ['package.json', 'render.js', 'sync.js', 'assets/fonts/RiversideKai.ttf', 'assets/fonts/FONT-LICENSE.txt'];
for (const dir of ['lib', 'tools']) for (const f of fs.readdirSync(path.join(root, dir)).sort()) if (f.endsWith('.js')) files.push(dir + '/' + f);
const manifest = {};
for (const f of files) manifest[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(Object.keys(manifest).length + ' files listed');
