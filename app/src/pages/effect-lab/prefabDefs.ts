/**
 * @fileoverview 特效预制体定义（资源）
 * @description 预制体 = 游戏内一个完整事件的特效时序脚本：把原子特效（BALANCE_CONFIG.particle 驱动）、
 *              浮动文字（TEXT_CONFIG.combat 真实文案/配色）、区域标注、序列帧贴图按代码中的真实配方
 *              编排成一条时间轴。每个 prefab 的 source 字段标明配方出处（文件:行号）。
 *              仅供开发工具 EffectLab 使用，不参与游戏运行时逻辑。
 */

import type { ConeVariant } from './effectDefs';

// =========================================================================
// 步骤类型
// =========================================================================

/** 原子特效步骤可引用的生成器（对应 ParticleSpawner 各 spawn 函数） */
export type AtomKind =
  | 'explosion' | 'shockwave' | 'smoke' | 'fireRing' | 'lightning'
  | 'ash' | 'blood' | 'spark' | 'debris'
  | 'coneFire' | 'armorSpray' | 'armorPlus';

interface StepBase {
  /** 触发时刻（ms，相对一轮开始） */
  at: number;
  /** 相对锚点的偏移（px） */
  dx?: number;
  dy?: number;
}

/** 原子特效步骤：burst 类一次性触发；带 duration 时为持续窗口（每帧生成） */
export interface AtomStep extends StepBase {
  kind: 'atom';
  atom: AtomKind;
  /** burst 类数量（省略则用配方默认） */
  count?: number;
  /** 持续窗口 ms（coneFire / armorSpray 等 continuous 类） */
  duration?: number;
  /** coneFire 喷射方向（弧度，默认 -PI/2 朝上） */
  angle?: number;
  /** coneFire 射程 */
  range?: number;
  /** coneFire 火焰类型 */
  variant?: ConeVariant;
  /** armorSpray 目标点（相对锚点） */
  to?: { dx: number; dy: number };
}

/** 浮动文字步骤：还原游戏内 addFloatingText（上飘 + 淡出） */
export interface TextStep extends StepBase {
  kind: 'text';
  text: string;
  color: string;
  fontSize?: number;
  /** 存活 ms（默认 1200） */
  life?: number;
}

/** 区域/目标标注步骤（编辑器辅助可视化，游戏中对应光环/范围指示等） */
export interface MarkerStep extends StepBase {
  kind: 'marker';
  shape: 'circle' | 'rect';
  r?: number;
  w?: number;
  h?: number;
  color: string;
  /** 存活 ms（默认 800） */
  life?: number;
  /** 虚线边框 */
  dashed?: boolean;
  /**
   * 参数关键帧（打点，仅 dx/dy/r/w/h 有意义）：t 按 life 窗口归一化 0~1，
   * 存在时按关键帧插值覆盖同名常量（如气体护盾矩形虚框的展开动画），随预制体合并导出。
   */
  keys?: Partial<Record<ShapeKeyParam, Keyframe[]>>;
}

/** 序列帧 / 单图贴图步骤（还原游戏内贴图元素，如变异 7 帧、定时炸弹 bomb.png） */
export interface SpriteStep extends StepBase {
  kind: 'sprite';
  /** 单图路径（/assets/...） */
  src?: string;
  /** 序列帧路径列表 */
  frames?: string[];
  /** 每帧时长 ms（默认 200，与游戏变异动画一致） */
  frameMs?: number;
  /** 渲染缩放（绘制基准 96px × scale） */
  scale?: number;
  /** 存活 ms（序列帧省略时 = 帧数×frameMs + 100 停留） */
  life?: number;
}

/** 内联粒子步骤：游戏中不走 ParticleSpawner 的内联粒子逻辑，在此复刻 */
export interface CustomStep extends StepBase {
  kind: 'custom';
  fn: 'baitShatter' | 'baitSmell' | 'poisonPuff' | 'fanGust' | 'breachFlash' | 'shieldRepair';
  /** 持续窗口 ms（baitSmell / poisonPuff / fanGust / shieldRepair 等每帧生成类） */
  duration?: number;
}

/**
 * 渲染器直连步骤：游戏中由渲染器直接 Canvas 绘制的非粒子特效（如护士治疗光环）。
 * 预览通过构造虚拟蟑螂状态调用真实渲染函数（NurseRenderer.renderNurseHealVFX），
 * 阶段（charging/spraying/dissipating）由时间轴位置驱动，参数实时读取 BALANCE_CONFIG.render。
 */
/** 渲染器直连特效函数名（prefabRuntime.renderVfx 分发） */
export type VfxFn =
  // 武器/喷火枪
  | 'flameCone' | 'muzzleFlash'
  // 商店道具（消耗品）
  | 'fireWall' | 'swatter' | 'radarLaser' | 'insecticideSpray' | 'fan' | 'baitThrow' | 'baitAura' | 'defenseShield'
  // 掉落道具
  | 'stickyDrop' | 'weaponDrop'
  // 怪物 BUFF/机制
  | 'nurseHealAura' | 'healBuff' | 'armorRing' | 'armorCastRing' | 'slimeBurst' | 'breachWarning' | 'timedBomb';

export interface VfxStep extends StepBase {
  kind: 'vfx';
  fn: VfxFn;
  /** 持续窗口 ms（窗口内每帧渲染，应覆盖全部阶段时长） */
  duration: number;
  /** 可选触发参数（如火焰锥射程 range / 武器变体 weapon） */
  params?: Record<string, number | string>;
}

// =========================================================================
// Canvas2D 自由图形（"添加 Canvas2D 图形"功能：形状/大小/颜色/缩放动画）
// =========================================================================

/** 自由图形形状种类 */
export type ShapeKind = 'circle' | 'rect' | 'ring' | 'triangle';

/**
 * 参数关键帧（"打点"）：t = 归一化时间 0~1（相对步骤窗口 at → at+duration），v = 该时刻数值。
 * 参考 Unity Curve Editor：相邻关键帧间线性插值，端点外钳制到端点值。
 */
export interface Keyframe {
  t: number;
  v: number;
}

/** 支持打点的 ShapeStep 数值参数（无打点时回退到步骤同名常量字段） */
export type ShapeKeyParam =
  | 'dx' | 'dy'
  | 'r' | 'w' | 'h'
  | 'lineWidth' | 'alpha'
  | 'scaleAmp' | 'scaleFreq'
  | 'rotSpeed';

/**
 * 支持参数打点的步骤公共结构（shape / marker 共用）：keys 映射 + 可选数值字段。
 * KeyframableSlider 编辑器与 PrefabPlayer.evalShapeParam 以此类型抽象，两种步骤均可复用。
 */
export type KeyframableStep = {
  keys?: Partial<Record<ShapeKeyParam, Keyframe[]>>;
} & Partial<Record<ShapeKeyParam, number>>;

/** 各可打点参数的编辑器元数据（曲线编辑器纵轴范围 / 步进，与常量滑杆一致） */
export const SHAPE_KEY_META: Record<
  ShapeKeyParam,
  { label: string; min: number; max: number; step: number }
> = {
  dx: { label: '偏移 X', min: -270, max: 270, step: 1 },
  dy: { label: '偏移 Y', min: -400, max: 400, step: 1 },
  r: { label: '大小（半径）', min: 2, max: 270, step: 1 },
  w: { label: '宽度', min: 4, max: 540, step: 1 },
  h: { label: '高度', min: 4, max: 540, step: 1 },
  lineWidth: { label: '线宽', min: 1, max: 20, step: 0.5 },
  alpha: { label: '透明度', min: 0, max: 1, step: 0.01 },
  scaleAmp: { label: '缩放振幅', min: 0, max: 1, step: 0.01 },
  scaleFreq: { label: '缩放频率', min: 0, max: 5, step: 0.05 },
  rotSpeed: { label: '旋转速度', min: -3, max: 3, step: 0.05 },
};

/**
 * Canvas2D 自由图形步骤：编辑器原创图形元素（非游戏渲染器直连技能）。
 * 参数风格参考现有 Canvas2D 技能的呼吸/摇摆命名（breatheAmplitude → scaleAmp 等），
 * 但全部参数存于步骤实例本身（不写入 BALANCE_CONFIG），随预制体 steps 一并合并导出。
 * 数值参数均可打点：keys[param] 存在时按关键帧插值覆盖同名常量。
 */
export interface ShapeStep extends StepBase {
  kind: 'shape';
  shape: ShapeKind;
  /** 持续窗口 ms（窗口内每帧渲染） */
  duration: number;
  /** 主颜色（填充/描边，CSS 颜色） */
  color: string;
  /** 矩形本层透明度 0~1（缺省 1；在颜色选择行内设置，与整体透明度 alpha 叠乘） */
  fillAlpha?: number;
  /** circle / ring / triangle 外接半径 px */
  r: number;
  /** rect 宽 / 高 px（中心对齐锚点） */
  w: number;
  h: number;
  /** 填充（true）或描边（false）；ring 固定为描边 */
  fill: boolean;
  /** 填充渐变：'radial' = 中心实色 → 四周边缘透明的径向渐变（椭圆覆盖矩形；仅 fill=true 时生效，目前仅 rect 支持） */
  gradient?: 'radial';
  /** 填充混合模式：'lighter' = 叠加增亮（与背景相加，发光感）；缺省为 source-over 普通覆盖 */
  blend?: 'lighter';
  /**
   * 格子线覆盖层（rect + fill 时生效）：在矩形上叠加横竖格子线，
   * 线段透明度按椭圆径向衰减（与径向渐隐一致，边缘渐隐消失）。
   * null = 显式移除（stepOverrides 补丁语义：undefined 会被 JSON 序列化丢弃，null 可随导出保留移除状态）。
   */
  grid?: {
    /** 格子间隔 px */
    gap: number;
    /** 线宽 px */
    lineWidth: number;
    /** 线条颜色（CSS 颜色，建议亮于主色） */
    color: string;
    /** 本层透明度 0~1（缺省 1，在颜色选择行内设置，与整体透明度叠乘） */
    alpha?: number;
  } | null;
  /**
   * 扩散粒子（rect + fill + gradient='radial' 时生效）：
   * 粒子从图形中心生成，向四周随机方向匀速扩散，飞行中渐隐并轻微缩小，
   * 到达椭圆边缘附近完全消失；各粒子按相位错开循环，形成持续扩散。
   * 建议粒子颜色亮于主色（如主色 #3b82f6 → 粒子 #e0f2fe）。
   * null = 显式移除（同 grid 的补丁序列化语义）。
   */
  sparks?: {
    /** 同时在场粒子数（各自按 i/count 错相循环发射） */
    count: number;
    /** 单粒子生命周期 ms（中心 → 椭圆边缘的飞行时间） */
    life: number;
    /** 粒子半径 px */
    size: number;
    /** 粒子颜色（CSS 颜色） */
    color: string;
    /** 本层透明度 0~1（缺省 1，在颜色选择行内设置，与整体透明度叠乘） */
    alpha?: number;
    /** 叠加混合方式（缺省 'lighter'：叠加增亮，保证粒子亮度高于渐变底） */
    blend?: GlobalCompositeOperation;
  } | null;
  /** 描边线宽 px（fill=false 或 ring 时生效） */
  lineWidth: number;
  /** 整体透明度 0~1 */
  alpha: number;
  /** 缩放动画振幅（0 = 关闭；0.2 = ±20% 呼吸缩放，参考 breatheAmplitude） */
  scaleAmp: number;
  /** 缩放动画频率（次/秒，参考 breatheTimeScale） */
  scaleFreq: number;
  /** 旋转速度（圈/秒，0 = 不旋转） */
  rotSpeed: number;
  /** 结尾淡出比例 0~1（窗口最后该比例内线性淡出，0 = 不淡出） */
  fadeOut: number;
  /** 参数关键帧（打点）：t 按升序存放，存在时覆盖同名常量参数，随预制体合并导出 */
  keys?: Partial<Record<ShapeKeyParam, Keyframe[]>>;
}

/** 各形状的新建默认参数（"添加 Canvas2D 图形"选择器点击后生成的初始步骤） */
export const SHAPE_KIND_META: Record<
  ShapeKind,
  { label: string; defaults: Omit<ShapeStep, 'kind' | 'shape' | 'at'> }
> = {
  circle: {
    label: '圆形',
    defaults: {
      duration: 1500, color: '#34d399', r: 40, w: 80, h: 80,
      fill: true, lineWidth: 2, alpha: 0.85,
      scaleAmp: 0.15, scaleFreq: 1.5, rotSpeed: 0, fadeOut: 0.3,
    },
  },
  rect: {
    label: '矩形',
    defaults: {
      duration: 1500, color: '#22d3ee', r: 40, w: 120, h: 70,
      fill: false, lineWidth: 2, alpha: 0.85,
      scaleAmp: 0.1, scaleFreq: 1.2, rotSpeed: 0, fadeOut: 0.3,
    },
  },
  ring: {
    label: '圆环',
    defaults: {
      duration: 1500, color: '#fbbf24', r: 50, w: 100, h: 100,
      fill: false, lineWidth: 5, alpha: 0.9,
      scaleAmp: 0.2, scaleFreq: 1.0, rotSpeed: 0, fadeOut: 0.4,
    },
  },
  triangle: {
    label: '三角形',
    defaults: {
      duration: 1500, color: '#f472b6', r: 45, w: 90, h: 90,
      fill: true, lineWidth: 2, alpha: 0.85,
      scaleAmp: 0.12, scaleFreq: 1.5, rotSpeed: 0.5, fadeOut: 0.3,
    },
  },
};

export type PrefabStep = AtomStep | TextStep | MarkerStep | SpriteStep | CustomStep | VfxStep | ShapeStep;

// =========================================================================
// 预制体
// =========================================================================

export type PrefabCategory = 'weapon' | 'itemDrop' | 'shop' | 'skill';

export const PREFAB_CATEGORY_META: { id: PrefabCategory; label: string; en: string }[] = [
  { id: 'weapon', label: '武器', en: 'WEAPON' },
  { id: 'itemDrop', label: '掉落道具', en: 'ITEM DROPS' },
  { id: 'shop', label: '商店道具', en: 'SHOP' },
  { id: 'skill', label: '怪物技能', en: 'MONSTER SKILLS' },
];

export interface EffectPrefab {
  id: string;
  name: string;
  en: string;
  desc: string;
  category: PrefabCategory;
  /** 配方出处（代码位置，供核对） */
  source: string;
  /** 一轮时长 ms（循环播放） */
  duration: number;
  /** 事件锚点（540×800 逻辑画布坐标） */
  anchor: { x: number; y: number };
  /** 引用到的原子特效 id（EFFECTS 成员），用于聚合参数编辑与导出 */
  atoms: string[];
  steps: PrefabStep[];
}

const MUTANT_FRAMES = Array.from({ length: 7 }, (_, i) => `/assets/mutant_0${i + 1}.png`);

export const PREFABS: EffectPrefab[] = [
  // ==================== 武器（主武器喷火枪） ====================
  {
    id: 'w_flamethrower',
    name: '喷火枪火焰锥',
    en: 'FLAMETHROWER',
    desc: '主武器双层合成：Canvas 直绘火焰锥（20 段条带 + 喷嘴核心辉光，screen 混合）+ 锥形火焰粒子；颜色随武器变体切换',
    category: 'weapon',
    source: 'BackgroundRenderer.renderFireZones（render.fireZone 驱动）+ ParticleSpawner.spawnConeFire',
    duration: 3000,
    anchor: { x: 270, y: 700 },
    atoms: ['coneFire'],
    steps: [
      // Canvas 直绘火焰锥：从喷嘴（锚点上 322px）向上喷射，持续全程
      { kind: 'vfx', fn: 'flameCone', at: 0, duration: 3000, params: { range: 200, weapon: 'flamethrower' } },
      // 粒子层：从喷嘴同一点向上喷发（与直绘锥同原点）
      { kind: 'atom', atom: 'coneFire', at: 0, duration: 3000, angle: -Math.PI / 2, range: 200, dy: -322 },
      { kind: 'text', text: '喷火枪', color: '#fb923c', at: 200, dy: -360, fontSize: 15 },
    ],
  },
  {
    id: 'w_flamethrower_boost',
    name: '火力全开喷火枪',
    en: 'FLAMETHROWER+BOOST',
    desc: '火力全开状态：火焰锥叠加喷嘴强化粒子喷射（橙色粒子 + 辉光），双倍伤害视觉反馈',
    category: 'weapon',
    source: 'RenderUtils.renderMuzzleFlash（render.renderUtils.muzzleFlash 驱动，powerBoostTimer>0 触发）',
    duration: 3000,
    anchor: { x: 270, y: 700 },
    atoms: ['coneFire'],
    steps: [
      { kind: 'vfx', fn: 'flameCone', at: 0, duration: 3000, params: { range: 240, weapon: 'flamethrower' } },
      { kind: 'vfx', fn: 'muzzleFlash', at: 0, duration: 3000 },
      { kind: 'atom', atom: 'coneFire', at: 0, duration: 3000, angle: -Math.PI / 2, range: 240, dy: -322 },
      { kind: 'text', text: '>>> 火力全开 <<<', color: '#ef4444', at: 200, dy: -400, fontSize: 16 },
    ],
  },
  // ==================== 掉落道具（WEAPON_DROP_DEFS） ====================
  {
    id: 'p_pickup',
    name: '道具拾取',
    en: 'ITEM PICKUP',
    desc: '战场武器掉落物（呼吸摇摆 + 辉光环 + 名称标签）→ 点击后金色火花迸发 + 拾取文字',
    category: 'itemDrop',
    source: 'DropRenderer.renderWeaponDrops（render.drop.weapon 驱动）+ engine.ts:4691 handleItemDropClick（spark×15）',
    duration: 2400,
    anchor: { x: 270, y: 400 },
    atoms: ['spark'],
    steps: [
      // Canvas 直绘掉落物：呼吸缩放 + 摇摆 + 倾斜 + 辉光环 + 标签（先悬停展示 900ms）
      { kind: 'vfx', fn: 'weaponDrop', at: 0, duration: 950, params: { type: 'molotov' } },
      { kind: 'marker', shape: 'circle', r: 35, color: '#fbbf24', life: 500, at: 850 },
      { kind: 'atom', atom: 'spark', count: 15, at: 900 },
      { kind: 'text', text: '拾取: 燃烧瓶!', color: '#4ade80', at: 960, dy: -40 },
    ],
  },
  {
    id: 'p_molotov',
    name: '燃烧瓶爆炸',
    en: 'MOLOTOV',
    desc: '投掷落地：爆炸 + 火花 + 火环，随后沿地面宽度升起持续燃烧火墙（分段火柱 + 余烬火花）',
    category: 'itemDrop',
    source: 'ThrowableSystem:171/228（explosion×25 + spark×10）+ engine.ts:2708 activateMolotovFireWall → ParticleSystem.renderFireWalls',
    duration: 3200,
    anchor: { x: 270, y: 380 },
    atoms: ['explosion', 'spark', 'fireRing'],
    steps: [
      { kind: 'atom', atom: 'explosion', count: 25, at: 0 },
      { kind: 'atom', atom: 'spark', count: 10, at: 0 },
      { kind: 'atom', atom: 'fireRing', count: 15, at: 80 },
      { kind: 'text', text: '燃烧!', color: '#f87171', at: 60, dy: -30 },
      // Canvas 直绘火墙：爆炸后升起，分段火柱 + 核心亮线 + 外辉光 + 余烬火花
      { kind: 'vfx', fn: 'fireWall', at: 400, duration: 2400, dy: 40 },
    ],
  },
  {
    id: 'p_poison',
    name: '毒气弹爆炸',
    en: 'POISON BOMB',
    desc: '投掷落地：爆炸 + 持续扩散的绿色毒雾云（poisonCloud 内联粒子）',
    category: 'itemDrop',
    source: 'ThrowableSystem:228 + BALANCE poisonCloud（particleCount 20）',
    duration: 3400,
    anchor: { x: 270, y: 380 },
    atoms: ['explosion'],
    steps: [
      { kind: 'atom', atom: 'explosion', count: 25, at: 0 },
      { kind: 'text', text: '毒雾!', color: '#a78bfa', at: 60, dy: -30 },
      { kind: 'custom', fn: 'poisonPuff', at: 150, duration: 1800 },
    ],
  },
  {
    id: 'p_shotgun',
    name: '散弹三连喷',
    en: 'SHOTGUN',
    desc: '散弹模式：主火焰 + 两侧副火焰三路锥形喷射（每发伤害均摊）',
    category: 'itemDrop',
    source: 'engine.ts:2375（spawnConeFire × 3 方向，spreadAngle）',
    duration: 2000,
    anchor: { x: 270, y: 620 },
    atoms: ['coneFire'],
    steps: [
      { kind: 'text', text: '切换到: 散弹模式', color: '#facc15', at: 0, dy: -60 },
      { kind: 'atom', atom: 'coneFire', at: 200, duration: 300, angle: -Math.PI / 2, range: 220 },
      { kind: 'atom', atom: 'coneFire', at: 200, duration: 300, angle: -Math.PI / 2 - 0.32, range: 200 },
      { kind: 'atom', atom: 'coneFire', at: 200, duration: 300, angle: -Math.PI / 2 + 0.32, range: 200 },
    ],
  },
  {
    id: 'p_swatter',
    name: '电蚊拍全屏',
    en: 'SWATTER',
    desc: '电蚊拍自顶部扫落（拍头 + 网格 + 手柄 + 电弧）→ 全屏电击：命中目标爆出火花并麻痹 5 秒',
    category: 'itemDrop',
    source: 'RenderUtils.renderSwatter（render.renderUtils.swatter 驱动）+ SwatterSystem + engine.ts:724（spawnLightningParticles）',
    duration: 2800,
    anchor: { x: 270, y: 400 },
    atoms: ['lightning', 'spark'],
    steps: [
      // Canvas 直绘电蚊拍：拍头扫落 + 网格 + 手柄 + 拍面电弧
      { kind: 'vfx', fn: 'swatter', at: 0, duration: 1200 },
      { kind: 'atom', atom: 'lightning', at: 500 },
      { kind: 'marker', shape: 'circle', r: 14, color: '#4ade80', life: 900, at: 500, dx: -130, dy: -60 },
      { kind: 'marker', shape: 'circle', r: 14, color: '#4ade80', life: 900, at: 500, dx: 110, dy: -100 },
      { kind: 'marker', shape: 'circle', r: 14, color: '#4ade80', life: 900, at: 500, dx: 30, dy: 50 },
      { kind: 'atom', atom: 'spark', count: 8, at: 620, dx: -130, dy: -60 },
      { kind: 'atom', atom: 'spark', count: 8, at: 650, dx: 110, dy: -100 },
      { kind: 'atom', atom: 'spark', count: 8, at: 680, dx: 30, dy: 50 },
      { kind: 'text', text: '⚡电蚊拍全屏!命中3只!麻痹!', color: '#4ade80', at: 600, dy: -150 },
    ],
  },
  {
    id: 'p_radar',
    name: '雷达激光连射',
    en: 'RADAR LASER',
    desc: '自动锁定最近目标：三层辉光激光束（外/中/核心）+ 目标虚线锁定框，0.3s 间隔连射 5 发',
    category: 'itemDrop',
    source: 'RenderUtils.renderRadarLaser（render.renderUtils.radarLaser 驱动）+ RadarLaserSystem（fireInterval 0.3 / shotsRemaining 5）',
    duration: 2600,
    anchor: { x: 270, y: 380 },
    atoms: ['spark'],
    steps: [
      { kind: 'text', text: '雷达激光启动! 自动追踪目标', color: '#22d3ee', at: 0, dy: -70 },
      { kind: 'marker', shape: 'circle', r: 16, color: '#22d3ee', life: 1600, at: 0, dashed: true },
      // Canvas 直绘激光束：锚点 → 目标的三层辉光射线（每发命中同步爆火花）
      { kind: 'vfx', fn: 'radarLaser', at: 250, duration: 1400 },
      { kind: 'atom', atom: 'spark', count: 8, at: 300, dx: 60, dy: -180 },
      { kind: 'atom', atom: 'spark', count: 8, at: 600, dx: 60, dy: -180 },
      { kind: 'atom', atom: 'spark', count: 8, at: 900, dx: 60, dy: -180 },
      { kind: 'atom', atom: 'spark', count: 8, at: 1200, dx: 60, dy: -180 },
      { kind: 'atom', atom: 'spark', count: 8, at: 1500, dx: 60, dy: -180 },
      { kind: 'text', text: '激光发射完毕!', color: '#9ca3af', at: 1600, dy: -30 },
    ],
  },
  {
    id: 'p_knife',
    name: '斩螂·110 突进',
    en: 'KNIFE DASH',
    desc: '自动跃向威胁最高目标（0.18s 单程），到达后延迟 0.18s 一击必杀',
    category: 'itemDrop',
    source: 'KnifeSystem + engine.ts:2429（explosion×20）；BALANCE subway.knifeDashDuration',
    duration: 2200,
    anchor: { x: 270, y: 420 },
    atoms: ['explosion', 'blood'],
    steps: [
      { kind: 'marker', shape: 'circle', r: 18, color: '#e2e8f0', life: 400, at: 0, dashed: true },
      { kind: 'atom', atom: 'explosion', count: 20, at: 360 },
      { kind: 'atom', atom: 'blood', count: 15, at: 400 },
      { kind: 'text', text: '一击必杀!', color: '#e2e8f0', at: 420, dy: -40, fontSize: 16 },
    ],
  },
  {
    id: 'p_fan',
    name: '强力风扇启动',
    en: 'FAN',
    desc: '全场减速吹退 4 秒：透视气流线 + 阵风前沿 + 悬浮粒子 + 风扇图标/旋转叶片（真实 FanSystem 渲染）',
    category: 'itemDrop',
    source: 'FanSystem.renderFan（BALANCE fan：waveCount 18 条风纹 + particleCount 28 气流粒子）',
    duration: 3600,
    anchor: { x: 270, y: 640 },
    atoms: [],
    steps: [
      { kind: 'text', text: '强力风扇启动!', color: '#a78bfa', at: 0, dy: -180, fontSize: 16 },
      // Canvas 直绘风扇：真实 FanSystem 实例（叶片旋转 + 透视气流 + 阵风前沿）
      { kind: 'vfx', fn: 'fan', at: 100, duration: 3200 },
      { kind: 'text', text: '吹退中', color: '#a78bfa', at: 600, dy: -120 },
    ],
  },
  {
    id: 'p_sticky',
    name: '蟑螂贴板命中',
    en: 'STICKY TRAP',
    desc: '粘性弹丸飞行（辉光液滴 + 高光 + 速度拖尾）→ 命中后形成 240×240 粘板区域，粘住蟑螂 5 秒',
    category: 'itemDrop',
    source: 'DropRenderer.renderStickyDrops（render.drop.sticky 驱动）+ StickySystem（boardBaseW 240 / wrapTimer 5）',
    duration: 2600,
    anchor: { x: 270, y: 420 },
    atoms: ['spark'],
    steps: [
      // Canvas 直绘粘性弹丸：飞行中的辉光液滴 + 拖尾
      { kind: 'vfx', fn: 'stickyDrop', at: 0, duration: 600 },
      { kind: 'atom', atom: 'spark', count: 8, at: 600 },
      { kind: 'marker', shape: 'rect', w: 240, h: 240, color: '#facc15', life: 1600, at: 660, dashed: true },
      { kind: 'text', text: '粘住!', color: '#facc15', at: 750, dy: -40 },
    ],
  },
  {
    id: 'p_insecticide',
    name: '杀虫剂喷雾',
    en: 'INSECTICIDE',
    desc: '防线喷嘴向上喷出 120° 杀虫喷雾锥：边界线 + 中心虚线 + 喷嘴辉光 + 持续计时，毒杀范围内蟑螂',
    category: 'itemDrop',
    source: 'RenderUtils.renderInsecticideSpray（render.renderUtils.insecticide 驱动）+ InsecticideSystem',
    duration: 3600,
    anchor: { x: 270, y: 670 },
    atoms: [],
    steps: [
      { kind: 'text', text: '切换到: 杀虫剂', color: '#4ade80', at: 0, dy: -180 },
      // Canvas 直绘喷雾锥：渲染原点固定为防线中点（与游戏一致），持续 3s
      { kind: 'vfx', fn: 'insecticideSpray', at: 200, duration: 3100 },
    ],
  },
  // ==================== 商店道具（CONSUMABLE_DEFS） ====================
  {
    id: 'p_gas_refill',
    name: '气罐补给',
    en: 'GAS REFILL',
    desc: '立即回满燃气（250 金币，3s 冷却）：游戏内为燃气条 + 提示文字',
    category: 'shop',
    source: 'CONSUMABLE_DEFS.gas_refill + TEXT_CONFIG.combat.gasRefill',
    duration: 2000,
    anchor: { x: 270, y: 600 },
    atoms: [],
    steps: [
      { kind: 'marker', shape: 'circle', r: 30, color: '#fbbf24', life: 700, at: 0 },
      { kind: 'text', text: '燃气已回满!', color: '#fbbf24', at: 100, dy: -50, fontSize: 15 },
    ],
  },
  {
    id: 'p_defense_repair',
    name: '防线修复',
    en: 'DEFENSE REPAIR',
    desc: '防线 HP +20%（400 金币，8s 冷却）：防线处绿色修复提示',
    category: 'shop',
    source: 'CONSUMABLE_DEFS.defense_repair + ConsumableSystem（floatTextOffset.defenseRepair）',
    duration: 2200,
    anchor: { x: 270, y: 640 },
    atoms: [],
    steps: [
      { kind: 'marker', shape: 'rect', w: 540, h: 18, color: '#4ade80', life: 1400, at: 0, dy: 30, dashed: true },
      { kind: 'text', text: '修复防线 20%', color: '#4ade80', at: 100, dy: -20, fontSize: 15 },
    ],
  },
  {
    id: 'p_emergency_cool',
    name: '紧急冷却',
    en: 'EMERGENCY COOL',
    desc: '立即清除过热（200 金币，无冷却）：玩家位置白色蒸汽喷散',
    category: 'shop',
    source: 'ConsumableSystem:301（onSpawnSmokeParticles ×20 @player）',
    duration: 2000,
    anchor: { x: 270, y: 600 },
    atoms: ['smoke'],
    steps: [
      { kind: 'atom', atom: 'smoke', count: 20, at: 0 },
      { kind: 'text', text: '瞬间冷却', color: '#60a5fa', at: 100, dy: -60, fontSize: 15 },
    ],
  },
  {
    id: 'p_shield',
    name: '临时护盾',
    en: 'DEFENSE SHIELD',
    desc: '防线 5 秒无敌（800 金币，8s 冷却）：真实防线渲染 —— 流动虚线 + 青色护盾辉光线',
    category: 'shop',
    source: 'CONSUMABLE_DEFS.shield + RenderUtils.renderDefenseLine（shieldTimer>0 触发护盾辉光）',
    duration: 3000,
    anchor: { x: 270, y: 670 },
    atoms: [],
    steps: [
      { kind: 'text', text: '>>> 防线护盾 5秒 <<<', color: '#06b6d4', at: 0, dy: -80, fontSize: 16 },
      // Canvas 直绘防线护盾：流动虚线 + 底部填充 + 护盾辉光线（渲染于防线 Y 处）
      { kind: 'vfx', fn: 'defenseShield', at: 100, duration: 2400 },
      { kind: 'text', text: '护盾抵消!', color: '#22d3ee', at: 1200, dy: -40 },
    ],
  },
  {
    id: 'p_bait',
    name: '蟑螂诱饵',
    en: 'ROACH BAIT',
    desc: '玻璃罐抛物线投掷（地面阴影 + 拖尾点）→ 破碎后琥珀色气味光环（环绕玻璃碎片）聚拢全场蟑螂 3s',
    category: 'shop',
    source: 'ConsumableSystem.renderBaitThrow / renderBaitMark + ConsumableSystem:447-475（baitShatter 内联粒子）',
    duration: 4800,
    anchor: { x: 270, y: 400 },
    atoms: [],
    steps: [
      // Canvas 直绘诱饵罐投掷：从玩家位抛物线飞向锚点（0.8s）
      { kind: 'vfx', fn: 'baitThrow', at: 0, duration: 800 },
      { kind: 'custom', fn: 'baitShatter', at: 800 },
      { kind: 'text', text: '>>> 蟑螂诱饵已投放 <<<', color: '#fbbf24', at: 860, dy: -60 },
      // Canvas 直绘诱饵光环：琥珀色香味光环 + 环绕玻璃碎片（3s）
      { kind: 'vfx', fn: 'baitAura', at: 860, duration: 2900 },
      { kind: 'marker', shape: 'circle', r: 60, color: '#fbbf24', life: 2800, at: 860, dashed: true },
      { kind: 'custom', fn: 'baitSmell', at: 900, duration: 2800 },
      { kind: 'text', text: '诱饵效果 消失', color: '#fbbf24', at: 3900 },
    ],
  },
  // ==================== 怪物技能 ====================
  {
    id: 's_mutant',
    name: '变异变身',
    en: 'MUTANT TRANSFORM',
    desc: '变异蟑螂 7 帧变身序列（200ms/帧，1.3x 缩放）+ 绿色粘液爆发（中央辉光 + 12 粘液滴 + 外圈粘液环），变身完成转为大蟑螂属性',
    category: 'skill',
    source: 'RoachAISystem:1539 transformFrame=0 + engine.ts:4480-4535 slimeBurstTimer 粘液爆发（mutant_01~07.png）',
    duration: 2800,
    anchor: { x: 270, y: 400 },
    atoms: [],
    steps: [
      { kind: 'text', text: '变身大蟑螂!', color: '#fbbf24', at: 0, dy: -80, fontSize: 16 },
      // Canvas 直绘粘液爆发：变身时绿色粘液四溅（1.2s 进程，与游戏 slimeBurstTimer 一致）
      { kind: 'vfx', fn: 'slimeBurst', at: 150, duration: 1200 },
      { kind: 'sprite', frames: MUTANT_FRAMES, frameMs: 200, scale: 1.3, at: 150 },
      { kind: 'marker', shape: 'circle', r: 46, color: '#fbbf24', life: 1400, at: 150, dashed: true },
    ],
  },
  {
    id: 's_suicide',
    name: '自爆蟑螂',
    en: 'SUICIDE BOMB',
    desc: '引信触发五件套：爆炸 + 烟雾 + 碎片 + 火花 + 火环，波及周围蟑螂',
    category: 'skill',
    source: 'RoachAISystem:1127-1131 performSuicideExplosion（BALANCE roachAI.suicideExplosion：50/40/25/30/20）',
    duration: 2800,
    anchor: { x: 270, y: 420 },
    atoms: ['explosion', 'smoke', 'debris', 'spark', 'fireRing'],
    steps: [
      { kind: 'atom', atom: 'explosion', count: 50, at: 0 },
      { kind: 'atom', atom: 'smoke', count: 40, at: 0 },
      { kind: 'atom', atom: 'debris', count: 25, at: 0 },
      { kind: 'atom', atom: 'spark', count: 30, at: 0 },
      { kind: 'atom', atom: 'fireRing', count: 20, at: 0 },
      { kind: 'text', text: '大爆炸!', color: '#ff4400', at: 80, dy: -50, fontSize: 16 },
    ],
  },
  {
    id: 's_timed_bomb',
    name: '螂家爆破',
    en: 'TIMED BOMB',
    desc: '定时自爆蟑螂预警（背部红灯 3Hz 闪烁 + 地面虚线危险圈 + 抖动倒计时）→ 放置 bomb.png 定时炸弹（火焰辉光脉冲 + 缩放倒计时）→ 3s 后同归于尽级大爆炸',
    category: 'skill',
    source: 'RoachRenderer.ts:853-887 TIMED_SUICIDE warning 阶段 + engine.ts:4355-4413 placedBombs 渲染 + engine.ts:3214-3234 triggerBreachExplosion（explosion×80 + fireRing×30 + smoke×40）',
    duration: 5800,
    anchor: { x: 270, y: 560 },
    atoms: ['explosion', 'fireRing', 'smoke'],
    steps: [
      // 阶段1 Canvas 直绘：蟑螂预警（红灯闪烁 + 危险圈 + 抖动倒计时数字）
      { kind: 'vfx', fn: 'breachWarning', at: 0, duration: 1500, dy: -100 },
      { kind: 'text', text: '炸弹已安放!', color: '#ef4444', at: 1200, dy: -70 },
      // 阶段2 Canvas 直绘：落地炸弹倒计时（火焰辉光 + bomb.png + 缩放数字，最后 1s 变红闪烁）
      { kind: 'vfx', fn: 'timedBomb', at: 1300, duration: 3000 },
      // 阶段3：大爆炸
      { kind: 'atom', atom: 'explosion', count: 80, at: 4400 },
      { kind: 'atom', atom: 'fireRing', count: 30, at: 4400 },
      { kind: 'atom', atom: 'smoke', count: 40, at: 4400 },
      { kind: 'custom', fn: 'breachFlash', at: 4400 },
      { kind: 'text', text: '炸弹爆炸! -8', color: '#ef4444', at: 4480, dy: -60, fontSize: 16 },
    ],
  },
  {
    id: 's_nurse',
    name: '护士治疗',
    en: 'NURSE HEAL',
    desc: '护士蟑螂 1s 吟唱后治疗喷射：360 范围内受伤同伴恢复 20% HP（绿色 +数字）',
    category: 'skill',
    source: 'RoachAISystem:744-844 updateNurseHeal + NurseRenderer.renderNurseHealVFX（charging 1.0s → spraying 2.0s → dissipating 1.0s）',
    duration: 4000,
    anchor: { x: 270, y: 420 },
    atoms: [],
    steps: [
      // 真实光环：由 NurseRenderer.renderNurseHealVFX 逐帧绘制（render.nurseHealVFX 驱动）
      { kind: 'vfx', fn: 'nurseHealAura', at: 0, duration: 4000 },
      { kind: 'text', text: '【施法中】', color: '#4ade80', at: 0, dy: -50 },
      { kind: 'text', text: '治疗喷射!', color: '#5a8a5a', at: 1000, dy: -50, fontSize: 15 },
      { kind: 'marker', shape: 'circle', r: 16, color: '#4ade80', life: 1400, at: 1000, dx: -90, dy: 10 },
      { kind: 'marker', shape: 'circle', r: 16, color: '#4ade80', life: 1400, at: 1000, dx: 95, dy: 40 },
      // Canvas 直绘治疗 BUFF：被治疗目标身上绿色光晕 + 脉冲环 + 上升旋转 + 号（2s 循环）
      { kind: 'vfx', fn: 'healBuff', at: 1000, duration: 2000, dx: -90, dy: 10 },
      { kind: 'vfx', fn: 'healBuff', at: 1000, duration: 2000, dx: 95, dy: 40 },
      { kind: 'text', text: '+120', color: '#4ade80', at: 1150, dx: -90, dy: -20 },
      { kind: 'text', text: '+85', color: '#4ade80', at: 1300, dx: 95, dy: 10 },
    ],
  },
  {
    id: 's_armor_spray',
    name: '护甲喷涂',
    en: 'ARMOR SPRAY',
    desc: '隧道工向 300px 内同伴喷射灰蓝护甲流（+150 护甲）：施法瞬间脚下 0.5s 范围光圈脉冲（30%→100% 射程扩散渐隐），命中后目标头顶飘 + 号并套上旋转六边形护甲环',
    category: 'skill',
    source: 'RoachAISystem:886-888（spawnArmorSprayStream + spawnArmorHealPlus）+ RoachRenderer.ts:673-695 施法警示光圈（armorSprayCastTimer 0.5s）+ RoachRenderer.ts:806-845 ARMOR SHIELD EFFECT（render.roach.shield 驱动）',
    duration: 2400,
    anchor: { x: 170, y: 480 },
    atoms: ['armorSpray'],
    steps: [
      { kind: 'text', text: '护甲喷涂!', color: '#a8a29e', at: 0, dy: -40 },
      { kind: 'marker', shape: 'circle', r: 16, color: '#94a3b8', life: 1000, at: 0 },
      // Canvas 直绘施法光圈：喷涂瞬间一次范围脉冲（300px 射程，0.3→1.0 扩散 + 渐隐，压扁椭圆透视）
      { kind: 'vfx', fn: 'armorCastRing', at: 150, duration: 500 },
      { kind: 'marker', shape: 'circle', r: 16, color: '#cbd5e1', life: 1600, at: 0, dx: 200, dy: -60 },
      { kind: 'atom', atom: 'armorSpray', at: 150, duration: 700, to: { dx: 200, dy: -60 } },
      { kind: 'atom', atom: 'armorPlus', at: 900, dx: 200, dy: -60 },
      // Canvas 直绘护甲环：命中后目标获得旋转六边形护盾 + 径向内发光
      { kind: 'vfx', fn: 'armorRing', at: 900, duration: 1400, dx: 200, dy: -60 },
    ],
  },
  {
    id: 's_shield_repair',
    name: '护盾修理',
    en: 'SHIELD REPAIR',
    desc: '隧道工跟随护盾蟑螂持续修盾（10 点/秒，射程 220px）：目标身上青色修理火花持续上飘 + 护盾增亮，施法者头顶每 2s 飘「护盾修理!」',
    category: 'skill',
    source: 'RoachAISystem:892-926 updateTunnelWorker 跟随修理段（BALANCE subway.shieldRepairPerSec/shieldRepairRange + particle.shieldRepair 火花配方 + TEXT_CONFIG.combat.shieldRepair）',
    duration: 3200,
    anchor: { x: 200, y: 540 },
    atoms: [],
    steps: [
      // 施法者：隧道工（灰色标注 + 2s 节流修盾文字，颜色与游戏一致 #a8a29e）
      { kind: 'marker', shape: 'circle', r: 16, color: '#94a3b8', life: 1000, at: 0 },
      { kind: 'text', text: '护盾修理!', color: '#a8a29e', at: 0, dy: -50 },
      { kind: 'text', text: '护盾修理!', color: '#a8a29e', at: 2000, dy: -50 },
      // 目标：护盾蟑螂 + 200×360 气体护盾虚框（青色 #67e8f9，修理射程 220px 内）
      { kind: 'marker', shape: 'circle', r: 16, color: '#67e8f9', life: 3000, at: 100, dx: 100, dy: -120 },
      { kind: 'marker', shape: 'rect', w: 200, h: 360, color: '#67e8f9', life: 3000, at: 100, dx: 100, dy: -300, dashed: true },
      // 持续修理火花：青色上飘（particle.shieldRepair 配方，每帧 90% 概率，窗口覆盖整个修理过程）
      { kind: 'custom', fn: 'shieldRepair', at: 200, duration: 2800, dx: 100, dy: -120 },
    ],
  },
  {
    id: 's_shield_up',
    name: '气体护盾展开',
    en: 'GAS SHIELD',
    desc: '护盾蟑螂展开 200×360 气体护盾矩形（半宽 100，向上延伸）',
    category: 'skill',
    source: 'BALANCE subway.shieldRectHalfWidth/Height；FormationSystem 盾墙锚点',
    duration: 3200,
    anchor: { x: 270, y: 480 },
    atoms: [],
    steps: [
      { kind: 'text', text: '护盾重组!', color: '#67e8f9', at: 0, dy: -200 },
      // Canvas2D 蓝色渐变矩形光带：200×50，贴护盾区域底部内侧（区域底边 dy=0，光带中心 dy=-25），中心实蓝 → 四周渐隐
      {
        kind: 'shape', shape: 'rect', at: 100, dy: -25,
        duration: 2400, color: '#3b82f6', fillAlpha: 1,
        r: 0, w: 200, h: 50, fill: true, gradient: 'radial', blend: 'lighter',
        // 围绕原大小的循环缩放震动（小幅高频，无缩放消失）
        lineWidth: 1, alpha: 1, scaleAmp: 0.05, scaleFreq: 6, rotSpeed: 0, fadeOut: 0,
        // 格子线：横竖 5px 间隔、1px 线宽，边缘随椭圆径向渐隐
        grid: { gap: 5, lineWidth: 1, color: '#e0f2fe', alpha: 1 },
        // 扩散粒子：中心向四周扩散渐隐，900ms 生命，12 颗错相循环
        sparks: { count: 12, life: 900, size: 2.5, color: '#e0f2fe', alpha: 1 },
      },
    ],
  },
  {
    id: 's_elite',
    name: '精英轨道冲刺',
    en: 'ELITE CHARGE',
    desc: '地铁精英出场 2s 后沿轨道 460px/s 冲刺，扬尘突进至屏幕边缘',
    category: 'skill',
    source: 'RoachAISystem:947-953 + :475（BALANCE subway.eliteChargeDelay/eliteChargeSpeed）',
    duration: 2400,
    anchor: { x: 150, y: 380 },
    atoms: ['smoke'],
    steps: [
      { kind: 'text', text: '轨道冲刺!', color: '#f97316', at: 0, fontSize: 15 },
      { kind: 'marker', shape: 'rect', w: 420, h: 8, color: '#f97316', life: 900, at: 300, dx: 190, dashed: true },
      { kind: 'atom', atom: 'smoke', count: 4, at: 350, dx: 40, dy: 8 },
      { kind: 'atom', atom: 'smoke', count: 4, at: 480, dx: 170, dy: 8 },
      { kind: 'atom', atom: 'smoke', count: 4, at: 610, dx: 300, dy: 8 },
      { kind: 'atom', atom: 'smoke', count: 4, at: 740, dx: 400, dy: 8 },
    ],
  },
  {
    id: 's_queen_death',
    name: '女王死亡爆灭',
    en: 'QUEEN DEATH',
    desc: 'Boss 击杀：六件套满屏爆灭（爆炸/冲击波/烟雾/碎片/火花/火环）+ 击败文字',
    category: 'skill',
    source: 'engine.ts:3162-3166（50/40/25/30/20）+ BALANCE boss.deathExplosionParticles 60 / deathShockwaveRadius',
    duration: 3400,
    anchor: { x: 270, y: 350 },
    atoms: ['explosion', 'shockwave', 'smoke', 'debris', 'spark', 'fireRing'],
    steps: [
      { kind: 'atom', atom: 'explosion', count: 60, at: 0 },
      { kind: 'atom', atom: 'shockwave', count: 30, at: 0 },
      { kind: 'atom', atom: 'smoke', count: 40, at: 60 },
      { kind: 'atom', atom: 'debris', count: 25, at: 60 },
      { kind: 'atom', atom: 'spark', count: 30, at: 60 },
      { kind: 'atom', atom: 'fireRing', count: 20, at: 120 },
      { kind: 'text', text: 'BOSS 击败!', color: '#fbbf24', at: 100, dy: -80, fontSize: 18 },
      { kind: 'text', text: '螂老大被消灭了!', color: '#ef4444', at: 700, dy: -40 },
    ],
  },
];
