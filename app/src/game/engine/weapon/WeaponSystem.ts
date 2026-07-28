/**
 * @fileoverview 武器系统模块
 * @description 负责管理游戏中的武器掉落、拾取、切换和弹药系统
 */

import { GameState, GameMode, SceneType, type WeaponDrop, type Player } from '../../types';
import { WEAPON_DROP_DEFS, SCENE_ITEM_UNLOCKS, BALANCE_CONFIG } from '../../data';

/** 喷火器武器类型标识 */
const FLAMETHROWER = 'flamethrower' as const;
/** 基础粘板回退类型 */
const FALLBACK_WEAPON = 'sticky' as const;
/** 所有武器类型列表 */
const ALL_WEAPON_TYPES = ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'] as const;

/**
 * 武器系统配置接口
 */
export interface WeaponSystemConfig {
  /** 游戏难度 */
  difficulty: 'easy' | 'hard';
  /** 当前游戏状态 */
  gameState: GameState;
  /** 游戏模式 */
  gameMode: GameMode;
  /** 当前场景 */
  currentScene: SceneType;
  /** 玩家已解锁的武器列表 */
  unlockedWeapons: string[];
  /** 玩家选择的物品列表（从准备界面） */
  selectedItems: string[];
  /** 玩家天赋加成 */
  talentMultipliers?: {
    /** 物品弹药加成 */
    itemAmmo?: number;
  };
  /** 画布宽度（用于掉落位置计算） */
  canvasWidth?: number;
  /** 场景敌人修正系数（用于调整掉落间隔） */
  sceneEnemyModifier?: number;
  /** 拾取武器掉落回调（用于浮动文字、屏幕震动、物品栏管理等） */
  onPickup?: (drop: WeaponDrop, pickupCount: number, bonusText: string) => void;
  /** 切换武器回调（用于浮动文字提示） */
  onSwitchWeapon?: (weapon: string, weaponName: string) => void;
}

/**
 * 武器掉落生成配置接口
 */
export interface WeaponDropSpawnConfig {
  /** 掉落生成间隔时间 */
  spawnInterval: number;
  /** 每次生成的掉落数量 */
  dropCount: number;
  /** 掉落生命周期 */
  dropLife: number;
  /** 掉落漂浮速度 */
  bobSpeed: number;
}

/**
 * 武器系统类
 * @description 管理游戏中的武器掉落、拾取、切换和弹药系统
 */
export class WeaponSystem {
  /** 系统配置 */
  private config: WeaponSystemConfig;

  /** 武器掉落数组 */
  private weaponDrops: WeaponDrop[] = [];

  /** 掉落生成计时器 */
  private dropSpawnTimer: number = 0;

  /** 掉落物ID计数器（实例级，避免模块级全局状态冲突） */
  private nextDropId: number = 1;

  /**
   * 构造函数
   * @param config 武器系统配置
   */
  constructor(config: WeaponSystemConfig) {
    this.config = config;
    this.dropSpawnTimer = this.getSceneDropConfig().spawnInterval;
  }

  /**
   * 更新武器系统
   * @param deltaTime 时间增量
   * @param player 玩家对象
   * @param defenseLineY 防线Y坐标
   * @param tutorialPauseSpawn 教程暂停生成标志
   * @returns 更新后的武器掉落数组
   */
  update(
    deltaTime: number,
    player: Player,
    defenseLineY: number,
    tutorialPauseSpawn: boolean = false
  ): WeaponDrop[] {
    // 跳过非游戏状态
    if (this.config.gameState !== GameState.PLAYING) {
      return this.weaponDrops;
    }

    // 更新武器掉落
    this.updateWeaponDrops(deltaTime, player, defenseLineY, tutorialPauseSpawn);

    return this.weaponDrops;
  }

  /**
   * 更新武器掉落
   */
  private updateWeaponDrops(
    deltaTime: number,
    player: Player,
    defenseLineY: number,
    tutorialPauseSpawn: boolean
  ): void {
    const sceneConfig = this.getSceneDropConfig();

    // 更新掉落生成计时器（跳过教程暂停期间）
    if (!tutorialPauseSpawn) {
      this.dropSpawnTimer -= deltaTime;

      // 生成新的武器掉落
      if (this.dropSpawnTimer <= 0) {
        this.spawnWeaponDrop(sceneConfig.dropCount, defenseLineY);
        // 应用场景敌人修正系数
        const enemyModifier = this.config.sceneEnemyModifier || 1;
        this.dropSpawnTimer = sceneConfig.spawnInterval / enemyModifier;
      }
    }

    // 更新现有掉落
    const pickupRadius = BALANCE_CONFIG.weaponDropScene.pickupRadius;
    for (let i = this.weaponDrops.length - 1; i >= 0; i--) {
      const drop = this.weaponDrops[i];

      // 更新掉落生命周期
      drop.life -= deltaTime;
      drop.bobPhase += deltaTime * sceneConfig.bobSpeed;

      // 移除过期的掉落
      if (drop.life <= 0) {
        this.weaponDrops.splice(i, 1);
        continue;
      }

      // 检查玩家拾取（X用玩家位置，Y用防线位置，因为玩家在防线处操作）
      const dx = Math.abs(drop.x - player.x);
      const dy = Math.abs(drop.y - defenseLineY);
      if (dx < pickupRadius && dy < pickupRadius) {
        this.pickupWeaponDrop(drop, player);
        this.weaponDrops.splice(i, 1);
      }
    }
  }

  /**
   * 生成武器掉落
   * @param _count 生成数量（保留参数以兼容未来扩展）
   * @param defenseLineY 防线Y坐标
   */
  private spawnWeaponDrop(_count: number, defenseLineY: number): void {
    // 获取当前场景可用的武器类型
    const availableTypes = this.getAvailableWeaponTypes();

    // 如果没有可用的武器类型，使用基础粘板
    if (availableTypes.length === 0) {
      availableTypes.push(FALLBACK_WEAPON);
    }

    const wdCfg = BALANCE_CONFIG.weaponDropScene;
    const canvasWidth = this.config.canvasWidth || 540;
    const baseX = wdCfg.pickBaseX + Math.random() * (canvasWidth - wdCfg.pickXRange * 2);
    const baseY = defenseLineY - wdCfg.spawnYOffset + Math.random() * wdCfg.spawnYRange;

    // 随机选择武器类型
    const typeIndex = Math.floor(Math.random() * availableTypes.length);
    const type = availableTypes[typeIndex] as WeaponDrop['type'];

    // 创建新的武器掉落
    this.weaponDrops.push({
      id: this.nextDropId++,
      x: baseX,
      y: baseY,
      type,
      life: wdCfg.dropLife,
      maxLife: wdCfg.dropLife,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  /**
   * 获取当前场景可用的武器类型
   */
  private getAvailableWeaponTypes(): string[] {
    // 使用玩家选择的物品（如果可用），否则使用场景默认解锁的物品
    const unlockedItems = this.config.selectedItems.length > 0
      ? this.config.selectedItems
      : (this.config.gameMode === GameMode.STORY
          ? (this.config.difficulty === 'hard'
              ? [...ALL_WEAPON_TYPES]
              : (SCENE_ITEM_UNLOCKS[this.config.currentScene] || [FALLBACK_WEAPON]))
          : [...ALL_WEAPON_TYPES]);

    // 过滤只包含玩家已解锁的武器（喷火器始终可用，独立处理）
    const availableItems = unlockedItems.filter((item: string) =>
      this.config.unlockedWeapons.includes(item) || item === FLAMETHROWER
    );

    // 回退：如果没有物品通过过滤，使用基础粘板
    return availableItems.length > 0 ? availableItems : [FALLBACK_WEAPON];
  }

  /**
   * 拾取武器掉落
   */
  private pickupWeaponDrop(drop: WeaponDrop, player: Player): void {
    const weaponDef = WEAPON_DROP_DEFS[drop.type];
    if (!weaponDef) {
      return;
    }

    // 应用资源节省天赋：拾取时额外+1弹药（确保整数）
    const itemAmmoBonus = Math.round(this.config.talentMultipliers?.itemAmmo || 0);
    const pickupCount = 1 + itemAmmoBonus;

    // 更新玩家武器弹药
    this.updatePlayerWeaponAmmo(player, drop.type, pickupCount);

    // 生成拾取提示文本
    const bonusText = itemAmmoBonus > 0 ? `(+${itemAmmoBonus}天赋)` : '';

    // 调用拾取回调（用于浮动文字、屏幕震动、物品栏管理等）
    this.config.onPickup?.(drop, pickupCount, bonusText);
  }

  /**
   * 更新玩家武器弹药
   */
  private updatePlayerWeaponAmmo(
    player: Player,
    weaponType: string,
    ammoCount: number
  ): void {
    // 初始化武器弹药记录（如果不存在）
    if (!player.weaponAmmo) {
      player.weaponAmmo = {};
    }

    // 更新弹药数量
    if (player.weaponAmmo[weaponType] !== undefined) {
      player.weaponAmmo[weaponType] += ammoCount;
    } else {
      player.weaponAmmo[weaponType] = ammoCount;
    }
  }

  /**
   * 切换武器
   * @param player 玩家对象
   * @param weapon 目标武器类型
   * @returns 是否切换成功
   */
  switchWeapon(player: Player, weapon: string): boolean {
    // 喷火器：始终可用，无需弹药
    if (weapon === FLAMETHROWER) {
      player.currentWeapon = FLAMETHROWER;
      player.isTempWeapon = false;
      return true;
    }

    // 检查武器是否已解锁
    if (!this.config.unlockedWeapons.includes(weapon)) {
      return false;
    }

    // 检查弹药是否充足
    const ammo = player.weaponAmmo?.[weapon] || 0;
    if (ammo <= 0) {
      return false;
    }

    // 切换武器
    player.currentWeapon = weapon as Player['currentWeapon'];
    player.isTempWeapon = false;

    // 显示切换提示
    const weaponDef = WEAPON_DROP_DEFS[weapon as keyof typeof WEAPON_DROP_DEFS];
    if (weaponDef) {
      this.config.onSwitchWeapon?.(weapon, weaponDef.name);
    }

    return true;
  }

  /**
   * 获取当前场景的掉落配置（工厂函数，消除重复的对象字面量）
   */
  private getSceneDropConfig(): WeaponDropSpawnConfig {
    const sceneCfg = BALANCE_CONFIG.weaponDropScene;
    const sceneKey = this.config.currentScene;
    return {
      spawnInterval: sceneCfg.spawnIntervals[sceneKey] || sceneCfg.spawnIntervals.kitchen,
      dropCount: 1,
      dropLife: sceneCfg.dropLife,
      bobSpeed: sceneCfg.bobSpeed,
    };
  }

  /**
   * 获取所有武器掉落
   */
  getWeaponDrops(): WeaponDrop[] {
    return this.weaponDrops;
  }

  /**
   * 清空所有武器掉落
   */
  clearWeaponDrops(): void {
    this.weaponDrops = [];
  }

  /**
   * 重置武器系统（清空掉落和计时器）
   */
  reset(): void {
    this.weaponDrops = [];
    this.dropSpawnTimer = this.getSceneDropConfig().spawnInterval;
    this.nextDropId = 1;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<WeaponSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): WeaponSystemConfig {
    return { ...this.config };
  }
}