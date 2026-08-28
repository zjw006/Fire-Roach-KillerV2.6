/**
 * @fileoverview 蟑老大 Boss 战渲染器
 * @description 静态渲染方法集合：Boss 本体（序列帧 + 前摇辉光 + 退场透视缩小渐隐）、
 * 炸弹与落点标记、屏幕汁液喷溅（程序橄榄绿圆斑兜底，贴图到位后切换）、Boss 血条 HUD。
 */

import { BALANCE_CONFIG } from '../../data';
import type { BossKingBattleState, BossBomb, GooSplat, BossKingAnimAction } from './types';
import { BossKingSkill } from './types';

/** 各动作帧率（与序列帧节奏匹配） */
const ACTION_FPS: Record<BossKingAnimAction, number> = {
  hover: 8,
  purge: 8,
  wind: 10,
  bomb_warn: 8,
  bomb_throw: 10,
  hit: 10,
  exit: 8,
};

export class BossKingRenderer {
  /**
   * 渲染 Boss 地面阴影（地面阻挡面上的椭圆投影，跟随 Boss X 移动，退场时渐隐）
   * 绘制顺序需在 Boss 本体之前（阴影贴地）
   */
  static renderBossShadow(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: BossKingBattleState,
    time: number
  ): void {
    if (!state.active || state.exitStage === 'done') return;
    const cfg = BALANCE_CONFIG.bossKing;
    const sh = cfg.shadow;
    let alpha = sh.alpha;
    // 退场远去时阴影同步淡出（透视缩小后不残留）
    if (state.exitStage === 'fly') {
      const progress = Math.min(1, 1 - state.exitTimer / cfg.exit.flySec);
      alpha *= Math.max(0, 1 - progress);
    }
    if (alpha <= 0) return;

    // 呼吸感：随悬浮浮动轻微缩放/变透明（Boss 升高影子略大略淡）
    const bob = Math.sin(time * cfg.hoverYFreq) * 0.06;
    const rx = cfg.size * sh.rxRatio * (1 + bob);
    const ry = rx * sh.rySquash;
    ctx.save();
    ctx.fillStyle = `rgba(18, 12, 8, ${alpha * (1 - bob)})`;
    ctx.beginPath();
    ctx.ellipse(state.boss.x, h * sh.yRatio, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 渲染吹风技能的屏幕风速流线（仅吹风持续期间）
   * 透视规则：流线自 Boss 下方流向防线，越远越短/细/淡，越近越长/粗/亮，横向按透视扇出
   */
  static renderWindStreaks(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: BossKingBattleState,
    defenseLineY: number,
    time: number
  ): void {
    if (!state.active || state.exitStage !== 'none' || state.windTimer <= 0) return;
    const cfg = BALANCE_CONFIG.bossKing;
    const st = cfg.wind.streak;
    const top = state.boss.y + cfg.size * 0.25; // 风从 Boss 翼下发出
    const bottom = defenseLineY + 30;           // 吹到防线脚下
    const range = Math.max(80, bottom - top);

    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < st.count; i++) {
      // 相位：0=顶部（远）→ 1=底部（近），随时间向下流动
      const phase = (time * st.speed + i / st.count) % 1;
      const y = top + phase * range;
      // 透视插值：宽度/长度/透明度/扇出全部随 phase 放大
      const persp = 0.3 + phase * 0.7;
      const spread = w * st.spreadRatio * persp;
      const x = w / 2 + Math.sin(i * 7.93) * spread;
      const len = st.minLen + (st.maxLen - st.minLen) * phase;
      const fade = Math.sin(phase * Math.PI); // 两端淡入淡出，中段最实
      const alpha = 0.55 * fade * persp;
      if (alpha <= 0.02) continue;
      // 向下 + 向外倾斜（配合地面透视扇出方向）
      const lean = (x - w / 2) * 0.14;
      ctx.strokeStyle = `rgba(${st.color}, ${alpha})`;
      ctx.lineWidth = 1 + phase * (st.maxWidth - 1);
      ctx.beginPath();
      ctx.moveTo(x - lean * 0.3, y - len * 0.5);
      ctx.quadraticCurveTo(x + lean * 0.4, y, x + lean, y + len * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 渲染 Boss 本体（含前摇辉光、受击闪白、退场透视缩小渐隐）
   * @param frames 动作序列帧表（key = 动作名）
   */
  static renderBoss(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: BossKingBattleState,
    frames: Map<string, HTMLImageElement[]>,
    time: number
  ): void {
    if (!state.active) return;
    const cfg = BALANCE_CONFIG.bossKing;
    const boss = state.boss;

    // ===== 退场变换（转身 → 透视缩小飞向洞穴深处 → 渐隐） =====
    let drawX = boss.x;
    let drawY = boss.y;
    let scale = 1;
    let alpha = 1;
    if (state.exitStage === 'fly' || state.exitStage === 'done') {
      const progress = Math.min(1, 1 - state.exitTimer / cfg.exit.flySec);
      const eased = progress * progress; // ease-in 加速远去
      const targetX = w * cfg.exit.targetXRatio;
      const targetY = h * cfg.exit.targetYRatio;
      drawX = state.exitStartX + (targetX - state.exitStartX) * eased;
      drawY = state.exitStartY + (targetY - state.exitStartY) * eased;
      scale = 1 + (cfg.exit.endScale - 1) * eased;
      // 前 fadeStartRatio 保持不透明，之后渐隐至 0
      if (progress > cfg.exit.fadeStartRatio) {
        alpha = 1 - (progress - cfg.exit.fadeStartRatio) / (1 - cfg.exit.fadeStartRatio);
      }
    }

    // ===== 前摇辉光（红光预警是核心技巧检验点，用最高纯度色块） =====
    if (state.skillState === 'telegraph' && state.exitStage === 'none') {
      const pulse = 0.75 + Math.sin(time * 12) * 0.25;
      let glowColor: string | null = null;
      let glowRadius = cfg.size * 0.75;
      if (state.telegraphSkill === BossKingSkill.BOMB) {
        glowColor = cfg.bomb.telegraphGlowColor;
        glowRadius = cfg.size * 0.85; // 红光最强
      } else if (state.telegraphSkill === BossKingSkill.PURGE) {
        glowColor = cfg.purge.glowColor;
      } else {
        glowColor = cfg.wind.glowColor;
      }
      const grad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, glowRadius * scale);
      grad.addColorStop(0, `rgba(${glowColor}, ${0.5 * pulse * alpha})`);
      grad.addColorStop(1, `rgba(${glowColor}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(drawX, drawY, glowRadius * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // ===== 序列帧绘制 =====
    const action = state.exitStage !== 'none' ? 'exit' : boss.animAction;
    let actionFrames = frames.get(action);
    if (!actionFrames || actionFrames.length === 0 || !actionFrames[0]) {
      actionFrames = frames.get('hover'); // 缺失动作回退悬停
    }
    if (actionFrames && actionFrames.length > 0 && actionFrames[0]) {
      const fps = ACTION_FPS[action as BossKingAnimAction] ?? 8;
      const frameIdx = Math.floor(boss.animTimer * fps) % actionFrames.length;
      let img = actionFrames[Math.min(frameIdx, actionFrames.length - 1)];
      // 修复 2026-08-28：帧数组懒加载中可能含 null 中间帧（fill(null) 逐帧填充），
      // drawImage(null) 会抛 TypeError 中断渲染；回退到首个已加载帧
      if (!img) img = actionFrames.find(f => f != null) ?? actionFrames[0];
      const drawSize = cfg.size * scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(drawX, drawY);
      // 朝向翻转（巡逻方向）
      if (!boss.facingRight) ctx.scale(-1, 1);
      ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();

      // 受击闪白
      if (boss.damageFlash > 0 && state.exitStage === 'none') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, boss.damageFlash * 5) * 0.7 * alpha;
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(drawX, drawY);
        if (!boss.facingRight) ctx.scale(-1, 1);
        ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.restore();
      }
    }
  }

  /**
   * 渲染炸弹与落点标记（虚线抛物线轨迹 + 地面阴影 + Y 压缩椭圆落点环 + 倒计时收缩弧）
   */
  static renderBombs(
    ctx: CanvasRenderingContext2D,
    bombs: readonly BossBomb[],
    bombImg: HTMLImageElement | null,
    time: number
  ): void {
    const cfg = BALANCE_CONFIG.bossKing.bomb;

    // ===== 虚线抛物线轨迹（投弹瞬间显示，路径与飞行公式一致：水平线性 + 垂直抛物线拱高） =====
    const tj = cfg.trajectory;
    ctx.save();
    ctx.strokeStyle = `rgba(${tj.color}, ${tj.alpha})`;
    ctx.lineWidth = tj.width;
    ctx.setLineDash(tj.dash);
    for (const bomb of bombs) {
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const p = i / 36;
        const x = bomb.x0 + (bomb.x1 - bomb.x0) * p;
        const y = bomb.y0 + (bomb.y1 - bomb.y0) * p - cfg.arcHeight * 4 * p * (1 - p);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // ===== 炸弹地面阴影（落点平面投影，随高度缩小/变淡） =====
    const gs = cfg.groundShadow;
    for (const bomb of bombs) {
      const drop = Math.min(1, Math.max(0, (bomb.y1 - bomb.y) / gs.refDropPx)); // 1=高空 0=贴地
      const rx = gs.maxRx + (gs.minRx - gs.maxRx) * drop;
      const alpha = gs.maxAlpha + (gs.minAlpha - gs.maxAlpha) * drop;
      ctx.save();
      ctx.fillStyle = `rgba(18, 12, 8, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(bomb.x, bomb.y1, rx, rx * gs.squash, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ===== 落点标记（投弹瞬间显示，双发双标记；Y 轴压缩椭圆符合地面透视） =====
    for (const bomb of bombs) {
      const remain = Math.max(0, 1 - bomb.elapsed / cfg.flightSec);
      const pulse = 0.6 + Math.sin(time * 10) * 0.4;
      const rx = 26;
      const ry = rx * cfg.markerSquash;
      // 外圈虚线环
      ctx.save();
      ctx.strokeStyle = `rgba(255, 80, 60, ${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.ellipse(bomb.x1, bomb.y1, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 倒计时收缩弧（顺时针收拢 = 剩余飞行时间）
      ctx.strokeStyle = `rgba(255, 160, 60, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(bomb.x1, bomb.y1, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remain);
      ctx.stroke();
      ctx.restore();
    }

    // ===== 炸弹本体 =====
    for (const bomb of bombs) {
      ctx.save();
      ctx.translate(bomb.x, bomb.y);
      ctx.rotate(bomb.elapsed * 4); // 飞行旋转
      const size = cfg.size;
      if (bombImg) {
        ctx.drawImage(bombImg, -size / 2, -size / 2, size, size);
      } else {
        // 图片缺失兜底：深色圆 + 引信点
        ctx.fillStyle = '#3a2f28';
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // 末段红光闪烁（接近自动爆炸）
      const t = bomb.elapsed / cfg.flightSec;
      if (t > 0.7) {
        const blink = (Math.sin(time * 20) + 1) * 0.5;
        ctx.fillStyle = `rgba(255, 60, 40, ${blink * 0.35})`;
        ctx.beginPath();
        ctx.arc(bomb.x, bomb.y, size * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * 渲染屏幕汁液喷溅（屏幕空间覆盖层，最后绘制——模拟溅到"镜头"上）
   * 贴图空窗期：程序橄榄绿半透明圆斑（主圆 + 种子卫星圆）
   */
  static renderGoo(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    goos: readonly GooSplat[]
  ): void {
    if (goos.length === 0) return;
    const gooCfg = BALANCE_CONFIG.bossKing.goo;

    for (const goo of goos) {
      // 渐隐：最后 fadeSec 秒透明度线性降至 0
      const alpha = goo.life > gooCfg.fadeSec ? 1 : Math.max(0, goo.life / gooCfg.fadeSec);
      const cx = goo.x * w;
      const cy = goo.y * h;
      const r = goo.radius;

      ctx.save();
      // 主圆斑
      ctx.fillStyle = `rgba(${gooCfg.color}, ${0.5 * alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // 种子卫星圆斑（模拟不规则飞溅形）
      for (let i = 0; i < 6; i++) {
        const ang = (Math.sin(goo.seed + i * 2.39) * 0.5 + 0.5) * Math.PI * 2;
        const dist = r * (0.55 + (Math.sin(goo.seed * 1.7 + i * 3.13) * 0.5 + 0.5) * 0.6);
        const sr = r * (0.18 + (Math.sin(goo.seed * 2.3 + i * 1.61) * 0.5 + 0.5) * 0.25);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      // 中心深色核（增加层次）
      ctx.fillStyle = `rgba(${gooCfg.color}, ${0.35 * alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 渲染 Boss 血条 HUD（顶部居中，含阶段刻度）
   */
  static renderHUD(
    ctx: CanvasRenderingContext2D,
    w: number,
    state: BossKingBattleState
  ): void {
    if (!state.active) return;
    const boss = state.boss;
    const barW = Math.min(400, w * 0.7);
    const barH = 18;
    const barX = (w - barW) / 2;
    const barY = 82;

    // 名称
    ctx.fillStyle = '#ffd778';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('蟑老大', w / 2, barY - 8);
    ctx.shadowBlur = 0;

    // 底槽
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // 血量（红色渐变）
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    if (ratio > 0) {
      const grad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      grad.addColorStop(0, '#ff7a5c');
      grad.addColorStop(1, '#c92f1e');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * ratio, barH, 4);
      ctx.fill();
    }

    // 阶段刻度（50% / 20%）
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (const tick of [0.5, 0.2]) {
      const tx = barX + barW * tick;
      ctx.beginPath();
      ctx.moveTo(tx, barY + 2);
      ctx.lineTo(tx, barY + barH - 2);
      ctx.stroke();
    }
  }
}
