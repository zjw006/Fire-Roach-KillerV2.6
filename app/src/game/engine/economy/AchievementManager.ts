/**
 * @fileoverview 游戏成就系统管理器
 * @description 负责管理游戏成就的解锁、检查和奖励发放
 */

import type { GameProgress, Economy } from '../../types';

/**
 * 成就条件检查器接口
 */
interface AchievementCondition {
  /** 成就ID */
  id: string;
  /** 检查条件是否满足 */
  check: (economy: Economy, progress: GameProgress) => boolean;
  /** 成就奖励金额 */
  reward: number;
}

/**
 * 成就系统管理器类
 * @description 管理游戏成就的解锁、检查和奖励发放
 */
export class AchievementManager {
  private progress: GameProgress;
  private economy: Economy;

  /**
   * 构造函数
   * @param {GameProgress} progress - 游戏进度数据
   * @param {Economy} economy - 经济数据
   */
  constructor(progress: GameProgress, economy: Economy) {
    this.progress = progress;
    this.economy = economy;
  }

  /**
   * 检查并解锁符合条件的成就
   * @returns {boolean} 是否有成就被解锁
   */
  checkAndUnlockAchievements(): boolean {
    let updated = false;
    
    for (const ach of this.progress.achievements) {
      if (ach.unlocked) continue;
      
      const condition = this.getAchievementCondition(ach.id);
      if (!condition) continue;
      
      const isUnlocked = condition.check(this.economy, this.progress);
      if (isUnlocked) {
        ach.unlocked = true;
        this.economy.money += ach.reward;
        updated = true;
      }
    }
    
    return updated;
  }

  /**
   * 获取成就条件
   * @param {string} achievementId - 成就ID
   * @returns {AchievementCondition | null} 成就条件对象
   */
  private getAchievementCondition(achievementId: string): AchievementCondition | null {
    const conditions: Record<string, AchievementCondition> = {
      'first_kill': {
        id: 'first_kill',
        check: (economy) => economy.totalKills >= 1,
        reward: 50
      },
      'wave_5': {
        id: 'wave_5',
        check: (economy) => economy.highestWave >= 5,
        reward: 100
      },
      'wave_10': {
        id: 'wave_10',
        check: (economy) => economy.highestWave >= 10,
        reward: 200
      },
      'endless_20': {
        id: 'endless_20',
        check: (economy) => economy.highestEndlessWave >= 20,
        reward: 300
      },
      'endless_50': {
        id: 'endless_50',
        check: (economy) => economy.highestEndlessWave >= 50,
        reward: 500
      },
      'money_1000': {
        id: 'money_1000',
        check: (economy) => economy.totalMoneyEarned >= 1000,
        reward: 150
      },
      'perfect_wave': {
        id: 'perfect_wave',
        check: (economy) => economy.perfectWaves >= 1,
        reward: 100
      },
      'no_breach': {
        id: 'no_breach',
        check: (economy) => economy.breaches === 0 && economy.highestWave >= 10,
        reward: 300
      },
      'kill_queen': {
        id: 'kill_queen',
        check: (economy) => economy.queenKills >= 1,
        reward: 500
      }
    };

    return conditions[achievementId] || null;
  }

  /**
   * 获取已解锁的成就列表
   * @returns {Array} 已解锁的成就列表
   */
  getUnlockedAchievements(): Array<{id: string, name: string, reward: number}> {
    return this.progress.achievements
      .filter(ach => ach.unlocked)
      .map(ach => ({
        id: ach.id,
        name: ach.name,
        reward: ach.reward
      }));
  }

  /**
   * 获取未解锁的成就列表
   * @returns {Array} 未解锁的成就列表
   */
  getLockedAchievements(): Array<{id: string, name: string, description: string, reward: number}> {
    return this.progress.achievements
      .filter(ach => !ach.unlocked)
      .map(ach => ({
        id: ach.id,
        name: ach.name,
        description: ach.description,
        reward: ach.reward
      }));
  }

  /**
   * 获取成就进度信息
   * @param {string} achievementId - 成就ID
   * @returns {Object | null} 成就进度信息
   */
  getAchievementProgress(achievementId: string): {current: number, target: number, percentage: number} | null {
    const condition = this.getAchievementCondition(achievementId);
    if (!condition) return null;

    // 根据成就ID获取当前进度
    let current = 0;
    switch (achievementId) {
      case 'first_kill':
        current = this.economy.totalKills;
        break;
      case 'wave_5':
      case 'wave_10':
        current = this.economy.highestWave;
        break;
      case 'endless_20':
      case 'endless_50':
        current = this.economy.highestEndlessWave;
        break;
      case 'money_1000':
        current = this.economy.totalMoneyEarned;
        break;
      case 'perfect_wave':
        current = this.economy.perfectWaves;
        break;
      case 'no_breach':
        current = this.economy.breaches;
        break;
      case 'kill_queen':
        current = this.economy.queenKills;
        break;
    }

    // 获取目标值
    let target = 0;
    switch (achievementId) {
      case 'first_kill':
        target = 1;
        break;
      case 'wave_5':
        target = 5;
        break;
      case 'wave_10':
        target = 10;
        break;
      case 'endless_20':
        target = 20;
        break;
      case 'endless_50':
        target = 50;
        break;
      case 'money_1000':
        target = 1000;
        break;
      case 'perfect_wave':
        target = 1;
        break;
      case 'no_breach':
        target = 0; // breaches应为0
        break;
      case 'kill_queen':
        target = 1;
        break;
    }

    const percentage = Math.min(100, Math.max(0, (current / target) * 100));
    return { current, target, percentage };
  }
}