/**
 * @fileoverview 渲染常量（颜色、字体）
 * @description 定义 Canvas 2D 渲染用的颜色和字体常量。
 * 浮动文字颜色已迁移到 text-config.ts（与 TEXT_CONFIG 统一管理）。
 * 数值平衡参数已拆分到 render-balance.ts。
 * 使用方式：import { RENDER_COLOR, RENDER_FONT } from './data';
 */

/**
 * 渲染颜色常量
 * 用于 Canvas 2D 渲染（fillStyle, strokeStyle等），与浮动文字颜色分离管理
 * 使用方式：import { RENDER_COLOR } from './data'; 然后 RENDER_COLOR.hpHigh 等
 */
export const RENDER_COLOR = {
  // ===== HP条 =====
  // 显示在蟑螂头顶的血条颜色，按血量百分比切换
  hpHigh: '#22c55e',  // 绿色：高血量 (>66%)
  hpMid: '#eab308',   // 黄色：中等血量 (33%-66%)
  hpLow: '#ef4444',   // 红色：低血量 (<33%)

  // ===== 装甲/护盾条 =====
  // 显示在蟑螂头顶的护甲/护盾条颜色，渐变效果
  armorStart: '#fbbf24', // 护甲条起始颜色（金色）
  armorEnd: '#f59e0b',   // 护甲条结束颜色（深金）
  shieldStart: '#60a5fa', // 护盾条起始颜色（蓝色）
  shieldEnd: '#3b82f6',   // 护盾条结束颜色（深蓝）

  // ===== Boss =====
  // Boss 血条分层颜色，从外到内（绿→黄→橙→红）
  bossLayerColors: ['#22c55e', '#eab308', '#f97316', '#ef4444'] as readonly string[],
  bossName: '#ff44aa',                     // Boss 名称颜色（粉色）
  bossTimeDanger: '#ef4444',               // 时间不足时的颜色（红色）
  bossTimeNormal: '#aaa',                  // 时间正常时的颜色（灰色）
  bossLayerActive: '#fff',                 // 当前活跃层颜色（白色）
  bossLayerInactive: 'rgba(150,150,150,0.4)', // 非活跃层颜色（半透明灰）

  // ===== 风扇 =====
  // 强力风扇的视觉特效颜色
  fanWavePrimary: '#a78bfa',    // 风扇波纹主色（紫色）
  fanWaveSecondary: '#c4b5fd',  // 风扇波纹辅色（浅紫）
  fanGust: '#e9d5ff',           // 阵风颜色（淡紫）
  fanParticleLight: '#ddd6fe',  // 风粒子亮色
  fanParticleDark: '#c4b5fd',   // 风粒子暗色
  fanIconBlade: '#60a5fa',      // 风扇图标扇叶色（蓝色）
  fanIconCenter: '#4b5563',     // 风扇图标中心色（灰色）
  fanIconPrimary: '#a78bfa',    // 风扇图标主色（紫色）

  // ===== 粒子 =====
  // 战斗特效粒子的基础颜色
  particleSmoke: '#666666',   // 烟雾粒子（灰色）
  particleFire: '#ff5500',    // 火焰粒子（橙红）
  particleEmber: '#ffaa00',   // 余烬粒子（橙黄）
  particleSpark: '#ffff00',   // 火花粒子（黄色）
  particleDefault: '#ffffff', // 默认粒子（白色）

  // ===== 虫卵 =====
  eggPodGreen: '#5a7a5a', // 虫卵绿色（暗绿）

  // ===== 投掷物 =====
  // 不同投掷道具的图标颜色
  throwableSticky: '#facc15',  // 粘板（金色）
  throwablePoison: '#a78bfa',  // 毒气（紫色）
  throwableMolotov: '#ff4400', // 燃烧瓶（红色）
  throwableShotgun: '#fbbf24', // 散弹（橙色）

  // ===== 掉落物 =====
  dropFallback: '#fbbf24', // 掉落物兜底颜色（金色）

  // ===== 杀虫剂 =====
  insecticideTimer: '#86efac', // 杀虫剂计时器颜色（绿色）

  // ===== 眩晕星星 =====
  // 电蚊拍命中后蟑螂头顶的眩晕星星
  stunStar: '#facc15',      // 星星颜色（金色）
  stunStarWhite: '#ffffff', // 星星亮色（白色）

  // ===== 定时炸弹 =====
  // 定时自爆蟑螂的炸弹倒计时颜色
  bombCountdown: '#8b2020',         // 普通倒计时（暗红）
  bombCountdownCritical: '#a05030', // 最后时刻倒计时（深橙）

  // ===== 飞行蟑螂 =====
  flyingIndicator: '#88ccff', // 飞行蟑螂指示器颜色（浅蓝）

  // ===== 消耗品 =====
  // 蟑螂诱饵罐子渲染颜色
  baitJar: '#78350f',       // 罐身（深棕）
  baitJarRim: '#92400e',    // 罐口（棕色）
  baitJarAccent: '#57534e', // 罐子装饰（灰色）
  baitJarText: '#fbbf24',   // 罐子文字（金色）
  baitJarArrow: '#fbbf24',  // 罐子箭头（金色）
  glass: '#c0c8d8',         // 玻璃效果（浅灰蓝）

  // ===== 地面边界 =====
  groundBounds: '#86efac', // 地面边界线颜色（绿色）
} as const;

/**
 * 渲染字体常量
 * 用于 Canvas 2D 渲染（ctx.font），集中管理字体规格
 * 使用方式：import { RENDER_FONT } from './data'; 然后 ctx.font = RENDER_FONT.large;
 */
export const RENDER_FONT = {
  small: '10px sans-serif',       // 小号字体（HP显示等）
  boldSmall: 'bold 10px sans-serif', // 加粗小号字体
  normal: 'bold 11px sans-serif', // 普通字体（浮动文字）
  medium: '12px sans-serif',      // 中号字体
  boldMedium: 'bold 12px sans-serif', // 加粗中号字体
  large: 'bold 14px sans-serif',  // 大号字体（UI标签）
  subTitle: 'bold 18px sans-serif', // 副标题字体
  xLarge: 'bold 22px sans-serif', // 超大号字体
  title: 'bold 28px sans-serif',  // 标题字体
  banner: 'bold 36px sans-serif', // 横幅字体（胜利/失败）
} as const;