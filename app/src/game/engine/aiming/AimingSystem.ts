/**
 * @fileoverview 瞄准系统模块
 * @description 负责管理游戏中投掷武器的瞄准逻辑，包括蓄力计算、抛物线轨迹、投掷执行等
 */

import { type ThrowableProjectile } from '../../types';

/**
 * 瞄准系统配置接口
 */
export interface AimingSystemConfig {
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 播放音效回调 */
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
  private aimWeapon: 'sticky' | 'poison' | 'molotov' | null = null;

  /** 瞄准力量（0-1） */
  private aimPower: number = 0;

  /** 瞄准目标X坐标 */
  private aimTargetX: number = 0;

  /** 瞄准目标Y坐标 */
  private aimTargetY: number = 0;

  /** 瞄准开始时间 */
  private aimStartTime: number = 0;

  /** 最大蓄力时间（秒） */
  private aimMaxPowerTime: number = 1.5;

  /** 最小瞄准距离 */
  private aimMinDist: number = 80;

  /** 最大瞄准距离 */
  private aimMaxDist: number = 500;

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

  // ========== 瞄准控制 ==========

  /**
   * 开始瞄准
   * @param weapon 武器类型
   * @param gameTime 当前游戏时间
   * @param playerX 玩家X坐标
   * @param playerY 玩家Y坐标
   */
  startAiming(
    weapon: 'sticky' | 'poison' | 'molotov',
    gameTime: number,
    playerX: number,
    playerY: number
  ): void {
    if (this.isAiming) return;
    this.isAiming = true;
    this.aimWeapon = weapon;
    this.aimPower = 0;
    this.aimStartTime = gameTime;
    // 初始目标：正上方最小距离
    this.aimTargetX = playerX;
    this.aimTargetY = playerY - 322 - this.aimMinDist;
  }

  /**
   * 更新瞄准逻辑
   * @param gameTime 当前游戏时间
   * @param canvasWidth 画布宽度
   * @param defenseLineY 防线Y坐标
   * @param playerY 玩家Y坐标
   */
  updateAiming(
    gameTime: number,
    canvasWidth: number,
    defenseLineY: number,
    playerY: number
  ): void {
    if (!this.isAiming) return;
    // 力量随按住时间增加（0到1）
    const holdDuration = gameTime - this.aimStartTime;
    this.aimPower = Math.min(1, holdDuration / this.aimMaxPowerTime);
    // Y距离：基于力量从最小到最大
    const dist = this.aimMinDist + (this.aimMaxDist - this.aimMinDist) * this.aimPower;
    // 限制目标位置
    this.aimTargetX = Math.max(40, Math.min(canvasWidth - 40, this.aimTargetX));
    this.aimTargetY = Math.max(60, Math.min(defenseLineY - 20, playerY - 322 - dist));
  }

  /**
   * 调整瞄准
   * @param dx X方向调整量（屏幕像素）
   * @param canvasWidth 画布宽度
   */
  adjustAim(dx: number, canvasWidth: number): void {
    if (!this.isAiming) return;
    // dx来自输入是屏幕像素，转换为游戏坐标
    this.aimTargetX += dx * 1.5;
    this.aimTargetX = Math.max(40, Math.min(canvasWidth - 40, this.aimTargetX));
  }

  /**
   * 投掷瞄准的武器
   * @param playerIsTempWeapon 玩家是否使用临时武器
   * @param playerWeaponAmmo 玩家武器弹药
   * @param playerX 玩家X坐标
   * @param playerY 玩家Y坐标
   * @returns 生成的投掷物和更新后的弹药
   */
  throwAimedWeapon(
    playerIsTempWeapon: boolean,
    playerWeaponAmmo: Record<string, number>,
    playerX: number,
    playerY: number
  ): {
    throwable: ThrowableProjectile | null;
    updatedAmmo: Record<string, number>;
  } {
    if (!this.isAiming || !this.aimWeapon) {
      return { throwable: null, updatedAmmo: playerWeaponAmmo };
    }

    const weapon = this.aimWeapon;
    const startX = playerX;
    const startY = playerY - 322;
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

    const throwable: ThrowableProjectile = {
      id: 0, // 由引擎分配
      x: startX,
      y: startY,
      vx,
      vy,
      type: weapon,
      life: travelTime * 2,
      maxLife: travelTime * 2,
      gravity,
      hasLanded: false,
      targetX,
      targetY,
    };

    // 如果使用临时武器，扣除弹药
    const updatedAmmo = { ...playerWeaponAmmo };
    if (playerIsTempWeapon && weapon in updatedAmmo) {
      updatedAmmo[weapon] = Math.max(0, updatedAmmo[weapon] - 1);
    }

    // 播放燃烧瓶投掷音效
    if (weapon === 'molotov') {
      this.config.onPlaySound?.('molotov_throw');
    }

    // 浮动文字
    const names: Record<string, string> = {
      sticky: '蟑螂贴板',
      poison: '杀虫剂',
      molotov: '燃烧瓶',
    };
    this.config.onAddFloatingText?.(startX, startY - 30, `投掷${names[weapon]}!`, '#fbbf24');

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

  // ========== 状态查询 ==========

  /**
   * 获取当前瞄准状态
   * @returns 瞄准状态
   */
  getAimingState(): {
    isAiming: boolean;
    aimWeapon: 'sticky' | 'poison' | 'molotov' | null;
    aimPower: number;
    aimTargetX: number;
    aimTargetY: number;
  } {
    return {
      isAiming: this.isAiming,
      aimWeapon: this.aimWeapon,
      aimPower: this.aimPower,
      aimTargetX: this.aimTargetX,
      aimTargetY: this.aimTargetY,
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
   * 检查是否在瞄准范围内
   * @param x X坐标
   * @param y Y坐标
   * @param playerX 玩家X坐标
   * @param playerY 玩家Y坐标
   * @returns 是否在范围内
   */
  isInAimingRange(x: number, y: number, playerX: number, playerY: number): boolean {
    const startX = playerX;
    const startY = playerY - 322;
    const dx = x - startX;
    const dy = y - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance >= this.aimMinDist && distance <= this.aimMaxDist;
  }

  // ========== 静态渲染 ==========

  /**
   * 渲染瞄准线（虚线抛物线 + 目标圆圈 + 十字准星）
   * @param ctx Canvas渲染上下文
   * @param state 瞄准状态
   * @param playerX 玩家X坐标
   * @param playerY 玩家Y坐标
   * @param gameTime 当前游戏时间（用于脉冲动画）
   */
  static renderThrowableAim(
    ctx: CanvasRenderingContext2D,
    state: {
      isAiming: boolean;
      aimWeapon: 'sticky' | 'poison' | 'molotov' | null;
      aimPower: number;
      aimTargetX: number;
      aimTargetY: number;
    },
    playerX: number,
    playerY: number,
    gameTime: number
  ): void {
    if (!state.isAiming || !state.aimWeapon) return;

    const startX = playerX;
    const startY = playerY - 322;
    const targetX = state.aimTargetX;
    const targetY = state.aimTargetY;

    // 计算弧线控制点
    const midX = (startX + targetX) / 2;
    const arcHeight = 100 + state.aimPower * 150;
    const controlX = midX;
    const controlY = Math.min(startY, targetY) - arcHeight;

    // 绘制抛物线轨迹线（虚线）
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;

    const colors: Record<string, string> = {
      sticky: 'rgba(250, 200, 50, 0.6)',
      poison: 'rgba(180, 130, 255, 0.6)',
      molotov: 'rgba(255, 100, 80, 0.6)',
    };
    ctx.strokeStyle = colors[state.aimWeapon];

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    // 绘制二次贝塞尔曲线
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * targetX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * targetY;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 绘制目标圆圈（脉冲）
    const pulse = (Math.sin(gameTime * 8) + 1) * 0.5;
    const targetRadius = 30 + state.aimPower * 20;

    const targetColors: Record<string, string> = {
      sticky: 'rgba(250, 200, 50, ',
      poison: 'rgba(180, 130, 255, ',
      molotov: 'rgba(255, 100, 80, ',
    };
    const tc = targetColors[state.aimWeapon];

    ctx.fillStyle = `${tc}${0.15 + pulse * 0.1})`;
    ctx.beginPath();
    ctx.arc(targetX, targetY, targetRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${tc}${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, targetRadius * (0.7 + pulse * 0.3), 0, Math.PI * 2);
    ctx.stroke();

    // 十字准星
    ctx.strokeStyle = `${tc}0.8)`;
    ctx.lineWidth = 1.5;
    const crossSize = 8;
    ctx.beginPath();
    ctx.moveTo(targetX - crossSize, targetY);
    ctx.lineTo(targetX + crossSize, targetY);
    ctx.moveTo(targetX, targetY - crossSize);
    ctx.lineTo(targetX, targetY + crossSize);
    ctx.stroke();

    // 力度指示文字
    const powerPercent = Math.round(state.aimPower * 100);
    ctx.fillStyle = `${tc}0.9)`;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`力度 ${powerPercent}%`, targetX, targetY - targetRadius - 10);

    // 武器名称
    const names: Record<string, string> = {
      sticky: '蟑螂贴板',
      poison: '杀虫剂',
      molotov: '燃烧瓶',
    };
    ctx.fillStyle = '#fff';
    ctx.fillText(names[state.aimWeapon], startX, startY - 40);

    ctx.restore();
  }

  // ========== 重置 ==========

  /**
   * 重置瞄准系统
   */
  reset(): void {
    this.isAiming = false;
    this.aimWeapon = null;
    this.aimPower = 0;
    this.aimTargetX = 0;
    this.aimTargetY = 0;
    this.aimStartTime = 0;
  }
}