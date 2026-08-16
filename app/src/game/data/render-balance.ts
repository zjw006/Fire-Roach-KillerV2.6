/**
 * @fileoverview 渲染/环境数值平衡参数
 * @description 从 render.ts 拆分而来，包含屏幕震动、性能、天气、浮动文字等平衡参数。
 * 通过 balance.ts 合并到 BALANCE_CONFIG 中对外暴露。
 * 所有数值单位为像素（px）或秒（s），除非另有说明。
 *
 * 注意：particle（粒子生成器）、render（渲染系统）、weather（天气）、lightning（闪电）
 * 四大节已迁移至 vfx-balance.ts，与喷火枪/商店道具/掉落技能道具/怪物技能的特效数值统一管理。
 */

export const BALANCE_RENDER = {
  // ===== 屏幕震动 =====
  // 不同事件触发的屏幕震动强度（像素偏移量）
  screenShake: {
    weaponHit: 2,        // 武器命中震动
    smallExplosion: 3,   // 小型爆炸
    mediumExplosion: 5,  // 中型爆炸
    largeExplosion: 6,   // 大型爆炸
    biggerExplosion: 8,  // 更大爆炸
    breach: 10,          // 防线突破
    bossDeath: 12,       // Boss 死亡
    swatter: 12,         // 电蚊拍全屏攻击
    bigBossDeath: 20,    // 大型 Boss 死亡
    massiveExplosion: 22,// 大规模爆炸
    queenDeath: 28,      // 蟑螂女王死亡（最大震动）
    decayThreshold: 0.5, // 震动衰减阈值（低于此值停止震动）
  },

  // ===== 性能 =====
  // 粒子数量限制，根据设备性能等级分级
  performance: {
    particleLimit: { low: 150, medium: 200, high: 250, desktop: 400 },
  },

  // ===== 浮动文字系统 =====
  // 战斗伤害/效果文字的显示参数
  floatingText: {
    maxCount: 20,            // 同时显示的浮动文字最大数量
    defaultDurationMs: 1000, // 默认显示时长（毫秒）
    defaultFontSize: 16,     // 默认字体大小（像素）
    defaultRiseSpeed: -35,   // 默认上升速度（像素/秒，负值表示向上）
    msToSeconds: 0.001,      // 毫秒转秒的转换系数
  },
} as const;
