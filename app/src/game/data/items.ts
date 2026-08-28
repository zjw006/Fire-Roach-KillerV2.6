import type { ConsumableDef } from '../types';
import { SHIELD_BAND_HEIGHT, SHIELD_BREAK_BLEND, SHIELD_BREAK_CRACK_ALPHA, SHIELD_BREAK_CRACK_COLOR, SHIELD_BREAK_CRACK_COUNT, SHIELD_BREAK_CRACK_LINE_WIDTH, SHIELD_BREAK_DURATION, SHIELD_BREAK_FLASH_ALPHA, SHIELD_BREAK_FLASH_COLOR, SHIELD_BREAK_SHARD_COUNT, SHIELD_BREAK_SHARD_EDGE_ALPHA, SHIELD_BREAK_SHARD_EDGE_COLOR, SHIELD_BREAK_SHARD_FILL_ALPHA, SHIELD_BREAK_SHARD_FILL_COLOR, SHIELD_BREAK_SHARD_FLY, SHIELD_BREAK_SHARD_SIZE_MAX, SHIELD_BREAK_SHARD_SIZE_MIN, SHIELD_DOME_ALLY_WIDEN, SHIELD_DOME_BASE_RING_ALPHA, SHIELD_DOME_BASE_RING_COLOR, SHIELD_DOME_BASE_RING_FLATTEN, SHIELD_DOME_BASE_RING_LINE_WIDTH, SHIELD_DOME_BREATH_AMP, SHIELD_DOME_BREATH_FREQ, SHIELD_DOME_DEEP_ALPHA, SHIELD_DOME_DEEP_COLOR, SHIELD_DOME_FILL_ALPHA_EDGE, SHIELD_DOME_FILL_COLOR, SHIELD_DOME_FLARE_EXTRA, SHIELD_DOME_HEIGHT, SHIELD_DOME_HIT_FLASH_ALPHA, SHIELD_DOME_RIM_ALPHA, SHIELD_DOME_RIM_COLOR, SHIELD_DOME_RIM_GLOW_ALPHA, SHIELD_DOME_RIM_GLOW_BLUR, SHIELD_DOME_RIM_GLOW_COLOR, SHIELD_DOME_RIM_LINE_WIDTH, SHIELD_DOME_SPEC_ALPHA, SHIELD_DOME_SPEC_ARC, SHIELD_DOME_SPEC_COLOR, SHIELD_DOME_SPEC_LINE_WIDTH, SHIELD_DOME_WIDTH, SHIELD_FLUFF_ALPHA_AMP, SHIELD_FLUFF_ALPHA_BASE, SHIELD_FLUFF_ALPHA_FREQ, SHIELD_FLUFF_BLEND, SHIELD_FLUFF_COLOR, SHIELD_FLUFF_COUNT, SHIELD_FLUFF_INSET, SHIELD_FLUFF_SIZE_AMP, SHIELD_FLUFF_SIZE_FREQ, SHIELD_FLUFF_SIZE_MIN, SHIELD_FLUFF_SPEED, SHIELD_FLUFF_WANDER_AMP, SHIELD_RECT_COLOR, SHIELD_RECT_FILL_ALPHA_MID, SHIELD_RECT_FILL_ALPHA_NEAR, SHIELD_RECT_HEIGHT, SHIELD_RECT_STROKE_ALPHA_SCALE, SHIELD_RECT_STROKE_COLOR, SHIELD_RECT_STROKE_FLASH_ALPHA } from './vfx-balance';

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
  knife:   { name: '斩螂·110', color: '#e2e8f0', ammo: 3,  cooldown: 5 }, // 近战秒杀：自动跃向威胁最高的目标，击杀后反弹寻找下一目标
  invoice: { name: '蟑叔发票', color: '#fbbf24', type: 'instant' as const, ammo: 1, cooldown: 15 }, // 30秒金币收益+50%
  jammer:  { name: '须须干扰器', color: '#c084fc', type: 'instant' as const, ammo: 1, cooldown: 12 }, // 5秒全场蟑螂混乱乱窜 + 部分技能失效（地铁通关奖励）
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
  invoice: 10,  // 金币增益道具
  jammer:  12,  // 全场混乱控制道具
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
    // 喷火枪：真实总 DPS（每秒实际交付伤害，近端满伤害、无天赋、无火力全开）。
    // 由两套机制分摊：火焰束(碰撞)伤害占 flamethrowerBeamShare，火焰粒子区占剩余部分。
    // 束 DPS = 45 × 0.75 = 33.75（easy）/ 30 × 0.75 = 22.5（hard），火焰粒子区 DPS = 11.25 / 7.5。
    flamethrower: { easy: 25, hard: 25 },
    flamethrowerBeamShare: 0.75, // 火焰束伤害占比（束 DPS = 总DPS × 此比例，其余为火焰粒子区 DPS）
    poison: { easy: 20, hard: 12 },        // 毒雾每跳伤害
    shotgun: { easy: 30, hard: 35 },       // 散弹单发伤害
    molotov: { easy: 40, hard: 25 },       // 燃烧瓶基础伤害
    fallback: { easy: 45, hard: 30 },      // 兜底伤害（未识别武器时使用）
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

  // ===== 蟑叔发票 =====
  // 医院场景通关奖励道具：使用后 30 秒内金币收益 +50%
  invoice: {
    duration: 30,                // 增益持续时间（秒）
    goldMult: 1.5,               // 金币收益倍率（+50%）
    maxInventory: 3,             // 最大携带数量
  },

  // ===== 须须干扰器 =====
  // 地铁场景通关奖励道具：使用后 10 秒内全场蟑螂四处乱窜，且部分技能暂时失效
  // （护士加血、隧道工修盾/喷甲、大/小/飞行/自爆类闪避）
  jammer: {
    duration: 10,                // 混乱持续时间（秒）2026-08-27: 5→10
    maxInventory: 3,             // 最大携带数量
    dirChangePerSec: 2.5,        // 乱窜方向重置频率（次/秒，概率式）
    speedMult: 1.1,              // 乱窜移动速度倍率
  },

  // ===== 三重火焰 =====
  // 三喷火枪模式，主火焰 + 两侧副火焰，覆盖更广
  tripleFlame: {
    duration: 15,                // 持续时间（秒）
    sideOffset: 65,              // 侧火焰偏移距离（像素，⚠玩法：侧火焰伤害位置；调参台 sideGunSpacing）
    sideDamageMult: 0.8,         // 侧火焰伤害倍率（80%）
    warningThreshold: 5,         // 即将结束警告阈值（秒）
    countdownSeconds: [3, 2, 1] as readonly number[], // 倒计时提示时间点
    // ===== 侧枪贴图渲染（barrel.png 58×109 竖长枪管，与调参台 flamethrower-vfx.html 同名参数一致） =====
    sideBarrelTexture: '/assets/barrel.png',  // 侧枪贴图路径（主枪仍用 gun.png）
    sideBarrelHeight: 34,        // 侧枪贴图高度（玩家单位，×s=4 换算像素；宽度按 58:109 等比）
    sideBarrelYOffset: -20,      // 侧枪贴图 Y 偏移（玩家单位，相对主枪中心，负=上移）
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
    suffocationTimer: 8,         // 窒息持续时间（秒），命中后附加
    skillBlockDuration: 5,       // 技能封锁时长（秒），护士不能加血、工程蟑螂不能修盾/喷甲
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

  // ===== 蟑老大 Boss 战（巢穴终局，2026-08-24 锁定设计，仅 Easy） =====
  // 玩家无法直接攻击 Boss；唯一输出 = 火枪引爆其投掷的炸弹反伤
  bossKing: {
    hp: 3000,                    // Boss 血量（方案A）
    size: 200,                   // Boss 体型（像素，原 300 的 2/3）
    patrolXMin: 50,              // 横向巡逻范围（540 逻辑宽）
    patrolXMax: 490,
    patrolSpeed: 0.35,           // 巡逻正弦频率（弧度/秒）
    hoverYRatio: 0.27,           // 悬浮基准 Y（屏高比例，相对定位禁止写死）
    hoverYAmpRatio: 0.045,       // 垂直浮动幅度（屏高比例）
    hoverYFreq: 1.1,             // 垂直浮动频率
    introSec: 2.0,               // 开场亮相延迟（之后才开始技能轮转）
    telegraphSec: 1.5,           // 技能前摇（红光/金光/张翅提示）
    phase2HpRatio: 0.5,          // 进入二阶段血量比例
    phase3HpRatio: 0.2,          // 进入三阶段血量比例
    phaseCd: { p1: 8, p2: 6, p3: 4 }, // 各阶段技能 CD（秒）
    rotationRestSec: 6,          // 每施放 3 个技能后的额外休整（加在阶段CD上，让玩家清小怪）
    // 技能 AI（按战场态势决策，优先级：净化 > 吹风 > 投弹；均不满足时默认投弹——玩家唯一反伤手段不断供）
    ai: {
      purgeMinControlled: 1,     // 被控制/减益的小怪 ≥ N 只 → 释放净化（A）
      windMinRoaches: 6,         // 场上存活小怪 ≥ N 只 → 释放吹风推动（B）
      // 战场被清空（无存活小怪）或 A/B 均不满足 → 释放投弹（C/默认）
    },
    // 地面阴影（BOSS 空中悬浮投射在地面阻挡面上的椭圆阴影，跟随 X 移动）
    shadow: {
      yRatio: 0.58,              // 阴影中心 Y（屏高比例，位于 Boss 与防线之间的地面）
      rxRatio: 0.27,             // 阴影横向半径（相对 Boss 体型）
      rySquash: 0.36,            // 阴影纵向压扁系数（透视）
      alpha: 0.3,                // 阴影基础透明度
    },
    // 技能① 净化：清除全场小怪负面状态 + 无敌帧
    purge: {
      immuneSec: 0.5,            // 净化后无敌帧时长
      glowColor: '255,215,120',  // 金光
    },
    // 技能② 吹风：地面小怪加速 + 向防线推力（无风扇硬扛水位；三阶段不再加强）
    wind: {
      durationSec: 3,            // 吹风持续时间
      speedMult: 1.5,            // 移速倍率
      pushPxPerSec: 24,          // 向防线推力（像素/秒）
      fanPushResist: 0.6,        // 风扇抵消推力比例（有风扇时推力 × (1-0.6)）
      glowColor: '150,200,255',  // 风压辉光
      // 屏幕风速流线（透视：越远越短/细/淡，越近越长/粗/亮，横向扇出）
      streak: {
        count: 16,               // 流线数量
        color: '190,225,255',    // 流线颜色
        speed: 0.55,             // 流线流动速度（全程/秒）
        minLen: 24,              // 远处（顶部）流线长度
        maxLen: 96,              // 近处（底部）流线长度
        maxWidth: 3.2,           // 近处线宽（远处为 1）
        spreadRatio: 0.44,       // 底部横向扇出半宽（屏宽比例）
      },
    },
    // 技能③ 投弹（核心输出窗口）
    bomb: {
      flightSec: 2.4,            // 抛物线飞行总时长
      tailTimeRatio: 0.35,       // 末段减速时间占比
      tailSpeedMult: 0.4,        // 末段速度倍率
      arcHeight: 90,             // 抛物线拱高（像素）
      burstOffsetFromDefense: 200, // 自动爆炸点距防线距离（defenseLineY()-200，禁止写死）
      defenseDamage: 30,         // 漏弹（自动爆炸）防线伤害
      counterDamage: 300,        // 火枪引爆反伤 Boss（3000 HP / 300 = 10 次引爆击杀）
      hitRadius: 40,             // 引爆判定半径（像素，三重火焰侧焰同效）
      aoeRadius: 120,            // 空爆波及半径
      aoeGroundDamage: 50,       // 空爆对地面小怪伤害（飞行小怪半径内秒杀）
      doubleOffsetX: 60,         // 连发落点半间距（像素，相邻炸弹间距 = 2×此值）
      burstStaggerSec: 0.5,      // 连发炸弹发射间隔（秒，2026-08-27：双发/三连发错时出手）
      size: 32,                  // 炸弹视觉直径（像素）
      telegraphGlowColor: '255,80,60', // 腹部红光预警（Boss 身体周围，非屏幕红光）
      markerSquash: 0.5,         // 落点标记 Y 轴压缩系数（椭圆透视）
      // 投掷虚线抛物线轨迹（投弹瞬间显示，与真实飞行路径同公式）
      trajectory: {
        color: '255,110,80',     // 轨迹颜色
        alpha: 0.5,              // 轨迹透明度
        width: 2,                // 轨迹线宽
        dash: [7, 6],            // 虚线模式
      },
      // 炸弹地面阴影（落点平面，随高度缩放/变淡）
      groundShadow: {
        maxRx: 20,               // 贴地时横向半径
        minRx: 7,                // 高空时横向半径
        squash: 0.4,             // 纵向压扁系数（透视）
        maxAlpha: 0.45,          // 贴地透明度
        minAlpha: 0.1,           // 高空透明度
        refDropPx: 420,          // 参考落差（阴影插值基准，像素）
      },
    },
    // 屏幕汁液喷溅（仅漏弹触发；贴图空窗期程序圆斑兜底）
    goo: {
      countMin: 2,               // 每次漏弹喷溅块数
      countMax: 3,
      liveSec: 2.5,              // 存在时长
      fadeSec: 0.5,              // 渐隐时长
      radiusMin: 60,             // 污渍半径范围（像素）
      radiusMax: 130,
      color: '107,124,62',       // 低饱和橄榄绿
    },
    // 退场：转身 → 透视缩小飞向洞穴深处（终点坐标待用户提供，暂用屏顶中央）
    exit: {
      turnSec: 0.35,             // 转身阶段时长
      flySec: 2.0,               // 远去阶段时长
      endScale: 0.12,            // 终点缩放（透视深入）
      fadeStartRatio: 0.6,       // 透明度保持比例（之后渐隐至 0）
      targetXRatio: 0.5,         // TODO: 待用户提供洞穴坐标（屏宽比例）
      targetYRatio: 0.12,        // TODO: 待用户提供洞穴坐标（屏高比例）
    },
    rewardCoins: 2000,           // 通关金币（结算直接发放）
    rewardTalent: 6,             // 通关天赋点（替代 perScene 表）
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

  // ===== 杀虫剂喷雾 =====
  // 全屏毒气熏蒸系统参数（命中全场存活蟑螂，无射程限制）
  insecticide: {
    duration: 3,                 // 喷射持续时间（秒）
    damageInterval: 0.3,         // 伤害判定间隔（秒）
    baseDamage: 2,               // 基础伤害
    damageMultiplier: 0.5,       // 伤害倍率
    poisonTimer: 5,              // 中毒计时器（秒）
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
    suffocationTimer: 8,         // 窒息持续时间（秒）
    suffocationDps: 1,           // 窒息每秒伤害
    dodgeBlockDuration: 3,       // 闪避封锁时长（秒），命中后拥有闪避技能的蟑螂无法闪避
    weakenDuration: 5,           // 虚弱减速时长（秒）
    weakenSpeedMult: 0.5,        // 虚弱期间移动速度倍率
    skillBlockDuration: 5,       // 技能封锁时长（秒），护士不能加血、工程蟑螂不能修盾/喷甲
    warningThreshold: 1,         // 即将结束警告阈值（秒）
  },

  // ===== 经济系统 =====
  // 金币和天赋点经济参数
  economy: {
    initialMoney: { easy: 5000, normal: 5000, hard: 100 }, // 初始金币（不同难度）
    hardModeRewardPenalty: 0.8,  // 困难模式奖励削减系数（80%）
    // 天赋点奖励（v3.0 固定表）：每关胜利发放固定点数，与场景奖励倍率脱钩
    // 普通 1-3 关=0（天赋未解锁）；4 地下室=4（解锁礼）；5-6=2；7-9=3；10-11=4
    // 困难 6 关=[2,2,2,3,3,3]；任意关首次三星 +1（解锁前获得的存入 pendingTalentPoints）
    talentPointReward: {
      perScene: {
        kitchen: 0, sewer: 0, dump: 0, basement: 4, street: 2, rooftop: 2,
        hospital: 3, subway: 3, supermarket: 3, school: 4, nest: 4,
      } as Record<string, number>,
      hardMode: [2, 2, 2, 3, 3, 3] as readonly number[],
      threeStarBonus: 1,
    },
  },

  // ===== 地铁场景：列车系统（场景被动事件） =====
  // 列车按每波时刻表自动驶过（无需玩家操作），驶过前 warningTime 秒在轨道起点闪烁预警提示玩家。
  // 时刻表时间为波次开始（doWaveSpawn）后的秒数；波次提前清完时取消该波剩余列车。
  train: {
    // 每波列车时刻表（秒，从波次生成起算，升序；未列出的波次回退到第 10 波配置）
    waveSchedule: {
      1: [],
      2: [15],
      3: [10, 25],
      4: [8, 20],
      5: [12],
      6: [8, 18, 28],
      7: [6, 14, 22],
      8: [5, 15, 25],
      9: [6, 16, 26],
      10: [5, 13, 21, 29],
    } as Record<number, readonly number[]>,
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

  // ===== 地铁场景：隧道工 / 精英 / 护盾蟑螂 / 斩螂·110 =====
  subway: {
    // 隧道工蟑螂
    armorSprayInterval: 10,        // 护甲喷涂间隔（秒，6→10 降低加护甲速度）
    armorSprayAmount: 200,         // 单次喷涂护甲值（提高：150→200）
    armorSprayRange: 300,          // 喷涂范围（像素，增强施法范围，原 200）
    armorSprayTargets: 3,          // 单次施法可加护甲的目标数（提升：1→3）
    // 地铁精英
    eliteChargeDelay: 2,           // 出场后进入冲刺的延迟（秒）
    eliteChargeSpeed: 460,         // 冲刺速度（像素/秒）
    eliteChargeEdgeMargin: 30,     // 冲刺到屏幕边缘停止的余量（像素）
    // 护盾蟑螂（气体护盾）
    shieldMaxHp: 350,              // 气体护盾容量（提高：50→100→150→200→350，增强护盾生存力）
    shieldRegenPerSec: 2,          // 护盾完好时自然恢复（点/秒，5→2，放缓自然回盾）
    shieldRebuildDelay: 6,         // 护盾破碎后重新生成延迟（秒，10→6 加快重建）
    shieldRectHalfWidth: 100,      // 护盾矩形保护区半宽（像素，总宽200）
    shieldRectHeight: SHIELD_RECT_HEIGHT, // 护盾矩形保护区高度（像素，从护盾蟑螂向上延伸）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBandHeight: SHIELD_BAND_HEIGHT, // 底部光带高度（像素，破盾特效/碎裂粒子散布定位沿用）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    // --- 护盾半球形水晶罩造型（径向渐变球体 + 罩内冰白晶面棱线 + 顶部镜面高光斑）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变 ---
    shieldDomeWidth: SHIELD_DOME_WIDTH,                      // 玻璃穹顶视觉宽度（× 蟑螂渲染尺寸 size 的比例，罩住本体，与实际判定区解耦）
    shieldDomeHeight: SHIELD_DOME_HEIGHT,                    // 玻璃穹顶视觉高度（× size 的比例，脚下贴地→头顶余量，与判定区解耦）
    shieldDomeFillColor: SHIELD_DOME_FILL_COLOR,             // 罩体 RGB（冰晶淡蓝）
    shieldDomeFillAlphaEdge: SHIELD_DOME_FILL_ALPHA_EDGE,    // 罩体边缘峰值透明度（中心全透，罩内蟑螂清晰可见）
    shieldDomeDeepColor: SHIELD_DOME_DEEP_COLOR,             // 罩体近底缘 RGB
    shieldDomeDeepAlpha: SHIELD_DOME_DEEP_ALPHA,             // 罩体近底缘透明度
    shieldDomeRimColor: SHIELD_DOME_RIM_COLOR,               // 外缘描边 RGB
    shieldDomeRimAlpha: SHIELD_DOME_RIM_ALPHA,               // 外缘描边透明度
    shieldDomeRimLineWidth: SHIELD_DOME_RIM_LINE_WIDTH,      // 外缘描边线宽（像素）
    shieldDomeRimGlowColor: SHIELD_DOME_RIM_GLOW_COLOR,      // 外缘辉光 RGB（lighter）
    shieldDomeRimGlowAlpha: SHIELD_DOME_RIM_GLOW_ALPHA,      // 外缘辉光透明度
    shieldDomeRimGlowBlur: SHIELD_DOME_RIM_GLOW_BLUR,        // 外缘辉光模糊半径（像素）
    shieldDomeSpecColor: SHIELD_DOME_SPEC_COLOR,             // 顶部高光弧 RGB（纯白玻璃反光）
    shieldDomeSpecAlpha: SHIELD_DOME_SPEC_ALPHA,             // 顶部高光弧峰值透明度
    shieldDomeSpecArc: SHIELD_DOME_SPEC_ARC,                 // 顶部高光弧跨度（弧度）
    shieldDomeSpecLineWidth: SHIELD_DOME_SPEC_LINE_WIDTH,    // 顶部高光弧线宽（像素）
    shieldDomeBaseRingColor: SHIELD_DOME_BASE_RING_COLOR,    // 底部贴地亮环基座 RGB
    shieldDomeBaseRingFlatten: SHIELD_DOME_BASE_RING_FLATTEN, // 底部贴地亮环基座 Y 压扁比
    shieldDomeBaseRingAlpha: SHIELD_DOME_BASE_RING_ALPHA,     // 底部贴地亮环基座透明度
    shieldDomeBaseRingLineWidth: SHIELD_DOME_BASE_RING_LINE_WIDTH, // 底部贴地亮环基座线宽（像素）
    shieldDomeBreathAmp: SHIELD_DOME_BREATH_AMP,             // 呼吸胀缩振幅
    shieldDomeBreathFreq: SHIELD_DOME_BREATH_FREQ,           // 呼吸频率（Hz）
    shieldDomeFlareExtra: SHIELD_DOME_FLARE_EXTRA,           // 底部外张沿基础宽度（像素）
    shieldDomeAllyWiden: SHIELD_DOME_ALLY_WIDEN,             // 同类靠近底部加宽步进（像素）
    shieldDomeHitFlashAlpha: SHIELD_DOME_HIT_FLASH_ALPHA,    // 受击泛白闪光峰值透明度
    shieldFluffCount: SHIELD_FLUFF_COUNT,                    // 罩面游走絮状物数量——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldFluffSpeed: SHIELD_FLUFF_SPEED,                    // 罩面游走角速度（弧度/秒）——数值集中于 vfx-balance.ts
    shieldFluffWanderAmp: SHIELD_FLUFF_WANDER_AMP,           // 往返摆动幅度（π 比例）——数值集中于 vfx-balance.ts
    shieldFluffInset: SHIELD_FLUFF_INSET,                    // 贴罩面内缩系数（<1 不越出罩体）——数值集中于 vfx-balance.ts
    shieldFluffSizeMin: SHIELD_FLUFF_SIZE_MIN,               // 絮状物最小半径（像素）——数值集中于 vfx-balance.ts
    shieldFluffSizeAmp: SHIELD_FLUFF_SIZE_AMP,               // 大小脉动振幅（像素）——数值集中于 vfx-balance.ts
    shieldFluffSizeFreq: SHIELD_FLUFF_SIZE_FREQ,             // 大小脉动频率（Hz）——数值集中于 vfx-balance.ts
    shieldFluffAlphaBase: SHIELD_FLUFF_ALPHA_BASE,           // 基础透明度——数值集中于 vfx-balance.ts
    shieldFluffAlphaAmp: SHIELD_FLUFF_ALPHA_AMP,             // 透明度脉动振幅——数值集中于 vfx-balance.ts
    shieldFluffAlphaFreq: SHIELD_FLUFF_ALPHA_FREQ,           // 透明度脉动频率（Hz）——数值集中于 vfx-balance.ts
    shieldFluffColor: SHIELD_FLUFF_COLOR,                    // 絮状物颜色 RGB 通道——数值集中于 vfx-balance.ts
    shieldFluffBlend: SHIELD_FLUFF_BLEND,                    // 絮状物叠加混合（lighter）——数值集中于 vfx-balance.ts
    shieldBreakDuration: SHIELD_BREAK_DURATION,              // 破盾玻璃碎裂持续时间（秒）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakFlashColor: SHIELD_BREAK_FLASH_COLOR,         // 破盾瞬间闪光 RGB 通道（纯白）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakFlashAlpha: SHIELD_BREAK_FLASH_ALPHA,         // 破盾瞬间闪光峰值透明度——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakCrackCount: SHIELD_BREAK_CRACK_COUNT,         // 破盾放射状裂纹数量——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakCrackColor: SHIELD_BREAK_CRACK_COLOR,         // 破盾裂纹 RGB 通道（#e0f2fe）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakCrackAlpha: SHIELD_BREAK_CRACK_ALPHA,         // 破盾裂纹峰值透明度——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakCrackLineWidth: SHIELD_BREAK_CRACK_LINE_WIDTH, // 破盾裂纹线宽（像素）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakShardCount: SHIELD_BREAK_SHARD_COUNT,         // 破盾三角碎片数量——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakShardFly: SHIELD_BREAK_SHARD_FLY,             // 破盾碎片飞散距离（像素）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakShardSizeMin: SHIELD_BREAK_SHARD_SIZE_MIN,    // 破盾碎片最小边长（像素）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakShardSizeMax: SHIELD_BREAK_SHARD_SIZE_MAX,    // 破盾碎片最大边长（像素）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakShardFillColor: SHIELD_BREAK_SHARD_FILL_COLOR, // 破盾碎片填充 RGB 通道（#bfdbfe）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakShardFillAlpha: SHIELD_BREAK_SHARD_FILL_ALPHA, // 破盾碎片填充峰值透明度——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakShardEdgeColor: SHIELD_BREAK_SHARD_EDGE_COLOR, // 破盾碎片描边 RGB 通道（#eff6ff）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakShardEdgeAlpha: SHIELD_BREAK_SHARD_EDGE_ALPHA, // 破盾碎片描边峰值透明度——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldBreakBlend: SHIELD_BREAK_BLEND,                    // 破盾特效叠加混合方式（lighter）——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldRectColor: SHIELD_RECT_COLOR,           // 护盾矩形调试框填充 RGB 通道——数值集中于 vfx-balance.ts，此处引用保持访问路径不变
    shieldRectFillAlphaNear: SHIELD_RECT_FILL_ALPHA_NEAR, // 矩形填充近端透明度系数——数值集中于 vfx-balance.ts
    shieldRectFillAlphaMid: SHIELD_RECT_FILL_ALPHA_MID,   // 矩形填充中段透明度系数——数值集中于 vfx-balance.ts
    shieldRectStrokeColor: SHIELD_RECT_STROKE_COLOR,      // 矩形线框 RGB 通道——数值集中于 vfx-balance.ts
    shieldRectStrokeAlphaScale: SHIELD_RECT_STROKE_ALPHA_SCALE, // 线框透明度放大系数——数值集中于 vfx-balance.ts
    shieldRectStrokeFlashAlpha: SHIELD_RECT_STROKE_FLASH_ALPHA, // 线框受击闪白附加透明度——数值集中于 vfx-balance.ts
    shieldFireZoneErosionMult: 2,  // 火墙对护盾的侵蚀倍率
    shieldSnapshotErosionMult: 0.5, // 快照侵蚀系数（受保护队友 hp 下降 → 护盾按此比例扣减，1=等额）
    shieldRepairPerSec: 10,        // 隧道工修理护盾速度（点/秒，25→10，削弱持续回盾）
    shieldRepairRange: 220,        // 隧道工修理射程（像素，增强施法范围，原 150）
    workerFollowStopDist: 100,     // 隧道工跟随护盾蟑螂的停留距离（像素）
    // 盾墙推进阵型（FormationSystem）
    formationLateralRange: 120,    // 编队横向容许距离（像素，随从与护盾锚点的横向偏移上限）
    formationSpeedBindMult: 1.05,  // 编队速度绑定倍率（随从速度钳制到锚点速度 × 此倍率）
    formationMoveSpeedMult: 2.5,   // 编队成员向护盾后方移动的横向速度倍率（快速归位）
    formationBreakDist: 80,        // 距防线此距离内解除编队（像素）
    // 斩螂·110
    knifeDashDuration: 0.18,       // 刀刃飞跃单程时长（秒）
    knifeKillDelay: 0.18,          // 到达目标后击杀延迟（秒）
  },

  // ===== 超市场景：阵型系统（V5.0 直驱制：槽位清单直读，锚点/运动标记驱动，无模板） =====
  supermarket: {
    // 通用
    formationBlend: 0.7,         // 移动混合权重：70% 跟随阵型槽位 + 30% 向防线推进
    gatherSpeedMult: 0.8,        // 集结阶段阵型原点推进速度倍率（聚拢期放慢）
    gatherTolerance: 36,         // 集结完成判定：已就位成员距槽位平均距离（像素）
    gatherTimeout: 12,           // 集结超时（秒，超时强制进入推进，防止刷怪过慢卡集结）
    defenseHoldDist: 50,         // 阵型原点推进到距防线此距离处停住（像素）
    // 阵列成员硬约束（数据层保证）：仅装甲/护盾/分裂/定时自爆/隧道工/护士入阵；小/大/飞行/地面自爆/精英一律仅作自由杂兵
    spawnCapacityGuard: 36,      // 场上蟑螂 ≥ 此值时延迟阵列组/穿插生成（硬上限 40 前留余量，防静默丢弃）
    formationWaitClear: 4,       // 阵型组出场条件：热场杂兵队列清空且场上存活 ≤ 此值（放宽至4，阵列更早起手避免断档）
    formationWaitTimeout: 6,     // 队列清空后阵型组最长等待（秒，缩短兜底等待，防残血杂兵造成长时间空窗）
    groupStaggerSec: 3.5,        // 上一组阵型被消灭后、下一组出场的缓冲间隔（秒；首组在热场清完后立即出场）
    formationMemberStaggerSec: 0.4, // 阵型组内成员陆续生成间隔（秒；出生位置固定为槽位坐标，仅时间错开）
    trickleJitterMin: 0.7,       // 穿插投放间隔抖动下限倍率（实际间隔 = intervalSec × 抖动）
    trickleJitterMax: 1.3,       // 穿插投放间隔抖动上限倍率
    trickleSuicideJitterMax: 1.5,// 自爆类穿插间隔抖动上限倍率（下限同 trickleJitterMin，挫开时间；空场时改用 trickleJitterMax 快速补场）
    trickleSuicideYStep: 60,     // 自爆类穿插出生 Y 递进错位（像素，3 档循环 + 随机微抖，挫开位置）
    trickleSuicideMinAlive: 4,   // 自爆类（普通/飞行自爆）穿插仅在场上存活蟑螂 ≥ 此值时投放（与 formationWaitClear 衔接消除门控死区；场上全灭时无视门控立即投放）
    trickleSuicideWaitTimeout: 5, // 自爆类穿插等待上限（秒，超时强制投放兜底，防胜利判定卡死）
    // 定时炸弹防线伤害（超市专用：定时自爆为量产单位且阵型推进贴防线，尸体炸弹常在防线旁引爆，数值较医院全局下调）
    corpseBombDefenseDamage: 6,              // 尸体炸弹防线伤害（医院为引擎全局 12）
    corpseBombDefenseRadius: 45,             // 尸体炸弹防线伤害半径（< defenseHoldDist 50：阵型驻停期被击杀不掉防线血，仅贴线击杀才掉；医院为引擎全局 120）
    placedBombDefenseDamage: { easy: 4, hard: 10 }, // 放置炸弹防线伤害（医院为引擎全局 easy 8 / hard 20）
    suicideExplodeDefenseDamage: { easy: 3, hard: 8 }, // 自爆爆炸防线伤害（超市穿插自爆为量产消耗品；其它场景为引擎全局 easy 5 / hard 15）
    defenseHpMult: 1.75,         // 超市防线总池倍率（阵型+穿插全程持续施压、波次间无修复，80 → 140）
    // 槽位运动（sway 横向摇摆 / orbit 环绕，由阵型组槽位的 motion 标记驱动）
    swayAmp: 30,                 // sway 横向摇摆幅度（像素，按阵型原点推进距离三角波叠加）
    swayPeriod: 80,              // sway 摇摆周期（按阵型原点推进距离，像素）
    orbitRotateSpeed: 0.26,      // orbit 环绕转速（弧度/秒，≈15°/s）
    // 破阵判定（双规则，触发即永久散乱：① 锚点全灭 ② 推进期脱离）
    breakOutRatio: 0.3,          // 推进期超过此比例成员横向脱离阵型半宽 → 破阵
    // 成员单独脱离（不触发整组破阵）：定时自爆/分裂蟑螂逼近防线即脱离阵列，按原生 AI 自行冲锋
    breakNearDefenseDist: 250,   // 定时自爆/分裂蟑螂距防线 < 此值（像素）时脱离阵列
    // 锚点菱形标识（颜色按怪物类型区分）
    anchorMarkSize: 9,           // 菱形对角线半长（像素）
    anchorMarkSizeShield: 12,    // 护盾蟑螂菱形对角线半长（像素，略大于普通锚点——护盾是阵型防护核心）
    anchorMarkSizeWorker: 6,     // 隧道工（工程师）菱形对角线半长（像素，缩小弱化提醒）
    anchorMarkOffsetY: 30,       // 菱形头顶偏移（像素）
    anchorMarkColorArmored: '#fb923c', // 装甲锚点（前排主锚）：橙
    anchorMarkColorShield: '#22d3ee',  // 护盾锚点（前排主锚）：青
    anchorMarkColorNurse: '#4ade80',   // 护士锚点（后排）：绿
    anchorMarkColorWorker: '#facc15',  // 隧道工锚点（中排）：黄
    anchorMarkColorDefault: '#38bdf8', // 其它锚点：蓝
    // 阵型成员链接线（灰色虚线，渲染同阵型成员的归属关系）
    formationLinkColor: '156, 163, 175', // 链接线 RGB（灰）
    formationLinkAlpha: 0.45,        // 链接线透明度
    formationLinkDash: 5,            // 虚线段长（像素）
    formationLinkGap: 4,             // 虚线间隔（像素）
    formationLinkWidth: 1,           // 链接线宽（像素）
    // 阵型出生去叠（防出生即重叠/叠影）
    spawnMinXGap: 18,                // 出生最小横向间距（像素，X 轴不叠加）
    spawnMinYGap: 15,                // 出生最小纵向间距（像素，Y 方向 >15）
  },
} as const;