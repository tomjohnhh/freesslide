'use strict';
// The two characters, drawn as vector shapes with flat anime colouring: a base colour, one
// shadow tone, dark outlines and a warm rim of light on the side facing the sun.
//
// A figure is drawn in its own units: the head is 100 high, the feet stand at (0, 0), up is
// negative y. pose: {
//   x, y, k            where the feet are on the stage, and stage units per figure unit
//   back, flip, lean   seen from behind; mirrored; tilt of the whole body (radians)
//   tilt, turn, nod    head: roll (radians), looking sideways -1..1, down/up -1..1
//   eyes               'open' | 'smile' | 'shut'; look: [x, y] -1..1; blink 0..1
//   brow               -1 worried .. 1 raised
//   mouth              'smile' | 'open' | 'small' | 'wavy' | 'o'
//   blush              0..1
//   armL, armR         the arm on the left / right of the picture: { hand: [x, y] } where the hand
//                      is (figure units), { elbow: [x, y] } to place the elbow too, { front: true }
//                      to draw it over the head, { curl } how closed the fingers are, { handAngle };
//                      default: hanging
//   wind, t            strength and time for hair and skirt
//   sit                only the upper body (the legs are hidden)
//   light              [dx, dy] direction the rim light comes from (stage), rim: its colour
//   tone               [r, g, b] factors applied to every colour (the light of the scene)
// }
const { P } = require('./draw');
const R = require('./raster');

const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

const LOOKS = {
  her: {
    height: 596, shoulder: 45, waistY: -384, waist: 32, hipY: -330, hip: 44, kneeY: -172, upper: 98, fore: 92,
    skin: [255, 228, 210], skinS: [238, 184, 168], hair: [48, 40, 62], hairS: [30, 25, 42], hairL: [110, 96, 150],
    iris: [[0, [58, 32, 26]], [0.45, [132, 76, 44]], [1, [236, 170, 96]]],
    top: [249, 226, 140], topS: [222, 186, 106], under: [253, 251, 246], underS: [214, 208, 228],
    shoe: [250, 250, 250], shoeS: [205, 205, 220], sole: [230, 226, 222], eyeH: 10.4, eyeW: 9.6,
  },
  him: {
    height: 642, shoulder: 57, waistY: -414, waist: 41, hipY: -360, hip: 45, kneeY: -186, upper: 108, fore: 100,
    skin: [252, 220, 198], skinS: [228, 172, 150], hair: [40, 36, 48], hairS: [26, 23, 34], hairL: [92, 86, 118],
    iris: [[0, [30, 28, 40]], [0.5, [70, 66, 92]], [1, [150, 150, 190]]],
    top: [170, 200, 238], topS: [124, 156, 208], under: [250, 250, 250], underS: [208, 208, 226],
    legs: [66, 82, 128], legsS: [46, 58, 98],
    shoe: [62, 62, 78], shoeS: [44, 44, 58], sole: [236, 234, 230], eyeH: 7.6, eyeW: 9.2,
  },
};
const LINE = [62, 38, 52];

// A limb between two joints: thick at a (ra), thin at b (rb), round ends.
function limb(ax, ay, bx, by, ra, rb) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, base = Math.atan2(ny, nx);
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = base + Math.PI * i / 8; pts.push([ax + ra * Math.cos(a), ay + ra * Math.sin(a)]); }
  for (let i = 0; i <= 8; i++) { const a = base + Math.PI + Math.PI * i / 8; pts.push([bx + rb * Math.cos(a), by + rb * Math.sin(a)]); }
  return P().poly(pts);
}

// Elbow (or knee) between a and the target, bones l1 and l2 long; side picks the bend.
function bend(ax, ay, tx, ty, l1, l2, side) {
  const dx = tx - ax, dy = ty - ay, d0 = Math.hypot(dx, dy) || 1e-6;
  const d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.5, d0));
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))), base = Math.atan2(dy, dx);
  const ex = ax + l1 * Math.cos(base + side * a), ey = ay + l1 * Math.sin(base + side * a);
  return { ex, ey, hx: ax + dx * d / d0, hy: ay + dy * d / d0 };
}

function person(g, who, pose) {
  const L = LOOKS[who], k = pose.k || 1, t = pose.t || 0, wind = pose.wind === undefined ? 1 : pose.wind;
  const tone = pose.tone || [1, 1, 1];
  const C = {};
  for (const key of Object.keys(L)) if (Array.isArray(L[key]) && typeof L[key][0] === 'number') C[key] = [L[key][0] * tone[0], L[key][1] * tone[1], L[key][2] * tone[2]];
  const line = [LINE[0] * tone[0], LINE[1] * tone[1], LINE[2] * tone[2]];
  const back = !!pose.back, girl = who === 'her';
  const OW = 1.5 * Math.pow(k, 0.55) / k;   // outline width in figure units: thinner, relatively, the closer the camera
  const sil = [];

  g.save();
  g.translate(pose.x, pose.y);
  g.scale(pose.flip ? -k : k, k);
  if (pose.lean) g.rotate(pose.lean);

  // places on the frame (stage units) other things are drawn at: the face, the hands
  const spots = {};
  const spot = (x, y) => { const p = g.point(x, y); return [p[0] / g.surf.s, p[1] / g.surf.s]; };

  const ink = (path, w = 1, o) => g.stroke(path, OW * w, line, Object.assign({ min: 0.8 }, o));
  const part = (path, col, o = {}) => {
    g.fill(path, col);
    if (o.shade) {
      const m = g.mask(path);
      if (m) for (const [sp, sc, so] of o.shade) g.fill(sp, sc, Object.assign({ clip: m }, so));
    }
    if (o.ink !== 0) ink(path, o.ink || 1);
    if (o.sil !== false) {
      for (const s of g.polys(path)) {
        let area = 0;
        for (let i = 0, n = s.length; i < n; i += 2) { const j = (i + 2) % n; area += s[i] * s[j + 1] - s[j] * s[i + 1]; }
        if (area < 0) { const r = []; for (let i = s.length - 2; i >= 0; i -= 2) r.push(s[i], s[i + 1]); sil.push(r); } else sil.push(s);
      }
    }
  };

  const headY = -(L.height - 50), neckY = headY + 66, sh = L.shoulder;
  const sway = (y, ph = 0) => wind * (Math.sin(t * 2.1 + y * 0.011 + ph) * 0.6 + Math.sin(t * 3.4 + y * 0.02 + ph * 1.7) * 0.4);

  // ---- hair behind the body (front view) ----
  const longHair = () => {
    const pts = [[0, -58], [34, -50], [49, -22], [52, 30], [55, 92], [51, 150]];
    const tips = [[51, 163, 1], [40, 152], [30, 170, 1], [19, 156], [8, 173, 1], [-3, 157], [-14, 172, 1], [-25, 155], [-36, 169, 1], [-45, 152], [-52, 162, 1]];
    const left = [[-52, 148], [-55, 92], [-52, 30], [-49, -22], [-34, -50]];
    const all = pts.concat(tips, left).map(([x, y, c]) => {
      const f = Math.max(0, (y + 20) / 190);
      return [x + sway(y, x * 0.02) * 16 * f * f + wind * 5 * f * f, y + sway(y + 40, 1) * 3 * f, c];
    });
    return P().smooth(all);
  };

  const drawHead = () => {
    g.save();
    g.translate(0, neckY);
    g.rotate(pose.tilt || 0);
    g.translate(0, -66);
    const turn = pose.turn || 0, nod = pose.nod || 0, fx = turn * 7, fy = nod * 4;
    spots.face = spot(0, 0);
    spots.mouth = spot(fx * 1.1, 35 + fy);
    if (back) {
      if (girl) {
        const hair = longHair();
        part(hair, C.hair, { shade: [[P().smooth([[-60, 60], [-30, 40], [0, 52], [30, 40], [60, 60], [60, 190], [-60, 190]]), C.hairS], [P().smooth([[-40, -34], [0, -44], [40, -34], [38, -22], [0, -31], [-38, -22]]), C.hairL, { alpha: 0.55 }]] });
        for (const x of [-30, -12, 8, 27]) ink(P().smooth([[x * 0.5, -20], [x * 0.9 + sway(60, x) * 3, 60], [x + sway(140, x) * 9 + wind * 6, 140]], false), 0.7, { taper: [0.3, 0.4], alpha: 0.5 });
      } else {
        part(P().ellipse(-42, 8, 6, 10), C.skin);
        part(P().ellipse(42, 8, 6, 10), C.skin);
        const cap = P().smooth([[-45, -10], [-41, -42], [-20, -58], [-8, -66, 1], [2, -59], [14, -67, 1], [26, -55], [42, -40], [46, -10], [44, 18], [36, 36, 1], [28, 28], [18, 44, 1], [8, 32], [-2, 47, 1], [-12, 32], [-22, 43, 1], [-31, 28], [-38, 36, 1], [-44, 16]]);
        part(cap, C.hair, { shade: [[P().smooth([[-50, 2], [0, 16], [50, 2], [50, 40], [-50, 40]]), C.hairS], [P().smooth([[-34, -38], [0, -47], [34, -38], [32, -28], [0, -36], [-32, -28]]), C.hairL, { alpha: 0.5 }]] });
      }
      g.restore();
      return;
    }
    // ears
    if (turn < 0.5) part(P().ellipse(-41 + fx * 0.3, 7, 6, 10), C.skin, { shade: [[P().ellipse(-40 + fx * 0.3, 8, 3, 6), C.skinS]] });
    if (turn > -0.5) part(P().ellipse(41 + fx * 0.3, 7, 6, 10), C.skin, { shade: [[P().ellipse(40 + fx * 0.3, 8, 3, 6), C.skinS]] });
    // face
    const cx = turn * 3;
    const face = P().smooth([[-41, -8], [-40, 10], [-34 + cx, 27], [-21 + cx, 41], [-7 + cx * 1.4, 49], [cx * 1.5, 50.5], [7 + cx * 1.4, 49], [21 + cx, 41], [34 + cx, 27], [40, 10], [41, -8], [37, -30], [22, -45], [0, -50], [-22, -45], [-37, -30]]);
    part(face, C.skin, { shade: [[P().smooth([[-50, -60], [50, -60], [50, -22 + fy], [26, -17 + fy], [0, -19 + fy], [-26, -17 + fy], [-50, -22 + fy]]), C.skinS, { alpha: 0.75 }]] });
    const faceMask = g.mask(face);
    // blush
    const bl = pose.blush || 0;
    if (bl > 0.02) {
      for (const s of [-1, 1]) {
        const bx = s * 25 + fx, by = 23 + fy;
        g.fill(P().ellipse(bx, by, 11, 6.5), { radial: [bx, by, 11], stops: [[0, [255, 105, 110, 0.6 * bl]], [1, [255, 105, 110, 0]]] }, { clip: faceMask });
        if (bl > 0.45) for (let i = 0; i < 3; i++) g.stroke(P().M(bx - 3.5 + i * 3.6, by - 2.6).L(bx - 5.2 + i * 3.6, by + 2.4), 0.9, [226, 86, 100, 0.75 * bl], { min: 0.7, clip: faceMask });
      }
    }
    // eyes
    const look = pose.look || [0, 0], blink = pose.blink || 0, kind = blink > 0.5 ? 'shut' : (pose.eyes || 'open');
    for (const s of [-1, 1]) {
      const near = s * turn > 0 ? 1 - 0.22 * Math.abs(turn) : 1 + 0.06 * Math.abs(turn);
      const ex = s * 19.5 * (1 - 0.06 * Math.abs(turn)) + fx, ey = 9 + fy, ew = L.eyeW * near, eh = L.eyeH;
      g.save();
      g.translate(ex, ey);
      const o = s;   // outer side
      const brow = pose.brow || 0;
      g.stroke(P().smooth([[-o * ew * 0.85, -eh - 6.5 + brow * 1.5 * -1], [0, -eh - 9 - brow * 2], [o * ew * 1.05, -eh - 6 - brow * 0.5 + (brow < 0 ? brow * -2.5 : 0)]], false), 1.7, mixc(C.hair, C.skinS, 0.15), { taper: [0.25, 0.45], min: 0.8 });
      if (kind === 'smile') {
        g.stroke(P().smooth([[-ew, 2.5], [-ew * 0.5, -3.6], [0, -5.6], [ew * 0.5, -3.6], [ew, 2.5]], false), 2.6, line, { taper: [0.2, 0.2] });
        g.stroke(P().M(o * ew * 0.92, 1).L(o * (ew + 2.6), -1.2), 1.2, line, { taper: [0, 0.6] });
      } else if (kind === 'shut') {
        g.stroke(P().smooth([[-ew, -1.5], [-ew * 0.5, 2.6], [0, 3.8], [ew * 0.5, 2.6], [ew, -1.5]], false), 2.4, line, { taper: [0.2, 0.2] });
        g.stroke(P().M(o * ew * 0.9, 0.2).L(o * (ew + 2.6), 2.2), 1.2, line, { taper: [0, 0.6] });
      } else {
        const sq = 1 - blink * 1.2;
        const white = P().smooth([[-ew, 0.8], [-ew * 0.62, -eh * 0.72 * sq], [0, -eh * sq], [ew * 0.66, -eh * 0.76 * sq], [ew, -0.4], [ew * 0.62, eh * 0.72 * sq], [0, eh * 0.9 * sq], [-ew * 0.62, eh * 0.68 * sq]]);
        g.fill(white, [255, 255, 255]);
        const wm = g.mask(white);
        if (wm) {
          g.fill(P().rect(-ew - 2, -eh - 2, ew * 2 + 4, eh * 0.55), [206, 198, 226], { clip: wm, alpha: 0.8 });
          const ix = look[0] * ew * 0.3, iy = 0.6 + look[1] * eh * 0.2, irx = ew * 0.7, iry = Math.min(eh * 0.88, irx * 1.38);
          g.fill(P().ellipse(ix, iy, irx, iry), { linear: [0, iy - iry, 0, iy + iry], stops: L.iris }, { clip: wm });
          g.stroke(P().ellipse(ix, iy, irx, iry), 0.9, L.iris[0][1], { clip: wm, min: 0.6 });
          g.fill(P().ellipse(ix, iy + iry * 0.05, irx * 0.4, iry * 0.46), [22, 14, 18], { clip: wm });
          g.fill(P().ellipse(ix, iy + iry * 0.62, irx * 0.6, iry * 0.26), [255, 226, 170, 0.5], { clip: wm });
          g.fill(P().ellipse(ix - o * irx * 0.36, iy - iry * 0.5, irx * 0.36, iry * 0.3, -0.4 * o), [255, 255, 255], { clip: wm });
          g.fill(P().circle(ix + o * irx * 0.42, iy + iry * 0.42, irx * 0.17), [255, 255, 255, 0.9], { clip: wm });
        }
        g.stroke(P().smooth([[-o * ew * 1.02, 0.4], [-o * ew * 0.66, -eh * 0.74 * sq], [0, -eh * sq - 0.5], [o * ew * 0.68, -eh * 0.8 * sq], [o * ew * 1.06, -1.6], [o * (ew + 3), -eh * 0.45]], false), girl ? 2.8 : 2.2, line, { taper: [0.3, 0.22] });
        g.stroke(P().smooth([[-o * ew * 0.6, -eh * sq - 3.6], [0, -eh * sq - 4.6], [o * ew * 0.8, -eh * sq - 3.2]], false), 0.8, C.skinS, { taper: [0.3, 0.3], min: 0.6 });
        g.stroke(P().smooth([[o * ew * 0.92, eh * 0.5], [o * ew * 0.4, eh * 0.9 * sq + 0.5], [-o * ew * 0.3, eh * 0.88 * sq + 0.4]], false), 0.9, mixc(line, C.skinS, 0.4), { taper: [0.2, 0.5], min: 0.6 });
      }
      g.restore();
    }
    // nose and mouth
    g.stroke(P().M(1 + fx * 1.2, 22 + fy).L(-0.8 + fx * 1.2 + turn * 2, 26.5 + fy), 1, mixc(C.skinS, line, 0.25), { taper: [0.2, 0.3], min: 0.7 });
    const mx = fx * 1.1, my = 35 + fy, mouth = pose.mouth || 'smile', lip = [168, 70, 74].map((v, i) => v * tone[i]);
    if (mouth === 'open') {
      const shape = P().M(mx - 8.5, my - 2.5).Q(mx, my - 4, mx + 8.5, my - 2.5).Q(mx + 6.5, my + 9, mx, my + 9).Q(mx - 6.5, my + 9, mx - 8.5, my - 2.5).Z();
      g.fill(shape, [128, 44, 56]);
      const mm = g.mask(shape);
      g.fill(P().ellipse(mx, my + 7.5, 5, 3), [244, 138, 140], { clip: mm });
      g.fill(P().rect(mx - 8, my - 4.4, 16, 3.4), [255, 255, 255], { clip: mm });
      g.stroke(shape, 1, line, { min: 0.7 });
    } else if (mouth === 'small') {
      g.stroke(P().smooth([[mx - 2.8, my - 0.6], [mx, my + 0.6], [mx + 2.8, my - 0.6]], false), 1.2, lip, { taper: [0.3, 0.3] });
    } else if (mouth === 'wavy') {
      g.stroke(P().smooth([[mx - 7, my - 0.4], [mx - 3.5, my + 1.4], [mx, my - 0.8], [mx + 3.5, my + 1.4], [mx + 7, my - 0.4]], false), 1.2, lip, { taper: [0.2, 0.2] });
    } else if (mouth === 'o') {
      g.fill(P().ellipse(mx, my + 1, 2.4, 3.2), [128, 44, 56]);
    } else {
      g.stroke(P().smooth([[mx - 6.5, my - 2], [mx, my + 1.8], [mx + 6.5, my - 2]], false), 1.3, lip, { taper: [0.3, 0.3] });
    }
    // hair over the face
    const hx = turn * 2.5;
    if (girl) {
      const w0 = sway(-20, 0.5) * 1.5, w1 = sway(20, 2) * 3;
      const bangs = P().smooth([[-45, -24], [-35, -49], [0, -58], [35, -49], [45, -24], [48, 0], [47 + w1, 26], [45 + w1 * 1.6, 44, 1], [40 + w1, 16], [37, -6],
        [31 + hx + w0, -9, 1], [25 + hx, -21], [18 + hx + w0, -8, 1], [10 + hx, -21], [2 + hx + w0, -7, 1], [-6 + hx, -21], [-13 + hx + w0, -8, 1], [-21 + hx, -21], [-29 + hx + w0, -9, 1],
        [-37, -6], [-40 + w1, 16], [-45 + w1 * 1.6, 44, 1], [-47 + w1, 26], [-48, 0]]);
      part(bangs, C.hair, { shade: [[P().smooth([[-36, -39], [0, -46], [36, -39], [34, -29], [0, -37], [-34, -29]]), C.hairL, { alpha: 0.6 }]] });
      for (const x of [-22, -7, 9, 24]) ink(P().M(x * 0.8, -44).Q(x + hx * 0.5, -30, x + hx + w0, -14), 0.6, { taper: [0.4, 0.3], alpha: 0.45 });
    } else {
      const bangs = P().smooth([[-46, -6], [-44, 6, 1], [-40, -12], [-41, -42], [-24, -57], [-12, -66, 1], [-2, -58], [12, -68, 1], [24, -56], [41, -42], [40, -12], [44, 6, 1], [46, -6],
        [45, -20], [38, -24], [33 + hx, -12, 1], [27 + hx, -27], [19 + hx, -11, 1], [11 + hx, -27], [3 + hx, -9, 1], [-5 + hx, -27], [-14 + hx, -11, 1], [-23 + hx, -27], [-31 + hx, -13, 1], [-38, -24], [-45, -20]]);
      part(bangs, C.hair, { shade: [[P().smooth([[-34, -40], [0, -48], [34, -40], [32, -31], [0, -38], [-32, -31]]), C.hairL, { alpha: 0.5 }]] });
      // glasses
      for (const s of [-1, 1]) {
        const gx = s * 19.5 * (1 - 0.06 * Math.abs(turn)) + fx, gy = 10 + fy;
        const lens = P().rrect(gx - 13.5, gy - 9.5, 27, 19.5, 6);
        g.fill(lens, [255, 255, 255, 0.1]);
        const lm = g.mask(lens);
        const gl = pose.glint || 0;
        if (gl > 0.02 && lm) g.fill(P().poly([[gx - 16 + gl * 22, gy + 12], [gx - 9 + gl * 22, gy + 12], [gx + 1 + gl * 22, gy - 12], [gx - 6 + gl * 22, gy - 12]]), [255, 255, 255, 0.7], { clip: lm });
        g.stroke(lens, 1.5, [40, 36, 52].map((v, i) => v * tone[i]), { min: 0.9 });
      }
      g.stroke(P().M(-6 + fx, 9 + fy).Q(fx, 6.5 + fy, 6 + fx, 9 + fy), 1.4, [40, 36, 52].map((v, i) => v * tone[i]), { min: 0.9 });
    }
    g.restore();
  };

  // ---- hand: seen as one shape with finger lines and a thumb, pointing along the angle a ----
  const hand = (wx, wy, a, thumbSide, curl = 0.35) => {
    g.save();
    g.translate(wx, wy);
    g.rotate(a - Math.PI / 2);
    const len = 30 - curl * 9, tip = curl * 3 * thumbSide;
    part(limb(thumbSide * 6.5, 5, thumbSide * (11 - curl * 4), 17 - curl * 3, 3.4, 2.6), C.skin, { ink: 0.8 });
    const palm = P().smooth([[-8.5, -4, 1], [-9.5, 10], [-8 + tip, len - 5], [-4.5 + tip, len], [0.5 + tip, len + 1.5], [5 + tip, len - 1], [8 + tip, len - 7], [9.5, 10], [8.5, -4, 1]]);
    part(palm, C.skin, { ink: 0.8 });
    for (const fx of [-4.2, 0.2, 4.4]) g.stroke(P().M(fx * 0.9, 15).L(fx + tip, len - 2.5), OW * 0.55, mixc(C.skinS, line, 0.3), { min: 0.6, taper: [0.5, 0.2] });
    g.restore();
  };

  // A limb drawn so that its outline shows only on the outside: ink first, colour over it.
  const tube = (path, col, shadePath, shadeCol) => {
    ink(path, 2);
    part(path, col, { ink: 0, shade: shadePath ? [[shadePath, shadeCol, { alpha: 0.55 }]] : null });
  };
  const band = (cx, cy, a, half, len) => {
    const c = Math.cos(a), sn = Math.sin(a), nx = -sn * half, ny = c * half;
    return P().poly([[cx - c * len + nx, cy - sn * len + ny], [cx + nx, cy + ny], [cx - nx, cy - ny], [cx - c * len - nx, cy - sn * len - ny]]);
  };

  // arm: the upper part goes under the clothes of the body, the forearm and hand over them
  const armOf = (side, spec) => {
    const sx = side * (sh - 5), sy = neckY + 13;
    const target = spec && spec.hand ? spec.hand : [side * (sh + 5), sy + L.upper + L.fore - 3];
    // elbow: given outright when the arm points towards the viewer and looks shorter than it is
    const b = spec && spec.elbow ? { ex: spec.elbow[0], ey: spec.elbow[1], hx: target[0], hy: target[1] }
      : bend(sx, sy, target[0], target[1], L.upper, L.fore, spec && spec.bend !== undefined ? spec.bend : -side);
    const a = Math.atan2(b.hy - b.ey, b.hx - b.ex);
    const ha = spec && spec.handAngle !== undefined ? spec.handAngle : a;
    spots[side < 0 ? 'handL' : 'handR'] = spot(b.hx + Math.cos(ha) * 15, b.hy + Math.sin(ha) * 15);
    const r0 = girl ? 14 : 16.5, r1 = girl ? 12 : 13.5, r2 = girl ? 11.5 : 11.5;
    return {
      upper() { tube(limb(sx, sy, b.ex, b.ey, r0, r1), C.top, limb(sx - side * 10, sy, b.ex - side * 10, b.ey, r0, r1), C.topS); },
      lower() {
        hand(b.hx, b.hy, ha, (back ? side : -side) * (spec && spec.thumb ? spec.thumb : 1), spec && spec.curl !== undefined ? spec.curl : 0.35);
        const low = limb(b.ex, b.ey, b.hx, b.hy, r1, r2);
        ink(low, 2);
        g.fill(P().circle(b.ex, b.ey, r1 - OW * 0.45), C.top);
        part(low, C.top, { ink: 0, shade: [[limb(b.ex - side * 9, b.ey, b.hx - side * 9, b.hy, r1, r2), C.topS, { alpha: 0.55 }]] });
        const cx = b.hx + Math.cos(a) * (girl ? 9 : 5), cy = b.hy + Math.sin(a) * (girl ? 9 : 5);
        part(band(cx, cy, a, r2 + 0.9, 7), girl ? mixc(C.top, C.topS, 0.5) : mixc(C.top, [255, 255, 255], 0.3), { ink: 0.8 });
      },
    };
  };

  // ---- legs and shoes ----
  const legs = () => {
    for (const s of [-1, 1]) {
      const hipX = s * 19, footX = s * (girl ? 17 : 24) + (pose.feet ? pose.feet[s < 0 ? 0 : 1] : 0), kx = (hipX + footX) / 2 + s * 1;
      const lift = pose.heel ? pose.heel[s < 0 ? 0 : 1] : 0;
      if (girl) {
        tube(limb(hipX, L.hipY + 30, footX, -30 - lift, 16, 8.5), C.skin, limb(hipX - 8, L.hipY + 30, footX - 6.5, -30 - lift, 8, 4), C.skinS);
        part(P().rrect(footX - 9.5, -44 - lift, 19, 16, 4), C.under, { ink: 0.8 });
      } else {
        tube(limb(hipX, L.hipY + 26, footX, -26 - lift, 23, 14.5), C.legs, limb(hipX - 10 * s, L.hipY + 26, footX - 8 * s, -26 - lift, 12, 7), C.legsS);
      }
      // shoe
      g.save();
      g.translate(footX, -lift);
      g.rotate((girl ? 0.1 : -0.06) * s * (back ? -1 : 1) + (lift ? -s * 0.04 : 0));
      const shoe = back
        ? P().M(-12, -30).L(12, -30).Q(15, -12, 14, 0).L(-14, 0).Q(-15, -12, -12, -30).Z()
        : P().M(-11, -30).L(11, -30).Q(17, -16, 17, -3).Q(17, 0, 13, 0).L(-13, 0).Q(-17, 0, -17, -3).Q(-17, -16, -11, -30).Z();
      part(shoe, C.shoe, { shade: [[P().rect(-20, -5.5, 40, 6), C.sole], [P().rect(-20, -6.4, 40, 1.2), line, { alpha: 0.6 }]] });
      if (!back) for (let i = 0; i < 3; i++) g.stroke(P().M(-5, -24 + i * 5).L(5, -24 + i * 5), 1, girl ? [200, 196, 214].map((v, j) => v * tone[j]) : [220, 220, 230].map((v, j) => v * tone[j]), { min: 0.6 });
      else part(P().rrect(-4, -31, 8, 12, 2), girl ? [236, 150, 150].map((v, j) => v * tone[j]) : C.sole, { ink: 0.7 });
      g.restore();
    }
  };

  const torso = () => {
    const wy = L.waistY, hy = L.hipY;
    if (girl) {
      // dress: bodice and a skirt that moves in the wind
      const hemY = -196, hem = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8, x = -92 + 184 * u;
        hem.push([x + sway(i * 40, 3) * 7 + wind * 9, hemY + Math.sin(u * Math.PI) * 9 + sway(i * 70, 1) * 3.5 + (i % 2 ? 3 : -2)]);
      }
      const dress = P().smooth([[-sh + 6, neckY + 4, 1], [-40, neckY + 62], [-L.waist, wy], [-L.hip - 8, hy], [hem[0][0], hem[0][1], 1], ...hem.slice(1, 8), [hem[8][0], hem[8][1], 1], [L.hip + 8, hy], [L.waist, wy], [40, neckY + 62], [sh - 6, neckY + 4, 1], [15, neckY - 4, 1], [0, neckY + (back ? 0 : 16)], [-15, neckY - 4, 1]]);
      const folds = [];
      for (const fx of [-52, -18, 20, 56]) folds.push([P().smooth([[fx * 0.5, wy + 14], [fx * 0.8 + 6, hy + 60], [fx + 13 + wind * 7, hemY + 14], [fx - 6 + wind * 7, hemY + 14], [fx * 0.8 - 5, hy + 60]]), C.underS, { alpha: 0.75 }]);
      part(dress, C.under, { shade: folds });
      // cardigan
      const hemC = hy + 6;
      if (back) {
        const card = P().smooth([[-sh - 2, neckY + 2, 1], [-sh - 5, neckY + 50], [-L.waist - 9, wy], [-L.hip - 7, hemC, 1], [L.hip + 7, hemC, 1], [L.waist + 9, wy], [sh + 5, neckY + 50], [sh + 2, neckY + 2, 1], [16, neckY - 7], [-16, neckY - 7]]);
        part(card, C.top, { shade: [[P().rect(-80, hemC - 9, 160, 10), mixc(C.top, C.topS, 0.5)], [P().smooth([[-70, wy - 30], [-20, wy + 10], [-70, hemC]]), C.topS, { alpha: 0.6 }]] });
      } else {
        for (const s of [-1, 1]) {
          const card = P().smooth([[s * (sh + 2), neckY + 2, 1], [s * (sh + 5), neckY + 50], [s * (L.waist + 9), wy], [s * (L.hip + 7), hemC, 1], [s * 13, hemC + 3, 1], [s * 9, wy], [s * 13, neckY + 60], [s * 17, neckY - 5, 1]]);
          part(card, C.top, { shade: [[P().rect(-80, hemC - 8, 160, 12), mixc(C.top, C.topS, 0.5)], [P().smooth([[s * 62, neckY + 40], [s * 30, wy - 10], [s * 64, hemC]]), C.topS, { alpha: 0.5 }]] });
          if (s > 0) for (let i = 0; i < 4; i++) g.fill(P().circle(15, neckY + 70 + i * 28, 2.6), mixc(C.top, [255, 255, 255], 0.6));
        }
      }
    } else {
      // jeans' top, tee, open shirt
      const pelvis = P().smooth([[-L.waist - 1, wy + 8, 1], [-L.hip - 2, hy + 10], [-L.hip - 1, hy + 42], [0, hy + 30], [L.hip + 1, hy + 42], [L.hip + 2, hy + 10], [L.waist + 1, wy + 8, 1]]);
      part(pelvis, C.legs);
      const tee = P().smooth([[-sh + 4, neckY + 3, 1], [-46, neckY + 64], [-L.waist - 3, wy], [-L.hip, hy + 22, 1], [L.hip, hy + 22, 1], [L.waist + 3, wy], [46, neckY + 64], [sh - 4, neckY + 3, 1], [14, neckY - 5, 1], [0, neckY + (back ? -2 : 9)], [-14, neckY - 5, 1]]);
      part(tee, C.under, { shade: [[P().smooth([[-30, neckY + 30], [0, neckY + 60], [-34, hy + 30], [-60, hy + 30]]), C.underS, { alpha: 0.6 }]] });
      const hemS = hy + 34;
      if (back) {
        const shirt = P().smooth([[-sh - 2, neckY + 1, 1], [-sh - 5, neckY + 56], [-L.waist - 10, wy], [-L.hip - 6, hemS, 1], [L.hip + 6, hemS, 1], [L.waist + 10, wy], [sh + 5, neckY + 56], [sh + 2, neckY + 1, 1], [17, neckY - 9], [-17, neckY - 9]]);
        part(shirt, C.top, { shade: [[P().smooth([[-80, wy - 40], [-22, wy + 20], [-80, hemS + 10]]), C.topS, { alpha: 0.6 }], [P().smooth([[-24, neckY - 12], [0, neckY + 2], [24, neckY - 12], [24, neckY - 2], [0, neckY + 10], [-24, neckY - 2]]), C.topS]] });
      } else {
        for (const s of [-1, 1]) {
          const shirt = P().smooth([[s * (sh + 2), neckY + 1, 1], [s * (sh + 5), neckY + 56], [s * (L.waist + 10), wy], [s * (L.hip + 6), hemS, 1], [s * 20, hemS + 4, 1], [s * 15, wy], [s * 17, neckY + 62], [s * 12, neckY + 12, 1], [s * 18, neckY - 8, 1]]);
          part(shirt, C.top, { shade: [[P().smooth([[s * 72, neckY + 40], [s * 34, wy - 10], [s * 70, hemS]]), C.topS, { alpha: 0.6 }]] });
          part(P().poly([[s * 18, neckY - 9], [s * 34, neckY + 4], [s * 14, neckY + 22]]), C.top, { ink: 0.8 });
        }
      }
    }
  };

  const neck = () => {
    const n = P().rect(-10.5, neckY - 30, 21, 40);
    part(n, C.skin, { shade: [[P().ellipse(0, neckY - 18, 22, 13), C.skinS]] });
  };

  // ---- put together ----
  const specL = pose.armL || {}, specR = pose.armR || {}, aL = armOf(-1, specL), aR = armOf(1, specR);
  if (!back && girl) {
    g.save(); g.translate(0, neckY); g.rotate(pose.tilt || 0); g.translate(0, -66);
    part(longHair(), C.hairS);
    g.restore();
  }
  if (!pose.sit) legs();
  aL.upper(); aR.upper();
  if (back) {
    torso();
    aL.lower(); aR.lower();
    neck();
    drawHead();
  } else {
    neck();
    torso();
    if (!specL.front) aL.lower();
    if (!specR.front) aR.lower();
    drawHead();
    if (specL.front) aL.lower();
    if (specR.front) aR.lower();
  }
  g.restore();

  // rim light on the edge that faces the sun
  if (pose.rim !== 0) {
    const m = R.maskOf(sil, g.surf.w, g.surf.h);
    if (m) {
      const light = pose.light || [0.7, -0.7], reach = Math.max(1.5, 4.2 * Math.pow(k, 0.6)) * g.surf.s;
      const rim = R.rimOf(m, light[0] * reach, light[1] * reach);
      g.paintMask(rim, pose.rimColor || [255, 214, 150], { alpha: pose.rim === undefined ? 0.85 : pose.rim });
    }
  }
  return spots;
}

module.exports = { person, limb, bend, LOOKS, mixc };
