'use strict';
// Writes the on-screen text (captions, title, labels) as an ASS subtitle script; ffmpeg draws
// it over the frames with the font shipped in assets/fonts.
const FONT = 'Riverside Kai';

const STYLES = [
  // Name, Fontname, Fontsize, Primary, Secondary, Outline, Back, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
  `Style: Lyric,${FONT},60,&H00FFFFFF,&H6EFFFFFF,&H46101010,&H78000000,0,0,0,0,100,100,4,0,1,2.4,1.6,2,80,80,44,1`,
  `Style: Title,${FONT},156,&H00FFFFFF,&H00FFFFFF,&H64000000,&H78000000,0,0,0,0,100,100,26,0,1,2,0,5,0,0,0,1`,
  `Style: Sub,${FONT},46,&H00FFFFFF,&H00FFFFFF,&H64000000,&H78000000,0,0,0,0,100,100,16,0,1,1.6,0,5,0,0,0,1`,
  `Style: Note,${FONT},60,&H00B8F4FF,&H00B8F4FF,&H5A000000,&H78000000,0,0,0,0,100,100,2,0,1,2,0,5,0,0,0,1`,
  `Style: UI,Arial,44,&H00FFFFFF,&H00FFFFFF,&H5A000000,&H78000000,1,0,0,0,100,100,2,0,1,1.6,0,5,0,0,0,1`,
];

function stamp(t) {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60, c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

const clean = (s) => String(s).replace(/[{}\\\r\n]/g, ' ');

// lines: [{ t0, t1, text }] sung captions; texts: [{ t0, t1, style, text, pos, move, fade, tags, layer }]
function build({ lines, texts, shift = 0 }) {
  const out = [
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...STYLES, '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const add = (layer, t0, t1, style, body) => {
    const a = t0 - shift, b = t1 - shift;
    if (b <= 0.02) return;
    out.push(`Dialogue: ${layer},${stamp(a)},${stamp(b)},${style},,0,0,0,,${body}`);
  };
  const sung = (lines || []).slice().sort((a, b) => a.t0 - b.t0);
  sung.forEach((l, i) => {
    const dur = Math.max(0.2, l.t1 - l.t0), sweep = Math.round(Math.max(0.2, dur - 0.35) * 100);
    const end = Math.min(l.t1 + 0.25, i + 1 < sung.length ? sung[i + 1].t0 - 0.14 : Infinity);
    add(5, l.t0 - 0.12, end, 'Lyric', `{\\fad(160,200)\\blur1.1\\k12\\kf${sweep}}${clean(l.text)}`);
  });
  for (const e of texts || []) {
    const fade = e.fade || [200, 200];
    let tags = `\\fad(${fade[0]},${fade[1]})\\blur${e.blur === undefined ? 1.2 : e.blur}`;
    // move: [x, y, from, to] glides the text there between those moments (ms after it appears)
    if (e.pos && e.move) tags += `\\an${e.an || 5}\\move(${Math.round(e.pos[0])},${Math.round(e.pos[1])},${Math.round(e.move[0])},${Math.round(e.move[1])},${Math.round(e.move[2])},${Math.round(e.move[3])})`;
    else if (e.pos) tags += `\\an${e.an || 5}\\pos(${Math.round(e.pos[0])},${Math.round(e.pos[1])})`;
    if (e.tags) tags += e.tags;
    add(e.layer || 3, e.t0, e.t1, e.style || 'Sub', `{${tags}}${clean(e.text)}`);
  }
  return out.join('\n') + '\n';
}

module.exports = { build, FONT };
