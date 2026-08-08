/**
 * @fileoverview 游戏经济系统管理器
 * @description 负责管理游戏中的金钱、统计数据和天赋系统
 */

import type { Economy, GameProgress, SceneType, RoachType } from '../../types';
import { ENEMY_DEFS, SCENE_CONFIGS, TALENT_DEFS, BALANCE_CONFIG } from '../../data';

/**
 * 经济系统管理器类
 * @description 管理游戏中的金钱、统计数据和天赋系统
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
    enemyType: RoachType,
    progress: GameProgress,
    currentScene: SceneType,
    difficulty: string
  ): number {
    // 获取敌人基础奖励
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

    // 困难难度惩罚（修复 P2：使用配置值）
    if (difficulty === 'hard') {
      reward = Math.floor(reward * BALANCE_CONFIG.economy.hardModeRewardPenalty);
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
   * @param {RoachType} enemyType - 敌人类型（修复 P1：使用枚举替代 string）
   * @param {GameProgress} progress - 游戏进度
   * @param {SceneType} currentScene - 当前场景
   * @param {string} difficulty - 游戏难度
   * @returns {number} 击杀奖励金额
   */
  recordKillWithReward(
    enemyType: RoachType,
    progress: GameProgress,
    currentScene: SceneType,
    difficulty: string
  ): number {
    const reward = EconomyManager.calculateKillReward(enemyType, progress, currentScene, difficulty);
    this.recordKill(enemyType, reward);
    return reward;
  }

  /**
   * 记录击杀统计（修复 P0：添加缺失的敌人类型）
   * @param {RoachType} enemyType - 敌人类型
   * @param {number} reward - 击杀奖励
   */
  recordKill(enemyType: RoachType, reward: number): void {
    this.economy.totalKills++;

    // 根据敌人类型记录特定击杀数
    switch (enemyType) {
      case 'small':        this.economy.smallKills++; break;
      case 'large':        this.economy.largeKills++; break;
      case 'flying':       this.economy.flyingKills++; break;
      case 'armored':      this.economy.armoredKills++; break;
      case 'splitting':    this.economy.splittingKills++; break;
      case 'suicide':      this.economy.suicideKills++; break;
      case 'flying_suicide': this.economy.flyingSuicideKills++; break;
      case 'queen':        this.economy.queenKills++; break;
      case 'nurse':        this.economy.nurseKills++; break;
      case 'mutant':       this.economy.mutantKills++; break;
      case 'timed_suicide': this.economy.timedSuicideKills++; break;
      case 'tunnel_worker': this.economy.tunnelWorkerKills++; break;
      case 'subway_elite': this.economy.subwayEliteKills++; break;
    }

    // 修复 P0：直接操作 money 和 totalMoneyEarned，不通过 addMoney 避免歧义
    this.economy.money += reward;
    this.economy.totalMoneyEarned += reward;
  }

  // ========== 天赋树操作 ==========

  /**
   * 获取天赋树点数
   */
  getTalentPoints(progress: GameProgress): number {
    return progress.talentTree.points;
  }

  /**
   * 添加天赋树点数
   */
  addTalentPoints(progress: GameProgress, points: number): void {
    progress.talentTree.points += points;
  }

  /**
   * 获取天赋等级
   */
  getTalentLevel(progress: GameProgress, talentId: string): number {
    return progress.talentTree.talents[talentId] || 0;
  }

  /**
   * 升级天赋（修复 P1：支持等级递增成本；修复 P1：不直接修改参数）
   * @param {GameProgress} progress - 游戏进度（只读，不修改）
   * @param {string} talentId - 天赋ID
   * @returns {{ success: boolean; newProgress?: GameProgress }} 升级结果
   */
  upgradeTalent(
    progress: GameProgress,
    talentId: string
  ): { success: boolean; newProgress?: GameProgress } {
    const def = TALENT_DEFS.find(t => t.id === talentId);
    if (!def) return { success: false };

    const currentLevel = progress.talentTree.talents[talentId] || 0;
    const nextLevel = currentLevel + 1;

    // 检查最大等级
    if (nextLevel > def.maxLevel) return { success: false };

    // 修复 P1：等级递增成本
    const scaling = BALANCE_CONFIG.economy.talentCostScaling;
    const cost = Math.floor(def.cost * Math.pow(scaling, currentLevel));

    // 检查点数是否足够
    if (progress.talentTree.points < cost) return { success: false };

    // 修复 P1：返回新对象，不修改原参数
    const newProgress: GameProgress = {
      ...progress,
      talentTree: {
        ...progress.talentTree,
        points: progress.talentTree.points - cost,
        talents: {
          ...progress.talentTree.talents,
          [talentId]: nextLevel,
        },
      },
    };

    return { success: true, newProgress };
  }

  // ========== 金钱操作 ==========

  /**
   * 获取当前经济数据（修复 P1：Economy 全为原始值，浅拷贝即深拷贝）
   * @returns {Economy} 当前经济数据副本
   */
  getEconomy(): Economy {
    // Economy 接口所有字段均为 number 原始类型，{ ... } 即等价于深拷贝
    return { ...this.economy };
  }

  /**
   * 添加金钱（修复 P0：不再递增 totalMoneyEarned，由调用方负责）
   * @param {number} amount - 要添加的金钱数量
   * @returns {number} 添加后的总金钱数
   */
  addMoney(amount: number): number {
    this.economy.money += amount;
    return this.economy.money;
  }

  /**
   * 花费金钱（修复 P2：合并 hasEnoughMoney + spendMoney）
   * @param {number} amount - 要花费的金钱数量
   * @returns {boolean} 是否成功花费
   */
  trySpendMoney(amount: number): boolean {
    if (this.economy.money < amount) return false;
    this.economy.money -= amount;
    this.economy.totalMoneySpent += amount;
    return true;
  }

  /**
   * 检查是否有足够的金钱
   * @deprecated 使用 trySpendMoney 替代
   */
  hasEnoughMoney(amount: number): boolean {
    return this.economy.money >= amount;
  }

  /**
   * 花费金钱（不检查余额）
   * @deprecated 使用 trySpendMoney 替代
   */
  spendMoney(amount: number): boolean {
    if (this.economy.money < amount) return false;
    this.economy.money -= amount;
    this.economy.totalMoneySpent += amount;
    return true;
  }

  // ========== 统计记录 ==========

  /**
   * 记录完美波次
   */
  recordPerfectWave(): void {
    this.economy.perfectWaves++;
  }

  /**
   * 记录气体节省奖励
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
   * 获取经济统计数据摘要
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
   * 创建默认经济数据（修复 P2：使用 BALANCE_CONFIG 替代硬编码）
   * @param {number} initialMoney - 初始金钱（可选，默认从配置读取）
   * @param {string} difficulty - 游戏难度
   * @param {boolean} hasRewardMultiplier - 是否有奖励倍率天赋
   * @returns {Economy} 默认经济数据
   */
  static createDefaultEconomy(
    initialMoney?: number,
    difficulty: string = 'normal',
    hasRewardMultiplier: boolean = false
  ): Economy {
    const ecoCfg = BALANCE_CONFIG.economy;
    const startMoney = initialMoney !== undefined
      ? initialMoney
      : (difficulty === 'hard'
          ? ecoCfg.initialMoney.hard
          : (hasRewardMultiplier ? ecoCfg.initialMoney.normal : ecoCfg.initialMoney.easy));

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
      tunnelWorkerKills: 0,
      subwayEliteKills: 0,
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