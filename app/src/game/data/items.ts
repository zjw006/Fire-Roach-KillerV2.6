import type { ConsumableDef } from '../types';

// ========== 消耗品定义（关卡内商店，一次性使用） ==========
/**
 * 消耗品定义列表
 * @description 定义关卡内商店可购买的一次性道具，包含价格、冷却时间、效果说明等。
 * 消耗品在关卡开始前通过商店购买，进入关卡后自动激活或手动使用。
 * - cooldown: 道具使用后的冷却时间（秒），0 表示无冷却（如紧急冷却）
 * - cost: 购买价格（金币）
 * - effectDesc: 道具效果的中文描述
 */
export const CONSUMABLE_DEFS: ConsumableDef[] = [
  {
    id: 'gas_refill', name: '气罐补给', description: '立即回满燃气',
    cost: 250, icon: '/assets/consumable_gas.png', effectDesc: '燃气回满', color: 'from-amber-600 to-amber-700',
    cooldown: 3, // 3 秒冷却，防止连续使用
  },
  {
    id: 'defense_repair', name: '防线修复', description: '防线 HP +20%',
    cost: 400, icon: '/assets/consumable_repair.png', effectDesc: '修复防线 20%', color: 'from-green-600 to-green-700',
    cooldown: 8, // 8 秒冷却，修复效果较强需要较长冷却
  },
  {
    id: 'emergency_cool', name: '紧急冷却', description: '立即清除过热',
    cost: 200, icon: '/assets/consumable_cool.png', effectDesc: '瞬间冷却', color: 'from-blue-600 to-blue-700',
    // no cooldown - 紧急冷却无冷却时间，可在过热时立即使用
  },
  {
    id: 'power_boost', name: '火力全开', description: '8秒内伤害 x2',
    cost: 700, icon: '/assets/consumable_power.png', effectDesc: '双倍伤害 8秒', color: 'from-red-600 to-red-700',
    cooldown: 10, // 10 秒冷却，防止连续使用双倍伤害
  },
  {
    id: 'shield', name: '临时护盾', description: '防线 5秒无敌',
    cost: 800, icon: '/assets/consumable_shield.png', effectDesc: '防线无敌 5秒', color: 'from-cyan-600 to-cyan-700',
    cooldown: 8, // 8 秒冷却，无敌效果结束后需要等待
  },
  {
    id: 'bait', name: '蟑螂诱饵', description: '全场蟑螂聚拢 3秒',
    cost: 450, icon: '/assets/consumable_bait.png', effectDesc: '聚拢蟑螂 3秒', color: 'from-purple-600 to-purple-700',
    cooldown: 6, // 6 秒冷却，配合火墙等范围武器使用效果最佳
  },
];

// ========== 武器掉落配置 ==========
/**
 * 武器掉落配置
 * @description 定义战斗中可拾取的武器道具属性。
 * 实际持续时间由 BALANCE_CONFIG 中对应子系统的配置决定（如 fan.defaultDuration、sticky.wrapTimer 等），
 * 此处仅保留 name（拾取文字）、ammo（弹药数量）、cooldown（冷却时间）。
 * - ammo: 弹药数量（燃烧瓶/散弹等消耗枚数，喷雾类为持续帧数）
 * - cooldown: 拾取后再次掉落该武器的冷却时间（秒）
 */
export const WEAPON_DROP_DEFS = {
  sticky:  { name: '蟑螂贴板', color: '#facc15', ammo: 3,  cooldown: 5 },
  poison:  { name: '杀虫剂',  color: '#4ade80', ammo: 40, cooldown: 6 },
  shotgun: { name: '散弹模式', color: '#fbbf24', ammo: 30, cooldown: 10 },
  molotov: { name: '燃烧瓶',  color: '#f87171', ammo: 5,  cooldown: 10 },
  radar:   { name: '雷达激光', color: '#22d3ee', ammo: 20, cooldown: 8 },
  fan:     { name: '强力风扇', color: '#a78bfa', ammo: 5,  cooldown: 8 },
  swatter: { name: '电蚊拍',  color: '#fbbf24', type: 'instant' as const, ammo: 1,  cooldown: 10 }, // type='instant' 表示一次性使用，无需持续计时
  knife:   { name: '斩螂·110', color: '#e2e8f0', ammo: 3,  cooldown: 5 }, // 近战秒杀：自动跃向威胁最高的目标
};

// 拾取道具回收价格（关卡结束时未使用的道具折合金币）
// 价格设定基于道具稀有度和实用性，较稀有的道具回收价更高
export const INVENTORY_SELL_PRICES: Record<string, number> = {
  sticky:  5,   // 基础控制道具，价格最低
  poison:  8,   // 毒雾持续伤害
  molotov: 10,  // 高伤害爆发
  shotgun: 12,  // 三管齐发，稀有
  radar:   10,  // 自动追踪，稀有
  fan:     8,   // 全场减速控制
  swatter: 15,  // 全屏秒杀，最稀有
  knife:   12,  // 近战秒杀，高价值
};

// ========== Boss 配置 ==========
/**
 * Boss 战斗配置
 * @description 蟑螂女王 Boss 战的参数配置。
 * - spawnInterval: 召唤小兵的间隔（秒）
 * - minionCount: 每次召唤的小兵数量
 * - phaseHpThresholds: 阶段切换的 HP 比例阈值（70%/40%/20%）
 * - resistPercent: 火焰抗性百分比（50% 即伤害减半）
 */
export const BOSS_CONFIG = {
  queen: {
    spawnInterval: 8,       // 每 8 秒召唤一次
    minionCount: 3,         // 每次召唤 3 只小蟑螂
    phaseHpThresholds: [0.7, 0.4, 0.2], // 三阶段 HP 阈值
    resistPercent: 0.5,     // 50% 火焰抗性
  },
};

// ========== 武器/道具/经济数值平衡（从 balance.ts 拆分合并） ==========
export const BALANCE_ITEMS = {
  // ===== 武器伤害 =====
  // 不同难度下的武器伤害值，easy 约 1.5x hard
  weaponDamage: {
    flamethrower: { easy: 45, hard: 30 }, // 火焰喷射器基础伤害
    poison: { easy: 20, hard: 12 },        // 毒雾每跳伤害
    shotgun: { easy: 50, hard: 35 },       // 散弹单发伤害
    molotov: { easy: 40, hard: 25 },       // 燃烧瓶基础伤害
    fallback: { easy: 45, hard: 30 },      // 兜底伤害（未识别武器时使用）
    fireZoneDpsMultiplier: 3,              // 火焰区域 DPS 倍率
    fireZoneMaxLife: 0.5,                  // 火焰区域最大存活时间（秒）
    fireZoneMaxCount: 25,                  // 同时存在的火焰区域数量上限
  },

  // ===== 雷达激光 =====
  // 自动追踪激光系统，锁定最近目标自动射击
  radarLaser: {
    duration: 5,                 // 激活持续时间（秒）
    fireInterval: 0.3,           // 射击间隔（秒）
    damage: 10,                  // 单发伤害
    shotsRemaining: 5,           // 剩余弹药数
    countdownWarnTimes: [3, 1] as readonly number[], // 倒计时警告时间点（秒）
    sparkCount: 8,               // 命中火花粒子数量
    impactParticle: { vy: -20, life: 0.3, size: 8 }, // 命中粒子效果参数
    textOffsetY: {               // 浮动文字 Y 偏移量（像素）
      activate: -60,
      desc: -40,
      countdown: -80,
      closing: -60,
      closed: -50,
      exhausted: -50,
      shot: -40,
      damage: -30,
      kill: -20,
    },
    shotTextOffsetX: 30,         // 射击文字 X 偏移（像素）
    fadeOutDuration: 0.5,        // 淡出持续时间（秒）
    fadeInSpeed: 2,              // 淡入速度系数
  },

  // ===== 电蚊拍 =====
  // 全屏放电武器，命中后附加麻痹效果
  swatter: {
    cooldownMax: 60,             // 最大冷却时间（秒）
    stunDuration: 5,             // 麻痹持续时间（秒）
    stunSpeedRatio: 0.2,         // 麻痹时速度倍率（20% 即减速 80%）
    animTimer: 0.6,              // 拍打动画持续时间（秒）
    maxInventory: 3,             // 最大携带数量
  },

  // ===== 三重火焰 =====
  // 三喷火枪模式，主火焰 + 两侧副火焰，覆盖更广
  tripleFlame: {
    duration: 15,                // 持续时间（秒）
    sideOffset: 100,             // 侧火焰偏移距离（像素）
    sideDamageMult: 0.8,         // 侧火焰伤害倍率（80%）
    warningThreshold: 5,         // 即将结束警告阈值（秒）
    countdownSeconds: [3, 2, 1] as readonly number[], // 倒计时提示时间点
  },

  // ===== 投掷物 =====
  // 燃烧瓶/毒气弹/粘板等投掷道具的参数
  throwable: {
    sticky: { radius: 80, stuckTimer: 5, damage: 2, speedRatio: 0.2, fireZoneLife: 4, fireZoneDps: 30 },
    poison: { radius: 90, poisonTimer: 6, poisonDamage: 2, initialDamage: 2, fireZoneLife: 6, fireZoneDps: 25, maxPoisonTimer: 10, poisonDamageMax: 4 },
    molotov: { radius: 70, baseDamage: 8, burnDamageMultiplier: 2, fireZoneLife: 5, fireZoneDps: 60 },
    gravity: 400,                // 投掷物重力加速度（像素/秒²）
    sparkCount: 10,              // 爆炸火花粒子数量
    explosionParticleCount: 25,  // 爆炸粒子总数
  },

  // ===== 粘板/粘液弹 =====
  // 粘板陷阱系统：发射追踪水滴，命中后形成粘板区域
  sticky: {
    dropCount: 10,               // 每次发射水滴数量
    fireInterval: 0.08,          // 水滴发射间隔（秒）
    dropLife: 5,                // 水滴存活时间（秒）
    wrapTimer: 5,               // 粘板包裹时间（秒）
    damagePerTick: 0.5,          // 每跳伤害
    damageFlash: 0.1,            // 伤害闪烁持续时间（秒）
    boardLife: 5,                // 粘板存活时间（秒）
    boardMaxStuck: 5,            // 单块粘板最大粘住蟑螂数
    boardBaseW: 240,             // 粘板基础宽度（像素）
    boardBaseH: 240,             // 粘板基础高度（像素）
    dropSpeed: 250,              // 水滴飞行速度（像素/秒）
    dropSpeedRandom: 100,        // 水滴速度随机范围（像素/秒）
    dropInitialVy: 80,           // 水滴初始垂直速度（像素/秒）
    dropInitialVyRandom: 40,     // 水滴初始垂直速度随机范围
    dropSize: 6,                 // 水滴渲染大小（像素）
    dropSizeRandom: 3,           // 水滴大小随机范围
    dropMaxLife: 3,              // 水滴最大存活时间（秒）
    trackRange: 400,             // 追踪范围（像素），超出此范围的水滴消失
    trackSteerFactor: 5,         // 追踪转向力度系数
    hitParticleCount: 8,         // 命中粒子数量
  },

  // ===== 瞄准系统 =====
  // 投掷物的弧度瞄准计算参数
  aiming: {
    maxPowerTime: 1.5,           // 最大蓄力时间（秒）
    minDist: 80,                 // 最小投掷距离（像素）
    maxDist: 500,                // 最大投掷距离（像素）
    gravity: 400,                // 重力加速度（像素/秒²）
    travelTimeBase: 0.5,         // 基础飞行时间（秒）
    travelTimePowerMult: 0.3,    // 蓄力对飞行时间的倍率
    arcHeightBase: 100,          // 基础弧线高度（像素）
    arcHeightPowerMult: 150,     // 蓄力对弧线高度的倍率
    trajectorySteps: 30,         // 弹道预览线段数
    borderMarginX: 40,           // 水平边界余量（像素）
    borderMarginTop: 60,         // 顶部边界余量（像素）
    borderMarginFromDefense: 20, // 距离防线的余量（像素）
    adjustSensitivity: 1.5,      // 瞄准灵敏度
    defaultCanvasWidth: 800,     // 默认画布宽度（用于坐标计算）
    defaultDefenseLineY: 600,    // 默认防线 Y 坐标
  },

  // ===== Boss 战斗 =====
  // 螂老大 Boss 战的核心参数
  boss: {
    baseHp: 10000,               // Boss 基础血量
    totalLayers: 4,              // 总层数（4 波虫卵阶段）
    phaseChangeTimer: 6,         // 阶段切换过渡时间（秒）
    deathAnimTimer: 1.75,        // 死亡动画持续时间（秒）
    corpseStayTimer: 2.0,        // 尸体停留时间（秒）
    timeLimit: 180,              // 时间限制（秒），超时视为失败
    eyeHp: 800,                  // 眼睛部位血量
    bellyHp: 1500,               // 腹部血量
    maxShed: 3,                  // 最大蜕皮次数
    speed: 0.6,                  // Boss 移动速度系数
    wobbleSpeed: 0.5,            // 水平摇摆速度
    wobbleSpeedRandom: 1,        // 摇摆速度随机范围
    defenseLineOffset: 15,       // 距离防线的偏移（像素）
    hoverAmplitude: 60,          // 水平悬浮摆动幅度（像素）
    hoverYAmplitude: 15,         // 垂直悬浮摆动幅度（像素）
    hoverLerpSpeed: 2.0,         // 悬浮插值速度
    hoverFreq: 1.2,              // 水平悬浮频率
    hoverYFreq: 2,               // 垂直悬浮频率
    fleeSpeed: 80,               // 逃跑速度（像素/秒）
    fleeWobbleAmplitude: 30,     // 逃跑时摇摆幅度（像素）
    fleeWobbleFreq: 3,           // 逃跑时摇摆频率
    fleeOffscreenY: -200,        // 逃跑时飞出屏幕的 Y 坐标
    fleeTimer: 5,                // 逃跑计时器（秒）
    summonCastTimer: 2.0,        // 召唤施法时间（秒）
    summonPhaseChangeTimer: 3,   // 召唤阶段切换时间（秒）
    dialogueTimer: 3,            // 对话显示时间（秒）
    dialogueDelays: [3000, 6000, 9000] as readonly number[], // 对话延迟（毫秒）
    dialogueTextOffsets: { line1: 100, line2: 80, line3: 60 }, // 对话文字偏移（像素）
    deathExplosionParticles: 60, // 死亡爆炸粒子数
    deathShockwaveRadius: 50,    // 死亡冲击波半径（像素）
    eggWaveSpawnTimer: 2,        // 虫卵波次生成间隔（秒）
    armorHp: { normal: 12, hard: 20 }, // 不同难度下的护甲血量
    bossSize: 120,               // Boss 渲染大小（像素）
    bossReward: 500,             // Boss 击杀奖励金币
    bossYRatio: 0.18,            // Boss Y 坐标占屏幕高度的比例
  },

  // ===== 消耗品 =====
  // 消耗品系统的运行时参数
  consumable: {
    combatStartDelay: 1,         // 战斗开始后消耗品激活延迟（秒）
    buffFlashDuration: 2,        // 增益闪烁持续时间（秒）
    powerBoostDuration: 8,       // 火力全开持续时间（秒）
    shieldDuration: 5,           // 护盾持续时间（秒）
    baitDuration: 3,             // 诱饵持续时间（秒）
    globalCooldown: 1,           // 全局道具冷却时间（秒）
    baitThrowAnimDuration: 0.8,  // 诱饵投掷动画时间（秒）
    baitThrowAnimHeight: 150,    // 诱饵投掷动画高度（像素）
    floatTextOffset: {           // 浮动文字 Y 偏移（像素）
      player: 40,
      defenseRepair: 30,
      shield: 50,
      emergencyCool: 60,
      bait: 40,
      baitEnd: 40,
    },
    // 自动使用条件：定义每种消耗品在什么情况下自动触发
    autoUseConditions: {
      emergency_cool: 'overheated',   // 过热时自动使用
      shield: 'defenseLowHealth',     // 防线低血量时自动使用
      gas_refill: 'lowGas',           // 燃气不足时自动使用
      defense_repair: 'defenseLowHealth', // 防线低血量时自动使用
      power_boost: 'never',           // 无自动使用
      bait: 'never',                  // 无自动使用
    } as Record<string, string>,
    // 自动使用阈值：触发条件的具体数值
    autoUseThresholds: {
      defenseLowHealth: 0.15,  // 防线血量低于 15% 触发
      lowGas: 0.3,              // 燃气低于 30% 触发
    },
  },

  // ===== 无尽模式 =====
  endless: {
    newRecordTimer: 3, // 新纪录提示显示时间（秒）
  },

  // ===== 武器掉落（场景配置） =====
  // 控制战斗中武器掉落的频率和范围
  weaponDropScene: {
    dropLife: 12,                // 掉落物存活时间（秒），超时消失
    bobSpeed: 4,                 // 掉落物上下浮动速度
    pickBaseX: 60,               // 拾取区域基础 X 偏移（像素）
    pickXRange: 120,             // 拾取区域 X 范围（像素）
    pickupRadius: 60,            // 拾取判定半径（像素）
    spawnYOffset: 40,            // 生成 Y 偏移（像素）
    spawnYRange: 20,             // 生成 Y 随机范围（像素）
    multiDropSpacing: 100,       // 多个掉落物间距（像素）
    maxInventory: 3,             // 最大携带武器数量
    // 各场景掉落间隔（秒），越难场景掉落越频繁
    spawnIntervals: {
      kitchen: 40, sewer: 35, dump: 30, basement: 25,
      rooftop: 20, street: 25, hospital: 30, subway: 25,
      supermarket: 25, school: 25, nest: 30,
    } as Record<string, number>,
  },

  // ===== 毒雾粒子 =====
  // 毒气弹爆炸后产生的毒雾粒子效果参数
  poisonCloud: {
    particleCount: 20,           // 粒子总数
    speedMin: 40,                // 最小速度（像素/秒）
    speedMax: 80,                // 最大速度（像素/秒）
    lifeMin: 0.5,                // 最小存活时间（秒）
    lifeMax: 0.8,                // 最大存活时间（秒）
    maxLife: 1.3,                // 最大存活时间上限（秒）
    sizeMin: 4,                  // 最小粒子大小（像素）
    sizeMax: 12,                 // 最大粒子大小（像素）
    fireZoneDps: 25,             // 火焰区域 DPS
    fireZoneLife: 6,             // 火焰区域存活时间（秒）
  },

  // ===== 杀虫剂喷雾 =====
  // 双侧毒气喷射系统参数
  insecticide: {
    duration: 3,                 // 喷射持续时间（秒）
    damageInterval: 0.3,         // 伤害判定间隔（秒）
    baseDamage: 2,               // 基础伤害
    damageMultiplier: 0.5,       // 伤害倍率
    damageRange: 280,            // 伤害范围（像素）
    poisonTimer: 3,              // 中毒计时器（秒）
    poisonDamage: 1.0,           // 中毒每跳伤害
    sprayDuration: 0.15,         // 喷雾动画持续时间（秒）
    sideParticleCount: 6,        // 侧方粒子数
    particleLifeMin: 0.3,        // 粒子最小存活时间（秒）
    particleLifeMax: 0.4,        // 粒子最大存活时间（秒）
    particleSpeedMin: 100,       // 粒子最小速度（像素/秒）
    particleSpeedMax: 80,        // 粒子最大速度（像素/秒）
    particleAlphaMin: 0.25,      // 粒子最小透明度
    particleAlphaMax: 0.25,      // 粒子最大透明度
    centerParticleCount: 3,      // 中心粒子数
    centerParticleLifeMin: 0.2,  // 中心粒子最小存活时间（秒）
    centerParticleLifeMax: 0.25, // 中心粒子最大存活时间（秒）
    maxParticlesPerFrame: 24,    // 每帧最大粒子数
    hitParticleChance: 0.3,      // 命中粒子生成概率（30%）
    suffocationTimer: 8,         // 窒息持续时间（秒），护士蟑螂特有
    suffocationDps: 1,           // 窒息每秒伤害
    warningThreshold: 1,         // 即将结束警告阈值（秒）
  },

  // ===== 风扇系统 =====
  // 强力风扇：全场减速，将蟑螂吹退
  fan: {
    pushForce: 0.5,              // 推力系数
    defaultDuration: 4,          // 默认持续时间（秒）
    defaultSlowFactor: 0.3,      // 默认减速系数（30%）
    defaultBladeSpeed: 15,       // 默认扇叶转速
    fanTopYRatio: 0.5,           // 风扇顶部 Y 坐标占屏幕高度比例
    effects: {                   // 不同蟑螂类型的风扇效果：[减速系数, 推退距离]
      flying: [0.70, 120],       // 飞行蟑螂受风力影响较小
      flyingSuicide: [0.65, 100],
      small: [0.60, 80],
      large: [0.40, 50],
      splitting: [0.40, 50],
      suicide: [0.30, 35],
      armored: [0.20, 25],       // 装甲蟑螂几乎不受影响
      queen: [0.10, 15],         // 女王几乎不受影响
      default: [0.40, 50],
    } as Record<string, [number, number]>,
    waveCount: 18,               // 风扇波纹数量
    waveSpeedBase: 2.0,          // 波纹基础速度
    waveSpeedIncrement: 0.3,     // 波纹速度增量
    waveAmplitudeBase: 14,       // 波纹基础振幅（像素）
    waveAmplitudeIncrement: 1.5, // 波纹振幅增量
    waveAlphaBase: 0.04,         // 波纹基础透明度
    waveAlphaAmp: 0.03,          // 波纹透明度变化幅度
    waveLineYStep: 5,            // 波纹线 Y 步进（像素）
    wavePhaseMultiplier: 2.7,    // 波纹相位倍率
    waveStrokeBase: 2.0,         // 波纹基础线宽
    waveStrokeAmp: 1.0,          // 波纹线宽变化幅度
    perspectiveScaleMin: 0.08,   // 透视缩放最小值
    sourceWidthRatio: 0.7,       // 风源宽度占屏幕比例
    gustCount: 5,                // 阵风数量
    gustHeightBase: 45,          // 阵风基础高度（像素）
    gustHeightIncrement: 12,     // 阵风高度增量
    gustAlphaBase: 0.15,         // 阵风基础透明度
    gustSpeedBase: 0.5,          // 阵风基础速度
    gustSpeedIncrement: 0.3,     // 阵风速度增量
    particleCount: 28,           // 风粒子数量
    particleRiseSpeedBase: 50,   // 粒子基础上升速度（像素/秒）
    particleRiseSpeedIncrement: 30, // 粒子上升速度增量
    particleAlphaBase: 0.15,     // 粒子基础透明度
    particleAlphaAmp: 0.1,       // 粒子透明度变化幅度
    particleSizeBase: 1.8,       // 粒子基础大小（像素）
    particleSizeAmp: 0.6,        // 粒子大小变化幅度
    particleRotateAmp: 0.3,      // 粒子旋转幅度
    particleSizeLength: 5,       // 粒子长度（像素）
    sourceAlpha: 0.08,           // 风源透明度
    sourceGlowAlpha: 0.18,       // 风源发光透明度
    sourceGlowMidAlpha: 0.06,    // 风源中间发光透明度
    iconSize: 22,                // 风扇图标大小（像素）
    iconYOffset: 30,             // 风扇图标 Y 偏移
    iconTimerYOffset: 8,         // 风扇计时器 Y 偏移
    iconBlowingYOffset: 20,      // 风扇吹动状态 Y 偏移
    bladeSize: 4,                // 扇叶大小（像素）
    bladeLength: 8,              // 扇叶长度（像素）
    bladeRadiusRatio: 0.55,      // 扇叶半径比例
    centerSize: 4,               // 风扇中心大小（像素）
    activationScreenShake: 4,    // 激活时屏幕震动强度
    activationTextYRatio: 0.3,   // 激活文字 Y 比例
    activationTextYOffset: 20,   // 激活文字 Y 偏移（像素）
  },

  // ===== 经济系统 =====
  // 金币和天赋点经济参数
  economy: {
    initialMoney: { easy: 5000, normal: 5000, hard: 100 }, // 初始金币（不同难度）
    talentCostScaling: 1.5,      // 天赋升级费用倍率（每级 1.5x）
    hardModeRewardPenalty: 0.8,  // 困难模式奖励削减系数（80%）
  },

  // ===== 地铁场景：列车系统（自动定时驶过） =====
  // 列车每隔 autoTrainInterval 秒自动驶过一次，驶过前 warningTime 秒在轨道起点闪烁预警提示玩家
  train: {
    autoTrainInterval: 25,         // 列车自动驶过间隔（秒，从进入地铁场景起计时）
    warningTime: 3,                // 列车驶过前的预警时长（秒，轨道起点闪烁提示）
    railYRatios: [0.34, 0.5, 0.66] as readonly number[], // 三条铁轨 Y 比例（相对防线高度）
    bandHalfHeight: 46,            // 碾压判定半高（像素）
    killTextColor: '#fca5a5',      // 碾压击杀浮动文字颜色
    // ===== 贝塞尔曲线轨迹（相对 540 逻辑宽度画布，固定坐标） =====
    // 起点 P0=(101,469)；终点 P3=(533,637)；P1/P2 取 P0→P3 直线的 1/3、2/3 处
    trainDuration: 2.2,            // 列车驶完全程时长（秒）
    trainStart: { x: 101, y: 469 } as const,           // 起点 P0
    trainControl1: { x: 245, y: 595 } as const,        // 控制点 P1（下移 70px：525 → 595）
    trainControl2: { x: 389, y: 621 } as const,        // 控制点 P2（下移 40px：581 → 621）
    trainEnd: { x: 533, y: 637 } as const,             // 终点 P3（固定坐标）
    // ===== 序列帧动画（氛围事件图，固定位置播放，不随贝塞尔移动） =====
    trainFrameCount: 16,           // 序列帧总数（train_01.png ~ train_16.png）
    // 帧率 = 帧数 / 时长，确保 16 帧在 trainDuration 内恰好播放 1 次
    trainFrameRate: 16 / 2.2,      // ≈7.27 FPS（16帧 ÷ 2.2秒，单次播放不循环）
    // ===== 车头碰撞圆（跟随车头，可调半径） =====
    trainHeadRadius: 90,           // 车头碰撞圆半径（像素）
    trainHeadOffset: 0,            // 车头圆心沿曲线切线方向的前移偏移（像素）
  },

  // ===== 地铁场景：隧道工 / 精英 / 斩螂·110 =====
  subway: {
    // 隧道工蟑螂
    armorSprayInterval: 6,         // 护甲喷涂间隔（秒）
    armorSprayAmount: 150,         // 单次喷涂护甲值（提高 BUFF 效果，原 50）
    armorSprayRange: 200,          // 喷涂范围（像素）
    // 地铁精英
    eliteChargeDelay: 2,           // 出场后进入冲刺的延迟（秒）
    eliteChargeSpeed: 460,         // 冲刺速度（像素/秒）
    eliteChargeEdgeMargin: 30,     // 冲刺到屏幕边缘停止的余量（像素）
    // 斩螂·110
    knifeDashDuration: 0.18,       // 刀刃飞跃单程时长（秒）
    knifeKillDelay: 0.18,          // 到达目标后击杀延迟（秒）
  },
} as const;