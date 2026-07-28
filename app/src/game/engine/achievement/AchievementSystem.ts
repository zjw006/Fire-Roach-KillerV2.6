/**
 * @fileoverview 成就系统模块
 * @description 负责管理游戏中的成就解锁、奖励发放和进度跟踪
 */

import { TEXT_CONFIG, FLOAT_COLOR } from '../../data';

/**
 * 成就数据接口
 */
export interface AchievementData {
  /** 成就ID */
  id: string;
  /** 成就名称 */
  name: string;
  /** 成就描述 */
  description: string;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 成就奖励（金钱） */
  reward: number;
  /** 解锁条件表达式（如 "totalKills >= 100"） */
  condition: string;
  /** 解锁条件描述 */
  conditionDescription: string;
}

/**
 * 经济统计数据接口
 */
export interface EconomyStats {
  /** 总击杀数 */
  totalKills: number;
  /** 最高波次 */
  highestWave: number;
  /** 最高无尽波次 */
  highestEndlessWave: number;
  /** 总获得金钱 */
  totalMoneyEarned: number;
  /** 完美波次数 */
  perfectWaves: number;
  /** 防线突破次数 */
  breaches: number;
  /** 女王击杀数 */
  queenKills: number;
  /** 飞行蟑螂击杀数 */
  flyingKills: number;
  /** 装甲蟑螂击杀数 */
  armoredKills: number;
}

/**
 * 玩家进度接口
 */
export interface PlayerProgress {
  /** 成就列表 */
  achievements: AchievementData[];
  /** 已解锁武器列表 */
  weaponsUnlocked?: string[];
  /** 天赋树数据 */
  talentTree: {
    /** 天赋点数 */
    points: number;
    /** 已学习天赋 */
    talents: Record<string, number>;
  };
}

/**
 * 成就系统配置接口
 */
export interface AchievementSystemConfig {
  /** 经济统计数据 */
  economyStats: EconomyStats;
  /** 玩家进度 */
  playerProgress: PlayerProgress;
  /** 游戏画布宽度 */
  canvasWidth: number;
  /** 游戏画布高度 */
  canvasHeight: number;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 添加金钱回调（成就奖励） */
  onAddMoney?: (amount: number) => void;
  /** 添加关卡内待结算金币回调（成就奖励计入关卡金币） */
  onAddPendingReward?: (amount: number) => void;
  /** 更新经济数据回调 */
  onEconomyUpdate?: (economy: any) => void;
  /** 保存进度回调 */
  onSaveProgress?: () => void;
}

/**
 * 成就系统类
 * @description 管理成就的解锁条件检查、奖励发放和进度跟踪
 */
export class AchievementSystem {
  /** 系统配置 */
  private config: AchievementSystemConfig;
  /** 自上次查看成就界面以来新解锁的成就 ID 集合（用于解锁动画） */
  private newlyUnlockedIds: Set<string> = new Set();

  /**
   * 构造函数
   * @param config 成就系统配置
   */
  constructor(config: AchievementSystemConfig) {
    this.config = config;
  }

  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<AchievementSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查并解锁符合条件的成就
   * @description 根据 ACHIEVEMENT_DEFS 中的 condition 配置动态求值，无需修改源码即可新增成就
   * @returns 是否有成就被解锁
   */
  checkAchievements(): boolean {
    const e = this.config.economyStats;
    const p = this.config.playerProgress;
    let updated = false;

    for (const ach of p.achievements) {
      if (ach.unlocked) continue;
      if (!this.evaluateCondition(ach.condition, e, p)) continue;

      ach.unlocked = true;
      this.newlyUnlockedIds.add(ach.id);
      this.grantAchievementReward(ach);
      updated = true;
    }

    if (updated) {
      this.config.onSaveProgress?.();
      this.config.onEconomyUpdate?.(this.config.economyStats);
    }

    return updated;
  }

  /**
   * 评估成就解锁条件（配置驱动）
   * @description 将 ACHIEVEMENT_DEFS 中的 condition 字符串（如 "totalKills >= 100"、"breaches == 0 and highestWave >= 10"）
   *              转换为 JavaScript 表达式求值，支持新增成就无需修改源码
   * @param condition 条件表达式字符串
   * @param e 经济统计数据
   * @param p 玩家进度
   * @returns 条件是否满足
   */
  private evaluateCondition(condition: string, e: EconomyStats, p: PlayerProgress): boolean {
    // 将 'and' 关键字转换为 '&&' 以支持 JavaScript 求值
    const jsCondition = condition.replace(/\band\b/gi, '&&');

    try {
      // 构造受控作用域：仅暴露 EconomyStats 和 PlayerProgress 中的已知字段
      const fn = new Function('e', 'p', `
        const { totalKills, highestWave, highestEndlessWave, totalMoneyEarned, perfectWaves, breaches, queenKills, flyingKills, armoredKills } = e;
        const weaponsUnlockedCount = (p.weaponsUnlocked?.length || 0);
        const allWeaponsUnlocked = weaponsUnlockedCount >= 5;
        const talentPointsSpent = Object.values(p.talentTree.talents).reduce((s, v) => s + (v || 0), 0);
        return ${jsCondition};
      `);
      return fn(e, p);
    } catch {
      // 条件表达式解析失败时返回 false，避免崩溃
      return false;
    }
  }

  /**
   * 发放成就奖励（提取公共逻辑，消除 checkAchievements 和 unlockAchievement 中的重复代码）
   * @param ach 成就数据
   */
  private grantAchievementReward(ach: AchievementData): void {
    // 发放奖励金币：优先使用关卡内待结算（仅在关卡内时），否则直接加钱
    if (this.config.onAddPendingReward) {
      this.config.onAddPendingReward(ach.reward);
    } else if (this.config.onAddMoney) {
      this.config.onAddMoney(ach.reward);
    }

    // 显示成就解锁浮动文字
    this.config.onAddFloatingText?.(
      this.config.canvasWidth / 2,
      this.config.canvasHeight / 2 - 50,
      TEXT_CONFIG.combat.achievementUnlock(ach.name, ach.reward),
      FLOAT_COLOR.gold
    );
  }

  /**
   * 获取已解锁成就数量
   * @returns 已解锁成就数量
   */
  getUnlockedAchievementCount(): number {
    return this.config.playerProgress.achievements.filter(ach => ach.unlocked).length;
  }

  /**
   * 获取总成就数量
   * @returns 总成就数量
   */
  getTotalAchievementCount(): number {
    return this.config.playerProgress.achievements.length;
  }

  /**
   * 获取成就进度百分比
   * @returns 成就进度百分比（0-100）
   */
  getAchievementProgress(): number {
    const total = this.getTotalAchievementCount();
    if (total === 0) return 100;
    
    const unlocked = this.getUnlockedAchievementCount();
    return Math.round((unlocked / total) * 100);
  }

  /**
   * 检查特定成就是否已解锁
   * @param achievementId 成就ID
   * @returns 是否已解锁
   */
  isAchievementUnlocked(achievementId: string): boolean {
    const ach = this.config.playerProgress.achievements.find(a => a.id === achievementId);
    return ach ? ach.unlocked : false;
  }

  /**
   * 解锁特定成就
   * @param achievementId 成就ID
   * @returns 是否成功解锁
   */
  unlockAchievement(achievementId: string): boolean {
    const ach = this.config.playerProgress.achievements.find(a => a.id === achievementId);
    if (!ach || ach.unlocked) {
      return false;
    }

    ach.unlocked = true;
    this.newlyUnlockedIds.add(ach.id);
    this.grantAchievementReward(ach);
    this.config.onSaveProgress?.();

    return true;
  }

  /**
   * 获取成就奖励总额
   * @returns 成就奖励总额
   */
  getTotalAchievementRewards(): number {
    return this.config.playerProgress.achievements
      .filter(ach => ach.unlocked)
      .reduce((total, ach) => total + ach.reward, 0);
  }

  /**
   * 获取未解锁成就列表
   * @returns 未解锁成就列表
   */
  getLockedAchievements(): AchievementData[] {
    return this.config.playerProgress.achievements.filter(ach => !ach.unlocked);
  }

  /**
   * 获取已解锁成就列表
   * @returns 已解锁成就列表
   */
  getUnlockedAchievements(): AchievementData[] {
    return this.config.playerProgress.achievements.filter(ach => ach.unlocked);
  }

  /**
   * 更新经济统计数据
   * @param stats 经济统计数据
   */
  updateEconomyStats(stats: Partial<EconomyStats>): void {
    Object.assign(this.config.economyStats, stats);
  }

  /**
   * 更新玩家进度
   * @param progress 玩家进度
   */
  updatePlayerProgress(progress: Partial<PlayerProgress>): void {
    if (progress.achievements) {
      // 合并成就数据：更新已有成就，添加新增成就（来自游戏更新）
      for (const newAch of progress.achievements) {
        const existingAch = this.config.playerProgress.achievements.find(a => a.id === newAch.id);
        if (existingAch) {
          existingAch.unlocked = newAch.unlocked;
        } else {
          // 新增成就 ID（例如游戏更新引入了新成就），添加到列表
          this.config.playerProgress.achievements.push({ ...newAch });
        }
      }
    }

    if (progress.weaponsUnlocked) {
      this.config.playerProgress.weaponsUnlocked = [...progress.weaponsUnlocked];
    }

    if (progress.talentTree) {
      Object.assign(this.config.playerProgress.talentTree, progress.talentTree);
    }
  }

  /**
   * 重置成就系统（仅重置单局数据，不重置已解锁成就）
   */
  reset(): void {
    // 清空新解锁动画队列
    this.newlyUnlockedIds.clear();

    // 重置经济统计数据（单局数据）
    this.config.economyStats = {
      totalKills: 0,
      highestWave: 0,
      highestEndlessWave: 0,
      totalMoneyEarned: 0,
      perfectWaves: 0,
      breaches: 0,
      queenKills: 0,
      flyingKills: 0,
      armoredKills: 0,
    };
  }

  /**
   * 获取成就解锁条件描述
   * @param achievementId 成就ID
   * @returns 解锁条件描述
   */
  getAchievementConditionDescription(achievementId: string): string {
    const ach = this.config.playerProgress.achievements.find(a => a.id === achievementId);
    return ach?.conditionDescription || '未知成就';
  }

  /**
   * 获取成就详细信息
   * @param achievementId 成就ID
   * @returns 成就详细信息
   */
  getAchievementDetails(achievementId: string): AchievementData | null {
    return this.config.playerProgress.achievements.find(a => a.id === achievementId) || null;
  }

  /**
   * 获取待播放动画的新解锁成就列表
   * @returns 新解锁成就列表
   */
  getPendingAnimations(): AchievementData[] {
    return this.config.playerProgress.achievements
      .filter(a => this.newlyUnlockedIds.has(a.id));
  }

  /**
   * 标记某个成就的解锁动画已播放
   * @param id 成就ID
   */
  markAnimationPlayed(id: string): void {
    this.newlyUnlockedIds.delete(id);
  }

  /**
   * 清除所有待播放动画标记（关闭成就界面时调用）
   */
  clearAnimationQueue(): void {
    this.newlyUnlockedIds.clear();
  }
}
