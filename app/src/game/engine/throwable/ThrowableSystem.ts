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
  ParticleType
} from '../../types';

/**
 * 投掷物系统配置接口
 */
export interface ThrowableSystemConfig {
  /** 时间增量 */
  deltaTime: number;
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 屏幕震动强度 */
  screenShake: number;
  /** 添加浮动文字回调函数 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 添加火焰区域回调函数 */
  onAddFireZone?: (fireZone: FireZone) => void;
  /** 生成爆炸粒子回调函数 */
  onSpawnExplosionParticles?: (x: number, y: number, count: number) => void;
  /** 生成火花粒子回调函数 */
  onSpawnSparkParticles?: (x: number, y: number, count: number) => void;
  /** 生成冰爆炸粒子回调函数 */
  onSpawnIceExplosion?: (x: number, y: number, radius: number) => void;
  /** 生成毒雾爆炸粒子回调函数 */
  onSpawnPoisonExplosion?: (x: number, y: number, radius: number) => void;
  /** 更新屏幕震动回调函数 */
  onUpdateScreenShake?: (shake: number) => void;
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
  
  /**
   * 构造函数
   * @param config 系统配置
   */
  constructor(config: ThrowableSystemConfig) {
    this.config = config;
  }
  
  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<ThrowableSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 添加投掷物
   * @param throwable 投掷物数据
   */
  addThrowable(throwable: ThrowableProjectile): void {
    this.throwables.push(throwable);
  }
  
  /**
   * 获取所有投掷物
   * @returns 投掷物数组
   */
  getThrowables(): ThrowableProjectile[] {
    return [...this.throwables];
  }
  
  /**
   * 清除所有投掷物
   */
  clearThrowables(): void {
    this.throwables = [];
  }
  
  /**
   * 更新投掷物逻辑
   * @param roaches 当前蟑螂数组
   * @returns 更新后的投掷物数组
   */
  updateThrowables(roaches: Roach[]): ThrowableProjectile[] {
    const { deltaTime } = this.config;
    
    // 从后向前遍历，便于删除
    for (let i = this.throwables.length - 1; i >= 0; i--) {
      const t = this.throwables[i];
      t.life -= deltaTime;
      
      // 处理飞行中的投掷物
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
      
      // 检查生命周期结束
      if (t.life <= 0) {
        if (!t.hasLanded) {
          this.onThrowableLand(t, roaches);
        }
        this.throwables.splice(i, 1);
      }
    }
    
    return this.throwables;
  }
  
  /**
   * 投掷物落地处理
   * @param t 投掷物数据
   * @param roaches 当前蟑螂数组
   */
  private onThrowableLand(t: ThrowableProjectile, roaches: Roach[]): void {
    switch (t.type) {
      case 'sticky':
        this.handleStickyLand(t, roaches);
        break;
      case 'poison':
        this.handlePoisonLand(t, roaches);
        break;
      case 'molotov':
        this.handleMolotovLand(t, roaches);
        break;
    }
    
    // 生成火花粒子
    if (this.config.onSpawnSparkParticles) {
      this.config.onSpawnSparkParticles(t.x, t.y, 10);
    }
  }
  
  /**
   * 处理粘性投掷物落地
   * @param t 投掷物数据
   * @param roaches 当前蟑螂数组
   */
  private handleStickyLand(t: ThrowableProjectile, roaches: Roach[]): void {
    const radius = 80;
    
    // 影响范围内的蟑螂
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      
      // 跳过正在放置炸弹的定时自爆蟑螂（无敌状态）
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
      
      const dx = r.x - t.x;
      const dy = r.y - t.y;
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        r.stuckTimer = 5;
        r.speed = r.baseSpeed * 0.2;
        r.hp -= 2;
      }
    }
    
    // 创建持久冰区域
    if (this.config.onAddFireZone) {
      this.config.onAddFireZone({
        x: t.x,
        y: t.y,
        radius,
        damagePerSecond: 30,
        life: 4,
        maxLife: 4,
        type: 'ice'
      });
    }
    
    // 生成冰爆炸粒子
    if (this.config.onSpawnIceExplosion) {
      this.config.onSpawnIceExplosion(t.x, t.y, radius);
    }
    
    // 添加浮动文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(t.x, t.y - 20, '冰冻!', '#facc15');
    }
  }
  
  /**
   * 处理毒雾投掷物落地
   * @param t 投掷物数据
   * @param roaches 当前蟑螂数组
   */
  private handlePoisonLand(t: ThrowableProjectile, roaches: Roach[]): void {
    const radius = 90;
    
    // 影响范围内的蟑螂
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      
      // 跳过正在放置炸弹的定时自爆蟑螂（无敌状态）
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
      
      const dx = r.x - t.x;
      const dy = r.y - t.y;
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        // 护甲免疫：毒雾对装甲蟑螂无效
        if (r.armorHp > 0) {
          if (this.config.onAddFloatingText) {
            this.config.onAddFloatingText(r.x, r.y - 15, '护甲免疫!', '#60a5fa');
          }
          continue;
        }
        
        r.poisonTimer = 6;
        r.poisonDamage = 2;
        r.hp -= 1;
      }
    }
    
    // 创建持久毒雾区域
    if (this.config.onAddFireZone) {
      this.config.onAddFireZone({
        x: t.x,
        y: t.y,
        radius,
        damagePerSecond: 25,
        life: 6,
        maxLife: 6,
        type: 'poison'
      });
    }
    
    // 生成毒雾爆炸粒子
    if (this.config.onSpawnPoisonExplosion) {
      this.config.onSpawnPoisonExplosion(t.x, t.y, radius);
    }
    
    // 添加浮动文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(t.x, t.y - 20, '毒雾!', '#a78bfa');
    }
  }
  
  /**
   * 处理燃烧瓶投掷物落地
   * @param t 投掷物数据
   * @param roaches 当前蟑螂数组
   */
  private handleMolotovLand(t: ThrowableProjectile, roaches: Roach[]): void {
    const radius = 70;
    
    // 影响范围内的蟑螂
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      
      // 跳过正在放置炸弹的定时自爆蟑螂（无敌状态）
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
      
      const dx = r.x - t.x;
      const dy = r.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < radius) {
        // 护甲免疫：燃烧瓶对装甲蟑螂无效
        if (r.armorHp > 0) {
          if (this.config.onAddFloatingText) {
            this.config.onAddFloatingText(r.x, r.y - 15, '护甲免疫!', '#60a5fa');
          }
          continue;
        }
        
        // 距离越近伤害越高
        const dmg = 8 * (1 - dist / radius);
        r.hp -= dmg;
        r.burnDamage = dmg * 2;
      }
    }
    
    // 创建持久火焰区域
    if (this.config.onAddFireZone) {
      this.config.onAddFireZone({
        x: t.x,
        y: t.y,
        radius,
        damagePerSecond: 60,
        life: 5,
        maxLife: 5,
        type: 'fire'
      });
    }
    
    // 生成爆炸粒子
    if (this.config.onSpawnExplosionParticles) {
      this.config.onSpawnExplosionParticles(t.x, t.y, 25);
    }
    
    // 屏幕震动
    if (this.config.onUpdateScreenShake) {
      this.config.onUpdateScreenShake(8);
    }
    
    // 添加浮动文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(t.x, t.y - 20, '燃烧!', '#f87171');
    }
  }
  
  /**
   * 生成冰爆炸粒子
   * @param x X坐标
   * @param y Y坐标
   * @param _radius 爆炸半径（未使用，保持接口一致性）
   * @returns 粒子数组
   */
  spawnIceExplosion(x: number, y: number, _radius: number): any[] {
    const particles: any[] = [];
    
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.4 + Math.random() * 0.6,
        maxLife: 1,
        size: 3 + Math.random() * 8,
        color: `hsl(${180 + Math.random() * 30}, 90%, ${70 + Math.random() * 20}%)`,
        type: ParticleType.ICE
      });
    }
    
    return particles;
  }
  
  /**
   * 生成毒雾爆炸粒子
   * @param x X坐标
   * @param y Y坐标
   * @param _radius 爆炸半径（未使用，保持接口一致性）
   * @returns 粒子数组
   */
  spawnPoisonExplosion(x: number, y: number, _radius: number): any[] {
    const particles: any[] = [];
    
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.5 + Math.random() * 0.8,
        maxLife: 1.3,
        size: 4 + Math.random() * 12,
        color: `hsl(${260 + Math.random() * 30}, 80%, ${50 + Math.random() * 20}%)`,
        type: ParticleType.POISON_CLOUD
      });
    }
    
    return particles;
  }
}