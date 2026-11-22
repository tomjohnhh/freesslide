'use strict';
// Beats 0-16: the evening the first photo was taken, and the print it became.
const { view, print, box, line, frame, disc } = require('./canvas');
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

function create(ctx) {
  const { assets: A, lerp, clamp, ease, cfg } = ctx;
  const at = ctx.at;
  const first = () => A.stamped('y09_first', cfg.stamp || "'09 8 18");
  const PRINT_SRC = { x: 0.078, y: 0, w: 0.844, h: 1 };
  const PRINT = { x: 872, y: 566, w: 740, rot: -0.045, border: 27 };

  ctx.text({ t0: 0.35, t1: at(2), style: 'Title', text: cfg.title || '', pos: [1400, 205], fade: [500, 220], blur: 2, tags: '\\fsp58\\t(0,1500,0.6,\\fsp26)' });
  ctx.text({ t0: 0.7, t1: at(2), style: 'Sub', text: cfg.artist || '', pos: [1400, 330], fade: [500, 220] });

  // faces in the two viewfinder pictures, as fractions of the frame
  const FACES = [
    { from: 2, to: 3, img: 'y09_pre1', her: [0.363, 0.258], him: [0.596, 0.17], count: '2' },
    { from: 3, to: 4, img: 'y09_pre2', her: [0.398, 0.25], him: [0.578, 0.166], count: '1' },
  ];
  for (const f of FACES) {
    const t0 = at(f.from), t1 = at(f.to);
    ctx.text({ t0, t1, style: 'Note', text: '你', pos: [f.her[0] * 1920, f.her[1] * 1080 - 108], fade: [60, 0] });
    ctx.text({ t0, t1, style: 'Note', text: '我', pos: [f.him[0] * 1920, f.him[1] * 1080 - 108], fade: [60, 0] });
    ctx.text({ t0, t1, style: 'UI', text: f.count, pos: [214, 127], fade: [0, 0], tags: '\\fs76' });
  }

  function printOnDesk(fb, cam, k = 1, alpha = 1) {
    const [x, y] = cam.to(PRINT.x, PRINT.y);
    print(fb, first(), { cx: x, cy: y, w: PRINT.w * cam.z, rot: PRINT.rot - cam.rot, src: PRINT_SRC, border: PRINT.border * cam.z * k, shadow: k, alpha });
  }

  const shots = [];

  shots.push({
    from: -ctx.O / ctx.P, to: 2,
    draw(fb, t, b, u) {
      view(fb, A.get('y09_tripod'), { cx: lerp(0.5, 0.487, u), cy: lerp(0.5, 0.472, u), zoom: lerp(1.0, 1.065, u) });
    },
  });

  // the camera's screen while the self-timer runs: he edges closer
  shots.push({
    from: 2, to: 4,
    draw(fb, t, b) {
      const f = b < 3 ? FACES[0] : FACES[1];
      view(fb, A.get(f.img), { zoom: 1 });
      const pulse = 1 - clamp((b - f.from) / 0.25);
      for (const p of [f.her, f.him]) {
        const sz = 132 + 26 * pulse;
        frame(fb, p[0] * 1920 - sz / 2, p[1] * 1080 - sz / 2, sz, sz, 4, GREEN, 0.9);
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
      if ((b % 1) < 0.12) look.flash(fb, 0.1);
    },
  });

  // the shutter: the picture, then the print on the desk
  shots.push({
    from: 4, to: 8,
    draw(fb, t, b) {
      const img = first();
      if (b < 5.2) {
        view(fb, img, { zoom: lerp(1.05, 1.0, ease.out((b - 4) / 1.2)) });
      } else {
        const k = ease.io((b - 5.2) / 1.1);
        const push = ease.io((b - 6.0) / 2.0);
        const cam = deskCam({ x: lerp(960, PRINT.x + 20, push), y: lerp(540, PRINT.y - 6, push), z: lerp(1, 1.24, push) });
        view(fb, A.get('desk'), cam.view);
        if (k >= 1) printOnDesk(fb, cam, 1);
        else {
          const [px, py] = cam.to(PRINT.x, PRINT.y);
          const src = { x: lerp(0, PRINT_SRC.x, k), y: 0, w: lerp(1, PRINT_SRC.w, k), h: 1 };
          print(fb, img, { cx: lerp(960, px, k), cy: lerp(540, py, k), w: lerp(1920, PRINT.w * cam.z, k), rot: PRINT.rot * k, src, border: PRINT.border * k, shadow: k, lift: lerp(3, 1, k) });
        }
      }
      look.flash(fb, Math.pow(clamp(1 - (b - 4) / 0.5), 1.6));
    },
  });

  // close on the print, drifting from her to him
  shots.push({
    from: 8, to: 10,
    draw(fb, t, b, u) {
      const cam = deskCam({ x: lerp(PRINT.x - 96, PRINT.x + 104, ease.io(u)), y: PRINT.y - 62, z: 2.3, rot: 0.05 });
      view(fb, A.get('desk'), cam.view);
      printOnDesk(fb, cam, 1);
      look.leak(fb, t * 1.4, 0.5 * (1 - u * 0.5), 3);
      look.flash(fb, 0.3 * clamp(1 - (b - 8) / 0.22));
    },
  });

  shots.push({
    from: 10, to: 11,
    draw(fb, t, b, u) {
      view(fb, A.get('y09_her'), { cx: lerp(0.48, 0.46, ease.out(u)), cy: lerp(0.49, 0.47, ease.out(u)), zoom: lerp(1.03, 1.1, ease.out(u)) });
      look.flash(fb, 0.45 * clamp(1 - (b - 10) / 0.2));
    },
  });
  shots.push({
    from: 11, to: 12,
    draw(fb, t, b, u) {
      view(fb, A.get('y09_him'), { cx: lerp(0.5, 0.51, ease.out(u)), cy: lerp(0.49, 0.47, ease.out(u)), zoom: lerp(1.03, 1.1, ease.out(u)) });
      look.flash(fb, 0.45 * clamp(1 - (b - 11) / 0.2));
    },
  });

  shots.push({
    from: 12, to: 14.3, fade: 0.4,
    draw(fb, t, b) {
      const u = clamp((b - 12) / 2.8);
      view(fb, A.get('y09_apple'), { cx: lerp(0.5, 0.47, u), cy: lerp(0.5, 0.49, u), zoom: lerp(1.0, 1.08, u) });
      look.leak(fb, t * 0.9, 0.3 + 0.08 * Math.sin(t * 1.7), 5);
    },
  });
  shots.push({
    from: 14.3, to: 17, fade: 0.55,
    draw(fb, t, b) {
      const u = clamp((b - 14.3) / 2.7);
      view(fb, A.get('y09_apple2'), { cx: lerp(0.47, 0.5, u), cy: lerp(0.44, 0.48, u), zoom: lerp(1.12, 1.03, ease.out(u)) });
      look.leak(fb, t * 0.9 + 2, 0.3, 8);
    },
  });

  return shots;
}

module.exports = { create, deskCam };
