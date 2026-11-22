'use strict';
// The whole video: a list of shots laid over the song's beat grid.
// cfg = { period, offset, title, artist, stamp, stamp2, duration, lines: [{ t0, t1, text }] }
// period/offset describe the beat grid in seconds. Lyrics come from cfg only; none are
// stored in the code.

const { FB, bayer } = require('./fb');
const { text, measure } = require('./font');
const { createOpening } = require('./opening');
const U = require('./util');
const { INK, clamp } = U;

const W = 320;
const H = 180;

function createShow(cfg) {
  const P = cfg.period;
  const O = cfg.offset;
  const beatPhase = (t) => { const b = (t - O) / P; return b - Math.floor(b); };
  const ctx = {
    cfg, P, O,
    at: (k) => O + k * P,
    beat: (t) => (t - O) / P,
    beatPhase,
    onBeat: (t, len = 0.22) => t >= O && beatPhase(t) < len,
    off: new FB(W, H), off2: new FB(W, H), snap: new FB(W, H), tmp: new FB(W, H), first: new FB(W, H), cell: new FB(30, 28),
  };
  const opening = createOpening(ctx);
  ctx.opening = opening;

  // shots after the opening: { from, to (beats), draw(fb, t, b, u), fade }
  let shots = [];
  for (const part of ['./part1', './part2']) {
    let mod = null;
    try { mod = require(part); } catch (err) { if (err.code !== 'MODULE_NOT_FOUND' || !String(err.message).includes(part.slice(2))) throw err; }
    if (mod) shots = shots.concat(mod.create(ctx));
  }
  shots.sort((a, b) => a.from - b.from);
  const lastBeat = shots.length ? shots[shots.length - 1].to : 16;
  const duration = cfg.duration || O + lastBeat * P;

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

  function findShot(b) {
    for (let i = shots.length - 1; i >= 0; i--) if (b >= shots[i].from) return shots[i];
    return null;
  }

  function drawShot(fb, s, t) {
    fb.ox = 0; fb.oy = 0; fb.unclip();
    s.draw(fb, t, (t - O) / P - s.from, t - (O + s.from * P));
    fb.ox = 0; fb.oy = 0; fb.unclip();
  }

  function frame(fb, t) {
    fb.ox = 0; fb.oy = 0; fb.unclip();
    const b = (t - O) / P;
    let shot = null;
    if (t < opening.end || !shots.length) opening.frame(fb, Math.min(t, opening.end - 1e-3));
    else {
      shot = findShot(b);
      drawShot(fb, shot, t);
      // soft cut: dissolve from the previous shot for the first `fade` seconds
      if (shot.fade) {
        const u = t - (O + shot.from * P);
        if (u < shot.fade) {
          const prev = shots[shots.indexOf(shot) - 1];
          if (prev) {
            drawShot(ctx.tmp, prev, t);
            const lv = (u / shot.fade) * 16;
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x, y) >= lv) fb.set(x, y, ctx.tmp.get(x, y));
          }
        }
      }
    }
    lyric(fb, t);
    if (t < opening.end + 0.6) opening.post(fb, t);
    if (shot && shot.post) shot.post(fb, t, b - shot.from, t - (O + shot.from * P));
    const fade = clamp((t - (duration - (cfg.fadeOut || 0.55) - 0.05)) / (cfg.fadeOut || 0.55));
    if (fade > 0) fb.wash(0x0b0814, fade);
  }

  return { frame, duration, marks: opening.marks, shots };
}

module.exports = { createShow, W, H };
