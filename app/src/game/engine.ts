/**
 * @fileoverview 《烈焰除蟑》游戏核心引擎（模块化委托架构）
 *
 * ============================================================================
 * 引擎概述
 * ============================================================================
 * 本文件是《烈焰除蟑》(Fire Roach Killer) 游戏的主引擎，约 4,000 行。
 *
 * 架构采用**模块化委托模式**：引擎本身负责状态管理、模块编排和副作用处理，
 * 将具体业务逻辑委托给 27 个独立子系统模块。模块通过回调函数与引擎通信，
 * 实现引擎 ↔ 模块的双向解耦。
 *
 * 已提取的 27 个模块按功能分组：
 *   基础系统  (3): SaveSystem, EconomyManager, AchievementSystem
 *   渲染系统  (7): ParticleSystem, ParticleSpawner, DropRenderer, RenderUtils,
 *                  RoachRenderer, NurseRenderer, BackgroundRenderer
 *   战斗系统 (12): CollisionSystem, WeaponSystem, StickySystem, FanSystem,
 *                  TripleFlameSystem, RadarLaserSystem, SwatterSystem,
 *                  AimingSystem, InsecticideSystem, ThrowableSystem,
 *                  PoisonSystem, ConsumableSystem
 *   大型系统  (2): BossBattleSystem, WaveManager
 *   AI 系统  (1): RoachAISystem
 *   天气系统  (1): WeatherSystem
 *   存档系统  (1): SaveSystem（已集成）
 *
 * 引擎保留的核心职责：
 *   1. 游戏状态机 —— MENU → PLAYING → WAVE_CLEAR → SHOP → ...
 *   2. 模块编排 —— 在 update() / render() 中按顺序调用各模块
 *   3. 副作用处理 —— 粒子、浮动文字、音效、振动、屏幕震动等
 *   4. 实体容器 —— roaches[], particles[], fireZones[] 等共享数组
 *   5. 输入处理 —— 鼠标/触摸坐标转换、拖拽、瞄准
 *   6. 图片资源 —— ~50+ 张场景/蟑螂/武器图片的加载与管理
 *   7. 音频系统 —— BGM、音效、循环音效管理
 *   8. 天赋系统 —— 15 个天赋节点，影响伤害/射程/燃气/防御等
 *   9. 存档流程 —— localStorage 持久化，版本迁移，进度同步
 *  10. 生命周期 —— 启动、暂停、恢复、重置、重启
 *
 * ============================================================================
 * 调用链路
 * ============================================================================
 *
 * 【启动流程】
 *   new GameEngine(canvas)
 *     → resize()            // 画布尺寸适配
 *     → loadImages()        // 异步加载 ~50+ 张图片资源
 *     → loadProgress()      // 读取 localStorage 存档
 *     → createPlayer()      // 创建玩家属性
 *     → createEconomy()     // 创建经济系统
 *     → recalcTalentMultipliers()  // 计算天赋加成
 *
 *   start(mode, scene, ...)
 *     → resetGame()         // 重置所有实体/状态
 *     → startWave() / initBossBattle()  // 开始波次或 Boss 战
 *     → gameLoop()          // 进入 requestAnimationFrame 主循环
 *
 * 【每帧更新链路】update() 按顺序调用（→ 表示委托给模块）：
 *   updateArmorShieldCache → updatePlayer（引擎） →
 *   roachAISystem.update() → consumableSystem.update() → updateParticles() →
 *   updateFireWalls() → stickySystem.updateStickyBoards() →
 *   stickySystem.updateStickyDrops() → bossSystem/updateWave() →
 *   updateScreenShake() → swatterSystem.updateSwatter() →
 *   weaponSystem.update() → aimingSystem.updateAiming() →
 *   throwableSystem.update() → tripleFlameSystem.updateTripleFlame() →
 *   radarLaserSystem.updateRadarLaser() → insecticideSystem.update() →
 *   fanSystem.updateFan() → updateWeather() → checkCollisions() →
 *   checkDefense() → checkAchievements()
 *
 * 【每帧渲染链路】render() 按顺序调用（→ 表示委托给模块）：
 *   BackgroundRenderer.renderBackground() → renderMovementRange() →
 *   BackgroundRenderer.renderWeatherBackground() →
 *   BackgroundRenderer.renderFireZones() →
 *   BackgroundRenderer.renderFireWalls() → renderStickyBoards() →
 *   renderStickyDrops() → renderWeaponDrops() → renderParticles() →
 *   renderBaitMark() → RoachRenderer.renderRoaches() → renderBaitThrow() →
 *   renderPlayer()（含 NurseRenderer.renderNurseHealVFX()） →
 *   renderFloatingTexts() → renderSwatter() → renderMuzzleFlash() →
 *   renderThrowableAim() → renderThrowables() → renderItemPlacement() →
 *   renderInsecticideSpray() → renderFan() → renderRadarLaser() →
 *   renderWeatherForeground() → renderBossUI() → renderItemDropOnField()
 *
 * 【外部调用接口】
 *   - GameCanvas: start(), stop(), pause(), resume(), restart()
 *   - 输入: setMousePos(), setMouseX(), handleScreenClick(), setFiring()
 *   - 武器: cycleFlameMode(), useSwatter(), startAiming(), throwAimedWeapon()
 *   - 道具: selectItem(), handleItemDropClick(), buyConsumable(), useConsumable()
 *   - 回调: onStateChange, onEconomyUpdate, onWaveUpdate, onGameOver 等
 *
 * ============================================================================
 * 模块通信机制：回调（Callbacks）
 * ============================================================================
 * 模块通过构造函数接收回调函数，实现与引擎的解耦通信：
 *
 *   引擎端（注入回调）:
 *     this.xxxSystem = new XxxSystem({
 *       onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
 *       onPlaySound: (name) => { this.audio.play(name); },
 *     });
 *
 *   模块端（调用回调）:
 *     this.config.onAddFloatingText?.(x, y, '伤害!', '#ff4444');
 *
 * 常用回调：onAddFloatingText, onPlaySound, onVibrate, onScreenShake,
 *          onAddParticle, onEconomyUpdate, onPlayerUpdate, onDefenseUpdate 等
 *
 * @version 2.8
 * @see {@link ../engine/} 各子系统模块目录
 */

import { GameState, RoachType, RoachState, SceneType, WeatherType, ParticleType, FlameMode, GameMode, SAVE_VERSION, type Roach, type Player, type Particle, type FireZone, type FireWall, type Economy, type WeaponDrop, type GameProgress, type WaveConfig, type ThrowableProjectile, type InventoryItem, type TripleFlameState, type BossBattleState, type RadarLaser, type StickyBoard, type StickyDrop, type FanState } from './types';
import * as Vibration from './vibration';
import { AudioManager } from './audio';
import { SCENE_CONFIGS, ENEMY_DEFS, TALENT_DEFS, WEAPON_DROP_DEFS, INVENTORY_SELL_PRICES, BOSS_CONFIG, SCENE_WAVE_CONFIGS, SCENE_ITEM_UNLOCKS, SCENE_ROACH_TYPES, SCENE_UNLOCK_CHAIN, SCENE_REWARD_ITEMS, SCENE_GROUND_BOUNDS, createDefaultProgress, ENCYCLOPEDIA_DEFS, CONSUMABLE_DEFS } from './data';
import { BOSS_ANIMATIONS } from './bossAnimation';
import { SaveSystem } from './engine/save/SaveSystem';
import { EconomyManager } from './engine/economy/EconomyManager';
import { AchievementSystem } from './engine/achievement/AchievementSystem';
import { ParticleSystem } from './engine/particle/ParticleSystem';
import { DropRenderer } from './engine/render/DropRenderer';
import { RenderUtils } from './engine/render/RenderUtils';
import { RoachRenderer } from './engine/render/RoachRenderer';
import { NurseRenderer } from './engine/render/NurseRenderer';
import { ParticleSpawner } from './engine/particle/ParticleSpawner';
import { BackgroundRenderer } from './engine/render/BackgroundRenderer';
import { CollisionSystem } from './engine/collision/CollisionSystem';
import { WeaponSystem } from './engine/weapon/WeaponSystem';
import { StickySystem } from './engine/sticky/StickySystem';
import { FanSystem } from './engine/fan/FanSystem';
import { TripleFlameSystem } from './engine/triple/TripleFlameSystem';
import { RadarLaserSystem } from './engine/radar/RadarLaserSystem';
import { SwatterSystem } from './engine/swatter/SwatterSystem';
import { AimingSystem } from './engine/aiming/AimingSystem';
import { InsecticideSystem } from './engine/insecticide/InsecticideSystem';
import { ThrowableSystem } from './engine/throwable/ThrowableSystem';
import { PoisonSystem } from './engine/poison/PoisonSystem';
import { ConsumableSystem } from './engine/consumable/ConsumableSystem';
import { BossBattleSystem } from './engine/boss/BossBattleSystem';
import { WaveManager } from './engine/wave/WaveManager';
import { WeatherSystem } from './engine/weather/WeatherSystem';
import { RoachAISystem, getNextId, setNextId, getNextBossId, setNextBossId } from './engine/ai/RoachAISystem';

// =============================================================================
// 模块级：内部类型与全局变量
// =============================================================================

/** 浮动文字特效数据（用于伤害数字、金钱提示、倒计时等 HUD 漂浮文字） */
interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  /** 垂直上升速度（负值 = 向上飘） */
  vy: number;
  /** 可选字体缩放（1.0 = 默认 16px） */
  scale?: number;
}

/** 全局蟑螂 ID 计数器（自增，确保每只蟑螂有唯一标识） */
let nextId = 1;
/** 全局 Boss ID 计数器（从 10000 起始，避免与普通蟑螂 ID 冲突） */
let nextBossId = 10000;

// =============================================================================
// 类：GameEngine —— 游戏核心引擎（单文件巨型类，~180 方法，~10,000 行）
// =============================================================================

/**
 * 游戏核心引擎类 —— 《烈焰除蟑》全部游戏逻辑的载体
 *
 * ## 架构特点
 * - 单文件巨型类，包含 ~200 个属性 + ~180 个方法
 * - 自管理 requestAnimationFrame 主循环
 * - 通过回调函数向外部 UI 组件通信
 *
 * ## 属性分组（按功能）
 * - 画布/渲染: canvas, ctx, width, height, scale
 * - 游戏状态: state, gameMode, currentScene, difficulty, isEasyMode
 * - 玩家/经济: player, economy, mouseX, mouseY
 * - 实体容器: roaches[], particles[], fireZones[], weaponDrops[], stickyBoards[], stickyDrops[], fireWalls[]
 * - 波次系统: wave, waveTimer, spawnQueue[], spawnTimer, waveSpawning
 * - Boss 战斗: bossBattle (30+ 子字段), activeBosses
 * - 武器系统: swatter*, tripleFlame, radarLaser, insecticideSpray, throwables[], aiming*
 * - 道具/消耗品: inventory[], consumableInventory, itemCooldowns, selectedItems[]
 * - 场景特效: fanState, weather*, baitThrowAnim, baitTarget
 * - 图片资源: gunImg, roachImg, bgImg, 各种蟑螂/场景图片 (~50+ 张)
 * - UI 元素: floatingTexts[], itemRevealData[], itemDropOnField
 * - 存档/进度: progress, talentMultipliers, scenesCleared
 * - 音频: audio (AudioManager 实例)
 * - 回调: onStateChange, onEconomyUpdate, onWaveUpdate, onGameOver 等 (~10 个)
 * - 医院专属: placedBombs[], deadTimedBombs[], hospitalStarRating
 *
 * ## 方法分组（按功能）
 * - 生命周期: constructor, resize, loadImages, start, stop, pause, resume, restart
 * - 主循环: gameLoop, update, render
 * - 玩家系统: createPlayer, createEconomy, updatePlayer, updateFlamethrower, updatePoisonSpray, updateShotgun
 * - 敌人系统: spawnRoach, updateRoaches, applyDamageToRoach, killRoach, spawnEmbryoRoaches, mutantDeathEffect
 * - 波次系统: updateWave, startWave, startCountdown, doWaveSpawn, getWaveConfig, continueFromShop
 * - 碰撞检测: checkCollisions, checkDefense, getWeaponDamage, applyWeaponEffect, triggerPanicOnArmorBreak
 * - Boss 战斗: initBossBattle, spawnBoss, updateBossBattle, triggerBossDeathSequence, startBossDialogue
 * - 武器系统: useSwatter, throwMolotov, activateTripleFlame, activateRadarLaser, activateInsecticideSpray, activateStickySpray, activateFan, activateMolotovFireWall
 * - 道具系统: spawnWeaponDrop, pickupWeaponDrop, selectItem, buyConsumable, useConsumable, toggleAutoUse
 * - 粒子系统: spawnConeFire, spawnSmokeParticles, spawnBloodParticles, spawnSparkParticles, spawnExplosionParticles, spawnDebrisParticles, spawnFireRingParticles, spawnShockwaveRing, spawnLightningParticles, addFloatingText
 * - 渲染系统: render, renderBackground, renderRoaches, renderRoach, renderPlayer, renderFireZones, renderFireWalls, renderParticles, renderBossUI, renderFan, renderInsecticideSpray, renderRadarLaser, renderSwatter, renderMuzzleFlash, renderWeatherBackground, renderWeatherForeground, renderFloatingTexts, renderDefenseLine, renderBaitThrow, renderBaitMark, renderMovementRange, renderItemDropOnField
 * - 存档系统: loadProgress, saveProgress, recalcTalentMultipliers, checkAchievements, unlockNextScene
 * - 输入处理: setMousePos, setMouseX, handleScreenClick, setFiring, cycleFlameMode, handleItemDropClick
 * - 医院专属: (已移除虫卵系统)
 * - 辅助方法: getGroundBoundsAtY, getGroundCenter, getPerspectiveScale, getSceneConfig, isStuckByBoard, getDailySeed, canControlBoss
 *
 * @class GameEngine
 * @see {@link ../engine/index.ts} 新版模块化引擎入口
 */
export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GameState = GameState.MENU;

  width = 540;
  height = 960; /** 固定 540x960 宽高比 */
  scale = 1;

  player: Player;
  roaches: Roach[] = [];
  particles: Particle[] = [];
  fireZones: FireZone[] = [];

  /** 火焰墙数组（燃烧瓶创建的水平火焰墙） */
  fireWalls: FireWall[] = [];

  /** 风扇系统（委托给 FanSystem） */
  /** 无限模式计时器 */
  endlessElapsedTime: number = 0;
  endlessBestTime: number = 0;
  endlessNewRecordShown: boolean = false;
  endlessNewRecordTimer: number = 0;
  floatingTexts: FloatingText[] = [];

  /** 战斗后道具揭示数据 */
  itemRevealData: { type: string; name: string; icon: string; desc: string }[] = [];
  onItemRevealComplete?: () => void;
  /** 玩家为本关选择的道具（来自准备界面） */
  selectedItems: string[] = [];
  // 携带消耗品库存（购买 → 携带 → 自动/手动使用，委托给 ConsumableSystem）
  // 各消耗品自动使用设置（委托给 ConsumableSystem）
  // 紧急冷却库存（从商店购买，免费使用次数，委托给 ConsumableSystem）
  // Buff 闪烁计时器（用于 HUD 显示，委托给 ConsumableSystem）
  // 诱饵投掷动画状态（委托给 ConsumableSystem）
  // 诱饵目标位置（委托给 ConsumableSystem）
  // 力量加成倒计时追踪（委托给 ConsumableSystem）
  /** 动态粒子上限（根据设备性能自适应调整） */
  _particleLimit: number = 300;
  _frameTimeSamples: number[] = [];
  _perfCheckFrames: number = 0;
  _isLowPerfDevice: boolean = false;
  onConsumableUpdate?: (inventory: Record<string, number>, buffTimers: Record<string, number>, cooldowns?: Record<string, number>, globalCooldown?: number, combatStartTimer?: number, itemCooldowns?: Record<string, number>) => void;
  onEmergencyCoolUpdate?: (count: number) => void;
  /** 战斗后道具掉落（场景中可点击的掉落物） */
  itemDropOnField: { type: string; name: string; icon: string; x: number; y: number; targetY: number; bobPhase: number; collected: boolean; falling: boolean; fallSpeed: number } | null = null;

  get wave(): number { return this.waveManager!.wave; }
  set wave(v: number) { this.waveManager!.wave = v; }
  get waveTimer(): number { return this.waveManager!.waveTimer; }
  set waveTimer(v: number) { this.waveManager!.waveTimer = v; }
  get waveSpawning(): boolean { return this.waveManager!.waveSpawning; }
  set waveSpawning(v: boolean) { this.waveManager!.waveSpawning = v; }
  get spawnQueue(): { type: RoachType; clusterId?: number }[] { return this.waveManager!.spawnQueue; }
  set spawnQueue(v: { type: RoachType; clusterId?: number }[]) { this.waveManager!.spawnQueue = v; }
  get spawnTimer(): number { return this.waveManager!.spawnTimer; }
  set spawnTimer(v: number) { this.waveManager!.spawnTimer = v; }
  get waveJustCleared(): boolean { return this.waveManager!.waveJustCleared; }
  set waveJustCleared(v: boolean) { this.waveManager!.waveJustCleared = v; }
  get waveClearTimer(): number { return this.waveManager!.waveClearTimer; }
  set waveClearTimer(v: number) { this.waveManager!.waveClearTimer = v; }

  economy: Economy;

  mouseX: number = 480;
  mouseY: number = 400;

  screenShake: number = 0;
  screenShakeX: number = 0;
  screenShakeY: number = 0;

  defenseHp: number = 80;
  maxDefenseHp: number = 80;

  difficulty: 'easy' | 'hard' = 'easy';
  gameMode: GameMode = GameMode.STORY;
  currentScene: SceneType = SceneType.KITCHEN;

  audio: AudioManager = new AudioManager();

  /** 电蚊拍系统（委托给 SwatterSystem） */

  time: number = 0;
  deltaTime: number = 0;
  lastTime: number = 0;

  gunImg: HTMLImageElement | null = null;
  roachImg: HTMLImageElement | null = null;
  roachSuicideImg: HTMLImageElement | null = null;
  roachFlyingImg: HTMLImageElement | null = null;
  roachFlyingSuicideImg: HTMLImageElement | null = null;
  roachTimedSuicideImg: HTMLImageElement | null = null;
  roachArmoredImg: HTMLImageElement | null = null;
  roachSplittingImg: HTMLImageElement | null = null;
  roachQueenImg: HTMLImageElement | null = null;
  /** 医院场景专属蟑螂图片 */
  roachNurseImg: HTMLImageElement | null = null;
  /** 护士施法：10帧治疗动画 */
  nurseCastFrames: (HTMLImageElement | null)[] = [];
  roachMutantImg: HTMLImageElement | null = null;
  /** 变异变形：7帧序列动画（每帧200ms，共1.4秒） */
  mutantTransformFrames: (HTMLImageElement | null)[] = [];
  roachAISystem!: RoachAISystem;
  /** Boss 图片资源（阶段变体预留给未来使用） */
  /** Boss 动画系统（帧数据由引擎管理，与 bossSystem 共享） */
  bossAnimFrames: Map<string, HTMLImageElement[]> = new Map();
  get bossAnimState(): { action: string; frameIndex: number; timer: number } {
    return this.bossSystem!.bossAnimState;
  }
  set bossAnimState(v: { action: string; frameIndex: number; timer: number }) {
    this.bossSystem!.bossAnimState = v;
  }
  bgImg: HTMLImageElement | null = null;
  bgKitchenHardImg: HTMLImageElement | null = null;
  bgKitchenEasyImg: HTMLImageElement | null = null;
  bgSewerImg: HTMLImageElement | null = null;
  bgSewerEasyImg: HTMLImageElement | null = null;
  bgSewerHardImg: HTMLImageElement | null = null;
  bgDumpImg: HTMLImageElement | null = null;
  bgDumpEasyImg: HTMLImageElement | null = null;
  bgDumpHardImg: HTMLImageElement | null = null;
  bgBasementImg: HTMLImageElement | null = null;
  bgBasementEasyImg: HTMLImageElement | null = null;
  bgBasementHardImg: HTMLImageElement | null = null;
  bgRooftopImg: HTMLImageElement | null = null;
  bgRooftopEasyImg: HTMLImageElement | null = null;
  bgRooftopHardImg: HTMLImageElement | null = null;
  bgStreetImg: HTMLImageElement | null = null;
  bgStreetEasyImg: HTMLImageElement | null = null;
  bgStreetHardImg: HTMLImageElement | null = null;
  /** 通用场景背景图缓存（按 sceneType 索引） */
  bgSceneImages: Record<string, HTMLImageElement> = {};
  /** 简单模式标志（难度为 'easy' 时为 true） */
  isEasyMode: boolean = false;
  imagesLoaded: boolean = false;

  /** 掉落道具图片缓存 */
  _dropImages: Record<string, HTMLImageElement> | null = null;

  animationId: number = 0;
  onStateChange?: (state: GameState) => void;
  onTutorialPauseChange?: (paused: boolean) => void;
  onEconomyUpdate?: (economy: Economy) => void;
  onInventoryUpdate?: (inventory: InventoryItem[]) => void;
  onPlayerUpdate?: (player: Player) => void;
  onWaveUpdate?: (wave: number, totalWaves: number) => void;
  onDefenseUpdate?: (hp: number, maxHp: number) => void;
  onGameOver?: (economy: Economy, wave: number) => void;
  onBossUpdate?: (bossState: BossBattleState) => void;
  onWaveClear?: () => void;

  /** Boss 战斗状态（委托给 BossBattleSystem） */
  get bossBattle(): BossBattleState {
    return this.bossSystem!.bossBattle;
  }
  set bossBattle(v: BossBattleState) {
    this.bossSystem!.bossBattle = v;
  }

  /** 天赋与进度 */
  progress: GameProgress;
  talentMultipliers: Record<string, number> = {};

  /** 天气系统 */
  weatherParticles: Particle[] = [];
  lightningTimer: number = 0;
  lightningFlash: number = 0;
  /** 成就系统模块（委托给 AchievementSystem） */
  private achievementSystem: AchievementSystem | null = null;
  /** 粒子系统模块（委托给 ParticleSystem） */
  private particleSystem: ParticleSystem | null = null;
  /** 碰撞检测系统模块（委托给 CollisionSystem） */
  private collisionSystem: CollisionSystem | null = null;
  /** 武器系统模块（委托给 WeaponSystem） */
  private weaponSystem: WeaponSystem | null = null;
  /** 粘板/粘液弹系统模块（委托给 StickySystem） */
  private stickySystem: StickySystem | null = null;
  /** 风扇系统模块（委托给 FanSystem） */
  private fanSystem: FanSystem | null = null;
  /** 三重火焰系统模块（委托给 TripleFlameSystem） */
  private tripleFlameSystem: TripleFlameSystem | null = null;
  /** 雷达激光系统模块（委托给 RadarLaserSystem） */
  private radarLaserSystem: RadarLaserSystem | null = null;
  /** 电蚊拍系统模块（委托给 SwatterSystem） */
  swatterSystem: SwatterSystem | null = null;
  /** 瞄准系统模块（委托给 AimingSystem） */
  private aimingSystem: AimingSystem | null = null;
  /** 杀虫剂喷雾系统模块（委托给 InsecticideSystem） */
  private insecticideSystem: InsecticideSystem | null = null;
  /** 投掷物系统模块（委托给 ThrowableSystem） */
  private throwableSystem: ThrowableSystem | null = null;
  /** 毒雾系统模块（委托给 PoisonSystem） */
  private poisonSystem: PoisonSystem | null = null;
  /** 消耗品系统模块（委托给 ConsumableSystem） */
  private consumableSystem: ConsumableSystem | null = null;
  /** Boss战斗系统模块（委托给 BossBattleSystem） */
  private bossSystem: BossBattleSystem | null = null;
  /** 波次系统模块（委托给 WaveManager） */
  private waveManager: WaveManager | null = null;

  /** Boss 活跃数（委托给 BossBattleSystem） */
  get activeBosses(): number { return this.bossSystem!.activeBosses; }
  set activeBosses(v: number) { this.bossSystem!.activeBosses = v; }

  /** 失败/重新开始保护：防止 gameDefeat() 被多次调用 */
  defeatTriggered: boolean = false;

  /** 厨房第一波教程暂停：阻止生成直到教程完成 */
  get tutorialPauseSpawn(): boolean { return this.waveManager!.tutorialPauseSpawn; }
  set tutorialPauseSpawn(v: boolean) { this.waveManager!.tutorialPauseSpawn = v; }

  /** 波次前 3-2-1 倒计时状态 */
  get countdownTimer(): number { return this.waveManager!.countdownTimer; }
  set countdownTimer(v: number) { this.waveManager!.countdownTimer = v; }
  get countdownPhase(): number { return this.waveManager!.countdownPhase; }
  set countdownPhase(v: number) { this.waveManager!.countdownPhase = v; }
  get countdownWavePending(): boolean { return this.waveManager!.countdownWavePending; }
  set countdownWavePending(v: boolean) { this.waveManager!.countdownWavePending = v; }

  /** 库存回收快照：清空前保存，用于关卡结束时的 UI 动画 */
  recycledInventory: { type: string; count: number }[] = [];

  /** 投掷物瞄准系统（委托给 AimingSystem） */
  // isAiming/aimTargetX are getter/setter that delegate to aimingSystem
  get isAiming(): boolean { return this.aimingSystem?.getAimingState().isAiming ?? false; }
  get aimTargetX(): number { return this.aimingSystem?.getAimingState().aimTargetX ?? 0; }
  set aimTargetX(v: number) { this.aimingSystem?.setAimTarget(v, this.aimingSystem?.getAimingState().aimTargetY ?? 0); }

  /** 三重火焰（委托给 TripleFlameSystem，供 GameCanvas 兼容） */
  get tripleFlame(): { active: boolean; timer: number } { return this.tripleFlameSystem!.getState(); }

  /** 消耗品（委托给 ConsumableSystem，供 GameCanvas 兼容） */
  get consumableInventory(): Record<string, number> { return this.consumableSystem!.consumableInventory; }
  set consumableInventory(v: Record<string, number>) { this.consumableSystem!.consumableInventory = v; }
  get emergencyCoolInventory(): number { return this.consumableSystem!.emergencyCoolInventory; }
  set emergencyCoolInventory(v: number) { this.consumableSystem!.emergencyCoolInventory = v; }

  /** 投掷物投射物（委托给 ThrowableSystem 模块） */

  /** 武器/道具库存（拾取的道具掉落） */
  inventory: InventoryItem[] = [];
  selectedItemIndex: number = -1;
  itemPlaceState: 'idle' | 'pending_click' | 'placing' = 'idle';
  itemPlaceCursorX: number = 0;
  itemPlaceCursorY: number = 0;
  itemEffectRadiusX: number = 100;
  itemEffectRadiusY: number = 50;
  /** 拾取道具冷却系统（委托给 ConsumableSystem） */

  /** 三重火焰系统（委托给 TripleFlameSystem 模块） */

  /** 厨房困难模式背景标志 */
  useKitchenHardBg: boolean = false;

  /** 雷达激光系统（委托给 RadarLaserSystem 模块） */
  /** 杀虫剂喷雾系统（委托给 InsecticideSystem 模块） */

  /** 每日挑战种子 */
  dailySeed: number = 0;

  /** 已通关场景（用于进度追踪） */
  scenesCleared: Set<SceneType> = new Set();

  /** 显示地面边界线（蟑螂可走区域可视化） */
  showMovementRange: boolean = false;

  /** 装甲肉盾缓存：定期更新以避免每帧 O(n²) 检测 */
  armorShieldCache: Set<number> = new Set(); /** 受附近装甲蟑螂保护的蟑螂 ID */
  armorShieldCacheTimer: number = 0;

  // ===== 装甲肉盾缓存系统 =====

  // ===== 医院专属：定时自爆炸弹系统 =====
  placedBombs: { id: number; x: number; y: number; timer: number }[] = [];
  bombImg: HTMLImageElement | null = null;
  /** 死去的定时自爆蟑螂炸弹：被击杀后在地面留下3秒倒计时炸弹 */
  deadTimedBombs: { id: number; x: number; y: number; timer: number; flashPhase: number }[] = [];
  nextBombId: number = 1; /** 死定时炸弹 ID 递增计数器 */
  /** 定时自爆蟑螂交错生成：每只间隔8秒生成以保持节奏 */
  timedSuicideSpawnTimer: number = 0; // countdown until next timed suicide spawn
  timedSuicideSpawnRemaining: number = 0; // how many timed suicides still to spawn this wave

  // [已移除] 医院虫卵系统 — 死代码
  // ===== 医院专属：三星评级系统 =====
  hospitalTotalEggPods: number = 0; // 本关生成的虫卵总数
  hospitalDestroyedEggPods: number = 0; // 本关摧毁的虫卵总数
  hospitalBreaches: number = 0; // 本关防线突破次数（用于星级评定）
  hospitalStarRating: number = 0; // 0-3 stars

  /** 消耗品冷却系统（委托给 ConsumableSystem） */

  // =============================================================================
  // 生命周期方法：构造函数、画布适配、资源加载
  // =============================================================================

  /**
   * 创建游戏引擎实例
   * @param {HTMLCanvasElement} canvas - 游戏画布元素
   */
  constructor(canvas: HTMLCanvasElement) {
    // ===== 画布设置 =====
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    // ===== 资源加载 =====
    this.loadImages();
    // ===== 存档系统 =====
    this.progress = this.loadProgress(); // 必须在 createPlayer() 之前加载
    // 从 localStorage 恢复之前检测到的粒子上限
    const savedLimit = SaveSystem.loadParticleLimit();
    if (savedLimit !== 300) {
      this._particleLimit = savedLimit;
      this._isLowPerfDevice = this._particleLimit <= 200;
    }
    this.player = this.createPlayer();
    this.economy = this.createEconomy();
    this.endlessBestTime = this.loadEndlessBestTime();
    this.recalcTalentMultipliers();
    // ===== 初始化各子系统模块 =====
    this.achievementSystem = new AchievementSystem({
      economyStats: {
        totalKills: 0,
        highestWave: 0,
        highestEndlessWave: 0,
        totalMoneyEarned: 0,
        perfectWaves: 0,
        breaches: 0,
        queenKills: 0,
        flyingKills: 0,
        armoredKills: 0,
      },
      playerProgress: this.progress,
      canvasWidth: this.width,
      canvasHeight: this.height,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onAddMoney: (amount) => { this.economy.money += amount; },
      onSaveProgress: () => { this.saveProgress(); },
      onEconomyUpdate: (e) => { this.onEconomyUpdate?.(this.economy); },
    });
    this.particleSystem = new ParticleSystem({
      particleLimit: this._particleLimit,
      deltaTime: 0.016,
      defenseLineY: this.defenseLineY(),
      canvasWidth: this.width,
      canvasHeight: this.height,
    });
    this.collisionSystem = new CollisionSystem({
      difficulty: this.difficulty as 'easy' | 'hard',
      currentScene: this.currentScene,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onSpawnSpark: (x, y, count) => { ParticleSpawner.spawnSparkParticles(this.particles,x, y, count); },
      onPlayBreach: () => { this.audio.playBreach(); },
      onVibrateBreach: () => { Vibration.vibrateBreach(); },
      onVibrateGameOver: () => { Vibration.vibrateGameOver(); },
    });
    this.weaponSystem = new WeaponSystem({
      difficulty: this.difficulty as 'easy' | 'hard',
      gameState: this.state,
      gameMode: this.gameMode,
      currentScene: this.currentScene,
      unlockedWeapons: this.progress.weaponsUnlocked || [],
      selectedItems: this.selectedItems,
      talentMultipliers: this.talentMultipliers,
      canvasWidth: this.width,
      sceneEnemyModifier: this.getSceneConfig().enemyModifier || 1,
      onPickup: (drop, pickupCount, bonusText) => {
        // 添加到物品栏
        const itemType = drop.type as 'sticky' | 'poison' | 'molotov' | 'shotgun' | 'radar' | 'fan' | 'swatter';
        const existing = this.inventory.find(item => item.type === itemType);
        if (existing) {
          existing.count += pickupCount;
        } else {
          this.inventory.push({ type: itemType, count: pickupCount });
        }
        // 浮动文字和屏幕震动
        const def = WEAPON_DROP_DEFS[drop.type];
        if (def) {
          this.addFloatingText(this.player.x, this.player.y - 80, `拾取: ${def.name}!${bonusText}`, '#4ade80');
        }
        this.screenShake = 2;
      },
      onSwitchWeapon: (weapon, weaponName) => {
        this.addFloatingText(this.player.x, this.player.y - 60, `切换到: ${weaponName}`, '#facc15');
      },
    });
    this.stickySystem = new StickySystem({
      canvasWidth: this.width,
      canvasHeight: this.height,
      getDefenseLineY: () => this.defenseLineY(),
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onAddParticle: (p) => { this.particles.push(p); },
      onSpawnSpark: (x, y, count) => { ParticleSpawner.spawnSparkParticles(this.particles,x, y, count); },
      onPlayStickySpray: () => { this.audio.playStickySpray(); },
      onVibrateItemUse: () => { Vibration.vibrateItemUse(); },
      onScreenShake: (amount) => { this.screenShake = amount; },
    });
    this.fanSystem = new FanSystem({
      canvasWidth: this.width,
      canvasHeight: this.height,
      defenseLineY: () => this.defenseLineY(),
      talentMultipliers: this.talentMultipliers,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onStartFanLoop: () => { this.audio.startFanLoop(); },
      onStopFanLoop: () => { this.audio.stopFanLoop(); },
      onScreenShake: (amount) => { this.screenShake = amount; },
    });
    this.tripleFlameSystem = new TripleFlameSystem({
      canvasWidth: this.width,
      canvasHeight: this.height,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onPlayShotgunActivate: () => { this.audio.playShotgunActivate(); },
      onVibrateItemUse: () => { Vibration.vibrateItemUse(); },
    });
    this.radarLaserSystem = new RadarLaserSystem({
      canvasWidth: this.width,
      canvasHeight: this.height,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onPlayRadarActivate: () => { this.audio.playRadarActivate(); },
      onPlayRadarShot: () => { this.audio.playRadarShot(); },
      onVibrateItemUse: () => { Vibration.vibrateItemUse(); },
      onSpawnSparkParticles: (x, y, count) => { ParticleSpawner.spawnSparkParticles(this.particles,x, y, count); },
      onAddParticle: (p) => { this.particles.push(p); },
      onKillRoach: (roach, index) => { this.killRoach(roach, index); },
    });
    this.swatterSystem = new SwatterSystem({
      canvasWidth: this.width,
      canvasHeight: this.height,
      talentCdReduction: this.talentMultipliers.swatterCdReduction || 0,
      onAddFloatingText: (x, y, text, color, duration?) => { this.addFloatingText(x, y, text, color, duration); },
      onPlaySwatter: () => { this.audio.playSwatter(); },
      onSpawnSparkParticles: (x, y, count) => { ParticleSpawner.spawnSparkParticles(this.particles,x, y, count); },
      onSpawnLightningParticles: (centerX, topY) => { ParticleSpawner.spawnLightningParticles(this.particles, centerX, topY, this.width, this.height); },
      onScreenShake: (amount) => { this.screenShake = amount; },
      onInventoryUpdate: (inventory) => { this.onInventoryUpdate?.(inventory); },
    });
    this.aimingSystem = new AimingSystem({
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onPlaySound: (soundName) => {
        if (soundName === 'molotov_throw') { this.audio.playMolotovThrow(); }
      },
    });
    this.insecticideSystem = new InsecticideSystem({
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onPlaySound: (soundName) => {
        if (soundName === 'insecticide_spray') { this.audio.playInsecticideSpray(); }
      },
      onVibrate: () => { Vibration.vibrateItemUse(); },
      onScreenShake: (amount) => { this.screenShake = amount; },
    });
    this.throwableSystem = new ThrowableSystem({
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onAddFireZone: (fireZone) => { this.fireZones.push(fireZone); },
      onSpawnSparkParticles: (x, y, count) => { ParticleSpawner.spawnSparkParticles(this.particles,x, y, count); },
      onSpawnExplosionParticles: (x, y, count) => { ParticleSpawner.spawnExplosionParticles(this.particles,x, y, count); },
      onSpawnIceExplosion: (x, y, _radius) => {
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 50 + Math.random() * 100;
          this.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 30,
            life: 0.4 + Math.random() * 0.6, maxLife: 1,
            size: 3 + Math.random() * 8,
            color: `hsl(${180 + Math.random() * 30}, 90%, ${70 + Math.random() * 20}%)`,
            type: ParticleType.ICE,
          });
        }
      },
      onSpawnPoisonExplosion: (x, y, radius) => { PoisonSystem.spawnPoisonExplosion(this.particles, x, y, radius); },
      onScreenShake: (amount) => { this.screenShake = amount; },
    });
    this.poisonSystem = new PoisonSystem({
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onScreenShake: (amount) => { this.screenShake = amount; },
    });
    this.consumableSystem = new ConsumableSystem({
      consumableDefs: CONSUMABLE_DEFS,
      onAddFloatingText: (x, y, text, color, duration?, fontSize?) => { this.addFloatingText(x, y, text, color, duration, fontSize); },
      onSpawnSmokeParticles: (x, y, count) => { ParticleSpawner.spawnSmokeParticles(this.particles,x, y, count); },
      onAddParticle: (p) => { this.particles.push(p); },
      onConsumableUpdate: (inv, buffTimers, cooldowns, globalCd, combatTimer, itemCds) => {
        this.onConsumableUpdate?.(inv, buffTimers, cooldowns, globalCd, combatTimer, itemCds);
      },
      onEmergencyCoolUpdate: (count) => {
        this.onEmergencyCoolUpdate?.(count);
      },
      onEconomyUpdate: (e) => { this.onEconomyUpdate?.(e); },
      onPlayerUpdate: (p) => { this.onPlayerUpdate?.(p); },
      onDefenseUpdate: (hp, maxHp) => {
        this.defenseHp = hp;
        this.maxDefenseHp = maxHp;
        this.onDefenseUpdate?.(hp, maxHp);
      },
      getPlayer: () => this.player,
      getDefenseHp: () => this.defenseHp,
      getMaxDefenseHp: () => this.maxDefenseHp,
      getCanvasWidth: () => this.width,
      getCanvasHeight: () => this.height,
      getGameState: () => this.state,
      getDefenseLineY: () => this.defenseLineY(),
      getGroundCenter: () => this.getGroundCenter(),
      getParticleLimit: () => this._particleLimit,
      getParticleCount: () => this.particles.length,
      getEconomy: () => this.economy,
      setEconomy: (e) => {
        this.economy = e;
        // 同步到 RoachAISystem，防止击杀奖励加到旧 economy 对象上
        this.roachAISystem?.updateConfig({ economy: e });
      },
    });
    // ===== 恢复持久化消耗品库存 =====
    // Restore persistent consumable inventory from progress
    if (this.progress.consumableInventory) {
      this.consumableSystem!.consumableInventory = { ...this.progress.consumableInventory };
    }
    if (this.progress.autoUseEnabled) {
      this.consumableSystem!.autoUseEnabled = { ...this.progress.autoUseEnabled };
    }
    // ===== 初始化 BossBattleSystem =====
    // Initialize BossBattleSystem
    this.bossSystem = new BossBattleSystem(
      {
        width: this.width, height: this.height, difficulty: this.difficulty as 'easy' | 'normal' | 'hard',
        deltaTime: this.deltaTime, time: this.time, defenseHp: this.defenseHp,
        defenseMaxHp: this.maxDefenseHp, gameMode: this.gameMode, state: this.state,
        currentScene: this.currentScene,
      },
      {
        onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
        onSpawnExplosionParticles: (x, y, count) => { ParticleSpawner.spawnExplosionParticles(this.particles,x, y, count); },
        onSpawnShockwaveRing: (x, y, radius) => { ParticleSpawner.spawnShockwaveRing(this.particles,x, y, radius); },
        onScreenShake: (intensity) => { this.screenShake = intensity; },
        onBossUpdate: (bossState) => { this.onBossUpdate?.(bossState); },
        onGameVictory: () => { this.gameVictory(); },
        onGameDefeat: () => { this.gameDefeat(); },
        onSellUnusedInventory: () => this.sellUnusedInventory(),
        onSaveProgress: () => { this.saveProgress(); },
        onStopBGM: () => { this.audio.stopBGM(); },
        onPlayVictoryBGM: () => { this.audio.playVictoryBGM(); },
        onStateChange: (state) => { this.state = state; this.onStateChange?.(state); },
        onGameOver: (economy, wave) => { this.onGameOver?.(economy, wave); },
        onWaveClear: () => { this.onWaveClear?.(); },
        onGetEconomy: () => this.economy,
        onGetProgress: () => this.progress,
        onGetRoaches: () => this.roaches,
        onPushRoach: (roach) => { this.roaches.push(roach); },
        onRemoveRoach: (roach) => {
          const idx = this.roaches.indexOf(roach);
          if (idx >= 0) this.roaches.splice(idx, 1);
        },
        onSetActiveBosses: (count) => { this.bossSystem!.activeBosses = count; },
        onGetLivingNonBossCount: () => this.roaches.filter(r => r.state === RoachState.ALIVE && !r.isBoss).length,
      },
      this.bossAnimFrames,
    );

    // ===== 初始化 RoachAISystem（在 BossBattleSystem 之后，确保 this.bossSystem 可用） =====
    this.roachAISystem = new RoachAISystem({
      roaches: this.roaches,
      particles: this.particles,
      fireWalls: this.fireWalls,
      player: this.player,
      economy: this.economy,
      progress: this.progress,
      placedBombs: this.placedBombs,
      deadTimedBombs: this.deadTimedBombs,
      armorShieldCache: this.armorShieldCache,
      stickySystem: this.stickySystem!,
      bossSystem: this.bossSystem!,
      consumableSystem: this.consumableSystem!,
      audio: this.audio,
      getDifficulty: () => this.difficulty,
      getCurrentScene: () => this.currentScene,
      getGameMode: () => this.gameMode,
      getState: () => this.state,
      getTime: () => this.time,
      getDeltaTime: () => this.deltaTime,
      getCanvasWidth: () => this.width,
      getCanvasHeight: () => this.height,
      getDefenseHp: () => this.defenseHp,
      getMaxDefenseHp: () => this.maxDefenseHp,
      getWave: () => this.wave,
      getTalentMultipliers: () => this.talentMultipliers,
      getDefenseLineY: () => this.defenseLineY(),
      getGroundBoundsAtY: (y) => this.getGroundBoundsAtY(y),
      getWaveConfig: (wave) => this.getWaveConfig(wave),
      getSceneConfig: () => this.getSceneConfig(),
      setState: (state) => { this.state = state; this.onStateChange?.(state); },
      setScreenShake: (amount) => { this.screenShake = amount; },
      setDefenseHp: (hp) => { this.defenseHp = hp; },
      setEconomy: (e) => { this.economy = e; },
      setHospitalBreaches: (count) => { this.hospitalBreaches = count; },
      onAddFloatingText: (x, y, text, color, duration?) => { this.addFloatingText(x, y, text, color, duration); },
      onSpawnRoach: (type, clusterId?) => this.spawnRoach(type, clusterId),
      onApplyDamageToRoach: (r, damage) => { this.applyDamageToRoach(r, damage); },
      onSaveProgress: () => { this.saveProgress(); },
      onGameOver: (economy, wave) => { this.onGameOver?.(economy, wave); },
      onStateChange: (state) => { this.onStateChange?.(state); },
      onEconomyUpdate: (economy) => { this.onEconomyUpdate?.(economy); },
      onDefenseUpdate: (hp, maxHp) => { this.onDefenseUpdate?.(hp, maxHp); },
      onBossUpdate: (bossState) => { this.onBossUpdate?.(bossState); },
      onGameVictory: () => { this.gameVictory(); },
      onSellUnusedInventory: () => this.sellUnusedInventory(),
      onUnlockNextScene: () => this.unlockNextScene(),
    });

    // ===== 初始化 WaveManager =====
    this.waveManager = new WaveManager(
      {
        width: this.width, height: this.height, difficulty: this.difficulty as string,
        gameMode: this.gameMode, currentScene: this.currentScene,
      },
      {
        onSpawnRoach: (type, clusterId) => { this.spawnRoach(type, clusterId); },
        onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
        onStateChange: (state) => { this.state = state; this.onStateChange?.(state); },
        onGameVictory: () => { this.gameVictory(); },
        onSaveProgress: () => { this.saveProgress(); },
        onUnlockNextScene: () => { this.unlockNextScene(); },
        onPlayBGM: () => { this.audio.startLevelBGM(); },
        onTutorialPauseChange: (paused) => { this.onTutorialPauseChange?.(paused); },
        onKillRoach: (roach, idx) => { this.killRoach(roach, idx); },
        onGetRoaches: () => this.roaches,
        onGetEconomy: () => this.economy,
        onGetProgress: () => this.progress,
        onGetTimedSuicideRemaining: () => this.timedSuicideSpawnRemaining,
        onSetTimedSuicideRemaining: (count) => { this.timedSuicideSpawnRemaining = count; },
        onSetTimedSuicideTimer: (timer) => { this.timedSuicideSpawnTimer = timer; },
      }
    );
    // ===== 窗口自适应 =====
    window.addEventListener('resize', () => this.resize());
  }

  /** 根据 game-container 容器调整画布大小与 DPR */
  resize() {
    // 优先使用 #game-container（全屏容器），确保画布填满屏幕高度
    const container = document.getElementById('game-container') || this.canvas.parentElement;
    if (!container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    let displayWidth = rect.width;
    let displayHeight = rect.height;
    // Contain 模式：画布等比缩放，始终完整显示在容器内，不裁剪任何内容
    const scaleX = rect.width / 540;
    const scaleY = rect.height / 960;
    const scale = Math.min(scaleX, scaleY);
    displayWidth = 540 * scale;
    displayHeight = 960 * scale;
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    this.canvas.width = Math.floor(displayWidth * dpr);
    this.canvas.height = Math.floor(displayHeight * dpr);
    this.scale = this.canvas.width / 540;
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

  // ===== 生命周期方法：加载、存档、创建 =====

  /** 异步加载所有游戏图片资源 */
  loadImages() {
    const load = (src: string, setter: (img: HTMLImageElement) => void) => {
      const img = new Image();
      img.onload = () => { setter(img); };
      img.src = src;
    };
    load('/assets/gun.png', (img) => this.gunImg = img);
    load('/assets/roach.png', (img) => this.roachImg = img);
    load('/assets/bg.jpg', (img) => this.bgImg = img);
    load('/assets/roach_suicide.png', (img) => this.roachSuicideImg = img);
    load('/assets/roach_timed_suicide.png', (img) => this.roachTimedSuicideImg = img);
    load('/assets/roach_flying.png', (img) => this.roachFlyingImg = img);
    load('/assets/roach_flying_suicide.png', (img) => this.roachFlyingSuicideImg = img);
    load('/assets/roach_armored.png', (img) => this.roachArmoredImg = img);
    load('/assets/roach_splitting.png', (img) => this.roachSplittingImg = img);
    load('/assets/roach_queen.png', (img) => this.roachQueenImg = img);
    // Hospital exclusive roach images
    load('/assets/roach_nurse.png', (img) => this.roachNurseImg = img);
    // 加载 10 帧护士施法动画
    for (let i = 1; i <= 10; i++) {
      const frameIdx = i - 1;
      load(`/assets/nurse_cast_${i.toString().padStart(2, '0')}.png`, (img) => this.nurseCastFrames[frameIdx] = img);
    }
    load('/assets/roach_mutant.png', (img) => this.roachMutantImg = img);
    // 加载 7 帧变形序列
    for (let i = 1; i <= 7; i++) {
      const frameIdx = i - 1;
      load(`/assets/mutant_0${i}.png`, (img) => this.mutantTransformFrames[frameIdx] = img);
    }
    load('/assets/bomb.png', (img) => this.bombImg = img);
    // Boss animation frames - only load frames that exist on disk
    // Missing actions automatically fallback to 'idle' frames
    const actionsWithFrames: Record<string, number> = {
      idle: 7,   // 7 frames available
      hover: 3,  // 3 frames available
      // 所有其他动作回退到 idle 帧
    };
    for (const [action, frameCount] of Object.entries(actionsWithFrames)) {
      this.bossAnimFrames.set(action, []);
      for (let i = 1; i <= frameCount; i++) {
        const idx = i;
        load(`/boss/${action}/${action}_0${i}.png`, (img) => {
          const frames = this.bossAnimFrames.get(action);
          if (frames) frames[idx - 1] = img;
        });
      }
    }
    // 为缺失的动作设置空数组（渲染器将回退到 idle）
    const fallbackActions = ['walk','charge','summon','defend','hit','hurt','die','roar','mock','transform'];
    for (const action of fallbackActions) {
      this.bossAnimFrames.set(action, []); // empty - renderer will fallback to idle
    }
    // 粘板图片加载由 DropRenderer 模块处理
    load('/assets/bg_kitchen_hard.jpg?v=3', (img) => this.bgKitchenHardImg = img);
    load('/assets/bg_kitchen_easy.jpg?v=5', (img) => this.bgKitchenEasyImg = img);
    load('/assets/sewer_bg.jpg', (img) => this.bgSewerImg = img);
    load('/assets/sewer_bg_easy.jpg?v=3', (img) => this.bgSewerEasyImg = img);
    load('/assets/sewer_bg_hard.jpg?v=5', (img) => this.bgSewerHardImg = img);
    load('/assets/bg_dump.jpg', (img) => this.bgDumpImg = img);
    load('/assets/bg_dump_easy.jpg?v=4', (img) => this.bgDumpEasyImg = img);
    load('/assets/bg_dump_hard.jpg?v=5', (img) => this.bgDumpHardImg = img);
    load('/assets/bg_basement.jpg', (img) => this.bgBasementImg = img);
    load('/assets/bg_basement_easy.jpg?v=3', (img) => this.bgBasementEasyImg = img);
    load('/assets/bg_basement_hard.jpg?v=5', (img) => this.bgBasementHardImg = img);
    load('/assets/bg_rooftop.jpg', (img) => this.bgRooftopImg = img);
    load('/assets/bg_rooftop_easy.jpg?v=4', (img) => this.bgRooftopEasyImg = img);
    load('/assets/bg_rooftop_hard.jpg?v=5', (img) => this.bgRooftopHardImg = img);
    load('/assets/bg_street.jpg', (img) => this.bgStreetImg = img);
    load('/assets/bg_street_easy.jpg?v=6', (img) => this.bgStreetEasyImg = img);
    load('/assets/bg_street_hard.jpg?v=6', (img) => this.bgStreetHardImg = img);
    // 加载场景背景图片（从 SCENE_CONFIGS 中配置的新场景）
    for (const [sceneType, config] of Object.entries(SCENE_CONFIGS)) {
      if (config.bgImage) {
        const img = new Image();
        img.src = config.bgImage;
        this.bgSceneImages[sceneType] = img;
      }
    }
    this.imagesLoaded = true;
  }

  /** 玩家基准 X 坐标（屏幕中央） */
  playerBaseX() { return this.width / 2; }
  /** 玩家基准 Y 坐标（屏幕下方） */
  playerBaseY() { return this.height + 100; }
  /** 防线 Y 坐标 */
  defenseLineY() { return this.height - 130; }

  getSceneConfig() {
    return SCENE_CONFIGS[this.currentScene];
  }

  /** 创建并初始化玩家对象 */
  createPlayer(): Player {
    const isHard = this.difficulty === 'hard';
    const gasMult = this.talentMultipliers.gasMultiplier || 1;
    const ohMult = this.talentMultipliers.overheatMultiplier || 1;
    const coolMult = this.talentMultipliers.coolingMultiplier || 1;
    const rangeMult = this.talentMultipliers.fireRangeMultiplier || 1;
    // 玩家基础属性 — 仅天赋树加成，商店升级不叠加
    // 商店已重新设计为一次性消耗品（燃气补充、防线修复等）
    const fireRange = 440 * rangeMult;
    const damageMultiplier = this.talentMultipliers.damageMultiplier || 1;
    const heatDecayRate = (isHard ? 1 : 1.5) * coolMult;
    const overheatThreshold = 1800 * ohMult;
    const maxGas = 100 * gasMult;
    const reloadTimeMultiplier = 1;
    return {
      x: this.playerBaseX(),
      y: this.playerBaseY(),
      angle: -Math.PI / 2,
      isFiring: false,
      flameMode: FlameMode.CONE,
      gas: maxGas,
      maxGas,
      heat: 0,
      maxHeat: overheatThreshold,
      overheatTimer: 0,
      isOverheated: false,
      isReloading: false,
      reloadTimer: 0,
      maxReloadTime: (isHard ? 15 : 8) * reloadTimeMultiplier,
      coolingTimer: 0,
      fireRange,
      damageMultiplier,
      heatDecayRate,
      overheatThreshold,
      gasCostMultiplier: 1,
      currentWeapon: 'flamethrower',
      weaponAmmo: { flamethrower: Infinity },
      weaponTimer: 0,
      isTempWeapon: false,
      shotgunPellets: 5,
      molotovCount: 0,
      shieldActive: false,
      shieldHp: 0,
      damageReduction: this.talentMultipliers.defenseMultiplier ? 1 - (this.talentMultipliers.defenseMultiplier - 1) * 0.1 : 0,
      paralyzeTimer: 0,
      heatWarningTimer: 0,
      // 消耗品临时效果计时器
      powerBoostTimer: 0,
      shieldTimer: 0,
      baitTimer: 0,
      // 遗留字段（不再从商店升级中应用）
      flameSpreadMultiplier: 1,
      reloadTimeMultiplier: 1,
      // Required fields for Player interface
      weaponsUnlocked: ['flamethrower'],
      money: 0,
    };
  }

  /**
   * 创建经济统计对象
   * @param {number} initialMoney - 初始金钱
   */
  createEconomy(initialMoney?: number): Economy {
    const hasRewardMult = !!this.talentMultipliers?.rewardMultiplier;
    return EconomyManager.createDefaultEconomy(initialMoney, this.difficulty, hasRewardMult);
  }

  // =============================================================================
  // 存档与进度系统：localStorage 持久化，支持版本迁移
  // 包含：存档读写、天赋加成计算、成就检测、场景解锁
  // =============================================================================
  /** 从 localStorage 加载游戏进度（委托给 SaveSystem 模块） */
  loadProgress(): GameProgress {
    return SaveSystem.loadProgress();
  }

  loadEndlessBestTime(): number {
    return SaveSystem.loadEndlessBestTime();
  }

  /** 保存无尽模式最佳时长到 localStorage */
  saveEndlessBestTime(time: number) {
    SaveSystem.saveEndlessBestTime(time);
  }

  /** 将当前进度保存到 localStorage */
  saveProgress() {
    // 同步消耗品库存到进度后再保存
    this.progress.consumableInventory = { ...this.consumableSystem!.consumableInventory };
    this.progress.autoUseEnabled = { ...this.consumableSystem!.autoUseEnabled };
    SaveSystem.saveProgress(this.progress);
  }

  /** 重新计算天赋倍数（委托给 EconomyManager 模块） */
  recalcTalentMultipliers() {
    this.talentMultipliers = EconomyManager.calculateTalentMultipliers(this.progress);
    // 同步天赋倍数到 WeaponSystem
    this.weaponSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
  }

  /** 检查成就（委托给 AchievementSystem 模块） */
  checkAchievements() {
    // 同步经济统计数据到成就系统
    this.achievementSystem!.updateEconomyStats({
      totalKills: this.economy.totalKills,
      highestWave: this.economy.highestWave,
      highestEndlessWave: this.economy.highestEndlessWave,
      totalMoneyEarned: this.economy.totalMoneyEarned,
      perfectWaves: this.economy.perfectWaves,
      breaches: this.economy.breaches,
      queenKills: this.economy.queenKills,
      flyingKills: this.economy.flyingKills,
      armoredKills: this.economy.armoredKills,
    });
    this.achievementSystem!.checkAchievements();
  }

  // =============================================================================
  // 游戏流程控制：启动、暂停、恢复、停止、重新开始、商店接续
  // =============================================================================
  // ===== 游戏流程控制 =====

  /**
   * 启动游戏
   * @param {GameMode} mode - 游戏模式
   * @param {SceneType} scene - 场景类型
   * @param {boolean} keepShopUpgrades - 是否保留商店升级
   * @param {string[]} selectedItems - 玩家选择的道具
   * @param {number} initialMoney - 初始金钱
   */
  start(mode?: GameMode, scene?: SceneType, keepShopUpgrades = false, selectedItems?: string[], initialMoney?: number) {
    if (mode !== undefined) this.gameMode = mode;
    if (scene !== undefined) this.currentScene = scene;
    this.isEasyMode = this.difficulty === 'easy';
    this.useKitchenHardBg = (this.currentScene === SceneType.KITCHEN && this.difficulty === 'hard');
    // ===== CRITICAL: Reset boss battle state for ALL modes =====
    // 防止 Boss 逻辑在非 Boss 模式后泄漏到普通模式
    this.bossSystem!.resetForNonBossMode();

    // 启动新循环前取消任何现有循环（防止重复循环）
    cancelAnimationFrame(this.animationId);
    this.state = GameState.PLAYING;
    // 全新开始时重置商店升级（从菜单启动），转场景时保留
    if (!keepShopUpgrades) {
      this.progress.shopUpgrades = [];
    }
    this.resetGame(initialMoney);
    // 设置本关玩家选择的道具（在 resetGame 之后，避免被清除）
    if (selectedItems && selectedItems.length > 0) {
      this.selectedItems = selectedItems;
    }
    // 同步 WeaponSystem 配置到当前游戏设置
    this.weaponSystem?.updateConfig({
      difficulty: this.difficulty as 'easy' | 'hard',
      gameState: this.state,
      gameMode: this.gameMode,
      currentScene: this.currentScene,
      unlockedWeapons: this.progress.weaponsUnlocked || [],
      selectedItems: this.selectedItems,
      talentMultipliers: this.talentMultipliers,
      sceneEnemyModifier: this.getSceneConfig().enemyModifier || 1,
    });
    // Start the first wave (BOSS mode has its own initBossBattle logic)
    if (this.gameMode !== GameMode.BOSS) {
      this.startWave();
    }
    this.audio.resumeAudioContext();
    // BGM 现在由 GameCanvas 在对话/漫画完成后启动
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
    this.onStateChange?.(this.state);
  }

  /**
   * 重置游戏：清空所有实体和状态，为新一局做准备
   * @param {number} initialMoney - 初始金钱
   */
  resetGame(initialMoney?: number) {
    this.player = this.createPlayer();
    this.economy = this.createEconomy(initialMoney);
    this.roaches = [];
    this.particles = [];
    this.fireZones = [];
    this.stickySystem?.reset();
    this.fireWalls = [];
    this.fanSystem?.reset();
    this.floatingTexts = [];
    this.weaponSystem?.reset();
    this.selectedItems = []; // Clear player-selected items
    this.armorShieldCache.clear();
    this.armorShieldCacheTimer = 0;
    this.hospitalTotalEggPods = 0;
    this.hospitalDestroyedEggPods = 0;
    this.hospitalBreaches = 0;
    this.hospitalStarRating = 0;
    this.placedBombs = [];
    this.timedSuicideSpawnTimer = 0;
    this.timedSuicideSpawnRemaining = 0;
    this.consumableSystem?.reset();
    this.roachAISystem?.reset();
    // Sync new array references after resetGame() creates new arrays
    this.roachAISystem?.updateConfig({
      roaches: this.roaches,
      particles: this.particles,
      fireWalls: this.fireWalls,
      armorShieldCache: this.armorShieldCache,
      economy: this.economy, // 必须同步 economy 引用，否则击杀奖励加到旧对象上
    });
    // 为新游戏会话重置性能检测
    this._perfCheckFrames = 0;
    this._frameTimeSamples = [];
    this.weatherParticles = [];
    this.wave = 0;
    this.waveManager!.reset();
    // 场景切换后同步 WaveManager 配置
    this.waveManager!.updateConfig({
      currentScene: this.currentScene,
      gameMode: this.gameMode,
      difficulty: this.difficulty as string,
    });
    this.waveTimer = 1;
    this.bossSystem!.activeBosses = 0;
    this.defeatTriggered = false;
    this.tutorialPauseSpawn = false;
    this.throwableSystem?.reset();
    this.aimingSystem?.reset();
    this.inventory = [];
    this.selectedItemIndex = -1;
    this.itemPlaceState = 'idle';
    this.tripleFlameSystem?.reset();
    this.radarLaserSystem?.reset();
    this.swatterSystem?.reset();
    this.insecticideSystem?.reset();
    const defMult = this.talentMultipliers.defenseMultiplier || 1;
    this.defenseHp = 80 * defMult;
    this.maxDefenseHp = this.defenseHp;
    this.time = 0;
    this.screenShake = 0;
    this.lightningTimer = 0;
    this.lightningFlash = 0;
    this.achievementSystem?.reset();
    this.particleSystem?.clearAll();
    this.economy.totalGamesPlayed = this.progress.totalKills + 1;
    this.endlessElapsedTime = 0;
    this.endlessNewRecordShown = false;
    this.endlessNewRecordTimer = 0;

    // 在 BOSS 模式下初始化 Boss 战斗
    if (this.gameMode === GameMode.BOSS) {
      this.bossSystem!.initBossBattle();
    }

    if (this.gameMode === GameMode.DAILY) {
      this.dailySeed = this.getDailySeed();
    }
  }

  getDailySeed(): number {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  /** 暂停游戏 */
  pause() {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      this.audio.pauseBGM();
      this.audio.stopFire();
      this.audio.stopFanLoop();
      this.audio.stopFireWallBurn();
      this.audio.stopFlyingBuzzLoop();
      cancelAnimationFrame(this.animationId);
      this.onStateChange?.(this.state);
    }
  }

  /** 恢复游戏 */
  resume() {
    if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      this.audio.resumeBGM();
      this.lastTime = performance.now();
      this.gameLoop(this.lastTime);
      this.onStateChange?.(this.state);
    }
  }

  /** 停止游戏循环 */
  stop() {
    this.state = GameState.MENU;
    this.audio.stopBGM();
    this.audio.stopGameOverBGM();
    this.audio.stopVictoryBGM();
    this.audio.stopFire();
    this.audio.stopFanLoop();
    this.audio.stopFireWallBurn();
    cancelAnimationFrame(this.animationId);
    this.onStateChange?.(this.state);
  }

  /** 重新开始当前关卡 */
  restart() {
    this.stop();
    setTimeout(() => this.start(this.gameMode, this.currentScene, false), 50);
  }

  /** 从商店继续到下一波（玩家在商店点击"继续"时调用） */
  continueFromShop() {
    this.state = GameState.PLAYING;
    this.waveManager!.reset();
    this.waveManager!.startWave();
    // 如果游戏循环已停止，恢复它
    if (!this.animationId) {
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
    this.onStateChange?.(this.state);
  }

  // =============================================================================
  // 主循环：gameLoop → update() → render() 驱动整个游戏运转
  // =============================================================================

  // ===== 主循环 =====

  /**
   * 游戏主循环：通过 requestAnimationFrame 驱动 update + render
   * 每一帧执行：deltaTime 计算 → 性能自适应 → update() → render()
   * @param {number} now - 当前时间戳
   */
  gameLoop = (now: number) => {
    // 允许在 PLAYING、COUNTDOWN、ITEM_DROP、ITEM_REVEAL、WAVE_CLEAR 状态下运行循环
    // COUNTDOWN: 3-2-1 波次前倒计时（update() 处理计时器）
    // WAVE_CLEAR 显示商店界面（无游戏逻辑更新，仅渲染）
    if (this.state !== GameState.PLAYING && this.state !== GameState.COUNTDOWN && this.state !== GameState.ITEM_DROP && this.state !== GameState.ITEM_REVEAL && this.state !== GameState.WAVE_CLEAR) return;
    this.deltaTime = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.time += this.deltaTime;
    // Dynamic particle limit: adjust based on frame time performance
    this._perfCheckFrames++;
    if (this._perfCheckFrames <= 120) {
      // 收集前120帧的帧时间样本（约2秒）
      this._frameTimeSamples.push(this.deltaTime);
    } else if (this._perfCheckFrames === 121) {
      // 计算平均帧时间并设置粒子上限
      const avgFrameTime = this._frameTimeSamples.reduce((a, b) => a + b, 0) / this._frameTimeSamples.length;
      if (avgFrameTime > 0.033) {
        // < 30fps: low-end device, reduce to 150
        this._particleLimit = 150;
        this._isLowPerfDevice = true;
      } else if (avgFrameTime > 0.025) {
        // < 40fps: mid-low device, reduce to 200
        this._particleLimit = 200;
        this._isLowPerfDevice = true;
      } else if (avgFrameTime > 0.02) {
        // < 50fps: mid device, use 250
        this._particleLimit = 250;
      } else {
        // 50+ fps: high-end device, allow up to 400
        this._particleLimit = 400;
      }
      // 持久化检测到的上限供未来会话使用
      SaveSystem.saveParticleLimit(this._particleLimit);
      this._frameTimeSamples = []; // 释放内存
    }
    // 运行时自适应：如果帧时间激增，暂时降低上限
    if (this._perfCheckFrames > 121 && this.deltaTime > 0.04 && this._particleLimit > 150) {
      this._particleLimit = Math.max(150, this._particleLimit - 10);
    } else if (this._perfCheckFrames > 121 && this.deltaTime < 0.018 && this._particleLimit < 400 && !this._isLowPerfDevice) {
      // 帧时间良好时逐渐恢复上限
      this._particleLimit = Math.min(400, this._particleLimit + 1);
    }
    // 安全兜底：捕获意外错误防止游戏冻结
    try {
      this.update();
      this.render();
    } catch (e) {
      console.error('[GameEngine] Critical error in game loop:', e);
      // 继续运行，不冻结游戏
    }
    this.animationId = requestAnimationFrame(this.gameLoop);
  };


  // ===== Boss 战斗 =====

  /** 初始化 Boss 战斗状态与波次配置 */
  initBossBattle() {
    this.bossSystem!.initBossBattle();
  }

  spawnBoss() {
    const boss = this.bossSystem!.spawnBoss();
    this.roaches.push(boss);
  }

  // 中央 BOSS 死亡序列：从 updateBossBattle 或后期更新的系统（如雷达激光）调用
  triggerBossDeathSequence() {
    this.bossSystem!.triggerBossDeathSequence();
  }

  // 更新死亡序列计时器（动画 → 尸体停留 → 胜利）
  // 每帧从 updateBossBattle 调用
  updateBossDeathSequence() {
    this.bossSystem!.updateBossDeathSequence();
  }

  updateBossBattle() {
    const result = this.bossSystem!.updateBossBattle();
    if (result.spawnEggWave) {
      this.spawnEggWave(result.spawnEggWave);
    }
    if (result.startBossDialogue) {
      this.bossSystem!.startBossDialogue();
    }
  }

  // ===== 虫卵系统（4波 Boss 机制） =====
  // 波次计数：0=初始化 → 1=第一波 → 2=第二波 → 3=第三波 → 4=第四波 → 5=胜利
  // Boss HP：4（满血）→ 3（第一波后）→ 2（第二波后）→ 1（第三波后）→ 0（第四波后）
  updateEggPodSystem() {
    this.bossSystem!.updateEggPodSystem();
  }

  // Boss 召唤施法动画：虫卵从上方掉落
  startBossSummonCast(wave: number) {
    this.bossSystem!.startBossSummonCast(wave);
    // 创建施法粒子（黑暗能量在 Boss 位置聚集）
    const boss = this.roaches.find(r => r.isBoss);
    const castX = boss ? boss.x : this.width / 2;
    const castY = boss ? boss.y : this.height * 0.25;
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2;
      const dist = 30 + Math.random() * 40;
      this.particles.push({
        x: castX + Math.cos(angle) * dist,
        y: castY + Math.sin(angle) * dist * 0.5,
        vx: -Math.cos(angle) * (20 + Math.random() * 30),
        vy: -Math.sin(angle) * (10 + Math.random() * 20),
        life: 1.5, maxLife: 1.5,
        size: 3 + Math.random() * 4,
        color: 'rgba(120, 60, 180, 0.8)',
        type: ParticleType.SPARK,
      });
    }
  }

  spawnEggWave(wave: number) {
    const bb = this.bossBattle;

    // ===== 波次配置：难度递增，混合类型 =====
    // 每波有双倍虫卵，所以数量较高
    interface WavePodConfig { count: number; types: RoachType[]; name: string; }
    const waveConfigs: WavePodConfig[] = [
      // Wave 1: Mostly small + some large (30 pods)
      {
        count: 30,
        types: [RoachType.SMALL, RoachType.SMALL, RoachType.SMALL, RoachType.SMALL, RoachType.LARGE],
        name: '虫卵入侵',
      },
      // Wave 2: Large + flying mix (24 pods)
      {
        count: 24,
        types: [RoachType.LARGE, RoachType.LARGE, RoachType.FLYING, RoachType.SMALL, RoachType.SUICIDE],
        name: '大蟑螂卵',
      },
      // 第三波：飞行 + 装甲 + 自爆（20个虫卵）
      {
        count: 20,
        types: [RoachType.FLYING, RoachType.FLYING, RoachType.ARMORED, RoachType.SUICIDE, RoachType.FLYING_SUICIDE],
        name: '飞行蟑螂卵',
      },
      // 第四波：全精英类型（16个虫卵）
      {
        count: 16,
        types: [RoachType.ARMORED, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN, RoachType.SPLITTING],
        name: '精英蟑螂卵',
      },
    ];

    const config = waveConfigs[wave - 1];
    if (!config) return;

    // 更新阶段名称
    const phaseNames = ['虫卵入侵', '大蟑螂卵', '飞行蟑螂卵', '精英蟑螂卵'];
    bb.phaseName = phaseNames[wave - 1] || '';
    bb.phaseJustChanged = true;
    bb.phaseChangeTimer = 3;
    bb.phaseChangeText = `【第${wave}波: ${config.name}】`;

    /** 统计各类型蟑螂数量用于显示 */
    const typeCounts: Record<string, number> = {};
    for (const t of config.types) {
      const name = ENEMY_DEFS[t]?.name || t;
      typeCounts[name] = (typeCounts[name] || 0) + 1;
    }
    const typeDesc = Object.entries(typeCounts).map(([n, c]) => `${n}x${c}`).join(' ');
    bb.phaseChangeSub = `BOSS释放了${config.count}个虫卵! (${typeDesc})`;

    // Spawn egg pods at RANDOM positions on the rooftop ground
    // Based on bg_rooftop.jpg analysis:
    // - Fence line (top of ground): Y ≈ 0.36
    // - Ground usable area: Y ≈ 0.41 ~ 0.90
    // - Must be within 300px of defense line (0.90)
    // - Final range: max(0.41, 0.90-300/h) ~ 0.90
    // [REMOVED] Egg pod spawn logic removed
    for (let i = 0; i < config.count; i++) {
      // Egg pod system removed
    }

    this.addFloatingText(this.width / 2, this.height / 3, `第${wave}波虫卵释放!`, '#ef4444');
    this.addFloatingText(this.width / 2, this.height / 3 + 25, `${config.count}个虫卵即将孵化`, '#fbbf24');
    this.screenShake = 6;
  }

  updateEggPods() {
    // [REMOVED] Egg pod system removed
  }

  // [REMOVED] hatchEggPod(pod: any) { // Egg pod system removed
  // }

  // [REMOVED] damageEggPod(podId: number, damage: number) {
  //   // Egg pod system removed
  // }

  // 电蚊拍拾取（委托给 SwatterSystem 模块）
  spawnSwatterPickup(x: number, y: number) {
    this.swatterSystem!.spawnSwatterPickup(x, y, this.inventory, (inv) => { this.onInventoryUpdate?.(inv); });
  }

  // ===== BOSS 对话与逃跑（胜利序列） =====
  startBossDialogue() {
    this.bossSystem!.startBossDialogue();
  }

  // 完成道具揭示，进入波次清除
  completeItemReveal() {
    // If there are more rewards, show the next one
    if (this.rewardIndex < this.itemRevealData.length - 1) {
      this.spawnNextRewardDrop(this.rewardIndex + 1);
    } else {
      // 所有奖励已显示，进入波次清除
      this.state = GameState.WAVE_CLEAR;
      this.onWaveClear?.();
    }
  }

  // Snapshot inventory for recycle animation.
  // Does NOT add gold yet — applyRecycledGold() is called after animation ends.
  // Does NOT clear inventory yet — clearRecycledInventory() is called after animation ends.
  sellUnusedInventory(): number {
    let total = 0;
    // Save snapshot for UI animation
    this.recycledInventory = this.inventory
      .filter(item => (INVENTORY_SELL_PRICES[item.type] || 0) > 0 && item.count > 0)
      .map(item => ({ ...item }));
    for (const item of this.inventory) {
      const price = INVENTORY_SELL_PRICES[item.type] || 0;
      total += price * item.count;
    }
    // 金币不在此处添加（在 applyRecycledGold() 中处理）
    return total;
  }

  /** 在回收动画完成后调用 — 将回收的金币添加到经济系统 */
  applyRecycledGold() {
    let total = 0;
    for (const item of this.recycledInventory) {
      const price = INVENTORY_SELL_PRICES[item.type] || 0;
      total += price * item.count;
    }
    if (total > 0) {
      this.economy.money += total;
      this.economy.totalMoneyEarned += total;
    }
    this.onEconomyUpdate?.(this.economy);
  }

  /** 在回收动画完成后调用 — 实际清空库存 */
  clearRecycledInventory() {
    this.inventory = [];
    this.recycledInventory = [];
    this.onInventoryUpdate?.([]);
  }

  /** 触发游戏胜利流程 */
  gameVictory() {
    // 在胜利界面之前出售未使用的库存道具
    const sellTotal = this.sellUnusedInventory();
    if (sellTotal > 0) {
      this.addFloatingText(this.width / 2, this.height * 0.3, `道具回收 +¥${sellTotal}`, '#fbbf24');
    }

    this.screenShake = 8;
    // 停止所有武器（禁用射击）
    this.player.isFiring = false;
    this.player.isOverheated = false;
    this.player.heat = 0;
    this.player.heatWarningTimer = 0;
    // 战斗结束时停止所有武器和连续音效
    this.audio.stopFire();
    this.audio.stopFanLoop();
    this.audio.stopFireWallBurn();
    this.audio.stopFlyingBuzzLoop();
    // 播放胜利 BGM（替换场景 BGM）
    this.audio.playVictoryBGM();

    // BOSS mode: no item drops - boss battle is distinct from story mode
    if (this.gameMode === GameMode.BOSS) {
      this.state = GameState.WAVE_CLEAR;
      this.onWaveClear?.();
      return;
    }

    // Story mode: award talent points based on scene difficulty
    const sceneConfig = SCENE_CONFIGS[this.currentScene];
    const talentReward = Math.floor(100 * (sceneConfig?.rewardMultiplier || 1));
    this.addTalentPoints(talentReward);
    this.saveProgress();
    // 显示天赋点奖励浮动文字
    this.addFloatingText(this.width / 2, this.height * 0.35, `+${talentReward} 天赋点!`, '#fbbf24');

    // ===== 医院专属：三星评级系统 =====
    if (this.currentScene === SceneType.HOSPITAL) {
      // 计算星级评定
      // ⭐: 通关
      // ⭐⭐: 通关 + 防线突破 <= 1
      // ⭐⭐⭐: 通关 + 0次防线突破
      let stars = 1; // 基础：通关
      if (this.hospitalBreaches <= 1) stars = 2;
      if (this.hospitalBreaches === 0) stars = 3;
      this.hospitalStarRating = stars;

      // 显示星级评定浮动文字
      const starText = '⭐'.repeat(stars);
      const ratingTexts = ['', '通关!', '优秀!', '完美!'];
      this.addFloatingText(this.width / 2, this.height * 0.45, starText, '#fbbf24');
      this.addFloatingText(this.width / 2, this.height * 0.5, ratingTexts[stars], stars === 3 ? '#fbbf24' : (stars === 2 ? '#c084fc' : '#94a3b8'));
      if (this.hospitalBreaches > 0) {
        this.addFloatingText(this.width / 2, this.height * 0.55, `防线突破: ${this.hospitalBreaches}次`, '#f87171');
      }
    }

    // 剧情模式：正常道具掉落奖励流程
    const rewards = SCENE_REWARD_ITEMS[this.currentScene];
    // 只揭示新解锁的道具（跳过已解锁的）
    const newlyUnlocked: typeof rewards = [];
    for (const reward of rewards) {
      if (!this.progress.weaponsUnlocked?.includes(reward.type)) {
        if (!this.progress.weaponsUnlocked) this.progress.weaponsUnlocked = [];
        this.progress.weaponsUnlocked.push(reward.type);
        newlyUnlocked.push(reward); // only add to reveal if it's newly unlocked
      }
    }
    this.saveProgress();
    this.itemRevealData = newlyUnlocked;
    if (this.itemRevealData.length > 0) {
      this.spawnNextRewardDrop(0);
    } else {
      this.state = GameState.WAVE_CLEAR;
      this.onWaveClear?.();
    }
  }

  // 在场景中生成第 N 个奖励掉落
  rewardIndex = 0;
  spawnNextRewardDrop(index: number) {
    this.rewardIndex = index;
    const reward = this.itemRevealData[index];
    if (!reward) return;
    this.itemDropOnField = {
      type: reward.type,
      name: reward.name,
      icon: reward.icon,
      x: this.width / 2,
      y: -60,
      targetY: this.height * 0.7,
      bobPhase: 0,
      collected: false,
      falling: true,
      fallSpeed: 80,
    };
    this.audio.playItemDropFanfare();
    this.state = GameState.ITEM_DROP;
    this.onStateChange?.(GameState.ITEM_DROP);
  }

  // Called after gameplay tutorial completes - resume first wave spawn
  // Mirrors startWave() spawn logic exactly, but preserves the current wave number
  // (wave was already incremented to 1 by the initial startWave() call).
  resumeSpawnAfterTutorial() {
    if (!this.tutorialPauseSpawn) return;
    this.tutorialPauseSpawn = false;
    this.onTutorialPauseChange?.(false);

    // After tutorial completes, start countdown before first wave
    if (this.startCountdown()) return;

    // 没有倒计时（例如非第一波），直接生成
    this.doWaveSpawn();
  }

  /** 触发游戏失败流程 */
  gameDefeat() {
    // Guard: prevent multiple calls
    if (this.defeatTriggered) return;
    this.defeatTriggered = true;
    // Defense breach: no gold reward, no item recycling, clear all earned gold
    this.economy.money = 0;
    this.state = GameState.GAME_OVER;
    this.addFloatingText(this.width / 2, this.height / 2, '防线被攻破! 战斗失败!', '#ef4444');
    this.screenShake = 12;
    this.audio.stopBGM();
    this.audio.stopFire();
    this.audio.stopFanLoop();
    this.audio.stopFireWallBurn();
    this.audio.stopFlyingBuzzLoop();
    // Play game over BGM immediately (don't wait for state change)
    this.audio.playGameOverBGM();
    // Notify UI after short delay (for visual effect)
    setTimeout(() => {
      this.onGameOver?.(this.economy, this.bossSystem!.bossBattle.currentWave);
    }, 2000);
  }

  // Compute armor for egg-hatched roaches
  // [REMOVED] computeEggPodArmor(type: RoachType, def: EnemyDef, hpMult: number): number {
  //   return 0; // Egg pod system removed
  // }

  canControlBoss(): boolean {
    return this.bossSystem!.canControlBoss();
  }

  // ===== 主更新循环 =====
  /** 主游戏更新循环（每帧调用） */
  update() {
    // ===== 波次前倒计时 =====
    // 在第一波前处理 3-2-1 倒计时，冻结所有游戏逻辑
    if (this.state === GameState.COUNTDOWN) {
      this.countdownTimer -= this.deltaTime;
      // 更新显示阶段（3 → 2 → 1）
      const newPhase = Math.ceil(this.countdownTimer);
      if (newPhase !== this.countdownPhase && newPhase >= 1) {
        this.countdownPhase = newPhase;
        // 每个数字变化时播放滴答音效
        this.audio.playCountdownTick();
      }
      // 倒计时期间仍更新视觉特效（粒子、屏幕震动）
      this.updateParticles();
      this.updateScreenShake();
      // 倒计时结束 → 开始波次
      if (this.countdownTimer <= 0) {
        this.doWaveSpawn();
      }
      return;
    }

    // 道具掉落/字幕/波次清除期间跳过所有游戏逻辑
    // 只更新视觉特效（粒子、浮动文字、屏幕震动）
    if (this.state === GameState.ITEM_DROP || this.state === GameState.ITEM_REVEAL || this.state === GameState.WAVE_CLEAR) {
      this.updateParticles();
      this.updateScreenShake();
      // Update bait throw animation even in wave clear
      if (this.state === GameState.WAVE_CLEAR) {
        this.consumableSystem!.update(this.deltaTime);
      }
      // Falling animation for the dropped item
      if (this.itemDropOnField && !this.itemDropOnField.collected && this.itemDropOnField.falling) {
        this.itemDropOnField.y += this.itemDropOnField.fallSpeed * this.deltaTime;
        this.itemDropOnField.fallSpeed += 40 * this.deltaTime; // 落地动画：重力加速度
        if (this.itemDropOnField.y >= this.itemDropOnField.targetY) {
          this.itemDropOnField.y = this.itemDropOnField.targetY;
          this.itemDropOnField.falling = false;
        }
      }
      // 落地后上下浮动动画
      if (this.itemDropOnField && !this.itemDropOnField.collected && !this.itemDropOnField.falling) {
        this.itemDropOnField.bobPhase += this.deltaTime * 3;
      }
      return;
    }
    this.updateArmorShieldCache();
    this.updatePlayer();
    this.roachAISystem!.update();
    this.consumableSystem!.update(this.deltaTime);
    this.consumableSystem!.checkAutoUseConsumables();
    this.updateParticles();
    this.updateFireWalls();
    this.stickySystem!.updateStickyBoards(this.deltaTime, this.roaches);
    this.stickySystem!.updateStickyDrops(this.deltaTime, this.time, this.roaches);
    if (this.gameMode === GameMode.BOSS) {
      this.bossSystem!.updateConfig({
        width: this.width, height: this.height, deltaTime: this.deltaTime,
        time: this.time, defenseHp: this.defenseHp, defenseMaxHp: this.maxDefenseHp,
        gameMode: this.gameMode, state: this.state,
      });
      this.updateBossBattle();
    } else {
      this.updateWave();
    }
    this.updateScreenShake();
    this.swatterSystem!.updateSwatter(this.deltaTime, this.player.x, this.player.y);
    this.weaponSystem!.update(this.deltaTime, this.player, this.defenseLineY(), this.tutorialPauseSpawn);
    this.aimingSystem!.updateAiming(this.time, this.width, this.defenseLineY(), this.player.y);
    this.throwableSystem!.update(this.deltaTime, this.roaches);
    this.tripleFlameSystem!.updateTripleFlame(this.deltaTime);
    this.radarLaserSystem!.updateRadarLaser(this.deltaTime, this.roaches, this.player.x, this.player.y);
    // Insecticide spray: add particles returned by the system
    const insecticideParticles = this.insecticideSystem!.update(this.deltaTime, this.width, this.height, this.defenseLineY(), this.roaches);
    for (const p of insecticideParticles) { this.particles.push(p); }
    this.fanSystem!.updateFan(this.deltaTime, this.roaches);
    this.updateWeather();
    this.checkCollisions();
    this.checkDefense();
    this.checkAchievements();

    // ===== BOSS 死亡安全网 =====
    // 所有武器系统已运行完毕。如果 Boss 已死亡但死亡序列尚未触发
    // （因为致命一击来自 updateBossBattle 之后运行的系统），现在触发它。
    this.bossSystem!.checkBossDeathSafetyNet();

    // Endless mode timer
    if (this.gameMode === GameMode.ENDLESS && this.state === GameState.PLAYING) {
      this.endlessElapsedTime += this.deltaTime;
      // Check new record
      if (this.endlessBestTime > 0 && this.endlessElapsedTime > this.endlessBestTime && !this.endlessNewRecordShown) {
        this.endlessNewRecordShown = true;
        this.endlessNewRecordTimer = 3; // 3 seconds
        this.addFloatingText(this.width * 0.75, 60, '你创造了新纪录!', '#fbbf24');
        this.addFloatingText(this.width * 0.75, 80, '历史最高时长已刷新!', '#fde047');
        this.screenShake = 6;
        Vibration.vibrateNewRecord();
      }
      if (this.endlessNewRecordTimer > 0) {
        this.endlessNewRecordTimer -= this.deltaTime;
      }
    }

    // Decrement green slime burst effect timer
    if (this.roachAISystem!.slimeBurstTimer > 0) {
      this.roachAISystem!.slimeBurstTimer -= this.deltaTime;
    }

    this.onPlayerUpdate?.(this.player);
    this.onEconomyUpdate?.(this.economy);
    const actualTotalWaves = this.gameMode === GameMode.ENDLESS ? 999 : (SCENE_WAVE_CONFIGS[this.currentScene]?.length || 10);
    this.onWaveUpdate?.(this.wave, actualTotalWaves);
    this.onDefenseUpdate?.(this.defenseHp, this.maxDefenseHp);
  }

  // ========== ARMOR MEAT SHIELD CACHE ==========
  // Periodically update which roaches are protected by nearby armored roaches.
  // Runs every 0.3s to avoid O(n²) checks every frame in damage/fire calculations.
  updateArmorShieldCache() {
    this.armorShieldCacheTimer -= this.deltaTime;
    if (this.armorShieldCacheTimer > 0) return;
    this.armorShieldCacheTimer = 0.3; // update every 0.3 seconds

    this.armorShieldCache.clear();
    const PROTECTION_RADIUS = 240;

    // Find all alive armored roaches
    const armored: Roach[] = [];
    for (const r of this.roaches) {
      if (r.state === RoachState.ALIVE && r.armorHp > 0) {
        armored.push(r);
      }
    }
    if (armored.length === 0) return;

    // Check which non-armored roaches are within protection radius
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE || r.armorHp > 0) continue;
      for (const ar of armored) {
        if (ar.id === r.id) continue;
        const dx = r.x - ar.x;
        const dy = r.y - ar.y;
        if (dx * dx + dy * dy < PROTECTION_RADIUS * PROTECTION_RADIUS) {
          this.armorShieldCache.add(r.id);
          break;
        }
      }
    }
  }

  // ===== 玩家与武器更新 =====
  /** 更新玩家：处理移动、射击、武器切换、过热等 */
  updatePlayer() {
    const p = this.player;

    // ===== 教程暂停：教程期间阻止所有玩家控制 =====
    if (this.tutorialPauseSpawn) {
      p.isFiring = false; // 强制停止火焰喷射器
      this.audio.stopFire();
      p.x = Math.max(10, Math.min(this.width - 10, this.mouseX));
      p.angle = -Math.PI / 2;
      return; // 跳过所有射击和武器逻辑
    }

    // Update paralyze timer
    if (p.paralyzeTimer > 0) {
      p.paralyzeTimer -= this.deltaTime;
      if (p.paralyzeTimer < 0) p.paralyzeTimer = 0;
    }

    // 移动：如果麻痹，无法移动 + 停止火焰喷射器
    if (p.paralyzeTimer > 0) {
      p.isFiring = false; // 强制停止火焰喷射器
      // 麻痹状态：在防线位置显示紫色火花特效
      const defenseLineY = this.defenseLineY();
      if (Math.random() < 0.4) {
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 40,
          y: defenseLineY - 40 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 50,
          vy: -30 - Math.random() * 40,
          life: 0.4, maxLife: 0.4,
          size: 4, color: '#ff00ff',
          type: 'spark' as ParticleType,
        });
      }
      p.angle = -Math.PI / 2;
      // 麻痹时跳过所有其他玩家逻辑
      return;
    }

    p.x = Math.max(10, Math.min(this.width - 10, this.mouseX));
    p.angle = -Math.PI / 2;

    // 检查临时武器是否过期
    if (p.isTempWeapon && p.weaponTimer > 0) {
      p.weaponTimer -= this.deltaTime;
      if (p.weaponTimer <= 0) {
        p.currentWeapon = 'flamethrower';
        p.isTempWeapon = false;
        this.addFloatingText(p.x, p.y - 60, '武器已过期', '#9ca3af');
      }
    }

    // ===== 过热警告：接近过热时触发 =====
    // heatGain*100 = 100/秒，3秒 = 剩余300热量
    const warnThreshold = p.overheatThreshold - 300; // 1500 for default overheatThreshold=1800
    if (p.heat >= warnThreshold && p.heatWarningTimer <= 0 && !p.isOverheated) {
      p.heatWarningTimer = 3;
      this.addFloatingText(p.x, p.y - 60, '⚠️ 枪管冷却中!', '#fbbf24', 1500, 18);
    }

    // 射击逻辑：基于当前武器
    // 如果麻痹，阻止射击
    if (p.paralyzeTimer > 0) {
      p.isFiring = false;
    }
    if (p.isFiring && !p.isOverheated && !p.isReloading && p.gas > 0 && p.paralyzeTimer <= 0) {
      const ammoKey = p.currentWeapon;
      const ammo = p.weaponAmmo[ammoKey] || 0;
      if (ammo <= 0 && ammoKey !== 'flamethrower') {
        p.currentWeapon = 'flamethrower';
        p.isTempWeapon = false;
        return;
      }

      this.audio.playFire();

      switch (p.currentWeapon) {
        case 'flamethrower':
          this.updateFlamethrower(p);
          break;
        case 'sticky':
          // 粘板是放置道具，不是武器 - 由 selectItem/onItemRelease 处理
          break;
        case 'poison':
          this.updatePoisonSpray(p);
          break;
        case 'shotgun':
          this.updateShotgun(p);
          break;
        case 'molotov':
          // Molotov is thrown on click, not continuous
          break;
      }

      if (p.isTempWeapon && ammoKey !== 'flamethrower') {
        p.weaponAmmo[ammoKey] = Math.max(0, (p.weaponAmmo[ammoKey] || 0) - this.deltaTime * 3);
      }
    } else {
      this.audio.stopFire();
      p.heat -= this.deltaTime * 360 * p.heatDecayRate;
      if (p.heat < 0) p.heat = 0;
    }

    if (p.isOverheated) {
      p.overheatTimer -= this.deltaTime;
      if (p.overheatTimer <= 0) {
        p.isOverheated = false;
        p.heat = 0;
        // Show "FIRE" text at screen center (same position as overheat countdown)
        this.addFloatingText(this.width / 2, this.height / 2, '>>> 开 火 <<<', '#22c55e', 2000, 28);
      }
    }

    // Decrement heat warning timer
    if (p.heatWarningTimer > 0) {
      p.heatWarningTimer -= this.deltaTime;
      if (p.heatWarningTimer < 0) p.heatWarningTimer = 0;
    }

    if (p.isReloading) {
      p.reloadTimer -= this.deltaTime;
      if (p.reloadTimer <= 0) {
        p.isReloading = false;
        p.gas = p.maxGas;
        // 装弹完成，在屏幕中央显示"开火"文字
        this.addFloatingText(this.width / 2, this.height / 2, '>>> 开 火 <<<', '#22c55e', 2000, 28);
      }
    }

    if (p.gas <= 0 && !p.isReloading && !p.isOverheated) {
      this.startReload();
    }
  }

  updateFlamethrower(p: Player) {
    const gasCost = this.deltaTime * (p.powerBoostTimer > 0 ? 2 : 1); // 力量加成期间 2 倍燃气消耗
    const heatGain = this.deltaTime * 1.0;
    const powerBoostMult = p.powerBoostTimer > 0 ? 2 : 1;
    const baseDamage = (this.difficulty === 'hard' ? 200 : 300) * this.deltaTime * p.damageMultiplier * powerBoostMult;
    const range = p.fireRange * 0.5;
    const spreadAngle = (Math.PI / 15) * p.flameSpreadMultiplier;
    ParticleSpawner.spawnConeFire(this.particles, this.fireZones, this.deltaTime,p.x, p.y, -Math.PI / 2, range, spreadAngle, baseDamage, 'fire');
    // Black smoke at flame tip during power boost (use dynamic particle limit)
    if (p.powerBoostTimer > 0 && this.particles.length < this._particleLimit - 10 && Math.random() < 0.4) {
      const tipY = p.y - 322 - range;
      this.particles.push({
        x: p.x + (Math.random() - 0.5) * 20,
        y: tipY,
        vx: (Math.random() - 0.5) * 15,
        vy: -(20 + Math.random() * 30),
        life: 1.5 + Math.random(),
        maxLife: 2.5,
        color: '#2a2a2a',
        size: 4 + Math.random() * 6,
        type: ParticleType.SMOKE,
      });
    }
    p.gas -= gasCost * p.gasCostMultiplier;
    if (p.gas < 0) p.gas = 0;
    p.heat += heatGain * 100;

    // ===== HEAT WARNING: 3 seconds before overheat =====
    // heatGain*100 = 100/second, 3 seconds = 300 heat remaining
    if (p.heat >= p.overheatThreshold) {
      p.heat = p.overheatThreshold;
      p.isOverheated = true;
      p.overheatTimer = 10;
      p.heatWarningTimer = 0; // Clear warning on actual overheat
      ParticleSpawner.spawnSmokeParticles(this.particles,p.x, p.y, 30);
      this.screenShake = 3;
    }
  }

  updatePoisonSpray(p: Player) {
    const gasCost = this.deltaTime;
    const range = p.fireRange * 0.45;
    const baseDamage = 30 * this.deltaTime;
    ParticleSpawner.spawnConeFire(this.particles, this.fireZones, this.deltaTime,p.x, p.y, -Math.PI / 2, range, Math.PI / 6, baseDamage, 'poison');
    p.gas -= gasCost * p.gasCostMultiplier;
    if (p.gas < 0) p.gas = 0;
    p.heat += this.deltaTime * 80;
    if (p.heat >= p.overheatThreshold) {
      p.heat = p.overheatThreshold;
      p.isOverheated = true;
      p.overheatTimer = 6;
    }
  }

  updateShotgun(p: Player) {
    const gasCost = this.deltaTime * 1.5;
    const range = p.fireRange * 0.35;
    const baseDamage = 150 * this.deltaTime * p.damageMultiplier;
    // Wide spread shotgun blast
    for (let i = 0; i < p.shotgunPellets; i++) {
      const spreadAngle = -Math.PI / 2 + (i - p.shotgunPellets / 2) * (Math.PI / 8);
      ParticleSpawner.spawnConeFire(this.particles, this.fireZones, this.deltaTime,p.x, p.y, spreadAngle, range, Math.PI / 12, baseDamage / p.shotgunPellets, 'fire');
    }
    p.gas -= gasCost * p.gasCostMultiplier;
    if (p.gas < 0) p.gas = 0;
    p.heat += this.deltaTime * 200;
    if (p.heat >= p.overheatThreshold) {
      p.heat = p.overheatThreshold;
      p.isOverheated = true;
      p.overheatTimer = 8;
    }
  }

  /** 投掷燃烧瓶（制造火墙） */
  throwMolotov() {
    const p = this.player;
    if (p.molotovCount <= 0 && !p.isTempWeapon) return;
    if (p.isTempWeapon) {
      p.weaponAmmo['molotov'] = Math.max(0, (p.weaponAmmo['molotov'] || 0) - 1);
    } else {
      p.molotovCount--;
    }
    // Create a fire zone projectile that arcs and lands
    const targetX = p.x + (Math.random() - 0.5) * 200;
    const targetY = this.height * 0.4 + Math.random() * 200;
    this.spawnMolotovProjectile(p.x, p.y, targetX, targetY);
    this.screenShake = 5;
  }

  spawnMolotovProjectile(fromX: number, fromY: number, toX: number, toY: number) {
    // Create a fire zone at target after arc
    const dx = toX - fromX;
    const dist = Math.abs(toY - fromY);
    const travelTime = 0.5;
    const vx = dx / travelTime;
    const vy = -dist / travelTime;

    const proj: Particle = {
      x: fromX, y: fromY,
      vx, vy,
      life: travelTime, maxLife: travelTime,
      size: 8, color: '#ff4400',
      type: ParticleType.EXPLOSION,
    };
    this.particles.push(proj);

    // Schedule fire zone creation
    setTimeout(() => {
      this.fireZones.push({
        x: toX, y: toY,
        radius: 60,
        damagePerSecond: 80,
        life: 5, maxLife: 5,
        type: 'fire',
      });
      ParticleSpawner.spawnExplosionParticles(this.particles,toX, toY, 20);
      this.screenShake = 8;
    }, travelTime * 1000);
  }

  startReload() {
    if (this.player.isReloading) return;
    this.audio.playReload();
    this.player.isReloading = true;
    this.player.reloadTimer = this.player.maxReloadTime;
    this.economy.gasCanistersUsed++;
    if (this.difficulty === 'hard') {
      this.economy.money = Math.max(0, this.economy.money - 5);
    }
    ParticleSpawner.spawnSmokeParticles(this.particles,this.player.x, this.player.y, 15);
    this.onEconomyUpdate?.(this.economy);
  }

  // ========== EMERGENCY COOL (delegated to ConsumableSystem module) ==========
  emergencyCool() {
    this.consumableSystem!.emergencyCool();
  }

  // ========== THROWABLE AIMING & THROWING (delegated to AimingSystem) ==========
  startAiming(weapon: 'sticky' | 'poison' | 'molotov') {
    this.aimingSystem!.startAiming(weapon, this.time, this.player.x, this.player.y);
  }

  throwAimedWeapon() {
    const result = this.aimingSystem!.throwAimedWeapon(
      this.player.isTempWeapon,
      this.player.weaponAmmo,
      this.player.x,
      this.player.y
    );
    if (result.throwable) {
      nextId++;
      result.throwable.id = nextId;
      this.throwableSystem!.addThrowable(result.throwable);
      this.player.weaponAmmo = result.updatedAmmo;
    }
  }

  cancelAiming() {
    this.aimingSystem!.cancelAiming();
  }

  // ========== THROWABLE SYSTEM (delegated to ThrowableSystem module) =========

  // ===== 武器系统 =====
  /**
   * 切换当前武器
   * @param {string} weapon - 武器类型
   */
  switchWeapon(weapon: string) {
    return this.weaponSystem!.switchWeapon(this.player, weapon);
  }

  // ========== WEAPON DROPS (delegated to WeaponSystem module) ==========

  // ===== 道具系统 =====
  // ========== TRIPLE FLAME SHOTGUN =========
  // ========== 三重火焰 (delegated to TripleFlameSystem module) =========

  // ========== RADAR LASER (delegated to RadarLaserSystem module) =========

  // ========== INSECTICIDE SPRAY (delegated to InsecticideSystem module) =========

  // ========== STICKY DROP SPRAY (delegated to StickySystem module) ==========

  // ========== ITEM PLACEMENT: icon click → screen click → drag → release =========
  selectItem(index: number) {
    if (index < 0 || index >= this.inventory.length) return;
    if (this.inventory[index].count <= 0) return;

    const item = this.inventory[index];

    // Check picked-up item cooldown (shares globalConsumableCooldown with shop consumables)
    if (this.consumableSystem!.globalConsumableCooldown > 0) {
      this.addFloatingText(this.player.x, this.player.y - 40, `道具冷却中... (${this.consumableSystem!.globalConsumableCooldown.toFixed(1)}s)`, '#94a3b8', 800);
      return;
    }
    if ((this.consumableSystem!.itemCooldowns[item.type] || 0) > 0) {
      const def = WEAPON_DROP_DEFS[item.type as keyof typeof WEAPON_DROP_DEFS];
      this.addFloatingText(this.player.x, this.player.y - 40, `${def?.name || ''}冷却中... (${this.consumableSystem!.itemCooldowns[item.type].toFixed(1)}s)`, '#94a3b8', 800);
      return;
    }

    // Helper to set cooldown after using a picked-up item
    const startItemCooldown = (type: string) => {
      const def = WEAPON_DROP_DEFS[type as keyof typeof WEAPON_DROP_DEFS];
      if (def && def.cooldown > 0) {
        this.consumableSystem!.itemCooldowns[type] = def.cooldown;
      }
      this.consumableSystem!.globalConsumableCooldown = 1; // 1 second global cooldown (shared with shop consumables)
    };

    // Shotgun is instant-use (activates triple flame), not placement
    if (item.type === 'shotgun') {
      item.count--;
      this.tripleFlameSystem!.activateTripleFlame();
      startItemCooldown('shotgun');
      if (item.count <= 0) {
        this.inventory.splice(index, 1);
      }
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Radar laser is instant-use (activates auto-targeting laser), not placement
    if (item.type === 'radar') {
      item.count--;
      this.radarLaserSystem!.activateRadarLaser();
      startItemCooldown('radar');
      if (item.count <= 0) {
        this.inventory.splice(index, 1);
      }
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Insecticide spray is instant-use (auto-spray from bottom center), not placement
    if (item.type === 'poison') {
      item.count--;
      this.insecticideSystem!.activate(this.width, this.height);
      startItemCooldown('poison');
      if (item.count <= 0) {
        this.inventory.splice(index, 1);
      }
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Sticky board is instant-use (auto-fires 10 tracking drops), not placement
    if (item.type === 'sticky') {
      item.count--;
      this.stickySystem!.activateStickySpray();
      startItemCooldown('sticky');
      if (item.count <= 0) {
        this.inventory.splice(index, 1);
      }
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Molotov is instant-use (auto-finds roaches and creates flame wall), not placement
    if (item.type === 'molotov') {
      item.count--;
      this.activateMolotovFireWall();
      startItemCooldown('molotov');
      if (item.count <= 0) {
        this.inventory.splice(index, 1);
      }
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Fan is instant-use (activates wind slow on all roaches), not placement
    if (item.type === 'fan') {
      item.count--;
      this.fanSystem!.activateFan();
      startItemCooldown('fan');
      if (item.count <= 0) {
        this.inventory.splice(index, 1);
      }
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Swatter is instant-use (armor break + slow in area around player)
    // useSwatter() handles its own consumption, cooldown check, and cooldown setting
    if (item.type === 'swatter') {
      const result = this.swatterSystem!.useSwatter(
        this.consumableSystem!.globalConsumableCooldown,
        this.consumableSystem!.itemCooldowns,
        this.inventory,
        this.roaches,
        this.player.x,
        this.player.y
      );
      this.inventory = result.inventory;
      this.consumableSystem!.itemCooldowns = result.itemCooldowns;
      this.consumableSystem!.globalConsumableCooldown = result.globalConsumableCooldown;
      return;
    }

    // Placement items
    if (this.selectedItemIndex === index && this.itemPlaceState !== 'idle') {
      this.cancelItemPlacement();
      return;
    }

    this.selectedItemIndex = index;
    this.itemPlaceState = 'pending_click';
    this.player.isFiring = false; // Stop firing
  }

  // First screen click: show range preview at click position
  onItemFirstClick(x: number, y: number) {
    if (this.itemPlaceState !== 'pending_click') return;
    if (this.selectedItemIndex < 0) return;

    this.itemPlaceCursorX = Math.max(0, Math.min(this.width, x));
    this.itemPlaceCursorY = Math.max(0, Math.min(this.height, y));
    this.itemPlaceState = 'placing';
  }

  // Dragging: update position
  onItemDrag(x: number, y: number) {
    if (this.itemPlaceState !== 'placing') return;
    this.itemPlaceCursorX = Math.max(0, Math.min(this.width, x));
    this.itemPlaceCursorY = Math.max(0, Math.min(this.height, y));
  }

  // Release: apply effect
  onItemRelease() {
    if (this.itemPlaceState !== 'placing') return;
    if (this.selectedItemIndex < 0) return;

    const item = this.inventory[this.selectedItemIndex];
    if (!item || item.count <= 0) {
      this.cancelItemPlacement();
      return;
    }

    item.count--;

    // Apply effect based on type at the placed location
    // (molotov, shotgun, radar, poison, sticky, fan are all instant-use, handled in selectItem)

    // Remove item if count reaches 0
    if (item.count <= 0) {
      this.inventory.splice(this.selectedItemIndex, 1);
    }

    this.itemPlaceState = 'idle';
    this.selectedItemIndex = -1;
  }

  // ========== STICKY BOARD (delegated to StickySystem module) ==========
  applyStickyBoardEffect(x: number, y: number) {
    this.stickySystem!.applyStickyBoardEffect(x, y);
  }

  cancelItemPlacement() {
    this.itemPlaceState = 'idle';
    this.selectedItemIndex = -1;
  }

  // ========== POISON SYSTEM (delegated to PoisonSystem module) =========

  // ========== 风扇激活 (delegated to FanSystem module) =========

  activateMolotovFireWall() {
    this.audio.playMolotovExplosion();
    Vibration.vibrateItemUse();

    // Find closest alive roach to determine fire wall Y position
    let target: Roach | null = null;
    let minDist = Infinity;
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      const dx = r.x - this.player.x;
      const dy = r.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        target = r;
      }
    }

    // Fire wall spans the ground width at the target Y position
    const wallY = target ? target.y : this.height * 0.5;
    const [groundLeftX, groundRightX] = this.getGroundBoundsAtY(wallY);
    const wallX1 = groundLeftX;
    const wallX2 = groundRightX;

    // Create fire wall - high burst damage on creation, low sustained damage
    this.fireWalls.push({
      y: wallY,
      x1: wallX1,
      x2: wallX2,
      height: 10,
      damagePerSecond: 2, // low sustained damage (was 8)
      life: 6, // slightly longer duration
      maxLife: 6,
    });

    // Start fire wall burn sound (only start if not already playing)
    if (this.fireWalls.length === 1) {
      this.audio.startFireWallBurn();
    }

    // Initial burst damage to roaches near the wall
    // Apply explosive expert talent: explosion range boost
    const explosionMult = this.talentMultipliers.explosionRange || 1;
    const burstRange = 20 * explosionMult;
    let hitCount = 0;
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      // Skip timed suicide roach during bomb placement (invincible)
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
      if (r.x >= wallX1 && r.x <= wallX2 && Math.abs(r.y - wallY) < burstRange) {
        // Fire wall burst damage: 5 for unarmored, 2 for armored (cannot break armor)
        if (r.armorHp > 0) {
          r.hp -= 2; // reduced damage through armor
          r.burnDamage = 2;
        } else {
          r.hp -= 5; // full burst damage (unarmored)
          r.burnDamage = 5;
        }
        r.inFire = true;
        hitCount++;
      }
    }

    // Explosion particles along the wall
    for (let px = wallX1; px <= wallX2; px += 20) {
      ParticleSpawner.spawnExplosionParticles(this.particles,px, wallY, 2);
    }
    this.screenShake = 8;

    const label = target ? `火焰墙!(${hitCount > 0 ? hitCount + '只' : ''})` : '火焰墙!';
    this.addFloatingText((wallX1 + wallX2) / 2, wallY - 20, label, '#f87171');
  }

  // ===== PERSPECTIVE GROUND BOUNDS: get left/right x boundaries at a given Y =====
  // The ground boundary is a 2-segment polyline per side (far→mid→near).
  // For a given Y, find which segment Y falls in and interpolate.
  getGroundBoundsAtY(y: number): [number, number] {
    const [farL, farLY, farR, farRY, midL, midLY, midR, midRY, nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[this.currentScene];
    const clampedY = Math.min(nearY, Math.max(Math.min(farLY, farRY), y));

    // Left side: 2 segments (far→mid→near)
    let leftX: number;
    if (clampedY >= midLY) {
      // Between mid and near (lower half)
      const t = (clampedY - midLY) / (nearY - midLY);
      leftX = midL + (nearL - midL) * t;
    } else {
      // Between far and mid (upper half)
      const t = (clampedY - farLY) / (midLY - farLY);
      leftX = farL + (midL - farL) * t;
    }

    // Right side: 2 segments (far→mid→near)
    let rightX: number;
    if (clampedY >= midRY) {
      // Between mid and near (lower half)
      const t = (clampedY - midRY) / (nearY - midRY);
      rightX = midR + (nearR - midR) * t;
    } else {
      // Between far and mid (upper half)
      const t = (clampedY - farRY) / (midRY - farRY);
      rightX = farR + (midR - farR) * t;
    }

    return [leftX, rightX];
  }

  // Get the center point of the perspective ground bounds quad for the current scene
  // Used for bait landing target (center of roach walkable area)
  getGroundCenter(): [number, number] {
    const [farL, farLY, farR, farRY, , , , , nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[this.currentScene];
    const centerX = (farL + farR + nearL + nearR) / 4;
    const centerY = (farLY + farRY + nearY + nearY) / 4;
    return [centerX, centerY];
  }

  // ===== 蟑螂生成 =====
  /**
   * 生成单个蟑螂敌人
   * @param {RoachType} type - 蟑螂类型
   * @param {number} clusterId - 集群 ID（可选）
   * @returns {Roach | undefined} 生成的蟑螂实例
   */
  spawnRoach(type: RoachType, clusterId?: number): Roach | undefined {
    // Performance guard: hard cap on roach count
    if (this.roaches.length >= 40) return;

    const isHard = this.difficulty === 'hard';
    const config = this.getWaveConfig(this.wave);
    const def = ENEMY_DEFS[type];

    let baseX: number, baseY: number;

    if (type === RoachType.FLYING || type === RoachType.FLYING_SUICIDE) {
      // Flying roaches spawn at sides and fly across
      baseX = Math.random() < 0.5 ? -20 : this.width + 20;
      baseY = this.height * 0.3 + Math.random() * this.height * 0.2;
      // Start flying buzz loop (continuous while any flying roach is alive)
      this.audio.startFlyingBuzzLoop();
    } else if (type === RoachType.QUEEN) {
      baseX = this.width / 2 + (Math.random() - 0.5) * 100;
      baseY = this.height * 0.45;
    } else if (type === RoachType.NURSE && this.currentScene === SceneType.HOSPITAL) {
      // ===== HOSPITAL EXCLUSIVE: Nurse spawns at the FAR end of ground bounds =====
      const [, farLY, , ] = SCENE_GROUND_BOUNDS[this.currentScene];
      baseY = farLY + 10; // Slightly below far line to be visible
      const [gLeft, gRight] = this.getGroundBoundsAtY(baseY);
      baseX = gLeft + Math.random() * (gRight - gLeft);
    } else {
      // Ground roaches: spawn within 6-point perspective ground bounds
      const [, farLY, , farRY, , midLY, , midRY, , , nearY] = SCENE_GROUND_BOUNDS[this.currentScene];
      const farY = Math.min(farLY, farRY, midLY, midRY); // use highest point as spawn top
      // Random Y within the bounds (biased toward far end for spawning)
      baseY = farY + Math.random() * (nearY - farY) * 0.6;
      // Get left/right bounds at this Y (perspective interpolation)
      const [gLeft, gRight] = this.getGroundBoundsAtY(baseY);
      baseX = gLeft + Math.random() * (gRight - gLeft);
    }

    // ===== BOSS GROUND COMBAT: spawn minions away from boss =====
    // When boss is on ground (phase >= 2), ensure summoned roaches don't overlap
    if (this.bossBattle.active && this.bossBattle.phase >= 2 && type !== RoachType.QUEEN && type !== RoachType.FLYING) {
      const boss = this.roaches.find(br => br.type === RoachType.QUEEN && br.state === RoachState.ALIVE);
      if (boss) {
        const minDistance = 120; // minimum distance from boss
        const maxAttempts = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const dx = baseX - boss.x;
          const dy = baseY - boss.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= minDistance) break; // far enough
          // Too close - reposition: spawn on the opposite side of the boss
          if (baseX < boss.x) {
            baseX = boss.x - minDistance - Math.random() * 100;
          } else {
            baseX = boss.x + minDistance + Math.random() * 100;
          }
          // Clamp to screen bounds
          baseX = Math.max(40, Math.min(this.width - 40, baseX));
        }
      }
    }

    const hpMult = isHard ? 1.8 : 1.2;
    const speedMult = config.speed * (isHard ? 1.1 : 1.0);

    const r: Roach = {
      id: type === RoachType.QUEEN ? nextBossId++ : nextId++,
      x: baseX, y: baseY,
      vx: 0, vy: 0,
      type,
      hp: Math.floor(def.hp * hpMult * (type === RoachType.QUEEN ? (isHard ? 1.5 : 1) : 1)),
      maxHp: Math.floor(def.hp * hpMult * (type === RoachType.QUEEN ? (isHard ? 1.5 : 1) : 1)),
      state: RoachState.ALIVE,
      speed: def.speed * speedMult * (0.7 + Math.random() * 0.3),
      baseSpeed: def.speed * speedMult,
      burnDamage: 0,
      inFire: false,
      clusterId,
      angle: 0,
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 2 + Math.random() * 2,
      isEnraged: false,
      deathTimer: 0,
      animFrame: 0,
      animTimer: 0,
      panicTimer: 0,
      panicAngle: 0,
      stunTimer: 0,
      isStunned: false,
      facingRight: true,
      altitude: (type === RoachType.FLYING || type === RoachType.FLYING_SUICIDE) ? 0.3 + Math.random() * 0.3 : 0,
      wingPhase: Math.random() * Math.PI * 2,
      armorHp: 0, // computed below
      maxArmorHp: 0,
      hasSplit: false,
      fuseTimer: (type === RoachType.SUICIDE || type === RoachType.FLYING_SUICIDE) ? 2 : 0,
      isFused: false,
      spawnTimer: type === RoachType.QUEEN ? BOSS_CONFIG.queen.spawnInterval : 0,
      // Hospital exclusive: nurse roach healing (5s cooldown)
      healTimer: type === RoachType.NURSE ? 5 : 0,
      healTargetId: null,
      healPhase: type === RoachType.NURSE ? 'idle' : undefined,
      healPhaseTimer: type === RoachType.NURSE ? 0 : undefined,
      healRange: type === RoachType.NURSE ? 360 : undefined,
      // Hospital exclusive: asphyxiation from insecticide
      asphyxiationTimer: 0,
      // Hospital exclusive: timed suicide (now places bomb at defense line, no countdown on roach)
      explodeTimer: 0,
      isCountingDown: false,
      countdownPaused: false,
      isBoss: this.bossBattle.active && type === RoachType.QUEEN,
      isCharging: false,
      hasTransformed: false,
      transformTimer: undefined,
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
    };

    // Compute armor after creation (ensures armorHp === maxArmorHp)
    if (type === RoachType.ARMORED) {
      r.armorHp = Math.floor(def.hp * hpMult * 1.0);
      r.maxArmorHp = r.armorHp;
    } else if (type === RoachType.SUICIDE) {
      // Suicide roach: armor HP 2 (bomb shell, breaks quickly)
      r.armorHp = 2;
      r.maxArmorHp = 2;
    } else if (type === RoachType.FLYING_SUICIDE) {
      // Flying Suicide roach: fixed armor HP 5 (slightly less than ground)
      const extraArmor = (this.gameMode === GameMode.ENDLESS && Math.random() < 0.3) ? 2 : 0;
      r.armorHp = 5 + extraArmor;
      r.maxArmorHp = r.armorHp;
    }
    // Hospital exclusive: nurse roach armor (fixed 12, same mechanic as armor, red visual)
    if (type === RoachType.NURSE) {
      r.armorHp = 12; // Fixed armor value instead of shield
      r.maxArmorHp = 12;
      r.size = def.size; // 1.5x = 78, set from ENEMY_DEFS
    }
    // Hospital exclusive: timed suicide roach armor (fixed 12) + init bomb placement state
    if (type === RoachType.TIMED_SUICIDE) {
      r.armorHp = 12; // Fixed armor value instead of shield
      r.maxArmorHp = 12;
      r.hasPlacedBomb = false;
      r.placeTimer = 0;
    }
    this.roaches.push(r);
    if (type === RoachType.QUEEN) this.bossSystem!.activeBosses++;
    return r;
  }

  updateStatusEffects(r: Roach) {
    // Stuck by board - static visual only, no per-frame particles
    // (roach is rendered with yellow tint by the stuck overlay in renderRoach)

    // Stun
    if (r.stunTimer > 0) {
      r.stunTimer -= this.deltaTime;
      if (r.stunTimer <= 0) {
        r.isStunned = false;
        // BOSS: after stun ends, trigger return to home if interrupted during charge
        if (r.isBoss && r.type === RoachType.QUEEN && this.bossSystem!.bossBattle.active) {
          const homeX = r.homeX ?? this.width / 2;
          const homeY = r.homeY ?? this.height * 0.18;
          const dx = homeX - r.x;
          const dy = homeY - r.y;
          if (Math.sqrt(dx * dx + dy * dy) > 10) {
            r.returningHome = true;
          }
        }
      }
    }
  }

  /**
   * 委托给 CollisionSystem 模块 —— 对蟑螂应用伤害
   */
  applyDamageToRoach(r: Roach, damage: number) {
    this.collisionSystem!.applyDamageToRoach(r, damage, this.armorShieldCache);
  }

  // Track death chain depth to prevent exponential recursion
  private _deathChainDepth: number = 0;
  private readonly MAX_DEATH_CHAIN_DEPTH = 3;

  suicideExplode(r: Roach, index: number) {
    // Remove the roach
    this.roaches.splice(index, 1);
    this.audio.playSuicideExplode();
    Vibration.vibrateSuicideExplode();
    const explodeRadius = 100;

    // ===== Enhanced explosion effects (5 second duration) =====
    // Core explosion
    ParticleSpawner.spawnExplosionParticles(this.particles,r.x, r.y, 50);
    // Heavy smoke
    ParticleSpawner.spawnSmokeParticles(this.particles,r.x, r.y, 40);
    // Debris / body fragments
    ParticleSpawner.spawnDebrisParticles(this.particles,r.x, r.y, 25);
    // Sparks
    ParticleSpawner.spawnSparkParticles(this.particles,r.x, r.y, 30);
    // Fire ring
    ParticleSpawner.spawnFireRingParticles(this.particles,r.x, r.y, 20);
    this.screenShake = 20;

    // Damage nearby roaches with visual feedback (no effect on BOSS)
    // Use squared distance to avoid Math.sqrt
    const explodeRadiusSq = explodeRadius * explodeRadius;
    let hitCount = 0;
    for (const other of this.roaches) {
      if (other.state !== RoachState.ALIVE || other.isBoss) continue;
      const dx = other.x - r.x;
      const dy = other.y - r.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < explodeRadiusSq) {
        const dist = Math.sqrt(distSq); // Only for damage falloff
        const dmg = 15 * (1 - dist / explodeRadius);
        other.hp -= dmg;
        other.burnDamage = dmg * 2;
        other.damageFlash = (other.armorHp > 0) ? 0 : 2; // No flash while armor intact
        other.inFire = true;
        hitCount++;
        if (other.hp <= 0 && this._deathChainDepth < this.MAX_DEATH_CHAIN_DEPTH) {
          this.killRoach(other, this.roaches.indexOf(other));
        }
      }
    }

    // Damage defense if close (expanded range for flying suicide which may explode mid-air after panic)
    const roachSize = ENEMY_DEFS[r.type].size;
    const roachBottom = r.y + roachSize * 0.4;
    const defenseDamageRange = (r.type === RoachType.FLYING_SUICIDE) ? 300 : 100;
    if (roachBottom > this.defenseLineY() - defenseDamageRange) {
      const dmg = this.difficulty === 'hard' ? 15 : 5;
      if (this.player.shieldTimer > 0) {
        this.addFloatingText(r.x, this.defenseLineY() - 20, '护盾抵消!', '#22d3ee');
      } else {
        this.defenseHp -= dmg;
        this.addFloatingText(r.x, this.defenseLineY() - 20, `自爆伤害! -${dmg}`, '#ef4444');
      }
      if (r.type === RoachType.FLYING_SUICIDE) {
        this.audio.playSuicideBreachFlying();
      } else {
        this.audio.playSuicideBreachGround();
      }
      if (this.defenseHp <= 0) {
        this.defenseHp = 0;
        Vibration.vibrateGameOver();
        // Defense breach: no gold reward, no item recycling, clear all earned gold
        this.economy.money = 0;
        this.state = GameState.GAME_OVER;
        // Stop all continuous sound effects on game over
        this.audio.stopBGM();
        this.audio.stopFire();
        this.audio.stopFanLoop();
        this.audio.stopFireWallBurn();
        this.audio.stopFlyingBuzzLoop();
        this.economy.highestWave = Math.max(this.economy.highestWave, this.wave);
        this.progress.highestWave = Math.max(this.progress.highestWave, this.wave);
        this.progress.totalKills += this.economy.totalKills;
        this.saveProgress();
        this.onGameOver?.(this.economy, this.wave);
        this.onStateChange?.(this.state);
        return;
      }
    }

    this.addFloatingText(r.x, r.y - 30, hitCount > 0 ? `大爆炸!(${hitCount}只受波及)` : '大爆炸!', '#ff4400');
  }

  // Suicide roach: explode when killed by flame (before reaching defense line)
  // Shares the same explosion effects and damage as suicideExplode,
  // but does NOT remove the roach from array (killRoach handles that)
  suicideDeathExplode(r: Roach) {
    // Don't double-explode: use a one-time flag stored on the roach object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((r as any)._deathExploded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r as any)._deathExploded = true;

    this.audio.playSuicideExplode();
    Vibration.vibrateSuicideExplode();
    const explodeRadius = 100;

    // Same explosion effects as suicideExplode
    ParticleSpawner.spawnExplosionParticles(this.particles,r.x, r.y, 50);
    ParticleSpawner.spawnSmokeParticles(this.particles,r.x, r.y, 40);
    ParticleSpawner.spawnDebrisParticles(this.particles,r.x, r.y, 25);
    ParticleSpawner.spawnSparkParticles(this.particles,r.x, r.y, 30);
    ParticleSpawner.spawnFireRingParticles(this.particles,r.x, r.y, 20);
    this.screenShake = 20;

    // Damage nearby roaches
    let hitCount = 0;
    for (const other of this.roaches) {
      if (other.state !== RoachState.ALIVE || other.isBoss) continue;
      // Skip timed suicide roach during bomb placement (invincible)
      const dx = other.x - r.x;
      const dy = other.y - r.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < explodeRadius) {
        const dmg = 15 * (1 - dist / explodeRadius);
        other.hp -= dmg;
        other.burnDamage = dmg * 2;
        other.damageFlash = (other.armorHp > 0) ? 0 : 2;
        other.inFire = true;
        hitCount++;
        if (other.hp <= 0) this.killRoach(other, this.roaches.indexOf(other));
      }
    }

    // Damage defense if close (same logic as suicideExplode)
    const roachSize = ENEMY_DEFS[r.type].size;
    const roachBottom = r.y + roachSize * 0.4;
    const defenseDamageRange = (r.type === RoachType.FLYING_SUICIDE) ? 300 : 100;
    if (roachBottom > this.defenseLineY() - defenseDamageRange) {
      const dmg = this.difficulty === 'hard' ? 15 : 5;
      if (this.player.shieldTimer > 0) {
        this.addFloatingText(r.x, this.defenseLineY() - 20, '护盾抵消!', '#22d3ee');
      } else {
        this.defenseHp -= dmg;
        this.addFloatingText(r.x, this.defenseLineY() - 20, `自爆伤害! -${dmg}`, '#ef4444');
      }
      if (r.type === RoachType.FLYING_SUICIDE) {
        this.audio.playSuicideBreachFlying();
      } else {
        this.audio.playSuicideBreachGround();
      }
    }

    this.addFloatingText(r.x, r.y - 30, hitCount > 0 ? `死亡爆炸!(${hitCount}只受波及)` : '死亡爆炸!', '#ff4400');
  }

  // [REMOVED] spawnDebrisParticles, spawnFireRingParticles, spawnShockwaveRing — migrated to ParticleSpawner



  // ===== 定时自爆："螂家爆破" 爆炸触发 =====
  // Phase 3: Screen shake + debris barrage + defense damage
  triggerBreachExplosion(r: Roach) {
    // 防止指数级死亡链
    if (this._deathChainDepth >= this.MAX_DEATH_CHAIN_DEPTH) return;
    this._deathChainDepth++;

    try {
      // ===== SAME-LEVEL EXPLOSION AS placedBombs =====
      // Layer 1: Core explosion particles (80)
      ParticleSpawner.spawnExplosionParticles(this.particles,r.x, r.y, 80);
      // Layer 2: Fire ring (30)
      ParticleSpawner.spawnFireRingParticles(this.particles,r.x, r.y, 30);
      // Layer 3: Smoke (40)
      ParticleSpawner.spawnSmokeParticles(this.particles,r.x, r.y, 40);
      // Layer 4: Fire flash overlay (3 layers)
      for (let fi = 0; fi < 3; fi++) {
        this.particles.push({
          x: r.x + (Math.random() - 0.5) * 30,
          y: r.y + (Math.random() - 0.5) * 20,
          vx: 0, vy: 0,
          life: 0.2 + fi * 0.1, maxLife: 0.2 + fi * 0.1,
          size: 60 + fi * 30,
          color: `rgba(${255}, ${180 - fi * 40}, ${50 - fi * 20}, ${0.5 - fi * 0.1})`,
          type: ParticleType.EXPLOSION,
        });
      }
      // Layer 5: Debris (15 fragments)
      for (let d = 0; d < 15; d++) {
        const angle = (d / 15) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 100 + Math.random() * 150;
        this.particles.push({
          x: r.x, y: r.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 30,
          life: 0.8 + Math.random() * 0.5,
          maxLife: 1.3,
          size: 3 + Math.random() * 6,
          color: `rgba(${200 + Math.floor(Math.random() * 55)}, ${100 + Math.floor(Math.random() * 80)}, 0, 0.9)`,
          type: ParticleType.ASH,
        });
      }
      // Screen shake + sound
      this.screenShake = 28;
      this.audio.playTimedBombExplode();
      Vibration.vibrateDamage();

      // 伤害附近蟑螂（196px范围，与放置炸弹相同）
      for (const other of this.roaches) {
        if (other.state !== RoachState.ALIVE || other.id === r.id) continue;
        const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
        if (d < 196) {
          const dmg = 20 * (1 - d / 196);
          other.hp -= dmg;
          other.burnDamage = dmg * 2;
          other.inFire = true;
          if (other.hp <= 0 && this._deathChainDepth < this.MAX_DEATH_CHAIN_DEPTH) {
            other.hp = 0;
            other.state = RoachState.DEAD;
            other.deathTimer = 1.5;
            this.killRoach(other, this.roaches.indexOf(other));
          }
        }
      }

      // Damage defense line
      const defDmg = this.difficulty === 'hard' ? 20 : 8;
      if (this.player.shieldTimer > 0) {
        this.addFloatingText(r.x, this.defenseLineY() - 20, '护盾抵消!', '#22d3ee');
      } else {
        this.defenseHp -= defDmg;
        this.addFloatingText(r.x, this.defenseLineY() - 20, `炸弹爆炸! -${defDmg}`, '#ef4444');
      }

      this.addFloatingText(r.x, r.y - 50, '轰!', '#8b2020');
    } finally {
      this._deathChainDepth--;
    }
  }

  killRoach(r: Roach,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _index: number) {
    // Reset death chain depth at top-level kill entry (not from chain reactions)
    if (this._deathChainDepth === 0) {
      this._deathChainDepth = 1;
    }

    // Suicide roaches: explode on death (even before reaching defense line)
    // This ensures they always deal damage when killed by flame
    if (r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) {
      this.suicideDeathExplode(r);
    }

    // ===== 变异蟑螂死亡："胚胎暴走" - 生成 2 只蟑螂 =====
    if (r.type === RoachType.MUTANT) {
      this.roachAISystem!.forceEmbryoBurst(r);
    }

    r.state = RoachState.DEAD;
    // 延长 MUTANT 死亡计时器以允许 7 帧变形动画完成
    // 7 帧 × 200ms = 1.4秒 + 0.6秒缓冲
    r.deathTimer = r.type === RoachType.MUTANT ? 2.0 : 0.6;

    // 清理死亡蟑螂的粘液弹包裹（委托给 StickySystem）
    this.stickySystem!.cleanupRoachDeath(r);

    // 飞行蟑螂：播放死亡音效，如果没有活着的飞行蟑螂则停止嗡嗡声循环
    if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
      this.audio.playFlyingDeath();
      // 检查是否还有活着的飞行蟑螂
      const anyFlyingAlive = this.roaches.some(
        ro => (ro.type === RoachType.FLYING || ro.type === RoachType.FLYING_SUICIDE) && ro.state === RoachState.ALIVE
      );
      if (!anyFlyingAlive) {
        this.audio.stopFlyingBuzzLoop();
      }
    }

    // 分裂蟑螂：首次死亡时生成 5 只小蟑螂
    if (r.type === RoachType.SPLITTING && !r.hasSplit) {
      r.hasSplit = true;
      r.deathTimer = 0.5;
      for (let s = 0; s < 5; s++) {
        const angle = (s / 5) * Math.PI * 2;
        const spawnX = r.x + Math.cos(angle) * 50;
        const spawnY = r.y + Math.sin(angle) * 30;
        const small: Roach = {
          ...this.createSmallRoachFromSplit(spawnX, spawnY),
          id: nextId++,
        };
        this.roaches.push(small);
      }
      this.addFloatingText(r.x, r.y - 30, '分裂x5!', '#ff8800');
    }

    // 飞行蟑螂：死亡时解体并坠落
    if (r.type === RoachType.FLYING) {
      r.deathTimer = 2.0; // Longer for disintegration animation
      // 翅膀碎片粒子（翅膀碎片飞散）
      for (let w = 0; w < 8; w++) {
        const wingAngle = (w / 8) * Math.PI * 2;
        const wingSpeed = 60 + Math.random() * 100;
        this.particles.push({
          x: r.x + (Math.random() - 0.5) * 20,
          y: r.y + (Math.random() - 0.5) * 15,
          vx: Math.cos(wingAngle) * wingSpeed + (Math.random() - 0.5) * 40,
          vy: Math.sin(wingAngle) * wingSpeed * 0.5 - 30 - Math.random() * 40,
          life: 1.5 + Math.random(),
          maxLife: 1.5 + Math.random(),
          size: 3 + Math.random() * 8,
          color: `rgba(${140 + Math.random() * 60}, ${160 + Math.random() * 60}, ${180 + Math.random() * 50}, 0.8)`,
          type: ParticleType.ICE,
        });
      }
      // Body debris (darker fragments)
      for (let b = 0; b < 12; b++) {
        const debrisAngle = Math.random() * Math.PI * 2;
        const debrisSpeed = 30 + Math.random() * 80;
        this.particles.push({
          x: r.x + (Math.random() - 0.5) * 15,
          y: r.y + (Math.random() - 0.5) * 10,
          vx: Math.cos(debrisAngle) * debrisSpeed,
          vy: Math.sin(debrisAngle) * debrisSpeed * 0.3 - 20,
          life: 2 + Math.random(),
          maxLife: 2 + Math.random(),
          size: 2 + Math.random() * 6,
          color: `rgba(${30 + Math.random() * 30}, ${30 + Math.random() * 30}, ${35 + Math.random() * 25}, 0.7)`,
          type: ParticleType.ASH,
        });
      }
      // 羽毛/火花粒子
      ParticleSpawner.spawnSparkParticles(this.particles,r.x, r.y, 20);
      this.addFloatingText(r.x, r.y - 20, '解体!', '#88ccff');
    }
    // 自爆/飞行自爆蟑螂：死亡时增强爆炸
    if (r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) {
      const explodeRadius = 80;
      let hitCount = 0;
      for (const other of this.roaches) {
        if (other.state !== RoachState.ALIVE || other.id === r.id) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < explodeRadius) {
          const dmg = 12 * (1 - dist / explodeRadius);
          other.hp -= dmg;
          other.burnDamage = dmg * 2;
          other.damageFlash = (other.armorHp > 0) ? 0 : 2; // No flash while armor intact
          other.inFire = true;
          hitCount++;
        }
      }
      // 增强死亡爆炸特效（5秒碎片）
      ParticleSpawner.spawnExplosionParticles(this.particles,r.x, r.y, 35);
      ParticleSpawner.spawnSmokeParticles(this.particles,r.x, r.y, 30);
      ParticleSpawner.spawnDebrisParticles(this.particles,r.x, r.y, 20);
      ParticleSpawner.spawnFireRingParticles(this.particles,r.x, r.y, 15);
      ParticleSpawner.spawnSparkParticles(this.particles,r.x, r.y, 20);
      this.screenShake = 12;
      this.audio.playSuicideExplode();
      Vibration.vibrateSuicideExplode();
      this.addFloatingText(r.x, r.y - 30, hitCount > 0 ? `爆炸!(${hitCount}只受波及)` : '爆炸!', '#ff6600');
    }

    this.audio.playKill();
    Vibration.vibrateKill();
    ParticleSpawner.spawnAshParticles(this.particles,r.x, r.y, r.type === RoachType.QUEEN ? 50 : (r.type === RoachType.LARGE ? 20 : 12));
    ParticleSpawner.spawnSparkParticles(this.particles,r.x, r.y, r.type === RoachType.QUEEN ? 40 : (r.type === RoachType.LARGE ? 15 : 8));
    ParticleSpawner.spawnBloodParticles(this.particles,r.x, r.y, r.type === RoachType.QUEEN ? 40 : (r.type === RoachType.LARGE ? 25 : 15));

    const sceneMult = this.getSceneConfig().rewardMultiplier;
    const rewardMult = (this.talentMultipliers.rewardMultiplier || 1) * sceneMult;
    let reward = Math.floor((r.reward ?? ENEMY_DEFS[r.type].reward) * rewardMult);
    if (this.difficulty === 'hard') reward = Math.floor(reward * 0.8);

    switch (r.type) {
      case RoachType.SMALL: this.economy.smallKills++; break;
      case RoachType.LARGE: this.economy.largeKills++; break;
      case RoachType.FLYING: this.economy.flyingKills++; break;
      case RoachType.ARMORED: this.economy.armoredKills++; break;
      case RoachType.SPLITTING: this.economy.splittingKills++; break;
      case RoachType.SUICIDE: this.economy.suicideKills++; break;
      case RoachType.FLYING_SUICIDE: this.economy.suicideKills++; break; // 作为自杀击杀计数
      case RoachType.QUEEN: this.economy.queenKills++; break;
      // 医院专属蟑螂击杀（计入总数但不需要单独分类）
      case RoachType.NURSE: break;
      case RoachType.MUTANT: break;
    }

    // Update encyclopedia kill counts
    if (this.progress.encyclopedia?.entries) {
      const entry = this.progress.encyclopedia.entries.find(e => e.type === r.type);
      if (entry) {
        entry.killCount = (entry.killCount || 0) + 1;
        entry.unlocked = true;
      }
    }

    // ===== 小兵死亡反噬（第一阶段核心机制） =====
    // 当小兵在第一阶段死亡时，BOSS 受到反噬伤害
    if (this.bossBattle.active && this.bossBattle.phase === 1 && !r.isBoss) {
      const boss = this.roaches.find(br => br.type === RoachType.QUEEN && br.state === RoachState.ALIVE && br.isBoss);
      if (boss && boss.hp > 0) {
        let backlashDmg = 0;
        switch (r.type) {
          case RoachType.SMALL: backlashDmg = 50; break;
          case RoachType.LARGE: backlashDmg = 150; break;
          case RoachType.FLYING: backlashDmg = 100; break;
          case RoachType.SUICIDE: backlashDmg = 200; break;
          case RoachType.FLYING_SUICIDE: backlashDmg = 180; break;
          case RoachType.SPLITTING: backlashDmg = 150; break;
          case RoachType.ARMORED: backlashDmg = 100; break;
        }
        if (backlashDmg > 0) {
          boss.hp -= backlashDmg;
          // bossHp is now purely for 4-layer UI display - updated by wave clears only
          // Visual feedback for backlash
          this.addFloatingText(boss.x + (Math.random() - 0.5) * 40, boss.y - 30, `反噬 -${backlashDmg}`, '#a855f7');
          boss.damageFlash = 1;
          // 紫色反噬粒子
          for (let k = 0; k < 3; k++) {
            this.particles.push({
              x: boss.x + (Math.random() - 0.5) * 60,
              y: boss.y + (Math.random() - 0.5) * 60,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60 - 30,
              life: 0.6, maxLife: 0.6,
              size: 4, color: '#a855f7',
              type: ParticleType.SPARK,
            });
          }
        }
      }
    }

    this.economy.totalKills++;
    this.economy.money += reward;
    this.economy.totalMoneyEarned += reward;
    this.addFloatingText(r.x, r.y - 20, `+¥${reward}`, '#4ade80');
    this.screenShake = r.isBoss ? 12 : (r.type === RoachType.LARGE ? 6 : 3);

    // Boss 死亡清除所有剩余蟑螂
    if (r.isBoss) {
      this.bossSystem!.activeBosses--;
      this.addFloatingText(this.width / 2, this.height / 2, 'BOSS 击败!', '#fbbf24');
      // Kill all remaining roaches
      for (const other of this.roaches) {
        if (other.state === RoachState.ALIVE && other.id !== r.id) {
          other.hp = 0;
        }
      }
    }

    // ===== 定时自爆：尸体炸弹 =====
    // 被击杀时（非放置炸弹期间），在地面留下3秒倒计时炸弹
    if (r.type === RoachType.TIMED_SUICIDE && !r.hasPlacedBomb) {
      this.deadTimedBombs.push({
        id: this.nextBombId++,
        x: r.x,
        y: r.y,
        timer: 3.0, // 3 second countdown
        flashPhase: 0,
      });
      this.addFloatingText(r.x, r.y - 40, '尸体炸弹 3秒!', '#ff4444');
      this.audio.playTimedBombDrop();
    }

    this.onEconomyUpdate?.(this.economy);
  }

  createSmallRoachFromSplit(x: number, y: number): Roach {
    const isHard = this.difficulty === 'hard';
    return {
      id: 0, x, y, vx: 0, vy: 0,
      type: RoachType.SMALL,
      hp: isHard ? 1 : 1,
      maxHp: isHard ? 1 : 1,
      state: RoachState.ALIVE,
      speed: (isHard ? 2.4 : 1.6) * (0.5 + Math.random() * 0.5),
      baseSpeed: isHard ? 2.4 : 1.6,
      burnDamage: 0, inFire: false,
      angle: 0, wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 2 + Math.random() * 2,
      isEnraged: false, deathTimer: 0, animFrame: 0, animTimer: 0,
      panicTimer: 0, panicAngle: 0, stunTimer: 0, isStunned: false,
      facingRight: true,
      altitude: 0, wingPhase: 0, armorHp: 0, maxArmorHp: 0,
      hasSplit: false, fuseTimer: 0, isFused: false,
      spawnTimer: 0, isBoss: false, isCharging: false,
      stuckTimer: 0, poisonTimer: 0, poisonDamage: 0,
      fanSlowTimer: 0, fanSlowFactor: 0, fanPushY: 0,
      wrappedByDropId: null, wrapTimer: 0, damageFlash: 0,
      dodgeDir: 0, dodgeTimer: 0, wasDodging: false,
      isSplitChild: true,
    };
  }


  // ===== 碰撞检测 =====
  /** 检测火焰、道具与蟑螂之间的碰撞 */
  /**
   * 委托给 CollisionSystem 模块 —— 火焰-蟑螂碰撞检测
   */
  checkCollisions() {
    this.collisionSystem!.checkFlameCollisions(
      this.player,
      this.roaches,
      this.tripleFlameSystem!.getState(),
      (id) => this.stickySystem!.isStuckByBoard(id, this.roaches)
    );
    this.fireZones = [];
  }

  isStuckByBoard(roachId: number): boolean {
    return this.stickySystem!.isStuckByBoard(roachId, this.roaches);
  }

  getWeaponDamage(p: Player): number {
    const isHard = this.difficulty === 'hard';
    switch (p.currentWeapon) {
      case 'sticky': return isHard ? 0 : 0; // Sticky board does no damage
      case 'poison': return isHard ? 12 : 20;
      case 'shotgun': return isHard ? 35 : 50;
      case 'molotov': return isHard ? 25 : 40;
      default: return isHard ? 30 : 45;
    }
  }

  /**
   * @deprecated 此方法已迁移到 CollisionSystem.ts
   * 请使用新的模块化碰撞检测系统
   */
  applyWeaponEffect(r: Roach, weapon: string) {
    switch (weapon) {
      case 'poison':
        if (r.poisonTimer <= 0) {
          r.poisonTimer = 5;
          r.poisonDamage = r.type === RoachType.QUEEN ? 2 : 1;
        }
        break;
      // sticky board does no damage - handled by updateStickyBoards
    }
  }

  /**
   * 委托给 CollisionSystem 模块 —— 防线突破检测
   */
  checkDefense() {
    const dl = this.defenseLineY();
    const defenseHpRef = { value: this.defenseHp };
    const activeBossesRef = { value: this.activeBosses };

    const result = this.collisionSystem!.checkDefenseBreach(
      this.roaches, dl, this.player, defenseHpRef, activeBossesRef,
      {
        onSuicideExplode: (r, i) => { this.suicideExplode(r, i); },
        onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
        onPlayBreach: () => { this.audio.playBreach(); },
        onVibrateBreach: () => { Vibration.vibrateBreach(); },
        onScreenShake: (amount) => { this.screenShake = amount; },
        onBossStop: this.bossSystem!.bossBattle.active,
      }
    );

    // 同步回引擎状态
    this.defenseHp = defenseHpRef.value;
    this.activeBosses = activeBossesRef.value;

    // 处理自杀爆炸
    for (const idx of result.suicideExplodeIndices) {
      this.suicideExplode(this.roaches[idx], idx);
    }

    // 移除突破防线的蟑螂
    for (const idx of result.removedIndices.sort((a, b) => b - a)) {
      this.roaches.splice(idx, 1);
    }

    // 处理防线突破统计
    if (result.breachCount > 0) {
      this.economy.breaches += result.breachCount;
      if (this.currentScene === SceneType.HOSPITAL) {
        this.hospitalBreaches += result.breachCount;
      }
    }

    // 游戏结束处理
    if (result.gameOver) {
      this.defenseHp = 0;
      Vibration.vibrateGameOver();
      this.economy.money = 0;
      this.state = GameState.GAME_OVER;
      this.audio.stopBGM();
      this.audio.stopFire();
      this.audio.stopFanLoop();
      this.audio.stopFireWallBurn();
      this.audio.stopFlyingBuzzLoop();
      this.economy.highestWave = Math.max(this.economy.highestWave, this.wave);
      if (this.gameMode === GameMode.ENDLESS) {
        this.economy.highestEndlessWave = Math.max(this.economy.highestEndlessWave, this.wave);
        this.progress.highestEndlessWave = Math.max(this.progress.highestEndlessWave, this.wave);
        if (this.endlessElapsedTime > this.endlessBestTime) {
          this.endlessBestTime = this.endlessElapsedTime;
          this.saveEndlessBestTime(this.endlessBestTime);
        }
      }
      this.progress.highestWave = Math.max(this.progress.highestWave, this.wave);
      this.progress.totalKills += this.economy.totalKills;
      this.saveProgress();
      this.onGameOver?.(this.economy, this.wave);
      this.onStateChange?.(this.state);
    }
  }

  // ===== 波次系统 =====
  updateWave() {
    // 跳过波次后道具序列期间的波次逻辑
    if (this.state === GameState.ITEM_DROP || this.state === GameState.ITEM_REVEAL) return;

    const result = this.waveManager!.update(this.deltaTime);
    if (result.skipRest) return;

    // ===== 定时自爆：交错生成（每只间隔8秒以保持节奏） =====
    if (this.currentScene === SceneType.HOSPITAL && this.timedSuicideSpawnRemaining > 0) {
      this.timedSuicideSpawnTimer -= this.deltaTime;
      if (this.timedSuicideSpawnTimer <= 0) {
        this.spawnRoach(RoachType.TIMED_SUICIDE);
        this.timedSuicideSpawnRemaining--;
        this.timedSuicideSpawnTimer = this.timedSuicideSpawnRemaining > 0 ? 8.0 : 0;
        if (this.timedSuicideSpawnRemaining > 0) {
          this.addFloatingText(this.width / 2, 150, `定时自爆蟑螂出现! 下一只8秒后`, '#f59e0b');
        } else {
          this.addFloatingText(this.width / 2, 150, '定时自爆蟑螂全部出现!', '#f59e0b');
        }
      }
    }

    // ===== 定时自爆：更新尸体炸弹 =====
    for (let i = this.deadTimedBombs.length - 1; i >= 0; i--) {
      const bomb = this.deadTimedBombs[i];
      bomb.timer -= this.deltaTime;
      bomb.flashPhase += this.deltaTime;
      // Countdown floating text
      const secs = Math.ceil(bomb.timer);
      if (bomb.timer > 0 && Math.abs(bomb.timer - secs) < 0.05 && secs <= 3) {
        this.addFloatingText(bomb.x, bomb.y - 25, `${secs}`, secs <= 1 ? '#ef4444' : '#fbbf24');
      }
      // Red flash pulse during countdown (last 3 seconds)
      if (bomb.timer <= 3 && bomb.timer > 0) {
        const flashIntensity = (Math.sin(bomb.flashPhase * 10) + 1) * 0.5;
        if (Math.random() < 0.5) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 20 + Math.random() * 40;
          this.particles.push({
            x: bomb.x + Math.cos(angle) * (15 + Math.random() * 10),
            y: bomb.y + Math.sin(angle) * (10 + Math.random() * 5),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 20,
            life: 0.3 + Math.random() * 0.3,
            maxLife: 0.6,
            size: 2 + Math.random() * 4,
            color: `rgba(255, ${Math.floor(20 + flashIntensity * 40)}, 0, ${0.6 + flashIntensity * 0.4})`,
            type: ParticleType.SPARK,
          });
        }
        if (bomb.timer <= 1 && flashIntensity > 0.7) {
          this.particles.push({
            x: bomb.x, y: bomb.y,
            vx: 0, vy: 0,
            life: 0.1, maxLife: 0.1,
            size: 60 + Math.random() * 40,
            color: `rgba(255, 0, 0, ${0.15 + flashIntensity * 0.15})`,
            type: ParticleType.EXPLOSION,
          });
        }
      }
      // 0.5s warning pulse
      if (bomb.timer <= 0.5 && Math.floor(bomb.timer * 6) % 2 === 0) {
        this.addFloatingText(bomb.x, bomb.y - 40, '!!', '#ff0000');
      }
      // EXPLOSION!
      if (bomb.timer <= 0) {
        this.screenShake = 22;
        this.audio.playTimedBombExplode();
        Vibration.vibrateDamage();
        for (const other of this.roaches) {
          if (other.state === 'dead') continue;
          const dx = other.x - bomb.x;
          const dy = other.y - bomb.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            let dmg = 30;
            if (other.armorHp && other.armorHp > 0) {
              other.armorHp -= dmg * 0.8;
              dmg *= 0.2;
            }
            other.hp -= dmg;
            if (other.hp <= 0) {
              other.hp = 0;
              other.state = 'dead';
              other.deathTimer = 1.5;
              this.killRoach(other, this.roaches.indexOf(other));
            }
          }
        }
        const defenseDist = Math.abs(bomb.y - this.defenseLineY());
        if (defenseDist < 120) {
          const defenseDmg = 12;
          if (this.player.shieldTimer > 0) {
            this.addFloatingText(bomb.x, this.defenseLineY() - 20, '护盾抵消!', '#22d3ee');
          } else {
            this.defenseHp -= defenseDmg;
            this.addFloatingText(bomb.x, this.defenseLineY() - 20, `尸体炸弹! -${defenseDmg}`, '#ef4444');
          }
        }
        ParticleSpawner.spawnExplosionParticles(this.particles,bomb.x, bomb.y, 20);
        ParticleSpawner.spawnSmokeParticles(this.particles,bomb.x, bomb.y, 10);
        this.addFloatingText(bomb.x, bomb.y - 40, '尸体炸弹爆炸!', '#ff4400');
        this.deadTimedBombs.splice(i, 1);
      }
    }

    // ===== HOSPITAL EXCLUSIVE: Update placed bombs (timed suicide) =====
    if (this.currentScene === SceneType.HOSPITAL) {
      for (let bi = this.placedBombs.length - 1; bi >= 0; bi--) {
        const bomb = this.placedBombs[bi];
        bomb.timer -= this.deltaTime;
        const secs = Math.ceil(bomb.timer);
        if (bomb.timer > 0 && Math.abs(bomb.timer - secs) < 0.05 && secs <= 3) {
          this.addFloatingText(bomb.x, bomb.y - 20, `${secs}`, secs <= 1 ? '#ef4444' : '#fbbf24');
        }
        if (bomb.timer <= 0) {
          ParticleSpawner.spawnExplosionParticles(this.particles,bomb.x, bomb.y, 80);
          ParticleSpawner.spawnFireRingParticles(this.particles,bomb.x, bomb.y, 30);
          ParticleSpawner.spawnSmokeParticles(this.particles,bomb.x, bomb.y, 40);
          for (let fi = 0; fi < 3; fi++) {
            this.particles.push({
              x: bomb.x + (Math.random() - 0.5) * 30, 
              y: bomb.y + (Math.random() - 0.5) * 20, 
              vx: 0, vy: 0,
              life: 0.2 + fi * 0.1, maxLife: 0.2 + fi * 0.1,
              size: 60 + fi * 30,
              color: `rgba(${255}, ${180 - fi * 40}, ${50 - fi * 20}, ${0.5 - fi * 0.1})`,
              type: ParticleType.EXPLOSION,
            });
          }
          for (let d = 0; d < 15; d++) {
            const angle = (d / 15) * Math.PI * 2 + Math.random() * 0.3;
            const speed = 100 + Math.random() * 150;
            this.particles.push({
              x: bomb.x, y: bomb.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 30,
              life: 0.8 + Math.random() * 0.5,
              maxLife: 1.3,
              size: 3 + Math.random() * 6,
              color: `rgba(${200 + Math.floor(Math.random() * 55)}, ${100 + Math.floor(Math.random() * 80)}, 0, 0.9)`,
              type: ParticleType.ASH,
            });
          }
          this.screenShake = 28;
          this.audio.playTimedBombExplode();
          Vibration.vibrateDamage();
          for (const other of this.roaches) {
            if (other.state !== RoachState.ALIVE || other.isBoss) continue;
            const d = Math.sqrt((other.x - bomb.x) ** 2 + (other.y - bomb.y) ** 2);
            if (d < 196) {
              const dmg = 20 * (1 - d / 196);
              other.hp -= dmg;
              other.burnDamage = dmg * 2;
              other.inFire = true;
              if (other.hp <= 0) this.killRoach(other, this.roaches.indexOf(other));
            }
          }
          const defDmg = this.difficulty === 'hard' ? 20 : 8;
          if (this.player.shieldTimer > 0) {
            this.addFloatingText(bomb.x, this.defenseLineY() - 20, '护盾抵消!', '#22d3ee');
          } else {
            this.defenseHp -= defDmg;
            this.addFloatingText(bomb.x, this.defenseLineY() - 20, `炸弹爆炸! -${defDmg}`, '#ef4444');
          }
          this.placedBombs.splice(bi, 1);
        }
      }
    }
  }

  /** 启动新波次（显示倒计时或直接生成） */
  startWave() {
    this.waveManager!.startWave();
  }

  // Start 3-2-1 countdown before wave spawn. Returns true if countdown was started.
  startCountdown(): boolean {
    return this.waveManager!.startCountdown();
  }

  // Called when countdown reaches 0 - actually spawn the wave
  doWaveSpawn() {
    this.waveManager!.doWaveSpawn();
  }

  // [REMOVED] Hospital egg pod system — dead code (spawnHospitalEggPods, updateHospitalEggPods, hatchHospitalEggPod, damageHospitalEggPod, triggerDisinfectionReward)

  getWaveConfig(wave: number): WaveConfig {
    return this.waveManager!.getWaveConfig(wave);
  }

  unlockNextScene() {
    // Ensure scenesCompleted exists (defensive for optional field)
    if (!this.progress.scenesCompleted) {
      this.progress.scenesCompleted = [];
    }
    // Mark current scene as completed
    if (!this.progress.scenesCompleted.includes(this.currentScene)) {
      this.progress.scenesCompleted.push(this.currentScene);
    }
    this.scenesCleared.add(this.currentScene);

    // Unlock next scene in chain
    const currentIdx = SCENE_UNLOCK_CHAIN.indexOf(this.currentScene);
    if (currentIdx >= 0 && currentIdx < SCENE_UNLOCK_CHAIN.length - 1) {
      const nextScene = SCENE_UNLOCK_CHAIN[currentIdx + 1];
      if (!this.progress.scenesUnlocked.includes(nextScene)) {
        this.progress.scenesUnlocked.push(nextScene);
        this.saveProgress(); // Save immediately after unlocking
        this.addFloatingText(this.width / 2, this.height / 2 + 50, `解锁新场景: ${SCENE_CONFIGS[nextScene].name}!`, '#fbbf24');
      }
    }
  }

  // =============================================================================
  // 粒子系统：12 种粒子类型，支持动态性能自适应
  // 类型：fire, smoke, ember, ash, spark, blood, ice, poison_cloud, explosion,
  //       rain, lightning, shield
  // 性能：前 120 帧采样帧率，动态调整粒子数量上限 (150-400)
  // =============================================================================
  // [REMOVED] spawnConeFire, spawnSmokeParticles, spawnAshParticles, spawnBloodParticles, spawnSparkParticles, spawnExplosionParticles — migrated to ParticleSpawner

  /**
   * 添加浮动文字特效
   * @param {number} x - X 坐标
   * @param {number} y - Y 坐标
   * @param {string} text - 显示文字
   * @param {string} color - 文字颜色
   * @param {number} durationMs - 持续时间（毫秒）
   * @param {number} fontSize - 字体大小
   */
  addFloatingText(x: number, y: number, text: string, color: string, durationMs?: number, fontSize?: number) {
    // Cap floating texts - truncate from end (much faster than splice from start)
    if (this.floatingTexts.length > 20) {
      this.floatingTexts.length = 20;
    }
    const maxLife = durationMs ? durationMs / 1000 : 1.0;
    const scale = fontSize ? fontSize / 16 : 1.0;
    this.floatingTexts.push({ x, y, text, color, life: maxLife, maxLife, vy: -35, scale });
  }

  /** 更新所有粒子特效（位置、生命周期） */
  /** 更新粒子（委托给 ParticleSystem 模块） */
  updateParticles() {
    this.particleSystem!.updateConfig({
      particleLimit: this._particleLimit,
      deltaTime: this.deltaTime,
      defenseLineY: this.defenseLineY(),
    });
    this.particleSystem!.updateParticlesAndFloatingTexts(
      this.particles,
      this.floatingTexts,
      this.fireZones,
      this.roaches,
      this.armorShieldCache
    );
  }

  /** 更新火焰墙（保留在引擎中，含音频停止和天赋倍数逻辑） */
  updateFireWalls() {
    for (let i = this.fireWalls.length - 1; i >= 0; i--) {
      const wall = this.fireWalls[i];
      wall.life -= this.deltaTime;

      if (wall.life <= 0) {
        this.fireWalls.splice(i, 1);
        // Stop burn sound if no fire walls remain
        if (this.fireWalls.length === 0) {
          this.audio.stopFireWallBurn();
        }
        continue;
      }

      // Damage roaches passing through the fire wall (ground only, flying pass over)
      // Fire walls have NO effect on BOSS
      for (const r of this.roaches) {
        if (r.state !== RoachState.ALIVE || r.isBoss) continue;
        // Flying roaches pass OVER fire walls unaffected
        if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) continue;
        // Skip timed suicide roach during bomb placement (invincible)
        if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
        const rSize = r.size ?? ENEMY_DEFS[r.type].size;
        const explosionMult2 = this.talentMultipliers.explosionRange || 1;
        if (r.x >= wall.x1 && r.x <= wall.x2 && Math.abs(r.y - wall.y) < (wall.height + rSize * 0.5) * explosionMult2) {
          // Apply fire affinity talent: fire damage boost
          const fireDmgMult = this.talentMultipliers.fireDamage || 1;
          const dmg = wall.damagePerSecond * fireDmgMult * this.deltaTime;
          // Check cached armor meat shield protection
          const isProtected = r.armorHp <= 0 && this.armorShieldCache.has(r.id);
          if (isProtected) {
            r.hp -= dmg * 0.2; // Protected: only 20% damage gets through
            r.damageFlash = 0;
          } else {
            r.hp -= dmg; // Direct hit
            r.damageFlash = (r.armorHp > 0) ? 0 : 0.1;
          }
          // Apply fire affinity talent to burn damage display
          const fireDmgMult2 = this.talentMultipliers.fireDamage || 1;
          r.burnDamage = wall.damagePerSecond * fireDmgMult2;
          r.inFire = true;
        }
      }

      // NOTE: Egg pods are invincible - they cannot be damaged by fire or weapons.
      // They always hatch after their hatchTimer expires.

      // Emit fire particles along the wall
      if (Math.random() < 0.8) {
        const px = wall.x1 + Math.random() * (wall.x2 - wall.x1);
        this.particles.push({
          x: px + (Math.random() - 0.5) * 10,
          y: wall.y + (Math.random() - 0.5) * wall.height,
          vx: (Math.random() - 0.5) * 20,
          vy: -30 - Math.random() * 40,
          life: 0.3 + Math.random() * 0.3,
          maxLife: 0.5,
          size: 3 + Math.random() * 5,
          color: `rgba(255, ${100 + Math.random() * 100}, 20, ${0.6 + Math.random() * 0.4})`,
          type: ParticleType.EXPLOSION,
        });
      }
    }
  }

  updateScreenShake() {
    if (this.screenShake > 0) {
      this.screenShakeX = (Math.random() - 0.5) * this.screenShake * 2;
      this.screenShakeY = (Math.random() - 0.5) * this.screenShake * 2;
      this.screenShake *= 0.88;
      if (this.screenShake < 0.5) this.screenShake = 0;
    } else {
      this.screenShakeX = 0;
      this.screenShakeY = 0;
    }
  }

  // ========== SWATTER (delegated to SwatterSystem module) =========

  // [REMOVED] spawnLightningParticles — migrated to ParticleSpawner


  // =============================================================================
  // 天气系统：雨天/浓雾/黑夜/闪电，影响视觉效果和蟑螂行为
  // =============================================================================
  /** 更新天气粒子（雨、雾、夜晚闪电） */
  updateWeather() {
    const scene = this.getSceneConfig();
    const weather = scene.weather;

    if (weather === WeatherType.RAIN) {
      // 雨滴粒子
      if (Math.random() < 0.4) {
        const rainParticle: Particle = {
          x: Math.random() * this.width,
          y: -10,
          vx: -20 + Math.random() * 10,
          vy: 200 + Math.random() * 100,
          life: 2,
          maxLife: 2,
          size: 1 + Math.random(),
          color: 'rgba(150, 180, 220, 0.4)',
          type: ParticleType.RAIN,
        };
        this.weatherParticles.push(rainParticle);
      }
    } else if (weather === WeatherType.FOG) {
      // 缓慢移动的雾
      if (Math.random() < 0.05) {
        const fogParticle: Particle = {
          x: Math.random() < 0.5 ? -20 : this.width + 20,
          y: Math.random() * this.height,
          vx: (Math.random() < 0.5 ? 1 : -1) * (10 + Math.random() * 10),
          vy: -5 + Math.random() * 10,
          life: 8 + Math.random() * 4,
          maxLife: 8 + Math.random() * 4,
          size: 30 + Math.random() * 50,
          color: `rgba(180, 180, 160, ${0.05 + Math.random() * 0.05})`,
          type: ParticleType.SMOKE,
        };
        this.weatherParticles.push(fogParticle);
      }
    } else if (weather === WeatherType.NIGHT) {
      // 闪电
      this.lightningTimer -= this.deltaTime;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 5 + Math.random() * 10;
        if (Math.random() < 0.3) {
          this.lightningFlash = 0.3;
          this.addFloatingText(this.width / 2, this.height / 2 - 100, '⚡ 闪电 ⚡', '#fbbf24');
        }
      }
      // 更新闪电闪光
      if (this.lightningFlash > 0) {
        this.lightningFlash -= this.deltaTime;
      }
    }

    // 更新天气粒子
    for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
      const p = this.weatherParticles[i];
      p.life -= this.deltaTime;
      p.x += p.vx * this.deltaTime;
      p.y += p.vy * this.deltaTime;
      if (p.type === ParticleType.SMOKE && weather === WeatherType.FOG) {
        p.size *= 1.005;
      }
      if (p.life <= 0) {
        this.weatherParticles.splice(i, 1);
      }
    }
  }

  // =============================================================================
  // 天赋系统：天赋点管理、天赋加成计算
  // =============================================================================
  getTalentPoints(): number {
    return this.progress.talentTree.points;
  }

  spendTalentPoint(talentId: string): boolean {
    const def = TALENT_DEFS.find(t => t.id === talentId);
    if (!def) return false;
    const currentLevel = this.progress.talentTree.talents[talentId] || 0;
    if (currentLevel >= def.maxLevel) return false;
    if (this.progress.talentTree.points < def.cost) return false;

    this.progress.talentTree.points -= def.cost;
    this.progress.talentTree.talents[talentId] = currentLevel + 1;

    // Check weapon unlocks
    if (talentId === 'sticky_weapon') {
      if (!this.progress.weaponsUnlocked) this.progress.weaponsUnlocked = [];
      if (!this.progress.weaponsUnlocked.includes('sticky')) this.progress.weaponsUnlocked.push('sticky');
    }
    if (talentId === 'poison_weapon') {
      if (!this.progress.weaponsUnlocked) this.progress.weaponsUnlocked = [];
      if (!this.progress.weaponsUnlocked.includes('poison')) this.progress.weaponsUnlocked.push('poison');
    }
    if (talentId === 'shotgun_weapon') {
      if (!this.progress.weaponsUnlocked) this.progress.weaponsUnlocked = [];
      if (!this.progress.weaponsUnlocked.includes('shotgun')) this.progress.weaponsUnlocked.push('shotgun');
    }
    if (talentId === 'molotov_weapon') {
      if (!this.progress.weaponsUnlocked?.includes('molotov')) {
        if (!this.progress.weaponsUnlocked) this.progress.weaponsUnlocked = [];
        this.progress.weaponsUnlocked.push('molotov');
      }
    }

    this.recalcTalentMultipliers();
    this.saveProgress();
    return true;
  }

  addTalentPoints(points: number) {
    this.progress.talentTree.points += points;
    this.saveProgress();
  }

  // =============================================================================
  // 输入处理：鼠标/触摸坐标转换、点击、拖拽、瞄准
  // =============================================================================
  setMousePos(x: number, y: number) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    const gameX = (x - rect.left) * scaleX;
    const gameY = (y - rect.top) * scaleY;

    // If item is being dragged (placing state), update cursor position
    if (this.itemPlaceState === 'placing') {
      this.onItemDrag(gameX, gameY);
      return;
    }

    this.mouseX = gameX;
    this.mouseY = gameY;
  }

  setMouseX(x: number) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const gameX = (x - rect.left) * scaleX;

    // If item is being dragged (placing state), update cursor X
    if (this.itemPlaceState === 'placing') {
      this.onItemDrag(gameX, this.itemPlaceCursorY);
      return;
    }

    this.mouseX = gameX;
    this.mouseY = this.playerBaseY();
  }

  handleScreenClick(x: number, y: number) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    const gameX = (x - rect.left) * scaleX;
    const gameY = (y - rect.top) * scaleY;

    // First click after selecting item: show range at click position
    if (this.itemPlaceState === 'pending_click') {
      this.onItemFirstClick(gameX, gameY);
    }
  }

  setFiring(firing: boolean) {
    // Cannot fire while in item placement mode
    if (this.itemPlaceState !== 'idle') return;
    this.player.isFiring = firing;
  }

  setFlameMode() {
    this.player.flameMode = FlameMode.CONE;
  }

  /** 循环切换火焰模式 */
  cycleFlameMode() {
    // Cycle through unlocked weapons
    const weapons = ['flamethrower', ...(this.progress.weaponsUnlocked || []).filter(w => w !== 'flamethrower')];
    const currentIdx = weapons.indexOf(this.player.currentWeapon);
    const nextIdx = (currentIdx + 1) % weapons.length;
    this.switchWeapon(weapons[nextIdx]);
  }

  // ========== RENDERING ==========
  // ===== MOVEMENT RANGE VISUALIZATION =====
  // Draws a semi-transparent overlay showing the player's walkable ground area
  renderMovementRange(ctx: CanvasRenderingContext2D) {
    RenderUtils.renderMovementRange(ctx, this.currentScene, this.defenseLineY(), (y) => this.getGroundBoundsAtY(y));
  }

  // ===== 渲染系统 =====

  // =============================================================================
  // 主渲染循环：25+ 个子渲染步骤的分层渲染管线
  // 渲染顺序：背景 → 天气背景 → 场景元素 → 实体 → 粒子 → UI 叠加层
  // =============================================================================
  /** 每帧渲染：分层绘制所有游戏元素 */
  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.translate(this.screenShakeX, this.screenShakeY);

    /** 背景渲染（委托给 BackgroundRenderer） */
    BackgroundRenderer.renderBackground(ctx, w, h, {
      currentScene: this.currentScene,
      difficulty: this.difficulty,
      sceneConfig: this.getSceneConfig(),
      imagesLoaded: this.imagesLoaded,
      bgSceneImages: this.bgSceneImages,
      lightningFlash: this.lightningFlash,
      bgKitchenHardImg: this.bgKitchenHardImg,
      bgKitchenEasyImg: this.bgKitchenEasyImg,
      bgImg: this.bgImg,
      bgSewerHardImg: this.bgSewerHardImg,
      bgSewerEasyImg: this.bgSewerEasyImg,
      bgSewerImg: this.bgSewerImg,
      bgDumpHardImg: this.bgDumpHardImg,
      bgDumpEasyImg: this.bgDumpEasyImg,
      bgDumpImg: this.bgDumpImg,
      bgBasementHardImg: this.bgBasementHardImg,
      bgBasementEasyImg: this.bgBasementEasyImg,
      bgBasementImg: this.bgBasementImg,
      bgRooftopHardImg: this.bgRooftopHardImg,
      bgRooftopEasyImg: this.bgRooftopEasyImg,
      bgRooftopImg: this.bgRooftopImg,
      bgStreetHardImg: this.bgStreetHardImg,
      bgStreetEasyImg: this.bgStreetEasyImg,
      bgStreetImg: this.bgStreetImg,
    });
    /** 显示移动范围叠加层（玩家可走区域的半透明可视化） */
    if (this.showMovementRange) {
      this.renderMovementRange(ctx);
    }
    BackgroundRenderer.renderWeatherBackground(ctx, w, h, this.lightningFlash);
    BackgroundRenderer.renderFireZones(ctx, {
      player: this.player,
      tripleFlameState: this.tripleFlameSystem!.getState(),
      time: this.time,
    });
    BackgroundRenderer.renderFireWalls(ctx, this.fireWalls, this.time);
    this.renderStickyBoards();
    this.renderStickyDrops(ctx);
    this.renderWeaponDrops(ctx);
    this.renderParticles(ctx);
    this.renderBaitMark(ctx);
    // Render placed bombs with fire glow + countdown zoom effect
    if (this.placedBombs.length > 0) {
      const bombSize = 64;
      for (const bomb of this.placedBombs) {
        ctx.save();
        ctx.translate(bomb.x, bomb.y);

        // Fire glow pulse (intensifies as timer counts down)
        const secs = Math.ceil(bomb.timer);
        const urgency = Math.max(0, 1 - bomb.timer / 3); // 0→1 as timer goes 3→0
        const pulseRadius = bombSize * 0.8 + urgency * 20 + Math.sin(this.time * 10) * urgency * 5;
        const glowAlpha = 0.15 + urgency * 0.35;
        const fireGradient = ctx.createRadialGradient(0, 0, bombSize * 0.3, 0, 0, pulseRadius);
        fireGradient.addColorStop(0, `rgba(255, 200, 50, ${glowAlpha})`);
        fireGradient.addColorStop(0.5, `rgba(255, 100, 20, ${glowAlpha * 0.6})`);
        fireGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
        ctx.fillStyle = fireGradient;
        ctx.beginPath();
        ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Bomb image
        const img = this.bombImg;
        if (img) {
          ctx.drawImage(img, -bombSize / 2, -bombSize / 2, bombSize, bombSize);
        } else {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(0, 0, bombSize / 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Countdown number with zoom effect (scales up as timer decreases)
        const countColor = bomb.timer <= 1 ? '#ff0000' : '#ffaa00';
        const countScale = 1.2 + urgency * 1.0; // 1.2→2.2x scale (larger!)
        ctx.save();
        ctx.scale(countScale, countScale);
        ctx.font = 'bold 28px sans-serif'; // Larger font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = countColor;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255,0,0,0.8)';
        ctx.shadowBlur = 10;
        const countY = (-bombSize / 2 - 20) / countScale;
        ctx.strokeText(`${secs}`, 0, countY);
        ctx.fillText(`${secs}`, 0, countY);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Urgent flash ring at last second
        if (bomb.timer <= 1) {
          const flashAlpha = 0.3 + Math.sin(this.time * 15) * 0.2;
          ctx.strokeStyle = `rgba(239, 68, 68, ${flashAlpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, pulseRadius * 0.7, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }
    }
    // ===== TIMED SUICIDE: Render dead body bombs (red flashing corpse + countdown) =====
    if (this.deadTimedBombs.length > 0) {
      for (const bomb of this.deadTimedBombs) {
        ctx.save();
        ctx.translate(bomb.x, bomb.y);
        // Red flashing corpse body (pulsing glow)
        const flashIntensity = 0.4 + Math.sin(bomb.flashPhase * 8) * 0.3;
        const corpseRadius = 22;
        // Outer glow pulse
        const glowGradient = ctx.createRadialGradient(0, 0, corpseRadius * 0.5, 0, 0, corpseRadius * 1.8);
        glowGradient.addColorStop(0, `rgba(239, 68, 68, ${0.3 + flashIntensity * 0.4})`);
        glowGradient.addColorStop(0.5, `rgba(220, 38, 38, ${0.2 + flashIntensity * 0.3})`);
        glowGradient.addColorStop(1, 'rgba(153, 27, 27, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(0, 0, corpseRadius * 1.8, 0, Math.PI * 2);
        ctx.fill();
        // Corpse body (dark red, slightly flattened)
        ctx.fillStyle = `rgba(120, 20, 20, ${0.85 + flashIntensity * 0.15})`;
        ctx.beginPath();
        ctx.ellipse(0, 4, corpseRadius, corpseRadius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Corpse border (bright red pulse)
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.6 + flashIntensity * 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Skull icon (simple X eyes)
        ctx.fillStyle = `rgba(255, 100, 100, ${0.7 + flashIntensity * 0.3})`;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀', 0, 2);
        // Countdown number (large, above corpse)
        const secs = Math.ceil(bomb.timer);
        const countColor = bomb.timer <= 1 ? '#ef4444' : '#fbbf24';
        const countScale = 1 + (bomb.timer <= 1 ? 0.3 : 0) * Math.sin(bomb.flashPhase * 12);
        ctx.font = `bold ${Math.floor(22 * countScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = countColor;
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 6;
        ctx.fillText(`${secs}`, 0, -corpseRadius - 12);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
    this.renderRoaches(ctx);

    // ===== MUTANT SPAWN: Green slime burst visual =====
    if (this.roachAISystem!.slimeBurstTimer > 0) {
      const progress = 1 - this.roachAISystem!.slimeBurstTimer / 1.2; // 0→1 over 1.2s
      const sx = this.roachAISystem!.slimeBurstX;
      const sy = this.roachAISystem!.slimeBurstY;
      const alpha = Math.max(0, 1 - progress * 0.8);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';

      // 1. Central green glow
      const glowR = 20 + progress * 80;
      const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      glowGrad.addColorStop(0, `rgba(100, 240, 100, ${alpha * 0.6})`);
      glowGrad.addColorStop(0.5, `rgba(60, 200, 60, ${alpha * 0.4})`);
      glowGrad.addColorStop(1, `rgba(40, 120, 40, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // 2. Green slime droplets spreading outward
      const dropCount = 12;
      for (let di = 0; di < dropCount; di++) {
        const baseAngle = (di / dropCount) * Math.PI * 2 + di * 0.7;
        const spreadDist = progress * 60;
        const dropX = sx + Math.cos(baseAngle) * spreadDist;
        const dropY = sy + Math.sin(baseAngle) * spreadDist * 0.5;
        const dropSize = (5 + di % 3 * 3) * (1 - progress * 0.3);
        const dropAlpha = alpha * (0.7 + (di % 3) * 0.1);

        // Glow behind each droplet
        const dGlow = ctx.createRadialGradient(dropX, dropY, 0, dropX, dropY, dropSize * 2);
        dGlow.addColorStop(0, `rgba(120, 255, 120, ${dropAlpha * 0.5})`);
        dGlow.addColorStop(1, `rgba(60, 180, 60, 0)`);
        ctx.fillStyle = dGlow;
        ctx.beginPath();
        ctx.arc(dropX, dropY, dropSize * 2, 0, Math.PI * 2);
        ctx.fill();

        // Solid droplet core
        ctx.fillStyle = `rgba(80, 220, 80, ${dropAlpha})`;
        ctx.beginPath();
        ctx.arc(dropX, dropY, dropSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Outer slime ring
      const ringR = 15 + progress * 50;
      ctx.strokeStyle = `rgba(100, 255, 130, ${alpha * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(sx, sy, ringR, ringR * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // ===== HEAL BUFF: Rising green plus signs on healed roaches =====
    // Drawn in world coordinates after all roaches for visibility
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (const r of this.roaches) {
      if (r.healBuffTimer && r.healBuffTimer > 0 && r.state === RoachState.ALIVE) {
        const buffProgress = r.healBuffTimer / 2.0; // 1→0
        const baseAlpha = 0.9 * buffProgress;
        const size = r.size ?? 30;

        // 1. Large green glow halo around healed roach
        const haloR = size * 0.8;
        const haloGrad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, haloR * 2);
        haloGrad.addColorStop(0, `rgba(100, 255, 120, ${baseAlpha * 0.25})`);
        haloGrad.addColorStop(0.5, `rgba(60, 220, 80, ${baseAlpha * 0.4})`);
        haloGrad.addColorStop(1, `rgba(40, 150, 60, 0)`);
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, haloR * 2, haloR, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Outer pulsing ring
        const pulseRingR = size * (0.6 + Math.sin(this.time * 4) * 0.15);
        ctx.strokeStyle = `rgba(120, 255, 160, ${baseAlpha * 0.6})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = `rgba(100, 255, 140, ${baseAlpha})`;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, pulseRingR, pulseRingR * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 3. Rising green plus signs (large + strong glow)
        const plusCount = 4;
        for (let pi = 0; pi < plusCount; pi++) {
          const cycleOffset = pi * (2.0 / plusCount);
          const cycleTime = (this.time + cycleOffset + r.id * 0.5) % 2.0;
          const riseProgress = cycleTime / 2.0;

          const riseHeight = 55;
          const plusY = r.y - riseProgress * riseHeight;
          const orbitAngle = this.time * 2 + pi * 1.57 + r.id;
          const orbitR = 16 * (0.4 + riseProgress);
          const plusX = r.x + Math.cos(orbitAngle) * orbitR;

          const plusAlpha = baseAlpha * Math.min(1, riseProgress * 3) * (1 - Math.pow(riseProgress, 2));
          if (plusAlpha <= 0.02) continue;

          const plusSize = 14 + riseProgress * 14;

          ctx.save();
          ctx.translate(plusX, plusY);
          ctx.rotate(Math.sin(this.time * 2 + pi + r.id) * 0.2);

          // Strong outer glow
          ctx.shadowColor = `rgba(80, 255, 120, ${plusAlpha})`;
          ctx.shadowBlur = 20;

          // Thick green plus sign
          ctx.fillStyle = `rgba(100, 255, 150, ${plusAlpha})`;
          const barW = Math.max(3.5, plusSize * 0.32);
          const barL = plusSize;
          ctx.fillRect(-barW / 2, -barL / 2, barW, barL);
          ctx.fillRect(-barL / 2, -barW / 2, barL, barW);

          // Bright white center
          ctx.shadowBlur = 8;
          ctx.shadowColor = `rgba(200, 255, 220, ${plusAlpha})`;
          ctx.fillStyle = `rgba(230, 255, 240, ${plusAlpha * 0.9})`;
          const cw = barW * 1.6;
          ctx.fillRect(-cw / 2, -cw / 2, cw, cw);

          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // 4. Bright green tint overlay on roach body
        ctx.fillStyle = `rgba(80, 200, 80, ${baseAlpha * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, size * 0.52, size * 0.37, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Render egg pods (boss battle)
    if (this.bossBattle.active) {
      this.renderEggPods(ctx);
    }
    this.renderBaitThrow(ctx);
    this.renderPlayer(ctx);
    // Render danmaku bullets and lasers (above roaches, below player)
    this.renderFloatingTexts(ctx);
    this.renderSwatter(ctx);
    this.renderMuzzleFlash(ctx);
    AimingSystem.renderThrowableAim(ctx, this.aimingSystem!.getAimingState(), this.player.x, this.player.y, this.time);
    ThrowableSystem.renderThrowables(ctx, this.throwableSystem!.getThrowables());
    this.renderItemPlacement(ctx);
    RenderUtils.renderInsecticideSpray(ctx, this.insecticideSystem!.getState(), this.width, this.defenseLineY(), this.time);
    this.fanSystem!.renderFan(ctx, this.time);
    this.renderRadarLaser(ctx);
    this.renderWeatherForeground(ctx, w);

    // Boss battle UI overlay
    if (this.bossBattle.active) {
      this.renderBossUI(ctx, w, h);
    }

    // Post-battle item drop on field (rendered on top of everything)
    if (this.state === GameState.ITEM_DROP && this.itemDropOnField && !this.itemDropOnField.collected) {
      this.renderItemDropOnField(ctx);
    }

    ctx.restore();

    // ===== HEAT WARNING HUD: display countdown 3 seconds before overheat =====
    // Drawn OUTSIDE the main ctx.save()/restore() to avoid transform issues
    const p2 = this.player;
    if (p2.heatWarningTimer > 0 && !p2.isOverheated) {
      const warnPulse = (Math.sin(this.time * 12) + 1) * 0.5;
      ctx.save();
      ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + warnPulse * 0.15})`;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + warnPulse * 0.2})`;
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 10;
      const secondsLeft = Math.ceil(p2.heatWarningTimer);
      ctx.fillText(`⚠️ 过热警告 ${secondsLeft}秒`, w / 2, h / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // Frame counter for auto-victory test (dev only, set to 0 in production)

  // Check if player clicked on the dropped item
  handleItemDropClick(clientX: number, clientY: number): boolean {
    if (this.state !== GameState.ITEM_DROP || !this.itemDropOnField || this.itemDropOnField.collected) return false;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    const clickX = (clientX - rect.left) * scaleX;
    const clickY = (clientY - rect.top) * scaleY;
    const bobY = Math.sin(this.itemDropOnField.bobPhase) * 12;
    const itemX = this.itemDropOnField.x;
    const itemY = this.itemDropOnField.y + bobY;
    // Hitbox: 60x60 pixels around the item center
    const hitSize = 35;
    if (Math.abs(clickX - itemX) < hitSize && Math.abs(clickY - itemY) < hitSize) {
      this.itemDropOnField.collected = true;
      // Play collect effect
      ParticleSpawner.spawnSparkParticles(this.particles,itemX, itemY, 15);
      this.audio.playDialogSwitch();
      // Brief delay then transition to ITEM_REVEAL
      setTimeout(() => {
        this.state = GameState.ITEM_REVEAL;
        this.onStateChange?.(GameState.ITEM_REVEAL);
      }, 800);
      return true;
    }
    return false;
  }

  // Render the clickable item drop on the battlefield
  renderItemDropOnField(ctx: CanvasRenderingContext2D) {
    if (!this.itemDropOnField) return;
    DropRenderer.renderItemDropOnField(ctx, this.itemDropOnField, this._dropImages);
  }

  // ========== BOSS UI RENDERING ==========
  renderBossUI(ctx: CanvasRenderingContext2D, w: number, h: number) {
    BossBattleSystem.renderBossUI(ctx, w, h, this.bossBattle);
  }

  // ========== EGG POD RENDERING =========
  renderEggPods(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ctx: CanvasRenderingContext2D) {
    // [REMOVED] Egg pod system removed
  }

  // ========== INSECTICIDE SPRAY RENDERING (delegated to RenderUtils static method) =========

  // ========== RADAR LASER RENDERING =========
  /** 渲染雷达激光（委托给 RenderUtils 静态方法） */
  renderRadarLaser(ctx: CanvasRenderingContext2D) {
    RenderUtils.renderRadarLaser(ctx, this.radarLaserSystem!.getState(), this.roaches, this.player.x, this.player.y, this.time);
  }

  renderDefenseLine(ctx: CanvasRenderingContext2D, w: number) {
    const scene = this.getSceneConfig();
    RenderUtils.renderDefenseLine(ctx, w, this.defenseLineY(), scene.defenseLineColor, this.time, this.player.shieldTimer);
  }

  renderStickyBoards() {
    // Legacy sticky board rendering removed - replaced by auto-targeting sticky drops
    // Sticky boards array is kept for backwards compatibility but no longer rendered
  }

  /** 渲染粘性弹丸（委托给 DropRenderer 静态方法） */
  renderStickyDrops(ctx: CanvasRenderingContext2D) {
    DropRenderer.renderStickyDrops(ctx, this.stickySystem!.stickyDrops, this.roaches, this.time, this.deltaTime);
  }

  /** 渲染武器掉落物（委托给 DropRenderer 静态方法） */
  renderWeaponDrops(ctx: CanvasRenderingContext2D) {
    // 懒加载掉落物图片
    if (!this._dropImages) {
      this._dropImages = {};
      const loadDropImg = (src: string, type: string) => {
        const img = new Image();
        img.onload = () => { if (this._dropImages) this._dropImages[type] = img; };
        img.src = src;
      };
      loadDropImg('/assets/drop_sticky.png', 'sticky');
      loadDropImg('/assets/drop_poison.png', 'poison');
      loadDropImg('/assets/drop_molotov.jpg', 'molotov');
      loadDropImg('/assets/drop_shotgun.png', 'shotgun');
      loadDropImg('/assets/drop_radar.png', 'radar');
      loadDropImg('/assets/drop_fan.png', 'fan');
      loadDropImg('/assets/drop_swatter.png', 'swatter');
    }
    DropRenderer.renderWeaponDrops(ctx, this.weaponSystem!.getWeaponDrops(), this.time, this._dropImages);
  }

  // Render flying bait jar (parabolic arc from player to target roach)
  renderBaitThrow(ctx: CanvasRenderingContext2D) {
    ConsumableSystem.renderBaitThrow(ctx, this.consumableSystem!.baitThrowAnim, this.time);
  }

  // Render bait jar shatter mark and scent aura on the ground
  renderBaitMark(ctx: CanvasRenderingContext2D) {
    ConsumableSystem.renderBaitMark(ctx, this.consumableSystem!.baitTarget, this.player.baitTimer, this.time);
  }

  /** 渲染粒子（委托给 ParticleSystem 静态方法） */
  renderParticles(ctx: CanvasRenderingContext2D) {
    ParticleSystem.renderParticles(ctx, this.particles);
  }

  /** 渲染所有蟑螂敌人 */
  renderRoaches(ctx: CanvasRenderingContext2D) {
    RoachRenderer.renderRoaches({
      roachImg: this.roachImg, roachFlyingImg: this.roachFlyingImg,
      roachSuicideImg: this.roachSuicideImg, roachTimedSuicideImg: this.roachTimedSuicideImg,
      roachNurseImg: this.roachNurseImg, roachMutantImg: this.roachMutantImg,
      roachArmoredImg: this.roachArmoredImg, roachSplittingImg: this.roachSplittingImg,
      roachFlyingSuicideImg: this.roachFlyingSuicideImg, roachQueenImg: this.roachQueenImg,
      nurseCastFrames: this.nurseCastFrames, mutantTransformFrames: this.mutantTransformFrames,
      imagesLoaded: this.imagesLoaded, time: this.time, deltaTime: this.deltaTime,
      mutantTransformActive: this.roachAISystem!.mutantTransformActive, mutantTransformFrame: this.roachAISystem!.mutantTransformFrame,
      bossBattle: this.bossBattle, bossAnimState: this.bossAnimState, bossAnimFrames: this.bossAnimFrames,
      onAddParticle: (p) => { this.particles.push(p); },
      onSpawnShockwaveRing: (x, y, count) => { ParticleSpawner.spawnShockwaveRing(this.particles,x, y, count); },
      isStuckByBoard: (id) => this.isStuckByBoard(id),
    }, ctx, this.roaches);
  }

  /** 渲染玩家与武器 */
  renderPlayer(ctx: CanvasRenderingContext2D) {
    // Nurse healing VFX (delegated to NurseRenderer static method)
    NurseRenderer.renderNurseHealVFX(ctx, this.roaches, this.time);

    const p = this.player;
    const py = p.y;
    const s = 4;

    // Determine gun positions
    const gunXs: number[] = [p.x];
    if (this.tripleFlameSystem!.getState().active) {
      gunXs.push(p.x - this.tripleFlameSystem!.getState().sideOffset);
      gunXs.push(p.x + this.tripleFlameSystem!.getState().sideOffset);
    }

    // Render each gun
    for (let i = 0; i < gunXs.length; i++) {
      const gx = gunXs[i];
      const isSideGun = i > 0;
      const sideScale = 1.0; // Side guns same size as main gun

      ctx.save();
      ctx.translate(gx, py);
      ctx.scale(sideScale, sideScale);

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(3 * s, 8 * s, 22 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.gunImg && this.imagesLoaded) {
        const gw = 60 * s;
        const gh = 80 * s;
        ctx.save();
        ctx.translate(0, -gh * 0.6);

        if (p.currentWeapon === 'sticky') {
          ctx.filter = 'hue-rotate(180deg)';
        } else if (p.currentWeapon === 'poison') {
          ctx.filter = 'hue-rotate(270deg)';
        }

        ctx.drawImage(this.gunImg, -gw / 2, -gh / 2, gw, gh);
        ctx.filter = 'none';
        ctx.restore();
      } else {
        ctx.fillStyle = isSideGun ? '#666' : '#555';
        ctx.fillRect(-6 * s, -56 * s, 12 * s, 40 * s);
        ctx.fillStyle = isSideGun ? '#888' : '#777';
        ctx.fillRect(-5 * s, -64 * s, 10 * s, 10 * s);
      }

      // ===== HEAT WARNING: red pulsing glow 3 seconds before overheat =====
      // DEBUG: Always show warning for testing - drawn in screen coords after gun restore
      // (will be drawn in render() instead)

      ctx.restore();
    }

    // Reload indicator
    if (p.isReloading) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText('更换气罐中', this.width / 2, this.height / 2 - 20);
      ctx.font = 'bold 48px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(Math.ceil(p.reloadTimer).toString(), this.width / 2, this.height / 2 + 25);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Overheat indicator (only for center gun)
    if (p.isOverheated) {
      ctx.save();
      const pulse = (Math.sin(this.time * 10) + 1) * 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.25 + pulse * 0.15})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 48 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + pulse * 0.3})`;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 48 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ========== THROWABLE RENDERING ==========
  renderItemPlacement(ctx: CanvasRenderingContext2D) {
    RenderUtils.renderItemPlacement(ctx, this.itemPlaceState, this.selectedItemIndex, this.inventory, this.itemPlaceCursorX, this.itemPlaceCursorY, this.itemEffectRadiusX, this.itemEffectRadiusY, this.time);
  }

  // ========== THROWABLE RENDERING (delegated to ThrowableSystem static method) =========

  /** 渲染电蚊拍（委托给 RenderUtils 静态方法） */
  renderSwatter(ctx: CanvasRenderingContext2D) {
    RenderUtils.renderSwatter(ctx, this.swatterSystem!.swatterActive, this.swatterSystem!.swatterAnimTimer, this.swatterSystem!.swatterSwingX, this.width, this.height, this.roaches);
  }

  /** 渲染枪口闪光（委托给 RenderUtils 静态方法） */
  renderMuzzleFlash(ctx: CanvasRenderingContext2D) {
    RenderUtils.renderMuzzleFlash(ctx, this.player, this.tripleFlameSystem!.getState());
  }

  renderWeatherForeground(ctx: CanvasRenderingContext2D, w: number) {
    WeatherSystem.renderWeatherForeground(ctx, w, this.weatherParticles, () => this.renderDefenseLine(ctx, w));
  }

  /** 渲染浮动文字（委托给 ParticleSystem 静态方法） */
  renderFloatingTexts(ctx: CanvasRenderingContext2D) {
    ParticleSystem.renderFloatingTexts(ctx, this.floatingTexts);
  }

  // =============================================================================
  // 消耗品商店：购买、使用、自动使用、冷却管理
  // 与天赋树（永久加成）不同，消耗品提供即时/临时效果
  // =============================================================================
  // ========== CONSUMABLE SYSTEM (delegated to ConsumableSystem module) =========
  /**
   * 购买消耗品（加入库存，不立即使用）
   * @param {string} id - 消耗品类型 ID
   * @returns {boolean} 是否购买成功
   */
  buyConsumable(id: string): boolean {
    return this.consumableSystem!.buyConsumable(id);
  }

  /**
   * 使用库存中的消耗品
   * @param {string} id - 消耗品类型 ID
   * @returns {boolean} 是否使用成功
   */
  useConsumable(id: string): boolean {
    return this.consumableSystem!.useConsumable(id);
  }

  // Toggle auto-use for a consumable
  toggleAutoUse(id: string): boolean {
    return this.consumableSystem!.toggleAutoUse(id);
  }

  // Check and auto-use consumables based on conditions (called every frame)
  checkAutoUseConsumables() {
    this.consumableSystem!.checkAutoUseConsumables();
  }

  // ========== POISON SYSTEM (delegated to PoisonSystem module) =========

  // ========== 风扇激活 (delegated to FanSystem module) =========
}
