/**
 * @fileoverview 蟑螂渲染模块
 * @description 从 engine.ts 提取的 renderRoach 和 renderRoaches 静态方法，负责蟑螂实体的渲染
 */

import type { Roach, BossBattleState, Particle } from '../../types';
import { RoachType, RoachState, ParticleType } from '../../types';
import { ENEMY_DEFS, TEXT_CONFIG } from '../../data';

export interface RoachRendererConfig {
  // 图片资源
  roachImg: HTMLImageElement | null;
  roachFlyingImg: HTMLImageElement | null;
  roachSuicideImg: HTMLImageElement | null;
  roachTimedSuicideImg: HTMLImageElement | null;
  roachNurseImg: HTMLImageElement | null;
  roachMutantImg: HTMLImageElement | null;
  roachArmoredImg: HTMLImageElement | null;
  roachSplittingImg: HTMLImageElement | null;
  roachFlyingSuicideImg: HTMLImageElement | null;
  roachQueenImg: HTMLImageElement | null;
  nurseCastFrames: (HTMLImageElement | null)[];
  mutantTransformFrames: (HTMLImageElement | null)[];
  imagesLoaded: boolean;

  // 游戏状态
  time: number;
  deltaTime: number;

  // Boss 状态
  bossBattle: BossBattleState;
  bossAnimState: { action: string; frameIndex: number };
  bossAnimFrames: Map<string, (HTMLImageElement | undefined)[]>;

  // 回调（处理渲染时的副作用）
  onAddParticle: (particle: Particle) => void;
  onSpawnShockwaveRing: (x: number, y: number, count: number) => void;
  isStuckByBoard: (id: number) => boolean;
}

export class RoachRenderer {

  static renderRoaches(config: RoachRendererConfig, ctx: CanvasRenderingContext2D, roaches: Roach[]) {
    // ===== RENDER ORDER: normal roaches first, then charging BOSS on top =====
    // First pass: render all non-boss or non-charging roaches
    for (const r of roaches) {
      // Skip charging BOSS - will be rendered in second pass on top
      if (r.isBoss && r.type === RoachType.QUEEN && r.isCharging) continue;
      RoachRenderer.renderRoach(config, ctx, r);
    }
    // Second pass: render charging BOSS last (on top of all other roaches)
    for (const r of roaches) {
      if (r.isBoss && r.type === RoachType.QUEEN && r.isCharging) {
        RoachRenderer.renderRoach(config, ctx, r);
      }
    }

    // ===== HOSPITAL EXCLUSIVE: "ILLEGAL MEDICINE" NURSE AOE HEAL RENDER =====
    // Three-phase visual: charging → spraying → dissipating
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
          const dotPulse = 1 + Math.sin(config.time * 8) * 0.3;
          ctx.fillStyle = `rgba(140, 255, 190, ${alpha * 0.6})`;
          ctx.beginPath();
          ctx.arc(r.x, footY, 4 * dotPulse * expandScale, 0, Math.PI * 2);
          ctx.fill();

          // 3. ECG-like pulse line on the ground
          ctx.strokeStyle = `rgba(100, 230, 150, ${alpha * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let ex = -60; ex <= 60; ex += 2) {
            const ecgY = footY - 20 + Math.sin(ex * 0.3 + config.time * 12) * (ex % 20 < 5 ? 12 : 3);
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
              const blobAngle = baseAngle + Math.sin(config.time * 2 + bi + mi) * 0.15;
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
                const br = blobSize * (0.7 + Math.sin(a * 3 + config.time + bi) * 0.3);
                if (a === 0) ctx.moveTo(bx + Math.cos(a) * br, by + Math.sin(a) * br * 0.6);
                else ctx.lineTo(bx + Math.cos(a) * br, by + Math.sin(a) * br * 0.6);
              }
              ctx.closePath();
              ctx.fill();
            }
          }
          // ===== HEAL RANGE CIRCLE: clear green ring at nurse's feet =====
          const footY = r.y + 12; // slightly below center = feet position
          const pulse = 1 + Math.sin(config.time * 4) * 0.06;
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
          const tickRot = config.time * 1.8;
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

    ctx.restore();
  }

  static renderRoach(config: RoachRendererConfig, ctx: CanvasRenderingContext2D, r: Roach) {
    // Flying roach death (including flying suicide): disintegration and falling animation
    if ((r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) && r.state === RoachState.DEAD) {
      const alpha = Math.max(0, r.deathTimer / 2.0);
      ctx.globalAlpha = alpha;
      const def = ENEMY_DEFS[r.type];
      const size = def.size;
      const w = size * 1.2;
      const h = size;

      ctx.save();
      ctx.translate(r.x, r.y);
      // Spin while falling
      ctx.rotate(r.angle);

      if (config.roachFlyingImg && config.imagesLoaded) {
        ctx.drawImage(config.roachFlyingImg, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Disintegration overlay: fading cracks
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, -h * 0.2);
      ctx.lineTo(w * 0.1, h * 0.1);
      ctx.lineTo(-w * 0.1, h * 0.3);
      ctx.stroke();

      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    // ===== BOSS DEATH: use frame animation system =====
    if (r.state === RoachState.DEAD && r.isBoss && r.type === RoachType.QUEEN && config.bossBattle.bossKilled) {
      // Boss death: render die animation frames (controlled by deathAnimTimer / corpseStayTimer)
      const bossScale = 6;
      const def = ENEMY_DEFS[r.type];
      const size = def.size;
      const w = size * 1.2;
      const bossW = w * bossScale;
      const bossH = size * bossScale;

      ctx.save();
      ctx.translate(r.x, r.y);

      const action = config.bossAnimState.action;
      const frameIdx = config.bossAnimState.frameIndex;
      let frames = config.bossAnimFrames.get(action);
      // Fallback to idle if action has no frames
      if (!frames || frames.length === 0) {
        frames = config.bossAnimFrames.get('idle');
      }
      let animImg = frames?.[frameIdx];
      if (!animImg && frames) {
        animImg = frames.find(f => f !== undefined);
      }

      if (animImg) {
        ctx.drawImage(animImg, -bossW / 2, -bossH / 2, bossW, bossH);
      } else {
        // Fallback to static image
        if (config.roachQueenImg) ctx.drawImage(config.roachQueenImg, -bossW / 2, -bossH / 2, bossW, bossH);
      }
      ctx.restore();
      return;
    }

    // Normal roach death (non-boss): fade out as a dark circle
    // SKIP for MUTANT during transformation animation - render 7-frame sequence instead
    if (r.state === RoachState.DEAD && !(r.type === RoachType.MUTANT && r.transformFrame !== undefined && r.transformFrame < 7)) {
      const alpha = r.deathTimer / 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#222';
      ctx.beginPath();
      const deadSize = r.type === RoachType.LARGE ? 16 : 10;
      ctx.arc(r.x, r.y, deadSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x - 5, r.y - 3);
      ctx.lineTo(r.x + 3, r.y + 2);
      ctx.lineTo(r.x - 2, r.y + 6);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    const def = ENEMY_DEFS[r.type];
    const size = r.isBoss ? def.size : def.size * (0.9 + Math.sin(config.time * 3 + r.wobbleOffset) * 0.1);
    const w = size * 1.2;
    const h = size;

    ctx.save();
    ctx.translate(r.x, r.y);

    // ===== BOSS GROUND COMBAT: horizontal flip based on facing direction =====
    if (r.isBoss && r.type === RoachType.QUEEN && config.bossBattle.phase >= 2) {
      const faceScale = r.facingRight ? -1 : 1; // flip sprite to face walking direction
      ctx.scale(faceScale, 1);
    }

    // Damage flash - BOSS gets bright RED flash
    if (r.damageFlash > 0) {
      if (r.isBoss && r.type === RoachType.QUEEN) {
        // Strong red flash for BOSS
        ctx.filter = `brightness(${1 + r.damageFlash * 0.5}) saturate(2) hue-rotate(-30deg)`;
        // Additional red glow overlay
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(255, 0, 0, ${Math.min(0.6, r.damageFlash * 0.3)})`;
        const sz = r.size || 60;
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.filter = `brightness(${1 + r.damageFlash})`;
      }
    }

    // Stuck overlay (yellow tint for board-stuck roaches)
    if (config.isStuckByBoard(r.id)) {
      ctx.filter = 'brightness(1.3) sepia(0.5)';
    }

    // Suicide roach: black smoke when HP below 50%
    if ((r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) && r.hp < r.maxHp * 0.5) {
      const smokeIntensity = 1 - (r.hp / (r.maxHp * 0.5)); // 0→1 as HP drops from 50% to 0%
      if (Math.random() < smokeIntensity * 0.6) {
        config.onAddParticle({
          x: r.x + (Math.random() - 0.5) * (r.size || 30) * 0.8,
          y: r.y + (Math.random() - 0.5) * (r.size || 30) * 0.5,
          vx: (Math.random() - 0.5) * 15,
          vy: -20 - Math.random() * 25,
          life: 0.4 + Math.random() * 0.3,
          maxLife: 0.7,
          size: 3 + Math.random() * 5 * smokeIntensity,
          color: `rgba(30, 30, 30, ${0.5 + smokeIntensity * 0.4})`,
          type: ParticleType.ASH,
        });
      }
    }

    // Rotation: downward (vy>0) = 0°, upward (vy<=0) = 180°
    // Skip for BOSS — handled separately below with proper rotation
    // Nurse roach: never flip vertically (no reversal when hit by flame)
    if (r.vy <= 0 && !r.isBoss && r.type !== RoachType.NURSE) ctx.scale(1, -1);

    if (config.roachImg && config.imagesLoaded) {
      // Special handling for roaches with custom images
      if (r.type === RoachType.SUICIDE && config.roachSuicideImg) {
        ctx.drawImage(config.roachSuicideImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.TIMED_SUICIDE && config.roachTimedSuicideImg) {
        ctx.drawImage(config.roachTimedSuicideImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.NURSE) {
        // 10-frame casting animation during heal phases
        let castImg: HTMLImageElement | null = null;
        if (r.healPhase && r.healPhase !== 'idle' && r.state === RoachState.ALIVE) {
          // Map heal phase to cast frame index (0-9)
          let frameIdx = 0;
          const phase = r.healPhase;
          const timer = r.healPhaseTimer || 0;
          if (phase === 'charging') {
            // Phase 1: frames 0-3 (1.0s, each frame ~250ms)
            const progress = 1 - timer / 1.0;
            frameIdx = Math.min(3, Math.floor(progress * 4));
          } else if (phase === 'spraying') {
            // Phase 2: frames 4-6 loop (2.0s, cycle every 600ms)
            const cyclePos = (1 - timer / 2.0) % 0.5;
            if (cyclePos < 0.17) frameIdx = 4;
            else if (cyclePos < 0.34) frameIdx = 5;
            else frameIdx = 6;
          } else if (phase === 'dissipating') {
            // Phase 3: frames 7-9 (1.0s, each ~330ms)
            const progress = 1 - timer / 1.0;
            frameIdx = 7 + Math.min(2, Math.floor(progress * 3));
          }
          castImg = config.nurseCastFrames[frameIdx] || config.roachNurseImg;
        }
        const img = castImg || config.roachNurseImg;
        if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);

        // ===== NURSE HEAL: Green range circle under feet =====
        if (r.healPhase && r.healPhase !== 'idle' && r.state === RoachState.ALIVE) {
          const healRange = 150;
          const phase = r.healPhase;
          const timer = r.healPhaseTimer || 0;
          let ringAlpha = 0;
          let ringScale = 1;

          if (phase === 'charging') {
            const progress = 1 - timer / 1.0;
            ringAlpha = progress * 0.5;
            ringScale = 0.3 + progress * 0.7;
          } else if (phase === 'spraying') {
            const pulse = 1 + Math.sin(config.time * 4) * 0.08;
            ringAlpha = 0.45 * pulse;
            ringScale = 1;
          } else if (phase === 'dissipating') {
            const progress = 1 - timer / 1.0;
            ringAlpha = (1 - progress) * 0.3;
            ringScale = 1 + progress * 0.2;
          }

          // Outer glow ring
          const rangeR = healRange * ringScale;
          const grad = ctx.createRadialGradient(0, 0, rangeR * 0.6, 0, 0, rangeR);
          grad.addColorStop(0, `rgba(80, 200, 100, 0)`);
          grad.addColorStop(0.7, `rgba(80, 200, 100, ${ringAlpha * 0.25})`);
          grad.addColorStop(0.9, `rgba(100, 230, 130, ${ringAlpha * 0.5})`);
          grad.addColorStop(1, `rgba(120, 255, 150, ${ringAlpha * 0.15})`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(0, h * 0.1, rangeR, rangeR * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();

          // Sharp ring outline
          ctx.strokeStyle = `rgba(100, 240, 140, ${ringAlpha * 0.7})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(0, h * 0.1, rangeR * 0.85, rangeR * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Inner filled area
          ctx.fillStyle = `rgba(90, 210, 120, ${ringAlpha * 0.12})`;
          ctx.beginPath();
          ctx.ellipse(0, h * 0.1, rangeR * 0.5, rangeR * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();

          // Rotating dash marks on the ring edge
          const dashCount = 8;
          const dashAngle = config.time * 1.5;
          for (let di = 0; di < dashCount; di++) {
            const a = dashAngle + (di / dashCount) * Math.PI * 2;
            const dashX = Math.cos(a) * rangeR * 0.85;
            const dashY = Math.sin(a) * rangeR * 0.3 + h * 0.1;
            const dashLen = 6 + Math.sin(config.time * 3 + di) * 2;
            ctx.strokeStyle = `rgba(140, 255, 170, ${ringAlpha * 0.6})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dashX - Math.cos(a) * dashLen * 0.5, dashY - Math.sin(a) * dashLen * 0.15);
            ctx.lineTo(dashX + Math.cos(a) * dashLen * 0.5, dashY + Math.sin(a) * dashLen * 0.15);
            ctx.stroke();
          }
        }
      } else if (r.type === RoachType.MUTANT) {
        // 7-frame transformation animation support (per-roach state)
        let img: HTMLImageElement | null = null;
        if (r.transformFrame !== undefined && r.transformFrame < 7 && r.state === RoachState.DEAD) {
          // 7-frame transformation animation (200ms each) - scaled 1.3x for visibility
          const frameImg = config.mutantTransformFrames[r.transformFrame];
          if (frameImg) {
            img = frameImg;
          } else if (config.roachMutantImg) {
            img = config.roachMutantImg; // fallback
          }
          // Apply 1.3x scale during transformation
          const scale = 1.3;
          ctx.scale(scale, scale);
        } else if (config.roachMutantImg) {
          img = config.roachMutantImg; // Normal render
        }
        if (img) {
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }
      } else if (r.type === RoachType.FLYING && config.roachFlyingImg) {
        ctx.drawImage(config.roachFlyingImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.FLYING_SUICIDE && config.roachFlyingSuicideImg) {
        ctx.drawImage(config.roachFlyingSuicideImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.ARMORED && config.roachArmoredImg) {
        // ARMORED roach: show armored image when armor intact, normal when broken
        const isArmorBroken = r.armorHp <= 0;
        if (isArmorBroken && config.roachImg) {
          ctx.drawImage(config.roachImg, -w / 2, -h / 2, w, h);
        } else {
          ctx.drawImage(config.roachArmoredImg, -w / 2, -h / 2, w, h);
        }
      } else if (r.type === RoachType.SPLITTING && config.roachSplittingImg) {
        ctx.drawImage(config.roachSplittingImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.QUEEN && config.roachQueenImg) {
        // ===== BOSS RENDERING: scale 3x + face downward =====
        // Boss images are already rotated 180° (head downward)
        // Just draw at 3x size, no additional flip needed
        const bossScale = 6;
        const bossW = w * bossScale;
        const bossH = h * bossScale;

        // Use frame animation system with fallback for missing frames
        if (r.isBoss && config.bossBattle.active) {
          const action = config.bossAnimState.action;
          const frameIdx = config.bossAnimState.frameIndex;
          let frames = config.bossAnimFrames.get(action);
          // If action has no frames, fallback to idle
          if (!frames || frames.length === 0) {
            frames = config.bossAnimFrames.get('idle');
          }
          // Try current frame first, then fallback to any loaded frame
          let animImg = frames?.[frameIdx];
          if (!animImg && frames) {
            animImg = frames.find(f => f !== undefined);
          }
          
          if (animImg) {
            // ===== CODE-DRIVEN ANIMATION EFFECTS per action =====
            const t = config.time;
            const action = config.bossAnimState.action;
            ctx.save();

            switch (action) {
              case 'idle': {
                // Ground idle: breathing scale pulse + micro sway
                const breathe = 1 + Math.sin(t * 2.5) * 0.03;
                const swayX = Math.sin(t * 1.2 + r.wobbleOffset) * 3;
                const swayY = Math.sin(t * 2.0 + r.wobbleOffset) * 2;
                ctx.translate(swayX, swayY);
                ctx.scale(breathe, breathe);
                break;
              }
              case 'hover': {
                // Air hover: floating up/down + gentle rock
                const floatY = Math.sin(t * 1.8 + r.wobbleOffset) * 8;
                const rock = Math.sin(t * 0.7 + r.wobbleOffset) * 0.03;
                const wingVibe = 1 + Math.sin(t * 20) * 0.01; // fast wing flutter
                ctx.translate(0, floatY);
                ctx.rotate(rock);
                ctx.scale(wingVibe, wingVibe);
                break;
              }
              case 'walk': {
                // Ground walk: body bob + stride bounce + lean into movement
                const bobY = Math.abs(Math.sin(t * 6 + r.wobbleOffset)) * (-6);
                const lean = (r.vx ?? 0) * 0.002;
                ctx.translate(0, bobY);
                ctx.rotate(Math.max(-0.08, Math.min(0.08, lean)));
                // Footstep dust effect
                if (Math.sin(t * 6) > 0.85) {
                  config.onAddParticle({
                    x: r.x + (Math.random() - 0.5) * 30,
                    y: r.y + bossH * 0.4,
                    vx: (Math.random() - 0.5) * 20,
                    vy: -10 - Math.random() * 15,
                    life: 0.3, maxLife: 0.3,
                    size: 3 + Math.random() * 4,
                    color: 'rgba(180, 160, 140, 0.4)',
                    type: ParticleType.ASH,
                  });
                }
                break;
              }
              case 'charge': {
                // Charging: aggressive forward lean + vibration + speed lines
                const phase2Lean = 0;
                const vibration = Math.sin(t * 50) * 2;
                const chargePulse = 1 + Math.sin(t * 8) * 0.04;
                ctx.translate(vibration, Math.abs(vibration) * 0.5);
                ctx.rotate(phase2Lean);
                ctx.scale(chargePulse, chargePulse);
                // Speed trail particles
                if (Math.random() < 0.4) {
                  config.onAddParticle({
                    x: r.x + (Math.random() - 0.5) * 40,
                    y: r.y - bossH * 0.3 + (Math.random() - 0.5) * 20,
                    vx: (Math.random() - 0.5) * 10,
                    vy: -80 - Math.random() * 60,
                    life: 0.25, maxLife: 0.25,
                    size: 2 + Math.random() * 3,
                    color: 'rgba(255, 100, 50, 0.6)',
                    type: ParticleType.SPARK,
                  });
                }
                break;
              }
              case 'summon': {
                // Summoning: energy pulse + shake + purple glow rings
                const pulse = 1 + Math.sin(t * 10) * 0.06;
                const shakeX = Math.sin(t * 30) * 2;
                const shakeY = Math.cos(t * 25) * 2;
                ctx.translate(shakeX, shakeY);
                ctx.scale(pulse, pulse);
                // Periodic energy ring
                if (Math.sin(t * 4) > 0.95) {
                  config.onSpawnShockwaveRing(r.x, r.y, 8);
                }
                break;
              }
              case 'stun': {
                // Stunned: dizzy wobble + stars circling
                const wobble = Math.sin(t * 8) * 0.08;
                const dizzyX = Math.sin(t * 5) * 5;
                ctx.translate(dizzyX, 0);
                ctx.rotate(wobble);
                // Dizzy stars
                for (let si = 0; si < 3; si++) {
                  const starAngle = t * 3 + (si / 3) * Math.PI * 2;
                  const starRadius = 50 + si * 15;
                  config.onAddParticle({
                    x: r.x + Math.cos(starAngle) * starRadius,
                    y: r.y - 60 + Math.sin(starAngle) * starRadius * 0.3,
                    vx: 0, vy: -20,
                    life: 0.15, maxLife: 0.15,
                    size: 6,
                    color: si % 2 === 0 ? '#facc15' : '#ffffff',
                    type: ParticleType.SPARK,
                  });
                }
                break;
              }
              case 'hurt': {
                // Hurt: red flash + pained shake
                const hurtShake = Math.sin(t * 15) * 3;
                const hurtPulse = 1 + Math.sin(t * 5) * 0.02;
                ctx.translate(hurtShake, 0);
                ctx.scale(hurtPulse, hurtPulse);
                // Red tint overlay
                ctx.filter = 'brightness(1.3) saturate(1.5)';
                break;
              }
              case 'die': {
                // Death: shrink + fade + tilt collapse
                const dieProgress = 1 - (config.bossBattle.deathAnimTimer / 1.75); // 0→1 over death
                const shrink = Math.max(0.3, 1 - dieProgress * 0.7);
                const tilt = dieProgress * 0.3; // collapse to side
                const sinkY = dieProgress * 30; // sink down
                ctx.translate(0, sinkY);
                ctx.rotate(tilt * (Math.random() < 0.5 ? 1 : -1));
                ctx.scale(shrink, shrink);
                ctx.globalAlpha = Math.max(0.2, 1 - dieProgress * 0.5);
                break;
              }
              default: {
                // Default: gentle breathing
                const breathe = 1 + Math.sin(t * 2) * 0.02;
                ctx.scale(breathe, breathe);
              }
            }

            // Draw the frame
            ctx.drawImage(animImg, -bossW / 2, -bossH / 2, bossW, bossH);

            // Restore context after action-specific transforms
            ctx.restore();

            // Draw action-specific overlays (outside save/restore)
            if (action === 'charge') {
              // Red glow overlay for charging
              const glowAlpha = 0.15 + Math.sin(t * 6) * 0.1;
              ctx.fillStyle = `rgba(255, 60, 0, ${glowAlpha})`;
              ctx.beginPath();
              ctx.ellipse(0, bossH * 0.1, bossW * 0.55, bossH * 0.45, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            if (action === 'summon') {
              // Purple summon glow
              const glowAlpha = 0.1 + Math.sin(t * 5) * 0.08;
              ctx.fillStyle = `rgba(168, 85, 247, ${glowAlpha})`;
              ctx.beginPath();
              ctx.ellipse(0, 0, bossW * 0.6, bossH * 0.5, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Fallback: use static image
            if (config.roachQueenImg) ctx.drawImage(config.roachQueenImg, -bossW / 2, -bossH / 2, bossW, bossH);
          }
        } else {
          // Normal QUEEN (not boss)
          ctx.drawImage(config.roachQueenImg, -w / 2, -h / 2, w, h);
        }
      } else {
        ctx.drawImage(config.roachImg, -w / 2, -h / 2, w, h);
      }
    } else {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ===== HOSPITAL EXCLUSIVE: MUTANT TRANSFORMATION VISUAL =====
    // Purple swirling glow during the 0.5s pre-transformation pause
    if (r.type === RoachType.MUTANT && r.transformTimer && r.transformTimer > 0) {
      const progress = 1 - r.transformTimer / 1.0; // 0→1
      const swirlAlpha = 0.4 + progress * 0.4;
      const swirlR = Math.max(w, h) * (0.8 + progress * 0.6);
      // Outer purple ring
      ctx.save();
      ctx.strokeStyle = `rgba(217, 70, 239, ${swirlAlpha})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = `rgba(217, 70, 239, ${swirlAlpha * 0.8})`;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      for (let si = 0; si < 8; si++) {
        const sAngle = (si / 8) * Math.PI * 2 + config.time * 6 + progress * Math.PI;
        const sx = Math.cos(sAngle) * swirlR;
        const sy = Math.sin(sAngle) * swirlR * 0.7;
        if (si === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner glow
      const glowGrad = ctx.createRadialGradient(0, 0, swirlR * 0.2, 0, 0, swirlR);
      glowGrad.addColorStop(0, `rgba(217, 70, 239, ${swirlAlpha * 0.15})`);
      glowGrad.addColorStop(1, `rgba(217, 70, 239, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fill();
      // Countdown text
      const secsLeft = Math.ceil(r.transformTimer!);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + progress * 0.2})`;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TEXT_CONFIG.combat.transformCountdown(secsLeft), 0, -swirlR - 10);
      ctx.restore();
    }

    // ===== MUTANT SPAWN: Green slime tint overlay (2s) =====
    if (r.wasMutantSpawn && r.slimeTimer && r.slimeTimer > 0 && r.state === RoachState.ALIVE) {
      const slimeProgress = Math.min(1, r.slimeTimer / 2.0);
      const slimeAlpha = 0.6 * slimeProgress;

      // 1. Bright green glow behind the roach
      const glowR = Math.max(w, h) * 0.6;
      const glowGrad = ctx.createRadialGradient(0, 0, glowR * 0.3, 0, 0, glowR);
      glowGrad.addColorStop(0, `rgba(100, 255, 120, ${slimeAlpha * 0.3})`);
      glowGrad.addColorStop(0.7, `rgba(60, 200, 80, ${slimeAlpha * 0.5})`);
      glowGrad.addColorStop(1, `rgba(40, 150, 60, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, glowR, glowR * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Green slime overlay on roach body
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.5, h * 0.42, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = `rgba(80, 200, 80, ${slimeAlpha * 0.5})`;
      ctx.fillRect(-w, -h, w * 2, h * 2);
      ctx.restore();

      // 3. Outer slime ring (dripping effect)
      ctx.strokeStyle = `rgba(100, 255, 130, ${slimeAlpha * 0.7})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.52, h * 0.44, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 4. Highlight spots (wet slime look)
      const spotCount = 3;
      for (let si = 0; si < spotCount; si++) {
        const spotAngle = config.time * 1.5 + si * 2.1 + r.id;
        const spotDist = w * 0.25 * Math.sin(si * 1.3 + 0.5);
        const spotX = Math.cos(spotAngle) * spotDist;
        const spotY = Math.sin(spotAngle) * spotDist * 0.7;
        const spotR = 3 + Math.sin(config.time * 3 + si) * 1.5;
        ctx.fillStyle = `rgba(160, 255, 170, ${slimeAlpha * 0.6})`;
        ctx.beginPath();
        ctx.ellipse(spotX, spotY, spotR, spotR * 0.6, spotAngle * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      r.slimeTimer -= config.deltaTime;
    }

    // Sticky drop wrap overlay (yellow gel blob enclosing the roach)
    if (r.wrappedByDropId !== null && r.state === RoachState.ALIVE) {
      const wrapPulse = 0.85 + Math.sin(config.time * 6 + r.id) * 0.15;
      const wrapRadius = Math.max(w, h) * 0.55 * wrapPulse;

      // Outer glow
      const glowGrad = ctx.createRadialGradient(0, 0, wrapRadius * 0.5, 0, 0, wrapRadius * 1.3);
      glowGrad.addColorStop(0, 'rgba(250, 220, 50, 0.15)');
      glowGrad.addColorStop(0.6, 'rgba(250, 200, 50, 0.25)');
      glowGrad.addColorStop(1, 'rgba(250, 180, 30, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, wrapRadius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Main gel body - semi-transparent yellow blob
      ctx.fillStyle = `rgba(250, 220, 50, ${0.35 * wrapPulse})`;
      ctx.beginPath();
      // Create an organic blob shape using multiple arcs
      const blobPoints = 8;
      for (let b = 0; b <= blobPoints; b++) {
        const angle = (Math.PI * 2 / blobPoints) * b;
        const wobble = wrapRadius * (0.9 + Math.sin(config.time * 4 + b * 2 + r.id) * 0.1);
        const bx = Math.cos(angle) * wobble;
        const by = Math.sin(angle) * wobble;
        if (b === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fill();

      // Gel border highlight
      ctx.strokeStyle = `rgba(255, 240, 150, ${0.5 * wrapPulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let b = 0; b <= blobPoints; b++) {
        const angle = (Math.PI * 2 / blobPoints) * b;
        const wobble = wrapRadius * (0.88 + Math.sin(config.time * 4 + b * 2 + r.id) * 0.08);
        const bx = Math.cos(angle) * wobble;
        const by = Math.sin(angle) * wobble;
        if (b === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.stroke();

      // Specular highlight (shiny spot on top)
      ctx.fillStyle = `rgba(255, 255, 220, ${0.4 * wrapPulse})`;
      ctx.beginPath();
      ctx.ellipse(-wrapRadius * 0.2, -wrapRadius * 0.25, wrapRadius * 0.25, wrapRadius * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Small bubbles inside the gel
      for (let b = 0; b < 3; b++) {
        const bubbleAngle = config.time * 2 + b * 2.1 + r.id;
        const bubbleR = wrapRadius * (0.3 + 0.4 * Math.sin(b * 1.7));
        const bubbleX = Math.cos(bubbleAngle) * bubbleR;
        const bubbleY = Math.sin(bubbleAngle) * bubbleR;
        ctx.fillStyle = `rgba(255, 250, 200, ${0.3 + Math.sin(config.time * 3 + b) * 0.15})`;
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, 1.5 + Math.sin(config.time * 4 + b) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Suicide roach: small flame on back
    if (r.type === RoachType.SUICIDE && r.state === RoachState.ALIVE) {
      const flameFlicker = 0.7 + Math.sin(config.time * 10 + r.id) * 0.3;
      const flameH = 8 + Math.sin(config.time * 15 + r.id * 2) * 3;
      const flameW = 6 + Math.cos(config.time * 12 + r.id) * 2;
      // Outer flame (orange)
      ctx.fillStyle = `rgba(255, 100, 20, ${flameFlicker})`;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.45);
      ctx.lineTo(-flameW / 2, -h * 0.45 - flameH * 0.6);
      ctx.lineTo(0, -h * 0.45 - flameH);
      ctx.lineTo(flameW / 2, -h * 0.45 - flameH * 0.6);
      ctx.closePath();
      ctx.fill();
      // Inner flame (yellow)
      ctx.fillStyle = `rgba(255, 220, 50, ${flameFlicker * 0.9})`;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.45);
      ctx.lineTo(-flameW * 0.3, -h * 0.45 - flameH * 0.4);
      ctx.lineTo(0, -h * 0.45 - flameH * 0.75);
      ctx.lineTo(flameW * 0.3, -h * 0.45 - flameH * 0.4);
      ctx.closePath();
      ctx.fill();
    }

    // ===== ARMOR SHIELD EFFECT: all roaches with armor buff =====
    // Drawn INSIDE the transform block so shield follows the roach
    if (r.armorHp > 0) {
      const shieldPulse = 0.3 + Math.sin(config.time * 4 + r.id) * 0.15;
      const shieldAlpha = shieldPulse;
      // Outer hexagonal shield
      ctx.save();
      ctx.strokeStyle = `rgba(100, 200, 255, ${shieldAlpha})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `rgba(100, 200, 255, ${shieldAlpha * 0.5})`;
      ctx.shadowBlur = 10;
      const shieldR = Math.max(w, h) * 0.65;
      ctx.beginPath();
      for (let si = 0; si < 6; si++) {
        const sAngle = (si / 6) * Math.PI * 2 + config.time * 0.5;
        const sx = Math.cos(sAngle) * shieldR;
        const sy = Math.sin(sAngle) * shieldR;
        if (si === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner glow
      const glowGrad = ctx.createRadialGradient(0, 0, shieldR * 0.3, 0, 0, shieldR);
      glowGrad.addColorStop(0, `rgba(100, 200, 255, ${shieldAlpha * 0.1})`);
      glowGrad.addColorStop(1, `rgba(100, 200, 255, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();
    }

    // ===== HOSPITAL EXCLUSIVE: TIMED SUICIDE ARMOR VISUAL ONLY =====
    // Armor visual (orange for timed suicide only, nurse has no armor visual)
    if (r.type === RoachType.TIMED_SUICIDE && r.armorHp && r.armorHp > 0) {
      const armorPulse = 0.35 + Math.sin(config.time * 4 + r.id) * 0.15;
      const armorAlpha = armorPulse;
      ctx.save();
      const armorColor = '255, 165, 0'; // Orange for timed suicide
      ctx.strokeStyle = `rgba(${armorColor}, ${armorAlpha})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = `rgba(${armorColor}, ${armorAlpha * 0.6})`;
      ctx.shadowBlur = 12;
      const armorR = Math.max(w, h) * 0.7;
      ctx.beginPath();
      for (let si = 0; si < 6; si++) {
        const sAngle = (si / 6) * Math.PI * 2 + config.time * 0.5;
        const sx = Math.cos(sAngle) * armorR;
        const sy = Math.sin(sAngle) * armorR;
        if (si === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner glow
      const glowGrad = ctx.createRadialGradient(0, 0, armorR * 0.3, 0, 0, armorR);
      glowGrad.addColorStop(0, `rgba(${armorColor}, ${armorAlpha * 0.12})`);
      glowGrad.addColorStop(1, `rgba(${armorColor}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();
    }

    // ===== TIMED SUICIDE: "螂家爆破" VISUAL OVERLAY =====
    // Rendered INSIDE transform block so effects follow the roach
    if (r.type === RoachType.TIMED_SUICIDE && r.breachPhase && r.breachPhase !== 'idle' && r.breachPhase !== 'residue') {
      const phase = r.breachPhase;
      const phaseTimer = r.breachPhaseTimer || 0;

      if (phase === 'warning') {
        // Phase 1: Danger warning
        // Red blinking light on back (3Hz rapid flash)
        const blink = Math.sin(config.time * 18) > 0 ? 1 : 0.3;
        ctx.fillStyle = `rgba(180, 40, 40, ${blink})`;
        ctx.beginPath();
        ctx.arc(0, -h * 0.35, 5, 0, Math.PI * 2);
        ctx.fill();
        // Danger circle on ground (40px radius, irregular, 60% alpha)
        ctx.save();
        ctx.translate(0, h * 0.4);
        ctx.strokeStyle = `rgba(140, 30, 30, 0.6)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 4]);
        ctx.lineDashOffset = -config.time * 20;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += 0.3) {
          const rough = 1 + Math.sin(a * 5 + r.id) * 0.12;
          const rx = Math.cos(a) * 40 * rough;
          const ry = Math.sin(a) * 20 * rough;
          if (a === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Countdown number (dark red, slight jitter)
        const jitterX = Math.sin(config.time * 50) * 0.8;
        const jitterY = Math.cos(config.time * 45) * 0.6;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8b2020';
        ctx.fillText(`${Math.ceil(3.0 - (0.5 - phaseTimer) / 0.5 * 3)}`, jitterX, -h * 0.6 + jitterY);
      }

      if (phase === 'crouching') {
        // Phase 2: Crouching + countdown

        // Body squashed 30% (simulate crouching)
        ctx.scale(1.3, 0.7);

        // Red blinking light on back (3Hz rapid)
        const blink = Math.sin(config.time * 18) > 0 ? 1 : 0.2;
        ctx.fillStyle = `rgba(200, 30, 30, ${blink})`;
        ctx.beginPath();
        ctx.arc(0, -h * 0.25, 6, 0, Math.PI * 2);
        ctx.fill();

        // Crack lines spreading from center (dark red, hand-drawn feel)
        const crackR = r.crackRadius || 0;
        if (crackR > 0) {
          ctx.save();
          ctx.translate(0, h * 0.45);
          ctx.strokeStyle = `rgba(120, 40, 40, 0.5)`;
          ctx.lineWidth = 1.5;
          for (let ci = 0; ci < 5; ci++) {
            const cAngle = (ci / 5) * Math.PI * 2 + r.id * 0.7;
            const len = crackR * (0.5 + Math.sin(ci * 2.3) * 0.3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const steps = 4;
            for (let s = 1; s <= steps; s++) {
              const sx = Math.cos(cAngle + s * 0.1) * (len * s / steps);
              const sy = Math.sin(cAngle + s * 0.1) * (len * s / steps * 0.5);
              ctx.lineTo(sx, sy);
            }
            ctx.stroke();
          }
          ctx.restore();
        }

        // Body tremor (2px, 3Hz)
        const tremor = Math.sin(config.time * 18) * 2;
        ctx.translate(0, tremor);

        // Enlarged countdown number (150%, dark red锯齿描边)
        const secs = Math.ceil(r.placeTimer || 0);
        ctx.save();
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Dark red锯齿描边
        ctx.strokeStyle = '#8b2020';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'miter';
        ctx.strokeText(`${secs}`, 0, -h * 0.8);
        ctx.fillStyle = secs <= 1 ? '#8b2020' : '#a05030';
        ctx.fillText(`${secs}`, 0, -h * 0.8);
        ctx.restore();
      }

      if (phase === 'exploding') {
        // Phase 3: Explosion frame - dark red silhouette expanded to 120%
        const expandProgress = Math.min(1, phaseTimer / 0.1);
        const scale = 1.0 + (1.2 - 1.0) * (1 - expandProgress);
        ctx.scale(scale, scale);
        // Dark red silhouette overlay
        ctx.fillStyle = `rgba(100, 20, 20, ${0.8 * (1 - expandProgress)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.5, h * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.filter = 'none';
    ctx.restore();

    // ===== TIMED SUICIDE: "螂家爆破" RESIDUE RENDER =====
    // Rendered OUTSIDE transform (world coordinates) for ground scorch marks
    if (r.type === RoachType.TIMED_SUICIDE && r.breachPhase === 'residue' && r.residueTimer && r.residueTimer > 0) {
      const fadeAlpha = r.residueTimer / 3.0;
      ctx.save();
      ctx.translate(r.x, r.y);
      // Dark scorch mark (80x80, irregular edges like burnt paper)
      ctx.fillStyle = `rgba(25, 18, 15, ${0.7 * fadeAlpha})`;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.25) {
        const rough = 1 + Math.sin(a * 4 + r.id * 2) * 0.2;
        const sr = 40 * rough;
        const sx = Math.cos(a) * sr;
        const sy = Math.sin(a) * sr * 0.6;
        if (a === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      // 1-2 tiny gear/spring fragments
      ctx.fillStyle = `rgba(60, 55, 55, ${0.5 * fadeAlpha})`;
      ctx.fillRect(-8, 2, 6, 3);
      ctx.fillRect(5, -3, 4, 4);
      // Thin smoke rising
      if (r.residueTimer > 1.5) {
        const smokeAlpha = (r.residueTimer - 1.5) / 1.5 * 0.3;
        ctx.fillStyle = `rgba(80, 75, 75, ${smokeAlpha})`;
        ctx.beginPath();
        ctx.ellipse(0, -30 - (3.0 - r.residueTimer) * 15, 4, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ===== HP bar + Armor bar: show for ALL roaches that have armor buff =====
    const barW = r.isBoss ? 60 : Math.max(32, (r.size ?? 30) * 0.5);
    const barH = r.isBoss ? 8 : 5;
    // Always show HP bar for armored/shielded roaches, large/boss roaches
    const showHpBar = r.armorHp > 0 || r.isBoss || r.type === RoachType.SMALL || r.type === RoachType.LARGE || r.type === RoachType.ARMORED || r.type === RoachType.SPLITTING || r.type === RoachType.NURSE || r.type === RoachType.TIMED_SUICIDE;
    if (showHpBar) {
      const hpRatio = Math.max(0, r.hp / r.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(r.x - barW / 2, r.y - size - 15, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.2 ? '#eab308' : '#ef4444';
      ctx.fillRect(r.x - barW / 2, r.y - size - 15, barW * hpRatio, barH);
    }

    // ===== HOSPITAL EXCLUSIVE: TIMED SUICIDE ARMOR BAR ONLY =====
    if (r.type === RoachType.TIMED_SUICIDE && r.armorHp && r.armorHp > 0) {
      const armorRatio = Math.max(0, r.armorHp / r.maxArmorHp!);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(r.x - barW / 2, r.y - size - 31, barW, 4);
      const armorGrad = ctx.createLinearGradient(r.x - barW / 2, 0, r.x + barW / 2, 0);
      armorGrad.addColorStop(0, '#fbbf24');
      armorGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = armorGrad;
      ctx.fillRect(r.x - barW / 2, r.y - size - 31, barW * armorRatio, 4);
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x - barW / 2, r.y - size - 31, barW, 4);
    }

    // ===== ARMOR BUFF BAR: show for ALL roach types with armor =====
    if (r.armorHp > 0) {
      const armorRatio = Math.max(0, r.armorHp / r.maxArmorHp);
      // Armor bar background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(r.x - barW / 2, r.y - size - 23, barW, 4);
      // Armor fill (blue gradient)
      const armorGrad = ctx.createLinearGradient(r.x - barW / 2, 0, r.x + barW / 2, 0);
      armorGrad.addColorStop(0, '#60a5fa');
      armorGrad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = armorGrad;
      ctx.fillRect(r.x - barW / 2, r.y - size - 23, barW * armorRatio, 4);
      // Armor border
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x - barW / 2, r.y - size - 23, barW, 4);
    }

    // Flying indicator (including flying suicide)
    if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(r.wingPhase) * 0.2;
      ctx.strokeStyle = '#88ccff';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Enrage indicator
    if (r.isEnraged) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 6, 0, Math.PI * 2);
      ctx.stroke();
      const pulse = (Math.sin(config.time * 12) + 1) * 0.5;
      ctx.strokeStyle = `rgba(239, 68, 68, ${pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 6 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Stun effect
    if (r.isStunned) {
      const stunPulse = (Math.sin(config.time * 8) + 1) * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(150, 220, 255, ${0.5 + stunPulse * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(250, 200, 50, 0.8)';
      ctx.shadowBlur = 6;
      for (let i = 0; i < 3; i++) {
        const sx = r.x + (Math.random() - 0.5) * size * 2;
        const sy = r.y - size * 0.5 + (Math.random() - 0.5) * size;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - size * 0.3);
        for (let j = 0; j < 3; j++) {
          ctx.lineTo(sx + (Math.random() - 0.5) * 8, sy + j * 4);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.fillStyle = `rgba(250, 200, 50, ${0.15 + stunPulse * 0.1})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Poison indicator
    if (r.poisonTimer > 0) {
      ctx.fillStyle = `rgba(150, 100, 255, ${0.3 + Math.sin(config.time * 4) * 0.2})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Suicide fuse
    if (r.isFused) {
      const fusePulse = (Math.sin(config.time * 20) + 1) * 0.5;
      ctx.fillStyle = `rgba(255, 60, 0, ${0.5 + fusePulse * 0.5})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y - size - 5, 4 + fusePulse * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss name
    if (r.isBoss) {
      ctx.fillStyle = '#ff44aa';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(TEXT_CONFIG.combat.roachQueen, r.x, r.y - size - 25);
    }
  }
}