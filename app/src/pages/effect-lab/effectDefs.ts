/**
 * @fileoverview 特效工作台特效清单（资源定义）
 * @description 每个特效对应游戏内真实的 ParticleSpawner 生成函数 + BALANCE_CONFIG.particle 配置组。
 *              sections[].path 标记配置在 particle 节点中的路径（用于单特效导出）；
 *              category 用于资源管理器分组；mode 决定预览循环的触发方式。
 *              仅供开发工具 EffectLab 使用，不参与游戏运行时逻辑。
 */

import { BALANCE_CONFIG } from '@/game/data';
import type { ParamSection } from './ParamPanel';
import { deepClone, type AnyRecord } from './effectLabUtils';

/** 活动的可编辑配置（BALANCE_CONFIG.particle 的可变别名，原地修改即被生成器读取） */
export const particleCfg = BALANCE_CONFIG.particle as unknown as AnyRecord;
/** 初始值备份（模块加载时快照，用于"重置全部参数"） */
export const backupCfg = deepClone(particleCfg);

/** 活动的可编辑渲染配置（BALANCE_CONFIG.render 的可变别名，渲染器直连特效使用） */
export const renderCfg = BALANCE_CONFIG.render as unknown as AnyRecord;
/** 渲染配置初始值备份（与 backupCfg 一同用于"重置全部参数"） */
export const backupRenderCfg = deepClone(renderCfg);

export type ConeVariant = 'fire' | 'ice' | 'poison';

/** 资源管理器分组 */
export type EffectCategory = 'attack' | 'impact' | 'defense';

export const CATEGORY_META: { id: EffectCategory; label: string; en: string }[] = [
  { id: 'attack', label: '攻击特效', en: 'ATTACK' },
  { id: 'impact', label: '命中反馈', en: 'IMPACT' },
  { id: 'defense', label: '防御支援', en: 'DEFENSE' },
];

export interface TriggerDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface EffectSection extends ParamSection {
  /** 配置路径（如 'ash' / 'physics.ash'），含点号 = 共享组 */
  path: string;
}

export interface EffectDef {
  id: string;
  name: string;
  en: string;
  desc: string;
  category: EffectCategory;
  /** continuous = 每帧持续生成（锥形火焰）；burst = 按间隔触发 */
  mode: 'continuous' | 'burst';
  sections: EffectSection[];
  triggers: TriggerDef[];
}

/**
 * 聚合多个原子特效的参数分组（预制体模式使用）：
 * 按 path+标题 去重 —— 共享物理组（physics.xxx）只出现一次，
 * 避免同一配置在面板中重复渲染、重复编辑；
 * 同 path 的不同子分组（如喷火枪的 发射器/粒子大小/粒子颜色）仍会全部保留。
 */
export function sectionsForAtoms(atomIds: string[]): EffectSection[] {
  const seen = new Set<string>();
  const out: EffectSection[] = [];
  for (const id of atomIds) {
    const def = EFFECTS.find((e) => e.id === id);
    if (!def) continue;
    for (const sec of def.sections) {
      const key = `${sec.path}|${sec.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(sec);
    }
  }
  return out;
}

/**
 * 预制体专属的非 particle 配置节（渲染器直连特效等，key = 预制体 id）。
 * obj 指向 BALANCE_CONFIG.render 子节点（原地编辑即被游戏渲染器读取）；
 * path 以 render. 开头（相对 BALANCE_CONFIG 根，供导出定位）。
 */
export const PREFAB_CONFIG_SECTIONS: Record<string, EffectSection[]> = {
  // 护士治疗：光环由 NurseRenderer.renderNurseHealVFX 直接 Canvas 绘制（非粒子）
  s_nurse: [
    {
      title: '光环通用（范围/锚点偏移）',
      obj: renderCfg.nurseHealVFX,
      path: 'render.nurseHealVFX',
      keys: ['healRange', 'footYOffset'],
      hint: 'healRange 仅控制光环绘制半径；逻辑治疗判定半径在 RoachAISystem:748 硬编码为 360，两者独立',
    },
    {
      title: '蓄力阶段光环（扩张环 + 脉冲点 + 心电图线）',
      obj: renderCfg.nurseHealVFX.charge,
      path: 'render.nurseHealVFX.charge',
    },
    {
      title: '喷射阶段光环（雾团 + 双层环 + 旋转刻度）',
      obj: renderCfg.nurseHealVFX.spray,
      path: 'render.nurseHealVFX.spray',
      hint: 'mistDirs / ringInnerDash 为数组常量，不在面板中显示（直接改 render-balance.ts）',
    },
    {
      title: '消散阶段光环（淡出环 + 收缩点）',
      obj: renderCfg.nurseHealVFX.dissipate,
      path: 'render.nurseHealVFX.dissipate',
    },
  ],
};

export const EFFECTS: EffectDef[] = [
  // ==================== 攻击特效 ====================
  {
    id: 'coneFire',
    name: '喷火枪',
    en: 'FLAMETHROWER',
    desc: '主武器：喷嘴持续喷射锥形火焰（火焰/余烬粒子 + 枪口火花），含冰冻/毒气变体',
    category: 'attack',
    mode: 'continuous',
    sections: [
      {
        title: '发射器（发射频率/扩散角/流速）',
        obj: particleCfg.coneFire,
        path: 'coneFire',
        keys: ['countMin', 'countMax', 'angleSpread', 'flowSpeedMin', 'flowSpeedMax', 'lifeMin', 'lifeMax'],
        hint: '发射口张角（angleSpread）控制火焰锥的开口大小；喷射长度由下方触发参数「喷射射程」控制',
      },
      {
        title: '粒子大小（火焰/余烬/火花）',
        obj: particleCfg.coneFire,
        path: 'coneFire',
        keys: ['fireSizeMin', 'fireSizeMax', 'emberSizeMin', 'emberSizeMax', 'sparkSizeMin', 'sparkSizeMax'],
      },
      {
        title: '粒子颜色（火焰/余烬）',
        obj: particleCfg.coneFire,
        path: 'coneFire',
        keys: ['fireColor', 'emberColor'],
      },
      {
        title: '枪口火花（喷嘴发射点）',
        obj: particleCfg.coneFire.muzzleSpark,
        path: 'coneFire.muzzleSpark',
      },
      {
        title: '变体颜色（冰冻/毒气）',
        obj: particleCfg.coneFire,
        path: 'coneFire',
        keys: ['iceColor', 'poisonColor'],
        hint: '仅冰冻/毒气喷射变体生效',
      },
      {
        title: '物理 physics.fire',
        obj: particleCfg.physics.fire,
        path: 'physics.fire',
        hint: '共享参数：同时影响冲击波内层火花',
      },
      {
        title: '物理 physics.ice',
        obj: particleCfg.physics.ice,
        path: 'physics.ice',
        hint: '仅冰冻火焰类型生效',
      },
      {
        title: '物理 physics.poisonCloud',
        obj: particleCfg.physics.poisonCloud,
        path: 'physics.poisonCloud',
        hint: '仅毒气火焰类型生效',
      },
    ],
    triggers: [
      { key: 'range', label: '喷射射程', min: 60, max: 360, step: 5, defaultValue: 200 },
    ],
  },
  {
    id: 'explosion',
    name: '爆炸',
    en: 'EXPLOSION',
    desc: '径向爆发的橙红粒子团（燃烧瓶/自爆蟑螂）',
    category: 'attack',
    mode: 'burst',
    sections: [
      { title: '生成参数 explosion', obj: particleCfg.explosion, path: 'explosion' },
      {
        title: '物理 physics.explosion',
        obj: particleCfg.physics.explosion,
        path: 'physics.explosion',
        hint: '共享参数：同时影响冲击波外层扩散环与火环',
      },
    ],
    triggers: [
      { key: 'count', label: '单次数量', min: 5, max: 120, step: 1, defaultValue: 40 },
      { key: 'interval', label: '触发间隔 (ms)', min: 300, max: 3000, step: 50, defaultValue: 900 },
    ],
  },
  {
    id: 'shockwave',
    name: '冲击波',
    en: 'SHOCKWAVE',
    desc: '外层扩散环 + 内层白色核心爆发（大型爆炸）',
    category: 'attack',
    mode: 'burst',
    sections: [
      { title: '生成参数 shockwave', obj: particleCfg.shockwave, path: 'shockwave' },
      {
        title: '物理（外层爆炸）physics.explosion',
        obj: particleCfg.physics.explosion,
        path: 'physics.explosion',
        hint: '共享参数：同时影响爆炸与火环',
      },
      {
        title: '物理（内层火花）physics.fire',
        obj: particleCfg.physics.fire,
        path: 'physics.fire',
        hint: '共享参数：同时影响锥形火焰',
      },
    ],
    triggers: [
      { key: 'count', label: '外环数量', min: 8, max: 64, step: 1, defaultValue: 24 },
      { key: 'interval', label: '触发间隔 (ms)', min: 400, max: 3000, step: 50, defaultValue: 1200 },
    ],
  },
  {
    id: 'fireRing',
    name: '火环',
    en: 'FIRE RING',
    desc: '爆炸冲击波式的环形火焰扩散（均匀圆周分布）',
    category: 'attack',
    mode: 'burst',
    sections: [
      { title: '生成参数 fireRing', obj: particleCfg.fireRing, path: 'fireRing' },
      {
        title: '物理 physics.explosion',
        obj: particleCfg.physics.explosion,
        path: 'physics.explosion',
        hint: '共享参数：同时影响爆炸与冲击波外层',
      },
    ],
    triggers: [
      { key: 'count', label: '单环数量', min: 8, max: 72, step: 1, defaultValue: 36 },
      { key: 'interval', label: '触发间隔 (ms)', min: 400, max: 3000, step: 50, defaultValue: 1100 },
    ],
  },
  {
    id: 'lightning',
    name: '闪电',
    en: 'LIGHTNING',
    desc: '电蚊拍全屏电击：顶部电弧 + 全屏竖直电光',
    category: 'attack',
    mode: 'burst',
    sections: [
      { title: '生成参数 lightning', obj: particleCfg.lightning, path: 'lightning' },
      { title: '物理 physics.lightning', obj: particleCfg.physics.lightning, path: 'physics.lightning' },
    ],
    triggers: [
      { key: 'interval', label: '触发间隔 (ms)', min: 200, max: 2000, step: 50, defaultValue: 800 },
    ],
  },
  // ==================== 命中反馈 ====================
  {
    id: 'smoke',
    name: '烟雾',
    en: 'SMOKE',
    desc: '蟑螂死亡时的灰色烟团，缓慢上升并膨胀',
    category: 'impact',
    mode: 'burst',
    sections: [
      { title: '生成参数 smoke', obj: particleCfg.smoke, path: 'smoke' },
      { title: '物理 physics.smoke', obj: particleCfg.physics.smoke, path: 'physics.smoke' },
    ],
    triggers: [
      { key: 'count', label: '单次数量', min: 3, max: 60, step: 1, defaultValue: 20 },
      { key: 'interval', label: '触发间隔 (ms)', min: 300, max: 3000, step: 50, defaultValue: 1000 },
    ],
  },
  {
    id: 'ash',
    name: '灰烬',
    en: 'ASH',
    desc: '蟑螂烧死后的灰黑余烬，受重力下落并在防线处反弹',
    category: 'impact',
    mode: 'burst',
    sections: [
      { title: '生成参数 ash', obj: particleCfg.ash, path: 'ash' },
      {
        title: '物理 physics.ash',
        obj: particleCfg.physics.ash,
        path: 'physics.ash',
        hint: '共享参数：同时影响碎片特效',
      },
    ],
    triggers: [
      { key: 'count', label: '单次数量', min: 5, max: 80, step: 1, defaultValue: 30 },
      { key: 'interval', label: '触发间隔 (ms)', min: 300, max: 3000, step: 50, defaultValue: 900 },
    ],
  },
  {
    id: 'blood',
    name: '血液',
    en: 'BLOOD',
    desc: '蟑螂被击中时溅出的暗绿色血滴，受重力下坠',
    category: 'impact',
    mode: 'burst',
    sections: [
      { title: '生成参数 blood', obj: particleCfg.blood, path: 'blood' },
      { title: '物理 physics.blood', obj: particleCfg.physics.blood, path: 'physics.blood' },
    ],
    triggers: [
      { key: 'count', label: '单次数量', min: 5, max: 80, step: 1, defaultValue: 25 },
      { key: 'interval', label: '触发间隔 (ms)', min: 300, max: 3000, step: 50, defaultValue: 800 },
    ],
  },
  {
    id: 'spark',
    name: '火花',
    en: 'SPARK',
    desc: '金属碰撞/爆炸产生的橙黄火花，短促径向飞散',
    category: 'impact',
    mode: 'burst',
    sections: [{ title: '生成参数 spark', obj: particleCfg.spark, path: 'spark' }],
    triggers: [
      { key: 'count', label: '单次数量', min: 5, max: 100, step: 1, defaultValue: 30 },
      { key: 'interval', label: '触发间隔 (ms)', min: 200, max: 2000, step: 50, defaultValue: 500 },
    ],
  },
  {
    id: 'debris',
    name: '碎片',
    en: 'DEBRIS',
    desc: '装甲蟑螂破甲时崩出的暗棕碎片（粒子类型为 ASH，与灰烬共用物理）',
    category: 'impact',
    mode: 'burst',
    sections: [
      { title: '生成参数 debris', obj: particleCfg.debris, path: 'debris' },
      {
        title: '物理 physics.ash',
        obj: particleCfg.physics.ash,
        path: 'physics.ash',
        hint: '共享参数：同时影响灰烬特效',
      },
    ],
    triggers: [
      { key: 'count', label: '单次数量', min: 5, max: 80, step: 1, defaultValue: 20 },
      { key: 'interval', label: '触发间隔 (ms)', min: 400, max: 3000, step: 50, defaultValue: 1100 },
    ],
  },
  // ==================== 防御支援 ====================
  {
    id: 'shieldAura',
    name: '护盾光环',
    en: 'SHIELD AURA',
    desc: '护盾蟑螂的青色气体能量场，静止悬浮并充满整个护盾矩形区',
    category: 'defense',
    mode: 'continuous',
    sections: [
      {
        title: '生成参数 shieldAura',
        obj: particleCfg.shieldAura,
        path: 'shieldAura',
        hint: '纵向延伸高度取 subway.shieldRectHeight（360），不在本面板',
      },
    ],
    triggers: [
      { key: 'hw', label: '护盾半宽 (px)', min: 40, max: 160, step: 5, defaultValue: 100 },
    ],
  },
  {
    id: 'armorSpray',
    name: '护甲喷涂',
    en: 'ARMOR SPRAY',
    desc: '隧道工向同伴喷射灰蓝护甲流，命中后目标头顶飘 + 号',
    category: 'defense',
    mode: 'burst',
    sections: [{ title: '生成参数 armorSpray', obj: particleCfg.armorSpray, path: 'armorSpray' }],
    triggers: [
      { key: 'interval', label: '触发间隔 (ms)', min: 300, max: 3000, step: 50, defaultValue: 700 },
    ],
  },
  {
    id: 'shieldRepair',
    name: '护盾修复',
    en: 'SHIELD REPAIR',
    desc: '隧道工修理护盾时的青色火花，按帧概率持续冒泡上升',
    category: 'defense',
    mode: 'continuous',
    sections: [
      {
        title: '生成参数 shieldRepair',
        obj: particleCfg.shieldRepair,
        path: 'shieldRepair',
        hint: '游戏中由 RoachAISystem 内联生成，此处复刻同一逻辑',
      },
    ],
    triggers: [],
  },
];
