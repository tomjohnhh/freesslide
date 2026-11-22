'use strict';
// Writes manifest.json (file -> SHA-256) for sync.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const files = ['package.json', 'analyze.js', 'render.js', 'sync.js', 'tools/captions.js', 'assets/px12.bin.gz', 'assets/FONT-LICENSE.txt'];
for (const f of fs.readdirSync(path.join(root, 'lib')).sort()) if (f.endsWith('.js')) files.push('lib/' + f);
const manifest = {};
for (const f of files) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) manifest[f] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(Object.keys(manifest).length + ' files listed');
