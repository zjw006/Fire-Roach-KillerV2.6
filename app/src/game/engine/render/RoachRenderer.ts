/**
 * @fileoverview 蟑螂渲染模块
 * @description 从 engine.ts 提取的 renderRoach 和 renderRoaches 静态方法，负责蟑螂实体的渲染
 */

import type { Roach, BossBattleState, Particle } from '../../types';
import { RoachType, RoachState, ParticleType } from '../../types';
import { ENEMY_DEFS, TEXT_CONFIG, RENDER_COLOR, RENDER_FONT, BALANCE_CONFIG } from '../../data';

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
  /** 地铁场景：隧道工贴图 */
  roachTunnelWorkerImg: HTMLImageElement | null;
  /** 地铁场景：地铁精英贴图（独立贴图 roach_subway_elite.png） */
  roachSubwayEliteImg: HTMLImageElement | null;
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
    // ===== RENDER ORDER: sort by z-index (charging BOSS last) for single-pass rendering =====
    // Charging BOSS renders on top of all other roaches
    const sorted = [...roaches].sort((a, b) => {
      const aTop = a.isBoss && a.type === RoachType.QUEEN && a.isCharging ? 1 : 0;
      const bTop = b.isBoss && b.type === RoachType.QUEEN && b.isCharging ? 1 : 0;
      return aTop - bTop;
    });
    for (const r of sorted) {
      RoachRenderer.renderRoach(config, ctx, r);
    }
  }

  /**
   * Render death states for a roach. Returns true if the roach was rendered as dead.
   */
  private static renderRoachDeath(config: RoachRendererConfig, ctx: CanvasRenderingContext2D, r: Roach): boolean {
    // Flying roach death (including flying suicide): disintegration and falling animation
    if ((r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) && r.state === RoachState.DEAD) {
      const alpha = Math.max(0, r.deathTimer / BALANCE_CONFIG.render.roach.flyingDeathFadeDuration);
      ctx.globalAlpha = alpha;
      const def = ENEMY_DEFS[r.type];
      const size = def.size;
      const w = size * BALANCE_CONFIG.render.roach.bodyWidthRatio;
      const h = size;

      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);

      if (config.roachFlyingImg && config.imagesLoaded) {
        ctx.drawImage(config.roachFlyingImg, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, -h * 0.2);
      ctx.lineTo(w * 0.1, h * 0.1);
      ctx.lineTo(-w * 0.1, h * 0.3);
      ctx.stroke();

      ctx.restore();
      ctx.globalAlpha = 1;
      return true;
    }

    // BOSS DEATH: use frame animation system
    if (r.state === RoachState.DEAD && r.isBoss && r.type === RoachType.QUEEN && config.bossBattle.bossKilled) {
      const bossScale = BALANCE_CONFIG.render.roach.bossScale;
      const def = ENEMY_DEFS[r.type];
      const size = def.size;
      const w = size * BALANCE_CONFIG.render.roach.bodyWidthRatio;
      const bossW = w * bossScale;
      const bossH = size * bossScale;

      ctx.save();
      ctx.translate(r.x, r.y);

      const action = config.bossAnimState.action;
      const frameIdx = config.bossAnimState.frameIndex;
      let frames = config.bossAnimFrames.get(action);
      if (!frames || frames.length === 0) {
        frames = config.bossAnimFrames.get('idle');
      }
      let animImg = frames?.[frameIdx];
      if (!animImg && frames) {
        animImg = frames.find(f => f !== undefined);
      }

      if (animImg) {
        ctx.drawImage(animImg, -bossW / 2, -bossH / 2, bossW, bossH);
      } else if (config.roachQueenImg) {
        ctx.drawImage(config.roachQueenImg, -bossW / 2, -bossH / 2, bossW, bossH);
      }
      ctx.restore();
      return true;
    }

    // Normal roach death (non-boss): fade out as a dark circle
    // SKIP for MUTANT during transformation animation
    if (r.state === RoachState.DEAD && !(r.type === RoachType.MUTANT && r.transformFrame !== undefined && r.transformFrame < 7)) {
      const alpha = r.deathTimer / BALANCE_CONFIG.render.roach.normalDeathFadeDuration;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#222';
      ctx.beginPath();
      const deadSize = r.type === RoachType.LARGE ? BALANCE_CONFIG.render.roach.deadSizeLarge : BALANCE_CONFIG.render.roach.deadSizeSmall;
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
      return true;
    }

    return false;
  }

  /**
   * Render the body image for a roach (inside the transform block).
   */
  private static renderRoachBody(
    config: RoachRendererConfig,
    ctx: CanvasRenderingContext2D,
    r: Roach,
    def: { size: number; color: string },
    w: number,
    h: number,
    size: number
  ): void {
    if (config.roachImg && config.imagesLoaded) {
      if (r.type === RoachType.SUICIDE && config.roachSuicideImg) {
        ctx.drawImage(config.roachSuicideImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.TIMED_SUICIDE && config.roachTimedSuicideImg) {
        ctx.drawImage(config.roachTimedSuicideImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.NURSE) {
        RoachRenderer.renderNurseBody(config, ctx, r, w, h);
      } else if (r.type === RoachType.MUTANT) {
        RoachRenderer.renderMutantBody(config, ctx, r, w, h);
      } else if (r.type === RoachType.FLYING && config.roachFlyingImg) {
        ctx.drawImage(config.roachFlyingImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.FLYING_SUICIDE && config.roachFlyingSuicideImg) {
        ctx.drawImage(config.roachFlyingSuicideImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.ARMORED && config.roachArmoredImg) {
        const isArmorBroken = r.armorHp <= 0;
        if (isArmorBroken && config.roachImg) {
          ctx.drawImage(config.roachImg, -w / 2, -h / 2, w, h);
        } else {
          ctx.drawImage(config.roachArmoredImg, -w / 2, -h / 2, w, h);
        }
      } else if (r.type === RoachType.SPLITTING && config.roachSplittingImg) {
        ctx.drawImage(config.roachSplittingImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.TUNNEL_WORKER && config.roachTunnelWorkerImg) {
        // 隧道工使用 roach_tunnel_worker.png 贴图
        ctx.drawImage(config.roachTunnelWorkerImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.SUBWAY_ELITE && config.roachSubwayEliteImg) {
        // 地铁精英使用独立贴图 roach_subway_elite.png
        ctx.drawImage(config.roachSubwayEliteImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.QUEEN && config.roachQueenImg) {
        RoachRenderer.renderBossBody(config, ctx, r, w, h, size);
      } else {
        ctx.drawImage(config.roachImg, -w / 2, -h / 2, w, h);
      }
    } else {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Render nurse body with cast animation frames and heal range circle */
  private static renderNurseBody(
    config: RoachRendererConfig,
    ctx: CanvasRenderingContext2D,
    r: Roach,
    w: number,
    h: number
  ): void {
    let castImg: HTMLImageElement | null = null;
    if (r.healPhase && r.healPhase !== 'idle' && r.state === RoachState.ALIVE) {
      let frameIdx = 0;
      const phase = r.healPhase;
      const timer = r.healPhaseTimer || 0;
      if (phase === 'charging') {
        const progress = 1 - timer / 1.0;
        frameIdx = Math.min(3, Math.floor(progress * 4));
      } else if (phase === 'spraying') {
        const cyclePos = (1 - timer / 2.0) % 0.5;
        if (cyclePos < 0.17) frameIdx = 4;
        else if (cyclePos < 0.34) frameIdx = 5;
        else frameIdx = 6;
      } else if (phase === 'dissipating') {
        const progress = 1 - timer / 1.0;
        frameIdx = 7 + Math.min(2, Math.floor(progress * 3));
      }
      castImg = config.nurseCastFrames[frameIdx] || config.roachNurseImg;
    }
    const img = castImg || config.roachNurseImg;
    if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);

    // Nurse heal range circle under feet
    if (r.healPhase && r.healPhase !== 'idle' && r.state === RoachState.ALIVE) {
      RoachRenderer.renderNurseHealRing(config, ctx, r, h);
    }
  }

  /** Render nurse heal range ring */
  private static renderNurseHealRing(
    config: RoachRendererConfig,
    ctx: CanvasRenderingContext2D,
    r: Roach,
    h: number
  ): void {
    const healRange = BALANCE_CONFIG.render.nurseHealVFX.healRange;
    const phase = r.healPhase!;
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

    ctx.strokeStyle = `rgba(100, 240, 140, ${ringAlpha * 0.7})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.1, rangeR * 0.85, rangeR * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(90, 210, 120, ${ringAlpha * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.1, rangeR * 0.5, rangeR * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

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

  /** Render mutant body with transformation animation */
  private static renderMutantBody(
    config: RoachRendererConfig,
    ctx: CanvasRenderingContext2D,
    r: Roach,
    w: number,
    h: number
  ): void {
    let img: HTMLImageElement | null = null;
    if (r.transformFrame !== undefined && r.transformFrame < 7 && r.state === RoachState.DEAD) {
      const frameImg = config.mutantTransformFrames[r.transformFrame];
      if (frameImg) {
        img = frameImg;
      } else if (config.roachMutantImg) {
        img = config.roachMutantImg;
      }
      ctx.scale(BALANCE_CONFIG.render.roach.mutantTransformScale, BALANCE_CONFIG.render.roach.mutantTransformScale);
    } else if (config.roachMutantImg) {
      img = config.roachMutantImg;
    }
    if (img) {
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
  }

  /** Render boss body with animation frames and action-specific effects */
  private static renderBossBody(
    config: RoachRendererConfig,
    ctx: CanvasRenderingContext2D,
    r: Roach,
    w: number,
    h: number,
    size: number
  ): void {
    const bossScale = BALANCE_CONFIG.render.roach.bossScale;
    const bossW = w * bossScale;
    const bossH = size * bossScale;

    if (r.isBoss && config.bossBattle.active) {
      const action = config.bossAnimState.action;
      const frameIdx = config.bossAnimState.frameIndex;
      let frames = config.bossAnimFrames.get(action);
      if (!frames || frames.length === 0) {
        frames = config.bossAnimFrames.get('idle');
      }
      let animImg = frames?.[frameIdx];
      if (!animImg && frames) {
        animImg = frames.find(f => f !== undefined);
      }

      if (animImg) {
        RoachRenderer.renderBossActionEffects(config, ctx, r, animImg, bossW, bossH, action);
      } else if (config.roachQueenImg) {
        ctx.drawImage(config.roachQueenImg, -bossW / 2, -bossH / 2, bossW, bossH);
      }
    } else {
      ctx.drawImage(config.roachQueenImg!, -w / 2, -h / 2, w, h);
    }
  }

  /** Render boss action-specific animation effects */
  private static renderBossActionEffects(
    config: RoachRendererConfig,
    ctx: CanvasRenderingContext2D,
    r: Roach,
    animImg: HTMLImageElement | undefined,
    bossW: number,
    bossH: number,
    action: string
  ): void {
    const t = config.time;
    ctx.save();

    switch (action) {
      case 'idle': {
        const breathe = 1 + Math.sin(t * 2.5) * 0.03;
        const swayX = Math.sin(t * 1.2 + r.wobbleOffset) * 3;
        const swayY = Math.sin(t * 2.0 + r.wobbleOffset) * 2;
        ctx.translate(swayX, swayY);
        ctx.scale(breathe, breathe);
        break;
      }
      case 'hover': {
        const floatY = Math.sin(t * 1.8 + r.wobbleOffset) * 8;
        const rock = Math.sin(t * 0.7 + r.wobbleOffset) * 0.03;
        const wingVibe = 1 + Math.sin(t * 20) * 0.01;
        ctx.translate(0, floatY);
        ctx.rotate(rock);
        ctx.scale(wingVibe, wingVibe);
        break;
      }
      case 'walk': {
        const bobY = Math.abs(Math.sin(t * 6 + r.wobbleOffset)) * (-6);
        const lean = (r.vx ?? 0) * 0.002;
        ctx.translate(0, bobY);
        ctx.rotate(Math.max(-0.08, Math.min(0.08, lean)));
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
        const vibration = Math.sin(t * 50) * 2;
        const chargePulse = 1 + Math.sin(t * 8) * 0.04;
        ctx.translate(vibration, Math.abs(vibration) * 0.5);
        ctx.scale(chargePulse, chargePulse);
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
        const pulse = 1 + Math.sin(t * 10) * 0.06;
        const shakeX = Math.sin(t * 30) * 2;
        const shakeY = Math.cos(t * 25) * 2;
        ctx.translate(shakeX, shakeY);
        ctx.scale(pulse, pulse);
        if (Math.sin(t * 4) > 0.95) {
          config.onSpawnShockwaveRing(r.x, r.y, 8);
        }
        break;
      }
      case 'stun': {
        const wobble = Math.sin(t * 8) * 0.08;
        const dizzyX = Math.sin(t * 5) * 5;
        ctx.translate(dizzyX, 0);
        ctx.rotate(wobble);
        for (let si = 0; si < 3; si++) {
          const starAngle = t * 3 + (si / 3) * Math.PI * 2;
          const starRadius = 50 + si * 15;
          config.onAddParticle({
            x: r.x + Math.cos(starAngle) * starRadius,
            y: r.y - 60 + Math.sin(starAngle) * starRadius * 0.3,
            vx: 0, vy: -20,
            life: 0.15, maxLife: 0.15,
            size: 6,
            color: si % 2 === 0 ? RENDER_COLOR.stunStar : RENDER_COLOR.stunStarWhite,
            type: ParticleType.SPARK,
          });
        }
        break;
      }
      case 'hurt': {
        const hurtShake = Math.sin(t * 15) * 3;
        const hurtPulse = 1 + Math.sin(t * 5) * 0.02;
        ctx.translate(hurtShake, 0);
        ctx.scale(hurtPulse, hurtPulse);
        ctx.filter = 'brightness(1.3) saturate(1.5)';
        break;
      }
      case 'die': {
        const dieProgress = 1 - (config.bossBattle.deathAnimTimer / 1.75);
        const shrink = Math.max(0.3, 1 - dieProgress * 0.7);
        const tilt = dieProgress * 0.3;
        const sinkY = dieProgress * 30;
        ctx.translate(0, sinkY);
        ctx.rotate(tilt * (Math.random() < 0.5 ? 1 : -1));
        ctx.scale(shrink, shrink);
        ctx.globalAlpha = Math.max(0.2, 1 - dieProgress * 0.5);
        break;
      }
      default: {
        const breathe = 1 + Math.sin(t * 2) * 0.02;
        ctx.scale(breathe, breathe);
      }
    }

    ctx.drawImage(animImg!, -bossW / 2, -bossH / 2, bossW, bossH);
    ctx.restore();

    // Action-specific overlays (outside save/restore)
    if (action === 'charge') {
      const glowAlpha = 0.15 + Math.sin(t * 6) * 0.1;
      ctx.fillStyle = `rgba(255, 60, 0, ${glowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(0, bossH * 0.1, bossW * 0.55, bossH * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (action === 'summon') {
      const glowAlpha = 0.1 + Math.sin(t * 5) * 0.08;
      ctx.fillStyle = `rgba(168, 85, 247, ${glowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, bossW * 0.6, bossH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  static renderRoach(config: RoachRendererConfig, ctx: CanvasRenderingContext2D, r: Roach) {
    // ===== DEATH RENDERING =====
    if (RoachRenderer.renderRoachDeath(config, ctx, r)) return;

    const def = ENEMY_DEFS[r.type];
    const size = r.isBoss ? def.size : def.size * (BALANCE_CONFIG.render.roach.sizeWobbleBase + Math.sin(config.time * 3 + r.wobbleOffset) * BALANCE_CONFIG.render.roach.sizeWobbleAmp);
    const w = size * BALANCE_CONFIG.render.roach.bodyWidthRatio;
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

    // Stuck state check (cheap yellow tint overlay is drawn after body rendering,
    // replacing the old per-roach ctx.filter which caused heavy GPU offscreen passes
    // when many roaches were stuck, especially stacked with the armor shield effect)
    const stuckByBoard = config.isStuckByBoard(r.id);

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

    // ===== BODY RENDERING =====
    RoachRenderer.renderRoachBody(config, ctx, r, def, w, h, size);

    // ===== STUCK TINT OVERLAY (cheap translucent yellow, no ctx.filter) =====
    if (stuckByBoard) {
      ctx.fillStyle = 'rgba(240, 210, 60, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.55, h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ===== SUBWAY EXCLUSIVE: 隧道工施法警示光圈 =====
    // 注意：隧道工使用独立贴图 roach_tunnel_worker.png，不再叠加灰棕色染色层（避免贴图颜色叠加）
    if (r.type === RoachType.TUNNEL_WORKER) {
      // 施法范围光圈（喷涂瞬间一次脉冲，类似护士施法特效）
      if (r.armorSprayCastTimer !== undefined && r.armorSprayCastTimer > 0 && r.state === RoachState.ALIVE) {
        const castRange = BALANCE_CONFIG.subway.armorSprayRange;
        const progress = 1 - r.armorSprayCastTimer / 0.5; // 0→1
        const ringScale = 0.3 + progress * 0.7;            // 从 30% 扩散到 100%
        const ringAlpha = (1 - progress) * 0.55;           // 渐隐
        const rangeR = castRange * ringScale;
        const grad = ctx.createRadialGradient(0, h * 0.1, rangeR * 0.5, 0, h * 0.1, rangeR);
        grad.addColorStop(0, 'rgba(148, 163, 184, 0)');
        grad.addColorStop(0.7, `rgba(148, 163, 184, ${ringAlpha * 0.3})`);
        grad.addColorStop(0.9, `rgba(203, 213, 225, ${ringAlpha * 0.6})`);
        grad.addColorStop(1, `rgba(226, 232, 240, ${ringAlpha * 0.2})`);
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, h * 0.1, rangeR, rangeR * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(203, 213, 225, ${ringAlpha * 0.8})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, h * 0.1, rangeR * 0.85, rangeR * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
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
      ctx.font = RENDER_FONT.large;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TEXT_CONFIG.combat.transformCountdown.text(secsLeft), 0, -swirlR - 10);
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
    // Color varies by type: orange for TIMED_SUICIDE, blue for others
    if (r.armorHp > 0) {
      const sc = BALANCE_CONFIG.render.roach.shield;
      const isTimedSuicide = r.type === RoachType.TIMED_SUICIDE;
      const color = isTimedSuicide ? sc.timedSuicideColor : sc.normalColor;
      const pulseBase = isTimedSuicide ? sc.timedSuicidePulseBase : sc.normalPulseBase;
      const lw = isTimedSuicide ? sc.timedSuicideLineWidth : sc.normalLineWidth;
      const sb = isTimedSuicide ? sc.timedSuicideShadowBlur : sc.normalShadowBlur;
      const shadowAlphaRatio = isTimedSuicide ? sc.timedSuicideShadowAlphaRatio : sc.normalShadowAlphaRatio;
      const radiusRatio = isTimedSuicide ? sc.timedSuicideRadiusRatio : sc.normalRadiusRatio;
      const glowAlphaRatio = isTimedSuicide ? sc.timedSuicideGlowAlphaRatio : sc.normalGlowAlphaRatio;

      const shieldPulse = pulseBase + Math.sin(config.time * 4 + r.id) * 0.15;
      const shieldAlpha = shieldPulse;
      ctx.save();
      ctx.strokeStyle = `rgba(${color}, ${shieldAlpha})`;
      ctx.lineWidth = lw;
      ctx.shadowColor = `rgba(${color}, ${shieldAlpha * shadowAlphaRatio})`;
      ctx.shadowBlur = sb;
      const shieldR = Math.max(w, h) * radiusRatio;
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
      glowGrad.addColorStop(0, `rgba(${color}, ${shieldAlpha * glowAlphaRatio})`);
      glowGrad.addColorStop(1, `rgba(${color}, 0)`);
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
        ctx.font = RENDER_FONT.large;
        ctx.textAlign = 'center';
        ctx.fillStyle = RENDER_COLOR.bombCountdown;
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
        ctx.font = RENDER_FONT.xLarge;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Dark red锯齿描边
        ctx.strokeStyle = RENDER_COLOR.bombCountdown;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'miter';
        ctx.strokeText(`${secs}`, 0, -h * 0.8);
        ctx.fillStyle = secs <= 1 ? RENDER_COLOR.bombCountdown : RENDER_COLOR.bombCountdownCritical;
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
    const showHpBar = r.armorHp > 0 || r.isBoss || r.type === RoachType.SMALL || r.type === RoachType.LARGE || r.type === RoachType.ARMORED || r.type === RoachType.SPLITTING || r.type === RoachType.NURSE || r.type === RoachType.TIMED_SUICIDE || r.type === RoachType.TUNNEL_WORKER || r.type === RoachType.SUBWAY_ELITE;
    if (showHpBar) {
      const hpRatio = Math.max(0, r.hp / r.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(r.x - barW / 2, r.y - size - 15, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? RENDER_COLOR.hpHigh : hpRatio > 0.2 ? RENDER_COLOR.hpMid : RENDER_COLOR.hpLow;
      ctx.fillRect(r.x - barW / 2, r.y - size - 15, barW * hpRatio, barH);
    }

    // ===== ARMOR BUFF BAR: show for ALL roach types with armor =====
    if (r.armorHp > 0) {
      const armorRatio = Math.max(0, r.armorHp / (r.maxArmorHp || 1));
      // Armor bar background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(r.x - barW / 2, r.y - size - 23, barW, 4);
      // Armor fill (blue gradient)
      const armorGrad = ctx.createLinearGradient(r.x - barW / 2, 0, r.x + barW / 2, 0);
      armorGrad.addColorStop(0, RENDER_COLOR.shieldStart);
      armorGrad.addColorStop(1, RENDER_COLOR.shieldEnd);
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
      ctx.strokeStyle = RENDER_COLOR.flyingIndicator;
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

    // Stun effect (deterministic pulse, no per-frame random flicker)
    if (r.isStunned) {
      const stunPulse = (Math.sin(config.time * 8) + 1) * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(150, 220, 255, ${0.5 + stunPulse * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(250, 200, 50, 0.8)';
      ctx.shadowBlur = 6;
      // Deterministic bolt positions based on roach id and time
      const seedBase = r.id * 137.5;
      for (let i = 0; i < 3; i++) {
        const seedI = seedBase + i * 73.1;
        const sx = r.x + (Math.sin(config.time * 7 + seedI) * 0.5) * size * 2;
        const sy = r.y - size * 0.5 + (Math.cos(config.time * 5.3 + seedI + 1.7) * 0.5) * size;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - size * 0.3);
        for (let j = 0; j < 3; j++) {
          const seedJ = seedI + j * 41.3;
          ctx.lineTo(sx + Math.sin(config.time * 11 + seedJ) * 8, sy + j * 4);
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
      ctx.fillStyle = RENDER_COLOR.bossName;
      ctx.font = RENDER_FONT.large;
      ctx.textAlign = 'center';
      ctx.fillText(TEXT_CONFIG.combat.roachQueen.text, r.x, r.y - size - 25);
    }
  }
}