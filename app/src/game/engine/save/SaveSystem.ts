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
  private static readonly PROGRESS_KEY = 'roach_blaster_progress';
  private static readonly ENDLESS_BEST_TIME_KEY = 'roach_blaster_endless_best_time';
  private static readonly PARTICLE_LIMIT_KEY = 'roach_blaster_particle_limit';
  private static readonly CONSUMABLES_KEY = 'roach_blaster_consumables';
  private static readonly SAVE_VERSION = 3;
  
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
   * 保存游戏进度到本地存储
   * @param progress 游戏进度数据
   */
  static saveProgress(progress: GameProgress): void {
    try {
      // 确保保存版本号
      progress.saveVersion = this.SAVE_VERSION;
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(progress));
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
   * @returns 粒子限制，如果不存在则返回默认值300
   */
  static loadParticleLimit(): number {
    try {
      const saved = localStorage.getItem(this.PARTICLE_LIMIT_KEY);
      return saved ? parseInt(saved, 10) : 300;
    } catch (error) {
      console.warn('Failed to load particle limit from localStorage:', error);
      return 300;
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
  
  /**
   * 检查是否已看过游戏教程
   * @returns 是否已看过教程
   */
  static hasSeenGameplayTutorial(): boolean {
    try {
      return !!localStorage.getItem('gameplay_tutorial_seen');
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 标记已看过游戏教程
   */
  static markGameplayTutorialSeen(): void {
    try {
      localStorage.setItem('gameplay_tutorial_seen', 'true');
    } catch (error) {
      console.warn('Failed to mark gameplay tutorial as seen:', error);
    }
  }
  
  /**
   * 检查是否已看过商店教程
   * @returns 是否已看过商店教程
   */
  static hasSeenShopTutorial(): boolean {
    try {
      return !!localStorage.getItem('shop_tutorial_seen');
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 标记已看过商店教程
   */
  static markShopTutorialSeen(): void {
    try {
      localStorage.setItem('shop_tutorial_seen', 'true');
    } catch (error) {
      console.warn('Failed to mark shop tutorial as seen:', error);
    }
  }
  
  /**
   * 清除所有游戏数据
   * @description 用于测试或重置游戏
   */
  static clearAllData(): void {
    try {
      localStorage.removeItem(this.PROGRESS_KEY);
      localStorage.removeItem(this.ENDLESS_BEST_TIME_KEY);
      localStorage.removeItem(this.PARTICLE_LIMIT_KEY);
      localStorage.removeItem(this.CONSUMABLES_KEY);
      localStorage.removeItem('gameplay_tutorial_seen');
      localStorage.removeItem('shop_tutorial_seen');
      localStorage.removeItem('roach_blaster_player_id');
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
   * 迁移旧版本进度数据（完整迁移逻辑，与老引擎保持一致）
   * @param oldProgress 旧版本进度数据
   * @returns 迁移后的进度数据
   */
  private static migrateProgress(oldProgress: any): GameProgress {
    const oldVersion = oldProgress.saveVersion || 0;
    console.log(`[SaveSystem] Migrating from v${oldVersion} to v${this.SAVE_VERSION}`);

    // v1 → v2: 添加缺失字段
    if (oldVersion <= 1) {
      if (!oldProgress.scenesCompleted) oldProgress.scenesCompleted = [];
      if (!oldProgress.shopUpgrades) oldProgress.shopUpgrades = [];
      if (!oldProgress.encyclopedia || !oldProgress.encyclopedia.entries) {
        oldProgress.encyclopedia = { entries: ENCYCLOPEDIA_DEFS.map(e => ({ ...e })) };
      }
      oldProgress.saveVersion = 2;
    }

    // v2 → v3: 消耗品库存迁移到 GameProgress
    if (oldVersion <= 2 && this.SAVE_VERSION >= 3) {
      if (!oldProgress.consumableInventory || !oldProgress.autoUseEnabled) {
        try {
          const consumableSaved = localStorage.getItem(this.CONSUMABLES_KEY);
          if (consumableSaved) {
            const parsed = JSON.parse(consumableSaved);
            oldProgress.consumableInventory = parsed.consumables || {};
            oldProgress.autoUseEnabled = {};
          } else {
            oldProgress.consumableInventory = {};
            oldProgress.autoUseEnabled = {};
          }
        } catch {
          oldProgress.consumableInventory = {};
          oldProgress.autoUseEnabled = {};
        }
      }
      oldProgress.saveVersion = 3;
    }

    // 防御性字段检查（确保所有字段存在）
    if (!oldProgress.encyclopedia || !oldProgress.encyclopedia.entries) {
      oldProgress.encyclopedia = { entries: ENCYCLOPEDIA_DEFS.map(e => ({ ...e })) };
    }
    if (!oldProgress.scenesCompleted) oldProgress.scenesCompleted = [];
    if (!oldProgress.shopUpgrades) oldProgress.shopUpgrades = [];
    if (!oldProgress.weaponsUnlocked) oldProgress.weaponsUnlocked = ['flamethrower', 'sticky'];

    // 保存迁移后的数据
    this.saveProgress(oldProgress as GameProgress);
    console.log(`[SaveSystem] Migration v${oldVersion}→v${this.SAVE_VERSION} completed`);
    return oldProgress as GameProgress;
  }
  
  /**
   * 获取玩家ID
   * @returns 玩家ID，如果不存在则创建新的
   */
  static getOrCreatePlayerId(): string {
    const key = 'roach_blaster_player_id';
    try {
      let id = localStorage.getItem(key);
      if (!id) {
        id = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(key, id);
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
      let total = 0;
      let used = 0;
      
      // 计算所有游戏相关键的使用情况
      const gameKeys = [
        this.PROGRESS_KEY,
        this.ENDLESS_BEST_TIME_KEY,
        this.PARTICLE_LIMIT_KEY,
        this.CONSUMABLES_KEY,
        'gameplay_tutorial_seen',
        'shop_tutorial_seen',
        'roach_blaster_player_id'
      ];
      
      for (const key of gameKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }
      
      // 估算总存储空间（浏览器通常为5MB）
      total = 5 * 1024 * 1024; // 5MB in bytes
      
      return {
        total,
        used,
        available: total - used,
        percent: (used / total) * 100
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        available: 0,
        percent: 0
      };
    }
  }
}