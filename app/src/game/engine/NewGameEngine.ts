/**
 * @fileoverview 新的游戏引擎类
 * @description 使用模块化架构的游戏引擎，集成所有拆分后的模块
 */

import { 
  GameState, 
  GameMode, 
  SceneType, 
  WeatherType,
  RoachState,
  RoachType,
  type Player, 
  type Economy, 
  type GameProgress,
  type Roach
} from '../types';

// 导入模块管理器
import { EconomyManager } from './economy/EconomyManager';
import { WaveManager } from './wave/WaveManager';
import { EntityManager } from './entity/EntityManager';
import { RenderManager } from './render/RenderManager';

// 导入新系统模块
import { CollisionSystem } from './collision/CollisionSystem';
import { WeaponSystem } from './weapon/WeaponSystem';
import { ParticleSystem } from './particle/ParticleSystem';
import { RoachAISystem } from './ai/RoachAISystem';

// 导入最新创建的模块
import { BossBattleSystem } from './boss/BossBattleSystem';
import { ThrowableSystem } from './throwable/ThrowableSystem';
import { StickySystem } from './sticky/StickySystem';
import { AimingSystem } from './aiming/AimingSystem';
import { TripleFlameSystem } from './triple/TripleFlameSystem';
import { RadarLaserSystem } from './radar/RadarLaserSystem';
import { FanSystem } from './fan/FanSystem';
import { ConsumableSystem } from './consumable/ConsumableSystem';
import { WeatherSystem } from './weather/WeatherSystem';
import { ItemSystem } from './item/ItemSystem';
import { AchievementSystem } from './achievement/AchievementSystem';
import { StatsSystem } from './stats/StatsSystem';

// 导入新创建的高级优先级模块
import { PlayerControlSystem } from './player/PlayerControlSystem';
import { DefenseCheckSystem } from './defense/DefenseCheckSystem';

// 导入中级优先级模块
import { ItemManagementSystem } from './item/ItemManagementSystem';

// 导入UI模块
import { UIManager } from './ui/UIManager';

// 导入工具模块
import { PerformanceMonitor } from './utils/PerformanceUtils';
import { PerformanceMonitorSystem } from './performance';

// 导入音频管理器
import { AudioManager } from '../audio';

/**
 * 新游戏引擎配置接口
 */
export interface NewGameEngineConfig {
  /** 画布元素 */
  canvas: HTMLCanvasElement;
  /** 画布上下文 */
  ctx: CanvasRenderingContext2D;
  /** 游戏模式 */
  gameMode: GameMode;
  /** 难度 */
  difficulty: 'easy' | 'hard';
  /** 当前场景 */
  currentScene: SceneType;
  /** 音频管理器 */
  audio?: AudioManager;
  /** 输入处理器 */
  inputHandler?: InputHandler;
}

/**
 * 输入处理器接口
 */
export interface InputHandler {
  /** 鼠标X坐标 */
  mouseX: number;
  /** 鼠标Y坐标 */
  mouseY: number;
  /** 是否正在开火 */
  isFiring: boolean;
  /** 鼠标是否按下 */
  isMouseDown: boolean;
  /** 按键状态 */
  keys: Record<string, boolean>;
  /** 更新鼠标位置 */
  updateMousePosition(x: number, y: number): void;
  /** 设置开火状态 */
  setFiring(firing: boolean): void;
  /** 设置鼠标按下状态 */
  setMouseDown(down: boolean): void;
  /** 设置按键状态 */
  setKey(key: string, pressed: boolean): void;
  /** 检查按键是否按下 */
  isKeyPressed(key: string): boolean;
  /** 重置输入状态 */
  reset(): void;
}

/**
 * 新游戏引擎类
 * @description 使用模块化架构的游戏引擎
 */
export class NewGameEngine {
  // 核心属性
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState = GameState.MENU;
  private gameMode: GameMode;
  private difficulty: 'easy' | 'hard';
  private currentScene: SceneType;
  private audio: AudioManager;

  // 游戏状态
  private player: Player;
  private economy: Economy;
  private progress: GameProgress;
  private currentWave: number = 1;
  private defenseHp: number = 100;
  private maxDefenseHp: number = 100;
  private screenShake: number = 0;
  private gameTime: number = 0;
  
  // 波次状态
  private wave: number = 1;
  
  // 倒计时状态
  private countdownTimer: number = 0;
  private countdownPhase: number = 3; // 3, 2, 1
  // @ts-ignore - 变量在startCountdown和doWaveSpawn方法中使用
  private countdownWavePending: boolean = false; // 当倒计时应该在波次前触发时为true
  
  // 生成状态
  private spawnTimer: number = 0;
  
  // 模块管理器
  private economyManager: EconomyManager;
  private waveManager: WaveManager;
  private entityManager: EntityManager;
  private renderManager: RenderManager;
  private uiManager: UIManager;
  
  // 新系统模块
  private collisionSystem: CollisionSystem;
  private weaponSystem: WeaponSystem;
  private particleSystem: ParticleSystem;
  private roachAISystem: RoachAISystem;
  
  // 最新创建的模块
  private bossBattleSystem: BossBattleSystem;
  private throwableSystem: ThrowableSystem;
  private stickySystem: StickySystem;
  private aimingSystem: AimingSystem;
  private tripleFlameSystem: TripleFlameSystem;
  private radarLaserSystem: RadarLaserSystem;
  private fanSystem: FanSystem;
  private consumableSystem: ConsumableSystem;
  private weatherSystem: WeatherSystem;
  private itemSystem: ItemSystem;
  private achievementSystem: AchievementSystem;
  private statsSystem: StatsSystem;
  
  // 高级优先级模块
  private playerControlSystem: PlayerControlSystem;
  private defenseCheckSystem: DefenseCheckSystem;
  
  // 中级优先级模块
  private itemManagementSystem: ItemManagementSystem;
  
  // 输入处理器
  private inputHandler: InputHandler;
  
  // 状态变化回调
  private onStateChange?: (state: GameState) => void;
  
  // 性能监控
  private performanceMonitor: PerformanceMonitor;
  private performanceMonitorSystem: PerformanceMonitorSystem;

  // 游戏循环控制
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private animationFrameId: number = 0;

  /**
   * 构造函数
   * @param config - 引擎配置
   */
  constructor(config: NewGameEngineConfig) {
    this.canvas = config.canvas;
    this.ctx = config.ctx;
    this.gameMode = config.gameMode;
    this.difficulty = config.difficulty;
    this.currentScene = config.currentScene;
    this.audio = config.audio || new AudioManager();

    // 初始化游戏状态
    this.player = this.createPlayer();
    this.economy = this.createEconomy();
    this.progress = this.createDefaultProgress();

    // 初始化模块管理器
    this.economyManager = new EconomyManager(this.economy);
    this.waveManager = new WaveManager(this.currentScene, this.gameMode, this.difficulty);
    this.entityManager = new EntityManager(this.canvas.width, this.canvas.height, () => this.getDefenseLineY(), this.currentScene);
    this.renderManager = new RenderManager({
      ctx: this.ctx,
      width: this.canvas.width,
      height: this.canvas.height,
      getDefenseLineY: () => this.getDefenseLineY()
    });
    
    // 初始化新系统模块
    this.collisionSystem = new CollisionSystem({
      difficulty: this.difficulty,
      gameState: this.state,
    });
    
    this.weaponSystem = new WeaponSystem({
      difficulty: this.difficulty,
      gameState: this.state,
      gameMode: this.gameMode,
      currentScene: this.currentScene,
      unlockedWeapons: this.progress.weaponsUnlocked || ['flamethrower'],
      selectedItems: [],
    });
    
    this.particleSystem = new ParticleSystem({
      particleLimit: 300,
      deltaTime: 0,
      defenseLineY: this.getDefenseLineY(),
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
    });

    // 初始化蟑螂AI系统
    this.roachAISystem = new RoachAISystem({
      gameState: this.state,
      difficulty: this.difficulty,
      defenseLineY: this.getDefenseLineY(),
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      deltaTime: 0,
      playerX: this.player.x,
      playerY: this.player.y,
    });
    
    // 设置RoachAISystem回调
    this.roachAISystem.onPlaySound = (soundId: string) => {
      this.playSoundById(soundId);
    };
    this.roachAISystem.onVibrate = (pattern: number | number[]) => {
      this.audio.vibrate(pattern);
    };
    this.roachAISystem.onAddParticle = (particle: any) => {
      this.particleSystem.addParticle(particle);
    };
    this.roachAISystem.addFloatingText = (x: number, y: number, text: string, color: string, duration?: number) => {
      this.addFloatingText(x, y, text, color, duration);
    };
    this.roachAISystem.spawnEmbryoRoaches = (roach: Roach) => {
      try { this.entityManager.spawnEmbryoRoaches?.(roach); } catch (e) { /* ignore */ }
    };
    this.roachAISystem.onGetAllRoaches = () => {
      return this.entityManager.getRoaches();
    };
    this.roachAISystem.onGetFireWalls = () => {
      try {
        const ps = this.particleSystem.update([]);
        return ps.fireWalls;
      } catch (e) { return []; }
    };
    this.roachAISystem.onGetBaitTarget = () => {
      return this.player.baitTimer > 0 ? { active: true, x: this.player.x, y: this.player.y - 100 } : null;
    };
    this.roachAISystem.onGetStickyBoards = () => {
      try { return this.stickySystem.getStickyBoards(); } catch (e) { return []; }
    };
    this.roachAISystem.onQueenSpawn = (roach: Roach) => {
      try { this.entityManager.spawnQueenEggs?.(roach); } catch (e) { /* ignore */ }
    };
    this.roachAISystem.generateWingDebrisParticles = (roach: Roach) => {
      this.particleSystem.spawnExplosionParticles(roach.x, roach.y, 5);
    };
    this.roachAISystem.onTriggerBreachExplosion = (roach: Roach) => {
      this.defenseHp -= 30;
      this.screenShake = Math.max(this.screenShake, 8);
      this.vibrateSuicideExplode();
    };
    this.roachAISystem.onArmorBroken = (roach: Roach) => {
      this.particleSystem.spawnExplosionParticles(roach.x, roach.y, 15);
    };
    this.roachAISystem.spawnSparkParticles = (x: number, y: number, count: number) => {
      this.particleSystem.spawnExplosionParticles(x, y, Math.max(1, Math.round(count / 3)));
    };
    
    // 初始化最新创建的模块
    this.bossBattleSystem = new BossBattleSystem({
      gameState: this.state,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      currentScene: this.currentScene,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      deltaTime: 0,
      defenseHp: this.defenseHp,
      defenseMaxHp: this.maxDefenseHp,
      screenShake: this.screenShake,
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
      onGameDefeat: () => {
        this.gameOver('defense_destroyed');
      },
    });
    
    this.throwableSystem = new ThrowableSystem({
      deltaTime: 0,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      screenShake: this.screenShake,
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
      onAddFireZone: (fireZone) => {
        this.particleSystem.addFireZone({
          x: fireZone.x,
          y: fireZone.y,
          radius: fireZone.radius,
          damagePerSecond: fireZone.damagePerSecond,
          life: fireZone.life,
        });
      },
      onSpawnExplosionParticles: (x, y, count) => {
        this.particleSystem.spawnExplosionParticles(x, y, Math.max(1, Math.round(count / 3)));
      },
      onUpdateScreenShake: (shake) => {
        this.screenShake = Math.max(this.screenShake, shake);
      },
    });
    
    this.stickySystem = new StickySystem({
      deltaTime: 0,
      gameTime: 0,
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
      onAddParticle: (particle) => {
        this.particleSystem.addParticle(particle);
      },
    });
    
    this.aimingSystem = new AimingSystem({
      gameTime: 0,
      playerX: this.player.x,
      playerY: this.player.y,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      defenseLineY: this.getDefenseLineY(),
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
      onPlaySound: (soundId) => {
        this.playSoundById(soundId);
      },
    });
    
    this.tripleFlameSystem = new TripleFlameSystem({
      deltaTime: 0,
      playerX: this.player.x,
      playerY: this.player.y,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
      onPlaySound: (soundId) => {
        this.playSoundById(soundId);
      },
      onVibrate: () => {
        this.screenShake = Math.max(this.screenShake, 3);
        this.vibrateExplode();
      },
    });
    
    this.radarLaserSystem = new RadarLaserSystem({
      deltaTime: 0,
      playerX: this.player.x,
      playerY: this.player.y,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
      onPlaySound: (soundId) => {
        this.playSoundById(soundId);
      },
      onAddParticle: (particle) => {
        this.particleSystem.addParticle(particle);
      },
    });
    
    this.fanSystem = new FanSystem({
      deltaTime: 0,
      defenseLineY: () => this.getDefenseLineY(),
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
      onStartFanLoop: () => {
        this.startFanLoop();
      },
      onStopFanLoop: () => {
        this.stopFanLoop();
      },
      onVibrate: () => {
        this.screenShake = Math.max(this.screenShake, 3);
        this.vibrateExplode();
      },
    });
    
    this.consumableSystem = new ConsumableSystem({
      deltaTime: 0,
      defenseLineY: () => this.getDefenseLineY(),
      maxDefenseHp: this.maxDefenseHp,
      defenseHp: this.defenseHp,
      player: this.player,
      gameState: this.state,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      onAddFloatingText: (x, y, text, color, duration, fontSize) => {
        this.addFloatingText(x, y, text, color, duration, fontSize);
      },
      onPlayerUpdate: (player) => {
        this.player = player;
      },
      onDefenseUpdate: (defenseHp, maxDefenseHp) => {
        this.defenseHp = defenseHp;
        this.maxDefenseHp = maxDefenseHp;
      },
    });
    
    this.weatherSystem = new WeatherSystem({
      deltaTime: 0,
      weather: WeatherType.NONE,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      onAddParticle: (particle) => {
        this.particleSystem.addParticle(particle);
      },
    });
    
    this.itemSystem = new ItemSystem({
      deltaTime: 0,
      currentScene: this.currentScene,
      gameState: this.state,
      defenseLineY: () => this.getDefenseLineY(),
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      onPlaySound: (soundId) => {
        this.playSoundById(soundId);
      },
      onAddFloatingText: (x, y, text, color, duration) => {
        this.addFloatingText(x, y, text, color, duration);
      },
      onStateChange: (state) => {
        this.state = state;
      },
    });
    
    this.achievementSystem = new AchievementSystem({
      economyStats: {
        totalKills: this.economy.totalKills,
        highestWave: this.economy.highestWave,
        highestEndlessWave: this.economy.highestEndlessWave,
        totalMoneyEarned: this.economy.totalMoneyEarned,
        perfectWaves: this.economy.perfectWaves,
        breaches: this.economy.breaches,
        queenKills: this.economy.queenKills,
        flyingKills: this.economy.flyingKills,
        armoredKills: this.economy.armoredKills,
      },
      playerProgress: {
        achievements: this.progress.achievements as any,
        weaponsUnlocked: this.progress.weaponsUnlocked,
        talentTree: this.progress.talentTree,
      },
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
    });
    
    this.statsSystem = new StatsSystem({
      initialStats: {
        totalGamesPlayed: this.economy.totalGamesPlayed,
        totalMoneyEarned: this.economy.totalMoneyEarned,
        totalDamage: this.economy.totalDamage,
        totalMoneySpent: this.economy.totalMoneySpent,
        totalConsumablesUsed: this.economy.totalConsumablesUsed,
        totalWeaponsUnlocked: this.economy.totalWeaponsUnlocked,
        totalUpgradesPurchased: this.economy.totalUpgradesPurchased,
        totalAchievements: this.economy.totalAchievements,
        totalKills: this.economy.totalKills,
        highestWave: this.economy.highestWave,
        highestEndlessWave: this.economy.highestEndlessWave,
        perfectWaves: this.economy.perfectWaves,
        breaches: this.economy.breaches,
        queenKills: this.economy.queenKills,
        flyingKills: this.economy.flyingKills,
        armoredKills: this.economy.armoredKills,
        gasCanistersUsed: this.economy.gasCanistersUsed,
      },
    });
    
    // 初始化高级优先级模块
    this.playerControlSystem = new PlayerControlSystem({
      difficulty: this.difficulty,
      gameState: this.state,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      deltaTime: 0,
      mouseX: this.canvas.width / 2,
      mouseY: this.canvas.height / 2,
      isFiring: false,
      tutorialPauseSpawn: false,
      onAddFloatingText: (x, y, text, color, duration, fontSize) => {
        this.addFloatingText(x, y, text, color, duration, fontSize);
      },
      onAddParticle: (particle) => {
        this.particleSystem.addParticle(particle);
      },
      onPlaySound: (soundId) => {
        this.playSoundById(soundId);
      },
      onStopSound: (soundId) => {
        this.stopSoundById(soundId);
      },
      onVibrate: () => {
        this.screenShake = Math.max(this.screenShake, 3);
        this.vibrateFire();
      },
      onPlayerUpdate: (player) => {
        this.player = player;
      },
      onSpawnConeFire: (params: {
        x: number; y: number; angle: number; range: number;
        spreadAngle: number; innerCount: number; outerCount: number; deltaTime: number;
      }) => {
        // 从旧引擎移植的锥形火焰粒子生成算法
        const player = this.playerControlSystem.getPlayer();
        const powerBoostMult = player.powerBoostTimer > 0 ? 2 : 1;
        const baseDamage = (this.difficulty === 'hard' ? 200 : 300) * params.deltaTime * player.damageMultiplier * powerBoostMult;
        this.particleSystem.spawnConeFire({
          x: params.x,
          y: params.y,
          angle: params.angle,
          range: params.range * 0.5, // 老引擎中实际射程是 fireRange * 0.5
          spreadAngle: (Math.PI / 15) * player.flameSpreadMultiplier,
          baseDamage,
          type: 'fire',
        });
      },
    });
    
    this.defenseCheckSystem = new DefenseCheckSystem({
      gameState: this.state,
      defenseLineY: this.getDefenseLineY(),
      defenseHp: this.defenseHp,
      maxDefenseHp: this.maxDefenseHp,
      deltaTime: 0,
      onGameDefeat: () => {
        this.gameOver('defense_destroyed');
      },
      onDefenseUpdate: (hp, maxHp) => {
        this.defenseHp = hp;
        this.maxDefenseHp = maxHp;
      },
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
    });
    
    // 初始化中级优先级模块
    this.itemManagementSystem = new ItemManagementSystem({
      currentScene: this.currentScene,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      gameProgress: this.progress,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      defenseLineY: this.getDefenseLineY(),
      onAddFloatingText: (x, y, text, color) => {
        this.addFloatingText(x, y, text, color);
      },
      onPlaySound: (soundId) => {
        if (soundId === 'pickup') {
          this.audio.playKill();
        } else if (soundId === 'item_drop_fanfare') {
          this.audio.playItemDropFanfare();
        }
      },
      onStateChange: (state) => {
        if (state === 'item_reveal_complete') {
          // 所有道具揭示完成，进入波次清除状态
          this.state = GameState.WAVE_CLEAR;
          this.onStateChange?.(this.state);
          // 启动下一波
          this.waveManager.startWave();
          this.currentWave = this.waveManager.wave;
          // 重新开始倒计时
          this.startCountdown(() => {
            this.doWaveSpawn();
          });
        }
      },
    });
    
    // 初始化UI管理器
    this.uiManager = new UIManager({
      ctx: this.ctx,
      width: this.canvas.width,
      height: this.canvas.height
    });
    
    // 初始化输入处理器
    this.inputHandler = config.inputHandler || this.createDefaultInputHandler();
    
    // 初始化性能监控器
    this.performanceMonitor = new PerformanceMonitor();
    
    // 初始化性能监控系统
    this.performanceMonitorSystem = new PerformanceMonitorSystem({
      currentScene: this.currentScene,
      gameMode: this.gameMode,
      enableDetailedLogs: false,
    });
  }
  
  /**
   * 创建默认输入处理器
   * @returns 默认输入处理器
   */
  private createDefaultInputHandler(): InputHandler {
    return {
      mouseX: this.canvas.width / 2,
      mouseY: this.canvas.height / 2,
      isFiring: false,
      isMouseDown: false,
      keys: {},
      
      updateMousePosition(x: number, y: number): void {
        this.mouseX = x;
        this.mouseY = y;
      },
      
      setFiring(firing: boolean): void {
        this.isFiring = firing;
      },
      
      setMouseDown(down: boolean): void {
        this.isMouseDown = down;
      },
      
      setKey(key: string, pressed: boolean): void {
        this.keys[key] = pressed;
      },
      
      isKeyPressed(key: string): boolean {
        return !!this.keys[key];
      },
      
      reset(): void {
        this.isFiring = false;
        this.isMouseDown = false;
        this.keys = {};
      }
    };
  }

  private addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    duration: number = 2000,
    fontSize: number = 16
  ): void {
    const lifeSeconds = Math.max(0.1, duration / 1000);
    const scale = Math.max(0.5, fontSize / 16);
    this.particleSystem.addFloatingText({
      x,
      y,
      text,
      color,
      life: lifeSeconds,
      scale,
    });
  }

  private playSoundById(soundId: string): void {
    switch (soundId) {
      case 'fire':
        this.playFire();
        break;
      case 'reload':
        this.playReload();
        break;
      case 'kill':
        this.playKill();
        break;
      case 'molotov_throw':
        this.playMolotovThrow();
        break;
      case 'item_drop_fanfare':
        this.playItemDropFanfare();
        break;
      case 'nurse_cast':
        this.audio.playNurseCast?.();
        break;
      case 'mutant_transform':
        this.audio.playMutantTransform?.();
        break;
      case 'suicide_explode':
        this.vibrateSuicideExplode();
        break;
      case 'flying_death':
        this.audio.playFlyingDeath?.();
        break;
      case 'fan_loop':
        this.startFanLoop();
        break;
      case 'fire_wall_burn':
        this.startFireWallBurn();
        break;
      case 'flying_buzz':
        this.playFlyingBuzz();
        break;
      case 'flying_dodge':
        this.playFlyingDodge();
        break;
      case 'breach_ground':
        this.playSuicideBreachGround();
        break;
      case 'breach_flying':
        this.playSuicideBreachFlying();
        break;
      case 'pickup':
        this.playKill();
        break;
      case 'countdown_tick':
        this.audio.playCountdownTick();
        break;
      case 'victory':
        this.playVictoryBGM();
        break;
      case 'game_over':
        this.playGameOverBGM();
        break;
      case 'click':
        this.playClick();
        break;
      case 'swatter':
        this.playSwatter();
        break;
    }
  }

  private stopSoundById(soundId: string): void {
    switch (soundId) {
      case 'fire':
        this.stopFire();
        break;
    }
  }

  /**
   * 创建玩家对象
   * @returns 玩家对象
   */
  private createPlayer(): Player {
    return {
      x: this.canvas.width / 2,
      y: this.canvas.height - 100,
      angle: -Math.PI / 2,
      isFiring: false,
      flameMode: 'cone',
      gas: 100,
      maxGas: 100,
      heat: 0,
      maxHeat: 1800,
      overheatTimer: 0,
      isOverheated: false,
      isReloading: false,
      reloadTimer: 0,
      maxReloadTime: 8,
      coolingTimer: 0,
      fireRange: 440,
      damageMultiplier: 1,
      heatDecayRate: 1.5,
      overheatThreshold: 1800,
      gasCostMultiplier: 1,
      currentWeapon: 'flamethrower',
      weaponAmmo: { flamethrower: Infinity },
      weaponTimer: 0,
      isTempWeapon: false,
      shotgunPellets: 5,
      molotovCount: 0,
      shieldActive: false,
      shieldHp: 0,
      damageReduction: 0,
      paralyzeTimer: 0,
      heatWarningTimer: 0,
      powerBoostTimer: 0,
      shieldTimer: 0,
      baitTimer: 0,
      flameSpreadMultiplier: 1,
      reloadTimeMultiplier: 1,
      weaponsUnlocked: ['flamethrower'],
      money: 0
    };
  }

  /**
   * 创建经济统计对象
   * @returns 经济统计对象
   */
  private createEconomy(): Economy {
    return {
      money: this.difficulty === 'hard' ? 100 : 200,
      totalKills: 0,
      smallKills: 0,
      largeKills: 0,
      flyingKills: 0,
      armoredKills: 0,
      splittingKills: 0,
      suicideKills: 0,
      flyingSuicideKills: 0,
      queenKills: 0,
      nurseKills: 0,
      mutantKills: 0,
      timedSuicideKills: 0,
      perfectWaves: 0,
      gasSavedBonus: 0,
      breaches: 0,
      gasCanistersUsed: 0,
      highestWave: 0,
      highestEndlessWave: 0,
      totalGamesPlayed: 0,
      totalMoneyEarned: 0,
      totalDamage: 0,
      totalMoneySpent: 0,
      totalConsumablesUsed: 0,
      totalWeaponsUnlocked: 0,
      totalUpgradesPurchased: 0,
      totalAchievements: 0
    };
  }

  /**
   * 创建默认游戏进度
   * @returns 游戏进度对象
   */
  private createDefaultProgress(): GameProgress {
    return {
      saveVersion: 3,
      highestWave: 0,
      totalKills: 0,
      scenesUnlocked: [SceneType.KITCHEN],
      scenesCompleted: [],
      weaponsUnlocked: ['flamethrower'],

      highestEndlessWave: 0,
      shopUpgrades: [],

      talentTree: {
        points: 0,
        talents: {}
      },
      achievements: [],
      encyclopedia: {
        entries: []
      }
    };
  }

  /**
   * 获取防御线Y坐标
   * @returns 防御线Y坐标
   */
  private getDefenseLineY(): number {
    return this.canvas.height - 130;
  }

  /**
   * 启动游戏引擎
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * 停止游戏引擎
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  /**
   * 游戏主循环
   */
  private gameLoop(): void {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    this.gameTime += deltaTime;

    // 开始性能监控帧
    this.performanceMonitor.beginFrame(currentTime);
    this.performanceMonitorSystem.beginFrame(currentTime);

    // 更新游戏状态
    this.update(deltaTime);

    // 渲染游戏画面
    this.render();

    // 结束性能监控帧
    this.performanceMonitor.endFrame();
    this.performanceMonitorSystem.endFrame(deltaTime);

    // 继续下一帧
    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * 更新游戏状态
   * @param deltaTime - 时间增量
   */
  update(deltaTime: number): void {
    // 根据游戏状态执行不同的更新逻辑
    switch (this.state) {
      case GameState.COUNTDOWN:
        this.updateCountdown(deltaTime);
        break;
      case GameState.ITEM_DROP:
      case GameState.ITEM_REVEAL:
      case GameState.WAVE_CLEAR:
        this.updateVisualEffects(deltaTime);
        break;
      case GameState.PLAYING:
        this.updateGameplay(deltaTime);
        break;
      case GameState.PAUSED:
        // 暂停状态下只更新视觉特效（如暂停菜单动画）
        this.updateVisualEffects(deltaTime);
        break;
      case GameState.GAME_OVER:
        // 游戏结束状态下只更新视觉特效（如游戏结束界面动画）
        this.updateVisualEffects(deltaTime);
        break;
      default:
        // 菜单状态和其他状态不需要更新游戏逻辑
        break;
    }
  }

  /**
   * 更新倒计时状态
   * @param deltaTime - 时间增量
   */
  private updateCountdown(deltaTime: number): void {
    // 从原始引擎迁移的倒计时逻辑
    this.countdownTimer -= deltaTime;
    
    // 更新显示的阶段（3 → 2 → 1）
    const newPhase = Math.ceil(this.countdownTimer);
    if (newPhase !== this.countdownPhase && newPhase >= 1) {
      this.countdownPhase = newPhase;
      // 在每个数字变化时播放滴答声
      this.audio.playCountdownTick();
    }
    
    // 在倒计时期间仍然更新视觉特效（粒子、屏幕震动）
    this.updateParticleSystem(deltaTime);
    this.updateFloatingTexts(deltaTime);
    this.updateScreenShake(deltaTime);
    
    // 倒计时结束 → 开始波次
    if (this.countdownTimer <= 0) {
      this.doWaveSpawn();
    }
  }

  /**
   * 更新视觉特效
   * @param deltaTime - 时间增量
   */
  private updateVisualEffects(deltaTime: number): void {
    // 更新粒子系统
    this.updateParticleSystem(deltaTime);
    
    // 更新浮动文字
    this.updateFloatingTexts(deltaTime);
    
    // 更新屏幕震动
    this.updateScreenShake(deltaTime);
  }

  /**
   * 更新游戏玩法逻辑
   * @param deltaTime - 时间增量
   */
  private updateGameplay(deltaTime: number): void {
    // 更新输入处理器（将鼠标位置传递给玩家控制系统）
    this.updateInputHandler();
    
    // 更新蟑螂AI
    this.updateRoaches(deltaTime);
    
    // 更新实体（蟑螂、粒子等）
    this.entityManager.updateEntities(
      (roach) => this.updateStatusEffects(roach),
      (id) => this.isStuckByBoard(id)
    );
    
    // 更新武器系统
    this.updateWeaponSystem(deltaTime);
    
    // 更新粒子系统
    this.updateParticleSystem(deltaTime);
    
    // 更新波次管理
    this.waveManager.update(deltaTime);
    
    // 处理波次生成
    this.handleWaveSpawning(deltaTime);
    
    // 更新碰撞检测
    this.checkCollisions();
    
    // 更新最新创建的模块（包含玩家控制和防御检查）
    this.updateNewModules(deltaTime);
    
    // 检查波次状态
    this.checkWaveStatus();
    
    // 标记模块管理器为已使用（避免TypeScript未使用变量警告）
    this.economyManager;
    this.performanceMonitor;
  }
  
  /**
   * 更新输入处理器
   */
  private updateInputHandler(): void {
    // 更新玩家控制系统的输入状态
    this.playerControlSystem.updateConfig({
      mouseX: this.inputHandler.mouseX,
      mouseY: this.inputHandler.mouseY,
      isFiring: this.inputHandler.isFiring,
      tutorialPauseSpawn: false, // 暂时硬编码，后续从游戏状态获取
    });
  }
  
  /**
   * 更新最新创建的模块
   * @param deltaTime - 时间增量
   */
  private updateNewModules(deltaTime: number): void {
    // 更新高级优先级模块
    this.updateHighPriorityModules(deltaTime);
    
    // 更新中级优先级模块
    this.updateMediumPriorityModules(deltaTime);
    
    // 更新Boss战斗系统
    this.updateBossBattleSystem(deltaTime);
    
    // 更新投掷物系统
    this.updateThrowableSystem(deltaTime);
    
    // 更新粘性板系统
    this.updateStickySystem(deltaTime);
    
    // 更新瞄准系统
    this.updateAimingSystem(deltaTime);
    
    // 更新三重火焰系统
    this.updateTripleFlameSystem(deltaTime);
    
    // 更新雷达激光系统
    this.updateRadarLaserSystem(deltaTime);
    
    // 更新风扇系统
    this.updateFanSystem(deltaTime);
    
    // 更新消耗品系统
    this.updateConsumableSystem(deltaTime);
    
    // 更新天气系统
    this.updateWeatherSystem(deltaTime);
    
    // 更新道具系统
    this.updateItemSystem(deltaTime);
    
    // 更新成就系统
    this.updateAchievementSystem();
    
    // 更新统计系统
    this.updateStatsSystem();
  }
  
  /**
   * 更新高级优先级模块
   * @param deltaTime - 时间增量
   */
  private updateHighPriorityModules(deltaTime: number): void {
    // 更新玩家控制系统
    this.playerControlSystem.updateConfig({
      gameState: this.state,
      deltaTime,
    });
    this.playerControlSystem.update(deltaTime);
    
    // 更新防御检查系统
    this.defenseCheckSystem.updateConfig({
      gameState: this.state,
      defenseLineY: this.getDefenseLineY(),
      defenseHp: this.defenseHp,
      maxDefenseHp: this.maxDefenseHp,
      deltaTime,
    });
    const defenseResult = this.defenseCheckSystem.checkDefense(
      this.entityManager.getRoaches()
    );
    
    // 如果有突破发生，更新游戏状态
    if (defenseResult.breachOccurred) {
      this.defenseHp = defenseResult.newDefenseHp;
      
      // 检查游戏是否失败
      if (this.defenseHp <= 0) {
        this.gameOver('defense_destroyed');
      }
    }
  }
  
  /**
   * 更新中级优先级模块
   */
  private updateMediumPriorityModules(deltaTime: number): void {
    this.itemManagementSystem.updateConfig({
      currentScene: this.currentScene,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      gameProgress: this.progress,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      defenseLineY: this.getDefenseLineY(),
    });
    
    // 更新道具管理系统
    this.itemManagementSystem.update(deltaTime);
  }
  
  /**
   * 更新Boss战斗系统
   * @param deltaTime - 时间增量
   */
  private updateBossBattleSystem(deltaTime: number): void {
    // 更新Boss战斗系统配置
    this.bossBattleSystem.updateConfig({
      gameState: this.state,
      gameMode: this.gameMode,
      currentScene: this.currentScene,
      deltaTime,
      defenseHp: this.defenseHp,
      defenseMaxHp: this.maxDefenseHp,
      screenShake: this.screenShake,
    });
    
    this.bossBattleSystem.updateBossBattle(this.entityManager.getRoaches());
  }
  
  /**
   * 更新投掷物系统
   * @param deltaTime - 时间增量
   */
  private updateThrowableSystem(deltaTime: number): void {
    // 更新投掷物系统配置
    this.throwableSystem.updateConfig({
      deltaTime,
      screenShake: this.screenShake,
    });
    
    this.throwableSystem.updateThrowables(this.entityManager.getRoaches());
  }
  
  /**
   * 更新粘性板系统
   * @param deltaTime - 时间增量
   */
  private updateStickySystem(deltaTime: number): void {
    // 更新粘性板系统配置
    this.stickySystem.updateConfig({
      deltaTime,
      gameTime: this.gameTime,
    });
    
    this.stickySystem.updateStickyBoards(this.entityManager.getRoaches());
    this.stickySystem.updateStickyDrops(this.entityManager.getRoaches());
  }
  
  /**
   * 更新瞄准系统
   * @param deltaTime - 时间增量
   */
  private updateAimingSystem(_deltaTime: number): void {
    // 更新瞄准系统配置
    this.aimingSystem.updateConfig({
      gameTime: this.gameTime,
      playerX: this.player.x,
      playerY: this.player.y,
      defenseLineY: this.getDefenseLineY(),
    });
    
    this.aimingSystem.updateAiming();
  }
  
  /**
   * 更新三重火焰系统
   * @param deltaTime - 时间增量
   */
  private updateTripleFlameSystem(deltaTime: number): void {
    // 更新三重火焰系统配置
    this.tripleFlameSystem.updateConfig({
      deltaTime,
      playerX: this.player.x,
      playerY: this.player.y,
    });
    
    this.tripleFlameSystem.updateTripleFlame();
  }
  
  /**
   * 更新雷达激光系统
   * @param deltaTime - 时间增量
   */
  private updateRadarLaserSystem(deltaTime: number): void {
    // 更新雷达激光系统配置
    this.radarLaserSystem.updateConfig({
      deltaTime: deltaTime,
      playerX: this.player.x,
      playerY: this.player.y,
    });
    
    this.radarLaserSystem.updateRadarLaser(this.entityManager.getRoaches());
  }
  
  /**
   * 更新风扇系统
   * @param deltaTime - 时间增量
   */
  private updateFanSystem(deltaTime: number): void {
    // 更新风扇系统配置
    this.fanSystem.updateConfig({
      deltaTime,
    });
    
    this.fanSystem.updateFan(this.entityManager.getRoaches());
  }
  
  /**
   * 更新消耗品系统
   * @param deltaTime - 时间增量
   */
  private updateConsumableSystem(deltaTime: number): void {
    // 更新消耗品系统配置
    this.consumableSystem.updateConfig({
      deltaTime: deltaTime,
      defenseHp: this.defenseHp,
      maxDefenseHp: this.maxDefenseHp,
      player: this.player,
      gameState: this.state,
    });
    
    // 更新消耗品系统
    this.consumableSystem.update();
  }
  
  /**
   * 更新天气系统
   * @param deltaTime - 时间增量
   */
  private updateWeatherSystem(deltaTime: number): void {
    // 更新天气系统配置
    this.weatherSystem.updateConfig({
      deltaTime: deltaTime,
    });
    
    // 更新天气系统
    this.weatherSystem.update();
  }
  
  /**
   * 更新道具系统
   * @param deltaTime - 时间增量
   */
  private updateItemSystem(deltaTime: number): void {
    // 更新道具系统配置
    this.itemSystem.updateConfig({
      deltaTime: deltaTime,
      gameState: this.state,
    });
    
    // 更新道具系统
    this.itemSystem.update();
  }
  
  /**
   * 更新成就系统
   */
  private updateAchievementSystem(): void {
    // 更新成就系统配置
    this.achievementSystem.updateConfig({
      economyStats: {
        totalKills: this.economy.totalKills,
        highestWave: this.economy.highestWave,
        highestEndlessWave: this.economy.highestEndlessWave,
        totalMoneyEarned: this.economy.totalMoneyEarned,
        perfectWaves: this.economy.perfectWaves,
        breaches: this.economy.breaches,
        queenKills: this.economy.queenKills,
        flyingKills: this.economy.flyingKills,
        armoredKills: this.economy.armoredKills,
      },
      playerProgress: {
        achievements: this.progress.achievements as any,
        weaponsUnlocked: this.progress.weaponsUnlocked,
        talentTree: this.progress.talentTree,
      },
    });
    
    // 检查并解锁成就
    this.achievementSystem.checkAchievements();
  }
  
  /**
   * 更新统计系统
   */
  private updateStatsSystem(): void {
    // 更新统计系统配置
    this.statsSystem.updateConfig({
      initialStats: {
        totalGamesPlayed: this.economy.totalGamesPlayed,
        totalMoneyEarned: this.economy.totalMoneyEarned,
        totalDamage: this.economy.totalDamage,
        totalMoneySpent: this.economy.totalMoneySpent,
        totalConsumablesUsed: this.economy.totalConsumablesUsed,
        totalWeaponsUnlocked: this.economy.totalWeaponsUnlocked,
        totalUpgradesPurchased: this.economy.totalUpgradesPurchased,
        totalAchievements: this.progress.achievements.filter(a => a.unlocked).length,
        totalKills: this.economy.totalKills,
        highestWave: this.economy.highestWave,
        highestEndlessWave: this.economy.highestEndlessWave,
        perfectWaves: this.economy.perfectWaves,
        breaches: this.economy.breaches,
        queenKills: this.economy.queenKills,
        flyingKills: this.economy.flyingKills,
        armoredKills: this.economy.armoredKills,
        gasCanistersUsed: this.economy.gasCanistersUsed,
      },
    });
    
    // 更新统计数据
    this.statsSystem.updateStats({
      totalGamesPlayed: this.economy.totalGamesPlayed,
      totalMoneyEarned: this.economy.totalMoneyEarned,
      totalDamage: this.economy.totalDamage,
      totalMoneySpent: this.economy.totalMoneySpent,
      totalConsumablesUsed: this.economy.totalConsumablesUsed,
      totalWeaponsUnlocked: this.economy.totalWeaponsUnlocked,
      totalUpgradesPurchased: this.economy.totalUpgradesPurchased,
      totalAchievements: this.progress.achievements.filter(a => a.unlocked).length,
      totalKills: this.economy.totalKills,
      highestWave: this.economy.highestWave,
      highestEndlessWave: this.economy.highestEndlessWave,
      perfectWaves: this.economy.perfectWaves,
      breaches: this.economy.breaches,
      queenKills: this.economy.queenKills,
      flyingKills: this.economy.flyingKills,
      armoredKills: this.economy.armoredKills,
      gasCanistersUsed: this.economy.gasCanistersUsed,
    });
  }

  /**
   * 更新蟑螂AI和状态
   */
  private updateRoaches(deltaTime: number): void {
    // 更新AI系统配置
    this.roachAISystem.updateConfig({
      gameState: this.state,
      deltaTime: deltaTime,
      playerX: this.player.x,
      playerY: this.player.y,
    });
    
    // 获取当前蟑螂并更新
    const currentRoaches = this.entityManager.getRoaches();
    
    // 传递蟑螂数组给AI系统用于护士治疗等逻辑
    try {
      this.roachAISystem.setAllRoaches(currentRoaches);
    } catch (e) { /* ignore */ }
    
    const updatedRoaches = this.roachAISystem.updateRoaches(currentRoaches);
    
    // 更新实体管理器中的蟑螂
    this.entityManager.updateRoaches(updatedRoaches);
  }

  /**
   * 更新状态效果
   * @param _roach 蟑螂实体
   */
  private updateStatusEffects(_roach: any): void {
    // TODO: 从原始引擎迁移状态效果更新逻辑
    // 暂时为空实现
  }

  /**
   * 检查是否被粘板困住
   * @param _id 实体ID
   * @returns 是否被困住
   */
  private isStuckByBoard(_id: number): boolean {
    // TODO: 从原始引擎迁移粘板检查逻辑
    // 暂时返回false
    return false;
  }

  /**
   * 检查碰撞
   */
  private checkCollisions(): void {
    // 使用碰撞检测系统检查火焰与蟑螂的碰撞
    const roaches = this.entityManager.getRoaches();
    
    // 更新碰撞检测系统配置
    this.collisionSystem.updateConfig({
      difficulty: this.difficulty,
      gameState: this.state,
    });
    
    // 检查火焰碰撞并更新蟑螂状态
    const updatedRoaches = this.collisionSystem.checkFlameCollisions(
      this.player,
      roaches,
      this.tripleFlame,
      this.isStuckByBoard.bind(this)
    );
    
    // 更新实体管理器中的蟑螂状态
    this.entityManager.updateRoaches(updatedRoaches);
    
    // 检查并处理被击杀的蟑螂
    this.handleKilledRoaches(updatedRoaches);
  }
  
  /**
   * 处理被击杀的蟑螂
   * @param roaches 蟑螂数组
   */
  private handleKilledRoaches(roaches: Roach[]): void {
    const killedRoaches = roaches.filter(roach => roach.hp <= 0 && roach.state !== RoachState.DEAD);
    
    for (const roach of killedRoaches) {
      // 计算击杀奖励
      this.economyManager.recordKillWithReward(
        roach.type,
        this.progress,
        this.currentScene,
        this.difficulty
      );
      
      // 播放击杀音效
      this.audio.playKill();
      
      // 生成爆炸粒子效果
      this.particleSystem.spawnExplosionParticles(roach.x, roach.y, 30);
      
      // 更新屏幕震动
      this.screenShake = roach.isBoss ? 12 : (roach.type === RoachType.LARGE ? 6 : 3);
      
      // 检查成就
      this.economyManager.checkAchievements(this.progress, (name, reward) => {
        // 成就解锁回调 - 可以在这里添加成就解锁的视觉反馈
        console.log(`成就解锁: ${name} +¥${reward}`);
      });
      
      // 标记蟑螂为死亡状态
      roach.state = RoachState.DEAD;
    }
  }
  
  /**
   * 处理波次生成
   * @param deltaTime 时间增量
   */
  private handleWaveSpawning(deltaTime: number): void {
    // 获取下一个要生成的蟑螂
    const nextSpawn = this.waveManager.getNextSpawn();
    
    if (nextSpawn) {
      // 检查生成计时器
      if (this.spawnTimer <= 0) {
        // 生成蟑螂
        const roach = this.entityManager.getRoachManager().spawnRoach(
           nextSpawn.type,
           nextSpawn.clusterId,
           {
             difficulty: this.difficulty,
             waveConfig: this.waveManager.getWaveConfig(this.waveManager.wave),
             bossBattle: this.bossBattleSystem?.getBossState(),
           }
         );
        
        if (roach) {
          // 移除已生成的蟑螂
          this.waveManager.removeSpawned();
          
          // 重置生成计时器
          const config = this.waveManager.getWaveConfig(this.waveManager.wave);
          this.spawnTimer = config.spawnInterval ?? 1.0;
        }
      } else {
        // 更新生成计时器
        this.spawnTimer -= deltaTime;
      }
    }
  }

  /**
   * 检查波次状态
   */
  private checkWaveStatus(): void {
    // 检查波次是否完成
    if (this.waveManager.isWaveComplete()) {
      // 计算天赋点奖励
      const talentReward = this.waveManager.calculateTalentReward(this.currentScene);
      
      // 添加天赋点到游戏进度
      this.waveManager.addTalentPoints(this.progress, talentReward);
      
      // 检查是否为完美波次
      if (this.waveManager.isPerfectWave(this.economy.breaches)) {
        // 记录完美波次
        this.economyManager.recordPerfectWave();
        this.waveManager.recordPerfectWave(() => {
          console.log(`完美波次完成！奖励: ${talentReward} 天赋点`);
        });
      } else {
        console.log(`波次完成！奖励: ${talentReward} 天赋点`);
      }
      
      // 保存游戏进度
      this.saveProgress();
      
      // 同步当前波次计数
      this.currentWave = this.waveManager.wave;
      
      // 检查是否所有波次已完成
      if (this.waveManager.shouldShowShop() || this.waveManager.wave > this.waveManager.getTotalWaves()) {
        this.triggerVictory();
      } else {
        // 过渡到波次清除状态
        this.state = GameState.WAVE_CLEAR;
        this.onStateChange?.(this.state);
        
        // 从道具管理系统获取新解锁的道具
        try {
          const newlyUnlocked = this.itemManagementSystem.checkSceneUnlocks(this.currentScene);
          if (newlyUnlocked.length > 0) {
            // 有新的道具解锁，进入道具揭示流程
            this.state = GameState.ITEM_REVEAL;
            this.onStateChange?.(this.state);
            this.itemManagementSystem.startItemReveal(newlyUnlocked);
          } else {
            // 没有新道具，直接启动下一波
            this.waveManager.startWave();
            this.currentWave = this.waveManager.wave;
            this.startCountdown(() => {
              this.doWaveSpawn();
            });
          }
        } catch (e) {
          // 出错时回退到直接启动下一波
          this.waveManager.startWave();
          this.currentWave = this.waveManager.wave;
          this.startCountdown(() => {
            this.doWaveSpawn();
          });
        }
      }
    }
  }
  
  /**
   * 触发胜利流程
   */
  private triggerVictory(): void {
    this.state = GameState.WAVE_CLEAR;
    this.onStateChange?.(this.state);
    
    // 停止BGM
    this.stopBGM();
    
    // 播放胜利音乐
    this.playVictoryBGM();
    
    // 保存进度
    this.saveProgress();
    
    // 更新场景完成
    if (!this.progress.scenesCompleted.includes(this.currentScene)) {
      this.progress.scenesCompleted.push(this.currentScene);
    }
    
    // 解锁下一场景
    try {
      this.itemManagementSystem.checkSceneUnlocks();
    } catch (e) { /* ignore */ }
    
    console.log('Victory! All waves completed.');
  }
  
  /**
   * 更新武器系统
   * @param deltaTime 时间增量
   */
  private updateWeaponSystem(deltaTime: number): void {
    // 更新武器系统配置
    this.weaponSystem.updateConfig({
      difficulty: this.difficulty,
      gameState: this.state,
      gameMode: this.gameMode,
      currentScene: this.currentScene,
      unlockedWeapons: this.progress.weaponsUnlocked || ['flamethrower'],
      selectedItems: this.itemManagementSystem.getSelectedItems(),
    });
    
    // 更新武器掉落
    const weaponDrops = this.weaponSystem.update(
      deltaTime,
      this.player,
      this.getDefenseLineY()
    );
    
    // 可以在这里处理武器掉落渲染或其他逻辑
    // 例如：将武器掉落传递给渲染管理器
    weaponDrops;
  }

  /**
   * 更新粒子系统
   * @param deltaTime 时间增量
   */
  private updateParticleSystem(deltaTime: number): void {
    // 更新粒子系统配置
    this.particleSystem.updateConfig({
      particleLimit: 300,
      deltaTime,
      defenseLineY: this.getDefenseLineY(),
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
    });
    
    // 更新粒子系统
    const roaches = this.entityManager.getRoaches();
    const particleState = this.particleSystem.update(roaches);
    
    // 可以在这里处理粒子状态
    // 例如：将粒子状态传递给渲染管理器
    if (particleState.particles.length > 0) {
      // 有活跃粒子，可以触发相应逻辑
      // console.log(`当前有 ${particleState.particles.length} 个活跃粒子`);
    }
  }

  /**
   * 更新浮动文字
   * @param deltaTime - 时间增量
   */
  private updateFloatingTexts(deltaTime: number): void {
    // TODO: 从原始引擎迁移浮动文字更新逻辑
    // 暂时为空实现
    // 浮动文字通常包括击杀奖励、伤害数字等
    console.log(`更新浮动文字，deltaTime: ${deltaTime}`);
  }

  /**
   * 更新屏幕震动
   * @param deltaTime - 时间增量
   */
  private updateScreenShake(deltaTime: number): void {
    // TODO: 从原始引擎迁移屏幕震动更新逻辑
    // 屏幕震动通常由爆炸、重击等事件触发
    if (this.screenShake > 0) {
      this.screenShake -= deltaTime * 5;
      if (this.screenShake < 0) this.screenShake = 0;
    }
  }

  /**
   * 执行波次生成
   */
  private doWaveSpawn(): void {
    // 调用waveManager来生成新的波次
    const waveStarted = this.waveManager.startWave();
    
    if (waveStarted) {
      this.state = GameState.PLAYING;
      this.countdownWavePending = false; // 重置倒计时等待标志
      
      // 战斗开始，播放关卡背景音乐
      this.audio.startLevelBGM();
      
      this.onStateChange?.(this.state);
    } else {
      // 如果波次没有启动（例如教程暂停），保持倒计时状态
      console.log('波次生成暂停（教程模式）');
    }
  }

  /**
   * 渲染游戏画面
   */
  render(): void {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 根据游戏状态执行不同的渲染逻辑
    switch (this.state) {
      case GameState.COUNTDOWN:
        this.renderCountdown();
        break;
      case GameState.ITEM_DROP:
      case GameState.ITEM_REVEAL:
      case GameState.WAVE_CLEAR:
        this.renderVisualEffects();
        break;
      case GameState.PLAYING:
        this.renderGameplay();
        break;
      case GameState.PAUSED:
        // 暂停状态下渲染游戏画面和暂停菜单
        this.renderGameplay();
        this.renderPauseMenu();
        break;
      case GameState.GAME_OVER:
        // 游戏结束状态下渲染游戏画面和游戏结束界面
        this.renderGameplay();
        this.renderGameOverScreen();
        break;
      default:
        // 菜单状态和其他状态渲染默认画面
        this.renderDefault();
        break;
    }
  }

  /**
   * 渲染倒计时画面
   */
  private renderCountdown(): void {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制背景
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制倒计时数字（居中，大字体）
    this.ctx.font = 'bold 120px Arial';
    this.ctx.fillStyle = '#ff6600';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      this.countdownPhase.toString(),
      this.canvas.width / 2,
      this.canvas.height / 2
    );
    
    // 绘制提示文字
    this.ctx.font = '24px Arial';
    this.ctx.fillStyle = '#cccccc';
    this.ctx.fillText('准备战斗！', this.canvas.width / 2, this.canvas.height / 2 + 100);
  }

  /**
   * 渲染视觉特效
   */
  private renderVisualEffects(): void {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制背景
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制游戏场景（包含物品掉落区域）
    let itemDrop = null;
    try { itemDrop = this.itemSystem.getFieldItemDrop(); } catch (e) { /* ignore */ }
    
    if (itemDrop && !itemDrop.collected) {
      // 绘制物品掉落
      const bobY = (() => {
        try { return this.itemSystem.getItemBobY(); } catch (e) { return 0; }
      })();
      const displayY = itemDrop.y + bobY;
      
      this.ctx.beginPath();
      this.ctx.fillStyle = '#ffaa00';
      this.ctx.arc(itemDrop.x, displayY, 25, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      this.ctx.font = '16px Arial';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(itemDrop.name || '物品', itemDrop.x, displayY - 35);
    }
    
    // 绘制HUD
    this.uiManager.render({
      gameState: this.state,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      currentScene: this.currentScene,
      player: this.player,
      economy: this.economy,
      wave: this.currentWave,
      defenseHp: this.defenseHp,
      maxDefenseHp: this.maxDefenseHp,
      weather: 'none' as const,
      weatherIntensity: 0,
      selectedItemIndex: 0,
      isPlacingItem: false,
      time: this.lastTime
    });
  }

  /**
   * 渲染游戏玩法画面
   */
  private renderGameplay(): void {
    // 安全获取各模块数据，使用try-catch防止崩溃
    let roaches: any[] = [];
    let particles: any[] = [];
    let fireZones: any[] = [];
    let fireWalls: any[] = [];
    let floatingTexts: any[] = [];
    let weaponDrops: any[] = [];
    let stickyBoards: any[] = [];
    let stickyDrops: any[] = [];
    let throwableProjectiles: any[] = [];
    let fanStates: any[] = [];
    let radarLasers: any[] = [];
    let itemDropsOnField: any = null;
    let bossBattle = { active: false, timer: 0, maxTimer: 0, eggPools: [] as any[] };
    let weather = 'none';
    
    try { roaches = this.entityManager.getRoaches(); } catch (e) { /* ignore */ }
    try {
      const ps = this.particleSystem.getState();
      particles = ps.particles;
      fireZones = ps.fireZones;
      fireWalls = ps.fireWalls;
      floatingTexts = ps.floatingTexts;
    } catch (e) { /* ignore */ }
    try { weaponDrops = this.itemManagementSystem.getWeaponDrops(); } catch (e) {
      try { weaponDrops = this.weaponSystem.getWeaponDrops(); } catch (e2) { /* ignore */ }
    }
    try { stickyBoards = this.stickySystem.getStickyBoards(); } catch (e) { /* ignore */ }
    try { stickyDrops = this.stickySystem.getStickyDrops(); } catch (e) { /* ignore */ }
    try { throwableProjectiles = this.throwableSystem.getThrowables(); } catch (e) { /* ignore */ }
    try { fanStates = [this.fanSystem.getState()]; } catch (e) { /* ignore */ }
    try { radarLasers = this.radarLaserSystem.getRadarLasers(); } catch (e) { /* ignore */ }
    try {
      const fieldDrop = this.itemSystem.getFieldItemDrop();
      if (fieldDrop) itemDropsOnField = fieldDrop;
    } catch (e) { /* ignore */ }
    try {
      bossBattle = this.bossBattleSystem.getBossState() || { active: false, timer: 0, maxTimer: 0, eggPools: [] };
    } catch (e) { /* ignore */ }
    try { weather = this.weatherSystem.getWeatherType(); } catch (e) { /* ignore */ }
    
    const renderData = {
      gameState: this.state,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      currentScene: this.currentScene,
      time: this.lastTime,
      screenShakeX: Math.random() * this.screenShake * 2 - this.screenShake,
      screenShakeY: Math.random() * this.screenShake * 2 - this.screenShake,
      showMovementRange: false,
      weather,
      weatherIntensity: 0,
      weatherTimer: 0,
      slimeBurstTimer: 0,
      slimeBurstX: 0,
      slimeBurstY: 0,
      bossBattle,
      placedBombs: [],
      deadTimedBombs: [],
      roaches,
      particles,
      fireZones,
      fireWalls,
      stickyBoards,
      stickyDrops,
      weaponDrops,
      player: this.player,
      floatingTexts,
      throwableProjectiles,
      fanStates,
      radarLasers,
      itemDropsOnField,
      images: {
        bgImg: undefined,
        bgKitchenHardImg: undefined,
        bgKitchenEasyImg: undefined,
        bgSewerImg: undefined,
        bgSewerHardImg: undefined,
        bgSewerEasyImg: undefined,
        bgDumpImg: undefined,
        bgDumpHardImg: undefined,
        bgDumpEasyImg: undefined,
        bgHospitalImg: undefined,
        bgHospitalHardImg: undefined,
        bgHospitalEasyImg: undefined,
        bgSceneImages: {} as Record<SceneType, HTMLImageElement | undefined>,
        bombImg: undefined,
        roachImg: undefined,
        roachQueenImg: undefined,
        roachMutantImg: undefined,
        roachTankImg: undefined,
        roachFlyImg: undefined,
        roachSmallImg: undefined,
        roachMediumImg: undefined,
        roachLargeImg: undefined,
        playerImg: undefined,
        weaponDropImgs: {} as Record<string, HTMLImageElement | undefined>,
        itemDropImgs: {} as Record<string, HTMLImageElement | undefined>
      },
      imagesLoaded: false
    };
    
    // 使用渲染管理器渲染游戏画面
    this.renderManager.render(renderData);
  }

  /**
   * 渲染默认画面
   */
  private renderDefault(): void {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制简单的背景
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 根据游戏状态渲染相应的界面
    if (this.state === GameState.MENU || this.state === GameState.PAUSED || this.state === GameState.GAME_OVER) {
      // 渲染菜单界面
      this.uiManager.renderMenu(
        this.ctx,
        this.canvas.width,
        this.canvas.height,
        {
          gameState: this.state,
          gameMode: this.gameMode,
          difficulty: this.difficulty,
          currentScene: this.currentScene,
          player: this.player,
          economy: this.economy,
          wave: this.currentWave,
          defenseHp: this.defenseHp,
          maxDefenseHp: this.maxDefenseHp,
          weather: 'none' as const,
          weatherIntensity: 0,
          selectedItemIndex: 0,
          isPlacingItem: false,
          time: this.lastTime,
          progress: this.progress
        }
      );
    } else {
      // 使用UI管理器渲染游戏HUD
      this.uiManager.render({
        gameState: this.state,
        gameMode: this.gameMode,
        difficulty: this.difficulty,
        currentScene: this.currentScene,
        player: this.player,
        economy: this.economy,
        wave: this.currentWave,
        defenseHp: this.defenseHp,
        maxDefenseHp: this.maxDefenseHp,
        weather: 'none' as const,
        weatherIntensity: 0,
        selectedItemIndex: 0,
        isPlacingItem: false,
        time: this.lastTime
      });
    }
  }

  /**
   * 获取玩家对象
   * @returns 玩家对象
   */
  getPlayer(): Player {
    return this.player;
  }

  /**
   * 获取经济统计
   * @returns 经济统计对象
   */
  getEconomy(): Economy {
    return this.economy;
  }

  /**
   * 获取游戏进度
   * @returns 游戏进度对象
   */
  getProgress(): GameProgress {
    return this.progress;
  }

  /**
   * 获取当前波次
   * @returns 当前波次
   */
  getCurrentWave(): number {
    return this.currentWave;
  }

  /**
   * 获取防御生命值
   * @returns 防御生命值
   */
  getDefenseHp(): number {
    return this.defenseHp;
  }

  /**
   * 获取最大防御生命值
   * @returns 最大防御生命值
   */
  getMaxDefenseHp(): number {
    return this.maxDefenseHp;
  }

  /**
   * 获取游戏状态
   * @returns 游戏状态
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * 设置游戏状态
   * @param state - 游戏状态
   */
  setState(state: GameState): void {
    this.state = state;
  }

  /**
   * 开始游戏（从菜单切换到游戏状态）
   */
  startGame(): void {
    if (this.state === GameState.MENU) {
      this.state = GameState.COUNTDOWN;
      console.log('游戏开始：倒计时状态');
      
      // 重置游戏状态
      this.resetGameState();
      
      // 切换背景音乐到当前场景和难度（不立即播放）
      this.switchBGMForScene();
      
      // 根据用户需求：不要默认的背景音乐，只在战斗开始后播放关卡音乐
      // 所以这里不调用startBGM()
      
      // 开始倒计时
      this.startCountdown();
    } else {
      console.warn('无法开始游戏：当前状态不是菜单');
    }
  }

  /**
   * 暂停游戏
   */
  pauseGame(): void {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      console.log('游戏已暂停');
      
      // 暂停背景音乐
      this.stopBGM();
      
      // 停止开火音效
      this.stopFire();
    } else {
      console.warn('无法暂停游戏：当前状态不是游戏中');
    }
  }

  /**
   * 继续游戏
   */
  resumeGame(): void {
    if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      console.log('游戏已继续');
      
      // 恢复背景音乐（直接播放关卡音乐）
      this.audio.startLevelBGM();
    } else {
      console.warn('无法继续游戏：当前状态不是暂停中');
    }
  }

  /**
   * 游戏结束
   * @param reason - 游戏结束原因
   */
  gameOver(reason: 'defense_destroyed' | 'player_dead' | 'timeout' = 'defense_destroyed'): void {
    if (this.state === GameState.PLAYING || this.state === GameState.COUNTDOWN) {
      this.state = GameState.GAME_OVER;
      console.log(`游戏结束：${reason}`);
      
      // 停止背景音乐
      this.stopBGM();
      
      // 停止开火音效
      this.stopFire();
      
      // 播放游戏结束背景音乐
      this.playGameOverBGM();
      
      // 播放游戏结束震动
      this.vibrateGameOver();
      
      // 保存游戏统计信息
      this.saveGameStats();
      
      // 显示游戏结束界面
      this.showGameOverScreen(reason);
    } else {
      console.warn('无法结束游戏：当前状态不是游戏中或倒计时中');
    }
  }

  /**
   * 返回主菜单
   */
  backToMenu(): void {
    if (this.state !== GameState.MENU) {
      this.state = GameState.MENU;
      console.log('返回主菜单');
      
      // 停止游戏结束背景音乐
      this.stopGameOverBGM();
      
      // 停止胜利背景音乐
      this.stopVictoryBGM();
      
      // 重置游戏状态
      this.resetGameState();
      
      // 重置输入状态
      this.resetInput();
    }
  }

  /**
   * 重置游戏状态
   */
  private resetGameState(): void {
    // 重置玩家状态
    this.player = this.createPlayer();
    
    // 重置经济状态
    this.economy = this.createEconomy();
    
    // 重置波次
    this.currentWave = 1;
    
    // 重置防御生命值
    this.defenseHp = this.maxDefenseHp;
    
    // 重置模块管理器
    this.waveManager = new WaveManager(this.currentScene, this.gameMode, this.difficulty);
    this.entityManager = new EntityManager(this.canvas.width, this.canvas.height, () => this.getDefenseLineY(), this.currentScene);
    
    // 重置性能监控系统
    this.performanceMonitorSystem.reset();
    
    console.log('游戏状态已重置');
  }

  /**
   * 开始倒计时
   * @returns 如果倒计时已启动则返回true
   */
  private startCountdown(): boolean {
    // 仅在第一波触发倒计时（不是波次之间）
    // Boss模式有自己的计时
    if (this.wave !== 1 || this.gameMode === GameMode.BOSS) return false;

    this.countdownPhase = 3;
    this.countdownTimer = 3.0; // 总共3秒：3, 2, 1
    this.countdownWavePending = true;
    this.state = GameState.COUNTDOWN;
    this.onStateChange?.(this.state);
    return true;
  }

  /**
   * 保存游戏统计信息
   */
  private saveGameStats(): void {
    // 更新最高波次
    if (this.currentWave > this.progress.highestWave) {
      this.progress.highestWave = this.currentWave;
    }
    
    // 更新总击杀数
    this.progress.totalKills += this.economy.totalKills;
    
    console.log('游戏统计信息已保存');
  }

  /**
   * 显示游戏结束界面
   * @param reason - 游戏结束原因
   */
  private showGameOverScreen(reason: string): void {
    // 游戏结束界面逻辑
    // TODO: 从原始引擎迁移游戏结束界面逻辑
    console.log(`显示游戏结束界面：${reason}`);
  }

  /**
   * 获取游戏模式
   * @returns 游戏模式
   */
  getGameMode(): GameMode {
    return this.gameMode;
  }

  /**
   * 更新鼠标位置
   * @param x - 鼠标X坐标
   * @param y - 鼠标Y坐标
   */
  updateMousePosition(x: number, y: number): void {
    this.inputHandler.updateMousePosition(x, y);
  }

  /**
   * 设置开火状态
   * @param firing - 是否开火
   */
  setFiring(firing: boolean): void {
    this.inputHandler.setFiring(firing);
  }

  /**
   * 设置鼠标按下状态
   * @param down - 鼠标是否按下
   */
  setMouseDown(down: boolean): void {
    this.inputHandler.setMouseDown(down);
  }

  /**
   * 设置按键状态
   * @param key - 按键名称
   * @param pressed - 是否按下
   */
  setKey(key: string, pressed: boolean): void {
    this.inputHandler.setKey(key, pressed);
  }

  /**
   * 检查按键是否按下
   * @param key - 按键名称
   * @returns 是否按下
   */
  isKeyPressed(key: string): boolean {
    return this.inputHandler.isKeyPressed(key);
  }

  /**
   * 重置输入状态
   */
  resetInput(): void {
    this.inputHandler.reset();
  }

  /**
   * 获取难度
   * @returns 难度
   */
  getDifficulty(): 'easy' | 'hard' {
    return this.difficulty;
  }

  /**
   * 获取当前场景
   * @returns 当前场景
   */
  getCurrentScene(): SceneType {
    return this.currentScene;
  }

  /**
   * 获取音频管理器
   * @returns 音频管理器
   */
  getAudio(): AudioManager {
    return this.audio;
  }

  /**
   * 获取粒子系统
   * @returns 粒子系统
   */
  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  /**
   * 获取道具系统
   * @returns 道具系统
   */
  getItemSystem(): ItemSystem {
    return this.itemSystem;
  }

  /**
   * 获取道具管理系统
   * @returns 道具管理系统
   */
  getItemManagementSystem(): ItemManagementSystem {
    return this.itemManagementSystem;
  }

  /**
   * 获取武器系统
   * @returns 武器系统
   */
  getWeaponSystem(): WeaponSystem {
    return this.weaponSystem;
  }

  /**
   * 获取粘性板系统
   * @returns 粘性板系统
   */
  getStickySystem(): StickySystem {
    return this.stickySystem;
  }

  /**
   * 获取投掷物系统
   * @returns 投掷物系统
   */
  getThrowableSystem(): ThrowableSystem {
    return this.throwableSystem;
  }

  /**
   * 获取风扇系统
   * @returns 风扇系统
   */
  getFanSystem(): FanSystem {
    return this.fanSystem;
  }

  /**
   * 获取雷达激光系统
   * @returns 雷达激光系统
   */
  getRadarLaserSystem(): RadarLaserSystem {
    return this.radarLaserSystem;
  }

  /**
   * 获取Boss战斗系统
   * @returns Boss战斗系统
   */
  getBossBattleSystem(): BossBattleSystem {
    return this.bossBattleSystem;
  }

  /**
   * 获取蟑螂AI系统
   * @returns 蟑螂AI系统
   */
  getRoachAISystem(): RoachAISystem {
    return this.roachAISystem;
  }

  /**
   * 获取波次管理器
   * @returns 波次管理器
   */
  getWaveManager(): WaveManager {
    return this.waveManager;
  }

  /**
   * 获取实体管理器
   * @returns 实体管理器
   */
  getEntityManager(): EntityManager {
    return this.entityManager;
  }

  /**
   * 获取三重火焰状态
   * @returns 三重火焰状态
   */
  private get tripleFlame(): any {
    try {
      return this.tripleFlameSystem.getTripleFlameState();
    } catch (e) {
      return { active: false, timer: 0, duration: 0, radius: 0, angle: 0 };
    }
  }

  /**
   * 开始播放背景音乐
   */
  startBGM(): void {
    this.audio.startBGM();
  }

  /**
   * 停止背景音乐
   */
  stopBGM(): void {
    this.audio.stopBGM();
  }

  /**
   * 切换背景音乐到指定场景和难度
   */
  switchBGMForScene(): void {
    this.audio.switchBGMForScene(this.currentScene, this.difficulty);
  }

  /**
   * 播放开火音效
   */
  playFire(): void {
    this.audio.playFire();
  }

  /**
   * 停止开火音效
   */
  stopFire(): void {
    this.audio.stopFire();
  }

  /**
   * 播放击杀音效
   */
  playKill(): void {
    this.audio.playKill();
  }

  /**
   * 播放电蚊拍音效
   */
  playSwatter(): void {
    this.audio.playSwatter();
  }

  /**
   * 播放重新装填音效
   */
  playReload(): void {
    this.audio.playReload();
  }

  /**
   * 播放点击音效
   */
  playClick(): void {
    if (!this.audio.suppressClickSfx) {
      this.audio.playClick();
    }
  }

  /**
   * 设置是否抑制点击音效
   * @param suppress - 是否抑制点击音效
   */
  setSuppressClickSfx(suppress: boolean): void {
    this.audio.suppressClickSfx = suppress;
  }

  /**
   * 切换静音状态
   */
  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  /**
   * 获取静音状态
   * @returns 是否静音
   */
  isMuted(): boolean {
    return this.audio.getMuted();
  }

  /**
   * 切换震动状态
   */
  toggleVibration(): boolean {
    return this.audio.toggleVibration();
  }

  /**
   * 获取震动状态
   * @returns 是否启用震动
   */
  isVibrationEnabled(): boolean {
    return this.audio.getVibrationEnabled();
  }

  /**
   * 播放游戏结束背景音乐
   */
  playGameOverBGM(): void {
    this.audio.playGameOverBGM();
  }

  /**
   * 停止游戏结束背景音乐
   */
  stopGameOverBGM(): void {
    this.audio.stopGameOverBGM();
  }

  /**
   * 播放胜利背景音乐
   */
  playVictoryBGM(): void {
    this.audio.playVictoryBGM();
  }

  /**
   * 停止胜利背景音乐
   */
  stopVictoryBGM(): void {
    this.audio.stopVictoryBGM();
  }

  /**
   * 播放风扇循环音效
   */
  startFanLoop(): void {
    this.audio.startFanLoop();
  }

  /**
   * 停止风扇循环音效
   */
  stopFanLoop(): void {
    this.audio.stopFanLoop();
  }

  /**
   * 播放火墙燃烧音效
   */
  startFireWallBurn(): void {
    this.audio.startFireWallBurn();
  }

  /**
   * 停止火墙燃烧音效
   */
  stopFireWallBurn(): void {
    this.audio.stopFireWallBurn();
  }

  /**
   * 播放飞行蟑螂嗡嗡声
   */
  playFlyingBuzz(): void {
    this.audio.playFlyingBuzz();
  }

  /**
   * 播放飞行蟑螂闪避音效
   */
  playFlyingDodge(): void {
    this.audio.playFlyingDodge();
  }

  /**
   * 播放燃烧瓶投掷音效
   */
  playMolotovThrow(): void {
    this.audio.playMolotovThrow();
  }

  /**
   * 播放地面自爆突破音效
   */
  playSuicideBreachGround(): void {
    this.audio.playSuicideBreachGround();
  }

  /**
   * 播放飞行自爆突破音效
   */
  playSuicideBreachFlying(): void {
    this.audio.playSuicideBreachFlying();
  }

  /**
   * 播放道具掉落音效
   */
  playItemDropFanfare(): void {
    this.audio.playItemDropFanfare();
  }

  /**
   * 播放震动反馈
   * @param pattern - 震动模式
   */
  vibrate(pattern: number | number[]): void {
    this.audio.vibrate(pattern);
  }

  /**
   * 播放开火震动
   */
  vibrateFire(): void {
    this.audio.vibrateFire();
  }

  /**
   * 播放击杀震动
   */
  vibrateKill(): void {
    this.audio.vibrateKill();
  }

  /**
   * 播放爆炸震动
   */
  vibrateExplode(): void {
    this.audio.vibrateExplode();
  }

  /**
   * 播放自爆震动
   */
  vibrateSuicideExplode(): void {
    this.audio.vibrateSuicideExplode();
  }

  /**
   * 播放突破震动
   */
  vibrateBreach(): void {
    this.audio.vibrateBreach();
  }

  /**
   * 播放道具使用震动
   */
  vibrateItemUse(): void {
    this.audio.vibrateItemUse();
  }

  /**
   * 播放新记录震动
   */
  vibrateNewRecord(): void {
    this.audio.vibrateNewRecord();
  }

  /**
   * 播放游戏结束震动
   */
  vibrateGameOver(): void {
    this.audio.vibrateGameOver();
  }

  /**
   * 渲染暂停菜单
   */
  private renderPauseMenu(): void {
    // 绘制半透明黑色覆盖层
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制暂停菜单背景
    const menuWidth = 400;
    const menuHeight = 300;
    const menuX = (this.canvas.width - menuWidth) / 2;
    const menuY = (this.canvas.height - menuHeight) / 2;
    
    this.ctx.fillStyle = '#2a2a4a';
    this.ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
    
    // 绘制边框
    this.ctx.strokeStyle = '#ff9900';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);
    
    // 绘制标题
    this.ctx.font = 'bold 36px Arial';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('游戏暂停', this.canvas.width / 2, menuY + 50);
    
    // 绘制提示信息
    this.ctx.font = '20px Arial';
    this.ctx.fillStyle = '#cccccc';
    this.ctx.fillText('按 ESC 键继续游戏', this.canvas.width / 2, menuY + 120);
    this.ctx.fillText('按 M 键返回主菜单', this.canvas.width / 2, menuY + 160);
    
    // 绘制游戏状态信息
    this.ctx.font = '18px Arial';
    this.ctx.fillStyle = '#ffff00';
    this.ctx.fillText(`当前波次: ${this.currentWave}`, this.canvas.width / 2, menuY + 210);
    this.ctx.fillText(`防御生命值: ${this.defenseHp}/${this.maxDefenseHp}`, this.canvas.width / 2, menuY + 240);
  }

  /**
   * 保存游戏进度
   */
  private saveProgress(): void {
    // 更新最高波次记录
    this.progress.highestWave = Math.max(this.progress.highestWave, this.waveManager.wave);
    
    // 更新经济统计数据
    this.economy.highestWave = Math.max(this.economy.highestWave, this.waveManager.wave);
    
    // 这里可以添加将进度保存到本地存储或服务器的逻辑
    console.log('游戏进度已保存:', {
      wave: this.waveManager.wave,
      highestWave: this.progress.highestWave,
      money: this.economy.money,
      totalKills: this.economy.totalKills
    });
  }
  
  /**
   * 渲染游戏结束界面
   */
  private renderGameOverScreen(): void {
    // 绘制半透明黑色覆盖层
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制游戏结束界面背景
    const screenWidth = 500;
    const screenHeight = 400;
    const screenX = (this.canvas.width - screenWidth) / 2;
    const screenY = (this.canvas.height - screenHeight) / 2;
    
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(screenX, screenY, screenWidth, screenHeight);
    
    // 绘制边框
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(screenX, screenY, screenWidth, screenHeight);
    
    // 绘制标题
    this.ctx.font = 'bold 40px Arial';
    this.ctx.fillStyle = '#ff0000';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('游戏结束', this.canvas.width / 2, screenY + 60);
    
    // 绘制游戏统计信息
    this.ctx.font = '24px Arial';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(`最终波次: ${this.currentWave}`, this.canvas.width / 2, screenY + 120);
    this.ctx.fillText(`总击杀数: ${this.economy.totalKills}`, this.canvas.width / 2, screenY + 160);
    this.ctx.fillText(`获得金钱: ${this.economy.money}`, this.canvas.width / 2, screenY + 200);
    
    // 绘制最高记录
    this.ctx.font = '20px Arial';
    this.ctx.fillStyle = '#ffff00';
    this.ctx.fillText(`最高波次: ${this.progress.highestWave}`, this.canvas.width / 2, screenY + 250);
    
    // 绘制操作提示
    this.ctx.font = '18px Arial';
    this.ctx.fillStyle = '#cccccc';
    this.ctx.fillText('按 R 键重新开始游戏', this.canvas.width / 2, screenY + 300);
    this.ctx.fillText('按 M 键返回主菜单', this.canvas.width / 2, screenY + 330);
  }
}
