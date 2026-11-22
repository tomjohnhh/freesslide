'use strict';
// The opening stanza as six shots, cut on the song's bar lines:
//   1 riverside, the two walk in        4 inside the photo, close on the faces
//   2 through the viewfinder, 3-2-1     5 two panels, cheeks turning apple-red
//   3 the photo lands on the desk       6 back to the photo

const { bayer } = require('./fb');
const { text, measure } = require('./font');
const { drawGirl, drawBoy } = require('./chars');
const world = require('./world');
const props = require('./props');
const U = require('./util');
const { INK, clamp, lerp, easeOut, easeBack, HEART, APPLE, APPLE_PAL, stampScaled, sparkle } = U;

const W = 320;
const H = 180;
const G = world.GROUND;
const CAM = 40;

function createOpening(ctx) {
  const { cfg, P, O, off, snap, cell, onBeat } = ctx;
  const T1 = O + 4 * P;   // viewfinder
  const T2 = O + 8 * P;   // flash, desk
  const T3 = O + 10 * P;  // inside the photo
  const T4 = O + 12 * P;  // blush panels
  const T5 = O + 15 * P;  // back to the desk
  const END = O + 16 * P;

  function riverside(fb, t, cam, girl, boy, front = {}) {
    world.drawBack(fb, t, cam);
    drawGirl(fb, girl.x - cam, G, girl.pose);
    drawBoy(fb, boy.x - cam, G, boy.pose);
    world.drawFront(fb, t, cam, front);
  }

  function walkers(t) {
    const step = Math.floor(t / 0.16);
    const idleBob = onBeat(t) ? 1 : 0;
    const gT = clamp(t / 2.8);
    const girl = { x: Math.round(lerp(96, 186, gT)), pose: {} };
    if (gT < 1) girl.pose = { walk: step, dir: 1, look: 1 };
    else if (t < 3.3) girl.pose = { look: 1, bob: idleBob, mouth: 'small' };
    else girl.pose = { arms: 'front', look: t < 3.75 ? 1 : 0, bob: idleBob, mouth: 'small', blush: 1 };
    const bT = clamp((t - 0.3) / 3.0);
    const boy = { x: Math.round(lerp(312, 216, bT)), pose: {} };
    if (t < 0.3) boy.pose = { look: -1 };
    else if (bT < 1) boy.pose = { walk: step + 1, dir: -1, look: -1 };
    else boy.pose = { look: t < 3.85 ? -1 : 0, bob: idleBob, mouth: 'small', arms: t > 3.6 ? 'head' : 'down', blush: t > 3.6 ? 1 : 0 };
    return { girl, boy };
  }

  function titleCard(fb, t, y0 = 10) {
    if (!cfg.title || t >= 3.7) return;
    const chars = Math.floor(clamp((t - 0.15) / 0.75) * [...cfg.title].length + 0.001);
    const gone = clamp((t - 3.3) / 0.4);
    if (chars > 0 && gone < 1) {
      const w = measure(cfg.title, { scale: 2, spacing: 2 });
      const x0 = Math.round(160 - w / 2);
      if (gone === 0) {
        text(fb, cfg.title, x0, y0, 0xfff6e0, { scale: 2, spacing: 2, outline: INK, chars });
        if (chars >= [...cfg.title].length) {
          const k = clamp((t - 1.0) / 0.3);
          fb.rect(Math.round(160 - (w / 2) * k), y0 + 36, Math.round(w * k), 1, 0xfff6e0);
          if (cfg.artist && t > 1.25) text(fb, cfg.artist, 160, y0 + 39, 0xffe1b0, { align: 'center', outline: INK });
        }
      } else {
        const tmp = snap;
        tmp.copyFrom(fb);
        text(tmp, cfg.title, x0, y0, 0xfff6e0, { scale: 2, spacing: 2, outline: INK });
        for (let y = y0 - 4; y < y0 + 58; y++) for (let x = x0 - 4; x < x0 + w + 4; x++) if (bayer(x, y) >= gone * 16) fb.set(x, y, tmp.get(x, y));
      }
    }
  }

  function shot1(fb, t) {
    const cam = CAM * easeOut(t / 3.4);
    const { girl, boy } = walkers(t);
    riverside(fb, t, cam, girl, boy, { led: false });
    titleCard(fb, t);
  }

  function posers(t) {
    const idleBob = onBeat(t, 0.18) ? 1 : 0;
    const b = (t - T1) / P; // beats into the shot
    const girl = { x: 186, pose: { arms: 'front', mouth: 'small', bob: idleBob, blush: 1 } };
    const boy = { x: 216, pose: { mouth: 'small', bob: idleBob } };
    const hop = (start) => { const k = (b - start) / 0.22; return k > 0 && k < 1 ? Math.round(Math.sin(k * Math.PI) * 3) : 0; };
    if (b >= 1 && b < 1.5) boy.pose.look = -2;
    if (b >= 1.5) { boy.x = 214; boy.hop = hop(1.5); }
    if (b >= 1.5 && b < 2) { girl.pose.look = 2; boy.pose.look = 2; boy.pose.blush = 1; boy.pose.mouth = 'wavy'; boy.pose.arms = 'head'; }
    if (b >= 2) { boy.pose.blush = 1; girl.pose.blush = 1; }
    if (b >= 2.5) { boy.x = 212; boy.hop = hop(2.5); girl.x = 187; girl.pose.mouth = 'smile'; }
    if (b >= 3) { boy.pose.mouth = 'smile'; girl.pose.mouth = 'smile'; }
    if (b >= 3.5) { boy.pose.mouth = 'grin'; girl.pose.eyes = 'happy'; }
    // an occasional blink
    if (Math.abs(b - 0.6) < 0.06) girl.pose.eyes = 'blink';
    if (Math.abs(b - 2.3) < 0.06) boy.pose.eyes = 'blink';
    return { girl, boy };
  }

  function shot2(fb, t) {
    const { girl, boy } = posers(t);
    world.drawBack(fb, t, CAM);
    drawGirl(fb, girl.x - CAM, G, girl.pose);
    drawBoy(fb, boy.x - CAM, G - (boy.hop || 0), boy.pose);
    world.drawFront(fb, t, CAM, { camera: false });
    props.viewfinder(fb, t, t - T1, (t - T1) / P);
  }

  // the first photo, as it was taken at the flash
  function firstPhoto() {
    if (!ctx.firstReady) {
      const f = ctx.first;
      world.drawBack(f, T2, CAM);
      drawGirl(f, 187 - CAM, G, { arms: 'front', eyes: 'happy', blush: 1, mouth: 'smile' });
      drawBoy(f, 212 - CAM, G, { mouth: 'grin', blush: 1 });
      world.drawFront(f, T2, CAM, { camera: false });
      ctx.firstReady = true;
    }
    return ctx.first;
  }

  function bigPolaroid(fb, px, py, develop, captionChars) {
    const { fw } = props.polaroid(fb, px, py, firstPhoto(), props.PH, { develop });
    props.photoCaption(fb, px, py, fw, props.PH.h, cfg.title, captionChars);
  }

  function shot3(fb, t, u) {
    props.desk(fb, t);
    const drop = easeBack(u / 0.42);
    const py = Math.round(lerp(-150, 14, drop));
    const n = cfg.title ? [...cfg.title].length : 0;
    const cap = Math.floor(clamp((u - 0.55) / 0.9) * (n + 1) + 0.001);
    bigPolaroid(fb, 98, py, clamp((u - 0.25) / 1.0), cap);
    if (u > 0.42 && u < 1.3) {
      const k = (u - 0.42) / 0.88;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + 0.4;
        const r = 66 + k * 18;
        if (Math.floor(u * 12 + i) % 3) sparkle(fb, Math.round(160 + Math.cos(a) * r * 1.15), Math.round(72 + Math.sin(a) * r * 0.8), k < 0.5 ? 2 : 1, 0xfff6d0);
      }
    }
  }

  function shot4(fb, t, u) {
    const b = u / P;
    const girl = { arms: 'front', blush: 1, mouth: 'smile' };
    const boy = { blush: 1, mouth: 'smile' };
    if (b < 0.45) { girl.eyes = 'happy'; boy.mouth = 'grin'; }
    if (b >= 0.45 && b < 1) { boy.look = -2; boy.mouth = 'small'; }
    if (Math.abs(b - 0.7) < 0.06) girl.eyes = 'blink';
    if (b >= 1 && b < 1.5) { girl.look = 2; boy.look = 0; boy.eyes = 'wide'; boy.mouth = 'small'; }
    if (b >= 1.5) { girl.eyes = 'happy'; boy.eyes = 'happy'; boy.mouth = 'grin'; girl.bob = onBeat(t, 0.3); }
    world.drawBack(off, t, CAM);
    drawGirl(off, 187 - CAM, G, girl);
    drawBoy(off, 212 - CAM, G, boy);
    world.drawFront(off, t, CAM, { camera: false, tree: false });
    const scale = u < 0.07 ? 2 : u < 0.14 ? 3 : 4;
    const sw = Math.ceil(W / scale), sh = Math.ceil(H / scale);
    const cx = 160, cy = scale === 4 ? 121 : 118;
    fb.blit(off, cx - (sw >> 1), cy - (sh >> 1), sw, sh, 0, 0, scale);
    // print border and a film date stamp
    const E = 0xf7f1e5;
    fb.rect(0, 0, W, 5, E); fb.rect(0, H - 5, W, 5, E); fb.rect(0, 0, 5, H, E); fb.rect(W - 5, 0, 5, H, E);
    fb.rect(5, 5, W - 10, 1, 0xd8cdb9); fb.rect(5, 5, 1, H - 10, 0xd8cdb9);
    props.dateStamp(fb, W - 12, 8, cfg.stamp);
  }

  function shot5(fb, t, u) {
    const b = u / P;
    props.backdrop(fb, t);
    const girl = { blush: 1, look: 1, mouth: 'small' };
    const boy = { blush: 1, look: -1, mouth: 'small' };
    if (b >= 0.5) { girl.blush = 2; boy.blush = 2; }
    if (b >= 1) { girl.eyes = 'down'; girl.look = -1; girl.mouth = 'wavy'; boy.look = 2; boy.mouth = 'wavy'; boy.arms = 'head'; }
    if (b >= 2) {
      girl.blush = 3; girl.arms = 'cheeks'; girl.eyes = 'happy'; girl.mouth = 'smile'; girl.look = 0;
      boy.blush = 3; boy.eyes = Math.floor(b * 4) % 4 === 1 ? 'blink' : 'wide'; boy.mouth = 'open'; boy.look = 1;
    }
    const shake = b >= 2 && b < 2.2 ? (Math.floor(u * 30) % 2 ? 1 : -1) : 0;
    girl.bob = onBeat(t, 0.2); boy.bob = onBeat(t, 0.2);
    const slide = easeOut(u / 0.28);
    props.panel(fb, cell, Math.round(lerp(-160, 4, slide)), 6 + shake, 'girl', girl, t, { bgA: 0xf9c3bb, bgB: 0xfcd7cf });
    props.panel(fb, cell, Math.round(lerp(W, 162, slide)), 6 - shake, 'boy', boy, t, { bgA: 0xa9c6ef, bgB: 0xc2d7f5 });

    // steam puffs once the cheeks are apple-red
    if (b >= 2) {
      for (let i = 0; i < 6; i++) {
        const ph = ((t * 0.9 + i * 0.31) % 1);
        const px = (i % 2 ? 196 : 38) + (i >> 1) * 44 + Math.round(Math.sin(ph * 6 + i) * 3);
        const py = 34 - Math.round(ph * 24);
        if (px > 150 && px < 172) continue;
        const r = ph < 0.5 ? 3 : 2;
        fb.disc(px, py, r, 0xffffff); fb.disc(px + 3, py + 1, r - 1, 0xffffff);
      }
    }
    // the apple pops in between the panels, then a heart
    if (b >= 1) {
      const k = easeBack((b - 1) / 0.3);
      const s = k < 0.5 ? 1 : k < 0.95 ? 2 : 3;
      const bounce = Math.round(Math.abs(Math.sin((b - 1) * Math.PI)) * -3);
      const ax = 160 - Math.floor((13 * s) / 2), ay = 70 - 7 * s + bounce;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) stampScaled(fb, ax + dx * s, ay + dy * s, APPLE, { R: INK, D: INK, H: INK, W: INK, S: INK, L: INK }, s);
      stampScaled(fb, ax, ay, APPLE, APPLE_PAL, s);
      if (b < 1.6) for (let i = 0; i < 5; i++) sparkle(fb, Math.round(160 + Math.cos(i * 1.26 + 0.3) * (20 + (b - 1) * 26)), Math.round(70 + Math.sin(i * 1.26 + 0.3) * (18 + (b - 1) * 22)), 1, 0xfff6d0);
    }
    if (b >= 2) {
      for (let i = 0; i < 5; i++) {
        const ph = ((b - 2) * 0.55 + i * 0.21) % 1;
        const hx = 160 + Math.round(Math.sin(ph * 5 + i * 2) * 14) - 3;
        const hy = 118 - Math.round(ph * 60);
        if (ph < 0.9) { fb.stamp(hx - 1, hy, HEART, { X: INK }); fb.stamp(hx + 1, hy, HEART, { X: INK }); fb.stamp(hx, hy - 1, HEART, { X: INK }); fb.stamp(hx, hy + 1, HEART, { X: INK }); fb.stamp(hx, hy, HEART, { X: i % 2 ? 0xff8f9c : 0xe5504a }); }
      }
    }
  }

  function shot6(fb, t, u) {
    props.desk(fb, t);
    const n = cfg.title ? [...cfg.title].length : 0;
    bigPolaroid(fb, 98, 14, 1, n + 1);
    for (let i = 0; i < 3; i++) {
      const ph = (u * 0.6 + i * 0.33) % 1;
      const hx = 206 + i * 9 + Math.round(Math.sin(ph * 6 + i) * 2), hy = 120 - Math.round(ph * 30);
      if (ph < 0.8) fb.stamp(hx, hy, HEART, { X: i % 2 ? 0xff8f9c : 0xe5504a });
    }
  }

  function tag(fb) {
    if (!cfg.title) return;
    const s = '♪ ' + cfg.title + (cfg.artist ? ' · ' + cfg.artist : '');
    text(fb, s, 7, 4, 0xfff6e0, { outline: INK });
  }

  function frame(fb, t) {
    if (t < T1) { shot1(fb, t); if (t > 3.7) tag(fb); }
    else if (t < T2) shot2(fb, t);
    else if (t < T3) { shot3(fb, t, t - T2); tag(fb); }
    else if (t < T4) shot4(fb, t, t - T3);
    else if (t < T5) shot5(fb, t, t - T4);
    else { shot6(fb, t, t - T5); tag(fb); }
  }

  // washes that belong to the opening's cuts; applied after the lyric line is drawn
  function post(fb, t) {
    if (t >= T2 - 0.04 && t < T2 + 0.5) fb.wash(0xffffff, t < T2 ? 0.7 : 1 - easeOut((t - T2) / 0.5));
    if (t >= T5 && t < T5 + 0.2) fb.wash(0xfff6e0, 0.6 * (1 - (t - T5) / 0.2));
    if (t < 0.35) fb.wash(0x0b0814, 1 - t / 0.35);
  }

  return { frame, post, end: END, firstPhoto, bigPolaroid, titleCard, tag, marks: { T1, T2, T3, T4, T5, END } };
}

module.exports = { createOpening };
