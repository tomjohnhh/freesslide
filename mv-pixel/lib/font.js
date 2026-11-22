'use strict';
// Bitmap text from assets/px12.bin.gz (Fusion Pixel 12px, SIL OFL 1.1; see assets/FONT-LICENSE.txt).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const raw = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '..', 'assets', 'px12.bin.gz')));
if (raw.toString('latin1', 0, 4) !== 'PXF1') throw new Error('bad font file');
const count = raw.readUInt32LE(4);
const ASCENT = raw.readInt16LE(8);
const CPS = 12;
const OFFS = CPS + count * 4;
const BODY = OFFS + count * 4;

function find(cp) {
  let lo = 0, hi = count - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = raw.readUInt32LE(CPS + mid * 4);
    if (v === cp) return BODY + raw.readUInt32LE(OFFS + mid * 4);
    if (v < cp) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}

const has = (ch) => find(ch.codePointAt(0)) >= 0;

function measure(str, { scale = 1, spacing = 0 } = {}) {
  let w = 0;
  for (const ch of str) {
    const p = find(ch.codePointAt(0));
    w += ((p < 0 ? 6 : raw.readUInt8(p)) + spacing) * scale;
  }
  return w - spacing * scale;
}

// Draws str with its top-left at (x, y); the text line is 16 px tall at scale 1 (glyph
// bodies sit roughly in rows 2..13). Options: scale, spacing, align ('left' | 'center' |
// 'right'), outline (colour of a 1 px outline), shadow (colour of a drop shadow),
// chars (number of characters to show, for typewriter reveals).
function text(fb, str, x, y, color, opts = {}) {
  const { scale = 1, spacing = 0, align = 'left', outline, shadow, chars = Infinity } = opts;
  const width = measure(str, { scale, spacing });
  let x0 = Math.round(align === 'center' ? x - width / 2 : align === 'right' ? x - width : x);
  const passes = [];
  if (outline !== undefined) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) passes.push([dx * scale, dy * scale, outline]);
  }
  if (shadow !== undefined) passes.push([scale, scale, shadow]);
  passes.push([0, 0, color]);
  for (const [dx, dy, col] of passes) {
    let cx = x0;
    let n = 0;
    for (const ch of str) {
      if (n++ >= chars) break;
      const p = find(ch.codePointAt(0));
      if (p < 0) { cx += (6 + spacing) * scale; continue; }
      const adv = raw.readUInt8(p), w = raw.readUInt8(p + 1), h = raw.readUInt8(p + 2);
      const gx = raw.readInt8(p + 3), gy = raw.readInt8(p + 4);
      const top = ASCENT - gy - h;
      for (let r = 0; r < h; r++) {
        const bits = raw.readUInt16LE(p + 5 + r * 2);
        for (let b = 0; b < w; b++) {
          if (bits & (0x8000 >> b)) {
            if (scale === 1) fb.set(cx + gx + b + dx, y + top + r + dy, col);
            else fb.rect(cx + (gx + b) * scale + dx, y + (top + r) * scale + dy, scale, scale, col);
          }
        }
      }
      cx += (adv + spacing) * scale;
    }
  }
  return width;
}

module.exports = { text, measure, has };
