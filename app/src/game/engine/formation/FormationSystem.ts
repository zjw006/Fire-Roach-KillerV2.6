/**
 * @fileoverview 阵型协同系统模块
 * @description 管理编队行为：
 *   1. 地铁场景「盾墙推进」编队策略（普通蟑螂跟随护盾锚点）；
 *   2. 超市场景 V5.0 直驱制阵型实例（槽位清单直读，无模板，锚点/运动标记驱动）。
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

import { RoachState, RoachType, type Roach, type FormationGroupConfig, type FormationSlotMotion } from '../../types';
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
// 阵型实例管理（超市场景 V5.0 直驱制：槽位清单直读，无模板）
// =============================================================================
//
// 数据模型：每组阵型 = 固定槽位清单（FormationSlotDef：类型 + 540×960 绝对坐标 +
//   锚点标记 + 运动标记），出生点即槽位，不再经过模板几何换算
// 锚点设计：锚点槽位由配置标记（前排领袖/隧道工/护士；orbit 组仅核心锚点）
// 运动标记：none 固定槽位｜sway 横向三角波摇摆（相位按槽位序号错开，蛇形而非整体横移）
//   ｜orbit 绕阵型中心旋转（orbit 组成员为核心锚点顶替承伤——伤害重定向，与护盾拦截同构）
// 三态状态机：集结（gather，原点 0.8 倍速推进、成员向槽位聚拢）
//   → 推进（push，保持相对坐标向防线移动）→ 散乱（破阵即移除实例，成员永久恢复原生 AI，不可重聚）
// 破阵双规则：① 锚点全灭（全部锚点槽位已分配且无存活锚点）
//   ② 推进期超过 breakOutRatio 比例成员横向脱离阵型半宽（冲突状态成员豁免）
// 成员单独脱离（不触发整组破阵）：定时自爆/分裂蟑螂距防线 < breakNearDefenseDist 时
//   槽位整体移除、恢复原生 AI 自行冲锋（敢死队脱阵——不被重新分配、不占集结名额）
// 冲突打断：闪避(dodgeTimer/wasDodging)、狂暴(isEnraged)、冲刺(chargeState/isCharging)
//   期间暂停阵型修正，原生 AI 优先
// 透视自适应：槽位横向偏移以出生时地面可用宽度归一存储，每帧乘以当前原点 Y 处地面宽度，
//   远端自动收缩扎堆、近端自然散开；原点 X 按出生时地面比例逐帧跟随透视中线
// V5.0 成员硬约束：阵列仅由特种单位构成（装甲/护盾/分裂/定时自爆/隧道工/护士），
//   小/大/飞行/地面自爆/精英永远不入阵（planTypes 过滤——自由杂兵类型不在槽位类型表中，
//   分配通道天然拒绝）；多组阵列经 addPlan 追加共存，各自独立锚点、独立破阵

/** 运行时阵型槽位（由 FormationSlotDef 绝对坐标换算） */
interface RuntimeSlot {
  /** 横向偏移比例（相对出生时阵型中心处地面可用宽度） */
  dxRatio: number;
  /** 纵向偏移（像素，相对阵型原点，+y 朝防线方向） */
  dy: number;
  /** 是否锚点槽位 */
  isAnchor: boolean;
  /** 分配类型（精确匹配） */
  type: RoachType;
  /** 已分配的蟑螂 ID */
  roachId: number | null;
  /** 运动方式 */
  motion: FormationSlotMotion;
  /** sway 相位错开（sway 槽位序号×步长） */
  swayPhase: number;
  /** orbit 极坐标（出生时由相对偏移换算：angle 基础弧度 + radius 像素半径基准） */
  orbit?: { angle: number; radius: number };
}

/** 阵型实例 */
interface FormationInstance {
  id: number;
  /** 状态：集结 / 推进（破阵即移除实例，成员永久恢复原生 AI） */
  state: 'gather' | 'push';
  /** 原点 X 比例（出生时阵型中心在地面可用宽度内的位置，逐帧跟随透视重算） */
  originXRatio: number;
  /** 阵型原点（出生时 = 槽位质心） */
  originX: number;
  originY: number;
  /** 出生时地面可用宽度（dxRatio / orbit 半径的透视缩放基准） */
  baseWidth: number;
  slots: RuntimeSlot[];
  expectedTotal: number;
  gatherTimer: number;
  /** 旋转角（orbit 槽位每帧按 orbitRotateSpeed 推进） */
  rotAngle: number;
  /** 是否含 orbit 槽位（顶替承伤/驻停距离预留用） */
  hasOrbit: boolean;
  /** orbit 最大半径（像素基准，驻停距离预留用） */
  maxOrbitRadius: number;
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
  // 超市阵型实例（V5.0 直驱制：槽位清单直读，多组错时共存）
  // ===========================================================================

  /** 当前存活的阵型实例列表（多组阵列经 addPlan 追加共存，各自独立锚点、独立破阵） */
  private instances: FormationInstance[] = [];
  private nextInstanceId = 1;
  /** 阵型计划涉及的怪物类型（仅三排特种类型；自由杂兵类型不在表中，分配通道天然拒绝） */
  private planTypes = new Set<RoachType>();

  /**
   * 追加一组阵型计划（V5.0 直驱制：槽位绝对坐标直接换算为运行时槽位，出生点即槽位）
   * 阵型原点 = 槽位质心；多组经 addPlan 追加共存，各组独立锚点/独立破阵
   * （waves.ts 坐标已固化出生上移：所见即所得，运行时不再做二次偏移）
   * @param group 阵型组配置（槽位清单：类型 + 540×960 绝对坐标 + 锚点/运动标记）
   * @param getGroundBoundsAtY 地面透视边界
   * @returns 本组出生点表（调用方逐只生成）
   */
  addPlan(
    group: FormationGroupConfig,
    getGroundBoundsAtY: (y: number) => [number, number],
  ): { type: RoachType; x: number; y: number }[] {
    const defs = group.slots;
    if (defs.length === 0) return [];
    const c = BALANCE_CONFIG.supermarket;
    // 阵型原点 = 槽位质心（透视归一基准：质心 Y 处地面可用宽度）
    const cx = defs.reduce((sum, d) => sum + d.x, 0) / defs.length;
    const cy = defs.reduce((sum, d) => sum + d.y, 0) / defs.length;
    const [L, R] = getGroundBoundsAtY(cy);
    const W0 = Math.max(1, R - L);

    const slots: RuntimeSlot[] = [];
    let swayIdx = 0;
    let hasOrbit = false;
    let maxOrbitRadius = 0;
    for (const d of defs) {
      const motion = d.motion ?? 'none';
      const dx = d.x - cx, dy = d.y - cy;
      const slot: RuntimeSlot = {
        dxRatio: dx / W0, dy,
        isAnchor: d.anchor === true, type: d.type,
        roachId: null, motion, swayPhase: 0,
      };
      if (motion === 'sway') slot.swayPhase = swayIdx++ * 0.3;
      if (motion === 'orbit') {
        hasOrbit = true;
        const radius = Math.hypot(dx, dy);
        slot.orbit = { angle: Math.atan2(dy, dx), radius };
        if (radius > maxOrbitRadius) maxOrbitRadius = radius;
      }
      this.planTypes.add(d.type);
      slots.push(slot);
    }
    this.instances.push({
      id: this.nextInstanceId++, state: 'gather',
      originXRatio: (cx - L) / W0, originX: cx, originY: cy, baseWidth: W0,
      slots, expectedTotal: slots.length, gatherTimer: 0, rotAngle: 0,
      hasOrbit, maxOrbitRadius,
    });

    // 出生去叠：任意两点横向间距 < spawnMinXGap 且纵向间距 ≤ spawnMinYGap 时横向推开（X 轴不叠影、Y 方向保持 >15px）
    const entries = defs.map(d => ({ type: d.type, x: d.x, y: d.y }));
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

  /**
   * 是否存在仍在作战的阵型实例（波次串行出场门控：上一组被消灭后才出下一组）
   * 视为「仍存活」：尚有成员待生成/待分配（槽位未绑 roachId），或存活成员数 ≥ minAlive
   * （破阵解散的实例已移出列表，散乱残兵不阻塞下一组出场）
   */
  hasActiveInstances(roaches: Roach[], minAlive = 2): boolean {
    return this.instances.some(inst => {
      let alive = 0;
      for (const s of inst.slots) {
        if (s.roachId == null) return true;
        const r = roaches.find(x => x.id === s.roachId);
        if (r && r.state === RoachState.ALIVE) alive++;
      }
      return alive >= minAlive;
    });
  }

  /** 判断蟑螂是否为存活阵型中的锚点（护士/隧道工锚点禁跟随用） */
  isAnchor(roachId: number): boolean {
    return this.instances.some(inst => inst.slots.some(s => s.isAnchor && s.roachId === roachId));
  }

  /**
   * orbit 阵型：核心锚点被直射火焰瞄准时，由存活 orbit 成员顶替承伤（伤害重定向，与护盾拦截同构）
   * @returns 顶替承伤的 orbit 成员；非 orbit 阵型/非锚点目标/orbit 成员已全灭返回 null
   */
  findOrbitProtector(target: Roach, roaches: Roach[]): Roach | null {
    if (target.formationId == null) return null;
    const inst = this.instances.find(i => i.id === target.formationId);
    if (!inst || !inst.hasOrbit) return null;
    const slot = inst.slots.find(s => s.roachId === target.id);
    if (!slot || !slot.isAnchor) return null;
    for (const s of inst.slots) {
      if (s.motion !== 'orbit' || s.roachId == null) continue;
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
      const members: { r: Roach; slot: RuntimeSlot }[] = [];
      for (const s of inst.slots) {
        if (s.roachId == null) continue;
        const r = aliveById.get(s.roachId);
        if (r) members.push({ r, slot: s });
      }

      // 成员单独脱离：定时自爆/分裂蟑螂距防线 < breakNearDefenseDist 时脱离阵列，恢复原生 AI 自行冲锋
      // （槽位整体移除而非置空：不占 expectedTotal、不被重新分配、不触发整组破阵）
      if (members.length > 0) {
        for (let i = members.length - 1; i >= 0; i--) {
          const m = members[i];
          if ((m.r.type === RoachType.TIMED_SUICIDE || m.r.type === RoachType.SPLITTING)
            && defenseLineY - m.r.y < c.breakNearDefenseDist) {
            m.r.formationId = undefined;
            m.r.anchorMarkColor = undefined;
            const si = inst.slots.indexOf(m.slot);
            if (si >= 0) inst.slots.splice(si, 1);
            inst.expectedTotal = Math.max(0, inst.expectedTotal - 1);
            members.splice(i, 1);
          }
        }
        // 全部槽位已脱离：实例直接移除（不阻塞下一组串行出场）
        if (inst.slots.length === 0) { this.instances.splice(k, 1); continue; }
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

      // 原点 X 每帧按透视重算（宽度随 Y 展开，阵型中心自动跟随地面比例位置）
      {
        const [L, R] = getGroundBoundsAtY(inst.originY);
        inst.originX = L + (R - L) * inst.originXRatio;
      }

      // orbit 槽位：每帧旋转（成员由阵型修正驱动沿轨移动）
      if (inst.hasOrbit) inst.rotAngle += c.orbitRotateSpeed * deltaTime;

      // 原点推进：速度取存活成员中最慢者（集结期 0.8 倍），推进至防线前停住
      // （orbit 阵型额外预留最大轨道半径：防止旋转环下缘越过防线直接破防）
      if (members.length > 0) {
        const speed = Math.min(...members.map(m => m.r.speed));
        const mult = inst.state === 'gather' ? c.gatherSpeedMult : 1;
        let holdDist = c.defenseHoldDist;
        if (inst.hasOrbit) {
          const [L, R] = getGroundBoundsAtY(inst.originY);
          holdDist += inst.maxOrbitRadius * ((R - L) / inst.baseWidth);
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
        // 破阵判定②：推进期超过 breakOutRatio 比例成员横向脱离阵型半宽（冲突状态成员豁免——闪避/狂暴/冲刺不算脱离）
        const halfW = this.instanceHalfWidth(inst, getGroundBoundsAtY);
        const outCount = members.filter(m => !this.isInConflict(m.r) &&
          Math.abs(m.r.x - this.slotTarget(inst, m.slot, getGroundBoundsAtY).x) > halfW).length;
        if (outCount / members.length > c.breakOutRatio) {
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

  // ----- 内部：运行时 -----

  /** 分配蟑螂到空闲槽位（类型精确匹配 + 组间负载均衡；回退仅接受非锚点槽位） */
  private assignRoach(r: Roach): void {
    let best: { inst: FormationInstance; slot: RuntimeSlot; load: number } | null = null;
    for (const inst of this.instances) {
      const slot = inst.slots.find(s => s.roachId == null && s.type === r.type);
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

  /** 槽位目标坐标（横向按当前原点 Y 处地面可用宽度比例缩放；orbit 极坐标旋转；sway 叠加三角波横摆） */
  private slotTarget(
    inst: FormationInstance, slot: RuntimeSlot,
    getGroundBoundsAtY: (y: number) => [number, number],
  ): { x: number; y: number } {
    const c = BALANCE_CONFIG.supermarket;
    const [L, R] = getGroundBoundsAtY(inst.originY);
    const W = R - L;
    // orbit：绕阵型中心旋转（半径按透视宽度比例缩放，每帧叠加实例旋转角）
    if (slot.orbit) {
      const radius = slot.orbit.radius * (W / inst.baseWidth);
      const theta = slot.orbit.angle + inst.rotAngle;
      return {
        x: inst.originX + Math.cos(theta) * radius,
        y: inst.originY + Math.sin(theta) * radius,
      };
    }
    let dx = slot.dxRatio * W;
    // sway：按阵型原点推进距离的三角波横摆（确定性无状态、seek/逐帧一致）
    if (slot.motion === 'sway') {
      const phase = inst.originY / c.swayPeriod + slot.swayPhase;
      const t = ((phase % 1) + 1) % 1;
      dx += (t < 0.5 ? t * 4 - 1 : 3 - t * 4) * c.swayAmp;
    }
    return { x: inst.originX + dx, y: inst.originY + slot.dy };
  }

  /** 阵型半宽（破阵判定②用：取全体槽位当前横向偏移的最大值） */
  private instanceHalfWidth(
    inst: FormationInstance,
    getGroundBoundsAtY: (y: number) => [number, number],
  ): number {
    const c = BALANCE_CONFIG.supermarket;
    const [L, R] = getGroundBoundsAtY(inst.originY);
    const W = R - L;
    let half = 0;
    for (const s of inst.slots) {
      const dx = s.orbit
        ? s.orbit.radius * (W / inst.baseWidth)
        : Math.abs(s.dxRatio) * W + (s.motion === 'sway' ? c.swayAmp : 0);
      if (dx > half) half = dx;
    }
    return Math.max(half, 1);
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
