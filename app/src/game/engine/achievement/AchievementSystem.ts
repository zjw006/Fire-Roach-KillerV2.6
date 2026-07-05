/**
 * @fileoverview 成就系统模块
 * @description 负责管理游戏中的成就解锁、奖励发放和进度跟踪
 */

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
   * @returns 是否有成就被解锁
   */
  checkAchievements(): boolean {
    const e = this.config.economyStats;
    const p = this.config.playerProgress;
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
        
        // 添加成就奖励金钱
        if (this.config.onAddMoney) {
          this.config.onAddMoney(ach.reward);
        }

        // 添加成就解锁浮动文字
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.config.canvasWidth / 2,
            this.config.canvasHeight / 2 - 50,
            `成就: ${ach.name} +¥${ach.reward}`,
            '#fbbf24'
          );
        }

        updated = true;
      }
    }

    if (updated) {
      // 保存进度
      if (this.config.onSaveProgress) {
        this.config.onSaveProgress();
      }

      // 更新经济数据
      if (this.config.onEconomyUpdate) {
        this.config.onEconomyUpdate(this.config.economyStats);
      }
    }

    return updated;
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
    
    // 添加成就奖励金钱
    if (this.config.onAddMoney) {
      this.config.onAddMoney(ach.reward);
    }

    // 添加成就解锁浮动文字
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 2 - 50,
        `成就: ${ach.name} +¥${ach.reward}`,
        '#fbbf24'
      );
    }

    // 保存进度
    if (this.config.onSaveProgress) {
      this.config.onSaveProgress();
    }

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
      // 合并成就数据
      for (const newAch of progress.achievements) {
        const existingAch = this.config.playerProgress.achievements.find(a => a.id === newAch.id);
        if (existingAch) {
          existingAch.unlocked = newAch.unlocked;
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
   * 重置成就系统
   */
  reset(): void {
    // 重置所有成就为未解锁状态
    for (const ach of this.config.playerProgress.achievements) {
      ach.unlocked = false;
    }

    // 重置经济统计数据
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
    switch (achievementId) {
      case 'first_blood': return '击杀第1只蟑螂';
      case 'roach_slayer': return '累计击杀100只蟑螂';
      case 'roach_exterminator': return '累计击杀1000只蟑螂';
      case 'wave_5': return '通关第5波';
      case 'wave_10': return '通关第10波';
      case 'endless_20': return '无尽模式达到20波';
      case 'endless_50': return '无尽模式达到50波';
      case 'money_1000': return '累计获得1000金钱';
      case 'perfect_wave': return '完成1次完美波次（无防线突破）';
      case 'no_breach': return '连续10波无防线突破';
      case 'kill_queen': return '击杀1只女王蟑螂';
      case 'kill_flying': return '累计击杀50只飞行蟑螂';
      case 'kill_armored': return '累计击杀30只装甲蟑螂';
      case 'weapon_master': return '解锁5种武器';
      case 'talent_first': return '学习第1个天赋';
      default: return '未知成就';
    }
  }

  /**
   * 获取成就详细信息
   * @param achievementId 成就ID
   * @returns 成就详细信息
   */
  getAchievementDetails(achievementId: string): AchievementData | null {
    return this.config.playerProgress.achievements.find(a => a.id === achievementId) || null;
  }
}
