/**
 * @fileoverview 蟑螂 AI 系统模块
 * @description 负责所有蟑螂敌人的 AI 行为：移动、寻路、闪避、愤怒、特殊技能
 *   （护士治疗、变异变形、分裂、自爆、定时自爆等）、医院专属行为，以及击杀处理
 */

import { RoachType, RoachState, SceneType, GameMode, GameState, ParticleType } from '../../types';
import type { Roach, Player, Particle, FireWall, Economy, GameProgress, BossBattleState, WaveConfig, FormationGroupConfig } from '../../types';
import { ENEMY_DEFS, BOSS_CONFIG, TEXT_CONFIG, BALANCE_CONFIG } from '../../data';
import { ParticleSpawner } from '../particle/ParticleSpawner';
import { FormationSystem } from '../formation/FormationSystem';
import type { StickySystem } from '../sticky/StickySystem';
import type { BossBattleSystem } from '../boss/BossBattleSystem';
import type { ConsumableSystem } from '../consumable/ConsumableSystem';
import type { AudioManager } from '../../audio';
import * as Vibration from '../../vibration';

// =============================================================================
// 配置接口
// =============================================================================

/** 蟑螂 AI 系统配置 */
export interface RoachAISystemConfig {
  // -- 直接共享引用 --
  roaches: Roach[];
  particles: Particle[];
  fireWalls: FireWall[];
  player: Player;
  economy: Economy;
  progress: GameProgress;
  placedBombs: { id: number; x: number; y: number; timer: number }[];
  deadTimedBombs: { id: number; x: number; y: number; timer: number; flashPhase: number }[];
  armorShieldCache: Set<number>;

  // -- 模块引用 --
  stickySystem: StickySystem;
  bossSystem: BossBattleSystem;
  consumableSystem: ConsumableSystem;
  audio: AudioManager;

  // -- 值获取器 --
  getDifficulty: () => string;
  getCurrentScene: () => SceneType;
  getGameMode: () => GameMode;
  getState: () => GameState;
  getTime: () => number;
  getDeltaTime: () => number;
  getCanvasWidth: () => number;
  getCanvasHeight: () => number;
  getDefenseHp: () => number;
  getMaxDefenseHp: () => number;
  getWave: () => number;
  getTalentMultipliers: () => Record<string, number>;
  getDefenseLineY: () => number;
  getGroundBoundsAtY: (y: number) => [number, number];
  getWaveConfig: (wave: number) => WaveConfig;
  getSceneConfig: () => { rewardMultiplier: number; };

  // -- 值设置器 --
  setState: (state: GameState) => void;
  setScreenShake: (amount: number) => void;
  setDefenseHp: (hp: number) => void;
  setEconomy: (e: Economy) => void;
  setHospitalBreaches: (count: number) => void;

  // -- 回调 --
  onAddFloatingText: (x: number, y: number, text: string, color: string, duration?: number) => void;
  onSpawnRoach: (type: RoachType, clusterId?: number) => Roach | undefined;
  onApplyDamageToRoach: (r: Roach, damage: number) => void;
  /** 平衡采样：燃烧伤害实际结算（可选，仅数据分析用） */
  onTraceBurnDamage?: (dmg: number) => void;
  onSaveProgress: () => void;
  onGameOver: (economy: Economy, wave: number) => void;
  onStateChange: (state: GameState) => void;
  onEconomyUpdate: (economy: Economy) => void;
  onDefenseUpdate: (hp: number, maxHp: number) => void;
  onBossUpdate: (state: BossBattleState) => void;
  onGameVictory: () => void;
  onSellUnusedInventory: () => void;
  onUnlockNextScene: () => void;
  onAddPendingReward: (amount: number) => void;
  /** 修复 P0：获取下一个蟑螂 ID（回调注入，避免多模块独立计数器） */
  getNextId: () => number;
}

// =============================================================================
// 类：RoachAISystem
// =============================================================================

// 修复 P0：移除模块级 nextId/nextBossId，统一通过回调注入从 engine.ts 获取 ID
// 避免 engine.ts 和 RoachAISystem.ts 各自维护独立计数器导致 ID 冲突

export class RoachAISystem {
  private cfg: RoachAISystemConfig;

  // ===== 内部状态（从 engine.ts 迁移） =====

  /** 变异变形动画：是否激活 */
  mutantTransformActive: boolean = false;
  /** 变异变形动画：当前帧 (0-6) */
  mutantTransformFrame: number = 0;
  /** 变异变形动画：帧计时器 */
  mutantTransformTimer: number = 0;
  /** 变异变形动画：位置 X */
  mutantTransformX: number = 0;
  /** 变异变形动画：位置 Y */
  mutantTransformY: number = 0;

  /** 绿色粘液爆发效果计时器 */
  slimeBurstTimer: number = 0;
  slimeBurstX: number = 0;
  slimeBurstY: number = 0;

  /** 死亡链深度（防止递归爆炸） */
  private _deathChainDepth: number = 0;
  private readonly MAX_DEATH_CHAIN_DEPTH = 3;

  /** 死体炸弹 ID */
  private _nextBombId: number = 1;

  /** 阵型协同系统（实例化，支持策略切换） */
  private formationSystem = new FormationSystem();

  constructor(config: RoachAISystemConfig) {
    this.cfg = config;
  }

  /** 更新配置（场景切换时调用） */
  updateConfig(partial: Partial<RoachAISystemConfig>): void {
    Object.assign(this.cfg, partial);
  }

  /** 重置内部状态 */
  reset(): void {
    this.mutantTransformActive = false;
    this.mutantTransformFrame = 0;
    this.mutantTransformTimer = 0;
    this.mutantTransformX = 0;
    this.mutantTransformY = 0;
    this.slimeBurstTimer = 0;
    this.slimeBurstX = 0;
    this.slimeBurstY = 0;
    this._deathChainDepth = 0;
    this._nextBombId = 1;
    this.formationSystem.clearInstances();
  }

  // =========================================================================
  // 超市阵型（V5.0 直驱制多组错时共存：WaveManager 波内调度器驱动，各组独立锚点/独立破阵）
  // =========================================================================

  /** 清空全部阵型实例（波次开始/重置/离开超市场景时调用） */
  clearFormations(): void {
    this.formationSystem.clearInstances();
  }

  /**
   * 追加一组阵型并返回出生点表（出生点即阵型槽位绝对坐标，所见即所得；
   * 组内成员由调用方按 formationMemberStaggerSec 陆续生成，位置固定）
   * 非超市场景返回 null
   */
  addFormationGroup(
    group: FormationGroupConfig,
  ): { type: RoachType; x: number; y: number }[] | null {
    if (this.cfg.getCurrentScene() !== SceneType.SUPERMARKET) return null;
    return this.formationSystem.addPlan(group, this.cfg.getGroundBoundsAtY);
  }

  /** 是否存在仍在作战的阵型实例（波次串行出场门控：上一组被消灭后才出下一组） */
  hasActiveFormations(): boolean {
    return this.formationSystem.hasActiveInstances(this.cfg.roaches, 2);
  }

  /** orbit 阵型：核心锚点的环成员顶替承伤查询（CollisionSystem 伤害重定向用，无顶替返回 null） */
  findFormationProtector(target: Roach, roaches: Roach[]): Roach | null {
    return this.formationSystem.findOrbitProtector(target, roaches);
  }

  // =========================================================================
  // 主更新方法
  // =========================================================================

  /** 更新所有蟑螂敌人的 AI、移动与状态 */
  update(): void {
    const deltaTime = this.cfg.getDeltaTime();
    const time = this.cfg.getTime();
    const defenseLineY = this.cfg.getDefenseLineY();
    const canvasWidth = this.cfg.getCanvasWidth();
    const canvasHeight = this.cfg.getCanvasHeight();
    const roaches = this.cfg.roaches;
    const fireWalls = this.cfg.fireWalls;
    const isHard = this.cfg.getDifficulty() === 'hard';

    // ===== 超市阵型实例（V4.0）：每帧状态机（计划由 WaveManager 波内调度器经 addFormationGroup 追加） =====
    this.formationSystem.updateInstances(roaches, deltaTime, defenseLineY, this.cfg.getGroundBoundsAtY);

    for (let i = roaches.length - 1; i >= 0; i--) {
      const r = roaches[i];
      if (!r) continue;

      // Spawn immunity & heal buff timers
      if (r.spawnImmuneTimer && r.spawnImmuneTimer > 0) r.spawnImmuneTimer -= deltaTime;
      if (r.healBuffTimer && r.healBuffTimer > 0) r.healBuffTimer -= deltaTime;
      // 护甲+号 buff：喷涂后 2 秒内每 0.5 秒在目标头顶生成蓝色+号（频率/节奏与加血+号一致）
      if (r.armorBuffTimer && r.armorBuffTimer > 0) {
        r.armorBuffTimer -= deltaTime;
        r.armorPlusTimer = (r.armorPlusTimer ?? 0) - deltaTime;
        if (r.armorPlusTimer <= 0 && r.state === RoachState.ALIVE) {
          r.armorPlusTimer = BALANCE_CONFIG.particle.armorSpray.plusSpawnInterval;
          ParticleSpawner.spawnArmorHealPlus(this.cfg.particles, r.x, r.y);
        }
      }

      // Dead roach state
      if (r.state === RoachState.DEAD) {
        if (this.handleDeadRoachState(r, i, roaches, defenseLineY, deltaTime)) continue;
      }

      // Pre-movement state updates (returns isImmobilized for bait & movement)
      const isImmobilized = this.handleRoachPreMovement(r, deltaTime, time, roaches);

      // 大蟑螂狂暴：血量低于阈值时一次性进入狂暴（获得火焰闪避属性）
      if (r.type === RoachType.LARGE && !r.berserk && r.hp > 0 &&
          r.hp < r.maxHp * BALANCE_CONFIG.roachAI.dodge.largeBerserkHpRatio) {
        r.berserk = true;
        this.cfg.onAddFloatingText(r.x, r.y - 30, TEXT_CONFIG.combat.berserk.text, TEXT_CONFIG.combat.berserk.color, 1200);
      }

      // Calculate movement angle
      let moveAngle = this.calculateMoveAngle(r, time, defenseLineY, canvasWidth, deltaTime);
      moveAngle = this.applyBaitPull(r, moveAngle, isImmobilized);

      // Apply movement (velocity, dodge, position, clamping, wing animation)
      const fanMultiplier = r.fanSlowTimer > 0 ? (1 - r.fanSlowFactor) : 1;
      const weakenMult = (r.weakenTimer ?? 0) > 0 ? BALANCE_CONFIG.insecticide.weakenSpeedMult : 1;
      let effectiveSpeed = r.speed * fanMultiplier * weakenMult;

      // ===== 盾墙推进编队：横向归位 + 速度钳制 + 接近防线解除 =====
      // （超市阵型实例成员跳过盾墙判定，由阵型实例接管移动修正）
      const formation = r.formationId == null
        ? this.formationSystem.computeFormationMove(roaches, r, defenseLineY)
        : { inFormation: false, anchor: null, lateralMoveSpeed: 0, speedCap: null, shouldBreak: false };
      if (formation.inFormation && formation.speedCap !== null && effectiveSpeed > formation.speedCap) {
        effectiveSpeed = formation.speedCap;
      }
      // 编队横向归位：调整 moveAngle 使蟑螂偏向护盾锚点方向
      if (formation.inFormation && formation.anchor && formation.lateralMoveSpeed !== 0) {
        // 计算到锚点的横向偏角，与原始 moveAngle 混合
        const anchorDx = formation.anchor.x - r.x;
        // 横向修正角度：纯横向移动（左或右）
        const lateralAngle = anchorDx > 0 ? 0 : Math.PI; // 0=向右, PI=向左
        // 混合角度：70% 原始方向 + 30% 横向修正（保持向下移动的同时横向归位）
        const blendFactor = 0.3;
        // 将两个角度分解为分量后混合
        const origVx = Math.cos(moveAngle);
        const origVy = Math.sin(moveAngle);
        const latVx = Math.cos(lateralAngle);
        const latVy = Math.sin(lateralAngle);
        const mixedVx = origVx * (1 - blendFactor) + latVx * blendFactor;
        const mixedVy = origVy * (1 - blendFactor) + latVy * blendFactor;
        moveAngle = Math.atan2(mixedVy, mixedVx);
      }

      // ===== 超市阵型实例（V3.1）：70% 跟随阵型槽位 + 30% 向防线推进 =====
      // 冲突状态（闪避/狂暴/冲刺）时 computeInstanceMove 返回 null，原生 AI 优先
      const instTarget = this.formationSystem.computeInstanceMove(r, this.cfg.getGroundBoundsAtY);
      if (instTarget) {
        const blend = BALANCE_CONFIG.supermarket.formationBlend;
        const toTarget = Math.atan2(instTarget.y - r.y, instTarget.x - r.x);
        const fOrigVx = Math.cos(moveAngle);
        const fOrigVy = Math.sin(moveAngle);
        moveAngle = Math.atan2(
          fOrigVy * (1 - blend) + Math.sin(toTarget) * blend,
          fOrigVx * (1 - blend) + Math.cos(toTarget) * blend,
        );
      }

      this.applyRoachMovement(r, moveAngle, effectiveSpeed, roaches, deltaTime, canvasWidth, canvasHeight, fireWalls, defenseLineY, isImmobilized);

      // Suicide fuse check (returns true if roach exploded and was removed)
      if (this.handleSuicideFuseCheck(r, i, defenseLineY, deltaTime)) continue;

      // Queen minion spawn
      this.handleQueenSpawnMinions(r, deltaTime);

      // Nurse heal
      this.updateNurseHeal(r, roaches);

      // Subway exclusive: tunnel worker (armor spray)
      this.updateTunnelWorker(r, roaches);

      // Subway exclusive: elite rail charge
      this.updateSubwayElite(r, fireWalls);

      // Fire dodge triggers (suicide & small roaches)
      this.handleFireDodgeTriggers(r, roaches);

      // Timed suicide breach
      this.updateTimedSuicideBreach(r, i, roaches, defenseLineY, isHard);

      // Burn & poison damage, kill check
      this.handleBurnAndPoisonDamage(r, i, roaches, deltaTime, isHard);
    }
  }

  // =========================================================================
  // 子方法：死亡蟑螂状态处理
  // =========================================================================

  /** 处理已死亡蟑螂的状态（飞行坠落、变异变形、移除）。返回 true 表示需要 continue */
  private handleDeadRoachState(r: Roach, i: number, roaches: Roach[], defenseLineY: number, deltaTime: number): boolean {
    r.deathTimer -= deltaTime;
    if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
      r.vy = BALANCE_CONFIG.roachAI.flyingDeathVy;
      r.y += r.vy * deltaTime;
      r.vx = (Math.random() - 0.5) * BALANCE_CONFIG.roachAI.flyingDeathVxRange;
      r.x += r.vx * deltaTime;
      r.angle += deltaTime * BALANCE_CONFIG.roachAI.flyingDeathAngleSpeed;
      if (r.y >= defenseLineY) {
        r.y = defenseLineY;
        r.deathTimer = 0;
      }
    }
    if (r.deathTimer <= 0) {
      if (r.type === RoachType.MUTANT && r.transformFrame !== undefined && r.transformFrame < BALANCE_CONFIG.roachAI.transformFrameCount) {
        r.deathTimer = BALANCE_CONFIG.roachAI.deathTimerExtension;
      } else {
        roaches.splice(i, 1);
        return true;
      }
    }
    // Per-roach mutant transform animation
    if (r.type === RoachType.MUTANT && r.state === RoachState.DEAD
      && r.transformTimer !== undefined && r.transformTimer > 0
      && r.transformFrame !== undefined && r.transformFrame < BALANCE_CONFIG.roachAI.transformFrameCount) {
      r.transformTimer -= deltaTime;
      if (r.transformTimer <= 0) {
        r.transformFrame++;
        if (r.transformFrame >= BALANCE_CONFIG.roachAI.transformFrameCount) {
          this.spawnEmbryoRoaches(r);
        } else {
          r.transformTimer = BALANCE_CONFIG.roachAI.transformTimer;
        }
      }
    }
    return true; // continue to next iteration
  }

  // =========================================================================
  // 子方法：移动前状态更新
  // =========================================================================

  /** 处理移动前的状态更新（伤害闪烁、状态效果、定身、愤怒、恐慌）。返回 isImmobilized */
  private handleRoachPreMovement(r: Roach, deltaTime: number, _time: number, _roaches: Roach[]): boolean {
    const moveCfg = BALANCE_CONFIG.roachAI.movement;

    // Damage flash decay
    if (r.damageFlash > 0) r.damageFlash -= deltaTime * BALANCE_CONFIG.roachAI.damageFlashDecay;

    // Status effects
    this.updateStatusEffects(r);

    // Stunned or board-stuck（地铁精英冲刺时无视蟑螂贴板定身）
    const boardStuck = this.cfg.stickySystem.isStuckByBoard(r.id)
      && !(r.type === RoachType.SUBWAY_ELITE && r.chargeState === 'charge');
    const isImmobilized = r.isStunned || boardStuck;
    if (isImmobilized) {
      r.vx = 0; r.vy = 0;
    }

    // Enrage
    if (!r.isEnraged && r.hp < r.maxHp * moveCfg.enrageHpThreshold && r.type !== RoachType.ARMORED) {
      r.isEnraged = true;
      r.speed = r.baseSpeed * moveCfg.enrageSpeedMult;
    }

    // Panic timer
    if (r.panicTimer > 0) r.panicTimer -= deltaTime;

    return isImmobilized;
  }

  // =========================================================================
  // 子方法：移动角度计算
  // =========================================================================

  /**
   * 判断是否按"飞行类"移动处理（不受地面阻挡影响）。
   * 地铁精英（SUBWAY_ELITE）飞行化改造后，在移动/阻挡层面与飞行蟑螂一致：
   * 不被火焰墙阻挡、不受地面边界 X 钳制、无最小下移速度、用屏幕边缘 margin 钳制。
   */
  private isFlyingLikeMovement(r: Roach): boolean {
    return r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE || r.type === RoachType.SUBWAY_ELITE;
  }

  /** 计算蟑螂移动角度（恐慌/正常移动/强制接近防线/飞行冲刺/边缘排斥） */
  private calculateMoveAngle(r: Roach, time: number, defenseLineY: number, canvasWidth: number, deltaTime: number): number {
    const moveCfg = BALANCE_CONFIG.roachAI.movement;

    if (r.panicTimer > 0) {
      return r.panicAngle + Math.sin(time * 15 + r.wobbleOffset) * 0.8;
    }

    const isFlying = this.isFlyingLikeMovement(r);
    const wanderAmplitude = isFlying ? moveCfg.flyingWanderAmplitude : moveCfg.groundWanderAmplitude;
    const targetX = r.x + Math.sin(r.wobbleOffset + time * r.wobbleSpeed) * wanderAmplitude;
    const dl = defenseLineY;
    const roachSize = ENEMY_DEFS[r.type].size;
    const roachBottom = r.y + roachSize * 0.4;
    const targetY = roachBottom >= dl ? dl + 200 : dl;
    const dx = targetX - r.x;
    const dy = targetY - r.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let moveAngle = dist > 1 ? Math.atan2(dy, dx) : r.angle;

    // Force near defense line
    const distToDefense = dl - roachBottom;
    if (distToDefense > 0 && distToDefense < moveCfg.forceApproachDist) {
      const minSin = moveCfg.forceApproachMinSin + (1 - distToDefense / moveCfg.forceApproachDist) * moveCfg.forceApproachMaxSin;
      if (Math.sin(moveAngle) < minSin) {
        moveAngle = Math.asin(Math.min(minSin, 0.99));
      }
    }

    // Flying roaches: charge
    if (isFlying && distToDefense < moveCfg.flyingChargeDist) {
      const chargeSpeed = moveCfg.flyingChargeSpeed * (1 - distToDefense / moveCfg.flyingChargeDist);
      r.speed = r.baseSpeed * (1 + chargeSpeed);
    } else if (!isFlying) {
      if (distToDefense < moveCfg.edgeRepelDist) {
        const pushStrength = (1 - distToDefense / moveCfg.edgeRepelDist) * moveCfg.edgeRepelStrength * deltaTime;
        if (r.x < moveCfg.edgeStopMargin) {
          moveAngle += pushStrength * (moveCfg.edgeStopMargin - r.x) / moveCfg.edgeStopMargin;
        } else if (r.x > canvasWidth - moveCfg.edgeStopMargin) {
          moveAngle -= pushStrength * (r.x - (canvasWidth - moveCfg.edgeStopMargin)) / moveCfg.edgeStopMargin;
        }
      }
    }

    return moveAngle;
  }

  // =========================================================================
  // 子方法：诱饵效果
  // =========================================================================

  /** 应用诱饵消耗品效果（拉向诱饵位置）。返回可能被修改的移动角度 */
  private applyBaitPull(r: Roach, moveAngle: number, isImmobilized: boolean): number {
    const player = this.cfg.player;
    if (player.baitTimer <= 0 || isImmobilized || !this.cfg.consumableSystem.baitTarget.active) return moveAngle;

    const baitDx = this.cfg.consumableSystem.baitTarget.x - r.x;
    const baitDy = this.cfg.consumableSystem.baitTarget.y - r.y;
    const baitDist = Math.sqrt(baitDx * baitDx + baitDy * baitDy);
    if (baitDist > 10) {
      const baitAngle = Math.atan2(baitDy, baitDx);
      const pullStrength = BALANCE_CONFIG.roachAI.movement.baitPullStrength;
      const cosA = Math.cos(moveAngle);
      const sinA = Math.sin(moveAngle);
      const cosB = Math.cos(baitAngle);
      const sinB = Math.sin(baitAngle);
      // 诱饵专精：吸引速度倍率（天赋 baitSpeedMult 乘算）
      const baitSpeedTalent = this.cfg.getTalentMultipliers().baitSpeedMult || 1;
      r.speed = r.baseSpeed * BALANCE_CONFIG.roachAI.movement.baitSpeedMult * baitSpeedTalent;
      return Math.atan2(
        sinA * (1 - pullStrength) + sinB * pullStrength,
        cosA * (1 - pullStrength) + cosB * pullStrength
      );
    }
    return moveAngle;
  }

  // =========================================================================
  // 子方法：移动执行
  // =========================================================================

  /** 执行蟑螂移动（护士跟随、标准移动、闪避、位置更新、边界限制、火墙阻挡、风扇推力、翅膀动画） */
  private applyRoachMovement(
    r: Roach, moveAngle: number, effectiveSpeed: number, roaches: Roach[],
    deltaTime: number, canvasWidth: number, canvasHeight: number,
    fireWalls: FireWall[], defenseLineY: number, isImmobilized: boolean,
  ): void {
    const moveCfg = BALANCE_CONFIG.roachAI.movement;
    const dodgeCfg = BALANCE_CONFIG.roachAI.dodge;

    // ===== NURSE ROACH FOLLOW MOVEMENT =====
    if (r.type === RoachType.JOCK) {
      // ===== JOCK ROACH (体育生蟑螂) 爆发跳跃状态机 =====
      this.updateJockJump(r, moveAngle, effectiveSpeed, deltaTime, defenseLineY);
    } else if (r.type === RoachType.NURSE) {
      if (this.formationSystem.isAnchor(r.id)) {
        // 阵型锚点（超市方阵）：禁用自动跟随，走标准移动由编队修正驱动，固定阵型中心
        r.vx = Math.cos(moveAngle) * effectiveSpeed * 65;
        r.vy = Math.sin(moveAngle) * effectiveSpeed * 65;
      } else {
      let nearest: Roach | null = null;
      let nearestDist = Infinity;
      for (const other of roaches) {
        if (other.id === r.id) continue;
        if (other.state !== RoachState.ALIVE) continue;
        if (other.type === RoachType.NURSE) continue;
        if (other.type === RoachType.TIMED_SUICIDE) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = other;
        }
      }
      if (nearest && nearestDist > moveCfg.nurseStopDist) {
        const followAngle = Math.atan2(nearest.y - r.y, nearest.x - r.x);
        const followSpeed = r.speed * moveCfg.nurseFollowSpeedMult;
        r.vx = Math.cos(followAngle) * followSpeed * 65;
        r.vy = Math.sin(followAngle) * followSpeed * 65;
      } else {
        r.vx = 0; r.vy = 0;
      }
      }
    } else if (r.type === RoachType.TUNNEL_WORKER) {
      // ===== TUNNEL WORKER FOLLOW SHIELD ROACH =====
      if (this.formationSystem.isAnchor(r.id)) {
        // 阵型锚点（超市方阵）：禁用跟随护盾，走标准移动由编队修正驱动，固定阵型中心
        r.vx = Math.cos(moveAngle) * effectiveSpeed * 65;
        r.vy = Math.sin(moveAngle) * effectiveSpeed * 65;
      } else {
      // 跟随最近的存活护盾蟑螂（停留距离 workerFollowStopDist），无目标时走标准移动
      let nearestShield: Roach | null = null;
      let nearestShieldDist = Infinity;
      for (const other of roaches) {
        if (other.type !== RoachType.SHIELD || other.state !== RoachState.ALIVE) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearestShieldDist) {
          nearestShieldDist = d;
          nearestShield = other;
        }
      }
      r.shieldFollowTargetId = nearestShield ? nearestShield.id : null;
      if (nearestShield && nearestShieldDist > BALANCE_CONFIG.subway.workerFollowStopDist) {
        const followAngle = Math.atan2(nearestShield.y - r.y, nearestShield.x - r.x);
        const followSpeed = r.speed * moveCfg.nurseFollowSpeedMult;
        r.vx = Math.cos(followAngle) * followSpeed * 65;
        r.vy = Math.sin(followAngle) * followSpeed * 65;
      } else if (nearestShield) {
        r.vx = 0; r.vy = 0;
      } else {
        r.vx = Math.cos(moveAngle) * effectiveSpeed * 65;
        r.vy = Math.sin(moveAngle) * effectiveSpeed * 65;
      }
      }
    } else if (r.type === RoachType.MUTANT && r.transformTimer && r.transformTimer > 0) {
      r.vx = 0; r.vy = 0;
    } else if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) {
      r.vx = 0; r.vy = 0;
    } else if (r.spawnImmuneTimer && r.spawnImmuneTimer > 0) {
      r.vx = 0; r.vy = 0;
    } else if (r.type === RoachType.SUBWAY_ELITE && r.chargeState === 'charge') {
      // 地铁精英：轨道冲刺（横向高速，无视普通移动角度）
      r.vx = (r.chargeDir ?? 1) * BALANCE_CONFIG.subway.eliteChargeSpeed;
      r.vy = 0;
      r.angle = Math.PI; // 护盾蟑螂永远面朝左侧（玩家方向），不反转
    } else {
      r.vx = Math.cos(moveAngle) * effectiveSpeed * 65;
      r.vy = Math.sin(moveAngle) * effectiveSpeed * 65;
    }

    // Minimum downward speed
    if (!isImmobilized && !this.isFlyingLikeMovement(r)
      && r.type !== RoachType.NURSE
      && r.type !== RoachType.TUNNEL_WORKER
      && !(r.type === RoachType.SUBWAY_ELITE && r.chargeState === 'charge')
      && !(r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0)
      && !(r.type === RoachType.JOCK && r.jumpPhase !== 'idle')
      && r.vy < moveCfg.minDownwardSpeed) {
      r.vy = moveCfg.minDownwardSpeed;
    }

    // Dodge（自爆/定时自爆/小蟑螂/狂暴大蟑螂；定时自爆闪避时长与自爆相同 suicideDuration，X 轴速度按 timedSuicideSpeedMult 放大）
    if ((r.type === RoachType.SUICIDE || r.type === RoachType.TIMED_SUICIDE || r.type === RoachType.SMALL ||
         (r.type === RoachType.LARGE && r.berserk)) && r.dodgeTimer > 0) {
      r.dodgeTimer -= deltaTime;
      if (r.dodgeTimer <= 0) {
        r.dodgeDir = 0;
      } else {
        let dodgeSpeed: number;
        if (r.isSplitChild) {
          dodgeSpeed = dodgeCfg.splitChildSpeed;
        } else if (r.type === RoachType.SMALL) {
          dodgeSpeed = dodgeCfg.smallSpeed;
        } else if (r.type === RoachType.TIMED_SUICIDE) {
          dodgeSpeed = dodgeCfg.suicideSpeed * dodgeCfg.timedSuicideSpeedMult; // 定时自爆横向闪避更快
        } else if (r.type === RoachType.LARGE) {
          dodgeSpeed = dodgeCfg.largeBerserkSpeed; // 狂暴大蟑螂横向闪避
        } else {
          dodgeSpeed = dodgeCfg.suicideSpeed;
        }
        const fanMult = r.fanSlowTimer > 0 ? (1 - r.fanSlowFactor) : 1;
        dodgeSpeed *= fanMult;
        r.vx = r.dodgeDir * dodgeSpeed;
        // Fire wall blocks during dodge
        for (const wall of fireWalls) {
          if (r.x >= wall.x1 && r.x <= wall.x2) {
            const wallTop = wall.y - wall.height * 0.5;
            if (r.y > wallTop && r.y < wallTop + wall.height + 5 && r.vy > 0) {
              r.y = wallTop;
              r.vy = 0;
            }
          }
        }
        // Fan push during dodge
        if (r.fanPushY < 0 && r.y >= canvasHeight / 2 && r.armorHp <= 0) {
          r.y += r.fanPushY * deltaTime;
          r.y = Math.max(canvasHeight / 2, r.y);
        }
        // Edge stop
        const edgeMargin = 50;
        if ((r.x <= edgeMargin && r.dodgeDir < 0) || (r.x >= canvasWidth - edgeMargin && r.dodgeDir > 0)) {
          r.dodgeDir = 0;
          r.dodgeTimer = 0;
        }
      }
    }

    r.x += r.vx * deltaTime;
    r.y += r.vy * deltaTime;
    r.angle = (r.type === RoachType.TUNNEL_WORKER || r.type === RoachType.SUBWAY_ELITE) ? Math.PI : moveAngle;

    // Pull back into screen
    const margin = 100;
    if (r.x < -margin) r.x += 80 * deltaTime;
    if (r.x > canvasWidth + margin) r.x -= 80 * deltaTime;
    if (r.y < -margin) r.y += 80 * deltaTime;
    if (r.y > canvasHeight + margin * 2) {
      r.y = defenseLineY + 50;
    }

    // Fire wall blocks ground roaches（飞行类含地铁精英不被阻挡；体育生空中飞跃穿越火墙不受阻挡）
    if (!this.isFlyingLikeMovement(r) && !(r.type === RoachType.JOCK && r.jumpPhase === 'air')) {
      for (const wall of fireWalls) {
        if (r.x >= wall.x1 && r.x <= wall.x2) {
          const wallTop = wall.y - wall.height * 0.5;
          if (r.y > wallTop && r.y < wallTop + wall.height + 5 && r.vy > 0) {
            r.y = wallTop;
            r.vy = 0;
          }
        }
      }
    }

    // Fan upward push
    if (r.fanPushY < 0 && r.y >= canvasHeight / 2 && r.armorHp <= 0) {
      r.y += r.fanPushY * deltaTime;
      r.y = Math.max(canvasHeight / 2, r.y);
    }

    // Clamp X（飞行类含地铁精英用屏幕边缘 margin，地面类用地面阻挡边界）
    if (this.isFlyingLikeMovement(r)) {
      const roachSize = r.size ?? ENEMY_DEFS[r.type].size;
      const edgeMargin = Math.max(40, roachSize * 0.8);
      r.x = Math.max(edgeMargin, Math.min(canvasWidth - edgeMargin, r.x));
    } else {
      const [gLeft, gRight] = this.cfg.getGroundBoundsAtY(r.y);
      r.x = Math.max(gLeft + 5, Math.min(gRight - 5, r.x));
    }

    // Wing animation
    r.animTimer += deltaTime;
    if (r.animTimer > 0.12) {
      r.animTimer = 0;
      r.animFrame = (r.animFrame + 1) % 4;
    }
  }

  // =========================================================================
  // 子方法：体育生蟑螂（爆发跳跃）
  // =========================================================================

  /**
   * 体育生蟑螂跳跃状态机（蓄力 crouch → 腾空 air → 落地 land → 行走 idle）。
   * 蓄力/落地移速=0（击杀窗口），腾空时免疫火焰直射（清空 inFire/burnDamage）。
   * 被粘液弹包裹/粘板粘住后退化普通慢速蟑螂，无法跳跃。
   * @param r 蟑螂实例
   * @param moveAngle 正常移动角度（仅 idle 阶段使用）
   * @param effectiveSpeed 有效移动速度（仅 idle 阶段使用）
   * @param deltaTime 增量时间（秒）
   * @param defenseLineY 防线 Y 坐标
   */
  private updateJockJump(
    r: Roach,
    moveAngle: number,
    effectiveSpeed: number,
    deltaTime: number,
    defenseLineY: number,
  ): void {
    const jc = BALANCE_CONFIG.roachAI.jock;
    const phase = r.jumpPhase ?? 'idle';
    const stuck = this.cfg.stickySystem.isStuckByBoard(r.id) || r.wrappedByDropId != null;

    // 被粘住/包裹瞬间若正在蓄力则取消跳跃，退化为普通慢速蟑螂
    if (stuck && phase === 'crouch') {
      r.jumpPhase = 'idle';
      r.jumpTimer = 0;
      r.vx = 0; r.vy = 0;
      return;
    }

    switch (phase) {
      case 'air': {
        // 腾空：恒定速度沿起→终直线飞跃
        const airTime = jc.airTime;
        const startX = r.jumpStartX ?? r.x;
        const startY = r.jumpStartY ?? r.y;
        const endX = r.jumpEndX ?? r.x;
        const endY = r.jumpEndY ?? r.y;
        r.vx = (endX - startX) / airTime;
        r.vy = (endY - startY) / airTime;
        r.jumpTimer = (r.jumpTimer ?? airTime) - deltaTime;
        // 空中免疫火焰直射：清空束/火区累积，避免落地后残留灼伤
        r.inFire = false;
        r.burnDamage = 0;
        if (r.jumpTimer <= 0) {
          r.jumpTimer = 0;
          // 落地钳制在防线前，不过头
          r.y = Math.min(r.y, defenseLineY - 4);
          r.jumpPhase = 'land';
        }
        break;
      }
      case 'crouch': {
        // 蓄力：原地不动（最佳击杀窗口）
        r.vx = 0; r.vy = 0;
        r.jumpTimer = (r.jumpTimer ?? jc.crouchTime) - deltaTime;
        if (r.jumpTimer <= 0) {
          // 进入腾空：仅重置计时与拖尾计数（起止点已在进入蓄力时确定，供红色虚线预览）
          r.jumpTimer = jc.airTime;
          r.trailEmitted = 0; // 进入腾空：重置拖尾粒子计数，重新生成拖尾
          r.jumpPhase = 'air';
        }
        break;
      }
      case 'land': {
        // 落地硬直：无法移动（第二击杀窗口）
        r.vx = 0; r.vy = 0;
        r.jumpTimer = (r.jumpTimer ?? jc.landTime) - deltaTime;
        if (r.jumpTimer <= 0) {
          r.jumpPhase = 'idle';
          r.jumpTimer = 0;
        }
        break;
      }
      default: { // idle 行走
        // 被粘住/包裹：无法跳跃，普通（慢速）行走
        if (stuck) {
          r.jumpCooldown = jc.cooldown; // 保持冷却满，解粘后下一轮才跳
          r.vx = Math.cos(moveAngle) * effectiveSpeed * 65;
          r.vy = Math.sin(moveAngle) * effectiveSpeed * 65;
          return;
        }
        // 冷却倒计时
        r.jumpCooldown = (r.jumpCooldown ?? jc.cooldown) - deltaTime;
        // 距防线较近：直接冲刺不再起跳（避免飞跃过头）
        const roachBottom = r.y + ENEMY_DEFS[r.type].size * 0.4;
        const distToDefense = defenseLineY - roachBottom;
        if (r.jumpCooldown <= 0 && distToDefense > jc.jumpStopDistance) {
          // 低血加快跳跃节奏（疯狂逃命）
          const lowHp = r.hp < r.maxHp * jc.lowHpRatio;
          r.jumpCooldown = lowHp ? jc.lowHpCooldown : jc.cooldown;
          // 进入蓄力：立即确定本跳起止点（供蓄力阶段红色抛物线虚线预览真实轨迹）
          const startX = r.x;
          const startY = r.y;
          const endX = Math.max(jc.minX, Math.min(jc.maxX, startX + (Math.random() * 2 - 1) * jc.jumpX));
          // 向防线推进 jumpY，但不过防线底线
          const proposedEndY = startY + jc.jumpY;
          const endY = proposedEndY > defenseLineY - 8 ? defenseLineY - 8 : proposedEndY;
          r.jumpStartX = startX;
          r.jumpStartY = startY;
          r.jumpEndX = endX;
          r.jumpEndY = endY;
          r.jumpPhase = 'crouch';
          r.jumpTimer = jc.crouchTime;
          r.vx = 0; r.vy = 0;
        } else {
          // 正常行走
          r.vx = Math.cos(moveAngle) * effectiveSpeed * 65;
          r.vy = Math.sin(moveAngle) * effectiveSpeed * 65;
        }
        break;
      }
    }
  }

  // =========================================================================
  // 子方法：自爆引信检查
  // =========================================================================

  /** 检查自爆/飞行自爆蟑螂的引信状态。返回 true 表示已爆炸并移除 */
  private handleSuicideFuseCheck(r: Roach, i: number, defenseLineY: number, deltaTime: number): boolean {
    if (r.type !== RoachType.SUICIDE && r.type !== RoachType.FLYING_SUICIDE) return false;

    const distToDefense = defenseLineY - r.y;
    const fuseCfg = BALANCE_CONFIG.roachAI.suicideFuse;
    const fuseTriggerDist = (r.type === RoachType.FLYING_SUICIDE) ? fuseCfg.flyingTriggerDist : fuseCfg.groundTriggerDist;
    if (distToDefense >= fuseTriggerDist) return false;

    r.isFused = true;
    r.fuseTimer -= deltaTime;
    if (Math.random() < fuseCfg.sparkChance) {
      this.cfg.particles.push({
        x: r.x + (Math.random() - 0.5) * 10,
        y: r.y + (Math.random() - 0.5) * 10,
        vx: 0, vy: -20,
        life: 0.3, maxLife: 0.3,
        size: 3, color: TEXT_CONFIG.combat.bigExplosion.color,
        type: ParticleType.SPARK,
      });
    }
    if (r.fuseTimer <= 0) {
      this.suicideExplode(r, i);
      return true;
    }
    return false;
  }

  // =========================================================================
  // 子方法：女王召唤小兵
  // =========================================================================

  /** 处理女王蟑螂召唤小兵 */
  private handleQueenSpawnMinions(r: Roach, deltaTime: number): void {
    const bossBattle = this.cfg.bossSystem.bossBattle;
    if (r.type !== RoachType.QUEEN || (bossBattle.active && r.isBoss)) return;

    r.spawnTimer -= deltaTime;
    if (r.spawnTimer <= 0) {
      r.spawnTimer = BOSS_CONFIG.queen.spawnInterval;
      for (let m = 0; m < BOSS_CONFIG.queen.minionCount; m++) {
        this.cfg.onSpawnRoach(RoachType.SMALL);
      }
      this.cfg.onAddFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.queenSummon.text, TEXT_CONFIG.combat.queenSummon.color);
    }
  }

  // =========================================================================
  // 子方法：火焰闪避触发
  // =========================================================================

  /** 处理自爆/定时自爆/小蟑螂/狂暴大蟑螂在火焰中触发闪避（定时自爆与自爆蟑螂数值相同：suicideDuration） */
  private handleFireDodgeTriggers(r: Roach, _roaches: Roach[]): void {
    const dodgeCfg = BALANCE_CONFIG.roachAI.dodge;

    // 闪避封锁期间：任何拥有闪避技能的蟑螂都不能触发闪避
    const canDodge = (r.dodgeBlockTimer ?? 0) <= 0;

    // Suicide / timed-suicide roach dodge in fire（数值共用 dodgeCfg.suicideDuration）
    if (canDodge && (r.type === RoachType.SUICIDE || r.type === RoachType.TIMED_SUICIDE) && r.inFire && !this.cfg.stickySystem.isStuckByBoard(r.id)) {
      if (r.dodgeDir === 0) {
        r.dodgeDir = Math.random() < 0.5 ? -1 : 1;
      }
      r.dodgeTimer = dodgeCfg.suicideDuration;
    }

    // Small roach dodge in fire
    if (canDodge && r.type === RoachType.SMALL && r.inFire && !this.cfg.stickySystem.isStuckByBoard(r.id)) {
      if (r.dodgeDir === 0) {
        r.dodgeDir = Math.random() < 0.5 ? -1 : 1;
      }
      if (r.isSplitChild) {
        r.dodgeTimer = dodgeCfg.splitChildMin + Math.random() * (dodgeCfg.splitChildMax - dodgeCfg.splitChildMin);
      } else {
        r.dodgeTimer = dodgeCfg.smallMin + Math.random() * (dodgeCfg.smallMax - dodgeCfg.smallMin);
      }
    }

    // 狂暴大蟑螂 dodge in fire（血量低于 50% 获得闪避属性）
    if (canDodge && r.type === RoachType.LARGE && r.berserk && r.inFire && !this.cfg.stickySystem.isStuckByBoard(r.id)) {
      if (r.dodgeDir === 0) {
        r.dodgeDir = Math.random() < 0.5 ? -1 : 1;
      }
      r.dodgeTimer = dodgeCfg.largeBerserkMin + Math.random() * (dodgeCfg.largeBerserkMax - dodgeCfg.largeBerserkMin);
    }
  }

  // =========================================================================
  // 子方法：燃烧与毒伤处理
  // =========================================================================

  /** 处理燃烧伤害和中毒持续伤害，并在血量归零时触发击杀 */
  private handleBurnAndPoisonDamage(r: Roach, i: number, roaches: Roach[], deltaTime: number, isHard: boolean): void {
    const particles = this.cfg.particles;

    // Apply burn damage
    // inFire 每帧由火焰束/火焰区域重新置位，此处统一在下一帧清除，
    // 避免火焰区域（只置 inFire、不加 burnDamage）导致 inFire 永久卡真、闪避行为不停触发
    if (r.inFire) {
      if (r.burnDamage > 0) {
        const dmg = r.burnDamage * deltaTime;
        this.cfg.onApplyDamageToRoach(r, dmg);
        this.cfg.onTraceBurnDamage?.(dmg); // 平衡采样：火焰实际输出
        r.burnDamage = 0;
        if (Math.random() < 0.3) {
          ParticleSpawner.spawnSmokeParticles(particles, r.x, r.y, 1);
        }
      }
      r.inFire = false;
    }

    // Poison DoT
    if (r.poisonTimer > 0 && !(r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0)) {
      r.hp -= r.poisonDamage * deltaTime;
      r.poisonTimer -= deltaTime;
      if (Math.random() < 0.2) {
        particles.push({
          x: r.x + (Math.random() - 0.5) * 15,
          y: r.y + (Math.random() - 0.5) * 15,
          vx: 0, vy: -10,
          life: 0.5, maxLife: 0.5,
          size: 4, color: TEXT_CONFIG.combat.fanActivate.color,
          type: ParticleType.POISON_CLOUD,
        });
      }
    }

    // Asphyxiation DoT（窒息持续伤害，杀虫剂/蟑螂贴板附加）
    if ((r.asphyxiationTimer ?? 0) > 0 && !(r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0)) {
      r.hp -= BALANCE_CONFIG.insecticide.suffocationDps * deltaTime;
    }

    if (r.hp <= 0) {
      this.killRoach(r, i, roaches, particles, isHard);
    }
  }

  // =========================================================================
  // 状态效果更新
  // =========================================================================

  private updateStatusEffects(r: Roach): void {
    const deltaTime = this.cfg.getDeltaTime();
    // 闪避封锁、虚弱、技能封锁计时器衰减
    if (r.dodgeBlockTimer !== undefined && r.dodgeBlockTimer > 0) {
      r.dodgeBlockTimer -= deltaTime;
      if (r.dodgeBlockTimer < 0) r.dodgeBlockTimer = 0;
    }
    if (r.weakenTimer !== undefined && r.weakenTimer > 0) {
      r.weakenTimer -= deltaTime;
      if (r.weakenTimer < 0) r.weakenTimer = 0;
    }
    if (r.skillBlockTimer !== undefined && r.skillBlockTimer > 0) {
      r.skillBlockTimer -= deltaTime;
      if (r.skillBlockTimer < 0) r.skillBlockTimer = 0;
    }
    // 窒息计时器衰减（杀虫剂/蟑螂贴板附加）
    if (r.asphyxiationTimer !== undefined && r.asphyxiationTimer > 0) {
      r.asphyxiationTimer -= deltaTime;
      if (r.asphyxiationTimer < 0) r.asphyxiationTimer = 0;
    }
    if (r.stunTimer > 0) {
      r.stunTimer -= deltaTime;
      if (r.stunTimer <= 0) {
        r.isStunned = false;
        r.speed = r.baseSpeed;  // 恢复麻痹后的速度
        if (r.isBoss && r.type === RoachType.QUEEN && this.cfg.bossSystem.bossBattle.active) {
          const homeX = r.homeX ?? this.cfg.getCanvasWidth() / 2;
          const homeY = r.homeY ?? this.cfg.getCanvasHeight() * 0.18;
          const dx = homeX - r.x;
          const dy = homeY - r.y;
          if (Math.sqrt(dx * dx + dy * dy) > 10) {
            r.returningHome = true;
          }
        }
      }
    }
    // 粘性投掷物减速恢复
    if (r.stuckTimer > 0) {
      r.stuckTimer -= deltaTime;
      if (r.stuckTimer <= 0) {
        r.speed = r.baseSpeed;  // 恢复减速后的速度
      }
    }
  }

  // =========================================================================
  // 护士治疗逻辑
  // =========================================================================

  private updateNurseHeal(r: Roach, roaches: Roach[]): void {
    if (r.type !== RoachType.NURSE || r.state !== RoachState.ALIVE) return;
    // 技能封锁期间：护士不能释放加血技能
    if ((r.skillBlockTimer ?? 0) > 0) return;

    const deltaTime = this.cfg.getDeltaTime();
    const healRange = 360;

    switch (r.healPhase) {
      case 'idle': {
        r.healTimer! -= deltaTime;
        if (r.healTimer! <= 0) {
          let hasWounded = false;
          for (const other of roaches) {
            if (other.id === r.id) continue;
            if (other.state !== RoachState.ALIVE) continue;
            if (other.type === RoachType.TIMED_SUICIDE) continue;
            const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
            if (d < healRange && other.hp < other.maxHp) {
              hasWounded = true;
              break;
            }
          }
          if (hasWounded) {
            r.healPhase = 'charging';
            r.healPhaseTimer = 1.0;
            this.cfg.audio.playNurseCast();
            this.cfg.onAddFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.nurseCasting.text, TEXT_CONFIG.combat.nurseCasting.color, 1500);
    this.cfg.onAddFloatingText(r.x, r.y - 60, TEXT_CONFIG.combat.nurseIllegal.text, TEXT_CONFIG.combat.nurseIllegal.color);
          } else {
            r.healTimer! = 1;
          }
        }
        break;
      }

      case 'charging': {
        let healedCount = 0;
        for (const other of roaches) {
          if (other.id === r.id) continue;
          if (other.state !== RoachState.ALIVE) continue;
          if (other.type === RoachType.TIMED_SUICIDE) continue;
          const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
          if (d < healRange && other.hp < other.maxHp) {
            const healAmount = Math.floor(other.maxHp * 0.20);
            // 取整缺口血量，避免浮动文字出现长串小数
            const actualHeal = Math.min(healAmount, Math.round(other.maxHp - other.hp));
            if (actualHeal > 0) {
              other.hp += actualHeal;
              other.healBuffTimer = 2.0;
              healedCount++;
              this.cfg.onAddFloatingText(other.x, other.y - 30, TEXT_CONFIG.combat.nurseHeal.text(actualHeal), TEXT_CONFIG.combat.nurseHeal.color, 1200);
            }
          }
        }
        if (healedCount > 0) {
          this.cfg.onAddFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.nurseSpray.text, TEXT_CONFIG.combat.nurseSpray.color);
          this.cfg.audio.playNurseHealComplete(); // 治疗完成音效
        }

        r.healPhaseTimer! -= deltaTime;
        if (r.healPhaseTimer! <= 0) {
          r.healPhase = 'spraying';
          r.healPhaseTimer = 2.0;
        }
        break;
      }

      case 'spraying': {
        r.healPhaseTimer! -= deltaTime;
        if (r.healPhaseTimer! <= 0) {
          r.healPhase = 'dissipating';
          r.healPhaseTimer = 1.0;
        }
        break;
      }

      case 'dissipating': {
        r.healPhaseTimer! -= deltaTime;
        if (r.healPhaseTimer! <= 0) {
          r.healPhase = 'idle';
          r.healTimer = 1;
        }
        break;
      }
    }

    // Track heal target
    let bestTarget: Roach | null = null;
    let bestHpRatio = 1.0;
    for (const other of roaches) {
      if (other.id === r.id) continue;
      if (other.state !== RoachState.ALIVE) continue;
      if (other.type === RoachType.TIMED_SUICIDE) continue;
      const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
      if (d < healRange && other.hp < other.maxHp) {
        const hpRatio = other.hp / other.maxHp;
        if (hpRatio < bestHpRatio) {
          bestHpRatio = hpRatio;
          bestTarget = other;
        }
      }
    }
    r.healTargetId = bestTarget ? bestTarget.id : null;
  }

  // =========================================================================
  // 地铁场景：隧道工蟑螂 AI（护甲喷涂）
  // =========================================================================

  /**
   * 隧道工蟑螂：
   * 护甲喷涂 —— 每 6 秒为范围 200px 内血量最高的其他蟑螂 +150 护甲
   */
  private updateTunnelWorker(r: Roach, roaches: Roach[]): void {
    if (r.type !== RoachType.TUNNEL_WORKER || r.state !== RoachState.ALIVE) return;
    // 技能封锁期间：工程蟑螂不能释放修复护盾和增加护甲技能
    if ((r.skillBlockTimer ?? 0) > 0) return;

    const deltaTime = this.cfg.getDeltaTime();
    const subCfg = BALANCE_CONFIG.subway;

    // ===== 施法光圈脉冲计时衰减 =====
    if (r.armorSprayCastTimer !== undefined && r.armorSprayCastTimer > 0) {
      r.armorSprayCastTimer -= deltaTime;
    }

    // ===== 护甲喷涂 =====
    r.armorSprayTimer = (r.armorSprayTimer ?? subCfg.armorSprayInterval) - deltaTime;
    if (r.armorSprayTimer <= 0) {
      r.armorSprayTimer = subCfg.armorSprayInterval;
      // 范围内血量最高的若干只其他蟑螂（隧道工不喷自己；不可给护盾蟑螂添加护甲）
      const targets: Roach[] = [];
      for (const other of roaches) {
        if (other.id === r.id) continue;
        if (other.state !== RoachState.ALIVE) continue;
        if (other.type === RoachType.SHIELD) continue; // 护盾蟑螂自带气体护盾，免疫护甲喷涂
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        if (dx * dx + dy * dy > subCfg.armorSprayRange * subCfg.armorSprayRange) continue;
        targets.push(other);
      }
      // 按血量从高到低排序，取前 N 只（armorSprayTargets，默认 3）；无目标则本次施法空放
      targets.sort((a, b) => b.hp - a.hp);
      const armoredTargets = targets.slice(0, subCfg.armorSprayTargets ?? 3);
      if (armoredTargets.length > 0) {
        // 施法一次性触发一次公共表现（光圈/施法音效/头顶提示）
        r.armorSprayCastTimer = BALANCE_CONFIG.render.roach.armorCastRing.duration; // 触发施法范围光圈脉冲
        this.cfg.onAddFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.armorSpray.text, TEXT_CONFIG.combat.armorSpray.color);
        this.cfg.audio.playEngineerCast(); // 工程师施法音效
        for (const best of armoredTargets) {
          best.armorHp += subCfg.armorSprayAmount;
          best.maxArmorHp = Math.max(best.maxArmorHp, best.armorHp);
          this.cfg.onAddFloatingText(best.x, best.y - 40, `+${subCfg.armorSprayAmount}`, TEXT_CONFIG.combat.armorSpray.color, 1000);
          this.cfg.audio.playArmorGain();    // 目标获得护甲音效
          // 灰色喷涂喷射流粒子（隧道工 → 目标）
          ParticleSpawner.spawnArmorSprayStream(this.cfg.particles, r.x, r.y, best.x, best.y);
          // 目标头顶蓝色+号：2 秒 buff 内每 0.5 秒生成 1 枚（由主循环统一生成）
          best.armorBuffTimer = BALANCE_CONFIG.particle.armorSpray.plusBuffDuration;
          best.armorPlusTimer = 0;
        }
      }
    }

    // ===== 跟随修理护盾（25/s，射程 150px，仅修完好未破碎的护盾） =====
    r.shieldRepairTextTimer = Math.max(0, (r.shieldRepairTextTimer ?? 0) - deltaTime);
    r.shieldRepairPlusTimer = Math.max(0, (r.shieldRepairPlusTimer ?? 0) - deltaTime);
    const followTarget = r.shieldFollowTargetId != null
      ? roaches.find(o => o.id === r.shieldFollowTargetId && o.state === RoachState.ALIVE && o.type === RoachType.SHIELD)
      : undefined;
    if (followTarget && (followTarget.shieldBrokenTimer ?? 0) <= 0) {
      const dx = followTarget.x - r.x;
      const dy = followTarget.y - r.y;
      const maxShield = followTarget.maxShieldHp ?? subCfg.shieldMaxHp;
      if (dx * dx + dy * dy <= subCfg.shieldRepairRange * subCfg.shieldRepairRange
        && (followTarget.shieldHp ?? 0) < maxShield) {
        followTarget.shieldHp = Math.min(maxShield, (followTarget.shieldHp ?? 0) + subCfg.shieldRepairPerSec * deltaTime);
        followTarget.shieldHitFlash = 0.15; // 修理激活视觉（护盾增亮）
        // 被修理的护盾蟑螂身上修盾上升粒子（每帧循环生成，lighter 叠加）
        ParticleSpawner.spawnShieldRepairWorkerParticles(this.cfg.particles, followTarget.x, followTarget.y);
        // 护盾蟑螂头顶+号粒子（节流生成）
        if ((r.shieldRepairPlusTimer ?? 0) <= 0) {
          r.shieldRepairPlusTimer = BALANCE_CONFIG.particle.shieldRepair.shieldPlus.interval;
          ParticleSpawner.spawnShieldRepairPlus(this.cfg.particles, followTarget.x, followTarget.y);
        }
        // 修盾浮动文字（2s 节流）
        if ((r.shieldRepairTextTimer ?? 0) <= 0) {
          r.shieldRepairTextTimer = 2;
          this.cfg.onAddFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.shieldRepair.text, TEXT_CONFIG.combat.shieldRepair.color);
        }
      }
    }
  }

  // =========================================================================
  // 地铁场景：地铁蟑螂精英 AI（轨道冲刺）
  // =========================================================================

  /**
   * 地铁蟑螂精英：
   * 1. 出场 2 秒后沿铁轨横向高速冲刺（无视蟑螂贴板定身）
   * 2. 冲刺可被火墙 / 风扇打断（回到普通移动状态，不再冲刺）
   * 3. 冲至屏幕边缘停止，恢复普通移动
   * 4. 被列车碾压后分裂为 2 只小蟑螂（由引擎击杀管线按 killedByTrain 处理）
   */
  private updateSubwayElite(r: Roach, fireWalls: FireWall[]): void {
    if (r.type !== RoachType.SUBWAY_ELITE || r.state !== RoachState.ALIVE) return;

    const deltaTime = this.cfg.getDeltaTime();
    const subCfg = BALANCE_CONFIG.subway;

    if (r.chargeState === 'idle') {
      r.chargeDelayTimer = (r.chargeDelayTimer ?? subCfg.eliteChargeDelay) - deltaTime;
      if (r.chargeDelayTimer <= 0) {
        // 进入冲刺：朝较远一侧屏幕边缘冲（最大化铁轨横扫距离）
        const canvasWidth = this.cfg.getCanvasWidth();
        r.chargeState = 'charge';
        r.chargeDir = r.x < canvasWidth / 2 ? 1 : -1;
        this.cfg.onAddFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.eliteCharge.text, TEXT_CONFIG.combat.eliteCharge.color);
      }
      return;
    }

    if (r.chargeState === 'charge') {
      // ===== 打断判定：火墙 =====
      for (const wall of fireWalls) {
        if (r.x >= wall.x1 && r.x <= wall.x2) {
          const wallTop = wall.y - wall.height * 0.5;
          if (r.y > wallTop && r.y < wallTop + wall.height + 5) {
            r.chargeState = 'broken';
            this.cfg.onAddFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.eliteBroken.text, TEXT_CONFIG.combat.eliteBroken.color);
            return;
          }
        }
      }
      // ===== 打断判定：风扇（减速或向上推力生效中） =====
      if (r.fanSlowTimer > 0 || r.fanPushY < 0) {
        r.chargeState = 'broken';
        this.cfg.onAddFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.eliteBroken.text, TEXT_CONFIG.combat.eliteBroken.color);
        return;
      }
      // ===== 到达屏幕边缘：停止冲刺，永久转普通移动（不再重复冲刺，避免在边界往返卡住） =====
      // 注意：边界余量必须与 applyRoachMovement 的 Clamp X 一致（max(40, size*0.8)），
      // 否则精英会被位移钳制停在 edgeMargin 处，永远触达不到更小的冲刺边缘检测值，导致 chargeState 卡在 'charge'
      const canvasWidth = this.cfg.getCanvasWidth();
      const roachSize = r.size ?? ENEMY_DEFS[r.type].size;
      const edgeMargin = Math.max(40, roachSize * 0.8);
      if ((r.chargeDir === -1 && r.x <= edgeMargin + 1) || (r.chargeDir === 1 && r.x >= canvasWidth - edgeMargin - 1)) {
        // 置为 broken：冲刺已结束，此后按飞行类普通移动移向防线
        r.chargeState = 'broken';
        r.chargeDir = 0;
        // 强制向内推离边界，避免贴着边缘抖动
        r.x = Math.max(edgeMargin + 2, Math.min(canvasWidth - edgeMargin - 2, r.x));
      }
    }
  }

  // =========================================================================
  // 定时自爆突破系统
  // =========================================================================

  private updateTimedSuicideBreach(r: Roach, _i: number, _roaches: Roach[], defenseLineY: number, _isHard: boolean): void {
    if (r.type !== RoachType.TIMED_SUICIDE || r.state !== RoachState.ALIVE) return;

    const deltaTime = this.cfg.getDeltaTime();
    const dl = defenseLineY;
    const distToDefense = dl - r.y;
    const tCfg = BALANCE_CONFIG.roachAI.timedBreach;

    if (!r.breachPhase) r.breachPhase = 'idle';

    // Branch B: Flame killed (bomb placement failed)
    if (r.hp <= 0 && r.breachPhase !== 'idle') {
      r.isFlameKilled = true;
      r.state = RoachState.DEAD;
      r.deathTimer = tCfg.deathTimer;
      r.breachPhase = 'residue';
      r.residueTimer = tCfg.residueTimer;
      this.cfg.onAddFloatingText(r.x, r.y - 30, TEXT_CONFIG.combat.bombFailed.text, TEXT_CONFIG.combat.bombFailed.color);
      return;
    }

    // Branch A: Sticky board frozen
    if (r.stuckTimer > 0 && r.breachPhase !== 'idle') {
      r.isFrozen = true;
      return;
    } else {
      r.isFrozen = false;
    }

    // Phase transition: start approaching
    if (r.breachPhase === 'idle' && distToDefense <= tCfg.approachDist) {
      r.breachPhase = 'warning';
      r.breachPhaseTimer = tCfg.warningTimer;
      r.crackRadius = 0;
    }

    switch (r.breachPhase) {
      case 'warning': {
        r.speed = r.baseSpeed * tCfg.warningSpeedMult;
        if (distToDefense <= tCfg.placeDistance) {
          // Place the timed bomb on the defense line
          const placeY = dl - BALANCE_CONFIG.roachAI.bombPlacementDistance;
          r.hasPlacedBomb = true;
          this.cfg.placedBombs.push({
            id: r.id, x: r.x, y: placeY, timer: tCfg.bombTimer,
          });
          this.cfg.onAddFloatingText(r.x, placeY - 30, TEXT_CONFIG.combat.bombPlaced.text, TEXT_CONFIG.combat.bombPlaced.color);

          // Spawn placement particles
          const particles = this.cfg.particles;
          for (let p = 0; p < 8; p++) {
            const angle = (p / 8) * Math.PI * 2;
            const speed = 30 + Math.random() * 40;
            particles.push({
              x: r.x, y: r.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 20,
              life: 0.5, maxLife: 0.5,
              size: 3 + Math.random() * 4,
              color: `rgba(200, 150, 50, 0.7)`,
              type: ParticleType.SPARK,
            });
          }

          // Transform into large cockroach with same properties
          r.type = RoachType.LARGE;
          r.size = ENEMY_DEFS[RoachType.LARGE].size;
          r.speed = ENEMY_DEFS[RoachType.LARGE].speed;
          r.baseSpeed = ENEMY_DEFS[RoachType.LARGE].speed;
          // Reset breach state so the roach continues as a normal large roach
          r.breachPhase = undefined;
          r.placeTimer = undefined;
          this.cfg.onAddFloatingText(r.x, r.y - 45, TEXT_CONFIG.combat.transformBig.text, TEXT_CONFIG.combat.transformBig.color);
        }
        break;
      }

      case 'residue': {
        r.residueTimer! -= deltaTime;
        if (r.residueTimer! <= 0) {
          r.deathTimer = 0;
        }
        break;
      }
    }
  }

  // =========================================================================
  // 自爆爆炸（统一入口）
  // =========================================================================

  /**
   * 自爆爆炸（引信触发）
   * @description 引信倒计时归零时调用，会从数组中移除蟑螂
   */
  suicideExplode(r: Roach, index: number): void {
    this.performSuicideExplosion(r, index);
  }

  /**
   * 自杀死亡爆炸（被击杀时触发）
   * @description 不会从数组中移除蟑螂（由 killRoach 管理生命周期）
   */
  suicideDeathExplode(r: Roach): void {
    if (r._deathExploded) return;
    r._deathExploded = true;
    this.performSuicideExplosion(r);
  }

  /**
   * 执行自爆爆炸（合并 suicideExplode 和 suicideDeathExplode 的公共逻辑）
   * @param r 蟑螂实例
   * @param spliceIndex 从数组中移除的索引（undefined 表示不移除，用于死亡爆炸）
   */
  private performSuicideExplosion(r: Roach, spliceIndex?: number): void {
    const roaches = this.cfg.roaches;
    const particles = this.cfg.particles;
    const isFuseTriggered = spliceIndex !== undefined;

    // 引信触发：从数组中移除蟑螂
    if (isFuseTriggered) {
      roaches.splice(spliceIndex!, 1);
    }

    this.cfg.audio.playSuicideExplode();
    Vibration.vibrateSuicideExplode();

    const cfg = BALANCE_CONFIG.roachAI.suicideExplosion;
    const explodeRadius = cfg.radius;
    const explodeRadiusSq = explodeRadius * explodeRadius;

    ParticleSpawner.spawnExplosionParticles(particles, r.x, r.y, cfg.explosionParticles);
    ParticleSpawner.spawnSmokeParticles(particles, r.x, r.y, cfg.smokeParticles);
    ParticleSpawner.spawnDebrisParticles(particles, r.x, r.y, cfg.debrisParticles);
    ParticleSpawner.spawnSparkParticles(particles, r.x, r.y, cfg.sparkParticles);
    ParticleSpawner.spawnFireRingParticles(particles, r.x, r.y, cfg.fireRingParticles);
    this.cfg.setScreenShake(cfg.screenShake);

    let hitCount = 0;
    for (const other of roaches) {
      if (other.state !== RoachState.ALIVE || other.isBoss) continue;
      const dx = other.x - r.x;
      const dy = other.y - r.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < explodeRadiusSq) {
        const dist = Math.sqrt(distSq);
        const dmg = cfg.damage * (1 - dist / explodeRadius);
        other.hp -= dmg;
        other.burnDamage = dmg * 2;
        other.damageFlash = (other.armorHp > 0) ? 0 : 2;
        other.inFire = true;
        hitCount++;
        if (other.hp <= 0 && this._deathChainDepth < this.MAX_DEATH_CHAIN_DEPTH) {
          const otherIndex = roaches.findIndex(rr => rr.id === other.id);
          this.killRoach(other, otherIndex, roaches, particles, this.cfg.getDifficulty() === 'hard');
        }
      }
    }

    // 防线伤害判定
    const defenseLineY = this.cfg.getDefenseLineY();
    const roachSize = ENEMY_DEFS[r.type].size;
    const roachBottom = r.y + roachSize * 0.4;
    const defenseDamageRange = (r.type === RoachType.FLYING_SUICIDE)
      ? cfg.defenseDamageRangeFlying : cfg.defenseDamageRange;
    if (roachBottom > defenseLineY - defenseDamageRange) {
      const dmg = this.cfg.getDifficulty() === 'hard'
        ? cfg.defenseDamage.hard : cfg.defenseDamage.easy;
      if (this.cfg.player.shieldTimer > 0) {
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
      } else {
        const newHp = this.cfg.getDefenseHp() - dmg;
        this.cfg.setDefenseHp(newHp);
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, TEXT_CONFIG.combat.suicideDamage.text(dmg), TEXT_CONFIG.combat.suicideDamage.color);
      }
      if (r.type === RoachType.FLYING_SUICIDE) {
        this.cfg.audio.playSuicideBreachFlying();
      } else {
        this.cfg.audio.playSuicideBreachGround();
      }
      if (isFuseTriggered && this.cfg.getDefenseHp() <= 0) {
        this.handleDefenseBreachGameOver();
        return;
      }
    }

    // 浮动文字
    this.cfg.onAddFloatingText(
      r.x, r.y - 30,
      hitCount > 0
        ? (isFuseTriggered ? TEXT_CONFIG.combat.bigExplosion.text(hitCount) : TEXT_CONFIG.combat.deathExplosion.text(hitCount))
        : (isFuseTriggered ? '大爆炸!' : '死亡爆炸!'),
      TEXT_CONFIG.combat.bigExplosion.color
    );
  }

  // =========================================================================
  // 定时自爆爆炸
  // =========================================================================

  triggerBreachExplosion(r: Roach, roaches: Roach[]): void {
    if (this._deathChainDepth >= this.MAX_DEATH_CHAIN_DEPTH) return;
    this._deathChainDepth++;

    try {
      const particles = this.cfg.particles;
      const cfg = BALANCE_CONFIG.roachAI.breachExplosion;
      const bombCfg = BALANCE_CONFIG.roachAI;

      ParticleSpawner.spawnExplosionParticles(particles, r.x, r.y, cfg.explosionParticles);
      ParticleSpawner.spawnFireRingParticles(particles, r.x, r.y, cfg.fireRingParticles);
      ParticleSpawner.spawnSmokeParticles(particles, r.x, r.y, cfg.smokeParticles);

      for (let fi = 0; fi < cfg.ringCount; fi++) {
        particles.push({
          x: r.x + (Math.random() - 0.5) * 30,
          y: r.y + (Math.random() - 0.5) * 20,
          vx: 0, vy: 0,
          life: 0.2 + fi * 0.1, maxLife: 0.2 + fi * 0.1,
          size: 60 + fi * 30,
          color: `rgba(${255}, ${180 - fi * 40}, ${50 - fi * 20}, ${0.5 - fi * 0.1})`,
          type: ParticleType.EXPLOSION,
        });
      }

      for (let d = 0; d < cfg.debrisCount; d++) {
        const angle = (d / cfg.debrisCount) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 100 + Math.random() * 150;
        particles.push({
          x: r.x, y: r.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 30,
          life: 0.8 + Math.random() * 0.5,
          maxLife: 1.3,
          size: 3 + Math.random() * 6,
          color: `rgba(${200 + Math.floor(Math.random() * 55)}, ${100 + Math.floor(Math.random() * 80)}, 0, 0.9)`,
          type: ParticleType.ASH,
        });
      }

      this.cfg.setScreenShake(cfg.screenShake);
      this.cfg.audio.playTimedBombExplode();
      Vibration.vibrateDamage();

      for (const other of roaches) {
        if (other.state !== RoachState.ALIVE || other.id === r.id) continue;
        const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
        if (d < bombCfg.bombExplosionRadius) {
          const dmg = bombCfg.bombDamage * (1 - d / bombCfg.bombExplosionRadius);
          other.hp -= dmg;
          other.burnDamage = dmg * 2;
          other.inFire = true;
          if (other.hp <= 0 && this._deathChainDepth < this.MAX_DEATH_CHAIN_DEPTH) {
            other.hp = 0;
            other.state = RoachState.DEAD;
            other.deathTimer = 1.5;
            const otherIndex = roaches.findIndex(rr => rr.id === other.id);
            this.killRoach(other, otherIndex, roaches, particles, this.cfg.getDifficulty() === 'hard');
          }
        }
      }

      const defenseLineY = this.cfg.getDefenseLineY();
      const defDmg = this.cfg.getDifficulty() === 'hard'
        ? bombCfg.bombDefenseDamage.hard : bombCfg.bombDefenseDamage.easy;
      if (this.cfg.player.shieldTimer > 0) {
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
      } else {
        const newHp = this.cfg.getDefenseHp() - defDmg;
        this.cfg.setDefenseHp(newHp);
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, TEXT_CONFIG.combat.bombExplode.text(defDmg), TEXT_CONFIG.combat.bombExplode.color);
      }

      this.cfg.onAddFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.boom.text, TEXT_CONFIG.combat.boom.color);
    } finally {
      this._deathChainDepth--;
    }
  }

  // =========================================================================
  // 防线突破 → 游戏结束
  // =========================================================================

  private handleDefenseBreachGameOver(): void {
    this.cfg.setDefenseHp(0);
    Vibration.vibrateGameOver();
    const economy = this.cfg.economy;
    const wave = this.cfg.getWave();
    economy.money = 0;
    this.cfg.setState(GameState.GAME_OVER);
    this.cfg.audio.stopBGM();
    this.cfg.audio.stopFire();
    this.cfg.audio.stopFanLoop();
    this.cfg.audio.stopFireWallBurn();
    this.cfg.audio.stopFlyingBuzzLoop();
    economy.highestWave = Math.max(economy.highestWave, wave);
    this.cfg.onEconomyUpdate(economy);
    this.cfg.progress.highestWave = Math.max(this.cfg.progress.highestWave, wave);
    this.cfg.progress.totalKills += economy.totalKills;
    this.cfg.onSaveProgress();
    this.cfg.onGameOver(economy, wave);
    this.cfg.onStateChange(GameState.GAME_OVER);
  }

  // =========================================================================
  // 击杀蟑螂
  // =========================================================================

  killRoach(r: Roach, _index: number, roaches: Roach[], particles: Particle[], isHard: boolean): void {
    if (this._deathChainDepth === 0) {
      this._deathChainDepth = 1;
    }

    // Suicide roaches: explode on death
    if (r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) {
      this.suicideDeathExplode(r);
    }

    // Mutant roach: embryo burst
    if (r.type === RoachType.MUTANT) {
      this.forceEmbryoBurst(r);
    }

    r.state = RoachState.DEAD;
    r.deathTimer = r.type === RoachType.MUTANT ? 2.0 : 0.6;

    // Clean up sticky drop
    this.cfg.stickySystem.cleanupRoachDeath(r);

    // Flying roach death
    if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
      this.cfg.audio.playFlyingDeath();
      const anyFlyingAlive = roaches.some(
        ro => (ro.type === RoachType.FLYING || ro.type === RoachType.FLYING_SUICIDE) && ro.state === RoachState.ALIVE
      );
      if (!anyFlyingAlive) {
        this.cfg.audio.stopFlyingBuzzLoop();
      }
    }

    // Splitting roach
    if (r.type === RoachType.SPLITTING && !r.hasSplit) {
      const splitCfg = BALANCE_CONFIG.roachAI.split;
      r.hasSplit = true;
      r.deathTimer = splitCfg.deathTimer;
      for (let s = 0; s < splitCfg.count; s++) {
        const angle = (s / splitCfg.count) * Math.PI * 2;
        const spawnX = r.x + Math.cos(angle) * splitCfg.spawnRadius;
        const spawnY = r.y + Math.sin(angle) * splitCfg.spawnRadius * 0.6;
        const small: Roach = {
          ...this.createSmallRoachFromSplit(spawnX, spawnY),
          id: this.cfg.getNextId(),
        };
        roaches.push(small);
      }
      this.cfg.onAddFloatingText(r.x, r.y - 30, TEXT_CONFIG.combat.splitSpawn.text, TEXT_CONFIG.combat.splitSpawn.color);
    }

    // Flying roach disintegrate
    if (r.type === RoachType.FLYING) {
      const flyDeathCfg = BALANCE_CONFIG.roachAI.flyingDeath;
      r.deathTimer = flyDeathCfg.deathTimer;
      for (let w = 0; w < flyDeathCfg.wingParticles; w++) {
        const wingAngle = (w / flyDeathCfg.wingParticles) * Math.PI * 2;
        const wingSpeed = 60 + Math.random() * 100;
        particles.push({
          x: r.x + (Math.random() - 0.5) * 20,
          y: r.y + (Math.random() - 0.5) * 15,
          vx: Math.cos(wingAngle) * wingSpeed + (Math.random() - 0.5) * 40,
          vy: Math.sin(wingAngle) * wingSpeed * 0.5 - 30 - Math.random() * 40,
          life: 1.5 + Math.random(),
          maxLife: 1.5 + Math.random(),
          size: 3 + Math.random() * 8,
          color: `rgba(${140 + Math.random() * 60}, ${160 + Math.random() * 60}, ${180 + Math.random() * 50}, 0.8)`,
          type: ParticleType.ICE,
        });
      }
      for (let b = 0; b < flyDeathCfg.debrisParticles; b++) {
        const debrisAngle = Math.random() * Math.PI * 2;
        const debrisSpeed = 30 + Math.random() * 80;
        particles.push({
          x: r.x + (Math.random() - 0.5) * 15,
          y: r.y + (Math.random() - 0.5) * 10,
          vx: Math.cos(debrisAngle) * debrisSpeed,
          vy: Math.sin(debrisAngle) * debrisSpeed * 0.3 - 20,
          life: 2 + Math.random(),
          maxLife: 2 + Math.random(),
          size: 2 + Math.random() * 6,
          color: `rgba(${30 + Math.random() * 30}, ${30 + Math.random() * 30}, ${35 + Math.random() * 25}, 0.7)`,
          type: ParticleType.ASH,
        });
      }
      ParticleSpawner.spawnSparkParticles(particles, r.x, r.y, flyDeathCfg.sparkParticles);
      this.cfg.onAddFloatingText(r.x, r.y - 20, TEXT_CONFIG.combat.disintegrate.text, TEXT_CONFIG.combat.disintegrate.color);
    }

    this.cfg.audio.playKill();
    Vibration.vibrateKill();
    const dpCfg = BALANCE_CONFIG.roachAI.deathParticles;
    const dp = r.type === RoachType.QUEEN ? dpCfg.queen : (r.type === RoachType.LARGE ? dpCfg.large : dpCfg.default);
    ParticleSpawner.spawnAshParticles(particles, r.x, r.y, dp.ash);
    ParticleSpawner.spawnSparkParticles(particles, r.x, r.y, dp.spark);
    ParticleSpawner.spawnBloodParticles(particles, r.x, r.y, dp.blood);

    const sceneMult = this.cfg.getSceneConfig().rewardMultiplier;
    const rewardMult = (this.cfg.getTalentMultipliers().rewardMultiplier || 1) * sceneMult;
    let reward = Math.floor((r.reward ?? ENEMY_DEFS[r.type].reward) * rewardMult);
    if (isHard) reward = Math.floor(reward * 0.8);

    const economy = this.cfg.economy;
    switch (r.type) {
      case RoachType.SMALL: economy.smallKills++; break;
      case RoachType.LARGE: economy.largeKills++; break;
      case RoachType.FLYING: economy.flyingKills++; break;
      case RoachType.ARMORED: economy.armoredKills++; break;
      case RoachType.SPLITTING: economy.splittingKills++; break;
      case RoachType.SUICIDE: economy.suicideKills++; break;
      case RoachType.FLYING_SUICIDE: economy.suicideKills++; break;
      case RoachType.QUEEN: economy.queenKills++; break;
      case RoachType.NURSE: break;
      case RoachType.MUTANT: break;
      case RoachType.TUNNEL_WORKER: economy.tunnelWorkerKills++; break;
      case RoachType.SUBWAY_ELITE: economy.subwayEliteKills++; break;
      case RoachType.SHIELD: economy.shieldKills++; break;
      case RoachType.JOCK: economy.jockKills++; break;
    }

    // Update encyclopedia
    if (this.cfg.progress.encyclopedia?.entries) {
      const entry = this.cfg.progress.encyclopedia.entries.find(e => e.type === r.type);
      if (entry) {
        entry.killCount = (entry.killCount || 0) + 1;
        entry.unlocked = true;
      }
    }

    // Boss minion death backlash
    const bossBattle = this.cfg.bossSystem.bossBattle;
    if (bossBattle.active && bossBattle.phase === 1 && !r.isBoss) {
      const boss = roaches.find(br => br.type === RoachType.QUEEN && br.state === RoachState.ALIVE && br.isBoss);
      if (boss && boss.hp > 0) {
        const backlashCfg = BALANCE_CONFIG.roachAI.bossBacklash;
        const backlashDmg = backlashCfg[r.type as keyof typeof backlashCfg] ?? 0;
        if (backlashDmg > 0) {
          boss.hp -= backlashDmg;
          this.cfg.onAddFloatingText(boss.x + (Math.random() - 0.5) * 40, boss.y - 30, TEXT_CONFIG.combat.backlash.text(backlashDmg), TEXT_CONFIG.combat.backlash.color);
          boss.damageFlash = 1;
          for (let k = 0; k < 3; k++) {
            particles.push({
              x: boss.x + (Math.random() - 0.5) * 60,
              y: boss.y + (Math.random() - 0.5) * 60,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60 - 30,
              life: 0.6, maxLife: 0.6,
              size: 4, color: TEXT_CONFIG.combat.backlash.color,
              type: ParticleType.SPARK,
            });
          }
        }
      }
    }

    economy.totalKills++;
    this.cfg.onAddPendingReward(reward);
    this.cfg.onAddFloatingText(r.x, r.y - 20, TEXT_CONFIG.combat.killReward.text(reward), TEXT_CONFIG.combat.killReward.color);
    this.cfg.setScreenShake(r.isBoss ? BALANCE_CONFIG.screenShake.bossDeath : (r.type === RoachType.LARGE ? BALANCE_CONFIG.screenShake.largeExplosion : BALANCE_CONFIG.screenShake.smallExplosion));

    // Boss death
    if (r.isBoss) {
      this.cfg.bossSystem.activeBosses--;
      this.cfg.onAddFloatingText(this.cfg.getCanvasWidth() / 2, this.cfg.getCanvasHeight() / 2, TEXT_CONFIG.combat.bossDefeated.text, TEXT_CONFIG.combat.bossDefeated.color);
      for (const other of roaches) {
        if (other.state === RoachState.ALIVE && other.id !== r.id) {
          other.hp = 0;
        }
      }
    }

    // Timed suicide dead body bomb
    if (r.type === RoachType.TIMED_SUICIDE && !r.hasPlacedBomb) {
      this.cfg.deadTimedBombs.push({
        id: this._nextBombId++,
        x: r.x,
        y: r.y,
        timer: 3.0,
        flashPhase: 0,
      });
      this.cfg.onAddFloatingText(r.x, r.y - 40, TEXT_CONFIG.combat.corpseBomb.text(3), TEXT_CONFIG.combat.corpseBomb.color);
      this.cfg.audio.playTimedBombDrop();
    }

    this.cfg.onEconomyUpdate(economy);
  }

  // =========================================================================
  // 分裂蟑螂子体创建
  // =========================================================================

  createSmallRoachFromSplit(x: number, y: number): Roach {
    const isHard = this.cfg.getDifficulty() === 'hard';
    return {
      id: 0, x, y, vx: 0, vy: 0,
      type: RoachType.SMALL,
      hp: isHard ? 1 : 1,
      maxHp: isHard ? 1 : 1,
      state: RoachState.ALIVE,
      speed: (isHard ? 2.4 : 1.6) * (0.5 + Math.random() * 0.5),
      baseSpeed: isHard ? 2.4 : 1.6,
      burnDamage: 0, inFire: false,
      angle: 0, wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 2 + Math.random() * 2,
      isEnraged: false, deathTimer: 0, animFrame: 0, animTimer: 0,
      panicTimer: 0, panicAngle: 0, stunTimer: 0, isStunned: false,
      facingRight: true,
      altitude: 0, wingPhase: 0, armorHp: 0, maxArmorHp: 0,
      hasSplit: false, fuseTimer: 0, isFused: false,
      spawnTimer: 0, isBoss: false, isCharging: false,
      stuckTimer: 0, poisonTimer: 0, poisonDamage: 0,
      fanSlowTimer: 0, fanSlowFactor: 0, fanPushY: 0,
      wrappedByDropId: null, wrapTimer: 0, damageFlash: 0,
      dodgeDir: 0, dodgeTimer: 0, wasDodging: false,
      isSplitChild: true,
      dodgeBlockTimer: 0, weakenTimer: 0, skillBlockTimer: 0,
    };
  }

  // =========================================================================
  // 变异胚胎暴走
  // =========================================================================

  forceEmbryoBurst(r: Roach): void {
    // Prevent double-call from both engine.ts killRoach and RoachAISystem killRoach
    if (r.hasTransformed) return;
    r.hasTransformed = true;

    const roll = Math.random();
    if (roll < 0.5) {
      r.transformSpawnTypes = [RoachType.SMALL, RoachType.SMALL];
    } else if (roll < 0.8) {
      r.transformSpawnTypes = [RoachType.SMALL, RoachType.FLYING];
    } else {
      r.transformSpawnTypes = [RoachType.SMALL, RoachType.SUICIDE];
    }

    // Per-roach transformation state (supports multiple simultaneous mutants)
    r.transformFrame = 0;
    r.transformTimer = 0.6;

    this.cfg.setScreenShake(12);
    this.cfg.audio.playMutantTransform();
    this.cfg.onAddFloatingText(r.x, r.y - 70, TEXT_CONFIG.combat.embryoBurst.text, TEXT_CONFIG.combat.embryoBurst.color, 2000);
    this.cfg.particles.push({
      x: r.x, y: r.y, vx: 0, vy: 0,
      life: 0.4, maxLife: 0.4,
      size: 120,
      color: 'rgba(255, 0, 64, 0.5)',
      type: ParticleType.EXPLOSION,
    });
  }

  spawnEmbryoRoaches(r: Roach): void {
    const sx = r.x;
    const sy = r.y;
    const roaches = this.cfg.roaches;
    const spawnTypes = r.transformSpawnTypes || [RoachType.SMALL, RoachType.SMALL];
    let spawnedCount = 0;

    for (let i = 0; i < spawnTypes.length; i++) {
      const spawnType = spawnTypes[i];

      const newRoach = this.cfg.onSpawnRoach(spawnType);
      if (!newRoach) break;
      spawnedCount++;

      newRoach.x = sx;
      newRoach.y = sy;
      newRoach.hp = ENEMY_DEFS[spawnType].hp;
      newRoach.maxHp = ENEMY_DEFS[spawnType].hp;
      newRoach.slimeTimer = 2.0;
      newRoach.wasMutantSpawn = true;
      newRoach.spawnImmuneTimer = 1.0;

      if (spawnType === RoachType.SUICIDE) {
        newRoach.size = Math.floor(ENEMY_DEFS[spawnType].size * 0.6);
        newRoach.hp = ENEMY_DEFS[spawnType].hp;
        newRoach.maxHp = ENEMY_DEFS[spawnType].hp;
        newRoach.fuseTimer = 3;
      }

      roaches.push(newRoach);

      const typeName = spawnType === RoachType.SMALL ? '小蟑螂' : spawnType === RoachType.FLYING ? '飞行蟑螂' : '自爆蟑螂';
      this.cfg.onAddFloatingText(newRoach.x, newRoach.y - 50, TEXT_CONFIG.combat.spawnBirth.text(typeName), TEXT_CONFIG.combat.spawnBirth.color, 1500);
    }

    this.slimeBurstTimer = 1.2;
    this.slimeBurstX = sx;
    this.slimeBurstY = sy;

    this.cfg.onAddFloatingText(sx, sy - 40, TEXT_CONFIG.combat.spawnCount.text(spawnedCount), TEXT_CONFIG.combat.spawnCount.color, 2000);
  }

  // =========================================================================
  // 变异死亡酸液效果
  // =========================================================================

  mutantDeathEffect(r: Roach): void {
    if (this._deathChainDepth >= this.MAX_DEATH_CHAIN_DEPTH) return;
    this._deathChainDepth++;

    try {
      const roaches = this.cfg.roaches;
      const cfg = BALANCE_CONFIG.roachAI.acidSplash;
      const acidRadius = cfg.radius;
      const acidRadiusSq = acidRadius * acidRadius;
      let hitCount = 0;
      for (const other of roaches) {
        if (other.state !== RoachState.ALIVE || other.id === r.id) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < acidRadiusSq) {
          const dist = Math.sqrt(distSq);
          const dmg = cfg.damage * (1 - dist / acidRadius);
          other.hp -= dmg;
          other.burnDamage = dmg * cfg.burnMultiplier;
          other.inFire = true;
          hitCount++;
          if (other.hp <= 0 && this._deathChainDepth < this.MAX_DEATH_CHAIN_DEPTH) {
            const otherIndex = roaches.findIndex(rr => rr.id === other.id);
            this.killRoach(other, otherIndex, roaches, this.cfg.particles, this.cfg.getDifficulty() === 'hard');
          }
        }
      }

      if (this._deathChainDepth <= 1) {
        this.cfg.onAddFloatingText(r.x, r.y - 40, TEXT_CONFIG.combat.acidSplash.text, TEXT_CONFIG.combat.acidSplash.color);
        if (hitCount > 0) {
          this.cfg.onAddFloatingText(r.x, r.y - 55, TEXT_CONFIG.combat.acidCorrode.text(hitCount), TEXT_CONFIG.combat.acidCorrode.color);
        }
      }
    } finally {
      this._deathChainDepth--;
    }
  }
}