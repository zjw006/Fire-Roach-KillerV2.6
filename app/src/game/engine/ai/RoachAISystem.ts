/**
 * @fileoverview 蟑螂 AI 系统模块
 * @description 负责所有蟑螂敌人的 AI 行为：移动、寻路、闪避、愤怒、特殊技能
 *   （护士治疗、变异变形、分裂、自爆、定时自爆等）、医院专属行为，以及击杀处理
 */

import { RoachType, RoachState, SceneType, GameMode, GameState, ParticleType } from '../../types';
import type { Roach, Player, Particle, FireWall, Economy, GameProgress, BossBattleState, WaveConfig } from '../../types';
import { ENEMY_DEFS, BOSS_CONFIG, SCENE_GROUND_BOUNDS } from '../../data';
import { ParticleSpawner } from '../particle/ParticleSpawner';
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
  onSaveProgress: () => void;
  onGameOver: (economy: Economy, wave: number) => void;
  onStateChange: (state: GameState) => void;
  onEconomyUpdate: (economy: Economy) => void;
  onDefenseUpdate: (hp: number, maxHp: number) => void;
  onBossUpdate: (state: BossBattleState) => void;
  onGameVictory: () => void;
  onSellUnusedInventory: () => void;
  onUnlockNextScene: () => void;
}

// =============================================================================
// 类：RoachAISystem
// =============================================================================

/** 全局蟑螂 ID 计数器（与 engine.ts 共享） */
let nextId = 1;
let nextBossId = 10000;

export function getNextId(): number { return nextId; }
export function setNextId(v: number): void { nextId = v; }
export function getNextBossId(): number { return nextBossId; }
export function setNextBossId(v: number): void { nextBossId = v; }

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

  /** 胚胎暴走：待生成的蟑螂类型 */
  private _embryoSpawnTypes: RoachType[] = [];

  /** 死体炸弹 ID */
  private _nextBombId: number = 1;

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
    this._embryoSpawnTypes = [];
    this._nextBombId = 1;
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
    const currentScene = this.cfg.getCurrentScene();
    const roaches = this.cfg.roaches;
    const particles = this.cfg.particles;
    const fireWalls = this.cfg.fireWalls;
    const player = this.cfg.player;
    const difficulty = this.cfg.getDifficulty();
    const isHard = difficulty === 'hard';

    // ===== MUTANT TRANSFORMATION FRAME UPDATE =====
    if (this.mutantTransformActive) {
      this.mutantTransformTimer -= deltaTime;
      if (this.mutantTransformTimer <= 0) {
        this.mutantTransformFrame++;
        if (this.mutantTransformFrame >= 7) {
          this.mutantTransformActive = false;
          this.spawnEmbryoRoaches();
        } else {
          this.mutantTransformTimer = 0.2;
        }
      }
    }

    for (let i = roaches.length - 1; i >= 0; i--) {
      const r = roaches[i];
      if (!r) continue;

      // Decrement spawn immunity timer
      if (r.spawnImmuneTimer && r.spawnImmuneTimer > 0) {
        r.spawnImmuneTimer -= deltaTime;
      }

      // Decrement heal buff timer
      if (r.healBuffTimer && r.healBuffTimer > 0) {
        r.healBuffTimer -= deltaTime;
      }

      if (r.state === RoachState.DEAD) {
        r.deathTimer -= deltaTime;
        if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
          r.vy = 150;
          r.y += r.vy * deltaTime;
          r.vx = (Math.random() - 0.5) * 40;
          r.x += r.vx * deltaTime;
          r.angle += deltaTime * 8;
          if (r.y >= defenseLineY) {
            r.y = defenseLineY;
            r.deathTimer = 0;
          }
        }
        if (r.deathTimer <= 0) {
          if (r.type === RoachType.MUTANT && this.mutantTransformActive) {
            r.deathTimer = 0.1;
          } else {
            roaches.splice(i, 1);
          }
        }
        continue;
      }

      // Damage flash decay
      if (r.damageFlash > 0) r.damageFlash -= deltaTime * 5;

      // Status effects
      this.updateStatusEffects(r);

      // Stunned or board-stuck
      const isImmobilized = r.isStunned || this.cfg.stickySystem.isStuckByBoard(r.id, roaches);
      if (isImmobilized) {
        r.vx = 0; r.vy = 0;
      }

      // Enrage
      if (!r.isEnraged && r.hp < r.maxHp * 0.2 && r.type !== RoachType.ARMORED) {
        r.isEnraged = true;
        r.speed = r.baseSpeed * 2;
      }

      // Panic timer
      if (r.panicTimer > 0) r.panicTimer -= deltaTime;

      let moveAngle: number;

      if (r.panicTimer > 0) {
        moveAngle = r.panicAngle + Math.sin(time * 15 + r.wobbleOffset) * 0.8;
      } else {
        const isFlying = r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE;
        const wanderAmplitude = isFlying ? 80 : 30;
        const targetX = r.x + Math.sin(r.wobbleOffset + time * r.wobbleSpeed) * wanderAmplitude;
        const dl = defenseLineY;
        const roachSize = ENEMY_DEFS[r.type].size;
        const roachBottom = r.y + roachSize * 0.4;
        const targetY = roachBottom >= dl ? dl + 200 : dl;
        const dx = targetX - r.x;
        const dy = targetY - r.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        moveAngle = dist > 1 ? Math.atan2(dy, dx) : r.angle;

        // Force near defense line
        const distToDefense = dl - roachBottom;
        if (distToDefense > 0 && distToDefense < 50) {
          const minSin = 0.3 + (1 - distToDefense / 50) * 0.4;
          if (Math.sin(moveAngle) < minSin) {
            moveAngle = Math.asin(Math.min(minSin, 0.99));
          }
        }

        // Flying roaches: charge
        if (isFlying && distToDefense < 150) {
          const chargeSpeed = 2.5 * (1 - distToDefense / 150);
          r.speed = r.baseSpeed * (1 + chargeSpeed);
        } else if (!isFlying) {
          const margin = 80;
          if (distToDefense < 120) {
            const pushStrength = (1 - distToDefense / 120) * 150 * deltaTime;
            if (r.x < margin) {
              moveAngle += pushStrength * (margin - r.x) / margin;
            } else if (r.x > canvasWidth - margin) {
              moveAngle -= pushStrength * (r.x - (canvasWidth - margin)) / margin;
            }
          }
        }
      }

      // BAIT CONSUMABLE
      if (player.baitTimer > 0 && !isImmobilized && this.cfg.consumableSystem.baitTarget.active) {
        const baitDx = this.cfg.consumableSystem.baitTarget.x - r.x;
        const baitDy = this.cfg.consumableSystem.baitTarget.y - r.y;
        const baitDist = Math.sqrt(baitDx * baitDx + baitDy * baitDy);
        if (baitDist > 10) {
          const baitAngle = Math.atan2(baitDy, baitDx);
          const pullStrength = 0.7;
          const cosA = Math.cos(moveAngle);
          const sinA = Math.sin(moveAngle);
          const cosB = Math.cos(baitAngle);
          const sinB = Math.sin(baitAngle);
          moveAngle = Math.atan2(
            sinA * (1 - pullStrength) + sinB * pullStrength,
            cosA * (1 - pullStrength) + cosB * pullStrength
          );
          r.speed = r.baseSpeed * 1.3;
        }
      }

      // Normal movement with fan slow
      const fanMultiplier = r.fanSlowTimer > 0 ? (1 - r.fanSlowFactor) : 1;
      const effectiveSpeed = r.speed * fanMultiplier;

      // ===== NURSE ROACH FOLLOW MOVEMENT =====
      if (r.type === RoachType.NURSE) {
        let nearest: Roach | null = null;
        let nearestDist = Infinity;
        for (const other of roaches) {
          if (other.id === r.id) continue;
          if (other.state !== RoachState.ALIVE) continue;
          if (other.type === RoachType.NURSE) continue;
          const dx = other.x - r.x;
          const dy = other.y - r.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = other;
          }
        }
        if (nearest && nearestDist > 40) {
          const followAngle = Math.atan2(nearest.y - r.y, nearest.x - r.x);
          const followSpeed = r.speed * 0.5;
          r.vx = Math.cos(followAngle) * followSpeed * 65;
          r.vy = Math.sin(followAngle) * followSpeed * 65;
        } else if (nearest && nearestDist <= 40) {
          r.vx = 0;
          r.vy = 0;
        } else {
          r.vx = 0;
          r.vy = 0;
        }
      } else if (r.type === RoachType.MUTANT && r.transformTimer && r.transformTimer > 0) {
        r.vx = 0;
        r.vy = 0;
      } else if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) {
        r.vx = 0;
        r.vy = 0;
      } else if (r.spawnImmuneTimer && r.spawnImmuneTimer > 0) {
        r.vx = 0;
        r.vy = 0;
      } else {
        r.vx = Math.cos(moveAngle) * effectiveSpeed * 65;
        r.vy = Math.sin(moveAngle) * effectiveSpeed * 65;
      }

      // Minimum downward speed
      if (!isImmobilized && r.type !== RoachType.FLYING && r.type !== RoachType.FLYING_SUICIDE && r.type !== RoachType.NURSE && !(r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) && r.vy < 10) {
        r.vy = 10;
      }

      // Dodge
      if ((r.type === RoachType.SUICIDE || r.type === RoachType.SMALL) && r.dodgeTimer > 0) {
        r.dodgeTimer -= deltaTime;
        if (r.dodgeTimer <= 0) {
          r.dodgeDir = 0;
        } else {
          let dodgeSpeed: number;
          if (r.isSplitChild) {
            dodgeSpeed = 250;
          } else if (r.type === RoachType.SMALL) {
            dodgeSpeed = 180;
          } else {
            dodgeSpeed = 100;
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
      r.angle = moveAngle;

      // Pull back into screen
      const margin = 100;
      if (r.x < -margin) r.x += 80 * deltaTime;
      if (r.x > canvasWidth + margin) r.x -= 80 * deltaTime;
      if (r.y < -margin) r.y += 80 * deltaTime;
      if (r.y > canvasHeight + margin * 2) {
        r.y = defenseLineY + 50;
      }

      // Fire wall blocks ground roaches
      if (r.type !== RoachType.FLYING && r.type !== RoachType.FLYING_SUICIDE) {
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

      // Clamp X
      if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
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

      // Suicide / Flying Suicide fuse
      if (r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) {
        const distToDefense = defenseLineY - r.y;
        const fuseTriggerDist = (r.type === RoachType.FLYING_SUICIDE) ? 80 : 150;
        if (distToDefense < fuseTriggerDist) {
          r.isFused = true;
          r.fuseTimer -= deltaTime;
          if (Math.random() < 0.3) {
            particles.push({
              x: r.x + (Math.random() - 0.5) * 10,
              y: r.y + (Math.random() - 0.5) * 10,
              vx: 0, vy: -20,
              life: 0.3, maxLife: 0.3,
              size: 3, color: '#ff4400',
              type: ParticleType.SPARK,
            });
          }
          if (r.fuseTimer <= 0) {
            this.suicideExplode(r, i);
            continue;
          }
        }
      }

      // Queen spawn minions
      const bossBattle = this.cfg.bossSystem.bossBattle;
      if (r.type === RoachType.QUEEN && !(bossBattle.active && r.isBoss)) {
        r.spawnTimer -= deltaTime;
        if (r.spawnTimer <= 0) {
          r.spawnTimer = BOSS_CONFIG.queen.spawnInterval;
          for (let m = 0; m < BOSS_CONFIG.queen.minionCount; m++) {
            this.cfg.onSpawnRoach(RoachType.SMALL);
          }
          this.cfg.onAddFloatingText(r.x, r.y - 50, '女王召唤了小蟑螂!', '#ff44aa');
        }
      }

      // ===== NURSE ROACH AOE HEAL =====
      this.updateNurseHeal(r, roaches);

      // ===== SUICIDE DODGE IN FIRE =====
      if (r.type === RoachType.SUICIDE && r.inFire && !this.cfg.stickySystem.isStuckByBoard(r.id, roaches)) {
        if (r.dodgeDir === 0) {
          r.dodgeDir = Math.random() < 0.5 ? -1 : 1;
        }
        r.dodgeTimer = 1.2;
      }

      // ===== TIMED SUICIDE BREACH SYSTEM =====
      this.updateTimedSuicideBreach(r, i, roaches, defenseLineY, isHard);

      // Legacy: handle old placed bombs
      if (r.type === RoachType.TIMED_SUICIDE && r.state === RoachState.ALIVE && !r.hasPlacedBomb && !(r.breachPhase && r.breachPhase !== 'idle')) {
        const roachSize = ENEMY_DEFS[r.type].size;
        const roachBottom = r.y + roachSize * 0.4;
        const dl = defenseLineY;
        const placeY = dl - 64;

        if (roachBottom >= placeY) {
          if (r.placeTimer === 0) {
            r.placeTimer = 2.0;
          }
          r.vx = 0;
          r.vy = 0;
          r.burnDamage = 0;
          r.poisonTimer = 0;
          r.poisonDamage = 0;
          r.inFire = false;
          r.damageFlash = 0;
          r.placeTimer! -= deltaTime;
          if (r.placeTimer! <= 0) {
            r.hasPlacedBomb = true;
            this.cfg.placedBombs.push({
              id: r.id, x: r.x, y: placeY, timer: 3,
            });
            this.cfg.onAddFloatingText(r.x, placeY - 30, '炸弹已安放!', '#ef4444');
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
            r.type = RoachType.LARGE;
            r.size = ENEMY_DEFS[RoachType.LARGE].size;
            r.speed = ENEMY_DEFS[RoachType.LARGE].speed;
            r.baseSpeed = ENEMY_DEFS[RoachType.LARGE].speed;
            this.cfg.onAddFloatingText(r.x, r.y - 45, '变身大蟑螂!', '#fbbf24');
          }
        }
      }

      // SMALL roach dodge
      if (r.type === RoachType.SMALL && r.inFire && !this.cfg.stickySystem.isStuckByBoard(r.id, roaches)) {
        if (r.dodgeDir === 0) {
          r.dodgeDir = Math.random() < 0.5 ? -1 : 1;
        }
        if (r.isSplitChild) {
          r.dodgeTimer = 0.2 + Math.random() * 0.2;
        } else {
          r.dodgeTimer = 0.4 + Math.random() * 0.3;
        }
      }

      // Apply burn damage
      if (r.inFire && r.burnDamage > 0) {
        const dmg = r.burnDamage * deltaTime;
        this.cfg.onApplyDamageToRoach(r, dmg);
        r.burnDamage = 0;
        if (Math.random() < 0.3) {
          ParticleSpawner.spawnSmokeParticles(particles, r.x, r.y, 1);
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
            size: 4, color: '#a78bfa',
            type: ParticleType.POISON_CLOUD,
          });
        }
      }

      if (r.hp <= 0) {
        this.killRoach(r, i, roaches, particles, isHard);
      }
    }
  }

  // =========================================================================
  // 状态效果更新
  // =========================================================================

  private updateStatusEffects(r: Roach): void {
    const deltaTime = this.cfg.getDeltaTime();
    if (r.stunTimer > 0) {
      r.stunTimer -= deltaTime;
      if (r.stunTimer <= 0) {
        r.isStunned = false;
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
  }

  // =========================================================================
  // 护士治疗逻辑
  // =========================================================================

  private updateNurseHeal(r: Roach, roaches: Roach[]): void {
    if (r.type !== RoachType.NURSE || r.state !== RoachState.ALIVE) return;

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
            this.cfg.onAddFloatingText(r.x, r.y - 50, '【施法中】', '#4ade80', 1500);
            this.cfg.onAddFloatingText(r.x, r.y - 60, '非法行医!', '#5a8a5a');
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
          const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
          if (d < healRange && other.hp < other.maxHp) {
            const healAmount = Math.floor(other.maxHp * 0.20);
            const actualHeal = Math.min(healAmount, other.maxHp - other.hp);
            if (actualHeal > 0) {
              other.hp += actualHeal;
              other.healBuffTimer = 2.0;
              healedCount++;
              this.cfg.onAddFloatingText(other.x, other.y - 30, `+${actualHeal}`, '#5a8a5a', 1200);
            }
          }
        }
        if (healedCount > 0) {
          this.cfg.onAddFloatingText(r.x, r.y - 50, '治疗喷射!', '#5a8a5a');
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
  // 定时自爆突破系统
  // =========================================================================

  private updateTimedSuicideBreach(r: Roach, i: number, roaches: Roach[], defenseLineY: number, _isHard: boolean): void {
    if (r.type !== RoachType.TIMED_SUICIDE || r.state !== RoachState.ALIVE) return;

    const deltaTime = this.cfg.getDeltaTime();
    const dl = defenseLineY;
    const distToDefense = dl - r.y;

    if (!r.breachPhase) r.breachPhase = 'idle';

    // Branch B: Flame killed
    if (r.hp <= 0 && r.breachPhase !== 'idle') {
      r.isFlameKilled = true;
      r.state = RoachState.DEAD;
      r.deathTimer = 1.0;
      r.breachPhase = 'residue';
      r.residueTimer = 2.0;
      this.cfg.onAddFloatingText(r.x, r.y - 30, '炸弹没响...', '#666');
      return;
    }

    // Branch A: Sticky board frozen
    if (r.stuckTimer > 0 && r.breachPhase !== 'idle') {
      r.isFrozen = true;
      return;
    } else {
      r.isFrozen = false;
    }

    // Phase transition
    if (r.breachPhase === 'idle' && distToDefense <= 200) {
      r.breachPhase = 'warning';
      r.breachPhaseTimer = 0.5;
      r.crackRadius = 0;
    }

    switch (r.breachPhase) {
      case 'warning': {
        r.speed = r.baseSpeed * 0.5;
        if (distToDefense <= 80) {
          r.breachPhase = 'crouching';
          r.breachPhaseTimer = 3.0;
          r.placeTimer = 3.0;
          r.hasPlacedBomb = true;
          this.cfg.onAddFloatingText(r.x, r.y - 50, '螂家爆破!', '#8b2020');
        }
        break;
      }

      case 'crouching': {
        r.vx = 0;
        r.vy = 0;
        r.burnDamage = 0;
        r.poisonTimer = 0;
        r.inFire = false;
        r.damageFlash = 0;

        r.breachPhaseTimer! -= deltaTime;
        r.placeTimer! -= deltaTime;

        r.crackRadius = Math.min(60, (3.0 - r.breachPhaseTimer!) / 3.0 * 60);

        const secs = Math.ceil(r.placeTimer!);
        if (r.placeTimer! > 0 && Math.abs(r.placeTimer! - secs) < 0.05 && secs <= 3) {
          this.cfg.onAddFloatingText(r.x, r.y - 35, `${secs}`, secs <= 1 ? '#8b2020' : '#a05030');
        }

        if (r.placeTimer! <= 0) {
          r.breachPhase = 'exploding';
          r.breachPhaseTimer = 0.4;
          this.triggerBreachExplosion(r, roaches);
        }
        break;
      }

      case 'exploding': {
        r.breachPhaseTimer! -= deltaTime;
        if (r.breachPhaseTimer! <= 0) {
          r.breachPhase = 'residue';
          r.residueTimer = 3.0;
          r.state = RoachState.DEAD;
          r.deathTimer = 3.0;
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
  // 自爆爆炸
  // =========================================================================

  suicideExplode(r: Roach, index: number): void {
    const roaches = this.cfg.roaches;
    const particles = this.cfg.particles;
    roaches.splice(index, 1);
    this.cfg.audio.playSuicideExplode();
    Vibration.vibrateSuicideExplode();
    const explodeRadius = 100;

    ParticleSpawner.spawnExplosionParticles(particles, r.x, r.y, 50);
    ParticleSpawner.spawnSmokeParticles(particles, r.x, r.y, 40);
    ParticleSpawner.spawnDebrisParticles(particles, r.x, r.y, 25);
    ParticleSpawner.spawnSparkParticles(particles, r.x, r.y, 30);
    ParticleSpawner.spawnFireRingParticles(particles, r.x, r.y, 20);
    this.cfg.setScreenShake(20);

    const explodeRadiusSq = explodeRadius * explodeRadius;
    let hitCount = 0;
    for (const other of roaches) {
      if (other.state !== RoachState.ALIVE || other.isBoss) continue;
      const dx = other.x - r.x;
      const dy = other.y - r.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < explodeRadiusSq) {
        const dist = Math.sqrt(distSq);
        const dmg = 15 * (1 - dist / explodeRadius);
        other.hp -= dmg;
        other.burnDamage = dmg * 2;
        other.damageFlash = (other.armorHp > 0) ? 0 : 2;
        other.inFire = true;
        hitCount++;
        if (other.hp <= 0 && this._deathChainDepth < this.MAX_DEATH_CHAIN_DEPTH) {
          this.killRoach(other, roaches.indexOf(other), roaches, particles, this.cfg.getDifficulty() === 'hard');
        }
      }
    }

    const defenseLineY = this.cfg.getDefenseLineY();
    const roachSize = ENEMY_DEFS[r.type].size;
    const roachBottom = r.y + roachSize * 0.4;
    const defenseDamageRange = (r.type === RoachType.FLYING_SUICIDE) ? 300 : 100;
    if (roachBottom > defenseLineY - defenseDamageRange) {
      const dmg = this.cfg.getDifficulty() === 'hard' ? 15 : 5;
      if (this.cfg.player.shieldTimer > 0) {
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, '護盾抵消!', '#22d3ee');
      } else {
        const newHp = this.cfg.getDefenseHp() - dmg;
        this.cfg.setDefenseHp(newHp);
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, `自爆伤害! -${dmg}`, '#ef4444');
      }
      if (r.type === RoachType.FLYING_SUICIDE) {
        this.cfg.audio.playSuicideBreachFlying();
      } else {
        this.cfg.audio.playSuicideBreachGround();
      }
      if (this.cfg.getDefenseHp() <= 0) {
        this.handleDefenseBreachGameOver();
        return;
      }
    }

    this.cfg.onAddFloatingText(r.x, r.y - 30, hitCount > 0 ? `大爆炸!(${hitCount}只受波及)` : '大爆炸!', '#ff4400');
  }

  // =========================================================================
  // 自杀死亡爆炸
  // =========================================================================

  suicideDeathExplode(r: Roach): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((r as any)._deathExploded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r as any)._deathExploded = true;

    const roaches = this.cfg.roaches;
    const particles = this.cfg.particles;
    this.cfg.audio.playSuicideExplode();
    Vibration.vibrateSuicideExplode();
    const explodeRadius = 100;

    ParticleSpawner.spawnExplosionParticles(particles, r.x, r.y, 50);
    ParticleSpawner.spawnSmokeParticles(particles, r.x, r.y, 40);
    ParticleSpawner.spawnDebrisParticles(particles, r.x, r.y, 25);
    ParticleSpawner.spawnSparkParticles(particles, r.x, r.y, 30);
    ParticleSpawner.spawnFireRingParticles(particles, r.x, r.y, 20);
    this.cfg.setScreenShake(20);

    let hitCount = 0;
    for (const other of roaches) {
      if (other.state !== RoachState.ALIVE || other.isBoss) continue;
      const dx = other.x - r.x;
      const dy = other.y - r.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < explodeRadius) {
        const dmg = 15 * (1 - dist / explodeRadius);
        other.hp -= dmg;
        other.burnDamage = dmg * 2;
        other.damageFlash = (other.armorHp > 0) ? 0 : 2;
        other.inFire = true;
        hitCount++;
        if (other.hp <= 0) this.killRoach(other, roaches.indexOf(other), roaches, particles, this.cfg.getDifficulty() === 'hard');
      }
    }

    const defenseLineY = this.cfg.getDefenseLineY();
    const roachSize = ENEMY_DEFS[r.type].size;
    const roachBottom = r.y + roachSize * 0.4;
    const defenseDamageRange = (r.type === RoachType.FLYING_SUICIDE) ? 300 : 100;
    if (roachBottom > defenseLineY - defenseDamageRange) {
      const dmg = this.cfg.getDifficulty() === 'hard' ? 15 : 5;
      if (this.cfg.player.shieldTimer > 0) {
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, '護盾抵消!', '#22d3ee');
      } else {
        const newHp = this.cfg.getDefenseHp() - dmg;
        this.cfg.setDefenseHp(newHp);
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, `自爆伤害! -${dmg}`, '#ef4444');
      }
      if (r.type === RoachType.FLYING_SUICIDE) {
        this.cfg.audio.playSuicideBreachFlying();
      } else {
        this.cfg.audio.playSuicideBreachGround();
      }
    }

    this.cfg.onAddFloatingText(r.x, r.y - 30, hitCount > 0 ? `死亡爆炸!(${hitCount}只受波及)` : '死亡爆炸!', '#ff4400');
  }

  // =========================================================================
  // 定时自爆爆炸
  // =========================================================================

  triggerBreachExplosion(r: Roach, roaches: Roach[]): void {
    if (this._deathChainDepth >= this.MAX_DEATH_CHAIN_DEPTH) return;
    this._deathChainDepth++;

    try {
      const particles = this.cfg.particles;
      ParticleSpawner.spawnExplosionParticles(particles, r.x, r.y, 80);
      ParticleSpawner.spawnFireRingParticles(particles, r.x, r.y, 30);
      ParticleSpawner.spawnSmokeParticles(particles, r.x, r.y, 40);

      for (let fi = 0; fi < 3; fi++) {
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

      for (let d = 0; d < 15; d++) {
        const angle = (d / 15) * Math.PI * 2 + Math.random() * 0.3;
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

      this.cfg.setScreenShake(28);
      this.cfg.audio.playTimedBombExplode();
      Vibration.vibrateDamage();

      for (const other of roaches) {
        if (other.state !== RoachState.ALIVE || other.id === r.id) continue;
        const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
        if (d < 196) {
          const dmg = 20 * (1 - d / 196);
          other.hp -= dmg;
          other.burnDamage = dmg * 2;
          other.inFire = true;
          if (other.hp <= 0 && this._deathChainDepth < this.MAX_DEATH_CHAIN_DEPTH) {
            other.hp = 0;
            other.state = RoachState.DEAD;
            other.deathTimer = 1.5;
            this.killRoach(other, roaches.indexOf(other), roaches, particles, this.cfg.getDifficulty() === 'hard');
          }
        }
      }

      const defenseLineY = this.cfg.getDefenseLineY();
      const defDmg = this.cfg.getDifficulty() === 'hard' ? 20 : 8;
      if (this.cfg.player.shieldTimer > 0) {
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, '護盾抵消!', '#22d3ee');
      } else {
        const newHp = this.cfg.getDefenseHp() - defDmg;
        this.cfg.setDefenseHp(newHp);
        this.cfg.onAddFloatingText(r.x, defenseLineY - 20, `炸弹爆炸! -${defDmg}`, '#ef4444');
      }

      this.cfg.onAddFloatingText(r.x, r.y - 50, '轰!', '#8b2020');
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
      r.hasSplit = true;
      r.deathTimer = 0.5;
      for (let s = 0; s < 5; s++) {
        const angle = (s / 5) * Math.PI * 2;
        const spawnX = r.x + Math.cos(angle) * 50;
        const spawnY = r.y + Math.sin(angle) * 30;
        const small: Roach = {
          ...this.createSmallRoachFromSplit(spawnX, spawnY),
          id: nextId++,
        };
        roaches.push(small);
      }
      this.cfg.onAddFloatingText(r.x, r.y - 30, '分裂x5!', '#ff8800');
    }

    // Flying roach disintegrate
    if (r.type === RoachType.FLYING) {
      r.deathTimer = 2.0;
      for (let w = 0; w < 8; w++) {
        const wingAngle = (w / 8) * Math.PI * 2;
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
      for (let b = 0; b < 12; b++) {
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
      ParticleSpawner.spawnSparkParticles(particles, r.x, r.y, 20);
      this.cfg.onAddFloatingText(r.x, r.y - 20, '解体!', '#88ccff');
    }

    // Suicide death explosion
    if (r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) {
      const explodeRadius = 80;
      let hitCount = 0;
      for (const other of roaches) {
        if (other.state !== RoachState.ALIVE || other.id === r.id) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < explodeRadius) {
          const dmg = 12 * (1 - dist / explodeRadius);
          other.hp -= dmg;
          other.burnDamage = dmg * 2;
          other.damageFlash = (other.armorHp > 0) ? 0 : 2;
          other.inFire = true;
          hitCount++;
        }
      }
      ParticleSpawner.spawnExplosionParticles(particles, r.x, r.y, 35);
      ParticleSpawner.spawnSmokeParticles(particles, r.x, r.y, 30);
      ParticleSpawner.spawnDebrisParticles(particles, r.x, r.y, 20);
      ParticleSpawner.spawnFireRingParticles(particles, r.x, r.y, 15);
      ParticleSpawner.spawnSparkParticles(particles, r.x, r.y, 20);
      this.cfg.setScreenShake(12);
      this.cfg.audio.playSuicideExplode();
      Vibration.vibrateSuicideExplode();
      this.cfg.onAddFloatingText(r.x, r.y - 30, hitCount > 0 ? `爆炸!(${hitCount}只受波及)` : '爆炸!', '#ff6600');
    }

    this.cfg.audio.playKill();
    Vibration.vibrateKill();
    ParticleSpawner.spawnAshParticles(particles, r.x, r.y, r.type === RoachType.QUEEN ? 50 : (r.type === RoachType.LARGE ? 20 : 12));
    ParticleSpawner.spawnSparkParticles(particles, r.x, r.y, r.type === RoachType.QUEEN ? 40 : (r.type === RoachType.LARGE ? 15 : 8));
    ParticleSpawner.spawnBloodParticles(particles, r.x, r.y, r.type === RoachType.QUEEN ? 40 : (r.type === RoachType.LARGE ? 25 : 15));

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
        let backlashDmg = 0;
        switch (r.type) {
          case RoachType.SMALL: backlashDmg = 50; break;
          case RoachType.LARGE: backlashDmg = 150; break;
          case RoachType.FLYING: backlashDmg = 100; break;
          case RoachType.SUICIDE: backlashDmg = 200; break;
          case RoachType.FLYING_SUICIDE: backlashDmg = 180; break;
          case RoachType.SPLITTING: backlashDmg = 150; break;
          case RoachType.ARMORED: backlashDmg = 100; break;
        }
        if (backlashDmg > 0) {
          boss.hp -= backlashDmg;
          this.cfg.onAddFloatingText(boss.x + (Math.random() - 0.5) * 40, boss.y - 30, `反噬 -${backlashDmg}`, '#a855f7');
          boss.damageFlash = 1;
          for (let k = 0; k < 3; k++) {
            particles.push({
              x: boss.x + (Math.random() - 0.5) * 60,
              y: boss.y + (Math.random() - 0.5) * 60,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60 - 30,
              life: 0.6, maxLife: 0.6,
              size: 4, color: '#a855f7',
              type: ParticleType.SPARK,
            });
          }
        }
      }
    }

    economy.totalKills++;
    economy.money += reward;
    economy.totalMoneyEarned += reward;
    this.cfg.onAddFloatingText(r.x, r.y - 20, `+¥${reward}`, '#4ade80');
    this.cfg.setScreenShake(r.isBoss ? 12 : (r.type === RoachType.LARGE ? 6 : 3));

    // Boss death
    if (r.isBoss) {
      this.cfg.bossSystem.activeBosses--;
      this.cfg.onAddFloatingText(this.cfg.getCanvasWidth() / 2, this.cfg.getCanvasHeight() / 2, 'BOSS 击败!', '#fbbf24');
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
      this.cfg.onAddFloatingText(r.x, r.y - 40, '尸体炸弹 3秒!', '#ff4444');
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
    };
  }

  // =========================================================================
  // 变异胚胎暴走
  // =========================================================================

  forceEmbryoBurst(r: Roach): void {
    const roll = Math.random();
    if (roll < 0.5) {
      this._embryoSpawnTypes = [RoachType.SMALL, RoachType.SMALL];
    } else if (roll < 0.8) {
      this._embryoSpawnTypes = [RoachType.SMALL, RoachType.FLYING];
    } else {
      this._embryoSpawnTypes = [RoachType.SMALL, RoachType.SUICIDE];
    }

    this.mutantTransformActive = true;
    this.mutantTransformFrame = 0;
    this.mutantTransformTimer = 0.6;
    this.mutantTransformX = r.x;
    this.mutantTransformY = r.y;

    this.cfg.setScreenShake(12);
    this.cfg.audio.playMutantTransform();
    this.cfg.onAddFloatingText(r.x, r.y - 70, '【胚胎暴走】', '#ff0040', 2000);
    this.cfg.particles.push({
      x: r.x, y: r.y, vx: 0, vy: 0,
      life: 0.4, maxLife: 0.4,
      size: 120,
      color: 'rgba(255, 0, 64, 0.5)',
      type: ParticleType.EXPLOSION,
    });
  }

  spawnEmbryoRoaches(): void {
    const sx = this.mutantTransformX;
    const sy = this.mutantTransformY;
    const roaches = this.cfg.roaches;
    let spawnedCount = 0;

    for (let i = 0; i < this._embryoSpawnTypes.length; i++) {
      const spawnType = this._embryoSpawnTypes[i];

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
      this.cfg.onAddFloatingText(newRoach.x, newRoach.y - 50, `【诞生】${typeName}!`, '#00ff80', 1500);
    }

    this.slimeBurstTimer = 1.2;
    this.slimeBurstX = sx;
    this.slimeBurstY = sy;

    this.cfg.onAddFloatingText(sx, sy - 40, `生成${spawnedCount}只!`, '#ff0040', 2000);
  }

  // =========================================================================
  // 变异死亡酸液效果
  // =========================================================================

  mutantDeathEffect(r: Roach): void {
    if (this._deathChainDepth >= this.MAX_DEATH_CHAIN_DEPTH) return;
    this._deathChainDepth++;

    try {
      const roaches = this.cfg.roaches;
      const acidRadiusSq = 10000;
      const acidRadius = 100;
      let hitCount = 0;
      for (const other of roaches) {
        if (other.state !== RoachState.ALIVE || other.id === r.id) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < acidRadiusSq) {
          const dist = Math.sqrt(distSq);
          const dmg = 10 * (1 - dist / acidRadius);
          other.hp -= dmg;
          other.burnDamage = dmg * 1.5;
          other.inFire = true;
          hitCount++;
          if (other.hp <= 0 && this._deathChainDepth < this.MAX_DEATH_CHAIN_DEPTH) {
            this.killRoach(other, roaches.indexOf(other), roaches, this.cfg.particles, this.cfg.getDifficulty() === 'hard');
          }
        }
      }

      if (this._deathChainDepth <= 1) {
        this.cfg.onAddFloatingText(r.x, r.y - 40, '酸液飞溅!', '#84cc16');
        if (hitCount > 0) {
          this.cfg.onAddFloatingText(r.x, r.y - 55, `${hitCount}只受腐蚀`, '#a3e635');
        }
      }
    } finally {
      this._deathChainDepth--;
    }
  }
}