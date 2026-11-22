'use strict';
// Things the shots are built from: the desk, polaroids, the album, the room, face panels,
// the camera viewfinder, fireworks and other small effects.

const { bayer, mix } = require('./fb');
const { text, measure } = require('./font');
const { drawGirl, drawBoy, SKIN, SKIN_SH } = require('./chars');
const world = require('./world');
const U = require('./util');
const { INK, clamp, lerp, easeOut } = U;

const W = 320;
const H = 180;

// ---- desk seen from above -----------------------------------------------------------

function deskWood(fb) {
  for (let y = 0; y < H; y++) {
    const plank = Math.floor((y + 8) / 32);
    const base = [0x6f4a3a, 0x77513f, 0x694537, 0x73503e, 0x6c4839, 0x755140][plank % 6];
    fb.rect(0, y, W, 1, base);
    if ((y + 8) % 32 === 0) fb.rect(0, y, W, 1, 0x452b27);
    if ((y + 8) % 32 === 1) fb.rect(0, y, W, 1, 0x8b6349);
  }
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(world.hash(i, 3) * W), y = Math.floor(world.hash(i, 5) * H), len = 5 + Math.floor(world.hash(i, 9) * 26);
    if ((y + 8) % 32 < 2) continue;
    fb.rect(x, y, len, 1, world.hash(i, 1) > 0.5 ? 0x5e3c31 : 0x82593f);
  }
  for (let p = 0; p < 6; p++) {
    const x = 30 + Math.floor(world.hash(p, 77) * 260);
    fb.rect(x, p * 32 - 6, 1, 30, 0x452b27);
  }
  // lamp light from the upper left, darker towards the lower right
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 120) / 250, (y - 56) / 170);
      if (d > 0.5) fb.blend(x, y, 0x24121a, Math.min(4, Math.floor((d - 0.5) * 9)) * 0.11);
      else if (d < 0.26) fb.blend(x, y, 0xffc98a, d < 0.14 ? 0.14 : 0.07);
    }
  }
}

function deskBook(fb) {
  fb.rectA(17, 51, 62, 86, 0x1a0c12, 0.4);
  fb.rect(12, 46, 62, 86, 0x2f6052);
  fb.rect(12, 46, 62, 2, 0x4a8a72); fb.rect(12, 46, 2, 86, 0x4a8a72);
  fb.rect(72, 48, 2, 84, 0x1f4339); fb.rect(14, 130, 60, 2, 0x1f4339);
  fb.rect(74, 49, 3, 84, 0xf1e9d8); fb.rect(15, 132, 62, 3, 0xf1e9d8);
  fb.rect(74, 52, 3, 1, 0xcfc4ad); fb.rect(74, 90, 3, 1, 0xcfc4ad); fb.rect(40, 133, 20, 1, 0xcfc4ad);
  fb.rect(18, 52, 50, 1, 0x4a8a72); fb.rect(18, 125, 50, 1, 0x4a8a72);
  fb.rect(22, 70, 42, 22, 0xf1e9d8); fb.rect(22, 70, 42, 1, 0xcfc4ad);
  text(fb, '相册', 43, 73, 0x3d4a66, { align: 'center' });
  fb.rect(52, 132, 4, 16, 0xd9574c); fb.rect(52, 146, 2, 2, 0x6f4a3a); fb.rect(54, 147, 2, 1, 0xd9574c);
}

function deskTea(fb, t, cx = 264, cy = 36) {
  fb.ellipseA(cx + 4, cy + 4, 21, 20, 0x1a0c12, 0.35);
  fb.disc(cx, cy, 19, 0xe8e0d2); fb.disc(cx, cy, 17, 0xf7f2e8); fb.disc(cx, cy, 13, 0xe1d8c8);
  fb.disc(cx, cy, 12, 0xf9f5ec); fb.disc(cx, cy, 10, 0xb86a33); fb.ellipse(cx - 3, cy - 3, 5, 3, 0xcf8444);
  fb.rect(cx + 12, cy - 3, 7, 6, 0xf9f5ec); fb.rect(cx + 14, cy - 1, 3, 2, 0xe1d8c8);
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.5 + i * 0.37) % 1;
    const sx = cx - 6 + i * 6 + Math.round(Math.sin(ph * 6.28 + i) * 2);
    const sy = cy - 8 - Math.round(ph * 22);
    if (ph < 0.85) { fb.blend(sx, sy, 0xffffff, 0.55 * (1 - ph)); fb.blend(sx, sy - 1, 0xffffff, 0.4 * (1 - ph)); }
  }
}

function deskPencil(fb, x = 240, y = 122) {
  fb.rectA(x, y + 5, 56, 3, 0x1a0c12, 0.35);
  fb.rect(x, y, 5, 4, 0xf29aa6); fb.rect(x + 5, y, 3, 4, 0xc9c9d6);
  fb.rect(x + 8, y, 36, 4, 0xf4c34f); fb.rect(x + 8, y, 36, 1, 0xffe08a); fb.rect(x + 8, y + 3, 36, 1, 0xc9952f);
  fb.rect(x + 44, y, 3, 4, 0xe9c9a0); fb.rect(x + 47, y + 1, 2, 2, 0xe9c9a0); fb.rect(x + 49, y + 1, 2, 2, 0x3d3a4a);
}

// o: { book, tea, pencil } (all on unless set to false)
function desk(fb, t, o = {}) {
  deskWood(fb);
  if (o.book !== false) deskBook(fb);
  if (o.tea !== false) deskTea(fb, t);
  if (o.pencil !== false) deskPencil(fb);
}

// ---- polaroids ----------------------------------------------------------------------

const PH = { x: 104, y: 68, w: 112, h: 84 };   // the picture area of the big polaroid
const MID = { x: 112, y: 82, w: 96, h: 72 };   // the smaller prints in the album

// Draws a print whose picture is the region `crop` of `src`.
// o: { develop 0..1, m, bottom, tape, tapeCol, shadow }
function polaroid(fb, px, py, src, crop, o = {}) {
  const develop = o.develop == null ? 1 : o.develop;
  const m = o.m == null ? 6 : o.m, bottom = o.bottom == null ? 22 : o.bottom;
  const fw = crop.w + m * 2, fh = crop.h + m + bottom;
  if (o.shadow !== false) fb.rectA(px + 4, py + 5, fw, fh, 0x1a0c12, 0.42);
  fb.rect(px, py, fw, fh, 0xf7f1e5);
  fb.rect(px + fw - 1, py, 1, fh, 0xd8cdb9); fb.rect(px, py + fh - 1, fw, 1, 0xd8cdb9);
  fb.rect(px + m - 1, py + m - 1, crop.w + 2, crop.h + 2, 0xd8cdb9);
  const ix = px + m, iy = py + m;
  if (develop >= 1) {
    for (let y = 0; y < crop.h; y++) for (let x = 0; x < crop.w; x++) fb.set(ix + x, iy + y, src.get(crop.x + x, crop.y + y));
  } else {
    for (let y = 0; y < crop.h; y++) {
      for (let x = 0; x < crop.w; x++) {
        const shown = bayer(x, y) + world.hash(x >> 2, y >> 2) * 3 < develop * 19;
        fb.set(ix + x, iy + y, shown ? src.get(crop.x + x, crop.y + y) : 0xe9dfd0);
      }
    }
  }
  if (o.tape !== false) {
    const tc = o.tapeCol || 0xf6d06a;
    const th = o.tapeCol ? mix(tc, 0xffffff, 0.55) : 0xfff0b8;
    fb.rectA(px + fw / 2 - 16, py - 5, 32, 9, tc, 0.82);
    for (let i = 0; i < 32; i += 4) fb.rectA(px + fw / 2 - 16 + i, py - 5, 2, 9, th, 0.6);
  }
  return { fw, fh, ix, iy };
}

// Handwritten caption under the picture: the title, then a small heart.
function photoCaption(fb, px, py, fw, picH, title, chars) {
  if (!(chars > 0) || !title) return;
  const n = [...title].length;
  const w = measure(title, { spacing: 1 }) + 12;
  const cx = Math.round(px + fw / 2 - w / 2);
  text(fb, title, cx, py + picH + 9, 0x3d4a78, { spacing: 1, chars });
  if (chars > n) fb.stamp(cx + w - 8, py + picH + 14, U.HEART, { X: 0xe5504a });
}

function dateStamp(fb, x, y, s) {
  if (s) text(fb, s, x, y, 0xffa63d, { align: 'right', outline: 0x7a3a1a });
}

// ---- face panels --------------------------------------------------------------------

// A framed close-up: a 30x28 cell around the head, enlarged `scale` times.
// o: { scale, bgA, bgB, pattern: 'dots' | 'rain' | 'rays' | 'plain' }
function panel(fb, cell, x, y, who, pose, t, o = {}) {
  const scale = o.scale || 5;
  const bgA = o.bgA, bgB = o.bgB;
  cell.clear(bgA);
  const pattern = o.pattern || 'dots';
  if (pattern === 'dots') {
    for (let cy = 0; cy < cell.h; cy++) {
      for (let cx = 0; cx < cell.w; cx++) {
        const yy = cy + Math.floor(t * 4);
        if (((cx + (who === 'girl' ? 0 : 2)) % 6 === 0) && (yy % 6 === 0)) cell.set(cx, cy, bgB);
        if (((cx + 3 + (who === 'girl' ? 0 : 2)) % 6 === 0) && ((yy + 3) % 6 === 0)) cell.set(cx, cy, bgB);
      }
    }
  } else if (pattern === 'rain') {
    for (let i = 0; i < 16; i++) {
      const rx = Math.floor(world.hash(i, 31) * cell.w);
      const ry = Math.floor((world.hash(i, 37) * cell.h + t * (16 + world.hash(i, 41) * 10)) % (cell.h + 4)) - 2;
      cell.rect(rx, ry, 1, 3, bgB);
    }
  } else if (pattern === 'rays') {
    for (let cy = 0; cy < cell.h; cy++) {
      for (let cx = 0; cx < cell.w; cx++) {
        const a = Math.atan2(cy - 14, cx - 15) + t * 0.6;
        if (Math.floor((a / Math.PI) * 6 + 12) % 2 === 0) cell.set(cx, cy, bgB);
      }
    }
  }
  if (who === 'girl') drawGirl(cell, 15, 47, { ...pose, shadow: false });
  else drawBoy(cell, 14, 50, { ...pose, shadow: false });
  const pw = 30 * scale + 4, ph = 28 * scale + 4;
  fb.rectA(x + 3, y + 4, pw, ph, 0x120a1c, 0.5);
  fb.rect(x, y, pw, ph, o.frame || 0xf7f1e5);
  fb.blit(cell, 0, 0, 30, 28, x + 2, y + 2, scale);
  return { pw, ph };
}

// Dark dotted backdrop behind panels.
function backdrop(fb, t, c0 = 0x2b2040, c1 = 0x3a2c55) {
  fb.clear(c0);
  for (let y = 0; y < H; y++) for (let x = (y + Math.floor(t * 10)) % 8; x < W; x += 8) fb.set(x, y, c1);
}

// ---- camera viewfinder --------------------------------------------------------------

// u: seconds since the viewfinder came up. o: { no, count: beat at which "3" shows, beat }
function viewfinder(fb, t, u, b, o = {}) {
  const C = 0xffffff;
  const x0 = 22, y0 = 12, x1 = W - 23, y1 = 150, L = 14;
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    fb.rect(dx > 0 ? x : x - L + 1, dy > 0 ? y : y - 1, L, 2, C);
    fb.rect(dx > 0 ? x : x - 1, dy > 0 ? y : y - L + 1, 2, L, C);
  }
  // focus box closing in on the pair, then locking green
  const k = easeOut(u / 0.55);
  const locked = u > 0.75;
  const blink = !locked && u > 0.55 && Math.floor(u * 16) % 2 === 0;
  const fw = Math.round(lerp(120, 70, k)), fh = Math.round(lerp(96, 62, k));
  const fx = 160 - (fw >> 1), fy = 126 - (fh >> 1) - 6;
  const fc = locked ? 0x8dffa8 : 0xfff2b0;
  if (!blink) {
    for (const [x, y, dx, dy] of [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]]) {
      fb.rect(dx > 0 ? x : x - 6, y, 7, 1, fc);
      fb.rect(x, dy > 0 ? y : y - 6, 1, 7, fc);
    }
  }
  fb.rect(158, 80, 5, 1, C); fb.rect(160, 78, 1, 5, C);
  const recOn = Math.floor(t * 2.5) % 2 === 0;
  if (recOn) fb.disc(31, 23, 2, 0xff4d4d);
  text(fb, '定时自拍', 37, 15, C, { outline: INK });
  text(fb, o.no || 'No.001', W - 62, 15, C, { align: 'right', outline: INK });
  fb.rect(W - 56, 18, 18, 9, INK); fb.rect(W - 55, 19, 16, 7, C); fb.rect(W - 54, 20, 14, 5, INK);
  fb.rect(W - 38, 21, 2, 3, C);
  fb.rect(W - 53, 21, 9, 3, 0x8dffa8);
  text(fb, 'F2.8  1/125', 30, 134, C, { outline: INK });
  text(fb, 'ISO 200', W - 31, 134, C, { align: 'right', outline: INK });
  const c0 = o.count == null ? 1 : o.count;
  if (b >= c0 && b < c0 + 3) {
    const n = String(3 - Math.floor(b - c0));
    const pop = ((b - c0) % 1) < 0.1 ? 4 : 3;
    const w = measure(n, { scale: pop });
    text(fb, n, Math.round(160 - w / 2), pop === 4 ? 18 : 24, 0xfff6e0, { scale: pop, outline: INK });
  }
}

// ---- album, open on the desk --------------------------------------------------------

const ALBUM = { x: 36, y: 10, w: 248, h: 144, gutter: 160, pageW: 118 };

function albumBase(fb) {
  const A = ALBUM;
  fb.rectA(A.x + 5, A.y + 6, A.w, A.h, 0x1a0c12, 0.42);
  fb.rect(A.x, A.y, A.w, A.h, 0x2f6052);
  fb.rect(A.x, A.y, A.w, 2, 0x4a8a72); fb.rect(A.x, A.y, 2, A.h, 0x4a8a72);
  fb.rect(A.x + A.w - 2, A.y + 2, 2, A.h - 2, 0x1f4339); fb.rect(A.x + 2, A.y + A.h - 2, A.w - 2, 2, 0x1f4339);
  // page block edges
  fb.rect(A.x + 4, A.y + 5, A.w - 8, A.h - 9, 0xcfc4ad);
  fb.rect(A.x + 5, A.y + 4, A.w - 10, A.h - 9, 0xe3d9c4);
}

function pageRect(side) {
  const A = ALBUM;
  return side === 'L' ? { x: A.gutter - A.pageW, y: A.y + 5, w: A.pageW, h: A.h - 12 } : { x: A.gutter, y: A.y + 5, w: A.pageW, h: A.h - 12 };
}

function pagePaper(fb, side, shade = 0) {
  const p = pageRect(side);
  fb.rect(p.x, p.y, p.w, p.h, 0xf4ecda);
  // soft shadow into the gutter
  for (let i = 0; i < 6; i++) {
    const gx = side === 'L' ? p.x + p.w - 1 - i : p.x + i;
    fb.rectA(gx, p.y, 1, p.h, 0x8a7a66, 0.34 - i * 0.055);
  }
  fb.rect(side === 'L' ? p.x : p.x + p.w - 1, p.y, 1, p.h, 0xd8cdb9);
  for (let i = 0; i < 40; i++) {
    const fx = p.x + 4 + Math.floor(world.hash(i, side === 'L' ? 11 : 13) * (p.w - 8));
    const fy = p.y + 3 + Math.floor(world.hash(i, 17) * (p.h - 6));
    fb.set(fx, fy, 0xe9dfca);
  }
  if (shade > 0) fb.rectA(p.x, p.y, p.w, p.h, 0x5a4a3a, shade);
  return p;
}

// Small triangles that hold a print by its corners.
function photoCorners(fb, x, y, w, h, c = 0x3d4a66) {
  for (let i = 0; i < 6; i++) {
    fb.rect(x - 1, y - 1 + i, 6 - i, 1, c);
    fb.rect(x + w - 5 + i, y - 1 + i, 6 - i, 1, c);
    fb.rect(x - 1, y + h - i, 6 - i, 1, c);
    fb.rect(x + w - 5 + i, y + h - i, 6 - i, 1, c);
  }
}

// ---- the room at night --------------------------------------------------------------

const BOOKS = [0xd9574c, 0x4a8a72, 0xf4c34f, 0x5c82ba, 0xe8e0d2, 0x9a6ab0, 0xf29a7c, 0x3d4a78, 0x7fb4a0, 0xc9976a];

// o: { actors: fn(fb) drawn behind the desk, items: fn(fb) drawn on the desk, snow, lamp (0..1), clock: seconds }
function room(fb, t, o = {}) {
  fb.vgrad(0, 0, W, 160, [[0, 0x2a2440], [1, 0x3c3254]], 4);
  for (let y = 6; y < 156; y += 12) for (let x = ((y / 12) & 1) * 8 + 4; x < W; x += 16) { fb.set(x, y, 0x473c62); fb.set(x + 1, y + 1, 0x33294a); }
  fb.rect(0, 156, W, 3, 0x5c4660); fb.rect(0, 156, W, 1, 0x7a6280);
  fb.rect(0, 159, W, 21, 0x35262c);

  // window with the city outside
  const wx = 22, wy = 14, ww = 100, wh = 82;
  fb.rect(wx - 4, wy - 4, ww + 8, wh + 8, 0xe9dfcf); fb.rect(wx - 4, wy + wh + 3, ww + 8, 1, 0xb9ad9a);
  fb.vgrad(wx, wy, ww, wh, [[0, 0x0a0f2c], [0.6, 0x1a2356], [1, 0x34428a]], 4);
  for (let i = 0; i < 26; i++) {
    const sx = wx + Math.floor(world.hash(i, 61) * ww), sy = wy + Math.floor(world.hash(i, 67) * 40);
    if (Math.sin(t * 1.8 + i) > -0.4) fb.set(sx, sy, world.hash(i, 3) > 0.6 ? 0xffffff : 0x8f9ad0);
  }
  fb.disc(wx + 76, wy + 16, 7, 0xf6f2dc); fb.rect(wx + 78, wy + 13, 2, 2, 0xe2dcc0); fb.rect(wx + 72, wy + 18, 2, 1, 0xe2dcc0);
  fb.clip(wx, wy, ww, wh);
  for (let i = 0; i < 16; i++) {
    const bw = 5 + Math.floor(world.hash(i, 71) * 8), bh = 14 + Math.floor(world.hash(i, 73) * 34);
    const bx = wx - 4 + i * 7 + Math.floor(world.hash(i, 79) * 3);
    const far = i % 3 === 0;
    fb.rect(bx, wy + wh - bh, bw, bh, far ? 0x232a5c : 0x141a3e);
    if (!far) fb.rect(bx + bw - 1, wy + wh - bh, 1, bh, 0x2a3268);
    for (let yy = 2; yy < bh - 1; yy += 3) for (let xx = 1; xx < bw - 1; xx += 2) {
      const ph = world.hash(i * 31 + xx, yy, 5);
      if (ph < 0.42 && Math.sin(t * 0.4 + ph * 60) > -0.85) fb.set(bx + xx, wy + wh - bh + yy, ph < 0.2 ? 0xffe09a : 0xffb86a);
    }
  }
  if (o.snow !== false) {
    for (let i = 0; i < 26; i++) {
      const sx = wx + ((world.hash(i, 83) * ww + Math.sin(t * 0.8 + i) * 4 + t * 3) % ww);
      const sy = wy + ((world.hash(i, 89) * wh + t * (9 + world.hash(i, 97) * 8)) % wh);
      fb.set(sx, sy, 0xffffff);
      if (i % 3 === 0) fb.set(sx + 1, sy, 0xe4e9f8);
    }
  }
  fb.unclip();
  for (let i = 0; i < 30; i += 3) { fb.rectA(wx + 12 + i, wy + 4 + i, 1, 1, 0xffffff, 0.2); fb.rectA(wx + 20 + i, wy + 4 + i, 1, 1, 0xffffff, 0.14); }
  fb.rect(wx + (ww >> 1) - 1, wy, 3, wh, 0xe9dfcf); fb.rect(wx, wy + 38, ww, 3, 0xe9dfcf);
  fb.rect(wx + (ww >> 1) + 2, wy, 1, wh, 0xb9ad9a); fb.rect(wx, wy + 41, ww, 1, 0x8a8aa8);
  fb.rect(wx - 8, wy + wh + 4, ww + 16, 4, 0xf4ecdc); fb.rect(wx - 8, wy + wh + 8, ww + 16, 1, 0xb9ad9a);
  fb.rect(wx + 4, wy + wh, ww - 8, 1, 0xffffff); fb.rect(wx + 10, wy + wh - 1, 20, 1, 0xffffff); fb.rect(wx + 60, wy + wh - 1, 26, 1, 0xffffff);
  // curtains
  for (const [cx, dir] of [[wx - 12, 1], [wx + ww - 4, -1]]) {
    for (let i = 0; i < 16; i++) fb.rect(cx + i, wy - 8, 1, wh + 10 - Math.abs(i - 8), i % 4 < 2 ? 0x8c5266 : 0x7a4458);
    fb.rect(cx, wy - 9, 16, 2, 0xcbb89c);
    void dir;
  }
  fb.rect(wx - 14, wy - 11, ww + 28, 2, 0xcbb89c);
  // a small plant on the sill
  fb.rect(wx + 10, wy + wh - 5, 8, 6, 0xc86a4a); fb.rect(wx + 9, wy + wh - 6, 10, 2, 0xe08a62);
  fb.rect(wx + 13, wy + wh - 13, 3, 8, 0x4a8a54); fb.rect(wx + 10, wy + wh - 10, 3, 2, 0x4a8a54); fb.rect(wx + 16, wy + wh - 12, 2, 2, 0x5fa862);

  // clock
  const cx = 186, cy = 34;
  fb.disc(cx, cy, 12, 0x5a3c34); fb.disc(cx, cy, 10, 0xf4ecdc);
  for (let i = 0; i < 12; i++) fb.set(Math.round(cx + Math.sin(i * 0.5236) * 8), Math.round(cy - Math.cos(i * 0.5236) * 8), 0x8a7a66);
  const sec = o.clock == null ? Math.floor(t) : o.clock;
  const ha = 5.4 + sec * 0.0009, ma = 1.2 + sec * 0.011, sa = sec * 0.10472;
  fb.line(cx, cy, cx + Math.sin(ha) * 4, cy - Math.cos(ha) * 4, INK);
  fb.line(cx, cy, cx + Math.sin(ma) * 7, cy - Math.cos(ma) * 7, INK);
  fb.line(cx, cy, cx + Math.sin(sa) * 8, cy - Math.cos(sa) * 8, 0xd9574c);
  fb.set(cx, cy, 0xd9574c);

  // bookshelf
  const bx = 226, by = 18, bw = 82, bh = 100;
  fb.rect(bx, by, bw, bh, 0x4a322e); fb.rect(bx + 2, by + 2, bw - 4, bh - 4, 0x2c1f26);
  for (let s = 0; s < 3; s++) {
    const sy = by + 2 + s * 32;
    fb.rect(bx + 2, sy + 30, bw - 4, 2, 0x6a4a3e); fb.rect(bx + 2, sy + 30, bw - 4, 1, 0x8a6650);
    let x = bx + 4;
    let i = s * 20;
    while (x < bx + bw - 8) {
      const w = 3 + Math.floor(world.hash(i, 101) * 3), h = 16 + Math.floor(world.hash(i, 103) * 11);
      if (world.hash(i, 107) < 0.14) { x += 4 + w; i++; continue; }
      const col = BOOKS[Math.floor(world.hash(i, 109) * BOOKS.length)];
      fb.rect(x, sy + 30 - h, w, h, mix(col, 0x2c1f26, 0.28));
      fb.rect(x, sy + 30 - h, 1, h, mix(col, 0xffffff, 0.12));
      if (w > 3) fb.rect(x + 1, sy + 34 - h, w - 2, 1, 0xf4ecdc);
      x += w + (world.hash(i, 113) < 0.2 ? 2 : 0);
      i++;
    }
  }
  fb.rect(bx + 54, by + 44, 14, 18, 0xcbb89c); fb.rect(bx + 56, by + 46, 10, 12, 0xf29a7c); fb.rect(bx + 56, by + 52, 10, 6, 0x8a5f8f);
  fb.rect(bx + 10, by - 9, 12, 9, 0xc86a4a); fb.rect(bx + 9, by - 10, 14, 2, 0xe08a62);
  for (const [dx, dy] of [[0, -8], [4, -11], [8, -7], [-3, -5], [11, -4]]) fb.disc(bx + 12 + dx, by - 10 + dy, 3, dy < -7 ? 0x5fa862 : 0x3f7a4a);

  // chair back
  fb.rect(135, 88, 32, 34, 0x3a2622); fb.rect(137, 90, 28, 32, 0x5a3c34); fb.rect(137, 90, 28, 2, 0x7a5646); for (const sx of [144, 151, 158]) fb.rect(sx, 92, 1, 30, 0x3a2622);

  if (o.actors) o.actors(fb);

  // desk seen from the front
  const dx0 = 48, dx1 = 272, dy = 118;
  fb.rect(dx0 - 4, dy, dx1 - dx0 + 8, 5, 0xa8744e); fb.rect(dx0 - 4, dy, dx1 - dx0 + 8, 1, 0xe0aa72); fb.rect(dx0 - 4, dy + 4, dx1 - dx0 + 8, 1, 0x6a4636);
  fb.rect(dx0, dy + 5, dx1 - dx0, 36, 0x7a5140);
  fb.rect(dx0, dy + 5, dx1 - dx0, 2, 0x5a3a30);
  for (const x of [dx0 + 4, 200]) {
    fb.rect(x, dy + 10, 64, 26, 0x6a4636); fb.rect(x + 1, dy + 11, 62, 24, 0x845a44); fb.rect(x + 1, dy + 34, 62, 1, 0x6a4636);
    fb.rect(x + 27, dy + 21, 10, 3, 0xd9b98a); fb.rect(x + 27, dy + 23, 10, 1, 0x9a7a52);
  }
  fb.rect(dx0, dy + 41, 6, 12, 0x5a3a30); fb.rect(dx1 - 6, dy + 41, 6, 12, 0x5a3a30);

  // lamp on the desk
  const lx = 84;
  const lamp = o.lamp == null ? 1 : o.lamp;
  fb.rect(lx - 6, dy - 2, 13, 2, 0x2f3a44); fb.rect(lx - 4, dy - 3, 9, 1, 0x4a5a66);
  fb.rect(lx, dy - 24, 2, 22, 0x2f3a44); fb.rect(lx + 1, dy - 24, 1, 22, 0x5a6a76);
  fb.rect(lx, dy - 26, 14, 2, 0x2f3a44);
  for (let i = 0; i < 10; i++) {
    const half = 4 + i * 1.0;
    fb.rect(Math.round(lx + 16 - half) - 1, dy - 35 + i, Math.round(half * 2) + 2, 1, 0x16302a);
    fb.rect(Math.round(lx + 16 - half), dy - 35 + i, Math.round(half * 2), 1, i < 2 ? 0x6fb48a : i < 6 ? 0x3f7a62 : 0x2f6052);
  }
  fb.rect(lx + 9, dy - 33, 2, 5, 0x9fd8b4);
  fb.rect(lx + 3, dy - 25, 26, 1, lamp > 0 ? 0xfff6d0 : 0x8a8a7a);
  if (lamp > 0) {
    for (let i = 0; i < 24; i++) {
      const half = 13 + i * 2.5;
      fb.rectA(Math.round(lx + 16 - half), dy - 24 + i, Math.round(half * 2), 1, 0xffe2a6, (0.2 - i * 0.006) * lamp);
    }
    fb.ellipseA(lx + 16, dy + 1, 70, 4, 0xffe2a6, 0.2 * lamp);
  }

  if (o.items) o.items(fb);

  // the lamp is the only light: darken with distance from it
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 130) / 240, (y - 100) / 150);
      if (d > 0.42) fb.blend(x, y, 0x0c0a1c, Math.min(5, Math.floor((d - 0.42) * 11)) * 0.09 + (1 - lamp) * 0.2);
      else if (lamp > 0 && d < 0.3) fb.blend(x, y, 0xffc98a, (d < 0.16 ? 0.12 : 0.06) * lamp);
      else if (lamp < 1) fb.blend(x, y, 0x0c0a1c, (1 - lamp) * 0.2);
    }
  }
}

// ---- fireworks ----------------------------------------------------------------------

// One shell. `age` is seconds since launch; it bursts after `fuse` seconds at (x, y).
// o: { size, col, col2, seed, fuse, heart, from }
function firework(fb, x, y, age, o = {}) {
  const fuse = o.fuse == null ? 0.45 : o.fuse;
  const size = o.size || 26;
  const col = o.col || 0xffd98f, col2 = o.col2 || 0xffffff;
  if (age < 0) return 0;
  if (age < fuse) {
    const k = age / fuse;
    const fy = lerp(o.from == null ? 96 : o.from, y, easeOut(k));
    fb.set(x, fy, 0xffffff); fb.set(x, fy + 1, col); fb.set(x + (Math.floor(age * 30) % 2 ? 1 : -1), fy + 3, col);
    fb.blend(x, fy + 5, col, 0.5);
    return 0;
  }
  const a = age - fuse;
  const life = o.life || 1.5;
  if (a > life) return 0;
  const r = size * (1 - Math.exp(-3.6 * a));
  const drop = 7 * a * a;
  const fade = clamp((a - life * 0.45) / (life * 0.55));
  const n = o.heart ? 34 : 30;
  const seed = o.seed || 1;
  for (let ring = 0; ring < (o.heart ? 1 : 2); ring++) {
    const rr = ring ? r * 0.55 : r;
    for (let i = 0; i < n; i++) {
      if (ring && i % 2) continue;
      let px, py;
      if (o.heart) {
        const th = (i / n) * Math.PI * 2;
        px = 16 * Math.pow(Math.sin(th), 3) / 16;
        py = -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) / 16;
      } else {
        const th = (i / n) * Math.PI * 2 + ring * 0.3 + seed;
        const jit = 0.82 + world.hash(i, seed * 7, ring) * 0.3;
        px = Math.cos(th) * jit; py = Math.sin(th) * jit * 0.92;
      }
      const sx = Math.round(x + px * rr), sy = Math.round(y + py * rr + drop);
      if (world.hash(i, Math.floor(a * 14), seed) < fade) continue;
      const c = a < 0.12 ? 0xffffff : (i + ring) % 3 === 0 ? col2 : col;
      fb.set(sx, sy, c);
      if (a < 0.7) fb.set(sx + (px > 0 ? -1 : 1), sy, c);
      // trail
      const tx = Math.round(x + px * rr * 0.86), ty = Math.round(y + py * rr * 0.86 + drop * 0.8);
      if (a > 0.1 && a < 1.0) fb.blend(tx, ty, col, 0.55 * (1 - fade));
    }
  }
  if (a < 0.1) { fb.disc(x, y, 3, 0xffffff); }
  // how brightly the burst lights the scene, 0..1
  return Math.max(0, 1 - a / 0.5);
}

// ---- small effects ------------------------------------------------------------------

function note(fb, x, y, kind, c = 0xfff6e0, outline = INK) {
  U.stampOutlined(fb, Math.round(x), Math.round(y), kind ? U.NOTE_B : U.NOTE_A, { X: c }, outline);
}

// Music notes drifting up and to one side from (x, y).
function notes(fb, x, y, u, n = 4, dir = 1) {
  for (let i = 0; i < n; i++) {
    const ph = (u * 0.42 + i / n) % 1;
    if (u * 0.42 + i / n < 1 && i / n > u * 0.42) continue;
    const nx = x + dir * ph * 34 + Math.sin(ph * 7 + i * 1.7) * 4;
    const ny = y - ph * 40;
    if (ph < 0.9) note(fb, nx, ny, i % 2, [0xfff6e0, 0xffd98f, 0xff9ab0, 0x9fe0ff][i % 4]);
  }
}

function rain(fb, t, c = 0xbfd4f0, n = 90, a = 0.7) {
  for (let i = 0; i < n; i++) {
    const sp = 150 + world.hash(i, 127) * 80;
    const x = ((world.hash(i, 131) * 360 - t * 26) % 360 + 360) % 360 - 20;
    const y = (world.hash(i, 137) * 200 + t * sp) % 200 - 10;
    fb.blend(x, y, c, a); fb.blend(x - 1, y + 1, c, a); fb.blend(x - 1, y + 2, c, a * 0.7); fb.blend(x - 2, y + 3, c, a * 0.5);
  }
}

// VHS-style rewind: jittering bands, noise, and the transport icon.
function rewindFx(fb, t, tmp) {
  tmp.copyFrom(fb);
  for (let y = 0; y < H; y++) {
    const band = Math.floor(y / 6);
    const n = world.hash(band, Math.floor(t * 24));
    const shift = n > 0.78 ? Math.round((n - 0.78) * 90) : n < 0.1 ? -3 : 0;
    if (shift) for (let x = 0; x < W; x++) fb.set(x, y, tmp.get(Math.min(W - 1, Math.max(0, x + shift)), y));
    if (y % 2 === 0) fb.rectA(0, y, W, 1, 0x000000, 0.12);
  }
  const by = Math.floor((t * 140) % (H + 30)) - 15;
  fb.rectA(0, by, W, 7, 0xffffff, 0.22);
  for (let i = 0; i < 70; i++) fb.set(Math.floor(world.hash(i, Math.floor(t * 30)) * W), by + Math.floor(world.hash(i, 3, Math.floor(t * 30)) * 7), 0xffffff);
  const on = Math.floor(t * 4) % 2 === 0;
  if (on) {
    for (const ox of [0, 9]) for (let i = 0; i < 6; i++) { fb.rect(20 + ox + 5 - i, 14 + 5 - i, 1, i * 2 + 1, INK); }
    for (const ox of [0, 9]) for (let i = 0; i < 5; i++) { fb.rect(21 + ox + 4 - i, 15 + 4 - i, 1, i * 2 + 1, 0xffffff); }
    text(fb, 'REW', 42, 12, 0xffffff, { outline: INK });
  }
}

// A flat-shaded hand reaching up from the bottom edge, index finger out. (fx, fy) is the fingertip.
function pointingHand(fb, fx, fy, o = {}) {
  const sleeve = o.sleeve || 0x34416a, sleeveSh = o.sleeveSh || 0x242e50, cuff = o.cuff || 0xe2ded6;
  const x = fx - 3, y = fy;
  const O = 0xb9806e;
  // index finger
  fb.rect(x - 1, y + 1, 9, 22, O); fb.rect(x, y - 1, 7, 2, O);
  fb.rect(x, y + 1, 7, 22, SKIN); fb.rect(x + 1, y, 5, 1, SKIN);
  fb.rect(x + 1, y + 1, 4, 3, 0xfff0e6); fb.rect(x + 5, y + 2, 2, 20, SKIN_SH);
  fb.rect(x + 1, y + 11, 5, 1, SKIN_SH);
  // curled fingers and palm
  fb.rect(x - 2, y + 20, 34, 30, O);
  fb.rect(x - 1, y + 21, 32, 30, SKIN);
  for (let i = 0; i < 3; i++) {
    const kx = x + 8 + i * 8;
    fb.rect(kx - 1, y + 13 + i * 2, 9, 10, O); fb.rect(kx, y + 14 + i * 2, 7, 10, SKIN);
    fb.rect(kx + 5, y + 15 + i * 2, 2, 8, SKIN_SH); fb.rect(kx + 1, y + 20 + i * 2, 5, 1, SKIN_SH);
  }
  // thumb
  fb.rect(x - 10, y + 24, 12, 9, O); fb.rect(x - 9, y + 25, 12, 7, SKIN); fb.rect(x - 9, y + 30, 10, 2, SKIN_SH);
  fb.rect(x + 26, y + 24, 5, 26, SKIN_SH);
  // sleeve
  fb.rect(x - 4, y + 46, 38, 6, cuff); fb.rect(x - 4, y + 51, 38, 1, 0xbdb8b0);
  fb.rect(x - 6, y + 52, 42, 90, sleeve); fb.rect(x + 28, y + 52, 8, 90, sleeveSh); fb.rect(x - 6, y + 52, 2, 90, mix(sleeve, 0xffffff, 0.2));
}

module.exports = {
  W, H, PH, MID, ALBUM,
  desk, deskWood, deskBook, deskTea, deskPencil,
  polaroid, photoCaption, dateStamp, panel, backdrop, viewfinder,
  albumBase, pageRect, pagePaper, photoCorners,
  room, firework, note, notes, rain, rewindFx, pointingHand,
};
