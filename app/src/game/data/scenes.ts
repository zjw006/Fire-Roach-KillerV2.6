import { SceneType, WeatherType, type SceneConfig } from '../types';

// ========== 场景配置 ==========
/**
 * 场景配置
 * @description 定义每个关卡场景的视觉风格、天气效果、难度系数和奖励倍率。
 * 每个场景代表一个独立的关卡，从简单厨房到终极蟑螂巢穴，难度递增。
 * - enemyModifier: 敌人强度系数（>1 表示敌人更强）
 * - rewardMultiplier: 奖励倍率（>1 表示奖励更多）
 * - weather: 天气效果类型（NONE/RAIN/FOG/NIGHT）
 */
export const SCENE_CONFIGS: Record<SceneType, SceneConfig> = {
  [SceneType.KITCHEN]: {
    type: SceneType.KITCHEN,
    name: '恐怖厨房',
    description: '蟑螂的老巢，一切的开始',
    bgColor: '#16162a',    // 深蓝紫色背景
    tileColors: ['#1a1a30', '#18182c'], // 瓷砖颜色（交替）
    defenseLineColor: 'rgba(239, 68, 68, 0.7)', // 红色防线
    weather: WeatherType.NONE, // 无天气效果
    enemyModifier: 1,     // 基准难度
    rewardMultiplier: 1,  // 基准奖励
  },
  [SceneType.SEWER]: {
    type: SceneType.SEWER,
    name: '阴暗下水道',
    description: '狭窄的管道中蟑螂更加密集',
    bgColor: '#0a1a0a',    // 暗绿色
    tileColors: ['#0d1f0d', '#0b1a0b'],
    defenseLineColor: 'rgba(100, 200, 100, 0.7)', // 绿色防线
    weather: WeatherType.RAIN, // 雨天效果
    enemyModifier: 1.3,    // 难度提升 30%
    rewardMultiplier: 1.2, // 奖励提升 20%
  },
  [SceneType.DUMP]: {
    type: SceneType.DUMP,
    name: '垃圾场',
    description: '废弃的垃圾山中隐藏着变异蟑螂',
    bgColor: '#1a1508',    // 暗棕色
    tileColors: ['#1f190b', '#1a1508'],
    defenseLineColor: 'rgba(200, 150, 50, 0.7)', // 金色防线
    weather: WeatherType.FOG, // 雾天效果
    enemyModifier: 1.3,
    rewardMultiplier: 1.5,
  },
  [SceneType.BASEMENT]: {
    type: SceneType.BASEMENT,
    name: '地下室',
    description: '黑暗潮湿的地下室，蟑螂的天堂',
    bgColor: '#0a0a1a',    // 深蓝黑
    tileColors: ['#0d0d1f', '#0a0a1a'],
    defenseLineColor: 'rgba(150, 100, 255, 0.7)', // 紫色防线
    weather: WeatherType.NIGHT, // 夜晚效果（闪电）
    enemyModifier: 1.5,
    rewardMultiplier: 1.8,
  },
  [SceneType.ROOFTOP]: {
    type: SceneType.ROOFTOP,
    name: '天台决战',
    description: '最终战场，面对蟑螂女王的巢穴',
    bgColor: '#1a0a1a',    // 深紫黑
    tileColors: ['#1f0d1f', '#1a0a1a'],
    defenseLineColor: 'rgba(255, 100, 200, 0.7)', // 粉色防线
    weather: WeatherType.NIGHT, // 夜晚效果
    enemyModifier: 1.7,
    rewardMultiplier: 2.0,
  },
  [SceneType.STREET]: {
    type: SceneType.STREET,
    name: '城市街道',
    description: '赛博朋克都市的最终决战',
    bgColor: '#0a0a12',    // 暗蓝黑
    tileColors: ['#0d0d18', '#0a0a15'],
    defenseLineColor: 'rgba(200, 60, 20, 0.7)', // 暗红防线
    weather: WeatherType.RAIN, // 雨天
    enemyModifier: 1.9,
    rewardMultiplier: 2.0,
  },
  [SceneType.HOSPITAL]: {
    type: SceneType.HOSPITAL,
    name: '废弃医院',
    description: '阴暗的走廊中弥漫着消毒水和蟑螂的气味',
    bgColor: '#0a1210',    // 医院绿黑色
    tileColors: ['#0d1815', '#0a1210'],
    defenseLineColor: 'rgba(100, 220, 180, 0.7)', // 医疗绿防线
    weather: WeatherType.NONE,
    enemyModifier: 2.1,    // 难度大幅提升（医院专属蟑螂）
    rewardMultiplier: 2.5,
    bgImage: '/assets/bg_hospital.png', // 场景背景图片
  },
  [SceneType.SUBWAY]: {
    type: SceneType.SUBWAY,
    name: '废弃地铁',
    description: '漆黑的隧道中蟑螂如潮水般涌来',
    bgColor: '#0a0a10',    // 极暗色
    tileColors: ['#0d0d14', '#0a0a10'],
    defenseLineColor: 'rgba(180, 160, 100, 0.7)', // 暗金色防线
    weather: WeatherType.NIGHT, // 夜晚
    enemyModifier: 2.3,
    rewardMultiplier: 4,
    bgImage: '/assets/bg_subway.jpg',
  },
  [SceneType.SUPERMARKET]: {
    type: SceneType.SUPERMARKET,
    name: '废弃超市',
    description: '货架间隐藏着变异蟑螂的巢穴',
    bgColor: '#121008',    // 暗棕色
    tileColors: ['#18140b', '#121008'],
    defenseLineColor: 'rgba(220, 180, 60, 0.7)', // 金色防线
    weather: WeatherType.NONE,
    enemyModifier: 2.5,
    rewardMultiplier: 4.5,
    bgImage: '/assets/bg_supermarket.jpg',
  },
  [SceneType.SCHOOL]: {
    type: SceneType.SCHOOL,
    name: '废弃学校',
    description: '教室和走廊中蟑螂成群结队',
    bgColor: '#0a1018',    // 暗蓝灰
    tileColors: ['#0d141d', '#0a1018'],
    defenseLineColor: 'rgba(80, 140, 220, 0.7)', // 蓝色防线
    weather: WeatherType.RAIN, // 雨天
    enemyModifier: 2.7,
    rewardMultiplier: 5,
    bgImage: '/assets/bg_school.jpg',
  },
  [SceneType.NEST]: {
    type: SceneType.NEST,
    name: '蟑螂巢穴',
    description: '终极战场——蟑螂帝国的心脏',
    bgColor: '#1a0808',    // 深红黑
    tileColors: ['#1f0d0d', '#1a0808'],
    defenseLineColor: 'rgba(255, 50, 50, 0.7)', // 血红色防线
    weather: WeatherType.FOG, // 雾天
    enemyModifier: 3.0,    // 最高难度
    rewardMultiplier: 6,   // 最高奖励
    bgImage: '/assets/bg_nest.jpg',
  },
};