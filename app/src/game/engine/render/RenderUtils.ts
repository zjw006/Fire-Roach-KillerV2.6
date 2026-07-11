/**
 * @fileoverview 渲染工具模块
 * @description 提供特殊武器和效果的静态渲染方法，用于与旧引擎渐进式集成
 */

import { SceneType, RoachState, RoachType } from '../../types';
import type { RadarLaser, Roach, Player, TripleFlameState } from '../../types';
import { SCENE_GROUND_BOUNDS } from '../../data';

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

/**
 * 渲染工具类
 * @description 提供纯静态渲染方法，不维护内部状态
 */
export class RenderUtils {

  /**
   * 渲染雷达激光
   * @param ctx Canvas 渲染上下文
   * @param radarLaser 雷达激光状态
   * @param roaches 蟑螂数组
   * @param playerX 玩家X坐标
   * @param time 游戏时间
   */
  static renderRadarLaser(
    ctx: CanvasRenderingContext2D,
    radarLaser: RadarLaser,
    roaches: Roach[],
    playerX: number,
    playerY: number,
    time: number
  ): void {
    if (!radarLaser.active) return;
    const rl = radarLaser;

    // 查找当前目标
    let target = roaches.find(r => r.id === rl.targetId && r.state === RoachState.ALIVE);
    if (!target) {
      let minDist = Infinity;
      for (const r of roaches) {
        if (r.state !== RoachState.ALIVE) continue;
        const dx = r.x - playerX;
        const dy = r.y - (playerX * 0); // 简化距离计算
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          target = r;
        }
      }
      if (target) {
        rl.targetId = target.id;
      }
    }
    if (!target) return;

    const px = playerX;
    const py = playerY; // 从玩家位置发射
    const tx = target.x;
    const ty = target.y;

    const alpha = Math.min(1, rl.timer / 0.5) * (0.6 + Math.sin(time * 20) * 0.2);
    ctx.save();

    // 外部辉光
    ctx.strokeStyle = `rgba(34, 211, 238, ${alpha * 0.3})`;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // 中间辉光
    ctx.strokeStyle = `rgba(34, 211, 238, ${alpha * 0.6})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // 核心光束
    ctx.strokeStyle = `rgba(103, 232, 249, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // 目标锁定指示器
    const lockPulse = 0.5 + Math.sin(time * 8) * 0.5;
    ctx.strokeStyle = `rgba(34, 211, 238, ${lockPulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 20 + lockPulse * 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(34, 211, 238, ${lockPulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 15, 0, Math.PI * 2);
    ctx.fill();

    // 玩家发射器辉光
    ctx.fillStyle = `rgba(34, 211, 238, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 渲染杀虫剂喷雾
   * @param ctx Canvas 渲染上下文
   * @param spray 杀虫剂喷雾状态
   * @param canvasWidth 画布宽度
   * @param defenseLineY 防御线Y坐标
   * @param time 游戏时间
   */
  static renderInsecticideSpray(
    ctx: CanvasRenderingContext2D,
    spray: InsecticideSprayState,
    canvasWidth: number,
    defenseLineY: number,
    time: number
  ): void {
    if (!spray.active) return;
    const cx = canvasWidth / 2;
    const cy = defenseLineY;
    const range = 280;
    const halfSpread = spray.spraySpread / 2;

    const progress = spray.timer / spray.duration;
    const pulseAlpha = 0.12 + 0.08 * Math.sin(time * 12) * progress;

    ctx.save();
    ctx.globalAlpha = pulseAlpha;

    // 径向渐变喷雾锥体
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, range);
    grad.addColorStop(0, 'rgba(80, 255, 100, 0.5)');
    grad.addColorStop(0.4, 'rgba(60, 220, 80, 0.3)');
    grad.addColorStop(0.7, 'rgba(40, 180, 60, 0.15)');
    grad.addColorStop(1, 'rgba(20, 120, 40, 0)');

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, range, spray.sprayAngle - halfSpread, spray.sprayAngle + halfSpread);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 喷雾边界线
    ctx.globalAlpha = 0.2 * progress;
    ctx.strokeStyle = 'rgba(100, 255, 120, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spray.sprayAngle - halfSpread) * range, cy + Math.sin(spray.sprayAngle - halfSpread) * range);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spray.sprayAngle + halfSpread) * range, cy + Math.sin(spray.sprayAngle + halfSpread) * range);
    ctx.stroke();

    // 中心喷雾线
    ctx.globalAlpha = 0.3 * progress;
    ctx.strokeStyle = 'rgba(150, 255, 160, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spray.sprayAngle) * range, cy + Math.sin(spray.sprayAngle) * range);
    ctx.stroke();
    ctx.setLineDash([]);

    // 喷嘴辉光
    ctx.globalAlpha = 0.4 * progress;
    const nozzleGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    nozzleGrad.addColorStop(0, 'rgba(150, 255, 150, 0.8)');
    nozzleGrad.addColorStop(1, 'rgba(50, 200, 50, 0)');
    ctx.fillStyle = nozzleGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();

    // 计时器文字
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#86efac';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`杀虫剂 ${spray.timer.toFixed(1)}s`, cx, cy - 40);

    ctx.restore();
  }

  /**
   * 渲染电蚊拍
   * @param ctx Canvas 渲染上下文
   * @param swatterActive 电蚊拍是否激活
   * @param swatterAnimTimer 电蚊拍动画计时器
   * @param swatterSwingX 电蚊拍挥动X坐标
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   * @param roaches 蟑螂数组
   */
  static renderSwatter(
    ctx: CanvasRenderingContext2D,
    swatterActive: boolean,
    swatterAnimTimer: number,
    swatterSwingX: number,
    canvasWidth: number,
    canvasHeight: number,
    roaches: Roach[]
  ): void {
    if (!swatterActive) return;

    const progress = 1 - swatterAnimTimer / 0.6;
    const w = canvasWidth;
    const h = canvasHeight;
    const swatX = swatterSwingX;
    const startY = -h * 0.3;
    const endY = h * 0.8;
    const currentY = startY + (endY - startY) * Math.min(1, progress * 1.5);

    const headW = w * 0.7;
    const headH = h * 0.15;
    const headY = currentY;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const glowGrad = ctx.createRadialGradient(swatX, headY + headH / 2, 0, swatX, headY + headH / 2, headW * 0.6);
    glowGrad.addColorStop(0, `rgba(250, 200, 50, ${0.4 * (1 - progress)})`);
    glowGrad.addColorStop(1, 'rgba(50, 100, 200, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(swatX - headW * 0.6, headY - headH, headW * 1.2, headH * 3);

    ctx.strokeStyle = `rgba(180, 220, 255, ${0.8 * (1 - progress * 0.5)})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(swatX - headW / 2, headY, headW, headH);

    ctx.strokeStyle = `rgba(120, 180, 255, ${0.5 * (1 - progress * 0.5)})`;
    ctx.lineWidth = 1;
    const gridCols = 8;
    const gridRows = 3;
    for (let c = 1; c < gridCols; c++) {
      const gx = swatX - headW / 2 + (headW / gridCols) * c;
      ctx.beginPath();
      ctx.moveTo(gx, headY);
      ctx.lineTo(gx, headY + headH);
      ctx.stroke();
    }
    for (let r = 1; r < gridRows; r++) {
      const gy = headY + (headH / gridRows) * r;
      ctx.beginPath();
      ctx.moveTo(swatX - headW / 2, gy);
      ctx.lineTo(swatX + headW / 2, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(150, 150, 150, ${0.9 * (1 - progress)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(swatX, headY + headH);
    ctx.lineTo(swatX, headY + headH + h * 0.4);
    ctx.stroke();

    if (progress > 0.3 && progress < 0.8) {
      const arcAlpha = Math.sin((progress - 0.3) / 0.5 * Math.PI) * 0.9;
      ctx.strokeStyle = `rgba(200, 240, 255, ${arcAlpha})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(250, 200, 50, 0.8)';
      ctx.shadowBlur = 15;

      for (let i = 0; i < 12; i++) {
        const ax = swatX - headW / 2 + Math.random() * headW;
        const ay = headY + Math.random() * headH;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        for (let j = 0; j < 4; j++) {
          ctx.lineTo(ax + (Math.random() - 0.5) * 30, ay + j * 8);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      ctx.fillStyle = `rgba(200, 240, 255, ${arcAlpha * 0.15})`;
      ctx.fillRect(swatX - headW / 2, headY, headW, headH);
    }

    for (const r of roaches) {
      if (r.isStunned && Math.random() < 0.3) {
        const sz = r.type === RoachType.LARGE ? 22 : 14;
        ctx.fillStyle = `rgba(150, 220, 255, ${0.5 + Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y - sz, 2 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * 渲染枪口闪光
   * @param ctx Canvas 渲染上下文
   * @param player 玩家对象
   * @param tripleFlame 三重火焰状态
   */
  static renderMuzzleFlash(
    ctx: CanvasRenderingContext2D,
    player: Player,
    tripleFlame: TripleFlameState
  ): void {
    if (!player.isFiring || player.isOverheated || player.isReloading || player.gas <= 0) return;

    const my = player.y - 322;

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
      const scale = isSideGun ? 0.6 : 1.0;

      if (player.powerBoostTimer > 0) {
        const boostAlpha = Math.min(1, player.powerBoostTimer / 0.5);
        for (let pi = 0; pi < 4; pi++) {
          const sprayAngle = Math.random() * Math.PI * 2;
          const sprayDist = 15 + Math.random() * 35;
          const px = mx + Math.cos(sprayAngle) * sprayDist;
          const py = my + Math.sin(sprayAngle) * sprayDist * 0.6 - Math.random() * 10;
          const pSize = (2 + Math.random() * 3.5) * scale;
          const colors = ['255, 100, 20', '255, 180, 50', '255, 60, 0', '255, 140, 40'];
          const cIdx = Math.floor(Math.random() * colors.length);
          const pAlpha = (0.6 + Math.random() * 0.4) * boostAlpha;

          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = `rgba(${colors[cIdx]}, ${pAlpha})`;
          ctx.beginPath();
          ctx.arc(px, py, pSize, 0, Math.PI * 2);
          ctx.fill();

          const glowGrad = ctx.createRadialGradient(px, py, 0, px, py, pSize * 2);
          glowGrad.addColorStop(0, `rgba(${colors[cIdx]}, ${pAlpha * 0.3})`);
          glowGrad.addColorStop(1, `rgba(${colors[cIdx]}, 0)`);
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(px, py, pSize * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  /**
   * 渲染道具放置预览（范围椭圆、十字准星、标签）
   * @param ctx Canvas 渲染上下文
   * @param itemPlaceState 放置状态
   * @param selectedItemIndex 选中道具索引
   * @param inventory 道具库存
   * @param cursorX 光标 X
   * @param cursorY 光标 Y
   * @param radiusX 效果范围 X
   * @param radiusY 效果范围 Y
   * @param time 游戏时间
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

    const cx = cursorX;
    const cy = cursorY;
    const rx = radiusX;
    const ry = radiusY;
    const pulse = (Math.sin(time * 4) + 1) * 0.5;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const colors: Record<string, string> = { sticky: '250, 200, 50', poison: '180, 130, 255', molotov: '255, 100, 80', shotgun: '255, 200, 100' };
    const c = colors[item.type] || '255, 255, 255';

    // Large filled area (ellipse)
    ctx.fillStyle = `rgba(${c}, 0.12)`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer boundary ring (pulsing, ellipse)
    ctx.strokeStyle = `rgba(${c}, ${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10 + pulse * 6, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner ring (ellipse)
    ctx.strokeStyle = `rgba(${c}, 0.6)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 4 directional range lines
    ctx.strokeStyle = `rgba(${c}, 0.35)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy); ctx.lineTo(cx + rx, cy);
    ctx.moveTo(cx, cy - ry); ctx.lineTo(cx, cy + ry);
    ctx.stroke();

    // Crosshair with glow
    ctx.shadowColor = `rgba(${c}, 0.8)`;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(${c}, 1)`;
    ctx.lineWidth = 2.5;
    const csx = Math.min(14, rx * 0.3);
    const csy = Math.min(14, ry * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx - csx, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + csx, cy);
    ctx.moveTo(cx, cy - csy); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + csy);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dot with glow
    ctx.shadowColor = `rgba(${c}, 1)`;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label background
    const names: Record<string, string> = { sticky: '蟑螂贴板', poison: '杀虫剂', molotov: '燃烧瓶', shotgun: '散弹模式' };
    const label1 = `点击放置 ${names[item.type] || '道具'}`;
    const label2 = `范围: X${rx} x Y${ry}`;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    const m1 = ctx.measureText(label1);
    const m2 = ctx.measureText(label2);
    const lw = Math.max(m1.width, m2.width) + 20;
    const ly = cy - ry - 42;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(cx - lw / 2, ly, lw, 44, 8);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(label1, cx, ly + 20);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = `rgba(${c}, 1)`;
    ctx.fillText(label2, cx, ly + 37);

    ctx.restore();
  }

  /**
   * 渲染防线（虚线 + 护盾光效）
   * @param ctx Canvas 渲染上下文
   * @param w 画布宽度
   * @param defenseLineY 防线 Y 坐标
   * @param defenseLineColor 防线颜色
   * @param time 游戏时间
   * @param shieldTimer 护盾剩余时间
   */
  static renderDefenseLine(
    ctx: CanvasRenderingContext2D,
    w: number,
    defenseLineY: number,
    defenseLineColor: string,
    time: number,
    shieldTimer: number
  ): void {
    const dl = defenseLineY;

    ctx.save();
    ctx.strokeStyle = defenseLineColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -time * 30;
    ctx.beginPath();
    ctx.moveTo(0, dl);
    ctx.lineTo(w, dl);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = defenseLineColor.replace('0.7', '0.08');
    ctx.fillRect(0, dl, w, 25);
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('防 线', w / 2, dl - 8);

    // ===== SHIELD: blue energy line 20px above defense line =====
    if (shieldTimer > 0) {
      const shieldAlpha = 0.4 + Math.sin(time * 6) * 0.2; // pulse 0.2~0.6
      const shieldY = dl - 20;
      ctx.save();
      // Outer glow
      ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
      ctx.shadowBlur = 12 + Math.sin(time * 4) * 4;
      // Main line
      ctx.strokeStyle = `rgba(6, 182, 212, ${shieldAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, shieldY);
      ctx.lineTo(w, shieldY);
      ctx.stroke();
      // Inner bright core
      ctx.strokeStyle = `rgba(165, 243, 252, ${shieldAlpha * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, shieldY);
      ctx.lineTo(w, shieldY);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * 渲染移动范围（蟑螂地面边界6点折线可视化）
   * @param ctx Canvas 渲染上下文
   * @param currentScene 当前场景类型
   * @param defenseLineY 防线 Y 坐标
   * @param getGroundBoundsAtY 根据 Y 坐标获取地面边界回调
   */
  static renderMovementRange(
    ctx: CanvasRenderingContext2D,
    currentScene: SceneType,
    defenseLineY: number,
    getGroundBoundsAtY: (y: number) => [number, number]
  ): void {
    const [farL, farLY, farR, farRY, midL, midLY, midR, midRY, nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[currentScene];

    ctx.save();

    // 1. Green semi-transparent fill (6-point polygon with mid折线)
    ctx.fillStyle = 'rgba(0, 255, 100, 0.06)';
    ctx.beginPath();
    ctx.moveTo(farL, farLY);
    ctx.lineTo(farR, farRY);
    ctx.lineTo(midR, midRY);
    ctx.lineTo(nearR, nearY);
    ctx.lineTo(nearL, nearY);
    ctx.lineTo(midL, midLY);
    ctx.closePath();
    ctx.fill();

    // 2. Left side: 2-segment折线 (far→mid→near)
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(farL, farLY);
    ctx.lineTo(midL, midLY);
    ctx.lineTo(nearL, nearY);
    ctx.stroke();

    // 3. Right side: 2-segment折线 (far→mid→near)
    ctx.beginPath();
    ctx.moveTo(farR, farRY);
    ctx.lineTo(midR, midRY);
    ctx.lineTo(nearR, nearY);
    ctx.stroke();

    // 4. Far boundary line (top)
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(farL, farLY);
    ctx.lineTo(farR, farRY);
    ctx.stroke();

    // 5. Near boundary line (bottom)
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nearL, nearY);
    ctx.lineTo(nearR, nearY);
    ctx.stroke();

    // 6. Defense line reference (dashed green)
    const [defL, defR] = getGroundBoundsAtY(defenseLineY);
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(defL, defenseLineY);
    ctx.lineTo(defR, defenseLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 7. Corner markers (green dots + coordinate labels) - all 6 points
    const corners = [
      { x: farL,  y: farLY, label: `(${Math.round(farL)},${Math.round(farLY)})`, name: 'farL', alignX: 'left', offsetX: 10 },
      { x: farR,  y: farRY, label: `(${Math.round(farR)},${Math.round(farRY)})`, name: 'farR', alignX: 'right', offsetX: -10 },
      { x: midL,  y: midLY, label: `(${Math.round(midL)},${Math.round(midLY)})`, name: 'midL', alignX: 'left', offsetX: 10 },
      { x: midR,  y: midRY, label: `(${Math.round(midR)},${Math.round(midRY)})`, name: 'midR', alignX: 'right', offsetX: -10 },
      { x: nearL, y: nearY, label: `(${Math.round(nearL)},${Math.round(nearY)})`, name: 'nearL', alignX: 'left', offsetX: 10 },
      { x: nearR, y: nearY, label: `(${Math.round(nearR)},${Math.round(nearY)})`, name: 'nearR', alignX: 'right', offsetX: -10 },
    ];
    for (const c of corners) {
      ctx.font = 'bold 12px monospace';
      const textWidth = ctx.measureText(c.label).width;
      const pillW = textWidth + 8;
      const pillH = 16;
      const pillX = c.alignX === 'left' ? c.x + c.offsetX - 4 : c.x + c.offsetX - pillW + 4;
      const pillY = c.y + 3 - pillH / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 255, 80, 1)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 0, 1)';
      ctx.textAlign = c.alignX as CanvasTextAlign;
      ctx.fillText(c.label, c.x + c.offsetX, c.y + 4);
    }

    // 8. Label
    ctx.fillStyle = 'rgba(0, 255, 80, 0.7)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const lblX = (farL + farR) / 2;
    const lblY = Math.min(farLY, farRY);
    ctx.fillText('蟑螂地面边界(6点折线)', lblX, lblY - 14);

    ctx.restore();
  }
}