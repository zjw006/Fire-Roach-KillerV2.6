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
import { BALANCE_CONFIG, TEXT_CONFIG, FLOAT_COLOR, RENDER_COLOR } from '../../data';

/** 火区类型常量 */
const FZ_ICE = 'ice' as const;
const FZ_POISON = 'poison' as const;
const FZ_FIRE = 'fire' as const;

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
  onSpawnPoisonExplosion?: (x: number, y: number) => void;
  /** 屏幕震动回调 */
  onScreenShake?: (amount: number) => void;
  /** 对蟑螂造成伤害回调（统一伤害入口，避免直接修改蟑螂状态） */
  onApplyDamageToRoach?: (r: Roach, damage: number) => void;
  /** 应用粘性减速效果回调 */
  onApplyStickyToRoach?: (r: Roach, stuckTimer: number, speedRatio: number) => void;
  /** 应用中毒效果回调 */
  onApplyPoisonToRoach?: (r: Roach, poisonTimer: number, poisonDamage: number, initialDamage: number) => void;
  /** 应用燃烧效果回调 */
  onApplyBurnToRoach?: (r: Roach, damage: number, burnDamage: number) => void;
  /** 显示装甲免疫文字回调 */
  onShowArmorImmune?: (r: Roach) => void;
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
   * @param roaches 蟑螂数组（仅用于碰撞检测，不直接修改）
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
          // 落地后立即移除，不再占用数组
          this.throwables.splice(i, 1);
          continue;
        }
      }

      // 生命周期结束（空中过期：使用目标位置落地）
      if (t.life <= 0) {
        if (!t.hasLanded) {
          // 修正：空中过期时使用目标位置，而非当前空中位置
          t.y = t.targetY;
          t.hasLanded = true;
          this.onThrowableLand(t, roaches);
        }
        this.throwables.splice(i, 1);
      }
    }
  }

  // ========== 落地处理 ==========

  /**
   * 检查蟑螂是否在投掷物范围内且可被影响
   * @returns 是否满足条件（范围外或已跳过则返回 false）
   */
  private static isRoachInRange(r: Roach, t: ThrowableProjectile, radius: number): boolean {
    if (r.state !== RoachState.ALIVE || r.isBoss) return false;
    if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) return false;
    const dx = r.x - t.x;
    const dy = r.y - t.y;
    return Math.sqrt(dx * dx + dy * dy) < radius;
  }

  /**
   * 处理装甲免疫（返回 true 表示免疫）
   */
  private checkArmorImmune(r: Roach): boolean {
    if (r.armorHp > 0) {
      this.config.onShowArmorImmune?.(r);
      return true;
    }
    return false;
  }

  /**
   * 投掷物落地处理
   * 通过回调修改蟑螂状态，避免职责越界
   */
  private onThrowableLand(t: ThrowableProjectile, roaches: Roach[]): void {
    switch (t.type) {
      case 'sticky':
        this.applyStickyLand(t, roaches);
        break;
      case 'poison':
        this.applyPoisonLand(t, roaches);
        break;
      case 'molotov':
        this.applyMolotovLand(t, roaches);
        break;
    }

    // 通用火花粒子
    this.config.onSpawnSparkParticles?.(t.x, t.y, BALANCE_CONFIG.throwable.sparkCount);
  }

  /** 粘性投掷物落地：减速 + 冰区域 */
  private applyStickyLand(t: ThrowableProjectile, roaches: Roach[]): void {
    const cfg = BALANCE_CONFIG.throwable.sticky;
    for (const r of roaches) {
      if (!ThrowableSystem.isRoachInRange(r, t, cfg.radius)) continue;
      this.config.onApplyStickyToRoach?.(r, cfg.stuckTimer, cfg.speedRatio);
      this.config.onApplyDamageToRoach?.(r, cfg.damage);
    }
    this.config.onAddFireZone?.({
      x: t.x, y: t.y, radius: cfg.radius,
      damagePerSecond: cfg.fireZoneDps,
      life: cfg.fireZoneLife, maxLife: cfg.fireZoneLife,
      type: FZ_ICE,
    });
    this.config.onSpawnIceExplosion?.(t.x, t.y, cfg.radius);
    this.config.onAddFloatingText?.(t.x, t.y - 20, TEXT_CONFIG.combat.stickyLand, FLOAT_COLOR.switch);
  }

  /** 毒投掷物落地：中毒 + 毒区域 */
  private applyPoisonLand(t: ThrowableProjectile, roaches: Roach[]): void {
    const cfg = BALANCE_CONFIG.throwable.poison;
    for (const r of roaches) {
      if (!ThrowableSystem.isRoachInRange(r, t, cfg.radius)) continue;
      if (this.checkArmorImmune(r)) continue;
      this.config.onApplyPoisonToRoach?.(r, cfg.poisonTimer, cfg.poisonDamage, cfg.initialDamage);
    }
    this.config.onAddFireZone?.({
      x: t.x, y: t.y, radius: cfg.radius,
      damagePerSecond: cfg.fireZoneDps,
      life: cfg.fireZoneLife, maxLife: cfg.fireZoneLife,
      type: FZ_POISON,
    });
    this.config.onSpawnPoisonExplosion?.(t.x, t.y);
    this.config.onAddFloatingText?.(t.x, t.y - 20, TEXT_CONFIG.combat.poisonLand, FLOAT_COLOR.fan);
  }

  /** 燃烧瓶落地：爆炸 + 火区域 */
  private applyMolotovLand(t: ThrowableProjectile, roaches: Roach[]): void {
    const cfg = BALANCE_CONFIG.throwable.molotov;
    for (const r of roaches) {
      if (!ThrowableSystem.isRoachInRange(r, t, cfg.radius)) continue;
      if (this.checkArmorImmune(r)) continue;
      const dx = r.x - t.x;
      const dy = r.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dmg = cfg.baseDamage * (1 - dist / cfg.radius);
      this.config.onApplyBurnToRoach?.(r, dmg, dmg * cfg.burnDamageMultiplier);
    }
    this.config.onAddFireZone?.({
      x: t.x, y: t.y, radius: cfg.radius,
      damagePerSecond: cfg.fireZoneDps,
      life: cfg.fireZoneLife, maxLife: cfg.fireZoneLife,
      type: FZ_FIRE,
    });
    this.config.onSpawnExplosionParticles?.(t.x, t.y, BALANCE_CONFIG.throwable.explosionParticleCount);
    this.config.onScreenShake?.(BALANCE_CONFIG.screenShake.biggerExplosion);
    this.config.onAddFloatingText?.(t.x, t.y - 20, TEXT_CONFIG.combat.molotovLand, FLOAT_COLOR.warning);
  }

  // ========== 静态渲染 ==========

  /** 将 rgb 颜色字符串转换为 rgba */
  private static toRgba(rgbColor: string, alpha: number): string {
    // 健壮的转换：支持 rgb(r, g, b) 和 #rrggbb 格式
    const rgbMatch = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
    }
    const hexMatch = rgbColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
    if (hexMatch) {
      return `rgba(${parseInt(hexMatch[1], 16)}, ${parseInt(hexMatch[2], 16)}, ${parseInt(hexMatch[3], 16)}, ${alpha})`;
    }
    // fallback: 返回原色
    return rgbColor;
  }

  /**
   * 渲染所有投掷物
   */
  static renderThrowables(ctx: CanvasRenderingContext2D, throwables: ThrowableProjectile[]): void {
    const tCfg = BALANCE_CONFIG.render.renderUtils.throwable;
    for (const t of throwables) {
      ctx.save();

      const colors: Record<string, string> = {
        sticky: RENDER_COLOR.throwableSticky,
        poison: RENDER_COLOR.throwablePoison,
        molotov: RENDER_COLOR.throwableMolotov,
      };
      const color = colors[t.type] || RENDER_COLOR.particleDefault;

      // 发光效果
      const glowGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, tCfg.glowRadius);
      glowGrad.addColorStop(0, ThrowableSystem.toRgba(color, 0.8));
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(t.x, t.y, tCfg.glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 瓶身形状
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, tCfg.bottleRadius, 0, Math.PI * 2);
      ctx.fill();

      // 拖尾
      ctx.globalAlpha = tCfg.trailAlpha1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x - t.vx * tCfg.trailFactor1, t.y - t.vy * tCfg.trailFactor1, tCfg.trailRadius1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = tCfg.trailAlpha2;
      ctx.beginPath();
      ctx.arc(t.x - t.vx * tCfg.trailFactor2, t.y - t.vy * tCfg.trailFactor2, tCfg.trailRadius2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}