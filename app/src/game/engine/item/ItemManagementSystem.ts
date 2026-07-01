/**
 * @fileoverview 道具管理系统模块
 * @description 负责管理游戏中的道具解锁、选择、库存和持久化存储
 */

import { SceneType, GameMode, type GameProgress } from '../../types';
import { SCENE_REWARD_ITEMS, CONSUMABLE_DEFS, SCENE_ITEM_UNLOCKS, WEAPON_DROP_DEFS } from '../../data';

/**
 * 道具管理系统配置接口
 */
export interface ItemManagementSystemConfig {
  /** 当前场景 */
  currentScene: SceneType;
  /** 游戏模式 */
  gameMode: GameMode;
  /** 游戏难度 */
  difficulty?: 'easy' | 'normal' | 'hard';
  /** 游戏进度 */
  gameProgress: GameProgress;
  /** 画布宽度 */
  canvasWidth?: number;
  /** 画布高度 */
  canvasHeight?: number;
  /** 防御线Y坐标 */
  defenseLineY?: number;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 播放音效回调 */
  onPlaySound?: (soundId: 'pickup' | 'item_drop_fanfare') => void;
}

/**
 * 道具掉落接口
 */
export interface WeaponDrop {
  /** 掉落ID */
  id: number;
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** 道具类型 */
  type: string;
  /** 剩余生命 */
  life: number;
  /** 最大生命 */
  maxLife: number;
  /** 浮动相位 */
  bobPhase: number;
}

/**
 * 道具掉落定义接口
 */
export interface WeaponDropDef {
  /** 道具名称 */
  name: string;
  /** 道具图标 */
  icon: string;
  /** 道具描述 */
  desc: string;
  /** 最大堆叠数量 */
  maxStack?: number;
}

/**
 * 道具解锁数据接口
 */
export interface ItemUnlockData {
  /** 道具类型 */
  type: string;
  /** 道具名称 */
  name: string;
  /** 道具图标 */
  icon: string;
  /** 道具描述 */
  desc: string;
}

/**
 * 道具管理系统类
 * @description 管理游戏中的道具解锁、选择、库存和持久化存储
 */
export class ItemManagementSystem {
  /** 系统配置 */
  private config: ItemManagementSystemConfig;
  /** 道具揭示数据 */
  private itemRevealData: ItemUnlockData[] = [];
  /** 玩家选择的道具列表 */
  private selectedItems: string[] = [];
  /** 消耗品库存 */
  private consumableInventory: Record<string, number> = {};
  /** 自动使用设置 */
  private autoUseEnabled: Record<string, boolean> = {};
  /** 奖励索引 */
  private rewardIndex: number = 0;
  /** 道具掉落列表 */
  private weaponDrops: WeaponDrop[] = [];
  /** 下一个掉落ID */
  private nextDropId: number = 1;
  /** 道具库存 */
  private inventory: Array<{ type: string; quantity: number }> = [];
  /** 道具掉落动画数据 */
  private itemDropOnField: {
    type: string;
    name: string;
    icon: string;
    x: number;
    y: number;
    targetY: number;
    bobPhase: number;
    collected: boolean;
    falling: boolean;
    fallSpeed: number;
  } | null = null;

  /**
   * 构造函数
   * @param config - 系统配置
   */
  constructor(config: ItemManagementSystemConfig) {
    this.config = config;
    
    // 从游戏进度中恢复数据
    this.restoreFromProgress();
  }

  /**
   * 从游戏进度中恢复数据
   */
  private restoreFromProgress(): void {
    const progress = this.config.gameProgress;
    
    // 恢复消耗品库存
    if (progress.consumableInventory) {
      this.consumableInventory = { ...progress.consumableInventory };
    }
    
    // 恢复自动使用设置
    if (progress.autoUseEnabled) {
      this.autoUseEnabled = { ...progress.autoUseEnabled };
    }
  }

  /**
   * 获取道具揭示数据
   * @returns 道具揭示数据数组
   */
  getItemRevealData(): ItemUnlockData[] {
    return [...this.itemRevealData];
  }

  /**
   * 获取玩家选择的道具列表
   * @returns 选择的道具列表
   */
  getSelectedItems(): string[] {
    return [...this.selectedItems];
  }

  /**
   * 获取消耗品库存
   * @returns 消耗品库存对象
   */
  getConsumableInventory(): Record<string, number> {
    return { ...this.consumableInventory };
  }

  /**
   * 获取自动使用设置
   * @returns 自动使用设置对象
   */
  getAutoUseEnabled(): Record<string, boolean> {
    return { ...this.autoUseEnabled };
  }

  /**
   * 设置玩家选择的道具
   * @param items - 道具ID数组
   */
  setSelectedItems(items: string[]): void {
    this.selectedItems = [...items];
  }

  /**
   * 检查场景解锁的道具
   * @param scene - 场景类型
   * @returns 新解锁的道具数组
   */
  checkSceneUnlocks(scene: SceneType): ItemUnlockData[] {
    const sceneUnlocks = SCENE_REWARD_ITEMS[scene] || [];
    const newlyUnlocked: ItemUnlockData[] = [];
    
    for (const unlock of sceneUnlocks) {
      // 检查是否已经解锁（兼容weaponsUnlocked和unlockedItems两个字段）
      const alreadyUnlocked = 
        this.config.gameProgress.unlockedItems?.includes(unlock.type) ||
        this.config.gameProgress.weaponsUnlocked?.includes(unlock.type);
      
      if (!alreadyUnlocked) {
        newlyUnlocked.push(unlock);
        
        // 添加到已解锁列表（同时更新两个字段以保持兼容性）
        if (!this.config.gameProgress.unlockedItems) {
          this.config.gameProgress.unlockedItems = [];
        }
        if (!this.config.gameProgress.weaponsUnlocked) {
          this.config.gameProgress.weaponsUnlocked = [];
        }
        
        this.config.gameProgress.unlockedItems.push(unlock.type);
        this.config.gameProgress.weaponsUnlocked.push(unlock.type);
      }
    }
    
    return newlyUnlocked;
  }

  /**
   * 开始道具揭示序列
   * @param unlocks - 要揭示的道具数组
   */
  startItemReveal(unlocks: ItemUnlockData[]): void {
    this.itemRevealData = [...unlocks];
    this.rewardIndex = 0;
    
    if (this.itemRevealData.length > 0) {
      this.spawnNextRewardDrop(0);
    }
  }

  /**
   * 生成下一个奖励掉落
   * @param index - 奖励索引
   */
  spawnNextRewardDrop(index: number): void {
    this.rewardIndex = index;
    const reward = this.itemRevealData[index];
    if (!reward) return;

    // 开始道具掉落动画
    this.startItemDropAnimation(reward);
  }

  /**
   * 完成道具揭示
   */
  completeItemReveal(): void {
    // 清除当前掉落动画
    this.clearItemDropAnimation();
    
    // 如果还有更多奖励，显示下一个
    if (this.rewardIndex < this.itemRevealData.length - 1) {
      this.spawnNextRewardDrop(this.rewardIndex + 1);
    } else {
      // 所有奖励都已显示
      this.itemRevealData = [];
      this.rewardIndex = 0;
    }
  }

  /**
   * 添加消耗品到库存
   * @param itemId - 道具ID
   * @param quantity - 数量
   */
  addConsumable(itemId: string, quantity: number): void {
    if (!this.consumableInventory[itemId]) {
      this.consumableInventory[itemId] = 0;
    }
    
    this.consumableInventory[itemId] += quantity;
    
    // 更新游戏进度
    this.config.gameProgress.consumableInventory = { ...this.consumableInventory };
    
    if (this.config.onAddFloatingText) {
      const itemDef = CONSUMABLE_DEFS.find((def) => def.id === itemId);
      const itemName = itemDef?.name || itemId;
      
      this.config.onAddFloatingText(
        270,
        350,
        `获得: ${itemName} x${quantity}`,
        '#10b981'
      );
    }
  }

  /**
   * 使用消耗品
   * @param itemId - 道具ID
   * @returns 是否成功使用
   */
  useConsumable(itemId: string): boolean {
    if (!this.consumableInventory[itemId] || this.consumableInventory[itemId] <= 0) {
      return false;
    }
    
    this.consumableInventory[itemId]--;
    
    // 如果数量为0，从库存中移除
    if (this.consumableInventory[itemId] <= 0) {
      delete this.consumableInventory[itemId];
    }
    
    // 更新游戏进度
    this.config.gameProgress.consumableInventory = { ...this.consumableInventory };
    
    return true;
  }

  /**
   * 获取消耗品数量
   * @param itemId - 道具ID
   * @returns 数量
   */
  getConsumableQuantity(itemId: string): number {
    return this.consumableInventory[itemId] || 0;
  }

  /**
   * 切换自动使用设置
   * @param itemId - 道具ID
   * @param enabled - 是否启用
   */
  setAutoUse(itemId: string, enabled: boolean): void {
    this.autoUseEnabled[itemId] = enabled;
    
    // 更新游戏进度
    this.config.gameProgress.autoUseEnabled = { ...this.autoUseEnabled };
  }

  /**
   * 检查是否启用自动使用
   * @param itemId - 道具ID
   * @returns 是否启用
   */
  isAutoUseEnabled(itemId: string): boolean {
    return this.autoUseEnabled[itemId] !== false; // 默认启用
  }

  /**
   * 保存到游戏进度
   */
  saveToProgress(): void {
    this.config.gameProgress.consumableInventory = { ...this.consumableInventory };
    this.config.gameProgress.autoUseEnabled = { ...this.autoUseEnabled };
  }

  /**
   * 生成道具掉落
   * @param count - 掉落数量
   */
  spawnWeaponDrop(count = 1): void {
    // 获取所有可用道具
    const allItems = ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'];
    
    // 使用玩家选择的道具（如果可用），否则回退到场景默认值
    const unlockedItems = this.selectedItems.length > 0
      ? this.selectedItems
      : (this.config.gameMode === GameMode.STORY
          ? (this.config.difficulty === 'hard' ? allItems : (SCENE_ITEM_UNLOCKS[this.config.currentScene] || ['sticky']))
          : allItems);
    
    // 过滤只包含玩家已解锁的道具（安全检查）
    const availableItems = unlockedItems.filter(item =>
      this.config.gameProgress.unlockedItems?.includes(item) ||
      this.config.gameProgress.weaponsUnlocked?.includes(item) ||
      item === 'flamethrower'
    );
    
    // 回退：如果没有道具通过过滤器，使用基础粘性板
    const finalItems = availableItems.length > 0 ? availableItems : ['sticky'];

    // 生成多个掉落，位置分散
    const baseX = 60 + Math.random() * ((this.config.canvasWidth || 540) - 120);
    const baseY = (this.config.defenseLineY || 400) - 135 + Math.random() * 30;

    for (let i = 0; i < count; i++) {
      const type = finalItems[Math.floor(Math.random() * finalItems.length)] as string;
      
      // 水平分散掉落（最小间隔80像素）
      const x = count > 1
        ? Math.max(40, Math.min((this.config.canvasWidth || 540) - 40, baseX + (i - (count - 1) / 2) * 100))
        : baseX;
      
      const y = baseY + (Math.random() - 0.5) * 20; // 轻微的Y轴变化
      
      this.weaponDrops.push({
        id: this.nextDropId++,
        x, y, type,
        life: 12, maxLife: 12,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * 获取道具掉落列表
   * @returns 道具掉落数组
   */
  getWeaponDrops(): WeaponDrop[] {
    return [...this.weaponDrops];
  }

  /**
   * 拾取道具掉落
   * @param drop - 道具掉落
   * @returns 是否成功拾取
   */
  pickupWeaponDrop(drop: WeaponDrop): boolean {
    // 使用类型断言确保类型安全
    const weaponDropDefs = WEAPON_DROP_DEFS as Record<string, { name: string; color: string; duration: number; ammo: number; cooldown: number }>;
    const def = weaponDropDefs[drop.type];
    if (!def) return false;

    // 所有可投掷武器都进入库存（包括霰弹枪和电蚊拍）
    const itemType = drop.type;
    const existing = this.inventory.find(item => item.type === itemType);
    
    if (existing) {
      existing.quantity++;
    } else {
      this.inventory.push({ type: itemType, quantity: 1 });
    }

    // 从掉落列表中移除
    const index = this.weaponDrops.findIndex(d => d.id === drop.id);
    if (index !== -1) {
      this.weaponDrops.splice(index, 1);
    }

    // 播放音效
    if (this.config.onPlaySound) {
      this.config.onPlaySound('pickup');
    }

    // 显示浮动文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        drop.x,
        drop.y - 30,
        `获得: ${def.name}`,
        '#10b981'
      );
    }

    return true;
  }

  /**
   * 获取道具库存
   * @returns 道具库存数组
   */
  getInventory(): Array<{ type: string; quantity: number }> {
    return [...this.inventory];
  }

  /**
   * 获取道具数量
   * @param itemType - 道具类型
   * @returns 道具数量
   */
  getItemQuantity(itemType: string): number {
    const item = this.inventory.find(i => i.type === itemType);
    return item ? item.quantity : 0;
  }

  /**
   * 使用道具
   * @param itemType - 道具类型
   * @returns 是否成功使用
   */
  useItem(itemType: string): boolean {
    const item = this.inventory.find(i => i.type === itemType);
    if (!item || item.quantity <= 0) {
      return false;
    }

    item.quantity--;
    
    // 如果数量为0，从库存中移除
    if (item.quantity <= 0) {
      const index = this.inventory.findIndex(i => i.type === itemType);
      if (index !== -1) {
        this.inventory.splice(index, 1);
      }
    }

    return true;
  }

  /**
   * 检查道具是否已解锁
   * @param itemType - 道具类型
   * @returns 是否已解锁
   */
  isItemUnlocked(itemType: string): boolean {
    return (
      this.config.gameProgress.unlockedItems?.includes(itemType) ||
      this.config.gameProgress.weaponsUnlocked?.includes(itemType) ||
      itemType === 'flamethrower'
    );
  }

  /**
   * 解锁道具（通过天赋系统）
   * @param itemType - 道具类型
   */
  unlockItem(itemType: string): void {
    // 检查是否已经解锁
    if (this.isItemUnlocked(itemType)) {
      return;
    }

    // 添加到已解锁列表（同时更新两个字段以保持兼容性）
    if (!this.config.gameProgress.unlockedItems) {
      this.config.gameProgress.unlockedItems = [];
    }
    if (!this.config.gameProgress.weaponsUnlocked) {
      this.config.gameProgress.weaponsUnlocked = [];
    }

    this.config.gameProgress.unlockedItems.push(itemType);
    this.config.gameProgress.weaponsUnlocked.push(itemType);
  }

  /**
   * 获取所有已解锁的道具
   * @returns 已解锁的道具数组
   */
  getAllUnlockedItems(): string[] {
    const unlockedItems = this.config.gameProgress.unlockedItems || [];
    const weaponsUnlocked = this.config.gameProgress.weaponsUnlocked || [];
    
    // 合并两个数组并去重
    const allUnlocked = [...new Set([...unlockedItems, ...weaponsUnlocked])];
    
    // 确保火焰喷射器始终包含在内
    if (!allUnlocked.includes('flamethrower')) {
      allUnlocked.push('flamethrower');
    }
    
    return allUnlocked;
  }

  /**
   * 获取可用于切换的武器列表
   * @returns 武器数组
   */
  getCycleWeapons(): string[] {
    const allUnlocked = this.getAllUnlockedItems();
    return ['flamethrower', ...allUnlocked.filter(w => w !== 'flamethrower')];
  }

  /**
   * 开始道具掉落动画
   * @param reward - 奖励数据
   */
  startItemDropAnimation(reward: ItemUnlockData): void {
    const canvasWidth = this.config.canvasWidth || 540;
    const canvasHeight = this.config.canvasHeight || 960;
    
    this.itemDropOnField = {
      type: reward.type,
      name: reward.name,
      icon: reward.icon,
      x: canvasWidth / 2,
      y: -60,
      targetY: canvasHeight * 0.7,
      bobPhase: 0,
      collected: false,
      falling: true,
      fallSpeed: 80,
    };

    // 播放音效
    if (this.config.onPlaySound) {
      this.config.onPlaySound('item_drop_fanfare');
    }
  }

  /**
   * 更新道具掉落动画
   * @param deltaTime - 时间增量
   */
  updateItemDropAnimation(deltaTime: number): void {
    if (!this.itemDropOnField) return;

    if (this.itemDropOnField.falling) {
      // 更新下落位置
      this.itemDropOnField.y += this.itemDropOnField.fallSpeed * deltaTime;
      this.itemDropOnField.fallSpeed += 40 * deltaTime; // 重力加速度
      
      // 检查是否到达目标位置
      if (this.itemDropOnField.y >= this.itemDropOnField.targetY) {
        this.itemDropOnField.y = this.itemDropOnField.targetY;
        this.itemDropOnField.falling = false;
      }
    } else {
      // 浮动动画
      this.itemDropOnField.bobPhase += 2 * deltaTime;
    }
  }

  /**
   * 获取当前道具掉落动画数据
   * @returns 道具掉落动画数据或null
   */
  getItemDropAnimation(): typeof this.itemDropOnField {
    return this.itemDropOnField;
  }

  /**
   * 收集道具掉落
   * @returns 是否成功收集
   */
  collectItemDrop(): boolean {
    if (!this.itemDropOnField || this.itemDropOnField.collected) {
      return false;
    }

    this.itemDropOnField.collected = true;
    
    // 解锁道具
    this.unlockItem(this.itemDropOnField.type);
    
    // 播放音效
    if (this.config.onPlaySound) {
      this.config.onPlaySound('pickup');
    }

    // 显示浮动文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        this.itemDropOnField.x,
        this.itemDropOnField.y - 30,
        `解锁: ${this.itemDropOnField.name}`,
        '#fbbf24'
      );
    }

    return true;
  }

  /**
   * 清除道具掉落动画
   */
  clearItemDropAnimation(): void {
    this.itemDropOnField = null;
  }

  /**
   * 更新系统（每帧调用）
   * @param deltaTime - 时间增量
   */
  update(deltaTime: number): void {
    // 更新道具掉落动画
    this.updateItemDropAnimation(deltaTime);
    
    // 更新道具掉落生命周期
    this.updateWeaponDrops(deltaTime);
  }

  /**
   * 更新道具掉落生命周期
   * @param deltaTime - 时间增量
   */
  private updateWeaponDrops(deltaTime: number): void {
    for (let i = this.weaponDrops.length - 1; i >= 0; i--) {
      const drop = this.weaponDrops[i];
      
      // 更新浮动动画
      drop.bobPhase += 1.5 * deltaTime;
      
      // 更新生命周期
      drop.life -= deltaTime;
      
      // 如果生命周期结束，移除掉落
      if (drop.life <= 0) {
        this.weaponDrops.splice(i, 1);
      }
    }
  }

  /**
   * 重置当前游戏的道具状态
   */
  resetForNewGame(): void {
    this.selectedItems = [];
    this.itemRevealData = [];
    this.rewardIndex = 0;
    this.weaponDrops = [];
    this.inventory = [];
    this.itemDropOnField = null;
  }

  /**
   * 获取道具解锁状态
   * @returns 解锁状态对象
   */
  getUnlockStatus(): {
    /** 已解锁的道具数量 */
    unlockedCount: number;
    /** 总道具数量 */
    totalItems: number;
    /** 解锁百分比 */
    unlockPercent: number;
    /** 当前场景解锁的道具 */
    sceneUnlocks: ItemUnlockData[];
  } {
    // 合并weaponsUnlocked和unlockedItems两个字段
    const unlockedItems = [
      ...(this.config.gameProgress.unlockedItems || []),
      ...(this.config.gameProgress.weaponsUnlocked || [])
    ];
    const uniqueUnlockedItems = Array.from(new Set(unlockedItems));
    
    const allRewardItems = Object.values(SCENE_REWARD_ITEMS).reduce<ItemUnlockData[]>(
      (acc, items) => acc.concat(items as ItemUnlockData[]),
      []
    );
    const uniqueRewardTypes = Array.from(new Set(allRewardItems.map((i) => i.type)));

    const unlockedCount = uniqueUnlockedItems.length;
    const totalItems = uniqueRewardTypes.length;
    const unlockPercent = totalItems > 0 ? Math.round((unlockedCount / totalItems) * 100) : 0;
    
    const currentSceneUnlocks = SCENE_REWARD_ITEMS[this.config.currentScene] || [];
    const sceneUnlocks = currentSceneUnlocks.filter(
      (u) => !uniqueUnlockedItems.includes(u.type)
    );
    
    return {
      unlockedCount,
      totalItems,
      unlockPercent,
      sceneUnlocks,
    };
  }

  /**
   * 更新系统配置
   * @param config - 新的配置
   */
  updateConfig(config: Partial<ItemManagementSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
