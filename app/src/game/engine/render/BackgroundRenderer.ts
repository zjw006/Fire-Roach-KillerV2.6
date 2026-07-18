/**
 * @fileoverview 背景渲染模块
 * @description 提供背景、火焰区域、天气效果、火焰墙的静态渲染方法
 */

import { SceneType, WeatherType } from '../../types';
import type { Player, FireWall } from '../../types';
import { WeatherSystem } from '../weather/WeatherSystem';
import { ParticleSystem } from '../particle/ParticleSystem';

// =============================================================================
// 配置接口
// =============================================================================

/** 背景渲染配置 */
export interface BackgroundRenderConfig {
  currentScene: SceneType;
  difficulty: string;
  sceneConfig: { bgImage?: boolean; bgColor: string; tileColors: [string, string]; weather: WeatherType; };
  imagesLoaded: boolean;
  bgSceneImages: Record<string, HTMLImageElement>;
  lightningFlash: number;
  // 场景专属背景图
  bgKitchenHardImg?: HTMLImageElement;
  bgKitchenEasyImg?: HTMLImageElement;
  bgImg?: HTMLImageElement;
  bgSewerHardImg?: HTMLImageElement;
  bgSewerEasyImg?: HTMLImageElement;
  bgSewerImg?: HTMLImageElement;
  bgDumpHardImg?: HTMLImageElement;
  bgDumpEasyImg?: HTMLImageElement;
  bgDumpImg?: HTMLImageElement;
  bgBasementHardImg?: HTMLImageElement;
  bgBasementEasyImg?: HTMLImageElement;
  bgBasementImg?: HTMLImageElement;
  bgRooftopHardImg?: HTMLImageElement;
  bgRooftopEasyImg?: HTMLImageElement;
  bgRooftopImg?: HTMLImageElement;
  bgStreetHardImg?: HTMLImageElement;
  bgStreetEasyImg?: HTMLImageElement;
  bgStreetImg?: HTMLImageElement;
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
    r = Math.floor(250);
    g = Math.floor(200 + t * 55);
    b = Math.floor(50 + t * 50);
  } else if (weapon === 'poison') {
    r = Math.floor(150 - t * 100);
    g = Math.floor(100 + t * 100);
    b = Math.floor(200 - t * 50);
  } else if (weapon === 'shotgun') {
    r = 255;
    g = Math.floor(150 + t * 105);
    b = Math.floor(50 + t * 100);
  } else {
    if (t < 0.5) {
      const s = t * 2;
      r = Math.floor(60 + s * 140);
      g = Math.floor(140 - s * 80);
      b = Math.floor(255 - s * 100);
    } else {
      const s = (t - 0.5) * 2;
      r = Math.floor(200 + s * 55);
      g = Math.floor(60 - s * 60);
      b = Math.floor(155 - s * 155);
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
    const { currentScene, difficulty, sceneConfig: scene } = cfg;
    const isHard = difficulty === 'hard';
    const isEasy = difficulty === 'easy';

    // GENERIC bgImage support for new scenes
    if (scene.bgImage && cfg.bgSceneImages[currentScene]) {
      const bgImg = cfg.bgSceneImages[currentScene];
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
        ctx.globalAlpha = 0.8;
        ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
        ctx.globalAlpha = 1;
        return;
      }
    }

    // KITCHEN
    if (currentScene === SceneType.KITCHEN && isHard && cfg.bgKitchenHardImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgKitchenHardImg, 0, 0, w, h);
    } else if (currentScene === SceneType.KITCHEN && isEasy && cfg.bgKitchenEasyImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgKitchenEasyImg, 0, 0, w, h);
    } else if (currentScene === SceneType.KITCHEN && cfg.bgImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgImg, 0, 0, w, h);
    // SEWER
    } else if (currentScene === SceneType.SEWER && isHard && cfg.bgSewerHardImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgSewerHardImg, 0, 0, w, h);
    } else if (currentScene === SceneType.SEWER && isEasy && cfg.bgSewerEasyImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgSewerEasyImg, 0, 0, w, h);
    } else if (currentScene === SceneType.SEWER && cfg.bgSewerImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgSewerImg, 0, 0, w, h);
    // DUMP
    } else if (currentScene === SceneType.DUMP && isHard && cfg.bgDumpHardImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgDumpHardImg, 0, 0, w, h);
    } else if (currentScene === SceneType.DUMP && isEasy && cfg.bgDumpEasyImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgDumpEasyImg, 0, 0, w, h);
    } else if (currentScene === SceneType.DUMP && cfg.bgDumpImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgDumpImg, 0, 0, w, h);
    // BASEMENT
    } else if (currentScene === SceneType.BASEMENT && isHard && cfg.bgBasementHardImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgBasementHardImg, 0, 0, w, h);
    } else if (currentScene === SceneType.BASEMENT && isEasy && cfg.bgBasementEasyImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgBasementEasyImg, 0, 0, w, h);
    } else if (currentScene === SceneType.BASEMENT && cfg.bgBasementImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgBasementImg, 0, 0, w, h);
    // ROOFTOP
    } else if (currentScene === SceneType.ROOFTOP && isHard && cfg.bgRooftopHardImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgRooftopHardImg, 0, 0, w, h);
    } else if (currentScene === SceneType.ROOFTOP && isEasy && cfg.bgRooftopEasyImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgRooftopEasyImg, 0, 0, w, h);
    } else if (currentScene === SceneType.ROOFTOP && cfg.bgRooftopImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgRooftopImg, 0, 0, w, h);
    // STREET
    } else if (currentScene === SceneType.STREET && isHard && cfg.bgStreetHardImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgStreetHardImg, 0, 0, w, h);
    } else if (currentScene === SceneType.STREET && isEasy && cfg.bgStreetEasyImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgStreetEasyImg, 0, 0, w, h);
    } else if (currentScene === SceneType.STREET && cfg.bgStreetImg && cfg.imagesLoaded) {
      ctx.drawImage(cfg.bgStreetImg, 0, 0, w, h);
    } else {
      // Fallback: tile-based background
      ctx.fillStyle = scene.bgColor;
      ctx.fillRect(0, 0, w, h);
      const tileSize = 48;
      for (let x = 0; x < w; x += tileSize) {
        for (let y = 0; y < h; y += tileSize) {
          const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
          ctx.fillStyle = isEven ? scene.tileColors[0] : scene.tileColors[1];
          ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
      }
    }

    // Night overlay
    if (scene.weather === WeatherType.NIGHT) {
      const nightAlpha = 0.4 + (cfg.lightningFlash > 0 ? 0.2 : 0);
      ctx.fillStyle = `rgba(0, 0, 20, ${nightAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Vignette gradient
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, h * 0.8);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /** 渲染天气背景（委托给 WeatherSystem） */
  static renderWeatherBackground(ctx: CanvasRenderingContext2D, w: number, h: number, lightningFlash: number): void {
    WeatherSystem.renderWeatherBackground(ctx, w, h, lightningFlash);
  }

  /** 渲染火焰区域（玩家武器火焰特效） */
  static renderFireZones(ctx: CanvasRenderingContext2D, cfg: FireZoneRenderConfig): void {
    const p = cfg.player;
    if (!p.isFiring || p.isOverheated || p.isReloading || p.gas <= 0) return;
    if (p.currentWeapon === 'molotov') return;

    const maxRange = p.fireRange * 0.5;
    const nozzleY = p.y - 322;
    const endY = nozzleY - maxRange;

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
      const flameScale = isSideGun ? 0.6 : 1.0;
      const nozzleYOffset = isSideGun ? 50 : 0;
      const gunNozzleY = nozzleY + nozzleYOffset;
      const gunEndY = endY + nozzleYOffset;

      const segments = 50;
      for (let i = 0; i < segments; i++) {
        const t0 = i / segments;
        const t1 = (i + 1) / segments;
        const y0 = gunNozzleY + (gunEndY - gunNozzleY) * t0;
        const y1 = gunNozzleY + (gunEndY - gunNozzleY) * t1;

        const baseWidth = 32 * flameScale;
        const w0 = baseWidth * (1 - t0 * 0.94) + Math.sin(t0 * Math.PI * 6 + cfg.time * 30 + gi) * 5;
        const w1 = baseWidth * (1 - t1 * 0.94) + Math.sin(t1 * Math.PI * 6 + cfg.time * 30 + gi) * 5;

        const c0 = getFlameColor(t0, p.currentWeapon);
        const c1 = getFlameColor(t1, p.currentWeapon);

        ctx.beginPath();
        ctx.moveTo(gunX - w0, y0);
        ctx.lineTo(gunX - w1, y1);
        ctx.lineTo(gunX + w1, y1);
        ctx.lineTo(gunX + w0, y0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(gunX, y0, gunX, y1);
        grad.addColorStop(0, c0);
        grad.addColorStop(1, c1);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Core glow
      let coreColor = '160, 210, 255';
      if (p.currentWeapon === 'sticky') coreColor = '250, 200, 50';
      else if (p.currentWeapon === 'poison') coreColor = '200, 160, 255';

      const glowSize = 36 * flameScale;
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
        const boostAlpha = Math.min(1, p.powerBoostTimer / 0.5) * 0.25;
        for (let ri = 0; ri < 3; ri++) {
          const ripplePhase = (cfg.time * 4 + ri * 2.1) % 3;
          const rippleRadius = 30 + ripplePhase * 25;
          const rippleAlpha = boostAlpha * (1 - ripplePhase / 3);
          ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(gunX, gunNozzleY, rippleRadius * flameScale, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  /** 渲染火焰墙（委托给 ParticleSystem 静态方法） */
  static renderFireWalls(ctx: CanvasRenderingContext2D, fireWalls: FireWall[], time: number): void {
    ParticleSystem.renderFireWalls(ctx, fireWalls, time);
  }
}