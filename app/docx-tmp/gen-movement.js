const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Footer
} = require('docx');

const CJK = 'Microsoft YaHei';
const font = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: CJK };

function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }); }
function p(t) { return new Paragraph({ children: [new TextRun(t)], spacing: { after: 120 } }); }
function bullet(t) { return new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun(t)], spacing: { after: 60 } }); }
function pruns(items) { return new Paragraph({ children: items.map(i => new TextRun({ text: i.t, bold: !!i.b })), spacing: { after: 120 } }); }

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };

function table(widths, headers, rows, fill = 'D5E8F0') {
  const head = new TableRow({ cantSplit: true, tableHeader: true,
    children: headers.map((c, i) => new TableCell({ borders, width: { size: widths[i], type: WidthType.DXA },
      shading: { fill, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })] })) });
  const body = rows.map(r => new TableRow({ cantSplit: true,
    children: r.map((cell, i) => new TableCell({ borders, width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun(cell)] })] })) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths, rows: [head, ...body] });
}

const children = [];

children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: 'Fire Roach Killer V2.6 — 蟑螂移动范围文档', bold: true, size: 40, font })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: '地面阻挡线 · 防线坐标 · 地面/飞行蟑螂可移动范围 · 基于源码 scene-rules.ts / engine.ts / RoachAISystem.ts · 2026-08-15', size: 22, color: '666666', font })] }));

// 1 关键坐标
children.push(h1('1. 关键坐标与画布参数'));
children.push(table(
  [2800, 3760, 2800],
  ['参数', '值', '来源'],
  [
    ['画布逻辑尺寸', '540 x 960（宽 x 高）', 'engine.ts:976 resize()'],
    ['防线 Y 坐标', '830（960 - 130）', 'engine.ts:1129 defenseLineY()'],
    ['地面边界 X 缩放比 wr', 'width / 540', 'engine.ts:2797 getGroundBoundsAtY()'],
    ['玩家基准 Y', '1060（屏幕外下方）', 'engine.ts:1127'],
    ['场上敌人上限', '40 只', 'engine.ts:2845 spawnRoach()'],
  ]
));
children.push(p('所有坐标均在 540x960 逻辑坐标系中运算，最终通过 ctx.setTransform 按屏幕高度自动缩放到物理像素。窄屏时 width < 540，地面边界 X 值通过 wr 按比例缩窄。'));

// 2 地面边界6点配置
children.push(h1('2. 地面边界 6 点透视配置'));
children.push(pruns([{ t: '数据格式：', b: true }, { t: '[farL, farLY, farR, farRY, midL, midLY, midR, midRY, nearL, nearR, nearY]' }]));
children.push(bullet('farL/farLY：左侧远点（屏幕上方，最窄处）'));
children.push(bullet('farR/farRY：右侧远点'));
children.push(bullet('midL/midLY：左侧中点（far 与 near 之间的折线转折点）'));
children.push(bullet('midR/midRY：右侧中点'));
children.push(bullet('nearL/nearR：左/右侧近点 X（屏幕下方，最宽处，靠近防线）'));
children.push(bullet('nearY：近点 Y（两侧共用）'));
children.push(p('每侧形成 2 段折线：far -> mid -> near，产生透视效果。getGroundBoundsAtY(y) 根据当前 Y 在对应段内线性插值得到左右 X 边界。'));

children.push(h2('2.1 各场景地面边界原始数据'));
children.push(table(
  [900, 850, 850, 850, 850, 850, 850, 850, 850, 850, 850, 750],
  ['场景', 'farL', 'farLY', 'farR', 'farRY', 'midL', 'midLY', 'midR', 'midRY', 'nearL', 'nearR', 'nearY'],
  [
    ['厨房', '200', '450', '400', '450', '100', '625', '465', '625', '0', '530', '800'],
    ['下水道', '310', '388', '471', '384', '50', '435', '470', '454', '50', '470', '810'],
    ['垃圾场', '98', '392', '342', '442', '141', '669', '446', '612', '140', '461', '810'],
    ['地下室', '200', '450', '350', '450', '100', '625', '450', '625', '0', '530', '800'],
    ['天台', '150', '400', '380', '400', '75', '600', '455', '600', '0', '530', '800'],
    ['街道', '250', '450', '300', '450', '125', '625', '425', '625', '0', '530', '800'],
    ['医院', '232', '416', '333', '449', '141', '512', '401', '486', '50', '490', '810'],
    ['地铁', '58', '472', '190', '472', '58', '530', '456', '530', '58', '456', '810'],
    ['超市', '200', '430', '380', '430', '90', '610', '450', '610', '0', '530', '800'],
    ['学校', '210', '435', '370', '435', '95', '615', '455', '615', '0', '530', '800'],
    ['巢穴', '170', '410', '370', '410', '70', '590', '470', '590', '0', '530', '800'],
  ]
));

// 3 地面蟑螂可移动范围
children.push(h1('3. 地面蟑螂可移动范围'));
children.push(pruns([{ t: 'Y 范围：', b: true }, { t: 'farY（最高生成点）-> 防线 830（突破点）。生成 Y = farY + random x (nearY - farY) x 0.6。' }]));
children.push(pruns([{ t: 'X 范围：', b: true }, { t: '在 farY 处最窄，在 nearY 处最宽；Y 超过 nearY 后保持 nearY 处边界。X 钳制：r.x = max(gLeft+5, min(gRight-5, r.x))。' }]));
children.push(p('farY = min(farLY, farRY, midLY, midRY)（engine.ts:2875）。'));

children.push(h2('3.1 各场景地面蟑螂移动范围汇总'));
children.push(table(
  [900, 700, 700, 1000, 1000, 1000, 1000, 800],
  ['场景', 'farY', 'nearY', '生成Y范围', 'far点X范围', 'near点X范围', 'near处宽度', '防线Y'],
  [
    ['厨房', '450', '800', '450~660', '200~400', '0~530', '530', '830'],
    ['下水道', '384', '810', '384~640', '310~471', '50~470', '420', '830'],
    ['垃圾场', '392', '810', '392~640', '98~342', '140~461', '321', '830'],
    ['地下室', '450', '800', '450~660', '200~350', '0~530', '530', '830'],
    ['天台', '400', '800', '400~580', '150~380', '0~530', '530', '830'],
    ['街道', '450', '800', '450~660', '250~300', '0~530', '530', '830'],
    ['医院', '416', '810', '416~652', '232~333', '50~490', '440', '830'],
    ['地铁', '472', '810', '472~675', '58~190', '58~456', '398', '830'],
    ['超市', '430', '800', '430~628', '200~380', '0~530', '530', '830'],
    ['学校', '435', '800', '435~633', '210~370', '0~530', '530', '830'],
    ['巢穴', '410', '800', '410~578', '170~370', '0~530', '530', '830'],
  ]
));
children.push(p('注：far点X范围为远端边界近似值（取 farL~farR）；near点X范围为近端精确值（nearL~nearR）。窄屏时所有X值乘以 wr=width/540。'));

children.push(h2('3.2 场景特征分析'));
children.push(table(
  [1200, 4080, 4080],
  ['场景', '通道特征', '战术影响'],
  [
    ['厨房', '远窄近宽梯形，近端全宽530', '标准场景，地面蟑螂分散面广'],
    ['下水道', '远端偏右(310~471)，近端左移(50~470)', '不规则走廊，远端集中右侧'],
    ['垃圾场', '远端极窄(98~342)，近端偏左(140~461)', '最窄通道(321px)，火力集中度高'],
    ['街道', '远端极窄(250~300)，近端全宽', '远端瓶颈50px，蟑螂密集后扩散'],
    ['医院', '窄走廊(440px)，远端偏左', '通道受限，护士生成于远端416'],
    ['地铁', '远端极窄(58~190)，近端右扩(58~456)', '平台式通道，护盾编队先就位'],
  ]
));

// 4 飞行蟑螂可移动范围
children.push(h1('4. 飞行蟑螂可移动范围'));
children.push(p('飞行类（飞行蟑螂、飞行自爆、地铁精英）不受地面边界约束，可在整个画布内自由移动。'));

children.push(h2('4.1 Y 轴范围'));
children.push(table(
  [2200, 2600, 2200, 2360],
  ['类型', '生成Y范围', '可移动Y范围', '来源'],
  [
    ['飞行/飞行自爆', '288~480（heightx0.3 + randomxheightx0.2）', '0~960（全画布）', 'engine.ts:2856'],
    ['地铁精英', '336~528（heightx0.35 + randomxheightx0.2）', '0~960（全画布）', 'engine.ts:2862'],
  ]
));
children.push(p('超出画布边缘 ±100px 时被推回（RoachAISystem.ts:540-542）；Y 超过 canvasHeight+200 时拉回防线下方。'));

children.push(h2('4.2 X 轴范围'));
children.push(p('X 钳制：r.x = max(edgeMargin, min(canvasWidth - edgeMargin, r.x))，其中 edgeMargin = max(40, size x 0.8)。'));
children.push(table(
  [1800, 900, 1200, 2200, 3260],
  ['类型', 'size', 'edgeMargin', 'X范围(width=540)', '来源'],
  [
    ['飞行蟑螂', '32', '40', '40~500', 'RoachAISystem.ts:568-570'],
    ['飞行自爆', '55', '44', '44~496', 'RoachAISystem.ts:568-570'],
    ['地铁精英', '32', '40', '40~500', 'RoachAISystem.ts:568-570'],
  ]
));

children.push(h2('4.3 飞行冲刺机制'));
children.push(bullet('触发条件：距防线 < 150px（flyingChargeDist）时开始冲刺'));
children.push(bullet('速度倍率：chargeSpeed = flyingChargeSpeed(2.5) x (1 - distToDefense / 150)，越接近防线倍率越高'));
children.push(bullet('最高速度：baseSpeed x (1 + 2.5) = baseSpeed x 3.5'));
children.push(bullet('冲刺方向：朝防线俯冲（moveAngle 偏向防线方向）'));

// 5 速度换算
children.push(h1('5. 速度换算为像素/秒'));
children.push(pruns([{ t: '核心公式：', b: true }, { t: 'px/s = speed x waveSpeed x difficultyMult x random(0.7~1.0) x 65' }]));
children.push(p('其中 65 是硬编码基础速度常量（RoachAISystem.ts:479），waveSpeed 范围 0.35（波次1厨房）~ 1.0（波次6地铁），困难模式 difficultyMult=1.1。'));
children.push(table(
  [1800, 1000, 1600, 2000, 2960],
  ['蟑螂', 'def.speed', '基础px/s(speedx65)', '波次1实际(px/s)', '波次6实际(px/s)'],
  [
    ['小蟑螂', '1.0', '65', '约23(x0.35)', '约65(x1.0)'],
    ['大蟑螂', '0.8', '52', '约18', '约52'],
    ['飞行蟑螂', '2.4', '156', '约55', '约156'],
    ['装甲蟑螂', '0.5', '32.5', '约11', '约33'],
    ['自爆蟑螂', '1.4', '91', '约32', '约91'],
    ['女王', '0.3', '19.5', '约7', '约20'],
  ]
));
children.push(p('注：上表按简单模式、随机系数=1.0 计算；实际每只蟑螂有 0.7~1.0 随机系数，困难模式额外 x1.1。'));

// 6 游荡与闪避
children.push(h1('6. 游荡幅度与闪避参数'));
children.push(h2('6.1 游荡幅度（逻辑像素）'));
children.push(table(
  [2800, 3760, 2800],
  ['类型', '游荡幅度', '来源'],
  [
    ['地面蟑螂', '30 px（groundWanderAmplitude）', 'enemies.ts:331'],
    ['飞行蟑螂', '80 px（flyingWanderAmplitude）', 'enemies.ts:330'],
  ]
));
children.push(p('游荡通过 sin(wobbleOffset + time x wobbleSpeed) x amplitude 叠加到 targetX，使蟑螂在前进时左右摇摆。'));

children.push(h2('6.2 闪避速度（px/s，不再乘65）'));
children.push(table(
  [2800, 3760, 2800],
  ['类型', '闪避速度', '来源'],
  [
    ['分裂子蟑螂', '250 px/s（splitChildSpeed）', 'enemies.ts:322'],
    ['小蟑螂', '180 px/s（smallSpeed）', 'enemies.ts:321'],
    ['自爆蟑螂', '100 px/s（suicideSpeed）', 'enemies.ts:323'],
  ]
));
children.push(p('闪避时直接覆盖 vx = dodgeDir x dodgeSpeed（RoachAISystem.ts:499-509），不经过 speedx65 换算。'));

children.push(h2('6.3 触发距离（逻辑像素）'));
children.push(table(
  [3000, 2000, 4360],
  ['参数', '值', '语义'],
  [
    ['flyingChargeDist', '150 px', '飞行蟑螂冲刺触发（距防线）'],
    ['groundTriggerDist', '150 px', '地面自爆引信触发'],
    ['flyingTriggerDist', '80 px', '飞行自爆引信触发'],
    ['edgeRepelDist', '120 px', '地面蟑螂边缘排斥距离'],
    ['forceApproachDist', '50 px', '强制接近防线距离'],
    ['edgeStopMargin', '80 px', '边缘停止余量'],
  ]
));

// 7 渲染尺寸
children.push(h1('7. 蟑螂渲染尺寸（逻辑像素）'));
children.push(p('size 字段直接用于渲染，宽度 = size x bodyWidthRatio(1.2)。'));
children.push(table(
  [2200, 900, 1200, 1200, 1200, 2660],
  ['类型', 'size', '宽(w)', '高(h)', 'Boss缩放', '说明'],
  [
    ['小蟑螂', '28', '33.6', '28', '-', '基础单位'],
    ['大蟑螂', '40', '48', '40', '-', '狂暴时速度x2'],
    ['飞行蟑螂', '32', '38.4', '32', '-', '飞行'],
    ['装甲蟑螂', '76', '91.2', '76', '-', '护甲吸收80%'],
    ['分裂蟑螂', '42', '50.4', '42', '-', '死亡分裂5只'],
    ['自爆蟑螂', '60', '72', '60', '-', '自爆半径100px'],
    ['飞行自爆', '55', '66', '55', '-', '飞行+自爆'],
    ['女王(普通)', '160', '192', '160', '-', '非Boss战'],
    ['女王(Boss)', '160', '1152', '960', 'x6(bossScale)', 'Boss战专用'],
    ['护士蟑螂', '78', '93.6', '78', '-', '医院专属'],
    ['变异蟑螂', '38', '45.6', '38', '-', '医院专属'],
    ['定时自爆', '60', '72', '60', '-', '医院专属'],
    ['隧道工', '84', '100.8', '84', '-', '地铁专属'],
    ['地铁精英', '32', '38.4', '32', '-', '地铁专属'],
    ['护盾蟑螂', '88', '105.6', '88', '-', '地铁专属'],
  ]
));

// 8 对比总结
children.push(h1('8. 地面 vs 飞行蟑螂移动范围对比'));
children.push(table(
  [1800, 3780, 3760],
  ['维度', '地面蟑螂', '飞行蟑螂'],
  [
    ['Y 范围', 'farY~830（场景依赖，约384~830）', '0~960（全画布）'],
    ['X 范围', '透视折线约束（随Y动态插值）', '屏幕边缘margin内自由(40~500)'],
    ['生成 Y', 'farY + 60%区间', '画布上1/3区域(288~528)'],
    ['游荡幅度', '30 px', '80 px'],
    ['火墙阻挡', '可阻挡（y被钳制到wallTop）', '不可阻挡'],
    ['边界源', 'getGroundBoundsAtY()', 'max(40, size x 0.8)'],
    ['冲刺', '无（仅自爆引信触发）', '距防线150px时速度x3.5'],
    ['边缘处理', 'getGroundBoundsAtY钳制X', '推回屏幕内(±100px)'],
  ]
));

const doc = new Document({
  styles: {
    default: { document: { run: { font, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font, color: '1F4E79' },
        paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 0, keepNext: false, keepLines: false } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font, color: '2E74B5' },
        paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1, keepNext: false, keepLines: false } },
    ],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun('第 '), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun(' 页')] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('D:/CocosGreater/Fire Roach KillerV2.6/app/docs/蟑螂移动范围文档.docx', buffer);
  console.log('OK');
});