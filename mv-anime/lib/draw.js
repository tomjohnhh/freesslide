'use strict';
// Vector drawing: paths (lines and curves), a drawing context with a transform stack, fills,
// strokes of varying width, clipping to a kept mask and rim light.
const R = require('./raster');

const TOL = 0.22;   // how far a flattened curve may stray from the true one, in pixels

class Path {
  constructor() { this.c = []; }
  M(x, y) { this.c.push(0, x, y); return this; }
  L(x, y) { this.c.push(1, x, y); return this; }
  Q(cx, cy, x, y) { this.c.push(2, cx, cy, x, y); return this; }
  C(ax, ay, bx, by, x, y) { this.c.push(3, ax, ay, bx, by, x, y); return this; }
  Z() { this.c.push(4); return this; }
  poly(pts, closed = true) {
    for (let i = 0; i < pts.length; i++) (i ? this.L : this.M).call(this, pts[i][0], pts[i][1]);
    return closed ? this.Z() : this;
  }
  rect(x, y, w, h) { return this.M(x, y).L(x + w, y).L(x + w, y + h).L(x, y + h).Z(); }
  rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    const k = r * 0.5523;
    return this.M(x + r, y).L(x + w - r, y).C(x + w - r + k, y, x + w, y + r - k, x + w, y + r).L(x + w, y + h - r)
      .C(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h).L(x + r, y + h).C(x + r - k, y + h, x, y + h - r + k, x, y + h - r)
      .L(x, y + r).C(x, y + r - k, x + r - k, y, x + r, y).Z();
  }
  ellipse(cx, cy, rx, ry, rot = 0) {
    const k = 0.5523, c = Math.cos(rot), s = Math.sin(rot);
    const P = (x, y) => [cx + x * c - y * s, cy + x * s + y * c];
    const pts = [P(rx, 0), P(rx, ry * k), P(rx * k, ry), P(0, ry), P(-rx * k, ry), P(-rx, ry * k), P(-rx, 0), P(-rx, -ry * k), P(-rx * k, -ry), P(0, -ry), P(rx * k, -ry), P(rx, -ry * k)];
    this.M(pts[0][0], pts[0][1]);
    for (let i = 0; i < 4; i++) { const a = pts[i * 3 + 1], b = pts[i * 3 + 2], e = pts[(i * 3 + 3) % 12]; this.C(a[0], a[1], b[0], b[1], e[0], e[1]); }
    return this.Z();
  }
  circle(cx, cy, r) { return this.ellipse(cx, cy, r, r); }
  // A smooth curve through the points; a point given as [x, y, 1] is a sharp corner.
  smooth(pts, closed = true, tension = 1) {
    const n = pts.length, k = tension / 6;
    const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    this.M(pts[0][0], pts[0][1]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const ax = p1[2] ? p1[0] : p1[0] + (p2[0] - p0[0]) * k, ay = p1[2] ? p1[1] : p1[1] + (p2[1] - p0[1]) * k;
      const bx = p2[2] ? p2[0] : p2[0] - (p3[0] - p1[0]) * k, by = p2[2] ? p2[1] : p2[1] - (p3[1] - p1[1]) * k;
      this.C(ax, ay, bx, by, p2[0], p2[1]);
    }
    return closed ? this.Z() : this;
  }
  add(other) { for (const v of other.c) this.c.push(v); return this; }

  // -> [{ pts: [x, y, ...] in surface pixels, closed }]
  flatten(m) {
    const out = [], c = this.c;
    let cur = null, x = 0, y = 0, sx = 0, sy = 0;
    const tx = (px, py) => m[0] * px + m[2] * py + m[4], ty = (px, py) => m[1] * px + m[3] * py + m[5];
    const begin = (px, py) => { cur = { pts: [tx(px, py), ty(px, py)], closed: false }; out.push(cur); };
    for (let i = 0; i < c.length;) {
      const op = c[i];
      if (op === 0) { x = sx = c[i + 1]; y = sy = c[i + 2]; begin(x, y); i += 3; }
      else if (op === 1) { if (!cur) begin(x, y); x = c[i + 1]; y = c[i + 2]; cur.pts.push(tx(x, y), ty(x, y)); i += 3; }
      else if (op === 2) {
        if (!cur) begin(x, y);
        const X0 = tx(x, y), Y0 = ty(x, y), X1 = tx(c[i + 1], c[i + 2]), Y1 = ty(c[i + 1], c[i + 2]), X2 = tx(c[i + 3], c[i + 4]), Y2 = ty(c[i + 3], c[i + 4]);
        const dd = Math.hypot(X0 - 2 * X1 + X2, Y0 - 2 * Y1 + Y2), n = Math.max(1, Math.min(48, Math.ceil(Math.sqrt(0.25 * dd / TOL))));
        for (let j = 1; j <= n; j++) { const t = j / n, u = 1 - t; cur.pts.push(u * u * X0 + 2 * u * t * X1 + t * t * X2, u * u * Y0 + 2 * u * t * Y1 + t * t * Y2); }
        x = c[i + 3]; y = c[i + 4]; i += 5;
      } else if (op === 3) {
        if (!cur) begin(x, y);
        const X0 = tx(x, y), Y0 = ty(x, y), X1 = tx(c[i + 1], c[i + 2]), Y1 = ty(c[i + 1], c[i + 2]), X2 = tx(c[i + 3], c[i + 4]), Y2 = ty(c[i + 3], c[i + 4]), X3 = tx(c[i + 5], c[i + 6]), Y3 = ty(c[i + 5], c[i + 6]);
        const dd = Math.max(Math.hypot(X0 - 2 * X1 + X2, Y0 - 2 * Y1 + Y2), Math.hypot(X1 - 2 * X2 + X3, Y1 - 2 * Y2 + Y3));
        const n = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(0.75 * dd / TOL))));
        for (let j = 1; j <= n; j++) {
          const t = j / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, cc = 3 * u * t * t, e = t * t * t;
          cur.pts.push(a * X0 + b * X1 + cc * X2 + e * X3, a * Y0 + b * Y1 + cc * Y2 + e * Y3);
        }
        x = c[i + 5]; y = c[i + 6]; i += 7;
      } else { if (cur) cur.closed = true; x = sx; y = sy; cur = null; i += 1; }
    }
    return out;
  }
}

const P = () => new Path();

// The outline of a stroke along a flattened line, as polygons that all wind the same way.
// hw(u): half the width at fraction u of the length (pixels).
function strokePolys(pts, closed, hw, out) {
  const n = pts.length / 2;
  if (n < 2) return;
  const lens = new Float64Array(n + 1);
  let total = 0;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;
    lens[i] = total;
    total += Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]);
  }
  lens[segs] = total;
  if (total <= 0) return;
  const widthAt = (i) => hw(lens[i] / total);
  const disc = (cx, cy, r) => {
    if (r < 0.2) return;
    const k = Math.max(6, Math.min(36, Math.ceil(5 * Math.sqrt(r)))), poly = new Array(k * 2);
    for (let a = 0; a < k; a++) { const th = -a * 2 * Math.PI / k; poly[a * 2] = cx + r * Math.cos(th); poly[a * 2 + 1] = cy + r * Math.sin(th); }
    out.push(poly);
  };
  let pdx = 0, pdy = 0;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n, ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
    let dx = bx - ax, dy = by - ay;
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) continue;
    dx /= l; dy /= l;
    const wa = widthAt(i), wb = widthAt(i + 1), nx = -dy, ny = dx;
    out.push([ax + nx * wa, ay + ny * wa, bx + nx * wb, by + ny * wb, bx - nx * wb, by - ny * wb, ax - nx * wa, ay - ny * wa]);
    // round the joint where the line turns noticeably, and the two ends
    if (i === 0 ? !closed : pdx * dx + pdy * dy < 0.97) disc(ax, ay, wa);
    if (i === segs - 1 && !closed) disc(bx, by, wb);
    pdx = dx; pdy = dy;
  }
  if (closed) disc(pts[0], pts[1], widthAt(0));
}

class G {
  constructor(surf) {
    this.surf = surf;
    this.m = [surf.s, 0, 0, surf.s, 0, 0];
    this.stack = [];
    this.clip = null;
  }
  save() { this.stack.push([this.m.slice(), this.clip]); return this; }
  restore() { const s = this.stack.pop(); this.m = s[0]; this.clip = s[1]; return this; }
  transform(a, b, c, d, e, f) {
    const m = this.m;
    this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
    return this;
  }
  translate(x, y) { return this.transform(1, 0, 0, 1, x, y); }
  scale(sx, sy = sx) { return this.transform(sx, 0, 0, sy, 0, 0); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); return this.transform(c, s, -s, c, 0, 0); }
  // pixels per unit under the current transform
  get zoom() { return Math.sqrt(Math.abs(this.m[0] * this.m[3] - this.m[1] * this.m[2])); }
  point(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  polys(path) { return path.flatten(this.m).map((s) => s.pts); }
  fill(path, paint, o) {
    R.fillPolys(this.surf, this.polys(path), R.compile(paint, this.m, o), (o && o.clip) || this.clip);
    return this;
  }
  // width in the current units; o.taper: [start, end] lengths (fractions of the line) over which
  // the stroke thins to a point; o.min: the thinnest it may get, in stage units
  stroke(path, width, paint, o = {}) {
    const z = this.zoom, s = this.surf.s;
    const half = Math.max(width * z, (o.min === undefined ? 1.1 : o.min) * s) / 2;
    const ta = o.taper ? o.taper[0] : 0, tb = o.taper ? o.taper[1] : 0;
    const hw = (u) => {
      let k = 1;
      if (ta > 0 && u < ta) k = Math.sin((u / ta) * Math.PI / 2);
      if (tb > 0 && u > 1 - tb) k = Math.min(k, Math.sin(((1 - u) / tb) * Math.PI / 2));
      return half * k;
    };
    const out = [];
    for (const sub of path.flatten(this.m)) strokePolys(sub.pts, sub.closed, hw, out);
    R.fillPolys(this.surf, out, R.compile(paint, this.m, o), o.clip || this.clip);
    return this;
  }
  mask(...paths) {
    const polys = [];
    for (const p of paths) for (const s of p.flatten(this.m)) polys.push(s.pts);
    return R.maskOf(polys, this.surf.w, this.surf.h);
  }
  paintMask(mask, paint, o) { R.fillMask(this.surf, mask, R.compile(paint, this.m, o)); return this; }
  all(paint, o) { R.fillAll(this.surf, R.compile(paint, this.m, o)); return this; }
  // layer drawn with its top-left corner at (x, y) in the current units, at its natural size
  // times k
  layer(layer, x = 0, y = 0, k = 1, o) {
    const m = this.m, f = k / layer.s;
    R.blit(this.surf, layer, [m[0] * f, m[1] * f, m[2] * f, m[3] * f, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]], o);
    return this;
  }
}

module.exports = { Path, P, G, strokePolys };
