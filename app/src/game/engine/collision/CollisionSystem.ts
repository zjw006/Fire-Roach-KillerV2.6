/**
 * @fileoverview 碰撞检测系统模块
 * @description 负责处理游戏中的碰撞检测、伤害计算和武器效果应用
 */

import { GameState, RoachType, RoachState, type Roach, type Player, type TripleFlameState } from '../../types';
import { ENEMY_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/**
 * 碰撞检测系统配置接口
 */
export interface CollisionSystemConfig {
  /** 游戏难度 */
  difficulty: 'easy' | 'hard';
  /** 当前场景 */
  currentScene: string;
  /** 玩家天赋伤害加成 */
  talentDamageMultiplier?: number;
  /** 玩家天赋防御加成 */
  talentDefenseMultiplier?: number;
  // ===== 回调（统一管理，修复 P1：回调不再分散在 config 和参数中） =====
  /** 添加浮动文字 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 生成火花粒子 */
  onSpawnSpark?: (x: number, y: number, count: number) => void;
  /** 播放突破音效 */
  onPlayBreach?: () => void;
  /** 震动（突破） */
  onVibrateBreach?: () => void;
  /** 震动（游戏结束） */
  onVibrateGameOver?: () => void;
  /** 屏幕震动 */
  onScreenShake?: (amount: number) => void;
  /** 自杀爆炸处理 */
  onSuicideExplode?: (roach: Roach, index: number) => void;
}

/**
 * 武器伤害配置接口
 */
export interface WeaponDamageConfig {
  /** 基础伤害 */
  baseDamage: number;
  /** 伤害衰减系数 */
  falloffFactor: number;
}

/**
 * 防线突破检测结果
 */
export interface BreachResult {
  /** 防线血量是否归零（游戏结束） */
  gameOver: boolean;
  /** 被移除的蟑螂索引列表（从大到小排序，便于外部 splice） */
  removedIndices: number[];
  /** 自杀爆炸的蟑螂索引列表（从大到小排序） */
  suicideExplodeIndices: number[];
  /** 总防线伤害 */
  totalDefenseDamage: number;
  /** 突破次数 */
  breachCount: number;
  /** 更新后的防线HP（修复 P1：不再用对象包装传引用） */
  defenseHp: number;
  /** 更新后的活跃Boss数（修复 P1：不再用对象包装传引用） */
  activeBosses: number;
}

/**
 * 碰撞检测系统类
 * @description 管理游戏中的碰撞检测、伤害计算和武器效果
 */
export class CollisionSystem {
  /** 系统配置 */
  private config: CollisionSystemConfig;
  
  /** 武器伤害配置 */
  private weaponDamageConfigs!: Record<string, WeaponDamageConfig>;

  /**
   * 构造函数
   */
  constructor(config: CollisionSystemConfig) {
    this.config = config;
    this.adjustWeaponDamageForDifficulty();
  }

  /**
   * 根据难度调整武器伤害配置
   */
  private adjustWeaponDamageForDifficulty(): void {
    const isHard = this.config.difficulty === 'hard';
    const wd = BALANCE_CONFIG.weaponDamage;
    this.weaponDamageConfigs = {
      flamethrower: { baseDamage: isHard ? wd.flamethrower.hard : wd.flamethrower.easy, falloffFactor: 0.7 },
      sticky: { baseDamage: 0, falloffFactor: 0 },
      poison: { baseDamage: isHard ? wd.poison.hard : wd.poison.easy, falloffFactor: 0.7 },
      shotgun: { baseDamage: isHard ? wd.shotgun.hard : wd.shotgun.easy, falloffFactor: 0.5 },
      molotov: { baseDamage: isHard ? wd.molotov.hard : wd.molotov.easy, falloffFactor: 0.6 },
    };
  }

  /**
   * 检查火焰与蟑螂的碰撞（原地修改模式，与旧引擎行为一致）
   * @param player 玩家对象
   * @param roaches 蟑螂数组（原地修改）
   * @param tripleFlame 三重火焰状态
   * @param isStuckByBoard 检查蟑螂是否被粘板粘住的函数（单参数回调）
   */
  checkFlameCollisions(
    player: Player,
    roaches: Roach[],
    tripleFlame?: TripleFlameState,
    isStuckByBoard?: (roachId: number) => boolean
  ): void {
    if (!player.isFiring || player.isOverheated || player.isReloading || player.gas <= 0) return;

    const colCfg = BALANCE_CONFIG.collision;
    const nozzleY = player.y - BALANCE_CONFIG.player.nozzleOffsetY;
    const maxRange = player.fireRange * colCfg.flameRangeRatio;
    const beamHalfWidth = colCfg.beamHalfWidth;

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
          const flyHitWidth = beamHalfWidth * colCfg.flyingHitWidthMultiplier;
          if (flyDist < flyHitWidth && vertDist > 0 && vertDist < maxRange * colCfg.flyingRangeMultiplier) {
            const falloff = 1 - (vertDist / (maxRange * colCfg.flyingFalloffRange)) * colCfg.flameFalloffFactor;
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
          const falloff = 1 - (distFromNozzle / maxRange) * colCfg.flameFalloffFactor;
          let damage = this.getWeaponDamage(player.currentWeapon) * player.damageMultiplier * falloff * gun.damageMult;

          if (r.type === RoachType.QUEEN) {
            damage *= (1 - colCfg.bossDamageResist);
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
      const colCfg = BALANCE_CONFIG.collision;
      roach.panicTimer = colCfg.panicTimerMin + Math.random() * colCfg.panicTimerMax;
      
      if (roach.type === RoachType.SUICIDE || roach.type === RoachType.FLYING_SUICIDE) {
        // 自杀蟑螂：护甲破碎时冲向防御线
        roach.panicAngle = Math.PI / 2 + (Math.random() - 0.5) * colCfg.panicAngleHalfRange * 2;
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
      const isHard = this.config.difficulty === 'hard';
      return isHard ? BALANCE_CONFIG.weaponDamage.fallback.hard : BALANCE_CONFIG.weaponDamage.fallback.easy;
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
          const colCfg = BALANCE_CONFIG.collision;
          roach.poisonTimer = colCfg.poisonTimer;
          roach.poisonDamage = roach.type === RoachType.QUEEN ? colCfg.poisonDamageQueen : colCfg.poisonDamageNormal;
        }
        break;
      case 'sticky':
        // 粘板无直接伤害效果 - 由粘板系统处理
        break;
      default:
        break;
    }
  }

  /**
   * 获取某类型蟑螂的防线突破伤害（修复 P1：消除 8 次重复难度判断）
   */
  private getDefenseBreachDamage(type: RoachType): number {
    const isHard = this.config.difficulty === 'hard';
    const dbd = BALANCE_CONFIG.collision.defenseBreachDamage;
    switch (type) {
      case RoachType.SMALL: return isHard ? dbd.small.hard : dbd.small.easy;
      case RoachType.LARGE: return isHard ? dbd.large.hard : dbd.large.easy;
      case RoachType.FLYING: return isHard ? dbd.flying.hard : dbd.flying.easy;
      case RoachType.ARMORED: return isHard ? dbd.armored.hard : dbd.armored.easy;
      case RoachType.SPLITTING: return isHard ? dbd.splitting.hard : dbd.splitting.easy;
      case RoachType.TIMED_SUICIDE: return isHard ? dbd.timedSuicide.hard : dbd.timedSuicide.easy;
      case RoachType.QUEEN: return isHard ? dbd.queen.hard : dbd.queen.easy;
      default: return 0;
    }
  }

  /**
   * 检查防线突破
   * 修复 P1：defenseHp/activeBosses 改为值传递+返回，不再用对象包装
   * 修复 P1：回调统一从 config 读取，不再分散在参数中
   * 修复 P2：onBossStop → isBossActive
   * @param roaches 蟑螂数组
   * @param defenseLineY 防线Y坐标
   * @param player 玩家对象
   * @param defenseHp 当前防线HP
   * @param activeBosses 当前活跃Boss数量
   * @param isBossActive Boss是否活跃（修复 P2：命名从 onBossStop 改为 isBossActive）
   * @returns 突破检测结果（含更新后的 defenseHp 和 activeBosses）
   */
  checkDefenseBreach(
    roaches: Roach[],
    defenseLineY: number,
    player: Player,
    defenseHp: number,
    activeBosses: number,
    isBossActive: boolean,
  ): BreachResult {
    const removedIndices: number[] = [];
    const suicideExplodeIndices: number[] = [];
    let totalDefenseDamage = 0;
    let breachCount = 0;
    let gameOver = false;
    let hp = defenseHp;
    let bosses = activeBosses;

    const colCfg = BALANCE_CONFIG.collision;

    for (let i = roaches.length - 1; i >= 0; i--) {
      const r = roaches[i];
      if (!r || r.state !== RoachState.ALIVE) continue;

      const roachSize = ENEMY_DEFS[r.type]?.size || 30;
      const roachBottom = r.y + roachSize * 0.4;
      if (roachBottom < defenseLineY) continue;

      // 自杀蟑螂：记录待处理
      if (r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) {
        suicideExplodeIndices.push(i);
        continue;
      }

      // 定时自爆未放炸弹：修复 P0 死循环 —— 不再无限回推，改为直接移除
      if (r.type === RoachType.TIMED_SUICIDE) {
        if (r.hasPlacedBomb) {
          // 已放炸弹，正常造成伤害
          const dmg = Math.floor(this.getDefenseBreachDamage(RoachType.TIMED_SUICIDE) * (1 - player.damageReduction));
          removedIndices.push(i);
          hp = this.applyBreachDamage(r, dmg, hp, defenseLineY, player);
          totalDefenseDamage += dmg;
          breachCount++;
        } else {
          // 未放炸弹：直接移除（不造成伤害），避免死循环
          removedIndices.push(i);
        }
        if (r.isBoss) bosses--;
        continue;
      }

      // 其他类型：计算伤害
      const dmg = Math.floor(this.getDefenseBreachDamage(r.type) * (1 - player.damageReduction));

      // Boss 安全网：修复 P2 —— 使用 isBossActive 替代 onBossStop
      if (isBossActive && r.isBoss && r.type === RoachType.QUEEN) {
        r.y = Math.min(r.y, defenseLineY - BALANCE_CONFIG.boss.defenseLineOffset);
        continue;
      }

      if (player.shieldTimer > 0) {
        this.config.onAddFloatingText?.(r.x, defenseLineY - colCfg.breachTextYOffset, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
      } else {
        hp = this.applyBreachDamage(r, dmg, hp, defenseLineY, player);
        totalDefenseDamage += dmg;
        breachCount++;
      }

      removedIndices.push(i);
      if (r.isBoss) bosses--;

      if (hp <= 0) {
        hp = 0;
        gameOver = true;
        break;
      }
    }

    return { gameOver, removedIndices, suicideExplodeIndices, totalDefenseDamage, breachCount, defenseHp: hp, activeBosses: bosses };
  }

  /**
   * 应用防线突破伤害并触发副作用（提取公共逻辑）
   */
  private applyBreachDamage(
    r: Roach,
    dmg: number,
    defenseHp: number,
    defenseLineY: number,
    player: Player,
  ): number {
    const colCfg = BALANCE_CONFIG.collision;
    if (player.shieldTimer > 0) {
      this.config.onAddFloatingText?.(r.x, defenseLineY - colCfg.breachTextYOffset, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
      return defenseHp;
    }
    this.config.onPlayBreach?.();
    this.config.onVibrateBreach?.();
    this.config.onScreenShake?.(BALANCE_CONFIG.screenShake.breach);
    this.config.onAddFloatingText?.(r.x, defenseLineY - colCfg.breachTextYOffset, TEXT_CONFIG.combat.defenseBreach.text, TEXT_CONFIG.combat.defenseBreach.color);
    return defenseHp - dmg;
  }

  /**
   * 对蟑螂应用伤害（含护甲、变异变身无敌、定时自爆放置免疫等逻辑）
   * 修复 P0：重命名 armorShieldCache → nearbyArmorProtection 并添加注释说明逻辑
   * @param r 蟑螂对象（原地修改）
   * @param damage 伤害值
   * @param nearbyArmorProtection 附近护甲保护缓存（包含护甲已破但受附近装甲蟑螂保护的蟑螂ID）
   */
  applyDamageToRoach(r: Roach, damage: number, nearbyArmorProtection: Set<number>): void {
    if (r.isBoss) return;
    if (r.type === RoachType.MUTANT && r.transformTimer && r.transformTimer > 0) return;
    if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) return;
    if (r.spawnImmuneTimer && r.spawnImmuneTimer > 0) return;

    const colCfg = BALANCE_CONFIG.collision;

    // 附近装甲蟑螂保护：护甲已破的蟑螂若在附近装甲蟑螂保护范围内，仅承受 20% 伤害
    if (r.armorHp <= 0 && nearbyArmorProtection.has(r.id)) {
      damage *= colCfg.armorDamageReduction;
    }

    // 护甲吸收伤害
    if (r.armorHp > 0) {
      const armorAbsorb = Math.min(r.armorHp, damage * colCfg.armorAbsorbRatio);
      r.armorHp -= armorAbsorb;
      damage *= colCfg.armorDamageReduction;
      if (r.armorHp <= 0) {
        this.config.onSpawnSpark?.(r.x, r.y, colCfg.armorBreakSparkCount);
        const label = r.type === RoachType.NURSE || r.type === RoachType.TIMED_SUICIDE ? TEXT_CONFIG.combat.armorShatter.text : TEXT_CONFIG.combat.armorBreak.text;
        this.config.onAddFloatingText?.(r.x, r.y - colCfg.armorBreakTextYOffset, label, TEXT_CONFIG.combat.armorBreak.color);
      }
    }
    r.hp -= damage;
    const hasProtection = r.armorHp > 0;
    r.damageFlash = hasProtection ? 0 : (r.isBoss ? colCfg.bossDamageFlashDuration : colCfg.damageFlashDuration);
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CollisionSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.adjustWeaponDamageForDifficulty();
  }

  /**
   * 获取当前配置
   */
  getConfig(): CollisionSystemConfig {
    return { ...this.config };
  }
}