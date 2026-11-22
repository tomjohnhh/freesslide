'use strict';
// The two characters: original chibi pixel figures, drawn with rectangles so that every
// pose (walk cycle, glance, blink, blush, arm gestures) is a parameter rather than a sprite.
//
// Local grid: 22 px wide, origin at the top-left of the figure's box; the figure stands
// on ground line gy and is centred on cx. Girl is 44 px tall, boy 47 px.

const SKIN = 0xf9dcc6;
const SKIN_SH = 0xe8b49b;
const EYE = 0x2a1a1f;
const WHITE = 0xffffff;
const MOUTH = 0xb4574e;
const BLUSH = [0, 0xf6b1a6, 0xf08379, 0xe8554f];

const GIRL = {
  hair: 0x4d2f2c, hairHi: 0x80503f, hairRim: 0x9a6248,
  top: 0xf7e8b6, topSh: 0xd8bd80, topRim: 0xfffbe6,
  skirt: 0xbb4a41, skirtSh: 0x8e3230,
  sock: 0xf7f3ee, shoe: 0x5b3a34, clip: 0xff7a6e,
};
const BOY = {
  hair: 0x252a42, hairHi: 0x414f7a, hairRim: 0x9a86a0,
  shirt: 0x82abde, shirtSh: 0x5c82ba, shirtRim: 0xdbeaff,
  tee: 0xf4f3ee, teeSh: 0xd3d6dd,
  pants: 0x3d4362, pantsSh: 0x2b2f49,
  shoe: 0xf3f1ec, sole: 0x9ba0b3,
};

const HEAD_ROWS = [[6, 15], [4, 17], [3, 18], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [2, 19], [3, 18], [4, 17], [6, 15]];

function face(R, pose, hx, hy) {
  const look = Math.max(-2, Math.min(2, pose.look || 0));
  const ex = hx + look;
  const eyes = pose.eyes || 'open';
  for (const x of [6, 14]) {
    if (eyes === 'blink') R(ex + x - 1, hy + 10, 3, 1, EYE);
    else if (eyes === 'happy') { R(ex + x - 1, hy + 10, 1, 1, EYE); R(ex + x, hy + 9, 2, 1, EYE); R(ex + x + 2, hy + 10, 1, 1, EYE); }
    else if (eyes === 'down') R(ex + x, hy + 9, 2, 2, EYE);
    else {
      const tall = eyes === 'wide' ? 4 : 3;
      R(ex + x, hy + 11 - tall, 2, tall, EYE);
      R(ex + x + (look > 0 ? 1 : 0), hy + 11 - tall, 1, 1, WHITE);
    }
  }
  const blush = pose.blush || 0;
  if (blush === 1) { R(hx + 4, hy + 12, 2, 1, BLUSH[1]); R(hx + 16, hy + 12, 2, 1, BLUSH[1]); }
  else if (blush === 2) { R(hx + 4, hy + 11, 3, 2, BLUSH[2]); R(hx + 15, hy + 11, 3, 2, BLUSH[2]); }
  else if (blush >= 3) {
    R(hx + 3, hy + 11, 4, 3, BLUSH[3]); R(hx + 15, hy + 11, 4, 3, BLUSH[3]);
    R(hx + 4, hy + 11, 1, 1, 0xffb9ad); R(hx + 16, hy + 11, 1, 1, 0xffb9ad);
  }
  const mx = ex;
  const mouth = pose.mouth || 'smile';
  if (mouth === 'smile') { R(mx + 9, hy + 12, 1, 1, MOUTH); R(mx + 10, hy + 13, 2, 1, MOUTH); R(mx + 12, hy + 12, 1, 1, MOUTH); }
  else if (mouth === 'small') R(mx + 10, hy + 13, 2, 1, MOUTH);
  else if (mouth === 'open') { R(mx + 10, hy + 12, 2, 2, MOUTH); }
  else if (mouth === 'wavy') { R(mx + 9, hy + 13, 1, 1, MOUTH); R(mx + 10, hy + 12, 1, 1, MOUTH); R(mx + 11, hy + 13, 1, 1, MOUTH); R(mx + 12, hy + 12, 1, 1, MOUTH); }
  else if (mouth === 'grin') { R(mx + 9, hy + 12, 4, 1, MOUTH); R(mx + 10, hy + 13, 2, 1, 0xffffff); }
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

function drawGirl(fb, cx, gy, pose = {}) {
  const C = GIRL;
  const H = 44;
  const L = Math.round(cx) - 11;
  const T = Math.round(gy) - H;
  const R = (x, y, w, h, c) => fb.rect(L + x, T + y, w, h, c);
  const leg = legOffsets(pose);
  const ub = (pose.bob ? 1 : 0) - leg.up;
  const hx = pose.lean || 0;
  const hy = ub;

  if (pose.shadow !== false) fb.ellipseA(cx, gy, 10, 2, 0x1b1530, 0.38);

  // long hair behind the shoulders
  R(2 + hx, 4 + hy, 18, 20, C.hair);
  R(1 + hx, 8 + hy, 20, 13, C.hair);
  R(3 + hx, 24 + hy, 3, 1, C.hair);
  R(16 + hx, 24 + hy, 3, 1, C.hair);

  // legs, socks, shoes
  R(7 + leg.l, 34, 3, 7 - leg.ll, SKIN);
  R(12 + leg.r, 34, 3, 7 - leg.rl, SKIN);
  R(7 + leg.l, 38 - leg.ll, 3, 3, C.sock);
  R(12 + leg.r, 38 - leg.rl, 3, 3, C.sock);
  R(6 + leg.l, 41 - leg.ll, 4, 3, C.shoe);
  R(12 + leg.r, 41 - leg.rl, 4, 3, C.shoe);

  // torso
  R(5, 17 + ub, 12, 11, C.top);
  R(5, 26 + ub, 12, 2, C.topSh);
  R(9, 17 + ub, 4, 1, C.topSh);
  R(16, 18 + ub, 1, 8, C.topRim);

  // skirt
  R(5, 28, 12, 1, C.skirt);
  R(4, 29, 14, 2, C.skirt);
  R(3, 31, 16, 4, C.skirt);
  R(3, 34, 16, 1, C.skirtSh);
  for (const x of [6, 10, 14]) R(x, 30, 1, 4, C.skirtSh);

  // arms
  const arms = pose.arms || 'down';
  const sw = pose.walk == null ? 0 : ((pose.walk & 3) === 0 ? 1 : (pose.walk & 3) === 2 ? -1 : 0);
  if (arms === 'front') {
    R(2, 18 + ub, 3, 6, C.top); R(17, 18 + ub, 3, 6, C.top);
    R(3, 23 + ub, 6, 3, C.top); R(13, 23 + ub, 6, 3, C.top);
    R(3, 25 + ub, 6, 1, C.topSh); R(13, 25 + ub, 6, 1, C.topSh);
    R(9, 23 + ub, 4, 3, SKIN); R(9, 25 + ub, 4, 1, SKIN_SH);
  } else if (arms === 'cheeks') {
    R(2, 17 + ub, 3, 4, C.top); R(17, 17 + ub, 3, 4, C.top);
    R(2, 13 + ub, 3, 4, C.top); R(17, 13 + ub, 3, 4, C.top);
  } else {
    R(2, 18 + ub, 3, 9 + sw, C.top); R(17, 18 + ub, 3, 9 - sw, C.top);
    R(2, 26 + ub + sw, 3, 1, C.topSh); R(17, 26 + ub - sw, 3, 1, C.topSh);
    R(2, 27 + ub + sw, 3, 2, SKIN); R(17, 27 + ub - sw, 3, 2, SKIN);
    R(19, 19 + ub, 1, 7 - sw, C.topRim);
  }

  // neck and head
  R(9, 16 + ub, 4, 1, SKIN_SH);
  HEAD_ROWS.forEach(([a, b], i) => R(a + hx, i + hy, b - a + 1, 1, i < 5 ? C.hair : SKIN));
  R(2 + hx, 5 + hy, 18, 1, C.hair);
  for (const x of [2, 3, 7, 8, 11, 12, 16, 17, 18, 19]) R(x + hx, 6 + hy, 1, 1, C.hair);
  for (const x of [2, 3, 18, 19]) R(x + hx, 7 + hy, 1, 6, C.hair);
  R(2 + hx, 13 + hy, 2, 1, C.hair); R(18 + hx, 13 + hy, 2, 1, C.hair);
  R(6 + hx, 1 + hy, 5, 1, C.hairHi); R(4 + hx, 2 + hy, 3, 1, C.hairHi); R(12 + hx, 1 + hy, 2, 1, C.hairHi);
  R(19 + hx, 4 + hy, 1, 4, C.hairRim); R(18 + hx, 2 + hy, 1, 2, C.hairRim); R(20 + hx, 9 + hy, 1, 11, C.hairRim);
  R(15 + hx, 4 + hy, 2, 2, C.clip);
  face(R, pose, hx, hy);
  if (arms === 'cheeks') {
    R(1 + hx, 10 + ub, 4, 4, SKIN); R(17 + hx, 10 + ub, 4, 4, SKIN);
    R(1 + hx, 13 + ub, 4, 1, SKIN_SH); R(17 + hx, 13 + ub, 4, 1, SKIN_SH);
    R(4 + hx, 10 + ub, 1, 3, SKIN_SH); R(17 + hx, 10 + ub, 1, 3, SKIN_SH);
  }
}

function drawBoy(fb, cx, gy, pose = {}) {
  const C = BOY;
  const H = 47;
  const L = Math.round(cx) - 11;
  const T = Math.round(gy) - H;
  const R = (x, y, w, h, c) => fb.rect(L + x, T + y, w, h, c);
  const leg = legOffsets(pose);
  const ub = (pose.bob ? 1 : 0) - leg.up;
  const hx = pose.lean || 0;
  const hy = ub;

  if (pose.shadow !== false) fb.ellipseA(cx, gy, 10, 2, 0x1b1530, 0.38);

  // legs and shoes
  R(5 + leg.l, 31, 5, 13 - leg.ll, C.pants);
  R(12 + leg.r, 31, 5, 13 - leg.rl, C.pants);
  R(5 + leg.l, 31, 1, 13 - leg.ll, C.pantsSh);
  R(12 + leg.r, 31, 1, 13 - leg.rl, C.pantsSh);
  R(4 + leg.l, 44 - leg.ll, 6, 3, C.shoe);
  R(12 + leg.r, 44 - leg.rl, 6, 3, C.shoe);
  R(4 + leg.l, 46 - leg.ll, 6, 1, C.sole);
  R(12 + leg.r, 46 - leg.rl, 6, 1, C.sole);
  R(5, 29, 12, 3, C.pants);

  // torso: open shirt over a white tee
  R(5, 17 + ub, 12, 13, C.shirt);
  R(8, 17 + ub, 6, 13, C.tee);
  R(8, 29 + ub, 6, 1, C.teeSh);
  R(5, 29 + ub, 3, 1, C.shirtSh); R(14, 29 + ub, 3, 1, C.shirtSh);
  R(7, 18 + ub, 1, 11, C.shirtSh); R(14, 18 + ub, 1, 11, C.shirtSh);
  R(16, 18 + ub, 1, 10, C.shirtRim);

  // arms
  const arms = pose.arms || 'down';
  const sw = pose.walk == null ? 0 : ((pose.walk & 3) === 0 ? 1 : (pose.walk & 3) === 2 ? -1 : 0);
  R(2, 18 + ub, 3, 10 + sw, C.shirt);
  R(2, 27 + ub + sw, 3, 1, C.shirtSh);
  R(2, 28 + ub + sw, 3, 2, SKIN);
  if (arms === 'head') {
    R(17, 17 + ub, 3, 4, C.shirt);
    R(19, 7 + ub, 3, 12, C.shirt);
    R(21, 7 + ub, 1, 12, C.shirtRim);
    R(19, 7 + ub, 3, 1, C.shirtSh);
  } else {
    R(17, 18 + ub, 3, 10 - sw, C.shirt);
    R(17, 27 + ub - sw, 3, 1, C.shirtSh);
    R(17, 28 + ub - sw, 3, 2, SKIN);
    R(19, 19 + ub, 1, 8 - sw, C.shirtRim);
  }

  // neck and head
  R(9, 16 + ub, 4, 1, SKIN_SH);
  HEAD_ROWS.forEach(([a, b], i) => R(a + hx, i + hy, b - a + 1, 1, i < 5 ? C.hair : SKIN));
  R(2 + hx, 5 + hy, 18, 1, C.hair);
  for (const x of [2, 3, 4, 5, 8, 9, 10, 13, 14, 18, 19]) R(x + hx, 6 + hy, 1, 1, C.hair);
  for (const x of [2, 3, 9, 19]) R(x + hx, 7 + hy, 1, 1, C.hair);
  R(2 + hx, 8 + hy, 1, 2, C.hair); R(19 + hx, 8 + hy, 1, 1, C.hair);
  for (const [x, y, w] of [[7, -1, 3], [12, -1, 4], [3, 1, 1], [18, 1, 1], [5, 0, 1]]) R(x + hx, y + hy, w, 1, C.hair);
  R(6 + hx, 1 + hy, 4, 1, C.hairHi); R(4 + hx, 2 + hy, 3, 1, C.hairHi); R(12 + hx, 1 + hy, 3, 1, C.hairHi);
  R(19 + hx, 3 + hy, 1, 5, C.hairRim); R(18 + hx, 1 + hy, 1, 2, C.hairRim);
  face(R, pose, hx, hy);
  if (arms === 'head') { R(17 + hx, 3 + ub, 4, 4, SKIN); R(17 + hx, 6 + ub, 4, 1, SKIN_SH); R(17 + hx, 3 + ub, 1, 3, SKIN_SH); }
}

module.exports = { drawGirl, drawBoy };
