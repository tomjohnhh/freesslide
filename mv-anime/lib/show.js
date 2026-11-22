'use strict';
// The timeline: turns a time into a frame. Shots are laid out in beats of the song; each shot
// draws the frame for its span, then the whole-frame finishing is applied. The frame is a pure
// function of the time, so frames can be drawn in any order and by several workers.
//
// A shot: { from, to (beats), draw(fb, t, b), enter }.
// enter: how the shot arrives, { type: fade | leak | flash | whip | punch, dur (seconds,
// centred on the cut) or pre / post (seconds before / after the cut), ... } - see trans.js.
// A setting may be a function of the time (e.g. the point a zoom flies into).
// Without enter the shot starts with a plain cut.
const { FB } = require('./raster');
const look = require('./look');
const trans = require('./trans');

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, u) => a + (b - a) * u;
const ease = {
  io: (u) => { u = clamp(u); return u * u * (3 - 2 * u); },
  out: (u) => { u = clamp(u); return 1 - (1 - u) * (1 - u) * (1 - u); },
  in: (u) => { u = clamp(u); return u * u * u; },
  // starts and ends at rest, very gently
  glide: (u) => { u = clamp(u); return u * u * u * (u * (u * 6 - 15) + 10); },
  // overshoots and settles
  back: (u) => { u = clamp(u); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
};

function createShow(cfg) {
  const P = cfg.period, O = cfg.offset, fps = cfg.fps || 60;
  const ctx = {
    cfg, P, O, clamp, lerp, ease,
    at: (k) => O + k * P,
    beat: (t) => (t - O) / P,
    texts: [],
    text(e) { this.texts.push(e); },
  };
  const shots = require('./story').create(ctx);
  shots.sort((a, b) => a.from - b.from);
  const duration = cfg.duration || ctx.at(shots[shots.length - 1].to);
  const lines = cfg.lines || [];

  const cuts = shots.map((s, i) => {
    const e = s.enter;
    if (!e || i === 0) return null;
    if (!trans[e.type]) throw new Error('unknown transition ' + e.type);
    const pre = e.pre === undefined ? (e.dur || 0.4) / 2 : e.pre, post = e.post === undefined ? (e.dur || 0.4) / 2 : e.post;
    const T = ctx.at(s.from);
    return { T, pre, post, t0: T - pre, t1: T + post, e, o: Object.assign({}, e, { pre, post, step: 1 / fps / (pre + post), since: 0, time: 0 }) };
  });
  for (let i = 2; i < cuts.length; i++) {
    if (cuts[i] && cuts[i - 1] && cuts[i].t0 < cuts[i - 1].t1 - 1e-6) throw new Error(`the transitions into shots ${i - 1} and ${i} overlap`);
  }
  let tmpA = null, tmpB = null;

  const drawShot = (i, fb, t) => shots[i].draw(fb, t, ctx.beat(t));

  function frame(fb, t) {
    const b = ctx.beat(t);
    let i = shots.length - 1;
    while (i > 0 && b < shots[i].from) i--;
    let j = -1;
    if (cuts[i] && t < cuts[i].t1) j = i;
    else if (i + 1 < shots.length && cuts[i + 1] && t > cuts[i + 1].t0) j = i + 1;
    if (j > 0) {
      const c = cuts[j];
      if (!tmpA || tmpA.w !== fb.w) { tmpA = new FB(fb.s); tmpB = new FB(fb.s); }
      drawShot(j - 1, tmpA, t);
      drawShot(j, tmpB, t);
      for (const key of Object.keys(c.e)) if (typeof c.e[key] === 'function') c.o[key] = c.e[key](t);
      c.o.since = t - c.T; c.o.time = t;
      trans[c.o.type](fb, tmpA, tmpB, clamp((t - c.t0) / (c.t1 - c.t0)), c.o);
    } else {
      drawShot(i, fb, t);
    }
    look.bloom(fb, cfg.bloom === undefined ? 0.5 : cfg.bloom);
    let lyric = 0;
    for (const l of lines) lyric = Math.max(lyric, clamp((t - l.t0 + 0.4) / 0.4) * clamp((l.t1 + 0.5 - t) / 0.4));
    if (lyric > 0) look.shade(fb, 0.3 * lyric, 840);
    look.vignette(fb, 0.24);
    look.dim(fb, Math.min(clamp(t / 0.6), clamp((duration - t) / (cfg.fadeOut || 1))));
  }

  return { duration, fps, frame, lines, texts: ctx.texts, shots };
}

module.exports = { createShow, clamp, lerp, ease };
