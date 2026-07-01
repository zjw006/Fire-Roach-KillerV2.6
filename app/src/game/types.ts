/**
 * @fileoverview 游戏核心类型定义模块
 * @description 定义《烈焰除蟑》所有核心数据结构、枚举类型与接口，供引擎与 UI 层共享使用。
 */

/** 二维向量 */
export interface Vec2 {
  x: number;
  y: number;
}

/** 游戏全局状态枚举 */
export const GameState = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  WAVE_CLEAR: 'wave_clear',
  ITEM_DROP: 'item_drop',       // 战后道具掉落在场上，等待玩家点击拾取
  ITEM_REVEAL: 'item_reveal',   // 战后道具展示（蟑叔对话介绍）
  SHOP: 'shop',
  TALENT_TREE: 'talent_tree',
  ACHIEVEMENTS: 'achievements',
  COUNTDOWN: 'countdown',       // 每波开始前 3-2-1 倒计时
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

/** 游戏模式枚举 */
export const GameMode = {
  STORY: 'story',
  ENDLESS: 'endless',
  DAILY: 'daily',
  BOSS: 'boss',
} as const;
export type GameMode = typeof GameMode[keyof typeof GameMode];

/** 火焰喷射模式枚举 */
export const FlameMode = {
  CONE: 'cone',
  FAN: 'fan',
  PULSE: 'pulse',
  SHOTGUN: 'shotgun',
  STICKY: 'sticky',
  POISON: 'poison',
} as const;
export type FlameMode = typeof FlameMode[keyof typeof FlameMode];

/** 蟑螂敌人类型枚举 */
export const RoachType = {
  SMALL: 'small',
  LARGE: 'large',
  FLYING: 'flying',
  ARMORED: 'armored',
  SPLITTING: 'splitting',
  SUICIDE: 'suicide',
  FLYING_SUICIDE: 'flying_suicide',
  QUEEN: 'queen',
  // 医院场景专属蟑螂
  NURSE: 'nurse',
  MUTANT: 'mutant',
  TIMED_SUICIDE: 'timed_suicide',
} as const;
export type RoachType = typeof RoachType[keyof typeof RoachType];

/** 蟑螂生命状态枚举 */
export const RoachState = {
  ALIVE: 'alive',
  BURNING: 'burning',
  DEAD: 'dead',
  FROZEN: 'frozen',
  POISONED: 'poisoned',
} as const;
export type RoachState = typeof RoachState[keyof typeof RoachState];

/** 敌人基础属性定义 */
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

/** 游戏场景类型枚举 */
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

/** 天气效果枚举 */
export const WeatherType = {
  NONE: 'none',
  RAIN: 'rain',
  FOG: 'fog',
  NIGHT: 'night',
} as const;
export type WeatherType = typeof WeatherType[keyof typeof WeatherType];

/** 粒子特效类型枚举 */
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

/** 粒子实例数据 */
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
  /** 可选：渲染文字而非图形（用于浮动数值、图标等） */
  text?: string;
  textColor?: string;
  /** 变异蟑螂出生时是否带有绿色粘液特效 */
  isSlime?: boolean;
}

/** 火焰/毒/冰区域数据 */
export interface FireZone {
  x: number;
  y: number;
  radius: number;
  damagePerSecond: number;
  life: number;
  maxLife: number;
  type?: 'fire' | 'poison' | 'ice';
}

/** 火墙数据（燃烧瓶制造的水平火焰墙） */
export interface FireWall {
  y: number;
  x1: number;
  x2: number;
  height: number;
  damagePerSecond: number;
  life: number;
  maxLife: number;
}

/** 风扇状态数据 */
export interface FanState {
  active: boolean;
  timer: number;
  duration: number;
  /** 减速系数（0.0~1.0） */
  slowFactor: number;
  bladeAngle: number;
  bladeSpeed: number;
}

/** 蟑螂贴板数据 */
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

/** 可投掷抛射物数据 */
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

/** 道具栏物品 */
export interface InventoryItem {
  type: 'sticky' | 'poison' | 'molotov' | 'shotgun' | 'radar' | 'fan' | 'swatter';
  count: number;
}

/** 三重火焰状态 */
export interface TripleFlameState {
  active: boolean;
  timer: number;
  duration: number;
  /** 侧枪与中心枪的距离 */
  sideOffset: number;
  sideDamageMult: number;
}

// [REMOVED] EggPod system completely removed
// export interface EggPod { ... }

/** Boss 战完整状态数据 */
export interface BossBattleState {
  active: boolean;
  bossHp: number;
  bossMaxHp: number;
  phase: 1 | 2 | 3 | 4;
  phaseName: string;
  timeLimit: number;
  timeRemaining: number;
  currentWave: number;
  waveCleared: boolean;
  waveSpawnTimer: number;
  bossDialogue: string;
  dialogueTimer: number;
  dialogueIndex: number;
  // ===== 胜利/失败 =====
  bossKilled: boolean;
  bossFleeing: boolean;
  bossFleeTimer: number;
  deathAnimTimer: number;
  corpseStayTimer: number;
  phaseJustChanged: boolean;
  phaseChangeTimer: number;
  phaseChangeText: string;
  phaseChangeSub: string;
  // 遗留字段
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
  /** Boss 施法动画计时器（下蛋前） */
  summonCastTimer: number;
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

/** 蜕皮空壳（可作为障碍物） */
export interface ShedShell {
  x: number;
  y: number;
  size: number;
  alpha: number;
  /** 存在时间（秒） */
  life: number;
}

/** 单个蟑螂敌人实例数据 */
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
  // Mutant transformation timer
  transformTimer?: number;
  // Has transformed flag
  hasTransformed?: boolean;
}

/** 自动追踪粘板弹丸 */
export interface StickyDrop {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 追踪目标蟑螂 ID */
  targetId: number | null;
  speed: number;
  life: number;
  maxLife: number;
  size: number;
  hit: boolean;
}

/** 场上可拾取的武器掉落物 */
export interface WeaponDrop {
  id: number;
  x: number;
  y: number;
  type: 'sticky' | 'poison' | 'shotgun' | 'molotov' | 'radar' | 'fan' | 'swatter';
  life: number;
  maxLife: number;
  bobPhase: number;
}

/** 雷达激光状态 */
export interface RadarLaser {
  active: boolean;
  timer: number;
  duration: number;
  targetId: number | null;
  fireTimer: number;
  fireInterval: number;
  damage: number;
  laserAlpha: number;
  /** 剩余可发射次数 */
  shotsRemaining: number;
}

/** 玩家状态数据 */
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
  // 消耗品临时效果
  /** 火力 boost 剩余时间（秒），>0 时伤害翻倍 */
  powerBoostTimer: number;
  /** 防线护盾剩余时间（秒），>0 时防线无敌 */
  shieldTimer: number;
  /** 诱饵剩余时间（秒），>0 时蟑螂被拉向中心 */
  baitTimer: number;
  // 商店升级乘数（已弃用，保留用于向后兼容）
  flameSpreadMultiplier: number;
  reloadTimeMultiplier: number;
  // 新增属性
  weaponsUnlocked: string[];
  money: number;
  weaponUpgrades?: WeaponUpgrade[];
  flameDamage?: number;
  flameRange?: number;
  flameSpeed?: number;
  flameAmmo?: number;
  shotgunSpread?: number;
  stickyDuration?: number;
  poisonCloudSize?: number;
  molotovDuration?: number;
}

/** 关卡内商店消耗品类型（一次性使用道具） */
export type ConsumableType =
  | 'gas_refill'    // 燃气回满
  | 'defense_repair' // 防线修复 +25 HP
  | 'emergency_cool' // 立即清除过热
  | 'power_boost'    // 10 秒内双倍伤害
  | 'shield'         // 防线 5 秒无敌
  | 'bait';          // 3 秒内全场蟑螂聚拢

/** 消耗品定义 */
export interface ConsumableDef {
  id: ConsumableType;
  name: string;
  description: string;
  cost: number;
  /** 图标图片路径 */
  icon: string;
  effectDesc: string;
  color: string;
  hardOnly?: boolean;
  /** 个体冷却时间（秒），0 或 undefined 表示无冷却 */
  cooldown?: number;
}

/** 单波次敌人配置 */
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
  // 医院场景专属敌人数目
  nurseCount?: number;
  mutantCount?: number;
  timedSuicideCount?: number;
  /** 本波激活的虫卵池数量（1~2） */
  eggPoolActiveCount?: number;
  /** 敌人生成间隔（秒） */
  spawnInterval?: number;
  /** 波次名称 */
  name?: string;
}

/** 经济统计与成就追踪数据 */
export interface Economy {
  money: number;
  totalKills: number;
  smallKills: number;
  largeKills: number;
  flyingKills: number;
  armoredKills: number;
  splittingKills: number;
  suicideKills: number;
  flyingSuicideKills: number;
  queenKills: number;
  nurseKills: number;
  mutantKills: number;
  timedSuicideKills: number;
  perfectWaves: number;
  gasSavedBonus: number;
  breaches: number;
  gasCanistersUsed: number;
  highestWave: number;
  highestEndlessWave: number;
  totalGamesPlayed: number;
  totalMoneyEarned: number;
  totalDamage: number;
  totalMoneySpent: number;
  totalConsumablesUsed: number;
  totalWeaponsUnlocked: number;
  totalUpgradesPurchased: number;
  totalAchievements: number;
}

/** 商店升级解锁状态 */
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

/** 天赋定义 */
export interface Talent {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  currentLevel: number;
  cost: number;
  effect: (level: number) => Record<string, number>;
}

/** 成就定义 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: string;
  unlocked: boolean;
  reward: number;
  /** 是否已完成 */
  completed?: boolean;
}

/** 场景配置数据 */
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
  /** 场景背景图片路径（动态加载） */
  bgImage?: string;
}

/** 单句对话数据 */
export interface DialogLine {
  speaker: '蟑叔' | '你' | '螂老大' | '螂老大（管道回声）' | '螂老大（闪电中现身）' | '螂老大（街对面）' | '螂老大（翅膀展开）';
  text: string;
  emotion?: 'normal' | 'happy' | 'scared' | 'serious' | 'excited';
}

/** 场景对话配置 */
export interface DialogConfig {
  sceneType: SceneType;
  title: string;
  bgImage: string;
  lines: DialogLine[];
}

/** 天赋树数据 */
export interface TalentTree {
  points: number;
  /** talentId -> 当前等级 */
  talents: Record<string, number>;
}

/**
 * 存档版本号，数据结构发生破坏性变更时递增
 * 变更日志：
 * v1: 初始存档格式
 * v2: 新增 scenesCompleted 字段 + 持久化消耗品库存
 * v3: 消耗品库存移至 GameProgress
 */
export const SAVE_VERSION = 3;

/** 游戏进度存档数据 */
export interface GameProgress {
  saveVersion: number;
  talentTree: TalentTree;
  achievements: Achievement[];
  highestWave: number;
  highestEndlessWave: number;
  totalKills: number;
  scenesUnlocked: SceneType[];
  /** 兼容旧版本的可选字段 */
  scenesCompleted?: SceneType[];
  weaponsUnlocked?: string[];
  unlockedItems?: string[];
  encyclopedia?: EncyclopediaData;
  /** 同局内跨关卡保留的商店升级列表 */
  shopUpgrades?: string[];
  /** 消耗品库存（v3 起从独立 localStorage 移至 GameProgress） */
  consumableInventory?: Record<string, number>;
  autoUseEnabled?: Record<string, boolean>;
}

/** 图鉴单条条目 */
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

/** 图鉴数据 */
export interface EncyclopediaData {
  entries: EncyclopediaEntry[];
}

/** 浮动文字效果 */
export interface FloatingText {
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

/** 武器升级配置 */
export interface WeaponUpgrade {
  id: string;
  level: number;
  value: number;
  type: 'damage' | 'range' | 'speed' | 'ammo' | 'special';
}
