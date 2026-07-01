/**
 * @fileoverview 云存档模块
 * @description 负责游戏进度的云端同步（简化实现）
 */

import type { GameProgress } from '../../types';

/**
 * 云存档管理器类
 * @description 管理游戏进度的云端同步
 */
export class CloudSaveManager {
  private static readonly API_BASE = '/api/player';
  private static readonly SYNC_INTERVAL = 30000; // 30秒
  private static lastSyncTime = 0;
  private static syncInProgress = false;
  
  /**
   * 同步进度到云端
   * @param progress 游戏进度数据
   * @param playerId 玩家ID
   * @returns 是否同步成功
   */
  static async syncToCloud(progress: GameProgress, playerId: string): Promise<boolean> {
    // 防止频繁同步
    const now = Date.now();
    if (now - this.lastSyncTime < this.SYNC_INTERVAL || this.syncInProgress) {
      return false;
    }
    
    this.syncInProgress = true;
    
    try {
      const response = await fetch(`${this.API_BASE}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId,
          progress
        }),
      });
      
      if (response.ok) {
        this.lastSyncTime = now;
        console.log('Progress synced to cloud successfully');
        return true;
      } else {
        console.warn('Failed to sync progress to cloud:', response.status);
        return false;
      }
    } catch (error) {
      console.warn('Error syncing progress to cloud:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * 从云端加载进度
   * @param playerId 玩家ID
   * @returns 云端进度数据，如果失败则返回null
   */
  static async loadFromCloud(playerId: string): Promise<GameProgress | null> {
    try {
      const response = await fetch(`${this.API_BASE}/load?playerId=${encodeURIComponent(playerId)}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Progress loaded from cloud successfully');
        return data.progress;
      } else if (response.status === 404) {
        // 云端没有存档，这是正常情况
        console.log('No cloud save found for player');
        return null;
      } else {
        console.warn('Failed to load progress from cloud:', response.status);
        return null;
      }
    } catch (error) {
      console.warn('Error loading progress from cloud:', error);
      return null;
    }
  }
  
  /**
   * 记录游戏会话
   * @param sessionData 会话数据
   * @returns 是否记录成功
   */
  static async logSession(sessionData: {
    playerId: string;
    scene: string;
    mode: string;
    difficulty: string;
    waveReached: number;
    kills: number;
    result: string;
    duration: number;
  }): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE}/logSession`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });
      
      if (response.ok) {
        console.log('Game session logged successfully');
        return true;
      } else {
        console.warn('Failed to log game session:', response.status);
        return false;
      }
    } catch (error) {
      console.warn('Error logging game session:', error);
      return false;
    }
  }
  
  /**
   * 检查云端存档是否更新
   * @param playerId 玩家ID
   * @param localTimestamp 本地存档时间戳
   * @returns 云端存档是否更新
   */
  static async checkCloudUpdate(playerId: string, localTimestamp: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE}/checkUpdate?playerId=${encodeURIComponent(playerId)}&timestamp=${localTimestamp}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.hasNewerVersion;
      }
      
      return false;
    } catch (error) {
      console.warn('Error checking cloud update:', error);
      return false;
    }
  }
  
  /**
   * 自动同步管理器
   * @description 定期自动同步进度到云端
   */
  static AutoSyncManager = class {
    private syncInterval: number | null = null;
    private isEnabled = false;
    
    /**
     * 启动自动同步
     * @param playerId 玩家ID
     * @param getProgress 获取当前进度的函数
     * @param interval 同步间隔（毫秒），默认30秒
     */
    start(playerId: string, getProgress: () => GameProgress, interval: number = CloudSaveManager.SYNC_INTERVAL): void {
      if (this.isEnabled) return;
      
      this.isEnabled = true;
      
      this.syncInterval = window.setInterval(async () => {
        const progress = getProgress();
        await CloudSaveManager.syncToCloud(progress, playerId);
      }, interval);
      
      console.log('Auto-sync started with interval:', interval, 'ms');
    }
    
    /**
     * 停止自动同步
     */
    stop(): void {
      if (!this.isEnabled) return;
      
      if (this.syncInterval !== null) {
        window.clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      
      this.isEnabled = false;
      console.log('Auto-sync stopped');
    }
    
    /**
     * 检查是否已启用自动同步
     * @returns 是否已启用
     */
    isAutoSyncEnabled(): boolean {
      return this.isEnabled;
    }
    
    /**
     * 立即同步一次
     * @param playerId 玩家ID
     * @param getProgress 获取当前进度的函数
     */
    async syncNow(playerId: string, getProgress: () => GameProgress): Promise<boolean> {
      const progress = getProgress();
      return await CloudSaveManager.syncToCloud(progress, playerId);
    }
  }
  
  /**
   * 冲突解决策略
   */
  static ConflictResolver = class {
    /**
     * 解决本地和云端存档冲突
     * @param localProgress 本地进度
     * @param cloudProgress 云端进度
     * @param strategy 解决策略：'local'（使用本地）、'cloud'（使用云端）、'merge'（合并）
     * @returns 解决后的进度
     */
    static resolve(
      localProgress: GameProgress,
      cloudProgress: GameProgress,
      strategy: 'local' | 'cloud' | 'merge' = 'merge'
    ): GameProgress {
      switch (strategy) {
        case 'local':
          return localProgress;
          
        case 'cloud':
          return cloudProgress;
          
        case 'merge':
        default:
          return this.mergeProgress(localProgress, cloudProgress);
      }
    }
    
    /**
     * 合并本地和云端进度
     * @param local 本地进度
     * @param cloud 云端进度
     * @returns 合并后的进度
     */
    private static mergeProgress(local: GameProgress, cloud: GameProgress): GameProgress {
      const merged: GameProgress = {
        ...local,
        saveVersion: Math.max(local.saveVersion, cloud.saveVersion),
        highestWave: Math.max(local.highestWave, cloud.highestWave),
        highestEndlessWave: Math.max(local.highestEndlessWave, cloud.highestEndlessWave),
        totalKills: Math.max(local.totalKills, cloud.totalKills),
      };
      
      // 合并已解锁场景（去重）
      const allScenes = [...(local.scenesUnlocked || []), ...(cloud.scenesUnlocked || [])];
      merged.scenesUnlocked = Array.from(new Set(allScenes));
      
      // 合并已解锁武器（去重）
      const allWeapons = [...(local.weaponsUnlocked || []), ...(cloud.weaponsUnlocked || [])];
      merged.weaponsUnlocked = Array.from(new Set(allWeapons));
      
      // 合并消耗品库存（取最大值）
      const localConsumables = local.consumableInventory || {};
      const cloudConsumables = cloud.consumableInventory || {};
      const mergedConsumables: Record<string, number> = {};
      
      const allConsumableIds = new Set([
        ...Object.keys(localConsumables),
        ...Object.keys(cloudConsumables)
      ]);
      
      for (const id of allConsumableIds) {
        mergedConsumables[id] = Math.max(
          localConsumables[id] || 0,
          cloudConsumables[id] || 0
        );
      }
      
      merged.consumableInventory = mergedConsumables;
      
      // 合并自动使用设置（优先本地）
      merged.autoUseEnabled = {
        ...(cloud.autoUseEnabled || {}),
        ...(local.autoUseEnabled || {})
      };
      
      return merged;
    }
  }
}