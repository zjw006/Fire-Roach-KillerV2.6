import { RoachType, SceneType, WeatherType, SAVE_VERSION, type SceneConfig, type Talent, type Achievement, type GameProgress, type DialogConfig, type EncyclopediaEntry, type WaveConfig, type ConsumableDef } from './types';

// ========== SCENE CONFIGURATIONS ==========
export const SCENE_CONFIGS: Record<SceneType, SceneConfig> = {
  [SceneType.KITCHEN]: {
    type: SceneType.KITCHEN,
    name: '恐怖厨房',
    description: '蟑螂的老巢，一切的开始',
    bgColor: '#16162a',
    tileColors: ['#1a1a30', '#18182c'],
    defenseLineColor: 'rgba(239, 68, 68, 0.7)',
    weather: WeatherType.NONE,
    enemyModifier: 1,
    rewardMultiplier: 1,
  },
  [SceneType.SEWER]: {
    type: SceneType.SEWER,
    name: '阴暗下水道',
    description: '狭窄的管道中蟑螂更加密集',
    bgColor: '#0a1a0a',
    tileColors: ['#0d1f0d', '#0b1a0b'],
    defenseLineColor: 'rgba(100, 200, 100, 0.7)',
    weather: WeatherType.RAIN,
    enemyModifier: 1.3,
    rewardMultiplier: 1.2,
  },
  [SceneType.DUMP]: {
    type: SceneType.DUMP,
    name: '垃圾场',
    description: '废弃的垃圾山中隐藏着变异蟑螂',
    bgColor: '#1a1508',
    tileColors: ['#1f190b', '#1a1508'],
    defenseLineColor: 'rgba(200, 150, 50, 0.7)',
    weather: WeatherType.FOG,
    enemyModifier: 1.3,
    rewardMultiplier: 1.5,
  },
  [SceneType.BASEMENT]: {
    type: SceneType.BASEMENT,
    name: '地下室',
    description: '黑暗潮湿的地下室，蟑螂的天堂',
    bgColor: '#0a0a1a',
    tileColors: ['#0d0d1f', '#0a0a1a'],
    defenseLineColor: 'rgba(150, 100, 255, 0.7)',
    weather: WeatherType.NIGHT,
    enemyModifier: 1.5,
    rewardMultiplier: 1.8,
  },
  [SceneType.ROOFTOP]: {
    type: SceneType.ROOFTOP,
    name: '天台决战',
    description: '最终战场，面对蟑螂女王的巢穴',
    bgColor: '#1a0a1a',
    tileColors: ['#1f0d1f', '#1a0a1a'],
    defenseLineColor: 'rgba(255, 100, 200, 0.7)',
    weather: WeatherType.NIGHT,
    enemyModifier: 1.7,
    rewardMultiplier: 2.0,
  },
  [SceneType.STREET]: {
    type: SceneType.STREET,
    name: '城市街道',
    description: '赛博朋克都市的最终决战',
    bgColor: '#0a0a12',
    tileColors: ['#0d0d18', '#0a0a15'],
    defenseLineColor: 'rgba(200, 60, 20, 0.7)',
    weather: WeatherType.RAIN,
    enemyModifier: 1.9,
    rewardMultiplier: 2.0,
  },
  [SceneType.HOSPITAL]: {
    type: SceneType.HOSPITAL,
    name: '废弃医院',
    description: '阴暗的走廊中弥漫着消毒水和蟑螂的气味',
    bgColor: '#0a1210',
    tileColors: ['#0d1815', '#0a1210'],
    defenseLineColor: 'rgba(100, 220, 180, 0.7)',
    weather: WeatherType.NONE,
    enemyModifier: 2.1,
    rewardMultiplier: 2.5,
    bgImage: '/assets/bg_hospital.jpg',
  },
  [SceneType.SUBWAY]: {
    type: SceneType.SUBWAY,
    name: '废弃地铁',
    description: '漆黑的隧道中蟑螂如潮水般涌来',
    bgColor: '#0a0a10',
    tileColors: ['#0d0d14', '#0a0a10'],
    defenseLineColor: 'rgba(180, 160, 100, 0.7)',
    weather: WeatherType.NIGHT,
    enemyModifier: 2.3,
    rewardMultiplier: 4,
    bgImage: '/assets/bg_subway.jpg',
  },
  [SceneType.SUPERMARKET]: {
    type: SceneType.SUPERMARKET,
    name: '废弃超市',
    description: '货架间隐藏着变异蟑螂的巢穴',
    bgColor: '#121008',
    tileColors: ['#18140b', '#121008'],
    defenseLineColor: 'rgba(220, 180, 60, 0.7)',
    weather: WeatherType.NONE,
    enemyModifier: 2.5,
    rewardMultiplier: 4.5,
    bgImage: '/assets/bg_supermarket.jpg',
  },
  [SceneType.SCHOOL]: {
    type: SceneType.SCHOOL,
    name: '废弃学校',
    description: '教室和走廊中蟑螂成群结队',
    bgColor: '#0a1018',
    tileColors: ['#0d141d', '#0a1018'],
    defenseLineColor: 'rgba(80, 140, 220, 0.7)',
    weather: WeatherType.RAIN,
    enemyModifier: 2.7,
    rewardMultiplier: 5,
    bgImage: '/assets/bg_school.jpg',
  },
  [SceneType.NEST]: {
    type: SceneType.NEST,
    name: '蟑螂巢穴',
    description: '终极战场——蟑螂帝国的心脏',
    bgColor: '#1a0808',
    tileColors: ['#1f0d0d', '#1a0808'],
    defenseLineColor: 'rgba(255, 50, 50, 0.7)',
    weather: WeatherType.FOG,
    enemyModifier: 3.0,
    rewardMultiplier: 6,
    bgImage: '/assets/bg_nest.jpg',
  },
};

// ========== ENEMY DEFINITIONS ==========
export const ENEMY_DEFS: Record<RoachType, {
  name: string;
  description: string;
  hp: number;
  speed: number;
  reward: number;
  color: string;
  size: number;
  special: string[];
}> = {
  [RoachType.SMALL]: {
    name: '小蟑螂',
    description: '快速但脆弱',
    hp: 1,
    speed: 1,
    reward: 1,
    color: '#5a3a2a',
    size: 28,
    special: [],
  },
  [RoachType.LARGE]: {
    name: '大蟑螂',
    description: '血量更多，更加耐打',
    hp: 4,
    speed: 0.8,
    reward: 5,
    color: '#7a4a3a',
    size: 40,
    special: ['enrage'],
  },
  [RoachType.FLYING]: {
    name: '飞行蟑螂',
    description: '从空中掠过，速度极快',
    hp: 2,
    speed: 2.4,
    reward: 4,
    color: '#4a5a6a',
    size: 32,
    special: ['flying', 'dodge'],
  },
  [RoachType.ARMORED]: {
    name: '装甲蟑螂',
    description: '厚重的甲壳需要多次攻击，破损后露出本体',
    hp: 12,
    speed: 0.5,
    reward: 8,
    color: '#5a5a5a',
    size: 76,
    special: ['armor', 'damage_reduction'],
  },
  [RoachType.SPLITTING]: {
    name: '分裂蟑螂',
    description: '死亡时会分裂成两只小蟑螂',
    hp: 6,
    speed: 0.7,
    reward: 10,
    color: '#6a4a6a',
    size: 42,
    special: ['split_on_death'],
  },
  [RoachType.SUICIDE]: {
    name: '自爆蟑螂',
    description: '背着炸弹的高速蟑螂，呈Z字形游走靠近防线，靠近时自爆造成范围伤害',
    hp: 2,
    speed: 1.4,
    reward: 6,
    color: '#8a3a2a',
    size: 60,
    special: ['suicide', 'explode'],
  },
  [RoachType.FLYING_SUICIDE]: {
    name: '飞行自爆蟑螂',
    description: '飞行蟑螂背部安装炸弹，兼具飞行速度和自爆攻击能力。靠近防线时俯冲自爆',
    hp: 2,
    speed: 2.2,
    reward: 8,
    color: '#7a3a5a',
    size: 55,
    special: ['flying', 'suicide', 'explode'],
  },
  [RoachType.QUEEN]: {
    name: '蟑螂女王',
    description: 'Boss级敌人，会不断召唤小蟑螂',
    hp: 100,
    speed: 0.3,
    reward: 100,
    color: '#8a2a6a',
    size: 160,
    special: ['boss', 'spawn_minions', 'resist_fire'],
  },
  // ========== HOSPITAL EXCLUSIVE ROACHES ==========
  [RoachType.NURSE]: {
    name: '护士蟑螂',
    description: '携带医疗包的蟑螂，定期为周围受伤蟑螂恢复15%HP。对杀虫剂极度敏感，接触后窒息8秒。自带红色护盾',
    hp: 25,
    speed: 0.8,
    reward: 28,
    color: '#4ade80',
    size: 78, // 1.5x from 52
    special: ['heal_ally', 'insecticide_vulnerable', 'red_shield'],
  },
  [RoachType.MUTANT]: {
    name: '变异蟑螂',
    description: '经过辐射变异的蟑螂，死亡时释放强腐蚀性酸液，屏幕被绿色干扰2.5秒',
    hp: 8,
    speed: 0.5,
    reward: 22,
    color: '#84cc16',
    size: 38,
    special: ['distort_on_death', 'acid_splash'],
  },
  [RoachType.TIMED_SUICIDE]: {
    name: '定时自爆蟑螂',
    description: '到达防线前64px放置炸弹，2秒后变身大蟑螂。被杀死后尸体原地爆炸',
    hp: 30,
    speed: 1.4,
    reward: 40,
    color: '#f59e0b',
    size: 60,
    special: ['shield', 'bomb_placement', 'transform_large'],
  },
};

// ========== TALENT DEFINITIONS ==========
export const TALENT_DEFS: Talent[] = [
  {
    id: 'fire_damage',
    name: '火焰强化',
    description: '火焰伤害 +15%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 100,
    effect: (level) => ({ damageMultiplier: 1 + level * 0.15 }),
  },
  {
    id: 'fire_range',
    name: '射程延伸',
    description: '火焰射程 +10%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 120,
    effect: (level) => ({ fireRangeMultiplier: 1 + level * 0.1 }),
  },
  {
    id: 'gas_capacity',
    name: '扩容气罐',
    description: '燃气容量 +20%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 80,
    effect: (level) => ({ gasMultiplier: 1 + level * 0.2 }),
  },
  {
    id: 'overheat_resist',
    name: '耐热改造',
    description: '过热阈值 +20%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 150,
    effect: (level) => ({ overheatMultiplier: 1 + level * 0.2 }),
  },
  {
    id: 'cool_speed',
    name: '快速冷却',
    description: '冷却速度 +15%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 100,
    effect: (level) => ({ coolingMultiplier: 1 + level * 0.15 }),
  },
  {
    id: 'defense_hp',
    name: '防线加固',
    description: '防线 HP +25%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 200,
    effect: (level) => ({ defenseMultiplier: 1 + level * 0.25 }),
  },
  // ===== 道具专精分支 (v1.2 新增) =====
  {
    id: 'fire_affinity',
    name: '火焰亲和',
    description: '燃烧瓶/火墙伤害 +10%',
    maxLevel: 3,
    currentLevel: 0,
    cost: 250,
    effect: (level) => ({ fireDamage: 1 + level * 0.10 }),
  },
  {
    id: 'mechanical_mastery',
    name: '机械精通',
    description: '风扇减速 +5%, 持续时间 +10%',
    maxLevel: 3,
    currentLevel: 0,
    cost: 250,
    effect: (level) => ({ fanSlow: 1 + level * 0.05, fanDuration: 1 + level * 0.10 }),
  },
  {
    id: 'explosive_expert',
    name: '爆炸专家',
    description: '燃烧瓶爆炸范围 +15%',
    maxLevel: 3,
    currentLevel: 0,
    cost: 250,
    effect: (level) => ({ explosionRange: 1 + level * 0.15 }),
  },
  {
    id: 'resource_saver',
    name: '节约大师',
    description: '所有道具拾取时弹药量 +1',
    maxLevel: 3,
    currentLevel: 0,
    cost: 200,
    effect: (level) => ({ itemAmmo: level }),
  },
  {
    id: 'money_boost',
    name: '赏金猎人',
    description: '击杀奖励 +10%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 150,
    effect: (level) => ({ rewardMultiplier: 1 + level * 0.1 }),
  },
  {
    id: 'freeze_weapon',
    name: '冷冻武器',
    description: '解锁冷冻喷雾模式',
    maxLevel: 1,
    currentLevel: 0,
    cost: 500,
    effect: () => ({ unlockFreeze: 1 }),
  },
  {
    id: 'poison_weapon',
    name: '毒气武器',
    description: '解锁毒气弹模式',
    maxLevel: 1,
    currentLevel: 0,
    cost: 500,
    effect: () => ({ unlockPoison: 1 }),
  },
  {
    id: 'shotgun_weapon',
    name: '散弹模式',
    description: '解锁散弹喷射模式',
    maxLevel: 1,
    currentLevel: 0,
    cost: 600,
    effect: () => ({ unlockShotgun: 1 }),
  },
  {
    id: 'molotov_weapon',
    name: '燃烧瓶',
    description: '解锁燃烧瓶投掷',
    maxLevel: 1,
    currentLevel: 0,
    cost: 800,
    effect: () => ({ unlockMolotov: 1 }),
  },
];

// ========== ACHIEVEMENT DEFINITIONS ==========
export const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked'>[] = [
  {
    id: 'first_blood',
    name: '首杀',
    description: '消灭第一只蟑螂',
    condition: 'totalKills >= 1',
    reward: 50,
  },
  {
    id: 'roach_slayer',
    name: '蟑螂杀手',
    description: '累计消灭100只蟑螂',
    condition: 'totalKills >= 100',
    reward: 200,
  },
  {
    id: 'roach_exterminator',
    name: '灭蟑专家',
    description: '累计消灭1000只蟑螂',
    condition: 'totalKills >= 1000',
    reward: 1000,
  },
  {
    id: 'wave_5',
    name: '坚守阵地',
    description: '到达第5波',
    condition: 'highestWave >= 5',
    reward: 100,
  },
  {
    id: 'wave_10',
    name: '终极守卫',
    description: '通关全部10波',
    condition: 'highestWave >= 10',
    reward: 500,
  },
  {
    id: 'endless_20',
    name: '无尽勇士',
    description: '无尽模式到达20波',
    condition: 'highestEndlessWave >= 20',
    reward: 500,
  },
  {
    id: 'endless_50',
    name: '无尽传说',
    description: '无尽模式到达50波',
    condition: 'highestEndlessWave >= 50',
    reward: 2000,
  },
  {
    id: 'money_1000',
    name: '小有积蓄',
    description: '累计获得1000资金',
    condition: 'totalMoneyEarned >= 1000',
    reward: 200,
  },
  {
    id: 'perfect_wave',
    name: '完美防御',
    description: '完成一波 without any breach',
    condition: 'perfectWaves >= 1',
    reward: 100,
  },
  {
    id: 'no_breach',
    name: '铜墙铁壁',
    description: '通关10波 without any breach',
    condition: 'breaches == 0 and highestWave >= 10',
    reward: 1000,
  },
  {
    id: 'kill_queen',
    name: '女王终结者',
    description: '消灭蟑螂女王',
    condition: 'queenKills >= 1',
    reward: 500,
  },
  {
    id: 'kill_flying',
    name: '空中猎手',
    description: '消灭50只飞行蟑螂',
    condition: 'flyingKills >= 50',
    reward: 300,
  },
  {
    id: 'kill_armored',
    name: '破甲大师',
    description: '消灭30只装甲蟑螂',
    condition: 'armoredKills >= 30',
    reward: 400,
  },
  {
    id: 'weapon_master',
    name: '武器大师',
    description: '解锁所有特殊武器',
    condition: 'allWeaponsUnlocked',
    reward: 1000,
  },
  {
    id: 'talent_first',
    name: '初出茅庐',
    description: '第一次升级天赋',
    condition: 'talentPointsSpent >= 1',
    reward: 100,
  },
];

// ========== DEFAULT PROGRESS ==========
export function createDefaultProgress(): GameProgress {
  return {
    saveVersion: SAVE_VERSION,
    talentTree: {
      points: 0,
      talents: {},
    },
    achievements: ACHIEVEMENT_DEFS.map(a => ({ ...a, unlocked: false })),
    highestWave: 0,
    highestEndlessWave: 0,
    totalKills: 0,
    scenesUnlocked: [SceneType.KITCHEN],
    scenesCompleted: [],
    weaponsUnlocked: ['flamethrower', 'sticky'],
    encyclopedia: {
      entries: ENCYCLOPEDIA_DEFS.map(e => ({ ...e })),
    },
    shopUpgrades: [],
    consumableInventory: {},
    autoUseEnabled: {},
  };
}

// ========== DIALOG CONFIGS ==========
// Each scene introduces a new roach type and a new item
export const DIALOG_CONFIGS: DialogConfig[] = [
  // Scene 1: Kitchen
  {
    sceneType: SceneType.KITCHEN,
    title: '第一关：厨房',
    bgImage: '/assets/bg.jpg',
    lines: [
      { speaker: '蟑叔', text: '欢迎参加"厨房除虫嘉年华"！蟑螂密度五倍，按只提成！', emotion: 'happy' },
      { speaker: '你', text: '油烟机上的油比蟑螂厚。' },
      { speaker: '蟑叔', text: '油是小事！给你【火焰喷射器】，一喷变烧烤！……客户没买保险，所以快打！', emotion: 'excited' },
    ],
  },
  // Scene 2: Sewer
  {
    sceneType: SceneType.SEWER,
    title: '第二关：下水道',
    bgImage: '/assets/sewer_bg.jpg',
    lines: [
      { speaker: '蟑叔', text: '这地方像我二舅诊所，就是没这么多腿毛。下雨天蟑螂冲浪，速度贼快！', emotion: 'normal' },
      { speaker: '你', text: '你在发抖。' },
      { speaker: '蟑叔', text: '冷！给你【贴板陷阱】，铺水流必经之地，冲浪板变停尸板！', emotion: 'excited' },
      { speaker: '螂老大（管道回声）', text: '张螂……本皇听见你了……' },
      { speaker: '蟑叔', text: '别理，下水道广播坏了，继续铺！', emotion: 'normal' },
    ],
  },
  // Scene 3: Dump
  {
    sceneType: SceneType.DUMP,
    title: '第三关：垃圾场',
    bgImage: '/assets/bg_dump.jpg',
    lines: [
      { speaker: '蟑叔', text: '欢迎来到蟑螂"山姆会员店"！能见度两米，建议牵着我衣角……哎我衣角呢？', emotion: 'happy' },
      { speaker: '你', text: '你在我前面三米。' },
      { speaker: '蟑叔', text: '哦。给你【燃烧瓶】，扔出去就是火墙！对了，别往红色冰箱后走，上一个临时工……', emotion: 'normal' },
      { speaker: '你', text: '失踪了？' },
      { speaker: '蟑叔', text: '不，他在里面找到了过期可乐，现在还在厕所。', emotion: 'happy' },
    ],
  },
  // Scene 4: Basement
  {
    sceneType: SceneType.BASEMENT,
    title: '第四关：地下室',
    bgImage: '/assets/bg_basement.jpg',
    lines: [
      { speaker: '蟑叔', text: '轰隆！刺激吧？闪电亮时记位置，黑下去时放陷阱！', emotion: 'excited' },
      { speaker: '你', text: '每次闪电我都以为你要现原形。' },
      { speaker: '蟑叔', text: '现原形的是它们！给你【夜视仪】，戴上后蟑螂像圣诞树！', emotion: 'happy' },
      { speaker: '螂老大（闪电中现身）', text: '张螂……你烧毁了本皇在7号楼的温床……' },
      { speaker: '蟑叔', text: '7号楼？那单客户只给了80，我还嫌少。你谁啊？', emotion: 'normal' },
    ],
  },
  // Scene 5: Street
  {
    sceneType: SceneType.STREET,
    title: '第五关：街道',
    bgImage: '/assets/bg_street.jpg',
    lines: [
      { speaker: '螂老大（街对面）', text: '张螂！本皇观察你很久了！你是人类最顽固的灭蟑者！' },
      { speaker: '蟑叔', text: '观察我？你欠我钱？', emotion: 'normal' },
      { speaker: '螂老大', text: '三个月前，你烧毁了本皇的孵化室！' },
      { speaker: '蟑叔', text: '哦，那单客户只给了80。你这帝国挺便宜的。', emotion: 'happy' },
      { speaker: '你', text: '……它好像哭了。' },
    ],
  },
  // Scene 6: Rooftop
  {
    sceneType: SceneType.ROOFTOP,
    title: '第六关：天台',
    bgImage: '/assets/bg_rooftop.jpg',
    lines: [
      { speaker: '蟑叔', text: '年轻人……大场面……真正的大场面……', emotion: 'scared' },
      { speaker: '螂老大（翅膀展开）', text: '张螂！今夜终结你的暴政！' },
      { speaker: '蟑叔', text: '终结前能开发票吗？不开发票得加钱。', emotion: 'normal' },
      { speaker: '你', text: '它不会开的。' },
      { speaker: '蟑叔', text: '所以！给你【斩螂·110】！重二两，锋110点！砍骨如切黄油！', emotion: 'excited' },
      { speaker: '你', text: '为什么叫110？' },
      { speaker: '蟑叔', text: '因为遇到它，你得报警！……为了报销！冲啊！', emotion: 'excited' },
      { speaker: '螂老大', text: '又是报销！！！' },
    ],
  },
  // Scene 7: Hospital - New roach types + egg pool system
  {
    sceneType: SceneType.HOSPITAL,
    title: '第七关：废弃医院',
    bgImage: '/assets/bg_hospital.jpg',
    lines: [
      { speaker: '蟑叔', text: '等等……你闻到没有？消毒水味。' },
      { speaker: '你', text: '……所长，您管这种阴森森的废弃医院叫"消毒水味"？这分明是停尸房的味道。' },
      { speaker: '蟑叔', text: '嘿嘿，新敌人——【护士蟑螂】！背着医疗包的蟑螂，每5秒给周围3格内最低血量的蟑螂回血20%！', emotion: 'normal' },
      { speaker: '蟑叔', text: '还有【变异蟑螂】！死亡时释放强腐蚀性酸液，屏幕绿色干扰3秒！千万别在视野不好的时候贪刀！', emotion: 'serious' },
      { speaker: '蟑叔', text: '最可怕的是【定时自爆蟑螂】！背着精密定时炸弹，5秒必爆！不过好消息是——蟑螂贴板能暂停它的倒计时！', emotion: 'scared' },
      { speaker: '你', text: '定时炸弹？！蟑螂界已经发展到这种军工水平了吗？' },
      { speaker: '蟑叔', text: '小心【虫卵孵化池】！每波可能在6个固定位置生成，5秒倒计时，孵化3只变异蟑螂！', emotion: 'serious' },
      { speaker: '蟑叔', text: '摧毁虫卵有消毒奖励——连续摧毁3个，燃气全满+清除所有异常状态！', emotion: 'happy' },
      { speaker: '你', text: '……所长，您确定这不是在打游戏副本吗？' },
      { speaker: '蟑叔', text: '副本？不不不，这是你的工作！发票开"医疗废弃物处理费"，走！', emotion: 'happy' },
    ],
  },
];

// ========== SCENE-SPECIFIC WAVE CONFIGS (Story Mode - progressive difficulty) ==========
// Each scene introduces new roach types + new items, difficulty increases per scene

// Scene 1: Kitchen - Small + Large roaches only, slow, few numbers
export const WAVE_CONFIGS_KITCHEN: WaveConfig[] = [
  { wave: 1, smallCount: 8,  largeCount: 0, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.35, interval: 14, clusterChance: 0 },
  { wave: 2, smallCount: 14, largeCount: 1, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.38, interval: 12, clusterChance: 0 },
  { wave: 3, smallCount: 22, largeCount: 3, flyingCount: 1, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.42, interval: 10, clusterChance: 0.05 },
  { wave: 4, smallCount: 30, largeCount: 5, flyingCount: 1, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.47, interval: 9,  clusterChance: 0.1 },
  { wave: 5, smallCount: 38, largeCount: 7, flyingCount: 2, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.52, interval: 8,  clusterChance: 0.15 },
  { wave: 6, smallCount: 45, largeCount: 8, flyingCount: 3, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.58, interval: 7,  clusterChance: 0.2 },
];

// Scene 2: Sewer - Adds Flying roaches, 5 waves, increasing difficulty
export const WAVE_CONFIGS_SEWER: WaveConfig[] = [
  { wave: 1, smallCount: 12, largeCount: 2, flyingCount: 5,  armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.55, interval: 12, clusterChance: 0 },
  { wave: 2, smallCount: 20, largeCount: 3, flyingCount: 7,  armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.65, interval: 10, clusterChance: 0.05 },
  { wave: 3, smallCount: 30, largeCount: 5, flyingCount: 9,  armoredCount: 1, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.75, interval: 9,  clusterChance: 0.1 },
  { wave: 4, smallCount: 40, largeCount: 6, flyingCount: 11, armoredCount: 1, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.85, interval: 8,  clusterChance: 0.2 },
  { wave: 5, smallCount: 48, largeCount: 8, flyingCount: 13, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.95, interval: 7,  clusterChance: 0.3 },
  { wave: 6, smallCount: 55, largeCount: 9, flyingCount: 15, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 1.0,  interval: 6,  clusterChance: 0.35 },
];

// Scene 3: Dump - Adds Armored roaches, 6 waves (compressed, harder)
export const WAVE_CONFIGS_DUMP: WaveConfig[] = [
  { wave: 1, smallCount: 12, largeCount: 2, flyingCount: 2, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.5,  interval: 12, clusterChance: 0.05 },
  { wave: 2, smallCount: 18, largeCount: 3, flyingCount: 3, armoredCount: 3, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.58, interval: 10, clusterChance: 0.1 },
  { wave: 3, smallCount: 26, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, speed: 0.65, interval: 9,  clusterChance: 0.15 },
  { wave: 4, smallCount: 34, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, speed: 0.72, interval: 8,  clusterChance: 0.2 },
  { wave: 5, smallCount: 42, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 0, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, speed: 0.82, interval: 7,  clusterChance: 0.3 },
  { wave: 6, smallCount: 50, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 0, suicideCount: 3, flyingSuicideCount: 0, queenCount: 0, speed: 0.92, interval: 6,  clusterChance: 0.38 },
];

// Scene 4: Basement - Adds Splitting + Suicide roaches, fast, many
export const WAVE_CONFIGS_BASEMENT: WaveConfig[] = [
  { wave: 1, smallCount: 15, largeCount: 3, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, speed: 0.60, interval: 9,  clusterChance: 0.15 },
  { wave: 2, smallCount: 22, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, speed: 0.644, interval: 8,  clusterChance: 0.2 },
  { wave: 3, smallCount: 30, largeCount: 5, flyingCount: 5, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, speed: 0.688, interval: 8,  clusterChance: 0.25 },
  { wave: 4, smallCount: 38, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 0, queenCount: 0, speed: 0.732, interval: 7,  clusterChance: 0.3 },
  { wave: 5, smallCount: 48, largeCount: 7, flyingCount: 7, armoredCount: 4, splittingCount: 5, suicideCount: 3, flyingSuicideCount: 0, queenCount: 0, speed: 0.776, interval: 7,  clusterChance: 0.35 },
  { wave: 6, smallCount: 55, largeCount: 8, flyingCount: 8, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 0, queenCount: 0, speed: 0.82, interval: 6,  clusterChance: 0.4 },
];

// Scene 5: Rooftop - All roach types + Queen BOSS, highest difficulty
export const WAVE_CONFIGS_ROOFTOP: WaveConfig[] = [
  { wave: 1, smallCount: 14, largeCount: 3, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 1, flyingSuicideCount: 1, queenCount: 0, speed: 0.65, interval: 8,  clusterChance: 0.2 },
  { wave: 2, smallCount: 20, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, speed: 0.69, interval: 7,  clusterChance: 0.25 },
  { wave: 3, smallCount: 28, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 3, queenCount: 0, speed: 0.73, interval: 7,  clusterChance: 0.3 },
  { wave: 4, smallCount: 35, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.77, interval: 6,  clusterChance: 0.35 },
  { wave: 5, smallCount: 42, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 4, queenCount: 0, speed: 0.81, interval: 6,  clusterChance: 0.4 },
  { wave: 6, smallCount: 50, largeCount: 7, flyingCount: 7, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.85, interval: 5,  clusterChance: 0.45 },
];

// Scene wave config map
// Street scene: final chapter with Queen BOSS
export const WAVE_CONFIGS_STREET: WaveConfig[] = [
  { wave: 1, smallCount: 15, largeCount: 3, flyingCount: 3, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, speed: 0.70, interval: 7, clusterChance: 0.25 },
  { wave: 2, smallCount: 22, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.74, interval: 6, clusterChance: 0.3 },
  { wave: 3, smallCount: 28, largeCount: 5, flyingCount: 5, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.78, interval: 6, clusterChance: 0.35 },
  { wave: 4, smallCount: 35, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.82, interval: 5, clusterChance: 0.4 },
  { wave: 5, smallCount: 42, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 4, queenCount: 0, speed: 0.86, interval: 5, clusterChance: 0.45 },
  { wave: 6, smallCount: 40, largeCount: 5, flyingCount: 5, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.90, interval: 4, clusterChance: 0.5 },
];

// ========== NEW SCENE WAVE CONFIGS (v2.4) ==========
// ========== HOSPITAL 8-WAVE CONFIG ==========
// All suicide roaches replaced with timed suicide roaches
export const WAVE_CONFIGS_HOSPITAL: WaveConfig[] = [
  // Wave 1: Intro - 1 mutant + 1 timed suicide (gentle intro)
  { wave: 1, smallCount: 6, largeCount: 2, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.65, interval: 9, clusterChance: 0.15, nurseCount: 0, mutantCount: 1, timedSuicideCount: 1, eggPoolActiveCount: 0 },
  // Wave 2: Egg pool - 2 mutants + 1 timed
  { wave: 2, smallCount: 8, largeCount: 3, flyingCount: 1, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.70, interval: 8, clusterChance: 0.2, nurseCount: 0, mutantCount: 2, timedSuicideCount: 1, eggPoolActiveCount: 1 },
  // Wave 3: First nurse + 3 mutants + 1 timed
  { wave: 3, smallCount: 8, largeCount: 3, flyingCount: 2, armoredCount: 1, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.75, interval: 7, clusterChance: 0.25, nurseCount: 1, mutantCount: 3, timedSuicideCount: 1, eggPoolActiveCount: 1 },
  // Wave 4: 4 mutants + 2 timed
  { wave: 4, smallCount: 8, largeCount: 3, flyingCount: 2, armoredCount: 2, splittingCount: 1, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.80, interval: 7, clusterChance: 0.3, nurseCount: 1, mutantCount: 4, timedSuicideCount: 2, eggPoolActiveCount: 1 },
  // Wave 5: 4 mutants + 2 timed (max 2 per wave)
  { wave: 5, smallCount: 8, largeCount: 4, flyingCount: 4, armoredCount: 2, splittingCount: 1, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.85, interval: 6, clusterChance: 0.35, nurseCount: 2, mutantCount: 4, timedSuicideCount: 2, eggPoolActiveCount: 1 },
  // Wave 6: 5 mutants + 2 timed
  { wave: 6, smallCount: 6, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.90, interval: 5, clusterChance: 0.4, nurseCount: 2, mutantCount: 5, timedSuicideCount: 2, eggPoolActiveCount: 2 },
  // Wave 7: 5 mutants + 2 timed
  { wave: 7, smallCount: 6, largeCount: 4, flyingCount: 5, armoredCount: 3, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.95, interval: 5, clusterChance: 0.45, nurseCount: 3, mutantCount: 5, timedSuicideCount: 2, eggPoolActiveCount: 2 },
  // Wave 8: Final - 6 mutants + 2 timed (max 2 per wave)
  { wave: 8, smallCount: 4, largeCount: 4, flyingCount: 5, armoredCount: 3, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 1.0, interval: 4, clusterChance: 0.5, nurseCount: 3, mutantCount: 6, timedSuicideCount: 2, eggPoolActiveCount: 2 },
];

export const WAVE_CONFIGS_SUBWAY: WaveConfig[] = [
  { wave: 1, smallCount: 18, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, speed: 0.75, interval: 7, clusterChance: 0.25 },
  { wave: 2, smallCount: 26, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.79, interval: 6, clusterChance: 0.3 },
  { wave: 3, smallCount: 34, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 4, queenCount: 0, speed: 0.83, interval: 6, clusterChance: 0.35 },
  { wave: 4, smallCount: 42, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, speed: 0.87, interval: 5, clusterChance: 0.4 },
  { wave: 5, smallCount: 50, largeCount: 8, flyingCount: 8, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, speed: 0.91, interval: 5, clusterChance: 0.45 },
  { wave: 6, smallCount: 48, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 4, suicideCount: 4, flyingSuicideCount: 4, queenCount: 1, speed: 0.95, interval: 4, clusterChance: 0.5 },
];

export const WAVE_CONFIGS_SUPERMARKET: WaveConfig[] = [
  { wave: 1, smallCount: 20, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 2, queenCount: 0, speed: 0.78, interval: 6, clusterChance: 0.3 },
  { wave: 2, smallCount: 28, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.82, interval: 6, clusterChance: 0.35 },
  { wave: 3, smallCount: 36, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, speed: 0.86, interval: 5, clusterChance: 0.4 },
  { wave: 4, smallCount: 44, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, speed: 0.90, interval: 5, clusterChance: 0.45 },
  { wave: 5, smallCount: 52, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 5, queenCount: 0, speed: 0.94, interval: 4, clusterChance: 0.5 },
  { wave: 6, smallCount: 50, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 1, speed: 0.98, interval: 4, clusterChance: 0.55 },
];

export const WAVE_CONFIGS_SCHOOL: WaveConfig[] = [
  { wave: 1, smallCount: 22, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.80, interval: 6, clusterChance: 0.3 },
  { wave: 2, smallCount: 30, largeCount: 6, flyingCount: 6, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, speed: 0.84, interval: 5, clusterChance: 0.35 },
  { wave: 3, smallCount: 38, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, speed: 0.88, interval: 5, clusterChance: 0.4 },
  { wave: 4, smallCount: 46, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 5, queenCount: 0, speed: 0.92, interval: 4, clusterChance: 0.45 },
  { wave: 5, smallCount: 54, largeCount: 9, flyingCount: 9, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 6, queenCount: 0, speed: 0.96, interval: 4, clusterChance: 0.5 },
  { wave: 6, smallCount: 52, largeCount: 8, flyingCount: 8, armoredCount: 5, splittingCount: 5, suicideCount: 5, flyingSuicideCount: 5, queenCount: 1, speed: 1.0, interval: 3, clusterChance: 0.55 },
];

export const WAVE_CONFIGS_NEST: WaveConfig[] = [
  { wave: 1, smallCount: 25, largeCount: 6, flyingCount: 6, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, speed: 0.82, interval: 6, clusterChance: 0.35 },
  { wave: 2, smallCount: 34, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, speed: 0.86, interval: 5, clusterChance: 0.4 },
  { wave: 3, smallCount: 42, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 5, queenCount: 0, speed: 0.90, interval: 5, clusterChance: 0.45 },
  { wave: 4, smallCount: 50, largeCount: 9, flyingCount: 9, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 6, queenCount: 0, speed: 0.94, interval: 4, clusterChance: 0.5 },
  { wave: 5, smallCount: 58, largeCount: 10, flyingCount: 10, armoredCount: 7, splittingCount: 7, suicideCount: 6, flyingSuicideCount: 6, queenCount: 0, speed: 0.98, interval: 4, clusterChance: 0.55 },
  { wave: 6, smallCount: 55, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 5, suicideCount: 5, flyingSuicideCount: 5, queenCount: 1, speed: 1.05, interval: 3, clusterChance: 0.6 },
];

export const SCENE_WAVE_CONFIGS: Record<SceneType, WaveConfig[]> = {
  [SceneType.KITCHEN]: WAVE_CONFIGS_KITCHEN,
  [SceneType.SEWER]: WAVE_CONFIGS_SEWER,
  [SceneType.DUMP]: WAVE_CONFIGS_DUMP,
  [SceneType.BASEMENT]: WAVE_CONFIGS_BASEMENT,
  [SceneType.ROOFTOP]: WAVE_CONFIGS_ROOFTOP,
  [SceneType.STREET]: WAVE_CONFIGS_STREET,
  [SceneType.HOSPITAL]: WAVE_CONFIGS_HOSPITAL,
  [SceneType.SUBWAY]: WAVE_CONFIGS_SUBWAY,
  [SceneType.SUPERMARKET]: WAVE_CONFIGS_SUPERMARKET,
  [SceneType.SCHOOL]: WAVE_CONFIGS_SCHOOL,
  [SceneType.NEST]: WAVE_CONFIGS_NEST,
};

// Scene display order (used by UI)
export const SCENE_ORDER: SceneType[] = ['kitchen', 'sewer', 'dump', 'basement', 'street', 'rooftop', 'hospital', 'subway', 'supermarket', 'school', 'nest'];

// Item unlock order by scene (weak to strong): sticky -> poison -> molotov -> shotgun -> radar
export const SCENE_ITEM_UNLOCKS: Record<SceneType, string[]> = {
  // Kitchen: sticky board only (tutorial scene, fewer drops)
  [SceneType.KITCHEN]: ['sticky'],
  // Sewer: fan is the new item
  [SceneType.SEWER]: ['sticky', 'fan'],
  // Dump: molotov is the new item
  [SceneType.DUMP]: ['sticky', 'fan', 'molotov'],
  // Basement: swatter unlocked from dump reward, available here
  [SceneType.BASEMENT]: ['sticky', 'fan', 'molotov', 'swatter'],
  // Rooftop: swatter available
  [SceneType.ROOFTOP]: ['sticky', 'poison', 'fan', 'molotov', 'swatter'],
  // Street: all items including swatter
  [SceneType.STREET]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // Hospital: all items + hospital exclusive roaches
  [SceneType.HOSPITAL]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter', 'nurse', 'mutant', 'timed_suicide'],
  // Subway: all items
  [SceneType.SUBWAY]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // Supermarket: all items
  [SceneType.SUPERMARKET]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // School: all items
  [SceneType.SCHOOL]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // Nest: all items (final challenge)
  [SceneType.NEST]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
};

// Roach types available by scene
export const SCENE_ROACH_TYPES: Record<SceneType, RoachType[]> = {
  [SceneType.KITCHEN]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING],
  [SceneType.SEWER]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED],
  [SceneType.DUMP]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SUICIDE],
  [SceneType.BASEMENT]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE],
  [SceneType.ROOFTOP]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE],
  [SceneType.STREET]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE],
  [SceneType.HOSPITAL]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN, RoachType.NURSE, RoachType.MUTANT, RoachType.TIMED_SUICIDE],
  [SceneType.SUBWAY]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN],
  [SceneType.SUPERMARKET]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN],
  [SceneType.SCHOOL]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN],
  [SceneType.NEST]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN],
};

// Scene unlock chain: completing a scene unlocks the next one
export const SCENE_UNLOCK_CHAIN: SceneType[] = [
  SceneType.KITCHEN,
  SceneType.SEWER,
  SceneType.DUMP,
  SceneType.BASEMENT,
  SceneType.STREET,
  SceneType.ROOFTOP,
  SceneType.HOSPITAL,
  SceneType.SUBWAY,
  SceneType.SUPERMARKET,
  SceneType.SCHOOL,
  SceneType.NEST,
];

// ===== GROUND BOUNDS: 6-point perspective walkable area for ground roaches =====
// Each scene's ground boundary is defined by 6 points (3 per side),
// forming a 2-segment polyline on each side to match irregular obstacles.
// Format: [farL,farLY, farR,farRY, midL,midLY, midR,midRY, nearL,nearR,nearY]
//   farL/farR = farthest pair (top, distance)
//   midL/midR = middle pair (NEW! inserted between far and near)
//   nearL/nearR = nearest pair (bottom, close to camera)
//   nearY = bottom horizontal line Y
// Each side forms a 2-segment broken line: far→mid→near
export const SCENE_GROUND_BOUNDS: Record<SceneType, [number, number, number, number, number, number, number, number, number, number, number]> = {
  // Kitchen: straight line (mid = far→near midpoint)
  [SceneType.KITCHEN]: [200,450, 400,450,  100,625, 465,625,  0,530,800],
  // Sewer: custom corridor with distant far points
  [SceneType.SEWER]:   [310,388, 471,384,  50,435, 470,454,  50,470, 810],
  // Dump: custom garbage corridor perspective
  [SceneType.DUMP]:    [98,392, 342,442,  141,669, 446,612,  140,461, 810],
  // Basement: straight line (mid = far→near midpoint)
  [SceneType.BASEMENT]:[200,450, 350,450,  100,625, 450,625,  0,530,800],
  // Rooftop: straight line (mid = far→near midpoint)
  [SceneType.ROOFTOP]: [150,400, 380,400,   75,600, 455,600,  0,530,800],
  // Street: straight line (mid = far→near midpoint)
  [SceneType.STREET]:  [250,450, 300,450,  125,625, 425,625,  0,530,800],
  // Hospital: narrow corridor
  [SceneType.HOSPITAL]: [232,416, 333,449, 141,512, 401,486, 50,490,810],
  // Subway: wide platform
  [SceneType.SUBWAY]:   [220,440, 340,440,  100,620, 460,620,  0,530,800],
  // Supermarket: aisles
  [SceneType.SUPERMARKET]: [200,430, 380,430,  90,610, 450,610,  0,530,800],
  // School: classroom
  [SceneType.SCHOOL]:   [210,435, 370,435,  95,615, 455,615,  0,530,800],
  // Nest: organic tunnel
  [SceneType.NEST]:     [170,410, 370,410,  70,590, 470,590,  0,530,800],
};

// ========== POST-BATTLE ITEM REVEAL ==========
// Each scene rewards a new item for the NEXT scene, with Zhang Shu's hilarious descriptions
export const SCENE_REWARD_ITEMS: Record<SceneType, { type: string; name: string; icon: string; desc: string }[]> = {
  [SceneType.KITCHEN]: [
    { type: 'fan', name: '强力风扇', icon: '/assets/drop_fan.png', desc: '嘿嘿嘿，听说过"风神降临"吗？按下开关，全场蟑螂秒变慢动作回放！扇叶一转，小强的腿都跑软了，你就站那儿看着它们爬，跟看纪录片似的。关键是——这风扇不用你扛着，自动全场覆盖！蟑叔我亲自改装的，风速三档可调，第三档能把蟑螂吹成背头造型！' },
  ],
  [SceneType.SEWER]: [
    { type: 'molotov', name: '燃烧瓶', icon: '/assets/drop_molotov.png', desc: '这可是我从隔壁烧烤摊"借"来的秘方！瓶子里装的不是酒，是梦想——烧死蟑螂的梦想！往地上一摔，"轰"的一下火墙立起来，蟑螂们排着队往火里冲，拦都拦不住！温馨提示：千万别在封闭空间用，上次我在厕所试了一下，眉毛少了一半……' },
  ],
  [SceneType.DUMP]: [
    { type: 'swatter', name: '电蚊拍', icon: '/assets/drop_swatter.png', desc: '终——极——武——器！！！全屏放电，一扫而空！"噼里啪啦"一阵电闪雷鸣，满屏蟑螂瞬间灰飞烟灭，连渣都不剩！这玩意儿拿在手里，你就是雷神托尔，就是宙斯下凡，就是蟑螂们的末日审判！蟑叔我纵横除蟑界三十年，就这电蚊拍能让我激动得睡不着。用吧，少年，以雷霆击碎黑暗！！！' },
  ],
  [SceneType.BASEMENT]: [
    { type: 'poison', name: '杀虫喷雾', icon: '/assets/drop_poison.png', desc: '新型改良版杀虫剂，双侧喷射系统加上3秒持续性中毒效果！喷一下，蟑螂们先晕，再吐，最后倒，整个过程比看电视剧还精彩。蟑叔我加了点特殊配方，这味道对人类无害但对蟑螂来说……嘿嘿，就像闻到前任的香水一样致命！' },
  ],
  // Rooftop: no new reward (swatter moved to dump)
  [SceneType.ROOFTOP]: [],
  [SceneType.STREET]: [
    { type: 'shotgun', name: '散弹模式', icon: '/assets/drop_shotgun.png', desc: '三！管！齐！发！这已经不是喷火枪了，这是喷火机关枪！扇面扫射，覆盖面大到连飞过的小鸟都得绕道走。一只蟑螂？三发全中。一群蟑螂？三发全中。满屏蟑螂？还是三发全中！唯一的缺点嘛……气罐消耗快得跟我的头发一样。多囤气罐，听蟑叔的准没错！' },
    { type: 'radar', name: '雷达激光', icon: '/assets/drop_radar.png', desc: '来来来，见识一下什么叫"科技改变灭蟑"！这玩意儿自带追踪雷达，哪只蟑螂离得最近，激光"咻"的一下就锁过去了！biu~biu~biu~跟打靶似的，指哪打哪，百发百中！在这条赛博街道上，雷达激光就是你的终极利器！蟑叔我当年要是早点发明这个，也不至于被蟑螂追了三条街……' },
  ],
  // Hospital reward: advanced medical supplies for cockroach eradication
  [SceneType.HOSPITAL]: [
    { type: 'gas_refill', name: '医疗气罐', icon: '/assets/consumable_gas.png', desc: '从医院氧气瓶改装的超级气罐！容量是普通气罐的两倍，持续时间超长。蟑叔我亲自从ICU"借"来的，护士追了我三层楼……但值得！有了这玩意儿，你可以放心大胆地喷火，不用担心气不够用！' },
  ],
  // Subway reward: track electrifier
  [SceneType.SUBWAY]: [
    { type: 'swatter', name: '轨道电击器', icon: '/assets/drop_swatter.png', desc: '地铁第三轨的电流改装版！一炮下去整条轨道带电，蟑螂们踩着铁轨冲过来，结果全部变成烤蟑螂！范围超大，持续时间超长，就是有点费铁轨……别告诉地铁公司是我干的！' },
  ],
  // Supermarket reward: shelf domino
  [SceneType.SUPERMARKET]: [
    { type: 'molotov', name: '货架燃烧弹', icon: '/assets/drop_molotov.png', desc: '超市货架倒塌+燃烧瓶=完美火海！推倒一整排货架，火焰沿着货架蔓延，整个超市变成烤箱！蟑螂们连逃跑的路线都被堵死了。蟑叔温馨提示：使用后请记得买保险……' },
  ],
  // School reward: chalk dust bomb
  [SceneType.SCHOOL]: [
    { type: 'poison', name: '粉笔灰毒气', icon: '/assets/drop_poison.png', desc: '三十年陈年老粉笔灰+杀虫剂=生化武器！扬起来整个教室都是毒雾，蟑螂们吸入后直接开始跳舞……然后倒下。对人类无害（大概），对蟑螂致命！校长的粉笔灰终于派上用场了！' },
  ],
  // Nest: final reward - crown of the cockroach king
  [SceneType.NEST]: [
    { type: 'radar', name: '女王之冠', icon: '/assets/drop_radar.png', desc: '你做到了！你击败了蟑螂女王，夺走了她的王冠！这顶 Crown 现在属于你的了——戴上它，你就是蟑螂界的终结者，是所有小强的噩梦！蟑叔我为你骄傲，热泪盈眶！从今以后，这片土地上再也不会有蟑螂敢抬头！' },
  ],
};

// ========== CONSUMABLE DEFS (in-level shop, one-time use) ==========
export const CONSUMABLE_DEFS: ConsumableDef[] = [
  {
    id: 'gas_refill', name: '气罐补给', description: '立即回满燃气',
    cost: 250, icon: '/assets/consumable_gas.png', effectDesc: '燃气回满', color: 'from-amber-600 to-amber-700',
    cooldown: 3,
  },
  {
    id: 'defense_repair', name: '防线修复', description: '防线 HP +20%',
    cost: 400, icon: '/assets/consumable_repair.png', effectDesc: '修复防线 20%', color: 'from-green-600 to-green-700',
    cooldown: 8,
  },
  {
    id: 'emergency_cool', name: '紧急冷却', description: '立即清除过热',
    cost: 200, icon: '/assets/consumable_cool.png', effectDesc: '瞬间冷却', color: 'from-blue-600 to-blue-700',
    // no cooldown - can use anytime
  },
  {
    id: 'power_boost', name: '火力全开', description: '10秒内伤害 x2',
    cost: 700, icon: '/assets/consumable_power.png', effectDesc: '双倍伤害 10秒', color: 'from-red-600 to-red-700',
    cooldown: 10,
  },
  {
    id: 'shield', name: '临时护盾', description: '防线 5秒无敌',
    cost: 800, icon: '/assets/consumable_shield.png', effectDesc: '防线无敌 5秒', color: 'from-cyan-600 to-cyan-700',
    cooldown: 8,
  },
  {
    id: 'bait', name: '蟑螂诱饵', description: '全场蟑螂聚拢 3秒',
    cost: 450, icon: '/assets/consumable_bait.png', effectDesc: '聚拢蟑螂 3秒', color: 'from-purple-600 to-purple-700',
    cooldown: 6,
  },
];

// ========== WEAPON DROP CONFIGS ==========
export const WEAPON_DROP_DEFS = {
  sticky:  { name: '蟑螂贴板', color: '#facc15', duration: 10, ammo: 3,  cooldown: 5 },
  poison:  { name: '杀虫剂',  color: '#4ade80', duration: 15, ammo: 40, cooldown: 6 },
  shotgun: { name: '散弹模式', color: '#fbbf24', duration: 12, ammo: 30, cooldown: 10 },
  molotov: { name: '燃烧瓶',  color: '#f87171', duration: 10, ammo: 5,  cooldown: 10 },
  radar:   { name: '雷达激光', color: '#22d3ee', duration: 5,  ammo: 20, cooldown: 8 },
  fan:     { name: '强力风扇', color: '#a78bfa', duration: 8,  ammo: 5,  cooldown: 8 },
  swatter: { name: '电蚊拍',  color: '#fbbf24', duration: 0,  ammo: 1,  cooldown: 10 },
};

// 拾取道具回收价格（关卡结束时未使用的道具折合金币）
export const INVENTORY_SELL_PRICES: Record<string, number> = {
  sticky:  5,
  poison:  8,
  molotov: 10,
  shotgun: 12,
  radar:   10,
  fan:     8,
  swatter: 15,
};

// ========== BOSS CONFIG ==========
export const BOSS_CONFIG = {
  queen: {
    spawnInterval: 8,
    minionCount: 3,
    phaseHpThresholds: [0.7, 0.4, 0.2],
    resistPercent: 0.5,
  },
};

// ========== ENCYCLOPEDIA DATA ==========
export const ENCYCLOPEDIA_DEFS: EncyclopediaEntry[] = [
  {
    id: 'roach_small',
    name: '小蟑螂',
    type: RoachType.SMALL,
    image: '/assets/roach.png',
    description: '最基础的蟑螂单位，体型小速度快，喜欢成群结队出现。',
    funFact: '一只怀揣梦想的蟑螂，梦想是吃光你的外卖。它每天跑的距离相当于人类跑马拉松。',
    hp: 1,
    speed: 1.0,
    special: '无特殊能力，但数量众多',
    killCount: 0,
    unlocked: true,
  },
  {
    id: 'roach_large',
    name: '大蟑螂',
    type: RoachType.LARGE,
    image: '/assets/roach.png',
    description: '体型庞大的蟑螂，血量更多，更加耐打。愤怒时会加速冲刺。',
    funFact: '健身房常客，八块腹肌，但怕火。它曾试图报名参加健美比赛，因不符合"人类"标准被拒。',
    hp: 4,
    speed: 0.8,
    special: '愤怒加速：血量低于50%时速度提升50%',
    killCount: 0,
    unlocked: true,
  },
  {
    id: 'roach_flying',
    name: '飞行蟑螂',
    type: RoachType.FLYING,
    image: '/assets/roach_flying.png',
    description: '拥有翅膀的蟑螂，从空中掠过，速度极快。会俯冲攻击防线。',
    funFact: '刚拿到飞行驾照，还在实习期。它的飞行教练是一只 retired 的蜜蜂。',
    hp: 2,
    speed: 1.5,
    special: '飞行：不受地面陷阱影响，可俯冲攻击',
    killCount: 0,
    unlocked: true,
  },
  {
    id: 'roach_armored',
    name: '装甲蟑螂',
    type: RoachType.ARMORED,
    image: '/assets/roach_armored.png',
    description: '身披厚重甲壳的蟑螂，护甲可吸收50%伤害。甲壳破损后露出本体。',
    funFact: '它穿的不是盔甲，是它的外卖盒做的。环保主义先锋，甲壳回收率100%。',
    hp: 12,
    speed: 0.5,
    special: '护甲：吸收50%伤害，护甲值耗尽后变为普通蟑螂外观',
    killCount: 0,
    unlocked: true,
  },
  {
    id: 'roach_splitting',
    name: '分裂蟑螂',
    type: RoachType.SPLITTING,
    image: '/assets/roach_splitting.png',
    description: '死亡时会分裂成5只小蟑螂的恐怖存在。母体死亡瞬间爆发分裂。',
    funFact: '它的座右铭是"一个我倒下，五个我站起来"。它参加了当地的克隆技术研究小组。',
    hp: 6,
    speed: 0.7,
    special: '分裂：死亡后分裂为5只小蟑螂',
    killCount: 0,
    unlocked: true,
  },
  {
    id: 'roach_suicide',
    name: '自爆蟑螂',
    type: RoachType.SUICIDE,
    image: '/assets/roach_suicide.png',
    description: '背上绑着TNT的疯狂蟑螂，靠近防线会自爆造成范围伤害。死亡后也会爆炸。',
    funFact: '它背上的TNT是从蟑螂黑市买来的，花了它三个月的外卖钱。它是蟑螂界的极端主义者。',
    hp: 2,
    speed: 1.2,
    special: '自爆：靠近防线时爆炸，对范围内蟑螂和防线造成伤害',
    killCount: 0,
    unlocked: true,
  },
  {
    id: 'roach_queen',
    name: '蟑螂女王',
    type: RoachType.QUEEN,
    image: '/assets/roach_queen.png',
    description: 'BOSS级敌人，庞大的身躯和恐怖的繁殖能力。会不断召唤小蟑螂加入战斗。',
    funFact: '三年洗洁精，一朝变女王。不要问，问就是喝了假酒。她的皇冠是用易拉罐做的。',
    hp: 100,
    speed: 0.3,
    special: '召唤：每8秒召唤3只小蟑螂；火焰抗性50%',
    killCount: 0,
    unlocked: true,
  },
  // ===== HOSPITAL EXCLUSIVE ROACHES =====
  {
    id: 'roach_nurse',
    name: '护士蟑螂',
    type: RoachType.NURSE,
    image: '/assets/roach_nurse.png',
    description: '携带医疗包的蟑螂，定期为周围受伤蟑螂恢复20%HP。对杀虫剂极度敏感，接触后窒息8秒。',
    funFact: '它从医院药房偷来的医疗包，里面的"药品"其实是过期的小强营养素。它自称是"南丁格尔转世"。',
    hp: 70,
    speed: 0.8,
    special: '治疗：每5秒治疗3格内最低血量盟友20%HP；杀虫剂敏感：接触后窒息8秒',
    killCount: 0,
    unlocked: true,
  },
  {
    id: 'roach_mutant',
    name: '变异蟑螂',
    type: RoachType.MUTANT,
    image: '/assets/roach_mutant.png',
    description: '经过辐射变异的蟑螂，死亡时释放强腐蚀性酸液，屏幕闪烁绿色干扰视野3秒。',
    funFact: '它曾经是一只普通蟑螂，直到有一天它爬进了医院的X光机。现在它的体液是绿色的，据说味道像青苹果……没人敢验证。',
    hp: 40,
    speed: 0.9,
    special: '酸液爆发：死亡时对周围造成酸液伤害+绿色屏幕干扰2秒',
    killCount: 0,
    unlocked: true,
  },
  {
    id: 'roach_timed_suicide',
    name: '定时自爆蟑螂',
    type: RoachType.TIMED_SUICIDE,
    image: '/assets/roach_timed_suicide.png',
    description: '高生存能力的蟑螂，到达防线前64px放置炸弹后变身大蟑螂。炸弹3秒后爆炸，造成大范围伤害。',
    funFact: '它背上的炸弹是从医院手术室偷来的定时器改造的。放置炸弹后它会莫名其妙地变成大蟑螂——大概是辐射后遗症。',
    hp: 240,
    speed: 2.0,
    special: '放置炸弹：到达防线前64px放置炸弹，3秒后爆炸（范围196px）；变身：放置后变成大蟑螂',
    killCount: 0,
    unlocked: true,
  },
]; // ENCYLOPEDIA_DEFS