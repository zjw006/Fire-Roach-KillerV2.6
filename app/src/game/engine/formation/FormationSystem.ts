/**
 * @fileoverview 阵型协同系统模块（地铁场景）
 * @description 管理编队行为，支持多种编队策略（当前实现「盾墙推进」）。
 *
 * 盾墙推进编队规则：
 * - 编队目标：地面普通蟑螂（非护盾/BOSS/飞行/精英/女王）
 * - 编队条件：附近存在存活的护盾蟑螂，且蟑螂在护盾矩形保护区附近
 * - 编队行为：成员横向快速移动到护盾蟑螂后方（矩形保护区内），
 *   纵向速度被钳制到锚点速度附近，保持阵型紧凑
 * - 断裂重寻：锚点死亡或成员接近防线时自动断裂，
 *   成员自动重新寻找最近的护盾蟑螂，无锚点时恢复正常移动
 * - 解除编队：成员接近防线 formationBreakDist 距离内时解除编队，恢复冲刺
 *
 * 扩展性设计：策略模式 — 每种编队类型实现 FormationStrategy 接口，
 * FormationSystem 作为上下文管理器，按场景/条件切换策略。
 */

import { RoachState, RoachType, type Roach } from '../../types';
import { BALANCE_CONFIG } from '../../data';

// =============================================================================
// 策略接口
// =============================================================================

/** 编队结果：包含移动修改和速度钳制 */
export interface FormationMoveResult {
  /** 是否处于编队中 */
  inFormation: boolean;
  /** 编队锚点蟑螂（null 表示无锚点） */
  anchor: Roach | null;
  /** 横向移动修正速度（像素/秒，0 表示不修正） */
  lateralMoveSpeed: number;
  /** 编队速度上限（null 表示不限速） */
  speedCap: number | null;
  /** 是否应解除编队（接近防线） */
  shouldBreak: boolean;
}

/** 编队策略接口 — 每种编队类型实现此接口 */
export interface FormationStrategy {
  /** 策略名称（调试用） */
  readonly name: string;
  /** 判断蟑螂是否可参与此编队 */
  canJoin(r: Roach): boolean;
  /** 计算编队移动结果 */
  computeMove(roaches: Roach[], r: Roach, defenseLineY: number): FormationMoveResult;
}

// =============================================================================
// 盾墙推进策略（护盾蟑螂编队）
// =============================================================================

/** 盾墙推进编队策略 */
class ShieldWallStrategy implements FormationStrategy {
  readonly name = 'shield_wall';

  /** 仅地面普通蟑螂参与编队 */
  canJoin(r: Roach): boolean {
    if (r.type === RoachType.SHIELD || r.isBoss) return false;
    if (r.type === RoachType.FLYING || r.type === RoachType.FLYING_SUICIDE
      || r.type === RoachType.SUBWAY_ELITE || r.type === RoachType.QUEEN) return false;
    if (r.state !== RoachState.ALIVE) return false;
    return true;
  }

  computeMove(roaches: Roach[], r: Roach, defenseLineY: number): FormationMoveResult {
    const sub = BALANCE_CONFIG.subway;
    const roachSize = r.size ?? 30;
    const distToDefense = defenseLineY - (r.y + roachSize * 0.4);

    // 接近防线：解除编队，恢复冲刺
    if (distToDefense < sub.formationBreakDist) {
      return { inFormation: false, anchor: null, lateralMoveSpeed: 0, speedCap: null, shouldBreak: true };
    }

    // 寻找最近的护盾蟑螂锚点
    const anchor = this.findNearestShield(roaches, r);
    if (!anchor) {
      return { inFormation: false, anchor: null, lateralMoveSpeed: 0, speedCap: null, shouldBreak: false };
    }

    // 计算编队移动：横向向护盾后方归位
    const lateralMoveSpeed = this.computeLateralMove(r, anchor);
    // 速度钳制：编队成员推进速度被钳制到锚点速度附近
    const speedCap = anchor.speed * sub.formationSpeedBindMult;

    return { inFormation: true, anchor, lateralMoveSpeed, speedCap, shouldBreak: false };
  }

  /** 寻找最近的存活护盾蟑螂（锚点必须在编队成员前方，即更靠近防线，y 更大） */
  private findNearestShield(roaches: Roach[], r: Roach): Roach | null {
    const sub = BALANCE_CONFIG.subway;
    let anchor: Roach | null = null;
    let bestDist = Infinity;

    for (const s of roaches) {
      if (s.type !== RoachType.SHIELD || s.state !== RoachState.ALIVE) continue;
      // 锚点必须位于前方（更靠近防线，y 更大）
      const dy = s.y - r.y;
      if (dy <= 0 || dy > sub.shieldRectHeight * 1.5) continue;
      // 横向距离限制（编队搜索范围比保护区更宽）
      const dx = Math.abs(s.x - r.x);
      if (dx > sub.formationLateralRange) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        anchor = s;
      }
    }
    return anchor;
  }

  /**
   * 计算横向归位速度
   * 目标：将蟑螂移动到护盾蟑螂后方保护区中心线（同一 x 坐标）
   * 如果已在保护区内，返回 0（不修正）
   */
  private computeLateralMove(r: Roach, anchor: Roach): number {
    const sub = BALANCE_CONFIG.subway;
    const dx = anchor.x - r.x;

    // 已在保护区半宽内：不需要横向归位
    if (Math.abs(dx) <= sub.shieldRectHalfWidth * 0.8) return 0;

    // 横向快速归位：向锚点 x 坐标移动
    return Math.sign(dx) * r.baseSpeed * sub.formationMoveSpeedMult;
  }
}

// =============================================================================
// FormationSystem（编队上下文管理器）
// =============================================================================

export class FormationSystem {
  /** 当前激活的编队策略 */
  private strategy: FormationStrategy;

  constructor() {
    // 默认使用盾墙推进策略
    this.strategy = new ShieldWallStrategy();
  }

  /** 切换编队策略（后续可扩展护士编队等） */
  setStrategy(strategy: FormationStrategy): void {
    this.strategy = strategy;
  }

  /**
   * 计算编队移动结果（每帧调用）
   * @param roaches 蟑螂数组
   * @param r 待判定蟑螂
   * @param defenseLineY 防线 Y 坐标
   * @returns 编队移动结果
   */
  computeFormationMove(roaches: Roach[], r: Roach, defenseLineY: number): FormationMoveResult {
    if (!this.strategy.canJoin(r)) {
      return { inFormation: false, anchor: null, lateralMoveSpeed: 0, speedCap: null, shouldBreak: false };
    }
    return this.strategy.computeMove(roaches, r, defenseLineY);
  }
}
