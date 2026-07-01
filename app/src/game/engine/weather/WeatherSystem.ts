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
    // 雨滴粒子
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
      
      // 通知外部添加粒子
      if (this.config.onAddParticle) {
        this.config.onAddParticle(rainParticle);
      }
    }
  }

  /**
   * 更新雾天效果
   */
  private updateFog(): void {
    // 缓慢移动的雾
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
      
      // 通知外部添加粒子
      if (this.config.onAddParticle) {
        this.config.onAddParticle(fogParticle);
      }
    }
  }

  /**
   * 更新夜晚效果
   */
  private updateNight(): void {
    // 闪电
    this.lightningTimer -= this.config.deltaTime;
    if (this.lightningTimer <= 0) {
      this.lightningTimer = 5 + Math.random() * 10;
      if (Math.random() < 0.3) {
        this.lightningFlash = 0.3;
        
        // 添加闪电效果文字
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
    
    // 更新闪电闪光
    if (this.lightningFlash > 0) {
      this.lightningFlash -= this.config.deltaTime;
    }
  }

  /**
   * 更新天气粒子
   */
  private updateWeatherParticles(): void {
    const weather = this.config.weather;
    
    // 从后向前遍历，便于删除
    for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
      const p = this.weatherParticles[i];
      p.life -= this.config.deltaTime;
      p.x += p.vx * this.config.deltaTime;
      p.y += p.vy * this.config.deltaTime;
      
      // 雾粒子随时间变大
      if (p.type === ParticleType.SMOKE && weather === WeatherType.FOG) {
        p.size *= 1.005;
      }
      
      // 移除生命周期结束的粒子
      if (p.life <= 0) {
        this.weatherParticles.splice(i, 1);
      }
    }
  }

  /**
   * 设置天气类型
   * @param weather 天气类型
   */
  setWeather(weather: WeatherType): void {
    this.config.weather = weather;
    this.reset();
  }

  /**
   * 触发闪电
   * @param duration 闪光持续时间（秒）
   */
  triggerLightning(duration: number = 0.3): void {
    this.lightningFlash = duration;
    this.lightningTimer = 5 + Math.random() * 10;
    
    // 添加闪电效果文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 2 - 100,
        '⚡ 闪电 ⚡',
        '#fbbf24'
      );
    }
  }

  /**
   * 重置天气系统
   */
  reset(): void {
    this.weatherParticles = [];
    this.lightningTimer = 0;
    this.lightningFlash = 0;
  }

  /**
   * 获取当前天气类型
   * @returns 天气类型
   */
  getWeatherType(): WeatherType {
    return this.config.weather;
  }

  /**
   * 检查是否有闪电闪光
   * @returns 是否有闪电闪光
   */
  hasLightningFlash(): boolean {
    return this.lightningFlash > 0;
  }

  /**
   * 获取天气粒子数量
   * @returns 天气粒子数量
   */
  getParticleCount(): number {
    return this.weatherParticles.length;
  }

  /**
   * 清理过期的天气粒子
   */
  cleanupExpiredParticles(): void {
    this.weatherParticles = this.weatherParticles.filter(p => p.life > 0);
  }
}
