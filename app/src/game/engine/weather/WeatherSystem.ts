/**
 * @fileoverview 天气系统模块
 * @description 负责管理游戏中的天气效果，包括雨、雾、夜晚闪电等
 */

import { ParticleType, WeatherType } from '../../types';
import type { Particle } from '../../types';

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
  /** 添加粒子回调 */
  onAddParticle?: (particle: Particle) => void;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 天气系统类
 * @description 管理天气效果的产生、更新和渲染
 */
export class WeatherSystem {
  /** 天气粒子数组 */
  private weatherParticles: Particle[] = [];
  /** 闪电计时器 */
  private lightningTimer: number = 0;
  /** 闪电闪光强度 */
  private lightningFlash: number = 0;
  /** 系统配置 */
  private config: WeatherSystemConfig;

  /**
   * 构造函数
   * @param config 天气系统配置
   */
  constructor(config: WeatherSystemConfig) {
    this.config = config;
  }

  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<WeatherSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  update(): void {
    this.updateWeather();
  }

  /**
   * 获取天气粒子数组
   * @returns 天气粒子数组
   */
  getWeatherParticles(): Particle[] {
    return [...this.weatherParticles];
  }

  /**
   * 获取闪电闪光强度
   * @returns 闪电闪光强度（0-1）
   */
  getLightningFlash(): number {
    return this.lightningFlash;
  }

  /**
   * 更新天气系统
   */
  updateWeather(): void {
    const weather = this.config.weather;

    if (weather === WeatherType.RAIN) {
      this.updateRain();
    } else if (weather === WeatherType.FOG) {
      this.updateFog();
    } else if (weather === WeatherType.NIGHT) {
      this.updateNight();
    }

    // 更新天气粒子
    this.updateWeatherParticles();
  }

  /**
   * 更新雨天效果
   */
  private updateRain(): void {
    if (Math.random() < 0.4) {
      const rainParticle: Particle = {
        x: Math.random() * this.config.canvasWidth,
        y: -10,
        vx: -20 + Math.random() * 10,
        vy: 200 + Math.random() * 100,
        life: 2,
        maxLife: 2,
        size: 1 + Math.random(),
        color: 'rgba(150, 180, 220, 0.4)',
        type: ParticleType.RAIN,
      };
      this.weatherParticles.push(rainParticle);
      if (this.config.onAddParticle) {
        this.config.onAddParticle(rainParticle);
      }
    }
  }

  /**
   * 更新雾天效果
   */
  private updateFog(): void {
    if (Math.random() < 0.05) {
      const fogParticle: Particle = {
        x: Math.random() < 0.5 ? -20 : this.config.canvasWidth + 20,
        y: Math.random() * this.config.canvasHeight,
        vx: (Math.random() < 0.5 ? 1 : -1) * (10 + Math.random() * 10),
        vy: -5 + Math.random() * 10,
        life: 8 + Math.random() * 4,
        maxLife: 8 + Math.random() * 4,
        size: 30 + Math.random() * 50,
        color: `rgba(180, 180, 160, ${0.05 + Math.random() * 0.05})`,
        type: ParticleType.SMOKE,
      };
      this.weatherParticles.push(fogParticle);
      if (this.config.onAddParticle) {
        this.config.onAddParticle(fogParticle);
      }
    }
  }

  /**
   * 更新夜晚效果
   */
  private updateNight(): void {
    this.lightningTimer -= this.config.deltaTime;
    if (this.lightningTimer <= 0) {
      this.lightningTimer = 5 + Math.random() * 10;
      if (Math.random() < 0.3) {
        this.lightningFlash = 0.3;
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.config.canvasWidth / 2,
            this.config.canvasHeight / 2 - 100,
            '⚡ 闪电 ⚡',
            '#fbbf24'
          );
        }
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash -= this.config.deltaTime;
    }
  }

  /**
   * 更新天气粒子
   */
  private updateWeatherParticles(): void {
    const weather = this.config.weather;
    for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
      const p = this.weatherParticles[i];
      p.life -= this.config.deltaTime;
      p.x += p.vx * this.config.deltaTime;
      p.y += p.vy * this.config.deltaTime;
      if (p.type === ParticleType.SMOKE && weather === WeatherType.FOG) {
        p.size *= 1.005;
      }
      if (p.life <= 0) {
        this.weatherParticles.splice(i, 1);
      }
    }
  }

  setWeather(weather: WeatherType): void {
    this.config.weather = weather;
    this.reset();
  }

  triggerLightning(duration: number = 0.3): void {
    this.lightningFlash = duration;
    this.lightningTimer = 5 + Math.random() * 10;
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 2 - 100,
        '⚡ 闪电 ⚡',
        '#fbbf24'
      );
    }
  }

  reset(): void {
    this.weatherParticles = [];
    this.lightningTimer = 0;
    this.lightningFlash = 0;
  }

  getWeatherType(): WeatherType {
    return this.config.weather;
  }

  hasLightningFlash(): boolean {
    return this.lightningFlash > 0;
  }

  getParticleCount(): number {
    return this.weatherParticles.length;
  }

  cleanupExpiredParticles(): void {
    this.weatherParticles = this.weatherParticles.filter(p => p.life > 0);
  }

  /**
   * 渲染天气背景（闪电闪光）
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
   */
  static renderWeatherForeground(
    ctx: CanvasRenderingContext2D,
    w: number,
    weatherParticles: Particle[],
    renderDefenseLine: () => void
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
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    renderDefenseLine();
  }
}