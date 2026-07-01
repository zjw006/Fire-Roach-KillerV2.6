/**
 * @fileoverview 风扇系统模块
 * @description 负责管理游戏中风扇武器的逻辑，包括激活、减速效果、击退效果等
 */

import { RoachType, RoachState } from '../../types';
import type { FanState, Roach } from '../../types';

/**
 * 风扇系统配置接口
 */
export interface FanSystemConfig {
  /** 游戏画布宽度 */
  canvasWidth: number;
  /** 游戏画布高度 */
  canvasHeight: number;
  /** 时间增量（秒） */
  deltaTime: number;
  /** 防御线Y坐标 */
  defenseLineY: () => number;
  /** 天赋倍数：风扇持续时间 */
  talentMultipliers?: {
    fanDuration?: number;
    fanSlow?: number;
  };
  /** 播放音效回调 */
  onPlaySound?: (soundId: string) => void;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 开始风扇循环音效回调 */
  onStartFanLoop?: () => void;
  /** 停止风扇循环音效回调 */
  onStopFanLoop?: () => void;
  /** 触发屏幕震动回调 */
  onVibrate?: () => void;
}

/**
 * 风扇系统类
 * @description 管理风扇武器的激活、计时和效果应用
 */
export class FanSystem {
  /** 风扇状态 */
  private fanState: FanState;
  /** 系统配置 */
  private config: FanSystemConfig;

  /**
   * 构造函数
   * @param config 风扇系统配置
   */
  constructor(config: FanSystemConfig) {
    this.config = config;
    this.fanState = {
      active: false,
      timer: 0,
      duration: 8,
      slowFactor: 0.5,
      bladeAngle: 0,
      bladeSpeed: 15,
    };
  }

  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<FanSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前风扇状态
   * @returns 风扇状态
   */
  getState(): FanState {
    return { ...this.fanState };
  }

  /**
   * 激活风扇（减速并击退蟑螂）
   * @returns 是否成功激活
   */
  activateFan(): boolean {
    if (this.fanState.active) {
      // 如果已经激活，重置计时器
      const fanDurationMult = this.config.talentMultipliers?.fanDuration || 1;
      this.fanState.timer = this.fanState.duration * fanDurationMult;
      return true;
    }

    this.fanState.active = true;
    // 应用机械精通天赋：风扇持续时间提升
    const fanDurationMult = this.config.talentMultipliers?.fanDuration || 1;
    this.fanState.timer = this.fanState.duration * fanDurationMult;
    this.fanState.bladeAngle = 0;

    // 播放风扇循环音效
    if (this.config.onStartFanLoop) {
      this.config.onStartFanLoop();
    }

    const durationText = fanDurationMult > 1
      ? `蟑螂被吹退${(8 * fanDurationMult).toFixed(1)}秒!(+天赋)`
      : '蟑螂被吹退8秒!';

    // 添加浮动文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight * 0.3,
        '强力风扇启动!',
        '#a78bfa'
      );
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight * 0.3 + 20,
        durationText,
        '#c4b5fd'
      );
    }

    // 触发屏幕震动
    if (this.config.onVibrate) {
      this.config.onVibrate();
    }

    return true;
  }

  /**
   * 根据蟑螂类型获取风扇效果参数
   * @param type 蟑螂类型
   * @returns [减速因子, 击退速度] - 值越高效果越强
   */
  getFanEffectByType(type: RoachType): [number, number] {
    switch (type) {
      // 飞行蟑螂：受影响最大（重量轻，翅膀表面积大）
      case RoachType.FLYING: return [0.70, 120];
      // 飞行自爆蟑螂：同样受影响较大（飞行）
      case RoachType.FLYING_SUICIDE: return [0.65, 100];
      // 小型蟑螂：受影响严重（轻，易吹动）
      case RoachType.SMALL: return [0.60, 80];
      // 大型蟑螂：中等受影响
      case RoachType.LARGE: return [0.40, 50];
      // 分裂蟑螂：与大型相同
      case RoachType.SPLITTING: return [0.40, 50];
      // 自爆蟑螂：一定程度受影响（携带炸弹）
      case RoachType.SUICIDE: return [0.30, 35];
      // 装甲蟑螂：轻微受影响（重壳）
      case RoachType.ARMORED: return [0.20, 25];
      // 女王：几乎不受影响（非常重）
      case RoachType.QUEEN: return [0.10, 15];
      default: return [0.40, 50];
    }
  }

  /**
   * 应用风扇效果到单个蟑螂
   * @param roach 蟑螂对象
   */
  applyFanEffect(roach: Roach): void {
    const [slowFactor] = this.getFanEffectByType(roach.type);
    
    // 应用机械精通天赋：风扇减速提升
    const fanSlowMult = this.config.talentMultipliers?.fanSlow || 1;
    roach.fanSlowFactor = slowFactor * fanSlowMult;
    
    // 应用机械精通天赋：风扇持续时间提升
    const fanDurationMult = this.config.talentMultipliers?.fanDuration || 1;
    roach.fanSlowTimer = this.fanState.duration * fanDurationMult;
    roach.fanPushY = 0; // 重置击退累积
  }

  /**
   * 更新风扇系统
   * @param roaches 蟑螂数组
   * @returns 更新后的风扇状态
   */
  updateFan(roaches: Roach[]): FanState {
    const fan = this.fanState;
    if (!fan.active) return fan;

    // 更新计时器
    fan.timer -= this.config.deltaTime;
    fan.bladeAngle += fan.bladeSpeed * this.config.deltaTime;

    const fanTopY = this.config.canvasHeight / 2; // 风扇效果范围：防御线到屏幕中心

    // 对风扇激活期间新生成的蟑螂应用风扇效果
    // 只影响在风扇范围内的蟑螂（防御线到屏幕中心），BOSS除外
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      if (r.fanSlowTimer <= 0 && fan.timer > 0 && r.y >= fanTopY && r.y <= this.config.defenseLineY()) {
        this.applyFanEffect(r);
      }
    }

    // 将所有受影响的蟑螂向上推（向后）
    // 只在蟑螂在风扇范围内时推动，BOSS除外
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      if (r.fanSlowTimer > 0 && r.y >= fanTopY) {
        const [, pushSpeed] = this.getFanEffectByType(r.type);
        // 累积向上推力（负Y = 向屏幕顶部）
        const pushAmount = pushSpeed * this.config.deltaTime;
        r.fanPushY -= pushAmount;
      }
    }

    // 检查风扇是否结束
    if (fan.timer <= 0) {
      fan.active = false;
      fan.timer = 0;
      
      // 停止风扇循环音效
      if (this.config.onStopFanLoop) {
        this.config.onStopFanLoop();
      }
      
      // 添加停止提示
      if (this.config.onAddFloatingText) {
        this.config.onAddFloatingText(
          this.config.canvasWidth / 2,
          this.config.canvasHeight * 0.3,
          '风扇停止',
          '#9ca3af'
        );
      }
      
      // 清除所有蟑螂的风扇效果
      for (const r of roaches) {
        r.fanSlowTimer = 0;
        r.fanSlowFactor = 0;
        r.fanPushY = 0;
      }
    }

    return fan;
  }

  /**
   * 重置风扇系统
   */
  reset(): void {
    this.fanState = {
      active: false,
      timer: 0,
      duration: 8,
      slowFactor: 0.5,
      bladeAngle: 0,
      bladeSpeed: 15,
    };
  }


  /**
   * 检查风扇是否激活
   * @returns 风扇是否激活
   */
  isActive(): boolean {
    return this.fanState.active;
  }

  /**
   * 获取剩余时间
   * @returns 剩余时间（秒）
   */
  getRemainingTime(): number {
    return Math.max(0, this.fanState.timer);
  }

  /**
   * 获取风扇叶片角度（用于渲染）
   * @returns 叶片角度（弧度）
   */
  getBladeAngle(): number {
    return this.fanState.bladeAngle;
  }
}
