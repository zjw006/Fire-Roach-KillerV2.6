/**
 * @fileoverview 游戏核心引擎
 * @description 《烈焰除蟑》主游戏引擎，负责游戏状态管理、敌人 AI、碰撞检测、粒子系统、渲染、输入处理、存档读写等全部核心逻辑。
 */

import { GameState, RoachType, RoachState, SceneType, WeatherType, ParticleType, FlameMode, GameMode, SAVE_VERSION, type Roach, type Player, type Particle, type FireZone, type FireWall, type Economy, type WeaponDrop, type GameProgress, type WaveConfig, type ThrowableProjectile, type InventoryItem, type TripleFlameState, type BossBattleState, type RadarLaser, type StickyBoard, type StickyDrop, type FanState } from './types';
import * as Vibration from './vibration';
import { AudioManager } from './audio';
import { SCENE_CONFIGS, ENEMY_DEFS, TALENT_DEFS, WEAPON_DROP_DEFS, INVENTORY_SELL_PRICES, BOSS_CONFIG, SCENE_WAVE_CONFIGS, SCENE_ITEM_UNLOCKS, SCENE_ROACH_TYPES, SCENE_UNLOCK_CHAIN, SCENE_REWARD_ITEMS, SCENE_GROUND_BOUNDS, createDefaultProgress, ENCYCLOPEDIA_DEFS, CONSUMABLE_DEFS } from './data';
import { BOSS_ANIMATIONS } from './bossAnimation';

/** 浮动文字特效数据 */
interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
  /** 可选字体缩放（1.0 = 默认 16px） */
  scale?: number;
}

/** 全局蟑螂 ID 计数器 */
let nextId = 1;
/** 全局掉落物 ID 计数器 */
let nextDropId = 1;
/** 全局 Boss ID 计数器 */
let nextBossId = 10000;

/**
 * 游戏核心引擎类
 * @description 管理游戏全部状态、实体、渲染与交互的主引擎
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

  // Active sticky boards (legacy - kept for compatibility)
  stickyBoards: StickyBoard[] = [];
  // Sticky drops (new auto-targeting system)
  stickyDrops: StickyDrop[] = [];
  nextStickyDropId: number = 1;
  // Fire walls (molotov creates horizontal flame walls)
  fireWalls: FireWall[] = [];

  // Fan state (slows roaches)
  fanState: FanState = {
    active: false,
    timer: 0,
    duration: 8,
    slowFactor: 0.5,
    bladeAngle: 0,
    bladeSpeed: 15,
  };

  // Endless mode timer
  endlessElapsedTime: number = 0;
  endlessBestTime: number = 0;
  endlessNewRecordShown: boolean = false;
  endlessNewRecordTimer: number = 0;
  floatingTexts: FloatingText[] = [];
  weaponDrops: WeaponDrop[] = [];

  // Post-battle item reveal
  itemRevealData: { type: string; name: string; icon: string; desc: string }[] = [];
  onItemRevealComplete?: () => void;
  // Player-selected items for the current level (from PreparationScreen)
  selectedItems: string[] = [];
  // Carried consumables inventory (buy → carry → auto/manual use)
  consumableInventory: Record<string, number> = {};
  // Auto-use settings for each consumable type
  autoUseEnabled: Record<string, boolean> = {};
  // Emergency cool inventory (purchased from shop, free uses)
  emergencyCoolInventory: number = 0;
  // Buff flash timers for HUD display (2 seconds flash when auto-triggered)
  buffFlashTimers: Record<string, number> = {};
  // Bait throw animation state
  baitThrowAnim: { active: boolean; x: number; y: number; targetX: number; targetY: number; timer: number } = { active: false, x: 0, y: 0, targetX: 0, targetY: 0, timer: 0 };
  // Bait target position (where the bait lands and attracts roaches)
  baitTarget: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  // Power boost countdown tracking (for floating text display)
  _lastPowerBoostCountdown: number = -1;
  // Dynamic particle limit based on device performance
  _particleLimit: number = 300;
  _frameTimeSamples: number[] = [];
  _perfCheckFrames: number = 0;
  _isLowPerfDevice: boolean = false;
  onConsumableUpdate?: (inventory: Record<string, number>, buffTimers: Record<string, number>, cooldowns?: Record<string, number>, globalCooldown?: number, combatStartTimer?: number, itemCooldowns?: Record<string, number>) => void;
  onEmergencyCoolUpdate?: (count: number) => void;
  // Post-battle item drop (on-field clickable drop)
  itemDropOnField: { type: string; name: string; icon: string; x: number; y: number; targetY: number; bobPhase: number; collected: boolean; falling: boolean; fallSpeed: number } | null = null;

  wave: number = 0;
  waveTimer: number = 0;
  waveSpawning: boolean = false;
  spawnQueue: { type: RoachType; clusterId?: number }[] = [];
  spawnTimer: number = 0;
  waveJustCleared: boolean = false;
  waveClearTimer: number = 0;

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

  swatterReady: boolean = true;
  swatterCooldown: number = 0;
  swatterCooldownMax: number = 60;
  swatterAnimTimer: number = 0;
  swatterActive: boolean = false;
  swatterSwingX: number = 0;

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
  // Boss animation system
  bossAnimFrames: Map<string, HTMLImageElement[]> = new Map();
  bossAnimState: { action: string; frameIndex: number; timer: number } = {
    action: 'hover',
    frameIndex: 0,
    timer: 0,
  };
  eggPodImg: HTMLImageElement | null = null;
  stickyBoardImg: HTMLImageElement | null = null;
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

  // Boss battle state
  bossBattle: BossBattleState = {
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

  // Talent & progression
  progress: GameProgress;
  talentMultipliers: Record<string, number> = {};

  // Weapon drop timer
  dropSpawnTimer: number = 0;
  dropSpawnInterval: number = 25;

  // Weather
  weatherParticles: Particle[] = [];
  lightningTimer: number = 0;
  lightningFlash: number = 0;

  // Boss active
  activeBosses: number = 0;

  // Defeat/restart guard: prevent gameDefeat() from being called multiple times
  defeatTriggered: boolean = false;

  // Kitchen first-wave tutorial pause: blocks spawn until tutorial completes
  tutorialPauseSpawn: boolean = false;

  // Pre-wave 3-2-1 countdown state
  countdownTimer: number = 0;
  countdownPhase: number = 3; // 3, 2, 1
  countdownWavePending: boolean = false; // true when countdown should trigger before a wave

  // Inventory recycle snapshot: saved before clearing, used for UI animation at level end
  recycledInventory: { type: string; count: number }[] = [];

  // Throwable aiming system
  isAiming: boolean = false;
  aimWeapon: 'sticky' | 'poison' | 'molotov' | null = null;
  aimPower: number = 0; // 0 to 1
  aimTargetX: number = 0;
  aimTargetY: number = 0;
  aimStartTime: number = 0;
  aimMaxPowerTime: number = 1.5; // seconds to reach max power
  aimMinDist: number = 80;
  aimMaxDist: number = 500;

  // Throwable projectiles in flight
  throwables: ThrowableProjectile[] = [];

  // Weapon/item inventory (picked up weapon drops)
  inventory: InventoryItem[] = [];
  selectedItemIndex: number = -1;
  itemPlaceState: 'idle' | 'pending_click' | 'placing' = 'idle';
  itemPlaceCursorX: number = 0;
  itemPlaceCursorY: number = 0;
  itemEffectRadiusX: number = 100;
  itemEffectRadiusY: number = 50;
  // Picked-up item cooldown system (shares globalConsumableCooldown with shop consumables)
  itemCooldowns: Record<string, number> = {}; // per-item-type independent cooldown timers

  // Triple flame shotgun state
  tripleFlame: TripleFlameState = {
    active: false,
    timer: 0,
    duration: 15,
    sideOffset: 100,
    sideDamageMult: 0.8,
  };

  // Kitchen hard mode background flag
  useKitchenHardBg: boolean = false;

  // Radar laser state
  radarLaser: RadarLaser = {
    active: false,
    timer: 0,
    duration: 5,
    targetId: null,
    fireTimer: 0,
    fireInterval: 0.3,
    damage: 10,
    laserAlpha: 0,
    shotsRemaining: 5,
  };

  // Insecticide spray state
  insecticideSpray: {
    active: boolean;
    timer: number;
    duration: number;
    damageInterval: number;
    damageTimer: number;
    sprayAngle: number;
    spraySpread: number;
    baseDamage: number;
  } = {
    active: false,
    timer: 0,
    duration: 2,
    damageInterval: 0.3,
    damageTimer: 0,
    sprayAngle: -Math.PI / 2, // straight up
    spraySpread: Math.PI * 2 / 3,  // 120 degree fan
    baseDamage: 3,
  };

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

  // Consumable cooldown system
  consumableCooldowns: Record<string, number> = {}; // individual cooldown timers per consumable type
  globalConsumableCooldown: number = 0; // shared 1s cooldown after using any consumable (except emergency_cool)
  combatStartTimer: number = 0; // initial 1s lock after combat starts (except emergency_cool)

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
    // Restore persistent consumable inventory from progress
    if (this.progress.consumableInventory) {
      this.consumableInventory = { ...this.progress.consumableInventory };
    }
    if (this.progress.autoUseEnabled) {
      this.autoUseEnabled = { ...this.progress.autoUseEnabled };
    }
    // Load previously detected particle limit from localStorage
    try {
      const savedLimit = localStorage.getItem('roach_blaster_particle_limit');
      if (savedLimit) {
        this._particleLimit = parseInt(savedLimit, 10);
        this._isLowPerfDevice = this._particleLimit <= 200;
      }
    } catch { /* ignore */ }
    this.player = this.createPlayer();
    this.economy = this.createEconomy();
    this.endlessBestTime = this.loadEndlessBestTime();
    this.recalcTalentMultipliers();
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
    load('/assets/sticky_board.jpg', (img) => this.stickyBoardImg = img);
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
    const startMoney = initialMoney !== undefined
      ? initialMoney
      : (this.difficulty === 'hard' ? 100 : (this.talentMultipliers.rewardMultiplier ? 150 : 200));
    return {
      money: startMoney,
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
      totalAchievements: 0,
    };
  }

  // ========== 进度持久化 ==========
  /** 从 localStorage 加载游戏进度 */
  loadProgress(): GameProgress {
    try {
      const saved = localStorage.getItem('roach_blaster_progress');
      if (saved) {
        const parsed = JSON.parse(saved) as GameProgress;

        // Version migration: handle outdated save formats
        if (!parsed.saveVersion) {
          // Pre-version saves (very old): reset completely
          console.log('[Save] No version found, resetting to default');
          return createDefaultProgress();
        }

        if (parsed.saveVersion < SAVE_VERSION) {
          console.log(`[Save] Migrating from v${parsed.saveVersion} to v${SAVE_VERSION}`);

          // Step 1: v1 -> v2 migration (add missing fields)
          if (parsed.saveVersion === 1) {
            if (!parsed.scenesCompleted) parsed.scenesCompleted = [];
            if (!parsed.shopUpgrades) parsed.shopUpgrades = [];
            if (!parsed.encyclopedia || !parsed.encyclopedia.entries) {
              parsed.encyclopedia = { entries: ENCYCLOPEDIA_DEFS.map(e => ({ ...e })) };
            }
            parsed.saveVersion = 2;
            console.log('[Save] Migration v1->v2 completed');
          }

          // Step 2: v2 -> v3 migration (consumable inventory into GameProgress)
          if (parsed.saveVersion === 2 && SAVE_VERSION >= 3) {
            // Try to migrate consumables from the separate localStorage key
            if (!parsed.consumableInventory || !parsed.autoUseEnabled) {
              try {
                const consumableSaved = localStorage.getItem('roach_blaster_consumables');
                if (consumableSaved) {
                  const consumableParsed = JSON.parse(consumableSaved);
                  parsed.consumableInventory = consumableParsed.consumables || {};
                  // autoUseEnabled was never persisted before v3, default all to true
                  parsed.autoUseEnabled = {};
                  console.log('[Save] Migrated consumables from roach_blaster_consumables');
                } else {
                  parsed.consumableInventory = {};
                  parsed.autoUseEnabled = {};
                }
              } catch {
                parsed.consumableInventory = {};
                parsed.autoUseEnabled = {};
              }
            }
            parsed.saveVersion = 3;
            console.log('[Save] Migration v2->v3 completed');
          }

          // Save migrated data immediately
          try {
            localStorage.setItem('roach_blaster_progress', JSON.stringify(parsed));
            console.log('[Save] Migration completed and saved');
          } catch { /* ignore save errors */ }
          return parsed;

          // If no migration path exists, reset
          console.log(`[Save] No migration path from v${parsed.saveVersion} to v${SAVE_VERSION}, resetting`);
          return createDefaultProgress();
        }

        if (parsed.saveVersion > SAVE_VERSION) {
          // Future save format - downgrade or reset
          console.log(`[Save] Save version v${parsed.saveVersion} is newer than current v${SAVE_VERSION}, resetting`);
          return createDefaultProgress();
        }

        // Same version: ensure all fields exist (defensive)
        if (!parsed.encyclopedia || !parsed.encyclopedia.entries) {
          parsed.encyclopedia = {
            entries: ENCYCLOPEDIA_DEFS.map(e => ({ ...e })),
          };
        }
        if (!parsed.scenesCompleted) {
          parsed.scenesCompleted = [];
        }
        if (!parsed.shopUpgrades) {
          parsed.shopUpgrades = [];
        }
        if (!parsed.weaponsUnlocked) {
          parsed.weaponsUnlocked = ['flamethrower', 'sticky'];
        }
        return parsed;
      }
    } catch (e) {
      console.error('[Save] Failed to load progress:', e);
    }
    // No saved data or parse failed: create default and save immediately
    const defaultProgress = createDefaultProgress();
    try {
      localStorage.setItem('roach_blaster_progress', JSON.stringify(defaultProgress));
    } catch { /* ignore */ }
    return defaultProgress;
  }

  loadEndlessBestTime(): number {
    try {
      const saved = localStorage.getItem('roach_blaster_endless_best_time');
      if (saved) return parseFloat(saved);
    } catch { /* ignore */ }
    return 0;
  }

  /** 保存无尽模式最佳时长到 localStorage */
  saveEndlessBestTime(time: number) {
    try {
      localStorage.setItem('roach_blaster_endless_best_time', time.toString());
    } catch { /* ignore */ }
  }

  /** 将当前进度保存到 localStorage */
  saveProgress() {
    // 同步消耗品库存到进度后再保存
    this.progress.consumableInventory = { ...this.consumableInventory };
    this.progress.autoUseEnabled = { ...this.autoUseEnabled };
    try {
      localStorage.setItem('roach_blaster_progress', JSON.stringify(this.progress));
    } catch { /* ignore */ }
  }

  /** 根据已解锁天赋重新计算所有属性乘数 */
  recalcTalentMultipliers() {
    const mults: Record<string, number> = {};
    for (const tid of Object.keys(this.progress.talentTree.talents)) {
      const level = this.progress.talentTree.talents[tid] || 0;
      const def = TALENT_DEFS.find(t => t.id === tid);
      if (!def || level <= 0) continue;
      const eff = def.effect(level);
      for (const [k, v] of Object.entries(eff)) {
        mults[k] = (mults[k] || 1) * v;
      }
    }
    this.talentMultipliers = mults;
  }

  /** 检查并解锁符合条件的成就 */
  checkAchievements() {
    const e = this.economy;
    const p = this.progress;
    let updated = false;
    for (const ach of p.achievements) {
      if (ach.unlocked) continue;
      let cond = false;
      switch (ach.id) {
        case 'first_blood': cond = e.totalKills >= 1; break;
        case 'roach_slayer': cond = e.totalKills >= 100; break;
        case 'roach_exterminator': cond = e.totalKills >= 1000; break;
        case 'wave_5': cond = e.highestWave >= 5; break;
        case 'wave_10': cond = e.highestWave >= 10; break;
        case 'endless_20': cond = e.highestEndlessWave >= 20; break;
        case 'endless_50': cond = e.highestEndlessWave >= 50; break;
        case 'money_1000': cond = e.totalMoneyEarned >= 1000; break;
        case 'perfect_wave': cond = e.perfectWaves >= 1; break;
        case 'no_breach': cond = e.breaches === 0 && e.highestWave >= 10; break;
        case 'kill_queen': cond = e.queenKills >= 1; break;
        case 'kill_flying': cond = e.flyingKills >= 50; break;
        case 'kill_armored': cond = e.armoredKills >= 30; break;
        case 'weapon_master': cond = (p.weaponsUnlocked?.length || 0) >= 5; break;
        case 'talent_first': cond = Object.values(p.talentTree.talents).some(v => (v || 0) > 0); break;
      }
      if (cond) {
        ach.unlocked = true;
        this.economy.money += ach.reward;
        this.addFloatingText(this.width / 2, this.height / 2 - 50, `成就: ${ach.name} +¥${ach.reward}`, '#fbbf24');
        updated = true;
      }
    }
    if (updated) {
      this.saveProgress();
      this.onEconomyUpdate?.(this.economy);
    }
  }

  // ========== GAME FLOW ==========
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
    this.stickyBoards = [];
    this.stickyDrops = [];
    this.nextStickyDropId = 1;
    this.fireWalls = [];
    this.fanState = { active: false, timer: 0, duration: 8, slowFactor: 0.5, bladeAngle: 0, bladeSpeed: 15 };
    this.floatingTexts = [];
    this.weaponDrops = [];
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
    this.consumableCooldowns = {};
    this.globalConsumableCooldown = 0;
    this.combatStartTimer = 1; // 1 second initial lock after combat starts
    // Consumables are now persisted across levels via localStorage
    // (loaded in GameCanvas doStartGame, saved on level end)
    this.baitTarget = { x: 0, y: 0, active: false };
    // Reset performance check for new game session
    this._perfCheckFrames = 0;
    this._frameTimeSamples = [];
    this._lastPowerBoostCountdown = -1;
    this.weatherParticles = [];
    this.wave = 0;
    this.waveTimer = 1;
    this.waveSpawning = false;
    this.waveJustCleared = false;
    this.waveClearTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.dropSpawnTimer = 15;
    this.activeBosses = 0;
    this.defeatTriggered = false;
    this.tutorialPauseSpawn = false;
    this.throwables = [];
    this.isAiming = false;
    this.aimWeapon = null;
    this.aimPower = 0;
    this.inventory = [];
    this.selectedItemIndex = -1;
    this.itemPlaceState = 'idle';
    this.itemCooldowns = {};
    this.tripleFlame = { active: false, timer: 0, duration: 15, sideOffset: 100, sideDamageMult: 0.8 };
    this.radarLaser = { active: false, timer: 0, duration: 5, targetId: null, fireTimer: 0, fireInterval: 0.3, damage: 10, laserAlpha: 0, shotsRemaining: 5 };
    this.insecticideSpray = { active: false, timer: 0, duration: 3, damageInterval: 0.3, damageTimer: 0, sprayAngle: -Math.PI / 2, spraySpread: Math.PI * 2 / 3, baseDamage: 2 };
    const defMult = this.talentMultipliers.defenseMultiplier || 1;
    this.defenseHp = 80 * defMult;
    this.maxDefenseHp = this.defenseHp;
    this.time = 0;
    this.screenShake = 0;
    this.lightningTimer = 0;
    this.lightningFlash = 0;
    this.economy.totalGamesPlayed = this.progress.totalKills + 1;
    this.endlessElapsedTime = 0;
    this.endlessNewRecordShown = false;
    this.endlessNewRecordTimer = 0;

    // Initialize boss battle if in BOSS mode
    if (this.gameMode === GameMode.BOSS) {
      this.initBossBattle();
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
    this.startWave();
    // Resume game loop if it was stopped
    if (!this.animationId) {
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
    this.onStateChange?.(this.state);
  }

  /**
   * 游戏主循环（requestAnimationFrame 回调）
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
      try {
        localStorage.setItem('roach_blaster_particle_limit', String(this._particleLimit));
      } catch { /* ignore */ }
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


  // ========== Boss 战斗系统 ==========
  /** 初始化 Boss 战斗状态与波次配置 */
  initBossBattle() {
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
    this.spawnBoss();
    this.bossBattle.phaseJustChanged = true;
    this.bossBattle.phaseChangeTimer = 6;
    this.bossBattle.phaseChangeText = '【螂老大来袭】';
    this.bossBattle.phaseChangeSub = '消灭虫卵和蟑螂!保卫防线!';
    this.addFloatingText(this.width / 2, this.height / 3, '螂老大出现了!', '#ef4444');
    this.addFloatingText(this.width / 2, this.height / 3 + 30, '它正在产卵!消灭虫卵!', '#fbbf24');
    this.screenShake = 12;
  }

  spawnBoss() {
    const isHard = this.difficulty === 'hard';
    const bossHp = 10000;
    const boss: Roach = {
      id: nextId++,
      x: this.width / 2,
      y: this.height * 0.18,
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
      // Boss control states
      isBurnBack: false,
      burnBackTimer: 0,
      isBlind: false,
      blindTimer: 0,
      isJammed: false,
      jamTimer: 0,
      // Boss home position (hover spot to return to after interrupt)
      homeX: this.width / 2,
      homeY: this.height * 0.18,
      returningHome: false,
      chargeReturnDelay: 0,
      // Boss independent values (do NOT use ENEMY_DEFS[QUEEN])
      size: 120,       // larger than normal QUEEN (80)
      reward: 500,     // higher than normal QUEEN (200)
    };
    this.roaches.push(boss);
  }

  // Centralized BOSS death sequence - called from updateBossBattle OR directly
  // when a late-updated system (radar laser, etc.) kills the boss
  triggerBossDeathSequence() {
    const bb = this.bossBattle;
    if (!bb.active || bb.bossKilled) return; // already triggered or battle over

    // Find the boss - may already be DEAD or just have hp<=0
    const boss = this.roaches.find(r => r.type === RoachType.QUEEN);
    if (!boss) return;

    // Ensure death state
    if (boss.state !== RoachState.DEAD) {
      boss.hp = 0;
      boss.state = RoachState.DEAD;
    }
    boss.deathTimer = 999; // prevent updateRoaches from removing the corpse
    bb.bossHp = 0;

    // Start death animation sequence
    bb.bossKilled = true;
    bb.deathAnimTimer = 1.75; // 7 frames at 4fps = 1.75s
    this.bossAnimState.action = 'die';
    this.bossAnimState.frameIndex = 0;
    this.bossAnimState.timer = 0;

    // Death effects
    this.addFloatingText(this.width / 2, this.height / 3, '螂老大被消灭了!', '#ef4444');
    this.spawnExplosionParticles(boss.x, boss.y, 60);
    this.spawnShockwaveRing(boss.x, boss.y, 50);
    this.screenShake = 25;
  }

  // Update the death sequence timers (animation -> corpse stay -> victory)
  // Called every frame from updateBossBattle
  updateBossDeathSequence() {
    const bb = this.bossBattle;
    if (!bb.bossKilled) return;

    // Update death animation timer
    if (bb.deathAnimTimer > 0) {
      bb.deathAnimTimer -= this.deltaTime;
      // Keep die animation playing
      if (this.bossAnimState.action !== 'die') {
        this.bossAnimState.action = 'die';
      }
      // Update die animation frames manually
      const dieConfig = BOSS_ANIMATIONS['die'];
      this.bossAnimState.timer += this.deltaTime * 1000;
      const interval = 1000 / dieConfig.fps;
      if (this.bossAnimState.timer >= interval) {
        this.bossAnimState.timer = 0;
        const maxFrames = this.bossAnimFrames.get('die')?.length || 7;
        this.bossAnimState.frameIndex = Math.min(this.bossAnimState.frameIndex + 1, maxFrames - 1);
      }
    }

    // Death animation finished -> start corpse stay
    if (bb.deathAnimTimer <= 0 && bb.corpseStayTimer <= 0 && this.state === GameState.PLAYING) {
      bb.corpseStayTimer = 2.0; // corpse stays for 2 seconds
      this.addFloatingText(this.width / 2, this.height / 2, '胜利!', '#22c55e');
    }

    // Corpse stay countdown
    if (bb.corpseStayTimer > 0) {
      bb.corpseStayTimer -= this.deltaTime;
      const maxFrames = this.bossAnimFrames.get('die')?.length || 7;
      this.bossAnimState.frameIndex = maxFrames - 1;
    }

    // Corpse stay finished -> trigger victory screen
    if (bb.corpseStayTimer <= 0 && bb.deathAnimTimer <= 0 && this.state === GameState.PLAYING) {
      const boss = this.roaches.find(r => r.type === RoachType.QUEEN);
      bb.active = false;
      this.sellUnusedInventory(); // Recycle unused items
      this.state = GameState.GAME_OVER;
      this.audio.stopBGM();
      this.audio.playVictoryBGM(); // Play victory BGM for boss defeat
      this.economy.highestWave = 1;
      this.progress.highestWave = Math.max(this.progress.highestWave, 1);
      this.saveProgress();
      this.onStateChange?.(this.state);
      this.onGameOver?.(this.economy, 1);
      if (boss) boss.deathTimer = 0; // allow removal next frame
    }
  }

  updateBossBattle() {
    const bb = this.bossBattle;
    if (!bb.active && !bb.bossKilled) return;

    const boss = this.roaches.find(r => r.type === RoachType.QUEEN);
    if (!boss) {
      this.updateBossDeathSequence();
      return;
    }

    // ===== BOSS FLEEING (victory sequence) =====
    if (bb.bossFleeing) {
      bb.bossFleeTimer -= this.deltaTime;
      // Boss flies upward and disappears
      boss.y -= 80 * this.deltaTime;
      boss.x += Math.sin(this.time * 3) * 30 * this.deltaTime;
      if (bb.bossFleeTimer <= 0 || boss.y < -200) {
        // Remove boss from game
        const bidx = this.roaches.indexOf(boss);
        if (bidx >= 0) this.roaches.splice(bidx, 1);
        bb.active = false;
        this.activeBosses = 0;
        // Trigger victory
        this.gameVictory();
      }
      return;
    }

    // Update death sequence
    if (bb.bossKilled) {
      this.updateBossDeathSequence();
      return;
    }

    // Check defense failure
    if (this.defenseHp <= 0) {
      this.gameDefeat();
      return;
    }

    // Time limit
    bb.timeRemaining -= this.deltaTime;
    if (bb.timeRemaining <= 0) {
      this.defenseHp = 0;
      this.gameDefeat();
      return;
    }

    // Update phase change banner
    if (bb.phaseChangeTimer > 0) {
      bb.phaseChangeTimer -= this.deltaTime;
      if (bb.phaseChangeTimer <= 0) {
        bb.phaseJustChanged = false;
      }
    }

    // ===== BOSS ANIMATION (hover in air) =====
    const hoverBaseX = boss.homeX ?? this.width / 2;
    const hoverAmplitude = 60;
    const targetX = hoverBaseX + Math.sin(this.time * 1.2 + boss.wobbleOffset) * hoverAmplitude;
    const targetY = (boss.homeY ?? this.height * 0.15) + Math.sin(this.time * 2 + boss.wobbleOffset * 2) * 15;
    boss.x += (targetX - boss.x) * 2.0 * this.deltaTime;
    boss.y += (targetY - boss.y) * 2.0 * this.deltaTime;

    let newAction = 'hover';
    if (boss.isStunned) newAction = 'stun';
    if (newAction !== this.bossAnimState.action) {
      this.bossAnimState.action = newAction;
      this.bossAnimState.frameIndex = 0;
      this.bossAnimState.timer = 0;
    }
    const animConfig = BOSS_ANIMATIONS[this.bossAnimState.action as keyof typeof BOSS_ANIMATIONS];
    if (animConfig) {
      this.bossAnimState.timer += this.deltaTime * 1000;
      const interval = 1000 / animConfig.fps;
      if (this.bossAnimState.timer >= interval) {
        this.bossAnimState.timer = 0;
        const maxFrames = this.bossAnimFrames.get(this.bossAnimState.action)?.length || 1;
        this.bossAnimState.frameIndex = animConfig.loop
          ? (this.bossAnimState.frameIndex + 1) % maxFrames
          : Math.min(this.bossAnimState.frameIndex + 1, maxFrames - 1);
      }
    }

    // ===== 4-WAVE EGG POD SYSTEM =====
    this.updateEggPodSystem();

    // Sync HP display (4 layers) - decreases as waves are cleared
    // currentWave=1 → bossHp=4 (full), currentWave=4 → bossHp=1, currentWave=5 → bossHp=0 (dead)
    bb.bossHp = Math.max(0, 5 - bb.currentWave);

    // Notify UI
    this.onBossUpdate?.(bb);
  }

  // ===== EGG POD SYSTEM (4-Wave Boss Mechanic) =====
  // Wave count: 0=init → 1=wave1 → 2=wave2 → 3=wave3 → 4=wave4 → 5=victory
  // Boss HP: 4(full) → 3(after w1) → 2(after w2) → 1(after w3) → 0(after w4)
  updateEggPodSystem() {
    const bb = this.bossBattle;

    // [REMOVED] this.updateEggPods();

    // Check if current wave is cleared (no egg pods + all enemies dead)
    if (!bb.waveCleared /* && bb.eggPods.length === 0 */) {
      const livingEnemies = this.roaches.filter(r =>
        r.state === RoachState.ALIVE && !r.isBoss
      ).length;
      if (livingEnemies === 0) {
        // Wave cleared! Decrease boss HP and advance
        bb.waveCleared = true;
        bb.currentWave++;
        // Decrease boss HP: 4 → 3 → 2 → 1 → 0
        bb.bossHp = Math.max(0, 4 - bb.currentWave + 1);
        // Update phase
        if (bb.currentWave <= 4) {
          bb.phase = bb.currentWave as 1 | 2 | 3 | 4;
        }
        // Show "wave cleared" floating text
        this.addFloatingText(this.width / 2, this.height / 3, `第${bb.currentWave}波清除!`, '#22c55e');

        // Check if all 4 waves done
        if (bb.currentWave > 4) {
          // All waves cleared - boss flees
          this.startBossDialogue();
          return;
        }

        // Start boss casting animation before next wave
        this.startBossSummonCast(bb.currentWave);
      }
    }

    // Handle boss summon casting timer
    if (bb.summonCastTimer > 0) {
      bb.summonCastTimer -= this.deltaTime;
      // Spawn eggs when cast finishes
      if (bb.summonCastTimer <= 0) {
        bb.waveCleared = false;
        this.spawnEggWave(bb.currentWave);
      }
    }

    // Spawn first wave with casting animation
    if (bb.currentWave === 0 /* && bb.eggPods.length === 0 */ && !bb.waveCleared && bb.summonCastTimer <= 0) {
      bb.currentWave = 1;
      bb.phase = 1;
      bb.bossHp = 4; // full HP at start
      this.startBossSummonCast(1);
    }
  }

  // Boss summon casting animation - eggs fall from above after cast
  startBossSummonCast(wave: number) {
    const bb = this.bossBattle;
    // Find boss position for casting origin
    const boss = this.roaches.find(r => r.isBoss);
    const castX = boss ? boss.x : this.width / 2;
    const castY = boss ? boss.y : this.height * 0.25;

    // Set casting timer (2 seconds cast animation)
    bb.summonCastTimer = 2.0;

    // Show casting announcement
    const waveNames = ['', '虫卵入侵', '大蟑螂卵', '飞行蟑螂卵', '精英蟑螂卵'];
    bb.phaseChangeText = `【第${wave}波: ${waveNames[wave]}】`;
    bb.phaseChangeSub = 'BOSS正在召唤虫卵...';
    bb.phaseJustChanged = true;
    bb.phaseChangeTimer = 3;

    // Create casting particles (dark energy gathering at boss position)
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

    // Floating text for cast
    this.addFloatingText(castX, castY - 60, '召唤虫卵!', '#a855f7');
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

  spawnSwatterPickup(x: number, y: number) {
    // Add swatter to inventory (max 3)
    const existing = this.inventory.find((item: InventoryItem) => item.type === 'swatter');
    if (existing) {
      if (existing.count < 3) {
        existing.count++;
        this.addFloatingText(x, y - 40, '获得电蚊拍!', '#4ade80');
      }
    } else {
      this.inventory.push({ type: 'swatter', count: 1 });
      this.addFloatingText(x, y - 40, '获得电蚊拍!', '#4ade80');
    }
    this.onInventoryUpdate?.(this.inventory);
  }

  // ===== BOSS DIALOGUE & FLEE (Victory Sequence) =====
  startBossDialogue() {
    const bb = this.bossBattle;
    const boss = this.roaches.find(r => r.type === RoachType.QUEEN);
    if (!boss) return;

    bb.bossDialogue = '不...不可能!我的虫卵大军...';
    bb.dialogueTimer = 3;
    bb.dialogueIndex = 0;

    // Show dialogue
    this.addFloatingText(boss.x, boss.y - 100, '螂老大: "不...不可能!"', '#ef4444');

    // Schedule dialogue sequence
    setTimeout(() => {
      if (!bb.active) return;
      this.addFloatingText(boss.x, boss.y - 100, '螂老大: "我的虫卵大军...全灭了..."', '#ef4444');
    }, 3000);

    setTimeout(() => {
      if (!bb.active) return;
      this.addFloatingText(boss.x, boss.y - 100, '螂老大: "这次算你赢了!我会回来的!"', '#fbbf24');
    }, 6000);

    setTimeout(() => {
      if (!bb.active) return;
      // Boss starts fleeing
      bb.bossFleeing = true;
      bb.bossFleeTimer = 5;
      this.addFloatingText(boss.x, boss.y - 80, '螂老大飞走了...', '#9ca3af');
    }, 9000);
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
      this.onGameOver?.(this.economy, this.bossBattle.currentWave);
    }, 2000);
  }

  // Compute armor for egg-hatched roaches
  // [REMOVED] computeEggPodArmor(type: RoachType, def: EnemyDef, hpMult: number): number {
  //   return 0; // Egg pod system removed
  // }

  canControlBoss(): boolean {
    return true;
  }

  // ========== 主更新循环 ==========
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
      this.updateFloatingTexts();
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
      this.updateFloatingTexts();
      this.updateScreenShake();
      // Update bait throw animation even in wave clear
      if (this.state === GameState.WAVE_CLEAR) {
        this.updateBuffFlashTimers(this.deltaTime);
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
    this.updateConsumableEffects(this.deltaTime);
    this.checkAutoUseConsumables();
    this.updateBuffFlashTimers(this.deltaTime);
    this.updateParticles();
    this.updateFireZones();
    this.updateFireWalls();
    this.updateStickyBoards();
    this.updateStickyDrops();
    this.updateFloatingTexts();
    if (this.gameMode === GameMode.BOSS) {
      this.updateBossBattle();
    } else {
      this.updateWave();
    }
    this.updateScreenShake();
    this.updateSwatter();
    this.updateWeaponDrops();
    this.updateAiming();
    this.updateThrowables();
    this.updateTripleFlame();
    this.updateRadarLaser();
    this.updateInsecticideSpray();
    this.updateFan();
    this.updateWeather();
    this.checkCollisions();
    this.checkDefense();
    this.checkAchievements();

    // ===== BOSS DEATH SAFETY NET =====
    // All weapon systems have run. If boss is dead but death sequence hasn't
    // triggered yet (because the killing blow came from a system that runs
    // AFTER updateBossBattle), trigger it now.
    if (this.gameMode === GameMode.BOSS && this.bossBattle.active && !this.bossBattle.bossKilled) {
      const boss = this.roaches.find(r => r.type === RoachType.QUEEN);
      if (boss && (boss.hp <= 0 || boss.state === RoachState.DEAD)) {
        this.triggerBossDeathSequence();
      }
    }

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

  emergencyCool() {
    if (!this.player.isOverheated) return;
    // Only works if purchased from shop (no in-game payment)
    if (this.emergencyCoolInventory > 0) {
      this.emergencyCoolInventory--;
      this.player.isOverheated = false;
      this.player.overheatTimer = 0;
      this.player.heat = 0;
      this.spawnSmokeParticles(this.player.x, this.player.y, 20);
      this.addFloatingText(this.player.x, this.player.y - 60, `紧急冷却! (剩余${this.emergencyCoolInventory}次)`, '#60a5fa');
      this.onEmergencyCoolUpdate?.(this.emergencyCoolInventory);
    }
  }

  // ========== THROWABLE AIMING & THROWING ==========
  startAiming(weapon: 'sticky' | 'poison' | 'molotov') {
    if (this.isAiming) return;
    this.isAiming = true;
    this.aimWeapon = weapon;
    this.aimPower = 0;
    this.aimStartTime = this.time;
    // Initial target: straight up at min distance
    this.aimTargetX = this.player.x;
    this.aimTargetY = this.player.y - 322 - this.aimMinDist;
  }

  updateAiming() {
    if (!this.isAiming) return;
    // Power increases with hold time (0 to 1)
    const holdDuration = this.time - this.aimStartTime;
    this.aimPower = Math.min(1, holdDuration / this.aimMaxPowerTime);
    // Y distance: min to max based on power
    const dist = this.aimMinDist + (this.aimMaxDist - this.aimMinDist) * this.aimPower;
    // Clamp target position
    this.aimTargetX = Math.max(40, Math.min(this.width - 40, this.aimTargetX));
    this.aimTargetY = Math.max(60, Math.min(this.defenseLineY() - 20, this.player.y - 322 - dist));
  }

  adjustAim(dx: number) {
    if (!this.isAiming) return;
    // dx from input is screen pixels, convert to game coords
    this.aimTargetX += dx * 1.5;
    this.aimTargetX = Math.max(40, Math.min(this.width - 40, this.aimTargetX));
  }

  throwAimedWeapon() {
    if (!this.isAiming || !this.aimWeapon) return;
    const weapon = this.aimWeapon;
    const startX = this.player.x;
    const startY = this.player.y - 322;
    const targetX = this.aimTargetX;
    const targetY = this.aimTargetY;

    // Calculate velocity for arc trajectory
    const dx = targetX - startX;
    const dy = targetY - startY;
    const travelTime = 0.5 + this.aimPower * 0.3;
    const vx = dx / travelTime;
    // vy is calculated to reach targetY considering gravity
    // y = vy * t + 0.5 * g * t^2 => vy = (dy - 0.5 * g * t^2) / t
    const gravity = 400;
    const vy = (dy - 0.5 * gravity * travelTime * travelTime) / travelTime;

    nextId++;
    this.throwables.push({
      id: nextId,
      x: startX, y: startY,
      vx, vy,
      type: weapon,
      life: travelTime * 2,
      maxLife: travelTime * 2,
      gravity,
      hasLanded: false,
      targetX, targetY,
    });

    // Deduct ammo if using temp weapon
    if (this.player.isTempWeapon) {
      this.player.weaponAmmo[weapon] = Math.max(0, (this.player.weaponAmmo[weapon] || 0) - 1);
    }

    // Play throw sound for molotov
    if (weapon === 'molotov') {
      this.audio.playMolotovThrow();
    }

    // Floating text
    const names = { sticky: '蟑螂贴板', poison: '杀虫剂', molotov: '燃烧瓶' };
    this.addFloatingText(startX, startY - 30, `投掷${names[weapon]}!`, '#fbbf24');

    this.isAiming = false;
    this.aimWeapon = null;
    this.aimPower = 0;
  }

  cancelAiming() {
    this.isAiming = false;
    this.aimWeapon = null;
    this.aimPower = 0;
  }

  updateThrowables() {
    for (let i = this.throwables.length - 1; i >= 0; i--) {
      const t = this.throwables[i];
      t.life -= this.deltaTime;

      if (!t.hasLanded) {
        // Apply gravity
        t.vy += t.gravity * this.deltaTime;
        t.x += t.vx * this.deltaTime;
        t.y += t.vy * this.deltaTime;

        // Check if reached or passed target Y (going down)
        if (t.vy > 0 && t.y >= t.targetY) {
          t.y = t.targetY;
          t.hasLanded = true;
          this.onThrowableLand(t);
        }
      }

      if (t.life <= 0) {
        if (!t.hasLanded) this.onThrowableLand(t);
        this.throwables.splice(i, 1);
      }
    }
  }

  onThrowableLand(t: ThrowableProjectile) {

    switch (t.type) {
      case 'sticky': {
        // Sticky zone: trap roaches in area (no effect on BOSS)
        const radius = 80;
        for (const r of this.roaches) {
          if (r.state !== RoachState.ALIVE || r.isBoss) continue;
          // Skip timed suicide roach during bomb placement (invincible)
          if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
          const dx = r.x - t.x;
          const dy = r.y - t.y;
          if (Math.sqrt(dx * dx + dy * dy) < radius) {
            r.stuckTimer = 5;
            r.speed = r.baseSpeed * 0.2;
            r.hp -= 2;
          }
        }
        // Persistent ice zone
        this.fireZones.push({
          x: t.x, y: t.y, radius,
          damagePerSecond: 30,
          life: 4, maxLife: 4,
          type: 'ice',
        });
        this.spawnIceExplosion(t.x, t.y, radius);
        this.addFloatingText(t.x, t.y - 20, '冰冻!', '#facc15');
        break;
      }
      case 'poison': {
        // Poison cloud: damage over time (no effect on BOSS)
        const radius = 90;
        for (const r of this.roaches) {
          if (r.state !== RoachState.ALIVE || r.isBoss) continue;
          // Skip timed suicide roach during bomb placement (invincible)
          if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
          const dx = r.x - t.x;
          const dy = r.y - t.y;
          if (Math.sqrt(dx * dx + dy * dy) < radius) {
            // ===== ARMOR BUFF: poison ineffective vs armored roaches =====
            if (r.armorHp > 0) {
              this.addFloatingText(r.x, r.y - 15, '护甲免疫!', '#60a5fa');
              continue;
            }
            r.poisonTimer = 6;
            r.poisonDamage = 2;
            r.hp -= 1;
          }
        }
        this.fireZones.push({
          x: t.x, y: t.y, radius,
          damagePerSecond: 25,
          life: 6, maxLife: 6,
          type: 'poison',
        });
        this.spawnPoisonExplosion(t.x, t.y, radius);
        this.addFloatingText(t.x, t.y - 20, '毒雾!', '#a78bfa');
        break;
      }
      case 'molotov': {
        // Fire explosion (no effect on BOSS)
        const radius = 70;
        for (const r of this.roaches) {
          if (r.state !== RoachState.ALIVE || r.isBoss) continue;
          // Skip timed suicide roach during bomb placement (invincible)
          if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
          const dx = r.x - t.x;
          const dy = r.y - t.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius) {
            // ===== ARMOR BUFF: molotov ineffective vs armored roaches =====
            if (r.armorHp > 0) {
              this.addFloatingText(r.x, r.y - 15, '护甲免疫!', '#60a5fa');
              continue;
            }
            const dmg = 8 * (1 - dist / radius);
            r.hp -= dmg;
            r.burnDamage = dmg * 2;
          }
        }
        this.fireZones.push({
          x: t.x, y: t.y, radius,
          damagePerSecond: 60,
          life: 5, maxLife: 5,
          type: 'fire',
        });
        this.spawnExplosionParticles(t.x, t.y, 25);
        this.screenShake = 8;
        this.addFloatingText(t.x, t.y - 20, '燃烧!', '#f87171');
        break;
      }
    }

    this.spawnSparkParticles(t.x, t.y, 10);
  }

  spawnIceExplosion(x: number, y: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _radius: number) {
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
  }

  spawnPoisonExplosion(x: number, y: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _radius: number) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.5 + Math.random() * 0.8, maxLife: 1.3,
        size: 4 + Math.random() * 12,
        color: `hsl(${260 + Math.random() * 30}, 80%, ${50 + Math.random() * 20}%)`,
        type: ParticleType.POISON_CLOUD,
      });
    }
  }

  // ========== 武器切换 ==========
  /**
   * 切换当前武器
   * @param {string} weapon - 武器类型
   */
  switchWeapon(weapon: string) {
    const p = this.player;
    if (weapon === 'flamethrower') {
      p.currentWeapon = 'flamethrower';
      p.isTempWeapon = false;
      return true;
    }
    const unlocked = this.progress.weaponsUnlocked?.includes(weapon) || false;
    if (!unlocked && !p.isTempWeapon) return false;

    const ammo = p.weaponAmmo[weapon] || 0;
    if (ammo <= 0 && !p.isTempWeapon && weapon !== 'flamethrower') return false;

    p.currentWeapon = weapon as Player['currentWeapon'];
    const def = WEAPON_DROP_DEFS[weapon as keyof typeof WEAPON_DROP_DEFS];
    if (def) {
      this.addFloatingText(p.x, p.y - 60, `切换到: ${def.name}`, '#facc15');
    }
    return true;
  }

  // ========== WEAPON DROPS ==========
  updateWeaponDrops() {
    // Skip weapon drops during tutorial pause
    if (this.tutorialPauseSpawn) return;

    const scene = this.getSceneConfig();
    this.dropSpawnTimer -= this.deltaTime;
    if (this.dropSpawnTimer <= 0) {
      // Scene-specific drop intervals and multi-drop for scarcity balance
      let sceneInterval = this.dropSpawnInterval;
      let dropCount = 1;
      if (this.gameMode === GameMode.STORY) {
        switch (this.currentScene) {
          case SceneType.KITCHEN: sceneInterval = 40; dropCount = 1; break; // Fewer drops, tutorial scene
          case SceneType.SEWER:   sceneInterval = 35; dropCount = 1; break; // Reduced drops, scarcity
          case SceneType.DUMP:    sceneInterval = 30; dropCount = this.difficulty === 'hard' ? 2 : 1; break; // Hard: double drops, Easy: single
          case SceneType.BASEMENT: sceneInterval = 25; dropCount = 1; break; // Standard
          case SceneType.ROOFTOP: sceneInterval = 20; dropCount = 1; break;
        }
      }
      this.spawnWeaponDrop(dropCount);
      this.dropSpawnTimer = sceneInterval / (scene.enemyModifier || 1);
    }

    for (let i = this.weaponDrops.length - 1; i >= 0; i--) {
      const drop = this.weaponDrops[i];
      drop.life -= this.deltaTime;
      drop.bobPhase += this.deltaTime * 4;
      if (drop.life <= 0) {
        this.weaponDrops.splice(i, 1);
        continue;
      }
      // Check pickup by player - horizontal proximity only (drop is near defense line)
      const dx = Math.abs(drop.x - this.player.x);
      if (dx < 60) {
        this.pickupWeaponDrop(drop);
        this.weaponDrops.splice(i, 1);
      }
    }
  }

  spawnWeaponDrop(count = 1) {
    // Get available items for current scene
    const allItems = ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'];
    // Use player-selected items if available (from PreparationScreen), otherwise fall back to scene defaults
    const unlockedItems = this.selectedItems.length > 0
      ? this.selectedItems
      : (this.gameMode === GameMode.STORY
          ? (this.difficulty === 'hard' ? allItems : (SCENE_ITEM_UNLOCKS[this.currentScene] || ['sticky']))
          : allItems);
    // Filter to only items the player has unlocked in progress (safety check)
    const availableItems = unlockedItems.filter(item =>
      this.progress.weaponsUnlocked?.includes(item) || item === 'flamethrower'
    );
    // Fallback: if no items pass the filter, use basic sticky
    const finalItems = availableItems.length > 0 ? availableItems : ['sticky'];

    // Generate multiple drops with spread-out positions
    const baseX = 60 + Math.random() * (this.width - 120);
    const baseY = this.defenseLineY() - 135 + Math.random() * 30;

    for (let i = 0; i < count; i++) {
      const type = finalItems[Math.floor(Math.random() * finalItems.length)] as 'sticky' | 'poison' | 'molotov' | 'shotgun' | 'radar' | 'fan' | 'swatter';
      // Spread drops horizontally (min 80px apart)
      const x = count > 1
        ? Math.max(40, Math.min(this.width - 40, baseX + (i - (count - 1) / 2) * 100))
        : baseX;
      const y = baseY + (Math.random() - 0.5) * 20; // slight Y variation
      this.weaponDrops.push({
        id: nextDropId++,
        x, y, type,
        life: 12, maxLife: 12,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  pickupWeaponDrop(drop: WeaponDrop) {
    const def = WEAPON_DROP_DEFS[drop.type];
    if (!def) return;

    // All throwable weapons go to inventory (including shotgun and swatter)
    const itemType = drop.type as 'sticky' | 'poison' | 'molotov' | 'shotgun' | 'radar' | 'fan' | 'swatter';
    const existing = this.inventory.find(item => item.type === itemType);
    // Apply resource saver talent: +1 extra ammo on pickup
    const itemAmmoBonus = this.talentMultipliers.itemAmmo || 0;
    const pickupCount = 1 + itemAmmoBonus;
    if (existing) {
      existing.count += pickupCount;
    } else {
      this.inventory.push({ type: itemType, count: pickupCount });
    }

    const bonusText = itemAmmoBonus > 0 ? `(+${itemAmmoBonus}天赋)` : '';
    this.addFloatingText(this.player.x, this.player.y - 80, `拾取: ${def.name}!${bonusText}`, '#4ade80');
    this.screenShake = 2;
  }

  // ========== ITEM PLACEMENT SYSTEM ==========
  // ========== TRIPLE FLAME SHOTGUN =========
  activateTripleFlame() {
    if (this.tripleFlame.active) {
      // Already active, extend duration
      this.tripleFlame.timer = this.tripleFlame.duration;
      return;
    }
    this.tripleFlame.active = true;
    this.tripleFlame.timer = this.tripleFlame.duration;
    this.audio.playShotgunActivate();
    Vibration.vibrateItemUse();
    this.addFloatingText(this.width / 2, this.height / 2 - 60, '三喷火枪模式! 持续10秒', '#fbbf24');
  }

  updateTripleFlame() {
    if (!this.tripleFlame.active) return;
    const prevTimer = this.tripleFlame.timer;
    this.tripleFlame.timer -= this.deltaTime;

    // Warning at 5 seconds
    if (prevTimer > 5 && this.tripleFlame.timer <= 5) {
      this.addFloatingText(this.width / 2, this.height / 2 - 80, '⚠ 三喷火枪即将消失! 5秒 ⚠', '#ef4444');
    }

    // Countdown at 3, 2, 1
    for (const sec of [3, 2, 1]) {
      if (prevTimer > sec && this.tripleFlame.timer <= sec) {
        this.addFloatingText(this.width / 2, this.height / 2 - 50, `${sec}...`, sec <= 2 ? '#f87171' : '#fbbf24');
      }
    }

    if (this.tripleFlame.timer <= 0) {
      this.tripleFlame.active = false;
      this.tripleFlame.timer = 0;
      this.addFloatingText(this.width / 2, this.height / 2 - 50, '三喷火枪模式结束', '#9ca3af');
    }
  }

  // ========== RADAR LASER =========
  activateRadarLaser() {
    if (this.radarLaser.active) {
      this.radarLaser.timer = this.radarLaser.duration;
      return;
    }
    this.radarLaser.active = true;
    this.radarLaser.timer = this.radarLaser.duration;
    this.radarLaser.fireTimer = 0;
    this.radarLaser.targetId = null;
    this.radarLaser.laserAlpha = 1;
    this.radarLaser.shotsRemaining = 5;
    this.audio.playRadarActivate();
    Vibration.vibrateItemUse();
    this.addFloatingText(this.width / 2, this.height / 2 - 60, '雷达激光启动! 自动追踪目标', '#22d3ee');
    this.addFloatingText(this.width / 2, this.height / 2 - 40, '5发激光，伤害与小蟑螂一致', '#67e8f9');
  }

  updateRadarLaser() {
    if (!this.radarLaser.active) return;

    this.radarLaser.timer -= this.deltaTime;
    this.radarLaser.fireTimer -= this.deltaTime;

    // Countdown warnings
    const prevTimer = this.radarLaser.timer + this.deltaTime;
    if (prevTimer > 3 && this.radarLaser.timer <= 3) {
      this.addFloatingText(this.width / 2, this.height / 2 - 80, '雷达激光 3秒...', '#67e8f9');
    }
    if (prevTimer > 1 && this.radarLaser.timer <= 1) {
      this.addFloatingText(this.width / 2, this.height / 2 - 60, '雷达激光即将关闭!', '#f87171');
    }

    if (this.radarLaser.timer <= 0) {
      this.radarLaser.active = false;
      this.radarLaser.timer = 0;
      this.radarLaser.laserAlpha = 0;
      this.addFloatingText(this.width / 2, this.height / 2 - 50, '雷达激光关闭', '#9ca3af');
      return;
    }

    // Find target if none or target dead
    let target = this.roaches.find(r => r.id === this.radarLaser.targetId && r.state === RoachState.ALIVE);
    if (!target) {
      // Find closest alive roach (prefer unarmored, fallback to armored)
      let minDistUnarmored = Infinity;
      let closestUnarmored: Roach | undefined = undefined;
      let minDistArmored = Infinity;
      let closestArmored: Roach | undefined = undefined;
      for (const r of this.roaches) {
        if (r.state !== RoachState.ALIVE || r.isBoss) continue;
        const dx = r.x - this.player.x;
        const dy = r.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (r.armorHp > 0) {
          if (dist < minDistArmored) {
            minDistArmored = dist;
            closestArmored = r;
          }
        } else {
          if (dist < minDistUnarmored) {
            minDistUnarmored = dist;
            closestUnarmored = r;
          }
        }
      }
      // Prefer unarmored target; only target armored if no unarmored roaches exist
      target = closestUnarmored ?? closestArmored;
      if (target) {
        this.radarLaser.targetId = target.id;
      }
    }

    if (!target || target.state !== RoachState.ALIVE) {
      this.radarLaser.targetId = null;
      return;
    }

    // Fire laser at intervals (only if shots remaining)
    if (this.radarLaser.fireTimer <= 0 && this.radarLaser.shotsRemaining > 0) {
      this.radarLaser.fireTimer = this.radarLaser.fireInterval;
      this.radarLaser.shotsRemaining--;
      this.audio.playRadarShot();

      // Radar laser has NO effect on BOSS
      if (target.isBoss) return;
      // Skip timed suicide roach during bomb placement (invincible)
      if (target.type === RoachType.TIMED_SUICIDE && target.placeTimer && target.placeTimer > 0) return;

      const damage = this.radarLaser.damage;
      target.hp -= damage;
      target.damageFlash = 1;

      // Spawn laser hit particles
      this.spawnSparkParticles(target.x, target.y, 8);
      this.particles.push({
        x: target.x, y: target.y,
        vx: 0, vy: -20,
        life: 0.3, maxLife: 0.3,
        size: 8, color: '#22d3ee',
        type: ParticleType.EXPLOSION,
      });

      // Show remaining shots
      if (this.radarLaser.shotsRemaining > 0) {
        this.addFloatingText(this.player.x + 30, this.player.y - 40, `激光 x${this.radarLaser.shotsRemaining}`, '#22d3ee');
      } else {
        this.addFloatingText(this.width / 2, this.height / 2 - 50, '激光发射完毕!', '#9ca3af');
        this.radarLaser.active = false;
        this.radarLaser.laserAlpha = 0;
      }

      // Kill if dead
      if (target.hp <= 0) {
        this.killRoach(target, this.roaches.indexOf(target));
        this.addFloatingText(target.x, target.y - 20, '激光击杀!', '#22d3ee');
        this.radarLaser.targetId = null;
      } else {
        this.addFloatingText(target.x, target.y - 30, `-${damage}`, '#22d3ee');
      }
    }
  }

  // ========== INSECTICIDE SPRAY =========
  activateInsecticideSpray() {
    if (this.insecticideSpray.active) {
      this.insecticideSpray.timer = this.insecticideSpray.duration;
      return;
    }
    this.insecticideSpray.active = true;
    this.insecticideSpray.timer = this.insecticideSpray.duration;
    this.insecticideSpray.damageTimer = 0;
    this.audio.playInsecticideSpray();
    Vibration.vibrateItemUse();
    this.addFloatingText(this.width / 2, this.height / 2 - 60, '双侧毒气喷射!', '#4ade80');
    this.addFloatingText(this.width / 2, this.height / 2 - 40, '两侧横向毒雾3秒', '#86efac');
    this.screenShake = 4;
  }

  updateInsecticideSpray() {
    if (!this.insecticideSpray.active) return;

    const spray = this.insecticideSpray;
    spray.timer -= this.deltaTime;
    spray.damageTimer -= this.deltaTime;

    // Countdown warnings
    const prevTimer = spray.timer + this.deltaTime;
    if (prevTimer > 1 && spray.timer <= 1) {
      this.addFloatingText(this.width / 2, this.height / 2 - 80, '毒气喷射即将结束!', '#f87171');
    }

    if (spray.timer <= 0) {
      spray.active = false;
      spray.timer = 0;
      this.spawnInsecticideFadeOut();
      this.addFloatingText(this.width / 2, this.height / 2 - 50, '毒气喷射结束', '#9ca3af');
      return;
    }

    // Spawn spray particles every frame
    this.spawnInsecticideParticles();

    // Apply damage at intervals
    if (spray.damageTimer <= 0) {
      spray.damageTimer = spray.damageInterval;
      this.applyInsecticideDamage();
    }
  }

  spawnInsecticideParticles() {
    const h = this.height;
    const w = this.width;
    const cy = h / 2;

    // Left side spray (spraying rightward)
    for (let i = 0; i < 6; i++) {
      const py = cy + (Math.random() - 0.5) * h * 0.6;
      const life = 0.3 + Math.random() * 0.4;
      const speed = 100 + Math.random() * 80;
      const greenBase = 180 + Math.random() * 60;
      const alpha = 0.25 + Math.random() * 0.25;
      this.particles.push({
        x: 10 + Math.random() * 30, y: py,
        vx: speed * (0.5 + Math.random() * 0.5),
        vy: (Math.random() - 0.5) * 30,
        life, maxLife: life,
        size: 5 + Math.random() * 10,
        color: `rgba(${50 + Math.random() * 30}, ${greenBase}, ${50 + Math.random() * 20}, ${alpha})`,
        type: ParticleType.POISON_CLOUD,
      });
    }

    // Right side spray (spraying leftward)
    for (let i = 0; i < 6; i++) {
      const py = cy + (Math.random() - 0.5) * h * 0.6;
      const life = 0.3 + Math.random() * 0.4;
      const speed = 100 + Math.random() * 80;
      const greenBase = 180 + Math.random() * 60;
      const alpha = 0.25 + Math.random() * 0.25;
      this.particles.push({
        x: w - 10 - Math.random() * 30, y: py,
        vx: -speed * (0.5 + Math.random() * 0.5),
        vy: (Math.random() - 0.5) * 30,
        life, maxLife: life,
        size: 5 + Math.random() * 10,
        color: `rgba(${50 + Math.random() * 30}, ${greenBase}, ${50 + Math.random() * 20}, ${alpha})`,
        type: ParticleType.POISON_CLOUD,
      });
    }

    // Fine droplet particles - smaller, faster
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 3; i++) {
        const px = side === 0 ? 15 + Math.random() * 20 : w - 15 - Math.random() * 20;
        const py = cy + (Math.random() - 0.5) * h * 0.5;
        const life = 0.2 + Math.random() * 0.25;
        const vxDir = side === 0 ? 1 : -1;
        this.particles.push({
          x: px, y: py,
          vx: vxDir * (80 + Math.random() * 60),
          vy: (Math.random() - 0.5) * 40,
          life, maxLife: life,
          size: 2 + Math.random() * 4,
          color: `rgba(${120 + Math.random() * 40}, 255, ${120 + Math.random() * 40}, ${0.5 + Math.random() * 0.3})`,
          type: ParticleType.SPARK,
        });
      }
    }

    // Side nozzle burst effects
    for (let side = 0; side < 2; side++) {
      const nx = side === 0 ? 10 : w - 10;
      for (let i = 0; i < 2; i++) {
        const vxDir = side === 0 ? 1 : -1;
        this.particles.push({
          x: nx, y: cy + (Math.random() - 0.5) * 20,
          vx: vxDir * (60 + Math.random() * 40),
          vy: (Math.random() - 0.5) * 30,
          life: 0.15 + Math.random() * 0.15,
          maxLife: 0.15 + Math.random() * 0.15,
          size: 4 + Math.random() * 6,
          color: `rgba(${100 + Math.random() * 30}, 240, ${100 + Math.random() * 20}, ${0.6 + Math.random() * 0.3})`,
          type: ParticleType.POISON_CLOUD,
        });
      }
    }
  }

  spawnInsecticideFadeOut() {
    const w = this.width;
    const cy = this.height / 2;
    // Dispersal particles from both sides
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 8; i++) {
        const px = side === 0 ? 10 + Math.random() * 40 : w - 10 - Math.random() * 40;
        const speed = 30 + Math.random() * 50;
        this.particles.push({
          x: px, y: cy + (Math.random() - 0.5) * 200,
          vx: (side === 0 ? 1 : -1) * Math.cos(Math.random() * Math.PI * 0.5) * speed,
          vy: (Math.random() - 0.5) * speed,
          life: 0.5 + Math.random() * 0.5,
          maxLife: 0.5 + Math.random() * 0.5,
          size: 5 + Math.random() * 10,
          color: `rgba(${60 + Math.random() * 30}, ${160 + Math.random() * 50}, ${60 + Math.random() * 20}, ${0.2 + Math.random() * 0.2})`,
          type: ParticleType.POISON_CLOUD,
        });
      }
    }
  }

  applyInsecticideDamage() {
    const w = this.width;
    const h = this.height;
    const cy = h / 2;
    const spray = this.insecticideSpray;
    const horizontalRange = w * 0.4; // horizontal spray range
    const verticalRange = h * 0.4;   // vertical coverage
    let hitCount = 0;

    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;

      // Check if roach is in left spray zone or right spray zone
      const inLeftSpray = r.x < horizontalRange && Math.abs(r.y - cy) < verticalRange;
      const inRightSpray = r.x > w - horizontalRange && Math.abs(r.y - cy) < verticalRange;

      if (inLeftSpray || inRightSpray) {
        // ===== ARMOR BUFF: spray completely ineffective vs armored roaches =====
        if (r.armorHp > 0) {
          this.addFloatingText(r.x, r.y - 20, '护甲免疫!', '#60a5fa');
          continue; // skip this roach entirely
        }
        // Skip timed suicide roach during bomb placement (invincible)
        if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
        // Low initial damage (only vs unarmored)
        const dmg = spray.baseDamage * 0.5;
        r.hp -= dmg;
        hitCount++;

        // Apply poison: 3 seconds, damage over time
        r.poisonTimer = 3;
        r.poisonDamage = 1.0;

        // Visual: damage flash (no reaction while armor intact)
        r.damageFlash = (r.armorHp > 0) ? 0 : 0.15;

        // Spawn hit particles on roach
        if (Math.random() < 0.3) {
          this.particles.push({
            x: r.x + (Math.random() - 0.5) * 10,
            y: r.y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 30,
            vy: -20 - Math.random() * 30,
            life: 0.3,
            maxLife: 0.3,
            size: 2 + Math.random() * 3,
            color: `rgba(${80 + Math.random() * 40}, 220, ${80 + Math.random() * 20}, 0.7)`,
            type: ParticleType.POISON_CLOUD,
          });
        }
      }
    }

    if (hitCount > 0) {
      this.addFloatingText(w / 2, cy - 80, `毒气命中${hitCount}只!`, '#4ade80');
    }
  }

  // ========== STICKY DROP SPRAY =========
  activateStickySpray() {
    const cx = this.width / 2;
    const cy = this.defenseLineY();
    const DROP_COUNT = 10;
    const FIRE_INTERVAL = 0.08; // 80ms between each drop

    // Schedule 10 drops with staggered spawn
    for (let i = 0; i < DROP_COUNT; i++) {
      const delay = i * FIRE_INTERVAL;
      // Use a simple timer approach - store pending drops
      this.scheduleStickyDrop(cx, cy, delay);
    }

    this.audio.playStickySpray();
    Vibration.vibrateItemUse();
    this.addFloatingText(cx, cy - 60, '蟑螂贴板发射!', '#facc15');
    this.addFloatingText(cx, cy - 40, '10个追踪水滴', '#fde047');
    this.screenShake = 3;
  }

  scheduleStickyDrop(cx: number, cy: number, delay: number) {
    // Create a pre-spawn drop that will activate after delay
    this.stickyDrops.push({
      id: this.nextStickyDropId++,
      x: cx,
      y: cy,
      vx: 0,
      vy: -80 - Math.random() * 40, // initial upward burst
      targetId: null,
      speed: 250 + Math.random() * 100,
      life: delay + 3, // extra life after delay
      maxLife: 3,
      size: 6 + Math.random() * 3,
      hit: false,
    });
  }

  updateStickyDrops() {
    for (let i = this.stickyDrops.length - 1; i >= 0; i--) {
      const drop = this.stickyDrops[i];
      drop.life -= this.deltaTime;

      // Pre-spawn phase (delay > life remaining > maxLife)
      if (drop.life > drop.maxLife) {
        // Still in delay phase - just do small idle animation at spawn point
        drop.y += Math.sin(this.time * 10 + drop.id) * 0.5;
        continue;
      }

      // Drop has expired
      if (drop.life <= 0) {
        // Release wrapped roach if this drop had one
        if (drop.targetId !== null) {
          const r = this.roaches.find(r => r.id === drop.targetId);
          if (r && r.state === RoachState.ALIVE) {
            r.wrappedByDropId = null;
            r.wrapTimer = 0;
            r.speed = r.baseSpeed; // restore speed
          }
        }
        this.stickyDrops.splice(i, 1);
        continue;
      }

      // If already hit a roach, keep it glued to the roach
      if (drop.hit && drop.targetId !== null) {
        const target = this.roaches.find(r => r.id === drop.targetId);
        if (target && target.state === RoachState.ALIVE) {
          drop.x = target.x;
          drop.y = target.y;
          // Sticky board has NO effect on BOSS - skip entirely
          if (target.isBoss) {
            // Remove the drop without any effect
            this.stickyDrops.splice(i, 1);
            continue;
          } else {
            // Normal roach: immobilized for remaining drop lifetime (12s max)
            target.vx = 0;
            target.vy = 0;
            target.speed = 0;
            target.wrappedByDropId = drop.id;
            target.wrapTimer = drop.life;
          }
          // Periodic damage (only if no armor and not placing bomb)
          if (Math.random() < this.deltaTime * 2 && !(target.type === RoachType.TIMED_SUICIDE && target.placeTimer && target.placeTimer > 0)) {
            if (target.armorHp > 0) {
              // Armor blocks sticky board damage
              if (Math.random() < 0.1) {
                this.addFloatingText(target.x, target.y - 15, '护甲免疫', '#60a5fa');
              }
            } else {
              target.hp -= 0.5;
              target.damageFlash = 0.1;
            }
          }
          // Emit yellow particles
          if (Math.random() < 0.1) {
            this.particles.push({
              x: target.x + (Math.random() - 0.5) * 20,
              y: target.y + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 20,
              vy: -10 - Math.random() * 20,
              life: 0.3, maxLife: 0.3,
              size: 2 + Math.random() * 3,
              color: `rgba(250, 200, 50, ${0.5 + Math.random() * 0.3})`,
              type: ParticleType.ICE,
            });
          }
        } else {
          // Target dead - remove drop immediately and clean up
          if (target) {
            target.wrappedByDropId = null;
            target.wrapTimer = 0;
          }
          this.stickyDrops.splice(i, 1);
        }
        continue;
      }

      // Flying phase - seek target
      // Find closest alive roach that isn't already wrapped
      let target: Roach | null = null;
      let minDist = Infinity;
      for (const r of this.roaches) {
        if (r.state !== RoachState.ALIVE) continue;
        if (r.wrappedByDropId !== null) continue; // already wrapped
        const dx = r.x - drop.x;
        const dy = r.y - drop.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist && d < 400) { // max tracking range
          minDist = d;
          target = r;
        }
      }

      if (target) {
        // Homing behavior
        const dx = target.x - drop.x;
        const dy = target.y - drop.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) {
          const targetVx = (dx / d) * drop.speed;
          const targetVy = (dy / d) * drop.speed;
          // Smooth steering
          drop.vx += (targetVx - drop.vx) * 5 * this.deltaTime;
          drop.vy += (targetVy - drop.vy) * 5 * this.deltaTime;
        }
        drop.targetId = target.id;

        // Check collision
        const targetSize = (target.size ?? ENEMY_DEFS[target.type].size) * this.getPerspectiveScale(target.y);
        if (d < targetSize * 0.5 + drop.size) {
          // ===== STICKY DROP HIT =====
          // Sticky board has NO effect on BOSS - mark for deletion
          if (target.isBoss) {
            drop.hit = true;
            drop.life = 0; // expire immediately, no effect
            continue;
          } else {
            // Normal roach: 12-second wrap
            drop.hit = true;
            drop.life = 12; // expire after 12 seconds
            drop.x = target.x;
            drop.y = target.y;
            target.wrappedByDropId = drop.id;
            target.wrapTimer = 12; // 12-second control
            target.speed = 0;
            target.vx = 0;
            target.vy = 0;
            this.addFloatingText(target.x, target.y - 20, '粘住12秒!', '#facc15');
          }
          // Hit particles
          for (let p = 0; p < 8; p++) {
            this.particles.push({
              x: target.x + (Math.random() - 0.5) * 15,
              y: target.y + (Math.random() - 0.5) * 15,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60,
              life: 0.3, maxLife: 0.3,
              size: 2 + Math.random() * 4,
              color: `rgba(250, 220, 50, ${0.6 + Math.random() * 0.4})`,
              type: ParticleType.ICE,
            });
          }
        }
      } else {
        // No target, fly upward and curve slightly
        drop.vy -= 20 * this.deltaTime;
        drop.vx += Math.sin(this.time * 3 + drop.id) * 30 * this.deltaTime;
      }

      // Move drop
      drop.x += drop.vx * this.deltaTime;
      drop.y += drop.vy * this.deltaTime;

      // Bounds check
      if (drop.y < -50 || drop.y > this.height + 50 || drop.x < -50 || drop.x > this.width + 50) {
        this.stickyDrops.splice(i, 1);
      }
    }
  }

  // ========== ITEM PLACEMENT: icon click → screen click → drag → release =========
  selectItem(index: number) {
    if (index < 0 || index >= this.inventory.length) return;
    if (this.inventory[index].count <= 0) return;

    const item = this.inventory[index];

    // Check picked-up item cooldown (shares globalConsumableCooldown with shop consumables)
    if (this.globalConsumableCooldown > 0) {
      this.addFloatingText(this.player.x, this.player.y - 40, `道具冷却中... (${this.globalConsumableCooldown.toFixed(1)}s)`, '#94a3b8', 800);
      return;
    }
    if ((this.itemCooldowns[item.type] || 0) > 0) {
      const def = WEAPON_DROP_DEFS[item.type as keyof typeof WEAPON_DROP_DEFS];
      this.addFloatingText(this.player.x, this.player.y - 40, `${def?.name || ''}冷却中... (${this.itemCooldowns[item.type].toFixed(1)}s)`, '#94a3b8', 800);
      return;
    }

    // Helper to set cooldown after using a picked-up item
    const startItemCooldown = (type: string) => {
      const def = WEAPON_DROP_DEFS[type as keyof typeof WEAPON_DROP_DEFS];
      if (def && def.cooldown > 0) {
        this.itemCooldowns[type] = def.cooldown;
      }
      this.globalConsumableCooldown = 1; // 1 second global cooldown (shared with shop consumables)
    };

    // Shotgun is instant-use (activates triple flame), not placement
    if (item.type === 'shotgun') {
      item.count--;
      this.activateTripleFlame();
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
      this.activateRadarLaser();
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
      this.activateInsecticideSpray();
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
      this.activateStickySpray();
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
      this.activateFan();
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
      this.useSwatter();
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

  // ========== STICKY BOARD ==========
  // Calculate perspective scale: smaller when higher (farther from bottom)
  getPerspectiveScale(y: number): number {
    const bottomY = this.defenseLineY();
    const topY = this.height * 0.2; // horizon line
    const t = Math.max(0, Math.min(1, (bottomY - y) / (bottomY - topY)));
    // t=0 at bottom (scale=1.0), t=1 at top (scale=0.3)
    return 0.3 + t * 0.7;
  }

  applyStickyBoardEffect(x: number, y: number) {
    const BASE_W = 240;
    const BASE_H = 240;
    const scale = this.getPerspectiveScale(y);

    this.stickyBoards.push({
      id: Date.now() + Math.random(),
      x: x,
      y: y,
      width: Math.round(BASE_W * scale),
      height: Math.round(BASE_H * scale),
      hitWidth: 240,
      hitHeight: 240,
      life: 5, // 5 seconds control duration
      maxLife: 5,
      stuckRoaches: [],
      maxStuck: 5,
    });

    this.spawnSparkParticles(x, y, 4);
    this.addFloatingText(x, y - 30, '贴板!', '#facc15');
  }

  updateStickyBoards() {
    for (let i = this.stickyBoards.length - 1; i >= 0; i--) {
      const board = this.stickyBoards[i];
      board.life -= this.deltaTime;

      if (board.life <= 0) {
        // Release stuck roaches
        for (const roachId of board.stuckRoaches) {
          const r = this.roaches.find(r => r.id === roachId);
          if (r && r.state === RoachState.ALIVE) {
            r.speed = r.baseSpeed; // restore speed
          }
        }
        this.stickyBoards.splice(i, 1);
        continue;
      }

      // Check roaches entering the board area (use hitWidth/hitHeight for real collision)
      const hitHalfW = board.hitWidth / 2;
      const hitHalfH = board.hitHeight / 2;

      for (const r of this.roaches) {
        if (r.state !== RoachState.ALIVE) continue;
        // Already stuck by this board
        if (board.stuckRoaches.includes(r.id)) {
          // Keep roach inside hit area (real collision bounds)
          r.x = Math.max(board.x - hitHalfW + 10, Math.min(board.x + hitHalfW - 10, r.x));
          r.y = Math.max(board.y - hitHalfH + 10, Math.min(board.y + hitHalfH - 10, r.y));
          r.vx = 0;
          r.vy = 0;
          r.speed = 0;
          continue;
        }

        // Board is full
        if (board.stuckRoaches.length >= board.maxStuck) continue;

        // Check if roach is inside real hit area (240x240)
        if (r.x > board.x - hitHalfW && r.x < board.x + hitHalfW &&
            r.y > board.y - hitHalfH && r.y < board.y + hitHalfH) {
          board.stuckRoaches.push(r.id);
          r.speed = 0;
          r.vx = 0;
          r.vy = 0;
          // Show text only for first roach stuck per board (reduce visual clutter)
          if (board.stuckRoaches.length === 1) {
            this.addFloatingText(r.x, r.y - 20, '粘住!', '#facc15');
          }
        }
      }
    }
  }

  cancelItemPlacement() {
    this.itemPlaceState = 'idle';
    this.selectedItemIndex = -1;
  }

  applyPoisonEffect(x: number, y: number) {
    const rx = this.itemEffectRadiusX;
    const ry = this.itemEffectRadiusY;
    let hitCount = 0;
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      // Skip timed suicide roach during bomb placement (invincible)
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
      const dx = (r.x - x) / rx;
      const dy = (r.y - y) / ry;
      if (dx * dx + dy * dy < 1) {
        r.poisonTimer = 6;
        r.poisonDamage = 2;
        r.hp -= 2;
        hitCount++;
      }
    }
    this.fireZones.push({
      x, y, radius: rx * 0.5,
      damagePerSecond: 25,
      life: 6, maxLife: 6,
      type: 'poison',
    });
    this.spawnPoisonExplosion(x, y, rx * 0.5);
    this.addFloatingText(x, y - 20, hitCount > 0 ? `毒雾!(${hitCount}只)` : '毒雾!', '#a78bfa');
    this.screenShake = 3;
  }

  // ========== 风扇激活 =========
  /** 激活风扇（减速并击退蟑螂） */
  activateFan() {
    this.fanState.active = true;
    // Apply mechanical mastery talent: fan duration boost
    const fanDurationMult = this.talentMultipliers.fanDuration || 1;
    this.fanState.timer = this.fanState.duration * fanDurationMult;
    this.fanState.bladeAngle = 0;
    this.audio.startFanLoop();
    const durationText = fanDurationMult > 1
      ? `蟑螂被吹退${(8 * fanDurationMult).toFixed(1)}秒!(+天赋)`
      : '蟑螂被吹退8秒!';
    this.addFloatingText(this.width / 2, this.height * 0.3, '强力风扇启动!', '#a78bfa');
    this.addFloatingText(this.width / 2, this.height * 0.3 + 20, durationText, '#c4b5fd');
    this.screenShake = 4;

    // Apply slow to all current roaches
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      this.applyFanEffect(r);
    }
  }

  // Get fan effect parameters by roach type
  // Returns [slowFactor, pushSpeed] - higher = more effect
  getFanEffectByType(type: RoachType): [number, number] {
    switch (type) {
      // Flying roaches: most affected (light weight, large wing surface)
      case RoachType.FLYING: return [0.70, 120];
      // Flying suicide: also highly affected (flying)
      case RoachType.FLYING_SUICIDE: return [0.65, 100];
      // Small roaches: heavily affected (light, easy to blow)
      case RoachType.SMALL: return [0.60, 80];
      // Large roaches: moderately affected
      case RoachType.LARGE: return [0.40, 50];
      // Splitting roaches: same as large
      case RoachType.SPLITTING: return [0.40, 50];
      // Suicide roaches: somewhat affected (carrying bomb)
      case RoachType.SUICIDE: return [0.30, 35];
      // Armored roaches: slightly affected (heavy shell)
      case RoachType.ARMORED: return [0.20, 25];
      // Queen: barely affected (very heavy)
      case RoachType.QUEEN: return [0.10, 15];
      default: return [0.40, 50];
    }
  }

  applyFanEffect(r: Roach) {
    const [slowFactor] = this.getFanEffectByType(r.type);
    // Apply mechanical mastery talent: fan slow boost
    const fanSlowMult = this.talentMultipliers.fanSlow || 1;
    r.fanSlowFactor = slowFactor * fanSlowMult;
    // Apply mechanical mastery talent: fan duration boost
    const fanDurationMult = this.talentMultipliers.fanDuration || 1;
    r.fanSlowTimer = this.fanState.duration * fanDurationMult;
    r.fanPushY = 0; // reset push accumulation
  }

  updateFan() {
    const fan = this.fanState;
    if (!fan.active) return;

    fan.timer -= this.deltaTime;
    fan.bladeAngle += fan.bladeSpeed * this.deltaTime;

    const fanTopY = this.height / 2; // fan effect range: defense line to screen center

    // Apply fan effect to new roaches that spawned during fan active
    // Only affect roaches within fan range (defense line to screen center), EXCEPT BOSS
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      if (r.fanSlowTimer <= 0 && fan.timer > 0 && r.y >= fanTopY && r.y <= this.defenseLineY()) {
        this.applyFanEffect(r);
      }
    }

    // Push all affected roaches upward (backward)
    // Only push if roach is within fan range, EXCEPT BOSS
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;
      if (r.fanSlowTimer > 0 && r.y >= fanTopY) {
        const [, pushSpeed] = this.getFanEffectByType(r.type);
        // Accumulate upward push (negative Y = toward top of screen)
        const pushAmount = pushSpeed * this.deltaTime;
        r.fanPushY -= pushAmount;
      }
    }

    if (fan.timer <= 0) {
      fan.active = false;
      fan.timer = 0;
      this.audio.stopFanLoop();
      this.addFloatingText(this.width / 2, this.height * 0.3, '风扇停止', '#9ca3af');
      // Clear fan effects from all roaches
      for (const r of this.roaches) {
        r.fanSlowTimer = 0;
        r.fanSlowFactor = 0;
        r.fanPushY = 0;
      }
      return;
    }

    // Update slow timers on affected roaches
    for (const r of this.roaches) {
      if (r.fanSlowTimer > 0) {
        r.fanSlowTimer -= this.deltaTime;
        if (r.fanSlowTimer <= 0) {
          r.fanSlowFactor = 0;
        }
      }
    }
  }

  renderFan(ctx: CanvasRenderingContext2D) {
    if (!this.fanState.active) return;
    const fan = this.fanState;
    const W = this.width;
    const H = this.height;
    const dl = this.defenseLineY();
    const fanTopY = H / 2; // fan effect top boundary: screen center
    const t = this.time;
    const RANGE = dl - fanTopY; // total vertical range of fan effect
    // fan source width at defense line (bottom)
    const SOURCE_WIDTH = W * 0.7;

    ctx.save();

    // ========== PERSPECTIVE AIRFLOW - 底部最宽，向上逐渐收窄 ==========
    const waveCount = 18;
    for (let i = 0; i < waveCount; i++) {
      // Spread waves across the fan source width at bottom
      const srcX = (i / (waveCount - 1)) * SOURCE_WIDTH + (W - SOURCE_WIDTH) / 2;
      const waveSpeed = 2.0 + i * 0.3;
      const wavePhase = t * waveSpeed + i * 2.7;
      // Perspective: wider waves at bottom, narrow at top
      const baseAmplitude = 14 + i * 1.5;

      ctx.globalAlpha = 0.04 + Math.sin(wavePhase * 0.5) * 0.03;
      ctx.strokeStyle = i % 3 === 0 ? '#c4b5fd' : '#a78bfa';
      ctx.lineWidth = 2.0 + Math.sin(wavePhase) * 1.0;
      ctx.beginPath();

      // Draw from defense line going UP to fanTopY with perspective taper
      let firstPoint = true;
      for (let y = dl; y >= fanTopY; y -= 5) {
        const normalizedY = (dl - y) / RANGE; // 0 at bottom, 1 at top (within fan range)
        // Perspective: width decreases as we go up (taper to 8% at top)
        const perspectiveScale = 1.0 - normalizedY * 0.92;
        const cx = W / 2 + (srcX - W / 2) * perspectiveScale;
        const amplitude = baseAmplitude * perspectiveScale;
        const x = cx + Math.sin(normalizedY * Math.PI * 6 + wavePhase) * amplitude;
        if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ========== PERSPECTIVE GUST FRONTS - 扇形向上推进 ==========
    const gustCount = 5;
    for (let g = 0; g < gustCount; g++) {
      const gustSpeed = 0.5 + g * 0.3;
      const gustPhase = (t * gustSpeed + g / gustCount) % 1.0;
      const gustY = dl - gustPhase * RANGE; // gust moves from dl up to fanTopY
      const gustAlpha = Math.sin(gustPhase * Math.PI) * 0.15;
      if (gustAlpha <= 0 || gustY < fanTopY) continue;

      const normalizedY = (dl - gustY) / RANGE;
      // Perspective: gust width decreases going up
      const perspectiveScale = 1.0 - normalizedY * 0.92;
      const gustHalfWidth = (SOURCE_WIDTH / 2) * perspectiveScale;
      const gustHeight = 45 + g * 12;

      // Tapered gust shape
      const grad = ctx.createLinearGradient(0, gustY - gustHeight / 2, 0, gustY + gustHeight / 2);
      grad.addColorStop(0, 'rgba(167, 139, 250, 0)');
      grad.addColorStop(0.5, `rgba(196, 181, 253, ${gustAlpha})`);
      grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(W / 2 - gustHalfWidth, gustY - gustHeight / 2, gustHalfWidth * 2, gustHeight);

      // Gust edge lines with perspective
      ctx.globalAlpha = gustAlpha * 1.5;
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 1.5;
      // Left edge
      ctx.beginPath();
      ctx.moveTo(W / 2 - SOURCE_WIDTH / 2, dl);
      ctx.lineTo(W / 2 - gustHalfWidth, gustY);
      ctx.stroke();
      // Right edge
      ctx.beginPath();
      ctx.moveTo(W / 2 + SOURCE_WIDTH / 2, dl);
      ctx.lineTo(W / 2 + gustHalfWidth, gustY);
      ctx.stroke();
      // Center gust line
      ctx.beginPath();
      for (let x = W / 2 - gustHalfWidth * 0.8; x <= W / 2 + gustHalfWidth * 0.8; x += 6) {
        const offset = Math.sin(x * 0.02 + t * 4 + g * 2) * 5 * perspectiveScale;
        if (x === W / 2 - gustHalfWidth * 0.8) ctx.moveTo(x, gustY + offset);
        else ctx.lineTo(x, gustY + offset);
      }
      ctx.stroke();
    }

    // ========== PERSPECTIVE PARTICLES - 从底部扇形向上飘，限制在风扇范围内 ==========
    const particleCount = 28;
    for (let p = 0; p < particleCount; p++) {
      const riseSpeed = 50 + (p % 5) * 30;
      const phase = (p * 137.5 + t * riseSpeed) % RANGE; // particles only within fan range
      const py = dl - phase; // py ranges from dl down to fanTopY
      const normalizedY = phase / RANGE;
      const perspectiveScale = 1.0 - normalizedY * 0.92;
      // Particles spread within the fan source width, tapering upward
      const srcHalfWidth = SOURCE_WIDTH / 2;
      const baseX = (p * 97.3) % SOURCE_WIDTH - srcHalfWidth;
      const px = W / 2 + baseX * perspectiveScale + Math.sin(t * 2 + p) * 8 * perspectiveScale;
      const pSize = (1.8 + Math.sin(p + t) * 0.6) * perspectiveScale;
      const pAlpha = (0.15 + Math.sin(t * 2.5 + p * 1.7) * 0.1) * (0.5 + normalizedY * 0.5);

      ctx.globalAlpha = Math.max(0, pAlpha);
      ctx.fillStyle = p % 2 === 0 ? '#ddd6fe' : '#c4b5fd';

      ctx.save();
      ctx.translate(px, py);
      // Particles tilt slightly with perspective
      ctx.rotate(Math.sin(t + p * 0.5) * 0.3 - 0.1);
      ctx.fillRect(-pSize / 2, -pSize * 2.5, pSize, pSize * 5);
      ctx.restore();
    }

    // ========== FAN SOURCE OUTLINE - 扇形透视轮廓 ==========
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth = 1.5;
    // Left edge of fan cone
    ctx.beginPath();
    ctx.moveTo(W / 2 - SOURCE_WIDTH / 2, dl);
    ctx.lineTo(W / 2 - SOURCE_WIDTH * 0.04, fanTopY);
    ctx.stroke();
    // Right edge of fan cone
    ctx.beginPath();
    ctx.moveTo(W / 2 + SOURCE_WIDTH / 2, dl);
    ctx.lineTo(W / 2 + SOURCE_WIDTH * 0.04, fanTopY);
    ctx.stroke();
    // Arc at top (narrow opening at fanTopY, 8% width)
    ctx.beginPath();
    ctx.arc(W / 2, fanTopY, SOURCE_WIDTH * 0.04, 0, Math.PI, true);
    ctx.stroke();

    // ========== SOURCE GLOW at defense line (only within fan range) ==========
    const sourceGrad = ctx.createRadialGradient(W / 2, dl, 0, W / 2, dl, SOURCE_WIDTH / 2);
    sourceGrad.addColorStop(0, 'rgba(167, 139, 250, 0.18)');
    sourceGrad.addColorStop(0.5, 'rgba(196, 181, 253, 0.06)');
    sourceGrad.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = sourceGrad;
    ctx.fillRect(W / 2 - SOURCE_WIDTH / 2, fanTopY, SOURCE_WIDTH, RANGE);

    // ========== FAN ICON + TIMER at bottom center ==========
    const iconCX = W / 2;
    const iconCY = dl - 30;
    const iconSize = 22;

    // Fan base
    ctx.fillStyle = 'rgba(229, 231, 235, 0.9)';
    ctx.beginPath();
    ctx.arc(iconCX, iconCY, iconSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Spinning blades
    for (let i = 0; i < 3; i++) {
      const angle = fan.bladeAngle + (i * Math.PI * 2 / 3);
      const bx = iconCX + Math.cos(angle) * iconSize * 0.55;
      const by = iconCY + Math.sin(angle) * iconSize * 0.55;
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.ellipse(bx, by, 4, 8, angle + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center hub
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.arc(iconCX, iconCY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Timer text
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`风扇 ${fan.timer.toFixed(1)}s`, iconCX, iconCY - iconSize - 8);

    // Slow indicator
    ctx.fillStyle = 'rgba(167, 139, 250, 0.7)';
    ctx.font = '10px sans-serif';
    ctx.fillText('吹退中', iconCX, iconCY - iconSize - 20);

    ctx.restore();
  }

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

  // ========== 敌人生成 ==========
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
    if (type === RoachType.QUEEN) this.activeBosses++;
    return r;
  }

  // ========== 敌人 AI ==========
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
      if (this.player.baitTimer > 0 && !isImmobilized && this.baitTarget.active) {
        const baitDx = this.baitTarget.x - r.x;
        const baitDy = this.baitTarget.y - r.y;
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
        if (r.isBoss && r.type === RoachType.QUEEN && this.bossBattle.active) {
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

  applyDamageToRoach(r: Roach, damage: number) {
    // BOSS is immune to all weapon damage - only wave clears reduce boss HP
    if (r.isBoss) return;

    // ===== HOSPITAL EXCLUSIVE: MUTANT TRANSFORMATION INVINCIBILITY =====
    // Mutant roach is completely invincible during the 1-second transformation
    if (r.type === RoachType.MUTANT && r.transformTimer && r.transformTimer > 0) return;

    // ===== HOSPITAL EXCLUSIVE: TIMED SUICIDE BOMB PLACEMENT INVINCIBILITY =====
    if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) return;

    // ===== MUTANT SPAWN: 1-second spawn immunity (frozen + invincible) =====
    if (r.spawnImmuneTimer && r.spawnImmuneTimer > 0) return;

    // ===== ARMOR MEAT SHIELD: check cached protection status =====
    if (r.armorHp <= 0 && this.armorShieldCache.has(r.id)) {
      damage *= 0.2; // Protected: only 20% damage gets through
    }

    // ===== ARMOR BUFF: armor absorbs 80% of flame damage (weakened vs armor) =====
    if (r.armorHp > 0) {
      // Flame weapons are weak vs armor: only 20% damage passes through
      const armorAbsorb = Math.min(r.armorHp, damage * 0.8);
      r.armorHp -= armorAbsorb;
      damage *= 0.2; // only 20% damage gets through armor
      if (r.armorHp <= 0) {
        this.spawnSparkParticles(r.x, r.y, 8);
        const label = r.type === RoachType.NURSE ? '护甲碎裂!' : r.type === RoachType.TIMED_SUICIDE ? '护甲碎裂!' : '破甲!';
        this.addFloatingText(r.x, r.y - 30, label, '#fbbf24');
      }
    }
    r.hp -= damage;
    // ARMOR BUFF: no damage flash while armor is intact
    // Only show damage reaction after armor is broken
    const hasProtection = r.armorHp > 0;
    r.damageFlash = hasProtection ? 0 : (r.isBoss ? 2.0 : 0.4);
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

    // Clean up sticky drop wrap on death
    if (r.wrappedByDropId !== null) {
      const dropIdx = this.stickyDrops.findIndex(d => d.id === r.wrappedByDropId);
      if (dropIdx >= 0) {
        this.stickyDrops.splice(dropIdx, 1);
      }
      r.wrappedByDropId = null;
      r.wrapTimer = 0;
    }

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
      this.activeBosses--;
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


  // Panic trigger when armor is broken: normal roaches flee randomly,
  // suicide roaches charge toward defense line (their purpose!)
  triggerPanicOnArmorBreak(r: Roach) {
    if (r.armorHp <= 0 && r.panicTimer <= 0 && !this.isStuckByBoard(r.id)) {
      r.panicTimer = 0.3 + Math.random() * 0.5;
      const type = r.type as RoachType;
      if (type === RoachType.SUICIDE || type === RoachType.FLYING_SUICIDE) {
        // Suicide roaches: charge toward defense line when armor breaks
        // Angle points downward (toward defense) with small random lateral wobble
        r.panicAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      } else {
        // Normal roaches: panic and flee in random direction
        r.panicAngle = Math.random() * Math.PI * 2;
      }
    }
  }

  // ========== 碰撞检测 ==========
  /** 检测火焰、道具与蟑螂之间的碰撞 */
  checkCollisions() {
    const p = this.player;
    if (!p.isFiring || p.isOverheated || p.isReloading || p.gas <= 0) return;

    // Determine gun positions: center + optional left/right for triple flame
    const nozzleY = p.y - 322;
    const maxRange = p.fireRange * 0.5;

    // Build list of gun positions and their damage multipliers
    const guns: { x: number; damageMult: number }[] = [
      { x: p.x, damageMult: 1.0 }, // center (main)
    ];

    // Add side guns if triple flame is active
    if (this.tripleFlame.active) {
      guns.push({ x: p.x - this.tripleFlame.sideOffset, damageMult: this.tripleFlame.sideDamageMult });
      guns.push({ x: p.x + this.tripleFlame.sideOffset, damageMult: this.tripleFlame.sideDamageMult });
    }

    const beamHalfWidth = 15;

    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      // Weapons cannot damage the BOSS - only clearing waves reduces boss HP
      if (r.isBoss) continue;
      // ===== HOSPITAL EXCLUSIVE: Timed suicide roach placing bomb is immune =====
      if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;

      for (const gun of guns) {
        // For flying roaches (including flying suicide)
        if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
          const flyDist = Math.abs(r.x - gun.x);
          const vertDist = nozzleY - r.y;
          // Wider horizontal hit range for flying roaches (they move erratically)
          const flyHitWidth = beamHalfWidth * 4;
          if (flyDist < flyHitWidth && vertDist > 0 && vertDist < maxRange * 1.3) {
            const falloff = 1 - (vertDist / (maxRange * 1.2)) * 0.7;
            // Store DAMAGE PER SECOND in burnDamage (no deltaTime here)
            const damage = this.getWeaponDamage(p) * p.damageMultiplier * falloff * gun.damageMult;
            this.applyWeaponEffect(r, p.currentWeapon);
            r.burnDamage += damage; // accumulate from multiple guns
            r.inFire = true;
            // Panic when armor broken (handled after type-specific damage)
            this.triggerPanicOnArmorBreak(r);
          }
          continue;
        }

        // Normal ground roaches
        const t = -(r.y - nozzleY) / maxRange;
        const clampedT = Math.max(0, Math.min(1, t));
        const perpDist = Math.abs(r.x - gun.x);

        if (perpDist < beamHalfWidth) {
          const distFromNozzle = clampedT * maxRange;
          const falloff = 1 - (distFromNozzle / maxRange) * 0.7;
          // Store DAMAGE PER SECOND in burnDamage (no deltaTime here)
          let damage = this.getWeaponDamage(p) * p.damageMultiplier * falloff * gun.damageMult;

          if (r.type === RoachType.QUEEN) {
            damage *= (1 - BOSS_CONFIG.queen.resistPercent);
          }
          this.applyWeaponEffect(r, p.currentWeapon);

          r.burnDamage += damage; // accumulate from multiple guns
          r.inFire = true;

          // Panic when armor broken (handled after type-specific damage)
          this.triggerPanicOnArmorBreak(r);
        }
      }
    }

    // ===== HOSPITAL EXCLUSIVE: Flame damage to egg pods =====
    // [DISABLED] Egg pod system removed - no damage to egg pods
    // if (this.currentScene === SceneType.HOSPITAL && this.hospitalEggPods.length > 0) {
    //   ... egg pod damage code removed ...
    // }

    this.fireZones = [];
  }

  isStuckByBoard(roachId: number): boolean {
    // Check legacy sticky boards
    if (this.stickyBoards.some(b => b.stuckRoaches.includes(roachId))) return true;
    // Check new sticky drop wraps
    const r = this.roaches.find(r => r.id === roachId);
    return r !== undefined && r.wrappedByDropId !== null;
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

  checkDefense() {
    const dl = this.defenseLineY();
    for (let i = this.roaches.length - 1; i >= 0; i--) {
      const r = this.roaches[i];
      if (!r || r.state !== RoachState.ALIVE) continue;

      const roachSize = ENEMY_DEFS[r.type].size;
      const roachBottom = r.y + roachSize * 0.4;
      if (roachBottom >= dl) {
        let dmg = 0;
        switch (r.type) {
          case RoachType.SMALL: dmg = this.difficulty === 'hard' ? 5 : 2; break;
          case RoachType.LARGE: dmg = this.difficulty === 'hard' ? 15 : 5; break;
          case RoachType.FLYING: dmg = this.difficulty === 'hard' ? 8 : 3; break;
          case RoachType.ARMORED: dmg = this.difficulty === 'hard' ? 12 : 4; break;
          case RoachType.SPLITTING: dmg = this.difficulty === 'hard' ? 10 : 4; break;
          case RoachType.SUICIDE:
            this.suicideExplode(r, i);
            continue;
          case RoachType.FLYING_SUICIDE:
            this.suicideExplode(r, i); // Flying suicide explodes on defense breach
            continue;

          // Timed suicide roach: if bomb placed, deal large roach damage; else push back
          case RoachType.TIMED_SUICIDE:
            if (r.hasPlacedBomb) { dmg = this.difficulty === 'hard' ? 15 : 5; }
            else { r.y = dl - 64; continue; }
            break;
          case RoachType.QUEEN: dmg = this.difficulty === 'hard' ? 35 : 12; break;
        }

        // Apply damage reduction from shield/talents
        dmg = Math.floor(dmg * (1 - this.player.damageReduction));

        // Boss in boss battle: charge damage + effects are now handled in updateRoaches
        // This is just a safety net to prevent BOSS from passing through defense line
        if (this.bossBattle.active && r.isBoss && r.type === RoachType.QUEEN) {
          r.y = Math.min(r.y, dl - 15); // clamp to defense line
          continue; // don't remove BOSS
        }

        if (this.player.shieldTimer > 0) {
          this.addFloatingText(r.x, this.defenseLineY() - 20, '护盾抵消!', '#22d3ee');
        } else {
          this.defenseHp -= dmg;
          this.economy.breaches++;
          // Track hospital breaches for star rating
          if (this.currentScene === SceneType.HOSPITAL) {
            this.hospitalBreaches++;
          }
          this.audio.playBreach();
          Vibration.vibrateBreach();
        }
        // No gold penalty for defense breach (user request)
        this.screenShake = 10;

        this.roaches.splice(i, 1);
        if (r.isBoss) this.activeBosses--;
        this.addFloatingText(r.x, dl - 20, '防线突破!', '#ef4444');

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
          if (this.gameMode === GameMode.ENDLESS) {
            this.economy.highestEndlessWave = Math.max(this.economy.highestEndlessWave, this.wave);
            this.progress.highestEndlessWave = Math.max(this.progress.highestEndlessWave, this.wave);
            // Save endless best time
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
          return;
        }
      }
    }
  }

  // ========== WAVE SYSTEM ==========
  updateWave() {
    // Skip wave logic during post-battle item sequences
    if (this.state === GameState.ITEM_DROP || this.state === GameState.ITEM_REVEAL) return;

    if (this.waveJustCleared) {
      this.waveClearTimer -= this.deltaTime;
      if (this.waveClearTimer <= 0) this.waveJustCleared = false;
      return;
    }

    // ===== HOSPITAL EXCLUSIVE: Auto-skip wave if only nurse roaches remain =====
    // Nurses are support units, not threats — skip wave when no combat roaches left
    if (this.currentScene === SceneType.HOSPITAL && !this.waveSpawning && this.spawnQueue.length === 0 && this.wave > 0 && this.roaches.length > 0) {
      const allNurses = this.roaches.every(r => r.state === RoachState.ALIVE && r.type === RoachType.NURSE);
      if (allNurses) {
        // Kill all remaining nurses and force wave clear
        for (const nr of this.roaches) {
          if (nr.type === RoachType.NURSE && nr.state === RoachState.ALIVE) {
            nr.hp = 0;
            this.killRoach(nr, this.roaches.indexOf(nr));
          }
        }
        this.addFloatingText(this.width / 2, this.height * 0.35, '支援单位已清除，推进下一波!', '#fbbf24');
      }
    }

    // Wave completion: auto-start next wave, only show shop after ALL waves cleared
    // NOTE: Skip if tutorial is pausing spawn (prevents startWave() from being called
    // repeatedly, which would increment wave and bypass the tutorial check)
    if (!this.tutorialPauseSpawn && !this.waveSpawning && this.roaches.length === 0 && this.spawnQueue.length === 0 && this.wave > 0) {
      this.waveTimer -= this.deltaTime;
      if (this.waveTimer <= 0) {
        this.waveTimer = 2; // reset for next cycle
        // Check if all waves cleared (story mode victory)
        if (this.gameMode === GameMode.STORY) {
          const configs = SCENE_WAVE_CONFIGS[this.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
          if (this.wave >= configs.length) {
            // Unlock next scene BEFORE gameVictory (critical fix)
            this.unlockNextScene();
            this.waveJustCleared = true;
            this.waveClearTimer = 6;
            this.waveSpawning = true;
            this.spawnQueue = [];
            this.waveTimer = 999;
            this.gameVictory();
            return;
          }
        }
        // ===== HOSPITAL EXCLUSIVE: Clear remaining egg pods between waves =====
        // [DISABLED] Egg pod system removed
        // if (this.currentScene === SceneType.HOSPITAL && this.hospitalEggPods.length > 0) {
        //   ... egg pod cleanup code removed ...
        // }
        // Auto-start next wave (continuous waves, no shop between waves)
        this.startWave();
      }
    }

    if (this.waveSpawning) {
      this.spawnTimer -= this.deltaTime;
      if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
        const spawn = this.spawnQueue.shift()!;
        this.spawnRoach(spawn.type, spawn.clusterId);
        this.spawnTimer = 0.3 + Math.random() * 0.5;
      }
      if (this.spawnQueue.length === 0) this.waveSpawning = false;
    }

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
        // Red pulsing particles around the bomb
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
        // Red screen flash overlay when <= 1 second
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
        this.screenShake = 22; // Stronger screen shake
        this.audio.playTimedBombExplode();
        Vibration.vibrateDamage();
        // Damage nearby roaches within 120px
        for (const other of this.roaches) {
          if (other.state === 'dead') continue;
          const dx = other.x - bomb.x;
          const dy = other.y - bomb.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            let dmg = 30; // 30 damage to nearby roaches
            // Apply armor reduction
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
        // Damage defense line if within range
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
        // Visual effects (reduced to 30 particles total)
        this.spawnExplosionParticles(bomb.x, bomb.y, 20);
        this.spawnSmokeParticles(bomb.x, bomb.y, 10);
        this.addFloatingText(bomb.x, bomb.y - 40, '尸体炸弹爆炸!', '#ff4400');
        // Remove bomb
        this.deadTimedBombs.splice(i, 1);
      }
    }

    // ===== HOSPITAL EXCLUSIVE: Update egg pods during wave =====
    // [DISABLED] Egg pod system removed
    if (this.currentScene === SceneType.HOSPITAL) {
      // this.updateHospitalEggPods();
      // Update placed bombs (timed suicide)
      for (let bi = this.placedBombs.length - 1; bi >= 0; bi--) {
        const bomb = this.placedBombs[bi];
        bomb.timer -= this.deltaTime;
        const secs = Math.ceil(bomb.timer);
        if (bomb.timer > 0 && Math.abs(bomb.timer - secs) < 0.05 && secs <= 3) {
          this.addFloatingText(bomb.x, bomb.y - 20, `${secs}`, secs <= 1 ? '#ef4444' : '#fbbf24');
        }
        if (bomb.timer <= 0) {
          // ===== ENHANCED EXPLOSION: massive fire burst + shockwave + debris =====
          // Layer 1: Core explosion particles
          this.spawnExplosionParticles(bomb.x, bomb.y, 80);
          // Layer 2: Fire ring
          this.spawnFireRingParticles(bomb.x, bomb.y, 30);
          // Layer 3: Smoke
          this.spawnSmokeParticles(bomb.x, bomb.y, 40);
          // Layer 4: Large fire flash overlay (multiple layers for intensity)
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
          // Layer 5: Debris fragments flying outward
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
          // Strong screen shake
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
    this.wave++;

    // ===== KITCHEN FIRST-WAVE TUTORIAL PAUSE =====
    // If this is kitchen wave 1 and gameplay tutorial not seen, pause spawn
    if (this.currentScene === SceneType.KITCHEN && this.wave === 1 && this.gameMode === GameMode.STORY) {
      const tutorialSeen = (() => {
        try { return !!localStorage.getItem('gameplay_tutorial_seen'); } catch { return false; }
      })();
      if (!tutorialSeen) {
        this.tutorialPauseSpawn = true;
        this.onTutorialPauseChange?.(true);
        return; // Exit without spawning anything
      }
    }

    // ===== PRE-WAVE 3-2-1 COUNTDOWN =====
    // Trigger countdown before first wave spawn (after tutorial, if applicable)
    // Countdown returns true if it started; spawn is deferred until countdown finishes
    if (this.startCountdown()) return;

    // No countdown needed, spawn immediately
    this.doWaveSpawn();
  }

  // Start 3-2-1 countdown before wave spawn. Returns true if countdown was started.
  startCountdown(): boolean {
    // Only trigger countdown for first wave of each level (not between waves)
    // Boss mode has its own timing
    if (this.wave !== 1 || this.gameMode === GameMode.BOSS) return false;

    this.countdownPhase = 3;
    this.countdownTimer = 3.0; // 3 seconds total: 3, 2, 1
    this.countdownWavePending = true;
    this.state = GameState.COUNTDOWN;
    this.onStateChange?.(this.state);
    return true;
  }

  // Called when countdown reaches 0 - actually spawn the wave
  doWaveSpawn() {
    this.state = GameState.PLAYING;
    this.onStateChange?.(this.state);
    this.countdownWavePending = false;

    // ===== HOSPITAL EXCLUSIVE: Clear previous wave's egg pods =====
    // [DISABLED] Egg pod system removed
    // if (this.currentScene === SceneType.HOSPITAL && this.hospitalEggPods.length > 0) {
    //   ... egg pod cleanup code removed ...
    // }

    // Check if all waves are cleared (based on scene-specific wave config count)
    if (this.gameMode === GameMode.STORY) {
      const configs = SCENE_WAVE_CONFIGS[this.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
      const totalWaves = configs.length;
      if (this.wave > totalWaves) {
        // All waves cleared! Victory!
        this.economy.highestWave = totalWaves;
        this.progress.highestWave = Math.max(this.progress.highestWave, totalWaves);
        // Unlock next scene
        this.unlockNextScene();
        this.saveProgress();
        // Block updateWave() from re-triggering while victory flow activates
        this.waveJustCleared = true;
        this.waveClearTimer = 6;
        this.waveSpawning = true;
        this.spawnQueue = [];
        this.waveTimer = 999;
        // Trigger victory with item reveal
        this.gameVictory();
        return;
      }
    }

    const config = this.getWaveConfig(this.wave);
    let clusterId = 1;

    // Get available roach types for current scene
    const allTypes = [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN];
    const availableTypes = this.gameMode === GameMode.STORY
      ? (this.difficulty === 'hard' ? allTypes : (SCENE_ROACH_TYPES[this.currentScene] || [RoachType.SMALL]))
      : allTypes;

    // Helper: add roaches to a queue
    const addToQueue = (queue: { type: RoachType; clusterId?: number }[], type: RoachType, count: number) => {
      if (!availableTypes.includes(type)) return;
      for (let i = 0; i < count; i++) {
        queue.push({ type, clusterId: Math.random() < config.clusterChance ? clusterId : undefined });
        if (Math.random() < config.clusterChance) clusterId++;
      }
    };
    // Helper: shuffle a queue in place
    const shuffle = (queue: { type: RoachType; clusterId?: number }[]) => {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    };

    // Three-phase spawn: preview enemies are embedded in large waves,
    // never appearing alone. They emerge mid-wave alongside a massive cluster.
    const phase1: typeof this.spawnQueue = []; // light opener
    const phase2: typeof this.spawnQueue = []; // climax: big cluster + preview mixed in
    const phase3: typeof this.spawnQueue = []; // finale: remaining regulars

    // Distribute regular enemies across three phases
    // Phase 1: ~30% of regulars (light warm-up)
    const p1Small = Math.floor(config.smallCount * 0.3);
    const p1Large = Math.floor(config.largeCount * 0.3);
    addToQueue(phase1, RoachType.SMALL, p1Small);
    addToQueue(phase1, RoachType.LARGE, p1Large);
    shuffle(phase1);

    // Phase 2: ~50% of regulars + ALL preview/special enemies (the climax!)
    const p2Small = Math.floor(config.smallCount * 0.5);
    const p2Large = Math.floor(config.largeCount * 0.5);
    addToQueue(phase2, RoachType.SMALL, p2Small);
    addToQueue(phase2, RoachType.LARGE, p2Large);
    // Mix preview enemies directly into the big cluster
    addToQueue(phase2, RoachType.FLYING, config.flyingCount);
    addToQueue(phase2, RoachType.ARMORED, config.armoredCount);
    addToQueue(phase2, RoachType.SPLITTING, config.splittingCount);
    addToQueue(phase2, RoachType.SUICIDE, config.suicideCount);
    addToQueue(phase2, RoachType.FLYING_SUICIDE, config.flyingSuicideCount);
    addToQueue(phase2, RoachType.QUEEN, config.queenCount);
    shuffle(phase2);

    // Phase 3: remaining ~20% of regulars (finale)
    const p3Small = config.smallCount - p1Small - p2Small;
    const p3Large = config.largeCount - p1Large - p2Large;
    addToQueue(phase3, RoachType.SMALL, Math.max(0, p3Small));
    addToQueue(phase3, RoachType.LARGE, Math.max(0, p3Large));
    shuffle(phase3);

    // Hospital exclusive: add mutant to phase2, nurse to phase1 (mid-wave spawn)
    // Timed suicide roaches are handled separately with staggered spawn (8s apart)
    if (this.currentScene === SceneType.HOSPITAL) {
      const { nurseCount = 0, mutantCount = 0, timedSuicideCount = 0 } = config;
      // Nurse spawns mixed into phase1 (warm-up), appearing early-mid wave
      addToQueue(phase1, RoachType.NURSE, nurseCount);
      shuffle(phase1); // Shuffle so nurse appears randomly within phase1
      addToQueue(phase2, RoachType.MUTANT, mutantCount);
      // Timed suicide: staggered spawn - initialize timer, don't add to queue
      this.timedSuicideSpawnRemaining = timedSuicideCount;
      this.timedSuicideSpawnTimer = timedSuicideCount > 0 ? 5.0 : 0; // first one after 5s
    }

    // Combine: warm-up → climax with preview mixed in → finale
    this.spawnQueue = [...phase1, ...phase2, ...phase3];

    this.waveSpawning = true;
    this.spawnTimer = 0;
    this.waveJustCleared = true;
    this.waveClearTimer = 1.5;

    // ===== HOSPITAL EXCLUSIVE: Spawn egg pools for this wave =====
    if (this.currentScene === SceneType.HOSPITAL) {
      this.spawnHospitalEggPods(config);
    }

    const waveNames = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    const waveNum = this.wave <= 10 ? waveNames[this.wave] : this.wave;
    this.addFloatingText(this.width / 2, 120, `第 ${waveNum} 波来袭！`, '#fbbf24');
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
    // Story mode: use scene-specific wave configs
    if (this.gameMode === GameMode.STORY) {
      const configs = SCENE_WAVE_CONFIGS[this.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
      let config: WaveConfig;
      if (wave <= configs.length) {
        config = configs[wave - 1];
      } else {
        const base = configs[configs.length - 1];
        const extra = wave - configs.length;
        config = {
          wave,
          smallCount: Math.floor(base.smallCount + extra * 3),
          largeCount: Math.floor(base.largeCount + extra * 2),
          flyingCount: Math.floor(base.flyingCount + extra),
          armoredCount: Math.floor(base.armoredCount + extra),
          splittingCount: Math.floor(base.splittingCount + extra),
          suicideCount: Math.floor(base.suicideCount + extra),
          flyingSuicideCount: Math.floor(base.flyingSuicideCount + extra),
          queenCount: Math.floor(extra / 5),
          speed: base.speed + extra * 0.05,
          interval: Math.max(1, base.interval - extra * 0.1),
          clusterChance: Math.min(1, base.clusterChance + extra * 0.02),
        };
      }
      // Hard mode: ensure ALL roach types appear in every wave
      if (this.difficulty === 'hard') {
        const wn = Math.min(wave, 10);
        config = {
          ...config,
          flyingCount: Math.max(config.flyingCount, Math.floor(2 + wn * 0.8)),
          armoredCount: Math.max(config.armoredCount, Math.floor(1 + wn * 0.5)),
          splittingCount: Math.max(config.splittingCount, Math.floor(1 + wn * 0.5)),
          suicideCount: Math.max(config.suicideCount, Math.floor(1 + wn * 0.4)),
          flyingSuicideCount: Math.max(config.flyingSuicideCount, Math.floor(1 + wn * 0.4)),
        };
      }
      return config;
    }

    // Endless mode: use kitchen config as base, scale infinitely
    if (this.gameMode === GameMode.ENDLESS) {
      const configs = SCENE_WAVE_CONFIGS[SceneType.ROOFTOP];
      const base = configs[configs.length - 1];
      const extra = wave - configs.length;
      if (extra <= 0) return configs[wave - 1];
      return {
        wave,
        smallCount: Math.floor(base.smallCount * (1 + extra * 0.15)),
        largeCount: Math.floor(base.largeCount * (1 + extra * 0.12)),
        flyingCount: Math.floor(base.flyingCount * (1 + extra * 0.1)),
        armoredCount: Math.floor(base.armoredCount * (1 + extra * 0.08)),
        splittingCount: Math.floor(base.splittingCount * (1 + extra * 0.08)),
        suicideCount: Math.floor(base.suicideCount * (1 + extra * 0.1)),
        flyingSuicideCount: Math.floor(base.flyingSuicideCount * (1 + extra * 0.12)),
        queenCount: Math.floor(extra / 5) + 1,
        speed: base.speed + extra * 0.05,
        interval: Math.max(1, base.interval - extra * 0.1),
        clusterChance: Math.min(1, base.clusterChance + extra * 0.02),
      };
    }

    // Boss mode fallback
    const configs = SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
    if (wave <= 0) return configs[0]; // wave 0: return first wave config
    if (wave <= configs.length) return configs[wave - 1];
    const base = configs[configs.length - 1];
    const extra = wave - configs.length;
    return {
      wave,
      smallCount: Math.floor(base.smallCount + extra * 3),
      largeCount: Math.floor(base.largeCount + extra * 2),
      flyingCount: Math.floor(base.flyingCount + extra * 2),
      armoredCount: Math.floor(base.armoredCount + extra),
      splittingCount: Math.floor(base.splittingCount + extra),
      suicideCount: Math.floor(base.suicideCount + extra),
      flyingSuicideCount: Math.floor(base.flyingSuicideCount + extra),
      queenCount: Math.floor(extra / 3),
      speed: base.speed + extra * 0.05,
      interval: Math.max(2, base.interval - extra * 0.05),
      clusterChance: 1,
    };
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

  // ========== PARTICLE SYSTEMS ==========
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
  updateParticles() {
    // Dynamic hard cap based on device performance
    const limit = this._particleLimit;
    if (this.particles.length > limit) {
      this.particles.length = limit;
    }

    let writeIndex = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= this.deltaTime;
      p.x += p.vx * this.deltaTime;
      p.y += p.vy * this.deltaTime;

      if (p.type === ParticleType.FIRE || p.type === ParticleType.EMBER || p.type === ParticleType.SPARK) {
        p.vy -= 25 * this.deltaTime;
        p.size *= 0.97;
      } else if (p.type === ParticleType.SMOKE) {
        p.vx *= 0.92;
        p.size *= 1.015;
      } else if (p.type === ParticleType.BLOOD) {
        p.vy += 100 * this.deltaTime;
        p.vx *= 0.95;
        const dl = this.defenseLineY();
        if (p.y >= dl - 5) { p.y = dl - 5; p.vx = 0; p.vy = 0; }
      } else if (p.type === ParticleType.ICE) {
        p.vy += 20 * this.deltaTime;
        p.size *= 0.98;
      } else if (p.type === ParticleType.POISON_CLOUD) {
        p.vx += (Math.random() - 0.5) * 10;
        p.vy -= 5 * this.deltaTime;
        p.size *= 1.01;
      } else if (p.type === ParticleType.EXPLOSION) {
        p.vy += 40 * this.deltaTime;
        p.size *= 0.94;
      } else if (p.type === ParticleType.ASH) {
        p.vy += 120 * this.deltaTime;
        p.vx *= 0.97;
        p.size *= 0.985;
        const dl = this.defenseLineY();
        if (p.y >= dl - 2) {
          p.y = dl - 2;
          p.vx *= 0.8;
          p.vy = 0;
        }
      } else if (p.type === ParticleType.LIGHTNING) {
        p.life -= this.deltaTime * 2;
      }

      if (p.life > 0) {
        // Keep alive particle by moving it to write position
        if (writeIndex !== i) {
          this.particles[writeIndex] = p;
        }
        writeIndex++;
      }
    }
    // Truncate dead particles
    this.particles.length = writeIndex;
  }

  updateFloatingTexts() {
    let writeIndex = 0;
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const t = this.floatingTexts[i];
      t.life -= this.deltaTime;
      t.y += t.vy * this.deltaTime;
      if (t.life > 0) {
        if (writeIndex !== i) {
          this.floatingTexts[writeIndex] = t;
        }
        writeIndex++;
      }
    }
    this.floatingTexts.length = writeIndex;
  }

  updateFireZones() {
    // Cap - truncate from end
    if (this.fireZones.length > 30) {
      this.fireZones.length = 30;
    }
    let writeIndex = 0;
    for (let i = 0; i < this.fireZones.length; i++) {
      const f = this.fireZones[i];
      f.life -= this.deltaTime;
      if (f.life > 0) {
        if (writeIndex !== i) {
          this.fireZones[writeIndex] = f;
        }
        writeIndex++;

        // ===== FIRE ZONE DAMAGE WITH CACHED ARMOR MEAT SHIELD =====
        // Armor protection is cached and updated every 0.3s (see updateArmorShieldCache)
        const inZone: Array<{ roach: Roach; protected: boolean }> = [];
        for (const r of this.roaches) {
          if (r.state !== RoachState.ALIVE || r.isBoss) continue;
          const dx = r.x - f.x;
          const dy = r.y - f.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const rSize = r.size ?? ENEMY_DEFS[r.type].size;
          if (dist < f.radius + rSize * 0.5) {
            const isProtected = r.armorHp <= 0 && this.armorShieldCache.has(r.id);
            inZone.push({ roach: r, protected: isProtected });
            r.inFire = true;
          }
        }

        // Apply damage (skip timed suicide roach during bomb placement)
        const baseDamage = f.damagePerSecond * this.deltaTime;
        for (const entry of inZone) {
          const r = entry.roach;
          // Skip timed suicide roach during bomb placement (invincible)
          if (r.type === RoachType.TIMED_SUICIDE && r.placeTimer && r.placeTimer > 0) continue;
          if (entry.protected) {
            r.hp -= baseDamage * 0.2;
            r.damageFlash = 0;
          } else {
            r.hp -= baseDamage;
            r.damageFlash = (r.armorHp > 0) ? 0 : 0.1;
          }
        }
      }
    }
    this.fireZones.length = writeIndex;
  }

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

  updateSwatter() {
    if (this.swatterAnimTimer > 0) {
      this.swatterAnimTimer -= this.deltaTime;
      if (this.swatterAnimTimer <= 0) this.swatterActive = false;
    }
    if (!this.swatterReady) {
      const cdReduction = this.talentMultipliers.swatterCdReduction || 0;
      this.swatterCooldown -= this.deltaTime * (1 + cdReduction);
      if (this.swatterCooldown <= 0) {
        this.swatterReady = true;
        this.swatterCooldown = 0;
        this.addFloatingText(this.player.x, this.player.y - 50, '⚡ 电蚊拍就绪!', '#4ade80');
      }
    }
  }

  useSwatter(): boolean {
    // Check picked-up item cooldown (shares globalConsumableCooldown with shop consumables)
    if (this.globalConsumableCooldown > 0) {
      this.addFloatingText(this.player.x, this.player.y - 40, `道具冷却中... (${this.globalConsumableCooldown.toFixed(1)}s)`, '#94a3b8', 800);
      return false;
    }
    if ((this.itemCooldowns['swatter'] || 0) > 0) {
      this.addFloatingText(this.player.x, this.player.y - 40, `电蚊拍冷却中... (${this.itemCooldowns['swatter'].toFixed(1)}s)`, '#94a3b8', 800);
      return false;
    }
    // Check if player has swatter in inventory
    const swatterIdx = this.inventory.findIndex((item: InventoryItem) => item.type === 'swatter');
    if (swatterIdx < 0 || this.inventory[swatterIdx].count <= 0) {
      this.addFloatingText(this.player.x, this.player.y - 50, '没有电蚊拍!', '#9ca3af');
      return false;
    }
    // Consume one charge
    this.inventory[swatterIdx].count--;
    if (this.inventory[swatterIdx].count <= 0) {
      this.inventory.splice(swatterIdx, 1);
    }
    this.onInventoryUpdate?.(this.inventory);

    // Set cooldown (shares globalConsumableCooldown with shop consumables)
    const def = WEAPON_DROP_DEFS['swatter'];
    if (def && def.cooldown > 0) {
      this.itemCooldowns['swatter'] = def.cooldown;
    }
    this.globalConsumableCooldown = 1;

    this.swatterActive = true;
    this.swatterAnimTimer = 0.6;
    this.swatterSwingX = this.player.x;
    this.audio.playSwatter();

    let hitCount = 0;
    let armorBreakCount = 0;

    // Full-screen swatter: affects ALL alive roaches EXCEPT BOSS
    for (const r of this.roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;

      hitCount++;

      // Break armor
      if (r.armorHp > 0) {
        r.armorHp = 0;
        armorBreakCount++;
        this.spawnSparkParticles(r.x, r.y, 5);
        this.addFloatingText(r.x, r.y - 30, '破甲!', '#fbbf24');
      }

      // Normal roach: slow movement (paralyze) for 5 seconds
      r.speed = r.baseSpeed * 0.2;
      r.isStunned = true;
      r.stunTimer = 5;
    }

    this.screenShake = 12;
    // Lightning particles across full screen width
    this.spawnLightningParticles(this.width / 2, 0);

    // Floating text feedback
    if (hitCount > 0) {
      const msg = armorBreakCount > 0
        ? `⚡电蚊拍全屏!命中${hitCount}只!破甲${armorBreakCount}!`
        : `⚡电蚊拍全屏!命中${hitCount}只!麻痹!`;
      this.addFloatingText(this.width / 2, this.height / 3, msg, '#4ade80');
    } else {
      this.addFloatingText(this.width / 2, this.height / 3, '⚡电蚊拍!未命中', '#9ca3af');
    }
    return true;
  }

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


  // ========== WEATHER SYSTEM ==========
  updateWeather() {
    const scene = this.getSceneConfig();
    const weather = scene.weather;

    if (weather === WeatherType.RAIN) {
      // Rain particles
      if (Math.random() < 0.4) {
        this.weatherParticles.push({
          x: Math.random() * this.width,
          y: -10,
          vx: -20 + Math.random() * 10,
          vy: 200 + Math.random() * 100,
          life: 2, maxLife: 2,
          size: 1 + Math.random(),
          color: 'rgba(150, 180, 220, 0.4)',
          type: ParticleType.RAIN,
        });
      }
    } else if (weather === WeatherType.FOG) {
      // Slow-moving fog
      if (Math.random() < 0.05) {
        this.weatherParticles.push({
          x: Math.random() < 0.5 ? -20 : this.width + 20,
          y: Math.random() * this.height,
          vx: (Math.random() < 0.5 ? 1 : -1) * (10 + Math.random() * 10),
          vy: -5 + Math.random() * 10,
          life: 8 + Math.random() * 4, maxLife: 8 + Math.random() * 4,
          size: 30 + Math.random() * 50,
          color: `rgba(180, 180, 160, ${0.05 + Math.random() * 0.05})`,
          type: ParticleType.SMOKE,
        });
      }
    } else if (weather === WeatherType.NIGHT) {
      // Lightning
      this.lightningTimer -= this.deltaTime;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 5 + Math.random() * 10;
        if (Math.random() < 0.3) {
          this.lightningFlash = 0.3;
        }
      }
      if (this.lightningFlash > 0) this.lightningFlash -= this.deltaTime;
    }

    // Update weather particles
    for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
      const p = this.weatherParticles[i];
      p.life -= this.deltaTime;
      p.x += p.vx * this.deltaTime;
      p.y += p.vy * this.deltaTime;
      if (p.type === ParticleType.SMOKE && weather === WeatherType.FOG) {
        p.size *= 1.005;
      }
      if (p.life <= 0) this.weatherParticles.splice(i, 1);
    }
  }

  // ========== TALENT SYSTEM ==========
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

  // ========== INPUT ==========
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
    // ===== 6-POINT BOUNDARY: Roach ground boundary (green zone) =====
    const [farL, farLY, farR, farRY, midL, midLY, midR, midRY, nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[this.currentScene];

    ctx.save();

    // 1. Green semi-transparent fill (6-point polygon with mid折线)
    ctx.fillStyle = 'rgba(0, 255, 100, 0.06)';
    ctx.beginPath();
    ctx.moveTo(farL, farLY);
    ctx.lineTo(farR, farRY);
    ctx.lineTo(midR, midRY);
    ctx.lineTo(nearR, nearY);
    ctx.lineTo(nearL, nearY);
    ctx.lineTo(midL, midLY);
    ctx.closePath();
    ctx.fill();

    // 2. Left side: 2-segment折线 (far→mid→near)
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(farL, farLY);
    ctx.lineTo(midL, midLY);
    ctx.lineTo(nearL, nearY);
    ctx.stroke();

    // 3. Right side: 2-segment折线 (far→mid→near)
    ctx.beginPath();
    ctx.moveTo(farR, farRY);
    ctx.lineTo(midR, midRY);
    ctx.lineTo(nearR, nearY);
    ctx.stroke();

    // 4. Far boundary line (top)
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(farL, farLY);
    ctx.lineTo(farR, farRY);
    ctx.stroke();

    // 5. Near boundary line (bottom)
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nearL, nearY);
    ctx.lineTo(nearR, nearY);
    ctx.stroke();

    // 6. Defense line reference (dashed green)
    const defenseY = this.defenseLineY();
    const [defL, defR] = this.getGroundBoundsAtY(defenseY);
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(defL, defenseY);
    ctx.lineTo(defR, defenseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 7. Corner markers (green dots + coordinate labels) - all 6 points
    const corners = [
      { x: farL,  y: farLY, label: `(${Math.round(farL)},${Math.round(farLY)})`, name: 'farL', alignX: 'left', offsetX: 10 },
      { x: farR,  y: farRY, label: `(${Math.round(farR)},${Math.round(farRY)})`, name: 'farR', alignX: 'right', offsetX: -10 },
      { x: midL,  y: midLY, label: `(${Math.round(midL)},${Math.round(midLY)})`, name: 'midL', alignX: 'left', offsetX: 10 },
      { x: midR,  y: midRY, label: `(${Math.round(midR)},${Math.round(midRY)})`, name: 'midR', alignX: 'right', offsetX: -10 },
      { x: nearL, y: nearY, label: `(${Math.round(nearL)},${Math.round(nearY)})`, name: 'nearL', alignX: 'left', offsetX: 10 },
      { x: nearR, y: nearY, label: `(${Math.round(nearR)},${Math.round(nearY)})`, name: 'nearR', alignX: 'right', offsetX: -10 },
    ];
    for (const c of corners) {
      ctx.font = 'bold 12px monospace';
      const textWidth = ctx.measureText(c.label).width;
      const pillW = textWidth + 8;
      const pillH = 16;
      const pillX = c.alignX === 'left' ? c.x + c.offsetX - 4 : c.x + c.offsetX - pillW + 4;
      const pillY = c.y + 3 - pillH / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 255, 80, 1)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 0, 1)';
      ctx.textAlign = c.alignX as CanvasTextAlign;
      ctx.fillText(c.label, c.x + c.offsetX, c.y + 4);
    }

    // 8. Label
    ctx.fillStyle = 'rgba(0, 255, 80, 0.7)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const lblX = (farL + farR) / 2;
    const lblY = Math.min(farLY, farRY);
    ctx.fillText('蟑螂地面边界(6点折线)', lblX, lblY - 14);

    ctx.restore();
  }

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
    this.renderThrowableAim(ctx);
    this.renderThrowables(ctx);
    this.renderItemPlacement(ctx);
    this.renderInsecticideSpray(ctx);
    this.renderFan(ctx);
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
    const drop = this.itemDropOnField;
    if (!drop) return;
    const bobY = Math.sin(drop.bobPhase) * 12;
    const x = drop.x;
    const y = drop.y + bobY;
    const size = 48;

    // Glow effect behind the item
    const glowPulse = (Math.sin(drop.bobPhase * 2) + 1) * 0.5;
    const gradient = ctx.createRadialGradient(x, y, size * 0.3, x, y, size * 2);
    gradient.addColorStop(0, `rgba(251, 191, 36, ${0.4 + glowPulse * 0.3})`);
    gradient.addColorStop(0.5, `rgba(245, 158, 11, ${0.2 + glowPulse * 0.2})`);
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring animation
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.6 + glowPulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, size * (0.8 + glowPulse * 0.2), 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring (counter-rotating)
    ctx.strokeStyle = `rgba(252, 211, 77, ${0.4 + glowPulse * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, size * (0.6 - glowPulse * 0.1), drop.bobPhase, drop.bobPhase + Math.PI * 1.5);
    ctx.stroke();

    // Draw item icon using preloaded drop images
    const itemImg = this._dropImages?.[drop.type];
    if (itemImg) {
      ctx.drawImage(itemImg, x - size / 2, y - size / 2, size, size);
    } else {
      // Fallback: draw a golden box with ?
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x, y);
    }


  }

  // ========== BOSS UI RENDERING ==========
  renderBossUI(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const bb = this.bossBattle;
    if (!bb.active && !bb.bossKilled) return;

    const barW = Math.min(400, w * 0.7);
    const barH = 20;
    const barX = (w - barW) / 2;
    const barY = 82;

    // Boss name + phase
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(`螂老大 - ${bb.phaseName}`, w / 2, barY - 8);
    ctx.shadowBlur = 0;

    // ===== 4-LAYER HP BAR (egg wave progress) =====
    const layerColors = ['#22c55e', '#eab308', '#f97316', '#ef4444'];
    const layerWidth = barW / 4;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Draw 4 layers
    for (let i = 0; i < 4; i++) {
      const isActive = i < bb.currentWave;
      const lx = barX + i * layerWidth;
      ctx.fillStyle = isActive ? layerColors[i] : 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      const roundL = i === 0 ? 4 : 0;
      const roundR = i === 3 ? 4 : 0;
      ctx.roundRect(lx, barY, layerWidth - 1, barH, [roundL, roundR, roundR, roundL]);
      ctx.fill();

      // Layer number
      ctx.fillStyle = isActive ? '#fff' : 'rgba(150,150,150,0.4)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, lx + layerWidth / 2, barY + barH / 2 + 3);

      // Divider
      if (i < 3) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx + layerWidth, barY + 3);
        ctx.lineTo(lx + layerWidth, barY + barH - 3);
        ctx.stroke();
      }
    }

    // Wave progress text - display 1-4 for waves, handle casting state
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

    // [REMOVED] Egg pod count display removed

    // Time remaining
    const timeText = `剩余时间: ${Math.ceil(bb.timeRemaining)}秒`;
    ctx.fillStyle = bb.timeRemaining < 30 ? '#ef4444' : '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(timeText, w - 20, barY + barH + 18);

    // ===== PHASE CHANGE BANNER =====
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

  // ========== INSECTICIDE SPRAY RENDERING =========
  renderInsecticideSpray(ctx: CanvasRenderingContext2D) {
    if (!this.insecticideSpray.active) return;
    const spray = this.insecticideSpray;
    const cx = this.width / 2;
    const cy = this.defenseLineY();
    const range = 280;
    const halfSpread = spray.spraySpread / 2;

    // Pulsing alpha based on remaining time
    const progress = spray.timer / spray.duration;
    const pulseAlpha = 0.12 + 0.08 * Math.sin(this.time * 12) * progress;

    // Draw fan-shaped spray zone with gradient
    ctx.save();
    ctx.globalAlpha = pulseAlpha;

    // Create radial gradient for the spray cone
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, range);
    grad.addColorStop(0, 'rgba(80, 255, 100, 0.5)');
    grad.addColorStop(0.4, 'rgba(60, 220, 80, 0.3)');
    grad.addColorStop(0.7, 'rgba(40, 180, 60, 0.15)');
    grad.addColorStop(1, 'rgba(20, 120, 40, 0)');

    // Draw spray cone
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, range, spray.sprayAngle - halfSpread, spray.sprayAngle + halfSpread);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw spray boundary lines
    ctx.globalAlpha = 0.2 * progress;
    ctx.strokeStyle = 'rgba(100, 255, 120, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spray.sprayAngle - halfSpread) * range, cy + Math.sin(spray.sprayAngle - halfSpread) * range);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spray.sprayAngle + halfSpread) * range, cy + Math.sin(spray.sprayAngle + halfSpread) * range);
    ctx.stroke();

    // Draw central spray line
    ctx.globalAlpha = 0.3 * progress;
    ctx.strokeStyle = 'rgba(150, 255, 160, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spray.sprayAngle) * range, cy + Math.sin(spray.sprayAngle) * range);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw origin nozzle glow
    ctx.globalAlpha = 0.4 * progress;
    const nozzleGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    nozzleGrad.addColorStop(0, 'rgba(150, 255, 150, 0.8)');
    nozzleGrad.addColorStop(1, 'rgba(50, 200, 50, 0)');
    ctx.fillStyle = nozzleGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();

    // Timer text
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#86efac';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`杀虫剂 ${spray.timer.toFixed(1)}s`, cx, cy - 40);

    ctx.restore();
  }

  // ========== RADAR LASER RENDERING =========
  renderRadarLaser(ctx: CanvasRenderingContext2D) {
    if (!this.radarLaser.active) return;
    const rl = this.radarLaser;

    // Find current target - fallback to nearest alive roach if targetId is stale
    let target = this.roaches.find(r => r.id === rl.targetId && r.state === RoachState.ALIVE);
    if (!target) {
      // Target was killed or never set - search for nearest alive roach
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
      if (target) {
        rl.targetId = target.id;
      }
    }
    if (!target) return;

    const px = this.player.x;
    const py = this.player.y - 20; // slightly above player
    const tx = target.x;
    const ty = target.y;

    // Laser beam glow
    const alpha = Math.min(1, rl.timer / 0.5) * (0.6 + Math.sin(this.time * 20) * 0.2);
    ctx.save();

    // Outer glow
    ctx.strokeStyle = `rgba(34, 211, 238, ${alpha * 0.3})`;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // Middle glow
    ctx.strokeStyle = `rgba(34, 211, 238, ${alpha * 0.6})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // Core beam
    ctx.strokeStyle = `rgba(103, 232, 249, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // Target lock indicator
    const lockPulse = 0.5 + Math.sin(this.time * 8) * 0.5;
    ctx.strokeStyle = `rgba(34, 211, 238, ${lockPulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 20 + lockPulse * 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(34, 211, 238, ${lockPulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 15, 0, Math.PI * 2);
    ctx.fill();

    // Player emitter glow
    ctx.fillStyle = `rgba(34, 211, 238, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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
    // Lightning flash
    if (this.lightningFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.lightningFlash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  renderDefenseLine(ctx: CanvasRenderingContext2D, w: number) {
    const dl = this.defenseLineY();
    const scene = this.getSceneConfig();

    ctx.save();
    ctx.strokeStyle = scene.defenseLineColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -this.time * 30;
    ctx.beginPath();
    ctx.moveTo(0, dl);
    ctx.lineTo(w, dl);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = scene.defenseLineColor.replace('0.7', '0.08');
    ctx.fillRect(0, dl, w, 25);
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('防 线', w / 2, dl - 8);

    // ===== SHIELD: blue energy line 20px above defense line =====
    if (this.player.shieldTimer > 0) {
      const shieldAlpha = 0.4 + Math.sin(this.time * 6) * 0.2; // pulse 0.2~0.6
      const shieldY = dl - 20;
      ctx.save();
      // Outer glow
      ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
      ctx.shadowBlur = 12 + Math.sin(this.time * 4) * 4;
      // Main line
      ctx.strokeStyle = `rgba(6, 182, 212, ${shieldAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, shieldY);
      ctx.lineTo(w, shieldY);
      ctx.stroke();
      // Inner bright core
      ctx.strokeStyle = `rgba(165, 243, 252, ${shieldAlpha * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, shieldY);
      ctx.lineTo(w, shieldY);
      ctx.stroke();
      ctx.restore();
    }
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
    if (this.tripleFlame.active) {
      gunXs.push(p.x - this.tripleFlame.sideOffset);
      gunXs.push(p.x + this.tripleFlame.sideOffset);
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

  renderFireWalls(ctx: CanvasRenderingContext2D) {
    for (const wall of this.fireWalls) {
      const progress = wall.life / wall.maxLife;
      const alpha = Math.min(1, progress * 1.5);
      const wallWidth = wall.x2 - wall.x1;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Main fire wall body - horizontal bar with animated fire
      const segments = Math.max(10, Math.floor(wallWidth / 15));
      for (let i = 0; i < segments; i++) {
        const sx = wall.x1 + (wallWidth / segments) * i;
        const segW = wallWidth / segments;

        // Animated fire flicker per segment
        const flicker = 0.7 + Math.sin(this.time * 12 + i * 2.5) * 0.3;
        const h = wall.height * (2 + flicker);

        // Fire gradient per segment
        const fireGrad = ctx.createLinearGradient(sx, wall.y - h, sx, wall.y + h * 0.3);
        fireGrad.addColorStop(0, `rgba(255, 255, 100, ${alpha * 0.9})`);
        fireGrad.addColorStop(0.3, `rgba(255, 180, 20, ${alpha * 0.85})`);
        fireGrad.addColorStop(0.6, `rgba(255, 80, 10, ${alpha * 0.7})`);
        fireGrad.addColorStop(1, `rgba(200, 30, 5, ${alpha * 0.3})`);

        ctx.fillStyle = fireGrad;
        ctx.fillRect(sx - segW * 0.1, wall.y - h * 0.5, segW * 1.2, h);
      }

      // Core bright line (white-hot center)
      ctx.strokeStyle = `rgba(255, 255, 220, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y);
      ctx.lineTo(wall.x2, wall.y);
      ctx.stroke();

      // Outer glow
      const glowGrad = ctx.createLinearGradient(wall.x1, wall.y - 15, wall.x1, wall.y + 15);
      glowGrad.addColorStop(0, `rgba(255, 100, 20, 0)`);
      glowGrad.addColorStop(0.5, `rgba(255, 80, 10, ${alpha * 0.25})`);
      glowGrad.addColorStop(1, `rgba(255, 100, 20, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(wall.x1, wall.y - 15, wallWidth, 30);

      // Ember sparks floating up
      for (let i = 0; i < 3; i++) {
        const sparkX = wall.x1 + Math.random() * wallWidth;
        const sparkY = wall.y - 5 - Math.random() * 15;
        const sparkSize = 1 + Math.random() * 2;
        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 30, ${alpha * (0.5 + Math.random() * 0.5)})`;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Duration indicator
      ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.7})`;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`火焰墙 ${wall.life.toFixed(1)}s`, (wall.x1 + wall.x2) / 2, wall.y + 20);

      ctx.restore();
    }
  }

  renderStickyBoards() {
    // Legacy sticky board rendering removed - replaced by auto-targeting sticky drops
    // Sticky boards array is kept for backwards compatibility but no longer rendered
  }

  renderStickyDrops(ctx: CanvasRenderingContext2D) {
    for (const drop of this.stickyDrops) {
      // Skip pre-spawn drops (still in delay phase)
      if (drop.life > drop.maxLife) continue;

      ctx.save();

      if (drop.hit && drop.targetId !== null) {
        // Drop is attached to a roach - rendered as wrap overlay in renderRoaches
        // Just draw a small connecting drip effect
        const target = this.roaches.find(r => r.id === drop.targetId);
        if (target && target.state === RoachState.ALIVE) {
          // Draw dripping lines from the wrap
          ctx.strokeStyle = `rgba(250, 220, 50, ${0.4 + Math.sin(this.time * 8 + drop.id) * 0.2})`;
          ctx.lineWidth = 2;
          for (let d = 0; d < 3; d++) {
            const angle = (Math.PI * 2 / 3) * d + this.time * 2 + drop.id;
            const dripLen = 6 + Math.sin(this.time * 6 + d) * 3;
            ctx.beginPath();
            ctx.moveTo(target.x + Math.cos(angle) * 8, target.y + Math.sin(angle) * 8);
            ctx.lineTo(target.x + Math.cos(angle) * (8 + dripLen), target.y + Math.sin(angle) * (8 + dripLen));
            ctx.stroke();
          }
        }
      } else {
        // Flying drop - draw yellow liquid droplet
        const pulse = 0.8 + Math.sin(this.time * 10 + drop.id) * 0.2;

        // Outer glow
        const glowGrad = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, drop.size * 2);
        glowGrad.addColorStop(0, `rgba(250, 220, 50, ${0.3 * pulse})`);
        glowGrad.addColorStop(1, 'rgba(250, 200, 50, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Main droplet body
        ctx.fillStyle = `rgba(250, 220, 50, ${0.85 * pulse})`;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
        ctx.fill();

        // Highlight (shininess)
        ctx.fillStyle = `rgba(255, 250, 200, ${0.6 * pulse})`;
        ctx.beginPath();
        ctx.arc(drop.x - drop.size * 0.25, drop.y - drop.size * 0.25, drop.size * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Trail effect
        const trailLen = 3;
        for (let t = 1; t <= trailLen; t++) {
          const alpha = 0.3 * (1 - t / (trailLen + 1));
          const size = drop.size * (1 - t * 0.2);
          ctx.fillStyle = `rgba(250, 220, 50, ${alpha})`;
          ctx.beginPath();
          ctx.arc(drop.x - drop.vx * this.deltaTime * t * 3, drop.y - drop.vy * this.deltaTime * t * 3, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
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

  renderWeaponDrops(ctx: CanvasRenderingContext2D) {
    // Pre-load item images for drops
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

    for (const drop of this.weaponDrops) {
      const t = drop.bobPhase;
      // Floating animation: circular/elliptical motion
      const bobY = Math.sin(t) * 10;           // vertical float ±10px
      const bobX = Math.cos(t * 0.6) * 6;       // horizontal float ±6px
      const breathe = 1 + Math.sin(t * 2) * 0.08; // scale breathe ±8%
      const tilt = Math.sin(t * 1.5) * 0.15;    // slight tilt rotation
      const alpha = Math.min(1, drop.life / 2);
      const def = WEAPON_DROP_DEFS[drop.type];
      if (!def) continue;

      ctx.save();
      ctx.globalAlpha = alpha;

      const renderX = drop.x + bobX;
      const renderY = drop.y + bobY;

      // Check if we have an image for this drop type
      const dropImg = this._dropImages?.[drop.type];
      if (dropImg) {
        // Draw item image with breathing scale and tilt
        const baseSize = 32;
        const imgSize = baseSize * breathe;
        ctx.translate(renderX, renderY);
        ctx.rotate(tilt);
        ctx.drawImage(dropImg, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
        ctx.rotate(-tilt);
        ctx.translate(-renderX, -renderY);
        // Glow ring (pulses with breathe)
        ctx.strokeStyle = def.color.replace(')', ', 0.6)').replace('rgb', 'rgba');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(renderX, renderY, (baseSize / 2 + 2) * breathe, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Fallback: colored box with float
        const glowGrad = ctx.createRadialGradient(renderX, renderY, 0, renderX, renderY, 25 * breathe);
        glowGrad.addColorStop(0, def.color.replace(')', ', 0.4)').replace('rgb', 'rgba'));
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(renderX, renderY, 25 * breathe, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(renderX, renderY);
        ctx.rotate(tilt);
        ctx.fillStyle = def.color;
        ctx.fillRect(-12 * breathe, -12 * breathe, 24 * breathe, 24 * breathe);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-12 * breathe, -12 * breathe, 24 * breathe, 24 * breathe);
        ctx.restore();
      }

      // Label (also floats)
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(def.name, renderX, renderY - 22 * breathe);
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  // Render flying bait jar (parabolic arc from player to target roach)
  renderBaitThrow(ctx: CanvasRenderingContext2D) {
    if (!this.baitThrowAnim.active) return;
    ctx.save();
    const { x, y } = this.baitThrowAnim;
    // Shadow on ground below
    const shadowY = this.baitThrowAnim.targetY;
    const height = shadowY - y;
    const shadowScale = Math.max(0.3, 1 - height / 200);
    ctx.globalAlpha = 0.2 * shadowScale;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, shadowY, 10 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Bait jar body (no rotation — straight flight toward target)
    ctx.translate(x, y);
    // Jar body (rounded rectangle)
    const jarW = 14, jarH = 18;
    ctx.fillStyle = '#78350f'; // brown glass
    ctx.beginPath();
    ctx.roundRect(-jarW / 2, -jarH / 2, jarW, jarH, 4);
    ctx.fill();
    // Jar highlight
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.roundRect(-jarW / 2 + 2, -jarH / 2 + 2, jarW - 6, jarH - 6, 2);
    ctx.fill();
    // Jar lid
    ctx.fillStyle = '#57534e'; // stone gray lid
    ctx.fillRect(-jarW / 2 - 1, -jarH / 2 - 3, jarW + 2, 5);
    // Yellow label
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-jarW / 2 + 1, -2, jarW - 2, 4);
    // Small sparkle on jar
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 8);
    ctx.beginPath();
    ctx.arc(-3, -3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Motion trail: tiny yellow dots behind
    ctx.restore();
    // Trail: small yellow dots trailing from bait position toward target
    const dx = this.baitThrowAnim.targetX - x;
    const dy = this.baitThrowAnim.targetY - y;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const trailProgress = Math.max(0, 1 - this.baitThrowAnim.timer / 0.8 - t * 0.15);
      if (trailProgress <= 0) continue;
      // Trail points trail behind the bait, toward the target direction
      const trailX = x - dx * t * 0.3;
      const trailY = y - dy * t * 0.3;
      ctx.globalAlpha = 0.4 * (1 - t);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(trailX, trailY, 2 - t * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Render bait jar shatter mark and scent aura on the ground
  renderBaitMark(ctx: CanvasRenderingContext2D) {
    if (!this.baitTarget.active || this.player.baitTimer <= 0) return;
    ctx.save();
    const { x, y } = this.baitTarget;
    const pulse = 0.7 + 0.3 * Math.sin(this.time * 4);
    // Scent aura: soft yellow glow on ground
    const auraGrad = ctx.createRadialGradient(x, y, 0, x, y, 50 * pulse);
    auraGrad.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
    auraGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.1)');
    auraGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, 50 * pulse, 20 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shattered jar: small glass shards on ground
    ctx.globalAlpha = 0.6 * (this.player.baitTimer / 3);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + this.time * 0.5;
      const dist = 8 + Math.sin(i * 3) * 4;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist * 0.4;
      ctx.fillStyle = '#c0c8d8';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle + 0.3) * 4, sy + Math.sin(angle + 0.3) * 2);
      ctx.lineTo(sx + Math.cos(angle - 0.2) * 3, sy + Math.sin(angle - 0.2) * 1.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  renderParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;

      if (p.type === ParticleType.FIRE) {
        ctx.globalAlpha = alpha * 0.7;
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 0.8);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === ParticleType.SMOKE) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.globalCompositeOperation = 'source-over';
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(80, 80, 80, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === ParticleType.EMBER) {
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (p.type === ParticleType.ASH) {
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.type === ParticleType.SPARK) {
        // Text particle: render as floating text (e.g. heal + icon)
        if (p.text) {
          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = 'source-over';
          ctx.font = `bold ${Math.round(p.size * 2)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = p.textColor || p.color;
          ctx.fillText(p.text, p.x, p.y);
        } else {
          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (p.type === ParticleType.BLOOD) {
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(10, 60, 10, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === ParticleType.ICE) {
        ctx.globalAlpha = alpha * 0.8;
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(200, 250, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === ParticleType.POISON_CLOUD) {
        ctx.globalAlpha = alpha * 0.6;
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(150, 100, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === ParticleType.EXPLOSION) {
        ctx.globalAlpha = alpha;
        if (p.isSlime) {
          // Green slime burst: source-over for visibility on dark backgrounds
          ctx.globalCompositeOperation = 'source-over';
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.5);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.7, `rgba(60, 200, 60, ${alpha * 0.5})`);
          grad.addColorStop(1, 'rgba(40, 120, 40, 0)');
          ctx.fillStyle = grad;
          ctx.shadowColor = 'rgba(100, 255, 100, 0.8)';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.globalCompositeOperation = 'screen';
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.5);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === ParticleType.SHIELD) {
        // Shield ring expanding outward
        const expandProgress = 1 - alpha;
        const ringRadius = p.size * expandProgress;
        ctx.globalAlpha = alpha * 0.6;
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (p.type === ParticleType.LIGHTNING) {
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#aaddff';
        ctx.shadowBlur = 10;
        ctx.fillRect(p.x - 1, p.y, 2, p.size * 3);
        ctx.shadowBlur = 0;
      } else if (p.type === ParticleType.RAIN) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /** 渲染所有蟑螂敌人 */
  renderRoaches(ctx: CanvasRenderingContext2D) {
    // ===== RENDER ORDER: normal roaches first, then charging BOSS on top =====
    // First pass: render all non-boss or non-charging roaches
    for (const r of this.roaches) {
      // Skip charging BOSS - will be rendered in second pass on top
      if (r.isBoss && r.type === RoachType.QUEEN && r.isCharging) continue;
      this.renderRoach(ctx, r);
    }
    // Second pass: render charging BOSS last (on top of all other roaches)
    for (const r of this.roaches) {
      if (r.isBoss && r.type === RoachType.QUEEN && r.isCharging) {
        this.renderRoach(ctx, r);
      }
    }

    // ===== HOSPITAL EXCLUSIVE: "ILLEGAL MEDICINE" NURSE AOE HEAL RENDER =====
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

    ctx.restore();
  }

  renderRoach(ctx: CanvasRenderingContext2D, r: Roach) {
    // Flying roach death (including flying suicide): disintegration and falling animation
    if ((r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) && r.state === RoachState.DEAD) {
      const alpha = Math.max(0, r.deathTimer / 2.0);
      ctx.globalAlpha = alpha;
      const def = ENEMY_DEFS[r.type];
      const size = def.size;
      const w = size * 1.2;
      const h = size;

      ctx.save();
      ctx.translate(r.x, r.y);
      // Spin while falling
      ctx.rotate(r.angle);

      if (this.roachFlyingImg && this.imagesLoaded) {
        ctx.drawImage(this.roachFlyingImg, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Disintegration overlay: fading cracks
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, -h * 0.2);
      ctx.lineTo(w * 0.1, h * 0.1);
      ctx.lineTo(-w * 0.1, h * 0.3);
      ctx.stroke();

      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    // ===== BOSS DEATH: use frame animation system =====
    if (r.state === RoachState.DEAD && r.isBoss && r.type === RoachType.QUEEN && this.bossBattle.bossKilled) {
      // Boss death: render die animation frames (controlled by deathAnimTimer / corpseStayTimer)
      const bossScale = 6;
      const def = ENEMY_DEFS[r.type];
      const size = def.size;
      const w = size * 1.2;
      const bossW = w * bossScale;
      const bossH = size * bossScale;

      ctx.save();
      ctx.translate(r.x, r.y);

      const action = this.bossAnimState.action;
      const frameIdx = this.bossAnimState.frameIndex;
      let frames = this.bossAnimFrames.get(action);
      // Fallback to idle if action has no frames
      if (!frames || frames.length === 0) {
        frames = this.bossAnimFrames.get('idle');
      }
      let animImg = frames?.[frameIdx];
      if (!animImg && frames) {
        animImg = frames.find(f => f !== undefined);
      }

      if (animImg) {
        ctx.drawImage(animImg, -bossW / 2, -bossH / 2, bossW, bossH);
      } else {
        // Fallback to static image
        if (this.roachQueenImg) ctx.drawImage(this.roachQueenImg, -bossW / 2, -bossH / 2, bossW, bossH);
      }
      ctx.restore();
      return;
    }

    // Normal roach death (non-boss): fade out as a dark circle
    // SKIP for MUTANT during transformation animation - render 3-frame sequence instead
    if (r.state === RoachState.DEAD && !(r.type === RoachType.MUTANT && this.mutantTransformActive)) {
      const alpha = r.deathTimer / 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#222';
      ctx.beginPath();
      const deadSize = r.type === RoachType.LARGE ? 16 : 10;
      ctx.arc(r.x, r.y, deadSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x - 5, r.y - 3);
      ctx.lineTo(r.x + 3, r.y + 2);
      ctx.lineTo(r.x - 2, r.y + 6);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    const def = ENEMY_DEFS[r.type];
    const size = r.isBoss ? def.size : def.size * (0.9 + Math.sin(this.time * 3 + r.wobbleOffset) * 0.1);
    const w = size * 1.2;
    const h = size;

    ctx.save();
    ctx.translate(r.x, r.y);

    // ===== BOSS GROUND COMBAT: horizontal flip based on facing direction =====
    if (r.isBoss && r.type === RoachType.QUEEN && this.bossBattle.phase >= 2) {
      const faceScale = r.facingRight ? -1 : 1; // flip sprite to face walking direction
      ctx.scale(faceScale, 1);
    }

    // Damage flash - BOSS gets bright RED flash
    if (r.damageFlash > 0) {
      if (r.isBoss && r.type === RoachType.QUEEN) {
        // Strong red flash for BOSS
        ctx.filter = `brightness(${1 + r.damageFlash * 0.5}) saturate(2) hue-rotate(-30deg)`;
        // Additional red glow overlay
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(255, 0, 0, ${Math.min(0.6, r.damageFlash * 0.3)})`;
        const sz = r.size || 60;
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.filter = `brightness(${1 + r.damageFlash})`;
      }
    }

    // Stuck overlay (yellow tint for board-stuck roaches)
    if (this.isStuckByBoard(r.id)) {
      ctx.filter = 'brightness(1.3) sepia(0.5)';
    }

    // Suicide roach: black smoke when HP below 50%
    if ((r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) && r.hp < r.maxHp * 0.5) {
      const smokeIntensity = 1 - (r.hp / (r.maxHp * 0.5)); // 0→1 as HP drops from 50% to 0%
      if (Math.random() < smokeIntensity * 0.6) {
        this.particles.push({
          x: r.x + (Math.random() - 0.5) * (r.size || 30) * 0.8,
          y: r.y + (Math.random() - 0.5) * (r.size || 30) * 0.5,
          vx: (Math.random() - 0.5) * 15,
          vy: -20 - Math.random() * 25,
          life: 0.4 + Math.random() * 0.3,
          maxLife: 0.7,
          size: 3 + Math.random() * 5 * smokeIntensity,
          color: `rgba(30, 30, 30, ${0.5 + smokeIntensity * 0.4})`,
          type: ParticleType.ASH,
        });
      }
    }

    // Rotation: downward (vy>0) = 0°, upward (vy<=0) = 180°
    // Skip for BOSS — handled separately below with proper rotation
    // Nurse roach: never flip vertically (no reversal when hit by flame)
    if (r.vy <= 0 && !r.isBoss && r.type !== RoachType.NURSE) ctx.scale(1, -1);

    if (this.roachImg && this.imagesLoaded) {
      // Special handling for roaches with custom images
      if (r.type === RoachType.SUICIDE && this.roachSuicideImg) {
        ctx.drawImage(this.roachSuicideImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.TIMED_SUICIDE && this.roachTimedSuicideImg) {
        ctx.drawImage(this.roachTimedSuicideImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.NURSE) {
        // 10-frame casting animation during heal phases
        let castImg: HTMLImageElement | null = null;
        if (r.healPhase && r.healPhase !== 'idle' && r.state === RoachState.ALIVE) {
          // Map heal phase to cast frame index (0-9)
          let frameIdx = 0;
          const phase = r.healPhase;
          const timer = r.healPhaseTimer || 0;
          if (phase === 'charging') {
            // Phase 1: frames 0-3 (1.0s, each frame ~250ms)
            const progress = 1 - timer / 1.0;
            frameIdx = Math.min(3, Math.floor(progress * 4));
          } else if (phase === 'spraying') {
            // Phase 2: frames 4-6 loop (2.0s, cycle every 600ms)
            const cyclePos = (1 - timer / 2.0) % 0.5;
            if (cyclePos < 0.17) frameIdx = 4;
            else if (cyclePos < 0.34) frameIdx = 5;
            else frameIdx = 6;
          } else if (phase === 'dissipating') {
            // Phase 3: frames 7-9 (1.0s, each ~330ms)
            const progress = 1 - timer / 1.0;
            frameIdx = 7 + Math.min(2, Math.floor(progress * 3));
          }
          castImg = this.nurseCastFrames[frameIdx] || this.roachNurseImg;
        }
        const img = castImg || this.roachNurseImg;
        if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);

        // ===== NURSE HEAL: Green range circle under feet =====
        if (r.healPhase && r.healPhase !== 'idle' && r.state === RoachState.ALIVE) {
          const healRange = 150;
          const phase = r.healPhase;
          const timer = r.healPhaseTimer || 0;
          let ringAlpha = 0;
          let ringScale = 1;

          if (phase === 'charging') {
            const progress = 1 - timer / 1.0;
            ringAlpha = progress * 0.5;
            ringScale = 0.3 + progress * 0.7;
          } else if (phase === 'spraying') {
            const pulse = 1 + Math.sin(this.time * 4) * 0.08;
            ringAlpha = 0.45 * pulse;
            ringScale = 1;
          } else if (phase === 'dissipating') {
            const progress = 1 - timer / 1.0;
            ringAlpha = (1 - progress) * 0.3;
            ringScale = 1 + progress * 0.2;
          }

          // Outer glow ring
          const rangeR = healRange * ringScale;
          const grad = ctx.createRadialGradient(0, 0, rangeR * 0.6, 0, 0, rangeR);
          grad.addColorStop(0, `rgba(80, 200, 100, 0)`);
          grad.addColorStop(0.7, `rgba(80, 200, 100, ${ringAlpha * 0.25})`);
          grad.addColorStop(0.9, `rgba(100, 230, 130, ${ringAlpha * 0.5})`);
          grad.addColorStop(1, `rgba(120, 255, 150, ${ringAlpha * 0.15})`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(0, h * 0.1, rangeR, rangeR * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();

          // Sharp ring outline
          ctx.strokeStyle = `rgba(100, 240, 140, ${ringAlpha * 0.7})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(0, h * 0.1, rangeR * 0.85, rangeR * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Inner filled area
          ctx.fillStyle = `rgba(90, 210, 120, ${ringAlpha * 0.12})`;
          ctx.beginPath();
          ctx.ellipse(0, h * 0.1, rangeR * 0.5, rangeR * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();

          // Rotating dash marks on the ring edge
          const dashCount = 8;
          const dashAngle = this.time * 1.5;
          for (let di = 0; di < dashCount; di++) {
            const a = dashAngle + (di / dashCount) * Math.PI * 2;
            const dashX = Math.cos(a) * rangeR * 0.85;
            const dashY = Math.sin(a) * rangeR * 0.3 + h * 0.1;
            const dashLen = 6 + Math.sin(this.time * 3 + di) * 2;
            ctx.strokeStyle = `rgba(140, 255, 170, ${ringAlpha * 0.6})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dashX - Math.cos(a) * dashLen * 0.5, dashY - Math.sin(a) * dashLen * 0.15);
            ctx.lineTo(dashX + Math.cos(a) * dashLen * 0.5, dashY + Math.sin(a) * dashLen * 0.15);
            ctx.stroke();
          }
        }
      } else if (r.type === RoachType.MUTANT) {
        // 3-frame transformation animation support
        let img: HTMLImageElement | null = null;
        if (this.mutantTransformActive && r.state === RoachState.DEAD) {
          // 7-frame transformation animation (200ms each) - scaled 1.3x for visibility
          const frameImg = this.mutantTransformFrames[this.mutantTransformFrame];
          if (frameImg) {
            img = frameImg;
          } else if (this.roachMutantImg) {
            img = this.roachMutantImg; // fallback
          }
          // Apply 1.3x scale during transformation
          const scale = 1.3;
          ctx.scale(scale, scale);
        } else if (this.roachMutantImg) {
          img = this.roachMutantImg; // Normal render
        }
        if (img) {
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }
      } else if (r.type === RoachType.FLYING && this.roachFlyingImg) {
        ctx.drawImage(this.roachFlyingImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.FLYING_SUICIDE && this.roachFlyingSuicideImg) {
        ctx.drawImage(this.roachFlyingSuicideImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.ARMORED && this.roachArmoredImg) {
        // ARMORED roach: show armored image when armor intact, normal when broken
        const isArmorBroken = r.armorHp <= 0;
        if (isArmorBroken && this.roachImg) {
          ctx.drawImage(this.roachImg, -w / 2, -h / 2, w, h);
        } else {
          ctx.drawImage(this.roachArmoredImg, -w / 2, -h / 2, w, h);
        }
      } else if (r.type === RoachType.SPLITTING && this.roachSplittingImg) {
        ctx.drawImage(this.roachSplittingImg, -w / 2, -h / 2, w, h);
      } else if (r.type === RoachType.QUEEN && this.roachQueenImg) {
        // ===== BOSS RENDERING: scale 3x + face downward =====
        // Boss images are already rotated 180° (head downward)
        // Just draw at 3x size, no additional flip needed
        const bossScale = 6;
        const bossW = w * bossScale;
        const bossH = h * bossScale;

        // Use frame animation system with fallback for missing frames
        if (r.isBoss && this.bossBattle.active) {
          const action = this.bossAnimState.action;
          const frameIdx = this.bossAnimState.frameIndex;
          let frames = this.bossAnimFrames.get(action);
          // If action has no frames, fallback to idle
          if (!frames || frames.length === 0) {
            frames = this.bossAnimFrames.get('idle');
          }
          // Try current frame first, then fallback to any loaded frame
          let animImg = frames?.[frameIdx];
          if (!animImg && frames) {
            animImg = frames.find(f => f !== undefined);
          }
          
          if (animImg) {
            // ===== CODE-DRIVEN ANIMATION EFFECTS per action =====
            const t = this.time;
            const action = this.bossAnimState.action;
            ctx.save();

            switch (action) {
              case 'idle': {
                // Ground idle: breathing scale pulse + micro sway
                const breathe = 1 + Math.sin(t * 2.5) * 0.03;
                const swayX = Math.sin(t * 1.2 + r.wobbleOffset) * 3;
                const swayY = Math.sin(t * 2.0 + r.wobbleOffset) * 2;
                ctx.translate(swayX, swayY);
                ctx.scale(breathe, breathe);
                break;
              }
              case 'hover': {
                // Air hover: floating up/down + gentle rock
                const floatY = Math.sin(t * 1.8 + r.wobbleOffset) * 8;
                const rock = Math.sin(t * 0.7 + r.wobbleOffset) * 0.03;
                const wingVibe = 1 + Math.sin(t * 20) * 0.01; // fast wing flutter
                ctx.translate(0, floatY);
                ctx.rotate(rock);
                ctx.scale(wingVibe, wingVibe);
                break;
              }
              case 'walk': {
                // Ground walk: body bob + stride bounce + lean into movement
                const bobY = Math.abs(Math.sin(t * 6 + r.wobbleOffset)) * (-6);
                const lean = (r.vx ?? 0) * 0.002;
                ctx.translate(0, bobY);
                ctx.rotate(Math.max(-0.08, Math.min(0.08, lean)));
                // Footstep dust effect
                if (Math.sin(t * 6) > 0.85) {
                  this.particles.push({
                    x: r.x + (Math.random() - 0.5) * 30,
                    y: r.y + bossH * 0.4,
                    vx: (Math.random() - 0.5) * 20,
                    vy: -10 - Math.random() * 15,
                    life: 0.3, maxLife: 0.3,
                    size: 3 + Math.random() * 4,
                    color: 'rgba(180, 160, 140, 0.4)',
                    type: ParticleType.ASH,
                  });
                }
                break;
              }
              case 'charge': {
                // Charging: aggressive forward lean + vibration + speed lines
                const phase2Lean = 0;
                const vibration = Math.sin(t * 50) * 2;
                const chargePulse = 1 + Math.sin(t * 8) * 0.04;
                ctx.translate(vibration, Math.abs(vibration) * 0.5);
                ctx.rotate(phase2Lean);
                ctx.scale(chargePulse, chargePulse);
                // Speed trail particles
                if (Math.random() < 0.4) {
                  this.particles.push({
                    x: r.x + (Math.random() - 0.5) * 40,
                    y: r.y - bossH * 0.3 + (Math.random() - 0.5) * 20,
                    vx: (Math.random() - 0.5) * 10,
                    vy: -80 - Math.random() * 60,
                    life: 0.25, maxLife: 0.25,
                    size: 2 + Math.random() * 3,
                    color: 'rgba(255, 100, 50, 0.6)',
                    type: ParticleType.SPARK,
                  });
                }
                break;
              }
              case 'summon': {
                // Summoning: energy pulse + shake + purple glow rings
                const pulse = 1 + Math.sin(t * 10) * 0.06;
                const shakeX = Math.sin(t * 30) * 2;
                const shakeY = Math.cos(t * 25) * 2;
                ctx.translate(shakeX, shakeY);
                ctx.scale(pulse, pulse);
                // Periodic energy ring
                if (Math.sin(t * 4) > 0.95) {
                  this.spawnShockwaveRing(r.x, r.y, 8);
                }
                break;
              }
              case 'stun': {
                // Stunned: dizzy wobble + stars circling
                const wobble = Math.sin(t * 8) * 0.08;
                const dizzyX = Math.sin(t * 5) * 5;
                ctx.translate(dizzyX, 0);
                ctx.rotate(wobble);
                // Dizzy stars
                for (let si = 0; si < 3; si++) {
                  const starAngle = t * 3 + (si / 3) * Math.PI * 2;
                  const starRadius = 50 + si * 15;
                  this.particles.push({
                    x: r.x + Math.cos(starAngle) * starRadius,
                    y: r.y - 60 + Math.sin(starAngle) * starRadius * 0.3,
                    vx: 0, vy: -20,
                    life: 0.15, maxLife: 0.15,
                    size: 6,
                    color: si % 2 === 0 ? '#facc15' : '#ffffff',
                    type: ParticleType.SPARK,
                  });
                }
                break;
              }
              case 'hurt': {
                // Hurt: red flash + pained shake
                const hurtShake = Math.sin(t * 15) * 3;
                const hurtPulse = 1 + Math.sin(t * 5) * 0.02;
                ctx.translate(hurtShake, 0);
                ctx.scale(hurtPulse, hurtPulse);
                // Red tint overlay
                ctx.filter = 'brightness(1.3) saturate(1.5)';
                break;
              }
              case 'die': {
                // Death: shrink + fade + tilt collapse
                const dieProgress = 1 - (this.bossBattle.deathAnimTimer / 1.75); // 0→1 over death
                const shrink = Math.max(0.3, 1 - dieProgress * 0.7);
                const tilt = dieProgress * 0.3; // collapse to side
                const sinkY = dieProgress * 30; // sink down
                ctx.translate(0, sinkY);
                ctx.rotate(tilt * (Math.random() < 0.5 ? 1 : -1));
                ctx.scale(shrink, shrink);
                ctx.globalAlpha = Math.max(0.2, 1 - dieProgress * 0.5);
                break;
              }
              default: {
                // Default: gentle breathing
                const breathe = 1 + Math.sin(t * 2) * 0.02;
                ctx.scale(breathe, breathe);
              }
            }

            // Draw the frame
            ctx.drawImage(animImg, -bossW / 2, -bossH / 2, bossW, bossH);

            // Restore context after action-specific transforms
            ctx.restore();

            // Draw action-specific overlays (outside save/restore)
            if (action === 'charge') {
              // Red glow overlay for charging
              const glowAlpha = 0.15 + Math.sin(t * 6) * 0.1;
              ctx.fillStyle = `rgba(255, 60, 0, ${glowAlpha})`;
              ctx.beginPath();
              ctx.ellipse(0, bossH * 0.1, bossW * 0.55, bossH * 0.45, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            if (action === 'summon') {
              // Purple summon glow
              const glowAlpha = 0.1 + Math.sin(t * 5) * 0.08;
              ctx.fillStyle = `rgba(168, 85, 247, ${glowAlpha})`;
              ctx.beginPath();
              ctx.ellipse(0, 0, bossW * 0.6, bossH * 0.5, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Fallback: use static image
            if (this.roachQueenImg) ctx.drawImage(this.roachQueenImg, -bossW / 2, -bossH / 2, bossW, bossH);
          }
        } else {
          // Normal QUEEN (not boss)
          ctx.drawImage(this.roachQueenImg, -w / 2, -h / 2, w, h);
        }
      } else {
        ctx.drawImage(this.roachImg, -w / 2, -h / 2, w, h);
      }
    } else {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ===== HOSPITAL EXCLUSIVE: MUTANT TRANSFORMATION VISUAL =====
    // Purple swirling glow during the 0.5s pre-transformation pause
    if (r.type === RoachType.MUTANT && r.transformTimer && r.transformTimer > 0) {
      const progress = 1 - r.transformTimer / 1.0; // 0→1
      const swirlAlpha = 0.4 + progress * 0.4;
      const swirlR = Math.max(w, h) * (0.8 + progress * 0.6);
      // Outer purple ring
      ctx.save();
      ctx.strokeStyle = `rgba(217, 70, 239, ${swirlAlpha})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = `rgba(217, 70, 239, ${swirlAlpha * 0.8})`;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      for (let si = 0; si < 8; si++) {
        const sAngle = (si / 8) * Math.PI * 2 + this.time * 6 + progress * Math.PI;
        const sx = Math.cos(sAngle) * swirlR;
        const sy = Math.sin(sAngle) * swirlR * 0.7;
        if (si === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner glow
      const glowGrad = ctx.createRadialGradient(0, 0, swirlR * 0.2, 0, 0, swirlR);
      glowGrad.addColorStop(0, `rgba(217, 70, 239, ${swirlAlpha * 0.15})`);
      glowGrad.addColorStop(1, `rgba(217, 70, 239, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fill();
      // Countdown text
      const secsLeft = Math.ceil(r.transformTimer!);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + progress * 0.2})`;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`变身! ${secsLeft}s`, 0, -swirlR - 10);
      ctx.restore();
    }

    // ===== MUTANT SPAWN: Green slime tint overlay (2s) =====
    if (r.wasMutantSpawn && r.slimeTimer && r.slimeTimer > 0 && r.state === RoachState.ALIVE) {
      const slimeProgress = Math.min(1, r.slimeTimer / 2.0);
      const slimeAlpha = 0.6 * slimeProgress;

      // 1. Bright green glow behind the roach
      const glowR = Math.max(w, h) * 0.6;
      const glowGrad = ctx.createRadialGradient(0, 0, glowR * 0.3, 0, 0, glowR);
      glowGrad.addColorStop(0, `rgba(100, 255, 120, ${slimeAlpha * 0.3})`);
      glowGrad.addColorStop(0.7, `rgba(60, 200, 80, ${slimeAlpha * 0.5})`);
      glowGrad.addColorStop(1, `rgba(40, 150, 60, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, glowR, glowR * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Green slime overlay on roach body
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.5, h * 0.42, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = `rgba(80, 200, 80, ${slimeAlpha * 0.5})`;
      ctx.fillRect(-w, -h, w * 2, h * 2);
      ctx.restore();

      // 3. Outer slime ring (dripping effect)
      ctx.strokeStyle = `rgba(100, 255, 130, ${slimeAlpha * 0.7})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.52, h * 0.44, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 4. Highlight spots (wet slime look)
      const spotCount = 3;
      for (let si = 0; si < spotCount; si++) {
        const spotAngle = this.time * 1.5 + si * 2.1 + r.id;
        const spotDist = w * 0.25 * Math.sin(si * 1.3 + 0.5);
        const spotX = Math.cos(spotAngle) * spotDist;
        const spotY = Math.sin(spotAngle) * spotDist * 0.7;
        const spotR = 3 + Math.sin(this.time * 3 + si) * 1.5;
        ctx.fillStyle = `rgba(160, 255, 170, ${slimeAlpha * 0.6})`;
        ctx.beginPath();
        ctx.ellipse(spotX, spotY, spotR, spotR * 0.6, spotAngle * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      r.slimeTimer -= this.deltaTime;
    }

    // Sticky drop wrap overlay (yellow gel blob enclosing the roach)
    if (r.wrappedByDropId !== null && r.state === RoachState.ALIVE) {
      const wrapPulse = 0.85 + Math.sin(this.time * 6 + r.id) * 0.15;
      const wrapRadius = Math.max(w, h) * 0.55 * wrapPulse;

      // Outer glow
      const glowGrad = ctx.createRadialGradient(0, 0, wrapRadius * 0.5, 0, 0, wrapRadius * 1.3);
      glowGrad.addColorStop(0, 'rgba(250, 220, 50, 0.15)');
      glowGrad.addColorStop(0.6, 'rgba(250, 200, 50, 0.25)');
      glowGrad.addColorStop(1, 'rgba(250, 180, 30, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, wrapRadius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Main gel body - semi-transparent yellow blob
      ctx.fillStyle = `rgba(250, 220, 50, ${0.35 * wrapPulse})`;
      ctx.beginPath();
      // Create an organic blob shape using multiple arcs
      const blobPoints = 8;
      for (let b = 0; b <= blobPoints; b++) {
        const angle = (Math.PI * 2 / blobPoints) * b;
        const wobble = wrapRadius * (0.9 + Math.sin(this.time * 4 + b * 2 + r.id) * 0.1);
        const bx = Math.cos(angle) * wobble;
        const by = Math.sin(angle) * wobble;
        if (b === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fill();

      // Gel border highlight
      ctx.strokeStyle = `rgba(255, 240, 150, ${0.5 * wrapPulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let b = 0; b <= blobPoints; b++) {
        const angle = (Math.PI * 2 / blobPoints) * b;
        const wobble = wrapRadius * (0.88 + Math.sin(this.time * 4 + b * 2 + r.id) * 0.08);
        const bx = Math.cos(angle) * wobble;
        const by = Math.sin(angle) * wobble;
        if (b === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.stroke();

      // Specular highlight (shiny spot on top)
      ctx.fillStyle = `rgba(255, 255, 220, ${0.4 * wrapPulse})`;
      ctx.beginPath();
      ctx.ellipse(-wrapRadius * 0.2, -wrapRadius * 0.25, wrapRadius * 0.25, wrapRadius * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Small bubbles inside the gel
      for (let b = 0; b < 3; b++) {
        const bubbleAngle = this.time * 2 + b * 2.1 + r.id;
        const bubbleR = wrapRadius * (0.3 + 0.4 * Math.sin(b * 1.7));
        const bubbleX = Math.cos(bubbleAngle) * bubbleR;
        const bubbleY = Math.sin(bubbleAngle) * bubbleR;
        ctx.fillStyle = `rgba(255, 250, 200, ${0.3 + Math.sin(this.time * 3 + b) * 0.15})`;
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, 1.5 + Math.sin(this.time * 4 + b) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Suicide roach: small flame on back
    if (r.type === RoachType.SUICIDE && r.state === RoachState.ALIVE) {
      const flameFlicker = 0.7 + Math.sin(this.time * 10 + r.id) * 0.3;
      const flameH = 8 + Math.sin(this.time * 15 + r.id * 2) * 3;
      const flameW = 6 + Math.cos(this.time * 12 + r.id) * 2;
      // Outer flame (orange)
      ctx.fillStyle = `rgba(255, 100, 20, ${flameFlicker})`;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.45);
      ctx.lineTo(-flameW / 2, -h * 0.45 - flameH * 0.6);
      ctx.lineTo(0, -h * 0.45 - flameH);
      ctx.lineTo(flameW / 2, -h * 0.45 - flameH * 0.6);
      ctx.closePath();
      ctx.fill();
      // Inner flame (yellow)
      ctx.fillStyle = `rgba(255, 220, 50, ${flameFlicker * 0.9})`;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.45);
      ctx.lineTo(-flameW * 0.3, -h * 0.45 - flameH * 0.4);
      ctx.lineTo(0, -h * 0.45 - flameH * 0.75);
      ctx.lineTo(flameW * 0.3, -h * 0.45 - flameH * 0.4);
      ctx.closePath();
      ctx.fill();
    }

    // ===== ARMOR SHIELD EFFECT: all roaches with armor buff =====
    // Drawn INSIDE the transform block so shield follows the roach
    if (r.armorHp > 0) {
      const shieldPulse = 0.3 + Math.sin(this.time * 4 + r.id) * 0.15;
      const shieldAlpha = shieldPulse;
      // Outer hexagonal shield
      ctx.save();
      ctx.strokeStyle = `rgba(100, 200, 255, ${shieldAlpha})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `rgba(100, 200, 255, ${shieldAlpha * 0.5})`;
      ctx.shadowBlur = 10;
      const shieldR = Math.max(w, h) * 0.65;
      ctx.beginPath();
      for (let si = 0; si < 6; si++) {
        const sAngle = (si / 6) * Math.PI * 2 + this.time * 0.5;
        const sx = Math.cos(sAngle) * shieldR;
        const sy = Math.sin(sAngle) * shieldR;
        if (si === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner glow
      const glowGrad = ctx.createRadialGradient(0, 0, shieldR * 0.3, 0, 0, shieldR);
      glowGrad.addColorStop(0, `rgba(100, 200, 255, ${shieldAlpha * 0.1})`);
      glowGrad.addColorStop(1, `rgba(100, 200, 255, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();
    }

    // ===== HOSPITAL EXCLUSIVE: TIMED SUICIDE ARMOR VISUAL ONLY =====
    // Armor visual (orange for timed suicide only, nurse has no armor visual)
    if (r.type === RoachType.TIMED_SUICIDE && r.armorHp && r.armorHp > 0) {
      const armorPulse = 0.35 + Math.sin(this.time * 4 + r.id) * 0.15;
      const armorAlpha = armorPulse;
      ctx.save();
      const armorColor = '255, 165, 0'; // Orange for timed suicide
      ctx.strokeStyle = `rgba(${armorColor}, ${armorAlpha})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = `rgba(${armorColor}, ${armorAlpha * 0.6})`;
      ctx.shadowBlur = 12;
      const armorR = Math.max(w, h) * 0.7;
      ctx.beginPath();
      for (let si = 0; si < 6; si++) {
        const sAngle = (si / 6) * Math.PI * 2 + this.time * 0.5;
        const sx = Math.cos(sAngle) * armorR;
        const sy = Math.sin(sAngle) * armorR;
        if (si === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner glow
      const glowGrad = ctx.createRadialGradient(0, 0, armorR * 0.3, 0, 0, armorR);
      glowGrad.addColorStop(0, `rgba(${armorColor}, ${armorAlpha * 0.12})`);
      glowGrad.addColorStop(1, `rgba(${armorColor}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();
    }

    // ===== TIMED SUICIDE: "螂家爆破" VISUAL OVERLAY =====
    // Rendered INSIDE transform block so effects follow the roach
    if (r.type === RoachType.TIMED_SUICIDE && r.breachPhase && r.breachPhase !== 'idle' && r.breachPhase !== 'residue') {
      const phase = r.breachPhase;
      const phaseTimer = r.breachPhaseTimer || 0;

      if (phase === 'warning') {
        // Phase 1: Danger warning
        // Red blinking light on back (3Hz rapid flash)
        const blink = Math.sin(this.time * 18) > 0 ? 1 : 0.3;
        ctx.fillStyle = `rgba(180, 40, 40, ${blink})`;
        ctx.beginPath();
        ctx.arc(0, -h * 0.35, 5, 0, Math.PI * 2);
        ctx.fill();
        // Danger circle on ground (40px radius, irregular, 60% alpha)
        ctx.save();
        ctx.translate(0, h * 0.4);
        ctx.strokeStyle = `rgba(140, 30, 30, 0.6)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 4]);
        ctx.lineDashOffset = -this.time * 20;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += 0.3) {
          const rough = 1 + Math.sin(a * 5 + r.id) * 0.12;
          const rx = Math.cos(a) * 40 * rough;
          const ry = Math.sin(a) * 20 * rough;
          if (a === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Countdown number (dark red, slight jitter)
        const jitterX = Math.sin(this.time * 50) * 0.8;
        const jitterY = Math.cos(this.time * 45) * 0.6;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8b2020';
        ctx.fillText(`${Math.ceil(3.0 - (0.5 - phaseTimer) / 0.5 * 3)}`, jitterX, -h * 0.6 + jitterY);
      }

      if (phase === 'crouching') {
        // Phase 2: Crouching + countdown

        // Body squashed 30% (simulate crouching)
        ctx.scale(1.3, 0.7);

        // Red blinking light on back (3Hz rapid)
        const blink = Math.sin(this.time * 18) > 0 ? 1 : 0.2;
        ctx.fillStyle = `rgba(200, 30, 30, ${blink})`;
        ctx.beginPath();
        ctx.arc(0, -h * 0.25, 6, 0, Math.PI * 2);
        ctx.fill();

        // Crack lines spreading from center (dark red, hand-drawn feel)
        const crackR = r.crackRadius || 0;
        if (crackR > 0) {
          ctx.save();
          ctx.translate(0, h * 0.45);
          ctx.strokeStyle = `rgba(120, 40, 40, 0.5)`;
          ctx.lineWidth = 1.5;
          for (let ci = 0; ci < 5; ci++) {
            const cAngle = (ci / 5) * Math.PI * 2 + r.id * 0.7;
            const len = crackR * (0.5 + Math.sin(ci * 2.3) * 0.3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const steps = 4;
            for (let s = 1; s <= steps; s++) {
              const sx = Math.cos(cAngle + s * 0.1) * (len * s / steps);
              const sy = Math.sin(cAngle + s * 0.1) * (len * s / steps * 0.5);
              ctx.lineTo(sx, sy);
            }
            ctx.stroke();
          }
          ctx.restore();
        }

        // Body tremor (2px, 3Hz)
        const tremor = Math.sin(this.time * 18) * 2;
        ctx.translate(0, tremor);

        // Enlarged countdown number (150%, dark red锯齿描边)
        const secs = Math.ceil(r.placeTimer || 0);
        ctx.save();
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Dark red锯齿描边
        ctx.strokeStyle = '#8b2020';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'miter';
        ctx.strokeText(`${secs}`, 0, -h * 0.8);
        ctx.fillStyle = secs <= 1 ? '#8b2020' : '#a05030';
        ctx.fillText(`${secs}`, 0, -h * 0.8);
        ctx.restore();
      }

      if (phase === 'exploding') {
        // Phase 3: Explosion frame - dark red silhouette expanded to 120%
        const expandProgress = Math.min(1, phaseTimer / 0.1);
        const scale = 1.0 + (1.2 - 1.0) * (1 - expandProgress);
        ctx.scale(scale, scale);
        // Dark red silhouette overlay
        ctx.fillStyle = `rgba(100, 20, 20, ${0.8 * (1 - expandProgress)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.5, h * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.filter = 'none';
    ctx.restore();

    // ===== TIMED SUICIDE: "螂家爆破" RESIDUE RENDER =====
    // Rendered OUTSIDE transform (world coordinates) for ground scorch marks
    if (r.type === RoachType.TIMED_SUICIDE && r.breachPhase === 'residue' && r.residueTimer && r.residueTimer > 0) {
      const fadeAlpha = r.residueTimer / 3.0;
      ctx.save();
      ctx.translate(r.x, r.y);
      // Dark scorch mark (80x80, irregular edges like burnt paper)
      ctx.fillStyle = `rgba(25, 18, 15, ${0.7 * fadeAlpha})`;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.25) {
        const rough = 1 + Math.sin(a * 4 + r.id * 2) * 0.2;
        const sr = 40 * rough;
        const sx = Math.cos(a) * sr;
        const sy = Math.sin(a) * sr * 0.6;
        if (a === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      // 1-2 tiny gear/spring fragments
      ctx.fillStyle = `rgba(60, 55, 55, ${0.5 * fadeAlpha})`;
      ctx.fillRect(-8, 2, 6, 3);
      ctx.fillRect(5, -3, 4, 4);
      // Thin smoke rising
      if (r.residueTimer > 1.5) {
        const smokeAlpha = (r.residueTimer - 1.5) / 1.5 * 0.3;
        ctx.fillStyle = `rgba(80, 75, 75, ${smokeAlpha})`;
        ctx.beginPath();
        ctx.ellipse(0, -30 - (3.0 - r.residueTimer) * 15, 4, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ===== HP bar + Armor bar: show for ALL roaches that have armor buff =====
    const barW = r.isBoss ? 60 : Math.max(32, (r.size ?? 30) * 0.5);
    const barH = r.isBoss ? 8 : 5;
    // Always show HP bar for armored/shielded roaches, large/boss roaches
    const showHpBar = r.armorHp > 0 || r.isBoss || r.type === RoachType.SMALL || r.type === RoachType.LARGE || r.type === RoachType.ARMORED || r.type === RoachType.SPLITTING || r.type === RoachType.NURSE || r.type === RoachType.TIMED_SUICIDE;
    if (showHpBar) {
      const hpRatio = Math.max(0, r.hp / r.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(r.x - barW / 2, r.y - size - 15, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.2 ? '#eab308' : '#ef4444';
      ctx.fillRect(r.x - barW / 2, r.y - size - 15, barW * hpRatio, barH);
    }

    // ===== HOSPITAL EXCLUSIVE: TIMED SUICIDE ARMOR BAR ONLY =====
    if (r.type === RoachType.TIMED_SUICIDE && r.armorHp && r.armorHp > 0) {
      const armorRatio = Math.max(0, r.armorHp / r.maxArmorHp!);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(r.x - barW / 2, r.y - size - 31, barW, 4);
      const armorGrad = ctx.createLinearGradient(r.x - barW / 2, 0, r.x + barW / 2, 0);
      armorGrad.addColorStop(0, '#fbbf24');
      armorGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = armorGrad;
      ctx.fillRect(r.x - barW / 2, r.y - size - 31, barW * armorRatio, 4);
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x - barW / 2, r.y - size - 31, barW, 4);
    }

    // ===== ARMOR BUFF BAR: show for ALL roach types with armor =====
    if (r.armorHp > 0) {
      const armorRatio = Math.max(0, r.armorHp / r.maxArmorHp);
      // Armor bar background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(r.x - barW / 2, r.y - size - 23, barW, 4);
      // Armor fill (blue gradient)
      const armorGrad = ctx.createLinearGradient(r.x - barW / 2, 0, r.x + barW / 2, 0);
      armorGrad.addColorStop(0, '#60a5fa');
      armorGrad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = armorGrad;
      ctx.fillRect(r.x - barW / 2, r.y - size - 23, barW * armorRatio, 4);
      // Armor border
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x - barW / 2, r.y - size - 23, barW, 4);
    }

    // Flying indicator (including flying suicide)
    if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(r.wingPhase) * 0.2;
      ctx.strokeStyle = '#88ccff';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Enrage indicator
    if (r.isEnraged) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 6, 0, Math.PI * 2);
      ctx.stroke();
      const pulse = (Math.sin(this.time * 12) + 1) * 0.5;
      ctx.strokeStyle = `rgba(239, 68, 68, ${pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 6 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Stun effect
    if (r.isStunned) {
      const stunPulse = (Math.sin(this.time * 8) + 1) * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(150, 220, 255, ${0.5 + stunPulse * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(250, 200, 50, 0.8)';
      ctx.shadowBlur = 6;
      for (let i = 0; i < 3; i++) {
        const sx = r.x + (Math.random() - 0.5) * size * 2;
        const sy = r.y - size * 0.5 + (Math.random() - 0.5) * size;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - size * 0.3);
        for (let j = 0; j < 3; j++) {
          ctx.lineTo(sx + (Math.random() - 0.5) * 8, sy + j * 4);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.fillStyle = `rgba(250, 200, 50, ${0.15 + stunPulse * 0.1})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Poison indicator
    if (r.poisonTimer > 0) {
      ctx.fillStyle = `rgba(150, 100, 255, ${0.3 + Math.sin(this.time * 4) * 0.2})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, size + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Suicide fuse
    if (r.isFused) {
      const fusePulse = (Math.sin(this.time * 20) + 1) * 0.5;
      ctx.fillStyle = `rgba(255, 60, 0, ${0.5 + fusePulse * 0.5})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y - size - 5, 4 + fusePulse * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss name
    if (r.isBoss) {
      ctx.fillStyle = '#ff44aa';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('蟑螂女王', r.x, r.y - size - 25);
    }
  }

  /** 渲染玩家与武器 */
  renderPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const py = p.y;
    const s = 4;

    // Determine gun positions
    const gunXs: number[] = [p.x];
    if (this.tripleFlame.active) {
      gunXs.push(p.x - this.tripleFlame.sideOffset);
      gunXs.push(p.x + this.tripleFlame.sideOffset);
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
    // Only show range preview when actually placing (after screen click), not in pending_click
    if (this.itemPlaceState !== 'placing' || this.selectedItemIndex < 0) return;
    const item = this.inventory[this.selectedItemIndex];
    if (!item) return;

    const cx = this.itemPlaceCursorX;
    const cy = this.itemPlaceCursorY;
    const rx = this.itemEffectRadiusX;
    const ry = this.itemEffectRadiusY;
    const pulse = (Math.sin(this.time * 4) + 1) * 0.5;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const colors: Record<string, string> = { sticky: '250, 200, 50', poison: '180, 130, 255', molotov: '255, 100, 80', shotgun: '255, 200, 100' };
    const c = colors[item.type];

    // Large filled area (ellipse)
    ctx.fillStyle = `rgba(${c}, 0.12)`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer boundary ring (pulsing, ellipse)
    ctx.strokeStyle = `rgba(${c}, ${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10 + pulse * 6, 8]);
    ctx.lineDashOffset = -this.time * 40;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner ring (ellipse)
    ctx.strokeStyle = `rgba(${c}, 0.6)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 4 directional range lines
    ctx.strokeStyle = `rgba(${c}, 0.35)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy); ctx.lineTo(cx + rx, cy);
    ctx.moveTo(cx, cy - ry); ctx.lineTo(cx, cy + ry);
    ctx.stroke();

    // Crosshair with glow
    ctx.shadowColor = `rgba(${c}, 0.8)`;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(${c}, 1)`;
    ctx.lineWidth = 2.5;
    const csx = Math.min(14, rx * 0.3);
    const csy = Math.min(14, ry * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx - csx, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + csx, cy);
    ctx.moveTo(cx, cy - csy); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + csy);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dot with glow
    ctx.shadowColor = `rgba(${c}, 1)`;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label background
    const names: Record<string, string> = { sticky: '蟑螂贴板', poison: '杀虫剂', molotov: '燃烧瓶', shotgun: '散弹模式' };
    const label1 = `点击放置 ${names[item.type] || '道具'}`;
    const label2 = `范围: X${rx} x Y${ry}`;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    const m1 = ctx.measureText(label1);
    const m2 = ctx.measureText(label2);
    const lw = Math.max(m1.width, m2.width) + 20;
    const ly = cy - ry - 42;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(cx - lw / 2, ly, lw, 44, 8);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(label1, cx, ly + 20);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = `rgba(${c}, 1)`;
    ctx.fillText(label2, cx, ly + 37);

    ctx.restore();
  }

  renderThrowableAim(ctx: CanvasRenderingContext2D) {
    if (!this.isAiming || !this.aimWeapon) return;

    const startX = this.player.x;
    const startY = this.player.y - 322;
    const targetX = this.aimTargetX;
    const targetY = this.aimTargetY;

    // Calculate arc control point
    const midX = (startX + targetX) / 2;
    const arcHeight = 100 + this.aimPower * 150;
    const controlX = midX;
    const controlY = Math.min(startY, targetY) - arcHeight;

    // Draw parabolic trajectory line (dashed)
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;

    const colors: Record<string, string> = { sticky: 'rgba(250, 200, 50, 0.6)', poison: 'rgba(180, 130, 255, 0.6)', molotov: 'rgba(255, 100, 80, 0.6)', shotgun: 'rgba(255, 200, 100, 0.6)' };
    ctx.strokeStyle = colors[this.aimWeapon];

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    // Draw quadratic bezier curve
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Quadratic bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * targetX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * targetY;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw target circle (pulsing)
    const pulse = (Math.sin(this.time * 8) + 1) * 0.5;
    const targetRadius = 30 + this.aimPower * 20;

    const targetColors = { sticky: 'rgba(250, 200, 50, ', poison: 'rgba(180, 130, 255, ', molotov: 'rgba(255, 100, 80, ' };
    const tc = targetColors[this.aimWeapon];

    ctx.fillStyle = `${tc}${0.15 + pulse * 0.1})`;
    ctx.beginPath();
    ctx.arc(targetX, targetY, targetRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${tc}${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, targetRadius * (0.7 + pulse * 0.3), 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair at target
    ctx.strokeStyle = `${tc}0.8)`;
    ctx.lineWidth = 1.5;
    const crossSize = 8;
    ctx.beginPath();
    ctx.moveTo(targetX - crossSize, targetY);
    ctx.lineTo(targetX + crossSize, targetY);
    ctx.moveTo(targetX, targetY - crossSize);
    ctx.lineTo(targetX, targetY + crossSize);
    ctx.stroke();

    // Power indicator text
    const powerPercent = Math.round(this.aimPower * 100);
    ctx.fillStyle = `${tc}0.9)`;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`力度 ${powerPercent}%`, targetX, targetY - targetRadius - 10);

    // Weapon name
    const names = { sticky: '蟑螂贴板', poison: '杀虫剂', molotov: '燃烧瓶' };
    ctx.fillStyle = '#fff';
    ctx.fillText(names[this.aimWeapon], startX, startY - 40);

    ctx.restore();
  }

  renderThrowables(ctx: CanvasRenderingContext2D) {
    for (const t of this.throwables) {
      ctx.save();

      const colors: Record<string, string> = { sticky: '#facc15', poison: '#a78bfa', molotov: '#ff4400', shotgun: '#fbbf24' };
      const color = colors[t.type];

      // Glow
      const glowGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 15);
      glowGrad.addColorStop(0, color.replace(')', ', 0.8)').replace('rgb', 'rgba'));
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 15, 0, Math.PI * 2);
      ctx.fill();

      // Bottle shape
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Trail
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x - t.vx * 0.03, t.y - t.vy * 0.03, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(t.x - t.vx * 0.06, t.y - t.vy * 0.06, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  renderSwatter(ctx: CanvasRenderingContext2D) {
    if (!this.swatterActive) return;

    const progress = 1 - this.swatterAnimTimer / 0.6;
    const w = this.width;
    const h = this.height;
    const swatX = this.swatterSwingX;
    const startY = -h * 0.3;
    const endY = h * 0.8;
    const currentY = startY + (endY - startY) * Math.min(1, progress * 1.5);

    const headW = w * 0.7;
    const headH = h * 0.15;
    const headY = currentY;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const glowGrad = ctx.createRadialGradient(swatX, headY + headH / 2, 0, swatX, headY + headH / 2, headW * 0.6);
    glowGrad.addColorStop(0, `rgba(250, 200, 50, ${0.4 * (1 - progress)})`);
    glowGrad.addColorStop(1, 'rgba(50, 100, 200, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(swatX - headW * 0.6, headY - headH, headW * 1.2, headH * 3);

    ctx.strokeStyle = `rgba(180, 220, 255, ${0.8 * (1 - progress * 0.5)})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(swatX - headW / 2, headY, headW, headH);

    ctx.strokeStyle = `rgba(120, 180, 255, ${0.5 * (1 - progress * 0.5)})`;
    ctx.lineWidth = 1;
    const gridCols = 8;
    const gridRows = 3;
    for (let c = 1; c < gridCols; c++) {
      const gx = swatX - headW / 2 + (headW / gridCols) * c;
      ctx.beginPath();
      ctx.moveTo(gx, headY);
      ctx.lineTo(gx, headY + headH);
      ctx.stroke();
    }
    for (let r = 1; r < gridRows; r++) {
      const gy = headY + (headH / gridRows) * r;
      ctx.beginPath();
      ctx.moveTo(swatX - headW / 2, gy);
      ctx.lineTo(swatX + headW / 2, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(150, 150, 150, ${0.9 * (1 - progress)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(swatX, headY + headH);
    ctx.lineTo(swatX, headY + headH + h * 0.4);
    ctx.stroke();

    if (progress > 0.3 && progress < 0.8) {
      const arcAlpha = Math.sin((progress - 0.3) / 0.5 * Math.PI) * 0.9;
      ctx.strokeStyle = `rgba(200, 240, 255, ${arcAlpha})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(250, 200, 50, 0.8)';
      ctx.shadowBlur = 15;

      for (let i = 0; i < 12; i++) {
        const ax = swatX - headW / 2 + Math.random() * headW;
        const ay = headY + Math.random() * headH;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        for (let j = 0; j < 4; j++) {
          ctx.lineTo(ax + (Math.random() - 0.5) * 30, ay + j * 8);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      ctx.fillStyle = `rgba(200, 240, 255, ${arcAlpha * 0.15})`;
      ctx.fillRect(swatX - headW / 2, headY, headW, headH);
    }

    for (const r of this.roaches) {
      if (r.isStunned && Math.random() < 0.3) {
        const sz = r.type === RoachType.LARGE ? 22 : 14;
        ctx.fillStyle = `rgba(150, 220, 255, ${0.5 + Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y - sz, 2 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  renderMuzzleFlash(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    if (!p.isFiring || p.isOverheated || p.isReloading || p.gas <= 0) return;

    const my = p.y - 322;

    // Gun positions
    const gunXs: number[] = [p.x];
    if (this.tripleFlame.active) {
      gunXs.push(p.x - this.tripleFlame.sideOffset);
      gunXs.push(p.x + this.tripleFlame.sideOffset);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let gi = 0; gi < gunXs.length; gi++) {
      const mx = gunXs[gi];
      const isSideGun = gi > 0;
      const scale = isSideGun ? 0.6 : 1.0;

      // Power Boost: circular particles spraying from flame (active only during power boost)
      if (this.player.powerBoostTimer > 0) {
        const boostAlpha = Math.min(1, this.player.powerBoostTimer / 0.5);
        for (let pi = 0; pi < 4; pi++) {
          const sprayAngle = Math.random() * Math.PI * 2;
          const sprayDist = 15 + Math.random() * 35;
          const px = mx + Math.cos(sprayAngle) * sprayDist;
          const py = my + Math.sin(sprayAngle) * sprayDist * 0.6 - Math.random() * 10;
          const pSize = (2 + Math.random() * 3.5) * scale;
          const colors = ['255, 100, 20', '255, 180, 50', '255, 60, 0', '255, 140, 40'];
          const cIdx = Math.floor(Math.random() * colors.length);
          const pAlpha = (0.6 + Math.random() * 0.4) * boostAlpha;

          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = `rgba(${colors[cIdx]}, ${pAlpha})`;
          ctx.beginPath();
          ctx.arc(px, py, pSize, 0, Math.PI * 2);
          ctx.fill();

          // Small glow around each particle
          const glowGrad = ctx.createRadialGradient(px, py, 0, px, py, pSize * 2);
          glowGrad.addColorStop(0, `rgba(${colors[cIdx]}, ${pAlpha * 0.3})`);
          glowGrad.addColorStop(1, `rgba(${colors[cIdx]}, 0)`);
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(px, py, pSize * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  renderWeatherForeground(ctx: CanvasRenderingContext2D, w: number) {
    // Render weather particles on top
    ctx.save();
    for (const p of this.weatherParticles) {
      const alpha = p.life / p.maxLife;
      if (p.type === ParticleType.RAIN) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02);
        ctx.stroke();
      } else if (p.type === ParticleType.SMOKE) {
        ctx.globalAlpha = alpha * 0.3;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(180, 180, 160, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Render defense line last
    this.renderDefenseLine(ctx, w);
  }

  renderFloatingTexts(ctx: CanvasRenderingContext2D) {
    for (const t of this.floatingTexts) {
      const alpha = t.life / t.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      const fontSize = Math.round(16 * (t.scale || 1));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3 * (t.scale || 1);
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ========== CONSUMABLE SHOP (one-time use items) ==========
  // DIFFERENT from talent tree (permanent). These are immediate/temporary effects.
  /**
   * 购买消耗品（加入库存，不立即使用）
   * @param {string} id - 消耗品类型 ID
   * @returns {boolean} 是否购买成功
   */
  buyConsumable(id: string): boolean {
    const def = CONSUMABLE_DEFS.find(c => c.id === id);
    if (!def) return false;
    if (this.economy.money < def.cost) return false;

    this.economy.money -= def.cost;
    this.consumableInventory[id] = (this.consumableInventory[id] || 0) + 1;
    // Default: auto-use enabled for all consumables
    if (this.autoUseEnabled[id] === undefined) {
      this.autoUseEnabled[id] = true;
    }

    // Create new object references to trigger React state updates
    this.economy = { ...this.economy };
    this.onEconomyUpdate?.(this.economy);
    this.onConsumableUpdate?.({ ...this.consumableInventory }, { ...this.buffFlashTimers }, { ...this.consumableCooldowns }, this.globalConsumableCooldown, this.combatStartTimer, { ...this.itemCooldowns });

    return true;
  }

  /**
   * 使用库存中的消耗品
   * @param {string} id - 消耗品类型 ID
   * @returns {boolean} 是否使用成功
   */
  useConsumable(id: string): boolean {
    if (!this.player) return false;
    if ((this.consumableInventory[id] || 0) <= 0) return false;

    // Emergency cool bypasses all cooldown checks
    if (id !== 'emergency_cool') {
      // Check combat start lock (1 second after combat starts)
      if (this.combatStartTimer > 0) {
        this.addFloatingText(this.player.x, this.player.y - 40, `冷却中... (${this.combatStartTimer.toFixed(1)}s)`, '#94a3b8', 800);
        return false;
      }
      // Check individual consumable cooldown
      if ((this.consumableCooldowns[id] || 0) > 0) {
        this.addFloatingText(this.player.x, this.player.y - 40, `${CONSUMABLE_DEFS.find(c => c.id === id)?.name || ''}冷却中... (${this.consumableCooldowns[id].toFixed(1)}s)`, '#94a3b8', 800);
        return false;
      }
      // Check global cooldown (1 second after using any other consumable)
      if (this.globalConsumableCooldown > 0) {
        this.addFloatingText(this.player.x, this.player.y - 40, `全局冷却中... (${this.globalConsumableCooldown.toFixed(1)}s)`, '#94a3b8', 800);
        return false;
      }
    }

    this.consumableInventory[id]--;
    if (this.consumableInventory[id] <= 0) delete this.consumableInventory[id];

    switch (id) {
      case 'gas_refill': {
        this.player.gas = this.player.maxGas;
        this.buffFlashTimers['gas_refill'] = 2; // 2 second buff flash
        this.addFloatingText(this.player.x, this.player.y - 40, '燃气已回满!', '#fbbf24', 1500);
        break;
      }
      case 'defense_repair': {
        const healAmount = Math.floor(this.maxDefenseHp * 0.2); // 20% of max HP instead of fixed 25
        const oldHp = this.defenseHp;
        this.defenseHp = Math.min(this.maxDefenseHp, this.defenseHp + healAmount);
        const actualHeal = this.defenseHp - oldHp;
        this.buffFlashTimers['defense_repair'] = 2; // 2 second buff flash
        if (actualHeal > 0) {
          this.addFloatingText(this.width / 2, this.defenseLineY() - 30, `防线修复 +${actualHeal}`, '#4ade80', 1500);
        }
        break;
      }
      case 'emergency_cool': {
        // Purchased from shop → add to emergencyCoolInventory (free uses)
        this.emergencyCoolInventory++;
        this.onEmergencyCoolUpdate?.(this.emergencyCoolInventory);
        this.addFloatingText(this.player.x, this.player.y - 40, `紧急冷却 +1 (共${this.emergencyCoolInventory}次)`, '#60a5fa', 1500);
        break;
      }
      case 'power_boost': {
        this.player.powerBoostTimer = 8;
        // Damage x2 only (no range increase)
        this.addFloatingText(this.width / 2, this.height / 2, '>>> 火力全开 8秒 <<<', '#ef4444', 2000, 32);
        break;
      }
      case 'shield': {
        this.player.shieldTimer = 5;
        this.player.shieldActive = true;
        this.buffFlashTimers['shield'] = 5; // sync with React UI for buff icon display
        this.addFloatingText(this.width / 2, this.height / 2 - 50, '>>> 防线护盾 5秒 <<<', '#06b6d4', 2000);
        break;
      }
      case 'bait': {
        this.player.baitTimer = 3;
        // Target: center of the ground bounds (roach walkable area)
        const [targetX, targetY] = this.getGroundCenter();
        this.baitTarget = { x: targetX, y: targetY, active: true };
        // Start throw animation toward ground center
        this.baitThrowAnim = {
          active: true,
          x: this.player.x,
          y: this.player.y - 50,
          targetX,
          targetY,
          timer: 0.8,
        };
        this.addFloatingText(targetX, targetY - 40, '>>> 蟑螂诱饵已投放 <<<', '#fbbf24', 2000);
        break;
      }
    }

    // Apply cooldowns after successful use (except emergency_cool)
    if (id !== 'emergency_cool') {
      const def = CONSUMABLE_DEFS.find(c => c.id === id);
      if (def?.cooldown) {
        this.consumableCooldowns[id] = def.cooldown;
      }
      this.globalConsumableCooldown = 1; // 1 second global cooldown
    }

    this.onConsumableUpdate?.(this.consumableInventory, this.buffFlashTimers, this.consumableCooldowns, this.globalConsumableCooldown, this.combatStartTimer, this.itemCooldowns);
    this.onPlayerUpdate?.(this.player);
    this.onDefenseUpdate?.(this.defenseHp, this.maxDefenseHp);

    return true;
  }

  // Toggle auto-use for a consumable
  toggleAutoUse(id: string): boolean {
    this.autoUseEnabled[id] = !this.autoUseEnabled[id];
    this.onConsumableUpdate?.(this.consumableInventory, this.buffFlashTimers, this.consumableCooldowns, this.globalConsumableCooldown, this.combatStartTimer, this.itemCooldowns);
    return this.autoUseEnabled[id];
  }

  // Check and auto-use consumables based on conditions (called every frame)
  // Auto-triggered: emergency_cool, shield
  // Manual: gas_refill, defense_repair, power_boost, bait
  checkAutoUseConsumables() {
    if (!this.player || this.state !== GameState.PLAYING) return;

    for (const [id, count] of Object.entries(this.consumableInventory)) {
      if (count <= 0) continue;

      let shouldUse = false;
      switch (id) {
        // gas_refill is now manual-only (moved to HUD)
        case 'emergency_cool':
          shouldUse = this.player.isOverheated;
          break;
        case 'shield':
          shouldUse = this.defenseHp / this.maxDefenseHp < 0.15;
          break;
        // Manual: gas_refill, defense_repair, power_boost, bait
      }

      if (shouldUse) {
        this.useConsumable(id);
      }
    }
  }

  // Update buff flash timers (called in main update loop)
  updateBuffFlashTimers(dt: number) {
    for (const [id, timer] of Object.entries(this.buffFlashTimers)) {
      if (timer > 0) {
        this.buffFlashTimers[id] = timer - dt;
        if (this.buffFlashTimers[id] <= 0) {
          delete this.buffFlashTimers[id];
        }
      }
    }
    // ===== CONSUMABLE COOLDOWN DECREMENT =====
    // Decrement combat start timer
    if (this.combatStartTimer > 0) {
      this.combatStartTimer -= dt;
      if (this.combatStartTimer < 0) this.combatStartTimer = 0;
    }
    // Decrement global cooldown
    if (this.globalConsumableCooldown > 0) {
      this.globalConsumableCooldown -= dt;
      if (this.globalConsumableCooldown < 0) this.globalConsumableCooldown = 0;
    }
    // Decrement individual consumable cooldowns
    for (const [id, timer] of Object.entries(this.consumableCooldowns)) {
      if (timer > 0) {
        this.consumableCooldowns[id] = timer - dt;
        if (this.consumableCooldowns[id] <= 0) {
          delete this.consumableCooldowns[id];
        }
      }
    }
    // Decrement picked-up item cooldowns (shares globalConsumableCooldown with shop consumables)
    for (const [type, timer] of Object.entries(this.itemCooldowns)) {
      if (timer > 0) {
        this.itemCooldowns[type] = timer - dt;
        if (this.itemCooldowns[type] <= 0) {
          delete this.itemCooldowns[type];
        }
      }
    }
    // Notify React UI of cooldown changes (throttled to avoid excessive re-renders)
    if (this.globalConsumableCooldown > 0 || Object.keys(this.consumableCooldowns).length > 0 || Object.keys(this.itemCooldowns).length > 0) {
      this.onConsumableUpdate?.(this.consumableInventory, this.buffFlashTimers, this.consumableCooldowns, this.globalConsumableCooldown, this.combatStartTimer, this.itemCooldowns);
    }
    // Shield timer is synced with player.shieldTimer (no flash, just show while active)
    // Bait throw animation
    if (this.baitThrowAnim.active) {
      this.baitThrowAnim.timer -= dt;
      const progress = 1 - this.baitThrowAnim.timer / 0.8;
      if (progress < 1) {
        // Parabolic arc toward target roach
        this.baitThrowAnim.x += (this.baitThrowAnim.targetX - this.baitThrowAnim.x) * 0.15;
        const height = 150 * Math.sin(progress * Math.PI);
        this.baitThrowAnim.y = this.baitThrowAnim.targetY - height;
      } else {
        this.baitThrowAnim.active = false;
        // Shatter effect: yellow burst simulating bait jar breaking + scent release
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 60;
          this.particles.push({
            x: this.baitThrowAnim.targetX + Math.cos(angle) * dist,
            y: this.baitThrowAnim.targetY + Math.sin(angle) * dist * 0.3,
            vx: Math.cos(angle) * (30 + Math.random() * 40),
            vy: Math.sin(angle) * (15 + Math.random() * 25) - 20,
            life: 1.5 + Math.random(),
            maxLife: 2.5,
            color: '#fbbf24',
            size: 2 + Math.random() * 3,
            type: ParticleType.EMBER,
          });
        }
        // Glass shard fragments
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          this.particles.push({
            x: this.baitThrowAnim.targetX,
            y: this.baitThrowAnim.targetY,
            vx: Math.cos(angle) * (40 + Math.random() * 60),
            vy: Math.sin(angle) * (20 + Math.random() * 30) - 30,
            life: 1 + Math.random() * 0.8,
            maxLife: 1.8,
            color: '#e5e7eb',
            size: 1 + Math.random() * 2,
            type: ParticleType.SPARK,
          });
        }
      }
    }
    this.onConsumableUpdate?.(this.consumableInventory, this.buffFlashTimers, this.consumableCooldowns, this.globalConsumableCooldown, this.combatStartTimer, this.itemCooldowns);
  }

  // Update consumable temporary effects (called in main update loop)
  updateConsumableEffects(dt: number) {
    if (!this.player) return;
    if (this.player.powerBoostTimer > 0) {
      this.player.powerBoostTimer -= dt;
      // Countdown floating text every second
      const secondsLeft = Math.ceil(this.player.powerBoostTimer);
      if (secondsLeft > 0 && secondsLeft !== this._lastPowerBoostCountdown) {
        this._lastPowerBoostCountdown = secondsLeft;
        this.addFloatingText(this.width / 2, this.height / 2, `火力全开 ${secondsLeft}秒`, '#ef4444', 800, 32);
      }
      if (this.player.powerBoostTimer <= 0) {
        this.player.powerBoostTimer = 0;
        this._lastPowerBoostCountdown = -1;
        this.addFloatingText(this.width / 2, this.height / 2, '火力全开 结束', '#f87171', 1500, 32);
      }
    }
    if (this.player.shieldTimer > 0) {
      this.player.shieldTimer -= dt;
      this.buffFlashTimers['shield'] = this.player.shieldTimer; // sync with React UI
      if (this.player.shieldTimer <= 0) {
        this.player.shieldTimer = 0;
        this.player.shieldActive = false;
        delete this.buffFlashTimers['shield'];
        this.addFloatingText(this.width / 2, this.height / 2 - 50, '防线护盾 消失', '#22d3ee', 1500);
      }
    }
    if (this.player.baitTimer > 0) {
      this.player.baitTimer -= dt;
      // Continuous scent particles: small yellow wisps rising from bait target
      if (this.baitTarget.active && this.particles.length < this._particleLimit - 20) {
        for (let i = 0; i < 2; i++) {
          this.particles.push({
            x: this.baitTarget.x + (Math.random() - 0.5) * 30,
            y: this.baitTarget.y - Math.random() * 10,
            vx: (Math.random() - 0.5) * 8,
            vy: -(15 + Math.random() * 20),
            life: 1.2 + Math.random() * 0.8,
            maxLife: 2,
            color: Math.random() < 0.5 ? '#fbbf24' : '#fcd34d',
            size: 2 + Math.random() * 2.5,
            type: ParticleType.SMOKE,
          });
        }
      }
      if (this.player.baitTimer <= 0) {
        this.player.baitTimer = 0;
        this.baitTarget.active = false;
        this.addFloatingText(this.baitTarget.x, this.baitTarget.y - 40, '诱饵效果 消失', '#fbbf24', 1500);
      }
    }
  }
}