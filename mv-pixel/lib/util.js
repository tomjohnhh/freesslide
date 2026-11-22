'use strict';
// Small helpers and sprites shared by the shots.

const INK = 0x1b1530;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = (x) => Math.pow(clamp(x), 3);
const easeInOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeBack = (x) => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
// 0 -> 1 -> 0 over [0, 1]
const arc = (x) => Math.sin(clamp(x) * Math.PI);

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const HEART_BIG = [
  '..XXX...XXX..',
  '.XXXXX.XXXXX.',
  'XXHHXXXXXXXXX',
  'XXHXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  '.XXXXXXXXXXX.',
  '..XXXXXXXXX..',
  '...XXXXXXX...',
  '....XXXXX....',
  '.....XXX.....',
  '......X......',
];
const APPLE = [
  '......S......',
  '.....SS.LL...',
  '..RRRS.RLLL..',
  '.RRRRRRRRRR..',
  'RRHHRRRRRRRR.',
  'RHWHRRRRRRRD.',
  'RHHRRRRRRRRD.',
  'RRRRRRRRRRRD.',
  'RRRRRRRRRRDD.',
  'RRRRRRRRRRDD.',
  '.RRRRRRRRDD..',
  '.RRRRRRRDDD..',
  '..RRRDRRDD...',
  '...RR..DD....',
];
const APPLE_PAL = { R: 0xe5504a, D: 0xab3232, H: 0xff9c8c, W: 0xfff0e6, S: 0x5b3a2a, L: 0x62a052 };
const APPLE_SMALL = ['..S.L.', '.RRSLL', 'RHRRRR', 'RRRRRD', 'RRRRDD', '.RRDD.'];
const NOTE_A = ['..XX', '..XX', '..X.', '..X.', '..X.', 'XXX.', 'XXX.'];
const NOTE_B = ['.XXXXX', '.X...X', '.X...X', '.X...X', 'XX..XX', 'XX..XX'];
const CAN = ['.HH.', 'TTTT', 'CCCC', 'CWWC', 'CCCC', 'CCCC', 'DDDD'];
const CAN_PAL = { H: 0xdfe6ee, T: 0xb9c2d0, C: 0x5fb07a, W: 0xf4f3ee, D: 0x3d7a58 };

function stampScaled(fb, x, y, rows, pal, scale) {
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < rows[r].length; i++) {
      const ch = rows[r][i];
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (c !== undefined) fb.rect(x + i * scale, y + r * scale, scale, scale, c);
    }
  }
}

// Sprite with a one-pixel outline in a single colour.
function stampOutlined(fb, x, y, rows, pal, outline, scale = 1) {
  const mono = {};
  for (const k of Object.keys(pal)) mono[k] = outline;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) stampScaled(fb, x + dx * scale, y + dy * scale, rows, mono, scale);
  stampScaled(fb, x, y, rows, pal, scale);
}

function sparkle(fb, x, y, size, c) {
  fb.set(x, y, c);
  for (let i = 1; i <= size; i++) { fb.set(x - i, y, c); fb.set(x + i, y, c); fb.set(x, y - i, c); fb.set(x, y + i, c); }
}

function heart(fb, x, y, c = 0xe5504a, outline = INK) {
  if (outline != null) stampOutlined(fb, x, y, HEART, { X: c }, outline);
  else fb.stamp(x, y, HEART, { X: c });
}

// Hearts drifting upwards from around (x, y); `u` is the time since they started.
function risingHearts(fb, x, y, u, n = 3, opts = {}) {
  const speed = opts.speed || 0.6, rise = opts.rise || 30, spread = opts.spread || 9;
  for (let i = 0; i < n; i++) {
    const ph = (u * speed + i / n) % 1;
    if (u * speed + i / n < 1 && i / n > u * speed) continue;
    const hx = x + (i - (n - 1) / 2) * spread + Math.round(Math.sin(ph * 6 + i * 2) * 2);
    const hy = y - Math.round(ph * rise);
    if (ph < 0.85) heart(fb, hx, hy, i % 2 ? 0xff8f9c : 0xe5504a, opts.outline === undefined ? null : opts.outline);
  }
}

// Rounded speech bubble with a tail; returns the inner box.
function bubble(fb, x, y, w, h, opts = {}) {
  const fill = opts.fill || 0xffffff, line = opts.line || INK;
  fb.rect(x + 2, y - 1, w - 4, h + 2, line); fb.rect(x - 1, y + 2, w + 2, h - 4, line);
  fb.rect(x + 1, y, w - 2, h, line); fb.rect(x, y + 1, w, h - 2, line);
  fb.rect(x + 2, y, w - 4, h, fill); fb.rect(x, y + 2, w, h - 4, fill); fb.rect(x + 1, y + 1, w - 2, h - 2, fill);
  const tx = opts.tail == null ? x + (w >> 1) : opts.tail;
  const dir = opts.tailDir || 1;
  if (opts.thought) {
    fb.rect(tx - 1, y + h + 2, 4, 3, line); fb.rect(tx, y + h + 2, 2, 2, fill);
    fb.rect(tx + dir * 3, y + h + 6, 2, 2, line);
  } else if (opts.tail !== false) {
    for (let i = 0; i < 5; i++) { fb.rect(tx + dir * i - 1, y + h + i, 5 - i + 1, 1, line); }
    for (let i = 0; i < 4; i++) { fb.rect(tx + dir * i, y + h - 1 + i, 4 - i, 1, fill); }
  }
  return { x: x + 2, y: y + 2, w: w - 4, h: h - 4 };
}

module.exports = {
  INK, clamp, lerp, easeOut, easeIn, easeInOut, easeBack, arc,
  HEART, HEART_BIG, APPLE, APPLE_PAL, APPLE_SMALL, NOTE_A, NOTE_B, CAN, CAN_PAL,
  stampScaled, stampOutlined, sparkle, heart, risingHearts, bubble,
};
