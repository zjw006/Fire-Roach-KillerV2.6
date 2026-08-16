const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Footer
} = require('docx');

const CJK = 'Microsoft YaHei';
const font = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: CJK };

// ---------- helpers ----------
function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}
function p(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun(text)];
  return new Paragraph({ children: runs, spacing: { after: 120 }, ...opts });
}
function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun(text)],
    spacing: { after: 60 },
  });
}
function mono(text) {
  return new TextRun({ text, font: { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: CJK }, size: 20 });
}
function bold(text) {
  return new TextRun({ text, bold: true });
}
// paragraph with mixed runs: array of {t, b, m}
function pruns(items) {
  return new Paragraph({
    children: items.map(i => new TextRun({
      text: i.t,
      bold: !!i.b,
      font: i.m ? { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: CJK } : font,
      size: i.m ? 20 : 22,
    })),
    spacing: { after: 120 },
  });
}

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };

function table(widths, headerCells, bodyRows, headerFill = 'D5E8F0') {
  const headRow = new TableRow({
    cantSplit: true,
    tableHeader: true,
    children: headerCells.map((c, i) => new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: headerFill, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })],
    })),
  });
  const body = bodyRows.map(r => new TableRow({
    cantSplit: true,
    children: r.map((cell, i) => new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: Array.isArray(cell) ? cell : [new Paragraph({ children: [new TextRun(cell)] })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: [headRow, ...body],
  });
}

// total content width for US Letter with 1" margins = 9360 DXA
const W = 9360;

// ---------- document content ----------
const children = [];

// Title
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
  children: [new TextRun({ text: 'VFX 参数集中化 — 修改总结', bold: true, size: 40, font })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: 'Fire Roach Killer V2.6 · 2026-08-13 ~ 2026-08-15', size: 22, color: '666666', font })],
}));

// 1 Overview
children.push(h1('1. 总览'));
children.push(p('本次修改将游戏中所有视觉特效（VFX）的颜色、透明度、叠加混合方式从各渲染文件中硬编码的值集中到统一的配置文件 src/game/data/vfx-balance.ts，实现单一数据源管理，方便后续调参。'));
children.push(pruns([{ t: '核心原则：', b: true }, { t: '所有特效参数通过围 BALANCE_CONFIG 路径访问，渲染代码不再包含硬编码的颜色、透明度或混合模式值。' }]));

children.push(table(
  [1800, 2760, 3600, 1200],
  ['类别', '配置路径前缀', '覆盖范围', '状态'],
  [
    ['粒子系统', 'render.particleType.*', '12 种粒子类型的 blend/渐隐色/透明度系数', '已完成'],
    ['火枪特效', 'render.fireZone.*', '火焰颜色、透明度、辉光、blend、喷锥/喷嘴渐变', '已完成'],
    ['掉落道具', 'render.drop.*', '粘液/武器/道具箱 blend、包裹凝胶、粘板染色', '已完成'],
    ['商店道具', 'render.renderUtils.*', '雷达激光、杀虫剂喷锥、苍蝇拍、火墙、放置预览', '已完成'],
    ['怪物技能', 'render.roach.*', '护士光环、治疗环、变异、护甲、粘液爆发、Boss 等', '已完成'],
    ['天气特效', 'weather.* / lightning.* / render.background.*', '雨、雾、闪电、夜晚遮罩、暗角', '已完成'],
    ['特效编辑器', 'effectDefs.ts / EffectLabPage.tsx', '参数面板同步、blend 下拉选择', '已完成'],
  ]
));

// 2 Particle
children.push(h1('2. 粒子系统集中化'));
children.push(p('新增 render.particleType 配置节，集中管理 12 种粒子类型的叠加混合方式、渐隐色和透明度系数。'));
children.push(table(
  [1500, 1500, 3960, 2400],
  ['粒子类型', 'blend', '渐隐色 / 特殊参数', 'alphaScale'],
  [
    ['fire', 'screen', 'fadeColor: 255,50,0（橙红）', '0.7'],
    ['smoke', 'source-over', 'fadeColor: 80,80,80（灰）', '0.5'],
    ['ember', 'screen', 'shadowBlur: 6', '—'],
    ['ash', 'source-over', '—', '—'],
    ['spark', 'screen / textBlend: source-over', 'shadowBlur: 4', '—'],
    ['blood', 'source-over', 'coreColor: 10,60,10, coreAlphaRatio:0.3, coreSizeRatio:0.5', '—'],
    ['ice', 'screen', 'fadeColor: 200,250,255（冰蓝）', '0.8'],
    ['poisonCloud', 'screen', 'fadeColor: 150,100,255（紫）', '0.6'],
    ['slime', 'source-over', 'fadeColor: 40,120,40, glowColor/glowAlpha/glowBlur', '—'],
    ['explosion', 'screen', 'fadeColor: 255,100,0（橙）', '—'],
    ['lightning', 'screen', 'shadowBlur: 10', '—'],
    ['rain', 'source-over', '—', '0.4'],
  ]
));
children.push(p([{ t: '修改文件：', b: true }, { t: 'ParticleSystem.ts（renderParticles 各 case 分支改用 BALANCE_CONFIG.render.particleType.*）', m: true }]));

// 3 Weapon
children.push(h1('3. 火枪特效集中化'));
children.push(h2('3.1 火焰区域（render.fireZone）'));
children.push(table(
  [2800, 6560],
  ['参数', '说明'],
  [
    ['flameDefaultFirst / flameDefaultSecond', '默认火焰两段插值 RGB 基值+范围（蓝→红）'],
    ['flameSticky / flamePoison / flameShotgun', '各武器类型火焰 RGB 基值+范围'],
    ['flameAlphaBase', '火焰透明度基值（原硬编码 0.75）'],
    ['coreGradAlpha0/1/2', '核心辉光渐变三档透明度'],
    ['coreGradEndColor', '核心辉光末端颜色'],
    ['boostRippleColor', '强化波纹颜色'],
    ['blend', '火焰区域叠加方式（screen）'],
  ]
));
children.push(h2('3.2 喷锥/喷嘴渐变（render.renderUtils.insecticide）'));
children.push(table(
  [2800, 6560],
  ['参数', '说明'],
  [
    ['sprayConeColor0~3', '杀虫剂喷锥径向渐变 4 档颜色'],
    ['nozzleGlowColor0/1', '喷嘴辉光径向渐变 2 档颜色'],
  ]
));
children.push(p([{ t: '修改文件：', b: true }, { t: 'BackgroundRenderer.ts（fireZone）、RenderUtils.ts（sprayCone/nozzleGlow 渐变缓存）', m: true }]));

// 4 Drop
children.push(h1('4. 掉落道具集中化'));
children.push(table(
  [2400, 6960],
  ['配置路径', '集中化参数'],
  [
    ['render.drop.sticky', 'blend, attachedStrokeColor, stuckTintColor, stuckTintAlpha; wrap.blend, glowColor0/1/2, bodyColor/bodyAlpha, borderColor/borderAlpha, specularColor/specularAlpha, bubbleColor/bubbleAlphaBase/bubbleAlphaAmp'],
    ['render.drop.weapon', 'blend, baseSize, labelFont, labelColor, labelOffsetY 等'],
    ['render.drop.item', 'blend, 标签样式等'],
  ]
));
children.push(p([{ t: '修改文件：', b: true }, { t: 'DropRenderer.ts、RoachRenderer.ts（stuckTintColor / wrappedByDropId 包裹凝胶）', m: true }]));

// 5 Shop
children.push(h1('5. 商店道具集中化'));
children.push(table(
  [1700, 3000, 4660],
  ['特效', '配置路径', '集中化参数'],
  [
    ['雷达激光', 'render.renderUtils.radarLaser', 'blend, colorBody, fadeInDuration, baseAlpha, pulseFreq, pulseAmp, outerGlowAlpha/Width, innerCoreWidth, dotRadius, dotAlpha'],
    ['杀虫剂喷锥', 'render.renderUtils.insecticide', 'sprayConeColor0~3, nozzleGlowColor0/1'],
    ['苍蝇拍', 'render.swatter', 'blend, 各颜色/透明度'],
    ['火墙', 'render.fireWall', 'blend, segments, 各颜色'],
    ['放置预览', 'render.placementPreview', 'blend, 颜色/透明度'],
  ]
));
children.push(p([{ t: '修改文件：', b: true }, { t: 'RenderUtils.ts、engine.ts（火墙 blend）', m: true }]));

// 6 Monster
children.push(h1('6. 怪物技能集中化'));
children.push(table(
  [1700, 3000, 4660],
  ['特效', '配置路径', '集中化参数要点'],
  [
    ['护士治疗光环', 'render.roach.nurseHealRing', 'blend, charge/spray/dissipate 透明度, gradColor 三档, stroke/innerFill/dash 颜色与透明度'],
    ['护士施法光圈', 'render.roach.nurseCastRing', 'blend, 各颜色/透明度/几何参数'],
    ['变异变身', 'render.roach.mutantTransform', 'blend, swirlColor, swirlAlpha, shadow, innerRing'],
    ['护甲六边形环', 'render.roach.shield', 'normalBlend(lighter), timedSuicideBlend(lighter), 各颜色/几何参数'],
    ['隧道工施法光圈', 'render.roach.armorCastRing', 'blend, duration, startScale, maxAlpha, colorMid/Edge/Tip, 各渐变/描边参数'],
    ['粘液爆发', 'render.roach.slimeBurst', 'blend, 各颜色/透明度'],
    ['突破预警', 'render.roach.breachWarning', 'blend, 颜色/透明度'],
    ['定时炸弹', 'render.roach.timedBomb', 'blend, 引信/爆炸颜色/透明度'],
    ['Boss 覆盖层', 'render.roach.bossOverlay', 'blend, 各颜色/透明度'],
    ['狂暴指示', 'render.roach.enrageIndicator', 'blend, 颜色/透明度'],
    ['眩晕效果', 'render.roach.stunEffect', 'blend, 颜色/透明度'],
    ['中毒指示', 'render.roach.poisonIndicator', 'blend, 颜色/透明度'],
    ['自爆引信', 'render.roach.suicideFuse', 'blend, 颜色/透明度'],
  ]
));
children.push(p([{ t: '修改文件：', b: true }, { t: 'RoachRenderer.ts、RoachAISystem.ts（armorSprayCastTimer 驱动）', m: true }]));

// 7 Weather
children.push(h1('7. 天气特效集中化'));
children.push(table(
  [1700, 3000, 4660],
  ['特效', '配置路径', '集中化参数'],
  [
    ['雨滴', 'weather.rain', 'blend, 颜色/透明度/线宽/拖尾'],
    ['雾团', 'weather.fog', 'blend, 颜色/透明度'],
    ['闪电全屏闪光', 'lightning', 'flashColor, flashBlend'],
    ['夜晚遮罩', 'render.background', 'nightBlend'],
    ['暗角', 'render.background', 'vignetteBlend'],
  ]
));
children.push(p([{ t: '修改文件：', b: true }, { t: 'WeatherSystem.ts、BackgroundRenderer.ts（lightning flash / nightBlend / vignetteBlend）', m: true }]));

// 8 Editor
children.push(h1('8. 特效编辑器同步'));
children.push(h2('8.1 新增功能'));
children.push(bullet('粒子叠加方式下拉选择 — 扩散粒子设置框新增"叠加方式"下拉框（lighter / screen / source-over / multiply），写入 sparks.blend'));
children.push(bullet('施法光环参数节 — 护甲喷涂预制体新增"施法警示光圈（armorCastRing）"参数节，自动生成全部字段控件'));
children.push(bullet('颜色值实时预览 — 颜色通道字符串（如 59,130,246）和 blend 值在文本框中直接编辑，实时反映到预览'));
children.push(bullet('参数面板自动同步 — effectDefs.ts 中注册的参数节自动写入 BALANCE_CONFIG，游戏与编辑器同源'));
children.push(h2('8.2 关键变更'));
children.push(table(
  [1200, 3400, 4760],
  ['变更', '文件', '说明'],
  [
    ['新增', 'effectDefs.ts', '新增 ARMOR_CAST_RING_SECTIONS 常量，注册施法警示光圈参数节'],
    ['新增', 'effectDefs.ts', 's_armor_spray 预制体参数节列表前置 ARMOR_CAST_RING_SECTIONS'],
    ['修改', 'EffectLabPage.tsx', '扩散粒子设置框新增"叠加方式"下拉选择'],
    ['修改', 'prefabRuntime.ts', 'sparks.blend 传入粒子渲染逻辑'],
  ]
));

// 9 Color changes
children.push(h1('9. 颜色变更记录'));
children.push(table(
  [2000, 2000, 2560, 2800],
  ['特效', '参数', '原值', '新值'],
  [
    ['隧道工施法光环', 'colorMid', '148,163,184（灰蓝）', '59,130,246（蓝 #3b82f6）'],
    ['隧道工施法光环', 'colorEdge', '203,213,225（浅灰蓝）', '56,189,248（亮蓝 #38bdf8）'],
    ['隧道工施法光环', 'colorTip', '226,232,240（近白）', '186,230,253（浅蓝 #bae6fd）'],
    ['定时自爆护盾', 'timedSuicideBlend', 'source-over', 'lighter'],
  ]
));
children.push(p('施法光环最终改为蓝色系，与护盾光带一致；定时自爆护盾与普通护盾统一为 lighter 提亮。'));

// 10 Files
children.push(h1('10. 修改文件清单'));
children.push(table(
  [2200, 4200, 2960],
  ['文件', '路径', '修改类型'],
  [
    ['vfx-balance.ts', 'src/game/data/vfx-balance.ts', '大量新增'],
    ['ParticleSystem.ts', 'src/game/engine/particle/ParticleSystem.ts', '重构'],
    ['RoachRenderer.ts', 'src/game/engine/render/RoachRenderer.ts', '重构'],
    ['BackgroundRenderer.ts', 'src/game/engine/render/BackgroundRenderer.ts', '重构'],
    ['RenderUtils.ts', 'src/game/engine/render/RenderUtils.ts', '重构'],
    ['DropRenderer.ts', 'src/game/engine/render/DropRenderer.ts', '重构'],
    ['WeatherSystem.ts', 'src/game/engine/weather/WeatherSystem.ts', '重构'],
    ['NurseRenderer.ts', 'src/game/engine/render/NurseRenderer.ts', '重构'],
    ['RoachAISystem.ts', 'src/game/engine/ai/RoachAISystem.ts', '修改'],
    ['ParticleSpawner.ts', 'src/game/engine/particle/ParticleSpawner.ts', '修改'],
    ['items.ts', 'src/game/data/items.ts', '修改'],
    ['effectDefs.ts', 'src/pages/effect-lab/effectDefs.ts', '新增'],
    ['EffectLabPage.tsx', 'src/pages/effect-lab/EffectLabPage.tsx', '修改'],
    ['prefabRuntime.ts', 'src/pages/effect-lab/prefabRuntime.ts', '修改'],
    ['prefabDefs.ts', 'src/pages/effect-lab/prefabDefs.ts', '修改'],
  ]
));

// 11 Verification
children.push(h1('11. 验证结果'));
children.push(bullet('npm run build — 构建成功（vite build + esbuild api/boot.ts）'));
children.push(bullet('tsc -b — 所有涉及文件（vfx-balance, WeatherSystem, BackgroundRenderer, ParticleSystem, RoachRenderer, DropRenderer, RenderUtils, NurseRenderer, effect-lab）无类型错误'));
children.push(pruns([{ t: '使用方式：', b: true }, { t: '修改 src/game/data/vfx-balance.ts 中任意参数值，保存后 Vite 热更新自动加载，游戏和特效编辑器同步生效，无需修改任何渲染代码。' }]));

// ---------- build ----------
const doc = new Document({
  styles: {
    default: {
      document: { run: { font, size: 22 } },
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font, color: '1F4E79' },
        paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 0, keepNext: false, keepLines: false } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font, color: '2E74B5' },
        paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1, keepNext: false, keepLines: false } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font, color: '2E74B5' },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2, keepNext: false, keepLines: false } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun('第 '), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun(' 页')] })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('D:/CocosGreater/Fire Roach KillerV2.6/app/vfx-centralization-summary.docx', buffer);
  console.log('OK written');
});