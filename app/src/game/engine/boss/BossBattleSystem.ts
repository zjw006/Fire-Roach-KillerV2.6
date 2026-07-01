/**
 * @fileoverview Boss战斗系统模块
 * @description 负责管理游戏中Boss战斗的所有逻辑，包括Boss状态管理、阶段切换、虫卵系统、技能系统等
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

/**
 * Boss战斗系统配置接口
 */
export interface BossBattleSystemConfig {
  /** 游戏状态 */
  gameState: GameState;
  /** 游戏模式 */
  gameMode: GameMode;
  /** 游戏难度 */
  difficulty: 'easy' | 'normal' | 'hard';
  /** 当前场景 */
  currentScene: SceneType;
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 时间增量 */
  deltaTime: number;
  /** 防线血量 */
  defenseHp: number;
  /** 防线最大血量 */
  defenseMaxHp: number;
  /** 屏幕震动强度 */
  screenShake: number;
  /** 浮动文字回调函数 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** Boss状态更新回调函数 */
  onBossUpdate?: (bossState: BossBattleState) => void;
  /** 游戏胜利回调函数 */
  onGameVictory?: () => void;
  /** 游戏失败回调函数 */
  onGameDefeat?: () => void;
}

/**
 * Boss战斗系统类
 * @description 管理Boss战斗的所有逻辑，包括状态管理、阶段切换、虫卵系统、技能系统等
 */
export class BossBattleSystem {
  /** 系统配置 */
  private config: BossBattleSystemConfig;
  
  /** Boss战斗状态 */
  private bossBattle: BossBattleState;
  
  /** Boss动画状态 */
  private bossAnimState: {
    action: string;
    frameIndex: number;
    timer: number;
  };
  
  /** Boss动画帧数据 */
  private bossAnimFrames: Map<string, HTMLImageElement[]>;
  

  
  /** 全局Boss ID计数器 */
  private nextBossId: number = 10000;
  
  /**
   * 构造函数
   * @param config 系统配置
   */
  constructor(config: BossBattleSystemConfig) {
    this.config = config;
    this.bossBattle = this.createDefaultBossState();
    this.bossAnimState = {
      action: 'idle',
      frameIndex: 0,
      timer: 0
    };
    this.bossAnimFrames = new Map();
    
    // 初始化动画帧
    this.initBossAnimations();
  }
  
  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<BossBattleSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 初始化Boss战斗
   * @returns 初始化后的Boss状态
   */
  initBossBattle(): BossBattleState {
    // 重置Boss状态
    this.bossBattle = this.createDefaultBossState();
    
    // 设置初始阶段
    this.bossBattle.active = true;
    this.bossBattle.bossHp = 4;
    this.bossBattle.bossMaxHp = 4;
    this.bossBattle.phase = 1;
    this.bossBattle.phaseName = '第一波:虫卵';
    this.bossBattle.timeLimit = 180;
    this.bossBattle.timeRemaining = 180;
    
    // 阶段切换标志
    this.bossBattle.phaseJustChanged = true;
    this.bossBattle.phaseChangeTimer = 6;
    this.bossBattle.phaseChangeText = '【螂老大来袭】';
    this.bossBattle.phaseChangeSub = '消灭虫卵和蟑螂!保卫防线!';
    
    // 通知回调
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 3,
        '螂老大出现了!',
        '#ef4444'
      );
      this.config.onAddFloatingText(
        this.config.canvasWidth / 2,
        this.config.canvasHeight / 3 + 30,
        '它正在产卵!消灭虫卵!',
        '#fbbf24'
      );
    }
    
    // 屏幕震动
    this.config.screenShake = 12;
    
    return this.bossBattle;
  }
  
  /**
   * 更新Boss战斗逻辑
   * @param roaches 当前蟑螂数组
   * @returns 更新后的Boss状态和需要执行的行动
   */
  updateBossBattle(roaches: Roach[]): {
    bossState: BossBattleState;
    actions: {
      spawnBoss?: boolean;
      spawnEggWave?: { wave: number };
      triggerDeathSequence?: boolean;
      updateScreenShake?: number;
    };
  } {
    const bb = this.bossBattle;
    const actions: any = {};
    
    // 检查Boss是否激活
    if (!bb.active && !bb.bossKilled) {
      return { bossState: bb, actions: {} };
    }
    
    // 查找Boss实体
    const boss = roaches.find(r => r.type === RoachType.QUEEN);
    
    // Boss不存在但战斗激活，触发死亡序列
    if (!boss && bb.active) {
      this.triggerBossDeathSequence();
      return { 
        bossState: this.bossBattle, 
        actions: { triggerDeathSequence: true } 
      };
    }
    
    // 处理Boss逃跑（胜利序列）
    if (bb.bossFleeing) {
      this.updateBossFleeing(boss!);
      return { bossState: bb, actions: {} };
    }
    
    // 处理Boss死亡序列
    if (bb.bossKilled) {
      this.updateBossDeathSequence();
      return { bossState: bb, actions: {} };
    }
    
    // 检查防线失败
    if (this.config.defenseHp <= 0) {
      if (this.config.onGameDefeat) {
        this.config.onGameDefeat();
      }
      return { bossState: bb, actions: {} };
    }
    
    // 时间限制检查
    bb.timeRemaining -= this.config.deltaTime;
    if (bb.timeRemaining <= 0) {
      this.config.defenseHp = 0;
      if (this.config.onGameDefeat) {
        this.config.onGameDefeat();
      }
      return { bossState: bb, actions: {} };
    }
    
    // 更新阶段切换横幅
    if (bb.phaseChangeTimer > 0) {
      bb.phaseChangeTimer -= this.config.deltaTime;
      if (bb.phaseChangeTimer <= 0) {
        bb.phaseJustChanged = false;
      }
    }
    
    // 更新Boss动画（悬停）
    this.updateBossAnimation(boss!);
    
    // 更新虫卵系统
    const eggSystemResult = this.updateEggPodSystem(roaches);
    if (eggSystemResult.spawnEggWave) {
      actions.spawnEggWave = { wave: eggSystemResult.spawnEggWave };
    }
    
    // 同步HP显示（4层）- 随着波次清除而减少
    bb.bossHp = Math.max(0, 5 - bb.currentWave);
    
    // 通知UI
    if (this.config.onBossUpdate) {
      this.config.onBossUpdate(bb);
    }
    
    return { bossState: bb, actions };
  }
  
  /**
   * 生成Boss实体
   * @returns Boss实体数据
   */
  spawnBoss(): Roach {
    const isHard = this.config.difficulty === 'hard';
    const bossHp = 10000;
    
    const boss: Roach = {
      id: this.nextBossId++,
      x: this.config.canvasWidth / 2,
      y: this.config.canvasHeight * 0.18,
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
      homeX: this.config.canvasWidth / 2,
      homeY: this.config.canvasHeight * 0.18,
      returningHome: false,
      chargeReturnDelay: 0,
      // Boss独立属性
      size: 120,
      reward: 500
    };
    
    return boss;
  }
  
  /**
   * 触发Boss死亡序列
   */
  triggerBossDeathSequence(): void {
    const bb = this.bossBattle;
    
    if (!bb.active || bb.bossKilled) {
      return; // 已经触发或战斗结束
    }
    
    // 设置死亡标志
    bb.bossKilled = true;
    bb.deathAnimTimer = 2.0;
    bb.corpseStayTimer = 3.0;
    
    // 停止Boss移动
    // 实际停止逻辑在实体更新中处理
  }
  
  /**
   * 获取当前Boss状态
   * @returns Boss战斗状态
   */
  getBossState(): BossBattleState {
    return { ...this.bossBattle };
  }
  
  /**
   * 设置Boss状态
   * @param state 新的Boss状态
   */
  setBossState(state: Partial<BossBattleState>): void {
    this.bossBattle = { ...this.bossBattle, ...state };
  }
  
  /**
   * 创建默认Boss状态
   * @returns 默认Boss状态
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
      leftEyeHp: 0,
      leftEyeMaxHp: 0,
      leftEyeDestroyed: false,
      rightEyeHp: 0,
      rightEyeMaxHp: 0,
      rightEyeDestroyed: false,
      bellyHp: 0,
      bellyMaxHp: 0,
      bellyExposed: false,
      activeWeakPoint: '',
      showInterruptHint: false,
      interruptHintTimer: 0,
    };
  }
  

  
  /**
   * 初始化Boss动画
   */
  private initBossAnimations(): void {
    // 加载Boss动画帧
    // 这里简化处理，实际项目中需要加载图片资源
    const actions = ['idle', 'hover', 'charge', 'stun', 'death'];
    
    for (const action of actions) {
      this.bossAnimFrames.set(action, []);
    }
  }
  
  /**
   * 更新Boss逃跑逻辑
   * @param boss Boss实体
   */
  private updateBossFleeing(boss: Roach): void {
    const bb = this.bossBattle;
    
    bb.bossFleeTimer -= this.config.deltaTime;
    
    // Boss向上飞并消失
    boss.y -= 80 * this.config.deltaTime;
    boss.x += Math.sin(this.config.deltaTime * 3) * 30 * this.config.deltaTime;
    
    if (bb.bossFleeTimer <= 0 || boss.y < -200) {
      // 从游戏中移除Boss
      bb.active = false;
      
      // 触发胜利
      if (this.config.onGameVictory) {
        this.config.onGameVictory();
      }
    }
  }
  
  /**
   * 更新Boss死亡序列
   */
  private updateBossDeathSequence(): void {
    const bb = this.bossBattle;
    
    if (!bb.bossKilled) return;
    
    // 更新死亡动画计时器
    if (bb.deathAnimTimer > 0) {
      bb.deathAnimTimer -= this.config.deltaTime;
      
      if (bb.deathAnimTimer <= 0) {
        // 死亡动画结束，开始尸体停留
        bb.corpseStayTimer = 3.0;
      }
    }
    
    // 更新尸体停留计时器
    if (bb.corpseStayTimer > 0) {
      bb.corpseStayTimer -= this.config.deltaTime;
      
      if (bb.corpseStayTimer <= 0) {
        // 尸体停留结束，Boss逃跑（胜利序列）
        bb.bossFleeing = true;
        bb.bossFleeTimer = 2.0;
      }
    }
  }
  
  /**
   * 更新Boss动画
   * @param boss Boss实体
   */
  private updateBossAnimation(boss: Roach): void {
    // 悬停动画
    const hoverBaseX = boss.homeX ?? this.config.canvasWidth / 2;
    const hoverAmplitude = 60;
    const targetX = hoverBaseX + Math.sin(this.config.deltaTime * 1.2 + boss.wobbleOffset) * hoverAmplitude;
    const targetY = (boss.homeY ?? this.config.canvasHeight * 0.15) + 
                   Math.sin(this.config.deltaTime * 2 + boss.wobbleOffset * 2) * 15;
    
    boss.x += (targetX - boss.x) * 2.0 * this.config.deltaTime;
    boss.y += (targetY - boss.y) * 2.0 * this.config.deltaTime;
    
    // 更新动画状态
    let newAction = 'hover';
    if (boss.isStunned) newAction = 'stun';
    
    if (newAction !== this.bossAnimState.action) {
      this.bossAnimState.action = newAction;
      this.bossAnimState.frameIndex = 0;
      this.bossAnimState.timer = 0;
    }
    
    // 更新动画帧
    const animConfig = BOSS_ANIMATIONS[this.bossAnimState.action as keyof typeof BOSS_ANIMATIONS];
    if (animConfig) {
      this.bossAnimState.timer += this.config.deltaTime * 1000;
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
  
  /**
   * 更新虫卵系统
   * @param _roaches 当前蟑螂数组
   * @returns 更新结果
   */
  private updateEggPodSystem(_roaches: Roach[]): {
    spawnEggWave?: number;
  } {
    const bb = this.bossBattle;
    const result: any = {};
    
    // 检查波次是否已清除
    if (bb.waveCleared) {
      // 波次已清除，准备下一波
      bb.currentWave++;
      bb.waveCleared = false;
      bb.waveSpawnTimer = 2.0;
      
      // 如果所有波次都完成，触发胜利
      if (bb.currentWave >= 5) {
        this.triggerBossDeathSequence();
        return result;
      }
      
      // 生成虫卵波次
      if (bb.currentWave <= 4) {
        result.spawnEggWave = bb.currentWave;
      }
    }
    
    // 更新波次生成计时器
    if (bb.waveSpawnTimer > 0) {
      bb.waveSpawnTimer -= this.config.deltaTime;
      
      if (bb.waveSpawnTimer <= 0 && bb.currentWave <= 4) {
        // 生成虫卵波次
        result.spawnEggWave = bb.currentWave;
      }
    }
    
    return result;
  }
  
  /**
   * 获取Boss动画状态
   * @returns 动画状态
   */
  getBossAnimationState(): {
    action: string;
    frameIndex: number;
    timer: number;
  } {
    return { ...this.bossAnimState };
  }
  
  /**
   * 设置Boss动画状态
   * @param state 动画状态
   */
  setBossAnimationState(state: Partial<{
    action: string;
    frameIndex: number;
    timer: number;
  }>): void {
    this.bossAnimState = { ...this.bossAnimState, ...state };
  }
}