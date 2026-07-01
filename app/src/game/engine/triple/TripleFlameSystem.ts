/**
 * @fileoverview 三重火焰系统模块
 * @description 负责管理游戏中三重火焰喷射器的逻辑，包括激活、计时、侧边火焰位置计算等
 */

import { type TripleFlameState } from '../../types';

/**
 * 三重火焰系统配置接口
 */
export interface TripleFlameSystemConfig {
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
  /** 震动反馈回调函数 */
  onVibrate?: () => void;
}

/**
 * 三重火焰系统类
 * @description 管理游戏中三重火焰喷射器的逻辑，包括激活、计时、侧边火焰位置计算等
 */
export class TripleFlameSystem {
  /** 系统配置 */
  private config: TripleFlameSystemConfig;
  
  /** 三重火焰状态 */
  private tripleFlame: TripleFlameState;
  
  /**
   * 构造函数
   * @param config 系统配置
   */
  constructor(config: TripleFlameSystemConfig) {
    this.config = config;
    
    // 初始化三重火焰状态
    this.tripleFlame = {
      active: false,
      timer: 0,
      duration: 10,
      sideOffset: 80,
      sideDamageMult: 0.7
    };
  }
  
  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<TripleFlameSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 激活三重火焰模式
   * @param duration 持续时间（秒）
   * @returns 是否成功激活
   */
  activateTripleFlame(duration: number = 10): boolean {
    if (this.tripleFlame.active) {
      // 如果已经激活，重置计时器
      this.tripleFlame.timer = duration;
      return true;
    }
    
    this.tripleFlame.active = true;
    this.tripleFlame.timer = duration;
    this.tripleFlame.duration = duration;
    
    // 播放激活音效
    if (this.config.onPlaySound) {
      this.config.onPlaySound('shotgun_activate');
    }
    
    // 震动反馈
    if (this.config.onVibrate) {
      this.config.onVibrate();
    }
    
    // 添加浮动文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 2 - 60,
        '三喷火枪模式! 持续10秒',
        '#fbbf24'
      );
    }
    
    return true;
  }
  
  /**
   * 更新三重火焰逻辑
   * @returns 更新后的三重火焰状态
   */
  updateTripleFlame(): TripleFlameState {
    if (!this.tripleFlame.active) {
      return { ...this.tripleFlame };
    }
    
    const prevTimer = this.tripleFlame.timer;
    this.tripleFlame.timer -= this.config.deltaTime;
    
    // 5秒警告
    if (prevTimer > 5 && this.tripleFlame.timer <= 5) {
      if (this.config.onAddFloatingText) {
        this.config.onAddFloatingText(
          this.config.canvasWidth / 2,
          this.config.canvasHeight / 2 - 80,
          '⚠ 三喷火枪即将消失! 5秒 ⚠',
          '#ef4444'
        );
      }
    }
    
    // 3、2、1秒倒计时
    for (const sec of [3, 2, 1]) {
      if (prevTimer > sec && this.tripleFlame.timer <= sec) {
        if (this.config.onAddFloatingText) {
          const color = sec <= 2 ? '#f87171' : '#fbbf24';
          this.config.onAddFloatingText(
            this.config.canvasWidth / 2,
            this.config.canvasHeight / 2 - 50,
            `${sec}...`,
            color
          );
        }
      }
    }
    
    // 检查是否结束
    if (this.tripleFlame.timer <= 0) {
      this.tripleFlame.active = false;
      this.tripleFlame.timer = 0;
      
      if (this.config.onAddFloatingText) {
        this.config.onAddFloatingText(
          this.config.canvasWidth / 2,
          this.config.canvasHeight / 2 - 50,
          '三喷火枪模式结束',
          '#9ca3af'
        );
      }
    }
    
    // 更新侧边火焰位置
    this.updateSideFlamePositions();
    
    return { ...this.tripleFlame };
  }
  
  /**
   * 更新侧边火焰位置
   */
  private updateSideFlamePositions(): void {
    // 这个方法在原始引擎中可能用于计算侧边火焰的渲染位置
    // 但在TripleFlameState接口中，只有sideOffset属性
    // 实际侧边火焰位置可能在渲染时动态计算
  }
  
  /**
   * 获取三重火焰状态
   * @returns 三重火焰状态
   */
  getTripleFlameState(): TripleFlameState {
    return { ...this.tripleFlame };
  }
  
  /**
   * 设置三重火焰状态
   * @param state 新的状态
   */
  setTripleFlameState(state: Partial<TripleFlameState>): void {
    this.tripleFlame = { ...this.tripleFlame, ...state };
  }
  
  /**
   * 检查三重火焰是否激活
   * @returns 是否激活
   */
  isActive(): boolean {
    return this.tripleFlame.active;
  }
  
  /**
   * 获取剩余时间
   * @returns 剩余时间（秒）
   */
  getRemainingTime(): number {
    return Math.max(0, this.tripleFlame.timer);
  }
  
  /**
   * 获取侧边火焰位置
   * @returns 侧边火焰位置
   */
  getSideFlamePositions(): {
    left: { x: number; y: number };
    right: { x: number; y: number };
  } {
    const { playerX, playerY } = this.config;
    const sideOffset = this.tripleFlame.sideOffset;
    const sideOffsetY = -322; // 与主火焰相同的Y偏移
    
    return {
      left: {
        x: playerX - sideOffset,
        y: playerY + sideOffsetY
      },
      right: {
        x: playerX + sideOffset,
        y: playerY + sideOffsetY
      }
    };
  }
  
  /**
   * 计算三重火焰的伤害倍率
   * @returns 伤害倍率
   */
  getDamageMultiplier(): number {
    // 三重火焰模式下，总伤害是单火焰的3倍
    return 3.0;
  }
  
  /**
   * 计算三重火焰的覆盖范围
   * @returns 覆盖范围角度（弧度）
   */
  getCoverageAngle(): number {
    // 三重火焰覆盖约120度范围
    return (Math.PI * 2) / 3; // 120度
  }
  
  /**
   * 检查是否在倒计时警告阶段
   * @returns 是否在警告阶段
   */
  isInWarningPhase(): boolean {
    return this.tripleFlame.active && this.tripleFlame.timer <= 5;
  }
  
  /**
   * 获取倒计时阶段
   * @returns 倒计时阶段（秒）
   */
  getCountdownPhase(): number {
    if (!this.tripleFlame.active) return 0;
    
    const remaining = this.tripleFlame.timer;
    
    if (remaining <= 1) return 1;
    if (remaining <= 2) return 2;
    if (remaining <= 3) return 3;
    
    return 0; // 不在倒计时阶段
  }
  
  /**
   * 获取三重火焰的视觉强度
   * @returns 视觉强度（0-1）
   */
  getVisualIntensity(): number {
    if (!this.tripleFlame.active) return 0;
    
    // 随时间衰减，最后3秒强度降低
    const remaining = this.tripleFlame.timer;
    
    if (remaining <= 3) {
      // 最后3秒线性衰减
      return remaining / 3;
    }
    
    return 1.0;
  }
}