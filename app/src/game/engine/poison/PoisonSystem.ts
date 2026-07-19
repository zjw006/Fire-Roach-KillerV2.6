/**
 * @fileoverview 毒雾系统模块
 * @description 负责管理毒雾爆炸粒子、毒雾效果应用
 */

import { RoachState, RoachType, ParticleType } from '../../types';
import type { Particle, Roach, FireZone } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/**
 * 毒雾系统配置接口
 */
export interface PoisonSystemConfig {
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 屏幕震动回调 */
  onScreenShake?: (amount: number) => void;
}

/**
 * 毒雾系统类
 * @description 管理毒雾效果
 */
export class PoisonSystem {
  /** 系统配置 */
  private config: PoisonSystemConfig;

  constructor(config: PoisonSystemConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<PoisonSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========== 静态方法 ==========

  /**
   * 生成毒雾爆炸粒子
   * @param particles 粒子数组（会被直接修改）
   * @param x X坐标
   * @param y Y坐标
   * @param _radius 爆炸半径（当前未使用）
   */
  static spawnPoisonExplosion(
    particles: Particle[],
    x: number,
    y: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _radius: number
  ): void {
    for (let i = 0; i < BALANCE_CONFIG.poisonCloud.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = BALANCE_CONFIG.poisonCloud.speedMin + Math.random() * BALANCE_CONFIG.poisonCloud.speedMax;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: BALANCE_CONFIG.poisonCloud.lifeMin + Math.random() * BALANCE_CONFIG.poisonCloud.lifeMax,
        maxLife: BALANCE_CONFIG.poisonCloud.maxLife,
        size: BALANCE_CONFIG.poisonCloud.sizeMin + Math.random() * BALANCE_CONFIG.poisonCloud.sizeMax,
        color: `hsl(${260 + Math.random() * 30}, 80%, ${50 + Math.random() * 20}%)`,
        type: ParticleType.POISON_CLOUD,
      });
    }
  }

  // ========== 实例方法 ==========

  /**
   * 应用毒雾效果到指定位置
   * @param roaches 蟑螂数组（会被直接修改）
   * @param fireZones 火焰区域数组（会被直接修改）
   * @param x X坐标
   * @param y Y坐标
   * @param effectRadiusX X方向效果半径
   * @param effectRadiusY Y方向效果半径
   * @returns 需要添加的粒子
   */
  applyPoisonEffect(
    roaches: Roach[],
    fireZones: FireZone[],
    x: number,
    y: number,
    effectRadiusX: number,
    effectRadiusY: number
  ): Particle[] {
    const particles: Particle[] = [];
    const rx = effectRadiusX;
    const ry = effectRadiusY;
    let hitCount = 0;

    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
      const dx = (r.x - x) / rx;
      const dy = (r.y - y) / ry;
      if (dx * dx + dy * dy < 1) {
        r.poisonTimer = BALANCE_CONFIG.throwable.poison.poisonTimer;
        r.poisonDamage = BALANCE_CONFIG.throwable.poison.poisonDamage;
        r.hp -= BALANCE_CONFIG.throwable.poison.initialDamage;
        hitCount++;
      }
    }

    fireZones.push({
      x, y, radius: rx * 0.5,
      damagePerSecond: BALANCE_CONFIG.poisonCloud.fireZoneDps,
      life: BALANCE_CONFIG.poisonCloud.fireZoneLife,
      maxLife: BALANCE_CONFIG.poisonCloud.fireZoneLife,
      type: 'poison',
    });

    PoisonSystem.spawnPoisonExplosion(particles, x, y, rx * 0.5);

    this.config.onAddFloatingText?.(
      x, y - 20,
      hitCount > 0 ? `毒雾!(${hitCount}只)` : '毒雾!',
      '#a78bfa'
    );
    this.config.onScreenShake?.(BALANCE_CONFIG.screenShake.smallExplosion);

    return particles;
  }
}