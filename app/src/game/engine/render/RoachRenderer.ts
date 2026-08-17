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
  /** 地铁场景：护盾蟑螂贴图（roach_shield01.png） */
  roachShieldImg: HTMLImageElement | null;
  nurseCastFrames: (HTMLImageElement | null)[];
  mutantTransformFrames: (HTMLImageElement | null)[];
  imagesLoaded: boolean;

  // 游戏状态
  time: number;
  deltaTime: number;
  /** 防线 Y 坐标（地面蟑螂透视缩放下缘） */
  defenseLineY: number;
  /** 画布高度 */
  canvasHeight: number;

  // Boss 状态
  bossBattle: BossBattleState;
  bossAnimState: { action: string; frameIndex: number };
  bossAnimFrames: Map<string, (HTMLImageElement | undefined)[]>;

  // 回调（处理渲染时的副作用）
  onAddParticle: (particle: Particle) => void;
  onSpawnShockwaveRing: (x: number, y: number, count: number) => void;
  isStuckByBoard: (id: number) => boolean;

  // 调试开关
  /** 是否显示护盾蟑螂的护盾范围框（调试用） */
  showShieldRange: boolean;
  /** 护盾修复连线数据：{ workerX, workerY, shieldX, shieldY } */
  repairLinePairs: Array<{ workerX: number; workerY: number; shieldX: number; shieldY: number }>;
}

export class RoachRenderer {

  /**
   * 确定性伪随机（0~1）：渲染器无状态，以「时间槽 + 序号 + 蟑螂 id」为种子，
   * 保证同一帧/同一槽内多次渲染结果一致（护盾光带扩散粒子用）。
   */
  private static hash01(n: number): number {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  static renderRoaches(config: RoachRendererConfig, ctx: CanvasRenderingContext2D, roaches: Roach[]) {
    // ===== RENDER ORDER: sort by z-index (charging BOSS last) for single-pass rendering =====
    // Charging BOSS renders on top of all other roaches
    const sorted = [...roaches].sort((a, b) => {
      const aTop = a.isBoss && a.type === RoachType.QUEEN && a.isCharging ? 1 : 0;
      const bTop = b.isBoss && b.type === RoachType.QUEEN && b.isCharging ? 1 : 0;
      return aTop - bTop;
    });
    for (const r of sorted) {
      RoachRenderer.renderRoach(config, ctx, r, roaches);
    }

    // 渲染护盾修复连线（隧道工 → 护盾蟑螂）
    RoachRenderer.renderShieldRepairLines(config, ctx);
  }

  /**
   * 渲染护盾修复连线（隧道工 → 护盾蟑螂）
   * 虚线流动动画，青色发光，替换旧粒子特效
   */
  private static renderShieldRepairLines(config: RoachRendererConfig, ctx: CanvasRenderingContext2D): void {
    const pairs = config.repairLinePairs;
    if (!pairs || pairs.length === 0) return;
    if (typeof config.time !== 'number') return;

    const lineCfg = BALANCE_CONFIG.particle.shieldRepairLine;
    const dashOffset = (config.time * lineCfg.flowSpeed) % (lineCfg.dashLen + lineCfg.dashGap);
    const pulse = lineCfg.alphaBase + Math.sin(config.time * lineCfg.alphaPulseFreq) * lineCfg.alphaPulseAmp;
    const alpha = Math.max(0, Math.min(1, pulse));

    ctx.save();
    for (const pair of pairs) {
      // 发光底层
      ctx.strokeStyle = `rgba(${lineCfg.glowColor}, ${alpha * lineCfg.glowAlphaRatio})`;
      ctx.lineWidth = lineCfg.lineWidth + 4;
      ctx.shadowColor = `rgba(${lineCfg.glowColor}, ${alpha * lineCfg.glowAlphaRatio})`;
      ctx.shadowBlur = lineCfg.glowBlur;
      ctx.beginPath();
      ctx.moveTo(pair.workerX, pair.workerY);
      ctx.lineTo(pair.shieldX, pair.shieldY);
      ctx.stroke();

      // 主虚线层（流动）
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(${lineCfg.color}, ${alpha})`;
      ctx.lineWidth = lineCfg.lineWidth;
      ctx.setLineDash([lineCfg.dashLen, lineCfg.dashGap]);
      ctx.lineDashOffset = -dashOffset;
      ctx.beginPath();
      ctx.moveTo(pair.workerX, pair.workerY);
      ctx.lineTo(pair.shieldX, pair.shieldY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
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
      } else if (r.type === RoachType.SHIELD && config.roachShieldImg) {
        // 护盾蟑螂使用贴图 roach_shield01.png
        ctx.drawImage(config.roachShieldImg, -w / 2, -h / 2, w, h);
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
    const ring = BALANCE_CONFIG.render.roach.nurseHealRing; // 颜色/透明度/混合集中于 vfx-balance render.roach.nurseHealRing
    const phase = r.healPhase!;
    const timer = r.healPhaseTimer || 0;
    let ringAlpha = 0;
    let ringScale = 1;

    if (phase === 'charging') {
      const progress = 1 - timer / 1.0;
      ringAlpha = progress * ring.chargeAlphaScale;
      ringScale = 0.3 + progress * 0.7;
    } else if (phase === 'spraying') {
      const pulse = 1 + Math.sin(config.time * 4) * 0.08;
      ringAlpha = ring.sprayAlphaBase * pulse;
      ringScale = 1;
    } else if (phase === 'dissipating') {
      const progress = 1 - timer / 1.0;
      ringAlpha = (1 - progress) * ring.dissipateAlphaScale;
      ringScale = 1 + progress * 0.2;
    }

    ctx.save();
    ctx.globalCompositeOperation = ring.blend;
    const rangeR = healRange * ringScale;
    const grad = ctx.createRadialGradient(0, 0, rangeR * 0.6, 0, 0, rangeR);
    grad.addColorStop(0, `rgba(${ring.gradColorInner}, 0)`);
    grad.addColorStop(0.7, `rgba(${ring.gradColorInner}, ${ringAlpha * ring.gradMidAlphaRatio})`);
    grad.addColorStop(0.9, `rgba(${ring.gradColorMid}, ${ringAlpha * ring.gradEdgeAlphaRatio})`);
    grad.addColorStop(1, `rgba(${ring.gradColorEdge}, ${ringAlpha * ring.gradTipAlphaRatio})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.1, rangeR, rangeR * 0.333, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${ring.strokeColor}, ${ringAlpha * ring.strokeAlphaRatio})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.1, rangeR * 0.85, rangeR * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(${ring.innerFillColor}, ${ringAlpha * ring.innerFillAlphaRatio})`;
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
      ctx.strokeStyle = `rgba(${ring.dashColor}, ${ringAlpha * ring.dashAlphaRatio})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dashX - Math.cos(a) * dashLen * 0.5, dashY - Math.sin(a) * dashLen * 0.15);
      ctx.lineTo(dashX + Math.cos(a) * dashLen * 0.5, dashY + Math.sin(a) * dashLen * 0.15);
      ctx.stroke();
    }
    ctx.restore();
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
    // 颜色/透明度/混合集中于 vfx-balance render.roach.bossOverlay
    const bo = BALANCE_CONFIG.render.roach.bossOverlay;
    if (action === 'charge' || action === 'summon') {
      const isCharge = action === 'charge';
      const glowAlpha = isCharge
        ? bo.chargeAlphaBase + Math.sin(t * 6) * bo.chargeAlphaAmp
        : bo.summonAlphaBase + Math.sin(t * 5) * bo.summonAlphaAmp;
      ctx.save();
      ctx.globalCompositeOperation = bo.blend;
      ctx.fillStyle = `rgba(${isCharge ? bo.chargeColor : bo.summonColor}, ${glowAlpha})`;
      ctx.beginPath();
      if (isCharge) ctx.ellipse(0, bossH * 0.1, bossW * 0.55, bossH * 0.45, 0, 0, Math.PI * 2);
      else ctx.ellipse(0, 0, bossW * 0.6, bossH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 地面蟑螂透视缩放：远小近大（固定设计坐标基准——远端 farY(350) 处 minScale → 近端 nearY(960) 处 maxScale，
   * 不与画布高度绑定）。BOSS 与飞行单位（飞行/飞行自爆/地铁精英）不缩放。
   */
  private static groundPerspectiveScale(_config: RoachRendererConfig, r: Roach): number {
    if (r.isBoss) return 1;
    if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE || r.type === RoachType.SUBWAY_ELITE) return 1;
    const pc = BALANCE_CONFIG.render.roach.perspective;
    const t = Math.max(0, Math.min(1, (pc.nearY - r.y) / (pc.nearY - pc.farY)));
    return pc.maxScale - t * (pc.maxScale - pc.minScale);
  }

  static renderRoach(config: RoachRendererConfig, ctx: CanvasRenderingContext2D, r: Roach, roaches: Roach[] = []) {
    // ===== DEATH RENDERING =====
    if (RoachRenderer.renderRoachDeath(config, ctx, r)) return;

    const def = ENEMY_DEFS[r.type];
    const perspScale = RoachRenderer.groundPerspectiveScale(config, r);
    const size = r.isBoss ? def.size : def.size * perspScale * (BALANCE_CONFIG.render.roach.sizeWobbleBase + Math.sin(config.time * 3 + r.wobbleOffset) * BALANCE_CONFIG.render.roach.sizeWobbleAmp);
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
        // Strong red flash for BOSS（颜色/透明度/混合集中于 vfx-balance render.roach.bossDamageFlash）
        const bf = BALANCE_CONFIG.render.roach.bossDamageFlash;
        ctx.filter = `brightness(${1 + r.damageFlash * 0.5}) saturate(2) hue-rotate(-30deg)`;
        // Additional red glow overlay
        ctx.globalCompositeOperation = bf.blend;
        ctx.fillStyle = `rgba(${bf.color}, ${Math.min(bf.alphaMax, r.damageFlash * bf.alphaScale)})`;
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
        const sf = BALANCE_CONFIG.render.roach.suicideFlame; // 黑烟颜色/透明度集中于 vfx-balance
        config.onAddParticle({
          x: r.x + (Math.random() - 0.5) * (r.size || 30) * 0.8,
          y: r.y + (Math.random() - 0.5) * (r.size || 30) * 0.5,
          vx: (Math.random() - 0.5) * 15,
          vy: -20 - Math.random() * 25,
          life: 0.4 + Math.random() * 0.3,
          maxLife: 0.7,
          size: 3 + Math.random() * 5 * smokeIntensity,
          color: `rgba(${sf.smokeColor}, ${sf.smokeAlphaBase + smokeIntensity * sf.smokeAlphaRange})`,
          type: ParticleType.ASH,
        });
      }
    }

    // Rotation: downward (vy>0) = 0°, upward (vy<=0) = 180°
    // Skip for BOSS — handled separately below with proper rotation
    // Nurse roach: never flip vertically (no reversal when hit by flame)
    if (r.vy <= 0 && !r.isBoss && r.type !== RoachType.NURSE && r.type !== RoachType.TUNNEL_WORKER && r.type !== RoachType.SUBWAY_ELITE) ctx.scale(1, -1);

    // ===== BODY RENDERING =====
    RoachRenderer.renderRoachBody(config, ctx, r, def, w, h, size);

    // ===== STUCK TINT OVERLAY (cheap translucent yellow, no ctx.filter) =====
    if (stuckByBoard) {
      const stickyCfg = BALANCE_CONFIG.render.drop.sticky; // 颜色/透明度集中于 vfx-balance render.drop.sticky
      ctx.fillStyle = stickyCfg.stuckTintColor.replace('{alpha}', String(stickyCfg.stuckTintAlpha));
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.55, h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ===== SUBWAY EXCLUSIVE: 隧道工施法警示光圈 =====
    // 注意：隧道工使用独立贴图 roach_tunnel_worker.png，不再叠加灰棕色染色层（避免贴图颜色叠加）
    if (r.type === RoachType.TUNNEL_WORKER) {
      // 施法范围光圈（喷涂瞬间一次脉冲，类似护士施法特效）
      if (r.armorSprayCastTimer !== undefined && r.armorSprayCastTimer > 0 && r.state === RoachState.ALIVE) {
        const ring = BALANCE_CONFIG.render.roach.armorCastRing; // 参数集中于 vfx-balance render.roach.armorCastRing
        const castRange = BALANCE_CONFIG.subway.armorSprayRange;
        const progress = 1 - r.armorSprayCastTimer / ring.duration; // 0→1
        const ringScale = ring.startScale + progress * (1 - ring.startScale); // 从起始比例扩散到 100%
        const ringAlpha = (1 - progress) * ring.maxAlpha;           // 渐隐
        const rangeR = castRange * ringScale;
        const footY = h * ring.footOffsetRatio;                     // 圆心贴脚下
        const grad = ctx.createRadialGradient(0, footY, rangeR * ring.gradInnerRatio, 0, footY, rangeR);
        grad.addColorStop(0, `rgba(${ring.colorMid}, 0)`);
        grad.addColorStop(ring.stopMid, `rgba(${ring.colorMid}, ${ringAlpha * ring.fillMidAlphaRatio})`);
        grad.addColorStop(ring.stopEdge, `rgba(${ring.colorEdge}, ${ringAlpha * ring.fillEdgeAlphaRatio})`);
        grad.addColorStop(1, `rgba(${ring.colorTip}, ${ringAlpha * ring.fillTipAlphaRatio})`);
        ctx.save();
        ctx.globalCompositeOperation = ring.blend; // lighter 叠加提亮（vfx-balance render.roach.armorCastRing.blend）
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, footY, rangeR, rangeR * ring.flatten, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${ring.colorEdge}, ${ringAlpha * ring.strokeAlphaRatio})`;
        ctx.lineWidth = ring.lineWidth;
        ctx.beginPath();
        ctx.ellipse(0, footY, rangeR * ring.strokeScale, rangeR * ring.strokeFlatten, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ===== HOSPITAL EXCLUSIVE: MUTANT TRANSFORMATION VISUAL =====
    // 变身前摇仅保留倒计时数字（外部粉色旋涡特效已按需求移除）
    if (r.type === RoachType.MUTANT && r.transformTimer && r.transformTimer > 0) {
      const mt = BALANCE_CONFIG.render.roach.mutantTransform; // 颜色/透明度集中于 vfx-balance
      const progress = 1 - r.transformTimer / 1.0; // 0→1
      const secsLeft = Math.ceil(r.transformTimer!);
      ctx.save();
      ctx.fillStyle = `rgba(${mt.countdownColor}, ${mt.countdownAlphaBase + progress * mt.countdownAlphaRange})`;
      ctx.font = RENDER_FONT.large;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TEXT_CONFIG.combat.transformCountdown.text(secsLeft), 0, -Math.max(w, h) - 10);
      ctx.restore();
    }

    // ===== MUTANT SPAWN: Green slime tint overlay (2s) =====
    if (r.wasMutantSpawn && r.slimeTimer && r.slimeTimer > 0 && r.state === RoachState.ALIVE) {
      const ms = BALANCE_CONFIG.render.roach.mutantSpawnSlime; // 颜色/透明度/混合集中于 vfx-balance
      const slimeProgress = Math.min(1, r.slimeTimer / 2.0);
      const slimeAlpha = ms.alphaScale * slimeProgress;

      ctx.save();
      ctx.globalCompositeOperation = ms.blend;
      // 1. Bright green glow behind the roach
      const glowR = Math.max(w, h) * 0.6;
      const glowGrad = ctx.createRadialGradient(0, 0, glowR * 0.3, 0, 0, glowR);
      glowGrad.addColorStop(0, `rgba(${ms.glowColorInner}, ${slimeAlpha * ms.glowInnerAlphaRatio})`);
      glowGrad.addColorStop(0.7, `rgba(${ms.glowColorMid}, ${slimeAlpha * ms.glowMidAlphaRatio})`);
      glowGrad.addColorStop(1, `rgba(${ms.glowColorEdge}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, glowR, glowR * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Green slime overlay on roach body
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.5, h * 0.42, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = `rgba(${ms.bodyTintColor}, ${slimeAlpha * ms.bodyTintAlphaRatio})`;
      ctx.fillRect(-w, -h, w * 2, h * 2);
      ctx.restore();

      // 3. Outer slime ring (dripping effect)
      ctx.strokeStyle = `rgba(${ms.ringColor}, ${slimeAlpha * ms.ringAlphaRatio})`;
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
        ctx.fillStyle = `rgba(${ms.spotColor}, ${slimeAlpha * ms.spotAlphaRatio})`;
        ctx.beginPath();
        ctx.ellipse(spotX, spotY, spotR, spotR * 0.6, spotAngle * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      r.slimeTimer -= config.deltaTime;
    }

    // Sticky drop wrap overlay (yellow gel blob enclosing the roach)
    if (r.wrappedByDropId !== null && r.state === RoachState.ALIVE) {
      const wr = BALANCE_CONFIG.render.drop.sticky.wrap; // 颜色/透明度/混合集中于 vfx-balance render.drop.sticky.wrap
      const wrapPulse = 0.85 + Math.sin(config.time * 6 + r.id) * 0.15;
      const wrapRadius = Math.max(w, h) * 0.55 * wrapPulse;

      ctx.save();
      ctx.globalCompositeOperation = wr.blend;
      // Outer glow
      const glowGrad = ctx.createRadialGradient(0, 0, wrapRadius * 0.5, 0, 0, wrapRadius * 1.3);
      glowGrad.addColorStop(0, wr.glowColor0);
      glowGrad.addColorStop(0.6, wr.glowColor1);
      glowGrad.addColorStop(1, wr.glowColor2);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, wrapRadius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Main gel body - semi-transparent yellow blob
      ctx.fillStyle = `rgba(${wr.bodyColor}, ${wr.bodyAlpha * wrapPulse})`;
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
      ctx.strokeStyle = `rgba(${wr.borderColor}, ${wr.borderAlpha * wrapPulse})`;
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
      ctx.fillStyle = `rgba(${wr.specularColor}, ${wr.specularAlpha * wrapPulse})`;
      ctx.beginPath();
      ctx.ellipse(-wrapRadius * 0.2, -wrapRadius * 0.25, wrapRadius * 0.25, wrapRadius * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Small bubbles inside the gel
      for (let b = 0; b < 3; b++) {
        const bubbleAngle = config.time * 2 + b * 2.1 + r.id;
        const bubbleR = wrapRadius * (0.3 + 0.4 * Math.sin(b * 1.7));
        const bubbleX = Math.cos(bubbleAngle) * bubbleR;
        const bubbleY = Math.sin(bubbleAngle) * bubbleR;
        ctx.fillStyle = `rgba(${wr.bubbleColor}, ${wr.bubbleAlphaBase + Math.sin(config.time * 3 + b) * wr.bubbleAlphaAmp})`;
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, 1.5 + Math.sin(config.time * 4 + b) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Suicide roach: small flame on back
    if (r.type === RoachType.SUICIDE && r.state === RoachState.ALIVE) {
      const sf = BALANCE_CONFIG.render.roach.suicideFlame; // 颜色/透明度/混合集中于 vfx-balance
      const flameFlicker = 0.7 + Math.sin(config.time * 10 + r.id) * 0.3;
      const flameH = 8 + Math.sin(config.time * 15 + r.id * 2) * 3;
      const flameW = 6 + Math.cos(config.time * 12 + r.id) * 2;
      ctx.save();
      ctx.globalCompositeOperation = sf.blend;
      // Outer flame (orange)
      ctx.fillStyle = `rgba(${sf.outerColor}, ${flameFlicker * sf.outerAlpha})`;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.45);
      ctx.lineTo(-flameW / 2, -h * 0.45 - flameH * 0.6);
      ctx.lineTo(0, -h * 0.45 - flameH);
      ctx.lineTo(flameW / 2, -h * 0.45 - flameH * 0.6);
      ctx.closePath();
      ctx.fill();
      // Inner flame (yellow)
      ctx.fillStyle = `rgba(${sf.innerColor}, ${flameFlicker * sf.innerAlpha})`;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.45);
      ctx.lineTo(-flameW * 0.3, -h * 0.45 - flameH * 0.4);
      ctx.lineTo(0, -h * 0.45 - flameH * 0.75);
      ctx.lineTo(flameW * 0.3, -h * 0.45 - flameH * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ===== ARMOR SHIELD EFFECT: all roaches with armor buff =====
    // Drawn INSIDE the transform block so shield follows the roach
    // 半透明玻璃质感：六边形玻璃罩（渐变填充 + 清晰描边 + 顶部反光带）；颜色按类型：定时自爆橙 / 其它蓝
    if (r.armorHp > 0) {
      const sc = BALANCE_CONFIG.render.roach.shield;
      const isTimedSuicide = r.type === RoachType.TIMED_SUICIDE;
      const color = isTimedSuicide ? sc.timedSuicideColor : sc.normalColor;
      const pulseBase = isTimedSuicide ? sc.timedSuicidePulseBase : sc.normalPulseBase;
      const lw = isTimedSuicide ? sc.timedSuicideLineWidth : sc.normalLineWidth;
      const radiusRatio = isTimedSuicide ? sc.timedSuicideRadiusRatio : sc.normalRadiusRatio;
      const blend = isTimedSuicide ? sc.timedSuicideBlend : sc.normalBlend; // 玻璃质感 source-over（vfx-balance render.roach.shield.*Blend）

      const shieldPulse = pulseBase + Math.sin(config.time * 4 + r.id) * 0.15;
      const shieldR = Math.max(w, h) * radiusRatio;
      const g = sc.glass;
      ctx.save();
      ctx.globalCompositeOperation = blend;
      // 六边形玻璃罩路径
      ctx.beginPath();
      for (let si = 0; si < 6; si++) {
        const sAngle = (si / 6) * Math.PI * 2 + config.time * 0.5;
        const sx = Math.cos(sAngle) * shieldR;
        const sy = Math.sin(sAngle) * shieldR;
        if (si === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      // 1) 半透明玻璃填充（纵向渐变：顶部偏白反光 → 中部微染色 → 底部略深）
      const glassGrad = ctx.createLinearGradient(0, -shieldR, 0, shieldR);
      glassGrad.addColorStop(0, `rgba(${g.reflection.color}, ${g.topAlpha})`);
      glassGrad.addColorStop(g.midStop, `rgba(${color}, ${g.midAlpha})`);
      glassGrad.addColorStop(1, `rgba(${color}, ${g.bottomAlpha})`);
      ctx.fillStyle = glassGrad;
      ctx.fill();
      // 2) 清晰玻璃边缘描边（轻微脉动，无辉光）
      ctx.strokeStyle = `rgba(${color}, ${Math.min(1, shieldPulse + g.edgeAlphaBoost)})`;
      ctx.lineWidth = lw;
      ctx.stroke();
      // 3) 顶部反光带（裁剪在六边形内的椭圆弧，上深下浅渐隐）
      ctx.clip();
      const refl = g.reflection;
      const ry = -shieldR * refl.yRatio;
      ctx.beginPath();
      ctx.ellipse(0, ry, shieldR * refl.rxRatio, shieldR * refl.ryRatio, 0, 0, Math.PI * 2);
      const reflGrad = ctx.createLinearGradient(0, ry - shieldR * refl.ryRatio, 0, ry + shieldR * refl.ryRatio);
      reflGrad.addColorStop(0, `rgba(${refl.color}, ${refl.alpha})`);
      reflGrad.addColorStop(1, `rgba(${refl.color}, 0)`);
      ctx.fillStyle = reflGrad;
      ctx.fill();
      ctx.restore();
    }

    // ===== TIMED SUICIDE: "螂家爆破" VISUAL OVERLAY =====
    // Rendered INSIDE transform block so effects follow the roach
    if (r.type === RoachType.TIMED_SUICIDE && r.breachPhase && r.breachPhase !== 'idle' && r.breachPhase !== 'residue') {
      const phase = r.breachPhase;
      const phaseTimer = r.breachPhaseTimer || 0;
      const TB = BALANCE_CONFIG.timedBomb;

      if (phase === 'warning') {
        const W = TB.warning;
        // Phase 1: Danger warning
        // Red blinking light on back (rapid flash)
        const blink = Math.sin(config.time * W.blinkFreq) > 0 ? 1 : W.blinkOffAlpha;
        ctx.fillStyle = `rgba(${W.lightColor}, ${blink})`;
        ctx.beginPath();
        ctx.arc(0, -h * W.lightYRatio, W.lightRadius, 0, Math.PI * 2);
        ctx.fill();
        // Danger circle on ground (irregular)
        ctx.save();
        ctx.translate(0, h * W.circleYRatio);
        ctx.strokeStyle = `rgba(${W.circleColor}, ${W.circleAlpha})`;
        ctx.lineWidth = W.circleLineWidth;
        ctx.setLineDash([...W.circleDash]);
        ctx.lineDashOffset = -config.time * W.circleDashSpeed;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += W.circleAngleStep) {
          const rough = 1 + Math.sin(a * W.circleRoughFreq + r.id) * W.circleRoughAmp;
          const rx = Math.cos(a) * W.circleRadiusX * rough;
          const ry = Math.sin(a) * W.circleRadiusY * rough;
          if (a === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Countdown number (dark red, slight jitter)
        const jitterX = Math.sin(config.time * W.jitterXFreq) * W.jitterXAmp;
        const jitterY = Math.cos(config.time * W.jitterYFreq) * W.jitterYAmp;
        ctx.font = RENDER_FONT.large;
        ctx.textAlign = 'center';
        ctx.fillStyle = RENDER_COLOR.bombCountdown;
        ctx.fillText(`${Math.ceil(3.0 - (0.5 - phaseTimer) / 0.5 * 3)}`, jitterX, -h * W.countdownYRatio + jitterY);
      }

      if (phase === 'crouching') {
        const C = TB.crouching;
        // Phase 2: Crouching + countdown

        // Body squashed (simulate crouching)
        ctx.scale(C.squashX, C.squashY);

        // Red blinking light on back (rapid)
        const blink = Math.sin(config.time * C.blinkFreq) > 0 ? 1 : C.blinkOffAlpha;
        ctx.fillStyle = `rgba(${C.lightColor}, ${blink})`;
        ctx.beginPath();
        ctx.arc(0, -h * C.lightYRatio, C.lightRadius, 0, Math.PI * 2);
        ctx.fill();

        // Crack lines spreading from center (dark red, hand-drawn feel)
        const crackR = r.crackRadius || 0;
        if (crackR > 0) {
          ctx.save();
          ctx.translate(0, h * C.crackYRatio);
          ctx.strokeStyle = `rgba(${C.crackColor}, ${C.crackAlpha})`;
          ctx.lineWidth = C.crackLineWidth;
          for (let ci = 0; ci < C.crackCount; ci++) {
            const cAngle = (ci / C.crackCount) * Math.PI * 2 + r.id * C.crackIdJitter;
            const len = crackR * (C.crackLenBase + Math.sin(ci * C.crackLenFreq) * C.crackLenAmp);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const steps = C.crackSteps;
            for (let s = 1; s <= steps; s++) {
              const sx = Math.cos(cAngle + s * C.crackAngleStep) * (len * s / steps);
              const sy = Math.sin(cAngle + s * C.crackAngleStep) * (len * s / steps * C.crackYScale);
              ctx.lineTo(sx, sy);
            }
            ctx.stroke();
          }
          ctx.restore();
        }

        // Body tremor
        const tremor = Math.sin(config.time * C.tremorFreq) * C.tremorAmp;
        ctx.translate(0, tremor);

        // Enlarged countdown number (dark red锯齿描边)
        const secs = Math.ceil(r.placeTimer || 0);
        ctx.save();
        ctx.font = RENDER_FONT.xLarge;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Dark red锯齿描边
        ctx.strokeStyle = RENDER_COLOR.bombCountdown;
        ctx.lineWidth = C.countdownLineWidth;
        ctx.lineJoin = 'miter';
        ctx.strokeText(`${secs}`, 0, -h * C.countdownYRatio);
        ctx.fillStyle = secs <= 1 ? RENDER_COLOR.bombCountdown : RENDER_COLOR.bombCountdownCritical;
        ctx.fillText(`${secs}`, 0, -h * C.countdownYRatio);
        ctx.restore();
      }

      if (phase === 'exploding') {
        const E = TB.exploding;
        // Phase 3: Explosion frame - dark red silhouette expanded
        const expandProgress = Math.min(1, phaseTimer / E.duration);
        const scale = 1.0 + (E.maxScale - 1.0) * (1 - expandProgress);
        ctx.scale(scale, scale);
        // Dark red silhouette overlay
        ctx.fillStyle = `rgba(${E.silhouetteColor}, ${E.silhouetteAlpha * (1 - expandProgress)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, w * E.silhouetteWRatio, h * E.silhouetteHRatio, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // ===== TIMED SUICIDE: "螂家爆破" RESIDUE RENDER =====
    // Rendered OUTSIDE transform (world coordinates) for ground scorch marks
    if (r.type === RoachType.TIMED_SUICIDE && r.breachPhase === 'residue' && r.residueTimer && r.residueTimer > 0) {
      const RS = BALANCE_CONFIG.timedBomb.residue;
      const fadeAlpha = r.residueTimer / RS.fadeDuration;
      ctx.save();
      ctx.translate(r.x, r.y);
      // Dark scorch mark (irregular edges like burnt paper)
      ctx.fillStyle = `rgba(${RS.scorchColor}, ${RS.scorchAlpha * fadeAlpha})`;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += RS.scorchAngleStep) {
        const rough = 1 + Math.sin(a * RS.scorchRoughFreq + r.id * RS.scorchIdPhase) * RS.scorchRoughAmp;
        const sr = RS.scorchRadius * rough;
        const sx = Math.cos(a) * sr;
        const sy = Math.sin(a) * sr * RS.scorchYScale;
        if (a === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      // 1-2 tiny gear/spring fragments
      ctx.fillStyle = `rgba(${RS.fragColor}, ${RS.fragAlpha * fadeAlpha})`;
      ctx.fillRect(-8, 2, 6, 3);
      ctx.fillRect(5, -3, 4, 4);
      // Thin smoke rising
      if (r.residueTimer > RS.smokeThreshold) {
        const smokeAlpha = (r.residueTimer - RS.smokeThreshold) / RS.smokeFadeDuration * RS.smokeAlpha;
        ctx.fillStyle = `rgba(${RS.smokeColor}, ${smokeAlpha})`;
        ctx.beginPath();
        ctx.ellipse(0, -RS.smokeBaseY - (RS.fadeDuration - r.residueTimer) * RS.smokeRiseSpeed, RS.smokeWidth, RS.smokeHeight, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ===== SUBWAY EXCLUSIVE: 护盾蟑螂气体护盾（前方直线 + 矩形拖尾） =====
    // 起始线（直线边界）在本体下缘；矩形向护盾蟑螂后方（上方）延伸，与 isInShieldSector 判定区一致
    if (config.showShieldRange && r.type === RoachType.SHIELD && r.state === RoachState.ALIVE && (r.shieldHp ?? 0) > 0) {
      const sub = BALANCE_CONFIG.subway;
      const hw = sub.shieldRectHalfWidth;   // 矩形半宽
      const rh = sub.shieldRectHeight;      // 矩形高度（向后方/上方延伸）
      const originY = r.y + size * 0.5; // 护盾起始线 = 本体下缘
      const hpRatio = Math.max(0, (r.shieldHp ?? 0) / (r.maxShieldHp || 1));
      const flash = Math.min(1, (r.shieldHitFlash ?? 0) / 0.15);
      const pulse = 0.3 + Math.sin(config.time * 2.5 + r.id) * 0.07; // 增亮（原 0.16 ± 0.04）
      const alpha = (pulse + flash * 0.35) * (0.4 + hpRatio * 0.6);

      ctx.save();

      // --- 1. 矩形填充（从起始线向上延伸，向尾部渐隐） ---
      // 颜色/透明度集中于 vfx-balance SHIELD_RECT_*（经 BALANCE_CONFIG.subway 访问）
      const rectGrad = ctx.createLinearGradient(r.x, originY, r.x, originY - rh);
      rectGrad.addColorStop(0, `rgba(${sub.shieldRectColor}, ${alpha * sub.shieldRectFillAlphaNear})`);
      rectGrad.addColorStop(0.6, `rgba(${sub.shieldRectColor}, ${alpha * sub.shieldRectFillAlphaMid})`);
      rectGrad.addColorStop(1, `rgba(${sub.shieldRectColor}, 0)`);
      ctx.fillStyle = rectGrad;
      ctx.fillRect(r.x - hw, originY - rh, hw * 2, rh);

      // --- 2. 直线矩形线框（四边笔直：前边/后边/两侧） ---
      ctx.strokeStyle = `rgba(${sub.shieldRectStrokeColor}, ${Math.min(1, alpha * sub.shieldRectStrokeAlphaScale + flash * sub.shieldRectStrokeFlashAlpha)})`;
      ctx.lineWidth = 2 + flash * 1.5;
      ctx.strokeRect(r.x - hw, originY - rh, hw * 2, rh);

      ctx.restore();
    }

    // ===== 护盾蟑螂气体护盾——半圆甲壳造型（常驻特效，不受 showShieldRange 调试开关控制） =====
    // 半椭圆暗红发光甲壳（视觉 200×shieldDomeHeight，与实际保护区判定 200×shieldRectHeight 解耦）：
    // 分段硬甲 = 放射肋条 × 同心环纹，缝隙透暗金微光；底部向两侧张开，同类靠近时自动延展加宽。
    // 动态（全部无状态确定性渲染）：呼吸胀缩 + 金光按环纹相位明暗流转；
    // 受击裂纹爬散 → 金光汇聚修补；受损变暗 + 焦黑灼痕 + 壳缘碎屑剥落。
    if (r.type === RoachType.SHIELD && r.state === RoachState.ALIVE && (r.shieldHp ?? 0) > 0) {
      const sub = BALANCE_CONFIG.subway;
      const hw = sub.shieldRectHalfWidth;   // 甲壳半宽 = 保护区半宽（视觉/判定一致 200 宽）
      const rh = sub.shieldDomeHeight;      // 甲壳视觉高度（与判定区高度解耦，半圆观感）
      const originY = r.y + size * 0.5; // 甲壳底边 = 本体下缘
      const hpRatio = Math.max(0, (r.shieldHp ?? 0) / (r.maxShieldHp || 1));
      const flash = Math.min(1, (r.shieldHitFlash ?? 0) / 0.15);
      // 呼吸胀缩：整体缓慢（火焰直射命中时振幅加大）；r.id 错相避免多盾同步
      const breath = Math.sin(2 * Math.PI * sub.shieldDomeBreathFreq * config.time + r.id);
      const flameFlash = (r.shieldFlameHitFlash ?? 0) > 0;
      const swell = 1 + (flameFlash ? 0.08 : sub.shieldDomeBreathAmp) * breath;
      const dim = 0.35 + 0.65 * hpRatio; // 受损发光变暗
      // 同类靠近 → 底部向两侧延展加宽（刚好罩住身后同类）：取后方保护区内同类最大横向偏离
      let widen = 0;
      for (const o of roaches) {
        if (o.id === r.id || o.state !== RoachState.ALIVE) continue;
        const dy = r.y - o.y; // 同类在后方（上方）
        if (dy < -10 || dy > rh) continue;
        const dx = Math.abs(o.x - r.x);
        if (dx > hw + sub.shieldDomeAllyWiden * 2) continue;
        widen = Math.max(widen, Math.min(sub.shieldDomeAllyWiden * 2, dx - hw + sub.shieldDomeAllyWiden));
      }
      const rx = hw * swell;
      const ry = rh * swell;
      const flare = sub.shieldDomeFlareExtra + Math.max(0, widen);
      const repair = 1 + flash * 1.2; // 受击后缝隙金光增强 = 汇聚修补

      ctx.save();
      ctx.translate(r.x, originY);

      // --- 1. 甲壳主体（暗红半透明，底部实 → 顶部渐隐，source-over） ---
      const bodyGrad = ctx.createLinearGradient(0, 0, 0, -ry);
      bodyGrad.addColorStop(0, `rgba(${sub.shieldDomeFillColor}, ${sub.shieldDomeFillAlphaBottom * dim})`);
      bodyGrad.addColorStop(1, `rgba(${sub.shieldDomeFillColor}, ${sub.shieldDomeFillAlphaTop * dim})`);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      // --- 2. 焦黑灼痕（受损出现，确定性散布于甲壳面，压在壳体上、金光下） ---
      if (hpRatio < 1) {
        const scorchA = (1 - hpRatio) * sub.shieldDomeScorchAlpha;
        for (let i = 0; i < sub.shieldDomeScorchCount; i++) {
          const th = Math.PI + Math.PI * (0.18 + 0.64 * RoachRenderer.hash01(i * 31 + r.id * 7));
          const rr = 0.25 + 0.55 * RoachRenderer.hash01(i * 13 + r.id * 17);
          const bx = rx * rr * Math.cos(th);
          const by = ry * rr * Math.sin(th);
          const br = 14 + 16 * RoachRenderer.hash01(i * 5 + r.id * 11);
          const sg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          sg.addColorStop(0, `rgba(${sub.shieldDomeScorchColor}, ${scorchA})`);
          sg.addColorStop(1, `rgba(${sub.shieldDomeScorchColor}, 0)`);
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- 3. 外缘描边 + 底部张开沿（圆润亮红壳缘；底部圆头粗线微向下弯，超出甲壳半宽 flare） ---
      ctx.strokeStyle = `rgba(${sub.shieldDomeRimColor}, ${sub.shieldDomeRimAlpha * dim})`;
      ctx.lineWidth = sub.shieldDomeRimLineWidth;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.lineWidth = sub.shieldDomeRimLineWidth + 1.5;
      ctx.beginPath();
      ctx.moveTo(-rx - flare, 2);
      ctx.quadraticCurveTo(0, 8 + flare * 0.1, rx + flare, 2);
      ctx.stroke();

      // --- 4. 分段硬甲缝隙金光（lighter 发光：同心环纹相位错开明暗流转 + 放射肋条 + 段缘翘起高光） ---
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = `rgba(${sub.shieldDomeGapColor}, ${sub.shieldDomeGapAlpha * dim})`;
      ctx.shadowBlur = sub.shieldDomeGapGlowBlur;
      for (let k = 1; k <= sub.shieldDomeRingCount; k++) {
        const s = k / (sub.shieldDomeRingCount + 1);
        // 明暗流转：各环纹相位错开，金光沿壳面流动
        const flow = 0.55 + 0.45 * Math.sin(2 * Math.PI * sub.shieldDomeBreathFreq * config.time - k * 0.9 + r.id);
        ctx.strokeStyle = `rgba(${sub.shieldDomeGapColor}, ${Math.min(1, sub.shieldDomeGapAlpha * dim * flow * repair)})`;
        ctx.lineWidth = sub.shieldDomeGapLineWidth;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * s, ry * s, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        // 段缘翘起高光：环纹内侧细亮边
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(${sub.shieldDomeEdgeColor}, ${sub.shieldDomeEdgeAlpha * dim})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * s, ry * s - 2.5, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = sub.shieldDomeGapGlowBlur;
      }
      const ribFlow = 0.6 + 0.4 * breath;
      ctx.strokeStyle = `rgba(${sub.shieldDomeGapColor}, ${Math.min(1, sub.shieldDomeGapAlpha * dim * ribFlow * repair)})`;
      ctx.lineWidth = sub.shieldDomeGapLineWidth;
      for (let i = 1; i < sub.shieldDomeSegmentCount; i++) {
        const th = Math.PI + (Math.PI * i) / sub.shieldDomeSegmentCount;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(rx * Math.cos(th), ry * Math.sin(th));
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // --- 5. 受击裂纹（击中点沿甲纹向四周爬散：随 flash 消退生长并渐隐；缝隙金光同步增强修补） ---
      if (flash > 0) {
        const grow = 1 - flash; // 0→1：裂纹爬散进度
        ctx.strokeStyle = `rgba(${sub.shieldDomeCrackColor}, ${flash * sub.shieldDomeCrackAlpha})`;
        ctx.lineWidth = sub.shieldDomeCrackLineWidth;
        // 击中点：确定性取甲壳中部一点（哈希自蟑螂 id，无状态不闪烁）
        const hTh = Math.PI + Math.PI * (0.3 + 0.4 * RoachRenderer.hash01(r.id * 3));
        const hx = rx * 0.45 * Math.cos(hTh);
        const hy = ry * 0.45 * Math.sin(hTh);
        for (let i = 0; i < sub.shieldDomeCrackCount; i++) {
          // 主方向沿放射肋条角散开，叠加哈希抖动 → 沿甲纹锯齿爬行
          const ang = hTh + (i - (sub.shieldDomeCrackCount - 1) / 2) * 0.28;
          const maxLen = 6 + (26 + 30 * RoachRenderer.hash01(i * 7 + r.id * 13)) * grow;
          let px = hx;
          let py = hy;
          ctx.beginPath();
          ctx.moveTo(px, py);
          for (let seg = 1; seg <= 3; seg++) {
            const jag = (RoachRenderer.hash01(i * 31 + seg * 17 + r.id * 5) - 0.5) * 0.5;
            px += Math.cos(ang + jag) * (maxLen / 3);
            py += Math.sin(ang + jag) * (maxLen / 3);
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      // --- 6. 边缘碎屑剥落（护盾 HP 低于阈值：壳缘焦褐碎屑向外下方飘散，确定性循环） ---
      const dmg = 1 - hpRatio / sub.shieldDomeDebrisHpThreshold;
      if (dmg > 0) {
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < sub.shieldDomeDebrisCount; i++) {
          const life = sub.shieldDomeDebrisLife;
          const t = config.time * 1000 + (i / sub.shieldDomeDebrisCount) * life;
          const slot = Math.floor(t / life);       // 生命槽位（本轮种子）
          const p = (t - slot * life) / life;      // 槽内进度 0→1
          const th = Math.PI + Math.PI * RoachRenderer.hash01(slot * 31 + i * 7 + r.id * 13);
          const sx = rx * Math.cos(th) + Math.cos(th) * 34 * p; // 壳缘起点向外漂移
          const sy = ry * Math.sin(th) + p * p * 46;            // p² 加速下落
          const rot = RoachRenderer.hash01(i * 11 + slot * 3) * Math.PI + p * 5;
          const ds = sub.shieldDomeDebrisSize * (1 - 0.4 * p);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(rot);
          ctx.fillStyle = `rgba(${sub.shieldDomeDebrisColor}, ${(1 - p) * Math.min(1, dmg) * 0.9})`;
          ctx.fillRect(-ds / 2, -ds / 2, ds, ds * 0.7);
          ctx.restore();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    // ===== SUBWAY EXCLUSIVE: 破盾玻璃碎裂特效（无状态：shieldBrokenTimer 倒计时驱动，仅破碎后 shieldBreakDuration 秒内显示） =====
    // 光带同位置 + lighter 叠加：瞬间白色闪光 → 放射状锯齿裂纹定格渐隐 → 三角玻璃碎片向外飞散自转（全部确定性 hash，无状态）
    if (r.type === RoachType.SHIELD && r.state === RoachState.ALIVE && (r.shieldBrokenTimer ?? 0) > 0) {
      const sub = BALANCE_CONFIG.subway;
      const elapsed = sub.shieldRebuildDelay - (r.shieldBrokenTimer ?? 0);
      const dur = sub.shieldBreakDuration;
      if (elapsed >= 0 && elapsed < dur) {
        const p = elapsed / dur;                       // 特效进度 0→1
        const fade = 1 - p;                            // 渐隐系数
        const hw = sub.shieldRectHalfWidth;            // 光带半宽
        const bandH = sub.shieldBandHeight;            // 光带高度
        const yRatio = bandH / (hw * 2);               // y 压缩比（与光带椭圆一致）
        const originY = r.y + size * 0.5;          // 光带底边 = 本体下缘

        ctx.save();
        ctx.globalCompositeOperation = sub.shieldBreakBlend;
        ctx.translate(r.x, originY - bandH / 2);

        // --- 1. 瞬间白色闪光（y 压缩椭圆，前 25% 进度内快速熄灭，玻璃爆裂强高光） ---
        const flashFade = Math.max(0, 1 - p / 0.25);
        if (flashFade > 0) {
          ctx.save();
          ctx.scale(1, yRatio);
          const flashGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, hw);
          flashGrad.addColorStop(0, `rgba(${sub.shieldBreakFlashColor}, ${flashFade * sub.shieldBreakFlashAlpha})`);
          flashGrad.addColorStop(1, `rgba(${sub.shieldBreakFlashColor}, 0)`);
          ctx.fillStyle = flashGrad;
          ctx.fillRect(-hw, -hw, hw * 2, hw * 2);
          ctx.restore();
        }

        // --- 2. 放射状裂纹（破碎瞬间定格，前半程渐隐；每条 3 段锯齿折线模拟玻璃裂纹） ---
        const crackFade = Math.max(0, 1 - p / 0.5);
        if (crackFade > 0) {
          ctx.strokeStyle = `rgba(${sub.shieldBreakCrackColor}, ${crackFade * sub.shieldBreakCrackAlpha})`;
          ctx.lineWidth = sub.shieldBreakCrackLineWidth;
          for (let i = 0; i < sub.shieldBreakCrackCount; i++) {
            const ang = RoachRenderer.hash01(i * 7 + r.id * 13) * Math.PI * 2;  // 裂纹主方向
            const totalLen = hw * (0.6 + 0.4 * RoachRenderer.hash01(i * 3 + r.id * 11)); // 裂纹总长
            ctx.beginPath();
            ctx.moveTo(0, 0);
            let cx = 0, cy = 0;
            for (let seg = 1; seg <= 3; seg++) {
              // 每段沿主方向推进 1/3，方向叠加哈希抖动形成锯齿
              const segAng = ang + (RoachRenderer.hash01(i * 31 + seg * 17 + r.id * 5) - 0.5) * 0.7;
              cx += Math.cos(segAng) * (totalLen / 3);
              cy += Math.sin(segAng) * (totalLen / 3) * yRatio;
              ctx.lineTo(cx, cy);
            }
            ctx.stroke();
          }
        }

        // --- 3. 三角玻璃碎片（向外飞散 + 自转 + 轻微下落；淡蓝半透明填充 + 近白描边，全程渐隐） ---
        for (let i = 0; i < sub.shieldBreakShardCount; i++) {
          const ang = RoachRenderer.hash01(i * 7 + r.id * 13) * Math.PI * 2;          // 飞散方向
          const d = p * sub.shieldBreakShardFly * (0.5 + 0.5 * RoachRenderer.hash01(i * 3 + r.id * 11)); // 飞散距离（有快有慢）
          const size = sub.shieldBreakShardSizeMin + RoachRenderer.hash01(i * 5 + r.id * 17) * (sub.shieldBreakShardSizeMax - sub.shieldBreakShardSizeMin);
          const rot = RoachRenderer.hash01(i * 11 + r.id * 23) * Math.PI * 2 + p * 6 * (RoachRenderer.hash01(i * 13 + r.id * 29) - 0.5); // 初始角 + 自转
          const sx = Math.cos(ang) * d;
          const sy = Math.sin(ang) * d * yRatio + p * p * 20; // p² 项模拟碎片加速下落
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(rot);
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.6);
          ctx.lineTo(size * 0.55, size * 0.45);
          ctx.lineTo(-size * 0.55, size * 0.45);
          ctx.closePath();
          ctx.fillStyle = `rgba(${sub.shieldBreakShardFillColor}, ${fade * sub.shieldBreakShardFillAlpha})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(${sub.shieldBreakShardEdgeColor}, ${fade * sub.shieldBreakShardEdgeAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }
    }

    // ===== HP bar + Armor bar: show for ALL roaches that have armor buff =====
    const barW = r.isBoss ? 60 : Math.max(32, (r.size ?? 30) * 0.5) * perspScale;
    const barH = r.isBoss ? 8 : 5;
    // Always show HP bar for armored/shielded roaches, large/boss roaches
    const showHpBar = r.armorHp > 0 || r.isBoss || r.type === RoachType.SMALL || r.type === RoachType.LARGE || r.type === RoachType.ARMORED || r.type === RoachType.SPLITTING || r.type === RoachType.NURSE || r.type === RoachType.TIMED_SUICIDE || r.type === RoachType.TUNNEL_WORKER || r.type === RoachType.SUBWAY_ELITE || r.type === RoachType.SHIELD;
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

    // ===== 气体护盾条：护盾蟑螂专属（护甲条上方一行，避免与喷涂护甲重叠） =====
    if (r.type === RoachType.SHIELD && r.state === RoachState.ALIVE && (r.maxShieldHp ?? 0) > 0) {
      const shieldRatio = Math.max(0, (r.shieldHp ?? 0) / (r.maxShieldHp || 1));
      const broken = (r.shieldBrokenTimer ?? 0) > 0;
      // 护盾条背景
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(r.x - barW / 2, r.y - size - 31, barW, 4);
      if (!broken) {
        // 护盾填充（青色渐变）
        const shieldGrad = ctx.createLinearGradient(r.x - barW / 2, 0, r.x + barW / 2, 0);
        shieldGrad.addColorStop(0, '#164e63');
        shieldGrad.addColorStop(1, '#67e8f9');
        ctx.fillStyle = shieldGrad;
        ctx.fillRect(r.x - barW / 2, r.y - size - 31, barW * shieldRatio, 4);
      } else {
        // 破碎中：暗红重建进度条
        const rebuildRatio = Math.max(0, 1 - (r.shieldBrokenTimer ?? 0) / BALANCE_CONFIG.subway.shieldRebuildDelay);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.fillRect(r.x - barW / 2, r.y - size - 31, barW * rebuildRatio, 4);
      }
      // 护盾条边框
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x - barW / 2, r.y - size - 31, barW, 4);
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
      const en = BALANCE_CONFIG.render.roach.enrageIndicator; // 颜色/透明度/混合集中于 vfx-balance
      ctx.save();
      ctx.globalCompositeOperation = en.blend;
      ctx.strokeStyle = `rgba(${en.color}, ${en.ringAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 6, 0, Math.PI * 2);
      ctx.stroke();
      const pulse = (Math.sin(config.time * 12) + 1) * 0.5;
      ctx.strokeStyle = `rgba(${en.color}, ${pulse * en.pulseAlphaScale})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 6 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Stun effect (deterministic pulse, no per-frame random flicker)
    if (r.isStunned) {
      const st = BALANCE_CONFIG.render.roach.stunEffect; // 颜色/透明度/混合集中于 vfx-balance
      const stunPulse = (Math.sin(config.time * 8) + 1) * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = st.blend;
      ctx.strokeStyle = `rgba(${st.boltColor}, ${st.boltAlphaBase + stunPulse * st.boltAlphaPulse})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = `rgba(${st.boltGlowColor}, ${st.boltGlowAlpha})`;
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
      ctx.fillStyle = `rgba(${st.haloColor}, ${st.haloAlphaBase + stunPulse * st.haloAlphaPulse})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Poison indicator
    if (r.poisonTimer > 0) {
      const pi = BALANCE_CONFIG.render.roach.poisonIndicator; // 颜色/透明度/混合集中于 vfx-balance
      ctx.save();
      ctx.globalCompositeOperation = pi.blend;
      ctx.fillStyle = `rgba(${pi.color}, ${pi.alphaBase + Math.sin(config.time * 4) * pi.alphaPulseAmp})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Suicide fuse
    if (r.isFused) {
      const fu = BALANCE_CONFIG.render.roach.suicideFuse; // 颜色/透明度/混合集中于 vfx-balance
      const fusePulse = (Math.sin(config.time * 20) + 1) * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = fu.blend;
      ctx.fillStyle = `rgba(${fu.color}, ${fu.alphaBase + fusePulse * fu.alphaPulseAmp})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y - size - 5, 4 + fusePulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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