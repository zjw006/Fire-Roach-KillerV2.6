/**
 * @fileoverview 游戏波次管理器
 * @description 负责管理游戏波次的生成、配置和进度跟踪
 */

import { SceneType, RoachType, GameMode } from '../../types';
import type { WaveConfig, GameProgress } from '../../types';
import { SCENE_WAVE_CONFIGS, SCENE_ROACH_TYPES, SCENE_CONFIGS } from '../../data';

/**
 * 波次管理器类
 * @description 管理游戏波次的生成、配置和进度跟踪
 */
export class WaveManager {
  private currentScene: SceneType;
  private gameMode: GameMode;
  private difficulty: string;
  
  /** 当前波次 */
  wave: number = 0;
  /** 波次计时器 */
  waveTimer: number = 0;
  /** 是否正在生成波次 */
  waveSpawning: boolean = false;
  /** 波次生成队列 */
  spawnQueue: { type: RoachType; clusterId?: number }[] = [];
  /** 生成计时器 */
  spawnTimer: number = 0;
  /** 波次刚刚清除标志 */
  waveJustCleared: boolean = false;
  /** 波次清除计时器 */
  waveClearTimer: number = 0;
  
  /** 教程暂停生成标志 */
  tutorialPauseSpawn: boolean = false;
  /** 倒计时阶段 */
  countdownPhase: number = 0;
  /** 倒计时计时器 */
  countdownTimer: number = 0;
  /** 倒计时波次待处理标志 */
  countdownWavePending: boolean = false;

  /**
   * 构造函数
   * @param {SceneType} currentScene - 当前场景
   * @param {GameMode} gameMode - 游戏模式
   * @param {string} difficulty - 游戏难度
   */
  constructor(
    currentScene: SceneType,
    gameMode: GameMode,
    difficulty: string = 'normal'
  ) {
    this.currentScene = currentScene;
    this.gameMode = gameMode;
    this.difficulty = difficulty;
  }

  /**
   * 启动新波次
   * @returns {boolean} 是否成功启动波次
   */
  startWave(): boolean {
    this.wave++;

    // 厨房第一波教程暂停
    if (this.currentScene === SceneType.KITCHEN && this.wave === 1 && this.gameMode === GameMode.STORY) {
      const tutorialSeen = (() => {
        try { return !!localStorage.getItem('gameplay_tutorial_seen'); } catch { return false; }
      })();
      if (!tutorialSeen) {
        this.tutorialPauseSpawn = true;
        return false; // 退出，不生成任何东西
      }
    }

    // 启动3-2-1倒计时
    if (this.startCountdown()) return true;

    // 不需要倒计时，立即生成
    this.doWaveSpawn();
    return true;
  }

  /**
   * 启动3-2-1倒计时
   * @returns {boolean} 是否启动了倒计时
   */
  startCountdown(): boolean {
    // 只在每个关卡的第一波触发倒计时（不在波次之间）
    // BOSS模式有自己的计时
    if (this.wave !== 1 || this.gameMode === GameMode.BOSS) return false;

    this.countdownPhase = 3;
    this.countdownTimer = 3.0; // 总共3秒：3, 2, 1
    this.countdownWavePending = true;
    return true;
  }

  /**
   * 执行波次生成
   */
  doWaveSpawn(): void {
    this.countdownWavePending = false;

    // 检查是否所有波次都已清除
    if (this.gameMode === GameMode.STORY) {
      const configs = SCENE_WAVE_CONFIGS[this.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
      const totalWaves = configs.length;
      if (this.wave > totalWaves) {
        // 所有波次都已清除！胜利！
        this.waveJustCleared = true;
        this.waveClearTimer = 6;
        this.waveSpawning = true;
        this.spawnQueue = [];
        this.waveTimer = 999;
        return;
      }
    }

    const config = this.getWaveConfig(this.wave);
    let clusterId = 1;

    // 获取当前场景可用的蟑螂类型
    const allTypes = [
      RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, 
      RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, 
      RoachType.FLYING_SUICIDE, RoachType.QUEEN
    ];
    
    const availableTypes = this.gameMode === GameMode.STORY
      ? (this.difficulty === 'hard' ? allTypes : (SCENE_ROACH_TYPES[this.currentScene] || [RoachType.SMALL]))
      : allTypes;

    // 辅助函数：添加蟑螂到队列
    const addToQueue = (queue: { type: RoachType; clusterId?: number }[], type: RoachType, count: number) => {
      if (!availableTypes.includes(type)) return;
      for (let i = 0; i < count; i++) {
        queue.push({ 
          type, 
          clusterId: Math.random() < config.clusterChance ? clusterId : undefined 
        });
        if (Math.random() < config.clusterChance) clusterId++;
      }
    };

    // 辅助函数：随机打乱队列
    const shuffle = (queue: { type: RoachType; clusterId?: number }[]) => {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    };

    // 根据配置生成波次
    const queue: { type: RoachType; clusterId?: number }[] = [];
    
    // 添加小型蟑螂
    addToQueue(queue, RoachType.SMALL, config.smallCount);
    
    // 添加大型蟑螂
    addToQueue(queue, RoachType.LARGE, config.largeCount);
    
    // 添加飞行蟑螂
    addToQueue(queue, RoachType.FLYING, config.flyingCount);
    
    // 添加装甲蟑螂
    addToQueue(queue, RoachType.ARMORED, config.armoredCount);
    
    // 添加分裂蟑螂
    addToQueue(queue, RoachType.SPLITTING, config.splittingCount);
    
    // 添加自爆蟑螂
    addToQueue(queue, RoachType.SUICIDE, config.suicideCount);
    
    // 添加飞行自爆蟑螂
    addToQueue(queue, RoachType.FLYING_SUICIDE, config.flyingSuicideCount);
    
    // 添加女王蟑螂
    addToQueue(queue, RoachType.QUEEN, config.queenCount);

    // 随机打乱队列
    shuffle(queue);

    // 设置波次状态
    this.spawnQueue = queue;
    this.waveSpawning = true;
    this.spawnTimer = config.spawnInterval ?? 1.0;
  }

  /**
   * 获取波次配置
   * @param {number} waveNumber - 波次编号
   * @returns {WaveConfig} 波次配置
   */
  getWaveConfig(waveNumber: number): WaveConfig {
    const configs = SCENE_WAVE_CONFIGS[this.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
    const config = configs[waveNumber - 1];
    
    if (!config) {
      // 返回默认配置
      return {
        wave: waveNumber,
        smallCount: 10,
        largeCount: 5,
        flyingCount: 3,
        armoredCount: 2,
        splittingCount: 1,
        suicideCount: 1,
        flyingSuicideCount: 0,
        queenCount: 0,
        speed: 1.0,
        interval: 1.0,
        spawnInterval: 0.5,
        clusterChance: 0.3,
        name: `波次 ${waveNumber}`
      };
    }
    
    return config;
  }

  /**
   * 获取总波次数
   * @returns {number} 总波次数
   */
  getTotalWaves(): number {
    if (this.gameMode === GameMode.STORY) {
      const configs = SCENE_WAVE_CONFIGS[this.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
      return configs.length;
    }
    
    // 无尽模式没有固定波次数
    return 0;
  }

  /**
   * 检查波次是否完成
   * @returns {boolean} 波次是否完成
   */
  isWaveComplete(): boolean {
    return !this.waveSpawning && this.spawnQueue.length === 0;
  }

  /**
   * 重置波次管理器
   */
  reset(): void {
    this.wave = 0;
    this.waveTimer = 0;
    this.waveSpawning = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveJustCleared = false;
    this.waveClearTimer = 0;
    this.tutorialPauseSpawn = false;
    this.countdownPhase = 0;
    this.countdownTimer = 0;
    this.countdownWavePending = false;
  }

  /**
   * 更新波次计时器
   * @param {number} deltaTime - 时间增量
   */
  update(deltaTime: number): void {
    // 更新倒计时
    if (this.countdownTimer > 0) {
      this.countdownTimer -= deltaTime;
      if (this.countdownTimer <= 0) {
        this.countdownPhase--;
        if (this.countdownPhase > 0) {
          this.countdownTimer = 1.0; // 每个数字1秒
        } else {
          // 倒计时结束，生成波次
          this.doWaveSpawn();
        }
      }
    }

    // 更新波次清除计时器
    if (this.waveClearTimer > 0) {
      this.waveClearTimer -= deltaTime;
      if (this.waveClearTimer <= 0) {
        this.waveJustCleared = false;
      }
    }

    // 更新生成计时器
    if (this.waveSpawning && this.spawnQueue.length > 0) {
      this.spawnTimer -= deltaTime;
      if (this.spawnTimer <= 0) {
        // 重置生成计时器
        const config = this.getWaveConfig(this.wave);
        this.spawnTimer = config.spawnInterval ?? 1.0;
      }
    }
  }

  /**
   * 获取下一个要生成的蟑螂
   * @returns {{ type: RoachType; clusterId?: number } | null} 下一个蟑螂信息
   */
  getNextSpawn(): { type: RoachType; clusterId?: number } | null {
    if (!this.waveSpawning || this.spawnQueue.length === 0) {
      return null;
    }
    
    return this.spawnQueue[0];
  }

  /**
   * 移除已生成的蟑螂
   */
  removeSpawned(): void {
    if (this.spawnQueue.length > 0) {
      this.spawnQueue.shift();
    }
    
    // 如果队列为空，标记波次生成完成
    if (this.spawnQueue.length === 0) {
      this.waveSpawning = false;
    }
  }

  /**
   * 检查是否需要显示商店
   * @returns {boolean} 是否需要显示商店
   */
  shouldShowShop(): boolean {
    // 在故事模式中，所有波次完成后显示商店
    if (this.gameMode === GameMode.STORY) {
      const totalWaves = this.getTotalWaves();
      return this.wave > totalWaves;
    }
    
    // 其他模式不显示商店
    return false;
  }

  /**
   * 获取当前波次名称
   * @returns {string} 波次名称
   */
  getWaveName(): string {
    const config = this.getWaveConfig(this.wave);
    return config.name || `波次 ${this.wave}`;
  }

  /**
   * 计算波次清除后的天赋点奖励
   * @param {SceneType} currentScene - 当前场景
   * @returns {number} 天赋点奖励数量
   */
  calculateTalentReward(currentScene: SceneType): number {
    const sceneConfig = SCENE_CONFIGS[currentScene];
    const talentReward = Math.floor(100 * (sceneConfig?.rewardMultiplier || 1));
    return talentReward;
  }

  /**
   * 添加天赋点到游戏进度
   * @param {GameProgress} progress - 游戏进度
   * @param {number} points - 要添加的天赋点数量
   */
  addTalentPoints(progress: GameProgress, points: number): void {
    progress.talentTree.points += points;
  }

  /**
   * 检查是否为完美波次（没有防线被突破）
   * @param {number} breaches - 防线被突破次数
   * @returns {boolean} 是否为完美波次
   */
  isPerfectWave(breaches: number): boolean {
    return breaches === 0;
  }

  /**
   * 记录完美波次
   * @param {Function} onPerfectWave - 完美波次回调函数
   */
  recordPerfectWave(onPerfectWave?: () => void): void {
    if (onPerfectWave) {
      onPerfectWave();
    }
  }
}