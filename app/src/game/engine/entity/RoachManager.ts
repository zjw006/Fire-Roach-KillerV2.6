/**
 * @fileoverview 蟑螂实体管理器
 * @description 负责管理游戏中的蟑螂实体，包括生成、更新、状态管理和移除
 */

import type { Roach, RoachType } from '../../types';
import { RoachState } from '../../types';
import { ENEMY_DEFS } from '../../data';

/**
 * 蟑螂管理器类
 * @description 管理游戏中的蟑螂实体
 */
export class RoachManager {
  private roaches: Roach[] = [];
  private nextId: number = 1;
  private width: number;
  private height: number;
  private defenseLineY: () => number;
  private time: number = 0;
  private deltaTime: number = 0;

  /**
   * 构造函数
   * @param {number} width - 游戏区域宽度
   * @param {number} height - 游戏区域高度
   * @param {() => number} defenseLineY - 获取防御线Y坐标的函数
   */
  constructor(width: number, height: number, defenseLineY: () => number) {
    this.width = width;
    this.height = height;
    this.defenseLineY = defenseLineY;
  }

  /**
   * 获取所有蟑螂实体
   * @returns {Roach[]} 蟑螂实体列表
   */
  getRoaches(): Roach[] {
    return this.roaches;
  }

  /**
   * 设置蟑螂实体列表
   * @param {Roach[]} roaches - 蟑螂实体列表
   */
  setRoaches(roaches: Roach[]): void {
    this.roaches = roaches;
  }

  /**
   * 获取蟑螂数量
   * @returns {number} 蟑螂数量
   */
  getRoachCount(): number {
    return this.roaches.length;
  }

  /**
   * 生成蟑螂实体
   * @param {RoachType} type - 蟑螂类型
   * @param {number} [clusterId] - 集群ID（可选）
   * @returns {Roach | undefined} 生成的蟑螂实例
   */
  spawnRoach(type: RoachType, clusterId?: number): Roach | undefined {
    // 性能保护：硬性限制蟑螂数量
    if (this.roaches.length >= 40) return;

    const def = ENEMY_DEFS[type];
    if (!def) return;

    // 生成位置
    const spawnX = Math.random() * (this.width - 100) + 50;
    const spawnY = -50 - Math.random() * 50;

    const roach: Roach = {
      id: this.nextId++,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      type,
      hp: def.hp,
      maxHp: def.hp,
      state: RoachState.ALIVE,
      speed: def.speed,
      baseSpeed: def.speed,
      burnDamage: 0,
      inFire: false,
      clusterId,
      angle: 0,
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.5 + Math.random() * 1.5,
      isEnraged: false,
      deathTimer: 0,
      animFrame: 0,
      animTimer: 0,
      panicTimer: 0,
      panicAngle: 0,
      stunTimer: 0,
      isStunned: false,
      facingRight: true,
      altitude: 0,
      wingPhase: 0,
      armorHp: 0,
      maxArmorHp: 0,
      hasSplit: false,
      fuseTimer: 0,
      isFused: false,
      spawnTimer: 0,
      isBoss: false,
      isCharging: false,
      stuckTimer: 0,
      poisonTimer: 0,
      poisonDamage: 0,
      fanSlowTimer: 0,
      fanSlowFactor: 0,
      fanPushY: 0,
      wrappedByDropId: null,
      wrapTimer: 0,
      damageFlash: 0,
      dodgeDir: 0,
      dodgeTimer: 0,
      wasDodging: false,
      isSplitChild: false,
      isBurnBack: false,
      burnBackTimer: 0,
      isBlind: false,
      blindTimer: 0,
      isJammed: false,
      jamTimer: 0,
      homeX: 0,
      homeY: 0,
      returningHome: false,
      chargeReturnDelay: 0,
      size: def.size,
      reward: def.reward,
      healTimer: 0,
      healTargetId: null,
      asphyxiationTimer: 0,
      explodeTimer: 0,
      isCountingDown: false,
      countdownPaused: false,
      healBuffTimer: 0,
      healPhase: 'idle',
      healPhaseTimer: 0,
      healRange: 0,
      embryoPhase: 'idle',
      embryoTimer: 0,
      embryoSpawns: [],
      wasMutantSpawn: false,
      slimeTimer: 0,
      spawnImmuneTimer: 0,
      hasPlacedBomb: false,
      placeTimer: 0,
      breachPhase: 'idle',
      breachPhaseTimer: 0,
      crackRadius: 0,
      isFrozen: false,
      isFlameKilled: false,
      residueTimer: 0,
      transformTimer: 0,
      hasTransformed: false
    };

    this.roaches.push(roach);
    return roach;
  }

  /**
   * 更新时间和增量时间
   * @param {number} time - 当前时间
   * @param {number} deltaTime - 时间增量
   */
  updateTime(time: number, deltaTime: number): void {
    this.time = time;
    this.deltaTime = deltaTime;
  }

  /**
   * 更新所有蟑螂实体
   * @param {Function} updateStatusEffects - 更新状态效果的函数
   * @param {Function} isStuckByBoard - 检查是否被粘板粘住的函数
   * @param {Function} addFloatingText - 添加浮动文本的函数
   */
  updateRoaches(
    updateStatusEffects: (roach: Roach) => void,
    isStuckByBoard: (id: number) => boolean
  ): void {
    // 简化的更新逻辑，完整实现需要从原始引擎文件迁移
    for (let i = this.roaches.length - 1; i >= 0; i--) {
      const r = this.roaches[i];
      if (!r) continue;

      // 更新状态效果
      updateStatusEffects(r);

      // 检查是否被粘板粘住
      if (isStuckByBoard(r.id)) {
        // 如果被粘住，减少移动速度
        r.speed = Math.max(r.speed * 0.3, 10);
      }

      // 检查是否死亡
      if (r.state === RoachState.DEAD) {
        r.deathTimer -= this.deltaTime;
        if (r.deathTimer <= 0) {
          this.roaches.splice(i, 1);
        }
        continue;
      }

      // 更新位置
      this.updateRoachPosition(r);
    }
  }

  /**
   * 更新蟑螂位置
   * @param {Roach} roach - 蟑螂实体
   */
  private updateRoachPosition(roach: Roach): void {
    const dl = this.defenseLineY();
    const roachSize = ENEMY_DEFS[roach.type].size;
    const roachBottom = roach.y + roachSize * 0.4;
    
    // 计算移动角度
    const targetX = roach.x + Math.sin(roach.wobbleOffset + this.time * roach.wobbleSpeed) * 30;
    const targetY = roachBottom >= dl ? dl + 200 : dl;
    
    const dx = targetX - roach.x;
    const dy = targetY - roach.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 1) {
      const moveAngle = Math.atan2(dy, dx);
      roach.vx = Math.cos(moveAngle) * roach.speed * 65;
      roach.vy = Math.sin(moveAngle) * roach.speed * 65;
    }
    
    // 更新位置
    roach.x += roach.vx * this.deltaTime;
    roach.y += roach.vy * this.deltaTime;
  }

  /**
   * 对蟑螂造成伤害
   * @param {number} id - 蟑螂ID
   * @param {number} damage - 伤害值
   * @returns {boolean} 是否造成伤害成功
   */
  damageRoach(id: number, damage: number): boolean {
    const roach = this.roaches.find(r => r.id === id);
    if (!roach || roach.state === RoachState.DEAD) return false;

    roach.hp -= damage;
    roach.damageFlash = 1;

    if (roach.hp <= 0) {
      roach.state = RoachState.DEAD;
      roach.deathTimer = 1.0;
      return true;
    }

    return false;
  }

  /**
   * 更新所有蟑螂实体
   * @param {number} deltaTime - 时间增量
   */
  update(deltaTime: number): void {
    this.deltaTime = deltaTime;
    this.time += deltaTime;
    
    // 更新所有蟑螂
    for (let i = this.roaches.length - 1; i >= 0; i--) {
      const roach = this.roaches[i];
      if (!roach) continue;
      
      // 更新位置
      roach.x += roach.vx * deltaTime;
      roach.y += roach.vy * deltaTime;
      
      // 更新计时器
      if (roach.damageFlash > 0) {
        roach.damageFlash -= deltaTime * 5;
      }
      
      if (roach.deathTimer > 0) {
        roach.deathTimer -= deltaTime;
        if (roach.deathTimer <= 0) {
          this.roaches.splice(i, 1);
        }
      }
    }
  }

  /**
   * 清除所有蟑螂实体
   */
  clearAll(): void {
    this.roaches = [];
  }

  /**
   * 根据ID获取蟑螂实体
   * @param {number} id - 蟑螂ID
   * @returns {Roach | undefined} 蟑螂实体
   */
  getRoachById(id: number): Roach | undefined {
    return this.roaches.find(r => r.id === id);
  }

  /**
   * 移除指定ID的蟑螂实体
   * @param {number} id - 蟑螂ID
   * @returns {boolean} 是否移除成功
   */
  removeRoach(id: number): boolean {
    const index = this.roaches.findIndex(r => r.id === id);
    if (index !== -1) {
      this.roaches.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 检查蟑螂是否超出游戏边界
   * @param {Roach} roach - 蟑螂实体
   * @returns {boolean} 是否超出边界
   */
  isOutOfBounds(roach: Roach): boolean {
    // 检查是否超出左右边界
    if (roach.x < 0 || roach.x > this.width) {
      return true;
    }
    
    // 检查是否超出上下边界（考虑防御线）
    if (roach.y < 0 || roach.y > this.height) {
      return true;
    }
    
    // 检查是否越过防御线
    if (roach.y > this.defenseLineY()) {
      return true;
    }
    
    return false;
  }
}