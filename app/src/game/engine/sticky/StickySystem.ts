/**
 * @fileoverview 粘板/粘液弹系统模块
 * @description 负责管理粘性板（legacy）和粘液弹（auto-targeting）的完整生命周期
 */

import { RoachState, RoachType, ParticleType, type StickyBoard, type StickyDrop, type Roach, type Particle } from '../../types';
import { ENEMY_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/**
 * 粘板/粘液弹系统配置接口
 */
export interface StickySystemConfig {
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 防线Y坐标获取函数 */
  getDefenseLineY: () => number;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 添加粒子回调 */
  onAddParticle?: (particle: Particle) => void;
  /** 生成火花粒子回调 */
  onSpawnSpark?: (x: number, y: number, count: number) => void;
  /** 播放粘液弹音效回调 */
  onPlayStickySpray?: () => void;
  /** 震动回调 */
  onVibrateItemUse?: () => void;
  /** 屏幕震动回调 */
  onScreenShake?: (amount: number) => void;
}

/**
 * 粘板/粘液弹系统类
 * @description
 *   粘板（legacy）：固定位置放置，捕获范围内的蟑螂
 *   粘液弹（auto-targeting）：追踪水滴，击中后包裹蟑螂
 *   两类功能职责相近，后续可考虑拆分为独立模块
 */
export class StickySystem {
  private config: StickySystemConfig;

  /** 粘性板数组（legacy） */
  stickyBoards: StickyBoard[] = [];
  /** 粘液弹数组（auto-targeting） */
  stickyDrops: StickyDrop[] = [];
  /** 下一个粘液弹ID */
  private nextStickyDropId: number = 1;
  /** 下一个粘板ID */
  private nextBoardId: number = 1;

  constructor(config: StickySystemConfig) {
    this.config = config;
  }

  /** 更新配置 */
  updateConfig(newConfig: Partial<StickySystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // ========== 透视缩放（用于粘板渲染和碰撞） ==========
  /** 计算透视缩放：越高（离底部越远）越小 */
  getPerspectiveScale(y: number): number {
    const bottomY = this.config.getDefenseLineY();
    const topY = this.config.canvasHeight * 0.2;
    const t = Math.max(0, Math.min(1, (bottomY - y) / (bottomY - topY)));
    return 0.3 + t * 0.7;
  }

  // ========== 粘液弹喷射（10个追踪水滴） ==========
  /** 激活粘液弹喷射：发射10个追踪水滴 */
  activateStickySpray(): void {
    const cx = this.config.canvasWidth / 2;
    const cy = this.config.getDefenseLineY();
    const cfg = BALANCE_CONFIG.sticky;

    for (let i = 0; i < cfg.dropCount; i++) {
      const delay = i * cfg.fireInterval;
      this.scheduleStickyDrop(cx, cy, delay);
    }

    this.config.onPlayStickySpray?.();
    this.config.onVibrateItemUse?.();
    this.config.onAddFloatingText?.(cx, cy - 60, TEXT_CONFIG.combat.stickyLaunch.text, TEXT_CONFIG.combat.stickyLaunch.color);
    this.config.onAddFloatingText?.(cx, cy - 40, TEXT_CONFIG.combat.stickyTracking.text(BALANCE_CONFIG.sticky.dropCount), TEXT_CONFIG.combat.stickyTracking.color);
    this.config.onScreenShake?.(BALANCE_CONFIG.screenShake.smallExplosion);
  }

  /** 调度一个延迟激活的粘液弹 */
  private scheduleStickyDrop(cx: number, cy: number, delay: number): void {
    const cfg = BALANCE_CONFIG.sticky;
    this.stickyDrops.push({
      id: this.nextStickyDropId++,
      x: cx,
      y: cy,
      vx: 0,
      vy: -(cfg.dropInitialVy + Math.random() * cfg.dropInitialVyRandom),
      targetId: null,
      speed: cfg.dropSpeed + Math.random() * cfg.dropSpeedRandom,
      life: delay + cfg.dropMaxLife,
      maxLife: cfg.dropMaxLife,
      size: cfg.dropSize + Math.random() * cfg.dropSizeRandom,
      hit: false,
    });
  }

  // ========== 粘液弹更新 ==========
  /** 更新粘液弹（含追踪、碰撞、伤害、过期清理） */
  updateStickyDrops(deltaTime: number, gameTime: number, roaches: Roach[]): void {
    for (let i = this.stickyDrops.length - 1; i >= 0; i--) {
      const drop = this.stickyDrops[i];
      drop.life -= deltaTime;

      // 预生成阶段（延迟 > 剩余生命 > maxLife）
      if (drop.life > drop.maxLife) {
        drop.y += Math.sin(gameTime * 10 + drop.id) * 0.5;
        continue;
      }

      // 弹丸过期
      if (drop.life <= 0) {
        this.cleanupExpiredDrop(drop, i, roaches);
        continue;
      }

      // 已击中蟑螂，保持粘附
      if (drop.hit && drop.targetId !== null) {
        this.updateAttachedDrop(drop, i, deltaTime, roaches);
        continue;
      }

      // 飞行阶段 - 追踪最近的未包裹蟑螂
      this.updateFlyingDrop(drop, i, deltaTime, gameTime, roaches);
    }
  }

  /** 清理过期的粘液弹并恢复目标蟑螂状态 */
  private cleanupExpiredDrop(drop: StickyDrop, index: number, roaches: Roach[]): void {
    if (drop.targetId !== null) {
      const r = roaches.find(r => r.id === drop.targetId);
      if (r && r.state === RoachState.ALIVE) {
        r.wrappedByDropId = null;
        r.wrapTimer = 0;
        r.speed = r.baseSpeed;
      }
    }
    this.stickyDrops.splice(index, 1);
  }

  /** 更新已附着在蟑螂上的粘液弹 */
  private updateAttachedDrop(drop: StickyDrop, index: number, deltaTime: number, roaches: Roach[]): void {
    const target = roaches.find(r => r.id === drop.targetId);
    if (!target || target.state !== RoachState.ALIVE) {
      // 目标已死亡或消失，清理残留
      if (target) {
        target.wrappedByDropId = null;
        target.wrapTimer = 0;
      }
      this.stickyDrops.splice(index, 1);
      return;
    }

    // Boss 免疫：立即移除
    if (target.isBoss) {
      this.stickyDrops.splice(index, 1);
      return;
    }

    drop.x = target.x;
    drop.y = target.y;
    target.vx = 0;
    target.vy = 0;
    target.speed = 0;
    target.wrappedByDropId = drop.id;
    target.wrapTimer = drop.life;

    // 周期性伤害（无护甲且不在放置炸弹时）
    const isTimedPlacing = target.type === RoachType.TIMED_SUICIDE && target.placeTimer && target.placeTimer > 0;
    if (Math.random() < deltaTime * 2 && !isTimedPlacing) {
      if (target.armorHp > 0) {
        if (Math.random() < 0.1) {
          this.config.onAddFloatingText?.(target.x, target.y - 15, TEXT_CONFIG.combat.armorImmune.text, TEXT_CONFIG.combat.armorImmune.color);
        }
      } else {
        target.hp -= BALANCE_CONFIG.sticky.damagePerTick;
        target.damageFlash = BALANCE_CONFIG.sticky.damageFlash;
      }
    }

    // 黄色粒子
    if (Math.random() < 0.1) {
      this.config.onAddParticle?.({
        x: target.x + (Math.random() - 0.5) * 20,
        y: target.y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 20,
        life: 0.3, maxLife: 0.3,
        size: 2 + Math.random() * 3,
        color: `rgba(250, 200, 50, ${0.5 + Math.random() * 0.3})`,
        type: ParticleType.ICE,
      });
    }
  }

  /** 更新飞行中的粘液弹（追踪目标） */
  private updateFlyingDrop(drop: StickyDrop, index: number, deltaTime: number, gameTime: number, roaches: Roach[]): void {
    const cfg = BALANCE_CONFIG.sticky;

    // 寻找最近的未包裹蟑螂
    let target: Roach | null = null;
    let minDist = Infinity;
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      if (r.wrappedByDropId !== null) continue;
      const dx = r.x - drop.x;
      const dy = r.y - drop.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist && d < cfg.trackRange) {
        minDist = d;
        target = r;
      }
    }

    if (target) {
      // 追踪行为（平滑转向）
      const dx = target.x - drop.x;
      const dy = target.y - drop.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) {
        const targetVx = (dx / d) * drop.speed;
        const targetVy = (dy / d) * drop.speed;
        drop.vx += (targetVx - drop.vx) * cfg.trackSteerFactor * deltaTime;
        drop.vy += (targetVy - drop.vy) * cfg.trackSteerFactor * deltaTime;
      }
      drop.targetId = target.id;

      // 碰撞检测
      const targetSize = (target.size ?? ENEMY_DEFS[target.type]?.size ?? 30) * this.getPerspectiveScale(target.y);
      if (d < targetSize * 0.5 + drop.size) {
        // Boss 被击中：立即移除粘液弹
        if (target.isBoss) {
          this.stickyDrops.splice(index, 1);
          return;
        }
        // 普通蟑螂：附着
        drop.hit = true;
        drop.life = cfg.dropLife;
        drop.x = target.x;
        drop.y = target.y;
        target.wrappedByDropId = drop.id;
        target.wrapTimer = cfg.wrapTimer;
        target.speed = 0;
        target.vx = 0;
        target.vy = 0;
        this.config.onAddFloatingText?.(target.x, target.y - 20, TEXT_CONFIG.combat.stickyCapture.text(BALANCE_CONFIG.sticky.wrapTimer), TEXT_CONFIG.combat.stickyCapture.color);

        // 击中粒子
        for (let p = 0; p < cfg.hitParticleCount; p++) {
          this.config.onAddParticle?.({
            x: target.x + (Math.random() - 0.5) * 15,
            y: target.y + (Math.random() - 0.5) * 15,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            life: 0.3, maxLife: 0.3,
            size: 2 + Math.random() * 4,
            color: `rgba(250, 220, 50, ${0.6 + Math.random() * 0.4})`,
            type: ParticleType.ICE,
          });
        }
      }
    } else {
      // 无目标，向上飞行并微弯
      drop.vy -= 20 * deltaTime;
      drop.vx += Math.sin(gameTime * 3 + drop.id) * 30 * deltaTime;
    }

    // 移动弹丸
    drop.x += drop.vx * deltaTime;
    drop.y += drop.vy * deltaTime;

    // 边界检查
    if (drop.y < -50 || drop.y > this.config.canvasHeight + 50 || drop.x < -50 || drop.x > this.config.canvasWidth + 50) {
      this.stickyDrops.splice(index, 1);
    }
  }

  // ========== 粘性板（legacy） ==========
  /** 应用粘性板效果（在指定位置放置粘板） */
  applyStickyBoardEffect(x: number, y: number): void {
    const cfg = BALANCE_CONFIG.sticky;
    const scale = this.getPerspectiveScale(y);

    this.stickyBoards.push({
      id: this.nextBoardId++,
      x, y,
      width: Math.round(cfg.boardBaseW * scale),
      height: Math.round(cfg.boardBaseH * scale),
      hitWidth: cfg.boardBaseW,
      hitHeight: cfg.boardBaseH,
      life: cfg.boardLife,
      maxLife: cfg.boardLife,
      stuckRoaches: [],
      maxStuck: cfg.boardMaxStuck,
    });

    this.config.onSpawnSpark?.(x, y, 4);
    this.config.onAddFloatingText?.(x, y - 30, TEXT_CONFIG.combat.stickyBoard.text, TEXT_CONFIG.combat.stickyBoard.color);
  }

  /** 更新粘性板（含生命周期和蟑螂捕获） */
  updateStickyBoards(deltaTime: number, roaches: Roach[]): void {
    for (let i = this.stickyBoards.length - 1; i >= 0; i--) {
      const board = this.stickyBoards[i];
      board.life -= deltaTime;

      if (board.life <= 0) {
        // 释放被粘蟑螂
        for (const roachId of board.stuckRoaches) {
          const r = roaches.find(r => r.id === roachId);
          if (r && r.state === RoachState.ALIVE) {
            r.speed = r.baseSpeed;
          }
        }
        this.stickyBoards.splice(i, 1);
        continue;
      }

      this.updateBoardCapture(board, roaches);
    }
  }

  /** 更新粘板对蟑螂的捕获逻辑 */
  private updateBoardCapture(board: StickyBoard, roaches: Roach[]): void {
    const hitHalfW = board.hitWidth / 2;
    const hitHalfH = board.hitHeight / 2;
    const edgeMargin = 10;

    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      if (board.stuckRoaches.includes(r.id)) {
        // 已捕获：限制在板内
        r.x = Math.max(board.x - hitHalfW + edgeMargin, Math.min(board.x + hitHalfW - edgeMargin, r.x));
        r.y = Math.max(board.y - hitHalfH + edgeMargin, Math.min(board.y + hitHalfH - edgeMargin, r.y));
        r.vx = 0;
        r.vy = 0;
        r.speed = 0;
        continue;
      }
      if (board.stuckRoaches.length >= board.maxStuck) continue;
      if (r.x > board.x - hitHalfW && r.x < board.x + hitHalfW &&
          r.y > board.y - hitHalfH && r.y < board.y + hitHalfH) {
        board.stuckRoaches.push(r.id);
        r.speed = 0;
        r.vx = 0;
        r.vy = 0;
        if (board.stuckRoaches.length === 1) {
          this.config.onAddFloatingText?.(r.x, r.y - 20, TEXT_CONFIG.combat.stickyStuck.text, TEXT_CONFIG.combat.stickyStuck.color);
        }
      }
    }
  }

  // ========== 查询方法 ==========
  /**
   * 检查蟑螂是否被粘板或粘液弹困住
   * @param roachId 蟑螂ID
   * @returns 是否被困住
   */
  isStuckByBoard(roachId: number): boolean {
    // 粘板检查
    if (this.stickyBoards.some(b => b.stuckRoaches.includes(roachId))) return true;
    // 粘液弹检查：通过系统内部状态判断，不依赖外部 roaches 数组
    return this.stickyDrops.some(d => d.targetId === roachId && d.hit);
  }

  /** 清理蟑螂死亡时的粘液弹包裹 */
  cleanupRoachDeath(roach: Roach): void {
    if (roach.wrappedByDropId !== null) {
      const dropIdx = this.stickyDrops.findIndex(d => d.id === roach.wrappedByDropId);
      if (dropIdx >= 0) {
        this.stickyDrops.splice(dropIdx, 1);
      }
      roach.wrappedByDropId = null;
      roach.wrapTimer = 0;
    }
  }

  /** 重置系统 */
  reset(): void {
    this.stickyBoards = [];
    this.stickyDrops = [];
    this.nextStickyDropId = 1;
    this.nextBoardId = 1;
  }
}