'use strict';
// The riverside: one wide stage drawn in parallax layers. `cam` is the camera's x position
// in world pixels; far layers move by a fraction of it. A "look" picks the season, the time
// of day and how far the city has grown; the default look is a spring sunset, years ago.

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

// ---- looks ---------------------------------------------------------------------------

function grader(mul, tint, amount) {
  const cache = new Map();
  const ch = (v, m, t) => Math.max(0, Math.min(255, Math.round(v * m + (t - v * m) * amount)));
  return (c) => {
    let v = cache.get(c);
    if (v === undefined) {
      v = (ch((c >> 16) & 255, mul[0], (tint >> 16) & 255) << 16) | (ch((c >> 8) & 255, mul[1], (tint >> 8) & 255) << 8) | ch(c & 255, mul[2], tint & 255);
      cache.set(c, v);
    }
    return v;
  };
}
const same = (c) => c;

const TIMES = {
  sunset: {
    sky: [[0, 0x2a3167], [0.26, 0x55508f], [0.5, 0x9c5f8e], [0.68, 0xe27e70], [0.84, 0xf7b06e], [1, 0xffdc9a]],
    stars: 1, starDim: 0xb9a9d6, starBright: 0xfff6d8,
    sun: { x: 161.6, y: 79, halo: [[40, 34, 0xffc98a, 0.19], [30, 27, 0xffd698, 0.38], [22, 21, 0xffe3ad, 0.62]], disc: [[16, 0xfff0c4], [12, 0xfffae6]] },
    cloud: [0x8f6aa2, 0xb8708f, 0xf29a7c, 0xffc79a],
    bird: 0x3a2f5a,
    far1: 0xb96f86, far2: 0x7b5387, far2Edge: 0x9a6a92, win: [0xffd98f, 0xf7a86e], shore: 0x4b3a69,
    water: [[0, 0xf3a56e], [0.35, 0xcf7584], [0.7, 0x8a5f8f], [1, 0x574c84]],
    glint: [0xfffae6, 0xffe2a6], ripple: [0xffc890, 0xe59a92, 0x8f76a6], rippleDark: [0xc96a80, 0x4a4078],
    lamp: 1, g: same, cg: null,
  },
  night: {
    sky: [[0, 0x0a0f2c], [0.35, 0x121a46], [0.7, 0x1f2a64], [1, 0x34428a]],
    stars: 2, starDim: 0x8f9ad0, starBright: 0xffffff,
    moon: { x: 236, y: 30 },
    cloud: [0x1a2250, 0x222c60, 0x2c3870, 0x384684],
    bird: null,
    far1: 0x232a5c, far2: 0x141a3e, far2Edge: 0x2a3268, win: [0xffe09a, 0xffb86a], nightWin: true, shore: 0x0e1430,
    water: [[0, 0x2a3878], [0.4, 0x1c2658], [1, 0x10173c]],
    glint: [0xeef2ff, 0x8f9fe0], glintMin: 0.6, ripple: [0x5a6cb4, 0x44529a, 0x2e3a7a], rippleDark: [0x16204e, 0x0a1030],
    lamp: 2, g: grader([0.5, 0.56, 0.8], 0x141a40, 0.22), cg: grader([0.8, 0.8, 0.96], 0x2a3066, 0.14),
  },
  day: {
    sky: [[0, 0x3d8be0], [0.5, 0x6fb6f0], [0.85, 0xaedcf8], [1, 0xd8f0fa]],
    stars: 0,
    sun: { x: 204, y: 18, halo: [[20, 20, 0xfff6c0, 0.22], [13, 13, 0xfffbe0, 0.5]], disc: [[8, 0xfffbe6]], noColumn: true },
    cloud: [0xffffff, 0xffffff, 0xeaf3fc, 0xcfe2f6],
    bird: 0x4a5a80,
    far1: 0xa8c4e4, far2: 0x86a4cc, far2Edge: 0xa6c0e0, win: [0xe4f4ff, 0xcfe6fa], shore: 0x3f7a52,
    water: [[0, 0xa6dcf4], [0.4, 0x6cb4e6], [1, 0x3d7ec8]],
    glint: [0xffffff, 0xe4f6ff], ripple: [0xffffff, 0xd8f0ff, 0x9cd0f4], rippleDark: [0x5a9cd8, 0x2f68b0],
    lamp: 0, g: grader([1.0, 1.06, 1.06], 0xffffff, 0.1),
  },
  dusk: {
    sky: [[0, 0x5a6aa8], [0.4, 0x8f90c4], [0.7, 0xd0a8c8], [0.88, 0xf2c4c0], [1, 0xfbe2cc]],
    stars: 0,
    sun: { x: 161.6, y: 84, halo: [[30, 24, 0xffe6d0, 0.2], [20, 17, 0xfff0e0, 0.45]], disc: [[11, 0xfff6ec]] },
    cloud: [0xb4b0d4, 0xd4c0d8, 0xf0d0d0, 0xfde8dc],
    bird: 0x4a4470,
    far1: 0xb0a4c8, far2: 0x7c76a6, far2Edge: 0x9a94bc, win: [0xffe09a, 0xffc078], shore: 0x6a6a94,
    water: [[0, 0xf0c8c4], [0.4, 0xb4a8cc], [1, 0x6a74b0]],
    glint: [0xfffaf4, 0xffe8dc], ripple: [0xfff0e8, 0xd8c4dc, 0x9aa0cc], rippleDark: [0xa890b8, 0x565e9c],
    lamp: 1, g: grader([0.92, 0.94, 1.04], 0xc8cce8, 0.12),
  },
};

const SEASONS = {
  spring: {
    grass: 0x4a6950, tuft: [0x8fa05c, 0x648a56, 0x385643], tuftTip: 0xb6b866,
    front: 0x2f4b40, frontEdge: 0x4d6f4e, frontTuft: [0x5f8a55, 0x416349, 0x223a35], frontTip: 0x9aae5e,
    flowers: [0xfff2d6, 0xf7a9b8, 0xf6d06a], flowerCore: 0xf2b84a, stem: 0x416349,
    leaf: [0x223a3d, 0x33584d, 0x4f7f58, 0x8fae62, 0xd9c873, 0xb6c06a],
    particle: 'petal', particleCol: [0xffd9e0, 0xf9aebf, 0xffe9a8],
  },
  summer: {
    grass: 0x3f7550, tuft: [0x9cc462, 0x5c9a56, 0x2e5a42], tuftTip: 0xcfe07a,
    front: 0x234a3a, frontEdge: 0x4a7f52, frontTuft: [0x5c9a56, 0x38704a, 0x1a3a30], frontTip: 0xb4d468,
    flowers: [0xffffff, 0xfff3a6, 0xffffff], flowerCore: 0xf6d06a, stem: 0x38704a,
    leaf: [0x1a3836, 0x2a5e48, 0x4a8a54, 0x86b85e, 0xd4e07a, 0xb0d068],
    particle: null,
  },
  autumn: {
    grass: 0x7a6a48, tuft: [0xd8a84e, 0xa8884a, 0x5e5238], tuftTip: 0xf0c860,
    front: 0x4a3c34, frontEdge: 0x8a6a48, frontTuft: [0xb8884a, 0x7a5c3e, 0x3a2c2c], frontTip: 0xe8b050,
    flowers: null, stem: 0x7a5c3e,
    leaf: [0x5a2630, 0x9a4630, 0xd8762e, 0xf2ac3e, 0xffd870, 0xf6c050],
    particle: 'leaf', particleCol: [0xf2ac3e, 0xd8762e, 0xc04a34],
  },
  winter: {
    grass: 0xdfe6f4, tuft: [0xffffff, 0xc8d2e8, 0xaab6d6], tuftTip: 0xffffff,
    front: 0xd4dcee, frontEdge: 0xffffff, frontTuft: [0xffffff, 0xbcc8e2, 0x9aa8cc], frontTip: 0xffffff,
    flowers: null, stem: 0x9aa8cc,
    leaf: null,
    particle: 'snow', particleCol: [0xffffff, 0xeef2ff, 0xdfe6f8],
    snow: true,
  },
};

const looks = new Map();
// opts: { season, time, era } with era 0 (years ago) .. 1 (today, taller city).
function look(opts = {}) {
  const season = opts.season || 'spring', time = opts.time || 'sunset';
  const era = Math.round((opts.era || 0) * 20) / 20;
  const key = season + '/' + time + '/' + era;
  let L = looks.get(key);
  if (!L) {
    const T = TIMES[time], V = SEASONS[season];
    L = { ...T, veg: V, snow: !!V.snow, era, season, time, key, fireflies: time === 'night' && (season === 'summer' || season === 'spring') };
    looks.set(key, L);
  }
  return L;
}
const DEFAULT = look();

// ---- static scenery ------------------------------------------------------------------

const r0 = rng(20090818);
const STARS = Array.from({ length: 26 }, () => ({ x: Math.floor(r0() * W), y: Math.floor(r0() * 44), p: r0() * 6.28, b: r0() }));
const r3 = rng(8181);
const STARS2 = Array.from({ length: 80 }, () => ({ x: Math.floor(r3() * W), y: Math.floor(r3() * 86), p: r3() * 6.28, b: r3() }));
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
const r4 = rng(505);
for (const b of FAR2) {
  b.grow = r4();
  b.lit = [];
  for (let wy = 2; wy < 40; wy += 3) for (let wx = 1; wx < b.w - 1; wx += 2) if (r4() < 0.42) b.lit.push([wx, wy, r4()]);
}
const TOWERS = [];
{
  const r = rng(2019);
  let x = 6;
  while (x < 450) {
    const w = 8 + Math.floor(r() * 7);
    const h = 26 + Math.floor(r() * 22);
    const lit = [];
    for (let wy = 3; wy < h - 1; wy += 3) for (let wx = 1; wx < w - 1; wx += 2) if (r() < 0.36) lit.push([wx, wy, r()]);
    TOWERS.push({ x, w, h, top: Math.floor(r() * 3), lit });
    x += w + 22 + Math.floor(r() * 34);
  }
}
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
const r5 = rng(1212);
const FLAKES = Array.from({ length: 64 }, () => ({ x: r5() * 360, y: r5() * 200, vx: -4 + r5() * 10, vy: 12 + r5() * 16, p: r5() * 6.28, c: r5() }));
const FLIES = Array.from({ length: 16 }, () => ({ x: 20 + r5() * 280, y: 112 + r5() * 52, ax: 6 + r5() * 14, ay: 3 + r5() * 7, p: r5() * 6.28, s: 0.3 + r5() * 0.5 }));

// ---- layers --------------------------------------------------------------------------

function drawSky(fb, t, cam, L) {
  fb.vgrad(0, 0, W, HORIZON + 2, L.sky, 6);
  if (L.stars) {
    for (const s of STARS) {
      const tw = Math.sin(t * 2.2 + s.p);
      if (tw > -0.2) fb.set(s.x, s.y, s.b > 0.7 && tw > 0.6 ? L.starBright : L.starDim);
    }
  }
  if (L.stars > 1) {
    for (const s of STARS2) {
      const tw = Math.sin(t * 1.7 + s.p);
      if (tw > -0.6) fb.set(s.x, s.y, s.b > 0.55 && tw > 0.2 ? L.starBright : L.starDim);
      if (s.b > 0.93 && tw > 0.7) { fb.set(s.x - 1, s.y, L.starDim); fb.set(s.x + 1, s.y, L.starDim); fb.set(s.x, s.y - 1, L.starDim); fb.set(s.x, s.y + 1, L.starDim); }
    }
  }
  let lightX = null;
  if (L.sun) {
    const sx = Math.round(L.sun.x - cam * 0.04);
    const sy = L.sun.y + (L.sunDy || 0);
    for (const [rx, ry, c, lv] of L.sun.halo) fb.ellipseD(sx, sy, rx, ry, c, lv);
    for (const [r, c] of L.sun.disc) fb.disc(sx, sy, r, c);
    if (!L.sun.noColumn) lightX = sx;
  }
  if (L.moon) {
    const mx = Math.round(L.moon.x - cam * 0.04), my = L.moon.y;
    fb.ellipseD(mx, my, 22, 22, 0x4a5aa8, 0.16);
    fb.ellipseD(mx, my, 15, 15, 0x7f8fd8, 0.3);
    fb.disc(mx, my, 9, 0xf6f2dc);
    fb.disc(mx + 3, my - 2, 2, 0xe2dcc0); fb.rect(mx - 5, my + 2, 2, 2, 0xe2dcc0); fb.rect(mx - 1, my + 5, 2, 1, 0xe2dcc0);
    lightX = mx;
  }

  CLOUDS.forEach((c, ci) => {
    if (L.time === 'night' && ci % 2) return;
    const span = W + 140;
    let x = c.x - cam * c.f - t * c.v;
    x = ((x + 70) % span + span) % span - 70;
    const n = c.rows.length;
    const max = Math.max(...c.rows);
    c.rows.forEach((w, i) => {
      const col = i >= n - 1 ? L.cloud[3] : i >= n - 2 ? L.cloud[2] : i === 0 ? L.cloud[0] : L.cloud[1];
      fb.rect(Math.round(x + (max - w) / 2 + (i % 2) * 2), c.y + i * 2, w, 2, col);
    });
  });

  if (L.bird != null) {
    for (let k = 0; k < 2; k++) {
      const bx = ((60 + k * 46 + t * (9 + k * 2)) % (W + 40)) - 20;
      const by = 34 + k * 9 + Math.round(Math.sin(t * 0.9 + k) * 2);
      const up = Math.floor(t * 3.3 + k) % 2 === 0;
      fb.set(bx, by, L.bird);
      fb.set(bx - 1, by + (up ? -1 : 1), L.bird);
      fb.set(bx + 1, by + (up ? -1 : 1), L.bird);
    }
  }
  return lightX;
}

function drawCity(fb, t, cam, L) {
  for (const b of FAR1) {
    const x = Math.round(b.x - cam * 0.12);
    if (x > W || x + b.w < 0) continue;
    fb.rect(x, HORIZON - b.h, b.w, b.h + 2, L.far1);
    if (b.roof) fb.rect(x + 1, HORIZON - b.h - 2, 2, 2, L.far1);
    if (L.snow) fb.rect(x, HORIZON - b.h, b.w, 1, 0xeef0fa);
  }
  if (L.era > 0) {
    const col = mix(L.far1, L.far2, 0.55), edge = mix(L.far1, L.far2Edge, 0.5);
    for (const b of TOWERS) {
      const x = Math.round(b.x - cam * 0.17);
      if (x > W || x + b.w < 0) continue;
      const h = Math.round(b.h * L.era);
      if (h < 2) continue;
      const top = HORIZON - h;
      fb.rect(x, top, b.w, h + 2, col);
      fb.rect(x + b.w - 1, top, 1, h, edge);
      if (L.era >= 1) {
        if (b.top === 0) { fb.rect(x + (b.w >> 1), top - 7, 1, 7, col); if (L.time === 'night' && Math.floor(t * 1.2 + b.x) % 2) fb.set(x + (b.w >> 1), top - 7, 0xff5a5a); }
        else if (b.top === 1) { fb.rect(x + 2, top - 3, b.w - 4, 3, col); fb.rect(x + 4, top - 5, Math.max(1, b.w - 8), 2, col); }
        else fb.rect(x + 1, top - 2, 3, 2, col);
      } else {
        // still going up: a bare frame and a crane
        fb.rect(x, top - 2, 1, 2, col); fb.rect(x + b.w - 1, top - 2, 1, 2, col);
      }
      if (L.snow) fb.rect(x, top, b.w, 1, 0xeef0fa);
      const share = L.nightWin ? 1 : 0.45;
      for (const [wx, wy, ph] of b.lit) {
        if (wy >= h - 1 || ph > share) continue;
        if (Math.sin(t * 0.5 + ph * 50) > -0.9) fb.set(x + wx, top + wy, ph * 2.2 % 1 > 0.5 ? L.win[0] : L.win[1]);
      }
    }
  }
  for (const b of FAR2) {
    const x = Math.round(b.x - cam * 0.22);
    if (x > W || x + b.w < 0) continue;
    const h = b.h + Math.round(b.h * 0.55 * L.era * b.grow);
    fb.rect(x, HORIZON - h, b.w, h + 2, L.far2);
    fb.rect(x + b.w - 1, HORIZON - h, 1, h, L.far2Edge);
    if (b.roof) fb.rect(x + (b.w >> 1), HORIZON - h - 4, 1, 4, L.far2);
    if (L.snow) fb.rect(x, HORIZON - h, b.w, 1, 0xf6f8ff);
    for (const [wx, wy, ph] of b.windows) {
      if (Math.sin(t * 0.7 + ph * 40) > -0.85) fb.set(x + wx, HORIZON - b.h + wy, ph > 0.5 ? L.win[0] : L.win[1]);
    }
    if (L.nightWin) {
      for (const [wx, wy, ph] of b.lit) {
        if (wy >= h - 1) continue;
        if (Math.sin(t * 0.4 + ph * 60) > -0.8) fb.set(x + wx, HORIZON - h + wy, ph > 0.5 ? L.win[0] : L.win[1]);
      }
    }
  }
  for (const tr of BANK_TREES) {
    const x = Math.round(tr.x * 1.2 - cam * 0.3);
    fb.disc(x, HORIZON + 1, tr.r, L.shore);
    if (L.snow && tr.r > 2) fb.rect(x - 1, HORIZON + 1 - tr.r, 3, 1, 0xf6f8ff);
  }
  fb.rect(0, HORIZON, W, 3, L.shore);
}

function drawRiver(fb, t, cam, lightX, L) {
  const top = HORIZON + 2;
  const h = RIVER_END - top;
  fb.vgrad(0, top, W, h, L.water, 5);
  for (let y = 0; y < h; y++) {
    const yy = top + y;
    if (lightX != null) {
      const half = 3 + y * 0.75 + Math.sin(t * 1.7 + y * 0.8) * 1.6;
      const step = Math.floor(t * 5);
      for (let x = Math.floor(lightX - half); x <= lightX + half; x++) {
        const n = hash(x >> 1, y, step + ((x >> 1) & 3));
        if (n > (L.glintMin || 0.42)) fb.set(x, yy, n > 0.8 ? L.glint[0] : L.glint[1]);
      }
    }
    const drift = Math.floor(t * (3 + y * 0.35) + cam * 0.3);
    for (let x = 0; x < W; x++) {
      const n = hash((x + drift) >> 2, y, 7);
      if (n > 0.93) fb.set(x, yy, y < h * 0.4 ? L.ripple[0] : y < h * 0.75 ? L.ripple[1] : L.ripple[2]);
      else if (n < 0.035) fb.set(x, yy, y < h * 0.5 ? L.rippleDark[0] : L.rippleDark[1]);
    }
  }
}

function drawBank(fb, t, cam, L) {
  const g = L.g, V = L.veg;
  const o = -Math.round(cam);
  fb.rect(0, RIVER_END, W, 2, g(0x8c7592));
  fb.rect(0, RIVER_END + 2, W, 2, g(0x55466b));
  fb.rect(0, RIVER_END + 4, W, PATH_TOP - RIVER_END - 4, g(V.grass));
  for (const tu of TUFTS) {
    const x = tu.x + o;
    const y = RIVER_END + 4 + tu.y;
    fb.rect(x, y, tu.c > 0.6 ? 3 : 2, 1, g(tu.c > 0.72 ? V.tuft[0] : tu.c > 0.35 ? V.tuft[1] : V.tuft[2]));
    if (tu.c > 0.85) fb.set(x + 1, y - 1, g(V.tuftTip));
  }
  // railing along the embankment
  for (let wx = -40; wx < 480; wx += 22) {
    const x = wx + o;
    fb.rect(x, 109, 2, 17, g(0x2b2745));
    fb.rect(x + 2, 109, 1, 15, g(0x8d6a86));
    fb.rect(x - 1, 108, 4, 1, L.snow ? g(0xffffff) : g(0x2b2745));
  }
  fb.rect(0, 111, W, 2, g(0x2b2745));
  fb.rect(0, 110, W, 1, L.snow ? g(0xffffff) : g(0xc98f7e));
  fb.rect(0, 118, W, 1, g(0x2b2745));

  // paved path
  fb.rect(0, PATH_TOP, W, PATH_END - PATH_TOP, g(0xa48d97));
  fb.rect(0, PATH_TOP, W, 1, g(0xd9b9a6));
  fb.rect(0, PATH_TOP + 1, W, 1, g(0xbfa3a0));
  fb.rect(0, PATH_END - 1, W, 1, g(0x6c5c73));
  for (let row = 0; row < 3; row++) {
    const y = PATH_TOP + 2 + row * 6;
    if (row) fb.rect(0, y, W, 1, g(0x93808e));
    for (let wx = -48 + (row % 2) * 12; wx < 480; wx += 24) fb.rect(wx + o, y + 1, 1, 5, g(0x93808e));
  }
  for (const s of SPECKS) fb.set(s.x + o, PATH_TOP + s.y, g(s.c > 0.5 ? 0xb9a2a6 : 0x8d7a8a));
  if (L.snow) {
    fb.rect(0, PATH_TOP, W, 1, g(0xffffff));
    for (const s of SPECKS) {
      const edge = s.y < 4 || s.y > 15;
      if (edge) fb.rect(s.x + o, PATH_TOP + (s.y < 4 ? s.y >> 1 : 17 + (s.y & 1)), 3 + Math.floor(s.c * 5), 1, g(0xf4f6ff));
      else if (s.c > 0.8) fb.rect(s.x + o, PATH_TOP + s.y, 2, 1, g(0xe4e8f6));
    }
  }
}

function drawBench(fb, cam, L, wide) {
  const g = L.g;
  const w = wide ? 46 : 35;
  const x = 256 - Math.round(cam) - (wide ? 5 : 0);
  const y = 130;
  fb.ellipseA(x + (w >> 1), 146, (w >> 1) + 2, 2, 0x1b1530, 0.3);
  for (const px of [3, w - 5]) { fb.rect(x + px, y + 2, 2, 15, g(0x2f2540)); fb.rect(x + px + 2, y + 10, 1, 7, g(0x2f2540)); }
  fb.rect(x, y, w, 3, g(0x8a5942)); fb.rect(x, y, w, 1, g(0xd29a66));
  fb.rect(x, y + 5, w, 3, g(0x8a5942)); fb.rect(x, y + 5, w, 1, g(0xc08658));
  fb.rect(x - 1, y + 10, w + 2, 3, g(0x9a6648)); fb.rect(x - 1, y + 10, w + 2, 1, g(0xe0aa72));
  fb.rect(x - 1, y + 13, w + 2, 1, g(0x5d3b33));
  if (L.snow) { fb.rect(x, y - 1, w, 1, g(0xffffff)); fb.rect(x + 2, y - 2, w - 9, 1, g(0xffffff)); fb.rect(x - 1, y + 9, w + 2, 1, g(0xffffff)); }
}

function drawLamp(fb, t, cam, L, wx = 336) {
  const g = L.g;
  const x = wx - Math.round(cam);
  if (x < -40 || x > W + 40) return;
  fb.ellipseA(x + 1, 147, 6, 2, 0x1b1530, 0.3);
  if (L.lamp === 2) {
    // pool of light on the path
    fb.ellipseA(x - 8, 147, 34, 6, 0xffd98a, 0.16);
    fb.ellipseA(x - 8, 147, 22, 4, 0xffe2a6, 0.16);
  }
  fb.rect(x, 70, 2, 77, g(0x2b2745));
  fb.rect(x + 2, 72, 1, 74, g(0x8d6a86));
  fb.rect(x - 1, 143, 4, 4, g(0x2b2745));
  fb.rect(x - 9, 68, 11, 2, g(0x2b2745));
  fb.rect(x - 11, 70, 6, 3, g(0x2b2745));
  if (L.snow) fb.rect(x - 10, 67, 12, 1, g(0xffffff));
  if (L.lamp === 1) {
    const flick = 0.5 + 0.06 * Math.sin(t * 9);
    fb.ellipseD(x - 8, 77, 13, 10, 0xffe1a0, 0.22 + flick * 0.12);
    fb.ellipseD(x - 8, 75, 7, 5, 0xffedc0, 0.55);
    fb.rect(x - 10, 73, 4, 2, 0xfffbe6);
  } else if (L.lamp === 2) {
    const flick = 0.5 + 0.06 * Math.sin(t * 9);
    fb.ellipseD(x - 8, 80, 22, 17, 0xffd98a, 0.14);
    fb.ellipseD(x - 8, 78, 15, 12, 0xffe1a0, 0.28 + flick * 0.1);
    fb.ellipseD(x - 8, 75, 8, 6, 0xffedc0, 0.7);
    fb.rect(x - 10, 73, 4, 2, 0xffffff);
  } else {
    fb.rect(x - 10, 73, 4, 2, g(0xe8e4d8));
  }
}

function drawCamera(fb, t, cam, led, L) {
  const g = L.g;
  const x = 300 - Math.round(cam * 1.05);
  const y = 139;
  const D = g(0x1c1a30), M = g(0x35304f), Lc = g(0x6b5a7c);
  fb.ellipseA(x, 177, 13, 2, 0x10101f, 0.35);
  fb.line(x, y + 9, x - 9, 177, D); fb.line(x + 1, y + 9, x - 8, 177, D);
  fb.line(x, y + 9, x + 9, 177, D); fb.line(x + 1, y + 9, x + 10, 177, Lc);
  fb.rect(x, y + 9, 2, 30, D);
  fb.rect(x - 2, y + 7, 6, 3, M);
  fb.rect(x - 7, y - 2, 15, 9, D);
  fb.rect(x - 7, y - 2, 15, 1, Lc);
  fb.rect(x + 7, y - 1, 1, 8, Lc);
  fb.rect(x - 3, y - 4, 6, 2, D);
  fb.rect(x - 11, y, 4, 5, M); fb.rect(x - 12, y + 1, 1, 3, g(0x8fb0d8));
  fb.rect(x + 3, y, 3, 2, M);
  if (led) fb.rect(x - 5, y, 2, 2, 0xff4d4d);
}

function drawFrontGrass(fb, t, cam, L) {
  const g = L.g, V = L.veg;
  const o = -Math.round(cam * 1.05);
  fb.rect(0, PATH_END, W, H - PATH_END + 40, g(V.front));
  fb.rect(0, PATH_END, W, 1, g(V.frontEdge));
  for (const tu of FG_TUFTS) {
    const x = tu.x + o;
    const y = PATH_END + 1 + tu.y;
    const col = g(tu.c > 0.7 ? V.frontTuft[0] : tu.c > 0.3 ? V.frontTuft[1] : V.frontTuft[2]);
    fb.rect(x, y, 1, 2, col);
    fb.set(x + 1, y + 1, col);
    if (tu.c > 0.9) fb.set(x, y - 1, g(V.frontTip));
  }
  if (V.flowers) {
    for (const f of FLOWERS) {
      const x = f.x + o;
      const y = PATH_END + f.y + (Math.sin(t * 1.4 + f.x) > 0.6 ? -1 : 0);
      const col = g(f.c > 0.66 ? V.flowers[0] : f.c > 0.33 ? V.flowers[1] : V.flowers[2]);
      fb.set(x, y, col);
      if (f.c > 0.5) { fb.set(x - 1, y + 1, col); fb.set(x + 1, y + 1, col); fb.set(x, y + 1, g(V.flowerCore)); }
      fb.set(x, y + 2, g(V.stem));
    }
  }
}

function drawTree(fb, t, cam, L) {
  const g = L.g, V = L.veg;
  const o = -Math.round(cam * 1.12);
  const tx = 52 + o;
  if (tx > W + 120) return;
  const trunk = g(0x3a2a40), bark = g(0x2a1e33), rim = g(0x7a5560);
  for (let y = 44; y < 172; y++) {
    const w = 9 + Math.max(0, (y - 150) * 0.45) + (y < 70 ? (70 - y) * 0.12 : 0);
    const x = tx - Math.round(w / 2) + Math.round(Math.sin(y * 0.07) * 1.5);
    fb.rect(x, y, Math.round(w), 1, trunk);
    fb.rect(x + Math.round(w) - 2, y, 2, 1, rim);
    if ((y * 7) % 11 < 2) fb.rect(x + 2, y, 2, 1, bark);
  }
  fb.line(tx + 3, 66, tx + 26, 50, trunk); fb.line(tx + 3, 67, tx + 26, 51, trunk);
  fb.line(tx - 3, 72, tx - 24, 58, trunk); fb.line(tx - 3, 73, tx - 24, 59, trunk);
  if (!V.leaf) {
    // bare crown: branches carrying snow
    const limbs = [[2, 46, 30, 14], [0, 46, -30, 20], [26, 50, 58, 30], [26, 50, 44, 8], [-24, 58, -52, 34], [-24, 58, -44, 62], [8, 30, 22, -6], [-10, 34, -26, 4], [44, 20, 70, 14], [-36, 44, -66, 46], [14, 14, 4, -8]];
    for (const [x0, y0, x1, y1] of limbs) {
      fb.line(tx + x0, y0, tx + x1, y1, trunk); fb.line(tx + x0, y0 + 1, tx + x1, y1 + 1, trunk);
      const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 9));
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        const px = tx + x0 + (x1 - x0) * k, py = y0 + (y1 - y0) * k;
        fb.rect(Math.round(px) - 3, Math.round(py) - 2, 6, 2, g(0xffffff));
        fb.rect(Math.round(px) - 2, Math.round(py), 5, 1, g(0xc8d2e8));
      }
    }
    return;
  }
  // canopy: dark mass, mid tone, sun-side highlights
  const [c0, c1, c2, c3, c4, c5] = V.leaf.map(g);
  for (const l of LEAVES) fb.ellipse(l.x + o, l.y + 2, l.r + 1, l.r * 0.8 + 1, c0);
  for (const l of LEAVES) {
    const s = Math.round(Math.sin(t * 1.1 + l.p) * 0.9);
    fb.ellipse(l.x + o + s, l.y, l.r, l.r * 0.78, c1);
  }
  for (const l of LEAVES) {
    const s = Math.round(Math.sin(t * 1.1 + l.p) * 1.2);
    fb.ellipse(l.x + o + 3 + s, l.y - 1 + l.r * 0.15, l.r * 0.55, l.r * 0.4, c2);
    if (l.p > 2.2) fb.ellipse(l.x + o + 5 + s, l.y + l.r * 0.3, l.r * 0.28, l.r * 0.18, c3);
    if (l.p > 4.4) { fb.set(l.x + o + 7 + s, l.y + 2, c4); fb.set(l.x + o + 2 + s, l.y + 4, c5); }
  }
}

function drawPetals(fb, t, cam, L = DEFAULT) {
  const V = L.veg;
  if (V.particle === 'petal') {
    for (const p of PETALS) {
      const x = ((p.x + t * p.vx + Math.sin(t * 1.3 + p.p) * 6 - cam * 1.1) % 360 + 360) % 360 - 20;
      const y = (p.y + t * p.vy) % 200 - 10;
      const col = L.g(p.c > 0.6 ? V.particleCol[0] : p.c > 0.25 ? V.particleCol[1] : V.particleCol[2]);
      fb.set(x, y, col);
      if (Math.sin(t * 5 + p.p) > 0) fb.set(x + 1, y, col); else fb.set(x, y + 1, col);
    }
  } else if (V.particle === 'leaf') {
    for (const p of PETALS) {
      const x = ((p.x + t * p.vx * 1.3 + Math.sin(t * 1.6 + p.p) * 10 - cam * 1.1) % 360 + 360) % 360 - 20;
      const y = (p.y + t * p.vy * 1.5) % 200 - 10;
      const col = L.g(p.c > 0.6 ? V.particleCol[0] : p.c > 0.25 ? V.particleCol[1] : V.particleCol[2]);
      const ph = Math.floor(t * 4 + p.p) % 4;
      fb.set(x, y, col); fb.set(x + 1, y, col);
      if (ph === 0) fb.set(x + 2, y, col); else if (ph === 1) fb.set(x + 1, y + 1, col); else if (ph === 2) fb.set(x - 1, y, col); else fb.set(x, y - 1, col);
    }
  } else if (V.particle === 'snow') {
    for (const p of FLAKES) {
      const x = ((p.x + t * p.vx + Math.sin(t * 0.9 + p.p) * 7 - cam * 1.1) % 360 + 360) % 360 - 20;
      const y = (p.y + t * p.vy) % 200 - 10;
      fb.set(x, y, p.c > 0.5 ? 0xffffff : 0xe4e9f8);
      if (p.c > 0.72) { fb.set(x + 1, y, 0xffffff); fb.set(x, y + 1, 0xffffff); fb.set(x + 1, y + 1, 0xeef2ff); }
    }
  }
  if (L.fireflies) {
    for (const p of FLIES) {
      const x = Math.round(p.x + Math.sin(t * p.s + p.p) * p.ax - cam * 0.9);
      const y = Math.round(p.y + Math.sin(t * p.s * 1.7 + p.p * 2) * p.ay);
      const on = Math.sin(t * 2.4 + p.p * 3);
      if (on > -0.2) {
        fb.blend(x - 1, y, 0xd8ff7a, 0.35); fb.blend(x + 1, y, 0xd8ff7a, 0.35); fb.blend(x, y - 1, 0xd8ff7a, 0.35); fb.blend(x, y + 1, 0xd8ff7a, 0.35);
        fb.set(x, y, on > 0.5 ? 0xfaffc8 : 0xd8ff7a);
      }
    }
  }
}

// Everything behind the characters.
// opts: { look, bench: false | 'wide', lamp: false, lamps: [worldX...] }
function drawBack(fb, t, cam, opts = {}) {
  const L = opts.look || DEFAULT;
  const lightX = drawSky(fb, t, cam, L);
  drawCity(fb, t, cam, L);
  drawRiver(fb, t, cam, lightX, L);
  drawBank(fb, t, cam, L);
  if (opts.bench !== false) drawBench(fb, cam, L, opts.bench === 'wide');
  if (opts.lamp !== false) drawLamp(fb, t, cam, L);
  if (opts.lamps) for (const wx of opts.lamps) drawLamp(fb, t, cam, L, wx);
}

// Everything in front of the characters.
// opts: { look, camera, led, tree, petals }
function drawFront(fb, t, cam, opts = {}) {
  const L = opts.look || DEFAULT;
  drawFrontGrass(fb, t, cam, L);
  if (opts.camera !== false) drawCamera(fb, t, cam, opts.led, L);
  if (opts.tree !== false) drawTree(fb, t, cam, L);
  if (opts.petals !== false) drawPetals(fb, t, cam, L);
}

module.exports = { W, H, GROUND, HORIZON, RIVER_END, PATH_TOP, PATH_END, look, drawBack, drawFront, drawPetals, drawBench, drawLamp, hash, rng, mix };
