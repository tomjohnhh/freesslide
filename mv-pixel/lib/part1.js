'use strict';
// Beats 16-82: today, at the desk, the old photo turns up; the first chorus runs through
// what it brings back; in the interlude the two of them set out for the riverside.
// Shot boundaries are in beats of the song.

const { bayer } = require('./fb');
const { text, measure } = require('./font');
const { drawGirl, drawBoy } = require('./chars');
const world = require('./world');
const props = require('./props');
const U = require('./util');
const { INK, clamp, lerp, easeOut, easeIn, easeInOut, easeBack, arc } = U;
const { createStage, scene, zoom, printBorder, WEAR } = require('./stage');

const W = 320;
const H = 180;
const G = world.GROUND;

function dissolve(fb, other, k) {
  const lv = k * 16;
  if (lv <= 0) return;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x, y) < lv) fb.set(x, y, other.get(x, y));
}

function miniPolaroid(fb, x, y) {
  fb.rect(x - 1, y - 1, 11, 13, 0x3a2a40);
  fb.rect(x, y, 9, 11, 0xf7f1e5);
  fb.rect(x + 1, y + 1, 7, 3, 0xf7b06e); fb.rect(x + 1, y + 4, 7, 1, 0x8a5f8f); fb.rect(x + 1, y + 5, 7, 2, 0x4a6950);
  fb.set(x + 3, y + 4, 0xbb4a41); fb.set(x + 5, y + 4, 0x82abde); fb.set(x + 3, y + 3, 0x4d2f2c); fb.set(x + 5, y + 3, 0x252a42);
}

function mug(fb, x, y, t, steam = true) {
  fb.rect(x, y, 8, 8, 0xf4ecdc); fb.rect(x, y, 8, 1, 0xffffff); fb.rect(x + 6, y + 1, 2, 7, 0xd8cdb9);
  fb.rect(x + 8, y + 2, 2, 1, 0xf4ecdc); fb.rect(x + 9, y + 3, 1, 2, 0xf4ecdc); fb.rect(x + 8, y + 5, 2, 1, 0xf4ecdc);
  fb.rect(x + 1, y + 3, 4, 2, 0xd9574c);
  if (steam) {
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.45 + i * 0.5) % 1;
      const sx = x + 2 + i * 3 + Math.round(Math.sin(ph * 6.28 + i) * 1.5);
      if (ph < 0.85) { fb.blend(sx, y - 2 - Math.round(ph * 14), 0xffffff, 0.6 * (1 - ph)); fb.blend(sx, y - 3 - Math.round(ph * 14), 0xffffff, 0.4 * (1 - ph)); }
    }
  }
}

// things standing on the room's desk (its top edge is at y = 118)
function deskItems(fb, t, o = {}) {
  // pencil cup
  fb.rect(60, 108, 9, 10, 0x5c82ba); fb.rect(60, 108, 9, 1, 0x82abde); fb.rect(67, 109, 2, 9, 0x3d5a8a);
  fb.rect(62, 100, 1, 8, 0xf4c34f); fb.rect(64, 98, 1, 10, 0xd9574c); fb.rect(66, 101, 1, 7, 0x4a8a72); fb.rect(62, 99, 1, 1, 0x3d3a4a);
  // the album, lying closed
  if (o.album !== false) {
    const ax = o.albumX == null ? 196 : o.albumX;
    fb.rect(ax, 112, 38, 6, 0x2f6052); fb.rect(ax, 112, 38, 1, 0x4a8a72); fb.rect(ax + 1, 116, 37, 1, 0xf1e9d8); fb.rect(ax, 117, 38, 1, 0x1f4339);
    fb.rect(ax + 30, 118, 2, 4, 0xd9574c);
  }
  if (o.mug !== false) mug(fb, o.mugX == null ? 244 : o.mugX, 110, t);
  if (o.mug2 != null) mug(fb, o.mug2, 110, t);
}

function wall(fb, t) {
  fb.vgrad(0, 0, W, H, [[0, 0x2a2440], [1, 0x3c3254]], 4);
  for (let y = 6; y < H; y += 12) for (let x = ((y / 12) & 1) * 8 + 4; x < W; x += 16) { fb.set(x, y, 0x473c62); fb.set(x + 1, y + 1, 0x33294a); }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 160) / 240, (y - 80) / 150);
      if (d > 0.42) fb.blend(x, y, 0x0c0a1c, Math.min(5, Math.floor((d - 0.42) * 11)) * 0.09);
      else if (d < 0.3) fb.blend(x, y, 0xffc98a, d < 0.16 ? 0.12 : 0.06);
    }
  }
  void t;
}

function bang(fb, x, y, u, ch = '!') {
  if (u < 0) return;
  const k = easeBack(u / 0.18);
  const yy = Math.round(y - 4 * k);
  text(fb, ch, x, yy, 0xfff6e0, { align: 'center', outline: INK });
}

const DOODLES = {
  sun: ['..Y..', 'Y.Y.Y', '.YYY.', 'Y.Y.Y', '..Y..'],
  star: ['..Y..', '.YYY.', 'YYYYY', '.YYY.', '.Y.Y.'],
  leaf: ['...O.', '..OO.', '.OOO.', 'OOO..', 'O....'],
  flake: ['B.B.B', '.BBB.', 'BBBBB', '.BBB.', 'B.B.B'],
  drop: ['..B..', '..B..', '.BBB.', 'BBBBB', '.BBB.'],
  paw: ['.P.P.', 'P.P.P', '.PPP.', 'PPPPP', '.PPP.'],
  heart: ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..'],
  note: ['..BB.', '..B..', '..B..', 'BBB..', 'BBB..'],
};
const DOODLE_PAL = { Y: 0xe8a83a, O: 0xd8762e, B: 0x5c82ba, P: 0xb86a4a, R: 0xd9574c };
const PAGE_DOODLE = { summer: ['sun', 'heart', 'sun'], fireworks: ['star', 'note', 'star'], autumn: ['leaf', 'heart', 'leaf'], winter: ['flake', 'heart', 'flake'], rain: ['drop', 'heart', 'drop'], cat: ['paw', 'heart', 'paw'], first: ['heart', 'star', 'heart'], now: ['heart', 'heart', 'heart'] };

function create(ctx) {
  const { cfg, P, O, off, off2, snap, cell } = ctx;
  const stage = ctx.stage || (ctx.stage = createStage(ctx));
  const bob = (t, len = 0.2) => (ctx.onBeat(t, len) ? 1 : 0);
  const shots = [];
  const add = (from, to, draw, extra) => shots.push({ from, to, draw, ...(extra || {}) });

  // ---- album pages (shared with part 2 through ctx.album) ----------------------------

  // spec: { id, develop, corners, title, y } | null (blank page)
  function pageContent(fb, side, spec, t) {
    const p = props.pagePaper(fb, side);
    if (!spec) return p;
    const px = p.x + ((p.w - 104) >> 1), py = p.y + 9 + (spec.dy || 0);
    if (spec.corners) {
      for (let x = px + 6; x < px + 98; x += 6) { fb.rect(x, py + 3, 3, 1, 0xd8cdb9); fb.rect(x, py + 88, 3, 1, 0xd8cdb9); }
      for (let y = py + 6; y < py + 88; y += 6) { fb.rect(px + 3, y, 1, 3, 0xd8cdb9); fb.rect(px + 100, y, 1, 3, 0xd8cdb9); }
    }
    if (spec.id && spec.show !== false) {
      const src = stage.photo(spec.id, t);
      props.polaroid(fb, px, py, src, props.MID, { m: 4, bottom: 16, tape: !spec.corners, tapeCol: spec.tapeCol, develop: spec.develop });
      const label = spec.title ? cfg.title : stage.stamps[spec.id];
      if (label) text(fb, label, px + 52, py + 78, 0x3d4a78, { align: 'center', chars: spec.chars });
    }
    if (spec.corners) props.photoCorners(fb, px + 1, py + 1, 102, 90, 0x3d4a66);
    const d = PAGE_DOODLE[spec.id];
    if (d && spec.doodle !== false) {
      d.forEach((name, i) => fb.stamp(p.x + 38 + i * 16, p.y + 112, DOODLES[name], DOODLE_PAL));
      for (let x = 0; x < 60; x += 2) fb.set(p.x + 29 + x, p.y + 121 + (Math.floor(x / 4) % 2), 0x9aa6c4);
    }
    return p;
  }

  // The open album with a page turning from right to left: k = 0 shows (oldL, oldR), k = 1 (newL, newR).
  function spread(fb, t, oldL, oldR, newL, newR, k) {
    const A = props.ALBUM;
    props.albumBase(fb);
    if (!(k > 0)) { pageContent(fb, 'L', oldL, t); pageContent(fb, 'R', oldR, t); return; }
    if (k >= 1) { pageContent(fb, 'L', newL, t); pageContent(fb, 'R', newR, t); return; }
    pageContent(fb, 'L', oldL, t);
    const p = pageContent(fb, 'R', newR, t);
    const c = Math.cos(k * Math.PI);
    if (c > 0) {
      const w = Math.max(1, Math.round(A.pageW * c));
      fb.rectA(A.gutter + w, p.y, 10, p.h, 0x3a2a20, 0.28);
      fb.clip(A.gutter, p.y, w, p.h);
      pageContent(fb, 'R', oldR, t);
      fb.unclip();
      fb.rectA(A.gutter, p.y, w, p.h, 0x8a7a66, 0.1 + 0.3 * (1 - c));
      fb.rect(A.gutter + w - 1, p.y, 1, p.h, 0xfffaf0);
    } else {
      const w = Math.max(1, Math.round(A.pageW * -c));
      fb.rectA(A.gutter - w - 10, p.y, 10, p.h, 0x3a2a20, 0.28);
      fb.clip(A.gutter - w, p.y, w, p.h);
      pageContent(fb, 'L', newL, t);
      fb.unclip();
      fb.rectA(A.gutter - w, p.y, w, p.h, 0x8a7a66, 0.1 + 0.3 * (1 + c));
      fb.rect(A.gutter - w, p.y, 1, p.h, 0xfffaf0);
    }
  }

  function closedBook(fb, x0) {
    const A = props.ALBUM;
    const w = A.pageW + 6;
    fb.rectA(x0 + 5, A.y + 6, w, A.h, 0x1a0c12, 0.42);
    fb.rect(x0, A.y + 3, w + 2, A.h - 3, 0xe3d9c4); fb.rect(x0 + w, A.y + 6, 2, A.h - 8, 0xcfc4ad);
    fb.rect(x0, A.y, w, A.h - 2, 0x2f6052);
    fb.rect(x0, A.y, w, 2, 0x4a8a72); fb.rect(x0, A.y, 2, A.h - 2, 0x4a8a72);
    fb.rect(x0 + w - 2, A.y + 2, 2, A.h - 4, 0x1f4339); fb.rect(x0 + 2, A.y + A.h - 4, w - 2, 2, 0x1f4339);
    fb.rect(x0 + 8, A.y, 3, A.h - 2, 0x26503f);
    fb.rect(x0 + 16, A.y + 8, w - 28, 1, 0x4a8a72); fb.rect(x0 + 16, A.y + A.h - 12, w - 28, 1, 0x4a8a72);
    fb.rect(x0 + 34, A.y + 44, 60, 30, 0xf1e9d8); fb.rect(x0 + 34, A.y + 44, 60, 1, 0xcfc4ad); fb.rect(x0 + 36, A.y + 46, 56, 26, 0xf7f1e5);
    text(fb, '相册', x0 + 64, A.y + 52, 0x3d4a66, { align: 'center' });
    fb.rect(x0 + 96, A.y + A.h - 2, 4, 14, 0xd9574c); fb.rect(x0 + 96, A.y + A.h + 10, 2, 2, 0x6f4a3a);
  }

  // Cover opening: k = 0 closed (book on the right half), k = 1 open at (L, R).
  function openBook(fb, t, L, R, k) {
    const A = props.ALBUM;
    if (!(k > 0)) { closedBook(fb, A.gutter - 2); return; }
    if (k >= 1) { spread(fb, t, L, R, L, R, 0); return; }
    const c = Math.cos(k * Math.PI);
    if (c > 0) {
      closedBook(fb, A.gutter - 2);
      const p = props.pageRect('R');
      const w = Math.max(1, Math.round((A.pageW + 4) * c));
      fb.clip(A.gutter + w, A.y, A.pageW + 8 - w, A.h);
      fb.rect(A.gutter, A.y + 3, A.pageW + 6, A.h - 5, 0xe3d9c4);
      pageContent(fb, 'R', R, t);
      fb.unclip();
      fb.rectA(A.gutter + w, p.y, 8, p.h, 0x3a2a20, 0.3);
      fb.rectA(A.gutter, A.y, w, A.h - 2, 0x0c1a14, 0.35 * (1 - c));
    } else {
      const w = Math.max(1, Math.round((A.pageW + 4) * -c));
      fb.clip(A.gutter - w - 4, 0, W, H);
      spread(fb, t, L, R, L, R, 0);
      fb.unclip();
      // the inside of the cover, still swinging down
      fb.rectA(A.gutter - w - 4, A.y, w + 4, A.h, 0x8a7a66, 0.34 * (1 + c));
    }
  }
  ctx.album = { pageContent, spread, closedBook, openBook };

  // ---- 16-20: the room; he is holding the photo ------------------------------------

  const homeBoy = (pose) => ({ ...WEAR.homeB, shadow: false, ...pose });
  const homeGirl = (pose) => ({ ...WEAR.homeG, shadow: false, ...pose });

  add(16, 20, (fb, t, b) => {
    const close = b >= 2;
    const eyes = b < 0.9 ? 'down' : b < 1.05 ? 'blink' : b < 2 ? 'down' : b < 3 ? 'open' : b < 3.12 ? 'blink' : 'down';
    const pose = homeBoy({ armL: 'hold', armR: 'hold', eyes, look: b >= 2 && b < 3 ? -2 : 0, mouth: b >= 3.2 ? 'smile' : 'small' });
    const target = close ? off : fb;
    props.room(target, t, {
      clock: Math.floor(ctx.beat(t)),
      actors: (f) => { drawBoy(f, 151, 132, pose); miniPolaroid(f, 146, 102); },
      items: (f) => deskItems(f, t),
    });
    if (close) zoom(fb, off, 2, 144, 92);
  });

  // ---- 20-24: the same view through the years --------------------------------------

  const LAPSE = [
    ['spring', 'sunset', 0, "'09"], ['summer', 'day', 0.15, "'10"], ['autumn', 'sunset', 0.3, "'11"], ['winter', 'dusk', 0.45, "'13"],
    ['spring', 'day', 0.6, "'14"], ['summer', 'night', 0.75, "'16"], ['autumn', 'dusk', 0.9, "'17"], ['winter', 'night', 1, "'19"],
  ];
  add(20, 24, (fb, t, b) => {
    const i = Math.min(7, Math.floor(b * 2));
    const k = (b * 2) % 1;
    const tt = t * 3;
    const draw = (f, j) => {
      const [season, time, era] = LAPSE[j];
      const look = world.look({ season, time, era });
      world.drawBack(f, tt, 40, { look });
      world.drawFront(f, tt, 40, { look, camera: false });
    };
    draw(fb, i);
    if (i > 0 && k < 0.36) { draw(off, i - 1); dissolve(fb, off, 1 - k / 0.36); }
    const pop = k < 0.16 ? 2 : 1;
    const label = LAPSE[i][3];
    if (pop === 2) text(fb, label, W - 12 - measure(label, { scale: 2 }), 6, 0xffa63d, { scale: 2, outline: 0x7a3a1a });
    else text(fb, label, W - 12, 8, 0xffa63d, { align: 'right', outline: 0x7a3a1a });
    // fast-forward mark
    for (const ox of [0, 8]) for (let r = 0; r < 5; r++) { fb.rect(12 + ox + r, 10 + r, 1, 11 - r * 2, INK); }
    for (const ox of [0, 8]) for (let r = 0; r < 4; r++) { fb.rect(13 + ox + r, 12 + r, 1, 7 - r * 2, 0xffffff); }
  });

  // ---- 24-28: the album opens; pages turn -------------------------------------------

  const SPREADS = [[{ id: 'summer' }, { id: 'fireworks', tapeCol: 0xf29aa6 }], [{ id: 'autumn', tapeCol: 0x9fd0b0 }, { id: 'winter', tapeCol: 0x9fc4f0 }], [{ id: 'rain', tapeCol: 0xf29aa6 }, { id: 'cat' }]];
  const LAST = [{ id: 'first', corners: true, show: false, doodle: false }, null];

  add(24, 28, (fb, t, b) => {
    props.desk(fb, t, { book: false, tea: false, pencil: false });
    if (b < 1) openBook(fb, t, SPREADS[0][0], SPREADS[0][1], easeInOut((b - 0.25) / 0.6));
    else if (b < 2.9) spread(fb, t, SPREADS[0][0], SPREADS[0][1], SPREADS[1][0], SPREADS[1][1], easeInOut((b - 2) / 0.55));
    else spread(fb, t, SPREADS[1][0], SPREADS[1][1], SPREADS[2][0], SPREADS[2][1], easeInOut((b - 3) / 0.55));
  });

  // ---- 28-32: a loose photo slips out; he goes quiet --------------------------------

  add(28, 32, (fb, t, b, u) => {
    if (b < 1.7) {
      props.desk(fb, t, { book: false, tea: false, pencil: false });
      spread(fb, t, SPREADS[2][0], SPREADS[2][1], LAST[0], LAST[1], easeInOut(b / 0.5));
      // the loose print slides off the page
      if (b > 0.3) {
        const k = easeIn((b - 0.45) / 1.15);
        const px = Math.round(lerp(170, 150, k) + Math.sin(b * 5) * 3 * (1 - k));
        const py = Math.round(lerp(26, 132, k));
        props.polaroid(fb, px, py, stage.photo('first'), props.MID, { m: 4, bottom: 16, tape: false });
      }
      return;
    }
    const v = b - 1.7;
    props.backdrop(fb, t, 0x1c2244, 0x2a3260);
    const slide = easeOut(v / 0.3);
    const eyes = Math.abs(v - 0.9) < 0.07 || Math.abs(v - 1.9) < 0.07 ? 'blink' : 'down';
    props.panel(fb, cell, Math.round(lerp(-160, 10, slide)), 8, 'boy', homeBoy({ eyes, look: 2, mouth: 'small', shadow: false }), t * 0.4, { bgA: 0x7f8fc0, bgB: 0x93a3d0 });
    // the photo, alive again
    const px = Math.round(lerp(W + 10, 184, slide));
    liveFirst(off, t, {});
    props.polaroid(fb, px, 18, off, props.PH, {});
    props.photoCaption(fb, px, 18, 124, props.PH.h, cfg.title, 99);
    // "..." over his head
    if (v > 0.5) {
      const bx = 118, by = 12;
      U.bubble(fb, bx, by, 34, 15, { tail: bx + 8, tailDir: -1 });
      for (let i = 0; i < 3; i++) if (v > 0.6 + i * 0.4) fb.rect(bx + 7 + i * 8, by + 6, 3, 3, INK);
    }
  });

  // The first photo's scene, moving: what he sees when he looks at it.
  function liveFirst(f, t, o) {
    const bb = bob(t, 0.25);
    const wave = o.wave;
    world.drawBack(f, t, 40);
    drawGirl(f, 187 - 40, G, { arms: wave ? 'down' : 'front', armR: wave ? 'wave' : 'down', wave: Math.floor(t * 4) % 2, eyes: o.eyesG || 'happy', blush: 1, mouth: 'smile', bob: bb, look: o.look || 0 });
    drawBoy(f, 212 - 40, G, { mouth: 'grin', blush: 1, bob: bb, armL: wave ? 'wave' : 'down', wave: Math.floor(t * 4 + 1) % 2, look: o.look || 0, eyes: o.eyesB || 'open' });
    world.drawFront(f, t, 40, { camera: false });
  }
  ctx.liveFirst = liveFirst;

  // ---- 32-36: how long has it been - the calendar runs backwards --------------------

  const TEARS = [0.4, 0.8, 1.15, 1.5, 1.8, 2.1, 2.35, 2.6, 2.8, 3.0];
  add(32, 36, (fb, t, b) => {
    wall(fb, t);
    let n = 0;
    for (const tb of TEARS) if (b >= tb) n++;
    const cx = 160, x0 = 106, y0 = 12;
    // backing board and binder
    fb.rectA(x0 + 5, y0 + 6, 108, 136, 0x0c0a1c, 0.45);
    fb.rect(x0, y0, 108, 136, 0x5a3c34); fb.rect(x0, y0, 108, 2, 0x7a5646); fb.rect(x0 + 106, y0, 2, 136, 0x3a2622);
    fb.rect(x0 + 4, y0 + 6, 100, 12, 0xc9c9d6); fb.rect(x0 + 4, y0 + 6, 100, 2, 0xeeeef6); fb.rect(x0 + 4, y0 + 16, 100, 2, 0x8a8aa0);
    for (const rx of [x0 + 28, x0 + 76]) { fb.rect(rx, y0 - 3, 4, 14, 0x8a8aa0); fb.rect(rx + 1, y0 - 3, 2, 14, 0xeeeef6); }
    // the pad of pages gets thinner as the years go
    const pad = 10 - n;
    for (let i = pad; i >= 1; i--) fb.rect(x0 + 6 + (i % 2), y0 + 18 + 108 + i, 96, 1, i % 2 ? 0xd8cdb9 : 0xf4ecda);
    const page = (px, py, year, a = 1) => {
      fb.rect(px, py, 96, 108, 0xf7f1e5);
      fb.rect(px, py, 96, 18, 0xd9574c); fb.rect(px, py + 17, 96, 1, 0xab3232);
      text(fb, '8月', px + 48, py + 3, 0xffffff, { align: 'center' });
      const ys = String(year);
      const w = measure(ys, { scale: 3 });
      text(fb, ys, px + 48 - Math.round(w / 2), py + 26, 0x2c2f48, { scale: 3 });
      text(fb, '18日', px + 48, py + 70, 0x8a7a8a, { align: 'center' });
      fb.rect(px + 20, py + 88, 56, 1, 0xd8cdb9); fb.rect(px + 28, py + 94, 40, 1, 0xd8cdb9);
      fb.rect(px + 95, py, 1, 108, 0xd8cdb9);
      void a;
    };
    page(x0 + 6, y0 + 18, 2019 - n);
    // pages already torn off, fluttering away
    for (let j = 0; j < n; j++) {
      const a = (b - TEARS[j]) * P;
      if (a > 1.5) continue;
      const dir = j % 2 ? -1 : 1;
      if (a < 0.14) {
        // lifting off the pad
        const k = a / 0.14;
        fb.clip(0, 0, W, y0 + 18 + 108);
        page(x0 + 6 + Math.round(dir * k * 10), y0 + 18 - Math.round(k * 16), 2019 - j);
        fb.unclip();
      } else {
        const v = a - 0.14;
        const px = cx + dir * (30 + v * (120 + world.hash(j, 5) * 50));
        const py = y0 + 30 - v * 90 + v * v * 170;
        const flap = Math.abs(Math.cos(v * 13 + j));
        const w = Math.max(3, Math.round(34 * flap)), h = 26;
        fb.rectA(px - w / 2 + 3, py + 4, w, h, 0x0c0a1c, 0.3);
        fb.rect(px - w / 2, py, w, h, flap > 0.5 ? 0xf7f1e5 : 0xe3d9c4);
        fb.rect(px - w / 2, py, w, 5, 0xd9574c);
      }
    }
    if (n >= 10) {
      // the day it started: circled in red
      const k = clamp((b - 3.05) / 0.3);
      const rx = 34, ry = 11, ox = x0 + 6 + 48, oy = y0 + 18 + 77;
      for (let i = 0; i < 64 * k; i++) {
        const th = (i / 64) * 6.283 - 1.2;
        fb.rect(Math.round(ox + Math.cos(th) * rx), Math.round(oy + Math.sin(th) * ry), 2, 1, 0xd9574c);
      }
      if (b > 3.35) U.heart(fb, x0 + 90, y0 + 84, 0xe5504a);
    }
  });

  // ---- 36-40: how it started ---------------------------------------------------------

  const SPRING_DAY = world.look({ season: 'spring', time: 'day', era: 0 });
  function meetCute(fb, t, b) {
    const step = Math.floor(t / 0.11);
    const gk = clamp(b / 1.6);
    const girl = { who: 'girl', x: Math.round(lerp(92, 178, gk)), pose: {} };
    const boy = { who: 'boy', x: 214, pose: {} };
    let hop = 0;
    if (gk < 1) girl.pose = { walk: step, dir: 1, armL: 'up', armR: 'up', mouth: 'open', look: 2, eyes: 'wide' };
    else if (b < 2) girl.pose = { look: 2, mouth: 'open', bob: Math.floor(t * 5) % 2 };
    else if (b < 2.6) girl.pose = { look: 2, mouth: 'small', blush: b > 2.3 ? 1 : 0, eyes: 'wide' };
    else if (b < 3) girl.pose = { arms: 'front', look: 1, mouth: 'smile', blush: 1 };
    else girl.pose = { arms: 'front', look: -1, eyes: 'down', mouth: 'wavy', blush: 2, bob: bob(t) };

    if (b < 0.5) boy.pose = { look: -1 };
    else if (b < 0.85) boy.pose = { look: -2, eyes: 'wide', mouth: 'open' };
    else if (b < 2) {
      const k = (b - 0.85) / 0.4;
      hop = k < 1 ? Math.round(arc(k) * 9) : 0;
      boy.pose = { look: b > 1.4 ? -2 : -1, armL: 'up', mouth: b > 1.3 ? 'smile' : 'open', eyes: k < 1 ? 'wide' : 'open' };
    } else if (b < 2.6) boy.pose = { look: -2, armL: 'out', mouth: 'smile', blush: b > 2.3 ? 1 : 0 };
    else if (b < 3) boy.pose = { look: -2, mouth: 'small', blush: 1, eyes: 'wide' };
    else boy.pose = { look: 2, arms: 'head', mouth: 'wavy', blush: 2, bob: bob(t) };
    boy.y = G - hop;

    // the sheet of paper that the wind took
    let px, py;
    const flap = Math.floor(t * 12) % 2;
    if (b < 1) { px = lerp(128, 204, b); py = 112 - Math.sin(b * Math.PI) * 26 - b * 10 + Math.sin(b * 16) * 3; }
    else if (b < 2) { px = 204; py = G - hop - 51; }
    else if (b < 2.6) { px = 196; py = 118; }
    else { px = 175; py = 125; }
    scene(fb, {
      t, cam: 40, look: SPRING_DAY, actors: [girl, boy],
      over: (f) => {
        const sx = Math.round(px - 40), sy = Math.round(py);
        f.rect(sx - 1, sy - 1, 8, flap && b < 1 ? 5 : 7, 0x8a8aa0);
        f.rect(sx, sy, 6, flap && b < 1 ? 3 : 5, 0xffffff);
        if (!(flap && b < 1)) { f.rect(sx + 1, sy + 1, 4, 1, 0xf29aa6); f.rect(sx + 1, sy + 3, 3, 1, 0x9fc4f0); }
      },
      top: (f) => {
        if (b >= 2 && b < 3) bang(f, 178 - 40, 92, (b - 2) * P);
        if (b >= 2.3 && b < 3) bang(f, 214 - 40, 88, (b - 2.3) * P);
        if (b >= 3.3) U.heart(f, 156 - 3, Math.round(112 - (b - 3.3) * 22), 0xe5504a);
      },
    });
  }
  ctx.meetCute = meetCute;
  add(36, 40, (fb, t, b) => {
    meetCute(fb, t, b);
    printBorder(fb);
    props.dateStamp(fb, W - 12, 8, "'09 3 14");
  });

  // ---- 40-44: tipsy by the river, singing -------------------------------------------

  const SUMMER_NIGHT = world.look({ season: 'summer', time: 'night', era: 0.1 });
  const BENCH_CAM = 113;
  function canAt(fb, x, y, look) {
    const pal = {};
    for (const k of Object.keys(U.CAN_PAL)) pal[k] = look.cg ? look.cg(U.CAN_PAL[k]) : U.CAN_PAL[k];
    fb.stamp(x, y, U.CAN, pal);
  }
  // who: 'then' | 'now'; both sitting on the bench, singing. opts: { both, style }
  function singing(fb, t, look, o = {}) {
    const B = ctx.beat(t);
    const sway = Math.floor(B) % 2 ? 1 : -1;
    const half = Math.floor(B * 2) % 2;
    const st = o.style ? { style: o.style } : {};
    const girl = { who: 'girl', x: 263, pose: { sit: true, eyes: 'happy', mouth: o.both ? (half ? 'sing' : 'laugh') : (half ? 'laugh' : 'smile'), blush: 2, armR: 'hold', lean: o.both ? sway : 0, bob: bob(t), ...st } };
    const boy = { who: 'boy', x: 284, pose: { sit: true, eyes: 'happy', mouth: half ? 'shout' : 'sing', blush: 2, armR: 'up', lean: sway, ...st } };
    scene(fb, {
      t, cam: BENCH_CAM, look, back: { bench: 'wide' }, actors: [girl, boy],
      over: (f, L) => {
        canAt(f, 284 - BENCH_CAM + 8, G - 47 + 7 - 5, L);
        canAt(f, 263 - BENCH_CAM - 1, G - 44 + 4 + 17, L);
        // empties on the ground
        canAt(f, 204, G - 6, L); f.rect(214, G - 3, 7, 4, L.cg ? L.cg(0x5fb07a) : 0x5fb07a); f.rect(214, G - 3, 2, 4, L.cg ? L.cg(0xb9c2d0) : 0xb9c2d0);
      },
    });
  }
  ctx.singing = singing;
  add(40, 44, (fb, t, b, u) => {
    singing(off, t, SUMMER_NIGHT);
    if (b < 2) { fb.copyFrom(off); props.notes(fb, 284 - BENCH_CAM + 10, 104, u, 4, 1); }
    else { zoom(fb, off, 2, 162, 112); props.notes(fb, 200, 78, u, 5, 1); }
    printBorder(fb);
    props.dateStamp(fb, W - 12, 8, "'10 8 21");
  });

  // ---- 44-48: "I'll love you forever" - he said it out loud --------------------------

  const SHELLS = [[0.55, 104, 40, 0xff9ab0, 0xffffff, false], [1.55, 216, 34, 0xff5a6a, 0xffb0b8, true], [2.55, 150, 48, 0xffd98f, 0xfff6c0, false], [3.05, 250, 52, 0x9fe0ff, 0xffffff, false], [3.45, 70, 54, 0xc9a0ff, 0xffffff, false]];
  // who shouts: 'boy' | 'girl'; returns nothing, draws the wide scene into f.
  function confession(f, t, b, look, o = {}) {
    const st = o.style ? { style: o.style } : {};
    const shouter = o.who || 'boy';
    const answered = o.answer != null && b >= o.answer;
    const girl = { who: 'girl', x: 263, pose: {} };
    const boy = { who: 'boy', x: 285, pose: {} };
    const shoutPose = (dir) => ({ look: dir * 2, armL: 'up', armR: 'up', mouth: Math.floor(b * 4) % 2 ? 'shout' : 'sing', eyes: 'shut', blush: 2, bob: bob(t) });
    const hearPose = (dir) => (b < 0.35 ? { sit: true, look: dir * 2, mouth: 'smile', blush: 1 } : b < 1 ? { sit: true, look: dir * 2, eyes: 'wide', mouth: 'open', blush: 2 } : { sit: true, arms: 'cheeks', armL: 'none', eyes: b > 2 ? 'happy' : 'wide', mouth: b > 2 ? 'smile' : 'wavy', blush: 3, look: dir });
    if (shouter === 'boy') {
      boy.pose = { ...shoutPose(-1), ...st };
      girl.pose = answered ? { ...shoutPose(1), ...st } : { ...hearPose(1), ...st };
      if (answered) girl.pose.sit = false;
    } else {
      girl.pose = { ...shoutPose(1), ...st };
      const hp = hearPose(-1);
      // the boy has no hands-on-cheeks pose: he scratches his head instead
      if (hp.arms === 'cheeks') { hp.arms = 'head'; delete hp.armL; }
      boy.pose = answered ? { ...shoutPose(-1), ...st } : { ...hp, ...st };
      if (answered) boy.pose.sit = false;
    }
    let glow = 0, glowCol = 0;
    scene(f, {
      t, cam: BENCH_CAM, look, back: { bench: 'wide' }, actors: [girl, boy],
      mid: (g) => {
        for (const [tb, x, y, c, c2, heart] of o.shells || SHELLS) {
          const gl = props.firework(g, x, y, (b - tb) * P, { col: c, col2: c2, heart, size: heart ? 22 : 26, seed: x });
          if (gl > glow) { glow = gl; glowCol = c; }
        }
      },
    });
    if (glow > 0) f.wash(glowCol, 0.1 * glow);
    return { glow, glowCol };
  }
  ctx.confession = confession;
  function heartBubble(fb, x, y, u, dir = 1) {
    if (u < 0) return;
    const k = easeBack(u / 0.2);
    const w = Math.round(30 * k), h = Math.round(24 * k);
    if (w < 8) return;
    const sh = u < 0.3 ? (Math.floor(u * 40) % 2 ? 1 : -1) : 0;
    U.bubble(fb, x - (w >> 1) + sh, y - h, w, h, { tail: x - 2 + dir * 4, tailDir: dir });
    if (k > 0.9) fb.stamp(x - 6 + sh, y - h + 7, U.HEART_BIG, { X: Math.floor(u * 3) % 2 ? 0xe5504a : 0xff6a74, H: 0xffb0b8 });
  }
  ctx.heartBubble = heartBubble;
  add(44, 48, (fb, t, b, u) => {
    if (b < 3) {
      confession(fb, t, b, SUMMER_NIGHT);
      heartBubble(fb, 285 - BENCH_CAM - 14, 98, u - 0.12, 1);
    } else {
      confession(off, t, b, SUMMER_NIGHT);
      zoom(fb, off, 2, 162, 110);
      U.risingHearts(fb, 156, 84, u - 3 * P, 4, { rise: 60, spread: 22, outline: INK });
    }
    printBorder(fb);
    props.dateStamp(fb, W - 12, 8, "'10 8 21");
  });

  // ---- 48-52: the years, one print per beat ----------------------------------------

  const DROPS = [['summer', 84, 4, 0xf6d06a], ['fireworks', 180, 12, 0xf29aa6], ['autumn', 98, 52, 0x9fd0b0], ['winter', 190, 58, 0x9fc4f0]];
  function dropPrint(fb, t, id, x, y, u, tapeCol, big) {
    if (u < 0) return;
    const k = easeBack(u / 0.34);
    const py = Math.round(lerp(-120, y, k));
    props.polaroid(fb, x, py, stage.photo(id, t), props.MID, { m: 4, bottom: 16, tapeCol });
    const label = stage.stamps[id];
    if (label) text(fb, label, x + 52, py + 78, 0x3d4a78, { align: 'center' });
    if (u > 0.3 && u < 0.75) {
      for (let i = 0; i < 5; i++) U.sparkle(fb, Math.round(x + 52 + Math.cos(i * 1.26 + x) * (58 + u * 20)), Math.round(y + 46 + Math.sin(i * 1.26 + x) * (50 + u * 16)), u < 0.5 ? 2 : 1, 0xfff6d0);
    }
    void big;
  }
  ctx.dropPrint = dropPrint;
  add(48, 52, (fb, t, b) => {
    const land = DROPS.some((d, i) => { const u = (b - i) * P; return u > 0.3 && u < 0.38; });
    props.desk(fb, t);
    if (land) fb.oy = 1;
    DROPS.forEach(([id, x, y, tc], i) => dropPrint(fb, t, id, x, y, (b - i) * P, tc));
    fb.oy = 0;
  });

  // ---- 52-57: tears and laughter, both understood ----------------------------------

  function cryLaugh(fb, t, b, u, o = {}) {
    const st = o.style ? { style: o.style } : {};
    const turn = o.turn == null ? 2.5 : o.turn;
    const slide = easeOut(u / 0.28);
    const lx = Math.round(lerp(-160, 4, slide)), rx = Math.round(lerp(W, 162, slide));
    if (b < turn) {
      props.backdrop(fb, t, 0x1c2a4a, 0x2a3a66);
      props.rain(fb, t, 0x6a8ac0, 60, 0.5);
      const g = { eyes: 'shut', mouth: 'frown', tears: t * 1.6, blush: 1, bob: Math.floor(t * 6) % 2, ...st };
      const bo = b < 1.2 ? { look: -2, eyes: 'wide', mouth: 'wavy', ...st } : { look: -1, eyes: b < 1.8 ? 'open' : 'shut', mouth: 'frown', tears: t * 1.4 + 0.4, ...st };
      props.panel(fb, cell, lx, 6, 'girl', g, t, { bgA: 0x8fa6cc, bgB: 0xb4c6e4, pattern: 'rain' });
      props.panel(fb, cell, rx, 6, 'boy', bo, t, { bgA: 0x7f96c0, bgB: 0xa8bcdc, pattern: 'rain' });
    } else {
      const v = b - turn;
      props.backdrop(fb, t, 0x4a2c40, 0x5e3a50);
      const g = { eyes: 'happy', mouth: 'laugh', blush: 2, bob: bob(t, 0.3), tears: v < 1 ? 0.9 : null, ...st };
      const bo = { eyes: 'happy', mouth: Math.floor(v * 2) % 2 ? 'grin' : 'laugh', blush: 1, bob: bob(t, 0.3), look: -1, ...st };
      if (g.tears == null) delete g.tears;
      const shake = v < 0.2 ? (Math.floor(u * 30) % 2 ? 1 : -1) : 0;
      props.panel(fb, cell, 4, 6 + shake, 'girl', g, t, { bgA: 0xfad28a, bgB: 0xfde4b0, pattern: 'rays' });
      props.panel(fb, cell, 162, 6 - shake, 'boy', bo, t, { bgA: 0xf9b89a, bgB: 0xfcd2bc, pattern: 'rays' });
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + v * 0.8;
        if (Math.floor(t * 8 + i) % 3) U.sparkle(fb, Math.round(160 + Math.cos(a) * 16), Math.round(74 + Math.sin(a) * 40), 1, 0xfff6d0);
      }
      if (v < 0.25) fb.wash(0xfff6e0, 0.6 * (1 - v / 0.25));
    }
  }
  ctx.cryLaugh = cryLaugh;
  add(52, 57, (fb, t, b, u) => cryLaugh(fb, t, b, u, {}));

  // ---- 57-61.3: he touches the photo; it stirs --------------------------------------

  add(57, 61.3, (fb, t, b, u) => {
    props.desk(fb, t);
    const touch = 1.0;
    const alive = b >= touch;
    const n = cfg.title ? [...cfg.title].length : 0;
    if (alive) {
      const wave = b > 1.8;
      liveFirst(off, t, { wave, look: b > 1.5 ? 1 : 0, eyesB: b > 1.8 ? 'happy' : 'open' });
      props.polaroid(fb, 98, 14, off, props.PH, {});
      props.photoCaption(fb, 98, 14, 124, props.PH.h, cfg.title, n + 1);
    } else ctx.opening.bigPolaroid(fb, 98, 14, 1, n + 1);
    const tipX = 196, tipY = 92;
    if (alive) {
      const a = (b - touch) * P;
      for (let r = 0; r < 3; r++) {
        const ra = a - r * 0.28;
        if (ra < 0 || ra > 1.3) continue;
        const rad = 4 + ra * 46, al = 0.7 * (1 - ra / 1.3);
        for (let i = 0; i < 80; i++) {
          const th = (i / 80) * 6.283;
          fb.blend(Math.round(tipX + Math.cos(th) * rad), Math.round(tipY + Math.sin(th) * rad * 0.8), 0xfff6d0, al);
        }
      }
      if (b > 1.4) U.risingHearts(fb, 226, 58, (b - 1.4) * P, 3, { rise: 46, spread: 8, outline: INK });
    }
    // the hand: up to the photo, rest, then away
    let hy;
    if (b < touch) hy = lerp(190, tipY, easeOut(b / touch));
    else if (b < 3.2) hy = tipY + (b - touch < 0.12 ? 1 : 0);
    else hy = lerp(tipY, 200, easeIn((b - 3.2) / 1.1));
    props.pointingHand(fb, tipX, Math.round(hy), { sleeve: 0x8a7f9c, sleeveSh: 0x6a607c, cuff: 0xf0ece4 });
    if (b >= touch && b < touch + 0.2) fb.wash(0xfff6e0, 0.35 * (1 - (b - touch) / 0.2));
  });

  // ---- 61.3-66: back into its corner of the album -----------------------------------

  add(61.3, 66, (fb, t, b, u) => {
    props.desk(fb, t, { book: false, tea: false, pencil: false });
    const k = easeBack((b - 0.35) / 0.7);
    const n = cfg.title ? [...cfg.title].length : 0;
    const chars = Math.floor(clamp((b - 1.3) / 1.0) * n + 0.001);
    const left = { id: 'cat' };
    const right = { id: 'first', corners: true, title: true, chars: Math.max(0, chars), dy: Math.round(lerp(-150, 0, k)), doodle: b > 2.5, show: b > 0.35 };
    if (chars <= 0) right.chars = 0;
    spread(fb, t, left, right, left, right, 0);
    // the corners stay put while the print slides in
    const p = props.pageRect('R');
    const px = p.x + ((p.w - 104) >> 1), py = p.y + 9;
    props.photoCorners(fb, px + 1, py + 1, 102, 90, 0x3d4a66);
    if (b > 1.0) {
      const pulse = 0.5 + 0.5 * Math.sin((b - 1) * Math.PI);
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + b * 0.5;
        if (Math.floor(t * 6 + i) % 3) U.sparkle(fb, Math.round(px + 52 + Math.cos(a) * 66), Math.round(py + 46 + Math.sin(a) * 56), pulse > 0.5 ? 2 : 1, 0xfff6d0);
      }
    }
    if (b > 2.4) U.risingHearts(fb, px + 92, py + 100, (b - 2.4) * P, 2, { rise: 30, spread: 8, outline: INK, speed: 0.45 });
    void u;
  }, { fade: 0.3 });

  // ---- 66-72: she comes in; he shows her ---------------------------------------------

  function thoughtRiver(fb, x, y, k) {
    if (k <= 0) return;
    const w = 44, h = 30;
    U.bubble(fb, x, y, w, h, { thought: true, tail: x + 8, tailDir: -1 });
    if (k < 0.5) return;
    fb.clip(x + 2, y + 2, w - 4, h - 4);
    fb.vgrad(x + 2, y + 2, w - 4, 16, [[0, 0x55508f], [0.6, 0xe27e70], [1, 0xffdc9a]], 3);
    fb.disc(x + 22, y + 17, 5, 0xfff0c4);
    fb.rect(x + 2, y + 18, w - 4, 4, 0xcf7584); fb.rect(x + 18, y + 19, 8, 1, 0xffe2a6); fb.rect(x + 20, y + 21, 5, 1, 0xffe2a6);
    fb.rect(x + 2, y + 22, w - 4, 6, 0x4a6950);
    fb.rect(x + 26, y + 20, 12, 2, 0x9a6648); fb.rect(x + 27, y + 22, 1, 3, 0x2f2540); fb.rect(x + 36, y + 22, 1, 3, 0x2f2540); fb.rect(x + 26, y + 17, 12, 1, 0x9a6648);
    fb.unclip();
  }
  add(66, 72, (fb, t, b, u) => {
    const close = b >= 2.5 && b < 4.2;
    const gx = Math.round(lerp(318, 188, easeOut(b / 1.5)));
    const walking = b < 1.5;
    const girl = homeGirl({});
    const boy = homeBoy({});
    if (walking) Object.assign(girl, { walk: Math.floor(t / 0.16), dir: -1, armL: 'hold', look: -1, mouth: 'smile' });
    else if (b < 2.5) Object.assign(girl, { look: -2, mouth: 'small', eyes: Math.abs(b - 2.1) < 0.07 ? 'blink' : 'open' });
    else if (b < 3.3) Object.assign(girl, { look: -2, lean: -1, eyes: 'wide', mouth: 'open' });
    else if (b < 4.2) Object.assign(girl, { look: -1, lean: -1, eyes: 'happy', mouth: 'laugh', blush: 1, bob: Math.floor(t * 5) % 2 });
    else Object.assign(girl, { look: -1, eyes: 'happy', mouth: 'smile', blush: 1, bob: bob(t), armR: b > 4.6 ? 'up' : 'down' });
    if (b < 1.2) Object.assign(boy, { armL: 'hold', armR: 'hold', eyes: 'down', mouth: 'smile' });
    else if (b < 2.5) Object.assign(boy, { look: 2, armL: 'hold', armR: 'hold', mouth: 'smile' });
    else if (b < 3.3) Object.assign(boy, { look: 2, armR: 'up', mouth: 'grin' });
    else if (b < 4.2) Object.assign(boy, { look: 2, arms: 'head', mouth: 'wavy', blush: 2 });
    else Object.assign(boy, { look: 1, mouth: 'grin', blush: 1, eyes: 'happy', bob: bob(t) });
    const lampK = b > 5.5 ? 1 - clamp((b - 5.5) / 0.3) : 1;
    const target = close ? off : fb;
    props.room(target, t, {
      clock: Math.floor(ctx.beat(t)), lamp: lampK,
      actors: (f) => {
        drawBoy(f, 151, 132, boy);
        drawGirl(f, gx, 124, girl);
        if (walking) mug(f, gx - 12, 100, t);
        if (b >= 2.5 && b < 3.3) miniPolaroid(f, 157, 74);
        if (b < 2.5) miniPolaroid(f, 146, 102);
      },
      items: (f) => deskItems(f, t, { albumX: 92, mugX: 236, mug2: b >= 1.5 ? 206 : null }),
    });
    if (close) zoom(fb, off, 2, 168, 94);
    else if (b >= 4.2) thoughtRiver(fb, 196, 34, clamp((b - 4.3) / 0.5));
    void u;
  }, { fade: 0.35 });

  // ---- 72-82: out together, along the river ------------------------------------------

  const NOW_SUNSET = world.look({ season: 'spring', time: 'sunset', era: 1 });
  ctx.NOW_SUNSET = NOW_SUNSET;
  function walkTogether(f, t, B) {
    // B: beats since 72
    const k = clamp(B / 9.6);
    const cam = Math.round(lerp(130, 40, k));
    const gx = Math.round(lerp(400, 186, k));
    const arrived = k >= 1;
    const step = Math.floor(t / 0.17);
    const girl = { who: 'girl', x: gx, pose: { style: 'now', look: Math.floor(B / 2) % 2 ? 1 : -1, mouth: 'smile' } };
    const boy = { who: 'boy', x: gx + 19, pose: { style: 'now', look: -1, mouth: 'smile' } };
    if (!arrived) { Object.assign(girl.pose, { walk: step, dir: -1 }); Object.assign(boy.pose, { walk: step + 2, dir: -1 }); }
    else { girl.pose.bob = bob(t); boy.pose.bob = bob(t); }
    if (B >= 6 && B < 7.2) { girl.pose.eyes = 'wide'; girl.pose.mouth = 'open'; boy.pose.eyes = 'wide'; girl.pose.look = -2; boy.pose.look = -2; }
    if (B >= 7.2) { girl.pose.eyes = 'happy'; girl.pose.mouth = 'laugh'; boy.pose.mouth = 'grin'; girl.pose.look = B > 9 ? 1 : -1; }
    scene(f, {
      t, cam, look: NOW_SUNSET, actors: [girl, boy],
      over: (g) => { g.rect(gx + 9 - cam, G - 18, 2, 2, 0xf9dcc6); },
      top: (g) => { if (B >= 6 && B < 7.2) { bang(g, gx - cam, 92, (B - 6) * P); bang(g, gx + 19 - cam, 89, (B - 6.15) * P); } },
    });
    return { cam, gx };
  }
  add(72, 75.5, (fb, t, b) => { walkTogether(fb, t, b); }, { fade: 0.3 });
  add(75.5, 78, (fb, t, b) => {
    const { cam, gx } = walkTogether(off, t, b + 3.5);
    zoom(fb, off, 2, gx + 10 - cam, 116);
  });
  add(78, 82, (fb, t, b) => { walkTogether(fb, t, b + 6); });

  return shots;
}

module.exports = { create };
