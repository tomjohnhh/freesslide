'use strict';
// Loads the still photographs (decoded by ffmpeg, enlarged once for full-size rendering) and
// makes variants of them, such as a copy with a camera date stamp.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SEGMENTS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd',
};

function createAssets({ root, ffmpeg, enlarge }) {
  const dir = path.join(root, 'assets', 'img');
  const index = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'images.json'), 'utf8'));
  const store = new Map();

  function get(id) {
    if (store.has(id)) return store.get(id);
    const info = index[id];
    if (!info) throw new Error('unknown image ' + id);
    const w = Math.round(info.w * enlarge), h = Math.round(info.h * enlarge);
    const vf = enlarge > 1 ? `scale=${w}:${h}:flags=lanczos,unsharp=5:5:0.45:5:5:0` : `scale=${w}:${h}:flags=bicubic`;
    const res = spawnSync(ffmpeg, ['-v', 'error', '-i', path.join(dir, info.file), '-vf', vf, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: w * h * 3 + 1024 });
    if (res.status !== 0 || !res.stdout || res.stdout.length !== w * h * 3) throw new Error(`could not decode ${info.file}: ${res.stderr ? res.stderr.toString().slice(0, 300) : res.error}`);
    const img = { id, w, h, d: new Uint8Array(res.stdout.buffer, res.stdout.byteOffset, res.stdout.length) };
    if (info.noise !== 0) sensorNoise(img, info.noise === undefined ? 1 : info.noise, enlarge > 1 ? 2 : 1);
    store.set(id, img);
    return img;
  }

  // The noise of a small camera sensor, fixed to the picture: brightness noise plus a little
  // colour noise, stronger in the shadows.
  function sensorNoise(img, amount, cell) {
    let seed = 0x2545f491;
    for (const ch of img.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 0x01000193);
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    const gauss = () => rnd() + rnd() + rnd() - 1.5;
    const { w, h, d } = img, cw = Math.ceil(w / cell), chh = Math.ceil(h / cell);
    const nl = new Float32Array(cw * chh), nr = new Float32Array(cw * chh), nb = new Float32Array(cw * chh);
    for (let i = 0; i < nl.length; i++) { nl[i] = gauss() * 9 * amount; nr[i] = gauss() * 4 * amount; nb[i] = gauss() * 5 * amount; }
    const out = new Uint8ClampedArray(d.buffer, d.byteOffset, d.length);
    for (let y = 0; y < h; y++) {
      const cy = ((y / cell) | 0) * cw;
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 3, c = cy + ((x / cell) | 0);
        const k = 1.25 - d[p + 1] * 0.0027;
        out[p] = d[p] + (nl[c] + nr[c]) * k; out[p + 1] = d[p + 1] + nl[c] * k; out[p + 2] = d[p + 2] + (nl[c] + nb[c]) * k;
      }
    }
  }

  // A copy of the picture with the orange date a compact camera burns into the corner.
  // right/bottom: where the stamp ends, as fractions of the picture.
  function stamped(id, text, right = 0.86, bottom = 0.93) {
    const key = `${id}|${text}|${right}|${bottom}`;
    if (store.has(key)) return store.get(key);
    const base = get(id);
    const img = { id: key, w: base.w, h: base.h, d: Uint8Array.from(base.d) };
    const hd = Math.round(base.h * 0.046), dw = Math.round(hd * 0.56), st = Math.max(2, Math.round(hd * 0.14)), gap = Math.round(hd * 0.3), skew = 0.1;
    let total = 0;
    for (const ch of text) total += ch === ' ' ? dw * 0.7 : ch === "'" ? st * 2 + gap * 0.6 : dw + gap;
    const pad = st * 4;
    const mw = Math.ceil(total + hd * skew) + pad * 2, mh = hd + pad * 2;
    const mask = new Float32Array(mw * mh);
    const fillRect = (x0, y0, x1, y1) => {
      for (let y = Math.round(y0); y < Math.round(y1); y++) {
        const sx = (hd - (y - pad)) * skew;
        for (let x = Math.round(x0 + sx); x < Math.round(x1 + sx); x++) if (x >= 0 && x < mw && y >= 0 && y < mh) mask[y * mw + x] = 1;
      }
    };
    let cx = pad;
    for (const ch of text) {
      if (ch === ' ') { cx += dw * 0.7; continue; }
      if (ch === "'") { fillRect(cx, pad, cx + st, pad + hd * 0.26); cx += st * 2 + gap * 0.6; continue; }
      const seg = SEGMENTS[ch] || '';
      const x0 = cx, x1 = cx + dw, y0 = pad, ym = pad + hd / 2, y1 = pad + hd, e = st * 0.5;
      if (seg.includes('a')) fillRect(x0 + e, y0, x1 - e, y0 + st);
      if (seg.includes('g')) fillRect(x0 + e, ym - st / 2, x1 - e, ym + st / 2);
      if (seg.includes('d')) fillRect(x0 + e, y1 - st, x1 - e, y1);
      if (seg.includes('f')) fillRect(x0, y0 + e, x0 + st, ym - e * 0.5);
      if (seg.includes('b')) fillRect(x1 - st, y0 + e, x1, ym - e * 0.5);
      if (seg.includes('e')) fillRect(x0, ym + e * 0.5, x0 + st, y1 - e);
      if (seg.includes('c')) fillRect(x1 - st, ym + e * 0.5, x1, y1 - e);
      cx += dw + gap;
    }
    const blur = (src, r) => {
      const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
        let s = 0, n = 0;
        for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < mw) { s += src[y * mw + xx]; n++; } }
        tmp[y * mw + x] = s / n;
      }
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
        let s = 0, n = 0;
        for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < mh) { s += tmp[yy * mw + x]; n++; } }
        out[y * mw + x] = s / n;
      }
      return out;
    };
    const core = blur(mask, 1), glow = blur(blur(mask, st), st);
    const ox = Math.round(base.w * right) - mw + pad, oy = Math.round(base.h * bottom) - mh + pad;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const X = ox + x, Y = oy + y;
        if (X < 0 || X >= base.w || Y < 0 || Y >= base.h) continue;
        const p = (Y * base.w + X) * 3, g = Math.min(1, glow[y * mw + x] * 1.5) * 0.6, c = Math.min(1, core[y * mw + x] * 1.15);
        let r = img.d[p], gg = img.d[p + 1], b = img.d[p + 2];
        r += (255 - r) * g; gg += (96 - gg) * g; b += (20 - b) * g;
        r += (255 - r) * c; gg += (176 - gg) * c; b += (64 - b) * c;
        img.d[p] = r; img.d[p + 1] = gg; img.d[p + 2] = b;
      }
    }
    store.set(key, img);
    return img;
  }

  return { get, stamped };
}

module.exports = { createAssets };
