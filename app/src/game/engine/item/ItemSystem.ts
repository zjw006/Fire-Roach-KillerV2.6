/**
 * @fileoverview 道具系统模块
 * @description 负责管理游戏中的道具掉落、收集、回收和奖励系统
 */

import { GameState, SceneType } from '../../types';

/**
 * 道具掉落数据接口
 */
export interface ItemDropData {
  /** 道具类型 */
  type: string;
  /** 道具名称 */
  name: string;
  /** 道具图标 */
  icon: string;
  /** 道具描述 */
  desc: string;
}

/**
 * 场上道具掉落接口
 */
export interface FieldItemDrop {
  /** 道具类型 */
  type: string;
  /** 道具名称 */
  name: string;
  /** 道具图标 */
  icon: string;
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** 目标Y坐标 */
  targetY: number;
  /** 浮动相位 */
  bobPhase: number;
  /** 是否已收集 */
  collected: boolean;
  /** 是否正在下落 */
  falling: boolean;
  /** 下落速度 */
  fallSpeed: number;
}

/**
 * 道具系统配置接口
 */
export interface ItemSystemConfig {
  /** 游戏画布宽度 */
  canvasWidth: number;
  /** 游戏画布高度 */
  canvasHeight: number;
  /** 时间增量（秒） */
  deltaTime: number;
  /** 当前场景 */
  currentScene: SceneType;
  /** 游戏状态 */
  gameState: GameState;
  /** 防御线Y坐标 */
  defenseLineY: () => number;
  /** 播放音效回调 */
  onPlaySound?: (soundId: string) => void;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string, duration?: number) => void;
  /** 状态变化回调 */
  onStateChange?: (state: GameState) => void;
  /** 波次清除回调 */
  onWaveClear?: () => void;
  /** 添加天赋点回调 */
  onAddTalentPoints?: (points: number) => void;
  /** 保存进度回调 */
  onSaveProgress?: () => void;
}

/**
 * 道具系统类
 * @description 管理道具的掉落、收集、回收和奖励系统
 */
export class ItemSystem {
  /** 道具揭示数据数组 */
  private itemRevealData: ItemDropData[] = [];
  /** 场上道具掉落 */
  private itemDropOnField: FieldItemDrop | null = null;
  /** 奖励索引 */
  private rewardIndex: number = 0;
  /** 系统配置 */
  private config: ItemSystemConfig;

  /**
   * 构造函数
   * @param config 道具系统配置
   */
  constructor(config: ItemSystemConfig) {
    this.config = config;
  }

  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<ItemSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  update(): void {
    this.updateItemSystem();
  }

  /**
   * 获取道具揭示数据
   * @returns 道具揭示数据数组
   */
  getItemRevealData(): ItemDropData[] {
    return [...this.itemRevealData];
  }

  /**
   * 获取场上道具掉落
   * @returns 场上道具掉落
   */
  getFieldItemDrop(): FieldItemDrop | null {
    return this.itemDropOnField ? { ...this.itemDropOnField } : null;
  }

  /**
   * 获取奖励索引
   * @returns 奖励索引
   */
  getRewardIndex(): number {
    return this.rewardIndex;
  }

  /**
   * 设置道具揭示数据
   * @param data 道具揭示数据数组
   */
  setItemRevealData(data: ItemDropData[]): void {
    this.itemRevealData = [...data];
    this.rewardIndex = 0;
  }

  /**
   * 添加道具揭示数据
   * @param data 道具揭示数据
   */
  addItemRevealData(data: ItemDropData): void {
    this.itemRevealData.push(data);
  }

  /**
   * 清除道具揭示数据
   */
  clearItemRevealData(): void {
    this.itemRevealData = [];
    this.rewardIndex = 0;
  }

  /**
   * 生成下一个奖励掉落
   * @param index 奖励索引
   */
  spawnNextRewardDrop(index: number): void {
    this.rewardIndex = index;
    const reward = this.itemRevealData[index];
    if (!reward) return;

    this.itemDropOnField = {
      type: reward.type,
      name: reward.name,
      icon: reward.icon,
      x: this.config.canvasWidth / 2,
      y: -60,
      targetY: this.config.defenseLineY() - 135 + Math.random() * 30,
      bobPhase: 0,
      collected: false,
      falling: true,
      fallSpeed: 80,
    };

    // 播放道具掉落音效
    if (this.config.onPlaySound) {
      this.config.onPlaySound('item_drop_fanfare');
    }

    // 更新游戏状态
    if (this.config.onStateChange) {
      this.config.onStateChange(GameState.ITEM_DROP);
    }
  }

  /**
   * 完成道具揭示并移动到波次清除
   */
  completeItemReveal(): void {
    // 如果还有更多奖励，显示下一个
    if (this.rewardIndex < this.itemRevealData.length - 1) {
      this.spawnNextRewardDrop(this.rewardIndex + 1);
    } else {
      // 所有奖励已显示，进入波次清除
      if (this.config.onStateChange) {
        this.config.onStateChange(GameState.WAVE_CLEAR);
      }
      if (this.config.onWaveClear) {
        this.config.onWaveClear();
      }
    }
  }

  /**
   * 收集场上道具
   * @returns 是否成功收集
   */
  collectFieldItem(): boolean {
    if (!this.itemDropOnField || this.itemDropOnField.collected) {
      return false;
    }

    this.itemDropOnField.collected = true;
    
    // 添加收集提示
    if (this.config.onAddFloatingText) {
      this.config.onAddFloatingText(
        this.itemDropOnField.x,
        this.itemDropOnField.y - 40,
        `获得 ${this.itemDropOnField.name}!`,
        '#fbbf24',
        1500
      );
    }

    // 完成道具揭示
    this.completeItemReveal();
    
    return true;
  }

  /**
   * 更新道具系统
   */
  updateItemSystem(): void {
    if (this.config.gameState !== GameState.ITEM_DROP) {
      return;
    }

    // 更新下落动画
    if (this.itemDropOnField && !this.itemDropOnField.collected && this.itemDropOnField.falling) {
      this.itemDropOnField.y += this.itemDropOnField.fallSpeed * this.config.deltaTime;
      this.itemDropOnField.fallSpeed += 40 * this.config.deltaTime; // 重力加速度
      
      if (this.itemDropOnField.y >= this.itemDropOnField.targetY) {
        this.itemDropOnField.y = this.itemDropOnField.targetY;
        this.itemDropOnField.falling = false;
      }
    }

    // 更新浮动动画
    if (this.itemDropOnField && !this.itemDropOnField.collected && !this.itemDropOnField.falling) {
      this.itemDropOnField.bobPhase += this.config.deltaTime * 3;
    }
  }

  /**
   * 检查玩家是否点击了掉落道具
   * @param clickX 点击X坐标
   * @param clickY 点击Y坐标
   * @returns 是否点击了道具
   */
  checkItemDropClick(clickX: number, clickY: number): boolean {
    if (!this.itemDropOnField || this.itemDropOnField.collected || this.itemDropOnField.falling) {
      return false;
    }

    // 计算点击区域（道具周围50像素）
    const dx = clickX - this.itemDropOnField.x;
    const dy = clickY - this.itemDropOnField.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= 50) {
      return this.collectFieldItem();
    }
    
    return false;
  }

  /**
   * 触发游戏胜利流程
   */
  triggerGameVictory(): void {
    // BOSS模式：无道具掉落 - BOSS战斗与故事模式不同
    // 注意：这里假设有游戏模式判断，实际实现中需要从配置中获取
    
    // 故事模式：根据场景难度奖励天赋点
    // 注意：这里需要场景配置数据，实际实现中需要从配置中获取
    
    // 医院专属：3星评级系统
    if (this.config.currentScene === SceneType.HOSPITAL) {
      // 计算星级评级
      // ⭐: 通关关卡
      // ⭐⭐: 通关 + 突破次数 <= 1
      // ⭐⭐⭐: 通关 + 0次突破
      // 注意：这里需要突破次数数据，实际实现中需要从配置中获取
      
      // 显示星级评级浮动文字
      // 注意：这里需要星级数据，实际实现中需要从配置中获取
    }

    // 保存进度
    if (this.config.onSaveProgress) {
      this.config.onSaveProgress();
    }
  }

  /**
   * 重置道具系统
   */
  reset(): void {
    this.itemRevealData = [];
    this.itemDropOnField = null;
    this.rewardIndex = 0;
  }

  /**
   * 检查是否有场上道具
   * @returns 是否有场上道具
   */
  hasFieldItem(): boolean {
    return this.itemDropOnField !== null && !this.itemDropOnField.collected;
  }

  /**
   * 获取道具浮动Y坐标
   * @returns 浮动Y坐标
   */
  getItemBobY(): number {
    if (!this.itemDropOnField || this.itemDropOnField.falling) {
      return 0;
    }
    
    return Math.sin(this.itemDropOnField.bobPhase) * 10;
  }

  /**
   * 获取道具收集状态
   * @returns 是否已收集
   */
  isItemCollected(): boolean {
    return this.itemDropOnField ? this.itemDropOnField.collected : false;
  }

  /**
   * 获取道具下落状态
   * @returns 是否正在下落
   */
  isItemFalling(): boolean {
    return this.itemDropOnField ? this.itemDropOnField.falling : false;
  }
}
