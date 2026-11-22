// Writes manifest.json (file -> SHA-256) for everything sync.js should copy.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const files = ['build.js', 'lib/fx.js', 'photos.json', 'CREDITS.md', 'package.json']
  .concat(fs.readdirSync(path.join(__dirname, 'photos')).sort().map((f) => 'photos/' + f));
const manifest = {};
for (const f of files) {
  manifest[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, f))).digest('hex');
}
fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(files.length + ' files listed');
