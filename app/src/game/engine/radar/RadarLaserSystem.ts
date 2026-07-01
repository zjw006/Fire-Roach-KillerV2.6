/**
 * @fileoverview 雷达激光系统模块
 * @description 负责管理游戏中雷达激光武器的逻辑，包括自动追踪、激光射击、伤害计算等
 */

import { type RadarLaser, type Roach, RoachState, ParticleType } from '../../types';

/**
 * 雷达激光系统配置接口
 */
export interface RadarLaserSystemConfig {
  /** 时间增量 */
  deltaTime: number;
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 玩家X坐标 */
  playerX: number;
  /** 玩家Y坐标 */
  playerY: number;
  /** 添加浮动文字回调函数 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 播放音效回调函数 */
  onPlaySound?: (soundName: string) => void;
  /** 添加粒子回调函数 */
  onAddParticle?: (particle: any) => void;
  /** 生成火花粒子回调函数 */
  onSpawnSparkParticles?: (x: number, y: number, count: number) => void;
  /** 杀死蟑螂回调函数 */
  onKillRoach?: (roach: Roach, index: number) => void;
}

/**
 * 雷达激光系统类
 * @description 管理游戏中雷达激光武器的逻辑，包括自动追踪、激光射击、伤害计算等
 */
export class RadarLaserSystem {
  /** 系统配置 */
  private config: RadarLaserSystemConfig;
  
  /** 雷达激光状态 */
  private radarLaser: RadarLaser;
  
  /**
   * 构造函数
   * @param config 系统配置
   */
  constructor(config: RadarLaserSystemConfig) {
    this.config = config;
    
    // 初始化雷达激光状态
    this.radarLaser = {
      active: false,
      timer: 0,
      duration: 8,
      fireTimer: 0,
      fireInterval: 0.8,
      targetId: null,
      laserAlpha: 0,
      shotsRemaining: 5,
      damage: 4
    };
  }
  
  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<RadarLaserSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 激活雷达激光
   * @param duration 持续时间（秒）
   * @returns 是否成功激活
   */
  activateRadarLaser(duration: number = 8): boolean {
    if (this.radarLaser.active) {
      // 如果已经激活，重置计时器
      this.radarLaser.timer = duration;
      return true;
    }
    
    this.radarLaser.active = true;
    this.radarLaser.timer = duration;
    this.radarLaser.duration = duration;
    this.radarLaser.fireTimer = 0;
    this.radarLaser.targetId = null;
    this.radarLaser.laserAlpha = 1;
    this.radarLaser.shotsRemaining = 5;
    
    // 播放激活音效
    if (this.config.onPlaySound) {
      this.config.onPlaySound('radar_activate');
    }
    
    // 添加浮动文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 2 - 60,
        '雷达激光启动! 自动追踪目标',
        '#22d3ee'
      );
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 2 - 40,
        '5发激光，伤害与小蟑螂一致',
        '#67e8f9'
      );
    }
    
    return true;
  }
  
  /**
   * 更新雷达激光逻辑
   * @param roaches 当前蟑螂数组
   * @returns 更新后的雷达激光状态和需要执行的行动
   */
  updateRadarLaser(roaches: Roach[]): {
    radarState: RadarLaser;
    actions: {
      spawnSparkParticles?: { x: number; y: number; count: number };
      addFloatingText?: { x: number; y: number; text: string; color: string };
      killRoach?: { roach: Roach; index: number };
    };
  } {
    const actions: any = {};
    
    if (!this.radarLaser.active) {
      return { radarState: this.radarLaser, actions };
    }
    
    // 更新计时器
    const prevTimer = this.radarLaser.timer;
    this.radarLaser.timer -= this.config.deltaTime;
    this.radarLaser.fireTimer -= this.config.deltaTime;
    
    // 倒计时警告
    if (prevTimer > 3 && this.radarLaser.timer <= 3) {
      if (this.config.onAddFloatingText) {
        actions.addFloatingText = {
          x: this.config.canvasWidth / 2,
          y: this.config.canvasHeight / 2 - 80,
          text: '雷达激光 3秒...',
          color: '#67e8f9'
        };
      }
    }
    
    if (prevTimer > 1 && this.radarLaser.timer <= 1) {
      if (this.config.onAddFloatingText) {
        actions.addFloatingText = {
          x: this.config.canvasWidth / 2,
          y: this.config.canvasHeight / 2 - 60,
          text: '雷达激光即将关闭!',
          color: '#f87171'
        };
      }
    }
    
    // 检查是否结束
    if (this.radarLaser.timer <= 0) {
      this.radarLaser.active = false;
      this.radarLaser.timer = 0;
      this.radarLaser.laserAlpha = 0;
      
      if (this.config.onAddFloatingText) {
        actions.addFloatingText = {
          x: this.config.canvasWidth / 2,
          y: this.config.canvasHeight / 2 - 50,
          text: '雷达激光关闭',
          color: '#9ca3af'
        };
      }
      
      return { radarState: this.radarLaser, actions };
    }
    
    // 查找目标
    let target = this.findTarget(roaches);
    
    if (!target) {
      // 没有目标
      this.radarLaser.targetId = null;
      return { radarState: this.radarLaser, actions };
    }
    
    // 设置目标ID
    this.radarLaser.targetId = target.id;
    
    // 发射激光
    if (this.radarLaser.fireTimer <= 0 && this.radarLaser.shotsRemaining > 0) {
      this.radarLaser.fireTimer = this.radarLaser.fireInterval;
      this.radarLaser.shotsRemaining--;
      
      // 播放射击音效
      if (this.config.onPlaySound) {
        this.config.onPlaySound('radar_shot');
      }
      
      // 雷达激光对Boss无效
      if (target.isBoss) {
        return { radarState: this.radarLaser, actions };
      }
      
      // 跳过正在放置炸弹的定时自爆蟑螂（无敌状态）
      if (target.type === 'timed_suicide' && target.placeTimer && target.placeTimer > 0) {
        return { radarState: this.radarLaser, actions };
      }
      
      // 应用伤害
      const damage = this.radarLaser.damage;
      target.hp -= damage;
      target.damageFlash = 1;
      
      // 生成火花粒子
      if (this.config.onSpawnSparkParticles) {
        actions.spawnSparkParticles = {
          x: target.x,
          y: target.y,
          count: 8
        };
      }
      
      // 添加激光击中粒子
      if (this.config.onAddParticle) {
        this.config.onAddParticle({
          x: target.x,
          y: target.y,
          vx: 0,
          vy: -20,
          life: 0.3,
          maxLife: 0.3,
          size: 8,
          color: '#22d3ee',
          type: ParticleType.EXPLOSION
        });
      }
      
      // 显示剩余射击次数
      if (this.radarLaser.shotsRemaining > 0) {
        if (this.config.onAddFloatingText) {
          actions.addFloatingText = {
            x: this.config.playerX + 30,
            y: this.config.playerY - 40,
            text: `激光 x${this.radarLaser.shotsRemaining}`,
            color: '#22d3ee'
          };
        }
      } else {
        if (this.config.onAddFloatingText) {
          actions.addFloatingText = {
            x: this.config.canvasWidth / 2,
            y: this.config.canvasHeight / 2 - 50,
            text: '激光发射完毕!',
            color: '#9ca3af'
          };
        }
        this.radarLaser.active = false;
        this.radarLaser.laserAlpha = 0;
      }
      
      // 检查是否死亡
      if (target.hp <= 0) {
        const index = roaches.indexOf(target);
        if (index !== -1 && this.config.onKillRoach) {
          actions.killRoach = {
            roach: target,
            index: index
          };
        }
        
        if (this.config.onAddFloatingText) {
          actions.addFloatingText = {
            x: target.x,
            y: target.y - 20,
            text: '激光击杀!',
            color: '#22d3ee'
          };
        }
        
        this.radarLaser.targetId = null;
      } else {
        if (this.config.onAddFloatingText) {
          actions.addFloatingText = {
            x: target.x,
            y: target.y - 30,
            text: `-${damage}`,
            color: '#22d3ee'
          };
        }
      }
    }
    
    return { radarState: this.radarLaser, actions };
  }
  
  /**
   * 查找目标
   * @param roaches 蟑螂数组
   * @returns 找到的目标或null
   */
  private findTarget(roaches: Roach[]): Roach | null {
    // 如果当前有目标且目标存活，继续使用该目标
    if (this.radarLaser.targetId !== null) {
      const currentTarget = roaches.find(r => r.id === this.radarLaser.targetId && r.state === RoachState.ALIVE);
      if (currentTarget) {
        return currentTarget;
      }
    }
    
    // 查找最近的存活蟑螂（优先无装甲，后备装甲）
    let closestUnarmored: Roach | null = null;
    let minDistUnarmored = Infinity;
    
    let closestArmored: Roach | null = null;
    let minDistArmored = Infinity;
    
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      
      const dx = r.x - this.config.playerX;
      const dy = r.y - this.config.playerY;
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
    
    // 优先无装甲目标；只有在没有无装甲蟑螂时才瞄准装甲蟑螂
    return closestUnarmored ?? closestArmored;
  }
  
  /**
   * 获取雷达激光状态
   * @returns 雷达激光状态
   */
  getRadarLaserState(): RadarLaser {
    return { ...this.radarLaser };
  }
  
  /**
   * 设置雷达激光状态
   * @param state 新的状态
   */
  setRadarLaserState(state: Partial<RadarLaser>): void {
    this.radarLaser = { ...this.radarLaser, ...state };
  }
  
  /**
   * 检查雷达激光是否激活
   * @returns 是否激活
   */
  isActive(): boolean {
    return this.radarLaser.active;
  }
  
  /**
   * 获取剩余时间
   * @returns 剩余时间（秒）
   */
  getRemainingTime(): number {
    return Math.max(0, this.radarLaser.timer);
  }
  
  /**
   * 获取剩余射击次数
   * @returns 剩余射击次数
   */
  getRemainingShots(): number {
    return this.radarLaser.shotsRemaining;
  }
  
  /**
   * 获取当前目标ID
   * @returns 目标ID或null
   */
  getTargetId(): number | null {
    return this.radarLaser.targetId;
  }
  
  /**
   * 设置目标ID
   * @param targetId 目标ID
   */
  setTargetId(targetId: number | null): void {
    this.radarLaser.targetId = targetId;
  }
  
  /**
   * 获取激光透明度
   * @returns 透明度（0-1）
   */
  getLaserAlpha(): number {
    return this.radarLaser.laserAlpha;
  }
  
  /**
   * 设置激光透明度
   * @param alpha 透明度（0-1）
   */
  setLaserAlpha(alpha: number): void {
    this.radarLaser.laserAlpha = Math.max(0, Math.min(1, alpha));
  }
  
  /**
   * 获取激光伤害
   * @returns 伤害值
   */
  getDamage(): number {
    return this.radarLaser.damage;
  }
  
  /**
   * 设置激光伤害
   * @param damage 伤害值
   */
  setDamage(damage: number): void {
    this.radarLaser.damage = Math.max(0, damage);
  }
  
  /**
   * 获取射击间隔
   * @returns 射击间隔（秒）
   */
  getFireInterval(): number {
    return this.radarLaser.fireInterval;
  }
  
  /**
   * 设置射击间隔
   * @param interval 射击间隔（秒）
   */
  setFireInterval(interval: number): void {
    this.radarLaser.fireInterval = Math.max(0.1, interval);
  }
}