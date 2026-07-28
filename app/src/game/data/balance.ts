// ========== 全局平衡参数配置 ==========
export const BALANCE_CONFIG = {
  // ===== 防线 =====
  defense: {
    baseHp: 80,                // 防线初始血量
    repairPercent: 0.2,        // 防线修复道具回复比例
  },

  // ===== 玩家 / 燃气 =====
  player: {
    baseGasCapacity: 100,      // 基础燃气容量
    baseFireRange: 440,        // 基础火焰射程
    baseOverheatThreshold: 1800, // 基础过热阈值
    heatDecayRate: { easy: 1.5, hard: 1 }, // 冷却速度
    maxReloadTime: { easy: 8, hard: 15 },   // 最大装填时间
    shotgunPellets: 5,         // 散弹弹丸数
    nozzleOffsetY: 322,        // 枪口Y偏移
    armorShieldCacheInterval: 0.3, // 护甲保护缓存更新间隔
  },

  // ===== 屏幕震动 =====
  screenShake: {
    weaponHit: 2,              // 普通武器命中
    smallExplosion: 3,         // 小爆炸（毒雾、粘板）
    mediumExplosion: 5,        // 中等爆炸
    largeExplosion: 6,         // 大爆炸
    biggerExplosion: 8,        // 更大爆炸（燃烧瓶）
    breach: 10,                // 防线突破
    bossDeath: 12,             // Boss死亡
    swatter: 12,               // 电蚊拍
    bigBossDeath: 20,          // 大型Boss死亡
    massiveExplosion: 22,      // 巨大爆炸
    queenDeath: 28,            // 女王死亡
    decayThreshold: 0.5,       // 震动衰减阈值
  },

  // ===== 性能 =====
  performance: {
    particleLimit: { low: 150, medium: 200, high: 250, desktop: 400 },
  },

  // ===== 闪电天气（夜晚场景通用） =====
  lightning: {
    timerMin: 5,               // 闪电间隔最小值
    timerRandMax: 10,          // 闪电间隔随机范围
    flashDuration: 0.3,        // 闪电闪光持续时间
    chance: 0.3,               // 闪电触发概率
    textCooldown: 3,           // 闪电文字冷却时间（秒）
  },

  // ===== 天气系统（雨/雾/夜晚粒子效果） =====
  weather: {
    rain: {
      spawnRate: 0.4,          // 每秒生成概率（与帧率解耦）
      vxMin: -20, vxRange: 10, // 水平速度范围
      vyMin: 200, vyRange: 100, // 垂直速度范围
      life: 2,                  // 粒子生命周期（秒）
      sizeMin: 1, sizeRange: 1, // 粒子大小范围
      color: 'rgba(150, 180, 220, 0.4)', // 粒子颜色
    },
    fog: {
      spawnRate: 0.05,          // 每秒生成概率（与帧率解耦）
      vxMin: 10, vxRange: 10,   // 水平速度范围
      vyMin: -5, vyRange: 10,   // 垂直速度范围
      lifeMin: 8, lifeRange: 4, // 生命周期范围
      sizeMin: 30, sizeRange: 50, // 大小范围
      colorBase: '180, 180, 160', // 颜色基础 RGB
      alphaMin: 0.05, alphaRange: 0.05, // 透明度范围
      growthRate: 1.005,        // 粒子大小增长速率
    },
  },

  // ===== 武器伤害 =====
  weaponDamage: {
    flamethrower: { easy: 45, hard: 30 },
    poison: { easy: 20, hard: 12 },
    shotgun: { easy: 50, hard: 35 },
    molotov: { easy: 40, hard: 25 },
    fallback: { easy: 45, hard: 30 }, // 未知武器回退伤害
    // 火焰区域参数
    fireZoneDpsMultiplier: 3,  // 每帧伤害倍率（baseDamage * multiplier = 每帧造成伤害）
    fireZoneMaxLife: 0.5,      // 火焰区域最大生命周期（秒）
    fireZoneMaxCount: 25,      // 火焰区域最大数量
  },

  // ===== 粒子生成器 =====
  particle: {
    // === 锥形火焰 ===
    coneFire: {
      countMin: 3, countMax: 3, // 每帧生成粒子数范围
      lifeMin: 0.06, lifeMax: 0.08,
      flowSpeedMin: 100, flowSpeedMax: 60,
      fireSizeMin: 2, fireSizeMax: 5,
      emberSizeMin: 1, emberSizeMax: 3,
      sparkSizeMin: 2, sparkSizeMax: 3,
      angleSpread: 0.5,          // 随机角度扩散范围
      // 枪口火花
      muzzleSpark: {
        vxRange: 60,             // 水平速度范围
        vyMin: -100, vyMax: -60, // 垂直速度范围
        life: 0.08,              // 生命周期
        color: '#fff',           // 颜色
      },
      // 火焰粒子颜色公式参数
      fireColor:   { r: 255, gMin: 100, gMax: 180, bMin: 0, bMax: 40, aMin: 0.7, aMax: 1.0 },
      emberColor:  { r: 255, gMin: 200, gMax: 255, bMin: 50, bMax: 100, aMin: 0.5, aMax: 1.0 },
      iceColor:    { rMin: 180, rMax: 220, gMin: 220, gMax: 240, b: 255, aMin: 0.5, aMax: 1.0 },
      poisonColor: { rMin: 100, rMax: 140, gMin: 220, gMax: 250, bMin: 100, bMax: 140, aMin: 0.4, aMax: 0.8 },
    },
    // === 烟雾 ===
    smoke: {
      offsetX: 30, offsetY: 30,
      vxRange: 40, vyBase: -30, vyRange: 50,
      lifeMin: 1, lifeMax: 2,
      sizeMin: 6, sizeMax: 16,
      hue: 0, saturation: 0, lightnessMin: 35, lightnessMax: 35,
    },
    // === 灰烬 ===
    ash: {
      speedMin: 30, speedMax: 80, vyBias: -40,
      lifeMin: 0.6, lifeMax: 1.0,
      sizeMin: 2, sizeMax: 6,
      hue: 0, saturation: 0, lightnessMin: 5, lightnessMax: 20,
    },
    // === 血粒子 ===
    blood: {
      speedMin: 80, speedMax: 200, vyBias: 40,
      life: 0.5,
      sizeMin: 4, sizeMax: 10,
      rMin: 20, rMax: 40, gMin: 120, gMax: 60, bMin: 20, bMax: 40, alphaMin: 0.5, alphaMax: 0.5,
    },
    // === 火花 ===
    spark: {
      speedMin: 60, speedMax: 120,
      lifeMin: 0.2, lifeMax: 0.4,
      sizeMin: 1, sizeMax: 3,
      hueMin: 30, hueMax: 30, saturation: 100, lightness: 75,
    },
    // === 爆炸 ===
    explosion: {
      speedMin: 50, speedMax: 150, vyBias: -30,
      lifeMin: 0.3, lifeMax: 0.5,
      sizeMin: 3, sizeMax: 12,
      hueMin: 10, hueMax: 30, saturation: 100, lightnessMin: 50, lightnessMax: 25,
    },
    // === 碎片 ===
    debris: {
      speedMin: 40, speedMax: 120, vyBias: -50, offsetXY: 10,
      lifeMin: 3, lifeMax: 2,
      sizeMin: 4, sizeMax: 10,
      hueMin: 15, hueMax: 20, saturation: 80, lightnessMin: 30, lightnessMax: 20,
    },
    // === 火环 ===
    fireRing: {
      speedMin: 60, speedMax: 80, vyBias: -20,
      lifeMin: 1.5, lifeMax: 1.5,
      sizeMin: 8, sizeMax: 16,
      hueMin: 10, hueMax: 25, saturation: 100, lightness: 55,
    },
    // === 冲击波 ===
    shockwave: {
      outerSpeedMin: 150, outerSpeedMax: 200,
      outerLifeMin: 0.8, outerLifeMax: 0.4,
      outerSizeMin: 12, outerSizeMax: 20,
      innerCount: 10, innerSpeedMin: 80, innerSpeedMax: 150,
      innerLifeMin: 0.5, innerLifeMax: 0.3,
      innerSizeMin: 6, innerSizeMax: 12,
      outerColor: { r: 255, gMin: 200, gMax: 255, bMin: 100, bMax: 150, a: 0.9 },
      innerColor: { r: 255, g: 255, b: 255, a: 0.95 },
    },
    // === 闪电 ===
    lightning: {
      topCount: 20, topWidthRatio: 0.8, topYRange: 50,
      topVxRange: 60, topVyMin: 100, topVyMax: 200,
      topLifeMin: 0.4, topLifeMax: 0.4,
      topSizeMin: 3, topSizeMax: 6,
      fullCount: 30, fullVxRange: 100, fullVyRange: 100,
      fullLifeMin: 0.2, fullLifeMax: 0.3,
      fullSizeMin: 2, fullSizeMax: 4,
      topColor: { r: 150, g: 220, b: 255, aMin: 0.6, aMax: 1.0 },
      fullColor: { r: 200, g: 240, b: 255, aMin: 0.5, aMax: 1.0 },
    },
    // === 粒子物理参数 ===
    physics: {
      fire:   { vyDecay: 25, sizeDecay: 0.97 },
      smoke:  { vxDecay: 0.92, sizeGrowth: 1.015 },
      blood:  { vyGravity: 100, vxDecay: 0.95, defenseLineOffset: 5 },
      ice:    { vyGravity: 20, sizeDecay: 0.98 },
      poisonCloud: { vxRandom: 10, vyDecay: 5, sizeGrowth: 1.01 },
      explosion: { vyGravity: 40, sizeDecay: 0.94 },
      ash:    { vyGravity: 120, vxDecay: 0.97, sizeDecay: 0.985, defenseLineOffset: 2, bounceVx: 0.8 },
      lightning: { lifeMultiplier: 2 },
    },
    // === 浮动文字 ===
    floatingText: {
      defaultVy: -30,     // 默认上升速度
      defaultLife: 2.0,   // 默认生命周期（秒）
    },
    // === 爆炸粒子（spawnExplosionParticles） ===
    explosionParticle: {
      intensityMultiplier: 3,  // 强度 → 粒子数倍率
      maxCount: 100,           // 最大粒子数
      speedMin: 50, speedMax: 200,
      lifeMin: 0.5, lifeMax: 1.5,
      sizeMin: 2, sizeMax: 8,
    },
  },

  // ===== 碰撞检测 =====
  collision: {
    beamHalfWidth: 15,         // 火焰光束半宽
    armorDamageReduction: 0.2, // 护甲肉盾保护穿透比例
    armorAbsorbRatio: 0.8,     // 护甲吸收伤害比例
    panicTimerMin: 0.3,        // 恐慌最小时间
    panicTimerMax: 0.5,        // 恐慌最大随机时间
    bossDamageResist: 0.5,     // Boss火焰抗性
    poisonTimer: 5,            // 毒气持续时间
    poisonDamageNormal: 1,     // 毒气普通伤害
    poisonDamageQueen: 2,      // 毒气女王伤害
    damageFlashDuration: 0.4,  // 受击闪烁持续时间
    bossDamageFlashDuration: 2.0, // Boss受击闪烁持续时间
    // 火焰碰撞
    flameRangeRatio: 0.5,      // 火焰射程比例（实际范围 = fireRange * ratio）
    flameFalloffFactor: 0.7,   // 火焰伤害衰减系数
    flyingHitWidthMultiplier: 4, // 飞行蟑螂碰撞宽度倍率
    flyingRangeMultiplier: 1.3, // 飞行蟑螂射程倍率
    flyingFalloffRange: 1.2,   // 飞行蟑螂衰减距离倍率
    // 防线突破
    timedSuicidePushBack: 64,  // 定时自爆未放炸弹时回推距离
    breachTextYOffset: 20,     // 防线突破文字Y偏移
    // 护甲
    armorBreakTextYOffset: 30, // 护甲破碎文字Y偏移
    armorBreakSparkCount: 8,   // 护甲破碎火花数量
    // 恐慌
    panicAngleHalfRange: 0.3,  // 恐慌角度半范围（(random-0.5)*range）
    defenseBreachDamage: {     // 各类型蟑螂突破防线伤害
      small: { easy: 2, hard: 5 },
      large: { easy: 5, hard: 15 },
      flying: { easy: 3, hard: 8 },
      armored: { easy: 4, hard: 12 },
      splitting: { easy: 4, hard: 10 },
      timedSuicide: { easy: 5, hard: 15 },
      queen: { easy: 12, hard: 35 },
    },
  },

  // ===== 雷达激光 =====
  radarLaser: {
    duration: 5,               // 激活持续时间
    fireInterval: 0.3,         // 发射间隔
    damage: 10,                // 单发伤害
    shotsRemaining: 5,         // 弹数
    // 倒计时警告时间点（秒）
    countdownWarnTimes: [3, 1],
    // 命中效果
    sparkCount: 8,             // 命中火花粒子数
    impactParticle: { vy: -20, life: 0.3, size: 8 },  // 命中粒子参数
    // 浮动文字Y偏移
    textOffsetY: {
      activate: -60,           // 激活文字
      desc: -40,               // 描述文字
      countdown: -80,          // 倒计时警告
      closing: -60,            // 即将关闭
      closed: -50,             // 关闭
      exhausted: -50,          // 弹药耗尽
      shot: -40,               // 射击计数
      damage: -30,             // 伤害数字
      kill: -20,               // 击杀
    },
    shotTextOffsetX: 30,       // 射击计数X偏移（相对玩家）
    // 渐隐动画
    fadeOutDuration: 0.5,      // 渐隐持续时间（秒）
    fadeInSpeed: 2,            // 渐显速度（每秒）
  },

  // ===== 电蚊拍 =====
  swatter: {
    cooldownMax: 60,           // 最大冷却时间
    stunDuration: 5,           // 麻痹持续时间
    stunSpeedRatio: 0.2,       // 麻痹速度比例
    animTimer: 0.6,            // 动画持续时间
    maxInventory: 3,           // 最大库存
  },

  // ===== 三重火焰 =====
  tripleFlame: {
    duration: 15,              // 持续时间（秒）
    sideOffset: 100,           // 侧枪偏移（像素）
    sideDamageMult: 0.8,       // 侧枪伤害倍率
    warningThreshold: 5,       // 警告阈值（剩余秒数）
    countdownSeconds: [3, 2, 1] as readonly number[], // 倒计时秒数
  },

  // ===== 投掷物 =====
  throwable: {
    sticky: { radius: 80, stuckTimer: 5, damage: 2, speedRatio: 0.2, fireZoneLife: 4, fireZoneDps: 30 },
    poison: { radius: 90, poisonTimer: 6, poisonDamage: 2, initialDamage: 2, fireZoneLife: 6, fireZoneDps: 25, maxPoisonTimer: 10, poisonDamageMax: 4 },
    molotov: { radius: 70, baseDamage: 8, burnDamageMultiplier: 2, fireZoneLife: 5, fireZoneDps: 60 },
    gravity: 400,              // 重力加速度
    sparkCount: 10,            // 落地火花数量
    explosionParticleCount: 25, // 爆炸粒子数量
  },

  // ===== 粘板/粘液弹 =====
  sticky: {
    dropCount: 10,             // 粘液弹数量
    fireInterval: 0.08,        // 发射间隔
    dropLife: 12,              // 粘液弹附着时间
    wrapTimer: 12,             // 包裹计时器
    damagePerTick: 0.5,        // 每跳伤害
    damageFlash: 0.1,          // 伤害闪烁
    boardLife: 5,              // 粘板生命周期
    boardMaxStuck: 5,          // 粘板最大粘住数
    boardBaseW: 240,           // 粘板基础宽度
    boardBaseH: 240,           // 粘板基础高度
    dropSpeed: 250,            // 粘液弹基础速度
    dropSpeedRandom: 100,      // 粘液弹速度随机范围
    dropInitialVy: 80,         // 粘液弹初始垂直速度
    dropInitialVyRandom: 40,   // 粘液弹初始垂直速度随机范围
    dropSize: 6,               // 粘液弹基础大小
    dropSizeRandom: 3,         // 粘液弹大小随机范围
    dropMaxLife: 3,            // 粘液弹最大生命周期
    trackRange: 400,           // 追踪范围
    trackSteerFactor: 5,       // 追踪转向系数
    hitParticleCount: 8,       // 命中粒子数
  },

  // ===== 瞄准系统 =====
  aiming: {
    maxPowerTime: 1.5,         // 最大蓄力时间
    minDist: 80,               // 最小瞄准距离
    maxDist: 500,              // 最大瞄准距离
    gravity: 400,              // 重力
    travelTimeBase: 0.5,       // 飞行时间基础值
    travelTimePowerMult: 0.3,  // 飞行时间蓄力系数
    arcHeightBase: 100,        // 弧线高度基础值
    arcHeightPowerMult: 150,   // 弧线高度蓄力系数
    trajectorySteps: 30,       // 轨迹预览步数
    borderMarginX: 40,         // 瞄准边界水平边距
    borderMarginTop: 60,       // 瞄准边界顶部边距
    borderMarginFromDefense: 20, // 瞄准边界距防线底部边距
    adjustSensitivity: 1.5,    // 瞄准调整灵敏度
    defaultCanvasWidth: 800,   // 画布宽度兜底值（回调为空时使用）
    defaultDefenseLineY: 600,  // 防线Y坐标兜底值（回调为空时使用）
  },

  // ===== Boss 战斗 =====
  boss: {
    baseHp: 10000,             // Boss基础血量
    totalLayers: 4,            // 虫卵波次层数（4层HP条）
    phaseChangeTimer: 6,       // 阶段切换计时器
    deathAnimTimer: 1.75,      // 死亡动画计时器（7帧 at 4fps）
    corpseStayTimer: 2.0,      // 尸体停留时间
    timeLimit: 180,            // 时间限制
    eyeHp: 800,                // 眼球血量
    bellyHp: 1500,             // 腹部血量
    maxShed: 3,                // 最大蜕皮次数
    speed: 0.6,                // Boss移动速度
    wobbleSpeed: 0.5,          // 摆动速度最小值
    wobbleSpeedRandom: 1,      // 摆动速度随机范围
    defenseLineOffset: 15,     // Boss防线偏移（安全网）
    // 悬停动画
    hoverAmplitude: 60,        // 悬停水平摆动幅度
    hoverYAmplitude: 15,       // 悬停垂直摆动幅度
    hoverLerpSpeed: 2.0,       // 悬停插值速度
    hoverFreq: 1.2,            // 悬停水平摆动频率
    hoverYFreq: 2,             // 悬停垂直摆动频率
    // 逃跑
    fleeSpeed: 80,             // 逃跑垂直速度
    fleeWobbleAmplitude: 30,   // 逃跑水平摆动幅度
    fleeWobbleFreq: 3,         // 逃跑水平摆动频率
    fleeOffscreenY: -200,      // 逃跑离屏Y坐标
    fleeTimer: 5,              // 逃跑计时器
    // 召唤
    summonCastTimer: 2.0,      // 召唤施法计时器
    summonPhaseChangeTimer: 3, // 召唤阶段切换横幅计时器
    // 对话
    dialogueTimer: 3,          // 对话计时器
    dialogueDelays: [3000, 6000, 9000], // 对话延迟（毫秒）
    dialogueTextOffsets: {     // 对话文字Y偏移
      line1: 100,
      line2: 80,
      line3: 60,
    },
    // 死亡效果
    deathExplosionParticles: 60, // 死亡爆炸粒子
    deathShockwaveRadius: 50,    // 死亡冲击波半径
    // 虫卵波次
    eggWaveSpawnTimer: 2,        // 虫卵波次生成计时器
    // 难度
    armorHp: { normal: 12, hard: 20 }, // 护甲血量
    bossSize: 120,               // Boss大小
    bossReward: 500,             // Boss击杀奖励
    bossYRatio: 0.18,            // Boss Y位置比例
  },

  // ===== 波次系统 =====
  wave: {
    clearDelay: 2,             // 波次清除延迟
    clearTimer: 6,             // 波次清除计时器（通关后）
    baseReward: 50,            // 基础奖励
    rewardPerWave: 10,         // 每波额外奖励
    rewardMultiplier: { easy: 0.8, hard: 1.5 },
    perfectMultiplier: 1.5,    // 完美波次奖励倍率
    baseInterval: 0.8,         // 基础生成间隔
    intervalMultiplier: { easy: 1.2, hard: 0.7 },
    intervalReductionPerWave: 0.05, // 每波间隔减少
    intervalMin: 0.2,          // 最小生成间隔
    difficultyMultiplier: { easy: 0.7, hard: 1.5 },
    difficultyPerWave: 0.1,    // 每波难度递增
    // 默认波次配置（getWaveConfig 回退值）
    defaultConfig: {
      smallCount: 10, largeCount: 5, flyingCount: 3, armoredCount: 2,
      splittingCount: 1, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0,
      speed: 1.0, interval: 1.0, spawnInterval: 0.5, clusterChance: 0.3,
    },
    // 生成计时器随机范围
    spawnTimerMin: 0.3,
    spawnTimerMax: 0.8,
    // 三阶段比例
    phase1Ratio: 0.3,
    phase2Ratio: 0.5,
    // 倒计时
    countdownDuration: 3.0,
    countdownPhases: 3,
    // 医院虫卵
    eggPod: {
      baseW: 72, baseH: 96,
      yMin: 361, yMax: 612,
      hatchTime: 5,
      barW: 60, barH: 6,
      barOffsetY: 10,
      pulseFreq: 6,
      pulseRadius: 8,
    },
  },

  // ===== 蟑螂 AI =====
  roachAI: {
    maxDeathChainDepth: 3,     // 最大死亡链深度
    transformTimer: 0.2,       // 变异变形帧间隔
    transformFrameCount: 7,    // 变异变形总帧数
    flyingDeathVy: 150,        // 飞行蟑螂死亡垂直速度
    flyingDeathVxRange: 40,    // 飞行蟑螂死亡水平速度范围
    flyingDeathAngleSpeed: 8,  // 飞行蟑螂死亡旋转速度
    damageFlashDecay: 5,       // 伤害闪烁衰减速度
    deathTimerExtension: 0.1,  // 死亡计时器延长（变异变形中）
    healRange: 360,            // 护士治疗范围
    healPercent: 0.20,         // 护士治疗百分比
    nurseShieldHp: 3,          // 护士护盾血量
    mutantSpawnCount: 2,       // 变异死亡孵出小蟑螂数量
    slimeBurstRange: 60,       // 粘液爆发范围
    clusterChanceRadius: 200,  // 集群生成半径
    bombPlacementDistance: 64, // 定时炸弹放置距离
    bombCountdown: 3,          // 炸弹倒计时
    bombExplosionRadius: 196,  // 炸弹爆炸半径
    bombDamage: 50,            // 炸弹对蟑螂伤害
    bombDefenseDamage: { easy: 8, hard: 20 }, // 炸弹对防线伤害
    directionChangeInterval: 1.5, // Z字形方向切换间隔
    wobbleAmplitude: 30,       // 摆动幅度
    flyingWobbleAmplitude: 80, // 飞行蟑螂摆动幅度

    // ===== 自爆爆炸（suicideExplode） =====
    suicideExplosion: {
      radius: 100,              // 爆炸半径
      damage: 15,               // 基础伤害
      defenseDamageRange: 100,  // 对防线伤害判定距离（地面）
      defenseDamageRangeFlying: 300, // 对防线伤害判定距离（飞行）
      defenseDamage: { easy: 5, hard: 15 }, // 对防线伤害
      screenShake: 20,          // 屏幕震动
      explosionParticles: 50,   // 爆炸粒子
      smokeParticles: 40,       // 烟雾粒子
      debrisParticles: 25,      // 碎片粒子
      sparkParticles: 30,       // 火花粒子
      fireRingParticles: 20,    // 火环粒子
    },

    // ===== 死亡爆炸（suicideDeathExplode） =====
    deathExplosion: {
      radius: 80,               // 爆炸半径
      damage: 12,               // 基础伤害
      explosionParticles: 35,   // 爆炸粒子
      smokeParticles: 30,       // 烟雾粒子
      debrisParticles: 20,      // 碎片粒子
      fireRingParticles: 15,    // 火环粒子
      sparkParticles: 20,       // 火花粒子
      screenShake: 12,          // 屏幕震动
    },

    // ===== 防线突破爆炸（triggerBreachExplosion） =====
    breachExplosion: {
      screenShake: 28,          // 屏幕震动
      explosionParticles: 80,   // 爆炸粒子
      fireRingParticles: 30,    // 火环粒子
      smokeParticles: 40,       // 烟雾粒子
      debrisCount: 15,          // 碎片数量
      ringCount: 3,             // 火焰环数量
      defenseDamage: { easy: 8, hard: 20 }, // 对防线伤害
    },

    // ===== 酸液溅射（mutantDeathEffect） =====
    acidSplash: {
      radius: 100,              // 酸液溅射半径
      damage: 10,               // 基础伤害
      burnMultiplier: 1.5,      // 灼烧伤害倍率
    },

    // ===== 自爆引信 =====
    suicideFuse: {
      groundTriggerDist: 150,   // 地面自爆触发距离
      flyingTriggerDist: 80,    // 飞行自爆触发距离
      sparkChance: 0.3,         // 火花粒子概率
    },

    // ===== 闪避 =====
    dodge: {
      splitChildSpeed: 250,     // 分裂子体闪避速度
      smallSpeed: 180,          // 小蟑螂闪避速度
      suicideSpeed: 100,        // 自爆蟑螂闪避速度
      suicideDuration: 1.2,     // 自爆蟑螂闪避持续时间
      splitChildMin: 0.2,       // 分裂子体闪避最小时间
      splitChildMax: 0.4,       // 分裂子体闪避最大时间
      smallMin: 0.4,            // 小蟑螂闪避最小时间
      smallMax: 0.7,            // 小蟑螂闪避最大时间
    },

    // ===== 移动 =====
    movement: {
      flyingWanderAmplitude: 80,   // 飞行蟑螂摆动幅度
      groundWanderAmplitude: 30,   // 地面蟑螂摆动幅度
      flyingChargeDist: 150,       // 飞行蟑螂冲刺距离
      flyingChargeSpeed: 2.5,      // 飞行蟑螂冲刺速度系数
      edgeStopMargin: 80,          // 边缘停止距离
      edgeRepelDist: 120,          // 边缘排斥距离
      edgeRepelStrength: 150,      // 边缘排斥力
      minDownwardSpeed: 10,        // 最小向下速度
      nurseFollowSpeedMult: 0.5,   // 护士跟随速度系数
      nurseStopDist: 40,           // 护士停止跟随距离
      baitPullStrength: 0.7,       // 诱饵拉力系数
      baitSpeedMult: 1.3,          // 诱饵速度倍率
      enrageHpThreshold: 0.2,     // 愤怒血量阈值
      enrageSpeedMult: 2,          // 愤怒速度倍率
      forceApproachDist: 50,       // 强制接近防线距离
      forceApproachMinSin: 0.3,    // 强制接近最小 sin 值
      forceApproachMaxSin: 0.4,    // 强制接近最大 sin 增量
    },

    // ===== 护士治疗阶段计时 =====
    nurseHealPhases: {
      idle: 1,                   // 空闲阶段基础计时
      charging: 1.0,             // 蓄力阶段计时
      spraying: 2.0,             // 喷射阶段计时
      dissipating: 1.0,          // 消散阶段计时
      healBuffDuration: 2.0,     // 治疗增益持续时间
    },

    // ===== 分裂蟑螂 =====
    split: {
      count: 5,                  // 分裂数量
      spawnRadius: 50,           // 生成半径
      deathTimer: 0.5,           // 死亡计时器
    },

    // ===== 飞行蟑螂死亡 =====
    flyingDeath: {
      deathTimer: 2.0,           // 死亡计时器
      wingParticles: 8,          // 翅膀碎片粒子
      debrisParticles: 12,       // 碎片粒子
      sparkParticles: 20,        // 火花粒子
    },

    // ===== Boss 反噬伤害 =====
    bossBacklash: {
      small: 50, large: 150, flying: 100,
      suicide: 200, flyingSuicide: 180, splitting: 150, armored: 100,
    },

    // ===== 死亡粒子效果 =====
    deathParticles: {
      queen: { ash: 50, spark: 40, blood: 40 },
      large: { ash: 20, spark: 15, blood: 25 },
      default: { ash: 12, spark: 8, blood: 15 },
    },

    // ===== 定时自爆突破系统 =====
    timedBreach: {
      approachDist: 200,         // 开始接近的距离
      warningTimer: 0.5,         // 警告阶段计时
      warningSpeedMult: 0.5,     // 警告阶段速度系数
      placeDistance: 80,         // 放置炸弹距离
      placeTimer: 2.0,           // 放置炸弹计时
      bombTimer: 3,              // 炸弹倒计时
      corpseBombTimer: 3.0,      // 尸体炸弹倒计时
      residueTimer: 2.0,         // 残留计时
      deathTimer: 1.0,           // 死亡计时器
    },
  },

  // ===== 消耗品 =====
  consumable: {
    combatStartDelay: 1,       // 战斗开始延迟
    buffFlashDuration: 2,      // 增益闪光持续时间
    powerBoostDuration: 8,     // 火力全开持续时间
    shieldDuration: 5,         // 护盾持续时间
    baitDuration: 3,           // 诱饵持续时间
    globalCooldown: 1,         // 全局冷却时间
    baitThrowAnimDuration: 0.8, // 诱饵投掷动画时间
    baitThrowAnimHeight: 150,   // 诱饵投掷弧线高度
    // 浮动文字Y偏移
    floatTextOffset: {
      player: 40,               // 玩家上方偏移
      defenseRepair: 30,        // 防线修复偏移
      shield: 50,               // 护盾文字偏移
      emergencyCool: 60,        // 紧急冷却偏移
      bait: 40,                 // 诱饵文字偏移
      baitEnd: 40,              // 诱饵结束文字偏移
    },
    // 自动使用条件
    autoUseConditions: {
      emergency_cool: 'overheated',      // 过热时
      shield: 'defenseLowHealth',        // 防线低血量
      gas_refill: 'lowGas',              // 燃气不足
      defense_repair: 'defenseLowHealth', // 防线低血量
      power_boost: 'never',              // 不自动使用
      bait: 'never',                     // 不自动使用
    } as Record<string, string>,
    // 自动使用触发阈值
    autoUseThresholds: {
      defenseLowHealth: 0.15,  // 防线血量低于15%触发
      lowGas: 0.3,             // 燃气低于30%触发
    },
  },

  // ===== 无尽模式 =====
  endless: {
    newRecordTimer: 3,         // 新纪录显示时间
  },

  // ===== 武器掉落（场景配置） =====
  weaponDropScene: {
    dropLife: 12,              // 掉落生命周期
    bobSpeed: 4,               // 漂浮速度
    pickBaseX: 60,             // 拾取物基础X偏移
    pickXRange: 120,           // 拾取物X偏移范围
    pickupRadius: 60,          // 拾取判定半径（X和Y）
    spawnYOffset: 40,          // 掉落生成Y偏移（防线以上，必须在pickupRadius内）
    spawnYRange: 20,           // 掉落生成Y随机范围
    multiDropSpacing: 100,     // 多掉落物间距
    maxInventory: 3,           // 每种类型最大库存
    spawnIntervals: {
      kitchen: 40, sewer: 35, dump: 30, basement: 25,
      rooftop: 20, street: 25, hospital: 30, subway: 25,
      supermarket: 25, school: 25, nest: 30,
    } as Record<string, number>,
  },

  // ===== 毒雾粒子 =====
  poisonCloud: {
    particleCount: 20,         // 粒子数量
    speedMin: 40,              // 粒子速度最小值
    speedMax: 80,              // 粒子速度随机范围
    lifeMin: 0.5,              // 粒子生命周期最小值
    lifeMax: 0.8,              // 粒子生命周期随机范围
    maxLife: 1.3,              // 粒子最大生命周期
    sizeMin: 4,                // 粒子大小最小值
    sizeMax: 12,               // 粒子大小随机范围
    fireZoneDps: 25,           // 火焰区域DPS
    fireZoneLife: 6,           // 火焰区域生命周期
  },

  // ===== 杀虫剂喷雾 =====
  insecticide: {
    // 喷雾参数
    duration: 3,               // 喷雾持续时间（秒）
    damageInterval: 0.3,       // 伤害间隔（秒）
    baseDamage: 2,             // 基础伤害
    damageMultiplier: 0.5,     // 伤害系数（baseDamage * multiplier = 实际伤害）
    damageRange: 280,          // 锥形检测最大距离
    // 中毒效果
    poisonTimer: 3,            // 中毒持续时间（秒）
    poisonDamage: 1.0,         // 中毒每秒伤害
    // 粒子参数
    sprayDuration: 0.15,       // 喷雾持续时间
    sideParticleCount: 6,      // 侧边粒子数量
    particleLifeMin: 0.3,      // 粒子生命周期最小值
    particleLifeMax: 0.4,      // 粒子生命周期随机范围
    particleSpeedMin: 100,     // 粒子速度最小值
    particleSpeedMax: 80,      // 粒子速度随机范围
    particleAlphaMin: 0.25,    // 粒子透明度最小值
    particleAlphaMax: 0.25,    // 粒子透明度随机范围
    centerParticleCount: 3,    // 中心粒子数量
    centerParticleLifeMin: 0.2,
    centerParticleLifeMax: 0.25,
    maxParticlesPerFrame: 24,  // 每帧最大粒子生成数
    hitParticleChance: 0.3,    // 命中粒子生成概率
    // 其他
    suffocationTimer: 8,       // 窒息持续时间
    suffocationDps: 1,         // 窒息每秒伤害
    warningThreshold: 1,       // 倒计时警告阈值（秒）
  },

  // ===== 风扇系统 =====
  fan: {
    pushForce: 0.5,            // 推力系数
    defaultDuration: 8,        // 风扇默认持续时间
    defaultSlowFactor: 0.5,    // 默认减速系数
    defaultBladeSpeed: 15,     // 默认叶片速度
    fanTopYRatio: 0.5,         // 风扇顶部Y比例
    // 效果参数（按蟑螂类型: [slowFactor, pushSpeed]）
    effects: {
      flying: [0.70, 120],
      flyingSuicide: [0.65, 100],
      small: [0.60, 80],
      large: [0.40, 50],
      splitting: [0.40, 50],
      suicide: [0.30, 35],
      armored: [0.20, 25],
      queen: [0.10, 15],
      default: [0.40, 50],
    } as Record<string, [number, number]>,
    // 渲染参数
    waveCount: 18,             // 风扇波数量
    waveSpeedBase: 2.0,        // 波速基础值
    waveSpeedIncrement: 0.3,   // 波速增量
    waveAmplitudeBase: 14,     // 波幅基础值
    waveAmplitudeIncrement: 1.5, // 波幅增量
    waveAlphaBase: 0.04,       // 波浪线基础透明度
    waveAlphaAmp: 0.03,        // 波浪线透明度波动
    waveLineYStep: 5,          // 波浪线Y步进
    wavePhaseMultiplier: 2.7,  // 波浪相位乘数
    waveStrokeBase: 2.0,       // 波浪线宽基础值
    waveStrokeAmp: 1.0,        // 波浪线宽波动范围
    perspectiveScaleMin: 0.08, // 透视缩放最小值
    sourceWidthRatio: 0.7,     // 风扇源宽度比例
    // 阵风
    gustCount: 5,              // 阵风数量
    gustHeightBase: 45,        // 阵风基础高度
    gustHeightIncrement: 12,   // 阵风高度增量
    gustAlphaBase: 0.15,       // 阵风基础透明度
    gustSpeedBase: 0.5,        // 阵风速度基础值
    gustSpeedIncrement: 0.3,   // 阵风速度增量
    // 粒子
    particleCount: 28,         // 透视粒子数量
    particleRiseSpeedBase: 50, // 粒子上升速度基础值
    particleRiseSpeedIncrement: 30, // 粒子上升速度增量
    particleAlphaBase: 0.15,   // 粒子基础透明度
    particleAlphaAmp: 0.1,     // 粒子透明度波动
    particleSizeBase: 1.8,     // 粒子基础大小
    particleSizeAmp: 0.6,      // 粒子大小波动
    particleRotateAmp: 0.3,    // 粒子旋转幅度
    particleSizeLength: 5,     // 粒子大小长度倍率
    // 风扇源
    sourceAlpha: 0.08,         // 风扇源轮廓透明度
    sourceGlowAlpha: 0.18,     // 风扇源发光透明度
    sourceGlowMidAlpha: 0.06,  // 风扇源发光中间透明度
    // 风扇图标
    iconSize: 22,              // 风扇图标大小
    iconYOffset: 30,           // 风扇图标Y偏移
    iconTimerYOffset: 8,       // 计时器文字Y偏移
    iconBlowingYOffset: 20,    // 吹风文字Y偏移
    bladeSize: 4,              // 叶片大小
    bladeLength: 8,            // 叶片长度
    bladeRadiusRatio: 0.55,    // 叶片半径比例
    centerSize: 4,             // 中心圆大小
    // 激活
    activationScreenShake: 4,  // 激活屏幕震动
    activationTextYRatio: 0.3, // 激活文字Y比例
    activationTextYOffset: 20, // 激活文字第二行Y偏移
  },

  // ===== 暂停菜单 =====
  pause: {
    title: '游戏暂停',
    resume: '继续游戏',
    resumeDesc: '返回战斗',
    restart: '重新开始',
    restartDesc: '重新挑战本关',
    quit: '返回主菜单',
    quitDesc: '保存进度并退出',
    tagline: '烈焰除蟑 · 火线守卫',
  },

  // ===== 道具揭示 =====
  itemReveal: {
    newUnlock: '战斗胜利！解锁新道具',
    zhangshuSays: '蟑叔说：',
    clickToClose: '点击任意处关闭',
  },

  // ===== 道具回收 =====
  itemRecycle: {
    title: '道具回收',
  },

  // ===== 场景选择 =====
  sceneSelect: {
    title: '场景选择',
    unlocked: '已解锁',
    rewardMultiplier: '奖励',
    unlockCondition: '通关',
    enemyStrength: '敌人强度',
    rewardRate: '奖励倍率',
    weather: '天气',
    weatherNone: '无',
    weatherRain: '雨',
    weatherFog: '雾',
    weatherNight: '夜间',
  },

  // ===== 道具准备 =====
  preparation: {
    title: '道具选择',
    selectHint: '选择',
    battle: '开始战斗',
    categories: {
      control: '控制',
      aoe: '范围',
      burst: '爆发',
    },
  },

  // ===== 天赋树 =====
  talentTree: {
    title: '天赋树',
    talentPoints: '天赋点',
    skipTutorial: '跳过引导',
    nextStep: '下一步',
    doneTutorial: '知道了，开始加点',
    zhangshu: '蟑叔',
    currentLevel: '当前等级',
    upgradeCost: '升级消耗',
    maxed: '已满级',
    upgrade: '升级天赋',
    insufficient: '天赋点不足',
    categories: {
      combat: '战斗强化',
      survival: '生存强化',
      utility: '辅助强化',
      item: '道具专精',
    },
    tutorialSteps: [
      '这是「火焰伤害」，提升你的火焰喷射伤害！每级+10%伤害，最多5级。对付大蟑螂特别有效！',
      '这是「火焰范围」，增加喷射距离！每级+15%范围，最多5级。烧得更远更安全！',
      '这是「气罐容量」，增加燃料上限！每级+20%容量，最多5级。少换气罐多烧一会儿！',
      '这是「过热抗性」，提升过热上限！每级+15%阈值，最多5级。连续喷射不容易熄火！',
      '这是「冷却速度」，加快散热速度！每级+20%冷却，最多5级。熄火后更快恢复开火！',
      '这是「防线生命」，增加防线血量！每级+15%血量，最多5级。防线更坚挺，蟑螂更难突破！',
    ],
  },

  // ===== 浮动文字系统 =====
  floatingText: {
    maxCount: 20,              // 最大浮动文字数量
    defaultDurationMs: 1000,   // 默认持续时间（毫秒）
    defaultFontSize: 16,       // 默认字体大小
    defaultRiseSpeed: -35,     // 默认上升速度（像素/秒，负值=向上）
    msToSeconds: 0.001,        // 毫秒转秒系数
  },

  // ===== 经济系统 =====
  economy: {
    initialMoney: { easy: 200, normal: 150, hard: 100 }, // 初始金钱
    talentCostScaling: 1.5,    // 天赋升级成本递增系数（每级 ×1.5）
    hardModeRewardPenalty: 0.8, // 困难模式奖励惩罚
  },

  // ===== 渲染系统 =====
  render: {
    // 背景渲染
    background: {
      bgImageAlpha: 0.8,         // 背景图透明度
      tileSize: 48,              // 瓦片大小
      // 夜晚叠加
      nightBaseAlpha: 0.4,       // 夜晚基础透明度
      nightFlashAlpha: 0.2,      // 闪电额外透明度
      nightColor: 'rgba(0, 0, 20, {alpha})', // 夜晚颜色模板
      // 暗角
      vignetteInnerRadius: 0.4,  // 暗角内半径（相对高度）
      vignetteOuterRadius: 0.8,  // 暗角外半径（相对高度）
      vignetteInnerColor: 'rgba(0,0,0,0)',
      vignetteOuterColor: 'rgba(0,0,0,0.5)',
    },
    // 火焰区域渲染
    fireZone: {
      segments: 20,              // 火焰段数（从50降至20，减少渐变创建）
      rangeRatio: 0.5,           // 火焰射程比例
      baseWidth: 32,             // 基础宽度
      widthTaper: 0.94,          // 宽度锥化系数
      wiggleFreq: 6,             // 摆动频率（π的倍数）
      wiggleTimeScale: 30,       // 摆动时间缩放
      wiggleAmplitude: 5,        // 摆动幅度
      // 侧枪
      sideGunScale: 0.6,         // 侧枪火焰缩放
      sideGunNozzleOffset: 50,   // 侧枪喷嘴偏移
      // 核心光晕
      coreGlowSize: 36,          // 核心光晕大小
      coreColorDefault: '160, 210, 255',
      coreColorSticky: '250, 200, 50',
      coreColorPoison: '200, 160, 255',
      // Power Boost 波纹
      boostAlphaMax: 0.25,       // 最大波纹透明度
      boostAlphaFade: 0.5,       // 波纹透明度衰减
      boostRippleCount: 3,       // 波纹数量
      boostRippleFreq: 4,        // 波纹频率
      boostRippleSpacing: 2.1,   // 波纹间距
      boostRippleMaxPhase: 3,    // 波纹最大相位
      boostRippleRadiusBase: 30, // 波纹基础半径
      boostRippleRadiusGrowth: 25, // 波纹半径增长
      boostRippleLineWidth: 1.5, // 波纹线宽
    },
    // 掉落物渲染
    drop: {
      // 粘性弹丸
      sticky: {
        glowSizeMultiplier: 2,        // 辉光大小倍率
        glowAlpha: 0.3,              // 辉光透明度
        glowInnerColor: 'rgba(250, 220, 50, {alpha})',
        glowOuterColor: 'rgba(250, 200, 50, 0)',
        pulseBase: 0.8,              // 脉冲基础值
        pulseAmplitude: 0.2,         // 脉冲振幅
        bodyAlpha: 0.85,             // 主体透明度
        bodyColor: 'rgba(250, 220, 50, {alpha})',
        highlightAlpha: 0.6,         // 高光透明度
        highlightColor: 'rgba(255, 250, 200, {alpha})',
        highlightSizeRatio: 0.35,    // 高光大小比例
        highlightOffsetRatio: 0.25,  // 高光偏移比例
        trailLength: 3,              // 拖尾长度
        trailAlphaBase: 0.3,         // 拖尾基础透明度
        trailSizeDecay: 0.2,         // 拖尾大小衰减
        trailColor: 'rgba(250, 220, 50, {alpha})',
        fixedTrailStep: 0.016,       // 固定时间步长 (~60fps)
        // 附着滴落效果
        dripCount: 3,
        dripLengthBase: 6,
        dripLengthAmplitude: 3,
        dripAngleSpacing: Math.PI * 2 / 3,
        dripTimeScale: 8,
        attachedAlphaBase: 0.4,
        attachedAlphaAmplitude: 0.2,
        attachedLineWidth: 2,
        attachedBaseRadius: 8,
        attachedStrokeColor: 'rgba(250, 220, 50, {alpha})',
      },
      // 武器掉落物
      weapon: {
        baseSize: 32,
        bobYAmplitude: 10,
        bobXAmplitude: 6,
        bobXTimeScale: 0.6,
        breatheBase: 1,
        breatheAmplitude: 0.08,
        breatheTimeScale: 2,
        tiltAmplitude: 0.15,
        tiltTimeScale: 1.5,
        labelFont: 'bold 9px sans-serif',
        labelOffsetY: -22,
        labelShadowBlur: 3,
        labelShadowColor: 'rgba(0,0,0,0.8)',
        haloAlpha: 0.6,
        haloLineWidth: 2,
        glowSize: 25,
        glowAlpha: 0.4,
        fallbackSize: 24,
        fallbackLineWidth: 1.5,
        fallbackStrokeColor: '#fff',
      },
      // 战场掉落道具箱
      item: {
        size: 48,
        bobYAmplitude: 12,
        glowPulseBase: 0.5,
        glowPulseAmplitude: 0.5,
        glowInnerRadiusRatio: 0.3,
        glowOuterRadiusRatio: 2,
        glowColor1: 'rgba(251, 191, 36, {alpha})',
        glowColor2: 'rgba(245, 158, 11, {alpha})',
        outerRingBaseSizeRatio: 0.8,
        outerRingAmplitudeRatio: 0.2,
        outerRingAlphaBase: 0.6,
        outerRingAlphaAmplitude: 0.4,
        outerRingLineWidth: 2,
        outerRingColor: 'rgba(251, 191, 36, {alpha})',
        innerRingSizeRatio: 0.6,
        innerRingDecayRatio: 0.1,
        innerRingAlphaBase: 0.4,
        innerRingAlphaAmplitude: 0.3,
        innerRingAngleLength: Math.PI * 1.5,
        innerRingLineWidth: 1.5,
        innerRingColor: 'rgba(252, 211, 77, {alpha})',
      },
    },
    // 护士治疗特效
    nurseHealVFX: {
      healRange: 360,              // 治疗范围
      footYOffset: 12,             // 脚部Y偏移
      // 蓄力阶段 (charging)
      charge: {
        ringScaleRatio: 0.9,       // 外环缩放比例
        ringYScaleRatio: 0.32,     // 外环Y缩放比例
        glowAlphaBase: 0.15,       // 辉光基础透明度
        glowAlphaRange: 0.35,      // 辉光透明度范围
        ringAlphaMultiplier: 0.7,  // 环透明度倍率
        ringLineWidth: 2,          // 环线宽
        fillAlpha: 0.1,            // 内部填充透明度
        dotPulseFreq: 8,           // 中心点脉冲频率
        dotPulseAmp: 0.3,          // 中心点脉冲振幅
        dotAlpha: 0.6,             // 中心点透明度
        dotBaseSize: 4,            // 中心点基础大小
        ecgAlpha: 0.5,             // ECG线透明度
        ecgLineWidth: 1.5,         // ECG线宽
        ecgRange: 60,              // ECG线范围
        ecgStep: 2,                // ECG线步进
        ecgBaseY: 20,              // ECG线基础Y偏移
        ecgFreq: 12,               // ECG线频率
        ecgWaveFreq: 0.3,          // ECG线波形频率
      },
      // 喷射阶段 (spraying)
      spray: {
        mistDirs: [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75] as readonly number[],
        blobCount: 3,              // 每方向雾团数量
        blobDistRatio: 0.35,       // 雾团距离比例
        blobAngleWobble: 0.15,     // 雾团角度摆动
        blobYScale: 0.5,           // 雾团Y缩放
        blobBaseSize: 25,          // 雾团基础大小
        blobSizeIncrement: 12,     // 雾团大小增量
        blobSizeFade: 0.3,         // 雾团大小衰减
        blobAlphaBase: 0.25,       // 雾团基础透明度
        blobAlphaFade: 0.5,        // 雾团透明度衰减
        blobAlphaStepDecay: 0.15,  // 雾团透明度步进衰减
        blobVertexStep: 0.5,       // 雾团顶点步进（弧度，越小越精细）
        blobRadiusBase: 0.7,       // 雾团半径基础
        blobRadiusAmp: 0.3,        // 雾团半径振幅
        blobYScaleRatio: 0.6,      // 雾团Y缩放比例
        ringPulseFreq: 4,          // 环脉冲频率
        ringPulseAmp: 0.06,        // 环脉冲振幅
        ringAlpha: 0.5,            // 环透明度
        ringStrokeWidth: 2.5,      // 环线宽
        ringFillAlpha: 0.12,       // 环填充透明度
        ringInnerAlpha: 0.4,       // 内环透明度
        ringInnerWidth: 1.5,       // 内环线宽
        ringInnerDash: [8, 10] as readonly number[], // 内环虚线
        tickCount: 12,             // 刻度数量
        tickRotSpeed: 1.8,         // 刻度旋转速度
        tickBaseLen: 5,            // 刻度基础长度
        tickLongExtra: 4,          // 长刻度额外长度
        tickAlpha: 0.7,            // 刻度透明度
        tickWidthNormal: 1.5,      // 普通刻度线宽
        tickWidthLong: 2.5,        // 长刻度线宽
        crosshairAlpha: 0.25,      // 十字线透明度
        crosshairWidth: 1,         // 十字线宽
      },
      // 消散阶段 (dissipating)
      dissipate: {
        ringAlpha: 0.5,            // 环透明度
        ringWidth: 2,              // 环线宽
        glowInnerAlpha: 0.08,      // 辉光内部透明度
        dotAlpha: 0.4,             // 中心点透明度
        dotBaseSize: 3,            // 中心点基础大小
      },
    },
    // 蟑螂渲染
    roach: {
      bossScale: 6,                // Boss 渲染缩放
      bodyWidthRatio: 1.2,         // 身体宽度比例（size * ratio = 实际宽度）
      mutantTransformScale: 1.3,   // 变异蟑螂变形渲染缩放
      // 死亡淡出
      flyingDeathFadeDuration: 2.0,   // 飞行蟑螂死亡淡出持续时间
      normalDeathFadeDuration: 0.6,   // 普通蟑螂死亡淡出持续时间
      deadSizeLarge: 16,              // 大蟑螂死亡圆半径
      deadSizeSmall: 10,              // 小蟑螂死亡圆半径
      // 身体摆动
      sizeWobbleBase: 0.9,            // 身体大小摆动基础值
      sizeWobbleAmp: 0.1,             // 身体大小摆动振幅
      // 护盾效果
      shield: {
        normalColor: '100, 200, 255',     // 普通护盾颜色 (RGB)
        timedSuicideColor: '255, 165, 0', // 定时自爆护盾颜色 (RGB)
        normalPulseBase: 0.3,             // 普通护盾脉冲基础透明度
        normalLineWidth: 2,               // 普通护盾线宽
        normalShadowBlur: 10,             // 普通护盾阴影模糊
        normalShadowAlphaRatio: 0.5,      // 普通护盾阴影透明度比例
        normalRadiusRatio: 0.65,          // 普通护盾半径比例
        normalGlowAlphaRatio: 0.1,        // 普通护盾辉光透明度比例
        timedSuicidePulseBase: 0.35,      // 定时自爆护盾脉冲基础透明度
        timedSuicideLineWidth: 2.5,       // 定时自爆护盾线宽
        timedSuicideShadowBlur: 12,       // 定时自爆护盾阴影模糊
        timedSuicideShadowAlphaRatio: 0.6, // 定时自爆护盾阴影透明度比例
        timedSuicideRadiusRatio: 0.7,     // 定时自爆护盾半径比例
        timedSuicideGlowAlphaRatio: 0.12, // 定时自爆护盾辉光透明度比例
      },
    },
    // 通用渲染工具
    renderUtils: {
      // 枪口闪光
      muzzleFlash: {
        sideGunScale: 0.6,
        boostColors: ['255, 100, 20', '255, 180, 50', '255, 60, 0', '255, 140, 40'] as readonly string[],
        boostParticleCount: 4,
        boostSprayDistMin: 15,
        boostSprayDistMax: 50,
        boostSprayYScale: 0.6,
        boostSprayYRandom: 10,
        boostParticleSizeBase: 2,
        boostParticleSizeRange: 3.5,
        boostAlphaBase: 0.6,
        boostAlphaRange: 0.4,
        boostGlowSizeMultiplier: 2,
        boostGlowAlphaRatio: 0.3,
        boostAlphaFadeTime: 0.5,
      },
      // 雷达激光
      radarLaser: {
        fadeInDuration: 0.5,
        baseAlpha: 0.6,
        pulseFreq: 20,
        pulseAmp: 0.2,
        outerGlowAlpha: 0.3,
        outerGlowWidth: 12,
        midGlowAlpha: 0.6,
        midGlowWidth: 6,
        coreWidth: 2,
        colorBody: '34, 211, 238',
        colorBright: '103, 232, 249',
        lockPulseFreq: 8,
        lockPulseBase: 0.5,
        lockPulseAmp: 0.5,
        lockRingRadius: 20,
        lockRingAmp: 8,
        lockRingWidth: 2,
        lockFillRadius: 15,
        lockFillAlpha: 0.3,
        emitterRadius: 10,
        emitterAlpha: 0.4,
      },
      // 电蚊拍
      swatter: {
        animDuration: 0.6,
        startYRatio: -0.3,
        endYRatio: 0.8,
        headWRatio: 0.7,
        headHRatio: 0.15,
        gridCols: 8,
        gridRows: 3,
        handleLengthRatio: 0.4,
        handleWidth: 6,
        arcAlphaPeak: 0.9,
        arcPhaseStart: 0.3,
        arcPhaseEnd: 0.8,
        arcCount: 12,
        arcSegments: 4,
        arcWidth: 30,
        arcHeight: 8,
        arcFillAlpha: 0.15,
        stunStarChance: 0.3,
        stunStarSize: { large: 22, small: 14 },
        stunStarAlphaBase: 0.5,
        stunStarAlphaRange: 0.5,
        outerGlowAlpha: 0.4,
        outerGlowColor: '250, 200, 50',
        outerGlowColor2: '50, 100, 200',
        outerGlowFalloff: 0.6,
        rectStroke: '180, 220, 255',
        rectStrokeAlpha: 0.8,
        rectStrokeDecay: 0.5,
        gridStroke: '120, 180, 255',
        gridStrokeAlpha: 0.5,
        handleStroke: '150, 150, 150',
        handleStrokeAlpha: 0.9,
        arcStroke: '200, 240, 255',
        arcGlowColor: '250, 200, 50',
        arcGlowBlur: 15,
        arcFill: '200, 240, 255',
        stunStar: '150, 220, 255',
      },
      // 杀虫剂喷雾
      insecticide: {
        range: 280,
        pulseBaseAlpha: 0.12,
        pulseAmpAlpha: 0.08,
        pulseFreq: 12,
        boundaryAlpha: 0.2,
        boundaryStroke: 'rgba(100, 255, 120, 0.4)',
        boundaryWidth: 2,
        centerAlpha: 0.3,
        centerStroke: 'rgba(150, 255, 160, 0.5)',
        centerWidth: 1.5,
        centerDash: [5, 5] as readonly number[],
        nozzleGlowAlpha: 0.4,
        nozzleRadius: 20,
        timerOffsetY: -40,
      },
      // 道具放置预览
      itemPlacement: {
        fillAlpha: 0.12,
        ringAlphaBase: 0.5,
        ringAlphaAmp: 0.3,
        ringWidth: 3,
        ringDashBase: 10,
        ringDashAmp: 6,
        ringDashGap: 8,
        ringDashSpeed: 40,
        innerRingAlpha: 0.6,
        innerRingWidth: 1.5,
        innerRingScale: 0.5,
        dirLineAlpha: 0.35,
        dirLineWidth: 1,
        crosshairWidth: 2.5,
        crosshairMaxLen: 14,
        crosshairMinLen: 4,
        crosshairScaleX: 0.3,
        crosshairScaleY: 0.3,
        crosshairShadowBlur: 8,
        centerDotRadius: 5,
        centerDotShadowBlur: 12,
        labelBgHeight: 44,
        labelBgRadius: 8,
        labelBgAlpha: 0.65,
        labelYOffset: 42,
        labelFont: 'bold 14px sans-serif',
        labelFont2: 'bold 11px sans-serif',
        typeColors: {
          sticky: '250, 200, 50',
          poison: '180, 130, 255',
          molotov: '255, 100, 80',
          shotgun: '255, 200, 100',
        } as Record<string, string>,
        defaultColor: '255, 255, 255',
      },
      // 防线渲染
      defenseLine: {
        lineWidth: 3,
        dash: [12, 8] as readonly number[],
        dashSpeed: 30,
        fillAlpha: 0.08,
        fillHeight: 25,
        labelFont: 'bold 13px sans-serif',
        labelAlpha: 0.25,
        labelOffsetY: -8,
        // 护盾
        shieldYOffset: 20,
        shieldAlphaBase: 0.4,
        shieldAlphaAmp: 0.2,
        shieldAlphaFreq: 6,
        shieldGlowColor: 'rgba(6, 182, 212, 0.8)',
        shieldGlowBase: 12,
        shieldGlowAmp: 4,
        shieldGlowFreq: 4,
        shieldLineWidth: 4,
        shieldCoreWidth: 1.5,
        shieldCoreAlphaRatio: 0.6,
        shieldColor: '6, 182, 212',
        shieldCoreColor: '165, 243, 252',
      },
      // 投掷物渲染
      throwable: {
        trailFactor1: 0.03,        // 拖尾第一层时间因子
        trailFactor2: 0.06,        // 拖尾第二层时间因子
        glowRadius: 15,            // 发光半径
        bottleRadius: 5,           // 瓶身半径
        trailRadius1: 3,           // 拖尾第一层半径
        trailRadius2: 2,           // 拖尾第二层半径
        trailAlpha1: 0.4,          // 拖尾第一层透明度
        trailAlpha2: 0.2,          // 拖尾第二层透明度
      },
      // 移动范围
      movementRange: {
        fillAlpha: 0.06,
        fillColor: 'rgba(0, 255, 100, 0.06)',
        sideStroke: 'rgba(0, 255, 80, 0.8)',
        sideWidth: 3,
        farStroke: 'rgba(0, 255, 80, 0.5)',
        farWidth: 2,
        nearStroke: 'rgba(0, 255, 80, 0.9)',
        nearWidth: 2,
        defLineStroke: 'rgba(0, 255, 80, 0.4)',
        defLineWidth: 1.5,
        defLineDash: [6, 4] as readonly number[],
        cornerRadius: 6,
        cornerStroke: 'rgba(255, 255, 255, 0.8)',
        cornerStrokeWidth: 2,
        cornerFill: 'rgba(0, 255, 80, 1)',
        pillBg: 'rgba(0, 0, 0, 0.7)',
        pillRadius: 4,
        pillHeight: 16,
        pillOffsetX: 10,
        pillOffsetY: 3,
        textColor: 'rgba(255, 255, 0, 1)',
        textFont: 'bold 12px monospace',
        labelColor: 'rgba(0, 255, 80, 0.7)',
        labelOffsetY: -14,
      },
    },
  },
} as const;