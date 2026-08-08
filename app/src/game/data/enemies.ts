import { RoachType } from '../types';

// ========== 敌人属性定义 ==========
/**
 * 敌人属性定义表
 * @description 定义每一种蟑螂类型的基础属性，包括血量、速度、奖励、颜色、大小和特殊能力。
 * 该定义表是图鉴数据（ENCYCLOPEDIA_DEFS）和战斗系统（RoachAISystem）的共享数据源。
 * - hp: 基础血量（不同难度下会乘以难度系数）
 * - speed: 移动速度系数（1.0 = 基准速度）
 * - reward: 击杀奖励金币（不同难度下会乘以奖励系数）
 * - size: 渲染大小（像素）
 * - special: 特殊能力标签数组，驱动 AI 行为逻辑
 */
export const ENEMY_DEFS: Record<RoachType, {
  name: string;
  description: string;
  hp: number;
  speed: number;
  reward: number;
  color: string;
  size: number;
  special: string[];
}> = {
  [RoachType.SMALL]: {
    name: '小蟑螂',
    description: '快速但脆弱',
    hp: 1,           // 最低血量，一碰就死
    speed: 1,        // 基准速度
    reward: 1,       // 基础奖励
    color: '#5a3a2a', // 深棕色
    size: 28,        // 最小体型
    special: [],
  },
  [RoachType.LARGE]: {
    name: '大蟑螂',
    description: '血量更多，更加耐打',
    hp: 4,           // 4 倍小蟑螂血量
    speed: 0.8,      // 比小蟑螂慢 20%
    reward: 5,       // 5 倍基础奖励
    color: '#7a4a3a', // 较深的棕色
    size: 40,
    special: ['enrage'], // 低血量时狂暴加速
  },
  [RoachType.FLYING]: {
    name: '飞行蟑螂',
    description: '从空中掠过，速度极快',
    hp: 2,           // 较脆弱，但速度快
    speed: 2.4,      // 2.4 倍基准速度，最快
    reward: 4,
    color: '#4a5a6a', // 灰蓝色（天空色）
    size: 32,
    special: ['flying', 'dodge'], // 飞行 + 闪避俯冲
  },
  [RoachType.ARMORED]: {
    name: '装甲蟑螂',
    description: '厚重的甲壳需要多次攻击，破损后露出本体',
    hp: 12,          // 最高血量（基础敌人中）
    speed: 0.5,      // 最慢，但防御极高
    reward: 8,
    color: '#5a5a5a', // 灰色（金属感）
    size: 76,        // 最大体型（基础敌人中）
    special: ['armor', 'damage_reduction'], // 护甲 + 减伤
  },
  [RoachType.SPLITTING]: {
    name: '分裂蟑螂',
    description: '死亡时会分裂成两只小蟑螂',
    hp: 6,           // 中等血量
    speed: 0.7,      // 较慢
    reward: 10,      // 高奖励（含分裂后的小蟑螂）
    color: '#6a4a6a', // 紫色调
    size: 42,
    special: ['split_on_death'], // 死亡分裂
  },
  [RoachType.SUICIDE]: {
    name: '自爆蟑螂',
    description: '背着炸弹的高速蟑螂，呈Z字形游走靠近防线，靠近时自爆造成范围伤害',
    hp: 2,           // 脆弱，但自爆伤害极高
    speed: 1.4,      // 较快，快速接近防线
    reward: 6,
    color: '#8a3a2a', // 红棕色（危险信号）
    size: 60,        // 体型较大（背炸弹）
    special: ['suicide', 'explode'], // 自爆 + 爆炸
  },
  [RoachType.FLYING_SUICIDE]: {
    name: '飞行自爆蟑螂',
    description: '飞行蟑螂背部安装炸弹，兼具飞行速度和自爆攻击能力。靠近防线时俯冲自爆',
    hp: 2,
    speed: 2.2,      // 仅次于飞行蟑螂的速度
    reward: 8,
    color: '#7a3a5a', // 紫红色
    size: 55,
    special: ['flying', 'suicide', 'explode'], // 飞行 + 自爆
  },
  [RoachType.QUEEN]: {
    name: '蟑螂女王',
    description: 'Boss级敌人，会不断召唤小蟑螂',
    hp: 100,         // 极高血量（Boss）
    speed: 0.3,      // 极慢，但不断召唤
    reward: 100,     // 最高奖励
    color: '#8a2a6a', // 深紫色（皇家色）
    size: 160,       // 最大体型
    special: ['boss', 'spawn_minions', 'resist_fire'], // Boss / 召唤 / 火抗
  },
  // ========== 医院场景专属蟑螂 ==========
  [RoachType.NURSE]: {
    name: '护士蟑螂',
    description: '携带医疗包的蟑螂，定期为周围受伤蟑螂恢复15%HP。对杀虫剂极度敏感，接触后窒息8秒。自带红色护盾',
    hp: 25,          // 较高血量（辅助单位）
    speed: 0.8,      // 中等速度
    reward: 28,      // 高奖励（优先击杀目标）
    color: '#4ade80', // 医疗绿色
    size: 78,        // 1.5x from 52
    special: ['heal_ally', 'insecticide_vulnerable', 'red_shield'], // 治疗 / 杀虫剂敏感 / 护盾
  },
  [RoachType.MUTANT]: {
    name: '变异蟑螂',
    description: '经过辐射变异的蟑螂，死亡时释放强腐蚀性酸液，屏幕被绿色干扰2.5秒',
    hp: 8,           // 中等血量
    speed: 0.5,      // 较慢
    reward: 22,
    color: '#84cc16', // 放射性绿色
    size: 38,
    special: ['distort_on_death', 'acid_splash'], // 死亡干扰 + 酸液溅射
  },
  [RoachType.TIMED_SUICIDE]: {
    name: '定时自爆蟑螂',
    description: '到达防线前64px放置炸弹，2秒后变身大蟑螂。被杀死后尸体原地爆炸',
    hp: 30,          // 高血量（生存能力强）
    speed: 1.4,      // 较快，需要快速接近防线
    reward: 40,      // 高奖励（医院场景精英）
    color: '#f59e0b', // 琥珀色（警告色）
    size: 60,
    special: ['shield', 'bomb_placement', 'transform_large'], // 护盾 / 放置炸弹 / 变身
  },
  // ========== 地铁场景专属蟑螂 ==========
  [RoachType.TUNNEL_WORKER]: {
    name: '隧道工蟑螂',
    description: '背着工具箱的蟑螂，定期为周围血量最高的蟑螂添加护甲',
    hp: 60,          // 较高血量（辅助单位）
    speed: 0.6,      // 缓慢
    reward: 30,      // 高奖励（优先击杀目标）
    color: '#78716c', // 暗灰色（工具箱金属感）
    size: 84,        // 增大体型（原 60）
    special: ['armor_spray'], // 护甲喷涂
  },
  [RoachType.SUBWAY_ELITE]: {
    name: '地铁蟑螂精英',
    description: '飞行化的精英蟑螂，沿铁轨高速冲刺后转为空中移动，不受地面阻挡影响，被列车碾压后分裂为2只小蟑螂',
    hp: 80,          // 较高血量（精英单位）
    speed: 1.0,      // 飞行化后速度降低（原 2.0）
    reward: 45,      // 高奖励（地铁场景精英）
    color: '#b45309', // 锈迹橙棕色
    size: 36,        // 缩小体型（原 72 的 50%）
    special: ['flying', 'rail_charge', 'train_split'], // 飞行 / 轨道冲刺 / 被列车碾压分裂
  },
};

// ========== 战斗数值平衡（从 balance.ts 拆分合并） ==========
/**
 * 敌人相关战斗平衡参数
 * @description 包含防线、玩家、碰撞检测、蟑螂 AI 等核心战斗数值。
 * 所有距离单位为像素，时间单位为秒。
 */
export const BALANCE_ENEMIES = {
  // ===== 防线 =====
  // 防线是玩家需要保护的目标，被蟑螂突破则扣血
  defense: {
    baseHp: 80,          // 防线基础血量（不同难度下可能不同）
    repairPercent: 0.2,  // 防线修复百分比（20%）
  },

  // ===== 玩家 / 燃气 =====
  // 玩家使用火焰喷射器，消耗燃气，过热时需要冷却
  player: {
    baseGasCapacity: 100,        // 基础燃气容量（喷射帧数）
    baseFireRange: 440,          // 基础火焰射程（像素）
    baseOverheatThreshold: 1800, // 基础过热阈值（累积热量）
    heatWarningDuration: 3,      // 过热警告持续时间（秒），警告剩余 3 秒
    overheatCooldown: {          // 过热冷却时间（秒），按火焰模式
      cone: 10,                  // 锥形火焰模式
      shotgun: 6,                // 散弹模式
      poison: 8,                 // 毒气模式
    },
    heatDecayRate: { easy: 1.5, hard: 1 }, // 热量衰减速率（简单模式冷却更快）
    maxReloadTime: { easy: 8, hard: 15 },  // 最大换罐时间（秒）
    shotgunPellets: 5,           // 散弹弹丸数
    nozzleOffsetY: 322,          // 喷火枪喷嘴 Y 偏移（像素，从屏幕顶部算）
    armorShieldCacheInterval: 0.3, // 护甲/护盾缓存刷新间隔（秒）
  },

  // ===== 碰撞检测 =====
  // 火焰与蟑螂的碰撞检测参数
  collision: {
    beamHalfWidth: 15,           // 火焰束半宽（像素），用于碰撞检测
    armorDamageReduction: 0.2,   // 护甲伤害减免（20%）
    armorAbsorbRatio: 0.8,       // 护甲吸收伤害比例（80% 由护甲承担）
    panicTimerMin: 0.3,          // 恐慌状态最小持续时间（秒）
    panicTimerMax: 0.5,          // 恐慌状态最大持续时间（秒）
    bossDamageResist: 0.5,       // Boss 伤害抗性（50%）
    poisonTimer: 5,              // 中毒持续时间（秒）
    poisonDamageNormal: 1,       // 普通中毒每跳伤害
    poisonDamageQueen: 2,        // 女王中毒每跳伤害（更高）
    damageFlashDuration: 0.4,    // 伤害闪烁持续时间（秒）
    bossDamageFlashDuration: 2.0, // Boss 伤害闪烁持续时间（秒，更长）
    flameRangeRatio: 0.5,        // 火焰有效范围比例（火焰后半段伤害衰减）
    flameFalloffFactor: 0.7,     // 火焰衰减系数（远端伤害 = 基础 * 0.7）
    flyingHitWidthMultiplier: 4, // 飞行蟑螂命中宽度倍率（更难命中，需要更宽判定）
    flyingRangeMultiplier: 1.3,  // 飞行蟑螂火焰射程倍率（可以打更远）
    flyingFalloffRange: 1.2,     // 飞行蟑螂火焰衰减范围
    timedSuicidePushBack: 64,    // 定时自爆蟑螂推回距离（像素）
    breachTextYOffset: 20,       // 防线突破文字 Y 偏移（像素）
    armorBreakTextYOffset: 30,   // 破甲文字 Y 偏移（像素）
    armorBreakSparkCount: 8,     // 破甲火花粒子数
    panicAngleHalfRange: 0.3,    // 恐慌角度半范围（弧度）
    // 不同蟑螂类型对防线造成的突破伤害（简单/困难模式）
    defenseBreachDamage: {
      small: { easy: 2, hard: 5 },
      large: { easy: 5, hard: 15 },
      flying: { easy: 3, hard: 8 },
      armored: { easy: 4, hard: 12 },
      splitting: { easy: 4, hard: 10 },
      timedSuicide: { easy: 5, hard: 15 },
      queen: { easy: 12, hard: 35 }, // 女王突破伤害最高
      tunnelWorker: { easy: 5, hard: 15 },
      subwayElite: { easy: 6, hard: 18 },
    },
  },

  // ===== 蟑螂 AI =====
  // 蟑螂行为系统参数，包括移动、攻击、分裂、死亡等逻辑
  roachAI: {
    maxDeathChainDepth: 3,       // 死亡链最大深度（防止连锁死亡无限循环）
    transformTimer: 0.2,         // 变身计时器（秒）
    transformFrameCount: 7,      // 变异变身总帧数
    flyingDeathVy: 150,          // 飞行蟑螂死亡垂直速度（像素/秒）
    flyingDeathVxRange: 40,      // 飞行蟑螂死亡水平速度范围
    flyingDeathAngleSpeed: 8,    // 飞行蟑螂死亡旋转速度
    damageFlashDecay: 5,         // 伤害闪烁衰减速率
    deathTimerExtension: 0.1,    // 死亡计时器延长时间（秒）
    healRange: 360,              // 护士蟑螂治疗范围（像素）
    healPercent: 0.20,           // 护士蟑螂治疗百分比（20%）
    nurseShieldHp: 3,            // 护士蟑螂护盾血量
    mutantSpawnCount: 2,         // 变异蟑螂死亡时孵化的小蟑螂数量
    slimeBurstRange: 60,         // 酸液爆发范围（像素）
    clusterChanceRadius: 200,    // 集群生成半径（像素）
    bombPlacementDistance: 64,   // 定时自爆放置炸弹距离（像素）
    bombCountdown: 3,            // 炸弹倒计时（秒）
    bombExplosionRadius: 196,    // 炸弹爆炸半径（像素）
    bombDamage: 50,              // 炸弹伤害
    bombDefenseDamage: { easy: 8, hard: 20 }, // 炸弹对防线伤害
    directionChangeInterval: 1.5, // 方向改变间隔（秒）
    wobbleAmplitude: 30,          // 地面蟑螂摇摆幅度（像素）
    flyingWobbleAmplitude: 80,    // 飞行蟑螂摇摆幅度（像素，更大）

    // 自爆爆炸配置
    suicideExplosion: {
      radius: 100,              // 爆炸范围（像素）
      damage: 15,               // 爆炸伤害
      defenseDamageRange: 100,  // 对防线伤害范围（像素）
      defenseDamageRangeFlying: 300, // 飞行自爆对防线伤害范围（像素，更大）
      defenseDamage: { easy: 5, hard: 15 }, // 对防线伤害
      screenShake: 20,          // 屏幕震动强度
      explosionParticles: 50,   // 爆炸粒子数
      smokeParticles: 40,       // 烟雾粒子数
      debrisParticles: 25,      // 碎片粒子数
      sparkParticles: 30,       // 火花粒子数
      fireRingParticles: 20,    // 火环粒子数
    },

    // 死亡爆炸配置（蟑螂被杀死时的爆炸）
    deathExplosion: {
      radius: 80,               // 爆炸范围（像素）
      damage: 12,               // 爆炸伤害
      explosionParticles: 35,   // 爆炸粒子数
      smokeParticles: 30,       // 烟雾粒子数
      debrisParticles: 20,      // 碎片粒子数
      fireRingParticles: 15,    // 火环粒子数
      sparkParticles: 20,       // 火花粒子数
      screenShake: 12,          // 屏幕震动强度
    },

    // 防线突破爆炸配置（蟑螂突破防线时的爆炸）
    breachExplosion: {
      screenShake: 28,          // 屏幕震动强度
      explosionParticles: 80,   // 爆炸粒子数
      fireRingParticles: 30,    // 火环粒子数
      smokeParticles: 40,       // 烟雾粒子数
      debrisCount: 15,          // 碎片数量
      ringCount: 3,             // 冲击波环数
      defenseDamage: { easy: 8, hard: 20 }, // 对防线伤害
    },

    // 酸液溅射配置（变异蟑螂死亡时）
    acidSplash: {
      radius: 100,              // 溅射范围（像素）
      damage: 10,               // 酸液伤害
      burnMultiplier: 1.5,      // 灼烧伤害倍率
    },

    // 自爆引信配置
    suicideFuse: {
      groundTriggerDist: 150,   // 地面自爆触发距离（像素）
      flyingTriggerDist: 80,    // 飞行自爆触发距离（像素）
      sparkChance: 0.3,         // 火花出现概率（30%）
    },

    // 闪避/躲避配置
    dodge: {
      splitChildSpeed: 250,     // 分裂子蟑螂闪避速度（像素/秒）
      smallSpeed: 180,          // 小蟑螂闪避速度
      suicideSpeed: 100,        // 自爆蟑螂闪避速度
      suicideDuration: 1.2,     // 自爆蟑螂闪避持续时间（秒）
      splitChildMin: 0.2, splitChildMax: 0.4, // 分裂子蟑螂闪避触发时间范围
      smallMin: 0.4, smallMax: 0.7,           // 小蟑螂闪避触发时间范围
    },

    // 移动系统配置
    movement: {
      flyingWanderAmplitude: 80,   // 飞行蟑螂游荡幅度（像素）
      groundWanderAmplitude: 30,   // 地面蟑螂游荡幅度（像素）
      flyingChargeDist: 150,       // 飞行蟑螂冲刺距离（像素）
      flyingChargeSpeed: 2.5,      // 飞行蟑螂冲刺速度倍率
      edgeStopMargin: 80,          // 边缘停止余量（像素）
      edgeRepelDist: 120,          // 边缘排斥距离（像素）
      edgeRepelStrength: 150,      // 边缘排斥力度
      minDownwardSpeed: 10,        // 最小向下速度（像素/秒，防止蟑螂悬浮）
      nurseFollowSpeedMult: 0.5,   // 护士跟随速度倍率（跟随友军较慢）
      nurseStopDist: 40,           // 护士停止跟随距离（像素）
      baitPullStrength: 0.7,       // 诱饵拉力强度
      baitSpeedMult: 1.3,          // 诱饵吸引时速度倍率
      enrageHpThreshold: 0.5,      // 狂暴 HP 阈值（50%）
      enrageSpeedMult: 2,          // 狂暴速度倍率（2 倍）
      forceApproachDist: 50,       // 强制接近距离（像素）
      forceApproachMinSin: 0.3,    // 强制接近最小正弦值
      forceApproachMaxSin: 0.4,    // 强制接近最大正弦值
    },

    // 护士蟑螂治疗阶段配置
    nurseHealPhases: {
      idle: 1,              // 空闲阶段（秒）
      charging: 1.0,        // 充能阶段（秒）
      spraying: 2.0,        // 喷雾阶段（秒）
      dissipating: 1.0,     // 消散阶段（秒）
      healBuffDuration: 2.0, // 治疗增益持续时间（秒）
    },

    // 分裂蟑螂配置
    split: {
      count: 5,              // 分裂数量
      spawnRadius: 50,       // 分裂生成半径（像素）
      deathTimer: 0.5,       // 分裂死亡计时器（秒）
    },

    // 飞行蟑螂死亡配置
    flyingDeath: {
      deathTimer: 2.0,        // 死亡动画持续时间（秒）
      wingParticles: 8,       // 翅膀粒子数
      debrisParticles: 12,    // 碎片粒子数
      sparkParticles: 20,     // 火花粒子数
    },

    // Boss 反噬伤害（杀死蟑螂女王时对周围蟑螂的伤害）
    bossBacklash: {
      small: 50, large: 150, flying: 100,
      suicide: 200, flyingSuicide: 180, splitting: 150, armored: 100,
    },

    // 死亡粒子配置（不同蟑螂死亡时产生的粒子数量）
    deathParticles: {
      queen: { ash: 50, spark: 40, blood: 40 },   // 女王死亡粒子最多
      large: { ash: 20, spark: 15, blood: 25 },
      default: { ash: 12, spark: 8, blood: 15 },
    },

    // 定时自爆蟑螂突破防线配置
    timedBreach: {
      approachDist: 200,       // 接近距离（像素）
      warningTimer: 0.5,       // 警告计时器（秒）
      warningSpeedMult: 0.5,   // 警告时速度倍率
      placeDistance: 80,       // 放置炸弹距离（像素）
      placeTimer: 2.0,         // 放置计时器（秒）
      bombTimer: 3,            // 炸弹计时器（秒）
      corpseBombTimer: 3.0,    // 尸体炸弹计时器（秒）
      residueTimer: 2.0,       // 残留计时器（秒）
      deathTimer: 1.0,         // 死亡计时器（秒）
    },
  },
} as const;