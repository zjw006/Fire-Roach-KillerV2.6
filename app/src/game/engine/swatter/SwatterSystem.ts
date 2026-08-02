/**
 * @fileoverview 电蚊拍系统模块
 * @description 负责管理电蚊拍的拾取、使用（全屏破甲+麻痹）、冷却和动画
 */

import { RoachState, type Roach, type InventoryItem } from '../../types';
import { WEAPON_DROP_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';

/** 电蚊拍道具类型标识 */
const SWATTER_TYPE = 'swatter';

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
      const cdReduction = Math.max(0, this.config.talentCdReduction || 0);
      this.swatterCooldown -= deltaTime * (1 + cdReduction);
      if (this.swatterCooldown <= 0) {
        this.swatterReady = true;
        this.swatterCooldown = 0;
        this.config.onAddFloatingText?.(playerX, playerY - 50, TEXT_CONFIG.combat.swatterReady.text, TEXT_CONFIG.combat.swatterReady.color);
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
      this.config.onAddFloatingText?.(playerX, playerY - 40, TEXT_CONFIG.combat.globalCooldown.text(result.globalConsumableCooldown.toFixed(1)), TEXT_CONFIG.combat.globalCooldown.color, 800);
      return result;
    }
    if ((result.itemCooldowns[SWATTER_TYPE] || 0) > 0) {
      this.config.onAddFloatingText?.(playerX, playerY - 40, TEXT_CONFIG.combat.swatterCooldown.text(result.itemCooldowns[SWATTER_TYPE].toFixed(1)), TEXT_CONFIG.combat.swatterCooldown.color, 800);
      return result;
    }

    // 检查物品栏
    const swatterIdx = result.inventory.findIndex((item: InventoryItem) => item.type === SWATTER_TYPE);
    if (swatterIdx < 0 || result.inventory[swatterIdx].count <= 0) {
      this.config.onAddFloatingText?.(playerX, playerY - 50, TEXT_CONFIG.combat.swatterNoItem.text, TEXT_CONFIG.combat.swatterNoItem.color);
      return result;
    }

    // 消耗
    result.inventory[swatterIdx] = { ...result.inventory[swatterIdx], count: result.inventory[swatterIdx].count - 1 };
    if (result.inventory[swatterIdx].count <= 0) {
      result.inventory = result.inventory.filter((_, i) => i !== swatterIdx);
    }

    // 设置冷却
    const def = WEAPON_DROP_DEFS[SWATTER_TYPE];
    if (def && def.cooldown > 0) {
      result.itemCooldowns[SWATTER_TYPE] = def.cooldown;
    }
    result.globalConsumableCooldown = BALANCE_CONFIG.consumable.globalCooldown;
    result.success = true;
    this.swatterReady = false;
    this.swatterCooldown = BALANCE_CONFIG.swatter.cooldownMax;

    // 动画
    this.swatterActive = true;
    this.swatterAnimTimer = BALANCE_CONFIG.swatter.animTimer;
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
        this.config.onAddFloatingText?.(r.x, r.y - 30, TEXT_CONFIG.combat.armorBreak.text, TEXT_CONFIG.combat.armorBreak.color);
      }

      // 麻痹减速
      r.speed = r.baseSpeed * BALANCE_CONFIG.swatter.stunSpeedRatio;
      r.isStunned = true;
      r.stunTimer = BALANCE_CONFIG.swatter.stunDuration;
    }

    this.config.onScreenShake?.(BALANCE_CONFIG.screenShake.swatter);
    this.config.onSpawnLightningParticles?.(this.config.canvasWidth / 2, 0);

    if (hitCount > 0) {
      const msg = armorBreakCount > 0
        ? TEXT_CONFIG.combat.swatterHit.text(hitCount, armorBreakCount)
        : TEXT_CONFIG.combat.swatterHitParalyze.text(hitCount);
      this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 3, msg, TEXT_CONFIG.combat.swatterHit.color);
    } else {
      this.config.onAddFloatingText?.(this.config.canvasWidth / 2, this.config.canvasHeight / 3, TEXT_CONFIG.combat.swatterMiss.text, TEXT_CONFIG.combat.swatterMiss.color);
    }

    return result;
  }

  // ========== 拾取 ==========
  spawnSwatterPickup(
    x: number,
    y: number,
    inventory: InventoryItem[]
  ): InventoryItem[] {
    const newInventory = [...inventory];
    const existing = newInventory.find((item: InventoryItem) => item.type === SWATTER_TYPE);
    if (existing) {
      if (existing.count < BALANCE_CONFIG.swatter.maxInventory) {
        existing.count++;
        this.config.onAddFloatingText?.(x, y - 40, TEXT_CONFIG.combat.swatterPickup.text, TEXT_CONFIG.combat.swatterPickup.color);
      }
    } else {
      newInventory.push({ type: SWATTER_TYPE, count: 1 });
      this.config.onAddFloatingText?.(x, y - 40, TEXT_CONFIG.combat.swatterPickup.text, TEXT_CONFIG.combat.swatterPickup.color);
    }
    return newInventory;
  }

  reset(): void {
    this.swatterReady = true;
    this.swatterCooldown = 0;
    this.swatterAnimTimer = 0;
    this.swatterActive = false;
    this.swatterSwingX = 0;
  }
}