import { SceneType, SAVE_VERSION, type Achievement, type GameProgress } from '../types';
import { ENCYCLOPEDIA_DEFS } from './encyclopedia';

// ========== 樟叔成就对话框文字模板 ==========
/**
 * 成就解锁时樟叔对话框的文字模板
 * @description 集中管理成就解锁弹窗中樟叔的对话文案，方便统一修改而无需改动组件代码。
 * 使用方式：import { ACHIEVEMENT_DIALOG_TEXT } from '@/game/data/achievements';
 */
export const ACHIEVEMENT_DIALOG_TEXT = {
  /** 解锁标题 */
  unlockTitle: '🎉 恭喜！解锁成就',
  /** 金币奖励模板 */
  rewardTemplate: (reward: number) => `💰 奖励 ¥${reward} 已存入账户`,
  /** 点击继续提示 */
  clickToContinue: '点击继续 ▸',
  /** 最后一项点击继续提示 */
  clickToFinish: '点击完成 ✓',
  /** 战斗中浮动文字（成就解锁时画面中央提示） */
  floatingText: (name: string, reward: number) => `成就: ${name} +¥${reward}`,
  /** 浮动文字颜色 */
  floatingColor: '#fbbf24',
  /** 进度指示器模板 */
  progressIndicator: (current: number, total: number) => `${current} / ${total}`,
} as const;

/**
 * 成就定义列表
 * @description 定义游戏中所有可解锁的成就，包含 id、名称、描述、解锁条件表达式和奖励金币。
 * 条件表达式在 AchievementSystem 中通过动态求值（eval）检查，支持 `totalKills`、`highestWave`、
 * `totalMoneyEarned` 等经济统计字段，以及 `allWeaponsUnlocked`、`talentPointsSpent` 等特殊条件。
 * 每个成就的 reward 金币在玩家打开成就界面、动画点亮后发放到总金币池。
 * 
 * 成就分类：
 * - 击杀类：first_blood, roach_slayer, roach_exterminator, kill_queen, kill_flying, kill_armored
 * - 波次类：wave_5, wave_10, endless_20, endless_50
 * - 经济类：money_1000
 * - 完美类：perfect_wave, no_breach
 * - 解锁类：weapon_master, talent_first
 */
export const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked'>[] = [
  // ===== 击杀类成就 =====
  {
    id: 'first_blood',
    name: '首杀',
    description: '消灭第一只蟑螂',
    condition: 'totalKills >= 1',
    conditionDescription: '击杀第1只蟑螂',
    reward: 50,      // 入门成就，奖励较低
  },
  {
    id: 'roach_slayer',
    name: '蟑螂杀手',
    description: '累计消灭100只蟑螂',
    condition: 'totalKills >= 100',
    conditionDescription: '累计击杀100只蟑螂',
    reward: 200,     // 中等门槛
  },
  {
    id: 'roach_exterminator',
    name: '灭蟑专家',
    description: '累计消灭1000只蟑螂',
    condition: 'totalKills >= 1000',
    conditionDescription: '累计击杀1000只蟑螂',
    reward: 1000,    // 高门槛，高奖励
  },
  // ===== 波次类成就 =====
  {
    id: 'wave_5',
    name: '坚守阵地',
    description: '到达第5波',
    condition: 'highestWave >= 5',
    conditionDescription: '通关第5波',
    reward: 100,     // 中期里程碑
  },
  {
    id: 'wave_10',
    name: '终极守卫',
    description: '通关全部10波',
    condition: 'highestWave >= 10',
    conditionDescription: '通关第10波',
    reward: 500,     // 通关奖励
  },
  {
    id: 'endless_20',
    name: '无尽勇士',
    description: '无尽模式到达20波',
    condition: 'highestEndlessWave >= 20',
    conditionDescription: '无尽模式达到20波',
    reward: 500,     // 无尽模式中期奖励
  },
  {
    id: 'endless_50',
    name: '无尽传说',
    description: '无尽模式到达50波',
    condition: 'highestEndlessWave >= 50',
    conditionDescription: '无尽模式达到50波',
    reward: 2000,    // 无尽模式最高成就
  },
  // ===== 经济类成就 =====
  {
    id: 'money_1000',
    name: '小有积蓄',
    description: '累计获得1000资金',
    condition: 'totalMoneyEarned >= 1000',
    conditionDescription: '累计获得1000金钱',
    reward: 200,     // 自然积累可达成
  },
  // ===== 完美类成就 =====
  {
    id: 'perfect_wave',
    name: '完美防御',
    description: '完成一波 without any breach',
    condition: 'perfectWaves >= 1',
    conditionDescription: '完成1次完美波次（无防线突破）',
    reward: 100,     // 鼓励完美防守
  },
  {
    id: 'no_breach',
    name: '铜墙铁壁',
    description: '通关10波 without any breach',
    condition: 'breaches == 0 and highestWave >= 10',
    conditionDescription: '连续10波无防线突破',
    reward: 1000,    // 高难度成就
  },
  // ===== Boss 击杀类成就 =====
  {
    id: 'kill_queen',
    name: '女王终结者',
    description: '消灭蟑螂女王',
    condition: 'queenKills >= 1',
    conditionDescription: '击杀1只女王蟑螂',
    reward: 500,     // Boss 击杀奖励
  },
  {
    id: 'kill_flying',
    name: '空中猎手',
    description: '消灭50只飞行蟑螂',
    condition: 'flyingKills >= 50',
    conditionDescription: '累计击杀50只飞行蟑螂',
    reward: 300,     // 飞行蟑螂较难命中
  },
  {
    id: 'kill_armored',
    name: '破甲大师',
    description: '消灭30只装甲蟑螂',
    condition: 'armoredKills >= 30',
    conditionDescription: '累计击杀30只装甲蟑螂',
    reward: 400,     // 装甲蟑螂血量高
  },
  // ===== 解锁类成就 =====
  {
    id: 'weapon_master',
    name: '武器大师',
    description: '解锁所有特殊武器',
    condition: 'allWeaponsUnlocked',
    conditionDescription: '解锁5种武器',
    reward: 1000,    // 全武器收集奖励
  },
  {
    id: 'talent_first',
    name: '初出茅庐',
    description: '第一次升级天赋',
    condition: 'talentPointsSpent >= 1',
    conditionDescription: '学习第1个天赋',
    reward: 100,     // 入门引导奖励
  },
  // ===== 天赋加点成就（三系首次加点）=====
  {
    id: 'talent_inferno_first',
    name: '猛火初燃',
    description: '首次猛火系天赋加点',
    condition: "branchSpent('inferno') >= 1",
    conditionDescription: '学习第1个猛火系天赋',
    reward: 150,
  },
  {
    id: 'talent_lance_first',
    name: '枪出如龙',
    description: '首次长枪系天赋加点',
    condition: "branchSpent('lance') >= 1",
    conditionDescription: '学习第1个长枪系天赋',
    reward: 150,
  },
  {
    id: 'talent_support_first',
    name: '后勤初成',
    description: '首次装备系天赋加点',
    condition: "branchSpent('support') >= 1",
    conditionDescription: '学习第1个装备系天赋',
    reward: 150,
  },
  // ===== 三星通关成就（每关三星评价奖励金币）=====
  {
    id: 'three_star_kitchen',
    name: '厨房三星',
    description: '厨房关卡三星评价通关',
    condition: '(levelStars.kitchen || 0) >= 3',
    conditionDescription: '厨房三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_sewer',
    name: '下水道三星',
    description: '下水道关卡三星评价通关',
    condition: '(levelStars.sewer || 0) >= 3',
    conditionDescription: '下水道三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_dump',
    name: '垃圾场三星',
    description: '垃圾场关卡三星评价通关',
    condition: '(levelStars.dump || 0) >= 3',
    conditionDescription: '垃圾场三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_basement',
    name: '地下室三星',
    description: '地下室关卡三星评价通关',
    condition: '(levelStars.basement || 0) >= 3',
    conditionDescription: '地下室三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_street',
    name: '街道三星',
    description: '城市街道关卡三星评价通关',
    condition: '(levelStars.street || 0) >= 3',
    conditionDescription: '街道三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_rooftop',
    name: '天台三星',
    description: '天台关卡三星评价通关',
    condition: '(levelStars.rooftop || 0) >= 3',
    conditionDescription: '天台三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_hospital',
    name: '医院三星',
    description: '废弃医院关卡三星评价通关',
    condition: '(levelStars.hospital || 0) >= 3',
    conditionDescription: '医院三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_subway',
    name: '地铁三星',
    description: '废弃地铁关卡三星评价通关',
    condition: '(levelStars.subway || 0) >= 3',
    conditionDescription: '地铁三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_supermarket',
    name: '超市三星',
    description: '废弃超市关卡三星评价通关',
    condition: '(levelStars.supermarket || 0) >= 3',
    conditionDescription: '超市三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_school',
    name: '学校三星',
    description: '废弃学校关卡三星评价通关',
    condition: '(levelStars.school || 0) >= 3',
    conditionDescription: '学校三星评价通关',
    reward: 200,
  },
  {
    id: 'three_star_nest',
    name: '巢穴三星',
    description: '蟑螂巢穴关卡三星评价通关',
    condition: '(levelStars.nest || 0) >= 3',
    conditionDescription: '巢穴三星评价通关',
    reward: 300,
  },
  // ===== 困难关三星通关成就（巢穴后 6 个困难关，独立关卡 ID）=====
  {
    id: 'three_star_rooftop_hard',
    name: '天台·困难三星',
    description: '天台困难关三星评价通关',
    condition: "(levelStars['rooftop__hard'] || 0) >= 3",
    conditionDescription: '天台困难关三星评价通关',
    reward: 300,
  },
  {
    id: 'three_star_hospital_hard',
    name: '医院·困难三星',
    description: '废弃医院困难关三星评价通关',
    condition: "(levelStars['hospital__hard'] || 0) >= 3",
    conditionDescription: '医院困难关三星评价通关',
    reward: 300,
  },
  {
    id: 'three_star_subway_hard',
    name: '地铁·困难三星',
    description: '废弃地铁困难关三星评价通关',
    condition: "(levelStars['subway__hard'] || 0) >= 3",
    conditionDescription: '地铁困难关三星评价通关',
    reward: 300,
  },
  {
    id: 'three_star_supermarket_hard',
    name: '超市·困难三星',
    description: '废弃超市困难关三星评价通关',
    condition: "(levelStars['supermarket__hard'] || 0) >= 3",
    conditionDescription: '超市困难关三星评价通关',
    reward: 300,
  },
  {
    id: 'three_star_school_hard',
    name: '学校·困难三星',
    description: '废弃学校困难关三星评价通关',
    condition: "(levelStars['school__hard'] || 0) >= 3",
    conditionDescription: '学校困难关三星评价通关',
    reward: 300,
  },
  {
    id: 'three_star_nest_hard',
    name: '巢穴·困难三星',
    description: '蟑螂巢穴困难关三星评价通关',
    condition: "(levelStars['nest__hard'] || 0) >= 3",
    conditionDescription: '巢穴困难关三星评价通关',
    reward: 400,
  },
];

// ========== 默认游戏进度 ==========
/**
 * 创建默认游戏进度对象
 * @description 初始化一个全新的存档，包含所有成就（未解锁）、初始场景解锁（厨房）、
 * 默认武器（火焰喷射器+蟑螂贴板）、空的天赋树和消耗品库存。
 * 由 SaveSystem 在首次游戏或重置进度时调用。
 * @returns 全新的 GameProgress 对象
 */
export function createDefaultProgress(): GameProgress {
  return {
    saveVersion: SAVE_VERSION,                           // 存档版本号，用于兼容性检查
    talentTree: {
      points: 0,                                         // 初始天赋点 = 0
      talents: {},                                       // 空天赋树
    },
    achievements: ACHIEVEMENT_DEFS.map(a => ({ ...a, unlocked: false })), // 所有成就初始未解锁
    highestWave: 0,                                      // 最高波次 = 0
    highestEndlessWave: 0,                               // 无尽模式最高波次 = 0
    totalKills: 0,                                       // 总击杀 = 0
    scenesUnlocked: [SceneType.KITCHEN],                 // 初始仅解锁厨房
    scenesCompleted: [],                                 // 无已完成场景
    weaponsUnlocked: ['flamethrower', 'sticky'],         // 初始武器：火焰喷射器 + 粘板
    encyclopedia: {
      entries: ENCYCLOPEDIA_DEFS.map(e => ({ ...e })),   // 复制图鉴数据
    },
    shopUpgrades: [],                                    // 无商店升级
    consumableInventory: {},                             // 空消耗品库存
    autoUseEnabled: {},                                  // 无自动使用设置
    levelStars: {},                                      // 无场景星级评价记录
    pendingTalentPoints: 0,                              // 无待解锁天赋点
  };
}