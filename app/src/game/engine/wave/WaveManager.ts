/**
 * @fileoverview 游戏波次管理器
 * @description 负责管理游戏波次的生成、配置、倒计时、多阶段生成和进度跟踪
 */

import { SceneType, RoachType, GameMode, GameState } from '../../types';
import type { FormationGroupConfig, TrickleConfig, WaveConfig } from '../../types';
import { SCENE_WAVE_CONFIGS, SCENE_ROACH_TYPES, SCENE_GROUND_BOUNDS, BALANCE_CONFIG, TEXT_CONFIG, RENDER_COLOR, RENDER_FONT } from '../../data';

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
  onSpawnRoach: (type: RoachType, clusterId?: number, x?: number, y?: number) => void;
  onAddFloatingText: (x: number, y: number, text: string, color: string) => void;
  onStateChange: (state: GameState) => void;
  onGameVictory: () => void;
  onSaveProgress: () => void;
  onUnlockNextScene: () => void;
  onPlayBGM: () => void;
  onTutorialPauseChange: (paused: boolean) => void;
  /** 地铁精英登场教学对话暂停回调（第1波首次触发） */
  onEliteTutorialPauseChange?: (paused: boolean) => void;
  /** 地铁斩螂·110 教学对话暂停回调（第4波护盾蟑螂登场前首次触发） */
  onKnifeTutorialPauseChange?: (paused: boolean) => void;
  /** 波次生成回调（doWaveSpawn 时触发）：用于列车时刻表等按波计时系统 */
  onWaveStart?: (wave: number) => void;
  /** 波次清空回调（所有敌人死亡且队列空时触发一次）：用于取消该波剩余列车调度 */
  onWaveCleared?: () => void;
  /** 超市 V4.0：波次开始时清空残余阵型实例（多组错时共存，各组独立锚点/独立破阵） */
  onClearFormations?: () => void;
  /** 超市 V4.0：生成一组阵型（出生点即阵型槽位，整组同帧生成；groupIndex 用于多组纵深错位） */
  onSpawnFormationGroup?: (group: FormationGroupConfig, groupIndex: number) => void;
  /** 获取指定 Y 处地面透视边界 [L, R]（超市穿插/阵型在阻挡面内随机定位用） */
  onGetGroundBoundsAtY?: (y: number) => [number, number];
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
  /** 波次生成队列（x/y 存在时按指定坐标出生） */
  spawnQueue: { type: RoachType; clusterId?: number; x?: number; y?: number }[] = [];
  /** 生成计时器 */
  spawnTimer: number = 0;
  /** 超市 V4.0：待生成阵型组（热场杂兵队列清空且场上基本清完时首组出场，后续组按 groupStaggerSec 错时生成；容量不足顺延重试） */
  private pendingFormations: FormationGroupConfig[] = [];
  /** 超市 V4.0：热场队列清空后的等待计时（配合 formationWaitClear/formationWaitTimeout 判定阵型组出场） */
  private formationIdleTimer: number = 0;
  /** 超市 V4.0：相邻阵型组错时生成间隔计时（秒） */
  private formationGroupTimer: number = 0;
  /** 超市 V4.0：本波首组阵型是否已出场 */
  private formationWaveStarted: boolean = false;
  /** 超市 V4.0：已出场阵型组序号（用于出生线纵深错位） */
  private formationGroupIndex: number = 0;
  /** 超市 V4.0：穿插投放状态（阵列生成后激活，推进全程持续投放自由杂兵/自爆偷袭单位；suicideBlockTimer 累计自爆类投放等待时间） */
  private trickleState: { cfg: TrickleConfig; active: boolean; intervalTimer: number; spawned: number; typeCursor: number; suicideSeq: number; suicideBlockTimer: number } | null = null;
  /** 波次刚刚清除标志 */
  waveJustCleared: boolean = false;
  /** 波次清除计时器 */
  waveClearTimer: number = 0;
  /** 教程暂停生成标志 */
  tutorialPauseSpawn: boolean = false;
  /** 地铁精英教学暂停生成标志（第1波精英登场对话） */
	  eliteTutorialPause: boolean = false;
	  /** 地铁斩螂·110 教学暂停生成标志（第4波护盾蟑螂登场前对话） */
	  knifeTutorialPause: boolean = false;
  /** 波次清空通知标志（防止等待期间重复通知 onWaveCleared） */
  private waveClearNotified: boolean = false;
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
    this.eliteTutorialPause = false;
    this.knifeTutorialPause = false;
    this.waveClearNotified = false;
    this.countdownPhase = 0;
    this.countdownTimer = 0;
    this.countdownWavePending = false;
    this.pendingFormations = [];
    this.formationIdleTimer = 0;
    this.formationGroupTimer = 0;
    this.formationWaveStarted = false;
    this.formationGroupIndex = 0;
    this.trickleState = null;
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
            TEXT_CONFIG.combat.waveCleared.text, TEXT_CONFIG.combat.waveCleared.color
          );
        }
      }
    }

    // 波次完成：检查胜利或自动开始下一波（超市 V4.0：须等待波内调度事件全部触发——延迟阵型组/穿插投放）
    if (!this.tutorialPauseSpawn && !this.eliteTutorialPause && !this.knifeTutorialPause && !this.waveSpawning &&
        this.cb.onGetRoaches().length === 0 && this.spawnQueue.length === 0 && !this.hasPendingWaveEvents() && this.wave > 0) {
      // 波次清空瞬间：通知取消该波剩余的按波调度事件（如列车时刻表）
      if (!this.waveClearNotified) {
        this.waveClearNotified = true;
        this.cb.onWaveCleared?.();
      }
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
        this.cb.onSpawnRoach(spawn.type, spawn.clusterId, spawn.x, spawn.y);
        // 使用波次配置的生成间隔
        const config = this.getWaveConfig(this.wave);
        const wCfg = BALANCE_CONFIG.wave;
        const interval = config.spawnInterval ?? BALANCE_CONFIG.wave.defaultConfig.spawnInterval;
        this.spawnTimer = interval
          * (wCfg.spawnTimerMin + Math.random() * (wCfg.spawnTimerMax - wCfg.spawnTimerMin));
      }
      if (this.spawnQueue.length === 0) this.waveSpawning = false;
    }

    // ===== 超市 V4.0 波内调度：杂兵热场 → 阵型组整组生成 → 推进全程持续穿插（教学暂停期间冻结计时） =====
    if (!this.tutorialPauseSpawn && !this.eliteTutorialPause && !this.knifeTutorialPause) {
      // 阵型组：热场杂兵队列清空且场上基本清完（存活 ≤ formationWaitClear）时首组出场，后续组按 groupStaggerSec
      // 错时生成（V4.0：各组错时、独立锚点、独立破阵判定；出生点即槽位，多组按 groupIndex 纵深错位）；
      // 队列清空后等待超时强制出场兜底；接近硬上限 40 则顺延下帧重试，防静默丢弃
      if (this.pendingFormations.length > 0) {
        const cap = BALANCE_CONFIG.supermarket;
        this.formationGroupTimer -= deltaTime;
        if (!this.waveSpawning && this.spawnQueue.length === 0) {
          this.formationIdleTimer += deltaTime;
          const alive = this.cb.onGetRoaches().length;
          const firstGroupDue = !this.formationWaveStarted
            && (alive <= cap.formationWaitClear || this.formationIdleTimer >= cap.formationWaitTimeout);
          const nextGroupDue = this.formationWaveStarted && this.formationGroupTimer <= 0;
          if (firstGroupDue || nextGroupDue) {
            const g = this.pendingFormations[0];
            const groupSize = (g.armored ?? 0) + (g.shield ?? 0) + (g.splitting ?? 0) + (g.timedSuicide ?? 0)
              + Math.min(g.tunnelWorker ?? 0, cap.maxTunnelerPerFormation)
              + Math.min(g.nurse ?? 0, cap.maxNursePerFormation);
            if (alive + groupSize <= 40) {
              this.cb.onSpawnFormationGroup?.(g, this.formationGroupIndex);
              this.pendingFormations.shift();
              this.formationGroupIndex++;
              this.formationWaveStarted = true;
              this.formationGroupTimer = cap.groupStaggerSec;
            }
          }
        } else {
          this.formationIdleTimer = 0;
        }
      }
      // 热场杂兵队列清空即激活穿插投放（不等首组阵列，自爆/杂兵更早进场）
      const t = this.trickleState;
      if (t && !t.active && !this.waveSpawning && this.spawnQueue.length === 0) {
        t.active = true;
      }
      // 持续穿插：自由杂兵池保底轮换投放（场上数量达护栏值 spawnCapacityGuard 时顺延）；
      // 自爆类（普通/飞行自爆）仅在场上存活蟑螂 ≥ trickleSuicideMinAlive 时投放（很多蟑螂时才生成）；
      // 被门控卡住的条目顺移跳过（先投池中后续可投类型，自爆不再堵住非自爆条目）；
      // 场上全灭（aliveCount === 0）时无视门控立即投放，消除波尾长空窗；
      // 全池被门控时每 0.5s 重试并由 suicideBlockTimer 累计等待，超 trickleSuicideWaitTimeout 强制投放兜底防卡关；
      // 自爆类挫开：出生 Y 按 3 档循环递进错位（更靠后出场）+ 间隔抖动放大（空场时抖动收窄快速补场）
      if (t && t.active && t.spawned < t.cfg.total) {
        t.intervalTimer -= deltaTime;
        if (t.intervalTimer <= 0) {
          const cap = BALANCE_CONFIG.supermarket;
          const aliveCount = this.cb.onGetRoaches().length;
          if (aliveCount >= cap.spawnCapacityGuard) {
            t.intervalTimer = 0.5;
          } else {
            // 保底轮换：从类型游标顺移扫描，跳过被自爆门控卡住的条目，池内每种类型轮流出现
            const len = t.cfg.types.length;
            const fieldEmpty = aliveCount === 0;
            const gateOpen = aliveCount >= cap.trickleSuicideMinAlive;
            let picked = -1;
            for (let k = 0; k < len; k++) {
              const idx = (t.typeCursor + k) % len;
              const cand = t.cfg.types[idx];
              const candSuicide = cand === RoachType.SUICIDE || cand === RoachType.FLYING_SUICIDE;
              if (!candSuicide || gateOpen || fieldEmpty) { picked = idx; break; }
            }
            if (picked < 0 && t.suicideBlockTimer < cap.trickleSuicideWaitTimeout) {
              // 全池被门控且未超时：累计等待，0.5s 后重试
              t.suicideBlockTimer += 0.5;
              t.intervalTimer = 0.5;
            } else {
              if (picked < 0) picked = t.typeCursor % len; // 超时兜底：强制投放游标处自爆条目
              t.typeCursor = (picked + 1) % len;
              t.suicideBlockTimer = 0;
              const type = t.cfg.types[picked];
              const jitter = cap.trickleJitterMin + Math.random() * (cap.trickleJitterMax - cap.trickleJitterMin);
              // 空场时自爆抖动收窄（快速补场），非空场挫开时间
              const suicideJitterMax = fieldEmpty ? cap.trickleJitterMax : cap.trickleSuicideJitterMax;
              const suicideJitter = cap.trickleJitterMin + Math.random() * (suicideJitterMax - cap.trickleJitterMin);
              if (type === RoachType.SUICIDE || type === RoachType.TIMED_SUICIDE) {
                // 阻挡面内随机位置生成（不限于阵列上方/远端顶部；Y 取梯形上部 60%，X 取该 Y 处地面透视宽度内随机）
                const [, farLY, , farRY, , , , , , , nearY] = SCENE_GROUND_BOUNDS[this.cfg.currentScene];
                const topY = Math.min(farLY, farRY);
                const y = topY + Math.random() * (nearY - topY) * 0.6;
                const [gL, gR] = this.cb.onGetGroundBoundsAtY?.(y)
                  ?? [this.cfg.width * 0.25, this.cfg.width * 0.75];
                const x = gL + Math.random() * (gR - gL);
                this.cb.onSpawnRoach(type, undefined, x, y);
                t.suicideSeq++;
                t.intervalTimer = t.cfg.intervalSec * suicideJitter;
              } else if (type === RoachType.FLYING_SUICIDE) {
                this.cb.onSpawnRoach(type); // 飞行自爆走侧边出生，仅挫开时间
                t.intervalTimer = t.cfg.intervalSec * suicideJitter;
              } else {
                this.cb.onSpawnRoach(type);
                t.intervalTimer = t.cfg.intervalSec * jitter;
              }
              t.spawned++;
            }
          }
        }
      }
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

    // 地铁第1波：精英蟑螂登场教学对话（暂停生成，仅首次）
    if (this.cfg.currentScene === SceneType.SUBWAY && this.wave === 1 && this.cfg.gameMode === GameMode.STORY) {
      const eliteTutorialSeen = (() => {
        try { return !!localStorage.getItem('subway_elite_tutorial_seen'); } catch { return false; }
      })();
      if (!eliteTutorialSeen) {
        this.eliteTutorialPause = true;
        this.cb.onEliteTutorialPauseChange?.(true);
        return;
      }
    }

    // 地铁第4波：斩螂·110 对阵护盾蟑螂教学对话（暂停生成，仅首次，护盾蟑螂首登场波次）
    if (this.cfg.currentScene === SceneType.SUBWAY && this.wave === 4 && this.cfg.gameMode === GameMode.STORY) {
      const knifeTutorialSeen = (() => {
        try { return !!localStorage.getItem('subway_knife_tutorial_seen'); } catch { return false; }
      })();
      if (!knifeTutorialSeen) {
        this.knifeTutorialPause = true;
        this.cb.onKnifeTutorialPauseChange?.(true);
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
    this.waveClearNotified = false;
    // 通知按波计时系统（列车时刻表等）：波次生成开始
    this.cb.onWaveStart?.(this.wave);

    // Boss 模式跳过倒计时，在此处启动关卡 BGM
    if (this.wave === 1 && this.cfg.gameMode === GameMode.BOSS) {
      this.cb.onPlayBGM();
    }

    // 注：checkVictory() 已在 update() 中（所有敌人死亡后）调用，
    // 此处不应重复调用，否则最后一波（wave === configs.length）会
    // 在生成敌人之前就触发胜利
    const config = this.getWaveConfig(this.wave);

    // ===== 超市 V4.0：波内调度初始化 —— 清空残余阵型实例、登记待生成阵型组与穿插投放 =====
    // 自由杂兵走下方标准三阶段队列先行热场；队列清空后首组阵型出场，后续组按 groupStaggerSec 错时整组生成（出生点即槽位）；
    // 阵列推进全程由 trickle 持续穿插投放杂兵/自爆偷袭单位
    if (this.cfg.currentScene === SceneType.SUPERMARKET) {
      this.cb.onClearFormations?.();
      this.pendingFormations = [...(config.formationGroups ?? [])];
      this.formationIdleTimer = 0;
      this.formationGroupTimer = 0;
      this.formationWaveStarted = false;
      this.formationGroupIndex = 0;
      this.trickleState = config.trickle
        ? { cfg: config.trickle, active: false, intervalTimer: 0, spawned: 0, typeCursor: 0, suicideSeq: 0, suicideBlockTimer: 0 }
        : null;
    }

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

    // 地铁特殊单位（护盾蟑螂最先生成，确保编队锚点先就位；变异蟑螂混入 phase2；定时自爆走独立定时生成）
    if (this.cfg.currentScene === SceneType.SUBWAY) {
      const { tunnelWorkerCount = 0, eliteCount = 0, shieldCount = 0, mutantCount = 0, timedSuicideCount = 0 } = config;
      addToQueue(phase1, RoachType.SHIELD, shieldCount); // 护盾蟑螂在 phase1 最前
      addToQueue(phase1, RoachType.TUNNEL_WORKER, tunnelWorkerCount);
      shuffle(phase1);
      addToQueue(phase2, RoachType.MUTANT, mutantCount);
      addToQueue(phase2, RoachType.SUBWAY_ELITE, eliteCount);
      shuffle(phase2);
      this.cb.onSetTimedSuicideRemaining(timedSuicideCount);
      this.cb.onSetTimedSuicideTimer(timedSuicideCount > 0 ? 5.0 : 0);
    }

    // 超市特殊单位（V4.0：地铁精英为自由杂兵直接入队；护盾/护士/隧道工/装甲/分裂仅由阵型组生成，不入自由队列）
    if (this.cfg.currentScene === SceneType.SUPERMARKET) {
      const { eliteCount = 0 } = config;
      addToQueue(phase2, RoachType.SUBWAY_ELITE, eliteCount);
      shuffle(phase2);
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

  /** 检查波次是否完成（含超市 V4.0 未触发的波内调度事件） */
  isWaveComplete(): boolean {
    return !this.waveSpawning && this.spawnQueue.length === 0 && !this.hasPendingWaveEvents();
  }

  /** 是否还有未触发的波内调度事件（待生成阵型组/穿插投放）——胜利判定须等待其全部完成 */
  private hasPendingWaveEvents(): boolean {
    return this.pendingFormations.length > 0
      || (this.trickleState !== null && this.trickleState.spawned < this.trickleState.cfg.total);
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