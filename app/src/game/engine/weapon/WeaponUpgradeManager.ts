/**
 * @fileoverview 游戏武器升级管理器
 * @description 负责管理游戏中的武器升级系统，包括武器属性升级、特殊效果解锁等
 */

import type { Player, WeaponUpgrade } from '../../types';

/**
 * 武器升级配置接口
 */
export interface WeaponUpgradeConfig {
  /** 升级ID */
  id: string;
  /** 升级名称 */
  name: string;
  /** 升级描述 */
  description: string;
  /** 升级类型 */
  type: 'damage' | 'range' | 'speed' | 'ammo' | 'special';
  /** 基础效果值 */
  baseValue: number;
  /** 每级增加效果值 */
  valuePerLevel: number;
  /** 最大等级 */
  maxLevel: number;
  /** 每级消耗 */
  costPerLevel: number;
  /** 解锁条件 */
  unlockCondition?: (player: Player) => boolean;
}

/**
 * 武器升级管理器类
 * @description 管理游戏中的武器升级系统
 */
export class WeaponUpgradeManager {
  private player: Player;
  private upgrades: Map<string, WeaponUpgrade> = new Map();
  private upgradeConfigs: WeaponUpgradeConfig[] = [];

  /**
   * 构造函数
   * @param {Player} player - 玩家对象
   */
  constructor(player: Player) {
    this.player = player;
    this.upgrades = new Map();
    this.upgradeConfigs = this.createDefaultUpgradeConfigs();
    this.loadUpgrades();
  }

  /**
   * 创建默认升级配置
   * @returns {WeaponUpgradeConfig[]} 默认升级配置列表
   */
  private createDefaultUpgradeConfigs(): WeaponUpgradeConfig[] {
    return [
      {
        id: 'flame_damage',
        name: '火焰伤害',
        description: '增加火焰喷射器的伤害',
        type: 'damage',
        baseValue: 10,
        valuePerLevel: 2,
        maxLevel: 10,
        costPerLevel: 100
      },
      {
        id: 'flame_range',
        name: '火焰射程',
        description: '增加火焰喷射器的射程',
        type: 'range',
        baseValue: 300,
        valuePerLevel: 20,
        maxLevel: 10,
        costPerLevel: 80
      },
      {
        id: 'flame_speed',
        name: '火焰速度',
        description: '增加火焰粒子的飞行速度',
        type: 'speed',
        baseValue: 200,
        valuePerLevel: 15,
        maxLevel: 10,
        costPerLevel: 90
      },
      {
        id: 'flame_ammo',
        name: '火焰弹药',
        description: '增加火焰喷射器的弹药容量',
        type: 'ammo',
        baseValue: 100,
        valuePerLevel: 20,
        maxLevel: 10,
        costPerLevel: 70
      },
      {
        id: 'shotgun_spread',
        name: '霰弹扩散',
        description: '减少霰弹枪的扩散角度',
        type: 'special',
        baseValue: 30,
        valuePerLevel: -2,
        maxLevel: 5,
        costPerLevel: 120,
        unlockCondition: (player) => player.weaponsUnlocked.includes('shotgun')
      },
      {
        id: 'sticky_duration',
        name: '粘性持续时间',
        description: '增加粘性炸弹的持续时间',
        type: 'special',
        baseValue: 8,
        valuePerLevel: 1,
        maxLevel: 5,
        costPerLevel: 110,
        unlockCondition: (player) => player.weaponsUnlocked.includes('sticky')
      },
      {
        id: 'poison_cloud_size',
        name: '毒云大小',
        description: '增加毒云炸弹的云团大小',
        type: 'special',
        baseValue: 150,
        valuePerLevel: 20,
        maxLevel: 5,
        costPerLevel: 130,
        unlockCondition: (player) => player.weaponsUnlocked.includes('poison')
      },
      {
        id: 'molotov_duration',
        name: '燃烧瓶持续时间',
        description: '增加燃烧瓶的燃烧持续时间',
        type: 'special',
        baseValue: 6,
        valuePerLevel: 0.5,
        maxLevel: 5,
        costPerLevel: 140,
        unlockCondition: (player) => player.weaponsUnlocked.includes('molotov')
      }
    ];
  }

  /**
   * 加载升级数据
   */
  private loadUpgrades(): void {
    // 从玩家数据加载已存在的升级
    if (this.player.weaponUpgrades) {
      for (const upgrade of this.player.weaponUpgrades) {
        this.upgrades.set(upgrade.id, { ...upgrade });
      }
    }
  }

  /**
   * 保存升级数据
   */
  private saveUpgrades(): void {
    this.player.weaponUpgrades = Array.from(this.upgrades.values());
  }

  /**
   * 获取可用的升级配置
   * @returns {WeaponUpgradeConfig[]} 可用的升级配置列表
   */
  getAvailableUpgrades(): WeaponUpgradeConfig[] {
    return this.upgradeConfigs.filter(config => {
      // 检查是否已解锁
      if (config.unlockCondition && !config.unlockCondition(this.player)) {
        return false;
      }
      
      // 检查是否已达到最大等级
      const existingUpgrade = this.upgrades.get(config.id);
      if (existingUpgrade && existingUpgrade.level >= config.maxLevel) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * 获取已购买的升级
   * @returns {WeaponUpgrade[]} 已购买的升级列表
   */
  getPurchasedUpgrades(): WeaponUpgrade[] {
    return Array.from(this.upgrades.values());
  }

  /**
   * 购买升级
   * @param {string} upgradeId - 升级ID
   * @returns {boolean} 是否购买成功
   */
  purchaseUpgrade(upgradeId: string): boolean {
    const config = this.upgradeConfigs.find(c => c.id === upgradeId);
    if (!config) return false;

    // 检查解锁条件
    if (config.unlockCondition && !config.unlockCondition(this.player)) {
      return false;
    }

    const existingUpgrade = this.upgrades.get(upgradeId);
    const currentLevel = existingUpgrade ? existingUpgrade.level : 0;
    
    // 检查是否已达到最大等级
    if (currentLevel >= config.maxLevel) {
      return false;
    }

    // 计算升级成本
    const cost = config.costPerLevel * (currentLevel + 1);
    
    // 检查是否有足够的金钱
    if (this.player.money < cost) {
      return false;
    }

    // 扣除金钱
    this.player.money -= cost;

    // 更新或创建升级
    const newLevel = currentLevel + 1;
    const totalValue = config.baseValue + config.valuePerLevel * newLevel;
    
    this.upgrades.set(upgradeId, {
      id: upgradeId,
      level: newLevel,
      value: totalValue,
      type: config.type
    });

    // 保存升级数据
    this.saveUpgrades();
    
    return true;
  }

  /**
   * 获取升级效果值
   * @param {string} upgradeId - 升级ID
   * @returns {number} 升级效果值
   */
  getUpgradeValue(upgradeId: string): number {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) return 0;
    
    return upgrade.value;
  }

  /**
   * 获取升级等级
   * @param {string} upgradeId - 升级ID
   * @returns {number} 升级等级
   */
  getUpgradeLevel(upgradeId: string): number {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) return 0;
    
    return upgrade.level;
  }

  /**
   * 获取所有升级的总效果
   * @returns {Record<string, number>} 升级效果映射
   */
  getAllUpgradeEffects(): Record<string, number> {
    const effects: Record<string, number> = {};
    
    for (const [upgradeId, upgrade] of this.upgrades.entries()) {
      effects[upgradeId] = upgrade.value;
    }
    
    return effects;
  }

  /**
   * 应用武器升级效果
   * @param {Player} player - 玩家对象
   */
  applyUpgradeEffects(player: Player): void {
    // 应用火焰伤害升级
    const flameDamage = this.getUpgradeValue('flame_damage');
    if (flameDamage > 0) {
      player.flameDamage = flameDamage;
    }

    // 应用火焰射程升级
    const flameRange = this.getUpgradeValue('flame_range');
    if (flameRange > 0) {
      player.flameRange = flameRange;
    }

    // 应用火焰速度升级
    const flameSpeed = this.getUpgradeValue('flame_speed');
    if (flameSpeed > 0) {
      player.flameSpeed = flameSpeed;
    }

    // 应用火焰弹药升级
    const flameAmmo = this.getUpgradeValue('flame_ammo');
    if (flameAmmo > 0) {
      player.flameAmmo = flameAmmo;
    }

    // 应用霰弹扩散升级
    const shotgunSpread = this.getUpgradeValue('shotgun_spread');
    if (shotgunSpread > 0) {
      player.shotgunSpread = shotgunSpread;
    }

    // 应用粘性持续时间升级
    const stickyDuration = this.getUpgradeValue('sticky_duration');
    if (stickyDuration > 0) {
      player.stickyDuration = stickyDuration;
    }

    // 应用毒云大小升级
    const poisonCloudSize = this.getUpgradeValue('poison_cloud_size');
    if (poisonCloudSize > 0) {
      player.poisonCloudSize = poisonCloudSize;
    }

    // 应用燃烧瓶持续时间升级
    const molotovDuration = this.getUpgradeValue('molotov_duration');
    if (molotovDuration > 0) {
      player.molotovDuration = molotovDuration;
    }
  }

  /**
   * 重置所有升级
   * @returns {boolean} 是否重置成功
   */
  resetUpgrades(): boolean {
    // 计算返还的金钱
    let totalRefund = 0;
    
    for (const upgrade of this.upgrades.values()) {
      const config = this.upgradeConfigs.find(c => c.id === upgrade.id);
      if (config) {
        // 计算该升级的总花费
        for (let level = 1; level <= upgrade.level; level++) {
          totalRefund += config.costPerLevel * level;
        }
      }
    }

    // 清空升级
    this.upgrades.clear();
    this.saveUpgrades();

    // 返还金钱（通常只返还一部分，比如50%）
    const actualRefund = Math.floor(totalRefund * 0.5);
    this.player.money += actualRefund;

    return true;
  }

  /**
   * 获取升级信息
   * @param {string} upgradeId - 升级ID
   * @returns {WeaponUpgradeConfig | undefined} 升级配置信息
   */
  getUpgradeInfo(upgradeId: string): WeaponUpgradeConfig | undefined {
    return this.upgradeConfigs.find(c => c.id === upgradeId);
  }

  /**
   * 检查升级是否可用
   * @param {string} upgradeId - 升级ID
   * @returns {boolean} 是否可用
   */
  isUpgradeAvailable(upgradeId: string): boolean {
    const config = this.upgradeConfigs.find(c => c.id === upgradeId);
    if (!config) return false;

    // 检查解锁条件
    if (config.unlockCondition && !config.unlockCondition(this.player)) {
      return false;
    }

    // 检查是否已达到最大等级
    const existingUpgrade = this.upgrades.get(upgradeId);
    if (existingUpgrade && existingUpgrade.level >= config.maxLevel) {
      return false;
    }

    return true;
  }

  /**
   * 获取升级购买成本
   * @param {string} upgradeId - 升级ID
   * @returns {number} 购买成本
   */
  getUpgradeCost(upgradeId: string): number {
    const config = this.upgradeConfigs.find(c => c.id === upgradeId);
    if (!config) return 0;

    const existingUpgrade = this.upgrades.get(upgradeId);
    const currentLevel = existingUpgrade ? existingUpgrade.level : 0;
    
    return config.costPerLevel * (currentLevel + 1);
  }
}