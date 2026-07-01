/**
 * @fileoverview 蟑螂敌人AI系统模块
 * @description 负责管理游戏中所有蟑螂敌人的AI行为、移动逻辑和状态管理
 */

import { 
  type Roach, 
  RoachType, 
  RoachState, 
  GameState
} from '../../types';
import { ENEMY_DEFS } from '../../data';

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
  /** 玩家X坐标（用于某些AI行为） */
  playerX?: number;
  /** 玩家Y坐标（用于某些AI行为） */
  playerY?: number;
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
    
    // 恐慌移动
    if (roach.panicTimer > 0) {
      moveAngle = roach.panicAngle + Math.sin(this.config.deltaTime * 15 + roach.wobbleOffset) * 0.8;
    } else {
      // 正常移动：向防线前进，带有横向摆动
      const isFlying = roach.type === RoachType.FLYING || roach.type === RoachType.FLYING_SUICIDE;
      const wanderAmplitude = isFlying ? 80 : 30;
      const targetX = roach.x + Math.sin(roach.wobbleOffset + this.config.deltaTime * roach.wobbleSpeed) * wanderAmplitude;
      const roachBottom = roach.y + roachSize * 0.4;
      
      // 计算移动角度
      const dx = targetX - roach.x;
      const dy = this.config.defenseLineY - roachBottom;
      moveAngle = Math.atan2(dy, dx);
      
      // 飞行敌人特殊处理
      if (isFlying) {
        // 飞行敌人可以越过防线
        if (roachBottom >= this.config.defenseLineY - 50) {
          // 接近防线时尝试越过
          moveAngle = Math.PI / 2; // 向上飞
        }
      }
    }
    
    // 应用移动
    roach.vx = Math.cos(moveAngle) * roach.speed;
    roach.vy = Math.sin(moveAngle) * roach.speed;
    
    // 更新位置
    roach.x += roach.vx * this.config.deltaTime;
    roach.y += roach.vy * this.config.deltaTime;
    
    // 边界检查
    const margin = 20;
    if (roach.x < margin) roach.x = margin;
    if (roach.x > this.config.canvasWidth - margin) roach.x = this.config.canvasWidth - margin;
    if (roach.y < margin) roach.y = margin;
    if (roach.y > this.config.canvasHeight - margin) roach.y = this.config.canvasHeight - margin;
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
    }
  }
  
  /**
   * 更新自杀蟑螂行为
   * @param roach 自杀蟑螂
   */
  private updateSuicideRoach(roach: Roach): void {
    // 接近防线时自爆
    const roachBottom = roach.y + (roach.size || 30) * 0.4;
    if (roachBottom >= this.config.defenseLineY - 30) {
      roach.state = RoachState.DEAD;
      roach.deathTimer = 0.5;
      // TODO: 触发爆炸效果
    }
  }
  
  /**
   * 更新分裂蟑螂行为
   * @param roach 分裂蟑螂
   */
  private updateSplittingRoach(roach: Roach): void {
    // 低血量时分裂
    if (roach.hp <= roach.maxHp * 0.3 && !roach.hasSplit) {
      roach.hasSplit = true;
      // TODO: 生成小蟑螂
    }
  }
  
  /**
   * 更新装甲蟑螂行为
   * @param roach 装甲蟑螂
   */
  private updateArmoredRoach(roach: Roach): void {
    // 装甲值衰减
    if (roach.armorHp > 0) {
      roach.armorHp = Math.max(0, roach.armorHp - 0.5 * this.config.deltaTime);
    }
  }
  
  /**
   * 更新护士蟑螂行为
   * @param _roach 护士蟑螂
   */
  private updateNurseRoach(_roach: Roach): void {
    // 治疗附近友军（暂时注释，因为Roach接口中没有healCooldown属性）
    // if (roach.healCooldown > 0) {
    //   roach.healCooldown -= this.config.deltaTime;
    // } else {
    //   // TODO: 寻找需要治疗的友军
    //   roach.healCooldown = 3.0; // 治疗冷却时间
    // }
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
    }
  }
  
  /**
   * 更新定时自杀蟑螂行为
   * @param _roach 定时自杀蟑螂
   */
  private updateTimedSuicideRoach(_roach: Roach): void {
    // 放置炸弹计时器（暂时注释，因为Roach接口中没有placeTimer和bombTimer属性）
    // if (roach.placeTimer && roach.placeTimer > 0) {
    //   roach.placeTimer -= this.config.deltaTime;
    //   if (roach.placeTimer <= 0) {
    //     // 放置炸弹
    //     roach.hasPlacedBomb = true;
    //     // TODO: 生成炸弹
    //   }
    // }
    
    // 炸弹引爆计时器
    // if (roach.bombTimer && roach.bombTimer > 0) {
    //   roach.bombTimer -= this.config.deltaTime;
    //   if (roach.bombTimer <= 0) {
    //     // 引爆
    //     roach.state = RoachState.DEAD;
    //     roach.deathTimer = 0.5;
    //     // TODO: 触发大范围爆炸
    //   }
    // }
  }
  
  /**
   * 检查蟑螂是否被粘性板困住
   * @param _roachId 蟑螂ID
   * @returns 是否被困住
   */
  private isStuckByBoard(_roachId: number): boolean {
    // TODO: 实现粘性板检查逻辑
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
}