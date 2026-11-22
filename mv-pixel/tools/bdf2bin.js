'use strict';
// Packs a BDF bitmap font into assets/px12.bin.gz so the renderer needs no font rasteriser.
//   node tools/bdf2bin.js <font.bdf>
// Layout (little endian): "PXF1", u32 count, i16 ascent, i16 descent, u32 codepoints[count],
// u32 offsets[count], then per glyph: u8 advance, u8 w, u8 h, i8 xoff, i8 yoff, u16 rows[h]
// (bit 15 = leftmost pixel).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const src = process.argv[2];
if (!src) throw new Error('usage: node tools/bdf2bin.js <font.bdf>');
const lines = fs.readFileSync(src, 'latin1').split('\n');

let ascent = 0;
let descent = 0;
const glyphs = [];
let g = null;
let inBitmap = false;
for (const line of lines) {
  if (line.startsWith('FONT_ASCENT ')) ascent = Number(line.slice(12));
  else if (line.startsWith('FONT_DESCENT ')) descent = Number(line.slice(13));
  else if (line.startsWith('STARTCHAR')) { g = { rows: [] }; inBitmap = false; }
  else if (!g) continue;
  else if (line.startsWith('ENCODING ')) g.cp = Number(line.slice(9));
  else if (line.startsWith('DWIDTH ')) g.adv = Number(line.split(' ')[1]);
  else if (line.startsWith('BBX ')) [g.w, g.h, g.x, g.y] = line.slice(4).split(' ').map(Number);
  else if (line.startsWith('BITMAP')) inBitmap = true;
  else if (line.startsWith('ENDCHAR')) {
    if (g.cp >= 32 && g.cp < 0x30000 && g.w <= 16) glyphs.push(g);
    g = null;
    inBitmap = false;
  } else if (inBitmap) {
    const hex = line.trim();
    g.rows.push(parseInt(hex.padEnd(4, '0').slice(0, 4), 16));
  }
}
glyphs.sort((a, b) => a.cp - b.cp);

const head = Buffer.alloc(12);
head.write('PXF1', 0, 'latin1');
head.writeUInt32LE(glyphs.length, 4);
head.writeInt16LE(ascent, 8);
head.writeInt16LE(descent, 10);
const cps = Buffer.alloc(glyphs.length * 4);
const offs = Buffer.alloc(glyphs.length * 4);
const bodies = [];
let off = 0;
glyphs.forEach((gl, i) => {
  cps.writeUInt32LE(gl.cp, i * 4);
  offs.writeUInt32LE(off, i * 4);
  const b = Buffer.alloc(5 + gl.h * 2);
  b.writeUInt8(gl.adv, 0);
  b.writeUInt8(gl.w, 1);
  b.writeUInt8(gl.h, 2);
  b.writeInt8(gl.x, 3);
  b.writeInt8(gl.y, 4);
  for (let r = 0; r < gl.h; r++) b.writeUInt16LE(gl.rows[r] || 0, 5 + r * 2);
  bodies.push(b);
  off += b.length;
});
const raw = Buffer.concat([head, cps, offs, ...bodies]);
const out = path.join(__dirname, '..', 'assets', 'px12.bin.gz');
fs.writeFileSync(out, zlib.gzipSync(raw, { level: 9 }));
console.log(`${glyphs.length} glyphs, ${raw.length} bytes raw, ${fs.statSync(out).size} bytes gzipped`);
