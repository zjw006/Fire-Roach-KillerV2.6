/**
 * @fileoverview 《烈焰除蟑》旧版游戏核心引擎（单文件巨型类）
 *
 * ============================================================================
 * 引擎概述
 * ============================================================================
 * 本文件是《烈焰除蟑》(Fire Roach Killer) 游戏的主引擎，采用**单文件巨型类**架构，
 * 将所有游戏逻辑集中在一个约 10,000 行的 GameEngine 类中。
 *
 * 该引擎负责以下全部核心功能：
 *   1. 游戏状态管理 —— 驱动 MENU → PLAYING → WAVE_CLEAR → SHOP → ... 的状态机
 *   2. 实体管理 —— 创建/更新/销毁 蟑螂、粒子、掉落物、投射物等
 *   3. 敌人 AI —— 移动、闪避、愤怒、飞行、自爆、治疗、分裂等行为
 *   4. 碰撞检测 —— 火焰/武器与蟑螂的碰撞检测，支持三连火焰多枪口
 *   5. 波次系统 —— 配置驱动的波次生成、3-2-1 倒计时、自动推进
 *   6. Boss 战斗 —— 多阶段 Boss 战、弱点系统、召唤机制、蜕皮
 *   7. 武器系统 —— 火焰喷射器、粘板、燃烧瓶、散弹、雷达、杀虫剂、风扇、电蚊拍
 *   8. 消耗品系统 —— 商店购买、库存管理、自动使用、冷却系统
 *   9. 粒子系统 —— 12 种粒子类型，动态性能自适应
 *  10. 渲染系统 —— 25+ 个子渲染步骤的分层渲染管线
 *  11. 输入处理 —— 鼠标/触摸坐标转换、拖拽、瞄准
 *  12. 存档系统 —— localStorage 持久化，支持版本迁移
 *  13. 天赋系统 —— 15 个天赋节点，影响伤害/射程/燃气/防御等
 *  14. 成就系统 —— 15 个成就，实时检测解锁
 *  15. 天气系统 —— 雨天/浓雾/黑夜/闪电
 *  16. 音频系统 —— BGM、音效、循环音效管理
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
 *     → startWave()         // 开始第一波
 *     → gameLoop()          // 进入 requestAnimationFrame 主循环
 *
 * 【每帧更新链路】update() 按顺序调用：
 *   updateArmorShieldCache → updatePlayer → updateRoaches →
 *   updateConsumableEffects → checkAutoUseConsumables → updateBuffFlashTimers →
 *   updateParticles → updateFireZones → updateFireWalls →
 *   updateStickyBoards → updateStickyDrops → updateFloatingTexts →
 *   updateBossBattle/updateWave → updateScreenShake → updateSwatter →
 *   updateWeaponDrops → updateAiming → updateThrowables →
 *   updateTripleFlame → updateRadarLaser → updateInsecticideSpray →
 *   updateFan → updateWeather → checkCollisions → checkDefense →
 *   checkAchievements
 *
 * 【每帧渲染链路】render() 按顺序调用：
 *   renderBackground → renderMovementRange → renderWeatherBackground →
 *   renderFireZones → renderFireWalls → renderStickyBoards →
 *   renderStickyDrops → renderWeaponDrops → renderParticles →
 *   renderBaitMark → renderRoaches → renderBaitThrow →
 *   renderPlayer → renderFloatingTexts → renderSwatter →
 *   renderMuzzleFlash → renderThrowableAim → renderThrowables →
 *   renderItemPlacement → renderInsecticideSpray → renderFan →
 *   renderRadarLaser → renderWeatherForeground → renderBossUI →
 *   renderItemDropOnField
 *
 * 【外部调用接口】
 *   外部组件通过以下方法控制引擎：
 *   - GameCanvas: start(), stop(), pause(), resume(), restart()
 *   - 输入: setMousePos(), setMouseX(), handleScreenClick(), setFiring()
 *   - 武器: cycleFlameMode(), useSwatter(), startAiming(), throwAimedWeapon()
 *   - 道具: selectItem(), handleItemDropClick(), buyConsumable(), useConsumable()
 *   - 回调: onStateChange, onEconomyUpdate, onWaveUpdate, onGameOver 等
 *
 * ============================================================================
 * 状态说明
 * ============================================================================
 * 该引擎已被新的模块化引擎 (src/game/engine/index.ts) 替代。
 * 新引擎将本文件的 180+ 方法拆分到 12+ 个独立子系统模块中。
 * 本文件保留用于参考和回退。
 *
 * @version 2.6
 * @see {@link ../engine/index.ts} 新版模块化引擎入口
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
 * - 医院专属: hospitalEggPods[], placedBombs[], deadTimedBombs[], hospitalStarRating
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
 * - 医院专属: spawnHospitalEggPods, updateHospitalEggPods, hatchHospitalEggPod, damageHospitalEggPod, triggerDisinfectionReward
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
  height = 960; // Fixed 540x960 aspect ratio
  scale = 1;

  player: Player;
  roaches: Roach[] = [];
  particles: Particle[] = [];
  fireZones: FireZone[] = [];

  // Sticky board/drop system (delegated to StickySystem module)
  // Fire walls (molotov creates horizontal flame walls)
  fireWalls: FireWall[] = [];

  // Fan system (delegated to FanSystem module)

  // Endless mode timer
  endlessElapsedTime: number = 0;
  endlessBestTime: number = 0;
  endlessNewRecordShown: boolean = false;
  endlessNewRecordTimer: number = 0;
  floatingTexts: FloatingText[] = [];

  // Post-battle item reveal
  itemRevealData: { type: string; name: string; icon: string; desc: string }[] = [];
  onItemRevealComplete?: () => void;
  // Player-selected items for the current level (from PreparationScreen)
  selectedItems: string[] = [];
  // Carried consumables inventory (buy → carry → auto/manual use) - delegated to ConsumableSystem
  // Auto-use settings for each consumable type - delegated to ConsumableSystem
  // Emergency cool inventory (purchased from shop, free uses) - delegated to ConsumableSystem
  // Buff flash timers for HUD display - delegated to ConsumableSystem
  // Bait throw animation state - delegated to ConsumableSystem
  // Bait target position - delegated to ConsumableSystem
  // Power boost countdown tracking - delegated to ConsumableSystem
  // Dynamic particle limit based on device performance
  _particleLimit: number = 300;
  _frameTimeSamples: number[] = [];
  _perfCheckFrames: number = 0;
  _isLowPerfDevice: boolean = false;
  onConsumableUpdate?: (inventory: Record<string, number>, buffTimers: Record<string, number>, cooldowns?: Record<string, number>, globalCooldown?: number, combatStartTimer?: number, itemCooldowns?: Record<string, number>) => void;
  onEmergencyCoolUpdate?: (count: number) => void;
  // Post-battle item drop (on-field clickable drop)
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

  // Swatter system (delegated to SwatterSystem module)

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
  // Hospital exclusive roach images
  roachNurseImg: HTMLImageElement | null = null;
  // Nurse cast: 10-frame healing animation
  nurseCastFrames: (HTMLImageElement | null)[] = [];
  roachMutantImg: HTMLImageElement | null = null;
  // Mutant transformation: 7-frame sequence (200ms each, total 1.4s)
  mutantTransformFrames: (HTMLImageElement | null)[] = [];
  mutantTransformFrame: number = 0; // 0-6
  mutantTransformTimer: number = 0;
  mutantTransformX: number = 0;
  mutantTransformY: number = 0;
  mutantTransformActive: boolean = false;
  // Green slime burst effect (mutant spawn visual)
  slimeBurstTimer: number = 0;
  slimeBurstX: number = 0;
  slimeBurstY: number = 0;
  // Boss images (phase variants reserved for future use)
  // Boss animation system - frame data managed by engine, shared with bossSystem
  bossAnimFrames: Map<string, HTMLImageElement[]> = new Map();
  get bossAnimState(): { action: string; frameIndex: number; timer: number } {
    return this.bossSystem!.bossAnimState;
  }
  set bossAnimState(v: { action: string; frameIndex: number; timer: number }) {
    this.bossSystem!.bossAnimState = v;
  }
  eggPodImg: HTMLImageElement | null = null;
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
  // Generic scene background image cache (keyed by sceneType)
  bgSceneImages: Record<string, HTMLImageElement> = {};
  // Easy mode flag: true when difficulty is 'easy'
  isEasyMode: boolean = false;
  imagesLoaded: boolean = false;

  // Drop item images cache
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

  // Boss battle state (delegated to BossBattleSystem)
  get bossBattle(): BossBattleState {
    return this.bossSystem!.bossBattle;
  }
  set bossBattle(v: BossBattleState) {
    this.bossSystem!.bossBattle = v;
  }

  // Talent & progression
  progress: GameProgress;
  talentMultipliers: Record<string, number> = {};

  // Weather
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

  // Boss active (delegated to BossBattleSystem)
  get activeBosses(): number { return this.bossSystem!.activeBosses; }
  set activeBosses(v: number) { this.bossSystem!.activeBosses = v; }

  // Defeat/restart guard: prevent gameDefeat() from being called multiple times
  defeatTriggered: boolean = false;

  // Kitchen first-wave tutorial pause: blocks spawn until tutorial completes
  get tutorialPauseSpawn(): boolean { return this.waveManager!.tutorialPauseSpawn; }
  set tutorialPauseSpawn(v: boolean) { this.waveManager!.tutorialPauseSpawn = v; }

  // Pre-wave 3-2-1 countdown state
  get countdownTimer(): number { return this.waveManager!.countdownTimer; }
  set countdownTimer(v: number) { this.waveManager!.countdownTimer = v; }
  get countdownPhase(): number { return this.waveManager!.countdownPhase; }
  set countdownPhase(v: number) { this.waveManager!.countdownPhase = v; }
  get countdownWavePending(): boolean { return this.waveManager!.countdownWavePending; }
  set countdownWavePending(v: boolean) { this.waveManager!.countdownWavePending = v; }

  // Inventory recycle snapshot: saved before clearing, used for UI animation at level end
  recycledInventory: { type: string; count: number }[] = [];

  // Throwable aiming system (delegated to AimingSystem)
  // isAiming/aimTargetX are getter/setter that delegate to aimingSystem
  get isAiming(): boolean { return this.aimingSystem?.getAimingState().isAiming ?? false; }
  get aimTargetX(): number { return this.aimingSystem?.getAimingState().aimTargetX ?? 0; }
  set aimTargetX(v: number) { this.aimingSystem?.setAimTarget(v, this.aimingSystem?.getAimingState().aimTargetY ?? 0); }

  // Triple flame (delegated to TripleFlameSystem) for GameCanvas compatibility
  get tripleFlame(): { active: boolean; timer: number } { return this.tripleFlameSystem!.getState(); }

  // Consumables (delegated to ConsumableSystem) for GameCanvas compatibility
  get consumableInventory(): Record<string, number> { return this.consumableSystem!.consumableInventory; }
  set consumableInventory(v: Record<string, number>) { this.consumableSystem!.consumableInventory = v; }
  get emergencyCoolInventory(): number { return this.consumableSystem!.emergencyCoolInventory; }
  set emergencyCoolInventory(v: number) { this.consumableSystem!.emergencyCoolInventory = v; }

  // Throwable projectiles (delegated to ThrowableSystem module)

  // Weapon/item inventory (picked up weapon drops)
  inventory: InventoryItem[] = [];
  selectedItemIndex: number = -1;
  itemPlaceState: 'idle' | 'pending_click' | 'placing' = 'idle';
  itemPlaceCursorX: number = 0;
  itemPlaceCursorY: number = 0;
  itemEffectRadiusX: number = 100;
  itemEffectRadiusY: number = 50;
  // Picked-up item cooldown system - delegated to ConsumableSystem

  // Triple flame system (delegated to TripleFlameSystem module)

  // Kitchen hard mode background flag
  useKitchenHardBg: boolean = false;

  // Radar laser system (delegated to RadarLaserSystem module)
  // Insecticide spray system (delegated to InsecticideSystem module)

  // Daily challenge seed
  dailySeed: number = 0;

  // Scene cleared (for progression)
  scenesCleared: Set<SceneType> = new Set();

  // Show ground boundary lines (roach walkable area visualization)
  showMovementRange: boolean = false;

  // Armor meat shield cache: periodically updated to avoid O(n²) per frame
  armorShieldCache: Set<number> = new Set(); // roach IDs protected by nearby armored roaches
  armorShieldCacheTimer: number = 0;

  // ===== HOSPITAL EXCLUSIVE: TIMED SUICIDE BOMB SYSTEM =====
  placedBombs: { id: number; x: number; y: number; timer: number }[] = [];
  bombImg: HTMLImageElement | null = null;
  // Dead timed suicide roach bombs: when killed, leaves a 3s countdown bomb on the ground
  deadTimedBombs: { id: number; x: number; y: number; timer: number; flashPhase: number }[] = [];
  nextBombId: number = 1; // Incrementing ID for dead timed bombs
  // Timed suicide roach staggered spawn: each roach spawns 8s apart for rhythm
  timedSuicideSpawnTimer: number = 0; // countdown until next timed suicide spawn
  timedSuicideSpawnRemaining: number = 0; // how many timed suicides still to spawn this wave

  // ===== HOSPITAL EXCLUSIVE: EGG POOL SYSTEM =====
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hospitalEggPods: any[] = [];
  hospitalEggPodDestroyedCount: number = 0; // Consecutive destroyed count (3 → disinfection reward)
  hospitalDisinfectionRewardTimer: number = 0; // Timer for showing disinfection reward text
  // ===== HOSPITAL EXCLUSIVE: 3-STAR RATING SYSTEM =====
  hospitalTotalEggPods: number = 0; // Total egg pods spawned this level
  hospitalDestroyedEggPods: number = 0; // Total egg pods destroyed this level
  hospitalBreaches: number = 0; // Defense breaches this level (for star rating)
  hospitalStarRating: number = 0; // 0-3 stars

  // Consumable cooldown system - delegated to ConsumableSystem

  // =============================================================================
  // 生命周期方法：构造函数、画布适配、资源加载
  // =============================================================================

  /**
   * 创建游戏引擎实例
   * @param {HTMLCanvasElement} canvas - 游戏画布元素
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.loadImages();
    this.progress = this.loadProgress(); // MUST be before createPlayer()
    // Load previously detected particle limit from localStorage
    const savedLimit = SaveSystem.loadParticleLimit();
    if (savedLimit !== 300) {
      this._particleLimit = savedLimit;
      this._isLowPerfDevice = this._particleLimit <= 200;
    }
    this.player = this.createPlayer();
    this.economy = this.createEconomy();
    this.endlessBestTime = this.loadEndlessBestTime();
    this.recalcTalentMultipliers();
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
      onSpawnSpark: (x, y, count) => { this.spawnSparkParticles(x, y, count); },
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
      onSpawnSpark: (x, y, count) => { this.spawnSparkParticles(x, y, count); },
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
      onSpawnSparkParticles: (x, y, count) => { this.spawnSparkParticles(x, y, count); },
      onAddParticle: (p) => { this.particles.push(p); },
      onKillRoach: (roach, index) => { this.killRoach(roach, index); },
    });
    this.swatterSystem = new SwatterSystem({
      canvasWidth: this.width,
      canvasHeight: this.height,
      talentCdReduction: this.talentMultipliers.swatterCdReduction || 0,
      onAddFloatingText: (x, y, text, color, duration?) => { this.addFloatingText(x, y, text, color, duration); },
      onPlaySwatter: () => { this.audio.playSwatter(); },
      onSpawnSparkParticles: (x, y, count) => { this.spawnSparkParticles(x, y, count); },
      onSpawnLightningParticles: (centerX, topY) => { this.spawnLightningParticles(centerX, topY); },
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
      onSpawnSparkParticles: (x, y, count) => { this.spawnSparkParticles(x, y, count); },
      onSpawnExplosionParticles: (x, y, count) => { this.spawnExplosionParticles(x, y, count); },
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
      onSpawnSmokeParticles: (x, y, count) => { this.spawnSmokeParticles(x, y, count); },
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
      setEconomy: (e) => { this.economy = e; },
    });
    // Restore persistent consumable inventory from progress
    if (this.progress.consumableInventory) {
      this.consumableSystem!.consumableInventory = { ...this.progress.consumableInventory };
    }
    if (this.progress.autoUseEnabled) {
      this.consumableSystem!.autoUseEnabled = { ...this.progress.autoUseEnabled };
    }
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
        onSpawnExplosionParticles: (x, y, count) => { this.spawnExplosionParticles(x, y, count); },
        onSpawnShockwaveRing: (x, y, radius) => { this.spawnShockwaveRing(x, y, radius); },
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

    // Initialize WaveManager
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
    window.addEventListener('resize', () => this.resize());
  }

  /** 根据父容器调整画布大小与 DPR */
  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = parent.getBoundingClientRect();
    const targetAspect = 540 / 960;
    const parentAspect = rect.width / rect.height;
    let displayWidth = rect.width;
    let displayHeight = rect.height;
    if (parentAspect > targetAspect) {
      displayWidth = rect.height * targetAspect;
    } else {
      displayHeight = rect.width / targetAspect;
    }
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    this.canvas.width = Math.floor(displayWidth * dpr);
    this.canvas.height = Math.floor(displayHeight * dpr);
    this.scale = this.canvas.width / 540;
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

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
    // Load 10-frame nurse casting animation
    for (let i = 1; i <= 10; i++) {
      const frameIdx = i - 1;
      load(`/assets/nurse_cast_${i.toString().padStart(2, '0')}.png`, (img) => this.nurseCastFrames[frameIdx] = img);
    }
    load('/assets/roach_mutant.png', (img) => this.roachMutantImg = img);
    // Load 7-frame transformation sequence
    for (let i = 1; i <= 7; i++) {
      const frameIdx = i - 1;
      load(`/assets/mutant_0${i}.png`, (img) => this.mutantTransformFrames[frameIdx] = img);
    }
    load('/assets/bomb.png', (img) => this.bombImg = img);
    load('/assets/egg_pod.png', (img) => this.eggPodImg = img);
    // Boss animation frames - only load frames that exist on disk
    // Missing actions automatically fallback to 'idle' frames
    const actionsWithFrames: Record<string, number> = {
      idle: 7,   // 7 frames available
      hover: 3,  // 3 frames available
      // All other actions fallback to idle frames
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
    // Set empty arrays for missing actions (will fallback to idle in rendering)
    const fallbackActions = ['walk','charge','summon','defend','hit','hurt','die','roar','mock','transform'];
    for (const action of fallbackActions) {
      this.bossAnimFrames.set(action, []); // empty - renderer will fallback to idle
    }
    // Sticky board image loading is handled by DropRenderer module
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
    // Load scene background images from SCENE_CONFIGS (for new scenes with bgImage)
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
    // Player base stats - ONLY talent tree multipliers, NO shop upgrade stacking
    // Shop has been redesigned to one-time consumables (gas_refill, defense_repair, etc.)
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
      // Consumable temporary effect timers
      powerBoostTimer: 0,
      shieldTimer: 0,
      baitTimer: 0,
      // Legacy fields (no longer applied from shopUpgrades)
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
    // Sync talent multipliers to WeaponSystem
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
    // Prevents boss logic from leaking into normal modes after playing boss mode
    this.bossSystem!.resetForNonBossMode();

    // Cancel any existing loop before starting new one (prevents duplicate loops)
    cancelAnimationFrame(this.animationId);
    this.state = GameState.PLAYING;
    // Reset shop upgrades on fresh start (from menu), preserve when going to next scene
    if (!keepShopUpgrades) {
      this.progress.shopUpgrades = [];
    }
    this.resetGame(initialMoney);
    // Set player-selected items for this level (AFTER resetGame to avoid being cleared)
    if (selectedItems && selectedItems.length > 0) {
      this.selectedItems = selectedItems;
    }
    // Sync WeaponSystem config with current game settings
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
    // BGM is now started by GameCanvas after dialog/comic completes
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
    this.onStateChange?.(this.state);
  }

  /**
   * 重置游戏状态（用于重新开始或首次启动）
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
    this.hospitalEggPods = [];
    this.hospitalEggPodDestroyedCount = 0;
    this.hospitalDisinfectionRewardTimer = 0;
    this.hospitalTotalEggPods = 0;
    this.hospitalDestroyedEggPods = 0;
    this.hospitalBreaches = 0;
    this.hospitalStarRating = 0;
    this.placedBombs = [];
    this.timedSuicideSpawnTimer = 0;
    this.timedSuicideSpawnRemaining = 0;
    this.consumableSystem?.reset();
    // Reset performance check for new game session
    this._perfCheckFrames = 0;
    this._frameTimeSamples = [];
    this.weatherParticles = [];
    this.wave = 0;
    this.waveManager!.reset();
    // Sync WaveManager config with current scene after scene change
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

    // Initialize boss battle if in BOSS mode
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

  // Continue to next wave after shopping (called when player clicks "Continue" in shop)
  continueFromShop() {
    this.state = GameState.PLAYING;
    this.waveManager!.reset();
    this.waveManager!.startWave();
    // Resume game loop if it was stopped
    if (!this.animationId) {
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
    this.onStateChange?.(this.state);
  }

  // =============================================================================
  // 主循环：gameLoop → update() → render() 驱动整个游戏运转
  // =============================================================================

  /**
   * 游戏主循环（requestAnimationFrame 回调）
   * 每一帧执行：deltaTime 计算 → 性能自适应 → update() → render()
   * @param {number} now - 当前时间戳
   */
  gameLoop = (now: number) => {
    // 允许在 PLAYING、COUNTDOWN、ITEM_DROP、ITEM_REVEAL、WAVE_CLEAR 状态下运行循环
    // COUNTDOWN: 3-2-1 pre-wave countdown (update() handles the timer)
    // WAVE_CLEAR shows the shop screen (no game logic updates, just render)
    if (this.state !== GameState.PLAYING && this.state !== GameState.COUNTDOWN && this.state !== GameState.ITEM_DROP && this.state !== GameState.ITEM_REVEAL && this.state !== GameState.WAVE_CLEAR) return;
    this.deltaTime = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.time += this.deltaTime;
    // Dynamic particle limit: adjust based on frame time performance
    this._perfCheckFrames++;
    if (this._perfCheckFrames <= 120) {
      // Collect frame time samples for first 120 frames (~2 seconds)
      this._frameTimeSamples.push(this.deltaTime);
    } else if (this._perfCheckFrames === 121) {
      // Calculate average frame time and set particle limit
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
      // Persist detected limit for future sessions
      SaveSystem.saveParticleLimit(this._particleLimit);
      this._frameTimeSamples = []; // Free memory
    }
    // Runtime adaptive: if frame time spikes, temporarily reduce limit
    if (this._perfCheckFrames > 121 && this.deltaTime > 0.04 && this._particleLimit > 150) {
      this._particleLimit = Math.max(150, this._particleLimit - 10);
    } else if (this._perfCheckFrames > 121 && this.deltaTime < 0.018 && this._particleLimit < 400 && !this._isLowPerfDevice) {
      // Gradually restore limit if frame time is good
      this._particleLimit = Math.min(400, this._particleLimit + 1);
    }
    // Safety: catch any unexpected error to prevent game freeze and log to console
    try {
      this.update();
      this.render();
    } catch (e) {
      console.error('[GameEngine] Critical error in game loop:', e);
      // Continue running - don't freeze the game
    }
    this.animationId = requestAnimationFrame(this.gameLoop);
  };


  /** 初始化 Boss 战斗状态与波次配置 */
  initBossBattle() {
    this.bossSystem!.initBossBattle();
  }

  spawnBoss() {
    const boss = this.bossSystem!.spawnBoss();
    this.roaches.push(boss);
  }

  // Centralized BOSS death sequence - called from updateBossBattle OR directly
  // when a late-updated system (radar laser, etc.) kills the boss
  triggerBossDeathSequence() {
    this.bossSystem!.triggerBossDeathSequence();
  }

  // Update the death sequence timers (animation -> corpse stay -> victory)
  // Called every frame from updateBossBattle
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

  // ===== EGG POD SYSTEM (4-Wave Boss Mechanic) =====
  // Wave count: 0=init → 1=wave1 → 2=wave2 → 3=wave3 → 4=wave4 → 5=victory
  // Boss HP: 4(full) → 3(after w1) → 2(after w2) → 1(after w3) → 0(after w4)
  updateEggPodSystem() {
    this.bossSystem!.updateEggPodSystem();
  }

  // Boss summon casting animation - eggs fall from above after cast
  startBossSummonCast(wave: number) {
    this.bossSystem!.startBossSummonCast(wave);
    // Create casting particles (dark energy gathering at boss position)
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

    // ===== WAVE CONFIGS: escalating difficulty with mixed types =====
    // Counts are high because each wave has DOUBLE the egg pods
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
      // Wave 3: Flying + armored + suicide (20 pods)
      {
        count: 20,
        types: [RoachType.FLYING, RoachType.FLYING, RoachType.ARMORED, RoachType.SUICIDE, RoachType.FLYING_SUICIDE],
        name: '飞行蟑螂卵',
      },
      // Wave 4: All elite types (16 pods)
      {
        count: 16,
        types: [RoachType.ARMORED, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN, RoachType.SPLITTING],
        name: '精英蟑螂卵',
      },
    ];

    const config = waveConfigs[wave - 1];
    if (!config) return;

    // Update phase name
    const phaseNames = ['虫卵入侵', '大蟑螂卵', '飞行蟑螂卵', '精英蟑螂卵'];
    bb.phaseName = phaseNames[wave - 1] || '';
    bb.phaseJustChanged = true;
    bb.phaseChangeTimer = 3;
    bb.phaseChangeText = `【第${wave}波: ${config.name}】`;

    // Count type distribution for display
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

  // Swatter pickup (delegated to SwatterSystem module)
  spawnSwatterPickup(x: number, y: number) {
    this.swatterSystem!.spawnSwatterPickup(x, y, this.inventory, (inv) => { this.onInventoryUpdate?.(inv); });
  }

  // ===== BOSS DIALOGUE & FLEE (Victory Sequence) =====
  startBossDialogue() {
    this.bossSystem!.startBossDialogue();
  }

  // Complete the item reveal and move to wave clear
  completeItemReveal() {
    // If there are more rewards, show the next one
    if (this.rewardIndex < this.itemRevealData.length - 1) {
      this.spawnNextRewardDrop(this.rewardIndex + 1);
    } else {
      // All rewards shown, go to wave clear
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
    // Gold is NOT added here — added in applyRecycledGold() after animation
    return total;
  }

  // Called after the recycle animation completes — adds recycled gold to economy
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

  // Called after the recycle animation completes — actually clears inventory
  clearRecycledInventory() {
    this.inventory = [];
    this.recycledInventory = [];
    this.onInventoryUpdate?.([]);
  }

  /** 触发游戏胜利流程 */
  gameVictory() {
    // Sell unused inventory items before victory screen
    const sellTotal = this.sellUnusedInventory();
    if (sellTotal > 0) {
      this.addFloatingText(this.width / 2, this.height * 0.3, `道具回收 +¥${sellTotal}`, '#fbbf24');
    }

    this.screenShake = 8;
    // Stop all weapons (disable firing)
    this.player.isFiring = false;
    this.player.isOverheated = false;
    this.player.heat = 0;
    this.player.heatWarningTimer = 0;
    // Stop all weapons and continuous sound effects when battle ends
    this.audio.stopFire();
    this.audio.stopFanLoop();
    this.audio.stopFireWallBurn();
    this.audio.stopFlyingBuzzLoop();
    // Play victory BGM (replacing scene BGM)
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
    // Show floating text for talent point reward
    this.addFloatingText(this.width / 2, this.height * 0.35, `+${talentReward} 天赋点!`, '#fbbf24');

    // ===== HOSPITAL EXCLUSIVE: 3-STAR RATING SYSTEM =====
    if (this.currentScene === SceneType.HOSPITAL) {
      // Calculate star rating
      // ⭐: Clear the level
      // ⭐⭐: Clear + breaches <= 1
      // ⭐⭐⭐: Clear + 0 breaches
      let stars = 1; // Base: cleared the level
      if (this.hospitalBreaches <= 1) stars = 2;
      if (this.hospitalBreaches === 0) stars = 3;
      this.hospitalStarRating = stars;

      // Show star rating floating text
      const starText = '⭐'.repeat(stars);
      const ratingTexts = ['', '通关!', '优秀!', '完美!'];
      this.addFloatingText(this.width / 2, this.height * 0.45, starText, '#fbbf24');
      this.addFloatingText(this.width / 2, this.height * 0.5, ratingTexts[stars], stars === 3 ? '#fbbf24' : (stars === 2 ? '#c084fc' : '#94a3b8'));
      if (this.hospitalBreaches > 0) {
        this.addFloatingText(this.width / 2, this.height * 0.55, `防线突破: ${this.hospitalBreaches}次`, '#f87171');
      }
    }

    // Story mode: normal item drop reward flow
    const rewards = SCENE_REWARD_ITEMS[this.currentScene];
    // Only reveal newly unlocked items (skip already unlocked ones)
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

  // Spawn the Nth reward drop on the field
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

    // No countdown (e.g. non-first wave), spawn directly
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

  // =============================================================================
  // 主更新循环：每帧按固定顺序更新所有子系统
  // 调用顺序：护甲缓存 → 玩家 → 蟑螂 AI → 消耗品 → 粒子 → 场景特效 →
  //          Boss/波次 → 武器 → 碰撞 → 防线 → 成就
  // =============================================================================
  /** 主游戏更新循环（每帧调用） */
  update() {
    // ===== PRE-WAVE COUNTDOWN =====
    // Handle 3-2-1 countdown before first wave; freeze all game logic
    if (this.state === GameState.COUNTDOWN) {
      this.countdownTimer -= this.deltaTime;
      // Update displayed phase (3 → 2 → 1)
      const newPhase = Math.ceil(this.countdownTimer);
      if (newPhase !== this.countdownPhase && newPhase >= 1) {
        this.countdownPhase = newPhase;
        // Play tick sound on each number change
        this.audio.playCountdownTick();
      }
      // Still update visual effects during countdown (particles, screen shake)
      this.updateParticles();
      this.updateScreenShake();
      // Countdown finished → start the wave
      if (this.countdownTimer <= 0) {
        this.doWaveSpawn();
      }
      return;
    }

    // Skip all game logic during item drop / item reveal / wave clear sequences
    // Just update visual effects (particles, floating texts, screen shake)
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
        this.itemDropOnField.fallSpeed += 40 * this.deltaTime; // gravity acceleration
        if (this.itemDropOnField.y >= this.itemDropOnField.targetY) {
          this.itemDropOnField.y = this.itemDropOnField.targetY;
          this.itemDropOnField.falling = false;
        }
      }
      // Bobbing animation after landing
      if (this.itemDropOnField && !this.itemDropOnField.collected && !this.itemDropOnField.falling) {
        this.itemDropOnField.bobPhase += this.deltaTime * 3;
      }
      return;
    }
    this.updateArmorShieldCache();
    this.updatePlayer();
    this.updateRoaches();
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

    // ===== BOSS DEATH SAFETY NET =====
    // All weapon systems have run. If boss is dead but death sequence hasn't
    // triggered yet (because the killing blow came from a system that runs
    // AFTER updateBossBattle), trigger it now.
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
    if (this.slimeBurstTimer > 0) {
      this.slimeBurstTimer -= this.deltaTime;
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

  // ========== 玩家与武器更新 ==========
  /** 更新玩家状态、武器与输入 */
  updatePlayer() {
    const p = this.player;

    // ===== TUTORIAL PAUSE: block all player controls during tutorial =====
    if (this.tutorialPauseSpawn) {
      p.isFiring = false; // Force stop flamethrower
      this.audio.stopFire();
      p.x = Math.max(10, Math.min(this.width - 10, this.mouseX));
      p.angle = -Math.PI / 2;
      return; // Skip all firing and weapon logic
    }

    // Update paralyze timer
    if (p.paralyzeTimer > 0) {
      p.paralyzeTimer -= this.deltaTime;
      if (p.paralyzeTimer < 0) p.paralyzeTimer = 0;
    }

    // Movement: if paralyzed, cannot move + STOP flamethrower
    if (p.paralyzeTimer > 0) {
      p.isFiring = false; // Force stop flamethrower
      // Paralyzed: show purple spark effects at defense line (visible position)
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
      // Skip all other player logic while paralyzed
      return;
    }

    p.x = Math.max(10, Math.min(this.width - 10, this.mouseX));
    p.angle = -Math.PI / 2;

    // Check if temp weapon expired
    if (p.isTempWeapon && p.weaponTimer > 0) {
      p.weaponTimer -= this.deltaTime;
      if (p.weaponTimer <= 0) {
        p.currentWeapon = 'flamethrower';
        p.isTempWeapon = false;
        this.addFloatingText(p.x, p.y - 60, '武器已过期', '#9ca3af');
      }
    }

    // ===== HEAT WARNING: trigger when approaching overheat =====
    // heatGain*100 = 100/second, 3 seconds = 300 heat remaining
    const warnThreshold = p.overheatThreshold - 300; // 1500 for default overheatThreshold=1800
    if (p.heat >= warnThreshold && p.heatWarningTimer <= 0 && !p.isOverheated) {
      p.heatWarningTimer = 3;
      this.addFloatingText(p.x, p.y - 60, '⚠️ 枪管冷却中!', '#fbbf24', 1500, 18);
    }

    // Firing logic based on current weapon
    // Block firing if paralyzed
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
          // Sticky board is a placement item, not a weapon - handled by selectItem/onItemRelease
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
        // Show "FIRE" text at screen center when reload complete
        this.addFloatingText(this.width / 2, this.height / 2, '>>> 开 火 <<<', '#22c55e', 2000, 28);
      }
    }

    if (p.gas <= 0 && !p.isReloading && !p.isOverheated) {
      this.startReload();
    }
  }

  updateFlamethrower(p: Player) {
    const gasCost = this.deltaTime * (p.powerBoostTimer > 0 ? 2 : 1); // 2x gas consumption during power boost
    const heatGain = this.deltaTime * 1.0;
    const powerBoostMult = p.powerBoostTimer > 0 ? 2 : 1;
    const baseDamage = (this.difficulty === 'hard' ? 200 : 300) * this.deltaTime * p.damageMultiplier * powerBoostMult;
    const range = p.fireRange * 0.5;
    const spreadAngle = (Math.PI / 15) * p.flameSpreadMultiplier;
    this.spawnConeFire(p.x, p.y, -Math.PI / 2, range, spreadAngle, baseDamage, 'fire');
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
      this.spawnSmokeParticles(p.x, p.y, 30);
      this.screenShake = 3;
    }
  }

  updatePoisonSpray(p: Player) {
    const gasCost = this.deltaTime;
    const range = p.fireRange * 0.45;
    const baseDamage = 30 * this.deltaTime;
    this.spawnConeFire(p.x, p.y, -Math.PI / 2, range, Math.PI / 6, baseDamage, 'poison');
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
      this.spawnConeFire(p.x, p.y, spreadAngle, range, Math.PI / 12, baseDamage / p.shotgunPellets, 'fire');
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
      this.spawnExplosionParticles(toX, toY, 20);
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
    this.spawnSmokeParticles(this.player.x, this.player.y, 15);
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

  // ========== 武器切换 ==========
  /**
   * 切换当前武器
   * @param {string} weapon - 武器类型
   */
  switchWeapon(weapon: string) {
    return this.weaponSystem!.switchWeapon(this.player, weapon);
  }

  // ========== WEAPON DROPS (delegated to WeaponSystem module) ==========

  // ========== ITEM PLACEMENT SYSTEM ==========
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
      this.spawnExplosionParticles(px, wallY, 2);
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

  // =============================================================================
  // 敌人生成：根据类型和场景边界创建蟑螂实体
  // 支持的蟑螂类型：small, large, flying, armored, splitting, suicide,
  //                  flying_suicide, queen, nurse, mutant, timed_suicide
  // =============================================================================
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

  // =============================================================================
  // 敌人 AI 更新：移动、闪避、愤怒、飞行、追踪、特殊行为
  // 按顺序处理：状态效果 → 粘板检测 → 定时炸弹 → 移动 → 特殊行为 → 死亡
  // =============================================================================
  /** 更新所有蟑螂敌人的 AI、移动与状态 */
  updateRoaches() {
    // ===== MUTANT TRANSFORMATION FRAME UPDATE =====
    // 7-frame animation: 200ms per frame, total 1.4s
    // Frame 0-6: normal → swelling → cracks → swollen → pre-burst → burst → empty shell
    if (this.mutantTransformActive) {
      this.mutantTransformTimer -= this.deltaTime;
      if (this.mutantTransformTimer <= 0) {
        this.mutantTransformFrame++;
        if (this.mutantTransformFrame >= 7) {
          // Animation complete, spawn roaches
          this.mutantTransformActive = false;
          this.spawnEmbryoRoaches();
        } else {
          // Next frame - 200ms per frame for smooth animation
          this.mutantTransformTimer = 0.2;
        }
      }
    }

    for (let i = this.roaches.length - 1; i >= 0; i--) {
      const r = this.roaches[i];
      // Safety: skip if element was removed by another operation during this frame
      if (!r) continue;

      // Decrement spawn immunity timer (mutant-spawned roaches)
      if (r.spawnImmuneTimer && r.spawnImmuneTimer > 0) {
        r.spawnImmuneTimer -= this.deltaTime;
      }

      // Decrement heal buff timer (nurse-healed roaches)
      if (r.healBuffTimer && r.healBuffTimer > 0) {
        r.healBuffTimer -= this.deltaTime;
      }

      if (r.state === RoachState.DEAD) {
        r.deathTimer -= this.deltaTime;
        // Flying roach (including flying suicide): fall down while disintegrating
        if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
          r.vy = 150; // Fall speed
          r.y += r.vy * this.deltaTime;
          r.vx = (Math.random() - 0.5) * 40; // Slight horizontal tumble
          r.x += r.vx * this.deltaTime;
          // Spin while falling
          r.angle += this.deltaTime * 8;
          // Remove if hit the ground
          if (r.y >= this.defenseLineY()) {
            r.y = this.defenseLineY();
            r.deathTimer = 0; // Immediate remove on ground hit
          }
        }
        if (r.deathTimer <= 0) {
          // Don't remove MUTANT during transformation animation
          if (r.type === RoachType.MUTANT && this.mutantTransformActive) {
            r.deathTimer = 0.1; // Keep alive until animation finishes
          } else {
            this.roaches.splice(i, 1);
          }
        }
        continue;
      }

      // Damage flash decay
      if (r.damageFlash > 0) r.damageFlash -= this.deltaTime * 5;

      // Status effects
      this.updateStatusEffects(r);

      // Stunned or board-stuck roaches stop moving but still take fire damage
      const isImmobilized = r.isStunned || this.isStuckByBoard(r.id);
      if (isImmobilized) {
        r.vx = 0; r.vy = 0;
        // Still process burn damage and status below, don't skip
      }

      // Enrage
      if (!r.isEnraged && r.hp < r.maxHp * 0.2 && r.type !== RoachType.ARMORED) {
        r.isEnraged = true;
        r.speed = r.baseSpeed * 2;
      }

      // Panic timer
      if (r.panicTimer > 0) r.panicTimer -= this.deltaTime;

      let moveAngle: number;

      if (r.panicTimer > 0) {
        moveAngle = r.panicAngle + Math.sin(this.time * 15 + r.wobbleOffset) * 0.8;
      } else {
        const isFlying = r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE;
        // Increased lateral wander for flying roaches
        const wanderAmplitude = isFlying ? 80 : 30;
        const targetX = r.x + Math.sin(r.wobbleOffset + this.time * r.wobbleSpeed) * wanderAmplitude;
        const dl = this.defenseLineY();
        const roachSize = ENEMY_DEFS[r.type].size;
        // Use roach bottom edge for defense line detection (visual consistency)
        const roachBottom = r.y + roachSize * 0.4;
        // CRITICAL FIX: if roach has passed defense line, keep moving down (don't pull back up)
        const targetY = roachBottom >= dl ? dl + 200 : dl;
        const dx = targetX - r.x;
        const dy = targetY - r.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        moveAngle = dist > 1 ? Math.atan2(dy, dx) : r.angle;

        // FORCE FIX: when roach is very close to defense line, ensure it crosses
        // (prevents roaches from wandering horizontally near the defense line forever)
        const distToDefense = dl - roachBottom;
        if (distToDefense > 0 && distToDefense < 50) {
          // Near defense line: boost downward velocity to ensure crossing
          const minSin = 0.3 + (1 - distToDefense / 50) * 0.4; // 0.3 to 0.7
          if (Math.sin(moveAngle) < minSin) {
            moveAngle = Math.asin(Math.min(minSin, 0.99));
          }
        }

        // Ground roaches: push away from edges near defense line
        // Flying roaches: speed up and charge straight at defense when close
        if (isFlying && distToDefense < 150) {
          // Flying roaches accelerate toward defense line - no edge push
          const chargeSpeed = 2.5 * (1 - distToDefense / 150); // up to 2.5x speed boost
          r.speed = r.baseSpeed * (1 + chargeSpeed);
        } else if (!isFlying) {
          const margin = 80;
          if (distToDefense < 120) {
            const pushStrength = (1 - distToDefense / 120) * 150 * this.deltaTime;
            if (r.x < margin) {
              moveAngle += pushStrength * (margin - r.x) / margin;
            } else if (r.x > this.width - margin) {
              moveAngle -= pushStrength * (r.x - (this.width - margin)) / margin;
            }
          }
        }
      }

      // BAIT CONSUMABLE: pull all roaches toward bait target while active
      if (this.player.baitTimer > 0 && !isImmobilized && this.consumableSystem!.baitTarget.active) {
        const baitDx = this.consumableSystem!.baitTarget.x - r.x;
        const baitDy = this.consumableSystem!.baitTarget.y - r.y;
        const baitDist = Math.sqrt(baitDx * baitDx + baitDy * baitDy);
        if (baitDist > 10) {
          const baitAngle = Math.atan2(baitDy, baitDx);
          const pullStrength = 0.7;
          const cosA = Math.cos(moveAngle);
          const sinA = Math.sin(moveAngle);
          const cosB = Math.cos(baitAngle);
          const sinB = Math.sin(baitAngle);
          moveAngle = Math.atan2(
            sinA * (1 - pullStrength) + sinB * pullStrength,
            cosA * (1 - pullStrength) + cosB * pullStrength
          );
          r.speed = r.baseSpeed * 1.3;
        }
      }

      // Normal movement
      // Apply fan slow effect
      const fanMultiplier = r.fanSlowTimer > 0 ? (1 - r.fanSlowFactor) : 1;
      const effectiveSpeed = r.speed * fanMultiplier;

      // ===== HOSPITAL EXCLUSIVE: NURSE ROACH FOLLOW MOVEMENT =====
      // Nurse roach follows the nearest non-nurse ally in both X and Y axes.
      // If no other roaches exist, nurse stays in place.
      if (r.type === RoachType.NURSE) {
        // Find nearest non-nurse ally
        let nearest: Roach | null = null;
        let nearestDist = Infinity;
        for (const other of this.roaches) {
          if (other.id === r.id) continue;
          if (other.state !== RoachState.ALIVE) continue;
          if (other.type === RoachType.NURSE) continue; // Don't follow other nurses
          const dx = other.x - r.x;
          const dy = other.y - r.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = other;
          }
        }
        if (nearest && nearestDist > 40) {
          // Move toward nearest ally in both X and Y axes
          const followAngle = Math.atan2(nearest.y - r.y, nearest.x - r.x);
          const followSpeed = r.speed * 0.5; // Nurse moves at 50% speed when following
          r.vx = Math.cos(followAngle) * followSpeed * 65;
          // Follow Y axis: move toward nearest ally's Y position
          r.vy = Math.sin(followAngle) * followSpeed * 65;
        } else if (nearest && nearestDist <= 40) {
          // Close enough to ally, stop moving
          r.vx = 0;
          r.vy = 0;
        } else {
          // No other roaches, stay in place
          r.vx = 0;
          r.vy = 0;
        }
      } else if (r.type === RoachType.MUTANT && r.transformTimer && r.transformTimer > 0) {
        // During mutant transformation: completely freeze movement
        r.vx = 0;
        r.vy = 0;
      } else if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) {
        // Timed suicide roach placing bomb: freeze movement
        r.vx = 0;
        r.vy = 0;
      } else if (r.spawnImmuneTimer && r.spawnImmuneTimer > 0) {
        // Mutant spawn: frozen in place during 1-second spawn immunity
        r.vx = 0;
        r.vy = 0;
      } else {
        r.vx = Math.cos(moveAngle) * effectiveSpeed * 65;
        r.vy = Math.sin(moveAngle) * effectiveSpeed * 65;
      }
      // Minimum downward speed: ensure ground roaches always progress toward defense
      // Prevents soft-lock from roaches with near-zero vy getting stuck
      // NURSE roach excluded: nurse only moves laterally, never forward
      // TIMED_SUICIDE excluded during bomb placement: must stay frozen at placement point
      if (!isImmobilized && r.type !== RoachType.FLYING && r.type !== RoachType.FLYING_SUICIDE && r.type !== RoachType.NURSE && !(r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) && r.vy < 10) {
        r.vy = 10; // minimum 10px/s downward
      }

      // Suicide/Small/TimedSuicide: high-speed lateral dodge when hit by flame
      if ((r.type === RoachType.SUICIDE || r.type === RoachType.SMALL) && r.dodgeTimer > 0) {
        r.dodgeTimer -= this.deltaTime;
        if (r.dodgeTimer <= 0) {
          r.dodgeDir = 0;
        } else {
          // High-speed lateral dodge (sideways movement away from flame)
          let dodgeSpeed: number;
          if (r.isSplitChild) {
            dodgeSpeed = 250; // Split child: fastest erratic dodge
          } else if (r.type === RoachType.SMALL) {
            dodgeSpeed = 180; // Normal small: fast nimble dodge
          } else {
            dodgeSpeed = 100; // Suicide/TimedSuicide: sustained dodge
          }
          const fanMult = r.fanSlowTimer > 0 ? (1 - r.fanSlowFactor) : 1;
          dodgeSpeed *= fanMult;
          r.vx = r.dodgeDir * dodgeSpeed;
          // Fire wall blocks during dodge
          for (const wall of this.fireWalls) {
            if (r.x >= wall.x1 && r.x <= wall.x2) {
              const wallTop = wall.y - wall.height * 0.5;
              if (r.y > wallTop && r.y < wallTop + wall.height + 5 && r.vy > 0) {
                r.y = wallTop;
                r.vy = 0;
              }
            }
          }
          // Fan push during dodge
          if (r.fanPushY < 0 && r.y >= this.height / 2 && r.armorHp <= 0) {
            r.y += r.fanPushY * this.deltaTime;
            r.y = Math.max(this.height / 2, r.y);
          }
          // Edge stop
          const edgeMargin = 50;
          if ((r.x <= edgeMargin && r.dodgeDir < 0) || (r.x >= this.width - edgeMargin && r.dodgeDir > 0)) {
            r.dodgeDir = 0;
            r.dodgeTimer = 0;
          }
        }
      }

      r.x += r.vx * this.deltaTime;
      r.y += r.vy * this.deltaTime;
      r.angle = moveAngle;

      // Pull roaches back into screen if they're far outside (prevents soft-lock when all visible roaches are dead but some are stuck off-screen)
      const margin = 100;
      if (r.x < -margin) r.x += 80 * this.deltaTime;
      if (r.x > this.width + margin) r.x -= 80 * this.deltaTime;
      if (r.y < -margin) r.y += 80 * this.deltaTime;
      // Y-direction bottom protection: force defense breach if roach falls too far below
      if (r.y > this.height + margin * 2) {
        r.y = this.defenseLineY() + 50; // teleport to defense line for immediate breach
      }

      // Fire wall blocks ground roaches (flying pass over)
      if (r.type !== RoachType.FLYING && r.type !== RoachType.FLYING_SUICIDE) {
        for (const wall of this.fireWalls) {
          if (r.x >= wall.x1 && r.x <= wall.x2) {
            const wallTop = wall.y - wall.height * 0.5;
            // If roach is trying to cross the wall from above
            if (r.y > wallTop && r.y < wallTop + wall.height + 5 && r.vy > 0) {
              // Block movement - push back above the wall
              r.y = wallTop;
              r.vy = 0;
            }
          }
        }
      }

      // Apply fan upward push (blow roaches backward)
      // ARMOR BUFF: armored roaches are immune to fan pushback (but still slowed)
      if (r.fanPushY < 0 && r.y >= this.height / 2 && r.armorHp <= 0) {
        r.y += r.fanPushY * this.deltaTime;
        r.y = Math.max(this.height / 2, r.y);
      }

      // Clamp x position: ground roaches stay within perspective trapezoid bounds,
      // flying roaches use screen edge margins
      if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
        const roachSize = r.size ?? ENEMY_DEFS[r.type].size;
        const edgeMargin = Math.max(40, roachSize * 0.8);
        r.x = Math.max(edgeMargin, Math.min(this.width - edgeMargin, r.x));
      } else {
        // Perspective: left/right boundaries depend on current Y position
        const [gLeft, gRight] = this.getGroundBoundsAtY(r.y);
        r.x = Math.max(gLeft + 5, Math.min(gRight - 5, r.x));
      }

      // Wing animation
      r.animTimer += this.deltaTime;
      if (r.animTimer > 0.12) {
        r.animTimer = 0;
        r.animFrame = (r.animFrame + 1) % 4;
      }

      // Suicide / Flying Suicide roach: activate fuse when near defense
      if (r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) {
        // NOTE: Ground suicide roach no longer zigzags constantly.
        // It only dodges sideways when hit by flame (see burn damage section above).
        const distToDefense = this.defenseLineY() - r.y;
        // Flying suicide triggers fuse closer to defense (80px) to ensure it reaches defense line before exploding
        const fuseTriggerDist = (r.type === RoachType.FLYING_SUICIDE) ? 80 : 150;
        if (distToDefense < fuseTriggerDist) {
          // No speed boost - maintain base speed toward defense
          r.isFused = true;
          r.fuseTimer -= this.deltaTime;
          // Fuse visual
          if (Math.random() < 0.3) {
            this.particles.push({
              x: r.x + (Math.random() - 0.5) * 10,
              y: r.y + (Math.random() - 0.5) * 10,
              vx: 0, vy: -20,
              life: 0.3, maxLife: 0.3,
              size: 3, color: '#ff4400',
              type: ParticleType.SPARK,
            });
          }
          if (r.fuseTimer <= 0) {
            this.suicideExplode(r, i);
            continue;
          }
        }
      }

      // Queen: spawn minions (disabled for the Boss in boss battle)
      if (r.type === RoachType.QUEEN && !(this.bossBattle.active && r.isBoss)) {
        r.spawnTimer -= this.deltaTime;
        if (r.spawnTimer <= 0) {
          r.spawnTimer = BOSS_CONFIG.queen.spawnInterval;
          for (let m = 0; m < BOSS_CONFIG.queen.minionCount; m++) {
            this.spawnRoach(RoachType.SMALL);
          }
          this.addFloatingText(r.x, r.y - 50, '女王召唤了小蟑螂!', '#ff44aa');
        }
      }

      // ===== HOSPITAL EXCLUSIVE: NURSE ROACH "ILLEGAL MEDICINE" AOE HEAL =====
      // Three-phase state machine: idle → charging(0.3s) → spraying(1.2s) → dissipating(0.5s)
      if (r.type === RoachType.NURSE && r.state === RoachState.ALIVE) {
        const healRange = 360; // 6 tiles ~ 360px (doubled)

        // --- STATE MACHINE UPDATE ---
        switch (r.healPhase) {
          case 'idle': {
            // Countdown until next heal
            r.healTimer! -= this.deltaTime;
            if (r.healTimer! <= 0) {
              // Check if there are wounded allies in range
              let hasWounded = false;
              for (const other of this.roaches) {
                if (other.id === r.id) continue;
                if (other.state !== RoachState.ALIVE) continue;
                const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
                if (d < healRange && other.hp < other.maxHp) {
                  hasWounded = true;
                  break;
                }
              }
              if (hasWounded) {
                // Enter charging phase - play cast sound
                r.healPhase = 'charging';
                r.healPhaseTimer = 1.0; // Extended to 1 second for visibility
                this.audio.playNurseCast();
                // Casting indicator text
                this.addFloatingText(r.x, r.y - 50, '【施法中】', '#4ade80', 1500);
                this.addFloatingText(r.x, r.y - 60, '非法行医!', '#5a8a5a');
              } else {
                // No wounded allies, reset timer
                r.healTimer! = 1;
              }
            }
            break;
          }

          case 'charging': {
            // Phase 1: Charge up (1.0s) - heal immediately on entry, visual builds up
            // Execute the actual heal RIGHT NOW (not at end of charging)
            let healedCount = 0;
            for (const other of this.roaches) {
              if (other.id === r.id) continue;
              if (other.state !== RoachState.ALIVE) continue;
              const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
              if (d < healRange && other.hp < other.maxHp) {
                const healAmount = Math.floor(other.maxHp * 0.20); // 20% max HP
                const actualHeal = Math.min(healAmount, other.maxHp - other.hp);
                if (actualHeal > 0) {
                  other.hp += actualHeal;
                  other.healBuffTimer = 2.0; // Green tint + plus sign duration
                  healedCount++;
                  // Floating heal text
                  this.addFloatingText(other.x, other.y - 30, `+${actualHeal}`, '#5a8a5a', 1200);
                }
              }
            }
            if (healedCount > 0) {
              this.addFloatingText(r.x, r.y - 50, '治疗喷射!', '#5a8a5a');
            }

            // Charging visual timer
            r.healPhaseTimer! -= this.deltaTime;
            if (r.healPhaseTimer! <= 0) {
              // Enter spraying phase (visual only)
              r.healPhase = 'spraying';
              r.healPhaseTimer = 2.0; // Visual duration
            }
            break;
          }

          case 'spraying': {
            // Phase 2: Spray mist (2.0s) - visual only, heal already done
            r.healPhaseTimer! -= this.deltaTime;
            if (r.healPhaseTimer! <= 0) {
              // Enter dissipating phase
              r.healPhase = 'dissipating';
              r.healPhaseTimer = 1.0; // Extended for visibility
            }
            break;
          }

          case 'dissipating': {
            // Phase 3: Fade out (0.5s)
            r.healPhaseTimer! -= this.deltaTime;
            if (r.healPhaseTimer! <= 0) {
              // Back to idle
              r.healPhase = 'idle';
              r.healTimer = 1; // 1s cooldown
            }
            break;
          }
        }

        // Track heal target for movement
        let bestTarget: Roach | null = null;
        let bestHpRatio = 1.0;
        for (const other of this.roaches) {
          if (other.id === r.id) continue;
          if (other.state !== RoachState.ALIVE) continue;
          const d = Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2);
          if (d < healRange && other.hp < other.maxHp) {
            const hpRatio = other.hp / other.maxHp;
            if (hpRatio < bestHpRatio) {
              bestHpRatio = hpRatio;
              bestTarget = other;
            }
          }
        }
        r.healTargetId = bestTarget ? bestTarget.id : null;
      }

      // ===== MUTANT ROACH: no longer triggers embryo rampage at HP<50%
      // "Embryo Rampage" now triggers on death (in killRoach) instead

      if (r.type === RoachType.SUICIDE && r.inFire && !this.isStuckByBoard(r.id)) {
          if (r.dodgeDir === 0) {
            // First hit: pick a random direction and start dodging
            r.dodgeDir = Math.random() < 0.5 ? -1 : 1;
          }
          // Hit again: keep current direction, reset dodge duration
          r.dodgeTimer = 1.2;
        }
        // ===== TIMED SUICIDE: "螂家爆破" DEFENSE BREACH SYSTEM =====
        // Three-phase: warning → crouching → exploding + residue
        if (r.type === RoachType.TIMED_SUICIDE && r.state === RoachState.ALIVE) {
          const dl = this.defenseLineY();
          const distToDefense = dl - r.y;

          // Initialize phase if not set
          if (!r.breachPhase) r.breachPhase = 'idle';

          // Branch B: Flame killed - quiet death, no explosion
          if (r.hp <= 0 && r.breachPhase !== 'idle') {
            r.isFlameKilled = true;
            r.state = RoachState.DEAD;
            r.deathTimer = 1.0;
            r.breachPhase = 'residue';
            r.residueTimer = 2.0;
            this.addFloatingText(r.x, r.y - 30, '炸弹没响...', '#666');
            continue;
          }

          // Branch A: Sticky board frozen - pause everything
          if (r.stuckTimer > 0 && r.breachPhase !== 'idle') {
            r.isFrozen = true;
            // Pause timers while frozen
            continue;
          } else {
            r.isFrozen = false;
          }

          // Phase transition: idle → warning when within 200px of defense
          if (r.breachPhase === 'idle' && distToDefense <= 200) {
            r.breachPhase = 'warning';
            r.breachPhaseTimer = 0.5; // Warning lasts until crouching
            r.crackRadius = 0;
          }

          // State machine
          switch (r.breachPhase) {
            case 'warning': {
              // Phase 1: Danger warning (0.5s before crouching)
              // Speed reduced 50%
              r.speed = r.baseSpeed * 0.5;
              // Advance to crouching when closer
              if (distToDefense <= 80) {
                r.breachPhase = 'crouching';
                r.breachPhaseTimer = 3.0; // 3s countdown
                r.placeTimer = 3.0; // Countdown timer
                r.hasPlacedBomb = true;
                this.addFloatingText(r.x, r.y - 50, '螂家爆破!', '#8b2020');
              }
              break;
            }

            case 'crouching': {
              // Phase 2: Crouch + final countdown
              // Completely frozen
              r.vx = 0;
              r.vy = 0;
              // Clear DoT (invincible during placement)
              r.burnDamage = 0;
              r.poisonTimer = 0;
              r.inFire = false;
              r.damageFlash = 0;

              // Countdown
              r.breachPhaseTimer! -= this.deltaTime;
              r.placeTimer! -= this.deltaTime;

              // Crack radius grows (0→60px over crouching duration)
              r.crackRadius = Math.min(60, (3.0 - r.breachPhaseTimer!) / 3.0 * 60);

              // Countdown floating text
              const secs = Math.ceil(r.placeTimer!);
              if (r.placeTimer! > 0 && Math.abs(r.placeTimer! - secs) < 0.05 && secs <= 3) {
                this.addFloatingText(r.x, r.y - 35, `${secs}`, secs <= 1 ? '#8b2020' : '#a05030');
              }

              // Explode when countdown reaches 0
              if (r.placeTimer! <= 0) {
                r.breachPhase = 'exploding';
                r.breachPhaseTimer = 0.4; // 0.4s explosion
                this.triggerBreachExplosion(r);
              }
              break;
            }

            case 'exploding': {
              // Phase 3: Explosion (0.4s screen shake)
              r.breachPhaseTimer! -= this.deltaTime;
              if (r.breachPhaseTimer! <= 0) {
                r.breachPhase = 'residue';
                r.residueTimer = 3.0; // 3s residue
                r.state = RoachState.DEAD;
                r.deathTimer = 3.0;
              }
              break;
            }

            case 'residue': {
              // Phase 4: Residue fading
              r.residueTimer! -= this.deltaTime;
              if (r.residueTimer! <= 0) {
                r.deathTimer = 0; // Remove
              }
              break;
            }
          }
        }

        // Legacy: handle old placed bombs (cleanup only)
        if (r.type === RoachType.TIMED_SUICIDE && r.state === RoachState.ALIVE && !r.hasPlacedBomb && !(r.breachPhase && r.breachPhase !== 'idle')) {
          const roachSize = ENEMY_DEFS[r.type].size;
          const roachBottom = r.y + roachSize * 0.4;
          const dl = this.defenseLineY();
          const placeY = dl - 64;

          if (roachBottom >= placeY) {
            // Legacy fallback: old bomb placement
            if (r.placeTimer === 0) {
              r.placeTimer = 2.0;
            }
            r.vx = 0;
            r.vy = 0;
            r.burnDamage = 0;
            r.poisonTimer = 0;
            r.poisonDamage = 0;
            r.inFire = false;
            r.damageFlash = 0;
            r.placeTimer! -= this.deltaTime;
            if (r.placeTimer! <= 0) {
              r.hasPlacedBomb = true;
              this.placedBombs.push({
                id: r.id, x: r.x, y: placeY, timer: 3,
              });
              this.addFloatingText(r.x, placeY - 30, '炸弹已安放!', '#ef4444');
              for (let p = 0; p < 8; p++) {
                const angle = (p / 8) * Math.PI * 2;
                const speed = 30 + Math.random() * 40;
                this.particles.push({
                  x: r.x, y: r.y,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed - 20,
                  life: 0.5, maxLife: 0.5,
                  size: 3 + Math.random() * 4,
                  color: `rgba(200, 150, 50, 0.7)`,
                  type: ParticleType.SPARK,
                });
              }
              r.type = RoachType.LARGE;
              r.size = ENEMY_DEFS[RoachType.LARGE].size;
              r.speed = ENEMY_DEFS[RoachType.LARGE].speed;
              r.baseSpeed = ENEMY_DEFS[RoachType.LARGE].speed;
              this.addFloatingText(r.x, r.y - 45, '变身大蟑螂!', '#fbbf24');
            }
          }
        }

        // SMALL roach: quick nimble dodge when hit by flame
        if (r.type === RoachType.SMALL && r.inFire && !this.isStuckByBoard(r.id)) {
          if (r.dodgeDir === 0) {
            // First hit: random direction
            r.dodgeDir = Math.random() < 0.5 ? -1 : 1;
          }
          // Split child: shortest, most erratic dodge
          // Normal small: short nimble dodge
          if (r.isSplitChild) {
            r.dodgeTimer = 0.2 + Math.random() * 0.2; // 0.2-0.4 seconds (very quick)
          } else {
            r.dodgeTimer = 0.4 + Math.random() * 0.3; // 0.4-0.7 seconds
          }
        }

        // Apply burn damage and clear fire state (only when actually in fire)
        if (r.inFire && r.burnDamage > 0) {
          const dmg = r.burnDamage * this.deltaTime;
          this.applyDamageToRoach(r, dmg);
          r.burnDamage = 0;
          if (Math.random() < 0.3) {
            this.spawnSmokeParticles(r.x, r.y, 1);
          }
          r.inFire = false;
        }

      // Poison DoT (skip timed suicide roach during bomb placement)
      if (r.poisonTimer > 0 && !(r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0)) {
        r.hp -= r.poisonDamage * this.deltaTime;
        r.poisonTimer -= this.deltaTime;
        if (Math.random() < 0.2) {
          this.particles.push({
            x: r.x + (Math.random() - 0.5) * 15,
            y: r.y + (Math.random() - 0.5) * 15,
            vx: 0, vy: -10,
            life: 0.5, maxLife: 0.5,
            size: 4, color: '#a78bfa',
            type: ParticleType.POISON_CLOUD,
          });
        }
      }

      if (r.hp <= 0) {
        this.killRoach(r, i);
      }
    }
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


  // ===== MUTANT ROACH: FORCE EMBRYO BURST ON DEATH =====
  // Called from killRoach when mutant dies during embryo rampage
  // Store spawn types for delayed embryo spawn after animation
  private _embryoSpawnTypes: RoachType[] = [];

  forceEmbryoBurst(r: Roach) {
    // ===== 3-FRAME TRANSFORMATION ANIMATION =====
    // Frame 0: normal (roach_mutant.png) - 350ms
    // Frame 1: swollen (mutant_swollen.png) - 350ms
    // Frame 2: burst (mutant_burst.png) - 350ms
    // Then spawn roaches

    // Determine spawn result ahead of time
    const roll = Math.random();
    if (roll < 0.5) {
      this._embryoSpawnTypes = [RoachType.SMALL, RoachType.SMALL]; // 50%
    } else if (roll < 0.8) {
      this._embryoSpawnTypes = [RoachType.SMALL, RoachType.FLYING]; // 30%
    } else {
      this._embryoSpawnTypes = [RoachType.SMALL, RoachType.SUICIDE]; // 20%
    }

    // Start transformation sequence - 600ms per frame for visibility
    this.mutantTransformActive = true;
    this.mutantTransformFrame = 0;
    this.mutantTransformTimer = 0.6; // 600ms per frame, total 1.8s
    this.mutantTransformX = r.x;
    this.mutantTransformY = r.y;

    // Visual + audio feedback
    this.screenShake = 12;
    this.audio.playMutantTransform();
    this.addFloatingText(r.x, r.y - 70, '【胚胎暴走】', '#ff0040', 2000);
    this.particles.push({
      x: r.x, y: r.y, vx: 0, vy: 0,
      life: 0.4, maxLife: 0.4,
      size: 120,
      color: 'rgba(255, 0, 64, 0.5)',
      type: ParticleType.EXPLOSION,
    });
  }

  // Called after 3-frame animation completes
  spawnEmbryoRoaches() {
    const sx = this.mutantTransformX;
    const sy = this.mutantTransformY;
    let spawnedCount = 0;

    for (let i = 0; i < this._embryoSpawnTypes.length; i++) {
      const spawnType = this._embryoSpawnTypes[i];

      const newRoach = this.spawnRoach(spawnType);
      if (!newRoach) break;
      spawnedCount++;

      // Spawn at mutant death position (exact, no random offset)
      newRoach.x = sx;
      newRoach.y = sy;
      // Use original HP (not reduced)
      newRoach.hp = ENEMY_DEFS[spawnType].hp;
      newRoach.maxHp = ENEMY_DEFS[spawnType].hp;
      newRoach.slimeTimer = 2.0;
      newRoach.wasMutantSpawn = true;
      // 1-second spawn immunity: frozen in place + invincible
      newRoach.spawnImmuneTimer = 1.0;

      if (spawnType === RoachType.SUICIDE) {
        newRoach.size = Math.floor(ENEMY_DEFS[spawnType].size * 0.6);
        newRoach.hp = ENEMY_DEFS[spawnType].hp;
        newRoach.maxHp = ENEMY_DEFS[spawnType].hp;
        newRoach.fuseTimer = 3;
      }

      // ===== CRITICAL: Add spawned roach to game array =====
      this.roaches.push(newRoach);

      const typeName = spawnType === RoachType.SMALL ? '小蟑螂' : spawnType === RoachType.FLYING ? '飞行蟑螂' : '自爆蟑螂';
      this.addFloatingText(newRoach.x, newRoach.y - 50, `【诞生】${typeName}!`, '#00ff80', 1500);
    }

    // Trigger green slime burst visual effect
    this.slimeBurstTimer = 1.2;
    this.slimeBurstX = sx;
    this.slimeBurstY = sy;

    this.addFloatingText(sx, sy - 40, `生成${spawnedCount}只!`, '#ff0040', 2000);
  }

  // ===== HOSPITAL EXCLUSIVE: MUTANT ROACH DEATH =====
  // Track death chain depth to prevent exponential recursion
  private _deathChainDepth: number = 0;
  private readonly MAX_DEATH_CHAIN_DEPTH = 3;

  mutantDeathEffect(r: Roach) {
    // Prevent exponential death chain: cap recursion depth
    if (this._deathChainDepth >= this.MAX_DEATH_CHAIN_DEPTH) return;
    this._deathChainDepth++;

    try {
      // 1. Corrosive acid splash: damage nearby roaches
      const acidRadiusSq = 10000; // 100px radius (was 150), squared to avoid Math.sqrt
      const acidRadius = 100;
      let hitCount = 0;
      for (const other of this.roaches) {
        if (other.state !== RoachState.ALIVE || other.id === r.id) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < acidRadiusSq) {
          const dist = Math.sqrt(distSq); // Only sqrt for damage falloff calc
          const dmg = 10 * (1 - dist / acidRadius);
          other.hp -= dmg;
          other.burnDamage = dmg * 1.5;
          other.inFire = true;
          hitCount++;
          // Defer kill to avoid recursive chain reaction in same frame
          if (other.hp <= 0 && this._deathChainDepth < this.MAX_DEATH_CHAIN_DEPTH) {
            this.killRoach(other, this.roaches.indexOf(other));
          }
        }
      }

      // 2. Show floating text
      if (this._deathChainDepth <= 1) { // Only show text for primary death
        this.addFloatingText(r.x, r.y - 40, '酸液飞溅!', '#84cc16');
        if (hitCount > 0) {
          this.addFloatingText(r.x, r.y - 55, `${hitCount}只受腐蚀`, '#a3e635');
        }
      }
    } finally {
      this._deathChainDepth--;
    }
  }

  suicideExplode(r: Roach, index: number) {
    // Remove the roach
    this.roaches.splice(index, 1);
    this.audio.playSuicideExplode();
    Vibration.vibrateSuicideExplode();
    const explodeRadius = 100;

    // ===== Enhanced explosion effects (5 second duration) =====
    // Core explosion
    this.spawnExplosionParticles(r.x, r.y, 50);
    // Heavy smoke
    this.spawnSmokeParticles(r.x, r.y, 40);
    // Debris / body fragments
    this.spawnDebrisParticles(r.x, r.y, 25);
    // Sparks
    this.spawnSparkParticles(r.x, r.y, 30);
    // Fire ring
    this.spawnFireRingParticles(r.x, r.y, 20);
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
    this.spawnExplosionParticles(r.x, r.y, 50);
    this.spawnSmokeParticles(r.x, r.y, 40);
    this.spawnDebrisParticles(r.x, r.y, 25);
    this.spawnSparkParticles(r.x, r.y, 30);
    this.spawnFireRingParticles(r.x, r.y, 20);
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

  // Debris particles for suicide roach explosion (body fragments)
  spawnDebrisParticles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 3 + Math.random() * 2, // 3-5 seconds
        maxLife: 3 + Math.random() * 2,
        size: 4 + Math.random() * 10,
        color: `hsl(${15 + Math.random() * 20}, 80%, ${30 + Math.random() * 20}%)`,
        type: ParticleType.ASH,
      });
    }
  }

  // Fire ring particles that expand outward
  spawnFireRingParticles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 1.5 + Math.random() * 1.5, // 1.5-3 seconds
        maxLife: 1.5 + Math.random() * 1.5,
        size: 8 + Math.random() * 16,
        color: `hsl(${10 + Math.random() * 25}, 100%, 55%)`,
        type: ParticleType.EXPLOSION,
      });
    }
  }

  // Shockwave ring: expands outward fast then fades - used for interrupt/collision impacts
  spawnShockwaveRing(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 150 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 0.8 + Math.random() * 0.4,
        size: 12 + Math.random() * 20,
        color: `rgba(255, ${200 + Math.random() * 55}, ${100 + Math.random() * 50}, 0.9)`,
        type: ParticleType.EXPLOSION,
      });
    }
    // Inner white core burst
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 150;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.5 + Math.random() * 0.3,
        size: 6 + Math.random() * 12,
        color: 'rgba(255, 255, 255, 0.95)',
        type: ParticleType.SPARK,
      });
    }
  }



  // ===== TIMED SUICIDE: "螂家爆破" EXPLOSION TRIGGER =====
  // Phase 3: Screen shake + debris barrage + defense damage
  triggerBreachExplosion(r: Roach) {
    // Prevent exponential death chain
    if (this._deathChainDepth >= this.MAX_DEATH_CHAIN_DEPTH) return;
    this._deathChainDepth++;

    try {
      // ===== SAME-LEVEL EXPLOSION AS placedBombs =====
      // Layer 1: Core explosion particles (80)
      this.spawnExplosionParticles(r.x, r.y, 80);
      // Layer 2: Fire ring (30)
      this.spawnFireRingParticles(r.x, r.y, 30);
      // Layer 3: Smoke (40)
      this.spawnSmokeParticles(r.x, r.y, 40);
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

      // Damage nearby roaches within 196px (same as placedBombs)
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

    // ===== MUTANT ROACH DEATH: "Embryo Rampage" - spawn 2 roaches =====
    if (r.type === RoachType.MUTANT) {
      this.forceEmbryoBurst(r);
    }

    r.state = RoachState.DEAD;
    // Extend death timer for MUTANT to allow 7-frame transformation animation to complete
    // 7 frames × 200ms = 1.4s total + 0.6s buffer
    r.deathTimer = r.type === RoachType.MUTANT ? 2.0 : 0.6;

    // Clean up sticky drop wrap on death (delegated to StickySystem)
    this.stickySystem!.cleanupRoachDeath(r);

    // Flying roach: play death sound, stop buzz loop if no more flying roaches alive
    if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
      this.audio.playFlyingDeath();
      // Check if any flying roaches are still alive
      const anyFlyingAlive = this.roaches.some(
        ro => (ro.type === RoachType.FLYING || ro.type === RoachType.FLYING_SUICIDE) && ro.state === RoachState.ALIVE
      );
      if (!anyFlyingAlive) {
        this.audio.stopFlyingBuzzLoop();
      }
    }

    // Splitting roach: spawn 5 small roaches on first death
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

    // Flying roach: disintegrate and fall on death
    if (r.type === RoachType.FLYING) {
      r.deathTimer = 2.0; // Longer for disintegration animation
      // Wing debris particles (wing fragments fly off)
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
      // Feather/spark particles
      this.spawnSparkParticles(r.x, r.y, 20);
      this.addFloatingText(r.x, r.y - 20, '解体!', '#88ccff');
    }
    // Suicide / Flying Suicide roach: enhanced explosion on death
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
      // Enhanced death explosion effects (5 second debris)
      this.spawnExplosionParticles(r.x, r.y, 35);
      this.spawnSmokeParticles(r.x, r.y, 30);
      this.spawnDebrisParticles(r.x, r.y, 20);
      this.spawnFireRingParticles(r.x, r.y, 15);
      this.spawnSparkParticles(r.x, r.y, 20);
      this.screenShake = 12;
      this.audio.playSuicideExplode();
      Vibration.vibrateSuicideExplode();
      this.addFloatingText(r.x, r.y - 30, hitCount > 0 ? `爆炸!(${hitCount}只受波及)` : '爆炸!', '#ff6600');
    }

    this.audio.playKill();
    Vibration.vibrateKill();
    this.spawnAshParticles(r.x, r.y, r.type === RoachType.QUEEN ? 50 : (r.type === RoachType.LARGE ? 20 : 12));
    this.spawnSparkParticles(r.x, r.y, r.type === RoachType.QUEEN ? 40 : (r.type === RoachType.LARGE ? 15 : 8));
    this.spawnBloodParticles(r.x, r.y, r.type === RoachType.QUEEN ? 40 : (r.type === RoachType.LARGE ? 25 : 15));

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
      case RoachType.FLYING_SUICIDE: this.economy.suicideKills++; break; // Count as suicide kill
      case RoachType.QUEEN: this.economy.queenKills++; break;
      // Hospital exclusive roach kills (count toward total but no separate category needed)
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

    // ===== MINION DEATH BACKLASH (Phase 1 core mechanic) =====
    // When minions die during Phase 1, BOSS takes backlash damage
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
          // Purple backlash particles
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

    // Boss death clears all remaining roaches
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

    // ===== TIMED SUICIDE: dead body bomb =====
    // When killed (not during bomb placement), leaves a 3s countdown bomb on the ground
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


  // =============================================================================
  // 碰撞检测：火焰/武器与蟑螂的碰撞，以及防线突破检测
  // 支持：锥形火焰 × 三连火焰多枪口、燃烧瓶火墙、毒雾区域、雷达激光
  // =============================================================================
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

  // =============================================================================
  // 波次系统：管理波次推进、生成队列、3-2-1 倒计时
  // 配置驱动：每个场景有独立的波次配置表
  // 委托给 WaveManager
  // =============================================================================
  updateWave() {
    // Skip wave logic during post-battle item sequences
    if (this.state === GameState.ITEM_DROP || this.state === GameState.ITEM_REVEAL) return;

    const result = this.waveManager!.update(this.deltaTime);
    if (result.skipRest) return;

    // ===== TIMED SUICIDE: Staggered spawn (8s apart for rhythm) =====
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

    // ===== TIMED SUICIDE: Update dead body bombs =====
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
        this.spawnExplosionParticles(bomb.x, bomb.y, 20);
        this.spawnSmokeParticles(bomb.x, bomb.y, 10);
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
          this.spawnExplosionParticles(bomb.x, bomb.y, 80);
          this.spawnFireRingParticles(bomb.x, bomb.y, 30);
          this.spawnSmokeParticles(bomb.x, bomb.y, 40);
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

  // ===== HOSPITAL EXCLUSIVE: SPAWN EGG POOLS =====
  // [DISABLED] Egg pool spawning removed - mutant roaches now spawn normally
  spawnHospitalEggPods(config: WaveConfig) {
    return; // Disabled: no more egg pools in hospital scene
    if (this.currentScene !== SceneType.HOSPITAL) return;
    const eggPoolCount = config.eggPoolActiveCount || 0;
    if (eggPoolCount <= 0) return;

    // 4 fixed positions for hospital egg pools
    const eggPoolPositions = [
      { x: 251, y: 447 },
      { x: 324, y: 455 },
      { x: 145, y: 542 },
      { x: 419, y: 554 },
    ];

    // Shuffle positions and pick eggPoolCount unique ones
    const shuffled = [...eggPoolPositions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(eggPoolCount, shuffled.length));

    for (const pos of selected) {
      this.hospitalTotalEggPods++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pod: any = { // [REMOVED] EggPod type removed
        id: nextId++,
        x: pos.x, // Exact user-specified position
        y: pos.y,
        hp: 360, // Doubled from 180
        maxHp: 360,
        state: 'intact',
        hatchTimer: 5, // 5 seconds countdown
        hatchType: RoachType.MUTANT, // Always hatches mutant roaches
        wobbleOffset: Math.random() * Math.PI * 2,
        immuneTimer: 3, // 3 seconds spawn immunity
      };
      this.hospitalEggPods.push(pod);
    }

    if (eggPoolCount > 0) {
      this.addFloatingText(this.width / 2, this.height * 0.2, `虫卵孵化池出现!`, '#ef4444');
    }
  }

  // Update hospital egg pods (countdown + hatching)
  // [DISABLED] Egg pod system removed
  updateHospitalEggPods() {
    return; // Disabled
    if (this.currentScene !== SceneType.HOSPITAL || this.hospitalEggPods.length === 0) return;

    for (let i = this.hospitalEggPods.length - 1; i >= 0; i--) {
      const pod = this.hospitalEggPods[i];

      if (pod.state === 'intact') {
        // Spawn immunity countdown
        if (pod.immuneTimer && pod.immuneTimer > 0) {
          pod.immuneTimer -= this.deltaTime;
        }
        // Hatch countdown
        pod.hatchTimer -= this.deltaTime;
        // Green particles floating upward from egg pod
        if (Math.random() < 0.6) {
          this.particles.push({
            x: pod.x + (Math.random() - 0.5) * 30,
            y: pod.y - 20,
            vx: (Math.random() - 0.5) * 15,
            vy: -25 - Math.random() * 20,
            life: 1.0, maxLife: 1.0,
            size: 3 + Math.random() * 5,
            color: `rgba(${30 + Math.random() * 40}, ${180 + Math.random() * 60}, ${30 + Math.random() * 30}, 0.7)`,
            type: ParticleType.POISON_CLOUD,
          });
        }

        // Visual warning when close to hatching (last 3 seconds)
        if (pod.hatchTimer <= 3 && pod.hatchTimer > 0) {
          if (Math.random() < 0.4) {
            this.spawnSparkParticles(pod.x, pod.y, 2);
          }
        }

        // Hatch after countdown
        if (pod.hatchTimer <= 0) {
          pod.state = 'hatched';
          this.hatchHospitalEggPod(pod);
          this.hospitalEggPods.splice(i, 1);
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hatchHospitalEggPod(pod: any) {
    // Spawn 3 mutant roaches from the egg pod
    // CRITICAL FIX: Respect the 40-roach performance cap
    const MAX_ROACHES = 40;
    const availableSlots = Math.max(0, MAX_ROACHES - this.roaches.length);
    const spawnCount = Math.min(3, availableSlots);

    if (spawnCount <= 0) {
      // No room for new roaches - destroy the egg pod without spawning
      this.spawnExplosionParticles(pod.x, pod.y, 8);
      this.addFloatingText(pod.x, pod.y - 20, '虫卵销毁(数量上限)', '#9ca3b8');
      return;
    }

    const isHard = this.difficulty === 'hard';
    const def = ENEMY_DEFS[RoachType.MUTANT];
    const hpMult = isHard ? 1.3 : 1.0;
    // Ensure spawned roaches are within ground bounds
    const [, farLY] = SCENE_GROUND_BOUNDS[this.currentScene];

    for (let m = 0; m < spawnCount; m++) {
      const angle = (m / 3) * Math.PI * 2;
      const spawnX = pod.x + Math.cos(angle) * 40;
      // Clamp spawn Y to be within ground bounds (not above far line)
      const spawnY = Math.max(farLY + 15, pod.y + Math.sin(angle) * 25);

      const roach: Roach = {
        id: nextId++,
        type: RoachType.MUTANT,
        state: RoachState.ALIVE,
        x: spawnX,
        y: spawnY,
        vx: 0, vy: 0,
        angle: Math.PI / 2,
        // Hatched roaches get 1.5x speed boost to reach combat faster
        speed: def.speed * (1.2 + Math.random() * 0.6) * 1.5,
        baseSpeed: def.speed * 1.5,
        size: def.size,
        hp: Math.floor(def.hp * hpMult),
        maxHp: Math.floor(def.hp * hpMult),
        armorHp: 0,
        maxArmorHp: 0,
        clusterId: undefined,
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
        facingRight: Math.random() > 0.5,
        altitude: 0,
        wingPhase: 0,
        hasSplit: false,
        fuseTimer: 0,
        isFused: false,
        hasTransformed: false,
        transformTimer: undefined,
        spawnTimer: 0,
        isBoss: false,
        isCharging: false,
        stuckTimer: 0,
        poisonTimer: 0,
        poisonDamage: 0,
        burnDamage: 0,
        inFire: false,
        fanSlowTimer: 0,
        fanSlowFactor: 0,
        fanPushY: 0,
        wrappedByDropId: null,
        wrapTimer: 0,
        damageFlash: 0,
        dodgeDir: 0,
        dodgeTimer: 0,
        wasDodging: false,
        isBurnBack: false,
        burnBackTimer: 0,
        isBlind: false,
        blindTimer: 0,
        isJammed: false,
        jamTimer: 0,
        homeX: spawnX,
        homeY: spawnY,
        returningHome: false,
        chargeReturnDelay: 0,
        reward: def.reward,
        // Hospital exclusive fields (initialized for safety even though mutant doesn't use them)
        healTimer: 0,
        healTargetId: null,
        asphyxiationTimer: 0,
        explodeTimer: 0,
        isCountingDown: false,
        countdownPaused: false,
        isSplitChild: false,
      };
      this.roaches.push(roach);
    }

    // Visual effects
    this.spawnSparkParticles(pod.x, pod.y, 10);
    this.spawnSmokeParticles(pod.x, pod.y, 15);
    this.addFloatingText(pod.x, pod.y - 30, '虫卵孵化!', '#ef4444');
    this.addFloatingText(pod.x, pod.y - 45, '3只变异蟑螂!', '#84cc16');
    this.screenShake = 5;
  }

  // Damage a hospital egg pod (called from fire weapon or projectiles)
  damageHospitalEggPod(podId: number, damage: number) {
    const pod = this.hospitalEggPods.find(p => p.id === podId);
    if (!pod || pod.state !== 'intact') return;

    // Spawn immunity: no damage for first 3 seconds
    if (pod.immuneTimer && pod.immuneTimer > 0) {
      // Visual feedback: show shield block effect
      if (Math.random() < 0.3) {
        this.particles.push({
          x: pod.x + (Math.random() - 0.5) * 20,
          y: pod.y + (Math.random() - 0.5) * 20,
          vx: 0, vy: -20,
          life: 0.5, maxLife: 0.5,
          size: 4, color: '#60a5fa',
          type: ParticleType.SPARK,
        });
      }
      return; // Immune, no damage
    }

    pod.hp -= damage;
    this.spawnSparkParticles(pod.x, pod.y, 3);

    if (pod.hp <= 0) {
      // Egg destroyed!
      pod.state = 'hatched'; // Mark as done
      const idx = this.hospitalEggPods.indexOf(pod);
      if (idx >= 0) this.hospitalEggPods.splice(idx, 1);

      // Destroy effects
      this.spawnExplosionParticles(pod.x, pod.y, 12);
      this.spawnSmokeParticles(pod.x, pod.y, 10);
      this.addFloatingText(pod.x, pod.y - 20, '虫卵摧毁!', '#22c55e');
      this.screenShake = 4;

      // Track destroys for star rating
      this.hospitalDestroyedEggPods++;
      // Track consecutive destroys
      this.hospitalEggPodDestroyedCount++;
      if (this.hospitalEggPodDestroyedCount >= 3) {
        // Disinfection reward!
        this.hospitalEggPodDestroyedCount = 0;
        this.triggerDisinfectionReward(pod.x, pod.y);
      }
    }
  }

  // Disinfection reward: full gas refill + instant clear all enemy DoT effects
  triggerDisinfectionReward(x: number, y: number) {
    // Full gas refill
    this.player.gas = this.player.maxGas;
    // Clear all roach DoT effects
    for (const r of this.roaches) {
      if (r.state === RoachState.ALIVE) {
        r.burnDamage = 0;
        r.poisonTimer = 0;
        r.poisonDamage = 0;
      }
    }
    this.addFloatingText(this.width / 2, this.height * 0.3, '消毒奖励!', '#22d55e');
    this.addFloatingText(this.width / 2, this.height * 0.3 + 25, '燃气全满 + 清除异常状态', '#4ade80');
    // Green sparkle effect
    for (let s = 0; s < 30; s++) {
      const angle = (s / 30) * Math.PI * 2;
      const speed = 50 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 1.2, maxLife: 1.2,
        size: 5 + Math.random() * 8,
        color: `rgba(${50 + Math.random() * 50}, ${200 + Math.random() * 55}, ${50 + Math.random() * 30}, 0.9)`,
        type: ParticleType.SPARK,
      });
    }
    this.screenShake = 6;
    this.hospitalDisinfectionRewardTimer = 2.0;
  }

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
  spawnConeFire(gx: number, gy: number, angle: number, range: number, _spread: number, baseDamage: number, type: 'fire' | 'ice' | 'poison' = 'fire') {
    const count = Math.floor(3 + Math.random() * 3); // Reduced: 3-6 particles
    const isIce = type === 'ice';
    const isPoison = type === 'poison';

    for (let i = 0; i < count; i++) {
      const rDist = Math.random() * range;
      const rAngle = angle + (Math.random() - 0.5) * 0.5;
      const px = gx + Math.cos(rAngle) * rDist;
      const py = gy + Math.sin(rAngle) * rDist;
      const life = 0.06 + Math.random() * 0.08; // Shorter: 0.06-0.14s
      const flowSpeed = 100 + Math.random() * 60;
      let color = '';
      let particleType: ParticleType;
      let size = 0;

      if (isIce) {
        color = `rgba(${180 + Math.random() * 40}, ${220 + Math.random() * 20}, 255, ${0.5 + Math.random() * 0.5})`;
        particleType = ParticleType.ICE;
        size = 2 + Math.random() * 4;
      } else if (isPoison) {
        color = `rgba(${100 + Math.random() * 40}, ${220 + Math.random() * 30}, ${100 + Math.random() * 40}, ${0.4 + Math.random() * 0.4})`;
        particleType = ParticleType.POISON_CLOUD;
        size = 3 + Math.random() * 5;
      } else {
        const temp = Math.random();
        if (temp < 0.5) {
          color = `rgba(255, ${100 + Math.random() * 80}, ${Math.random() * 40}, ${0.7 + Math.random() * 0.3})`;
          particleType = ParticleType.FIRE;
          size = 2 + Math.random() * 5;
        } else {
          color = `rgba(255, ${200 + Math.random() * 55}, ${50 + Math.random() * 50}, ${0.5 + Math.random() * 0.5})`;
          particleType = ParticleType.EMBER;
          size = 1 + Math.random() * 3;
        }
      }

      this.particles.push({
        x: px, y: py,
        vx: Math.cos(rAngle) * flowSpeed,
        vy: Math.sin(rAngle) * flowSpeed,
        life, maxLife: life,
        size, color,
        type: particleType,
      });
    }

    // Single spark at gun muzzle
    this.particles.push({
      x: gx, y: gy,
      vx: (Math.random() - 0.5) * 60,
      vy: -60 - Math.random() * 40,
      life: 0.08,
      maxLife: 0.08,
      size: 2 + Math.random() * 3,
      color: '#fff',
      type: ParticleType.SPARK,
    });

    // Add fire zone - larger radius and longer life for BOSS
    this.fireZones.push({
      x: gx + Math.cos(angle) * range / 2,
      y: gy + Math.sin(angle) * range / 2,
      radius: range * 0.8,  // 80% of range (was 50%) - larger coverage
      damagePerSecond: baseDamage / this.deltaTime * 3,  // 3x damage for visibility
      life: 0.5, maxLife: 0.5,  // 0.5s (was 0.12s) - longer lasting
      type,
    });
    // Cap fire zones - trim from end (cheaper than splice from start)
    if (this.fireZones.length > 25) {
      this.fireZones.length = 25; // Truncate array
    }
  }

  spawnSmokeParticles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 50,
        life: 1 + Math.random() * 2, maxLife: 1 + Math.random() * 2,
        size: 6 + Math.random() * 16,
        color: `hsl(0, 0%, ${35 + Math.random() * 35}%)`,
        type: ParticleType.SMOKE,
      });
    }
  }

  spawnAshParticles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.6 + Math.random() * 1.0, maxLife: 0.6 + Math.random() * 1.0,
        size: 2 + Math.random() * 6,
        color: `hsl(0, 0%, ${5 + Math.random() * 20}%)`,
        type: ParticleType.ASH,
      });
    }
  }

  spawnBloodParticles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 40,
        life: 0.5, maxLife: 0.5,
        size: 4 + Math.random() * 10,
        color: `rgba(${20 + Math.random() * 40}, ${120 + Math.random() * 60}, ${20 + Math.random() * 40}, ${0.5 + Math.random() * 0.5})`,
        type: ParticleType.BLOOD,
      });
    }
  }

  /**
   * 在指定位置生成火花粒子
   * @param {number} x - X 坐标
   * @param {number} y - Y 坐标
   * @param {number} count - 粒子数量
   */
  spawnSparkParticles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.4, maxLife: 0.2 + Math.random() * 0.4,
        size: 1 + Math.random() * 3,
        color: `hsl(${30 + Math.random() * 30}, 100%, 75%)`,
        type: ParticleType.SPARK,
      });
    }
  }

  spawnExplosionParticles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.3 + Math.random() * 0.5, maxLife: 0.3 + Math.random() * 0.5,
        size: 3 + Math.random() * 12,
        color: `hsl(${10 + Math.random() * 30}, 100%, ${50 + Math.random() * 25}%)`,
        type: ParticleType.EXPLOSION,
      });
    }
  }

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

  spawnLightningParticles(centerX: number, topY: number) {
    for (let i = 0; i < 20; i++) {
      const x = centerX + (Math.random() - 0.5) * this.width * 0.8;
      this.particles.push({
        x, y: topY + Math.random() * 50,
        vx: (Math.random() - 0.5) * 60,
        vy: 100 + Math.random() * 200,
        life: 0.4 + Math.random() * 0.4, maxLife: 0.4 + Math.random() * 0.4,
        size: 3 + Math.random() * 6,
        color: `rgba(150, 220, 255, ${0.6 + Math.random() * 0.4})`,
        type: ParticleType.LIGHTNING,
      });
    }
    for (let i = 0; i < 30; i++) {
      const x = centerX + (Math.random() - 0.5) * this.width;
      const y = Math.random() * this.height;
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100,
        life: 0.2 + Math.random() * 0.3, maxLife: 0.2 + Math.random() * 0.3,
        size: 2 + Math.random() * 4,
        color: `rgba(200, 240, 255, ${0.5 + Math.random() * 0.5})`,
        type: ParticleType.LIGHTNING,
      });
    }
  }


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

  // =============================================================================
  // 主渲染循环：25+ 个子渲染步骤的分层渲染管线
  // 渲染顺序：背景 → 天气背景 → 场景元素 → 实体 → 粒子 → UI 叠加层
  // =============================================================================
  /** 主渲染循环（每帧调用） */
  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.translate(this.screenShakeX, this.screenShakeY);

    this.renderBackground(ctx, w, h);
    // Show movement range overlay (semi-transparent visualization of player walkable area)
    if (this.showMovementRange) {
      this.renderMovementRange(ctx);
    }
    this.renderWeatherBackground(ctx, w, h);
    this.renderFireZones(ctx);
    this.renderFireWalls(ctx);
    this.renderStickyBoards();
    this.renderStickyDrops(ctx);
    this.renderWeaponDrops(ctx);
    this.renderParticles(ctx);
    this.renderBaitMark(ctx);
    // ===== HOSPITAL EXCLUSIVE: Render hospital egg pods BEFORE roaches =====
    // [DISABLED] Egg pod system removed
    // if (this.currentScene === SceneType.HOSPITAL && this.hospitalEggPods.length > 0) {
    //   this.renderHospitalEggPods(ctx);
    // }
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
    if (this.slimeBurstTimer > 0) {
      const progress = 1 - this.slimeBurstTimer / 1.2; // 0→1 over 1.2s
      const sx = this.slimeBurstX;
      const sy = this.slimeBurstY;
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
      this.spawnSparkParticles(itemX, itemY, 15);
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

  // ===== HOSPITAL EXCLUSIVE: RENDER HOSPITAL EGG PODS =====
  renderHospitalEggPods(ctx: CanvasRenderingContext2D) {
    if (!this.hospitalEggPods.length) return;

    const img = this.eggPodImg;
    const basePodW = 72;   // Halved from 144
    const basePodH = 96;   // Halved from 192

    // Perspective range: yMin=361 (farthest) → scale 0.5, yMax=612 (nearest) → scale 1.0
    const yMin = 361;
    const yMax = 612;

    for (const pod of this.hospitalEggPods) {
      if (pod.state !== 'intact') continue;

      const hpRatio = pod.hp / pod.maxHp;
      const countdownRatio = pod.hatchTimer / 5; // 5 seconds total

      // Perspective scale: farther (smaller y) = smaller, nearer (larger y) = larger
      const yRatio = Math.max(0, Math.min(1, (pod.y - yMin) / (yMax - yMin)));
      const perspScale = 0.5 + yRatio * 0.5; // 0.5 ~ 1.0
      const podW = basePodW * perspScale;
      const podH = basePodH * perspScale;

      ctx.save();
      ctx.translate(pod.x, pod.y);

      // Fixed orientation: no wobble animation

      // Draw egg pod image at 80% opacity
      ctx.globalAlpha = 0.8;
      if (img) {
        ctx.drawImage(img, -podW / 2, -podH / 2, podW, podH);
      } else {
        ctx.fillStyle = '#5a7a5a';
        ctx.beginPath();
        ctx.ellipse(0, 0, podW / 2, podH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Restore full opacity for UI overlays
      ctx.globalAlpha = 1;

      // HP bar (shows damage taken) - scaled with perspective
      const barW = 60 * perspScale;
      const barH = 6 * perspScale;
      const barY = -podH / 2 - 10 * perspScale;
      ctx.fillStyle = '#333';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : (hpRatio > 0.25 ? '#f59e0b' : '#ef4444');
      ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

      // Countdown text
      const secondsLeft = Math.ceil(pod.hatchTimer);
      ctx.fillStyle = countdownRatio > 0.3 ? '#fbbf24' : '#ef4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${secondsLeft}s`, 0, barY - 10);
      ctx.shadowBlur = 0;

      // Pulsing glow when close to hatching (last 3 seconds) - simplified, no shadowBlur
      if (pod.hatchTimer <= 3) {
        const pulse = Math.sin(this.time * 6) * 0.3 + 0.5;
        ctx.strokeStyle = `rgba(255, 150, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -this.time * 10;
        ctx.beginPath();
        ctx.ellipse(0, 0, podW / 2 + 8 * perspScale, podH / 2 + 8 * perspScale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    // Disinfection reward text
    if (this.hospitalDisinfectionRewardTimer > 0) {
      this.hospitalDisinfectionRewardTimer -= this.deltaTime;
      const alpha = Math.min(1, this.hospitalDisinfectionRewardTimer);
      ctx.save();
      ctx.fillStyle = `rgba(34, 213, 94, ${alpha * 0.3})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
  }

  // ===== HOSPITAL EXCLUSIVE: RENDER PLACED BOMBS =====

  // ========== INSECTICIDE SPRAY RENDERING (delegated to RenderUtils static method) =========

  // ========== RADAR LASER RENDERING =========
  /** 渲染雷达激光（委托给 RenderUtils 静态方法） */
  renderRadarLaser(ctx: CanvasRenderingContext2D) {
    RenderUtils.renderRadarLaser(ctx, this.radarLaserSystem!.getState(), this.roaches, this.player.x, this.player.y, this.time);
  }

  /**
   * 渲染场景背景
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} w - 画布宽度
   * @param {number} h - 画布高度
   */
  renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const scene = this.getSceneConfig();
    const diff = this.difficulty;
    const currScene = this.currentScene;
    const isHard = diff === 'hard';
    const isEasy = diff === 'easy';

    // ===== GENERIC bgImage support for new scenes =====
    if (scene.bgImage && this.bgSceneImages[currScene]) {
      const bgImg = this.bgSceneImages[currScene];
      if (bgImg.complete && bgImg.naturalWidth > 0) {
        // Cover-fit the background image
        const imgRatio = bgImg.naturalWidth / bgImg.naturalHeight;
        const canvasRatio = w / h;
        let drawW: number, drawH: number, drawX: number, drawY: number;
        if (imgRatio > canvasRatio) {
          drawH = h;
          drawW = h * imgRatio;
          drawX = (w - drawW) / 2;
          drawY = 0;
        } else {
          drawW = w;
          drawH = w / imgRatio;
          drawX = 0;
          drawY = (h - drawH) / 2;
        }
        ctx.globalAlpha = 0.8;
        ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
        ctx.globalAlpha = 1;
        return;
      }
    }

    // ===== KITCHEN =====
    if (currScene === SceneType.KITCHEN && isHard && this.bgKitchenHardImg && this.imagesLoaded) {
      ctx.drawImage(this.bgKitchenHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.KITCHEN && isEasy && this.bgKitchenEasyImg && this.imagesLoaded) {
      ctx.drawImage(this.bgKitchenEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.KITCHEN && this.bgImg && this.imagesLoaded) {
      ctx.drawImage(this.bgImg, 0, 0, w, h);
    // ===== SEWER =====
    } else if (currScene === SceneType.SEWER && isHard && this.bgSewerHardImg && this.imagesLoaded) {
      ctx.drawImage(this.bgSewerHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.SEWER && isEasy && this.bgSewerEasyImg && this.imagesLoaded) {
      ctx.drawImage(this.bgSewerEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.SEWER && this.bgSewerImg && this.imagesLoaded) {
      ctx.drawImage(this.bgSewerImg, 0, 0, w, h);
    // ===== DUMP =====
    } else if (currScene === SceneType.DUMP && isHard && this.bgDumpHardImg && this.imagesLoaded) {
      ctx.drawImage(this.bgDumpHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.DUMP && isEasy && this.bgDumpEasyImg && this.imagesLoaded) {
      ctx.drawImage(this.bgDumpEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.DUMP && this.bgDumpImg && this.imagesLoaded) {
      ctx.drawImage(this.bgDumpImg, 0, 0, w, h);
    // ===== BASEMENT =====
    } else if (currScene === SceneType.BASEMENT && isHard && this.bgBasementHardImg && this.imagesLoaded) {
      ctx.drawImage(this.bgBasementHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.BASEMENT && isEasy && this.bgBasementEasyImg && this.imagesLoaded) {
      ctx.drawImage(this.bgBasementEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.BASEMENT && this.bgBasementImg && this.imagesLoaded) {
      ctx.drawImage(this.bgBasementImg, 0, 0, w, h);
    // ===== ROOFTOP =====
    } else if (currScene === SceneType.ROOFTOP && isHard && this.bgRooftopHardImg && this.imagesLoaded) {
      ctx.drawImage(this.bgRooftopHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.ROOFTOP && isEasy && this.bgRooftopEasyImg && this.imagesLoaded) {
      ctx.drawImage(this.bgRooftopEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.ROOFTOP && this.bgRooftopImg && this.imagesLoaded) {
      ctx.drawImage(this.bgRooftopImg, 0, 0, w, h);
    // ===== STREET =====
    } else if (currScene === SceneType.STREET && isHard && this.bgStreetHardImg && this.imagesLoaded) {
      ctx.drawImage(this.bgStreetHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.STREET && isEasy && this.bgStreetEasyImg && this.imagesLoaded) {
      ctx.drawImage(this.bgStreetEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.STREET && this.bgStreetImg && this.imagesLoaded) {
      ctx.drawImage(this.bgStreetImg, 0, 0, w, h);
    } else {
      // Scene-specific background
      ctx.fillStyle = scene.bgColor;
      ctx.fillRect(0, 0, w, h);
      const tileSize = 48;
      for (let x = 0; x < w; x += tileSize) {
        for (let y = 0; y < h; y += tileSize) {
          const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
          ctx.fillStyle = isEven ? scene.tileColors[0] : scene.tileColors[1];
          ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
      }
    }

    // Night overlay
    const scene2 = this.getSceneConfig();
    if (scene2.weather === WeatherType.NIGHT) {
      const nightAlpha = 0.4 + (this.lightningFlash > 0 ? 0.2 : 0);
      ctx.fillStyle = `rgba(0, 0, 20, ${nightAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, h * 0.8);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

  }

  renderWeatherBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    WeatherSystem.renderWeatherBackground(ctx, w, h, this.lightningFlash);
  }

  renderDefenseLine(ctx: CanvasRenderingContext2D, w: number) {
    const scene = this.getSceneConfig();
    RenderUtils.renderDefenseLine(ctx, w, this.defenseLineY(), scene.defenseLineColor, this.time, this.player.shieldTimer);
  }

  renderFireZones(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    if (!p.isFiring || p.isOverheated || p.isReloading || p.gas <= 0) return;
    if (p.currentWeapon === 'molotov') return;

    const maxRange = p.fireRange * 0.5;
    const nozzleY = p.y - 322;
    const endY = nozzleY - maxRange;

    // Gun positions
    const gunXs: number[] = [p.x];
    if (this.tripleFlameSystem!.getState().active) {
      gunXs.push(p.x - this.tripleFlameSystem!.getState().sideOffset);
      gunXs.push(p.x + this.tripleFlameSystem!.getState().sideOffset);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Render flame for each gun
    for (let gi = 0; gi < gunXs.length; gi++) {
      const gunX = gunXs[gi];
      const isSideGun = gi > 0;
      const flameScale = isSideGun ? 0.6 : 1.0;
      const nozzleYOffset = isSideGun ? 50 : 0; // Only flame effect moves down 50px, gun body stays
      const gunNozzleY = nozzleY + nozzleYOffset;
      const gunEndY = endY + nozzleYOffset;

      const segments = 50;
      for (let i = 0; i < segments; i++) {
        const t0 = i / segments;
        const t1 = (i + 1) / segments;
        const y0 = gunNozzleY + (gunEndY - gunNozzleY) * t0;
        const y1 = gunNozzleY + (gunEndY - gunNozzleY) * t1;

        const baseWidth = 32 * flameScale;
        const w0 = baseWidth * (1 - t0 * 0.94) + Math.sin(t0 * Math.PI * 6 + this.time * 30 + gi) * 5;
        const w1 = baseWidth * (1 - t1 * 0.94) + Math.sin(t1 * Math.PI * 6 + this.time * 30 + gi) * 5;

        const c0 = this.getFlameColor(t0, p.currentWeapon);
        const c1 = this.getFlameColor(t1, p.currentWeapon);

        ctx.beginPath();
        ctx.moveTo(gunX - w0, y0);
        ctx.lineTo(gunX - w1, y1);
        ctx.lineTo(gunX + w1, y1);
        ctx.lineTo(gunX + w0, y0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(gunX, y0, gunX, y1);
        grad.addColorStop(0, c0);
        grad.addColorStop(1, c1);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Core glow per gun
      let coreColor = '160, 210, 255';
      if (p.currentWeapon === 'sticky') coreColor = '250, 200, 50';
      else if (p.currentWeapon === 'poison') coreColor = '200, 160, 255';

      const glowSize = 36 * flameScale;
      const coreGrad = ctx.createRadialGradient(gunX, gunNozzleY, 0, gunX, gunNozzleY, glowSize);
      coreGrad.addColorStop(0, `rgba(${coreColor}, 0.9)`);
      coreGrad.addColorStop(0.3, `rgba(${coreColor}, 0.5)`);
      coreGrad.addColorStop(0.6, `rgba(${coreColor}, 0.3)`);
      coreGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(gunX, gunNozzleY, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // Power Boost: air disturbance ripples around gun nozzle
      if (this.player.powerBoostTimer > 0) {
        const boostAlpha = Math.min(1, this.player.powerBoostTimer / 0.5) * 0.25;
        for (let ri = 0; ri < 3; ri++) {
          const ripplePhase = (this.time * 4 + ri * 2.1) % 3;
          const rippleRadius = 30 + ripplePhase * 25;
          const rippleAlpha = boostAlpha * (1 - ripplePhase / 3);
          ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(gunX, gunNozzleY, rippleRadius * flameScale, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  /** 渲染火焰墙（委托给 ParticleSystem 静态方法） */
  renderFireWalls(ctx: CanvasRenderingContext2D) {
    ParticleSystem.renderFireWalls(ctx, this.fireWalls, this.time);
  }

  renderStickyBoards() {
    // Legacy sticky board rendering removed - replaced by auto-targeting sticky drops
    // Sticky boards array is kept for backwards compatibility but no longer rendered
  }

  /** 渲染粘性弹丸（委托给 DropRenderer 静态方法） */
  renderStickyDrops(ctx: CanvasRenderingContext2D) {
    DropRenderer.renderStickyDrops(ctx, this.stickySystem!.stickyDrops, this.roaches, this.time, this.deltaTime);
  }

  getFlameColor(t: number, weapon: string = 'flamethrower'): string {
    let r: number, g: number, b: number;

    if (weapon === 'sticky') {
      // Yellow to orange (sticky board)
      r = Math.floor(250);
      g = Math.floor(200 + t * 55);
      b = Math.floor(50 + t * 50);
    } else if (weapon === 'poison') {
      // Purple to green
      r = Math.floor(150 - t * 100);
      g = Math.floor(100 + t * 100);
      b = Math.floor(200 - t * 50);
    } else if (weapon === 'shotgun') {
      // Orange to yellow
      r = 255;
      g = Math.floor(150 + t * 105);
      b = Math.floor(50 + t * 100);
    } else {
      // Default: blue to red
      if (t < 0.5) {
        const s = t * 2;
        r = Math.floor(60 + s * 140);
        g = Math.floor(140 - s * 80);
        b = Math.floor(255 - s * 100);
      } else {
        const s = (t - 0.5) * 2;
        r = Math.floor(200 + s * 55);
        g = Math.floor(60 - s * 60);
        b = Math.floor(155 - s * 155);
      }
    }

    const a = 0.75 * (1 - t) * (1 - t);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
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
      mutantTransformActive: this.mutantTransformActive, mutantTransformFrame: this.mutantTransformFrame,
      bossBattle: this.bossBattle, bossAnimState: this.bossAnimState, bossAnimFrames: this.bossAnimFrames,
      onAddParticle: (p) => { this.particles.push(p); },
      onSpawnShockwaveRing: (x, y, count) => { this.spawnShockwaveRing(x, y, count); },
      isStuckByBoard: (id) => this.isStuckByBoard(id),
    }, ctx, this.roaches);
  }

  /** 渲染玩家与武器 */
  renderPlayer(ctx: CanvasRenderingContext2D) {
    // Three-phase visual: charging → spraying → dissipating
    ctx.save();
    for (const r of this.roaches) {
      if (r.type !== RoachType.NURSE || r.state !== RoachState.ALIVE) continue;
      if (!r.healPhase || r.healPhase === 'idle') continue;

      const healRange = 360;
      const progress = r.healPhaseTimer || 0;

      switch (r.healPhase) {
        case 'charging': {
          // Phase 1: Charge (1.0s) - expanding range circle at feet
          const chargeProgress = 1 - progress / 1.0;
          const alpha = 0.15 + chargeProgress * 0.35;
          const footY = r.y + 12;
          const expandScale = chargeProgress; // 0 -> 1 as charge completes

          // 1. Expanding outer ring (grows from center to full range)
          const ringR = healRange * 0.9 * expandScale;
          const ringRY = healRange * 0.32 * expandScale;

          // Glow that expands with the ring
          if (ringR > 5) {
            const glowGrad = ctx.createRadialGradient(r.x, footY, ringR * 0.3, r.x, footY, ringR * 1.2);
            glowGrad.addColorStop(0, `rgba(100, 240, 150, 0)`);
            glowGrad.addColorStop(0.85, `rgba(100, 240, 150, ${alpha * 0.2})`);
            glowGrad.addColorStop(1, `rgba(140, 255, 190, ${alpha * 0.4})`);
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.ellipse(r.x, footY, ringR * 1.2, ringRY * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Solid ring boundary
            ctx.strokeStyle = `rgba(120, 255, 170, ${alpha * 0.7})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(r.x, footY, ringR, ringRY, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Inner fill
            ctx.fillStyle = `rgba(100, 230, 150, ${alpha * 0.1})`;
            ctx.beginPath();
            ctx.ellipse(r.x, footY, ringR * 0.85, ringRY * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          // 2. Center pulse dot (nurse position)
          const dotPulse = 1 + Math.sin(this.time * 8) * 0.3;
          ctx.fillStyle = `rgba(140, 255, 190, ${alpha * 0.6})`;
          ctx.beginPath();
          ctx.arc(r.x, footY, 4 * dotPulse * expandScale, 0, Math.PI * 2);
          ctx.fill();

          // 3. ECG-like pulse line on the ground
          ctx.strokeStyle = `rgba(100, 230, 150, ${alpha * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let ex = -60; ex <= 60; ex += 2) {
            const ecgY = footY - 20 + Math.sin(ex * 0.3 + this.time * 12) * (ex % 20 < 5 ? 12 : 3);
            if (ex === -60) ctx.moveTo(r.x + ex, ecgY);
            else ctx.lineTo(r.x + ex, ecgY);
          }
          ctx.stroke();
          break;
        }

        case 'spraying': {
          // Phase 2: Spray (1.2s) - watercolor mist blobs
          const sprayProgress = 1 - progress / 1.2;
          // 4 diagonal mist sprays (4 directions)
          const mistDirs = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
          for (let mi = 0; mi < mistDirs.length; mi++) {
            const baseAngle = mistDirs[mi];
            const spread = healRange * sprayProgress;
            // 3 watercolor blobs per direction
            for (let bi = 0; bi < 3; bi++) {
              const blobDist = (bi + 1) * spread * 0.35;
              const blobAngle = baseAngle + Math.sin(this.time * 2 + bi + mi) * 0.15;
              const bx = r.x + Math.cos(blobAngle) * blobDist;
              const by = r.y + Math.sin(blobAngle) * blobDist * 0.5;
              const blobSize = (25 + bi * 12) * (1 - sprayProgress * 0.3);
              const blobAlpha = 0.25 * (1 - sprayProgress * 0.5) * (1 - bi * 0.15);
              // Soft watercolor radial gradient
              const grad = ctx.createRadialGradient(bx, by, 0, bx, by, blobSize);
              grad.addColorStop(0, `rgba(100, 148, 100, ${blobAlpha})`);
              grad.addColorStop(0.5, `rgba(90, 138, 90, ${blobAlpha * 0.5})`);
              grad.addColorStop(1, `rgba(80, 120, 80, 0)`);
              ctx.fillStyle = grad;
              ctx.beginPath();
              // Irregular blob shape
              for (let a = 0; a <= Math.PI * 2; a += 0.3) {
                const br = blobSize * (0.7 + Math.sin(a * 3 + this.time + bi) * 0.3);
                if (a === 0) ctx.moveTo(bx + Math.cos(a) * br, by + Math.sin(a) * br * 0.6);
                else ctx.lineTo(bx + Math.cos(a) * br, by + Math.sin(a) * br * 0.6);
              }
              ctx.closePath();
              ctx.fill();
            }
          }
          // ===== HEAL RANGE CIRCLE: clear green ring at nurse's feet =====
          const footY = r.y + 12; // slightly below center = feet position
          const pulse = 1 + Math.sin(this.time * 4) * 0.06;
          const ringAlpha = 0.5 * pulse;

          // 1. Outer glow (radial gradient)
          const glowGrad = ctx.createRadialGradient(r.x, footY, healRange * 0.5, r.x, footY, healRange * 1.1);
          glowGrad.addColorStop(0, `rgba(80, 220, 120, 0)`);
          glowGrad.addColorStop(0.8, `rgba(80, 220, 120, ${ringAlpha * 0.15})`);
          glowGrad.addColorStop(1, `rgba(120, 255, 170, ${ringAlpha * 0.35})`);
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 1.1, healRange * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();

          // 2. Inner fill (semi-transparent green)
          ctx.fillStyle = `rgba(90, 210, 130, ${ringAlpha * 0.12})`;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.9, healRange * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();

          // 3. Main ring boundary (bright green solid line)
          ctx.strokeStyle = `rgba(100, 245, 150, ${ringAlpha * 0.85})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.9, healRange * 0.32, 0, 0, Math.PI * 2);
          ctx.stroke();

          // 4. Inner ring (dashed feel)
          ctx.strokeStyle = `rgba(130, 255, 180, ${ringAlpha * 0.4})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 10]);
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.55, healRange * 0.2, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // 5. Rotating tick marks on the outer ring edge
          const tickCount = 12;
          const tickRot = this.time * 1.8;
          for (let ti = 0; ti < tickCount; ti++) {
            const a = tickRot + (ti / tickCount) * Math.PI * 2;
            const tx = r.x + Math.cos(a) * healRange * 0.9;
            const ty = footY + Math.sin(a) * healRange * 0.32;
            const tickLen = 5 + (ti % 3 === 0 ? 4 : 0); // every 3rd tick is longer
            const nx = -Math.sin(a); // normal vector
            const ny = Math.cos(a);
            ctx.strokeStyle = `rgba(160, 255, 200, ${ringAlpha * 0.7})`;
            ctx.lineWidth = ti % 3 === 0 ? 2.5 : 1.5;
            ctx.beginPath();
            ctx.moveTo(tx + nx * tickLen * 0.5, ty + ny * tickLen * 0.5);
            ctx.lineTo(tx - nx * tickLen * 0.5, ty - ny * tickLen * 0.5);
            ctx.stroke();
          }

          // 6. Crosshair lines (vertical + horizontal) to mark center
          ctx.strokeStyle = `rgba(140, 255, 180, ${ringAlpha * 0.25})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(r.x, footY - healRange * 0.32);
          ctx.lineTo(r.x, footY + healRange * 0.32);
          ctx.moveTo(r.x - healRange * 0.9, footY);
          ctx.lineTo(r.x + healRange * 0.9, footY);
          ctx.stroke();
          break;
        }

        case 'dissipating': {
          // Phase 3: Dissipate (1.0s) - fading ring at feet
          const dissProgress = progress / 1.0; // 1 -> 0 as it fades
          const fadeAlpha = dissProgress;
          const footY = r.y + 12;

          // Fading ring boundary
          ctx.strokeStyle = `rgba(100, 245, 150, ${fadeAlpha * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * 0.9 * fadeAlpha, healRange * 0.32 * fadeAlpha, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Fading inner glow
          const glowGrad = ctx.createRadialGradient(r.x, footY, 0, r.x, footY, healRange * fadeAlpha);
          glowGrad.addColorStop(0, `rgba(90, 220, 130, ${fadeAlpha * 0.08})`);
          glowGrad.addColorStop(1, `rgba(90, 220, 130, 0)`);
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.ellipse(r.x, footY, healRange * fadeAlpha, healRange * 0.35 * fadeAlpha, 0, 0, Math.PI * 2);
          ctx.fill();

          // Shrinking center dot
          ctx.fillStyle = `rgba(140, 255, 190, ${fadeAlpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(r.x, footY, 3 * fadeAlpha, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
    ctx.restore();
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
