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
  /** 天赋外观进化：蓝焰核心/过载核心（仅 flamethrower 武器生效；聚能长枪不再改变火焰主体） */
  flameVariant?: 'normal' | 'blue' | 'overdrive';
  /** 天赋渐进强化：伤害强度（伤害乘算-1）；火束宽度微量加粗（克制幅度，不遮蟑螂） */
  damageIntensity?: number;
}

/** 火焰束变体类型 */
export type FlameVariant = 'normal' | 'blue' | 'overdrive';

// =============================================================================
// 火焰颜色计算（从 engine.ts 提取的纯函数）
// =============================================================================

/** 根据位置偏移和武器类型计算火焰颜色（颜色/透明度参数集中于 vfx-balance render.fireZone.flame*） */
function getFlameColor(t: number, weapon: string = 'flamethrower', variant: FlameVariant = 'normal'): string {
  const fz = BALANCE_CONFIG.render.fireZone;
  let r: number, g: number, b: number;

  if (weapon === 'sticky') {
    const c = fz.flameSticky;
    r = c.r;
    g = c.gBase + t * c.gRange;
    b = c.bBase + t * c.bRange;
  } else if (weapon === 'poison') {
    const c = fz.flamePoison;
    r = c.rBase + t * c.rRange;
    g = c.gBase + t * c.gRange;
    b = c.bBase + t * c.bRange;
  } else if (weapon === 'shotgun') {
    const c = fz.flameShotgun;
    r = c.r;
    g = c.gBase + t * c.gRange;
    b = c.bBase + t * c.bRange;
  } else {
    // 天赋外观进化：变体渐变（仅 flamethrower 到达此分支）
    let first = fz.flameDefaultFirst;
    let second = fz.flameDefaultSecond;
    if (variant === 'blue') { first = fz.flameBlueFirst; second = fz.flameBlueSecond; }
    else if (variant === 'overdrive') { first = fz.flameOverdriveFirst; second = fz.flameOverdriveSecond; }

    if (t < 0.5) {
      const s = t * 2;
      r = first.rBase + s * first.rRange;
      g = first.gBase + s * first.gRange;
      b = first.bBase + s * first.bRange;
    } else {
      const s = (t - 0.5) * 2;
      r = second.rBase + s * second.rRange;
      g = second.gBase + s * second.gRange;
      b = second.bBase + s * second.bRange;
    }
  }

  // 根部渐隐：前 flameRootFade 段用 smoothstep 从 0 升到 1，让火焰根部变虚
  const rootFade = fz.flameRootFade;
  const ramp = rootFade > 0 ? Math.min(1, t / rootFade) : 1;
  const rootAlpha = ramp * ramp * (3 - 2 * ramp);
  const a = fz.flameAlphaBase * (1 - t) * (1 - t) * rootAlpha;
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
      ctx.save();
      ctx.globalCompositeOperation = cfgBg.nightBlend; // 叠加混合集中于 vfx-balance background.nightBlend
      ctx.fillStyle = cfgBg.nightColor.replace('{alpha}', String(nightAlpha));
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Vignette gradient
    ctx.save();
    ctx.globalCompositeOperation = cfgBg.vignetteBlend; // 叠加混合集中于 vfx-balance background.vignetteBlend
    const grad = ctx.createRadialGradient(
      w / 2, h / 2, h * cfgBg.vignetteInnerRadius,
      w / 2, h / 2, h * cfgBg.vignetteOuterRadius
    );
    grad.addColorStop(0, cfgBg.vignetteInnerColor);
    grad.addColorStop(1, cfgBg.vignetteOuterColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** 渲染火焰区域（玩家武器火焰特效） */
  static renderFireZones(ctx: CanvasRenderingContext2D, cfg: FireZoneRenderConfig): void {
    const p = cfg.player;
    if (!p.isFiring || p.isOverheated || p.isReloading || p.gas <= 0) return;
    if (p.currentWeapon === 'molotov') return;

    const rcfg = BALANCE_CONFIG.render.fireZone;
    const variant: FlameVariant = cfg.flameVariant ?? 'normal';
    // 火焰视觉长度与扩口喷嘴/风压聚焦的射程加成解耦（它们只加伤害射程，不拉长火焰）
    const visualRange = p.flameVisualRange ?? p.fireRange;
    const maxRange = visualRange * rcfg.rangeRatio * rcfg.flameLengthY;
    // 修复 P1：使用 BALANCE_CONFIG.player.nozzleOffsetY 替代硬编码 322
    // flameVisualYOffset：基础火焰特效整体 Y 下移（像素）
    const nozzleY = p.y - BALANCE_CONFIG.player.nozzleOffsetY + rcfg.flameVisualYOffset;
    const endY = nozzleY - maxRange;
    // 天赋射程加成比例：火焰特效宽度随天赋等比放大（Y 轴长度已通过 maxRange = 视觉射程 × rangeRatio 随天赋增长）
    const talentScale = visualRange / BALANCE_CONFIG.player.baseFireRange;
    // 天赋渐进强化：伤害强度 → 火束微量加粗（克制系数 0.15，满配 dmg≈1.53 → 宽度 +8%，不遮蟑螂）
    const intensityWidthMult = 1 + Math.max(0, cfg.damageIntensity ?? 0) * 0.15;

    const gunXs: number[] = [p.x];
    if (cfg.tripleFlameState.active) {
      gunXs.push(p.x - cfg.tripleFlameState.sideOffset);
      gunXs.push(p.x + cfg.tripleFlameState.sideOffset);
    }

    ctx.save();
    ctx.globalCompositeOperation = rcfg.blend; // 叠加混合集中于 vfx-balance fireZone.blend

    for (let gi = 0; gi < gunXs.length; gi++) {
      const gunX = gunXs[gi];
      const isSideGun = gi > 0;
      const flameScale = isSideGun ? rcfg.sideGunScale : 1.0;
      // 修复 P2：侧枪喷嘴偏移改用配置值
      const nozzleYOffset = isSideGun ? rcfg.sideGunNozzleOffset : 0;
      const gunNozzleY = nozzleY + nozzleYOffset;
      const gunEndY = endY + nozzleYOffset;

      // 火力全开：火焰摆动频率加大
      const boostWiggle = p.powerBoostTimer > 0 ? rcfg.boostWiggleFreqMult : 1;
      const wiggleFreq = rcfg.wiggleFreq * boostWiggle;
      const wiggleTime = rcfg.wiggleTimeScale * boostWiggle;

      // 修复 P0：段数从50降至20，使用纯色填充替代每段创建渐变
      const segments = rcfg.segments;
      for (let i = 0; i < segments; i++) {
        const t0 = i / segments;
        const t1 = (i + 1) / segments;
        const y0 = gunNozzleY + (gunEndY - gunNozzleY) * t0;
        const y1 = gunNozzleY + (gunEndY - gunNozzleY) * t1;

        const baseWidth = rcfg.baseWidth * flameScale * talentScale * intensityWidthMult;
        const w0 = baseWidth * (1 - t0 * rcfg.widthTaper) + Math.sin(t0 * Math.PI * wiggleFreq + cfg.time * wiggleTime + gi) * rcfg.wiggleAmplitude;
        const w1 = baseWidth * (1 - t1 * rcfg.widthTaper) + Math.sin(t1 * Math.PI * wiggleFreq + cfg.time * wiggleTime + gi) * rcfg.wiggleAmplitude;

        // 修复 P0：使用纯色填充（段间颜色差异极小，视觉效果无差别）
        ctx.fillStyle = getFlameColor(t0, p.currentWeapon, variant);

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
      else if (p.currentWeapon === 'flamethrower') {
        if (variant === 'blue') coreColor = rcfg.coreColorBlue;
        else if (variant === 'overdrive') coreColor = rcfg.coreColorOverdrive;
      }

      const glowSize = rcfg.coreGlowSize * flameScale * talentScale;
      const coreGrad = ctx.createRadialGradient(gunX, gunNozzleY, 0, gunX, gunNozzleY, glowSize);
      coreGrad.addColorStop(0, `rgba(${coreColor}, ${rcfg.coreGradAlpha0})`);
      coreGrad.addColorStop(0.3, `rgba(${coreColor}, ${rcfg.coreGradAlpha1})`);
      coreGrad.addColorStop(0.6, `rgba(${coreColor}, ${rcfg.coreGradAlpha2})`);
      coreGrad.addColorStop(1, rcfg.coreGradEndColor);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(gunX, gunNozzleY, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}