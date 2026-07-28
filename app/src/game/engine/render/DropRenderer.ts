/**
 * @fileoverview 掉落物渲染工具模块
 * @description 提供粘性弹丸、武器掉落物和战场道具箱的静态渲染方法
 */

import { WEAPON_DROP_DEFS, RENDER_COLOR, RENDER_FONT, BALANCE_CONFIG } from '../../data';
import { RoachState } from '../../types';
import type { StickyDrop, WeaponDrop, Roach, ItemDropOnField } from '../../types';

// 重新导出供外部使用
export type { ItemDropOnField } from '../../types';

/**
 * 掉落物渲染工具类
 * @description 提供纯静态渲染方法，不维护内部状态
 */
export class DropRenderer {
  /** 粘性弹丸辉光渐变缓存（归一化：半径=1，使用时通过 translate+scale 定位缩放） */
  private static _stickyGlowGradient: CanvasGradient | null = null;

  /**
   * 将颜色字符串安全转换为 rgba 格式
   * 支持 hex (#rrggbb) 和 rgb(r, g, b) 两种输入格式
   * @param color 颜色字符串
   * @param alpha 透明度 (0-1)
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
    // 已经是 rgba 或无法识别的格式，直接返回
    return color;
  }

  /**
   * 获取或创建粘性弹丸辉光归一化渐变（缓存复用）
   */
  private static getStickyGlowGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (!DropRenderer._stickyGlowGradient) {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      const cfg = BALANCE_CONFIG.render.drop.sticky;
      grad.addColorStop(0, cfg.glowInnerColor.replace('{alpha}', String(cfg.glowAlpha)));
      grad.addColorStop(1, cfg.glowOuterColor);
      DropRenderer._stickyGlowGradient = grad;
    }
    return DropRenderer._stickyGlowGradient;
  }

  /**
   * 渲染粘性弹丸
   * @param ctx Canvas 渲染上下文
   * @param drops 粘性弹丸数组
   * @param roaches 蟑螂数组（用于查找附着目标）
   * @param time 游戏时间
   * @param _deltaTime 帧间隔时间（未使用，拖尾使用固定时间步长）
   */
  static renderStickyDrops(
    ctx: CanvasRenderingContext2D,
    drops: StickyDrop[],
    roaches: Roach[],
    time: number,
    _deltaTime: number
  ): void {
    const cfg = BALANCE_CONFIG.render.drop.sticky;

    // 构建 Map 实现 O(1) 目标查找（替代每帧 find 遍历）
    const roachMap = new Map<number, Roach>();
    for (const r of roaches) roachMap.set(r.id, r);

    for (const drop of drops) {
      // 跳过预生成阶段的弹丸（仍在延迟阶段）
      if (drop.life > drop.maxLife) continue;

      ctx.save();

      if (drop.hit && drop.targetId !== null) {
        // 弹丸已附着在蟑螂上 - 绘制滴落效果
        const target = roachMap.get(drop.targetId);
        if (target && target.state === RoachState.ALIVE) {
          const alpha = cfg.attachedAlphaBase + Math.sin(time * cfg.dripTimeScale + drop.id) * cfg.attachedAlphaAmplitude;
          ctx.strokeStyle = cfg.attachedStrokeColor.replace('{alpha}', alpha.toFixed(2));
          ctx.lineWidth = cfg.attachedLineWidth;
          for (let d = 0; d < cfg.dripCount; d++) {
            const angle = cfg.dripAngleSpacing * d + time * 2 + drop.id;
            const dripLen = cfg.dripLengthBase + Math.sin(time * 6 + d) * cfg.dripLengthAmplitude;
            ctx.beginPath();
            ctx.moveTo(
              target.x + Math.cos(angle) * cfg.attachedBaseRadius,
              target.y + Math.sin(angle) * cfg.attachedBaseRadius
            );
            ctx.lineTo(
              target.x + Math.cos(angle) * (cfg.attachedBaseRadius + dripLen),
              target.y + Math.sin(angle) * (cfg.attachedBaseRadius + dripLen)
            );
            ctx.stroke();
          }
        }
      } else {
        // 飞行中的弹丸 - 绘制黄色液体滴
        const pulse = cfg.pulseBase + Math.sin(time * 10 + drop.id) * cfg.pulseAmplitude;

        // 外部辉光 - 使用归一化渐变缓存 + translate/scale 定位
        const glowGrad = DropRenderer.getStickyGlowGradient(ctx);
        ctx.save();
        ctx.translate(drop.x, drop.y);
        const glowSize = drop.size * cfg.glowSizeMultiplier;
        ctx.scale(glowSize, glowSize);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 主体液滴
        ctx.fillStyle = cfg.bodyColor.replace('{alpha}', (cfg.bodyAlpha * pulse).toFixed(2));
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
        ctx.fill();

        // 高光（光泽）
        ctx.fillStyle = cfg.highlightColor.replace('{alpha}', (cfg.highlightAlpha * pulse).toFixed(2));
        ctx.beginPath();
        ctx.arc(
          drop.x - drop.size * cfg.highlightOffsetRatio,
          drop.y - drop.size * cfg.highlightOffsetRatio,
          drop.size * cfg.highlightSizeRatio,
          0, Math.PI * 2
        );
        ctx.fill();

        // 拖尾效果 - 使用固定时间步长替代 deltaTime
        for (let t = 1; t <= cfg.trailLength; t++) {
          const alpha = cfg.trailAlphaBase * (1 - t / (cfg.trailLength + 1));
          const size = drop.size * (1 - t * cfg.trailSizeDecay);
          ctx.fillStyle = cfg.trailColor.replace('{alpha}', alpha.toFixed(2));
          ctx.beginPath();
          ctx.arc(
            drop.x - drop.vx * cfg.fixedTrailStep * t * 3,
            drop.y - drop.vy * cfg.fixedTrailStep * t * 3,
            size, 0, Math.PI * 2
          );
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
    const cfg = BALANCE_CONFIG.render.drop.weapon;

    for (const drop of drops) {
      const t = drop.bobPhase;
      const bobY = Math.sin(t) * cfg.bobYAmplitude;
      const bobX = Math.cos(t * cfg.bobXTimeScale) * cfg.bobXAmplitude;
      const breathe = cfg.breatheBase + Math.sin(t * cfg.breatheTimeScale) * cfg.breatheAmplitude;
      const tilt = Math.sin(t * cfg.tiltTimeScale) * cfg.tiltAmplitude;
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
        const imgSize = cfg.baseSize * breathe;
        ctx.save();
        ctx.translate(renderX, renderY);
        ctx.rotate(tilt);
        ctx.drawImage(dropImg, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
        ctx.restore();

        // 辉光环
        ctx.strokeStyle = DropRenderer.toRgba(def.color, cfg.haloAlpha);
        ctx.lineWidth = cfg.haloLineWidth;
        ctx.beginPath();
        ctx.arc(renderX, renderY, (cfg.baseSize / 2 + 2) * breathe, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // 回退：彩色方块
        const glowGrad = ctx.createRadialGradient(renderX, renderY, 0, renderX, renderY, cfg.glowSize * breathe);
        glowGrad.addColorStop(0, DropRenderer.toRgba(def.color, cfg.glowAlpha));
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(renderX, renderY, cfg.glowSize * breathe, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(renderX, renderY);
        ctx.rotate(tilt);
        ctx.fillStyle = def.color;
        const halfSize = cfg.fallbackSize / 2 * breathe;
        ctx.fillRect(-halfSize, -halfSize, cfg.fallbackSize * breathe, cfg.fallbackSize * breathe);
        ctx.strokeStyle = cfg.fallbackStrokeColor;
        ctx.lineWidth = cfg.fallbackLineWidth;
        ctx.strokeRect(-halfSize, -halfSize, cfg.fallbackSize * breathe, cfg.fallbackSize * breathe);
        ctx.restore();
      }

      // 标签文字
      ctx.fillStyle = '#fff';
      ctx.font = cfg.labelFont;
      ctx.textAlign = 'center';
      ctx.shadowColor = cfg.labelShadowColor;
      ctx.shadowBlur = cfg.labelShadowBlur;
      ctx.fillText(def.name, renderX, renderY + cfg.labelOffsetY * breathe);
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  /**
   * 渲染战场掉落道具箱（关卡结束后掉落的金色道具箱）
   * @param ctx Canvas 渲染上下文
   * @param drop 掉落道具状态
   * @param dropImages 道具图片映射
   */
  static renderItemDropOnField(
    ctx: CanvasRenderingContext2D,
    drop: ItemDropOnField,
    dropImages?: Record<string, HTMLImageElement> | null
  ): void {
    const cfg = BALANCE_CONFIG.render.drop.item;

    const bobY = Math.sin(drop.bobPhase) * cfg.bobYAmplitude;
    const x = drop.x;
    const y = drop.y + bobY;

    // 辉光效果
    const glowPulse = (Math.sin(drop.bobPhase * 2) + 1) * cfg.glowPulseBase + cfg.glowPulseAmplitude * 0;
    // 实际计算: (sin+1)*0.5 + 0.5 的极值范围是 [0.5, 1.5]，但原代码用的是 (sin+1)*0.5
    // 保持原始行为: glowPulse = (sin(t*2)+1) * 0.5, 范围 [0, 1]
    const actualGlowPulse = (Math.sin(drop.bobPhase * 2) + 1) * cfg.glowPulseBase;

    const gradient = ctx.createRadialGradient(x, y, cfg.size * cfg.glowInnerRadiusRatio, x, y, cfg.size * cfg.glowOuterRadiusRatio);
    gradient.addColorStop(0, cfg.glowColor1.replace('{alpha}', (0.4 + actualGlowPulse * 0.3).toFixed(2)));
    gradient.addColorStop(0.5, cfg.glowColor2.replace('{alpha}', (0.2 + actualGlowPulse * 0.2).toFixed(2)));
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, cfg.size * cfg.glowOuterRadiusRatio, 0, Math.PI * 2);
    ctx.fill();

    // 外环动画
    ctx.strokeStyle = cfg.outerRingColor.replace(
      '{alpha}',
      (cfg.outerRingAlphaBase + actualGlowPulse * cfg.outerRingAlphaAmplitude).toFixed(2)
    );
    ctx.lineWidth = cfg.outerRingLineWidth;
    ctx.beginPath();
    ctx.arc(x, y, cfg.size * (cfg.outerRingBaseSizeRatio + actualGlowPulse * cfg.outerRingAmplitudeRatio), 0, Math.PI * 2);
    ctx.stroke();

    // 内环（反向旋转）
    ctx.strokeStyle = cfg.innerRingColor.replace(
      '{alpha}',
      (cfg.innerRingAlphaBase + actualGlowPulse * cfg.innerRingAlphaAmplitude).toFixed(2)
    );
    ctx.lineWidth = cfg.innerRingLineWidth;
    ctx.beginPath();
    ctx.arc(
      x, y,
      cfg.size * (cfg.innerRingSizeRatio - actualGlowPulse * cfg.innerRingDecayRatio),
      drop.bobPhase,
      drop.bobPhase + cfg.innerRingAngleLength
    );
    ctx.stroke();

    // 绘制道具图标
    const itemImg = dropImages?.[drop.type];
    const halfSize = cfg.size / 2;
    if (itemImg) {
      ctx.drawImage(itemImg, x - halfSize, y - halfSize, cfg.size, cfg.size);
    } else {
      // 回退：金色方块 + 问号
      ctx.fillStyle = RENDER_COLOR.dropFallback;
      ctx.fillRect(x - halfSize, y - halfSize, cfg.size, cfg.size);
      ctx.fillStyle = '#000';
      ctx.font = RENDER_FONT.title;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x, y);
    }
  }
}