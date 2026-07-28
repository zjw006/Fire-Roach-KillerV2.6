/**
 * @fileoverview 天气系统模块
 * @description 负责管理游戏中的天气效果，包括雨、雾、夜晚闪电等
 *   粒子由外部（engine.ts）统一管理，通过 onAddParticle 回调注入
 */

import { ParticleType, WeatherType } from '../../types';
import type { Particle } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG, FLOAT_COLOR } from '../../data';

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
    const spawnChance = cfg.spawnRate * this.config.deltaTime;
    if (Math.random() < spawnChance) {
      const rainParticle: Particle = {
        x: Math.random() * this.config.canvasWidth,
        y: -10,
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
    const spawnChance = cfg.spawnRate * this.config.deltaTime;
    if (Math.random() < spawnChance) {
      const life = cfg.lifeMin + Math.random() * cfg.lifeRange;
      const fogParticle: Particle = {
        x: Math.random() < 0.5 ? -20 : this.config.canvasWidth + 20,
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
        BALANCE_CONFIG.lightning.timerMin + Math.random() * BALANCE_CONFIG.lightning.timerRandMax;
      if (Math.random() < BALANCE_CONFIG.lightning.chance) {
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
      BALANCE_CONFIG.lightning.timerMin + Math.random() * BALANCE_CONFIG.lightning.timerRandMax;

    if (this.config.onAddFloatingText && this.lightningTextCooldown <= 0) {
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 2 - 100,
        TEXT_CONFIG.combat.lightning,
        FLOAT_COLOR.gold
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
   * 渲染天气背景（闪电闪光覆盖层）
   */
  static renderWeatherBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    lightningFlash: number
  ): void {
    if (lightningFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${lightningFlash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /**
   * 渲染天气前景（雨滴、烟雾粒子）
   * 修复 P1: 移除 renderDefenseLine 回调参数，降低耦合
   * 修复 P2: 移除无意义的 globalCompositeOperation 恢复
   */
  static renderWeatherForeground(
    ctx: CanvasRenderingContext2D,
    _w: number,
    weatherParticles: Particle[]
  ): void {
    ctx.save();
    for (const p of weatherParticles) {
      const alpha = p.life / p.maxLife;
      if (p.type === ParticleType.RAIN) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02);
        ctx.stroke();
      } else if (p.type === ParticleType.SMOKE) {
        ctx.globalAlpha = alpha * 0.3;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(180, 180, 160, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}