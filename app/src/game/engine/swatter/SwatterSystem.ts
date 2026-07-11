/**
 * @fileoverview 电蚊拍系统模块
 * @description 负责管理电蚊拍的拾取、使用（全屏破甲+麻痹）、冷却和动画
 */

import { RoachState, type Roach, type InventoryItem } from '../../types';
import { WEAPON_DROP_DEFS } from '../../data';

/**
 * 电蚊拍系统配置接口
 */
export interface SwatterSystemConfig {
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 天赋冷却缩减 */
  talentCdReduction?: number;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string, duration?: number) => void;
  /** 播放电蚊拍音效回调 */
  onPlaySwatter?: () => void;
  /** 生成火花粒子回调 */
  onSpawnSparkParticles?: (x: number, y: number, count: number) => void;
  /** 生成闪电粒子回调 */
  onSpawnLightningParticles?: (centerX: number, topY: number) => void;
  /** 屏幕震动回调 */
  onScreenShake?: (amount: number) => void;
  /** 物品栏更新回调 */
  onInventoryUpdate?: (inventory: InventoryItem[]) => void;
}

/**
 * 电蚊拍使用结果接口
 */
export interface SwatterUseResult {
  success: boolean;
  inventory: InventoryItem[];
  itemCooldowns: Record<string, number>;
  globalConsumableCooldown: number;
}

/**
 * 电蚊拍系统类
 */
export class SwatterSystem {
  private config: SwatterSystemConfig;

  // ========== 状态 ==========
  swatterReady: boolean = true;
  swatterCooldown: number = 0;
  swatterCooldownMax: number = 60;
  swatterAnimTimer: number = 0;
  swatterActive: boolean = false;
  swatterSwingX: number = 0;

  constructor(config: SwatterSystemConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<SwatterSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========== 更新 ==========
  updateSwatter(deltaTime: number, playerX: number, playerY: number): void {
    if (this.swatterAnimTimer > 0) {
      this.swatterAnimTimer -= deltaTime;
      if (this.swatterAnimTimer <= 0) this.swatterActive = false;
    }
    if (!this.swatterReady) {
      const cdReduction = this.config.talentCdReduction || 0;
      this.swatterCooldown -= deltaTime * (1 + cdReduction);
      if (this.swatterCooldown <= 0) {
        this.swatterReady = true;
        this.swatterCooldown = 0;
        this.config.onAddFloatingText?.(playerX, playerY - 50, '⚡ 电蚊拍就绪!', '#4ade80');
      }
    }
  }

  // ========== 使用 ==========
  useSwatter(
    globalConsumableCooldown: number,
    itemCooldowns: Record<string, number>,
    inventory: InventoryItem[],
    roaches: Roach[],
    playerX: number,
    playerY: number
  ): SwatterUseResult {
    const result: SwatterUseResult = {
      success: false,
      inventory: [...inventory],
      itemCooldowns: { ...itemCooldowns },
      globalConsumableCooldown,
    };

    // 检查全局道具冷却
    if (result.globalConsumableCooldown > 0) {
      this.config.onAddFloatingText?.(playerX, playerY - 40, `道具冷却中... (${result.globalConsumableCooldown.toFixed(1)}s)`, '#94a3b8', 800);
      return result;
    }
    if ((result.itemCooldowns['swatter'] || 0) > 0) {
      this.config.onAddFloatingText?.(playerX, playerY - 40, `电蚊拍冷却中... (${result.itemCooldowns['swatter'].toFixed(1)}s)`, '#94a3b8', 800);
      return result;
    }

    // 检查物品栏
    const swatterIdx = result.inventory.findIndex((item: InventoryItem) => item.type === 'swatter');
    if (swatterIdx < 0 || result.inventory[swatterIdx].count <= 0) {
      this.config.onAddFloatingText?.(playerX, playerY - 50, '没有电蚊拍!', '#9ca3af');
      return result;
    }

    // 消耗
    result.inventory[swatterIdx] = { ...result.inventory[swatterIdx], count: result.inventory[swatterIdx].count - 1 };
    if (result.inventory[swatterIdx].count <= 0) {
      result.inventory.splice(swatterIdx, 1);
    }

    // 设置冷却
    const def = WEAPON_DROP_DEFS['swatter'];
    if (def && def.cooldown > 0) {
      result.itemCooldowns['swatter'] = def.cooldown;
    }
    result.globalConsumableCooldown = 1;
    result.success = true;

    // 动画
    this.swatterActive = true;
    this.swatterAnimTimer = 0.6;
    this.swatterSwingX = playerX;
    this.config.onPlaySwatter?.();

    let hitCount = 0;
    let armorBreakCount = 0;

    // 全屏电蚊拍：影响所有存活蟑螂（除Boss）
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.isBoss) continue;

      hitCount++;

      // 破甲
      if (r.armorHp > 0) {
        r.armorHp = 0;
        armorBreakCount++;
        this.config.onSpawnSparkParticles?.(r.x, r.y, 5);
        this.config.onAddFloatingText?.(r.x, r.y - 30, '破甲!', '#fbbf24');
      }

      // 麻痹减速 5秒
      r.speed = r.baseSpeed * 0.2;
      r.isStunned = true;
      r.stunTimer = 5;
    }

    this.config.onScreenShake?.(12);
    this.config.onSpawnLightningParticles?.(this.config.canvasWidth / 2, 0);

    if (hitCount > 0) {
      const msg = armorBreakCount > 0
        ? `⚡电蚊拍全屏!命中${hitCount}只!破甲${armorBreakCount}!`
        : `⚡电蚊拍全屏!命中${hitCount}只!麻痹!`;
      this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 3, msg, '#4ade80');
    } else {
      this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 3, '⚡电蚊拍!未命中', '#9ca3af');
    }

    return result;
  }

  // ========== 拾取 ==========
  spawnSwatterPickup(
    x: number,
    y: number,
    inventory: InventoryItem[],
    onInventoryUpdate: (inventory: InventoryItem[]) => void
  ): void {
    const existing = inventory.find((item: InventoryItem) => item.type === 'swatter');
    if (existing) {
      if (existing.count < 3) {
        existing.count++;
        this.config.onAddFloatingText?.(x, y - 40, '获得电蚊拍!', '#4ade80');
      }
    } else {
      inventory.push({ type: 'swatter', count: 1 });
      this.config.onAddFloatingText?.(x, y - 40, '获得电蚊拍!', '#4ade80');
    }
    onInventoryUpdate(inventory);
  }

  reset(): void {
    this.swatterReady = true;
    this.swatterCooldown = 0;
    this.swatterCooldownMax = 60;
    this.swatterAnimTimer = 0;
    this.swatterActive = false;
    this.swatterSwingX = 0;
  }
}