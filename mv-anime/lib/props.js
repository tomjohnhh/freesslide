'use strict';
// Things in the scenes other than the two people and the landscape.
const R = require('./raster');
const { P, G } = require('./draw');

const DARK = [44, 38, 70], DARK_LIT = [255, 196, 140];

// The shadow a standing figure throws towards the viewer when the sun is low behind it.
function shadow(g, x, y, k, o = {}) {
  const len = (o.len || 330) * k, lean = (o.lean === undefined ? -0.42 : o.lean) * len, w = 46 * k;
  g.fill(P().smooth([[x - w, y - 2], [x + w, y - 2], [x + lean + w * 1.7, y + len], [x + lean - w * 1.7, y + len]]),
    { linear: [0, y, 0, y + len], stops: [[0, [24, 16, 48, 0.5]], [1, [24, 16, 48, 0]]] });
  g.fill(P().ellipse(x, y, w * 1.25, 9 * k), [24, 16, 48, 0.4]);
}

// The compact camera on its tripod, seen from behind: its screen glows.
// (x, y): where the middle leg stands; k: size.
function tripod(g, x, y, k, t, o = {}) {
  g.save();
  g.translate(x, y);
  g.scale(k);
  const head = -250;
  for (const [fx, fy] of [[-62, 0], [0, 12], [66, 0]]) {
    g.stroke(P().M(0, head + 30).L(fx, fy), 9, DARK);
    g.stroke(P().M(1.5, head + 30).L(fx + 1.5, fy), 2, [DARK_LIT[0], DARK_LIT[1], DARK_LIT[2], 0.5]);
    g.fill(P().ellipse(fx, fy, 9, 4), DARK);
  }
  g.fill(P().rrect(-7, head - 6, 14, 60, 3), DARK);
  g.fill(P().rrect(-20, head - 14, 40, 14, 4), DARK);
  g.stroke(P().M(14, head - 6).L(52, head + 12), 5, DARK);
  // the camera's back
  const cw = 122, ch = 78, cy = head - 14 - ch;
  g.fill(P().rrect(-cw / 2, cy, cw, ch, 9), [70, 62, 100]);
  g.fill(P().rrect(-cw / 2, cy, cw, 5, 3), [DARK_LIT[0], DARK_LIT[1], DARK_LIT[2], 0.75]);
  const sx = -cw / 2 + 9, sy = cy + 11, sw = 78, sh = 56;
  g.fill(P().rect(sx - 2, sy - 2, sw + 4, sh + 4), [24, 20, 44]);
  g.fill(P().rect(sx, sy, sw, sh), { linear: [0, sy, 0, sy + sh], stops: [[0, [150, 110, 180]], [0.55, [255, 190, 140]], [0.62, [200, 130, 150]], [1, [80, 62, 110]]] });
  g.fill(P().rrect(sx + 27, sy + 24, 6, 20, 2), [250, 226, 150]);
  g.fill(P().circle(sx + 30, sy + 21, 3.4), [50, 40, 62]);
  g.fill(P().rrect(sx + 43, sy + 21, 7, 23, 2), [170, 200, 238]);
  g.fill(P().circle(sx + 46.5, sy + 18, 3.6), [44, 38, 54]);
  for (const [bx, by, r] of [[cw / 2 - 16, cy + 22, 7], [cw / 2 - 16, cy + 44, 5], [cw / 2 - 16, cy + 60, 5]]) g.fill(P().circle(bx, by, r), [44, 38, 70]);
  g.fill(P().rrect(cw / 2 - 30, cy - 5, 16, 6, 2), [70, 62, 100]);
  // the self-timer lamp blinks on the front; from behind its light spills over the top
  const blink = o.blink === undefined ? (((t * 2) % 1) < 0.5 ? 1 : 0.15) : o.blink;
  g.fill(P().circle(cw / 2 - 6, cy - 2, 34), { radial: [cw / 2 - 6, cy - 2, 34], stops: [[0, [255, 120, 60, 0.75 * blink]], [1, [255, 120, 60, 0]]] }, { mode: 'add' });
  // glow of the screen
  g.fill(P().circle(sx + sw / 2, sy + sh / 2, 110), { radial: [sx + sw / 2, sy + sh / 2, 110], stops: [[0, [255, 210, 170, 0.2]], [1, [255, 210, 170, 0]]] }, { mode: 'add' });
  g.restore();
}

// Where the tripod camera's screen is on the stage (for flying into it).
function tripodScreen(x, y, k) { return [x + (-61 + 9 + 39) * k, y + (-250 - 14 - 78 + 11 + 28) * k]; }

// An apple. (x, y) centre, r radius.
function apple(g, x, y, r, tone = [1, 1, 1], o = {}) {
  const c = (v) => [v[0] * tone[0], v[1] * tone[1], v[2] * tone[2]];
  const body = P().smooth([[x, y - r * 0.82], [x + r * 0.55, y - r * 1.0], [x + r * 1.02, y - r * 0.5], [x + r * 0.98, y + r * 0.35], [x + r * 0.5, y + r * 0.98], [x, y + r * 0.9], [x - r * 0.5, y + r * 0.98], [x - r * 0.98, y + r * 0.35], [x - r * 1.02, y - r * 0.5], [x - r * 0.55, y - r * 1.0]]);
  g.fill(body, c([226, 52, 60]));
  const m = g.mask(body);
  if (m) {
    g.fill(P().circle(x - r * 0.5, y + r * 0.2, r * 1.25), c([170, 30, 56]), { clip: m, alpha: 0.0 });
    g.fill(P().smooth([[x - r * 1.2, y + r * 0.1], [x - r * 0.4, y + r * 0.55], [x + r * 0.5, y + r * 0.5], [x + r * 1.2, y - r * 0.1], [x + r * 1.2, y + r * 1.2], [x - r * 1.2, y + r * 1.2]]), c([168, 28, 54]), { clip: m });
    g.fill(P().ellipse(x + r * 0.42, y - r * 0.42, r * 0.34, r * 0.2, -0.6), [255, 236, 220, 0.9], { clip: m });
    g.fill(P().ellipse(x + r * 0.62, y - r * 0.1, r * 0.08, r * 0.12, -0.3), [255, 236, 220, 0.8], { clip: m });
    g.fill(P().ellipse(x, y - r * 0.86, r * 0.3, r * 0.1), c([150, 24, 48]), { clip: m });
  }
  g.stroke(body, Math.max(1.2, r * 0.045), c([84, 26, 44]));
  g.stroke(P().M(x, y - r * 0.82).Q(x + r * 0.04, y - r * 1.2, x + r * 0.2, y - r * 1.36), Math.max(1.6, r * 0.09), c([96, 58, 44]));
  const leaf = P().smooth([[x + r * 0.12, y - r * 1.12, 1], [x + r * 0.5, y - r * 1.5], [x + r * 0.95, y - r * 1.34, 1], [x + r * 0.55, y - r * 1.08]]);
  g.fill(leaf, c([110, 176, 90]));
  g.stroke(leaf, Math.max(1, r * 0.035), c([52, 92, 60]));
  if (o.glint) {
    const gx = x + r * 0.42, gy = y - r * 0.42, s = r * 0.9 * o.glint;
    g.fill(P().poly([[gx - s, gy], [gx, gy - s * 0.09], [gx + s, gy], [gx, gy + s * 0.09]]), [255, 255, 255, 0.95]);
    g.fill(P().poly([[gx, gy - s], [gx + s * 0.09, gy], [gx, gy + s], [gx - s * 0.09, gy]]), [255, 255, 255, 0.95]);
  }
}

// The orange date a compact camera burns into a picture. (x, y): bottom right of the text; h: digit height.
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' };
function stamp(g, text, x, y, h, color = [255, 182, 70], glow = [255, 110, 30, 0.35]) {
  const dw = h * 0.56, st = Math.max(1.5, h * 0.14), gap = h * 0.3, skew = 0.1;
  let total = 0;
  for (const ch of text) total += ch === ' ' ? dw * 0.7 : ch === "'" ? st * 2 + gap * 0.6 : dw + gap;
  let cx = x - total;
  const y0 = y - h, ym = y - h / 2, y1 = y;
  const bars = P();
  const bar = (ax, ay, bx, by) => { const s0 = (y1 - ay) * skew, s1 = (y1 - by) * skew; bars.poly([[ax + s0, ay], [bx + s0, ay], [bx + s1, by], [ax + s1, by]]); };
  for (const ch of text) {
    if (ch === ' ') { cx += dw * 0.7; continue; }
    if (ch === "'") { bar(cx, y0, cx + st, y0 + h * 0.26); cx += st * 2 + gap * 0.6; continue; }
    const seg = SEG[ch] || '', a = cx, b = cx + dw, e = st * 0.5;
    if (seg.includes('a')) bar(a + e, y0, b - e, y0 + st);
    if (seg.includes('g')) bar(a + e, ym - st / 2, b - e, ym + st / 2);
    if (seg.includes('d')) bar(a + e, y1 - st, b - e, y1);
    if (seg.includes('f')) bar(a, y0 + e, a + st, ym - e * 0.5);
    if (seg.includes('b')) bar(b - st, y0 + e, b, ym - e * 0.5);
    if (seg.includes('e')) bar(a, ym + e * 0.5, a + st, y1 - e);
    if (seg.includes('c')) bar(b - st, ym + e * 0.5, b, y1 - e);
    cx += dw + gap;
  }
  if (glow) g.stroke(bars, st * 2.2, glow);
  g.fill(bars, color);
}

// A photo print: paper, a soft shadow, the picture (a layer) inside.
// (cx, cy) centre, w: picture width on the stage, rot, border; k 0..1: how much of a print it is
// yet (0: just the picture).
function print(g, layer, cx, cy, w, rot, border, k = 1, o = {}) {
  const h = w * layer.h / layer.w, b = border * k;
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  if (k > 0.01) {
    const lift = o.lift === undefined ? 1 : o.lift;
    for (let i = 0; i < 4; i++) g.fill(P().rrect(-w / 2 - b + 8 * lift - i * 5, -h / 2 - b + 14 * lift - i * 5, w + 2 * b + i * 10, h + 2 * b + i * 10, 6 + i * 5), [10, 6, 30, 0.1 * k]);
    g.fill(P().rrect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b + (o.bottom || 0) * k, 3), [250, 247, 240]);
  }
  g.layer(layer, -w / 2, -h / 2, w / (layer.w / layer.s), { edge: true });
  if (o.over) { g.translate(-w / 2, -h / 2); o.over(g, w, h); }
  g.restore();
}

// The compact camera's back, large, with a picture on its screen. (cx, cy): centre; w: width.
function cameraBack(g, cx, cy, w, layer, t, o = {}) {
  const h = w * 0.62;
  g.save();
  g.translate(cx, cy);
  if (o.rot) g.rotate(o.rot);
  const body = P().rrect(-w / 2, -h / 2, w, h, w * 0.06);
  for (let i = 0; i < 3; i++) g.fill(P().rrect(-w / 2 + 6 - i * 6, -h / 2 + 16 - i * 6, w + i * 12, h + i * 12, w * 0.06 + i * 6), [10, 6, 30, 0.12]);
  g.fill(body, { linear: [0, -h / 2, 0, h / 2], stops: [[0, [176, 172, 196]], [0.5, [140, 136, 166]], [1, [96, 92, 128]]] });
  g.fill(P().rrect(-w / 2, -h / 2, w, h * 0.05, w * 0.03), [255, 224, 180, 0.8]);
  g.stroke(body, 3, [52, 44, 78]);
  const sw = w * 0.66, sh = sw * layer.h / layer.w, sx = -w / 2 + w * 0.045, sy = -sh / 2 + h * 0.02;
  g.fill(P().rrect(sx - 8, sy - 8, sw + 16, sh + 16, 6), [26, 22, 46]);
  g.layer(layer, sx, sy, sw / (layer.w / layer.s));
  g.fill(P().poly([[sx, sy], [sx + sw * 0.5, sy], [sx + sw * 0.2, sy + sh], [sx, sy + sh]]), [255, 255, 255, 0.07]);
  const bx = w / 2 - w * 0.13;
  g.fill(P().circle(bx, -h * 0.02, w * 0.075), [70, 66, 100]);
  g.stroke(P().circle(bx, -h * 0.02, w * 0.075), 2.5, [52, 44, 78]);
  g.fill(P().circle(bx, -h * 0.02, w * 0.03), [120, 116, 150]);
  for (const [dx, dy] of [[-0.045, 0.3], [0.045, 0.3], [-0.045, -0.3], [0.045, -0.3]]) g.fill(P().circle(bx + w * dx, h * dy, w * 0.022), [70, 66, 100]);
  g.fill(P().rrect(bx - w * 0.07, -h * 0.44, w * 0.14, h * 0.07, 4), [70, 66, 100]);
  g.fill(P().circle(-w / 2 + w * 0.045 + 10, -h / 2 + h * 0.08, 5), [120, 255, 150, 0.9]);
  g.restore();
}

// The frame lines of the camera's screen while the self-timer runs.
function viewfinder(g, faces, pulse) {
  const W = [255, 255, 255, 0.9], GREEN = [150, 255, 120, 0.92];
  for (const [fx, fy, size] of faces) {
    const sz = size * (1 + 0.2 * pulse), c = sz * 0.28;
    const p = P();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.M(fx + sx * sz / 2, fy + sy * (sz / 2 - c)).L(fx + sx * sz / 2, fy + sy * sz / 2).L(fx + sx * (sz / 2 - c), fy + sy * sz / 2);
    g.stroke(p, 4, GREEN);
  }
  const x = 70, y = 60, w = 1780, h = 960, c = 64, f = P();
  for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]]) f.M(px + sx * c, py).L(px, py).L(px, py + sy * c);
  g.stroke(f, 5, W);
  g.stroke(P().circle(132, 126, 31), 5, W);
  g.stroke(P().M(132, 106).L(132, 126).L(147, 134), 5, W);
  g.stroke(P().M(124, 86).L(140, 86), 5, W);
  g.stroke(P().rrect(1730, 108, 70, 36, 5), 4, W);
  g.fill(P().rect(1738, 115, 40, 22), W);
  g.fill(P().rrect(1802, 117, 8, 18, 2), W);
  // thirds
  for (const u of [1 / 3, 2 / 3]) { g.fill(P().rect(x + w * u, y + 30, 1.5, h - 60), [255, 255, 255, 0.16]); g.fill(P().rect(x + 30, y + h * u, w - 60, 1.5), [255, 255, 255, 0.16]); }
}

// Birds crossing the sky: small flapping strokes. Frame coordinates.
function birds(g, t, list) {
  for (const b of list) {
    const x = b.x + b.vx * t, y = b.y + b.vy * t + Math.sin(t * 1.3 + b.ph) * 6, flap = Math.sin(t * 9 + b.ph) * 0.6, s = b.s;
    g.stroke(P().M(x - s, y - s * (0.2 + flap * 0.5)).Q(x - s * 0.4, y - s * 0.35, x, y).Q(x + s * 0.4, y - s * 0.35, x + s, y - s * (0.2 + flap * 0.5)), Math.max(1.4, s * 0.16), [44, 36, 78, 0.85], { taper: [0.3, 0.3] });
  }
}

// A shooting star. u: 0..1 along its path from (x0, y0) to (x1, y1).
function shootingStar(g, u, x0, y0, x1, y1) {
  if (u <= 0 || u >= 1) return;
  const hx = x0 + (x1 - x0) * u, hy = y0 + (y1 - y0) * u, len = 260 * Math.sin(Math.PI * u), l = Math.hypot(x1 - x0, y1 - y0);
  const dx = (x1 - x0) / l, dy = (y1 - y0) / l, a = Math.sin(Math.PI * u);
  g.fill(P().poly([[hx - dx * len, hy - dy * len], [hx - dy * 2.4, hy + dx * 2.4], [hx + dy * 2.4, hy - dx * 2.4]]), { linear: [hx - dx * len, hy - dy * len, hx, hy], stops: [[0, [255, 255, 255, 0]], [1, [255, 250, 230, 0.95 * a]]] }, { mode: 'add' });
  g.fill(P().circle(hx, hy, 22), { radial: [hx, hy, 22], stops: [[0, [255, 255, 240, 0.9 * a]], [1, [255, 240, 200, 0]]] }, { mode: 'add' });
}

// Short lines flying off something startled or shy. (x, y) centre; k: 0..1 as they fly.
function startle(g, x, y, k, size = 60, color = [255, 255, 255]) {
  if (k <= 0 || k >= 1) return;
  const a = Math.sin(Math.PI * k);
  for (const ang of [-2.5, -2.0, -1.5]) {
    const r0 = size * (0.7 + k * 0.5), r1 = r0 + size * 0.38;
    g.stroke(P().M(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0).L(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1), 6, [color[0], color[1], color[2], a], { taper: [0.2, 0.4] });
  }
}

module.exports = { shadow, tripod, tripodScreen, apple, stamp, print, cameraBack, viewfinder, birds, shootingStar, startle };
