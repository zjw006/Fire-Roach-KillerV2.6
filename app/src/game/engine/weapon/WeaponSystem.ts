/**
 * @fileoverview 武器系统模块
 * @description 负责管理游戏中的武器掉落、拾取、切换和弹药系统
 */

import { GameState, GameMode, SceneType, type WeaponDrop, type Player, type InventoryItem } from '../../types';
import { WEAPON_DROP_DEFS, SCENE_ITEM_UNLOCKS } from '../../data';

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
  
  /** 玩家物品栏 */
  private inventory: InventoryItem[] = [];
  
  /** 场景特定的掉落配置 */
  private sceneDropConfigs: Record<SceneType, WeaponDropSpawnConfig> = {
    [SceneType.KITCHEN]: { spawnInterval: 40, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.SEWER]: { spawnInterval: 35, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.DUMP]: { spawnInterval: 30, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.BASEMENT]: { spawnInterval: 25, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.ROOFTOP]: { spawnInterval: 20, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.STREET]: { spawnInterval: 25, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.HOSPITAL]: { spawnInterval: 30, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.SUBWAY]: { spawnInterval: 25, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.SUPERMARKET]: { spawnInterval: 25, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.SCHOOL]: { spawnInterval: 25, dropCount: 1, dropLife: 12, bobSpeed: 4 },
    [SceneType.NEST]: { spawnInterval: 30, dropCount: 1, dropLife: 12, bobSpeed: 4 },
  };

  /**
   * 构造函数
   * @param config 武器系统配置
   */
  constructor(config: WeaponSystemConfig) {
    this.config = config;
    this.dropSpawnTimer = this.getCurrentSceneConfig().spawnInterval;
  }

  /**
   * 更新武器系统
   * @param deltaTime 时间增量
   * @param player 玩家对象
   * @param defenseLineY 防线Y坐标
   * @returns 更新后的武器掉落数组
   */
  update(
    deltaTime: number,
    player: Player,
    defenseLineY: number
  ): WeaponDrop[] {
    // 跳过非游戏状态
    if (this.config.gameState !== GameState.PLAYING) {
      return this.weaponDrops;
    }

    // 更新武器掉落
    this.updateWeaponDrops(deltaTime, player, defenseLineY);

    return this.weaponDrops;
  }

  /**
   * 更新武器掉落
   * @param deltaTime 时间增量
   * @param player 玩家对象
   * @param defenseLineY 防线Y坐标
   */
  private updateWeaponDrops(
    deltaTime: number,
    player: Player,
    defenseLineY: number
  ): void {
    const sceneConfig = this.getCurrentSceneConfig();
    
    // 更新掉落生成计时器
    this.dropSpawnTimer -= deltaTime;
    
    // 生成新的武器掉落
    if (this.dropSpawnTimer <= 0) {
      this.spawnWeaponDrop(sceneConfig.dropCount, defenseLineY);
      this.dropSpawnTimer = sceneConfig.spawnInterval;
    }

    // 更新现有掉落
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
      
      // 检查玩家拾取
      const dx = Math.abs(drop.x - player.x);
      if (dx < 60) {
        this.pickupWeaponDrop(drop, player);
        this.weaponDrops.splice(i, 1);
      }
    }
  }

  /**
   * 生成武器掉落
   * @param count 生成数量
   * @param defenseLineY 防线Y坐标
   */
  private spawnWeaponDrop(count: number, defenseLineY: number): void {
    // 获取当前场景可用的武器类型
    const availableTypes = this.getAvailableWeaponTypes();
    
    // 如果没有可用的武器类型，使用基础粘板
    if (availableTypes.length === 0) {
      availableTypes.push('sticky');
    }

    // 基础生成位置
    const baseX = 60 + Math.random() * (540 - 120); // 假设画布宽度为540
    const baseY = defenseLineY - 135 + Math.random() * 30;

    for (let i = 0; i < count; i++) {
      // 随机选择武器类型
      const typeIndex = Math.floor(Math.random() * availableTypes.length);
      const type = availableTypes[typeIndex] as WeaponDrop['type'];
      
      // 计算掉落位置
      const x = count > 1
        ? Math.max(40, Math.min(500, baseX + (i - (count - 1) / 2) * 100))
        : baseX;
      
      const y = baseY + (Math.random() - 0.5) * 20;
      
      // 创建新的武器掉落
      this.weaponDrops.push({
        id: Date.now() + i, // 使用时间戳作为ID
        x,
        y,
        type,
        life: this.getCurrentSceneConfig().dropLife,
        maxLife: this.getCurrentSceneConfig().dropLife,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * 获取当前场景可用的武器类型
   * @returns 可用的武器类型数组
   */
  private getAvailableWeaponTypes(): string[] {
    // 所有可能的武器类型
    const allWeaponTypes = ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'];
    
    // 使用玩家选择的物品（如果可用），否则使用场景默认解锁的物品
    const unlockedItems = this.config.selectedItems.length > 0
      ? this.config.selectedItems
      : (this.config.gameMode === GameMode.STORY
          ? (this.config.difficulty === 'hard' 
              ? allWeaponTypes 
              : (SCENE_ITEM_UNLOCKS[this.config.currentScene] || ['sticky']))
          : allWeaponTypes);
    
    // 过滤只包含玩家已解锁的武器
    const availableItems = unlockedItems.filter((item: string) =>
      this.config.unlockedWeapons.includes(item) || item === 'flamethrower'
    );
    
    // 回退：如果没有物品通过过滤，使用基础粘板
    return availableItems.length > 0 ? availableItems : ['sticky'];
  }

  /**
   * 拾取武器掉落
   * @param drop 武器掉落对象
   * @param player 玩家对象
   */
  private pickupWeaponDrop(drop: WeaponDrop, player: Player): void {
    const weaponDef = WEAPON_DROP_DEFS[drop.type];
    if (!weaponDef) {
      return;
    }

    // 应用资源节省天赋：拾取时额外+1弹药
    const itemAmmoBonus = this.config.talentMultipliers?.itemAmmo || 0;
    const pickupCount = 1 + itemAmmoBonus;

    // 更新玩家武器弹药
    this.updatePlayerWeaponAmmo(player, drop.type, pickupCount);

    // 生成拾取提示文本
    const bonusText = itemAmmoBonus > 0 ? `(+${itemAmmoBonus}天赋)` : '';
    console.log(`拾取: ${weaponDef.name}!${bonusText}`);
  }

  /**
   * 更新玩家武器弹药
   * @param player 玩家对象
   * @param weaponType 武器类型
   * @param ammoCount 弹药数量
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
    // 切换到喷火器
    if (weapon === 'flamethrower') {
      player.currentWeapon = 'flamethrower';
      player.isTempWeapon = false;
      return true;
    }

    // 检查武器是否已解锁
    const isUnlocked = this.config.unlockedWeapons.includes(weapon);
    if (!isUnlocked && !player.isTempWeapon) {
      return false;
    }

    // 检查弹药是否充足
    const ammo = player.weaponAmmo?.[weapon] || 0;
    if (ammo <= 0 && !player.isTempWeapon && weapon !== 'flamethrower') {
      return false;
    }

    // 切换武器
    player.currentWeapon = weapon as Player['currentWeapon'];
    
    // 显示切换提示
    const weaponDef = WEAPON_DROP_DEFS[weapon as keyof typeof WEAPON_DROP_DEFS];
    if (weaponDef) {
      console.log(`切换到: ${weaponDef.name}`);
    }

    return true;
  }

  /**
   * 获取当前场景的掉落配置
   * @returns 当前场景的掉落配置
   */
  private getCurrentSceneConfig(): WeaponDropSpawnConfig {
    return this.sceneDropConfigs[this.config.currentScene] || this.sceneDropConfigs[SceneType.KITCHEN];
  }

  /**
   * 获取所有武器掉落
   * @returns 武器掉落数组
   */
  getWeaponDrops(): WeaponDrop[] {
    return [...this.weaponDrops];
  }

  /**
   * 清空所有武器掉落
   */
  clearWeaponDrops(): void {
    this.weaponDrops = [];
  }

  /**
   * 获取玩家物品栏
   * @returns 物品栏数组
   */
  getInventory(): InventoryItem[] {
    return [...this.inventory];
  }

  /**
   * 更新配置
   * @param newConfig 新的配置
   */
  updateConfig(newConfig: Partial<WeaponSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): WeaponSystemConfig {
    return { ...this.config };
  }
}