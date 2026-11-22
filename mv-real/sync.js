'use strict';
// Copies the renderer's files from the project's GitHub branch into this folder, checking
// every file against the SHA-256 in manifest.json.
//   node sync.js <commit-or-branch>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ref = process.argv[2] || 'cursor/real-mv-8218';
const BASE = `https://raw.githubusercontent.com/tomjohnhh/freesslide/${ref}/mv-real/`;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function get(file) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(BASE + file.split('/').map(encodeURIComponent).join('/'), { signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
  throw lastError;
}

(async () => {
  const manifest = JSON.parse((await get('manifest.json')).toString('utf8'));
  let updated = 0;
  let failed = 0;
  for (const [file, hash] of Object.entries(manifest)) {
    const target = path.join(__dirname, file);
    if (fs.existsSync(target) && sha256(fs.readFileSync(target)) === hash) continue;
    try {
      const buf = await get(file);
      if (sha256(buf) !== hash) throw new Error('sha256 mismatch');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buf);
      updated++;
      console.log('updated  ' + file);
    } catch (err) {
      failed++;
      console.log('FAILED   ' + file + '  ' + err.message);
    }
  }
  console.log(`${Object.keys(manifest).length} files, ${updated} updated, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
