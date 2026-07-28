/**
 * @fileoverview 游戏波次管理器
 * @description 负责管理游戏波次的生成、配置、倒计时、多阶段生成和进度跟踪
 */

import { SceneType, RoachType, GameMode, GameState } from '../../types';
import type { WaveConfig } from '../../types';
import { SCENE_WAVE_CONFIGS, SCENE_ROACH_TYPES, BALANCE_CONFIG, TEXT_CONFIG, FLOAT_COLOR, RENDER_COLOR, RENDER_FONT } from '../../data';

// ===== 波次管理器配置接口 =====
export interface WaveManagerConfig {
  width: number;
  height: number;
  difficulty: string;
  gameMode: GameMode;
  currentScene: SceneType;
}

// ===== 波次管理器回调接口（按职责分组） =====

/** 核心玩法回调 */
export interface WaveGameplayCallbacks {
  onSpawnRoach: (type: RoachType, clusterId?: number) => void;
  onAddFloatingText: (x: number, y: number, text: string, color: string) => void;
  onStateChange: (state: GameState) => void;
  onGameVictory: () => void;
  onSaveProgress: () => void;
  onUnlockNextScene: () => void;
  onPlayBGM: () => void;
  onTutorialPauseChange: (paused: boolean) => void;
}

/** 蟑螂数据访问回调 */
export interface WaveRoachCallbacks {
  onKillRoach: (roach: any, index: number) => void;
  onGetRoaches: () => any[];
  /** 医院专属：杀死所有护士蟑螂（通过回调避免直接修改HP） */
  onKillAllNurseRoaches?: () => void;
}

/** 经济/进度数据访问回调 */
export interface WaveDataCallbacks {
  onGetEconomy: () => any;
  onGetProgress: () => any;
}

/** 定时自爆蟑螂回调 */
export interface WaveTimedSuicideCallbacks {
  onGetTimedSuicideRemaining: () => number;
  onSetTimedSuicideRemaining: (count: number) => void;
  onSetTimedSuicideTimer: (timer: number) => void;
}

/** 波次管理器完整回调接口 */
export interface WaveCallbacks
  extends WaveGameplayCallbacks, WaveRoachCallbacks, WaveDataCallbacks, WaveTimedSuicideCallbacks {}

/**
 * 波次管理器类
 */
export class WaveManager {
  private cfg: WaveManagerConfig;
  private cb: WaveCallbacks;

  /** 当前波次 */
  wave: number = 0;
  /** 波次计时器（波次间间隔） */
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

  constructor(config: WaveManagerConfig, callbacks: WaveCallbacks) {
    this.cfg = config;
    this.cb = callbacks;
  }

  /** 更新配置 */
  updateConfig(config: Partial<WaveManagerConfig>): void {
    Object.assign(this.cfg, config);
  }

  /** 重置波次管理器 */
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

  /** 获取波次配置 */
  getWaveConfig(waveNumber: number): WaveConfig {
    const configs = SCENE_WAVE_CONFIGS[this.cfg.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
    const config = configs[waveNumber - 1];
    if (!config) {
      const def = BALANCE_CONFIG.wave.defaultConfig;
      return {
        wave: waveNumber,
        smallCount: def.smallCount, largeCount: def.largeCount,
        flyingCount: def.flyingCount, armoredCount: def.armoredCount,
        splittingCount: def.splittingCount, suicideCount: def.suicideCount,
        flyingSuicideCount: def.flyingSuicideCount, queenCount: def.queenCount,
        speed: def.speed, interval: def.interval,
        spawnInterval: def.spawnInterval, clusterChance: def.clusterChance,
        name: `波次 ${waveNumber}`,
      };
    }
    return config;
  }

  /** 获取总波次数 */
  getTotalWaves(): number {
    if (this.cfg.gameMode === GameMode.STORY) {
      const configs = SCENE_WAVE_CONFIGS[this.cfg.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
      return configs.length;
    }
    return 0;
  }

  // ========== 主更新循环 ==========

  /** 更新波次逻辑（每帧调用） */
  update(deltaTime: number): { skipRest?: boolean } {
    // 波次清除后等待
    if (this.waveJustCleared) {
      this.waveClearTimer -= deltaTime;
      if (this.waveClearTimer <= 0) this.waveJustCleared = false;
      return { skipRest: true };
    }

    // ===== HOSPITAL EXCLUSIVE: Auto-skip wave if only nurse roaches remain =====
    if (this.cfg.currentScene === SceneType.HOSPITAL && !this.waveSpawning &&
        this.spawnQueue.length === 0 && this.wave > 0) {
      const roaches = this.cb.onGetRoaches();
      if (roaches.length > 0) {
        // 使用 filter 代替 every 避免空数组真空真值问题
        const nurses = roaches.filter((r: any) =>
          r.state === 'alive' && r.type === RoachType.NURSE
        );
        const allNurses = nurses.length === roaches.length;
        if (allNurses) {
          // 通过回调统一处理，避免直接修改蟑螂HP
          this.cb.onKillAllNurseRoaches?.();
          this.cb.onAddFloatingText(
            this.cfg.width / 2, this.cfg.height * 0.35,
            TEXT_CONFIG.combat.waveCleared, FLOAT_COLOR.gold
          );
        }
      }
    }

    // 波次完成：检查胜利或自动开始下一波
    if (!this.tutorialPauseSpawn && !this.waveSpawning &&
        this.cb.onGetRoaches().length === 0 && this.spawnQueue.length === 0 && this.wave > 0) {
      this.waveTimer -= deltaTime;
      if (this.waveTimer <= 0) {
        this.waveTimer = BALANCE_CONFIG.wave.clearDelay;
        if (this.checkVictory()) {
          return { skipRest: true };
        }
        this.startWave();
      }
    }

    // 生成队列处理
    if (this.waveSpawning) {
      this.spawnTimer -= deltaTime;
      if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
        const spawn = this.spawnQueue.shift()!;
        this.cb.onSpawnRoach(spawn.type, spawn.clusterId);
        // 使用波次配置的生成间隔
        const config = this.getWaveConfig(this.wave);
        const wCfg = BALANCE_CONFIG.wave;
        const interval = config.spawnInterval ?? BALANCE_CONFIG.wave.defaultConfig.spawnInterval;
        this.spawnTimer = interval
          * (wCfg.spawnTimerMin + Math.random() * (wCfg.spawnTimerMax - wCfg.spawnTimerMin));
      }
      if (this.spawnQueue.length === 0) this.waveSpawning = false;
    }

    return {};
  }

  // ========== 胜利判断（统一入口，消除重复逻辑） ==========

  /** 检查是否已通关所有波次。返回 true 表示已触发胜利 */
  private checkVictory(): boolean {
    if (this.cfg.gameMode !== GameMode.STORY) return false;

    const configs = SCENE_WAVE_CONFIGS[this.cfg.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
    if (this.wave < configs.length) return false;

    // 通关：更新进度、解锁下一场景、触发胜利
    const economy = this.cb.onGetEconomy();
    const progress = this.cb.onGetProgress();
    economy.highestWave = configs.length;
    progress.highestWave = Math.max(progress.highestWave, configs.length);
    this.cb.onUnlockNextScene();
    this.cb.onSaveProgress();
    this.waveJustCleared = true;
    this.waveClearTimer = BALANCE_CONFIG.wave.clearTimer;
    this.waveSpawning = true;
    this.spawnQueue = [];
    this.waveTimer = 999;
    this.cb.onGameVictory();
    return true;
  }

  // ========== 波次启动 ==========

  /** 启动新波次（显示倒计时或直接生成） */
  startWave(): void {
    this.wave++;

    // 厨房第一波教程暂停
    if (this.cfg.currentScene === SceneType.KITCHEN && this.wave === 1 && this.cfg.gameMode === GameMode.STORY) {
      const tutorialSeen = (() => {
        try { return !!localStorage.getItem('gameplay_tutorial_seen'); } catch { return false; }
      })();
      if (!tutorialSeen) {
        this.tutorialPauseSpawn = true;
        this.cb.onTutorialPauseChange(true);
        return;
      }
    }

    // 启动3-2-1倒计时（仅第一波，Boss模式除外）
    if (this.startCountdown()) return;

    // 不需要倒计时，立即生成
    this.doWaveSpawn();
  }

  /** 启动3-2-1倒计时。返回 true 表示已启动倒计时 */
  startCountdown(): boolean {
    // Boss模式跳过倒计时；仅第一波显示倒计时，后续波次直接开始
    if (this.cfg.gameMode === GameMode.BOSS) return false;
    if (this.wave > 1) return false;

    const waveCfg = BALANCE_CONFIG.wave;
    this.countdownPhase = waveCfg.countdownPhases;
    this.countdownTimer = waveCfg.countdownDuration;
    this.countdownWavePending = true;
    this.cb.onStateChange(GameState.COUNTDOWN);
    this.cb.onPlayBGM();
    return true;
  }

  /** 执行波次生成 */
  doWaveSpawn(): void {
    this.cb.onStateChange(GameState.PLAYING);
    this.countdownWavePending = false;

    // Boss 模式跳过倒计时，在此处启动关卡 BGM
    if (this.wave === 1 && this.cfg.gameMode === GameMode.BOSS) {
      this.cb.onPlayBGM();
    }

    // 注：checkVictory() 已在 update() 中（所有敌人死亡后）调用，
    // 此处不应重复调用，否则最后一波（wave === configs.length）会
    // 在生成敌人之前就触发胜利
    const config = this.getWaveConfig(this.wave);
    let clusterId = 1;

    const allTypes = [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN];
    const availableTypes = this.cfg.gameMode === GameMode.STORY
      ? (this.cfg.difficulty === 'hard' ? allTypes : (SCENE_ROACH_TYPES[this.cfg.currentScene] || [RoachType.SMALL]))
      : allTypes;

    const addToQueue = (queue: { type: RoachType; clusterId?: number }[], type: RoachType, count: number) => {
      if (!availableTypes.includes(type)) return;
      for (let i = 0; i < count; i++) {
        queue.push({ type, clusterId: Math.random() < config.clusterChance ? clusterId : undefined });
        if (Math.random() < config.clusterChance) clusterId++;
      }
    };
    const shuffle = (queue: { type: RoachType; clusterId?: number }[]) => {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    };

    // 三阶段生成（使用配置的比例）
    const wCfg = BALANCE_CONFIG.wave;
    const phase1: typeof this.spawnQueue = [];
    const phase2: typeof this.spawnQueue = [];
    const phase3: typeof this.spawnQueue = [];

    const p1Small = Math.floor(config.smallCount * wCfg.phase1Ratio);
    const p1Large = Math.floor(config.largeCount * wCfg.phase1Ratio);
    addToQueue(phase1, RoachType.SMALL, p1Small);
    addToQueue(phase1, RoachType.LARGE, p1Large);
    shuffle(phase1);

    const p2Small = Math.floor(config.smallCount * wCfg.phase2Ratio);
    const p2Large = Math.floor(config.largeCount * wCfg.phase2Ratio);
    addToQueue(phase2, RoachType.SMALL, p2Small);
    addToQueue(phase2, RoachType.LARGE, p2Large);
    addToQueue(phase2, RoachType.FLYING, config.flyingCount);
    addToQueue(phase2, RoachType.ARMORED, config.armoredCount);
    addToQueue(phase2, RoachType.SPLITTING, config.splittingCount);
    addToQueue(phase2, RoachType.SUICIDE, config.suicideCount);
    addToQueue(phase2, RoachType.FLYING_SUICIDE, config.flyingSuicideCount);
    addToQueue(phase2, RoachType.QUEEN, config.queenCount);
    shuffle(phase2);

    const p3Small = config.smallCount - p1Small - p2Small;
    const p3Large = config.largeCount - p1Large - p2Large;
    addToQueue(phase3, RoachType.SMALL, Math.max(0, p3Small));
    addToQueue(phase3, RoachType.LARGE, Math.max(0, p3Large));
    shuffle(phase3);

    // 医院特殊单位
    if (this.cfg.currentScene === SceneType.HOSPITAL) {
      const { nurseCount = 0, mutantCount = 0, timedSuicideCount = 0 } = config;
      addToQueue(phase1, RoachType.NURSE, nurseCount);
      shuffle(phase1);
      addToQueue(phase2, RoachType.MUTANT, mutantCount);
      this.cb.onSetTimedSuicideRemaining(timedSuicideCount);
      this.cb.onSetTimedSuicideTimer(timedSuicideCount > 0 ? 5.0 : 0);
    }

    this.spawnQueue = [...phase1, ...phase2, ...phase3];
    this.waveSpawning = true;
    this.spawnTimer = 0;
  }

  // ========== 辅助方法 ==========

  /** 获取下一个要生成的蟑螂 */
  getNextSpawn(): { type: RoachType; clusterId?: number } | null {
    if (!this.waveSpawning || this.spawnQueue.length === 0) return null;
    return this.spawnQueue[0];
  }

  /** 完成当前生成项（仅移除队列头部，不修改 waveSpawning） */
  consumeSpawned(): void {
    if (this.spawnQueue.length > 0) this.spawnQueue.shift();
    if (this.spawnQueue.length === 0) this.waveSpawning = false;
  }

  /** 检查波次是否完成 */
  isWaveComplete(): boolean {
    return !this.waveSpawning && this.spawnQueue.length === 0;
  }

  /** 检查是否需要显示商店 */
  shouldShowShop(): boolean {
    if (this.cfg.gameMode === GameMode.STORY) {
      return this.wave > this.getTotalWaves();
    }
    return false;
  }

  /** 获取当前波次名称 */
  getWaveName(): string {
    return this.getWaveConfig(this.wave).name || `波次 ${this.wave}`;
  }

  /**
   * 渲染医院虫卵（静态方法）
   */
  static renderHospitalEggPods(
    ctx: CanvasRenderingContext2D,
    eggPods: { state: string; x: number; y: number; hp: number; maxHp: number; hatchTimer: number }[],
    eggPodImg: HTMLImageElement | null,
    time: number,
    disinfectionRewardAlpha: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!eggPods.length) return;

    const ec = BALANCE_CONFIG.wave.eggPod;
    const img = eggPodImg;

    for (const pod of eggPods) {
      if (pod.state !== 'intact') continue;

      const hpRatio = pod.hp / pod.maxHp;
      const countdownRatio = pod.hatchTimer / ec.hatchTime;

      const yRatio = Math.max(0, Math.min(1, (pod.y - ec.yMin) / (ec.yMax - ec.yMin)));
      const perspScale = 0.5 + yRatio * 0.5;
      const podW = ec.baseW * perspScale;
      const podH = ec.baseH * perspScale;

      ctx.save();
      ctx.translate(pod.x, pod.y);

      ctx.globalAlpha = 0.8;
      if (img) {
        ctx.drawImage(img, -podW / 2, -podH / 2, podW, podH);
      } else {
        ctx.fillStyle = RENDER_COLOR.eggPodGreen;
        ctx.beginPath();
        ctx.ellipse(0, 0, podW / 2, podH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const barW = ec.barW * perspScale;
      const barH = ec.barH * perspScale;
      const barY = -podH / 2 - ec.barOffsetY * perspScale;
      ctx.fillStyle = '#333';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? RENDER_COLOR.hpHigh : (hpRatio > 0.25 ? RENDER_COLOR.armorEnd : RENDER_COLOR.hpLow);
      ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

      const secondsLeft = Math.ceil(pod.hatchTimer);
      ctx.fillStyle = countdownRatio > 0.3 ? RENDER_COLOR.armorStart : RENDER_COLOR.hpLow;
      ctx.font = RENDER_FONT.large;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${secondsLeft}s`, 0, barY - 10);
      ctx.shadowBlur = 0;

      if (pod.hatchTimer <= 3) {
        const pulse = Math.sin(time * ec.pulseFreq) * 0.3 + 0.5;
        ctx.strokeStyle = `rgba(255, 150, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -time * 10;
        ctx.beginPath();
        ctx.ellipse(0, 0, podW / 2 + ec.pulseRadius * perspScale, podH / 2 + ec.pulseRadius * perspScale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    if (disinfectionRewardAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(34, 213, 94, ${disinfectionRewardAlpha * 0.3})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    }
  }
}