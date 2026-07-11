/**
 * @fileoverview 杀虫剂喷雾系统模块
 * @description 负责管理杀虫剂喷雾的激活、计时、粒子生成、伤害应用和过期清理
 */

import { RoachState, RoachType, ParticleType } from '../../types';
import type { Particle, Roach } from '../../types';
import { type InsecticideSprayState } from '../render/RenderUtils';

/**
 * 杀虫剂系统配置接口
 */
export interface InsecticideSystemConfig {
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 播放音效回调 */
  onPlaySound?: (soundName: string) => void;
  /** 震动回调 */
  onVibrate?: () => void;
  /** 屏幕震动回调 */
  onScreenShake?: (amount: number) => void;
}

/**
 * 杀虫剂喷雾系统类
 * @description 管理杀虫剂喷雾的完整生命周期
 */
export class InsecticideSystem {
  /** 系统配置 */
  private config: InsecticideSystemConfig;

  /** 杀虫剂喷雾状态 */
  private spray: InsecticideSprayState;

  constructor(config: InsecticideSystemConfig) {
    this.config = config;
    this.spray = {
      active: false,
      timer: 0,
      duration: 3,
      damageInterval: 0.3,
      damageTimer: 0,
      sprayAngle: -Math.PI / 2,
      spraySpread: (Math.PI * 2) / 3,
      baseDamage: 2,
    };
  }

  updateConfig(config: Partial<InsecticideSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取喷雾状态（用于渲染） */
  getState(): InsecticideSprayState {
    return this.spray;
  }

  // ========== 激活 ==========

  /**
   * 激活杀虫剂喷雾
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   */
  activate(canvasWidth: number, canvasHeight: number): void {
    if (this.spray.active) {
      this.spray.timer = this.spray.duration;
      return;
    }
    this.spray.active = true;
    this.spray.timer = this.spray.duration;
    this.spray.damageTimer = 0;
    this.config.onPlaySound?.('insecticide_spray');
    this.config.onVibrate?.();
    this.config.onAddFloatingText?.(canvasWidth / 2, canvasHeight / 2 - 60, '双侧毒气喷射!', '#4ade80');
    this.config.onAddFloatingText?.(canvasWidth / 2, canvasHeight / 2 - 40, '两侧横向毒雾3秒', '#86efac');
    this.config.onScreenShake?.(4);
  }

  // ========== 更新 ==========

  /**
   * 更新杀虫剂喷雾逻辑
   * @param deltaTime 帧间隔时间
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   * @param roaches 蟑螂数组（会被直接修改）
   * @returns 需要添加的粒子数组
   */
  update(
    deltaTime: number,
    canvasWidth: number,
    canvasHeight: number,
    defenseLineY: number,
    roaches: Roach[]
  ): Particle[] {
    if (!this.spray.active) return [];

    const particlesToAdd: Particle[] = [];
    this.spray.timer -= deltaTime;
    this.spray.damageTimer -= deltaTime;

    // 倒计时警告
    const prevTimer = this.spray.timer + deltaTime;
    if (prevTimer > 1 && this.spray.timer <= 1) {
      this.config.onAddFloatingText?.(canvasWidth / 2, canvasHeight / 2 - 80, '毒气喷射即将结束!', '#f87171');
    }

    // 过期处理
    if (this.spray.timer <= 0) {
      this.spray.active = false;
      this.spray.timer = 0;
      particlesToAdd.push(...this.spawnFadeOutParticles(canvasWidth, canvasHeight));
      this.config.onAddFloatingText?.(canvasWidth / 2, canvasHeight / 2 - 50, '毒气喷射结束', '#9ca3af');
      return particlesToAdd;
    }

    // 每帧生成喷雾粒子
    particlesToAdd.push(...this.spawnSprayParticles(canvasWidth, canvasHeight));

    // 按间隔造成伤害
    if (this.spray.damageTimer <= 0) {
      this.spray.damageTimer = this.spray.damageInterval;
      particlesToAdd.push(...this.applyDamage(canvasWidth, defenseLineY, roaches));
    }

    return particlesToAdd;
  }

  // ========== 粒子生成 ==========

  /**
   * 生成喷雾粒子（每帧调用）
   */
  private spawnSprayParticles(w: number, h: number): Particle[] {
    const particles: Particle[] = [];
    const cy = h / 2;

    // 左侧喷雾（向右喷射）
    for (let i = 0; i < 6; i++) {
      const py = cy + (Math.random() - 0.5) * h * 0.6;
      const life = 0.3 + Math.random() * 0.4;
      const speed = 100 + Math.random() * 80;
      const greenBase = 180 + Math.random() * 60;
      const alpha = 0.25 + Math.random() * 0.25;
      particles.push({
        x: 10 + Math.random() * 30, y: py,
        vx: speed * (0.5 + Math.random() * 0.5),
        vy: (Math.random() - 0.5) * 30,
        life, maxLife: life,
        size: 5 + Math.random() * 10,
        color: `rgba(${50 + Math.random() * 30}, ${greenBase}, ${50 + Math.random() * 20}, ${alpha})`,
        type: ParticleType.POISON_CLOUD,
      });
    }

    // 右侧喷雾（向左喷射）
    for (let i = 0; i < 6; i++) {
      const py = cy + (Math.random() - 0.5) * h * 0.6;
      const life = 0.3 + Math.random() * 0.4;
      const speed = 100 + Math.random() * 80;
      const greenBase = 180 + Math.random() * 60;
      const alpha = 0.25 + Math.random() * 0.25;
      particles.push({
        x: w - 10 - Math.random() * 30, y: py,
        vx: -speed * (0.5 + Math.random() * 0.5),
        vy: (Math.random() - 0.5) * 30,
        life, maxLife: life,
        size: 5 + Math.random() * 10,
        color: `rgba(${50 + Math.random() * 30}, ${greenBase}, ${50 + Math.random() * 20}, ${alpha})`,
        type: ParticleType.POISON_CLOUD,
      });
    }

    // 细雾滴粒子（更小更快）
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 3; i++) {
        const px = side === 0 ? 15 + Math.random() * 20 : w - 15 - Math.random() * 20;
        const py = cy + (Math.random() - 0.5) * h * 0.5;
        const life = 0.2 + Math.random() * 0.25;
        const vxDir = side === 0 ? 1 : -1;
        particles.push({
          x: px, y: py,
          vx: vxDir * (80 + Math.random() * 60),
          vy: (Math.random() - 0.5) * 40,
          life, maxLife: life,
          size: 2 + Math.random() * 4,
          color: `rgba(${120 + Math.random() * 40}, 255, ${120 + Math.random() * 40}, ${0.5 + Math.random() * 0.3})`,
          type: ParticleType.SPARK,
        });
      }
    }

    // 侧边喷嘴爆发效果
    for (let side = 0; side < 2; side++) {
      const nx = side === 0 ? 10 : w - 10;
      for (let i = 0; i < 2; i++) {
        const vxDir = side === 0 ? 1 : -1;
        particles.push({
          x: nx, y: cy + (Math.random() - 0.5) * 20,
          vx: vxDir * (60 + Math.random() * 40),
          vy: (Math.random() - 0.5) * 30,
          life: 0.15 + Math.random() * 0.15,
          maxLife: 0.15 + Math.random() * 0.15,
          size: 4 + Math.random() * 6,
          color: `rgba(${100 + Math.random() * 30}, 240, ${100 + Math.random() * 20}, ${0.6 + Math.random() * 0.3})`,
          type: ParticleType.POISON_CLOUD,
        });
      }
    }

    return particles;
  }

  /**
   * 生成消散粒子（喷雾结束时）
   */
  private spawnFadeOutParticles(w: number, h: number): Particle[] {
    const particles: Particle[] = [];
    const cy = h / 2;

    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 8; i++) {
        const px = side === 0 ? 10 + Math.random() * 40 : w - 10 - Math.random() * 40;
        const speed = 30 + Math.random() * 50;
        particles.push({
          x: px, y: cy + (Math.random() - 0.5) * 200,
          vx: (side === 0 ? 1 : -1) * Math.cos(Math.random() * Math.PI * 0.5) * speed,
          vy: (Math.random() - 0.5) * speed,
          life: 0.5 + Math.random() * 0.5,
          maxLife: 0.5 + Math.random() * 0.5,
          size: 5 + Math.random() * 10,
          color: `rgba(${60 + Math.random() * 30}, ${160 + Math.random() * 50}, ${60 + Math.random() * 20}, ${0.2 + Math.random() * 0.2})`,
          type: ParticleType.POISON_CLOUD,
        });
      }
    }

    return particles;
  }

  // ========== 伤害应用 ==========

  /**
   * 应用杀虫剂伤害
   */
  private applyDamage(w: number, defenseLineY: number, roaches: Roach[]): Particle[] {
    const particles: Particle[] = [];
    const cx = w / 2;
    const cy = defenseLineY;
    const range = 280;
    const halfSpread = this.spray.spraySpread / 2;
    let hitCount = 0;

    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;

      // 锥形区域检测：距离 + 角度
      const dx = r.x - cx;
      const dy = r.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range) continue;

      const angle = Math.atan2(dy, dx);
      let angleDiff = Math.abs(angle - this.spray.sprayAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      if (angleDiff > halfSpread) continue;

      // 装甲完全免疫
      if (r.armorHp > 0) {
        this.config.onAddFloatingText?.(r.x, r.y - 20, '护甲免疫!', '#60a5fa');
        continue;
      }
      // 跳过正在放置炸弹的定时自爆蟑螂
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;

      const dmg = this.spray.baseDamage * 0.5;
      r.hp -= dmg;
      hitCount++;

      // 施加中毒效果
      r.poisonTimer = 3;
      r.poisonDamage = 1.0;

      r.damageFlash = (r.armorHp > 0) ? 0 : 0.15;

      // 命中粒子
      if (Math.random() < 0.3) {
        particles.push({
          x: r.x + (Math.random() - 0.5) * 10,
          y: r.y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 30,
          vy: -20 - Math.random() * 30,
          life: 0.3,
          maxLife: 0.3,
          size: 2 + Math.random() * 3,
          color: `rgba(${80 + Math.random() * 40}, 220, ${80 + Math.random() * 20}, 0.7)`,
          type: ParticleType.POISON_CLOUD,
        });
      }
    }

    if (hitCount > 0) {
      this.config.onAddFloatingText?.(w / 2, cy - 80, `毒气命中${hitCount}只!`, '#4ade80');
    }

    return particles;
  }

  // ========== 重置 ==========

  reset(): void {
    this.spray = {
      active: false,
      timer: 0,
      duration: 3,
      damageInterval: 0.3,
      damageTimer: 0,
      sprayAngle: -Math.PI / 2,
      spraySpread: (Math.PI * 2) / 3,
      baseDamage: 2,
    };
  }
}