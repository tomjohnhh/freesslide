'use strict';
// Surfaces and the anti-aliased polygon filler everything is drawn with.
//
// The frame (FB) is RGB; a Layer is RGBA with the colour already multiplied by the alpha, for
// things painted once and then moved by the camera. Sizes on the stage are 1920x1080; a
// surface's s says how many of its pixels make one stage unit (previews are smaller).
const VW = 1920, VH = 1080;

class FB {
  constructor(scale = 1) {
    this.s = scale; this.ch = 3;
    this.w = Math.round(VW * scale); this.h = Math.round(VH * scale);
    this.d = new Uint8ClampedArray(this.w * this.h * 3);
  }
  clear(r = 0, g = 0, b = 0) {
    const d = this.d;
    if (r === g && g === b) { d.fill(r); return; }
    for (let i = 0; i < d.length; i += 3) { d[i] = r; d[i + 1] = g; d[i + 2] = b; }
  }
  set(other) { this.d.set(other.d); }
}

class Layer {
  // w, h in stage units; scale as for the frame
  constructor(w, h, scale = 1) {
    this.s = scale; this.ch = 4;
    this.w = Math.max(1, Math.round(w * scale)); this.h = Math.max(1, Math.round(h * scale));
    this.d = new Uint8ClampedArray(this.w * this.h * 4);
  }
}

// ---- paints ------------------------------------------------------------------------------
// A paint is a colour [r, g, b] or [r, g, b, a], or a gradient:
//   { linear: [x0, y0, x1, y1], stops: [[t, colour], ...] }
//   { radial: [cx, cy, r], stops }           (t = distance from the centre / r)
// Gradient geometry is in the coordinates the shape was drawn in.
// modes: normal; add, multiply, screen (frames); atop (layers: only where something is already painted)
const MODES = { normal: 0, add: 1, multiply: 2, screen: 3, atop: 4 };
const LUT = 512;
const lutCache = new Map();

function lutOf(stops) {
  const key = JSON.stringify(stops);
  let lut = lutCache.get(key);
  if (lut) return lut;
  lut = new Float32Array((LUT + 1) * 4);
  for (let i = 0; i <= LUT; i++) {
    const t = i / LUT;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const a = stops[k], b = stops[Math.min(k + 1, stops.length - 1)];
    const u = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
    for (let c = 0; c < 4; c++) {
      const va = c < 3 ? a[1][c] : (a[1][3] === undefined ? 1 : a[1][3]), vb = c < 3 ? b[1][c] : (b[1][3] === undefined ? 1 : b[1][3]);
      lut[i * 4 + c] = va + (vb - va) * u;
    }
  }
  if (lutCache.size > 4000) lutCache.clear();
  lutCache.set(key, lut);
  return lut;
}

// m: the matrix the shape was drawn with (local -> surface pixels), for gradients
function compile(paint, m, o) {
  const p = { kind: 0, r: 0, g: 0, b: 0, a: 1, mode: MODES[(o && o.mode) || 'normal'] || 0, alpha: o && o.alpha !== undefined ? o.alpha : 1, dither: !!(o && o.dither) };
  if (Array.isArray(paint)) {
    p.r = paint[0]; p.g = paint[1]; p.b = paint[2]; p.a = paint[3] === undefined ? 1 : paint[3];
    return p;
  }
  p.lut = lutOf(paint.stops);
  const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
  // surface pixel -> local
  const ia = m[3] / det, ib = -m[1] / det, ic = -m[2] / det, id = m[0] / det;
  const ie = -(ia * m[4] + ic * m[5]), jf = -(ib * m[4] + id * m[5]);
  if (paint.linear) {
    const [x0, y0, x1, y1] = paint.linear, dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-9;
    p.kind = 1;
    // t = tx * X + ty * Y + t0
    p.tx = (ia * dx + ib * dy) / l2; p.ty = (ic * dx + id * dy) / l2; p.t0 = ((ie - x0) * dx + (jf - y0) * dy) / l2;
  } else {
    const [cx, cy, r] = paint.radial;
    p.kind = 2;
    p.ia = ia / r; p.ib = ib / r; p.ic = ic / r; p.id = id / r; p.ie = (ie - cx) / r; p.jf = (jf - cy) / r;
  }
  return p;
}

// ---- coverage ----------------------------------------------------------------------------
let acc = new Float32Array(1 << 16);
let rowCov = new Float32Array(4096);

// Adds one polygon edge to the coverage accumulator (signed areas; summing along a row gives
// how much of each pixel is inside). Coordinates are relative to the box, W x H pixels.
function edge(a, stride, W, H, ax, ay, bx, by) {
  if (ay === by) return;
  let dir = 1;
  if (ay > by) { dir = -1; let t = ax; ax = bx; bx = t; t = ay; ay = by; by = t; }
  if (by <= 0 || ay >= H) return;
  const dxdy = (bx - ax) / (by - ay);
  let x = ax, y0 = ay;
  if (ay < 0) { x -= ay * dxdy; y0 = 0; }
  const yEnd = by < H ? by : H;
  for (let y = Math.floor(y0); y < yEnd; y++) {
    const top = y > y0 ? y : y0, bot = y + 1 < yEnd ? y + 1 : yEnd, dy = bot - top;
    if (dy <= 0) continue;
    const xn = x + dxdy * dy, d = dy * dir, row = y * stride;
    let xa = x, xb = xn;
    x = xn;
    if (xa > xb) { const t = xa; xa = xb; xb = t; }
    if (xb <= 0) { a[row] += d; continue; }
    if (xa >= W) continue;
    if (xa < 0) xa = 0;
    if (xb > W) xb = W;
    const x0i = Math.floor(xa), x1i = Math.ceil(xb);
    if (x1i <= x0i + 1) {
      const xmf = 0.5 * (xa + xb) - x0i;
      a[row + x0i] += d - d * xmf;
      a[row + x0i + 1] += d * xmf;
    } else {
      const s = 1 / (xb - xa), x0f = xa - x0i, a0 = 0.5 * s * (1 - x0f) * (1 - x0f), x1f = xb - x1i + 1, am = 0.5 * s * x1f * x1f;
      a[row + x0i] += d * a0;
      if (x1i === x0i + 2) a[row + x0i + 1] += d * (1 - a0 - am);
      else {
        const a1 = s * (1.5 - x0f);
        a[row + x0i + 1] += d * (a1 - a0);
        for (let xi = x0i + 2; xi < x1i - 1; xi++) a[row + xi] += d * s;
        a[row + x1i - 1] += d * (1 - (a1 + (x1i - x0i - 3) * s) - am);
      }
      a[row + x1i] += d * am;
    }
  }
}

// The box of a set of polygons (flat [x, y, ...] arrays in surface pixels), clipped to the surface.
function boxOf(polys, w, h, clip) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys) {
    for (let i = 0; i < p.length; i += 2) {
      const x = p[i], y = p[i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  let x0 = Math.max(0, Math.floor(minX)), y0 = Math.max(0, Math.floor(minY)), x1 = Math.min(w, Math.ceil(maxX)), y1 = Math.min(h, Math.ceil(maxY));
  if (clip) { x0 = Math.max(x0, clip.x0); y0 = Math.max(y0, clip.y0); x1 = Math.min(x1, clip.x0 + clip.w); y1 = Math.min(y1, clip.y0 + clip.h); }
  return x1 > x0 && y1 > y0 ? { x0, y0, W: x1 - x0, H: y1 - y0 } : null;
}

function accumulate(polys, box) {
  const { x0, y0, W, H } = box, stride = W + 2;
  if (acc.length < stride * H) acc = new Float32Array(Math.ceil(stride * H * 1.3));
  if (rowCov.length < W) rowCov = new Float32Array(W + 1024);
  for (const p of polys) {
    const n = p.length;
    if (n < 6) continue;
    let ax = p[n - 2] - x0, ay = p[n - 1] - y0;
    for (let i = 0; i < n; i += 2) {
      const bx = p[i] - x0, by = p[i + 1] - y0;
      edge(acc, stride, W, H, ax, ay, bx, by);
      ax = bx; ay = by;
    }
  }
  return stride;
}

// A kept coverage map (0..1 per pixel of its box), for clipping and for rim light.
function maskOf(polys, w, h) {
  const box = boxOf(polys, w, h);
  if (!box) return null;
  const stride = accumulate(polys, box), { x0, y0, W, H } = box, a = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    let sum = 0, q = y * stride, o = y * W;
    for (let x = 0; x < W; x++, q++, o++) {
      sum += acc[q]; acc[q] = 0;
      const c = sum < 0 ? -sum : sum;
      a[o] = c > 1 ? 1 : c;
    }
    acc[q] = 0; acc[q + 1] = 0;
  }
  return { x0, y0, w: W, h: H, a };
}

// mask AND NOT (mask moved by dx, dy): the edge of a shape that faces (dx, dy).
function rimOf(mask, dx, dy) {
  const { w, h, a } = mask, out = new Float32Array(w * h);
  dx = Math.round(dx); dy = Math.round(dy);
  for (let y = 0; y < h; y++) {
    const yy = y + dy;
    for (let x = 0; x < w; x++) {
      const v = a[y * w + x];
      if (v <= 0) continue;
      const xx = x + dx;
      const other = xx >= 0 && xx < w && yy >= 0 && yy < h ? a[yy * w + xx] : 0;
      out[y * w + x] = v * (1 - other);
    }
  }
  return { x0: mask.x0, y0: mask.y0, w, h, a: out };
}

function intersect(m1, m2) {
  if (!m1 || !m2) return null;
  const x0 = Math.max(m1.x0, m2.x0), y0 = Math.max(m1.y0, m2.y0), x1 = Math.min(m1.x0 + m1.w, m2.x0 + m2.w), y1 = Math.min(m1.y0 + m1.h, m2.y0 + m2.h);
  if (x1 <= x0 || y1 <= y0) return null;
  const w = x1 - x0, h = y1 - y0, a = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let p = (y + y0 - m1.y0) * m1.w + x0 - m1.x0, q = (y + y0 - m2.y0) * m2.w + x0 - m2.x0, o = y * w;
    for (let x = 0; x < w; x++) a[o++] = m1.a[p++] * m2.a[q++];
  }
  return { x0, y0, w, h, a };
}

// ---- painting ----------------------------------------------------------------------------
const dith = new Float32Array(4096);
{ let s = 0x1234567; for (let i = 0; i < dith.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; dith[i] = ((s >>> 0) / 4294967296 - 0.5) * 1.6; } }

// Paints pixels xa..xb of row Y (surface coordinates) with coverage cov[x - x0].
function paintRow(surf, P, Y, xa, xb, cov, x0) {
  const d = surf.d, ch = surf.ch, alpha4 = ch === 4;
  let o = (Y * surf.w + xa) * ch;
  const mode = P.mode, ga = P.alpha;
  if (P.kind === 0) {
    const r = P.r, g = P.g, b = P.b, pa = P.a * ga;
    if (mode === 0) {
      for (let x = xa; x < xb; x++, o += ch) {
        const c = cov[x - x0];
        if (c <= 0.002) continue;
        const a = c * pa;
        d[o] += (r - d[o]) * a; d[o + 1] += (g - d[o + 1]) * a; d[o + 2] += (b - d[o + 2]) * a;
        if (alpha4) d[o + 3] += (255 - d[o + 3]) * a;
      }
    } else {
      for (let x = xa; x < xb; x++, o += ch) {
        const c = cov[x - x0];
        if (c <= 0.002) continue;
        const a = c * pa;
        if (mode === 1) { d[o] += r * a; d[o + 1] += g * a; d[o + 2] += b * a; }
        else if (mode === 2) { d[o] *= 1 - a * (1 - r / 255); d[o + 1] *= 1 - a * (1 - g / 255); d[o + 2] *= 1 - a * (1 - b / 255); }
        else if (mode === 3) { d[o] = 255 - (255 - d[o]) * (1 - a * r / 255); d[o + 1] = 255 - (255 - d[o + 1]) * (1 - a * g / 255); d[o + 2] = 255 - (255 - d[o + 2]) * (1 - a * b / 255); }
        else { const k = alpha4 ? d[o + 3] / 255 : 1; d[o] += (r * k - d[o]) * a; d[o + 1] += (g * k - d[o + 1]) * a; d[o + 2] += (b * k - d[o + 2]) * a; }
      }
    }
    return;
  }
  const lut = P.lut, dither = P.dither;
  let t = 0, dt = 0, u = 0, v = 0, du = 0, dv = 0;
  if (P.kind === 1) { t = P.tx * (xa + 0.5) + P.ty * (Y + 0.5) + P.t0; dt = P.tx; }
  else { u = P.ia * (xa + 0.5) + P.ic * (Y + 0.5) + P.ie; v = P.ib * (xa + 0.5) + P.id * (Y + 0.5) + P.jf; du = P.ia; dv = P.ib; }
  let dn = (Y * 131 + xa * 7) & 4095;
  for (let x = xa; x < xb; x++, o += ch, t += dt, u += du, v += dv) {
    const c = cov[x - x0];
    if (c <= 0.002) continue;
    let tt = P.kind === 1 ? t : Math.sqrt(u * u + v * v);
    tt = tt <= 0 ? 0 : tt >= 1 ? LUT : tt * LUT;
    const i0 = tt | 0, f = tt - i0, q = i0 * 4, q2 = i0 < LUT ? q + 4 : q;
    let r = lut[q] + (lut[q2] - lut[q]) * f, g = lut[q + 1] + (lut[q2 + 1] - lut[q + 1]) * f, b = lut[q + 2] + (lut[q2 + 2] - lut[q + 2]) * f;
    const a = (lut[q + 3] + (lut[q2 + 3] - lut[q + 3]) * f) * c * ga;
    if (a <= 0.0015) continue;
    if (dither) { const n = dith[dn = (dn + 1) & 4095]; r += n; g += n; b += n; }
    if (mode === 0) {
      d[o] += (r - d[o]) * a; d[o + 1] += (g - d[o + 1]) * a; d[o + 2] += (b - d[o + 2]) * a;
      if (alpha4) d[o + 3] += (255 - d[o + 3]) * a;
    } else if (mode === 1) { d[o] += r * a; d[o + 1] += g * a; d[o + 2] += b * a; }
    else if (mode === 2) { d[o] *= 1 - a * (1 - r / 255); d[o + 1] *= 1 - a * (1 - g / 255); d[o + 2] *= 1 - a * (1 - b / 255); }
    else if (mode === 3) { d[o] = 255 - (255 - d[o]) * (1 - a * r / 255); d[o + 1] = 255 - (255 - d[o + 1]) * (1 - a * g / 255); d[o + 2] = 255 - (255 - d[o + 2]) * (1 - a * b / 255); }
    else { const k = alpha4 ? d[o + 3] / 255 : 1; d[o] += (r * k - d[o]) * a; d[o + 1] += (g * k - d[o + 1]) * a; d[o + 2] += (b * k - d[o + 2]) * a; }
  }
}

// Fills polygons (overlapping ones count once). P: a compiled paint; clip: an optional mask.
function fillPolys(surf, polys, P, clip) {
  const box = boxOf(polys, surf.w, surf.h, clip);
  if (!box) return;
  const stride = accumulate(polys, box), { x0, y0, W, H } = box;
  for (let y = 0; y < H; y++) {
    let sum = 0, q = y * stride, first = -1, last = -1;
    for (let x = 0; x < W; x++, q++) {
      sum += acc[q]; acc[q] = 0;
      let c = sum < 0 ? -sum : sum;
      if (c > 1) c = 1;
      rowCov[x] = c;
      if (c > 0.002) { if (first < 0) first = x; last = x; }
    }
    acc[q] = 0; acc[q + 1] = 0;
    if (first < 0) continue;
    if (clip) {
      const cq = (y + y0 - clip.y0) * clip.w + (x0 - clip.x0);
      for (let x = first; x <= last; x++) rowCov[x] *= clip.a[cq + x];
    }
    paintRow(surf, P, y + y0, x0 + first, x0 + last + 1, rowCov, x0);
  }
}

// Paints through a kept mask.
function fillMask(surf, mask, P) {
  if (!mask) return;
  const { x0, y0, w, h, a } = mask;
  if (rowCov.length < w) rowCov = new Float32Array(w + 1024);
  for (let y = 0; y < h; y++) {
    const Y = y + y0;
    if (Y < 0 || Y >= surf.h) continue;
    const xa = Math.max(0, x0), xb = Math.min(surf.w, x0 + w);
    if (xb <= xa) continue;
    const row = a.subarray(y * w, y * w + w);
    paintRow(surf, P, Y, xa, xb, row, x0);
  }
}

// Paints the whole surface.
function fillAll(surf, P) {
  const w = surf.w;
  if (rowCov.length < w) rowCov = new Float32Array(w + 1024);
  rowCov.fill(1, 0, w);
  for (let y = 0; y < surf.h; y++) paintRow(surf, P, y, 0, w, rowCov, 0);
}

// ---- layers ------------------------------------------------------------------------------
// Draws a layer through the matrix m (layer pixels -> surface pixels), smoothly sampled.
// o: { alpha, src: [x, y, w, h] part of the layer in its pixels, edge: soften the outline }
function blit(surf, layer, m, o = {}) {
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0.003) return;
  const sx = o.src ? o.src[0] : 0, sy = o.src ? o.src[1] : 0, sw = o.src ? o.src[2] : layer.w, sh = o.src ? o.src[3] : layer.h;
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-9) return;
  const ia = m[3] / det, ib = -m[1] / det, ic = -m[2] / det, id = m[0] / det, ie = -(ia * m[4] + ic * m[5]), jf = -(ib * m[4] + id * m[5]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [cx, cy] of [[sx, sy], [sx + sw, sy], [sx, sy + sh], [sx + sw, sy + sh]]) {
    const X = m[0] * cx + m[2] * cy + m[4], Y = m[1] * cx + m[3] * cy + m[5];
    if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
  }
  const x0 = Math.max(0, Math.floor(minX)), y0 = Math.max(0, Math.floor(minY)), x1 = Math.min(surf.w, Math.ceil(maxX)), y1 = Math.min(surf.h, Math.ceil(maxY));
  if (x1 <= x0 || y1 <= y0) return;
  const d = surf.d, ch = surf.ch, src = layer.d, lw = layer.w, row = lw * 4, alpha4 = ch === 4;
  const uMin = sx, uMax = sx + sw - 1, vMin = sy, vMax = sy + sh - 1;
  const soft = o.edge ? Math.sqrt(Math.abs(det)) : 0;
  for (let y = y0; y < y1; y++) {
    let u = ia * (x0 + 0.5) + ic * (y + 0.5) + ie - 0.5, v = ib * (x0 + 0.5) + id * (y + 0.5) + jf - 0.5;
    let p = (y * surf.w + x0) * ch;
    for (let x = x0; x < x1; x++, u += ia, v += ib, p += ch) {
      if (u < uMin - 0.5 || u > uMax + 0.5 || v < vMin - 0.5 || v > vMax + 0.5) continue;
      let k = alpha;
      if (soft) {
        const e = Math.min(u - uMin + 0.5, uMax + 0.5 - u, v - vMin + 0.5, vMax + 0.5 - v) * soft;
        if (e < 1) k *= e < 0 ? 0 : e;
      }
      const fu = u < uMin ? uMin : u > uMax ? uMax : u, fv = v < vMin ? vMin : v > vMax ? vMax : v;
      let xi = fu | 0, yi = fv | 0;
      if (xi >= uMax) xi = uMax > uMin ? uMax - 1 : uMin;
      if (yi >= vMax) yi = vMax > vMin ? vMax - 1 : vMin;
      const ax = fu - xi, ay = fv - yi, q = yi * row + xi * 4, q2 = q + row;
      const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
      const a = (src[q + 3] * w00 + src[q + 7] * w10 + src[q2 + 3] * w01 + src[q2 + 7] * w11) * k / 255;
      if (a <= 0.003) continue;
      const na = 1 - a;
      d[p] = (src[q] * w00 + src[q + 4] * w10 + src[q2] * w01 + src[q2 + 4] * w11) * k + d[p] * na;
      d[p + 1] = (src[q + 1] * w00 + src[q + 5] * w10 + src[q2 + 1] * w01 + src[q2 + 5] * w11) * k + d[p + 1] * na;
      d[p + 2] = (src[q + 2] * w00 + src[q + 6] * w10 + src[q2 + 2] * w01 + src[q2 + 6] * w11) * k + d[p + 2] * na;
      if (alpha4) d[p + 3] = a * 255 + d[p + 3] * na;
    }
  }
}

// A copy of the frame as a layer (for freezing a picture).
function snapshot(fb) {
  const layer = new Layer(fb.w / fb.s, fb.h / fb.s, fb.s);
  const n = layer.w * layer.h;
  for (let i = 0, p = 0, q = 0; i < n; i++, p += 3, q += 4) { layer.d[q] = fb.d[p]; layer.d[q + 1] = fb.d[p + 1]; layer.d[q + 2] = fb.d[p + 2]; layer.d[q + 3] = 255; }
  return layer;
}

// A small blurred copy of a layer (q times smaller), for out-of-focus backdrops: drawn back
// at full size it is smooth.
function soften(layer, q, radius = 3, passes = 2) {
  const w = Math.max(1, Math.floor(layer.w / q)), h = Math.max(1, Math.floor(layer.h / q));
  const out = new Layer(1, 1, 1);
  out.s = layer.s / q; out.w = w; out.h = h;
  let a = new Float32Array(w * h * 4), b = new Float32Array(w * h * 4);
  const src = layer.d, n = 1 / (q * q);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, bl = 0, al = 0;
    for (let j = 0; j < q; j++) { let p = ((y * q + j) * layer.w + x * q) * 4; for (let i = 0; i < q; i++, p += 4) { r += src[p]; g += src[p + 1]; bl += src[p + 2]; al += src[p + 3]; } }
    const o = (y * w + x) * 4;
    a[o] = r * n; a[o + 1] = g * n; a[o + 2] = bl * n; a[o + 3] = al * n;
  }
  const pass = (from, to, len, lines, step, lineStep) => {
    for (let l = 0; l < lines; l++) for (let c = 0; c < 4; c++) {
      const base = l * lineStep + c;
      for (let i = 0; i < len; i++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) { const j = i + k < 0 ? 0 : i + k >= len ? len - 1 : i + k; sum += from[base + j * step]; }
        to[base + i * step] = sum / (2 * radius + 1);
      }
    }
  };
  for (let i = 0; i < passes; i++) { pass(a, b, w, h, 4, w * 4); pass(b, a, h, w, w * 4, 4); }
  out.d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < a.length; i++) out.d[i] = a[i];
  return out;
}

function mix(fb, a, b, k) {
  const d = fb.d, da = a.d, db = b.d;
  if (k <= 0) { d.set(da); return; }
  if (k >= 1) { d.set(db); return; }
  for (let i = 0; i < d.length; i++) d[i] = da[i] + (db[i] - da[i]) * k;
}

module.exports = { VW, VH, FB, Layer, compile, fillPolys, fillMask, fillAll, maskOf, rimOf, intersect, blit, snapshot, soften, mix };
