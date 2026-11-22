'use strict';
// The opening stanza as six shots, cut on the song's bar lines:
//   1 riverside, the two walk in        4 inside the photo, close on the faces
//   2 through the viewfinder, 3-2-1     5 two panels, cheeks turning apple-red
//   3 the photo lands on the desk       6 back to the photo, fade out
// cfg = { period, offset, title, artist, lines: [{ t0, t1, text }] } where period/offset
// describe the beat grid in seconds. Lyrics come from cfg only; none are stored in the code.

const { FB, bayer } = require('./fb');
const { text, measure } = require('./font');
const { drawGirl, drawBoy } = require('./chars');
const world = require('./world');

const W = 320;
const H = 180;
const G = world.GROUND;
const CAM = 40;
const INK = 0x1b1530;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeBack = (x) => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
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

function stampScaled(fb, x, y, rows, pal, scale) {
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < rows[r].length; i++) {
      const ch = rows[r][i];
      if (ch === '.') continue;
      fb.rect(x + i * scale, y + r * scale, scale, scale, pal[ch]);
    }
  }
}

function sparkle(fb, x, y, size, c) {
  fb.set(x, y, c);
  for (let i = 1; i <= size; i++) { fb.set(x - i, y, c); fb.set(x + i, y, c); fb.set(x, y - i, c); fb.set(x, y + i, c); }
}

function createShow(cfg) {
  const P = cfg.period;
  const O = cfg.offset;
  const T1 = O + 4 * P;   // viewfinder
  const T2 = O + 8 * P;   // flash, desk
  const T3 = O + 10 * P;  // inside the photo
  const T4 = O + 12 * P;  // blush panels
  const T5 = O + 15 * P;  // back to the desk
  const END = O + 16 * P;
  const beatPhase = (t) => { const b = (t - O) / P; return b - Math.floor(b); };
  const onBeat = (t, len = 0.22) => t >= O && beatPhase(t) < len;

  const off = new FB(W, H);
  const snap = new FB(W, H);
  const cell = new FB(30, 28);
  let photoReady = false;

  // ---- shot 1 and 2: the riverside -------------------------------------------------

  function riverside(fb, t, cam, girl, boy, front = {}) {
    world.drawBack(fb, t, cam);
    const gx = girl.x - cam, bx = boy.x - cam;
    // sun glow wrapping behind the pair
    drawGirl(fb, gx, G, girl.pose);
    drawBoy(fb, bx, G, boy.pose);
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

  function shot1(fb, t) {
    const cam = CAM * easeOut(t / 3.4);
    const { girl, boy } = walkers(t);
    riverside(fb, t, cam, girl, boy, { led: false });
    // title card
    if (cfg.title && t < 3.7) {
      const chars = Math.floor(clamp((t - 0.15) / 0.75) * [...cfg.title].length + 0.001);
      const gone = clamp((t - 3.3) / 0.4);
      if (chars > 0 && gone < 1) {
        const w = measure(cfg.title, { scale: 2, spacing: 2 });
        const x0 = Math.round(160 - w / 2);
        if (gone === 0) {
          text(fb, cfg.title, x0, 10, 0xfff6e0, { scale: 2, spacing: 2, outline: INK, chars });
          if (chars >= [...cfg.title].length) {
            const k = clamp((t - 1.0) / 0.3);
            fb.rect(Math.round(160 - (w / 2) * k), 46, Math.round(w * k), 1, 0xfff6e0);
            if (cfg.artist && t > 1.25) text(fb, cfg.artist, 160, 49, 0xffe1b0, { align: 'center', outline: INK });
          }
        } else {
          // dissolve
          const tmp = snap;
          tmp.copyFrom(fb);
          text(tmp, cfg.title, x0, 10, 0xfff6e0, { scale: 2, spacing: 2, outline: INK });
          for (let y = 6; y < 68; y++) for (let x = x0 - 4; x < x0 + w + 4; x++) if (bayer(x, y) >= gone * 16) fb.set(x, y, tmp.get(x, y));
        }
      }
    }
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

  function viewfinder(fb, t) {
    const u = t - T1;
    const b = u / P;
    const C = 0xffffff;
    // frame corners
    const x0 = 22, y0 = 12, x1 = W - 23, y1 = 150, L = 14;
    for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      fb.rect(dx > 0 ? x : x - L + 1, dy > 0 ? y : y - 1, L, 2, C);
      fb.rect(dx > 0 ? x : x - 1, dy > 0 ? y : y - L + 1, 2, L, C);
    }
    // focus box closing in on the pair, then locking green
    const k = easeOut(u / 0.55);
    const locked = u > 0.75;
    const blink = !locked && u > 0.55 && Math.floor(u * 16) % 2 === 0;
    const fw = Math.round(lerp(120, 70, k)), fh = Math.round(lerp(96, 62, k));
    const fx = 160 - (fw >> 1), fy = 126 - (fh >> 1) - 6;
    const fc = locked ? 0x8dffa8 : 0xfff2b0;
    if (!blink) {
      for (const [x, y, dx, dy] of [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]]) {
        fb.rect(dx > 0 ? x : x - 6, y, 7, 1, fc);
        fb.rect(x, dy > 0 ? y : y - 6, 1, 7, fc);
      }
    }
    // centre cross
    fb.rect(158, 80, 5, 1, C); fb.rect(160, 78, 1, 5, C);
    // status line
    const recOn = Math.floor(t * 2.5) % 2 === 0;
    if (recOn) fb.disc(31, 23, 2, 0xff4d4d);
    text(fb, '定时自拍', 37, 15, C, { outline: INK });
    text(fb, 'No.001', W - 62, 15, C, { align: 'right', outline: INK });
    fb.rect(W - 56, 18, 18, 9, INK); fb.rect(W - 55, 19, 16, 7, C); fb.rect(W - 54, 20, 14, 5, INK);
    fb.rect(W - 38, 21, 2, 3, C);
    fb.rect(W - 53, 21, 9, 3, 0x8dffa8);
    text(fb, 'F2.8  1/125', 30, 134, C, { outline: INK });
    text(fb, 'ISO 200', W - 31, 134, C, { align: 'right', outline: INK });
    // countdown on the last three beats
    if (b >= 1 && b < 4) {
      const n = String(4 - Math.floor(b));
      const pop = (b % 1) < 0.1 ? 4 : 3;
      const w = measure(n, { scale: pop });
      text(fb, n, Math.round(160 - w / 2), pop === 4 ? 18 : 24, 0xfff6e0, { scale: pop, outline: INK });
    }
  }

  function shot2(fb, t) {
    const { girl, boy } = posers(t);
    world.drawBack(fb, t, CAM);
    drawGirl(fb, girl.x - CAM, G, girl.pose);
    drawBoy(fb, boy.x - CAM, G - (boy.hop || 0), boy.pose);
    world.drawFront(fb, t, CAM, { camera: false });
    viewfinder(fb, t);
  }

  // ---- shot 3 and 6: the photo on the desk ----------------------------------------

  const PH = { x: 104, y: 68, w: 112, h: 84 };

  function takePhoto() {
    if (photoReady) return;
    world.drawBack(off, T2, CAM);
    drawGirl(off, 187 - CAM, G, { arms: 'front', eyes: 'happy', blush: 1, mouth: 'smile' });
    drawBoy(off, 212 - CAM, G, { mouth: 'grin', blush: 1 });
    world.drawFront(off, T2, CAM, { camera: false });
    photoReady = true;
  }

  function desk(fb, t) {
    for (let y = 0; y < H; y++) {
      const plank = Math.floor((y + 8) / 32);
      const base = [0x6f4a3a, 0x77513f, 0x694537, 0x73503e, 0x6c4839, 0x755140][plank % 6];
      fb.rect(0, y, W, 1, base);
      if ((y + 8) % 32 === 0) fb.rect(0, y, W, 1, 0x452b27);
      if ((y + 8) % 32 === 1) fb.rect(0, y, W, 1, 0x8b6349);
    }
    for (let i = 0; i < 150; i++) {
      const x = Math.floor(world.hash(i, 3) * W), y = Math.floor(world.hash(i, 5) * H), len = 5 + Math.floor(world.hash(i, 9) * 26);
      if ((y + 8) % 32 < 2) continue;
      fb.rect(x, y, len, 1, world.hash(i, 1) > 0.5 ? 0x5e3c31 : 0x82593f);
    }
    for (let p = 0; p < 6; p++) {
      const x = 30 + Math.floor(world.hash(p, 77) * 260);
      fb.rect(x, p * 32 - 6, 1, 30, 0x452b27);
    }
    // lamp light from the upper left, darker towards the lower right
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - 120) / 250, (y - 56) / 170);
        if (d > 0.5) fb.blend(x, y, 0x24121a, Math.min(4, Math.floor((d - 0.5) * 9)) * 0.11);
        else if (d < 0.26) fb.blend(x, y, 0xffc98a, d < 0.14 ? 0.14 : 0.07);
      }
    }

    // a book with the album tucked inside
    fb.rectA(17, 51, 62, 86, 0x1a0c12, 0.4);
    fb.rect(12, 46, 62, 86, 0x2f6052);
    fb.rect(12, 46, 62, 2, 0x4a8a72); fb.rect(12, 46, 2, 86, 0x4a8a72);
    fb.rect(72, 48, 2, 84, 0x1f4339); fb.rect(14, 130, 60, 2, 0x1f4339);
    fb.rect(74, 49, 3, 84, 0xf1e9d8); fb.rect(15, 132, 62, 3, 0xf1e9d8);
    fb.rect(74, 52, 3, 1, 0xcfc4ad); fb.rect(74, 90, 3, 1, 0xcfc4ad); fb.rect(40, 133, 20, 1, 0xcfc4ad);
    fb.rect(18, 52, 50, 1, 0x4a8a72); fb.rect(18, 125, 50, 1, 0x4a8a72);
    fb.rect(22, 70, 42, 22, 0xf1e9d8); fb.rect(22, 70, 42, 1, 0xcfc4ad);
    text(fb, '相册', 43, 73, 0x3d4a66, { align: 'center' });
    fb.rect(52, 132, 4, 16, 0xd9574c); fb.rect(52, 146, 2, 2, 0x6f4a3a); fb.rect(54, 147, 2, 1, 0xd9574c);

    // tea
    fb.ellipseA(268, 40, 21, 20, 0x1a0c12, 0.35);
    fb.disc(264, 36, 19, 0xe8e0d2); fb.disc(264, 36, 17, 0xf7f2e8); fb.disc(264, 36, 13, 0xe1d8c8);
    fb.disc(264, 36, 12, 0xf9f5ec); fb.disc(264, 36, 10, 0xb86a33); fb.ellipse(261, 33, 5, 3, 0xcf8444);
    fb.rect(276, 33, 7, 6, 0xf9f5ec); fb.rect(278, 35, 3, 2, 0xe1d8c8);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.5 + i * 0.37) % 1;
      const sx = 258 + i * 6 + Math.round(Math.sin(ph * 6.28 + i) * 2);
      const sy = 28 - Math.round(ph * 22);
      if (ph < 0.85) { fb.blend(sx, sy, 0xffffff, 0.55 * (1 - ph)); fb.blend(sx, sy - 1, 0xffffff, 0.4 * (1 - ph)); }
    }

    // pencil
    fb.rectA(240, 127, 56, 3, 0x1a0c12, 0.35);
    fb.rect(240, 122, 5, 4, 0xf29aa6); fb.rect(245, 122, 3, 4, 0xc9c9d6);
    fb.rect(248, 122, 36, 4, 0xf4c34f); fb.rect(248, 122, 36, 1, 0xffe08a); fb.rect(248, 125, 36, 1, 0xc9952f);
    fb.rect(284, 122, 3, 4, 0xe9c9a0); fb.rect(287, 123, 2, 2, 0xe9c9a0); fb.rect(289, 123, 2, 2, 0x3d3a4a);
  }

  function polaroid(fb, px, py, develop, captionChars) {
    const fw = PH.w + 12, fh = PH.h + 28;
    fb.rectA(px + 4, py + 5, fw, fh, 0x1a0c12, 0.42);
    fb.rect(px, py, fw, fh, 0xf7f1e5);
    fb.rect(px + fw - 1, py, 1, fh, 0xd8cdb9); fb.rect(px, py + fh - 1, fw, 1, 0xd8cdb9);
    fb.rect(px + 5, py + 5, PH.w + 2, PH.h + 2, 0xd8cdb9);
    const ix = px + 6, iy = py + 6;
    for (let y = 0; y < PH.h; y++) {
      for (let x = 0; x < PH.w; x++) {
        const shown = develop >= 1 || bayer(x, y) + world.hash(x >> 2, y >> 2) * 3 < develop * 19;
        fb.set(ix + x, iy + y, shown ? off.get(PH.x + x, PH.y + y) : 0xe9dfd0);
      }
    }
    // washi tape
    fb.rectA(px + fw / 2 - 16, py - 5, 32, 9, 0xf6d06a, 0.82);
    for (let i = 0; i < 32; i += 4) fb.rectA(px + fw / 2 - 16 + i, py - 5, 2, 9, 0xfff0b8, 0.6);
    // handwritten caption
    if (captionChars > 0 && cfg.title) {
      const n = [...cfg.title].length;
      const w = measure(cfg.title, { spacing: 1 }) + 12;
      const cx = Math.round(px + fw / 2 - w / 2);
      text(fb, cfg.title, cx, py + PH.h + 9, 0x3d4a78, { spacing: 1, chars: captionChars });
      if (captionChars > n) fb.stamp(cx + w - 8, py + PH.h + 14, HEART, { X: 0xe5504a });
    }
  }

  function shot3(fb, t, u) {
    takePhoto();
    desk(fb, t);
    const drop = easeBack(u / 0.42);
    const py = Math.round(lerp(-150, 14, drop));
    const n = cfg.title ? [...cfg.title].length : 0;
    const cap = Math.floor(clamp((u - 0.55) / 0.9) * (n + 1) + 0.001);
    polaroid(fb, 98, py, clamp((u - 0.25) / 1.0), cap);
    if (u > 0.42 && u < 1.3) {
      const k = (u - 0.42) / 0.88;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + 0.4;
        const r = 66 + k * 18;
        if (Math.floor(u * 12 + i) % 3) sparkle(fb, Math.round(160 + Math.cos(a) * r * 1.15), Math.round(72 + Math.sin(a) * r * 0.8), k < 0.5 ? 2 : 1, 0xfff6d0);
      }
    }
  }

  // ---- shot 4: inside the photo ---------------------------------------------------

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
    photoReady = false;
    const scale = u < 0.07 ? 2 : u < 0.14 ? 3 : 4;
    const sw = Math.ceil(W / scale), sh = Math.ceil(H / scale);
    const cx = 160, cy = scale === 4 ? 121 : 118;
    fb.blit(off, cx - (sw >> 1), cy - (sh >> 1), sw, sh, 0, 0, scale);
    // print border and a film date stamp
    const E = 0xf7f1e5;
    fb.rect(0, 0, W, 5, E); fb.rect(0, H - 5, W, 5, E); fb.rect(0, 0, 5, H, E); fb.rect(W - 5, 0, 5, H, E);
    fb.rect(5, 5, W - 10, 1, 0xd8cdb9); fb.rect(5, 5, 1, H - 10, 0xd8cdb9);
    if (cfg.stamp) text(fb, cfg.stamp, W - 12, 8, 0xffa63d, { align: 'right', outline: 0x7a3a1a });
  }

  // ---- shot 5: two panels ---------------------------------------------------------

  function panel(fb, x, y, who, pose, t, bgA, bgB) {
    cell.clear(bgA);
    for (let cy = 0; cy < cell.h; cy++) {
      for (let cx = 0; cx < cell.w; cx++) {
        const yy = cy + Math.floor(t * 4);
        if (((cx + (who === 'girl' ? 0 : 2)) % 6 === 0) && (yy % 6 === 0)) cell.set(cx, cy, bgB);
        if (((cx + 3 + (who === 'girl' ? 0 : 2)) % 6 === 0) && ((yy + 3) % 6 === 0)) cell.set(cx, cy, bgB);
      }
    }
    if (who === 'girl') drawGirl(cell, 15, 47, { ...pose, shadow: false });
    else drawBoy(cell, 14, 50, { ...pose, shadow: false });
    fb.rectA(x + 3, y + 4, 154, 144, 0x120a1c, 0.5);
    fb.rect(x, y, 154, 144, 0xf7f1e5);
    fb.blit(cell, 0, 0, 30, 28, x + 2, y + 2, 5);
  }

  function shot5(fb, t, u) {
    const b = u / P;
    // backdrop
    fb.clear(0x2b2040);
    for (let y = 0; y < H; y++) for (let x = (y + Math.floor(t * 10)) % 8; x < W; x += 8) fb.set(x, y, 0x3a2c55);
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
    panel(fb, Math.round(lerp(-160, 4, slide)), 6 + shake, 'girl', girl, t, 0xf9c3bb, 0xfcd7cf);
    panel(fb, Math.round(lerp(W, 162, slide)), 6 - shake, 'boy', boy, t, 0xa9c6ef, 0xc2d7f5);

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
    takePhoto();
    desk(fb, t);
    const n = cfg.title ? [...cfg.title].length : 0;
    polaroid(fb, 98, 14, 1, n + 1);
    for (let i = 0; i < 3; i++) {
      const ph = (u * 0.6 + i * 0.33) % 1;
      const hx = 206 + i * 9 + Math.round(Math.sin(ph * 6 + i) * 2), hy = 120 - Math.round(ph * 30);
      if (ph < 0.8) fb.stamp(hx, hy, HEART, { X: i % 2 ? 0xff8f9c : 0xe5504a });
    }
  }

  // ---- overlays -------------------------------------------------------------------

  function lyric(fb, t) {
    if (!cfg.lines) return;
    for (const ln of cfg.lines) {
      if (t < ln.t0 || t >= ln.t1) continue;
      const n = [...ln.text].length;
      const reveal = Math.min(2.4, (ln.t1 - ln.t0) * 0.6);
      const chars = Math.max(1, Math.ceil(clamp((t - ln.t0) / reveal) * n));
      const w = measure(ln.text);
      const x0 = Math.round(160 - w / 2);
      fb.rectA(x0 - 8, 159, w + 16, 18, INK, 0.45);
      fb.rectA(x0 - 9, 160, 1, 16, INK, 0.45);
      fb.rectA(x0 + w + 8, 160, 1, 16, INK, 0.45);
      text(fb, ln.text, x0, 160, 0xffffff, { outline: INK, chars });
    }
  }

  function tag(fb) {
    if (!cfg.title) return;
    const s = '♪ ' + cfg.title + (cfg.artist ? ' · ' + cfg.artist : '');
    text(fb, s, 7, 4, 0xfff6e0, { outline: INK });
  }

  function frame(fb, t) {
    fb.ox = 0; fb.oy = 0; fb.unclip();
    if (t < T1) { shot1(fb, t); if (t > 3.7) tag(fb); }
    else if (t < T2) shot2(fb, t);
    else if (t < T3) { shot3(fb, t, t - T2); tag(fb); }
    else if (t < T4) shot4(fb, t, t - T3);
    else if (t < T5) shot5(fb, t, t - T4);
    else { shot6(fb, t, t - T5); tag(fb); }
    lyric(fb, t);
    // camera flash into the desk shot, soft cuts elsewhere
    if (t >= T2 - 0.04 && t < T2 + 0.5) fb.wash(0xffffff, t < T2 ? 0.7 : 1 - easeOut((t - T2) / 0.5));
    if (t >= T5 && t < T5 + 0.2) fb.wash(0xfff6e0, 0.6 * (1 - (t - T5) / 0.2));
    if (t < 0.35) fb.wash(0x0b0814, 1 - t / 0.35);
    const fade = clamp((t - (END - 0.55)) / 0.5);
    if (fade > 0) fb.wash(0x0b0814, fade);
  }

  return { frame, duration: END, marks: { T1, T2, T3, T4, T5, END } };
}

module.exports = { createShow, W, H };
