/**
 * @fileoverview 进度管理器模块
 * @description 管理游戏进度的更新和查询
 */

import type { GameProgress, SceneType, RoachType } from '../../types';
import { ENCYCLOPEDIA_DEFS, createDefaultProgress } from '../../data';
import { SaveSystem } from './SaveSystem';

/**
 * 进度管理器类
 * @description 管理游戏进度的更新、查询和状态维护
 */
export class ProgressManager {
  private progress: GameProgress;
  
  /**
   * 创建进度管理器
   * @param progress 初始进度数据
   */
  constructor(progress: GameProgress) {
    this.progress = progress;
  }
  
  /**
   * 获取当前进度
   * @returns 当前进度数据
   */
  getProgress(): GameProgress {
    return { ...this.progress };
  }
  
  /**
   * 更新进度
   * @param updates 进度更新数据
   */
  updateProgress(updates: Partial<GameProgress>): void {
    this.progress = { ...this.progress, ...updates };
    this.save();
  }
  
  /**
   * 保存进度
   */
  save(): void {
    SaveSystem.saveProgress(this.progress);
  }
  
  /**
   * 解锁新场景
   * @param scene 要解锁的场景
   */
  unlockScene(scene: SceneType): void {
    if (!this.progress.scenesUnlocked.includes(scene)) {
      this.progress.scenesUnlocked.push(scene);
      this.save();
    }
  }
  
  /**
   * 检查场景是否已解锁
   * @param scene 要检查的场景
   * @returns 是否已解锁
   */
  isSceneUnlocked(scene: SceneType): boolean {
    return this.progress.scenesUnlocked.includes(scene);
  }
  
  /**
   * 获取已解锁场景列表
   * @returns 已解锁场景列表
   */
  getUnlockedScenes(): SceneType[] {
    return [...this.progress.scenesUnlocked];
  }
  
  /**
   * 更新最高波次
   * @param wave 当前波次
   */
  updateHighestWave(wave: number): void {
    if (wave > this.progress.highestWave) {
      this.progress.highestWave = wave;
      this.save();
    }
  }
  
  /**
   * 更新无尽模式最高波次
   * @param wave 当前波次
   */
  updateHighestEndlessWave(wave: number): void {
    if (wave > this.progress.highestEndlessWave) {
      this.progress.highestEndlessWave = wave;
      this.save();
    }
  }
  
  /**
   * 增加击杀数
   * @param count 增加的击杀数
   */
  addKills(count: number): void {
    this.progress.totalKills += count;
    this.save();
  }
  
  /**
   * 解锁新武器
   * @param weaponType 武器类型
   */
  unlockWeapon(weaponType: string): void {
    if (!this.progress.weaponsUnlocked) {
      this.progress.weaponsUnlocked = [];
    }
    
    if (!this.progress.weaponsUnlocked.includes(weaponType)) {
      this.progress.weaponsUnlocked.push(weaponType);
      this.save();
    }
  }
  
  /**
   * 检查武器是否已解锁
   * @param weaponType 武器类型
   * @returns 是否已解锁
   */
  isWeaponUnlocked(weaponType: string): boolean {
    if (!this.progress.weaponsUnlocked) {
      return weaponType === 'flamethrower';
    }
    return this.progress.weaponsUnlocked.includes(weaponType) || weaponType === 'flamethrower';
  }
  
  /**
   * 获取已解锁武器列表
   * @returns 已解锁武器列表
   */
  getUnlockedWeapons(): string[] {
    if (!this.progress.weaponsUnlocked) {
      return ['flamethrower'];
    }
    return ['flamethrower', ...this.progress.weaponsUnlocked.filter(w => w !== 'flamethrower')];
  }
  
  /**
   * 更新图鉴击杀数
   * @param roachType 蟑螂类型
   * @param count 增加的击杀数
   */
  updateEncyclopediaKills(roachType: RoachType, count: number): void {
    if (!this.progress.encyclopedia) {
      this.progress.encyclopedia = { entries: [] };
    }
    
    // 查找或创建图鉴条目
    let entry = this.progress.encyclopedia.entries.find(e => e.type === roachType);
    if (!entry) {
      const def = ENCYCLOPEDIA_DEFS.find(e => e.type === roachType);
      if (!def) return;
      
      entry = {
        ...def,
        killCount: 0,
        unlocked: true
      };
      this.progress.encyclopedia.entries.push(entry);
    }
    
    // 更新击杀数
    entry.killCount += count;
    
    // 如果击杀数达到解锁条件，确保已解锁
    if (entry.killCount >= 1) {
      entry.unlocked = true;
    }
    
    this.save();
  }
  
  /**
   * 获取图鉴条目
   * @param roachType 蟑螂类型
   * @returns 图鉴条目，如果不存在则返回null
   */
  getEncyclopediaEntry(roachType: RoachType) {
    if (!this.progress.encyclopedia) {
      return null;
    }
    
    return this.progress.encyclopedia.entries.find(e => e.type === roachType) || null;
  }
  
  /**
   * 获取所有图鉴条目
   * @returns 所有图鉴条目
   */
  getAllEncyclopediaEntries() {
    if (!this.progress.encyclopedia) {
      return [];
    }
    
    return [...this.progress.encyclopedia.entries];
  }
  
  /**
   * 添加商店升级
   * @param upgradeId 升级ID
   */
  addShopUpgrade(upgradeId: string): void {
    if (!this.progress.shopUpgrades) {
      this.progress.shopUpgrades = [];
    }
    
    if (!this.progress.shopUpgrades.includes(upgradeId)) {
      this.progress.shopUpgrades.push(upgradeId);
      this.save();
    }
  }
  
  /**
   * 检查商店升级是否已购买
   * @param upgradeId 升级ID
   * @returns 是否已购买
   */
  hasShopUpgrade(upgradeId: string): boolean {
    if (!this.progress.shopUpgrades) {
      return false;
    }
    
    return this.progress.shopUpgrades.includes(upgradeId);
  }
  
  /**
   * 获取所有已购买的商店升级
   * @returns 已购买的商店升级列表
   */
  getShopUpgrades(): string[] {
    if (!this.progress.shopUpgrades) {
      return [];
    }
    
    return [...this.progress.shopUpgrades];
  }
  
  /**
   * 更新消耗品库存
   * @param consumableId 消耗品ID
   * @param count 数量变化（正数为增加，负数为减少）
   */
  updateConsumableInventory(consumableId: string, count: number): void {
    if (!this.progress.consumableInventory) {
      this.progress.consumableInventory = {};
    }
    
    const current = this.progress.consumableInventory[consumableId] || 0;
    const newCount = Math.max(0, current + count);
    
    if (newCount > 0) {
      this.progress.consumableInventory[consumableId] = newCount;
    } else {
      delete this.progress.consumableInventory[consumableId];
    }
    
    this.save();
  }
  
  /**
   * 获取消耗品数量
   * @param consumableId 消耗品ID
   * @returns 数量
   */
  getConsumableCount(consumableId: string): number {
    if (!this.progress.consumableInventory) {
      return 0;
    }
    
    return this.progress.consumableInventory[consumableId] || 0;
  }
  
  /**
   * 获取所有消耗品库存
   * @returns 消耗品库存
   */
  getConsumableInventory(): Record<string, number> {
    if (!this.progress.consumableInventory) {
      return {};
    }
    
    return { ...this.progress.consumableInventory };
  }
  
  /**
   * 设置消耗品自动使用
   * @param consumableId 消耗品ID
   * @param enabled 是否启用自动使用
   */
  setAutoUseEnabled(consumableId: string, enabled: boolean): void {
    if (!this.progress.autoUseEnabled) {
      this.progress.autoUseEnabled = {};
    }
    
    this.progress.autoUseEnabled[consumableId] = enabled;
    this.save();
  }
  
  /**
   * 检查消耗品是否启用自动使用
   * @param consumableId 消耗品ID
   * @returns 是否启用自动使用
   */
  isAutoUseEnabled(consumableId: string): boolean {
    if (!this.progress.autoUseEnabled) {
      return false;
    }
    
    return !!this.progress.autoUseEnabled[consumableId];
  }
  
  /**
   * 获取所有自动使用设置
   * @returns 自动使用设置
   */
  getAutoUseSettings(): Record<string, boolean> {
    if (!this.progress.autoUseEnabled) {
      return {};
    }
    
    return { ...this.progress.autoUseEnabled };
  }
  
  /**
   * 重置进度（保留天赋树和成就）
   */
  resetProgress(): void {
    const defaultProgress = createDefaultProgress();
    
    // 保留天赋树
    defaultProgress.talentTree = this.progress.talentTree;
    
    // 保留成就
    defaultProgress.achievements = this.progress.achievements;
    
    // 保留消耗品库存和自动使用设置
    if (this.progress.consumableInventory) {
      defaultProgress.consumableInventory = { ...this.progress.consumableInventory };
    }
    
    if (this.progress.autoUseEnabled) {
      defaultProgress.autoUseEnabled = { ...this.progress.autoUseEnabled };
    }
    
    this.progress = defaultProgress;
    this.save();
  }
  
  /**
   * 获取成就完成情况
   * @returns 成就完成统计
   */
  getAchievementStats(): {
    total: number;
    completed: number;
    percentage: number;
  } {
    const total = this.progress.achievements.length;
    const completed = this.progress.achievements.filter(a => a.completed).length;
    
    return {
      total,
      completed,
      percentage: total > 0 ? (completed / total) * 100 : 0
    };
  }
  
  /**
   * 检查成就是否完成
   * @param achievementId 成就ID
   * @returns 是否完成
   */
  isAchievementCompleted(achievementId: string): boolean {
    const achievement = this.progress.achievements.find(a => a.id === achievementId);
    return achievement ? (achievement.completed ?? false) : false;
  }
  
  /**
   * 完成成就
   * @param achievementId 成就ID
   */
  completeAchievement(achievementId: string): void {
    const achievement = this.progress.achievements.find(a => a.id === achievementId);
    if (achievement && !achievement.completed) {
      achievement.completed = true;
      this.save();
    }
  }
}