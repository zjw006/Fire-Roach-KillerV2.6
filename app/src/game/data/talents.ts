import type { Talent } from '../types';

// ========== 天赋树定义（v3.0《改装工坊》三系树状结构） ==========
/**
 * 三分支 × 五层 + 预留槽：
 * - 猛火系 inferno：火枪伤害 · 近程爆发（T5 过载核心）
 * - 长枪系 lance：火枪射程 · 远程精准（T5 聚能长枪）
 * - 装备系 support：生存 · 经济 · 道具专精
 *
 * 核心规则：
 * - 每级统一消耗 1 点天赋点（★基石 2 点，均 1 级）
 * - 层门禁 = 本系累计投入点数：T2=2、T3=5、T4=8、T5=12（见 TALENT_TIER_GATE）
 * - 基石需直接前置满级（requiresTalent / requiresAnyTalent）
 * - T5 终端改装互斥（exclusiveGroup: 'gunT5'）
 * - effect 键合并规则：以 'Add' 结尾的键加法合并（基数 0），其余乘算合并（基数 1）
 */

/** 层门禁：层级 → 需要本系累计投入点数 */
export const TALENT_TIER_GATE: Record<number, number> = { 2: 2, 3: 5, 4: 8, 5: 12 };

export const TALENT_DEFS: Talent[] = [
  // ==================== 🔥 猛火系（伤害 · 近程爆发） ====================
  {
    id: 'pressure', name: '增压阀', description: '火焰伤害 +4%',
    maxLevel: 3, currentLevel: 0, cost: 1,
    branch: 'inferno', tier: 1,
    effect: (level) => ({ damageMultiplier: 1 + level * 0.04 }),
  },
  {
    id: 'hotfuel', name: '高温燃料', description: '火焰伤害 +5%',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'inferno', tier: 2,
    effect: (level) => ({ damageMultiplier: 1 + level * 0.05 }),
  },
  {
    id: 'alloy', name: '耐热合金', description: '过热阈值 +10%',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'inferno', tier: 2,
    effect: (level) => ({ overheatMultiplier: 1 + level * 0.10 }),
  },
  {
    id: 'bluecore', name: '蓝焰核心', description: '火焰伤害 +10%，火焰变蓝',
    maxLevel: 1, currentLevel: 0, cost: 2,
    branch: 'inferno', tier: 3, keystone: true,
    requiresTalent: ['pressure'],
    effect: () => ({ damageMultiplier: 1.10 }),
  },
  {
    id: 'burst', name: '爆燃增压', description: '火焰伤害 +4%',
    maxLevel: 3, currentLevel: 0, cost: 1,
    branch: 'inferno', tier: 4,
    effect: (level) => ({ damageMultiplier: 1 + level * 0.04 }),
  },
  {
    id: 'trimastery', name: '三联专精', description: '散弹(三联火枪)持续时间 +15%',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'inferno', tier: 4,
    effect: (level) => ({ tripleFlameDurationMult: 1 + level * 0.15 }),
  },
  {
    id: 'overdrive', name: '过载核心', description: '伤害 +25%、过热积累 +15%，火焰深红',
    maxLevel: 1, currentLevel: 0, cost: 2,
    branch: 'inferno', tier: 5, keystone: true,
    exclusiveGroup: 'gunT5',
    effect: () => ({ damageMultiplier: 1.25, overheatRateMult: 1.15 }),
  },

  // ==================== 🔵 长枪系（射程 · 远程精准） ====================
  {
    id: 'nozzle', name: '扩口喷嘴', description: '火焰射程 +6%',
    maxLevel: 3, currentLevel: 0, cost: 1,
    branch: 'lance', tier: 1,
    effect: (level) => ({ fireRangeMultiplier: 1 + level * 0.06 }),
  },
  {
    id: 'fins', name: '散热鳍片', description: '冷却速度 +10%',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'lance', tier: 2,
    effect: (level) => ({ coolingMultiplier: 1 + level * 0.10 }),
  },
  {
    id: 'tank', name: '扩容气罐', description: '燃气上限 +8%',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'lance', tier: 2,
    effect: (level) => ({ gasMultiplier: 1 + level * 0.08 }),
  },
  {
    id: 'steel', name: '寒钢枪管', description: '火焰射程 +10%，枪管变长变银',
    maxLevel: 1, currentLevel: 0, cost: 2,
    branch: 'lance', tier: 3, keystone: true,
    requiresTalent: ['nozzle'],
    effect: () => ({ fireRangeMultiplier: 1.10 }),
  },
  {
    id: 'focus', name: '风压聚焦', description: '火焰射程 +5%',
    maxLevel: 3, currentLevel: 0, cost: 1,
    branch: 'lance', tier: 4,
    effect: (level) => ({ fireRangeMultiplier: 1 + level * 0.05 }),
  },
  {
    id: 'lance', name: '聚能长枪', description: '射程 +35%、伤害 +20%，火束变白变细',
    maxLevel: 1, currentLevel: 0, cost: 2,
    branch: 'lance', tier: 5, keystone: true,
    exclusiveGroup: 'gunT5',
    effect: () => ({ fireRangeMultiplier: 1.35, damageMultiplier: 1.20 }),
  },

  // ==================== 🟢 装备系（生存 · 经济 · 道具专精） ====================
  {
    id: 'bounty', name: '赏金猎人', description: '击杀金币 +8%',
    maxLevel: 3, currentLevel: 0, cost: 1,
    branch: 'support', tier: 1,
    effect: (level) => ({ rewardMultiplier: 1 + level * 0.08 }),
  },
  {
    id: 'saver', name: '节约大师', description: '拾取道具时额外 +1 份',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'support', tier: 2,
    effect: (level) => ({ itemAmmoFlat: level }),
  },
  {
    id: 'shieldm', name: '护盾专精', description: '临时护盾无敌时长 +1 秒',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'support', tier: 2,
    effect: (level) => ({ shieldDurationAdd: level }),
  },
  {
    id: 'wall', name: '防线协议', description: '防线 HP +25%，防线加装甲板',
    maxLevel: 1, currentLevel: 0, cost: 2,
    branch: 'support', tier: 3, keystone: true,
    requiresAnyTalent: ['saver', 'shieldm'],
    effect: () => ({ defenseMultiplier: 1.25 }),
  },
  {
    id: 'mech', name: '机械精通', description: '风扇减速 +5%、持续 +10%',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'support', tier: 3,
    effect: (level) => ({ fanSlow: 1 + level * 0.05, fanDuration: 1 + level * 0.10 }),
  },
  {
    id: 'molfuel', name: '烈焰燃料', description: '燃烧瓶火墙持续 +15%、伤害 +15%',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'support', tier: 4,
    effect: (level) => ({ molotovFireZoneLifeMult: 1 + level * 0.15, fireDamage: 1 + level * 0.15 }),
  },
  {
    id: 'poisonup', name: '毒剂强化', description: '中毒 +1s、毒伤 +20%、技能/闪避封锁 +2s',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'support', tier: 4,
    effect: (level) => ({
      poisonTimerAdd: level,
      poisonDamageMult: 1 + level * 0.20,
      poisonSkillBlockAdd: level * 2,
      poisonDodgeBlockAdd: level * 2,
    }),
  },
  {
    id: 'baitm', name: '诱饵专精', description: '诱饵聚拢 +1s、吸引速度 +15%',
    maxLevel: 2, currentLevel: 0, cost: 1,
    branch: 'support', tier: 4,
    effect: (level) => ({
      baitDurationAdd: level,
      baitSpeedMult: 1 + level * 0.15,
    }),
  },
  {
    id: 'swatterm', name: '电工精通', description: '电蚊拍冷却 −15 秒、麻痹 +2 秒',
    maxLevel: 1, currentLevel: 0, cost: 2,
    branch: 'support', tier: 5, keystone: true,
    effect: () => ({ swatterCooldownAdd: -15, swatterStunAdd: 2 }),
  },
  {
    id: 'radarup', name: '雷达增程', description: '雷达激光弹匣 +6 发、射速 +15%',
    maxLevel: 1, currentLevel: 0, cost: 2,
    branch: 'support', tier: 5, keystone: true,
    effect: () => ({ radarShotsAdd: 6, radarFireIntervalMult: 0.85 }),
  },

  // ==================== 🔒 预留槽（不可升级） ====================
  {
    id: 'rsv_invoice', name: '发票专精', description: '预留：樟叔发票（赏金联动）',
    maxLevel: 0, currentLevel: 0, cost: 0,
    branch: 'support', tier: 6, reserved: true,
    effect: () => ({}),
  },
  {
    id: 'rsv_gear', name: '未来装备', description: '预留：斩螂/贴板专精',
    maxLevel: 0, currentLevel: 0, cost: 0,
    branch: 'support', tier: 6, reserved: true,
    effect: () => ({}),
  },
  {
    id: 'rsv_mk6', name: 'Mk.VI 预留插槽', description: '预留：未来武器升级系统',
    maxLevel: 0, currentLevel: 0, cost: 0,
    branch: 'inferno', tier: 6, reserved: true,
    effect: () => ({}),
  },
];

// ========== 校验辅助函数（纯函数，引擎与 UI 共用） ==========

/** 计算某分支已投入的天赋点总数（等级 × 每级费用） */
export function branchSpentPoints(talents: Record<string, number>, branch: string): number {
  let spent = 0;
  for (const def of TALENT_DEFS) {
    if (def.branch !== branch || def.reserved) continue;
    const level = talents[def.id] || 0;
    if (level > 0) spent += level * def.cost;
  }
  return spent;
}

export interface TalentCheck {
  ok: boolean;
  /** 锁定原因（UI 展示） */
  reason?: string;
}

/**
 * 校验天赋是否可升级（不含点数检查，点数由调用方检查）
 * @param def 天赋定义
 * @param talents 当前天赋等级表
 */
export function canUpgradeTalent(def: Talent, talents: Record<string, number>): TalentCheck {
  if (def.reserved) return { ok: false, reason: '预留槽位，未来开放' };

  const level = talents[def.id] || 0;
  if (level >= def.maxLevel) return { ok: false, reason: '已满级' };

  // 层门禁：本系累计投入点数
  const gate = TALENT_TIER_GATE[def.tier] || 0;
  if (gate > 0) {
    const spent = branchSpentPoints(talents, def.branch);
    if (spent < gate) return { ok: false, reason: `需要本系投入 ${gate} 点（当前 ${spent}）` };
  }

  // 前置：指定天赋全部满级
  if (def.requiresTalent) {
    for (const reqId of def.requiresTalent) {
      const reqDef = TALENT_DEFS.find(t => t.id === reqId);
      if (!reqDef) continue;
      if ((talents[reqId] || 0) < reqDef.maxLevel) {
        return { ok: false, reason: `需先点满「${reqDef.name}」` };
      }
    }
  }

  // 前置：指定天赋其一满级
  if (def.requiresAnyTalent) {
    const satisfied = def.requiresAnyTalent.some(reqId => {
      const reqDef = TALENT_DEFS.find(t => t.id === reqId);
      return reqDef && (talents[reqId] || 0) >= reqDef.maxLevel;
    });
    if (!satisfied) {
      const names = def.requiresAnyTalent
        .map(reqId => TALENT_DEFS.find(t => t.id === reqId)?.name || reqId)
        .join('」/「');
      return { ok: false, reason: `需先点满「${names}」其一` };
    }
  }

  // 互斥组：同组已有其它激活节点
  if (def.exclusiveGroup) {
    const conflict = TALENT_DEFS.find(
      t => t.exclusiveGroup === def.exclusiveGroup && t.id !== def.id && (talents[t.id] || 0) > 0
    );
    if (conflict) return { ok: false, reason: `与「${conflict.name}」互斥` };
  }

  return { ok: true };
}
