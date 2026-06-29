/**
 * @fileoverview Boss 动画配置模块
 * @description 定义 Boss 各动作的动画帧路径、循环方式与帧率，并为缺失动画提供 fallback 回退机制。
 */

/**
 * Boss 各动作动画配置表
 * @property {number} frames - 帧数（0 表示该动画尚未制作）
 * @property {string} path - 帧图片路径前缀
 * @property {boolean} loop - 是否循环播放
 * @property {number} fps - 每秒帧数
 * @property {string} fallback - 帧数为 0 时的回退动作名
 */
export const BOSS_ANIMATIONS = {
  idle:     { frames: 7, path: '/boss/idle/idle_',           loop: true,  fps: 10, fallback: 'idle' },
  hover:    { frames: 3, path: '/boss/hover/hover_',         loop: true,  fps: 8,  fallback: 'idle' },
  walk:     { frames: 0, path: '/boss/walk/walk_',           loop: true,  fps: 10, fallback: 'idle' },
  charge:   { frames: 0, path: '/boss/charge/charge_',       loop: false, fps: 12, fallback: 'idle' },
  summon:   { frames: 0, path: '/boss/summon/summon_',       loop: false, fps: 10, fallback: 'idle' },
  defend:   { frames: 0, path: '/boss/defend/defend_',       loop: false, fps: 10, fallback: 'idle' },
  hit:      { frames: 0, path: '/boss/hit/hit_',             loop: false, fps: 15, fallback: 'idle' },
  hurt:     { frames: 0, path: '/boss/hurt/hurt_',           loop: true,  fps: 8,  fallback: 'idle' },
  die:      { frames: 0, path: '/boss/die/die_',             loop: false, fps: 4,  fallback: 'idle' },
  roar:     { frames: 0, path: '/boss/roar/roar_',           loop: false, fps: 10, fallback: 'idle' },
  mock:     { frames: 0, path: '/boss/mock/mock_',           loop: false, fps: 10, fallback: 'idle' },
  transform:{ frames: 0, path: '/boss/transform/transform_', loop: false, fps: 8,  fallback: 'idle' },
} as const;

/** Boss 动作类型 */
export type BossAction = keyof typeof BOSS_ANIMATIONS;

/**
 * 根据 Boss 当前状态映射到对应动画动作
 * @param {boolean} isCharging - 是否正在冲锋
 * @param {boolean} isSummoning - 是否正在召唤
 * @param {boolean} isDefending - 是否正在防御
 * @param {boolean} isHit - 是否正在受击
 * @param {boolean} isDead - 是否已死亡
 * @param {boolean} isHurt - 是否处于受伤状态
 * @param {boolean} isTransforming - 是否正在变身
 * @param {number} hpPercent - 当前 HP 百分比（0~1）
 * @param {boolean} isMoving - 是否正在移动
 * @returns {BossAction} 对应的动画动作名
 */
export function getBossAction(
  isCharging: boolean,
  isSummoning: boolean,
  isDefending: boolean,
  isHit: boolean,
  isDead: boolean,
  isHurt: boolean,
  isTransforming: boolean,
  hpPercent: number,
  isMoving: boolean
): BossAction {
  if (isDead) return 'die';
  if (isTransforming) return 'transform';
  if (isHit) return 'hit';
  if (isDefending) return 'defend';
  if (isCharging) return 'charge';
  if (isSummoning) return 'summon';
  if (isHurt) return 'hurt';
  if (hpPercent < 0.3) return 'roar'; // 低血量怒吼
  if (isMoving) return 'walk';
  return 'idle'; // 默认：地面待机
}

/**
 * 获取指定动作的每帧间隔时长
 * @param {BossAction} action - Boss 动作名
 * @returns {number} 每帧间隔毫秒数
 */
export function getFrameInterval(action: BossAction): number {
  return 1000 / BOSS_ANIMATIONS[action].fps;
}

/**
 * 获取实际生效的动画动作（若目标动作帧数为 0，则返回 fallback 动作）
 * @param {BossAction} action - 目标动作名
 * @returns {BossAction} 实际生效的动作名
 */
export function getEffectiveAction(action: BossAction): BossAction {
  const config = BOSS_ANIMATIONS[action];
  if (config.frames === 0 && config.fallback) {
    return config.fallback as BossAction;
  }
  return action;
}
