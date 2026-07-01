/**
 * @fileoverview 游戏粒子管理器
 * @description 负责管理游戏中的粒子效果，包括火焰、烟雾、爆炸等
 */

import type { Particle } from '../../types';
import { ParticleType } from '../../types';

/**
 * 粒子管理器类
 * @description 管理游戏中的粒子效果
 */
export class ParticleManager {
  private particles: Particle[] = [];
  private weatherParticles: Particle[] = [];
  private particleLimit: number = 300;
  private isLowPerfDevice: boolean = false;

  /**
   * 构造函数
   * @param {number} initialLimit - 初始粒子限制
   */
  constructor(initialLimit: number = 300) {
    this.particleLimit = initialLimit;
    this.isLowPerfDevice = this.particleLimit <= 200;
    this.loadParticleLimit();
  }

  /**
   * 从本地存储加载粒子限制
   */
  private loadParticleLimit(): void {
    try {
      const savedLimit = localStorage.getItem('roach_blaster_particle_limit');
      if (savedLimit) {
        this.particleLimit = parseInt(savedLimit, 10);
        this.isLowPerfDevice = this.particleLimit <= 200;
      }
    } catch {
      // 忽略错误
    }
  }

  /**
   * 保存粒子限制到本地存储
   */
  private saveParticleLimit(): void {
    try {
      localStorage.setItem('roach_blaster_particle_limit', this.particleLimit.toString());
    } catch {
      // 忽略错误
    }
  }

  /**
   * 获取所有粒子
   * @returns {Particle[]} 粒子数组
   */
  getParticles(): Particle[] {
    return [...this.particles];
  }

  /**
   * 获取天气粒子
   * @returns {Particle[]} 天气粒子数组
   */
  getWeatherParticles(): Particle[] {
    return [...this.weatherParticles];
  }

  /**
   * 添加粒子
   * @param {Particle} particle - 粒子对象
   * @returns {boolean} 是否成功添加
   */
  addParticle(particle: Particle): boolean {
    // 检查粒子数量限制
    if (this.particles.length >= this.particleLimit) {
      return false;
    }
    
    this.particles.push(particle);
    return true;
  }

  /**
   * 添加天气粒子
   * @param {Particle} particle - 天气粒子对象
   */
  addWeatherParticle(particle: Particle): void {
    this.weatherParticles.push(particle);
  }

  /**
   * 创建火焰粒子
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} count - 粒子数量
   * @param {number} spread - 扩散范围
   * @param {number} baseSpeed - 基础速度
   * @param {string} color - 粒子颜色
   * @returns {number} 实际创建的粒子数量
   */
  createFlameParticles(
    x: number,
    y: number,
    count: number,
    spread: number = 20,
    baseSpeed: number = 60,
    color: string = '#ff6b00'
  ): number {
    let created = 0;
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.particleLimit) break;
      
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spread;
      const speed = baseSpeed * (0.5 + Math.random() * 0.5);
      
      const particle: Particle = {
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        color: color,
        size: 3 + Math.random() * 4,
        type: ParticleType.FIRE
      };
      
      this.particles.push(particle);
      created++;
    }
    
    return created;
  }

  /**
   * 创建烟雾粒子
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} count - 粒子数量
   * @param {number} spread - 扩散范围
   * @param {number} baseSpeed - 基础速度
   * @returns {number} 实际创建的粒子数量
   */
  createSmokeParticles(
    x: number,
    y: number,
    count: number,
    spread: number = 30,
    baseSpeed: number = 40
  ): number {
    let created = 0;
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.particleLimit) break;
      
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spread;
      const speed = baseSpeed * (0.3 + Math.random() * 0.7);
      
      const particle: Particle = {
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0 + Math.random() * 1.0,
        maxLife: 2.0,
        color: '#888888',
        size: 4 + Math.random() * 6,
        type: ParticleType.SMOKE
      };
      
      this.particles.push(particle);
      created++;
    }
    
    return created;
  }

  /**
   * 创建爆炸粒子
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} count - 粒子数量
   * @param {number} power - 爆炸威力
   * @returns {number} 实际创建的粒子数量
   */
  createExplosionParticles(
    x: number,
    y: number,
    count: number,
    power: number = 100
  ): number {
    let created = 0;
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.particleLimit) break;
      
      const angle = Math.random() * Math.PI * 2;
      const speed = power * (0.5 + Math.random() * 0.5);
      
      const particle: Particle = {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
        color: '#ff3300',
        size: 2 + Math.random() * 3,
        type: ParticleType.EXPLOSION
      };
      
      this.particles.push(particle);
      created++;
    }
    
    return created;
  }

  /**
   * 创建火花粒子
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} count - 粒子数量
   * @param {number} spread - 扩散范围
   * @returns {number} 实际创建的粒子数量
   */
  createSparkParticles(
    x: number,
    y: number,
    count: number,
    spread: number = 15
  ): number {
    let created = 0;
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.particleLimit) break;
      
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spread;
      const speed = 80 + Math.random() * 40;
      
      const particle: Particle = {
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        color: '#ffff00',
        size: 1 + Math.random() * 2,
        type: ParticleType.SPARK
      };
      
      this.particles.push(particle);
      created++;
    }
    
    return created;
  }

  /**
   * 更新所有粒子
   * @param {number} deltaTime - 时间增量
   */
  update(deltaTime: number): void {
    // 更新普通粒子
    const aliveParticles: Particle[] = [];
    
    for (const p of this.particles) {
      // 更新位置
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      
      // 更新生命周期
      p.life -= deltaTime;
      
      // 如果粒子还活着，保留它
      if (p.life > 0) {
        aliveParticles.push(p);
      }
    }
    
    this.particles = aliveParticles;
    
    // 更新天气粒子
    const aliveWeatherParticles: Particle[] = [];
    
    for (const p of this.weatherParticles) {
      // 更新位置
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      
      // 更新生命周期
      p.life -= deltaTime;
      
      // 如果粒子还活着，保留它
      if (p.life > 0) {
        aliveWeatherParticles.push(p);
      }
    }
    
    this.weatherParticles = aliveWeatherParticles;
  }

  /**
   * 清除所有粒子
   */
  clear(): void {
    this.particles = [];
    this.weatherParticles = [];
  }

  /**
   * 清除天气粒子
   */
  clearWeatherParticles(): void {
    this.weatherParticles = [];
  }

  /**
   * 获取粒子数量
   * @returns {number} 粒子数量
   */
  getParticleCount(): number {
    return this.particles.length;
  }

  /**
   * 获取天气粒子数量
   * @returns {number} 天气粒子数量
   */
  getWeatherParticleCount(): number {
    return this.weatherParticles.length;
  }

  /**
   * 获取粒子限制
   * @returns {number} 粒子限制
   */
  getParticleLimit(): number {
    return this.particleLimit;
  }

  /**
   * 设置粒子限制
   * @param {number} limit - 新的粒子限制
   */
  setParticleLimit(limit: number): void {
    this.particleLimit = limit;
    this.isLowPerfDevice = this.particleLimit <= 200;
    this.saveParticleLimit();
  }

  /**
   * 检查是否为低性能设备
   * @returns {boolean} 是否为低性能设备
   */
  isLowPerformanceDevice(): boolean {
    return this.isLowPerfDevice;
  }

  /**
   * 调整粒子限制基于性能
   * @param {number} frameTime - 帧时间（毫秒）
   */
  adjustLimitBasedOnPerformance(frameTime: number): void {
    if (frameTime > 33) {
      // 帧时间超过33ms（~30fps），减少粒子限制
      this.particleLimit = Math.max(100, this.particleLimit - 50);
    } else if (frameTime < 16) {
      // 帧时间低于16ms（~60fps），增加粒子限制
      this.particleLimit = Math.min(500, this.particleLimit + 50);
    }
    
    this.isLowPerfDevice = this.particleLimit <= 200;
    this.saveParticleLimit();
  }

  /**
   * 获取粒子密度（当前数量/限制）
   * @returns {number} 粒子密度（0-1）
   */
  getParticleDensity(): number {
    return this.particles.length / this.particleLimit;
  }

  /**
   * 检查是否可以添加更多粒子
   * @param {number} count - 要添加的粒子数量
   * @returns {boolean} 是否可以添加
   */
  canAddParticles(count: number = 1): boolean {
    return this.particles.length + count <= this.particleLimit;
  }

  /**
   * 获取粒子统计信息
   * @returns {Object} 粒子统计信息
   */
  getStats(): {
    total: number;
    weather: number;
    limit: number;
    density: number;
    isLowPerf: boolean;
  } {
    return {
      total: this.particles.length,
      weather: this.weatherParticles.length,
      limit: this.particleLimit,
      density: this.getParticleDensity(),
      isLowPerf: this.isLowPerfDevice
    };
  }
}