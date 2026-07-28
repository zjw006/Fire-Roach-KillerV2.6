import type { ConsumableDef } from '../types';

// ========== 消耗品定义（关卡内商店，一次性使用） ==========
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

// ========== 武器掉落配置 ==========
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

// ========== Boss 配置 ==========
export const BOSS_CONFIG = {
  queen: {
    spawnInterval: 8,
    minionCount: 3,
    phaseHpThresholds: [0.7, 0.4, 0.2],
    resistPercent: 0.5,
  },
};