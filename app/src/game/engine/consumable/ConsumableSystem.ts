/**
 * @fileoverview 消耗品系统模块
 * @description 负责管理游戏中所有消耗品的逻辑，包括自动使用、冷却系统、效果应用等
 */

import { GameState, type Player } from '../../types';

/**
 * 消耗品效果接口
 */
export interface ConsumableEffect {
  /** 消耗品ID */
  id: string;
  /** 消耗品名称 */
  name: string;
  /** 消耗品描述 */
  description: string;
  /** 冷却时间（秒） */
  cooldown?: number;
  /** 是否自动使用 */
  autoUse?: boolean;
}

/**
 * 消耗品系统配置接口
 */
export interface ConsumableSystemConfig {
  /** 游戏画布宽度 */
  canvasWidth: number;
  /** 游戏画布高度 */
  canvasHeight: number;
  /** 时间增量（秒） */
  deltaTime: number;
  /** 防御线Y坐标 */
  defenseLineY: () => number;
  /** 最大防御生命值 */
  maxDefenseHp: number;
  /** 当前防御生命值 */
  defenseHp: number;
  /** 玩家对象 */
  player: Player;
  /** 游戏状态 */
  gameState: GameState;
  /** 消耗品定义列表 */
  consumableDefs?: ConsumableEffect[];
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string, duration?: number, fontSize?: number) => void;
  /** 更新消耗品状态回调 */
  onConsumableUpdate?: (
    inventory: Record<string, number>,
    buffTimers: Record<string, number>,
    cooldowns?: Record<string, number>,
    globalCooldown?: number,
    combatStartTimer?: number,
    itemCooldowns?: Record<string, number>
  ) => void;
  /** 更新玩家状态回调 */
  onPlayerUpdate?: (player: Player) => void;
  /** 更新防御状态回调 */
  onDefenseUpdate?: (defenseHp: number, maxDefenseHp: number) => void;
  /** 更新紧急冷却库存回调 */
  onEmergencyCoolUpdate?: (count: number) => void;
  /** 获取地面中心坐标回调 */
  onGetGroundCenter?: () => [number, number];
}

/**
 * 消耗品系统类
 * @description 管理消耗品的库存、自动使用、冷却和效果应用
 */
export class ConsumableSystem {
  /** 消耗品库存 */
  private consumableInventory: Record<string, number> = {};
  /** 自动使用设置 */
  private autoUseEnabled: Record<string, boolean> = {};
  /** 紧急冷却库存 */
  private emergencyCoolInventory: number = 0;
  /** 增益闪光计时器 */
  private buffFlashTimers: Record<string, number> = {};
  /** 消耗品冷却时间 */
  private consumableCooldowns: Record<string, number> = {};
  /** 全局消耗品冷却时间 */
  private globalConsumableCooldown: number = 0;
  /** 战斗开始计时器 */
  private combatStartTimer: number = 0;
  /** 物品冷却时间 */
  private itemCooldowns: Record<string, number> = {};
  /** 系统配置 */
  private config: ConsumableSystemConfig;
  /** 诱饵投掷动画状态 */
  private baitThrowAnim: {
    active: boolean;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    timer: number;
  } = { active: false, x: 0, y: 0, targetX: 0, targetY: 0, timer: 0 };
  /** 诱饵目标位置 */
  private baitTarget: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };

  /**
   * 构造函数
   * @param config 消耗品系统配置
   */
  constructor(config: ConsumableSystemConfig) {
    this.config = config;
  }

  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<ConsumableSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 更新消耗品系统
   */
  update(): void {
    this.updateConsumableEffects(this.config.deltaTime);
  }

  /**
   * 获取消耗品库存
   * @returns 消耗品库存
   */
  getInventory(): Record<string, number> {
    return { ...this.consumableInventory };
  }

  /**
   * 获取自动使用设置
   * @returns 自动使用设置
   */
  getAutoUseSettings(): Record<string, boolean> {
    return { ...this.autoUseEnabled };
  }

  /**
   * 获取紧急冷却库存
   * @returns 紧急冷却库存数量
   */
  getEmergencyCoolInventory(): number {
    return this.emergencyCoolInventory;
  }

  /**
   * 获取增益闪光计时器
   * @returns 增益闪光计时器
   */
  getBuffFlashTimers(): Record<string, number> {
    return { ...this.buffFlashTimers };
  }

  /**
   * 获取冷却时间
   * @returns 冷却时间对象
   */
  getCooldowns(): {
    consumableCooldowns: Record<string, number>;
    globalCooldown: number;
    combatStartTimer: number;
    itemCooldowns: Record<string, number>;
  } {
    return {
      consumableCooldowns: { ...this.consumableCooldowns },
      globalCooldown: this.globalConsumableCooldown,
      combatStartTimer: this.combatStartTimer,
      itemCooldowns: { ...this.itemCooldowns },
    };
  }

  /**
   * 获取诱饵投掷动画状态
   * @returns 诱饵投掷动画状态
   */
  getBaitThrowAnim(): typeof this.baitThrowAnim {
    return { ...this.baitThrowAnim };
  }

  /**
   * 获取诱饵目标位置
   * @returns 诱饵目标位置
   */
  getBaitTarget(): typeof this.baitTarget {
    return { ...this.baitTarget };
  }

  /**
   * 设置消耗品库存
   * @param inventory 消耗品库存
   */
  setInventory(inventory: Record<string, number>): void {
    this.consumableInventory = { ...inventory };
    this.notifyUpdate();
  }

  /**
   * 设置自动使用设置
   * @param settings 自动使用设置
   */
  setAutoUseSettings(settings: Record<string, boolean>): void {
    this.autoUseEnabled = { ...settings };
    this.notifyUpdate();
  }

  /**
   * 添加消耗品到库存
   * @param id 消耗品ID
   * @param count 数量
   */
  addConsumable(id: string, count: number = 1): void {
    if (!this.consumableInventory[id]) {
      this.consumableInventory[id] = 0;
    }
    this.consumableInventory[id] += count;
    this.notifyUpdate();
  }

  /**
   * 移除消耗品
   * @param id 消耗品ID
   * @param count 数量
   * @returns 是否成功移除
   */
  removeConsumable(id: string, count: number = 1): boolean {
    if (!this.consumableInventory[id] || this.consumableInventory[id] < count) {
      return false;
    }
    this.consumableInventory[id] -= count;
    if (this.consumableInventory[id] <= 0) {
      delete this.consumableInventory[id];
    }
    this.notifyUpdate();
    return true;
  }

  /**
   * 使用消耗品
   * @param id 消耗品ID
   * @returns 是否成功使用
   */
  useConsumable(id: string): boolean {
    // 检查库存
    if (!this.consumableInventory[id] || this.consumableInventory[id] <= 0) {
      return false;
    }

    // 检查冷却时间
    if (this.globalConsumableCooldown > 0 || this.combatStartTimer > 0) {
      return false;
    }

    // 检查物品特定冷却时间
    if (this.consumableCooldowns[id] && this.consumableCooldowns[id] > 0) {
      return false;
    }

    // 应用消耗品效果
    const success = this.applyConsumableEffect(id);
    if (!success) {
      return false;
    }

    // 减少库存
    this.consumableInventory[id]--;
    if (this.consumableInventory[id] <= 0) {
      delete this.consumableInventory[id];
    }

    // 应用冷却时间（紧急冷却除外）
    if (id !== 'emergency_cool') {
      const def = this.config.consumableDefs?.find(c => c.id === id);
      if (def?.cooldown) {
        this.consumableCooldowns[id] = def.cooldown;
      }
      this.globalConsumableCooldown = 1; // 1秒全局冷却时间
    }

    this.notifyUpdate();
    return true;
  }

  /**
   * 切换自动使用设置
   * @param id 消耗品ID
   * @returns 切换后的自动使用状态
   */
  toggleAutoUse(id: string): boolean {
    this.autoUseEnabled[id] = !this.autoUseEnabled[id];
    this.notifyUpdate();
    return this.autoUseEnabled[id];
  }

  /**
   * 检查并自动使用消耗品
   */
  checkAutoUseConsumables(): void {
    if (!this.config.player || this.config.gameState !== GameState.PLAYING) return;

    for (const [id, count] of Object.entries(this.consumableInventory)) {
      if (count <= 0) continue;

      let shouldUse = false;
      switch (id) {
        // 燃气补充：手动使用（已移至HUD）
        case 'emergency_cool':
          shouldUse = this.config.player.isOverheated;
          break;
        case 'shield':
          shouldUse = this.config.defenseHp / this.config.maxDefenseHp < 0.15;
          break;
        // 手动：gas_refill, defense_repair, power_boost, bait
      }

      if (shouldUse) {
        this.useConsumable(id);
      }
    }
  }

  /**
   * 更新增益闪光计时器
   * @param dt 时间增量
   */
  updateBuffFlashTimers(dt: number): void {
    // 更新增益闪光计时器
    for (const [id, timer] of Object.entries(this.buffFlashTimers)) {
      if (timer > 0) {
        this.buffFlashTimers[id] = timer - dt;
        if (this.buffFlashTimers[id] <= 0) {
          delete this.buffFlashTimers[id];
        }
      }
    }

    // 更新战斗开始计时器
    if (this.combatStartTimer > 0) {
      this.combatStartTimer -= dt;
      if (this.combatStartTimer < 0) this.combatStartTimer = 0;
    }

    // 更新全局冷却时间
    if (this.globalConsumableCooldown > 0) {
      this.globalConsumableCooldown -= dt;
      if (this.globalConsumableCooldown < 0) this.globalConsumableCooldown = 0;
    }

    // 更新单个消耗品冷却时间
    for (const [id, timer] of Object.entries(this.consumableCooldowns)) {
      if (timer > 0) {
        this.consumableCooldowns[id] = timer - dt;
        if (this.consumableCooldowns[id] <= 0) {
          delete this.consumableCooldowns[id];
        }
      }
    }

    // 更新拾取物品冷却时间（与商店消耗品共享全局冷却时间）
    for (const [type, timer] of Object.entries(this.itemCooldowns)) {
      if (timer > 0) {
        this.itemCooldowns[type] = timer - dt;
        if (this.itemCooldowns[type] <= 0) {
          delete this.itemCooldowns[type];
        }
      }
    }

    // 通知React UI冷却时间变化（节流以避免过多重新渲染）
    if (this.globalConsumableCooldown > 0 || Object.keys(this.consumableCooldowns).length > 0 || Object.keys(this.itemCooldowns).length > 0) {
      this.notifyUpdate();
    }

    // 更新诱饵投掷动画
    this.updateBaitThrowAnimation(dt);
  }

  /**
   * 更新消耗品效果
   * @param dt 时间增量
   */
  updateConsumableEffects(dt: number): void {
    // 更新玩家状态中的消耗品效果计时器
    if (this.config.player.powerBoostTimer > 0) {
      this.config.player.powerBoostTimer -= dt;
      if (this.config.player.powerBoostTimer <= 0) {
        this.config.player.powerBoostTimer = 0;
      }
    }

    if (this.config.player.shieldTimer > 0) {
      this.config.player.shieldTimer -= dt;
      if (this.config.player.shieldTimer <= 0) {
        this.config.player.shieldTimer = 0;
        this.config.player.shieldActive = false;
      }
    }

    if (this.config.player.baitTimer > 0) {
      this.config.player.baitTimer -= dt;
      if (this.config.player.baitTimer <= 0) {
        this.config.player.baitTimer = 0;
        this.baitTarget.active = false;
      }
    }
  }

  /**
   * 重置消耗品系统
   */
  reset(): void {
    this.consumableInventory = {};
    this.autoUseEnabled = {};
    this.emergencyCoolInventory = 0;
    this.buffFlashTimers = {};
    this.consumableCooldowns = {};
    this.globalConsumableCooldown = 0;
    this.combatStartTimer = 0;
    this.itemCooldowns = {};
    this.baitThrowAnim = { active: false, x: 0, y: 0, targetX: 0, targetY: 0, timer: 0 };
    this.baitTarget = { x: 0, y: 0, active: false };
  }

  /**
   * 设置战斗开始计时器
   * @param timer 计时器值
   */
  setCombatStartTimer(timer: number): void {
    this.combatStartTimer = timer;
  }

  /**
   * 设置物品冷却时间
   * @param type 物品类型
   * @param cooldown 冷却时间
   */
  setItemCooldown(type: string, cooldown: number): void {
    this.itemCooldowns[type] = cooldown;
  }

  /**
   * 应用消耗品效果
   * @param id 消耗品ID
   * @returns 是否成功应用
   */
  private applyConsumableEffect(id: string): boolean {
    switch (id) {
      case 'gas_refill': {
        const oldGas = this.config.player.gas;
        this.config.player.gas = this.config.player.maxGas;
        const actualRefill = this.config.player.gas - oldGas;
        if (actualRefill > 0 && this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.config.player.x,
            this.config.player.y - 40,
            `燃气补充 +${actualRefill}`,
            '#60a5fa',
            1500
          );
        }
        break;
      }
      case 'defense_repair': {
        const healAmount = Math.floor(this.config.maxDefenseHp * 0.2); // 最大生命值的20%
        const oldHp = this.config.defenseHp;
        const newHp = Math.min(this.config.maxDefenseHp, this.config.defenseHp + healAmount);
        const actualHeal = newHp - oldHp;
        this.buffFlashTimers['defense_repair'] = 2; // 2秒增益闪光
        if (actualHeal > 0 && this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.config.canvasWidth / 2,
            this.config.defenseLineY() - 30,
            `防线修复 +${actualHeal}`,
            '#4ade80',
            1500
          );
        }
        // 更新防御生命值
        if (this.config.onDefenseUpdate) {
          this.config.onDefenseUpdate(newHp, this.config.maxDefenseHp);
        }
        break;
      }
      case 'emergency_cool': {
        // 从商店购买 → 添加到紧急冷却库存（免费使用）
        this.emergencyCoolInventory++;
        if (this.config.onEmergencyCoolUpdate) {
          this.config.onEmergencyCoolUpdate(this.emergencyCoolInventory);
        }
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.config.player.x,
            this.config.player.y - 40,
            `紧急冷却 +1 (共${this.emergencyCoolInventory}次)`,
            '#60a5fa',
            1500
          );
        }
        break;
      }
      case 'power_boost': {
        this.config.player.powerBoostTimer = 8;
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.config.canvasWidth / 2,
            this.config.canvasHeight / 2,
            '>>> 火力全开 8秒 <<<',
            '#ef4444',
            2000,
            32
          );
        }
        break;
      }
      case 'shield': {
        this.config.player.shieldTimer = 5;
        this.config.player.shieldActive = true;
        this.buffFlashTimers['shield'] = 5; // 与React UI同步以显示增益图标
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.config.canvasWidth / 2,
            this.config.canvasHeight / 2 - 50,
            '>>> 防线护盾 5秒 <<<',
            '#06b6d4',
            2000
          );
        }
        break;
      }
      case 'bait': {
        this.config.player.baitTimer = 3;
        // 目标：地面边界中心（蟑螂可行走区域）
        let targetX = this.config.canvasWidth / 2;
        let targetY = this.config.canvasHeight * 0.7;
        
        if (this.config.onGetGroundCenter) {
          [targetX, targetY] = this.config.onGetGroundCenter();
        }
        
        this.baitTarget = { x: targetX, y: targetY, active: true };
        
        // 开始向地面中心投掷动画
        this.baitThrowAnim = {
          active: true,
          x: this.config.player.x,
          y: this.config.player.y - 50,
          targetX,
          targetY,
          timer: 0.8,
        };
        
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            targetX,
            targetY - 40,
            '>>> 蟑螂诱饵已投放 <<<',
            '#fbbf24',
            2000
          );
        }
        break;
      }
      default:
        return false;
    }

    return true;
  }

  /**
   * 更新诱饵投掷动画
   * @param dt 时间增量
   */
  private updateBaitThrowAnimation(dt: number): void {
    if (!this.baitThrowAnim.active) return;

    this.baitThrowAnim.timer -= dt;
    const progress = 1 - this.baitThrowAnim.timer / 0.8;

    if (progress < 1) {
      // 抛物线弧线朝向目标蟑螂
      const t = progress;
      const startX = this.baitThrowAnim.x;
      const startY = this.baitThrowAnim.y;
      const targetX = this.baitThrowAnim.targetX;
      const targetY = this.baitThrowAnim.targetY;

      // 简单的抛物线插值
      const currentX = startX + (targetX - startX) * t;
      const currentY = startY + (targetY - startY) * t + 100 * Math.sin(t * Math.PI); // 抛物线高度

      // 更新动画位置（用于渲染）
      this.baitThrowAnim.x = currentX;
      this.baitThrowAnim.y = currentY;
    } else {
      // 动画完成
      this.baitThrowAnim.active = false;
    }
  }

  /**
   * 通知更新
   */
  private notifyUpdate(): void {
    if (this.config.onConsumableUpdate) {
      this.config.onConsumableUpdate(
        this.consumableInventory,
        this.buffFlashTimers,
        this.consumableCooldowns,
        this.globalConsumableCooldown,
        this.combatStartTimer,
        this.itemCooldowns
      );
    }

    if (this.config.onPlayerUpdate) {
      this.config.onPlayerUpdate(this.config.player);
    }
  }
}
