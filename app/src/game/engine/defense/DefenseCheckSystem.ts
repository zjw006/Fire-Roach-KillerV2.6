/**
 * @fileoverview 防御检查系统模块
 * @description 负责检查蟑螂是否突破防线、计算防线伤害和触发游戏失败条件
 */

import { GameState, RoachState, type Roach, RoachType } from '../../types';
import { ENEMY_DEFS } from '../../data';

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
  /** 游戏难度 */
  difficulty: 'normal' | 'hard';
  /** 玩家伤害减免百分比 */
  playerDamageReduction: number;
  /** 玩家护盾计时器 */
  playerShieldTimer: number;
  /** 当前场景 */
  currentScene: string;
  /** 游戏失败回调 */
  onGameDefeat?: () => void;
  /** 防线更新回调 */
  onDefenseUpdate?: (hp: number, maxHp: number) => void;
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string) => void;
  /** 播放音效回调 */
  onPlayAudio?: (audioType: string) => void;
  /** 触发振动回调 */
  onTriggerVibration?: (vibrationType: string) => void;
  /** 屏幕震动回调 */
  onScreenShake?: (intensity: number) => void;
  /** 经济系统更新回调 */
  onEconomyUpdate?: (breaches: number) => void;
  /** 游戏结束回调 */
  onGameOver?: (economy: any, wave: number) => void;
  /** 状态变化回调 */
  onStateChange?: (state: GameState) => void;
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

      // 计算蟑螂底部位置（考虑蟑螂大小）
      const roachSize = this.getRoachSize(r.type);
      const roachBottom = r.y + roachSize * 0.4;
      
      // 检查是否突破防线
      if (roachBottom >= dl) {
        // 特殊蟑螂类型处理
        if (r.type === RoachType.SUICIDE || r.type === RoachType.FLYING_SUICIDE) {
          // 自杀蟑螂：触发爆炸
          this.handleSuicideExplosion(r, i, roaches);
          continue;
        }
        
        if (r.type === RoachType.TIMED_SUICIDE) {
          // 定时自杀蟑螂：已放置炸弹时造成伤害，否则推回
          if (r.hasPlacedBomb) {
            const damage = this.calculateBreachDamage(r);
            totalDamage += damage;
            breachingIds.unshift(r.id); // 使用unshift保持原始顺序
            // 标记蟑螂为死亡并从数组中移除
            r.state = RoachState.DEAD;
            r.deathTimer = 0.5;
            roaches.splice(i, 1);
            continue; // 跳过通用处理
          } else {
            // 推回蟑螂
            r.y = dl - 64;
            continue;
          }
        }
        
        // Boss在Boss战中的特殊处理
        if (r.isBoss && r.type === RoachType.QUEEN) {
          // 钳制到防线位置，不突破
          r.y = Math.min(r.y, dl - 15);
          continue;
        }
        
        // 通用蟑螂处理（非特殊类型）
        const damage = this.calculateBreachDamage(r);
        totalDamage += damage;
        breachingIds.unshift(r.id); // 使用unshift保持原始顺序

        // 处理护盾效果
        if (this.config.playerShieldTimer > 0) {
          // 护盾抵消伤害
          if (this.config.onAddFloatingText) {
            this.config.onAddFloatingText(
              r.x,
              dl - 20,
              '护盾抵消!',
              '#22d3ee'
            );
          }
        } else {
          // 实际造成伤害
          this.config.defenseHp -= damage;
          
          // 更新经济系统
          if (this.config.onEconomyUpdate) {
            this.config.onEconomyUpdate(1); // 增加突破次数
          }
          
          // 播放音效
          if (this.config.onPlayAudio) {
            this.config.onPlayAudio('breach');
          }
          
          // 触发振动
          if (this.config.onTriggerVibration) {
            this.config.onTriggerVibration('breach');
          }
          
          // 屏幕震动
          if (this.config.onScreenShake) {
            this.config.onScreenShake(10);
          }
        }
        
        // 添加突破浮动文字
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            r.x,
            dl - 40,
            '防线突破!',
            '#ef4444'
          );
        }

        // 标记蟑螂为死亡（突破防线后死亡）
        r.state = RoachState.DEAD;
        r.deathTimer = 0.5;
        
        // 从数组中移除蟑螂
        roaches.splice(i, 1);
        
        // 如果是Boss，减少活跃Boss计数
        if (r.isBoss) {
          this.onBossRemoved?.(r);
        }
      }
    }

    // 如果有突破发生
    if (totalDamage > 0) {
      result.breachOccurred = true;
      result.damageDealt = totalDamage;
      result.breachingRoachIds = breachingIds;
      result.newDefenseHp = this.config.defenseHp;
      
      // 触发防线更新回调
      if (this.config.onDefenseUpdate) {
        this.config.onDefenseUpdate(this.config.defenseHp, this.config.maxDefenseHp);
      }

      // 更新突破计数器
      this.breachCount++;

      // 检查游戏是否失败
      if (this.config.defenseHp <= 0) {
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
  private calculateBreachDamage(roach: Roach): number {
    let damage = 0;
    
    // 根据蟑螂类型和难度计算基础伤害
    switch (roach.type) {
      case RoachType.SMALL:
        damage = this.config.difficulty === 'hard' ? 5 : 2;
        break;
      case RoachType.LARGE:
        damage = this.config.difficulty === 'hard' ? 15 : 5;
        break;
      case RoachType.FLYING:
        damage = this.config.difficulty === 'hard' ? 8 : 3;
        break;
      case RoachType.ARMORED:
        damage = this.config.difficulty === 'hard' ? 12 : 4;
        break;
      case RoachType.SPLITTING:
        damage = this.config.difficulty === 'hard' ? 10 : 4;
        break;
      case RoachType.TIMED_SUICIDE:
        // 定时自杀蟑螂：已放置炸弹时造成伤害，否则推回
        if (roach.hasPlacedBomb) {
          damage = this.config.difficulty === 'hard' ? 15 : 5;
        }
        break;
      case RoachType.QUEEN:
        damage = this.config.difficulty === 'hard' ? 35 : 12;
        break;
      case RoachType.NURSE:
        damage = this.config.difficulty === 'hard' ? 18 : 6;
        break;
      case RoachType.MUTANT:
        damage = this.config.difficulty === 'hard' ? 25 : 8;
        break;
      default:
        damage = this.config.difficulty === 'hard' ? 6 : 2;
        break;
    }
    
    // 应用伤害减免（护盾、天赋等）
    damage = Math.floor(damage * (1 - this.config.playerDamageReduction));
    
    return damage;
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
  
  /**
   * 获取蟑螂大小
   * @param roachType 蟑螂类型
   * @returns 蟑螂大小
   */
  private getRoachSize(roachType: RoachType): number {
    return ENEMY_DEFS[roachType]?.size || 40;
  }
  
  /**
   * 处理自杀蟑螂爆炸
   * @param roach 蟑螂对象
   * @param index 蟑螂索引
   * @param roaches 蟑螂数组
   */
  private handleSuicideExplosion(roach: Roach, index: number, roaches: Roach[]): void {
    // 触发爆炸效果
    this.onSuicideExplosion?.(roach, index);
    
    // 播放爆炸音效
    if (this.config.onPlayAudio) {
      this.config.onPlayAudio('explosion');
    }
    
    // 屏幕震动
    if (this.config.onScreenShake) {
      this.config.onScreenShake(15);
    }
    
    // 从数组中移除蟑螂（与原始引擎保持一致）
    roaches.splice(index, 1);
  }
  
  /**
   * 触发游戏失败
   */
  private triggerGameDefeat(): void {
    // 设置防线生命值为0
    this.config.defenseHp = 0;
    
    // 触发游戏失败回调
    if (this.config.onGameDefeat) {
      this.config.onGameDefeat();
    }
    
    // 触发游戏结束回调
    if (this.config.onGameOver) {
      this.config.onGameOver({ breaches: this.breachCount }, 0);
    }
    
    // 触发状态变化回调
    if (this.config.onStateChange) {
      this.config.onStateChange(GameState.GAME_OVER);
    }
    
    // 触发振动
    if (this.config.onTriggerVibration) {
      this.config.onTriggerVibration('game_over');
    }
  }
  
  /** 自杀蟑螂爆炸事件回调 */
  onSuicideExplosion?: (roach: Roach, index: number) => void;
  
  /** Boss被移除事件回调 */
  onBossRemoved?: (roach: Roach) => void;
}
