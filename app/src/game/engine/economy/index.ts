/**
 * @fileoverview 游戏经济系统模块入口
 * @description 导出经济系统相关的所有管理器和工具
 */

export { EconomyManager } from './EconomyManager';

/**
 * 经济系统工具函数
 */

/**
 * 格式化金钱显示
 * @param {number} amount - 金钱数量
 * @returns {string} 格式化后的金钱字符串
 */
export function formatMoney(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

/**
 * 计算击杀奖励
 * @param {string} enemyType - 敌人类型
 * @param {number} baseReward - 基础奖励
 * @param {number} multiplier - 奖励倍率
 * @returns {number} 计算后的奖励金额
 */
export function calculateKillReward(
  enemyType: string,
  baseReward: number,
  multiplier: number = 1
): number {
  let reward = baseReward;
  
  // 根据敌人类型调整奖励
  switch (enemyType) {
    case 'queen':
      reward *= 5; // 女王蟑螂奖励更高
      break;
    case 'boss':
      reward *= 10; // BOSS奖励最高
      break;
  }
  
  return Math.floor(reward * multiplier);
}

/**
 * 计算物品回收价值
 * @param {string} itemType - 物品类型
 * @param {number} count - 物品数量
 * @param {Record<string, number>} priceTable - 价格表
 * @returns {number} 回收总价值
 */
export function calculateRecycleValue(
  itemType: string,
  count: number,
  priceTable: Record<string, number>
): number {
  const price = priceTable[itemType] || 0;
  return price * count;
}