'use strict';
// Beats 82-192.4: back at the riverside ten years on. The second verse sets today against
// the old photo, the choruses replay the memories with the two as they are now, and the
// last one ends with a second photo for the album.

const { FB, bayer, mix } = require('./fb');
const { text, measure } = require('./font');
const { drawGirl, drawBoy, SKIN, SKIN_SH, GIRL_NOW, BOY_NOW } = require('./chars');
const world = require('./world');
const props = require('./props');
const U = require('./util');
const { INK, clamp, lerp, easeOut, easeIn, easeInOut, easeBack, arc } = U;
const { scene, zoom, printBorder, WEAR } = require('./stage');

const W = 320;
const H = 180;
const G = world.GROUND;
const HAND_LINE = 0xb9806e;

function dissolve(fb, other, k) {
  const lv = k * 16;
  if (lv <= 0) return;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x, y) < lv) fb.set(x, y, other.get(x, y));
}

// Year tag in the style of the photo date stamp; `pop` draws it large for a moment.
function yearTag(fb, s, x, y, pop, align = 'right') {
  if (pop) {
    const w = measure(s, { scale: 2 });
    text(fb, s, align === 'right' ? x - w : x, y - 2, 0xffa63d, { scale: 2, outline: 0x7a3a1a });
  } else text(fb, s, x, y, 0xffa63d, { align, outline: 0x7a3a1a });
}

// Bench slats seen from above, in evening light.
function planks(fb) {
  for (let y = 0; y < H; y++) {
    const p = Math.floor((y + 20) / 46), yy = (y + 20) % 46;
    const base = [0x9a6648, 0x8f5d42, 0xa26c4c, 0x94623f][p % 4];
    fb.rect(0, y, W, 1, yy < 3 ? 0x3d2428 : yy === 3 ? 0xd29a66 : yy > 43 ? 0x6d4434 : base);
  }
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(world.hash(i, 201) * W), y = Math.floor(world.hash(i, 203) * H), len = 6 + Math.floor(world.hash(i, 207) * 30);
    if ((y + 20) % 46 < 5 || (y + 20) % 46 > 42) continue;
    fb.rect(x, y, len, 1, world.hash(i, 211) > 0.5 ? 0x7e5038 : 0xb07a54);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 90) / 260, (y - 40) / 180);
      if (d > 0.5) fb.blend(x, y, 0x2a1830, Math.min(4, Math.floor((d - 0.5) * 9)) * 0.1);
      else if (d < 0.28) fb.blend(x, y, 0xffb070, d < 0.15 ? 0.16 : 0.08);
    }
  }
}

function create(ctx) {
  const { cfg, P, off, off2, cell } = ctx;
  const stage = ctx.stage;
  const album = ctx.album;
  const bob = (t, len = 0.2) => (ctx.onBeat(t, len) ? 1 : 0);
  const shots = [];
  const add = (from, to, draw, extra) => shots.push({ from, to, draw, ...(extra || {}) });
  const now = (pose) => ({ style: 'now', ...pose });

  const THEN = world.look();
  const NOW_SUNSET = ctx.NOW_SUNSET;
  const NOW_DUSK = world.look({ season: 'spring', time: 'dusk', era: 1 });
  const NOW_NIGHT = world.look({ season: 'spring', time: 'night', era: 1 });
  const titleLen = cfg.title ? [...cfg.title].length : 0;

  // ---- 82-86: the old spot. "You stood here, I stood there." -------------------------

  add(82, 86, (fb, t, b) => {
    const step = Math.floor(t / 0.15);
    const girl = { who: 'girl', x: 186, pose: now({ look: 1, mouth: 'smile' }) };
    const boy = { who: 'boy', x: 205, pose: now({ look: -1, mouth: 'smile' }) };
    let hop = 0;
    if (b < 0.6) {
      Object.assign(girl.pose, { eyes: 'happy', mouth: 'laugh', bob: bob(t) });
      Object.assign(boy.pose, { mouth: 'grin', bob: bob(t) });
    } else if (b < 1.5) {
      const k = clamp((b - 0.7) / 0.6);
      girl.x = 187;
      boy.x = Math.round(lerp(205, 212, k));
      if (k > 0 && k < 1) Object.assign(boy.pose, { walk: step, dir: 1, look: 1 });
      else if (k >= 1) boy.pose.look = 0;
      Object.assign(girl.pose, { armR: 'out', look: 2, mouth: 'open' });
    } else if (b < 3) {
      girl.x = 187; boy.x = 212;
      Object.assign(girl.pose, { arms: 'front', eyes: 'happy', blush: 1, look: 0, mouth: 'smile' });
      Object.assign(boy.pose, { look: 0, mouth: 'grin', blush: 1 });
    } else {
      const k = clamp((b - 3) / 0.3);
      girl.x = 187;
      boy.x = Math.round(lerp(212, 205, k));
      hop = Math.round(arc(k) * 4);
      Object.assign(girl.pose, { eyes: 'happy', mouth: 'laugh', blush: 1, look: 1, bob: bob(t) });
      Object.assign(boy.pose, { eyes: 'happy', mouth: 'laugh', blush: 1, look: -1, bob: k >= 1 ? bob(t) : 0 });
    }
    boy.y = G - hop;
    scene(fb, { t, cam: 40, look: NOW_SUNSET, actors: [girl, boy] });
    // for one beat the frame is the old photo again
    const m = b < 1.7 ? 0 : b < 1.9 ? (b - 1.7) / 0.2 : b < 2.5 ? 1 : b < 2.7 ? 1 - (b - 2.5) / 0.2 : 0;
    if (m > 0) { ctx.liveFirst(off, t, {}); dissolve(fb, off, m); }
    if (b >= 1.5 && b < 3) { printBorder(fb); props.dateStamp(fb, W - 12, 8, m >= 0.5 ? cfg.stamp : cfg.stamp2); }
    if (b >= 3.2) U.risingHearts(fb, 160, 100, (b - 3.2) * P, 3, { rise: 30, spread: 10, outline: INK });
  });

  // ---- 86-90: the first photo, held up against today --------------------------------

  const SHIFT = 14;   // the scene sits this much higher so the hand has room below it
  add(86, 90, (fb, t, b) => {
    const girl = { who: 'girl', x: 187, pose: now({ arms: 'front', eyes: 'happy', blush: 1, mouth: 'smile', bob: bob(t) }) };
    if (b >= 2.9) Object.assign(girl.pose, { arms: 'down', armR: 'wave', wave: Math.floor(t * 4) % 2, mouth: 'laugh' });
    scene(off, { t, cam: 40, look: NOW_SUNSET, actors: [girl] });
    fb.rect(0, H - SHIFT, W, SHIFT, NOW_SUNSET.g(NOW_SUNSET.veg.front));
    fb.blit(off, 0, SHIFT, W, H - SHIFT, 0, 0);
    const up = easeOut(b / 0.55), dn = easeIn((b - 2.3) / 0.55);
    const dy = Math.round((1 - up) * 130 + dn * 130);
    const wob = b > 0.55 && b < 2.3 ? Math.round(Math.sin(t * 2.2) * 0.6) : 0;
    const px = 108 + wob, py = 82 - SHIFT - 4 + dy;
    // his hand: sleeve and the back of the hand behind the print, the thumb over its corner
    const S = BOY_NOW.shirt;
    fb.rect(px - 22, py + 88, 27, 110, S); fb.rect(px - 22, py + 88, 3, 110, mix(S, 0xffffff, 0.2)); fb.rect(px - 1, py + 88, 6, 110, BOY_NOW.shirtSh);
    fb.rect(px - 23, py + 83, 29, 6, 0xe2ded6); fb.rect(px - 23, py + 88, 29, 1, 0xbdb8b0);
    fb.rect(px - 20, py + 60, 26, 24, HAND_LINE); fb.rect(px - 19, py + 61, 24, 23, SKIN); fb.rect(px - 19, py + 80, 24, 3, SKIN_SH);
    props.polaroid(fb, px, py, stage.photo('first'), props.MID, { m: 4, bottom: 16, tape: false });
    text(fb, cfg.stamp, px + 52, py + 78, 0x3d4a78, { align: 'center' });
    fb.rect(px - 6, py + 64, 20, 10, HAND_LINE); fb.rect(px - 5, py + 65, 18, 8, SKIN); fb.rect(px + 8, py + 66, 4, 6, 0xfff0e6); fb.rect(px - 5, py + 71, 13, 2, SKIN_SH);
    props.dateStamp(fb, W - 12, 8, cfg.stamp2);
    if (b >= 3.1) U.risingHearts(fb, 147, 82, (b - 3.1) * P, 3, { rise: 30, spread: 10, outline: INK });
  });

  // ---- 90-94: the faces then, the faces now ------------------------------------------

  add(90, 94, (fb, t, b, u) => {
    const isNow = b >= 2;
    if (!isNow) {
      const slide = easeOut(u / 0.28);
      props.backdrop(fb, t);
      const g = { blush: 2, look: b > 1 ? -1 : 1, mouth: b > 1 ? 'wavy' : 'small', eyes: b > 1 ? 'down' : 'open', bob: bob(t) };
      const bo = { blush: 2, look: b > 1 ? 2 : -1, mouth: 'wavy', arms: b > 1 ? 'head' : 'down', bob: bob(t) };
      props.panel(fb, cell, Math.round(lerp(-160, 4, slide)), 6, 'girl', g, t, { bgA: 0xf9c3bb, bgB: 0xfcd7cf });
      props.panel(fb, cell, Math.round(lerp(W, 162, slide)), 6, 'boy', bo, t, { bgA: 0xa9c6ef, bgB: 0xc2d7f5 });
      if (slide >= 1) yearTag(fb, "'09", 12, 10, b < 0.3, 'left');
    } else {
      const v = b - 2;
      props.backdrop(fb, t, 0x4a2c40, 0x5e3a50);
      const shake = v < 0.2 ? (Math.floor(u * 30) % 2 ? 1 : -1) : 0;
      const g = now({ eyes: 'happy', mouth: 'laugh', blush: 1, bob: bob(t, 0.3), look: 1 });
      const bo = now({ eyes: v > 1 ? 'happy' : 'open', mouth: 'grin', blush: 1, bob: bob(t, 0.3), look: -1 });
      props.panel(fb, cell, 4, 6 + shake, 'girl', g, t, { bgA: 0xfad28a, bgB: 0xfde4b0, pattern: 'rays' });
      props.panel(fb, cell, 162, 6 - shake, 'boy', bo, t, { bgA: 0xf9b89a, bgB: 0xfcd2bc, pattern: 'rays' });
      yearTag(fb, "'19", 12, 10, v < 0.3, 'left');
      if (v < 0.25) fb.wash(0xfff6e0, 0.6 * (1 - v / 0.25));
    }
  });

  // ---- 94-98: red as an apple, still --------------------------------------------------

  add(94, 98, (fb, t, b, u) => {
    const gx = 148, T = G - 44;
    const girl = { who: 'girl', x: gx + 40, pose: now({ look: 1, eyes: 'happy', mouth: 'grin', bob: bob(t) }) };
    const boy = { who: 'boy', x: 211, pose: now({ look: -1, mouth: 'smile' }) };
    let ax, ay;
    if (b < 1) {
      // she fishes an apple out and holds it up
      const k = easeBack(b / 0.35);
      girl.pose.armR = 'up';
      ax = gx + 7; ay = T - 5 - Math.round(arc(clamp(b / 0.35)) * 3);
      if (k < 0.5) { ax = gx + 7; ay = T + 2; }
      if (b > 0.5) Object.assign(boy.pose, { eyes: 'wide', mouth: 'open', look: -2 });
    } else {
      // and presses it against his cheek
      girl.pose.armR = 'wave'; girl.pose.wave = 0;
      ax = gx + 11; ay = T + 4;
      const red = b < 1.5 ? 1 : b < 2 ? 2 : 3;
      Object.assign(boy.pose, { blush: red, eyes: b < 2 ? 'wide' : 'shut', mouth: b < 2 ? 'open' : 'wavy', look: b < 2 ? -1 : 1, arms: b >= 2.5 ? 'head' : 'down' });
      if (b >= 2) Object.assign(girl.pose, { mouth: 'laugh', blush: 1 });
    }
    scene(off, {
      t, cam: 40, look: NOW_SUNSET, actors: [boy, girl],
      over: (f) => {
        U.stampOutlined(f, ax, ay, U.APPLE_SMALL, U.APPLE_PAL, INK);
        if (b >= 2) {
          for (let i = 0; i < 4; i++) {
            const ph = (t * 0.9 + i * 0.27) % 1;
            const sx = 171 - 8 + i * 5 + Math.round(Math.sin(ph * 6 + i) * 2), sy = G - 50 - Math.round(ph * 12);
            f.rect(sx, sy, ph < 0.5 ? 2 : 1, ph < 0.5 ? 2 : 1, 0xffffff);
          }
        }
      },
      top: (f) => { if (b >= 1 && b < 1.8) text(f, '!', 171, 90 - Math.round(easeBack((b - 1) / 0.18) * 4), 0xfff6e0, { align: 'center', outline: INK }); },
    });
    zoom(fb, off, 2, 160, 120);
    if (b >= 1 && b < 1.15) fb.wash(0xfff6e0, 0.5 * (1 - (b - 1) / 0.15));
    if (b >= 2.2) U.risingHearts(fb, 160, 56, (b - 2.2) * P, 4, { rise: 44, spread: 20, outline: INK });
    void u;
  });

  // ---- 98-102: then | now, the same bench ---------------------------------------------

  function benchPair(f, t, look, kind) {
    const actors = kind === 'then'
      ? [
        { who: 'girl', x: 259, pose: { sit: true, arms: 'front', look: -1, eyes: 'down', mouth: 'small', blush: 2, bob: bob(t) } },
        { who: 'boy', x: 289, pose: { sit: true, look: 2, mouth: 'wavy', blush: 2, arms: 'head' } },
      ]
      : [
        { who: 'boy', x: 282, pose: now({ sit: true, look: -1, mouth: 'smile', blush: 1, armL: 'none' }) },
        { who: 'girl', x: 266, pose: now({ sit: true, arms: 'front', lean: 2, eyes: 'happy', mouth: 'smile', blush: 1, bob: bob(t) }) },
      ];
    scene(f, { t, cam: 113, look, back: { bench: 'wide' }, actors });
  }

  add(98, 102, (fb, t, b) => {
    benchPair(fb, t, NOW_SUNSET, 'now');
    const split = Math.round(b < 0.2 ? W : b < 1.2 ? lerp(W, 160, easeInOut(b - 0.2)) : b < 2.2 ? 160 : lerp(160, 0, easeInOut((b - 2.2) / 1.1)));
    if (split > 0) {
      benchPair(off, t, THEN, 'then');
      fb.blit(off, 0, 0, split, H, 0, 0);
    }
    if (split > 0 && split < W) {
      fb.rect(split - 2, 0, 4, H, INK); fb.rect(split - 1, 0, 2, H, 0xffffff);
      fb.disc(split, 80, 9, INK); fb.disc(split, 80, 8, 0xffffff);
      for (let i = 0; i < 4; i++) { fb.rect(split - 6 + i, 80 - i, 1, i * 2 + 1, INK); fb.rect(split + 5 - i, 80 - i, 1, i * 2 + 1, INK); }
    }
    if (split > 44) yearTag(fb, "'09", 12, 8, false, 'left');
    if (split < W - 44) yearTag(fb, "'19", W - 12, 8, false, 'right');
  });

  // ---- 102-106: the world changed around the two of them ----------------------------

  const YEARS = [
    { look: world.look({ season: 'summer', time: 'day', era: 0.2 }), g: WEAR.summerG, b: WEAR.summerB, tag: "'11" },
    { look: world.look({ season: 'autumn', time: 'sunset', era: 0.45 }), g: WEAR.autumnG, b: WEAR.autumnB, tag: "'13" },
    { look: world.look({ season: 'winter', time: 'dusk', era: 0.7 }), g: WEAR.winterG, b: WEAR.winterB, tag: "'16" },
    { look: NOW_SUNSET, g: { style: 'now' }, b: { style: 'now' }, tag: "'19" },
  ];
  add(102, 106, (fb, t, b) => {
    const i = Math.min(3, Math.floor(b));
    const k = b - i;
    const draw = (f, j) => {
      const Y = YEARS[j];
      scene(f, {
        t, cam: 113, look: Y.look, back: { bench: 'wide' },
        actors: [
          { who: 'boy', x: 283, pose: { sit: true, mouth: 'smile', look: -1, blush: j === 3 ? 1 : 0, ...Y.b } },
          { who: 'girl', x: 265, pose: { sit: true, eyes: 'happy', mouth: 'smile', arms: 'front', lean: j >= 2 ? 2 : j, bob: bob(t), ...Y.g } },
        ],
      });
    };
    draw(fb, i);
    if (i > 0 && k < 0.3) {
      // the new year sweeps in from the left
      draw(off, i - 1);
      const edge = (k / 0.3) * (W + 100);
      for (let y = 0; y < H; y++) {
        const x0 = Math.max(0, Math.round(edge - y * 0.5));
        if (x0 < W) fb.blit(off, x0, y, W - x0, 1, x0, y);
        if (x0 > 1 && x0 < W) fb.rect(x0 - 2, y, 2, 1, 0xffffff);
      }
    } else if (i === 0 && k < 0.2) fb.wash(0xfff6e0, 0.5 * (1 - k / 0.2));
    yearTag(fb, YEARS[i].tag, W - 12, 8, k < 0.16);
  });

  // ---- 106-110: the album again; the facing page is still empty -----------------------

  add(106, 110, (fb, t, b) => {
    planks(fb);
    const left = { id: 'first', corners: true, title: true, chars: 99 };
    const framed = b >= 1;
    album.spread(fb, t, left, framed ? { corners: true } : null, left, null, 0);
    const p = props.pageRect('R');
    const px = p.x + ((p.w - 104) >> 1), py = p.y + 9;
    if (framed) {
      if (b < 1.5) for (let i = 0; i < 6; i++) U.sparkle(fb, Math.round(px + 52 + Math.cos(i * 1.05) * (40 + (b - 1) * 40)), Math.round(py + 46 + Math.sin(i * 1.05) * (34 + (b - 1) * 34)), 1, 0xfff6d0);
      if (b >= 2) {
        const pop = b < 2.15 ? 4 : 3;
        const w = measure('?', { scale: pop });
        text(fb, '?', Math.round(px + 52 - w / 2), py + (pop === 4 ? 10 : 18), 0x9aa6c4, { scale: pop });
      }
      if (b >= 2.6) text(fb, cfg.stamp2, px + 52, py + 78, 0x3d4a78, { align: 'center', chars: Math.ceil(clamp((b - 2.6) / 0.6) * [...cfg.stamp2].length) });
    }
    // her hand: taps the empty page twice
    const tipX = px + 96, restY = py + 84;
    let hy;
    if (b < 1) hy = lerp(200, restY, easeOut((b - 0.3) / 0.6));
    else if (b < 3.3) hy = restY + (b - 1 < 0.12 || (b >= 2 && b - 2 < 0.12) ? 2 : 0) - (b > 1.6 && b < 2 ? Math.round(arc((b - 1.6) / 0.4) * 6) : 0);
    else hy = lerp(restY, 210, easeIn((b - 3.3) / 0.7));
    props.pointingHand(fb, tipX, Math.round(hy), { sleeve: GIRL_NOW.top, sleeveSh: GIRL_NOW.topSh, cuff: 0xfbf7ee });
  }, { fade: 0.25 });

  // ---- 110-118: on the bench, facing the river; evening turns to night ----------------

  // The pair from behind, sitting on the bench. o: { leanG, leanB, mid(fb, look) }
  function benchBack(f, t, look, o = {}) {
    const cam = 113;
    world.drawBack(f, t, cam, { look, bench: false });
    if (o.mid) o.mid(f, look);
    const gr = look.cg || undefined;
    f.clip(0, 0, W, 141);
    drawBoy(f, 283 - cam, G, now({ sit: true, back: true, lean: o.leanB || 0, shadow: false, grade: gr }));
    drawGirl(f, 266 - cam, G, now({ sit: true, back: true, lean: o.leanG || 0, shadow: false, grade: gr }));
    f.unclip();
    world.drawBench(f, cam, look, true);
    world.drawFront(f, t, cam, { look, camera: false });
  }
  ctx.benchBack = benchBack;

  add(110, 114, (fb, t, b) => {
    benchBack(off, t, NOW_SUNSET, { leanG: b < 1.5 ? 0 : b < 1.7 ? 1 : 2, leanB: b < 2.6 ? 0 : -1 });
    zoom(fb, off, 2, 161, 112);
    if (b >= 3) U.risingHearts(fb, 164, 60, (b - 3) * P, 1, { rise: 26, outline: INK, speed: 0.5 });
  }, { fade: 0.3 });

  add(114, 118, (fb, t, b) => {
    const view = (f, look) => { benchBack(off2, t, look, { leanG: 2, leanB: -1 }); zoom(f, off2, 2, 161, 112); };
    if (b < 0.6) view(fb, NOW_SUNSET);
    else if (b < 1.5) { view(fb, NOW_DUSK); view(off, NOW_SUNSET); dissolve(fb, off, 1 - (b - 0.6) / 0.9); }
    else if (b < 2.4) { view(fb, NOW_NIGHT); view(off, NOW_DUSK); dissolve(fb, off, 1 - (b - 1.5) / 0.9); }
    else view(fb, NOW_NIGHT);
  });

  // ---- 118-122: how did it start? rewind ----------------------------------------------

  const scratch = new FB(W, H);
  add(118, 122, (fb, t, b, u) => {
    const REW = 3.3;
    if (b < REW) {
      ctx.meetCute(fb, -t * 2.2, lerp(4, 0, b / REW));
      printBorder(fb);
      props.dateStamp(fb, W - 12, 8, "'09 3 14");
      props.rewindFx(fb, t, scratch);
    } else {
      ctx.meetCute(fb, t, (b - REW) * 0.9);
      printBorder(fb);
      props.dateStamp(fb, W - 12, 8, "'09 3 14");
      for (let i = 0; i < 7; i++) fb.rect(20 + i, 14 + i, 1, 13 - i * 2, INK);
      for (let i = 0; i < 5; i++) fb.rect(21 + i, 16 + i, 1, 9 - i * 2, 0xffffff);
      text(fb, 'PLAY', 32, 12, 0xffffff, { outline: INK });
    }
    if (u < 0.2) fb.wash(0xffffff, 0.7 * (1 - u / 0.2));
  });

  // ---- 122-126: the same song, both of them this time ----------------------------------

  add(122, 126, (fb, t, b, u) => {
    ctx.singing(off, t, NOW_NIGHT, { both: true, style: 'now' });
    if (b < 2) {
      fb.copyFrom(off);
      props.notes(fb, 284 - 113 + 10, 104, u, 4, 1);
      props.notes(fb, 263 - 113 - 12, 106, u + 0.6, 3, -1);
    } else {
      zoom(fb, off, 2, 162, 116);
      props.notes(fb, 200, 70, u, 5, 1);
      props.notes(fb, 116, 74, u + 0.6, 4, -1);
    }
    props.dateStamp(fb, W - 12, 8, cfg.stamp2);
  }, { fade: 0.25 });

  // ---- 126-130: this time she says it first --------------------------------------------

  const SHELLS2 = [[0.5, 226, 38, 0xffd98f, 0xfff6c0, false], [1.5, 96, 36, 0xff5a6a, 0xffb0b8, true], [2.1, 262, 52, 0x9fe0ff, 0xffffff, false], [2.6, 56, 52, 0xc9a0ff, 0xffffff, false], [3.1, 176, 30, 0xff9ab0, 0xffffff, false], [3.5, 120, 50, 0xffd98f, 0xfff6c0, false]];
  add(126, 130, (fb, t, b, u) => {
    const o = { who: 'girl', answer: 2, style: 'now', shells: SHELLS2 };
    if (b < 3) {
      ctx.confession(fb, t, b, NOW_NIGHT, o);
      ctx.heartBubble(fb, 140, 98, u - 0.12, 1);
      ctx.heartBubble(fb, 190, 94, u - 2 * P - 0.05, -1);
    } else {
      ctx.confession(off, t, b, NOW_NIGHT, o);
      zoom(fb, off, 2, 161, 116);
      U.risingHearts(fb, 160, 78, u - 3 * P, 4, { rise: 60, spread: 24, outline: INK });
    }
    props.dateStamp(fb, W - 12, 8, cfg.stamp2);
  });

  // ---- 130-134: nobody else ---------------------------------------------------------------

  // Standing close, his arm round her shoulders. o: { look, cam, gx, bx, mid, girl, boy, back }
  function close(f, t, o) {
    const cam = o.cam == null ? 113 : o.cam;
    const gx = o.gx == null ? 268 : o.gx, bx = o.bx == null ? gx + 17 : o.bx;
    const girl = { who: 'girl', x: gx, pose: now({ lean: 1, eyes: 'happy', mouth: 'smile', blush: 2, arms: 'front', bob: bob(t), ...(o.girl || {}) }) };
    const boy = { who: 'boy', x: bx, pose: now({ lean: -1, eyes: 'happy', mouth: 'grin', blush: 1, armL: 'none', bob: bob(t), ...(o.boy || {}) }) };
    scene(f, {
      t, cam, look: o.look, back: o.back || {}, actors: [boy, girl], mid: o.mid,
      over: (g, L) => {
        // his hand on her far shoulder
        const c = L.cg || ((x) => x);
        const ub = girl.pose.bob ? 1 : 0;
        g.rect(gx - cam - 11, G - 44 + 18 + ub, 3, 3, c(SKIN)); g.rect(gx - cam - 11, G - 44 + 20 + ub, 3, 1, c(SKIN_SH));
        if (o.over) o.over(g, L);
      },
    });
  }
  ctx.close = close;

  const SHELLS3 = [[0.1, 70, 44, 0xff9ab0, 0xffffff, false], [0.6, 236, 36, 0xffd98f, 0xfff6c0, false], [1.0, 150, 28, 0xff5a6a, 0xffb0b8, true], [1.5, 36, 58, 0x9fe0ff, 0xffffff, false], [1.9, 282, 56, 0xc9a0ff, 0xffffff, false], [2.4, 110, 38, 0xffd98f, 0xfff6c0, false], [2.9, 210, 44, 0xff9ab0, 0xffffff, false], [3.4, 60, 40, 0x9fe0ff, 0xffffff, false]];
  function shellsOn(g, b, list) {
    let glow = 0, glowCol = 0;
    for (const [tb, x, y, c, c2, heart] of list) {
      const gl = props.firework(g, x, y, (b - tb) * P, { col: c, col2: c2, heart, size: heart ? 24 : 26, seed: x });
      if (gl > glow) { glow = gl; glowCol = c; }
    }
    return { glow, glowCol };
  }
  add(130, 134, (fb, t, b, u) => {
    let lit = { glow: 0, glowCol: 0 };
    const wide = b < 2;
    close(wide ? fb : off, t, { look: NOW_NIGHT, back: { bench: 'wide' }, gx: 262, mid: (g) => { lit = shellsOn(g, b, SHELLS3); }, girl: { eyes: b < 1 ? 'open' : 'happy', look: b < 1 ? 1 : 0 }, boy: { look: b < 1 ? -1 : 0 } });
    if (!wide) {
      zoom(fb, off, 2, 158, 118);
      U.risingHearts(fb, 160, 70, u - 2 * P, 4, { rise: 56, spread: 26, outline: INK });
    }
    if (lit.glow > 0) fb.wash(lit.glowCol, 0.1 * lit.glow);
  });

  // ---- 134-139: tears and laughter, both understood - today's faces ---------------------

  add(134, 139, (fb, t, b, u) => ctx.cryLaugh(fb, t, b, u, { style: 'now' }));

  // ---- 139-143.3: a hand finds the other ------------------------------------------------

  // A hand lying flat, fingers pointing `dir`; (x, y) is the middle of the wrist.
  function flatHand(fb, x, y, dir, sleeve, sleeveSh, cuff) {
    const R = (dx, dy, w, h, c) => fb.rect(dir > 0 ? x + dx : x - dx - w, y + dy, w, h, c);
    R(-140, -17, 140, 34, sleeve); R(-140, 13, 140, 4, sleeveSh); R(-140, -17, 140, 2, mix(sleeve, 0xffffff, 0.18));
    R(-8, -18, 9, 36, cuff); R(-8, 15, 9, 3, mix(cuff, 0x000000, 0.18));
    R(0, -15, 31, 30, HAND_LINE); R(1, -14, 29, 28, SKIN);
    R(8, -22, 20, 9, HAND_LINE); R(9, -21, 18, 7, SKIN); R(22, -20, 4, 4, 0xfff0e6); R(9, -16, 17, 1, SKIN_SH);
    for (const [dy, len] of [[-14, 24], [-7, 28], [0, 26], [7, 20]]) {
      R(29, dy - 1, len + 2, 8, HAND_LINE); R(29, dy, len + 1, 6, SKIN);
      R(29 + len - 3, dy + 1, 3, 3, 0xfff0e6); R(29, dy + 5, len + 1, 1, SKIN_SH);
      R(29 + Math.round(len * 0.45), dy, 1, 5, SKIN_SH);
    }
    R(1, 11, 29, 3, SKIN_SH);
  }

  add(139, 143.3, (fb, t, b, u) => {
    planks(fb);
    fb.wash(0x141a40, 0.42);
    // lamp light from the upper right
    for (let y = 0; y < 150; y++) for (let x = 110; x < W; x++) {
      const d = Math.hypot((x - 250) / 190, (y - 30) / 150);
      if (d < 0.55) fb.blend(x, y, 0xffd98a, d < 0.3 ? 0.16 : 0.08);
    }
    const sq = b >= 2.6 ? (Math.floor((b - 2.6) * 2) % 2 === 0 && (b - 2.6) % 0.5 < 0.12 ? 1 : 0) : 0;
    // hers rests on the bench; his comes over, hesitates, then covers it
    flatHand(fb, 78, 96 + sq, 1, GIRL_NOW.top, GIRL_NOW.topSh, 0xfbf7ee);
    let hx, hy = 96;
    if (b < 0.4) hx = 420;
    else if (b < 1.2) hx = lerp(420, 262, easeOut((b - 0.4) / 0.8));
    else if (b < 1.7) hx = 262 + Math.round(arc((b - 1.2) / 0.5) * 14);
    else if (b < 2) hx = 262;
    else { hx = lerp(262, 172, easeOut((b - 2) / 0.3)); hy = lerp(96, 92, easeOut((b - 2) / 0.3)); }
    if (b >= 2) fb.rectA(Math.round(hx) - 56, Math.round(hy) - 11, 60, 32, 0x0c0a1c, 0.3);
    flatHand(fb, Math.round(hx), Math.round(hy) - sq, -1, BOY_NOW.shirt, BOY_NOW.shirtSh, 0xe2ded6);
    if (b >= 1.2 && b < 1.9) for (let i = 0; i < 3; i++) if (b > 1.25 + i * 0.15) fb.rect(206 + i * 7, 60, 3, 3, 0xfff6e0);
    if (b >= 2.3) {
      const k = easeBack((b - 2.3) / 0.3);
      const s = k < 0.5 ? 1 : 2;
      U.stampOutlined(fb, 160 - Math.floor(13 * s / 2), 44 - 5 * s, U.HEART_BIG, { X: 0xe5504a, H: 0xffb0b8 }, INK, s);
      U.risingHearts(fb, 160, 60, (b - 2.6) * P, 4, { rise: 50, spread: 30, outline: INK });
    }
    void u;
  }, { fade: 0.25 });

  // ---- 143.3-146: the softest corner ------------------------------------------------------

  add(143.3, 146, (fb, t, b) => {
    scene(off, {
      t, cam: 113, look: NOW_NIGHT, back: { bench: 'wide' },
      actors: [
        { who: 'boy', x: 282, pose: now({ sit: true, look: b < 1.3 ? -2 : -1, mouth: 'smile', blush: 1, armL: 'none', eyes: b > 1.3 ? 'happy' : 'open' }) },
        { who: 'girl', x: 266, pose: now({ sit: true, arms: 'front', lean: 2, eyes: 'blink', mouth: 'smile', blush: 2 }) },
      ],
    });
    zoom(fb, off, 3, 161, 124);
    if (b > 0.8) U.risingHearts(fb, 150, 48, (b - 0.8) * P, 2, { rise: 34, spread: 60, outline: INK, speed: 0.4 });
  }, { fade: 0.3 });

  // ---- 146-151.7: the years again, one print on every beat -----------------------------

  const PILE = [['summer', 6, 2, 0xf6d06a], ['fireworks', 108, 8, 0xf29aa6], ['autumn', 210, 2, 0x9fd0b0], ['winter', 18, 64, 0x9fc4f0], ['rain', 114, 70, 0xf29aa6], ['cat', 208, 62, 0xf6d06a]];
  const LEAD = 0.3;   // a print starts falling this long before its beat, to land on it
  add(146, 151.7, (fb, t, b) => {
    props.desk(fb, t, { book: false, tea: false, pencil: false });
    const land = PILE.some((d, i) => { const u = (b - i) * P + LEAD; return u > 0.3 && u < 0.38; });
    if (land) fb.oy = 1;
    PILE.forEach(([id, x, y, tc], i) => ctx.dropPrint(fb, t, id, x, y, (b - i) * P + LEAD, tc));
    fb.oy = 0;
  }, { fade: 0.3 });

  // ---- 151.7-155: and under them all, the first one ------------------------------------

  add(151.7, 155, (fb, t, b) => {
    props.desk(fb, t, { book: false, tea: false, pencil: false });
    const clear = b >= 2.3;
    if (clear) {
      ctx.liveFirst(off, t, { wave: b >= 2.6 });
      props.polaroid(fb, 98, 14, off, props.PH, {});
      props.photoCaption(fb, 98, 14, 124, props.PH.h, cfg.title, titleLen + 1);
    } else ctx.opening.bigPolaroid(fb, 98, 14, 1, titleLen + 1);
    // the prints fly off, last one first
    PILE.forEach(([id, x, y, tc], i) => {
      const k = (b - (0.15 + (5 - i) * 0.33)) / 0.45;
      if (k >= 1) return;
      const kk = easeIn(k);
      const dx = x + 52 < 140 ? -1 : x + 52 > 180 ? 1 : (i % 2 ? 0.25 : -0.25), dy = y < 40 ? -1 : 1;
      ctx.dropPrint(fb, t, id, Math.round(x + dx * kk * 250), Math.round(y + dy * kk * 180), 99, tc);
    });
    if (clear) {
      const v = b - 2.3;
      if (v < 0.9) for (let i = 0; i < 8; i++) U.sparkle(fb, Math.round(160 + Math.cos(i * 0.785 + 0.3) * (70 + v * 40)), Math.round(70 + Math.sin(i * 0.785 + 0.3) * (60 + v * 30)), v < 0.4 ? 2 : 1, 0xfff6d0);
      U.risingHearts(fb, 228, 60, (b - 2.6) * P, 3, { rise: 46, spread: 8, outline: INK });
    }
  });

  // ---- 155-158.3: the song by the river, then and now ---------------------------------

  const SUMMER_NIGHT = world.look({ season: 'summer', time: 'night', era: 0.1 });
  add(155, 158.3, (fb, t, b, u) => {
    ctx.singing(off, t, SUMMER_NIGHT);
    fb.blit(off, 121, 72, 80, 90, 0, 0, 2);
    ctx.singing(off, t, NOW_NIGHT, { both: true, style: 'now' });
    fb.blit(off, 121, 72, 80, 90, 160, 0, 2);
    fb.clip(0, 0, 158, H); props.notes(fb, 104, 66, u, 4, 1); fb.unclip();
    fb.clip(162, 0, 158, H); props.notes(fb, 264, 66, u + 0.4, 4, 1); props.notes(fb, 214, 70, u + 0.9, 3, -1); fb.unclip();
    fb.rect(158, 0, 4, H, INK); fb.rect(159, 0, 2, H, 0xffffff);
    yearTag(fb, "'10", 10, 8, u < 0.25, 'left');
    yearTag(fb, "'19", W - 10, 8, u < 0.25, 'right');
    if (u < 0.2) fb.wash(0xfff6e0, 0.5 * (1 - u / 0.2));
  });

  // ---- 158.3-161.7: shouted across the water, with the whole sky answering ---------------

  const FINALE = [[0.0, 60, 48, 0xff9ab0, 0xffffff, false], [0.35, 252, 40, 0xffd98f, 0xfff6c0, false], [0.7, 158, 36, 0xff5a6a, 0xffb0b8, true], [1.2, 104, 30, 0x9fe0ff, 0xffffff, false], [1.6, 218, 58, 0xc9a0ff, 0xffffff, false], [2.0, 34, 34, 0xffd98f, 0xfff6c0, false], [2.4, 288, 30, 0xff9ab0, 0xffffff, false], [2.7, 150, 54, 0x9fe0ff, 0xffffff, false], [3.0, 86, 58, 0xffd98f, 0xfff6c0, false]];
  add(158.3, 161.7, (fb, t, b, u) => {
    let lit = { glow: 0, glowCol: 0 };
    const cheer = b >= 0.7;
    scene(fb, {
      t, cam: 113, look: NOW_NIGHT,
      actors: [
        { who: 'girl', x: 226, pose: now({ back: true, armL: 'up', armR: cheer ? 'up' : 'down', bob: bob(t) }) },
        { who: 'boy', x: 246, pose: now({ back: true, armR: 'up', armL: cheer ? 'up' : 'down', bob: bob(t) }) },
      ],
      mid: (g) => { lit = shellsOn(g, b, FINALE); },
    });
    ctx.heartBubble(fb, 97, 98, u - 0.2, 1);
    ctx.heartBubble(fb, 153, 94, u - 0.75, -1);
    if (lit.glow > 0) fb.wash(lit.glowCol, 0.12 * lit.glow);
  });

  // ---- 161.7-166: faces in the fireworks' light ------------------------------------------

  const LIGHTS = [0xff9ab0, 0xffd98f, 0x9fe0ff, 0xc9a0ff];
  add(161.7, 166, (fb, t, b) => {
    const awe = b < 1.6, near = b >= 2.8;
    const girl = now({ look: awe ? 0 : 2, eyes: awe ? 'wide' : near ? 'happy' : 'open', mouth: awe ? 'open' : 'smile', blush: awe ? 1 : 2, lean: near ? 1 : 0 });
    const boy = now({ look: awe ? 0 : -2, eyes: awe ? 'wide' : near ? 'happy' : 'open', mouth: awe ? 'open' : near ? 'grin' : 'smile', blush: awe ? 0 : 1, lean: near ? -1 : 0 });
    scene(off, { t, cam: 113, look: NOW_NIGHT, actors: [{ who: 'boy', x: 245, pose: boy }, { who: 'girl', x: 227, pose: girl }] });
    zoom(fb, off, 3, 123, 124);
    // the bursts are behind the camera now: their colours wash over the two, sparks drift down
    const i = Math.floor(b * 2), ph = (b * 2) % 1;
    fb.wash(LIGHTS[i % 4], 0.22 * (1 - ph));
    for (let j = 0; j < 16; j++) {
      const x = Math.floor(world.hash(j, 301) * W), y = Math.floor((world.hash(j, 307) * 170 + t * (18 + world.hash(j, 311) * 16)) % 170);
      if (Math.sin(t * 7 + j) > -0.3) fb.rect(x, y, 2, 2, LIGHTS[(j + i) % 4]);
    }
    if (near) U.risingHearts(fb, 160, 40, (b - 2.8) * P, 3, { rise: 32, spread: 30, outline: INK });
  });

  // ---- 166-171: the self-timer; he runs back --------------------------------------------

  add(166, 171, (fb, t, b) => {
    const step = Math.floor(t / 0.1);
    const girl = { who: 'girl', x: 187, pose: now({ look: 2, mouth: 'smile', bob: bob(t) }) };
    const boy = { who: 'boy', x: 296, pose: now({ look: 0, eyes: 'down', mouth: 'small' }) };
    let hop = 0;
    if (b < 1.5) {
      if (b >= 1) Object.assign(boy.pose, { eyes: 'open', mouth: 'grin', look: -1 });
    } else if (b < 3.5) {
      const k = clamp((b - 1.5) / 2);
      boy.x = Math.round(lerp(296, 205, k));
      Object.assign(boy.pose, { walk: step, dir: -1, look: -2, mouth: 'open', eyes: 'wide' });
      Object.assign(girl.pose, { armR: 'wave', wave: Math.floor(t * 5) % 2, mouth: 'laugh', eyes: 'happy' });
    } else {
      boy.x = 205;
      hop = Math.round(arc((b - 3.5) / 0.3) * 4);
      Object.assign(boy.pose, { look: b < 4.2 ? -1 : 0, mouth: 'grin', eyes: 'happy', blush: 1, bob: bob(t) });
      Object.assign(girl.pose, { look: b < 4.2 ? 1 : 0, mouth: 'laugh', eyes: 'happy', blush: 1 });
    }
    boy.y = G - hop;
    const led = b >= 1 && Math.floor((b - 1) * (b < 3 ? 2 : 4)) % 2 === 0;
    scene(fb, {
      t, cam: 40, look: NOW_NIGHT, actors: [girl, boy], front: { camera: true, led },
      top: (f) => {
        for (let n = 1; n <= 4; n++) {
          const a = b - n;
          if (a >= 0 && a < 0.6) text(f, '嘀', 268, Math.round(122 - a * 14), 0xff8a8a, { outline: INK });
        }
      },
    });
  }, { fade: 0.25 });

  // ---- 171-178: through the viewfinder: the old pose first, then today's ------------------

  const SELFIE_SHELLS = [[0.4, 70, 44, 0xff9ab0, 26], [1.4, 250, 50, 0xffd98f, 26], [2.4, 150, 30, 0x9fe0ff, 24], [3.4, 44, 60, 0xc9a0ff, 22], [4.3, 276, 40, 0xff9ab0, 24], [5.2, 96, 36, 0xffd98f, 24], [6.25, 160, 78, 0xff9ab0, 13], [6.45, 128, 88, 0xffd98f, 12], [6.6, 192, 86, 0x9fe0ff, 12]];
  // flash: the two are lit by the camera's flash instead of the night
  function selfie(f, t, b, flash) {
    const girl = { who: 'girl', x: 187, pose: now({ bob: bob(t, 0.18) }) };
    const boy = { who: 'boy', x: 212, pose: now({ bob: bob(t, 0.18) }) };
    let hop = 0, near = false, peace = false;
    if (b < 1.4) {
      Object.assign(girl.pose, { arms: 'front', mouth: 'small', blush: 1 });
      Object.assign(boy.pose, { mouth: 'small', blush: 1 });
    } else if (b < 2.2) {
      Object.assign(girl.pose, { arms: 'front', look: 2, mouth: 'wavy', blush: 1 });
      Object.assign(boy.pose, { look: -2, mouth: 'wavy', blush: 1 });
    } else if (b < 3) {
      Object.assign(girl.pose, { look: 1, eyes: 'happy', mouth: 'laugh', blush: 1 });
      Object.assign(boy.pose, { look: -1, eyes: 'happy', mouth: 'laugh', blush: 1 });
    } else {
      const k = clamp((b - 3) / 0.3);
      boy.x = Math.round(lerp(212, 204, k));
      hop = Math.round(arc(k) * 4);
      near = k >= 1;
      peace = b >= 5;
      const last = b >= 6;
      Object.assign(girl.pose, { lean: b >= 4 ? 1 : 0, eyes: last ? 'happy' : 'open', mouth: last ? 'laugh' : 'smile', blush: 1, arms: peace ? 'down' : 'front', armL: peace ? 'up' : 'down' });
      Object.assign(boy.pose, { lean: b >= 4 ? -1 : 0, eyes: last ? 'happy' : 'open', mouth: b >= 5 ? 'grin' : 'smile', blush: 1, armL: near ? 'none' : 'down', armR: peace ? 'up' : 'down' });
    }
    boy.y = G - hop;
    const plain = (x) => x;
    if (flash) { girl.pose.grade = plain; boy.pose.grade = plain; }
    scene(f, {
      t, cam: 40, look: NOW_NIGHT, actors: [boy, girl],
      mid: (g) => {
        for (const [tb, x, y, c, size] of SELFIE_SHELLS) props.firework(g, x, y, (b - tb) * P, { col: c, col2: 0xffffff, size, seed: x, fuse: size < 20 ? 0.2 : 0.45, from: size < 20 ? 100 : 96, life: 1.6 });
      },
      over: (g, L) => {
        const c = flash ? plain : L.cg || plain;
        const gx = girl.x - 40, bx = boy.x - 40, gub = girl.pose.bob ? 1 : 0, bub = boy.pose.bob ? 1 : 0;
        if (near) { g.rect(gx - 11, G - 44 + 18 + gub, 3, 3, c(SKIN)); g.rect(gx - 11, G - 44 + 20 + gub, 3, 1, c(SKIN_SH)); }
        if (peace) {
          g.rect(gx - 11, G - 44 + gub, 1, 2, c(SKIN)); g.rect(gx - 9, G - 44 + gub, 1, 2, c(SKIN));
          g.rect(bx + 8, G - 47 + bub - hop, 1, 2, c(SKIN)); g.rect(bx + 10, G - 47 + bub - hop, 1, 2, c(SKIN));
        }
      },
    });
  }
  // the photo this ends in: the frame at the flash
  stage.setNow((f) => selfie(f, ctx.at(178), 7, true));

  add(171, 178, (fb, t, b, u) => {
    selfie(fb, t, b);
    props.viewfinder(fb, t, u, b, { no: 'No.002', count: 4 });
  }, { post: (fb, t, b) => { if (b > 6.96) fb.wash(0xffffff, 0.7); } });

  // ---- 178-182: a second photo, next to the first -----------------------------------------

  const CAPTION2 = '还是' + (cfg.title || '');
  add(178, 182, (fb, t, b, u) => {
    props.desk(fb, t, { book: false, tea: false, pencil: false });
    ctx.opening.bigPolaroid(fb, 26, 18, 1, titleLen + 1);
    const py = Math.round(lerp(-150, 18, easeBack(u / 0.42)));
    const { fw } = props.polaroid(fb, 170, py, stage.photo('now', t), props.PH, { develop: clamp((u - 0.3) / 1.5), tapeCol: 0xf29aa6 });
    const n = [...CAPTION2].length;
    props.photoCaption(fb, 170, py, fw, props.PH.h, CAPTION2, Math.floor(clamp((u - 1.7) / 1.0) * (n + 1) + 0.001));
    text(fb, cfg.stamp, 26 + 62, 134, 0xffe1b0, { align: 'center', outline: INK });
    if (u > 0.5) text(fb, cfg.stamp2, 170 + 62, 134, 0xffe1b0, { align: 'center', outline: INK });
    if (u > 0.42 && u < 1.3) {
      const v = (u - 0.42) / 0.88;
      for (let i = 0; i < 6; i++) U.sparkle(fb, Math.round(232 + Math.cos(i * 1.05 + 0.4) * (70 + v * 14)), Math.round(74 + Math.sin(i * 1.05 + 0.4) * (62 + v * 12)), v < 0.5 ? 2 : 1, 0xfff6d0);
    }
    if (b > 2.6) U.risingHearts(fb, 160, 100, (b - 2.6) * P, 3, { rise: 60, spread: 6, outline: INK, speed: 0.5 });
  }, { post: (fb, t, b, u) => { if (u < 0.5) fb.wash(0xffffff, 1 - easeOut(u / 0.5)); } });

  // ---- 182-186: both of them in the album --------------------------------------------------

  add(182, 186, (fb, t, b) => {
    props.desk(fb, t, { book: false, tea: false, pencil: false });
    const k = easeBack((b - 0.5) / 0.7);
    const left = { id: 'first', corners: true, title: true, chars: 99 };
    const right = { id: 'now', corners: true, dy: Math.round(lerp(-150, 0, k)), show: b > 0.5, doodle: b > 1.7 };
    album.spread(fb, t, left, right, left, right, 0);
    const p = props.pageRect('R');
    const px = p.x + ((p.w - 104) >> 1), py = p.y + 9;
    props.photoCorners(fb, px + 1, py + 1, 102, 90, 0x3d4a66);
    if (b > 1.2) {
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785 + b * 0.4;
        if (Math.floor(t * 6 + i) % 3) U.sparkle(fb, Math.round(160 + Math.cos(a) * 128), Math.round(80 + Math.sin(a) * 66), i % 2 ? 2 : 1, 0xfff6d0);
      }
    }
    if (b > 2) U.risingHearts(fb, 160, 150, (b - 2) * P, 3, { rise: 40, spread: 5, outline: INK, speed: 0.45 });
  }, { fade: 0.4 });

  // ---- 186-192.4: the two of them, and the title --------------------------------------------

  const LAST_SHELLS = [[0.5, 56, 52, 0xff9ab0, 0xffffff, false], [1.7, 268, 62, 0xffd98f, 0xfff6c0, false], [2.9, 96, 66, 0x9fe0ff, 0xffffff, false], [4.0, 292, 46, 0xff5a6a, 0xffb0b8, true], [5.0, 40, 40, 0xc9a0ff, 0xffffff, false]];
  add(186, 192.4, (fb, t, b, u) => {
    let lit = { glow: 0, glowCol: 0 };
    benchBack(fb, t, NOW_NIGHT, { leanG: 2, leanB: -1, mid: (g) => { lit = shellsOn(g, b, LAST_SHELLS); } });
    if (lit.glow > 0) fb.wash(lit.glowCol, 0.07 * lit.glow);
    const chars = Math.floor(clamp((u - 0.3) / 0.9) * titleLen + 0.001);
    if (chars > 0) {
      const w = measure(cfg.title, { scale: 2, spacing: 2 });
      const x0 = Math.round(160 - w / 2), y0 = 12;
      text(fb, cfg.title, x0, y0, 0xfff6e0, { scale: 2, spacing: 2, outline: INK, chars });
      if (chars >= titleLen) {
        const k = clamp((u - 1.4) / 0.3);
        fb.rect(Math.round(160 - (w / 2) * k), y0 + 36, Math.round(w * k), 1, 0xfff6e0);
        if (cfg.artist && u > 1.7) text(fb, cfg.artist, 160, y0 + 39, 0xffe1b0, { align: 'center', outline: INK });
      }
    }
  }, { fade: 0.6 });

  void [THEN, easeInOut];
  return shots;
}

module.exports = { create };
