/**
 * @fileoverview 渲染/粒子/效果数值平衡参数
 * @description 从 render.ts 拆分而来，包含屏幕震动、粒子生成器、浮动文字、渲染系统等平衡参数。
 * 通过 balance.ts 合并到 BALANCE_CONFIG 中对外暴露。
 * 所有数值单位为像素（px）或秒（s），除非另有说明。
 */

export const BALANCE_RENDER = {
  // ===== 屏幕震动 =====
  // 不同事件触发的屏幕震动强度（像素偏移量）
  screenShake: {
    weaponHit: 2,        // 武器命中震动
    smallExplosion: 3,   // 小型爆炸
    mediumExplosion: 5,  // 中型爆炸
    largeExplosion: 6,   // 大型爆炸
    biggerExplosion: 8,  // 更大爆炸
    breach: 10,          // 防线突破
    bossDeath: 12,       // Boss 死亡
    swatter: 12,         // 电蚊拍全屏攻击
    bigBossDeath: 20,    // 大型 Boss 死亡
    massiveExplosion: 22,// 大规模爆炸
    queenDeath: 28,      // 蟑螂女王死亡（最大震动）
    decayThreshold: 0.5, // 震动衰减阈值（低于此值停止震动）
  },

  // ===== 性能 =====
  // 粒子数量限制，根据设备性能等级分级
  performance: {
    particleLimit: { low: 150, medium: 200, high: 250, desktop: 400 },
  },

  // ===== 闪电天气（夜晚场景通用） =====
  lightning: {
    timerMin: 5,          // 闪电最小间隔（秒）
    timerRandMax: 10,     // 闪电随机间隔上限（秒）
    flashDuration: 0.3,   // 闪光持续时间（秒）
    chance: 0.3,          // 每次计时器触发时闪电出现的概率（30%）
    textCooldown: 3,      // 闪电文字提示冷却时间（秒）
  },

  // ===== 天气系统（雨/雾/夜晚粒子效果） =====
  weather: {
    rain: {
      spawnRate: 0.4,                  // 雨的生成速率（每帧概率）
      vxMin: -20, vxRange: 10,        // 水平速度范围（像素/秒）
      vyMin: 200, vyRange: 100,       // 垂直速度范围（像素/秒）
      life: 2,                         // 雨滴存活时间（秒）
      sizeMin: 1, sizeRange: 1,       // 雨滴大小范围（像素）
      color: 'rgba(150, 180, 220, 0.4)', // 雨滴颜色
    },
    fog: {
      spawnRate: 0.05,                 // 雾的生成速率（每帧概率）
      vxMin: 10, vxRange: 10,         // 水平速度范围（像素/秒）
      vyMin: -5, vyRange: 10,         // 垂直速度范围（像素/秒）
      lifeMin: 8, lifeRange: 4,       // 雾存活时间范围（秒）
      sizeMin: 30, sizeRange: 50,     // 雾团大小范围（像素）
      colorBase: '180, 180, 160',     // 雾颜色 RGB 基值
      alphaMin: 0.05, alphaRange: 0.05, // 雾透明度范围
      growthRate: 1.005,              // 雾团增长速率（每帧乘数）
    },
  },

  // ===== 粒子生成器 =====
  // 所有战斗特效粒子（火焰、烟雾、灰烬、血液、火花等）的生成参数
  particle: {
    // 护盾蟑螂气体光环粒子（悬浮在护盾蟑螂下方，营造能量场氛围）
    shieldAura: {
      countPerFrame: 3,                       // 每帧生成粒子数（增多粒子，原 1）
      lifeMin: 0.4, lifeMax: 0.7,             // 粒子存活时间（秒）
      sizeMin: 2, sizeMax: 4.5,               // 粒子大小（像素，增大，原 1.5~3.5）
      radiusMin: 0.6, radiusMax: 0.95,        // 散布半径系数（× shieldRectHalfWidth）
      pulseFreqBase: 2, pulseFreqVar: 3,      // 脉冲频率（基础 + 随机）
      phaseOffset: 6.2832,                    // 相位偏移（2π）
      hue: 185, saturation: 90,               // HSL 色相/饱和度（青色）
      lightnessMin: 65, lightnessMax: 92,     // HSL 亮度范围（增亮，原 60~85）
      alphaMin: 0.5, alphaMax: 0.95,          // 透明度范围（增亮，原 0.3~0.7）
    },
    // 隧道工护甲喷涂粒子（灰色喷射流 + 目标头顶 + 号）
    armorSpray: {
      // 喷射流粒子（隧道工 → 目标方向）
      streamCount: 20,                        // 喷射流粒子数量（增多，原 12）
      streamLifeMin: 0.25, streamLifeMax: 0.4, // 喷射流存活时间（秒）
      streamSizeMin: 2, streamSizeMax: 4,      // 喷射流粒子大小
      streamSpeedMin: 120, streamSpeedMax: 200, // 喷射流速度
      streamSpread: 0.5,                       // 喷射扩散角度（弧度）
      streamColor: { rMin: 148, rMax: 163, gMin: 163, gMax: 184, bMin: 184, bMax: 184, aMin: 0.6, aMax: 0.9 }, // 灰蓝色
      // +号粒子（目标头顶）
      plusLife: 0.8,                          // +号存活时间（秒）
      plusSize: 8,                            // +号大小（像素）
      plusVy: -30,                            // +号上升速度
      plusColor: 'rgba(203, 213, 225, 1)',    // +号颜色（浅灰白）
    },
    // 护盾修复粒子（隧道工修理护盾蟑螂时产生的青色火花）
    shieldRepair: {
      spawnChance: 0.9,                       // 每帧生成概率（0~1，增多粒子，原 0.6）
      lifeMin: 0.4, lifeMax: 0.6,             // 粒子存活时间（秒）
      sizeMin: 3, sizeMax: 6,                 // 粒子大小（像素）
      speedMin: 10, speedMax: 30,             // 上升速度范围（像素/秒）
      color: 'rgba(103, 232, 249, 0.8)',      // 青色（与护盾颜色一致）
    },
    // 锥形火焰喷射粒子
    coneFire: {
      countMin: 3, countMax: 3,     // 每帧生成的粒子数
      lifeMin: 0.06, lifeMax: 0.08, // 粒子存活时间（秒）
      flowSpeedMin: 100, flowSpeedMax: 60, // 流速范围（像素/秒）
      fireSizeMin: 2, fireSizeMax: 5,     // 火焰粒子大小（像素）
      emberSizeMin: 1, emberSizeMax: 3,   // 余烬粒子大小（像素）
      sparkSizeMin: 2, sparkSizeMax: 3,   // 火花粒子大小（像素）
      angleSpread: 0.5,             // 火焰锥角扩散（弧度）
      muzzleSpark: {                 // 枪口火花粒子
        vxRange: 60,
        vyMin: -100, vyMax: -60,
        life: 0.08,
        color: '#fff',
      },
      fireColor:   { r: 255, gMin: 100, gMax: 180, bMin: 0, bMax: 40, aMin: 0.7, aMax: 1.0 },
      emberColor:  { r: 255, gMin: 200, gMax: 255, bMin: 50, bMax: 100, aMin: 0.5, aMax: 1.0 },
      iceColor:    { rMin: 180, rMax: 220, gMin: 220, gMax: 240, b: 255, aMin: 0.5, aMax: 1.0 }, // 冷冻模式粒子颜色
      poisonColor: { rMin: 100, rMax: 140, gMin: 220, gMax: 250, bMin: 100, bMax: 140, aMin: 0.4, aMax: 0.8 }, // 毒气模式粒子颜色
    },
    // 烟雾粒子（蟑螂死亡时产生）
    smoke: {
      offsetX: 30, offsetY: 30,          // 生成偏移（像素）
      vxRange: 40, vyBase: -30, vyRange: 50, // 速度范围（像素/秒）
      lifeMin: 1, lifeMax: 2,            // 存活时间（秒）
      sizeMin: 6, sizeMax: 16,           // 烟雾大小（像素）
      hue: 0, saturation: 0, lightnessMin: 35, lightnessMax: 35, // HSL 颜色（灰色）
    },
    // 灰烬粒子（蟑螂烧死后产生）
    ash: {
      speedMin: 30, speedMax: 80, vyBias: -40, // 速度范围，偏向上飘
      lifeMin: 0.6, lifeMax: 1.0,             // 存活时间（秒）
      sizeMin: 2, sizeMax: 6,                  // 灰烬大小（像素）
      hue: 0, saturation: 0, lightnessMin: 5, lightnessMax: 20, // 灰黑色
    },
    // 血液粒子（蟑螂被击中时溅出）
    blood: {
      speedMin: 80, speedMax: 200, vyBias: 40, // 速度范围（像素/秒）
      life: 0.5,                               // 存活时间（秒）
      sizeMin: 4, sizeMax: 10,                 // 血滴大小（像素）
      rMin: 20, rMax: 40, gMin: 120, gMax: 60, bMin: 20, bMax: 40, alphaMin: 0.5, alphaMax: 0.5, // 暗绿色
    },
    // 火花粒子（金属碰撞/爆炸产生）
    spark: {
      speedMin: 60, speedMax: 120,             // 速度范围（像素/秒）
      lifeMin: 0.2, lifeMax: 0.4,              // 存活时间（秒）
      sizeMin: 1, sizeMax: 3,                  // 火花大小（像素）
      hueMin: 30, hueMax: 30, saturation: 100, lightness: 75, // 橙黄色
    },
    // 爆炸粒子（燃烧瓶/自爆等爆炸）
    explosion: {
      speedMin: 50, speedMax: 150, vyBias: -30, // 速度范围（像素/秒）
      lifeMin: 0.3, lifeMax: 0.5,               // 存活时间（秒）
      sizeMin: 3, sizeMax: 12,                  // 粒子大小（像素）
      hueMin: 10, hueMax: 30, saturation: 100, lightnessMin: 50, lightnessMax: 25, // 橙红到黄色
    },
    // 碎片粒子（装甲蟑螂破甲时产生）
    debris: {
      speedMin: 40, speedMax: 120, vyBias: -50, offsetXY: 10, // 速度范围，偏向上飞
      lifeMin: 3, lifeMax: 2,                // 存活时间（秒）
      sizeMin: 4, sizeMax: 10,               // 碎片大小（像素）
      hueMin: 15, hueMax: 20, saturation: 80, lightnessMin: 30, lightnessMax: 20, // 暗棕色
    },
    // 火环粒子（爆炸冲击波扩散）
    fireRing: {
      speedMin: 60, speedMax: 80, vyBias: -20, // 速度范围（像素/秒）
      lifeMin: 1.5, lifeMax: 1.5,              // 存活时间（秒）
      sizeMin: 8, sizeMax: 16,                 // 火环粒子大小（像素）
      hueMin: 10, hueMax: 25, saturation: 100, lightness: 55, // 橙红色
    },
    // 冲击波粒子（大型爆炸的冲击波效果）
    shockwave: {
      outerSpeedMin: 150, outerSpeedMax: 200,      // 外层冲击波速度（像素/秒）
      outerLifeMin: 0.8, outerLifeMax: 0.4,        // 外层存活时间（秒）
      outerSizeMin: 12, outerSizeMax: 20,           // 外层粒子大小（像素）
      innerCount: 10, innerSpeedMin: 80, innerSpeedMax: 150, // 内层粒子数量与速度
      innerLifeMin: 0.5, innerLifeMax: 0.3,         // 内层存活时间（秒）
      innerSizeMin: 6, innerSizeMax: 12,            // 内层粒子大小（像素）
      outerColor: { r: 255, gMin: 200, gMax: 255, bMin: 100, bMax: 150, a: 0.9 },
      innerColor: { r: 255, g: 255, b: 255, a: 0.95 },
    },
    // 闪电粒子（闪电天气特效）
    lightning: {
      topCount: 20, topWidthRatio: 0.8, topYRange: 50, // 顶部闪电参数
      topVxRange: 60, topVyMin: 100, topVyMax: 200,    // 顶部粒子速度
      topLifeMin: 0.4, topLifeMax: 0.4,                // 顶部粒子存活时间
      topSizeMin: 3, topSizeMax: 6,                     // 顶部粒子大小
      fullCount: 30, fullVxRange: 100, fullVyRange: 100, // 全屏闪电参数
      fullLifeMin: 0.2, fullLifeMax: 0.3,               // 全屏粒子存活时间
      fullSizeMin: 2, fullSizeMax: 4,                    // 全屏粒子大小
      topColor: { r: 150, g: 220, b: 255, aMin: 0.6, aMax: 1.0 },
      fullColor: { r: 200, g: 240, b: 255, aMin: 0.5, aMax: 1.0 },
    },
    // 粒子物理参数（运动衰减、重力、生长等）
    physics: {
      fire:   { vyDecay: 25, sizeDecay: 0.97 },         // 火焰：垂直速度衰减 / 大小衰减
      smoke:  { vxDecay: 0.92, sizeGrowth: 1.015 },     // 烟雾：水平速度衰减 / 大小增长
      blood:  { vyGravity: 100, vxDecay: 0.95, defenseLineOffset: 5 }, // 血液：重力 / 速度衰减
      ice:    { vyGravity: 20, sizeDecay: 0.98 },       // 冰晶：重力 / 大小衰减
      poisonCloud: { vxRandom: 10, vyDecay: 5, sizeGrowth: 1.01 }, // 毒雾：随机水平速度 / 垂直衰减 / 增长
      explosion: { vyGravity: 40, sizeDecay: 0.94 },    // 爆炸：重力 / 大小衰减
      ash:    { vyGravity: 120, vxDecay: 0.97, sizeDecay: 0.985, defenseLineOffset: 2, bounceVx: 0.8 }, // 灰烬：重力 / 衰减 / 反弹
      lightning: { lifeMultiplier: 2 },                   // 闪电粒子存活时间倍率
    },
    floatingText: {
      defaultVy: -30,    // 默认浮动文字上升速度（像素/秒）
      defaultLife: 2.0,  // 默认浮动文字存活时间（秒）
    },
    explosionParticle: {
      intensityMultiplier: 3,  // 爆炸强度倍率
      maxCount: 100,           // 单次爆炸最大粒子数
      speedMin: 50, speedMax: 200,  // 粒子速度范围（像素/秒）
      lifeMin: 0.5, lifeMax: 1.5,   // 粒子存活时间（秒）
      sizeMin: 2, sizeMax: 8,       // 粒子大小（像素）
    },
  },

  // ===== 浮动文字系统 =====
  // 战斗伤害/效果文字的显示参数
  floatingText: {
    maxCount: 20,            // 同时显示的浮动文字最大数量
    defaultDurationMs: 1000, // 默认显示时长（毫秒）
    defaultFontSize: 16,     // 默认字体大小（像素）
    defaultRiseSpeed: -35,   // 默认上升速度（像素/秒，负值表示向上）
    msToSeconds: 0.001,      // 毫秒转秒的转换系数
  },

  // ===== 渲染系统 =====
  render: {
    // 背景渲染参数
    background: {
      bgImageAlpha: 0.8,     // 背景图片透明度
      tileSize: 48,          // 背景瓷砖大小（像素）
      nightBaseAlpha: 0.4,   // 夜晚场景基础暗度
      nightFlashAlpha: 0.2,  // 闪电时夜晚暗度
      nightColor: 'rgba(0, 0, 20, {alpha})', // 夜晚遮罩颜色
      vignetteInnerRadius: 0.4,  // 暗角内半径（相对屏幕比例）
      vignetteOuterRadius: 0.8,  // 暗角外半径（相对屏幕比例）
      vignetteInnerColor: 'rgba(0,0,0,0)',     // 暗角内部颜色（透明）
      vignetteOuterColor: 'rgba(0,0,0,0.5)',   // 暗角外部颜色（半透明黑）
    },
    // 火焰区域渲染（喷火枪的火焰锥形效果）
    fireZone: {
      segments: 20,            // 火焰形状分段数（越多越平滑）
      rangeRatio: 1,         // 火焰范围占射程的比例
      baseWidth: 25,           // 火焰基础宽度（像素）
      widthTaper: 0.94,        // 火焰宽度锥形收缩率
      wiggleFreq: 6,           // 火焰摆动频率
      wiggleTimeScale: 30,     // 火焰摆动时间缩放
      wiggleAmplitude: 5,      // 火焰摆动幅度（像素）
      sideGunScale: 0.6,       // 侧火焰缩放
      sideGunNozzleOffset: 50, // 侧火焰喷嘴偏移（像素）
      coreGlowSize: 36,        // 核心发光大小（像素）
      coreColorDefault: '160, 210, 255',   // 默认火焰核心颜色（浅蓝白）
      coreColorSticky: '250, 200, 50',     // 粘板模式核心颜色（金色）
      coreColorPoison: '200, 160, 255',    // 毒气模式核心颜色（紫色）
      boostAlphaMax: 0.25,     // 强化模式下最大透明度
      boostAlphaFade: 0.5,     // 强化模式透明度衰减率
      boostRippleCount: 3,     // 强化波纹数量
      boostRippleFreq: 4,      // 强化波纹频率
      boostRippleSpacing: 2.1, // 强化波纹间距
      boostRippleMaxPhase: 3,  // 强化波纹最大相位
      boostRippleRadiusBase: 30,    // 强化波纹基础半径
      boostRippleRadiusGrowth: 25,  // 强化波纹半径增长
      boostRippleLineWidth: 1.5,    // 强化波纹线宽
    },
    // 掉落物渲染参数
    drop: {
      // 粘板/粘液弹渲染
      sticky: {
        glowSizeMultiplier: 2,                         // 发光大小倍率
        glowAlpha: 0.3,                               // 发光透明度
        glowInnerColor: 'rgba(250, 220, 50, {alpha})', // 内部发光颜色
        glowOuterColor: 'rgba(250, 200, 50, 0)',       // 外部发光颜色
        pulseBase: 0.8,                               // 脉冲基础值
        pulseAmplitude: 0.2,                          // 脉冲幅度
        bodyAlpha: 0.85,                              // 本体透明度
        bodyColor: 'rgba(250, 220, 50, {alpha})',     // 本体颜色
        highlightAlpha: 0.6,                          // 高光透明度
        highlightColor: 'rgba(255, 250, 200, {alpha})', // 高光颜色
        highlightSizeRatio: 0.35,                     // 高光大小比例
        highlightOffsetRatio: 0.25,                   // 高光偏移比例
        trailLength: 3,                               // 尾迹长度
        trailAlphaBase: 0.3,                          // 尾迹基础透明度
        trailSizeDecay: 0.2,                          // 尾迹大小衰减
        trailColor: 'rgba(250, 220, 50, {alpha})',    // 尾迹颜色
        fixedTrailStep: 0.016,                        // 固定尾迹步进
        dripCount: 3,                                 // 滴落数量
        dripLengthBase: 6,                            // 滴落基础长度
        dripLengthAmplitude: 3,                       // 滴落长度变化幅度
        dripAngleSpacing: Math.PI * 2 / 3,            // 滴落角度间隔（120°）
        dripTimeScale: 8,                             // 滴落时间缩放
        attachedAlphaBase: 0.4,                       // 附着状态基础透明度
        attachedAlphaAmplitude: 0.2,                  // 附着状态透明度变化
        attachedLineWidth: 2,                         // 附着状态线宽
        attachedBaseRadius: 8,                        // 附着状态基础半径
        attachedStrokeColor: 'rgba(250, 220, 50, {alpha})', // 附着状态描边颜色
      },
      // 武器掉落渲染
      weapon: {
        baseSize: 32,              // 武器图标基础大小（像素）
        bobYAmplitude: 10,         // 上下浮动 Y 幅度（像素）
        bobXAmplitude: 6,          // 左右浮动 X 幅度（像素）
        bobXTimeScale: 0.6,        // X 浮动时间缩放
        breatheBase: 1,            // 呼吸效果基础缩放
        breatheAmplitude: 0.08,    // 呼吸效果缩放幅度
        breatheTimeScale: 2,       // 呼吸效果时间缩放
        tiltAmplitude: 0.15,       // 倾斜幅度（弧度）
        tiltTimeScale: 1.5,        // 倾斜时间缩放
        labelFont: 'bold 9px sans-serif', // 标签字体
        labelOffsetY: -22,         // 标签 Y 偏移（像素）
        labelShadowBlur: 3,        // 标签阴影模糊
        labelShadowColor: 'rgba(0,0,0,0.8)', // 标签阴影颜色
        haloAlpha: 0.6,            // 光晕透明度
        haloLineWidth: 2,          // 光晕线宽
        glowSize: 25,              // 发光大小（像素）
        glowAlpha: 0.4,            // 发光透明度
        fallbackSize: 24,          // 备用图标大小（图标加载失败时）
        fallbackLineWidth: 1.5,    // 备用图标线宽
        fallbackStrokeColor: '#fff', // 备用图标描边颜色
      },
      // 道具掉落渲染
      item: {
        size: 48,                                   // 道具图标大小（像素）
        bobYAmplitude: 12,                          // 上下浮动幅度（像素）
        glowPulseBase: 0.5,                         // 发光脉冲基础值
        glowPulseAmplitude: 0.5,                    // 发光脉冲幅度
        glowInnerRadiusRatio: 0.3,                  // 内部发光半径比例
        glowOuterRadiusRatio: 2,                    // 外部发光半径比例
        glowColor1: 'rgba(251, 191, 36, {alpha})',  // 发光颜色 1
        glowColor2: 'rgba(245, 158, 11, {alpha})',  // 发光颜色 2
        outerRingBaseSizeRatio: 0.8,                // 外环基础大小比例
        outerRingAmplitudeRatio: 0.2,               // 外环大小变化幅度
        outerRingAlphaBase: 0.6,                    // 外环基础透明度
        outerRingAlphaAmplitude: 0.4,               // 外环透明度变化幅度
        outerRingLineWidth: 2,                      // 外环线宽
        outerRingColor: 'rgba(251, 191, 36, {alpha})', // 外环颜色
        innerRingSizeRatio: 0.6,                    // 内环大小比例
        innerRingDecayRatio: 0.1,                   // 内环衰减比例
        innerRingAlphaBase: 0.4,                    // 内环基础透明度
        innerRingAlphaAmplitude: 0.3,               // 内环透明度变化幅度
        innerRingAngleLength: Math.PI * 1.5,        // 内环角度长度（弧度）
        innerRingLineWidth: 1.5,                    // 内环线宽
        innerRingColor: 'rgba(252, 211, 77, {alpha})', // 内环颜色
      },
    },
    // 护士蟑螂治疗特效渲染
    nurseHealVFX: {
      healRange: 360,        // 治疗范围（像素）
      footYOffset: 12,       // 脚部 Y 偏移（像素）
      charge: {              // 充能阶段特效
        ringScaleRatio: 0.9,        // 环缩放比例
        ringYScaleRatio: 0.32,      // 环 Y 轴缩放比例
        glowAlphaBase: 0.15,        // 发光基础透明度
        glowAlphaRange: 0.35,       // 发光透明度变化范围
        ringAlphaMultiplier: 0.7,   // 环透明度倍率
        ringLineWidth: 2,           // 环线宽
        fillAlpha: 0.1,             // 填充透明度
        dotPulseFreq: 8,            // 点脉冲频率
        dotPulseAmp: 0.3,           // 点脉冲幅度
        dotAlpha: 0.6,              // 点透明度
        dotBaseSize: 4,             // 点基础大小（像素）
        ecgAlpha: 0.5,              // 心电图透明度
        ecgLineWidth: 1.5,          // 心电图线宽
        ecgRange: 60,               // 心电图范围（像素）
        ecgStep: 2,                 // 心电图步进
        ecgBaseY: 20,               // 心电图基础 Y
        ecgFreq: 12,                // 心电图频率
        ecgWaveFreq: 0.3,           // 心电图波形频率
      },
      spray: {               // 喷雾阶段特效
        mistDirs: [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75] as readonly number[], // 喷雾方向（4个对角）
        blobCount: 3,              // 液滴团数量
        blobDistRatio: 0.35,       // 液滴团距离比例
        blobAngleWobble: 0.15,     // 液滴团角度摆动
        blobYScale: 0.5,           // 液滴团 Y 缩放
        blobBaseSize: 25,          // 液滴团基础大小（像素）
        blobSizeIncrement: 12,     // 液滴团大小增量
        blobSizeFade: 0.3,         // 液滴团大小衰减
        blobAlphaBase: 0.25,       // 液滴团基础透明度
        blobAlphaFade: 0.5,        // 液滴团透明度衰减
        blobAlphaStepDecay: 0.15,  // 液滴团透明度步进衰减
        blobVertexStep: 0.5,       // 液滴团顶点步进
        blobRadiusBase: 0.7,       // 液滴团半径基础值
        blobRadiusAmp: 0.3,        // 液滴团半径变化幅度
        blobYScaleRatio: 0.6,      // 液滴团 Y 缩放比例
        ringPulseFreq: 4,          // 环脉冲频率
        ringPulseAmp: 0.06,        // 环脉冲幅度
        ringAlpha: 0.5,            // 环透明度
        ringStrokeWidth: 2.5,      // 环描边宽度
        ringFillAlpha: 0.12,       // 环填充透明度
        ringInnerAlpha: 0.4,       // 内环透明度
        ringInnerWidth: 1.5,       // 内环宽度
        ringInnerDash: [8, 10] as readonly number[], // 内环虚线样式
        tickCount: 12,             // 刻度线数量
        tickRotSpeed: 1.8,         // 刻度线旋转速度
        tickBaseLen: 5,            // 刻度线基础长度
        tickLongExtra: 4,          // 长刻度线额外长度
        tickAlpha: 0.7,            // 刻度线透明度
        tickWidthNormal: 1.5,      // 普通刻度线宽度
        tickWidthLong: 2.5,        // 长刻度线宽度
        crosshairAlpha: 0.25,      // 十字准星透明度
        crosshairWidth: 1,         // 十字准星宽度
      },
      dissipate: {           // 消散阶段特效
        ringAlpha: 0.5,            // 环透明度
        ringWidth: 2,              // 环宽度
        glowInnerAlpha: 0.08,      // 内部发光透明度
        dotAlpha: 0.4,             // 点透明度
        dotBaseSize: 3,            // 点基础大小（像素）
      },
    },
    // 蟑螂渲染参数
    roach: {
      bossScale: 6,              // Boss 缩放倍率
      bodyWidthRatio: 1.2,       // 身体宽度比例
      mutantTransformScale: 1.3, // 变异蟑螂变身缩放
      flyingDeathFadeDuration: 2.0,  // 飞行蟑螂死亡淡出时间（秒）
      normalDeathFadeDuration: 0.6,  // 普通蟑螂死亡淡出时间（秒）
      deadSizeLarge: 16,         // 大型蟑螂尸体大小（像素）
      deadSizeSmall: 10,         // 小型蟑螂尸体大小（像素）
      sizeWobbleBase: 0.9,       // 大小摆动基础值
      sizeWobbleAmp: 0.1,        // 大小摆动幅度
      // 护盾渲染（装甲蟑螂/定时自爆蟑螂）
      shield: {
        normalColor: '100, 200, 255',          // 普通护盾颜色（浅蓝）
        timedSuicideColor: '255, 165, 0',      // 定时自爆护盾颜色（橙色）
        normalPulseBase: 0.3,                  // 普通护盾脉冲基础值
        normalLineWidth: 2,                    // 普通护盾线宽
        normalShadowBlur: 10,                  // 普通护盾阴影模糊
        normalShadowAlphaRatio: 0.5,           // 普通护盾阴影透明度比例
        normalRadiusRatio: 0.65,               // 普通护盾半径比例
        normalGlowAlphaRatio: 0.1,             // 普通护盾发光透明度比例
        timedSuicidePulseBase: 0.35,           // 定时自爆护盾脉冲基础值
        timedSuicideLineWidth: 2.5,            // 定时自爆护盾线宽
        timedSuicideShadowBlur: 12,            // 定时自爆护盾阴影模糊
        timedSuicideShadowAlphaRatio: 0.6,     // 定时自爆护盾阴影透明度比例
        timedSuicideRadiusRatio: 0.7,          // 定时自爆护盾半径比例
        timedSuicideGlowAlphaRatio: 0.12,      // 定时自爆护盾发光透明度比例
      },
    },
    // 渲染工具函数参数
    renderUtils: {
      // 枪口火焰渲染
      muzzleFlash: {
        sideGunScale: 0.6,                    // 侧火焰缩放
        boostColors: ['255, 100, 20', '255, 180, 50', '255, 60, 0', '255, 140, 40'] as readonly string[], // 强化模式颜色
        boostParticleCount: 4,                // 强化模式粒子数
        boostSprayDistMin: 15,                // 强化模式喷射最小距离
        boostSprayDistMax: 50,                // 强化模式喷射最大距离
        boostSprayYScale: 0.6,                // 强化模式喷射 Y 缩放
        boostSprayYRandom: 10,                // 强化模式喷射 Y 随机
        boostParticleSizeBase: 2,             // 强化模式粒子基础大小
        boostParticleSizeRange: 3.5,          // 强化模式粒子大小范围
        boostAlphaBase: 0.6,                  // 强化模式基础透明度
        boostAlphaRange: 0.4,                 // 强化模式透明度范围
        boostGlowSizeMultiplier: 2,           // 强化模式发光大小倍率
        boostGlowAlphaRatio: 0.3,             // 强化模式发光透明度比例
        boostAlphaFadeTime: 0.5,              // 强化模式透明度衰减时间
      },
      // 雷达激光渲染
      radarLaser: {
        fadeInDuration: 0.5,     // 淡入时间（秒）
        baseAlpha: 0.6,          // 基础透明度
        pulseFreq: 20,           // 脉冲频率
        pulseAmp: 0.2,           // 脉冲幅度
        outerGlowAlpha: 0.3,     // 外部发光透明度
        outerGlowWidth: 12,      // 外部发光宽度（像素）
        midGlowAlpha: 0.6,       // 中间发光透明度
        midGlowWidth: 6,         // 中间发光宽度（像素）
        coreWidth: 2,            // 核心线宽（像素）
        colorBody: '34, 211, 238',     // 激光主体颜色（青色）
        colorBright: '103, 232, 249',  // 激光亮色（浅青）
        lockPulseFreq: 8,        // 锁定脉冲频率
        lockPulseBase: 0.5,      // 锁定脉冲基础值
        lockPulseAmp: 0.5,       // 锁定脉冲幅度
        lockRingRadius: 20,      // 锁定环半径（像素）
        lockRingAmp: 8,          // 锁定环幅度
        lockRingWidth: 2,        // 锁定环宽度
        lockFillRadius: 15,      // 锁定填充半径
        lockFillAlpha: 0.3,      // 锁定填充透明度
        emitterRadius: 10,       // 发射器半径（像素）
        emitterAlpha: 0.4,       // 发射器透明度
      },
      // 电蚊拍渲染
      swatter: {
        animDuration: 0.6,       // 动画持续时间（秒）
        startYRatio: -0.3,       // 起始 Y 比例（屏幕上方）
        endYRatio: 0.8,          // 结束 Y 比例（屏幕下方）
        headWRatio: 0.7,         // 拍头宽度比例
        headHRatio: 0.15,        // 拍头高度比例
        gridCols: 8,             // 网格列数
        gridRows: 3,             // 网格行数
        handleLengthRatio: 0.4,  // 手柄长度比例
        handleWidth: 6,          // 手柄宽度（像素）
        arcAlphaPeak: 0.9,       // 电弧最大透明度
        arcPhaseStart: 0.3,      // 电弧相位起始
        arcPhaseEnd: 0.8,        // 电弧相位结束
        arcCount: 12,            // 电弧数量
        arcSegments: 4,          // 电弧分段数
        arcWidth: 30,            // 电弧宽度（像素）
        arcHeight: 8,            // 电弧高度（像素）
        arcFillAlpha: 0.15,      // 电弧填充透明度
        stunStarChance: 0.3,     // 眩晕星星出现概率
        stunStarSize: { large: 22, small: 14 }, // 眩晕星星大小
        stunStarAlphaBase: 0.5,  // 眩晕星星基础透明度
        stunStarAlphaRange: 0.5, // 眩晕星星透明度范围
        outerGlowAlpha: 0.4,     // 外部发光透明度
        outerGlowColor: '250, 200, 50',   // 外部发光颜色
        outerGlowColor2: '50, 100, 200',  // 外部发光颜色 2
        outerGlowFalloff: 0.6,   // 外部发光衰减
        rectStroke: '180, 220, 255',      // 矩形描边颜色
        rectStrokeAlpha: 0.8,    // 矩形描边透明度
        rectStrokeDecay: 0.5,    // 矩形描边衰减
        gridStroke: '120, 180, 255',      // 网格描边颜色
        gridStrokeAlpha: 0.5,    // 网格描边透明度
        handleStroke: '150, 150, 150',    // 手柄描边颜色
        handleStrokeAlpha: 0.9,  // 手柄描边透明度
        arcStroke: '200, 240, 255',       // 电弧描边颜色
        arcGlowColor: '250, 200, 50',     // 电弧发光颜色
        arcGlowBlur: 15,         // 电弧发光模糊
        arcFill: '200, 240, 255',         // 电弧填充颜色
        stunStar: '150, 220, 255',        // 眩晕星星颜色
      },
      // 杀虫剂喷雾渲染
      insecticide: {
        range: 280,              // 喷雾范围（像素）
        pulseBaseAlpha: 0.12,    // 脉冲基础透明度
        pulseAmpAlpha: 0.08,     // 脉冲透明度幅度
        pulseFreq: 12,           // 脉冲频率
        boundaryAlpha: 0.2,      // 边界透明度
        boundaryStroke: 'rgba(100, 255, 120, 0.4)', // 边界描边
        boundaryWidth: 2,        // 边界宽度
        centerAlpha: 0.3,        // 中心透明度
        centerStroke: 'rgba(150, 255, 160, 0.5)',   // 中心描边
        centerWidth: 1.5,        // 中心宽度
        centerDash: [5, 5] as readonly number[],     // 中心虚线样式
        nozzleGlowAlpha: 0.4,    // 喷嘴发光透明度
        nozzleRadius: 20,        // 喷嘴半径（像素）
        timerOffsetY: -40,       // 计时器 Y 偏移（像素）
      },
      // 道具放置渲染
      itemPlacement: {
        fillAlpha: 0.12,         // 填充透明度
        ringAlphaBase: 0.5,      // 环基础透明度
        ringAlphaAmp: 0.3,       // 环透明度幅度
        ringWidth: 3,            // 环宽度
        ringDashBase: 10,        // 环虚线基础长度
        ringDashAmp: 6,          // 环虚线长度幅度
        ringDashGap: 8,          // 环虚线间隙
        ringDashSpeed: 40,       // 环虚线速度
        innerRingAlpha: 0.6,     // 内环透明度
        innerRingWidth: 1.5,     // 内环宽度
        innerRingScale: 0.5,     // 内环缩放
        dirLineAlpha: 0.35,      // 方向线透明度
        dirLineWidth: 1,         // 方向线宽度
        crosshairWidth: 2.5,     // 十字准星宽度
        crosshairMaxLen: 14,     // 十字准星最大长度
        crosshairMinLen: 4,      // 十字准星最小长度
        crosshairScaleX: 0.3,    // 十字准星 X 缩放
        crosshairScaleY: 0.3,    // 十字准星 Y 缩放
        crosshairShadowBlur: 8,  // 十字准星阴影模糊
        centerDotRadius: 5,      // 中心点半径（像素）
        centerDotShadowBlur: 12, // 中心点阴影模糊
        labelBgHeight: 44,       // 标签背景高度
        labelBgRadius: 8,        // 标签背景圆角半径
        labelBgAlpha: 0.65,      // 标签背景透明度
        labelYOffset: 42,        // 标签 Y 偏移
        labelFont: 'bold 14px sans-serif',  // 标签字体
        labelFont2: 'bold 11px sans-serif', // 辅助标签字体
        typeColors: {            // 不同道具类型的颜色
          sticky: '250, 200, 50', // 粘板 - 金色
          poison: '180, 130, 255', // 毒气 - 紫色
          molotov: '255, 100, 80', // 燃烧瓶 - 红色
          shotgun: '255, 200, 100', // 散弹 - 橙色
        } as Record<string, string>,
        defaultColor: '255, 255, 255', // 默认颜色 - 白色
      },
      // 防线渲染
      defenseLine: {
        lineWidth: 3,            // 防线线宽（像素）
        dash: [12, 8] as readonly number[], // 虚线样式
        dashSpeed: 30,           // 虚线流动速度
        fillAlpha: 0.08,         // 填充透明度
        fillHeight: 25,          // 填充高度（像素）
        labelFont: 'bold 13px sans-serif', // 标签字体
        labelAlpha: 0.25,        // 标签透明度
        labelOffsetY: -8,        // 标签 Y 偏移
        shieldYOffset: 20,       // 护盾 Y 偏移（像素）
        shieldAlphaBase: 0.4,    // 护盾基础透明度
        shieldAlphaAmp: 0.2,     // 护盾透明度幅度
        shieldAlphaFreq: 6,      // 护盾透明度频率
        shieldGlowColor: 'rgba(6, 182, 212, 0.8)', // 护盾发光颜色
        shieldGlowBase: 12,      // 护盾发光基础值
        shieldGlowAmp: 4,        // 护盾发光幅度
        shieldGlowFreq: 4,       // 护盾发光频率
        shieldLineWidth: 4,      // 护盾线宽
        shieldCoreWidth: 1.5,    // 护盾核心宽度
        shieldCoreAlphaRatio: 0.6, // 护盾核心透明度比例
        shieldColor: '6, 182, 212',    // 护盾颜色
        shieldCoreColor: '165, 243, 252', // 护盾核心颜色
      },
      // 投掷物渲染
      throwable: {
        trailFactor1: 0.03,      // 尾迹因子 1
        trailFactor2: 0.06,      // 尾迹因子 2
        glowRadius: 15,          // 发光半径（像素）
        bottleRadius: 5,         // 瓶子半径（像素）
        trailRadius1: 3,         // 尾迹半径 1（像素）
        trailRadius2: 2,         // 尾迹半径 2（像素）
        trailAlpha1: 0.4,        // 尾迹透明度 1
        trailAlpha2: 0.2,        // 尾迹透明度 2
      },
      // 移动范围指示渲染
      movementRange: {
        fillAlpha: 0.06,                              // 填充透明度
        fillColor: 'rgba(0, 255, 100, 0.06)',         // 填充颜色
        sideStroke: 'rgba(0, 255, 80, 0.8)',          // 侧面描边
        sideWidth: 3,                                  // 侧面宽度
        farStroke: 'rgba(0, 255, 80, 0.5)',            // 远侧描边
        farWidth: 2,                                   // 远侧宽度
        nearStroke: 'rgba(0, 255, 80, 0.9)',           // 近侧描边
        nearWidth: 2,                                  // 近侧宽度
        defLineStroke: 'rgba(0, 255, 80, 0.4)',        // 防线描边
        defLineWidth: 1.5,                             // 防线宽度
        defLineDash: [6, 4] as readonly number[],       // 防线虚线样式
        cornerRadius: 6,                               // 角点半径（像素）
        cornerStroke: 'rgba(255, 255, 255, 0.8)',      // 角点描边
        cornerStrokeWidth: 2,                          // 角点描边宽度
        cornerFill: 'rgba(0, 255, 80, 1)',             // 角点填充
        pillBg: 'rgba(0, 0, 0, 0.7)',                  // 标签背景
        pillRadius: 4,                                 // 标签圆角
        pillHeight: 16,                                // 标签高度
        pillOffsetX: 10,                               // 标签 X 偏移
        pillOffsetY: 3,                                // 标签 Y 偏移
        textColor: 'rgba(255, 255, 0, 1)',             // 文字颜色（黄色）
        textFont: 'bold 12px monospace',               // 文字字体
        labelColor: 'rgba(0, 255, 80, 0.7)',           // 标签颜色
        labelOffsetY: -14,                             // 标签 Y 偏移
      },
    },
  },
} as const;