// OOXML pieces that PptxGenJS cannot produce: gradient fills, slide transitions and
// entrance / emphasis / exit / motion-path animations. Everything here works on the
// generated slide XML.

const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const NS_P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
const NS_P15 = 'http://schemas.microsoft.com/office/powerpoint/2012/main';
const NS_P159 = 'http://schemas.microsoft.com/office/powerpoint/2015/09/main';

// ---------- gradients -------------------------------------------------------------------

const gradients = new Map();

/**
 * Registers a linear gradient and returns a marker colour. Use the marker as a normal
 * solid fill; `applyGradients` swaps it for the real gradient afterwards.
 * angle: degrees, 0 = left to right, 90 = top to bottom.
 * stops: [{ pos: 0..100, color: 'RRGGBB', alpha: 0..100 (opacity) }]
 */
function gradient(angle, stops) {
  const marker = 'FE' + String(gradients.size + 1).padStart(4, '0');
  const gs = stops
    .map((s) => {
      const alpha = s.alpha === undefined || s.alpha >= 100 ? '' : `<a:alpha val="${Math.round(s.alpha * 1000)}"/>`;
      return `<a:gs pos="${Math.round(s.pos * 1000)}"><a:srgbClr val="${s.color}">${alpha}</a:srgbClr></a:gs>`;
    })
    .join('');
  gradients.set(
    marker,
    `<a:gradFill rotWithShape="1"><a:gsLst>${gs}</a:gsLst><a:lin ang="${Math.round(angle * 60000)}" scaled="0"/></a:gradFill>`
  );
  return marker;
}

function applyGradients(xml) {
  for (const [marker, grad] of gradients) {
    xml = xml.split(`<a:solidFill><a:srgbClr val="${marker}"/></a:solidFill>`).join(grad);
  }
  return xml;
}

// ---------- bullets ---------------------------------------------------------------------

// PptxGenJS can only emit a plain bullet character; give it the accent colour and a
// smaller size. `BULLET_CODE` is the character code to pass as `bullet.characterCode`.
const BULLET_CODE = '25A0';

function styleBullets(xml, color) {
  return xml
    .split(`<a:buSzPct val="100000"/><a:buChar char="&#x${BULLET_CODE};"/>`)
    .join(`<a:buClr><a:srgbClr val="${color}"/></a:buClr><a:buSzPct val="60000"/><a:buFont typeface="Arial"/><a:buChar char="&#x${BULLET_CODE};"/>`);
}

// ---------- transitions -----------------------------------------------------------------

// Transitions every PowerPoint / WPS version understands.
const BASIC_TRANSITIONS = {
  fade: ['med', '<p:fade/>'],
  fadeBlack: ['slow', '<p:fade thruBlk="1"/>'],
  push: ['slow', '<p:push dir="u"/>'],
  pushLeft: ['slow', '<p:push dir="l"/>'],
  cover: ['slow', '<p:cover dir="l"/>'],
  uncover: ['slow', '<p:pull dir="l"/>'],
  wipe: ['slow', '<p:wipe dir="r"/>'],
  wipeDown: ['slow', '<p:wipe dir="d"/>'],
  split: ['slow', '<p:split orient="vert" dir="out"/>'],
  splitIn: ['slow', '<p:split orient="horz" dir="in"/>'],
  blinds: ['slow', '<p:blinds dir="vert"/>'],
  zoom: ['slow', '<p:zoom dir="in"/>'],
  circle: ['slow', '<p:circle/>'],
  diamond: ['slow', '<p:diamond/>'],
  dissolve: ['slow', '<p:dissolve/>'],
  wheel: ['slow', '<p:wheel spokes="4"/>'],
  wedge: ['slow', '<p:wedge/>'],
  strips: ['slow', '<p:strips dir="rd"/>'],
  comb: ['slow', '<p:comb dir="horz"/>'],
  newsflash: ['slow', '<p:newsflash/>'],
};

// PowerPoint 2010+ transitions: [duration ms, element, fallback basic transition].
const P14_TRANSITIONS = {
  vortex: [2400, '<p14:vortex dir="r"/>', 'fade'],
  ripple: [1600, '<p14:ripple/>', 'circle'],
  prism: [1400, '<p14:prism isContent="1"/>', 'push'],
  cube: [1400, '<p14:prism/>', 'pushLeft'],
  glitter: [2400, '<p14:glitter pattern="hexagon" dir="l"/>', 'dissolve'],
  flythrough: [1200, '<p14:flythrough/>', 'zoom'],
  pan: [1200, '<p14:pan dir="u"/>', 'push'],
  doors: [1400, '<p14:doors dir="vert"/>', 'split'],
  window: [1400, '<p14:window dir="horz"/>', 'split'],
  ferris: [1400, '<p14:ferris dir="l"/>', 'pushLeft'],
  gallery: [1600, '<p14:gallery dir="l"/>', 'pushLeft'],
  conveyor: [1600, '<p14:conveyor dir="l"/>', 'pushLeft'],
  reveal: [2000, '<p14:reveal/>', 'fade'],
  shred: [1600, '<p14:shred pattern="strip" dir="in"/>', 'blinds'],
  honeycomb: [2400, '<p14:honeycomb/>', 'dissolve'],
  flash: [800, '<p14:flash/>', 'fade'],
  flip: [1200, '<p14:flip dir="l"/>', 'cover'],
  switch: [1200, '<p14:switch dir="r"/>', 'cover'],
  warp: [1200, '<p14:warp dir="in"/>', 'zoom'],
};

// PowerPoint 2013+ preset transitions: [duration ms, preset name, fallback].
const P15_TRANSITIONS = {
  airplane: [1600, 'airplane', 'push'],
  origami: [1600, 'origami', 'wipe'],
  curtains: [2200, 'curtains', 'split'],
  wind: [1600, 'wind', 'wipe'],
  prestige: [1600, 'prestige', 'fade'],
  fracture: [2000, 'fracture', 'dissolve'],
  crush: [1800, 'crush', 'fade'],
  peelOff: [1400, 'peelOff', 'uncover'],
  pageCurl: [1400, 'pageCurlDouble', 'uncover'],
  drape: [1600, 'drape', 'wipeDown'],
  fallOver: [1400, 'fallOver', 'cover'],
};

function basicTransition(kind) {
  const [spd, el] = BASIC_TRANSITIONS[kind];
  return `<p:transition spd="${spd}">${el}</p:transition>`;
}

function transitionXml(kind) {
  if (!kind) return '';
  if (kind === 'morph') {
    // Morph needs PowerPoint 2019 / 365 (or a recent WPS); older viewers play the fade fallback.
    return (
      `<mc:AlternateContent xmlns:mc="${NS_MC}">` +
      `<mc:Choice xmlns:p159="${NS_P159}" Requires="p159">` +
      `<p:transition spd="slow" p14:dur="1600" xmlns:p14="${NS_P14}"><p159:morph option="byObject"/></p:transition>` +
      `</mc:Choice>` +
      `<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback>` +
      `</mc:AlternateContent>`
    );
  }
  if (BASIC_TRANSITIONS[kind]) return basicTransition(kind);
  if (P14_TRANSITIONS[kind]) {
    const [dur, el, fallback] = P14_TRANSITIONS[kind];
    return (
      `<mc:AlternateContent xmlns:mc="${NS_MC}">` +
      `<mc:Choice xmlns:p14="${NS_P14}" Requires="p14">` +
      `<p:transition spd="slow" p14:dur="${dur}">${el}</p:transition>` +
      `</mc:Choice>` +
      `<mc:Fallback>${basicTransition(fallback)}</mc:Fallback>` +
      `</mc:AlternateContent>`
    );
  }
  if (P15_TRANSITIONS[kind]) {
    const [dur, prst, fallback] = P15_TRANSITIONS[kind];
    return (
      `<mc:AlternateContent xmlns:mc="${NS_MC}">` +
      `<mc:Choice xmlns:p15="${NS_P15}" Requires="p15">` +
      `<p:transition spd="slow" p14:dur="${dur}" xmlns:p14="${NS_P14}"><p15:prstTrans prst="${prst}"/></p:transition>` +
      `</mc:Choice>` +
      `<mc:Fallback>${basicTransition(fallback)}</mc:Fallback>` +
      `</mc:AlternateContent>`
    );
  }
  throw new Error(`unknown transition: ${kind}`);
}

// ---------- animations ------------------------------------------------------------------

const WIPE = { left: ['8', 'wipe(left)'], right: ['2', 'wipe(right)'], up: ['1', 'wipe(up)'], down: ['4', 'wipe(down)'] };

// Entrance effects that are a single animated filter: [presetID, presetSubtype, filter].
const FILTER_ENTRANCES = {
  blinds: [3, 10, 'blinds(horizontal)'],
  box: [4, 32, 'box(out)'],
  checker: [5, 10, 'checkerboard(across)'],
  circle: [6, 32, 'circle(out)'],
  diamond: [8, 32, 'diamond(out)'],
  dissolve: [9, 0, 'dissolve'],
  plus: [13, 32, 'plus(out)'],
  randombar: [14, 10, 'randombar(horizontal)'],
  split: [16, 37, 'barn(outVertical)'],
  splitH: [16, 42, 'barn(outHorizontal)'],
  strips: [18, 6, 'strips(downRight)'],
  wedge: [20, 0, 'wedge'],
  wheel: [21, 1, 'wheel(1)'],
  wheel4: [21, 4, 'wheel(4)'],
};

// Fly-in start positions: [presetSubtype, attribute, off-slide expression].
const FLY = {
  left: ['8', 'ppt_x', '0-#ppt_w/2'],
  right: ['2', 'ppt_x', '1+#ppt_w/2'],
  top: ['1', 'ppt_y', '0-#ppt_h/2'],
  bottom: ['4', 'ppt_y', '1+#ppt_h/2'],
};

function timingXml(effects, shapes) {
  if (!effects.length) return '';
  let nextId = 5;
  const id = () => nextId++;
  const built = new Map(); // spid -> animated paragraph by paragraph?

  const pars = effects.map((fx) => {
    const shape = shapes.get(fx.target);
    if (!shape) throw new Error(`animation target not found on slide: ${fx.target}`);
    const spid = shape.id;
    const byPara = fx.para !== undefined;
    const tgt = byPara
      ? `<p:tgtEl><p:spTgt spid="${spid}"><p:txEl><p:pRg st="${fx.para}" end="${fx.para}"/></p:txEl></p:spTgt></p:tgtEl>`
      : `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;
    const dur = fx.dur || 600;
    const isEntrance = !['grow', 'pulse', 'spin', 'path', 'fadeOut', 'flyOut'].includes(fx.type);
    // PowerPoint keeps a build entry (grpId) for auto shapes and text boxes, not for pictures.
    let grp = '';
    if (shape.kind === 'sp' && isEntrance) {
      grp = ' grpId="0"';
      built.set(spid, byPara || built.get(spid) === true);
    }

    const setVisibility = (value, delay) =>
      `<p:set><p:cBhvr><p:cTn id="${id()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst></p:cTn>${tgt}` +
      `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${value}"/></p:to></p:set>`;
    const show = () => setVisibility('visible', 0);
    const effect = (filter, d = dur, transition = 'in') =>
      `<p:animEffect transition="${transition}" filter="${filter}"><p:cBhvr><p:cTn id="${id()}" dur="${d}"/>${tgt}</p:cBhvr></p:animEffect>`;
    const prop = (attr, from, to, ease) =>
      `<p:anim calcmode="lin" valueType="num"><p:cBhvr><p:cTn id="${id()}" dur="${dur}"${ease === 'in' ? ' accel="100000"' : ease ? ' decel="100000"' : ''} fill="hold"/>${tgt}` +
      `<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst>` +
      `<p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav>` +
      `<p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`;
    const repeat = fx.repeat ? ` repeatCount="${fx.repeat === 'forever' ? 'indefinite' : Math.round(fx.repeat * 1000)}"` : '';

    let preset;
    let cls = 'entr';
    let subtype = '0';
    let body;
    const parId = id();
    switch (fx.type) {
      case 'fade':
        preset = 10;
        body = show() + effect('fade');
        break;
      case 'wipe': {
        const [sub, filter] = WIPE[fx.dir || 'left'];
        preset = 22;
        subtype = sub;
        body = show() + effect(filter);
        break;
      }
      case 'rise': {
        // "Float up": fade while sliding up into place.
        const off = fx.offset || 0.05;
        preset = 42;
        body = show() + effect('fade') + prop('ppt_x', '#ppt_x', '#ppt_x') + prop('ppt_y', `#ppt_y+${off}`, '#ppt_y', true);
        break;
      }
      case 'slide': {
        // Fade while sliding in horizontally; positive offset = from the right.
        const off = fx.offset || 0.04;
        const from = off >= 0 ? `#ppt_x+${off}` : `#ppt_x-${-off}`;
        preset = 42;
        body = show() + effect('fade') + prop('ppt_x', from, '#ppt_x', true) + prop('ppt_y', '#ppt_y', '#ppt_y');
        break;
      }
      case 'zoom':
        preset = 53;
        subtype = '16';
        body = show() + prop('ppt_w', '#ppt_w*0.86', '#ppt_w', true) + prop('ppt_h', '#ppt_h*0.86', '#ppt_h', true) + effect('fade');
        break;
      case 'fly': {
        // "Fly in" from a slide edge.
        const [sub, attr, from] = FLY[fx.dir || 'bottom'];
        preset = 2;
        subtype = sub;
        body =
          show() +
          (attr === 'ppt_x'
            ? prop('ppt_x', from, '#ppt_x', true) + prop('ppt_y', '#ppt_y', '#ppt_y')
            : prop('ppt_x', '#ppt_x', '#ppt_x') + prop('ppt_y', from, '#ppt_y', true));
        break;
      }
      case 'grow': {
        // Slow "Ken Burns" enlargement of a picture.
        const by = Math.round((fx.by || 1.06) * 100000);
        preset = 6;
        cls = 'emph';
        body =
          `<p:animScale><p:cBhvr><p:cTn id="${id()}" dur="${dur}" fill="hold"/>${tgt}</p:cBhvr>` +
          `<p:by x="${by}" y="${by}"/></p:animScale>`;
        break;
      }
      case 'pulse': {
        // Grow a little and return ("pulse" emphasis).
        const by = Math.round((fx.by || 1.1) * 100000);
        preset = 6;
        cls = 'emph';
        body =
          `<p:animScale><p:cBhvr><p:cTn id="${id()}" dur="${dur}" autoRev="1" fill="hold"${repeat}/>${tgt}</p:cBhvr>` +
          `<p:by x="${by}" y="${by}"/></p:animScale>`;
        break;
      }
      case 'spin': {
        const by = Math.round((fx.turns || 1) * 21600000);
        preset = 8;
        cls = 'emph';
        body =
          `<p:animRot by="${by}"><p:cBhvr><p:cTn id="${id()}" dur="${dur}" fill="hold"${repeat}/>${tgt}` +
          `<p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>`;
        break;
      }
      case 'path': {
        // Custom motion path. `path` uses slide fractions relative to the object's position,
        // e.g. "M 0 0 L 0.3 -0.1 E".
        preset = 0;
        cls = 'path';
        const ease = fx.ease === false ? '' : ' accel="30000" decel="40000"';
        body =
          `<p:animMotion origin="layout" path="${fx.path}" pathEditMode="relative">` +
          `<p:cBhvr><p:cTn id="${id()}" dur="${dur}"${ease} fill="hold"/>${tgt}` +
          `<p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr></p:animMotion>`;
        break;
      }
      case 'fadeOut':
        preset = 10;
        cls = 'exit';
        body = effect('fade', dur, 'out') + setVisibility('hidden', dur - 1);
        break;
      case 'flyOut': {
        const [sub, attr, to] = FLY[fx.dir || 'right'];
        preset = 2;
        cls = 'exit';
        subtype = sub;
        const off = to.replace(/#/g, '');
        body =
          (attr === 'ppt_x' ? prop('ppt_x', 'ppt_x', off, 'in') + prop('ppt_y', 'ppt_y', 'ppt_y') : prop('ppt_x', 'ppt_x', 'ppt_x') + prop('ppt_y', 'ppt_y', off, 'in')) +
          setVisibility('hidden', dur - 1);
        break;
      }
      default: {
        const filter = FILTER_ENTRANCES[fx.type];
        if (!filter) throw new Error(`unknown animation type: ${fx.type}`);
        preset = filter[0];
        subtype = String(filter[1]);
        body = show() + effect(filter[2]);
      }
    }

    return (
      `<p:par><p:cTn id="${parId}" presetID="${preset}" presetClass="${cls}" presetSubtype="${subtype}" fill="hold"${grp} nodeType="withEffect">` +
      `<p:stCondLst><p:cond delay="${fx.delay || 0}"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par>`
    );
  });

  const bld = built.size
    ? `<p:bldLst>${[...built]
        .map(([spid, byPara]) => `<p:bldP spid="${spid}" grpId="0" ${byPara ? 'build="p"' : 'animBg="1"'}/>`)
        .join('')}</p:bldLst>`
    : '';

  // One click-less sequence: everything starts by itself when the slide appears.
  return (
    `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
    `<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>` +
    `<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>` +
    `<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    pars.join('') +
    `</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>${bld}</p:timing>`
  );
}

/**
 * PptxGenJS numbers charts and tables independently of other shapes, which can produce
 * two objects with the same id on one slide. Give every graphic frame an id of its own.
 */
function uniqueFrameIds(xml) {
  let next = 9000;
  return xml.replace(/(<p:graphicFrame>\s*<p:nvGraphicFramePr>\s*<p:cNvPr id=")\d+(")/g, (m, a, b) => `${a}${++next}${b}`);
}

/** Maps object name -> { id, kind } for every shape / picture / chart on a slide. */
function shapeIndex(xml) {
  const shapes = new Map();
  const re = /<p:(sp|pic|cxnSp|graphicFrame)>\s*<p:nv(?:Sp|Pic|CxnSp|GraphicFrame)Pr>\s*<p:cNvPr id="(\d+)" name="([^"]*)"/g;
  let m;
  while ((m = re.exec(xml))) {
    const name = m[3].replace(/&amp;/g, '&');
    if (shapes.has(name)) throw new Error(`duplicate object name on one slide: ${name}`);
    shapes.set(name, { id: m[2], kind: m[1] });
  }
  return shapes;
}

/** Adds gradients, the transition and the animation timeline to one slide's XML. */
function decorateSlide(xml, spec) {
  xml = uniqueFrameIds(styleBullets(applyGradients(xml), spec.bulletColor || 'FFFFFF'));
  const extra = transitionXml(spec.transition) + timingXml(spec.effects || [], shapeIndex(xml));
  const anchor = '</p:clrMapOvr>';
  if (!xml.includes(anchor)) throw new Error('slide XML has no clrMapOvr anchor');
  return xml.replace(anchor, anchor + extra);
}

module.exports = { gradient, decorateSlide, shapeIndex, BULLET_CODE };
