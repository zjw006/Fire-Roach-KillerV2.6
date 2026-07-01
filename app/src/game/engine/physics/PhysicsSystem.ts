/**
 * @fileoverview 游戏物理系统
 * @description 负责管理游戏中的物理效果，包括碰撞检测、运动模拟等
 */

import type { Vec2, Roach, Particle, FireZone, StickyBoard, StickyDrop, FireWall } from '../../types';

/**
 * 物理系统类
 * @description 管理游戏中的物理效果
 */
export class PhysicsSystem {
  private gravity: number = 980; // 像素/秒²
  private friction: number = 0.95;
  private airResistance: number = 0.99;
  
  /**
   * 构造函数
   * @param {number} gravity - 重力加速度
   * @param {number} friction - 地面摩擦力
   * @param {number} airResistance - 空气阻力
   */
  constructor(
    gravity: number = 980,
    friction: number = 0.95,
    airResistance: number = 0.99
  ) {
    this.gravity = gravity;
    this.friction = friction;
    this.airResistance = airResistance;
  }

  /**
   * 更新实体位置
   * @param {Roach} entity - 实体对象
   * @param {number} deltaTime - 时间增量
   */
  updateEntityPosition(entity: Roach, deltaTime: number): void {
    // 更新速度
    entity.vx *= this.airResistance;
    entity.vy += this.gravity * deltaTime;
    
    // 更新位置
    entity.x += entity.vx * deltaTime;
    entity.y += entity.vy * deltaTime;
    
    // 边界检查
    this.checkBoundaries(entity);
  }

  /**
   * 更新粒子位置
   * @param {Particle} particle - 粒子对象
   * @param {number} deltaTime - 时间增量
   */
  updateParticlePosition(particle: Particle, deltaTime: number): void {
    // 更新位置
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    
    // 应用重力（使用系统重力）
    particle.vy += this.gravity * deltaTime;
    
    // 应用空气阻力
    particle.vx *= this.airResistance;
    particle.vy *= this.airResistance;
  }

  /**
   * 检查边界
   * @param {Roach} entity - 实体对象
   */
  checkBoundaries(entity: Roach): void {
    const groundY = 800; // 地面Y坐标
    
    // 检查是否碰到地面
    if (entity.y > groundY) {
      entity.y = groundY;
      entity.vy = -entity.vy * this.friction;
      entity.vx *= this.friction;
      
      // 如果速度很小，停止反弹
      if (Math.abs(entity.vy) < 10) {
        entity.vy = 0;
      }
    }
    
    // 检查左右边界
    const leftBoundary = 0;
    const rightBoundary = 540;
    
    if (entity.x < leftBoundary) {
      entity.x = leftBoundary;
      entity.vx = Math.abs(entity.vx) * this.friction;
    } else if (entity.x > rightBoundary) {
      entity.x = rightBoundary;
      entity.vx = -Math.abs(entity.vx) * this.friction;
    }
  }

  /**
   * 检查碰撞
   * @param {Roach} entity1 - 实体1
   * @param {Roach} entity2 - 实体2
   * @returns {boolean} 是否发生碰撞
   */
  checkCollision(entity1: Roach, entity2: Roach): boolean {
    const dx = entity1.x - entity2.x;
    const dy = entity1.y - entity2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const radius1 = entity1.size || 20;
    const radius2 = entity2.size || 20;
    
    return distance < (radius1 + radius2);
  }

  /**
   * 检查点与圆的碰撞
   * @param {Vec2} point - 点坐标
   * @param {Roach} circle - 圆形实体
   * @returns {boolean} 是否发生碰撞
   */
  checkPointCircleCollision(point: Vec2, circle: Roach): boolean {
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const radius = circle.size || 20;
    return distance < radius;
  }

  /**
   * 检查点与矩形的碰撞
   * @param {Vec2} point - 点坐标
   * @param {Vec2} rectPos - 矩形位置
   * @param {number} width - 矩形宽度
   * @param {number} height - 矩形高度
   * @returns {boolean} 是否发生碰撞
   */
  checkPointRectCollision(
    point: Vec2,
    rectPos: Vec2,
    width: number,
    height: number
  ): boolean {
    return (
      point.x >= rectPos.x &&
      point.x <= rectPos.x + width &&
      point.y >= rectPos.y &&
      point.y <= rectPos.y + height
    );
  }

  /**
   * 计算两点之间的距离
   * @param {Vec2} point1 - 点1
   * @param {Vec2} point2 - 点2
   * @returns {number} 距离
   */
  calculateDistance(point1: Vec2, point2: Vec2): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 计算两点之间的角度
   * @param {Vec2} from - 起点
   * @param {Vec2} to - 终点
   * @returns {number} 角度（弧度）
   */
  calculateAngle(from: Vec2, to: Vec2): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.atan2(dy, dx);
  }

  /**
   * 计算从角度和速度得到的向量
   * @param {number} angle - 角度（弧度）
   * @param {number} speed - 速度
   * @returns {Vec2} 向量
   */
  calculateVector(angle: number, speed: number): Vec2 {
    return {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };
  }

  /**
   * 应用冲量
   * @param {Roach} entity - 实体对象
   * @param {Vec2} impulse - 冲量向量
   */
  applyImpulse(entity: Roach, impulse: Vec2): void {
    entity.vx += impulse.x;
    entity.vy += impulse.y;
  }

  /**
   * 应用力
   * @param {Roach} entity - 实体对象
   * @param {Vec2} force - 力向量
   * @param {number} deltaTime - 时间增量
   */
  applyForce(entity: Roach, force: Vec2, deltaTime: number): void {
    entity.vx += force.x * deltaTime;
    entity.vy += force.y * deltaTime;
  }

  /**
   * 计算弹道轨迹
   * @param {Vec2} start - 起点
   * @param {number} angle - 发射角度（弧度）
   * @param {number} speed - 初始速度
   * @param {number} time - 时间
   * @returns {Vec2} 位置
   */
  calculateTrajectory(
    start: Vec2,
    angle: number,
    speed: number,
    time: number
  ): Vec2 {
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    
    return {
      x: start.x + vx * time,
      y: start.y + vy * time + 0.5 * this.gravity * time * time
    };
  }

  /**
   * 计算到达目标所需的角度
   * @param {Vec2} start - 起点
   * @param {Vec2} target - 目标点
   * @param {number} speed - 速度
   * @returns {number | null} 角度（弧度），如果无法到达则返回null
   */
  calculateAngleToTarget(
    start: Vec2,
    target: Vec2,
    speed: number
  ): number | null {
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    
    const g = this.gravity;
    const v2 = speed * speed;
    const discriminant = v2 * v2 - g * (g * dx * dx + 2 * dy * v2);
    
    if (discriminant < 0) {
      return null; // 无法到达目标
    }
    
    const sqrtDiscriminant = Math.sqrt(discriminant);
    const angle1 = Math.atan((v2 + sqrtDiscriminant) / (g * dx));
    const angle2 = Math.atan((v2 - sqrtDiscriminant) / (g * dx));
    
    // 返回较小的角度（更平的轨迹）
    return Math.min(angle1, angle2);
  }

  /**
   * 检查火焰区域与实体的碰撞
   * @param {FireZone} fireZone - 火焰区域
   * @param {Roach} entity - 实体对象
   * @returns {boolean} 是否发生碰撞
   */
  checkFireZoneCollision(fireZone: FireZone, entity: Roach): boolean {
    const dx = entity.x - fireZone.x;
    const dy = entity.y - fireZone.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const fireRadius = fireZone.radius || 50;
    const entityRadius = entity.size || 20;
    
    return distance < (fireRadius + entityRadius);
  }

  /**
   * 检查粘性板与实体的碰撞
   * @param {StickyBoard} stickyBoard - 粘性板
   * @param {Roach} entity - 实体对象
   * @returns {boolean} 是否发生碰撞
   */
  checkStickyBoardCollision(stickyBoard: StickyBoard, entity: Roach): boolean {
    // 矩形碰撞检测
    const entityRadius = entity.size || 20;
    const entityLeft = entity.x - entityRadius;
    const entityRight = entity.x + entityRadius;
    const entityTop = entity.y - entityRadius;
    const entityBottom = entity.y + entityRadius;
    
    const boardLeft = stickyBoard.x - stickyBoard.width / 2;
    const boardRight = stickyBoard.x + stickyBoard.width / 2;
    const boardTop = stickyBoard.y - stickyBoard.height / 2;
    const boardBottom = stickyBoard.y + stickyBoard.height / 2;
    
    return (
      entityRight > boardLeft &&
      entityLeft < boardRight &&
      entityBottom > boardTop &&
      entityTop < boardBottom
    );
  }

  /**
   * 检查粘性掉落物与实体的碰撞
   * @param {StickyDrop} stickyDrop - 粘性掉落物
   * @param {Roach} entity - 实体对象
   * @returns {boolean} 是否发生碰撞
   */
  checkStickyDropCollision(stickyDrop: StickyDrop, entity: Roach): boolean {
    const dx = entity.x - stickyDrop.x;
    const dy = entity.y - stickyDrop.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const dropRadius = 25; // 默认粘性掉落物半径
    const entityRadius = entity.size || 20;
    
    return distance < (dropRadius + entityRadius);
  }

  /**
   * 检查火焰墙与实体的碰撞
   * @param {FireWall} fireWall - 火焰墙
   * @param {Roach} entity - 实体对象
   * @returns {boolean} 是否发生碰撞
   */
  checkFireWallCollision(fireWall: FireWall, entity: Roach): boolean {
    // 火焰墙是水平方向的，检查Y坐标是否在火焰墙范围内
    const inYRange = entity.y >= fireWall.y - 20 && entity.y <= fireWall.y + 20;
    
    if (!inYRange) return false;
    
    // 检查X坐标是否在火焰墙长度范围内（x1到x2）
    const wallStartX = Math.min(fireWall.x1, fireWall.x2);
    const wallEndX = Math.max(fireWall.x1, fireWall.x2);
    
    return entity.x >= wallStartX && entity.x <= wallEndX;
  }

  /**
   * 计算反弹向量
   * @param {Vec2} velocity - 速度向量
   * @param {Vec2} normal - 法线向量
   * @returns {Vec2} 反弹后的速度向量
   */
  calculateBounce(velocity: Vec2, normal: Vec2): Vec2 {
    // 归一化法线
    const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    const nx = normal.x / length;
    const ny = normal.y / length;
    
    // 计算点积
    const dot = velocity.x * nx + velocity.y * ny;
    
    // 计算反弹
    return {
      x: velocity.x - 2 * dot * nx,
      y: velocity.y - 2 * dot * ny
    };
  }

  /**
   * 计算摩擦力
   * @param {Vec2} velocity - 速度向量
   * @param {number} frictionCoefficient - 摩擦系数
   * @param {number} deltaTime - 时间增量
   * @returns {Vec2} 摩擦力向量
   */
  calculateFriction(velocity: Vec2, frictionCoefficient: number, deltaTime: number): Vec2 {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    if (speed === 0) return { x: 0, y: 0 };
    
    const frictionMagnitude = frictionCoefficient * speed;
    const frictionX = -velocity.x / speed * frictionMagnitude * deltaTime;
    const frictionY = -velocity.y / speed * frictionMagnitude * deltaTime;
    
    return { x: frictionX, y: frictionY };
  }

  /**
   * 获取物理系统参数
   * @returns {Object} 物理系统参数
   */
  getParameters(): {
    gravity: number;
    friction: number;
    airResistance: number;
  } {
    return {
      gravity: this.gravity,
      friction: this.friction,
      airResistance: this.airResistance
    };
  }

  /**
   * 设置物理系统参数
   * @param {Object} params - 物理系统参数
   */
  setParameters(params: {
    gravity?: number;
    friction?: number;
    airResistance?: number;
  }): void {
    if (params.gravity !== undefined) this.gravity = params.gravity;
    if (params.friction !== undefined) this.friction = params.friction;
    if (params.airResistance !== undefined) this.airResistance = params.airResistance;
  }
}