/**
 * @fileoverview 游戏波次管理器
 * @description 负责管理游戏波次的生成、配置、倒计时、多阶段生成和进度跟踪
 */

import { SceneType, RoachType, GameMode, GameState } from '../../types';
import type { WaveConfig } from '../../types';
import { SCENE_WAVE_CONFIGS, SCENE_ROACH_TYPES } from '../../data';

// ===== 波次管理器配置接口 =====
export interface WaveManagerConfig {
  width: number;
  height: number;
  difficulty: string;
  gameMode: GameMode;
  currentScene: SceneType;
}

// ===== 波次管理器回调接口 =====
export interface WaveCallbacks {
  onSpawnRoach: (type: RoachType, clusterId?: number) => void;
  onAddFloatingText: (x: number, y: number, text: string, color: string) => void;
  onStateChange: (state: GameState) => void;
  onGameVictory: () => void;
  onSaveProgress: () => void;
  onUnlockNextScene: () => void;
  onPlayBGM: () => void;
  onTutorialPauseChange: (paused: boolean) => void;
  onKillRoach: (roach: any, index: number) => void;
  onGetRoaches: () => any[];
  onGetEconomy: () => any;
  onGetProgress: () => any;
  onGetTimedSuicideRemaining: () => number;
  onSetTimedSuicideRemaining: (count: number) => void;
  onSetTimedSuicideTimer: (timer: number) => void;
}

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
      return {
        wave: waveNumber,
        smallCount: 10, largeCount: 5, flyingCount: 3, armoredCount: 2,
        splittingCount: 1, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0,
        speed: 1.0, interval: 1.0, spawnInterval: 0.5, clusterChance: 0.3,
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
        const allNurses = roaches.every((r: any) => r.state === 'alive' && r.type === RoachType.NURSE);
        if (allNurses) {
          for (let i = roaches.length - 1; i >= 0; i--) {
            const nr = roaches[i];
            if (nr.type === RoachType.NURSE && nr.state === 'alive') {
              nr.hp = 0;
              this.cb.onKillRoach(nr, i);
            }
          }
          this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height * 0.35, '支援单位已清除，推进下一波!', '#fbbf24');
        }
      }
    }

    // 波次完成：自动开始下一波
    if (!this.tutorialPauseSpawn && !this.waveSpawning &&
        this.cb.onGetRoaches().length === 0 && this.spawnQueue.length === 0 && this.wave > 0) {
      this.waveTimer -= deltaTime;
      if (this.waveTimer <= 0) {
        this.waveTimer = 2;
        if (this.cfg.gameMode === GameMode.STORY) {
          const configs = SCENE_WAVE_CONFIGS[this.cfg.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
          if (this.wave >= configs.length) {
            this.cb.onUnlockNextScene();
            this.waveJustCleared = true;
            this.waveClearTimer = 6;
            this.waveSpawning = true;
            this.spawnQueue = [];
            this.waveTimer = 999;
            this.cb.onGameVictory();
            return { skipRest: true };
          }
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
        this.spawnTimer = 0.3 + Math.random() * 0.5;
      }
      if (this.spawnQueue.length === 0) this.waveSpawning = false;
    }

    return {};
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

    // 启动3-2-1倒计时
    if (this.startCountdown()) return;

    // 不需要倒计时，立即生成
    this.doWaveSpawn();
  }

  /** 启动3-2-1倒计时。返回 true 表示已启动倒计时 */
  startCountdown(): boolean {
    if (this.wave !== 1 || this.cfg.gameMode === GameMode.BOSS) return false;

    this.countdownPhase = 3;
    this.countdownTimer = 3.0;
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

    // 检查是否所有波次都已清除
    if (this.cfg.gameMode === GameMode.STORY) {
      const configs = SCENE_WAVE_CONFIGS[this.cfg.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
      const totalWaves = configs.length;
      if (this.wave > totalWaves) {
        const economy = this.cb.onGetEconomy();
        const progress = this.cb.onGetProgress();
        economy.highestWave = totalWaves;
        progress.highestWave = Math.max(progress.highestWave, totalWaves);
        this.cb.onUnlockNextScene();
        this.cb.onSaveProgress();
        this.waveJustCleared = true;
        this.waveClearTimer = 6;
        this.waveSpawning = true;
        this.spawnQueue = [];
        this.waveTimer = 999;
        this.cb.onGameVictory();
        return;
      }
    }

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

    // 三阶段生成
    const phase1: typeof this.spawnQueue = [];
    const phase2: typeof this.spawnQueue = [];
    const phase3: typeof this.spawnQueue = [];

    const p1Small = Math.floor(config.smallCount * 0.3);
    const p1Large = Math.floor(config.largeCount * 0.3);
    addToQueue(phase1, RoachType.SMALL, p1Small);
    addToQueue(phase1, RoachType.LARGE, p1Large);
    shuffle(phase1);

    const p2Small = Math.floor(config.smallCount * 0.5);
    const p2Large = Math.floor(config.largeCount * 0.5);
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

  /** 移除已生成的蟑螂 */
  removeSpawned(): void {
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
   * @param ctx Canvas 渲染上下文
   * @param eggPods 虫卵数组
   * @param eggPodImg 虫卵图片
   * @param time 游戏时间
   * @param disinfectionRewardAlpha 消毒奖励透明度（0~1）
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
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

    const img = eggPodImg;
    const basePodW = 72;
    const basePodH = 96;
    const yMin = 361;
    const yMax = 612;

    for (const pod of eggPods) {
      if (pod.state !== 'intact') continue;

      const hpRatio = pod.hp / pod.maxHp;
      const countdownRatio = pod.hatchTimer / 5;

      const yRatio = Math.max(0, Math.min(1, (pod.y - yMin) / (yMax - yMin)));
      const perspScale = 0.5 + yRatio * 0.5;
      const podW = basePodW * perspScale;
      const podH = basePodH * perspScale;

      ctx.save();
      ctx.translate(pod.x, pod.y);

      ctx.globalAlpha = 0.8;
      if (img) {
        ctx.drawImage(img, -podW / 2, -podH / 2, podW, podH);
      } else {
        ctx.fillStyle = '#5a7a5a';
        ctx.beginPath();
        ctx.ellipse(0, 0, podW / 2, podH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const barW = 60 * perspScale;
      const barH = 6 * perspScale;
      const barY = -podH / 2 - 10 * perspScale;
      ctx.fillStyle = '#333';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : (hpRatio > 0.25 ? '#f59e0b' : '#ef4444');
      ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

      const secondsLeft = Math.ceil(pod.hatchTimer);
      ctx.fillStyle = countdownRatio > 0.3 ? '#fbbf24' : '#ef4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${secondsLeft}s`, 0, barY - 10);
      ctx.shadowBlur = 0;

      if (pod.hatchTimer <= 3) {
        const pulse = Math.sin(time * 6) * 0.3 + 0.5;
        ctx.strokeStyle = `rgba(255, 150, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -time * 10;
        ctx.beginPath();
        ctx.ellipse(0, 0, podW / 2 + 8 * perspScale, podH / 2 + 8 * perspScale, 0, 0, Math.PI * 2);
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