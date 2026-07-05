/**
 * @fileoverview 游戏经济系统管理器
 * @description 负责管理游戏中的金钱、统计数据和成就系统
 */

import type { Economy, GameProgress, SceneType } from '../../types';
import { ENEMY_DEFS, SCENE_CONFIGS, TALENT_DEFS } from '../../data';

/**
 * 经济系统管理器类
 * @description 管理游戏中的金钱、统计数据和成就系统
 */
export class EconomyManager {
  private economy: Economy;

  /**
   * 构造函数
   * @param {Economy} initialEconomy - 初始经济数据
   */
  constructor(initialEconomy: Economy) {
    this.economy = initialEconomy;
  }

  /**
   * 计算击杀奖励（静态方法，无状态）
   */
  static calculateKillReward(
    enemyType: string,
    progress: GameProgress,
    currentScene: SceneType,
    difficulty: string
  ): number {
    // 获取敌人基础奖励（使用类型断言确保类型安全）
    const enemyDefs = ENEMY_DEFS as Record<string, { reward: number }>;
    const enemyDef = enemyDefs[enemyType];
    const baseReward = enemyDef?.reward || 10;

    // 获取场景奖励倍数
    const sceneConfig = SCENE_CONFIGS[currentScene];
    const sceneMult = sceneConfig?.rewardMultiplier || 1;

    // 计算天赋奖励倍数
    const talentMultipliers = this.calculateTalentMultipliers(progress);
    const rewardMult = (talentMultipliers.rewardMultiplier || 1) * sceneMult;

    // 计算基础奖励
    let reward = Math.floor(baseReward * rewardMult);

    // 困难难度惩罚
    if (difficulty === 'hard') {
      reward = Math.floor(reward * 0.8);
    }

    return reward;
  }

  /**
   * 计算天赋倍数
   * @param {GameProgress} progress - 游戏进度
   * @returns {Record<string, number>} 天赋倍数对象
   */
  static calculateTalentMultipliers(progress: GameProgress): Record<string, number> {
    const mults: Record<string, number> = {};
    
    for (const tid of Object.keys(progress.talentTree.talents)) {
      const level = progress.talentTree.talents[tid] || 0;
      const def = TALENT_DEFS.find(t => t.id === tid);
      if (!def || level <= 0) continue;
      
      const eff = def.effect(level);
      for (const [k, v] of Object.entries(eff)) {
        mults[k] = (mults[k] || 1) * v;
      }
    }
    
    return mults;
  }

  /**
   * 记录击杀并计算奖励
   * @param {string} enemyType - 敌人类型
   * @param {GameProgress} progress - 游戏进度
   * @param {SceneType} currentScene - 当前场景
   * @param {string} difficulty - 游戏难度
   * @returns {number} 击杀奖励金额
   */
  recordKillWithReward(
    enemyType: string,
    progress: GameProgress,
    currentScene: SceneType,
    difficulty: string
  ): number {
    // 计算奖励
    const reward = EconomyManager.calculateKillReward(enemyType, progress, currentScene, difficulty);
    
    // 记录击杀统计
    this.recordKill(enemyType, reward);
    
    return reward;
  }

  /**
   * 检查并解锁成就
   * @param {GameProgress} progress - 游戏进度
   * @param {Function} onAchievementUnlocked - 成就解锁回调
   * @returns {boolean} 是否有成就被解锁
   */
  checkAchievements(
    progress: GameProgress,
    onAchievementUnlocked?: (name: string, reward: number) => void
  ): boolean {
    const e = this.economy;
    const p = progress;
    let updated = false;
    
    for (const ach of p.achievements) {
      if (ach.unlocked) continue;
      
      let cond = false;
      switch (ach.id) {
        case 'first_blood': cond = e.totalKills >= 1; break;
        case 'roach_slayer': cond = e.totalKills >= 100; break;
        case 'roach_exterminator': cond = e.totalKills >= 1000; break;
        case 'wave_5': cond = e.highestWave >= 5; break;
        case 'wave_10': cond = e.highestWave >= 10; break;
        case 'endless_20': cond = e.highestEndlessWave >= 20; break;
        case 'endless_50': cond = e.highestEndlessWave >= 50; break;
        case 'money_1000': cond = e.totalMoneyEarned >= 1000; break;
        case 'perfect_wave': cond = e.perfectWaves >= 1; break;
        case 'no_breach': cond = e.breaches === 0 && e.highestWave >= 10; break;
        case 'kill_queen': cond = e.queenKills >= 1; break;
        case 'kill_flying': cond = e.flyingKills >= 50; break;
        case 'kill_armored': cond = e.armoredKills >= 30; break;
        case 'weapon_master': cond = (p.weaponsUnlocked?.length || 0) >= 5; break;
        case 'talent_first': cond = Object.values(p.talentTree.talents).some(v => (v || 0) > 0); break;
      }
      
      if (cond) {
        ach.unlocked = true;
        this.economy.money += ach.reward;
        this.economy.totalMoneyEarned += ach.reward;
        
        if (onAchievementUnlocked) {
          onAchievementUnlocked(ach.name, ach.reward);
        }
        
        updated = true;
      }
    }
    
    return updated;
  }

  /**
   * 获取天赋树点数
   * @param {GameProgress} progress - 游戏进度
   * @returns {number} 天赋树点数
   */
  getTalentPoints(progress: GameProgress): number {
    return progress.talentTree.points;
  }

  /**
   * 添加天赋树点数
   * @param {GameProgress} progress - 游戏进度
   * @param {number} points - 要添加的点数
   */
  addTalentPoints(progress: GameProgress, points: number): void {
    progress.talentTree.points += points;
  }

  /**
   * 获取天赋等级
   * @param {GameProgress} progress - 游戏进度
   * @param {string} talentId - 天赋ID
   * @returns {number} 天赋等级
   */
  getTalentLevel(progress: GameProgress, talentId: string): number {
    return progress.talentTree.talents[talentId] || 0;
  }

  /**
   * 升级天赋
   * @param {GameProgress} progress - 游戏进度
   * @param {string} talentId - 天赋ID
   * @returns {boolean} 是否成功升级
   */
  upgradeTalent(progress: GameProgress, talentId: string): boolean {
    const def = TALENT_DEFS.find(t => t.id === talentId);
    if (!def) return false;
    
    const currentLevel = progress.talentTree.talents[talentId] || 0;
    const nextLevel = currentLevel + 1;
    
    // 检查最大等级
    if (nextLevel > def.maxLevel) return false;
    
    // 检查点数是否足够
    const cost = def.cost;
    if (progress.talentTree.points < cost) return false;
    
    // 扣除点数并升级
    progress.talentTree.points -= cost;
    progress.talentTree.talents[talentId] = nextLevel;
    
    return true;
  }

  /**
   * 获取经济统计数据摘要
   * @returns {object} 经济统计数据摘要
   */
  getEconomySummary(): {
    totalMoney: number;
    totalKills: number;
    perfectWaves: number;
    breaches: number;
    highestWave: number;
    highestEndlessWave: number;
  } {
    return {
      totalMoney: this.economy.money,
      totalKills: this.economy.totalKills,
      perfectWaves: this.economy.perfectWaves,
      breaches: this.economy.breaches,
      highestWave: this.economy.highestWave,
      highestEndlessWave: this.economy.highestEndlessWave,
    };
  }

  /**
   * 获取当前经济数据
   * @returns {Economy} 当前经济数据
   */
  getEconomy(): Economy {
    return { ...this.economy };
  }

  /**
   * 添加金钱
   * @param {number} amount - 要添加的金钱数量
   * @returns {number} 添加后的总金钱数
   */
  addMoney(amount: number): number {
    this.economy.money += amount;
    this.economy.totalMoneyEarned += amount;
    return this.economy.money;
  }

  /**
   * 花费金钱
   * @param {number} amount - 要花费的金钱数量
   * @returns {boolean} 是否成功花费
   */
  spendMoney(amount: number): boolean {
    if (this.economy.money < amount) {
      return false;
    }
    this.economy.money -= amount;
    return true;
  }

  /**
   * 检查是否有足够的金钱
   * @param {number} amount - 需要检查的金钱数量
   * @returns {boolean} 是否有足够的金钱
   */
  hasEnoughMoney(amount: number): boolean {
    return this.economy.money >= amount;
  }

  /**
   * 记录击杀统计
   * @param {string} enemyType - 敌人类型
   * @param {number} reward - 击杀奖励
   */
  recordKill(enemyType: string, reward: number): void {
    this.economy.totalKills++;
    
    // 根据敌人类型记录特定击杀数
    switch (enemyType) {
      case 'small':
        this.economy.smallKills++;
        break;
      case 'large':
        this.economy.largeKills++;
        break;
      case 'flying':
        this.economy.flyingKills++;
        break;
      case 'armored':
        this.economy.armoredKills++;
        break;
      case 'splitting':
        this.economy.splittingKills++;
        break;
      case 'suicide':
        this.economy.suicideKills++;
        break;
      case 'queen':
        this.economy.queenKills++;
        break;
    }

    // 添加金钱奖励
    this.addMoney(reward);
  }

  /**
   * 记录完美波次
   */
  recordPerfectWave(): void {
    this.economy.perfectWaves++;
  }

  /**
   * 记录气体节省奖励
   * @param {number} amount - 节省的气体数量
   */
  recordGasSaved(amount: number): void {
    this.economy.gasSavedBonus += amount;
  }

  /**
   * 记录防线被突破
   */
  recordBreach(): void {
    this.economy.breaches++;
  }

  /**
   * 记录气体罐使用
   */
  recordGasCanisterUsed(): void {
    this.economy.gasCanistersUsed++;
  }

  /**
   * 更新最高波次记录
   * @param {number} wave - 当前波次
   * @param {boolean} isEndless - 是否为无尽模式
   */
  updateHighestWave(wave: number, isEndless: boolean = false): void {
    if (isEndless) {
      this.economy.highestEndlessWave = Math.max(this.economy.highestEndlessWave, wave);
    } else {
      this.economy.highestWave = Math.max(this.economy.highestWave, wave);
    }
  }

  /**
   * 记录游戏次数
   */
  recordGamePlayed(): void {
    this.economy.totalGamesPlayed++;
  }

  /**
   * 重置金钱（用于游戏失败时）
   */
  resetMoney(): void {
    this.economy.money = 0;
  }

  /**
   * 创建默认经济数据
   * @param {number} initialMoney - 初始金钱
   * @param {string} difficulty - 游戏难度
   * @param {boolean} hasRewardMultiplier - 是否有奖励倍率天赋
   * @returns {Economy} 默认经济数据
   */
  static createDefaultEconomy(
    initialMoney?: number,
    difficulty: string = 'normal',
    hasRewardMultiplier: boolean = false
  ): Economy {
    const startMoney = initialMoney !== undefined
      ? initialMoney
      : (difficulty === 'hard' ? 100 : (hasRewardMultiplier ? 150 : 200));
    
    return {
      money: startMoney,
      totalKills: 0,
      smallKills: 0,
      largeKills: 0,
      flyingKills: 0,
      armoredKills: 0,
      splittingKills: 0,
      suicideKills: 0,
      flyingSuicideKills: 0,
      queenKills: 0,
      nurseKills: 0,
      mutantKills: 0,
      timedSuicideKills: 0,
      perfectWaves: 0,
      gasSavedBonus: 0,
      breaches: 0,
      gasCanistersUsed: 0,
      highestWave: 0,
      highestEndlessWave: 0,
      totalGamesPlayed: 0,
      totalMoneyEarned: 0,
      totalDamage: 0,
      totalMoneySpent: 0,
      totalConsumablesUsed: 0,
      totalWeaponsUnlocked: 0,
      totalUpgradesPurchased: 0,
      totalAchievements: 0,
    };
  }
}