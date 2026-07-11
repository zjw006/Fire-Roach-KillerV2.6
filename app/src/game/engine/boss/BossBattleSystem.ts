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

// ===== 全局Boss ID计数器 =====
let nextBossId = 10000;

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
 * Boss战斗系统回调接口
 */
export interface BossBattleCallbacks {
  onAddFloatingText: (x: number, y: number, text: string, color: string) => void;
  onSpawnExplosionParticles: (x: number, y: number, count: number) => void;
  onSpawnShockwaveRing: (x: number, y: number, radius: number) => void;
  onScreenShake: (intensity: number) => void;
  onBossUpdate: (bossState: BossBattleState) => void;
  onGameVictory: () => void;
  onGameDefeat: () => void;
  onSellUnusedInventory: () => number;
  onSaveProgress: () => void;
  onStopBGM: () => void;
  onPlayVictoryBGM: () => void;
  onStateChange: (state: GameState) => void;
  onGameOver: (economy: any, wave: number) => void;
  onWaveClear: () => void;
  onGetEconomy: () => any;
  onGetProgress: () => any;
  onGetRoaches: () => Roach[];
  onPushRoach: (roach: Roach) => void;
  onRemoveRoach: (roach: Roach) => void;
  onSetActiveBosses: (count: number) => void;
  onGetLivingNonBossCount: () => number;
}

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

  /** 是否已触发失败（防止重复） */
  defeatTriggered: boolean = false;

  /** 获得 economy 引用 */
  private get economy() { return this.cb.onGetEconomy(); }
  /** 获得 progress 引用 */
  private get progress() { return this.cb.onGetProgress(); }

  /**
   * 构造函数
   */
  constructor(
    config: BossBattleConfig,
    callbacks: BossBattleCallbacks,
    animFrames: Map<string, HTMLImageElement[]>
  ) {
    this.cfg = config;
    this.cb = callbacks;
    this.bossAnimFrames = animFrames;
    this.bossBattle = this.createDefaultBossState();
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
   * 创建默认Boss状态
   */
  private createDefaultBossState(): BossBattleState {
    return {
      active: false,
      bossHp: 0,
      bossMaxHp: 0,
      phase: 1,
      phaseName: '',
      timeLimit: 0,
      timeRemaining: 0,
      currentWave: 0,
      waveCleared: false,
      waveSpawnTimer: 0,
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
      maxShed: 3,
      isShedding: false,
      shedAnimTimer: 0,
      shedShells: [],
      leftEyeHp: 800,
      leftEyeMaxHp: 800,
      leftEyeDestroyed: false,
      rightEyeHp: 800,
      rightEyeMaxHp: 800,
      rightEyeDestroyed: false,
      bellyHp: 1500,
      bellyMaxHp: 1500,
      bellyExposed: false,
      activeWeakPoint: '',
      showInterruptHint: false,
      interruptHintTimer: 0,
    };
  }

  /**
   * 重置Boss战斗状态（游戏开始/重开时调用）
   */
  reset(): void {
    this.bossBattle = this.createDefaultBossState();
    this.bossAnimState = { action: 'hover', frameIndex: 0, timer: 0 };
    this.activeBosses = 0;
    this.defeatTriggered = false;
  }

  /**
   * 非BOSS模式下的 bossBattle 重置（确保 boss 状态不会泄漏到普通模式）
   */
  resetForNonBossMode(): void {
    this.bossBattle = {
      active: false,
      bossHp: 0,
      bossMaxHp: 0,
      phase: 1,
      phaseName: '',
      timeLimit: 180,
      timeRemaining: 180,
      currentWave: 0,
      waveCleared: false,
      waveSpawnTimer: 0,
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
      maxShed: 3,
      isShedding: false,
      shedAnimTimer: 0,
      shedShells: [],
      leftEyeHp: 800,
      leftEyeMaxHp: 800,
      leftEyeDestroyed: false,
      rightEyeHp: 800,
      rightEyeMaxHp: 800,
      rightEyeDestroyed: false,
      bellyHp: 1500,
      bellyMaxHp: 1500,
      bellyExposed: false,
      activeWeakPoint: '',
      showInterruptHint: false,
      interruptHintTimer: 0,
    };
  }

  // ========== Boss 生成 ==========

  /** 生成Boss实体 */
  spawnBoss(): Roach {
    const isHard = this.cfg.difficulty === 'hard';
    const bossHp = 10000;
    const boss: Roach = {
      id: nextBossId++,
      x: this.cfg.width / 2,
      y: this.cfg.height * 0.18,
      vx: 0,
      vy: 0,
      type: RoachType.QUEEN,
      hp: bossHp,
      maxHp: bossHp,
      state: RoachState.ALIVE,
      speed: 0.6,
      baseSpeed: 0.6,
      burnDamage: 0,
      inFire: false,
      clusterId: undefined,
      angle: Math.PI / 2,
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.5 + Math.random() * 1,
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
      armorHp: isHard ? 20 : 12,
      maxArmorHp: isHard ? 20 : 12,
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
      homeY: this.cfg.height * 0.18,
      returningHome: false,
      chargeReturnDelay: 0,
      // Boss独立属性
      size: 120,
      reward: 500,
    };
    return boss;
  }

  // ========== Boss 战斗初始化 ==========

  /** 初始化Boss战斗状态与波次配置 */
  initBossBattle(): void {
    this.bossBattle = {
      active: true,
      bossHp: 4,
      bossMaxHp: 4,
      phase: 1,
      phaseName: '第一波:虫卵',
      timeLimit: 180,
      timeRemaining: 180,
      currentWave: 0,
      waveCleared: false,
      waveSpawnTimer: 2,
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
      maxShed: 3,
      isShedding: false,
      shedAnimTimer: 0,
      shedShells: [],
      leftEyeHp: 800,
      leftEyeMaxHp: 800,
      leftEyeDestroyed: false,
      rightEyeHp: 800,
      rightEyeMaxHp: 800,
      rightEyeDestroyed: false,
      bellyHp: 1500,
      bellyMaxHp: 1500,
      bellyExposed: false,
      activeWeakPoint: '',
      showInterruptHint: false,
      interruptHintTimer: 0,
    };

    const boss = this.spawnBoss();
    this.cb.onPushRoach(boss);

    this.bossBattle.phaseJustChanged = true;
    this.bossBattle.phaseChangeTimer = 6;
    this.bossBattle.phaseChangeText = '【螂老大来袭】';
    this.bossBattle.phaseChangeSub = '消灭虫卵和蟑螂!保卫防线!';
    this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 3, '螂老大出现了!', '#ef4444');
    this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 3 + 30, '它正在产卵!消灭虫卵!', '#fbbf24');
    this.cb.onScreenShake(12);
  }

  // ========== Boss 死亡序列 ==========

  /** 集中式Boss死亡序列 - 从updateBossBattle或延迟系统调用 */
  triggerBossDeathSequence(): void {
    const bb = this.bossBattle;
    if (!bb.active || bb.bossKilled) return;

    const boss = this.cb.onGetRoaches().find(r => r.type === RoachType.QUEEN);
    if (!boss) return;

    // 确保死亡状态
    if (boss.state !== RoachState.DEAD) {
      boss.hp = 0;
      boss.state = RoachState.DEAD;
    }
    boss.deathTimer = 999; // 防止updateRoaches移除尸体
    bb.bossHp = 0;

    // 开始死亡动画序列
    bb.bossKilled = true;
    bb.deathAnimTimer = 1.75; // 7帧 at 4fps = 1.75s
    this.bossAnimState.action = 'die';
    this.bossAnimState.frameIndex = 0;
    this.bossAnimState.timer = 0;

    // 死亡效果
    this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 3, '螂老大被消灭了!', '#ef4444');
    this.cb.onSpawnExplosionParticles(boss.x, boss.y, 60);
    this.cb.onSpawnShockwaveRing(boss.x, boss.y, 50);
    this.cb.onScreenShake(25);
  }

  /** 更新死亡序列计时器（动画 → 尸体停留 → 胜利） */
  updateBossDeathSequence(): { triggerVictory?: boolean } {
    const bb = this.bossBattle;
    if (!bb.bossKilled) return {};

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
      bb.corpseStayTimer = 2.0;
      this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 2, '胜利!', '#22c55e');
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
    const boss = this.cb.onGetRoaches().find(r => r.type === RoachType.QUEEN);
    bb.active = false;
    this.cb.onSellUnusedInventory();
    this.cb.onStateChange(GameState.GAME_OVER);
    this.cb.onStopBGM();
    this.cb.onPlayVictoryBGM();
    this.cb.onGetEconomy().highestWave = 1;
    const prog = this.cb.onGetProgress();
    prog.highestWave = Math.max(prog.highestWave, 1);
    this.cb.onSaveProgress();
    this.cb.onGameOver(this.cb.onGetEconomy(), 1);
    if (boss) boss.deathTimer = 0; // 允许下一帧移除
  }

  // ========== Boss 战斗主更新 ==========

  /** 更新Boss战斗逻辑 */
  updateBossBattle(): { spawnEggWave?: number; startBossDialogue?: boolean } {
    const bb = this.bossBattle;
    if (!bb.active && !bb.bossKilled) return {};

    const boss = this.cb.onGetRoaches().find(r => r.type === RoachType.QUEEN);
    if (!boss) {
      const deathResult = this.updateBossDeathSequence();
      return deathResult;
    }

    // ===== Boss逃跑（胜利序列） =====
    if (bb.bossFleeing) {
      bb.bossFleeTimer -= this.cfg.deltaTime;
      boss.y -= 80 * this.cfg.deltaTime;
      boss.x += Math.sin(this.cfg.time * 3) * 30 * this.cfg.deltaTime;
      if (bb.bossFleeTimer <= 0 || boss.y < -200) {
        this.cb.onRemoveRoach(boss);
        bb.active = false;
        this.activeBosses = 0;
        this.cb.onSetActiveBosses(0);
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

    // ===== 4波虫卵系统 =====
    const eggResult = this.updateEggPodSystem();
    if (eggResult.spawnEggWave) {
      // 同步HP显示
      bb.bossHp = Math.max(0, 5 - bb.currentWave);
      this.cb.onBossUpdate?.(bb);
      return { spawnEggWave: eggResult.spawnEggWave };
    }
    if (eggResult.startBossDialogue) {
      bb.bossHp = Math.max(0, 5 - bb.currentWave);
      this.cb.onBossUpdate?.(bb);
      return { startBossDialogue: true };
    }

    // 同步HP显示
    bb.bossHp = Math.max(0, 5 - bb.currentWave);

    // 通知UI
    this.cb.onBossUpdate?.(bb);

    return {};
  }

  // ========== Boss 动画 ==========

  /** 更新Boss动画（悬停） */
  private updateBossAnimation(boss: Roach): void {
    const hoverBaseX = boss.homeX ?? this.cfg.width / 2;
    const hoverAmplitude = 60;
    const targetX = hoverBaseX + Math.sin(this.cfg.time * 1.2 + boss.wobbleOffset) * hoverAmplitude;
    const targetY = (boss.homeY ?? this.cfg.height * 0.15) + Math.sin(this.cfg.time * 2 + boss.wobbleOffset * 2) * 15;
    boss.x += (targetX - boss.x) * 2.0 * this.cfg.deltaTime;
    boss.y += (targetY - boss.y) * 2.0 * this.cfg.deltaTime;

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

    // 检查当前波次是否清除（没有存活的非Boss敌人）
    if (!bb.waveCleared) {
      const livingEnemies = this.cb.onGetLivingNonBossCount();
      if (livingEnemies === 0) {
        bb.waveCleared = true;
        bb.currentWave++;
        bb.bossHp = Math.max(0, 4 - bb.currentWave + 1);
        if (bb.currentWave <= 4) {
          bb.phase = bb.currentWave as 1 | 2 | 3 | 4;
        }
        this.cb.onAddFloatingText(this.cfg.width / 2, this.cfg.height / 3, `第${bb.currentWave}波清除!`, '#22c55e');

        // 检查是否所有4波完成
        if (bb.currentWave > 4) {
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
      bb.bossHp = 4;
      this.startBossSummonCast(1);
    }

    return {};
  }

  /** Boss召唤施法动画 - 虫卵从上方落下 */
  startBossSummonCast(wave: number): void {
    const bb = this.bossBattle;
    const boss = this.cb.onGetRoaches().find(r => r.isBoss);
    const castX = boss ? boss.x : this.cfg.width / 2;
    const castY = boss ? boss.y : this.cfg.height * 0.25;

    bb.summonCastTimer = 2.0;

    const waveNames = ['', '虫卵入侵', '大蟑螂卵', '飞行蟑螂卵', '精英蟑螂卵'];
    bb.phaseChangeText = `【第${wave}波: ${waveNames[wave]}】`;
    bb.phaseChangeSub = 'BOSS正在召唤虫卵...';
    bb.phaseJustChanged = true;
    bb.phaseChangeTimer = 3;

    this.cb.onAddFloatingText(castX, castY - 60, '召唤虫卵!', '#a855f7');
  }

  // ========== Boss 对话与逃跑 ==========

  /** 开始Boss对话（所有波次完成后） */
  startBossDialogue(): void {
    const bb = this.bossBattle;
    const boss = this.cb.onGetRoaches().find(r => r.type === RoachType.QUEEN);
    if (!boss) return;

    bb.bossDialogue = '不...不可能!我的虫卵大军...';
    bb.dialogueTimer = 3;
    bb.dialogueIndex = 0;

    this.cb.onAddFloatingText(boss.x, boss.y - 100, '螂老大: "不...不可能!"', '#ef4444');

    setTimeout(() => {
      if (!bb.active) return;
      this.cb.onAddFloatingText(boss.x, boss.y - 100, '螂老大: "我的虫卵大军...全灭了..."', '#ef4444');
    }, 3000);

    setTimeout(() => {
      if (!bb.active) return;
      this.cb.onAddFloatingText(boss.x, boss.y - 100, '螂老大: "这次算你赢了!我会回来的!"', '#fbbf24');
    }, 6000);

    setTimeout(() => {
      if (!bb.active) return;
      bb.bossFleeing = true;
      bb.bossFleeTimer = 5;
      this.cb.onAddFloatingText(boss.x, boss.y - 80, '螂老大飞走了...', '#9ca3af');
    }, 9000);
  }

  // ========== 安全网检查 ==========

  /** Boss死亡安全网：检查Boss是否已死亡但死亡序列未触发 */
  checkBossDeathSafetyNet(): boolean {
    if (this.cfg.gameMode === GameMode.BOSS && this.bossBattle.active && !this.bossBattle.bossKilled) {
      const boss = this.cb.onGetRoaches().find(r => r.type === RoachType.QUEEN);
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
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(`螂老大 - ${bb.phaseName}`, w / 2, barY - 8);
    ctx.shadowBlur = 0;

    // 4层HP条
    const layerColors = ['#22c55e', '#eab308', '#f97316', '#ef4444'];
    const layerWidth = barW / 4;

    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // 绘制4层
    for (let i = 0; i < 4; i++) {
      const isActive = i < bb.currentWave;
      const lx = barX + i * layerWidth;
      ctx.fillStyle = isActive ? layerColors[i] : 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      const roundL = i === 0 ? 4 : 0;
      const roundR = i === 3 ? 4 : 0;
      ctx.roundRect(lx, barY, layerWidth - 1, barH, [roundL, roundR, roundR, roundL]);
      ctx.fill();

      // 层号
      ctx.fillStyle = isActive ? '#fff' : 'rgba(150,150,150,0.4)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, lx + layerWidth / 2, barY + barH / 2 + 3);

      // 分隔线
      if (i < 3) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx + layerWidth, barY + 3);
        ctx.lineTo(lx + layerWidth, barY + barH - 3);
        ctx.stroke();
      }
    }

    // 波次进度文字
    let waveDisplay = '准备中';
    if (bb.currentWave >= 1 && bb.currentWave <= 4) {
      waveDisplay = `第${bb.currentWave}/4波`;
    } else if (bb.currentWave >= 5) {
      waveDisplay = 'BOSS逃跑中';
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(waveDisplay, w / 2, barY + barH / 2 + 3);
    ctx.shadowBlur = 0;

    // 剩余时间
    const timeText = `剩余时间: ${Math.ceil(bb.timeRemaining)}秒`;
    ctx.fillStyle = bb.timeRemaining < 30 ? '#ef4444' : '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(timeText, w - 20, barY + barH + 18);

    // 阶段切换横幅
    if (bb.phaseJustChanged && bb.phaseChangeTimer > 0) {
      const alpha = Math.min(1, bb.phaseChangeTimer / 1.5);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * alpha})`;
      ctx.fillRect(0, h / 2 - 60, w, 120);
      ctx.fillStyle = `rgba(255, 68, 68, ${alpha})`;
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillText(bb.phaseChangeText, w / 2, h / 2 - 10);
      ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
      ctx.font = 'bold 18px sans-serif';
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

  /** 是否可控制Boss */
  canControlBoss(): boolean {
    return true;
  }
}