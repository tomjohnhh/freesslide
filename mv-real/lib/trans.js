'use strict';
// Transitions between two shots. Both shots are drawn for the same moment (A leaving, B
// arriving) and blended here. k runs 0..1 over the transition; o carries the shot's settings
// plus: step (how far k moves in one frame, for motion blur), since (seconds since the cut,
// negative before it), pre / post (seconds before / after the cut), time.
const { FB, mix } = require('./canvas');
const look = require('./look');

const smooth = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
// starts and ends at rest, fastest in the middle (at the cut)
const glide = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * k * (k * (k * 6 - 15) + 10));

const spare = new Map();
function buffer(like, name) {
  const key = name + like.w;
  if (!spare.has(key)) spare.set(key, new FB(like.s));
  return spare.get(key);
}

function fade(out, A, B, k) {
  mix(out, A, B, smooth(k));
}

// A dissolve through warm light.
function leak(out, A, B, k, o) {
  mix(out, A, B, smooth(k));
  const peak = Math.sin(Math.PI * Math.min(1, Math.max(0, k)));
  look.leak(out, o.time * 2.2 + (o.seed || 0), (o.amount === undefined ? 0.6 : o.amount) * peak, o.seed || 1);
  look.flash(out, 0.1 * peak, [255, 224, 192]);
}

// The camera's flash: white snaps in just before the cut and dies away after it.
function flash(out, A, B, k, o) {
  if (o.since < 0) { out.set(A); look.flash(out, Math.pow(1 + o.since / o.pre, 2)); }
  else { out.set(B); look.flash(out, Math.pow(Math.max(0, 1 - o.since / o.post), 1.6)); }
}

// A whip pan: the two pictures travel past side by side (o.dir: the way the picture travels,
// left / right / up / down), smeared along the way by as much as they move during one frame.
let sums = null;
function whip(out, A, B, k, o) {
  const dir = o.dir || 'left';
  const across = dir === 'left' || dir === 'right', forward = dir === 'left' || dir === 'up';
  const w = out.w, h = out.h, n = across ? w : h, lines = across ? h : w;
  const half = Math.max(0.5, Math.abs(glide(k + o.step / 2) - glide(k - o.step / 2)) * n * (o.shutter === undefined ? 0.9 : o.shutter) / 2);
  const p = glide(k), start = forward ? p * n : (1 - p) * n;
  const first = (forward ? A : B).d, second = (forward ? B : A).d, d = out.d;
  const stride = across ? 3 : w * 3, end = 2 * n;
  if (!sums || sums.length < (end + 1) * 3) sums = new Float64Array((end + 1) * 3);
  for (let j = 0; j < lines; j++) {
    const base = across ? j * w * 3 : j * 3;
    let r = 0, g = 0, b = 0, q = 3;
    sums[0] = sums[1] = sums[2] = 0;
    for (let part = 0; part < 2; part++) {
      const src = part ? second : first;
      for (let i = 0, s = base; i < n; i++, s += stride, q += 3) {
        r += src[s]; g += src[s + 1]; b += src[s + 2];
        sums[q] = r; sums[q + 1] = g; sums[q + 2] = b;
      }
    }
    for (let i = 0, t = base; i < n; i++, t += stride) {
      const c = i + 0.5 + start;
      let lo = c - half, hi = c + half;
      if (lo < 0) lo = 0;
      if (hi > end) hi = end;
      if (hi - lo < 1) { if (lo + 1 <= end) hi = lo + 1; else lo = hi - 1; }
      let i0 = lo | 0, i1 = hi | 0;
      if (i0 >= end) i0 = end - 1;
      if (i1 >= end) i1 = end - 1;
      const f0 = lo - i0, f1 = hi - i1, a0 = i0 * 3, a1 = i1 * 3, inv = 1 / (hi - lo);
      d[t] = (sums[a1] + (sums[a1 + 3] - sums[a1]) * f1 - sums[a0] - (sums[a0 + 3] - sums[a0]) * f0) * inv;
      d[t + 1] = (sums[a1 + 1] + (sums[a1 + 4] - sums[a1 + 1]) * f1 - sums[a0 + 1] - (sums[a0 + 4] - sums[a0 + 1]) * f0) * inv;
      d[t + 2] = (sums[a1 + 2] + (sums[a1 + 5] - sums[a1 + 2]) * f1 - sums[a0 + 2] - (sums[a0 + 5] - sums[a0 + 2]) * f0) * inv;
    }
  }
}

// dst = the mean of src enlarged about (cx, cy) by each of the given scales. Where a scale
// below 1 leaves the picture, the picture is mirrored.
function scaled(dst, src, cx, cy, scales) {
  const w = dst.w, h = dst.h, d = dst.d, sd = src.d, row = w * 3;
  const n = scales.length, share = 1 / n, maxU = w - 1, maxV = h - 1;
  const fold = (u, max) => { u = Math.abs(u) % (2 * max); return u > max ? 2 * max - u : u; };
  const inv = scales.map((s) => 1 / s);
  const p0 = new Int32Array(n), p1 = new Int32Array(n), ay = new Float64Array(n);
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < n; i++) {
      let v = cy + (y - cy) * inv[i];
      if (v < 0 || v > maxV) v = fold(v, maxV);
      let y0 = v | 0;
      if (y0 >= maxV) y0 = maxV - 1;
      p0[i] = y0 * row; p1[i] = p0[i] + row; ay[i] = v - y0;
    }
    let o = y * row;
    for (let x = 0; x < w; x++, o += 3) {
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < n; i++) {
        let u = cx + (x - cx) * inv[i];
        if (u < 0 || u > maxU) u = fold(u, maxU);
        let x0 = u | 0;
        if (x0 >= maxU) x0 = maxU - 1;
        const ax = u - x0, a = ay[i], p = p0[i] + x0 * 3, q = p1[i] + x0 * 3;
        const w00 = (1 - ax) * (1 - a), w10 = ax * (1 - a), w01 = (1 - ax) * a, w11 = ax * a;
        r += sd[p] * w00 + sd[p + 3] * w10 + sd[q] * w01 + sd[q + 3] * w11;
        g += sd[p + 1] * w00 + sd[p + 4] * w10 + sd[q + 1] * w01 + sd[q + 4] * w11;
        b += sd[p + 2] * w00 + sd[p + 5] * w10 + sd[q + 2] * w01 + sd[q + 5] * w11;
      }
      d[o] = r * share; d[o + 1] = g * share; d[o + 2] = b * share;
    }
  }
}

// src enlarged about (cx, cy), smeared over the scales s0..s1 it passes through during one
// frame. Three passes of three scales each add up to 27 evenly spread ones.
function zoomed(dst, src, cx, cy, s0, s1) {
  const spread = Math.abs(Math.log(s1 / s0)), mid = Math.sqrt(s0 * s1);
  const reach = spread * Math.hypot(Math.max(cx, dst.w - cx), Math.max(cy, dst.h - cy));
  if (reach < 1.5) {
    if (Math.abs(mid - 1) < 1e-5) dst.set(src); else scaled(dst, src, cx, cy, [mid]);
    return;
  }
  const e = spread / 27, t1 = buffer(dst, 'zoom1'), t2 = buffer(dst, 'zoom2');
  scaled(t1, src, cx, cy, [mid * Math.exp(-9 * e), mid, mid * Math.exp(9 * e)]);
  scaled(t2, t1, cx, cy, [Math.exp(-3 * e), 1, Math.exp(3 * e)]);
  scaled(dst, t2, cx, cy, [Math.exp(-e), 1, Math.exp(e)]);
}

// Flying through: A rushes towards o.from (a point on the stage) and B opens up out of
// o.into, both growing all the way, fastest at the cut. o.zoom is how far A grows; o.open is
// how far B grows (it starts that much smaller, its surroundings mirrored, so it is kept small).
function punch(out, A, B, k, o) {
  const s = out.s, GA = Math.log(o.zoom || 2.4), GB = Math.log(o.open || 1.35);
  const sh = (o.shutter === undefined ? 0.9 : o.shutter) * o.step / 2;
  const f0 = glide(k - sh), f1 = glide(k + sh);
  const m = smooth((k - 0.38) / 0.26);
  const from = o.from || [960, 540], into = o.into || from;
  const a = m > 0 && m < 1 ? buffer(out, 'punchA') : out, b = m > 0 && m < 1 ? buffer(out, 'punchB') : out;
  if (m < 1) zoomed(a, A, from[0] * s, from[1] * s, Math.exp(GA * f0), Math.exp(GA * f1));
  if (m > 0) zoomed(b, B, into[0] * s, into[1] * s, Math.exp(GB * (f0 - 1)), Math.exp(GB * (f1 - 1)));
  if (m > 0 && m < 1) mix(out, a, b, m);
}

module.exports = { fade, leak, flash, whip, punch, zoomed, glide, smooth };
