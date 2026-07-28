/**
 * @fileoverview 粒子生成器 —— 从引擎迁移的粒子生成静态方法
 * @description 提供 10 种粒子类型的生成方法，所有参数从 BALANCE_CONFIG 读取
 * 所有方法均为纯静态方法，接收目标数组作为参数，不依赖引擎实例
 */

import { ParticleType } from '../../types';
import type { Particle, FireZone } from '../../types';
import { BALANCE_CONFIG } from '../../data';

/** 锥形火焰粒子参数 */
export interface ConeFireParams {
  particles: Particle[];
  fireZones: FireZone[];
  deltaTime: number;
  /** 枪口 X 坐标 */
  x: number;
  /** 枪口 Y 坐标 */
  y: number;
  /** 喷射角度 */
  angle: number;
  /** 喷射范围 */
  range: number;
  /** 基础伤害 */
  baseDamage: number;
  /** 火焰类型 */
  type?: 'fire' | 'ice' | 'poison';
}

/** RGBA 颜色配置（用于粒子颜色生成） */
interface ParticleColorCfg {
  r?: number; rMin?: number; rMax?: number;
  g?: number; gMin?: number; gMax?: number;
  b?: number; bMin?: number; bMax?: number;
  a?: number; aMin?: number; aMax?: number;
}

/**
 * 粒子生成器 —— 静态方法集合
 */
export class ParticleSpawner {

  // ========== 内部辅助 ==========

  /** 根据颜色配置生成随机 rgba 字符串 */
  private static randomRgba(c: ParticleColorCfg): string {
    const r = c.r ?? (c.rMin! + Math.random() * (c.rMax! - c.rMin!));
    const g = c.g ?? (c.gMin! + Math.random() * (c.gMax! - c.gMin!));
    const b = c.b ?? (c.bMin! + Math.random() * (c.bMax! - c.bMin!));
    const a = c.a ?? (c.aMin! + Math.random() * (c.aMax! - c.aMin!));
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
  }

  /**
   * 生成径向散射粒子（统一 ash/blood/spark/explosion 等方法的公共逻辑）
   */
  private static spawnRadial(
    particles: Particle[],
    count: number,
    x: number,
    y: number,
    speedMin: number,
    speedRange: number,
    vyBias: number,
    lifeMin: number,
    lifeRange: number,
    sizeMin: number,
    sizeRange: number,
    colorFn: () => string,
    type: ParticleType,
    offsetXY: number = 0
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * speedRange;
      const life = lifeMin + Math.random() * lifeRange;
      particles.push({
        x: x + (offsetXY ? (Math.random() - 0.5) * offsetXY : 0),
        y: y + (offsetXY ? (Math.random() - 0.5) * offsetXY : 0),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + vyBias,
        life,
        maxLife: life,
        size: sizeMin + Math.random() * sizeRange,
        color: colorFn(),
        type,
      });
    }
  }

  // ========== 锥形火焰粒子 ==========

  /**
   * 生成锥形火焰粒子
   * 修复 P0：damagePerSecond 公式使用命名常量，表达清晰
   * 修复 P0：fireZones 截断保留最新而非最旧
   * 修复 P1：参数对象化（10 个参数 → 1 个对象）
   * 修复 P1：颜色公式从 BALANCE_CONFIG.particle 读取
   * 修复 P2：移除未使用的 _spread 参数
   */
  static spawnConeFire(params: ConeFireParams): void {
    const { particles, fireZones, deltaTime, x, y, angle, range, baseDamage, type = 'fire' } = params;
    const cfg = BALANCE_CONFIG.particle.coneFire;
    const wpnCfg = BALANCE_CONFIG.weaponDamage;
    const isIce = type === 'ice';
    const isPoison = type === 'poison';

    const count = Math.floor(cfg.countMin + Math.random() * cfg.countMax);
    for (let i = 0; i < count; i++) {
      const rDist = Math.random() * range;
      const rAngle = angle + (Math.random() - 0.5) * cfg.angleSpread;
      const px = x + Math.cos(rAngle) * rDist;
      const py = y + Math.sin(rAngle) * rDist;
      const life = cfg.lifeMin + Math.random() * cfg.lifeMax;
      const flowSpeed = cfg.flowSpeedMin + Math.random() * cfg.flowSpeedMax;
      let color: string;
      let particleType: ParticleType;
      let size: number;

      if (isIce) {
        color = ParticleSpawner.randomRgba(cfg.iceColor);
        particleType = ParticleType.ICE;
        size = 2 + Math.random() * 4;
      } else if (isPoison) {
        color = ParticleSpawner.randomRgba(cfg.poisonColor);
        particleType = ParticleType.POISON_CLOUD;
        size = 3 + Math.random() * 5;
      } else {
        const temp = Math.random();
        if (temp < 0.5) {
          color = ParticleSpawner.randomRgba(cfg.fireColor);
          particleType = ParticleType.FIRE;
          size = cfg.fireSizeMin + Math.random() * cfg.fireSizeMax;
        } else {
          color = ParticleSpawner.randomRgba(cfg.emberColor);
          particleType = ParticleType.EMBER;
          size = cfg.emberSizeMin + Math.random() * cfg.emberSizeMax;
        }
      }

      particles.push({
        x: px, y: py,
        vx: Math.cos(rAngle) * flowSpeed,
        vy: Math.sin(rAngle) * flowSpeed,
        life, maxLife: life,
        size, color,
        type: particleType,
      });
    }

    // 枪口火花（参数从配置读取）
    const ms = cfg.muzzleSpark;
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * ms.vxRange,
      vy: ms.vyMin + Math.random() * (ms.vyMax - ms.vyMin),
      life: ms.life,
      maxLife: ms.life,
      size: cfg.sparkSizeMin + Math.random() * cfg.sparkSizeMax,
      color: ms.color,
      type: ParticleType.SPARK,
    });

    // 修复 P0：damagePerSecond = baseDamage * 乘数 / deltaTime
    // 碰撞系统每帧应用 damagePerSecond * deltaTime，所以每帧实际伤害 = baseDamage * multiplier
    const fireZoneLife = wpnCfg.fireZoneMaxLife;
    const damagePerSecond = baseDamage * wpnCfg.fireZoneDpsMultiplier / deltaTime;

    fireZones.push({
      x: x + Math.cos(angle) * range / 2,
      y: y + Math.sin(angle) * range / 2,
      radius: range * 0.8,
      damagePerSecond,
      life: fireZoneLife,
      maxLife: fireZoneLife,
      type,
    });

    // 修复 P0：截断保留最新的（移除最旧的）
    const maxFireZones = wpnCfg.fireZoneMaxCount;
    if (fireZones.length > maxFireZones) {
      fireZones.splice(0, fireZones.length - maxFireZones);
    }
  }

  // ========== 烟雾粒子 ==========

  static spawnSmokeParticles(particles: Particle[], x: number, y: number, count: number): void {
    const cfg = BALANCE_CONFIG.particle.smoke;
    for (let i = 0; i < count; i++) {
      const life = cfg.lifeMin + Math.random() * cfg.lifeMax;
      particles.push({
        x: x + (Math.random() - 0.5) * cfg.offsetX,
        y: y + (Math.random() - 0.5) * cfg.offsetY,
        vx: (Math.random() - 0.5) * cfg.vxRange,
        vy: cfg.vyBase - Math.random() * cfg.vyRange,
        life, maxLife: life,
        size: cfg.sizeMin + Math.random() * cfg.sizeMax,
        color: `hsl(${cfg.hue}, ${cfg.saturation}%, ${cfg.lightnessMin + Math.random() * cfg.lightnessMax}%)`,
        type: ParticleType.SMOKE,
      });
    }
  }

  // ========== 灰烬粒子 ==========

  static spawnAshParticles(particles: Particle[], x: number, y: number, count: number): void {
    const cfg = BALANCE_CONFIG.particle.ash;
    ParticleSpawner.spawnRadial(
      particles, count, x, y,
      cfg.speedMin, cfg.speedMax, cfg.vyBias,
      cfg.lifeMin, cfg.lifeMax,
      cfg.sizeMin, cfg.sizeMax,
      () => `hsl(${cfg.hue}, ${cfg.saturation}%, ${cfg.lightnessMin + Math.random() * cfg.lightnessMax}%)`,
      ParticleType.ASH,
    );
  }

  // ========== 血粒子 ==========

  static spawnBloodParticles(particles: Particle[], x: number, y: number, count: number): void {
    const cfg = BALANCE_CONFIG.particle.blood;
    ParticleSpawner.spawnRadial(
      particles, count, x, y,
      cfg.speedMin, cfg.speedMax, cfg.vyBias,
      cfg.life, 0,
      cfg.sizeMin, cfg.sizeMax,
      () => `rgba(${cfg.rMin + Math.random() * cfg.rMax}, ${cfg.gMin + Math.random() * cfg.gMax}, ${cfg.bMin + Math.random() * cfg.bMax}, ${cfg.alphaMin + Math.random() * cfg.alphaMax})`,
      ParticleType.BLOOD,
    );
  }

  // ========== 火花粒子 ==========

  static spawnSparkParticles(particles: Particle[], x: number, y: number, count: number): void {
    const cfg = BALANCE_CONFIG.particle.spark;
    ParticleSpawner.spawnRadial(
      particles, count, x, y,
      cfg.speedMin, cfg.speedMax, 0,
      cfg.lifeMin, cfg.lifeMax,
      cfg.sizeMin, cfg.sizeMax,
      () => `hsl(${cfg.hueMin + Math.random() * cfg.hueMax}, ${cfg.saturation}%, ${cfg.lightness}%)`,
      ParticleType.SPARK,
    );
  }

  // ========== 爆炸粒子 ==========

  static spawnExplosionParticles(particles: Particle[], x: number, y: number, count: number): void {
    const cfg = BALANCE_CONFIG.particle.explosion;
    ParticleSpawner.spawnRadial(
      particles, count, x, y,
      cfg.speedMin, cfg.speedMax, cfg.vyBias,
      cfg.lifeMin, cfg.lifeMax,
      cfg.sizeMin, cfg.sizeMax,
      () => `hsl(${cfg.hueMin + Math.random() * cfg.hueMax}, ${cfg.saturation}%, ${cfg.lightnessMin + Math.random() * cfg.lightnessMax}%)`,
      ParticleType.EXPLOSION,
    );
  }

  // ========== 碎片粒子（自爆蟑螂爆炸） ==========

  static spawnDebrisParticles(particles: Particle[], x: number, y: number, count: number): void {
    const cfg = BALANCE_CONFIG.particle.debris;
    ParticleSpawner.spawnRadial(
      particles, count, x, y,
      cfg.speedMin, cfg.speedMax, cfg.vyBias,
      cfg.lifeMin, cfg.lifeMax,
      cfg.sizeMin, cfg.sizeMax,
      () => `hsl(${cfg.hueMin + Math.random() * cfg.hueMax}, ${cfg.saturation}%, ${cfg.lightnessMin + Math.random() * cfg.lightnessMax}%)`,
      ParticleType.ASH,
      cfg.offsetXY,
    );
  }

  // ========== 火环粒子 ==========

  static spawnFireRingParticles(particles: Particle[], x: number, y: number, count: number): void {
    const cfg = BALANCE_CONFIG.particle.fireRing;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = cfg.speedMin + Math.random() * cfg.speedMax;
      const life = cfg.lifeMin + Math.random() * cfg.lifeMax;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + cfg.vyBias,
        life, maxLife: life,
        size: cfg.sizeMin + Math.random() * cfg.sizeMax,
        color: `hsl(${cfg.hueMin + Math.random() * cfg.hueMax}, ${cfg.saturation}%, ${cfg.lightness}%)`,
        type: ParticleType.EXPLOSION,
      });
    }
  }

  // ========== 冲击波环 ==========

  static spawnShockwaveRing(particles: Particle[], x: number, y: number, count: number): void {
    const cfg = BALANCE_CONFIG.particle.shockwave;
    // 外层冲击波环
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = cfg.outerSpeedMin + Math.random() * cfg.outerSpeedMax;
      const life = cfg.outerLifeMin + Math.random() * cfg.outerLifeMax;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life, maxLife: life,
        size: cfg.outerSizeMin + Math.random() * cfg.outerSizeMax,
        color: ParticleSpawner.randomRgba(cfg.outerColor),
        type: ParticleType.EXPLOSION,
      });
    }
    // 内层白色核心爆发
    for (let i = 0; i < cfg.innerCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cfg.innerSpeedMin + Math.random() * cfg.innerSpeedMax;
      const life = cfg.innerLifeMin + Math.random() * cfg.innerLifeMax;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life, maxLife: life,
        size: cfg.innerSizeMin + Math.random() * cfg.innerSizeMax,
        color: ParticleSpawner.randomRgba(cfg.innerColor),
        type: ParticleType.SPARK,
      });
    }
  }

  // ========== 闪电粒子（电蚊拍） ==========

  static spawnLightningParticles(
    particles: Particle[],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const cfg = BALANCE_CONFIG.particle.lightning;
    // 顶部闪电弧
    for (let i = 0; i < cfg.topCount; i++) {
      const px = x + (Math.random() - 0.5) * width * cfg.topWidthRatio;
      const life = cfg.topLifeMin + Math.random() * cfg.topLifeMax;
      particles.push({
        x: px, y: y + Math.random() * cfg.topYRange,
        vx: (Math.random() - 0.5) * cfg.topVxRange,
        vy: cfg.topVyMin + Math.random() * cfg.topVyMax,
        life, maxLife: life,
        size: cfg.topSizeMin + Math.random() * cfg.topSizeMax,
        color: ParticleSpawner.randomRgba(cfg.topColor),
        type: ParticleType.LIGHTNING,
      });
    }
    // 全屏闪电
    for (let i = 0; i < cfg.fullCount; i++) {
      const px = x + (Math.random() - 0.5) * width;
      const py = Math.random() * height;
      const life = cfg.fullLifeMin + Math.random() * cfg.fullLifeMax;
      particles.push({
        x: px, y: py,
        vx: (Math.random() - 0.5) * cfg.fullVxRange,
        vy: (Math.random() - 0.5) * cfg.fullVyRange,
        life, maxLife: life,
        size: cfg.fullSizeMin + Math.random() * cfg.fullSizeMax,
        color: ParticleSpawner.randomRgba(cfg.fullColor),
        type: ParticleType.LIGHTNING,
      });
    }
  }
}