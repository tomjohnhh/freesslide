// Builds 中国大型机场.pptx.
// PptxGenJS lays out the slides; lib/fx.js then adds gradients, transitions and animations.
//
// Figures: CAAC《2025年全国民用运输机场生产统计公报》and its two annex tables (published
// 2026-02-26, excludes Hong Kong / Macao / Taiwan) unless a slide says otherwise.

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const JSZip = require('jszip');
const sharp = require('sharp');
const { gradient, decorateSlide } = require('./lib/fx');

const ROOT = __dirname;
const PHOTOS = path.join(ROOT, 'photos');
const IMG = path.join(ROOT, 'img');
const OUT = path.join(ROOT, 'out');
const OUT_FILE = path.join(OUT, '中国大型机场.pptx');

const W = 13.333;
const H = 7.5;
const PX = 144; // pixels per inch for prepared pictures (1920 px across the slide)
const TOTAL = 16;

const C = {
  bg: '0A0F1A',
  panel: '121B2E',
  line: '27344E',
  white: 'FFFFFF',
  text: 'D5DBE6',
  sub: 'A9B4C7',
  muted: '6F7C93',
  gold: 'E3B25B',
  bar: '34435F',
};
const FONT = { cn: 'Microsoft YaHei', light: 'Microsoft YaHei Light', num: 'Bahnschrift' };

const photoInfo = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'photos.json'), 'utf8')).map((p) => [p.key, p])
);

// ---------- pictures --------------------------------------------------------------------

/** Crops a source photo to w x h inches around a focus point (fx, fy in 0..1). */
async function crop(key, wIn, hIn, { fx = 0.5, fy = 0.5, scale = 1 } = {}) {
  const outW = Math.round(wIn * PX * scale);
  const outH = Math.round(hIn * PX * scale);
  const src = path.join(PHOTOS, key + '.jpg');
  const meta = await sharp(src).metadata();
  const k = Math.max(outW / meta.width, outH / meta.height);
  const cw = Math.min(meta.width, Math.round(outW / k));
  const ch = Math.min(meta.height, Math.round(outH / k));
  const left = Math.round((meta.width - cw) * fx);
  const top = Math.round((meta.height - ch) * fy);
  const file = path.join(IMG, `${key}_${outW}x${outH}.jpg`);
  await sharp(src)
    .extract({ left, top, width: cw, height: ch })
    .resize(outW, outH, { kernel: 'lanczos3' })
    .sharpen({ sigma: 0.5 })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(file);
  return file;
}

// ---------- slide helpers ---------------------------------------------------------------

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'WIDE', width: W, height: H });
pptx.layout = 'WIDE';
pptx.title = '中国大型机场';
pptx.subject = '中国大型机场概览（2025 年数据）';
pptx.author = '中国大型机场';
pptx.company = '';

const specs = [];
const run = (text, options = {}) => ({ text, options });
const numRun = (text, options = {}) => run(text, { fontFace: FONT.num, ...options });

function newSlide(transition) {
  const slide = pptx.addSlide();
  slide.background = { color: C.bg };
  const spec = { transition, effects: [] };
  specs.push(spec);
  let counter = 0;
  const auto = (prefix) => `${prefix} ${++counter}`;
  return {
    rect(x, y, w, h, fill, o = {}) {
      const name = o.name || auto('Shape');
      slide.addShape('rect', {
        x, y, w, h,
        fill: typeof fill === 'string' ? { color: fill } : fill,
        line: o.line,
        rotate: o.rotate,
        objectName: name,
      });
      return name;
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
    image(file, x, y, w, h, name, alt) {
      slide.addImage({ path: file, x, y, w, h, objectName: name, altText: alt });
      return name;
    },
    anim(target, type, delay = 0, dur = 600, extra = {}) {
      spec.effects.push({ target, type, delay, dur, ...extra });
    },
  };
}

function footer(s, page, { x = 0.7, w = W - 1.4, note = '' } = {}) {
  s.rect(x, 6.98, w, 0.012, C.line, { name: 'Footer line' });
  s.text('中国大型机场  ·  2025', x, 7.09, 2.6, 0.22, { fontSize: 9, color: C.muted, name: 'Footer title' });
  if (note) {
    s.text(note, x + 2.6, 7.09, w - 4.0, 0.22, { fontSize: 9, color: C.muted, align: 'center', name: 'Footer note' });
  }
  s.text(`${String(page).padStart(2, '0')} / ${TOTAL}`, x + w - 1.4, 7.09, 1.4, 0.22, {
    fontSize: 9, color: C.muted, align: 'right', fontFace: FONT.num, name: 'Footer page',
  });
}

function heading(s, part, title, { x = 0.7, w = W - 1.4 } = {}) {
  s.rect(x, 0.665, 0.36, 0.04, C.gold, { name: 'Kicker bar' });
  s.text(part, x + 0.5, 0.55, 7, 0.28, { fontSize: 10.5, color: C.gold, charSpacing: 3, name: 'Kicker' });
  s.text(title, x, 0.95, w, 0.7, { fontSize: 30, bold: true, color: C.white, name: 'Title' });
  s.anim('Kicker bar', 'wipe', 0, 450);
  s.anim('Kicker', 'fade', 100, 450);
  s.anim('Title', 'rise', 150, 700);
}

const SOURCE_NOTE = '数据来源：中国民航局《2025 年全国民用运输机场生产统计公报》';

function creditText(key) {
  const p = photoInfo[key];
  return `图：${p.what}  ·  ${p.artist}  ·  ${p.license}`;
}

/** Rough width of a string in "full-width character" units, for line estimates. */
function visualLength(str) {
  let n = 0;
  for (const ch of str) n += /[\u2E80-\u9FFF\uFF00-\uFFEF\u3000-\u303F“”‘’—]/.test(ch) ? 1 : ch === ' ' ? 0.35 : 0.62;
  return n;
}

// ---------- content ---------------------------------------------------------------------

const TOP10 = [
  ['上海浦东', 8499.5, '+10.7%'],
  ['广州白云', 8358.3, '+9.5%'],
  ['北京首都', 7074.3, '+5.0%'],
  ['深圳宝安', 6648.5, '+8.1%'],
  ['成都天府', 5668.7, '+3.2%'],
  ['北京大兴', 5361.9, '+8.5%'],
  ['杭州萧山', 5045.9, '+5.0%'],
  ['上海虹桥', 5015.1, '+4.6%'],
  ['重庆江北', 5009.5, '+2.9%'],
  ['昆明长水', 4970.6, '+5.4%'],
];

const CLUSTERS = [
  { name: '长三角机场群', note: '上海、江苏、浙江、安徽', value: '3.06', growth: '+6.5%', share: 20.0, airports: ['上海浦东 · 上海虹桥', '杭州萧山 · 南京禄口'] },
  { name: '粤港澳大湾区机场群', note: '统计口径：珠三角九市', value: '1.68', growth: '+8.5%', share: 11.0, airports: ['广州白云 · 深圳宝安', '珠海金湾'] },
  { name: '京津冀机场群', note: '北京、天津、河北', value: '1.59', growth: '+5.3%', share: 10.4, airports: ['北京首都 · 北京大兴', '天津滨海'] },
  { name: '成渝机场群', note: '成渝地区双城经济圈', value: '1.51', growth: '+2.9%', share: 9.9, airports: ['成都天府 · 成都双流', '重庆江北'] },
];

const AIRPORTS = [
  {
    photo: 'pvg_t1', focus: { fx: 0.5, fy: 0.5 }, code: 'PVG', rank: 1,
    name: '上海浦东国际机场', en: 'SHANGHAI PUDONG INTERNATIONAL AIRPORT',
    stats: [
      ['8499.5', '万人次', '旅客吞吐量', '+10.7%  ·  全国第 1'],
      ['409.2', '万吨', '货邮吞吐量', '+8.3%  ·  全国第 1'],
      ['55.7', '万架次', '飞机起降', '+5.5%  ·  全国第 1'],
    ],
    facts: [
      '1999 年 9 月 16 日通航；2025 年旅客吞吐量首次突破 8000 万人次',
      'T1（27.8 万㎡）、T2（48.55 万㎡）两座航站楼，S1/S2 卫星厅（62.2 万㎡）2019 年 9 月启用',
      '国际航线旅客 3286.7 万人次，居全国第一',
      'T3 航站楼（约 119 万㎡）主体工程 2024 年 11 月开工，预计 2028 年建成',
    ],
  },
  {
    photo: 'can_t2', focus: { fx: 0.3, fy: 0.5 }, code: 'CAN', rank: 2,
    name: '广州白云国际机场', en: 'GUANGZHOU BAIYUN INTERNATIONAL AIRPORT',
    stats: [
      ['8358.3', '万人次', '旅客吞吐量', '+9.5%  ·  全国第 2'],
      ['243.9', '万吨', '货邮吞吐量', '+2.4%  ·  全国第 2'],
      ['55.1', '万架次', '飞机起降', '+7.5%  ·  全国第 2'],
    ],
    facts: [
      '2004 年 8 月 5 日迁至现址启用；T2 航站楼 2018 年 4 月 26 日启用',
      '2025 年 10 月 30 日，T3 航站楼与第五跑道投运，形成“五条跑道 + 三座航站楼”',
      '中国民航首个五条商用跑道运行的机场',
      '2025 年旅客吞吐量首次突破 8000 万人次，其中国际航线 1673.2 万人次',
    ],
  },
  {
    photo: 'pek_t3', focus: { fx: 0.45, fy: 0.5 }, code: 'PEK', rank: 3,
    name: '北京首都国际机场', en: 'BEIJING CAPITAL INTERNATIONAL AIRPORT',
    stats: [
      ['7074.3', '万人次', '旅客吞吐量', '+5.0%  ·  全国第 3'],
      ['155.1', '万吨', '货邮吞吐量', '+7.5%  ·  全国第 4'],
      ['44.2', '万架次', '飞机起降', '+2.0%  ·  全国第 4'],
    ],
    facts: [
      '1958 年投入使用，是新中国首个投入使用的民用机场',
      '现有 3 座航站楼、3 条跑道；T3 航站楼 2008 年 2 月 29 日启用，建筑面积 98.6 万㎡',
      '2018 年 12 月 28 日，年旅客吞吐量突破 1 亿人次，为中国首个',
      '2025 年与大兴机场合计完成旅客吞吐量 1.24 亿人次',
    ],
  },
  {
    photo: 'szx', focus: { fx: 0.62, fy: 0.5 }, code: 'SZX', rank: 4,
    name: '深圳宝安国际机场', en: "SHENZHEN BAO'AN INTERNATIONAL AIRPORT",
    stats: [
      ['6648.5', '万人次', '旅客吞吐量', '+8.1%  ·  全国第 4'],
      ['205.1', '万吨', '货邮吞吐量', '+9.0%  ·  全国第 3'],
      ['44.8', '万架次', '飞机起降', '+4.6%  ·  全国第 3'],
    ],
    facts: [
      '1991 年 10 月 12 日通航',
      'T3 航站楼 2013 年 11 月 28 日启用，建筑面积 45.1 万㎡；卫星厅 2021 年 12 月 7 日启用',
      '第三跑道 2025 年 11 月 29 日投运',
      '2025 年货邮吞吐量首次突破 200 万吨',
    ],
  },
  {
    photo: 'tfu_air', focus: { fx: 0.06, fy: 0.5 }, code: 'TFU', rank: 5,
    name: '成都天府国际机场', en: 'CHENGDU TIANFU INTERNATIONAL AIRPORT',
    stats: [
      ['5668.7', '万人次', '旅客吞吐量', '+3.2%  ·  全国第 5'],
      ['43.5', '万吨', '货邮吞吐量', '+12.9%  ·  全国第 12'],
      ['38.4', '万架次', '飞机起降', '+1.3%  ·  全国第 5'],
    ],
    facts: [
      '2021 年 6 月 27 日投运，一期建成“两纵一横”3 条跑道和 71 万㎡航站楼',
      '成都由此成为继北京、上海之后，内地第三个拥有两座国际枢纽机场的城市',
      '航站楼造型取意古蜀“太阳神鸟”',
      '2025 年与双流机场合计完成旅客吞吐量 9020.6 万人次',
    ],
  },
  {
    photo: 'pkx_air', focus: { fx: 0.52, fy: 0.5 }, code: 'PKX', rank: 6,
    name: '北京大兴国际机场', en: 'BEIJING DAXING INTERNATIONAL AIRPORT',
    stats: [
      ['5361.9', '万人次', '旅客吞吐量', '+8.5%  ·  全国第 6'],
      ['36.9', '万吨', '货邮吞吐量', '+13.2%  ·  全国第 15'],
      ['34.6', '万架次', '飞机起降', '+6.3%  ·  全国第 6'],
    ],
    facts: [
      '2019 年 9 月 25 日正式投运；2025 年旅客吞吐量首次突破 5000 万人次',
      '“三纵一横”4 条跑道，航站楼建筑面积 70 万㎡',
      '五指廊放射构型，79 个近机位；从航站楼中心到最远登机口约 600 米，步行不超过 8 分钟',
      '2025 年国际航线旅客 513.6 万人次',
    ],
  },
];

const MORE = [
  { photo: 'hgh', focus: { fx: 0.5, fy: 0.5 }, rank: '07', code: 'HGH', name: '杭州萧山国际机场', value: '5045.9', growth: '+5.0%',
    fact: 'T4 航站楼（约 72 万㎡）2022 年 9 月 22 日投运；2025 年首次突破 5000 万人次' },
  { photo: 'ckg', focus: { fx: 0.5, fy: 0.6 }, rank: '09', code: 'CKG', name: '重庆江北国际机场', value: '5009.5', growth: '+2.9%',
    fact: '第四跑道 2024 年 12 月 26 日启用，T3B 航站楼 2025 年 4 月 9 日投用' },
  { photo: 'kmg', focus: { fx: 0.5, fy: 0.45 }, rank: '10', code: 'KMG', name: '昆明长水国际机场', value: '4970.6', growth: '+5.4%',
    fact: '2012 年 6 月 28 日转场运营，是面向南亚、东南亚的门户枢纽' },
  { photo: 'xiy', focus: { fx: 0.5, fy: 0.5 }, rank: '11', code: 'XIY', name: '西安咸阳国际机场', value: '4853.6', growth: '+3.2%',
    fact: 'T5 航站楼（约 70 万㎡）2025 年 2 月 20 日投运' },
];

const CARGO = [
  ['上海浦东', 409.2, '+8.3%'],
  ['广州白云', 243.9, '+2.4%'],
  ['深圳宝安', 205.1, '+9.0%'],
  ['北京首都', 155.1, '+7.5%'],
  ['鄂州花湖', 114.6, '+32.4%'],
  ['郑州新郑', 103.3, '+25.2%'],
];

// ACI World, preliminary 2025 rankings (released 2026-04-14).
const WORLD = [
  { name: '上海浦东', code: 'PVG', rows: [['旅客吞吐量', '5'], ['货邮吞吐量', '2'], ['飞机起降架次', '8']] },
  { name: '广州白云', code: 'CAN', rows: [['旅客吞吐量', '9'], ['货邮吞吐量', '10'], ['飞机起降架次', '9']] },
  { name: '香港国际', code: 'HKG', rows: [['货邮吞吐量', '1'], ['国际旅客吞吐量', '8']], note: '2025 年货邮吞吐量约 507 万吨' },
];

const TIMELINE = [
  { date: '2024.12.26', who: '重庆江北', what: '第四跑道启用，成为中西部首个、全国第三个四条跑道同时运行的机场' },
  { date: '2025.02.20', who: '西安咸阳', what: 'T5 航站楼投运，建筑面积约 70 万㎡' },
  { date: '2025.04.09', who: '重庆江北', what: 'T3B 航站楼投用' },
  { date: '2025.10.30', who: '广州白云', what: 'T3 航站楼与第五跑道同步投运' },
  { date: '2025.11.29', who: '深圳宝安', what: '第三跑道投运' },
  { date: '预计 2028', who: '上海浦东', what: 'T3 航站楼在建，建筑面积约 119 万㎡', pending: true },
];

const PHOTO_PAGES = [
  ['cover', 1], ['pek_tower', 2], ['pvg_t1', 5], ['can_t2', 6], ['pek_t3', 7], ['szx', 8], ['tfu_air', 9], ['pkx_air', 10],
  ['hgh', 11], ['ckg', 11], ['kmg', 11], ['xiy', 11], ['ehu', 12], ['pvg_air', 13], ['plane', 15],
];

// ---------- slides ----------------------------------------------------------------------

async function slideCover() {
  const s = newSlide('fade');
  s.image(await crop('cover', W, H, { fy: 0.4 }), 0, 0, W, H, 'Cover photo', photoInfo.cover.what);
  s.rect(0, 0, W, H, gradient(0, [
    { pos: 0, color: C.bg, alpha: 96 }, { pos: 42, color: C.bg, alpha: 80 }, { pos: 100, color: C.bg, alpha: 22 },
  ]), { name: 'Shade left' });
  s.rect(0, 4.4, W, 3.1, gradient(90, [{ pos: 0, color: C.bg, alpha: 0 }, { pos: 100, color: C.bg, alpha: 90 }]), { name: 'Shade bottom' });

  s.rect(0.9, 2.42, 0.7, 0.06, C.gold, { name: 'Gold bar' });
  s.text("CHINA'S MAJOR AIRPORTS  ·  2025", 0.9, 2.68, 8, 0.3, { fontSize: 13, color: C.gold, charSpacing: 5, fontFace: FONT.num, name: 'Kicker' });
  s.text('中国大型机场', 0.9, 3.08, 10, 1.4, { fontSize: 72, bold: true, color: C.white, name: 'Title' });
  s.text('用数据和实景照片，认识中国最繁忙的航空枢纽', 0.9, 4.62, 10, 0.5, { fontSize: 22, fontFace: FONT.light, color: C.text, name: 'Subtitle' });
  s.text('数据口径：中国民航局《2025 年全国民用运输机场生产统计公报》（不含港澳台地区）', 0.9, 6.72, 9, 0.25, { fontSize: 10.5, color: C.sub, name: 'Scope' });
  s.text(creditText('cover'), W - 0.5 - 5.5, 7.09, 5.5, 0.2, { fontSize: 7.5, color: C.sub, align: 'right', name: 'Credit' });

  s.anim('Cover photo', 'grow', 0, 16000, { by: 1.07 });
  s.anim('Gold bar', 'wipe', 300, 600);
  s.anim('Kicker', 'fade', 500, 700);
  s.anim('Title', 'rise', 800, 1000);
  s.anim('Subtitle', 'rise', 1300, 900);
  s.anim('Scope', 'fade', 2000, 800);
  s.anim('Credit', 'fade', 2000, 800);
}

async function slideNational() {
  const s = newSlide('push');
  s.image(await crop('pek_tower', W, H, { fy: 0.35 }), 0, 0, W, H, 'Background photo', photoInfo.pek_tower.what);
  s.rect(0, 0, W, H, { color: C.bg, transparency: 14 }, { name: 'Shade' });
  heading(s, 'PART 01  ·  全国概览', '2025 年，全国机场旅客吞吐量达 15.29 亿人次');

  s.text('全国民用运输机场旅客吞吐量', 0.7, 2.25, 5.6, 0.3, { fontSize: 13, color: C.sub, name: 'Hero label' });
  s.text([numRun('15.29', { fontSize: 112, bold: true, color: C.gold }), run(' 亿人次', { fontSize: 24, color: C.white })],
    0.7, 2.5, 6.0, 1.75, { name: 'Hero number' });
  s.text('较上年增长 4.8%。旅客吞吐量、货邮吞吐量、飞机起降架次三项指标均为历史新高。', 0.7, 4.5, 5.3, 0.7,
    { fontSize: 13, color: C.text, lineSpacingMultiple: 1.25, name: 'Hero text' });
  s.rect(0.7, 5.42, 5.3, 0.012, C.line, { name: 'Hero divider' });
  s.text([run('国际航线旅客  ', { color: C.sub }), numRun('1.18', { fontSize: 20, bold: true, color: C.white }), run(' 亿人次', { color: C.sub }),
    run('    较上年 ', { color: C.sub }), numRun('+18.7%', { fontSize: 14, color: C.gold })],
    0.7, 5.62, 5.6, 0.45, { fontSize: 12.5, name: 'Hero extra' });

  const tiles = [
    ['270', '个', '颁证运输机场', '其中 266 个开通定期航班'],
    ['41', '个', '千万级机场', '合计占全国旅客吞吐量 83.7%'],
    ['2186.4', '万吨', '货邮吞吐量', '较上年 +9.0%'],
    ['1244.8', '万架次', '飞机起降', '较上年 +0.4%'],
  ];
  tiles.forEach(([value, unit, label, extra], i) => {
    const x = 6.95 + (i % 2) * 2.95;
    const y = 2.25 + Math.floor(i / 2) * 2.0;
    const card = s.rect(x, y, 2.75, 1.8, { color: C.panel, transparency: 12 }, { name: `Tile ${i + 1}` });
    const bar = s.rect(x, y, 2.75, 0.035, C.gold, { name: `Tile ${i + 1} bar` });
    const value_ = s.text([numRun(value, { fontSize: 38, bold: true, color: C.white }), run(' ' + unit, { fontSize: 12, color: C.sub })],
      x + 0.28, y + 0.28, 2.3, 0.7, { name: `Tile ${i + 1} value` });
    const label_ = s.text(label, x + 0.28, y + 1.02, 2.3, 0.28, { fontSize: 13, color: C.text, name: `Tile ${i + 1} label` });
    const extra_ = s.text(extra, x + 0.28, y + 1.35, 2.3, 0.25, { fontSize: 10, color: C.gold, name: `Tile ${i + 1} extra` });
    const d = 900 + i * 140;
    [card, value_, label_, extra_].forEach((n) => s.anim(n, 'rise', d, 650));
    s.anim(bar, 'wipe', d + 250, 500);
  });

  s.anim('Hero label', 'fade', 350, 500);
  s.anim('Hero number', 'zoom', 400, 800);
  s.anim('Hero text', 'fade', 800, 600);
  s.anim('Hero divider', 'wipe', 1000, 600);
  s.anim('Hero extra', 'fade', 1200, 600);
  s.text(creditText('pek_tower'), W - 0.7 - 6, 6.74, 6, 0.2, { fontSize: 7.5, color: C.sub, align: 'right', name: 'Credit' });
  footer(s, 2, { note: SOURCE_NOTE });
}

async function slideTop10() {
  const s = newSlide('fade');
  heading(s, 'PART 01  ·  全国概览', '旅客吞吐量前十：两座机场迈过 8000 万人次');
  const y0 = 2.0;
  const rowH = 0.455;
  const barX = 2.75;
  const barMax = 4.6;
  TOP10.forEach(([name, value, growth], i) => {
    const y = y0 + i * rowH;
    const w = (barMax * value) / TOP10[0][1];
    const rank = s.text(String(i + 1).padStart(2, '0'), 0.7, y + 0.045, 0.4, 0.3, { fontSize: 12, color: C.muted, fontFace: FONT.num, name: `Rank ${i + 1}` });
    const label = s.text(name, 1.15, y + 0.02, 1.5, 0.3, { fontSize: 13.5, color: C.white, name: `Name ${i + 1}` });
    const bar = s.rect(barX, y + 0.075, w, 0.2, value > 8000 ? C.gold : C.bar, { name: `Bar ${i + 1}` });
    const val = s.text([numRun(value.toFixed(1), { fontSize: 13.5, bold: true, color: C.white }), numRun('   ' + growth, { fontSize: 10.5, color: C.sub })],
      barX + w + 0.14, y + 0.03, 1.7, 0.3, { name: `Value ${i + 1}` });
    const d = 500 + i * 90;
    s.anim(rank, 'fade', d, 400);
    s.anim(label, 'fade', d, 400);
    s.anim(bar, 'wipe', d + 80, 700);
    s.anim(val, 'fade', d + 600, 400);
  });
  s.text('单位：万人次；百分比为较上年增幅', 0.7, 6.63, 5, 0.22, { fontSize: 9.5, color: C.muted, name: 'Unit note' });

  const cards = [
    ['8000 万+', '上海浦东、广州白云首次突破 8000 万人次'],
    ['9 座', '年旅客吞吐量超过 5000 万人次；北京大兴、杭州萧山、上海虹桥、重庆江北为首次'],
    ['22.4%', '北京、上海、广州三大城市机场占全国旅客吞吐量的比重'],
  ];
  cards.forEach(([big, text], i) => {
    const x = 9.05;
    const y = 2.0 + i * 1.55;
    const card = s.rect(x, y, 3.58, 1.38, C.panel, { name: `Card ${i + 1}` });
    const bar = s.rect(x, y, 0.045, 1.38, C.gold, { name: `Card ${i + 1} bar` });
    const big_ = s.text(big, x + 0.3, y + 0.16, 3.1, 0.5, { fontSize: 24, bold: true, color: C.gold, fontFace: FONT.num, name: `Card ${i + 1} figure` });
    const text_ = s.text(text, x + 0.3, y + 0.7, 3.05, 0.6, { fontSize: 11, color: C.text, lineSpacingMultiple: 1.2, name: `Card ${i + 1} text` });
    const d = 1500 + i * 200;
    [card, big_, text_].forEach((n) => s.anim(n, 'slide', d, 650));
    s.anim(bar, 'wipe', d + 200, 500, { dir: 'up' });
  });
  footer(s, 3, { note: SOURCE_NOTE });
}

async function slideClusters() {
  const s = newSlide('fade');
  heading(s, 'PART 01  ·  全国概览', '四大机场群：贡献全国一半以上的客流');
  const cw = 2.83;
  const gap = 0.2;
  const y = 1.95;
  CLUSTERS.forEach((c, i) => {
    const x = 0.7 + i * (cw + gap);
    const card = s.rect(x, y, cw, 3.72, C.panel, { name: `Cluster ${i + 1}` });
    const bar = s.rect(x, y, cw, 0.035, C.gold, { name: `Cluster ${i + 1} bar` });
    const name = s.text(c.name, x + 0.28, y + 0.28, cw - 0.4, 0.32, { fontSize: 14.5, bold: true, color: C.white, name: `Cluster ${i + 1} name` });
    const scope = s.text(c.note, x + 0.28, y + 0.64, cw - 0.4, 0.22, { fontSize: 9.5, color: C.muted, name: `Cluster ${i + 1} scope` });
    const value = s.text([numRun(c.value, { fontSize: 50, bold: true, color: C.gold }), run(' 亿人次', { fontSize: 12.5, color: C.sub })],
      x + 0.28, y + 0.95, cw - 0.4, 0.95, { name: `Cluster ${i + 1} value` });
    const growth = s.text([run('较上年 ', { color: C.sub }), numRun(c.growth, { color: C.white, fontSize: 13 })],
      x + 0.28, y + 1.92, cw - 0.4, 0.3, { fontSize: 11.5, name: `Cluster ${i + 1} growth` });
    const div = s.rect(x + 0.28, y + 2.42, cw - 0.56, 0.012, C.line, { name: `Cluster ${i + 1} divider` });
    const tag = s.text('代表机场', x + 0.28, y + 2.6, cw - 0.4, 0.24, { fontSize: 9.5, color: C.muted, name: `Cluster ${i + 1} tag` });
    const list = s.text(c.airports.join('\n'), x + 0.28, y + 2.9, cw - 0.4, 0.62, { fontSize: 11.5, color: C.text, lineSpacingMultiple: 1.25, name: `Cluster ${i + 1} airports` });
    const d = 500 + i * 180;
    [card, name, scope, value, growth, div, tag, list].forEach((n) => s.anim(n, 'rise', d, 700));
    s.anim(bar, 'wipe', d + 300, 500);
  });

  s.text('四大机场群合计 7.85 亿人次，占全国旅客吞吐量的 51.3%（据公报数据计算）', 0.7, 5.95, 9, 0.28, { fontSize: 12, color: C.text, name: 'Share text' });
  const total = W - 1.4;
  s.rect(0.7, 6.4, total, 0.14, C.bar, { name: 'Share track' });
  let sx = 0.7;
  CLUSTERS.forEach((c, i) => {
    const w = (total * c.share) / 100;
    const seg = s.rect(sx, 6.4, w - 0.03, 0.14, C.gold, { name: `Share ${i + 1}` });
    const label = s.text(c.share.toFixed(1) + '%', sx, 6.6, w, 0.22, { fontSize: 9.5, color: C.sub, fontFace: FONT.num, name: `Share ${i + 1} label` });
    s.anim(seg, 'wipe', 1500 + i * 220, 500);
    s.anim(label, 'fade', 1700 + i * 220, 400);
    sx += w;
  });
  s.anim('Share text', 'fade', 1300, 500);
  s.anim('Share track', 'fade', 1300, 500);
  footer(s, 4, { note: SOURCE_NOTE });
}

async function slideAirport(a, page, side, transition) {
  const s = newSlide(transition);
  const pw = 6.1;
  const left = side === 'left';
  const px = left ? 0 : W - pw;
  const x0 = left ? pw + 0.75 : 0.7;
  const cw = W - pw - 0.75 - 0.7;
  const info = photoInfo[a.photo];

  // The "!!" names tell Morph to treat these as the same objects from slide to slide.
  s.image(await crop(a.photo, pw, H, a.focus), px, 0, pw, H, '!!photo', info.what);
  const fadeW = 2.3;
  s.rect(left ? pw - fadeW : px, 0, fadeW, H,
    gradient(0, left
      ? [{ pos: 0, color: C.bg, alpha: 0 }, { pos: 100, color: C.bg, alpha: 100 }]
      : [{ pos: 0, color: C.bg, alpha: 100 }, { pos: 100, color: C.bg, alpha: 0 }]),
    { name: '!!shade' });
  s.rect(px, H - 1.1, pw, 1.1, gradient(90, [{ pos: 0, color: C.bg, alpha: 0 }, { pos: 100, color: C.bg, alpha: 80 }]), { name: '!!shadeBottom' });
  s.text(creditText(a.photo), left ? 0.3 : W - 0.3 - 5.2, 7.14, 5.2, 0.2, { fontSize: 7.5, color: C.sub, align: left ? 'left' : 'right', name: 'Credit' });

  s.text([numRun('NO.' + a.rank, { fontSize: 14, bold: true, color: C.gold }), run('     2025 年旅客吞吐量全国排名', { fontSize: 10.5, color: C.muted })],
    x0, 0.66, cw, 0.3, { name: '!!rank' });
  s.text(a.code, x0 - 0.05, 0.92, cw, 1.3, { fontSize: 84, bold: true, color: C.gold, fontFace: FONT.num, name: '!!code' });
  s.text(a.name, x0, 2.28, cw, 0.6, { fontSize: 30, bold: true, color: C.white, name: 'Name' });
  s.text(a.en, x0, 2.9, cw, 0.25, { fontSize: 10, color: C.muted, charSpacing: 2, fontFace: FONT.num, name: 'English name' });
  s.anim('Name', 'rise', 0, 650);
  s.anim('English name', 'fade', 200, 500);

  const tw = (cw - 0.3) / 3;
  a.stats.forEach(([value, unit, label, extra], i) => {
    const x = x0 + i * (tw + 0.15);
    const y = 3.36;
    const tile = s.rect(x, y, tw, 1.04, C.panel, { name: `Stat ${i + 1}` });
    const bar = s.rect(x, y, tw, 0.03, C.gold, { name: `Stat ${i + 1} bar` });
    const v = s.text([numRun(value, { fontSize: 23, bold: true, color: C.white }), run(' ' + unit, { fontSize: 9.5, color: C.sub })],
      x + 0.16, y + 0.13, tw - 0.2, 0.45, { name: `Stat ${i + 1} value` });
    const l = s.text(label, x + 0.16, y + 0.55, tw - 0.2, 0.22, { fontSize: 10, color: C.sub, name: `Stat ${i + 1} label` });
    const e = s.text(extra, x + 0.16, y + 0.77, tw - 0.2, 0.22, { fontSize: 9, color: C.gold, name: `Stat ${i + 1} extra` });
    const d = 300 + i * 130;
    [tile, v, l, e].forEach((n) => s.anim(n, 'rise', d, 600));
    s.anim(bar, 'wipe', d + 250, 450);
  });

  const perLine = Math.floor((cw - 0.24) / (12 / 72)) - 2; // slack for line-break rules
  let fy = 4.66;
  a.facts.forEach((fact, i) => {
    const lines = Math.ceil(visualLength(fact) / perLine);
    const h = 0.06 + lines * 0.2;
    const dot = s.rect(x0, fy + 0.085, 0.07, 0.07, C.gold, { name: `Fact ${i + 1} dot` });
    const t = s.text(fact, x0 + 0.24, fy, cw - 0.24, h, { fontSize: 12, color: C.text, lineSpacingMultiple: 1.12, name: `Fact ${i + 1}` });
    s.anim(dot, 'fade', 800 + i * 150, 400);
    s.anim(t, 'slide', 800 + i * 150, 550, { offset: left ? 0.03 : -0.03 });
    fy += h + 0.09;
  });
  if (fy > 6.95) throw new Error(`facts overflow on ${a.code}: ${fy.toFixed(2)}`);

  s.text(`${String(page).padStart(2, '0')} / ${TOTAL}`, x0 + cw - 1.4, 7.09, 1.4, 0.22, { fontSize: 9, color: C.muted, align: 'right', fontFace: FONT.num, name: 'Footer page' });
  s.text('PART 02  ·  枢纽巡礼', x0, 7.09, 3, 0.22, { fontSize: 9, color: C.muted, name: 'Footer title' });
}

async function slideMore() {
  const s = newSlide('fade');
  heading(s, 'PART 02  ·  枢纽巡礼', '同样繁忙：四座 5000 万人次上下的枢纽');
  const cw = 2.83;
  const gap = 0.2;
  for (let i = 0; i < MORE.length; i++) {
    const m = MORE[i];
    const x = 0.7 + i * (cw + gap);
    const photo = s.image(await crop(m.photo, cw, 2.5, { ...m.focus, scale: 2 }), x, 1.95, cw, 2.5, `Photo ${i + 1}`, photoInfo[m.photo].what);
    const tag = s.text([numRun(m.rank, { bold: true, color: C.gold }), numRun('    ' + m.code, { color: C.muted })], x, 4.66, cw, 0.25, { fontSize: 12, name: `More ${i + 1} tag` });
    const name = s.text(m.name, x, 4.95, cw, 0.36, { fontSize: 16, bold: true, color: C.white, name: `More ${i + 1} name` });
    const value = s.text([numRun(m.value, { fontSize: 20, bold: true, color: C.white }), run(' 万人次', { fontSize: 10, color: C.sub }), numRun('    ' + m.growth, { fontSize: 11, color: C.gold })],
      x, 5.36, cw, 0.4, { name: `More ${i + 1} value` });
    const fact = s.text(m.fact, x, 5.83, cw - 0.1, 0.7, { fontSize: 10.5, color: C.sub, lineSpacingMultiple: 1.2, name: `More ${i + 1} fact` });
    const d = 500 + i * 200;
    s.anim(photo, 'zoom', d, 800);
    [tag, name, value, fact].forEach((n, k) => s.anim(n, 'rise', d + 250 + k * 80, 600));
  }
  s.text('另：上海虹桥机场以 5015.1 万人次居全国第 8 位（较上年 +4.6%），同样是首次突破 5000 万人次。', 0.7, 6.62, 11.9, 0.25, { fontSize: 10.5, color: C.text, name: 'Hongqiao note' });
  s.anim('Hongqiao note', 'fade', 1900, 600);
  const credits = MORE.map((m) => `${photoInfo[m.photo].artist} / ${photoInfo[m.photo].license}`).join('  ·  ');
  footer(s, 11, { note: '图（左起）：' + credits });
}

async function slideCargo() {
  const s = newSlide('fade');
  const pw = 5.3;
  const px = W - pw;
  s.image(await crop('ehu', pw, H, { fx: 0.72, fy: 0.5 }), px, 0, pw, H, 'Cargo photo', photoInfo.ehu.what);
  s.rect(px, 0, 2.2, H, gradient(0, [{ pos: 0, color: C.bg, alpha: 100 }, { pos: 100, color: C.bg, alpha: 0 }]), { name: 'Photo shade' });
  s.rect(px, H - 1.1, pw, 1.1, gradient(90, [{ pos: 0, color: C.bg, alpha: 0 }, { pos: 100, color: C.bg, alpha: 80 }]), { name: 'Photo shade bottom' });
  s.text(creditText('ehu'), W - 0.3 - 5, 7.14, 5, 0.2, { fontSize: 7.5, color: C.sub, align: 'right', name: 'Credit' });
  const cw = px - 0.7 - 0.2;
  heading(s, 'PART 03  ·  货运与世界坐标', '货运：六座机场超过 100 万吨', { w: cw });

  const y0 = 2.05;
  const rowH = 0.5;
  const barX = 2.75;
  const barMax = 3.3;
  CARGO.forEach(([name, value, growth], i) => {
    const y = y0 + i * rowH;
    const w = (barMax * value) / CARGO[0][1];
    const rank = s.text(String(i + 1).padStart(2, '0'), 0.7, y + 0.045, 0.4, 0.3, { fontSize: 12, color: C.muted, fontFace: FONT.num, name: `Rank ${i + 1}` });
    const label = s.text(name, 1.15, y + 0.02, 1.5, 0.3, { fontSize: 13.5, color: C.white, name: `Name ${i + 1}` });
    const bar = s.rect(barX, y + 0.075, w, 0.2, i === 0 ? C.gold : C.bar, { name: `Bar ${i + 1}` });
    const val = s.text([numRun(value.toFixed(1), { fontSize: 13.5, bold: true, color: C.white }), numRun('   ' + growth, { fontSize: 10.5, color: C.sub })],
      barX + w + 0.14, y + 0.03, 1.7, 0.3, { name: `Value ${i + 1}` });
    const d = 500 + i * 110;
    s.anim(rank, 'fade', d, 400);
    s.anim(label, 'fade', d, 400);
    s.anim(bar, 'wipe', d + 80, 700);
    s.anim(val, 'fade', d + 600, 400);
  });
  s.text('2025 年货邮吞吐量，单位：万吨；百分比为较上年增幅', 0.7, 5.08, 6, 0.22, { fontSize: 9.5, color: C.muted, name: 'Unit note' });

  const notes = [
    '深圳宝安首次突破 200 万吨；鄂州花湖、郑州新郑首次突破 100 万吨',
    '鄂州花湖机场 2022 年 7 月 17 日投运，是亚洲首个专业货运枢纽机场',
    '货邮吞吐量 10 万吨以上的机场共 35 个，合计占全国的 93.6%',
  ];
  notes.forEach((note, i) => {
    const y = 5.55 + i * 0.4;
    const dot = s.rect(0.7, y + 0.085, 0.07, 0.07, C.gold, { name: `Note ${i + 1} dot` });
    const t = s.text(note, 0.94, y, cw - 0.24, 0.3, { fontSize: 12, color: C.text, name: `Note ${i + 1}` });
    s.anim(dot, 'fade', 1500 + i * 160, 400);
    s.anim(t, 'slide', 1500 + i * 160, 550, { offset: -0.03 });
  });
  footer(s, 12, { w: cw, note: '' });
}

async function slideWorld() {
  const s = newSlide('push');
  s.image(await crop('pvg_air', W, H, { fy: 0.5 }), 0, 0, W, H, 'Background photo', photoInfo.pvg_air.what);
  s.rect(0, 0, W, H, { color: C.bg, transparency: 18 }, { name: 'Shade' });
  heading(s, 'PART 03  ·  货运与世界坐标', '世界坐标：三座中国机场的全球位次');
  const cw = 3.83;
  const gap = 0.22;
  WORLD.forEach((a, i) => {
    const x = 0.7 + i * (cw + gap);
    const y = 2.0;
    const card = s.rect(x, y, cw, 3.9, { color: C.panel, transparency: 10 }, { name: `World ${i + 1}` });
    const bar = s.rect(x, y, cw, 0.035, C.gold, { name: `World ${i + 1} bar` });
    const name = s.text([run(a.name, { fontSize: 20, bold: true, color: C.white }), numRun('   ' + a.code, { fontSize: 13, color: C.muted })],
      x + 0.32, y + 0.3, cw - 0.5, 0.45, { name: `World ${i + 1} name` });
    const parts = [card, name];
    a.rows.forEach(([label, place], k) => {
      const ry = y + 1.0 + k * 0.92;
      parts.push(s.rect(x + 0.32, ry, cw - 0.64, 0.012, C.line, { name: `World ${i + 1} line ${k + 1}` }));
      parts.push(s.text(label, x + 0.32, ry + 0.34, 1.9, 0.3, { fontSize: 13, color: C.text, name: `World ${i + 1} label ${k + 1}` }));
      parts.push(s.text([run('全球第 ', { fontSize: 12, color: C.sub }), numRun(place, { fontSize: 36, bold: true, color: C.gold }), run(' 位', { fontSize: 12, color: C.sub })],
        x + cw - 0.32 - 1.9, ry + 0.12, 1.9, 0.7, { align: 'right', name: `World ${i + 1} place ${k + 1}` }));
    });
    if (a.note) {
      const ry = y + 1.0 + a.rows.length * 0.92;
      parts.push(s.rect(x + 0.32, ry, cw - 0.64, 0.012, C.line, { name: `World ${i + 1} note line` }));
      parts.push(s.text(a.note, x + 0.32, ry + 0.34, cw - 0.64, 0.3, { fontSize: 12, color: C.sub, name: `World ${i + 1} note` }));
    }
    const d = 500 + i * 220;
    parts.forEach((n) => s.anim(n, 'rise', d, 700));
    s.anim(bar, 'wipe', d + 300, 500);
  });
  s.text('来源：国际机场协会（ACI World）2026 年 4 月发布的 2025 年全球机场初步排名，最终数据可能略有调整。香港国际机场不在民航局公报的统计范围内。',
    0.7, 6.2, 11.9, 0.5, { fontSize: 10.5, color: C.sub, lineSpacingMultiple: 1.2, name: 'World source' });
  s.anim('World source', 'fade', 1500, 600);
  footer(s, 13, { note: creditText('pvg_air') });
}

async function slideTimeline() {
  const s = newSlide('fade');
  heading(s, 'PART 03  ·  扩建进行时', '新一轮扩建：跑道与航站楼密集投运');
  const total = W - 1.4;
  const col = total / TIMELINE.length;
  const lineY = 3.55;
  s.rect(0.7, lineY, total, 0.02, C.gold, { name: 'Timeline' });
  s.anim('Timeline', 'wipe', 400, 1400);
  TIMELINE.forEach((t, i) => {
    const x = 0.7 + i * col;
    const node = s.rect(x + 0.02, lineY - 0.065, 0.15, 0.15, t.pending ? C.bg : C.gold,
      { name: `Node ${i + 1}`, rotate: 45, line: { color: C.gold, width: 1.25 } });
    const date = s.text(t.date, x, 2.78, col - 0.15, 0.45, { fontSize: 19, bold: true, color: t.pending ? C.sub : C.gold, fontFace: t.pending ? FONT.cn : FONT.num, name: `Date ${i + 1}` });
    const who = s.text(t.who, x, 3.98, col - 0.15, 0.4, { fontSize: 17, bold: true, color: C.white, name: `Who ${i + 1}` });
    const what = s.text(t.what, x, 4.48, col - 0.3, 1.6, { fontSize: 12, color: C.sub, lineSpacingMultiple: 1.25, name: `What ${i + 1}` });
    const d = 500 + i * 230;
    s.anim(node, 'zoom', d, 400);
    s.anim(date, 'fade', d + 100, 500);
    s.anim(who, 'rise', d + 150, 600);
    s.anim(what, 'rise', d + 220, 600);
  });
  s.text('时间均为官方公布的启用、投运日期；浦东机场 T3 航站楼的建成时间为计划目标。', 0.7, 6.45, 11.9, 0.3, { fontSize: 10.5, color: C.muted, name: 'Timeline note' });
  s.anim('Timeline note', 'fade', 2100, 600);
  footer(s, 14, { note: '资料来源：各机场及机场集团官网、相关地方政府网站、新华社等公开报道' });
}

async function slideEnd() {
  const s = newSlide('fade');
  s.image(await crop('plane', W, H, { fx: 0.5, fy: 0.45 }), 0, 0, W, H, 'End photo', photoInfo.plane.what);
  s.rect(0, 0, W, H, { color: C.bg, transparency: 72 }, { name: 'Shade' });
  s.rect(0, 3.6, W, 3.9, gradient(90, [{ pos: 0, color: C.bg, alpha: 0 }, { pos: 100, color: C.bg, alpha: 92 }]), { name: 'Shade bottom' });
  s.rect(0.9, 4.42, 0.7, 0.06, C.gold, { name: 'Gold bar' });
  s.text('谢谢观看', 0.9, 4.62, 8, 1.1, { fontSize: 54, bold: true, color: C.white, name: 'Thanks' });
  s.text([numRun('270', { color: C.gold, fontSize: 18, bold: true }), run(' 个运输机场      '), numRun('15.29', { color: C.gold, fontSize: 18, bold: true }), run(' 亿人次旅客      '),
    numRun('41', { color: C.gold, fontSize: 18, bold: true }), run(' 个千万级机场')],
    0.9, 5.82, 10, 0.4, { fontSize: 13, color: C.text, name: 'Recap' });
  s.text('中国大型机场  ·  2025 年数据', 0.9, 6.72, 6, 0.25, { fontSize: 10.5, color: C.sub, name: 'Scope' });
  s.text(creditText('plane'), W - 0.5 - 6, 7.09, 6, 0.2, { fontSize: 7.5, color: C.sub, align: 'right', name: 'Credit' });
  s.anim('End photo', 'grow', 0, 16000, { by: 1.07 });
  s.anim('Gold bar', 'wipe', 300, 600);
  s.anim('Thanks', 'rise', 500, 900);
  s.anim('Recap', 'fade', 1200, 800);
  s.anim('Scope', 'fade', 1600, 800);
}

async function slideSources() {
  const s = newSlide('fade');
  heading(s, '附录', '数据与图片来源');
  s.text('数据', 0.7, 1.95, 5.6, 0.3, { fontSize: 13, bold: true, color: C.gold, name: 'Data heading' });
  const data = [
    ['吞吐量、排名与增幅', '中国民用航空局《2025 年全国民用运输机场生产统计公报》及两个附件，2026 年 2 月 26 日发布。统计范围不含港澳台地区；“国际航线”不含港澳台地区航线。'],
    ['全球排名', '国际机场协会（ACI World）2025 年全球最繁忙机场初步排名，2026 年 4 月 14 日发布。'],
    ['设施与时间节点', '各机场及机场集团官网、中国民航局与相关地方政府网站、新华社等公开报道。'],
    ['计算说明', '机场群占全国比重、北京与成都“两场合计”等，为根据公报数据计算所得；“首次突破”为与上年及历史数据对比的结论。'],
  ];
  let y = 2.35;
  data.forEach(([label, text], i) => {
    const lines = Math.ceil(visualLength(text) / (Math.floor(5.6 / (10.5 / 72)) - 2));
    const l = s.text(label, 0.7, y, 5.6, 0.25, { fontSize: 11, bold: true, color: C.white, name: `Data ${i + 1} label` });
    const t = s.text(text, 0.7, y + 0.28, 5.6, lines * 0.22 + 0.05, { fontSize: 10.5, color: C.sub, lineSpacingMultiple: 1.2, name: `Data ${i + 1} text` });
    s.anim(l, 'fade', 500 + i * 150, 500);
    s.anim(t, 'fade', 500 + i * 150, 500);
    y += 0.28 + lines * 0.22 + 0.22;
  });

  const x = 6.95;
  const w = W - 0.7 - x;
  s.text('图片', x, 1.95, w, 0.3, { fontSize: 13, bold: true, color: C.gold, name: 'Photo heading' });
  const lines = PHOTO_PAGES.map(([key, page]) => {
    const p = photoInfo[key];
    return [numRun(`P${String(page).padStart(2, '0')}   `, { color: C.gold }), run(`${p.what} — ${p.artist}，${p.license}`, { breakLine: true })];
  }).flat();
  s.text(lines, x, 2.35, w, 3.5, { fontSize: 9, color: C.sub, lineSpacingMultiple: 1.33, name: 'Photo list' });
  s.text('图片均来自维基共享资源（Wikimedia Commons），按所列许可协议使用，作了裁剪并叠加暗色蒙版。转发或公开使用本文件时，请保留本页署名。',
    x, 5.95, w, 0.6, { fontSize: 10, color: C.text, lineSpacingMultiple: 1.25, name: 'Photo note' });
  s.anim('Data heading', 'fade', 400, 500);
  s.anim('Photo heading', 'fade', 400, 500);
  s.anim('Photo list', 'fade', 700, 700);
  s.anim('Photo note', 'fade', 1100, 600);
  footer(s, 16);
}

// ---------- build -----------------------------------------------------------------------

(async () => {
  fs.mkdirSync(IMG, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  await slideCover();
  await slideNational();
  await slideTop10();
  await slideClusters();
  for (let i = 0; i < AIRPORTS.length; i++) {
    await slideAirport(AIRPORTS[i], 5 + i, i % 2 === 0 ? 'left' : 'right', i === 0 ? 'fade' : 'morph');
  }
  await slideMore();
  await slideCargo();
  await slideWorld();
  await slideTimeline();
  await slideEnd();
  await slideSources();
  if (specs.length !== TOTAL) throw new Error(`expected ${TOTAL} slides, built ${specs.length}`);

  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
  let effects = 0;
  for (let i = 0; i < specs.length; i++) {
    const name = `ppt/slides/slide${i + 1}.xml`;
    zip.file(name, decorateSlide(await zip.file(name).async('string'), specs[i]));
    effects += specs[i].effects.length;
  }
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(OUT_FILE, out);
  console.log(`${OUT_FILE}  ${(out.length / 1048576).toFixed(1)} MB, ${specs.length} slides, ${effects} animation effects`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
