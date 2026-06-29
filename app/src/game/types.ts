export interface Vec2 {
  x: number;
  y: number;
}

export const GameState = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  WAVE_CLEAR: 'wave_clear',
  ITEM_DROP: 'item_drop',       // post-battle item dropped on field, waiting for player to click
  ITEM_REVEAL: 'item_reveal',   // post-battle item showcase (Zhang Shu dialog)
  SHOP: 'shop',
  TALENT_TREE: 'talent_tree',
  ACHIEVEMENTS: 'achievements',
  COUNTDOWN: 'countdown',       // pre-wave 3-2-1 countdown
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

export const GameMode = {
  STORY: 'story',
  ENDLESS: 'endless',
  DAILY: 'daily',
  BOSS: 'boss',
} as const;
export type GameMode = typeof GameMode[keyof typeof GameMode];

export const FlameMode = {
  CONE: 'cone',
  FAN: 'fan',
  PULSE: 'pulse',
  SHOTGUN: 'shotgun',
  STICKY: 'sticky',
  POISON: 'poison',
} as const;
export type FlameMode = typeof FlameMode[keyof typeof FlameMode];

export const RoachType = {
  SMALL: 'small',
  LARGE: 'large',
  FLYING: 'flying',
  ARMORED: 'armored',
  SPLITTING: 'splitting',
  SUICIDE: 'suicide',
  FLYING_SUICIDE: 'flying_suicide',
  QUEEN: 'queen',
  // Hospital exclusive roaches
  NURSE: 'nurse',
  MUTANT: 'mutant',
  TIMED_SUICIDE: 'timed_suicide',
} as const;
export type RoachType = typeof RoachType[keyof typeof RoachType];

export const RoachState = {
  ALIVE: 'alive',
  BURNING: 'burning',
  DEAD: 'dead',
  FROZEN: 'frozen',
  POISONED: 'poisoned',
} as const;
export type RoachState = typeof RoachState[keyof typeof RoachState];

export interface EnemyDef {
  name: string;
  description: string;
  hp: number;
  speed: number;
  reward: number;
  color: string;
  size: number;
  special: string[];
}

export const SceneType = {
  KITCHEN: 'kitchen',
  SEWER: 'sewer',
  DUMP: 'dump',
  BASEMENT: 'basement',
  ROOFTOP: 'rooftop',
  STREET: 'street',
  HOSPITAL: 'hospital',
  SUBWAY: 'subway',
  SUPERMARKET: 'supermarket',
  SCHOOL: 'school',
  NEST: 'nest',
} as const;
export type SceneType = typeof SceneType[keyof typeof SceneType];

export const WeatherType = {
  NONE: 'none',
  RAIN: 'rain',
  FOG: 'fog',
  NIGHT: 'night',
} as const;
export type WeatherType = typeof WeatherType[keyof typeof WeatherType];

export const ParticleType = {
  FIRE: 'fire',
  SMOKE: 'smoke',
  EMBER: 'ember',
  ASH: 'ash',
  SPARK: 'spark',
  BLOOD: 'blood',
  ICE: 'ice',
  POISON_CLOUD: 'poison_cloud',
  EXPLOSION: 'explosion',
  RAIN: 'rain',
  LIGHTNING: 'lightning',
  SHIELD: 'shield',
} as const;
export type ParticleType = typeof ParticleType[keyof typeof ParticleType];

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: ParticleType;
  // Optional text to render instead of shape (for floating + icons, etc.)
  text?: string;
  textColor?: string;
  // Green slime burst from mutant roach spawn
  isSlime?: boolean;
}

export interface FireZone {
  x: number;
  y: number;
  radius: number;
  damagePerSecond: number;
  life: number;
  maxLife: number;
  type?: 'fire' | 'poison' | 'ice';
}



export interface FireWall {
  y: number;
  x1: number;
  x2: number;
  height: number;
  damagePerSecond: number;
  life: number;
  maxLife: number;
}

export interface FanState {
  active: boolean;
  timer: number;
  duration: number;
  slowFactor: number; // how much to slow (0.0-1.0)
  bladeAngle: number;
  bladeSpeed: number;
}

export interface StickyBoard {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hitWidth: number;
  hitHeight: number;
  life: number;
  maxLife: number;
  stuckRoaches: number[];
  maxStuck: number;
}

export interface ThrowableProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'sticky' | 'poison' | 'molotov';
  life: number;
  maxLife: number;
  gravity: number;
  hasLanded: boolean;
  targetX: number;
  targetY: number;
}

export interface InventoryItem {
  type: 'sticky' | 'poison' | 'molotov' | 'shotgun' | 'radar' | 'fan' | 'swatter';
  count: number;
}

export interface TripleFlameState {
  active: boolean;
  timer: number;
  duration: number;
  sideOffset: number; // distance between center and side guns
  sideDamageMult: number;
}

// [REMOVED] EggPod system completely removed
// export interface EggPod { ... }

export interface BossBattleState {
  active: boolean;
  bossHp: number;
  bossMaxHp: number;
  phase: 1 | 2 | 3 | 4;
  phaseName: string;
  timeLimit: number;
  timeRemaining: number;
  // [REMOVED] egg pod system removed
  currentWave: number;
  // eggPods: EggPod[]; // REMOVED
  waveCleared: boolean;
  waveSpawnTimer: number;
  bossDialogue: string;
  dialogueTimer: number;
  dialogueIndex: number;
  // ===== VICTORY / DEFEAT =====
  bossKilled: boolean;
  bossFleeing: boolean;
  bossFleeTimer: number;
  deathAnimTimer: number;
  corpseStayTimer: number;
  phaseJustChanged: boolean;
  phaseChangeTimer: number;
  phaseChangeText: string;
  phaseChangeSub: string;
  // Legacy fields
  summonTimer: number;
  chargeTimer: number;
  chargeWarning: boolean;
  chargeWarningTimer: number;
  chargeWarningLevel: 0 | 1 | 2 | 3;
  stunCooldown: number;
  bossDamageTaken: number;
  enraged: boolean;
  chargeCooldown: number;
  summonWave: number;
  controlImmunity: number;
  chargeHitFlash: number;
  summonAnimTimer: number;
  summonCastTimer: number; // Boss casting animation before egg drop
  shedCount: number;
  maxShed: number;
  isShedding: boolean;
  shedAnimTimer: number;
  shedShells: ShedShell[];
  leftEyeHp: number;
  leftEyeMaxHp: number;
  leftEyeDestroyed: boolean;
  rightEyeHp: number;
  rightEyeMaxHp: number;
  rightEyeDestroyed: boolean;
  bellyHp: number;
  bellyMaxHp: number;
  bellyExposed: boolean;
  activeWeakPoint: '';
  showInterruptHint: boolean;
  interruptHintTimer: number;
}

// 蜕皮空壳
export interface ShedShell {
  x: number;
  y: number;
  size: number;
  alpha: number;
  life: number; // 存在时间(可作为障碍物)
}

export interface Roach {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: RoachType;
  hp: number;
  maxHp: number;
  state: RoachState;
  speed: number;
  baseSpeed: number;
  burnDamage: number;
  inFire: boolean;
  clusterId?: number;
  angle: number;
  wobbleOffset: number;
  wobbleSpeed: number;
  isEnraged: boolean;
  deathTimer: number;
  animFrame: number;
  animTimer: number;
  panicTimer: number;
  panicAngle: number;
  stunTimer: number;
  isStunned: boolean;
  // Ground combat facing direction (for BOSS phase 2+)
  facingRight: boolean;
  // Flying roach
  altitude: number;
  wingPhase: number;
  // Armored roach
  armorHp: number;
  maxArmorHp: number;
  // Splitting roach
  hasSplit: boolean;
  // Suicide roach
  fuseTimer: number;
  isFused: boolean;
  // Queen
  spawnTimer: number;
  isBoss: boolean;
  // Boss charging state (reliable flag, NOT vy-based detection)
  isCharging: boolean;
  // Status effects
  stuckTimer: number;
  poisonTimer: number;
  poisonDamage: number;
  // Fan slow + push back effect
  fanSlowTimer: number;
  fanSlowFactor: number; // 0.0-1.0 speed reduction
  fanPushY: number; // accumulated upward push from fan (negative = pushed back)
  // Sticky drop wrapping
  wrappedByDropId: number | null;
  wrapTimer: number;
  // Damage flash
  damageFlash: number;
  // Dodge direction for suicide/small roach (-1=left, 1=right, 0=none)
  dodgeDir: number;
  // Dodge timer (seconds remaining for dodge movement)
  dodgeTimer: number;
  // Flying roach: tracks if currently in dodge state (for one-shot dodge sound)
  wasDodging: boolean;
  // Split child: small roach spawned from splitting roach (faster dodge)
  isSplitChild?: boolean;
  // Boss control states (only used for QUEEN boss)
  isBurnBack?: boolean; // 灼烧退缩中
  burnBackTimer?: number; // 灼烧退缩剩余时间
  isBlind?: boolean; // 致盲中
  blindTimer?: number; // 致盲剩余时间
  isJammed?: boolean; // 干扰中
  jamTimer?: number; // 干扰剩余时间
  // Boss home position (for returning after being interrupted)
  homeX?: number; // original hover X position
  homeY?: number; // original hover Y position
  returningHome?: boolean; // currently flying back to home position
  chargeReturnDelay?: number; // delay before returning home after charge hit (seconds)
  // Boss override fields (independent from ENEMY_DEFS)
  size?: number;
  reward?: number;
  // ===== HOSPITAL EXCLUSIVE =====
  // Nurse roach: healing allies
  healTimer?: number;
  healTargetId?: number | null;
  // Asphyxiation from insecticide spray
  asphyxiationTimer?: number;
  // Timed suicide roach: 5-second countdown
  explodeTimer?: number;
  isCountingDown?: boolean;
  countdownPaused?: boolean;
  // Heal buff: shows + icon above roach when healed by nurse
  healBuffTimer?: number;
  // ===== NURSE HEAL PHASE STATE MACHINE =====
  // Phase: 'idle' | 'charging' | 'spraying' | 'dissipating'
  healPhase?: 'idle' | 'charging' | 'spraying' | 'dissipating';
  // Phase timer (counts down)
  healPhaseTimer?: number;
  // AOE heal range (for rendering)
  healRange?: number;
  // Mutant roach: "Embryo Rampage" transformation system
  // Phase: 'idle' | 'pulse' | 'swelling' | 'burst' | 'remains'
  embryoPhase?: 'idle' | 'pulse' | 'swelling' | 'burst' | 'remains';
  // Phase timer
  embryoTimer?: number;
  // Embryo spawn list (stores types of roaches to spawn after burst)
  embryoSpawns?: RoachType[];
  // Flag set when this roach was spawned from mutant burst
  // (used for green slime tint overlay)
  wasMutantSpawn?: boolean;
  // Green slime overlay timer (1s)
  slimeTimer?: number;
  // Mutant spawn: 1-second spawn immunity (frozen + invincible)
  spawnImmuneTimer?: number;
  // Timed suicide roach: bomb placement state
  hasPlacedBomb?: boolean;
  placeTimer?: number;
  // ===== TIMED SUICIDE "螂家爆破" DEFENSE BREACH SYSTEM =====
  // Phase: 'idle' | 'warning' | 'crouching' | 'exploding' | 'residue'
  breachPhase?: 'idle' | 'warning' | 'crouching' | 'exploding' | 'residue';
  // Phase timer
  breachPhaseTimer?: number;
  // Crack spread radius (0~60, grows during crouching phase)
  crackRadius?: number;
  // Is bomb frozen by sticky board?
  isFrozen?: boolean;
  // Is killed by flame (quiet death, no explosion)?
  isFlameKilled?: boolean;
  // Residue fade timer (3s)
  residueTimer?: number;
}

export interface StickyDrop {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetId: number | null; // roach id being tracked
  speed: number;
  life: number;
  maxLife: number;
  size: number;
  hit: boolean;
}

export interface WeaponDrop {
  id: number;
  x: number;
  y: number;
  type: 'sticky' | 'poison' | 'shotgun' | 'molotov' | 'radar' | 'fan' | 'swatter';
  life: number;
  maxLife: number;
  bobPhase: number;
}

export interface RadarLaser {
  active: boolean;
  timer: number;
  duration: number;
  targetId: number | null;
  fireTimer: number;
  fireInterval: number;
  damage: number;
  laserAlpha: number;
  shotsRemaining: number; // total shots before deactivation
}

export interface Player {
  x: number;
  y: number;
  angle: number;
  isFiring: boolean;
  flameMode: FlameMode;
  gas: number;
  maxGas: number;
  heat: number;
  maxHeat: number;
  overheatTimer: number;
  isOverheated: boolean;
  isReloading: boolean;
  reloadTimer: number;
  maxReloadTime: number;
  coolingTimer: number;
  fireRange: number;
  damageMultiplier: number;
  heatDecayRate: number;
  overheatThreshold: number;
  gasCostMultiplier: number;
  // Weapon system
  currentWeapon: 'flamethrower' | 'sticky' | 'poison' | 'shotgun' | 'molotov';
  weaponAmmo: Record<string, number>;
  weaponTimer: number; // temp weapon duration
  isTempWeapon: boolean;
  shotgunPellets: number;
  molotovCount: number;
  // Active effects
  shieldActive: boolean;
  shieldHp: number;
  damageReduction: number;
  // Danmaku paralyze effect
  paralyzeTimer: number; // >0 = paralyzed, cannot move
  // Heat warning: 3-second countdown before overheat
  heatWarningTimer: number; // >0 = showing heat warning
  // Consumable temporary effects
  powerBoostTimer: number;     // >0 = 2x damage active (fire_boost consumable)
  shieldTimer: number;          // >0 = defense line invincible (shield consumable)
  baitTimer: number;            // >0 = roaches pulled to center (bait consumable)
  // Shop upgrade multipliers (DEPRECATED - kept for backwards compat)
  flameSpreadMultiplier: number;
  reloadTimeMultiplier: number;
}

// Consumable types for the in-level shop (one-time use items)
export type ConsumableType =
  | 'gas_refill'    // ¥250 - Refill gas to full
  | 'defense_repair' // ¥300 - Repair defense line +25 HP
  | 'emergency_cool' // ¥200 - Instantly clear overheat
  | 'power_boost'    // ¥700 - 2x damage for 10 seconds
  | 'shield'         // ¥800 - Defense line invincible for 5 seconds
  | 'bait';          // ¥450 - Pull all roaches toward center for 3 seconds

export interface ConsumableDef {
  id: ConsumableType;
  name: string;
  description: string;
  cost: number;
  icon: string; // image path for the consumable icon
  effectDesc: string;
  color: string;
  hardOnly?: boolean;
  cooldown?: number; // individual cooldown in seconds (0 or undefined = no cooldown)
}

export interface WaveConfig {
  wave: number;
  smallCount: number;
  largeCount: number;
  flyingCount: number;
  armoredCount: number;
  splittingCount: number;
  suicideCount: number;
  flyingSuicideCount: number;
  queenCount: number;
  speed: number;
  interval: number;
  clusterChance: number;
  // Hospital exclusive enemy counts
  nurseCount?: number;
  mutantCount?: number;
  timedSuicideCount?: number;
  // Hospital: number of active egg pools this wave (1-2)
  eggPoolActiveCount?: number;
}

export interface Economy {
  money: number;
  totalKills: number;
  smallKills: number;
  largeKills: number;
  flyingKills: number;
  armoredKills: number;
  splittingKills: number;
  suicideKills: number;
  queenKills: number;
  perfectWaves: number;
  gasSavedBonus: number;
  breaches: number;
  gasCanistersUsed: number;
  highestWave: number;
  highestEndlessWave: number;
  totalGamesPlayed: number;
  totalMoneyEarned: number;
}

export interface Upgrades {
  rangeBoost: boolean;
  overheatBoost: boolean;
  coolingBoost: boolean;
  damageBoost: boolean;
  speedBoost: boolean;
  gasBoost: boolean;
  shotgunUnlocked: boolean;
  freezeUnlocked: boolean;
  poisonUnlocked: boolean;
  molotovUnlocked: boolean;
}

export interface Talent {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  currentLevel: number;
  cost: number;
  effect: (level: number) => Record<string, number>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: string;
  unlocked: boolean;
  reward: number;
}

export interface SceneConfig {
  type: SceneType;
  name: string;
  description: string;
  bgColor: string;
  tileColors: [string, string];
  defenseLineColor: string;
  weather: WeatherType;
  enemyModifier: number;
  rewardMultiplier: number;
  bgImage?: string; // scene background image path (loaded dynamically)
}

export interface DialogLine {
  speaker: '蟑叔' | '你' | '螂老大';
  text: string;
  emotion?: 'normal' | 'happy' | 'scared' | 'serious' | 'excited';
}

export interface DialogConfig {
  sceneType: SceneType;
  title: string;
  bgImage: string;
  lines: DialogLine[];
}

export interface TalentTree {
  points: number;
  talents: Record<string, number>; // talentId -> level
}

// Increment this when breaking changes are made to GameProgress structure
// Changelog:
// v1: Initial save format
// v2: Added scenesCompleted field + persistent consumable inventory
export const SAVE_VERSION = 3;

export interface GameProgress {
  saveVersion: number;
  talentTree: TalentTree;
  achievements: Achievement[];
  highestWave: number;
  highestEndlessWave: number;
  totalKills: number;
  scenesUnlocked: SceneType[];
  // Optional fields for backwards compatibility with older save versions
  scenesCompleted?: SceneType[];
  weaponsUnlocked?: string[];
  encyclopedia?: EncyclopediaData;
  // Shop upgrades persist across scenes in a single session
  shopUpgrades?: string[];
  // Consumable inventory (v3: moved from separate localStorage to GameProgress)
  consumableInventory?: Record<string, number>;
  autoUseEnabled?: Record<string, boolean>;
}

export interface EncyclopediaEntry {
  id: string;
  name: string;
  type: RoachType;
  image: string;
  description: string;
  funFact: string;
  hp: number;
  speed: number;
  special: string;
  killCount: number;
  unlocked: boolean;
}

export interface EncyclopediaData {
  entries: EncyclopediaEntry[];
}
