// Boss animation configuration
// Each action has frames loaded from disk, with fallback for missing animations

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

export type BossAction = keyof typeof BOSS_ANIMATIONS;

// State-to-action mapping
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
  if (hpPercent < 0.3) return 'roar'; // low HP roar
  if (isMoving) return 'walk';
  return 'idle'; // default: idle (ground combat)
}

// Frame timing (ms per frame based on FPS)
export function getFrameInterval(action: BossAction): number {
  return 1000 / BOSS_ANIMATIONS[action].fps;
}

// Get effective frame count (considering fallback)
export function getEffectiveAction(action: BossAction): BossAction {
  const config = BOSS_ANIMATIONS[action];
  if (config.frames === 0 && config.fallback) {
    return config.fallback as BossAction;
  }
  return action;
}
