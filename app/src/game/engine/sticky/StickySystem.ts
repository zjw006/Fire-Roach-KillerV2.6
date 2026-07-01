/**
 * @fileoverview 粘性板系统模块
 * @description 负责管理游戏中粘性板和粘性弹丸的逻辑，包括自动瞄准、减速效果、伤害计算等
 */

import { 
  type StickyBoard,
  type StickyDrop,
  type Roach,
  RoachState,
  ParticleType
} from '../../types';

/**
 * 粘性板系统配置接口
 */
export interface StickySystemConfig {
  /** 时间增量 */
  deltaTime: number;
  /** 游戏时间 */
  gameTime: number;
  /** 添加浮动文字回调函数 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 添加粒子回调函数 */
  onAddParticle?: (particle: any) => void;
}

/**
 * 粘性板系统类
 * @description 管理游戏中粘性板和粘性弹丸的逻辑，包括自动瞄准、减速效果、伤害计算等
 */
export class StickySystem {
  /** 系统配置 */
  private config: StickySystemConfig;
  
  /** 粘性板数组 */
  private stickyBoards: StickyBoard[] = [];
  
  /** 粘性弹丸数组 */
  private stickyDrops: StickyDrop[] = [];
  
  /** 下一个粘性弹丸ID */
  private nextStickyDropId: number = 1;
  
  /**
   * 构造函数
   * @param config 系统配置
   */
  constructor(config: StickySystemConfig) {
    this.config = config;
  }
  
  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<StickySystemConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 添加粘性板
   * @param board 粘性板数据
   */
  addStickyBoard(board: StickyBoard): void {
    this.stickyBoards.push(board);
  }
  
  /**
   * 添加粘性弹丸
   * @param drop 粘性弹丸数据
   */
  addStickyDrop(drop: StickyDrop): void {
    this.stickyDrops.push(drop);
  }
  
  /**
   * 获取所有粘性板
   * @returns 粘性板数组
   */
  getStickyBoards(): StickyBoard[] {
    return [...this.stickyBoards];
  }
  
  /**
   * 获取所有粘性弹丸
   * @returns 粘性弹丸数组
   */
  getStickyDrops(): StickyDrop[] {
    return [...this.stickyDrops];
  }
  
  /**
   * 清除所有粘性板和弹丸
   */
  clearAll(): void {
    this.stickyBoards = [];
    this.stickyDrops = [];
  }
  
  /**
   * 更新粘性板逻辑
   * @param roaches 当前蟑螂数组
   * @returns 更新后的粘性板数组
   */
  updateStickyBoards(roaches: Roach[]): StickyBoard[] {
    const { deltaTime } = this.config;
    
    // 从后向前遍历，便于删除
    for (let i = this.stickyBoards.length - 1; i >= 0; i--) {
      const board = this.stickyBoards[i];
      board.life -= deltaTime;
      
      // 检查生命周期结束
      if (board.life <= 0) {
        // 释放被粘住的蟑螂
        for (const roachId of board.stuckRoaches) {
          const r = roaches.find(r => r.id === roachId);
          if (r && r.state === RoachState.ALIVE) {
            r.speed = r.baseSpeed; // 恢复速度
          }
        }
        this.stickyBoards.splice(i, 1);
        continue;
      }
      
      // 检查蟑螂进入粘性板区域
      const hitHalfW = board.hitWidth / 2;
      const hitHalfH = board.hitHeight / 2;
      
      for (const r of roaches) {
        if (r.state !== RoachState.ALIVE) continue;
        
        // 已经被这个粘性板粘住
        if (board.stuckRoaches.includes(r.id)) {
          // 保持蟑螂在碰撞区域内
          r.x = Math.max(board.x - hitHalfW + 10, Math.min(board.x + hitHalfW - 10, r.x));
          r.y = Math.max(board.y - hitHalfH + 10, Math.min(board.y + hitHalfH - 10, r.y));
          r.vx = 0;
          r.vy = 0;
          r.speed = 0;
          continue;
        }
        
        // 粘性板已满
        if (board.stuckRoaches.length >= board.maxStuck) continue;
        
        // 检查蟑螂是否在碰撞区域内
        if (r.x > board.x - hitHalfW && r.x < board.x + hitHalfW &&
            r.y > board.y - hitHalfH && r.y < board.y + hitHalfH) {
          board.stuckRoaches.push(r.id);
          r.speed = 0;
          r.vx = 0;
          r.vy = 0;
          
          // 只显示第一个被粘住的蟑螂的提示文字（减少视觉混乱）
          if (board.stuckRoaches.length === 1 && this.config.onAddFloatingText) {
            this.config.onAddFloatingText(r.x, r.y - 20, '粘住!', '#facc15');
          }
        }
      }
    }
    
    return this.stickyBoards;
  }
  
  /**
   * 更新粘性弹丸逻辑
   * @param roaches 当前蟑螂数组
   * @returns 更新后的粘性弹丸数组
   */
  updateStickyDrops(roaches: Roach[]): StickyDrop[] {
    const { deltaTime, gameTime } = this.config;
    
    // 从后向前遍历，便于删除
    for (let i = this.stickyDrops.length - 1; i >= 0; i--) {
      const drop = this.stickyDrops[i];
      drop.life -= deltaTime;
      
      // 预生成阶段（延迟阶段）
      if (drop.life > drop.maxLife) {
        // 仍在延迟阶段 - 在生成点做小的空闲动画
        drop.y += Math.sin(gameTime * 10 + drop.id) * 0.5;
        continue;
      }
      
      // 弹丸已过期
      if (drop.life <= 0) {
        // 释放被包裹的蟑螂（如果有）
        if (drop.targetId !== null) {
          const r = roaches.find(r => r.id === drop.targetId);
          if (r && r.state === RoachState.ALIVE) {
            r.wrappedByDropId = null;
            r.wrapTimer = 0;
            r.speed = r.baseSpeed; // 恢复速度
          }
        }
        this.stickyDrops.splice(i, 1);
        continue;
      }
      
      // 如果已经击中蟑螂，保持粘在蟑螂上
      if (drop.hit && drop.targetId !== null) {
        const target = roaches.find(r => r.id === drop.targetId);
        if (target && target.state === RoachState.ALIVE) {
          drop.x = target.x;
          drop.y = target.y;
          
          // 粘性板对Boss无效 - 完全跳过
          if (target.isBoss) {
            // 移除弹丸而不产生任何效果
            this.stickyDrops.splice(i, 1);
            continue;
          } else {
            // 普通蟑螂：在弹丸剩余生命周期内被固定（最多12秒）
            target.vx = 0;
            target.vy = 0;
            target.speed = 0;
            target.wrappedByDropId = drop.id;
            target.wrapTimer = drop.life;
          }
          
          // 周期性伤害（仅当没有护甲且不在放置炸弹时）
          if (Math.random() < deltaTime * 2 && 
              !(target.type === 'timed_suicide' && target.placeTimer && target.placeTimer > 0)) {
            if (target.armorHp > 0) {
              // 护甲阻挡粘性板伤害
              if (Math.random() < 0.1 && this.config.onAddFloatingText) {
                this.config.onAddFloatingText(target.x, target.y - 15, '护甲免疫', '#60a5fa');
              }
            } else {
              target.hp -= 0.5;
              target.damageFlash = 0.1;
            }
          }
          
          // 发射黄色粒子
          if (Math.random() < 0.1 && this.config.onAddParticle) {
            this.config.onAddParticle({
              x: target.x + (Math.random() - 0.5) * 20,
              y: target.y + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 20,
              vy: -10 - Math.random() * 20,
              life: 0.3,
              maxLife: 0.3,
              size: 2 + Math.random() * 3,
              color: `rgba(250, 200, 50, ${0.5 + Math.random() * 0.3})`,
              type: ParticleType.ICE
            });
          }
        } else {
          // 目标死亡 - 立即移除弹丸并清理
          if (target) {
            target.wrappedByDropId = null;
            target.wrapTimer = 0;
          }
          this.stickyDrops.splice(i, 1);
        }
        continue;
      }
      
      // 飞行阶段 - 寻找目标
      // 找到最近的存活且未被包裹的蟑螂
      let target: Roach | null = null;
      let minDist = Infinity;
      
      for (const r of roaches) {
        if (r.state !== RoachState.ALIVE) continue;
        if (r.wrappedByDropId !== null) continue; // 已经被包裹
        if (r.isBoss) continue; // 跳过Boss
        
        const dx = r.x - drop.x;
        const dy = r.y - drop.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        if (d < minDist && d < 400) { // 最大追踪范围
          minDist = d;
          target = r;
        }
      }
      
      if (target) {
        // 追踪行为
        const dx = target.x - drop.x;
        const dy = target.y - drop.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 使用目标的大小或默认值
        const targetSize = target.size || 40;
        
        if (dist < drop.size + targetSize) {
          // 击中目标
          drop.hit = true;
          drop.targetId = target.id;
          drop.vx = 0;
          drop.vy = 0;
          
          // 添加击中效果
          if (this.config.onAddFloatingText) {
            this.config.onAddFloatingText(target.x, target.y - 20, '粘住!', '#facc15');
          }
        } else {
          // 向目标移动
          const speed = drop.speed;
          const angle = Math.atan2(dy, dx);
          
          drop.vx = Math.cos(angle) * speed;
          drop.vy = Math.sin(angle) * speed;
          
          drop.x += drop.vx * deltaTime;
          drop.y += drop.vy * deltaTime;
        }
      } else {
        // 没有目标，继续直线飞行
        drop.x += drop.vx * deltaTime;
        drop.y += drop.vy * deltaTime;
      }
    }
    
    return this.stickyDrops;
  }
  
  /**
   * 生成新的粘性弹丸
   * @param x 起始X坐标
   * @param y 起始Y坐标
   * @param vx 起始X速度
   * @param vy 起始Y速度
   * @param targetId 目标蟑螂ID（可选）
   * @returns 生成的粘性弹丸
   */
  createStickyDrop(
    x: number,
    y: number,
    vx: number,
    vy: number,
    targetId: number | null = null
  ): StickyDrop {
    const drop: StickyDrop = {
      id: this.nextStickyDropId++,
      x,
      y,
      vx,
      vy,
      targetId,
      speed: 300,
      life: 12.5, // 12秒效果 + 0.5秒延迟
      maxLife: 12,
      size: 12,
      hit: false
    };
    
    this.stickyDrops.push(drop);
    return drop;
  }
  
  /**
   * 生成新的粘性板
   * @param x X坐标
   * @param y Y坐标
   * @param life 生命周期（秒）
   * @returns 生成的粘性板
   */
  createStickyBoard(
    x: number,
    y: number,
    life: number = 10
  ): StickyBoard {
    const board: StickyBoard = {
      id: this.nextStickyDropId++,
      x,
      y,
      width: 240,
      height: 240,
      life,
      maxLife: life,
      hitWidth: 240,
      hitHeight: 240,
      maxStuck: 5,
      stuckRoaches: []
    };
    
    this.stickyBoards.push(board);
    return board;
  }
  
  /**
   * 获取下一个粘性弹丸ID
   * @returns 下一个ID
   */
  getNextStickyDropId(): number {
    return this.nextStickyDropId;
  }
}