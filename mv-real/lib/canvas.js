'use strict';
// Frame buffer and drawing. All positions and sizes are given on a 1920x1080 stage; the buffer
// may be smaller (previews) and everything scales with it.
const VW = 1920, VH = 1080;
const FULL = { x: 0, y: 0, w: 1, h: 1 };

class FB {
  constructor(scale = 1) {
    this.s = scale;
    this.w = Math.round(VW * scale);
    this.h = Math.round(VH * scale);
    this.d = new Uint8ClampedArray(this.w * this.h * 3);
  }
  clear(r = 0, g = 0, b = 0) {
    const d = this.d;
    if (r === g && g === b) { d.fill(r); return; }
    for (let i = 0; i < d.length; i += 3) { d[i] = r; d[i + 1] = g; d[i + 2] = b; }
  }
  set(other) { this.d.set(other.d); }
}

// Fills the frame with an image as seen by a camera. cam: { cx, cy } centre in image fractions,
// zoom (1 = the image just covers the frame), rot in radians.
function view(fb, img, cam = {}, alpha = 1) {
  const { w, h, d, s } = fb;
  const iw = img.w, ih = img.h, src = img.d;
  const k = 1 / (Math.max(VW / iw, VH / ih) * (cam.zoom || 1) * s);
  const rot = cam.rot || 0;
  const cos = Math.cos(rot) * k, sin = Math.sin(rot) * k;
  const hx = w / 2 - 0.5, hy = h / 2 - 0.5;
  // keep the camera inside the picture
  const reachX = (Math.abs(cos) * w + Math.abs(sin) * h) / 2, reachY = (Math.abs(sin) * w + Math.abs(cos) * h) / 2;
  const keep = (c, reach, size) => (reach * 2 >= size ? size / 2 : Math.min(size - reach, Math.max(reach, c)));
  const ox = keep((cam.cx === undefined ? 0.5 : cam.cx) * iw, reachX, iw) - 0.5, oy = keep((cam.cy === undefined ? 0.5 : cam.cy) * ih, reachY, ih) - 0.5;
  const maxU = iw - 1.001, maxV = ih - 1.001, row = iw * 3;
  const solid = alpha >= 0.999;
  for (let y = 0; y < h; y++) {
    const dy = y - hy;
    let u = ox - hx * cos - dy * sin, v = oy - hx * sin + dy * cos;
    let o = y * w * 3;
    for (let x = 0; x < w; x++, u += cos, v += sin, o += 3) {
      const fu = u < 0 ? 0 : u > maxU ? maxU : u, fv = v < 0 ? 0 : v > maxV ? maxV : v;
      const x0 = fu | 0, y0 = fv | 0, ax = fu - x0, ay = fv - y0;
      const p = y0 * row + x0 * 3, q = p + row;
      const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
      const r = src[p] * w00 + src[p + 3] * w10 + src[q] * w01 + src[q + 3] * w11;
      const g = src[p + 1] * w00 + src[p + 4] * w10 + src[q + 1] * w01 + src[q + 4] * w11;
      const b = src[p + 2] * w00 + src[p + 5] * w10 + src[q + 2] * w01 + src[q + 5] * w11;
      if (solid) { d[o] = r; d[o + 1] = g; d[o + 2] = b; }
      else { d[o] += (r - d[o]) * alpha; d[o + 1] += (g - d[o + 1]) * alpha; d[o + 2] += (b - d[o + 2]) * alpha; }
    }
  }
}

function bounds(fb, cx, cy, hw, hh, rot, pad) {
  const c = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
  const ex = hw * c + hh * sn + pad, ey = hw * sn + hh * c + pad, s = fb.s;
  return {
    x0: Math.max(0, Math.floor((cx - ex) * s) - 1), x1: Math.min(fb.w - 1, Math.ceil((cx + ex) * s) + 1),
    y0: Math.max(0, Math.floor((cy - ey) * s) - 1), y1: Math.min(fb.h - 1, Math.ceil((cy + ey) * s) + 1),
  };
}

// Draws a region of an image (src in image fractions) as a rectangle centred at (cx, cy), w x h
// on the stage, turned by rot.
function quad(fb, img, o) {
  const s = fb.s, d = fb.d, rot = o.rot || 0, alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0.002) return;
  const cos = Math.cos(rot), sin = Math.sin(rot), hw = o.w / 2, hh = o.h / 2;
  const { x0, x1, y0, y1 } = bounds(fb, o.cx, o.cy, hw, hh, rot, 2);
  const iw = img.w, ih = img.h, src = img.d, row = iw * 3;
  const sr = o.src || FULL;
  const sx = sr.x * iw, sy = sr.y * ih, sw = sr.w * iw, sh = sr.h * ih;
  const minU = Math.max(0, sx), maxU = Math.min(iw - 1.001, sx + sw - 1), minV = Math.max(0, sy), maxV = Math.min(ih - 1.001, sy + sh - 1);
  const ku = sw / o.w, kv = sh / o.h, dlx = cos / s, dly = -sin / s;
  for (let y = y0; y <= y1; y++) {
    const vy = (y + 0.5) / s - o.cy, vx0 = (x0 + 0.5) / s - o.cx;
    let lx = vx0 * cos + vy * sin, ly = -vx0 * sin + vy * cos;
    let p0 = (y * fb.w + x0) * 3;
    for (let x = x0; x <= x1; x++, lx += dlx, ly += dly, p0 += 3) {
      const ex = hw - (lx < 0 ? -lx : lx), ey = hh - (ly < 0 ? -ly : ly);
      const ed = (ex < ey ? ex : ey) * s + 0.5;
      if (ed <= 0) continue;
      const a = ed >= 1 ? alpha : ed * alpha;
      let u = sx + (lx + hw) * ku - 0.5, v = sy + (ly + hh) * kv - 0.5;
      u = u < minU ? minU : u > maxU ? maxU : u; v = v < minV ? minV : v > maxV ? maxV : v;
      const xi = u | 0, yi = v | 0, ax = u - xi, ay = v - yi;
      const p = yi * row + xi * 3, q = p + row;
      const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
      const r = src[p] * w00 + src[p + 3] * w10 + src[q] * w01 + src[q + 3] * w11;
      const g = src[p + 1] * w00 + src[p + 4] * w10 + src[q + 1] * w01 + src[q + 4] * w11;
      const b = src[p + 2] * w00 + src[p + 5] * w10 + src[q + 2] * w01 + src[q + 5] * w11;
      if (a >= 0.999) { d[p0] = r; d[p0 + 1] = g; d[p0 + 2] = b; }
      else { d[p0] += (r - d[p0]) * a; d[p0 + 1] += (g - d[p0 + 1]) * a; d[p0 + 2] += (b - d[p0 + 2]) * a; }
    }
  }
}

// A filled rectangle (optionally rounded, turned, with soft edges for shadows and glows).
// o: { cx, cy, w, h, rot, color: [r, g, b], alpha, blur, radius }
function box(fb, o) {
  const s = fb.s, d = fb.d, rot = o.rot || 0, alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0.002) return;
  const blur = o.blur || 0, rad = Math.min(o.radius || 0, o.w / 2, o.h / 2);
  const cos = Math.cos(rot), sin = Math.sin(rot), hw = o.w / 2, hh = o.h / 2;
  const { x0, x1, y0, y1 } = bounds(fb, o.cx, o.cy, hw, hh, rot, blur + 2);
  const [cr, cg, cb] = o.color;
  const dlx = cos / s, dly = -sin / s;
  for (let y = y0; y <= y1; y++) {
    const vy = (y + 0.5) / s - o.cy, vx0 = (x0 + 0.5) / s - o.cx;
    let lx = vx0 * cos + vy * sin, ly = -vx0 * sin + vy * cos;
    let p = (y * fb.w + x0) * 3;
    for (let x = x0; x <= x1; x++, lx += dlx, ly += dly, p += 3) {
      const qx = (lx < 0 ? -lx : lx) - hw + rad, qy = (ly < 0 ? -ly : ly) - hh + rad;
      let dist;
      if (qx > 0 && qy > 0) dist = Math.sqrt(qx * qx + qy * qy) - rad;
      else dist = (qx > qy ? qx : qy) - rad;
      let cov;
      if (blur > 0) {
        if (dist >= blur) continue;
        const k = dist <= -blur ? 1 : 0.5 - dist / (2 * blur);
        cov = k * k * (3 - 2 * k);
      } else {
        cov = 0.5 - dist * s;
        if (cov <= 0) continue;
        if (cov > 1) cov = 1;
      }
      const a = cov * alpha;
      d[p] += (cr - d[p]) * a; d[p + 1] += (cg - d[p + 1]) * a; d[p + 2] += (cb - d[p + 2]) * a;
    }
  }
}

function line(fb, x0, y0, x1, y1, width, color, alpha = 1) {
  const dx = x1 - x0, dy = y1 - y0;
  box(fb, { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.hypot(dx, dy) + width, h: width, rot: Math.atan2(dy, dx), color, alpha, radius: width / 2 });
}

// Outline of an axis-aligned rectangle, or only its corners when corner > 0.
function frame(fb, x, y, w, h, width, color, alpha = 1, corner = 0) {
  if (corner > 0) {
    for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      line(fb, px, py, px + sx * corner, py, width, color, alpha);
      line(fb, px, py, px, py + sy * corner, width, color, alpha);
    }
    return;
  }
  line(fb, x, y, x + w, y, width, color, alpha); line(fb, x, y + h, x + w, y + h, width, color, alpha);
  line(fb, x, y, x, y + h, width, color, alpha); line(fb, x + w, y, x + w, y + h, width, color, alpha);
}

// A disc, or a ring when width > 0.
function disc(fb, cx, cy, r, color, alpha = 1, width = 0) {
  const s = fb.s, d = fb.d;
  const x0 = Math.max(0, Math.floor((cx - r) * s) - 1), x1 = Math.min(fb.w - 1, Math.ceil((cx + r) * s) + 1);
  const y0 = Math.max(0, Math.floor((cy - r) * s) - 1), y1 = Math.min(fb.h - 1, Math.ceil((cy + r) * s) + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dist = Math.hypot((x + 0.5) / s - cx, (y + 0.5) / s - cy);
      let cov = (r - dist) * s + 0.5;
      if (width > 0) cov = Math.min(cov, (dist - (r - width)) * s + 0.5);
      if (cov <= 0) continue;
      const a = (cov > 1 ? 1 : cov) * alpha, p = (y * fb.w + x) * 3;
      d[p] += (color[0] - d[p]) * a; d[p + 1] += (color[1] - d[p + 1]) * a; d[p + 2] += (color[2] - d[p + 2]) * a;
    }
  }
}

function mix(fb, a, b, k) {
  const d = fb.d, da = a.d, db = b.d;
  if (k <= 0) { d.set(da); return; }
  if (k >= 1) { d.set(db); return; }
  for (let i = 0; i < d.length; i++) d[i] = da[i] + (db[i] - da[i]) * k;
}

// A photo print: paper with a border, a soft shadow under it, the picture inside.
// o: { cx, cy, w (picture width), rot, src, border, bottom, alpha, shadow, paper }
function print(fb, img, o) {
  const sr = o.src || FULL, rot = o.rot || 0, alpha = o.alpha === undefined ? 1 : o.alpha;
  const pw = o.w, ph = o.h || (pw * (sr.h * img.h)) / (sr.w * img.w);
  const b = o.border === undefined ? pw * 0.035 : o.border, bb = o.bottom === undefined ? b : o.bottom;
  const W = pw + 2 * b, H = ph + b + bb;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const sh = o.shadow === undefined ? 1 : o.shadow;
  if (sh > 0 && b > 0) {
    const lift = o.lift === undefined ? 1 : o.lift;
    box(fb, { cx: o.cx + 10 * lift, cy: o.cy + 16 * lift, w: W, h: H, rot, color: [0, 0, 0], alpha: 0.42 * sh * alpha, blur: 14 + 16 * lift, radius: 6 });
  }
  if (b > 0) box(fb, { cx: o.cx, cy: o.cy, w: W, h: H, rot, color: o.paper || [248, 245, 238], alpha, radius: 3 });
  const oy = (b - bb) / 2;
  quad(fb, img, { cx: o.cx - oy * sin, cy: o.cy + oy * cos, w: pw, h: ph, rot, src: sr, alpha });
  return { W, H, pw, ph };
}

module.exports = { VW, VH, FULL, FB, view, quad, box, line, frame, disc, mix, print };
