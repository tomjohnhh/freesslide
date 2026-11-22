'use strict';
// The two characters: original chibi pixel figures, drawn with rectangles so that every
// pose (walk cycle, glance, blink, blush, arm gestures) is a parameter rather than a sprite.
//
// Local grid: 22 px wide, origin at the top-left of the figure's box; the figure stands
// on ground line gy and is centred on cx. Girl is 44 px tall, boy 47 px.
//
// pose: { bob, walk, dir, look, eyes, mouth, blush, arms, armL, armR, wave, lean, sit, back,
//         tears, style: 'then' | 'now', pal: {...overrides}, wear: { scarf, hat, hatCol, glasses },
//         grade: colour => colour, shadow: false }

const SKIN = 0xf9dcc6;
const SKIN_SH = 0xe8b49b;
const EYE = 0x2a1a1f;
const WHITE = 0xffffff;
const MOUTH = 0xb4574e;
const MOUTH_IN = 0x8a3a3a;
const BLUSH = [0, 0xf6b1a6, 0xf08379, 0xe8554f];

const GIRL = {
  hair: 0x4d2f2c, hairHi: 0x80503f, hairRim: 0x9a6248,
  top: 0xf7e8b6, topSh: 0xd8bd80, topRim: 0xfffbe6,
  skirt: 0xbb4a41, skirtSh: 0x8e3230,
  leg: SKIN, sock: 0xf7f3ee, shoe: 0x5b3a34, clip: 0xff7a6e,
};
const GIRL_NOW = {
  ...GIRL,
  top: 0xcf9d6c, topSh: 0xa97a50, topRim: 0xe9c79c,
  skirt: 0xcf9d6c, skirtSh: 0xa97a50,
  leg: 0x3d3346, sock: 0x4a2e2c, shoe: 0x4a2e2c,
  bob: true, coat: true, inner: 0xfbf7ee,
};
const BOY = {
  hair: 0x252a42, hairHi: 0x414f7a, hairRim: 0x9a86a0,
  shirt: 0x82abde, shirtSh: 0x5c82ba, shirtRim: 0xdbeaff,
  tee: 0xf4f3ee, teeSh: 0xd3d6dd,
  pants: 0x3d4362, pantsSh: 0x2b2f49,
  shoe: 0xf3f1ec, sole: 0x9ba0b3,
};
const BOY_NOW = {
  ...BOY,
  shirt: 0x34416a, shirtSh: 0x242e50, shirtRim: 0x5f71a4,
  tee: 0xe2ded6, teeSh: 0xbdb8b0,
  pants: 0x3a3745, pantsSh: 0x282632,
  shoe: 0x7a543e, sole: 0x3d2a24,
  glasses: true,
};

const HEAD_ROWS = [[6, 15], [4, 17], [3, 18], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [3, 18], [4, 17], [6, 15]];

function face(R, pose, hx, hy, glasses) {
  const look = Math.max(-2, Math.min(2, pose.look || 0));
  const ex = hx + look;
  const eyes = pose.eyes || 'open';
  for (const x of [6, 14]) {
    if (eyes === 'blink') R(ex + x - 1, hy + 10, 3, 1, EYE);
    else if (eyes === 'happy') { R(ex + x - 1, hy + 10, 1, 1, EYE); R(ex + x, hy + 9, 2, 1, EYE); R(ex + x + 2, hy + 10, 1, 1, EYE); }
    else if (eyes === 'down') R(ex + x, hy + 9, 2, 2, EYE);
    else if (eyes === 'shut') {
      const a = x === 6 ? 0 : 1;
      R(ex + x + a, hy + 8, 1, 1, EYE); R(ex + x + 1 - a, hy + 9, 1, 1, EYE); R(ex + x + a, hy + 10, 1, 1, EYE);
    } else {
      const tall = eyes === 'wide' ? 4 : 3;
      R(ex + x, hy + 11 - tall, 2, tall, EYE);
      R(ex + x + (look > 0 ? 1 : 0), hy + 11 - tall, 1, 1, WHITE);
    }
  }
  if (glasses) {
    const G = 0x2c2f48;
    for (const x of [4, 12]) {
      R(ex + x, hy + 7, 6, 1, G); R(ex + x, hy + 11, 6, 1, G);
      R(ex + x, hy + 7, 1, 5, G); R(ex + x + 5, hy + 7, 1, 5, G);
    }
    R(ex + 10, hy + 8, 2, 1, G);
  }
  const blush = pose.blush || 0;
  if (blush === 1) { R(hx + 4, hy + 12, 2, 1, BLUSH[1]); R(hx + 16, hy + 12, 2, 1, BLUSH[1]); }
  else if (blush === 2) { R(hx + 4, hy + 11, 3, 2, BLUSH[2]); R(hx + 15, hy + 11, 3, 2, BLUSH[2]); }
  else if (blush >= 3) {
    R(hx + 3, hy + 11, 4, 3, BLUSH[3]); R(hx + 15, hy + 11, 4, 3, BLUSH[3]);
    R(hx + 4, hy + 11, 1, 1, 0xffb9ad); R(hx + 16, hy + 11, 1, 1, 0xffb9ad);
  }
  if (pose.tears != null) {
    const ph = ((pose.tears % 1) + 1) % 1;
    for (const x of [6, 15]) {
      R(ex + x, hy + 11, 1, 2, 0xbfe6ff);
      R(ex + x, hy + 12 + Math.floor(ph * 5), 1, 2, 0x7cc4f6);
    }
  }
  const mx = ex;
  const mouth = pose.mouth || 'smile';
  if (mouth === 'smile') { R(mx + 9, hy + 12, 1, 1, MOUTH); R(mx + 10, hy + 13, 2, 1, MOUTH); R(mx + 12, hy + 12, 1, 1, MOUTH); }
  else if (mouth === 'small') R(mx + 10, hy + 13, 2, 1, MOUTH);
  else if (mouth === 'open') { R(mx + 10, hy + 12, 2, 2, MOUTH); }
  else if (mouth === 'wavy') { R(mx + 9, hy + 13, 1, 1, MOUTH); R(mx + 10, hy + 12, 1, 1, MOUTH); R(mx + 11, hy + 13, 1, 1, MOUTH); R(mx + 12, hy + 12, 1, 1, MOUTH); }
  else if (mouth === 'grin') { R(mx + 9, hy + 12, 4, 1, MOUTH); R(mx + 10, hy + 13, 2, 1, 0xffffff); }
  else if (mouth === 'laugh') { R(mx + 9, hy + 12, 4, 1, WHITE); R(mx + 9, hy + 13, 4, 1, MOUTH); R(mx + 10, hy + 14, 2, 1, MOUTH); }
  else if (mouth === 'sing') { R(mx + 10, hy + 12, 2, 3, MOUTH_IN); }
  else if (mouth === 'shout') { R(mx + 9, hy + 11, 4, 4, MOUTH_IN); R(mx + 10, hy + 14, 2, 1, 0xe07a7a); }
  else if (mouth === 'frown') { R(mx + 10, hy + 12, 2, 1, MOUTH); R(mx + 9, hy + 13, 1, 1, MOUTH); R(mx + 12, hy + 13, 1, 1, MOUTH); }
}

function legOffsets(pose) {
  if (pose.walk == null) return { l: 0, r: 0, ll: 0, rl: 0, up: 0 };
  const dir = pose.dir || 1;
  switch (pose.walk & 3) {
    case 0: return { l: 2 * dir, r: -2 * dir, ll: 0, rl: 1, up: 0 };
    case 2: return { l: -2 * dir, r: 2 * dir, ll: 1, rl: 0, up: 0 };
    default: return { l: 0, r: 0, ll: 0, rl: 0, up: 1 };
  }
}

// One arm. side 'L' is the viewer's left. Returns true when the arm has to be drawn after the head.
const RAISED = { up: 1, wave: 1, out: 0, head: 1 };
function drawArm(R, side, state, o) {
  const left = side === 'L';
  const x = left ? 2 : 17;
  const s = left ? o.sw : -o.sw;
  const ub = o.ub;
  const m = (lx, w) => (left ? lx : 22 - lx - w); // mirror a left-side x for the right arm
  if (state === 'up') {
    R(x, 17 + ub, 3, 4, o.sleeve);
    R(m(0, 3), 5 + ub, 3, 13, o.sleeve);
    R(m(0, 1), 5 + ub, 1, 13, left ? o.shade : o.rim);
    R(m(0, 3), 5 + ub, 3, 1, o.shade);
    R(m(0, 3), 2 + ub, 3, 3, SKIN);
  } else if (state === 'wave') {
    const wv = o.wave ? 1 : 0;
    R(x, 17 + ub, 3, 3, o.sleeve);
    R(m(0, 3), 10 + ub, 3, 8, o.sleeve);
    R(m(-1 - wv, 3), 6 + ub, 3, 5, o.sleeve);
    R(m(-1 - wv, 3), 6 + ub, 3, 1, o.shade);
    R(m(-1 - wv, 3), 3 + ub, 3, 3, SKIN);
  } else if (state === 'out') {
    R(x, 18 + ub, 3, 3, o.sleeve);
    R(m(-3, 5), 18 + ub, 5, 3, o.sleeve);
    R(m(-3, 5), 20 + ub, 5, 1, o.shade);
    R(m(-5, 2), 18 + ub, 2, 3, SKIN);
  } else if (state === 'hold') {
    R(x, 18 + ub, 3, 6, o.sleeve);
    R(m(3, 6), 23 + ub, 6, 3, o.sleeve);
    R(m(3, 6), 25 + ub, 6, 1, o.shade);
    R(m(9, 2), 23 + ub, 2, 3, SKIN);
  } else if (state === 'low') {
    R(x, 18 + ub, 3, 6, o.sleeve);
    R(m(0, 3), 23 + ub, 3, 4, o.sleeve);
    R(m(0, 3), 26 + ub, 3, 1, o.shade);
    R(m(-1, 2), 27 + ub, 2, 2, SKIN);
  } else if (state === 'none') {
    // hidden behind the body
  } else {
    R(x, 18 + ub, 3, o.len + s, o.sleeve);
    R(x, 18 + ub + o.len - 1 + s, 3, 1, o.shade);
    R(x, 18 + ub + o.len + s, 3, 2, SKIN);
    if (!left) R(19, 19 + ub, 1, o.len - 2 + s, o.rim);
  }
}

function hat(R, wear, hx, hy) {
  if (wear.hat === 'straw') {
    const c = wear.hatCol || 0xf2d68c;
    R(4 + hx, -2 + hy, 14, 5, c); R(5 + hx, -3 + hy, 12, 1, c);
    R(4 + hx, 2 + hy, 14, 1, 0xd9574c);
    R(-1 + hx, 3 + hy, 24, 2, c); R(-1 + hx, 4 + hy, 24, 1, 0xd0ad62);
    R(14 + hx, -2 + hy, 3, 1, 0xfff0b8);
  } else if (wear.hat === 'beanie') {
    const c = wear.hatCol || 0xf4f3ee;
    R(3 + hx, -1 + hy, 16, 5, c); R(5 + hx, -2 + hy, 12, 1, c);
    R(2 + hx, 3 + hy, 18, 3, wear.hatBand || 0xd9d6ce);
    for (const x of [4, 8, 12, 16]) R(x + hx, 3 + hy, 1, 3, c);
    R(9 + hx, -5 + hy, 4, 3, wear.pom || 0xffffff);
  } else if (wear.hat === 'party') {
    const c = wear.hatCol || 0xf6d06a;
    R(10 + hx, -8 + hy, 2, 2, c); R(9 + hx, -6 + hy, 4, 2, 0xff8f9c); R(8 + hx, -4 + hy, 6, 2, c); R(7 + hx, -2 + hy, 8, 2, 0xff8f9c); R(6 + hx, 0 + hy, 10, 1, c);
    R(10 + hx, -10 + hy, 2, 2, 0xffffff);
  }
}

function scarf(R, wear, ub) {
  const c = wear.scarf, sh = wear.scarfSh || c;
  R(5, 15 + ub, 12, 3, c); R(4, 16 + ub, 14, 2, c);
  R(5, 17 + ub, 12, 1, sh);
  R(12, 18 + ub, 4, 6, c); R(12, 23 + ub, 4, 1, sh); R(15, 18 + ub, 1, 5, sh);
}

function palette(base, now, pose) {
  let C = pose.style === 'now' ? now : base;
  if (pose.pal) C = { ...C, ...pose.pal };
  return C;
}

function drawGirl(fb, cx, gy, pose = {}) {
  const C = palette(GIRL, GIRL_NOW, pose);
  const H = 44;
  const cut = pose.sit ? 4 : 0;
  const L = Math.round(cx) - 11;
  const T = Math.round(gy) - H + cut;
  const gr = pose.grade;
  const R = gr ? (x, y, w, h, c) => fb.rect(L + x, T + y, w, h, gr(c)) : (x, y, w, h, c) => fb.rect(L + x, T + y, w, h, c);
  const leg = legOffsets(pose);
  const ub = (pose.bob ? 1 : 0) - leg.up;
  const hx = pose.lean || 0;
  const hy = ub;
  const wear = pose.wear || {};
  const back = !!pose.back;

  if (pose.shadow !== false) fb.ellipseA(cx, gy, 10, 2, 0x1b1530, 0.38);

  // hair behind the shoulders
  const long = !C.bob;
  if (!back) {
    if (long) {
      R(2 + hx, 4 + hy, 18, 20, C.hair);
      R(1 + hx, 8 + hy, 20, 13, C.hair);
      R(3 + hx, 24 + hy, 3, 1, C.hair);
      R(16 + hx, 24 + hy, 3, 1, C.hair);
    } else {
      R(2 + hx, 4 + hy, 18, 14, C.hair);
      R(1 + hx, 8 + hy, 20, 9, C.hair);
    }
  }

  // legs, socks, shoes
  R(7 + leg.l, 34, 3, 7 - leg.ll - cut, C.leg);
  R(12 + leg.r, 34, 3, 7 - leg.rl - cut, C.leg);
  R(7 + leg.l, 38 - leg.ll - cut, 3, 3, C.sock);
  R(12 + leg.r, 38 - leg.rl - cut, 3, 3, C.sock);
  R(6 + leg.l, 41 - leg.ll - cut, 4, 3, C.shoe);
  R(12 + leg.r, 41 - leg.rl - cut, 4, 3, C.shoe);

  // torso
  R(5, 17 + ub, 12, 11, C.top);
  R(5, 26 + ub, 12, 2, C.topSh);
  if (!back) R(9, 17 + ub, 4, 1, C.topSh);
  R(16, 18 + ub, 1, 8, C.topRim);
  if (C.inner && !back) { R(9, 17 + ub, 4, 3, C.inner); R(10, 20 + ub, 2, 1, C.inner); }

  // skirt, or the lower half of a coat
  R(5, 28, 12, 1, C.skirt);
  R(4, 29, 14, 2, C.skirt);
  R(3, 31, 16, 4, C.skirt);
  R(3, 34, 16, 1, C.skirtSh);
  if (C.coat) {
    R(3, 35, 16, 1, C.skirt); R(3, 36, 16, 1, C.skirtSh);
    if (!back) { R(10, 21 + ub, 1, 15 - ub, C.skirtSh); R(8, 23 + ub, 1, 1, C.topRim); R(8, 27, 1, 1, C.topRim); }
    else R(10, 30, 1, 6, C.skirtSh);
  } else {
    for (const x of [6, 10, 14]) R(x, 30, 1, 4, C.skirtSh);
  }

  // arms
  const arms = pose.arms || 'down';
  const sw = pose.walk == null ? 0 : ((pose.walk & 3) === 0 ? 1 : (pose.walk & 3) === 2 ? -1 : 0);
  const armOpt = { ub, sw, len: 9, sleeve: C.top, shade: C.topSh, rim: C.topRim, wave: pose.wave };
  const aL = pose.armL || 'down', aR = pose.armR || 'down';
  if (arms === 'front') {
    R(2, 18 + ub, 3, 6, C.top); R(17, 18 + ub, 3, 6, C.top);
    R(3, 23 + ub, 6, 3, C.top); R(13, 23 + ub, 6, 3, C.top);
    R(3, 25 + ub, 6, 1, C.topSh); R(13, 25 + ub, 6, 1, C.topSh);
    R(9, 23 + ub, 4, 3, SKIN); R(9, 25 + ub, 4, 1, SKIN_SH);
  } else if (arms === 'cheeks') {
    // drawn after the head so the forearms sit in front of the hair
  } else {
    if (!RAISED[aL]) drawArm(R, 'L', aL, armOpt);
    if (!RAISED[aR]) drawArm(R, 'R', aR, armOpt);
  }

  // neck and head
  R(9, 16 + ub, 4, 1, SKIN_SH);
  if (back) {
    HEAD_ROWS.forEach(([a, b], i) => R(a + hx, i + hy, b - a + 1, 1, C.hair));
    if (long) {
      R(2 + hx, 4 + hy, 18, 20, C.hair);
      R(1 + hx, 8 + hy, 20, 13, C.hair);
      R(3 + hx, 24 + hy, 3, 1, C.hair); R(9 + hx, 24 + hy, 4, 1, C.hair); R(16 + hx, 24 + hy, 3, 1, C.hair);
      for (const [x, y, h] of [[6, 7, 13], [11, 9, 13], [15, 6, 12]]) R(x + hx, y + hy, 1, h, C.hairHi);
    } else {
      R(2 + hx, 4 + hy, 18, 14, C.hair);
      R(1 + hx, 8 + hy, 20, 9, C.hair);
      for (const [x, y, h] of [[6, 7, 9], [11, 9, 8], [15, 6, 9]]) R(x + hx, y + hy, 1, h, C.hairHi);
    }
    R(6 + hx, 1 + hy, 5, 1, C.hairHi); R(4 + hx, 2 + hy, 3, 1, C.hairHi); R(12 + hx, 1 + hy, 2, 1, C.hairHi);
    R(20 + hx, 9 + hy, 1, long ? 11 : 6, C.hairRim); R(19 + hx, 4 + hy, 1, 4, C.hairRim);
    R(5 + hx, 4 + hy, 2, 2, C.clip);
  } else {
    HEAD_ROWS.forEach(([a, b], i) => R(a + hx, i + hy, b - a + 1, 1, i < 5 ? C.hair : SKIN));
    R(2 + hx, 5 + hy, 18, 1, C.hair);
    for (const x of [2, 3, 7, 8, 11, 12, 16, 17, 18, 19]) R(x + hx, 6 + hy, 1, 1, C.hair);
    for (const x of [2, 3, 18, 19]) R(x + hx, 7 + hy, 1, 6, C.hair);
    R(2 + hx, 13 + hy, 2, 1, C.hair); R(18 + hx, 13 + hy, 2, 1, C.hair);
    R(6 + hx, 1 + hy, 5, 1, C.hairHi); R(4 + hx, 2 + hy, 3, 1, C.hairHi); R(12 + hx, 1 + hy, 2, 1, C.hairHi);
    R(19 + hx, 4 + hy, 1, 4, C.hairRim); R(18 + hx, 2 + hy, 1, 2, C.hairRim); R(20 + hx, 9 + hy, 1, long ? 11 : 7, C.hairRim);
    R(15 + hx, 4 + hy, 2, 2, C.clip);
    face(R, pose, hx, hy, wear.glasses);
  }
  if (wear.scarf) scarf(R, wear, ub);
  if (wear.hat) hat(R, wear, hx, hy);
  if (arms === 'cheeks') {
    for (const x of [1, 17]) {
      R(x, 15 + ub, 4, 9, C.top);
      R(x, 15 + ub, 4, 1, C.topSh);
      R(x === 1 ? 1 : 20, 16 + ub, 1, 8, x === 1 ? C.topSh : C.topRim);
      R(x + hx, 10 + ub, 4, 5, SKIN);
      R(x + hx, 14 + ub, 4, 1, SKIN_SH);
      R((x === 1 ? 4 : 17) + hx, 10 + ub, 1, 4, SKIN_SH);
      R((x === 1 ? 2 : 19) + hx, 10 + ub, 1, 2, SKIN_SH);
    }
  } else if (arms !== 'front') {
    if (RAISED[aL]) drawArm(R, 'L', aL, armOpt);
    if (RAISED[aR]) drawArm(R, 'R', aR, armOpt);
  }
}

function drawBoy(fb, cx, gy, pose = {}) {
  const C = palette(BOY, BOY_NOW, pose);
  const H = 47;
  const cut = pose.sit ? 7 : 0;
  const L = Math.round(cx) - 11;
  const T = Math.round(gy) - H + cut;
  const gr = pose.grade;
  const R = gr ? (x, y, w, h, c) => fb.rect(L + x, T + y, w, h, gr(c)) : (x, y, w, h, c) => fb.rect(L + x, T + y, w, h, c);
  const leg = legOffsets(pose);
  const ub = (pose.bob ? 1 : 0) - leg.up;
  const hx = pose.lean || 0;
  const hy = ub;
  const wear = pose.wear || {};
  const back = !!pose.back;

  if (pose.shadow !== false) fb.ellipseA(cx, gy, 10, 2, 0x1b1530, 0.38);

  // legs and shoes
  R(5 + leg.l, 31, 5, 13 - leg.ll - cut, C.pants);
  R(12 + leg.r, 31, 5, 13 - leg.rl - cut, C.pants);
  R(5 + leg.l, 31, 1, 13 - leg.ll - cut, C.pantsSh);
  R(12 + leg.r, 31, 1, 13 - leg.rl - cut, C.pantsSh);
  R(4 + leg.l, 44 - leg.ll - cut, 6, 3, C.shoe);
  R(12 + leg.r, 44 - leg.rl - cut, 6, 3, C.shoe);
  R(4 + leg.l, 46 - leg.ll - cut, 6, 1, C.sole);
  R(12 + leg.r, 46 - leg.rl - cut, 6, 1, C.sole);
  R(5, 29, 12, 3, C.pants);

  // torso: open shirt over a white tee
  R(5, 17 + ub, 12, 13, C.shirt);
  if (back) {
    R(8, 17 + ub, 6, 1, C.shirtSh);
    R(11, 19 + ub, 1, 10, C.shirtSh);
    R(5, 29 + ub, 12, 1, C.shirtSh);
  } else {
    R(8, 17 + ub, 6, 13, C.tee);
    R(8, 29 + ub, 6, 1, C.teeSh);
    R(5, 29 + ub, 3, 1, C.shirtSh); R(14, 29 + ub, 3, 1, C.shirtSh);
    R(7, 18 + ub, 1, 11, C.shirtSh); R(14, 18 + ub, 1, 11, C.shirtSh);
  }
  R(16, 18 + ub, 1, 10, C.shirtRim);

  // arms
  const arms = pose.arms || 'down';
  const sw = pose.walk == null ? 0 : ((pose.walk & 3) === 0 ? 1 : (pose.walk & 3) === 2 ? -1 : 0);
  const armOpt = { ub, sw, len: 10, sleeve: C.shirt, shade: C.shirtSh, rim: C.shirtRim, wave: pose.wave };
  const aL = pose.armL || 'down';
  const aR = arms === 'head' ? 'head' : (pose.armR || 'down');
  if (!RAISED[aL]) drawArm(R, 'L', aL, armOpt);
  if (aR === 'head') {
    R(17, 17 + ub, 3, 4, C.shirt);
    R(19, 7 + ub, 3, 12, C.shirt);
    R(21, 7 + ub, 1, 12, C.shirtRim);
    R(19, 7 + ub, 3, 1, C.shirtSh);
  } else if (!RAISED[aR]) drawArm(R, 'R', aR, armOpt);

  // neck and head
  R(9, 16 + ub, 4, 1, SKIN_SH);
  if (back) {
    HEAD_ROWS.forEach(([a, b], i) => R(a + hx, i + hy, b - a + 1, 1, i < 13 ? C.hair : SKIN));
    R(6 + hx, 13 + hy, 2, 1, C.hair); R(10 + hx, 13 + hy, 2, 1, C.hair); R(14 + hx, 13 + hy, 2, 1, C.hair);
    R(8 + hx, 15 + hy, 6, 1, SKIN_SH);
    for (const [x, y, w] of [[7, -1, 3], [12, -1, 4], [3, 1, 1], [18, 1, 1], [5, 0, 1]]) R(x + hx, y + hy, w, 1, C.hair);
    R(6 + hx, 1 + hy, 4, 1, C.hairHi); R(4 + hx, 2 + hy, 3, 1, C.hairHi); R(12 + hx, 1 + hy, 3, 1, C.hairHi);
    for (const [x, y, h] of [[7, 4, 6], [13, 5, 6]]) R(x + hx, y + hy, 1, h, C.hairHi);
    R(19 + hx, 3 + hy, 1, 8, C.hairRim); R(18 + hx, 1 + hy, 1, 2, C.hairRim);
  } else {
    HEAD_ROWS.forEach(([a, b], i) => R(a + hx, i + hy, b - a + 1, 1, i < 5 ? C.hair : SKIN));
    R(2 + hx, 5 + hy, 18, 1, C.hair);
    for (const x of [2, 3, 4, 5, 8, 9, 10, 13, 14, 18, 19]) R(x + hx, 6 + hy, 1, 1, C.hair);
    for (const x of [2, 3, 9, 19]) R(x + hx, 7 + hy, 1, 1, C.hair);
    R(2 + hx, 8 + hy, 1, 2, C.hair); R(19 + hx, 8 + hy, 1, 1, C.hair);
    for (const [x, y, w] of [[7, -1, 3], [12, -1, 4], [3, 1, 1], [18, 1, 1], [5, 0, 1]]) R(x + hx, y + hy, w, 1, C.hair);
    R(6 + hx, 1 + hy, 4, 1, C.hairHi); R(4 + hx, 2 + hy, 3, 1, C.hairHi); R(12 + hx, 1 + hy, 3, 1, C.hairHi);
    R(19 + hx, 3 + hy, 1, 5, C.hairRim); R(18 + hx, 1 + hy, 1, 2, C.hairRim);
    face(R, pose, hx, hy, C.glasses || wear.glasses);
  }
  if (wear.scarf) scarf(R, wear, ub);
  if (wear.hat) hat(R, wear, hx, hy);
  if (aR === 'head') { R(17 + hx, 3 + ub, 4, 4, SKIN); R(17 + hx, 6 + ub, 4, 1, SKIN_SH); R(17 + hx, 3 + ub, 1, 3, SKIN_SH); }
  else if (RAISED[aR]) drawArm(R, 'R', aR, armOpt);
  if (RAISED[aL]) drawArm(R, 'L', aL, armOpt);
}

module.exports = { drawGirl, drawBoy, GIRL, GIRL_NOW, BOY, BOY_NOW, SKIN, SKIN_SH };
