/**
 * @fileoverview 瞄准系统模块
 * @description 负责管理游戏中投掷武器的瞄准逻辑，包括蓄力计算、抛物线轨迹、投掷执行等
 */

import { type ThrowableProjectile } from '../../types';

/**
 * 瞄准系统配置接口
 */
export interface AimingSystemConfig {
  /** 游戏时间 */
  gameTime: number;
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 玩家X坐标 */
  playerX: number;
  /** 玩家Y坐标 */
  playerY: number;
  /** 防线Y坐标 */
  defenseLineY: number;
  /** 添加浮动文字回调函数 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 播放音效回调函数 */
  onPlaySound?: (soundName: string) => void;
}

/**
 * 瞄准系统类
 * @description 管理游戏中投掷武器的瞄准逻辑，包括蓄力计算、抛物线轨迹、投掷执行等
 */
export class AimingSystem {
  /** 系统配置 */
  private config: AimingSystemConfig;
  
  /** 是否正在瞄准 */
  private isAiming: boolean = false;
  
  /** 瞄准的武器类型 */
  private aimWeapon: string | null = null;
  
  /** 瞄准开始时间 */
  private aimStartTime: number = 0;
  
  /** 瞄准力量（0-1） */
  private aimPower: number = 0;
  
  /** 瞄准目标X坐标 */
  private aimTargetX: number = 0;
  
  /** 瞄准目标Y坐标 */
  private aimTargetY: number = 0;
  
  /** 最小瞄准距离 */
  private aimMinDist: number = 150;
  
  /** 最大瞄准距离 */
  private aimMaxDist: number = 450;
  
  /** 最大蓄力时间（秒） */
  private aimMaxPowerTime: number = 1.5;
  
  /**
   * 构造函数
   * @param config 系统配置
   */
  constructor(config: AimingSystemConfig) {
    this.config = config;
  }
  
  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<AimingSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 开始瞄准
   * @param weapon 武器类型
   * @returns 是否成功开始瞄准
   */
  startAiming(weapon: string): boolean {
    if (this.isAiming) return false;
    
    this.isAiming = true;
    this.aimWeapon = weapon;
    this.aimStartTime = this.config.gameTime;
    this.aimPower = 0;
    
    // 初始目标：正上方最小距离
    this.aimTargetX = this.config.playerX;
    this.aimTargetY = this.config.playerY - 322 - this.aimMinDist;
    
    return true;
  }
  
  /**
   * 更新瞄准逻辑
   * @returns 更新后的瞄准状态
   */
  updateAiming(): {
    isAiming: boolean;
    aimWeapon: string | null;
    aimPower: number;
    aimTargetX: number;
    aimTargetY: number;
  } {
    if (!this.isAiming) {
      return {
        isAiming: false,
        aimWeapon: null,
        aimPower: 0,
        aimTargetX: 0,
        aimTargetY: 0
      };
    }
    
    // 力量随按住时间增加（0到1）
    const holdDuration = this.config.gameTime - this.aimStartTime;
    this.aimPower = Math.min(1, holdDuration / this.aimMaxPowerTime);
    
    // Y距离：基于力量从最小到最大
    const dist = this.aimMinDist + (this.aimMaxDist - this.aimMinDist) * this.aimPower;
    
    // 限制目标位置
    this.aimTargetX = Math.max(40, Math.min(this.config.canvasWidth - 40, this.aimTargetX));
    this.aimTargetY = Math.max(
      60,
      Math.min(
        this.config.defenseLineY - 20,
        this.config.playerY - 322 - dist
      )
    );
    
    return {
      isAiming: this.isAiming,
      aimWeapon: this.aimWeapon,
      aimPower: this.aimPower,
      aimTargetX: this.aimTargetX,
      aimTargetY: this.aimTargetY
    };
  }
  
  /**
   * 调整瞄准
   * @param dx X方向调整量（屏幕像素）
   */
  adjustAim(dx: number): void {
    if (!this.isAiming) return;
    
    // dx来自输入是屏幕像素，转换为游戏坐标
    this.aimTargetX += dx * 1.5;
    this.aimTargetX = Math.max(40, Math.min(this.config.canvasWidth - 40, this.aimTargetX));
  }
  
  /**
   * 投掷瞄准的武器
   * @param nextId 下一个投掷物ID
   * @param playerIsTempWeapon 玩家是否使用临时武器
   * @param playerWeaponAmmo 玩家武器弹药
   * @returns 生成的投掷物和更新后的弹药
   */
  throwAimedWeapon(
    nextId: number,
    playerIsTempWeapon: boolean,
    playerWeaponAmmo: Record<string, number>
  ): {
    throwable: ThrowableProjectile | null;
    updatedAmmo: Record<string, number>;
  } {
    if (!this.isAiming || !this.aimWeapon) {
      return { throwable: null, updatedAmmo: playerWeaponAmmo };
    }
    
    const weapon = this.aimWeapon;
    const startX = this.config.playerX;
    const startY = this.config.playerY - 322;
    const targetX = this.aimTargetX;
    const targetY = this.aimTargetY;
    
    // 计算抛物线轨迹的速度
    const dx = targetX - startX;
    const dy = targetY - startY;
    const travelTime = 0.5 + this.aimPower * 0.3;
    const vx = dx / travelTime;
    
    // vy计算考虑重力到达targetY
    // y = vy * t + 0.5 * g * t^2 => vy = (dy - 0.5 * g * t^2) / t
    const gravity = 400;
    const vy = (dy - 0.5 * gravity * travelTime * travelTime) / travelTime;
    
    const throwableId = nextId + 1;
    
    const throwable: ThrowableProjectile = {
      id: throwableId,
      x: startX,
      y: startY,
      vx,
      vy,
      type: weapon as 'sticky' | 'poison' | 'molotov',
      life: travelTime * 2,
      maxLife: travelTime * 2,
      gravity,
      hasLanded: false,
      targetX,
      targetY
    };
    
    // 如果使用临时武器，扣除弹药
    const updatedAmmo = { ...playerWeaponAmmo };
    if (playerIsTempWeapon && weapon in updatedAmmo) {
      updatedAmmo[weapon] = Math.max(0, updatedAmmo[weapon] - 1);
    }
    
    // 播放燃烧瓶投掷音效
    if (weapon === 'molotov' && this.config.onPlaySound) {
      this.config.onPlaySound('molotov_throw');
    }
    
    // 添加浮动文字
    const names: Record<string, string> = {
      sticky: '蟑螂贴板',
      poison: '杀虫剂',
      molotov: '燃烧瓶'
    };
    
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        startX,
        startY - 30,
        `投掷${names[weapon]}!`,
        '#fbbf24'
      );
    }
    
    // 重置瞄准状态
    this.isAiming = false;
    this.aimWeapon = null;
    this.aimPower = 0;
    
    return { throwable, updatedAmmo };
  }
  
  /**
   * 取消瞄准
   */
  cancelAiming(): void {
    this.isAiming = false;
    this.aimWeapon = null;
    this.aimPower = 0;
  }
  
  /**
   * 获取当前瞄准状态
   * @returns 瞄准状态
   */
  getAimingState(): {
    isAiming: boolean;
    aimWeapon: string | null;
    aimPower: number;
    aimTargetX: number;
    aimTargetY: number;
  } {
    return {
      isAiming: this.isAiming,
      aimWeapon: this.aimWeapon,
      aimPower: this.aimPower,
      aimTargetX: this.aimTargetX,
      aimTargetY: this.aimTargetY
    };
  }
  
  /**
   * 设置瞄准目标
   * @param targetX 目标X坐标
   * @param targetY 目标Y坐标
   */
  setAimTarget(targetX: number, targetY: number): void {
    this.aimTargetX = targetX;
    this.aimTargetY = targetY;
  }
  
  /**
   * 计算抛物线轨迹点
   * @param startX 起始X坐标
   * @param startY 起始Y坐标
   * @param vx X方向速度
   * @param vy Y方向速度
   * @param gravity 重力
   * @param time 时间
   * @returns 轨迹点坐标
   */
  calculateTrajectoryPoint(
    startX: number,
    startY: number,
    vx: number,
    vy: number,
    gravity: number,
    time: number
  ): { x: number; y: number } {
    return {
      x: startX + vx * time,
      y: startY + vy * time + 0.5 * gravity * time * time
    };
  }
  
  /**
   * 计算投掷所需的最小力量
   * @param distance 距离
   * @returns 最小力量（0-1）
   */
  calculateMinPowerForDistance(distance: number): number {
    const minDist = this.aimMinDist;
    const maxDist = this.aimMaxDist;
    
    if (distance <= minDist) return 0;
    if (distance >= maxDist) return 1;
    
    return (distance - minDist) / (maxDist - minDist);
  }
  
  /**
   * 检查是否在瞄准范围内
   * @param x X坐标
   * @param y Y坐标
   * @returns 是否在范围内
   */
  isInAimingRange(x: number, y: number): boolean {
    const startX = this.config.playerX;
    const startY = this.config.playerY - 322;
    
    const dx = x - startX;
    const dy = y - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance >= this.aimMinDist && distance <= this.aimMaxDist;
  }
}