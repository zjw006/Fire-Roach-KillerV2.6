/**
 * @fileoverview 三重火焰系统模块
 * @description 负责管理三重火焰喷射器的激活、计时、倒计时警告和过期清理
 */

import type { TripleFlameState } from '../../types';
import { TEXT_CONFIG } from '../../data';

/**
 * 三重火焰系统配置接口
 */
export interface TripleFlameSystemConfig {
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 播放激活音效回调 */
  onPlayShotgunActivate?: () => void;
  /** 震动回调 */
  onVibrateItemUse?: () => void;
}

/**
 * 三重火焰系统类
 */
export class TripleFlameSystem {
  private config: TripleFlameSystemConfig;
  private tripleFlame: TripleFlameState;

  constructor(config: TripleFlameSystemConfig) {
    this.config = config;
    this.tripleFlame = {
      active: false,
      timer: 0,
      duration: 15,
      sideOffset: 100,
      sideDamageMult: 0.8,
    };
  }

  updateConfig(config: Partial<TripleFlameSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取三重火焰状态（用于碰撞检测和渲染） */
  getState(): TripleFlameState {
    return this.tripleFlame;
  }

  isActive(): boolean {
    return this.tripleFlame.active;
  }

  // ========== 激活 ==========
  activateTripleFlame(): void {
    if (this.tripleFlame.active) {
      this.tripleFlame.timer = this.tripleFlame.duration;
      return;
    }
    this.tripleFlame.active = true;
    this.tripleFlame.timer = this.tripleFlame.duration;
    this.config.onPlayShotgunActivate?.();
    this.config.onVibrateItemUse?.();
    this.config.onAddFloatingText?.(
      this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 60,
      TEXT_CONFIG.combat.tripleFlameActivate, '#fbbf24'
    );
  }

  // ========== 更新 ==========
  updateTripleFlame(deltaTime: number): void {
    if (!this.tripleFlame.active) return;
    const prevTimer = this.tripleFlame.timer;
    this.tripleFlame.timer -= deltaTime;

    // 5秒警告
    if (prevTimer > 5 && this.tripleFlame.timer <= 5) {
      this.config.onAddFloatingText?.(
        this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 80,
        TEXT_CONFIG.combat.tripleFlameWarning, '#ef4444'
      );
    }

    // 3、2、1秒倒计时
    for (const sec of [3, 2, 1]) {
      if (prevTimer > sec && this.tripleFlame.timer <= sec) {
        this.config.onAddFloatingText?.(
          this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 50,
          `${sec}...`, sec <= 2 ? '#f87171' : '#fbbf24'
        );
      }
    }

    if (this.tripleFlame.timer <= 0) {
      this.tripleFlame.active = false;
      this.tripleFlame.timer = 0;
      this.config.onAddFloatingText?.(
        this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 50,
        TEXT_CONFIG.combat.tripleFlameEnd, '#9ca3af'
      );
    }
  }

  reset(): void {
    this.tripleFlame = {
      active: false,
      timer: 0,
      duration: 15,
      sideOffset: 100,
      sideDamageMult: 0.8,
    };
  }
}