/**
 * @fileoverview 消耗品系统模块
 * @description 负责管理游戏中所有消耗品的逻辑，包括购买、库存、自动使用、冷却系统、效果应用等
 */

import { GameState, ParticleType } from '../../types';
import type { Player, Particle, ConsumableDef } from '../../types';
import { BALANCE_CONFIG, TEXT_CONFIG, RENDER_COLOR } from '../../data';

// =============================================================================
// 回调接口拆分（修复 P1：20+ 回调按职责分组）
// =============================================================================

/** 特效/粒子回调 */
export interface ConsumableEffectCallbacks {
  onAddFloatingText: (x: number, y: number, text: string, color: string, duration?: number, fontSize?: number) => void;
  onSpawnSmokeParticles: (x: number, y: number, count: number) => void;
  onAddParticle: (particle: Particle) => void;
}

/** 状态读写回调 */
export interface ConsumableStateCallbacks {
  getPlayer: () => Player;
  getDefenseHp: () => number;
  getMaxDefenseHp: () => number;
  setDefenseHp: (hp: number) => void;
  getCanvasWidth: () => number;
  getCanvasHeight: () => number;
  getGameState: () => GameState;
  getDefenseLineY: () => number;
  getGroundCenter: () => [number, number];
  getParticleLimit: () => number;
  getParticleCount: () => number;
  getEconomy: () => any;
  setEconomy: (economy: any) => void;
}

/** UI 通知回调 */
export interface ConsumableUICallbacks {
  onConsumableUpdate?: (inventory: Record<string, number>, buffTimers: Record<string, number>, cooldowns?: Record<string, number>, globalCooldown?: number, combatStartTimer?: number, itemCooldowns?: Record<string, number>) => void;
  onEmergencyCoolUpdate?: (count: number) => void;
  onEconomyUpdate?: (economy: any) => void;
  onPlayerUpdate?: (player: Player) => void;
  onDefenseUpdate?: (defenseHp: number, maxDefenseHp: number) => void;
}

/**
 * 消耗品系统配置接口（组合子接口）
 */
export interface ConsumableSystemConfig
  extends ConsumableEffectCallbacks,
          ConsumableStateCallbacks,
          ConsumableUICallbacks {
  consumableDefs: ConsumableDef[];
}

/**
 * 消耗品系统类
 * @description 管理消耗品的库存、购买、自动使用、冷却和效果应用
 */
export class ConsumableSystem {
  /** 系统配置 */
  private cfg: ConsumableSystemConfig;

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
  baitThrowAnim: { active: boolean; x: number; y: number; startX: number; startY: number; targetX: number; targetY: number; timer: number } = { active: false, x: 0, y: 0, startX: 0, startY: 0, targetX: 0, targetY: 0, timer: 0 };
  /** 诱饵目标位置 */
  baitTarget: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  /** 火力全开倒计时跟踪 */
  _lastPowerBoostCountdown: number = -1;

  /** 脏标记（修复 P2：避免 notifyConsumableUpdate 每帧都调） */
  private _needsNotify: boolean = false;

  constructor(config: ConsumableSystemConfig) {
    this.cfg = config;
  }

  updateConfig(config: Partial<ConsumableSystemConfig>): void {
    this.cfg = { ...this.cfg, ...config };
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
    this.baitThrowAnim = { active: false, x: 0, y: 0, startX: 0, startY: 0, targetX: 0, targetY: 0, timer: 0 };
    this._needsNotify = false;
  }

  // ========== 购买 ==========

  /**
   * 购买消耗品（修复 P1：简化 economy 操作，不再绕弯子）
   */
  buyConsumable(id: string): boolean {
    const def = this.cfg.consumableDefs.find(c => c.id === id);
    if (!def) return false;
    const economy = this.cfg.getEconomy();
    if (economy.money < def.cost) return false;

    economy.money -= def.cost;
    this.consumableInventory[id] = (this.consumableInventory[id] || 0) + 1;
    if (this.autoUseEnabled[id] === undefined) {
      this.autoUseEnabled[id] = true;
    }

    // 修复 P2：不再浅拷贝 economy，直接让 setEconomy 负责同步
    this.cfg.setEconomy(economy);
    this.cfg.onEconomyUpdate?.(economy);
    this._needsNotify = true;
    return true;
  }

  // ========== 使用消耗品 ==========

  /**
   * 使用库存中的消耗品
   */
  useConsumable(id: string): boolean {
    const player = this.cfg.getPlayer();
    if (!player) return false;
    if ((this.consumableInventory[id] || 0) <= 0) return false;

    if (id !== 'emergency_cool') {
      if (this.combatStartTimer > 0) {
        this.cfg.onAddFloatingText(player.x, player.y - BALANCE_CONFIG.consumable.floatTextOffset.player, TEXT_CONFIG.combat.combatStartCooldown.text(this.combatStartTimer.toFixed(1)), TEXT_CONFIG.combat.combatStartCooldown.color, 800);
        return false;
      }
      if ((this.consumableCooldowns[id] || 0) > 0) {
        this.cfg.onAddFloatingText(player.x, player.y - BALANCE_CONFIG.consumable.floatTextOffset.player, TEXT_CONFIG.combat.namedCooldown.text(this.cfg.consumableDefs.find(c => c.id === id)?.name || '', this.consumableCooldowns[id].toFixed(1)), TEXT_CONFIG.combat.namedCooldown.color, 800);
        return false;
      }
      if (this.globalConsumableCooldown > 0) {
        this.cfg.onAddFloatingText(player.x, player.y - BALANCE_CONFIG.consumable.floatTextOffset.player, TEXT_CONFIG.combat.consumableGlobalCooldown.text(this.globalConsumableCooldown.toFixed(1)), TEXT_CONFIG.combat.consumableGlobalCooldown.color, 800);
        return false;
      }
    }

    this.consumableInventory[id]--;
    if (this.consumableInventory[id] <= 0) delete this.consumableInventory[id];

    switch (id) {
      case 'gas_refill': {
        player.gas = player.maxGas;
        this.buffFlashTimers['gas_refill'] = BALANCE_CONFIG.consumable.buffFlashDuration;
        this.cfg.onAddFloatingText(player.x, player.y - BALANCE_CONFIG.consumable.floatTextOffset.player, TEXT_CONFIG.combat.gasRefill.text, TEXT_CONFIG.combat.gasRefill.color, 1500);
        break;
      }
      case 'defense_repair': {
        const maxDefenseHp = this.cfg.getMaxDefenseHp();
        const healAmount = Math.floor(maxDefenseHp * BALANCE_CONFIG.defense.repairPercent);
        const oldHp = this.cfg.getDefenseHp();
        const newHp = Math.min(maxDefenseHp, oldHp + healAmount);
        const actualHeal = newHp - oldHp;
        // 修复 P0：通过 setDefenseHp 实际存储 HP
        this.cfg.setDefenseHp(newHp);
        this.buffFlashTimers['defense_repair'] = BALANCE_CONFIG.consumable.buffFlashDuration;
        if (actualHeal > 0) {
          this.cfg.onAddFloatingText(this.cfg.getCanvasWidth() / 2, this.cfg.getDefenseLineY() - BALANCE_CONFIG.consumable.floatTextOffset.defenseRepair, TEXT_CONFIG.combat.defenseRepair.text(actualHeal), TEXT_CONFIG.combat.defenseRepair.color, 1500);
        }
        this.cfg.onDefenseUpdate?.(newHp, maxDefenseHp);
        break;
      }
      case 'emergency_cool': {
        this.emergencyCoolInventory++;
        this.cfg.onEmergencyCoolUpdate?.(this.emergencyCoolInventory);
        this.cfg.onAddFloatingText(player.x, player.y - BALANCE_CONFIG.consumable.floatTextOffset.player, TEXT_CONFIG.combat.emergencyCoolAdd.text(this.emergencyCoolInventory), TEXT_CONFIG.combat.emergencyCoolAdd.color, 1500);
        break;
      }
      case 'power_boost': {
        player.powerBoostTimer = BALANCE_CONFIG.consumable.powerBoostDuration;
        this.cfg.onAddFloatingText(this.cfg.getCanvasWidth() / 2, this.cfg.getCanvasHeight() / 2, TEXT_CONFIG.combat.powerBoost.text(BALANCE_CONFIG.consumable.powerBoostDuration), TEXT_CONFIG.combat.powerBoost.color, 2000, 32);
        break;
      }
      case 'shield': {
        player.shieldTimer = BALANCE_CONFIG.consumable.shieldDuration;
        player.shieldActive = true;
        this.buffFlashTimers['shield'] = BALANCE_CONFIG.consumable.shieldDuration;
        this.cfg.onAddFloatingText(this.cfg.getCanvasWidth() / 2, this.cfg.getCanvasHeight() / 2 - BALANCE_CONFIG.consumable.floatTextOffset.shield, TEXT_CONFIG.combat.shieldActive.text(BALANCE_CONFIG.consumable.shieldDuration), TEXT_CONFIG.combat.shieldActive.color, 2000);
        break;
      }
      case 'bait': {
        player.baitTimer = BALANCE_CONFIG.consumable.baitDuration;
        const [targetX, targetY] = this.cfg.getGroundCenter();
        this.baitTarget = { x: targetX, y: targetY, active: true };
        // 修复 P0：添加 startX/startY 用于线性插值
        this.baitThrowAnim = {
          active: true,
          x: player.x,
          y: player.y - 50,
          startX: player.x,
          startY: player.y - 50,
          targetX,
          targetY,
          timer: BALANCE_CONFIG.consumable.baitThrowAnimDuration,
        };
        this.cfg.onAddFloatingText(targetX, targetY - BALANCE_CONFIG.consumable.floatTextOffset.bait, TEXT_CONFIG.combat.baitPlaced.text, TEXT_CONFIG.combat.baitPlaced.color, 2000);
        break;
      }
    }

    if (id !== 'emergency_cool') {
      const def = this.cfg.consumableDefs.find(c => c.id === id);
      if (def?.cooldown) {
        this.consumableCooldowns[id] = def.cooldown;
      }
      this.globalConsumableCooldown = BALANCE_CONFIG.consumable.globalCooldown;
    }

    this._needsNotify = true;
    this.cfg.onPlayerUpdate?.(player);
    // 修复 P0：移除冗余的 onDefenseUpdate 调用 — 各 case 已自行处理

    return true;
  }

  // ========== 自动使用 ==========

  /**
   * 切换自动使用设置
   */
  toggleAutoUse(id: string): boolean {
    this.autoUseEnabled[id] = !this.autoUseEnabled[id];
    this._needsNotify = true;
    return this.autoUseEnabled[id];
  }

  /**
   * 检查并自动使用消耗品（修复 P1：数据驱动，支持 6 种消耗品）
   */
  checkAutoUseConsumables(): void {
    const player = this.cfg.getPlayer();
    if (!player || this.cfg.getGameState() !== GameState.PLAYING) return;

    const conditions = BALANCE_CONFIG.consumable.autoUseConditions;
    const thresholds = BALANCE_CONFIG.consumable.autoUseThresholds;

    for (const [id, count] of Object.entries(this.consumableInventory)) {
      if (count <= 0) continue;
      if (!this.autoUseEnabled[id]) continue;

      const condition = conditions[id];
      if (!condition || condition === 'never') continue;

      let shouldUse = false;
      switch (condition) {
        case 'overheated':
          shouldUse = player.isOverheated;
          break;
        case 'defenseLowHealth':
          shouldUse = this.cfg.getDefenseHp() / this.cfg.getMaxDefenseHp() < thresholds.defenseLowHealth;
          break;
        case 'lowGas':
          shouldUse = player.gas / player.maxGas < thresholds.lowGas;
          break;
      }

      if (shouldUse) {
        this.useConsumable(id);
      }
    }
  }

  // ========== 紧急冷却 ==========

  /**
   * 紧急冷却 — 玩家过热时使用（修复 P2：合并分散逻辑，统一由此方法处理）
   */
  emergencyCool(): boolean {
    const player = this.cfg.getPlayer();
    if (!player.isOverheated) return false;
    if (this.emergencyCoolInventory > 0) {
      this.emergencyCoolInventory--;
      player.isOverheated = false;
      player.overheatTimer = 0;
      player.heat = 0;
      this.cfg.onSpawnSmokeParticles(player.x, player.y, 20);
      this.cfg.onAddFloatingText(player.x, player.y - BALANCE_CONFIG.consumable.floatTextOffset.emergencyCool, TEXT_CONFIG.combat.emergencyCoolUse.text(this.emergencyCoolInventory), TEXT_CONFIG.combat.emergencyCoolUse.color);
      this.cfg.onEmergencyCoolUpdate?.(this.emergencyCoolInventory);
      this._needsNotify = true;
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
    // 修复 P2：只在有变更时通知
    this.flushNotify();
  }

  /**
   * 更新消耗品临时效果计时器
   */
  private updateConsumableEffects(dt: number): void {
    const player = this.cfg.getPlayer();
    if (!player) return;

    if (player.powerBoostTimer > 0) {
      player.powerBoostTimer -= dt;
      const secondsLeft = Math.ceil(player.powerBoostTimer);
      if (secondsLeft > 0 && secondsLeft !== this._lastPowerBoostCountdown) {
        this._lastPowerBoostCountdown = secondsLeft;
        this.cfg.onAddFloatingText(this.cfg.getCanvasWidth() / 2, this.cfg.getCanvasHeight() / 2, TEXT_CONFIG.combat.powerBoostCountdown.text(secondsLeft), TEXT_CONFIG.combat.powerBoostCountdown.color, 800, 32);
      }
      if (player.powerBoostTimer <= 0) {
        player.powerBoostTimer = 0;
        this._lastPowerBoostCountdown = -1;
        this.cfg.onAddFloatingText(this.cfg.getCanvasWidth() / 2, this.cfg.getCanvasHeight() / 2, TEXT_CONFIG.combat.powerBoostEnd.text, TEXT_CONFIG.combat.powerBoostEnd.color, 1500, 32);
      }
    }

    if (player.shieldTimer > 0) {
      player.shieldTimer -= dt;
      this.buffFlashTimers['shield'] = player.shieldTimer;
      if (player.shieldTimer <= 0) {
        player.shieldTimer = 0;
        player.shieldActive = false;
        delete this.buffFlashTimers['shield'];
        this.cfg.onAddFloatingText(this.cfg.getCanvasWidth() / 2, this.cfg.getCanvasHeight() / 2 - BALANCE_CONFIG.consumable.floatTextOffset.shield, TEXT_CONFIG.combat.shieldEnd.text, TEXT_CONFIG.combat.shieldEnd.color, 1500);
      }
    }

    if (player.baitTimer > 0) {
      player.baitTimer -= dt;
      // 持续气味粒子
      if (this.baitTarget.active && this.cfg.getParticleCount() < this.cfg.getParticleLimit() - 20) {
        for (let i = 0; i < 2; i++) {
          this.cfg.onAddParticle({
            x: this.baitTarget.x + (Math.random() - 0.5) * 30,
            y: this.baitTarget.y - Math.random() * 10,
            vx: (Math.random() - 0.5) * 8,
            vy: -(15 + Math.random() * 20),
            life: 1.2 + Math.random() * 0.8,
            maxLife: 2,
            color: Math.random() < 0.5 ? RENDER_COLOR.armorStart : '#fcd34d',
            size: 2 + Math.random() * 2.5,
            type: ParticleType.SMOKE,
          });
        }
      }
      if (player.baitTimer <= 0) {
        player.baitTimer = 0;
        this.baitTarget.active = false;
        this.cfg.onAddFloatingText(this.baitTarget.x, this.baitTarget.y - BALANCE_CONFIG.consumable.floatTextOffset.baitEnd, TEXT_CONFIG.combat.baitEnd.text, TEXT_CONFIG.combat.baitEnd.color, 1500);
      }
    }
  }

  /**
   * 递减计时器辅助方法（修复 P1：消除重复 4 次的冷却递减模式）
   * @returns 是否有任何计时器被递减（用于检测冷却到期时需要通知UI）
   */
  private decrementTimer(dt: number, timers: Record<string, number>, clampMin: boolean = false): boolean {
    let hadChanges = false;
    for (const [id, timer] of Object.entries(timers)) {
      if (timer > 0) {
        hadChanges = true;
        timers[id] = timer - dt;
        if (timers[id] <= 0) {
          if (clampMin) {
            timers[id] = 0;
          } else {
            delete timers[id];
          }
        }
      }
    }
    return hadChanges;
  }

  /**
   * 更新增益闪光计时器和冷却时间
   */
  private updateBuffFlashTimers(dt: number): void {
    // 修复 P1：使用 decrementTimer 消除重复代码
    this.decrementTimer(dt, this.buffFlashTimers);

    let hadTimerChanges = false;

    if (this.combatStartTimer > 0) {
      this.combatStartTimer -= dt;
      if (this.combatStartTimer < 0) this.combatStartTimer = 0;
      hadTimerChanges = true;
    }

    if (this.globalConsumableCooldown > 0) {
      this.globalConsumableCooldown -= dt;
      if (this.globalConsumableCooldown < 0) this.globalConsumableCooldown = 0;
      hadTimerChanges = true;
    }

    // 检测递减前是否有活跃冷却（用于冷却到期时通知UI）
    const hadConsumableCds = this.decrementTimer(dt, this.consumableCooldowns);
    const hadItemCds = this.decrementTimer(dt, this.itemCooldowns);

    // 修复：当冷却到期（递减后全部清零）时也需要通知UI更新遮罩
    if (hadTimerChanges || hadConsumableCds || hadItemCds) {
      this._needsNotify = true;
    }

    // 修复 P0：诱饵投掷动画 — 修复进度计算 bug
    if (this.baitThrowAnim.active) {
      // 先递减，再 clamp 防止负值
      this.baitThrowAnim.timer = Math.max(0, this.baitThrowAnim.timer - dt);
      const duration = BALANCE_CONFIG.consumable.baitThrowAnimDuration;
      const progress = this.baitThrowAnim.timer <= 0 ? 1 : 1 - this.baitThrowAnim.timer / duration;

      if (progress < 1) {
        // 修复 P0：使用线性插值替代 lerp，确保进度到达 1 时位置精确到达目标
        this.baitThrowAnim.x = this.baitThrowAnim.startX + (this.baitThrowAnim.targetX - this.baitThrowAnim.startX) * progress;
        const height = BALANCE_CONFIG.consumable.baitThrowAnimHeight * Math.sin(progress * Math.PI);
        this.baitThrowAnim.y = this.baitThrowAnim.targetY - height;
      } else {
        this.baitThrowAnim.active = false;
        // 粉碎效果：黄色爆裂模拟诱饵罐破碎 + 气味释放
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 60;
          this.cfg.onAddParticle({
            x: this.baitThrowAnim.targetX + Math.cos(angle) * dist,
            y: this.baitThrowAnim.targetY + Math.sin(angle) * dist * 0.3,
            vx: Math.cos(angle) * (30 + Math.random() * 40),
            vy: Math.sin(angle) * (15 + Math.random() * 25) - 20,
            life: 1.5 + Math.random(),
            maxLife: 2.5,
            color: RENDER_COLOR.armorStart,
            size: 2 + Math.random() * 3,
            type: ParticleType.EMBER,
          });
        }
        // 玻璃碎片
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          this.cfg.onAddParticle({
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
  }

  // ========== 通知 ==========

  /**
   * 标记需要通知（替代直接调用，由 flushNotify 集中处理）
   */
  private flushNotify(): void {
    if (!this._needsNotify) return;
    this._needsNotify = false;
    this.notifyConsumableUpdate();
  }

  private notifyConsumableUpdate(): void {
    this.cfg.onConsumableUpdate?.(
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
    ctx.fillStyle = RENDER_COLOR.baitJar;
    ctx.beginPath();
    ctx.roundRect(-jarW / 2, -jarH / 2, jarW, jarH, 4);
    ctx.fill();
    ctx.fillStyle = RENDER_COLOR.baitJarRim;
    ctx.beginPath();
    ctx.roundRect(-jarW / 2 + 2, -jarH / 2 + 2, jarW - 6, jarH - 6, 2);
    ctx.fill();
    ctx.fillStyle = RENDER_COLOR.baitJarAccent;
    ctx.fillRect(-jarW / 2 - 1, -jarH / 2 - 3, jarW + 2, 5);
    ctx.fillStyle = RENDER_COLOR.baitJarText;
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
      ctx.fillStyle = RENDER_COLOR.armorStart;
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
      ctx.fillStyle = RENDER_COLOR.glass;
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