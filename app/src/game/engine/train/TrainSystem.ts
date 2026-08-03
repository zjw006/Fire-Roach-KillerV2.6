/**
 * @fileoverview 列车系统模块（地铁场景专属）
 * @description 管理列车的召唤（专属道具）与环境自动驶过事件。
 * 列车沿战场中部轨道横穿屏幕，碾压轨道带内的地面蟑螂，
 * 气流推退轨道带外的蟑螂，附带震屏、轰鸣音效与车厢灯光渲染。
 */

import { RoachState, RoachType, type Roach } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/** 列车道具类型标识 */
export const TRAIN_TYPE = 'train';

/** 列车阶段：待机 / 进站预警 / 驶过 */
type TrainPhase = 'idle' | 'warning' | 'passing';

/** 列车系统配置接口 */
export interface TrainSystemConfig {
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 是否为地铁场景（仅地铁场景启用环境列车） */
  isSubwayScene: boolean;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string, duration?: number) => void;
  /** 播放列车轰鸣音效回调 */
  onPlayTrain?: () => void;
  /** 屏幕震动回调 */
  onScreenShake?: (amount: number) => void;
  /** 生成扬尘粒子回调 */
  onSpawnDust?: (x: number, y: number) => void;
}

/** 列车系统类 */
export class TrainSystem {
  private config: TrainSystemConfig;

  // ========== 状态 ==========
  phase: TrainPhase = 'idle';
  /** 当前阶段剩余时间 */
  private phaseTimer: number = 0;
  /** 列车头部 X 坐标（沿行驶方向的前缘） */
  private headX: number = 0;
  /** 行驶方向：1 = 左→右，-1 = 右→左 */
  private direction: 1 | -1 = 1;
  /** 当前列车碾压伤害（召唤/环境不同） */
  private crushDamage: number = 0;
  /** 本列车是否由道具召唤 */
  private isSummoned: boolean = false;
  /** 本列车已碾压过的蟑螂 ID（防止重复伤害） */
  private crushedIds: Set<number> = new Set();
  /** 本次驶过是否已施加气流推退 */
  private pushApplied: boolean = false;
  /** 碾压计数（用于结算提示） */
  private hitCount: number = 0;
  /** 环境列车倒计时 */
  private ambientTimer: number = 0;

  constructor(config: TrainSystemConfig) {
    this.config = config;
    this.resetAmbientTimer();
  }

  updateConfig(config: Partial<TrainSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private get cfg() {
    return BALANCE_CONFIG.train;
  }

  /** 轨道中心 Y 坐标 */
  get trackY(): number {
    return this.config.canvasHeight * this.cfg.trackYRatio;
  }

  private resetAmbientTimer(): void {
    this.ambientTimer = this.cfg.ambientIntervalMin
      + Math.random() * (this.cfg.ambientIntervalMax - this.cfg.ambientIntervalMin);
  }

  // ========== 触发 ==========
  /**
   * 触发一列列车
   * @param summoned true = 道具召唤（高伤害）；false = 环境自动驶过（低伤害）
   */
  trigger(summoned: boolean): void {
    if (this.phase !== 'idle') return; // 同时只有一列列车
    this.isSummoned = summoned;
    this.crushDamage = summoned ? this.cfg.summonDamage : this.cfg.ambientDamage;
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.headX = this.direction === 1 ? 0 : this.config.canvasWidth;
    this.crushedIds.clear();
    this.pushApplied = false;
    this.hitCount = 0;
    this.phase = 'warning';
    this.phaseTimer = this.cfg.warningDuration;

    const text = summoned ? TEXT_CONFIG.combat.trainSummon : TEXT_CONFIG.combat.trainArriving;
    this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.trackY - 90, text.text, text.color, 1200);
  }

  /** 道具召唤入口 */
  summonTrain(): void {
    this.trigger(true);
  }

  // ========== 更新 ==========
  update(deltaTime: number, roaches: Roach[]): void {
    // 环境列车计时（仅地铁场景、无列车活动时）
    if (this.config.isSubwayScene && this.phase === 'idle') {
      this.ambientTimer -= deltaTime;
      if (this.ambientTimer <= 0) {
        this.trigger(false);
        this.resetAmbientTimer();
      }
    }

    if (this.phase === 'warning') {
      this.phaseTimer -= deltaTime;
      if (this.phaseTimer <= 0) {
        this.phase = 'passing';
        this.config.onPlayTrain?.();
        this.config.onScreenShake?.(10);
      }
      return;
    }

    if (this.phase !== 'passing') return;

    // 列车移动
    this.headX += this.direction * this.cfg.trainSpeed * deltaTime;
    const trainLength = this.config.canvasWidth * this.cfg.trainLengthRatio;
    const tailX = this.headX - this.direction * trainLength;

    // 碾压判定：头部经过蟑螂 X 且蟑螂在轨道带内
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || this.crushedIds.has(r.id)) continue;

      const isFlying = r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE || r.isBoss;
      const inTrackBand = Math.abs(r.y - this.trackY) <= this.cfg.trackHalfHeight;
      const passedBy = this.direction === 1
        ? (r.x <= this.headX && r.x >= tailX)
        : (r.x >= this.headX && r.x <= tailX);

      if (!inTrackBand || !passedBy) continue;

      this.crushedIds.add(r.id);

      if (r.isBoss) {
        // Boss 不被碾压，受固定撞击伤害
        r.hp -= this.cfg.bossDamage;
        r.damageFlash = 0.2;
      } else if (!isFlying) {
        r.hp -= this.crushDamage;
        r.damageFlash = 0.2;
        this.hitCount++;
        this.config.onSpawnDust?.(r.x, r.y);
      }
    }

    // 气流推退（列车中部经过屏幕时施加一次）：轨道带外的存活蟑螂被推离轨道
    if (!this.pushApplied) {
      const trainCenterCoveredScreen = this.direction === 1
        ? (tailX <= 0 && this.headX >= this.config.canvasWidth)
        : (tailX >= this.config.canvasWidth && this.headX <= 0);
      if (trainCenterCoveredScreen) {
        this.pushApplied = true;
        for (const r of roaches) {
          if (r.state !== RoachState.ALIVE || r.isBoss) continue;
          if (Math.abs(r.y - this.trackY) <= this.cfg.trackHalfHeight) continue;
          // 向远离轨道的方向推退
          const pushDir = r.y < this.trackY ? -1 : 1;
          r.y += pushDir * this.cfg.pushback;
          r.y = Math.max(80, Math.min(this.config.canvasHeight - 150, r.y));
          r.stunTimer = Math.max(r.stunTimer, 0.5);
          r.isStunned = true;
        }
        this.config.onScreenShake?.(8);
        // 结算提示
        if (this.hitCount > 0) {
          const msg = TEXT_CONFIG.combat.trainHit;
          this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 3, msg.text(this.hitCount), msg.color);
        } else if (this.isSummoned) {
          const msg = TEXT_CONFIG.combat.trainMiss;
          this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 3, msg.text, msg.color);
        }
      }
    }

    // 列车完全驶出屏幕
    const fullyOut = this.direction === 1
      ? tailX >= this.config.canvasWidth
      : tailX <= 0;
    if (fullyOut) {
      this.phase = 'idle';
    }
  }

  // ========== 渲染 ==========
  render(ctx: CanvasRenderingContext2D): void {
    if (this.phase === 'idle') return;

    const w = this.config.canvasWidth;
    const trackY = this.trackY;
    const bandH = this.cfg.trackHalfHeight;

    if (this.phase === 'warning') {
      // 预警：轨道带呼吸泛光 + 来车方向隧道口闪光
      const blink = 0.5 + 0.5 * Math.sin(this.phaseTimer * 12);
      ctx.save();
      ctx.fillStyle = `rgba(250, 204, 21, ${0.08 + blink * 0.1})`;
      ctx.fillRect(0, trackY - bandH, w, bandH * 2);
      // 隧道口来车灯光
      const lightX = this.direction === 1 ? 0 : w;
      const grad = ctx.createRadialGradient(lightX, trackY, 0, lightX, trackY, 120);
      grad.addColorStop(0, `rgba(255, 240, 180, ${0.5 + blink * 0.4})`);
      grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, trackY - 120, w, 240);
      ctx.restore();
      return;
    }

    // ===== passing：渲染列车车体 =====
    const trainLength = w * this.cfg.trainLengthRatio;
    const tailX = this.headX - this.direction * trainLength;
    const x1 = Math.min(this.headX, tailX);
    const visibleX = Math.max(0, x1);
    const visibleW = Math.min(w, Math.max(this.headX, tailX)) - visibleX;
    if (visibleW <= 0) return;

    const bodyH = bandH * 2 - 14;
    const bodyY = trackY - bodyH / 2;

    ctx.save();

    // 车底阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(visibleX, trackY + bodyH / 2 - 4, visibleW, 12);

    // 车体
    const bodyGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
    bodyGrad.addColorStop(0, '#3a4152');
    bodyGrad.addColorStop(0.5, '#232836');
    bodyGrad.addColorStop(1, '#161a26');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(visibleX, bodyY, visibleW, bodyH);

    // 车厢分隔线
    const carW = trainLength / this.cfg.carCount;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 3;
    for (let i = 1; i < this.cfg.carCount; i++) {
      const seamX = this.direction === 1 ? this.headX - carW * i : this.headX + carW * i;
      if (seamX >= visibleX && seamX <= visibleX + visibleW) {
        ctx.beginPath();
        ctx.moveTo(seamX, bodyY);
        ctx.lineTo(seamX, bodyY + bodyH);
        ctx.stroke();
      }
    }

    // 发光车窗（两排）
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const winW = 26;
    const winH = 14;
    const winStep = 44;
    const rowYs = [bodyY + bodyH * 0.22, bodyY + bodyH * 0.58];
    const startX = Math.floor(visibleX / winStep) * winStep;
    for (const wy of rowYs) {
      for (let wx = startX; wx < visibleX + visibleW; wx += winStep) {
        ctx.fillStyle = 'rgba(255, 214, 120, 0.85)';
        ctx.fillRect(wx + 6, wy, winW, winH);
      }
    }

    // 车头灯（行驶方向前缘的锥形光束）
    const beamLen = w * 0.35;
    const beamX0 = this.headX;
    const beamX1 = this.headX + this.direction * beamLen;
    const beamGrad = ctx.createLinearGradient(beamX0, 0, beamX1, 0);
    beamGrad.addColorStop(0, 'rgba(255, 245, 200, 0.5)');
    beamGrad.addColorStop(1, 'rgba(255, 245, 200, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(beamX0, trackY - bodyH * 0.3);
    ctx.lineTo(beamX1, trackY - bodyH * 0.9);
    ctx.lineTo(beamX1, trackY + bodyH * 0.9);
    ctx.lineTo(beamX0, trackY + bodyH * 0.3);
    ctx.closePath();
    ctx.fill();

    // 车尾灯
    ctx.fillStyle = 'rgba(255, 60, 60, 0.8)';
    ctx.fillRect(tailX - (this.direction === 1 ? 4 : -4), trackY - 8, 4, 16);

    // 速度线（车后方拖尾）
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const ly = trackY - bandH + (i / 5) * bandH * 2;
      const lx0 = tailX - this.direction * (20 + i * 14);
      const lx1 = lx0 - this.direction * 60;
      ctx.beginPath();
      ctx.moveTo(lx0, ly);
      ctx.lineTo(lx1, ly);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  /** 是否有列车正在活动（用于外部暂停掉落等判断） */
  isActive(): boolean {
    return this.phase !== 'idle';
  }

  reset(): void {
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.crushedIds.clear();
    this.pushApplied = false;
    this.hitCount = 0;
    this.resetAmbientTimer();
  }
}
