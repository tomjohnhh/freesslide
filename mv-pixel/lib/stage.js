'use strict';
// Staging helpers: the riverside with actors on it, zoomed views, and the scenes that
// become the photos in the album.

const { FB } = require('./fb');
const { drawGirl, drawBoy, SKIN } = require('./chars');
const world = require('./world');
const props = require('./props');
const U = require('./util');

const W = 320;
const H = 180;
const G = world.GROUND;

// Outfits (palette overrides for the characters).
const WEAR = {
  summerG: { pal: { top: 0xfdfdf6, topSh: 0xd9dde6, topRim: 0xffffff, skirt: 0x7fb4e0, skirtSh: 0x5a8cc0 }, wear: { hat: 'straw' } },
  summerB: { pal: { shirt: 0xf2c84a, shirtSh: 0xc99a2e, shirtRim: 0xffe9a0 } },
  autumnG: { pal: { top: 0xd89a3a, topSh: 0xb0742a, topRim: 0xf2c46a, skirt: 0x7a4a3a, skirtSh: 0x5a342a }, wear: { scarf: 0xf4ecda, scarfSh: 0xcfc4ad } },
  autumnB: { pal: { shirt: 0x7a8a52, shirtSh: 0x5a6a3a, shirtRim: 0xa8b87a } },
  winterG: { pal: { top: 0xf4d8dc, topSh: 0xd0a8b0, topRim: 0xffffff, leg: 0x4a3a52 }, wear: { scarf: 0xd9574c, scarfSh: 0xab3232, hat: 'beanie' } },
  winterB: { pal: { shirt: 0x3f6a5a, shirtSh: 0x2a4a40, shirtRim: 0x6a9a86, tee: 0x3f6a5a, teeSh: 0x2a4a40 }, wear: { scarf: 0xc9c9d6, scarfSh: 0x9a9ab0, hat: 'beanie', hatCol: 0x34416a, hatBand: 0x242e50 } },
  rainG: { pal: { top: 0xb8d8c8, topSh: 0x8ab0a0, topRim: 0xe0f4ea } },
  homeG: { style: 'now', pal: { top: 0xf2c4c0, topSh: 0xd09a9a, topRim: 0xffe4e0, skirt: 0x6a5a8a, skirtSh: 0x4a3e68, coat: false, inner: null, leg: SKIN, sock: 0xf7f3ee, shoe: 0x5b3a34 } },
  homeB: { style: 'now', pal: { shirt: 0x8a7f9c, shirtSh: 0x6a607c, shirtRim: 0xb0a6c0, tee: 0xf0ece4, teeSh: 0xcfcac0 } },
};

// Draws the riverside with actors.
// o: { t, cam, look, actors: [{ who, x (world), y, pose }], back, front, mid(fb), over(fb) }
function scene(fb, o) {
  const L = o.look || world.look();
  world.drawBack(fb, o.t, o.cam, { look: L, ...(o.back || {}) });
  if (o.mid) o.mid(fb, L);
  for (const a of o.actors || []) {
    if (!a) continue;
    const pose = L.cg && !a.pose.grade ? { ...a.pose, grade: L.cg } : a.pose;
    (a.who === 'girl' ? drawGirl : drawBoy)(fb, a.x - o.cam, a.y == null ? G : a.y, pose);
  }
  if (o.over) o.over(fb, L);
  world.drawFront(fb, o.t, o.cam, { look: L, camera: false, ...(o.front || {}) });
  if (o.top) o.top(fb, L);
}

// Fills the frame with `src` enlarged by a whole factor around (cx, cy).
function zoom(fb, src, scale, cx, cy) {
  const sw = Math.ceil(W / scale), sh = Math.ceil(H / scale);
  const sx = Math.max(0, Math.min(W - sw, Math.round(cx - sw / 2)));
  const sy = Math.max(0, Math.min(H - sh, Math.round(cy - sh / 2)));
  fb.blit(src, sx, sy, sw, sh, 0, 0, scale);
}

// Thin cream border that makes a frame read as a print, as in the opening.
function printBorder(fb) {
  const E = 0xf7f1e5;
  fb.rect(0, 0, W, 5, E); fb.rect(0, H - 5, W, 5, E); fb.rect(0, 0, 5, H, E); fb.rect(W - 5, 0, 5, H, E);
  fb.rect(5, 5, W - 10, 1, 0xd8cdb9); fb.rect(5, 5, 1, H - 10, 0xd8cdb9);
}

function lolly(fb, x, y, c) {
  fb.rect(x, y - 2, 1, 3, 0xe9c9a0);
  fb.rect(x - 1, y - 8, 3, 6, c); fb.rect(x - 1, y - 8, 1, 6, 0xffffff);
}

function snowman(fb, x, gy) {
  fb.ellipseA(x, gy, 9, 2, 0x1b1530, 0.25);
  fb.disc(x, gy - 7, 7, 0xffffff); fb.disc(x, gy - 18, 5, 0xffffff);
  fb.rect(x + 3, gy - 10, 3, 6, 0xdfe6f4); fb.rect(x + 2, gy - 20, 2, 4, 0xdfe6f4);
  fb.rect(x - 2, gy - 19, 1, 1, 0x2a1a1f); fb.rect(x + 1, gy - 19, 1, 1, 0x2a1a1f);
  fb.rect(x - 1, gy - 17, 3, 1, 0xf28a3a);
  fb.rect(x - 5, gy - 14, 10, 2, 0xd9574c); fb.rect(x + 2, gy - 12, 2, 3, 0xd9574c);
  fb.rect(x, gy - 9, 1, 1, 0x3d3a4a); fb.rect(x, gy - 6, 1, 1, 0x3d3a4a);
  fb.line(x - 7, gy - 10, x - 11, gy - 14, 0x5b3a2a); fb.line(x + 7, gy - 10, x + 11, gy - 14, 0x5b3a2a);
  fb.rect(x - 3, gy - 25, 6, 2, 0x34416a); fb.rect(x - 2, gy - 28, 4, 3, 0x34416a);
}

function umbrella(fb, x, y) {
  const C = 0xd9574c, D = 0xab3232, Hc = 0xf28a7c;
  for (let i = 0; i < 13; i++) {
    const half = Math.round(26 * Math.sqrt(1 - Math.pow((12 - i) / 13, 2)));
    fb.rect(x - half, y + i, half * 2 + 1, 1, C);
  }
  for (const dx of [-17, -8, 0, 8, 17]) fb.line(x, y, x + dx * 1.5, y + 12, D);
  fb.rect(x - 26, y + 12, 53, 1, D);
  for (let k = -3; k <= 2; k++) fb.rect(x + k * 9 + 2, y + 13, 5, 1, C);
  fb.rect(x - 14, y + 3, 6, 1, Hc); fb.rect(x - 19, y + 6, 4, 1, Hc);
  fb.rect(x, y - 3, 1, 3, 0x3d3a4a);
  fb.rect(x, y + 13, 1, 9, 0x3d3a4a);
}

const CAT = ['.O...O.', '.OO.OO.', 'OOOOOOO', 'OEOOOEO', 'OOOPOOO', '.OWWWO.', '.OOOOO.', 'OOOOOOO', 'OWOOOWO'];
const CAT_PAL = { O: 0xf2a04a, E: 0x2a1a1f, P: 0xf07a8a, W: 0xfff0e0 };

// The scenes behind the album's photos. Each returns what scene() needs.
const PHOTOS = {
  summer: {
    stamp: "'10 7 24", cam: 40, look: { season: 'summer', time: 'day', era: 0.1 },
    make: (t) => ({
      actors: [
        { who: 'girl', x: 187, pose: { eyes: 'happy', mouth: 'laugh', armR: 'hold', blush: 1, ...WEAR.summerG, bob: Math.floor(t * 2) % 2 } },
        { who: 'boy', x: 212, pose: { mouth: 'grin', armL: 'hold', eyes: Math.floor(t * 0.7) % 3 === 2 ? 'happy' : 'open', ...WEAR.summerB } },
      ],
      over: (fb) => { lolly(fb, 187 - 40, G - 22, 0x7fd0ff); lolly(fb, 212 - 40 - 2, G - 25, 0xff9ab0); },
    }),
  },
  fireworks: {
    stamp: "'11 8 13", cam: 40, look: { season: 'summer', time: 'night', era: 0.2 },
    make: (t) => ({
      mid: (fb) => {
        const shells = [[131, 92, 0xff9ab0, 0xffffff, 0], [190, 90, 0xffd98f, 0xfff6c0, 0.9], [160, 86, 0x9fe0ff, 0xffffff, 1.7]];
        for (const [x, y, c, c2, d] of shells) props.firework(fb, x, y, (t + d) % 2.2, { col: c, col2: c2, size: 12, seed: x, from: 100, fuse: 0.2, life: 1.6 });
      },
      actors: [
        { who: 'girl', x: 187, pose: { eyes: 'happy', mouth: 'laugh', armL: 'up', blush: 1 } },
        { who: 'boy', x: 212, pose: { eyes: 'happy', mouth: 'grin', armR: 'up', blush: 1 } },
      ],
    }),
  },
  autumn: {
    stamp: "'12 10 27", cam: 113, look: { season: 'autumn', time: 'sunset', era: 0.35 },
    make: (t) => ({
      back: { bench: 'wide' },
      actors: [
        { who: 'girl', x: 263, pose: { sit: true, eyes: 'happy', mouth: 'smile', arms: 'front', lean: 1, ...WEAR.autumnG } },
        { who: 'boy', x: 284, pose: { sit: true, mouth: 'smile', look: -1, eyes: Math.floor(t * 0.8) % 4 === 3 ? 'blink' : 'open', ...WEAR.autumnB } },
      ],
      over: (fb) => { fb.rect(284 - 113 - 2, G - 42, 4, 2, 0xd8762e); fb.rect(284 - 113 + 1, G - 43, 2, 1, 0xf2ac3e); },
    }),
  },
  winter: {
    stamp: "'13 12 24", cam: 40, look: { season: 'winter', time: 'dusk', era: 0.5 },
    make: (t) => ({
      actors: [
        { who: 'girl', x: 176, pose: { eyes: 'happy', mouth: 'laugh', armL: 'wave', wave: Math.floor(t * 3) % 2, blush: 2, ...WEAR.winterG } },
        { who: 'boy', x: 224, pose: { mouth: 'grin', armR: 'wave', wave: Math.floor(t * 3 + 1) % 2, blush: 2, ...WEAR.winterB } },
      ],
      over: (fb) => snowman(fb, 160, G),
    }),
  },
  rain: {
    stamp: "'15 4 19", cam: 40, look: { season: 'spring', time: 'dusk', era: 0.65 },
    make: (t) => ({
      mid: (fb) => props.rain(fb, t, 0xe4ecfa, 70, 0.55),
      actors: [
        { who: 'girl', x: 192, pose: { eyes: 'happy', mouth: 'smile', arms: 'front', lean: 1, blush: 1, ...WEAR.rainG } },
        { who: 'boy', x: 210, pose: { mouth: 'smile', look: -1, armL: 'none', armR: 'up' } },
      ],
      over: (fb) => umbrella(fb, 162, 86),
      front: { petals: false },
    }),
  },
  cat: {
    stamp: "'17 5 6", cam: 113, look: { season: 'spring', time: 'day', era: 0.85 },
    make: (t) => ({
      back: { bench: 'wide' },
      actors: [
        { who: 'girl', x: 263, pose: { sit: true, eyes: 'happy', mouth: 'laugh', arms: 'front', style: 'now' } },
        { who: 'boy', x: 284, pose: { sit: true, mouth: 'grin', look: -2, style: 'now', eyes: 'happy' } },
      ],
      over: (fb) => { const b = Math.floor(t * 1.5) % 2; fb.stamp(263 - 113 - 3, G - 30 + b, CAT, CAT_PAL); },
    }),
  },
};
const ORDER = ['summer', 'fireworks', 'autumn', 'winter', 'rain', 'cat'];

function createStage(ctx) {
  const fbs = new Map();
  const stamps = { first: ctx.cfg.stamp, now: ctx.cfg.stamp2 || '' };
  for (const id of ORDER) stamps[id] = PHOTOS[id].stamp;

  // Renders photo `id` as it looks at time t (the photos are alive) and returns its buffer.
  function photo(id, t) {
    if (id === 'first') return ctx.opening.firstPhoto();
    let f = fbs.get(id);
    if (!f) { f = new FB(W, H); fbs.set(id, f); }
    if (f.at === t) return f;
    if (id === 'now') nowPhoto(f, t);
    else {
      const p = PHOTOS[id];
      scene(f, { t, cam: p.cam, look: world.look(p.look), ...p.make(t) });
    }
    f.at = t;
    return f;
  }

  // Today's photo: the same spot, standing close.
  function nowPhoto(f, t) {
    const look = world.look({ season: 'spring', time: 'sunset', era: 1 });
    scene(f, {
      t, cam: 40, look,
      actors: [
        { who: 'boy', x: 209, pose: { style: 'now', eyes: 'happy', mouth: 'grin', blush: 1, armL: 'none' } },
        { who: 'girl', x: 191, pose: { style: 'now', eyes: 'happy', mouth: 'laugh', blush: 1, lean: 2, arms: 'front' } },
      ],
      over: (fb) => {
        // his arm around her shoulder
        fb.rect(191 - 40 - 10, G - 44 + 18, 4, 3, SKIN); fb.rect(191 - 40 - 10, G - 44 + 20, 4, 1, 0xe8b49b);
      },
    });
  }

  return { photo, stamps, order: ORDER };
}

module.exports = { createStage, scene, zoom, printBorder, WEAR, PHOTOS, ORDER, snowman, umbrella, lolly, CAT, CAT_PAL };
