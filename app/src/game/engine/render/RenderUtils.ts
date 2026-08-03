/**
 * @fileoverview 渲染工具模块
 * @description 提供特殊武器和效果的静态渲染方法
 *   - 雷达激光目标由调用方预解析，渲染方法不修改状态
 *   - 使用归一化渐变缓存减少每帧 createRadialGradient 调用
 *   - 使用 measureText 缓存减少重复测量
 */

import { SceneType, RoachState, RoachType } from '../../types';
import type { Roach, Player, TripleFlameState } from '../../types';
import { SCENE_GROUND_BOUNDS, TEXT_CONFIG, RENDER_COLOR, RENDER_FONT, BALANCE_CONFIG } from '../../data';

/** 杀虫剂喷雾状态（引擎内联类型） */
export interface InsecticideSprayState {
  active: boolean;
  timer: number;
  duration: number;
  damageInterval: number;
  damageTimer: number;
  sprayAngle: number;
  spraySpread: number;
  baseDamage: number;
}

/** 电蚊拍渲染参数（合并原 7 个独立参数） */
export interface SwatterRenderParams {
  active: boolean;
  animTimer: number;
  swingX: number;
  canvasWidth: number;
  canvasHeight: number;
  roaches: Roach[];
}

/**
 * 渲染工具类
 * @description 提供纯静态渲染方法，不维护内部状态（渐变缓存除外）
 */
export class RenderUtils {
  // ===== 归一化渐变缓存 =====

  /** 杀虫剂喷雾锥体渐变 */
  private static _sprayConeGrad: CanvasGradient | null = null;
  /** 杀虫剂喷嘴辉光渐变 */
  private static _nozzleGlowGrad: CanvasGradient | null = null;
  /** Power Boost 粒子辉光渐变（按颜色索引缓存） */
  private static _boostGlowGrads: Map<string, CanvasGradient> = new Map();
  /** 电蚊拍辉光渐变 */
  private static _swatterGlowGrad: CanvasGradient | null = null;

  // ===== measureText 缓存 =====

  private static _textWidthCache: Map<string, number> = new Map();

  /**
   * 安全将颜色字符串转换为 rgba 格式
   */
  private static toRgba(color: string, alpha: number): string {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    return color;
  }

  /** 获取缓存的文本宽度 */
  private static getCachedTextWidth(ctx: CanvasRenderingContext2D, text: string, font: string): number {
    const key = `${font}|${text}`;
    let w = this._textWidthCache.get(key);
    if (w === undefined) {
      ctx.save();
      ctx.font = font;
      w = ctx.measureText(text).width;
      ctx.restore();
      this._textWidthCache.set(key, w);
    }
    return w;
  }

  // ===== 渐变获取方法 =====

  private static getSprayConeGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (!this._sprayConeGrad) {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, 'rgba(80, 255, 100, 0.5)');
      grad.addColorStop(0.4, 'rgba(60, 220, 80, 0.3)');
      grad.addColorStop(0.7, 'rgba(40, 180, 60, 0.15)');
      grad.addColorStop(1, 'rgba(20, 120, 40, 0)');
      this._sprayConeGrad = grad;
    }
    return this._sprayConeGrad;
  }

  private static getNozzleGlowGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (!this._nozzleGlowGrad) {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, 'rgba(150, 255, 150, 0.8)');
      grad.addColorStop(1, 'rgba(50, 200, 50, 0)');
      this._nozzleGlowGrad = grad;
    }
    return this._nozzleGlowGrad;
  }

  private static getBoostGlowGradient(ctx: CanvasRenderingContext2D, color: string): CanvasGradient {
    let grad = this._boostGlowGrads.get(color);
    if (!grad) {
      grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, `rgba(${color}, 0.3)`);
      grad.addColorStop(1, `rgba(${color}, 0)`);
      this._boostGlowGrads.set(color, grad);
    }
    return grad;
  }

  private static getSwatterGlowGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (!this._swatterGlowGrad) {
      const cfg = BALANCE_CONFIG.render.renderUtils.swatter;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, `rgba(${cfg.outerGlowColor}, 1)`);
      grad.addColorStop(1, `rgba(${cfg.outerGlowColor2}, 0)`);
      this._swatterGlowGrad = grad;
    }
    return this._swatterGlowGrad;
  }

  /**
   * 渲染雷达激光（目标由调用方预解析，渲染方法不修改状态）
   * @param ctx Canvas 渲染上下文
   * @param target 预解析的目标蟑螂（null 则不渲染）
   * @param active 是否激活
   * @param timer 激活计时器（用于渐显）
   * @param playerX 玩家X坐标
   * @param playerY 玩家Y坐标
   * @param time 游戏时间
   */
  static renderRadarLaser(
    ctx: CanvasRenderingContext2D,
    target: Roach | null,
    active: boolean,
    timer: number,
    playerX: number,
    playerY: number,
    time: number
  ): void {
    if (!active || !target) return;

    const cfg = BALANCE_CONFIG.render.renderUtils.radarLaser;
    const px = playerX;
    const py = playerY;
    const tx = target.x;
    const ty = target.y;

    const alpha = Math.min(1, timer / cfg.fadeInDuration) * (cfg.baseAlpha + Math.sin(time * cfg.pulseFreq) * cfg.pulseAmp);
    ctx.save();

    // 外部辉光
    ctx.strokeStyle = `rgba(${cfg.colorBody}, ${alpha * cfg.outerGlowAlpha})`;
    ctx.lineWidth = cfg.outerGlowWidth;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // 中间辉光
    ctx.strokeStyle = `rgba(${cfg.colorBody}, ${alpha * cfg.midGlowAlpha})`;
    ctx.lineWidth = cfg.midGlowWidth;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // 核心光束
    ctx.strokeStyle = `rgba(${cfg.colorBright}, ${alpha})`;
    ctx.lineWidth = cfg.coreWidth;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // 目标锁定指示器
    const lockPulse = cfg.lockPulseBase + Math.sin(time * cfg.lockPulseFreq) * cfg.lockPulseAmp;
    ctx.strokeStyle = `rgba(${cfg.colorBody}, ${lockPulse})`;
    ctx.lineWidth = cfg.lockRingWidth;
    ctx.beginPath();
    ctx.arc(tx, ty, cfg.lockRingRadius + lockPulse * cfg.lockRingAmp, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(${cfg.colorBody}, ${lockPulse * cfg.lockFillAlpha})`;
    ctx.beginPath();
    ctx.arc(tx, ty, cfg.lockFillRadius, 0, Math.PI * 2);
    ctx.fill();

    // 玩家发射器辉光
    ctx.fillStyle = `rgba(${cfg.colorBody}, ${alpha * cfg.emitterAlpha})`;
    ctx.beginPath();
    ctx.arc(px, py, cfg.emitterRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 渲染杀虫剂喷雾
   */
  static renderInsecticideSpray(
    ctx: CanvasRenderingContext2D,
    spray: InsecticideSprayState,
    canvasWidth: number,
    defenseLineY: number,
    time: number
  ): void {
    if (!spray.active) return;
    const cfg = BALANCE_CONFIG.render.renderUtils.insecticide;
    const cx = canvasWidth / 2;
    const cy = defenseLineY;
    const halfSpread = spray.spraySpread / 2;

    const progress = spray.timer / spray.duration;
    const pulseAlpha = cfg.pulseBaseAlpha + cfg.pulseAmpAlpha * Math.sin(time * cfg.pulseFreq) * progress;

    ctx.save();
    ctx.globalAlpha = pulseAlpha;

    // 径向渐变喷雾锥体（缓存渐变）
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(cfg.range, cfg.range);
    ctx.fillStyle = RenderUtils.getSprayConeGradient(ctx);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 1, spray.sprayAngle - halfSpread, spray.sprayAngle + halfSpread);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 喷雾边界线
    ctx.globalAlpha = cfg.boundaryAlpha * progress;
    ctx.strokeStyle = cfg.boundaryStroke;
    ctx.lineWidth = cfg.boundaryWidth;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spray.sprayAngle - halfSpread) * cfg.range, cy + Math.sin(spray.sprayAngle - halfSpread) * cfg.range);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spray.sprayAngle + halfSpread) * cfg.range, cy + Math.sin(spray.sprayAngle + halfSpread) * cfg.range);
    ctx.stroke();

    // 中心喷雾线（save/restore 防止 dash 泄漏）
    ctx.save();
    ctx.globalAlpha = cfg.centerAlpha * progress;
    ctx.strokeStyle = cfg.centerStroke;
    ctx.lineWidth = cfg.centerWidth;
    ctx.setLineDash([...cfg.centerDash]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spray.sprayAngle) * cfg.range, cy + Math.sin(spray.sprayAngle) * cfg.range);
    ctx.stroke();
    ctx.restore();

    // 喷嘴辉光（缓存渐变）
    ctx.globalAlpha = cfg.nozzleGlowAlpha * progress;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(cfg.nozzleRadius, cfg.nozzleRadius);
    ctx.fillStyle = RenderUtils.getNozzleGlowGradient(ctx);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 计时器文字
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = RENDER_COLOR.groundBounds;
    ctx.font = RENDER_FONT.normal;
    ctx.textAlign = 'center';
    ctx.fillText(TEXT_CONFIG.combat.insecticideTimer.text(spray.timer.toFixed(1)), cx, cy + cfg.timerOffsetY);

    ctx.restore();
  }

  /**
   * 渲染电蚊拍
   */
  static renderSwatter(
    ctx: CanvasRenderingContext2D,
    params: SwatterRenderParams
  ): void {
    if (!params.active) return;
    const cfg = BALANCE_CONFIG.render.renderUtils.swatter;

    const progress = 1 - params.animTimer / cfg.animDuration;
    const w = params.canvasWidth;
    const h = params.canvasHeight;
    const swatX = params.swingX;
    const startY = h * cfg.startYRatio;
    const endY = h * cfg.endYRatio;
    const currentY = startY + (endY - startY) * Math.min(1, progress * 1.5);

    const headW = w * cfg.headWRatio;
    const headH = h * cfg.headHRatio;
    const headY = currentY;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // 辉光（缓存渐变）
    ctx.save();
    ctx.translate(swatX, headY + headH / 2);
    ctx.scale(headW * cfg.outerGlowFalloff, headW * cfg.outerGlowFalloff);
    ctx.globalAlpha = cfg.outerGlowAlpha * (1 - progress);
    ctx.fillStyle = RenderUtils.getSwatterGlowGradient(ctx);
    ctx.fillRect(-1, -headH / (headW * cfg.outerGlowFalloff), 2, headH * 3 / (headW * cfg.outerGlowFalloff));
    ctx.restore();

    // 矩形边框
    ctx.strokeStyle = `rgba(${cfg.rectStroke}, ${cfg.rectStrokeAlpha * (1 - progress * cfg.rectStrokeDecay)})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(swatX - headW / 2, headY, headW, headH);

    // 网格
    ctx.strokeStyle = `rgba(${cfg.gridStroke}, ${cfg.gridStrokeAlpha * (1 - progress * cfg.rectStrokeDecay)})`;
    ctx.lineWidth = 1;
    for (let c = 1; c < cfg.gridCols; c++) {
      const gx = swatX - headW / 2 + (headW / cfg.gridCols) * c;
      ctx.beginPath();
      ctx.moveTo(gx, headY);
      ctx.lineTo(gx, headY + headH);
      ctx.stroke();
    }
    for (let r = 1; r < cfg.gridRows; r++) {
      const gy = headY + (headH / cfg.gridRows) * r;
      ctx.beginPath();
      ctx.moveTo(swatX - headW / 2, gy);
      ctx.lineTo(swatX + headW / 2, gy);
      ctx.stroke();
    }

    // 手柄
    ctx.strokeStyle = `rgba(${cfg.handleStroke}, ${cfg.handleStrokeAlpha * (1 - progress)})`;
    ctx.lineWidth = cfg.handleWidth;
    ctx.beginPath();
    ctx.moveTo(swatX, headY + headH);
    ctx.lineTo(swatX, headY + headH + h * cfg.handleLengthRatio);
    ctx.stroke();

    // 电弧
    if (progress > cfg.arcPhaseStart && progress < cfg.arcPhaseEnd) {
      const arcAlpha = Math.sin((progress - cfg.arcPhaseStart) / (cfg.arcPhaseEnd - cfg.arcPhaseStart) * Math.PI) * cfg.arcAlphaPeak;
      ctx.strokeStyle = `rgba(${cfg.arcStroke}, ${arcAlpha})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `rgba(${cfg.arcGlowColor}, 0.8)`;
      ctx.shadowBlur = cfg.arcGlowBlur;

      for (let i = 0; i < cfg.arcCount; i++) {
        const ax = swatX - headW / 2 + Math.random() * headW;
        const ay = headY + Math.random() * headH;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        for (let j = 0; j < cfg.arcSegments; j++) {
          ctx.lineTo(ax + (Math.random() - 0.5) * cfg.arcWidth, ay + j * cfg.arcHeight);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      ctx.fillStyle = `rgba(${cfg.arcFill}, ${arcAlpha * cfg.arcFillAlpha})`;
      ctx.fillRect(swatX - headW / 2, headY, headW, headH);
    }

    // 眩晕星星
    for (const r of params.roaches) {
      if (r.isStunned && Math.random() < cfg.stunStarChance) {
        const sz = r.type === RoachType.LARGE ? cfg.stunStarSize.large : cfg.stunStarSize.small;
        ctx.fillStyle = `rgba(${cfg.stunStar}, ${cfg.stunStarAlphaBase + Math.random() * cfg.stunStarAlphaRange})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y - sz, 2 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * 渲染枪口闪光
   */
  static renderMuzzleFlash(
    ctx: CanvasRenderingContext2D,
    player: Player,
    tripleFlame: TripleFlameState
  ): void {
    if (!player.isFiring || player.isOverheated || player.isReloading || player.gas <= 0) return;

    const cfg = BALANCE_CONFIG.render.renderUtils.muzzleFlash;
    const nozzleOffsetY = BALANCE_CONFIG.player.nozzleOffsetY;
    const my = player.y - nozzleOffsetY;

    const gunXs: number[] = [player.x];
    if (tripleFlame.active) {
      gunXs.push(player.x - tripleFlame.sideOffset);
      gunXs.push(player.x + tripleFlame.sideOffset);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let gi = 0; gi < gunXs.length; gi++) {
      const mx = gunXs[gi];
      const isSideGun = gi > 0;
      const scale = isSideGun ? cfg.sideGunScale : 1.0;

      if (player.powerBoostTimer > 0) {
        const boostAlpha = Math.min(1, player.powerBoostTimer / cfg.boostAlphaFadeTime);

        for (let pi = 0; pi < cfg.boostParticleCount; pi++) {
          const sprayAngle = Math.random() * Math.PI * 2;
          const sprayDist = cfg.boostSprayDistMin + Math.random() * (cfg.boostSprayDistMax - cfg.boostSprayDistMin);
          const px = mx + Math.cos(sprayAngle) * sprayDist;
          const py = my + Math.sin(sprayAngle) * sprayDist * cfg.boostSprayYScale - Math.random() * cfg.boostSprayYRandom;
          const pSize = (cfg.boostParticleSizeBase + Math.random() * cfg.boostParticleSizeRange) * scale;
          const color = cfg.boostColors[Math.floor(Math.random() * cfg.boostColors.length)];
          const pAlpha = (cfg.boostAlphaBase + Math.random() * cfg.boostAlphaRange) * boostAlpha;

          // 粒子核心
          ctx.fillStyle = `rgba(${color}, ${pAlpha})`;
          ctx.beginPath();
          ctx.arc(px, py, pSize, 0, Math.PI * 2);
          ctx.fill();

          // 粒子辉光（缓存渐变）
          ctx.save();
          ctx.translate(px, py);
          ctx.scale(pSize * cfg.boostGlowSizeMultiplier, pSize * cfg.boostGlowSizeMultiplier);
          ctx.globalAlpha = pAlpha * cfg.boostGlowAlphaRatio;
          ctx.fillStyle = RenderUtils.getBoostGlowGradient(ctx, color);
          ctx.beginPath();
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  /**
   * 渲染道具放置预览
   */
  static renderItemPlacement(
    ctx: CanvasRenderingContext2D,
    itemPlaceState: string,
    selectedItemIndex: number,
    inventory: { type: string }[],
    cursorX: number,
    cursorY: number,
    radiusX: number,
    radiusY: number,
    time: number
  ): void {
    if (itemPlaceState !== 'placing' || selectedItemIndex < 0) return;
    const item = inventory[selectedItemIndex];
    if (!item) return;

    const cfg = BALANCE_CONFIG.render.renderUtils.itemPlacement;
    const cx = cursorX;
    const cy = cursorY;
    const rx = radiusX;
    const ry = radiusY;
    const pulse = (Math.sin(time * 4) + 1) * 0.5;
    const c = cfg.typeColors[item.type] || cfg.defaultColor;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Large filled area
    ctx.fillStyle = `rgba(${c}, ${cfg.fillAlpha})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer boundary ring
    ctx.strokeStyle = `rgba(${c}, ${cfg.ringAlphaBase + pulse * cfg.ringAlphaAmp})`;
    ctx.lineWidth = cfg.ringWidth;
    ctx.setLineDash([cfg.ringDashBase + pulse * cfg.ringDashAmp, cfg.ringDashGap]);
    ctx.lineDashOffset = -time * cfg.ringDashSpeed;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner ring
    ctx.strokeStyle = `rgba(${c}, ${cfg.innerRingAlpha})`;
    ctx.lineWidth = cfg.innerRingWidth;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * cfg.innerRingScale, ry * cfg.innerRingScale, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 4 directional range lines
    ctx.strokeStyle = `rgba(${c}, ${cfg.dirLineAlpha})`;
    ctx.lineWidth = cfg.dirLineWidth;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy); ctx.lineTo(cx + rx, cy);
    ctx.moveTo(cx, cy - ry); ctx.lineTo(cx, cy + ry);
    ctx.stroke();

    // Crosshair with glow
    ctx.shadowColor = `rgba(${c}, 0.8)`;
    ctx.shadowBlur = cfg.crosshairShadowBlur;
    ctx.strokeStyle = `rgba(${c}, 1)`;
    ctx.lineWidth = cfg.crosshairWidth;
    const csx = Math.min(cfg.crosshairMaxLen, rx * cfg.crosshairScaleX);
    const csy = Math.min(cfg.crosshairMaxLen, ry * cfg.crosshairScaleY);
    ctx.beginPath();
    ctx.moveTo(cx - csx, cy); ctx.lineTo(cx - cfg.crosshairMinLen, cy);
    ctx.moveTo(cx + cfg.crosshairMinLen, cy); ctx.lineTo(cx + csx, cy);
    ctx.moveTo(cx, cy - csy); ctx.lineTo(cx, cy - cfg.crosshairMinLen);
    ctx.moveTo(cx, cy + cfg.crosshairMinLen); ctx.lineTo(cx, cy + csy);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dot
    ctx.shadowColor = `rgba(${c}, 1)`;
    ctx.shadowBlur = cfg.centerDotShadowBlur;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, cfg.centerDotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    const names: Record<string, string> = { sticky: TEXT_CONFIG.items.sticky, poison: TEXT_CONFIG.items.poison, molotov: TEXT_CONFIG.items.molotov, shotgun: TEXT_CONFIG.items.shotgun };
    const label1 = `点击放置 ${names[item.type] || '道具'}`;
    const label2 = `范围: X${rx} x Y${ry}`;
    ctx.font = cfg.labelFont;
    ctx.textAlign = 'center';
    const m1w = RenderUtils.getCachedTextWidth(ctx, label1, cfg.labelFont);
    const m2w = RenderUtils.getCachedTextWidth(ctx, label2, cfg.labelFont2);
    const lw = Math.max(m1w, m2w) + 20;
    const ly = cy - ry - cfg.labelYOffset;

    ctx.fillStyle = `rgba(0, 0, 0, ${cfg.labelBgAlpha})`;
    ctx.beginPath();
    ctx.roundRect(cx - lw / 2, ly, lw, cfg.labelBgHeight, cfg.labelBgRadius);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(label1, cx, ly + 20);
    ctx.font = cfg.labelFont2;
    ctx.fillStyle = `rgba(${c}, 1)`;
    ctx.fillText(label2, cx, ly + 37);

    ctx.restore();
  }

  /**
   * 渲染防线（虚线 + 护盾光效）
   */
  static renderDefenseLine(
    ctx: CanvasRenderingContext2D,
    w: number,
    defenseLineY: number,
    defenseLineColor: string,
    time: number,
    shieldTimer: number
  ): void {
    const cfg = BALANCE_CONFIG.render.renderUtils.defenseLine;
    const dl = defenseLineY;

    ctx.save();
    ctx.strokeStyle = defenseLineColor;
    ctx.lineWidth = cfg.lineWidth;
    ctx.setLineDash([...cfg.dash]);
    ctx.lineDashOffset = -time * cfg.dashSpeed;
    ctx.beginPath();
    ctx.moveTo(0, dl);
    ctx.lineTo(w, dl);
    ctx.stroke();
    ctx.setLineDash([]);

    // 安全提取颜色透明度：用正则匹配 rgba 中的 alpha 值
    const alphaMatch = defenseLineColor.match(/[\d.]+(?=\s*\)$)/);
    const baseAlpha = alphaMatch ? parseFloat(alphaMatch[0]) : 0.7;
    ctx.fillStyle = defenseLineColor.replace(String(baseAlpha), String(cfg.fillAlpha));
    ctx.fillRect(0, dl, w, cfg.fillHeight);
    ctx.restore();

    ctx.fillStyle = `rgba(255, 255, 255, ${cfg.labelAlpha})`;
    ctx.font = cfg.labelFont;
    ctx.textAlign = 'center';
    ctx.fillText(TEXT_CONFIG.combat.defenseLine.text, w / 2, dl + cfg.labelOffsetY);

    // 护盾
    if (shieldTimer > 0) {
      const shieldAlpha = cfg.shieldAlphaBase + Math.sin(time * cfg.shieldAlphaFreq) * cfg.shieldAlphaAmp;
      const shieldY = dl - cfg.shieldYOffset;
      ctx.save();
      ctx.shadowColor = cfg.shieldGlowColor;
      ctx.shadowBlur = cfg.shieldGlowBase + Math.sin(time * cfg.shieldGlowFreq) * cfg.shieldGlowAmp;
      ctx.strokeStyle = `rgba(${cfg.shieldColor}, ${shieldAlpha})`;
      ctx.lineWidth = cfg.shieldLineWidth;
      ctx.beginPath();
      ctx.moveTo(0, shieldY);
      ctx.lineTo(w, shieldY);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${cfg.shieldCoreColor}, ${shieldAlpha * cfg.shieldCoreAlphaRatio})`;
      ctx.lineWidth = cfg.shieldCoreWidth;
      ctx.beginPath();
      ctx.moveTo(0, shieldY);
      ctx.lineTo(w, shieldY);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * 渲染移动范围（蟑螂地面边界6点折线可视化）
   */
  static renderMovementRange(
    ctx: CanvasRenderingContext2D,
    currentScene: SceneType,
    defenseLineY: number,
    getGroundBoundsAtY: (y: number) => [number, number]
  ): void {
    const cfg = BALANCE_CONFIG.render.renderUtils.movementRange;
    const [farL, farLY, farR, farRY, midL, midLY, midR, midRY, nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[currentScene];

    ctx.save();

    // 1. 半透明填充
    ctx.fillStyle = cfg.fillColor;
    ctx.beginPath();
    ctx.moveTo(farL, farLY);
    ctx.lineTo(farR, farRY);
    ctx.lineTo(midR, midRY);
    ctx.lineTo(nearR, nearY);
    ctx.lineTo(nearL, nearY);
    ctx.lineTo(midL, midLY);
    ctx.closePath();
    ctx.fill();

    // 2. 左侧折线
    ctx.strokeStyle = cfg.sideStroke;
    ctx.lineWidth = cfg.sideWidth;
    ctx.beginPath();
    ctx.moveTo(farL, farLY);
    ctx.lineTo(midL, midLY);
    ctx.lineTo(nearL, nearY);
    ctx.stroke();

    // 3. 右侧折线
    ctx.beginPath();
    ctx.moveTo(farR, farRY);
    ctx.lineTo(midR, midRY);
    ctx.lineTo(nearR, nearY);
    ctx.stroke();

    // 4. 远边界
    ctx.strokeStyle = cfg.farStroke;
    ctx.lineWidth = cfg.farWidth;
    ctx.beginPath();
    ctx.moveTo(farL, farLY);
    ctx.lineTo(farR, farRY);
    ctx.stroke();

    // 5. 近边界
    ctx.strokeStyle = cfg.nearStroke;
    ctx.lineWidth = cfg.nearWidth;
    ctx.beginPath();
    ctx.moveTo(nearL, nearY);
    ctx.lineTo(nearR, nearY);
    ctx.stroke();

    // 6. 防线参考线
    const [defL, defR] = getGroundBoundsAtY(defenseLineY);
    ctx.strokeStyle = cfg.defLineStroke;
    ctx.lineWidth = cfg.defLineWidth;
    ctx.setLineDash([...cfg.defLineDash]);
    ctx.beginPath();
    ctx.moveTo(defL, defenseLineY);
    ctx.lineTo(defR, defenseLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 7. 角标记
    const corners = [
      { x: farL,  y: farLY, label: `(${Math.round(farL)},${Math.round(farLY)})`, alignX: 'left', offsetX: cfg.pillOffsetX },
      { x: farR,  y: farRY, label: `(${Math.round(farR)},${Math.round(farRY)})`, alignX: 'right', offsetX: -cfg.pillOffsetX },
      { x: midL,  y: midLY, label: `(${Math.round(midL)},${Math.round(midLY)})`, alignX: 'left', offsetX: cfg.pillOffsetX },
      { x: midR,  y: midRY, label: `(${Math.round(midR)},${Math.round(midRY)})`, alignX: 'right', offsetX: -cfg.pillOffsetX },
      { x: nearL, y: nearY, label: `(${Math.round(nearL)},${Math.round(nearY)})`, alignX: 'left', offsetX: cfg.pillOffsetX },
      { x: nearR, y: nearY, label: `(${Math.round(nearR)},${Math.round(nearY)})`, alignX: 'right', offsetX: -cfg.pillOffsetX },
    ];
    for (const corner of corners) {
      ctx.font = cfg.textFont;
      const tw = RenderUtils.getCachedTextWidth(ctx, corner.label, cfg.textFont);
      const pillW = tw + 8;
      const pillX = corner.alignX === 'left' ? corner.x + corner.offsetX - 4 : corner.x + corner.offsetX - pillW + 4;
      const pillY = corner.y + cfg.pillOffsetY - cfg.pillHeight / 2;
      ctx.fillStyle = cfg.pillBg;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, cfg.pillHeight, cfg.pillRadius);
      ctx.fill();
      ctx.fillStyle = cfg.cornerFill;
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, cfg.cornerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cfg.cornerStroke;
      ctx.lineWidth = cfg.cornerStrokeWidth;
      ctx.stroke();
      ctx.fillStyle = cfg.textColor;
      ctx.textAlign = corner.alignX as CanvasTextAlign;
      ctx.fillText(corner.label, corner.x + corner.offsetX, corner.y + 4);
    }

    // 8. 标签
    ctx.fillStyle = cfg.labelColor;
    ctx.font = RENDER_FONT.small;
    ctx.textAlign = 'center';
    const lblX = (farL + farR) / 2;
    const lblY = Math.min(farLY, farRY);
    ctx.fillText(TEXT_CONFIG.combat.groundBounds.text, lblX, lblY + cfg.labelOffsetY);

    ctx.restore();
  }
}