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

// 重新导出工具模块
export * from './utils';

// 重新导出经济系统模块
export * from './economy';

// 重新导出波次系统模块
export * from './wave';

// 重新导出物理粒子系统模块
export * from './physics';

// 重新导出武器系统模块
export * from './weapon';

// 重新导出实体系统模块
export * from './entity';

// 重新导出渲染系统模块
export * from './render';

// 重新导出UI系统模块
export * from './ui';

// 重新导出原始 GameEngine（临时方案）
export { GameEngine } from '../engine';

// 重新导出新的游戏引擎和适配器
export { NewGameEngine } from './NewGameEngine';
export { GameEngineAdapter } from './GameEngineAdapter';

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
  // 暂时返回原始引擎实例，确保游戏可以运行
  const engine = new GameEngine(config.canvas);
  engine.state = GameState.MENU;
  return engine;
}