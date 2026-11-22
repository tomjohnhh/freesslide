'use strict';
// Whole-frame finishing: vignette, glow, light leaks, flashes, fades.

function hash(n) {
  let x = (n | 0) * 0x9e3779b1;
  x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function vignette(fb, strength = 0.35) {
  const { w, h, d } = fb;
  const map = cached(`vig${w}x${h}`, () => {
    const m = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5) / w - 0.5, dy = ((y + 0.5) / h - 0.5) * 0.82;
        const r = Math.sqrt(dx * dx + dy * dy) / 0.62;
        const k = r < 0.35 ? 0 : Math.min(1, (r - 0.35) / 0.65);
        m[y * w + x] = k * k;
      }
    }
    return m;
  });
  for (let i = 0, p = 0; i < map.length; i++, p += 3) {
    const k = 1 - strength * map[i];
    d[p] *= k; d[p + 1] *= k; d[p + 2] *= k;
  }
}

// Darkens the bottom of the frame a little so the caption stays readable.
function shade(fb, strength = 0.4, from = 800) {
  const { w, h, d, s } = fb;
  const y0 = Math.round(from * s);
  for (let y = y0; y < h; y++) {
    const u = (y - y0) / (h - y0), k = 1 - strength * u * u * (3 - 2 * u);
    let p = y * w * 3;
    for (let x = 0; x < w * 3; x++, p++) d[p] *= k;
  }
}

function grain(fb, frameIndex, amount = 7) {
  const { w, h, d } = fb;
  const tile = cached(`grain${w}x${h}`, () => {
    const n = w * h, a = new Float32Array(n), out = new Int8Array(n);
    let seed = 12345;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    for (let i = 0; i < n; i++) a[i] = rnd() + rnd() + rnd() - 1.5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const v = a[i] * 0.6 + (a[y * w + ((x + 1) % w)] + a[((y + 1) % h) * w + x]) * 0.28;
        out[i] = Math.max(-127, Math.min(127, Math.round(v * 150)));
      }
    }
    return out;
  });
  const ox = Math.floor(hash(frameIndex * 2 + 1) * w), oy = Math.floor(hash(frameIndex * 2 + 2) * h);
  const k = amount / 60;
  for (let y = 0; y < h; y++) {
    const ty = ((y + oy) % h) * w;
    let p = y * w * 3;
    for (let x = 0; x < w; x++, p += 3) {
      let tx = x + ox; if (tx >= w) tx -= w;
      const g = d[p + 1];
      const wgt = g < 128 ? 0.45 + g * 0.0043 : 1 - (g - 128) * 0.0047;
      const n = tile[ty + tx] * k * wgt;
      d[p] += n; d[p + 1] += n; d[p + 2] += n;
    }
  }
}

// Warm light leaking in from the frame edges. amount 0..1, t moves the light.
function leak(fb, t, amount, seed = 0) {
  if (amount <= 0.003) return;
  const { w, h, d } = fb;
  const gw = 49, gh = 28, grid = new Float32Array(gw * gh * 3);
  const blobs = [];
  for (let i = 0; i < 3; i++) {
    const ph = hash(seed * 7 + i * 3 + 1) * 6.283, sp = 0.25 + hash(seed * 7 + i * 3 + 2) * 0.3;
    const side = hash(seed * 7 + i * 3 + 3) < 0.5 ? 0 : 1;
    blobs.push({
      x: side ? 1.02 - 0.1 * Math.sin(t * sp + ph) : -0.02 + 0.1 * Math.sin(t * sp + ph),
      y: 0.5 + 0.45 * Math.sin(t * sp * 0.7 + ph * 1.7),
      r: 0.3 + 0.12 * Math.sin(t * sp * 1.3 + ph),
      c: i === 0 ? [1, 0.42, 0.12] : i === 1 ? [1, 0.2, 0.1] : [1, 0.72, 0.3],
      a: 0.55 + 0.45 * Math.sin(t * sp * 2.1 + ph * 0.6),
    });
  }
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const px = x / (gw - 1), py = y / (gh - 1);
      let r = 0, g = 0, b = 0;
      for (const bl of blobs) {
        const dx = (px - bl.x) * 1.78, dy = py - bl.y;
        const v = Math.exp(-(dx * dx + dy * dy) / (bl.r * bl.r)) * bl.a;
        r += v * bl.c[0]; g += v * bl.c[1]; b += v * bl.c[2];
      }
      const i = (y * gw + x) * 3;
      grid[i] = r * amount; grid[i + 1] = g * amount; grid[i + 2] = b * amount;
    }
  }
  for (let y = 0; y < h; y++) {
    const gy = (y / (h - 1)) * (gh - 1), y0 = Math.min(gh - 2, gy | 0), ay = gy - y0;
    let p = y * w * 3;
    for (let x = 0; x < w; x++, p += 3) {
      const gx = (x / (w - 1)) * (gw - 1), x0 = Math.min(gw - 2, gx | 0), ax = gx - x0;
      const i = (y0 * gw + x0) * 3, j = i + gw * 3;
      const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
      const r = grid[i] * w00 + grid[i + 3] * w10 + grid[j] * w01 + grid[j + 3] * w11;
      if (r < 0.004) continue;
      const g = grid[i + 1] * w00 + grid[i + 4] * w10 + grid[j + 1] * w01 + grid[j + 4] * w11;
      const b = grid[i + 2] * w00 + grid[i + 5] * w10 + grid[j + 2] * w01 + grid[j + 5] * w11;
      d[p] += (255 - d[p]) * (r > 1 ? 1 : r); d[p + 1] += (255 - d[p + 1]) * (g > 1 ? 1 : g); d[p + 2] += (255 - d[p + 2]) * (b > 1 ? 1 : b);
    }
  }
}

function flash(fb, k, color = [255, 255, 255]) {
  if (k <= 0.003) return;
  const d = fb.d, a = k > 1 ? 1 : k;
  for (let p = 0; p < d.length; p += 3) {
    d[p] += (color[0] - d[p]) * a; d[p + 1] += (color[1] - d[p + 1]) * a; d[p + 2] += (color[2] - d[p + 2]) * a;
  }
}

// Light spreading softly out of the bright parts of the picture. from..to: the brightness
// (0..255) over which a pixel starts to glow.
let glow = null;
function bloom(fb, strength = 0.5, from = 150, to = 245) {
  if (strength <= 0.003) return;
  const { w, h, d } = fb, q = Math.max(1, Math.round(4 * fb.s)), sw = Math.floor(w / q), sh = Math.floor(h / q);
  if (!glow || glow.sw !== sw || glow.sh !== sh) glow = { sw, sh, a: new Float32Array(sw * sh * 3), b: new Float32Array(sw * sh * 3), x0: new Int32Array(w), ax: new Float32Array(w) };
  const a = glow.a, b = glow.b, n = 1 / (q * q), span = 1 / (to - from);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let r = 0, g = 0, bl = 0;
      for (let j = 0; j < q; j++) { let p = ((y * q + j) * w + x * q) * 3; for (let i = 0; i < q; i++, p += 3) { r += d[p]; g += d[p + 1]; bl += d[p + 2]; } }
      r *= n; g *= n; bl *= n;
      let k = ((r * 0.3 + g * 0.59 + bl * 0.11) - from) * span;
      k = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
      const o = (y * sw + x) * 3;
      a[o] = r * k; a[o + 1] = g * k; a[o + 2] = bl * k;
    }
  }
  const R = 4, inv = 1 / (2 * R + 1);
  const pass = (src, dst, len, lines, step, lineStep) => {
    for (let l = 0; l < lines; l++) for (let c = 0; c < 3; c++) {
      const base = l * lineStep + c;
      let sum = 0;
      for (let k = -R; k <= R; k++) sum += src[base + (k < 0 ? 0 : k >= len ? len - 1 : k) * step];
      for (let i = 0; i < len; i++) {
        dst[base + i * step] = sum * inv;
        const out = i - R, add = i + R + 1;
        sum += src[base + (add >= len ? len - 1 : add) * step] - src[base + (out < 0 ? 0 : out) * step];
      }
    }
  };
  for (let i = 0; i < 2; i++) { pass(a, b, sw, sh, 3, sw * 3); pass(b, a, sh, sw, sw * 3, 3); }
  for (let x = 0; x < w; x++) { let u = (x + 0.5) / q - 0.5; if (u < 0) u = 0; if (u > sw - 1) u = sw - 1; let x0 = u | 0; if (x0 > sw - 2) x0 = Math.max(0, sw - 2); glow.x0[x] = x0 * 3; glow.ax[x] = u - x0; }
  const kk = strength / 255;
  for (let y = 0; y < h; y++) {
    let v = (y + 0.5) / q - 0.5; if (v < 0) v = 0; if (v > sh - 1) v = sh - 1;
    let y0 = v | 0; if (y0 > sh - 2) y0 = Math.max(0, sh - 2);
    const ay = v - y0, r0 = y0 * sw * 3, r1 = r0 + sw * 3;
    let p = y * w * 3;
    for (let x = 0; x < w; x++, p += 3) {
      const i = r0 + glow.x0[x], j = r1 + glow.x0[x], ax = glow.ax[x];
      const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
      const r = a[i] * w00 + a[i + 3] * w10 + a[j] * w01 + a[j + 3] * w11;
      if (r < 0.5) { const g0 = a[i + 1] * w00 + a[i + 4] * w10 + a[j + 1] * w01 + a[j + 4] * w11; if (g0 < 0.5) continue; }
      const g = a[i + 1] * w00 + a[i + 4] * w10 + a[j + 1] * w01 + a[j + 4] * w11;
      const bl = a[i + 2] * w00 + a[i + 5] * w10 + a[j + 2] * w01 + a[j + 5] * w11;
      d[p] += (255 - d[p]) * r * kk; d[p + 1] += (255 - d[p + 1]) * g * kk; d[p + 2] += (255 - d[p + 2]) * bl * kk;
    }
  }
}

function dim(fb, k) {
  if (k >= 0.999) return;
  const d = fb.d, m = k < 0 ? 0 : k;
  for (let p = 0; p < d.length; p++) d[p] *= m;
}

module.exports = { hash, vignette, shade, grain, leak, flash, bloom, dim };
