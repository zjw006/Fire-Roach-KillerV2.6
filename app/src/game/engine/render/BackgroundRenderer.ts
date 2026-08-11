/**
 * @fileoverview 背景渲染模块
 * @description 提供背景、火焰区域、天气效果、火焰墙的静态渲染方法。
 *              所有数值参数从 BALANCE_CONFIG.render 读取。
 */

import { SceneType, WeatherType } from '../../types';
import type { Player } from '../../types';
import { BALANCE_CONFIG } from '../../data';

// =============================================================================
// 配置接口
// =============================================================================

/** 背景渲染配置 */
export interface BackgroundRenderConfig {
  currentScene: SceneType;
  difficulty: string;
  sceneConfig: { bgImage?: string; bgColor: string; tileColors: [string, string]; weather: WeatherType; };
  imagesLoaded: boolean;
  /** 新场景系统：bgImage 路径映射的图片 */
  bgSceneImages: Record<string, HTMLImageElement>;
  /** 旧场景系统：key='{scene}_{difficulty}' 或 '{scene}' */
  bgImages: Record<string, HTMLImageElement>;
  lightningFlash: number;
}

/** 火焰区域渲染配置 */
export interface FireZoneRenderConfig {
  player: Player;
  tripleFlameState: { active: boolean; sideOffset: number; };
  time: number;
}

// =============================================================================
// 火焰颜色计算（从 engine.ts 提取的纯函数）
// =============================================================================

/** 根据位置偏移和武器类型计算火焰颜色 */
function getFlameColor(t: number, weapon: string = 'flamethrower'): string {
  let r: number, g: number, b: number;

  if (weapon === 'sticky') {
    r = 250;
    g = 200 + t * 55;
    b = 50 + t * 50;
  } else if (weapon === 'poison') {
    r = 150 - t * 100;
    g = 100 + t * 100;
    b = 200 - t * 50;
  } else if (weapon === 'shotgun') {
    r = 255;
    g = 150 + t * 105;
    b = 50 + t * 100;
  } else {
    if (t < 0.5) {
      const s = t * 2;
      r = 60 + s * 140;
      g = 140 - s * 80;
      b = 255 - s * 100;
    } else {
      const s = (t - 0.5) * 2;
      r = 200 + s * 55;
      g = 60 - s * 60;
      b = 155 - s * 155;
    }
  }

  const a = 0.75 * (1 - t) * (1 - t);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// =============================================================================
// 静态渲染方法
// =============================================================================

export class BackgroundRenderer {
  /** 渲染场景背景 */
  static renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number, cfg: BackgroundRenderConfig): void {
    const { currentScene, difficulty, sceneConfig: scene, bgSceneImages, bgImages } = cfg;
    const cfgBg = BALANCE_CONFIG.render.background;

    // GENERIC bgImage support for new scenes
    if (scene.bgImage && bgSceneImages[currentScene]) {
      const bgImg = bgSceneImages[currentScene];
      if (bgImg.complete && bgImg.naturalWidth > 0) {
        const imgRatio = bgImg.naturalWidth / bgImg.naturalHeight;
        const canvasRatio = w / h;
        let drawW: number, drawH: number, drawX: number, drawY: number;
        if (imgRatio > canvasRatio) {
          drawH = h;
          drawW = h * imgRatio;
          drawX = (w - drawW) / 2;
          drawY = 0;
        } else {
          drawW = w;
          drawH = w / imgRatio;
          drawX = 0;
          drawY = (h - drawH) / 2;
        }
        ctx.globalAlpha = cfgBg.bgImageAlpha;
        ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
        ctx.globalAlpha = 1;
        return;
      }
    }

    // 修复 P0：哈希查找替代巨型 if-else 链
    // 优先级：{scene}_{difficulty} > {scene}
    const bgKey = `${currentScene}_${difficulty}`;
    const img = bgImages[bgKey] || bgImages[currentScene];
    if (img && cfg.imagesLoaded && img.naturalWidth > 0) {
      // Fixed Height 模式：始终以画布高度为基准等比缩放背景图
      // 窄屏设备：背景图居中，两侧裁剪
      // 宽屏设备：背景图居中，两侧留空（填充场景背景色）
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const drawH = h;
      const drawW = h * imgRatio;
      const drawX = (w - drawW) / 2;
      // 先填充背景色（覆盖宽屏两侧空白区域）
      ctx.fillStyle = scene.bgColor;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, drawX, 0, drawW, drawH);
    } else {
      // Fallback: tile-based background
      ctx.fillStyle = scene.bgColor;
      ctx.fillRect(0, 0, w, h);
      const tileSize = cfgBg.tileSize;
      for (let x = 0; x < w; x += tileSize) {
        for (let y = 0; y < h; y += tileSize) {
          const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
          ctx.fillStyle = isEven ? scene.tileColors[0] : scene.tileColors[1];
          ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
      }
    }

    // 修复 P2：夜晚叠加移到暗角之前（避免覆盖暗角）
    if (scene.weather === WeatherType.NIGHT) {
      const nightAlpha = cfgBg.nightBaseAlpha + (cfg.lightningFlash > 0 ? cfgBg.nightFlashAlpha : 0);
      ctx.fillStyle = cfgBg.nightColor.replace('{alpha}', String(nightAlpha));
      ctx.fillRect(0, 0, w, h);
    }

    // Vignette gradient
    const grad = ctx.createRadialGradient(
      w / 2, h / 2, h * cfgBg.vignetteInnerRadius,
      w / 2, h / 2, h * cfgBg.vignetteOuterRadius
    );
    grad.addColorStop(0, cfgBg.vignetteInnerColor);
    grad.addColorStop(1, cfgBg.vignetteOuterColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /** 渲染火焰区域（玩家武器火焰特效） */
  static renderFireZones(ctx: CanvasRenderingContext2D, cfg: FireZoneRenderConfig): void {
    const p = cfg.player;
    if (!p.isFiring || p.isOverheated || p.isReloading || p.gas <= 0) return;
    if (p.currentWeapon === 'molotov') return;

    const rcfg = BALANCE_CONFIG.render.fireZone;
    const maxRange = p.fireRange * rcfg.rangeRatio;
    // 修复 P1：使用 BALANCE_CONFIG.player.nozzleOffsetY 替代硬编码 322
    const nozzleY = p.y - BALANCE_CONFIG.player.nozzleOffsetY;
    const endY = nozzleY - maxRange;
    // 天赋射程加成比例：火焰特效宽度随天赋等比放大（Y 轴长度已通过 maxRange = fireRange × rangeRatio 随天赋增长）
    const talentScale = p.fireRange / BALANCE_CONFIG.player.baseFireRange;

    const gunXs: number[] = [p.x];
    if (cfg.tripleFlameState.active) {
      gunXs.push(p.x - cfg.tripleFlameState.sideOffset);
      gunXs.push(p.x + cfg.tripleFlameState.sideOffset);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let gi = 0; gi < gunXs.length; gi++) {
      const gunX = gunXs[gi];
      const isSideGun = gi > 0;
      const flameScale = isSideGun ? rcfg.sideGunScale : 1.0;
      // 修复 P2：侧枪喷嘴偏移改用配置值
      const nozzleYOffset = isSideGun ? rcfg.sideGunNozzleOffset : 0;
      const gunNozzleY = nozzleY + nozzleYOffset;
      const gunEndY = endY + nozzleYOffset;

      // 修复 P0：段数从50降至20，使用纯色填充替代每段创建渐变
      const segments = rcfg.segments;
      for (let i = 0; i < segments; i++) {
        const t0 = i / segments;
        const t1 = (i + 1) / segments;
        const y0 = gunNozzleY + (gunEndY - gunNozzleY) * t0;
        const y1 = gunNozzleY + (gunEndY - gunNozzleY) * t1;

        const baseWidth = rcfg.baseWidth * flameScale * talentScale;
        const w0 = baseWidth * (1 - t0 * rcfg.widthTaper) + Math.sin(t0 * Math.PI * rcfg.wiggleFreq + cfg.time * rcfg.wiggleTimeScale + gi) * rcfg.wiggleAmplitude;
        const w1 = baseWidth * (1 - t1 * rcfg.widthTaper) + Math.sin(t1 * Math.PI * rcfg.wiggleFreq + cfg.time * rcfg.wiggleTimeScale + gi) * rcfg.wiggleAmplitude;

        // 修复 P0：使用纯色填充（段间颜色差异极小，视觉效果无差别）
        ctx.fillStyle = getFlameColor(t0, p.currentWeapon);

        ctx.beginPath();
        ctx.moveTo(gunX - w0, y0);
        ctx.lineTo(gunX - w1, y1);
        ctx.lineTo(gunX + w1, y1);
        ctx.lineTo(gunX + w0, y0);
        ctx.closePath();
        ctx.fill();
      }

      // Core glow
      let coreColor: string = rcfg.coreColorDefault;
      if (p.currentWeapon === 'sticky') coreColor = rcfg.coreColorSticky;
      else if (p.currentWeapon === 'poison') coreColor = rcfg.coreColorPoison;

      const glowSize = rcfg.coreGlowSize * flameScale * talentScale;
      const coreGrad = ctx.createRadialGradient(gunX, gunNozzleY, 0, gunX, gunNozzleY, glowSize);
      coreGrad.addColorStop(0, `rgba(${coreColor}, 0.9)`);
      coreGrad.addColorStop(0.3, `rgba(${coreColor}, 0.5)`);
      coreGrad.addColorStop(0.6, `rgba(${coreColor}, 0.3)`);
      coreGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(gunX, gunNozzleY, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // Power Boost: air disturbance ripples
      if (p.powerBoostTimer > 0) {
        const boostAlpha = Math.min(1, p.powerBoostTimer / rcfg.boostAlphaFade) * rcfg.boostAlphaMax;
        for (let ri = 0; ri < rcfg.boostRippleCount; ri++) {
          const ripplePhase = (cfg.time * rcfg.boostRippleFreq + ri * rcfg.boostRippleSpacing) % rcfg.boostRippleMaxPhase;
          const rippleRadius = rcfg.boostRippleRadiusBase + ripplePhase * rcfg.boostRippleRadiusGrowth;
          const rippleAlpha = boostAlpha * (1 - ripplePhase / rcfg.boostRippleMaxPhase);
          ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha})`;
          ctx.lineWidth = rcfg.boostRippleLineWidth;
          ctx.beginPath();
          ctx.arc(gunX, gunNozzleY, rippleRadius * flameScale, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }
}