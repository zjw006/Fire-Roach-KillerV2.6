/**
 * @fileoverview 碰撞检测系统模块
 * @description 负责处理游戏中的碰撞检测、伤害计算和武器效果应用
 */

import { GameState, RoachType, RoachState, type Roach, type Player, type TripleFlameState } from '../../types';
import { ENEMY_DEFS, BOSS_CONFIG } from '../../data';

/**
 * 碰撞检测系统配置接口
 */
export interface CollisionSystemConfig {
  /** 游戏难度 */
  difficulty: 'easy' | 'hard';
  /** 当前游戏状态 */
  gameState: GameState;
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
      flamethrower: { baseDamage: 45, falloffFactor: 0.7 },
      sticky: { baseDamage: 0, falloffFactor: 0 }, // 粘板无伤害
      poison: { baseDamage: 20, falloffFactor: 0.7 },
      shotgun: { baseDamage: 50, falloffFactor: 0.5 },
      molotov: { baseDamage: 40, falloffFactor: 0.6 },
    };
    
    // 根据难度调整伤害
    if (this.config.difficulty === 'hard') {
      this.weaponDamageConfigs.flamethrower.baseDamage = 30;
      this.weaponDamageConfigs.poison.baseDamage = 12;
      this.weaponDamageConfigs.shotgun.baseDamage = 35;
      this.weaponDamageConfigs.molotov.baseDamage = 25;
    }
  }

  /**
   * 检查火焰与蟑螂的碰撞
   * @param player 玩家对象
   * @param roaches 蟑螂数组
   * @param tripleFlame 三重火焰状态
   * @param isStuckByBoard 检查蟑螂是否被粘板粘住的函数
   * @returns 更新后的蟑螂数组
   */
  checkFlameCollisions(
    player: Player,
    roaches: Roach[],
    tripleFlame?: TripleFlameState,
    isStuckByBoard?: (roachId: number) => boolean
  ): Roach[] {
    if (!player.isFiring || player.isOverheated || player.isReloading || player.gas <= 0) {
      return roaches;
    }

    // 确定喷火器位置
    const nozzleY = player.y - 322;
    const maxRange = player.fireRange * 0.5;
    const beamHalfWidth = 15;

    // 构建枪口位置列表（支持三重火焰）
    const guns: { x: number; damageMult: number }[] = [
      { x: player.x, damageMult: 1.0 }, // 中心主枪口
    ];

    // 添加侧边枪口（如果三重火焰激活）
    if (tripleFlame?.active) {
      guns.push({ 
        x: player.x - tripleFlame.sideOffset, 
        damageMult: tripleFlame.sideDamageMult 
      });
      guns.push({ 
        x: player.x + tripleFlame.sideOffset, 
        damageMult: tripleFlame.sideDamageMult 
      });
    }

    // 更新每个蟑螂的燃烧伤害
    return roaches.map(roach => {
      if (roach.state !== RoachState.ALIVE || roach.isBoss) {
        return roach;
      }

      // 医院场景专属：放置炸弹的定时自杀蟑螂免疫伤害
      if (roach.type === RoachType.TIMED_SUICIDE && roach.placeTimer && roach.placeTimer > 0) {
        return roach;
      }

      let totalDamage = 0;
      let inFire = false;

      for (const gun of guns) {
        const collisionResult = this.checkSingleFlameCollision(
          player,
          roach,
          gun,
          nozzleY,
          maxRange,
          beamHalfWidth
        );

        if (collisionResult.hit) {
          totalDamage += collisionResult.damage;
          inFire = true;
          
          // 应用武器效果
          if (collisionResult.effectTriggered) {
            this.applyWeaponEffect(roach, player.currentWeapon);
          }
          
          // 触发护甲破碎时的恐慌效果
          if (isStuckByBoard) {
            this.triggerPanicOnArmorBreak(roach, isStuckByBoard(roach.id));
          }
        }
      }

      // 更新蟑螂状态
      if (totalDamage > 0) {
        return {
          ...roach,
          burnDamage: roach.burnDamage + totalDamage,
          inFire: inFire || roach.inFire,
        };
      }

      return roach;
    });
  }

  /**
   * 检查单个火焰与蟑螂的碰撞
   * @param player 玩家对象
   * @param roach 蟑螂对象
   * @param gun 枪口配置
   * @param nozzleY 喷火器Y坐标
   * @param maxRange 最大射程
   * @param beamHalfWidth 火焰半宽
   * @returns 碰撞检测结果
   */
  private checkSingleFlameCollision(
    player: Player,
    roach: Roach,
    gun: { x: number; damageMult: number },
    nozzleY: number,
    maxRange: number,
    beamHalfWidth: number
  ): CollisionResult {
    // 飞行蟑螂的特殊处理
    if (roach.type === RoachType.FLYING || roach.type === RoachType.FLYING_SUICIDE) {
      return this.checkFlyingRoachCollision(player, roach, gun, nozzleY, maxRange, beamHalfWidth);
    }

    // 地面蟑螂的碰撞检测
    const t = -(roach.y - nozzleY) / maxRange;
    const clampedT = Math.max(0, Math.min(1, t));
    const perpDist = Math.abs(roach.x - gun.x);

    if (perpDist < beamHalfWidth) {
      const distFromNozzle = clampedT * maxRange;
      const falloff = 1 - (distFromNozzle / maxRange) * 0.7;
      
      // 计算伤害
      let damage = this.getWeaponDamage(player.currentWeapon) * 
                   player.damageMultiplier * 
                   falloff * 
                   gun.damageMult;

      // 女王蟑螂伤害减免
      if (roach.type === RoachType.QUEEN) {
        damage *= (1 - BOSS_CONFIG.queen.resistPercent);
      }

      return {
        hit: true,
        damage,
        effectTriggered: true,
        effectType: player.currentWeapon,
      };
    }

    return {
      hit: false,
      damage: 0,
      effectTriggered: false,
    };
  }

  /**
   * 检查飞行蟑螂的碰撞
   * @param player 玩家对象
   * @param roach 飞行蟑螂对象
   * @param gun 枪口配置
   * @param nozzleY 喷火器Y坐标
   * @param maxRange 最大射程
   * @param beamHalfWidth 火焰半宽
   * @returns 碰撞检测结果
   */
  private checkFlyingRoachCollision(
    player: Player,
    roach: Roach,
    gun: { x: number; damageMult: number },
    nozzleY: number,
    maxRange: number,
    beamHalfWidth: number
  ): CollisionResult {
    const flyDist = Math.abs(roach.x - gun.x);
    const vertDist = nozzleY - roach.y;
    const flyHitWidth = beamHalfWidth * 4; // 飞行蟑螂有更宽的命中范围

    if (flyDist < flyHitWidth && vertDist > 0 && vertDist < maxRange * 1.3) {
      const falloff = 1 - (vertDist / (maxRange * 1.2)) * 0.7;
      
      // 计算伤害
      let damage = this.getWeaponDamage(player.currentWeapon) * 
                   player.damageMultiplier * 
                   falloff * 
                   gun.damageMult;

      // 女王蟑螂伤害减免
      if (roach.type === RoachType.QUEEN) {
        damage *= (1 - BOSS_CONFIG.queen.resistPercent);
      }

      return {
        hit: true,
        damage,
        effectTriggered: true,
        effectType: player.currentWeapon,
      };
    }

    return {
      hit: false,
      damage: 0,
      effectTriggered: false,
    };
  }

  /**
   * 触发护甲破碎时的恐慌效果
   * @param roach 蟑螂对象
   * @param isStuckByBoard 是否被粘板粘住
   */
  triggerPanicOnArmorBreak(roach: Roach, isStuckByBoard: boolean): void {
    if (roach.armorHp <= 0 && roach.panicTimer <= 0 && !isStuckByBoard) {
      roach.panicTimer = 0.3 + Math.random() * 0.5;
      
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
      return this.config.difficulty === 'hard' ? 30 : 45;
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
          roach.poisonTimer = 5;
          roach.poisonDamage = roach.type === RoachType.QUEEN ? 2 : 1;
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
   * 检查防线突破
   * @param roaches 蟑螂数组
   * @param defenseLineY 防线Y坐标
   * @param player 玩家对象
   * @returns 突破防线的蟑螂ID数组和总伤害
   */
  checkDefenseBreach(
    roaches: Roach[],
    defenseLineY: number,
    player: Player
  ): { breachedRoachIds: number[]; totalDamage: number } {
    const breachedRoachIds: number[] = [];
    let totalDamage = 0;

    for (const roach of roaches) {
      if (!roach || roach.state !== RoachState.ALIVE) {
        continue;
      }

      const roachSize = ENEMY_DEFS[roach.type]?.size || 30;
      const roachBottom = roach.y + roachSize * 0.4;

      if (roachBottom >= defenseLineY) {
        // 计算伤害
        const damage = this.calculateBreachDamage(roach.type);
        
        // 应用玩家伤害减免
        const finalDamage = Math.floor(damage * (1 - player.damageReduction));
        
        breachedRoachIds.push(roach.id);
        totalDamage += finalDamage;
      }
    }

    return { breachedRoachIds, totalDamage };
  }

  /**
   * 计算防线突破伤害
   * @param roachType 蟑螂类型
   * @returns 伤害值
   */
  private calculateBreachDamage(roachType: RoachType): number {
    const isHard = this.config.difficulty === 'hard';
    
    switch (roachType) {
      case RoachType.SMALL:
        return isHard ? 5 : 2;
      case RoachType.LARGE:
        return isHard ? 15 : 5;
      case RoachType.FLYING:
        return isHard ? 8 : 3;
      case RoachType.ARMORED:
        return isHard ? 12 : 4;
      case RoachType.SPLITTING:
        return isHard ? 10 : 4;
      case RoachType.SUICIDE:
      case RoachType.FLYING_SUICIDE:
        // 自杀蟑螂爆炸伤害，这里返回基础值，实际爆炸逻辑在其他地方处理
        return isHard ? 20 : 8;
      case RoachType.TIMED_SUICIDE:
        // 定时自杀蟑螂放置炸弹后的伤害
        return isHard ? 15 : 5;
      case RoachType.QUEEN:
        return isHard ? 35 : 12;
      default:
        return isHard ? 10 : 4;
    }
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