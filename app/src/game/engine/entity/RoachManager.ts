/**
 * @fileoverview 蟑螂实体管理器
 * @description 负责管理游戏中的蟑螂实体，包括生成、更新、状态管理和移除
 */

import type { Roach } from '../../types';
import { RoachType, SceneType, RoachState } from '../../types';
import { ENEMY_DEFS, SCENE_GROUND_BOUNDS } from '../../data';

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
  private currentScene: SceneType;
  private time: number = 0;
  private deltaTime: number = 0;

  /**
   * 构造函数
   * @param {number} width - 游戏区域宽度
   * @param {number} height - 游戏区域高度
   * @param {() => number} defenseLineY - 获取防御线Y坐标的函数
   * @param {SceneType} currentScene - 当前场景类型
   */
  constructor(width: number, height: number, defenseLineY: () => number, currentScene: SceneType = SceneType.KITCHEN) {
    this.width = width;
    this.height = height;
    this.defenseLineY = defenseLineY;
    this.currentScene = currentScene;
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
   * @param {object} [options] - 生成选项
   * @param {string} [options.difficulty='normal'] - 游戏难度
   * @param {object} [options.waveConfig] - 波次配置
   * @param {object} [options.bossBattle] - Boss战斗状态
   * @returns {Roach | undefined} 生成的蟑螂实例
   */
  spawnRoach(
    type: RoachType, 
    clusterId?: number, 
    options?: {
      difficulty?: 'easy' | 'normal' | 'hard';
      waveConfig?: any;
      bossBattle?: any;
    }
  ): Roach | undefined {
    // 性能保护：硬性限制蟑螂数量
    if (this.roaches.length >= 40) return;

    const def = ENEMY_DEFS[type];
    if (!def) return;

    // 生成位置
    let baseX: number, baseY: number;

    if (type === RoachType.FLYING || type === RoachType.FLYING_SUICIDE) {
      // 飞行蟑螂：从两侧生成并飞过屏幕
      baseX = Math.random() < 0.5 ? -20 : this.width + 20;
      baseY = this.height * 0.3 + Math.random() * this.height * 0.2;
    } else if (type === RoachType.QUEEN) {
      // 女王蟑螂：在屏幕中央附近生成
      baseX = this.width / 2 + (Math.random() - 0.5) * 100;
      baseY = this.height * 0.45;
    } else if (type === RoachType.NURSE && this.currentScene === SceneType.HOSPITAL) {
      // 医院场景专属：护士蟑螂在远端点生成
      const [, farLY] = SCENE_GROUND_BOUNDS[this.currentScene];
      baseY = farLY + 10; // 稍微低于远端点以可见
      const [gLeft, gRight] = this.getGroundBoundsAtY(baseY);
      baseX = gLeft + Math.random() * (gRight - gLeft);
    } else {
      // 地面蟑螂：在6点透视地面边界内生成
      const [, farLY, , farRY, , midLY, , midRY, , , nearY] = SCENE_GROUND_BOUNDS[this.currentScene];
      const farY = Math.min(farLY, farRY, midLY, midRY); // 使用最高点作为生成顶部
      // 在边界内随机Y位置（偏向远端生成）
      baseY = farY + Math.random() * (nearY - farY) * 0.6;
      // 获取此Y位置的左右边界（透视插值）
      const [gLeft, gRight] = this.getGroundBoundsAtY(baseY);
      baseX = gLeft + Math.random() * (gRight - gLeft);
     }

     // ===== BOSS地面战斗：确保召唤的蟑螂不重叠 =====
     // 当Boss在地面时（阶段 >= 2），确保召唤的蟑螂不重叠
     if (options?.bossBattle?.active && options?.bossBattle?.phase >= 2 && type !== RoachType.QUEEN && type !== RoachType.FLYING) {
       // 在实际游戏中，这里会查找现有的女王蟑螂
       // 为了简化，我们假设有Boss存在
       const bossX = this.width / 2;
       const bossY = this.height * 0.45;
       
       const minDistance = 120; // 最小距离
       const maxAttempts = 10;
       for (let attempt = 0; attempt < maxAttempts; attempt++) {
         const dx = baseX - bossX;
         const dy = baseY - bossY;
         const dist = Math.sqrt(dx * dx + dy * dy);
         if (dist >= minDistance) break; // 足够远
         
         // 太近 - 重新定位：在Boss的另一侧生成
         if (baseX < bossX) {
           baseX = bossX - minDistance - Math.random() * 100;
         } else {
           baseX = bossX + minDistance + Math.random() * 100;
         }
         
         // 钳制到屏幕边界
         baseX = Math.max(40, Math.min(this.width - 40, baseX));
       }
     }

     // 应用难度和波次配置
     const difficulty = options?.difficulty || 'normal';
     const waveConfig = options?.waveConfig;
     
     const isHard = difficulty === 'hard';
     const hpMult = isHard ? 1.8 : 1.2;
     const speedMult = waveConfig?.speed || 1.0;
    
    const roach: Roach = {
      id: type === RoachType.QUEEN ? 9999 : this.nextId++, // 女王蟑螂使用特殊ID
      x: baseX,
      y: baseY,
      vx: 0,
      vy: 0,
      type,
      hp: Math.floor(def.hp * hpMult * (type === RoachType.QUEEN ? (isHard ? 1.5 : 1) : 1)),
      maxHp: Math.floor(def.hp * hpMult * (type === RoachType.QUEEN ? (isHard ? 1.5 : 1) : 1)),
      state: RoachState.ALIVE,
      speed: def.speed * speedMult * (0.7 + Math.random() * 0.3),
      baseSpeed: def.speed * speedMult,
      burnDamage: 0,
      inFire: false,
      clusterId,
      angle: 0,
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 2 + Math.random() * 2,
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
      isBoss: type === RoachType.QUEEN,
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
   * 根据Y坐标获取地面边界
   * @description 计算透视效果下的地面左右边界
   * @param y Y坐标
   * @returns [leftX, rightX] 左右边界
   */
  getGroundBoundsAtY(y: number): [number, number] {
    const [farL, farLY, farR, farRY, midL, midLY, midR, midRY, nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[this.currentScene];
    const clampedY = Math.min(nearY, Math.max(Math.min(farLY, farRY), y));

    // 左侧：2段（远→中→近）
    let leftX: number;
    if (clampedY >= midLY) {
      // 中段和近段之间（下半部分）
      const t = (clampedY - midLY) / (nearY - midLY);
      leftX = midL + (nearL - midL) * t;
    } else {
      // 远段和中段之间（上半部分）
      const t = (clampedY - farLY) / (midLY - farLY);
      leftX = farL + (midL - farL) * t;
    }

    // 右侧：2段（远→中→近）
    let rightX: number;
    if (clampedY >= midRY) {
      // 中段和近段之间（下半部分）
      const t = (clampedY - midRY) / (nearY - midRY);
      rightX = midR + (nearR - midR) * t;
    } else {
      // 远段和中段之间（上半部分）
      const t = (clampedY - farRY) / (midRY - farRY);
      rightX = farR + (midR - farR) * t;
    }

    return [leftX, rightX];
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