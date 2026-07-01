/**
 * @fileoverview 防御检查系统模块
 * @description 负责检查蟑螂是否突破防线、计算防线伤害和触发游戏失败条件
 */

import { GameState, RoachState, type Roach } from '../../types';

/**
 * 防御检查系统配置接口
 */
export interface DefenseCheckSystemConfig {
  /** 游戏状态 */
  gameState: GameState;
  /** 防线Y坐标 */
  defenseLineY: number;
  /** 当前防线生命值 */
  defenseHp: number;
  /** 最大防线生命值 */
  maxDefenseHp: number;
  /** 时间增量 */
  deltaTime: number;
  /** 游戏失败回调 */
  onGameDefeat?: () => void;
  /** 防线更新回调 */
  onDefenseUpdate?: (hp: number, maxHp: number) => void;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
}

/**
 * 防御检查结果接口
 */
export interface DefenseCheckResult {
  /** 是否发生突破 */
  breachOccurred: boolean;
  /** 造成的伤害 */
  damageDealt: number;
  /** 突破的蟑螂ID */
  breachingRoachIds: number[];
  /** 新的防线生命值 */
  newDefenseHp: number;
}

/**
 * 防御检查系统类
 * @description 管理防线突破检查、伤害计算和游戏失败条件
 */
export class DefenseCheckSystem {
  /** 系统配置 */
  private config: DefenseCheckSystemConfig;
  /** 防线突破计数器 */
  private breachCount: number = 0;

  /**
   * 构造函数
   * @param config - 系统配置
   */
  constructor(config: DefenseCheckSystemConfig) {
    this.config = config;
  }

  /**
   * 检查防线突破
   * @param roaches - 蟑螂数组
   * @returns 防御检查结果
   */
  checkDefense(roaches: Roach[]): DefenseCheckResult {
    const result: DefenseCheckResult = {
      breachOccurred: false,
      damageDealt: 0,
      breachingRoachIds: [],
      newDefenseHp: this.config.defenseHp,
    };

    // 只在游戏进行状态下检查
    if (this.config.gameState !== GameState.PLAYING) {
      return result;
    }

    const dl = this.config.defenseLineY;
    let totalDamage = 0;
    const breachingIds: number[] = [];

    // 检查每个存活的蟑螂
    for (let i = roaches.length - 1; i >= 0; i--) {
      const r = roaches[i];
      if (!r || r.state !== RoachState.ALIVE) continue;

      // 检查是否突破防线
      if (r.y >= dl) {
        // 计算伤害
        const damage = this.calculateBreachDamage(r);
        totalDamage += damage;
        breachingIds.push(r.id);

        // 添加突破浮动文字
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            r.x,
            dl - 40,
            '防线被突破!',
            '#ef4444'
          );
        }

        // 标记蟑螂为死亡（突破防线后死亡）
        r.state = RoachState.DEAD;
        r.deathTimer = 0.5;
      }
    }

    // 如果有突破发生
    if (totalDamage > 0) {
      result.breachOccurred = true;
      result.damageDealt = totalDamage;
      result.breachingRoachIds = breachingIds;
      
      // 更新防线生命值
      const newHp = Math.max(0, this.config.defenseHp - totalDamage);
      result.newDefenseHp = newHp;
      
      // 更新配置中的防线生命值
      this.config.defenseHp = newHp;
      
      // 触发防线更新回调
      if (this.config.onDefenseUpdate) {
        this.config.onDefenseUpdate(newHp, this.config.maxDefenseHp);
      }

      // 更新突破计数器
      this.breachCount++;

      // 检查游戏是否失败
      if (newHp <= 0) {
        this.triggerGameDefeat();
      }
    }

    return result;
  }

  /**
   * 计算突破伤害
   * @param roach - 蟑螂对象
   * @returns 伤害值
   */
  private calculateBreachDamage(roach: any): number {
    // 基础伤害
    let damage = 50;
    
    // 根据蟑螂类型调整伤害
    switch (roach.type) {
      case 'normal':
        damage = 40;
        break;
      case 'armored':
        damage = 80;
        break;
      case 'flying':
        damage = 60;
        break;
      case 'queen':
        damage = 200;
        break;
      case 'mutant':
        damage = 100;
        break;
    }
    
    // 考虑蟑螂大小
    if (roach.size && roach.size > 1) {
      damage *= roach.size;
    }
    
    // 考虑蟑螂生命值（生命值越高，突破伤害越大）
    if (roach.hp && roach.maxHp) {
      const healthRatio = roach.hp / roach.maxHp;
      damage *= (0.5 + healthRatio * 0.5);
    }
    
    return Math.round(damage);
  }

  /**
   * 触发游戏失败
   */
  private triggerGameDefeat(): void {
    if (this.config.onGameDefeat) {
      this.config.onGameDefeat();
    }
  }

  /**
   * 修复防线
   * @param amount - 修复量
   */
  repairDefense(amount: number): void {
    const newHp = Math.min(
      this.config.maxDefenseHp, 
      this.config.defenseHp + amount
    );
    
    this.config.defenseHp = newHp;
    
    // 触发防线更新回调
    if (this.config.onDefenseUpdate) {
      this.config.onDefenseUpdate(newHp, this.config.maxDefenseHp);
    }
    
    // 添加修复浮动文字
    if (this.config.onAddFloatingText && amount > 0) {
      this.config.onAddFloatingText(
        this.config.defenseLineY,
        this.config.defenseLineY - 60,
        `防线修复 +${amount}`,
        '#10b981'
      );
    }
  }

  /**
   * 获取防线状态
   * @returns 防线状态对象
   */
  getDefenseStatus(): {
    /** 当前生命值 */
    hp: number;
    /** 最大生命值 */
    maxHp: number;
    /** 生命值百分比 */
    hpPercent: number;
    /** 突破次数 */
    breachCount: number;
    /** 是否被突破 */
    isBreached: boolean;
  } {
    const hpPercent = (this.config.defenseHp / this.config.maxDefenseHp) * 100;
    const isBreached = this.config.defenseHp < this.config.maxDefenseHp;
    
    return {
      hp: this.config.defenseHp,
      maxHp: this.config.maxDefenseHp,
      hpPercent: Math.round(hpPercent),
      breachCount: this.breachCount,
      isBreached,
    };
  }

  /**
   * 更新系统配置
   * @param config - 新的配置
   */
  updateConfig(config: Partial<DefenseCheckSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 重置系统状态
   */
  reset(): void {
    this.breachCount = 0;
  }
}
