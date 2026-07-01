/**
 * @fileoverview 游戏武器系统模块入口
 * @description 负责管理游戏中的武器系统，包括武器管理、升级系统等
 */

import { WeaponManager } from './WeaponManager';
import { WeaponUpgradeManager } from './WeaponUpgradeManager';

export { WeaponManager, WeaponUpgradeManager };

/**
 * 武器类型定义
 */
export const WEAPON_TYPES = {
  FLAMETHROWER: 'flamethrower',
  SHOTGUN: 'shotgun',
  STICKY: 'sticky',
  POISON: 'poison',
  MOLOTOV: 'molotov',
  RADAR: 'radar',
  SWATTER: 'swatter'
} as const;

export type WeaponType = typeof WEAPON_TYPES[keyof typeof WEAPON_TYPES];

/**
 * 武器属性接口
 */
export interface WeaponAttributes {
  /** 伤害值 */
  damage: number;
  /** 射程 */
  range: number;
  /** 攻击速度 */
  attackSpeed: number;
  /** 弹药容量 */
  ammoCapacity: number;
  /** 特殊效果 */
  specialEffects: string[];
}

/**
 * 默认武器属性配置
 */
export const DEFAULT_WEAPON_ATTRIBUTES: Record<WeaponType, WeaponAttributes> = {
  flamethrower: {
    damage: 10,
    range: 300,
    attackSpeed: 1.0,
    ammoCapacity: 100,
    specialEffects: ['burn', 'area_damage']
  },
  shotgun: {
    damage: 15,
    range: 200,
    attackSpeed: 0.8,
    ammoCapacity: 30,
    specialEffects: ['spread', 'knockback']
  },
  sticky: {
    damage: 20,
    range: 250,
    attackSpeed: 0.6,
    ammoCapacity: 20,
    specialEffects: ['sticky', 'delayed_explosion']
  },
  poison: {
    damage: 8,
    range: 280,
    attackSpeed: 0.7,
    ammoCapacity: 25,
    specialEffects: ['poison_cloud', 'slow']
  },
  molotov: {
    damage: 25,
    range: 220,
    attackSpeed: 0.5,
    ammoCapacity: 15,
    specialEffects: ['fire_pool', 'persistent_damage']
  },
  radar: {
    damage: 5,
    range: 350,
    attackSpeed: 1.2,
    ammoCapacity: 40,
    specialEffects: ['reveal', 'tracking']
  },
  swatter: {
    damage: 30,
    range: 150,
    attackSpeed: 0.4,
    ammoCapacity: 10,
    specialEffects: ['instant_kill', 'stun']
  }
};

/**
 * 创建武器管理器实例
 * @param {Player} player - 玩家对象
 * @returns {WeaponManager} 武器管理器实例
 */
export function createWeaponManager(player: any): WeaponManager {
  return new WeaponManager(player);
}

/**
 * 创建武器升级管理器实例
 * @param {Player} player - 玩家对象
 * @returns {WeaponUpgradeManager} 武器升级管理器实例
 */
export function createWeaponUpgradeManager(player: any): WeaponUpgradeManager {
  return new WeaponUpgradeManager(player);
}

/**
 * 计算武器总伤害
 * @param {WeaponType} weaponType - 武器类型
 * @param {number} baseDamage - 基础伤害
 * @param {Record<string, number>} upgradeEffects - 升级效果
 * @returns {number} 总伤害
 */
export function calculateWeaponDamage(
  weaponType: WeaponType,
  baseDamage: number,
  upgradeEffects: Record<string, number>
): number {
  let totalDamage = baseDamage;
  
  // 应用武器类型特定的升级
  switch (weaponType) {
    case WEAPON_TYPES.FLAMETHROWER:
      totalDamage += upgradeEffects.flame_damage || 0;
      break;
    case WEAPON_TYPES.SHOTGUN:
      totalDamage += upgradeEffects.shotgun_damage || 0;
      break;
    case WEAPON_TYPES.STICKY:
      totalDamage += upgradeEffects.sticky_damage || 0;
      break;
    case WEAPON_TYPES.POISON:
      totalDamage += upgradeEffects.poison_damage || 0;
      break;
    case WEAPON_TYPES.MOLOTOV:
      totalDamage += upgradeEffects.molotov_damage || 0;
      break;
  }
  
  return totalDamage;
}

/**
 * 计算武器射程
 * @param {WeaponType} weaponType - 武器类型
 * @param {number} baseRange - 基础射程
 * @param {Record<string, number>} upgradeEffects - 升级效果
 * @returns {number} 总射程
 */
export function calculateWeaponRange(
  weaponType: WeaponType,
  baseRange: number,
  upgradeEffects: Record<string, number>
): number {
  let totalRange = baseRange;
  
  // 应用武器类型特定的升级
  switch (weaponType) {
    case WEAPON_TYPES.FLAMETHROWER:
      totalRange += upgradeEffects.flame_range || 0;
      break;
    case WEAPON_TYPES.SHOTGUN:
      totalRange += upgradeEffects.shotgun_range || 0;
      break;
    case WEAPON_TYPES.STICKY:
      totalRange += upgradeEffects.sticky_range || 0;
      break;
    case WEAPON_TYPES.POISON:
      totalRange += upgradeEffects.poison_range || 0;
      break;
    case WEAPON_TYPES.MOLOTOV:
      totalRange += upgradeEffects.molotov_range || 0;
      break;
  }
  
  return totalRange;
}

/**
 * 检查武器是否可用
 * @param {WeaponType} weaponType - 武器类型
 * @param {Player} player - 玩家对象
 * @returns {boolean} 是否可用
 */
export function isWeaponAvailable(
  weaponType: WeaponType,
  player: any
): boolean {
  // 火焰喷射器始终可用
  if (weaponType === WEAPON_TYPES.FLAMETHROWER) {
    return true;
  }
  
  // 检查武器是否已解锁
  return player.weaponsUnlocked.includes(weaponType);
}

/**
 * 获取武器升级建议
 * @param {Player} player - 玩家对象
 * @returns {string[]} 升级建议列表
 */
export function getWeaponUpgradeSuggestions(player: any): string[] {
  const suggestions: string[] = [];
  
  // 检查火焰伤害升级
  if (player.flameDamage < 20) {
    suggestions.push('升级火焰伤害以更快消灭敌人');
  }
  
  // 检查火焰射程升级
  if (player.flameRange < 400) {
    suggestions.push('升级火焰射程以攻击更远的敌人');
  }
  
  // 检查火焰弹药升级
  if (player.flameAmmo < 150) {
    suggestions.push('升级火焰弹药以持续战斗更长时间');
  }
  
  // 根据已解锁的武器提供建议
  if (player.weaponsUnlocked.includes('shotgun') && player.shotgunSpread > 20) {
    suggestions.push('升级霰弹扩散以减少子弹散布');
  }
  
  if (player.weaponsUnlocked.includes('sticky') && player.stickyDuration < 10) {
    suggestions.push('升级粘性持续时间以延长控制效果');
  }
  
  return suggestions;
}

/**
 * 应用所有武器升级效果
 * @param {Player} player - 玩家对象
 * @param {WeaponUpgradeManager} upgradeManager - 武器升级管理器
 */
export function applyAllWeaponUpgrades(
  player: any,
  upgradeManager: WeaponUpgradeManager
): void {
  upgradeManager.applyUpgradeEffects(player);
}

/**
 * 获取武器信息摘要
 * @param {WeaponType} weaponType - 武器类型
 * @param {Player} player - 玩家对象
 * @returns {string} 武器信息摘要
 */
export function getWeaponSummary(
  weaponType: WeaponType,
  player: any
): string {
  const attributes = DEFAULT_WEAPON_ATTRIBUTES[weaponType];
  const isUnlocked = isWeaponAvailable(weaponType, player);
  
  return `${weaponType}: ${isUnlocked ? '已解锁' : '未解锁'}
伤害: ${attributes.damage}
射程: ${attributes.range}
攻击速度: ${attributes.attackSpeed}
弹药容量: ${attributes.ammoCapacity}
特殊效果: ${attributes.specialEffects.join(', ')}`;
}