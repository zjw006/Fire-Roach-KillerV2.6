/**
 * @fileoverview 地铁场景专属：列车系统模块
 * @description
 * 列车按每波时刻表自动驶过（场景被动事件，无需玩家操作），驶过前在轨道起点闪烁预警提示玩家。
 * 时刻表时间从波次生成（doWaveSpawn）起算；波次提前清完时取消该波剩余列车。
 * 列车沿贝塞尔曲线从左向右贯穿场景，碾压秒杀路径上的全部蟑螂（无视护甲，
 * 击杀照常发放金币/击杀数/成就计数；地铁精英被碾压后分裂为 2 只小蟑螂，由引擎击杀管线处理）。
 */

import { GameState, SceneType, RoachState, type Roach, type TrainSweep, type Particle } from '../../types';
import { ParticleType } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/** 列车系统配置接口（回调全部使用箭头函数传入，避免闭包陷阱） */
export interface TrainSystemConfig {
  /** 获取当前场景 */
  getCurrentScene: () => SceneType;
  /** 获取当前游戏状态 */
  getGameState: () => GameState;
  /** 获取画布宽度 */
  getCanvasWidth: () => number;
  /** 获取防线 Y 坐标 */
  getDefenseLineY: () => number;
  /** 列车碾压击杀（引擎击杀管线：金币/击杀数/成就 + 精英分裂） */
  onTrainKill: (roach: Roach) => void;
  /** 浮动文字 */
  onAddFloatingText: (x: number, y: number, text: string, color: string, duration?: number) => void;
  /** 粒子 */
  onAddParticle: (p: Particle) => void;
  /** 屏幕震动 */
  onScreenShake: (amount: number) => void;
  /** 播放音效 */
  onPlaySound: (name: 'train' | 'trainStop') => void;
}

export class TrainSystem {
  private config: TrainSystemConfig;
  /** 横扫中的列车 */
  private trains: TrainSweep[] = [];
  /** 当前波次已流逝时间（秒，从波次生成起算，仅 PLAYING 状态推进） */
  private waveTime: number = 0;
  /** 当前波次待触发的列车时刻队列（升序，秒） */
  private pendingTimes: number[] = [];
  /** 是否处于预警阶段（轨道起点闪烁提示） */
  private warning: boolean = false;
  /** 预警已持续时间（秒，达到 warningTime 时生成列车） */
  private warningElapsed: number = 0;
  /** 渲染时间（用于预警闪烁动画） */
  private time: number = 0;

  constructor(config: TrainSystemConfig) {
    this.config = config;
  }

  updateConfig(partial: Partial<TrainSystemConfig>): void {
    Object.assign(this.config, partial);
  }

  /** 重置（resetGame 时调用） */
  reset(): void {
    this.trains = [];
    this.waveTime = 0;
    this.pendingTimes = [];
    this.warning = false;
    this.warningElapsed = 0;
  }

  /** 波次开始（doWaveSpawn 时由 WaveManager 通知）：加载该波列车时刻表 */
  onWaveStart(wave: number): void {
    const schedule = BALANCE_CONFIG.train.waveSchedule;
    const times = schedule[wave] ?? schedule[10]; // 未配置的波次回退到第 10 波（终局频次）
    this.pendingTimes = [...times].sort((a, b) => a - b);
    this.waveTime = 0;
    this.warning = false;
    this.warningElapsed = 0;
  }

  /** 波次清空（WaveManager 通知）：取消该波剩余列车（在场列车继续驶完） */
  onWaveCleared(): void {
    this.pendingTimes = [];
    this.warning = false;
    this.warningElapsed = 0;
  }

  /** 铁轨中心 Y 坐标 */
  getRailY(railIndex: number): number {
    const ratios = BALANCE_CONFIG.train.railYRatios;
    const idx = Math.max(0, Math.min(railIndex, ratios.length - 1));
    return this.config.getDefenseLineY() * ratios[idx];
  }

  /** 主更新（每帧调用） */
  update(deltaTime: number, roaches: Roach[]): void {
    this.time += deltaTime;
    const cfg = BALANCE_CONFIG.train;

    if (this.config.getGameState() === GameState.PLAYING && this.config.getCurrentScene() === SceneType.SUBWAY) {
      // ===== 每波时刻表调度：波次时间推进，到点前 warningTime 秒进入预警 =====
      this.waveTime += deltaTime;
      const nextTime = this.pendingTimes[0];

      // 进入预警阶段（到达 触发时刻 - warningTime 时闪烁提示）
      if (!this.warning && nextTime !== undefined && this.trains.length === 0
          && this.waveTime >= nextTime - cfg.warningTime) {
        this.warning = true;
        this.warningElapsed = this.waveTime - (nextTime - cfg.warningTime);
        const start = cfg.trainStart;
        this.config.onAddFloatingText(start.x * this.wr + 60, start.y - 40, TEXT_CONFIG.combat.trainWarning.text, TEXT_CONFIG.combat.trainWarning.color);
      }
      // 预警结束，生成列车
      if (this.warning) {
        this.warningElapsed += deltaTime;
        if (this.warningElapsed >= cfg.warningTime) {
          this.trains.push({
            railIndex: 0,
            y: cfg.trainStart.y,
            t: 0,
            frameTimer: 0,
            active: true,
          });
          this.pendingTimes.shift();
          this.warning = false;
          this.warningElapsed = 0;
          this.config.onAddFloatingText(this.config.getCanvasWidth() / 2, cfg.trainStart.y - 70, TEXT_CONFIG.combat.trainIncoming.text, TEXT_CONFIG.combat.trainIncoming.color);
          this.config.onScreenShake(6);
          this.config.onPlaySound('train');
        }
      }
    }

    // ===== 列车沿贝塞尔曲线碾压 =====
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const tr = this.trains[i];
      // 推进曲线参数（匀速驶完全程）
      tr.t += deltaTime / cfg.trainDuration;
      // 推进序列帧动画计时器
      tr.frameTimer += deltaTime;

      // 计算当前车头圆心（曲线点 + 切线前移偏移）
      const head = this.getTrainHeadPos(tr);

      // 碾压判定：蟑螂与车头碰撞圆相交
      for (const r of roaches) {
        if (r.state !== RoachState.ALIVE) continue;
        const dx = r.x - head.x;
        const dy = r.y - head.y;
        const rr = cfg.trainHeadRadius + (r.size ? r.size * 0.3 : 15); // 蟑螂近似半径
        if (dx * dx + dy * dy > rr * rr) continue;
        r.killedByTrain = true;
        this.config.onTrainKill(r);
        this.config.onAddFloatingText(r.x, r.y - 30, TEXT_CONFIG.combat.trainKill.text, TEXT_CONFIG.combat.trainKill.color);
        // 碾压火花
        for (let k = 0; k < 6; k++) {
          this.config.onAddParticle({
            x: r.x, y: r.y,
            vx: 80 + Math.random() * 160,
            vy: -40 - Math.random() * 80,
            life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
            size: 3 + Math.random() * 4,
            color: 'rgba(255, 120, 60, 0.8)',
            type: ParticleType.SPARK,
          });
        }
      }

      // 车头喷出的烟尘（沿曲线位置）
      if (Math.random() < 0.5) {
        this.config.onAddParticle({
          x: head.x, y: head.y + 20,
          vx: -60 - Math.random() * 60,
          vy: -30 - Math.random() * 40,
          life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
          size: 5 + Math.random() * 7,
          color: 'rgba(120, 110, 100, 0.4)',
          type: ParticleType.ASH,
        });
      }

      // 驶完全程（t >= 1，已完全驶出右侧）后移除
      if (tr.t >= 1) {
        this.trains.splice(i, 1);
        // 无在场列车时停止驶过音效（防止多列车重叠时提前停止）
        if (this.trains.length === 0) {
          this.config.onPlaySound('trainStop');
        }
      }
    }
  }

  /** 宽度缩放比（540 设计宽度 → 当前逻辑宽度），与地面边界 getGroundBoundsAtY 的 wr 规则一致（开发准则 27.4） */
  private get wr(): number {
    return this.config.getCanvasWidth() / 540;
  }

  /** 计算三次贝塞尔曲线上的点（t ∈ [0,1]），返回画布逻辑坐标（X 已按宽度比 wr 缩放） */
  private bezierPoint(t: number): { x: number; y: number } {
    const cfg = BALANCE_CONFIG.train;
    const p0 = cfg.trainStart;
    const p1 = cfg.trainControl1;
    const p2 = cfg.trainControl2;
    const p3x = cfg.trainEnd.x;
    const p3y = cfg.trainEnd.y;
    const u = 1 - t;
    const uu = u * u;
    const uuu = uu * u;
    const tt = t * t;
    const ttt = tt * t;
    const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3x;
    const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3y;
    // Fixed Height 模式：高度固定 960 无需缩放，X 坐标按宽度比 wr 缩放（窄屏等比缩窄）
    return { x: x * this.wr, y };
  }

  /** 计算曲线在 t 处的单位切线方向（指向运动方向），X 分量按 wr 缩放 */
  private bezierTangent(t: number): { x: number; y: number } {
    const cfg = BALANCE_CONFIG.train;
    const p0 = cfg.trainStart;
    const p1 = cfg.trainControl1;
    const p2 = cfg.trainControl2;
    const p3x = cfg.trainEnd.x;
    const p3y = cfg.trainEnd.y;
    const u = 1 - t;
    const dx = (3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3x - p2.x)) * this.wr;
    const dy = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3y - p2.y);
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  /** 获取列车车头碰撞圆圆心（曲线点 + 切线方向前移偏移） */
  private getTrainHeadPos(train: TrainSweep): { x: number; y: number } {
    const cfg = BALANCE_CONFIG.train;
    const t = Math.max(0, Math.min(1, train.t));
    const pos = this.bezierPoint(t);
    if (cfg.trainHeadOffset !== 0) {
      const tan = this.bezierTangent(t);
      return { x: pos.x + tan.x * cfg.trainHeadOffset, y: pos.y + tan.y * cfg.trainHeadOffset };
    }
    return pos;
  }

  /** 获取当前帧图片索引（按帧率推进，播放 1 次后停在最后一帧，不循环） */
  private getTrainFrameIndex(train: TrainSweep): number {
    const cfg = BALANCE_CONFIG.train;
    const frame = Math.floor(train.frameTimer * cfg.trainFrameRate);
    return Math.min(frame, cfg.trainFrameCount - 1); // 钳制到最后一帧
  }

  /** 渲染（轨道起点预警闪烁 + 列车序列帧） */
  render(ctx: CanvasRenderingContext2D, trainFrames: (HTMLImageElement | null)[] = []): void {
    const cfg = BALANCE_CONFIG.train;
    const width = this.config.getCanvasWidth();

    // ===== 预警阶段：轨道起点闪烁红色警示圈 + 列车将至提示 =====
    if (this.warning) {
      const start = cfg.trainStart;
      const startX = start.x * this.wr; // X 坐标按宽度比缩放（与地面边界一致）
      const pulse = 0.5 + Math.sin(this.time * 12) * 0.4; // 急促闪烁

      // 轨道横向高亮条（预警整条列车路径）
      ctx.save();
      ctx.globalAlpha = pulse * 0.18;
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(0, start.y - cfg.bandHalfHeight, width, cfg.bandHalfHeight * 2);
      ctx.restore();

      // 轨道起点红色闪烁虚线圈
      ctx.save();
      ctx.strokeStyle = `rgba(220, 38, 38, ${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -this.time * 40;
      ctx.beginPath();
      ctx.ellipse(startX, start.y, 50, 24, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 中央惊叹号图标
      ctx.fillStyle = `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`;
      ctx.font = 'bold 30px "Comic Sans MS", cursive, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', startX, start.y - 4);
      ctx.restore();
    }

    // ===== 列车序列帧（氛围事件图 540×480，固定绘制于 0,211，不随贝塞尔移动） =====
    // 纯视觉氛围：列车贝塞尔移动 + 碾压碰撞判定仍独立进行，序列帧仅作为列车经过的画面
    for (const tr of this.trains) {
      const frameIdx = this.getTrainFrameIndex(tr);
      const frameImg = trainFrames[frameIdx] ?? null;
      if (frameImg) {
        ctx.drawImage(frameImg, 0, 211, 540, 480);
      } else {
        // 序列帧未加载时：以车头碰撞圆调试渲染（降级方案）
        const head = this.getTrainHeadPos(tr);
        ctx.save();
        ctx.fillStyle = 'rgba(80, 90, 110, 0.7)';
        ctx.beginPath();
        ctx.arc(head.x, head.y, cfg.trainHeadRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /**
   * 调试渲染（地铁场景调试用）：
   * 1. 贝塞尔曲线轨迹、控制点、曲率参数文本
   * 2. 车头碰撞圆（圆心十字 + 半径 + 坐标标注）
   * （地面阻挡线已由引擎 showMovementRange 渲染，此处不再重复绘制）
   */
  renderDebug(ctx: CanvasRenderingContext2D): void {
    if (this.config.getCurrentScene() !== SceneType.SUBWAY) return;
    const cfg = BALANCE_CONFIG.train;

    ctx.save();
    ctx.font = 'bold 12px monospace';
    ctx.textBaseline = 'middle';

    // ===== 1. 贝塞尔曲线轨迹 + 控制点 =====
    const wr = this.wr; // 宽度缩放比：控制点 X 坐标需同步缩放才能与曲线贴合
    const p0 = { x: cfg.trainStart.x * wr, y: cfg.trainStart.y };
    const p1 = { x: cfg.trainControl1.x * wr, y: cfg.trainControl1.y };
    const p2 = { x: cfg.trainControl2.x * wr, y: cfg.trainControl2.y };
    const p3 = { x: cfg.trainEnd.x * wr, y: cfg.trainEnd.y };

    // 曲线本体（采样 60 段）
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const pt = this.bezierPoint(i / 60);
      if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // 控制多边形（虚线连接起点-控制点1-控制点2-终点）
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 四个控制点标记（标签显示设计坐标，标记位置为缩放后实际坐标）
    const drawCtrlPt = (x: number, y: number, label: string, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 14);
    };
    drawCtrlPt(p0.x, p0.y, `P0(${cfg.trainStart.x},${cfg.trainStart.y})`, '#4ade80');
    drawCtrlPt(p1.x, p1.y, `P1(${cfg.trainControl1.x},${cfg.trainControl1.y})`, '#fb923c');
    drawCtrlPt(p2.x, p2.y, `P2(${cfg.trainControl2.x},${cfg.trainControl2.y})`, '#fb923c');
    drawCtrlPt(p3.x, p3.y, `P3(${cfg.trainEnd.x},${cfg.trainEnd.y})`, '#f87171');

    // 曲率参数文本（左上角信息面板，设计坐标 + 缩放比）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(6, 6, 240, 76);
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    ctx.fillText(`贝塞尔曲线 (三次) wr=${wr.toFixed(2)}`, 12, 20);
    ctx.fillStyle = '#e7e5e4';
    ctx.font = '11px monospace';
    ctx.fillText(`P0(${cfg.trainStart.x},${cfg.trainStart.y}) P1(${cfg.trainControl1.x},${cfg.trainControl1.y})`, 12, 36);
    ctx.fillText(`P2(${cfg.trainControl2.x},${cfg.trainControl2.y}) P3(${cfg.trainEnd.x},${cfg.trainEnd.y})`, 12, 50);
    ctx.fillText(`时长=${cfg.trainDuration}s 帧率=${cfg.trainFrameRate.toFixed(2)}FPS`, 12, 64);
    ctx.fillText(`终点 P3 实际(${p3.x.toFixed(0)},${p3.y.toFixed(0)})`, 12, 76);

    // ===== 3. 车头碰撞圆（跟随每个在场列车车头移动） =====
    for (const tr of this.trains) {
      const head = this.getTrainHeadPos(tr);
      const cx = head.x;
      const cy = head.y;

      // ===== 风阻特效（随车头运动，逆风向后拖曳的气流弧线） =====
      this.renderWindResistance(ctx, tr, cx, cy);

      // 碰撞圆
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, cfg.trainHeadRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 半透明填充
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.beginPath();
      ctx.arc(cx, cy, cfg.trainHeadRadius, 0, Math.PI * 2);
      ctx.fill();

      // 圆心十字
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
      ctx.stroke();

      // 圆心坐标 + 半径标注
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(cx + 12, cy - 30, 150, 40);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`碰撞圆心(${cx.toFixed(0)},${cy.toFixed(0)})`, cx + 16, cy - 20);
      ctx.fillStyle = '#fca5a5';
      ctx.fillText(`R=${cfg.trainHeadRadius} (随车头)`, cx + 16, cy - 6);
    }

    ctx.restore();
  }

  /**
   * 风阻特效：随车头运动，沿切线反方向拖曳的气流弧线。
   * 多条半透明圆弧从车头向后逐渐变细、变淡，模拟高速行驶的破风感。
   */
  private renderWindResistance(ctx: CanvasRenderingContext2D, train: TrainSweep, headX: number, headY: number): void {
    const t = Math.max(0, Math.min(1, train.t));
    const tan = this.bezierTangent(t); // 车头运动方向（单位向量）
    // 风阻方向 = 运动反方向（车尾侧）
    const backX = -tan.x;
    const backY = -tan.y;
    // 垂直方向（用于横向展开弧线）
    const perpX = -backY;
    const perpY = backX;

    const lineCount = 5;
    const time = this.time;
    for (let i = 0; i < lineCount; i++) {
      const fi = i / (lineCount - 1); // 0~1，0 居中
      const offset = (fi - 0.5) * 2;  // -1~1，横向展开偏移
      const lateral = offset * 26;    // 横向展开幅度（像素）
      // 起点贴近车头，向后拖曳
      const startDist = 12;
      const len = 90 + Math.sin(time * 12 + i * 1.7) * 18; // 长度呼吸脉动
      const sx = headX + backX * startDist + perpX * lateral;
      const sy = headY + backY * startDist + perpY * lateral;
      const ex = sx + backX * len;
      const ey = sy + backY * len;
      // 控制点：向后 + 略微向外弯，形成气流拖尾弧度
      const mx = sx + backX * len * 0.5 + perpX * offset * 14;
      const my = sy + backY * len * 0.5 + perpY * offset * 14;

      const alpha = (1 - fi * 0.5) * (0.35 + Math.sin(time * 16 + i) * 0.1);
      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha})`; // 淡蓝白气流
      ctx.lineWidth = 3.2 - fi * 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
    }
  }
}
