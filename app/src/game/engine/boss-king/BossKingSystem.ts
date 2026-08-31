/**
 * @fileoverview 蟑老大 Boss 战核心系统
 * @description 巢穴终局 Boss 战（2026-08-24 锁定设计，替换巢穴现有波次内容，仅 Easy）：
 * - Boss 200px，全程空中飞行巡逻（X:50~490），HP 3000，免疫一切火焰/控制
 * - 玩家无法直接攻击；唯一输出 = 火枪引爆其投掷的炸弹反伤 200/发
 * - 技能 AI（按战场态势决策，CD 按血量阶段 8/6/4s，每 3 个技能后额外休整）：
 *   A. 场上小怪被控制/减益 ≥ 阈值 → 净化；B. 场上小怪数量 ≥ 阈值 → 吹风推动；C. 战场被清空（或均不满足）→ 投弹
 * - 胜利：HP 归零后退场动画（转身 0.35s + 透视缩小远去 2.0s，渐隐）→ 通关结算
 * - 失败：防线 HP 归零
 */

import { BALANCE_CONFIG } from '../../data';
import { RoachState, RoachType } from '../../types';
import type { Roach, Player } from '../../types';
import { BossBombManager } from './BossBombManager';
import {
  BossKingSkill,
  createBossKingState,
  type BossKingBattleState,
  type BossKingPhase,
} from './types';

/** 蟑老大音效接口（audio.ts 合成音效，无音频文件） */
export interface BossKingAudio {
  playBossKingWarn: () => void;      // 投弹红光预警
  playBossKingThrow: () => void;     // 投弹出手
  playBossKingAirburst: () => void;  // 空中引爆
  playBossKingGroundBurst: () => void; // 漏弹爆炸
  playBossKingGooSplat: () => void;  // 汁液溅屏
  playBossKingWind: () => void;      // 吹风
  playBossKingPurge: () => void;     // 净化金光
}

/** 三重火焰最小状态 */
export interface BossKingTripleFlame {
  active: boolean;
  sideOffset: number;
}

/** 每帧同步的快照配置 */
export interface BossKingFrameConfig {
  width: number;
  height: number;
  deltaTime: number;
  time: number;
  defenseHp: number;
  defenseLineY: number;
  player: Player;
  tripleFlame?: BossKingTripleFlame;
}

/** 蟑老大回调（engine 注入） */
export interface BossKingCallbacks {
  onAddFloatingText: (x: number, y: number, text: string, color: string) => void;
  onSpawnExplosionParticles: (x: number, y: number, count: number) => void;
  onSpawnShockwaveRing: (x: number, y: number, radius: number) => void;
  onScreenShake: (intensity: number) => void;
  onDamageRoach: (roach: Roach, damage: number) => void;
  onSpawnRoach: (type: RoachType) => void;
  onGetRoaches: () => Roach[];
  onDamageDefense: (damage: number) => void;
  onVictory: () => void;
  onDefeat: () => void;
  /** 入场动画完成（engine 接线：此时才生成第 1 波，Boss 入场先于战斗波次） */
  onEntranceComplete: () => void;
}

/**
 * 蟑老大 Boss 战系统
 */
export class BossKingSystem {
  /** 战斗状态 */
  state: BossKingBattleState = createBossKingState();
  /** 炸弹管理器 */
  readonly bombs: BossBombManager;

  private frame: BossKingFrameConfig | null = null;
  private cb: BossKingCallbacks;
  private audio: BossKingAudio;
  private defeatFired = false;
  /** 连发炸弹延迟出手队列（2026-08-27：双发/三连发错开 burstStaggerSec 秒） */
  private pendingBombThrows: Array<{ x0: number; y0: number; x1: number; y1: number; delay: number }> = [];
  /** 吹风诊断：上一帧是否处于吹风中（用于结束沿打点） */
  private windWasActive = false;
  /** 吹风诊断：本帧被加速的小怪数量 */
  private windBoostedThisFrame = 0;
  /** 净化诊断：当前仍处无敌帧的小怪数量（用于失效沿打点） */
  private purgeImmuneActiveCount = 0;

  constructor(callbacks: BossKingCallbacks, audio: BossKingAudio) {
    this.cb = callbacks;
    this.audio = audio;
    this.bombs = new BossBombManager({
      onDamageBoss: (dmg) => this.damageBoss(dmg),
      onDamageRoach: (r, dmg) => this.cb.onDamageRoach(r, dmg),
      onDamageDefense: (dmg) => this.cb.onDamageDefense(dmg),
      onSpawnExplosionParticles: (x, y, c) => this.cb.onSpawnExplosionParticles(x, y, c),
      onSpawnShockwaveRing: (x, y, r) => this.cb.onSpawnShockwaveRing(x, y, r),
      onScreenShake: (i) => this.cb.onScreenShake(i),
      onAddFloatingText: (x, y, t, c) => this.cb.onAddFloatingText(x, y, t, c),
      onPlayAirburst: () => this.audio.playBossKingAirburst(),
      onPlayGroundBurst: () => this.audio.playBossKingGroundBurst(),
      onPlayGooSplat: () => this.audio.playBossKingGooSplat(),
      // 炸弹全部销毁（波次系统接管出怪后无导演门控，保留钩子备用）
      onAllBombsGone: () => {},
    });
  }

  /** 每帧同步快照（update 前调用） */
  updateConfig(frame: BossKingFrameConfig): void {
    this.frame = frame;
  }

  /** 重置（非巢穴场景防泄漏） */
  reset(): void {
    this.state = createBossKingState();
    this.bombs.reset();
    this.defeatFired = false;
    this.pendingBombThrows = [];
    this.windWasActive = false;
    this.windBoostedThisFrame = 0;
    this.purgeImmuneActiveCount = 0;
  }

  /** 开始 Boss 战（巢穴场景 resetGame 后调用）：先入场动画 → 完成后回调启动波次 */
  startBattle(): void {
    this.reset();
    const cfg = BALANCE_CONFIG.bossKing;
    const s = this.state;
    s.active = true;
    s.boss.hp = cfg.hp;
    s.boss.maxHp = cfg.hp;
    s.boss.x = (this.frame?.width ?? 540) / 2;
    s.boss.y = (this.frame?.height ?? 960) * cfg.hoverYRatio;
    // 入场序列：从洞穴深处飞向悬浮位（位置/缩放/透明度变换由渲染层按 enterTimer 进度计算）
    s.enterStage = 'flying';
    s.enterTimer = cfg.enter.flySec;
    s.enterTargetX = s.boss.x;
    s.enterTargetY = s.boss.y;
    s.boss.animAction = 'enter';
    s.boss.animTimer = 0;
    this.cb.onAddFloatingText(s.boss.x, s.boss.y + 120, '蟑老大现身！', '#ff6b4a');
    this.cb.onScreenShake(BALANCE_CONFIG.screenShake.bossDeath);
  }

  /** 是否战斗中（engine 编排判断用） */
  isActive(): boolean {
    return this.state.active;
  }

  /** Boss 受击（仅炸弹反伤一条路径，火焰/道具对本 Boss 无效） */
  damageBoss(damage: number): void {
    const s = this.state;
    if (!s.active || s.exitStage !== 'none') return;
    s.boss.hp = Math.max(0, s.boss.hp - damage);
    s.boss.damageFlash = 0.15;
  }

  /** 主更新 */
  update(): void {
    const s = this.state;
    const f = this.frame;
    if (!s.active || !f) return;
    const cfg = BALANCE_CONFIG.bossKing;
    const dt = f.deltaTime;
    const roaches = this.cb.onGetRoaches();

    // ===== 动画计时（渲染层按 timer×fps 取帧） =====
    s.boss.animTimer += dt;
    if (s.boss.damageFlash > 0) s.boss.damageFlash -= dt;

    // ===== 入场序列（从洞穴深处飞向悬浮位；期间不巡逻/不放技能/不投弹） =====
    if (s.enterStage === 'flying') {
      s.enterTimer -= dt;
      if (s.enterTimer <= 0) {
        s.enterStage = 'done';
        s.boss.x = s.enterTargetX;
        s.boss.y = s.enterTargetY;
        s.boss.animAction = 'hover';
        s.boss.animTimer = 0;
        s.introTimer = cfg.introSec;
        this.cb.onScreenShake(BALANCE_CONFIG.screenShake.largeExplosion);
        this.cb.onEntranceComplete(); // engine 接线：生成第 1 波，战斗波次开始
      }
      // 入场期间仅推进动画计时（悬停浮动由渲染层的插值路径体现）
      return;
    }

    // ===== 退场序列（转身 → 透视缩小飞向洞穴深处 → 结算） =====
    if (s.exitStage !== 'none') {
      this.updateExit(dt);
      return;
    }

    // ===== 失败判定 =====
    if (f.defenseHp <= 0 && !this.defeatFired) {
      this.defeatFired = true;
      this.cb.onDefeat();
      return;
    }

    // ===== 胜利判定 → 进入退场 =====
    if (s.boss.hp <= 0) {
      this.startExit();
      return;
    }

    // ===== 空中巡逻（横向正弦 + 垂直浮动；全程飞行姿态） =====
    const prevX = s.boss.x;
    const center = (cfg.patrolXMin + cfg.patrolXMax) / 2;
    const ampX = (cfg.patrolXMax - cfg.patrolXMin) / 2;
    s.boss.x = center + Math.sin(f.time * cfg.patrolSpeed) * ampX;
    s.boss.y = f.height * cfg.hoverYRatio + Math.sin(f.time * cfg.hoverYFreq) * f.height * cfg.hoverYAmpRatio;
    if (Math.abs(s.boss.x - prevX) > 0.01) s.boss.facingRight = s.boss.x > prevX;

    // ===== 血量阶段驱动 =====
    const hpRatio = s.boss.hp / s.boss.maxHp;
    const newPhase: BossKingPhase = hpRatio <= cfg.phase3HpRatio ? 3 : hpRatio <= cfg.phase2HpRatio ? 2 : 1;
    if (newPhase !== s.phase) {
      s.phase = newPhase;
      this.cb.onAddFloatingText(
        s.boss.x, s.boss.y + 140,
        newPhase === 2 ? '蟑老大加快了攻势！' : '蟑老大孤注一掷！',
        '#ffaa00'
      );
      this.cb.onScreenShake(BALANCE_CONFIG.screenShake.largeExplosion);
    }

    // ===== 净化无敌帧衰减 =====
    let immuneActive = 0;
    for (const r of roaches) {
      if (r.purgeImmuneTimer && r.purgeImmuneTimer > 0) {
        r.purgeImmuneTimer -= dt;
        if (r.purgeImmuneTimer > 0) immuneActive++;
      }
    }
    if (this.purgeImmuneActiveCount > 0 && immuneActive === 0) {
      console.info(`[BossKing] 净化无敌帧失效: 全部 ${this.purgeImmuneActiveCount} 只小怪恢复可受击`);
    }
    this.purgeImmuneActiveCount = immuneActive;

    // ===== 吹风持续效果（地面小怪加速 + 向防线推力，风扇抵消 60% 推力） =====
    if (s.windTimer > 0) {
      s.windTimer -= dt;
      const push = cfg.wind.pushPxPerSec * dt;
      let boosted = 0;
      let fanResisted = 0;
      for (const r of roaches) {
        if (r.state !== RoachState.ALIVE || r.isBoss) continue;
        if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE || r.type === RoachType.SUBWAY_ELITE) continue;
        r.windBoostTimer = 0.15; // 每帧刷新，吹风结束自然失效
        boosted++;
        const fanResist = r.fanSlowTimer > 0 ? (1 - cfg.wind.fanPushResist) : 1;
        if (fanResist < 1) fanResisted++;
        r.y += push * fanResist;
      }
      this.windBoostedThisFrame = boosted;
      if (!this.windWasActive) {
        console.info(`[BossKing] 吹风生效: duration=${cfg.wind.durationSec}s speedMult=${cfg.wind.speedMult} push=${cfg.wind.pushPxPerSec}px/s, 首帧加速 ${boosted} 只, 风扇抵抗 ${fanResisted} 只`);
      }
      this.windWasActive = true;
      if (s.windTimer <= 0) {
        console.info(`[BossKing] 吹风结束: 末帧加速 ${this.windBoostedThisFrame} 只（windBoostTimer 0.15s 后自然失效）`);
        this.windWasActive = false;
      }
    }

    // ===== 开场亮相 =====
    if (s.introTimer > 0) {
      s.introTimer -= dt;
      if (s.introTimer <= 0) s.skillTimer = 1.0; // 亮相后 1s 开始首个技能
    } else {
      // ===== 技能状态机（战场态势 AI 决策） =====
      this.updateSkillMachine(dt);
    }

    // ===== 炸弹 =====
    this.updatePendingBombThrows(dt);
    this.bombs.update(dt, roaches);

    // ===== 动画动作选择 =====
    this.updateAnimAction();
  }

  /**
   * 技能 AI：按战场态势选择下一个技能（优先级 净化 > 吹风 > 投弹）
   * A. 被【道具控制】的小怪 ≥ purgeMinControlled → 净化解控
   *    （2026-08-27：仅道具控制触发净化——眩晕/粘住/包裹/中毒/风扇减速/须须干扰/致盲；
   *     火焰武器的燃烧属于玩家常态输出，不再计入，避免净化被常态触发）
   * B. 场上存活小怪 ≥ windMinRoaches → 吹风推动压防线
   * C. 战场被清空（或 A/B 均不满足）→ 投弹（玩家唯一反伤手段，默认兜底）
   */
  private pickSkill(): BossKingSkill {
    const cfg = BALANCE_CONFIG.bossKing;
    let alive = 0, controlled = 0;
    for (const r of this.cb.onGetRoaches()) {
      if (r.state === RoachState.DEAD || r.isBoss) continue;
      alive++;
      if (
        r.stunTimer > 0 || r.isStunned || // 电蚊拍眩晕
        r.stuckTimer > 0 || r.wrapTimer > 0 || // 粘鼠板粘住 / 包裹
        r.poisonTimer > 0 || // 中毒
        r.fanSlowTimer > 0 || // 风扇减速
        (r.confuseTimer ?? 0) > 0 || (r.jamTimer ?? 0) > 0 || (r.blindTimer ?? 0) > 0 // 须须干扰 / 干扰 / 致盲
      ) controlled++;
    }
    let skill: BossKingSkill;
    if (controlled >= cfg.ai.purgeMinControlled) skill = BossKingSkill.PURGE;
    else if (alive >= cfg.ai.windMinRoaches) skill = BossKingSkill.WIND;
    else skill = BossKingSkill.BOMB;
    console.info(`[BossKing] AI决策: 场上 ${alive} 只（道具控制 ${controlled}，阈值 净化≥${cfg.ai.purgeMinControlled}/吹风≥${cfg.ai.windMinRoaches}）→ ${skill}`);
    return skill;
  }

  /** 技能状态机 */
  private updateSkillMachine(dt: number): void {
    const s = this.state;
    const cfg = BALANCE_CONFIG.bossKing;

    if (s.skillState === 'idle') {
      s.skillTimer -= dt;
      if (s.skillTimer <= 0) {
        // 进入前摇（技能 AI 按战场态势决策）
        s.telegraphSkill = this.pickSkill();
        s.skillState = 'telegraph';
        s.skillTimer = cfg.telegraphSec;
        // 前摇提示：音效 + 浮动文字（红光预警是核心技巧检验点，必须醒目）
        if (s.telegraphSkill === BossKingSkill.BOMB) {
          this.audio.playBossKingWarn();
          this.cb.onAddFloatingText(s.boss.x, s.boss.y + 130, '蟑老大要投弹了！', '#ff5040');
        } else if (s.telegraphSkill === BossKingSkill.WIND) {
          this.audio.playBossKingWind();
          this.cb.onAddFloatingText(s.boss.x, s.boss.y + 130, '妖风来袭！', '#96c8ff');
        } else {
          this.audio.playBossKingPurge();
          this.cb.onAddFloatingText(s.boss.x, s.boss.y + 130, '蟑老大净化了全场！', '#ffd778');
        }
      }
      return;
    }

    // telegraph 阶段
    s.skillTimer -= dt;
    if (s.skillTimer > 0) return;

    // ===== 前摇结束 → 施放 =====
    const phaseCd = s.phase === 3 ? cfg.phaseCd.p3 : s.phase === 2 ? cfg.phaseCd.p2 : cfg.phaseCd.p1;
    if (s.telegraphSkill === BossKingSkill.PURGE) {
      this.castPurge();
    } else if (s.telegraphSkill === BossKingSkill.WIND) {
      s.windTimer = cfg.wind.durationSec;
    } else {
      this.castBomb();
    }
    s.skillsCasted++;
    s.skillState = 'idle';
    s.skillTimer = phaseCd;
    // ===== 每施放 3 个技能 → 额外休整（让玩家有时间清理小怪） =====
    if (s.skillsCasted % 3 === 0) {
      s.skillTimer = phaseCd + cfg.rotationRestSec;
      this.cb.onAddFloatingText(s.boss.x, s.boss.y + 130, '蟑老大喘息中，快清理小怪！', '#a8e6a3');
      console.info(`[BossKing] 已施放 ${s.skillsCasted} 个技能，休整 ${cfg.rotationRestSec}s（阶段CD ${phaseCd}s + 休整，共 ${phaseCd + cfg.rotationRestSec}s）`);
    }
  }

  /** 技能① 净化：清除全场小怪负面状态 + 0.5s 无敌帧 */
  private castPurge(): void {
    const cfg = BALANCE_CONFIG.bossKing;
    let purged = 0, revived = 0, fireCleared = 0, ctrlCleared = 0;
    for (const r of this.cb.onGetRoaches()) {
      if (r.state === RoachState.DEAD || r.isBoss) continue;
      // 诊断统计（在清除前采样）
      purged++;
      if (r.state === RoachState.FROZEN || r.state === RoachState.BURNING) revived++;
      if (r.burnDamage > 0 || r.inFire) fireCleared++;
      if (r.stunTimer > 0 || r.isStunned || r.stuckTimer > 0 || r.wrapTimer > 0) ctrlCleared++;
      // 控制类
      r.stunTimer = 0;
      r.isStunned = false;
      r.stuckTimer = 0;
      r.wrappedByDropId = null;
      r.wrapTimer = 0;
      // 持续减益类
      r.poisonTimer = 0;
      r.poisonDamage = 0;
      r.fanSlowTimer = 0;
      r.fanSlowFactor = 0;
      r.fanPushY = 0;
      r.weakenTimer = 0;
      r.skillBlockTimer = 0;
      r.asphyxiationTimer = 0;
      r.dodgeBlockTimer = 0;
      r.windBoostTimer = 0;
      // 火焰持续结算清理（燃烧真净化）
      r.burnDamage = 0;
      r.inFire = false;
      // 状态恢复（冰冻/燃烧 → 存活）
      if (r.state === RoachState.FROZEN || r.state === RoachState.BURNING) {
        r.state = RoachState.ALIVE;
      }
      // 无敌帧
      r.purgeImmuneTimer = cfg.purge.immuneSec;
    }
    this.purgeImmuneActiveCount = purged;
    console.info(`[BossKing] 净化施放: ${purged} 只小怪清负面（解除冰冻/燃烧 ${revived}，清燃烧结算 ${fireCleared}，清控制 ${ctrlCleared}），无敌帧 ${cfg.purge.immuneSec}s 开始`);
  }

  /** 技能③ 投弹：第 1 次单发，第 2 次双发，第 3 次起三连发（落点以 doubleOffsetX 间距对称错开；连发错开 burstStaggerSec 秒出手） */
  private castBomb(): void {
    const s = this.state;
    const f = this.frame!;
    const cfg = BALANCE_CONFIG.bossKing;
    const burstY = f.defenseLineY - cfg.bomb.burstOffsetFromDefense;
    // 落点：防线附近随机（留出边距）
    const margin = 70;
    const targetX = margin + Math.random() * (f.width - margin * 2);
    // 连发数随投弹次数递增：1 → 2 → 3（封顶）
    const count = Math.min(s.bombsCasted + 1, 3);
    const spacing = cfg.bomb.doubleOffsetX * 2;
    for (let i = 0; i < count; i++) {
      const offsetX = (i - (count - 1) / 2) * spacing;
      const x = Math.max(margin, Math.min(f.width - margin, targetX + offsetX));
      if (i === 0) {
        // 首枚立即出手
        this.bombs.spawnBomb(s.boss.x, s.boss.y, x, burstY);
        this.audio.playBossKingThrow();
      } else {
        // 后续炸弹错时出手（延迟队列，出手时取当时 Boss 位置作为起点）
        this.pendingBombThrows.push({ x0: 0, y0: 0, x1: x, y1: burstY, delay: cfg.bomb.burstStaggerSec * i });
      }
    }
    // 连发期间保持投掷动作（渲染层按 timer 取帧，覆盖整个错时窗口）
    s.boss.animAction = 'bomb_throw';
    s.boss.animTimer = 0;
    s.bombsCasted++;
  }

  /** 延迟出手队列推进（错时投弹；出手瞬间以 Boss 当前位置为起点） */
  private updatePendingBombThrows(dt: number): void {
    if (this.pendingBombThrows.length === 0) return;
    const s = this.state;
    const ready: typeof this.pendingBombThrows = [];
    for (const p of this.pendingBombThrows) {
      p.delay -= dt;
      if (p.delay <= 0) ready.push(p);
    }
    if (ready.length === 0) return;
    this.pendingBombThrows = this.pendingBombThrows.filter(p => p.delay > 0);
    for (const p of ready) {
      this.bombs.spawnBomb(s.boss.x, s.boss.y, p.x1, p.y1);
      this.audio.playBossKingThrow();
      // 每次出手重置投掷动画计时（连发逐枚播放投掷动作）
      s.boss.animAction = 'bomb_throw';
      s.boss.animTimer = 0;
    }
  }

  /** 动画动作选择（优先级：退场 > 投弹 > 吹风 > 净化 > 悬停） */
  private updateAnimAction(): void {
    const s = this.state;
    let action = s.boss.animAction;
    if (s.skillState === 'telegraph') {
      if (s.telegraphSkill === BossKingSkill.BOMB) action = 'bomb_warn';
      else if (s.telegraphSkill === BossKingSkill.WIND) action = 'wind';
      else action = 'purge';
    } else if (s.windTimer > 0) {
      action = 'wind';
    } else if (this.isThrowAnimPlaying()) {
      // 投弹出手动作：连发错时窗口内持续（不被 hit/hover 打断）
      action = 'bomb_throw';
    } else if (s.boss.damageFlash > 0) {
      action = 'hit';
    } else {
      action = 'hover';
    }
    if (action !== s.boss.animAction) {
      s.boss.animAction = action;
      s.boss.animTimer = 0;
    }
  }

  /** 投掷动画是否仍在播放窗口（延迟队列未空，或最后一枚出手后 0.4s 内） */
  private isThrowAnimPlaying(): boolean {
    const s = this.state;
    if (s.boss.animAction !== 'bomb_throw') return false;
    if (this.pendingBombThrows.length > 0) return true;
    // 无后续待出手炸弹时，播放完一轮投掷帧（约 0.4s）即回到常规动作
    return s.boss.animTimer < 0.4;
  }

  /** 开始退场（HP 归零；场上炸弹无害消散，出怪停止） */
  private startExit(): void {
    const s = this.state;
    const cfg = BALANCE_CONFIG.bossKing;
    s.exitStage = 'turn';
    s.exitTimer = cfg.exit.turnSec;
    s.exitStartX = s.boss.x;
    s.exitStartY = s.boss.y;
    // 锁定设计：Boss 死亡瞬间飞行中的炸弹无害消散（不伤防线）
    this.bombs.reset();
    this.pendingBombThrows = [];
    s.boss.animAction = 'exit';
    s.boss.animTimer = 0;
    this.cb.onAddFloatingText(s.boss.x, s.boss.y + 120, '蟑老大撑不住了！', '#ffd778');
  }

  /** 退场序列更新 */
  private updateExit(dt: number): void {
    const s = this.state;
    const cfg = BALANCE_CONFIG.bossKing;
    s.exitTimer -= dt;
    if (s.exitStage === 'turn' && s.exitTimer <= 0) {
      s.exitStage = 'fly';
      s.exitTimer = cfg.exit.flySec;
    } else if (s.exitStage === 'fly') {
      // 位置/缩放/渐隐由渲染层按 exitTimer 进度计算
      if (s.exitTimer <= 0) {
        s.exitStage = 'done';
        if (!s.victoryFired) {
          s.victoryFired = true;
          s.active = false;
          this.cb.onVictory();
        }
      }
    }
  }

  /** 火枪引爆炸弹检测（engine 在火焰碰撞结算后调用） */
  checkBombFlameHits(): void {
    const f = this.frame;
    if (!this.state.active || !f) return;
    this.bombs.checkFlameHits(
      f.player,
      f.tripleFlame,
      this.cb.onGetRoaches(),
      BALANCE_CONFIG.player.nozzleOffsetY
    );
  }

  /** 获取战斗状态（渲染用） */
  getState(): BossKingBattleState {
    return this.state;
  }
}
