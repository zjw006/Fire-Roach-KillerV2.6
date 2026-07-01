/**
 * @fileoverview 游戏波次生成器
 * @description 负责根据游戏进度和难度生成波次配置
 */

import { SceneType, RoachType } from '../../types';
import type { WaveConfig } from '../../types';
import { SCENE_WAVE_CONFIGS, SCENE_ROACH_TYPES } from '../../data';

/**
 * 波次生成器类
 * @description 根据游戏进度和难度生成波次配置
 */
export class WaveGenerator {
  private currentScene: SceneType;
  private difficulty: string;
  private waveNumber: number;

  /**
   * 构造函数
   * @param {SceneType} currentScene - 当前场景
   * @param {string} difficulty - 游戏难度
   * @param {number} waveNumber - 波次编号
   */
  constructor(
    currentScene: SceneType,
    difficulty: string = 'normal',
    waveNumber: number = 1
  ) {
    this.currentScene = currentScene;
    this.difficulty = difficulty;
    this.waveNumber = waveNumber;
  }

  /**
   * 生成波次配置
   * @returns {WaveConfig} 波次配置
   */
  generateWaveConfig(): WaveConfig {
    // 获取场景特定的波次配置
    const sceneConfigs = SCENE_WAVE_CONFIGS[this.currentScene] || SCENE_WAVE_CONFIGS[SceneType.KITCHEN];
    
    // 如果存在预定义的配置，使用它
    if (this.waveNumber <= sceneConfigs.length) {
      return sceneConfigs[this.waveNumber - 1];
    }

    // 否则动态生成配置
    return this.generateDynamicWaveConfig();
  }

  /**
   * 生成动态波次配置
   * @returns {WaveConfig} 动态波次配置
   */
  private generateDynamicWaveConfig(): WaveConfig {
    const baseMultiplier = this.getBaseMultiplier();
    const difficultyMultiplier = this.getDifficultyMultiplier();
    const waveMultiplier = this.getWaveMultiplier();
    
    const totalMultiplier = baseMultiplier * difficultyMultiplier * waveMultiplier;

    // 获取当前场景可用的蟑螂类型
    const availableTypes = this.getAvailableRoachTypes();

    // 生成波次配置
    const config: WaveConfig = {
      wave: this.waveNumber,
      smallCount: 0,
      largeCount: 0,
      flyingCount: 0,
      armoredCount: 0,
      splittingCount: 0,
      suicideCount: 0,
      flyingSuicideCount: 0,
      queenCount: 0,
      speed: 1.0,
      interval: this.getSpawnInterval(),
      spawnInterval: this.getSpawnInterval(),
      clusterChance: this.getClusterChance(),
      name: this.getWaveName()
    };

    // 根据可用类型分配数量
    if (availableTypes.includes(RoachType.SMALL)) {
      config.smallCount = Math.floor(15 * totalMultiplier);
    }
    
    if (availableTypes.includes(RoachType.LARGE)) {
      config.largeCount = Math.floor(8 * totalMultiplier);
    }
    
    if (availableTypes.includes(RoachType.FLYING)) {
      config.flyingCount = Math.floor(5 * totalMultiplier);
    }
    
    if (availableTypes.includes(RoachType.ARMORED)) {
      config.armoredCount = Math.floor(3 * totalMultiplier);
    }
    
    if (availableTypes.includes(RoachType.SPLITTING)) {
      config.splittingCount = Math.floor(2 * totalMultiplier);
    }
    
    if (availableTypes.includes(RoachType.SUICIDE)) {
      config.suicideCount = Math.floor(2 * totalMultiplier);
    }
    
    if (availableTypes.includes(RoachType.FLYING_SUICIDE)) {
      config.flyingSuicideCount = Math.floor(1 * totalMultiplier);
    }
    
    if (availableTypes.includes(RoachType.QUEEN)) {
      config.queenCount = Math.floor(1 * totalMultiplier);
    }

    return config;
  }

  /**
   * 获取基础倍率
   * @returns {number} 基础倍率
   */
  private getBaseMultiplier(): number {
    // 根据场景调整基础倍率
    switch (this.currentScene) {
      case SceneType.KITCHEN:
        return 1.0;
      case SceneType.SEWER:
        return 1.2;
      case SceneType.DUMP:
        return 1.4;
      case SceneType.BASEMENT:
        return 1.6;
      case SceneType.ROOFTOP:
        return 1.8;
      case SceneType.STREET:
        return 2.0;
      case SceneType.HOSPITAL:
        return 2.2;
      case SceneType.SUBWAY:
        return 2.4;
      case SceneType.SUPERMARKET:
        return 2.6;
      case SceneType.SCHOOL:
        return 2.8;
      case SceneType.NEST:
        return 3.0;
      default:
        return 1.0;
    }
  }

  /**
   * 获取难度倍率
   * @returns {number} 难度倍率
   */
  private getDifficultyMultiplier(): number {
    switch (this.difficulty) {
      case 'easy':
        return 0.7;
      case 'normal':
        return 1.0;
      case 'hard':
        return 1.5;
      default:
        return 1.0;
    }
  }

  /**
   * 获取波次倍率
   * @returns {number} 波次倍率
   */
  private getWaveMultiplier(): number {
    // 波次越高，倍率越大
    return 1.0 + (this.waveNumber - 1) * 0.1;
  }

  /**
   * 获取可用的蟑螂类型
   * @returns {RoachType[]} 可用的蟑螂类型数组
   */
  private getAvailableRoachTypes(): RoachType[] {
    const allTypes = [
      RoachType.SMALL, RoachType.LARGE, RoachType.FLYING,
      RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE,
      RoachType.FLYING_SUICIDE, RoachType.QUEEN
    ];

    // 获取场景特定的类型
    const sceneTypes = SCENE_ROACH_TYPES[this.currentScene];
    
    if (sceneTypes && sceneTypes.length > 0) {
      return sceneTypes;
    }

    // 根据难度调整可用类型
    if (this.difficulty === 'easy') {
      return [RoachType.SMALL, RoachType.LARGE];
    } else if (this.difficulty === 'normal') {
      return [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING];
    } else {
      return allTypes;
    }
  }

  /**
   * 获取生成间隔
   * @returns {number} 生成间隔（秒）
   */
  private getSpawnInterval(): number {
    // 波次越高，生成间隔越小（生成更快）
    const baseInterval = 0.8;
    const reduction = Math.min(0.5, (this.waveNumber - 1) * 0.05);
    return Math.max(0.3, baseInterval - reduction);
  }

  /**
   * 获取集群生成概率
   * @returns {number} 集群生成概率（0-1）
   */
  private getClusterChance(): number {
    // 波次越高，集群生成概率越大
    const baseChance = 0.2;
    const increase = Math.min(0.4, (this.waveNumber - 1) * 0.05);
    return Math.min(0.6, baseChance + increase);
  }

  /**
   * 获取波次名称
   * @returns {string} 波次名称
   */
  private getWaveName(): string {
    const sceneNames: Record<SceneType, string> = {
      [SceneType.KITCHEN]: '厨房',
      [SceneType.SEWER]: '下水道',
      [SceneType.DUMP]: '垃圾场',
      [SceneType.BASEMENT]: '地下室',
      [SceneType.ROOFTOP]: '屋顶',
      [SceneType.STREET]: '街道',
      [SceneType.HOSPITAL]: '医院',
      [SceneType.SUBWAY]: '地铁',
      [SceneType.SUPERMARKET]: '超市',
      [SceneType.SCHOOL]: '学校',
      [SceneType.NEST]: '巢穴'
    };

    const sceneName = sceneNames[this.currentScene] || '未知场景';
    return `${sceneName} - 波次 ${this.waveNumber}`;
  }

  /**
   * 生成无尽模式波次配置
   * @returns {WaveConfig} 无尽模式波次配置
   */
  generateEndlessWaveConfig(): WaveConfig {
    // 无尽模式使用更激进的倍率
    const endlessMultiplier = 1.0 + (this.waveNumber - 1) * 0.15;
    
    const config: WaveConfig = {
      wave: this.waveNumber,
      smallCount: Math.floor(20 * endlessMultiplier),
      largeCount: Math.floor(10 * endlessMultiplier),
      flyingCount: Math.floor(8 * endlessMultiplier),
      armoredCount: Math.floor(5 * endlessMultiplier),
      splittingCount: Math.floor(3 * endlessMultiplier),
      suicideCount: Math.floor(3 * endlessMultiplier),
      flyingSuicideCount: Math.floor(2 * endlessMultiplier),
      queenCount: Math.floor(1 * endlessMultiplier),
      speed: 1.0,
      interval: 1.0,
      spawnInterval: Math.max(0.2, 0.6 - (this.waveNumber - 1) * 0.02),
      clusterChance: Math.min(0.8, 0.3 + (this.waveNumber - 1) * 0.03),
      name: `无尽模式 - 波次 ${this.waveNumber}`
    };

    return config;
  }

  /**
   * 生成BOSS战波次配置
   * @returns {WaveConfig} BOSS战波次配置
   */
  generateBossWaveConfig(): WaveConfig {
    // BOSS战有特殊的波次配置
    const config: WaveConfig = {
      wave: this.waveNumber,
      smallCount: 0,
      largeCount: 0,
      flyingCount: 0,
      armoredCount: 0,
      splittingCount: 0,
      suicideCount: 0,
      flyingSuicideCount: 0,
      queenCount: 1, // BOSS战只有女王
      speed: 1.0,
      interval: 2.0,
      spawnInterval: 2.0, // BOSS战生成间隔较长
      clusterChance: 0,
      name: 'BOSS战'
    };

    return config;
  }

  /**
   * 获取波次描述
   * @param {WaveConfig} config - 波次配置
   * @returns {string} 波次描述
   */
  getWaveDescription(config: WaveConfig): string {
    const parts: string[] = [];
    
    if (config.smallCount > 0) parts.push(`${config.smallCount}只小型蟑螂`);
    if (config.largeCount > 0) parts.push(`${config.largeCount}只大型蟑螂`);
    if (config.flyingCount > 0) parts.push(`${config.flyingCount}只飞行蟑螂`);
    if (config.armoredCount > 0) parts.push(`${config.armoredCount}只装甲蟑螂`);
    if (config.splittingCount > 0) parts.push(`${config.splittingCount}只分裂蟑螂`);
    if (config.suicideCount > 0) parts.push(`${config.suicideCount}只自爆蟑螂`);
    if (config.flyingSuicideCount > 0) parts.push(`${config.flyingSuicideCount}只飞行自爆蟑螂`);
    if (config.queenCount > 0) parts.push(`${config.queenCount}只女王蟑螂`);
    
    return parts.join('，');
  }
}