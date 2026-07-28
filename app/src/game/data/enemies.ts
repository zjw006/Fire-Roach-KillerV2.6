import { RoachType } from '../types';

// ========== 敌人属性定义 ==========
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
  // ========== 医院场景专属蟑螂 ==========
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