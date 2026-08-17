/**
 * @fileoverview 风扇系统模块
 * @description 负责管理游戏中风扇武器的完整逻辑，包括激活、减速、击退、渲染
 */

import { RoachType, RoachState } from '../../types';
import type { FanState, Roach } from '../../types';
import { TEXT_CONFIG, RENDER_FONT, BALANCE_CONFIG } from '../../data';

/**
 * 风扇系统配置接口（修复 P2：统一为 getter 函数，消除函数/值不一致）
 */
export interface FanSystemConfig {
  /** 获取画布宽度 */
  getCanvasWidth: () => number;
  /** 获取画布高度 */
  getCanvasHeight: () => number;
  /** 获取防御线Y坐标 */
  getDefenseLineY: () => number;
  /** 获取透视远端缩放系数（场景地面阻挡梯形远边宽/近边宽；未提供时回退 fan.perspectiveScaleMin） */
  getPerspectiveScaleMin?: () => number;
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
    const fanCfg = BALANCE_CONFIG.fan;
    this.fanState = {
      active: false,
      timer: 0,
      duration: fanCfg.defaultDuration,
      slowFactor: fanCfg.defaultSlowFactor,
      bladeAngle: 0,
      bladeSpeed: fanCfg.defaultBladeSpeed,
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

  /**
   * 激活风扇（修复 P1：重复激活时给予反馈）
   */
  activateFan(): boolean {
    const fanCfg = BALANCE_CONFIG.fan;
    const fanDurationMult = this.config.talentMultipliers?.fanDuration || 1;
    const wasActive = this.fanState.active;

    this.fanState.active = true;
    this.fanState.timer = this.fanState.duration * fanDurationMult;
    this.fanState.bladeAngle = 0;

    const W = this.config.getCanvasWidth();
    const H = this.config.getCanvasHeight();
    const textY = H * fanCfg.activationTextYRatio;

    if (wasActive) {
      // 修复 P1：重复激活给予反馈
      this.config.onAddFloatingText?.(W / 2, textY, TEXT_CONFIG.combat.fanRefresh.text, TEXT_CONFIG.combat.fanRefresh.color);
      this.config.onAddFloatingText?.(W / 2, textY + fanCfg.activationTextYOffset, TEXT_CONFIG.combat.fanTimer.text(this.fanState.timer.toFixed(1)), TEXT_CONFIG.combat.fanTimer.color);
    } else {
      this.config.onStartFanLoop?.();

      // 修复 P2：使用配置值替代硬编码 8
      const durationText = fanDurationMult > 1
        ? TEXT_CONFIG.combat.fanDurationWithTalent.text(fanCfg.defaultDuration, fanDurationMult)
        : TEXT_CONFIG.combat.fanDesc.text(fanCfg.defaultDuration);

      this.config.onAddFloatingText?.(W / 2, textY, TEXT_CONFIG.combat.fanActivate.text, TEXT_CONFIG.combat.fanActivate.color);
      this.config.onAddFloatingText?.(W / 2, textY + fanCfg.activationTextYOffset, durationText, TEXT_CONFIG.combat.fanActivate.color);
      this.config.onScreenShake?.(fanCfg.activationScreenShake);
    }

    return true;
  }

  // ========== 效果计算 ==========

  /** 根据蟑螂类型获取风扇效果参数 [slowFactor, pushSpeed] */
  getFanEffectByType(type: RoachType): [number, number] {
    const effects = BALANCE_CONFIG.fan.effects;
    // 将 RoachType 枚举值映射到配置 key
    const key = type.toString().toLowerCase();
    // 处理特殊映射：FLYING_SUICIDE → flyingSuicide
    const configKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return effects[configKey] || effects.default;
  }

  /**
   * 应用风扇效果到单个蟑螂（修复 P1：保留 fanPushY 动量，限制减速时间不超过风扇剩余时间）
   */
  applyFanEffect(roach: Roach): void {
    const [slowFactor] = this.getFanEffectByType(roach.type);
    const fanSlowMult = this.config.talentMultipliers?.fanSlow || 1;
    roach.fanSlowFactor = slowFactor * fanSlowMult;
    const fanDurationMult = this.config.talentMultipliers?.fanDuration || 1;
    const fullDuration = this.fanState.duration * fanDurationMult;
    // 修复 P1：减速时间不超过风扇剩余时间
    roach.fanSlowTimer = Math.min(fullDuration, Math.max(0, this.fanState.timer));
    // 修复 P1：保留已有 fanPushY 动量，不重置为 0
    if (roach.fanSlowTimer <= 0) {
      roach.fanPushY = 0;
    }
  }

  // ========== 更新 ==========

  /**
   * 更新风扇（修复 P1：合并 4 次遍历为 2 次；修复 P2：修复清理/计时器重叠）
   */
  updateFan(deltaTime: number, roaches: Roach[]): FanState {
    const fan = this.fanState;
    if (!fan.active) return fan;

    fan.timer -= deltaTime;
    fan.bladeAngle += fan.bladeSpeed * deltaTime;

    const fanCfg = BALANCE_CONFIG.fan;
    const fanTopY = this.config.getCanvasHeight() * fanCfg.fanTopYRatio;
    const defenseLineY = this.config.getDefenseLineY();

    // 风扇结束：清理所有蟑螂的风扇状态
    if (fan.timer <= 0) {
      fan.active = false;
      fan.timer = 0;
      this.config.onStopFanLoop?.();
      this.config.onAddFloatingText?.(
        this.config.getCanvasWidth() / 2,
        this.config.getCanvasHeight() * fanCfg.activationTextYRatio,
        TEXT_CONFIG.combat.fanStop.text,
        TEXT_CONFIG.combat.fanStop.color,
      );
      for (const r of roaches) {
        r.fanSlowTimer = 0;
        r.fanSlowFactor = 0;
        r.fanPushY = 0;
      }
      // 修复 P2：提前返回，避免后续无效的计时器更新遍历
      return fan;
    }

    // 修复 P1：单次遍历处理新蟑螂效果应用 + 击退 + 减速计时器更新
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;

      // 对新进入风扇区域的蟑螂应用效果
      if (r.fanSlowTimer <= 0 && r.y >= fanTopY && r.y <= defenseLineY) {
        this.applyFanEffect(r);
      }

      // 击退：将受影响的蟑螂向上推
      if (r.fanSlowTimer > 0 && r.y >= fanTopY) {
        const [, pushSpeed] = this.getFanEffectByType(r.type);
        r.fanPushY -= pushSpeed * deltaTime;
      }

      // 减速计时器递减
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

  /**
   * 渲染风扇（修复 P1：修复 globalAlpha 作用域；修复 P2：参数配置化 + 优化粒子 save/restore）
   */
  renderFan(ctx: CanvasRenderingContext2D, gameTime: number): void {
    if (!this.fanState.active) return;
    const fan = this.fanState;
    const fanCfg = BALANCE_CONFIG.fan;
    const W = this.config.getCanvasWidth();
    const H = this.config.getCanvasHeight();
    const dl = this.config.getDefenseLineY();
    const fanTopY = H * fanCfg.fanTopYRatio;
    const t = gameTime;
    const RANGE = dl - fanTopY;
    const SOURCE_WIDTH = W * fanCfg.sourceWidthRatio;
    // 透视远端缩放：按场景地面阻挡梯形远/近边宽度比（各场景透视一致），回退固定配置
    const perspMin = this.config.getPerspectiveScaleMin?.() ?? fanCfg.perspectiveScaleMin;
    // 透视 Y 归一化基准：与角色渲染透视同规则（固定设计坐标——远端 farY(350) 处最小 → 近端 nearY(960) 处 1.0）
    const pc = BALANCE_CONFIG.render.roach.perspective;
    const normYAt = (y: number) => Math.max(0, Math.min(1, (pc.nearY - y) / (pc.nearY - pc.farY)));

    ctx.save();
    ctx.globalCompositeOperation = fanCfg.blend; // 叠加混合集中于 vfx-balance fan.blend

    // ===== 透视气流线 =====
    // 修复 P1：用 save/restore 包裹 globalAlpha 修改
    ctx.save();
    for (let i = 0; i < fanCfg.emitter.waveCount; i++) {
      const srcX = (i / (fanCfg.emitter.waveCount - 1)) * SOURCE_WIDTH + (W - SOURCE_WIDTH) / 2;
      const waveSpeed = fanCfg.waveSpeedBase + i * fanCfg.waveSpeedIncrement;
      const wavePhase = t * waveSpeed + i * fanCfg.wavePhaseMultiplier;
      const baseAmplitude = fanCfg.waveAmplitudeBase + i * fanCfg.waveAmplitudeIncrement;

      ctx.globalAlpha = fanCfg.waveAlphaBase + Math.sin(wavePhase * 0.5) * fanCfg.waveAlphaAmp;
      ctx.strokeStyle = i % 3 === 0 ? fanCfg.waveSecondaryColor : fanCfg.wavePrimaryColor;
      ctx.lineWidth = fanCfg.waveStrokeBase + Math.sin(wavePhase) * fanCfg.waveStrokeAmp;
      ctx.beginPath();

      let firstPoint = true;
      for (let y = dl; y >= fanTopY; y -= fanCfg.waveLineYStep) {
        const normalizedY = normYAt(y);
        const perspectiveScale = 1.0 - normalizedY * (1 - perspMin);
        const cx = W / 2 + (srcX - W / 2) * perspectiveScale;
        const amplitude = baseAmplitude * perspectiveScale;
        const x = cx + Math.sin(normalizedY * Math.PI * 6 + wavePhase) * amplitude;
        if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore(); // 恢复 globalAlpha

    // ===== 透视阵风前沿 =====
    ctx.save();
    for (let g = 0; g < fanCfg.emitter.gustCount; g++) {
      const gustSpeed = fanCfg.gustSpeedBase + g * fanCfg.gustSpeedIncrement;
      const gustPhase = (t * gustSpeed + g / fanCfg.emitter.gustCount) % 1.0;
      const gustY = dl - gustPhase * RANGE;
      const gustAlpha = Math.sin(gustPhase * Math.PI) * fanCfg.gustAlphaBase;
      if (gustAlpha <= 0 || gustY < fanTopY) continue;

      const normalizedY = normYAt(gustY);
      const perspectiveScale = 1.0 - normalizedY * (1 - perspMin);
      const gustHalfWidth = (SOURCE_WIDTH / 2) * perspectiveScale;
      const gustHeight = fanCfg.gustHeightBase + g * fanCfg.gustHeightIncrement;

      const grad = ctx.createLinearGradient(0, gustY - gustHeight / 2, 0, gustY + gustHeight / 2);
      grad.addColorStop(0, fanCfg.gustEdgeColor);
      grad.addColorStop(0.5, fanCfg.gustMidColor.replace('{alpha}', gustAlpha.toFixed(3)));
      grad.addColorStop(1, fanCfg.gustEdgeColor);
      ctx.fillStyle = grad;
      ctx.fillRect(W / 2 - gustHalfWidth, gustY - gustHeight / 2, gustHalfWidth * 2, gustHeight);

      ctx.globalAlpha = gustAlpha * 1.5;
      ctx.strokeStyle = fanCfg.gustLineColor;
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
    ctx.restore(); // 恢复 globalAlpha

    // ===== 透视粒子（修复 P2：手动变换替代 save/restore 嵌套） =====
    ctx.save();
    for (let p = 0; p < fanCfg.emitter.particleCount; p++) {
      const riseSpeed = fanCfg.particleRiseSpeedBase + (p % 5) * fanCfg.particleRiseSpeedIncrement;
      const phase = (p * 137.5 + t * riseSpeed) % RANGE;
      const py = dl - phase;
      const normalizedY = normYAt(py);
      const perspectiveScale = 1.0 - normalizedY * (1 - perspMin);
      const srcHalfWidth = SOURCE_WIDTH / 2;
      const baseX = (p * 97.3) % SOURCE_WIDTH - srcHalfWidth;
      const px = W / 2 + baseX * perspectiveScale + Math.sin(t * 2 + p) * 8 * perspectiveScale;
      const pSize = (fanCfg.particleSizeBase + Math.sin(p + t) * fanCfg.particleSizeAmp) * perspectiveScale;
      const pAlpha = (fanCfg.particleAlphaBase + Math.sin(t * 2.5 + p * 1.7) * fanCfg.particleAlphaAmp) * (0.5 + normalizedY * 0.5);

      ctx.globalAlpha = Math.max(0, pAlpha);
      ctx.fillStyle = p % 2 === 0 ? fanCfg.particleLightColor : fanCfg.particleDarkColor;
      
      // 修复 P2：手动变换替代 save/restore 嵌套，减少 GPU 状态切换
      const angle = Math.sin(t + p * 0.5) * fanCfg.particleRotateAmp - 0.1;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const hw = pSize / 2;
      const hh = pSize * fanCfg.particleSizeLength / 2;
      // 旋转矩形四个角
      const corners = [
        [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
      ].map(([lx, ly]) => [px + lx * cos - ly * sin, py + lx * sin + ly * cos]);
      ctx.beginPath();
      ctx.moveTo(corners[0][0], corners[0][1]);
      for (let c = 1; c < 4; c++) ctx.lineTo(corners[c][0], corners[c][1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore(); // 恢复 globalAlpha

    // ===== 风扇源轮廓 =====
    ctx.save();
    ctx.globalAlpha = fanCfg.sourceAlpha;
    ctx.strokeStyle = fanCfg.waveSecondaryColor;
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
    ctx.restore();

    // ===== 源发光 =====
    const sourceGrad = ctx.createRadialGradient(W / 2, dl, 0, W / 2, dl, SOURCE_WIDTH / 2);
    sourceGrad.addColorStop(0, fanCfg.sourceGlowInnerColor.replace('{alpha}', String(fanCfg.sourceGlowAlpha)));
    sourceGrad.addColorStop(0.5, fanCfg.sourceGlowMidColor.replace('{alpha}', String(fanCfg.sourceGlowMidAlpha)));
    sourceGrad.addColorStop(1, fanCfg.sourceGlowFadeColor);
    ctx.fillStyle = sourceGrad;
    ctx.fillRect(W / 2 - SOURCE_WIDTH / 2, fanTopY, SOURCE_WIDTH, RANGE);

    // ===== 风扇图标 + 计时器 =====
    const iconCX = W / 2;
    const iconCY = dl - fanCfg.iconYOffset;
    const iconSize = fanCfg.iconSize;

    ctx.fillStyle = fanCfg.iconBgColor;
    ctx.beginPath();
    ctx.arc(iconCX, iconCY, iconSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = fanCfg.iconStrokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const angle = fan.bladeAngle + (i * Math.PI * 2 / 3);
      const bx = iconCX + Math.cos(angle) * iconSize * fanCfg.bladeRadiusRatio;
      const by = iconCY + Math.sin(angle) * iconSize * fanCfg.bladeRadiusRatio;
      ctx.fillStyle = fanCfg.iconBladeColor;
      ctx.beginPath();
      ctx.ellipse(bx, by, fanCfg.bladeSize, fanCfg.bladeLength, angle + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = fanCfg.iconCenterColor;
    ctx.beginPath();
    ctx.arc(iconCX, iconCY, fanCfg.centerSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fanCfg.iconPrimaryColor;
    ctx.font = RENDER_FONT.boldMedium;
    ctx.textAlign = 'center';
    ctx.fillText(TEXT_CONFIG.combat.fanTimer.text(fan.timer.toFixed(1)), iconCX, iconCY - iconSize - fanCfg.iconTimerYOffset);

    ctx.fillStyle = fanCfg.iconBlowingColor;
    ctx.font = RENDER_FONT.small;
    ctx.fillText(TEXT_CONFIG.combat.fanBlowing.text, iconCX, iconCY - iconSize - fanCfg.iconBlowingYOffset);

    ctx.restore();
  }

  reset(): void {
    const fanCfg = BALANCE_CONFIG.fan;
    this.fanState = {
      active: false,
      timer: 0,
      duration: fanCfg.defaultDuration,
      slowFactor: fanCfg.defaultSlowFactor,
      bladeAngle: 0,
      bladeSpeed: fanCfg.defaultBladeSpeed,
    };
  }
}