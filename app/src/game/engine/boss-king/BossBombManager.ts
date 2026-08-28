/**
 * @fileoverview 蟑老大炸弹管理器
 * @description 管理 Boss 投掷炸弹的抛物线飞行、落点标记、火枪引爆判定、
 * 空中引爆（反伤 Boss + 波及小怪）与漏弹（防线伤害 + 屏幕汁液喷溅）。
 * 锁定设计（2026-08-24）：
 * - 飞行 2.4s，末 35% 时间 ease-out 减速至 40%
 * - 自动爆炸点 = defenseLineY - burstOffsetFromDefense（禁止写死 Y 坐标）
 * - 引爆判定半径 40px，三重火焰侧焰同效
 * - 空爆：Boss -200，半径 120px 飞行小怪秒杀 / 地面小怪 50 伤害
 * - 漏弹：防线 -30，屏幕喷溅 2~3 块汁液（3 秒 = 2.5s 存在 + 0.5s 渐隐）
 */

import { BALANCE_CONFIG } from '../../data';
import { RoachType, RoachState } from '../../types';
import type { Roach } from '../../types';
import type { BossBomb, GooSplat } from './types';

/** 火焰命中检测所需的最小玩家状态 */
export interface BombFlameCheckPlayer {
  x: number;
  y: number;
  isFiring: boolean;
  isOverheated: boolean;
  isReloading: boolean;
  gas: number;
  fireRange: number;
}

/** 三重火焰状态（来自 TripleFlameSystem） */
export interface BombTripleFlameState {
  active: boolean;
  sideOffset: number;
}

/** 炸弹爆炸效果回调（由 BossKingSystem 转发 engine） */
export interface BossBombEffectCallbacks {
  /** 空中引爆：反伤 Boss */
  onDamageBoss: (damage: number) => void;
  /** 对蟑螂造成伤害（空爆波及） */
  onDamageRoach: (roach: Roach, damage: number) => void;
  /** 漏弹：防线扣血 */
  onDamageDefense: (damage: number) => void;
  /** 爆炸粒子 */
  onSpawnExplosionParticles: (x: number, y: number, count: number) => void;
  /** 冲击波环 */
  onSpawnShockwaveRing: (x: number, y: number, radius: number) => void;
  /** 屏幕震动 */
  onScreenShake: (intensity: number) => void;
  /** 浮动文字 */
  onAddFloatingText: (x: number, y: number, text: string, color: string) => void;
  /** 播放空中引爆音效 */
  onPlayAirburst: () => void;
  /** 播放漏弹爆炸音效 */
  onPlayGroundBurst: () => void;
  /** 播放汁液溅屏音效 */
  onPlayGooSplat: () => void;
  /** 炸弹全部销毁时调用（用于导演门控恢复计时） */
  onAllBombsGone: () => void;
}

/**
 * 蟑老大炸弹管理器
 */
export class BossBombManager {
  /** 飞行中的炸弹 */
  bombs: BossBomb[] = [];
  /** 屏幕汁液 */
  goos: GooSplat[] = [];

  private nextBombId = 1;
  private cb: BossBombEffectCallbacks;

  constructor(callbacks: BossBombEffectCallbacks) {
    this.cb = callbacks;
  }

  /** 重置（战斗开始/重开时调用） */
  reset(): void {
    this.bombs = [];
    this.goos = [];
  }

  /**
   * 投掷炸弹（三阶段双发时调用两次，落点左右错开）
   * @param bossX Boss 当前 X
   * @param bossY Boss 当前 Y
   * @param targetX 落点 X（防线附近）
   * @param burstY 自动爆炸点 Y（= defenseLineY - burstOffsetFromDefense）
   */
  spawnBomb(bossX: number, bossY: number, targetX: number, burstY: number): void {
    this.bombs.push({
      id: this.nextBombId++,
      x0: bossX,
      y0: bossY,
      x1: targetX,
      y1: burstY,
      x: bossX,
      y: bossY,
      elapsed: 0,
      dead: false,
    });
  }

  /**
   * 抛物线进度映射：末段减速
   * 前 (1-tailTimeRatio) 时间匀速覆盖大部分路程，末段按 tailSpeedMult 减速
   * @param t 归一化时间 0~1
   * @returns 归一化路程 0~1
   */
  private easedProgress(t: number): number {
    const cfg = BALANCE_CONFIG.bossKing.bomb;
    const tailT = cfg.tailTimeRatio;
    const headT = 1 - tailT;
    const v = cfg.tailSpeedMult;
    // 由 progress(1)=1 反推头段速率：s1 = 1 / (headT + v * tailT)
    const s1 = 1 / (headT + v * tailT);
    if (t <= headT) return s1 * t;
    return s1 * headT + s1 * v * (t - headT);
  }

  /**
   * 更新炸弹飞行与汁液生命周期
   * @param deltaTime 帧间隔（秒）
   * @param roaches 场上蟑螂（空爆波及结算）
   */
  update(deltaTime: number, roaches: Roach[]): void {
    const cfg = BALANCE_CONFIG.bossKing.bomb;

    // ===== 炸弹飞行 =====
    for (const bomb of this.bombs) {
      if (bomb.dead) continue;
      bomb.elapsed += deltaTime;
      const t = Math.min(1, bomb.elapsed / cfg.flightSec);
      const p = this.easedProgress(t);
      // 水平线性，垂直抛物线（向上拱 arcHeight）
      bomb.x = bomb.x0 + (bomb.x1 - bomb.x0) * p;
      bomb.y = bomb.y0 + (bomb.y1 - bomb.y0) * p - cfg.arcHeight * 4 * p * (1 - p);
      // 到达自动爆炸点 → 漏弹爆炸
      if (t >= 1) {
        this.explodeBomb(bomb, false, roaches);
      }
    }
    if (this.bombs.some(b => b.dead)) {
      this.bombs = this.bombs.filter(b => !b.dead);
      if (this.bombs.length === 0) this.cb.onAllBombsGone();
    }

    // ===== 汁液生命周期 =====
    for (const goo of this.goos) {
      goo.life -= deltaTime;
    }
    this.goos = this.goos.filter(g => g.life > 0);
  }

  /**
   * 火枪命中检测（每帧在火焰碰撞结算后调用）
   * 判定：炸弹处于火焰束内（|dx| < hitRadius 且竖直方向在射程内），三重火焰侧焰同效
   * @param player 玩家火焰状态
   * @param tripleFlame 三重火焰状态（可选）
   * @param roaches 场上蟑螂（空爆波及结算）
   * @param nozzleOffsetY 喷嘴 Y 偏移
   */
  checkFlameHits(
    player: BombFlameCheckPlayer,
    tripleFlame: BombTripleFlameState | undefined,
    roaches: Roach[],
    nozzleOffsetY: number
  ): void {
    if (this.bombs.length === 0) return;
    if (!player.isFiring || player.isOverheated || player.isReloading || player.gas <= 0) return;

    const colCfg = BALANCE_CONFIG.collision;
    const cfg = BALANCE_CONFIG.bossKing.bomb;
    const nozzleY = player.y - nozzleOffsetY;
    const maxRange = player.fireRange * colCfg.flameRangeRatio;

    // 构建枪束列表（支持三重火焰）
    const gunXs: number[] = [player.x];
    if (tripleFlame?.active) {
      gunXs.push(player.x - tripleFlame.sideOffset);
      gunXs.push(player.x + tripleFlame.sideOffset);
    }

    for (const bomb of this.bombs) {
      if (bomb.dead) continue;
      for (const gx of gunXs) {
        const vertDist = nozzleY - bomb.y;
        if (Math.abs(bomb.x - gx) < cfg.hitRadius && vertDist > 0 && vertDist < maxRange) {
          // 火枪引爆 → 空中提前爆炸（偏袒玩家原则：与自爆同帧时优先判定引爆）
          this.explodeBomb(bomb, true, roaches);
          break;
        }
      }
    }
    if (this.bombs.some(b => b.dead)) {
      this.bombs = this.bombs.filter(b => !b.dead);
      if (this.bombs.length === 0) this.cb.onAllBombsGone();
    }
  }

  /**
   * 炸弹爆炸统一结算
   * @param bomb 炸弹
   * @param byPlayer 是否玩家火枪引爆（true=空中引爆反伤 Boss；false=漏弹伤防线+喷汁液）
   * @param roaches 场上蟑螂
   */
  private explodeBomb(bomb: BossBomb, byPlayer: boolean, roaches: Roach[]): void {
    if (bomb.dead) return;
    bomb.dead = true;
    const cfg = BALANCE_CONFIG.bossKing.bomb;

    // 通用爆炸特效
    this.cb.onSpawnExplosionParticles(bomb.x, bomb.y, 40);
    this.cb.onSpawnShockwaveRing(bomb.x, bomb.y, cfg.aoeRadius);
    this.cb.onScreenShake(BALANCE_CONFIG.screenShake.largeExplosion);

    if (byPlayer) {
      // ===== 空中引爆：反伤 Boss + 波及小怪 =====
      this.cb.onDamageBoss(cfg.counterDamage);
      this.cb.onPlayAirburst();
      for (const r of roaches) {
        if (r.state !== RoachState.ALIVE || r.isBoss) continue;
        const dx = r.x - bomb.x;
        const dy = r.y - bomb.y;
        if (dx * dx + dy * dy > cfg.aoeRadius * cfg.aoeRadius) continue;
        if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE || r.type === RoachType.SUBWAY_ELITE) {
          // 飞行小怪半径内秒杀
          this.cb.onDamageRoach(r, 99999);
        } else {
          this.cb.onDamageRoach(r, cfg.aoeGroundDamage);
        }
      }
      this.cb.onAddFloatingText(bomb.x, bomb.y - 30, `-${cfg.counterDamage}`, '#ff6b4a');
    } else {
      // ===== 漏弹：防线伤害 + 屏幕汁液喷溅 =====
      this.cb.onDamageDefense(cfg.defenseDamage);
      this.cb.onPlayGroundBurst();
      this.cb.onPlayGooSplat();
      this.spawnGoos();
      this.cb.onAddFloatingText(bomb.x, bomb.y - 30, `防线 -${cfg.defenseDamage}`, '#ff4444');
    }
  }

  /**
   * 生成屏幕汁液（2~3 块，屏幕任意区域，含 Y 方向任意位置——模拟溅射到"镜头"上）
   */
  private spawnGoos(): void {
    const gooCfg = BALANCE_CONFIG.bossKing.goo;
    const count = gooCfg.countMin + Math.floor(Math.random() * (gooCfg.countMax - gooCfg.countMin + 1));
    for (let i = 0; i < count; i++) {
      const radius = gooCfg.radiusMin + Math.random() * (gooCfg.radiusMax - gooCfg.radiusMin);
      this.goos.push({
        // 屏幕任意区域（540 逻辑宽 × 动态高，渲染层按画布尺寸 clamp）
        x: Math.random(),
        y: Math.random(),
        radius,
        seed: Math.random() * 1000,
        life: gooCfg.liveSec + gooCfg.fadeSec,
        maxLife: gooCfg.liveSec + gooCfg.fadeSec,
      });
    }
  }

  /** 是否有飞行中的炸弹（导演门控用） */
  hasFlyingBombs(): boolean {
    return this.bombs.length > 0;
  }

  /** 获取只读炸弹列表（渲染用） */
  getBombs(): readonly BossBomb[] {
    return this.bombs;
  }

  /** 获取只读汁液列表（渲染用） */
  getGoos(): readonly GooSplat[] {
    return this.goos;
  }
}
