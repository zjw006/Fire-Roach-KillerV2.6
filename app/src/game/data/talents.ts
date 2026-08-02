import type { Talent } from '../types';

// ========== 天赋定义 ==========
/**
 * 天赋定义列表
 * @description 定义天赋树中所有可升级的天赋项。
 * 天赋分为四大类：战斗强化（火焰伤害/射程）、生存强化（气罐容量/过热/冷却/防线）、
 * 辅助强化（赏金猎人）、道具专精（火焰亲和/机械精通/爆炸专家/节约大师/武器解锁）。
 * - maxLevel: 最大等级
 * - currentLevel: 初始等级（始终为 0）
 * - cost: 基础升级费用（金币），实际费用 = cost * talentCostScaling^level
 * - effect: 等级效果函数，返回该等级对应的属性加成对象
 */
export const TALENT_DEFS: Talent[] = [
  {
    id: 'fire_damage',
    name: '火焰强化',
    description: '火焰伤害 +15%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 100,     // 基础费用 100 金币
    effect: (level) => ({ damageMultiplier: 1 + level * 0.15 }), // 每级 +15%
  },
  {
    id: 'fire_range',
    name: '射程延伸',
    description: '火焰射程 +10%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 120,     // 射程比伤害更贵（安全性提升）
    effect: (level) => ({ fireRangeMultiplier: 1 + level * 0.1 }), // 每级 +10%
  },
  {
    id: 'gas_capacity',
    name: '扩容气罐',
    description: '燃气容量 +20%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 80,      // 较便宜，因为只是延长使用时间
    effect: (level) => ({ gasMultiplier: 1 + level * 0.2 }), // 每级 +20%
  },
  {
    id: 'overheat_resist',
    name: '耐热改造',
    description: '过热阈值 +20%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 150,     // 较贵，提升连续喷射能力
    effect: (level) => ({ overheatMultiplier: 1 + level * 0.2 }), // 每级 +20%
  },
  {
    id: 'cool_speed',
    name: '快速冷却',
    description: '冷却速度 +15%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 100,
    effect: (level) => ({ coolingMultiplier: 1 + level * 0.15 }), // 每级 +15%
  },
  {
    id: 'defense_hp',
    name: '防线加固',
    description: '防线 HP +25%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 200,     // 最贵的基础天赋，直接提升生存能力
    effect: (level) => ({ defenseMultiplier: 1 + level * 0.25 }), // 每级 +25%
  },
  // ===== 道具专精分支 (v1.2 新增) =====
  // 提升特定道具的效果，而非通用属性
  {
    id: 'fire_affinity',
    name: '火焰亲和',
    description: '燃烧瓶/火墙伤害 +10%',
    maxLevel: 3,   // 专精天赋最高 3 级
    currentLevel: 0,
    cost: 250,     // 专精天赋费用更高
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
    effect: (level) => ({ itemAmmo: level }), // 每级 +1 弹药
  },
  {
    id: 'money_boost',
    name: '赏金猎人',
    description: '击杀奖励 +10%',
    maxLevel: 5,
    currentLevel: 0,
    cost: 150,     // 中期关键天赋，提升金币获取
    effect: (level) => ({ rewardMultiplier: 1 + level * 0.1 }),
  },
  // ===== 武器解锁天赋（每种只需 1 级） =====
  // 解锁后获得新的武器模式，大幅改变战斗方式
  {
    id: 'freeze_weapon',
    name: '冷冻武器',
    description: '解锁冷冻喷雾模式',
    maxLevel: 1,   // 解锁类天赋只需 1 级
    currentLevel: 0,
    cost: 500,     // 解锁费用较高
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
    cost: 600,     // 最贵解锁（散弹三管齐发）
    effect: () => ({ unlockShotgun: 1 }),
  },
  {
    id: 'molotov_weapon',
    name: '燃烧瓶',
    description: '解锁燃烧瓶投掷',
    maxLevel: 1,
    currentLevel: 0,
    cost: 800,     // 最贵解锁（燃烧瓶高伤害）
    effect: () => ({ unlockMolotov: 1 }),
  },
];