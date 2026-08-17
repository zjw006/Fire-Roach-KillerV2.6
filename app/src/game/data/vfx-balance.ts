/**
 * @fileoverview 特效数值统一配置（VFX Balance）
 * @description 喷火枪 / 商店道具 / 掉落技能道具 / 怪物技能的表现效果数值全部集中在此文件，方便统一修改。
 *
 * 内容来源：
 *   - 自 render-balance.ts 迁入：particle（粒子生成器）、render（渲染系统）、
 *     weather（天气：雨/雾）、lightning（闪电天气）
 *   - 自 items.ts 迁入：poisonCloud（毒雾粒子）、fan（强力风扇）
 *   - 自引擎/渲染器硬编码提取：slimeBurst（粘液爆发）、healBuff（治疗增益光环）、
 *     timedBomb（定时自爆"螂家爆破"全阶段）、bombExplosion（爆炸闪光+碎片，突破/放置炸弹共用）、
 *     bait（诱饵投掷/碎裂/气味/光环）、fireWall（火焰墙）、
 *     render.roach.armorCastRing（隧道工施法警示光圈，渲染/AI 计时/编辑器三方共用）、
 *     weather.rain/fog.render*（天气粒子渲染参数）、lightning.flashAlpha/textOffsetY（闪电渲染参数）
 *   - 独立导出常量：SHIELD_RECT_HEIGHT（气体护盾矩形高度，视觉/判定共用，
 *     items.ts BALANCE_ITEMS.subway.shieldRectHeight 引用以保持访问路径不变）
 *
 * 通过 balance.ts 合并到 BALANCE_CONFIG 对外暴露：
 *   BALANCE_CONFIG.particle.* / BALANCE_CONFIG.render.* / BALANCE_CONFIG.fan.* /
 *   BALANCE_CONFIG.poisonCloud.* / BALANCE_CONFIG.weather.* / BALANCE_CONFIG.lightning.*
 * 节路径：BALANCE_CONFIG.slimeBurst / healBuff / timedBomb / bombExplosion / bait / fireWall
 *
 * ============================================================
 * 三层参数结构（每个特效节按职责分层）：
 *   emitter  —— 发射器层：描述"生成多少个 / 以什么节奏 / 在什么位置与方向"，
 *               不含粒子自身外观与运动。统一放在 xxx.emitter 子对象中。
 *               mode 字段标识发射模式（仅作文档自描述，代码不读取）：
 *                 burst    一次性爆发（爆炸、碎裂、闪电弧等）
 *                 perFrame 持续每帧生成（火焰锥、气体光环、气味等）
 *                 chance   每帧按概率生成（天气雨/雾、护盾修复火花等）
 *                 interval 定时间隔触发（闪电天气调度）
 *                 loop     固定数量元素持续循环动画（风扇波纹、治疗+号等）
 *   （顶层） —— 粒子层：单个粒子的速度/生命/大小/颜色等属性
 *   render.* —— 渲染层：Canvas 直绘特效的形状/颜色/动画参数
 * ============================================================
 *
 * 所有数值单位为像素（px）或秒（s），除非另有说明。
 * 颜色字符串为裸 RGB 三元组（如 '255, 200, 50'），渲染代码以 rgba(颜色, α) 插值使用。
 */

export const BALANCE_VFX = {
  // ======================================================================
  // 粒子生成器（ParticleSpawner 全系战斗粒子：火焰/烟雾/灰烬/血液/火花/爆炸等）
  // ======================================================================
  particle: {
    // 隧道工护甲喷涂粒子（灰色喷射流 + 目标头顶 + 号）
    armorSpray: {
      // --- 发射器（喷射流：隧道工 → 目标方向一次性爆发） ---
      emitter: {
        mode: 'burst',
        streamCount: 20,                      // 喷射流粒子数量（增多，原 12）
        streamSpread: 0.5,                    // 喷射扩散角度（弧度）
      },
      // --- 粒子 ---
      streamLifeMin: 0.25, streamLifeMax: 0.4, // 喷射流存活时间（秒）
      streamSizeMin: 2, streamSizeMax: 4,      // 喷射流粒子大小
      streamSpeedMin: 120, streamSpeedMax: 200, // 喷射流速度
      streamColor: { rMin: 148, rMax: 163, gMin: 163, gMax: 184, bMin: 184, bMax: 184, aMin: 0.6, aMax: 0.9 }, // 灰蓝色
      // +号粒子（目标头顶）
      plusLife: 1.5,                          // +号存活时间（秒，延长以增加可见时长）
      plusSize: 14,                           // +号大小（像素，加大以更明显）
      plusVy: -30,                            // +号上升速度
      plusColor: 'rgba(203, 213, 225, 1)',    // +号颜色（浅灰白）
      plusOffsetY: 40,                        // +号头顶偏移（像素，相对目标中心上移）
      blend: 'lighter' as GlobalCompositeOperation, // 叠加混合（喷涂流与+号粒子，lighter 提亮）
    },
    // 护盾修复连线（隧道工→护盾蟑螂，替换旧粒子特效）
    shieldRepairLine: {
      color: '239, 68, 68',          // 红色
      alphaBase: 0.7,                // 基础透明度
      alphaPulseAmp: 0.15,           // 脉冲透明度振幅
      alphaPulseFreq: 8,             // 脉冲频率（Hz）
      lineWidth: 2.5,                // 线宽（像素）
      glowColor: '185, 28, 28',      // 发光颜色（深红）
      glowBlur: 8,                   // 发光模糊半径
      glowAlphaRatio: 0.4,           // 发光透明度比例
      dashLen: 8,                    // 虚线长度（像素）
      dashGap: 4,                    // 虚线间隔（像素）
      flowSpeed: 60,                 // 虚线流动速度（像素/秒，正值=流向护盾）
    },
    // 护盾修复特效粒子（隧道工修盾时：工程师身上升粒子 + 护盾蟑螂头顶+号粒子）
    shieldRepair: {
      // 工程师上升粒子（lighter叠加，循环生成）
      workerParticle: {
        count: 3,                         // 每帧生成的粒子数
        lifeMin: 0.6, lifeMax: 1.0,      // 粒子存活时间（秒）
        sizeMin: 2, sizeMax: 4,           // 粒子大小（像素）
        vxSpread: 15,                     // 水平扩散速度（像素/秒）
        vyMin: -50, vyMax: -30,           // 上升速度（像素/秒，负值=向上）
        color: '103, 232, 249',           // 青色（与护盾颜色一致）
        alphaMin: 0.4, alphaMax: 0.8,     // 透明度范围
        blend: 'lighter' as GlobalCompositeOperation, // lighter叠加提亮
      },
      // 护盾蟑螂头顶+号粒子（上升）
      shieldPlus: {
        life: 1.2,                        // +号存活时间（秒）
        size: 18,                         // +号大小（像素，原 12 的 1.5 倍）
        vy: -35,                          // +号上升速度
        color: 'rgba(253, 224, 71, 1)',   // +号渐变顶部颜色（黄）
        color2: 'rgba(239, 68, 68, 1)',   // +号渐变底部颜色（红）
        offsetY: 45,                      // +号头顶偏移（像素）
        interval: 0.8,                    // +号生成间隔（秒，节流避免过多）
        blend: 'lighter' as GlobalCompositeOperation, // lighter叠加提亮
        glowColor: 'rgba(254, 240, 138, 0.9)', // +号边缘辉光颜色（暖黄）
        glowBlur: 12,                     // +号边缘辉光模糊半径（像素）
      },
    },
    // 破盾特效粒子（护盾蟑螂护盾破碎瞬间：玻璃碎屑辉光点从光带区域向外迸发，
    //   SPARK 类型辉光小点 + 红色 + lighter 叠加，模拟玻璃渣四溅的闪光）
    shieldBreak: {
      // --- 发射器 ---
      emitter: { mode: 'burst' },
      // --- 粒子 ---
      count: 22,                             // 迸发碎屑数量
      speedMin: 80, speedMax: 220, vyBias: -60, // 速度范围（像素/秒），偏向上迸溅
      lifeMin: 0.3, lifeMax: 0.6,            // 存活时间（秒）
      sizeMin: 1.5, sizeMax: 3.5,            // 碎屑大小（像素）
      rMin: 220, rMax: 255, gMin: 40, gMax: 90, bMin: 30, bMax: 70, alphaMin: 0.7, alphaMax: 1.0, // 红色（碎盾闪光）
      blend: 'lighter' as GlobalCompositeOperation, // lighter 叠加提亮（与护盾光带一致）
    },
    // 锥形火焰喷射粒子（喷火枪主武器）
    coneFire: {
      // --- 发射器 ---
      emitter: {
        mode: 'perFrame',
        countMin: 3, countMax: 3,   // 每帧生成的粒子数
        angleSpread: 0.5,           // 发射口张角（火焰锥扩散，弧度）
      },
      // --- 粒子 ---
      lifeMin: 0.06, lifeMax: 0.08, // 粒子存活时间（秒）
      flowSpeedMin: 100, flowSpeedMax: 60, // 流速范围（像素/秒）
      fireSizeMin: 2, fireSizeMax: 5,     // 火焰粒子大小（像素）
      emberSizeMin: 1, emberSizeMax: 3,   // 余烬粒子大小（像素）
      sparkSizeMin: 2, sparkSizeMax: 3,   // 火花粒子大小（像素）
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
    // 烟雾粒子（蟑螂死亡时产生；数量由调用方传入）
    smoke: {
      // --- 发射器 ---
      emitter: {
        mode: 'burst',
        offsetX: 30, offsetY: 30,         // 生成位置散布范围（像素）
      },
      // --- 粒子 ---
      vxRange: 40, vyBase: -30, vyRange: 50, // 速度范围（像素/秒）
      lifeMin: 1, lifeMax: 2,            // 存活时间（秒）
      sizeMin: 6, sizeMax: 16,           // 烟雾大小（像素）
      hue: 0, saturation: 0, lightnessMin: 35, lightnessMax: 35, // HSL 颜色（灰色）
    },
    // 灰烬粒子（蟑螂烧死后产生；数量由调用方传入）
    ash: {
      // --- 发射器 ---
      emitter: { mode: 'burst' },
      // --- 粒子 ---
      speedMin: 30, speedMax: 80, vyBias: -40, // 速度范围，偏向上飘
      lifeMin: 0.6, lifeMax: 1.0,             // 存活时间（秒）
      sizeMin: 2, sizeMax: 6,                  // 灰烬大小（像素）
      hue: 0, saturation: 0, lightnessMin: 5, lightnessMax: 20, // 灰黑色
    },
    // 血液粒子（蟑螂被击中时溅出；数量由调用方传入）
    blood: {
      // --- 发射器 ---
      emitter: { mode: 'burst' },
      // --- 粒子 ---
      speedMin: 80, speedMax: 200, vyBias: 40, // 速度范围（像素/秒）
      life: 0.5,                               // 存活时间（秒）
      sizeMin: 4, sizeMax: 10,                 // 血滴大小（像素）
      rMin: 20, rMax: 40, gMin: 120, gMax: 60, bMin: 20, bMax: 40, alphaMin: 0.5, alphaMax: 0.5, // 暗绿色
    },
    // 火花粒子（金属碰撞/爆炸产生；数量由调用方传入）
    spark: {
      // --- 发射器 ---
      emitter: { mode: 'burst' },
      // --- 粒子 ---
      speedMin: 60, speedMax: 120,             // 速度范围（像素/秒）
      lifeMin: 0.2, lifeMax: 0.4,              // 存活时间（秒）
      sizeMin: 1, sizeMax: 3,                  // 火花大小（像素）
      hueMin: 30, hueMax: 30, saturation: 100, lightness: 75, // 橙黄色
    },
    // 爆炸粒子（燃烧瓶/自爆等爆炸；数量由调用方传入）
    explosion: {
      // --- 发射器 ---
      emitter: { mode: 'burst' },
      // --- 粒子 ---
      speedMin: 50, speedMax: 150, vyBias: -30, // 速度范围（像素/秒）
      lifeMin: 0.3, lifeMax: 0.5,               // 存活时间（秒）
      sizeMin: 3, sizeMax: 12,                  // 粒子大小（像素）
      hueMin: 10, hueMax: 30, saturation: 100, lightnessMin: 50, lightnessMax: 25, // 橙红到黄色
    },
    // 碎片粒子（装甲蟑螂破甲时产生；数量由调用方传入）
    debris: {
      // --- 发射器 ---
      emitter: {
        mode: 'burst',
        offsetXY: 10,                    // 生成位置散布范围（像素）
      },
      // --- 粒子 ---
      speedMin: 40, speedMax: 120, vyBias: -50, // 速度范围，偏向上飞
      lifeMin: 3, lifeMax: 2,                // 存活时间（秒）
      sizeMin: 4, sizeMax: 10,               // 碎片大小（像素）
      hueMin: 15, hueMax: 20, saturation: 80, lightnessMin: 30, lightnessMax: 20, // 暗棕色
    },
    // 火环粒子（爆炸冲击波扩散；数量由调用方传入）
    fireRing: {
      // --- 发射器 ---
      emitter: { mode: 'burst' },
      // --- 粒子 ---
      speedMin: 60, speedMax: 80, vyBias: -20, // 速度范围（像素/秒）
      lifeMin: 1.5, lifeMax: 1.5,              // 存活时间（秒）
      sizeMin: 8, sizeMax: 16,                 // 火环粒子大小（像素）
      hueMin: 10, hueMax: 25, saturation: 100, lightness: 55, // 橙红色
    },
    // 冲击波粒子（大型爆炸的冲击波效果；外层数量由调用方传入）
    shockwave: {
      // --- 发射器 ---
      emitter: {
        mode: 'burst',
        innerCount: 10,                  // 内层粒子数量（外层数量由调用方传入）
      },
      // --- 粒子 ---
      outerSpeedMin: 150, outerSpeedMax: 200,      // 外层冲击波速度（像素/秒）
      outerLifeMin: 0.8, outerLifeMax: 0.4,        // 外层存活时间（秒）
      outerSizeMin: 12, outerSizeMax: 20,           // 外层粒子大小（像素）
      innerSpeedMin: 80, innerSpeedMax: 150,        // 内层粒子速度
      innerLifeMin: 0.5, innerLifeMax: 0.3,         // 内层存活时间（秒）
      innerSizeMin: 6, innerSizeMax: 12,            // 内层粒子大小（像素）
      outerColor: { r: 255, gMin: 200, gMax: 255, bMin: 100, bMax: 150, a: 0.9 },
      innerColor: { r: 255, g: 255, b: 255, a: 0.95 },
    },
    // 闪电粒子（闪电天气特效）
    lightning: {
      // --- 发射器 ---
      emitter: {
        mode: 'burst',
        topCount: 20,                     // 顶部闪电粒子数量
        topWidthRatio: 0.8,               // 顶部闪电生成宽度（× 画布宽）
        topYRange: 50,                    // 顶部闪电 Y 散布范围（像素）
        fullCount: 30,                    // 全屏闪电粒子数量
      },
      // --- 粒子 ---
      topVxRange: 60, topVyMin: 100, topVyMax: 200,    // 顶部粒子速度
      topLifeMin: 0.4, topLifeMax: 0.4,                // 顶部粒子存活时间
      topSizeMin: 3, topSizeMax: 6,                     // 顶部粒子大小
      fullVxRange: 100, fullVyRange: 100,               // 全屏粒子速度
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
      strokeColor: 'rgba(0,0,0,0.7)', // 描边颜色（ParticleSystem.renderFloatingTexts）
    },
    explosionParticle: {
      // --- 发射器 ---
      emitter: {
        mode: 'burst',
        intensityMultiplier: 3,  // 爆炸强度倍率（× 强度 = 生成数量）
        maxCount: 100,           // 单次爆炸最大粒子数
      },
      // --- 粒子 ---
      speedMin: 50, speedMax: 200,  // 粒子速度范围（像素/秒）
      lifeMin: 0.5, lifeMax: 1.5,   // 粒子存活时间（秒）
      sizeMin: 2, sizeMax: 8,       // 粒子大小（像素）
    },
  },

  // ======================================================================
  // 渲染系统（Canvas 直绘特效：喷火枪火焰锥/掉落物/护士治疗/护盾/电蚊拍/雷达/杀虫剂/防线等）
  // ======================================================================
  render: {
    // 【粒子渲染】各粒子类型的叠加混合/渐隐色/透明度系数（ParticleSystem.renderParticles 按类型取用；
    //   粒子个体 p.blend 覆盖优先，如护甲喷涂流 lighter）
    particleType: {
      fire: {
        blend: 'screen' as GlobalCompositeOperation,   // 叠加混合
        fadeColor: '255, 50, 0',                       // 径向渐变边缘渐隐色（橙红）
        alphaScale: 0.7,                               // 透明度系数（× 生命进度）
      },
      smoke: {
        blend: 'source-over' as GlobalCompositeOperation,
        fadeColor: '80, 80, 80',                       // 边缘渐隐色（灰）
        alphaScale: 0.5,
      },
      ember: {
        blend: 'screen' as GlobalCompositeOperation,
        shadowBlur: 6,                                 // 辉光模糊（像素）
      },
      ash: {
        blend: 'source-over' as GlobalCompositeOperation,
      },
      spark: {
        blend: 'screen' as GlobalCompositeOperation,          // 图形火花混合
        textBlend: 'source-over' as GlobalCompositeOperation, // 文字火花（+号等）混合
        shadowBlur: 4,
      },
      blood: {
        blend: 'source-over' as GlobalCompositeOperation,
        coreColor: '10, 60, 10',                       // 内核颜色（暗绿）
        coreAlphaRatio: 0.3,                           // 内核透明度比例
        coreSizeRatio: 0.5,                            // 内核大小比例
      },
      ice: {
        blend: 'screen' as GlobalCompositeOperation,
        fadeColor: '200, 250, 255',                    // 边缘渐隐色（冰蓝）
        alphaScale: 0.8,
      },
      poisonCloud: {
        blend: 'screen' as GlobalCompositeOperation,
        fadeColor: '150, 100, 255',                    // 边缘渐隐色（紫）
        alphaScale: 0.6,
      },
      slime: {
        blend: 'source-over' as GlobalCompositeOperation,
        fadeColor: '40, 120, 40',                      // 边缘渐隐色（暗绿）
        glowColor: '100, 255, 100',                    // 辉光颜色（亮绿）
        glowAlpha: 0.8,                                // 辉光透明度
        glowBlur: 8,                                   // 辉光模糊（像素）
      },
      explosion: {
        blend: 'screen' as GlobalCompositeOperation,
        fadeColor: '255, 100, 0',                      // 边缘渐隐色（橙）
      },
      lightning: {
        blend: 'screen' as GlobalCompositeOperation,
        shadowBlur: 10,
      },
      rain: {
        blend: 'source-over' as GlobalCompositeOperation,
        alphaScale: 0.4,
      },
    },
    // 背景渲染参数
    background: {
      bgImageAlpha: 0.8,     // 背景图片透明度
      tileSize: 48,          // 背景瓷砖大小（像素）
      nightBaseAlpha: 0.4,   // 夜晚场景基础暗度
      nightFlashAlpha: 0.2,  // 闪电时夜晚暗度
      nightColor: 'rgba(0, 0, 20, {alpha})', // 夜晚遮罩颜色
      nightBlend: 'source-over' as GlobalCompositeOperation, // 夜晚遮罩叠加混合方式
      vignetteInnerRadius: 0.4,  // 暗角内半径（相对屏幕比例）
      vignetteOuterRadius: 0.8,  // 暗角外半径（相对屏幕比例）
      vignetteInnerColor: 'rgba(0,0,0,0)',     // 暗角内部颜色（透明）
      vignetteOuterColor: 'rgba(0,0,0,0.5)',   // 暗角外部颜色（半透明黑）
      vignetteBlend: 'source-over' as GlobalCompositeOperation, // 暗角叠加混合方式
    },
    // 【喷火枪】火焰区域渲染（火焰锥形效果）
    fireZone: {
      segments: 20,            // 火焰形状分段数（越多越平滑）
      rangeRatio: 1,         // 火焰范围占射程的比例
      baseWidth: 25,           // 火焰基础宽度（像素）
      widthTaper: 0.94,        // 火焰宽度锥形收缩率
      wiggleFreq: 6,           // 火焰摆动频率
      wiggleTimeScale: 30,     // 火焰摆动时间缩放
      wiggleAmplitude: 5,      // 火焰摆动幅度（像素）
      sideGunScale: 0.6,       // 侧火焰缩放
      sideGunNozzleOffset: 0,  // 侧火焰喷嘴偏移（像素，0 = 与主枪口 Y 轴位置一致）
      coreGlowSize: 36,        // 核心发光大小（像素）
      coreColorDefault: '160, 210, 255',   // 默认火焰核心颜色（浅蓝白）
      coreColorSticky: '250, 200, 50',     // 粘板模式核心颜色（金色）
      coreColorPoison: '200, 160, 255',    // 毒气模式核心颜色（紫色）
      coreGradAlpha0: 0.9,     // 核心辉光渐变 stop0 透明度
      coreGradAlpha1: 0.5,     // 核心辉光渐变 stop0.3 透明度
      coreGradAlpha2: 0.3,     // 核心辉光渐变 stop0.6 透明度
      coreGradEndColor: 'rgba(255, 0, 0, 0)', // 核心辉光渐变末端颜色（透明）
      boostAlphaMax: 0.25,     // 强化模式下最大透明度
      boostAlphaFade: 0.5,     // 强化模式透明度衰减率
      boostRippleCount: 3,     // 强化波纹数量
      boostRippleFreq: 4,      // 强化波纹频率
      boostRippleSpacing: 2.1, // 强化波纹间距
      boostRippleMaxPhase: 3,  // 强化波纹最大相位
      boostRippleRadiusBase: 30,    // 强化波纹基础半径
      boostRippleRadiusGrowth: 25,  // 强化波纹半径增长
      boostRippleLineWidth: 1.5,    // 强化波纹线宽
      boostRippleColor: '255, 255, 255', // 强化波纹颜色（RGB）
      blend: 'screen' as GlobalCompositeOperation, // 火焰区域叠加混合方式
      // 火焰段颜色（按位置 t∈[0,1] 插值，getFlameColor 使用；透明度 = alphaBase × (1-t)²）
      flameAlphaBase: 0.75,          // 火焰透明度基数
      // 默认喷火枪：t<0.5 蓝→过渡，t≥0.5 过渡→红
      flameDefaultFirst:  { rBase: 60,  rRange: 140, gBase: 140, gRange: -80, bBase: 255, bRange: -100 },
      flameDefaultSecond: { rBase: 200, rRange: 55,  gBase: 60,  gRange: -60, bBase: 155, bRange: -155 },
      flameSticky:  { r: 250, gBase: 200, gRange: 55,  bBase: 50, bRange: 50  },  // 粘板模式（金色）
      flamePoison:  { rBase: 150, rRange: -100, gBase: 100, gRange: 100, bBase: 200, bRange: -50 }, // 毒气模式（紫→绿）
      flameShotgun: { r: 255, gBase: 150, gRange: 105, bBase: 50, bRange: 100 },  // 散弹模式（橙）
    },
    // 【掉落道具】掉落物渲染参数
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
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合（粘液弹丸整体）
        // 蟑螂被粘板困住的身体染色（RoachRenderer stuckByBoard 黄色覆盖）
        stuckTintColor: 'rgba(240, 210, 60, {alpha})', // 困住染色颜色
        stuckTintAlpha: 0.28,                          // 困住染色透明度
        // 包裹凝胶覆盖（wrappedByDropId 蟑螂全身粘液包裹，RoachRenderer 渲染）
        wrap: {
          blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
          glowColor0: 'rgba(250, 220, 50, 0.15)',  // 外辉光 stop0
          glowColor1: 'rgba(250, 200, 50, 0.25)',  // 外辉光 stop0.6
          glowColor2: 'rgba(250, 180, 30, 0)',     // 外辉光 stop1（透明）
          bodyColor: '250, 220, 50',   // 凝胶本体颜色
          bodyAlpha: 0.35,             // 凝胶本体透明度（× 脉冲）
          borderColor: '255, 240, 150',// 凝胶边缘高光颜色
          borderAlpha: 0.5,            // 凝胶边缘透明度（× 脉冲）
          specularColor: '255, 255, 220', // 顶部高光颜色
          specularAlpha: 0.4,          // 顶部高光透明度（× 脉冲）
          bubbleColor: '255, 250, 200',   // 内部气泡颜色
          bubbleAlphaBase: 0.3,        // 气泡透明度基础值
          bubbleAlphaAmp: 0.15,        // 气泡透明度摆动幅度
        },
      },
      // 武器掉落渲染
      weapon: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
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
        glowFadeColor: 'rgba(0,0,0,0)', // 备用发光渐隐色（边缘全透明）
        labelColor: '#fff',        // 标签文字颜色
        fallbackSize: 24,          // 备用图标大小（图标加载失败时）
        fallbackLineWidth: 1.5,    // 备用图标线宽
        fallbackStrokeColor: '#fff', // 备用图标描边颜色
      },
      // 道具掉落渲染
      item: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        size: 48,                                   // 道具图标大小（像素）
        bobYAmplitude: 12,                          // 上下浮动幅度（像素）
        glowPulseBase: 0.5,                         // 发光脉冲基础值
        glowPulseAmplitude: 0.5,                    // 发光脉冲幅度
        glowInnerRadiusRatio: 0.3,                  // 内部发光半径比例
        glowOuterRadiusRatio: 2,                    // 外部发光半径比例
        glowColor1: 'rgba(251, 191, 36, {alpha})',  // 发光颜色 1
        glowColor2: 'rgba(245, 158, 11, {alpha})',  // 发光颜色 2
        glowFadeColor: 'rgba(245, 158, 11, 0)',     // 发光渐隐色（边缘全透明）
        fallbackTextColor: '#000',                  // 备用图标文字颜色（问号）
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
    // 【怪物技能】护士蟑螂治疗特效渲染
    nurseHealVFX: {
      healRange: 150,        // 治疗范围（像素，直径300px）
      footYOffset: 12,       // 脚部 Y 偏移（像素）
      blend: 'source-over' as GlobalCompositeOperation, // 整体叠加混合
      charge: {              // 充能阶段特效
        // --- 颜色 ---
        glowColor0: 'rgba(100, 240, 150, 0)',     // 辉光渐变 stop0（中心透明）
        glowColor1: 'rgba(100, 240, 150, 0.2)',   // 辉光渐变 stop0.85
        glowColor2: 'rgba(140, 255, 190, 0.4)',   // 辉光渐变 stop1（边缘）
        ringColor: '120, 255, 170',               // 环边界颜色（配合透明度倍率）
        fillColor: '100, 230, 150',               // 内填充颜色
        dotColor: '140, 255, 190',                // 中心脉冲点颜色
        ecgColor: '100, 230, 150',                // 心电图线颜色
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
        // --- 颜色 ---
        blobColor0: 'rgba(100, 148, 100, 1)',     // 雾团渐变 stop0（中心）
        blobColor1: 'rgba(90, 138, 90, 0.5)',     // 雾团渐变 stop0.5
        blobColor2: 'rgba(80, 120, 80, 0)',       // 雾团渐变 stop1（边缘透明）
        ringGlowColor0: 'rgba(80, 220, 120, 0)',  // 环辉光渐变 stop0
        ringGlowColor1: 'rgba(80, 220, 120, 0.15)', // 环辉光渐变 stop0.8
        ringGlowColor2: 'rgba(120, 255, 170, 0.35)', // 环辉光渐变 stop1
        ringFillColor: '90, 210, 130',            // 环内填充颜色
        ringStrokeColor: '100, 245, 150',         // 主环边界颜色
        ringStrokeAlphaRatio: 0.85,               // 主环边界透明度比例（× ringAlpha）
        ringInnerColor: '130, 255, 180',          // 内虚线环颜色
        tickColor: '160, 255, 200',               // 旋转刻度线颜色
        crosshairColor: '140, 255, 180',          // 十字准星颜色
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
        // --- 颜色 ---
        ringColor: '100, 245, 150',               // 渐隐环颜色
        dotColor: '140, 255, 190',                // 收缩中心点颜色
        glowColor0: 'rgba(90, 220, 130, 0.08)',   // 内辉光渐变 stop0
        glowColor1: 'rgba(90, 220, 130, 0)',      // 内辉光渐变 stop1（透明）
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
      // 地面蟑螂透视缩放（远小近大：固定设计坐标基准——远端 farY 处 minScale → 近端 nearY 处 maxScale；
      // 不与画布高度绑定，各场景/设备一致；飞行/BOSS 不缩放）
      perspective: {
        farY: 350,             // 远端 Y（设计坐标，缩放最小处 = minScale）
        nearY: 960,            // 近端 Y（设计坐标，缩放最大处 = maxScale）
        minScale: 0.55,        // 远端最小缩放
        maxScale: 1.3,         // 近端最大缩放（近端放大，增强近景冲击力）
      },
      // 【怪物技能】护盾渲染（装甲蟑螂/定时自爆蟑螂）
      shield: {
        normalColor: '100, 200, 255',          // 普通护盾颜色（浅蓝）
        timedSuicideColor: '255, 165, 0',      // 定时自爆护盾颜色（橙色）
        normalPulseBase: 0.3,                  // 普通护盾脉冲基础值（玻璃边缘描边脉动）
        normalLineWidth: 2,                    // 普通护盾线宽
        normalRadiusRatio: 0.65,               // 普通护盾半径比例
        normalBlend: 'source-over' as GlobalCompositeOperation,        // 玻璃质感：不发光叠加
        timedSuicideBlend: 'source-over' as GlobalCompositeOperation, // 玻璃质感：不发光叠加
        timedSuicidePulseBase: 0.35,           // 定时自爆护盾脉冲基础值
        timedSuicideLineWidth: 2.5,            // 定时自爆护盾线宽
        timedSuicideRadiusRatio: 0.7,          // 定时自爆护盾半径比例
        // 半透明玻璃质感：六边形玻璃罩（顶部偏白反光 → 中部微染色 → 底部略深）+ 顶部反光带（裁剪在六边形内）
        glass: {
          topAlpha: 0.30,                  // 填充顶部透明度（偏白反光）
          midStop: 0.45,                   // 渐变中段位置（0~1）
          midAlpha: 0.10,                  // 填充中部透明度（微染色）
          bottomAlpha: 0.20,               // 填充底部透明度（略深）
          edgeAlphaBoost: 0.25,            // 边缘描边透明度增量（脉冲基础之上，保持玻璃边清晰）
          reflection: {
            yRatio: 0.45,                  // 反光带中心偏上距离（护盾半径 × 此值）
            rxRatio: 0.60,                 // 反光带横向半径（× 护盾半径）
            ryRatio: 0.20,                 // 反光带纵向半径（× 护盾半径）
            alpha: 0.35,                   // 反光带最大透明度（向下渐隐至 0）
            color: '255, 255, 255',        // 反光带颜色（白）
          },
        },
      },
      // 【怪物技能】隧道工施法警示光圈（armorSprayCastTimer 脉冲：RoachRenderer 绘制 / RoachAISystem 计时 / 特效编辑器复刻，三方共用）
      armorCastRing: {
        duration: 0.5,                     // 脉冲时长（秒，RoachAISystem 施法计时与光圈进度共用）
        startScale: 0.3,                   // 起始半径比例（随进度扩散至 1.0）
        maxAlpha: 0.55,                    // 最大透明度（随进度渐隐至 0）
        footOffsetRatio: 0.1,              // 圆心下移比例（蟑螂体高 × 此值，贴脚下）
        gradInnerRatio: 0.5,               // 径向渐变内半径比（rangeR × 此值起渐）
        stopMid: 0.7,                      // 渐变中间 stop 位置
        stopEdge: 0.9,                     // 渐变边缘 stop 位置
        fillMidAlphaRatio: 0.3,            // 中间带透明度系数
        fillEdgeAlphaRatio: 0.6,           // 边缘带透明度系数
        fillTipAlphaRatio: 0.2,            // 最外缘透明度系数
        flatten: 0.35,                     // 填充椭圆 Y 压扁比（地面透视）
        strokeAlphaRatio: 0.8,             // 描边透明度系数
        strokeScale: 0.85,                 // 描边内环半径比
        strokeFlatten: 0.3,                // 描边内环 Y 压扁比
        lineWidth: 2.5,                    // 描边线宽（像素）
        colorMid: '59, 130, 246',          // 中间带颜色（蓝 #3b82f6）
        colorEdge: '34, 211, 238',         // 边缘/描边颜色（青 #22d3ee）
        colorTip: '165, 243, 252',         // 最外缘颜色（浅青 #a5f3fc）
        blend: 'lighter' as GlobalCompositeOperation, // 叠加混合（lighter 提亮光圈）
      },
      // 【怪物技能】护士治疗范围环（护士本体脚下绿环，RoachRenderer.renderNurseHealRing）
      nurseHealRing: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        chargeAlphaScale: 0.5,         // 蓄力阶段透明度系数（chargeProgress × 此值）
        sprayAlphaBase: 0.45,          // 喷射阶段透明度基础值（× 脉冲）
        dissipateAlphaScale: 0.3,      // 消散阶段透明度系数
        gradColorInner: '80, 200, 100',   // 径向渐变内圈颜色（stop0/0.7）
        gradColorMid: '100, 230, 130',    // 径向渐变中圈颜色（stop0.9）
        gradColorEdge: '120, 255, 150',   // 径向渐变外圈颜色（stop1）
        gradMidAlphaRatio: 0.25,       // stop0.7 透明度比例（× ringAlpha）
        gradEdgeAlphaRatio: 0.5,       // stop0.9 透明度比例
        gradTipAlphaRatio: 0.15,       // stop1 透明度比例
        strokeColor: '100, 240, 140',  // 主环描边颜色
        strokeAlphaRatio: 0.7,         // 主环描边透明度比例
        innerFillColor: '90, 210, 120',// 内圈填充颜色
        innerFillAlphaRatio: 0.12,     // 内圈填充透明度比例
        dashColor: '140, 255, 170',    // 旋转刻度颜色
        dashAlphaRatio: 0.6,           // 旋转刻度透明度比例
      },
      // 【怪物技能】变异变身倒计时（医院变异蟑螂变身前摇倒计时数字；外部粉色旋涡特效已移除）
      mutantTransform: {
        countdownColor: '255, 255, 255', // 倒计时数字颜色
        countdownAlphaBase: 0.8,       // 倒计时透明度基础值
        countdownAlphaRange: 0.2,      // 倒计时透明度随进度增长
      },
      // 【怪物技能】变异出生粘液染色（wasMutantSpawn 2s 绿色粘液覆盖 + 高光点）
      mutantSpawnSlime: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        alphaScale: 0.6,               // 整体透明度系数（slimeProgress × 此值）
        glowColorInner: '100, 255, 120',  // 背后辉光中心颜色
        glowInnerAlphaRatio: 0.3,      // 辉光中心透明度比例
        glowColorMid: '60, 200, 80',   // 辉光中间颜色
        glowMidAlphaRatio: 0.5,        // 辉光中间透明度比例
        glowColorEdge: '40, 150, 60',  // 辉光边缘颜色（渐隐至 0）
        bodyTintColor: '80, 200, 80',  // 身体染色颜色
        bodyTintAlphaRatio: 0.5,       // 身体染色透明度比例
        ringColor: '100, 255, 130',    // 外圈粘液环颜色
        ringAlphaRatio: 0.7,           // 外圈粘液环透明度比例
        spotColor: '160, 255, 170',    // 高光点颜色
        spotAlphaRatio: 0.6,           // 高光点透明度比例
      },
      // 【怪物技能】自爆蟑螂背部火苗（外橙内黄双层火焰）+ 低血量黑烟粒子
      suicideFlame: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        outerColor: '255, 100, 20',    // 外层火焰颜色（橙）
        outerAlpha: 1,                 // 外层火焰透明度系数（× 闪烁）
        innerColor: '255, 220, 50',    // 内层火焰颜色（黄）
        innerAlpha: 0.9,               // 内层火焰透明度系数（× 闪烁）
        smokeColor: '30, 30, 30',      // 低血量黑烟粒子颜色
        smokeAlphaBase: 0.5,           // 黑烟透明度基础值
        smokeAlphaRange: 0.4,          // 黑烟透明度随烟雾强度增长
      },
      // 【怪物技能】自爆引信脉冲点（isFused 头顶红点）
      suicideFuse: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        color: '255, 60, 0',           // 引信颜色（红橙）
        alphaBase: 0.5,                // 透明度基础值
        alphaPulseAmp: 0.5,            // 透明度脉冲幅度
      },
      // 【怪物技能】Boss 动作覆盖辉光（蓄力橙红 / 召唤紫）
      bossOverlay: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        chargeColor: '255, 60, 0',     // 蓄力辉光颜色（橙红）
        chargeAlphaBase: 0.15,         // 蓄力透明度基础值
        chargeAlphaAmp: 0.1,           // 蓄力透明度脉冲幅度
        summonColor: '168, 85, 247',   // 召唤辉光颜色（紫）
        summonAlphaBase: 0.1,          // 召唤透明度基础值
        summonAlphaAmp: 0.08,          // 召唤透明度脉冲幅度
      },
      // 【怪物技能】Boss 受击红闪覆盖（仅覆盖贴图区域）
      bossDamageFlash: {
        blend: 'source-atop' as GlobalCompositeOperation, // 叠加混合
        color: '255, 0, 0',            // 红闪颜色
        alphaMax: 0.6,                 // 透明度上限
        alphaScale: 0.3,               // 透明度系数（× damageFlash）
      },
      // 【怪物技能】狂暴指示环（isEnraged 红色双层脉冲环）
      enrageIndicator: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        color: '239, 68, 68',          // 指示环颜色（红）
        ringAlpha: 0.6,                // 内环透明度
        pulseAlphaScale: 0.4,          // 外脉冲环透明度系数（× pulse）
      },
      // 【怪物状态】眩晕电光（isStunned 冰蓝折线 + 金色光晕）
      stunEffect: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        boltColor: '150, 220, 255',    // 电光折线颜色（冰蓝）
        boltAlphaBase: 0.5,            // 电光透明度基础值
        boltAlphaPulse: 0.4,           // 电光透明度脉冲幅度
        boltGlowColor: '250, 200, 50', // 电光外发光颜色（金）
        boltGlowAlpha: 0.8,            // 电光外发光透明度
        haloColor: '250, 200, 50',     // 脚下光晕颜色（金）
        haloAlphaBase: 0.15,           // 光晕透明度基础值
        haloAlphaPulse: 0.1,           // 光晕透明度脉冲幅度
      },
      // 【怪物状态】中毒指示（poisonTimer 紫色脉冲圆）
      poisonIndicator: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        color: '150, 100, 255',        // 指示颜色（紫）
        alphaBase: 0.3,                // 透明度基础值
        alphaPulseAmp: 0.2,            // 透明度脉冲幅度
      },
    },
    // 渲染工具函数参数
    renderUtils: {
      // 【喷火枪】枪口火焰渲染（火力全开强化喷射）
      muzzleFlash: {
        blend: 'screen' as GlobalCompositeOperation, // 叠加混合
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
      // 【掉落道具】雷达激光渲染
      radarLaser: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
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
      // 【掉落道具】电蚊拍渲染
      swatter: {
        blend: 'screen' as GlobalCompositeOperation, // 叠加混合
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
      // 【掉落道具】杀虫剂喷雾渲染
      insecticide: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        sprayConeColor0: 'rgba(80, 255, 100, 0.5)',   // 喷雾锥形渐变 stop0（中心亮绿）
        sprayConeColor1: 'rgba(60, 220, 80, 0.3)',    // 喷雾锥形渐变 stop0.4
        sprayConeColor2: 'rgba(40, 180, 60, 0.15)',   // 喷雾锥形渐变 stop0.7
        sprayConeColor3: 'rgba(20, 120, 40, 0)',      // 喷雾锥形渐变 stop1（边缘透明）
        nozzleGlowColor0: 'rgba(150, 255, 150, 0.8)', // 喷嘴辉光渐变 stop0
        nozzleGlowColor1: 'rgba(50, 200, 50, 0)',     // 喷嘴辉光渐变 stop1
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
        // 喷雾粒子颜色随机范围（InsecticideSystem 生成；rgba 各通道 min + random×range）
        particles: {
          // 主喷雾粒子（alpha 使用 items.ts insecticide.particleAlphaMin/Max）
          spray: { rMin: 50, rRange: 30, gMin: 180, gRange: 60, bMin: 50, bRange: 20 },
          // 细雾滴粒子（亮绿）
          mist: { rMin: 120, rRange: 40, g: 255, bMin: 120, bRange: 40, alphaMin: 0.5, alphaRange: 0.3 },
          // 喷嘴爆发粒子
          nozzle: { rMin: 100, rRange: 30, g: 240, bMin: 100, bRange: 20, alphaMin: 0.6, alphaRange: 0.3 },
          // 消散粒子（喷雾结束时）
          fadeOut: { rMin: 60, rRange: 30, gMin: 160, gRange: 50, bMin: 60, bRange: 20, alphaMin: 0.2, alphaRange: 0.2 },
          // 命中粒子
          hit: { rMin: 80, rRange: 40, g: 220, bMin: 80, bRange: 20, alpha: 0.7 },
        },
      },
      // 道具放置渲染
      itemPlacement: {
        blend: 'screen' as GlobalCompositeOperation, // 叠加混合
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
      // 【商店道具】防线渲染（含临时护盾辉光）
      defenseLine: {
        blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
        lineWidth: 3,            // 防线线宽（像素）
        dash: [12, 8] as readonly number[], // 虚线样式
        dashSpeed: 30,           // 虚线流动速度
        fillAlpha: 0.08,         // 填充透明度
        fillHeight: 25,          // 填充高度（像素）
        labelFont: 'bold 13px sans-serif', // 标签字体
        labelColor: '255, 255, 255', // 标签颜色（配合 labelAlpha）
        labelAlpha: 0.25,        // 标签透明度
        labelOffsetY: -8,        // 标签 Y 偏移
        shieldBlend: 'source-over' as GlobalCompositeOperation, // 护盾线叠加混合
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
      // 【掉落道具】投掷物渲染（燃烧瓶尾迹）
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

  // ======================================================================
  // 【掉落道具】毒雾粒子（毒气弹爆炸后产生的毒雾效果）
  // ======================================================================
  poisonCloud: {
    // --- 发射器 ---
    emitter: {
      mode: 'burst',
      particleCount: 20,         // 粒子总数
    },
    // --- 粒子 ---
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

  // ======================================================================
  // 【商店道具】风扇系统（强力风扇：全场减速，将蟑螂吹退）
  // 注：pushForce / defaultSlowFactor / effects 减速表同时影响游戏平衡
  // ======================================================================
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
    // --- 发射器（固定数量元素持续循环动画） ---
    emitter: {
      mode: 'loop',
      waveCount: 18,             // 风扇波纹数量
      gustCount: 5,              // 阵风数量
      particleCount: 28,         // 风粒子数量
    },
    // --- 渲染 ---
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
    gustHeightBase: 45,          // 阵风基础高度（像素）
    gustHeightIncrement: 12,     // 阵风高度增量
    gustAlphaBase: 0.15,         // 阵风基础透明度
    gustSpeedBase: 0.5,          // 阵风基础速度
    gustSpeedIncrement: 0.3,     // 阵风速度增量
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
    // --- 颜色与叠加混合 ---
    blend: 'source-over' as GlobalCompositeOperation, // 整体叠加混合
    wavePrimaryColor: '#a78bfa',   // 波纹主色（紫色）
    waveSecondaryColor: '#c4b5fd', // 波纹辅色（浅紫）
    gustEdgeColor: 'rgba(167, 139, 250, 0)',      // 阵风渐变边缘色（全透明）
    gustMidColor: 'rgba(196, 181, 253, {alpha})', // 阵风渐变中间色（{alpha} 运行时替换）
    gustLineColor: '#e9d5ff',      // 阵风线条颜色（淡紫）
    particleLightColor: '#ddd6fe', // 风粒子亮色
    particleDarkColor: '#c4b5fd',  // 风粒子暗色
    sourceGlowInnerColor: 'rgba(167, 139, 250, {alpha})', // 风源发光内色
    sourceGlowMidColor: 'rgba(196, 181, 253, {alpha})',   // 风源发光中间色
    sourceGlowFadeColor: 'rgba(167, 139, 250, 0)',        // 风源发光渐隐色（全透明）
    iconBgColor: 'rgba(229, 231, 235, 0.9)',   // 图标背景色（灰白）
    iconStrokeColor: 'rgba(156, 163, 175, 0.8)', // 图标描边色（灰）
    iconBladeColor: '#60a5fa',     // 扇叶颜色（蓝色）
    iconCenterColor: '#4b5563',    // 图标中心色（灰色）
    iconPrimaryColor: '#a78bfa',   // 图标主色（计时器文字）
    iconBlowingColor: 'rgba(167, 139, 250, 0.7)', // 吹动状态文字颜色
  },

  // ======================================================================
  // 【怪物技能】粘液爆发（变异蟑螂出生时的绿色酸液喷发，engine.ts 渲染）
  // ======================================================================
  slimeBurst: {
    duration: 1.2,               // 总时长（秒，RoachAISystem.slimeBurstTimer 初始值）
    alphaFade: 0.8,              // 透明度衰减系数（alpha = 1 - progress × 此值）
    // 1. 中央绿色辉光
    glowRadiusBase: 20,          // 辉光基础半径（像素）
    glowRadiusGrowth: 80,        // 辉光半径随进度增长（像素）
    glowColorInner: '100, 240, 100',  // 辉光中心颜色
    glowAlphaInner: 0.6,         // 辉光中心透明度系数
    glowColorMid: '60, 200, 60', // 辉光中间颜色
    glowAlphaMid: 0.4,           // 辉光中间透明度系数
    glowMidStop: 0.5,            // 辉光中间色标位置（0~1）
    glowColorEdge: '40, 120, 40',   // 辉光边缘颜色
    // 2. 粘液滴（向外扩散）
    // --- 发射器 ---
    emitter: {
      mode: 'burst',
      dropCount: 12,             // 液滴数量
      dropAngleJitter: 0.7,      // 液滴角度抖动（弧度，baseAngle + di × 此值）
    },
    // --- 粒子 ---
    dropSpreadDist: 60,          // 液滴最大扩散距离（像素，× progress）
    dropYScale: 0.5,             // 液滴 Y 轴压扁比例
    dropSizeBase: 5,             // 液滴基础大小（像素）
    dropSizeStep: 3,             // 液滴大小阶梯（di % 3 × 此值）
    dropSizeFade: 0.3,           // 液滴大小随进度衰减（1 - progress × 此值）
    dropAlphaBase: 0.7,          // 液滴基础透明度系数
    dropAlphaStep: 0.1,          // 液滴透明度阶梯（di % 3 × 此值）
    dropGlowScale: 2,            // 液滴辉光半径倍率（× dropSize）
    dropGlowAlpha: 0.5,          // 液滴辉光透明度系数
    dropGlowColor: '120, 255, 120',   // 液滴辉光颜色
    dropGlowEdgeColor: '60, 180, 60', // 液滴辉光边缘颜色
    dropCoreColor: '80, 220, 80',     // 液滴实心核颜色
    // 3. 外圈粘液环
    ringRadiusBase: 15,          // 环基础半径（像素）
    ringRadiusGrowth: 50,        // 环半径随进度增长（像素）
    ringYScale: 0.4,             // 环 Y 轴压扁比例
    ringColor: '100, 255, 130',  // 环颜色
    ringAlpha: 0.5,              // 环透明度系数
    ringLineWidth: 3,            // 环线宽
  },

  // ======================================================================
  // 【怪物技能】治疗增益光环（护士治疗命中目标后的上升 + 号特效，engine.ts 渲染）
  // ======================================================================
  healBuff: {
    duration: 2.0,               // BUFF 总时长（秒，与 healBuffTimer 初始值一致）
    baseAlphaMax: 0.9,           // 基础透明度上限（× buffProgress）
    // 1. 大型绿色辉光
    haloRadiusRatio: 0.8,        // 辉光半径（× 蟑螂尺寸）
    haloColorInner: '100, 255, 120',  // 辉光中心颜色
    haloAlphaInner: 0.25,        // 辉光中心透明度系数
    haloColorMid: '60, 220, 80', // 辉光中间颜色
    haloAlphaMid: 0.4,           // 辉光中间透明度系数
    haloMidStop: 0.5,            // 辉光中间色标位置
    haloColorEdge: '40, 150, 60',   // 辉光边缘颜色
    haloYScale: 0.5,             // 辉光 Y 轴压扁（haloR×2, haloR 椭圆）
    // 2. 外部脉冲光环
    ringRadiusBase: 0.6,         // 环半径基础值（× 蟑螂尺寸）
    ringRadiusAmp: 0.15,         // 环半径脉冲幅度
    ringPulseFreq: 4,            // 环脉冲频率
    ringColor: '120, 255, 160',  // 环颜色
    ringAlpha: 0.6,              // 环透明度系数
    ringLineWidth: 2.5,          // 环线宽
    ringShadowColor: '100, 255, 140', // 环阴影颜色
    ringShadowBlur: 15,          // 环阴影模糊
    ringYScale: 0.5,             // 环 Y 轴压扁比例
    // 3. 上升旋转 + 号
    // --- 发射器（固定数量 + 号持续循环） ---
    emitter: {
      mode: 'loop',
      plusCount: 4,              // + 号数量
      plusCycle: 2.0,            // 单个 + 号循环周期（秒）
      plusOrbitSpread: 1.57,     // + 号间轨道角度间隔（弧度，≈ π/2）
    },
    // --- 粒子 ---
    plusIdPhase: 0.5,            // + 号相位按蟑螂 id 抖动系数（r.id × 此值）
    plusRiseHeight: 55,          // 上升高度（像素）
    plusOrbitSpeed: 2,           // 轨道角速度
    plusOrbitRadius: 16,         // 轨道半径基础（像素）
    plusOrbitBase: 0.4,          // 轨道半径起始比例
    plusAlphaRiseRate: 3,        // + 号淡入速率（riseProgress × 此值，封顶 1）
    plusAlphaFallExp: 2,         // + 号淡出指数（1 - riseProgress^此值）
    plusAlphaMin: 0.02,          // + 号最小可见透明度（低于则跳过绘制）
    plusSizeBase: 14,            // + 号基础大小（像素）
    plusSizeGrowth: 14,          // + 号随上升增长（像素）
    plusRotateSpeed: 2,          // + 号旋转速度
    plusRotateAmp: 0.2,          // + 号旋转幅度（弧度）
    plusGlowColor: '80, 255, 120',    // + 号外发光颜色
    plusGlowBlur: 20,            // + 号外发光模糊
    plusColor: '100, 255, 150',       // + 号主体颜色
    plusBarWidthRatio: 0.32,     // + 号横竖条宽度比例（× plusSize）
    plusBarWidthMin: 3.5,        // + 号条宽最小值（像素）
    plusCenterScale: 1.6,        // 白芯大小倍率（× barW）
    plusCenterColor: '230, 255, 240', // 白芯颜色
    plusCenterAlpha: 0.9,        // 白芯透明度系数
    plusCenterGlowColor: '200, 255, 220', // 白芯发光颜色
    plusCenterGlowBlur: 8,       // 白芯发光模糊
    // 4. 身体绿色染色
    tintColor: '80, 200, 80',    // 染色颜色
    tintAlpha: 0.3,              // 染色透明度系数
    tintWRatio: 0.52,            // 染色宽度比例（× 蟑螂尺寸）
    tintHRatio: 0.37,            // 染色高度比例（× 蟑螂尺寸）
  },

  // ======================================================================
  // 【怪物技能】定时自爆蟑螂"螂家爆破"全阶段视觉（RoachRenderer 阶段表现 + engine 放置/尸体炸弹）
  // ======================================================================
  timedBomb: {
    // ---- 阶段 1：预警（warning，背部红灯 + 地面危险圈 + 抖动倒计时） ----
    warning: {
      blinkFreq: 18,             // 红灯闪烁频率（sin 判定 > 0 为亮）
      blinkOffAlpha: 0.3,        // 红灯灭态透明度
      lightColor: '180, 40, 40', // 红灯颜色
      lightRadius: 5,            // 红灯半径（像素）
      lightYRatio: 0.35,         // 红灯 Y 偏移（× 体高，背上）
      circleYRatio: 0.4,         // 危险圈 Y 偏移（× 体高，脚下）
      circleColor: '140, 30, 30',     // 危险圈颜色
      circleAlpha: 0.6,          // 危险圈透明度
      circleLineWidth: 2,        // 危险圈线宽
      circleDash: [3, 4] as readonly number[], // 危险圈虚线样式
      circleDashSpeed: 20,       // 危险圈虚线滚动速度
      circleRadiusX: 40,         // 危险圈 X 半径（像素）
      circleRadiusY: 20,         // 危险圈 Y 半径（像素）
      circleRoughFreq: 5,        // 危险圈不规则波动频率
      circleRoughAmp: 0.12,      // 危险圈不规则幅度
      circleAngleStep: 0.3,      // 危险圈描点角度步进（弧度）
      jitterXFreq: 50,           // 倒计时数字 X 抖动频率
      jitterXAmp: 0.8,           // 倒计时数字 X 抖动幅度（像素）
      jitterYFreq: 45,           // 倒计时数字 Y 抖动频率
      jitterYAmp: 0.6,           // 倒计时数字 Y 抖动幅度（像素）
      countdownYRatio: 0.6,      // 倒计时数字 Y 偏移（× 体高，头顶）
    },
    // ---- 阶段 2：蹲伏（crouching，身体压扁 + 裂缝蔓延 + 震颤 + 放大倒计时） ----
    crouching: {
      squashX: 1.3,              // 身体横向压扁比例
      squashY: 0.7,              // 身体纵向压扁比例
      blinkFreq: 18,             // 红灯闪烁频率
      blinkOffAlpha: 0.2,        // 红灯灭态透明度
      lightColor: '200, 30, 30', // 红灯颜色
      lightRadius: 6,            // 红灯半径（像素）
      lightYRatio: 0.25,         // 红灯 Y 偏移（× 体高）
      crackYRatio: 0.45,         // 裂缝起点 Y 偏移（× 体高）
      crackColor: '120, 40, 40', // 裂缝颜色
      crackAlpha: 0.5,           // 裂缝透明度
      crackLineWidth: 1.5,       // 裂缝线宽
      crackCount: 5,             // 裂缝数量
      crackIdJitter: 0.7,        // 裂缝角度 id 抖动（弧度）
      crackLenBase: 0.5,         // 裂缝长度基础比例（× crackRadius）
      crackLenAmp: 0.3,          // 裂缝长度波动幅度
      crackLenFreq: 2.3,         // 裂缝长度波动频率
      crackSteps: 4,             // 裂缝分段数
      crackAngleStep: 0.1,       // 裂缝每段角度偏移（弧度）
      crackYScale: 0.5,          // 裂缝 Y 轴压扁比例
      tremorFreq: 18,            // 身体震颤频率
      tremorAmp: 2,              // 身体震颤幅度（像素）
      countdownYRatio: 0.8,      // 倒计时数字 Y 偏移（× 体高）
      countdownLineWidth: 3,     // 倒计时描边宽度
    },
    // ---- 阶段 3：爆炸帧（exploding，暗红剪影扩张） ----
    exploding: {
      duration: 0.1,             // 扩张时长（秒）
      maxScale: 1.2,             // 剪影最大扩张倍率
      silhouetteColor: '100, 20, 20', // 剪影颜色
      silhouetteAlpha: 0.8,      // 剪影起始透明度
      silhouetteWRatio: 0.5,     // 剪影宽度比例（× 体宽）
      silhouetteHRatio: 0.35,    // 剪影高度比例（× 体高）
    },
    // ---- 阶段 4：残留焦痕（residue，世界坐标地面焦痕 + 碎片 + 青烟） ----
    residue: {
      fadeDuration: 3.0,         // 淡出时长（秒，渲染侧视觉时长）
      scorchColor: '25, 18, 15', // 焦痕颜色
      scorchAlpha: 0.7,          // 焦痕基础透明度
      scorchRadius: 40,          // 焦痕基础半径（像素）
      scorchYScale: 0.6,         // 焦痕 Y 轴压扁比例
      scorchRoughFreq: 4,        // 焦痕边缘不规则频率
      scorchRoughAmp: 0.2,       // 焦痕边缘不规则幅度
      scorchIdPhase: 2,          // 焦痕边缘按蟑螂 id 相位抖动系数（r.id × 此值）
      scorchAngleStep: 0.25,     // 焦痕描点角度步进（弧度）
      fragColor: '60, 55, 55',   // 齿轮/弹簧碎片颜色
      fragAlpha: 0.5,            // 碎片基础透明度
      smokeThreshold: 1.5,       // 青烟出现的残留计时阈值（秒）
      smokeFadeDuration: 1.5,    // 青烟淡入时长（秒）
      smokeAlpha: 0.3,           // 青烟最大透明度系数
      smokeColor: '80, 75, 75',  // 青烟颜色
      smokeBaseY: 30,            // 青烟基础 Y 偏移（像素）
      smokeRiseSpeed: 15,        // 青烟上升速度（像素/秒）
      smokeWidth: 4,             // 青烟宽度（像素）
      smokeHeight: 12,           // 青烟高度（像素）
    },
    // ---- 放置炸弹渲染（engine.ts：火焰辉光 + bomb.png + 缩放倒计时 + 紧急闪烁环） ----
    placed: {
      bombSize: 64,              // 炸弹贴图尺寸（像素）
      fuseDuration: 3,           // 引信时长（秒，urgency 进度基准）
      glowRadiusRatio: 0.8,      // 辉光基础半径（× bombSize）
      glowRadiusUrgency: 20,     // 辉光随紧急度增长（像素）
      glowPulseFreq: 10,         // 辉光脉冲频率
      glowPulseAmp: 5,           // 辉光脉冲幅度（像素，× urgency）
      glowInnerRatio: 0.3,       // 辉光内径比例（× bombSize）
      glowAlphaBase: 0.15,       // 辉光基础透明度
      glowAlphaUrgency: 0.35,    // 辉光随紧急度透明度增长
      glowColorInner: '255, 200, 50',  // 辉光中心颜色
      glowColorMid: '255, 100, 20',    // 辉光中间颜色
      glowMidAlphaRatio: 0.6,    // 辉光中间透明度比例
      glowColorEdge: '255, 50, 0',     // 辉光边缘颜色
      fallbackColor: '#f59e0b',  // 贴图缺失时的回退颜色
      fallbackRadiusRatio: 3,    // 回退圆形半径除数（bombSize / 此值）
      countdownScaleBase: 1.8,   // 倒计时基础缩放
      countdownScaleUrgency: 1.5,// 倒计时随紧急度缩放增长
      countdownFont: 'bold 42px sans-serif', // 倒计时字体
      countdownColor: '#ffaa00', // 倒计时常态颜色
      countdownUrgentColor: '#ff0000', // 倒计时紧急颜色（最后 1 秒）
      countdownStrokeColor: '#000000', // 倒计时描边颜色
      countdownLineWidth: 3,     // 倒计时描边宽度
      countdownShadowColor: 'rgba(255,0,0,0.8)', // 倒计时阴影颜色
      countdownShadowBlur: 10,   // 倒计时阴影模糊
      countdownYOffset: 20,      // 倒计时相对炸弹顶部的额外 Y 偏移（像素）
      urgentThreshold: 1,        // 紧急状态阈值（秒，剩余时间 ≤ 此值）
      flashColor: '239, 68, 68', // 紧急闪烁环颜色
      flashAlphaBase: 0.3,       // 紧急闪烁环基础透明度
      flashAlphaAmp: 0.2,        // 紧急闪烁环透明度幅度
      flashFreq: 15,             // 紧急闪烁频率
      flashLineWidth: 2,         // 紧急闪烁环线宽
      flashRadiusRatio: 0.7,     // 紧急闪烁环半径（× pulseRadius）
    },
    // ---- 尸体炸弹渲染（engine.ts：红闪尸体 + 骷髅 + 倒计时） ----
    corpse: {
      flashBase: 0.4,            // 闪烁基础强度
      flashAmp: 0.3,             // 闪烁幅度
      flashFreq: 8,              // 闪烁频率（× flashPhase）
      corpseRadius: 22,          // 尸体半径（像素）
      glowInnerRatio: 0.5,       // 辉光内径比例（× corpseRadius）
      glowOuterRatio: 1.8,       // 辉光外径比例（× corpseRadius）
      glowColorInner: '239, 68, 68',   // 辉光中心颜色
      glowAlphaInnerBase: 0.3,   // 辉光中心基础透明度
      glowAlphaInnerAmp: 0.4,    // 辉光中心透明度随闪烁幅度
      glowColorMid: '220, 38, 38',     // 辉光中间颜色
      glowAlphaMidBase: 0.2,     // 辉光中间基础透明度
      glowAlphaMidAmp: 0.3,      // 辉光中间透明度随闪烁幅度
      glowColorEdge: '153, 27, 27',    // 辉光边缘颜色
      bodyColor: '120, 20, 20',  // 尸体颜色
      bodyAlphaBase: 0.85,       // 尸体基础透明度
      bodyAlphaAmp: 0.15,        // 尸体透明度随闪烁幅度
      bodyYScale: 0.7,           // 尸体 Y 轴压扁比例
      bodyYOffset: 4,            // 尸体 Y 偏移（像素）
      borderColor: '239, 68, 68',      // 尸体描边颜色
      borderAlphaBase: 0.6,      // 描边基础透明度
      borderAlphaAmp: 0.4,       // 描边透明度随闪烁幅度
      borderLineWidth: 2,        // 描边宽度
      skullFont: 'bold 14px sans-serif', // 骷髅图标字体
      skullColor: '255, 100, 100',     // 骷髅图标颜色
      skullAlphaBase: 0.7,       // 骷髅基础透明度
      skullAlphaAmp: 0.3,        // 骷髅透明度随闪烁幅度
      skullYOffset: 2,           // 骷髅 Y 偏移（像素）
      countdownFontSize: 22,     // 倒计时基础字号（像素）
      countdownColor: '#fbbf24', // 倒计时常态颜色
      countdownUrgentColor: '#ef4444', // 倒计时紧急颜色
      countdownPulseAmp: 0.3,    // 倒计时紧急脉冲幅度
      countdownPulseFreq: 12,    // 倒计时紧急脉冲频率（× flashPhase）
      countdownShadowColor: 'rgba(0,0,0,0.9)', // 倒计时阴影颜色
      countdownShadowBlur: 6,    // 倒计时阴影模糊
      countdownYOffset: 12,      // 倒计时相对尸体顶部的额外 Y 偏移（像素）
      urgentThreshold: 1,        // 紧急状态阈值（秒）
    },
    // ---- 尸体炸弹倒计时粒子（engine.ts 更新循环：红闪火花 + 最后 1 秒红光爆闪） ----
    corpseFlash: {
      // --- 发射器 ---
      emitter: {
        mode: 'chance',
        countdownThreshold: 3,   // 红闪出现的剩余时间阈值（秒）
        sparkChance: 0.5,        // 每帧火花生成概率
        sparkOffsetXBase: 15,    // 火花生成 X 偏移基础（像素）
        sparkOffsetXRange: 10,   // 火花生成 X 偏移随机范围
        sparkOffsetYBase: 10,    // 火花生成 Y 偏移基础（像素）
        sparkOffsetYRange: 5,    // 火花生成 Y 偏移随机范围
        burstThreshold: 1,       // 红光爆闪剩余时间阈值（秒）
        burstIntensityMin: 0.7,  // 红光爆闪闪烁强度阈值（高于才生成）
      },
      // --- 渲染/粒子 ---
      flashFreq: 10,             // 闪烁频率（× flashPhase）
      sparkSpeedMin: 20,         // 火花最小速度（像素/秒）
      sparkSpeedRange: 40,       // 火花速度随机范围
      sparkVyBias: -20,          // 火花垂直速度偏移（向上）
      sparkLifeMin: 0.3,         // 火花最小存活时间（秒）
      sparkLifeRange: 0.3,       // 火花存活时间随机范围
      sparkMaxLife: 0.6,         // 火花最大存活时间（秒）
      sparkSizeMin: 2,           // 火花最小大小（像素）
      sparkSizeRange: 4,         // 火花大小随机范围
      sparkGBase: 20,            // 火花绿色分量基础值（+ flashIntensity × gRange）
      sparkGRange: 40,           // 火花绿色分量范围
      sparkAlphaBase: 0.6,       // 火花基础透明度（+ flashIntensity × alphaRange）
      sparkAlphaRange: 0.4,      // 火花透明度范围
      burstLife: 0.1,            // 红光爆闪存活时间（秒）
      burstSizeMin: 60,          // 红光爆闪最小大小（像素）
      burstSizeRange: 40,        // 红光爆闪大小随机范围
      burstAlphaBase: 0.15,      // 红光爆闪基础透明度（+ flashIntensity × alphaRange）
      burstAlphaRange: 0.15,     // 红光爆闪透明度范围
      warnThreshold: 0.5,        // 预警浮动文字剩余时间阈值（秒）
      warnBlinkRate: 6,          // 预警闪烁速率（floor(timer × 此值) % 2 判定）
    },
  },

  // ======================================================================
  // 【怪物技能】爆炸闪光+碎片（定时自爆突破爆炸 / 放置炸弹爆炸共用，engine.ts 两处 + 编辑器复刻）
  // ======================================================================
  bombExplosion: {
    // 火焰闪光覆盖（3 层叠加）
    flash: {
      // --- 发射器 ---
      emitter: {
        mode: 'burst',
        layers: 3,               // 闪光层数
        offsetX: 30,             // 生成 X 抖动范围（像素）
        offsetY: 20,             // 生成 Y 抖动范围（像素）
      },
      // --- 粒子 ---
      lifeBase: 0.2,             // 基础存活时间（秒）
      lifeStep: 0.1,             // 每层存活时间增量（秒）
      sizeBase: 60,              // 基础大小（像素）
      sizeStep: 30,              // 每层大小增量（像素）
      colorR: 255,               // 红色分量
      colorGBase: 180,           // 绿色分量基础值（每层 - gStep）
      colorGStep: 40,            // 绿色分量每层递减
      colorBBase: 50,            // 蓝色分量基础值（每层 - bStep）
      colorBStep: 20,            // 蓝色分量每层递减
      alphaBase: 0.5,            // 基础透明度（每层 - alphaStep）
      alphaStep: 0.1,            // 透明度每层递减
    },
    // 碎片（环形飞溅）
    debris: {
      // --- 发射器 ---
      emitter: {
        mode: 'burst',
        count: 15,               // 碎片数量
        angleJitter: 0.3,        // 角度随机抖动（弧度）
      },
      // --- 粒子 ---
      speedMin: 100,             // 最小速度（像素/秒）
      speedRange: 150,           // 速度随机范围
      vyBias: -30,               // 垂直速度偏移（向上）
      lifeMin: 0.8,              // 最小存活时间（秒）
      lifeRange: 0.5,            // 存活时间随机范围
      maxLife: 1.3,              // 最大存活时间（秒）
      sizeMin: 3,                // 最小大小（像素）
      sizeRange: 6,              // 大小随机范围
      colorRBase: 200,           // 红色分量基础值
      colorRRange: 55,           // 红色分量随机范围
      colorGBase: 100,           // 绿色分量基础值
      colorGRange: 80,           // 绿色分量随机范围
      alpha: 0.9,                // 透明度
    },
  },

  // ======================================================================
  // 【商店道具】诱饵（投掷动画/碎裂粒子/持续气味/地面光环，ConsumableSystem）
  // 注：投掷时长/高度在 items.ts consumable.baitThrowAnimDuration/Height（逻辑参数）
  // ======================================================================
  bait: {
    // 持续气味粒子（每帧生成）
    smell: {
      // --- 发射器 ---
      emitter: {
        mode: 'perFrame',
        perFrame: 2,             // 每帧生成数量
        spreadX: 30,             // 生成 X 散布范围（像素）
        spreadY: 10,             // 生成 Y 散布范围（像素，向上）
      },
      // --- 粒子 ---
      vxRange: 8,                // 水平速度范围（像素/秒）
      vyMin: 15,                 // 上升速度基础（像素/秒）
      vyRange: 20,               // 上升速度随机范围
      lifeMin: 1.2,              // 最小存活时间（秒）
      lifeRange: 0.8,            // 存活时间随机范围
      maxLife: 2,                // 最大存活时间（秒）
      color: '#fbbf24',          // 主颜色（金色，50% 概率）
      colorAlt: '#fcd34d',       // 交替颜色（50% 概率）
      sizeMin: 2,                // 最小大小（像素）
      sizeRange: 2.5,            // 大小随机范围
    },
    // 落地碎裂粒子（黄色爆裂 + 玻璃碎片）
    shatter: {
      // --- 发射器 ---
      emitter: {
        mode: 'burst',
        burstCount: 15,          // 黄色爆裂粒子数量
        burstSpreadDist: 60,     // 爆裂散布半径（像素）
        burstYScale: 0.3,        // 爆裂散布 Y 轴压扁比例
        glassCount: 8,           // 玻璃碎片数量
      },
      // --- 粒子 ---
      burstVxMin: 30,            // 爆裂水平速度基础（像素/秒）
      burstVxRange: 40,          // 爆裂水平速度随机范围
      burstVyMin: 15,            // 爆裂垂直速度基础（像素/秒）
      burstVyRange: 25,          // 爆裂垂直速度随机范围
      burstVyBias: -20,          // 爆裂垂直速度偏移（向上）
      burstLifeMin: 1.5,         // 爆裂最小存活时间（秒）
      burstLifeRange: 1,         // 爆裂存活时间随机范围
      burstMaxLife: 2.5,         // 爆裂最大存活时间（秒）
      burstSizeMin: 2,           // 爆裂最小大小（像素）
      burstSizeRange: 3,         // 爆裂大小随机范围
      burstColor: '#fbbf24',     // 爆裂粒子颜色（金色）
      glassVxMin: 40,            // 碎片水平速度基础（像素/秒）
      glassVxRange: 60,          // 碎片水平速度随机范围
      glassVyMin: 20,            // 碎片垂直速度基础（像素/秒）
      glassVyRange: 30,          // 碎片垂直速度随机范围
      glassVyBias: -30,          // 碎片垂直速度偏移（向上）
      glassLifeMin: 1,           // 碎片最小存活时间（秒）
      glassLifeRange: 0.8,       // 碎片存活时间随机范围
      glassMaxLife: 1.8,         // 碎片最大存活时间（秒）
      glassColor: '#e5e7eb',     // 碎片颜色
      glassSizeMin: 1,           // 碎片最小大小（像素）
      glassSizeRange: 2,         // 碎片大小随机范围
    },
    // 投掷渲染（玻璃罐飞行 + 地面阴影 + 拖尾点）
    throw: {
      blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
      shadowColor: '#000',       // 地面阴影颜色
      jarColor: '#78350f',       // 罐身颜色（深棕）
      rimColor: '#92400e',       // 罐口颜色（棕色）
      accentColor: '#57534e',    // 罐子装饰条颜色（灰色）
      labelColor: '#fbbf24',     // 罐身标签颜色（金色）
      glintColor: '#fff',        // 高光点颜色
      trailColor: '#fbbf24',     // 拖尾点颜色（金色）
      shadowMinScale: 0.3,       // 阴影最小缩放
      shadowHeightRef: 200,      // 阴影缩放参考高度（像素）
      shadowAlpha: 0.2,          // 阴影透明度
      shadowRadiusX: 10,         // 阴影 X 半径（× shadowScale）
      shadowRadiusY: 4,          // 阴影 Y 半径（× shadowScale）
      jarW: 14,                  // 罐体宽度（像素）
      jarH: 18,                  // 罐体高度（像素）
      jarCorner: 4,              // 罐体圆角（像素）
      rimInset: 2,               // 罐口内缩（像素）
      rimShrink: 6,              // 罐口尺寸缩减（像素）
      rimCorner: 2,              // 罐口圆角（像素）
      accentHeight: 5,           // 顶部装饰条高度（像素）
      accentOverhang: 1,         // 装饰条横向外扩（像素）
      accentOffsetY: 3,          // 装饰条 Y 偏移（像素）
      labelHeight: 4,            // 罐身标签高度（像素）
      labelInset: 1,             // 标签内缩（像素）
      labelShrink: 2,            // 标签宽度缩减（像素）
      labelOffsetY: 2,           // 标签 Y 偏移（像素）
      glintX: -3,                // 高光点 X 偏移（像素）
      glintY: -3,                // 高光点 Y 偏移（像素）
      glintRadius: 1.5,          // 高光点半径（像素）
      glintAlphaBase: 0.6,       // 高光基础透明度
      glintAlphaAmp: 0.4,        // 高光透明度幅度
      glintFreq: 8,              // 高光闪烁频率
      // --- 发射器（拖尾点：固定数量沿飞行路径分布） ---
      emitter: {
        mode: 'loop',
        trailCount: 3,           // 拖尾点数量
      },
      trailDecay: 0.15,          // 拖尾逐点衰减（× t）
      trailDistRatio: 0.3,       // 拖尾点距离比例（× 位移）
      trailAlpha: 0.4,           // 拖尾基础透明度（× 1-t）
      trailRadiusBase: 2,        // 拖尾点半径基础（像素）
      trailRadiusDecay: 0.5,     // 拖尾点半径逐点衰减（× t）
    },
    // 地面标记渲染（香味光环 + 环绕玻璃碎片）
    mark: {
      blend: 'source-over' as GlobalCompositeOperation, // 叠加混合
      shardColor: '#c0c8d8',     // 环绕玻璃碎片颜色（浅灰蓝）
      pulseBase: 0.7,            // 光环脉冲基础值
      pulseAmp: 0.3,             // 光环脉冲幅度
      pulseFreq: 4,              // 光环脉冲频率
      auraRadiusX: 50,           // 光环 X 半径（× pulse）
      auraRadiusY: 20,           // 光环 Y 半径（× pulse）
      auraColor: '251, 191, 36', // 光环颜色
      auraAlphaInner: 0.25,      // 光环中心透明度
      auraAlphaMid: 0.1,         // 光环中间透明度
      auraMidStop: 0.5,          // 光环中间色标位置
      shardAlpha: 0.6,           // 碎片透明度（× baitTimer/baitDuration 渐隐）
      // --- 发射器（环绕碎片：固定数量持续环绕） ---
      emitter: {
        mode: 'loop',
        shardCount: 5,           // 环绕碎片数量
      },
      shardRotateSpeed: 0.5,     // 碎片环绕速度
      shardDistBase: 8,          // 碎片轨道半径基础（像素）
      shardDistAmp: 4,           // 碎片轨道半径波动（像素）
      shardDistFreq: 3,          // 碎片轨道波动频率（× i）
      shardYScale: 0.4,          // 碎片轨道 Y 轴压扁比例
      shardLen1: 4,              // 碎片第一边长度（像素）
      shardWid1: 2,              // 碎片第一边宽度（像素）
      shardAngle1: 0.3,          // 碎片第一边角度偏移（弧度）
      shardLen2: 3,              // 碎片第二边长度（像素）
      shardWid2: 1.5,            // 碎片第二边宽度（像素）
      shardAngle2: 0.2,          // 碎片第二边角度偏移（弧度）
    },
  },

  // ======================================================================
  // 火焰墙渲染（ParticleSystem.renderFireWalls：分段火柱 + 核心亮线 + 外辉光 + 余烬）
  // ======================================================================
  fireWall: {
    blend: 'screen' as GlobalCompositeOperation, // 叠加混合（火焰墙整体）
    alphaRamp: 1.5,              // 透明度渐入系数（min(1, lifeProgress × 此值)）
    minSegments: 10,             // 最小分段数
    segmentWidth: 15,            // 每段目标宽度（像素，墙宽 / 此值 = 分段数）
    edgeRatio: 0.18,             // 边缘柔化区间占比（两侧各 18% 宽度渐隐）
    flickerBase: 0.7,            // 火焰摇曳基础值
    flickerAmp: 0.3,             // 火焰摇曳幅度
    flickerFreq: 12,             // 火焰摇曳频率
    flickerPhaseStep: 2.5,       // 分段间相位步进
    heightBase: 2,               // 火焰高度基础系数（× wall.height × (此值 + flicker)）
    heightEdgeBase: 0.35,        // 边缘高度衰减基础（0.35 + 0.65 × edgeFade）
    heightEdgeAmp: 0.65,         // 边缘高度衰减幅度
    gradStop1Color: '255, 255, 100',  // 火焰渐变色 1（顶部黄白）
    gradStop1Alpha: 0.9,         // 渐变色 1 透明度系数
    gradStop2Color: '255, 180, 20',   // 火焰渐变色 2（橙黄）
    gradStop2Alpha: 0.85,        // 渐变色 2 透明度系数
    gradStop2Pos: 0.3,           // 渐变色 2 色标位置
    gradStop3Color: '255, 80, 10',    // 火焰渐变色 3（橙红）
    gradStop3Alpha: 0.7,         // 渐变色 3 透明度系数
    gradStop3Pos: 0.6,           // 渐变色 3 色标位置
    gradStop4Color: '200, 30, 5',     // 火焰渐变色 4（底部暗红）
    gradStop4Alpha: 0.3,         // 渐变色 4 透明度系数
    gradBottomYRatio: 0.3,       // 渐变底部 Y 比例（wall.y + h × 此值）
    segOverhang: 0.1,            // 分段横向外扩比例（× segW）
    segWidthScale: 1.2,          // 分段绘制宽度倍率（× segW，重叠消除缝隙）
    segYScale: 0.5,              // 分段 Y 轴位置比例（× h）
    coreColor: '255, 255, 220',  // 核心亮线颜色
    coreAlpha: 0.9,              // 核心亮线透明度系数
    coreLineWidth: 2,            // 核心亮线宽度
    glowColor: '255, 80, 10',    // 外辉光颜色
    glowAlpha: 0.25,             // 外辉光透明度系数
    glowHeight: 30,              // 外辉光高度（像素）
    glowOffsetY: 15,             // 外辉光 Y 偏移（像素）
    // --- 发射器（余烬：每帧生成） ---
    emitter: {
      mode: 'perFrame',
      emberCount: 3,             // 每帧余烬数量
      emberOffsetYBase: 5,       // 余烬生成 Y 偏移基础（像素）
      emberOffsetYRange: 15,     // 余烬生成 Y 偏移随机范围
    },
    // --- 粒子 ---
    emberSizeMin: 1,             // 余烬最小大小（像素）
    emberSizeRange: 2,           // 余烬大小随机范围
    emberGBase: 150,             // 余烬绿色分量基础值
    emberGRange: 100,            // 余烬绿色分量随机范围
    emberColorB: 30,             // 余烬蓝色分量
    emberAlphaMin: 0.5,          // 余烬基础透明度
    emberAlphaRange: 0.5,        // 余烬透明度随机范围
    labelColor: '255, 200, 100', // 时长标签颜色
    labelAlpha: 0.7,             // 时长标签透明度系数
    labelFont: 'bold 10px sans-serif', // 时长标签字体
    labelOffsetY: 20,            // 时长标签 Y 偏移（像素）
  },

  // ======================================================================
  // 天气系统（雨/雾粒子生成 + 渲染，engine.updateWeather / WeatherSystem）
  // ======================================================================
  weather: {
    // 雨天：顶部生成斜落雨滴，线段拖尾渲染
    rain: {
      // --- 发射器 ---
      emitter: {
        mode: 'chance',
        spawnRate: 0.4,                // 雨的生成速率（每秒概率，× deltaTime）
        spawnY: -10,                   // 生成 Y 位置（画布顶部上方，像素；X 为全屏随机）
      },
      // --- 粒子 ---
      vxMin: -20, vxRange: 10,        // 水平速度范围（像素/秒）
      vyMin: 200, vyRange: 100,       // 垂直速度范围（像素/秒）
      life: 2,                         // 雨滴存活时间（秒）
      sizeMin: 1, sizeRange: 1,       // 雨滴大小范围（像素）
      color: 'rgba(150, 180, 220, 0.4)', // 雨滴颜色
      renderAlpha: 0.4,                // 渲染透明度系数（life 衰减 α × 此值）
      renderLineWidth: 1,              // 雨滴线段宽度（像素）
      renderTailScale: 0.02,           // 拖尾长度系数（线段终点 = 位置 + 速度 × 此值）
      blend: 'source-over' as GlobalCompositeOperation, // 雨滴叠加混合方式
    },
    // 雾天：两侧生成缓慢漂移雾团，径向渐变渲染，存活期间持续膨胀
    fog: {
      // --- 发射器 ---
      emitter: {
        mode: 'chance',
        spawnRate: 0.05,               // 雾的生成速率（每秒概率，× deltaTime）
        spawnEdgeOffset: 20,           // 生成位置距左右画布边缘的外移距离（像素；Y 为全屏随机）
      },
      // --- 粒子 ---
      vxMin: 10, vxRange: 10,         // 水平速度范围（像素/秒）
      vyMin: -5, vyRange: 10,         // 垂直速度范围（像素/秒）
      lifeMin: 8, lifeRange: 4,       // 雾存活时间范围（秒）
      sizeMin: 30, sizeRange: 50,     // 雾团大小范围（像素）
      colorBase: '180, 180, 160',     // 雾颜色 RGB 基值
      alphaMin: 0.05, alphaRange: 0.05, // 雾透明度范围
      growthRate: 1.005,              // 雾团增长速率（每帧乘数）
      renderAlpha: 0.3,               // 渲染透明度系数（life 衰减 α × 此值）
      renderGradientEnd: 'rgba(180, 180, 160, 0)', // 雾团径向渐变外缘色
      blend: 'source-over' as GlobalCompositeOperation, // 雾团叠加混合方式
    },
    // 水滴/雨滴下落（下水道水滴、天台少量雨滴）：垂直下落，到达地面阻挡面
    // （SCENE_GROUND_BOUNDS 梯形区域）时消失并生成 RIPPLE 涟漪
    drip: {
      // --- 发射器 ---
      emitter: {
        mode: 'chance',
        sewerSpawnRate: 2.2,           // 下水道水滴生成速率（每秒概率，× deltaTime）
        rooftopSpawnRate: 0.7,         // 天台雨滴生成速率（少量，每秒概率 × deltaTime）
        rooftopSpeedMult: 1.5,         // 天台雨滴下落速度倍率（比下水道水滴更快）
        spawnY: -10,                   // 生成 Y 位置（画布顶部上方，像素）
      },
      // --- 粒子 ---
      vyMin: 340, vyRange: 160,        // 垂直下落速度范围（像素/秒）
      sizeMin: 1.2, sizeRange: 0.8,    // 水滴大小范围（像素）
      color: 'rgba(170, 200, 235, 0.55)', // 水滴颜色
      // --- 渲染 ---
      renderAlpha: 0.8,                // 渲染透明度系数（life 衰减 α × 此值）
      renderLineWidth: 1.5,            // 水滴线段宽度（像素）
      renderTailScale: 0.035,          // 拖尾长度系数（线段终点 = 位置 + 速度 × 此值）
      blend: 'source-over' as GlobalCompositeOperation, // 水滴叠加混合方式
    },
    // 地面涟漪：水滴落地后扩散的椭圆环，尺寸 = baseSize × 地面透视缩放（近大远小）
    ripple: {
      life: 0.9,                       // 涟漪存活时间（秒）
      baseSize: 14,                    // 基准扩散半径（像素，乘地面透视缩放）
      startRatio: 0.25,                // 起始半径比例（半径 = size × (startRatio + 扩散进度 × expand)）
      expand: 1.6,                     // 扩散倍数
      aspect: 0.38,                    // 椭圆纵横比（ry = rx × 此值，贴合地面透视）
      lineWidth: 1.5,                  // 涟漪线宽（像素）
      color: '190, 215, 240',          // 涟漪颜色（RGB）
      alpha: 0.55,                     // 涟漪基础透明度（随扩散渐隐）
      innerRingRatio: 0.55,            // 内环半径比例
      innerRingAlphaRatio: 0.6,        // 内环透明度比例
      blend: 'source-over' as GlobalCompositeOperation, // 涟漪叠加混合方式
    },
    // 地下室灯光闪烁：每 interval 秒触发一次 duration 秒的全屏黑色闪屏
    flicker: {
      interval: 60,                    // 闪烁间隔（秒）
      duration: 0.8,                   // 单次闪屏持续时长（秒）
      blinkFreq: 4.7,                  // 闪烁频率（Hz，非整数避免机械感）
      duty: 0.55,                      // 占空比（每个闪烁周期内黑屏所占比例）
      maxAlpha: 0.5,                   // 黑色叠加层最大透明度（50% 半透黑色）
    },
  },

  // ======================================================================
  // 闪电天气（夜晚场景：随机闪电 + 全屏白闪覆盖层 + 文字提示）
  // ======================================================================
  lightning: {
    // --- 发射器（定时调度：间隔计时 + 概率触发） ---
    emitter: {
      mode: 'interval',
      timerMin: 5,        // 闪电最小间隔（秒）
      timerRandMax: 10,   // 闪电随机间隔上限（秒）
      chance: 0.3,        // 每次计时器触发时闪电出现的概率（30%）
    },
    // --- 渲染 ---
    flashDuration: 0.4,   // 闪光持续时间（秒）
    textCooldown: 3,      // 闪电文字提示冷却时间（秒）
    flashAlpha: 0.5,      // 全屏白闪覆盖层透明度系数（flash 剩余 × 此值；轻微闪白）
    flashColor: '255, 255, 255', // 全屏闪光覆盖层颜色（RGB）
    flashBlend: 'source-over' as GlobalCompositeOperation, // 闪光覆盖层叠加混合方式
    textOffsetY: 100,     // 闪电文字提示 Y 偏移（画面中心上移，像素）
    // --- 闪电链（可见雷电折线，闪光期间绘制，随 flash 剩余渐隐） ---
    bolt: {
      segments: 11,         // 主链分段数
      jitterRatio: 0.09,    // 中段横向抖动幅度（× 画布宽）
      endYRatio: 0.62,      // 落点 Y（× 画布高）
      lineWidth: 3,         // 主链线宽（像素）
      branchChance: 0.4,    // 每个中段节点生成分支的概率
      branchLenRatio: 0.4,  // 分支长度（主链剩余高度 × 此值）
      branchWidth: 1.5,     // 分支线宽（像素）
      coreColor: '255, 255, 255',  // 主链核心颜色（RGB）
      glowColor: '140, 190, 255',  // 辉光颜色（RGB）
      glowBlur: 16,         // 辉光模糊半径（像素）
      haloWidthMult: 3.2,   // 外层辉光线宽倍率（× 主链线宽）
      haloBlurMult: 2.2,    // 外层辉光模糊倍率（× glowBlur）
      haloAlpha: 0.35,      // 外层辉光透明度（× flash 剩余比例）
      alpha: 0.95,          // 主链最大透明度（× flash 剩余比例）
      blend: 'lighter' as GlobalCompositeOperation, // 闪电链叠加混合方式
    },
  },
} as const;

// ======================================================================
// 气体护盾矩形保护区高度（像素，从护盾蟑螂本体下缘向上延伸）
// 说明：视觉（RoachRenderer 护盾范围框）与
//   逻辑（ShieldSystem 保护判定、FormationSystem 编队归位）共用同一数值，
//   集中存放于此便于特效调参；items.ts BALANCE_ITEMS.subway.shieldRectHeight
//   引用本常量，BALANCE_CONFIG.subway.shieldRectHeight 访问路径保持不变。
// ======================================================================
export const SHIELD_RECT_HEIGHT = 360;

// ======================================================================
// 护盾蟑螂气体护盾——半圆甲壳造型（RoachRenderer 常驻渲染，无状态确定性）
// 造型：半椭圆暗红发光甲壳（视觉 200×SHIELD_DOME_HEIGHT，与 ShieldSystem 实际保护区
//   判定 200×shieldRectHeight 解耦，半圆观感）；分段硬甲 = 放射肋条 × 同心环纹，缝隙透暗金微光，
//   段缘翘起带细高光；底部向两侧张开（外张沿超出半宽 flare），同类靠近时自动延展加宽。
// 动态：整体缓慢呼吸胀缩，缝隙金光按环纹相位错开明暗流转；
//   受击（shieldHitFlash）裂纹从击中点沿甲纹爬散、随后缝隙金光增强汇聚修补；
//   受损（shieldHp 比例下降）发光变暗、甲壳出现焦黑灼痕、壳缘碎屑剥落飘散。
//   items.ts BALANCE_ITEMS.subway.shieldDome* 引用本常量，访问路径保持不变。
// 注：SHIELD_BAND_HEIGHT 仍保留（破盾特效定位 / ParticleSpawner 碎裂散布范围 / ShieldSystem 回调用）。
// ======================================================================
export const SHIELD_BAND_HEIGHT = 80;          // 底部光带高度（像素，破盾特效/粒子散布定位沿用）

// --- 甲壳视觉尺寸（与实际保护区判定 200×360 解耦：宽 = 2×shieldRectHalfWidth，高 = 本值） ---
export const SHIELD_DOME_HEIGHT = 100;                    // 甲壳视觉高度（像素，200×100 半圆观感）

// --- 甲壳主体（暗红半透明，底部实 → 顶部渐隐，source-over） ---
export const SHIELD_DOME_FILL_COLOR = '153, 27, 27';      // 甲壳填充 RGB（#991b1b 暗红）
export const SHIELD_DOME_FILL_ALPHA_BOTTOM = 0.34;        // 底部填充透明度（× 受损变暗系数）
export const SHIELD_DOME_FILL_ALPHA_TOP = 0.10;           // 顶部填充透明度
export const SHIELD_DOME_RIM_COLOR = '200, 38, 38';       // 外缘描边 RGB（#c02626 圆润亮红壳缘）
export const SHIELD_DOME_RIM_ALPHA = 0.85;                // 外缘描边透明度
export const SHIELD_DOME_RIM_LINE_WIDTH = 3;              // 外缘描边线宽（像素）
// --- 分段硬甲（缝隙暗金微光，lighter 发光） ---
export const SHIELD_DOME_SEGMENT_COUNT = 7;               // 放射分段数（肋条 = 分段边界）
export const SHIELD_DOME_RING_COUNT = 3;                  // 同心环纹数（不含外缘）
export const SHIELD_DOME_GAP_COLOR = '217, 119, 6';       // 缝隙暗金 RGB（#d97706）
export const SHIELD_DOME_GAP_ALPHA = 0.75;                // 缝隙金光基准透明度
export const SHIELD_DOME_GAP_LINE_WIDTH = 2;              // 缝隙线宽（像素）
export const SHIELD_DOME_GAP_GLOW_BLUR = 6;               // 缝隙金光辉光半径（像素）
export const SHIELD_DOME_EDGE_COLOR = '248, 113, 113';    // 段缘翘起高光 RGB（#f87171）
export const SHIELD_DOME_EDGE_ALPHA = 0.4;                // 段缘高光透明度
// --- 呼吸胀缩（整体缓慢，金光随之明暗流转） ---
export const SHIELD_DOME_BREATH_AMP = 0.035;              // 呼吸振幅（±3.5%，火焰直射时增至 0.08）
export const SHIELD_DOME_BREATH_FREQ = 0.5;               // 呼吸频率（Hz，2 秒一循环）
// --- 底部张开 / 同类靠近加宽 ---
export const SHIELD_DOME_FLARE_EXTRA = 26;                // 底部外张沿基础宽度（像素，超出半宽）
export const SHIELD_DOME_ALLY_WIDEN = 34;                 // 同类靠近底部加宽步进（像素，最多 2 只计）
// --- 受击裂纹（从击中点沿甲纹爬散，金光汇聚修补） ---
export const SHIELD_DOME_CRACK_COUNT = 5;                 // 裂纹条数
export const SHIELD_DOME_CRACK_COLOR = '254, 243, 199';   // 裂纹 RGB（#fef3c7 亮金白）
export const SHIELD_DOME_CRACK_ALPHA = 0.9;               // 裂纹峰值透明度
export const SHIELD_DOME_CRACK_LINE_WIDTH = 1.5;          // 裂纹线宽（像素）
// --- 受损焦黑灼痕 ---
export const SHIELD_DOME_SCORCH_COUNT = 4;                // 灼痕斑块数
export const SHIELD_DOME_SCORCH_COLOR = '12, 10, 9';      // 灼痕 RGB（近黑）
export const SHIELD_DOME_SCORCH_ALPHA = 0.55;             // 灼痕峰值透明度（× 受损程度 1-hpRatio）
// --- 受损边缘碎屑剥落 ---
export const SHIELD_DOME_DEBRIS_COUNT = 6;                // 碎屑数量
export const SHIELD_DOME_DEBRIS_LIFE = 1400;              // 碎屑生命周期（毫秒）
export const SHIELD_DOME_DEBRIS_SIZE = 2.5;               // 碎屑半径（像素）
export const SHIELD_DOME_DEBRIS_COLOR = '120, 53, 15';    // 碎屑 RGB（#78350f 焦褐）
export const SHIELD_DOME_DEBRIS_HP_THRESHOLD = 0.7;       // 护盾 HP 低于此比例才剥落碎屑

// ======================================================================
// 破盾玻璃碎裂特效（护盾破碎瞬间，光带位置的无状态渲染：
//   由 shieldBrokenTimer 倒计时驱动，elapsed = shieldRebuildDelay - shieldBrokenTimer，
//   仅在破碎后 duration 秒内显示；白色闪光 + 放射状裂纹 + 旋转三角玻璃碎片）
// ======================================================================
export const SHIELD_BREAK_DURATION = 0.6;                // 特效持续时间（秒）
// 瞬间白色闪光（前 25% 进度内快速熄灭，玻璃爆裂的强高光）
export const SHIELD_BREAK_FLASH_COLOR = '255, 255, 255'; // 闪光 RGB 通道（纯白）
export const SHIELD_BREAK_FLASH_ALPHA = 0.85;            // 闪光峰值透明度
// 放射状裂纹（破碎瞬间定格出现，前半程渐隐；锯齿折线模拟玻璃裂纹）
export const SHIELD_BREAK_CRACK_COUNT = 7;               // 裂纹数量
export const SHIELD_BREAK_CRACK_COLOR = '224, 242, 254'; // 裂纹 RGB 通道（#e0f2fe 亮青白）
export const SHIELD_BREAK_CRACK_ALPHA = 0.9;             // 裂纹峰值透明度
export const SHIELD_BREAK_CRACK_LINE_WIDTH = 1.5;        // 裂纹线宽（像素）
// 三角玻璃碎片（向外飞散并自转，淡蓝半透明填充 + 近白描边，全程渐隐）
export const SHIELD_BREAK_SHARD_COUNT = 14;              // 碎片数量
export const SHIELD_BREAK_SHARD_FLY = 110;               // 碎片全程飞散距离（像素）
export const SHIELD_BREAK_SHARD_SIZE_MIN = 4;            // 碎片最小边长（像素）
export const SHIELD_BREAK_SHARD_SIZE_MAX = 10;           // 碎片最大边长（像素）
export const SHIELD_BREAK_SHARD_FILL_COLOR = '191, 219, 254'; // 碎片填充 RGB 通道（#bfdbfe 淡蓝）
export const SHIELD_BREAK_SHARD_FILL_ALPHA = 0.55;       // 碎片填充峰值透明度
export const SHIELD_BREAK_SHARD_EDGE_COLOR = '239, 246, 255'; // 碎片描边 RGB 通道（#eff6ff 近白）
export const SHIELD_BREAK_SHARD_EDGE_ALPHA = 0.95;       // 碎片描边峰值透明度
export const SHIELD_BREAK_BLEND: GlobalCompositeOperation = 'lighter'; // 叠加混合（lighter，与光带一致）

// 护盾矩形保护区调试框（showShieldRange 开启时显示的矩形拖尾 + 线框）颜色/透明度
export const SHIELD_RECT_COLOR = '103, 232, 249';        // 矩形填充 RGB 通道（#67e8f9 青）
export const SHIELD_RECT_FILL_ALPHA_NEAR = 0.75;         // 填充透明度系数（近端 stop0，× 动态 alpha）
export const SHIELD_RECT_FILL_ALPHA_MID = 0.45;          // 填充透明度系数（中段 stop0.6，× 动态 alpha）
export const SHIELD_RECT_STROKE_COLOR = '165, 243, 252'; // 线框 RGB 通道（#a5f3fc 浅青）
export const SHIELD_RECT_STROKE_ALPHA_SCALE = 2.2;       // 线框透明度放大系数（× 动态 alpha，封顶 1）
export const SHIELD_RECT_STROKE_FLASH_ALPHA = 0.4;       // 受击闪白附加透明度（× flash）
