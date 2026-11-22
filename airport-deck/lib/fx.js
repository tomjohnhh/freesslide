// OOXML pieces that PptxGenJS cannot produce: gradient fills, slide transitions and
// entrance/emphasis animations. Everything here works on the generated slide XML.

const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const NS_P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
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

function transitionXml(kind) {
  switch (kind) {
    case 'morph':
      // Morph needs PowerPoint 2019 / 365 (or a recent WPS); older viewers play the fade fallback.
      return (
        `<mc:AlternateContent xmlns:mc="${NS_MC}">` +
        `<mc:Choice xmlns:p159="${NS_P159}" Requires="p159">` +
        `<p:transition spd="slow" p14:dur="1600" xmlns:p14="${NS_P14}"><p159:morph option="byObject"/></p:transition>` +
        `</mc:Choice>` +
        `<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback>` +
        `</mc:AlternateContent>`
      );
    case 'push':
      return `<p:transition spd="slow"><p:push dir="u"/></p:transition>`;
    case 'cover':
      return `<p:transition spd="slow"><p:cover dir="l"/></p:transition>`;
    case 'fade':
      return `<p:transition spd="med"><p:fade/></p:transition>`;
    default:
      return '';
  }
}

// ---------- animations ------------------------------------------------------------------

const WIPE = { left: ['8', 'wipe(left)'], right: ['2', 'wipe(right)'], up: ['1', 'wipe(up)'], down: ['4', 'wipe(down)'] };

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
    // PowerPoint keeps a build entry (grpId) for auto shapes and text boxes, not for pictures.
    let grp = '';
    if (shape.kind === 'sp' && fx.type !== 'grow') {
      grp = ' grpId="0"';
      built.set(spid, byPara || built.get(spid) === true);
    }

    const show =
      `<p:set><p:cBhvr><p:cTn id="${id()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${tgt}` +
      `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
    const effect = (filter, d = dur) =>
      `<p:animEffect transition="in" filter="${filter}"><p:cBhvr><p:cTn id="${id()}" dur="${d}"/>${tgt}</p:cBhvr></p:animEffect>`;
    const prop = (attr, from, to, ease) =>
      `<p:anim calcmode="lin" valueType="num"><p:cBhvr><p:cTn id="${id()}" dur="${dur}"${ease ? ' decel="100000"' : ''} fill="hold"/>${tgt}` +
      `<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst>` +
      `<p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav>` +
      `<p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`;

    let preset;
    let cls = 'entr';
    let subtype = '0';
    let body;
    const parId = id();
    switch (fx.type) {
      case 'fade':
        preset = 10;
        body = show + effect('fade');
        break;
      case 'wipe': {
        const [sub, filter] = WIPE[fx.dir || 'left'];
        preset = 22;
        subtype = sub;
        body = show + effect(filter);
        break;
      }
      case 'rise': {
        // "Float up": fade while sliding up into place.
        const off = fx.offset || 0.05;
        preset = 42;
        body = show + effect('fade') + prop('ppt_x', '#ppt_x', '#ppt_x') + prop('ppt_y', `#ppt_y+${off}`, '#ppt_y', true);
        break;
      }
      case 'slide': {
        // Fade while sliding in horizontally; positive offset = from the right.
        const off = fx.offset || 0.04;
        const from = off >= 0 ? `#ppt_x+${off}` : `#ppt_x-${-off}`;
        preset = 42;
        body = show + effect('fade') + prop('ppt_x', from, '#ppt_x', true) + prop('ppt_y', '#ppt_y', '#ppt_y');
        break;
      }
      case 'zoom':
        preset = 53;
        subtype = '16';
        body = show + prop('ppt_w', '#ppt_w*0.86', '#ppt_w', true) + prop('ppt_h', '#ppt_h*0.86', '#ppt_h', true) + effect('fade');
        break;
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
      default:
        throw new Error(`unknown animation type: ${fx.type}`);
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

/** Maps object name -> { id, kind } for every shape / picture on a slide. */
function shapeIndex(xml) {
  const shapes = new Map();
  const re = /<p:(sp|pic|cxnSp)>\s*<p:nv(?:Sp|Pic|CxnSp)Pr>\s*<p:cNvPr id="(\d+)" name="([^"]*)"/g;
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
  xml = styleBullets(applyGradients(xml), spec.bulletColor || 'FFFFFF');
  const extra = transitionXml(spec.transition) + timingXml(spec.effects || [], shapeIndex(xml));
  const anchor = '</p:clrMapOvr>';
  if (!xml.includes(anchor)) throw new Error('slide XML has no clrMapOvr anchor');
  return xml.replace(anchor, anchor + extra);
}

module.exports = { gradient, decorateSlide, shapeIndex, BULLET_CODE };
