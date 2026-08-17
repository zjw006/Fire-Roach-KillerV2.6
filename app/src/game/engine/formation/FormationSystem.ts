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

import { RoachState, RoachType, type Roach, type FormationGroupConfig, type FormationTemplate } from '../../types';
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
// 阵型实例管理（超市场景 V4.0：特种三排阵列 A三线/B楔形/D方阵/E纵队/F穿插/G同心圆/H双锋）
// =============================================================================
//
// 三态状态机：集结（gather，原点 0.8 倍速推进、成员向槽位聚拢）
//   → 推进（push，保持相对坐标向防线移动）→ 散乱（broken，永久，恢复原生 AI，不可重聚）
// 破阵三重判定：锚点全灭 / 推进期存活低于阈值 / 推进期 30% 成员横向脱离阵型半宽
// 冲突打断：闪避(dodgeTimer/wasDodging)、狂暴(isEnraged)、冲刺(chargeState/isCharging)
//   期间暂停阵型修正，原生 AI 优先
// 透视自适应：槽位横向偏移按比例存储，每帧乘以当前原点 Y 处地面可用宽度，
//   远端自动收缩扎堆、近端自然散开，无需手动改像素尺寸
// V4.0 成员硬约束：阵列仅由特种单位构成（前排装甲/护盾｜中排分裂/定时自爆/隧道工｜后排护士≤1），
//   小/大/飞行/地面自爆/精英永远不入阵（planTypes 过滤——自由杂兵类型不在槽位类型表中，
//   分配通道天然拒绝）；多组阵列经 addPlan 追加共存，各自独立锚点、独立破阵

/** 阵型槽位 */
interface FormationSlot {
  /** 横向偏移比例（-0.5~0.5，乘以模板宽度占比后的地面可用宽度） */
  dxRatio: number;
  /** 纵向偏移（像素，+y 朝防线方向） */
  dy: number;
  /** 是否锚点槽位 */
  isAnchor: boolean;
  /** 优先分配类型 */
  prefTypes: RoachType[];
  /** 已分配的蟑螂 ID */
  roachId: number | null;
  /** Z字摆动叠加（B右翼/F-B列：按阵型推进距离的三角波横向偏移，确定性无状态） */
  zigzag?: boolean;
  /** Z字摆动相位错开（槽位索引×步长，使纵队呈蛇形而非整体横移） */
  zigzagPhase?: number;
  /** 极坐标槽位（仅模板G：angle 基础弧度 + radiusRatio 半径占比，每帧叠加实例旋转角） */
  polar?: { angle: number; radiusRatio: number };
}

/** 阵型实例 */
interface FormationInstance {
  id: number;
  template: FormationTemplate;
  /** 模板A路序号（0/1/2），模板E列序号（0/1），其它模板为 0 */
  laneIndex: number;
  /** 状态：集结 / 推进（破阵即移除实例，成员永久恢复原生 AI） */
  state: 'gather' | 'push';
  /** 原点 X 比例（地面可用宽度内，A 为路中心、D 为场地中心） */
  originXRatio: number;
  /** 阵型原点（addPlan 以出生线预设，整组同帧出生于各自槽位） */
  originX: number;
  originY: number;
  started: boolean;
  slots: FormationSlot[];
  expectedTotal: number;
  gatherTimer: number;
  /** 旋转角（仅模板G，弧度，每帧按 ringRotateSpeed 推进） */
  rotAngle: number;
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

  // ===========================================================================
  // 超市阵型实例（V4.0：特种三排阵列，多组错时共存）
  // ===========================================================================

  /** 当前存活的阵型实例列表（多组阵列经 addPlan 追加共存，各自独立锚点、独立破阵） */
  private instances: FormationInstance[] = [];
  private nextInstanceId = 1;
  /** 阵型计划涉及的怪物类型（仅三排特种类型；自由杂兵类型不在表中，分配通道天然拒绝） */
  private planTypes = new Set<RoachType>();

  /**
   * 追加一组阵型计划（V4.0 多阵列共存：追加而非清空，各组独立锚点/独立破阵）
   * 出生点即阵型槽位：以出生线为原点预设各实例，整组同帧出生于各自槽位（前后排由槽位 dy 体现）
   * @param template 阵型模板（调用方已从组的随机池中选定）
   * @param group 三排编制配置（前排装甲/护盾、中排分裂/定时自爆/隧道工、后排护士）
   * @param getGroundBoundsAtY 地面透视边界
   * @param spawnBaseY 阵型出生线 Y（地面远端线）
   * @returns 本组出生点表（调用方逐只生成）
   */
  addPlan(
    template: FormationTemplate, group: FormationGroupConfig,
    getGroundBoundsAtY: (y: number) => [number, number], spawnBaseY: number,
  ): { type: RoachType; x: number; y: number }[] {
    const before = this.instances.length;
    switch (template) {
      case 'A': this.buildLanes(group); break;
      case 'B': this.buildWedge(group); break;
      case 'D': this.buildPhalanx(group); break;
      case 'E': this.buildColumns(group); break;
      case 'F': this.buildZigzag(group); break;
      case 'G': this.buildRings(group); break;
      case 'H': this.buildCorridors(group); break;
    }
    const entries: { type: RoachType; x: number; y: number }[] = [];
    for (let i = before; i < this.instances.length; i++) {
      const inst = this.instances[i];
      inst.originY = spawnBaseY;
      const [L, R] = getGroundBoundsAtY(spawnBaseY);
      inst.originX = L + (R - L) * inst.originXRatio;
      inst.started = true;
      for (const s of inst.slots) {
        for (const t of s.prefTypes) this.planTypes.add(t);
        const p = this.slotTarget(inst, s, getGroundBoundsAtY);
        entries.push({ type: s.prefTypes[0], x: p.x, y: p.y });
      }
    }
    // 出生去叠：任意两点横向间距 < spawnMinXGap 且纵向间距 ≤ spawnMinYGap 时横向推开（X 轴不叠影、Y 方向保持 >15px）
    const c = BALANCE_CONFIG.supermarket;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < entries.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = entries[i], b = entries[j];
          if (Math.abs(a.x - b.x) < c.spawnMinXGap && Math.abs(a.y - b.y) <= c.spawnMinYGap) {
            const dir = a.x >= b.x ? 1 : -1;
            a.x = b.x + dir * c.spawnMinXGap;
          }
        }
      }
    }
    return entries;
  }

  /** 清空阵型实例（波次切换 / 重置 / 离开超市场景时调用） */
  clearInstances(): void {
    this.instances = [];
    this.planTypes.clear();
  }

  /** 判断蟑螂是否为存活阵型中的锚点（护士/隧道工锚点禁跟随用） */
  isAnchor(roachId: number): boolean {
    return this.instances.some(inst => inst.slots.some(s => s.isAnchor && s.roachId === roachId));
  }

  /**
   * 模板G：核心锚点被直射火焰瞄准时，由存活环成员顶替承伤（伤害重定向，与护盾拦截同构）
   * @returns 顶替承伤的环成员；非G阵型/非锚点目标/环已全灭返回 null
   */
  findRingProtector(target: Roach, roaches: Roach[]): Roach | null {
    if (target.formationId == null) return null;
    const inst = this.instances.find(i => i.id === target.formationId);
    if (!inst || inst.template !== 'G') return null;
    const slot = inst.slots.find(s => s.roachId === target.id);
    if (!slot || !slot.isAnchor) return null;
    for (const s of inst.slots) {
      if (s.isAnchor || s.roachId == null) continue;
      const r = roaches.find(x => x.id === s.roachId);
      if (r && r.state === RoachState.ALIVE) return r;
    }
    return null;
  }

  /**
   * 计算阵型槽位目标（每帧调用）
   * @returns 槽位目标坐标；冲突状态（闪避/狂暴/冲刺）返回 null 表示暂停阵型修正
   */
  computeInstanceMove(r: Roach, getGroundBoundsAtY: (y: number) => [number, number]): { x: number; y: number } | null {
    if (r.formationId == null) return null;
    const inst = this.instances.find(i => i.id === r.formationId);
    if (!inst) { r.formationId = undefined; return null; }
    if (this.isInConflict(r)) return null;
    const slot = inst.slots.find(s => s.roachId === r.id);
    if (!slot) return null;
    return this.slotTarget(inst, slot, getGroundBoundsAtY);
  }

  /** 每帧阵型状态机：分配新成员、推进原点、集结→推进→（永久）破阵、锚点标识维护 */
  updateInstances(
    roaches: Roach[], deltaTime: number, defenseLineY: number,
    getGroundBoundsAtY: (y: number) => [number, number],
  ): void {
    if (this.instances.length === 0) return;
    const c = BALANCE_CONFIG.supermarket;
    const aliveById = new Map<number, Roach>();
    for (const r of roaches) if (r.state === RoachState.ALIVE) aliveById.set(r.id, r);

    // 分配新出生蟑螂（按需逐帧，适配刷怪队列逐个入场）
    for (const r of roaches) {
      if (r.state !== RoachState.ALIVE || r.formationId != null || r.isBoss) continue;
      if (!this.planTypes.has(r.type)) continue;
      this.assignRoach(r);
    }

    for (let k = this.instances.length - 1; k >= 0; k--) {
      const inst = this.instances[k];
      const members: { r: Roach; slot: FormationSlot }[] = [];
      for (const s of inst.slots) {
        if (s.roachId == null) continue;
        const r = aliveById.get(s.roachId);
        if (r) members.push({ r, slot: s });
      }

      // 补位机制已随 V4.0 移除（分裂子体为小蟑螂，属自由杂兵不入阵；槽位阵亡即永久空缺）

      // 首个成员就位：初始化原点（addPlan 已按出生线预设，此处仅为兜底）
      if (!inst.started) {
        if (members.length === 0) continue;
        inst.originY = members[0].r.y;
        const [L, R] = getGroundBoundsAtY(inst.originY);
        inst.originX = L + (R - L) * inst.originXRatio;
        inst.started = true;
      }

      // 破阵判定①：锚点全灭（预备锚点制——全部锚点槽位已分配且无存活锚点时触发）
      const hasAnchorSlots = inst.slots.some(s => s.isAnchor);
      const allAnchorsAssigned = inst.slots.every(s => !s.isAnchor || s.roachId != null);
      const anchorsAlive = members.filter(m => m.slot.isAnchor).length;
      if (hasAnchorSlots && allAnchorsAssigned && anchorsAlive === 0) {
        this.breakInstance(inst, aliveById);
        this.instances.splice(k, 1);
        continue;
      }

      // 原点 X 每帧按透视重算（宽度随 Y 展开，路中心/场中心自动外移）
      {
        const [L, R] = getGroundBoundsAtY(inst.originY);
        inst.originX = L + (R - L) * inst.originXRatio;
      }

      // 模板G：环形每帧旋转（成员由阵型修正驱动沿环移动）
      if (inst.template === 'G') inst.rotAngle += c.ringRotateSpeed * deltaTime;

      // 原点推进：速度取存活成员中最慢者（集结期 0.8 倍），推进至防线前停住
      // （模板G额外预留环半径：防止旋转环下缘越过防线直接破防）
      if (members.length > 0) {
        const speed = Math.min(...members.map(m => m.r.speed));
        const mult = inst.state === 'gather' ? c.gatherSpeedMult : 1;
        let holdDist = c.defenseHoldDist;
        if (inst.template === 'G') {
          const [L, R] = getGroundBoundsAtY(inst.originY);
          holdDist += (R - L) * c.ringWidthRatio / 2 * c.ringDepthSquash;
        }
        inst.originY = Math.min(inst.originY + speed * 65 * mult * deltaTime, defenseLineY - holdDist);
      }

      if (inst.state === 'gather') {
        // 集结→推进：全员就位且平均距槽位在容差内；超时强制推进（防刷怪过慢卡集结）
        inst.gatherTimer += deltaTime;
        const assigned = inst.slots.filter(s => s.roachId != null).length;
        if (assigned >= inst.expectedTotal && members.length > 0) {
          const avgDist = members.reduce((sum, m) => {
            const t = this.slotTarget(inst, m.slot, getGroundBoundsAtY);
            return sum + Math.hypot(m.r.x - t.x, m.r.y - t.y);
          }, 0) / members.length;
          if (avgDist <= c.gatherTolerance) inst.state = 'push';
        }
        if (inst.gatherTimer >= c.gatherTimeout) inst.state = 'push';
      } else if (members.length > 0) {
        // 破阵判定②：推进期存活比例低于阈值（按模板配置；G/H 无此档——仅锚点全灭+脱离判定）
        const aliveRatio = members.length / inst.expectedTotal;
        const ratioTh = (c.breakAliveRatio as Partial<Record<FormationTemplate, number>>)[inst.template];
        // 破阵判定③：30% 成员横向脱离阵型半宽（冲突状态成员豁免——闪避/狂暴/冲刺不算脱离）
        const halfW = this.instanceHalfWidth(inst, getGroundBoundsAtY);
        const outCount = members.filter(m => !this.isInConflict(m.r) &&
          Math.abs(m.r.x - this.slotTarget(inst, m.slot, getGroundBoundsAtY).x) > halfW).length;
        if ((ratioTh !== undefined && aliveRatio < ratioTh) || outCount / members.length > c.breakOutRatio) {
          this.breakInstance(inst, aliveById);
          this.instances.splice(k, 1);
          continue;
        }
      }

      // 锚点菱形标识维护（渲染层读取 r.anchorMarkColor）
      for (const m of members) {
        m.r.anchorMarkColor = m.slot.isAnchor ? this.anchorColor(m.r.type) : undefined;
      }
    }
  }

  // ----- 内部：计划构建 -----

  /** 阵型组编制表（应用护士≤1/隧道工≤2/护盾≤1 硬上限截断；返回前/中/后排类型令牌） */
  private groupTokens(g: FormationGroupConfig): { front: RoachType[]; mid: RoachType[]; nurse: number } {
    const c = BALANCE_CONFIG.supermarket;
    const nurse = Math.min(g.nurse ?? 0, c.maxNursePerFormation);
    const tunnel = Math.min(g.tunnelWorker ?? 0, c.maxTunnelerPerFormation);
    const shield = Math.min(g.shield ?? 0, c.maxShieldPerFormation);
    if ((g.nurse ?? 0) > nurse) console.error(`[FormationSystem] 护士数量 ${g.nurse} 超每阵列上限 ${c.maxNursePerFormation}，已截断`);
    if ((g.tunnelWorker ?? 0) > tunnel) console.error(`[FormationSystem] 隧道工数量 ${g.tunnelWorker} 超每阵列上限 ${c.maxTunnelerPerFormation}，已截断`);
    if ((g.shield ?? 0) > shield) console.error(`[FormationSystem] 护盾蟑螂数量 ${g.shield} 超每阵列上限 ${c.maxShieldPerFormation}，已截断`);
    return {
      front: [
        ...Array<RoachType>(g.armored ?? 0).fill(RoachType.ARMORED),
        ...Array<RoachType>(shield).fill(RoachType.SHIELD),
      ],
      mid: [
        ...Array<RoachType>(g.splitting ?? 0).fill(RoachType.SPLITTING),
        ...Array<RoachType>(g.timedSuicide ?? 0).fill(RoachType.TIMED_SUICIDE),
        ...Array<RoachType>(tunnel).fill(RoachType.TUNNEL_WORKER),
      ],
      nurse,
    };
  }

  /** 模板A：三路散兵线（每路前排装甲/护盾主锚点承伤，中排功能单位后排；护士锚点居中路） */
  private buildLanes(g: FormationGroupConfig): void {
    const c = BALANCE_CONFIG.supermarket;
    const { front, mid, nurse } = this.groupTokens(g);
    const perLane = (n: number) => [
      Math.floor(n / 3) + (n % 3 > 0 ? 1 : 0),
      Math.floor(n / 3) + (n % 3 > 1 ? 1 : 0),
      Math.floor(n / 3),
    ];
    const fronts = perLane(front.length), mids = perLane(mid.length);
    let fi = 0, mi = 0;
    for (let lane = 0; lane < 3; lane++) {
      const slots: FormationSlot[] = [];
      const nf = fronts[lane];
      for (let i = 0; i < nf; i++) {
        const dxRatio = nf === 1 ? 0 : -0.15 + 0.3 * (i / (nf - 1));
        slots.push({ dxRatio, dy: c.laneDepth / 2, isAnchor: i === 0, prefTypes: [front[fi++]], roachId: null });
      }
      const nm = mids[lane];
      for (let i = 0; i < nm; i++) {
        const t = mid[mi++];
        const dxRatio = nm === 1 ? 0 : -0.3 + 0.6 * (i / (nm - 1));
        slots.push({ dxRatio, dy: -c.laneDepth / 2, isAnchor: t === RoachType.TUNNEL_WORKER, prefTypes: [t], roachId: null });
      }
      if (lane === 1 && nurse > 0) {
        slots.push({ dxRatio: 0.45, dy: -c.laneDepth / 2, isAnchor: true, prefTypes: [RoachType.NURSE], roachId: null });
      }
      if (slots.length === 0) continue;
      this.instances.push({
        id: this.nextInstanceId++, template: 'A', laneIndex: lane, state: 'gather',
        originXRatio: (2 * lane + 1) / 6, originX: 0, originY: 0, started: false,
        slots, expectedTotal: slots.length, gatherTimer: 0, rotAngle: 0,
      });
    }
  }

  /** 模板D：装甲方阵（前排装甲/护盾承伤、居中者主锚点，中排分裂/定时自爆/隧道工，后排护士锚点） */
  private buildPhalanx(g: FormationGroupConfig): void {
    const c = BALANCE_CONFIG.supermarket;
    const { front, mid, nurse } = this.groupTokens(g);
    const slots: FormationSlot[] = [];
    const anchorIdx = Math.floor((front.length - 1) / 2);
    front.forEach((t, i) => slots.push({
      dxRatio: front.length === 1 ? 0 : -0.5 + i / (front.length - 1), dy: c.phalanxDepth / 2,
      isAnchor: i === anchorIdx, prefTypes: [t], roachId: null,
    }));
    mid.forEach((t, i) => slots.push({
      dxRatio: mid.length === 1 ? 0 : -0.3 + 0.6 * (i / (mid.length - 1)), dy: 0,
      isAnchor: t === RoachType.TUNNEL_WORKER, prefTypes: [t], roachId: null,
    }));
    for (let i = 0; i < nurse; i++) slots.push({
      dxRatio: 0, dy: -c.phalanxDepth / 2, isAnchor: true, prefTypes: [RoachType.NURSE], roachId: null,
    });
    if (slots.length === 0) return;
    this.instances.push({
      id: this.nextInstanceId++, template: 'D', laneIndex: 0, state: 'gather',
      originXRatio: 0.5, originX: 0, originY: 0, started: false,
      slots, expectedTotal: slots.length, gatherTimer: 0, rotAngle: 0,
    });
  }

  /** 模板B：楔形冲锋阵（尖端前排单锚点承伤，两翼前排贴身；中排左直右Z字；尾部护士锚点） */
  private buildWedge(g: FormationGroupConfig): void {
    const c = BALANCE_CONFIG.supermarket;
    const { front, mid, nurse } = this.groupTokens(g);
    if (front.length === 0) { console.error('[FormationSystem] 楔形阵缺少前排（尖端锚点），跳过'); return; }
    const slots: FormationSlot[] = [];
    const d = c.wedgeDepth;
    // 尖端单锚点（首只前排，装甲优先——front 令牌装甲在前）
    slots.push({ dxRatio: 0, dy: d / 2, isAnchor: true, prefTypes: [front[0]], roachId: null });
    // 紧随尖端的前排承伤层（左右交替贴身）
    front.slice(1).forEach((t, i) => slots.push({
      dxRatio: (i % 2 === 0 ? -1 : 1) * 0.08 * (1 + Math.floor(i / 2)), dy: d / 2 - 8,
      isAnchor: false, prefTypes: [t], roachId: null,
    }));
    // 中排两翼：左半直线维持阵型，右半持续Z字摇摆绕侧（定时自爆排右侧——令牌序定时自爆在后，切半自然落右）
    const half = Math.ceil(mid.length / 2);
    mid.forEach((t, i) => {
      const right = i >= half;
      const k = right ? i - half : i;
      const n = right ? mid.length - half : half;
      const tt = n <= 1 ? 0 : k / (n - 1);
      slots.push({
        dxRatio: (right ? 1 : -1) * (0.14 + 0.3 * tt), dy: d / 2 - 12 - tt * d,
        isAnchor: t === RoachType.TUNNEL_WORKER, prefTypes: [t], roachId: null,
        ...(right ? { zigzag: true, zigzagPhase: k * 0.3 } : {}),
      });
    });
    // 尾部护士锚点
    for (let i = 0; i < nurse; i++) slots.push({ dxRatio: 0, dy: -d / 2, isAnchor: true, prefTypes: [RoachType.NURSE], roachId: null });
    this.instances.push({
      id: this.nextInstanceId++, template: 'B', laneIndex: 0, state: 'gather',
      originXRatio: 0.5, originX: 0, originY: 0, started: false,
      slots, expectedTotal: slots.length, gatherTimer: 0, rotAngle: 0,
    });
  }

  /** 模板E：混合纵队阵（双独立纵队：前排装甲/护盾主锚点领头，中排功能层随后；护士锚点居左列；单列独立破阵） */
  private buildColumns(g: FormationGroupConfig): void {
    const c = BALANCE_CONFIG.supermarket;
    const { front, mid, nurse } = this.groupTokens(g);
    const d = c.columnDepth;
    const perCol = (n: number) => [Math.ceil(n / 2), Math.floor(n / 2)];
    const fronts = perCol(front.length), mids = perCol(mid.length);
    let fi = 0, mi = 0;
    for (let col = 0; col < 2; col++) {
      const slots: FormationSlot[] = [];
      // 前后层叠（同列相邻层按 columnLayerYGap 递错，保证 Y 轴纵深间距）
      let layer = 0;
      for (let i = 0; i < fronts[col]; i++) slots.push({ dxRatio: 0, dy: d / 2 - layer++ * c.columnLayerYGap, isAnchor: i === 0, prefTypes: [front[fi++]], roachId: null });
      for (let i = 0; i < mids[col]; i++) {
        const t = mid[mi++];
        slots.push({ dxRatio: 0, dy: d / 2 - layer++ * c.columnLayerYGap, isAnchor: t === RoachType.TUNNEL_WORKER, prefTypes: [t], roachId: null });
      }
      if (col === 0 && nurse > 0) slots.push({ dxRatio: 0, dy: d / 2 - layer++ * c.columnLayerYGap, isAnchor: true, prefTypes: [RoachType.NURSE], roachId: null });
      if (slots.length === 0) continue;
      this.instances.push({
        id: this.nextInstanceId++, template: 'E', laneIndex: col, state: 'gather',
        originXRatio: 0.5 + (col === 0 ? -c.columnOriginXRatio / 2 : c.columnOriginXRatio / 2),
        originX: 0, originY: 0, started: false,
        slots, expectedTotal: slots.length, gatherTimer: 0, rotAngle: 0,
      });
    }
  }

  /** 模板F：Z字穿插纵队（A列直线前排主锚点 + B列Z字中排主力，护士锚点居中拖后） */
  private buildZigzag(g: FormationGroupConfig): void {
    const c = BALANCE_CONFIG.supermarket;
    const { front, mid, nurse } = this.groupTokens(g);
    const slots: FormationSlot[] = [];
    const d = c.zigzagDepth;
    // A列：直线前排（首只为主锚点）；无前排时中排补A列（保底，正常配置必有前排）
    const colA = front.length > 0 ? front : mid;
    const colB = front.length > 0 ? mid : [];
    colA.forEach((t, i) => {
      const dy = colA.length === 1 ? d / 2 : d / 2 - (i / (colA.length - 1)) * d;
      slots.push({ dxRatio: -0.25, dy, isAnchor: i === 0 || t === RoachType.TUNNEL_WORKER, prefTypes: [t], roachId: null });
    });
    // B列：Z字中排主力（按阵型推进距离三角波横摆）
    colB.forEach((t, i) => {
      const dy = colB.length === 1 ? d / 2 : d / 2 - (i / (colB.length - 1)) * d;
      slots.push({
        dxRatio: 0.25, dy, isAnchor: t === RoachType.TUNNEL_WORKER, prefTypes: [t], roachId: null,
        zigzag: true, zigzagPhase: i * 0.35,
      });
    });
    // 护士锚点居中拖后
    for (let i = 0; i < nurse; i++) slots.push({ dxRatio: 0, dy: -d / 2 - 8, isAnchor: true, prefTypes: [RoachType.NURSE], roachId: null });
    if (slots.length === 0) return;
    this.instances.push({
      id: this.nextInstanceId++, template: 'F', laneIndex: 0, state: 'gather',
      originXRatio: 0.5, originX: 0, originY: 0, started: false,
      slots, expectedTotal: slots.length, gatherTimer: 0, rotAngle: 0,
    });
  }

  /** 模板G：同心圆护卫阵（外环装甲/护盾+内环中排双层旋转环错开45°，圆心护士锚点；环成员为核心抵挡直射火焰） */
  private buildRings(g: FormationGroupConfig): void {
    const c = BALANCE_CONFIG.supermarket;
    const { front, mid, nurse } = this.groupTokens(g);
    const slots: FormationSlot[] = [];
    // 外环：前排承伤环（与内环错开45°）
    const nOut = front.length;
    for (let i = 0; i < nOut; i++) slots.push({
      dxRatio: 0, dy: 0, isAnchor: false, prefTypes: [front[i]], roachId: null,
      polar: { angle: (2 * Math.PI * i) / nOut + Math.PI / 4, radiusRatio: 1 },
    });
    // 内环：中排功能环
    const nIn = mid.length;
    for (let i = 0; i < nIn; i++) slots.push({
      dxRatio: 0, dy: 0, isAnchor: false, prefTypes: [mid[i]], roachId: null,
      polar: { angle: (2 * Math.PI * i) / nIn, radiusRatio: c.ringInnerRatio },
    });
    // 圆心锚点：护士；无护士时首只中排顶圆心（全锚灭才破阵——破阵判定①默认语义）
    const coreTokens: RoachType[] = nurse > 0
      ? Array<RoachType>(nurse).fill(RoachType.NURSE)
      : mid.slice(0, 1);
    coreTokens.forEach((t, i) => slots.push({
      dxRatio: 0, dy: 0, isAnchor: true, prefTypes: [t], roachId: null,
      polar: { angle: (2 * Math.PI * i) / coreTokens.length, radiusRatio: 0.1 },
    }));
    if (slots.length === 0) return;
    this.instances.push({
      id: this.nextInstanceId++, template: 'G', laneIndex: 0, state: 'gather',
      originXRatio: 0.5, originX: 0, originY: 0, started: false,
      slots, expectedTotal: slots.length, gatherTimer: 0, rotAngle: 0,
    });
  }

  /** 模板H：双锋护卫阵（左右装甲/护盾走廊承伤，中军隧道工/护士双锚点续航——双锚全灭才破阵） */
  private buildCorridors(g: FormationGroupConfig): void {
    const c = BALANCE_CONFIG.supermarket;
    const { front, mid, nurse } = this.groupTokens(g);
    const slots: FormationSlot[] = [];
    const d = c.corridorDepth, half = c.corridorXRatio;
    // 双走廊前排（左右交替，沿走廊纵向前后错层）
    const rows = Math.max(1, Math.ceil(front.length / 2));
    front.forEach((t, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const dy = d / 2 - (rows === 1 ? 0 : (row / (rows - 1)) * d * 0.7);
      slots.push({ dxRatio: side * half, dy, isAnchor: false, prefTypes: [t], roachId: null });
    });
    // 中军锚点群（隧道工周期全队护甲——次级锚点；其余中排功能单位非锚）
    mid.forEach((t, i) => slots.push({
      dxRatio: mid.length === 1 ? 0 : -0.08 + 0.16 * (i / (mid.length - 1)),
      dy: -d / 4, isAnchor: t === RoachType.TUNNEL_WORKER, prefTypes: [t], roachId: null,
    }));
    // 后排护士锚点
    for (let i = 0; i < nurse; i++) slots.push({ dxRatio: 0, dy: -d / 2, isAnchor: true, prefTypes: [RoachType.NURSE], roachId: null });
    if (slots.length === 0) return;
    this.instances.push({
      id: this.nextInstanceId++, template: 'H', laneIndex: 0, state: 'gather',
      originXRatio: 0.5, originX: 0, originY: 0, started: false,
      slots, expectedTotal: slots.length, gatherTimer: 0, rotAngle: 0,
    });
  }

  // ----- 内部：运行时 -----

  /** 分配蟑螂到空闲槽位（类型精确匹配 + 组间负载均衡；回退仅接受非锚点槽位） */
  private assignRoach(r: Roach): void {
    let best: { inst: FormationInstance; slot: FormationSlot; load: number } | null = null;
    for (const inst of this.instances) {
      const slot = inst.slots.find(s => s.roachId == null && s.prefTypes.includes(r.type));
      if (!slot) continue;
      const load = inst.slots.filter(s => s.roachId != null).length / inst.expectedTotal;
      if (!best || load < best.load) best = { inst, slot, load };
    }
    if (!best) {
      for (const inst of this.instances) {
        const slot = inst.slots.find(s => s.roachId == null && !s.isAnchor);
        if (!slot) continue;
        const load = inst.slots.filter(s => s.roachId != null).length / inst.expectedTotal;
        if (!best || load < best.load) best = { inst, slot, load };
      }
    }
    if (best) {
      best.slot.roachId = r.id;
      r.formationId = best.inst.id;
    }
  }

  /** 冲突状态判定：闪避 / 狂暴 / 冲刺期间暂停阵型修正，原生 AI 优先 */
  private isInConflict(r: Roach): boolean {
    return r.dodgeTimer > 0 || r.wasDodging || r.isEnraged
      || r.chargeState === 'charge' || r.isCharging;
  }

  /** 地面模板横向可用全宽（槽位 dxRatio 的基准宽度，按模板取配置宽度占比） */
  private groundFullWidth(inst: FormationInstance, groundL: number, groundR: number): number {
    const c = BALANCE_CONFIG.supermarket;
    const w = groundR - groundL;
    switch (inst.template) {
      case 'A': return w / 3 * c.laneWidthRatio;
      case 'D': return w * c.phalanxWidthRatio;
      case 'B': return w * c.wedgeWidthRatio;
      case 'E': return w * c.columnWidthRatio;
      case 'F': return w * c.zigzagWidthRatio;
      case 'G': return w * c.ringWidthRatio;
      case 'H': return w * c.corridorWidthRatio;
      default: return w;
    }
  }

  /** 槽位目标坐标（横向按当前原点 Y 处地面可用宽度比例缩放；G 极坐标旋转；B/F 叠加Z字摆动） */
  private slotTarget(
    inst: FormationInstance, slot: FormationSlot,
    getGroundBoundsAtY: (y: number) => [number, number],
  ): { x: number; y: number } {
    const c = BALANCE_CONFIG.supermarket;
    // 模板G：极坐标环形槽位（每帧叠加实例旋转角，纵向按透视压扁成椭圆）
    if (slot.polar) {
      const [L, R] = getGroundBoundsAtY(inst.originY);
      const radius = (R - L) * c.ringWidthRatio / 2 * slot.polar.radiusRatio;
      const theta = slot.polar.angle + inst.rotAngle;
      return {
        x: inst.originX + Math.cos(theta) * radius,
        y: inst.originY + Math.sin(theta) * radius * c.ringDepthSquash,
      };
    }
    const [L, R] = getGroundBoundsAtY(inst.originY);
    let dx = slot.dxRatio * this.groundFullWidth(inst, L, R);
    // Z字摆动叠加（B右翼/F-B列：按阵型原点推进距离的三角波，确定性无状态、seek/逐帧一致）
    if (slot.zigzag) {
      const phase = inst.originY / c.zigzagPeriod + (slot.zigzagPhase ?? 0);
      const t = ((phase % 1) + 1) % 1;
      dx += (t < 0.5 ? t * 4 - 1 : 3 - t * 4) * c.zigzagAmp;
    }
    return { x: inst.originX + dx, y: inst.originY + slot.dy };
  }

  /** 阵型半宽（破阵判定③用） */
  private instanceHalfWidth(
    inst: FormationInstance,
    getGroundBoundsAtY: (y: number) => [number, number],
  ): number {
    const [L, R] = getGroundBoundsAtY(inst.originY);
    return this.groundFullWidth(inst, L, R) / 2;
  }

  /** 破阵：清除全体成员的编队标记（永久散乱，不可重聚） */
  private breakInstance(inst: FormationInstance, aliveById: Map<number, Roach>): void {
    for (const s of inst.slots) {
      if (s.roachId == null) continue;
      const r = aliveById.get(s.roachId);
      if (r) { r.formationId = undefined; r.anchorMarkColor = undefined; }
    }
  }

  /** 锚点菱形标识颜色（按怪物类型区分） */
  private anchorColor(type: RoachType): string {
    const c = BALANCE_CONFIG.supermarket;
    switch (type) {
      case RoachType.ARMORED: return c.anchorMarkColorArmored;
      case RoachType.SHIELD: return c.anchorMarkColorShield;
      case RoachType.NURSE: return c.anchorMarkColorNurse;
      case RoachType.TUNNEL_WORKER: return c.anchorMarkColorWorker;
      default: return c.anchorMarkColorDefault;
    }
  }
}
