/**
 * @fileoverview 游戏引擎模块入口
 * @description 重新导出所有引擎模块，保持向后兼容
 */

// 重新导出核心类型
export { GameState, RoachType, RoachState, SceneType, WeatherType, ParticleType, FlameMode, GameMode, SAVE_VERSION } from '../types';
export type { Roach, Player, Particle, FireZone, FireWall, Economy, WeaponDrop, GameProgress, WaveConfig, ThrowableProjectile, InventoryItem, TripleFlameState, BossBattleState, RadarLaser, StickyBoard, StickyDrop, FanState } from '../types';

// 重新导出游戏数据
export { SCENE_CONFIGS, ENEMY_DEFS, TALENT_DEFS, WEAPON_DROP_DEFS, INVENTORY_SELL_PRICES, BOSS_CONFIG, SCENE_WAVE_CONFIGS, SCENE_ITEM_UNLOCKS, SCENE_ROACH_TYPES, SCENE_UNLOCK_CHAIN, SCENE_REWARD_ITEMS, SCENE_GROUND_BOUNDS, createDefaultProgress, ENCYCLOPEDIA_DEFS, CONSUMABLE_DEFS } from '../data';

// 重新导出音频和振动模块
export { AudioManager } from '../audio';
export * as Vibration from '../vibration';

// 重新导出BOSS动画
export { BOSS_ANIMATIONS } from '../bossAnimation';

// 重新导出原始 GameEngine
export { GameEngine } from '../engine';

// 重新导出已提取的模块（供外部使用）
export { FloatingTextSystem } from './floating-text/FloatingTextSystem';
export { SaveSystem } from './save/SaveSystem';
export { EconomyManager } from './economy/EconomyManager';
export { AchievementSystem } from './achievement/AchievementSystem';
export { ParticleSystem } from './particle/ParticleSystem';
export { DropRenderer } from './render/DropRenderer';
export { RenderUtils } from './render/RenderUtils';
export { CollisionSystem } from './collision/CollisionSystem';
export { WeaponSystem } from './weapon/WeaponSystem';
export { StickySystem } from './sticky/StickySystem';
export { FanSystem } from './fan/FanSystem';
export { TripleFlameSystem } from './triple/TripleFlameSystem';
export { RadarLaserSystem } from './radar/RadarLaserSystem';
export { SwatterSystem } from './swatter/SwatterSystem';
export { AimingSystem } from './aiming/AimingSystem';
export { InsecticideSystem } from './insecticide/InsecticideSystem';
export { ThrowableSystem } from './throwable/ThrowableSystem';
export { PoisonSystem } from './poison/PoisonSystem';
export { ConsumableSystem } from './consumable/ConsumableSystem';
export { BossBattleSystem } from './boss/BossBattleSystem';
export { WaveManager } from './wave/WaveManager';

import { GameState, GameMode, SceneType } from '../types';
import { GameEngine } from '../engine';

/**
 * 创建游戏引擎实例（兼容性函数）
 * @param config - 引擎配置
 * @returns 游戏引擎实例
 */
export function createGameEngine(config: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  gameMode: GameMode;
  difficulty: 'easy' | 'hard';
  currentScene: SceneType;
  audio?: any;
}) {
  const engine = new GameEngine(config.canvas);
  engine.state = GameState.MENU;
  return engine;
}