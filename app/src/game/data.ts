/**
 * @fileoverview 游戏静态数据配置模块
 * @description 定义场景配置、敌人属性、对话内容、天赋树、成就、消耗品、波次配置等游戏核心数据。
 * 此文件为 barrel 重导出文件，实际数据定义已拆分到 ./data/ 目录下的各个子模块中。
 */

export { SCENE_CONFIGS } from './data/scenes';
export { ENEMY_DEFS } from './data/enemies';
export { TALENT_DEFS } from './data/talents';
export { ACHIEVEMENT_DEFS, createDefaultProgress } from './data/achievements';
export { DIALOG_CONFIGS, SUBWAY_ELITE_TUTORIAL_DIALOG } from './data/dialogs';
export {
  WAVE_CONFIGS_KITCHEN,
  WAVE_CONFIGS_SEWER,
  WAVE_CONFIGS_DUMP,
  WAVE_CONFIGS_BASEMENT,
  WAVE_CONFIGS_ROOFTOP,
  WAVE_CONFIGS_STREET,
  WAVE_CONFIGS_HOSPITAL,
  WAVE_CONFIGS_SUBWAY,
  WAVE_CONFIGS_SUPERMARKET,
  WAVE_CONFIGS_SCHOOL,
  WAVE_CONFIGS_NEST,
  SCENE_WAVE_CONFIGS,
} from './data/waves';
export {
  SCENE_ORDER,
  SCENE_ITEM_UNLOCKS,
  SCENE_ROACH_TYPES,
  SCENE_UNLOCK_CHAIN,
  SCENE_GROUND_BOUNDS,
  SCENE_REWARD_ITEMS,
} from './data/scene-rules';
export {
  CONSUMABLE_DEFS,
  WEAPON_DROP_DEFS,
  INVENTORY_SELL_PRICES,
  BOSS_CONFIG,
} from './data/items';
export { ENCYCLOPEDIA_DEFS } from './data/encyclopedia';
export { BALANCE_CONFIG } from './data/balance';
export { TEXT_CONFIG } from './data/text-config';
export { RENDER_COLOR, RENDER_FONT } from './data/render';