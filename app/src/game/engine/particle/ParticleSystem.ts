/**
 * @fileoverview 粒子系统模块
 * @description 负责管理游戏中的粒子效果生命周期、浮动文字、火焰区域和火焰墙。
 *              伤害计算通过回调委托给外部（引擎/CollisionSystem），实现职责分离。
 */

import { ParticleType, RoachState, RoachType } from '../../types';
import type { Particle, Roach, FireZone, FireWall, FloatingText } from '../../types';
import { ENEMY_DEFS, RENDER_COLOR, BALANCE_CONFIG } from '../../data';

/**
 * 粒子伤害回调接口
 * @description 将伤害计算从粒子系统分离，委托给外部模块处理
 */
export interface ParticleDamageCallbacks {
  /** 火焰区域对蟑螂造成伤害 */
  onFireZoneDamage: (roach: Roach, damage: number, isProtected: boolean) => void;
  /** 火焰墙对蟑螂造成伤害 */
  onFireWallDamage: (roach: Roach, damage: number) => void;
}

/**
 * 粒子系统配置接口
 */
export interface ParticleSystemConfig {
  /** 粒子数量限制（基于设备性能） */
  particleLimit: number;
  /** 时间增量 */
  deltaTime: number;
  /** 防线Y坐标 */
  defenseLineY: number;
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 伤害回调（可选，用于职责分离） */
  damageCallbacks?: ParticleDamageCallbacks;
}

/**
 * 粒子生成参数接口
 */
export interface ParticleSpawnParams {
  /** 粒子类型 */
  type: ParticleType;
  /** 生成位置X坐标 */
  x: number;
  /** 生成位置Y坐标 */
  y: number;
  /** 粒子数量 */
  count?: number;
  /** 基础速度 */
  baseSpeed?: number;
  /** 基础大小 */
  baseSize?: number;
  /** 基础生命周期 */
  baseLife?: number;
  /** 颜色（可选） */
  color?: string;
}

/**
 * 浮动文字参数接口
 */
export interface FloatingTextParams {
  /** 文字内容 */
  text: string;
  /** 位置X坐标 */
  x: number;
  /** 位置Y坐标 */
  y: number;
  /** 文字颜色 */
  color?: string;
  /** 生命周期（秒） */
  life?: number;
  /** 字体缩放比例 */
  scale?: number;
}

/**
 * 火焰区域参数接口
 */
export interface FireZoneParams {
  /** 位置X坐标 */
  x: number;
  /** 位置Y坐标 */
  y: number;
  /** 半径 */
  radius: number;
  /** 每秒伤害 */
  damagePerSecond: number;
  /** 生命周期（秒） */
  life: number;
}

/**
 * 火焰墙参数接口
 */
export interface FireWallParams {
  /** 位置X坐标 */
  x: number;
  /** 位置Y坐标 */
  y: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 每秒伤害 */
  damagePerSecond: number;
  /** 生命周期（秒） */
  life: number;
}

/**
 * 粒子系统类
 * @description 管理游戏中的粒子效果生命周期、浮动文字、火焰区域和火焰墙。
 *              伤害计算通过 `damageCallbacks` 委托给外部模块。
 */
export class ParticleSystem {
  /** 系统配置 */
  private config: ParticleSystemConfig;
  
  /** 粒子数组 */
  private particles: Particle[] = [];
  
  /** 浮动文字数组 */
  private floatingTexts: FloatingText[] = [];
  
  /** 火焰区域数组 */
  private fireZones: FireZone[] = [];
  
  /** 火焰墙数组 */
  private fireWalls: FireWall[] = [];

  // ========== 渲染优化：预创建归一化渐变（避免每粒子 createRadialGradient） ==========
  /** 归一化渐变缓存（key: 粒子类型） */
  private static _normGradients: Map<string, CanvasGradient> = new Map();

  /** 获取归一化径向渐变（以 (0,0) 为中心，半径 1） */
  private static getNormGradient(ctx: CanvasRenderingContext2D, key: string, innerColor: string, outerColor: string): CanvasGradient {
    if (!ParticleSystem._normGradients.has(key)) {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, innerColor);
      grad.addColorStop(1, outerColor);
      ParticleSystem._normGradients.set(key, grad);
    }
    return ParticleSystem._normGradients.get(key)!;
  }

  /**
   * 构造函数
   * @param config 粒子系统配置
   */
  constructor(config: ParticleSystemConfig) {
    this.config = config;
  }

  /**
   * 更新粒子系统
   * @param roaches 蟑螂数组（用于火焰区域伤害计算）
   * @returns 更新后的系统状态
   */
  update(roaches: Roach[] = []): {
    particles: Particle[];
    floatingTexts: FloatingText[];
    fireZones: FireZone[];
    fireWalls: FireWall[];
  } {
    // 更新所有子系统
    this.updateParticles();
    this.updateFloatingTexts();
    this.updateFireZones(roaches);
    this.updateFireWalls(roaches);

    return {
      particles: [...this.particles],
      floatingTexts: [...this.floatingTexts],
      fireZones: [...this.fireZones],
      fireWalls: [...this.fireWalls],
    };
  }

  /**
   * 获取当前粒子系统状态（不触发更新）
   * @returns 当前粒子系统状态
   */
  getState(): {
    particles: Particle[];
    floatingTexts: FloatingText[];
    fireZones: FireZone[];
    fireWalls: FireWall[];
  } {
    return {
      particles: [...this.particles],
      floatingTexts: [...this.floatingTexts],
      fireZones: [...this.fireZones],
      fireWalls: [...this.fireWalls],
    };
  }

  /**
   * 更新粒子（生命周期、位置、物理）
   * 修复 P0：截断保留最新（移除最旧）
   */
  private updateParticles(): void {
    const limit = this.config.particleLimit;
    // 修复 P0：保留最新粒子（移除最旧的）
    if (this.particles.length > limit) {
      this.particles.splice(0, this.particles.length - limit);
    }

    let writeIndex = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      
      p.life -= this.config.deltaTime;
      p.x += p.vx * this.config.deltaTime;
      p.y += p.vy * this.config.deltaTime;

      this.applyParticlePhysics(p);

      if (p.life > 0) {
        if (writeIndex !== i) {
          this.particles[writeIndex] = p;
        }
        writeIndex++;
      }
    }
    
    this.particles.length = writeIndex;
  }

  /**
   * 应用粒子物理效果（参数从 BALANCE_CONFIG.particle.physics 读取）
   * @param particle 粒子对象
   */
  private applyParticlePhysics(particle: Particle): void {
    const dt = this.config.deltaTime;
    const phys = BALANCE_CONFIG.particle.physics;

    switch (particle.type) {
      case ParticleType.FIRE:
      case ParticleType.EMBER:
      case ParticleType.SPARK:
        particle.vy -= phys.fire.vyDecay * dt;
        particle.size *= phys.fire.sizeDecay;
        break;
        
      case ParticleType.SMOKE:
        particle.vx *= phys.smoke.vxDecay;
        particle.size *= phys.smoke.sizeGrowth;
        break;
        
      case ParticleType.BLOOD:
        particle.vy += phys.blood.vyGravity * dt;
        particle.vx *= phys.blood.vxDecay;
        const defenseLine = this.config.defenseLineY;
        if (particle.y >= defenseLine - phys.blood.defenseLineOffset) {
          particle.y = defenseLine - phys.blood.defenseLineOffset;
          particle.vx = 0;
          particle.vy = 0;
        }
        break;
        
      case ParticleType.ICE:
        particle.vy += phys.ice.vyGravity * dt;
        particle.size *= phys.ice.sizeDecay;
        break;
        
      case ParticleType.POISON_CLOUD:
        particle.vx += (Math.random() - 0.5) * phys.poisonCloud.vxRandom;
        particle.vy -= phys.poisonCloud.vyDecay * dt;
        particle.size *= phys.poisonCloud.sizeGrowth;
        break;
        
      case ParticleType.EXPLOSION:
        particle.vy += phys.explosion.vyGravity * dt;
        particle.size *= phys.explosion.sizeDecay;
        break;
        
      case ParticleType.ASH:
        particle.vy += phys.ash.vyGravity * dt;
        particle.vx *= phys.ash.vxDecay;
        particle.size *= phys.ash.sizeDecay;
        const dl = this.config.defenseLineY;
        if (particle.y >= dl - phys.ash.defenseLineOffset) {
          particle.y = dl - phys.ash.defenseLineOffset;
          particle.vx *= phys.ash.bounceVx;
          particle.vy = 0;
        }
        break;
        
      case ParticleType.LIGHTNING:
        particle.life -= dt * phys.lightning.lifeMultiplier;
        break;
        
      default:
        break;
    }
  }

  /**
   * 更新浮动文字
   */
  private updateFloatingTexts(): void {
    let writeIndex = 0;
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const text = this.floatingTexts[i];
      text.life -= this.config.deltaTime;
      text.y += text.vy * this.config.deltaTime;
      
      if (text.life > 0) {
        if (writeIndex !== i) {
          this.floatingTexts[writeIndex] = text;
        }
        writeIndex++;
      }
    }
    
    this.floatingTexts.length = writeIndex;
  }

  /**
   * 更新火焰区域
   * 修复 P0：截断保留最新（移除最旧），使用配置限制数量
   * @param roaches 蟑螂数组
   */
  private updateFireZones(roaches: Roach[]): void {
    const maxZones = BALANCE_CONFIG.weaponDamage.fireZoneMaxCount;
    // 修复 P0：保留最新火焰区域（移除最旧的）
    if (this.fireZones.length > maxZones) {
      this.fireZones.splice(0, this.fireZones.length - maxZones);
    }
    
    let writeIndex = 0;
    for (let i = 0; i < this.fireZones.length; i++) {
      const zone = this.fireZones[i];
      zone.life -= this.config.deltaTime;
      
      if (zone.life > 0) {
        if (writeIndex !== i) {
          this.fireZones[writeIndex] = zone;
        }
        writeIndex++;

        this.applyFireZoneDamage(zone, roaches);
      }
    }
    
    this.fireZones.length = writeIndex;
  }

  /**
   * 应用火焰区域伤害
   * 修复 P1：合并 inZone 两阶段遍历为单次遍历
   * 修复 P1：伤害计算通过回调委托给外部（职责分离）
   * 修复 P0：使用 RoachState/RoachType 枚举代替字符串
   * @param zone 火焰区域对象
   * @param roaches 蟑螂数组
   */
  private applyFireZoneDamage(zone: FireZone, roaches: Roach[]): void {
    const baseDamage = zone.damagePerSecond * this.config.deltaTime;
    const callbacks = this.config.damageCallbacks;

    for (const roach of roaches) {
      // 修复 P0：使用枚举代替字符串
      if (roach.state !== RoachState.ALIVE || roach.isBoss) {
        continue;
      }
      
      const dx = roach.x - zone.x;
      const dy = roach.y - zone.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const roachSize = roach.size ?? (ENEMY_DEFS[roach.type]?.size || 30);
      
      if (dist < zone.radius + roachSize * 0.5) {
        roach.inFire = true;

        // 修复 P0：使用枚举代替字符串
        if (roach.type === RoachType.TIMED_SUICIDE && roach.placeTimer && roach.placeTimer > 0) {
          continue;
        }

        // 修复 P1：伤害计算通过回调委托给外部
        if (callbacks) {
          callbacks.onFireZoneDamage(roach, baseDamage, false);
        } else {
          // 内置默认伤害（向后兼容）
          roach.hp -= baseDamage;
          roach.damageFlash = (roach.armorHp > 0) ? 0 : 0.1;
        }
      }
    }
  }

  /**
   * 更新火焰墙
   * @param roaches 蟑螂数组
   */
  private updateFireWalls(roaches: Roach[]): void {
    for (let i = this.fireWalls.length - 1; i >= 0; i--) {
      const wall = this.fireWalls[i];
      wall.life -= this.config.deltaTime;

      if (wall.life <= 0) {
        this.fireWalls.splice(i, 1);
        continue;
      }

      this.applyFireWallDamage(wall, roaches);
    }
  }

  /**
   * 应用火焰墙伤害
   * 修复 P1：伤害计算通过回调委托给外部（职责分离）
   * 修复 P0：使用 RoachState/RoachType 枚举代替字符串
   * @param wall 火焰墙对象
   * @param roaches 蟑螂数组
   */
  private applyFireWallDamage(wall: FireWall, roaches: Roach[]): void {
    const damage = wall.damagePerSecond * this.config.deltaTime;
    const callbacks = this.config.damageCallbacks;

    for (const roach of roaches) {
      // 修复 P0：使用枚举代替字符串
      if (roach.state !== RoachState.ALIVE || roach.isBoss) {
        continue;
      }
      
      if (roach.type === RoachType.FLYING || roach.type === RoachType.FLYING_SUICIDE) {
        continue;
      }
      
      if (roach.type === RoachType.TIMED_SUICIDE && roach.placeTimer && roach.placeTimer > 0) {
        continue;
      }
      
      const roachSize = roach.size ?? (ENEMY_DEFS[roach.type]?.size || 30);
      const wallWidth = wall.x2 - wall.x1;
      const halfWidth = wallWidth / 2;
      const halfHeight = wall.height / 2;
      const wallCenterX = (wall.x1 + wall.x2) / 2;
      const dx = Math.abs(roach.x - wallCenterX);
      const dy = Math.abs(roach.y - wall.y);
      
      if (dx < halfWidth + roachSize * 0.5 && dy < halfHeight + roachSize * 0.5) {
        // 修复 P1：伤害计算通过回调委托给外部
        if (callbacks) {
          callbacks.onFireWallDamage(roach, damage);
        } else {
          roach.hp -= damage;
          roach.inFire = true;
          roach.damageFlash = (roach.armorHp > 0) ? 0 : 0.1;
        }
      }
    }
  }

  /**
   * 生成爆炸粒子（参数从 BALANCE_CONFIG 读取）
   * @param x 爆炸位置X坐标
   * @param y 爆炸位置Y坐标
   * @param intensity 爆炸强度
   */
  spawnExplosionParticles(x: number, y: number, intensity: number = 30): void {
    const cfg = BALANCE_CONFIG.particle.explosionParticle;
    const particleCount = Math.min(intensity * cfg.intensityMultiplier, cfg.maxCount);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      const life = cfg.lifeMin + Math.random() * (cfg.lifeMax - cfg.lifeMin);
      const size = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin);
      
      const types = [ParticleType.FIRE, ParticleType.EMBER, ParticleType.SPARK, ParticleType.SMOKE];
      const type = types[Math.floor(Math.random() * types.length)];
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size,
        type,
        color: type === ParticleType.SMOKE ? RENDER_COLOR.particleSmoke : 
               type === ParticleType.FIRE ? RENDER_COLOR.particleFire : 
               type === ParticleType.EMBER ? RENDER_COLOR.particleEmber : RENDER_COLOR.particleSpark,
      });
    }
  }

  /**
   * 添加粒子
   * @param particle 粒子对象
   */
  addParticle(particle: Particle): void {
    this.particles.push({ ...particle });
  }

  /**
   * 添加浮动文字（参数从 BALANCE_CONFIG 读取默认值）
   * @param params 浮动文字参数
   */
  addFloatingText(params: FloatingTextParams): void {
    const cfg = BALANCE_CONFIG.particle.floatingText;
    this.floatingTexts.push({
      x: params.x,
      y: params.y,
      text: params.text,
      color: params.color || RENDER_COLOR.particleDefault,
      life: params.life || cfg.defaultLife,
      maxLife: params.life || cfg.defaultLife,
      vy: cfg.defaultVy,
      scale: params.scale || 1.0,
    });
  }

  /**
   * 添加火焰区域
   * @param params 火焰区域参数
   */
  addFireZone(params: FireZoneParams): void {
    this.fireZones.push({
      x: params.x,
      y: params.y,
      radius: params.radius,
      damagePerSecond: params.damagePerSecond,
      life: params.life,
      maxLife: params.life,
    });
  }

  /**
   * 获取当前火焰墙数组
   * @returns 火焰墙数组
   */
  getFireWalls(): FireWall[] {
    return this.fireWalls;
  }

  /**
   * 获取当前火焰区域数组
   * @returns 火焰区域数组
   */
  getFireZones(): FireZone[] {
    return this.fireZones;
  }

  /**
   * 获取当前粒子数组
   * @returns 粒子数组
   */
  getParticles(): Particle[] {
    return this.particles;
  }

  /**
   * 添加火焰墙
   * @param params 火焰墙参数
   */
  addFireWall(params: FireWallParams): void {
    const halfWidth = params.width / 2;
    const x1 = params.x - halfWidth;
    const x2 = params.x + halfWidth;
    
    this.fireWalls.push({
      y: params.y,
      x1,
      x2,
      height: params.height,
      damagePerSecond: params.damagePerSecond,
      life: params.life,
      maxLife: params.life,
    });
  }

  /**
   * 清空所有粒子效果
   */
  clearAll(): void {
    this.particles = [];
    this.floatingTexts = [];
    this.fireZones = [];
    this.fireWalls = [];
  }

  /**
   * 使用外部数组更新粒子、火焰区域和浮动文字
   * 修复 P2：去重 — 统一入口，updateParticlesAndFloatingTexts 委托到此方法
   * @param particles 外部粒子数组
   * @param floatingTexts 外部浮动文字数组（可选，不传则不更新）
   * @param fireZones 外部火焰区域数组
   * @param fireWalls 外部火焰墙数组（可选，不传则不更新）
   * @param roaches 蟑螂数组（用于火焰伤害计算）
   */
  updateExternalArrays(
    particles: Particle[],
    floatingTexts: FloatingText[] | null,
    fireZones: FireZone[],
    fireWalls: FireWall[] | null,
    roaches: Roach[]
  ): void {
    this.particles = particles;
    this.fireZones = fireZones;

    this.updateParticles();
    this.updateFireZones(roaches);

    if (floatingTexts !== null) {
      this.floatingTexts = floatingTexts;
      this.updateFloatingTexts();
    }

    if (fireWalls !== null) {
      this.fireWalls = fireWalls;
      this.updateFireWalls(roaches);
    }
  }

  /**
   * 更新粒子和火焰区域（委托到 updateExternalArrays）
   * @deprecated 请使用 updateExternalArrays 统一入口
   */
  syncParticleArrays(
    particles: Particle[],
    fireZones: FireZone[],
    roaches: Roach[]
  ): void {
    this.updateExternalArrays(particles, null, fireZones, null, roaches);
  }

  // ========== 静态渲染方法 ==========

  /**
   * 渲染粒子
   * 修复 P1：使用预创建的归一化渐变（避免每粒子 createRadialGradient）
   * @param ctx Canvas 渲染上下文
   * @param particles 粒子数组
   */
  static renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
    ctx.save();

    for (const p of particles) {
      const alpha = p.life / p.maxLife;

      switch (p.type) {
        case ParticleType.FIRE:
          ctx.globalAlpha = alpha * 0.7;
          ctx.globalCompositeOperation = 'screen';
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(p.size * 0.8, p.size * 0.8);
          ctx.fillStyle = ParticleSystem.getNormGradient(ctx, 'fire', p.color, 'rgba(255, 50, 0, 0)');
          ctx.beginPath();
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;

        case ParticleType.SMOKE:
          ctx.globalAlpha = alpha * 0.5;
          ctx.globalCompositeOperation = 'source-over';
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(p.size, p.size);
          ctx.fillStyle = ParticleSystem.getNormGradient(ctx, 'smoke', p.color, 'rgba(80, 80, 80, 0)');
          ctx.beginPath();
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;

        case ParticleType.EMBER:
          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          break;

        case ParticleType.ASH:
          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;

        case ParticleType.SPARK:
          if (p.text) {
            ctx.globalAlpha = alpha;
            ctx.globalCompositeOperation = 'source-over';
            ctx.font = `bold ${Math.round(p.size * 2)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.textColor || p.color;
            ctx.fillText(p.text, p.x, p.y);
          } else {
            ctx.globalAlpha = alpha;
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          break;

        case ParticleType.BLOOD:
          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(10, 60, 10, ${alpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
          break;

        case ParticleType.ICE:
          ctx.globalAlpha = alpha * 0.8;
          ctx.globalCompositeOperation = 'screen';
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(p.size, p.size);
          ctx.fillStyle = ParticleSystem.getNormGradient(ctx, 'ice', p.color, 'rgba(200, 250, 255, 0)');
          ctx.beginPath();
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;

        case ParticleType.POISON_CLOUD:
          ctx.globalAlpha = alpha * 0.6;
          ctx.globalCompositeOperation = 'screen';
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(p.size * 2, p.size * 2);
          ctx.fillStyle = ParticleSystem.getNormGradient(ctx, 'poison', p.color, 'rgba(150, 100, 255, 0)');
          ctx.beginPath();
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;

        case ParticleType.EXPLOSION:
          ctx.globalAlpha = alpha;
          if (p.isSlime) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(p.size * 1.5, p.size * 1.5);
            ctx.fillStyle = ParticleSystem.getNormGradient(ctx, 'slime', p.color, 'rgba(40, 120, 40, 0)');
            ctx.beginPath();
            ctx.arc(0, 0, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.shadowColor = 'rgba(100, 255, 100, 0.8)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            ctx.globalCompositeOperation = 'screen';
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(p.size * 1.5, p.size * 1.5);
            ctx.fillStyle = ParticleSystem.getNormGradient(ctx, 'explosion', p.color, 'rgba(255, 100, 0, 0)');
            ctx.beginPath();
            ctx.arc(0, 0, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          break;

        case ParticleType.SHIELD:
          const expandProgress = 1 - alpha;
          const ringRadius = p.size * expandProgress;
          ctx.globalAlpha = alpha * 0.6;
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = RENDER_COLOR.shieldStart;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          break;

        case ParticleType.LIGHTNING:
          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = p.color;
          ctx.shadowColor = RENDER_COLOR.shieldStart;
          ctx.shadowBlur = 10;
          ctx.fillRect(p.x - 1, p.y, 2, p.size * 3);
          ctx.shadowBlur = 0;
          break;

        case ParticleType.RAIN:
          ctx.globalAlpha = alpha * 0.4;
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02);
          ctx.stroke();
          break;
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /**
   * 渲染浮动文字
   * 修复 P1：添加 ctx.save()/ctx.restore() 防止状态泄漏
   * @param ctx Canvas 渲染上下文
   * @param floatingTexts 浮动文字数组
   */
  static renderFloatingTexts(ctx: CanvasRenderingContext2D, floatingTexts: FloatingText[]): void {
    ctx.save();
    for (const t of floatingTexts) {
      const alpha = t.life / t.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      const fontSize = Math.round(16 * (t.scale || 1));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3 * (t.scale || 1);
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  /**
   * 渲染火焰墙（静态方法，用于与旧引擎集成）
   * @param ctx Canvas 渲染上下文
   * @param fireWalls 火焰墙数组
   * @param time 游戏时间（用于动画）
   */
  static renderFireWalls(ctx: CanvasRenderingContext2D, fireWalls: FireWall[], time: number): void {
    for (const wall of fireWalls) {
      const progress = wall.life / wall.maxLife;
      const alpha = Math.min(1, progress * 1.5);
      const wallWidth = wall.x2 - wall.x1;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const segments = Math.max(10, Math.floor(wallWidth / 15));
      for (let i = 0; i < segments; i++) {
        const sx = wall.x1 + (wallWidth / segments) * i;
        const segW = wallWidth / segments;

        const flicker = 0.7 + Math.sin(time * 12 + i * 2.5) * 0.3;
        const h = wall.height * (2 + flicker);

        const fireGrad = ctx.createLinearGradient(sx, wall.y - h, sx, wall.y + h * 0.3);
        fireGrad.addColorStop(0, `rgba(255, 255, 100, ${alpha * 0.9})`);
        fireGrad.addColorStop(0.3, `rgba(255, 180, 20, ${alpha * 0.85})`);
        fireGrad.addColorStop(0.6, `rgba(255, 80, 10, ${alpha * 0.7})`);
        fireGrad.addColorStop(1, `rgba(200, 30, 5, ${alpha * 0.3})`);

        ctx.fillStyle = fireGrad;
        ctx.fillRect(sx - segW * 0.1, wall.y - h * 0.5, segW * 1.2, h);
      }

      // Core bright line
      ctx.strokeStyle = `rgba(255, 255, 220, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y);
      ctx.lineTo(wall.x2, wall.y);
      ctx.stroke();

      // Outer glow
      const glowGrad = ctx.createLinearGradient(wall.x1, wall.y - 15, wall.x1, wall.y + 15);
      glowGrad.addColorStop(0, `rgba(255, 100, 20, 0)`);
      glowGrad.addColorStop(0.5, `rgba(255, 80, 10, ${alpha * 0.25})`);
      glowGrad.addColorStop(1, `rgba(255, 100, 20, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(wall.x1, wall.y - 15, wallWidth, 30);

      // Ember sparks
      for (let i = 0; i < 3; i++) {
        const sparkX = wall.x1 + Math.random() * wallWidth;
        const sparkY = wall.y - 5 - Math.random() * 15;
        const sparkSize = 1 + Math.random() * 2;
        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 30, ${alpha * (0.5 + Math.random() * 0.5)})`;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Duration indicator
      ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.7})`;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`火焰墙 ${wall.life.toFixed(1)}s`, (wall.x1 + wall.x2) / 2, wall.y + 20);

      ctx.restore();
    }
  }

  /**
   * 获取当前粒子数量
   * @returns 粒子数量
   */
  getParticleCount(): number {
    return this.particles.length;
  }

  /**
   * 获取当前浮动文字数量
   * @returns 浮动文字数量
   */
  getFloatingTextCount(): number {
    return this.floatingTexts.length;
  }

  /**
   * 更新配置
   * @param newConfig 新的配置
   */
  updateConfig(newConfig: Partial<ParticleSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): ParticleSystemConfig {
    return { ...this.config };
  }
}
