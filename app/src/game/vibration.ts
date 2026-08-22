/**
 * @fileoverview 震动反馈工具模块
 * @description 直接访问 navigator.vibrate，与 AudioManager 解耦。
 * 支持平台：Android Chrome、HarmonyOS、iOS Safari 13+。
 * 注意：华为/鸿蒙线性马达需要 200ms 以上的长脉冲才能产生可感知反馈。
 */

/** @description 全局震动开关状态，默认开启 */
let _enabled = true;

// Load saved setting
try {
  const saved = localStorage.getItem('roach_blaster_vibration');
  if (saved !== null) _enabled = saved === 'true';
} catch { /* ignore */ }

/**
 * 检测设备是否支持震动功能
 * @returns {boolean} 若支持震动返回 true，否则返回 false
 */
export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * 获取当前震动开关状态
 * @returns {boolean} 当前震动是否已启用
 */
export function isVibrationEnabled(): boolean {
  return _enabled;
}

/**
 * 设置震动开关状态，并持久化到 localStorage
 * @param {boolean} enabled - 是否启用震动
 */
export function setVibrationEnabled(enabled: boolean) {
  _enabled = enabled;
  try {
    localStorage.setItem('roach_blaster_vibration', enabled.toString());
  } catch { /* ignore */ }
}

/**
 * 切换震动开关状态
 * @returns {boolean} 切换后的新状态
 */
export function toggleVibration(): boolean {
  _enabled = !_enabled;
  try {
    localStorage.setItem('roach_blaster_vibration', _enabled.toString());
  } catch { /* ignore */ }
  if (_enabled) vibrate(80);
  return _enabled;
}

/**
 * 核心震动函数，触发设备震动
 * @param {number | number[]} _pattern - 震动时长(ms)或震动模式数组（当前震动已禁用）
 */
export function vibrate(_pattern: number | number[]) {
  if (!_enabled) return;
  if (!isVibrationSupported()) return;
  try {
    // TODO: 手机震动反馈已注释禁用（如需恢复，取消下一行注释即可）
    // navigator.vibrate(_pattern);
  } catch {
    // 静默忽略：并非所有浏览器都支持震动
  }
}

// ========== 预设震动模式 ==========
// 注意：华为/鸿蒙线性马达需要 200ms+ 的长脉冲才能产生可感知反馈，
// 40-60ms 的短脉冲通常不可见。

/** 开火震动 —— 单次 200ms 强脉冲（每次射击） */
export function vibrateFire() { vibrate(200); }

/** 击杀蟑螂震动 —— 250ms 单次脉冲 */
export function vibrateKill() { vibrate(250); }

/** 爆炸震动（燃烧瓶）—— 双脉冲模式 */
export function vibrateExplode() { vibrate([200, 100, 250]); }

/** 自爆蟑螂爆炸 —— 三重强脉冲 */
export function vibrateSuicideExplode() { vibrate([250, 100, 300, 100, 250]); }

/** 定时炸弹爆炸伤害 —— 双次强脉冲 */
export function vibrateDamage() { vibrate([300, 100, 400]); }

/** 防线突破警报 —— 警示节奏模式 */
export function vibrateBreach() { vibrate([200, 80, 200, 80, 300]); }

/** 使用道具 —— 快速双击 */
export function vibrateItemUse() { vibrate([150, 60, 150]); }

/** 新纪录达成 —— 庆祝节奏 */
export function vibrateNewRecord() { vibrate([150, 50, 150, 50, 200, 50, 250]); }

/** 游戏结束 —— 长失败震动 */
export function vibrateGameOver() { vibrate([250, 80, 250, 80, 400]); }

/** 测试震动 —— 500ms 强单脉冲（用于设置界面测试） */
export function vibrateTest() { vibrate(500); }

/**
 * 直接触发震动（仅在用户手势回调中使用）
 * @param {number} ms - 震动时长，单位毫秒
 */
export function vibrateDirect(ms: number) { vibrate(ms); }

// ========== 诊断工具 ==========

/**
 * 获取震动功能当前状态
 * @returns {Object} 包含 supported、enabled、userAgent 的状态对象
 */
export function getVibrationStatus(): {
  supported: boolean;
  enabled: boolean;
  userAgent: string;
} {
  return {
    supported: isVibrationSupported(),
    enabled: _enabled,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  };
}
