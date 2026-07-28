﻿﻿﻿/**
 * @fileoverview 雷达激光系统模块
 * @description 负责管理雷达激光武器的激活、自动追踪、射击和过期清理。
 *              所有数值参数从 BALANCE_CONFIG.radarLaser 读取。
 */

import { RoachState, RoachType, ParticleType } from '../../types';
import type { RadarLaser, Roach, Particle } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG, FLOAT_COLOR } from '../../data';

/**
 * 雷达激光系统配置接口
 */
export interface RadarLaserSystemConfig {
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 播放雷达激活音效回调 */
  onPlayRadarActivate?: () => void;
  /** 播放雷达射击音效回调 */
  onPlayRadarShot?: () => void;
  /** 震动回调 */
  onVibrateItemUse?: () => void;
  /** 生成火花粒子回调 */
  onSpawnSparkParticles?: (x: number, y: number, count: number) => void;
  /** 添加粒子回调 */
  onAddParticle?: (particle: Particle) => void;
  /** 杀死蟑螂回调 */
  onKillRoach?: (roach: Roach, index: number) => void;
}

/**
 * 雷达激光系统类
 */
export class RadarLaserSystem {
  private config: RadarLaserSystemConfig;
  private radarLaser: RadarLaser;

  /** 倒计时警告标记（防止浮点精度跳过触发） */
  private _countdownWarned: Set<number> = new Set();

  /** 渐隐计时器（弹药耗尽后逐步关闭） */
  private _fadeOutTimer: number = 0;

  constructor(config: RadarLaserSystemConfig) {
    this.config = config;
    this.radarLaser = this.createDefaultState();
  }

  private createDefaultState(): RadarLaser {
    const cfg = BALANCE_CONFIG.radarLaser;
    return {
      active: false,
      timer: 0,
      duration: cfg.duration,
      targetId: null,
      fireTimer: 0,
      fireInterval: cfg.fireInterval,
      damage: cfg.damage,
      laserAlpha: 0,
      shotsRemaining: cfg.shotsRemaining,
    };
  }

  updateConfig(config: Partial<RadarLaserSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取雷达激光状态（用于渲染） */
  getState(): RadarLaser {
    return this.radarLaser;
  }

  // ========== 激活 ==========
  activateRadarLaser(): void {
    const cfg = BALANCE_CONFIG.radarLaser;
    const cx = this.config.canvasWidth / 2;
    const cy = this.config.canvasHeight / 2;
    const offsetY = cfg.textOffsetY;

    if (this.radarLaser.active) {
      this.radarLaser.timer = this.radarLaser.duration;
      this._fadeOutTimer = 0;
      return;
    }
    this.radarLaser.active = true;
    this.radarLaser.timer = this.radarLaser.duration;
    this.radarLaser.fireTimer = 0;
    this.radarLaser.targetId = null;
    this.radarLaser.shotsRemaining = cfg.shotsRemaining;
    this._countdownWarned.clear();
    this._fadeOutTimer = 0;

    this.config.onPlayRadarActivate?.();
    this.config.onVibrateItemUse?.();
    this.config.onAddFloatingText?.(cx, cy + offsetY.activate, TEXT_CONFIG.combat.radarActivate, FLOAT_COLOR.shield);
    this.config.onAddFloatingText?.(cx, cy + offsetY.desc, TEXT_CONFIG.combat.radarDesc, FLOAT_COLOR.radarDesc);
  }

  // ========== 更新 ==========
  updateRadarLaser(deltaTime: number, roaches: Roach[], playerX: number, playerY: number): void {
    const cfg = BALANCE_CONFIG.radarLaser;

    // 修复 P2：渐隐退出 — 弹药耗尽后不是立即关闭，而是逐步淡出
    if (this._fadeOutTimer > 0) {
      this._fadeOutTimer -= deltaTime;
      this.radarLaser.laserAlpha = Math.max(0, this._fadeOutTimer / cfg.fadeOutDuration);
      if (this._fadeOutTimer <= 0) {
        this.radarLaser.active = false;
        this.radarLaser.timer = 0;
        this.radarLaser.laserAlpha = 0;
      }
      return;
    }

    if (!this.radarLaser.active) return;

    this.radarLaser.timer -= deltaTime;
    this.radarLaser.fireTimer -= deltaTime;

    // 修复 P2：laserAlpha 平滑过渡（渐显）
    this.radarLaser.laserAlpha = Math.min(1, this.radarLaser.laserAlpha + cfg.fadeInSpeed * deltaTime);

    const cx = this.config.canvasWidth / 2;
    const cy = this.config.canvasHeight / 2;
    const offsetY = cfg.textOffsetY;

    // 修复 P1：倒计时警告使用布尔标记，避免浮点精度跳过触发
    for (const warnTime of cfg.countdownWarnTimes) {
      if (!this._countdownWarned.has(warnTime) && this.radarLaser.timer <= warnTime) {
        this._countdownWarned.add(warnTime);
        if (warnTime === 3) {
          this.config.onAddFloatingText?.(cx, cy + offsetY.countdown, TEXT_CONFIG.combat.radarCountdown(3), FLOAT_COLOR.shield);
        } else if (warnTime === 1) {
          this.config.onAddFloatingText?.(cx, cy + offsetY.closing, TEXT_CONFIG.combat.radarClosing, FLOAT_COLOR.warning);
        }
      }
    }

    if (this.radarLaser.timer <= 0) {
      this.radarLaser.active = false;
      this.radarLaser.timer = 0;
      this.radarLaser.laserAlpha = 0;
      this.config.onAddFloatingText?.(cx, cy + offsetY.closed, TEXT_CONFIG.combat.radarClosed, FLOAT_COLOR.expired);
      return;
    }

    // 修复 P1：全局搜索目标（不限于玩家周围）
    let target = roaches.find(r => r.id === this.radarLaser.targetId && r.state === RoachState.ALIVE);
    if (!target) {
      target = this.findBestTarget(roaches);
      if (target) {
        this.radarLaser.targetId = target.id;
      }
    }

    if (!target || target.state !== RoachState.ALIVE) {
      this.radarLaser.targetId = null;
      return;
    }

    // 发射激光
    if (this.radarLaser.fireTimer <= 0 && this.radarLaser.shotsRemaining > 0) {
      this.radarLaser.fireTimer = this.radarLaser.fireInterval;
      this.radarLaser.shotsRemaining--;

      // 修复 P1：发射前重新检查目标存活状态
      if (target.state !== RoachState.ALIVE) {
        this.radarLaser.targetId = null;
        return;
      }
      // 跳过正在放置炸弹的定时自爆蟑螂
      if (target.type === RoachType.TIMED_SUICIDE && target.placeTimer && target.placeTimer > 0) {
        return;
      }

      this.config.onPlayRadarShot?.();

      const damage = this.radarLaser.damage;
      target.hp -= damage;
      target.damageFlash = 1;

      this.config.onSpawnSparkParticles?.(target.x, target.y, cfg.sparkCount);
      this.config.onAddParticle?.({
        x: target.x, y: target.y,
        vx: 0, vy: cfg.impactParticle.vy,
        life: cfg.impactParticle.life, maxLife: cfg.impactParticle.life,
        size: cfg.impactParticle.size, color: FLOAT_COLOR.shield,
        type: ParticleType.EXPLOSION,
      });

      if (this.radarLaser.shotsRemaining > 0) {
        this.config.onAddFloatingText?.(
          playerX + cfg.shotTextOffsetX, playerY + offsetY.shot,
          TEXT_CONFIG.combat.radarShot(this.radarLaser.shotsRemaining), FLOAT_COLOR.shield
        );
      } else {
        // 修复 P2：弹药耗尽后渐隐退出，而不是立即关闭
        this.config.onAddFloatingText?.(cx, cy + offsetY.exhausted, TEXT_CONFIG.combat.radarExhausted, FLOAT_COLOR.expired);
        this._fadeOutTimer = cfg.fadeOutDuration;
        return;
      }

      if (target.hp <= 0) {
        // 修复 P1：使用 findIndex 基于 id 查找，避免 indexOf 引用比较
        const index = roaches.findIndex(r => r.id === target!.id);
        this.config.onKillRoach?.(target, index);
        this.config.onAddFloatingText?.(target.x, target.y + offsetY.kill, TEXT_CONFIG.combat.radarKill, FLOAT_COLOR.shield);
        this.radarLaser.targetId = null;
      } else {
        this.config.onAddFloatingText?.(target.x, target.y + offsetY.damage, TEXT_CONFIG.combat.radarDamage(damage), FLOAT_COLOR.shield);
      }
    }
  }

  /**
   * 查找最佳目标（全局搜索，不限于玩家周围）
   * 修复 P1：改为战场全局搜索，优先无装甲蟑螂
   * @param roaches 蟑螂数组
   * @returns 最佳目标，没有则返回 undefined
   */
  private findBestTarget(roaches: Roach[]): Roach | undefined {
    let bestUnarmored: Roach | undefined;
    let bestArmored: Roach | undefined;

    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      if (r.armorHp > 0) {
        if (!bestArmored) bestArmored = r;
      } else {
        if (!bestUnarmored) bestUnarmored = r;
      }
      // 找到无装甲目标即可停止（优先度最高）
      if (bestUnarmored && bestArmored) break;
    }

    return bestUnarmored ?? bestArmored;
  }

  reset(): void {
    this.radarLaser = this.createDefaultState();
    this._countdownWarned.clear();
    this._fadeOutTimer = 0;
  }
}