/**
 * @fileoverview 蟑螂敌人AI系统模块
 * @description 负责管理游戏中所有蟑螂敌人的AI行为、移动逻辑和状态管理
 */

import { 
  type Roach, 
  RoachType, 
  RoachState, 
  GameState,
  SceneType,
  type FireWall,
  type StickyBoard
} from '../../types';
import { ENEMY_DEFS, SCENE_GROUND_BOUNDS } from '../../data';

/**
 * 蟑螂AI系统配置接口
 */
export interface RoachAISystemConfig {
  /** 游戏状态 */
  gameState: GameState;
  /** 游戏难度 */
  difficulty: 'easy' | 'normal' | 'hard';
  /** 防线Y坐标 */
  defenseLineY: number;
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 时间增量 */
  deltaTime: number;
  /** 当前场景 */
  currentScene: SceneType;
  /** 玩家X坐标（用于某些AI行为） */
  playerX?: number;
  /** 玩家Y坐标（用于某些AI行为） */
  playerY?: number;
  /** 播放音效回调 */
  onPlaySound?: (soundId: string) => void;
  /** 震动回调 */
  onVibrate?: (pattern: string) => void;
  /** 添加浮动文本回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string, duration?: number) => void;
  /** 添加粒子回调 */
  onAddParticle?: (particle: any) => void;
  /** 触发突破爆炸回调 */
  onTriggerBreachExplosion?: (roach: Roach) => void;
  /** 获取所有蟑螂回调 */
  onGetAllRoaches?: () => Roach[];
  /** 获取火焰墙回调 */
  onGetFireWalls?: () => FireWall[];
  /** 获取诱饵目标回调 */
  onGetBaitTarget?: () => { active: boolean; x: number; y: number } | null;
  /** 获取粘性板回调 */
  onGetStickyBoards?: () => StickyBoard[];
}

/**
 * 蟑螂AI系统类
 * @description 管理所有蟑螂敌人的AI行为、移动逻辑和状态更新
 */
export class RoachAISystem {
  /** 系统配置 */
  private config: RoachAISystemConfig;
  
  /** 变异体转换动画状态 */
  private mutantTransformActive: boolean = false;
  private mutantTransformTimer: number = 0;
  private mutantTransformFrame: number = 0;
  
  /** 蟑螂分裂事件回调 */
  onRoachSplit?: (parentRoach: Roach, childRoaches: Roach[]) => void;
  
  /** 添加浮动文本回调 */
  addFloatingText?: (x: number, y: number, text: string, color: string, duration?: number) => void;
  
  /** 生成火花粒子效果回调 */
  spawnSparkParticles?: (x: number, y: number, count: number) => void;
  
  /** 装甲破碎事件回调 */
  onArmorBroken?: (roach: Roach) => void;
  
  /** 生成胚胎蟑螂事件回调 */
  spawnEmbryoRoaches?: (parentRoach: Roach) => void;
  
  /** 播放音效回调 */
  onPlaySound?: (soundId: string) => void;
  
  /** 震动回调 */
  onVibrate?: (pattern: string) => void;
  
  /** 触发突破爆炸回调 */
  onTriggerBreachExplosion?: (roach: Roach) => void;
  
  /** 获取所有蟑螂回调 */
  onGetAllRoaches?: () => Roach[];
  
  /** 获取火焰墙回调 */
  onGetFireWalls?: () => FireWall[];
  
  /** 获取诱饵目标回调 */
  onGetBaitTarget?: () => { active: boolean; x: number; y: number } | null;
  
  /** 获取粘性板回调 */
  onGetStickyBoards?: () => StickyBoard[];
  
  /** 内部存储的蟑螂数组（用于护士等需要遍历所有蟑螂的逻辑） */
  private roaches: Roach[] = [];
  
  /**
   * 构造函数
   * @param config 系统配置
   */
  constructor(config: RoachAISystemConfig) {
    this.config = config;
  }
  
  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<RoachAISystemConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 设置所有蟑螂数组（供护士等需要遍历所有蟑螂的逻辑使用）
   * @param roaches 蟑螂数组
   */
  setRoaches(roaches: Roach[]): void {
    this.roaches = roaches;
  }
  
  /**
   * 设置所有蟑螂数组（别名方法，与setRoaches功能相同）
   * @param roaches 蟑螂数组
   */
  setAllRoaches(roaches: Roach[]): void {
    this.roaches = roaches;
  }
  
  /**
   * 更新所有蟑螂的AI和状态
   * @param roaches 蟑螂数组
   * @returns 更新后的蟑螂数组
   */
  updateRoaches(roaches: Roach[]): Roach[] {
    // 更新变异体转换动画
    this.updateMutantTransform();
    
    // 处理每个蟑螂
    const updatedRoaches: Roach[] = [];
    
    for (let i = 0; i < roaches.length; i++) {
      const roach = roaches[i];
      if (!roach) continue;
      
      // 处理死亡状态
      if (roach.state === RoachState.DEAD) {
        const updatedRoach = this.updateDeadRoach(roach);
        if (updatedRoach.deathTimer > 0) {
          updatedRoaches.push(updatedRoach);
        }
        continue;
      }
      
      // 更新存活蟑螂
      const updatedRoach = this.updateAliveRoach(roach);
      updatedRoaches.push(updatedRoach);
    }
    
    return updatedRoaches;
  }
  
  /**
   * 更新变异体转换动画
   */
  private updateMutantTransform(): void {
    if (!this.mutantTransformActive) return;
    
    this.mutantTransformTimer -= this.config.deltaTime;
    if (this.mutantTransformTimer <= 0) {
      this.mutantTransformFrame++;
      if (this.mutantTransformFrame >= 7) {
        // 动画完成
        this.mutantTransformActive = false;
        // TODO: 生成胚胎蟑螂
      } else {
        // 下一帧
        this.mutantTransformTimer = 0.2;
      }
    }
  }
  
  /**
   * 更新死亡蟑螂
   * @param roach 蟑螂对象
   * @returns 更新后的蟑螂
   */
  private updateDeadRoach(roach: Roach): Roach {
    const updatedRoach = { ...roach };
    updatedRoach.deathTimer -= this.config.deltaTime;
    
    // 飞行蟑螂坠落效果
    if (roach.type === RoachType.FLYING || roach.type === RoachType.FLYING_SUICIDE) {
      updatedRoach.vy = 150; // 坠落速度
      updatedRoach.y += updatedRoach.vy * this.config.deltaTime;
      updatedRoach.vx = (Math.random() - 0.5) * 40; // 水平翻滚
      updatedRoach.x += updatedRoach.vx * this.config.deltaTime;
      updatedRoach.angle += this.config.deltaTime * 8; // 旋转
      
      // 触地后立即移除
      if (updatedRoach.y >= this.config.defenseLineY) {
        updatedRoach.y = this.config.defenseLineY;
        updatedRoach.deathTimer = 0;
      }
    }
    
    // 变异体在转换动画期间保持存活
    if (roach.type === RoachType.MUTANT && this.mutantTransformActive) {
      updatedRoach.deathTimer = 0.1;
    }
    
    return updatedRoach;
  }
  
  /**
   * 更新存活蟑螂
   * @param roach 蟑螂对象
   * @returns 更新后的蟑螂
   */
  private updateAliveRoach(roach: Roach): Roach {
    const updatedRoach = { ...roach };
    
    // 更新生成免疫计时器
    if (updatedRoach.spawnImmuneTimer && updatedRoach.spawnImmuneTimer > 0) {
      updatedRoach.spawnImmuneTimer -= this.config.deltaTime;
    }
    
    // 更新治疗增益计时器
    if (updatedRoach.healBuffTimer && updatedRoach.healBuffTimer > 0) {
      updatedRoach.healBuffTimer -= this.config.deltaTime;
    }
    
    // 伤害闪光衰减
    if (updatedRoach.damageFlash > 0) {
      updatedRoach.damageFlash -= this.config.deltaTime * 5;
    }
    
    // 更新状态效果
    this.updateStatusEffects(updatedRoach);
    
    // 检查是否被眩晕或粘性板困住
    const isImmobilized = updatedRoach.isStunned || this.isStuckByBoard(updatedRoach.id);
    if (isImmobilized) {
      updatedRoach.vx = 0;
      updatedRoach.vy = 0;
    }
    
    // 狂暴状态
    if (!updatedRoach.isEnraged && updatedRoach.hp < updatedRoach.maxHp * 0.2 && 
        updatedRoach.type !== RoachType.ARMORED) {
      updatedRoach.isEnraged = true;
      updatedRoach.speed = updatedRoach.baseSpeed * 2;
    }
    
    // 恐慌计时器
    if (updatedRoach.panicTimer > 0) {
      updatedRoach.panicTimer -= this.config.deltaTime;
    }
    
    // 移动逻辑
    if (!isImmobilized) {
      this.updateRoachMovement(updatedRoach);
    }
    
    // 特殊敌人行为
    this.updateSpecialRoachBehavior(updatedRoach);
    
    return updatedRoach;
  }
  
  /**
   * 更新蟑螂状态效果
   * @param roach 蟑螂对象
   */
  private updateStatusEffects(roach: Roach): void {
    // 燃烧伤害
    if (roach.burnDamage > 0) {
      const burnDamage = Math.min(roach.burnDamage, 30 * this.config.deltaTime);
      roach.hp -= burnDamage;
      roach.burnDamage -= burnDamage;
      
      if (roach.hp <= 0) {
        roach.state = RoachState.DEAD;
        roach.deathTimer = 1.0;
      }
    }
    
    // 中毒效果
    if (roach.poisonTimer > 0) {
      roach.poisonTimer -= this.config.deltaTime;
      const poisonDamage = 5 * this.config.deltaTime;
      roach.hp -= poisonDamage;
      
      if (roach.hp <= 0) {
        roach.state = RoachState.DEAD;
        roach.deathTimer = 1.0;
      }
    }
    
    // 冰冻效果（暂时注释，因为Roach接口中没有freezeTimer属性）
    // if (roach.freezeTimer > 0) {
    //   roach.freezeTimer -= this.config.deltaTime;
    //   roach.speed = roach.baseSpeed * 0.3; // 大幅减速
    // } else if (roach.state === RoachState.FROZEN) {
    //   roach.state = RoachState.ALIVE;
    //   roach.speed = roach.baseSpeed;
    // }
  }
  
  /**
   * 更新蟑螂移动
   * @param roach 蟑螂对象
   */
  private updateRoachMovement(roach: Roach): void {
    const enemyDef = ENEMY_DEFS[roach.type];
    const roachSize = enemyDef?.size || 30;
    
    let moveAngle: number;

    // 检查是否被眩晕或粘性板困住
    const isImmobilized = roach.isStunned || this.isStuckByBoard(roach.id);
    if (isImmobilized) {
      roach.vx = 0;
      roach.vy = 0;
      return;
    }

    // 恐慌移动
    if (roach.panicTimer > 0) {
      moveAngle = roach.panicAngle + Math.sin(this.config.deltaTime * 15 + roach.wobbleOffset) * 0.8;
    } else {
      const isFlying = roach.type === RoachType.FLYING || roach.type === RoachType.FLYING_SUICIDE;
      // 飞行蟑螂：增加横向摆动幅度
      const wanderAmplitude = isFlying ? 80 : 30;
      const targetX = roach.x + Math.sin(roach.wobbleOffset + this.config.deltaTime * roach.wobbleSpeed) * wanderAmplitude;
      const roachBottom = roach.y + roachSize * 0.4;
      const dl = this.config.defenseLineY;
      
      // 关键修复：如果蟑螂已经越过防线，继续向下移动（不要拉回来）
      const targetY = roachBottom >= dl ? dl + 200 : dl;
      const dx = targetX - roach.x;
      const dy = targetY - roach.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      moveAngle = dist > 1 ? Math.atan2(dy, dx) : roach.angle;

      // 强制修复：当蟑螂非常接近防线时，确保它能够越过
      // （防止蟑螂在防线附近永远水平徘徊）
      const distToDefense = dl - roachBottom;
      if (distToDefense > 0 && distToDefense < 50) {
        // 接近防线：增加向下速度以确保越过
        const minSin = 0.3 + (1 - distToDefense / 50) * 0.4; // 0.3 到 0.7
        if (Math.sin(moveAngle) < minSin) {
          moveAngle = Math.asin(Math.min(minSin, 0.99));
        }
      }

      // 地面蟑螂：在接近防线时从边缘推开
      // 飞行蟑螂：接近时加速并直线冲向防线
      if (isFlying && distToDefense < 150) {
        // 飞行蟑螂加速冲向防线 - 没有边缘推开
        const chargeSpeed = 2.5 * (1 - distToDefense / 150); // 最高2.5倍速度提升
        roach.speed = roach.baseSpeed * (1 + chargeSpeed);
      } else if (!isFlying) {
        const margin = 80;
        if (distToDefense < 120) {
          const pushStrength = (1 - distToDefense / 120) * 150 * this.config.deltaTime;
          if (roach.x < margin) {
            moveAngle += pushStrength * (margin - roach.x) / margin;
          } else if (roach.x > this.config.canvasWidth - margin) {
            moveAngle -= pushStrength * (roach.x - (this.config.canvasWidth - margin)) / margin;
          }
        }
      }
    }

    // 诱饵消耗品：在诱饵激活期间将所有蟑螂拉向诱饵目标
    const baitTarget = this.onGetBaitTarget?.();
    if (baitTarget && baitTarget.active && !isImmobilized) {
      const baitDx = baitTarget.x - roach.x;
      const baitDy = baitTarget.y - roach.y;
      const baitDist = Math.sqrt(baitDx * baitDx + baitDy * baitDy);
      if (baitDist > 10) {
        const baitAngle = Math.atan2(baitDy, baitDx);
        const pullStrength = 0.7;
        const cosA = Math.cos(moveAngle);
        const sinA = Math.sin(moveAngle);
        const cosB = Math.cos(baitAngle);
        const sinB = Math.sin(baitAngle);
        moveAngle = Math.atan2(
          sinA * (1 - pullStrength) + sinB * pullStrength,
          cosA * (1 - pullStrength) + cosB * pullStrength
        );
        roach.speed = roach.baseSpeed * 1.3;
      }
    }

    // 正常移动
    // 应用风扇减速效果
    const fanMultiplier = roach.fanSlowTimer > 0 ? (1 - roach.fanSlowFactor) : 1;
    const effectiveSpeed = roach.speed * fanMultiplier;

    // ===== 医院专属：护士蟑螂跟随移动 =====
    // 护士蟑螂跟随最近的非常友盟友，在X和Y轴上移动
    // 如果没有其他蟑螂存在，护士停留在原地
    if (roach.type === RoachType.NURSE) {
      // 查找最近的非常友盟友
      let nearest: Roach | null = null;
      let nearestDist = Infinity;
      for (const other of this.roaches) {
        if (other.id === roach.id) continue;
        if (other.state !== RoachState.ALIVE) continue;
        if (other.type === RoachType.NURSE) continue; // 不跟随其他护士
        const dx = other.x - roach.x;
        const dy = other.y - roach.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = other;
        }
      }
      if (nearest && nearestDist > 40) {
        // 向最近的盟友移动，在X和Y轴上
        const followAngle = Math.atan2(nearest.y - roach.y, nearest.x - roach.x);
        const followSpeed = roach.speed * 0.5; // 护士跟随时以50%速度移动
        roach.vx = Math.cos(followAngle) * followSpeed * 65;
        // 跟随Y轴：向最近盟友的Y位置移动
        roach.vy = Math.sin(followAngle) * followSpeed * 65;
      } else if (nearest && nearestDist <= 40) {
        // 足够接近盟友，停止移动
        roach.vx = 0;
        roach.vy = 0;
      } else {
        // 没有其他蟑螂，停留在原地
        roach.vx = 0;
        roach.vy = 0;
      }
    } else if (roach.type === RoachType.MUTANT && roach.transformTimer && roach.transformTimer > 0) {
      // 变异体转换期间：完全冻结移动
      roach.vx = 0;
      roach.vy = 0;
    } else if (roach.type === RoachType.TIMED_SUICIDE && roach.placeTimer && roach.placeTimer > 0) {
      // 定时自杀蟑螂放置炸弹：冻结移动
      roach.vx = 0;
      roach.vy = 0;
    } else if (roach.spawnImmuneTimer && roach.spawnImmuneTimer > 0) {
      // 变异体生成：在1秒生成免疫期间冻结在原地
      roach.vx = 0;
      roach.vy = 0;
    } else {
      roach.vx = Math.cos(moveAngle) * effectiveSpeed * 65;
      roach.vy = Math.sin(moveAngle) * effectiveSpeed * 65;
    }
    
    // 最小向下速度：确保地面蟑螂始终向防线前进
    // 防止软锁，避免蟑螂因接近零的vy而卡住
    // 护士蟑螂除外：护士只横向移动，从不向前
    // 定时自杀蟑螂在炸弹放置期间除外：必须保持在放置点冻结
    if (!isImmobilized && roach.type !== RoachType.FLYING && roach.type !== RoachType.FLYING_SUICIDE && roach.type !== RoachType.NURSE && !(roach.type === RoachType.TIMED_SUICIDE && roach.placeTimer && roach.placeTimer > 0) && roach.vy < 10) {
      roach.vy = 10; // 最小10px/s向下
    }

    // 自杀/小/定时自杀蟑螂：被火焰击中时高速横向躲避
    if ((roach.type === RoachType.SUICIDE || roach.type === RoachType.SMALL) && roach.dodgeTimer > 0) {
      roach.dodgeTimer -= this.config.deltaTime;
      if (roach.dodgeTimer <= 0) {
        roach.dodgeDir = 0;
      } else {
        // 高速横向躲避（远离火焰的侧向移动）
        let dodgeSpeed: number;
        if (roach.isSplitChild) {
          dodgeSpeed = 250; // 分裂子体：最快的不规则躲避
        } else if (roach.type === RoachType.SMALL) {
          dodgeSpeed = 180; // 普通小蟑螂：快速灵活的躲避
        } else {
          dodgeSpeed = 100; // 自杀/定时自杀：持续的躲避
        }
        const fanMult = roach.fanSlowTimer > 0 ? (1 - roach.fanSlowFactor) : 1;
        dodgeSpeed *= fanMult;
        roach.vx = roach.dodgeDir * dodgeSpeed;
        // 火焰墙阻挡在躲避期间
        const dodgeFireWalls = this.onGetFireWalls?.();
        if (dodgeFireWalls) {
          for (const wall of dodgeFireWalls) {
            if (roach.x >= wall.x1 && roach.x <= wall.x2) {
              const wallTop = wall.y - wall.height * 0.5;
              if (roach.y > wallTop && roach.y < wallTop + wall.height + 5 && roach.vy > 0) {
                roach.y = wallTop;
                roach.vy = 0;
              }
            }
          }
        }
        // 风扇在躲避期间推动
        if (roach.fanPushY < 0 && roach.y >= this.config.canvasHeight / 2 && roach.armorHp <= 0) {
          roach.y += roach.fanPushY * this.config.deltaTime;
          roach.y = Math.max(this.config.canvasHeight / 2, roach.y);
        }
        // 边缘停止
        const edgeMargin = 50;
        if ((roach.x <= edgeMargin && roach.dodgeDir < 0) || (roach.x >= this.config.canvasWidth - edgeMargin && roach.dodgeDir > 0)) {
          roach.dodgeDir = 0;
          roach.dodgeTimer = 0;
        }
      }
    }

    roach.x += roach.vx * this.config.deltaTime;
    roach.y += roach.vy * this.config.deltaTime;
    roach.angle = moveAngle;

    // 如果蟑螂远离屏幕，将它们拉回屏幕内
    // （防止所有可见蟑螂死亡但有些卡在屏幕外导致软锁）
    const margin = 100;
    if (roach.x < -margin) roach.x += 80 * this.config.deltaTime;
    if (roach.x > this.config.canvasWidth + margin) roach.x -= 80 * this.config.deltaTime;
    if (roach.y < -margin) roach.y += 80 * this.config.deltaTime;
    // Y方向底部保护：如果蟑螂掉落太远，强制防线突破
    if (roach.y > this.config.canvasHeight + margin * 2) {
      roach.y = this.config.defenseLineY + 50; // 传送到防线立即突破
    }

    // 火焰墙阻挡地面蟑螂（飞行蟑螂可以飞过）
    if (roach.type !== RoachType.FLYING && roach.type !== RoachType.FLYING_SUICIDE) {
      const fireWalls = this.onGetFireWalls?.();
      if (fireWalls) {
        for (const wall of fireWalls) {
          if (roach.x >= wall.x1 && roach.x <= wall.x2) {
            const wallTop = wall.y - wall.height * 0.5;
            // 如果蟑螂试图从上方越过墙
            if (roach.y > wallTop && roach.y < wallTop + wall.height + 5 && roach.vy > 0) {
              // 阻挡移动 - 推回墙上方
              roach.y = wallTop;
              roach.vy = 0;
            }
          }
        }
      }
    }

    // 应用风扇向上推动（将蟑螂向后吹）
    // 装甲增益：装甲蟑螂免疫风扇推动（但仍然减速）
    if (roach.fanPushY < 0 && roach.y >= this.config.canvasHeight / 2 && roach.armorHp <= 0) {
      roach.y += roach.fanPushY * this.config.deltaTime;
      roach.y = Math.max(this.config.canvasHeight / 2, roach.y);
    }

    // 钳制X位置：地面蟑螂保持在透视梯形边界内，
    // 飞行蟑螂使用屏幕边缘边距
    if (roach.type === RoachType.FLYING || roach.type === RoachType.FLYING_SUICIDE) {
      const edgeMargin = Math.max(40, roachSize * 0.8);
      roach.x = Math.max(edgeMargin, Math.min(this.config.canvasWidth - edgeMargin, roach.x));
    } else {
      // 透视：左/右边界取决于当前Y位置
      const [gLeft, gRight] = this.getGroundBoundsAtY(roach.y);
      roach.x = Math.max(gLeft + 5, Math.min(gRight - 5, roach.x));
    }

    // 翅膀动画
    roach.animTimer += this.config.deltaTime;
    if (roach.animTimer > 0.12) {
      roach.animTimer = 0;
      roach.animFrame = (roach.animFrame + 1) % 4;
    }
  }
  
  /**
   * 更新特殊蟑螂行为
   * @param roach 蟑螂对象
   */
  private updateSpecialRoachBehavior(roach: Roach): void {
    switch (roach.type) {
      case RoachType.SUICIDE:
      case RoachType.FLYING_SUICIDE:
        this.updateSuicideRoach(roach);
        break;
        
      case RoachType.SPLITTING:
        this.updateSplittingRoach(roach);
        break;
        
      case RoachType.ARMORED:
        this.updateArmoredRoach(roach);
        break;
        
      case RoachType.NURSE:
        this.updateNurseRoach(roach);
        break;
        
      case RoachType.MUTANT:
        this.updateMutantRoach(roach);
        break;
        
      case RoachType.TIMED_SUICIDE:
        this.updateTimedSuicideRoach(roach);
        break;
        
      case RoachType.QUEEN:
        this.updateQueenRoach(roach);
        break;
        
      case RoachType.FLYING:
        this.updateFlyingRoach(roach);
        break;
        
      case RoachType.LARGE:
        this.updateLargeRoach(roach);
        break;
        
      case RoachType.SMALL:
        this.updateSmallRoach(roach);
        break;
    }
  }
  
  /**
   * 更新自杀蟑螂行为
   * @param roach 自杀蟑螂
   */
  private updateSuicideRoach(roach: Roach): void {
    // 自杀/飞行自杀蟑螂：接近防线时激活引信
    const distToDefense = this.config.defenseLineY - roach.y;
    
    // 飞行自杀触发引信更接近防线（80px），确保在到达防线前爆炸
    const fuseTriggerDist = (roach.type === RoachType.FLYING_SUICIDE) ? 80 : 150;
    
    if (distToDefense < fuseTriggerDist) {
      // 无速度提升 - 保持向防线前进的基础速度
      roach.isFused = true;
      roach.fuseTimer -= this.config.deltaTime;
      
      // 引信视觉效果
      if (Math.random() < 0.3) {
        this.addParticle?.({
          x: roach.x + (Math.random() - 0.5) * 10,
          y: roach.y + (Math.random() - 0.5) * 10,
          vx: 0, vy: -20,
          life: 0.3, maxLife: 0.3,
          size: 3, color: '#ff4400',
          type: 'spark',
        });
      }
      
      if (roach.fuseTimer <= 0) {
        // 触发爆炸
        roach.state = RoachState.DEAD;
        roach.deathTimer = 0.5;
        this.onTriggerBreachExplosion?.(roach);
      }
    }
  }
  
  /**
   * 更新分裂蟑螂行为
   * @param roach 分裂蟑螂
   */
  private updateSplittingRoach(roach: Roach): void {
    // 死亡时分裂（而不是低血量时）
    if (roach.state === RoachState.DEAD && !roach.hasSplit) {
      roach.hasSplit = true;
      roach.deathTimer = 0.5; // 缩短死亡动画时间
      
      // 生成5个小蟑螂
      const smallRoaches: Roach[] = [];
      for (let s = 0; s < 5; s++) {
        const angle = (s / 5) * Math.PI * 2;
        const spawnX = roach.x + Math.cos(angle) * 50;
        const spawnY = roach.y + Math.sin(angle) * 30;
        
        const smallRoach = this.createSmallRoachFromSplit(spawnX, spawnY);
        smallRoaches.push(smallRoach);
      }
      
      // 触发分裂事件
      this.onRoachSplit?.(roach, smallRoaches);
      
      // 添加分裂文本
      this.addFloatingText?.(roach.x, roach.y - 30, '分裂x5!', '#ff8800');
    }
  }
  
  /**
   * 更新装甲蟑螂行为
   * @param roach 装甲蟑螂
   */
  private updateArmoredRoach(roach: Roach): void {
    // 装甲值自然衰减（随时间缓慢减少）
    if (roach.armorHp > 0) {
      roach.armorHp = Math.max(0, roach.armorHp - 0.5 * this.config.deltaTime);
      
      // 检查装甲是否刚刚破碎
      if (roach.armorHp <= 0 && !roach.isArmorBroken) {
        roach.isArmorBroken = true;
        
        // 生成装甲破碎粒子效果
        this.spawnSparkParticles?.(roach.x, roach.y, 8);
        
        // 显示装甲破碎文本
        const label = roach.type === RoachType.NURSE ? '护甲碎裂!' : 
                     roach.type === RoachType.TIMED_SUICIDE ? '护甲碎裂!' : '破甲!';
        this.addFloatingText?.(roach.x, roach.y - 30, label, '#fbbf24');
        
        // 触发装甲破碎事件
        this.onArmorBroken?.(roach);
      }
    }
    
    // 装甲破碎后的特殊行为
    if (roach.isArmorBroken) {
      // 装甲破碎后移动速度略微降低
      roach.speed = roach.baseSpeed * 0.8;
      
      // 装甲破碎后更容易被击退
      roach.fanSlowFactor = Math.min(roach.fanSlowFactor * 1.5, 0.8);
    }
  }
  
  /**
   * 更新护士蟑螂行为
   * @param roach 护士蟑螂
   */
  private updateNurseRoach(roach: Roach): void {
    // 医院专属：护士蟑螂"非法行医"AOE治疗
    // 三阶段状态机：空闲 → 充能(1.0s) → 喷洒(2.0s) → 消散(1.0s)
    const healRange = 360; // 6个瓦片 ~ 360px（加倍）
    
    // 初始化阶段如果未设置
    if (!roach.healPhase) {
      roach.healPhase = 'idle';
      roach.healTimer = 1; // 1秒冷却
    }
    
    // 状态机更新
    switch (roach.healPhase) {
      case 'idle': {
        // 倒计时直到下一次治疗
        roach.healTimer! -= this.config.deltaTime;
        if (roach.healTimer! <= 0) {
          // 检查范围内是否有受伤的盟友
          let hasWounded = false;
          for (const other of this.roaches) {
            if (other.id === roach.id) continue;
            if (other.state !== RoachState.ALIVE) continue;
            const d = Math.sqrt((other.x - roach.x) ** 2 + (other.y - roach.y) ** 2);
            if (d < healRange && other.hp < other.maxHp) {
              hasWounded = true;
              break;
            }
          }
          
          if (hasWounded) {
            // 进入充能阶段 - 播放施法音效
            roach.healPhase = 'charging';
            roach.healPhaseTimer = 1.0; // 延长到1秒以提高可见性
            this.onPlaySound?.('nurse_cast');
            
            // 施法指示器文本
            this.addFloatingText?.(roach.x, roach.y - 50, '非法行医!', '#5a8a5a');
          } else {
            // 没有受伤的盟友，重置计时器
            roach.healTimer! = 1;
          }
        }
        break;
      }
      
      case 'charging': {
        // 阶段1：充能（1.0秒）- 立即执行实际治疗（不是在充能结束时）
        let healedCount = 0;
        for (const other of this.roaches) {
          if (other.id === roach.id) continue;
          if (other.state !== RoachState.ALIVE) continue;
          const d = Math.sqrt((other.x - roach.x) ** 2 + (other.y - roach.y) ** 2);
          if (d < healRange && other.hp < other.maxHp) {
            const healAmount = Math.floor(other.maxHp * 0.20); // 20%最大HP
            const actualHeal = Math.min(healAmount, other.maxHp - other.hp);
            if (actualHeal > 0) {
              other.hp += actualHeal;
              other.healBuffTimer = 2.0; // 绿色色调 + 加号持续时间
              healedCount++;
              // 浮动治疗文本
              this.addFloatingText?.(other.x, other.y - 30, `+${actualHeal}`, '#5a8a5a', 1200);
            }
          }
        }
        
        if (healedCount > 0) {
          this.addFloatingText?.(roach.x, roach.y - 50, '治疗喷射!', '#5a8a5a');
        }
        
        // 充能视觉计时器
        roach.healPhaseTimer! -= this.config.deltaTime;
        if (roach.healPhaseTimer! <= 0) {
          // 进入喷洒阶段（仅视觉）
          roach.healPhase = 'spraying';
          roach.healPhaseTimer = 2.0; // 视觉持续时间
        }
        break;
      }
      
      case 'spraying': {
        // 阶段2：喷洒雾（2.0秒）- 仅视觉，治疗已经完成
        roach.healPhaseTimer! -= this.config.deltaTime;
        if (roach.healPhaseTimer! <= 0) {
          // 进入消散阶段
          roach.healPhase = 'dissipating';
          roach.healPhaseTimer = 1.0; // 延长以提高可见性
        }
        break;
      }
      
      case 'dissipating': {
        // 阶段3：消散（1.0秒）
        roach.healPhaseTimer! -= this.config.deltaTime;
        if (roach.healPhaseTimer! <= 0) {
          // 回到空闲状态
          roach.healPhase = 'idle';
          roach.healTimer = 1; // 1秒冷却
        }
        break;
      }
    }
    
    // 跟踪治疗目标以进行移动
    let bestTarget: Roach | null = null;
    let bestHpRatio = 1.0;
    for (const other of this.roaches) {
      if (other.id === roach.id) continue;
      if (other.state !== RoachState.ALIVE) continue;
      const d = Math.sqrt((other.x - roach.x) ** 2 + (other.y - roach.y) ** 2);
      if (d < healRange && other.hp < other.maxHp) {
        const hpRatio = other.hp / other.maxHp;
        if (hpRatio < bestHpRatio) {
          bestHpRatio = hpRatio;
          bestTarget = other;
        }
      }
    }
    roach.healTargetId = bestTarget ? bestTarget.id : null;
  }
  
  /**
   * 更新变异体蟑螂行为
   * @param roach 变异体蟑螂
   */
  private updateMutantRoach(roach: Roach): void {
    // 死亡时触发转换动画
    if (roach.state === RoachState.DEAD && !this.mutantTransformActive) {
      this.mutantTransformActive = true;
      this.mutantTransformTimer = 0.2;
      this.mutantTransformFrame = 0;
      
      // 显示变异转换文本
      this.addFloatingText?.(roach.x, roach.y - 40, '变异体转换中...', '#a855f7', 2000);
    }
    
    // 转换动画期间：完全冻结移动
    if (this.mutantTransformActive) {
      roach.vx = 0;
      roach.vy = 0;
      
      // 更新转换动画
      this.updateMutantTransform();
      
      // 如果动画完成，触发胚胎蟑螂生成
      if (!this.mutantTransformActive) {
        this.spawnEmbryoRoaches?.(roach);
      }
    }
  }
  
  /**
   * 更新定时自杀蟑螂行为
   * @param roach 定时自杀蟑螂
   */
  private updateTimedSuicideRoach(roach: Roach): void {
    // ===== 定时自杀蟑螂："螂家爆破"防线突破系统 =====
    // 三阶段：警告 → 蹲伏 → 爆炸 + 残留物
    const dl = this.config.defenseLineY;
    const distToDefense = dl - roach.y;
    
    // 初始化阶段如果未设置
    if (!roach.breachPhase) roach.breachPhase = 'idle';
    
    // 分支B：火焰杀死 - 安静死亡，无爆炸
    if (roach.hp <= 0 && roach.breachPhase !== 'idle') {
      roach.isFlameKilled = true;
      roach.state = RoachState.DEAD;
      roach.deathTimer = 1.0;
      roach.breachPhase = 'residue';
      roach.residueTimer = 2.0;
      this.addFloatingText?.(roach.x, roach.y - 30, '炸弹没响...', '#666');
      return;
    }
    
    // 分支A：粘性板冻结 - 暂停一切
    if (roach.stuckTimer > 0 && roach.breachPhase !== 'idle') {
      roach.isFrozen = true;
      // 冻结期间暂停计时器
      return;
    } else {
      roach.isFrozen = false;
    }
    
    // 阶段转换：空闲 → 警告当距离防线200px内
    if (roach.breachPhase === 'idle' && distToDefense <= 200) {
      roach.breachPhase = 'warning';
      roach.breachPhaseTimer = 0.5; // 警告持续到蹲伏前
      roach.crackRadius = 0;
    }
    
    // 状态机
    switch (roach.breachPhase) {
      case 'warning': {
        // 阶段1：危险警告（蹲伏前0.5秒）
        // 速度减少50%
        roach.speed = roach.baseSpeed * 0.5;
        // 当更接近时前进到蹲伏
        if (distToDefense <= 80) {
          roach.breachPhase = 'crouching';
          roach.breachPhaseTimer = 3.0; // 3秒倒计时
          roach.placeTimer = 3.0; // 倒计时计时器
          roach.hasPlacedBomb = true;
          this.addFloatingText?.(roach.x, roach.y - 50, '螂家爆破!', '#8b2020');
        }
        break;
      }
      
      case 'crouching': {
        // 阶段2：蹲伏 + 最终倒计时
        // 完全冻结
        roach.vx = 0;
        roach.vy = 0;
        // 清除持续伤害（放置期间无敌）
        roach.burnDamage = 0;
        roach.poisonTimer = 0;
        roach.inFire = false;
        roach.damageFlash = 0;
        
        // 倒计时
        roach.breachPhaseTimer! -= this.config.deltaTime;
        roach.placeTimer! -= this.config.deltaTime;
        
        // 裂缝半径增长（蹲伏期间0→60px）
        roach.crackRadius = Math.min(60, (3.0 - roach.breachPhaseTimer!) / 3.0 * 60);
        
        // 倒计时浮动文本
        const secs = Math.ceil(roach.placeTimer!);
        if (roach.placeTimer! > 0 && Math.abs(roach.placeTimer! - secs) < 0.05 && secs <= 3) {
          this.addFloatingText?.(roach.x, roach.y - 35, `${secs}`, secs <= 1 ? '#8b2020' : '#a05030');
        }
        
        // 倒计时达到0时爆炸
        if (roach.placeTimer! <= 0) {
          roach.breachPhase = 'exploding';
          roach.breachPhaseTimer = 0.4; // 0.4秒屏幕震动
          this.onTriggerBreachExplosion?.(roach);
        }
        break;
      }
      
      case 'exploding': {
        // 阶段3：爆炸（0.4秒屏幕震动）
        this.onPlaySound?.('suicide_explode');
        this.onVibrate?.('suicide_explode');
        this.addFloatingText?.(roach.x, roach.y - 35, 'BOOM!', '#ef4444');
        roach.breachPhaseTimer! -= this.config.deltaTime;
        if (roach.breachPhaseTimer! <= 0) {
          roach.breachPhase = 'residue';
          roach.residueTimer = 3.0; // 3秒残留物
          roach.state = RoachState.DEAD;
          roach.deathTimer = 3.0;
        }
        break;
      }
      
      case 'residue': {
        // 阶段4：残留物消退
        roach.residueTimer! -= this.config.deltaTime;
        if (roach.residueTimer! <= 0) {
          roach.deathTimer = 0; // 移除
        }
        break;
      }
    }
    
    // 遗留：处理旧的放置炸弹（仅清理）
    if (roach.type === RoachType.TIMED_SUICIDE && roach.state === RoachState.ALIVE && 
        !roach.hasPlacedBomb && !(roach.breachPhase && roach.breachPhase !== 'idle')) {
      const roachSize = ENEMY_DEFS[roach.type].size;
      const roachBottom = roach.y + roachSize * 0.4;
      const placeY = dl - 64;
      
      if (roachBottom >= placeY) {
        // 遗留回退：旧炸弹放置
        if (roach.placeTimer === 0) {
          roach.placeTimer = 2.0;
        }
        roach.vx = 0;
        roach.vy = 0;
        roach.burnDamage = 0;
        roach.poisonTimer = 0;
        roach.poisonDamage = 0;
        roach.inFire = false;
        roach.damageFlash = 0;
        roach.placeTimer! -= this.config.deltaTime;
        
        if (roach.placeTimer! <= 0) {
          roach.hasPlacedBomb = true;
          this.addFloatingText?.(roach.x, placeY - 30, '炸弹已安放!', '#ef4444');
          
          // 变身大蟑螂
          roach.type = RoachType.LARGE;
          roach.size = ENEMY_DEFS[RoachType.LARGE].size;
          roach.speed = ENEMY_DEFS[RoachType.LARGE].speed;
          roach.baseSpeed = ENEMY_DEFS[RoachType.LARGE].speed;
          this.addFloatingText?.(roach.x, roach.y - 45, '变身大蟑螂!', '#fbbf24');
        }
      }
    }
  }
  
  /**
   * 检查蟑螂是否被粘性板困住
   * @param roachId 蟑螂ID
   * @returns 是否被困住
   */
  private isStuckByBoard(roachId: number): boolean {
    const stickyBoards = this.onGetStickyBoards?.();
    if (!stickyBoards) return false;
    for (const board of stickyBoards) {
      if (board.stuckRoaches.includes(roachId)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * 开始变异体转换动画
   */
  startMutantTransform(): void {
    this.mutantTransformActive = true;
    this.mutantTransformTimer = 0.2;
    this.mutantTransformFrame = 0;
  }
  
  /**
   * 获取当前变异体转换动画状态
   * @returns 动画状态
   */
  getMutantTransformState(): {
    active: boolean;
    frame: number;
    timer: number;
  } {
    return {
      active: this.mutantTransformActive,
      frame: this.mutantTransformFrame,
      timer: this.mutantTransformTimer,
    };
  }

  /**
   * 根据Y坐标获取地面边界
   * @description 计算透视效果下的地面左右边界
   * @param y Y坐标
   * @returns [leftX, rightX] 左右边界
   */
  getGroundBoundsAtY(y: number): [number, number] {
    const [farL, farLY, farR, farRY, midL, midLY, midR, midRY, nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[this.config.currentScene];
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
   * 创建分裂产生的小蟑螂
   * @param x X坐标
   * @param y Y坐标
   * @returns 小蟑螂对象
   */
  private createSmallRoachFromSplit(x: number, y: number): Roach {
    const isHard = this.config.difficulty === 'hard';
    return {
      id: 0, x, y, vx: 0, vy: 0,
      type: RoachType.SMALL,
      hp: isHard ? 1 : 1,
      maxHp: isHard ? 1 : 1,
      state: RoachState.ALIVE,
      speed: (isHard ? 2.4 : 1.6) * (0.5 + Math.random() * 0.5),
      baseSpeed: isHard ? 2.4 : 1.6,
      burnDamage: 0, inFire: false,
      angle: 0, wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 2 + Math.random() * 2,
      isEnraged: false, deathTimer: 0, animFrame: 0, animTimer: 0,
      panicTimer: 0, panicAngle: 0, stunTimer: 0, isStunned: false,
      facingRight: true,
      altitude: 0, wingPhase: 0, armorHp: 0, maxArmorHp: 0,
      hasSplit: false, fuseTimer: 0, isFused: false,
      spawnTimer: 0, isBoss: false, isCharging: false,
      stuckTimer: 0, poisonTimer: 0, poisonDamage: 0,
      fanSlowTimer: 0, fanSlowFactor: 0, fanPushY: 0,
      wrappedByDropId: null, wrapTimer: 0, damageFlash: 0,
      dodgeDir: 0, dodgeTimer: 0, wasDodging: false,
      isSplitChild: true,
    };
  }
  
  /**
   * 更新皇后蟑螂行为
   * @param roach 皇后蟑螂
   */
  private updateQueenRoach(roach: Roach): void {
    // 皇后蟑螂：定期产卵生成小蟑螂
    if (!roach.spawnTimer) {
      roach.spawnTimer = 5.0; // 每5秒产卵一次
    }
    
    roach.spawnTimer -= this.config.deltaTime;
    if (roach.spawnTimer <= 0) {
      roach.spawnTimer = 5.0;
      // 触发产卵事件
      this.onQueenSpawn?.(roach);
    }
  }
  
  /**
   * 更新飞行蟑螂行为
   * @param roach 飞行蟑螂
   */
  private updateFlyingRoach(roach: Roach): void {
    // 飞行蟑螂：死亡时坠落并分解
    if (roach.state === RoachState.DEAD) {
      // 生成翅膀碎片粒子
      this.generateWingDebrisParticles?.(roach);
    }
  }
  
  /**
   * 更新大蟑螂行为
   * @param roach 大蟑螂
   */
  private updateLargeRoach(roach: Roach): void {
    // 大蟑螂：更高的生命值，但移动较慢
    // 没有特殊行为，只有基础属性差异
  }
  
  /**
   * 更新小蟑螂行为
   * @param roach 小蟑螂
   */
  private updateSmallRoach(roach: Roach): void {
    // 小蟑螂：快速移动但生命值低
    // 分裂产生的小蟑螂有特殊标记
    if (roach.isSplitChild) {
      // 分裂子体：更快的移动速度和更随机的移动模式
      roach.wobbleSpeed = 3 + Math.random() * 3;
    }
  }
  
  /** 皇后产卵事件回调 */
  onQueenSpawn?: (queenRoach: Roach) => void;
  
  /** 生成翅膀碎片粒子回调 */
  generateWingDebrisParticles?: (roach: Roach) => void;
  
  /**
   * 生成爆炸粒子效果
   * @param x X坐标
   * @param y Y坐标
   * @param intensity 爆炸强度（1-10）
   */
  generateExplosionParticles(x: number, y: number, intensity: number = 5): void {
    const particleCount = Math.floor(intensity * 15);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      const life = 0.5 + Math.random() * 0.5;
      
      // 爆炸核心粒子（橙色/红色）
      this.addParticle?.({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30, // 向上偏移
        life: life,
        maxLife: life,
        size: 3 + Math.random() * 5,
        color: `rgba(${255 - Math.random() * 50}, ${100 + Math.random() * 100}, 50, 0.8)`,
        type: 'explosion'
      });
      
      // 烟雾粒子（灰色）
      if (i % 3 === 0) {
        this.addParticle?.({
          x: x + (Math.random() - 0.5) * 30,
          y: y + (Math.random() - 0.5) * 30,
          vx: Math.cos(angle) * speed * 0.5,
          vy: Math.sin(angle) * speed * 0.5 - 20,
          life: life * 1.5,
          maxLife: life * 1.5,
          size: 4 + Math.random() * 6,
          color: `rgba(100, 100, 100, 0.6)`,
          type: 'smoke'
        });
      }
    }
  }
  
  /**
   * 生成火花粒子效果
   * @param x X坐标
   * @param y Y坐标
   * @param count 粒子数量
   */
  generateSparkParticles(x: number, y: number, count: number = 8): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 70;
      const life = 0.3 + Math.random() * 0.3;
      
      this.addParticle?.({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: life,
        maxLife: life,
        size: 2 + Math.random() * 3,
        color: '#ff4400',
        type: 'spark'
      });
    }
  }
  
  /**
   * 生成治疗粒子效果
   * @param x X坐标
   * @param y Y坐标
   * @param count 粒子数量
   */
  generateHealParticles(x: number, y: number, count: number = 12): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      const life = 0.8 + Math.random() * 0.4;
      
      this.addParticle?.({
        x: x + (Math.random() - 0.5) * 15,
        y: y + (Math.random() - 0.5) * 15,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        life: life,
        maxLife: life,
        size: 3 + Math.random() * 4,
        color: '#4ade80',
        type: 'heal'
      });
    }
  }
  
  /**
   * 生成毒雾粒子效果
   * @param x X坐标
   * @param y Y坐标
   * @param count 粒子数量
   */
  generatePoisonParticles(x: number, y: number, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 30;
      const life = 1.0 + Math.random() * 0.5;
      
      this.addParticle?.({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 10,
        life: life,
        maxLife: life,
        size: 4 + Math.random() * 5,
        color: '#a855f7',
        type: 'poison'
      });
    }
  }
  
  /** 添加粒子回调 */
  addParticle?: (particle: any) => void;
}