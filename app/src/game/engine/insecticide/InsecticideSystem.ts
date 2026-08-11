/**
 * @fileoverview 杀虫剂喷雾系统模块
 * @description 负责管理杀虫剂喷雾的激活、计时、粒子生成、伤害应用和过期清理
 */

import { RoachState, RoachType, ParticleType } from '../../types';
import type { Particle, Roach } from '../../types';
import { type InsecticideSprayState } from '../render/RenderUtils';
import { TEXT_CONFIG, BALANCE_CONFIG } from '../../data';

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

  /** 倒计时警告已触发标记（修复 P1：避免浮点精度问题） */
  private _warningTriggered: boolean = false;

  constructor(config: InsecticideSystemConfig) {
    this.config = config;
    const cfg = BALANCE_CONFIG.insecticide;
    this.spray = {
      active: false,
      timer: 0,
      duration: cfg.duration,
      damageInterval: cfg.damageInterval,
      damageTimer: 0,
      sprayAngle: -Math.PI / 2,
      spraySpread: (Math.PI * 2) / 3,
      baseDamage: cfg.baseDamage,
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
    // 修复 P1：激活后将第一次伤害延迟 damageInterval 秒，让喷雾动画先播放
    this.spray.damageTimer = BALANCE_CONFIG.insecticide.damageInterval;
    this._warningTriggered = false;
    this.config.onPlaySound?.('insecticide_spray');
    this.config.onVibrate?.();
    this.config.onAddFloatingText?.(canvasWidth / 2, canvasHeight / 2 - 60, TEXT_CONFIG.combat.insecticideActivate.text, TEXT_CONFIG.combat.insecticideActivate.color);
    this.config.onAddFloatingText?.(canvasWidth / 2, canvasHeight / 2 - 40, TEXT_CONFIG.combat.insecticideDesc.text(BALANCE_CONFIG.insecticide.duration), TEXT_CONFIG.combat.insecticideDesc.color);
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
    _defenseLineY: number,
    roaches: Roach[]
  ): Particle[] {
    if (!this.spray.active) return [];

    const particlesToAdd: Particle[] = [];
    this.spray.timer -= deltaTime;
    this.spray.damageTimer -= deltaTime;

    // 修复 P1：使用标记避免浮点精度问题
    const warningThreshold = BALANCE_CONFIG.insecticide.warningThreshold;
    if (!this._warningTriggered && this.spray.timer <= warningThreshold) {
      this._warningTriggered = true;
      this.config.onAddFloatingText?.(canvasWidth / 2, canvasHeight / 2 - 80, TEXT_CONFIG.combat.insecticideClosing.text, TEXT_CONFIG.combat.insecticideClosing.color);
    }

    // 修复 P2：先造成伤害，再检查过期，确保最后一帧也能造成伤害
    if (this.spray.damageTimer <= 0) {
      this.spray.damageTimer = this.spray.damageInterval;
      particlesToAdd.push(...this.applyDamage(canvasWidth, canvasHeight, roaches));
    }

    // 每帧生成喷雾粒子
    particlesToAdd.push(...this.spawnSprayParticles(canvasWidth, canvasHeight));

    // 过期处理
    if (this.spray.timer <= 0) {
      this.spray.active = false;
      this.spray.timer = 0;
      particlesToAdd.push(...this.spawnFadeOutParticles(canvasWidth, canvasHeight));
      this.config.onAddFloatingText?.(canvasWidth / 2, canvasHeight / 2 - 50, TEXT_CONFIG.combat.insecticideEnd.text, TEXT_CONFIG.combat.insecticideEnd.color);
    }

    return particlesToAdd;
  }

  // ========== 粒子生成 ==========

  /**
   * 为单侧生成喷雾粒子（修复 P1：消除左右重复代码）
   * @param side 0=左侧, 1=右侧
   * @param w 画布宽度
   * @param h 画布高度
   */
  private spawnSideParticles(side: number, w: number, h: number): Particle[] {
    const cfg = BALANCE_CONFIG.insecticide;
    const particles: Particle[] = [];
    const cy = h / 2;
    const isLeft = side === 0;
    const baseX = isLeft ? 10 : w - 10;
    const dirX = isLeft ? 1 : -1;

    // 主喷雾粒子
    for (let i = 0; i < cfg.sideParticleCount; i++) {
      const py = cy + (Math.random() - 0.5) * h * 0.6;
      const life = cfg.particleLifeMin + Math.random() * cfg.particleLifeMax;
      const speed = cfg.particleSpeedMin + Math.random() * cfg.particleSpeedMax;
      const greenBase = 180 + Math.random() * 60;
      const alpha = cfg.particleAlphaMin + Math.random() * cfg.particleAlphaMax;
      particles.push({
        x: baseX + Math.random() * 30,
        y: py,
        vx: dirX * speed * (0.5 + Math.random() * 0.5),
        vy: (Math.random() - 0.5) * 30,
        life, maxLife: life,
        size: 5 + Math.random() * 10,
        color: `rgba(${50 + Math.random() * 30}, ${greenBase}, ${50 + Math.random() * 20}, ${alpha})`,
        type: ParticleType.POISON_CLOUD,
      });
    }

    // 细雾滴粒子
    for (let i = 0; i < cfg.centerParticleCount; i++) {
      const px = isLeft ? 15 + Math.random() * 20 : w - 15 - Math.random() * 20;
      const py = cy + (Math.random() - 0.5) * h * 0.5;
      const life = cfg.centerParticleLifeMin + Math.random() * cfg.centerParticleLifeMax;
      particles.push({
        x: px, y: py,
        vx: dirX * (80 + Math.random() * 60),
        vy: (Math.random() - 0.5) * 40,
        life, maxLife: life,
        size: 2 + Math.random() * 4,
        color: `rgba(${120 + Math.random() * 40}, 255, ${120 + Math.random() * 40}, ${0.5 + Math.random() * 0.3})`,
        type: ParticleType.SPARK,
      });
    }

    // 喷嘴爆发效果
    const nx = isLeft ? 10 : w - 10;
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: nx, y: cy + (Math.random() - 0.5) * 20,
        vx: dirX * (60 + Math.random() * 40),
        vy: (Math.random() - 0.5) * 30,
        life: 0.15 + Math.random() * 0.15,
        maxLife: 0.15 + Math.random() * 0.15,
        size: 4 + Math.random() * 6,
        color: `rgba(${100 + Math.random() * 30}, 240, ${100 + Math.random() * 20}, ${0.6 + Math.random() * 0.3})`,
        type: ParticleType.POISON_CLOUD,
      });
    }

    return particles;
  }

  /**
   * 生成喷雾粒子（每帧调用）
   */
  private spawnSprayParticles(w: number, h: number): Particle[] {
    const maxParticles = BALANCE_CONFIG.insecticide.maxParticlesPerFrame;

    // 修复 P2：限制每帧粒子总数
    const particles: Particle[] = [];
    particles.push(...this.spawnSideParticles(0, w, h)); // 左侧
    particles.push(...this.spawnSideParticles(1, w, h)); // 右侧

    // 超过上限时截断
    if (particles.length > maxParticles) {
      particles.length = maxParticles;
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
   * @param w 画布宽度
   * @param h 画布高度（修复 P1：锥形检测中心使用画布中心，与视觉效果一致）
   */
  private applyDamage(w: number, h: number, roaches: Roach[]): Particle[] {
    const cfg = BALANCE_CONFIG.insecticide;
    const particles: Particle[] = [];
    // 修复 P1：锥形检测中心改为画布中心（h/2），与视觉喷雾效果一致
    const cx = w / 2;
    const cy = h / 2;
    const range = cfg.damageRange;
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
        this.config.onAddFloatingText?.(r.x, r.y - 20, TEXT_CONFIG.combat.armorImmune.text, TEXT_CONFIG.combat.armorImmune.color);
        continue;
      }
      // 跳过正在放置炸弹的定时自爆蟑螂
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;

      // 修复 P2：使用命名常量代替意图不明的 baseDamage * 0.5
      const dmg = this.spray.baseDamage * cfg.damageMultiplier;
      r.hp -= dmg;
      hitCount++;

      // 修复 P1：使用配置中的中毒效果参数，只在中毒未激活时设置（避免持续重置）
      if (r.poisonTimer <= 0) {
        r.poisonTimer = cfg.poisonTimer;
        r.poisonDamage = cfg.poisonDamage;
      }

      // 修复 P2：移除多余的三目判断（armorHp > 0 已在上面 return）
      r.damageFlash = 0.15;

      // 命中粒子
      if (Math.random() < cfg.hitParticleChance) {
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
      this.config.onAddFloatingText?.(w / 2, cy - 80, TEXT_CONFIG.combat.insecticideHit.text(hitCount), TEXT_CONFIG.combat.insecticideHit.color);
    }

    return particles;
  }

  // ========== 重置 ==========

  reset(): void {
    const cfg = BALANCE_CONFIG.insecticide;
    this.spray = {
      active: false,
      timer: 0,
      duration: cfg.duration,
      damageInterval: cfg.damageInterval,
      damageTimer: 0,
      sprayAngle: -Math.PI / 2,
      spraySpread: (Math.PI * 2) / 3,
      baseDamage: cfg.baseDamage,
    };
    this._warningTriggered = false;
  }
}