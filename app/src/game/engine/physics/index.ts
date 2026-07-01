/**
 * 物理粒子系统模块入口
 * 负责管理游戏中的物理效果和粒子系统
 */

import { ParticleManager } from './ParticleManager';
import { PhysicsSystem } from './PhysicsSystem';
import { ParticleType } from '../../types';

export { ParticleManager, PhysicsSystem, ParticleType };

/**
 * 粒子效果配置接口
 */
export interface ParticleEffectConfig {
  /** 粒子类型 */
  type: ParticleType;
  /** 粒子数量 */
  count: number;
  /** 粒子颜色 */
  color: string;
  /** 粒子大小范围 [最小, 最大] */
  sizeRange: [number, number];
  /** 粒子生命周期范围 [最小, 最大] */
  lifeRange: [number, number];
  /** 粒子速度范围 [最小, 最大] */
  speedRange: [number, number];
  /** 粒子扩散范围 */
  spread: number;
  /** 重力影响 */
  gravity: number;
  /** 是否淡出 */
  fade: boolean;
  /** 是否拖尾 */
  trail: boolean;
}

/**
 * 预定义的粒子效果配置
 */
export const PARTICLE_EFFECTS: Record<string, ParticleEffectConfig> = {
  /** 火焰效果 */
  fire: {
    type: ParticleType.FIRE,
    count: 15,
    color: '#ff6b00',
    sizeRange: [3, 7],
    lifeRange: [0.5, 1.0],
    speedRange: [30, 90],
    spread: 20,
    gravity: 0,
    fade: true,
    trail: false
  },
  
  /** 烟雾效果 */
  smoke: {
    type: ParticleType.SMOKE,
    count: 10,
    color: '#666666',
    sizeRange: [5, 12],
    lifeRange: [1.0, 2.0],
    speedRange: [10, 30],
    spread: 30,
    gravity: -50,
    fade: true,
    trail: false
  },
  
  /** 爆炸效果 */
  explosion: {
    type: ParticleType.EXPLOSION,
    count: 25,
    color: '#ff3300',
    sizeRange: [4, 10],
    lifeRange: [0.3, 0.8],
    speedRange: [50, 150],
    spread: 50,
    gravity: 0,
    fade: true,
    trail: false
  },
  
  /** 火花效果 */
  spark: {
    type: ParticleType.SPARK,
    count: 20,
    color: '#ffff00',
    sizeRange: [2, 4],
    lifeRange: [0.2, 0.5],
    speedRange: [100, 200],
    spread: 40,
    gravity: 300,
    fade: true,
    trail: true
  },
  
  /** 血液效果 */
  blood: {
    type: ParticleType.BLOOD,
    count: 12,
    color: '#cc0000',
    sizeRange: [3, 6],
    lifeRange: [0.8, 1.5],
    speedRange: [40, 80],
    spread: 25,
    gravity: 500,
    fade: false,
    trail: false
  },
  
  /** 冰霜效果 */
  ice: {
    type: ParticleType.ICE,
    count: 15,
    color: '#00ccff',
    sizeRange: [4, 8],
    lifeRange: [0.6, 1.2],
    speedRange: [20, 60],
    spread: 15,
    gravity: 0,
    fade: true,
    trail: false
  }
};

/**
 * 创建粒子效果
 * @param manager 粒子管理器
 * @param effectName 效果名称
 * @param x X坐标
 * @param y Y坐标
 * @returns 创建的粒子数量
 */
export function createParticleEffect(
  manager: ParticleManager,
  effectName: string,
  x: number,
  y: number
): number {
  const config = PARTICLE_EFFECTS[effectName];
  if (!config) return 0;
  
  switch (config.type) {
    case ParticleType.FIRE:
      return manager.createFlameParticles(x, y, config.count, config.spread);
      
    case ParticleType.SMOKE:
      return manager.createSmokeParticles(x, y, config.count, config.spread);
      
    case ParticleType.EXPLOSION:
      return manager.createExplosionParticles(x, y, config.count);
      
    case ParticleType.SPARK:
      return manager.createSparkParticles(x, y, config.count, config.spread);
      
    case ParticleType.BLOOD:
      // 使用通用的火焰粒子方法创建血液效果
      return manager.createFlameParticles(x, y, config.count, config.spread);
      
    case ParticleType.ICE:
      // 使用通用的火焰粒子方法创建冰霜效果
      return manager.createFlameParticles(x, y, config.count, config.spread);
      
    default:
      return 0;
  }
}

/**
 * 物理系统配置接口
 */
export interface PhysicsConfig {
  /** 重力加速度 (像素/秒²) */
  gravity: number;
  /** 地面摩擦力系数 */
  friction: number;
  /** 空气阻力系数 */
  airResistance: number;
  /** 反弹系数 */
  bounceFactor: number;
  /** 最大下落速度 */
  maxFallSpeed: number;
}

/**
 * 默认物理配置
 */
export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: 980,
  friction: 0.95,
  airResistance: 0.99,
  bounceFactor: 0.7,
  maxFallSpeed: 2000
};

/**
 * 创建物理系统实例
 * @param config 物理配置
 * @returns 物理系统实例
 */
export function createPhysicsSystem(config?: Partial<PhysicsConfig>): PhysicsSystem {
  const fullConfig = { ...DEFAULT_PHYSICS_CONFIG, ...config };
  return new PhysicsSystem(
    fullConfig.gravity,
    fullConfig.friction,
    fullConfig.airResistance
  );
}

/**
 * 创建粒子管理器实例
 * @param particleLimit 粒子数量限制
 * @returns 粒子管理器实例
 */
export function createParticleManager(particleLimit: number = 300): ParticleManager {
  return new ParticleManager(particleLimit);
}

/**
 * 检查设备性能并调整粒子限制
 * @param manager 粒子管理器
 * @param particleCountThreshold 粒子数量阈值
 * @returns 是否调整了粒子限制
 */
export function adjustParticleLimitByPerformance(
  manager: ParticleManager,
  particleCountThreshold: number = 200
): boolean {
  const currentParticles = manager.getParticleCount();
  if (currentParticles > particleCountThreshold) {
    const newLimit = Math.max(100, Math.floor(manager.getParticleLimit() * 0.8));
    manager.setParticleLimit(newLimit);
    return true;
  }
  return false;
}