/**
 * @fileoverview 护盾蟑螂气体护盾系统模块
 * @description 管理气体护盾的生命周期（自然恢复 / 破碎重建 / 受击闪白），
 * 并提供矩形保护区域判定与护盾伤害承接（供火焰拦截与其他伤害等量侵蚀共用）。
 *
 * 机制摘要（数值见 BALANCE_CONFIG.subway）：
 * - 护盾容量 shieldMaxHp，完好时按 shieldRegenPerSec 自然恢复
 * - 护盾归零 → 破碎，shieldRebuildDelay 秒后满值重组
 * - 矩形保护范围：起始线在护盾蟑螂本体下缘，向后方（上方）延伸 shieldRectHeight，宽 2×shieldRectHalfWidth
 * - 矩形内同伴与护盾蟑螂自身免疫火焰直射（伤害转移至护盾）；受到其他伤害时护盾等量侵蚀
 */

import { RoachState, RoachType, type Roach } from '../../types';
import { BALANCE_CONFIG, ENEMY_DEFS, TEXT_CONFIG } from '../../data';

/**
 * 护盾系统配置接口
 */
export interface ShieldSystemConfig {
  /** 添加浮动文字 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 生成火花粒子（护盾破碎时） */
  onSpawnSpark?: (x: number, y: number, count: number) => void;
}

/**
 * 护盾蟑螂气体护盾系统
 * @description 无状态系统：所有护盾状态存储在 Roach 对象上（shieldHp / shieldBrokenTimer / shieldHitFlash）
 */
export class ShieldSystem {
  /** 系统配置 */
  private config: ShieldSystemConfig;

  /** 受保护蟑螂的 HP 快照（roachId → 上一帧 HP），用于检测任意来源伤害并等量侵蚀护盾 */
  private prevHpSnapshot: Map<number, number> = new Map();

  /** 「格挡!」浮动文字节流冷却（roachId → 剩余秒数），避免火焰连续拦截时刷屏 */
  private blockTextCooldowns: Map<number, number> = new Map();

  /**
   * 构造函数
   */
  constructor(config: ShieldSystemConfig) {
    this.config = config;
  }

  /** 重置内部状态（游戏重开时调用，防止旧快照/冷却残留） */
  reset(): void {
    this.prevHpSnapshot.clear();
    this.blockTextCooldowns.clear();
  }

  /**
   * 每帧更新护盾生命周期
   * - 完好且未满：按 shieldRegenPerSec 自然恢复
   * - 破碎中：倒计时结束后满值重组并提示
   * - 受击闪白衰减
   * - 快照对比：受保护蟑螂的 HP 净下降量等量侵蚀护盾（覆盖所有非火焰直射伤害）
   * @param deltaTime 帧间隔（秒）
   * @param roaches 蟑螂数组（原地修改）
   */
  update(deltaTime: number, roaches: Roach[]): void {
    const sub = BALANCE_CONFIG.subway;

    // ===== 1. 护盾蟑螂生命周期 =====
    for (const r of roaches) {
      if (r.type !== RoachType.SHIELD || r.state !== RoachState.ALIVE) continue;

      // 受击闪白衰减
      if (r.shieldHitFlash && r.shieldHitFlash > 0) {
        r.shieldHitFlash = Math.max(0, r.shieldHitFlash - deltaTime);
      }

      // 破碎重建倒计时（破碎期间不自然恢复）
      if (r.shieldBrokenTimer && r.shieldBrokenTimer > 0) {
        r.shieldBrokenTimer -= deltaTime;
        if (r.shieldBrokenTimer <= 0) {
          r.shieldBrokenTimer = 0;
          r.shieldHp = r.maxShieldHp ?? sub.shieldMaxHp;
          this.config.onAddFloatingText?.(r.x, r.y - 40, TEXT_CONFIG.combat.shieldRebuild.text, TEXT_CONFIG.combat.shieldRebuild.color);
        }
        continue;
      }

      // 完好时自然恢复（未满才恢复）
      const maxShield = r.maxShieldHp ?? sub.shieldMaxHp;
      if ((r.shieldHp ?? 0) > 0 && (r.shieldHp ?? 0) < maxShield) {
        r.shieldHp = Math.min(maxShield, (r.shieldHp ?? 0) + sub.shieldRegenPerSec * deltaTime);
      }
    }

    // ===== 2. 格挡文字冷却衰减 =====
    for (const [id, cd] of this.blockTextCooldowns) {
      const next = cd - deltaTime;
      if (next <= 0) this.blockTextCooldowns.delete(id);
      else this.blockTextCooldowns.set(id, next);
    }

    // ===== 3. 快照对比：受保护蟑螂承伤等量侵蚀护盾 =====
    // 任何伤害路径（爆炸/激光/毒/火墙/喷雾/电蚊拍…）最终都体现为 hp 下降，
    // 统一在此捕获并侵蚀护盾，无需改动各伤害系统
    const seenIds = new Set<number>();
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE) continue;
      seenIds.add(r.id);
      const shield = ShieldSystem.findProtectingShield(roaches, r);
      if (!shield) continue; // 未受保护：不跟踪（避免无意义快照）
      const prevHp = this.prevHpSnapshot.get(r.id);
      if (prevHp !== undefined) {
        const hpLoss = prevHp - r.hp;
        if (hpLoss > 0) {
          this.damageShield(shield, hpLoss, false);
        }
      }
      this.prevHpSnapshot.set(r.id, r.hp);
    }
    // 清理已移除/死亡蟑螂的快照（防止泄漏与 id 复用误判）
    for (const id of this.prevHpSnapshot.keys()) {
      if (!seenIds.has(id)) this.prevHpSnapshot.delete(id);
    }
  }

  /**
   * 判断目标是否处于某护盾蟑螂的气体护盾矩形保护区内
   * 条件：护盾蟑螂存活、护盾未破碎且有剩余值、目标位于其后方矩形区域
   * 保护区：起始线在护盾蟑螂本体下缘（中心点向下 1/2 本体大小），
   *   向上（后方）延伸 shieldRectHeight，宽 2×shieldRectHalfWidth
   * 护盾蟑螂自身位于矩形内（dy = -本体半高），同样受保护（被火焰直射时先耗盾再耗血）
   * @param shield 护盾蟑螂
   * @param target 被判定目标
   */
  static isInShieldSector(shield: Roach, target: Roach): boolean {
    if (shield.type !== RoachType.SHIELD || shield.state !== RoachState.ALIVE) return false;
    if ((shield.shieldHp ?? 0) <= 0 || (shield.shieldBrokenTimer ?? 0) > 0) return false;

    const sub = BALANCE_CONFIG.subway;
    // 起始线：护盾蟑螂本体下缘（中心点向下 1/2 本体大小）
    const originY = shield.y + (shield.size ?? ENEMY_DEFS[shield.type].size) * 0.5;
    const dx = target.x - shield.x;
    const dy = target.y - originY;
    // 纵向：仅保护后方（上方，dy ≤ 0），范围 [-shieldRectHeight, 0]
    if (dy > 0 || dy < -sub.shieldRectHeight) return false;
    // 横向：在保护半宽内
    if (Math.abs(dx) > sub.shieldRectHalfWidth) return false;
    return true;
  }

  /**
   * 查找保护指定目标的护盾蟑螂（多只重叠时取距离最近的一只）
   * @param roaches 蟑螂数组
   * @param target 被保护目标
   * @returns 护盾蟑螂，无保护时返回 null
   */
  static findProtectingShield(roaches: Roach[], target: Roach): Roach | null {
    let best: Roach | null = null;
    let bestDistSq = Infinity;
    for (const s of roaches) {
      if (s.type !== RoachType.SHIELD) continue;
      if (!ShieldSystem.isInShieldSector(s, target)) continue;
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = s;
      }
    }
    return best;
  }

  /**
   * 对护盾造成伤害（火焰拦截转移 / 快照等量侵蚀 / 火墙加倍侵蚀共用）
   * 处理扣盾、受击闪白、破碎检测与浮动文字
   * @param shield 护盾蟑螂（原地修改）
   * @param amount 护盾承受的伤害量（调用方已计算倍率）
   * @param showBlockText 是否显示「格挡!」浮动文字（火焰拦截时启用，带 0.8s 节流防刷屏）
   */
  damageShield(shield: Roach, amount: number, showBlockText: boolean = false): void {
    if (amount <= 0) return;
    if ((shield.shieldHp ?? 0) <= 0) return;
    shield.shieldHp = Math.max(0, (shield.shieldHp ?? 0) - amount);
    shield.shieldHitFlash = 0.15;
    // 格挡浮动文字（节流：每只护盾 0.8s 内最多一次）
    if (showBlockText && !this.blockTextCooldowns.has(shield.id)) {
      this.blockTextCooldowns.set(shield.id, 0.8);
      this.config.onAddFloatingText?.(shield.x, shield.y - 30, TEXT_CONFIG.combat.shieldGasBlock.text, TEXT_CONFIG.combat.shieldGasBlock.color);
    }
    if (shield.shieldHp <= 0) {
      shield.shieldBrokenTimer = BALANCE_CONFIG.subway.shieldRebuildDelay;
      this.config.onAddFloatingText?.(shield.x, shield.y - 40, TEXT_CONFIG.combat.shieldBreak.text, TEXT_CONFIG.combat.shieldBreak.color);
      this.config.onSpawnSpark?.(shield.x, shield.y, 12);
    }
  }
}
