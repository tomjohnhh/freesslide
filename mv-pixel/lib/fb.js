'use strict';
// Low-resolution RGB framebuffer with the drawing primitives the scenes need.
// Colours are 0xRRGGBB integers. Every primitive honours the translation (ox, oy)
// and the clip rectangle, so a scene can be drawn into a sub-window or panned.

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => BAYER4[((y & 3) << 2) | (x & 3)];

const mix = (a, b, t) => {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

class FB {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h * 3);
    this.ox = 0;
    this.oy = 0;
    this.cx0 = 0;
    this.cy0 = 0;
    this.cx1 = w;
    this.cy1 = h;
  }

  clip(x, y, w, h) {
    this.cx0 = Math.max(0, x);
    this.cy0 = Math.max(0, y);
    this.cx1 = Math.min(this.w, x + w);
    this.cy1 = Math.min(this.h, y + h);
  }

  unclip() {
    this.cx0 = 0;
    this.cy0 = 0;
    this.cx1 = this.w;
    this.cy1 = this.h;
  }

  clear(c) {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    const d = this.d;
    for (let i = 0; i < d.length; i += 3) { d[i] = r; d[i + 1] = g; d[i + 2] = b; }
  }

  set(x, y, c) {
    x = Math.floor(x + this.ox);
    y = Math.floor(y + this.oy);
    if (x < this.cx0 || y < this.cy0 || x >= this.cx1 || y >= this.cy1) return;
    const i = (y * this.w + x) * 3;
    this.d[i] = (c >> 16) & 255;
    this.d[i + 1] = (c >> 8) & 255;
    this.d[i + 2] = c & 255;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    const i = (y * this.w + x) * 3;
    return (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2];
  }

  blend(x, y, c, a) {
    x = Math.floor(x + this.ox);
    y = Math.floor(y + this.oy);
    if (x < this.cx0 || y < this.cy0 || x >= this.cx1 || y >= this.cy1) return;
    const i = (y * this.w + x) * 3;
    const d = this.d;
    d[i] += (((c >> 16) & 255) - d[i]) * a;
    d[i + 1] += (((c >> 8) & 255) - d[i + 1]) * a;
    d[i + 2] += ((c & 255) - d[i + 2]) * a;
  }

  rect(x, y, w, h, c) {
    let x0 = Math.floor(x + this.ox), y0 = Math.floor(y + this.oy);
    let x1 = x0 + Math.floor(w), y1 = y0 + Math.floor(h);
    if (x0 < this.cx0) x0 = this.cx0;
    if (y0 < this.cy0) y0 = this.cy0;
    if (x1 > this.cx1) x1 = this.cx1;
    if (y1 > this.cy1) y1 = this.cy1;
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    const d = this.d;
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * this.w + x0) * 3;
      for (let xx = x0; xx < x1; xx++) { d[i] = r; d[i + 1] = g; d[i + 2] = b; i += 3; }
    }
  }

  rectA(x, y, w, h, c, a) {
    if (a <= 0) return;
    if (a >= 1) return this.rect(x, y, w, h, c);
    let x0 = Math.floor(x + this.ox), y0 = Math.floor(y + this.oy);
    let x1 = x0 + Math.floor(w), y1 = y0 + Math.floor(h);
    if (x0 < this.cx0) x0 = this.cx0;
    if (y0 < this.cy0) y0 = this.cy0;
    if (x1 > this.cx1) x1 = this.cx1;
    if (y1 > this.cy1) y1 = this.cy1;
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    const d = this.d;
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * this.w + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        d[i] += (r - d[i]) * a;
        d[i + 1] += (g - d[i + 1]) * a;
        d[i + 2] += (b - d[i + 2]) * a;
        i += 3;
      }
    }
  }

  // Ordered-dither fill: paints c on the share `level` (0..1) of the pixels.
  rectD(x, y, w, h, c, level) {
    const lv = level * 16;
    if (lv <= 0) return;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (bayer(x0 + xx, y0 + yy) < lv) this.set(x0 + xx, y0 + yy, c);
      }
    }
  }

  hline(x, y, w, c) { this.rect(x, y, w, 1, c); }
  vline(x, y, h, c) { this.rect(x, y, 1, h, c); }

  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Filled ellipse centred on (cx, cy); half-pixel radii give even diameters.
  ellipse(cx, cy, rx, ry, c) {
    for (let yy = Math.ceil(-ry); yy <= Math.floor(ry); yy++) {
      const k = 1 - (yy * yy) / (ry * ry);
      if (k < 0) continue;
      const half = Math.floor(rx * Math.sqrt(k) + 0.35);
      this.rect(Math.round(cx) - half, Math.round(cy) + yy, half * 2 + 1, 1, c);
    }
  }

  disc(cx, cy, r, c) { this.ellipse(cx, cy, r, r, c); }

  ellipseD(cx, cy, rx, ry, c, level) {
    for (let yy = Math.ceil(-ry); yy <= Math.floor(ry); yy++) {
      const k = 1 - (yy * yy) / (ry * ry);
      if (k < 0) continue;
      const half = Math.floor(rx * Math.sqrt(k) + 0.35);
      this.rectD(Math.round(cx) - half, Math.round(cy) + yy, half * 2 + 1, 1, c, level);
    }
  }

  ellipseA(cx, cy, rx, ry, c, a) {
    for (let yy = Math.ceil(-ry); yy <= Math.floor(ry); yy++) {
      const k = 1 - (yy * yy) / (ry * ry);
      if (k < 0) continue;
      const half = Math.floor(rx * Math.sqrt(k) + 0.35);
      this.rectA(Math.round(cx) - half, Math.round(cy) + yy, half * 2 + 1, 1, c, a);
    }
  }

  // Vertical gradient through colour stops [[pos 0..1, colour], ...], banded and dithered.
  vgrad(x, y, w, h, stops, bands = 5) {
    for (let yy = 0; yy < h; yy++) {
      const p = h > 1 ? yy / (h - 1) : 0;
      let i = 0;
      while (i < stops.length - 2 && p > stops[i + 1][0]) i++;
      const [p0, c0] = stops[i];
      const [p1, c1] = stops[i + 1];
      const f = Math.min(1, Math.max(0, (p - p0) / (p1 - p0 || 1))) * bands;
      const lo = Math.floor(f), frac = f - lo;
      const ca = mix(c0, c1, Math.min(1, lo / bands));
      const cb = mix(c0, c1, Math.min(1, (lo + 1) / bands));
      this.rect(x, y + yy, w, 1, ca);
      if (frac > 0.06) this.rectD(x, y + yy, w, 1, cb, frac);
    }
  }

  // Draws an ASCII sprite: rows of characters looked up in pal; '.' and ' ' are transparent.
  stamp(x, y, rows, pal, flip = false) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let i = 0; i < row.length; i++) {
        const ch = row[flip ? row.length - 1 - i : i];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c !== undefined) this.set(x + i, y + r, c);
      }
    }
  }

  // Copies a region of another buffer, enlarged by an integer factor (nearest neighbour).
  blit(src, sx, sy, sw, sh, dx, dy, scale = 1) {
    for (let yy = 0; yy < sh; yy++) {
      const syy = sy + yy;
      if (syy < 0 || syy >= src.h) continue;
      for (let xx = 0; xx < sw; xx++) {
        const sxx = sx + xx;
        if (sxx < 0 || sxx >= src.w) continue;
        const i = (syy * src.w + sxx) * 3;
        const c = (src.d[i] << 16) | (src.d[i + 1] << 8) | src.d[i + 2];
        if (scale === 1) this.set(dx + xx, dy + yy, c);
        else this.rect(dx + xx * scale, dy + yy * scale, scale, scale, c);
      }
    }
  }

  copyFrom(src) { this.d.set(src.d); }

  // Whole-frame colour wash, used for fades and flashes.
  wash(c, a) {
    if (a <= 0) return;
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    const d = this.d;
    if (a >= 1) return this.clear(c);
    for (let i = 0; i < d.length; i += 3) {
      d[i] += (r - d[i]) * a;
      d[i + 1] += (g - d[i + 1]) * a;
      d[i + 2] += (b - d[i + 2]) * a;
    }
  }
}

module.exports = { FB, mix, bayer };
