export const FLOAT_COLOR = {
  /** 奖励/成功 (绿色) */
  reward: '#4ade80',
  /** 伤害/危险 (红色) */
  danger: '#ef4444',
  /** 金币/通知 (金色) */
  gold: '#fbbf24',
  /** 警告 (浅红) */
  warning: '#f87171',
  /** 护盾 (青色) */
  shield: '#22d3ee',
  /** 爆炸 (橙红) */
  explosion: '#ff4400',
  /** 爆炸 (橙色) */
  explosionOrange: '#ff6600',
  /** 分裂 (琥珀) */
  split: '#ff8800',
  /** 解体 (浅蓝) */
  disintegrate: '#88ccff',
  /** 反噬 (紫色) */
  backlash: '#a855f7',
  /** 尸体炸弹 (红) */
  corpseBomb: '#ff4444',
  /** 定时自爆 (琥珀) */
  timedSuicide: '#f59e0b',
  /** 警告闪烁 (纯红) */
  warningFlash: '#ff0000',
  /** 轰 (暗红) */
  boom: '#8b2020',
  /** 过期/冷却 (灰) */
  expired: '#9ca3af',
  /** 冷却 (灰蓝) */
  cooldown: '#94a3b8',
  /** 切换 (黄) */
  switch: '#facc15',
  /** 最佳时间 (浅黄) */
  bestTime: '#fde047',
  /** 开火 (绿) */
  openFire: '#22c55e',
  /** 护甲免疫 (蓝) */
  armorImmune: '#60a5fa',
  /** 2星 (紫) */
  star2: '#c084fc',
  /** 风扇 (紫) */
  fan: '#a78bfa',
  /** 毒雾 (紫绿) */
  poison: '#a78bfa',
  /** 火焰墙 (浅红) */
  fireWall: '#f87171',
  /** 风扇次要色 (淡紫) */
  fanSecondary: '#c4b5fd',
  /** 护盾激活 (青色) */
  shieldActive: '#06b6d4',
  /** 女王召唤 (粉红) */
  queenSummon: '#ff44aa',
  /** 护士治疗 (暗绿) */
  nurseHeal: '#5a8a5a',
  /** 炸弹失效 (灰色) */
  bombFail: '#666666',
  /** 胚胎暴走 (深红) */
  embryoBurst: '#ff0040',
  /** 诞生 (亮绿) */
  spawnBirth: '#00ff80',
  /** 酸液飞溅 (黄绿) */
  acidSplash: '#84cc16',
  /** 酸液腐蚀 (亮黄绿) */
  acidCorrode: '#a3e635',
  /** 杀虫剂描述 (浅绿) */
  insecticideDesc: '#86efac',
  /** 雷达描述 (浅青) */
  radarDesc: '#67e8f9',
  /** 护士施法 (亮绿) */
  nurseCasting: '#4ade80',
  /** 胜利 (绿) */
  victory: '#22c55e',
} as const;

/**
 * 渲染颜色常量
 * 用于 Canvas 2D 渲染（fillStyle, strokeStyle等），与浮动文字颜色分离管理
 * 使用方式：import { RENDER_COLOR } from './data'; 然后 RENDER_COLOR.hpHigh 等
 */
export const RENDER_COLOR = {
  // ===== HP条 =====
  hpHigh: '#22c55e',
  hpMid: '#eab308',
  hpLow: '#ef4444',

  // ===== 装甲/护盾条 =====
  armorStart: '#fbbf24',
  armorEnd: '#f59e0b',
  shieldStart: '#60a5fa',
  shieldEnd: '#3b82f6',

  // ===== Boss =====
  bossLayerColors: ['#22c55e', '#eab308', '#f97316', '#ef4444'] as readonly string[],
  bossName: '#ff44aa',
  bossTimeDanger: '#ef4444',
  bossTimeNormal: '#aaa',
  bossLayerActive: '#fff',
  bossLayerInactive: 'rgba(150,150,150,0.4)',

  // ===== 风扇 =====
  fanWavePrimary: '#a78bfa',
  fanWaveSecondary: '#c4b5fd',
  fanGust: '#e9d5ff',
  fanParticleLight: '#ddd6fe',
  fanParticleDark: '#c4b5fd',
  fanIconBlade: '#60a5fa',
  fanIconCenter: '#4b5563',
  fanIconPrimary: '#a78bfa',

  // ===== 粒子 =====
  particleSmoke: '#666666',
  particleFire: '#ff5500',
  particleEmber: '#ffaa00',
  particleSpark: '#ffff00',
  particleDefault: '#ffffff',

  // ===== 虫卵 =====
  eggPodGreen: '#5a7a5a',

  // ===== 投掷物 =====
  throwableSticky: '#facc15',
  throwablePoison: '#a78bfa',
  throwableMolotov: '#ff4400',
  throwableShotgun: '#fbbf24',

  // ===== 掉落物 =====
  dropFallback: '#fbbf24',

  // ===== 杀虫剂 =====
  insecticideTimer: '#86efac',

  // ===== 眩晕星星 =====
  stunStar: '#facc15',
  stunStarWhite: '#ffffff',

  // ===== 定时炸弹 =====
  bombCountdown: '#8b2020',
  bombCountdownCritical: '#a05030',

  // ===== 飞行蟑螂 =====
  flyingIndicator: '#88ccff',

  // ===== 消耗品 =====
  baitJar: '#78350f',
  baitJarRim: '#92400e',
  baitJarAccent: '#57534e',
  baitJarText: '#fbbf24',
  baitJarArrow: '#fbbf24',
  glass: '#c0c8d8',

  // ===== 地面边界 =====
  groundBounds: '#86efac',
} as const;

/**
 * 渲染字体常量
 * 用于 Canvas 2D 渲染（ctx.font），集中管理字体规格
 * 使用方式：import { RENDER_FONT } from './data'; 然后 ctx.font = RENDER_FONT.large;
 */
export const RENDER_FONT = {
  small: '10px sans-serif',
  boldSmall: 'bold 10px sans-serif',
  normal: 'bold 11px sans-serif',
  medium: '12px sans-serif',
  boldMedium: 'bold 12px sans-serif',
  large: 'bold 14px sans-serif',
  subTitle: 'bold 18px sans-serif',
  xLarge: 'bold 22px sans-serif',
  title: 'bold 28px sans-serif',
  banner: 'bold 36px sans-serif',
} as const;