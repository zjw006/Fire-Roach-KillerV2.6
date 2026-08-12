/**
 * @fileoverview 特效工作台工具函数
 * @description 配置深拷贝/回写、滑杆范围推断、中文字典、TS 片段导出。
 *              仅供开发工具 EffectLab 使用，不参与游戏运行时逻辑。
 */

/** 宽松的可索引对象类型（用于绕过 BALANCE_CONFIG 的 as const 只读字面量类型） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRecord = Record<string, any>;

/** 深拷贝（配置对象均为纯数据，JSON 序列化即可） */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * 将 source 的所有叶子值回写到 target（保持 target 引用不变）。
 * 关键：ParticleSpawner 直接读取 BALANCE_CONFIG 单例，
 * 必须原地修改才能让预览与游戏内表现一致。
 */
export function deepAssign(target: AnyRecord, source: AnyRecord): void {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv)) {
      if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
      deepAssign(target[key] as AnyRecord, sv as AnyRecord);
    } else {
      target[key] = sv;
    }
  }
}

/** 将配置对象序列化为可粘贴回 render-balance.ts 的 TS 片段（键名去引号） */
export function toTsLiteral(obj: unknown, indent = 2): string {
  const json = JSON.stringify(obj, null, indent);
  return json.replace(/"([A-Za-z_$][\w$]*)":/g, '$1:');
}

/** 生成整段 particle 配置的导出片段 */
export function exportParticleSnippet(particle: AnyRecord): string {
  return [
    '// ===== 粒子生成器配置（由特效工作台导出）=====',
    '// 用法：整体替换 src/game/data/render-balance.ts 中的 particle: { ... } 节点',
    `particle: ${toTsLiteral(particle, 2)},`,
    '',
  ].join('\n');
}

export interface SliderRange {
  min: number;
  max: number;
  step: number;
}

/**
 * 根据键名与当前值推断滑杆范围（仅影响 UI 控件手感，数值输入框不受此限制）
 */
export function guessRange(key: string, value: number): SliderRange {
  const k = key.toLowerCase();
  const v = Math.abs(value);

  if (/chance|prob/.test(k)) return { min: 0, max: 1, step: 0.01 };
  if (/^radius(min|max)?$/.test(k)) return { min: 0, max: 1.5, step: 0.01 };
  if (/hue/.test(k)) return { min: 0, max: 360, step: 1 };
  if (/saturation|lightness/.test(k)) return { min: 0, max: 100, step: 1 };
  if (/^a(min|max)?$/.test(k) || /alpha/.test(k)) return { min: 0, max: 1, step: 0.01 };
  if (/angle|spread|phase/.test(k)) return { min: 0, max: 6.3, step: 0.01 };
  if (/decay|growth|bounce/.test(k)) return { min: 0.8, max: 1.2, step: 0.001 };
  if (/multiplier/.test(k)) return { min: 0, max: Math.max(5, v * 2), step: 0.05 };
  // 小数值比例（ringScaleRatio 等）需要细粒度滑杆；大比例（>2）保持宽范围
  if (/ratio/.test(k) && v <= 2) return { min: 0, max: 2, step: 0.01 };
  if (/freq|ratio/.test(k)) return { min: 0, max: Math.max(10, v * 2.5), step: 0.05 };
  if (/count/.test(k)) return { min: 0, max: Math.max(60, v * 3), step: 1 };
  if (/life/.test(k)) return { min: 0.01, max: Math.max(3, v * 3), step: 0.01 };
  if (/size|radius/.test(k)) return { min: 0, max: Math.max(30, v * 3), step: 0.1 };
  if (/speed|vx|vy|gravity|bias|range|offset/.test(k)) {
    return { min: Math.min(0, value * 2), max: Math.max(50, v * 3), step: 1 };
  }
  return { min: Math.min(0, value * 2), max: v === 0 ? 10 : v * 2.5, step: v < 2 ? 0.01 : 1 };
}

/** 常用参数字段的中文说明（未命中时回退为原始键名） */
const KEY_LABELS: Record<string, string> = {
  count: '数量',
  countMin: '每帧发射数下限',
  countMax: '每帧发射数上限',
  countPerFrame: '每帧数量',
  life: '存活时间(s)',
  lifeMin: '存活下限(s)',
  lifeMax: '存活上限(s)',
  speedMin: '速度下限',
  speedMax: '速度上限',
  size: '大小',
  sizeMin: '大小下限',
  sizeMax: '大小上限',
  vyBias: '垂直偏置',
  vxRange: '水平速度幅',
  vyBase: '垂直速度基值',
  vyRange: '垂直速度幅',
  offsetX: '水平散布(px)',
  offsetY: '垂直散布(px)',
  offsetXY: '位置散布(px)',
  angleSpread: '发射口张角(rad)',
  flowSpeedMin: '流速下限',
  flowSpeedMax: '流速上限',
  fireSizeMin: '火焰粒子下限(px)',
  fireSizeMax: '火焰粒子上限(px)',
  emberSizeMin: '余烬粒子下限(px)',
  emberSizeMax: '余烬粒子上限(px)',
  sparkSizeMin: '火花粒子下限(px)',
  sparkSizeMax: '火花粒子上限(px)',
  hue: '色相',
  hueMin: '色相下限',
  hueMax: '色相上限',
  saturation: '饱和度(%)',
  lightness: '亮度(%)',
  lightnessMin: '亮度下限(%)',
  lightnessMax: '亮度上限(%)',
  alphaMin: '透明度下限',
  alphaMax: '透明度上限',
  vyDecay: '垂直衰减/帧',
  vxDecay: '水平衰减/帧',
  sizeDecay: '大小衰减/帧',
  sizeGrowth: '大小增长/帧',
  vyGravity: '重力(px/s²)',
  lifeMultiplier: '生命消耗倍率',
  defenseLineOffset: '防线停靠偏移',
  bounceVx: '反弹水平系数',
  outerSpeedMin: '外层速度下限',
  outerSpeedMax: '外层速度上限',
  outerLifeMin: '外层存活下限',
  outerLifeMax: '外层存活上限',
  outerSizeMin: '外层大小下限',
  outerSizeMax: '外层大小上限',
  innerCount: '内层数量',
  innerSpeedMin: '内层速度下限',
  innerSpeedMax: '内层速度上限',
  innerLifeMin: '内层存活下限',
  innerLifeMax: '内层存活上限',
  innerSizeMin: '内层大小下限',
  innerSizeMax: '内层大小上限',
  topCount: '顶部电弧数量',
  topWidthRatio: '顶部宽度占比',
  topYRange: '顶部纵向范围',
  topVxRange: '顶部水平速度幅',
  topVyMin: '顶部垂直速度下限',
  topVyMax: '顶部垂直速度上限',
  topLifeMin: '顶部存活下限',
  topLifeMax: '顶部存活上限',
  topSizeMin: '顶部大小下限',
  topSizeMax: '顶部大小上限',
  fullCount: '全屏闪电数量',
  fullVxRange: '全屏水平速度幅',
  fullVyRange: '全屏垂直速度幅',
  fullLifeMin: '全屏存活下限',
  fullLifeMax: '全屏存活上限',
  fullSizeMin: '全屏大小下限',
  fullSizeMax: '全屏大小上限',
  vyMin: '垂直速度下限',
  vyMax: '垂直速度上限',
  color: '颜色',
  intensityMultiplier: '强度倍率',
  maxCount: '最大数量',
  r: '红(R)',
  g: '绿(G)',
  b: '蓝(B)',
  rMin: '红(R)下限',
  rMax: '红(R)上限',
  gMin: '绿(G)下限',
  gMax: '绿(G)上限',
  bMin: '蓝(B)下限',
  bMax: '蓝(B)上限',
  aMin: '不透明度下限',
  aMax: '不透明度上限',
  radiusMin: '散布半径系数下限',
  radiusMax: '散布半径系数上限',
  pulseFreqBase: '脉冲频率基础',
  pulseFreqVar: '脉冲频率随机',
  phaseOffset: '相位偏移(rad)',
  streamCount: '喷射流数量',
  streamLifeMin: '喷射流存活下限',
  streamLifeMax: '喷射流存活上限',
  streamSizeMin: '喷射流大小下限',
  streamSizeMax: '喷射流大小上限',
  streamSpeedMin: '喷射流速度下限',
  streamSpeedMax: '喷射流速度上限',
  streamSpread: '喷射扩散角(rad)',
  plusLife: '+号存活(s)',
  plusSize: '+号大小',
  plusVy: '+号上升速度',
  plusColor: '+号颜色',
  spawnChance: '生成概率/帧',
  // ===== 护士治疗光环（render.nurseHealVFX） =====
  healRange: '光环范围(px)',
  footYOffset: '脚部锚点Y偏移(px)',
  ringScaleRatio: '光环X半径比例',
  ringYScaleRatio: '光环Y半径比例（椭圆压扁）',
  glowAlphaBase: '辉光基础透明度',
  glowAlphaRange: '辉光透明度变化幅',
  ringAlphaMultiplier: '环透明度倍率',
  ringLineWidth: '环线宽',
  fillAlpha: '内部填充透明度',
  dotPulseFreq: '中心点脉冲频率',
  dotPulseAmp: '中心点脉冲幅度',
  dotAlpha: '中心点透明度',
  dotBaseSize: '中心点基础大小(px)',
  ecgAlpha: '心电图线透明度',
  ecgLineWidth: '心电图线宽',
  ecgRange: '心电图范围(px)',
  ecgStep: '心电图采样步进(px)',
  ecgBaseY: '心电图Y偏移(px)',
  ecgFreq: '心电图时间频率',
  ecgWaveFreq: '心电图波形密度',
  blobCount: '每方向雾团数',
  blobDistRatio: '雾团间距比例',
  blobAngleWobble: '雾团摆动幅度(rad)',
  blobYScale: '雾团Y散布压扁',
  blobBaseSize: '雾团基础大小(px)',
  blobSizeIncrement: '雾团大小递增(px)',
  blobSizeFade: '雾团大小衰减',
  blobAlphaBase: '雾团基础透明度',
  blobAlphaFade: '雾团透明度衰减',
  blobAlphaStepDecay: '雾团逐层透明衰减',
  blobVertexStep: '雾团轮廓步进(rad)',
  blobRadiusBase: '雾团半径基值',
  blobRadiusAmp: '雾团半径起伏幅',
  blobYScaleRatio: '雾团Y压扁比例',
  ringPulseFreq: '环脉冲频率',
  ringPulseAmp: '环脉冲幅度',
  ringAlpha: '环透明度',
  ringStrokeWidth: '主环描边宽度',
  ringFillAlpha: '环内填充透明度',
  ringInnerAlpha: '内虚线环透明度',
  ringInnerWidth: '内虚线环线宽',
  tickCount: '刻度线数量',
  tickRotSpeed: '刻度旋转速度',
  tickBaseLen: '刻度基础长度(px)',
  tickLongExtra: '长刻度额外长度(px)',
  tickAlpha: '刻度透明度',
  tickWidthNormal: '普通刻度线宽',
  tickWidthLong: '长刻度线宽',
  crosshairAlpha: '十字线透明度',
  crosshairWidth: '十字线宽',
  ringWidth: '环宽度',
  glowInnerAlpha: '内部辉光透明度',
};

/** 嵌套分组（颜色对象等）的中文说明 */
const GROUP_LABELS: Record<string, string> = {
  muzzleSpark: '枪口火花',
  fireColor: '火焰颜色 (RGBA)',
  emberColor: '余烬颜色 (RGBA)',
  iceColor: '冰晶颜色 (RGBA)',
  poisonColor: '毒气颜色 (RGBA)',
  outerColor: '外层颜色 (RGBA)',
  innerColor: '内层颜色 (RGBA)',
  topColor: '顶部电弧颜色 (RGBA)',
  fullColor: '全屏闪电颜色 (RGBA)',
  streamColor: '喷射流颜色 (RGBA)',
  fire: '火焰/余烬/火花',
  explosion: '爆炸',
  lightning: '闪电',
};

export function labelFor(key: string): string {
  return KEY_LABELS[key] ?? key;
}

export function groupLabelFor(key: string): string {
  return GROUP_LABELS[key] ?? key;
}

// =========================================================================
// 颜色解析 / 转换 / 结构化颜色组读写（供 ColorField 取色器使用）
// =========================================================================

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** HSL(0-360, 0-100, 0-100) → RGB(0-255) */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue2rgb = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(hn) * 255),
    b: Math.round(hue2rgb(hn - 1 / 3) * 255),
  };
}

/** RGB(0-255) → HSL(0-360, 0-100, 0-100) */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rn: h = 60 * (((gn - bn) / d) % 6); break;
      case gn: h = 60 * ((bn - rn) / d + 2); break;
      default: h = 60 * ((rn - gn) / d + 4);
    }
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return {
    h: Math.round(((h % 360) + 360) % 360),
    s: Math.round(clamp(s, 0, 1) * 100),
    l: Math.round(l * 100),
  };
}

export function rgbaToHex(r: number, g: number, b: number): string {
  const p = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** 解析颜色字符串（#rgb/#rrggbb/#rrggbbaa/rgb()/rgba()/hsl()/hsla()）为 RGBA */
export function parseColorToRgba(str: string): Rgba | null {
  const s = str.trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    const hex = m[1];
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = [...hex].map((c) => parseInt(c + c, 16));
      return { r, g, b, a: hex.length === 4 ? +(a / 255).toFixed(2) : 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? +(parseInt(hex.slice(6, 8), 16) / 255).toFixed(2) : 1,
      };
    }
    return null;
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return {
        r: Math.round(parts[0]),
        g: Math.round(parts[1]),
        b: Math.round(parts[2]),
        a: parts.length >= 4 && Number.isFinite(parts[3]) ? clamp(parts[3], 0, 1) : 1,
      };
    }
    return null;
  }
  m = /^hsla?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      const { r, g, b } = hslToRgb(parts[0], parts[1], parts[2]);
      return { r, g, b, a: parts.length >= 4 && Number.isFinite(parts[3]) ? clamp(parts[3], 0, 1) : 1 };
    }
  }
  // 裸 RGB 三元组（如 '160, 210, 255'）：游戏渲染代码以 rgba(${c}, α) 插值使用，alpha 由代码侧控制
  m = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/.exec(s);
  if (m) {
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (r <= 255 && g <= 255 && b <= 255) return { r, g, b, a: 1 };
  }
  return null;
}

/** 将新颜色写回颜色字符串：原 hex 且不透明时保持 hex；裸 RGB 三元组保持三元组格式；其余统一输出 rgba() */
export function writeColorString(original: string, next: Rgba): string {
  const s = original.trim();
  if (s.startsWith('#') && next.a >= 1) {
    return rgbaToHex(next.r, next.g, next.b);
  }
  // 裸三元组（如 fireZone.coreColorDefault）回写仍为 'r, g, b'，避免破坏渲染代码的 rgba(${c}, α) 插值
  if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(s)) {
    return `${Math.round(next.r)}, ${Math.round(next.g)}, ${Math.round(next.b)}`;
  }
  return `rgba(${Math.round(next.r)}, ${Math.round(next.g)}, ${Math.round(next.b)}, ${+next.a.toFixed(2)})`;
}

// ---- 结构化颜色组（RGBA 键族 / HSL 键族） ----

const RGBA_FAMILY = new Set([
  'r', 'rMin', 'rMax', 'g', 'gMin', 'gMax', 'b', 'bMin', 'bMax',
  'a', 'aMin', 'aMax', 'alphaMin', 'alphaMax',
]);
const HSL_FAMILY = new Set([
  'hue', 'hueMin', 'hueMax', 'saturation', 'lightness', 'lightnessMin', 'lightnessMax',
]);

export type ColorKind = 'rgba' | 'hsl';

/**
 * 检测对象中的颜色键集合（HSL 优先于 RGBA）。
 * 命中后这些键可从普通数值字段中剥离，合并为一个取色器编辑。
 */
export function detectColorKeys(obj: AnyRecord): { kind: ColorKind; keys: string[] } | null {
  const keys = Object.keys(obj);
  const hasHue = keys.includes('hue') || keys.includes('hueMin');
  if (hasHue && keys.includes('saturation')) {
    return { kind: 'hsl', keys: keys.filter((k) => HSL_FAMILY.has(k)) };
  }
  const hasR = keys.includes('r') || keys.includes('rMin');
  const hasG = keys.includes('g') || keys.includes('gMin');
  const hasB = keys.includes('b') || keys.includes('bMin');
  if (hasR && hasG && hasB) {
    return { kind: 'rgba', keys: keys.filter((k) => RGBA_FAMILY.has(k)) };
  }
  return null;
}

/** 通道代表值：单值直取；Min/Max 对取中点（兼容"真区间"与"基值+幅值"两种旧语义） */
function channelMid(obj: AnyRecord, keys: string[], fallback: number): number {
  const nums = keys.filter((k) => typeof obj[k] === 'number').map((k) => obj[k] as number);
  if (nums.length === 0) return fallback;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[nums.length - 1]) / 2;
}

/** 平移写回：保持各通道区间宽度不变（不破坏 Min/Max 语义），仅整体搬移到新颜色 */
function shiftChannel(
  obj: AnyRecord,
  keys: string[],
  delta: number,
  lo: number,
  hi: number,
  round: boolean,
): void {
  for (const k of keys) {
    if (typeof obj[k] === 'number') {
      const v = clamp(obj[k] + delta, lo, hi);
      obj[k] = round ? Math.round(v) : +v.toFixed(2);
    }
  }
}

export function readRgbaGroup(obj: AnyRecord): Rgba {
  return {
    r: Math.round(channelMid(obj, ['r', 'rMin', 'rMax'], 255)),
    g: Math.round(channelMid(obj, ['g', 'gMin', 'gMax'], 255)),
    b: Math.round(channelMid(obj, ['b', 'bMin', 'bMax'], 255)),
    a: +clamp(channelMid(obj, ['a', 'aMin', 'aMax', 'alphaMin', 'alphaMax'], 1), 0, 1).toFixed(2),
  };
}

export function writeRgbaGroup(obj: AnyRecord, next: Rgba): void {
  const prev = readRgbaGroup(obj);
  shiftChannel(obj, ['r', 'rMin', 'rMax'], next.r - prev.r, 0, 255, true);
  shiftChannel(obj, ['g', 'gMin', 'gMax'], next.g - prev.g, 0, 255, true);
  shiftChannel(obj, ['b', 'bMin', 'bMax'], next.b - prev.b, 0, 255, true);
  shiftChannel(obj, ['a', 'aMin', 'aMax', 'alphaMin', 'alphaMax'], next.a - prev.a, 0, 1, false);
}

export function readHslGroup(obj: AnyRecord): Rgba {
  const h = channelMid(obj, ['hue', 'hueMin', 'hueMax'], 0);
  const s = channelMid(obj, ['saturation'], 100);
  const l = channelMid(obj, ['lightness', 'lightnessMin', 'lightnessMax'], 60);
  const { r, g, b } = hslToRgb(h, s, l);
  return { r, g, b, a: 1 };
}

export function writeHslGroup(obj: AnyRecord, next: Rgba): void {
  const prev = readHslGroup(obj);
  const p = rgbToHsl(prev.r, prev.g, prev.b);
  const n = rgbToHsl(next.r, next.g, next.b);
  shiftChannel(obj, ['hue', 'hueMin', 'hueMax'], n.h - p.h, 0, 360, true);
  shiftChannel(obj, ['saturation'], n.s - p.s, 0, 100, true);
  shiftChannel(obj, ['lightness', 'lightnessMin', 'lightnessMax'], n.l - p.l, 0, 100, true);
}

// =========================================================================
// 单特效配置导出（按 section.path 从 particle 配置中摘取）
// =========================================================================

export interface EffectSectionRef {
  /**
   * 配置路径：particle 模式相对 BALANCE_CONFIG.particle（如 'ash' / 'physics.ash'）；
   * render 模式相对 BALANCE_CONFIG 根（如 'render.nurseHealVFX.charge'）。
   * physics.xxx 路径视为共享组。
   */
  path: string;
}

/**
 * 生成单个特效的配置片段：按各 section 的 path 摘取当前值，
 * 嵌套路径（physics.xxx / render.xxx）保持层级，便于按键合并回 render-balance.ts。
 * @param targetNode 合并目标节点名（默认 particle；render 配置节传 'render'）
 */
export function exportEffectSnippet(
  name: string,
  en: string,
  sections: EffectSectionRef[],
  root: AnyRecord,
  targetNode = 'particle',
): string {
  const out: AnyRecord = {};
  for (const sec of sections) {
    const segs = sec.path.split('.');
    let src: AnyRecord | undefined = root;
    for (const s of segs) src = src?.[s] as AnyRecord | undefined;
    if (src == null || typeof src !== 'object') continue;
    let dst: AnyRecord = out;
    for (let i = 0; i < segs.length - 1; i++) {
      dst = (dst[segs[i]] ??= {}) as AnyRecord;
    }
    dst[segs[segs.length - 1]] = deepClone(src);
  }
  const shared = sections.filter((s) => s.path.startsWith('physics.')).map((s) => s.path);
  return [
    `// ===== 特效「${name} ${en}」配置片段（由特效工作台导出）=====`,
    `// 用法：将以下节点按键合并回 BALANCE_CONFIG 的 ${targetNode}: { ... } 配置节点（render-balance.ts / items.ts）`,
    ...(shared.length > 0
      ? [`// 注意：${shared.join('、')} 为共享组，改动会同时影响引用它的其他特效`]
      : []),
    toTsLiteral(out, 2),
    '',
  ].join('\n');
}
