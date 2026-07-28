/**
 * @fileoverview 浮动文字系统模块
 * @description 负责管理游戏中的浮动文字特效（伤害数字、金钱提示、倒计时等 HUD 漂浮文字）
 * 
 * 职责：
 * - 持有浮动文字数组并管理其生命周期
 * - 提供统一的添加接口（支持自定义颜色、持续时间、字体大小、上升速度）
 * - 提供每帧更新接口（life 递减、Y 位移、移除死亡元素）
 * - 提供渲染接口（委托给 ParticleSystem 静态方法）
 */

import { ParticleSystem } from '../particle/ParticleSystem';
import { BALANCE_CONFIG } from '../../data';
import type { FloatingText } from '../../types';

/**
 * 浮动文字系统配置接口
 */
export interface FloatingTextSystemConfig {
  /** 最大浮动文字数量 */
  maxCount?: number;
  /** 默认持续时间（毫秒） */
  defaultDurationMs?: number;
  /** 默认字体大小 */
  defaultFontSize?: number;
  /** 默认上升速度（像素/秒，负值=向上） */
  defaultRiseSpeed?: number;
}

/** 浮动文字系统默认配置 */
const DEFAULT_CONFIG: Required<FloatingTextSystemConfig> = {
  maxCount: BALANCE_CONFIG.floatingText.maxCount,
  defaultDurationMs: BALANCE_CONFIG.floatingText.defaultDurationMs,
  defaultFontSize: BALANCE_CONFIG.floatingText.defaultFontSize,
  defaultRiseSpeed: BALANCE_CONFIG.floatingText.defaultRiseSpeed,
};

/**
 * 浮动文字系统类
 * @description 管理游戏中所有漂浮文字的生命周期（添加、更新、渲染）
 */
export class FloatingTextSystem {
  /** 浮动文字数组（内部持有，不直接暴露给外部修改） */
  private floatingTexts: FloatingText[] = [];
  
  /** 系统配置 */
  private config: Required<FloatingTextSystemConfig>;

  constructor(config: FloatingTextSystemConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 更新系统配置
   * @param config 部分配置
   */
  updateConfig(config: Partial<FloatingTextSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 添加浮动文字
   * @param x X 坐标
   * @param y Y 坐标
   * @param text 文字内容
   * @param color 文字颜色
   * @param durationMs 持续时间（毫秒，默认从配置读取）
   * @param fontSize 字体大小（默认从配置读取）
   * @param riseSpeed 上升速度（像素/秒，默认从配置读取）
   */
  addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    durationMs?: number,
    fontSize?: number,
    riseSpeed?: number
  ): void {
    const maxCount = this.config.maxCount;

    // 修复 P0：当达到上限时，移除最旧的浮动文字，为新文字腾出空间
    // 使用 >= 而非 >，确保不会超过 maxCount
    if (this.floatingTexts.length >= maxCount) {
      this.floatingTexts.shift();
    }

    const duration = durationMs ?? this.config.defaultDurationMs;
    const size = fontSize ?? this.config.defaultFontSize;
    const vy = riseSpeed ?? this.config.defaultRiseSpeed;

    // 修复 P2：使用配置中的毫秒转秒系数
    const maxLife = duration * BALANCE_CONFIG.floatingText.msToSeconds;
    const scale = size / BALANCE_CONFIG.floatingText.defaultFontSize;

    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: maxLife,
      maxLife,
      vy,
      scale,
    });
  }

  /**
   * 更新所有浮动文字（每帧调用）
   * @description 递减 life、移动 Y 坐标、移除已死亡的浮动文字
   * @param deltaTime 帧间隔时间（秒）
   */
  update(deltaTime: number): void {
    // 修复 P1：将更新逻辑从 ParticleSystem 移入本系统，避免内部数组暴露给外部修改
    let writeIndex = 0;
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const text = this.floatingTexts[i];
      text.life -= deltaTime;
      text.y += text.vy * deltaTime;

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
   * 渲染所有浮动文字
   * @description 委托给 ParticleSystem 的静态渲染方法
   * @param ctx Canvas 渲染上下文
   */
  render(ctx: CanvasRenderingContext2D): void {
    ParticleSystem.renderFloatingTexts(ctx, this.floatingTexts);
  }

  /**
   * 获取当前浮动文字数量
   */
  getCount(): number {
    return this.floatingTexts.length;
  }

  /**
   * 清空所有浮动文字
   */
  reset(): void {
    this.floatingTexts = [];
  }
}