import { SceneType, type WaveConfig } from '../types';

// 每个场景引入新蟑螂类型 + 新道具，难度逐关递增

// 场景 1：厨房 —— 仅小蟑螂 + 大蟑螂，速度慢，数量少
export const WAVE_CONFIGS_KITCHEN: WaveConfig[] = [
  { wave: 1, smallCount: 8,  largeCount: 0, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.35, interval: 14, clusterChance: 0 },
  { wave: 2, smallCount: 14, largeCount: 1, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.38, interval: 12, clusterChance: 0 },
  { wave: 3, smallCount: 22, largeCount: 3, flyingCount: 1, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.42, interval: 10, clusterChance: 0.05 },
  { wave: 4, smallCount: 30, largeCount: 5, flyingCount: 1, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.47, interval: 9,  clusterChance: 0.1 },
  { wave: 5, smallCount: 38, largeCount: 7, flyingCount: 2, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.52, interval: 8,  clusterChance: 0.15 },
  { wave: 6, smallCount: 45, largeCount: 8, flyingCount: 3, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.58, interval: 7,  clusterChance: 0.2 },
];

// 场景 2：下水道 —— 新增飞行蟑螂，共 6 波，难度递增
export const WAVE_CONFIGS_SEWER: WaveConfig[] = [
  { wave: 1, smallCount: 12, largeCount: 2, flyingCount: 5,  armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.55, interval: 12, clusterChance: 0 },
  { wave: 2, smallCount: 20, largeCount: 3, flyingCount: 7,  armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.65, interval: 10, clusterChance: 0.05 },
  { wave: 3, smallCount: 30, largeCount: 5, flyingCount: 9,  armoredCount: 1, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.75, interval: 9,  clusterChance: 0.1 },
  { wave: 4, smallCount: 40, largeCount: 6, flyingCount: 11, armoredCount: 1, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.85, interval: 8,  clusterChance: 0.2 },
  { wave: 5, smallCount: 48, largeCount: 8, flyingCount: 13, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.95, interval: 7,  clusterChance: 0.3 },
  { wave: 6, smallCount: 55, largeCount: 9, flyingCount: 15, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 1.0,  interval: 6,  clusterChance: 0.35 },
];

// 场景 3：垃圾场 —— 新增装甲蟑螂，共 6 波（更紧凑、更难）
export const WAVE_CONFIGS_DUMP: WaveConfig[] = [
  { wave: 1, smallCount: 12, largeCount: 2, flyingCount: 2, armoredCount: 2, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.5,  interval: 12, clusterChance: 0.05 },
  { wave: 2, smallCount: 18, largeCount: 3, flyingCount: 3, armoredCount: 3, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.58, interval: 10, clusterChance: 0.1 },
  { wave: 3, smallCount: 26, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, speed: 0.65, interval: 9,  clusterChance: 0.15 },
  { wave: 4, smallCount: 34, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 0, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, speed: 0.72, interval: 8,  clusterChance: 0.2 },
  { wave: 5, smallCount: 42, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 0, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, speed: 0.82, interval: 7,  clusterChance: 0.3 },
  { wave: 6, smallCount: 50, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 0, suicideCount: 3, flyingSuicideCount: 0, queenCount: 0, speed: 0.92, interval: 6,  clusterChance: 0.38 },
];

// 场景 4：地下室 —— 新增分裂 + 自爆蟑螂，速度快、数量多
export const WAVE_CONFIGS_BASEMENT: WaveConfig[] = [
  { wave: 1, smallCount: 15, largeCount: 3, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 1, flyingSuicideCount: 0, queenCount: 0, speed: 0.60, interval: 9,  clusterChance: 0.15 },
  { wave: 2, smallCount: 22, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, speed: 0.644, interval: 8,  clusterChance: 0.2 },
  { wave: 3, smallCount: 30, largeCount: 5, flyingCount: 5, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 0, queenCount: 0, speed: 0.688, interval: 8,  clusterChance: 0.25 },
  { wave: 4, smallCount: 38, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 0, queenCount: 0, speed: 0.732, interval: 7,  clusterChance: 0.3 },
  { wave: 5, smallCount: 48, largeCount: 7, flyingCount: 7, armoredCount: 4, splittingCount: 5, suicideCount: 3, flyingSuicideCount: 0, queenCount: 0, speed: 0.776, interval: 7,  clusterChance: 0.35 },
  { wave: 6, smallCount: 55, largeCount: 8, flyingCount: 8, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 0, queenCount: 0, speed: 0.82, interval: 6,  clusterChance: 0.4 },
];

// 场景 5：天台决战 —— 全种类蟑螂 + 蟑螂女王 Boss，最高难度
export const WAVE_CONFIGS_ROOFTOP: WaveConfig[] = [
  { wave: 1, smallCount: 14, largeCount: 3, flyingCount: 3, armoredCount: 2, splittingCount: 2, suicideCount: 1, flyingSuicideCount: 1, queenCount: 0, speed: 0.65, interval: 8,  clusterChance: 0.2 },
  { wave: 2, smallCount: 20, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, speed: 0.69, interval: 7,  clusterChance: 0.25 },
  { wave: 3, smallCount: 28, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 3, queenCount: 0, speed: 0.73, interval: 7,  clusterChance: 0.3 },
  { wave: 4, smallCount: 35, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.77, interval: 6,  clusterChance: 0.35 },
  { wave: 5, smallCount: 42, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 4, queenCount: 0, speed: 0.81, interval: 6,  clusterChance: 0.4 },
  { wave: 6, smallCount: 50, largeCount: 7, flyingCount: 7, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.85, interval: 5,  clusterChance: 0.45 },
];

// 场景波次配置映射
// 街道场景：最终章，包含蟑螂女王 Boss
export const WAVE_CONFIGS_STREET: WaveConfig[] = [
  { wave: 1, smallCount: 15, largeCount: 3, flyingCount: 3, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, speed: 0.70, interval: 7, clusterChance: 0.25 },
  { wave: 2, smallCount: 22, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.74, interval: 6, clusterChance: 0.3 },
  { wave: 3, smallCount: 28, largeCount: 5, flyingCount: 5, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.78, interval: 6, clusterChance: 0.35 },
  { wave: 4, smallCount: 35, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.82, interval: 5, clusterChance: 0.4 },
  { wave: 5, smallCount: 42, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 4, queenCount: 0, speed: 0.86, interval: 5, clusterChance: 0.45 },
  { wave: 6, smallCount: 40, largeCount: 5, flyingCount: 5, armoredCount: 3, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.90, interval: 4, clusterChance: 0.5 },
];

// ========== 新场景波次配置（v2.4） ==========
// ========== 医院 8 波配置 ==========
// 所有自爆蟑螂替换为定时自爆蟑螂
export const WAVE_CONFIGS_HOSPITAL: WaveConfig[] = [
  // Wave 1: Intro - 1 mutant + 1 timed suicide (gentle intro)
  { wave: 1, smallCount: 6, largeCount: 2, flyingCount: 0, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.65, interval: 9, clusterChance: 0.15, nurseCount: 0, mutantCount: 1, timedSuicideCount: 1, eggPoolActiveCount: 0 },
  // Wave 2: Egg pool - 2 mutants + 1 timed
  { wave: 2, smallCount: 8, largeCount: 3, flyingCount: 1, armoredCount: 0, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.70, interval: 8, clusterChance: 0.2, nurseCount: 0, mutantCount: 2, timedSuicideCount: 1, eggPoolActiveCount: 1 },
  // Wave 3: First nurse + 3 mutants + 1 timed
  { wave: 3, smallCount: 8, largeCount: 3, flyingCount: 2, armoredCount: 1, splittingCount: 0, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.75, interval: 7, clusterChance: 0.25, nurseCount: 1, mutantCount: 3, timedSuicideCount: 1, eggPoolActiveCount: 1 },
  // Wave 4: 4 mutants + 2 timed
  { wave: 4, smallCount: 8, largeCount: 3, flyingCount: 2, armoredCount: 2, splittingCount: 1, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.80, interval: 7, clusterChance: 0.3, nurseCount: 1, mutantCount: 4, timedSuicideCount: 2, eggPoolActiveCount: 1 },
  // Wave 5: 4 mutants + 2 timed (max 2 per wave)
  { wave: 5, smallCount: 8, largeCount: 4, flyingCount: 4, armoredCount: 2, splittingCount: 1, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.85, interval: 6, clusterChance: 0.35, nurseCount: 2, mutantCount: 4, timedSuicideCount: 2, eggPoolActiveCount: 1 },
  // Wave 6: 5 mutants + 2 timed
  { wave: 6, smallCount: 6, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.90, interval: 5, clusterChance: 0.4, nurseCount: 2, mutantCount: 5, timedSuicideCount: 2, eggPoolActiveCount: 2 },
  // Wave 7: 5 mutants + 2 timed
  { wave: 7, smallCount: 6, largeCount: 4, flyingCount: 5, armoredCount: 3, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 0.95, interval: 5, clusterChance: 0.45, nurseCount: 3, mutantCount: 5, timedSuicideCount: 2, eggPoolActiveCount: 2 },
  // Wave 8: Final - 6 mutants + 2 timed (max 2 per wave)
  { wave: 8, smallCount: 4, largeCount: 4, flyingCount: 5, armoredCount: 3, splittingCount: 2, suicideCount: 0, flyingSuicideCount: 0, queenCount: 0, speed: 1.0, interval: 4, clusterChance: 0.5, nurseCount: 3, mutantCount: 6, timedSuicideCount: 2, eggPoolActiveCount: 2 },
];

export const WAVE_CONFIGS_SUBWAY: WaveConfig[] = [
  { wave: 1, smallCount: 18, largeCount: 4, flyingCount: 4, armoredCount: 3, splittingCount: 3, suicideCount: 2, flyingSuicideCount: 2, queenCount: 0, speed: 0.75, interval: 7, clusterChance: 0.25 },
  { wave: 2, smallCount: 26, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.79, interval: 6, clusterChance: 0.3 },
  { wave: 3, smallCount: 34, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 4, queenCount: 0, speed: 0.83, interval: 6, clusterChance: 0.35 },
  { wave: 4, smallCount: 42, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, speed: 0.87, interval: 5, clusterChance: 0.4 },
  { wave: 5, smallCount: 50, largeCount: 8, flyingCount: 8, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, speed: 0.91, interval: 5, clusterChance: 0.45 },
  { wave: 6, smallCount: 48, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 4, suicideCount: 4, flyingSuicideCount: 4, queenCount: 1, speed: 0.95, interval: 4, clusterChance: 0.5 },
];

export const WAVE_CONFIGS_SUPERMARKET: WaveConfig[] = [
  { wave: 1, smallCount: 20, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 3, suicideCount: 3, flyingSuicideCount: 2, queenCount: 0, speed: 0.78, interval: 6, clusterChance: 0.3 },
  { wave: 2, smallCount: 28, largeCount: 6, flyingCount: 6, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.82, interval: 6, clusterChance: 0.35 },
  { wave: 3, smallCount: 36, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, speed: 0.86, interval: 5, clusterChance: 0.4 },
  { wave: 4, smallCount: 44, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, speed: 0.90, interval: 5, clusterChance: 0.45 },
  { wave: 5, smallCount: 52, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 5, queenCount: 0, speed: 0.94, interval: 4, clusterChance: 0.5 },
  { wave: 6, smallCount: 50, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 1, speed: 0.98, interval: 4, clusterChance: 0.55 },
];

export const WAVE_CONFIGS_SCHOOL: WaveConfig[] = [
  { wave: 1, smallCount: 22, largeCount: 5, flyingCount: 5, armoredCount: 4, splittingCount: 4, suicideCount: 3, flyingSuicideCount: 3, queenCount: 0, speed: 0.80, interval: 6, clusterChance: 0.3 },
  { wave: 2, smallCount: 30, largeCount: 6, flyingCount: 6, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, speed: 0.84, interval: 5, clusterChance: 0.35 },
  { wave: 3, smallCount: 38, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, speed: 0.88, interval: 5, clusterChance: 0.4 },
  { wave: 4, smallCount: 46, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 5, queenCount: 0, speed: 0.92, interval: 4, clusterChance: 0.45 },
  { wave: 5, smallCount: 54, largeCount: 9, flyingCount: 9, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 6, queenCount: 0, speed: 0.96, interval: 4, clusterChance: 0.5 },
  { wave: 6, smallCount: 52, largeCount: 8, flyingCount: 8, armoredCount: 5, splittingCount: 5, suicideCount: 5, flyingSuicideCount: 5, queenCount: 1, speed: 1.0, interval: 3, clusterChance: 0.55 },
];

export const WAVE_CONFIGS_NEST: WaveConfig[] = [
  { wave: 1, smallCount: 25, largeCount: 6, flyingCount: 6, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 4, queenCount: 0, speed: 0.82, interval: 6, clusterChance: 0.35 },
  { wave: 2, smallCount: 34, largeCount: 7, flyingCount: 7, armoredCount: 5, splittingCount: 5, suicideCount: 4, flyingSuicideCount: 5, queenCount: 0, speed: 0.86, interval: 5, clusterChance: 0.4 },
  { wave: 3, smallCount: 42, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 5, queenCount: 0, speed: 0.90, interval: 5, clusterChance: 0.45 },
  { wave: 4, smallCount: 50, largeCount: 9, flyingCount: 9, armoredCount: 6, splittingCount: 6, suicideCount: 5, flyingSuicideCount: 6, queenCount: 0, speed: 0.94, interval: 4, clusterChance: 0.5 },
  { wave: 5, smallCount: 58, largeCount: 10, flyingCount: 10, armoredCount: 7, splittingCount: 7, suicideCount: 6, flyingSuicideCount: 6, queenCount: 0, speed: 0.98, interval: 4, clusterChance: 0.55 },
  { wave: 6, smallCount: 55, largeCount: 8, flyingCount: 8, armoredCount: 6, splittingCount: 5, suicideCount: 5, flyingSuicideCount: 5, queenCount: 1, speed: 1.05, interval: 3, clusterChance: 0.6 },
];

export const SCENE_WAVE_CONFIGS: Record<SceneType, WaveConfig[]> = {
  [SceneType.KITCHEN]: WAVE_CONFIGS_KITCHEN,
  [SceneType.SEWER]: WAVE_CONFIGS_SEWER,
  [SceneType.DUMP]: WAVE_CONFIGS_DUMP,
  [SceneType.BASEMENT]: WAVE_CONFIGS_BASEMENT,
  [SceneType.ROOFTOP]: WAVE_CONFIGS_ROOFTOP,
  [SceneType.STREET]: WAVE_CONFIGS_STREET,
  [SceneType.HOSPITAL]: WAVE_CONFIGS_HOSPITAL,
  [SceneType.SUBWAY]: WAVE_CONFIGS_SUBWAY,
  [SceneType.SUPERMARKET]: WAVE_CONFIGS_SUPERMARKET,
  [SceneType.SCHOOL]: WAVE_CONFIGS_SCHOOL,
  [SceneType.NEST]: WAVE_CONFIGS_NEST,
};