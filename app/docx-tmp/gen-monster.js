const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Footer
} = require('docx');

const CJK = 'Microsoft YaHei';
const font = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: CJK };

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] }); }
function p(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun(text)];
  return new Paragraph({ children: runs, spacing: { after: 120 }, ...opts });
}
function bullet(text) {
  return new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun(text)], spacing: { after: 60 } });
}
function bold(text) { return new TextRun({ text, bold: true }); }
function pruns(items) {
  return new Paragraph({ children: items.map(i => new TextRun({ text: i.t, bold: !!i.b })), spacing: { after: 120 } });
}

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };

function table(widths, headerCells, bodyRows, headerFill = 'D5E8F0') {
  const headRow = new TableRow({
    cantSplit: true, tableHeader: true,
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
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths, rows: [headRow, ...body] });
}

// 生成"技能详情"表格：两列（技能/说明）
function skillTable(rows) {
  return table([1400, 7960], ['技能', '详细说明'], rows);
}
// 生成"属性"表格：两列（属性/数值）
function statTable(rows) {
  return table([1400, 7960], ['属性', '数值'], rows);
}

const children = [];

// Title
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: 'Fire Roach Killer V2.6 — 怪物属性与技能文档', bold: true, size: 40, font })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: '《灭蟑行动》蟑螂图鉴 · 基于源码 enemies.ts / encyclopedia.ts · 2026-08-15', size: 22, color: '666666', font })] }));

// 1 总览
children.push(h1('1. 怪物系统总览'));
children.push(p('游戏共有 14 种蟑螂单位，按场景逐步解锁。所有怪物的基础属性（HP、速度、奖励、体型、颜色）统一定义于 ENEMY_DEFS，是战斗系统（RoachAISystem）与图鉴（ENCYCLOPEDIA_DEFS）的共享数据源；AI 行为参数集中定义于 BALANCE_ENEMIES。'));
children.push(p('实际战斗数值会随难度缩放：敌方强度 × 场景 enemyModifier；击杀奖励 × 场景 rewardMultiplier × 难度系数。'));
children.push(pruns([{ t: '属性字段说明：', b: true }, { t: 'HP 为基础血量；Speed 为移动速度系数（1.0 = 基准）；Reward 为击杀奖励金币；Size 为渲染大小（像素）；Special 为特殊能力标签（驱动 AI 行为）。' }]));

// 2 属性总表
children.push(h1('2. 怪物基础属性总表'));
children.push(table(
  [1600, 900, 1000, 900, 900, 4060],
  ['怪物', 'HP', '速度', '奖励', '体型', '特殊能力'],
  [
    ['小蟑螂', '1', '1.0', '1', '28', '无（数量众多）'],
    ['大蟑螂', '4', '0.8', '5', '40', '狂暴（低血加速）'],
    ['飞行蟑螂', '2', '2.4', '4', '32', '飞行、闪避俯冲'],
    ['装甲蟑螂', '12', '0.5', '8', '76', '护甲、减伤'],
    ['分裂蟑螂', '6', '0.7', '10', '42', '死亡分裂'],
    ['自爆蟑螂', '2', '1.4', '6', '60', '自爆、爆炸'],
    ['飞行自爆蟑螂', '2', '2.2', '8', '55', '飞行、自爆'],
    ['蟑螂女王', '100', '0.3', '100', '160', 'Boss、召唤、火抗'],
    ['护士蟑螂', '25', '0.8', '28', '78', '治疗、杀虫剂敏感、红盾'],
    ['变异蟑螂', '8', '0.5', '22', '38', '死亡干扰、酸液'],
    ['定时自爆蟑螂', '30', '1.4', '40', '60', '护盾、放炸弹、变身'],
    ['隧道工蟑螂', '30', '0.6', '30', '84', '护甲喷涂'],
    ['地铁精英', '27', '2.4', '4', '32', '飞行、闪避俯冲'],
    ['护盾蟑螂', '20', '0.5', '35', '88', '气体护盾'],
  ]
));

// 3 基础蟑螂
children.push(h1('3. 基础蟑螂详解'));

children.push(h2('3.1 小蟑螂'));
children.push(statTable([
  ['HP / 速度', '1 / 1.0（基准速度）'],
  ['击杀奖励', '1 金币'],
  ['体型 / 颜色', '28px / 深棕色 #5a3a2a'],
  ['特殊能力', '无'],
]));
children.push(skillTable([
  ['基础单位', '最基础的蟑螂，成群结队出现。血量最低，一碰就死。'],
  ['高速闪避', '被火焰锁定后可能触发闪避（小蟑螂闪避速度 180px/s，触发时间 0.4~0.7s）。'],
  ['防线突破伤害', '简单 2 / 困难 5'],
]));

children.push(h2('3.2 大蟑螂'));
children.push(statTable([
  ['HP / 速度', '4 / 0.8（比小蟑螂慢 20%）'],
  ['击杀奖励', '5 金币'],
  ['体型 / 颜色', '40px / 深棕色 #7a4a3a'],
  ['特殊能力', '狂暴（enrage）'],
]));
children.push(skillTable([
  ['狂暴加速', '血量低于 50% 阈值时触发狂暴，移动速度 ×2（enrageSpeedMult），威胁显著提升。'],
  ['防线突破伤害', '简单 5 / 困难 15'],
]));

children.push(h2('3.3 飞行蟑螂'));
children.push(statTable([
  ['HP / 速度', '2 / 2.4（最快的基础单位）'],
  ['击杀奖励', '4 金币'],
  ['体型 / 颜色', '32px / 灰蓝色 #4a5a6a'],
  ['特殊能力', '飞行、闪避俯冲（flying + dodge）'],
]));
children.push(skillTable([
  ['飞行', '从空中掠过，不受地面陷阱影响；命中宽度 ×4（更窄更难打中），火焰射程 ×1.3（可打更远）。'],
  ['闪避俯冲', '检测到火焰时突然俯冲闪避（闪避速度 180px/s）。'],
  ['游荡与冲刺', '飞行游荡幅度 80px；距离防线 150px 时冲刺，冲刺速度 ×2.5。'],
  ['防线突破伤害', '简单 3 / 困难 8'],
]));

children.push(h2('3.4 装甲蟑螂'));
children.push(statTable([
  ['HP / 速度', '12 / 0.5（最慢但防御最高）'],
  ['击杀奖励', '8 金币'],
  ['体型 / 颜色', '76px / 灰色 #5a5a5a'],
  ['特殊能力', '护甲、减伤（armor + damage_reduction）'],
]));
children.push(skillTable([
  ['护甲吸收', '护甲吸收 80% 伤害（armorAbsorbRatio），本体仅承受 20%。'],
  ['伤害减免', '护甲提供的额外减伤 20%（armorDamageReduction）。'],
  ['破甲', '护甲值耗尽后护甲破碎，露出本体，变为普通外观。'],
  ['防线突破伤害', '简单 4 / 困难 12'],
]));

children.push(h2('3.5 分裂蟑螂'));
children.push(statTable([
  ['HP / 速度', '6 / 0.7'],
  ['击杀奖励', '10 金币（含分裂后的小蟑螂）'],
  ['体型 / 颜色', '42px / 紫色 #6a4a6a'],
  ['特殊能力', '死亡分裂（split_on_death）'],
]));
children.push(skillTable([
  ['死亡分裂', '母体死亡时分裂为 5 只小蟑螂（split.count=5），生成半径 50px。'],
  ['子体闪避', '分裂出的小蟑螂继承高速闪避（闪避速度 250px/s），触发时间 0.2~0.4s。'],
  ['死亡链限制', '死亡链最大深度 3 层，防止连锁死亡无限循环。'],
  ['防线突破伤害', '简单 4 / 困难 10'],
]));

children.push(h2('3.6 自爆蟑螂'));
children.push(statTable([
  ['HP / 速度', '2 / 1.4（较快）'],
  ['击杀奖励', '6 金币'],
  ['体型 / 颜色', '60px / 红棕色 #8a3a2a'],
  ['特殊能力', '自爆、爆炸（suicide + explode）'],
]));
children.push(skillTable([
  ['Z 字形逼近', '呈 Z 字形游走靠近防线，摇摆幅度 30px。'],
  ['自爆', '距离防线 150px 触发自爆，爆炸半径 100px，对蟑螂伤害 15，对防线伤害 简单 5 / 困难 15（范围 100px）。'],
  ['飞行自爆', '飞行自爆蟑螂距防线 80px 触发，对防线伤害范围扩大至 300px。'],
  ['爆炸特效', '爆炸产生火焰/烟雾/碎片/火花/火环粒子，屏幕震动 20。'],
  ['死亡爆炸', '被击杀时也会爆炸，半径 80px，伤害 12。'],
  ['引信火花', '靠近时引信产生火花（出现概率 30%），提示即将自爆。'],
]));

children.push(h2('3.7 蟑螂女王（Boss）'));
children.push(statTable([
  ['HP（基础敌人定义）', '100（Boss 战另用独立 HP 配置，见 §6）'],
  ['速度', '0.3（极慢）'],
  ['击杀奖励', '100 金币'],
  ['体型 / 颜色', '160px / 深紫色 #8a2a6a'],
  ['特殊能力', 'Boss、召唤小兵、火焰抗性（boss + spawn_minions + resist_fire）'],
]));
children.push(skillTable([
  ['召唤小兵', '每 8 秒召唤 3 只小蟑螂（BOSS_CONFIG.queen.spawnInterval=8, minionCount=3）。'],
  ['火焰抗性', '火焰伤害抗性 50%（resistPercent），需配合非火焰手段或更持久输出。'],
  ['Boss 反噬', '杀死女王时对周围蟑螂造成巨额反噬伤害（小蟑螂 50 / 大蟑螂 150 / 自爆 200 等）。'],
  ['防线突破伤害', '简单 12 / 困难 35（最高）。'],
]));

// 4 医院专属
children.push(h1('4. 医院场景专属蟑螂'));

children.push(h2('4.1 护士蟑螂'));
children.push(statTable([
  ['HP / 速度', '25 / 0.8'],
  ['击杀奖励', '28 金币（高价值，优先击杀目标）'],
  ['体型 / 颜色', '78px / 医疗绿色 #4ade80'],
  ['特殊能力', '治疗盟友、杀虫剂敏感、红色护盾（heal_ally + insecticide_vulnerable + red_shield）'],
]));
children.push(skillTable([
  ['治疗光环', '定期为周围 360px 范围内受伤蟑螂恢复 20% HP（healRange=360, healPercent=0.20）。'],
  ['治疗阶段', '治疗分 4 阶段：空闲 1s → 充能 1s → 喷雾 2s → 消散 1s；治疗增益持续 2s。'],
  ['杀虫剂敏感', '接触杀虫剂后窒息 8 秒，受窒息持续伤害（每秒 1 点），是克制手段。'],
  ['自带护盾', '自带红色护盾，护盾血量 3（nurseShieldHp），需先破盾。'],
  ['跟随友军', '缓慢跟随友军移动（速度 ×0.5），距友军 40px 停止。'],
]));

children.push(h2('4.2 变异蟑螂'));
children.push(statTable([
  ['HP / 速度', '8 / 0.5'],
  ['击杀奖励', '22 金币'],
  ['体型 / 颜色', '38px / 放射性绿色 #84cc16'],
  ['特殊能力', '死亡干扰、酸液溅射（distort_on_death + acid_splash）'],
]));
children.push(skillTable([
  ['酸液爆发', '死亡时释放强腐蚀性酸液，酸液溅射范围 100px，伤害 10，灼烧伤害 ×1.5 倍率。'],
  ['屏幕干扰', '死亡时屏幕被绿色干扰覆盖（原 2.5 秒），干扰酸液爆发范围 60px。'],
  ['孵化小蟑螂', '死亡时还会孵化 2 只小蟑螂（mutantSpawnCount=2）。'],
  ['注', '屏幕绿色干扰为永久设计（原有酸性干扰已移除，仅保留酸液溅射）。'],
]));

children.push(h2('4.3 定时自爆蟑螂'));
children.push(statTable([
  ['HP / 速度', '30 / 1.4'],
  ['击杀奖励', '40 金币（医院场景精英）'],
  ['体型 / 颜色', '60px / 琥珀色 #f59e0b'],
  ['特殊能力', '护盾、放置炸弹、变身（shield + bomb_placement + transform_large）'],
]));
children.push(skillTable([
  ['放置炸弹', '到达防线前 64px 放置炸弹（bombPlacementDistance=64）。'],
  ['爆炸', '炸弹 3 秒倒计时后爆炸，爆炸半径 196px，对蟑螂伤害 50，对防线伤害 简单 8 / 困难 20。'],
  ['变身大蟑螂', '放置炸弹后 0.2s 变身，2 秒后变成大蟑螂继续进攻。'],
  ['尸体爆炸', '被击杀后尸体原地爆炸（尸体炸弹计时 3s），需注意清理炸弹。'],
  ['突破预警', '接近防线 200px 进入警告状态，速度 ×0.5；放置炸弹后推回 64px。'],
]));

// 5 地铁专属
children.push(h1('5. 地铁场景专属蟑螂'));

children.push(h2('5.1 隧道工蟑螂'));
children.push(statTable([
  ['HP / 速度', '30 / 0.6'],
  ['击杀奖励', '30 金币（高价值，优先击杀）'],
  ['体型 / 颜色', '84px / 暗灰色 #78716c'],
  ['特殊能力', '护甲喷涂（armor_spray）'],
]));
children.push(skillTable([
  ['护甲喷涂', '每 10 秒为周围 300px 范围内血量最高的蟑螂喷涂护甲 200 点（armorSprayInterval=10, armorSprayAmount=200, armorSprayRange=300）。'],
  ['效果', '被喷涂的蟑螂获得额外护甲，显著提升生存能力，需优先集火隧道工。'],
  ['修理护盾', '可修理护盾蟑螂的气体护盾（速度 10 点/秒，射程 220px）。'],
  ['跟随', '跟随护盾蟑螂并在 100px 处停留（workerFollowStopDist）。'],
]));

children.push(h2('5.2 地铁蟑螂精英'));
children.push(statTable([
  ['HP / 速度', '27 / 2.4（极快）'],
  ['击杀奖励', '4 金币'],
  ['体型 / 颜色', '32px / 灰蓝色 #4a5a6a'],
  ['特殊能力', '飞行、闪避俯冲（flying + dodge）'],
]));
children.push(skillTable([
  ['飞行冲锋', '出场延迟 2s 后进入高速冲刺，冲刺速度 460px/s，到屏幕边缘 30px 停止。'],
  ['闪避俯冲', '检测到火焰时突然俯冲闪避，增加命中难度。'],
  ['不受阻挡', '飞行单位不受地面阻挡影响。'],
]));

children.push(h2('5.3 护盾蟑螂'));
children.push(statTable([
  ['HP / 速度', '20 / 0.5（极慢，阵型锚点）'],
  ['击杀奖励', '35 金币（高价值）'],
  ['体型 / 颜色', '88px / 淡青色 #67e8f9'],
  ['特殊能力', '气体护盾（gas_shield）'],
]));
children.push(skillTable([
  ['气体护盾', '释放淡青色气体护盾，身后矩形范围（宽 200px）内同伴免疫火焰直射。'],
  ['护盾容量', '护盾值 100 点（shieldMaxHp），所有伤害均可侵蚀；护盾完整时自然恢复 2 点/秒。'],
  ['区域豁免', '矩形保护区内的蟑螂免疫火焰直射（需先破盾或绕到侧面）。'],
  ['破盾重组', '护盾破碎后 10 秒重新生成（shieldRebuildDelay=10）。'],
  ['盾墙阵型', '与随从组成盾墙推进阵型，横向偏移 ≤120px，速度绑定锚点 ×1.05，距防线 80px 内解除编队。'],
]));

// 6 Boss 战配置
children.push(h1('6. Boss 战配置（蟑螂女王）'));
children.push(p('除基础敌人属性外，女王在 Boss 战中有独立的高强度配置（BALANCE_ITEMS.boss / BOSS_CONFIG）：'));
children.push(skillTable([
  ['基础血量', '10000（Boss 战专用，远超基础敌人定义的 100）'],
  ['阶段划分', '按 HP 比例分三阶段切换：70% / 40% / 20%（phaseHpThresholds），阶段切换过渡 6s。'],
  ['各部位', '眼睛 800 HP、腹部 1500 HP；最大蜕皮 3 次。'],
  ['时间限制', '180 秒超时视为失败。'],
  ['召唤', '召唤施法 2s，每波虫卵阶段（共 4 层）生成间隔 2s。'],
  ['移动行为', '速度系数 0.6，水平悬浮摇摆，靠近防线 15px 停下，低血量时逃跑飞出屏幕。'],
  ['死亡奖励', '击杀奖励 500 金币，死亡爆炸 60 粒子 + 冲击波。'],
  ['护甲', '护甲血量 简单 12 / 困难 20。'],
]));

// 7 怪物技能机制汇总
children.push(h1('7. 怪物技能机制汇总'));
children.push(p('以下为跨怪物类型共享或高频出现的技能机制，参数来源 BALANCE_ENEMIES：'));
children.push(skillTable([
  ['狂暴（Enrage）', '大蟑螂低血触发：HP<50% 时速度 ×2。'],
  ['护甲（Armor）', '装甲蟑螂：吸收 80% 伤害 + 20% 减伤，破甲后回归本体。'],
  ['分裂（Split）', '分裂蟑螂：死亡分裂 5 只；死亡链上限 3 层。'],
  ['自爆（Suicide）', '靠近防线自爆：地面触发 150px，爆炸半径 100，伤害 15；死亡也爆炸。'],
  ['飞行（Flying）', '不受地面阻挡，命中宽度 ×4，火焰射程 ×1.3，游荡/冲刺机动。'],
  ['闪避（Dodge）', '飞行/精英检测火焰时俯冲闪避，大幅提高命中难度。'],
  ['治疗（Heal）', '护士：360px 内恢复 20%HP，治疗 4 阶段循环。'],
  ['杀虫剂敏感（Insecticide）', '护士接触杀虫剂窒息 8s（每秒 1 伤）。'],
  ['酸液（Acid）', '变异：死亡溅射 100px 酸液，伤害 10，灼烧 ×1.5。'],
  ['放置炸弹（Bomb）', '定时自爆：墓地前 64px 放炸弹，3s 爆炸半径 196 伤害 50。'],
  ['护甲喷涂（Armor Spray）', '隧道工：每 10s 给血量最高同伴 +200 护甲。'],
  ['气体护盾（Gas Shield）', '护盾蟑螂：矩形内同伴免疫火焰直射，破碎 10s 重组。'],
  ['召唤（Spawn）', '女王：每 8s 召唤 3 只小兵。'],
  ['火焰抗性（Resist）', '女王：火焰伤害减半（50%）。'],
]));

// 8 防线突破伤害
children.push(h1('8. 防线突破伤害表'));
children.push(p('蟑螂突破防线时对防线造成的伤害（按难度）：'));
children.push(table(
  [1900, 3730, 3730],
  ['怪物', '简单（Easy）', '困难（Hard）'],
  [
    ['小蟑螂', '2', '5'],
    ['大蟑螂', '5', '15'],
    ['飞行蟑螂', '3', '8'],
    ['装甲蟑螂', '4', '12'],
    ['分裂蟑螂', '4', '10'],
    ['定时自爆蟑螂', '5', '15'],
    ['蟑螂女王', '12', '35'],
    ['隧道工蟑螂', '5', '15'],
    ['地铁精英', '3', '8'],
    ['护盾蟑螂', '6', '18'],
  ]
));
children.push(p('注：自爆类蟑螂除突破伤害外，还会触发自爆/炸弹爆炸对防线造成额外伤害（自爆 简单 5 / 困难 15；炸弹 简单 8 / 困难 20）。'));

// 9 场景出现表
children.push(h1('9. 怪物出现场景分布'));
children.push(p('各场景可出现的蟑螂类型（新类型随场景逐步解锁）：'));
children.push(table(
  [1200, 8160],
  ['场景', '可出现的蟑螂'],
  [
    ['厨房', '小蟑螂、大蟑螂、飞行蟑螂'],
    ['下水道', '+ 装甲蟑螂'],
    ['垃圾场', '+ 自爆蟑螂'],
    ['地下室', '+ 分裂蟑螂、飞行自爆蟑螂'],
    ['天台', '全基础类型 + 蟑螂女王'],
    ['街道', '全基础类型 + 蟑螂女王'],
    ['医院', '全基础类型 + 女王 + 护士 + 变异 + 定时自爆'],
    ['地铁', '基础类型 + 隧道工 + 地铁精英 + 护盾（无女王）'],
    ['超市', '全基础类型 + 蟑螂女王'],
    ['学校', '全基础类型 + 蟑螂女王'],
    ['巢穴', '全基础类型 + 蟑螂女王（最高难度）'],
  ]
));

// ---------- build ----------
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
  fs.writeFileSync('D:/CocosGreater/Fire Roach KillerV2.6/app/docs/怪物属性与技能文档.docx', buffer);
  console.log('OK written');
});