'use strict';
// Beats 0-16: the evening the first photo was taken, and the print it became.
const { view, viewPoint, print, box, line, frame, disc } = require('./canvas');
const look = require('./look');

const WHITE = [255, 255, 255], GREEN = [150, 255, 120];

// The desk seen by a camera at (x, y) on the 1920x1080 desk picture, zoom z, roll rot.
function deskCam(cam) {
  const c = Math.cos(-(cam.rot || 0)), s = Math.sin(-(cam.rot || 0));
  return {
    view: { cx: cam.x / 1920, cy: cam.y / 1080, zoom: cam.z, rot: cam.rot || 0 },
    z: cam.z,
    rot: cam.rot || 0,
    to(x, y) { const dx = (x - cam.x) * cam.z, dy = (y - cam.y) * cam.z; return [960 + dx * c - dy * s, 540 + dx * s + dy * c]; },
  };
}

// The slight float of a camera held in the hand.
function sway(t, seed) {
  const a = seed * 1.7;
  return {
    x: 0.003 * Math.sin(t * 1.9 + a) + 0.0016 * Math.sin(t * 3.3 + a * 2.1),
    y: 0.0026 * Math.sin(t * 1.6 + a * 1.3) + 0.0014 * Math.sin(t * 2.9 + a * 0.7),
    r: 0.0032 * Math.sin(t * 1.25 + a * 0.9),
  };
}

function create(ctx) {
  const { assets: A, lerp, clamp, ease, cfg } = ctx;
  const at = ctx.at;
  const first = () => A.stamped('y09_first', cfg.stamp || "'09 8 18");
  const PRINT_SRC = { x: 0.078, y: 0, w: 0.844, h: 1 };
  const PRINT = { x: 872, y: 566, w: 740, rot: -0.045, border: 27 };

  // A camera gliding at a steady pace from framing p to framing q ([cx, cy, zoom]); it keeps
  // going at the same pace while a transition overlaps the shot.
  const glide = (seed, p, q, u, t) => {
    const s = sway(t, seed);
    return { cx: lerp(p[0], q[0], u) + s.x, cy: lerp(p[1], q[1], u) + s.y, zoom: lerp(p[2], q[2], u), rot: s.r };
  };
  const still = (seed, id, p, q) => (fb, t, b, u) => view(fb, A.get(id), glide(seed, p, q, u, t));

  ctx.text({ t0: 0.35, t1: at(2) - 0.14, style: 'Title', text: cfg.title || '', pos: [1370, 205], fade: [500, 200], blur: 2, tags: '\\fsp58\\t(0,1500,0.6,\\fsp26)' });
  ctx.text({ t0: 0.7, t1: at(2) - 0.14, style: 'Sub', text: cfg.artist || '', pos: [1370, 330], fade: [500, 200] });

  // the two faces on the camera's screen while the self-timer runs, as fractions of the frame:
  // where they are at first, and after he has edged closer
  const HER = [[0.363, 0.258], [0.398, 0.25]], HIM = [[0.596, 0.17], [0.578, 0.166]];
  const EDGE = [2.85, 3.15];
  {
    const t0 = at(2) + 0.2, t1 = at(4) - 0.05, m0 = (at(EDGE[0]) - t0) * 1000, m1 = (at(EDGE[1]) - t0) * 1000;
    const label = (text, p) => ctx.text({ t0, t1, style: 'Note', text, pos: [p[0][0] * 1920, p[0][1] * 1080 - 108], move: [p[1][0] * 1920, p[1][1] * 1080 - 108, m0, m1], fade: [90, 0] });
    label('你', HER);
    label('我', HIM);
    ctx.text({ t0, t1: at(3), style: 'UI', text: '2', pos: [214, 127], fade: [90, 0], tags: '\\fs76' });
    ctx.text({ t0: at(3), t1, style: 'UI', text: '1', pos: [214, 127], fade: [0, 0], tags: '\\fs76' });
  }

  function printOnDesk(fb, cam, k = 1, alpha = 1) {
    const [x, y] = cam.to(PRINT.x, PRINT.y);
    print(fb, first(), { cx: x, cy: y, w: PRINT.w * cam.z, rot: PRINT.rot - cam.rot, src: PRINT_SRC, border: PRINT.border * cam.z * k, shadow: k, alpha });
  }

  const shots = [];

  // the two of them and the camera on its tripod
  shots.push({
    from: -ctx.O / ctx.P, to: 1,
    draw: still(1, 'y09_tripod', [0.5, 0.5, 1.03], [0.53, 0.51, 1.1]),
  });

  // what they are looking at: the lens, the self-timer lamp blinking
  shots.push({
    from: 1, to: 2, enter: { type: 'punch', dur: 0.5, zoom: 2.4, from: [1480, 600], into: [1240, 565] },
    draw(fb, t, b, u) {
      const img = A.get('y09_lens'), cam = glide(2, [0.48, 0.5, 1.05], [0.52, 0.505, 1.12], u, t);
      view(fb, img, cam);
      const phase = (((b * 2) % 1) + 1) % 1, pulse = clamp(phase / 0.08) * clamp((0.55 - phase) / 0.14);
      const [x, y] = viewPoint(img, cam, 0.665, 0.418);
      box(fb, { cx: x, cy: y, w: 10, h: 10, radius: 5, blur: 70 * cam.zoom, color: [255, 150, 50], alpha: 0.5 * pulse });
      box(fb, { cx: x, cy: y, w: 14, h: 8, radius: 4, blur: 14 * cam.zoom, color: [255, 236, 200], alpha: 0.85 * pulse });
    },
  });

  // through the lens: the camera's screen while the self-timer runs; he edges closer
  shots.push({
    from: 2, to: 4, enter: { type: 'punch', dur: 0.44, zoom: 2.2, from: [1080, 548], into: [1000, 542] },
    draw(fb, t, b) {
      const k = clamp((b - EDGE[0]) / (EDGE[1] - EDGE[0]));
      if (k < 1) view(fb, A.get('y09_pre1'), { zoom: 1 });
      if (k > 0) view(fb, A.get('y09_pre2'), { zoom: 1 }, k);
      const pulse = Math.max(1 - clamp((b - 2.15) / 0.25), b > EDGE[1] ? 1 - clamp((b - EDGE[1]) / 0.25) : 0);
      for (const p of [HER, HIM]) {
        const sz = 132 + 26 * pulse;
        frame(fb, lerp(p[0][0], p[1][0], k) * 1920 - sz / 2, lerp(p[0][1], p[1][1], k) * 1080 - sz / 2, sz, sz, 4, GREEN, 0.9);
      }
      frame(fb, 70, 60, 1780, 960, 5, WHITE, 0.85, 64);
      disc(fb, 132, 126, 34, WHITE, 0.9, 5);
      line(fb, 132, 126, 132, 104, 5, WHITE, 0.9);
      line(fb, 132, 126, 148, 134, 5, WHITE, 0.9);
      line(fb, 124, 84, 140, 84, 5, WHITE, 0.9);
      box(fb, { cx: 1766, cy: 126, w: 76, h: 38, color: WHITE, alpha: 0.9, radius: 5 });
      box(fb, { cx: 1766, cy: 126, w: 66, h: 28, color: [30, 30, 30], alpha: 0.75, radius: 3 });
      box(fb, { cx: 1757, cy: 126, w: 40, h: 20, color: WHITE, alpha: 0.9 });
      box(fb, { cx: 1809, cy: 126, w: 8, h: 18, color: WHITE, alpha: 0.9, radius: 2 });
    },
  });

  // the shutter: the picture, which becomes the print on the desk
  shots.push({
    from: 4, to: 6, enter: { type: 'flash', pre: 0.06, post: 0.5 },
    draw(fb, t, b) {
      const img = first(), LAND = 4.7;
      if (b < LAND) {
        view(fb, img, { zoom: lerp(1.045, 1.0, ease.out((b - 4) / (LAND - 4))) });
        return;
      }
      const k = ease.io((b - LAND) / 0.9), push = (b - LAND) / 1.5;
      const cam = deskCam({ x: lerp(960, 925, push), y: lerp(540, 549, push), z: lerp(1, 1.13, push) });
      view(fb, A.get('desk'), cam.view);
      if (k >= 1) { printOnDesk(fb, cam, 1); return; }
      const [px, py] = cam.to(PRINT.x, PRINT.y);
      const src = { x: lerp(0, PRINT_SRC.x, k), y: 0, w: lerp(1, PRINT_SRC.w, k), h: 1 };
      print(fb, img, { cx: lerp(960, px, k), cy: lerp(540, py, k), w: lerp(1920, PRINT.w * cam.z, k), rot: PRINT.rot * k, src, border: PRINT.border * k, shadow: k, lift: lerp(3, 1, k) });
    },
  });

  // not daring to stand close: the hands, then down to the feet
  shots.push({
    from: 6, to: 7, enter: { type: 'whip', dur: 0.36, dir: 'left' },
    draw: still(5, 'y09_hands', [0.5, 0.55, 1.2], [0.535, 0.578, 1.2]),
  });
  shots.push({
    from: 7, to: 8, enter: { type: 'whip', dur: 0.36, dir: 'up' },
    draw: still(6, 'y09_feet', [0.5, 0.455, 1.12], [0.5, 0.53, 1.12]),
  });

  // close on the print, drifting from her to him
  shots.push({
    from: 8, to: 9, enter: { type: 'leak', dur: 0.6, amount: 0.6, seed: 3 },
    draw(fb, t, b, u) {
      const cam = deskCam({ x: lerp(PRINT.x - 80, PRINT.x + 50, u), y: lerp(PRINT.y - 62, PRINT.y - 52, u), z: lerp(2.2, 2.36, u), rot: 0.05 });
      view(fb, A.get('desk'), cam.view);
      printOnDesk(fb, cam, 1);
      look.leak(fb, t * 1.4, 0.3, 3);
    },
  });

  // into the picture: the two of them looking at it on the camera's screen
  shots.push({
    from: 9, to: 10, enter: { type: 'punch', dur: 0.46, zoom: 2.2, from: [960, 520], into: [945, 495] },
    draw: still(8, 'y09_lcd', [0.49, 0.445, 1.14], [0.485, 0.42, 1.24]),
  });

  shots.push({
    from: 10, to: 11, enter: { type: 'whip', dur: 0.36, dir: 'left' },
    draw: still(9, 'y09_her', [0.45, 0.48, 1.06], [0.475, 0.47, 1.1]),
  });
  shots.push({
    from: 11, to: 12, enter: { type: 'whip', dur: 0.36, dir: 'left' },
    draw: still(10, 'y09_him', [0.485, 0.48, 1.06], [0.51, 0.47, 1.1]),
  });

  // the apple
  const warm = (fb, t) => look.leak(fb, t * 0.9, 0.27 + 0.06 * Math.sin(t * 1.7), 5);
  const lit = (seed, id, p, q) => (fb, t, b, u) => { view(fb, A.get(id), glide(seed, p, q, u, t)); warm(fb, t); };
  shots.push({
    from: 12, to: 13, enter: { type: 'leak', dur: 0.6, amount: 0.5, seed: 5 },
    draw: lit(11, 'y09_give', [0.5, 0.5, 1.05], [0.505, 0.495, 1.14]),
  });
  shots.push({
    from: 13, to: 14, enter: { type: 'punch', dur: 0.46, zoom: 2.0, from: [900, 535], into: [800, 535] },
    draw: lit(12, 'y09_apple', [0.46, 0.5, 1.1], [0.48, 0.49, 1.16]),
  });
  shots.push({
    from: 14, to: 15, enter: { type: 'fade', dur: 0.6 },
    draw: lit(13, 'y09_apple2', [0.5, 0.5, 1.05], [0.485, 0.52, 1.12]),
  });
  shots.push({
    from: 15, to: 16.6, enter: { type: 'fade', dur: 0.7 },
    draw: lit(14, 'y09_walk', [0.5, 0.5, 1.13], [0.5, 0.49, 1.06]),
  });

  return shots;
}

module.exports = { create, deskCam };
