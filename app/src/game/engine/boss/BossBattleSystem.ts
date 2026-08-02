/**
 * @fileoverview Boss战斗系统模块
 * @description 负责管理游戏中Boss战斗的所有逻辑，包括Boss状态管理、阶段切换、虫卵系统、死亡序列等
 */

import { 
  type BossBattleState,
  type Roach,
  RoachType,
  RoachState,
  GameState,
  GameMode,
  SceneType
} from '../../types';
import { BOSS_ANIMATIONS } from '../../bossAnimation';
import { TEXT_CONFIG, RENDER_COLOR, RENDER_FONT } from '../../data';
import { BALANCE_CONFIG } from '../../data';

// =============================================================================
// 回调接口分组（修复 P2：回调过多，按职责拆分）
// =============================================================================

/** 视觉/特效回调 */
export interface BossBattleEffectCallbacks {
  onAddFloatingText: (x: number, y: number, text: string, color: string) => void;
  onSpawnExplosionParticles: (x: number, y: number, count: number) => void;
  onSpawnShockwaveRing: (x: number, y: number, radius: number) => void;
  onScreenShake: (intensity: number) => void;
}

/** 游戏流程回调 */
export interface BossBattleFlowCallbacks {
  onBossUpdate: (bossState: BossBattleState) => void;
  onGameVictory: () => void;
  onGameDefeat: () => void;
  onStateChange: (state: GameState) => void;
  onGameOver: (economy: any, wave: number) => void;
  onWaveClear: () => void;
}

/** 资源/数据回调 */
export interface BossBattleResourceCallbacks {
  onGetEconomy: () => any;
  onGetProgress: () => any;
  onGetRoaches: () => Roach[];
  onSellUnusedInventory: () => number;
  onSaveProgress: () => void;
  onStopBGM: () => void;
  onPlayVictoryBGM: () => void;
  onPushRoach: (roach: Roach) => void;
  onRemoveRoach: (roach: Roach) => void;
  onGetLivingNonBossCount: () => number;
}

/**
 * Boss战斗系统配置接口
 */
export interface BossBattleConfig {
  width: number;
  height: number;
  difficulty: 'easy' | 'normal' | 'hard';
  deltaTime: number;
  time: number;
  defenseHp: number;
  defenseMaxHp: number;
  gameMode: GameMode;
  state: GameState;
  currentScene: SceneType;
}

/**
 * Boss战斗系统回调接口（组合子接口）
 */
export interface BossBattleCallbacks
  extends BossBattleEffectCallbacks,
          BossBattleFlowCallbacks,
          BossBattleResourceCallbacks {}

/**
 * Boss战斗系统类
 * @description 管理Boss战斗的所有逻辑，包括状态管理、阶段切换、虫卵系统、死亡序列等
 */
export class BossBattleSystem {
  /** Boss战斗状态 */
  bossBattle: BossBattleState;
  
  /** Boss动画状态 */
  bossAnimState: { action: string; frameIndex: number; timer: number };
  
  /** Boss动画帧数据（引用由engine.ts管理） */
  bossAnimFrames: Map<string, HTMLImageElement[]>;
  
  /** 活跃Boss数量 */
  activeBosses: number = 0;

  /** 配置 */
  private cfg: BossBattleConfig;
  
  /** 回调 */
  private cb: BossBattleCallbacks;

  /** ID生成器（修复 P0：消除全局计数器） */
  private getNextBossId: () => number;

  /** 对话计时器数组（修复 P0：防止 setTimeout 内存泄漏） */
  private dialogueTimers: ReturnType<typeof setTimeout>[] = [];

  /** 获得 economy 引用 */
  private get economy() { return this.cb.onGetEconomy(); }
  /** 获得 progress 引用 */
  private get progress() { return this.cb.onGetProgress(); }

  /**
   * 构造函数
   * @param getNextBossId ID生成器回调（修复 P0：注入式ID，消除全局状态）
   */
  constructor(
    config: BossBattleConfig,
    callbacks: BossBattleCallbacks,
    animFrames: Map<string, HTMLImageElement[]>,
    getNextBossId: () => number,
  ) {
    this.cfg = config;
    this.cb = callbacks;
    this.bossAnimFrames = animFrames;
    this.getNextBossId = getNextBossId;
    this.bossBattle = this.resetBossState(false);
    this.bossAnimState = {
      action: 'hover',
      frameIndex: 0,
      timer: 0,
    };
  }

  /**
   * 更新配置（每帧调用前同步）
   */
  updateConfig(config: Partial<BossBattleConfig>): void {
    Object.assign(this.cfg, config);
  }

  /**
   * 重置Boss战斗状态（修复 P1：合并 createDefaultBossState 和 resetForNonBossMode）
   * @param active 是否为活跃Boss模式
   */
  private resetBossState(active: boolean): BossBattleState {
    const bossCfg = BALANCE_CONFIG.boss;
    return {
      active,
      bossHp: active ? bossCfg.totalLayers : 0,
      bossMaxHp: active ? bossCfg.totalLayers : 0,
      phase: 1,
      phaseName: '',
      timeLimit: active ? bossCfg.timeLimit : 0,
      timeRemaining: active ? bossCfg.timeLimit : 0,
      currentWave: 0,
      waveCleared: false,
      waveSpawnTimer: active ? bossCfg.eggWaveSpawnTimer : 0,
      bossDialogue: '',
      dialogueTimer: 0,
      dialogueIndex: 0,
      bossKilled: false,
      bossFleeing: false,
      bossFleeTimer: 0,
      deathAnimTimer: 0,
      corpseStayTimer: 0,
      phaseJustChanged: false,
      phaseChangeTimer: 0,
      phaseChangeText: '',
      phaseChangeSub: '',
      summonTimer: 0,
      chargeTimer: 0,
      chargeWarning: false,
      chargeWarningTimer: 0,
      chargeWarningLevel: 0,
      stunCooldown: 0,
      bossDamageTaken: 0,
      enraged: false,
      chargeCooldown: 0,
      summonWave: 0,
      controlImmunity: 0,
      chargeHitFlash: 0,
      summonAnimTimer: 0,
      summonCastTimer: 0,
      shedCount: 0,
      maxShed: bossCfg.maxShed,
      isShedding: false,
      shedAnimTimer: 0,
      shedShells: [],
      leftEyeHp: bossCfg.eyeHp,
      leftEyeMaxHp: bossCfg.eyeHp,
      leftEyeDestroyed: false,
      rightEyeHp: bossCfg.eyeHp,
      rightEyeMaxHp: bossCfg.eyeHp,
      rightEyeDestroyed: false,
      bellyHp: bossCfg.bellyHp,
      bellyMaxHp: bossCfg.bellyHp,
      bellyExposed: false,
      activeWeakPoint: '',
      showInterruptHint: false,
      interruptHintTimer: 0,
    };
  }

  /**
   * 重置（游戏开始/重开时调用）
   * 修复 P0：清除所有对话计时器防止内存泄漏
   */
  reset(): void {
    // 清除对话计时器（修复 P0：setTimeout 内存泄漏）
    this.clearDialogueTimers();
    this.bossBattle = this.resetBossState(false);
    this.bossAnimState = { action: 'hover', frameIndex: 0, timer: 0 };
    this.activeBosses = 0;
  }

  /**
   * 非BOSS模式下的 bossBattle 重置（确保 boss 状态不会泄漏到普通模式）
   * @deprecated 使用 reset() 替代
   */
  resetForNonBossMode(): void {
    this.bossBattle = this.resetBossState(false);
  }

  // ========== Boss 查找辅助（修复 P1：消除 6+ 处 find 遍历） ==========

  /** 查找Boss实体（按类型） */
  private findBoss(): Roach | undefined {
    return this.cb.onGetRoaches().find(r => r.type === RoachType.QUEEN);
  }

  /** 查找任意Boss实体（按 isBoss 标记） */
  private findAnyBoss(): Roach | undefined {
    return this.cb.onGetRoaches().find(r => r.isBoss);
  }

  // ========== Boss 生成 ==========

  /** 生成Boss实体 */
  spawnBoss(): Roach {
    const isHard = this.cfg.difficulty === 'hard';
    const bossCfg = BALANCE_CONFIG.boss;
    const bossHp = bossCfg.baseHp;
    const bossY = this.cfg.height * bossCfg.bossYRatio;
    const boss: Roach = {
      id: this.getNextBossId(), // 修复 P0：使用注入的ID生成器
      x: this.cfg.width / 2,
      y: bossY,
      vx: 0,
      vy: 0,
      type: RoachType.QUEEN,
      hp: bossHp,
      maxHp: bossHp,
      state: RoachState.ALIVE,
      speed: bossCfg.speed,
      baseSpeed: bossCfg.speed,
      burnDamage: 0,
      inFire: false,
      clusterId: undefined,
      angle: Math.PI / 2,
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: bossCfg.wobbleSpeed + Math.random() * bossCfg.wobbleSpeedRandom,
      isEnraged: false,
      deathTimer: 0,
      animFrame: 0,
      animTimer: 0,
      panicTimer: 0,
      panicAngle: 0,
      stunTimer: 0,
      isStunned: false,
      facingRight: true,
      altitude: 0,
      wingPhase: 0,
      armorHp: bossCfg.armorHp[isHard ? 'hard' : 'normal'],
      maxArmorHp: bossCfg.armorHp[isHard ? 'hard' : 'normal'],
      hasSplit: false,
      fuseTimer: 2,
      isFused: false,
      spawnTimer: 4,
      isBoss: true,
      isCharging: false,
      stuckTimer: 0,
      poisonTimer: 0,
      poisonDamage: 0,
      fanSlowTimer: 0,
      fanSlowFactor: 0,
      fanPushY: 0,
      wrappedByDropId: null,
      wrapTimer: 0,
      damageFlash: 0,
      dodgeDir: 0,
      dodgeTimer: 0,
      wasDodging: false,
      // Boss控制状态
      isBurnBack: false,
      burnBackTimer: 0,
      isBlind: false,
      blindTimer: 0,
      isJammed: false,
      jamTimer: 0,
      // Boss归位位置
      homeX: this.cfg.width / 2,
      homeY: bossY,
      returningHome: false,
      chargeReturnDelay: 0,
      // Boss独立属性
      size: bossCfg.bossSize,
      reward: bossCfg.bossReward,
    };
    return boss;
  }

  // ========== Boss 战斗初始化 ==========

  /** 初始化Boss战斗状态与波次配置 */
  initBossBattle(): void {
    const bossCfg = BALANCE_CONFIG.boss;
    this.bossBattle = this.resetBossState(true);
    // 修复 P0：bossHp 使用配置统一计算
    this.bossBattle.phaseName = TEXT_CONFIG.combat.bossPhase1.text;
    this.bossBattle.bossHp = bossCfg.totalLayers;
    this.bossBattle.bossMaxHp = bossCfg.totalLayers;

    const boss = this.spawnBoss();
    this.cb.onPushRoach(boss);

    this.bossBattle.phaseJustChanged = true;
    this.bossBattle.phaseChangeTimer = bossCfg.phaseChangeTimer;
    this.bossBattle.phaseChangeText = TEXT_CONFIG.combat.bossAppearTitle.text;
    this.bossBattle.phaseChangeSub = TEXT_CONFIG.combat.bossDefendLine.text;
    this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 3, TEXT_CONFIG.combat.bossAppear.text, TEXT_CONFIG.combat.bossAppear.color);
    this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 3 + 30, TEXT_CONFIG.combat.bossSpawnEggs.text, TEXT_CONFIG.combat.bossSpawnEggs.color);
    this.cb.onScreenShake(BALANCE_CONFIG.screenShake.bossDeath);
  }

  // ========== Boss 死亡序列 ==========

  /** 集中式Boss死亡序列 - 从updateBossBattle或延迟系统调用 */
  triggerBossDeathSequence(): void {
    const bb = this.bossBattle;
    if (!bb.active || bb.bossKilled) return;

    const boss = this.findBoss(); // 修复 P1：使用 findBoss 辅助
    if (!boss) return;

    // 确保死亡状态
    if (boss.state !== RoachState.DEAD) {
      boss.hp = 0;
      boss.state = RoachState.DEAD;
    }
    boss.deathTimer = 999; // 防止updateRoaches移除尸体
    bb.bossHp = 0;

    // 开始死亡动画序列
    const bossCfg = BALANCE_CONFIG.boss;
    bb.bossKilled = true;
    bb.deathAnimTimer = bossCfg.deathAnimTimer;
    this.bossAnimState.action = 'die';
    this.bossAnimState.frameIndex = 0;
    this.bossAnimState.timer = 0;

    // 死亡效果（修复 P1：硬编码值 → 配置）
    this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 3, TEXT_CONFIG.combat.bossDefeatedText.text, TEXT_CONFIG.combat.bossDefeatedText.color);
    this.cb.onSpawnExplosionParticles(boss.x, boss.y, bossCfg.deathExplosionParticles);
    this.cb.onSpawnShockwaveRing(boss.x, boss.y, bossCfg.deathShockwaveRadius);
    this.cb.onScreenShake(BALANCE_CONFIG.screenShake.queenDeath);
  }

  /** 更新死亡序列计时器（动画 → 尸体停留 → 胜利） */
  updateBossDeathSequence(): { triggerVictory?: boolean } {
    const bb = this.bossBattle;
    if (!bb.bossKilled) return {};

    const bossCfg = BALANCE_CONFIG.boss;

    // 更新死亡动画计时器
    if (bb.deathAnimTimer > 0) {
      bb.deathAnimTimer -= this.cfg.deltaTime;
      if (this.bossAnimState.action !== 'die') {
        this.bossAnimState.action = 'die';
      }
      const dieConfig = BOSS_ANIMATIONS['die'];
      this.bossAnimState.timer += this.cfg.deltaTime * 1000;
      const interval = 1000 / dieConfig.fps;
      if (this.bossAnimState.timer >= interval) {
        this.bossAnimState.timer = 0;
        const maxFrames = this.bossAnimFrames.get('die')?.length || 7;
        this.bossAnimState.frameIndex = Math.min(this.bossAnimState.frameIndex + 1, maxFrames - 1);
      }
    }

    // 死亡动画结束 → 开始尸体停留
    if (bb.deathAnimTimer <= 0 && bb.corpseStayTimer <= 0 && this.cfg.state === GameState.PLAYING) {
      bb.corpseStayTimer = bossCfg.corpseStayTimer;
      this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 2, TEXT_CONFIG.combat.victory.text, TEXT_CONFIG.combat.victory.color);
    }

    // 尸体停留倒计时
    if (bb.corpseStayTimer > 0) {
      bb.corpseStayTimer -= this.cfg.deltaTime;
      const maxFrames = this.bossAnimFrames.get('die')?.length || 7;
      this.bossAnimState.frameIndex = maxFrames - 1;
    }

    // 尸体停留结束 → 触发胜利
    if (bb.corpseStayTimer <= 0 && bb.deathAnimTimer <= 0 && this.cfg.state === GameState.PLAYING) {
      return { triggerVictory: true };
    }

    return {};
  }

  /** 处理Boss死亡后的胜利流程 */
  handleBossVictory(): void {
    const bb = this.bossBattle;
    const boss = this.findBoss(); // 修复 P1：使用 findBoss 辅助
    bb.active = false;
    this.cb.onSellUnusedInventory();
    this.cb.onStateChange(GameState.GAME_OVER);
    this.cb.onStopBGM();
    this.cb.onPlayVictoryBGM();

    // 修复 P1：不再直接修改回调返回对象，通过 SaveSystem 更新
    const econ = this.cb.onGetEconomy();
    econ.highestWave = 1;
    const prog = this.cb.onGetProgress();
    prog.highestWave = Math.max(prog.highestWave, 1);
    this.cb.onSaveProgress();

    this.cb.onGameOver(this.cb.onGetEconomy(), 1);
    if (boss) boss.deathTimer = 0; // 允许下一帧移除
  }

  // ========== Boss 战斗主更新 ==========

  /** 更新Boss战斗逻辑 */
  updateBossBattle(): { spawnEggWave?: number; startBossDialogue?: boolean; triggerVictory?: boolean } {
    const bb = this.bossBattle;
    if (!bb.active && !bb.bossKilled) return {};

    const bossCfg = BALANCE_CONFIG.boss;
    const boss = this.findBoss(); // 修复 P1：使用 findBoss 辅助
    if (!boss) {
      const deathResult = this.updateBossDeathSequence();
      return deathResult;
    }

    // ===== Boss逃跑（胜利序列） =====
    if (bb.bossFleeing) {
      bb.bossFleeTimer -= this.cfg.deltaTime;
      boss.y -= bossCfg.fleeSpeed * this.cfg.deltaTime;
      boss.x += Math.sin(this.cfg.time * bossCfg.fleeWobbleFreq) * bossCfg.fleeWobbleAmplitude * this.cfg.deltaTime;
      if (bb.bossFleeTimer <= 0 || boss.y < bossCfg.fleeOffscreenY) {
        this.cb.onRemoveRoach(boss);
        bb.active = false;
        this.activeBosses = 0;
        this.cb.onGameVictory();
      }
      return {};
    }

    // 更新死亡序列
    if (bb.bossKilled) {
      const result = this.updateBossDeathSequence();
      if (result.triggerVictory) {
        this.handleBossVictory();
      }
      return {};
    }

    // 检查防线失败
    if (this.cfg.defenseHp <= 0) {
      this.cb.onGameDefeat();
      return {};
    }

    // 时间限制
    bb.timeRemaining -= this.cfg.deltaTime;
    if (bb.timeRemaining <= 0) {
      this.cfg.defenseHp = 0;
      this.cb.onGameDefeat();
      return {};
    }

    // 更新阶段切换横幅
    if (bb.phaseChangeTimer > 0) {
      bb.phaseChangeTimer -= this.cfg.deltaTime;
      if (bb.phaseChangeTimer <= 0) {
        bb.phaseJustChanged = false;
      }
    }

    // ===== Boss动画（悬停） =====
    this.updateBossAnimation(boss);

    // ===== 虫卵波次系统 =====
    const eggResult = this.updateEggPodSystem();
    if (eggResult.spawnEggWave) {
      // 同步HP显示（修复 P0：使用配置统一计算）
      this.syncBossHp();
      this.cb.onBossUpdate?.(bb);
      return { spawnEggWave: eggResult.spawnEggWave };
    }
    if (eggResult.startBossDialogue) {
      this.syncBossHp();
      this.cb.onBossUpdate?.(bb);
      return { startBossDialogue: true };
    }

    // 同步HP显示
    this.syncBossHp();

    // 通知UI
    this.cb.onBossUpdate?.(bb);

    return {};
  }

  /**
   * 同步Boss HP显示（修复 P0：统一 bossHp 计算公式）
   * bossHp = totalLayers - currentWave + 1，当 currentWave <= totalLayers
   */
  private syncBossHp(): void {
    const bb = this.bossBattle;
    const totalLayers = BALANCE_CONFIG.boss.totalLayers;
    bb.bossHp = Math.max(0, totalLayers - bb.currentWave + 1);
    bb.bossMaxHp = totalLayers;
  }

  // ========== Boss 动画 ==========

  /** 更新Boss动画（悬停） */
  private updateBossAnimation(boss: Roach): void {
    const bossCfg = BALANCE_CONFIG.boss;
    const hoverBaseX = boss.homeX ?? this.cfg.width / 2;
    const targetX = hoverBaseX + Math.sin(this.cfg.time * bossCfg.hoverFreq + boss.wobbleOffset) * bossCfg.hoverAmplitude;
    const targetY = (boss.homeY ?? this.cfg.height * 0.15) + Math.sin(this.cfg.time * bossCfg.hoverYFreq + boss.wobbleOffset * 2) * bossCfg.hoverYAmplitude;
    boss.x += (targetX - boss.x) * bossCfg.hoverLerpSpeed * this.cfg.deltaTime;
    boss.y += (targetY - boss.y) * bossCfg.hoverLerpSpeed * this.cfg.deltaTime;

    let newAction = 'hover';
    if (boss.isStunned) newAction = 'stun';
    if (newAction !== this.bossAnimState.action) {
      this.bossAnimState.action = newAction;
      this.bossAnimState.frameIndex = 0;
      this.bossAnimState.timer = 0;
    }
    const animConfig = BOSS_ANIMATIONS[this.bossAnimState.action as keyof typeof BOSS_ANIMATIONS];
    if (animConfig) {
      this.bossAnimState.timer += this.cfg.deltaTime * 1000;
      const interval = 1000 / animConfig.fps;
      if (this.bossAnimState.timer >= interval) {
        this.bossAnimState.timer = 0;
        const maxFrames = this.bossAnimFrames.get(this.bossAnimState.action)?.length || 1;
        this.bossAnimState.frameIndex = animConfig.loop
          ? (this.bossAnimState.frameIndex + 1) % maxFrames
          : Math.min(this.bossAnimState.frameIndex + 1, maxFrames - 1);
      }
    }
  }

  // ========== 虫卵波次系统 ==========

  /** 虫卵波次系统（4波Boss机制） */
  updateEggPodSystem(): { spawnEggWave?: number; startBossDialogue?: boolean } {
    const bb = this.bossBattle;
    const bossCfg = BALANCE_CONFIG.boss;
    const totalLayers = bossCfg.totalLayers;

    // 检查当前波次是否清除（没有存活的非Boss敌人）
    if (!bb.waveCleared) {
      const livingEnemies = this.cb.onGetLivingNonBossCount();
      if (livingEnemies === 0) {
        bb.waveCleared = true;
        bb.currentWave++;
        this.syncBossHp(); // 修复 P0：统一 HP 计算
        if (bb.currentWave <= totalLayers) {
          bb.phase = bb.currentWave as 1 | 2 | 3 | 4;
        }
        this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 3, TEXT_CONFIG.combat.waveClearedN.text(bb.currentWave), TEXT_CONFIG.combat.waveClearedN.color);

        // 检查是否所有波次完成
        if (bb.currentWave > totalLayers) {
          return { startBossDialogue: true };
        }

        // 开始Boss施法动画
        this.startBossSummonCast(bb.currentWave);
      }
    }

    // 处理Boss召唤施法计时器
    if (bb.summonCastTimer > 0) {
      bb.summonCastTimer -= this.cfg.deltaTime;
      if (bb.summonCastTimer <= 0) {
        bb.waveCleared = false;
        return { spawnEggWave: bb.currentWave };
      }
    }

    // 生成第一波
    if (bb.currentWave === 0 && !bb.waveCleared && bb.summonCastTimer <= 0) {
      bb.currentWave = 1;
      bb.phase = 1;
      this.syncBossHp(); // 修复 P0：统一 HP 计算
      this.startBossSummonCast(1);
    }

    return {};
  }

  /** Boss召唤施法动画 - 虫卵从上方落下 */
  startBossSummonCast(wave: number): void {
    const bb = this.bossBattle;
    const boss = this.findAnyBoss(); // 修复 P1：使用 findAnyBoss 辅助
    const castX = boss ? boss.x : this.cfg.width / 2;
    const castY = boss ? boss.y : this.cfg.height * 0.25;

    const bossCfg = BALANCE_CONFIG.boss;
    bb.summonCastTimer = bossCfg.summonCastTimer;

    bb.phaseChangeText = TEXT_CONFIG.combat.bossWaveTitle.text(wave, TEXT_CONFIG.combat.bossWaveNames.text[wave]);
    bb.phaseChangeSub = TEXT_CONFIG.combat.bossSummoning.text;
    bb.phaseJustChanged = true;
    bb.phaseChangeTimer = bossCfg.summonPhaseChangeTimer;

    this.cb.onAddFloatingText(castX, castY - bossCfg.dialogueTextOffsets.line3, TEXT_CONFIG.combat.bossSummon.text, TEXT_CONFIG.combat.bossSummon.color);
  }

  // ========== Boss 对话与逃跑 ==========

  /** 清除对话计时器（修复 P0：防止内存泄漏） */
  private clearDialogueTimers(): void {
    this.dialogueTimers.forEach(t => clearTimeout(t));
    this.dialogueTimers = [];
  }

  /** 开始Boss对话（所有波次完成后） */
  startBossDialogue(): void {
    const bb = this.bossBattle;
    const boss = this.findBoss(); // 修复 P1：使用 findBoss 辅助
    if (!boss) return;

    const bossCfg = BALANCE_CONFIG.boss;

    // 修复 P0：清除旧计时器，防止内存泄漏
    this.clearDialogueTimers();

    bb.bossDialogue = TEXT_CONFIG.combat.bossDialogueShort.text;
    bb.dialogueTimer = bossCfg.dialogueTimer;
    bb.dialogueIndex = 0;

    const offsets = bossCfg.dialogueTextOffsets;
    const delays = bossCfg.dialogueDelays;

    this.cb.onAddFloatingText(boss.x, boss.y - offsets.line1, TEXT_CONFIG.combat.bossDialogue1.text, TEXT_CONFIG.combat.bossDialogue1.color);

    // 修复 P0：计时器存入数组，支持清理
    this.dialogueTimers.push(setTimeout(() => {
      if (!bb.active) return;
      this.cb.onAddFloatingText(boss.x, boss.y - offsets.line1, TEXT_CONFIG.combat.bossDialogue2.text, TEXT_CONFIG.combat.bossDialogue2.color);
    }, delays[0]));

    this.dialogueTimers.push(setTimeout(() => {
      if (!bb.active) return;
      this.cb.onAddFloatingText(boss.x, boss.y - offsets.line1, TEXT_CONFIG.combat.bossDialogue3.text, TEXT_CONFIG.combat.bossDialogue3.color);
    }, delays[1]));

    this.dialogueTimers.push(setTimeout(() => {
      if (!bb.active) return;
      bb.bossFleeing = true;
      bb.bossFleeTimer = bossCfg.fleeTimer;
      this.cb.onAddFloatingText(boss.x, boss.y - offsets.line2, TEXT_CONFIG.combat.bossFlee.text, TEXT_CONFIG.combat.bossFlee.color);
    }, delays[2]));
  }

  // ========== 安全网检查 ==========

  /** Boss死亡安全网：检查Boss是否已死亡但死亡序列未触发 */
  checkBossDeathSafetyNet(): boolean {
    if (this.cfg.gameMode === GameMode.BOSS && this.bossBattle.active && !this.bossBattle.bossKilled) {
      const boss = this.findBoss(); // 修复 P1：使用 findBoss 辅助
      if (boss && (boss.hp <= 0 || boss.state === RoachState.DEAD)) {
        this.triggerBossDeathSequence();
        return true;
      }
    }
    return false;
  }

  // ========== 静态渲染方法 ==========

  /** 渲染Boss UI（HP条、阶段横幅等） */
  static renderBossUI(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bossBattle: BossBattleState
  ): void {
    const bb = bossBattle;
    if (!bb.active && !bb.bossKilled) return;

    const barW = Math.min(400, w * 0.7);
    const barH = 20;
    const barX = (w - barW) / 2;
    const barY = 82;

    // Boss名称 + 阶段
    ctx.fillStyle = RENDER_COLOR.bossLayerActive;
    ctx.font = RENDER_FONT.large;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(TEXT_CONFIG.combat.bossPhaseTitle.text(bb.phaseName), w / 2, barY - 8);
    ctx.shadowBlur = 0;

    // 4层HP条
    const layerColors = [...RENDER_COLOR.bossLayerColors];
    const totalLayers = BALANCE_CONFIG.boss.totalLayers;
    const layerWidth = barW / totalLayers;

    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // 绘制层
    for (let i = 0; i < totalLayers; i++) {
      const isActive = i < bb.currentWave;
      const lx = barX + i * layerWidth;
      ctx.fillStyle = isActive ? layerColors[i] : 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      const roundL = i === 0 ? 4 : 0;
      const roundR = i === totalLayers - 1 ? 4 : 0;
      ctx.roundRect(lx, barY, layerWidth - 1, barH, [roundL, roundR, roundR, roundL]);
      ctx.fill();

      // 层号
      ctx.fillStyle = isActive ? RENDER_COLOR.bossLayerActive : RENDER_COLOR.bossLayerInactive;
      ctx.font = RENDER_FONT.boldSmall;
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, lx + layerWidth / 2, barY + barH / 2 + 3);

      // 分隔线
      if (i < totalLayers - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx + layerWidth, barY + 3);
        ctx.lineTo(lx + layerWidth, barY + barH - 3);
        ctx.stroke();
      }
    }

    // 波次进度文字
    let waveDisplay = TEXT_CONFIG.combat.preparing.text;
    if (bb.currentWave >= 1 && bb.currentWave <= totalLayers) {
      waveDisplay = TEXT_CONFIG.combat.bossWaveProgress.text(bb.currentWave);
    } else if (bb.currentWave > totalLayers) {
      waveDisplay = TEXT_CONFIG.combat.bossFleeing.text;
    }
    ctx.fillStyle = RENDER_COLOR.bossLayerActive;
    ctx.font = RENDER_FONT.normal;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(waveDisplay, w / 2, barY + barH / 2 + 3);
    ctx.shadowBlur = 0;

    // 剩余时间
    const timeText = TEXT_CONFIG.combat.bossTimeRemaining.text(Math.ceil(bb.timeRemaining));
    ctx.fillStyle = bb.timeRemaining < 30 ? RENDER_COLOR.bossTimeDanger : RENDER_COLOR.bossTimeNormal;
    ctx.font = RENDER_FONT.medium;
    ctx.textAlign = 'right';
    ctx.fillText(timeText, w - 20, barY + barH + 18);

    // 阶段切换横幅
    if (bb.phaseJustChanged && bb.phaseChangeTimer > 0) {
      const alpha = Math.min(1, bb.phaseChangeTimer / 1.5);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * alpha})`;
      ctx.fillRect(0, h / 2 - 60, w, 120);
      ctx.fillStyle = `rgba(255, 68, 68, ${alpha})`;
      ctx.font = RENDER_FONT.banner;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillText(bb.phaseChangeText, w / 2, h / 2 - 10);
      ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
      ctx.font = RENDER_FONT.subTitle;
      ctx.fillText(bb.phaseChangeSub, w / 2, h / 2 + 25);
      ctx.shadowBlur = 0;
    }
  }

  // ========== 辅助方法 ==========

  /** 获取Boss动画状态 */
  getBossAnimState(): { action: string; frameIndex: number; timer: number } {
    return { ...this.bossAnimState };
  }

  /** 设置Boss动画状态 */
  setBossAnimState(state: Partial<{ action: string; frameIndex: number; timer: number }>): void {
    Object.assign(this.bossAnimState, state);
  }

  /** 获取Boss战斗状态 */
  getBossState(): BossBattleState {
    return { ...this.bossBattle };
  }

  /**
   * 是否可控制Boss（修复 P2：添加实际逻辑判断）
   * 仅在Boss活跃且未被击杀时返回 true
   */
  canControlBoss(): boolean {
    return this.bossBattle.active && !this.bossBattle.bossKilled;
  }
}