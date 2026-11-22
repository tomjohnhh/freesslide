'use strict';
// The opening of the song as nine shots: two people take their first picture together with a
// self-timer by the river at sunset. Times are in beats of the song (ctx.at(beat) -> seconds).
const R = require('./raster');
const { P, G } = require('./draw');
const { person } = require('./people');
const W = require('./world');
const props = require('./props');

function create(ctx) {
  const { at, clamp, lerp, ease, cfg } = ctx;
  const seg = (v, a, b) => clamp((v - a) / (b - a));
  const io = (v, a, b) => ease.io(seg(v, a, b));
  const pulse = (v, a, b, c, d) => io(v, a, b) * (1 - io(v, c, d));   // up over a..b, down over c..d
  const blink = (t, ph, every = 2.9) => { const x = ((((t + ph) % every) + every) % every) / 0.15; return x < 1 ? Math.sin(Math.PI * x) : 0; };
  const sweep = (x) => (x > 0 && x < 1 ? 0.03 + x * 1.4 : 0);        // a reflection crossing his glasses

  // the light on the two: against the evening sun / facing it
  const BACKLIT = [0.8, 0.72, 0.86], DARK = [0.6, 0.54, 0.74], WARM = [1, 0.95, 0.9];
  const HER = 800, HIM0 = 1046, HIM1 = 994, GROUND = 965, K = 0.62;
  const TRIPOD = [1590, 1190, 1.9];

  const toFrame = (cam, x, y, depth = 1) => {
    const z = 1 + (cam.zoom - 1) * depth;
    return [960 + z * (x - 960 - (cam.x - 960) * depth - (cam.px || 0)), 540 + z * (y - 540 - (cam.y - 540) * depth - (cam.py || 0))];
  };

  function world(g, cam, t) {
    const S = g.surf.s, px = cam.px || 0;
    W.drawLayer(g, W.sky(S), cam, 0.12);
    W.drawLayer(g, W.farClouds(S), Object.assign({}, cam, { px: px - t * 1.5 }), 0.2);
    W.drawLayer(g, W.nearClouds(S), Object.assign({}, cam, { px: px - t * 5 }), 0.3);
    W.drawLayer(g, W.town(S), cam, 0.5);
    W.river(g, t, cam, 0.75);
    W.drawLayer(g, W.promenade(S), cam, 1);
    W.lampGlow(g, t, cam);
  }
  function light(g, cam, t, strength = 0.8, specks = 40, streak = true) {
    const [sx, sy] = toFrame(cam, W.SUN[0], W.SUN[1], 0.12);
    if (sy > -500 && sy < 1500) { W.sunRays(g, t, sx, sy, strength); W.flare(g, sx, sy, strength, streak); }
    if (specks) W.motes(g, t, specks, 3);
  }
  // a small four-pointed twinkle
  function twinkle(g, x, y, r, a) {
    if (a <= 0.02) return;
    g.fill(P().poly([[x - r, y], [x - r * 0.12, y - r * 0.12], [x, y - r], [x + r * 0.12, y - r * 0.12], [x + r, y], [x + r * 0.12, y + r * 0.12], [x, y + r], [x - r * 0.12, y + r * 0.12]]), [255, 252, 236, a]);
    g.fill(P().circle(x, y, r * 1.5), { radial: [x, y, r * 1.5], stops: [[0, [255, 240, 200, 0.35 * a]], [1, [255, 240, 200, 0]]] }, { mode: 'add' });
  }
  function twinkles(g, t, list) {
    for (const [x, y, r, ph] of list) twinkle(g, x, y, r * (0.7 + 0.3 * Math.sin(t * 5 + ph)), Math.max(0, Math.sin(t * 2.6 + ph)));
  }
  // a drop of sweat
  function drop(g, x, y, s, a) {
    if (a <= 0.02) return;
    const d = P().M(x, y - s * 1.5).Q(x + s * 0.9, y + s * 0.1, x + s * 0.55, y + s * 0.7).Q(x, y + s * 1.2, x - s * 0.55, y + s * 0.7).Q(x - s * 0.9, y + s * 0.1, x, y - s * 1.5).Z();
    g.fill(d, [214, 236, 255, 0.9 * a]);
    g.stroke(d, 2.2, [110, 150, 210, 0.9 * a]);
    g.fill(P().ellipse(x - s * 0.22, y + s * 0.3, s * 0.14, s * 0.3), [255, 255, 255, 0.9 * a]);
  }

  // ---- 1: down from the evening sky to the two by the river, the camera waiting on its tripod
  const FLOCK = [];
  { const rnd = W.rng(17); for (let i = 0; i < 7; i++) FLOCK.push({ x: 380 + i * 46 + rnd() * 30, y: 250 - Math.abs(i - 3) * 24 + rnd() * 16, vx: 34, vy: -5, ph: rnd() * 6, s: 8 + rnd() * 4 }); }
  const camArrive = (t) => ({ x: 960, y: 540, zoom: 1 + 0.022 * t, py: 30 - 880 * (1 - ease.glide(seg(t, 0.05, 1.8))) });
  function arrive(fb, t, b) {
    const g = new G(fb), cam = camArrive(t);
    world(g, cam, t);
    g.save(); W.place(g, cam, 0.3);
    props.birds(g, t, FLOCK);
    g.restore();
    g.save(); W.place(g, cam, 1);
    props.shadow(g, HER, GROUND, K);
    props.shadow(g, HIM0, GROUND + 3, K);
    person(g, 'her', { x: HER, y: GROUND, k: K, t, tone: BACKLIT, blink: blink(t, 0.4), look: [0.6 * io(b, 1.0, 1.4), 0], blush: 0.25, mouth: 'small', lean: 0.008 * Math.sin(t * 1.6) });
    person(g, 'him', { x: HIM0, y: GROUND + 3, k: K, t, tone: BACKLIT, blink: blink(t, 1.7), look: [0.25, 0], mouth: 'small', lean: 0.006 * Math.sin(t * 1.3 + 1) });
    props.tripod(g, TRIPOD[0], TRIPOD[1], TRIPOD[2], t);
    g.restore();
    light(g, cam, t, 0.8 * io(t, 1.0, 2.0));
  }
  const screenOfTripod = (t) => { const s = props.tripodScreen(TRIPOD[0], TRIPOD[1], TRIPOD[2]); return toFrame(camArrive(t), s[0], s[1]); };

  // ---- 2: what the camera sees while the self-timer runs; he edges closer on the beat
  const camDuo = (b) => ({ x: 915, y: 688, zoom: 2.42 + 0.035 * (b - 2) });
  function duo(fb, t, b, ui) {
    const g = new G(fb), cam = camDuo(b);
    world(g, cam, t);
    const stepIn = io(b, 2.95, 3.3), hop = Math.sin(Math.PI * seg(b, 2.95, 3.3));
    const glance = pulse(b, 2.2, 2.4, 2.7, 2.88), jolt = pulse(b, 3.0, 3.1, 3.4, 3.6), shy = io(b, 3.05, 3.5), ready = io(b, 3.55, 3.85);
    g.save(); W.place(g, cam, 1);
    const her = person(g, 'her', {
      x: HER, y: GROUND, k: K, t, tone: BACKLIT, blink: jolt > 0.1 ? 0 : blink(t, 0.4), look: [0.8 * Math.max(glance, jolt), 0.15 * jolt], brow: jolt,
      mouth: jolt > 0.5 ? 'o' : ready > 0.5 ? 'smile' : 'small', blush: 0.25 + 0.6 * shy, tilt: 0.07 * ready, lean: 0.006 * Math.sin(t * 1.6),
    });
    const him = person(g, 'him', {
      x: lerp(HIM0, HIM1, stepIn), y: GROUND + 3 - 8 * hop, k: K, t, tone: BACKLIT, blink: blink(t, 1.7), look: [-0.7 * pulse(b, 2.45, 2.6, 2.85, 2.95) + 0.7 * pulse(b, 3.3, 3.42, 3.62, 3.78), -0.1],
      mouth: b > 3.25 ? 'wavy' : 'small', blush: 0.15 + 0.7 * io(b, 3.1, 3.5), glint: sweep(seg(b, 3.62, 3.98)), lean: -0.035 * hop, brow: 0.5 * io(b, 3.1, 3.4),
    });
    g.restore();
    light(g, cam, t, 0.55, 26, false);
    if (ui) {
      const beat = Math.pow(1 - (b - Math.floor(b)), 3);
      props.viewfinder(g, [[her.face[0], her.face[1], 196], [him.face[0], him.face[1], 196]], b >= 2 ? beat : 0);
      const n = b < 3 ? '2' : '1';
      props.stamp(g, n, 232, 154, 56, [255, 255, 255, 0.95], null);
    }
    return { her: her.face, him: him.face };
  }
  const finder = (fb, t, b) => duo(fb, t, b, true);
  const probe = (b) => duo(new R.FB(0.05), at(b), b, false);

  // the picture they took, as the camera kept it
  const pictures = new Map();
  function picture(S) {
    if (!pictures.has(S)) {
      const f = new R.FB(S);
      duo(f, at(3.99), 3.99, false);
      props.stamp(new G(f), cfg.stamp || "'09 8 18", 1920 - 86, 1080 - 70, 50);
      const layer = R.snapshot(f);
      pictures.set(S, { layer, soft: R.soften(layer, Math.max(1, Math.round(8 * S)), 3, 2) });
    }
    return pictures.get(S);
  }

  // ---- 3: the flash; the picture becomes a print
  function printShot(fb, t, b) {
    const g = new G(fb), pic = picture(fb.s), k = ease.out(seg(b, 4.0, 4.95)), later = Math.max(0, b - 4.95);
    const z = 1.3 + 0.05 * (b - 4);
    g.save(); g.translate(960, 540); g.scale(z); g.layer(pic.soft, -960, -540); g.restore();
    g.all([26, 16, 56, 0.4]);
    W.motes(g, t, 34, 9, { size: 1.4 });
    const w = lerp(1920, 1130, k) - 16 * later, rot = lerp(0, -0.05, k) - 0.008 * later + 0.004 * Math.sin(t * 1.1) * k;
    props.print(g, pic.layer, 960 + 8 * later, lerp(540, 486, k) + 5 * Math.sin(t * 1.4) * k, w, rot, 30, k, { bottom: 50, lift: 1 + 0.3 * Math.sin(t * 1.4) });
    twinkles(g, t, [[330, 250, 26, 0.5], [1620, 330, 20, 2.1], [1540, 800, 30, 3.9], [300, 760, 18, 5.2]].map(([x, y, r, ph]) => [x, y, r * k, ph]));
  }

  // ---- 4: two hands that do not dare, then the camera drops to their feet
  function hands(fb, t, b) {
    const g = new G(fb), m = ease.glide(seg(b, 6.88, 7.48));
    const cam = { x: lerp(917, 920, m) + 2.5 * Math.sin(t * 0.9), y: lerp(782, 942, m) + 1.5 * Math.sin(t * 1.3), zoom: lerp(6.1, 5.1, m) + 0.14 * (b - 6) };
    world(g, cam, t);
    const reach = io(b, 6.12, 6.55) * (1 - ease.out(seg(b, 6.72, 6.84))), tremble = reach * Math.sin(t * 40) * 1.1, fist = io(b, 6.76, 6.92);
    const tap = Math.max(0, Math.sin((b - 7.42) * Math.PI * 4)) * 9 * seg(b, 7.42, 7.5), scuff = Math.sin((b - 7.3) * Math.PI * 2.4) * 5 * seg(b, 7.3, 7.5);
    g.save(); W.place(g, cam, 1);
    props.shadow(g, 852, GROUND, K);
    props.shadow(g, 986, GROUND + 3, K);
    person(g, 'her', {
      x: 852, y: GROUND, k: K, t, tone: BACKLIT, wind: 1.2, feet: [5, -5], heel: [0, tap],
      armR: { hand: [50 + 5 * reach + 1.2 * Math.sin(t * 5.2), -280 + 1.5 * Math.sin(t * 3.7)], curl: 0.42 + 0.28 * Math.sin(t * 6.1) },
    });
    const him = person(g, 'him', {
      x: 986, y: GROUND + 3, k: K, t, tone: BACKLIT, feet: [scuff, 0],
      armL: { hand: [-62 - 34 * reach + tremble, -308 + 20 * reach], curl: lerp(lerp(0.35, 0.02, reach), 0.95, fist) },
    });
    g.restore();
    props.startle(g, him.handL[0] - 30, him.handL[1] - 10, seg(b, 6.5, 6.86), 70, [255, 244, 226]);
    W.motes(g, t, 30, 4, { size: 1.6 });
  }

  // ---- 5: heads together over the camera's screen - and apart again
  function lcd(fb, t, b) {
    const g = new G(fb), S = fb.s;
    const cam = { x: 1000, y: 566, zoom: 1.32 + 0.04 * (b - 8) };
    world(g, cam, t);
    light(g, cam, t, 0.9, 30);
    const lean = io(b, 8.05, 8.85) - 1.5 * ease.back(seg(b, 9.0, 9.32)) + 0.55 * io(b, 9.5, 10.3);
    const jump = Math.sin(Math.PI * seg(b, 9.0, 9.24));
    const cy = 436 + 3 * Math.sin(t * 1.2), ink = [40, 34, 66];
    g.fill(P().rrect(960 - 20, cy + 190, 40, 1000, 6), ink);
    g.fill(P().rect(960 + 12, cy + 190, 4, 1000), [255, 196, 140, 0.5]);
    g.fill(P().rrect(960 - 56, cy + 222, 112, 30, 8), ink);
    g.stroke(P().M(1000, cy + 240).L(1100, cy + 300), 14, ink);
    props.cameraBack(g, 960, cy, 740, picture(S).layer, t);
    const a = person(g, 'her', { back: true, sit: true, x: 474 + 118 * lean, y: 2470 - 24 * jump, k: 3.1, tilt: 0.1 * lean, tone: DARK, t, wind: 1.2 });
    const c = person(g, 'him', { back: true, sit: true, x: 1452 - 118 * lean, y: 2548 - 24 * jump, k: 3.1, tilt: -0.1 * lean, tone: DARK, t });
    const st = seg(b, 9.0, 9.45);
    props.startle(g, a.face[0] - 40, a.face[1] - 120, st, 110);
    g.save(); g.translate(c.face[0] + 40, c.face[1] - 120); g.scale(-1, 1); props.startle(g, 0, 0, st, 110); g.restore();
  }

  // ---- 6: she laughs
  function herShot(fb, t, b) {
    const g = new G(fb), push = 1 + 0.05 * (b - 10);
    W.soft(g, t, 'sun', { shift: -50 * (b - 10), sun: [1420, 560], horizon: 600 });
    g.save(); g.translate(960, 520); g.scale(push); g.translate(-960, -520);
    const laugh = Math.abs(Math.sin(t * 11.5)) * 5;
    person(g, 'her', {
      x: 940, y: 2925 + laugh, k: 4.4, sit: true, t, wind: 1.8, tone: WARM, eyes: 'smile', mouth: 'open', blush: 0.85, brow: 0.3,
      tilt: -0.06 + 0.035 * Math.sin(t * 3.1), lean: 0.006 * Math.sin(t * 2.2),
      armR: { elbow: [70, -396], hand: [30, -478], handAngle: -2.05, curl: 0.55, front: true },
    });
    g.restore();
    twinkles(g, t, [[420, 300, 34, 0.3], [1500, 250, 28, 1.9], [1610, 640, 36, 3.2], [330, 700, 24, 4.6]]);
    W.motes(g, t, 26, 5, { size: 1.5 });
  }

  // ---- 7: he does not know where to look
  function himShot(fb, t, b) {
    const g = new G(fb), push = 1 + 0.05 * (b - 11);
    W.soft(g, t, 'dusk', { shift: -50 * (b - 11) - 400 });
    g.save(); g.translate(960, 520); g.scale(push); g.translate(-960, -520);
    const scratch = Math.sin(t * 15) * 5;
    const spots = person(g, 'him', {
      x: 980, y: 3090, k: 4.3, sit: true, t, tone: WARM, eyes: 'open', mouth: 'wavy', blush: 0.9, brow: -0.6,
      look: [lerp(0.85, -0.75, io(b, 11.45, 11.62)), -0.15], blink: blink(t, 0.95, 1.9), glint: sweep(seg(b, 11.15, 11.5)),
      tilt: 0.05 + 0.012 * Math.sin(t * 2.6), turn: lerp(0.35, -0.15, io(b, 11.45, 11.65)),
      armR: { elbow: [128, -560], hand: [52 + scratch, -618 - scratch * 0.5], handAngle: -2.6, curl: 0.5 },
    });
    g.restore();
    const a = 1 - Math.abs(seg(b, 10.9, 12.2) * 2 - 1);
    drop(g, spots.face[0] - 236 * push, spots.face[1] - 150 * push + 90 * seg(b, 11, 12), 34, Math.min(1, a * 3));
    W.motes(g, t, 26, 6, { size: 1.5 });
  }

  // ---- 8: an apple, from her to him
  function appleShot(fb, t, b) {
    const g = new G(fb), u = b - 12, push = 1 + 0.06 * u;
    W.soft(g, t, 'dusk', { shift: -30 * u - 800 });
    g.save(); g.translate(950, 640); g.scale(push); g.translate(-950, -640);
    const lift = ease.back(seg(b, 11.95, 12.5)), take = io(b, 12.85, 13.28), touch = pulse(b, 13.22, 13.32, 13.7, 14.2), glad = io(b, 13.3, 13.5);
    const hand = [lerp(64, 122, lift), lerp(-250, -436, lift)];
    const kk = 2.5, hx = 640, hy = 1770, mx = 1240, my = 1776;
    const her = person(g, 'her', {
      x: hx, y: hy, k: kk, sit: true, t, tone: WARM, wind: 1.3, blink: blink(t, 0.4), look: [0.8, -0.35], eyes: glad > 0.5 ? 'smile' : 'open',
      mouth: glad > 0.5 ? 'open' : 'smile', blush: 0.45 + 0.4 * touch, tilt: 0.05 + 0.04 * glad, turn: 0.4,
      armR: { hand, handAngle: -1.1, curl: 0.5, thumb: -1 },
    });
    // the apple sits on her hand
    const ax = hx + (hand[0] + 9) * kk, ay = hy + (hand[1] - 30) * kk;
    const reach = [lerp(-62, (ax - mx) / kk + 22, take), lerp(-308, (ay - my) / kk + 26, take)];
    const him = person(g, 'him', {
      x: mx, y: my, k: kk, sit: true, t, tone: WARM, blink: blink(t, 1.2), look: [-0.8, 0.45], brow: 0.8 * pulse(b, 12.3, 12.5, 13.0, 13.3) + 0.6 * touch,
      mouth: b < 12.3 ? 'small' : b < 13.28 ? 'o' : 'wavy', blush: 0.3 + 0.6 * io(b, 12.5, 13.4), tilt: -0.04, turn: -0.4, glint: sweep(seg(b, 12.5, 12.85)),
      armL: { hand: reach, handAngle: lerp(1.6, -2.0, take), curl: lerp(0.35, 0.3, take) },
    });
    props.apple(g, ax, ay, 21 * kk, [1, 0.97, 0.94], { glint: pulse(b, 12.9, 13.02, 13.08, 13.4) });
    props.startle(g, ax, ay - 30, seg(b, 13.26, 13.7), 90, [255, 240, 220]);
    g.restore();
    W.motes(g, t, 26, 7, { size: 1.5 });
    return { her, him };
  }

  // ---- 9: the two at the railing, small under the evening sky
  function ending(fb, t, b) {
    const g = new G(fb), u = seg(b, 13.6, 16.8), e = ease.io(u);
    const cam = { x: lerp(965, 960, e), y: lerp(700, 570, e), zoom: lerp(2.3, 1.16, e), py: lerp(0, -150, e) };
    world(g, cam, t);
    g.save(); W.place(g, cam, 0.3);
    props.birds(g, t - 10, FLOCK.map((f) => Object.assign({}, f, { x: f.x + 420, y: f.y + 40 })));
    g.restore();
    g.save(); W.place(g, cam, 0.12);
    props.shootingStar(g, seg(b, 15.0, 15.7), 700, -330, 1120, -150);
    g.restore();
    const k = 0.36, y = 832, near = io(b, 14.6, 15.6);
    g.save(); W.place(g, cam, 1);
    props.shadow(g, 902 + 14 * near, y, k, { len: 420 });
    props.shadow(g, 1004, y + 2, k, { len: 420 });
    person(g, 'her', { back: true, x: 902 + 14 * near, y, k, t, tone: DARK, wind: 1.2, tilt: 0.22 * io(b, 15.1, 15.9), lean: 0.03 * io(b, 15.1, 15.9) });
    person(g, 'him', { back: true, x: 1004, y: y + 2, k, t, tone: DARK, tilt: -0.07 * io(b, 15.3, 16.0) });
    g.restore();
    light(g, cam, t, 0.9, 46);
  }

  // ---- words on the picture
  ctx.text({ t0: 0.4, t1: at(2) - 0.32, style: 'Title', text: cfg.title || '', pos: [1100, 300], fade: [450, 260], blur: 2, tags: '\\fsp58\\t(0,1500,0.6,\\fsp26)' });
  if (cfg.artist) ctx.text({ t0: 0.75, t1: at(2) - 0.32, style: 'Sub', text: cfg.artist, pos: [1100, 440], fade: [450, 260] });
  {
    const p0 = probe(2.4), p1 = probe(3.6), t0 = at(2) + 0.24, t1 = at(4) - 0.05;
    const tags = '\\c&H78FF96&';
    ctx.text({ t0, t1, style: 'Note', text: cfg.you || '你', pos: [p0.her[0], p0.her[1] - 150], fade: [120, 0], tags });
    ctx.text({ t0, t1, style: 'Note', text: cfg.me || '我', pos: [p0.him[0], p0.him[1] - 150], move: [p1.him[0], p1.him[1] - 150, (at(2.95) - t0) * 1000, (at(3.3) - t0) * 1000], fade: [120, 0], tags });
  }

  return [
    { from: -cfg.offset / cfg.period, to: 2, draw: arrive },
    { from: 2, to: 4, draw: finder, enter: { type: 'punch', dur: 0.5, from: screenOfTripod, into: [960, 470], zoom: 3.2, open: 1.3 } },
    { from: 4, to: 6, draw: printShot, enter: { type: 'flash', pre: 0.06, post: 0.5 } },
    { from: 6, to: 8, draw: hands, enter: { type: 'whip', dir: 'up', dur: 0.4 } },
    { from: 8, to: 10, draw: lcd, enter: { type: 'punch', dur: 0.46, from: [960, 600], into: [960, 440], zoom: 2.2, open: 1.3 } },
    { from: 10, to: 11, draw: herShot, enter: { type: 'whip', dir: 'right', dur: 0.36 } },
    { from: 11, to: 12, draw: himShot, enter: { type: 'whip', dir: 'left', dur: 0.36 } },
    { from: 12, to: 14, draw: appleShot, enter: { type: 'leak', dur: 0.5, amount: 0.45 } },
    { from: 14, to: 16.6, draw: ending, enter: { type: 'fade', dur: 0.7 } },
  ];
}

module.exports = { create };
