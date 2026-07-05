/**
 * @fileoverview 掉落物渲染工具模块
 * @description 提供粘性弹丸和武器掉落物的静态渲染方法，用于与旧引擎渐进式集成
 */

import { WEAPON_DROP_DEFS } from '../../data';
import { RoachState } from '../../types';
import type { StickyDrop, WeaponDrop, Roach } from '../../types';

/**
 * 掉落物渲染工具类
 * @description 提供纯静态渲染方法，不维护内部状态
 */
export class DropRenderer {
  /**
   * 渲染粘性弹丸
   * @param ctx Canvas 渲染上下文
   * @param drops 粘性弹丸数组
   * @param roaches 蟑螂数组（用于查找附着目标）
   * @param time 游戏时间
   * @param deltaTime 帧间隔时间
   */
  static renderStickyDrops(
    ctx: CanvasRenderingContext2D,
    drops: StickyDrop[],
    roaches: Roach[],
    time: number,
    deltaTime: number
  ): void {
    for (const drop of drops) {
      // 跳过预生成阶段的弹丸（仍在延迟阶段）
      if (drop.life > drop.maxLife) continue;

      ctx.save();

      if (drop.hit && drop.targetId !== null) {
        // 弹丸已附着在蟑螂上 - 在 renderRoaches 中渲染为包裹覆盖层
        // 这里只绘制小型的连接滴落效果
        const target = roaches.find(r => r.id === drop.targetId);
        if (target && target.state === RoachState.ALIVE) {
          ctx.strokeStyle = `rgba(250, 220, 50, ${0.4 + Math.sin(time * 8 + drop.id) * 0.2})`;
          ctx.lineWidth = 2;
          for (let d = 0; d < 3; d++) {
            const angle = (Math.PI * 2 / 3) * d + time * 2 + drop.id;
            const dripLen = 6 + Math.sin(time * 6 + d) * 3;
            ctx.beginPath();
            ctx.moveTo(target.x + Math.cos(angle) * 8, target.y + Math.sin(angle) * 8);
            ctx.lineTo(target.x + Math.cos(angle) * (8 + dripLen), target.y + Math.sin(angle) * (8 + dripLen));
            ctx.stroke();
          }
        }
      } else {
        // 飞行中的弹丸 - 绘制黄色液体滴
        const pulse = 0.8 + Math.sin(time * 10 + drop.id) * 0.2;

        // 外部辉光
        const glowGrad = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, drop.size * 2);
        glowGrad.addColorStop(0, `rgba(250, 220, 50, ${0.3 * pulse})`);
        glowGrad.addColorStop(1, 'rgba(250, 200, 50, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // 主体液滴
        ctx.fillStyle = `rgba(250, 220, 50, ${0.85 * pulse})`;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
        ctx.fill();

        // 高光（光泽）
        ctx.fillStyle = `rgba(255, 250, 200, ${0.6 * pulse})`;
        ctx.beginPath();
        ctx.arc(drop.x - drop.size * 0.25, drop.y - drop.size * 0.25, drop.size * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // 拖尾效果
        const trailLen = 3;
        for (let t = 1; t <= trailLen; t++) {
          const alpha = 0.3 * (1 - t / (trailLen + 1));
          const size = drop.size * (1 - t * 0.2);
          ctx.fillStyle = `rgba(250, 220, 50, ${alpha})`;
          ctx.beginPath();
          ctx.arc(drop.x - drop.vx * deltaTime * t * 3, drop.y - drop.vy * deltaTime * t * 3, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  /**
   * 渲染武器掉落物
   * @param ctx Canvas 渲染上下文
   * @param drops 武器掉落物数组
   * @param time 游戏时间
   * @param dropImages 预加载的掉落物图片缓存（可选）
   */
  static renderWeaponDrops(
    ctx: CanvasRenderingContext2D,
    drops: WeaponDrop[],
    time: number,
    dropImages?: Record<string, HTMLImageElement>
  ): void {
    for (const drop of drops) {
      const t = drop.bobPhase;
      // 浮动动画：圆形/椭圆运动
      const bobY = Math.sin(t) * 10;
      const bobX = Math.cos(t * 0.6) * 6;
      const breathe = 1 + Math.sin(t * 2) * 0.08;
      const tilt = Math.sin(t * 1.5) * 0.15;
      const alpha = Math.min(1, drop.life / 2);
      const def = WEAPON_DROP_DEFS[drop.type];
      if (!def) continue;

      ctx.save();
      ctx.globalAlpha = alpha;

      const renderX = drop.x + bobX;
      const renderY = drop.y + bobY;

      const dropImg = dropImages?.[drop.type];
      if (dropImg) {
        // 使用图片渲染，带呼吸缩放和倾斜
        const baseSize = 32;
        const imgSize = baseSize * breathe;
        ctx.translate(renderX, renderY);
        ctx.rotate(tilt);
        ctx.drawImage(dropImg, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
        ctx.rotate(-tilt);
        ctx.translate(-renderX, -renderY);
        // 辉光环
        ctx.strokeStyle = def.color.replace(')', ', 0.6)').replace('rgb', 'rgba');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(renderX, renderY, (baseSize / 2 + 2) * breathe, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // 回退：彩色方块
        const glowGrad = ctx.createRadialGradient(renderX, renderY, 0, renderX, renderY, 25 * breathe);
        glowGrad.addColorStop(0, def.color.replace(')', ', 0.4)').replace('rgb', 'rgba'));
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(renderX, renderY, 25 * breathe, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(renderX, renderY);
        ctx.rotate(tilt);
        ctx.fillStyle = def.color;
        ctx.fillRect(-12 * breathe, -12 * breathe, 24 * breathe, 24 * breathe);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-12 * breathe, -12 * breathe, 24 * breathe, 24 * breathe);
        ctx.restore();
      }

      // 标签文字
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(def.name, renderX, renderY - 22 * breathe);
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }
}