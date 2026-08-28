/**
 * @fileoverview 蟑老大 Boss 战共享类型定义
 * @description 巢穴终局 Boss 战（2026-08-24 锁定设计）：玩家无法直接攻击 Boss，
 * 唯一输出手段 = 火枪引爆 Boss 投掷的炸弹反伤。本文件定义模块内共享的类型。
 */

/** 蟑老大技能枚举（战场态势 AI 决策：净化/吹风/投弹按条件触发） */
export const BossKingSkill = {
  PURGE: 'purge',
  WIND: 'wind',
  BOMB: 'bomb',
} as const;
export type BossKingSkill = typeof BossKingSkill[keyof typeof BossKingSkill];

/** 血量阶段（100%~50% / 50%~20% / 20%~0%） */
export type BossKingPhase = 1 | 2 | 3;

/** 技能状态机 */
export type BossKingSkillState = 'idle' | 'telegraph' | 'active';

/** Boss 动画动作（对应 public/boss/<action>/bk_<action>_NN.png） */
export type BossKingAnimAction =
  | 'hover'
  | 'purge'
  | 'wind'
  | 'bomb_warn'
  | 'bomb_throw'
  | 'hit'
  | 'exit';

/** 蟑老大实体（独立于 Roach，不进入 roaches 数组，免疫一切火焰/控制结算） */
export interface BossKingEntity {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facingRight: boolean;
  damageFlash: number;
  animAction: BossKingAnimAction;
  animFrame: number;
  animTimer: number;
}

/** Boss 炸弹（抛物线飞行，可被火枪提前引爆） */
export interface BossBomb {
  id: number;
  /** 起点（Boss 位置） */
  x0: number;
  y0: number;
  /** 自动爆炸点（落点标记处 = defenseLineY - burstOffsetFromDefense） */
  x1: number;
  y1: number;
  /** 当前位置 */
  x: number;
  y: number;
  /** 飞行进度计时（秒） */
  elapsed: number;
  /** 是否已被摧毁（本帧移除） */
  dead: boolean;
}

/** 屏幕汁液喷溅（仅漏弹触发；屏幕空间覆盖层，非世界坐标实体） */
export interface GooSplat {
  x: number;
  y: number;
  radius: number;
  /** 形状随机种子（程序圆斑的卫星圆排布） */
  seed: number;
  life: number;
  maxLife: number;
}

/** 蟑老大战斗总状态 */
export interface BossKingBattleState {
  active: boolean;
  boss: BossKingEntity;
  phase: BossKingPhase;
  /** 已施放技能计数（每 3 个技能后触发额外休整） */
  skillsCasted: number;
  /** 已施放投弹次数（第 1 次单发，第 2 次双发，第 3 次起三连发） */
  bombsCasted: number;
  skillState: BossKingSkillState;
  /** 当前技能阶段计时（CD / 前摇共用） */
  skillTimer: number;
  /** 当前前摇中的技能（telegraph 阶段使用） */
  telegraphSkill: BossKingSkill;
  /** 吹风剩余时间（>0 表示吹风进行中） */
  windTimer: number;
  /** 开场亮相剩余时间 */
  introTimer: number;
  /** 退场阶段：none → turn → fly → done */
  exitStage: 'none' | 'turn' | 'fly' | 'done';
  exitTimer: number;
  exitStartX: number;
  exitStartY: number;
  /** 胜利回调是否已触发（防重入） */
  victoryFired: boolean;
}

/** 创建初始战斗状态 */
export function createBossKingState(): BossKingBattleState {
  return {
    active: false,
    boss: {
      x: 0, y: 0, hp: 0, maxHp: 0,
      facingRight: true, damageFlash: 0,
      animAction: 'hover', animFrame: 0, animTimer: 0,
    },
    phase: 1,
    skillsCasted: 0,
    bombsCasted: 0,
    skillState: 'idle',
    skillTimer: 0,
    telegraphSkill: BossKingSkill.BOMB,
    windTimer: 0,
    introTimer: 0,
    exitStage: 'none',
    exitTimer: 0,
    exitStartX: 0,
    exitStartY: 0,
    victoryFired: false,
  };
}
