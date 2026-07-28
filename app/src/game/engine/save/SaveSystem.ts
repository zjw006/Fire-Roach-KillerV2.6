/**
 * @fileoverview 存档系统模块
 * @description 负责游戏进度的本地存储和加载
 */

import type { GameProgress } from '../../types';
import { createDefaultProgress, ENCYCLOPEDIA_DEFS } from '../../data';

/**
 * 存档系统类
 * @description 管理游戏进度的保存和加载
 */
export class SaveSystem {
  // ===== Storage Keys =====
  private static readonly PROGRESS_KEY = 'roach_blaster_progress';
  private static readonly ENDLESS_BEST_TIME_KEY = 'roach_blaster_endless_best_time';
  private static readonly PARTICLE_LIMIT_KEY = 'roach_blaster_particle_limit';
  private static readonly CONSUMABLES_KEY = 'roach_blaster_consumables';
  private static readonly PLAYER_ID_KEY = 'roach_blaster_player_id';
  private static readonly TUTORIAL_GAMEPLAY_KEY = 'gameplay_tutorial_seen';
  private static readonly TUTORIAL_SHOP_KEY = 'shop_tutorial_seen';

  // ===== Constants =====
  private static readonly SAVE_VERSION = 3;
  private static readonly DEFAULT_PARTICLE_LIMIT = 300;
  /** 浏览器 localStorage 估算总容量（字节） */
  private static readonly ESTIMATED_STORAGE_TOTAL = 5 * 1024 * 1024; // 5MB

  /**
   * 从本地存储加载游戏进度
   * @returns 游戏进度数据
   */
  static loadProgress(): GameProgress {
    try {
      const saved = localStorage.getItem(this.PROGRESS_KEY);
      if (!saved) {
        return this.createAndSaveDefaultProgress();
      }

      const parsed = JSON.parse(saved);

      // 版本迁移逻辑
      if (!parsed.saveVersion || parsed.saveVersion < this.SAVE_VERSION) {
        return this.migrateProgress(parsed);
      }

      return parsed;
    } catch (error) {
      console.warn('Failed to load progress from localStorage:', error);
      return this.createAndSaveDefaultProgress();
    }
  }

  /**
   * 保存游戏进度到本地存储（不修改传入对象）
   * @param progress 游戏进度数据
   */
  static saveProgress(progress: GameProgress): void {
    try {
      // 创建副本并设置版本号，避免修改传入对象
      const toSave = { ...progress, saveVersion: this.SAVE_VERSION };
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.warn('Failed to save progress to localStorage:', error);
    }
  }

  /**
   * 从本地存储加载无尽模式最佳时长
   * @returns 最佳时长（秒），如果不存在则返回0
   */
  static loadEndlessBestTime(): number {
    try {
      const saved = localStorage.getItem(this.ENDLESS_BEST_TIME_KEY);
      return saved ? parseFloat(saved) : 0;
    } catch (error) {
      console.warn('Failed to load endless best time from localStorage:', error);
      return 0;
    }
  }

  /**
   * 保存无尽模式最佳时长到本地存储
   * @param time 最佳时长（秒）
   */
  static saveEndlessBestTime(time: number): void {
    try {
      localStorage.setItem(this.ENDLESS_BEST_TIME_KEY, time.toString());
    } catch (error) {
      console.warn('Failed to save endless best time to localStorage:', error);
    }
  }

  /**
   * 从本地存储加载粒子限制
   * @returns 粒子限制，如果不存在则返回默认值
   */
  static loadParticleLimit(): number {
    try {
      const saved = localStorage.getItem(this.PARTICLE_LIMIT_KEY);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      return this.DEFAULT_PARTICLE_LIMIT;
    } catch (error) {
      console.warn('Failed to load particle limit from localStorage:', error);
      return this.DEFAULT_PARTICLE_LIMIT;
    }
  }

  /**
   * 保存粒子限制到本地存储
   * @param limit 粒子限制
   */
  static saveParticleLimit(limit: number): void {
    try {
      localStorage.setItem(this.PARTICLE_LIMIT_KEY, limit.toString());
    } catch (error) {
      console.warn('Failed to save particle limit to localStorage:', error);
    }
  }

  // ===== 教程标记（统一实现） =====

  /**
   * 通用教程标记读取
   * @param key localStorage 键名
   * @returns 是否已标记（严格匹配 'true'，避免误判）
   */
  private static getTutorialFlag(key: string): boolean {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * 通用教程标记写入
   * @param key localStorage 键名
   */
  private static setTutorialFlag(key: string): void {
    try {
      localStorage.setItem(key, 'true');
    } catch (error) {
      console.warn(`Failed to set tutorial flag "${key}":`, error);
    }
  }

  /**
   * 检查是否已看过游戏教程
   * @returns 是否已看过教程
   */
  static hasSeenGameplayTutorial(): boolean {
    return this.getTutorialFlag(this.TUTORIAL_GAMEPLAY_KEY);
  }

  /**
   * 标记已看过游戏教程
   */
  static markGameplayTutorialSeen(): void {
    this.setTutorialFlag(this.TUTORIAL_GAMEPLAY_KEY);
  }

  /**
   * 检查是否已看过商店教程
   * @returns 是否已看过商店教程
   */
  static hasSeenShopTutorial(): boolean {
    return this.getTutorialFlag(this.TUTORIAL_SHOP_KEY);
  }

  /**
   * 标记已看过商店教程
   */
  static markShopTutorialSeen(): void {
    this.setTutorialFlag(this.TUTORIAL_SHOP_KEY);
  }

  /**
   * 清除所有游戏数据
   * @description 用于测试或重置游戏
   */
  static clearAllData(): void {
    try {
      const allKeys = [
        this.PROGRESS_KEY,
        this.ENDLESS_BEST_TIME_KEY,
        this.PARTICLE_LIMIT_KEY,
        this.CONSUMABLES_KEY,
        this.PLAYER_ID_KEY,
        this.TUTORIAL_GAMEPLAY_KEY,
        this.TUTORIAL_SHOP_KEY,
      ];
      for (const key of allKeys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Failed to clear game data:', error);
    }
  }

  /**
   * 创建并保存默认进度
   * @returns 默认进度数据
   */
  private static createAndSaveDefaultProgress(): GameProgress {
    const defaultProgress = createDefaultProgress();
    this.saveProgress(defaultProgress);
    return defaultProgress;
  }

  /**
   * 安全迁移旧版本进度数据（基于 createDefaultProgress 合并，不再使用类型断言）
   * @param oldProgress 旧版本进度数据（any 类型，因为字段可能缺失）
   * @returns 迁移后保证类型安全的进度数据
   */
  private static migrateProgress(oldProgress: any): GameProgress {
    const oldVersion = oldProgress.saveVersion || 0;
    console.log(`[SaveSystem] Migrating from v${oldVersion} to v${this.SAVE_VERSION}`);

    // 以默认进度为底板，确保所有字段存在且类型正确
    const fresh = createDefaultProgress();

    // 安全复制已知字段（只复制通过类型检查的字段）
    if (oldProgress.talentTree && typeof oldProgress.talentTree === 'object') {
      fresh.talentTree = oldProgress.talentTree;
    }
    if (Array.isArray(oldProgress.achievements)) {
      fresh.achievements = oldProgress.achievements;
    }
    if (typeof oldProgress.highestWave === 'number') {
      fresh.highestWave = oldProgress.highestWave;
    }
    if (typeof oldProgress.highestEndlessWave === 'number') {
      fresh.highestEndlessWave = oldProgress.highestEndlessWave;
    }
    if (typeof oldProgress.totalKills === 'number') {
      fresh.totalKills = oldProgress.totalKills;
    }
    if (Array.isArray(oldProgress.scenesUnlocked)) {
      fresh.scenesUnlocked = oldProgress.scenesUnlocked;
    }
    if (Array.isArray(oldProgress.scenesCompleted)) {
      fresh.scenesCompleted = oldProgress.scenesCompleted;
    }
    if (Array.isArray(oldProgress.weaponsUnlocked)) {
      fresh.weaponsUnlocked = oldProgress.weaponsUnlocked;
    }
    if (Array.isArray(oldProgress.unlockedItems)) {
      fresh.unlockedItems = oldProgress.unlockedItems;
    }
    if (oldProgress.encyclopedia && Array.isArray(oldProgress.encyclopedia.entries)) {
      fresh.encyclopedia = oldProgress.encyclopedia;
    }
    if (Array.isArray(oldProgress.shopUpgrades)) {
      fresh.shopUpgrades = oldProgress.shopUpgrades;
    }
    if (oldProgress.consumableInventory && typeof oldProgress.consumableInventory === 'object') {
      fresh.consumableInventory = oldProgress.consumableInventory;
    }
    if (oldProgress.autoUseEnabled && typeof oldProgress.autoUseEnabled === 'object') {
      fresh.autoUseEnabled = oldProgress.autoUseEnabled;
    }

    // v2 → v3: 消耗品库存迁移到 GameProgress
    if (oldVersion <= 2 && this.SAVE_VERSION >= 3) {
      if (!oldProgress.consumableInventory) {
        try {
          const saved = localStorage.getItem(this.CONSUMABLES_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.consumables && typeof parsed.consumables === 'object') {
              fresh.consumableInventory = parsed.consumables;
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
      // 确保 autoUseEnabled 存在
      if (!fresh.autoUseEnabled) {
        fresh.autoUseEnabled = {};
      }
    }

    // 保存迁移后的数据
    this.saveProgress(fresh);
    console.log(`[SaveSystem] Migration v${oldVersion}→v${this.SAVE_VERSION} completed`);
    return fresh;
  }

  /**
   * 获取玩家ID
   * @returns 玩家ID，如果不存在则创建新的
   */
  static getOrCreatePlayerId(): string {
    try {
      let id = localStorage.getItem(this.PLAYER_ID_KEY);
      if (!id) {
        id = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(this.PLAYER_ID_KEY, id);
      }
      return id;
    } catch (error) {
      // 如果localStorage不可用，生成临时ID
      return 'temp_' + Date.now().toString(36);
    }
  }

  /**
   * 检查本地存储是否可用
   * @returns 本地存储是否可用
   */
  static isLocalStorageAvailable(): boolean {
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取存储使用情况
   * @returns 存储使用情况信息
   */
  static getStorageUsage(): {
    total: number;
    used: number;
    available: number;
    percent: number;
  } {
    try {
      const allKeys = [
        this.PROGRESS_KEY,
        this.ENDLESS_BEST_TIME_KEY,
        this.PARTICLE_LIMIT_KEY,
        this.CONSUMABLES_KEY,
        this.PLAYER_ID_KEY,
        this.TUTORIAL_GAMEPLAY_KEY,
        this.TUTORIAL_SHOP_KEY,
      ];

      let used = 0;
      for (const key of allKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          // 使用 Blob 精确计算字节数（UTF-16 → UTF-8 编码）
          // Blob.size 返回的是 UTF-8 编码后的实际字节数
          used += new Blob([key]).size + new Blob([value]).size;
        }
      }

      const total = this.ESTIMATED_STORAGE_TOTAL;

      return {
        total,
        used,
        available: total - used,
        percent: (used / total) * 100,
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        available: 0,
        percent: 0,
      };
    }
  }
}