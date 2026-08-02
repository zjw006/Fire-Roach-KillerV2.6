/**
 * @fileoverview 瞄准系统模块
 * @description 负责管理游戏中投掷武器的瞄准逻辑，包括蓄力计算、抛物线轨迹、投掷执行等
 */

import { type ThrowableProjectile } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

// =============================================================================
// 类型定义
// =============================================================================

/** 投掷武器类型（单一数据源，新增武器只需扩展此类型和 THROW_WEAPON_META） */
type ThrowWeapon = 'sticky' | 'poison' | 'molotov';

/** 投掷武器元数据：名称、颜色、音效等（逻辑与渲染共用，消除重复定义） */
interface ThrowWeaponMeta {
  /** 武器显示名称（修复问题 P2：消除 TEXT_CONFIG.items[weapon] 类型不安全） */
  name: string;
  /** 轨迹线颜色 */
  trajectoryColor: string;
  /** 目标圆圈颜色前缀（拼接透明度） */
  targetColorPrefix: string;
  /** 投掷音效名称 */
  sound: string;
}

// =============================================================================
// 武器元数据（单一数据源）
// =============================================================================

const THROW_WEAPON_META: Record<ThrowWeapon, ThrowWeaponMeta> = {
  sticky: {
    name: '蟑螂贴板',
    trajectoryColor: 'rgba(250, 200, 50, 0.6)',
    targetColorPrefix: 'rgba(250, 200, 50, ',
    sound: 'sticky_throw',
  },
  poison: {
    name: '杀虫剂',
    trajectoryColor: 'rgba(180, 130, 255, 0.6)',
    targetColorPrefix: 'rgba(180, 130, 255, ',
    sound: 'poison_throw',
  },
  molotov: {
    name: '燃烧瓶',
    trajectoryColor: 'rgba(255, 100, 80, 0.6)',
    targetColorPrefix: 'rgba(255, 100, 80, ',
    sound: 'molotov_throw',
  },
};

// =============================================================================
// 模块级兜底计数器（修复问题 P1：替代静态字段，避免多实例冲突）
// =============================================================================

let _fallbackIdCounter = 100000;

// =============================================================================
// 配置接口
// =============================================================================

/**
 * 瞄准系统配置接口
 */
export interface AimingSystemConfig {
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 播放音效回调 */
  onPlaySound?: (soundName: string) => void;
  /** 获取下一个投掷物 ID */
  getNextThrowableId?: () => number;
  /** 获取画布宽度 */
  getCanvasWidth?: () => number;
  /** 获取防线 Y 坐标 */
  getDefenseLineY?: () => number;
}

// =============================================================================
// 瞄准系统
// =============================================================================

export class AimingSystem {
  /** 系统配置 */
  private config: AimingSystemConfig;

  /** 是否正在瞄准 */
  private isAiming: boolean = false;

  /** 瞄准的武器类型 */
  private aimWeapon: ThrowWeapon | null = null;

  /** 瞄准力量（0-1） */
  private aimPower: number = 0;

  /** 瞄准目标 X 坐标 */
  private aimTargetX: number = 0;

  /** 瞄准目标 Y 坐标 */
  private aimTargetY: number = 0;

  /** 瞄准开始时间 */
  private aimStartTime: number = 0;

  constructor(config: AimingSystemConfig) {
    this.config = config;
  }

  /**
   * 更新系统配置
   */
  updateConfig(config: Partial<AimingSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========== 辅助方法 ==========

  /**
   * 获取投掷起点坐标（静态方法，逻辑和渲染共用）
   */
  static getThrowStartPoint(playerX: number, playerY: number): { x: number; y: number } {
    return {
      x: playerX,
      y: playerY - BALANCE_CONFIG.player.nozzleOffsetY,
    };
  }

  /**
   * 边界钳制（修复问题 P1：消除 4 处重复的边界检查代码）
   */
  private clampAimTarget(x: number, y: number, canvasWidth: number, defenseLineY: number): { x: number; y: number } {
    const cfg = BALANCE_CONFIG.aiming;
    const mx = cfg.borderMarginX;
    return {
      x: Math.max(mx, Math.min(canvasWidth - mx, x)),
      y: Math.max(cfg.borderMarginTop, Math.min(defenseLineY - cfg.borderMarginFromDefense, y)),
    };
  }

  /**
   * 获取画布宽度（回调优先，兜底用配置）
   */
  private getCanvasWidth(): number {
    return this.config.getCanvasWidth?.() ?? BALANCE_CONFIG.aiming.defaultCanvasWidth;
  }

  /**
   * 获取防线 Y 坐标（回调优先，兜底用配置）
   */
  private getDefenseLineY(): number {
    return this.config.getDefenseLineY?.() ?? BALANCE_CONFIG.aiming.defaultDefenseLineY;
  }

  // ========== 瞄准控制 ==========

  /**
   * 开始瞄准（修复问题 P1：弹药参数改为必传，防止漏检）
   * @param weapon 武器类型
   * @param gameTime 当前游戏时间
   * @param playerX 玩家 X 坐标
   * @param playerY 玩家 Y 坐标
   * @param playerWeaponAmmo 玩家武器弹药（必传）
   * @param playerIsTempWeapon 是否临时武器（必传）
   * @returns 是否成功开始瞄准
   */
  startAiming(
    weapon: ThrowWeapon,
    gameTime: number,
    playerX: number,
    playerY: number,
    playerWeaponAmmo: Record<string, number>,
    playerIsTempWeapon: boolean,
  ): boolean {
    if (this.isAiming) return false;

    // 弹药预检：无弹药时不开始瞄准
    if (playerIsTempWeapon) {
      const ammo = playerWeaponAmmo[weapon] ?? 0;
      if (ammo <= 0) return false;
    }

    this.isAiming = true;
    this.aimWeapon = weapon;
    this.aimPower = 0;
    this.aimStartTime = gameTime;
    const start = AimingSystem.getThrowStartPoint(playerX, playerY);
    this.aimTargetX = start.x;
    this.aimTargetY = start.y - BALANCE_CONFIG.aiming.minDist;
    return true;
  }

  /**
   * 更新瞄准逻辑（直接从 BALANCE_CONFIG 读取，支持热更新）
   */
  updateAiming(gameTime: number, canvasWidth: number, defenseLineY: number, playerY: number): void {
    if (!this.isAiming) return;
    const holdDuration = gameTime - this.aimStartTime;
    this.aimPower = Math.min(1, holdDuration / BALANCE_CONFIG.aiming.maxPowerTime);
    const dist = BALANCE_CONFIG.aiming.minDist + (BALANCE_CONFIG.aiming.maxDist - BALANCE_CONFIG.aiming.minDist) * this.aimPower;
    const clamped = this.clampAimTarget(this.aimTargetX, playerY - BALANCE_CONFIG.player.nozzleOffsetY - dist, canvasWidth, defenseLineY);
    this.aimTargetX = clamped.x;
    this.aimTargetY = clamped.y;
  }

  /**
   * 调整 X 轴瞄准
   */
  adjustAimX(dx: number, canvasWidth: number): void {
    if (!this.isAiming) return;
    const sensitivity = BALANCE_CONFIG.aiming.adjustSensitivity;
    this.aimTargetX += dx * sensitivity;
    const defenseLineY = this.getDefenseLineY();
    const clamped = this.clampAimTarget(this.aimTargetX, this.aimTargetY, canvasWidth, defenseLineY);
    this.aimTargetX = clamped.x;
    this.aimTargetY = clamped.y;
  }

  /**
   * 调整 Y 轴瞄准
   */
  adjustAimY(dy: number, defenseLineY: number): void {
    if (!this.isAiming) return;
    const sensitivity = BALANCE_CONFIG.aiming.adjustSensitivity;
    this.aimTargetY += dy * sensitivity;
    const canvasWidth = this.getCanvasWidth();
    const clamped = this.clampAimTarget(this.aimTargetX, this.aimTargetY, canvasWidth, defenseLineY);
    this.aimTargetX = clamped.x;
    this.aimTargetY = clamped.y;
  }

  /**
   * 投掷瞄准的武器
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
    const start = AimingSystem.getThrowStartPoint(playerX, playerY);
    const targetX = this.aimTargetX;
    const targetY = this.aimTargetY;

    // 弹药检查
    const updatedAmmo = { ...playerWeaponAmmo };
    if (playerIsTempWeapon) {
      const currentAmmo = updatedAmmo[weapon] ?? 0;
      if (currentAmmo <= 0) {
        this.cancelAiming();
        return { throwable: null, updatedAmmo };
      }
      updatedAmmo[weapon] = currentAmmo - 1;
    }

    // 计算抛物线速度
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    const travelTime = BALANCE_CONFIG.aiming.travelTimeBase + this.aimPower * BALANCE_CONFIG.aiming.travelTimePowerMult;
    const vx = dx / travelTime;
    const gravity = BALANCE_CONFIG.aiming.gravity;
    const vy = (dy - 0.5 * gravity * travelTime * travelTime) / travelTime;

    // 模块级兜底计数器（修复问题 P1：避免静态字段多实例冲突）
    const throwableId = this.config.getNextThrowableId?.() ?? ++_fallbackIdCounter;

    const throwable: ThrowableProjectile = {
      id: throwableId,
      x: start.x,
      y: start.y,
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

    // 播放投掷音效
    this.config.onPlaySound?.(THROW_WEAPON_META[weapon].sound);

    // 浮动文字（修复问题 P2：使用元数据 name，类型安全）
    this.config.onAddFloatingText?.(
      start.x, start.y - 30,
      TEXT_CONFIG.combat.throwWeapon.text(THROW_WEAPON_META[weapon].name),
      TEXT_CONFIG.combat.throwWeapon.color
    );

    this.cancelAiming();
    return { throwable, updatedAmmo };
  }

  /**
   * 取消瞄准
   */
  cancelAiming(): void {
    this.isAiming = false;
    this.aimWeapon = null;
    this.aimPower = 0;
    this.aimTargetX = 0;
    this.aimTargetY = 0;
  }

  // ========== 状态查询 ==========

  /**
   * 获取当前瞄准状态
   */
  getAimingState(): {
    isAiming: boolean;
    aimWeapon: ThrowWeapon | null;
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
   * 设置瞄准目标（修复问题 P2：回调兜底值从配置读取）
   */
  setAimTarget(targetX: number, targetY: number): void {
    const canvasWidth = this.getCanvasWidth();
    const defenseLineY = this.getDefenseLineY();
    const clamped = this.clampAimTarget(targetX, targetY, canvasWidth, defenseLineY);
    this.aimTargetX = clamped.x;
    this.aimTargetY = clamped.y;
  }

  /**
   * 检查是否在瞄准范围内（修复问题 P2：参数恢复为直觉设计，调用方传玩家位置即可）
   * @param targetX 目标 X 坐标
   * @param targetY 目标 Y 坐标
   * @param playerX 玩家 X 坐标
   * @param playerY 玩家 Y 坐标
   * @returns 是否在范围内
   */
  isInAimingRange(targetX: number, targetY: number, playerX: number, playerY: number): boolean {
    const start = AimingSystem.getThrowStartPoint(playerX, playerY);
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance >= BALANCE_CONFIG.aiming.minDist && distance <= BALANCE_CONFIG.aiming.maxDist;
  }

  // ========== 静态渲染 ==========

  /**
   * 渲染瞄准线（虚线抛物线 + 目标圆圈 + 十字准星）
   */
  static renderThrowableAim(
    ctx: CanvasRenderingContext2D,
    state: {
      isAiming: boolean;
      aimWeapon: ThrowWeapon | null;
      aimPower: number;
      aimTargetX: number;
      aimTargetY: number;
    },
    playerX: number,
    playerY: number,
    gameTime: number
  ): void {
    if (!state.isAiming || !state.aimWeapon) return;

    const start = AimingSystem.getThrowStartPoint(playerX, playerY);
    const startX = start.x;
    const startY = start.y;
    const targetX = state.aimTargetX;
    const targetY = state.aimTargetY;

    const meta = THROW_WEAPON_META[state.aimWeapon];

    // 弧线控制点
    const midX = (startX + targetX) / 2;
    const arcHeight = BALANCE_CONFIG.aiming.arcHeightBase + state.aimPower * BALANCE_CONFIG.aiming.arcHeightPowerMult;
    const controlX = midX;
    const controlY = Math.min(startY, targetY) - arcHeight;

    // 抛物线轨迹线（虚线）
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = meta.trajectoryColor;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    const steps = BALANCE_CONFIG.aiming.trajectorySteps;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * targetX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * targetY;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 目标圆圈（脉冲）
    const pulse = (Math.sin(gameTime * 8) + 1) * 0.5;
    const targetRadius = 30 + state.aimPower * 20;

    ctx.fillStyle = `${meta.targetColorPrefix}${0.15 + pulse * 0.1})`;
    ctx.beginPath();
    ctx.arc(targetX, targetY, targetRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${meta.targetColorPrefix}${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, targetRadius * (0.7 + pulse * 0.3), 0, Math.PI * 2);
    ctx.stroke();

    // 十字准星
    ctx.strokeStyle = `${meta.targetColorPrefix}0.8)`;
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
    ctx.fillStyle = `${meta.targetColorPrefix}0.9)`;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`力度 ${powerPercent}%`, targetX, targetY - targetRadius - 10);

    // 武器名称（修复问题 P2：使用元数据 name，类型安全）
    ctx.fillStyle = '#fff';
    ctx.fillText(THROW_WEAPON_META[state.aimWeapon].name, startX, startY - 40);

    ctx.restore();
  }

  // ========== 重置 ==========

  /**
   * 重置瞄准系统（修复问题 P2：调用 cancelAiming 消除重复代码）
   */
  reset(): void {
    this.cancelAiming();
    this.aimStartTime = 0;
  }
}