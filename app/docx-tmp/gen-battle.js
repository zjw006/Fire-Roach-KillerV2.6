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

function kvTable(rows) {
  return table([1400, 7960], ['属性', '数值'], rows);
}
function twoCol(headL, headR, rows) {
  return table([1200, 8160], [headL, headR], rows);
}

const children = [];
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: 'Fire Roach Killer V2.6 — 战斗过程文档', bold: true, size: 40, font })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: '《灭蟑行动》战斗机制与时序 · 基于源码 engine.ts / WaveManager.ts / RoachAISystem.ts / CollisionSystem.ts · 2026-08-15', size: 22, color: '666666', font })] }));

// 1 战斗流程总览
children.push(h1('1. 战斗流程总览'));
children.push(p('战斗过程由引擎以状态机驱动，从"进入关卡"到"胜利/失败结算"的完整时序如下：'));
children.push(table(
  [2000, 7360],
  ['阶段', '发生内容'],
  [
    ['① 战斗准备', '从准备界面/商店继续 → 引擎 start() → 初始化玩家/防线/燃气/热量 → 进入第一波'],
    ['② 倒计时', '仅第一波显示 3-2-1 倒计时（3 秒），倒计时阶段冻结所有逻辑，结束后开始生成敌人'],
    ['③ 波次循环', '生成敌人 → 玩家喷火清敌 / 使用道具消耗品 → 敌人 AI 进攻 → 场上清空 → 进入下一波'],
    ['④ 特殊事件', '战斗过程中穿插：地铁列车驶过、医院虫卵孵化、武器道具随机掉落、天气覆盖'],
    ['⑤ 判定结算', '清空全部波次 → 胜利；防线 HP 归零 → 失败；均进入结算界面'],
  ]
));

// 2 战斗开始
children.push(h1('2. 战斗开始流程'));
children.push(h2('2.1 倒计时机制'));
children.push(bullet('入口：startWave() → 仅第一波调用 startCountdown()，显示 3-2-1 倒计时（countdownDuration=3.0 秒）。'));
children.push(bullet('倒计时期间冻结所有玩家/敌人逻辑，仅更新粒子与屏幕震动；数字变化时播放滴答音。'));
children.push(bullet('倒计时归零 → doWaveSpawn() 开始生成第一波敌人，同时通过 onPlayBGM() 启动关卡 BGM。'));
children.push(bullet('后续波次（wave>1）直接生成，不再显示倒计时。'));
children.push(h2('2.2 战斗初始状态'));
children.push(kvTable([
  ['防线 HP', '80 × 天赋防线加固倍率；防线位置 = 画布高 - 130'],
  ['玩家位置 / 燃气', '屏幕水平居中；燃气 = 基础容量 100'],
  ['热量', '0；过热阈值 = 基础 1800 × 天赋耐热倍率'],
  ['武器', '喷火枪（弹药无限）'],
  ['射程', '基础 250px × 天赋射程倍率（满级可达约 504px）'],
  ['换弹时间', '简单 8 秒 / 困难 15 秒'],
  ['热量衰减', '简单 1.5 / 困难 1（× 冷却天赋）'],
  ['初始波次', 'wave=0，waveTimer=1（首帧即触发第一波）'],
]));
children.push(p('首波有三类教学暂停：厨房首波（玩法教程）、地铁首波（精英登埍对话）、地铁第 4 波（护盾蟑螂对话），逐个确认后恢复生成。'));

// 3 波次系统
children.push(h1('3. 波次系统'));
children.push(h2('3.1 波次生成机制'));
children.push(bullet('每波按场景取波次配置（SCENE_WAVE_CONFIGS），超出场景波数则用默认配置。'));
children.push(bullet('可生成类型：简单模式仅限场景基础类型；困难模式允许全部基础类型。'));
children.push(bullet('编成：对每种敌人入队，每个个体独立判定是否归入集群（clusterChance），同集群个体在 200px 半径内成团生成。'));
children.push(h2('3.2 三阶段生成'));
children.push(p('每波敌人按三阶段比例分批发货（phase1=30%、phase2=50%、phase3=剩余 20%）：'));
children.push(table(
  [1400, 7960],
  ['阶段', '生成内容'],
  [
    ['Phase 1（30%）', '小蟑螂、大蟑螂（按比例的 30%），打乱顺序'],
    ['Phase 2（50%）', '小/大蟑螂（各 50%）+ 全部飞行/装甲/分裂/自爆/飞行自爆/女王数量，打乱顺序'],
    ['Phase 3（20%）', '剩余的小/大蟑螂，打乱顺序'],
  ]
));
children.push(bullet('医院额外：Phase1 加护士，Phase2 加变异，并设置定时自爆数量与 5 秒定时，每 8 秒交错生成一只定时自爆。'));
children.push(bullet('地铁额外：Phase1 最前方放护盾蟑螂（编队锚点先就位）+ 隧道工，Phase2 加地铁精英。'));
children.push(h2('3.3 生成节奏与上限'));
children.push(bullet('生成间隔：每只敌人 0.3~0.8 秒随机（spawnTimer = spawnInterval × 随机系数）。'));
children.push(bullet('场上敌人上限：40 只（超过则暂缓生成）。'));
children.push(bullet('敌人属性缩放：血量 ×1.2（简单）/ ×1.8（困难），女王额外 ×1.5；速度 = 基础 × 波次系数 × (0.7+随机×0.3)。'));
children.push(h2('3.4 波次推进节奏'));
children.push(bullet('两波间隔：场上清空且队列空后，waveTimer 从 2 秒（clearDelay）递减，归零后进入下一波。'));
children.push(bullet('清空判定：场上敌人数=0 且生成队列空且非暂停；首次清空触发该波剩余列车取消。'));
children.push(bullet('医院特殊：仅剩护士时自动击杀全部护士并显示"波次清除"。'));

// 4 玩家战斗操作
children.push(h1('4. 玩家战斗操作'));
children.push(h2('4.1 喷火枪开火'));
children.push(bullet('触发条件：按住开火 && 未过热 && 未换弹 && 燃气>0 && 未麻痹。'));
children.push(bullet('燃气消耗：基础 1 格/秒（火力全开时 ×2）。'));
children.push(bullet('火焰束碰撞：束半宽 15px，有效射程 = 射程 × 0.5（约 125px）；远端伤害衰减（最近 100%、最远约 30%）。'));
children.push(bullet('伤害构成：总 DPS 25 = 火焰束 18.75（75%）+ 火焰粒子区 6.25（25%）；对女王再 ×0.5（火抗）。'));
children.push(bullet('热量累积：100/秒；过热后强制停火并喷烟。'));
children.push(h2('4.2 换弹'));
children.push(bullet('触发：燃气≤0 且未换弹且未过热时自动开始。'));
children.push(bullet('耗时：简单 8 秒 / 困难 15 秒；困难模式换弹额外扣除 5 金币。'));
children.push(bullet('完成：燃气回满，屏幕中央提示"开火"。'));
children.push(h2('4.3 过热与冷却'));
children.push(bullet('预热警告：热量 ≥ 阈值-300（即 1500）时，屏幕中央 3 秒倒计时警告。'));
children.push(bullet('过热：热量 ≥ 阈值 → 过热状态，强制停火，进入冷却（喷火枪 10 秒 / 散弹 6 秒 / 毒气 8 秒）。'));
children.push(bullet('冷却：非过热时热量持续衰减（360/秒 × 衰减率）；过热则等冷却计时归零后重置热量为 0。'));
children.push(bullet('紧急冷却：过热时消耗一管紧急冷却，立即清除过热状态与热量。'));
children.push(h2('4.4 道具与消耗品'));
children.push(bullet('即时使用类（选中即触发）：散弹（三重火焰）、雷达激光、杀虫剂喷雾、粘板、燃烧瓶（火墙）、风扇、电蚊拍、斩螂·110（飞跃秒杀）。'));
children.push(bullet('放置类：选中 → 点击预览范围 → 拖拽放置 → 应用效果并扣弹药；带 1 秒全局冷却及各自冷却。'));
children.push(bullet('消耗品自动使用：紧急冷却（过热时）、护盾/防线修复（防线 HP<15%）、气罐补给（燃气<30%）；火力全开与诱饵需手动。'));
children.push(bullet('消耗品效果：气罐回满燃气、防线修复 +20%、紧急冷却清过热、火力全开 8 秒伤害×2、护盾防线 5 秒无敌、诱饵全场聚拢 3 秒。'));

// 5 敌人AI
children.push(h1('5. 敌人 AI 进攻'));
children.push(p('每帧对每只存活蟑螂依序执行：伤害闪烁衰减与狂暴判定 → 计算移动角度（朝防线）→ 诱饵拉拢 → 移动与闪避 → 自爆引信 → 女王召唤 → 护士治疗 → 隧道工喷涂 → 精英冲刺 → 火焰闪避 → 定时自爆放炸弹 → 灼烧/中毒结算。'));
children.push(table(
  [2200, 7160],
  ['行为', '触发条件与数值'],
  [
    ['狂暴', '血量 < 50% 且非装甲 → 速度 ×2'],
    ['移动锁定', '朝防线移动；飞行类距防线 150px 内冲刺（×2.5 速度）'],
    ['诱饵拉拢', '诱饵生效时向诱饵聚拢，速度 ×1.3'],
    ['闪避', '火焰中横向闪避：自爆 100px/s(1.2s)、小蟑螂 180、分裂子体 250'],
    ['自爆', '距防线 150px（飞行 80px）引信点燃后自爆'],
    ['女王召唤', '每 8 秒召唤 3 只小蟑螂'],
    ['护士治疗', '相位循环（空闲1s→充能1s→喷雾2s→消散1s），范围 360px 恢复 20%HP'],
    ['隧道工喷涂', '每 10 秒给范围内血量最高友军 +200 护甲（射程 300px）'],
    ['地铁精英冲刺', '出场 2 秒后沿屏幕横向冲刺（460px/s），可被火墙/风扇打断'],
    ['定时自爆放弹', '距防线 200px 警告（速度×0.5）→ 80px 处放炸弹并变身大蟑螂'],
  ]
));

// 6 伤害结算
children.push(h1('6. 碰撞与伤害结算'));
children.push(h2('6.1 火焰命中'));
children.push(bullet('火焰锥覆盖三枪口（散弹侧枪伤害 ×0.8）；命中后应用武器特效（毒/粘），累积灼烧伤害与 inFire 标记。'));
children.push(bullet('飞行蟑螂命中宽度 ×4（更窄更难打中），射程 ×1.3（可打更远）。'));
children.push(h2('6.2 护甲与护盾'));
children.push(bullet('装甲保护：附近装甲伙伴提供保护，护甲吸收 80% 伤害，本体仅承受 20%；破甲时触发恐慌（自爆类冲向防线）。'));
children.push(bullet('护士护盾：固定护甲值 12，走护甲吸收路径。'));
children.push(bullet('护盾蟑螂气体护盾：护盾值 100，完好时自然恢复 2/秒，破碎后 10 秒重建；矩形保护区内同伴免疫火焰直射，伤害转移为"格挡!"。'));
children.push(bullet('火墙对受保护目标额外侵蚀护盾（×2）。'));
children.push(h2('6.3 伤害反馈'));
children.push(bullet('击杀时显示"+N金币"浮动文字；破甲、格挡、防线突破均有各自的浮动文字反馈。'));

// 7 特殊事件
children.push(h1('7. 战斗中的特殊事件'));
children.push(table(
  [2000, 7360],
  ['事件', '机制'],
  [
    ['地铁列车', '按波次时刻表自动驶过（如波10 有 4 车次），到点前 3 秒轨道预警；列车沿贝塞尔曲线 2.2 秒驶完，车头半径 90px，碾压秒杀路径上所有蟑螂（无视护甲）；地铁精英被碾后分裂为 2 只小蟑螂'],
    ['医院虫卵', '孵化时间 5 秒；虫卵无敌（火焰/武器无法伤害，只能等待孵化）'],
    ['武器道具掉落', '按场景间隔掉落（厨房40s…地铁25s），随机 1 件落在防线附近，持续 12 秒；来自玩家所选或场景解锁'],
    ['天气系统', '雨/雾/夜闪电均为纯视觉效果，不影响战斗数值'],
  ]
));

// 8 胜利失败
children.push(h1('8. 胜利 / 失败判定'));
children.push(h2('8.1 胜利条件'));
children.push(bullet('剧情模式清空全部波次（wave ≥ 场景总波数）且场上全清 → 触发胜利。'));
children.push(bullet('胜利流程：暂存本关金币 → 出售未用道具 → 停火/胜利 BGM → 发放天赋点（floor(33 × 场景奖励倍率)）→ 医院按突破数评星（0 突破 3 星 / ≤1 突破 2 星 / 否则 1 星）。'));
children.push(h2('8.2 失败条件'));
children.push(bullet('防线 HP ≤ 0 → 判负；本关金币不发（已有金币池保留）。'));
children.push(bullet('突破判定：蟑螂底部越过防线 Y 坐标即突破，造成对应伤害（女王 12/35 最高）。'));
children.push(bullet('自爆/飞行自爆在防线附近触发自爆，对防线造成额外伤害。'));

// 9 奖励时机
children.push(h1('9. 战斗奖励时机'));
children.push(bullet('击杀金币：击杀瞬间入账到"本关暂存"（pendingRewards），胜利时才发放，失败清零。'));
children.push(bullet('击杀奖励 = 基础奖励 × 天赋倍率 × 场景奖励倍率；困难再 ×0.8。'));
children.push(bullet('Boss 反噬：女王被攻击时，击杀其召唤小兵会反噬女王（小 50 / 大 150 / 自爆 200 等）。'));
children.push(bullet('道具回收：胜利时未用道具折价出售（电蚊拍 15 / 斩螂 12 / 散弹 12 等）。'));
children.push(bullet('注意：当前版本波次本身无独立"清波金币"，波次奖励完全来自击杀 + 胜利天赋点。'));

// 10 数值速查
children.push(h1('10. 关键平衡数值速查'));
children.push(table(
  [2600, 6760],
  ['项目', '数值'],
  [
    ['防线 HP', '80（× 天赋防线加固）'],
    ['基础燃气', '100'],
    ['喷火枪射程', '250px（火焰束有效 125px）'],
    ['过热阈值 / 警告', '1800 / 1500'],
    ['过热冷却', '喷火枪 10s / 散弹 6s / 毒气 8s'],
    ['换弹时间', '简单 8s / 困难 15s'],
    ['场上敌人上限', '40 只'],
    ['倒计时', '3.0 秒（仅第一波）'],
    ['波间间隔', '2 秒'],
    ['生成间隔', '0.3~0.8 秒随机'],
    ['女王血量', '100（困难 ×1.5），每 8s 召唤 3 只'],
    ['护盾蟑螂护盾', '100 HP，回 2/s，破后 10s 重建'],
    ['列车', '时刻表触发，2.2s 驶完，车头半径 90px'],
    ['火焰伤害构成', '束 75% + 粒子区 25%，对女王 ×0.5'],
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
  fs.writeFileSync('D:/CocosGreater/Fire Roach KillerV2.6/app/docs/战斗过程文档.docx', buffer);
  console.log('OK written');
});