'use strict';
// The timeline: turns a time into a frame. Shots are laid out in beats of the song; each shot
// draws the frame for its span, then the whole-frame finishing is applied.
const { FB, mix } = require('./canvas');
const look = require('./look');

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, u) => a + (b - a) * u;
const ease = {
  io: (u) => { u = clamp(u); return u * u * (3 - 2 * u); },
  out: (u) => { u = clamp(u); return 1 - (1 - u) * (1 - u) * (1 - u); },
  in: (u) => { u = clamp(u); return u * u * u; },
};

function createShow(cfg, env) {
  const P = cfg.period, O = cfg.offset;
  const ctx = {
    cfg, P, O, assets: env.assets, clamp, lerp, ease,
    at: (k) => O + k * P,
    beat: (t) => (t - O) / P,
    texts: [],
    text(e) { this.texts.push(e); },
  };
  const shots = [];
  for (const part of ['./opening']) for (const s of require(part).create(ctx)) shots.push(s);
  shots.sort((a, b) => a.from - b.from);
  const duration = cfg.duration || ctx.at(shots[shots.length - 1].to);
  const lines = cfg.lines || [];
  let tmpA = null, tmpB = null;

  function drawShot(i, fb, t) {
    const s = shots[i], b = ctx.beat(t);
    s.draw(fb, t, b, clamp((b - s.from) / (s.to - s.from)));
  }

  function frame(fb, t) {
    const b = ctx.beat(t);
    let i = shots.length - 1;
    while (i > 0 && b < shots[i].from) i--;
    const s = shots[i];
    const since = (b - s.from) * P;
    if (i > 0 && s.fade && since < s.fade) {
      if (!tmpA || tmpA.w !== fb.w) { tmpA = new FB(fb.s); tmpB = new FB(fb.s); }
      drawShot(i - 1, tmpA, t);
      drawShot(i, tmpB, t);
      mix(fb, tmpA, tmpB, ease.io(since / s.fade));
    } else {
      drawShot(i, fb, t);
    }
    let lyric = 0;
    for (const l of lines) lyric = Math.max(lyric, clamp((t - l.t0 + 0.4) / 0.4) * clamp((l.t1 + 0.5 - t) / 0.4));
    if (lyric > 0) look.shade(fb, 0.42 * lyric, 820);
    look.vignette(fb, 0.34);
    look.grain(fb, Math.round(t * 30), cfg.grain === undefined ? 3.5 : cfg.grain);
    look.dim(fb, Math.min(clamp(t / 0.7), clamp((duration - t) / (cfg.fadeOut || 1))));
  }

  return { duration, frame, lines, texts: ctx.texts, shots };
}

module.exports = { createShow, clamp, lerp, ease };
