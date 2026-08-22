/**
 * @fileoverview 天气系统模块
 * @description 负责管理游戏中的天气效果，包括雨、雾、夜晚闪电等
 *   粒子由外部（engine.ts）统一管理，通过 onAddParticle 回调注入
 */

import { ParticleType, WeatherType } from '../../types';
import type { Particle } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/**
 * 天气系统配置接口
 */
export interface WeatherSystemConfig {
  /** 游戏画布宽度 */
  canvasWidth: number;
  /** 游戏画布高度 */
  canvasHeight: number;
  /** 时间增量（秒） */
  deltaTime: number;
  /** 当前天气类型 */
  weather: WeatherType;
  /** 添加粒子回调（外部统一管理粒子生命周期） */
  onAddParticle?: (particle: Particle) => void;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 天气系统类
 * @description 管理天气效果的产生、更新和渲染。
 *   粒子不在此类内部维护，而是通过 onAddParticle 回调注入外部粒子数组。
 */
export class WeatherSystem {
  /** 系统配置 */
  private config: WeatherSystemConfig;

  // ===== 内部状态（不修改外部配置） =====

  /** 当前天气类型（内部状态，避免修改外部 config.weather） */
  private currentWeather: WeatherType;

  /** 闪电计时器（距离下次闪电的剩余时间） */
  private lightningTimer: number = 0;

  /** 闪电闪光强度（0-1，用于渲染白色覆盖层） */
  private lightningFlash: number = 0;

  /** 闪电文字冷却时间（防止频繁刷屏） */
  private lightningTextCooldown: number = 0;

  /**
   * 构造函数
   * @param config 天气系统配置
   */
  constructor(config: WeatherSystemConfig) {
    this.config = config;
    this.currentWeather = config.weather;
  }

  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<WeatherSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // =========================================================================
  // 主更新方法
  // =========================================================================

  /** 每帧更新天气效果 */
  update(): void {
    const weather = this.currentWeather;

    if (weather === WeatherType.RAIN) {
      this.updateRain();
    } else if (weather === WeatherType.FOG) {
      this.updateFog();
    } else if (weather === WeatherType.NIGHT) {
      this.updateNight();
    }
  }

  // =========================================================================
  // 天气效果更新
  // =========================================================================

  /**
   * 更新雨天效果
   * 修复 P1: 使用 spawnRate * deltaTime 实现帧率无关的粒子生成概率
   */
  private updateRain(): void {
    const cfg = BALANCE_CONFIG.weather.rain;
    const spawnChance = cfg.emitter.spawnRate * this.config.deltaTime;
    if (Math.random() < spawnChance) {
      const rainParticle: Particle = {
        x: Math.random() * this.config.canvasWidth,
        y: cfg.emitter.spawnY,
        vx: cfg.vxMin + Math.random() * cfg.vxRange,
        vy: cfg.vyMin + Math.random() * cfg.vyRange,
        life: cfg.life,
        maxLife: cfg.life,
        size: cfg.sizeMin + Math.random() * cfg.sizeRange,
        color: cfg.color,
        type: ParticleType.RAIN,
      };
      this.config.onAddParticle?.(rainParticle);
    }
  }

  /**
   * 更新雾天效果
   * 修复 P1: 使用 spawnRate * deltaTime 实现帧率无关的粒子生成概率
   */
  private updateFog(): void {
    const cfg = BALANCE_CONFIG.weather.fog;
    const spawnChance = cfg.emitter.spawnRate * this.config.deltaTime;
    if (Math.random() < spawnChance) {
      const life = cfg.lifeMin + Math.random() * cfg.lifeRange;
      const fogParticle: Particle = {
        x: Math.random() < 0.5 ? -cfg.emitter.spawnEdgeOffset : this.config.canvasWidth + cfg.emitter.spawnEdgeOffset,
        y: Math.random() * this.config.canvasHeight,
        vx: (Math.random() < 0.5 ? 1 : -1) * (cfg.vxMin + Math.random() * cfg.vxRange),
        vy: cfg.vyMin + Math.random() * cfg.vyRange,
        life,
        maxLife: life,
        size: cfg.sizeMin + Math.random() * cfg.sizeRange,
        color: `rgba(${cfg.colorBase}, ${cfg.alphaMin + Math.random() * cfg.alphaRange})`,
        type: ParticleType.SMOKE,
      };
      this.config.onAddParticle?.(fogParticle);
    }
  }

  /**
   * 更新夜晚闪电效果
   * 修复 P1: 闪电文字增加冷却控制，防止频繁刷屏
   * 修复 P2: 闪电逻辑统一到 triggerLightning 方法
   */
  private updateNight(): void {
    this.lightningTimer -= this.config.deltaTime;
    this.lightningTextCooldown -= this.config.deltaTime;

    if (this.lightningTimer <= 0) {
      this.lightningTimer =
        BALANCE_CONFIG.lightning.emitter.timerMin + Math.random() * BALANCE_CONFIG.lightning.emitter.timerRandMax;
      if (Math.random() < BALANCE_CONFIG.lightning.emitter.chance) {
        this.triggerLightning();
      }
    }

    if (this.lightningFlash > 0) {
      this.lightningFlash -= this.config.deltaTime;
    }
  }

  // =========================================================================
  // 公共方法
  // =========================================================================

  /**
   * 设置天气类型
   * 修复 P0: 不修改外部传入的 config 对象，而是修改内部状态 currentWeather
   */
  setWeather(weather: WeatherType): void {
    this.currentWeather = weather;
    this.reset();
  }

  /**
   * 触发闪电效果
   * 修复 P2: 统一闪电触发与文字显示逻辑，避免分散实现
   */
  triggerLightning(duration: number = BALANCE_CONFIG.lightning.flashDuration): void {
    this.lightningFlash = duration;
    this.lightningTimer =
      BALANCE_CONFIG.lightning.emitter.timerMin + Math.random() * BALANCE_CONFIG.lightning.emitter.timerRandMax;

    if (this.config.onAddFloatingText && this.lightningTextCooldown <= 0) {
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 2 - BALANCE_CONFIG.lightning.textOffsetY,
        TEXT_CONFIG.combat.lightning.text,
        TEXT_CONFIG.combat.lightning.color
      );
      this.lightningTextCooldown = BALANCE_CONFIG.lightning.textCooldown;
    }
  }

  /** 重置所有内部状态 */
  reset(): void {
    this.lightningTimer = 0;
    this.lightningFlash = 0;
    this.lightningTextCooldown = 0;
  }

  // =========================================================================
  // 查询方法
  // =========================================================================

  getWeatherType(): WeatherType {
    return this.currentWeather;
  }

  getLightningFlash(): number {
    return this.lightningFlash;
  }

  hasLightningFlash(): boolean {
    return this.lightningFlash > 0;
  }

  // =========================================================================
  // 静态渲染方法
  // =========================================================================

  /**
   * 生成闪电链折线（主链节点数组，含分支作为独立段附加）
   * 返回格式：[主链节点..., 分支1起点, 分支1终点, 分支2起点, 分支2终点, ...]
   * 主链节点数 = segments + 1；分支以成对节点表示（moveTo → lineTo）
   */
  static buildLightningBolt(canvasWidth: number, canvasHeight: number): { x: number; y: number }[] {
    const bc = BALANCE_CONFIG.lightning.bolt;
    const startX = canvasWidth * (0.2 + Math.random() * 0.6);
    const endY = canvasHeight * bc.endYRatio;
    const jitter = canvasWidth * bc.jitterRatio;
    const main: { x: number; y: number }[] = [{ x: startX, y: -10 }];
    let x = startX;
    for (let i = 1; i <= bc.segments; i++) {
      const t = i / bc.segments;
      const y = -10 + (endY + 10) * t;
      // 两端收窄、中段抖动最大（闪电自然形态）
      x += (Math.random() - 0.5) * 2 * jitter * Math.sin(t * Math.PI);
      main.push({ x, y });
    }
    // 分支：从中段节点随机伸出短折线
    const branches: { x: number; y: number }[] = [];
    for (let i = 2; i < main.length - 2; i++) {
      if (Math.random() >= bc.branchChance) continue;
      const node = main[i];
      const dir = Math.random() < 0.5 ? -1 : 1;
      const branchLen = (endY - node.y) * bc.branchLenRatio;
      branches.push(node);
      branches.push({
        x: node.x + dir * branchLen * (0.4 + Math.random() * 0.6),
        y: node.y + branchLen * (0.6 + Math.random() * 0.4),
      });
    }
    return [...main, ...branches];
  }

  /**
   * 渲染天气背景（闪电闪光覆盖层 + 闪电链）
   * @param bolt 闪电链节点（buildLightningBolt 生成；主链 + 成对分支节点），闪光期绘制
   */
  static renderWeatherBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    lightningFlash: number,
    bolt?: { x: number; y: number }[]
  ): void {
    if (lightningFlash > 0) {
      const lCfg = BALANCE_CONFIG.lightning;
      ctx.save();
      ctx.globalCompositeOperation = lCfg.flashBlend; // 叠加混合集中于 vfx-balance lightning.flashBlend
      ctx.fillStyle = `rgba(${lCfg.flashColor}, ${lightningFlash * lCfg.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // 闪电链：主链折线 + 分支线段，透明度随闪光剩余衰减
      if (bolt && bolt.length >= 2) {
        const bc = lCfg.bolt;
        const flashRatio = Math.min(1, lightningFlash / lCfg.flashDuration);
        const mainCount = bc.segments + 1;
        ctx.save();
        ctx.globalCompositeOperation = bc.blend; // 叠加混合集中于 vfx-balance lightning.bolt.blend
        ctx.lineJoin = 'round';
        // 外层辉光（宽线 + 大模糊，先画于核心链之下）
        ctx.strokeStyle = `rgba(${bc.glowColor}, ${bc.haloAlpha * flashRatio})`;
        ctx.lineWidth = bc.lineWidth * bc.haloWidthMult;
        ctx.shadowColor = `rgba(${bc.glowColor}, ${flashRatio})`;
        ctx.shadowBlur = bc.glowBlur * bc.haloBlurMult;
        ctx.beginPath();
        ctx.moveTo(bolt[0].x, bolt[0].y);
        for (let i = 1; i < Math.min(mainCount, bolt.length); i++) {
          ctx.lineTo(bolt[i].x, bolt[i].y);
        }
        ctx.stroke();
        // 核心主链（落地端渐隐变虚：末端 fadeSegments 段透明度线性衰减至 fadeMinAlpha）
        ctx.lineWidth = bc.lineWidth;
        ctx.shadowBlur = bc.glowBlur;
        const mainEnd = Math.min(mainCount, bolt.length);
        const fadeSeg = Math.min(bc.fadeSegments, Math.max(0, mainEnd - 1));
        const fadeStartIdx = mainEnd - 1 - fadeSeg; // 渐隐起始节点索引（此前段保持全透明）
        for (let i = 1; i < mainEnd; i++) {
          // 该段末端透明度：非渐隐区 = 1，渐隐区按到落点进度线性 → fadeMinAlpha
          let segFade = 1;
          if (i > fadeStartIdx && fadeSeg > 0) {
            const p = (i - fadeStartIdx) / fadeSeg; // 0(渐隐起点) → 1(落点)
            segFade = 1 - p * (1 - bc.fadeMinAlpha);
          }
          ctx.strokeStyle = `rgba(${bc.coreColor}, ${bc.alpha * flashRatio * segFade})`;
          ctx.beginPath();
          ctx.moveTo(bolt[i - 1].x, bolt[i - 1].y);
          ctx.lineTo(bolt[i].x, bolt[i].y);
          ctx.stroke();
        }
        // 分支（成对节点）
        ctx.lineWidth = bc.branchWidth;
        ctx.shadowBlur = bc.glowBlur * 0.5;
        for (let i = mainCount; i + 1 < bolt.length; i += 2) {
          ctx.beginPath();
          ctx.moveTo(bolt[i].x, bolt[i].y);
          ctx.lineTo(bolt[i + 1].x, bolt[i + 1].y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  /**
   * 渲染天气前景（雨滴、烟雾粒子、水滴、地面涟漪、地下室/医院波次灯光遮罩、灯位光晕）
   * 修复 P1: 移除 renderDefenseLine 回调参数，降低耦合
   * 修复 P2: 移除无意义的 globalCompositeOperation 恢复
   * @param flickerState 波次灯光状态（engine 计算传入）：brightness 综合亮度（1=正常 0=全黑 >1=过冲提亮）、red 微红强度 0-1
   * @param flickerLamps 灯位光晕椭圆列表（画布逻辑坐标，engine 按背景图实际绘制区域映射传入）；
   *                     光晕常驻 lighter 叠加；暗化黑蒙版在灯位羽毛开孔保持灯光可见
   */
  static renderWeatherForeground(
    ctx: CanvasRenderingContext2D,
    _w: number,
    weatherParticles: Particle[],
    h: number = 0,
    flickerState: { brightness: number; red: number } = { brightness: 1, red: 0 },
    flickerLamps: { cx: number; cy: number; rx: number; ry: number }[] = []
  ): void {
    const rainCfg = BALANCE_CONFIG.weather.rain;
    const fogCfg = BALANCE_CONFIG.weather.fog;
    const dripCfg = BALANCE_CONFIG.weather.drip;
    const rippleCfg = BALANCE_CONFIG.weather.ripple;
    ctx.save();
    for (const p of weatherParticles) {
      const alpha = p.life / p.maxLife;
      if (p.type === ParticleType.RAIN) {
        ctx.globalAlpha = alpha * rainCfg.renderAlpha;
        ctx.globalCompositeOperation = rainCfg.blend; // 叠加混合集中于 vfx-balance weather.rain.blend
        ctx.strokeStyle = p.color;
        ctx.lineWidth = rainCfg.renderLineWidth;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * rainCfg.renderTailScale, p.y + p.vy * rainCfg.renderTailScale);
        ctx.stroke();
      } else if (p.type === ParticleType.SMOKE) {
        ctx.globalAlpha = alpha * fogCfg.renderAlpha;
        ctx.globalCompositeOperation = fogCfg.blend; // 叠加混合集中于 vfx-balance weather.fog.blend
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, fogCfg.renderGradientEnd);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === ParticleType.DRIP) {
        // 下落水滴：短竖线拖尾（vfx-balance weather.drip）
        ctx.globalAlpha = alpha * dripCfg.renderAlpha;
        ctx.globalCompositeOperation = dripCfg.blend;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = dripCfg.renderLineWidth;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * dripCfg.renderTailScale, p.y + p.vy * dripCfg.renderTailScale);
        ctx.stroke();
      } else if (p.type === ParticleType.RIPPLE) {
        // 地面涟漪：扩散椭圆双环（ease-out 扩散 + 渐隐；尺寸在生成时已乘透视缩放，近大远小）
        const progress = 1 - p.life / p.maxLife;
        const eased = 1 - (1 - progress) * (1 - progress);
        const rx = p.size * (rippleCfg.startRatio + eased * rippleCfg.expand);
        const ry = rx * rippleCfg.aspect;
        const a = (1 - progress) * rippleCfg.alpha;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = rippleCfg.blend;
        ctx.lineWidth = rippleCfg.lineWidth;
        ctx.strokeStyle = `rgba(${p.color}, ${a})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${p.color}, ${a * rippleCfg.innerRingAlphaRatio})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx * rippleCfg.innerRingRatio, ry * rippleCfg.innerRingRatio, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // 地下室/医院波次灯光：暗化遮罩（亮度 <1，覆盖在所有天气粒子之上）；
    // 有灯位时改用离屏蒙版（灯位羽毛开孔，灯光区域不被压暗）
    const flickerCfg = BALANCE_CONFIG.weather.flicker;
    // 黑色叠加透明度封顶 darkMaxAlpha（0.30）：亮度压暗时黑蒙版不超过 30%，避免全黑看不清画面
    const darkAlpha = Math.min(flickerCfg.darkMaxAlpha, Math.max(0, 1 - flickerState.brightness));
    if (darkAlpha > 0 && h > 0) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (flickerLamps.length === 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${darkAlpha})`;
        ctx.fillRect(0, 0, _w, h);
      } else {
        const mask = WeatherSystem.getFlickerMask(_w, h, flickerLamps, flickerCfg.lampMaskHoleScale);
        if (mask) {
          // 蒙版烘焙为不透明黑，绘制时用 globalAlpha 控制实际黑度
          ctx.globalAlpha = darkAlpha;
          ctx.drawImage(mask, 0, 0);
          ctx.globalAlpha = 1;
        }
      }
    }
    // 微红段：全屏红光叠加（电压不稳泛红，位于黑遮罩之上）
    if (flickerState.red > 0 && h > 0) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(${flickerCfg.redColor}, ${Math.min(1, flickerState.red) * flickerCfg.redMaxAlpha})`;
      ctx.fillRect(0, 0, _w, h);
    }
    // 过冲提亮：亮度 >1 时全屏暖白提亮（电压过载灯管爆亮）
    if (flickerState.brightness > 1 && h > 0) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(${flickerCfg.overboostColor}, ${Math.min(1, (flickerState.brightness - 1) * flickerCfg.overboostAlphaScale)})`;
      ctx.fillRect(0, 0, _w, h);
    }
    // 灯位光晕：常驻 lighter 叠加暖光（位于黑蒙版之上，灯暗时灯光保持全亮）
    if (flickerLamps.length > 0) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      for (const e of flickerLamps) {
        const r = Math.max(e.rx, e.ry);
        if (r <= 0) continue;
        ctx.save();
        ctx.translate(e.cx, e.cy);
        ctx.scale(e.rx / r, e.ry / r); // 压扁成椭圆（rx/ry 任意比例）
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, `rgba(${flickerCfg.lampColor}, ${flickerCfg.lampHaloAlpha})`);
        g.addColorStop(0.55, `rgba(${flickerCfg.lampColor}, ${flickerCfg.lampHaloAlpha * 0.45})`);
        g.addColorStop(1, `rgba(${flickerCfg.lampColor}, 0)`); // 边缘半透渐变至全透明
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** 灯光闪烁黑蒙版离屏画布缓存（静态，按 画布尺寸+灯位坐标 键控复用） */
  private static flickerMaskCanvas: HTMLCanvasElement | null = null;
  private static flickerMaskKey: string = '';

  /**
   * 构建/复用灯位开孔的黑色蒙版（离屏画布，不透明黑 + destination-out 羽毛开孔）
   * 仅当画布尺寸或灯位坐标变化时重建，闪烁期间逐帧复用
   */
  private static getFlickerMask(
    w: number,
    h: number,
    lamps: { cx: number; cy: number; rx: number; ry: number }[],
    holeScale: number
  ): HTMLCanvasElement | null {
    const key = `${w}x${h}|${holeScale}|${lamps.map(e => `${e.cx.toFixed(1)},${e.cy.toFixed(1)},${e.rx.toFixed(1)},${e.ry.toFixed(1)}`).join(';')}`;
    if (WeatherSystem.flickerMaskCanvas && WeatherSystem.flickerMaskKey === key) {
      return WeatherSystem.flickerMaskCanvas;
    }
    const cvs = WeatherSystem.flickerMaskCanvas ?? document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const m = cvs.getContext('2d');
    if (!m) return null;
    m.clearRect(0, 0, w, h);
    m.fillStyle = '#000';
    m.fillRect(0, 0, w, h);
    // 灯位羽毛开孔：中心全擦除 → 边缘渐隐（destination-out 只作用于蒙版，不影响游戏画面）
    m.globalCompositeOperation = 'destination-out';
    for (const e of lamps) {
      const rx = e.rx * holeScale;
      const ry = e.ry * holeScale;
      const r = Math.max(rx, ry);
      if (r <= 0) continue;
      m.save();
      m.translate(e.cx, e.cy);
      m.scale(rx / r, ry / r);
      const g = m.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g;
      m.beginPath();
      m.arc(0, 0, r, 0, Math.PI * 2);
      m.fill();
      m.restore();
    }
    WeatherSystem.flickerMaskCanvas = cvs;
    WeatherSystem.flickerMaskKey = key;
    return cvs;
  }
}