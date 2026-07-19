/**
 * @fileoverview 风扇系统模块
 * @description 负责管理游戏中风扇武器的完整逻辑，包括激活、减速、击退、渲染
 */

import { RoachType, RoachState } from '../../types';
import type { FanState, Roach } from '../../types';
import { TEXT_CONFIG } from '../../data';

/**
 * 风扇系统配置接口
 */
export interface FanSystemConfig {
  /** 游戏画布宽度 */
  canvasWidth: number;
  /** 游戏画布高度 */
  canvasHeight: number;
  /** 防御线Y坐标 */
  defenseLineY: () => number;
  /** 天赋倍数 */
  talentMultipliers?: {
    fanDuration?: number;
    fanSlow?: number;
  };
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 开始风扇循环音效回调 */
  onStartFanLoop?: () => void;
  /** 停止风扇循环音效回调 */
  onStopFanLoop?: () => void;
  /** 屏幕震动回调 */
  onScreenShake?: (amount: number) => void;
}

/**
 * 风扇系统类
 * @description 管理风扇武器的激活、计时、效果应用和渲染
 */
export class FanSystem {
  /** 风扇状态 */
  private fanState: FanState;
  /** 系统配置 */
  private config: FanSystemConfig;

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

  updateConfig(config: Partial<FanSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): FanState {
    return { ...this.fanState };
  }

  isActive(): boolean {
    return this.fanState.active;
  }

  getRemainingTime(): number {
    return Math.max(0, this.fanState.timer);
  }

  getBladeAngle(): number {
    return this.fanState.bladeAngle;
  }

  // ========== 激活 ==========
  activateFan(): boolean {
    if (this.fanState.active) {
      const fanDurationMult = this.config.talentMultipliers?.fanDuration || 1;
      this.fanState.timer = this.fanState.duration * fanDurationMult;
      return true;
    }

    this.fanState.active = true;
    const fanDurationMult = this.config.talentMultipliers?.fanDuration || 1;
    this.fanState.timer = this.fanState.duration * fanDurationMult;
    this.fanState.bladeAngle = 0;

    this.config.onStartFanLoop?.();

    const durationText = fanDurationMult > 1
      ? `蟑螂被吹退${(8 * fanDurationMult).toFixed(1)}秒!(+天赋)`
      : TEXT_CONFIG.combat.fanDesc;

    this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight * 0.3, TEXT_CONFIG.combat.fanActivate, '#a78bfa');
    this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight * 0.3 + 20, durationText, '#c4b5fd');
    this.config.onScreenShake?.(4);

    return true;
  }

  // ========== 效果计算 ==========
  /** 根据蟑螂类型获取风扇效果参数 [slowFactor, pushSpeed] */
  getFanEffectByType(type: RoachType): [number, number] {
    switch (type) {
      case RoachType.FLYING: return [0.70, 120];
      case RoachType.FLYING_SUICIDE: return [0.65, 100];
      case RoachType.SMALL: return [0.60, 80];
      case RoachType.LARGE: return [0.40, 50];
      case RoachType.SPLITTING: return [0.40, 50];
      case RoachType.SUICIDE: return [0.30, 35];
      case RoachType.ARMORED: return [0.20, 25];
      case RoachType.QUEEN: return [0.10, 15];
      default: return [0.40, 50];
    }
  }

  /** 应用风扇效果到单个蟑螂 */
  applyFanEffect(roach: Roach): void {
    const [slowFactor] = this.getFanEffectByType(roach.type);
    const fanSlowMult = this.config.talentMultipliers?.fanSlow || 1;
    roach.fanSlowFactor = slowFactor * fanSlowMult;
    const fanDurationMult = this.config.talentMultipliers?.fanDuration || 1;
    roach.fanSlowTimer = this.fanState.duration * fanDurationMult;
    roach.fanPushY = 0;
  }

  // ========== 更新 ==========
  updateFan(deltaTime: number, roaches: Roach[]): FanState {
    const fan = this.fanState;
    if (!fan.active) return fan;

    fan.timer -= deltaTime;
    fan.bladeAngle += fan.bladeSpeed * deltaTime;

    const fanTopY = this.config.canvasHeight / 2;

    // 对风扇激活期间新生成的蟑螂应用风扇效果
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      if (r.fanSlowTimer <= 0 && fan.timer > 0 && r.y >= fanTopY && r.y <= this.config.defenseLineY()) {
        this.applyFanEffect(r);
      }
    }

    // 将所有受影响的蟑螂向上推
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      if (r.fanSlowTimer > 0 && r.y >= fanTopY) {
        const [, pushSpeed] = this.getFanEffectByType(r.type);
        r.fanPushY -= pushSpeed * deltaTime;
      }
    }

    // 风扇结束
    if (fan.timer <= 0) {
      fan.active = false;
      fan.timer = 0;
      this.config.onStopFanLoop?.();
      this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight * 0.3, TEXT_CONFIG.combat.fanStop, '#9ca3af');
      for (const r of roaches) {
        r.fanSlowTimer = 0;
        r.fanSlowFactor = 0;
        r.fanPushY = 0;
      }
    }

    // 更新受影响蟑螂的减速计时器
    for (const r of roaches) {
      if (r.fanSlowTimer > 0) {
        r.fanSlowTimer -= deltaTime;
        if (r.fanSlowTimer <= 0) {
          r.fanSlowFactor = 0;
        }
      }
    }

    return fan;
  }

  // ========== 渲染 ==========
  renderFan(ctx: CanvasRenderingContext2D, gameTime: number): void {
    if (!this.fanState.active) return;
    const fan = this.fanState;
    const W = this.config.canvasWidth;
    const H = this.config.canvasHeight;
    const dl = this.config.defenseLineY();
    const fanTopY = H / 2;
    const t = gameTime;
    const RANGE = dl - fanTopY;
    const SOURCE_WIDTH = W * 0.7;

    ctx.save();

    // ===== 透视气流线 =====
    const waveCount = 18;
    for (let i = 0; i < waveCount; i++) {
      const srcX = (i / (waveCount - 1)) * SOURCE_WIDTH + (W - SOURCE_WIDTH) / 2;
      const waveSpeed = 2.0 + i * 0.3;
      const wavePhase = t * waveSpeed + i * 2.7;
      const baseAmplitude = 14 + i * 1.5;

      ctx.globalAlpha = 0.04 + Math.sin(wavePhase * 0.5) * 0.03;
      ctx.strokeStyle = i % 3 === 0 ? '#c4b5fd' : '#a78bfa';
      ctx.lineWidth = 2.0 + Math.sin(wavePhase) * 1.0;
      ctx.beginPath();

      let firstPoint = true;
      for (let y = dl; y >= fanTopY; y -= 5) {
        const normalizedY = (dl - y) / RANGE;
        const perspectiveScale = 1.0 - normalizedY * 0.92;
        const cx = W / 2 + (srcX - W / 2) * perspectiveScale;
        const amplitude = baseAmplitude * perspectiveScale;
        const x = cx + Math.sin(normalizedY * Math.PI * 6 + wavePhase) * amplitude;
        if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ===== 透视阵风前沿 =====
    const gustCount = 5;
    for (let g = 0; g < gustCount; g++) {
      const gustSpeed = 0.5 + g * 0.3;
      const gustPhase = (t * gustSpeed + g / gustCount) % 1.0;
      const gustY = dl - gustPhase * RANGE;
      const gustAlpha = Math.sin(gustPhase * Math.PI) * 0.15;
      if (gustAlpha <= 0 || gustY < fanTopY) continue;

      const normalizedY = (dl - gustY) / RANGE;
      const perspectiveScale = 1.0 - normalizedY * 0.92;
      const gustHalfWidth = (SOURCE_WIDTH / 2) * perspectiveScale;
      const gustHeight = 45 + g * 12;

      const grad = ctx.createLinearGradient(0, gustY - gustHeight / 2, 0, gustY + gustHeight / 2);
      grad.addColorStop(0, 'rgba(167, 139, 250, 0)');
      grad.addColorStop(0.5, `rgba(196, 181, 253, ${gustAlpha})`);
      grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(W / 2 - gustHalfWidth, gustY - gustHeight / 2, gustHalfWidth * 2, gustHeight);

      ctx.globalAlpha = gustAlpha * 1.5;
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 1.5;
      // Left edge
      ctx.beginPath();
      ctx.moveTo(W / 2 - SOURCE_WIDTH / 2, dl);
      ctx.lineTo(W / 2 - gustHalfWidth, gustY);
      ctx.stroke();
      // Right edge
      ctx.beginPath();
      ctx.moveTo(W / 2 + SOURCE_WIDTH / 2, dl);
      ctx.lineTo(W / 2 + gustHalfWidth, gustY);
      ctx.stroke();
      // Center gust line
      ctx.beginPath();
      for (let x = W / 2 - gustHalfWidth * 0.8; x <= W / 2 + gustHalfWidth * 0.8; x += 6) {
        const offset = Math.sin(x * 0.02 + t * 4 + g * 2) * 5 * perspectiveScale;
        if (x === W / 2 - gustHalfWidth * 0.8) ctx.moveTo(x, gustY + offset);
        else ctx.lineTo(x, gustY + offset);
      }
      ctx.stroke();
    }

    // ===== 透视粒子 =====
    const particleCount = 28;
    for (let p = 0; p < particleCount; p++) {
      const riseSpeed = 50 + (p % 5) * 30;
      const phase = (p * 137.5 + t * riseSpeed) % RANGE;
      const py = dl - phase;
      const normalizedY = phase / RANGE;
      const perspectiveScale = 1.0 - normalizedY * 0.92;
      const srcHalfWidth = SOURCE_WIDTH / 2;
      const baseX = (p * 97.3) % SOURCE_WIDTH - srcHalfWidth;
      const px = W / 2 + baseX * perspectiveScale + Math.sin(t * 2 + p) * 8 * perspectiveScale;
      const pSize = (1.8 + Math.sin(p + t) * 0.6) * perspectiveScale;
      const pAlpha = (0.15 + Math.sin(t * 2.5 + p * 1.7) * 0.1) * (0.5 + normalizedY * 0.5);

      ctx.globalAlpha = Math.max(0, pAlpha);
      ctx.fillStyle = p % 2 === 0 ? '#ddd6fe' : '#c4b5fd';
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.sin(t + p * 0.5) * 0.3 - 0.1);
      ctx.fillRect(-pSize / 2, -pSize * 2.5, pSize, pSize * 5);
      ctx.restore();
    }

    // ===== 风扇源轮廓 =====
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - SOURCE_WIDTH / 2, dl);
    ctx.lineTo(W / 2 - SOURCE_WIDTH * 0.04, fanTopY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2 + SOURCE_WIDTH / 2, dl);
    ctx.lineTo(W / 2 + SOURCE_WIDTH * 0.04, fanTopY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, fanTopY, SOURCE_WIDTH * 0.04, 0, Math.PI, true);
    ctx.stroke();

    // ===== 源发光 =====
    const sourceGrad = ctx.createRadialGradient(W / 2, dl, 0, W / 2, dl, SOURCE_WIDTH / 2);
    sourceGrad.addColorStop(0, 'rgba(167, 139, 250, 0.18)');
    sourceGrad.addColorStop(0.5, 'rgba(196, 181, 253, 0.06)');
    sourceGrad.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = sourceGrad;
    ctx.fillRect(W / 2 - SOURCE_WIDTH / 2, fanTopY, SOURCE_WIDTH, RANGE);

    // ===== 风扇图标 + 计时器 =====
    const iconCX = W / 2;
    const iconCY = dl - 30;
    const iconSize = 22;

    ctx.fillStyle = 'rgba(229, 231, 235, 0.9)';
    ctx.beginPath();
    ctx.arc(iconCX, iconCY, iconSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const angle = fan.bladeAngle + (i * Math.PI * 2 / 3);
      const bx = iconCX + Math.cos(angle) * iconSize * 0.55;
      const by = iconCY + Math.sin(angle) * iconSize * 0.55;
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.ellipse(bx, by, 4, 8, angle + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.arc(iconCX, iconCY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`风扇 ${fan.timer.toFixed(1)}s`, iconCX, iconCY - iconSize - 8);

    ctx.fillStyle = 'rgba(167, 139, 250, 0.7)';
    ctx.font = '10px sans-serif';
    ctx.fillText(TEXT_CONFIG.combat.fanBlowing, iconCX, iconCY - iconSize - 20);

    ctx.restore();
  }

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
}