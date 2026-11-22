'use strict';
// The riverside at sunset: one wide stage drawn in parallax layers. `cam` is the camera's
// x position in world pixels; far layers move by a fraction of it.

const { mix } = require('./fb');

const W = 320;
const H = 180;
const HORIZON = 98;
const RIVER_END = 122;
const PATH_TOP = 136;
const PATH_END = 156;
const GROUND = 150;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const hash = (a, b, c = 0) => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const SKY = [[0, 0x2a3167], [0.26, 0x55508f], [0.5, 0x9c5f8e], [0.68, 0xe27e70], [0.84, 0xf7b06e], [1, 0xffdc9a]];
const WATER = [[0, 0xf3a56e], [0.35, 0xcf7584], [0.7, 0x8a5f8f], [1, 0x574c84]];

const r0 = rng(20090818);
const STARS = Array.from({ length: 26 }, () => ({ x: Math.floor(r0() * W), y: Math.floor(r0() * 44), p: r0() * 6.28, b: r0() }));
const CLOUDS = [
  { x: 20, y: 30, rows: [10, 22, 34, 46, 40, 26], f: 0.06, v: 1.6 },
  { x: 150, y: 18, rows: [8, 18, 30, 24, 12], f: 0.06, v: 1.6 },
  { x: 250, y: 44, rows: [12, 26, 44, 60, 52, 30], f: 0.1, v: 2.6 },
  { x: 380, y: 26, rows: [8, 20, 34, 28, 14], f: 0.1, v: 2.6 },
  { x: 90, y: 58, rows: [14, 34, 50, 38], f: 0.14, v: 3.4 },
  { x: 330, y: 64, rows: [10, 26, 40, 30], f: 0.14, v: 3.4 },
];
function skyline(seed, from, to, minH, maxH) {
  const r = rng(seed);
  const out = [];
  let x = from;
  while (x < to) {
    const w = 5 + Math.floor(r() * 11);
    const h = minH + Math.floor(r() * (maxH - minH));
    const windows = [];
    for (let wy = 2; wy < h - 1; wy += 3) for (let wx = 1; wx < w - 1; wx += 2) if (r() < 0.2) windows.push([wx, wy, r()]);
    out.push({ x, w, h, roof: r() < 0.25, windows });
    x += w + (r() < 0.3 ? 1 + Math.floor(r() * 3) : 0);
  }
  return out;
}
const FAR1 = skyline(11, -20, 420, 5, 17);
const FAR2 = skyline(29, -20, 460, 4, 21);
const r1 = rng(77);
const BANK_TREES = Array.from({ length: 70 }, (_, i) => ({ x: -20 + i * 7 + Math.floor(r1() * 4), r: 2 + Math.floor(r1() * 3) }));
const TUFTS = Array.from({ length: 150 }, () => ({ x: Math.floor(r1() * 480) - 30, y: Math.floor(r1() * 9), c: r1() }));
const FG_TUFTS = Array.from({ length: 170 }, () => ({ x: Math.floor(r1() * 520) - 40, y: Math.floor(r1() * 22), c: r1() }));
const FLOWERS = Array.from({ length: 34 }, () => ({ x: Math.floor(r1() * 520) - 40, y: 3 + Math.floor(r1() * 18), c: r1() }));
const SPECKS = Array.from({ length: 90 }, () => ({ x: Math.floor(r1() * 480) - 30, y: 1 + Math.floor(r1() * 18), c: r1() }));
const r2 = rng(4242);
const LEAVES = Array.from({ length: 46 }, () => {
  const a = r2() * 6.283, d = Math.sqrt(r2());
  return { x: 50 + Math.cos(a) * d * 82, y: 34 + Math.sin(a) * d * 40, r: 7 + r2() * 7, p: r2() * 6.28 };
}).sort((a, b) => a.y - b.y);
const PETALS = Array.from({ length: 18 }, () => ({ x: r2() * 360, y: r2() * 200, vx: 9 + r2() * 9, vy: 7 + r2() * 8, p: r2() * 6.28, c: r2() }));

function drawSky(fb, t, cam) {
  fb.vgrad(0, 0, W, HORIZON + 2, SKY, 6);
  for (const s of STARS) {
    const tw = Math.sin(t * 2.2 + s.p);
    if (tw > -0.2) fb.set(s.x, s.y, s.b > 0.7 && tw > 0.6 ? 0xfff6d8 : 0xb9a9d6);
  }
  const sx = Math.round(161.6 - cam * 0.04);
  const sy = 79;
  fb.ellipseD(sx, sy, 40, 34, 0xffc98a, 0.19);
  fb.ellipseD(sx, sy, 30, 27, 0xffd698, 0.38);
  fb.ellipseD(sx, sy, 22, 21, 0xffe3ad, 0.62);
  fb.disc(sx, sy, 16, 0xfff0c4);
  fb.disc(sx, sy, 12, 0xfffae6);

  for (const c of CLOUDS) {
    const span = W + 140;
    let x = c.x - cam * c.f - t * c.v;
    x = ((x + 70) % span + span) % span - 70;
    const n = c.rows.length;
    const max = Math.max(...c.rows);
    c.rows.forEach((w, i) => {
      const col = i >= n - 1 ? 0xffc79a : i >= n - 2 ? 0xf29a7c : i === 0 ? 0x8f6aa2 : 0xb8708f;
      fb.rect(Math.round(x + (max - w) / 2 + (i % 2) * 2), c.y + i * 2, w, 2, col);
    });
  }

  for (let k = 0; k < 2; k++) {
    const bx = ((60 + k * 46 + t * (9 + k * 2)) % (W + 40)) - 20;
    const by = 34 + k * 9 + Math.round(Math.sin(t * 0.9 + k) * 2);
    const up = Math.floor(t * 3.3 + k) % 2 === 0;
    fb.set(bx, by, 0x3a2f5a);
    fb.set(bx - 1, by + (up ? -1 : 1), 0x3a2f5a);
    fb.set(bx + 1, by + (up ? -1 : 1), 0x3a2f5a);
  }
  return sx;
}

function drawCity(fb, t, cam) {
  for (const b of FAR1) {
    const x = Math.round(b.x - cam * 0.12);
    if (x > W || x + b.w < 0) continue;
    fb.rect(x, HORIZON - b.h, b.w, b.h + 2, 0xb96f86);
    if (b.roof) fb.rect(x + 1, HORIZON - b.h - 2, 2, 2, 0xb96f86);
  }
  for (const b of FAR2) {
    const x = Math.round(b.x - cam * 0.22);
    if (x > W || x + b.w < 0) continue;
    fb.rect(x, HORIZON - b.h, b.w, b.h + 2, 0x7b5387);
    fb.rect(x + b.w - 1, HORIZON - b.h, 1, b.h, 0x9a6a92);
    if (b.roof) fb.rect(x + (b.w >> 1), HORIZON - b.h - 4, 1, 4, 0x7b5387);
    for (const [wx, wy, ph] of b.windows) {
      if (Math.sin(t * 0.7 + ph * 40) > -0.85) fb.set(x + wx, HORIZON - b.h + wy, ph > 0.5 ? 0xffd98f : 0xf7a86e);
    }
  }
  for (const tr of BANK_TREES) {
    const x = Math.round(tr.x * 1.2 - cam * 0.3);
    fb.disc(x, HORIZON + 1, tr.r, 0x4b3a69);
  }
  fb.rect(0, HORIZON, W, 3, 0x4b3a69);
}

function drawRiver(fb, t, cam, sunX) {
  const top = HORIZON + 2;
  const h = RIVER_END - top;
  fb.vgrad(0, top, W, h, WATER, 5);
  for (let y = 0; y < h; y++) {
    const yy = top + y;
    const half = 3 + y * 0.75 + Math.sin(t * 1.7 + y * 0.8) * 1.6;
    const step = Math.floor(t * 5);
    for (let x = Math.floor(sunX - half); x <= sunX + half; x++) {
      const n = hash(x >> 1, y, step + ((x >> 1) & 3));
      if (n > 0.42) fb.set(x, yy, n > 0.8 ? 0xfffae6 : 0xffe2a6);
    }
    const drift = Math.floor(t * (3 + y * 0.35) + cam * 0.3);
    for (let x = 0; x < W; x++) {
      const n = hash((x + drift) >> 2, y, 7);
      if (n > 0.93) fb.set(x, yy, y < h * 0.4 ? 0xffc890 : y < h * 0.75 ? 0xe59a92 : 0x8f76a6);
      else if (n < 0.035) fb.set(x, yy, y < h * 0.5 ? 0xc96a80 : 0x4a4078);
    }
  }
}

function drawBank(fb, t, cam) {
  const o = -Math.round(cam);
  fb.rect(0, RIVER_END, W, 2, 0x8c7592);
  fb.rect(0, RIVER_END + 2, W, 2, 0x55466b);
  fb.rect(0, RIVER_END + 4, W, PATH_TOP - RIVER_END - 4, 0x4a6950);
  for (const g of TUFTS) {
    const x = g.x + o;
    const y = RIVER_END + 4 + g.y;
    fb.rect(x, y, g.c > 0.6 ? 3 : 2, 1, g.c > 0.72 ? 0x8fa05c : g.c > 0.35 ? 0x648a56 : 0x385643);
    if (g.c > 0.85) fb.set(x + 1, y - 1, 0xb6b866);
  }
  // railing along the embankment
  for (let wx = -40; wx < 480; wx += 22) {
    const x = wx + o;
    fb.rect(x, 109, 2, 17, 0x2b2745);
    fb.rect(x + 2, 109, 1, 15, 0x8d6a86);
    fb.rect(x - 1, 108, 4, 1, 0x2b2745);
  }
  fb.rect(0, 111, W, 2, 0x2b2745);
  fb.rect(0, 110, W, 1, 0xc98f7e);
  fb.rect(0, 118, W, 1, 0x2b2745);

  // paved path
  fb.rect(0, PATH_TOP, W, PATH_END - PATH_TOP, 0xa48d97);
  fb.rect(0, PATH_TOP, W, 1, 0xd9b9a6);
  fb.rect(0, PATH_TOP + 1, W, 1, 0xbfa3a0);
  fb.rect(0, PATH_END - 1, W, 1, 0x6c5c73);
  for (let row = 0; row < 3; row++) {
    const y = PATH_TOP + 2 + row * 6;
    if (row) fb.rect(0, y, W, 1, 0x93808e);
    for (let wx = -48 + (row % 2) * 12; wx < 480; wx += 24) fb.rect(wx + o, y + 1, 1, 5, 0x93808e);
  }
  for (const s of SPECKS) fb.set(s.x + o, PATH_TOP + s.y, s.c > 0.5 ? 0xb9a2a6 : 0x8d7a8a);
}

function drawBench(fb, cam) {
  const x = 256 - Math.round(cam);
  const y = 130;
  fb.ellipseA(x + 17, 146, 19, 2, 0x1b1530, 0.3);
  for (const px of [3, 30]) { fb.rect(x + px, y + 2, 2, 15, 0x2f2540); fb.rect(x + px + 2, y + 10, 1, 7, 0x2f2540); }
  fb.rect(x, y, 35, 3, 0x8a5942); fb.rect(x, y, 35, 1, 0xd29a66);
  fb.rect(x, y + 5, 35, 3, 0x8a5942); fb.rect(x, y + 5, 35, 1, 0xc08658);
  fb.rect(x - 1, y + 10, 37, 3, 0x9a6648); fb.rect(x - 1, y + 10, 37, 1, 0xe0aa72);
  fb.rect(x - 1, y + 13, 37, 1, 0x5d3b33);
}

function drawLamp(fb, t, cam) {
  const x = 336 - Math.round(cam);
  fb.ellipseA(x + 1, 147, 6, 2, 0x1b1530, 0.3);
  fb.rect(x, 70, 2, 77, 0x2b2745);
  fb.rect(x + 2, 72, 1, 74, 0x8d6a86);
  fb.rect(x - 1, 143, 4, 4, 0x2b2745);
  fb.rect(x - 9, 68, 11, 2, 0x2b2745);
  fb.rect(x - 11, 70, 6, 3, 0x2b2745);
  const flick = 0.5 + 0.06 * Math.sin(t * 9);
  fb.ellipseD(x - 8, 77, 13, 10, 0xffe1a0, 0.22 + flick * 0.12);
  fb.ellipseD(x - 8, 75, 7, 5, 0xffedc0, 0.55);
  fb.rect(x - 10, 73, 4, 2, 0xfffbe6);
}

function drawCamera(fb, t, cam, led) {
  const x = 300 - Math.round(cam * 1.05);
  const y = 139;
  const D = 0x1c1a30, M = 0x35304f, L = 0x6b5a7c;
  fb.ellipseA(x, 177, 13, 2, 0x10101f, 0.35);
  fb.line(x, y + 9, x - 9, 177, D); fb.line(x + 1, y + 9, x - 8, 177, D);
  fb.line(x, y + 9, x + 9, 177, D); fb.line(x + 1, y + 9, x + 10, 177, L);
  fb.rect(x, y + 9, 2, 30, D);
  fb.rect(x - 2, y + 7, 6, 3, M);
  fb.rect(x - 7, y - 2, 15, 9, D);
  fb.rect(x - 7, y - 2, 15, 1, L);
  fb.rect(x + 7, y - 1, 1, 8, L);
  fb.rect(x - 3, y - 4, 6, 2, D);
  fb.rect(x - 11, y, 4, 5, M); fb.rect(x - 12, y + 1, 1, 3, 0x8fb0d8);
  fb.rect(x + 3, y, 3, 2, M);
  if (led) fb.rect(x - 5, y, 2, 2, 0xff4d4d);
}

function drawFrontGrass(fb, t, cam) {
  const o = -Math.round(cam * 1.05);
  fb.rect(0, PATH_END, W, H - PATH_END, 0x2f4b40);
  fb.rect(0, PATH_END, W, 1, 0x4d6f4e);
  for (const g of FG_TUFTS) {
    const x = g.x + o;
    const y = PATH_END + 1 + g.y;
    const col = g.c > 0.7 ? 0x5f8a55 : g.c > 0.3 ? 0x416349 : 0x223a35;
    fb.rect(x, y, 1, 2, col);
    fb.set(x + 1, y + 1, col);
    if (g.c > 0.9) fb.set(x, y - 1, 0x9aae5e);
  }
  for (const f of FLOWERS) {
    const x = f.x + o;
    const y = PATH_END + f.y + (Math.sin(t * 1.4 + f.x) > 0.6 ? -1 : 0);
    const col = f.c > 0.66 ? 0xfff2d6 : f.c > 0.33 ? 0xf7a9b8 : 0xf6d06a;
    fb.set(x, y, col);
    if (f.c > 0.5) { fb.set(x - 1, y + 1, col); fb.set(x + 1, y + 1, col); fb.set(x, y + 1, 0xf2b84a); }
    fb.set(x, y + 2, 0x416349);
  }
}

function drawTree(fb, t, cam) {
  const o = -Math.round(cam * 1.12);
  const tx = 52 + o;
  // trunk
  for (let y = 44; y < 172; y++) {
    const w = 9 + Math.max(0, (y - 150) * 0.45) + (y < 70 ? (70 - y) * 0.12 : 0);
    const x = tx - Math.round(w / 2) + Math.round(Math.sin(y * 0.07) * 1.5);
    fb.rect(x, y, Math.round(w), 1, 0x3a2a40);
    fb.rect(x + Math.round(w) - 2, y, 2, 1, 0x7a5560);
    if ((y * 7) % 11 < 2) fb.rect(x + 2, y, 2, 1, 0x2a1e33);
  }
  fb.line(tx + 3, 66, tx + 26, 50, 0x3a2a40); fb.line(tx + 3, 67, tx + 26, 51, 0x3a2a40);
  fb.line(tx - 3, 72, tx - 24, 58, 0x3a2a40); fb.line(tx - 3, 73, tx - 24, 59, 0x3a2a40);
  // canopy: dark mass, mid tone, sun-side highlights
  for (const l of LEAVES) fb.ellipse(l.x + o, l.y + 2, l.r + 1, l.r * 0.8 + 1, 0x223a3d);
  for (const l of LEAVES) {
    const s = Math.round(Math.sin(t * 1.1 + l.p) * 0.9);
    fb.ellipse(l.x + o + s, l.y, l.r, l.r * 0.78, 0x33584d);
  }
  for (const l of LEAVES) {
    const s = Math.round(Math.sin(t * 1.1 + l.p) * 1.2);
    fb.ellipse(l.x + o + 3 + s, l.y - 1 + l.r * 0.15, l.r * 0.55, l.r * 0.4, 0x4f7f58);
    if (l.p > 2.2) fb.ellipse(l.x + o + 5 + s, l.y + l.r * 0.3, l.r * 0.28, l.r * 0.18, 0x8fae62);
    if (l.p > 4.4) { fb.set(l.x + o + 7 + s, l.y + 2, 0xd9c873); fb.set(l.x + o + 2 + s, l.y + 4, 0xb6c06a); }
  }
}

function drawPetals(fb, t, cam) {
  for (const p of PETALS) {
    const x = ((p.x + t * p.vx + Math.sin(t * 1.3 + p.p) * 6 - cam * 1.1) % 360 + 360) % 360 - 20;
    const y = (p.y + t * p.vy) % 200 - 10;
    const col = p.c > 0.6 ? 0xffd9e0 : p.c > 0.25 ? 0xf9aebf : 0xffe9a8;
    fb.set(x, y, col);
    if (Math.sin(t * 5 + p.p) > 0) fb.set(x + 1, y, col); else fb.set(x, y + 1, col);
  }
}

// Everything behind the characters.
function drawBack(fb, t, cam, opts = {}) {
  const sunX = drawSky(fb, t, cam);
  drawCity(fb, t, cam);
  drawRiver(fb, t, cam, sunX);
  drawBank(fb, t, cam);
  drawBench(fb, cam);
  drawLamp(fb, t, cam);
  void opts;
}

// Everything in front of the characters.
function drawFront(fb, t, cam, opts = {}) {
  drawFrontGrass(fb, t, cam);
  if (opts.camera !== false) drawCamera(fb, t, cam, opts.led);
  if (opts.tree !== false) drawTree(fb, t, cam);
  if (opts.petals !== false) drawPetals(fb, t, cam);
}

module.exports = { W, H, GROUND, drawBack, drawFront, drawPetals, hash, rng, mix };
