/**
 * @fileoverview 投掷物系统模块
 * @description 负责管理游戏中所有投掷物的逻辑，包括飞行轨迹、碰撞检测、落地效果等
 */

import {
  type ThrowableProjectile,
  type Roach,
  type FireZone,
  RoachType,
  RoachState,
  ParticleType,
} from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG, FLOAT_COLOR } from '../../data';

/**
 * 投掷物系统配置接口
 */
export interface ThrowableSystemConfig {
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 添加火焰区域回调 */
  onAddFireZone?: (fireZone: FireZone) => void;
  /** 生成火花粒子回调 */
  onSpawnSparkParticles?: (x: number, y: number, count: number) => void;
  /** 生成爆炸粒子回调 */
  onSpawnExplosionParticles?: (x: number, y: number, count: number) => void;
  /** 生成冰爆炸粒子回调 */
  onSpawnIceExplosion?: (x: number, y: number, radius: number) => void;
  /** 生成毒雾爆炸粒子回调 */
  onSpawnPoisonExplosion?: (x: number, y: number, radius: number) => void;
  /** 屏幕震动回调 */
  onScreenShake?: (amount: number) => void;
}

/**
 * 投掷物系统类
 * @description 管理游戏中所有投掷物的逻辑，包括飞行轨迹、碰撞检测、落地效果等
 */
export class ThrowableSystem {
  /** 系统配置 */
  private config: ThrowableSystemConfig;

  /** 投掷物数组 */
  private throwables: ThrowableProjectile[] = [];

  constructor(config: ThrowableSystemConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<ThrowableSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========== 投掷物管理 ==========

  /** 添加投掷物 */
  addThrowable(throwable: ThrowableProjectile): void {
    this.throwables.push(throwable);
  }

  /** 获取所有投掷物（用于渲染） */
  getThrowables(): ThrowableProjectile[] {
    return this.throwables;
  }

  /** 清除所有投掷物 */
  reset(): void {
    this.throwables = [];
  }

  // ========== 更新 ==========

  /**
   * 更新所有投掷物逻辑
   * @param deltaTime 帧间隔时间
   * @param roaches 蟑螂数组（会被直接修改）
   */
  update(deltaTime: number, roaches: Roach[]): void {
    for (let i = this.throwables.length - 1; i >= 0; i--) {
      const t = this.throwables[i];
      t.life -= deltaTime;

      if (!t.hasLanded) {
        // 应用重力
        t.vy += t.gravity * deltaTime;
        t.x += t.vx * deltaTime;
        t.y += t.vy * deltaTime;

        // 检查是否到达或超过目标Y坐标（向下运动）
        if (t.vy > 0 && t.y >= t.targetY) {
          t.y = t.targetY;
          t.hasLanded = true;
          this.onThrowableLand(t, roaches);
        }
      }

      // 生命周期结束
      if (t.life <= 0) {
        if (!t.hasLanded) {
          this.onThrowableLand(t, roaches);
        }
        this.throwables.splice(i, 1);
      }
    }
  }

  // ========== 落地处理 ==========

  /**
   * 投掷物落地处理
   */
  private onThrowableLand(t: ThrowableProjectile, roaches: Roach[]): void {
    switch (t.type) {
      case 'sticky': {
        // 粘性区域：困住范围内的蟑螂（对Boss无效）
        const radius = BALANCE_CONFIG.throwable.sticky.radius;
        for (const r of roaches) {
          if (r.state !== RoachState.ALIVE || r.isBoss) continue;
          if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
          const dx = r.x - t.x;
          const dy = r.y - t.y;
          if (Math.sqrt(dx * dx + dy * dy) < radius) {
            r.stuckTimer = BALANCE_CONFIG.throwable.sticky.stuckTimer;
            r.speed = r.baseSpeed * BALANCE_CONFIG.throwable.sticky.speedRatio;
            r.hp -= BALANCE_CONFIG.throwable.sticky.damage;
          }
        }
        // 持续冰区域
        this.config.onAddFireZone?.({
          x: t.x, y: t.y, radius,
          damagePerSecond: BALANCE_CONFIG.throwable.sticky.fireZoneDps,
          life: BALANCE_CONFIG.throwable.sticky.fireZoneLife, maxLife: BALANCE_CONFIG.throwable.sticky.fireZoneLife,
          type: 'ice',
        });
        this.config.onSpawnIceExplosion?.(t.x, t.y, radius);
        this.config.onAddFloatingText?.(t.x, t.y - 20, TEXT_CONFIG.combat.stickyLand, FLOAT_COLOR.switch);
        break;
      }
      case 'poison': {
        // 毒雾云：持续伤害（对Boss无效）
        const radius = BALANCE_CONFIG.throwable.poison.radius;
        for (const r of roaches) {
          if (r.state !== RoachState.ALIVE || r.isBoss) continue;
          if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
          const dx = r.x - t.x;
          const dy = r.y - t.y;
          if (Math.sqrt(dx * dx + dy * dy) < radius) {
            // 装甲免疫
            if (r.armorHp > 0) {
              this.config.onAddFloatingText?.(r.x, r.y - 15, TEXT_CONFIG.combat.armorImmune, FLOAT_COLOR.armorImmune);
              continue;
            }
            r.poisonTimer = BALANCE_CONFIG.throwable.poison.poisonTimer;
            r.poisonDamage = BALANCE_CONFIG.throwable.poison.poisonDamage;
            r.hp -= BALANCE_CONFIG.throwable.poison.initialDamage;
          }
        }
        this.config.onAddFireZone?.({
          x: t.x, y: t.y, radius,
          damagePerSecond: BALANCE_CONFIG.throwable.poison.fireZoneDps,
          life: BALANCE_CONFIG.throwable.poison.fireZoneLife, maxLife: BALANCE_CONFIG.throwable.poison.fireZoneLife,
          type: 'poison',
        });
        this.config.onSpawnPoisonExplosion?.(t.x, t.y, radius);
        this.config.onAddFloatingText?.(t.x, t.y - 20, TEXT_CONFIG.combat.poisonLand, FLOAT_COLOR.fan);
        break;
      }
      case 'molotov': {
        // 火焰爆炸（对Boss无效）
        const radius = BALANCE_CONFIG.throwable.molotov.radius;
        for (const r of roaches) {
          if (r.state !== RoachState.ALIVE || r.isBoss) continue;
          if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
          const dx = r.x - t.x;
          const dy = r.y - t.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius) {
            // 装甲免疫
            if (r.armorHp > 0) {
              this.config.onAddFloatingText?.(r.x, r.y - 15, TEXT_CONFIG.combat.armorImmune, FLOAT_COLOR.armorImmune);
              continue;
            }
            const dmg = BALANCE_CONFIG.throwable.molotov.baseDamage * (1 - dist / radius);
            r.hp -= dmg;
            r.burnDamage = dmg * BALANCE_CONFIG.throwable.molotov.burnDamageMultiplier;
          }
        }
        this.config.onAddFireZone?.({
          x: t.x, y: t.y, radius,
          damagePerSecond: BALANCE_CONFIG.throwable.molotov.fireZoneDps,
          life: BALANCE_CONFIG.throwable.molotov.fireZoneLife, maxLife: BALANCE_CONFIG.throwable.molotov.fireZoneLife,
          type: 'fire',
        });
        this.config.onSpawnExplosionParticles?.(t.x, t.y, BALANCE_CONFIG.throwable.explosionParticleCount);
        this.config.onScreenShake?.(BALANCE_CONFIG.screenShake.biggerExplosion);
        this.config.onAddFloatingText?.(t.x, t.y - 20, TEXT_CONFIG.combat.molotovLand, FLOAT_COLOR.warning);
        break;
      }
    }

    // 通用火花粒子
    this.config.onSpawnSparkParticles?.(t.x, t.y, BALANCE_CONFIG.throwable.sparkCount);
  }

  // ========== 静态渲染 ==========

  /**
   * 渲染所有投掷物
   */
  static renderThrowables(ctx: CanvasRenderingContext2D, throwables: ThrowableProjectile[]): void {
    for (const t of throwables) {
      ctx.save();

      const colors: Record<string, string> = {
        sticky: '#facc15',
        poison: '#a78bfa',
        molotov: '#ff4400',
        shotgun: '#fbbf24',
      };
      const color = colors[t.type] || '#ffffff';

      // 发光效果
      const glowGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 15);
      glowGrad.addColorStop(0, color.replace(')', ', 0.8)').replace('rgb', 'rgba'));
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 15, 0, Math.PI * 2);
      ctx.fill();

      // 瓶身形状
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // 拖尾
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x - t.vx * 0.03, t.y - t.vy * 0.03, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(t.x - t.vx * 0.06, t.y - t.vy * 0.06, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}