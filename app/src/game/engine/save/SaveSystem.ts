/**
 * @fileoverview 存档系统模块
 * @description 负责游戏进度的本地存储和加载
 */

import type { GameProgress } from '../../types';
import { createDefaultProgress, BALANCE_CONFIG, TALENT_DEFS } from '../../data';

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
  private static readonly SAVE_VERSION = 4;
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
    // 注意：talentTree 不做盲拷贝 —— v3 及以下需走 v4 天赋树重构迁移（见下方）
    if (typeof oldProgress.pendingTalentPoints === 'number') {
      fresh.pendingTalentPoints = oldProgress.pendingTalentPoints;
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
    if (oldProgress.levelStars && typeof oldProgress.levelStars === 'object') {
      fresh.levelStars = oldProgress.levelStars;
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

    // v3 → v4: 天赋树重构（旧天赋等级映射 + 点数按新经济表重算）
    if (oldVersion <= 3) {
      this.migrateTalentTreeV4(oldProgress, fresh);
    }

    // 保存迁移后的数据
    this.saveProgress(fresh);
    console.log(`[SaveSystem] Migration v${oldVersion}→v${this.SAVE_VERSION} completed`);
    return fresh;
  }

  /**
   * v3 → v4 天赋树迁移
   * @description 旧天赋等级映射到新三系节点（只降不升），点数按新经济表重算：
   * 新余额 = 已通关场景固定点 + 三星奖励 − 映射节点造价（下限 0）；
   * 天赋未解锁（地下室未通关）时三星点存入 pendingTalentPoints 待解锁池。
   * 4 个武器解锁死天赋（freeze/poison/shotgun/molotov_weapon）全额退款（不映射），
   * defense_hp L3 以下退款（不映射）。
   * @param oldProgress 旧版本进度数据
   * @param fresh 迁移目标进度对象（就地修改）
   */
  private static migrateTalentTreeV4(oldProgress: any, fresh: GameProgress): void {
    const oldTalents: Record<string, number> =
      (oldProgress.talentTree && typeof oldProgress.talentTree.talents === 'object'
        ? oldProgress.talentTree.talents
        : {}) || {};

    // 等级映射（只降不升）：旧5级制 L1-2→L1, L3-4→L2, L5→L3；旧3级制 L1-2→L1, L3+→L2
    const map5 = (lv: number) => (lv >= 5 ? 3 : lv >= 3 ? 2 : lv >= 1 ? 1 : 0);
    const map3 = (lv: number) => (lv >= 3 ? 2 : lv >= 1 ? 1 : 0);

    const mapped: Record<string, number> = {};
    const set = (id: string, lv: number) => {
      if (lv > 0) mapped[id] = Math.max(mapped[id] || 0, lv);
    };

    set('pressure', map5(oldTalents.fire_damage || 0));        // 火焰强化 → 增压阀
    set('nozzle', map5(oldTalents.fire_range || 0));           // 射程延伸 → 扩口喷嘴
    set('tank', map3(oldTalents.gas_capacity || 0));           // 燃气扩容 → 扩容气罐
    set('fins', map3(oldTalents.cool_speed || 0));             // 快速冷却 → 散热鳍片
    set('alloy', map3(oldTalents.overheat_resist || 0));       // 耐热改造 → 耐热合金
    set('bounty', map5(oldTalents.money_boost || 0));          // 赏金猎人
    set('saver', map3(oldTalents.resource_saver || 0));        // 节约大师
    set('mech', map3(oldTalents.mechanical_mastery || 0));     // 机械精通
    // 火焰亲和/爆炸专家 取最高 → 烈焰燃料
    set('molfuel', map3(Math.max(oldTalents.fire_affinity || 0, oldTalents.explosive_expert || 0)));
    // 防线加固 ≥L3 → 防线协议；<L3 退款（不映射）
    if ((oldTalents.defense_hp || 0) >= 3) set('wall', 1);
    // freeze/poison/shotgun/molotov_weapon 4 个死天赋 → 全额退款（不映射）

    // ===== 点数重算：新经济表总收入 − 映射节点造价（下限 0） =====
    const rewardCfg = BALANCE_CONFIG.economy.talentPointReward;
    const completed: string[] = Array.isArray(oldProgress.scenesCompleted) ? oldProgress.scenesCompleted : [];
    const stars: Record<string, number> =
      oldProgress.levelStars && typeof oldProgress.levelStars === 'object' ? oldProgress.levelStars : {};

    let income = 0;
    for (const scene of completed) income += rewardCfg.perScene[scene] ?? 0;
    const threeStarCount = Object.values(stars).filter(s => s === 3).length;
    // 天赋系统已解锁（地下室已通关）：三星点直接计入收入；否则存入待解锁池
    if (completed.includes('basement')) {
      income += threeStarCount * rewardCfg.threeStarBonus;
      fresh.pendingTalentPoints = 0;
    } else {
      fresh.pendingTalentPoints = threeStarCount * rewardCfg.threeStarBonus;
    }

    let spent = 0;
    for (const [id, lv] of Object.entries(mapped)) {
      const def = TALENT_DEFS.find(t => t.id === id);
      if (def) spent += lv * def.cost;
    }

    fresh.talentTree = { points: Math.max(0, income - spent), talents: mapped };
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