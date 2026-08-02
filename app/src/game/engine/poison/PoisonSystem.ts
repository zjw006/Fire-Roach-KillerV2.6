/**
 * @fileoverview 毒雾系统模块
 * @description 负责管理毒雾爆炸粒子、毒雾效果应用。
 *              伤害计算和区域添加通过回调委托给外部，实现职责分离。
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
  /** 添加火焰/毒雾区域回调（避免直接修改外部数组） */
  onAddZone?: (zone: FireZone) => void;
  /** 伤害回调（统一伤害入口，避免分散在模块内） */
  onDamageRoach?: (roach: Roach, damage: number) => void;
  /** 生成毒雾爆炸粒子回调 */
  onSpawnPoisonExplosion?: (x: number, y: number) => void;
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
   * 修复 P2：移除未使用的 _radius 参数
   * 修复 P1：maxLife 与 life 统一使用随机值
   * @param particles 粒子数组（会被直接修改）
   * @param x X坐标
   * @param y Y坐标
   */
  static spawnPoisonExplosion(
    particles: Particle[],
    x: number,
    y: number
  ): void {
    const cfg = BALANCE_CONFIG.poisonCloud;
    for (let i = 0; i < cfg.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cfg.speedMin + Math.random() * cfg.speedMax;
      const life = cfg.lifeMin + Math.random() * cfg.lifeMax;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life,
        maxLife: life, // 修复 P1：统一使用随机值
        size: cfg.sizeMin + Math.random() * cfg.sizeMax,
        color: `hsl(${260 + Math.random() * 30}, 80%, ${50 + Math.random() * 20}%)`,
        type: ParticleType.POISON_CLOUD,
      });
    }
  }

  // ========== 实例方法 ==========

  /**
   * 应用毒雾效果到指定位置
   * 修复 P1：中毒效果叠加（延长计时器，取最大伤害）
   * 修复 P1：通过 onAddZone 回调添加区域，避免直接修改 fireZones
   * 修复 P2：通过 onDamageRoach 回调统一伤害入口
   * 修复 P2：浮动文字颜色使用 TEXT_CONFIG.combat.poisonHit.color
   * @param roaches 蟑螂数组（会被直接修改 poisonTimer/poisonDamage）
   * @param x X坐标
   * @param y Y坐标
   * @param effectRadiusX X方向效果半径
   * @param effectRadiusY Y方向效果半径
   */
  applyPoisonEffect(
    roaches: Roach[],
    x: number,
    y: number,
    effectRadiusX: number,
    effectRadiusY: number
  ): void {
    const rx = effectRadiusX;
    const ry = effectRadiusY;
    const poisonCfg = BALANCE_CONFIG.throwable.poison;
    let hitCount = 0;

    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
      const dx = (r.x - x) / rx;
      const dy = (r.y - y) / ry;
      if (dx * dx + dy * dy < 1) {
        // 修复 P1：中毒效果叠加 — 延长计时器（上限 maxPoisonTimer），取最大伤害
        const newTimer = r.poisonTimer + poisonCfg.poisonTimer;
        r.poisonTimer = Math.min(newTimer, poisonCfg.maxPoisonTimer);
        r.poisonDamage = Math.max(r.poisonDamage, poisonCfg.poisonDamageMax);
        // 修复 P2：统一伤害入口
        if (this.config.onDamageRoach) {
          this.config.onDamageRoach(r, poisonCfg.initialDamage);
        } else {
          r.hp -= poisonCfg.initialDamage;
        }
        hitCount++;
      }
    }

    // 修复 P1：通过回调添加区域，避免直接修改 fireZones
    this.config.onAddZone?.({
      x, y, radius: rx * 0.5,
      damagePerSecond: BALANCE_CONFIG.poisonCloud.fireZoneDps,
      life: BALANCE_CONFIG.poisonCloud.fireZoneLife,
      maxLife: BALANCE_CONFIG.poisonCloud.fireZoneLife,
      type: 'poison',
    });

    // 修复 P2：通过回调生成粒子，避免直接修改外部粒子数组
    this.config.onSpawnPoisonExplosion?.(x, y);

    // 修复 P2：使用 TEXT_CONFIG.combat.poisonHit.color
    this.config.onAddFloatingText?.(
      x, y - 20,
      hitCount > 0 ? TEXT_CONFIG.combat.poisonHit.text(hitCount) : TEXT_CONFIG.combat.poisonLand.text,
      TEXT_CONFIG.combat.poisonHit.color
    );
    this.config.onScreenShake?.(BALANCE_CONFIG.screenShake.smallExplosion);
  }
}