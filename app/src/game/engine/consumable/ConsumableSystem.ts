/**
 * @fileoverview 消耗品系统模块
 * @description 负责管理游戏中所有消耗品的逻辑，包括购买、库存、自动使用、冷却系统、效果应用等
 */

import { GameState, ParticleType } from '../../types';
import type { Player, Particle, ConsumableDef } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG, FLOAT_COLOR } from '../../data';

/**
 * 消耗品系统配置接口
 */
export interface ConsumableSystemConfig {
  /** 消耗品定义列表 */
  consumableDefs: ConsumableDef[];
  /** 添加浮动文字回调 */
  onAddFloatingText: (x: number, y: number, text: string, color: string, duration?: number, fontSize?: number) => void;
  /** 生成烟雾粒子回调 */
  onSpawnSmokeParticles: (x: number, y: number, count: number) => void;
  /** 添加粒子回调 */
  onAddParticle: (particle: Particle) => void;
  /** 消耗品UI更新回调 */
  onConsumableUpdate?: (inventory: Record<string, number>, buffTimers: Record<string, number>, cooldowns?: Record<string, number>, globalCooldown?: number, combatStartTimer?: number, itemCooldowns?: Record<string, number>) => void;
  /** 紧急冷却库存更新回调 */
  onEmergencyCoolUpdate?: (count: number) => void;
  /** 经济系统更新回调 */
  onEconomyUpdate?: (economy: any) => void;
  /** 玩家状态更新回调 */
  onPlayerUpdate?: (player: Player) => void;
  /** 防御状态更新回调 */
  onDefenseUpdate?: (defenseHp: number, maxDefenseHp: number) => void;
  /** 获取玩家回调 */
  getPlayer: () => Player;
  /** 获取防御生命值回调 */
  getDefenseHp: () => number;
  /** 获取最大防御生命值回调 */
  getMaxDefenseHp: () => number;
  /** 获取画布宽度回调 */
  getCanvasWidth: () => number;
  /** 获取画布高度回调 */
  getCanvasHeight: () => number;
  /** 获取游戏状态回调 */
  getGameState: () => GameState;
  /** 获取防御线Y坐标回调 */
  getDefenseLineY: () => number;
  /** 获取地面中心回调 */
  getGroundCenter: () => [number, number];
  /** 获取粒子限制回调 */
  getParticleLimit: () => number;
  /** 获取当前粒子数量回调 */
  getParticleCount: () => number;
  /** 获取经济系统回调 */
  getEconomy: () => any;
  /** 设置经济系统回调 */
  setEconomy: (economy: any) => void;
}

/**
 * 消耗品系统类
 * @description 管理消耗品的库存、购买、自动使用、冷却和效果应用
 */
export class ConsumableSystem {
  /** 系统配置 */
  private config: ConsumableSystemConfig;

  /** 消耗品库存 */
  consumableInventory: Record<string, number> = {};
  /** 自动使用设置 */
  autoUseEnabled: Record<string, boolean> = {};
  /** 紧急冷却库存 */
  emergencyCoolInventory: number = 0;
  /** 增益闪光计时器 */
  buffFlashTimers: Record<string, number> = {};
  /** 消耗品冷却时间 */
  consumableCooldowns: Record<string, number> = {};
  /** 全局消耗品冷却时间 */
  globalConsumableCooldown: number = 0;
  /** 战斗开始计时器 */
  combatStartTimer: number = 0;
  /** 物品冷却时间（拾取道具） */
  itemCooldowns: Record<string, number> = {};
  /** 诱饵投掷动画状态 */
  baitThrowAnim: { active: boolean; x: number; y: number; targetX: number; targetY: number; timer: number } = { active: false, x: 0, y: 0, targetX: 0, targetY: 0, timer: 0 };
  /** 诱饵目标位置 */
  baitTarget: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  /** 火力全开倒计时跟踪 */
  _lastPowerBoostCountdown: number = -1;

  constructor(config: ConsumableSystemConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<ConsumableSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ========== 重置 ==========

  reset(): void {
    this.consumableCooldowns = {};
    this.globalConsumableCooldown = 0;
    this.combatStartTimer = BALANCE_CONFIG.consumable.combatStartDelay;
    this.baitTarget = { x: 0, y: 0, active: false };
    this._lastPowerBoostCountdown = -1;
    this.itemCooldowns = {};
    // consumableInventory and autoUseEnabled are persisted across levels
    this.buffFlashTimers = {};
    this.baitThrowAnim = { active: false, x: 0, y: 0, targetX: 0, targetY: 0, timer: 0 };
  }

  // ========== 购买 ==========

  /**
   * 购买消耗品
   */
  buyConsumable(id: string): boolean {
    const def = this.config.consumableDefs.find(c => c.id === id);
    if (!def) return false;
    const economy = this.config.getEconomy();
    if (economy.money < def.cost) return false;

    economy.money -= def.cost;
    this.consumableInventory[id] = (this.consumableInventory[id] || 0) + 1;
    if (this.autoUseEnabled[id] === undefined) {
      this.autoUseEnabled[id] = true;
    }

    this.config.setEconomy({ ...economy });
    this.config.onEconomyUpdate?.(this.config.getEconomy());
    this.notifyConsumableUpdate();
    return true;
  }

  // ========== 使用消耗品 ==========

  /**
   * 使用库存中的消耗品
   */
  useConsumable(id: string): boolean {
    const player = this.config.getPlayer();
    if (!player) return false;
    if ((this.consumableInventory[id] || 0) <= 0) return false;

    if (id !== 'emergency_cool') {
      if (this.combatStartTimer > 0) {
        this.config.onAddFloatingText(player.x, player.y - 40, `冷却中... (${this.combatStartTimer.toFixed(1)}s)`, '#94a3b8', 800);
        return false;
      }
      if ((this.consumableCooldowns[id] || 0) > 0) {
        this.config.onAddFloatingText(player.x, player.y - 40, `${this.config.consumableDefs.find(c => c.id === id)?.name || ''}冷却中... (${this.consumableCooldowns[id].toFixed(1)}s)`, '#94a3b8', 800);
        return false;
      }
      if (this.globalConsumableCooldown > 0) {
        this.config.onAddFloatingText(player.x, player.y - 40, `全局冷却中... (${this.globalConsumableCooldown.toFixed(1)}s)`, '#94a3b8', 800);
        return false;
      }
    }

    this.consumableInventory[id]--;
    if (this.consumableInventory[id] <= 0) delete this.consumableInventory[id];

    switch (id) {
      case 'gas_refill': {
        player.gas = player.maxGas;
        this.buffFlashTimers['gas_refill'] = BALANCE_CONFIG.consumable.buffFlashDuration;
        this.config.onAddFloatingText(player.x, player.y - 40, TEXT_CONFIG.combat.gasRefill, FLOAT_COLOR.gold, 1500);
        break;
      }
      case 'defense_repair': {
        const maxDefenseHp = this.config.getMaxDefenseHp();
        const healAmount = Math.floor(maxDefenseHp * BALANCE_CONFIG.defense.repairPercent);
        const oldHp = this.config.getDefenseHp();
        const newHp = Math.min(maxDefenseHp, oldHp + healAmount);
        const actualHeal = newHp - oldHp;
        this.buffFlashTimers['defense_repair'] = BALANCE_CONFIG.consumable.buffFlashDuration;
        if (actualHeal > 0) {
          this.config.onAddFloatingText(this.config.getCanvasWidth() / 2, this.config.getDefenseLineY() - 30, `防线修复 +${actualHeal}`, '#4ade80', 1500);
        }
        this.config.onDefenseUpdate?.(newHp, maxDefenseHp);
        break;
      }
      case 'emergency_cool': {
        this.emergencyCoolInventory++;
        this.config.onEmergencyCoolUpdate?.(this.emergencyCoolInventory);
        this.config.onAddFloatingText(player.x, player.y - 40, `紧急冷却 +1 (共${this.emergencyCoolInventory}次)`, '#60a5fa', 1500);
        break;
      }
      case 'power_boost': {
        player.powerBoostTimer = BALANCE_CONFIG.consumable.powerBoostDuration;
        this.config.onAddFloatingText(this.config.getCanvasWidth() / 2, this.config.getCanvasHeight() / 2, TEXT_CONFIG.combat.powerBoost(BALANCE_CONFIG.consumable.powerBoostDuration), FLOAT_COLOR.danger, 2000, 32);
        break;
      }
      case 'shield': {
        player.shieldTimer = BALANCE_CONFIG.consumable.shieldDuration;
        player.shieldActive = true;
        this.buffFlashTimers['shield'] = BALANCE_CONFIG.consumable.shieldDuration;
        this.config.onAddFloatingText(this.config.getCanvasWidth() / 2, this.config.getCanvasHeight() / 2 - 50, TEXT_CONFIG.combat.shieldActive(BALANCE_CONFIG.consumable.shieldDuration), FLOAT_COLOR.shieldActive, 2000);
        break;
      }
      case 'bait': {
        player.baitTimer = BALANCE_CONFIG.consumable.baitDuration;
        const [targetX, targetY] = this.config.getGroundCenter();
        this.baitTarget = { x: targetX, y: targetY, active: true };
        this.baitThrowAnim = {
          active: true,
          x: player.x,
          y: player.y - 50,
          targetX,
          targetY,
          timer: BALANCE_CONFIG.consumable.baitThrowAnimDuration,
        };
        this.config.onAddFloatingText(targetX, targetY - 40, TEXT_CONFIG.combat.baitPlaced, FLOAT_COLOR.gold, 2000);
        break;
      }
    }

    if (id !== 'emergency_cool') {
      const def = this.config.consumableDefs.find(c => c.id === id);
      if (def?.cooldown) {
        this.consumableCooldowns[id] = def.cooldown;
      }
      this.globalConsumableCooldown = BALANCE_CONFIG.consumable.globalCooldown;
    }

    this.notifyConsumableUpdate();
    this.config.onPlayerUpdate?.(player);
    this.config.onDefenseUpdate?.(this.config.getDefenseHp(), this.config.getMaxDefenseHp());

    return true;
  }

  // ========== 自动使用 ==========

  /**
   * 切换自动使用设置
   */
  toggleAutoUse(id: string): boolean {
    this.autoUseEnabled[id] = !this.autoUseEnabled[id];
    this.notifyConsumableUpdate();
    return this.autoUseEnabled[id];
  }

  /**
   * 检查并自动使用消耗品
   */
  checkAutoUseConsumables(): void {
    const player = this.config.getPlayer();
    if (!player || this.config.getGameState() !== GameState.PLAYING) return;

    for (const [id, count] of Object.entries(this.consumableInventory)) {
      if (count <= 0) continue;

      let shouldUse = false;
      switch (id) {
        case 'emergency_cool':
          shouldUse = player.isOverheated;
          break;
        case 'shield':
          shouldUse = this.config.getDefenseHp() / this.config.getMaxDefenseHp() < 0.15;
          break;
      }

      if (shouldUse) {
        this.useConsumable(id);
      }
    }
  }

  // ========== 紧急冷却 ==========

  /**
   * 紧急冷却（玩家过热时使用）
   */
  emergencyCool(): boolean {
    const player = this.config.getPlayer();
    if (!player.isOverheated) return false;
    if (this.emergencyCoolInventory > 0) {
      this.emergencyCoolInventory--;
      player.isOverheated = false;
      player.overheatTimer = 0;
      player.heat = 0;
      this.config.onSpawnSmokeParticles(player.x, player.y, 20);
      this.config.onAddFloatingText(player.x, player.y - 60, `紧急冷却! (剩余${this.emergencyCoolInventory}次)`, '#60a5fa');
      this.config.onEmergencyCoolUpdate?.(this.emergencyCoolInventory);
      return true;
    }
    return false;
  }

  // ========== 更新 ==========

  /**
   * 主更新方法（每帧调用）
   */
  update(dt: number): void {
    this.updateConsumableEffects(dt);
    this.updateBuffFlashTimers(dt);
  }

  /**
   * 更新消耗品临时效果计时器
   */
  private updateConsumableEffects(dt: number): void {
    const player = this.config.getPlayer();
    if (!player) return;

    if (player.powerBoostTimer > 0) {
      player.powerBoostTimer -= dt;
      const secondsLeft = Math.ceil(player.powerBoostTimer);
      if (secondsLeft > 0 && secondsLeft !== this._lastPowerBoostCountdown) {
        this._lastPowerBoostCountdown = secondsLeft;
        this.config.onAddFloatingText(this.config.getCanvasWidth() / 2, this.config.getCanvasHeight() / 2, `火力全开 ${secondsLeft}秒`, '#ef4444', 800, 32);
      }
      if (player.powerBoostTimer <= 0) {
        player.powerBoostTimer = 0;
        this._lastPowerBoostCountdown = -1;
        this.config.onAddFloatingText(this.config.getCanvasWidth() / 2, this.config.getCanvasHeight() / 2, TEXT_CONFIG.combat.powerBoostEnd, FLOAT_COLOR.warning, 1500, 32);
      }
    }

    if (player.shieldTimer > 0) {
      player.shieldTimer -= dt;
      this.buffFlashTimers['shield'] = player.shieldTimer;
      if (player.shieldTimer <= 0) {
        player.shieldTimer = 0;
        player.shieldActive = false;
        delete this.buffFlashTimers['shield'];
        this.config.onAddFloatingText(this.config.getCanvasWidth() / 2, this.config.getCanvasHeight() / 2 - 50, TEXT_CONFIG.combat.shieldEnd, FLOAT_COLOR.shield, 1500);
      }
    }

    if (player.baitTimer > 0) {
      player.baitTimer -= dt;
      // 持续气味粒子
      if (this.baitTarget.active && this.config.getParticleCount() < this.config.getParticleLimit() - 20) {
        for (let i = 0; i < 2; i++) {
          this.config.onAddParticle({
            x: this.baitTarget.x + (Math.random() - 0.5) * 30,
            y: this.baitTarget.y - Math.random() * 10,
            vx: (Math.random() - 0.5) * 8,
            vy: -(15 + Math.random() * 20),
            life: 1.2 + Math.random() * 0.8,
            maxLife: 2,
            color: Math.random() < 0.5 ? '#fbbf24' : '#fcd34d',
            size: 2 + Math.random() * 2.5,
            type: ParticleType.SMOKE,
          });
        }
      }
      if (player.baitTimer <= 0) {
        player.baitTimer = 0;
        this.baitTarget.active = false;
        this.config.onAddFloatingText(this.baitTarget.x, this.baitTarget.y - 40, TEXT_CONFIG.combat.baitEnd, FLOAT_COLOR.gold, 1500);
      }
    }
  }

  /**
   * 更新增益闪光计时器和冷却时间
   */
  private updateBuffFlashTimers(dt: number): void {
    for (const [id, timer] of Object.entries(this.buffFlashTimers)) {
      if (timer > 0) {
        this.buffFlashTimers[id] = timer - dt;
        if (this.buffFlashTimers[id] <= 0) {
          delete this.buffFlashTimers[id];
        }
      }
    }

    if (this.combatStartTimer > 0) {
      this.combatStartTimer -= dt;
      if (this.combatStartTimer < 0) this.combatStartTimer = 0;
    }

    if (this.globalConsumableCooldown > 0) {
      this.globalConsumableCooldown -= dt;
      if (this.globalConsumableCooldown < 0) this.globalConsumableCooldown = 0;
    }

    for (const [id, timer] of Object.entries(this.consumableCooldowns)) {
      if (timer > 0) {
        this.consumableCooldowns[id] = timer - dt;
        if (this.consumableCooldowns[id] <= 0) {
          delete this.consumableCooldowns[id];
        }
      }
    }

    for (const [type, timer] of Object.entries(this.itemCooldowns)) {
      if (timer > 0) {
        this.itemCooldowns[type] = timer - dt;
        if (this.itemCooldowns[type] <= 0) {
          delete this.itemCooldowns[type];
        }
      }
    }

    if (this.globalConsumableCooldown > 0 || Object.keys(this.consumableCooldowns).length > 0 || Object.keys(this.itemCooldowns).length > 0) {
      this.notifyConsumableUpdate();
    }

    // 诱饵投掷动画
    if (this.baitThrowAnim.active) {
      this.baitThrowAnim.timer -= dt;
      const progress = 1 - this.baitThrowAnim.timer / BALANCE_CONFIG.consumable.baitThrowAnimDuration;
      if (progress < 1) {
        this.baitThrowAnim.x += (this.baitThrowAnim.targetX - this.baitThrowAnim.x) * 0.15;
        const height = 150 * Math.sin(progress * Math.PI);
        this.baitThrowAnim.y = this.baitThrowAnim.targetY - height;
      } else {
        this.baitThrowAnim.active = false;
        // 粉碎效果：黄色爆裂模拟诱饵罐破碎 + 气味释放
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 60;
          this.config.onAddParticle({
            x: this.baitThrowAnim.targetX + Math.cos(angle) * dist,
            y: this.baitThrowAnim.targetY + Math.sin(angle) * dist * 0.3,
            vx: Math.cos(angle) * (30 + Math.random() * 40),
            vy: Math.sin(angle) * (15 + Math.random() * 25) - 20,
            life: 1.5 + Math.random(),
            maxLife: 2.5,
            color: '#fbbf24',
            size: 2 + Math.random() * 3,
            type: ParticleType.EMBER,
          });
        }
        // 玻璃碎片
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          this.config.onAddParticle({
            x: this.baitThrowAnim.targetX,
            y: this.baitThrowAnim.targetY,
            vx: Math.cos(angle) * (40 + Math.random() * 60),
            vy: Math.sin(angle) * (20 + Math.random() * 30) - 30,
            life: 1 + Math.random() * 0.8,
            maxLife: 1.8,
            color: '#e5e7eb',
            size: 1 + Math.random() * 2,
            type: ParticleType.SPARK,
          });
        }
      }
    }
    this.notifyConsumableUpdate();
  }

  // ========== 通知 ==========

  private notifyConsumableUpdate(): void {
    this.config.onConsumableUpdate?.(
      { ...this.consumableInventory },
      { ...this.buffFlashTimers },
      { ...this.consumableCooldowns },
      this.globalConsumableCooldown,
      this.combatStartTimer,
      { ...this.itemCooldowns }
    );
  }

  /**
   * 渲染诱饵投掷动画（罐子飞行 + 拖尾）
   */
  static renderBaitThrow(
    ctx: CanvasRenderingContext2D,
    baitThrowAnim: { active: boolean; x: number; y: number; targetX: number; targetY: number; timer: number },
    time: number
  ): void {
    if (!baitThrowAnim.active) return;
    ctx.save();
    const { x, y, targetX, targetY } = baitThrowAnim;
    // Shadow on ground below
    const shadowY = targetY;
    const height = shadowY - y;
    const shadowScale = Math.max(0.3, 1 - height / 200);
    ctx.globalAlpha = 0.2 * shadowScale;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, shadowY, 10 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Bait jar body
    ctx.translate(x, y);
    const jarW = 14, jarH = 18;
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(-jarW / 2, -jarH / 2, jarW, jarH, 4);
    ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.roundRect(-jarW / 2 + 2, -jarH / 2 + 2, jarW - 6, jarH - 6, 2);
    ctx.fill();
    ctx.fillStyle = '#57534e';
    ctx.fillRect(-jarW / 2 - 1, -jarH / 2 - 3, jarW + 2, 5);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-jarW / 2 + 1, -2, jarW - 2, 4);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 8);
    ctx.beginPath();
    ctx.arc(-3, -3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Trail dots
    const dx = targetX - x;
    const dy = targetY - y;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const trailProgress = Math.max(0, 1 - baitThrowAnim.timer / 0.8 - t * 0.15);
      if (trailProgress <= 0) continue;
      const trailX = x - dx * t * 0.3;
      const trailY = y - dy * t * 0.3;
      ctx.globalAlpha = 0.4 * (1 - t);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(trailX, trailY, 2 - t * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * 渲染诱饵地面标记（香味光环 + 玻璃碎片）
   */
  static renderBaitMark(
    ctx: CanvasRenderingContext2D,
    baitTarget: { active: boolean; x: number; y: number },
    baitTimer: number,
    time: number
  ): void {
    if (!baitTarget.active || baitTimer <= 0) return;
    ctx.save();
    const { x, y } = baitTarget;
    const pulse = 0.7 + 0.3 * Math.sin(time * 4);
    const auraGrad = ctx.createRadialGradient(x, y, 0, x, y, 50 * pulse);
    auraGrad.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
    auraGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.1)');
    auraGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, 50 * pulse, 20 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.6 * (baitTimer / 3);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + time * 0.5;
      const dist = 8 + Math.sin(i * 3) * 4;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist * 0.4;
      ctx.fillStyle = '#c0c8d8';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle + 0.3) * 4, sy + Math.sin(angle + 0.3) * 2);
      ctx.lineTo(sx + Math.cos(angle - 0.2) * 3, sy + Math.sin(angle - 0.2) * 1.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}