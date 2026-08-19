/**
 * @fileoverview 天赋树（v4 三系树状结构）单元测试
 * @description 覆盖层门禁/前置满级/任选前置/互斥组/预留槽/满级校验，
 * 以及 v3→v4 存档迁移（等级映射 + 点数重算 + 待解锁池）。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TALENT_DEFS, TALENT_TIER_GATE, branchSpentPoints, canUpgradeTalent } from '../../../src/game/data/talents';
import { SaveSystem } from '../../../src/game/engine/save/SaveSystem';

const def = (id: string) => {
  const d = TALENT_DEFS.find(t => t.id === id);
  if (!d) throw new Error(`talent not found: ${id}`);
  return d;
};

describe('canUpgradeTalent 门禁校验', () => {
  it('T1 节点无门槛，可直接升级', () => {
    expect(canUpgradeTalent(def('pressure'), {}).ok).toBe(true);
    expect(canUpgradeTalent(def('nozzle'), {}).ok).toBe(true);
    expect(canUpgradeTalent(def('bounty'), {}).ok).toBe(true);
  });

  it('层门禁：T2 需要本系累计投入 2 点', () => {
    // 未投入 → 锁定，原因含点数门槛
    const locked = canUpgradeTalent(def('hotfuel'), {});
    expect(locked.ok).toBe(false);
    expect(locked.reason).toContain(`${TALENT_TIER_GATE[2]}`);
    // 猛火系投入 2 点（增压阀 L2）→ 解锁
    expect(canUpgradeTalent(def('hotfuel'), { pressure: 2 }).ok).toBe(true);
    // 跨系投入不计入
    expect(canUpgradeTalent(def('hotfuel'), { nozzle: 3 }).ok).toBe(false);
  });

  it('层门禁：T5 需要本系累计投入 12 点（基石造价计入）', () => {
    // 猛火系：pressure3 + hotfuel2 + alloy2 + bluecore(2点) + burst3 = 12
    const spent12 = { pressure: 3, hotfuel: 2, alloy: 2, bluecore: 1, burst: 3 };
    expect(branchSpentPoints(spent12, 'inferno')).toBe(12);
    expect(canUpgradeTalent(def('overdrive'), spent12).ok).toBe(true);
    // 11 点差 1 → 锁定
    const spent11 = { ...spent12, burst: 2 };
    expect(canUpgradeTalent(def('overdrive'), spent11).ok).toBe(false);
  });

  it('前置：蓝焰核心需增压阀满级', () => {
    const base = { pressure: 2, hotfuel: 2, alloy: 1 }; // 本系 5 点过 T3 门槛
    const locked = canUpgradeTalent(def('bluecore'), base);
    expect(locked.ok).toBe(false);
    expect(locked.reason).toContain('增压阀');
    expect(canUpgradeTalent(def('bluecore'), { ...base, pressure: 3 }).ok).toBe(true);
  });

  it('任选前置：防线协议需节约大师/护盾专精其一满级', () => {
    const base = { bounty: 3, saver: 1, shieldm: 1 }; // 本系 5 点过 T3 门槛
    expect(canUpgradeTalent(def('wall'), base).ok).toBe(false);
    expect(canUpgradeTalent(def('wall'), { ...base, saver: 2 }).ok).toBe(true);
    expect(canUpgradeTalent(def('wall'), { ...base, shieldm: 2 }).ok).toBe(true);
  });

  it('互斥组：过载核心/聚能长枪择一后另一永久锁定', () => {
    // 长枪系需先过 T5 层门禁（12 点）才会校验到互斥组
    const talents = {
      nozzle: 3, fins: 2, tank: 2, steel: 1, focus: 3, // 长枪系 12 点
      overdrive: 1,                                     // 互斥组另一方已激活
    };
    const locked = canUpgradeTalent(def('lance'), talents);
    expect(locked.ok).toBe(false);
    expect(locked.reason).toContain('互斥');
    // 反向：未激活过载核心时可升级
    const { overdrive: _omit, ...noOverdrive } = talents;
    expect(canUpgradeTalent(def('lance'), noOverdrive).ok).toBe(true);
  });

  it('满级节点不可再升级', () => {
    expect(canUpgradeTalent(def('pressure'), { pressure: 3 }).ok).toBe(false);
  });

  it('预留槽不可升级', () => {
    const res = canUpgradeTalent(def('rsv_invoice'), {});
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('预留');
  });

  it('branchSpentPoints 不统计预留槽与其他分支', () => {
    expect(branchSpentPoints({ pressure: 3, rsv_mk6: 0, nozzle: 3 }, 'inferno')).toBe(3);
  });
});

describe('SaveSystem v3→v4 存档迁移', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
  });

  const saveV3 = (data: any) => {
    store['roach_blaster_progress'] = JSON.stringify({ saveVersion: 3, ...data });
  };

  it('旧天赋等级映射（只降不升）+ 点数按新经济表重算', () => {
    saveV3({
      talentTree: {
        points: 99999, // 旧尺度余额应被丢弃
        talents: {
          fire_damage: 5,          // → pressure L3
          money_boost: 4,          // → bounty L2
          mechanical_mastery: 3,   // → mech L2
          fire_affinity: 2,        // → molfuel L1（与 explosive_expert 取最高）
          defense_hp: 2,           // <L3 → 退款不映射
          freeze_weapon: 1,        // 死天赋 → 退款不映射
        },
      },
      scenesCompleted: ['kitchen', 'sewer', 'dump', 'basement', 'street'],
      levelStars: { kitchen: 3, sewer: 3 },
    });

    const p = SaveSystem.loadProgress();
    // 映射结果
    expect(p.talentTree.talents).toEqual({ pressure: 3, bounty: 2, mech: 2, molfuel: 1 });
    // 收入：perScene 0+0+0+4+2=6 + 三星 2×1=2（已解锁直接计入）= 8
    // 造价：pressure3 + bounty2 + mech2 + molfuel1 = 8 → 余额 0
    expect(p.talentTree.points).toBe(0);
    expect(p.pendingTalentPoints).toBe(0);
    // 存档版本已升级
    expect(JSON.parse(store['roach_blaster_progress']).saveVersion).toBe(4);
  });

  it('天赋未解锁时三星点存入待解锁池', () => {
    saveV3({
      talentTree: { points: 500, talents: { fire_range: 1 } }, // → nozzle L1（造价 1）
      scenesCompleted: ['kitchen', 'sewer'],
      levelStars: { kitchen: 3 },
    });

    const p = SaveSystem.loadProgress();
    expect(p.talentTree.talents).toEqual({ nozzle: 1 });
    // 收入 0 − 造价 1 → 下限 0
    expect(p.talentTree.points).toBe(0);
    // 三星 1×1 存入待解锁池
    expect(p.pendingTalentPoints).toBe(1);
  });

  it('defense_hp ≥L3 映射为防线协议（基石 2 点造价）', () => {
    saveV3({
      talentTree: { points: 0, talents: { defense_hp: 5 } }, // → wall L1（造价 2）
      scenesCompleted: ['kitchen', 'sewer', 'dump', 'basement', 'rooftop', 'hospital'],
      levelStars: {},
    });

    const p = SaveSystem.loadProgress();
    expect(p.talentTree.talents).toEqual({ wall: 1 });
    // 收入：0+0+0+4+2+3=9 − 造价 2 = 7
    expect(p.talentTree.points).toBe(7);
  });
});
