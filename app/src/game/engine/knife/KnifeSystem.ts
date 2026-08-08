/**
 * @fileoverview 斩螂·110 武器模块
 * @description
 * 点击道具按钮后，刀刃自动跃向场上威胁最高的目标（一击必杀，无视护甲）：
 *   优先级：拆除中的隧道工 > 冲刺中的地铁精英 > 距离玩家最近的蟑螂。
 * 刀刃从防线飞跃至目标（斩击），随后飞回。被斩的地铁精英不触发碾压分裂
 * （分裂仅由列车碾压触发，引擎击杀管线按 killedByTrain 标记区分）。
 * Boss（女王）免疫斩击，不会被选为目标。
 */

import { RoachType, RoachState, type Roach, type Particle } from '../../types';
import { ParticleType } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/** 斩螂·110 系统配置接口（回调全部使用箭头函数传入，避免闭包陷阱） */
export interface KnifeSystemConfig {
  /** 获取画布宽度 */
  getCanvasWidth: () => number;
  /** 获取防线 Y 坐标 */
  getDefenseLineY: () => number;
  /** 浮动文字 */
  onAddFloatingText: (x: number, y: number, text: string, color: string) => void;
  /** 粒子 */
  onAddParticle: (p: Particle) => void;
  /** 屏幕震动 */
  onScreenShake: (amount: number) => void;
  /** 播放挥刀音效 */
  onPlaySound: () => void;
  /** 震动反馈 */
  onVibrate: () => void;
  /** 击杀回调（引擎击杀管线：金币/击杀数/成就；不标记 killedByTrain，精英不分裂） */
  onKillRoach: (roach: Roach) => void;
}

/** 刀刃飞跃状态 */
interface KnifeDash {
  active: boolean;
  /** out = 飞向目标；back = 飞回防线 */
  phase: 'out' | 'back';
  timer: number;
  duration: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** 当前刀刃位置 */
  x: number;
  y: number;
  /** 目标蟑螂 ID（到达时击杀） */
  targetId: number | null;
  /** 飞行方向角（渲染旋转用） */
  angle: number;
}

export class KnifeSystem {
  private config: KnifeSystemConfig;
  private dash: KnifeDash = {
    active: false, phase: 'out', timer: 0, duration: 0,
    fromX: 0, fromY: 0, toX: 0, toY: 0, x: 0, y: 0,
    targetId: null, angle: 0,
  };

  constructor(config: KnifeSystemConfig) {
    this.config = config;
  }

  updateConfig(partial: Partial<KnifeSystemConfig>): void {
    Object.assign(this.config, partial);
  }

  /** 重置（resetGame 时调用） */
  reset(): void {
    this.dash.active = false;
    this.dash.targetId = null;
  }

  /** 刀刃是否正在飞跃（飞跃期间不响应再次释放） */
  isActive(): boolean {
    return this.dash.active;
  }

  /**
   * 按威胁优先级选择目标：冲刺中的精英 > 最近蟑螂
   * @returns 目标蟑螂；场上无可斩目标时返回 null
   */
  findTarget(roaches: Roach[], playerX: number, defenseLineY: number): Roach | null {
    let chargingElite: Roach | null = null;
    let nearest: Roach | null = null;
    let nearestDist = Infinity;

    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      if (r.isBoss || r.type === RoachType.QUEEN) continue; // Boss 免疫斩击

      if (!chargingElite && r.type === RoachType.SUBWAY_ELITE && r.chargeState === 'charge') {
        chargingElite = r;
        continue;
      }
      const dx = r.x - playerX;
      const dy = r.y - defenseLineY;
      const d = dx * dx + dy * dy;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = r;
      }
    }
    return chargingElite ?? nearest;
  }

  /**
   * 释放斩螂·110：刀刃从防线跃向威胁最高的目标
   * @returns true 表示成功释放；false 表示无目标或正在飞跃
   */
  activate(roaches: Roach[], playerX: number): boolean {
    if (this.dash.active) return false;
    const defenseLineY = this.config.getDefenseLineY();
    const target = this.findTarget(roaches, playerX, defenseLineY);
    if (!target) {
      this.config.onAddFloatingText(playerX, defenseLineY - 60, TEXT_CONFIG.combat.knifeNoTarget.text, TEXT_CONFIG.combat.knifeNoTarget.color);
      return false;
    }

    const duration = BALANCE_CONFIG.subway.knifeDashDuration;
    this.dash = {
      active: true,
      phase: 'out',
      timer: duration,
      duration,
      fromX: playerX,
      fromY: defenseLineY,
      toX: target.x,
      toY: target.y,
      x: playerX,
      y: defenseLineY,
      targetId: target.id,
      angle: Math.atan2(target.y - defenseLineY, target.x - playerX),
    };
    this.config.onPlaySound();
    this.config.onVibrate();
    return true;
  }

  /** 主更新（每帧调用）：推进刀刃飞跃，到达目标时击杀 */
  update(deltaTime: number, roaches: Roach[]): void {
    if (!this.dash.active) return;
    const d = this.dash;
    d.timer -= deltaTime;
    const progress = Math.max(0, Math.min(1, 1 - d.timer / d.duration));

    // 刀刃位置插值（out：防线→目标；back：目标→防线）
    if (d.phase === 'out') {
      d.x = d.fromX + (d.toX - d.fromX) * progress;
      d.y = d.fromY + (d.toY - d.fromY) * progress;
    } else {
      d.x = d.toX + (d.fromX - d.toX) * progress;
      d.y = d.toY + (d.fromY - d.toY) * progress;
    }

    // 飞行拖尾粒子
    if (Math.random() < 0.7) {
      this.config.onAddParticle({
        x: d.x, y: d.y,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        life: 0.25, maxLife: 0.25,
        size: 2 + Math.random() * 3,
        color: 'rgba(226, 232, 240, 0.7)',
        type: ParticleType.SPARK,
      });
    }

    if (d.timer > 0) return;

    if (d.phase === 'out') {
      // 到达目标：击杀（目标可能已提前死亡，则只播放斩击特效）
      const target = roaches.find(r => r.id === d.targetId);
      if (target && target.state === RoachState.ALIVE) {
        this.config.onKillRoach(target);
        this.config.onAddFloatingText(target.x, target.y - 40, TEXT_CONFIG.combat.knifeKill.text, TEXT_CONFIG.combat.knifeKill.color);
      }
      // 斩击弧光粒子
      for (let k = 0; k < 10; k++) {
        const a = d.angle + (Math.random() - 0.5) * 1.6;
        const spd = 120 + Math.random() * 160;
        this.config.onAddParticle({
          x: d.toX, y: d.toY,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
          size: 3 + Math.random() * 3,
          color: 'rgba(248, 250, 252, 0.9)',
          type: ParticleType.SPARK,
        });
      }
      this.config.onScreenShake(5);
      // 进入回程
      d.phase = 'back';
      d.timer = d.duration;
    } else {
      // 回到防线，飞跃结束
      d.active = false;
      d.targetId = null;
    }
  }

  /** 渲染刀刃（飞跃中的刀光 + 到达时的斩击弧） */
  render(ctx: CanvasRenderingContext2D, knifeImg: HTMLImageElement | null): void {
    if (!this.dash.active) return;
    const d = this.dash;
    const size = 40;

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.phase === 'out' ? d.angle : d.angle + Math.PI);

    // 刀光残影（沿飞行方向的渐变拖尾）
    const trail = ctx.createLinearGradient(-size * 1.6, 0, 0, 0);
    trail.addColorStop(0, 'rgba(226, 232, 240, 0)');
    trail.addColorStop(1, 'rgba(226, 232, 240, 0.55)');
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.moveTo(-size * 1.6, -5);
    ctx.lineTo(0, -2);
    ctx.lineTo(0, 2);
    ctx.lineTo(-size * 1.6, 5);
    ctx.closePath();
    ctx.fill();

    // 刀刃本体
    if (knifeImg) {
      ctx.drawImage(knifeImg, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(size * 0.5, 0);
      ctx.lineTo(-size * 0.3, -size * 0.18);
      ctx.lineTo(-size * 0.15, 0);
      ctx.lineTo(-size * 0.3, size * 0.18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
