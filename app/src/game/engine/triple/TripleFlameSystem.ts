/**
 * @fileoverview 三重火焰系统模块
 * @description 负责管理三重火焰喷射器的激活、计时、倒计时警告和过期清理
 */

import type { TripleFlameState } from '../../types';
import { TEXT_CONFIG, FLOAT_COLOR, BALANCE_CONFIG } from '../../data';

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
    const tfCfg = BALANCE_CONFIG.tripleFlame;
    this.tripleFlame = {
      active: false,
      timer: 0,
      duration: tfCfg.duration,
      sideOffset: tfCfg.sideOffset,
      sideDamageMult: tfCfg.sideDamageMult,
    };
  }

  updateConfig(config: Partial<TripleFlameSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取三重火焰状态（返回副本，防止外部修改内部状态） */
  getState(): TripleFlameState {
    return { ...this.tripleFlame };
  }

  isActive(): boolean {
    return this.tripleFlame.active;
  }

  // ========== 激活 ==========
  activateTripleFlame(): void {
    if (this.tripleFlame.active) {
      // 重复激活：刷新计时器并给出反馈
      this.tripleFlame.timer = this.tripleFlame.duration;
      this.config.onAddFloatingText?.(
        this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 60,
        TEXT_CONFIG.combat.tripleFlameRefresh, FLOAT_COLOR.gold
      );
      return;
    }
    this.tripleFlame.active = true;
    this.tripleFlame.timer = this.tripleFlame.duration;
    this.config.onPlayShotgunActivate?.();
    this.config.onVibrateItemUse?.();
    this.config.onAddFloatingText?.(
      this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 60,
      TEXT_CONFIG.combat.tripleFlameActivate, FLOAT_COLOR.gold
    );
  }

  // ========== 更新 ==========
  updateTripleFlame(deltaTime: number): void {
    if (!this.tripleFlame.active) return;

    const tfCfg = BALANCE_CONFIG.tripleFlame;
    const prevTimer = this.tripleFlame.timer;
    this.tripleFlame.timer -= deltaTime;

    // 警告阈值（使用配置值，不再硬编码5）
    if (prevTimer > tfCfg.warningThreshold && this.tripleFlame.timer <= tfCfg.warningThreshold) {
      this.config.onAddFloatingText?.(
        this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 80,
        TEXT_CONFIG.combat.tripleFlameWarning, FLOAT_COLOR.danger
      );
    }

    // 倒计时：逐秒整数边界检测，防止大deltaTime跳过
    if (this.tripleFlame.timer > 0) {
      const prevFloor = Math.ceil(prevTimer);  // 上一帧的整数秒上界
      const currFloor = Math.ceil(this.tripleFlame.timer);  // 当前帧的整数秒上界
      // 跨越了整数秒边界才触发
      if (prevFloor > currFloor) {
        for (let sec = prevFloor - 1; sec >= Math.max(currFloor, 1); sec--) {
          this.config.onAddFloatingText?.(
            this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 50,
            `${sec}...`, sec === 1 ? FLOAT_COLOR.danger : FLOAT_COLOR.warning
          );
        }
      }
    }

    if (this.tripleFlame.timer <= 0) {
      this.tripleFlame.active = false;
      this.tripleFlame.timer = 0;
      this.config.onAddFloatingText?.(
        this.config.canvasWidth / 2, this.config.canvasHeight / 2 - 50,
        TEXT_CONFIG.combat.tripleFlameEnd, FLOAT_COLOR.expired
      );
    }
  }

  reset(): void {
    const tfCfg = BALANCE_CONFIG.tripleFlame;
    this.tripleFlame = {
      active: false,
      timer: 0,
      duration: tfCfg.duration,
      sideOffset: tfCfg.sideOffset,
      sideDamageMult: tfCfg.sideDamageMult,
    };
  }
}