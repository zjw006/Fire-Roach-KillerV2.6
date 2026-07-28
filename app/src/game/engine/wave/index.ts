/**
 * @fileoverview 游戏波次系统模块入口
 * @description 导出波次系统相关的所有管理器和工具
 */

export { WaveManager } from './WaveManager';
import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/**
 * 波次系统工具函数
 */

/**
 * 计算波次奖励
 * @param {number} waveNumber - 波次编号
 * @param {string} difficulty - 游戏难度
 * @param {boolean} isPerfect - 是否为完美波次
 * @returns {number} 波次奖励金额
 */
export function calculateWaveReward(
  waveNumber: number,
  difficulty: string = 'normal',
  isPerfect: boolean = false
): number {
  let baseReward = BALANCE_CONFIG.wave.baseReward + waveNumber * BALANCE_CONFIG.wave.rewardPerWave;
  
  // 难度调整
  switch (difficulty) {
    case 'easy':
      baseReward *= BALANCE_CONFIG.wave.rewardMultiplier.easy;
      break;
    case 'hard':
      baseReward *= BALANCE_CONFIG.wave.rewardMultiplier.hard;
      break;
  }
  
  // 完美波次奖励
  if (isPerfect) {
    baseReward *= BALANCE_CONFIG.wave.perfectMultiplier;
  }
  
  return Math.floor(baseReward);
}

/**
 * 计算波次生成速度
 * @param {number} waveNumber - 波次编号
 * @param {string} difficulty - 游戏难度
 * @returns {number} 生成间隔（秒）
 */
export function calculateSpawnInterval(
  waveNumber: number,
  difficulty: string = 'normal'
): number {
  let baseInterval = BALANCE_CONFIG.wave.baseInterval;
  
  // 难度调整
  switch (difficulty) {
    case 'easy':
      baseInterval *= BALANCE_CONFIG.wave.intervalMultiplier.easy;
      break;
    case 'hard':
      baseInterval *= BALANCE_CONFIG.wave.intervalMultiplier.hard;
      break;
  }
  
  // 波次越高，生成越快
  const reduction = Math.min(0.5, (waveNumber - 1) * BALANCE_CONFIG.wave.intervalReductionPerWave);
  return Math.max(BALANCE_CONFIG.wave.intervalMin, baseInterval - reduction);
}

/**
 * 计算波次难度系数
 * @param {number} waveNumber - 波次编号
 * @param {string} difficulty - 游戏难度
 * @returns {number} 难度系数
 */
export function calculateDifficultyMultiplier(
  waveNumber: number,
  difficulty: string = 'normal'
): number {
  let multiplier = 1.0;
  
  // 基础难度
  switch (difficulty) {
    case 'easy':
      multiplier = BALANCE_CONFIG.wave.difficultyMultiplier.easy;
      break;
    case 'hard':
      multiplier = BALANCE_CONFIG.wave.difficultyMultiplier.hard;
      break;
  }
  
  // 波次递增
  multiplier *= (1.0 + (waveNumber - 1) * BALANCE_CONFIG.wave.difficultyPerWave);
  
  return multiplier;
}

/**
 * 格式化波次显示
 * @param {number} currentWave - 当前波次
 * @param {number} totalWaves - 总波次数
 * @returns {string} 格式化后的波次字符串
 */
export function formatWaveDisplay(
  currentWave: number,
  totalWaves: number = 0
): string {
  return TEXT_CONFIG.ui.hud.waveDisplay(currentWave, totalWaves > 0 ? totalWaves : undefined);
}

/**
 * 检查波次是否完成
 * @param {number} remainingEnemies - 剩余敌人数量
 * @param {boolean} isSpawning - 是否正在生成
 * @param {number} spawnQueueLength - 生成队列长度
 * @returns {boolean} 波次是否完成
 */
export function isWaveComplete(
  remainingEnemies: number,
  isSpawning: boolean,
  spawnQueueLength: number
): boolean {
  return !isSpawning && spawnQueueLength === 0 && remainingEnemies === 0;
}

/**
 * 获取波次进度百分比
 * @param {number} currentWave - 当前波次
 * @param {number} totalWaves - 总波次数
 * @returns {number} 进度百分比（0-100）
 */
export function getWaveProgressPercentage(
  currentWave: number,
  totalWaves: number
): number {
  if (totalWaves <= 0) return 0;
  return Math.min(100, Math.max(0, (currentWave / totalWaves) * 100));
}