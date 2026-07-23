﻿﻿﻿﻿﻿﻿﻿﻿﻿/**
 * @fileoverview 雷达激光系统模块
 * @description 负责管理雷达激光武器的激活、自动追踪、射击和过期清理
 */

import { RoachState, RoachType, type RadarLaser, type Roach, ParticleType } from '../../types';
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
  onAddParticle?: (particle: any) => void;
  /** 杀死蟑螂回调 */
  onKillRoach?: (roach: Roach, index: number) => void;
}

/**
 * 雷达激光系统类
 */
export class RadarLaserSystem {
  private config: RadarLaserSystemConfig;
  private radarLaser: RadarLaser;

  constructor(config: RadarLaserSystemConfig) {
    this.config = config;
    this.radarLaser = {
      active: false,
      timer: 0,
      duration: BALANCE_CONFIG.radarLaser.duration,
      targetId: null,
      fireTimer: 0,
      fireInterval: BALANCE_CONFIG.radarLaser.fireInterval,
      damage: BALANCE_CONFIG.radarLaser.damage,
      laserAlpha: 0,
      shotsRemaining: BALANCE_CONFIG.radarLaser.shotsRemaining,
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
    if (this.radarLaser.active) {
      this.radarLaser.timer = this.radarLaser.duration;
      return;
    }
    this.radarLaser.active = true;
    this.radarLaser.timer = this.radarLaser.duration;
    this.radarLaser.fireTimer = 0;
    this.radarLaser.targetId = null;
    this.radarLaser.laserAlpha = 1;
    this.radarLaser.shotsRemaining = BALANCE_CONFIG.radarLaser.shotsRemaining;
    this.config.onPlayRadarActivate?.();
    this.config.onVibrateItemUse?.();
    this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 60, TEXT_CONFIG.combat.radarActivate, FLOAT_COLOR.shield);
    this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 40, TEXT_CONFIG.combat.radarDesc, FLOAT_COLOR.radarDesc);
  }

  // ========== 更新 ==========
  updateRadarLaser(deltaTime: number, roaches: Roach[], playerX: number, playerY: number): void {
    if (!this.radarLaser.active) return;

    const prevTimer = this.radarLaser.timer;
    this.radarLaser.timer -= deltaTime;
    this.radarLaser.fireTimer -= deltaTime;

    // 3秒警告
    if (prevTimer > 3 && this.radarLaser.timer <= 3) {
      this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 80, TEXT_CONFIG.combat.radarCountdown(3), FLOAT_COLOR.shield);
    }
    if (prevTimer > 1 && this.radarLaser.timer <= 1) {
      this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 60, TEXT_CONFIG.combat.radarClosing, FLOAT_COLOR.warning);
    }

    if (this.radarLaser.timer <= 0) {
      this.radarLaser.active = false;
      this.radarLaser.timer = 0;
      this.radarLaser.laserAlpha = 0;
      this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 50, TEXT_CONFIG.combat.radarClosed, FLOAT_COLOR.expired);
      return;
    }

    // 查找目标
    let target = roaches.find(r => r.id === this.radarLaser.targetId && r.state === RoachState.ALIVE);
    if (!target) {
      // 找最近的存活蟑螂（优先无装甲，后备装甲）
      let minDistUnarmored = Infinity;
      let closestUnarmored: Roach | undefined = undefined;
      let minDistArmored = Infinity;
      let closestArmored: Roach | undefined = undefined;
      for (const r of roaches) {
        if (r.state !== RoachState.ALIVE || r.isBoss) continue;
        const dx = r.x - playerX;
        const dy = r.y - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (r.armorHp > 0) {
          if (dist < minDistArmored) {
            minDistArmored = dist;
            closestArmored = r;
          }
        } else {
          if (dist < minDistUnarmored) {
            minDistUnarmored = dist;
            closestUnarmored = r;
          }
        }
      }
      target = closestUnarmored ?? closestArmored;
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
      this.config.onPlayRadarShot?.();

      // 对Boss无效
      if (target.isBoss) return;
      // 跳过正在放置炸弹的定时自爆蟑螂
      if (target.type === RoachType.TIMED_SUICIDE && target.placeTimer && target.placeTimer > 0) return;

      const damage = this.radarLaser.damage;
      target.hp -= damage;
      target.damageFlash = 1;

      this.config.onSpawnSparkParticles?.(target.x, target.y, 8);
      this.config.onAddParticle?.({
        x: target.x, y: target.y,
        vx: 0, vy: -20,
        life: 0.3, maxLife: 0.3,
        size: 8, color: '#22d3ee',
        type: ParticleType.EXPLOSION,
      });

      if (this.radarLaser.shotsRemaining > 0) {
        this.config.onAddFloatingText?.(playerX + 30, playerY - 40, TEXT_CONFIG.combat.radarShot(this.radarLaser.shotsRemaining), FLOAT_COLOR.shield);
      } else {
        this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 50, TEXT_CONFIG.combat.radarExhausted, FLOAT_COLOR.expired);
        this.radarLaser.active = false;
        this.radarLaser.laserAlpha = 0;
      }

      if (target.hp <= 0) {
        const index = roaches.indexOf(target);
        this.config.onKillRoach?.(target, index);
        this.config.onAddFloatingText?.(target.x, target.y - 20, TEXT_CONFIG.combat.radarKill, FLOAT_COLOR.shield);
        this.radarLaser.targetId = null;
      } else {
        this.config.onAddFloatingText?.(target.x, target.y - 30, TEXT_CONFIG.combat.radarDamage(damage), FLOAT_COLOR.shield);
      }
    }
  }

  reset(): void {
    this.radarLaser = {
      active: false, timer: 0, duration: BALANCE_CONFIG.radarLaser.duration, targetId: null,
      fireTimer: 0, fireInterval: BALANCE_CONFIG.radarLaser.fireInterval, damage: BALANCE_CONFIG.radarLaser.damage, laserAlpha: 0, shotsRemaining: BALANCE_CONFIG.radarLaser.shotsRemaining,
    };
  }
}