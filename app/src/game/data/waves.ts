import { SceneType, RoachType, type WaveConfig } from '../types';

/**
 * @fileoverview 波次配置
 * @description 定义每个场景关卡的波次安排，包括每波出现的蟑螂类型、数量、速度和生成间隔。
 * 每个场景有 6-8 波，波次递增难度。厨房场景用于入门教学，仅 6 波。
 * 医院场景使用 8 波特殊配置，包含专属蟑螂类型（护士/变异/定时自爆）。
 */

// 每个场景引入新蟑螂类型 + 新道具，难度逐关递增

// 场景 1：厨房 —— 仅小蟑螂 + 大蟑螂，速度慢，数量少
// 6 波，新手教程场景，波次较少
export const WAVE_CONFIGS_KITCHEN: WaveConfig[] = [
  { wave: 1, smallCount: 8,  largeCount: 0, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.35, interval: 14, clusterChance: 0 },
  { wave: 2, smallCount: 14, largeCount: 1, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.38, interval: 12, clusterChance: 0 },
  { wave: 3, smallCount: 22, largeCount: 3, flyingCount: 1, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.42, interval: 10, clusterChance: 0.05 },
  { wave: 4, smallCount: 30, largeCount: 5, flyingCount: 1, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.47, interval: 9,  clusterChance: 0.1 },
  { wave: 5, smallCount: 38, largeCount: 7, flyingCount: 2, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.52, interval: 8,  clusterChance: 0.15 },
  { wave: 6, smallCount: 45, largeCount: 8, flyingCount: 3, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.58, interval: 7,  clusterChance: 0.2 },
];

// 场景 2：下水道 —— 新增飞行蟑螂，共 6 波，难度递增
export const WAVE_CONFIGS_SEWER: WaveConfig[] = [
  { wave: 1, smallCount: 12, largeCount: 2, flyingCount: 5,  armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.55, interval: 12, clusterChance: 0 },
  { wave: 2, smallCount: 20, largeCount: 3, flyingCount: 7,  armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.65, interval: 10, clusterChance: 0.05 },
  { wave: 3, smallCount: 30, largeCount: 5, flyingCount: 9,  armoredCount: 1, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.75, interval: 9,  clusterChance: 0.1 },
  { wave: 4, smallCount: 40, largeCount: 6, flyingCount: 11, armoredCount: 1, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.85, interval: 8,  clusterChance: 0.2 },
  { wave: 5, smallCount: 48, largeCount: 8, flyingCount: 13, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.95, interval: 7,  clusterChance: 0.3 },
  { wave: 6, smallCount: 55, largeCount: 9, flyingCount: 15, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 1.0,  interval: 6,  clusterChance: 0.35 },
];

// 场景 3：垃圾场 —— 新增装甲蟑螂，共 6 波（更紧凑、更难）
export const WAVE_CONFIGS_DUMP: WaveConfig[] = [
  { wave: 1, smallCount: 12, largeCount: 2, flyingCount: 2, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.5,  interval: 12, clusterChance: 0.05 },
  { wave: 2, smallCount: 18, largeCount: 3, flyingCount: 3, armoredCount: 3, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.58, interval: 10, clusterChance: 0.1 },
  { wave: 3, smallCount: 26, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, speed: 0.65, interval: 9,  clusterChance: 0.15 },
  { wave: 4, smallCount: 34, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, speed: 0.72, interval: 8,  clusterChance: 0.2 },
  { wave: 5, smallCount: 42, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 0, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, speed: 0.82, interval: 7,  clusterChance: 0.3 },
  { wave: 6, smallCount: 50, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 0, suicideCount: 3, flyingSuicideCount: 0, queenCount: 0, speed: 0.92, interval: 6,  clusterChance: 0.38 },
];

// 场景 4：地下室 —— 新增分裂 + 自爆蟑螂，速度快、数量多
export const WAVE_CONFIGS_BASEMENT: WaveConfig[] = [
  { wave: 1, smallCount: 15, largeCount: 3, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, speed: 0.60, interval: 9,  clusterChance: 0.15 },
  { wave: 2, smallCount: 22, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, speed: 0.644, interval: 8,  clusterChance: 0.2 },
  { wave: 3, smallCount: 30, largeCount: 5, flyingCount: 5, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, speed: 0.688, interval: 8,  clusterChance: 0.25 },
  { wave: 4, smallCount: 38, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 0, queenCount: 0, speed: 0.732, interval: 7,  clusterChance: 0.3 },
  { wave: 5, smallCount: 48, largeCount: 7, flyingCount: 7, armoredCount: 4, splittingCount: 5, suicideCount: 3, flyingSuicideCount: 0, queenCount: 0, speed: 0.776, interval: 7,  clusterChance: 0.35 },
  { wave: 6, smallCount: 55, largeCount: 8, flyingCount: 8, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 0, queenCount: 0, speed: 0.82, interval: 6,  clusterChance: 0.4 },
];

// 场景 5：天台决战 —— 全种类蟑螂 + 蟑螂女王 Boss，最高难度
export const WAVE_CONFIGS_ROOFTOP: WaveConfig[] = [
  { wave: 1, smallCount: 14, largeCount: 3, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 1, flyingSuicideCount: 1, queenCount: 0, speed: 0.65, interval: 8,  clusterChance: 0.2 },
  { wave: 2, smallCount: 20, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, speed: 0.69, interval: 7,  clusterChance: 0.25 },
  { wave: 3, smallCount: 28, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 3, queenCount: 0, speed: 0.73, interval: 7,  clusterChance: 0.3 },
  { wave: 4, smallCount: 35, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.77, interval: 6,  clusterChance: 0.35 },
  { wave: 5, smallCount: 42, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 4, queenCount: 0, speed: 0.81, interval: 6,  clusterChance: 0.4 },
  { wave: 6, smallCount: 50, largeCount: 7, flyingCount: 7, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.85, interval: 5,  clusterChance: 0.45 },
];

// 场景波次配置映射
// 街道场景：最终章，包含蟑螂女王 Boss
export const WAVE_CONFIGS_STREET: WaveConfig[] = [
  { wave: 1, smallCount: 15, largeCount: 3, flyingCount: 3, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, speed: 0.70, interval: 7, clusterChance: 0.25 },
  { wave: 2, smallCount: 22, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.74, interval: 6, clusterChance: 0.3 },
  { wave: 3, smallCount: 28, largeCount: 5, flyingCount: 5, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.78, interval: 6, clusterChance: 0.35 },
  { wave: 4, smallCount: 35, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.82, interval: 5, clusterChance: 0.4 },
  { wave: 5, smallCount: 42, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 4, queenCount: 0, speed: 0.86, interval: 5, clusterChance: 0.45 },
  { wave: 6, smallCount: 40, largeCount: 5, flyingCount: 5, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.90, interval: 4, clusterChance: 0.5 },
];

// ========== 新场景波次配置（v2.4） ==========
// ========== 医院 8 波配置 ==========
// 所有自爆蟑螂替换为定时自爆蟑螂
// 每波最多 2 只 timed_suicide，mutant 数量从 1 递增到 6
export const WAVE_CONFIGS_HOSPITAL: WaveConfig[] = [
  // Wave 1: Intro - 1 mutant + 1 timed suicide (gentle intro)
  { wave: 1, smallCount: 6, largeCount: 2, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.65, interval: 9, clusterChance: 0.15, nurseCount: 1, mutantCount: 1, timedSuicideCount: 1, eggPoolActiveCount: 0 },
  // Wave 2: Egg pool - 2 mutants + 1 timed
  { wave: 2, smallCount: 8, largeCount: 3, flyingCount: 1, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.70, interval: 8, clusterChance: 0.2, nurseCount: 1, mutantCount: 2, timedSuicideCount: 1, eggPoolActiveCount: 1 },
  // Wave 3: First nurse + 3 mutants + 1 timed
  { wave: 3, smallCount: 8, largeCount: 3, flyingCount: 2, armoredCount: 1, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.75, interval: 7, clusterChance: 0.25, nurseCount: 1, mutantCount: 3, timedSuicideCount: 1, eggPoolActiveCount: 1 },
  // Wave 4: 4 mutants + 2 timed
  { wave: 4, smallCount: 8, largeCount: 3, flyingCount: 2, armoredCount: 2, splittingCount: 1, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.80, interval: 7, clusterChance: 0.3, nurseCount: 1, mutantCount: 4, timedSuicideCount: 2, eggPoolActiveCount: 1 },
  // Wave 5: 4 mutants + 2 timed (max 2 per wave)
  { wave: 5, smallCount: 8, largeCount: 4, flyingCount: 4, armoredCount: 2, splittingCount: 1, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.85, interval: 6, clusterChance: 0.35, nurseCount: 1, mutantCount: 4, timedSuicideCount: 2, eggPoolActiveCount: 1 },
  // Wave 6: 5 mutants + 2 timed
  { wave: 6, smallCount: 6, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.90, interval: 5, clusterChance: 0.4, nurseCount: 1, mutantCount: 5, timedSuicideCount: 2, eggPoolActiveCount: 2 },
  // Wave 7: 5 mutants + 2 timed
  { wave: 7, smallCount: 6, largeCount: 4, flyingCount: 5, armoredCount: 3, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.95, interval: 5, clusterChance: 0.45, nurseCount: 1, mutantCount: 5, timedSuicideCount: 2, eggPoolActiveCount: 2 },
  // Wave 8: Final - 6 mutants + 2 timed (max 2 per wave)
  { wave: 8, smallCount: 4, largeCount: 4, flyingCount: 5, armoredCount: 3, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 1.0, interval: 4, clusterChance: 0.5, nurseCount: 1, mutantCount: 6, timedSuicideCount: 2, eggPoolActiveCount: 2 },
];

// 地铁 10 波（无女王Boss；小蟑螂回归消耗燃气，分裂/变异蟑螂加入混编；
// 大蟑螂/装甲/自爆/飞爆/隧道工/精英 混编，密度与威胁逐波递增，中等偏难）
// 平衡 v2.6：全关 HP+护甲流入从 ~13666 下调至 ~5900（约为原 43%），与其他场景难度曲线接轨；
// 精英/护盾/隧道工为场景机制锚点，数量保留核心编成；小/分裂/变异为低血量填充与袭扰
export const WAVE_CONFIGS_SUBWAY: WaveConfig[] = [
  // 波1：教学过渡，熟悉风扇吹怪、聚拢分散（小/大蟑螂加量，自爆首现）
  { wave: 1, smallCount: 9, largeCount: 13, flyingCount: 2, armoredCount: 0, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, mutantCount: 0, eliteCount: 1, tunnelWorkerCount: 1, shieldCount: 0, speed: 0.78, interval: 6, clusterChance: 0.15 },
  // 波2：火墙破甲 + 风扇吹向列车轨道（分裂蟑螂首登场）
  { wave: 2, smallCount: 10, largeCount: 13, flyingCount: 2, armoredCount: 1, splittingCount: 1, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, mutantCount: 0, eliteCount: 1, tunnelWorkerCount: 1, shieldCount: 0, speed: 0.82, interval: 6, clusterChance: 0.2 },
  // 波3：首次遇到隧道工 + 首只变异蟑螂（自爆加量）
  { wave: 3, smallCount: 11, largeCount: 13, flyingCount: 2, armoredCount: 0, splittingCount: 1, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, mutantCount: 1, tunnelWorkerCount: 1, eliteCount: 1, shieldCount: 0, speed: 0.86, interval: 5, clusterChance: 0.2 },
  // 波4：护盾蟑螂首登场（盾墙推进阵型首现）+ 装甲群，考验破盾 + 列车时机（定时自爆登场）
  { wave: 4, smallCount: 11, largeCount: 12, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, mutantCount: 1, tunnelWorkerCount: 1, eliteCount: 2, shieldCount: 1, timedSuicideCount: 1, speed: 0.88, interval: 5, clusterChance: 0.25 },
  // 波5：精英冲锋 + 飞行自爆加量，火墙/风扇控制 + 列车碾压
  { wave: 5, smallCount: 12, largeCount: 13, flyingCount: 3, armoredCount: 1, splittingCount: 2, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, mutantCount: 1, tunnelWorkerCount: 1, eliteCount: 2, shieldCount: 1, timedSuicideCount: 1, speed: 0.90, interval: 5, clusterChance: 0.25 },
  // 波6：高压——精英冲刺 + 护盾阵型 + 隧道工喷涂 + 护甲群 + 自爆
  { wave: 6, smallCount: 12, largeCount: 12, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, mutantCount: 1, tunnelWorkerCount: 1, eliteCount: 3, shieldCount: 1, timedSuicideCount: 1, speed: 0.93, interval: 4, clusterChance: 0.3 },
  // 波7：分神——精英群 + 护盾阵型 + 隧道工同时压场（双变异蟑螂）
  { wave: 7, smallCount: 13, largeCount: 13, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, mutantCount: 2, tunnelWorkerCount: 1, eliteCount: 3, shieldCount: 1, timedSuicideCount: 1, speed: 0.96, interval: 4, clusterChance: 0.3 },
  // 波8：高压护甲群 + 精英群 + 护盾阵型 + 自爆压制
  { wave: 8, smallCount: 13, largeCount: 13, flyingCount: 4, armoredCount: 2, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, mutantCount: 2, tunnelWorkerCount: 1, eliteCount: 3, shieldCount: 1, timedSuicideCount: 1, speed: 0.99, interval: 4, clusterChance: 0.35 },
  // 波9：持续高压——双隧道工喷涂 + 双护盾阵型 + 精英群
  { wave: 9, smallCount: 14, largeCount: 13, flyingCount: 4, armoredCount: 2, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, mutantCount: 2, tunnelWorkerCount: 1, eliteCount: 3, shieldCount: 1, timedSuicideCount: 1, speed: 1.02, interval: 3, clusterChance: 0.35 },
  // 波10：终局——精英群/护甲群/护盾阵型压场，隧道工全线喷涂
  { wave: 10, smallCount: 15, largeCount: 14, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, mutantCount: 2, tunnelWorkerCount: 1, eliteCount: 4, shieldCount: 1, timedSuicideCount: 1, speed: 1.05, interval: 3, clusterChance: 0.4 },
];

// 超市 10 波（V5.0 直驱制阵型：自由杂兵先行热场 → 队列清空后全部阵型组同帧整组生成（多组纵深错位）→ 推进全程 trickle 穿插偷袭）
// 阵型组 = 固定槽位清单（540×960 绝对坐标，出生点即槽位）：前排装甲/护盾（承伤）｜中排分裂/定时自爆/隧道工（功能）｜后排护士（治疗）
// 锚点规则：前排领袖（离阵型质心最近的前排）+ 全部隧道工 + 护士；orbit 组仅核心锚点（环成员为其顶替承伤）
// 运动标记：sway 横向摇摆（相位错开）｜orbit 绕阵型中心旋转｜缺省固定槽位
// 小/大/飞行/地面自爆/地铁精英 = 自由杂兵（原生AI，不入阵）；永久禁用女王；clusterChance 全 0（阵型编排由编队系统接管）
export const WAVE_CONFIGS_SUPERMARKET: WaveConfig[] = [
  // ===== 1~3波：前期热场（小/大蟑螂消耗燃气 → 1组阵列 → 穿插地面自爆+飞行袭扰） =====
  // 波1：热场·首阵——热场小怪 + 首组散兵阵列（护盾锚点+分裂3前排），自爆随后偷袭
  { wave: 1, smallCount: 15, largeCount: 8, flyingCount: 5, armoredCount: 2, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.78, interval: 6, clusterChance: 0, name: '热场·首阵',
    formationGroups: [
      { slots: [
        { type: RoachType.SPLITTING, x: 231, y: 363 },
        { type: RoachType.SPLITTING, x: 319, y: 363 },
        { type: RoachType.SPLITTING, x: 274, y: 363 },
        { type: RoachType.SHIELD, x: 276, y: 389, anchor: true },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.SMALL, RoachType.FLYING_SUICIDE], total: 4, intervalSec: 2 } },
  // 波2：热场·盾墙——护盾锚点 + 分裂3 散兵线
  { wave: 2, smallCount: 15, largeCount: 8, flyingCount: 8, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.80, interval: 6, clusterChance: 0, name: '热场·盾墙',
    formationGroups: [
      { slots: [
        { type: RoachType.SPLITTING, x: 276, y: 363 },
        { type: RoachType.SHIELD, x: 275, y: 399, anchor: true },
        { type: RoachType.SPLITTING, x: 323, y: 364 },
        { type: RoachType.SPLITTING, x: 221, y: 363 },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE, RoachType.FLYING], total: 5, intervalSec: 2 } },
  // 波3：方阵·初鸣——飞行杂兵入场 + 护盾护士方阵（护士续航初登场）
  { wave: 3, smallCount: 18, largeCount: 10, flyingCount: 5, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.84, interval: 5, clusterChance: 0, name: '方阵·初鸣',
    formationGroups: [
      { slots: [
        { type: RoachType.TIMED_SUICIDE, x: 269, y: 359 },
        { type: RoachType.NURSE, x: 234, y: 388, anchor: true },
        { type: RoachType.SHIELD, x: 301, y: 428, anchor: true },
        { type: RoachType.SPLITTING, x: 321, y: 363 },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE, RoachType.SMALL], total: 5, intervalSec: 2 } },
  // ===== 4~6波：中期压力上升（杂兵池扩充飞行 → 2组独立阵列同帧生成（纵深错位）→ 穿插地面/飞行自爆） =====
  // 波4：双阵·楔袭——护盾+护士摇摆阵列 + 护盾隧道工阵列
  { wave: 4, smallCount: 10, largeCount: 4, flyingCount: 8, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.88, interval: 5, clusterChance: 0, name: '双阵·楔袭',
    formationGroups: [
      { slots: [
        { type: RoachType.SPLITTING, x: 235, y: 363 },
        { type: RoachType.TIMED_SUICIDE, x: 289, y: 363 },
        { type: RoachType.SHIELD, x: 267, y: 430, anchor: true },
        { type: RoachType.NURSE, x: 221, y: 390, motion: 'sway' },
      ] },
      { slots: [
        { type: RoachType.SPLITTING, x: 298, y: 363 },
        { type: RoachType.SHIELD, x: 270, y: 411, anchor: true },
        { type: RoachType.TUNNEL_WORKER, x: 236, y: 363 },
        { type: RoachType.SPLITTING, x: 203, y: 383 },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE, RoachType.SMALL, RoachType.FLYING], total: 6, intervalSec: 2 } },
  // 波5：双阵·穿插——护盾+隧道工阵列 + 续航阵列（护盾+护士）
  { wave: 5, smallCount: 10, largeCount: 3, flyingCount: 2, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.90, interval: 5, clusterChance: 0, name: '双阵·穿插',
    formationGroups: [
      { slots: [
        { type: RoachType.SHIELD, x: 243, y: 419, anchor: true },
        { type: RoachType.TUNNEL_WORKER, x: 314, y: 379 },
        { type: RoachType.SPLITTING, x: 220, y: 371 },
        { type: RoachType.SPLITTING, x: 190, y: 398 },
      ] },
      { slots: [
        { type: RoachType.SHIELD, x: 314, y: 409 },
        { type: RoachType.SPLITTING, x: 268, y: 363 },
        { type: RoachType.SPLITTING, x: 223, y: 363 },
        { type: RoachType.NURSE, x: 249, y: 369, anchor: true },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE, RoachType.SMALL, RoachType.FLYING, RoachType.LARGE], total: 7, intervalSec: 2 } },
  // 波6：双阵·纵队——混合纵队（装甲锚点+护盾+双定时自爆）+ 大编队（隧道工+护士双锚、分裂3）
  { wave: 6, smallCount: 10, largeCount: 5, flyingCount: 3, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.93, interval: 4, clusterChance: 0, name: '双阵·纵队',
    formationGroups: [
      { slots: [
        { type: RoachType.ARMORED, x: 215, y: 393, anchor: true },
        { type: RoachType.SHIELD, x: 305, y: 405 },
        { type: RoachType.SPLITTING, x: 255, y: 362 },
        { type: RoachType.SPLITTING, x: 281, y: 377 },
        { type: RoachType.TIMED_SUICIDE, x: 254, y: 363 },
        { type: RoachType.TIMED_SUICIDE, x: 318, y: 359 },
      ] },
      { slots: [
        { type: RoachType.TUNNEL_WORKER, x: 277, y: 371, anchor: true },
        { type: RoachType.NURSE, x: 261, y: 365, anchor: true },
        { type: RoachType.SHIELD, x: 308, y: 405 },
        { type: RoachType.TIMED_SUICIDE, x: 327, y: 369 },
        { type: RoachType.SPLITTING, x: 227, y: 373 },
        { type: RoachType.SPLITTING, x: 261, y: 369 },
        { type: RoachType.SPLITTING, x: 292, y: 363 },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE, RoachType.SMALL, RoachType.FLYING], total: 6, intervalSec: 1.5 } },
  // ===== 7~9波：后期高压（自爆/精英高危杂兵先行 → 3组独立阵列同帧生成（纵深错位）→ 穿插池扩充定时自爆） =====
  // 波7：三阵·合围——护盾冲锋（双定时自爆）+ 续航阵列 + 摇摆组（隧道工+护盾双锚）
  { wave: 7, smallCount: 8, largeCount: 3, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, eliteCount: 1, speed: 0.96, interval: 4, clusterChance: 0, name: '三阵·合围',
    formationGroups: [
      { slots: [
        { type: RoachType.SHIELD, x: 256, y: 415, anchor: true },
        { type: RoachType.TIMED_SUICIDE, x: 212, y: 359 },
        { type: RoachType.TIMED_SUICIDE, x: 276, y: 359, motion: 'sway' },
        { type: RoachType.TUNNEL_WORKER, x: 318, y: 364 },
      ] },
      { slots: [
        { type: RoachType.SHIELD, x: 251, y: 438, anchor: true },
        { type: RoachType.SPLITTING, x: 236, y: 362 },
        { type: RoachType.SPLITTING, x: 287, y: 359 },
        { type: RoachType.NURSE, x: 298, y: 398, anchor: true },
      ] },
      { slots: [
        { type: RoachType.TIMED_SUICIDE, x: 305, y: 359, motion: 'sway' },
        { type: RoachType.TIMED_SUICIDE, x: 238, y: 361, motion: 'sway' },
        { type: RoachType.TUNNEL_WORKER, x: 238, y: 381, anchor: true, motion: 'sway' },
        { type: RoachType.SHIELD, x: 279, y: 421, anchor: true, motion: 'sway' },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE, RoachType.SMALL, RoachType.FLYING, RoachType.LARGE], total: 7, intervalSec: 1.5 } },
  // 波8：三阵·环卫——orbit 双分裂环卫（护士核心锚点）+ 护盾大编队 + 隧道工护士双人组
  { wave: 8, smallCount: 8, largeCount: 4, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, eliteCount: 1, speed: 0.99, interval: 4, clusterChance: 0, name: '三阵·环卫',
    formationGroups: [
      { slots: [
        { type: RoachType.SHIELD, x: 269, y: 406 },
        { type: RoachType.SPLITTING, x: 310, y: 363, motion: 'orbit' },
        { type: RoachType.SPLITTING, x: 222, y: 359, motion: 'orbit' },
        { type: RoachType.NURSE, x: 268, y: 366, anchor: true },
      ] },
      { slots: [
        { type: RoachType.SHIELD, x: 278, y: 407, anchor: true },
        { type: RoachType.TIMED_SUICIDE, x: 279, y: 372 },
        { type: RoachType.SPLITTING, x: 227, y: 382 },
        { type: RoachType.SPLITTING, x: 327, y: 374 },
        { type: RoachType.SPLITTING, x: 251, y: 388 },
        { type: RoachType.TUNNEL_WORKER, x: 322, y: 367 },
      ] },
      { slots: [
        { type: RoachType.SPLITTING, x: 230, y: 377 },
        { type: RoachType.TUNNEL_WORKER, x: 299, y: 408, anchor: true },
        { type: RoachType.NURSE, x: 245, y: 446, anchor: true },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE, RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE], total: 8, intervalSec: 1 } },
  // 波9：三阵·双锋——三锚护卫（护盾+隧道工+护士）+ 隧道工锚冲锋（双定时自爆）+ 分裂3方阵
  { wave: 9, smallCount: 10, largeCount: 4, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, eliteCount: 1, speed: 1.02, interval: 4, clusterChance: 0, name: '三阵·双锋',
    formationGroups: [
      { slots: [
        { type: RoachType.SHIELD, x: 268, y: 413, anchor: true },
        { type: RoachType.TIMED_SUICIDE, x: 226, y: 361 },
        { type: RoachType.TIMED_SUICIDE, x: 307, y: 359 },
        { type: RoachType.TUNNEL_WORKER, x: 320, y: 373, anchor: true },
        { type: RoachType.NURSE, x: 222, y: 373, anchor: true },
      ] },
      { slots: [
        { type: RoachType.TIMED_SUICIDE, x: 253, y: 363 },
        { type: RoachType.TIMED_SUICIDE, x: 310, y: 363 },
        { type: RoachType.TUNNEL_WORKER, x: 291, y: 393, anchor: true },
      ] },
      { slots: [
        { type: RoachType.SPLITTING, x: 231, y: 378 },
        { type: RoachType.SPLITTING, x: 271, y: 359 },
        { type: RoachType.SPLITTING, x: 318, y: 374 },
        { type: RoachType.NURSE, x: 275, y: 409, anchor: true },
        { type: RoachType.TIMED_SUICIDE, x: 299, y: 363 },
        { type: RoachType.SHIELD, x: 240, y: 449, motion: 'sway' },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE, RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING], total: 8, intervalSec: 1.5 } },
  // ===== 第10波：终局·群阵（4组独立阵列同帧生成、纵深错位；混合杂兵全程穿插） =====
  { wave: 10, smallCount: 12, largeCount: 5, flyingCount: 3, armoredCount: 0, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, eliteCount: 1, speed: 1.05, interval: 3, clusterChance: 0, name: '终局·群阵',
    formationGroups: [
      { slots: [
        { type: RoachType.SHIELD, x: 271, y: 413, anchor: true, motion: 'sway' },
        { type: RoachType.TIMED_SUICIDE, x: 268, y: 359 },
        { type: RoachType.TUNNEL_WORKER, x: 334, y: 365 },
      ] },
      { slots: [
        { type: RoachType.SPLITTING, x: 223, y: 394 },
        { type: RoachType.SPLITTING, x: 341, y: 412 },
        { type: RoachType.NURSE, x: 272, y: 359, anchor: true },
        { type: RoachType.TIMED_SUICIDE, x: 345, y: 363 },
        { type: RoachType.TUNNEL_WORKER, x: 206, y: 397 },
      ] },
      { slots: [
        { type: RoachType.SHIELD, x: 254, y: 436, anchor: true, motion: 'sway' },
        { type: RoachType.TIMED_SUICIDE, x: 240, y: 359 },
        { type: RoachType.TIMED_SUICIDE, x: 191, y: 402 },
        { type: RoachType.TUNNEL_WORKER, x: 309, y: 394, anchor: true },
      ] },
      { slots: [
        { type: RoachType.SPLITTING, x: 204, y: 390 },
        { type: RoachType.SPLITTING, x: 358, y: 370 },
        { type: RoachType.SPLITTING, x: 325, y: 410 },
        { type: RoachType.NURSE, x: 275, y: 359, anchor: true },
        { type: RoachType.TUNNEL_WORKER, x: 246, y: 388 },
      ] },
    ],
    trickle: { types: [RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING_SUICIDE, RoachType.SMALL, RoachType.FLYING, RoachType.LARGE, RoachType.FLYING, RoachType.FLYING_SUICIDE], total: 9, intervalSec: 1.5 } },
];

// 学校 10 波（体育生蟑螂专属场景，初始关卡难度，整体低于巢穴，女王压阵）
export const WAVE_CONFIGS_SCHOOL: WaveConfig[] = [
  // ===== 1~3波：前期热场（体量克制，体育生穿插，引导玩家抓蓄力窗口） =====
  { wave: 1, smallCount: 16, largeCount: 3, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 2, flyingSuicideCount: 1, queenCount: 0, jockCount: 2, speed: 0.78, interval: 6, clusterChance: 0.25 },
  { wave: 2, smallCount: 21, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, jockCount: 3, speed: 0.80, interval: 5, clusterChance: 0.3 },
  { wave: 3, smallCount: 26, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 2, queenCount: 0, jockCount: 4, speed: 0.82, interval: 5, clusterChance: 0.35 },
  // ===== 4~6波：中期压力上升（跳跃蟑螂稳定在场，杂兵池缓慢扩充） =====
  { wave: 4, smallCount: 30, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, jockCount: 5, speed: 0.85, interval: 4, clusterChance: 0.4 },
  { wave: 5, smallCount: 34, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, jockCount: 6, speed: 0.88, interval: 4, clusterChance: 0.45 },
  { wave: 6, smallCount: 38, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, jockCount: 6, speed: 0.91, interval: 4, clusterChance: 0.5 },
  // ===== 7~9波：后期加压（多兵种协同但维持在中期水平，精英渐进） =====
  { wave: 7, smallCount: 40, largeCount: 6, flyingCount: 6, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, jockCount: 7, speed: 0.93, interval: 3.5, clusterChance: 0.55 },
  { wave: 8, smallCount: 42, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, eliteCount: 1, jockCount: 7, speed: 0.95, interval: 3.5, clusterChance: 0.6 },
  { wave: 9, smallCount: 44, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 5, queenCount: 0, eliteCount: 1, jockCount: 8, speed: 0.97, interval: 3, clusterChance: 0.65 },
  // ===== 第10波：终局·女王降临（女王+体育生齐压封顶） =====
  { wave: 10, smallCount: 46, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 5, queenCount: 1, eliteCount: 1, jockCount: 8, speed: 1.0, interval: 3, clusterChance: 0.7 },
];

// 巢穴 6 波（最高难度，包含女王）
export const WAVE_CONFIGS_NEST: WaveConfig[] = [
  { wave: 1, smallCount: 25, largeCount: 6, flyingCount: 6, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, speed: 0.82, interval: 6, clusterChance: 0.35 },
  { wave: 2, smallCount: 34, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, speed: 0.86, interval: 5, clusterChance: 0.4 },
  { wave: 3, smallCount: 42, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 5, queenCount: 0, speed: 0.90, interval: 5, clusterChance: 0.45 },
  { wave: 4, smallCount: 50, largeCount: 9, flyingCount: 9, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 6, queenCount: 0, speed: 0.94, interval: 4, clusterChance: 0.5 },
  { wave: 5, smallCount: 58, largeCount: 10, flyingCount: 10, armoredCount: 7, splittingCount: 7, suicideCount: 6, flyingSuicideCount: 6, queenCount: 0, speed: 0.98, interval: 4, clusterChance: 0.55 },
  { wave: 6, smallCount: 55, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 5, suicideCount: 5, flyingSuicideCount: 5, queenCount: 1, speed: 1.05, interval: 3, clusterChance: 0.6 },
];

/**
 * 场景波次配置映射表
 * 将每个场景类型映射到对应的波次配置数组
 */
export const SCENE_WAVE_CONFIGS: Record<SceneType, WaveConfig[]> = {
  [SceneType.KITCHEN]: WAVE_CONFIGS_KITCHEN,
  [SceneType.SEWER]: WAVE_CONFIGS_SEWER,
  [SceneType.DUMP]: WAVE_CONFIGS_DUMP,
  [SceneType.BASEMENT]: WAVE_CONFIGS_BASEMENT,
  [SceneType.ROOFTOP]: WAVE_CONFIGS_ROOFTOP,
  [SceneType.STREET]: WAVE_CONFIGS_STREET,
  [SceneType.HOSPITAL]: WAVE_CONFIGS_HOSPITAL,
  [SceneType.SUBWAY]: WAVE_CONFIGS_SUBWAY,
  [SceneType.SUPERMARKET]: WAVE_CONFIGS_SUPERMARKET,
  [SceneType.SCHOOL]: WAVE_CONFIGS_SCHOOL,
  [SceneType.NEST]: WAVE_CONFIGS_NEST,
};

// ========== 波次系统数值平衡（从 balance.ts 拆分合并） ==========
/**
 * 波次系统平衡参数
 * @description 控制波次切换、敌人生成间隔、奖励倍率、难度缩放等核心逻辑。
 */
export const BALANCE_WAVE = {
  wave: {
    clearDelay: 2,           // 波次清除后延迟（秒），显示"波次清除"文字
    clearTimer: 6,           // 波次清除计时器（秒），等待下一波
    baseReward: 50,          // 基础波次奖励金币
    rewardPerWave: 10,       // 每波额外奖励（波次 * 10）
    rewardMultiplier: { easy: 0.8, hard: 1.5 }, // 难度奖励倍率
    perfectMultiplier: 1.5,  // 完美波次（无突破）奖励倍率
    baseInterval: 0.8,       // 基础敌人生成间隔（秒）
    intervalMultiplier: { easy: 1.2, hard: 0.7 }, // 难度生成间隔倍率
    intervalReductionPerWave: 0.05, // 每波间隔减少量
    intervalMin: 0.2,        // 最小生成间隔（秒）
    difficultyMultiplier: { easy: 0.7, hard: 1.5 }, // 难度系数
    difficultyPerWave: 0.1,  // 每波难度增量
    // 默认波次配置（用于无尽模式或未定义场景的回退）
    defaultConfig: {
      smallCount: 10, largeCount: 5, flyingCount: 3, armoredCount: 2,
      splittingCount: 1, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0,
      speed: 1.0, interval: 1.0, spawnInterval: 0.5, clusterChance: 0.3,
    },
    spawnTimerMin: 0.3,      // 最小生成计时器（秒）
    spawnTimerMax: 0.8,      // 最大生成计时器（秒）
    phase1Ratio: 0.3,        // 第一阶段占比（30% 的蟑螂先生成）
    phase2Ratio: 0.5,        // 第二阶段占比（50% 的蟑螂生成）
    countdownDuration: 3.0,  // 倒计时总时长（秒）
    countdownPhases: 3,      // 倒计时阶段数（3-2-1）
    // 虫卵孵化池配置（医院场景）
    eggPod: {
      baseW: 72, baseH: 96,  // 虫卵基础尺寸（像素）
      yMin: 361, yMax: 612,  // 虫卵 Y 坐标范围（从屏幕顶部）
      hatchTime: 5,          // 孵化时间（秒）
      barW: 60, barH: 6,     // 进度条尺寸（像素）
      barOffsetY: 10,        // 进度条 Y 偏移（像素）
      pulseFreq: 6,          // 虫卵脉冲频率
      pulseRadius: 8,        // 虫卵脉冲半径（像素）
    },
  },
} as const;