/**
 * @fileoverview 粒子系统模块
 * @description 负责管理游戏中的粒子效果、浮动文字、火焰区域和火焰墙
 */

import { ParticleType, type Particle, type Roach, type FireZone, type FireWall, type FloatingText } from '../../types';
import { ENEMY_DEFS } from '../../data';

/**
 * 锥形火焰生成参数接口
 */
export interface ConeFireParams {
  /** 枪口位置X */
  x: number;
  /** 枪口位置Y */
  y: number;
  /** 喷射角度 */
  angle: number;
  /** 射程 */
  range: number;
  /** 扩散角度 */
  spreadAngle: number;
  /** 基础伤害（用于火焰区域计算） */
  baseDamage: number;
  /** 火焰类型 */
  type?: 'fire' | 'ice' | 'poison';
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
 * @description 管理游戏中的粒子效果、浮动文字、火焰区域和火焰墙
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
  
  /** 装甲护盾缓存（用于优化碰撞检测，存储受保护的蟑螂ID） */
  private armorShieldCache: Set<number> = new Set();

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
   * 更新粒子
   */
  private updateParticles(): void {
    // 动态硬限制基于设备性能
    const limit = this.config.particleLimit;
    if (this.particles.length > limit) {
      this.particles.length = limit;
    }

    let writeIndex = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      
      // 更新粒子生命周期和位置
      p.life -= this.config.deltaTime;
      p.x += p.vx * this.config.deltaTime;
      p.y += p.vy * this.config.deltaTime;

      // 根据粒子类型应用不同的物理效果
      this.applyParticlePhysics(p);

      // 保留存活的粒子
      if (p.life > 0) {
        if (writeIndex !== i) {
          this.particles[writeIndex] = p;
        }
        writeIndex++;
      }
    }
    
    // 截断死亡的粒子
    this.particles.length = writeIndex;
  }

  /**
   * 应用粒子物理效果
   * @param particle 粒子对象
   */
  private applyParticlePhysics(particle: Particle): void {
    switch (particle.type) {
      case ParticleType.FIRE:
      case ParticleType.EMBER:
      case ParticleType.SPARK:
        // 火焰粒子：向上飘浮，逐渐缩小
        particle.vy -= 25 * this.config.deltaTime;
        particle.size *= 0.97;
        break;
        
      case ParticleType.SMOKE:
        // 烟雾粒子：水平速度衰减，逐渐扩大
        particle.vx *= 0.92;
        particle.size *= 1.015;
        break;
        
      case ParticleType.BLOOD:
        // 血液粒子：向下坠落，碰到防线停止
        particle.vy += 100 * this.config.deltaTime;
        particle.vx *= 0.95;
        const defenseLine = this.config.defenseLineY;
        if (particle.y >= defenseLine - 5) {
          particle.y = defenseLine - 5;
          particle.vx = 0;
          particle.vy = 0;
        }
        break;
        
      case ParticleType.ICE:
        // 冰粒子：轻微向下，逐渐缩小
        particle.vy += 20 * this.config.deltaTime;
        particle.size *= 0.98;
        break;
        
      case ParticleType.POISON_CLOUD:
        // 毒云粒子：随机水平运动，向上飘浮，逐渐扩大
        particle.vx += (Math.random() - 0.5) * 10;
        particle.vy -= 5 * this.config.deltaTime;
        particle.size *= 1.01;
        break;
        
      case ParticleType.EXPLOSION:
        // 爆炸粒子：向下坠落，逐渐缩小
        particle.vy += 40 * this.config.deltaTime;
        particle.size *= 0.94;
        break;
        
      case ParticleType.ASH:
        // 灰烬粒子：快速向下坠落，碰到防线减速
        particle.vy += 120 * this.config.deltaTime;
        particle.vx *= 0.97;
        particle.size *= 0.985;
        const dl = this.config.defenseLineY;
        if (particle.y >= dl - 2) {
          particle.y = dl - 2;
          particle.vx *= 0.8;
          particle.vy = 0;
        }
        break;
        
      case ParticleType.LIGHTNING:
        // 闪电粒子：快速消失
        particle.life -= this.config.deltaTime * 2;
        break;
        
      default:
        // 默认粒子行为
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
   * @param roaches 蟑螂数组
   */
  private updateFireZones(roaches: Roach[]): void {
    // 限制火焰区域数量
    if (this.fireZones.length > 30) {
      this.fireZones.length = 30;
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

        // 计算火焰区域对蟑螂的伤害
        this.applyFireZoneDamage(zone, roaches);
      }
    }
    
    this.fireZones.length = writeIndex;
  }

  /**
   * 应用火焰区域伤害
   * @param zone 火焰区域对象
   * @param roaches 蟑螂数组
   */
  private applyFireZoneDamage(zone: FireZone, roaches: Roach[]): void {
    const inZone: Array<{ roach: Roach; protected: boolean }> = [];
    
    for (const roach of roaches) {
      if (roach.state !== 'alive' || roach.isBoss) {
        continue;
      }
      
      const dx = roach.x - zone.x;
      const dy = roach.y - zone.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const roachSize = roach.size ?? (ENEMY_DEFS[roach.type]?.size || 30);
      
      if (dist < zone.radius + roachSize * 0.5) {
        const isProtected = roach.armorHp <= 0 && this.armorShieldCache.has(roach.id);
        inZone.push({ roach, protected: isProtected });
        roach.inFire = true;
      }
    }

    // 应用伤害
    const baseDamage = zone.damagePerSecond * this.config.deltaTime;
    for (const entry of inZone) {
      const roach = entry.roach;
      
      // 跳过放置炸弹期间的定时自杀蟑螂（无敌）
      if (roach.type === 'timed_suicide' && roach.placeTimer && roach.placeTimer > 0) {
        continue;
      }
      
      if (entry.protected) {
        // 受装甲护盾保护的蟑螂只受到20%伤害
        roach.hp -= baseDamage * 0.2;
        roach.damageFlash = 0;
      } else {
        // 正常伤害
        roach.hp -= baseDamage;
        roach.damageFlash = (roach.armorHp > 0) ? 0 : 0.1;
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

      // 计算火焰墙对蟑螂的伤害
      this.applyFireWallDamage(wall, roaches);
    }
  }

  /**
   * 应用火焰墙伤害
   * @param wall 火焰墙对象
   * @param roaches 蟑螂数组
   */
  private applyFireWallDamage(wall: FireWall, roaches: Roach[]): void {
    for (const roach of roaches) {
      if (roach.state !== 'alive' || roach.isBoss) {
        continue;
      }
      
      // 飞行蟑螂从火焰墙上空飞过，不受影响
      if (roach.type === 'flying' || roach.type === 'flying_suicide') {
        continue;
      }
      
      // 跳过放置炸弹期间的定时自杀蟑螂（无敌）
      if (roach.type === 'timed_suicide' && roach.placeTimer && roach.placeTimer > 0) {
        continue;
      }
      
      // 检查碰撞
      const roachSize = roach.size ?? (ENEMY_DEFS[roach.type]?.size || 30);
      const wallWidth = wall.x2 - wall.x1;
      const halfWidth = wallWidth / 2;
      const halfHeight = wall.height / 2;
      
      // 计算火墙中心点
      const wallCenterX = (wall.x1 + wall.x2) / 2;
      const dx = Math.abs(roach.x - wallCenterX);
      const dy = Math.abs(roach.y - wall.y);
      
      if (dx < halfWidth + roachSize * 0.5 && dy < halfHeight + roachSize * 0.5) {
        // 应用伤害
        const damage = wall.damagePerSecond * this.config.deltaTime;
        roach.hp -= damage;
        roach.inFire = true;
        roach.damageFlash = (roach.armorHp > 0) ? 0 : 0.1;
      }
    }
  }

  /**
   * 生成爆炸粒子
   * @param x 爆炸位置X坐标
   * @param y 爆炸位置Y坐标
   * @param intensity 爆炸强度
   */
  spawnExplosionParticles(x: number, y: number, intensity: number = 30): void {
    const particleCount = Math.min(intensity * 3, 100);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      const life = 0.5 + Math.random() * 1.0;
      const size = 2 + Math.random() * 6;
      
      // 随机选择爆炸粒子类型
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
        color: type === ParticleType.SMOKE ? '#666666' : 
               type === ParticleType.FIRE ? '#ff5500' : 
               type === ParticleType.EMBER ? '#ffaa00' : '#ffff00',
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
   * 添加浮动文字
   * @param params 浮动文字参数
   */
  addFloatingText(params: FloatingTextParams): void {
    this.floatingTexts.push({
      x: params.x,
      y: params.y,
      text: params.text,
      color: params.color || '#ffffff',
      life: params.life || 2.0,
      maxLife: params.life || 2.0,
      vy: -30, // 默认向上飘浮
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
    // 计算火焰墙的左右边界
    const halfWidth = params.width / 2;
    const x1 = params.x - halfWidth;
    const x2 = params.x + halfWidth;
    
    this.fireWalls.push({
      y: params.y,
      x1: x1,
      x2: x2,
      height: params.height,
      damagePerSecond: params.damagePerSecond,
      life: params.life,
      maxLife: params.life,
    });
  }

  /**
   * 生成锥形火焰粒子
   * @description 从旧引擎移植的锥形火焰粒子生成算法
   * 每帧生成3-6个火焰粒子在锥形区域内，附加枪口火花和火焰区域
   * @param params 锥形火焰参数
   */
  spawnConeFire(params: ConeFireParams): void {
    const { x: gx, y: gy, angle, range, spreadAngle, baseDamage, type = 'fire' } = params;
    const count = Math.floor(3 + Math.random() * 3); // 3-6 particles
    const isIce = type === 'ice';
    const isPoison = type === 'poison';

    for (let i = 0; i < count; i++) {
      const rDist = Math.random() * range;
      const rAngle = angle + (Math.random() - 0.5) * spreadAngle;
      const px = gx + Math.cos(rAngle) * rDist;
      const py = gy + Math.sin(rAngle) * rDist;
      const life = 0.06 + Math.random() * 0.08; // 0.06-0.14s
      const flowSpeed = 100 + Math.random() * 60;
      let color = '';
      let particleType: ParticleType;
      let size = 0;

      if (isIce) {
        color = `rgba(${180 + Math.random() * 40}, ${220 + Math.random() * 20}, 255, ${0.5 + Math.random() * 0.5})`;
        particleType = ParticleType.ICE;
        size = 2 + Math.random() * 4;
      } else if (isPoison) {
        color = `rgba(${100 + Math.random() * 40}, ${220 + Math.random() * 30}, ${100 + Math.random() * 40}, ${0.4 + Math.random() * 0.4})`;
        particleType = ParticleType.POISON_CLOUD;
        size = 3 + Math.random() * 5;
      } else {
        const temp = Math.random();
        if (temp < 0.5) {
          color = `rgba(255, ${100 + Math.random() * 80}, ${Math.random() * 40}, ${0.7 + Math.random() * 0.3})`;
          particleType = ParticleType.FIRE;
          size = 2 + Math.random() * 5;
        } else {
          color = `rgba(255, ${200 + Math.random() * 55}, ${50 + Math.random() * 50}, ${0.5 + Math.random() * 0.5})`;
          particleType = ParticleType.EMBER;
          size = 1 + Math.random() * 3;
        }
      }

      this.particles.push({
        x: px, y: py,
        vx: Math.cos(rAngle) * flowSpeed,
        vy: Math.sin(rAngle) * flowSpeed,
        life, maxLife: life,
        size, color,
        type: particleType,
      });
    }

    // 枪口火花
    this.particles.push({
      x: gx, y: gy,
      vx: (Math.random() - 0.5) * 60,
      vy: -60 - Math.random() * 40,
      life: 0.08,
      maxLife: 0.08,
      size: 2 + Math.random() * 3,
      color: '#fff',
      type: ParticleType.SPARK,
    });

    // 火焰区域 - 锥形火焰中心区域造成伤害
    const zoneDamage = baseDamage / 0.016 * 3; // 转换为每秒伤害 (baseDamage是每帧伤害，约0.016s/帧)
    this.fireZones.push({
      x: gx + Math.cos(angle) * range / 2,
      y: gy + Math.sin(angle) * range / 2,
      radius: range * 0.8,
      damagePerSecond: zoneDamage,
      life: 0.5,
      maxLife: 0.5,
      type,
    });
    // 限制火焰区域数量
    if (this.fireZones.length > 25) {
      this.fireZones.length = 25;
    }
  }

  /**
   * 清空所有粒子效果
   */
  clearAll(): void {
    this.particles = [];
    this.floatingTexts = [];
    this.fireZones = [];
    this.fireWalls = [];
    this.armorShieldCache.clear();
  }

  /**
   * 使用外部数组更新粒子、浮动文字和火焰区域（不包括火焰墙）
   * @description 用于与旧引擎渐进式集成，火焰墙由引擎自行处理（含音频/天赋逻辑）
   * @param particles 外部粒子数组
   * @param floatingTexts 外部浮动文字数组
   * @param fireZones 外部火焰区域数组
   * @param roaches 蟑螂数组（用于火焰伤害计算）
   * @param armorShieldCache 装甲护盾缓存
   */
  updateParticlesAndFloatingTexts(
    particles: Particle[],
    floatingTexts: FloatingText[],
    fireZones: FireZone[],
    roaches: Roach[],
    armorShieldCache: Set<number>
  ): void {
    this.particles = particles;
    this.floatingTexts = floatingTexts;
    this.fireZones = fireZones;
    this.armorShieldCache = armorShieldCache;

    this.updateParticles();
    this.updateFloatingTexts();
    this.updateFireZones(roaches);
  }

  /**
   * 使用外部数组更新粒子系统（用于与旧引擎渐进式集成）
   * @description 直接操作引擎传入的数组引用，更新后数组内容被修改
   * @param particles 外部粒子数组
   * @param floatingTexts 外部浮动文字数组
   * @param fireZones 外部火焰区域数组
   * @param fireWalls 外部火焰墙数组
   * @param roaches 蟑螂数组（用于火焰伤害计算）
   * @param armorShieldCache 装甲护盾缓存
   */
  updateExternalArrays(
    particles: Particle[],
    floatingTexts: FloatingText[],
    fireZones: FireZone[],
    fireWalls: FireWall[],
    roaches: Roach[],
    armorShieldCache: Set<number>
  ): void {
    this.particles = particles;
    this.floatingTexts = floatingTexts;
    this.fireZones = fireZones;
    this.fireWalls = fireWalls;
    this.armorShieldCache = armorShieldCache;

    this.updateParticles();
    this.updateFloatingTexts();
    this.updateFireZones(roaches);
    this.updateFireWalls(roaches);
  }

  /**
   * 渲染粒子（静态方法，用于与旧引擎集成）
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
          const fireGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 0.8);
          fireGrad.addColorStop(0, p.color);
          fireGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
          ctx.fillStyle = fireGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
          break;

        case ParticleType.SMOKE:
          ctx.globalAlpha = alpha * 0.5;
          ctx.globalCompositeOperation = 'source-over';
          const smokeGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          smokeGrad.addColorStop(0, p.color);
          smokeGrad.addColorStop(1, 'rgba(80, 80, 80, 0)');
          ctx.fillStyle = smokeGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
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
          const iceGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          iceGrad.addColorStop(0, p.color);
          iceGrad.addColorStop(1, 'rgba(200, 250, 255, 0)');
          ctx.fillStyle = iceGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case ParticleType.POISON_CLOUD:
          ctx.globalAlpha = alpha * 0.6;
          ctx.globalCompositeOperation = 'screen';
          const poisonGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          poisonGrad.addColorStop(0, p.color);
          poisonGrad.addColorStop(1, 'rgba(150, 100, 255, 0)');
          ctx.fillStyle = poisonGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
          break;

        case ParticleType.EXPLOSION:
          ctx.globalAlpha = alpha;
          if (p.isSlime) {
            ctx.globalCompositeOperation = 'source-over';
            const slimeGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.5);
            slimeGrad.addColorStop(0, p.color);
            slimeGrad.addColorStop(0.7, `rgba(60, 200, 60, ${alpha * 0.5})`);
            slimeGrad.addColorStop(1, 'rgba(40, 120, 40, 0)');
            ctx.fillStyle = slimeGrad;
            ctx.shadowColor = 'rgba(100, 255, 100, 0.8)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            ctx.globalCompositeOperation = 'screen';
            const explGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.5);
            explGrad.addColorStop(0, p.color);
            explGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
            ctx.fillStyle = explGrad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case ParticleType.SHIELD:
          const expandProgress = 1 - alpha;
          const ringRadius = p.size * expandProgress;
          ctx.globalAlpha = alpha * 0.6;
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = '#60a5fa';
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
          ctx.shadowColor = '#aaddff';
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
   * 渲染浮动文字（静态方法，用于与旧引擎集成）
   * @param ctx Canvas 渲染上下文
   * @param floatingTexts 浮动文字数组
   */
  static renderFloatingTexts(ctx: CanvasRenderingContext2D, floatingTexts: FloatingText[]): void {
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
    ctx.globalAlpha = 1;
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
   * 设置装甲护盾缓存
   * @param cache 装甲护盾缓存映射
   */
  setArmorShieldCache(cache: Set<number>): void {
    this.armorShieldCache = cache;
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
