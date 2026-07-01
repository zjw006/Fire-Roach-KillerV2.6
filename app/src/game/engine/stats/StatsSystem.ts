/**
 * @fileoverview 统计系统模块
 * @description 负责管理游戏中的各种统计数据收集、更新和分析
 */

/**
 * 游戏统计数据接口
 */
export interface GameStats {
  /** 总游戏次数 */
  totalGamesPlayed: number;
  /** 总获得金钱 */
  totalMoneyEarned: number;
  /** 总造成伤害 */
  totalDamage: number;
  /** 总花费金钱 */
  totalMoneySpent: number;
  /** 总使用消耗品数量 */
  totalConsumablesUsed: number;
  /** 总解锁武器数量 */
  totalWeaponsUnlocked: number;
  /** 总购买升级次数 */
  totalUpgradesPurchased: number;
  /** 总成就数量 */
  totalAchievements: number;
  /** 总击杀数 */
  totalKills: number;
  /** 最高波次 */
  highestWave: number;
  /** 最高无尽波次 */
  highestEndlessWave: number;
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
  /** 燃气罐使用次数 */
  gasCanistersUsed: number;
}

/**
 * 统计系统配置接口
 */
export interface StatsSystemConfig {
  /** 初始统计数据 */
  initialStats?: Partial<GameStats>;
  /** 更新统计数据回调 */
  onStatsUpdate?: (stats: GameStats) => void;
}

/**
 * 统计系统类
 * @description 管理游戏中的各种统计数据收集、更新和分析
 */
export class StatsSystem {
  /** 统计数据 */
  private stats: GameStats;
  /** 系统配置 */
  private config: StatsSystemConfig;

  /**
   * 构造函数
   * @param config 统计系统配置
   */
  constructor(config: StatsSystemConfig = {}) {
    this.config = config;
    
    // 初始化统计数据
    this.stats = {
      totalGamesPlayed: 0,
      totalMoneyEarned: 0,
      totalDamage: 0,
      totalMoneySpent: 0,
      totalConsumablesUsed: 0,
      totalWeaponsUnlocked: 0,
      totalUpgradesPurchased: 0,
      totalAchievements: 0,
      totalKills: 0,
      highestWave: 0,
      highestEndlessWave: 0,
      perfectWaves: 0,
      breaches: 0,
      queenKills: 0,
      flyingKills: 0,
      armoredKills: 0,
      gasCanistersUsed: 0,
      ...config.initialStats,
    };
  }

  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<StatsSystemConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.initialStats) {
      Object.assign(this.stats, config.initialStats);
    }
  }

  /**
   * 获取完整统计数据
   * @returns 完整统计数据
   */
  getStats(): GameStats {
    return { ...this.stats };
  }

  /**
   * 更新统计数据
   * @param updates 统计数据更新
   */
  updateStats(updates: Partial<GameStats>): void {
    Object.assign(this.stats, updates);
    this.notifyUpdate();
  }

  /**
   * 增加统计数据
   * @param key 统计键名
   * @param value 增加值
   */
  incrementStat<K extends keyof GameStats>(key: K, value: number = 1): void {
    if (typeof this.stats[key] === 'number') {
      (this.stats[key] as number) += value;
      this.notifyUpdate();
    }
  }

  /**
   * 记录游戏开始
   */
  recordGameStart(): void {
    this.incrementStat('totalGamesPlayed');
  }

  /**
   * 记录金钱获得
   * @param amount 获得金额
   */
  recordMoneyEarned(amount: number): void {
    this.incrementStat('totalMoneyEarned', amount);
  }

  /**
   * 记录金钱花费
   * @param amount 花费金额
   */
  recordMoneySpent(amount: number): void {
    this.incrementStat('totalMoneySpent', amount);
  }

  /**
   * 记录伤害造成
   * @param amount 伤害值
   */
  recordDamage(amount: number): void {
    this.incrementStat('totalDamage', amount);
  }

  /**
   * 记录消耗品使用
   */
  recordConsumableUsed(): void {
    this.incrementStat('totalConsumablesUsed');
  }

  /**
   * 记录武器解锁
   */
  recordWeaponUnlocked(): void {
    this.incrementStat('totalWeaponsUnlocked');
  }

  /**
   * 记录升级购买
   */
  recordUpgradePurchased(): void {
    this.incrementStat('totalUpgradesPurchased');
  }

  /**
   * 记录成就解锁
   */
  recordAchievementUnlocked(): void {
    this.incrementStat('totalAchievements');
  }

  /**
   * 记录击杀
   * @param roachType 蟑螂类型
   */
  recordKill(roachType?: string): void {
    this.incrementStat('totalKills');
    
    if (roachType === 'queen') {
      this.incrementStat('queenKills');
    } else if (roachType === 'flying' || roachType === 'flying_suicide') {
      this.incrementStat('flyingKills');
    } else if (roachType === 'armored') {
      this.incrementStat('armoredKills');
    }
  }

  /**
   * 更新最高波次
   * @param wave 当前波次
   */
  updateHighestWave(wave: number): void {
    if (wave > this.stats.highestWave) {
      this.stats.highestWave = wave;
      this.notifyUpdate();
    }
  }

  /**
   * 更新最高无尽波次
   * @param wave 当前无尽波次
   */
  updateHighestEndlessWave(wave: number): void {
    if (wave > this.stats.highestEndlessWave) {
      this.stats.highestEndlessWave = wave;
      this.notifyUpdate();
    }
  }

  /**
   * 记录完美波次
   */
  recordPerfectWave(): void {
    this.incrementStat('perfectWaves');
  }

  /**
   * 记录防线突破
   */
  recordBreach(): void {
    this.incrementStat('breaches');
  }

  /**
   * 记录燃气罐使用
   */
  recordGasCanisterUsed(): void {
    this.incrementStat('gasCanistersUsed');
  }

  /**
   * 获取统计摘要
   * @returns 统计摘要
   */
  getStatsSummary(): {
    /** 游戏次数 */
    gamesPlayed: number;
    /** 总获得金钱 */
    moneyEarned: number;
    /** 总造成伤害 */
    damageDealt: number;
    /** 总击杀数 */
    kills: number;
    /** 最高波次 */
    highestWave: number;
    /** 完美波次比例 */
    perfectWaveRatio: number;
    /** 成就进度 */
    achievementProgress: number;
  } {
    const perfectWaveRatio = this.stats.totalGamesPlayed > 0 
      ? (this.stats.perfectWaves / this.stats.totalGamesPlayed) * 100 
      : 0;
    
    return {
      gamesPlayed: this.stats.totalGamesPlayed,
      moneyEarned: this.stats.totalMoneyEarned,
      damageDealt: this.stats.totalDamage,
      kills: this.stats.totalKills,
      highestWave: this.stats.highestWave,
      perfectWaveRatio: Math.round(perfectWaveRatio),
      achievementProgress: this.stats.totalAchievements,
    };
  }

  /**
   * 获取击杀统计
   * @returns 击杀统计
   */
  getKillStats(): {
    /** 总击杀数 */
    total: number;
    /** 女王击杀数 */
    queen: number;
    /** 飞行蟑螂击杀数 */
    flying: number;
    /** 装甲蟑螂击杀数 */
    armored: number;
    /** 其他击杀数 */
    other: number;
  } {
    const other = this.stats.totalKills - 
      this.stats.queenKills - 
      this.stats.flyingKills - 
      this.stats.armoredKills;
    
    return {
      total: this.stats.totalKills,
      queen: this.stats.queenKills,
      flying: this.stats.flyingKills,
      armored: this.stats.armoredKills,
      other: Math.max(0, other),
    };
  }

  /**
   * 获取经济统计
   * @returns 经济统计
   */
  getEconomyStats(): {
    /** 总获得金钱 */
    earned: number;
    /** 总花费金钱 */
    spent: number;
    /** 净收入 */
    netIncome: number;
    /** 平均每场游戏收入 */
    averagePerGame: number;
  } {
    const netIncome = this.stats.totalMoneyEarned - this.stats.totalMoneySpent;
    const averagePerGame = this.stats.totalGamesPlayed > 0 
      ? this.stats.totalMoneyEarned / this.stats.totalGamesPlayed 
      : 0;
    
    return {
      earned: this.stats.totalMoneyEarned,
      spent: this.stats.totalMoneySpent,
      netIncome: netIncome,
      averagePerGame: Math.round(averagePerGame),
    };
  }

  /**
   * 获取效率统计
   * @returns 效率统计
   */
  getEfficiencyStats(): {
    /** 伤害效率（每金钱造成的伤害） */
    damagePerMoney: number;
    /** 击杀效率（每金钱的击杀数） */
    killsPerMoney: number;
    /** 消耗品效率（每场游戏使用消耗品数） */
    consumablesPerGame: number;
  } {
    const damagePerMoney = this.stats.totalMoneyEarned > 0 
      ? this.stats.totalDamage / this.stats.totalMoneyEarned 
      : 0;
    
    const killsPerMoney = this.stats.totalMoneyEarned > 0 
      ? this.stats.totalKills / this.stats.totalMoneyEarned 
      : 0;
    
    const consumablesPerGame = this.stats.totalGamesPlayed > 0 
      ? this.stats.totalConsumablesUsed / this.stats.totalGamesPlayed 
      : 0;
    
    return {
      damagePerMoney: Math.round(damagePerMoney * 100) / 100,
      killsPerMoney: Math.round(killsPerMoney * 100) / 100,
      consumablesPerGame: Math.round(consumablesPerGame * 100) / 100,
    };
  }

  /**
   * 重置统计数据
   */
  reset(): void {
    this.stats = {
      totalGamesPlayed: 0,
      totalMoneyEarned: 0,
      totalDamage: 0,
      totalMoneySpent: 0,
      totalConsumablesUsed: 0,
      totalWeaponsUnlocked: 0,
      totalUpgradesPurchased: 0,
      totalAchievements: 0,
      totalKills: 0,
      highestWave: 0,
      highestEndlessWave: 0,
      perfectWaves: 0,
      breaches: 0,
      queenKills: 0,
      flyingKills: 0,
      armoredKills: 0,
      gasCanistersUsed: 0,
    };
    this.notifyUpdate();
  }

  /**
   * 导出统计数据
   * @returns 统计数据JSON字符串
   */
  exportStats(): string {
    return JSON.stringify(this.stats, null, 2);
  }

  /**
   * 导入统计数据
   * @param statsJson 统计数据JSON字符串
   * @returns 是否成功导入
   */
  importStats(statsJson: string): boolean {
    try {
      const importedStats = JSON.parse(statsJson);
      this.stats = { ...this.stats, ...importedStats };
      this.notifyUpdate();
      return true;
    } catch (error) {
      console.error('导入统计数据失败:', error);
      return false;
    }
  }

  /**
   * 获取统计趋势
   * @param statKey 统计键名
   * @param history 历史数据数组
   * @returns 趋势分析
   */
  getStatTrend<K extends keyof GameStats>(
    statKey: K,
    history: Array<{ timestamp: number; value: number }>
  ): {
    /** 当前值 */
    current: number;
    /** 变化率（百分比） */
    changeRate: number;
    /** 趋势方向（上升/下降/稳定） */
    trend: 'up' | 'down' | 'stable';
  } {
    const current = this.stats[statKey] as number;
    
    if (history.length < 2) {
      return {
        current,
        changeRate: 0,
        trend: 'stable',
      };
    }
    
    const previous = history[history.length - 2].value;
    const changeRate = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (changeRate > 5) trend = 'up';
    else if (changeRate < -5) trend = 'down';
    
    return {
      current,
      changeRate: Math.round(changeRate * 100) / 100,
      trend,
    };
  }

  /**
   * 通知更新
   */
  private notifyUpdate(): void {
    if (this.config.onStatsUpdate) {
      this.config.onStatsUpdate({ ...this.stats });
    }
  }
}
