/**
 * @fileoverview 游戏商店系统管理器
 * @description 负责管理游戏商店的物品购买、价格计算和库存管理
 */

import { CONSUMABLE_DEFS, INVENTORY_SELL_PRICES } from '../../data';
import type { Economy, GameProgress, InventoryItem } from '../../types';

/**
 * 商店物品接口
 */
interface ShopItem {
  /** 物品ID */
  id: string;
  /** 物品名称 */
  name: string;
  /** 物品描述 */
  description: string;
  /** 物品价格 */
  price: number;
  /** 物品类型 */
  type: string;
  /** 物品图标 */
  icon: string;
  /** 是否已解锁 */
  unlocked: boolean;
}

/**
 * 商店系统管理器类
 * @description 管理游戏商店的物品购买、价格计算和库存管理
 */
export class ShopManager {
  private economy: Economy;
  private consumableInventory: Record<string, number>;
  private autoUseEnabled: Record<string, boolean>;
  private emergencyCoolInventory: number;

  /**
   * 构造函数
   * @param {Economy} economy - 经济数据
   * @param {Record<string, number>} consumableInventory - 消耗品库存
   * @param {Record<string, boolean>} autoUseEnabled - 自动使用设置
   * @param {number} emergencyCoolInventory - 紧急冷却库存
   */
  constructor(
    economy: Economy,
    consumableInventory: Record<string, number> = {},
    autoUseEnabled: Record<string, boolean> = {},
    emergencyCoolInventory: number = 0
  ) {
    this.economy = economy;
    this.consumableInventory = consumableInventory;
    this.autoUseEnabled = autoUseEnabled;
    this.emergencyCoolInventory = emergencyCoolInventory;
  }

  /**
   * 获取所有可购买的商店物品
   * @param {GameProgress} progress - 游戏进度数据
   * @returns {ShopItem[]} 商店物品列表
   */
  getShopItems(_progress: GameProgress): ShopItem[] {
    const items: ShopItem[] = [];
    
    // 添加消耗品
    for (const def of CONSUMABLE_DEFS) {
      const unlocked = this.isItemUnlocked(def.id);
      items.push({
        id: def.id,
        name: def.name,
        description: def.description,
        price: def.cost,
        icon: def.icon,
        type: 'consumable',
        unlocked: unlocked
      });
    }
    
    return items;
  }

  /**
   * 检查物品是否已解锁
   * @param {string} itemId - 物品ID
   * @returns {boolean} 是否已解锁
   */
  private isItemUnlocked(_itemId: string): boolean {
    // 这里可以根据游戏进度判断物品是否解锁
    // 例如：某些物品需要达到特定波次或完成特定成就
    return true; // 默认全部解锁
  }

  /**
   * 购买物品
   * @param {string} itemId - 物品ID
   * @param {number} quantity - 购买数量
   * @returns {boolean} 是否购买成功
   */
  buyItem(itemId: string, quantity: number = 1): boolean {
    const def = CONSUMABLE_DEFS.find(d => d.id === itemId);
    if (!def) return false;
    
    const totalCost = def.cost * quantity;
    if (!this.canAfford(totalCost)) return false;
    
    // 扣除金钱
    this.economy.money -= totalCost;
    
    // 添加到库存
    this.consumableInventory[itemId] = (this.consumableInventory[itemId] || 0) + quantity;
    
    // 默认启用自动使用
    if (this.autoUseEnabled[itemId] === undefined) {
      this.autoUseEnabled[itemId] = true;
    }
    
    return true;
  }

  /**
   * 购买紧急冷却
   * @returns {boolean} 是否购买成功
   */
  buyEmergencyCool(): boolean {
    const cost = 50; // 紧急冷却价格
    if (!this.canAfford(cost)) return false;
    
    this.economy.money -= cost;
    this.emergencyCoolInventory++;
    return true;
  }

  /**
   * 检查是否有足够的金钱
   * @param {number} amount - 需要检查的金钱数量
   * @returns {boolean} 是否有足够的金钱
   */
  canAfford(amount: number): boolean {
    return this.economy.money >= amount;
  }

  /**
   * 使用消耗品
   * @param {string} itemId - 物品ID
   * @returns {boolean} 是否使用成功
   */
  useConsumable(itemId: string): boolean {
    if (!this.consumableInventory[itemId] || this.consumableInventory[itemId] <= 0) {
      return false;
    }
    
    this.consumableInventory[itemId]--;
    if (this.consumableInventory[itemId] <= 0) {
      delete this.consumableInventory[itemId];
    }
    
    return true;
  }

  /**
   * 使用紧急冷却
   * @returns {boolean} 是否使用成功
   */
  useEmergencyCool(): boolean {
    if (this.emergencyCoolInventory <= 0) return false;
    
    this.emergencyCoolInventory--;
    return true;
  }

  /**
   * 切换自动使用设置
   * @param {string} itemId - 物品ID
   * @returns {boolean} 新的自动使用状态
   */
  toggleAutoUse(itemId: string): boolean {
    this.autoUseEnabled[itemId] = !this.autoUseEnabled[itemId];
    return this.autoUseEnabled[itemId];
  }

  /**
   * 获取自动使用状态
   * @param {string} itemId - 物品ID
   * @returns {boolean} 自动使用状态
   */
  getAutoUseStatus(itemId: string): boolean {
    return this.autoUseEnabled[itemId] || false;
  }

  /**
   * 获取消耗品库存
   * @returns {Record<string, number>} 消耗品库存
   */
  getConsumableInventory(): Record<string, number> {
    return { ...this.consumableInventory };
  }

  /**
   * 获取紧急冷却库存
   * @returns {number} 紧急冷却库存数量
   */
  getEmergencyCoolInventory(): number {
    return this.emergencyCoolInventory;
  }

  /**
   * 获取物品价格
   * @param {string} itemId - 物品ID
   * @returns {number | null} 物品价格
   */
  getItemPrice(itemId: string): number | null {
    const def = CONSUMABLE_DEFS.find(d => d.id === itemId);
    return def ? def.cost : null;
  }

  /**
   * 计算回收物品的总价值
   * @param {InventoryItem[]} inventory - 库存物品列表
   * @returns {number} 回收总价值
   */
  calculateRecycleValue(inventory: InventoryItem[]): number {
    let total = 0;
    for (const item of inventory) {
      const price = INVENTORY_SELL_PRICES[item.type] || 0;
      total += price * item.count;
    }
    return total;
  }

  /**
   * 应用回收金钱
   * @param {number} totalValue - 回收总价值
   */
  applyRecycledMoney(totalValue: number): void {
    if (totalValue > 0) {
      this.economy.money += totalValue;
      this.economy.totalMoneyEarned += totalValue;
    }
  }
}