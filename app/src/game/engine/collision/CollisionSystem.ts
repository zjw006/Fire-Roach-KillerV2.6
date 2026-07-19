/**
 * @fileoverview 碰撞检测系统模块
 * @description 负责处理游戏中的碰撞检测、伤害计算和武器效果应用
 */

import { GameState, RoachType, RoachState, type Roach, type Player, type TripleFlameState } from '../../types';
import { ENEMY_DEFS, BOSS_CONFIG, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/**
 * 碰撞检测系统配置接口
 */
export interface CollisionSystemConfig {
  /** 游戏难度 */
  difficulty: 'easy' | 'hard';
  /** 当前场景 */
  currentScene: string;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 生成火花粒子回调 */
  onSpawnSpark?: (x: number, y: number, count: number) => void;
  /** 播放音效回调 */
  onPlayBreach?: () => void;
  /** 震动回调 */
  onVibrateBreach?: () => void;
  /** 震动游戏结束回调 */
  onVibrateGameOver?: () => void;
  /** 玩家天赋伤害加成 */
  talentDamageMultiplier?: number;
  /** 玩家天赋防御加成 */
  talentDefenseMultiplier?: number;
}

/**
 * 碰撞检测结果接口
 */
export interface CollisionResult {
  /** 是否发生碰撞 */
  hit: boolean;
  /** 造成的伤害 */
  damage: number;
  /** 是否触发特殊效果 */
  effectTriggered: boolean;
  /** 效果类型 */
  effectType?: string;
}

/**
 * 武器伤害配置接口
 */
export interface WeaponDamageConfig {
  /** 基础伤害 */
  baseDamage: number;
  /** 伤害衰减系数 */
  falloffFactor: number;
  /** 特殊效果配置 */
  effects?: Record<string, any>;
}

/**
 * 防线突破检测结果
 */
export interface BreachResult {
  /** 防线血量是否归零（游戏结束） */
  gameOver: boolean;
  /** 被移除的蟑螂索引列表（从大到小排序，便于外部 splice） */
  removedIndices: number[];
  /** 总防线伤害 */
  totalDefenseDamage: number;
  /** 突破次数 */
  breachCount: number;
  /** 自杀爆炸的蟑螂索引列表 */
  suicideExplodeIndices: number[];
}

/**
 * 碰撞检测系统类
 * @description 管理游戏中的碰撞检测、伤害计算和武器效果
 */
export class CollisionSystem {
  /** 系统配置 */
  private config: CollisionSystemConfig;
  
  /** 武器伤害配置 */
  private weaponDamageConfigs: Record<string, WeaponDamageConfig>;

  /**
   * 构造函数
   * @param config 碰撞检测系统配置
   */
  constructor(config: CollisionSystemConfig) {
    this.config = config;
    this.adjustWeaponDamageForDifficulty();
  }

  /**
   * 根据难度调整武器伤害配置
   */
  private adjustWeaponDamageForDifficulty(): void {
    // 重置为默认伤害值
    this.weaponDamageConfigs = {
      flamethrower: { baseDamage: BALANCE_CONFIG.weaponDamage.flamethrower.easy, falloffFactor: 0.7 },
      sticky: { baseDamage: 0, falloffFactor: 0 }, // 粘板无伤害
      poison: { baseDamage: BALANCE_CONFIG.weaponDamage.poison.easy, falloffFactor: 0.7 },
      shotgun: { baseDamage: BALANCE_CONFIG.weaponDamage.shotgun.easy, falloffFactor: 0.5 },
      molotov: { baseDamage: BALANCE_CONFIG.weaponDamage.molotov.easy, falloffFactor: 0.6 },
    };
    
    // 根据难度调整伤害
    if (this.config.difficulty === 'hard') {
      this.weaponDamageConfigs.flamethrower.baseDamage = BALANCE_CONFIG.weaponDamage.flamethrower.hard;
      this.weaponDamageConfigs.poison.baseDamage = BALANCE_CONFIG.weaponDamage.poison.hard;
      this.weaponDamageConfigs.shotgun.baseDamage = BALANCE_CONFIG.weaponDamage.shotgun.hard;
      this.weaponDamageConfigs.molotov.baseDamage = BALANCE_CONFIG.weaponDamage.molotov.hard;
    }
  }

  /**
   * 检查火焰与蟑螂的碰撞（原地修改模式，与旧引擎行为一致）
   * @param player 玩家对象
   * @param roaches 蟑螂数组（原地修改）
   * @param tripleFlame 三重火焰状态
   * @param isStuckByBoard 检查蟑螂是否被粘板粘住的函数
   */
  checkFlameCollisions(
    player: Player,
    roaches: Roach[],
    tripleFlame?: TripleFlameState,
    isStuckByBoard?: (roachId: number) => boolean
  ): void {
    if (!player.isFiring || player.isOverheated || player.isReloading || player.gas <= 0) return;

    // 确定喷火器位置
    const nozzleY = player.y - BALANCE_CONFIG.player.nozzleOffsetY;
    const maxRange = player.fireRange * 0.5;
    const beamHalfWidth = BALANCE_CONFIG.collision.beamHalfWidth;

    // 构建枪口位置列表（支持三重火焰）
    const guns: { x: number; damageMult: number }[] = [
      { x: player.x, damageMult: 1.0 },
    ];

    if (tripleFlame?.active) {
      guns.push({ x: player.x - tripleFlame.sideOffset, damageMult: tripleFlame.sideDamageMult });
      guns.push({ x: player.x + tripleFlame.sideOffset, damageMult: tripleFlame.sideDamageMult });
    }

    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      if (r.isBoss) continue;
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;

      for (const gun of guns) {
        if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
          const flyDist = Math.abs(r.x - gun.x);
          const vertDist = nozzleY - r.y;
          const flyHitWidth = beamHalfWidth * 4;
          if (flyDist < flyHitWidth && vertDist > 0 && vertDist < maxRange * 1.3) {
            const falloff = 1 - (vertDist / (maxRange * 1.2)) * 0.7;
            const damage = this.getWeaponDamage(player.currentWeapon) * player.damageMultiplier * falloff * gun.damageMult;
            this.applyWeaponEffect(r, player.currentWeapon);
            r.burnDamage += damage;
            r.inFire = true;
            this.triggerPanicOnArmorBreak(r, isStuckByBoard ? isStuckByBoard(r.id) : false);
          }
          continue;
        }

        const t = -(r.y - nozzleY) / maxRange;
        const clampedT = Math.max(0, Math.min(1, t));
        const perpDist = Math.abs(r.x - gun.x);

        if (perpDist < beamHalfWidth) {
          const distFromNozzle = clampedT * maxRange;
          const falloff = 1 - (distFromNozzle / maxRange) * 0.7;
          let damage = this.getWeaponDamage(player.currentWeapon) * player.damageMultiplier * falloff * gun.damageMult;

          if (r.type === RoachType.QUEEN) {
            damage *= (1 - BALANCE_CONFIG.collision.bossDamageResist);
          }
          this.applyWeaponEffect(r, player.currentWeapon);
          r.burnDamage += damage;
          r.inFire = true;
          this.triggerPanicOnArmorBreak(r, isStuckByBoard ? isStuckByBoard(r.id) : false);
        }
      }
    }
  }

  /**
   * 触发护甲破碎时的恐慌效果
   * @param roach 蟑螂对象
   * @param isStuckByBoard 是否被粘板粘住
   */
  triggerPanicOnArmorBreak(roach: Roach, isStuckByBoard: boolean): void {
    if (roach.armorHp <= 0 && roach.panicTimer <= 0 && !isStuckByBoard) {
      roach.panicTimer = BALANCE_CONFIG.collision.panicTimerMin + Math.random() * BALANCE_CONFIG.collision.panicTimerMax;
      
      if (roach.type === RoachType.SUICIDE || roach.type === RoachType.FLYING_SUICIDE) {
        // 自杀蟑螂：护甲破碎时冲向防御线
        // 角度指向下方（朝向防御线）并带有小的随机横向摆动
        roach.panicAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      } else {
        // 普通蟑螂：恐慌并随机方向逃跑
        roach.panicAngle = Math.random() * Math.PI * 2;
      }
    }
  }

  /**
   * 获取武器伤害值
   * @param weapon 武器类型
   * @returns 伤害值
   */
  getWeaponDamage(weapon: string): number {
    const config = this.weaponDamageConfigs[weapon];
    if (!config) {
      return this.config.difficulty === 'hard' ? BALANCE_CONFIG.weaponDamage.fallback.hard : BALANCE_CONFIG.weaponDamage.fallback.easy;
    }
    return config.baseDamage;
  }

  /**
   * 应用武器效果
   * @param roach 蟑螂对象
   * @param weapon 武器类型
   */
  applyWeaponEffect(roach: Roach, weapon: string): void {
    switch (weapon) {
      case 'poison':
        if (roach.poisonTimer <= 0) {
          roach.poisonTimer = BALANCE_CONFIG.collision.poisonTimer;
          roach.poisonDamage = roach.type === RoachType.QUEEN ? BALANCE_CONFIG.collision.poisonDamageQueen : BALANCE_CONFIG.collision.poisonDamageNormal;
        }
        break;
      // 粘板无伤害效果 - 由粘板系统处理
      case 'sticky':
        // 无直接伤害效果
        break;
      default:
        // 其他武器无特殊效果
        break;
    }
  }

  /**
   * 检查防线突破（完整版，含所有副作用回调）
   * @param roaches 蟑螂数组
   * @param defenseLineY 防线Y坐标
   * @param player 玩家对象
   * @param defenseHp 当前防线HP（会被修改）
   * @param activeBosses 当前活跃Boss数量（会被修改）
   * @param callbacks 副作用回调
   * @returns 突破检测结果
   */
  checkDefenseBreach(
    roaches: Roach[],
    defenseLineY: number,
    player: Player,
    defenseHp: { value: number },
    activeBosses: { value: number },
    callbacks: {
      onSuicideExplode?: (roach: Roach, index: number) => void;
      onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
      onPlayBreach?: () => void;
      onVibrateBreach?: () => void;
      onScreenShake?: (amount: number) => void;
      onBossStop?: boolean;
    }
  ): BreachResult {
    const removedIndices: number[] = [];
    const suicideExplodeIndices: number[] = [];
    let totalDefenseDamage = 0;
    let breachCount = 0;
    let gameOver = false;

    for (let i = roaches.length - 1; i >= 0; i--) {
      const r = roaches[i];
      if (!r || r.state !== RoachState.ALIVE) continue;

      const roachSize = ENEMY_DEFS[r.type]?.size || 30;
      const roachBottom = r.y + roachSize * 0.4;
      if (roachBottom < defenseLineY) continue;

      let dmg = 0;
      switch (r.type) {
        case RoachType.SMALL: dmg = this.config.difficulty === 'hard' ? BALANCE_CONFIG.collision.defenseBreachDamage.small.hard : BALANCE_CONFIG.collision.defenseBreachDamage.small.easy; break;
        case RoachType.LARGE: dmg = this.config.difficulty === 'hard' ? BALANCE_CONFIG.collision.defenseBreachDamage.large.hard : BALANCE_CONFIG.collision.defenseBreachDamage.large.easy; break;
        case RoachType.FLYING: dmg = this.config.difficulty === 'hard' ? BALANCE_CONFIG.collision.defenseBreachDamage.flying.hard : BALANCE_CONFIG.collision.defenseBreachDamage.flying.easy; break;
        case RoachType.ARMORED: dmg = this.config.difficulty === 'hard' ? BALANCE_CONFIG.collision.defenseBreachDamage.armored.hard : BALANCE_CONFIG.collision.defenseBreachDamage.armored.easy; break;
        case RoachType.SPLITTING: dmg = this.config.difficulty === 'hard' ? BALANCE_CONFIG.collision.defenseBreachDamage.splitting.hard : BALANCE_CONFIG.collision.defenseBreachDamage.splitting.easy; break;
        case RoachType.SUICIDE:
        case RoachType.FLYING_SUICIDE:
          suicideExplodeIndices.push(i);
          continue;
        case RoachType.TIMED_SUICIDE:
          if (r.hasPlacedBomb) { dmg = this.config.difficulty === 'hard' ? BALANCE_CONFIG.collision.defenseBreachDamage.timedSuicide.hard : BALANCE_CONFIG.collision.defenseBreachDamage.timedSuicide.easy; }
          else { r.y = defenseLineY - 64; continue; }
          break;
        case RoachType.QUEEN: dmg = this.config.difficulty === 'hard' ? BALANCE_CONFIG.collision.defenseBreachDamage.queen.hard : BALANCE_CONFIG.collision.defenseBreachDamage.queen.easy; break;
      }

      dmg = Math.floor(dmg * (1 - player.damageReduction));

      // Boss 安全网：不允许 BOSS 穿过防线
      if (callbacks.onBossStop && r.isBoss && r.type === RoachType.QUEEN) {
        r.y = Math.min(r.y, defenseLineY - 15);
        continue;
      }

      if (player.shieldTimer > 0) {
        callbacks.onAddFloatingText?.(r.x, defenseLineY - 20, '护盾抵消!', '#22d3ee');
      } else {
        defenseHp.value -= dmg;
        breachCount++;
        callbacks.onPlayBreach?.();
        callbacks.onVibrateBreach?.();
      }
      callbacks.onScreenShake?.(BALANCE_CONFIG.screenShake.breach);

      removedIndices.push(i);
      if (r.isBoss) activeBosses.value--;
      callbacks.onAddFloatingText?.(r.x, defenseLineY - 20, '防线突破!', '#ef4444');

      totalDefenseDamage += dmg;

      if (defenseHp.value <= 0) {
        defenseHp.value = 0;
        gameOver = true;
        break;
      }
    }

    return { gameOver, removedIndices, totalDefenseDamage, breachCount, suicideExplodeIndices };
  }

  /**
   * 对蟑螂应用伤害（含护甲、变异变身无敌、定时自爆放置免疫等逻辑）
   * @param r 蟑螂对象（原地修改）
   * @param damage 伤害值
   * @param armorShieldCache 护甲保护缓存（Set）
   */
  applyDamageToRoach(r: Roach, damage: number, armorShieldCache: Set<number>): void {
    if (r.isBoss) return;
    if (r.type === RoachType.MUTANT && r.transformTimer && r.transformTimer > 0) return;
    if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) return;
    if (r.spawnImmuneTimer && r.spawnImmuneTimer > 0) return;

    // 护甲肉盾保护：仅20%伤害穿透
    if (r.armorHp <= 0 && armorShieldCache.has(r.id)) {
      damage *= BALANCE_CONFIG.collision.armorDamageReduction;
    }

    // 护甲吸收80%火焰伤害
    if (r.armorHp > 0) {
      const armorAbsorb = Math.min(r.armorHp, damage * BALANCE_CONFIG.collision.armorAbsorbRatio);
      r.armorHp -= armorAbsorb;
      damage *= BALANCE_CONFIG.collision.armorDamageReduction;
      if (r.armorHp <= 0) {
        this.config.onSpawnSpark?.(r.x, r.y, 8);
        const label = r.type === RoachType.NURSE || r.type === RoachType.TIMED_SUICIDE ? '护甲碎裂!' : '破甲!';
        this.config.onAddFloatingText?.(r.x, r.y - 30, label, '#fbbf24');
      }
    }
    r.hp -= damage;
    const hasProtection = r.armorHp > 0;
    r.damageFlash = hasProtection ? 0 : (r.isBoss ? BALANCE_CONFIG.collision.bossDamageFlashDuration : BALANCE_CONFIG.collision.damageFlashDuration);
  }

  /**
   * 检查是否被粘板困住
   * @param roachId 蟑螂ID
   * @param stickyBoards 粘板数组
   * @param stickyDrops 粘液滴数组
   * @returns 是否被困住
   */
  isStuckByBoard(
    roachId: number,
    stickyBoards: Array<{ stuckRoaches: number[] }>,
    stickyDrops: Array<{ targetId: number | null }>
  ): boolean {
    // 检查传统粘板
    if (stickyBoards.some(board => board.stuckRoaches.includes(roachId))) {
      return true;
    }
    
    // 检查新粘液滴包裹
    if (stickyDrops.some(drop => drop.targetId === roachId)) {
      return true;
    }
    
    return false;
  }

  /**
   * 更新配置
   * @param newConfig 新的配置
   */
  updateConfig(newConfig: Partial<CollisionSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.adjustWeaponDamageForDifficulty();
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): CollisionSystemConfig {
    return { ...this.config };
  }
}