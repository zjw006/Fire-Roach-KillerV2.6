/**
 * @fileoverview 护士蟑螂治疗特效渲染模块
 * @description 提供护士蟑螂 3 阶段治疗动画的静态渲染方法
 *   - 使用归一化渐变缓存减少每帧 createRadialGradient 调用
 *   - 使用预计算旋转刻度减少每帧三角函数调用
 *   - 阶段时长引用 BALANCE_CONFIG 确保与逻辑层一致
 */

import { RoachType, RoachState } from '../../types';
import { BALANCE_CONFIG } from '../../data';
import type { Roach } from '../../types';

/** 预计算的刻度数据 */
interface TickData {
  cos: number;
  sin: number;
  len: number;
  width: number;
}

/**
 * 护士蟑螂治疗特效渲染器
 * @description 纯静态渲染类，不维护内部状态
 */
export class NurseRenderer {
  // ===== 归一化渐变缓存（半径=1，原点居中，通过 translate+scale 定位缩放） =====

  /** 蓄力阶段辉光渐变 */
  private static _chargeGlowGrad: CanvasGradient | null = null;
  /** 喷射阶段雾团渐变 */
  private static _sprayBlobGrad: CanvasGradient | null = null;
  /** 喷射阶段环辉光渐变 */
  private static _sprayRingGlowGrad: CanvasGradient | null = null;
  /** 消散阶段辉光渐变 */
  private static _dissipateGlowGrad: CanvasGradient | null = null;

  // ===== 预计算刻度数据 =====

  private static _tickData: TickData[] | null = null;

  // ===== 渐变获取方法 =====

  private static getChargeGlowGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (!this._chargeGlowGrad) {
      const grad = ctx.createRadialGradient(0, 0, 0.3, 0, 0, 1.2);
      grad.addColorStop(0, 'rgba(100, 240, 150, 0)');
      grad.addColorStop(0.85, 'rgba(100, 240, 150, 0.2)');
      grad.addColorStop(1, 'rgba(140, 255, 190, 0.4)');
      this._chargeGlowGrad = grad;
    }
    return this._chargeGlowGrad;
  }

  private static getSprayBlobGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (!this._sprayBlobGrad) {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, 'rgba(100, 148, 100, 1)');
      grad.addColorStop(0.5, 'rgba(90, 138, 90, 0.5)');
      grad.addColorStop(1, 'rgba(80, 120, 80, 0)');
      this._sprayBlobGrad = grad;
    }
    return this._sprayBlobGrad;
  }

  private static getSprayRingGlowGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (!this._sprayRingGlowGrad) {
      const grad = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 1.1);
      grad.addColorStop(0, 'rgba(80, 220, 120, 0)');
      grad.addColorStop(0.8, 'rgba(80, 220, 120, 0.15)');
      grad.addColorStop(1, 'rgba(120, 255, 170, 0.35)');
      this._sprayRingGlowGrad = grad;
    }
    return this._sprayRingGlowGrad;
  }

  private static getDissipateGlowGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (!this._dissipateGlowGrad) {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, 'rgba(90, 220, 130, 0.08)');
      grad.addColorStop(1, 'rgba(90, 220, 130, 0)');
      this._dissipateGlowGrad = grad;
    }
    return this._dissipateGlowGrad;
  }

  // ===== 刻度预计算 =====

  private static getTickData(): TickData[] {
    if (!this._tickData) {
      const cfg = BALANCE_CONFIG.render.nurseHealVFX.spray;
      const data: TickData[] = [];
      for (let i = 0; i < cfg.tickCount; i++) {
        const angle = (i / cfg.tickCount) * Math.PI * 2;
        data.push({
          cos: Math.cos(angle),
          sin: Math.sin(angle),
          len: cfg.tickBaseLen + (i % 3 === 0 ? cfg.tickLongExtra : 0),
          width: i % 3 === 0 ? cfg.tickWidthLong : cfg.tickWidthNormal,
        });
      }
      this._tickData = data;
    }
    return this._tickData;
  }

  /**
   * 使刻度预计算缓存失效（下一次渲染时按当前配置重建）。
   * 仅供开发工具（特效编辑器 /effect-lab）在修改 nurseHealVFX.spray 参数后调用；
   * 游戏运行时配置不变，无需调用。
   */
  static invalidateTickCache(): void {
    this._tickData = null;
  }

  /**
   * 渲染护士蟑螂的治疗特效（3 阶段动画）
   * @param ctx Canvas 渲染上下文
   * @param roaches 蟑螂数组
   * @param time 游戏时间
   */
  static renderNurseHealVFX(
    ctx: CanvasRenderingContext2D,
    roaches: Roach[],
    time: number
  ): void {
    const vfxCfg = BALANCE_CONFIG.render.nurseHealVFX;
    const phaseCfg = BALANCE_CONFIG.roachAI.nurseHealPhases;
    const tickData = NurseRenderer.getTickData();

    ctx.save();
    for (const r of roaches) {
      if (r.type !== RoachType.NURSE || r.state !== RoachState.ALIVE) continue;
      if (!r.healPhase || r.healPhase === 'idle') continue;

      const healRange = vfxCfg.healRange;
      const progress = r.healPhaseTimer || 0;

      switch (r.healPhase) {
        case 'charging': {
          const chgCfg = vfxCfg.charge;
          const chargeDuration = phaseCfg.charging;
          const chargeProgress = 1 - progress / chargeDuration;
          const alpha = chgCfg.glowAlphaBase + chargeProgress * chgCfg.glowAlphaRange;
          const footY = r.y + vfxCfg.footYOffset;
          const expandScale = chargeProgress;

          // 1. Expanding outer ring
          const ringR = healRange * chgCfg.ringScaleRatio * expandScale;
          const ringRY = healRange * chgCfg.ringYScaleRatio * expandScale;

          if (ringR > 5) {
            // Glow (cached normalized gradient)
            ctx.save();
            ctx.translate(r.x, footY);
            ctx.scale(ringR * 1.2, ringRY * 1.2);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = NurseRenderer.getChargeGlowGradient(ctx);
            ctx.beginPath();
            ctx.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Solid ring boundary
            ctx.strokeStyle = `rgba(120, 255, 170, ${alpha * chgCfg.ringAlphaMultiplier})`;
            ctx.lineWidth = chgCfg.ringLineWidth;
            ctx.beginPath();
            ctx.ellipse(r.x, footY, ringR, ringRY, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Inner fill
            ctx.fillStyle = `rgba(100, 230, 150, ${alpha * chgCfg.fillAlpha})`;
            ctx.beginPath();
            ctx.ellipse(r.x, footY, ringR * 0.85, ringRY * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          // 2. Center pulse dot
          const dotPulse = 1 + Math.sin(time * chgCfg.dotPulseFreq) * chgCfg.dotPulseAmp;
          ctx.fillStyle = `rgba(140, 255, 190, ${alpha * chgCfg.dotAlpha})`;
          ctx.beginPath();
          ctx.arc(r.x, footY, chgCfg.dotBaseSize * dotPulse * expandScale, 0, Math.PI * 2);
          ctx.fill();

          // 3. ECG-like pulse line
          ctx.strokeStyle = `rgba(100, 230, 150, ${alpha * chgCfg.ecgAlpha})`;
          ctx.lineWidth = chgCfg.ecgLineWidth;
          ctx.beginPath();
          for (let ex = -chgCfg.ecgRange; ex <= chgCfg.ecgRange; ex += chgCfg.ecgStep) {
            const ecgY = footY - chgCfg.ecgBaseY
              + Math.sin(ex * chgCfg.ecgWaveFreq + time * chgCfg.ecgFreq)
              * (ex % 20 < 5 ? 12 : 3);
            if (ex === -chgCfg.ecgRange) ctx.moveTo(r.x + ex, ecgY);
            else ctx.lineTo(r.x + ex, ecgY);
          }
          ctx.stroke();
          break;
        }

        case 'spraying': {
          const spCfg = vfxCfg.spray;
          const sprayDuration = phaseCfg.spraying;
          const sprayProgress = 1 - progress / sprayDuration;

          // 4 diagonal mist sprays
          for (let mi = 0; mi < spCfg.mistDirs.length; mi++) {
            const baseAngle = spCfg.mistDirs[mi];
            const spread = healRange * sprayProgress;

            for (let bi = 0; bi < spCfg.blobCount; bi++) {
              const blobDist = (bi + 1) * spread * spCfg.blobDistRatio;
              const blobAngle = baseAngle + Math.sin(time * 2 + bi + mi) * spCfg.blobAngleWobble;
              const bx = r.x + Math.cos(blobAngle) * blobDist;
              const by = r.y + Math.sin(blobAngle) * blobDist * spCfg.blobYScale;
              const blobSize = (spCfg.blobBaseSize + bi * spCfg.blobSizeIncrement) * (1 - sprayProgress * spCfg.blobSizeFade);
              const blobAlpha = spCfg.blobAlphaBase * (1 - sprayProgress * spCfg.blobAlphaFade) * (1 - bi * spCfg.blobAlphaStepDecay);

              // Soft watercolor blob (cached normalized gradient)
              ctx.save();
              ctx.translate(bx, by);
              ctx.scale(blobSize, blobSize);
              ctx.globalAlpha = blobAlpha;
              ctx.fillStyle = NurseRenderer.getSprayBlobGradient(ctx);
              ctx.beginPath();
              // Irregular blob shape (reduced vertex count via larger step)
              for (let a = 0; a <= Math.PI * 2; a += spCfg.blobVertexStep) {
                const br = spCfg.blobRadiusBase + Math.sin(a * 3 + time + bi) * spCfg.blobRadiusAmp;
                const px = Math.cos(a) * br;
                const py = Math.sin(a) * br * spCfg.blobYScaleRatio;
                if (a === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
          }

          // ===== HEAL RANGE CIRCLE =====
          const footY = r.y + vfxCfg.footYOffset;
          const pulse = 1 + Math.sin(time * spCfg.ringPulseFreq) * spCfg.ringPulseAmp;
          const ringAlpha = spCfg.ringAlpha * pulse;

          // 1. Outer glow (cached normalized gradient)
          ctx.save();
          ctx.translate(r.x, footY);
          ctx.scale(healRange * 1.1, healRange * 0.4);
          ctx.globalAlpha = ringAlpha;
          ctx.fillStyle = NurseRenderer.getSprayRingGlowGradient(ctx);
          ctx.beginPath();
          ctx.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 2. Inner fill
          ctx.fillStyle = `rgba(90, 210, 130, ${ringAlpha * spCfg.ringFillAlpha})`;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.9, healRange * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();

          // 3. Main ring boundary
          ctx.strokeStyle = `rgba(100, 245, 150, ${ringAlpha * 0.85})`;
          ctx.lineWidth = spCfg.ringStrokeWidth;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.9, healRange * 0.32, 0, 0, Math.PI * 2);
          ctx.stroke();

          // 4. Inner dashed ring (save/restore to prevent dash leak)
          ctx.save();
          ctx.strokeStyle = `rgba(130, 255, 180, ${ringAlpha * spCfg.ringInnerAlpha})`;
          ctx.lineWidth = spCfg.ringInnerWidth;
          ctx.setLineDash(spCfg.ringInnerDash as unknown as number[]);
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.55, healRange * 0.2, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // 5. Rotating tick marks (precomputed trigonometry)
          const tickRot = time * spCfg.tickRotSpeed;
          const cosTR = Math.cos(tickRot);
          const sinTR = Math.sin(tickRot);

          for (let ti = 0; ti < tickData.length; ti++) {
            const td = tickData[ti];
            // 旋转预计算角度: cosA = cosTR*cosBase - sinTR*sinBase, sinA = sinTR*cosBase + cosTR*sinBase
            const cosA = cosTR * td.cos - sinTR * td.sin;
            const sinA = sinTR * td.cos + cosTR * td.sin;
            const tx = r.x + cosA * healRange * 0.9;
            const ty = footY + sinA * healRange * 0.32;
            const nx = -sinA;
            const ny = cosA;
            const halfLen = td.len * 0.5;

            ctx.strokeStyle = `rgba(160, 255, 200, ${ringAlpha * spCfg.tickAlpha})`;
            ctx.lineWidth = td.width;
            ctx.beginPath();
            ctx.moveTo(tx + nx * halfLen, ty + ny * halfLen);
            ctx.lineTo(tx - nx * halfLen, ty - ny * halfLen);
            ctx.stroke();
          }

          // 6. Crosshair lines
          ctx.strokeStyle = `rgba(140, 255, 180, ${ringAlpha * spCfg.crosshairAlpha})`;
          ctx.lineWidth = spCfg.crosshairWidth;
          ctx.beginPath();
          ctx.moveTo(r.x, footY - healRange * 0.32);
          ctx.lineTo(r.x, footY + healRange * 0.32);
          ctx.moveTo(r.x - healRange * 0.9, footY);
          ctx.lineTo(r.x + healRange * 0.9, footY);
          ctx.stroke();
          break;
        }

        case 'dissipating': {
          const dissCfg = vfxCfg.dissipate;
          const dissDuration = phaseCfg.dissipating;
          const dissProgress = progress / dissDuration;
          const fadeAlpha = dissProgress;
          const footY = r.y + vfxCfg.footYOffset;

          // Fading ring boundary
          ctx.strokeStyle = `rgba(100, 245, 150, ${fadeAlpha * dissCfg.ringAlpha})`;
          ctx.lineWidth = dissCfg.ringWidth;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.9 * fadeAlpha, healRange * 0.32 * fadeAlpha, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Fading inner glow (cached normalized gradient)
          ctx.save();
          ctx.translate(r.x, footY);
          ctx.scale(healRange * fadeAlpha, healRange * 0.35 * fadeAlpha);
          ctx.globalAlpha = fadeAlpha;
          ctx.fillStyle = NurseRenderer.getDissipateGlowGradient(ctx);
          ctx.beginPath();
          ctx.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Shrinking center dot
          ctx.fillStyle = `rgba(140, 255, 190, ${fadeAlpha * dissCfg.dotAlpha})`;
          ctx.beginPath();
          ctx.arc(r.x, footY, dissCfg.dotBaseSize * fadeAlpha, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
    ctx.restore();
  }
}