/**
 * @fileoverview 浮动文字系统模块
 * @description 负责管理游戏中的浮动文字特效（伤害数字、金钱提示、倒计时等 HUD 漂浮文字）
 * 
 * 职责：
 * - 持有浮动文字数组并管理其生命周期
 * - 提供统一的添加接口（支持自定义颜色、持续时间、字体大小）
 * - 提供渲染接口（委托给 ParticleSystem 静态方法）
 * - 与 ParticleSystem 配合：ParticleSystem 负责每帧更新（life 递减、Y 位移、移除死亡元素）
 */

import { ParticleSystem } from '../particle/ParticleSystem';
import type { FloatingText } from '../../types';

/**
 * 浮动文字系统配置接口
 */
export interface FloatingTextSystemConfig {
  /** 最大浮动文字数量（默认 20） */
  maxCount?: number;
}

/**
 * 浮动文字系统类
 * @description 管理游戏中所有漂浮文字的生命周期
 */
export class FloatingTextSystem {
  /** 浮动文字数组 */
  private floatingTexts: FloatingText[] = [];
  
  /** 系统配置 */
  private config: FloatingTextSystemConfig;

  constructor(config: FloatingTextSystemConfig = {}) {
    this.config = { maxCount: 20, ...config };
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
   * @param durationMs 持续时间（毫秒，默认 1000ms）
   * @param fontSize 字体大小（默认 16px）
   */
  addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    durationMs?: number,
    fontSize?: number
  ): void {
    const maxCount = this.config.maxCount ?? 20;
    // 限制最大数量 — 从尾部截断（比 splice 从头部删除快得多）
    if (this.floatingTexts.length > maxCount) {
      this.floatingTexts.length = maxCount;
    }
    const maxLife = durationMs ? durationMs / 1000 : 1.0;
    const scale = fontSize ? fontSize / 16 : 1.0;
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: maxLife,
      maxLife,
      vy: -35,
      scale,
    });
  }

  /**
   * 获取浮动文字数组引用
   * @description 供 ParticleSystem 原地更新（life 递减、Y 位移、移除死亡元素）
   * @returns 浮动文字数组
   */
  getFloatingTexts(): FloatingText[] {
    return this.floatingTexts;
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