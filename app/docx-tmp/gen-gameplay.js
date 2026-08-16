const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Footer
} = require('docx');

const CJK = 'Microsoft YaHei';
const font = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: CJK };

// ---------- helpers ----------
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
  return new Paragraph({
    children: items.map(i => new TextRun({ text: i.t, bold: !!i.b })),
    spacing: { after: 120 },
  });
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

const W = 9360;

// ---------- document content ----------
const children = [];

// Title
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: 'Fire Roach Killer V2.6 — 游戏玩法文档', bold: true, size: 40, font })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: '《灭蟑行动》· 基于源码数据分析 · 2026-08-15', size: 22, color: '666666', font })] }));

// 1 概述
children.push(h1('1. 游戏概述'));
children.push(p('《Fire Roach Killer》是一款竖屏塔防射击游戏。玩家扮演"蟑叔"的助手，手持喷火枪，在防线前抵御一波又一波蟑螂的进攻，保护身后的防线不被突破。'));
children.push(pruns([{ t: '核心目标：', b: true }, { t: '在防线 HP 归零前，用火焰喷射器消灭所有蟑螂，通关全部 11 个场景，最终击败蟑螂女王。' }]));
children.push(pruns([{ t: '核心玩法循环：', b: true }, { t: '选择难度与场景 → 战前准备/商店购买消耗品 → 3-2-1 倒计时进入战斗 → 喷火清敌、拾取道具、应对波次 → 通关结算奖励（金币/天赋点/新道具）→ 解锁下一关。' }]));
children.push(p('游戏采用竖屏固定 540 逻辑宽度布局，适配各类长屏手机；玩家通过触控移动喷火枪角度，向蟑螂喷射火焰。'));

// 2 模式与难度
children.push(h1('2. 游戏模式与难度'));
children.push(h2('2.1 游戏模式'));
children.push(bullet('剧情模式（Story）：按关卡解锁链依次通关 11 个场景，清空全部波次后胜利，解锁下一关。'));
children.push(bullet('无尽模式（Endless）：引擎已实现，持续波次直至防线被破，无胜利条件，记录最高波次与最佳坚持时长。当前 UI 中暂禁用。'));
children.push(bullet('每日模式 / Boss 战：引擎中预留，当前主菜单未启用。'));
children.push(h2('2.2 难度（Easy / Hard）'));
children.push(p('主菜单提供简单（easy）与困难（hard）两档难度（normal 仅作为配置兜底）。难度主要影响：'));
children.push(table(
  [2800, 3280, 3280],
  ['项目', '简单（Easy）', '困难（Hard）'],
  [
    ['初始金币', '5000', '100'],
    ['击杀奖励惩罚', '无', '×0.8 削减'],
    ['喷火枪 DPS', '25（束 18.75/粒子区 6.25）', '25（束 18.75/粒子区 6.25）'],
    ['防线受击伤害（自爆/突破）', '较低（如 5）', '较高（如 15）'],
    ['换弹消耗', '免费', '消耗燃气'],
    ['可用敌人类型', '限于场景基础类型', '全部敌人类型'],
    ['奖励倍率', '0.8', '1.5'],
  ]
));

// 3 核心战斗机制
children.push(h1('3. 核心战斗机制'));
children.push(h2('3.1 喷火枪与燃气'));
children.push(bullet('基础武器为喷火枪，向喷嘴方向喷射锥形火焰，造成持续伤害。火焰伤害由"火焰束（碰撞）"+ "火焰粒子区"两部分分摊（束占 75%，粒子区占 25%）。'));
children.push(bullet('喷射消耗燃气（基础容量 100），燃气用尽需换罐（换罐时间 easy 8s / hard 15s）。'));
children.push(bullet('持续喷射会使热量累积，超过过热阈值（基础 1800）后进入过热状态，无法喷射，需冷却或使用"紧急冷却"。'));
children.push(h2('3.2 防线'));
children.push(bullet('防线是玩家要保护的目标，基础 HP 80。蟑螂突破防线会按类型造成不同伤害（如小蟑螂 easy 2 / hard 5，女王 easy 12 / hard 35）。'));
children.push(bullet('防线 HP 归零即判负，本关金币不发（金币池保留）。可通过"防线修复"消耗品恢复 20%。'));
children.push(h2('3.3 波次与倒计时'));
children.push(bullet('每波敌人清空后进入下一波；仅第一波显示 3-2-1 倒计时，后续波次直接生成。'));
children.push(bullet('波次奖励金币 = 基础 50 + 波次 × 10，完美波次（无突破）×1.5 倍率。实际奖励受难度倍率与场景奖励倍率影响。'));
children.push(bullet('敌人生成支持集群（clusterChance）与多阶段生成（30% / 50% / 完成）。'));

// 4 敌人系统
children.push(h1('4. 敌人系统（蟑螂图鉴）'));
children.push(p('游戏共有 14 种蟑螂单位，按场景逐步解锁。下表为基础属性（HP／速度／击杀奖励），实际数值随难度缩放。'));
children.push(table(
  [1500, 900, 700, 700, 5560],
  ['敌人', 'HP', '速度', '奖励', '特殊能力'],
  [
    ['小蟑螂', '1', '1.0', '1', '基础单位，数量众多'],
    ['大蟑螂', '4', '0.8', '5', '低血量时狂暴加速（50% 阈值 ×2 速度）'],
    ['飞行蟑螂', '2', '2.4', '4', '飞行、闪避俯冲'],
    ['装甲蟑螂', '12', '0.5', '8', '护甲吸收 80% 伤害，破甲后露本体'],
    ['分裂蟑螂', '6', '0.7', '10', '死亡分裂为 5 只小蟑螂'],
    ['自爆蟑螂', '2', '1.4', '6', 'Z 字形靠近防线自爆，范围伤害'],
    ['飞行自爆蟑螂', '2', '2.2', '8', '飞行 + 俯冲自爆'],
    ['蟑螂女王', '100', '0.3', '100', 'Boss：每 8s 召唤 3 只小兵，火焰抗性 50%'],
    ['护士蟑螂', '25', '0.8', '28', '治疗盟友 20%HP；对杀虫剂敏感窒息 8s；红色护盾'],
    ['变异蟑螂', '8', '0.5', '22', '死亡释放强腐蚀性酸液 + 屏幕绿色干扰'],
    ['定时自爆蟑螂', '30', '1.4', '40', '到达防线前 64px 放置炸弹后变身大蟑螂，尸体原地爆炸'],
    ['隧道工蟑螂', '30', '0.6', '30', '每 10s 为血量最高同伴喷涂护甲 200'],
    ['地铁精英', '27', '2.4', '4', '飞行、闪避俯冲，不受地面阻挡'],
    ['护盾蟑螂', '20', '0.5', '35', '释放气体护盾，身后矩形内同伴免疫火焰直射'],
  ]
));
children.push(h2('4.1 场景专属机制'));
children.push(bullet('医院场景：护士（治疗）、变异（酸液干扰）、定时自爆（放炸弹）；有虫卵孵化池机制。'));
children.push(bullet('地铁场景：隧道工（喷涂护甲）、地铁精英（飞行冲锋）、护盾蟑螂（盾墙推进阵型）；另有列车被动事件——列车按每波时刻表沿贝塞尔轨道驶过，可碾压轨道上蟑螂，驶过前 3s 预警。'));

// 5 关卡系统
children.push(h1('5. 关卡系统（11 个场景）'));
children.push(p('剧情模式按解锁链推进：厨房 → 下水道 → 垃圾场 → 地下室 → 街道 → 天台 → 医院 → 地铁 → 超市 → 学校 → 巢穴。通关当前场景自动解锁下一关。'));
children.push(table(
  [1100, 1300, 900, 900, 900, 4260],
  ['场景', '难度系数', '奖励倍率', '天气', '波数', '说明'],
  [
    ['厨房', '1.0', '1.0', '无', '6', '新手教学，仅小/大/飞行蟑螂'],
    ['下水道', '1.3', '1.2', '雨', '6', '新增飞行蟑螂'],
    ['垃圾场', '1.3', '1.5', '雾', '6', '新增装甲蟑螂'],
    ['地下室', '1.5', '1.8', '夜(闪电)', '6', '新增分裂/自爆蟑螂'],
    ['天台', '1.7', '2.0', '夜', '6', '全种类 + 女王 Boss'],
    ['街道', '1.9', '2.0', '雨', '6', '赛博朋克都市决战'],
    ['医院', '2.1', '2.5', '无', '8', '专属：护士/变异/定时自爆，1-3 星评级'],
    ['地铁', '2.3', '4.0', '夜', '10', '专属：隧道工/精英/护盾 + 列车事件'],
    ['超市', '2.5', '4.5', '无', '6', '含女王 Boss'],
    ['学校', '2.7', '5.0', '雨', '6', '含女王 Boss'],
    ['巢穴', '3.0', '6.0', '雾', '6', '最终战场，含女王 Boss'],
  ]
));
children.push(h2('5.1 关卡通关奖励道具'));
children.push(p('每关通关后揭示下一关的新道具（蟑叔搞笑介绍）：厨房→风扇，下水道→燃烧瓶，垃圾场→电蚊拍，地下室→杀虫喷雾，天台风扇，街道→散弹/雷达，医院→斩螂·110，超市→货架燃烧弹，学校→粉笔灰毒气，巢穴→女王之冠。'));

// 6 武器与道具
children.push(h1('6. 武器与掉落道具'));
children.push(h2('6.1 基础武器'));
children.push(bullet('喷火枪：唯一基础武器，持续喷射锥形火焰。'));
children.push(bullet('额外武器模式（天赋解锁）：冷冻喷雾、毒气弹、散弹模式、燃烧瓶。'));
children.push(h2('6.2 战斗掉落道具'));
children.push(p('战斗中会随机掉落一次性武器道具，拾取后进入道具栏使用。道具按场景逐步解锁（由弱到强）。'));
children.push(table(
  [1500, 1200, 6660],
  ['道具', '弹药', '效果'],
  [
    ['蟑螂贴板', '3', '发射追踪水滴，命中后形成粘板困住蟑螂（减速 80%）'],
    ['杀虫剂', '40', '双侧毒气喷射，持续中毒伤害，护士蟑螂窒息'],
    ['散弹模式', '30', '三管齐发，扇面散射，覆盖广'],
    ['燃烧瓶', '5', '投掷后形成火墙区域，持续范围灼烧'],
    ['雷达激光', '20', '自动锁定最近目标连续射击'],
    ['强力风扇', '5', '全场减速控制，吹散蟑螂'],
    ['电蚊拍', '1', '全屏放电瞬杀 + 麻痹'],
    ['斩螂·110', '3', '近战秒杀：自动跃向威胁最高目标，无视护甲'],
  ]
));
children.push(p('关卡结束时未使用的道具按 INVENTORY_SELL_PRICES 折合金币（如电蚊拍 15、斩螂 12、散弹 12）。'));

// 7 天赋系统
children.push(h1('7. 天赋系统'));
children.push(p('通关地下室后解锁天赋树。天赋点由每关胜利发放（= 33 × 场景奖励倍率，向下取整）。天赋分为四大类，共 15 项：'));
children.push(table(
  [1600, 1400, 2000, 4360],
  ['天赋', '最大级', '基础费用', '效果'],
  [
    ['火焰强化', '5', '100', '火焰伤害 +15%/级'],
    ['射程延伸', '5', '120', '火焰射程 +10%/级'],
    ['扩容气罐', '5', '80', '燃气容量 +20%/级'],
    ['耐热改造', '5', '150', '过热阈值 +20%/级'],
    ['快速冷却', '5', '100', '冷却速度 +15%/级'],
    ['防线加固', '5', '200', '防线 HP +25%/级'],
    ['火焰亲和', '3', '250', '燃烧瓶/火墙伤害 +10%/级'],
    ['机械精通', '3', '250', '风扇减速 +5%、持续 +10%/级'],
    ['爆炸专家', '3', '250', '燃烧瓶爆炸范围 +15%/级'],
    ['节约大师', '3', '200', '道具拾取弹药 +1/级'],
    ['赏金猎人', '5', '150', '击杀奖励 +10%/级'],
    ['冷冻武器', '1', '500', '解锁冷冻喷雾模式'],
    ['毒气武器', '1', '500', '解锁毒气弹模式'],
    ['散弹模式', '1', '600', '解锁散弹喷射模式'],
    ['燃烧瓶', '1', '800', '解锁燃烧瓶投掷'],
  ]
));
children.push(p('升级费用 = 基础费用 × 1.5^当前等级（talentCostScaling）。'));

// 8 消耗品与商店
children.push(h1('8. 消耗品与商店'));
children.push(p('关卡内商店可购买一次性消耗品，进入关卡后手动或自动使用，跨关保留在库存中。'));
children.push(table(
  [1500, 900, 3000, 3960],
  ['消耗品', '价格', '冷却', '效果'],
  [
    ['气罐补给', '¥250', '3s', '立即回满燃气'],
    ['防线修复', '¥400', '8s', '防线 HP +20%'],
    ['紧急冷却', '¥200', '无', '立即清除过热'],
    ['火力全开', '¥700', '10s', '8 秒内伤害 ×2'],
    ['临时护盾', '¥800', '8s', '防线 5 秒无敌'],
    ['蟑螂诱饵', '¥450', '6s', '全场蟑螂聚拢 3 秒'],
  ]
));
children.push(p('部分消耗品可自动使用（过热时紧急冷却、防线低血时修复/护盾、燃气不足时补给），阈值：防线 <15%、燃气 <30%。'));
children.push(p('当前实际接入"菜单商店"（金币池持久化于 roach_blaster_menu_money）；局内波间商店逻辑引擎已实现但未接入流程。'));

// 9 经济系统
children.push(h1('9. 经济系统'));
children.push(bullet('金币（¥）：来源 = 击杀奖励 + 波次奖励 + 未用道具回收 + 胜利奖金 + 成就奖励。击杀奖励受场景奖励倍率、赏金猎人天赋、难度惩罚影响。'));
children.push(bullet('天赋点：每关胜利发放 floor(33 × 场景奖励倍率)；用于升级天赋树。'));
children.push(bullet('初始金币：easy 5000 / hard 100（跨关金币池可覆盖）。'));
children.push(bullet('成就奖励：解锁后存入 unclaimedRewards，需在成就界面点亮动画后入账。'));

// 10 成就系统
children.push(h1('10. 成就系统'));
children.push(p('共 16 个永久成就，分击杀/波次/经济/完美/Boss/解锁六类，条件为动态表达式，成就奖励金币在玩家查看成就界面时发放。'));
children.push(table(
  [1500, 4460, 3400],
  ['成就', '解锁条件', '奖励'],
  [
    ['首杀', '累计击杀 1 只', '¥50'],
    ['蟑螂杀手', '累计击杀 100 只', '¥200'],
    ['灭蟑专家', '累计击杀 1000 只', '¥1000'],
    ['坚守阵地', '到达第 5 波', '¥100'],
    ['终极守卫', '通关全部 10 波', '¥500'],
    ['无尽勇士', '无尽模式 20 波', '¥500'],
    ['无尽传说', '无尽模式 50 波', '¥2000'],
    ['小有积蓄', '累计获得 1000 资金', '¥200'],
    ['完美防御', '完成 1 次完美波次', '¥100'],
    ['铜墙铁壁', '10 波无突破', '¥1000'],
    ['女王终结者', '击杀 1 只女王', '¥500'],
    ['空中猎手', '击杀 50 只飞行蟑螂', '¥300'],
    ['破甲大师', '击杀 30 只装甲蟑螂', '¥400'],
    ['武器大师', '解锁全部 5 种武器', '¥1000'],
    ['初出茅庐', '第一次升级天赋', '¥100'],
  ]
));

// 11 图鉴系统
children.push(h1('11. 图鉴系统'));
children.push(p('图鉴记录所有蟑螂的资料（HP、速度星级、特殊能力、趣味冷知识）。击杀对应蟑螂累积 killCount 解锁条目；HP/速度数值从 ENEMY_DEFS 自动派生，保证与战斗属性一致。'));

// 12 存档与云端
children.push(h1('12. 存档与云端同步'));
children.push(bullet('本地存档：localStorage 持久化（roach_blaster_progress，版本 v3），保存进度/成就/天赋/图鉴/消耗品库存/金币池。'));
children.push(bullet('云端同步：通过 tRPC 接口上传进度与对局记录（scene/mode/difficulty/waveReached/kills/result），断网时静默降级，本地优先。'));
children.push(bullet('玩家 ID：首次生成 p_ 前缀 ID 存储于 roach_blaster_player_id。'));

// 13 流程状态机
children.push(h1('13. 游戏流程状态机'));
children.push(p('引擎以 GameState 枚举驱动界面切换：MENU（主菜单）→ PLAYING（战斗）→ COUNTDOWN（倒计时）→ ITEM_DROP/ITEM_REVEAL（通关道具揭示）→ WAVE_CLEAR（结算）→ GAME_OVER（胜利/失败）。'));
children.push(bullet('主菜单 → 选难度/模式/场景 →（剧情）漫画 → 对话 → 战前选道具 → 开始战斗。'));
children.push(bullet('战斗：3-2-1 倒计时 → 波次循环 → 清空全波（剧情）→ 胜利结算 / 防线 HP 归零 → 失败结算。'));
children.push(bullet('胜利结算：出售未用道具 → 发放天赋点 → 揭示新道具动画 → 金币入账 → 解锁下一关。'));
children.push(bullet('失败结算：本关金币不发，显示到达波次/击杀/突破数，可重试或返回主菜单。'));

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
  fs.writeFileSync('D:/CocosGreater/Fire Roach KillerV2.6/app/docs/游戏玩法文档.docx', buffer);
  console.log('OK written');
});