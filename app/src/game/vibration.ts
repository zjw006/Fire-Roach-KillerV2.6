// ========== VIBRATION UTILITIES ==========
// Direct access to navigator.vibrate - decoupled from AudioManager
// Works on: Android Chrome, HarmonyOS, iOS Safari 13+

let _enabled = true;

// Load saved setting
try {
  const saved = localStorage.getItem('roach_blaster_vibration');
  if (saved !== null) _enabled = saved === 'true';
} catch { /* ignore */ }

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function isVibrationEnabled(): boolean {
  return _enabled;
}

export function setVibrationEnabled(enabled: boolean) {
  _enabled = enabled;
  try {
    localStorage.setItem('roach_blaster_vibration', enabled.toString());
  } catch { /* ignore */ }
}

export function toggleVibration(): boolean {
  _enabled = !_enabled;
  try {
    localStorage.setItem('roach_blaster_vibration', _enabled.toString());
  } catch { /* ignore */ }
  if (_enabled) vibrate(80);
  return _enabled;
}

/** Core vibrate function */
export function vibrate(pattern: number | number[]) {
  if (!_enabled) return;
  if (!isVibrationSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // silently ignore - not all browsers support vibration
  }
}

// ========== PRESET PATTERNS ==========
// NOTE: Huawei/HarmonyOS linear motors need longer pulses (200ms+)
// to produce perceivable feedback. 40-60ms pulses are often invisible.

/** Fire shot - fired in user gesture callback (reliable) */
// 200ms single pulse: strong crisp feedback on every shot
export function vibrateFire() { vibrate(200); }

/** Kill roach - fired in game loop (may be throttled) */
export function vibrateKill() { vibrate(250); }

/** Explosion (molotov) - double pulse */
export function vibrateExplode() { vibrate([200, 100, 250]); }

/** Suicide roach explosion - heavy triple pulse */
export function vibrateSuicideExplode() { vibrate([250, 100, 300, 100, 250]); }

/** Timed bomb explosion damage - strong double pulse */
export function vibrateDamage() { vibrate([300, 100, 400]); }

/** Roach breaches defense line - alert pattern */
export function vibrateBreach() { vibrate([200, 80, 200, 80, 300]); }

/** Use any item - quick double tap */
export function vibrateItemUse() { vibrate([150, 60, 150]); }

/** New record set - celebration rhythm */
export function vibrateNewRecord() { vibrate([150, 50, 150, 50, 200, 50, 250]); }

/** Game over - long defeat rumble */
export function vibrateGameOver() { vibrate([250, 80, 250, 80, 400]); }

/** Test vibration - strong single pulse for testing */
export function vibrateTest() { vibrate(500); }

/** Direct test - call from user gesture handler only */
export function vibrateDirect(ms: number) { vibrate(ms); }

// ========== DIAGNOSTICS ==========

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
