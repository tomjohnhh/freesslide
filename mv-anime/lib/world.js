'use strict';
// The riverside at sunset. Things that never change (sky, clouds, the town across the river,
// the promenade) are painted once into layers and then only moved by the camera; water, light
// and the small things that drift are drawn anew for every frame.
//
// World coordinates: the stage (1920x1080) at the camera's rest position. The far shore is at
// y = HORIZON, the promenade starts at y = BANK, people stand around y = 960.
const R = require('./raster');
const { P, G } = require('./draw');

const HORIZON = 640, BANK = 806, SUN = [1180, 600];
const X0 = -260, X1 = 2180;          // how far the painted world reaches sideways
const SKY_TOP = -1150;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const cache = new Map();
function once(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// A layer covering the world box [x0, x1] x [y0, y1]; g draws on it in world coordinates.
function worldLayer(scale, x0, y0, x1, y1, paint) {
  const layer = new R.Layer(x1 - x0, y1 - y0, scale);
  layer.x0 = x0; layer.y0 = y0;
  const g = new G(layer);
  g.translate(-x0, -y0);
  paint(g);
  return layer;
}

const SKY = [[0, [16, 20, 62]], [0.3, [36, 42, 110]], [0.52, [84, 70, 150]], [0.7, [176, 98, 152]], [0.82, [246, 134, 122]], [0.91, [255, 188, 114]], [0.95, [255, 216, 144]], [1, [255, 222, 156]]];

function sky(scale) {
  return once('sky' + scale, () => worldLayer(scale, X0, SKY_TOP, X1, 760, (g) => {
    g.all({ linear: [0, SKY_TOP, 0, 760], stops: SKY }, { dither: true });
    // stars in the darker upper sky
    const rnd = rng(7);
    for (let i = 0; i < 420; i++) {
      const x = X0 + rnd() * (X1 - X0), y = SKY_TOP + Math.pow(rnd(), 1.4) * 1250, r = 0.8 + rnd() * rnd() * 2.2, a = (0.25 + 0.75 * rnd()) * Math.max(0, 1 - (y - SKY_TOP) / 1300);
      g.fill(P().circle(x, y, r), [255, 250, 235, a]);
      if (r > 2.2) { g.fill(P().poly([[x - r * 4, y], [x, y - 0.7], [x + r * 4, y], [x, y + 0.7]]), [255, 250, 235, a * 0.8]); g.fill(P().poly([[x, y - r * 4], [x + 0.7, y], [x, y + r * 4], [x - 0.7, y]]), [255, 250, 235, a * 0.8]); }
    }
    // a thin moon
    const moon = P().circle(380, -640, 46);
    const mm = g.mask(moon);
    g.fill(P().circle(380, -640, 120), { radial: [380, -640, 120], stops: [[0, [255, 246, 220, 0.22]], [1, [255, 246, 220, 0]]] }, { mode: 'add' });
    g.fill(moon, [255, 248, 226]);
    g.fill(P().circle(402, -654, 45), [33, 39, 104], { clip: mm });
    // the sun's glow, low over the far shore
    for (const [rad, stops] of [[1000, [[0, [255, 190, 120, 0.5]], [0.35, [255, 150, 110, 0.22]], [1, [255, 120, 110, 0]]]], [420, [[0, [255, 240, 200, 0.9]], [0.3, [255, 214, 150, 0.5]], [1, [255, 180, 120, 0]]]], [120, [[0, [255, 255, 240, 1]], [0.5, [255, 250, 220, 0.9]], [1, [255, 236, 180, 0]]]]]) {
      g.fill(P().circle(SUN[0], SUN[1], rad), { radial: [SUN[0], SUN[1], rad], stops }, { mode: 'add' });
    }
  }));
}

// One heap of cloud: puffs along a base line. The side of the heap that faces the sun is
// bright, the far side dark; every puff has a slightly lighter face towards the light.
function cumulus(g, cx, baseY, w, h, seed, pal) {
  const rnd = rng(seed), puffs = [];
  const size = Math.max(30, Math.min(84, h * 0.2)), n = Math.round(Math.max(12, (w * h * 0.5) / (size * size)));
  for (let i = 0; i < n; i++) {
    const u = i < 8 ? (i + 0.5) / 8 : rnd(), prof = Math.pow(Math.sin(Math.PI * u), 0.7);
    const r = size * (0.6 + 0.7 * rnd()) * (0.55 + 0.45 * prof), top = h * prof - r;
    puffs.push({ x: cx + (u - 0.5) * w, y: baseY - r * 0.5 - Math.max(0, top) * (i < 8 ? 0.15 : Math.pow(rnd(), 0.75)), r, n: rnd() });
  }
  const mid = [cx, baseY - h * 0.45];
  let lx = SUN[0] - mid[0], ly = SUN[1] - mid[1];
  const ll = Math.hypot(lx, ly) || 1;
  lx /= ll; ly /= ll;
  const reach = Math.abs(lx) * w * 0.5 + Math.abs(ly) * h * 0.5 + 1;
  const tint = (k) => {
    k = Math.max(0, Math.min(1, k)) * 3;
    const i = Math.min(2, k | 0), f = k - i, a = pal[i], b = pal[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
  // the upper puffs lie behind the lower ones
  puffs.sort((a, b) => a.y - b.y);
  g.fill(P().rrect(cx - w * 0.44, baseY - h * 0.3, w * 0.88, h * 0.34, h * 0.16), tint(0.42));
  for (const p of puffs) {
    const lit = 0.46 + 0.62 * ((p.x - mid[0]) * lx + (p.y - mid[1]) * ly) / reach + (p.n - 0.5) * 0.16;
    const blob = [];
    for (let a = 0; a < 9; a++) { const th = a * 2 * Math.PI / 9 + p.n * 6, rr = p.r * (0.9 + 0.2 * rnd()); blob.push([p.x + Math.cos(th) * rr, p.y + Math.sin(th) * rr]); }
    const c = P().smooth(blob);
    g.fill(c, tint(lit - 0.1));
    const m = g.mask(c);
    if (!m) continue;
    g.fill(P().circle(p.x + lx * p.r * 0.3, p.y + ly * p.r * 0.3, p.r * 0.96), tint(lit + 0.04), { clip: m });
    g.fill(P().circle(p.x + lx * p.r * 0.72, p.y + ly * p.r * 0.72, p.r * 0.74), tint(lit + 0.2), { clip: m, alpha: 0.9 });
  }
}

// cloud colours: shadow, body, lit, brightest
const WARM = [[150, 108, 164], [196, 124, 160], [246, 160, 146], [255, 220, 176]];
const COOL = [[70, 68, 136], [98, 86, 156], [160, 116, 170], [236, 170, 176]];
const PALE = [[190, 128, 160], [230, 150, 152], [255, 192, 150], [255, 234, 194]];

function farClouds(scale) {
  return once('clouds1' + scale, () => worldLayer(scale, X0, SKY_TOP, X1, 760, (g) => {
    cumulus(g, 1720, 610, 900, 640, 11, WARM);
    cumulus(g, 1460, 620, 520, 300, 12, PALE);
    cumulus(g, 250, 600, 700, 380, 13, WARM);
    cumulus(g, 760, 628, 420, 150, 14, PALE);
    cumulus(g, 900, -430, 520, 210, 15, COOL);
    cumulus(g, 1800, -760, 640, 250, 16, COOL);
    cumulus(g, 120, -820, 520, 200, 17, COOL);
    // the lower sky in front of the clouds' feet: haze
    g.fill(P().rect(X0, 420, X1 - X0, 340), { linear: [0, 420, 0, 660], stops: [[0, [255, 190, 130, 0]], [1, [255, 204, 140, 0.75]]] }, { mode: 'atop' });
  }));
}

function nearClouds(scale) {
  return once('clouds2' + scale, () => worldLayer(scale, X0, SKY_TOP, X1, 760, (g) => {
    const rnd = rng(31);
    // long thin streaks catching the light
    for (let i = 0; i < 16; i++) {
      const y = 80 + rnd() * 470, x = X0 + rnd() * (X1 - X0), w = 260 + rnd() * 520, h = 7 + rnd() * 13, k = (y - 80) / 470;
      const col = [255, 150 + 70 * k, 130 + 30 * k, 0.5 + 0.3 * k];
      g.fill(P().smooth([[x - w / 2, y], [x - w * 0.2, y - h], [x + w * 0.25, y - h * 0.6], [x + w / 2, y + h * 0.2], [x + w * 0.2, y + h], [x - w * 0.3, y + h * 0.7]]), col);
    }
    cumulus(g, 520, -150, 460, 170, 21, [[84, 76, 150], [150, 104, 168], [226, 140, 160], [255, 196, 170]]);
    cumulus(g, 1500, -330, 380, 140, 22, COOL);
  }));
}

function town(scale) {
  return once('town' + scale, () => worldLayer(scale, X0, 380, X1, 680, (g) => {
    const rnd = rng(5);
    // hills far away
    g.fill(P().smooth([[X0, 646], [X0, 600], [100, 572], [420, 598], [760, 584], [1100, 606], [1500, 578], [1900, 596], [X1, 574], [X1, 646]]), [170, 116, 160, 0.75]);
    for (const [row, col, hMin, hMax, alpha] of [[0, [150, 104, 156], 14, 70, 0.9], [1, [94, 70, 128], 18, 120, 1]]) {
      let x = X0 - rnd() * 40;
      while (x < X1) {
        const w = 22 + rnd() * 56, tall = rnd() < 0.08, h = tall ? 120 + rnd() * 90 : hMin + rnd() * rnd() * (hMax - hMin);
        const top = HORIZON + 4 - h;
        g.fill(P().rect(x, top, w, h + 4), [col[0], col[1], col[2], alpha]);
        if (rnd() < 0.3) g.fill(P().rect(x + w * 0.3, top - 8 - rnd() * 14, w * 0.4, 30), [col[0], col[1], col[2], alpha]);
        if (tall) g.fill(P().rect(x + w / 2 - 1, top - 34, 2, 34), [col[0], col[1], col[2], alpha]);
        if (row === 1) {
          for (let wy = top + 6; wy < HORIZON - 4; wy += 7) for (let wx = x + 4; wx < x + w - 5; wx += 7) if (rnd() < 0.34) g.fill(P().rect(wx, wy, 3.2, 3.6), [255, 226 - rnd() * 40, 150, 0.9]);
        }
        x += w + (rnd() < 0.25 ? rnd() * 26 : 1);
      }
    }
    // evening haze over the town's feet
    g.fill(P().rect(X0, 500, X1 - X0, 180), { linear: [0, 520, 0, 646], stops: [[0, [255, 176, 130, 0]], [1, [255, 190, 136, 0.62]]] }, { mode: 'atop' });
  }));
}

const RAIL = [46, 38, 76], RAIL_LIT = [255, 190, 130];

function promenade(scale) {
  return once('bank' + scale, () => worldLayer(scale, X0, 180, X1, 1240, (g) => {
    // paving
    g.fill(P().rect(X0, BANK, X1 - X0, 1240 - BANK), { linear: [0, BANK, 0, 1240], stops: [[0, [104, 76, 118]], [0.12, [78, 58, 104]], [1, [38, 30, 62]]] });
    for (let i = 0; i < 9; i++) { const y = BANK + 10 + i * i * 5.2; g.fill(P().rect(X0, y, X1 - X0, 1.6 + i * 0.25), [30, 22, 52, 0.28]); }
    for (let i = -14; i <= 14; i++) g.fill(P().poly([[960 + i * 60, BANK], [960 + i * 60 + 2, BANK], [960 + i * 330 + 5, 1240], [960 + i * 330 - 5, 1240]]), [30, 22, 52, 0.2]);
    g.fill(P().rect(X0, BANK - 3, X1 - X0, 7), [150, 104, 130]);
    g.fill(P().rect(X0, BANK - 3, X1 - X0, 1.6), [255, 200, 150, 0.8]);
    // the long evening light on the ground, towards the sun
    g.fill(P().poly([[SUN[0] - 40, BANK], [SUN[0] + 40, BANK], [SUN[0] + 520, 1240], [SUN[0] - 520, 1240]]), { linear: [0, BANK, 0, 1240], stops: [[0, [255, 190, 130, 0.3]], [1, [255, 170, 120, 0.05]]] }, { mode: 'atop' });
    // railing
    const top = 712, bottom = BANK + 2;
    for (let x = X0 + 40; x < X1; x += 172) {
      g.fill(P().rect(x - 5, top - 6, 10, bottom - top + 6), RAIL);
      g.fill(P().rect(x + 3, top - 6, 2, bottom - top + 6), [RAIL_LIT[0], RAIL_LIT[1], RAIL_LIT[2], 0.55]);
      g.fill(P().rrect(x - 8, top - 12, 16, 8, 3), RAIL);
    }
    for (const [y, h] of [[top, 9], [746, 5], [778, 5]]) {
      g.fill(P().rect(X0, y, X1 - X0, h), RAIL);
      g.fill(P().rect(X0, y, X1 - X0, 1.8), [RAIL_LIT[0], RAIL_LIT[1], RAIL_LIT[2], 0.7]);
    }
    // street lamp
    const lx = 236;
    g.fill(P().rect(lx - 5, 352, 10, BANK - 352 + 4), RAIL);
    g.fill(P().rect(lx + 2.5, 352, 2, BANK - 352), [RAIL_LIT[0], RAIL_LIT[1], RAIL_LIT[2], 0.5]);
    g.fill(P().rrect(lx - 12, BANK - 28, 24, 32, 4), RAIL);
    g.stroke(P().M(lx, 356).Q(lx, 318, lx + 44, 318), 8, RAIL);
    g.fill(P().smooth([[lx + 30, 318], [lx + 62, 318], [lx + 70, 334], [lx + 22, 334]]), RAIL);
    g.fill(P().ellipse(lx + 46, 338, 18, 7), [255, 240, 200]);
    // a tree at the left edge
    const rnd = rng(77);
    g.fill(P().smooth([[-150, BANK + 6], [-128, 620], [-140, 470], [-104, 470], [-96, 620], [-70, BANK + 6]]), [40, 30, 60]);
    const blobs = [];
    for (let i = 0; i < 46; i++) blobs.push([-250 + rnd() * 400, 190 + rnd() * 330, 34 + rnd() * 52]);
    for (const [x, y, r] of blobs) g.fill(P().circle(x, y, r), [36, 34, 70]);
    for (const [x, y, r] of blobs) if (x > -120) g.fill(P().circle(x + r * 0.5, y + r * 0.3, r * 0.45), [86, 62, 104, 0.5]);
    for (let i = 0; i < 60; i++) { const [x, y, r] = blobs[(rnd() * blobs.length) | 0], a = rnd() * 6.28; g.fill(P().ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, 9, 4.5, a), [36, 34, 70]); }
  }));
}

// ---- the camera ----
// cam: { x, y, zoom, px, py }: the world point in the middle of the frame and the
// magnification - moving these shifts near things more than far ones; px, py turn the camera
// (pan and tilt), which moves everything alike.
// depth: 1 for the plane the people stand on, smaller for things farther away.
function place(g, cam, depth = 1) {
  const z = 1 + (cam.zoom - 1) * depth;
  g.translate(960, 540);
  g.scale(z);
  g.translate(-960 - (cam.x - 960) * depth - (cam.px || 0), -540 - (cam.y - 540) * depth - (cam.py || 0));
  return g;
}

function drawLayer(g, layer, cam, depth) {
  g.save();
  place(g, cam, depth);
  g.layer(layer, layer.x0, layer.y0);
  g.restore();
}

// ---- water ----
const glints = (() => {
  const rnd = rng(99), list = [];
  for (let i = 0; i < 170; i++) { const v = rnd(); list.push({ x: X0 + rnd() * (X1 - X0), v, w: 6 + rnd() * 26, sp: 1.5 + rnd() * 3.5, ph: rnd() * 6.28 }); }
  return list;
})();

function river(g, t, cam, depth = 0.75) {
  g.save();
  place(g, cam, depth);
  const y0 = HORIZON - 2, y1 = BANK + 60;
  g.fill(P().rect(X0, y0, X1 - X0, y1 - y0), { linear: [0, y0, 0, y1], stops: [[0, [255, 208, 142]], [0.18, [244, 150, 128]], [0.5, [150, 96, 150]], [1, [70, 62, 124]]] });
  // the sun's path on the water
  for (let i = 0; i < 46; i++) {
    const u = i / 45, y = y0 + 4 + u * u * (BANK - y0 - 8) + u * 6, half = 10 + u * 120;
    const k = 0.5 + 0.5 * Math.sin(t * (2.2 + (i % 7) * 0.35) + i * 1.7), x = SUN[0] + Math.sin(t * 0.9 + i * 2.3) * half * 0.35;
    const w = half * (0.35 + 0.65 * k), h = 1.4 + u * 3.2;
    g.fill(P().ellipse(x, y, w, h), [255, 236, 190, 0.25 + 0.55 * k], { mode: 'add' });
  }
  for (const s of glints) {
    const k = Math.sin(t * s.sp + s.ph);
    if (k < 0.2) continue;
    const y = y0 + 8 + s.v * s.v * (BANK - y0 - 14), near = 0.4 + s.v;
    g.fill(P().ellipse(s.x + Math.sin(t * 0.6 + s.ph) * 6, y, s.w * near * 0.6, 0.9 + near * 1.3), [255, 226, 190, (k - 0.2) * 0.75], { mode: 'add' });
  }
  g.restore();
}

// ---- light ----
function lampGlow(g, t, cam) {
  g.save();
  place(g, cam, 1);
  const x = 282, y = 340, k = 0.92 + 0.08 * Math.sin(t * 9) * Math.sin(t * 2.3);
  g.fill(P().circle(x, y, 190), { radial: [x, y, 190], stops: [[0, [255, 214, 150, 0.6 * k]], [0.25, [255, 190, 120, 0.26 * k]], [1, [255, 170, 110, 0]]] }, { mode: 'add' });
  g.fill(P().poly([[x - 16, y], [x + 16, y], [x + 150, BANK + 150], [x - 150, BANK + 150]]), { linear: [0, y, 0, BANK + 150], stops: [[0, [255, 210, 150, 0.13 * k]], [1, [255, 210, 150, 0]]] }, { mode: 'add' });
  g.restore();
}

// Beams and a flare from the sun, in frame coordinates (sx, sy: where the sun is on the frame).
function sunRays(g, t, sx, sy, strength = 1) {
  for (let i = 0; i < 7; i++) {
    const a = -2.6 + i * 0.36 + Math.sin(t * 0.23 + i) * 0.05, w = 0.035 + 0.02 * Math.sin(i * 2.1 + t * 0.4), len = 1500;
    const k = (0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.9)) * strength;
    g.fill(P().poly([[sx, sy], [sx + Math.cos(a - w) * len, sy + Math.sin(a - w) * len], [sx + Math.cos(a + w) * len, sy + Math.sin(a + w) * len]]),
      { radial: [sx, sy, len], stops: [[0, [255, 226, 170, 0.2 * k]], [0.5, [255, 200, 150, 0.07 * k]], [1, [255, 190, 150, 0]]] }, { mode: 'add' });
  }
}

function flare(g, sx, sy, strength = 1, streak = true) {
  const cx = 960, cy = 540;
  for (const [f, r, col, a] of [[0.35, 26, [255, 190, 150], 0.22], [0.62, 50, [255, 150, 170], 0.13], [1.25, 80, [190, 170, 255], 0.1], [1.6, 30, [255, 220, 170], 0.18]]) {
    const x = sx + (cx - sx) * f * 1.4, y = sy + (cy - sy) * f * 1.4;
    g.fill(P().circle(x, y, r), { radial: [x, y, r], stops: [[0, [col[0], col[1], col[2], a * strength]], [0.75, [col[0], col[1], col[2], a * strength * 0.8]], [1, [col[0], col[1], col[2], 0]]] }, { mode: 'add' });
  }
  if (streak) g.fill(P().poly([[sx - 420, sy], [sx, sy - 5], [sx + 420, sy], [sx, sy + 5]]), { radial: [sx, sy, 420], stops: [[0, [255, 240, 210, 0.3 * strength]], [1, [255, 220, 180, 0]]] }, { mode: 'add' });
}

// Specks of light drifting up through the frame. Positions in frame coordinates.
function motes(g, t, n = 46, seed = 3, o = {}) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) {
    const bx = rnd() * 2100 - 90, by = rnd() * 1300, sp = 14 + rnd() * 34, ph = rnd() * 6.28, size = (o.size || 1) * (1.6 + rnd() * rnd() * 5), tw = 0.55 + 0.45 * Math.sin(t * (1 + rnd() * 2.5) + ph);
    const y = 1190 - ((by + t * sp) % 1300), x = bx + Math.sin(t * 0.7 + ph) * 26 + (o.drift || 0) * t * (0.4 + rnd());
    const xx = ((x + 90) % 2100 + 2100) % 2100 - 90, col = o.color || [255, 226, 170];
    g.fill(P().circle(xx, y, size * 3.2), { radial: [xx, y, size * 3.2], stops: [[0, [col[0], col[1], col[2], 0.55 * tw]], [0.3, [col[0], col[1], col[2], 0.22 * tw]], [1, [col[0], col[1], col[2], 0]]] }, { mode: 'add' });
  }
}

// An out-of-focus background for close shots. kind: 'sun' (towards the river) or 'dusk'.
function soft(g, t, kind, o = {}) {
  const sx = o.sun ? o.sun[0] : 1250, sy = o.sun ? o.sun[1] : 430, shift = o.shift || 0;
  if (kind === 'sun') {
    const hz = (o.horizon === undefined ? 470 : o.horizon);
    g.all({ linear: [0, 0, 0, 1080], stops: [[0, [104, 80, 156]], [hz / 1080 * 0.55, [214, 118, 150]], [hz / 1080, [255, 196, 132]], [Math.min(0.98, hz / 1080 + 0.02), [236, 150, 128]], [Math.min(0.99, hz / 1080 + 0.2), [124, 86, 142]], [1, [64, 50, 96]]] }, { dither: true });
    g.fill(P().circle(sx, sy, 900), { radial: [sx, sy, 900], stops: [[0, [255, 236, 190, 0.95]], [0.16, [255, 206, 140, 0.6]], [0.5, [255, 150, 120, 0.2]], [1, [255, 120, 120, 0]]] }, { mode: 'add' });
  } else {
    g.all({ linear: [0, 0, 0, 1080], stops: [[0, [58, 60, 128]], [0.45, [112, 86, 152]], [0.8, [196, 124, 146]], [1, [150, 96, 130]]] }, { dither: true });
    // dark soft shapes: trees far behind
    for (const [x, y, r] of [[160, 300, 520], [1780, 200, 480], [960, 1150, 620]]) g.fill(P().circle(x + shift * 0.5, y, r), { radial: [x + shift * 0.5, y, r], stops: [[0, [36, 34, 84, 0.55]], [0.6, [36, 34, 84, 0.32]], [1, [36, 34, 84, 0]]] });
    // the last warm light low between them, and lamps far away
    g.fill(P().circle(960 + shift * 0.3, 900, 900), { radial: [960 + shift * 0.3, 900, 900], stops: [[0, [255, 170, 130, 0.42]], [0.5, [255, 140, 130, 0.16]], [1, [255, 120, 130, 0]]] }, { mode: 'add' });
    const lamps = rng(47);
    for (let i = 0; i < 7; i++) {
      const x = ((lamps() * 2600 + shift * 0.8) % 2600 + 2600) % 2600 - 340, y = 330 + lamps() * 260, r = 30 + lamps() * 46, a = 0.3 + 0.2 * lamps() + 0.05 * Math.sin(t * 2 + i);
      g.fill(P().circle(x, y, r), { radial: [x, y, r], stops: [[0, [255, 226, 160, a]], [0.8, [255, 214, 150, a * 0.9]], [0.92, [255, 230, 180, a * 1.2]], [1, [255, 220, 160, 0]]] }, { mode: 'add' });
    }
  }
  const rnd = rng(kind === 'sun' ? 41 : 43);
  const n = o.discs === undefined ? 26 : o.discs;
  for (let i = 0; i < n; i++) {
    const bx = rnd() * 2200 - 140, by = (kind === 'sun' ? 300 : 180) + rnd() * 520, r = 22 + rnd() * 70, ph = rnd() * 6.28, warm = rnd() < 0.75;
    const x = bx + shift * (0.6 + rnd() * 0.6) + Math.sin(t * 0.5 + ph) * 10, y = by + Math.cos(t * 0.4 + ph) * 8, a = (0.1 + rnd() * 0.16) * (0.75 + 0.25 * Math.sin(t * 1.3 + ph));
    const col = warm ? [255, 200 + rnd() * 30, 140] : [200, 170, 255];
    g.fill(P().circle(x, y, r), { radial: [x, y, r], stops: [[0, [col[0], col[1], col[2], a]], [0.78, [col[0], col[1], col[2], a * 0.9]], [0.9, [col[0], col[1], col[2], a * 1.25]], [1, [col[0], col[1], col[2], 0]]] }, { mode: 'add' });
  }
}

module.exports = { HORIZON, BANK, SUN, X0, X1, SKY_TOP, RAIL, RAIL_LIT, rng, once, worldLayer, sky, farClouds, nearClouds, town, promenade, place, drawLayer, river, lampGlow, sunRays, flare, motes, soft };
