// Builds the student presentation 北京大兴国际机场 (one airport, 18 slides).
// PptxGenJS lays out the slides; lib/fx.js then adds gradients, transitions and animations.
//
// Every figure on the slides is listed with its source on the "参考资料" slide.

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const JSZip = require('jszip');
const sharp = require('sharp');
const { gradient, decorateSlide, BULLET_CODE } = require('./lib/fx');

const ROOT = __dirname;
const PHOTOS = path.join(ROOT, 'photos');
const IMG = path.join(ROOT, 'img-pkx');
const OUT = path.join(ROOT, 'out');
const OUT_FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(OUT, '北京大兴国际机场-期末汇报.pptx');

const W = 13.333;
const H = 7.5;
const PX = 144;
const MX = 0.7;
const TOTAL = 18;
const TOC_PAGE = 2;

const C = {
  bg: '0A0F1A',
  deep: '05080F',
  panel: '121B2E',
  panel2: '18233A',
  line: '27344E',
  white: 'FFFFFF',
  text: 'D5DBE6',
  sub: 'A9B4C7',
  muted: '6F7C93',
  gold: 'E3B25B',
  amber: 'F0913A',
  bar: '34435F',
};
const FONT = { cn: 'Microsoft YaHei', light: 'Microsoft YaHei Light', num: 'Bahnschrift' };

const photoInfo = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'photos-pkx.json'), 'utf8')).map((p) => [p.key, p])
);
const usedPhotos = [];

// ---------- pictures --------------------------------------------------------------------

/** Crops a source photo to w x h inches around a focus point (fx, fy in 0..1). */
async function crop(key, wIn, hIn, { fx = 0.5, fy = 0.5, tone = null } = {}) {
  if (!usedPhotos.includes(key)) usedPhotos.push(key);
  const outW = Math.round(wIn * PX);
  const outH = Math.round(hIn * PX);
  const src = path.join(PHOTOS, key + '.jpg');
  const meta = await sharp(src).metadata();
  const k = Math.max(outW / meta.width, outH / meta.height);
  const cw = Math.min(meta.width, Math.round(outW / k));
  const ch = Math.min(meta.height, Math.round(outH / k));
  const left = Math.round((meta.width - cw) * fx);
  const top = Math.round((meta.height - ch) * fy);
  const file = path.join(IMG, `${key}_${outW}x${outH}.jpg`);
  let img = sharp(src).extract({ left, top, width: cw, height: ch }).resize(outW, outH, { kernel: 'lanczos3' });
  // Hazy aerial shots get a little more contrast; nothing in the picture is added or removed.
  if (tone) img = img.linear(tone.contrast, -(128 * (tone.contrast - 1)) + (tone.offset || 0)).modulate({ saturation: tone.saturation || 1 });
  await img
    .sharpen({ sigma: 0.5 })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(file);
  return file;
}

/** A small top-view airliner, drawn here so no outside artwork is needed. Points right. */
async function planeIcon() {
  const file = path.join(IMG, 'plane.png');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200">
    <g fill="#F2C778">
      <path d="M22 100c0-5 8-8 18-8h112c18 0 34 4 40 8-6 4-22 8-40 8H40c-10 0-18-3-18-8z"/>
      <path d="M96 93 66 26h15l47 67zM96 107 66 174h15l47-67z"/>
      <path d="M40 93 28 64h11l22 29zM40 107 28 136h11l22-29z"/>
      <rect x="84" y="52" width="20" height="8" rx="4"/>
      <rect x="84" y="140" width="20" height="8" rx="4"/>
    </g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
  return file;
}

// ---------- slide helpers ---------------------------------------------------------------

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'WIDE', width: W, height: H });
pptx.layout = 'WIDE';
pptx.title = '北京大兴国际机场';
pptx.subject = '期末大作业汇报：中国大型机场介绍';
pptx.author = '';
pptx.company = '';

const specs = [];
const run = (text, options = {}) => ({ text, options });
const numRun = (text, options = {}) => run(text, { fontFace: FONT.num, ...options });
const pad2 = (n) => String(n).padStart(2, '0');
const CJK = /[\u2e80-\u9fff\uff00-\uffef]/;

/** Splits a string so digits and Latin letters use the numeral face and Chinese uses YaHei. */
function mixed(text, options = {}, cjkOptions = {}) {
  const parts = text.match(/[\u2e80-\u9fff\uff00-\uffef]+|[^\u2e80-\u9fff\uff00-\uffef]+/g) || [];
  return parts.map((part) => (CJK.test(part) ? run(part, { ...options, fontFace: FONT.cn, ...cjkOptions }) : numRun(part, options)));
}

function newSlide(transition) {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  const spec = { transition, effects: [], bulletColor: C.gold };
  specs.push(spec);
  let counter = 0;
  const auto = (prefix) => `${prefix} ${++counter}`;
  const api = {
    shape(type, x, y, w, h, fill, o = {}) {
      const name = o.name || auto('Shape');
      const { name: _n, ...rest } = o;
      slide.addShape(type, {
        x, y, w, h,
        fill: typeof fill === 'string' ? { color: fill } : fill,
        ...rest,
        objectName: name,
      });
      return name;
    },
    rect(x, y, w, h, fill, o = {}) {
      return api.shape('rect', x, y, w, h, fill, o);
    },
    dot(cx, cy, d, fill, o = {}) {
      return api.shape('ellipse', cx - d / 2, cy - d / 2, d, d, fill, o);
    },
    text(content, x, y, w, h, o = {}) {
      const { name: given, ...options } = o;
      const name = given || auto('Text');
      slide.addText(content, {
        x, y, w, h,
        margin: 0,
        fontFace: FONT.cn,
        fontSize: 12,
        color: C.text,
        valign: 'top',
        lang: 'zh-CN',
        ...options,
        objectName: name,
      });
      return name;
    },
    image(file, x, y, w, h, name, alt, o = {}) {
      slide.addImage({ path: file, x, y, w, h, objectName: name, altText: alt, ...o });
      return name;
    },
    chart(type, data, options, name) {
      slide.addChart(type, data, { ...options, objectName: name });
      return name;
    },
    /** Invisible click target that jumps to another slide. */
    link(x, y, w, h, page, tooltip, name) {
      return api.rect(x, y, w, h, { color: 'FFFFFF', transparency: 100 }, { name, hyperlink: { slide: page, tooltip } });
    },
    anim(target, type, delay = 0, dur = 600, extra = {}) {
      spec.effects.push({ target, type, delay, dur, ...extra });
    },
    notes(text) {
      slide.addNotes(text);
    },
  };
  return api;
}

function footer(s, page, { x = MX, w = W - 2 * MX, note = '' } = {}) {
  s.rect(x, 6.98, w, 0.012, C.line, { name: 'Footer line' });
  s.text('北京大兴国际机场  ·  期末大作业汇报', x, 7.09, 3.3, 0.22, { fontSize: 9, color: C.muted, name: 'Footer title' });
  if (note) {
    s.text(note, x + 3.3, 7.09, w - 3.3 - 2.3, 0.22, { fontSize: 9, color: C.muted, align: 'center', name: 'Footer note' });
  }
  s.text('返回目录', x + w - 2.25, 7.09, 0.9, 0.22, {
    fontSize: 9, color: C.gold, align: 'right', name: 'Footer contents link',
    hyperlink: { slide: TOC_PAGE, tooltip: '返回目录' },
  });
  s.text(`${pad2(page)} / ${TOTAL}`, x + w - 1.2, 7.09, 1.2, 0.22, {
    fontSize: 9, color: C.muted, align: 'right', fontFace: FONT.num, name: 'Footer page',
  });
}

function heading(s, part, title, { x = MX, w = W - 2 * MX } = {}) {
  s.rect(x, 0.665, 0.36, 0.04, C.gold, { name: 'Kicker bar' });
  s.text(part, x + 0.5, 0.55, Math.min(7, w - 0.5), 0.28, { fontSize: 10.5, color: C.gold, charSpacing: 3, name: 'Kicker' });
  s.text(title, x, 0.95, w, 0.7, { fontSize: 28, bold: true, color: C.white, name: 'Title' });
  s.anim('Kicker bar', 'wipe', 0, 450);
  s.anim('Kicker', 'fade', 100, 450);
  s.anim('Title', 'rise', 150, 700);
}

function credit(s, keys, x, y, w, o = {}) {
  const people = [];
  for (const key of [].concat(keys)) {
    const p = photoInfo[key];
    const label = `${p.artist}（${p.license}）`;
    if (!people.includes(label)) people.push(label);
  }
  return s.text('图：' + people.join('、'), x, y, w, 0.2, { fontSize: 8, color: C.muted, name: o.name || 'Photo credit', align: o.align || 'left', ...(o.color ? { color: o.color } : {}) });
}

/** Darkens the bottom edge of a full-height photo so the credit line stays readable. */
function photoShade(s, x, w, name = 'Photo credit shade') {
  return s.rect(x, H - 1.2, w, 1.2, gradient(90, [
    { pos: 0, color: C.deep, alpha: 0 },
    { pos: 55, color: C.deep, alpha: 70 },
    { pos: 100, color: C.deep, alpha: 90 },
  ]), { name });
}

/** Bulleted list in one flowing text box; each paragraph floats in on its own. */
function bullets(s, name, items, x, y, w, h, { fontSize = 14, spaceAfter = 9, start = 900, step = 260 } = {}) {
  s.text(
    items.map((item) => run(item, { bullet: { characterCode: BULLET_CODE, indent: 16 }, paraSpaceAfter: spaceAfter, breakLine: true })),
    x, y, w, h,
    { fontSize, color: C.text, lineSpacingMultiple: 1.12, name }
  );
  items.forEach((_, i) => s.anim(name, 'rise', start + i * step, 550, { para: i, offset: 0.03 }));
}

/** Big figure + unit, with a label underneath. */
function stat(s, name, value, unit, label, x, y, w, { size = 34, delay = 0 } = {}) {
  s.text(
    [
      ...mixed(value, { fontSize: size, color: C.gold, bold: true }, { fontSize: Math.round(size * 0.48), color: C.text, bold: false }),
      ...(unit ? [run(' ' + unit, { fontSize: 13, color: C.text })] : []),
    ],
    x, y, w, 0.62, { name: name + ' value', valign: 'bottom' }
  );
  s.text(label, x, y + 0.68, w, 0.3, { fontSize: 11.5, color: C.sub, name: name + ' label' });
  s.anim(name + ' value', 'rise', delay, 600);
  s.anim(name + ' label', 'fade', delay + 150, 500);
}

// ---------- slides ----------------------------------------------------------------------

async function slideCover() {
  const s = newSlide('fade');
  s.image(await crop('pkx_cover', W, H, { fx: 0.5, fy: 0.5 }), 0, 0, W, H, 'Cover photo', photoInfo.pkx_cover.what);
  s.rect(0, 0, W, H, gradient(0, [
    { pos: 0, color: C.deep, alpha: 97 },
    { pos: 44, color: C.deep, alpha: 82 },
    { pos: 100, color: C.deep, alpha: 6 },
  ]), { name: 'Cover shade' });
  s.rect(0, 4.9, W, 2.6, gradient(90, [
    { pos: 0, color: C.deep, alpha: 0 },
    { pos: 100, color: C.deep, alpha: 78 },
  ]), { name: 'Cover shade bottom' });

  s.rect(MX, 1.02, 0.36, 0.04, C.gold, { name: 'Tag bar' });
  s.text('期末大作业汇报  ·  中国大型机场介绍', MX + 0.5, 0.9, 7, 0.3, { fontSize: 12, color: C.gold, charSpacing: 4, name: 'Tag' });
  s.text('北京大兴国际机场', MX, 1.5, 8.6, 1.05, { fontSize: 54, bold: true, color: C.white, name: 'Cover title' });
  s.text('BEIJING DAXING INTERNATIONAL AIRPORT', MX + 0.03, 2.68, 9, 0.35, {
    fontSize: 14, color: C.gold, fontFace: FONT.num, charSpacing: 6, name: 'Cover title en',
  });
  s.text('凤凰展翅  ·  新国门', MX, 3.25, 8, 0.5, { fontSize: 22, color: C.text, fontFace: FONT.light, name: 'Cover subtitle' });
  s.rect(MX, 4.18, 6.2, 0.012, '5B6880', { name: 'Info rule' });

  // Blank fields for the presenter to fill in: type straight after the colon.
  const fields = [
    ['汇报人：', MX, 4.5, 2.95],
    ['制作人：', MX + 3.25, 4.5, 2.95],
    ['小组成员：', MX, 5.1, 6.2],
    ['年级：', MX, 5.7, 1.9],
    ['系部：', MX + 2.15, 5.7, 1.9],
    ['专业：', MX + 4.3, 5.7, 1.9],
  ];
  fields.forEach(([label, x, y, w], i) => {
    const labelW = 0.2 * [...label].length + 0.02;
    s.text(label, x, y, w, 0.34, { fontSize: 14, color: C.text, name: `Field ${label.replace('：', '')}` });
    s.rect(x + labelW, y + 0.34, w - labelW, 0.012, '5B6880', { name: `Field line ${i + 1}` });
    s.anim(`Field ${label.replace('：', '')}`, 'fade', 2100 + i * 130, 450);
    s.anim(`Field line ${i + 1}`, 'wipe', 2150 + i * 130, 450);
  });
  credit(s, 'pkx_cover', W - MX - 4.6, 7.12, 4.6, { align: 'right', color: 'B9C2D1' });

  // A plane takes off across the photo: entrance, motion path and exit in one go.
  const from = [7.4, 6.5], to = [12.6, 1.6];
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const length = Math.hypot(dx, dy);
  s.rect((from[0] + to[0]) / 2 - length / 2, (from[1] + to[1]) / 2 - 0.011, length, 0.022, gradient(0, [
    { pos: 0, color: C.white, alpha: 0 },
    { pos: 100, color: C.white, alpha: 75 },
  ]), { name: 'Contrail', rotate: (angle + 360) % 360 });
  s.image(await planeIcon(), from[0] - 0.32, from[1] - 0.32, 0.64, 0.64, 'Plane', '飞机图标', { rotate: (angle + 360) % 360 });

  s.anim('Cover photo', 'grow', 0, 14000, { by: 1.06 });
  s.anim('Tag bar', 'wipe', 300, 450);
  s.anim('Tag', 'fade', 400, 500);
  s.anim('Cover title', 'rise', 600, 800);
  s.anim('Cover title en', 'wipe', 1100, 900);
  s.anim('Cover subtitle', 'fade', 1500, 700);
  s.anim('Info rule', 'wipe', 1900, 600);
  s.anim('Plane', 'fade', 3000, 400);
  s.anim('Plane', 'path', 3200, 4200, { path: `M 0 0 L ${(dx / W).toFixed(4)} ${(dy / H).toFixed(4)} E`, ease: false });
  s.anim('Contrail', 'wipe', 3200, 4200);
  s.anim('Plane', 'fadeOut', 7300, 500);
  s.anim('Contrail', 'fadeOut', 7700, 900);
  s.notes('各位老师、同学好，我们小组汇报的题目是《北京大兴国际机场》。它是北京的第二座大型国际机场，因为航站楼从空中看像一只展翅的凤凰，被称为“凤凰展翅”，也被叫作“新国门”。');
}

const CONTENTS = [
  ['01', '机场概况', '定位 · 区位 · 基本信息', 3],
  ['02', '建设历程', '从立项到通航', 5],
  ['03', '建筑设计', '五指廊 · C 型柱 · 采光', 6],
  ['04', '运行与数据', '跑道 · 客流 · 航线网络', 10],
  ['05', '综合交通', '五纵两横 · 空铁联运', 13],
  ['06', '绿色智慧与展望', '绿色机场 · 智慧出行 · 未来', 14],
];

async function slideContents() {
  const s = newSlide('curtains');
  const pw = 4.7;
  s.image(await crop('pkx_column3', pw, H, { fx: 0.42, fy: 0.5 }), W - pw, 0, pw, H, 'Contents photo', photoInfo.pkx_column3.what);
  s.rect(W - pw, 0, 2.6, H, gradient(0, [
    { pos: 0, color: C.bg, alpha: 100 },
    { pos: 100, color: C.bg, alpha: 0 },
  ]), { name: 'Contents shade' });
  s.rect(MX, 0.915, 0.36, 0.04, C.gold, { name: 'Kicker bar' });
  s.text('CONTENTS', MX + 0.5, 0.8, 4, 0.28, { fontSize: 10.5, color: C.gold, charSpacing: 5, fontFace: FONT.num, name: 'Kicker' });
  s.text('目录', MX, 1.15, 5, 0.8, { fontSize: 36, bold: true, color: C.white, name: 'Title' });
  s.anim('Contents photo', 'grow', 0, 12000, { by: 1.05 });
  s.anim('Kicker bar', 'wipe', 200, 450);
  s.anim('Kicker', 'fade', 300, 450);
  s.anim('Title', 'rise', 350, 700);

  const cols = [MX, MX + 3.95];
  const rows = [2.5, 3.9, 5.3];
  CONTENTS.forEach(([no, title, desc, page], i) => {
    const x = cols[i % 2], y = rows[Math.floor(i / 2)];
    const delay = 800 + i * 220;
    s.text(no, x, y, 0.95, 0.62, { fontSize: 34, color: C.gold, fontFace: FONT.num, bold: true, name: `Item ${no} number` });
    s.text(title, x + 1.0, y + 0.03, 2.6, 0.4, { fontSize: 19, bold: true, color: C.white, name: `Item ${no} title` });
    s.text(desc, x + 1.0, y + 0.52, 2.6, 0.3, { fontSize: 11.5, color: C.sub, name: `Item ${no} text` });
    s.rect(x, y + 1.02, 3.5, 0.012, C.line, { name: `Item ${no} rule` });
    s.link(x, y - 0.08, 3.5, 1.08, page, `跳转到：${title}`, `Item ${no} link`);
    s.anim(`Item ${no} number`, 'zoom', delay, 500);
    s.anim(`Item ${no} title`, 'rise', delay + 80, 550);
    s.anim(`Item ${no} text`, 'fade', delay + 200, 500);
    s.anim(`Item ${no} rule`, 'wipe', delay + 200, 500);
  });
  s.text('放映时点击任一条目，可直接跳转到对应章节', MX, 6.72, 7, 0.24, { fontSize: 10, color: C.muted, name: 'Hint' });
  s.anim('Hint', 'fade', 2400, 600);
  photoShade(s, W - pw, pw);
  credit(s, 'pkx_column3', W - MX - 3.6, 7.12, 3.6, { align: 'right', color: 'C9D1DE' });
  s.notes('汇报分为六个部分：先介绍机场的基本情况，再回顾建设历程，然后重点讲建筑设计，接着看运行数据和综合交通，最后是绿色智慧机场和未来展望。');
}

async function slideOverview() {
  const s = newSlide('push');
  const pw = 5.6;
  const tw = W - pw - MX - 0.55;
  s.image(await crop('pkx_apron', pw, H, { fx: 0.35, fy: 0.5 }), W - pw, 0, pw, H, 'Overview photo', photoInfo.pkx_apron.what);
  s.rect(W - pw, 0, 1.6, H, gradient(0, [
    { pos: 0, color: C.bg, alpha: 100 },
    { pos: 100, color: C.bg, alpha: 0 },
  ]), { name: 'Photo shade' });
  heading(s, '01  机场概况', '认识北京大兴国际机场', { w: tw });
  s.text(
    '北京大兴国际机场位于北京市大兴区与河北省廊坊市广阳区之间，2019 年 9 月 25 日正式投运，定位为大型国际枢纽机场，与首都机场共同构成北京“一市两场”的格局。',
    MX, 1.85, tw, 1.0, { fontSize: 13.5, color: C.text, lineSpacingMultiple: 1.25, name: 'Intro' }
  );
  s.anim('Overview photo', 'grow', 0, 12000, { by: 1.05 });
  s.anim('Intro', 'fade', 600, 700);

  const facts = [
    ['机场代码', 'PKX  ·  ZBAD', 'IATA / ICAO'],
    ['飞行区等级', '4F', '可起降各类大型客机'],
    ['航站楼', '70 万㎡', '航站楼综合体 143 万㎡'],
    ['跑道', '4 条', '“三纵一横”全向构型'],
    ['2025 年旅客吞吐量', '5361.9 万人次', '全国第 6 位'],
    ['2025 年飞机起降', '34.6 万架次', '全国第 6 位'],
    ['运营管理', '首都机场集团', '机场的运营单位'],
    ['机场工程投资', '799.8 亿元', '国家发展改革委 2014 年批复'],
  ];
  const cw = (tw - 0.3) / 2;
  facts.forEach(([label, value, note], i) => {
    const x = MX + (i % 2) * (cw + 0.3), y = 3.08 + Math.floor(i / 2) * 0.93;
    const n = `Fact ${i + 1}`;
    s.rect(x, y, 0.03, 0.72, C.gold, { name: n + ' mark' });
    s.text(label, x + 0.16, y - 0.02, cw - 0.16, 0.22, { fontSize: 10, color: C.muted, name: n + ' label' });
    s.text(mixed(value, { fontSize: 16, bold: true, color: C.white }), x + 0.16, y + 0.2, cw - 0.16, 0.34, { name: n + ' value' });
    s.text(note, x + 0.16, y + 0.54, cw - 0.16, 0.22, { fontSize: 9.5, color: C.sub, name: n + ' note' });
    const d = 900 + i * 140;
    s.anim(n + ' mark', 'wipe', d, 350, { dir: 'up' });
    s.anim(n + ' label', 'fade', d + 60, 400);
    s.anim(n + ' value', 'slide', d + 100, 500, { offset: -0.02 });
    s.anim(n + ' note', 'fade', d + 220, 400);
  });
  footer(s, 3, { w: tw });
  photoShade(s, W - pw, pw);
  credit(s, 'pkx_apron', W - MX - 3.6, 7.12, 3.6, { align: 'right', color: 'C9D1DE' });
  s.notes('大兴机场位于北京大兴区和河北廊坊之间，2019 年 9 月 25 日投运。它的飞行区等级是最高的 4F，一期建成 4 条跑道和 70 万平方米的航站楼。2025 年旅客吞吐量约 5362 万人次，排在全国第 6 位。');
}

async function slideLocation() {
  const s = newSlide('wipe');
  heading(s, '01  机场概况', '区位与定位：京津冀腹地的新枢纽');
  s.text('到大兴机场的直线距离（公里）', MX, 2.02, 6, 0.28, { fontSize: 12, color: C.sub, name: 'Chart caption' });
  s.anim('Chart caption', 'fade', 600, 500);
  const places = [
    ['廊坊市中心', 26],
    ['天安门广场', 46],
    ['北京城市副中心', 54],
    ['雄安新区', 55],
    ['天津市中心', 82],
  ];
  const farthest = 82;
  places.forEach(([name, km], i) => {
    const y = 2.55 + i * 0.78;
    const len = (km / farthest) * 3.5;
    const n = `Distance ${i + 1}`;
    s.text(name, MX, y + 0.02, 1.9, 0.3, { fontSize: 13, color: C.text, name: n + ' name' });
    s.rect(MX + 2.0, y + 0.07, 3.5, 0.2, C.panel, { name: n + ' track' });
    s.rect(MX + 2.0, y + 0.07, len, 0.2, gradient(0, [{ pos: 0, color: 'B8894A' }, { pos: 100, color: C.gold }]), { name: n + ' bar' });
    s.text([numRun(String(km), { fontSize: 18, bold: true, color: C.white }), run(' km', { fontSize: 10, color: C.sub, fontFace: FONT.num })],
      MX + 2.0 + len + 0.12, y - 0.07, 1.2, 0.4, { name: n + ' value', valign: 'middle' });
    const d = 800 + i * 220;
    s.anim(n + ' name', 'fade', d, 400);
    s.anim(n + ' track', 'fade', d, 400);
    s.anim(n + ' bar', 'wipe', d + 100, 800);
    s.anim(n + ' value', 'zoom', d + 700, 450);
  });
  s.text('机场位于京津冀腹地，综合交通体系可实现一小时通达京津冀主要城市。', MX, 6.42, 6.3, 0.3, { fontSize: 11.5, color: C.sub, name: 'Chart note' });
  s.anim('Chart note', 'fade', 2600, 600);

  const cards = [
    ['大型国际枢纽机场', '与首都机场共同构成北京“一市两场”，缓解首都机场长期饱和运行的压力。'],
    ['国家发展一个新的动力源', '2017 年 2 月，习近平总书记考察建设工地时指出：新机场是首都的重大标志性工程，是国家发展一个新的动力源。'],
    ['京津冀协同发展的关键基础设施', '机场地跨北京、河北两地，带动区域综合交通和产业布局优化。'],
  ];
  const cx = 7.35, cwid = W - MX - cx;
  cards.forEach(([title, text], i) => {
    const y = 2.02 + i * 1.6;
    const n = `Card ${i + 1}`;
    s.rect(cx, y, cwid, 1.4, C.panel, { name: n + ' panel' });
    s.rect(cx, y, 0.05, 1.4, C.gold, { name: n + ' mark' });
    s.text(pad2(i + 1), cx + 0.3, y + 0.2, 0.7, 0.45, { fontSize: 22, color: C.gold, fontFace: FONT.num, bold: true, name: n + ' number' });
    s.text(title, cx + 1.0, y + 0.2, cwid - 1.2, 0.4, { fontSize: 17, bold: true, color: C.white, name: n + ' title' });
    s.text(text, cx + 1.0, y + 0.66, cwid - 1.25, 0.66, { fontSize: 11.5, color: C.sub, lineSpacingMultiple: 1.15, name: n + ' text' });
    const d = 1200 + i * 350;
    s.anim(n + ' panel', 'fly', d, 600, { dir: 'right' });
    s.anim(n + ' mark', 'wipe', d + 450, 350, { dir: 'up' });
    s.anim(n + ' number', 'zoom', d + 500, 450);
    s.anim(n + ' title', 'fade', d + 550, 450);
    s.anim(n + ' text', 'fade', d + 700, 500);
  });
  footer(s, 4, { note: '资料来源：民航局《北京大兴国际机场建设及运营工作总结》' });
  s.notes('从区位看，大兴机场到天安门的直线距离是 46 公里，到雄安新区 55 公里，到天津市中心 82 公里，正好处在京津冀的腹地。它的定位可以概括为三点：大型国际枢纽机场、国家发展一个新的动力源、京津冀协同发展的关键基础设施。');
}

async function slideTimeline() {
  const s = newSlide('conveyor');
  heading(s, '02  建设历程', '四年九个月，从蓝图到通航');
  const events = [
    ['2012.11', '立项报告经国务院\n常务会议讨论通过'],
    ['2014.12.26', '机场工程\n正式开工建设'],
    ['2017.12', '航站楼实现\n功能性封顶封围'],
    ['2018.09', '定名\n“北京大兴国际机场”'],
    ['2019.05.13', '四架大型客机\n完成首次真机试飞'],
    ['2019.06.30', '主体工程竣工'],
    ['2019.09.25', '正式投入运营'],
  ];
  const x0 = 1.55, step = (W - 2 * x0) / (events.length - 1), ly = 3.3;
  s.rect(MX, ly - 0.01, W - 2 * MX, 0.02, C.bar, { name: 'Timeline' });
  s.anim('Timeline', 'wipe', 500, 1400);
  events.forEach(([date, text], i) => {
    const cx = x0 + i * step;
    const up = i % 2 === 0;
    const last = i === events.length - 1;
    const n = `Event ${i + 1}`;
    s.dot(cx, ly, last ? 0.3 : 0.2, last ? C.amber : C.gold, { name: n + ' dot' });
    s.rect(cx - 0.006, up ? ly - 0.42 : ly + 0.1, 0.012, 0.32, C.bar, { name: n + ' stem' });
    s.text(date, cx - 1.1, up ? ly - 1.35 : ly + 0.5, 2.2, 0.3, { fontSize: 15, bold: true, color: last ? C.amber : C.gold, fontFace: FONT.num, align: 'center', name: n + ' date' });
    s.text(text, cx - 1.1, up ? ly - 1.02 : ly + 0.83, 2.2, 0.56, { fontSize: 11.5, color: C.text, align: 'center', lineSpacingMultiple: 1.15, name: n + ' text' });
    const d = 700 + i * 300;
    s.anim(n + ' dot', 'zoom', d, 400);
    s.anim(n + ' stem', 'wipe', d + 150, 300, { dir: up ? 'down' : 'up' });
    s.anim(n + ' date', 'fade', d + 250, 400);
    s.anim(n + ' text', 'rise', d + 350, 450, { offset: 0.02 });
  });
  s.anim('Event 7 dot', 'pulse', 3400, 500, { by: 1.5, repeat: 2 });

  s.image(await crop('pkx_atrium', 4.6, 1.75, { fx: 0.5, fy: 0.42 }), MX, 4.98, 4.6, 1.75, 'Timeline photo', photoInfo.pkx_atrium.what);
  s.text('2019 年 9 月 25 日，投运当天的航站楼中央大厅', MX, 6.76, 4.6, 0.2, { fontSize: 8.5, color: C.muted, name: 'Timeline caption' });
  s.anim('Timeline photo', 'split', 3000, 700);
  s.anim('Timeline caption', 'fade', 3500, 500);
  stat(s, 'Build time', '4 年 9 个月', '', '从开工到投运（2014.12 — 2019.9）', 5.75, 5.05, 3.4, { size: 30, delay: 3200 });
  stat(s, 'Opening', '2019.10.27', '', '国际航线开通', 9.4, 5.05, 3.2, { size: 30, delay: 3450 });
  s.text('一期工程一次建成 4 条跑道和 70 万㎡ 航站楼，按 2025 年旅客吞吐量 7200 万人次的目标设计。', 5.75, 6.2, 6.9, 0.5, { fontSize: 11.5, color: C.sub, name: 'Timeline note' });
  s.anim('Timeline note', 'fade', 3800, 600);
  footer(s, 5, { note: '图：N509FZ（CC BY-SA 4.0）  ·  资料来源：民航局《建设及运营工作总结》' });
  s.notes('建设历程可以概括为四年九个月。2012 年 11 月立项报告经国务院常务会议讨论通过，2014 年 12 月 26 日开工，2017 年底航站楼封顶封围，2018 年 9 月正式定名，2019 年 5 月 13 日南航、东航、国航、厦航的四架大型客机完成首次真机试飞，6 月 30 日主体工程竣工，9 月 25 日正式投运。');
}

async function slideDesign() {
  const s = newSlide('gallery');
  const pw = 6.0;
  const x = pw + 0.6, tw = W - MX - x;
  s.image(await crop('pkx_aerial', pw, H, { fx: 0.5, fy: 0.5, tone: { contrast: 1.1, saturation: 1.25, offset: -17 } }), 0, 0, pw, H, '!!hero', photoInfo.pkx_aerial.what);
  heading(s, '03  建筑设计', '凤凰展翅：中心放射的五指廊', { x, w: tw });
  stat(s, 'Walk', '600', '米', '中心到最远端登机口', x, 1.9, 2.0, { delay: 600 });
  stat(s, 'Time', '8', '分钟', '以内步行可达', x + 2.1, 1.9, 2.0, { delay: 800 });
  stat(s, 'Stands', '79', '个', '近机位', x + 4.2, 1.9, 2.0, { delay: 1000 });
  s.rect(x, 3.12, tw, 0.012, C.line, { name: 'Rule' });
  s.anim('Rule', 'wipe', 1100, 600);
  bullets(s, 'Design points', [
    '航站楼由中心向外伸出五条指廊，加上陆侧的一条服务楼指廊共六条，相邻夹角 60°',
    '放射构型的最大特点是指廊短：旅客安检后从中心到最远端登机口约 600 米',
    '航站楼机位展线长约 4000 米，布置了 79 个近机位',
    '方案以法国 ADPi 的设计为基础，由 ADPi 与扎哈·哈迪德事务所团队优化，北京市建筑设计研究院与中国民航机场建设集团完成图纸设计',
  ], x, 3.36, tw, 3.4, { fontSize: 13.5, start: 1300 });
  s.anim('!!hero', 'grow', 0, 12000, { by: 1.05 });
  footer(s, 6, { x, w: tw });
  photoShade(s, 0, pw);
  credit(s, 'pkx_aerial', 0.25, 7.12, 4, { color: 'E6EAF0' });
  s.notes('航站楼采用中心放射的五指廊构型，从空中看像一只凤凰。这样设计最大的好处是指廊短：旅客过完安检，从中心到最远的登机口大约 600 米，步行不到 8 分钟，同时布置了 79 个近机位。方案以法国 ADPi 的设计为基础，扎哈·哈迪德事务所团队参与优化，最后由国内设计院完成图纸设计。');
}

async function slideStructure() {
  const s = newSlide('morph');
  const pw = 6.0;
  const tw = W - pw - MX - 0.6;
  s.image(await crop('pkx_column', pw, H, { fx: 0.5, fy: 0.5 }), W - pw, 0, pw, H, '!!hero', photoInfo.pkx_column.what);
  heading(s, '03  建筑设计', 'C 型柱：结构与采光合二为一', { w: tw });
  stat(s, 'Columns', '8', '根', 'C 型柱', MX, 1.9, 1.9, { delay: 600 });
  stat(s, 'Span', '180', '米', '无柱空间直径', MX + 2.0, 1.9, 1.9, { delay: 800 });
  stat(s, 'Daylight', '60%', '以上', '室内自然光采光面积占比', MX + 4.0, 1.9, 2.2, { delay: 1000 });
  s.rect(MX, 3.12, tw, 0.012, C.line, { name: 'Rule' });
  s.anim('Rule', 'wipe', 1100, 600);
  bullets(s, 'Structure points', [
    '8 根 C 型柱既是屋顶钢结构的主要支撑构件，又是楼内采光的窗口',
    'C 型柱上宽下窄：底部最窄处只有 3 米，顶端最大跨度 23 米',
    '核心区屋盖钢结构投影面积 18 万㎡；中央六边形天窗加每条指廊一条带状天窗，旅客可以顺着光线找方向',
    '双层出发、双层到达：一、二层是到达层，三、四层是出发层',
  ], MX, 3.36, tw, 3.4, { fontSize: 13.5, start: 1300 });
  s.anim('!!hero', 'grow', 0, 12000, { by: 1.05 });
  footer(s, 7, { w: tw });
  photoShade(s, W - pw, pw);
  credit(s, 'pkx_column', W - MX - 3.6, 7.12, 3.6, { align: 'right', color: 'E6EAF0' });
  s.notes('走进航站楼，最醒目的是 C 型柱。整个中央大厅只靠 8 根 C 型柱支撑，形成直径 180 米的无柱空间。C 型柱上宽下窄，顶部开口就是天窗，所以它既是结构又是采光口，室内自然光采光面积占比超过六成。');
}

async function slideGallery() {
  const s = newSlide('prism');
  heading(s, '03  建筑设计', '空间掠影：走进航站楼');
  const top = 1.92, gap = 0.1, total = 4.82;
  const bw = 4.9;
  const gx = MX + bw + gap;
  const gw = (W - MX - gx - gap) / 2;
  const gh = (total - gap) / 2;
  const tiles = [
    ['pkx_roof', MX, top, bw, total, '屋顶与中央天窗', 'split', { fx: 0.5, fy: 0.5 }],
    ['pkx_checkin', gx, top, gw, gh, '值机大厅', 'wipe', { fx: 0.5, fy: 0.6 }],
    ['pkx_walk', gx + gw + gap, top, gw, gh, '指廊：自动步道与带状天窗', 'circle', { fx: 0.5, fy: 0.5 }],
    ['pkx_gate', gx, top + gh + gap, gw, gh, '指廊候机区', 'strips', { fx: 0.5, fy: 0.6 }],
    ['pkx_garden', gx + gw + gap, top + gh + gap, gw, gh, '指廊尽端的“中国园”', 'box', { fx: 0.5, fy: 0.5 }],
  ];
  for (const [i, [key, x, y, w, h, caption, effect, focus]] of tiles.entries()) {
    const n = `Tile ${i + 1}`;
    s.image(await crop(key, w, h, focus), x, y, w, h, n, photoInfo[key].what);
    s.rect(x, y + h - 0.75, w, 0.75, gradient(90, [
      { pos: 0, color: C.deep, alpha: 0 },
      { pos: 55, color: C.deep, alpha: 72 },
      { pos: 100, color: C.deep, alpha: 92 },
    ]), { name: n + ' shade' });
    s.text(caption, x + 0.18, y + h - 0.36, w - 0.3, 0.26, { fontSize: 11.5, color: C.white, name: n + ' caption' });
    const d = 600 + i * 380;
    s.anim(n, effect, d, 800);
    s.anim(n + ' shade', 'fade', d + 500, 400);
    s.anim(n + ' caption', 'slide', d + 600, 450, { offset: -0.015 });
  }
  footer(s, 8, { note: '五条指廊尽端各有一座园林：丝园、茶园、瓷园、田园、中国园' });
  credit(s, ['pkx_roof', 'pkx_checkin', 'pkx_walk', 'pkx_gate', 'pkx_garden'], MX, 6.77, 9, {});
  s.notes('这一页是几张实景照片：屋顶的中央天窗、值机大厅、带状天窗下的指廊、候机区，以及指廊尽端的中国园。五条指廊的尽端各有一座中式园林，分别叫丝园、茶园、瓷园、田园和中国园。');
}

async function slideNumbers() {
  const s = newSlide('flythrough');
  heading(s, '03  建筑设计', '数字里的大兴机场');
  const cards = [
    ['70', '万㎡', '航站楼建筑面积', '地上五层、地下两层'],
    ['143', '万㎡', '航站楼综合体', '含换乘中心、综合服务楼、停车楼等'],
    ['4', '条', '跑道', '“三纵一横”全向构型'],
    ['343', '个', '各类机坪机位', '其中近机位 79 个'],
    ['8', '根', 'C 型柱', '撑起直径 180 米的无柱空间'],
    ['600', '米', '最远步行距离', '航站楼中心到最远端登机口'],
    ['7200', '万人次', '本期设计年旅客量', '设计目标年为 2025 年'],
    ['799.8', '亿元', '机场工程投资', '国家发展改革委 2014 年批复'],
  ];
  const gap = 0.2, cw = (W - 2 * MX - 3 * gap) / 4, ch = 2.25;
  cards.forEach(([value, unit, label, note], i) => {
    const x = MX + (i % 4) * (cw + gap), y = 1.98 + Math.floor(i / 4) * (ch + gap);
    const n = `Number ${i + 1}`;
    s.rect(x, y, cw, ch, C.panel, { name: n + ' panel' });
    s.rect(x, y, cw, 0.04, C.gold, { name: n + ' top' });
    s.text([numRun(value, { fontSize: 40, bold: true, color: C.gold }), run(' ' + unit, { fontSize: 13, color: C.text })],
      x + 0.25, y + 0.3, cw - 0.4, 0.8, { name: n + ' value', valign: 'bottom' });
    s.text(label, x + 0.25, y + 1.22, cw - 0.4, 0.34, { fontSize: 15, bold: true, color: C.white, name: n + ' label' });
    s.text(note, x + 0.25, y + 1.62, cw - 0.4, 0.45, { fontSize: 10.5, color: C.sub, lineSpacingMultiple: 1.15, name: n + ' note' });
    const d = 600 + i * 220;
    s.anim(n + ' panel', 'zoom', d, 500);
    s.anim(n + ' top', 'wipe', d + 300, 400);
    s.anim(n + ' value', 'rise', d + 250, 550, { offset: 0.03 });
    s.anim(n + ' label', 'fade', d + 400, 400);
    s.anim(n + ' note', 'fade', d + 500, 400);
    s.anim(n + ' value', 'pulse', 3200 + i * 120, 350, { by: 1.12 });
  });
  footer(s, 9, { note: '资料来源：民航局《北京大兴国际机场建设及运营工作总结》等' });
  s.notes('用几个数字来小结建筑部分：航站楼 70 万平方米，加上换乘中心、综合服务楼和停车楼的综合体共 143 万平方米；4 条跑道、343 个各类机位；8 根 C 型柱；最远步行 600 米；一期按年旅客量 7200 万人次的目标设计，机场工程投资 799.8 亿元。');
}

async function slideRunways() {
  const s = newSlide('airplane');
  heading(s, '04  运行与数据', '“三纵一横”：四条跑道的全向构型');
  const px = MX, py = 1.95, pw = 5.9, ph = 4.8;
  s.rect(px, py, pw, ph, C.panel, { name: 'Map panel' });
  s.anim('Map panel', 'fade', 500, 500);
  // Positions traced from the published aerodrome layout (north up); schematic only.
  const k = 0.0066;
  const ox = px + 0.28, oy = py + 0.62;
  const fx = (v) => ox + (v - 100) * k;
  const fy = (v) => oy + (v - 80) * k;
  const runways = [
    ['西二跑道', '17R/35L', [205, 128], [248, 475], [-0.82, 0.25]],
    ['西一跑道', '17L/35R', [275, 118], [318, 468], [0.26, 0.5]],
    ['东跑道', '01L/19R', [522, 285], [563, 607], [0.26, 0.2]],
    ['北跑道', '11L/29R', [562, 128], [905, 208], [-0.2, -0.62]],
  ];
  // Terminal: three bars through one centre make the six-arm star.
  const tx = fx(398), ty = fy(205);
  [90, 30, 150].forEach((angle, i) => {
    s.rect(tx - 0.36, ty - 0.055, 0.72, 0.11, C.gold, { name: `Terminal arm ${i + 1}`, rotate: angle });
    s.anim(`Terminal arm ${i + 1}`, 'zoom', 800 + i * 120, 450);
  });
  s.text('航站楼', tx - 0.5, ty + 0.42, 1.0, 0.22, { fontSize: 9.5, color: C.gold, align: 'center', name: 'Terminal label' });
  s.anim('Terminal label', 'fade', 1200, 400);
  runways.forEach(([name, code, a, b, off], i) => {
    const x1 = fx(a[0]), y1 = fy(a[1]), x2 = fx(b[0]), y2 = fy(b[1]);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const n = `Runway ${i + 1}`;
    // Steep runways are drawn as upright bars so the wipe runs along their length.
    if (Math.abs(Math.abs(angle) - 90) < 45) s.rect(cx - 0.045, cy - len / 2, 0.09, len, 'C9D1DE', { name: n, rotate: (angle - 90 + 360) % 360 });
    else s.rect(cx - len / 2, cy - 0.045, len, 0.09, 'C9D1DE', { name: n, rotate: (angle + 360) % 360 });
    s.text([run(name, { fontSize: 10, color: C.white, bold: true, breakLine: true }), numRun(code, { fontSize: 9.5, color: C.sub })],
      cx + off[0] - (off[0] < 0 ? 0.45 : 0), cy + off[1], 1.05, 0.42, { name: n + ' label', align: off[0] < 0 ? 'right' : 'left' });
    const d = 1300 + i * 350;
    s.anim(n, 'wipe', d, 700, { dir: i === 3 ? 'left' : 'up' });
    s.anim(n + ' label', 'fade', d + 500, 400);
  });
  s.text('北 ↑', px + pw - 0.85, py + 0.15, 0.65, 0.25, { fontSize: 10, color: C.sub, align: 'right', name: 'North' });
  s.text('示意图，非按比例', px + 0.2, py + ph - 0.33, 2.2, 0.22, { fontSize: 9, color: C.muted, name: 'Map note' });
  // A small radar sweep, purely decorative.
  s.dot(px + pw - 0.62, py + ph - 0.62, 0.7, { color: C.bg, transparency: 30 }, { name: 'Radar dial', line: { color: C.bar, width: 0.75 } });
  s.shape('pie', px + pw - 0.97, py + ph - 0.97, 0.7, 0.7, { color: C.gold, transparency: 35 }, { name: 'Radar sweep', angleRange: [0, 55] });
  s.anim('North', 'fade', 900, 400);
  s.anim('Map note', 'fade', 900, 400);
  s.anim('Radar dial', 'fade', 900, 400);
  s.anim('Radar sweep', 'fade', 900, 400);
  s.anim('Radar sweep', 'spin', 1300, 3000, { repeat: 'forever' });

  const tx0 = px + pw + 0.5, tw = W - MX - tx0;
  const colX = [0, 1.35, 2.75, 4.35];
  const head = ['跑道', '编号', '长 × 宽', '方向'];
  const rows = [
    ['西一跑道', '17L/35R', '3800 × 60 m', '纵向'],
    ['西二跑道', '17R/35L', '3800 × 45 m', '纵向'],
    ['东跑道', '01L/19R', '3400 × 60 m', '纵向'],
    ['北跑道', '11L/29R', '3800 × 60 m', '横向（侧向）'],
  ];
  head.forEach((t, c) => s.text(t, tx0 + colX[c], 2.0, 1.6, 0.26, { fontSize: 10.5, color: C.gold, name: `Table head ${c + 1}` }));
  s.rect(tx0, 2.32, tw, 0.014, C.gold, { name: 'Table head rule' });
  s.anim('Table head rule', 'wipe', 1000, 600);
  head.forEach((_, c) => s.anim(`Table head ${c + 1}`, 'fade', 1000 + c * 80, 400));
  rows.forEach((row, r) => {
    const y = 2.44 + r * 0.5;
    row.forEach((t, c) => {
      const n = `Table r${r + 1}c${c + 1}`;
      s.text(t, tx0 + colX[c], y, c === 3 ? 1.5 : 1.55, 0.3, {
        fontSize: 13, color: c === 0 ? C.white : C.text, bold: c === 0, fontFace: c === 1 || c === 2 ? FONT.num : FONT.cn, name: n,
      });
      s.anim(n, 'fade', 1500 + r * 350 + c * 60, 400);
    });
    s.rect(tx0, y + 0.4, tw, 0.01, C.line, { name: `Table rule ${r + 1}` });
    s.anim(`Table rule ${r + 1}`, 'wipe', 1500 + r * 350, 500);
  });
  bullets(s, 'Runway points', [
    '带侧向跑道的“全向型”构型在国内首次采用：三条纵向跑道加一条侧向的北跑道',
    '侧向跑道可减少飞机在终端区的空中运行距离，有利于保护环境、降低航空公司运行成本',
    '飞行区等级 4F；各类机坪机位 343 个，其中近机位 79 个',
  ], tx0, 4.72, tw, 2.1, { fontSize: 12.5, start: 3000, spaceAfter: 7 });
  footer(s, 10, { note: '资料来源：民航局《建设及运营工作总结》、维基百科（跑道宽度）；布局据公开机场平面图绘制' });
  s.notes('飞行区一期建了 4 条跑道，呈“三纵一横”布局：西一、西二和东跑道是纵向的，北跑道是侧向的。这种带侧向跑道的全向构型在国内是第一次采用，可以减少飞机在终端区的空中运行距离，有利于保护环境，也能降低航空公司的运行成本。');
}

async function slideTraffic() {
  const s = newSlide('cover');
  heading(s, '04  运行与数据', '客流增长：六年从 313 万到 5362 万人次');
  s.text('年旅客吞吐量（万人次）', MX, 1.98, 5, 0.26, { fontSize: 12, color: C.sub, name: 'Chart caption' });
  s.anim('Chart caption', 'fade', 500, 500);
  s.chart(pptx.charts.BAR, [{
    name: '旅客吞吐量（万人次）',
    labels: ['2019', '2020', '2021', '2022', '2023', '2024', '2025'],
    values: [313.5, 1609.1, 2505.1, 1027.8, 3941.1, 4944.1, 5361.9],
  }], {
    x: MX - 0.1, y: 2.25, w: 7.6, h: 4.25,
    barDir: 'col',
    chartColors: [C.gold],
    barGapWidthPct: 60,
    catAxisLabelColor: C.sub, catAxisLabelFontFace: FONT.num, catAxisLabelFontSize: 12,
    catAxisLineShow: true, catAxisLineColor: C.bar,
    valAxisHidden: true, valAxisLineShow: false,
    valGridLine: { style: 'none' },
    catGridLine: { style: 'none' },
    showValue: true, dataLabelColor: C.white, dataLabelFontFace: FONT.num, dataLabelFontSize: 12,
    dataLabelFormatCode: '0.0', dataLabelPosition: 'outEnd',
    showLegend: false, showTitle: false,
    altText: '北京大兴国际机场 2019—2025 年旅客吞吐量柱状图',
  }, 'Traffic chart');
  s.anim('Traffic chart', 'wipe', 800, 1600, { dir: 'down' });
  s.text('2019 年为 9 月 25 日投运后的数据；2020—2022 年受新冠疫情影响。', MX, 6.55, 7.4, 0.24, { fontSize: 10, color: C.muted, name: 'Chart note' });
  s.anim('Chart note', 'fade', 2600, 500);

  const x = 8.75, w = W - MX - x;
  s.text('2025 年', x, 1.98, w, 0.28, { fontSize: 12, color: C.gold, charSpacing: 3, name: 'Year tag' });
  s.anim('Year tag', 'fade', 1500, 400);
  const rowsData = [
    ['5361.9', '万人次', '旅客吞吐量  ·  全国第 6  ·  同比 +8.5%'],
    ['34.6', '万架次', '飞机起降  ·  全国第 6  ·  同比 +6.3%'],
    ['36.9', '万吨', '货邮吞吐量  ·  全国第 15  ·  同比 +13.2%'],
    ['589.05', '万人次', '国际及地区旅客  ·  同比 +24.56%'],
  ];
  rowsData.forEach(([value, unit, label], i) => {
    const y = 2.4 + i * 1.06;
    const n = `Highlight ${i + 1}`;
    s.text([numRun(value, { fontSize: 28, bold: true, color: i === 0 ? C.gold : C.white }), run(' ' + unit, { fontSize: 12, color: C.text })],
      x, y, w, 0.5, { name: n + ' value', valign: 'bottom' });
    s.text(label, x, y + 0.55, w, 0.26, { fontSize: 11, color: C.sub, name: n + ' label' });
    s.rect(x, y + 0.92, w, 0.01, C.line, { name: n + ' rule' });
    const d = 1700 + i * 280;
    s.anim(n + ' value', 'fly', d, 550, { dir: 'right' });
    s.anim(n + ' label', 'fade', d + 350, 400);
    s.anim(n + ' rule', 'wipe', d + 350, 450);
  });
  footer(s, 11, { note: '数据来源：中国民用航空局历年机场生产统计公报；国际及地区旅客为首都机场集团发布' });
  s.notes('看运行数据。2019 年投运当年只有 313 万人次，2021 年突破 2500 万，2022 年受疫情影响回落，2023 年之后快速恢复，2025 年达到 5362 万人次，排全国第 6。国际及地区旅客 589 万人次，同比增长约 25%。');
}

async function slideNetwork() {
  const s = newSlide('ferris');
  const pw = 5.3;
  const tw = W - pw - MX - 0.55;
  s.image(await crop('pkx_column2', pw, H, { fx: 0.55, fy: 0.5 }), W - pw, 0, pw, H, 'Network photo', photoInfo.pkx_column2.what);
  s.rect(W - pw, 0, 1.6, H, gradient(0, [
    { pos: 0, color: C.bg, alpha: 100 },
    { pos: 100, color: C.bg, alpha: 0 },
  ]), { name: 'Photo shade' });
  heading(s, '04  运行与数据', '航线网络与“一市两场”', { w: tw });
  s.anim('Network photo', 'grow', 0, 12000, { by: 1.05 });
  stat(s, 'Airlines', '71', '家', '入驻航空公司', MX, 1.9, 2.1, { delay: 600 });
  stat(s, 'Routes', '约 180', '条', '客运航线', MX + 2.25, 1.9, 2.2, { delay: 800 });
  stat(s, 'Countries', '25', '个', '通达国家', MX + 4.6, 1.9, 2.0, { delay: 1000 });
  s.text('国内航线 140 余条，国际及地区航线约 40 条（2025 年）。', MX, 3.0, tw, 0.28, { fontSize: 12, color: C.sub, name: 'Route note' });
  s.anim('Route note', 'fade', 1300, 500);

  s.text('“一市两场”：2025 年北京两座机场的旅客吞吐量（万人次）', MX, 3.62, tw, 0.28, { fontSize: 12, color: C.gold, name: 'Pair caption' });
  s.anim('Pair caption', 'fade', 1500, 500);
  const pair = [
    ['首都机场', 7074.3, C.bar],
    ['大兴机场', 5361.9, C.gold],
  ];
  pair.forEach(([name, v, color], i) => {
    const y = 4.05 + i * 0.52;
    const len = (v / 7074.3) * 3.9;
    const n = `Pair ${i + 1}`;
    s.text(name, MX, y, 1.1, 0.3, { fontSize: 13, color: C.text, name: n + ' name' });
    s.rect(MX + 1.15, y + 0.05, len, 0.22, color, { name: n + ' bar' });
    s.text(v.toFixed(1), MX + 1.15 + len + 0.12, y - 0.03, 1.2, 0.36, { fontSize: 16, bold: true, color: C.white, fontFace: FONT.num, name: n + ' value', valign: 'middle' });
    s.anim(n + ' name', 'fade', 1700 + i * 250, 400);
    s.anim(n + ' bar', 'wipe', 1750 + i * 250, 800);
    s.anim(n + ' value', 'zoom', 2400 + i * 250, 400);
  });
  s.text('两场合计约 1.24 亿人次，大兴机场约占 43%。', MX, 5.12, tw, 0.28, { fontSize: 12, color: C.sub, name: 'Pair note' });
  s.anim('Pair note', 'fade', 3000, 500);

  s.text('主要入驻航空公司', MX, 5.62, tw, 0.26, { fontSize: 12, color: C.gold, name: 'Airline caption' });
  s.anim('Airline caption', 'fade', 3100, 400);
  const chips = ['中国南方航空', '中国东方航空', '中国联合航空', '首都航空', '河北航空', '厦门航空', '中国国际航空（部分航线）'];
  let cx = MX, cy = 5.98;
  chips.forEach((name, i) => {
    const w = 0.17 * [...name].length + 0.36;
    if (cx + w > MX + tw) {
      cx = MX;
      cy += 0.42;
    }
    const n = `Chip ${i + 1}`;
    s.text(name, cx, cy, w, 0.32, {
      fontSize: 11, color: C.text, align: 'center', valign: 'middle', name: n,
      fill: { color: C.panel }, line: { color: C.line, width: 0.75 },
    });
    s.anim(n, 'zoom', 3200 + i * 110, 350);
    cx += w + 0.12;
  });
  footer(s, 12, { w: tw });
  photoShade(s, W - pw, pw);
  credit(s, 'pkx_column2', W - MX - 3.6, 7.12, 3.6, { align: 'right', color: 'E6EAF0' });
  s.notes('到 2025 年，大兴机场已入驻 71 家航空公司，客运航线约 180 条，通达 25 个国家。南航、东航、中联航等是主要的基地航空公司。北京现在是“一市两场”：2025 年首都机场 7074 万人次、大兴机场 5362 万人次，合计约 1.24 亿人次。');
}

async function slideTransport() {
  const s = newSlide('pan');
  const pw = 4.9;
  const px = W - MX - pw;
  const tw = px - MX - 0.5;
  heading(s, '05  综合交通', '“五纵两横”：把机场接入城市群');
  s.text('三条轨道', MX, 1.98, 3, 0.28, { fontSize: 12, color: C.gold, charSpacing: 2, name: 'Rail caption' });
  s.anim('Rail caption', 'fade', 500, 400);
  const rails = [
    ['轨道交通大兴机场线', '最高时速 160 公里，草桥站到机场约 19 分钟'],
    ['京雄城际铁路', '连接北京西站、大兴机场和雄安新区'],
    ['城际铁路联络线一期', '2024 年 12 月开通，连接廊坊北站与大兴机场站'],
  ];
  rails.forEach(([name, text], i) => {
    const y = 2.36 + i * 0.74;
    const n = `Rail ${i + 1}`;
    s.dot(MX + 0.09, y + 0.16, 0.16, C.gold, { name: n + ' dot' });
    s.text(name, MX + 0.36, y, tw - 0.36, 0.32, { fontSize: 15, bold: true, color: C.white, name: n + ' name' });
    s.text(text, MX + 0.36, y + 0.33, tw - 0.36, 0.28, { fontSize: 11.5, color: C.sub, name: n + ' text' });
    const d = 700 + i * 300;
    s.anim(n + ' dot', 'zoom', d, 350);
    s.anim(n + ' name', 'slide', d + 80, 500, { offset: -0.03 });
    s.anim(n + ' text', 'fade', d + 260, 450);
  });
  s.rect(MX + 0.165, 2.6, 0.012, 1.4, C.bar, { name: 'Rail line' });
  s.anim('Rail line', 'wipe', 700, 900, { dir: 'up' });

  s.text('四条高速公路', MX, 4.62, 3, 0.28, { fontSize: 12, color: C.gold, charSpacing: 2, name: 'Road caption' });
  s.anim('Road caption', 'fade', 1700, 400);
  let cx = MX;
  ['大兴机场高速', '京开高速', '京台高速', '大兴机场北线高速'].forEach((name, i) => {
    const w = 0.17 * [...name].length + 0.36;
    const n = `Road ${i + 1}`;
    s.text(name, cx, 4.98, w, 0.34, {
      fontSize: 11.5, color: C.text, align: 'center', valign: 'middle', name: n,
      fill: { color: C.panel }, line: { color: C.line, width: 0.75 },
    });
    s.anim(n, 'fly', 1800 + i * 140, 450, { dir: 'bottom' });
    cx += w + 0.12;
  });

  s.rect(MX, 5.62, tw, 1.12, C.panel, { name: 'Hub panel' });
  s.rect(MX, 5.62, 0.05, 1.12, C.gold, { name: 'Hub mark' });
  s.text('轨道下穿航站楼，“零距离换乘”', MX + 0.28, 5.74, tw - 0.5, 0.32, { fontSize: 14, bold: true, color: C.white, name: 'Hub title' });
  s.text('站台层在航站楼地下二层，换乘大厅在地下一层，出站即可值机；公共交通分担比例规划达到 50% 以上。', MX + 0.28, 6.1, tw - 0.5, 0.56, { fontSize: 11.5, color: C.sub, lineSpacingMultiple: 1.2, name: 'Hub text' });
  s.anim('Hub panel', 'wipe', 2500, 600);
  s.anim('Hub mark', 'wipe', 2900, 350, { dir: 'up' });
  s.anim('Hub title', 'fade', 2900, 450);
  s.anim('Hub text', 'fade', 3050, 500);

  const ph = 2.32;
  s.image(await crop('pkx_metro', pw, ph, { fx: 0.5, fy: 0.55 }), px, 1.95, pw, ph, 'Metro photo', photoInfo.pkx_metro.what);
  s.image(await crop('pkx_rail', pw, ph, { fx: 0.5, fy: 0.45 }), px, 1.95 + ph + 0.1, pw, ph, 'Rail photo', photoInfo.pkx_rail.what);
  [['Metro', 1.95, '轨道交通大兴机场线  ·  大兴机场站站台'], ['Rail', 1.95 + ph + 0.1, '铁路大兴机场站站台']].forEach(([key, y, caption]) => {
    s.rect(px, y + ph - 0.7, pw, 0.7, gradient(90, [
      { pos: 0, color: C.deep, alpha: 0 },
      { pos: 55, color: C.deep, alpha: 72 },
      { pos: 100, color: C.deep, alpha: 92 },
    ]), { name: key + ' photo shade' });
    s.text(caption, px + 0.18, y + ph - 0.33, pw - 0.3, 0.26, { fontSize: 11, color: C.white, name: key + ' photo caption' });
  });
  s.anim('Metro photo', 'fly', 900, 700, { dir: 'right' });
  s.anim('Metro photo shade', 'fade', 1500, 400);
  s.anim('Metro photo caption', 'fade', 1600, 400);
  s.anim('Rail photo', 'fly', 1300, 700, { dir: 'right' });
  s.anim('Rail photo shade', 'fade', 1900, 400);
  s.anim('Rail photo caption', 'fade', 2000, 400);
  footer(s, 13, { note: '资料来源：经济日报、民航局《建设及运营工作总结》、北京市发展改革委' });
  credit(s, ['pkx_metro', 'pkx_rail'], px, 6.77, pw, {});
  s.notes('大兴机场离市区比首都机场远，所以规划了“五纵两横”的综合交通网络，包括三条轨道和四条高速公路。轨道交通大兴机场线最高时速 160 公里，从草桥站到机场约 19 分钟。多条轨道线直接从航站楼下面穿过，站台在地下二层，出站上楼就能到值机大厅。');
}

async function slideGreenSmart() {
  const s = newSlide('ripple');
  heading(s, '06  绿色智慧与展望', '绿色机场与智慧出行');
  const gap = 0.3;
  const cw = (W - 2 * MX - gap) / 2;
  const columns = [
    ['绿色机场', 'GREEN', [
      ['三星 + 3A', '国内单体体量最大的绿色建筑三星级项目，全国首个通过节能建筑 3A 级评审的建筑'],
      ['1 万余个', '地源热泵地埋孔，可满足周边 257 万㎡ 建筑的供暖制冷需求'],
      ['10 MW+', '全场光伏装机容量；可再生能源占总能耗比例 16% 以上'],
      ['100%', '近机位全部配备飞机地面专用空调和 400Hz 电源，飞机停靠时可关闭辅助动力装置'],
    ]],
    ['智慧出行', 'SMART', [
      ['无纸化', '“一证通关 + 面像登机”，实现全流程无纸化出行'],
      ['13 分钟', '首件进港行李 13 分钟内到达；RFID 行李牌实现行李全流程跟踪'],
      ['多点值机', '四层、三层和地下一层换乘大厅都能值机；草桥站城市航站楼与机场同步投运'],
      ['91%+', '2025 年航班起飞正常率，在全国 26 个 2000 万人次以上机场中排名第一'],
    ]],
  ];
  columns.forEach(([title, en, items], c) => {
    const x = MX + c * (cw + gap);
    const k = c === 0 ? 'Green' : 'Smart';
    s.rect(x, 1.95, cw, 4.82, C.panel, { name: k + ' panel' });
    s.rect(x, 1.95, cw, 0.05, c === 0 ? '7FC79A' : C.gold, { name: k + ' top' });
    s.text(title, x + 0.3, 2.18, 2.5, 0.4, { fontSize: 18, bold: true, color: C.white, name: k + ' title' });
    s.text(en, x + cw - 1.8, 2.26, 1.5, 0.26, { fontSize: 10, color: c === 0 ? '7FC79A' : C.gold, charSpacing: 4, fontFace: FONT.num, align: 'right', name: k + ' tag' });
    const d0 = 600 + c * 500;
    s.anim(k + ' panel', c === 0 ? 'fly' : 'fly', d0, 650, { dir: c === 0 ? 'left' : 'right' });
    s.anim(k + ' top', 'wipe', d0 + 500, 500);
    s.anim(k + ' title', 'fade', d0 + 550, 450);
    s.anim(k + ' tag', 'fade', d0 + 650, 450);
    items.forEach(([value, text], i) => {
      const y = 2.86 + i * 0.96;
      const n = `${k} ${i + 1}`;
      const tint = c === 0 ? '9BD8B1' : C.gold;
      s.text(mixed(value, { fontSize: 20, bold: true, color: tint }, { fontSize: 17 }), x + 0.3, y, 1.75, 0.5, { valign: 'middle', name: n + ' value' });
      s.text(text, x + 2.1, y + 0.02, cw - 2.4, 0.62, { fontSize: 12, color: C.text, lineSpacingMultiple: 1.2, valign: 'middle', name: n + ' text' });
      if (i < items.length - 1) s.rect(x + 0.3, y + 0.8, cw - 0.6, 0.01, C.line, { name: n + ' rule' });
      const d = d0 + 900 + i * 260;
      s.anim(n + ' value', 'zoom', d, 450);
      s.anim(n + ' text', 'slide', d + 120, 500, { offset: 0.02 });
      if (i < items.length - 1) s.anim(n + ' rule', 'wipe', d + 250, 450);
    });
  });
  footer(s, 14, { note: '资料来源：生态环境部、民航局《建设及运营工作总结》、首都机场集团' });
  s.notes('大兴机场也是一座绿色机场和智慧机场。航站楼是国内单体体量最大的绿色建筑三星级项目，也是全国首个通过节能建筑 3A 级评审的建筑；采用地源热泵和光伏发电，可再生能源占比 16% 以上。智慧方面，旅客可以“一证通关、面像登机”，全流程无纸化，行李可以全流程跟踪。2025 年航班起飞正常率在 91% 以上，在全国 26 个 2000 万人次以上的机场里排第一。');
}

async function slideOutlook() {
  const s = newSlide('window');
  heading(s, '06  绿色智慧与展望', '未来展望：向 7200 万人次迈进');
  s.text('本期工程设计目标（目标年 2025 年）与 2025 年实际完成', MX, 1.98, 6.2, 0.28, { fontSize: 12, color: C.sub, name: 'Target caption' });
  s.anim('Target caption', 'fade', 500, 500);
  const targets = [
    ['旅客吞吐量', '5361.9', '7200 万人次', 5361.9 / 7200],
    ['飞机起降', '34.6', '62 万架次', 34.58 / 62],
    ['货邮吞吐量', '36.9', '200 万吨', 36.92 / 200],
  ];
  const bw = 5.9;
  targets.forEach(([name, actual, target, ratio], i) => {
    const y = 2.5 + i * 1.38;
    const n = `Target ${i + 1}`;
    s.text(name, MX, y, 2.2, 0.3, { fontSize: 14, bold: true, color: C.white, name: n + ' name' });
    s.text([numRun(actual, { fontSize: 15, bold: true, color: C.gold }), run('  /  ' + target, { fontSize: 11.5, color: C.sub })],
      MX + 2.2, y - 0.02, bw - 2.2, 0.34, { align: 'right', name: n + ' figures' });
    s.rect(MX, y + 0.46, bw, 0.24, C.panel, { name: n + ' track' });
    s.rect(MX, y + 0.46, bw * ratio, 0.24, gradient(0, [{ pos: 0, color: 'B8894A' }, { pos: 100, color: C.gold }]), { name: n + ' bar' });
    s.text(Math.round(ratio * 100) + '%', MX + bw * ratio + 0.12, y + 0.4, 0.9, 0.36, { fontSize: 15, bold: true, color: C.white, fontFace: FONT.num, valign: 'middle', name: n + ' percent' });
    const d = 800 + i * 380;
    s.anim(n + ' name', 'fade', d, 400);
    s.anim(n + ' figures', 'fade', d + 100, 400);
    s.anim(n + ' track', 'fade', d, 400);
    s.anim(n + ' bar', 'wipe', d + 150, 1000);
    s.anim(n + ' percent', 'zoom', d + 1000, 400);
  });
  s.text('旅客量已完成设计目标的约四分之三，货运还有很大的增长空间。', MX, 6.48, 6.2, 0.28, { fontSize: 11.5, color: C.sub, name: 'Target note' });
  s.anim('Target note', 'fade', 3000, 500);

  const cx = 7.35, cwid = W - MX - cx;
  const cards = [
    ['卫星厅', '现有航站楼按年旅客量 4500 万人次的使用需求建设，2024 年客流已超过这一规模。北京市《2026 年市政府工作报告重点任务清单》提出“加快推进大兴国际机场卫星厅等项目建设”。'],
    ['国际枢纽', '2025 年国际及地区旅客 589.05 万人次，同比增长 24.56%；国际及地区航线约 40 条，连通 25 个国家。'],
    ['远期规划', '远期规划 6 条跑道，可满足年旅客吞吐量 1 亿人次以上、货邮吞吐量 400 万吨的使用需求。'],
  ];
  const hs = [1.72, 1.3, 1.3];
  let y = 1.98;
  cards.forEach(([title, text], i) => {
    const n = `Outlook ${i + 1}`;
    const h = hs[i];
    s.rect(cx, y, cwid, h, C.panel, { name: n + ' panel' });
    s.rect(cx, y, 0.05, h, C.gold, { name: n + ' mark' });
    s.text(title, cx + 0.3, y + 0.17, cwid - 0.5, 0.34, { fontSize: 16, bold: true, color: C.white, name: n + ' title' });
    s.text(text, cx + 0.3, y + 0.57, cwid - 0.55, h - 0.65, { fontSize: 11.5, color: C.sub, lineSpacingMultiple: 1.2, name: n + ' text' });
    const d = 1400 + i * 400;
    s.anim(n + ' panel', 'splitH', d, 600);
    s.anim(n + ' mark', 'wipe', d + 450, 350, { dir: 'up' });
    s.anim(n + ' title', 'fade', d + 450, 450);
    s.anim(n + ' text', 'fade', d + 600, 500);
    y += h + 0.2;
  });
  footer(s, 15, { note: '资料来源：民航局、经济日报、北京市人民政府、首都机场集团' });
  s.notes('展望未来：一期工程的设计目标是 2025 年 7200 万人次，2025 年实际完成了约四分之三。现有航站楼是按 4500 万人次的使用需求建设的，2024 年客流已经超过这个规模，所以卫星厅的建设被列入北京市 2026 年的重点任务。远期，大兴机场规划 6 条跑道，年旅客吞吐量 1 亿人次以上。');
}

async function slideSummary() {
  const s = newSlide('origami');
  heading(s, '总结', '从大兴机场看到了什么');
  const cards = [
    ['设计之美', '五指廊让旅客从中心到最远端登机口只需步行约 600 米；C 型柱把结构、采光和造型合为一体。'],
    ['效率之高', '“三纵一横”跑道、双层出发双层到达、轨道下穿航站楼，空中与地面衔接紧密。'],
    ['发展之快', '投运六年，年旅客量从 313 万增长到 5362 万人次，位居全国第 6。'],
  ];
  const gap = 0.3, cw = (W - 2 * MX - 2 * gap) / 3, ch = 3.3;
  cards.forEach(([title, text], i) => {
    const x = MX + i * (cw + gap), y = 2.05;
    const n = `Summary ${i + 1}`;
    s.rect(x, y, cw, ch, C.panel, { name: n + ' panel' });
    s.rect(x, y, cw, 0.05, C.gold, { name: n + ' top' });
    s.text(pad2(i + 1), x + 0.35, y + 0.35, 1.5, 0.8, { fontSize: 44, bold: true, color: C.gold, fontFace: FONT.num, name: n + ' number' });
    s.text(title, x + 0.35, y + 1.3, cw - 0.7, 0.45, { fontSize: 22, bold: true, color: C.white, name: n + ' title' });
    s.text(text, x + 0.35, y + 1.9, cw - 0.7, 1.25, { fontSize: 14, color: C.text, lineSpacingMultiple: 1.3, name: n + ' text' });
    const d = 600 + i * 450;
    s.anim(n + ' panel', 'fly', d, 650, { dir: 'bottom' });
    s.anim(n + ' top', 'wipe', d + 500, 450);
    s.anim(n + ' number', 'wheel', d + 500, 700);
    s.anim(n + ' title', 'rise', d + 650, 500, { offset: 0.03 });
    s.anim(n + ' text', 'fade', d + 850, 550);
  });
  s.rect(MX, 5.72, 0.05, 0.72, C.gold, { name: 'Closing mark' });
  s.text('大兴机场不只是一座机场，也是京津冀协同发展的一个缩影。', MX + 0.3, 5.74, W - 2 * MX - 0.3, 0.7, { fontSize: 20, color: C.white, fontFace: FONT.light, valign: 'middle', name: 'Closing line' });
  s.anim('Closing mark', 'wipe', 2600, 400, { dir: 'up' });
  s.anim('Closing line', 'wipe', 2700, 1200);
  footer(s, 16);
  s.notes('最后做个总结。第一是设计之美：五指廊和 C 型柱把功能和造型结合在一起；第二是效率之高：跑道、航站楼和轨道交通一体化衔接；第三是发展之快：六年时间客流增长到 5362 万人次。大兴机场不只是一座机场，也是京津冀协同发展的一个缩影。');
}

// Every entry was opened and read while the slides were written; titles and dates are as published.
const REFERENCES = [
  '中国民用航空局：历年《全国民用运输机场生产统计公报》（2019—2025 年）',
  '民航北京大兴国际机场建设及运营筹备领导小组：《践行新发展理念 打造国家发展新的动力源——北京大兴国际机场建设及运营工作总结》，2020-09-25',
  '中国民用航空局：《世纪工程的为民初心——记“以人为本”的北京大兴国际机场规划设计》，2019-09-04',
  '经济日报：《“凤凰”展翅起宏图》，2019-09-26',
  '中国新闻周刊：《正式投运！独家揭秘北京大兴国际机场》，2019-09-26',
  '生态环境部：《北京大兴机场成为重大工程建设的绿色样板》，2022-11-03',
  '首都机场集团：《大兴机场 2025 年旅客吞吐量超 5300 万人次》，2026-01-06',
  '北京市发展和改革委员会：《城际铁路联络线一期开通运营》，2024-12-30',
  '北京市人民政府：《2026 年市政府工作报告重点任务清单》（京政发〔2026〕1 号）',
  '维基百科：“北京大兴国际机场”条目（跑道宽度、国际航线开通日期）',
];

// Photos in the order they appear; the build stops if this list and the slides disagree.
const PHOTO_KEYS = [
  'pkx_cover', 'pkx_column3', 'pkx_apron', 'pkx_atrium', 'pkx_aerial', 'pkx_column', 'pkx_roof', 'pkx_checkin',
  'pkx_walk', 'pkx_gate', 'pkx_garden', 'pkx_column2', 'pkx_metro', 'pkx_rail', 'pkx_tower',
];

async function slideSources() {
  const s = newSlide('fade');
  heading(s, '附录', '参考资料');
  const lw = 7.35;
  s.text('资料与数据', MX, 1.95, lw, 0.28, { fontSize: 12, color: C.gold, charSpacing: 2, name: 'Refs caption' });
  s.text(
    REFERENCES.map((r, i) => run(`[${i + 1}]  ${r}`, { paraSpaceAfter: 5, breakLine: true })),
    MX, 2.3, lw, 4.5, { fontSize: 10.5, color: C.text, lineSpacingMultiple: 1.12, name: 'Refs list' }
  );
  s.anim('Refs caption', 'fade', 500, 400);
  REFERENCES.forEach((_, i) => s.anim('Refs list', 'fade', 600 + i * 90, 400, { para: i }));

  const x = MX + lw + 0.45, w = W - MX - x;
  s.text('图片（均来自维基共享资源 Wikimedia Commons）', x, 1.95, w, 0.28, { fontSize: 12, color: C.gold, name: 'Photos caption' });
  const byAuthor = new Map();
  for (const key of PHOTO_KEYS) {
    const p = photoInfo[key];
    const label = `${p.artist}（${p.license}）`;
    if (!byAuthor.has(label)) byAuthor.set(label, []);
    byAuthor.get(label).push(p.what.replace(/（.*?）/g, ''));
  }
  const lines = [...byAuthor].map(([label, items]) => `${label}：${items.join('、')}`);
  s.text(
    lines.map((l) => run(l, { paraSpaceAfter: 4.5, breakLine: true })),
    x, 2.3, w, 3.75, { fontSize: 9.5, color: C.text, lineSpacingMultiple: 1.1, name: 'Photos list' }
  );
  s.text('图片按各自的知识共享许可使用，均经过裁剪，航拍图调整了对比度；飞机图标与跑道示意图为自行绘制。', x, 6.22, w, 0.5, { fontSize: 9.5, color: C.muted, lineSpacingMultiple: 1.15, name: 'Photos note' });
  s.anim('Photos caption', 'fade', 900, 400);
  lines.forEach((_, i) => s.anim('Photos list', 'fade', 1000 + i * 90, 400, { para: i }));
  s.anim('Photos note', 'fade', 2200, 500);
  footer(s, 17);
  s.notes('这一页是参考资料。数据主要来自中国民航局的统计公报和工作总结、生态环境部和北京市政府的公开文件，以及经济日报、中国新闻周刊的报道；图片来自维基共享资源，按各自的许可协议使用并注明了作者。');
}

async function slideThanks() {
  const s = newSlide('vortex');
  s.image(await crop('pkx_tower', W, H, { fx: 0.5, fy: 0.5 }), 0, 0, W, H, 'Thanks photo', photoInfo.pkx_tower.what);
  s.rect(0, 0, W, H, gradient(90, [
    { pos: 0, color: C.deep, alpha: 55 },
    { pos: 55, color: C.deep, alpha: 35 },
    { pos: 100, color: C.deep, alpha: 85 },
  ]), { name: 'Thanks shade' });
  s.text('THANK YOU', 0, 1.75, W, 0.4, { fontSize: 15, color: C.gold, align: 'center', charSpacing: 12, fontFace: FONT.num, name: 'Thanks en' });
  s.text('感谢聆听', 0, 2.3, W, 1.3, { fontSize: 66, bold: true, color: C.white, align: 'center', name: 'Thanks title' });
  s.rect(W / 2 - 0.5, 3.82, 1.0, 0.04, C.gold, { name: 'Thanks bar' });
  s.text('恳请各位老师和同学批评指正', 0, 4.08, W, 0.5, { fontSize: 20, color: C.text, align: 'center', fontFace: FONT.light, name: 'Thanks line' });
  const fw = 3.4, fx0 = W / 2 - fw / 2;
  s.text('汇报人：', fx0, 5.25, fw, 0.34, { fontSize: 14, color: C.text, name: 'Field 汇报人' });
  s.rect(fx0 + 0.82, 5.59, fw - 0.82, 0.012, 'AEB7C6', { name: 'Field line' });
  credit(s, 'pkx_tower', W - MX - 4.6, 7.12, 4.6, { align: 'right', color: 'C9D1DE' });

  const from = [1.2, 6.4], to = [6.0, 4.9];
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  s.image(await planeIcon(), from[0] - 0.3, from[1] - 0.3, 0.6, 0.6, 'Plane', '飞机图标', { rotate: (angle + 360) % 360 });

  s.anim('Thanks photo', 'grow', 0, 14000, { by: 1.06 });
  s.anim('Thanks en', 'fade', 500, 700);
  s.anim('Thanks title', 'zoom', 800, 900);
  s.anim('Thanks bar', 'splitH', 1500, 600);
  s.anim('Thanks line', 'rise', 1800, 700);
  s.anim('Field 汇报人', 'fade', 2400, 500);
  s.anim('Field line', 'wipe', 2500, 500);
  s.anim('Thanks title', 'pulse', 3000, 500, { by: 1.05 });
  s.anim('Plane', 'fade', 2600, 400);
  s.anim('Plane', 'path', 2800, 5000, { path: `M 0 0 L ${((W + 1 - from[0]) / W).toFixed(4)} ${(((W + 1 - from[0]) * (dy / dx)) / H).toFixed(4)} E` });
  s.notes('我们的汇报到此结束，感谢各位老师和同学的聆听，恳请批评指正。');
}

// ---------- build -----------------------------------------------------------------------

(async () => {
  fs.mkdirSync(IMG, { recursive: true });
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  await slideCover();
  await slideContents();
  await slideOverview();
  await slideLocation();
  await slideTimeline();
  await slideDesign();
  await slideStructure();
  await slideGallery();
  await slideNumbers();
  await slideRunways();
  await slideTraffic();
  await slideNetwork();
  await slideTransport();
  await slideGreenSmart();
  await slideOutlook();
  await slideSummary();
  await slideSources();
  await slideThanks();
  if (specs.length !== TOTAL) throw new Error(`expected ${TOTAL} slides, built ${specs.length}`);
  const missing = PHOTO_KEYS.filter((k) => !usedPhotos.includes(k));
  const unlisted = usedPhotos.filter((k) => !PHOTO_KEYS.includes(k));
  if (missing.length || unlisted.length) throw new Error(`photo list out of date: missing ${missing}, unlisted ${unlisted}`);

  const raw = await pptx.write({ outputType: 'nodebuffer' });
  const zip = await JSZip.loadAsync(raw);
  let effects = 0;
  for (let i = 0; i < specs.length; i++) {
    const name = `ppt/slides/slide${i + 1}.xml`;
    const xml = await zip.file(name).async('string');
    zip.file(name, decorateSlide(xml, specs[i]));
    effects += specs[i].effects.length;
  }
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(OUT_FILE, out);
  console.log(`${OUT_FILE}\n${specs.length} slides, ${effects} animation effects, ${(out.length / 1048576).toFixed(2)} MB`);
  console.log('transitions: ' + specs.map((sp) => sp.transition).join(', '));
  console.log('photos used: ' + usedPhotos.join(', '));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
