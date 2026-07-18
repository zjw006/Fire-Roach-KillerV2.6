/**
 * @fileoverview 护士蟑螂治疗特效渲染模块
 * @description 提供护士蟑螂 3 阶段治疗动画的静态渲染方法
 */

import { RoachType, RoachState } from '../../types';
import type { Roach } from '../../types';

/**
 * 护士蟑螂治疗特效渲染器
 * @description 纯静态渲染类，不维护内部状态
 */
export class NurseRenderer {

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
    ctx.save();
    for (const r of roaches) {
      if (r.type !== RoachType.NURSE || r.state !== RoachState.ALIVE) continue;
      if (!r.healPhase || r.healPhase === 'idle') continue;

      const healRange = 360;
      const progress = r.healPhaseTimer || 0;

      switch (r.healPhase) {
        case 'charging': {
          // Phase 1: Charge (1.0s) - expanding range circle at feet
          const chargeProgress = 1 - progress / 1.0;
          const alpha = 0.15 + chargeProgress * 0.35;
          const footY = r.y + 12;
          const expandScale = chargeProgress; // 0 -> 1 as charge completes

          // 1. Expanding outer ring (grows from center to full range)
          const ringR = healRange * 0.9 * expandScale;
          const ringRY = healRange * 0.32 * expandScale;

          // Glow that expands with the ring
          if (ringR > 5) {
            const glowGrad = ctx.createRadialGradient(r.x, footY, ringR * 0.3, r.x, footY, ringR * 1.2);
            glowGrad.addColorStop(0, `rgba(100, 240, 150, 0)`);
            glowGrad.addColorStop(0.85, `rgba(100, 240, 150, ${alpha * 0.2})`);
            glowGrad.addColorStop(1, `rgba(140, 255, 190, ${alpha * 0.4})`);
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.ellipse(r.x, footY, ringR * 1.2, ringRY * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Solid ring boundary
            ctx.strokeStyle = `rgba(120, 255, 170, ${alpha * 0.7})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(r.x, footY, ringR, ringRY, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Inner fill
            ctx.fillStyle = `rgba(100, 230, 150, ${alpha * 0.1})`;
            ctx.beginPath();
            ctx.ellipse(r.x, footY, ringR * 0.85, ringRY * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          // 2. Center pulse dot (nurse position)
          const dotPulse = 1 + Math.sin(time * 8) * 0.3;
          ctx.fillStyle = `rgba(140, 255, 190, ${alpha * 0.6})`;
          ctx.beginPath();
          ctx.arc(r.x, footY, 4 * dotPulse * expandScale, 0, Math.PI * 2);
          ctx.fill();

          // 3. ECG-like pulse line on the ground
          ctx.strokeStyle = `rgba(100, 230, 150, ${alpha * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let ex = -60; ex <= 60; ex += 2) {
            const ecgY = footY - 20 + Math.sin(ex * 0.3 + time * 12) * (ex % 20 < 5 ? 12 : 3);
            if (ex === -60) ctx.moveTo(r.x + ex, ecgY);
            else ctx.lineTo(r.x + ex, ecgY);
          }
          ctx.stroke();
          break;
        }

        case 'spraying': {
          // Phase 2: Spray (1.2s) - watercolor mist blobs
          const sprayProgress = 1 - progress / 1.2;
          // 4 diagonal mist sprays (4 directions)
          const mistDirs = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
          for (let mi = 0; mi < mistDirs.length; mi++) {
            const baseAngle = mistDirs[mi];
            const spread = healRange * sprayProgress;
            // 3 watercolor blobs per direction
            for (let bi = 0; bi < 3; bi++) {
              const blobDist = (bi + 1) * spread * 0.35;
              const blobAngle = baseAngle + Math.sin(time * 2 + bi + mi) * 0.15;
              const bx = r.x + Math.cos(blobAngle) * blobDist;
              const by = r.y + Math.sin(blobAngle) * blobDist * 0.5;
              const blobSize = (25 + bi * 12) * (1 - sprayProgress * 0.3);
              const blobAlpha = 0.25 * (1 - sprayProgress * 0.5) * (1 - bi * 0.15);
              // Soft watercolor radial gradient
              const grad = ctx.createRadialGradient(bx, by, 0, bx, by, blobSize);
              grad.addColorStop(0, `rgba(100, 148, 100, ${blobAlpha})`);
              grad.addColorStop(0.5, `rgba(90, 138, 90, ${blobAlpha * 0.5})`);
              grad.addColorStop(1, `rgba(80, 120, 80, 0)`);
              ctx.fillStyle = grad;
              ctx.beginPath();
              // Irregular blob shape
              for (let a = 0; a <= Math.PI * 2; a += 0.3) {
                const br = blobSize * (0.7 + Math.sin(a * 3 + time + bi) * 0.3);
                if (a === 0) ctx.moveTo(bx + Math.cos(a) * br, by + Math.sin(a) * br * 0.6);
                else ctx.lineTo(bx + Math.cos(a) * br, by + Math.sin(a) * br * 0.6);
              }
              ctx.closePath();
              ctx.fill();
            }
          }
          // ===== HEAL RANGE CIRCLE: clear green ring at nurse's feet =====
          const footY = r.y + 12; // slightly below center = feet position
          const pulse = 1 + Math.sin(time * 4) * 0.06;
          const ringAlpha = 0.5 * pulse;

          // 1. Outer glow (radial gradient)
          const glowGrad = ctx.createRadialGradient(r.x, footY, healRange * 0.5, r.x, footY, healRange * 1.1);
          glowGrad.addColorStop(0, `rgba(80, 220, 120, 0)`);
          glowGrad.addColorStop(0.8, `rgba(80, 220, 120, ${ringAlpha * 0.15})`);
          glowGrad.addColorStop(1, `rgba(120, 255, 170, ${ringAlpha * 0.35})`);
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 1.1, healRange * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();

          // 2. Inner fill (semi-transparent green)
          ctx.fillStyle = `rgba(90, 210, 130, ${ringAlpha * 0.12})`;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.9, healRange * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();

          // 3. Main ring boundary (bright green solid line)
          ctx.strokeStyle = `rgba(100, 245, 150, ${ringAlpha * 0.85})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.9, healRange * 0.32, 0, 0, Math.PI * 2);
          ctx.stroke();

          // 4. Inner ring (dashed feel)
          ctx.strokeStyle = `rgba(130, 255, 180, ${ringAlpha * 0.4})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 10]);
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.55, healRange * 0.2, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // 5. Rotating tick marks on the outer ring edge
          const tickCount = 12;
          const tickRot = time * 1.8;
          for (let ti = 0; ti < tickCount; ti++) {
            const a = tickRot + (ti / tickCount) * Math.PI * 2;
            const tx = r.x + Math.cos(a) * healRange * 0.9;
            const ty = footY + Math.sin(a) * healRange * 0.32;
            const tickLen = 5 + (ti % 3 === 0 ? 4 : 0); // every 3rd tick is longer
            const nx = -Math.sin(a); // normal vector
            const ny = Math.cos(a);
            ctx.strokeStyle = `rgba(160, 255, 200, ${ringAlpha * 0.7})`;
            ctx.lineWidth = ti % 3 === 0 ? 2.5 : 1.5;
            ctx.beginPath();
            ctx.moveTo(tx + nx * tickLen * 0.5, ty + ny * tickLen * 0.5);
            ctx.lineTo(tx - nx * tickLen * 0.5, ty - ny * tickLen * 0.5);
            ctx.stroke();
          }

          // 6. Crosshair lines (vertical + horizontal) to mark center
          ctx.strokeStyle = `rgba(140, 255, 180, ${ringAlpha * 0.25})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(r.x, footY - healRange * 0.32);
          ctx.lineTo(r.x, footY + healRange * 0.32);
          ctx.moveTo(r.x - healRange * 0.9, footY);
          ctx.lineTo(r.x + healRange * 0.9, footY);
          ctx.stroke();
          break;
        }

        case 'dissipating': {
          // Phase 3: Dissipate (1.0s) - fading ring at feet
          const dissProgress = progress / 1.0; // 1 -> 0 as it fades
          const fadeAlpha = dissProgress;
          const footY = r.y + 12;

          // Fading ring boundary
          ctx.strokeStyle = `rgba(100, 245, 150, ${fadeAlpha * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.9 * fadeAlpha, healRange * 0.32 * fadeAlpha, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Fading inner glow
          const glowGrad = ctx.createRadialGradient(r.x, footY, 0, r.x, footY, healRange * fadeAlpha);
          glowGrad.addColorStop(0, `rgba(90, 220, 130, ${fadeAlpha * 0.08})`);
          glowGrad.addColorStop(1, `rgba(90, 220, 130, 0)`);
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * fadeAlpha, healRange * 0.35 * fadeAlpha, 0, 0, Math.PI * 2);
          ctx.fill();

          // Shrinking center dot
          ctx.fillStyle = `rgba(140, 255, 190, ${fadeAlpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(r.x, footY, 3 * fadeAlpha, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
    ctx.restore();
  }
}