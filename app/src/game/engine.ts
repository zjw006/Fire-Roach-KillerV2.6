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
 *   WeatherSystem.renderWeatherBackground() →
 *   BackgroundRenderer.renderFireZones() →
 *   ParticleSystem.renderFireWalls() → renderStickyBoards() →
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

import { GameState, RoachType, RoachState, SceneType, WeatherType, ParticleType, FlameMode, GameMode, type Roach, type Player, type Particle, type FireZone, type FireWall, type Economy, type GameProgress, type WaveConfig, type InventoryItem, type BossBattleState } from './types';
import { AssetLoader, type AssetEntry } from './assets/AssetLoader';
import * as Vibration from './vibration';
import { AudioManager } from './audio';
import { SCENE_CONFIGS, ENEMY_DEFS, TALENT_DEFS, canUpgradeTalent, branchSpentPoints, WEAPON_DROP_DEFS, INVENTORY_SELL_PRICES, BOSS_CONFIG, SCENE_WAVE_CONFIGS, SCENE_REWARD_ITEMS, STORY_LEVELS, getLevelId, getStoryLevelIndex, SCENE_GROUND_BOUNDS, CONSUMABLE_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from './data';
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
import { BossKingSystem } from './engine/boss-king/BossKingSystem';
import { BossKingRenderer } from './engine/boss-king/BossKingRenderer';
import { WaveManager } from './engine/wave/WaveManager';
import { WeatherSystem } from './engine/weather/WeatherSystem';
import { RoachAISystem } from './engine/ai/RoachAISystem';
import { FloatingTextSystem } from './engine/floating-text/FloatingTextSystem';
// import { TrainSystem } from './engine/train/TrainSystem';
import { ShieldSystem } from './engine/shield/ShieldSystem';
import { KnifeSystem } from './engine/knife/KnifeSystem';

// =============================================================================
// 模块级：全局变量
// =============================================================================

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
  floatingTextSystem!: FloatingTextSystem;

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
  /** 星级评价用防线血量（只减不增：受伤同步扣减，修复加血不计入） */
  starDefenseHp: number = 80;
  /** 本次通关的星级评价（0-3，胜利结算时计算） */
  lastStarRating: number = 0;
  /** 本次通关首次三星奖励的天赋点（unlockNextScene 发放，gameVictory 汇总显示后清零） */
  lastVictoryStarBonus: number = 0;
  /** 天赋系统解锁时从待解锁池一次性发放的天赋点（0 = 未发生，供胜利界面弹窗展示） */
  lastTalentUnlockGrant: number = 0;
  /** 本次通关是否为该关卡首次过关（unlockNextScene 在标记前记录；重复过关不发放心增天赋点） */
  lastRunFirstClear: boolean = false;

  difficulty: 'easy' | 'hard' = 'easy';
  gameMode: GameMode = GameMode.STORY;
  currentScene: SceneType = SceneType.KITCHEN;

  audio: AudioManager = new AudioManager();

  /** 电蚊拍系统（委托给 SwatterSystem） */

  time: number = 0;
  deltaTime: number = 0;
  lastTime: number = 0;

  /** 蟑叔发票金币增益剩余时间（秒，>0 时金币收益 +50%） */
  invoiceBoostTimer: number = 0;

  gunImg: HTMLImageElement | null = null;
  /** 三重火焰侧枪贴图（barrel.png 58×109 竖长枪管，仅侧枪渲染用；主枪仍用 gunImg） */
  barrelImg: HTMLImageElement | null = null;
  /** 天赋外观进化：中/高级改装枪身贴图（占位为 gun.png 复制件，美术替换后生效） */
  gunMk1Img: HTMLImageElement | null = null;
  gunMk2Img: HTMLImageElement | null = null;
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
  roachMutantImg: HTMLImageElement | null = null;
  /** 变异变形：7帧序列动画（每帧200ms，共1.4秒） */
  mutantTransformFrames: (HTMLImageElement | null)[] = [];
  /** 地铁场景专属：隧道工蟑螂贴图（地铁精英同样使用该贴图） */
  roachTunnelWorkerImg: HTMLImageElement | null = null;
  roachSubwayEliteImg: HTMLImageElement | null = null;
  roachShieldImg: HTMLImageElement | null = null;
  /** 废弃学校专属：体育生蟑螂贴图（roach_jock.png） */
  roachJockImg: HTMLImageElement | null = null;
  /** 中毒 DEBUFF 图标贴图（debuff_poison.png，紫色像素骷髅） */
  debuffPoisonImg: HTMLImageElement | null = null;
  /** 须须干扰器 DEBUFF 图标贴图（drop_Jammer.png） */
  debuffJammerImg: HTMLImageElement | null = null;
  /** 须须干扰器激活剩余时间（>0 期间：每帧同步影响全部在场/新生蟑螂 + 雷达波特效） */
  jammerActiveTimer: number = 0;
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
  /** 统一资源预加载器（图片清单化 + 场景懒加载） */
  assetLoader: AssetLoader = new AssetLoader();

  /** 调试：是否显示护盾蟑螂的护盾范围框 */
  showShieldRange: boolean = false;

  /** 掉落道具图片缓存 */
  _dropImages: Record<string, HTMLImageElement> | null = null;
  /** 地铁列车序列帧（train_01.png ~ train_08.png），索引 0~7 */
  _trainFrames: (HTMLImageElement | null)[] = [];

  animationId: number = 0;
  onStateChange?: (state: GameState) => void;
  onTutorialPauseChange?: (paused: boolean) => void;
  /** 地铁第1波精英登场教学对话暂停回调 */
  onEliteTutorialPauseChange?: (paused: boolean) => void;
  /** 地铁第4波斩螂·110 教学对话暂停回调 */
  onKnifeTutorialPauseChange?: (paused: boolean) => void;
  onEconomyUpdate?: (economy: Economy) => void;
  onInventoryUpdate?: (inventory: InventoryItem[]) => void;
  onPlayerUpdate?: (player: Player) => void;
  onWaveUpdate?: (wave: number, totalWaves: number) => void;
  onDefenseUpdate?: (hp: number, maxHp: number) => void;
  onPendingRewardUpdate?: (pendingRewards: number) => void;
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
  /** 当前闪电链节点（闪电触发时生成，闪光结束后清空） */
  lightningBolt: { x: number; y: number }[] = [];
  lightningTextCooldown: number = 0;
  /** 地下室/医院波次灯光：当前波次配置索引（-1 = 未触发） */
  flickerWaveIndex: number = -1;
  /** 地下室/医院波次灯光：当前段落索引与段内已进行时间（秒） */
  flickerSegIndex: number = 0;
  flickerSegElapsed: number = 0;
  /** 地下室/医院波次灯光：段首亮度/红光（渐变起点） */
  flickerFromBrightness: number = 1;
  flickerFromRed: number = 0;
  /** 地下室/医院波次灯光：当前综合亮度（1=正常 0=全黑 >1=过冲）与微红强度 0-1 */
  flickerBrightness: number = 1;
  flickerRed: number = 0;
  /** 地下室/医院波次灯光：序列播放中 / 序列结束后的持续微抖（波6） */
  flickerSeqActive: boolean = false;
  flickerJitter: boolean = false;
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
  /** 消耗品系统模块（委托给 ConsumableSystem） */
  private consumableSystem: ConsumableSystem | null = null;
  /** Boss战斗系统模块（委托给 BossBattleSystem） */
  private bossSystem: BossBattleSystem | null = null;
  /** 巢穴·蟑老大 Boss 战系统模块（委托给 BossKingSystem，仅巢穴剧情模式启用） */
  private bossKingSystem: BossKingSystem | null = null;
  /** 蟑老大序列帧表（key = 动作名，仅巢穴场景懒加载） */
  private _bossKingFrames: Map<string, (HTMLImageElement | null)[]> = new Map();
  /** 蟑老大炸弹贴图（assets/boss_bomb.png） */
  private bossBombImg: HTMLImageElement | null = null;
  /** 波次系统模块（委托给 WaveManager） */
  private waveManager: WaveManager | null = null;
  /** 超市阵型组内成员陆续生成队列（位置固定为槽位坐标，仅时间按 formationMemberStaggerSec 错开） */
  private formationSpawnQueue: { type: RoachType; x: number; y: number; delay: number }[] = [];
  /** 地铁场景：列车系统模块（委托给 TrainSystem，自动定时驶过） */
  // private trainSystem: TrainSystem | null = null;
  /** 地铁场景：护盾蟑螂气体护盾系统模块（护盾生命周期 + 矩形区域判定） */
  private shieldSystem: ShieldSystem | null = null;
  /** 斩螂·110 武器模块（委托给 KnifeSystem） */
  private knifeSystem: KnifeSystem | null = null;

  /** Boss 活跃数（委托给 BossBattleSystem） */
  get activeBosses(): number { return this.bossSystem!.activeBosses; }
  set activeBosses(v: number) { this.bossSystem!.activeBosses = v; }

  /** 失败/重新开始保护：防止 gameDefeat() 被多次调用 */
  defeatTriggered: boolean = false;

  /** 关卡内待结算金币（仅在胜利时发放） */
  pendingRewards: number = 0;

  /** 胜利时待动画展示的金币奖励（用于结算界面动画） */
  victoryGoldReward: number = 0;

  /** 厨房第一波教程暂停：阻止生成直到教程完成 */
  get tutorialPauseSpawn(): boolean { return this.waveManager!.tutorialPauseSpawn; }
  set tutorialPauseSpawn(v: boolean) { this.waveManager!.tutorialPauseSpawn = v; }

  /** 地铁第1波精英教学暂停：阻止生成直到对话完成 */
  get eliteTutorialPause(): boolean { return this.waveManager!.eliteTutorialPause; }
  set eliteTutorialPause(v: boolean) { this.waveManager!.eliteTutorialPause = v; }

  /** 地铁第4波斩螂·110 教学暂停：阻止生成直到对话完成 */
  get knifeTutorialPause(): boolean { return this.waveManager!.knifeTutorialPause; }
  set knifeTutorialPause(v: boolean) { this.waveManager!.knifeTutorialPause = v; }

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
  scenesCleared: Set<string> = new Set();

  /** 显示地面边界线（蟑螂可走区域可视化） */
  showMovementRange: boolean = false;

  /** 调试：显示喷火枪攻击范围（束）与辐射范围（火焰粒子区）矩形框及衰减标注。默认隐藏，当前开启用于调试 */
  showFlameDebug: boolean = false;

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
      onSaveProgress: () => { this.saveProgress(); },
      onEconomyUpdate: () => { this.onEconomyUpdate?.(this.economy); },
    });
    this.particleSystem = new ParticleSystem({
      particleLimit: this._particleLimit,
      deltaTime: 0.016,
      defenseLineY: this.defenseLineY(),
      canvasWidth: this.width,
      canvasHeight: this.height,
      damageCallbacks: {
        // 火焰区域伤害：走护甲吸收 + 气体护盾拦截 + 平衡采样（与束伤害口径一致）
        onFireZoneDamage: (roach, damage) => {
          // 体育生空中飞跃免疫火焰直射（火区与火墙均不生效，落地才灼烧）
          if (roach.type === RoachType.JOCK && roach.jumpPhase === 'air') return;
          const protector = ShieldSystem.findProtectingShield(this.roaches, roach);
          if (protector) {
            this.shieldSystem?.damageShield(protector, damage, false);
            return;
          }
          this.applyDamageToRoach(roach, damage);
          this.traceFlameDmg += damage;
        },
        onFireWallDamage: (roach, damage) => {
          if (roach.type === RoachType.JOCK && roach.jumpPhase === 'air') return;
          this.applyDamageToRoach(roach, damage);
        },
      },
    });
    this.floatingTextSystem = new FloatingTextSystem();
    this.collisionSystem = new CollisionSystem({
      difficulty: this.difficulty as 'easy' | 'hard',
      currentScene: this.currentScene,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onSpawnSpark: (x, y, count) => { ParticleSpawner.spawnSparkParticles(this.particles,x, y, count); },
      onPlayBreach: () => { this.audio.playBreach(); },
      onVibrateBreach: () => { Vibration.vibrateBreach(); },
      onVibrateGameOver: () => { Vibration.vibrateGameOver(); },
      onScreenShake: (amount) => { this.screenShake = amount; },
      onSuicideExplode: (r, i) => { this.suicideExplode(r, i); },
      // 地铁护盾：火焰直射拦截查询 + 伤害转移至气体护盾
      onFindProtectingShield: (target) => ShieldSystem.findProtectingShield(this.roaches, target),
      onErodeShield: (shield, amount, showBlockText) => { this.shieldSystem?.damageShield(shield, amount, showBlockText); },
      // 超市模板G同心圆：核心锚点由存活环成员顶替抵挡直射火焰
      onFindFormationProtector: (target) => this.roachAISystem.findFormationProtector(target, this.roaches),
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
        const itemType = drop.type as 'sticky' | 'poison' | 'molotov' | 'shotgun' | 'radar' | 'fan' | 'swatter' | 'knife';
        const existing = this.inventory.find(item => item.type === itemType);
        if (existing) {
          existing.count += pickupCount;
          console.log('[DEBUG pickup]', itemType, 'existing count +=', pickupCount, 'new count=', existing.count, 'inventory=', this.inventory.map(i => `${i.type}:${i.count}`).join(','));
        } else {
          this.inventory.push({ type: itemType, count: pickupCount });
          console.log('[DEBUG pickup]', itemType, 'NEW item count=', pickupCount, 'inventory=', this.inventory.map(i => `${i.type}:${i.count}`).join(','));
        }
        // 浮动文字和屏幕震动
        const def = WEAPON_DROP_DEFS[drop.type];
        if (def) {
          this.addFloatingText(this.player.x, this.player.y - 80, TEXT_CONFIG.combat.weaponPickup.text(def.name, bonusText), TEXT_CONFIG.combat.weaponPickup.color);
        }
        this.screenShake = BALANCE_CONFIG.screenShake.weaponHit;
      },
      // 拾取前置检查（预留给场景专属道具的拾取限制，如拾取上限）
      canPickup: (_drop) => {
        return true;
      },
      onSwitchWeapon: (_weapon, weaponName) => {
        this.addFloatingText(this.player.x, this.player.y - 60, TEXT_CONFIG.combat.weaponSwitch.text(weaponName), TEXT_CONFIG.combat.weaponSwitch.color);
      },
    });
    // ===== 地铁场景：列车系统（自动定时驶过） =====
    // this.trainSystem = new TrainSystem({
    //   getCurrentScene: () => this.currentScene,
    //   getGameState: () => this.state,
    //   getCanvasWidth: () => this.width,
    //   getDefenseLineY: () => this.defenseLineY(),
    //   onTrainKill: (roach) => { this.killRoach(roach, this.roaches.indexOf(roach)); },
    //   onAddFloatingText: (x, y, text, color, duration?) => { this.addFloatingText(x, y, text, color, duration); },
    //   onAddParticle: (p) => { this.particles.push(p); },
    //   onScreenShake: (amount) => { this.screenShake = amount; },
    //   onPlaySound: (name) => {
    //     if (name === 'train') this.audio.playTrainSfx();
    //     else if (name === 'trainStop') this.audio.stopTrainSfx();
    //   },
    // });
    // ===== 地铁场景：护盾蟑螂气体护盾系统 =====
    this.shieldSystem = new ShieldSystem({
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onSpawnSpark: (x, y, count) => { ParticleSpawner.spawnSparkParticles(this.particles, x, y, count); },
      onShieldBreak: (bandX, bandY) => {
        ParticleSpawner.spawnShieldBreakParticles(this.particles, bandX, bandY);
        this.audio.playShieldBreak();
      },
    });
    // ===== 斩螂·110 武器系统 =====
    this.knifeSystem = new KnifeSystem({
      getCanvasWidth: () => this.width,
      getDefenseLineY: () => this.defenseLineY(),
      getBounceBonus: () => this.talentMultipliers.knifeBounceAdd || 0,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onAddParticle: (p) => { this.particles.push(p); },
      onScreenShake: (amount) => { this.screenShake = amount; },
      onPlaySound: () => { this.audio.playKnife(); },
      onVibrate: () => { Vibration.vibrateItemUse(); },
      onKillRoach: (roach) => { this.killRoach(roach, this.roaches.indexOf(roach)); },
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
      getCanvasWidth: () => this.width,
      getCanvasHeight: () => this.height,
      getDefenseLineY: () => this.defenseLineY(),
      getPerspectiveScaleMin: () => {
        // 风扇透视远端缩放 = 场景地面阻挡梯形远边宽 / 近边宽（与各地面透视一致）
        const b = SCENE_GROUND_BOUNDS[this.currentScene];
        const farWidth = b[2] - b[0];
        const nearWidth = b[9] - b[8];
        return nearWidth > 0 ? farWidth / nearWidth : 1;
      },
      talentMultipliers: this.talentMultipliers,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onStartFanLoop: () => { this.audio.startFanLoop(); },
      onStopFanLoop: () => { this.audio.stopFanLoop(); },
      onScreenShake: (amount) => { this.screenShake = amount; },
    });
    this.tripleFlameSystem = new TripleFlameSystem({
      canvasWidth: this.width,
      canvasHeight: this.height,
      talentMultipliers: this.talentMultipliers,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onPlayShotgunActivate: () => { this.audio.playShotgunActivate(); },
      onVibrateItemUse: () => { Vibration.vibrateItemUse(); },
    });
    this.radarLaserSystem = new RadarLaserSystem({
      canvasWidth: this.width,
      canvasHeight: this.height,
      talentMultipliers: this.talentMultipliers,
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
      talentMultipliers: this.talentMultipliers,
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
        else if (soundName === 'sticky_throw') { this.audio.playStickyThrow(); }
        else if (soundName === 'poison_throw') { this.audio.playPoisonThrow(); }
      },
      getNextThrowableId: () => nextId++,
      getCanvasWidth: () => this.width,
      getDefenseLineY: () => this.defenseLineY(),
    });
    this.insecticideSystem = new InsecticideSystem({
      talentMultipliers: this.talentMultipliers,
      onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
      onPlaySound: (soundName) => {
        if (soundName === 'insecticide_spray') { this.audio.playInsecticideSpray(); }
      },
      onVibrate: () => { Vibration.vibrateItemUse(); },
      onScreenShake: (amount) => { this.screenShake = amount; },
    });
    this.throwableSystem = new ThrowableSystem({
      talentMultipliers: this.talentMultipliers,
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
      onSpawnPoisonExplosion: (x, y) => { PoisonSystem.spawnPoisonExplosion(this.particles, x, y); },
      onScreenShake: (amount) => { this.screenShake = amount; },
      // 统一伤害/效果入口，避免投掷物系统直接修改蟑螂状态
      onApplyDamageToRoach: (r, damage) => { r.hp -= damage; },
      onApplyStickyToRoach: (r, stuckTimer, speedRatio) => {
        r.stuckTimer = stuckTimer;
        r.speed = r.baseSpeed * speedRatio;
      },
      onApplyPoisonToRoach: (r, poisonTimer, poisonDamage, initialDamage) => {
        r.poisonTimer = poisonTimer;
        r.poisonDamage = poisonDamage;
        r.hp -= initialDamage;
      },
      onApplyBurnToRoach: (r, damage, burnDamage) => {
        r.hp -= damage;
        r.burnDamage = burnDamage;
      },
      onShowArmorImmune: (r) => {
        this.addFloatingText(r.x, r.y - 15, TEXT_CONFIG.combat.armorImmune.text, TEXT_CONFIG.combat.armorImmune.color);
      },
    });
    this.consumableSystem = new ConsumableSystem({
      consumableDefs: CONSUMABLE_DEFS,
      talentMultipliers: this.talentMultipliers,
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
      setDefenseHp: (hp) => {
        // 星级评价血量只减不增：掉血同步扣减，修复加血不计入
        if (hp < this.defenseHp) this.starDefenseHp = Math.max(0, this.starDefenseHp - (this.defenseHp - hp));
        this.defenseHp = hp;
      },
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
        onGetLivingNonBossCount: () => this.roaches.filter(r => r.state === RoachState.ALIVE && !r.isBoss).length,
      },
      this.bossAnimFrames,
      () => nextBossId++, // 修复 P0：注入 ID 生成器，消除全局计数器
    );

    // ===== 初始化 BossKingSystem（巢穴·蟑老大 Boss 战，2026-08-24 锁定设计） =====
    this.bossKingSystem = new BossKingSystem(
      {
        onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
        onSpawnExplosionParticles: (x, y, count) => { ParticleSpawner.spawnExplosionParticles(this.particles, x, y, count); },
        onSpawnShockwaveRing: (x, y, radius) => { ParticleSpawner.spawnShockwaveRing(this.particles, x, y, radius); },
        onScreenShake: (intensity) => { this.screenShake = intensity; },
        onDamageRoach: (roach, damage) => { this.applyDamageToRoach(roach, damage); },
        onSpawnRoach: (type) => { this.spawnRoach(type); },
        onGetRoaches: () => this.roaches,
        onDamageDefense: (damage) => {
          if (this.player.shieldTimer > 0) {
            this.addFloatingText(this.width / 2, this.defenseLineY() - 20, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
            return;
          }
          this.defenseHp -= damage;
          this.starDefenseHp = Math.max(0, this.starDefenseHp - damage);
        },
        onVictory: () => {
          // 与 WaveManager.checkVictory 对齐：先标记通关/星级/解锁/最高波，再进胜利结算
          const nestWaves = SCENE_WAVE_CONFIGS[SceneType.NEST]?.length ?? 6;
          this.economy.highestWave = nestWaves;
          this.progress.highestWave = Math.max(this.progress.highestWave, nestWaves);
          this.unlockNextScene();
          this.gameVictory();
        },
        onDefeat: () => { this.gameDefeat(); },
        // 蟑老大入场动画完成 → 此时才生成第 1 波（Boss 入场先于战斗波次）
        onEntranceComplete: () => { this.waveManager?.doWaveSpawn(); },
      },
      {
        playBossKingWarn: () => { this.audio.playBossKingWarn(); },
        playBossKingThrow: () => { this.audio.playBossKingThrow(); },
        playBossKingAirburst: () => { this.audio.playBossKingAirburst(); },
        playBossKingGroundBurst: () => { this.audio.playBossKingGroundBurst(); },
        playBossKingGooSplat: () => { this.audio.playBossKingGooSplat(); },
        playBossKingWind: () => { this.audio.playBossKingWind(); },
        playBossKingPurge: () => { this.audio.playBossKingPurge(); },
      },
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
      setDefenseHp: (hp) => {
        // 星级评价血量只减不增：掉血同步扣减，修复加血不计入
        if (hp < this.defenseHp) this.starDefenseHp = Math.max(0, this.starDefenseHp - (this.defenseHp - hp));
        this.defenseHp = hp;
      },
      setEconomy: (e) => { this.economy = e; },
      setHospitalBreaches: (count) => { this.hospitalBreaches = count; },
      onAddFloatingText: (x, y, text, color, duration?) => { this.addFloatingText(x, y, text, color, duration); },
      onSpawnRoach: (type, clusterId?) => this.spawnRoach(type, clusterId),
      onApplyDamageToRoach: (r, damage) => { this.applyDamageToRoach(r, damage); },
      onTraceBurnDamage: (dmg) => { this.traceFlameDmg += dmg; },
      onSaveProgress: () => { this.saveProgress(); },
      onGameOver: (economy, wave) => { this.onGameOver?.(economy, wave); },
      onStateChange: (state) => { this.onStateChange?.(state); },
      onEconomyUpdate: (economy) => { this.onEconomyUpdate?.(economy); },
      onDefenseUpdate: (hp, maxHp) => { this.onDefenseUpdate?.(hp, maxHp); },
      onBossUpdate: (bossState) => { this.onBossUpdate?.(bossState); },
      onGameVictory: () => { this.gameVictory(); },
      onSellUnusedInventory: () => this.sellUnusedInventory(),
      onUnlockNextScene: () => this.unlockNextScene(),
      onAddPendingReward: (amount) => { this.pendingRewards += amount; this.onPendingRewardUpdate?.(this.pendingRewards); },
      getNextId: () => nextId++, // 修复 P0：注入 ID 生成器，消除全局计数器冲突
    });

    // ===== 初始化 WaveManager =====
    this.waveManager = new WaveManager(
      {
        width: this.width, height: this.height, difficulty: this.difficulty as string,
        gameMode: this.gameMode, currentScene: this.currentScene,
      },
      {
        onSpawnRoach: (type, clusterId, x, y) => { this.spawnRoach(type, clusterId, x, y); },
        // 超市阵型（V5.0 直驱制串行出场）：波开始清空残余实例；热场队列清空后首组出场，
        // 上一组被消灭后才出下一组；组内成员按 formationMemberStaggerSec 陆续生成（位置固定）
        onClearFormations: () => { this.roachAISystem.clearFormations(); this.formationSpawnQueue = []; },
        onSpawnFormationGroup: (group) => {
          const entries = this.roachAISystem.addFormationGroup(group);
          if (!entries) return;
          const step = BALANCE_CONFIG.supermarket.formationMemberStaggerSec;
          entries.forEach((e, i) => this.formationSpawnQueue.push({ type: e.type, x: e.x, y: e.y, delay: i * step }));
        },
        hasActiveFormations: () => this.roachAISystem.hasActiveFormations(),
        onGetGroundBoundsAtY: (y) => this.getGroundBoundsAtY(y),
        onAddFloatingText: (x, y, text, color) => { this.addFloatingText(x, y, text, color); },
        onStateChange: (state) => { this.state = state; this.onStateChange?.(state); },
        onGameVictory: () => { this.gameVictory(); },
        onSaveProgress: () => { this.saveProgress(); },
        onUnlockNextScene: () => { this.unlockNextScene(); },
        onPlayBGM: () => { this.audio.startLevelBGM(); },
        onTutorialPauseChange: (paused) => { this.onTutorialPauseChange?.(paused); },
        onEliteTutorialPauseChange: (paused) => { this.onEliteTutorialPauseChange?.(paused); },
        onKnifeTutorialPauseChange: (paused) => { this.onKnifeTutorialPauseChange?.(paused); },
        onWaveStart: (wave) => { this.startWaveFlicker(wave); /* this.trainSystem?.onWaveStart(wave); */ },
        onWaveCleared: () => { /* this.trainSystem?.onWaveCleared(); */ },
        onKillRoach: (roach, idx) => { this.killRoach(roach, idx); },
        onGetRoaches: () => this.roaches,
        onKillAllNurseRoaches: () => {
          // 医院专属：通过回调统一处理护士蟑螂清除，避免波次管理器直接修改HP
          const roaches = this.roaches;
          for (let i = roaches.length - 1; i >= 0; i--) {
            const r = roaches[i];
            if (r.type === RoachType.NURSE && r.state === 'alive') {
              r.hp = 0;
              this.killRoach(r, i);
            }
          }
        },
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

  /** 根据 game-container 容器调整画布大小与 DPR
   *  @description Fixed Height 模式：高度固定 960，宽度随设备宽高比动态变化。
   *  窄屏设备（手机）：画布填满屏幕，游戏区域等比缩窄。
   *  宽屏设备（桌面）：游戏区域限制最大 540 宽，画布居中，两侧留黑。
   *  相比 Fixed Width 模式，此模式在竖屏手机上视觉效果更一致。
   */
  resize() {
    // 优先使用 #game-container（全屏容器），确保画布填满屏幕高度
    const container = document.getElementById('game-container') || this.canvas.parentElement;
    if (!container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    // Fixed Height 模式：高度固定 960，缩放比例由高度决定
    const scale = rect.height / 960;
    // 逻辑坐标：高度固定 960，宽度最大 540（设计分辨率），窄屏等比缩窄
    const rawWidth = rect.width / scale;
    this.width = Math.min(rawWidth, 540);
    this.height = 960;
    // 画布 CSS 尺寸：高度填满屏幕，宽度按游戏区域比例
    const displayWidth = this.width * scale;
    const displayHeight = rect.height;
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    this.canvas.width = Math.floor(displayWidth * dpr);
    this.canvas.height = Math.floor(displayHeight * dpr);
    this.scale = this.canvas.width / this.width;
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

  // ===== 生命周期方法：加载、存档、创建 =====

  /** 异步加载所有游戏图片资源（清单化 + 场景懒加载） */
  loadImages() {
    const entries: AssetEntry[] = [];
    // global 资源（首屏 critical，scenes 缺省）
    const img = (key: string, url: string, apply: (i: HTMLImageElement) => void) =>
      entries.push({ key, url, apply });

    img('gunImg', '/assets/gun.png', (i) => this.gunImg = i);
    img('barrelImg', BALANCE_CONFIG.tripleFlame.sideBarrelTexture, (i) => this.barrelImg = i);
    // 天赋改装枪身贴图（加载失败回退默认枪贴图，见 renderPlayer）
    img('gunMk1Img', '/assets/gun_mk1.png', (i) => this.gunMk1Img = i);
    img('gunMk2Img', '/assets/gun_mk2.png', (i) => this.gunMk2Img = i);
    img('roachImg', '/assets/roach.png', (i) => this.roachImg = i);
    img('bgImg', '/assets/bg_kitchen_easy.jpg', (i) => this.bgImg = i);
    img('roachSuicideImg', '/assets/roach_suicide.png', (i) => this.roachSuicideImg = i);
    img('roachTimedSuicideImg', '/assets/roach_timed_suicide.png', (i) => this.roachTimedSuicideImg = i);
    img('roachFlyingImg', '/assets/roach_flying.png', (i) => this.roachFlyingImg = i);
    img('roachFlyingSuicideImg', '/assets/roach_flying_suicide.png', (i) => this.roachFlyingSuicideImg = i);
    img('roachArmoredImg', '/assets/roach_armored.png', (i) => this.roachArmoredImg = i);
    img('roachSplittingImg', '/assets/roach_splitting.png', (i) => this.roachSplittingImg = i);
    img('roachQueenImg', '/assets/roach_queen.png', (i) => this.roachQueenImg = i);
    img('roachNurseImg', '/assets/roach_nurse.png', (i) => this.roachNurseImg = i);
    img('roachMutantImg', '/assets/roach_mutant.png', (i) => this.roachMutantImg = i);
    img('roachTunnelWorkerImg', '/assets/roach_tunnel_worker.png', (i) => this.roachTunnelWorkerImg = i);
    img('roachSubwayEliteImg', '/assets/roach_subway_elite.png', (i) => this.roachSubwayEliteImg = i);
    img('roachShieldImg', '/assets/roach_shield01.png', (i) => this.roachShieldImg = i);
    img('roachJockImg', '/assets/roach_jock.png', (i) => this.roachJockImg = i);
    img('debuffPoisonImg', '/assets/UI/debuff_poison.png', (i) => this.debuffPoisonImg = i);
    img('debuffJammerImg', '/assets/drop_Jammer.png', (i) => this.debuffJammerImg = i);
    img('bombImg', '/assets/bomb.png', (i) => this.bombImg = i);

    // 变异变形序列 7 帧
    for (let i = 1; i <= 7; i++) {
      const frameIdx = i - 1;
      img(`mutantTransform_${frameIdx}`, `/assets/mutant_0${i}.png`, (im) => this.mutantTransformFrames[frameIdx] = im);
    }

    // Boss 动画帧（仅加载磁盘上存在的帧，缺失动作回退 idle）
    const actionsWithFrames: Record<string, number> = { idle: 7, hover: 3 };
    for (const [action, frameCount] of Object.entries(actionsWithFrames)) {
      this.bossAnimFrames.set(action, []);
      for (let i = 1; i <= frameCount; i++) {
        const idx = i;
        img(`boss_${action}_${idx}`, `/boss/${action}/${action}_0${i}.png`, (im) => {
          const frames = this.bossAnimFrames.get(action);
          if (frames) frames[idx - 1] = im;
        });
      }
    }
    // 为缺失动作设置空数组（渲染器回退 idle）
    const fallbackActions = ['walk','charge','summon','defend','hit','hurt','die','roar','mock','transform'];
    for (const action of fallbackActions) {
      this.bossAnimFrames.set(action, []);
    }

    // 掉落道具图片（renderWeaponDrops / renderItemDropOnField）
    this._dropImages = {};
    const dropImgDefs: [string, string][] = [
      ['/assets/drop_sticky.png', 'sticky'],
      ['/assets/drop_poison.png', 'poison'],
      ['/assets/drop_molotov.png', 'molotov'],
      ['/assets/drop_shotgun.png', 'shotgun'],
      ['/assets/drop_radar.png', 'radar'],
      ['/assets/drop_fan.png', 'fan'],
      ['/assets/drop_swatter.png', 'swatter'],
      ['/assets/drop_knife.png', 'knife'],
      ['/assets/drop__invoice.png', 'invoice'],
      ['/assets/drop_Jammer.png', 'jammer'],
    ];
    for (const [src, type] of dropImgDefs) {
      img(`drop_${type}`, src, (im) => { if (this._dropImages) this._dropImages[type] = im; });
    }

    // ===== scene 懒加载资源（体积大，进入对应场景前预载） =====
    // 旧场景背景大图（easy/hard），按场景归属
    entries.push({ key: 'bgKitchenHardImg', url: '/assets/bg_kitchen_hard.jpg?v=3', scenes: [SceneType.KITCHEN], apply: (i) => this.bgKitchenHardImg = i });
    entries.push({ key: 'bgKitchenEasyImg', url: '/assets/bg_kitchen_easy.jpg?v=5', scenes: [SceneType.KITCHEN], apply: (i) => this.bgKitchenEasyImg = i });
    entries.push({ key: 'bgSewerImg', url: '/assets/sewer_bg_easy.jpg', scenes: [SceneType.SEWER], apply: (i) => this.bgSewerImg = i });
    entries.push({ key: 'bgSewerEasyImg', url: '/assets/sewer_bg_easy.jpg?v=3', scenes: [SceneType.SEWER], apply: (i) => this.bgSewerEasyImg = i });
    entries.push({ key: 'bgSewerHardImg', url: '/assets/sewer_bg_hard.png?v=5', scenes: [SceneType.SEWER], apply: (i) => this.bgSewerHardImg = i });
    entries.push({ key: 'bgDumpImg', url: '/assets/bg_dump_easy.jpg', scenes: [SceneType.DUMP], apply: (i) => this.bgDumpImg = i });
    entries.push({ key: 'bgDumpEasyImg', url: '/assets/bg_dump_easy.jpg?v=4', scenes: [SceneType.DUMP], apply: (i) => this.bgDumpEasyImg = i });
    entries.push({ key: 'bgDumpHardImg', url: '/assets/bg_dump_hard.jpg?v=5', scenes: [SceneType.DUMP], apply: (i) => this.bgDumpHardImg = i });
    entries.push({ key: 'bgBasementImg', url: '/assets/bg_basement_easy.jpg', scenes: [SceneType.BASEMENT], apply: (i) => this.bgBasementImg = i });
    entries.push({ key: 'bgBasementEasyImg', url: '/assets/bg_basement_easy.jpg?v=3', scenes: [SceneType.BASEMENT], apply: (i) => this.bgBasementEasyImg = i });
    entries.push({ key: 'bgBasementHardImg', url: '/assets/bg_basement_hard.jpg?v=5', scenes: [SceneType.BASEMENT], apply: (i) => this.bgBasementHardImg = i });
    entries.push({ key: 'bgRooftopImg', url: '/assets/bg_rooftop_easy.jpg', scenes: [SceneType.ROOFTOP], apply: (i) => this.bgRooftopImg = i });
    entries.push({ key: 'bgRooftopEasyImg', url: '/assets/bg_rooftop_easy.jpg?v=4', scenes: [SceneType.ROOFTOP], apply: (i) => this.bgRooftopEasyImg = i });
    entries.push({ key: 'bgRooftopHardImg', url: '/assets/bg_rooftop_hard.jpg?v=5', scenes: [SceneType.ROOFTOP], apply: (i) => this.bgRooftopHardImg = i });
    entries.push({ key: 'bgStreetImg', url: '/assets/bg_street_easy.jpg', scenes: [SceneType.STREET], apply: (i) => this.bgStreetImg = i });
    entries.push({ key: 'bgStreetEasyImg', url: '/assets/bg_street_easy.jpg?v=6', scenes: [SceneType.STREET], apply: (i) => this.bgStreetEasyImg = i });
    entries.push({ key: 'bgStreetHardImg', url: '/assets/bg_street_hard.jpg?v=6', scenes: [SceneType.STREET], apply: (i) => this.bgStreetHardImg = i });

    // 新场景背景图（SCENE_CONFIGS.bgImage，hospital/subway/supermarket/school/nest）
    for (const [sceneType, config] of Object.entries(SCENE_CONFIGS)) {
      if (config.bgImage) {
        const sc = sceneType as SceneType;
        entries.push({ key: `bgScene_${sceneType}`, url: config.bgImage, scenes: [sc], apply: (i) => this.bgSceneImages[sceneType] = i });
      }
    }

    // 地铁列车序列帧（train_01.png ~ train_08.png，仅地铁场景）
    this._trainFrames = new Array(BALANCE_CONFIG.train.trainFrameCount).fill(null);
    for (let fi = 0; fi < BALANCE_CONFIG.train.trainFrameCount; fi++) {
      const frameNum = String(fi + 1).padStart(2, '0');
      entries.push({ key: `trainFrame_${fi}`, url: `/assets/train_${frameNum}.png`, scenes: [SceneType.SUBWAY], apply: (i) => this._trainFrames[fi] = i });
    }

    // 巢穴·蟑老大 Boss 序列帧（public/boss/<action>/bk_<action>_NN.png，仅巢穴场景）
    const bossKingActionFrames: readonly (readonly [string, number])[] = [
      ['enter', 5], ['hover', 5], ['purge', 3], ['wind', 4], ['bomb_warn', 3], ['bomb_throw', 2], ['hit', 2], ['exit', 4],
    ];
    for (const [action, frameCount] of bossKingActionFrames) {
      const frames = new Array<HTMLImageElement | null>(frameCount).fill(null);
      this._bossKingFrames.set(action, frames);
      for (let fi = 0; fi < frameCount; fi++) {
        const frameNum = String(fi + 1).padStart(2, '0');
        entries.push({ key: `bossKing_${action}_${frameNum}`, url: `/boss/${action}/bk_${action}_${frameNum}.png`, scenes: [SceneType.NEST], apply: (i) => { frames[fi] = i; } });
      }
    }
    // 蟑老大炸弹贴图
    entries.push({ key: 'bossBombImg', url: '/assets/boss_bomb.png', scenes: [SceneType.NEST], apply: (i) => { this.bossBombImg = i; } });

    // 注册清单；先加载 global（首屏关键资源），完成后置 imagesLoaded
    this.assetLoader.register(entries);
    this.assetLoader.loadGlobal().then(() => {
      this.imagesLoaded = true;
    });
  }

  /** 懒加载指定场景的专属资源（后台预加载，幂等，供切场景时调用） */
  preloadScene(scene: SceneType): void {
    this.assetLoader.loadScene(scene).catch(() => { /* 失败不阻塞，渲染侧走回退 */ });
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
    const fireRange = BALANCE_CONFIG.player.baseFireRange * rangeMult;
    // 扩口喷嘴/风压聚焦只加伤害射程，不拉长火焰视觉（改由喷嘴白环/风压波纹表现），从视觉射程中剔除其贡献
    const talents = this.progress.talentTree.talents;
    const noLenMult = (['nozzle', 'focus'] as const).reduce((m, id) => {
      const lv = talents[id] || 0;
      const def = TALENT_DEFS.find(t => t.id === id);
      return lv > 0 && def ? m * (def.effect(lv).fireRangeMultiplier || 1) : m;
    }, 1);
    const flameVisualRange = fireRange / noLenMult;
    const damageMultiplier = this.talentMultipliers.damageMultiplier || 1;
    const heatDecayRate = (isHard ? BALANCE_CONFIG.player.heatDecayRate.hard : BALANCE_CONFIG.player.heatDecayRate.easy) * coolMult;
    const overheatThreshold = BALANCE_CONFIG.player.baseOverheatThreshold * ohMult;
    const maxGas = BALANCE_CONFIG.player.baseGasCapacity * gasMult;
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
      maxReloadTime: (isHard ? BALANCE_CONFIG.player.maxReloadTime.hard : BALANCE_CONFIG.player.maxReloadTime.easy) * reloadTimeMultiplier,
      coolingTimer: 0,
      fireRange,
      flameVisualRange,
      damageMultiplier,
      heatDecayRate,
      overheatThreshold,
      gasCostMultiplier: 1,
      currentWeapon: 'flamethrower',
      weaponAmmo: { flamethrower: Infinity },
      weaponTimer: 0,
      isTempWeapon: false,
      shotgunPellets: BALANCE_CONFIG.player.shotgunPellets,
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
    // 同步未领取成就金币到存档
    this.progress.unclaimedRewards = this.achievementSystem
      ? [...this.achievementSystem.getUnclaimedAchievements().map(a => a.id)]
      : [];
    SaveSystem.saveProgress(this.progress);
  }

  /** 重新计算天赋倍数（委托给 EconomyManager 模块） */
  recalcTalentMultipliers() {
    this.talentMultipliers = EconomyManager.calculateTalentMultipliers(this.progress);
    // 同步天赋倍数到所有消费系统
    this.weaponSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.fanSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.tripleFlameSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.radarLaserSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.swatterSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.insecticideSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.throwableSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.consumableSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
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
    // 切入场景即触发专属资源后台预加载（幂等，进战斗时基本已就绪）
    this.preloadScene(this.currentScene);
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
    // 同步天赋倍数到所有消费系统（start 时 talentMultipliers 已重算）
    this.fanSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.tripleFlameSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.radarLaserSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.swatterSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.insecticideSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.throwableSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
    this.consumableSystem?.updateConfig({ talentMultipliers: this.talentMultipliers });
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

  // ===== 战斗数据采样（平衡分析用，0.5s 粒度） =====
  private traceSamples: { t: number; wave: number; hp: number; armor: number; shield: number; flameDmg: number; spawnHp: number; firing: number }[] = [];
  private traceTime = 0;
  private traceTimer = 0;
  private traceFlameDmg = 0;
  private traceSpawnHp = 0;

  /** 每 0.5 秒采样一次在屏血量/护甲/护盾与累计输出（仅 PLAYING 状态） */
  private updateTrace() {
    if (this.state !== GameState.PLAYING) return;
    this.traceTime += this.deltaTime;
    this.traceTimer += this.deltaTime;
    if (this.traceTimer < 0.5) return;
    this.traceTimer -= 0.5;
    let hp = 0, armor = 0, shield = 0;
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      hp += Math.max(0, r.hp);
      armor += Math.max(0, r.armorHp || 0);
      shield += Math.max(0, r.shieldHp || 0);
    }
    this.traceSamples.push({
      t: +this.traceTime.toFixed(2),
      wave: this.wave,
      hp: Math.round(hp),
      armor: Math.round(armor),
      shield: Math.round(shield),
      flameDmg: Math.round(this.traceFlameDmg),
      spawnHp: Math.round(this.traceSpawnHp),
      firing: this.player.isFiring ? 1 : 0,
    });
  }

  /** 对局结束时导出采样数据（自动下载 JSON + localStorage 备份） */
  private exportTrace(result: 'victory' | 'defeat') {
    if (this.traceSamples.length === 0) return;
    const data = {
      scene: this.currentScene,
      difficulty: this.difficulty,
      result,
      duration: +this.traceTime.toFixed(1),
      interval: 0.5,
      samples: this.traceSamples,
    };
    const json = JSON.stringify(data);
    try { localStorage.setItem('roach_trace_last', json); } catch { /* 存储失败忽略 */ }
    // 只在自动测试时才下载 JSON 文件（避免玩家正常游戏时弹出下载）
    const isAuto = (window as any).__isAutoTest === true;
    console.log('[trace] exportTrace result=%s scene=%s __isAutoTest=%s', result, this.currentScene, isAuto);
    if (isAuto) {
      try {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roach-trace-${this.currentScene}-${result}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch { /* 下载失败忽略 */ }
    }
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
    this.floatingTextSystem.reset();
    this.weaponSystem?.reset();
    this.selectedItems = []; // Clear player-selected items
    this.armorShieldCache.clear();
    this.armorShieldCacheTimer = 0;
    this.hospitalBreaches = 0;
    this.hospitalStarRating = 0;
    this.placedBombs = [];
    this.deadTimedBombs = [];
    this.timedSuicideSpawnTimer = 0;
    this.timedSuicideSpawnRemaining = 0;
    // 重置战斗数据采样
    this.traceSamples = [];
    this.traceTime = 0;
    this.traceTimer = 0;
    this.traceFlameDmg = 0;
    this.traceSpawnHp = 0;
    this.consumableSystem?.reset();
    this.roachAISystem?.reset();
    this.bossKingSystem?.reset(); // 巢穴·蟑老大 Boss 战状态复位（防跨局泄漏）
    this.formationSpawnQueue = []; // 清空阵型陆续生成队列，防重开时旧波残队生成进新局
    // Sync new array references after resetGame() creates new arrays
    this.roachAISystem?.updateConfig({
      roaches: this.roaches,
      particles: this.particles,
      fireWalls: this.fireWalls,
      armorShieldCache: this.armorShieldCache,
      placedBombs: this.placedBombs,      // 必须同步 placedBombs 引用，否则医院关卡的炸弹安放不可见
      deadTimedBombs: this.deadTimedBombs, // 必须同步 deadTimedBombs 引用，否则定时自爆蟑螂的尸体炸弹不可见
      economy: this.economy, // 必须同步 economy 引用，否则击杀奖励加到旧对象上
      player: this.player,  // 必须同步 player 引用，否则 baitTimer/shieldTimer 等从旧对象读取
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
      loopWaves: this.isBossKingScene(), // 巢穴 Boss 战：波次循环出怪，胜利由 Boss 死亡触发
    });
    this.waveTimer = 1;
    this.bossSystem!.activeBosses = 0;
    this.defeatTriggered = false;
    this.pendingRewards = 0;
    this.victoryGoldReward = 0;
    this.onPendingRewardUpdate?.(0);
    this.tutorialPauseSpawn = false;
    this.eliteTutorialPause = false;
    this.knifeTutorialPause = false;
    this.throwableSystem?.reset();
    this.aimingSystem?.reset();
    this.inventory = [];
    this.selectedItemIndex = -1;
    this.itemPlaceState = 'idle';
    this.tripleFlameSystem?.reset();
    this.radarLaserSystem?.reset();
    this.swatterSystem?.reset();
    this.insecticideSystem?.reset();
    // this.trainSystem?.reset();
    this.shieldSystem?.reset();
    this.knifeSystem?.reset();
    this.invoiceBoostTimer = 0;
    const defMult = this.talentMultipliers.defenseMultiplier || 1;
    // 超市 V4.0：阵型+穿插全程持续施压、无波间修复，防线总池按场景系数上浮
    const sceneDefMult = this.currentScene === SceneType.SUPERMARKET ? BALANCE_CONFIG.supermarket.defenseHpMult : 1;
    this.defenseHp = Math.round(BALANCE_CONFIG.defense.baseHp * defMult * sceneDefMult);
    this.maxDefenseHp = this.defenseHp;
    this.starDefenseHp = this.defenseHp;
    this.lastStarRating = 0;
    this.lastVictoryStarBonus = 0;
    this.lastTalentUnlockGrant = 0;
    this.time = 0;
    this.screenShake = 0;
    this.lightningTimer = 0;
    this.lightningFlash = 0;
    this.lightningBolt = [];
    this.lightningTextCooldown = 0;
    // 波次灯光序列状态复位（亮度回正常，等待下一波 doWaveSpawn 触发）
    this.flickerWaveIndex = -1;
    this.flickerSegIndex = 0;
    this.flickerSegElapsed = 0;
    this.flickerFromBrightness = 1;
    this.flickerFromRed = 0;
    this.flickerBrightness = 1;
    this.flickerRed = 0;
    this.flickerSeqActive = false;
    this.flickerJitter = false;
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
    this.pendingRewards = 0;
    this.victoryGoldReward = 0;
    this.onPendingRewardUpdate?.(0);
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
        // < 30fps: low-end device
        this._particleLimit = BALANCE_CONFIG.performance.particleLimit.low;
        this._isLowPerfDevice = true;
      } else if (avgFrameTime > 0.025) {
        // < 40fps: mid-low device
        this._particleLimit = BALANCE_CONFIG.performance.particleLimit.medium;
        this._isLowPerfDevice = true;
      } else if (avgFrameTime > 0.02) {
        // < 50fps: mid device
        this._particleLimit = BALANCE_CONFIG.performance.particleLimit.high;
      } else {
        // 50+ fps: high-end device
        this._particleLimit = BALANCE_CONFIG.performance.particleLimit.desktop;
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
    const phaseNames = TEXT_CONFIG.combat.bossPhaseNames.text;
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
    for (let i = 0; i < config.count; i++) {
      // Wave egg release: count display only, actual spawning handled by WaveManager
    }

    this.addFloatingText(this.width / 2, this.height / 3, TEXT_CONFIG.combat.waveEggRelease.text(wave), TEXT_CONFIG.combat.waveEggRelease.color);
    this.addFloatingText(this.width / 2, this.height / 3 + 25, TEXT_CONFIG.combat.eggHatchPending.text(config.count), TEXT_CONFIG.combat.eggHatchPending.color);
    this.screenShake = BALANCE_CONFIG.screenShake.largeExplosion;
  }

  updateEggPods() {
    // Egg pod system removed — no-op
  }

  // 电蚊拍拾取（委托给 SwatterSystem 模块）
  spawnSwatterPickup(x: number, y: number) {
    const newInventory = this.swatterSystem!.spawnSwatterPickup(x, y, this.inventory);
    this.inventory = newInventory;
    this.onInventoryUpdate?.(this.inventory);
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

  /** 结算界面动画完成后调用 — 将关卡内金币奖励发放到经济系统 */
  settleVictoryGold() {
    if (this.victoryGoldReward > 0) {
      this.economy.money += this.victoryGoldReward;
      this.economy.totalMoneyEarned += this.victoryGoldReward;
      this.victoryGoldReward = 0;
      this.onEconomyUpdate?.(this.economy);
    }
  }

  /** 获取待播放动画的新解锁成就列表（成就界面打开时调用） */
  getAchievementPendingAnimations() {
    return this.achievementSystem?.getPendingAnimations() ?? [];
  }

  /** 标记某个成就的解锁动画已播放 */
  markAchievementAnimationPlayed(id: string) {
    this.achievementSystem?.markAnimationPlayed(id);
  }

  /** 清除所有待播放成就动画标记（成就界面关闭时调用） */
  clearAchievementAnimations() {
    this.achievementSystem?.clearAnimationQueue();
  }

  /** 领取单个成就的金币奖励（成就界面动画点亮后调用） */
  claimAchievementReward(id: string): number {
    const reward = this.achievementSystem?.claimReward(id) ?? 0;
    if (reward > 0) {
      this.economy.money += reward;
      this.onEconomyUpdate?.(this.economy);
    }
    return reward;
  }

  /** 获取未领取金币的成就列表 */
  getUnclaimedAchievements() {
    return this.achievementSystem?.getUnclaimedAchievements() ?? [];
  }

  /** 获取未领取成就金币数量 */
  getUnclaimedAchievementCount(): number {
    return this.achievementSystem?.getUnclaimedAchievements().length ?? 0;
  }

  /** 在回收动画完成后调用 — 实际清空库存 */
  clearRecycledInventory() {
    this.inventory = [];
    this.recycledInventory = [];
    this.onInventoryUpdate?.([]);
  }

  /** 触发游戏胜利流程 */
  gameVictory() {
    this.exportTrace('victory'); // 导出本局战斗采样数据
    // 巢穴·蟑老大：通关金币 2000 直接并入结算池（不走成就 unclaimed 管线，由结算动画展示后发放）
    if (this.isBossKingScene()) {
      this.pendingRewards += BALANCE_CONFIG.bossKing.rewardCoins;
    }
    // 保存关卡内累计的金币奖励到 victoryGoldReward（由结算界面动画展示后发放）
    // 星级金币倍率：1星×1.0 / 2星×1.2 / 3星×1.5（巢穴蟑老大锁定 2000 固定奖励，不乘倍率）
    let goldReward = this.pendingRewards;
    if (!this.isBossKingScene()) {
      const starMult = this.lastStarRating >= 3 ? 1.5 : this.lastStarRating === 2 ? 1.2 : 1.0;
      goldReward = Math.floor(goldReward * starMult);
    }
    this.victoryGoldReward = goldReward;
    this.pendingRewards = 0;
    this.onPendingRewardUpdate?.(0);

    // 在胜利界面之前出售未使用的库存道具
    const sellTotal = this.sellUnusedInventory();
    if (sellTotal > 0) {
      this.addFloatingText(this.width / 2, this.height * 0.3, TEXT_CONFIG.combat.itemRecycle.text(sellTotal), TEXT_CONFIG.combat.itemRecycle.color);
    }

    this.screenShake = BALANCE_CONFIG.screenShake.biggerExplosion;
    // 停止所有武器（禁用射击）
    this.player.isFiring = false;
    this.player.isOverheated = false;
    this.player.heat = 0;
    this.player.heatWarningTimer = 0;
    // 战斗结束时停止所有武器和连续音效
    this.audio.stopBGM();
    this.audio.stopFire();
    this.audio.stopFanLoop();
    this.audio.stopFireWallBurn();
    // 播放胜利 BGM（替换场景 BGM）
    this.audio.playVictoryBGM();

    // BOSS mode: no item drops - boss battle is distinct from story mode
    if (this.gameMode === GameMode.BOSS) {
      this.state = GameState.WAVE_CLEAR;
      this.onWaveClear?.();
      return;
    }

    // Story mode: 按 v4 固定表发放天赋点（普通=perScene，困难=hardMode 按场景链下标 clamp）
    // 巢穴·蟑老大：锁定设计 6 天赋点（覆盖 perScene 表的 nest:4）
    const rewardCfg = BALANCE_CONFIG.economy.talentPointReward;
    let talentReward: number;
    if (this.isBossKingScene()) {
      talentReward = BALANCE_CONFIG.bossKing.rewardTalent;
    } else if (this.difficulty === 'hard') {
      // 困难关：按 6 个困难关在关卡序列中的位置（0-5）取 hardMode 天赋点表
      const easyCount = STORY_LEVELS.length - 6; // 11 个简单关
      const hardPos = Math.max(0, getStoryLevelIndex(this.getCurrentLevelId()) - easyCount);
      talentReward = rewardCfg.hardMode[Math.min(hardPos, rewardCfg.hardMode.length - 1)] ?? 0;
    } else {
      talentReward = rewardCfg.perScene[this.currentScene] ?? 0;
    }
    // 重复过关不再发放额外天赋点，仅首次过关发放心增天赋点
    if (!this.lastRunFirstClear) talentReward = 0;
    if (talentReward > 0) this.addTalentPoints(talentReward);
    // 汇总本次通关获得的天赋点（仅首次过关的 perScene 奖励 + 旧存档解锁礼），用于胜利浮动文字展示
    const totalTalentGain = talentReward + this.lastVictoryStarBonus + this.lastTalentUnlockGrant;
    if (totalTalentGain > 0) {
      this.addFloatingText(this.width / 2, this.height * 0.35, TEXT_CONFIG.combat.talentReward.text(totalTalentGain), TEXT_CONFIG.combat.talentReward.color);
    }
    this.lastVictoryStarBonus = 0;

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
      const ratingTexts = TEXT_CONFIG.combat.starRating.text;
      this.addFloatingText(this.width / 2, this.height * 0.45, starText, TEXT_CONFIG.combat.starRating.color);
      this.addFloatingText(this.width / 2, this.height * 0.5, ratingTexts[stars], stars === 3 ? TEXT_CONFIG.combat.waveCleared.color : (stars === 2 ? TEXT_CONFIG.combat.starRating.color : TEXT_CONFIG.combat.weaponExpired.color));
      if (this.hospitalBreaches > 0) {
        this.addFloatingText(this.width / 2, this.height * 0.55, TEXT_CONFIG.combat.breachCount.text(this.hospitalBreaches), TEXT_CONFIG.combat.breachCount.color);
      }
    }

    // 剧情模式：道具掉落奖励流程（仅首次通关解锁新道具时播放掉落动画）
    // 学校/巢穴：通关后不解锁新道具，直接进结算（无掉落动画）
    const skipItemReward = this.currentScene === SceneType.SCHOOL || this.currentScene === SceneType.NEST;
    const rewards = skipItemReward ? [] : SCENE_REWARD_ITEMS[this.currentScene];
    // 只揭示新解锁的道具（跳过已解锁的；重复通关无新道具 → 不播放掉落动画，直接结算）
    const newlyUnlocked: typeof rewards = [];
    for (const reward of rewards) {
      if (!this.progress.weaponsUnlocked?.includes(reward.type)) {
        if (!this.progress.weaponsUnlocked) this.progress.weaponsUnlocked = [];
        this.progress.weaponsUnlocked.push(reward.type);
        newlyUnlocked.push(reward); // only add to reveal if it's newly unlocked
      }
    }
    this.saveProgress();
    // 胜利时立即检查成就（unlockNextScene 已写入 levelStars/星级，避免 WAVE_CLEAR 状态下
    // update() 提前 return 导致 checkAchievements 不被调用，三星通关等成就延迟到下一局才解锁）
    this.checkAchievements();
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

  /** 地铁精英教学对话完成：标记已读并恢复第1波生成（首波需走3-2-1倒计时以启动BGM） */
  resumeSpawnAfterEliteTutorial() {
    if (!this.eliteTutorialPause) return;
    this.eliteTutorialPause = false;
    this.onEliteTutorialPauseChange?.(false);
    try { localStorage.setItem('subway_elite_tutorial_seen', '1'); } catch { /* localStorage 不可用时忽略 */ }
    // 第1波：先走3-2-1倒计时（倒计时开始时启动关卡BGM）
    if (this.startCountdown()) return;
    // 非首波（理论上不会走到，兜底）：直接生成
    this.doWaveSpawn();
  }

  /** 地铁斩螂·110 教学对话完成：标记已读并恢复第4波生成（非首波，直接生成，无需倒计时） */
  resumeSpawnAfterKnifeTutorial() {
    if (!this.knifeTutorialPause) return;
    this.knifeTutorialPause = false;
    this.onKnifeTutorialPauseChange?.(false);
    try { localStorage.setItem('subway_knife_tutorial_seen', '1'); } catch { /* localStorage 不可用时忽略 */ }
    // 第4波（非首波）：直接生成，无需倒计时
    this.doWaveSpawn();
  }

  /** 触发游戏失败流程 */
  gameDefeat() {
    // Guard: prevent multiple calls
    if (this.defeatTriggered) return;
    this.defeatTriggered = true;
    this.exportTrace('defeat'); // 导出本局战斗采样数据
    // 失败：关卡内金币不发放，但已有金币池保留
    this.pendingRewards = 0;
    this.onPendingRewardUpdate?.(0);
    this.state = GameState.GAME_OVER;
    // 修复 2026-08-27：漏弹打空防线（巢穴蟑老大路径）进入失败态后必须通知 UI，
    // 否则 React 永远停留在战斗界面 + rAF 循环停止 → 屏幕卡死（结算界面永不弹出）
    this.onStateChange?.(this.state);
    this.addFloatingText(this.width / 2, this.height / 2, TEXT_CONFIG.combat.defeat.text, TEXT_CONFIG.combat.defeat.color);
    this.screenShake = BALANCE_CONFIG.screenShake.bossDeath;
    this.audio.stopBGM();
    this.audio.stopFire();
    this.audio.stopFanLoop();
    this.audio.stopFireWallBurn();
    // Play game over BGM immediately (don't wait for state change)
    this.audio.playGameOverBGM();
    // Notify UI after short delay (for visual effect)
    setTimeout(() => {
      this.onGameOver?.(this.economy, this.bossSystem!.bossBattle.currentWave);
    }, 2000);
  }

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
    // 超市阵型组内成员陆续生成（位置固定为槽位坐标，仅时间错开；教学暂停期间随主逻辑一并冻结）
    if (this.formationSpawnQueue.length > 0) {
      for (const q of this.formationSpawnQueue) q.delay -= this.deltaTime;
      const ready = this.formationSpawnQueue.filter(q => q.delay <= 0);
      if (ready.length > 0) {
        this.formationSpawnQueue = this.formationSpawnQueue.filter(q => q.delay > 0);
        for (const q of ready) this.spawnRoach(q.type, undefined, q.x, q.y);
      }
    }
    this.updateTrace();
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
    this.invoiceBoostTimer = Math.max(0, this.invoiceBoostTimer - this.deltaTime);
    this.updateJammer();
    this.swatterSystem!.updateSwatter(this.deltaTime, this.player.x, this.player.y);
    this.weaponSystem!.update(this.deltaTime, this.player, this.defenseLineY(), this.tutorialPauseSpawn || this.eliteTutorialPause || this.knifeTutorialPause);
    // 地铁场景：列车自动碾压 + 斩螂·110 刀刃飞跃（教学对话期间暂停）
    if (!this.eliteTutorialPause && !this.knifeTutorialPause) {
      // this.trainSystem!.update(this.deltaTime, this.roaches);
      this.shieldSystem!.update(this.deltaTime, this.roaches);
    }
    this.knifeSystem!.update(this.deltaTime, this.roaches);
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
        this.endlessNewRecordTimer = BALANCE_CONFIG.endless.newRecordTimer; // 3 seconds
        this.addFloatingText(this.width * 0.75, 60, TEXT_CONFIG.combat.newRecord.text, TEXT_CONFIG.combat.newRecord.color);
    this.addFloatingText(this.width * 0.75, 80, TEXT_CONFIG.combat.bestTimeRefreshed.text, TEXT_CONFIG.combat.bestTimeRefreshed.color);
        this.screenShake = BALANCE_CONFIG.screenShake.largeExplosion;
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
    this.armorShieldCacheTimer = BALANCE_CONFIG.player.armorShieldCacheInterval; // update every 0.3 seconds

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
    if (this.tutorialPauseSpawn || this.eliteTutorialPause || this.knifeTutorialPause) {
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
        this.addFloatingText(p.x, p.y - 60, TEXT_CONFIG.combat.weaponExpired.text, TEXT_CONFIG.combat.weaponExpired.color);
      }
    }

    // ===== 过热警告：接近过热时触发 =====
    // heatGain*100 = 100/秒，3秒 = 剩余300热量
    const warnThreshold = p.overheatThreshold - 300; // 1500 for default overheatThreshold=1800
    if (p.heat >= warnThreshold && p.heatWarningTimer <= 0 && !p.isOverheated) {
      p.heatWarningTimer = BALANCE_CONFIG.player.heatWarningDuration;
      this.addFloatingText(p.x, p.y - 60, TEXT_CONFIG.combat.barrelCooldown.text, TEXT_CONFIG.combat.barrelCooldown.color, 1500, 18);
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
        p.weaponAmmo[ammoKey] = Math.max(0, (p.weaponAmmo[ammoKey] || 0) - 1); // 修复 P1：统一为整数递减，与 molotovCount 一致
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
        this.addFloatingText(this.width / 2, this.height / 2, TEXT_CONFIG.combat.openFire.text, TEXT_CONFIG.combat.openFire.color, 2000, 28);
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
        this.addFloatingText(this.width / 2, this.height / 2, TEXT_CONFIG.combat.openFire.text, TEXT_CONFIG.combat.openFire.color, 2000, 28);
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
    // 喷火枪：配置表 flamethrower 为真实总 DPS（每秒）。火焰粒子区 DPS = 总DPS × (1 - 束占比)，
    // 直接以每秒伤害传入 spawnConeFire（天赋/火力全开倍率乘在这里，束伤害在 CollisionSystem 中乘）
    const flameDps = (this.difficulty === 'hard' ? BALANCE_CONFIG.weaponDamage.flamethrower.hard : BALANCE_CONFIG.weaponDamage.flamethrower.easy);
    const baseDamage = flameDps * (1 - BALANCE_CONFIG.weaponDamage.flamethrowerBeamShare) * p.damageMultiplier * powerBoostMult;
    const range = p.fireRange * 0.5;
    const boost = this.getFlameBoost(); // 天赋渐进强化：伤害强度/射程聚焦
    ParticleSpawner.spawnConeFire({ particles: this.particles, fireZones: this.fireZones, deltaTime: this.deltaTime, x: p.x, y: p.y, angle: -Math.PI / 2, range, baseDamage, type: 'fire', flameVariant: this.getFlameVariant(), intensity: boost.intensity, focus: boost.focus });
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
      p.overheatTimer = BALANCE_CONFIG.player.overheatCooldown.cone;
      p.heatWarningTimer = 0; // Clear warning on actual overheat
      ParticleSpawner.spawnSmokeParticles(this.particles,p.x, p.y, 30);
      this.screenShake = BALANCE_CONFIG.screenShake.smallExplosion;
    }
  }

  updatePoisonSpray(p: Player) {
    const gasCost = this.deltaTime;
    const range = p.fireRange * 0.45;
    // 毒雾粒子区真实每秒伤害（AoE 持续伤害，每秒语义与原 30×dt 一致）
    const baseDamage = this.difficulty === 'hard' ? 20 : 30;
    ParticleSpawner.spawnConeFire({ particles: this.particles, fireZones: this.fireZones, deltaTime: this.deltaTime, x: p.x, y: p.y, angle: -Math.PI / 2, range, baseDamage, type: 'poison' });
    p.gas -= gasCost * p.gasCostMultiplier;
    if (p.gas < 0) p.gas = 0;
    p.heat += this.deltaTime * 80;
    if (p.heat >= p.overheatThreshold) {
      p.heat = p.overheatThreshold;
      p.isOverheated = true;
      p.overheatTimer = BALANCE_CONFIG.player.overheatCooldown.poison;
    }
  }

  updateShotgun(p: Player) {
    const gasCost = this.deltaTime * 1.5;
    const range = p.fireRange * 0.35;
    // 散弹粒子区真实每秒总伤害 150（按弹丸分摊到各方向火区，每秒语义与原 150×dt 一致）
    const baseDamage = 150 * p.damageMultiplier;
    // Wide spread shotgun blast
    for (let i = 0; i < p.shotgunPellets; i++) {
      const spreadAngle = -Math.PI / 2 + (i - p.shotgunPellets / 2) * (Math.PI / 8);
      ParticleSpawner.spawnConeFire({ particles: this.particles, fireZones: this.fireZones, deltaTime: this.deltaTime, x: p.x, y: p.y, angle: spreadAngle, range, baseDamage: baseDamage / p.shotgunPellets, type: 'fire', flameVariant: this.getFlameVariant() });
    }
    p.gas -= gasCost * p.gasCostMultiplier;
    if (p.gas < 0) p.gas = 0;
    p.heat += this.deltaTime * 200;
    if (p.heat >= p.overheatThreshold) {
      p.heat = p.overheatThreshold;
      p.isOverheated = true;
      p.overheatTimer = BALANCE_CONFIG.player.overheatCooldown.shotgun;
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
    this.screenShake = BALANCE_CONFIG.screenShake.mediumExplosion;
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
      this.screenShake = BALANCE_CONFIG.screenShake.biggerExplosion;
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
    return this.aimingSystem!.startAiming(weapon, this.time, this.player.x, this.player.y, this.player.weaponAmmo, this.player.isTempWeapon);
  }

  throwAimedWeapon() {
    const result = this.aimingSystem!.throwAimedWeapon(
      this.player.isTempWeapon,
      this.player.weaponAmmo,
      this.player.x,
      this.player.y
    );
    if (result.throwable) {
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
    console.log('[selectItem] item:', item.type, 'count:', item.count, 'index:', index, 'inventory length:', this.inventory.length);

    // Check picked-up item cooldown (shares globalConsumableCooldown with shop consumables)
    if (this.consumableSystem!.globalConsumableCooldown > 0) {
      this.addFloatingText(this.player.x, this.player.y - 40, TEXT_CONFIG.combat.itemCooldown.text(this.consumableSystem!.globalConsumableCooldown.toFixed(1)), TEXT_CONFIG.combat.itemCooldown.color, 800);
      return;
    }
    if ((this.consumableSystem!.itemCooldowns[item.type] || 0) > 0) {
      const def = WEAPON_DROP_DEFS[item.type as keyof typeof WEAPON_DROP_DEFS];
      this.addFloatingText(this.player.x, this.player.y - 40, TEXT_CONFIG.combat.namedCooldown.text(def?.name || '', this.consumableSystem!.itemCooldowns[item.type].toFixed(1)), TEXT_CONFIG.combat.namedCooldown.color, 800);
      return;
    }

    // Helper to set cooldown after using a picked-up item
    const startItemCooldown = (type: string) => {
      const def = WEAPON_DROP_DEFS[type as keyof typeof WEAPON_DROP_DEFS];
      if (def && def.cooldown > 0) {
        this.consumableSystem!.itemCooldowns[type] = def.cooldown;
      }
      this.consumableSystem!.globalConsumableCooldown = BALANCE_CONFIG.consumable.globalCooldown;
    };

    // Shotgun is instant-use (activates triple flame), not placement
    if (item.type === 'shotgun') {
      console.log('[DEBUG shotgun] BEFORE: count=', item.count, 'inventoryLen=', this.inventory.length, 'inventory=', this.inventory.map(i => `${i.type}:${i.count}`).join(','));
      item.count--;
      console.log('[DEBUG shotgun] AFTER decrement: count=', item.count, 'willFilter=', item.count <= 0);
      this.tripleFlameSystem!.activateTripleFlame();
      startItemCooldown('shotgun');
      if (item.count <= 0) {
        this.inventory = this.inventory.filter((_, i) => i !== index);
        console.log('[DEBUG shotgun] FILTERED, new inventoryLen=', this.inventory.length, 'inventory=', this.inventory.map(i => `${i.type}:${i.count}`).join(','));
      }
      console.log('[DEBUG shotgun] calling onInventoryUpdate, inventoryLen=', this.inventory.length);
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Radar laser is instant-use (activates auto-targeting laser), not placement
    if (item.type === 'radar') {
      item.count--;
      this.radarLaserSystem!.activateRadarLaser();
      startItemCooldown('radar');
      if (item.count <= 0) {
        this.inventory = this.inventory.filter((_, i) => i !== index);
      }
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Insecticide spray is instant-use (auto-spray from bottom center), not placement
    if (item.type === 'poison') {
      console.log('[DEBUG poison] BEFORE: count=', item.count, 'inventoryLen=', this.inventory.length, 'inventory=', this.inventory.map(i => `${i.type}:${i.count}`).join(','));
      item.count--;
      console.log('[DEBUG poison] AFTER decrement: count=', item.count, 'willFilter=', item.count <= 0);
      this.insecticideSystem!.activate(this.width, this.height);
      startItemCooldown('poison');
      if (item.count <= 0) {
        this.inventory = this.inventory.filter((_, i) => i !== index);
        console.log('[DEBUG poison] FILTERED, new inventoryLen=', this.inventory.length, 'inventory=', this.inventory.map(i => `${i.type}:${i.count}`).join(','));
      }
      console.log('[DEBUG poison] calling onInventoryUpdate, inventoryLen=', this.inventory.length);
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Sticky board is instant-use (auto-fires 10 tracking drops), not placement
    if (item.type === 'sticky') {
      item.count--;
      this.stickySystem!.activateStickySpray();
      startItemCooldown('sticky');
      if (item.count <= 0) {
        this.inventory = this.inventory.filter((_, i) => i !== index);
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
        this.inventory = this.inventory.filter((_, i) => i !== index);
      }
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Fan is instant-use (activates wind slow on all roaches), not placement
    if (item.type === 'fan') {
      console.log('[DEBUG fan] BEFORE: count=', item.count, 'inventoryLen=', this.inventory.length, 'inventory=', this.inventory.map(i => `${i.type}:${i.count}`).join(','));
      item.count--;
      console.log('[DEBUG fan] AFTER decrement: count=', item.count, 'willFilter=', item.count <= 0);
      this.fanSystem!.activateFan();
      startItemCooldown('fan');
      if (item.count <= 0) {
        this.inventory = this.inventory.filter((_, i) => i !== index);
        console.log('[DEBUG fan] FILTERED, new inventoryLen=', this.inventory.length, 'inventory=', this.inventory.map(i => `${i.type}:${i.count}`).join(','));
      }
      console.log('[DEBUG fan] calling onInventoryUpdate, inventoryLen=', this.inventory.length);
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
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Knife (斩螂·110) is instant-use (auto-dashes to highest-threat target: dismantling worker > charging elite > nearest)
    if (item.type === 'knife') {
      const activated = this.knifeSystem!.activate(this.roaches, this.player.x);
      if (!activated) return; // 无目标或飞跃中，不消耗道具
      item.count--;
      startItemCooldown('knife');
      if (item.count <= 0) {
        this.inventory = this.inventory.filter((_, i) => i !== index);
      }
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Invoice (蟑叔发票)：30秒金币收益 +50%
    if (item.type === 'invoice') {
      this.invoiceBoostTimer = BALANCE_CONFIG.invoice?.duration ?? 30;
      item.count--;
      startItemCooldown('invoice');
      if (item.count <= 0) {
        this.inventory = this.inventory.filter((_, i) => i !== index);
      }
      this.addFloatingText(this.player.x, this.player.y - 140, TEXT_CONFIG.combat.invoiceBoost?.text ?? '发票加成！金币+50%', TEXT_CONFIG.combat.invoiceBoost?.color ?? '#fbbf24');
      this.onInventoryUpdate?.(this.inventory);
      return;
    }

    // Jammer (须须干扰器)：10秒全场蟑螂混乱乱窜 + 部分技能失效（护士加血/隧道工修盾喷甲/大小飞行自爆类闪避）
    // 激活窗口 jammerActiveTimer 内每帧刷新全部在场蟑螂，并覆盖窗口内新生成的蟑螂（updateJammer）
    if (item.type === 'jammer') {
      const dur = BALANCE_CONFIG.jammer?.duration ?? 5;
      this.jammerActiveTimer = dur;
      for (const r of this.roaches) {
        if (r.state !== RoachState.ALIVE || r.isBoss) continue;
        r.confuseTimer = dur;
        r.confuseAngle = Math.random() * Math.PI * 2; // 立即给一个随机乱窜方向
        // 技能封锁：护士加血、隧道工修盾/喷甲
        if (r.type === RoachType.NURSE || r.type === RoachType.TUNNEL_WORKER) {
          r.skillBlockTimer = Math.max(r.skillBlockTimer ?? 0, dur);
        }
        // 闪避封锁：大/小/飞行/自爆类（canDodge 统一判定）
        r.dodgeBlockTimer = Math.max(r.dodgeBlockTimer ?? 0, dur);
      }
      item.count--;
      startItemCooldown('jammer');
      if (item.count <= 0) {
        this.inventory = this.inventory.filter((_, i) => i !== index);
      }
      this.addFloatingText(this.player.x, this.player.y - 140, TEXT_CONFIG.combat.jammerActivate.text, TEXT_CONFIG.combat.jammerActivate.color);
      this.onInventoryUpdate?.(this.inventory);
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
      this.inventory = this.inventory.filter((_, i) => i !== this.selectedItemIndex);
    }

    this.itemPlaceState = 'idle';
    this.selectedItemIndex = -1;
    this.onInventoryUpdate?.(this.inventory);
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
    this.screenShake = BALANCE_CONFIG.screenShake.biggerExplosion;

    const label = target ? TEXT_CONFIG.combat.fireWall.text(hitCount) : TEXT_CONFIG.combat.fireWallSimple.text;
    this.addFloatingText((wallX1 + wallX2) / 2, wallY - 20, label, TEXT_CONFIG.combat.fireWall.color);
  }

  // ===== PERSPECTIVE GROUND BOUNDS: get left/right x boundaries at a given Y =====
  // The ground boundary is a 2-segment polyline per side (far→mid→near).
  // For a given Y, find which segment Y falls in and interpolate.
  // X values are scaled by widthRatio to adapt to the current canvas width.
  getGroundBoundsAtY(y: number): [number, number] {
    const [farL, farLY, farR, farRY, midL, midLY, midR, midRY, nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[this.currentScene];
    const clampedY = Math.min(nearY, Math.max(Math.min(farLY, farRY), y));
    const wr = this.width / 540; // Width ratio: scale X values from 540 design to current width

    // Left side: 2 segments (far→mid→near)
    let leftX: number;
    if (clampedY >= midLY) {
      // Between mid and near (lower half)
      const t = (clampedY - midLY) / (nearY - midLY);
      leftX = (midL + (nearL - midL) * t) * wr;
    } else {
      // Between far and mid (upper half)
      const t = (clampedY - farLY) / (midLY - farLY);
      leftX = (farL + (midL - farL) * t) * wr;
    }

    // Right side: 2 segments (far→mid→near)
    let rightX: number;
    if (clampedY >= midRY) {
      // Between mid and near (lower half)
      const t = (clampedY - midRY) / (nearY - midRY);
      rightX = (midR + (nearR - midR) * t) * wr;
    } else {
      // Between far and mid (upper half)
      const t = (clampedY - farRY) / (midRY - farRY);
      rightX = (farR + (midR - farR) * t) * wr;
    }

    return [leftX, rightX];
  }

  // Get the center point of the perspective ground bounds quad for the current scene
  // Used for bait landing target (center of roach walkable area)
  getGroundCenter(): [number, number] {
    const [farL, farLY, farR, farRY, , , , , nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[this.currentScene];
    const wr = this.width / 540;
    const centerX = (farL + farR + nearL + nearR) / 4 * wr;
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
  spawnRoach(type: RoachType, clusterId?: number, spawnX?: number, spawnY?: number): Roach | undefined {
    // Performance guard: hard cap on roach count
    if (this.roaches.length >= 40) return;

    const isHard = this.difficulty === 'hard';
    const config = this.getWaveConfig(this.wave);
    const def = ENEMY_DEFS[type];

    let baseX: number, baseY: number;

    if (spawnX !== undefined && spawnY !== undefined) {
      // 阵型整阵生成（超市 V3.1）：出生点即阵型槽位，由 FormationSystem 计划提供
      baseX = spawnX;
      baseY = spawnY;
    } else if (type === RoachType.FLYING || type === RoachType.FLYING_SUICIDE) {
      // Flying roaches spawn at sides and fly across
      baseX = Math.random() < 0.5 ? -20 : this.width + 20;
      baseY = this.height * 0.3 + Math.random() * this.height * 0.2;
    } else if (type === RoachType.SUBWAY_ELITE) {
      // Subway elite roaches spawn at sides and fly across (like flying roaches)
      baseX = Math.random() < 0.5 ? -25 : this.width + 25;
      baseY = this.height * 0.35 + Math.random() * this.height * 0.2;
    } else if (type === RoachType.QUEEN) {
      baseX = this.width / 2 + (Math.random() - 0.5) * 100;
      baseY = this.height * 0.45;
    } else if (type === RoachType.NURSE && this.currentScene === SceneType.HOSPITAL) {
      // ===== HOSPITAL EXCLUSIVE: Nurse spawns at the FAR end of ground bounds =====
      const [, farLY, , ] = SCENE_GROUND_BOUNDS[this.currentScene];
      baseY = farLY + 10; // Slightly below far line to be visible
      const [gLeft, gRight] = this.getGroundBoundsAtY(baseY);
      baseX = gLeft + Math.random() * (gRight - gLeft);
    } else if ((type === RoachType.SHIELD || type === RoachType.TUNNEL_WORKER) && this.currentScene === SceneType.SUBWAY) {
      // ===== SUBWAY: 护盾蟑螂/隧道工限定在地面阻挡线远端与中线之间生成（盾墙/喷涂压场位置前置） =====
      const [, farLY, , farRY, , midLY, , midRY] = SCENE_GROUND_BOUNDS[this.currentScene];
      const farY = Math.min(farLY, farRY); // 远端线 Y（梯形顶部）
      const midY = Math.max(midLY, midRY); // 中线 Y（梯形中部）
      baseY = farY + Math.random() * (midY - farY);
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
      // Debuff timers (insecticide / sticky board)
      dodgeBlockTimer: 0,
      weakenTimer: 0,
      skillBlockTimer: 0,
      // 须须干扰器：混乱乱窜计时
      confuseTimer: 0,
      confuseAngle: 0,
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
      r.placeTimer = 0; // Initialize placement timer
    }
    // Subway exclusive: tunnel worker init (armor spray cooldown + shield follow state)
    if (type === RoachType.TUNNEL_WORKER) {
      r.armorSprayTimer = BALANCE_CONFIG.subway.armorSprayInterval;
      r.shieldFollowTargetId = null;
      r.shieldRepairTextTimer = 0;
    }
    // Subway exclusive: elite roach init (rail charge state)；护甲已移除（v2.6 起改为纯血量，见 enemies.ts hp 45）
    if (type === RoachType.SUBWAY_ELITE) {
      r.chargeState = 'idle';
      r.chargeDelayTimer = BALANCE_CONFIG.subway.eliteChargeDelay;
      r.chargeDir = 0;
      r.killedByTrain = false;
    }
    // Subway exclusive: shield roach init (气体护盾满值 + 重建计时清零)
    if (type === RoachType.SHIELD) {
      r.shieldHp = BALANCE_CONFIG.subway.shieldMaxHp;
      r.maxShieldHp = BALANCE_CONFIG.subway.shieldMaxHp;
      r.shieldBrokenTimer = 0;
      r.shieldHitFlash = 0;
      r.shieldFlameHitFlash = 0;
      r.shieldFollowTargetId = null;
    }
    // School exclusive: jock roach init（爆发跳跃状态机初始状态）
    if (type === RoachType.JOCK) {
      r.jumpPhase = 'idle';
      r.jumpTimer = 0;
      r.jumpCooldown = BALANCE_CONFIG.roachAI.jock.cooldown;
      r.jumpStartX = 0;
      r.jumpStartY = 0;
      r.jumpEndX = 0;
      r.jumpEndY = 0;
    }
    // 采样：血量流入（含护甲）
    this.traceSpawnHp += Math.max(0, r.hp) + Math.max(0, r.armorHp || 0);
    this.roaches.push(r);
    if (type === RoachType.QUEEN) this.bossSystem!.activeBosses++;
    return r;
  }

  /** 须须干扰器持续生效：激活窗口内每帧刷新在场蟑螂，并覆盖窗口内新生成的蟑螂 */
  private updateJammer(): void {
    if (this.jammerActiveTimer <= 0) return;
    this.jammerActiveTimer = Math.max(0, this.jammerActiveTimer - this.deltaTime);
    const remain = this.jammerActiveTimer;
    if (remain <= 0) return;
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      // 新生蟑螂（confuseTimer 未激活）补发混乱；已激活的刷新为剩余时间保持一致
      if ((r.confuseTimer ?? 0) < remain) {
        r.confuseTimer = remain;
        if ((r.confuseAngle ?? 0) === 0) r.confuseAngle = Math.random() * Math.PI * 2;
      }
      if (r.type === RoachType.NURSE || r.type === RoachType.TUNNEL_WORKER) {
        r.skillBlockTimer = Math.max(r.skillBlockTimer ?? 0, remain);
      }
      r.dodgeBlockTimer = Math.max(r.dodgeBlockTimer ?? 0, remain);
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
    this.screenShake = BALANCE_CONFIG.screenShake.bigBossDeath;

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
              this._deathChainDepth++; // 修复 P1：递归前递增深度计数器
              this.killRoach(other, this.roaches.indexOf(other));
              this._deathChainDepth--; // 修复 P1：递归后递减深度计数器
        }
      }
    }

    // Damage defense if close (expanded range for flying suicide which may explode mid-air after panic)
    const roachSize = ENEMY_DEFS[r.type].size;
    const roachBottom = r.y + roachSize * 0.4;
    const defenseDamageRange = (r.type === RoachType.FLYING_SUICIDE) ? 300 : 100;
    if (roachBottom > this.defenseLineY() - defenseDamageRange) {
      const dmg = this.currentScene === SceneType.SUPERMARKET
        ? (this.difficulty === 'hard' ? BALANCE_CONFIG.supermarket.suicideExplodeDefenseDamage.hard : BALANCE_CONFIG.supermarket.suicideExplodeDefenseDamage.easy)
        : (this.difficulty === 'hard' ? 15 : 5);
      if (this.player.shieldTimer > 0) {
        this.addFloatingText(r.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
      } else {
        this.defenseHp -= dmg;
        this.starDefenseHp = Math.max(0, this.starDefenseHp - dmg);
        this.addFloatingText(r.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.suicideDamage.text(dmg), TEXT_CONFIG.combat.suicideDamage.color);
      }
      if (r.type === RoachType.FLYING_SUICIDE) {
        this.audio.playSuicideBreachFlying();
      } else {
        this.audio.playSuicideBreachGround();
      }
      if (this.defenseHp <= 0) {
        this.defenseHp = 0;
        this.exportTrace('defeat'); // 导出本局战斗采样数据（自爆突破路径）
        Vibration.vibrateGameOver();
        // 失败：关卡内金币不发放，但已有金币池保留
        this.pendingRewards = 0;
        this.onPendingRewardUpdate?.(0);
        this.state = GameState.GAME_OVER;
        // Stop all continuous sound effects on game over
        this.audio.stopBGM();
        this.audio.stopFire();
        this.audio.stopFanLoop();
        this.audio.stopFireWallBurn();
        this.economy.highestWave = Math.max(this.economy.highestWave, this.wave);
        this.progress.highestWave = Math.max(this.progress.highestWave, this.wave);
        this.progress.totalKills += this.economy.totalKills;
        this.saveProgress();
        this.onGameOver?.(this.economy, this.wave);
        this.onStateChange?.(this.state);
        return;
      }
    }

    this.addFloatingText(r.x, r.y - 30, hitCount > 0 ? TEXT_CONFIG.combat.bigExplosion.text(hitCount) : TEXT_CONFIG.combat.bigExplosionFallback.text, TEXT_CONFIG.combat.bigExplosion.color);
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
    this.screenShake = BALANCE_CONFIG.screenShake.bigBossDeath;

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
      const dmg = this.currentScene === SceneType.SUPERMARKET
        ? (this.difficulty === 'hard' ? BALANCE_CONFIG.supermarket.suicideExplodeDefenseDamage.hard : BALANCE_CONFIG.supermarket.suicideExplodeDefenseDamage.easy)
        : (this.difficulty === 'hard' ? 15 : 5);
      if (this.player.shieldTimer > 0) {
        this.addFloatingText(r.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
      } else {
        this.defenseHp -= dmg;
        this.starDefenseHp = Math.max(0, this.starDefenseHp - dmg);
        this.addFloatingText(r.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.suicideDamage.text(dmg), TEXT_CONFIG.combat.suicideDamage.color);
      }
      if (r.type === RoachType.FLYING_SUICIDE) {
        this.audio.playSuicideBreachFlying();
      } else {
        this.audio.playSuicideBreachGround();
      }
    }

    this.addFloatingText(r.x, r.y - 30, hitCount > 0 ? TEXT_CONFIG.combat.deathExplosion.text(hitCount) : TEXT_CONFIG.combat.deathExplosionFallback.text, TEXT_CONFIG.combat.deathExplosion.color);
  }

  // spawnDebrisParticles, spawnFireRingParticles, spawnShockwaveRing — migrated to ParticleSpawner



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
      // Layer 4: Fire flash overlay (layers)
      const BE = BALANCE_CONFIG.bombExplosion;
      for (let fi = 0; fi < BE.flash.emitter.layers; fi++) {
        this.particles.push({
          x: r.x + (Math.random() - 0.5) * BE.flash.emitter.offsetX,
          y: r.y + (Math.random() - 0.5) * BE.flash.emitter.offsetY,
          vx: 0, vy: 0,
          life: BE.flash.lifeBase + fi * BE.flash.lifeStep, maxLife: BE.flash.lifeBase + fi * BE.flash.lifeStep,
          size: BE.flash.sizeBase + fi * BE.flash.sizeStep,
          color: `rgba(${BE.flash.colorR}, ${BE.flash.colorGBase - fi * BE.flash.colorGStep}, ${BE.flash.colorBBase - fi * BE.flash.colorBStep}, ${BE.flash.alphaBase - fi * BE.flash.alphaStep})`,
          type: ParticleType.EXPLOSION,
        });
      }
      // Layer 5: Debris (fragments)
      for (let d = 0; d < BE.debris.emitter.count; d++) {
        const angle = (d / BE.debris.emitter.count) * Math.PI * 2 + Math.random() * BE.debris.emitter.angleJitter;
        const speed = BE.debris.speedMin + Math.random() * BE.debris.speedRange;
        this.particles.push({
          x: r.x, y: r.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + BE.debris.vyBias,
          life: BE.debris.lifeMin + Math.random() * BE.debris.lifeRange,
          maxLife: BE.debris.maxLife,
          size: BE.debris.sizeMin + Math.random() * BE.debris.sizeRange,
          color: `rgba(${BE.debris.colorRBase + Math.floor(Math.random() * BE.debris.colorRRange)}, ${BE.debris.colorGBase + Math.floor(Math.random() * BE.debris.colorGRange)}, 0, ${BE.debris.alpha})`,
          type: ParticleType.ASH,
        });
      }
      // Screen shake + sound
      this.screenShake = BALANCE_CONFIG.screenShake.queenDeath;
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
        this.addFloatingText(r.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
      } else {
        this.defenseHp -= defDmg;
        this.starDefenseHp = Math.max(0, this.starDefenseHp - defDmg);
        this.addFloatingText(r.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.bombExplode.text(defDmg), TEXT_CONFIG.combat.bombExplode.color);
      }

      this.addFloatingText(r.x, r.y - 50, TEXT_CONFIG.combat.boom.text, TEXT_CONFIG.combat.boom.color);
    } finally {
      this._deathChainDepth--;
    }
  }

  killRoach(r: Roach,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _index: number) {
    // 修复 P1：死亡链深度由 suicideExplode 管理，killRoach 入口不再重置计数器

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

    // 飞行蟑螂：播放死亡音效
    if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
      this.audio.playFlyingDeath();
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
      this.addFloatingText(r.x, r.y - 30, TEXT_CONFIG.combat.splitSpawn.text, TEXT_CONFIG.combat.splitSpawn.color);
    }

    // 地铁精英：仅当被列车碾压时分裂为 2 只小蟑螂（斩螂·110 等其他击杀不触发）
    if (r.type === RoachType.SUBWAY_ELITE && r.killedByTrain) {
      for (let s = 0; s < 2; s++) {
        const spawnX = r.x + (s === 0 ? -30 : 30);
        const spawnY = r.y + (Math.random() - 0.5) * 20;
        const small: Roach = {
          ...this.createSmallRoachFromSplit(spawnX, spawnY),
          id: nextId++,
        };
        this.roaches.push(small);
      }
      this.addFloatingText(r.x, r.y - 30, TEXT_CONFIG.combat.eliteSplit.text, TEXT_CONFIG.combat.eliteSplit.color);
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
      this.addFloatingText(r.x, r.y - 20, TEXT_CONFIG.combat.disintegrate.text, TEXT_CONFIG.combat.disintegrate.color);
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
      this.screenShake = BALANCE_CONFIG.screenShake.bossDeath;
      this.audio.playSuicideExplode();
      Vibration.vibrateSuicideExplode();
      this.addFloatingText(r.x, r.y - 30, hitCount > 0 ? TEXT_CONFIG.combat.explode.text(hitCount) : TEXT_CONFIG.combat.explosionFallback.text, TEXT_CONFIG.combat.explode.color);
    }

    this.audio.playKill();
    Vibration.vibrateKill();
    ParticleSpawner.spawnAshParticles(this.particles,r.x, r.y, r.type === RoachType.QUEEN ? 50 : (r.type === RoachType.LARGE ? 20 : 12));
    ParticleSpawner.spawnSparkParticles(this.particles,r.x, r.y, r.type === RoachType.QUEEN ? 40 : (r.type === RoachType.LARGE ? 15 : 8));
    ParticleSpawner.spawnBloodParticles(this.particles,r.x, r.y, r.type === RoachType.QUEEN ? 40 : (r.type === RoachType.LARGE ? 25 : 15));

    const sceneMult = this.getSceneConfig().rewardMultiplier;
    const invoiceMult = this.invoiceBoostTimer > 0 ? (BALANCE_CONFIG.invoice?.goldMult ?? 1.5) : 1;
    const rewardMult = (this.talentMultipliers.rewardMultiplier || 1) * sceneMult * invoiceMult;
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
      case RoachType.TUNNEL_WORKER: this.economy.tunnelWorkerKills++; break;
      case RoachType.SUBWAY_ELITE: this.economy.subwayEliteKills++; break;
      case RoachType.SHIELD: this.economy.shieldKills++; break;
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
          this.addFloatingText(boss.x + (Math.random() - 0.5) * 40, boss.y - 30, TEXT_CONFIG.combat.backlash.text(backlashDmg), TEXT_CONFIG.combat.backlash.color);
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
    this.pendingRewards += reward;
    this.onPendingRewardUpdate?.(this.pendingRewards);
    this.addFloatingText(r.x, r.y - 20, TEXT_CONFIG.combat.killReward.text(reward), TEXT_CONFIG.combat.killReward.color);
    this.screenShake = r.isBoss ? 12 : (r.type === RoachType.LARGE ? 6 : 3);

    // Boss 死亡清除所有剩余蟑螂
    if (r.isBoss) {
      this.bossSystem!.activeBosses--;
      this.addFloatingText(this.width / 2, this.height / 2, TEXT_CONFIG.combat.bossDefeated.text, TEXT_CONFIG.combat.bossDefeated.color);
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
      this.addFloatingText(r.x, r.y - 40, TEXT_CONFIG.combat.corpseBomb.text(3), TEXT_CONFIG.combat.corpseBomb.color);
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
      (id) => this.stickySystem!.isStuckByBoard(id)
    );
    this.fireZones = this.fireZones.filter(z => z.maxLife >= 1); // 修复 P0：保留持久火焰区域（燃烧瓶等，maxLife≥1），清除每帧武器火焰区域（maxLife=0.5）
  }

  isStuckByBoard(roachId: number): boolean {
    return this.stickySystem!.isStuckByBoard(roachId);
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

    // 修复 P1：不再用对象包装传引用，直接传值
    const result = this.collisionSystem!.checkDefenseBreach(
      this.roaches, dl, this.player, this.defenseHp, this.activeBosses,
      this.bossSystem!.bossBattle.active, // 修复 P2：onBossStop → isBossActive
    );

    // 同步回引擎状态（星级评价血量只减不增：按掉血差值同步扣减）
    if (result.defenseHp < this.defenseHp) {
      this.starDefenseHp = Math.max(0, this.starDefenseHp - (this.defenseHp - result.defenseHp));
    }
    this.defenseHp = result.defenseHp;
    this.activeBosses = result.activeBosses;

    // 处理自杀爆炸 + 突破移除（修复 P1：合并为单次降序处理，避免索引偏移）
    const allIndices = [
      ...result.suicideExplodeIndices.map(i => ({ idx: i, isSuicide: true as const })),
      ...result.removedIndices.map(i => ({ idx: i, isSuicide: false as const })),
    ].sort((a, b) => b.idx - a.idx);

    for (const { idx, isSuicide } of allIndices) {
      if (isSuicide) {
        this.suicideExplode(this.roaches[idx], idx);
      } else {
        this.roaches.splice(idx, 1);
      }
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
      this.exportTrace('defeat'); // 导出本局战斗采样数据（波次突破路径）
      Vibration.vibrateGameOver();
      // 失败：关卡内金币不发放，但已有金币池保留
      this.pendingRewards = 0;
      this.onPendingRewardUpdate?.(0);
      this.state = GameState.GAME_OVER;
      this.audio.stopBGM();
      this.audio.stopFire();
      this.audio.stopFanLoop();
      this.audio.stopFireWallBurn();
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

    // ===== 巢穴·蟑老大 Boss 战：Boss 系统 + 波次管理器并行（波次循环供怪，胜利由 Boss 死亡触发） =====
    if (this.isBossKingScene()) {
      this.bossKingSystem!.updateConfig({
        width: this.width, height: this.height, deltaTime: this.deltaTime,
        time: this.time, defenseHp: this.defenseHp, defenseLineY: this.defenseLineY(),
        player: this.player,
        tripleFlame: this.tripleFlameSystem?.getState(),
      });
      this.bossKingSystem!.update();
      // 火枪引爆炸弹检测（在火焰碰撞结算之后执行，引擎主循环顺序已保证）
      this.bossKingSystem!.checkBombFlameHits();
      // 波次管理器并行运转（loopWaves 模式：第 6 波清空后回到第 1 波，不触发波次胜利）
      const result = this.waveManager!.update(this.deltaTime);
      if (result.skipRest) return;
    } else {
      const result = this.waveManager!.update(this.deltaTime);
      if (result.skipRest) return;
    }

    // ===== 定时自爆：交错生成（每只间隔8秒以保持节奏）。医院/地铁场景生效 =====
    if ((this.currentScene === SceneType.HOSPITAL || this.currentScene === SceneType.SUBWAY) && this.timedSuicideSpawnRemaining > 0) {
      this.timedSuicideSpawnTimer -= this.deltaTime;
      if (this.timedSuicideSpawnTimer <= 0) {
        this.spawnRoach(RoachType.TIMED_SUICIDE);
        this.timedSuicideSpawnRemaining--;
        this.timedSuicideSpawnTimer = this.timedSuicideSpawnRemaining > 0 ? 8.0 : 0;
        if (this.timedSuicideSpawnRemaining > 0) {
          this.addFloatingText(this.width / 2, 150, TEXT_CONFIG.combat.timedSuicideNext.text, TEXT_CONFIG.combat.timedSuicideNext.color);
        } else {
          this.addFloatingText(this.width / 2, 150, TEXT_CONFIG.combat.timedSuicideAll.text, TEXT_CONFIG.combat.timedSuicideAll.color);
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
        this.addFloatingText(bomb.x, bomb.y - 25, TEXT_CONFIG.combat.bombCountdown.text(secs), secs <= 1 ? TEXT_CONFIG.combat.defenseBreach.color : TEXT_CONFIG.combat.waveCleared.color);
      }
      // Red flash pulse during countdown (last seconds)
      const CF = BALANCE_CONFIG.timedBomb.corpseFlash;
      if (bomb.timer <= CF.emitter.countdownThreshold && bomb.timer > 0) {
        const flashIntensity = (Math.sin(bomb.flashPhase * CF.flashFreq) + 1) * 0.5;
        if (Math.random() < CF.emitter.sparkChance) {
          const angle = Math.random() * Math.PI * 2;
          const speed = CF.sparkSpeedMin + Math.random() * CF.sparkSpeedRange;
          this.particles.push({
            x: bomb.x + Math.cos(angle) * (CF.emitter.sparkOffsetXBase + Math.random() * CF.emitter.sparkOffsetXRange),
            y: bomb.y + Math.sin(angle) * (CF.emitter.sparkOffsetYBase + Math.random() * CF.emitter.sparkOffsetYRange),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed + CF.sparkVyBias,
            life: CF.sparkLifeMin + Math.random() * CF.sparkLifeRange,
            maxLife: CF.sparkMaxLife,
            size: CF.sparkSizeMin + Math.random() * CF.sparkSizeRange,
            color: `rgba(255, ${Math.floor(CF.sparkGBase + flashIntensity * CF.sparkGRange)}, 0, ${CF.sparkAlphaBase + flashIntensity * CF.sparkAlphaRange})`,
            type: ParticleType.SPARK,
          });
        }
        if (bomb.timer <= CF.emitter.burstThreshold && flashIntensity > CF.emitter.burstIntensityMin) {
          this.particles.push({
            x: bomb.x, y: bomb.y,
            vx: 0, vy: 0,
            life: CF.burstLife, maxLife: CF.burstLife,
            size: CF.burstSizeMin + Math.random() * CF.burstSizeRange,
            color: `rgba(255, 0, 0, ${CF.burstAlphaBase + flashIntensity * CF.burstAlphaRange})`,
            type: ParticleType.EXPLOSION,
          });
        }
      }
      // warning pulse
      if (bomb.timer <= CF.warnThreshold && Math.floor(bomb.timer * CF.warnBlinkRate) % 2 === 0) {
        this.addFloatingText(bomb.x, bomb.y - 40, TEXT_CONFIG.combat.bombWarning.text, TEXT_CONFIG.combat.bombWarning.color);
      }
      // EXPLOSION!
      if (bomb.timer <= 0) {
        this.screenShake = BALANCE_CONFIG.screenShake.massiveExplosion;
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
        const corpseDefRadius = this.currentScene === SceneType.SUPERMARKET
          ? BALANCE_CONFIG.supermarket.corpseBombDefenseRadius : 120;
        if (defenseDist < corpseDefRadius) {
          const defenseDmg = this.currentScene === SceneType.SUPERMARKET
            ? BALANCE_CONFIG.supermarket.corpseBombDefenseDamage : 12;
          if (this.player.shieldTimer > 0) {
            this.addFloatingText(bomb.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
          } else {
            this.defenseHp -= defenseDmg;
            this.starDefenseHp = Math.max(0, this.starDefenseHp - defenseDmg);
            this.addFloatingText(bomb.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.corpseBombDamage.text(defenseDmg), TEXT_CONFIG.combat.corpseBombDamage.color);
          }
        }
        ParticleSpawner.spawnExplosionParticles(this.particles,bomb.x, bomb.y, 20);
        ParticleSpawner.spawnSmokeParticles(this.particles,bomb.x, bomb.y, 10);
        this.addFloatingText(bomb.x, bomb.y - 40, TEXT_CONFIG.combat.corpseBombExplode.text, TEXT_CONFIG.combat.corpseBombExplode.color);
        this.deadTimedBombs.splice(i, 1);
      }
    }

    // ===== 医院/超市/地铁/巢穴：更新已放置的定时炸弹（定时自爆蟑螂在防线放置；巢穴为蟑老大导演 P3 池） =====
    if (this.currentScene === SceneType.HOSPITAL || this.currentScene === SceneType.SUPERMARKET || this.currentScene === SceneType.SUBWAY || this.isBossKingScene()) {
      for (let bi = this.placedBombs.length - 1; bi >= 0; bi--) {
        const bomb = this.placedBombs[bi];
        bomb.timer -= this.deltaTime;
        const secs = Math.ceil(bomb.timer);
        if (bomb.timer > 0 && Math.abs(bomb.timer - secs) < 0.05 && secs <= 3) {
          this.addFloatingText(bomb.x, bomb.y - 20, `${secs}`, secs <= 1 ? TEXT_CONFIG.combat.defenseBreach.color : TEXT_CONFIG.combat.waveCleared.color);
        }
        if (bomb.timer <= 0) {
          ParticleSpawner.spawnExplosionParticles(this.particles,bomb.x, bomb.y, 80);
          ParticleSpawner.spawnFireRingParticles(this.particles,bomb.x, bomb.y, 30);
          ParticleSpawner.spawnSmokeParticles(this.particles,bomb.x, bomb.y, 40);
          // Layer 4: Fire flash overlay (layers) — 参数见 BALANCE_CONFIG.bombExplosion
          const BE = BALANCE_CONFIG.bombExplosion;
          for (let fi = 0; fi < BE.flash.emitter.layers; fi++) {
            this.particles.push({
              x: bomb.x + (Math.random() - 0.5) * BE.flash.emitter.offsetX,
              y: bomb.y + (Math.random() - 0.5) * BE.flash.emitter.offsetY,
              vx: 0, vy: 0,
              life: BE.flash.lifeBase + fi * BE.flash.lifeStep, maxLife: BE.flash.lifeBase + fi * BE.flash.lifeStep,
              size: BE.flash.sizeBase + fi * BE.flash.sizeStep,
              color: `rgba(${BE.flash.colorR}, ${BE.flash.colorGBase - fi * BE.flash.colorGStep}, ${BE.flash.colorBBase - fi * BE.flash.colorBStep}, ${BE.flash.alphaBase - fi * BE.flash.alphaStep})`,
              type: ParticleType.EXPLOSION,
            });
          }
          // Layer 5: Debris (fragments)
          for (let d = 0; d < BE.debris.emitter.count; d++) {
            const angle = (d / BE.debris.emitter.count) * Math.PI * 2 + Math.random() * BE.debris.emitter.angleJitter;
            const speed = BE.debris.speedMin + Math.random() * BE.debris.speedRange;
            this.particles.push({
              x: bomb.x, y: bomb.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed + BE.debris.vyBias,
              life: BE.debris.lifeMin + Math.random() * BE.debris.lifeRange,
              maxLife: BE.debris.maxLife,
              size: BE.debris.sizeMin + Math.random() * BE.debris.sizeRange,
              color: `rgba(${BE.debris.colorRBase + Math.floor(Math.random() * BE.debris.colorRRange)}, ${BE.debris.colorGBase + Math.floor(Math.random() * BE.debris.colorGRange)}, 0, ${BE.debris.alpha})`,
              type: ParticleType.ASH,
            });
          }
          this.screenShake = BALANCE_CONFIG.screenShake.queenDeath;
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
          const defDmg = this.currentScene === SceneType.SUPERMARKET
            ? (this.difficulty === 'hard' ? BALANCE_CONFIG.supermarket.placedBombDefenseDamage.hard : BALANCE_CONFIG.supermarket.placedBombDefenseDamage.easy)
            : (this.difficulty === 'hard' ? 20 : 8);
          if (this.player.shieldTimer > 0) {
            this.addFloatingText(bomb.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.shieldBlock.text, TEXT_CONFIG.combat.shieldBlock.color);
          } else {
            this.defenseHp -= defDmg;
            this.starDefenseHp = Math.max(0, this.starDefenseHp - defDmg);
            this.addFloatingText(bomb.x, this.defenseLineY() - 20, TEXT_CONFIG.combat.bombExplode.text(defDmg), TEXT_CONFIG.combat.bombExplode.color);
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

  /** 巢穴·蟑老大 Boss 战是否接管当前关卡（巢穴场景 + 剧情模式；替换原波次内容，仅 Easy） */
  isBossKingScene(): boolean {
    return this.currentScene === SceneType.NEST && this.gameMode === GameMode.STORY;
  }

  // Start 3-2-1 countdown before wave spawn. Returns true if countdown was started.
  startCountdown(): boolean {
    return this.waveManager!.startCountdown();
  }

  // Called when countdown reaches 0 - actually spawn the wave
  doWaveSpawn() {
    // 巢穴·蟑老大：3-2-1 倒计时结束 → Boss 先入场（由小变大/由透明变不透明飞来），
    // 入场完成后经 onEntranceComplete 回调生成第 1 波（Boss 入场先于战斗波次）
    if (this.isBossKingScene()) {
      this.state = GameState.PLAYING;
      this.onStateChange?.(this.state);
      this.bossKingSystem!.updateConfig({
        width: this.width, height: this.height, deltaTime: this.deltaTime,
        time: this.time, defenseHp: this.defenseHp, defenseLineY: this.defenseLineY(),
        player: this.player,
      });
      this.bossKingSystem!.startBattle();
      return;
    }
    this.waveManager!.doWaveSpawn();
  }

  getWaveConfig(wave: number): WaveConfig {
    return this.waveManager!.getWaveConfig(wave);
  }

  /** 当前关卡 ID（存档键）：困难关为 `${scene}__hard`，简单关为 scene 名 */
  getCurrentLevelId(): string {
    return getLevelId(this.currentScene, this.difficulty);
  }

  unlockNextScene() {
    // 当前关卡 ID（困难关 = `${scene}__hard`，简单关 = scene）
    const levelId = this.getCurrentLevelId();

    // Ensure scenesCompleted exists (defensive for optional field)
    if (!this.progress.scenesCompleted) {
      this.progress.scenesCompleted = [];
    }
    // Mark current level as completed（按关卡 ID，困难关与简单关互不影响）
    this.lastRunFirstClear = !this.progress.scenesCompleted.includes(levelId);
    if (!this.progress.scenesCompleted.includes(levelId)) {
      this.progress.scenesCompleted.push(levelId);
    }
    this.scenesCleared.add(levelId);

    // ===== 星级评价：按防线血量（不含加血）保留比例 —— 100%→3星，60%~99%→2星，0%~59%→1星 =====
    const hpRatio = this.maxDefenseHp > 0
      ? Math.max(0, Math.min(1, this.starDefenseHp / this.maxDefenseHp))
      : 0;
    const stars = hpRatio >= 1 ? 3 : hpRatio >= 0.6 ? 2 : 1;
    this.lastStarRating = stars;
    if (!this.progress.levelStars) this.progress.levelStars = {};
    // 不管过关几次，只记录该关卡曾经得到的最多星级（按关卡 ID，困难关独立记录）
    const prevStars = this.progress.levelStars[levelId] ?? 0;
    if (prevStars < stars) {
      this.progress.levelStars[levelId] = stars;
    }

    // ===== 天赋点经济（v5）：星级与天赋点解耦——三星不再发放天赋点，仅首次过关发放 perScene 天赋点 =====
    // 星级仅决定结算金币倍率（见 gameVictory），不再产生任何天赋点
    this.lastVictoryStarBonus = 0;
    // 旧存档兼容：地下室通关时仍将历史待解锁池一次性发放（新版本不再累积该池）
    this.lastTalentUnlockGrant = 0;
    if (this.currentScene === SceneType.BASEMENT && (this.progress.pendingTalentPoints ?? 0) > 0) {
      const grant = this.progress.pendingTalentPoints ?? 0;
      this.progress.talentTree.points += grant;
      this.progress.pendingTalentPoints = 0;
      this.lastTalentUnlockGrant = grant;
    }
    this.saveProgress();

    // 按剧情关卡序列解锁下一关（巢穴之后依次解锁 6 个困难关）
    const currentIdx = getStoryLevelIndex(levelId);
    if (currentIdx >= 0 && currentIdx < STORY_LEVELS.length - 1) {
      const nextLevel = STORY_LEVELS[currentIdx + 1];
      if (!this.progress.scenesUnlocked.includes(nextLevel.id)) {
        this.progress.scenesUnlocked.push(nextLevel.id);
        this.saveProgress(); // Save immediately after unlocking
        this.addFloatingText(this.width / 2, this.height / 2 + 50, TEXT_CONFIG.combat.sceneUnlock.text(nextLevel.name), TEXT_CONFIG.combat.sceneUnlock.color);
      }
    }
  }

  // =============================================================================
  // 粒子系统：12 种粒子类型，支持动态性能自适应
  // 类型：fire, smoke, ember, ash, spark, blood, ice, poison_cloud, explosion,
  //       rain, lightning, shield
  // 性能：前 120 帧采样帧率，动态调整粒子数量上限 (150-400)
  // =============================================================================
  // spawnConeFire, spawnSmokeParticles, spawnAshParticles, spawnBloodParticles, spawnSparkParticles, spawnExplosionParticles — migrated to ParticleSpawner

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
    this.floatingTextSystem.addFloatingText(x, y, text, color, durationMs, fontSize);
  }

  /** 更新所有粒子特效（位置、生命周期） */
  /** 更新粒子和浮动文字（委托给 ParticleSystem 和 FloatingTextSystem 模块） */
  updateParticles() {
    this.particleSystem!.updateConfig({
      particleLimit: this._particleLimit,
      deltaTime: this.deltaTime,
      defenseLineY: this.defenseLineY(),
    });
    // 修复 P1：浮动文字更新由 FloatingTextSystem 自身管理，不再暴露内部数组给 ParticleSystem
    this.floatingTextSystem.update(this.deltaTime);
    this.particleSystem!.syncParticleArrays(
      this.particles,
      this.fireZones,
      this.roaches
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
          // 气体护盾：火墙对受保护目标承伤时，额外加倍侵蚀护盾
          // （快照机制已按 shieldSnapshotErosionMult 侵蚀，此处补足至 shieldFireZoneErosionMult 倍）
          const wallProtector = ShieldSystem.findProtectingShield(this.roaches, r);
          if (wallProtector) {
            const sub = BALANCE_CONFIG.subway;
            this.shieldSystem?.damageShield(wallProtector, dmg * (sub.shieldFireZoneErosionMult - sub.shieldSnapshotErosionMult), false);
          }
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

  // spawnLightningParticles — migrated to ParticleSpawner


  // =============================================================================
  // 天气系统：雨天/浓雾/黑夜/闪电，影响视觉效果和蟑螂行为
  // =============================================================================
  /** 更新天气粒子（雨、雾、夜晚闪电） */
  updateWeather() {
    const scene = this.getSceneConfig();
    const weather = scene.weather;

    if (weather === WeatherType.RAIN) {
      // 雨滴粒子（帧率无关：spawnRate * deltaTime）
      const rainCfg = BALANCE_CONFIG.weather.rain;
      if (Math.random() < rainCfg.emitter.spawnRate * this.deltaTime) {
        const rainParticle: Particle = {
          x: Math.random() * this.width,
          y: rainCfg.emitter.spawnY,
          vx: rainCfg.vxMin + Math.random() * rainCfg.vxRange,
          vy: rainCfg.vyMin + Math.random() * rainCfg.vyRange,
          life: rainCfg.life,
          maxLife: rainCfg.life,
          size: rainCfg.sizeMin + Math.random() * rainCfg.sizeRange,
          color: rainCfg.color,
          type: ParticleType.RAIN,
        };
        this.weatherParticles.push(rainParticle);
      }
    } else if (weather === WeatherType.FOG) {
      // 缓慢移动的雾（帧率无关：spawnRate * deltaTime）
      const fogCfg = BALANCE_CONFIG.weather.fog;
      if (Math.random() < fogCfg.emitter.spawnRate * this.deltaTime) {
        const life = fogCfg.lifeMin + Math.random() * fogCfg.lifeRange;
        const fogParticle: Particle = {
          x: Math.random() < 0.5 ? -fogCfg.emitter.spawnEdgeOffset : this.width + fogCfg.emitter.spawnEdgeOffset,
          y: Math.random() * this.height,
          vx: (Math.random() < 0.5 ? 1 : -1) * (fogCfg.vxMin + Math.random() * fogCfg.vxRange),
          vy: fogCfg.vyMin + Math.random() * fogCfg.vyRange,
          life,
          maxLife: life,
          size: fogCfg.sizeMin + Math.random() * fogCfg.sizeRange,
          color: `rgba(${fogCfg.colorBase}, ${fogCfg.alphaMin + Math.random() * fogCfg.alphaRange})`,
          type: ParticleType.SMOKE,
        };
        this.weatherParticles.push(fogParticle);
      }
    } else if (weather === WeatherType.NIGHT && this.currentScene === SceneType.ROOFTOP) {
      // 闪电（带文字冷却防刷屏；触发时生成可见闪电链）。闪电特效仅天台场景——地下室/地铁的 NIGHT 天气不触发
      this.lightningTimer -= this.deltaTime;
      this.lightningTextCooldown -= this.deltaTime;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = BALANCE_CONFIG.lightning.emitter.timerMin + Math.random() * BALANCE_CONFIG.lightning.emitter.timerRandMax;
        if (Math.random() < BALANCE_CONFIG.lightning.emitter.chance) {
          this.lightningFlash = BALANCE_CONFIG.lightning.flashDuration;
          this.lightningBolt = WeatherSystem.buildLightningBolt(this.width, this.height);
          if (this.lightningTextCooldown <= 0) {
            this.addFloatingText(this.width / 2, this.height / 2 - BALANCE_CONFIG.lightning.textOffsetY, TEXT_CONFIG.combat.lightning.text, TEXT_CONFIG.combat.lightning.color);
            this.lightningTextCooldown = BALANCE_CONFIG.lightning.textCooldown;
          }
        }
      }
      // 更新闪电闪光（闪光结束后清空闪电链）
      if (this.lightningFlash > 0) {
        this.lightningFlash -= this.deltaTime;
        if (this.lightningFlash <= 0) this.lightningBolt = [];
      }
    }

    // 下水道：顶部水滴下落，落到地面阻挡面生成涟漪
    if (this.currentScene === SceneType.SEWER) {
      this.spawnWeatherDrip(BALANCE_CONFIG.weather.drip.emitter.sewerSpawnRate);
    }
    // 天台：少量雨滴下落（下落更快），落到地面阻挡面生成涟漪
    if (this.currentScene === SceneType.ROOFTOP) {
      this.spawnWeatherDrip(BALANCE_CONFIG.weather.drip.emitter.rooftopSpawnRate, BALANCE_CONFIG.weather.drip.emitter.rooftopSpeedMult);
    }
    // 地下室/医院：波次灯光序列推进（doWaveSpawn 触发 startWaveFlicker 后逐段播放）
    if (this.currentScene === SceneType.BASEMENT || this.currentScene === SceneType.HOSPITAL) {
      this.updateWaveFlicker();
    }

    // 更新天气粒子
    for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
      const p = this.weatherParticles[i];
      p.life -= this.deltaTime;
      p.x += p.vx * this.deltaTime;
      p.y += p.vy * this.deltaTime;
      if (p.type === ParticleType.SMOKE && weather === WeatherType.FOG) {
        p.size *= BALANCE_CONFIG.weather.fog.growthRate;
      }
      // 水滴落地：消失并在地面阻挡面生成近大远小涟漪
      if (p.type === ParticleType.DRIP && p.targetY !== undefined && p.y >= p.targetY) {
        const rc = BALANCE_CONFIG.weather.ripple;
        this.weatherParticles.push({
          x: p.x, y: p.targetY,
          vx: 0, vy: 0,
          life: rc.life, maxLife: rc.life,
          size: rc.baseSize * this.groundPerspectiveScaleAt(p.targetY),
          color: rc.color,
          type: ParticleType.RIPPLE,
        });
        this.weatherParticles.splice(i, 1);
        continue;
      }
      if (p.life <= 0) {
        this.weatherParticles.splice(i, 1);
      }
    }
  }

  /** 生成下落水滴（下水道/天台）：随机落点在地面阻挡面梯形内，垂直下落 */
  private spawnWeatherDrip(spawnRate: number, speedMult: number = 1): void {
    const cfg = BALANCE_CONFIG.weather.drip;
    if (Math.random() >= spawnRate * this.deltaTime) return;
    const b = SCENE_GROUND_BOUNDS[this.currentScene];
    const topY = Math.min(b[1], b[3]); // 地面梯形远边 Y
    const botY = b[10];                // 地面梯形近边 Y
    const landY = topY + Math.random() * (botY - topY);
    const [gLeft, gRight] = this.getGroundBoundsAtY(landY);
    const x = gLeft + Math.random() * (gRight - gLeft);
    const vy = (cfg.vyMin + Math.random() * cfg.vyRange) * speedMult;
    const fallTime = (landY - cfg.emitter.spawnY) / vy;
    this.weatherParticles.push({
      x, y: cfg.emitter.spawnY,
      vx: 0, vy,
      life: fallTime + 0.5, maxLife: fallTime + 0.5,
      size: cfg.sizeMin + Math.random() * cfg.sizeRange,
      color: cfg.color,
      type: ParticleType.DRIP,
      targetY: landY,
    });
  }

  /** 地面透视缩放（与 RoachRenderer.groundPerspectiveScale 同规则：固定设计坐标 farY(350) minScale → nearY(960) maxScale） */
  private groundPerspectiveScaleAt(y: number): number {
    const pc = BALANCE_CONFIG.render.roach.perspective;
    const t = Math.max(0, Math.min(1, (pc.nearY - y) / (pc.nearY - pc.farY)));
    return pc.maxScale - t * (pc.maxScale - pc.minScale);
  }

  /**
   * 波次灯光序列触发（地下室/医院，每波 doWaveSpawn 时调用）
   * 从当前亮度/红光状态接续进入新序列；波次超出配置表时取最后一项（波6 氛围延续）
   */
  startWaveFlicker(wave: number): void {
    if (this.currentScene !== SceneType.BASEMENT && this.currentScene !== SceneType.HOSPITAL) return;
    const cfgs = BALANCE_CONFIG.weather.flicker.waveLighting;
    if (cfgs.length === 0) return;
    this.flickerWaveIndex = Math.min(Math.max(0, wave - 1), cfgs.length - 1);
    this.flickerSegIndex = 0;
    this.flickerSegElapsed = 0;
    this.flickerFromBrightness = this.flickerBrightness;
    this.flickerFromRed = this.flickerRed;
    this.flickerSeqActive = true;
    this.flickerJitter = false;
  }

  /** 波次灯光序列逐段推进（每帧调用；snap 段首骤变，其余段线性渐变，结束后稳定到战斗亮度/持续微抖） */
  private updateWaveFlicker(): void {
    const fc = BALANCE_CONFIG.weather.flicker;
    if (this.flickerSeqActive && this.flickerWaveIndex >= 0) {
      const waveCfg = fc.waveLighting[this.flickerWaveIndex];
      const seg = waveCfg.seq[this.flickerSegIndex];
      if (!seg) { this.flickerSeqActive = false; return; }
      this.flickerSegElapsed += this.deltaTime;
      const t = seg.d > 0 ? Math.min(1, this.flickerSegElapsed / seg.d) : 1;
      const targetRed = seg.red ?? 0;
      if (seg.snap) {
        this.flickerBrightness = seg.b;
        this.flickerRed = targetRed;
      } else {
        this.flickerBrightness = this.flickerFromBrightness + (seg.b - this.flickerFromBrightness) * t;
        this.flickerRed = this.flickerFromRed + (targetRed - this.flickerFromRed) * t;
      }
      if (t >= 1) {
        this.flickerSegIndex++;
        this.flickerSegElapsed = 0;
        this.flickerFromBrightness = seg.b;
        this.flickerFromRed = targetRed;
        if (this.flickerSegIndex >= waveCfg.seq.length) {
          // 序列结束：稳定到战斗基准亮度，按配置进入持续微抖
          this.flickerSeqActive = false;
          this.flickerJitter = waveCfg.jitter ?? false;
          this.flickerBrightness = waveCfg.combat;
          this.flickerRed = 0;
        }
      }
    } else if (this.flickerJitter && this.flickerWaveIndex >= 0) {
      // 持续微抖（电压不稳长尾）：双频 sin 确定性合成，围绕战斗亮度小幅波动
      const j = fc.jitter;
      const combat = fc.waveLighting[this.flickerWaveIndex].combat;
      this.flickerBrightness = combat
        + Math.sin(this.time * j.freq) * j.amp * 0.6
        + Math.sin(this.time * j.freq * 2.7 + 1.3) * j.amp * 0.4;
    }
  }

  /**
   * 地下室/医院灯光状态（渲染层驱动）
   * brightness：综合亮度（1=正常，0=全黑，>1=过冲提亮）；red：微红强度 0-1
   */
  getFlickerState(): { brightness: number; red: number } {
    return { brightness: this.flickerBrightness, red: this.flickerRed };
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
    // 门禁校验：满级/层门槛/前置满级/互斥组/预留槽
    if (!canUpgradeTalent(def, this.progress.talentTree.talents).ok) return false;
    if (this.progress.talentTree.points < def.cost) return false;

    this.progress.talentTree.points -= def.cost;
    this.progress.talentTree.talents[talentId] = (this.progress.talentTree.talents[talentId] || 0) + 1;

    this.recalcTalentMultipliers();
    this.saveProgress();
    // 天赋加点后立即检查成就（首次加点/三系首次加点等），菜单加点也能即时解锁
    this.checkAchievements();
    return true;
  }

  /** 重置天赋树：清空全部天赋等级，按 等级×费用 返还全部投入点数 */
  resetTalentTree(): number {
    const tree = this.progress.talentTree;
    let refund = 0;
    for (const def of TALENT_DEFS) {
      refund += (tree.talents[def.id] || 0) * def.cost;
    }
    tree.talents = {};
    tree.points += refund;
    this.recalcTalentMultipliers();
    this.saveProgress();
    return refund;
  }

  addTalentPoints(points: number) {
    this.progress.talentTree.points += points;
    this.saveProgress();
  }

  /** 天赋是否已激活（等级 > 0） */
  private hasTalent(id: string): boolean {
    return (this.progress.talentTree.talents[id] || 0) > 0;
  }

  /** 天赋外观进化：火焰束变体（T5 过载核心，其次 T3 蓝焰基石；聚能长枪不再改变火焰主体） */
  private getFlameVariant(): 'normal' | 'blue' | 'overdrive' {
    if (this.hasTalent('overdrive')) return 'overdrive';
    if (this.hasTalent('bluecore')) return 'blue';
    return 'normal';
  }

  /**
   * 天赋渐进强化：伤害强度（伤害乘算-1）与射程聚焦（射程乘算-1）
   * 驱动火焰量变视觉（粒子尺寸/余烬比/张角/流速/火束宽度），幅度克制避免遮挡蟑螂
   */
  private getFlameBoost(): { intensity: number; focus: number } {
    return {
      intensity: Math.max(0, (this.talentMultipliers.damageMultiplier || 1) - 1),
      focus: Math.max(0, (this.talentMultipliers.fireRangeMultiplier || 1) - 1),
    };
  }

  /**
   * 天赋外观进化：枪身贴图分级
   * 0 = 默认；1 = 猛火+长枪系合计投入 ≥8 点；2 = 激活任一 T5 终端基石或合计 ≥14 点
   * 贴图缺失时回退默认（gun_mk1/gun_mk2 当前为 gun.png 占位复制件，待美术替换）
   */
  private getGunTier(): 0 | 1 | 2 {
    const talents = this.progress.talentTree.talents;
    const gunSpent = branchSpentPoints(talents, 'inferno') + branchSpentPoints(talents, 'lance');
    if (this.hasTalent('overdrive') || this.hasTalent('lance') || gunSpent >= 14) return 2;
    if (gunSpent >= 8) return 1;
    return 0;
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
    RenderUtils.renderMovementRange(ctx, this.currentScene, this.defenseLineY(), (y) => this.getGroundBoundsAtY(y), this.width);
  }

  /**
   * 调试渲染：喷火枪攻击范围（火焰束）与辐射范围（火焰粒子区）矩形框。
   * - 束矩形（红）：宽 2×beamHalfWidth，自喷嘴向上 flameRangeRatio×fireRange，标注各高度衰减后伤害百分比
   * - 辐射矩形（绿）：火焰粒子区圆的外接矩形（圆心位于喷嘴前方 range/2，半径 range×0.8），平坦伤害无衰减
   * 两个框体尺寸均随天赋射程加成（fireRangeMultiplier）增长。
   */
  renderFlameDebugRanges(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    if (!p) return;
    const colCfg = BALANCE_CONFIG.collision;
    const nozzleY = p.y - BALANCE_CONFIG.player.nozzleOffsetY;

    // 攻击范围（束）：与 CollisionSystem.checkFlameCollisions 判定一致
    const beamRange = p.fireRange * colCfg.flameRangeRatio;
    const beamHW = colCfg.beamHalfWidth;
    // 辐射范围（粒子区）：与 ParticleSpawner.spawnConeFire 火区一致
    const zoneRange = p.fireRange * 0.5;
    const zoneR = zoneRange * 0.8;
    const zoneCy = nozzleY - zoneRange / 2;

    ctx.save();
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // --- 束矩形（红虚线） ---
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(p.x - beamHW, nozzleY - beamRange, beamHW * 2, beamRange);
    ctx.setLineDash([]);
    // 衰减刻度线 + 伤害百分比（falloff = 1 - t × flameFalloffFactor）
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const y = nozzleY - beamRange * t;
      const dmgPct = Math.round((1 - t * colCfg.flameFalloffFactor) * 100);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - beamHW, y);
      ctx.lineTo(p.x + beamHW, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      ctx.fillText(`${dmgPct}%`, p.x + beamHW + 4, y);
    }
    ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
    ctx.fillText(`束 ${Math.round(beamRange)}px`, p.x + beamHW + 4, nozzleY - beamRange - 10);

    // --- 辐射矩形（绿虚线，火区圆外接矩形） ---
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(p.x - zoneR, zoneCy - zoneR, zoneR * 2, zoneR * 2);
    ctx.setLineDash([]);
    // 火区真实判定圆（细线）
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, zoneCy, zoneR, 0, Math.PI * 2);
    ctx.stroke();
    // 辐射伤害 = 总DPS × (1 - 束占比) × 伤害倍率，平坦无衰减
    const wd = BALANCE_CONFIG.weaponDamage;
    const zoneDps = (this.difficulty === 'hard' ? wd.flamethrower.hard : wd.flamethrower.easy)
      * (1 - wd.flamethrowerBeamShare) * (p.damageMultiplier || 1);
    ctx.fillStyle = 'rgba(74, 222, 128, 0.95)';
    ctx.fillText(`辐射 r=${Math.round(zoneR)}px`, p.x + zoneR + 4, zoneCy - zoneR + 6);
    ctx.fillText(`${zoneDps.toFixed(1)}/s 无衰减`, p.x + zoneR + 4, zoneCy - zoneR + 20);

    ctx.restore();
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
      bgImages: this.getBgImages(),
    });
    /** 显示移动范围叠加层（玩家可走区域的半透明可视化） */
    if (this.showMovementRange) {
      this.renderMovementRange(ctx);
    }
    WeatherSystem.renderWeatherBackground(ctx, w, h, this.lightningFlash, this.lightningBolt);
    BackgroundRenderer.renderFireZones(ctx, {
      player: this.player,
      tripleFlameState: this.tripleFlameSystem!.getState(),
      time: this.time,
      flameVariant: this.getFlameVariant(),
      damageIntensity: this.getFlameBoost().intensity,
    });
    ParticleSystem.renderFireWalls(ctx, this.fireWalls, this.time);
    this.renderStickyBoards();
    this.renderStickyDrops(ctx);
    this.renderWeaponDrops(ctx);
    this.renderParticles(ctx);
    this.renderBaitMark(ctx);
    // Render placed bombs with fire glow + countdown zoom effect
    if (this.placedBombs.length > 0) {
      const PB = BALANCE_CONFIG.timedBomb.placed;
      const bombSize = PB.bombSize;
      for (const bomb of this.placedBombs) {
        ctx.save();
        ctx.translate(bomb.x, bomb.y);

        // Fire glow pulse (intensifies as timer counts down)
        const secs = Math.ceil(bomb.timer);
        const urgency = Math.max(0, 1 - bomb.timer / PB.fuseDuration); // 0→1 as timer goes fuseDuration→0
        const pulseRadius = bombSize * PB.glowRadiusRatio + urgency * PB.glowRadiusUrgency + Math.sin(this.time * PB.glowPulseFreq) * urgency * PB.glowPulseAmp;
        const glowAlpha = PB.glowAlphaBase + urgency * PB.glowAlphaUrgency;
        const fireGradient = ctx.createRadialGradient(0, 0, bombSize * PB.glowInnerRatio, 0, 0, pulseRadius);
        fireGradient.addColorStop(0, `rgba(${PB.glowColorInner}, ${glowAlpha})`);
        fireGradient.addColorStop(0.5, `rgba(${PB.glowColorMid}, ${glowAlpha * PB.glowMidAlphaRatio})`);
        fireGradient.addColorStop(1, `rgba(${PB.glowColorEdge}, 0)`);
        ctx.fillStyle = fireGradient;
        ctx.beginPath();
        ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Bomb image
        const img = this.bombImg;
        if (img) {
          ctx.drawImage(img, -bombSize / 2, -bombSize / 2, bombSize, bombSize);
        } else {
          ctx.fillStyle = PB.fallbackColor;
          ctx.beginPath();
          ctx.arc(0, 0, bombSize / PB.fallbackRadiusRatio, 0, Math.PI * 2);
          ctx.fill();
        }

        // Countdown number with zoom effect (scales up as timer decreases)
        const countColor = bomb.timer <= PB.urgentThreshold ? PB.countdownUrgentColor : PB.countdownColor;
        const countScale = PB.countdownScaleBase + urgency * PB.countdownScaleUrgency;
        ctx.save();
        ctx.scale(countScale, countScale);
        ctx.font = PB.countdownFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = countColor;
        ctx.strokeStyle = PB.countdownStrokeColor;
        ctx.lineWidth = PB.countdownLineWidth;
        ctx.shadowColor = PB.countdownShadowColor;
        ctx.shadowBlur = PB.countdownShadowBlur;
        const countY = (-bombSize / 2 - PB.countdownYOffset) / countScale;
        ctx.strokeText(`${secs}`, 0, countY);
        ctx.fillText(`${secs}`, 0, countY);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Urgent flash ring at last second
        if (bomb.timer <= PB.urgentThreshold) {
          const flashAlpha = PB.flashAlphaBase + Math.sin(this.time * PB.flashFreq) * PB.flashAlphaAmp;
          ctx.strokeStyle = `rgba(${PB.flashColor}, ${flashAlpha})`;
          ctx.lineWidth = PB.flashLineWidth;
          ctx.beginPath();
          ctx.arc(0, 0, pulseRadius * PB.flashRadiusRatio, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }
    }
    // ===== TIMED SUICIDE: Render dead body bombs (red flashing corpse + countdown) =====
    if (this.deadTimedBombs.length > 0) {
      const CB = BALANCE_CONFIG.timedBomb.corpse;
      for (const bomb of this.deadTimedBombs) {
        ctx.save();
        ctx.translate(bomb.x, bomb.y);
        // Red flashing corpse body (pulsing glow)
        const flashIntensity = CB.flashBase + Math.sin(bomb.flashPhase * CB.flashFreq) * CB.flashAmp;
        const corpseRadius = CB.corpseRadius;
        // Outer glow pulse
        const glowGradient = ctx.createRadialGradient(0, 0, corpseRadius * CB.glowInnerRatio, 0, 0, corpseRadius * CB.glowOuterRatio);
        glowGradient.addColorStop(0, `rgba(${CB.glowColorInner}, ${CB.glowAlphaInnerBase + flashIntensity * CB.glowAlphaInnerAmp})`);
        glowGradient.addColorStop(0.5, `rgba(${CB.glowColorMid}, ${CB.glowAlphaMidBase + flashIntensity * CB.glowAlphaMidAmp})`);
        glowGradient.addColorStop(1, `rgba(${CB.glowColorEdge}, 0)`);
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(0, 0, corpseRadius * CB.glowOuterRatio, 0, Math.PI * 2);
        ctx.fill();
        // Corpse body (dark red, slightly flattened)
        ctx.fillStyle = `rgba(${CB.bodyColor}, ${CB.bodyAlphaBase + flashIntensity * CB.bodyAlphaAmp})`;
        ctx.beginPath();
        ctx.ellipse(0, CB.bodyYOffset, corpseRadius, corpseRadius * CB.bodyYScale, 0, 0, Math.PI * 2);
        ctx.fill();
        // Corpse border (bright red pulse)
        ctx.strokeStyle = `rgba(${CB.borderColor}, ${CB.borderAlphaBase + flashIntensity * CB.borderAlphaAmp})`;
        ctx.lineWidth = CB.borderLineWidth;
        ctx.stroke();
        // Skull icon (simple X eyes)
        ctx.fillStyle = `rgba(${CB.skullColor}, ${CB.skullAlphaBase + flashIntensity * CB.skullAlphaAmp})`;
        ctx.font = CB.skullFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀', 0, CB.skullYOffset);
        // Countdown number (large, above corpse)
        const secs = Math.ceil(bomb.timer);
        const countColor = bomb.timer <= CB.urgentThreshold ? CB.countdownUrgentColor : CB.countdownColor;
        const countScale = 1 + (bomb.timer <= CB.urgentThreshold ? CB.countdownPulseAmp : 0) * Math.sin(bomb.flashPhase * CB.countdownPulseFreq);
        ctx.font = `bold ${Math.floor(CB.countdownFontSize * countScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = countColor;
        ctx.shadowColor = CB.countdownShadowColor;
        ctx.shadowBlur = CB.countdownShadowBlur;
        ctx.fillText(`${secs}`, 0, -corpseRadius - CB.countdownYOffset);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
    this.renderRoaches(ctx);

    // ===== 须须干扰器雷达波特效（jammerActiveTimer 驱动：防线X中心向上发射扩散波环） =====
    if (this.jammerActiveTimer > 0) {
      const JM = BALANCE_CONFIG.jammer;
      const elapsed = JM.duration - this.jammerActiveTimer;
      const jamCx = this.width / 2;
      const jamBaseY = this.defenseLineY() - 10;
      const ringInterval = 0.45;   // 波环发射间隔（秒）
      const ringLife = 1.5;        // 单环存活（秒）
      const ringRise = 340;        // 上升总距离（像素）
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // 发射口常驻脉冲光点
      const emitPulse = 0.5 + 0.5 * Math.sin(this.time * 10);
      ctx.fillStyle = `rgba(192, 132, 252, ${0.25 + 0.3 * emitPulse})`;
      ctx.beginPath();
      ctx.arc(jamCx, jamBaseY, 6 + 4 * emitPulse, 0, Math.PI * 2);
      ctx.fill();
      // 上升扩散波环（自下而上、渐宽渐隐，透视压扁）
      for (let k = 0; k * ringInterval <= elapsed; k++) {
        const rt = elapsed - k * ringInterval; // 该环已存活时长
        if (rt > ringLife) continue;
        const p = rt / ringLife;               // 0→1
        const ry = jamBaseY - p * ringRise;
        const radius = 24 + p * 230;
        const alpha = (1 - p) * 0.5;
        ctx.strokeStyle = `rgba(192, 132, 252, ${alpha})`;
        ctx.lineWidth = Math.max(0.8, 2.5 - p * 1.7);
        ctx.beginPath();
        ctx.ellipse(jamCx, ry, radius, radius * 0.32, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        // 环内提亮弧（上半弧内侧细线，增强雷达波体积感）
        ctx.strokeStyle = `rgba(233, 213, 255, ${alpha * 0.6})`;
        ctx.lineWidth = Math.max(0.6, 1.2 - p * 0.6);
        ctx.beginPath();
        ctx.ellipse(jamCx, ry, radius * 0.72, radius * 0.72 * 0.32, 0, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 调试：喷火枪攻击范围（束）与辐射范围（粒子区）矩形框
    if (this.showFlameDebug) {
      this.renderFlameDebugRanges(ctx);
    }

    // 地铁场景：列车预警/列车序列帧渲染（列车覆盖在蟑螂之上，表现碾压）
    // this.trainSystem!.render(ctx, this._trainFrames);
    // 地铁场景调试可视化：防线 / 贝塞尔曲线 / 车头碰撞圆（已关闭）
    // this.trainSystem!.renderDebug(ctx);
    // 斩螂·110：飞跃中的刀刃
    this.knifeSystem!.render(ctx, this._dropImages?.['knife'] ?? null);

    // ===== MUTANT SPAWN: Green slime burst visual =====
    if (this.roachAISystem!.slimeBurstTimer > 0) {
      const SB = BALANCE_CONFIG.slimeBurst;
      const progress = 1 - this.roachAISystem!.slimeBurstTimer / SB.duration; // 0→1 over SB.duration s
      const sx = this.roachAISystem!.slimeBurstX;
      const sy = this.roachAISystem!.slimeBurstY;
      const alpha = Math.max(0, 1 - progress * SB.alphaFade);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';

      // 1. Central green glow
      const glowR = SB.glowRadiusBase + progress * SB.glowRadiusGrowth;
      const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      glowGrad.addColorStop(0, `rgba(${SB.glowColorInner}, ${alpha * SB.glowAlphaInner})`);
      glowGrad.addColorStop(SB.glowMidStop, `rgba(${SB.glowColorMid}, ${alpha * SB.glowAlphaMid})`);
      glowGrad.addColorStop(1, `rgba(${SB.glowColorEdge}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // 2. Green slime droplets spreading outward
      const dropCount = SB.emitter.dropCount;
      for (let di = 0; di < dropCount; di++) {
        const baseAngle = (di / dropCount) * Math.PI * 2 + di * SB.emitter.dropAngleJitter;
        const spreadDist = progress * SB.dropSpreadDist;
        const dropX = sx + Math.cos(baseAngle) * spreadDist;
        const dropY = sy + Math.sin(baseAngle) * spreadDist * SB.dropYScale;
        const dropSize = (SB.dropSizeBase + di % 3 * SB.dropSizeStep) * (1 - progress * SB.dropSizeFade);
        const dropAlpha = alpha * (SB.dropAlphaBase + (di % 3) * SB.dropAlphaStep);

        // Glow behind each droplet
        const dGlow = ctx.createRadialGradient(dropX, dropY, 0, dropX, dropY, dropSize * SB.dropGlowScale);
        dGlow.addColorStop(0, `rgba(${SB.dropGlowColor}, ${dropAlpha * SB.dropGlowAlpha})`);
        dGlow.addColorStop(1, `rgba(${SB.dropGlowEdgeColor}, 0)`);
        ctx.fillStyle = dGlow;
        ctx.beginPath();
        ctx.arc(dropX, dropY, dropSize * SB.dropGlowScale, 0, Math.PI * 2);
        ctx.fill();

        // Solid droplet core
        ctx.fillStyle = `rgba(${SB.dropCoreColor}, ${dropAlpha})`;
        ctx.beginPath();
        ctx.arc(dropX, dropY, dropSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Outer slime ring
      const ringR = SB.ringRadiusBase + progress * SB.ringRadiusGrowth;
      ctx.strokeStyle = `rgba(${SB.ringColor}, ${alpha * SB.ringAlpha})`;
      ctx.lineWidth = SB.ringLineWidth;
      ctx.beginPath();
      ctx.ellipse(sx, sy, ringR, ringR * SB.ringYScale, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // ===== HEAL BUFF: Rising green plus signs on healed roaches =====
    // Drawn in world coordinates after all roaches for visibility
    const HB = BALANCE_CONFIG.healBuff;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (const r of this.roaches) {
      if (r.healBuffTimer && r.healBuffTimer > 0 && r.state === RoachState.ALIVE) {
        const buffProgress = r.healBuffTimer / HB.duration; // 1→0
        const baseAlpha = HB.baseAlphaMax * buffProgress;
        const size = r.size ?? 30;

        // 1. Large green glow halo around healed roach
        const haloR = size * HB.haloRadiusRatio;
        const haloGrad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, haloR * 2);
        haloGrad.addColorStop(0, `rgba(${HB.haloColorInner}, ${baseAlpha * HB.haloAlphaInner})`);
        haloGrad.addColorStop(HB.haloMidStop, `rgba(${HB.haloColorMid}, ${baseAlpha * HB.haloAlphaMid})`);
        haloGrad.addColorStop(1, `rgba(${HB.haloColorEdge}, 0)`);
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, haloR * 2, haloR * 2 * HB.haloYScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Outer pulsing ring
        const pulseRingR = size * (HB.ringRadiusBase + Math.sin(this.time * HB.ringPulseFreq) * HB.ringRadiusAmp);
        ctx.strokeStyle = `rgba(${HB.ringColor}, ${baseAlpha * HB.ringAlpha})`;
        ctx.lineWidth = HB.ringLineWidth;
        ctx.shadowColor = `rgba(${HB.ringShadowColor}, ${baseAlpha})`;
        ctx.shadowBlur = HB.ringShadowBlur;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, pulseRingR, pulseRingR * HB.ringYScale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 3. Rising green plus signs (large + strong glow)
        const plusCount = HB.emitter.plusCount;
        for (let pi = 0; pi < plusCount; pi++) {
          const cycleOffset = pi * (HB.emitter.plusCycle / plusCount);
          const cycleTime = (this.time + cycleOffset + r.id * HB.plusIdPhase) % HB.emitter.plusCycle;
          const riseProgress = cycleTime / HB.emitter.plusCycle;

          const plusY = r.y - riseProgress * HB.plusRiseHeight;
          const orbitAngle = this.time * HB.plusOrbitSpeed + pi * HB.emitter.plusOrbitSpread + r.id;
          const orbitR = HB.plusOrbitRadius * (HB.plusOrbitBase + riseProgress);
          const plusX = r.x + Math.cos(orbitAngle) * orbitR;

          const plusAlpha = baseAlpha * Math.min(1, riseProgress * HB.plusAlphaRiseRate) * (1 - Math.pow(riseProgress, HB.plusAlphaFallExp));
          if (plusAlpha <= HB.plusAlphaMin) continue;

          const plusSize = HB.plusSizeBase + riseProgress * HB.plusSizeGrowth;

          ctx.save();
          ctx.translate(plusX, plusY);
          ctx.rotate(Math.sin(this.time * HB.plusRotateSpeed + pi + r.id) * HB.plusRotateAmp);

          // Strong outer glow
          ctx.shadowColor = `rgba(${HB.plusGlowColor}, ${plusAlpha})`;
          ctx.shadowBlur = HB.plusGlowBlur;

          // Thick green plus sign
          ctx.fillStyle = `rgba(${HB.plusColor}, ${plusAlpha})`;
          const barW = Math.max(HB.plusBarWidthMin, plusSize * HB.plusBarWidthRatio);
          const barL = plusSize;
          ctx.fillRect(-barW / 2, -barL / 2, barW, barL);
          ctx.fillRect(-barL / 2, -barW / 2, barL, barW);

          // Bright white center
          ctx.shadowBlur = HB.plusCenterGlowBlur;
          ctx.shadowColor = `rgba(${HB.plusCenterGlowColor}, ${plusAlpha})`;
          ctx.fillStyle = `rgba(${HB.plusCenterColor}, ${plusAlpha * HB.plusCenterAlpha})`;
          const cw = barW * HB.plusCenterScale;
          ctx.fillRect(-cw / 2, -cw / 2, cw, cw);

          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // 4. Bright green tint overlay on roach body
        ctx.fillStyle = `rgba(${HB.tintColor}, ${baseAlpha * HB.tintAlpha})`;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, size * HB.tintWRatio, size * HB.tintHRatio, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // ===== 超市阵型：同阵型成员灰色虚线链接（连向阵型质心，标示归属；V4.0） =====
    {
      const SM = BALANCE_CONFIG.supermarket;
      const linkGroups = new Map<number, Roach[]>();
      for (const r of this.roaches) {
        if (r.formationId == null || r.state !== RoachState.ALIVE) continue;
        let arr = linkGroups.get(r.formationId);
        if (!arr) { arr = []; linkGroups.set(r.formationId, arr); }
        arr.push(r);
      }
      if (linkGroups.size > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(${SM.formationLinkColor}, ${SM.formationLinkAlpha})`;
        ctx.lineWidth = SM.formationLinkWidth;
        ctx.setLineDash([SM.formationLinkDash, SM.formationLinkGap]);
        for (const members of linkGroups.values()) {
          if (members.length < 2) continue;
          const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
          const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
          for (const m of members) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // ===== 超市阵型锚点：头顶彩色菱形标识（V3.1，颜色按怪物类型区分，FormationSystem 每帧维护；护盾略大、隧道工缩小） =====
    const SM = BALANCE_CONFIG.supermarket;
    for (const r of this.roaches) {
      if (!r.anchorMarkColor || r.state !== RoachState.ALIVE) continue;
      const isShield = r.type === RoachType.SHIELD;
      const s = isShield ? SM.anchorMarkSizeShield
        : r.type === RoachType.TUNNEL_WORKER ? SM.anchorMarkSizeWorker
        : SM.anchorMarkSize;
      const cy = r.y - (r.size ?? 30) / 2 - SM.anchorMarkOffsetY;
      ctx.save();
      ctx.translate(r.x, cy);
      ctx.rotate(Math.PI / 4); // 正方形旋转45°成菱形
      ctx.shadowColor = r.anchorMarkColor;
      ctx.shadowBlur = isShield ? 10 : 6;
      ctx.fillStyle = r.anchorMarkColor;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; // 白色描边增强识别度
      ctx.lineWidth = isShield ? 2 : 1.5;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }

    // Render egg pods (boss battle)
    if (this.bossBattle.active) {
      this.renderEggPods(ctx);
    }
    // ===== 巢穴·蟑老大 Boss 战：地面阴影（贴地）→ Boss 本体 → 风流线 → 炸弹/轨迹/落点标记 =====
    if (this.bossKingSystem?.isActive()) {
      const bkState = this.bossKingSystem.getState();
      BossKingRenderer.renderBossShadow(ctx, w, h, bkState, this.time);
      BossKingRenderer.renderBoss(ctx, w, h, bkState, this._bossKingFrames as Map<string, HTMLImageElement[]>, this.time);
      BossKingRenderer.renderWindStreaks(ctx, w, h, bkState, this.defenseLineY(), this.time);
      BossKingRenderer.renderBombs(ctx, this.bossKingSystem.bombs.getBombs(), this.bossBombImg, this.time);
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

    // ===== 巢穴·蟑老大：屏幕汁液遮罩 + Boss 血条 HUD（屏幕空间覆盖层，主变换外，模拟溅到"镜头"上） =====
    if (this.bossKingSystem) {
      BossKingRenderer.renderGoo(ctx, w, h, this.bossKingSystem.bombs.getGoos());
      if (this.bossKingSystem.isActive()) {
        BossKingRenderer.renderHUD(ctx, w, this.bossKingSystem.getState());
      }
    }

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
      ctx.fillText(TEXT_CONFIG.combat.overheatWarningHud.text(secondsLeft), w / 2, h / 2);
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
    // Egg pod rendering removed — system decommissioned
  }

  // ========== INSECTICIDE SPRAY RENDERING (delegated to RenderUtils static method) =========

  // ========== RADAR LASER RENDERING =========
  /** 渲染雷达激光（委托给 RenderUtils 静态方法，目标由调用方预解析） */
  renderRadarLaser(ctx: CanvasRenderingContext2D) {
    const rl = this.radarLaserSystem!.getState();
    if (!rl.active) return;
    const target = this.roaches.find(r => r.id === rl.targetId && r.state === RoachState.ALIVE) ?? null;
    RenderUtils.renderRadarLaser(ctx, target, rl.active, rl.timer, this.player.x, this.player.y, this.time);
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
    DropRenderer.renderWeaponDrops(ctx, this.weaponSystem!.getWeaponDrops(), this.time, this._dropImages ?? undefined);
  }

  // Render flying bait jar (parabolic arc from player to target roach)
  renderBaitThrow(ctx: CanvasRenderingContext2D) {
    ConsumableSystem.renderBaitThrow(ctx, this.consumableSystem!.baitThrowAnim, this.time);
  }

  // Render bait jar shatter mark and scent aura on the ground
  renderBaitMark(ctx: CanvasRenderingContext2D) {
    // 诱饵专精：渐隐按有效总时长（基础 + baitDurationAdd）计算
    const baitDuration = BALANCE_CONFIG.consumable.baitDuration + (this.talentMultipliers?.baitDurationAdd || 0);
    ConsumableSystem.renderBaitMark(ctx, this.consumableSystem!.baitTarget, this.player.baitTimer, this.time, baitDuration);
  }

  /** 渲染粒子（委托给 ParticleSystem 静态方法） */
  renderParticles(ctx: CanvasRenderingContext2D) {
    ParticleSystem.renderParticles(ctx, this.particles);
  }

  /** 渲染所有蟑螂敌人 */
  renderRoaches(ctx: CanvasRenderingContext2D) {
    // 收集护盾修复连线数据（隧道工 → 护盾蟑螂）
    const repairLinePairs: Array<{ workerX: number; workerY: number; shieldX: number; shieldY: number }> = [];
    const subCfg = BALANCE_CONFIG.subway;
    for (const r of this.roaches) {
      if (r.type !== RoachType.TUNNEL_WORKER || r.state !== RoachState.ALIVE) continue;
      if (r.shieldFollowTargetId == null) continue;
      const target = this.roaches.find(o => o.id === r.shieldFollowTargetId && o.state === RoachState.ALIVE && o.type === RoachType.SHIELD);
      if (!target || (target.shieldBrokenTimer ?? 0) > 0) continue;
      const dx = target.x - r.x;
      const dy = target.y - r.y;
      if (dx * dx + dy * dy > subCfg.shieldRepairRange * subCfg.shieldRepairRange) continue;
      if ((target.shieldHp ?? 0) >= (target.maxShieldHp ?? subCfg.shieldMaxHp)) continue;
      repairLinePairs.push({ workerX: r.x, workerY: r.y, shieldX: target.x, shieldY: target.y });
    }

    RoachRenderer.renderRoaches({
      roachImg: this.roachImg, roachFlyingImg: this.roachFlyingImg,
      roachSuicideImg: this.roachSuicideImg, roachTimedSuicideImg: this.roachTimedSuicideImg,
      roachNurseImg: this.roachNurseImg, roachMutantImg: this.roachMutantImg,
      roachArmoredImg: this.roachArmoredImg, roachSplittingImg: this.roachSplittingImg,
      roachFlyingSuicideImg: this.roachFlyingSuicideImg, roachQueenImg: this.roachQueenImg,
      roachTunnelWorkerImg: this.roachTunnelWorkerImg,
      roachSubwayEliteImg: this.roachSubwayEliteImg,
      roachShieldImg: this.roachShieldImg,
      roachJockImg: this.roachJockImg,
      debuffPoisonImg: this.debuffPoisonImg,
      debuffJammerImg: this.debuffJammerImg,
      mutantTransformFrames: this.mutantTransformFrames,
      imagesLoaded: this.imagesLoaded, time: this.time, deltaTime: this.deltaTime,
      defenseLineY: this.defenseLineY(), canvasHeight: this.height,
      bossBattle: this.bossBattle, bossAnimState: this.bossAnimState, bossAnimFrames: this.bossAnimFrames,
      onAddParticle: (p) => { this.particles.push(p); },
      onSpawnShockwaveRing: (x, y, count) => { ParticleSpawner.spawnShockwaveRing(this.particles,x, y, count); },
      isStuckByBoard: (id) => this.isStuckByBoard(id),
      showShieldRange: this.showShieldRange,
      repairLinePairs,
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
      const tfState = this.tripleFlameSystem!.getState();

      ctx.save();
      ctx.translate(gx, py);
      ctx.scale(sideScale, sideScale);

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(3 * s, 8 * s, 22 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // ===== 三重火焰侧枪：barrel.png 贴图（58×109 竖长枪管，宽度按原比例等比） =====
      // 中心位置与主枪一致（-80玩家单位×0.6），Y 由 sideBarrelYOffset 调整；X 间距由 sideOffset 控制（⚠玩法）
      if (isSideGun && this.barrelImg && this.imagesLoaded && tfState.sideBarrelHeight) {
        const bh = tfState.sideBarrelHeight * s;
        const bw = bh * (this.barrelImg.width / this.barrelImg.height);
        ctx.save();
        ctx.translate(0, -80 * s * 0.6 + (tfState.sideBarrelYOffset ?? 0) * s);
        ctx.drawImage(this.barrelImg, -bw / 2, -bh / 2, bw, bh);
        ctx.restore();
      } else if (this.gunImg && this.imagesLoaded) {
        // 贴图为 256×256 正方形：宽高同值按 1:1 绘制（修复旧版 60×80 导致的 X 轴压扁）
        const gw = 80 * s;
        const gh = 80 * s;
        ctx.save();
        ctx.translate(0, -gh * 0.6);

        if (p.currentWeapon === 'sticky') {
          ctx.filter = 'hue-rotate(180deg)';
        } else if (p.currentWeapon === 'poison') {
          ctx.filter = 'hue-rotate(270deg)';
        }

        // 天赋外观进化：按改装等级切换枪身贴图（mk1/mk2 缺失时回退默认）
        const gunTier = this.getGunTier();
        const gunImg = (gunTier === 2 && this.gunMk2Img) ? this.gunMk2Img
          : (gunTier === 1 && this.gunMk1Img) ? this.gunMk1Img
          : this.gunImg;
        ctx.drawImage(gunImg, -gw / 2, -gh / 2, gw, gh);
        ctx.filter = 'none';
        ctx.restore();
      } else {
        ctx.fillStyle = isSideGun ? '#666' : '#555';
        ctx.fillRect(-6 * s, -56 * s, 12 * s, 40 * s);
        ctx.fillStyle = isSideGun ? '#888' : '#777';
        ctx.fillRect(-5 * s, -64 * s, 10 * s, 10 * s);
      }

      // ===== 天赋外观进化：枪体改造覆盖层（寒钢枪管/过载核心/聚能长枪） =====
      this.renderGunEvolution(ctx, s);

      // ===== HEAT WARNING: red pulsing glow 3 seconds before overheat =====
      // DEBUG: Always show warning for testing - drawn in screen coords after gun restore
      // (will be drawn in render() instead)

      ctx.restore();
    }

    // ===== 射程红点：基础火枪射程位置标记（方便调距查看）=====
    {
      const nozzleY = p.y - BALANCE_CONFIG.player.nozzleOffsetY;
      const dotY = nozzleY - BALANCE_CONFIG.player.baseFireRange; // 260px 处
      const pulse = 1 + 0.25 * Math.sin(this.time * 5);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, dotY, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, dotY, 9 * pulse, 0, Math.PI * 2);
      ctx.stroke();
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
      ctx.fillText(TEXT_CONFIG.combat.reloadingText.text, this.width / 2, this.height / 2 - 20);
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

  /**
   * 天赋外观进化：枪体改造覆盖层
   * 在 renderPlayer 的枪体坐标系内调用（原点 = 玩家锚点，长度值 × s 换算像素）
   * - steel（寒钢枪管）：无独立特效，仅将喷嘴圆环染色为寒钢蓝
   * - overdrive（过载核心）：枪体深红脉动辉光
   * - lance（聚能长枪）：枪口白热聚能环
   * - nozzle（扩口喷嘴）：喷嘴圆环（1级1个→3级3个，椭圆压扁+底部缺口）
   * - focus（风压聚焦）：枪体贴图配件——涡轮风机组件（固定枪体、单片旋转、内吸），取代原扩散波纹
   * （耐热合金/散热鳍片/扩容气罐按需求无视觉特效）
   */
  private renderGunEvolution(ctx: CanvasRenderingContext2D, s: number) {
    const hasOverdrive = this.hasTalent('overdrive');
    const hasLance = this.hasTalent('lance');
    const focusLv = this.progress.talentTree.talents['focus'] || 0;
    if (!hasOverdrive && !hasLance && focusLv === 0) return;

    const cfg = BALANCE_CONFIG.render.renderUtils.gunEvolution;
    ctx.save();
    ctx.globalCompositeOperation = cfg.blend;

    // 过载核心：枪体辉光（画在枪管之下，先渲染）
    if (hasOverdrive) {
      const alpha = cfg.overdriveGlowAlphaBase + Math.sin(this.time * cfg.overdriveGlowFreq) * cfg.overdriveGlowAlphaAmp;
      const gr = cfg.overdriveGlowRadius * s;
      const gy = -cfg.overdriveGlowYOffset * s;
      const grad = ctx.createRadialGradient(0, gy, 0, 0, gy, gr);
      grad.addColorStop(0, `rgba(${cfg.overdriveGlowColor}, ${alpha})`);
      grad.addColorStop(1, `rgba(${cfg.overdriveGlowColor}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, gy, gr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 聚能长枪：枪口白热聚能环（椭圆压扁长宽比 + 底部缺口）+ 中心青色十字准星
    if (hasLance) {
      const alpha = cfg.lanceRingAlphaBase + Math.sin(this.time * cfg.lanceRingFreq) * cfg.lanceRingAlphaAmp;
      const rr = cfg.lanceRingRadius * s;
      const ry = -cfg.lanceRingYOffset * s;
      const gap = Math.PI * cfg.lanceRingGapRatio;
      ctx.strokeStyle = `rgba(${cfg.lanceRingColor}, ${alpha})`;
      ctx.lineWidth = cfg.lanceRingLineWidth * s;
      ctx.beginPath();
      ctx.ellipse(0, ry, rr, rr * cfg.lanceRingScaleY, 0, Math.PI / 2 + gap / 2, Math.PI * 2 + Math.PI / 2 - gap / 2);
      ctx.stroke();
      // 中心青色十字准星（随环一起脉动）
      const cs = cfg.lanceCrossSize * s;
      ctx.strokeStyle = `rgba(${cfg.lanceCrossColor}, ${alpha})`;
      ctx.lineWidth = cfg.lanceRingLineWidth * s;
      ctx.beginPath();
      ctx.moveTo(-cs, ry); ctx.lineTo(cs, ry);
      ctx.moveTo(0, ry - cs); ctx.lineTo(0, ry + cs);
      ctx.stroke();
    }

    // 涡轮增强：固定枪体的涡轮贴图配件（风机组件，随枪体移动；叶片绕轴旋转内吸）
    if (focusLv > 0) {
      const hy = -cfg.turbineYOffset * s;
      const R = cfg.turbineRadius * s;
      const rot = this.time * cfg.turbineRotateSpeed;
      const blades = cfg.turbineBlades;
      ctx.save();
      // 配件为实体贴图，用 source-over 保证不透明壳体正确呈现（不受上方 glow blend 影响）
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(0, hy);
      ctx.scale(1, cfg.turbineScaleY); // 透视压扁（椭圆），贴合枪管圆柱朝向
      ctx.strokeStyle = `rgba(${cfg.turbineShellColor}, ${cfg.turbineShellAlpha})`;
      ctx.lineWidth = Math.max(1, cfg.turbineShellWidth * s);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      // 旋转叶片：由中心延伸的叶片，转速 = turbineRotateSpeed
      ctx.fillStyle = `rgba(${cfg.turbineBladeColor}, ${cfg.turbineBladeAlpha})`;
      for (let i = 0; i < blades; i++) {
        const a = rot + (Math.PI * 2 / blades) * i;
        const tipX = Math.cos(a) * R, tipY = Math.sin(a) * R;
        const half = cfg.turbineBladeHalf * R;
        const bx = Math.cos(a + Math.PI / 2) * half, by = Math.sin(a + Math.PI / 2) * half;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tipX + bx, tipY + by);
        ctx.lineTo(tipX - bx, tipY - by);
        ctx.closePath();
        ctx.fill();
      }
      // 中心毂 + 弱青轴心点缀
      ctx.fillStyle = `rgba(${cfg.turbineShellColor}, ${cfg.turbineShellAlpha})`;
      ctx.beginPath(); ctx.arc(0, 0, cfg.turbineHubRadius * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${cfg.turbineAccentColor}, 0.85)`;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(0.8, cfg.turbineHubRadius * s * 0.35), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  // ========== THROWABLE RENDERING ==========
  renderItemPlacement(ctx: CanvasRenderingContext2D) {
    RenderUtils.renderItemPlacement(ctx, this.itemPlaceState, this.selectedItemIndex, this.inventory, this.itemPlaceCursorX, this.itemPlaceCursorY, this.itemEffectRadiusX, this.itemEffectRadiusY, this.time);
  }

  // ========== THROWABLE RENDERING (delegated to ThrowableSystem static method) =========

  /** 渲染电蚊拍（委托给 RenderUtils 静态方法） */
  renderSwatter(ctx: CanvasRenderingContext2D) {
    RenderUtils.renderSwatter(ctx, {
      active: this.swatterSystem!.swatterActive,
      animTimer: this.swatterSystem!.swatterAnimTimer,
      swingX: this.swatterSystem!.swatterSwingX,
      canvasWidth: this.width,
      canvasHeight: this.height,
      roaches: this.roaches,
    });
  }

  /** 渲染枪口闪光（委托给 RenderUtils 静态方法） */
  renderMuzzleFlash(ctx: CanvasRenderingContext2D) {
    RenderUtils.renderMuzzleFlash(ctx, this.player, this.tripleFlameSystem!.getState());
  }

  renderWeatherForeground(ctx: CanvasRenderingContext2D, w: number) {
    WeatherSystem.renderWeatherForeground(ctx, w, this.weatherParticles, this.height, this.getFlickerState(), this.getFlickerLampEllipses());
    this.renderDefenseLine(ctx, w);
  }

  /** 旧场景系统背景图查找表（key='{scene}_{difficulty}' 或 '{scene}'，与 BackgroundRenderer 约定一致） */
  private getBgImages(): Record<string, HTMLImageElement> {
    return {
      kitchen_hard: this.bgKitchenHardImg!,
      kitchen_easy: this.bgKitchenEasyImg!,
      kitchen: this.bgImg!,
      sewer_hard: this.bgSewerHardImg!,
      sewer_easy: this.bgSewerEasyImg!,
      sewer: this.bgSewerImg!,
      dump_hard: this.bgDumpHardImg!,
      dump_easy: this.bgDumpEasyImg!,
      dump: this.bgDumpImg!,
      basement_hard: this.bgBasementHardImg!,
      basement_easy: this.bgBasementEasyImg!,
      basement: this.bgBasementImg!,
      rooftop_hard: this.bgRooftopHardImg!,
      rooftop_easy: this.bgRooftopEasyImg!,
      rooftop: this.bgRooftopImg!,
      street_hard: this.bgStreetHardImg!,
      street_easy: this.bgStreetEasyImg!,
      street: this.bgStreetImg!,
    };
  }

  /** 当前场景背景图的实际绘制区域（与 BackgroundRenderer.renderBackground 同一套适配规则，供灯位坐标映射） */
  private getBgDrawRect(): { dx: number; dy: number; dw: number; dh: number; imgW: number; imgH: number } | null {
    const w = this.width;
    const h = this.height;
    const scene = this.getSceneConfig();
    // 新场景系统：generic cover-fit（与 BackgroundRenderer 第一分支一致）
    if (scene.bgImage) {
      const img = this.bgSceneImages[this.currentScene];
      if (!img || !img.complete || img.naturalWidth <= 0) return null;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      if (imgRatio > w / h) {
        return { dx: (w - h * imgRatio) / 2, dy: 0, dw: h * imgRatio, dh: h, imgW: img.naturalWidth, imgH: img.naturalHeight };
      }
      return { dx: 0, dy: (h - w / imgRatio) / 2, dw: w, dh: w / imgRatio, imgW: img.naturalWidth, imgH: img.naturalHeight };
    }
    // 旧场景系统：Fixed Height 居中（drawH = h，两侧裁剪）
    const imgs = this.getBgImages();
    const img = imgs[`${this.currentScene}_${this.difficulty}`] || imgs[this.currentScene];
    if (!img || !this.imagesLoaded || img.naturalWidth <= 0) return null;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    return { dx: (w - h * imgRatio) / 2, dy: 0, dw: h * imgRatio, dh: h, imgW: img.naturalWidth, imgH: img.naturalHeight };
  }

  /** 灯位光晕椭圆列表（画布逻辑坐标；由 vfx-balance weather.flicker.lamps 的背景图像素坐标按当前背景适配变换映射） */
  private getFlickerLampEllipses(): { cx: number; cy: number; rx: number; ry: number }[] {
    const lamps = BALANCE_CONFIG.weather.flicker.lamps[this.currentScene];
    if (!lamps || lamps.length === 0) return [];
    const rect = this.getBgDrawRect();
    if (!rect) return [];
    const sx = rect.dw / rect.imgW;
    const sy = rect.dh / rect.imgH;
    return lamps.map(l => ({
      cx: rect.dx + l.x * sx,
      cy: rect.dy + l.y * sy,
      rx: (l.w / 2) * sx,
      ry: (l.h / 2) * sy,
    }));
  }

  /** 渲染浮动文字（委托给 FloatingTextSystem 模块） */
  renderFloatingTexts(ctx: CanvasRenderingContext2D) {
    this.floatingTextSystem.render(ctx);
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
