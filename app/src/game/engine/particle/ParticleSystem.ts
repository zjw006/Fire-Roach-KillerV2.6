/**
 * @fileoverview 粒子系统模块
 * @description 负责管理游戏中的粒子效果、浮动文字、火焰区域和火焰墙
 */

import { ParticleType, type Particle, type Roach, type FireZone, type FireWall, type FloatingText } from '../../types';
import { ENEMY_DEFS } from '../../data';

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
  
  /** 装甲护盾缓存（用于优化碰撞检测） */
  private armorShieldCache: Map<number, boolean> = new Map();

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
   * 设置装甲护盾缓存
   * @param cache 装甲护盾缓存映射
   */
  setArmorShieldCache(cache: Map<number, boolean>): void {
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
