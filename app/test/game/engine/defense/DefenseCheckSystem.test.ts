/**
 * @fileoverview DefenseCheckSystem单元测试
 * @description 测试防御检查系统的核心功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefenseCheckSystem, type DefenseCheckSystemConfig } from '../../../../src/game/engine/defense/DefenseCheckSystem';
import { Roach, RoachType, RoachState, GameState } from '../../../../src/game/types';

describe('DefenseCheckSystem', () => {
  let config: DefenseCheckSystemConfig;
  let system: DefenseCheckSystem;
  
  // 模拟回调函数
  const mockOnGameDefeat = vi.fn();
  const mockOnDefenseUpdate = vi.fn();
  const mockOnAddFloatingText = vi.fn();
  const mockOnPlayAudio = vi.fn();
  const mockOnTriggerVibration = vi.fn();
  const mockOnScreenShake = vi.fn();
  const mockOnEconomyUpdate = vi.fn();
  const mockOnGameOver = vi.fn();
  const mockOnStateChange = vi.fn();
  const mockOnSuicideExplosion = vi.fn();
  const mockOnBossRemoved = vi.fn();

  beforeEach(() => {
    // 重置所有模拟函数
    vi.resetAllMocks();
    
    config = {
      gameState: GameState.PLAYING,
      defenseLineY: 600,
      defenseHp: 100,
      maxDefenseHp: 100,
      deltaTime: 0.016,
      difficulty: 'normal',
      playerDamageReduction: 0,
      playerShieldTimer: 0,
      currentScene: 'kitchen',
      onGameDefeat: mockOnGameDefeat,
      onDefenseUpdate: mockOnDefenseUpdate,
      onAddFloatingText: mockOnAddFloatingText,
      onPlayAudio: mockOnPlayAudio,
      onTriggerVibration: mockOnTriggerVibration,
      onScreenShake: mockOnScreenShake,
      onEconomyUpdate: mockOnEconomyUpdate,
      onGameOver: mockOnGameOver,
      onStateChange: mockOnStateChange,
    };
    
    system = new DefenseCheckSystem(config);
    
    // 设置事件回调
    system.onSuicideExplosion = mockOnSuicideExplosion;
    system.onBossRemoved = mockOnBossRemoved;
  });

  describe('构造函数', () => {
    it('应该正确创建DefenseCheckSystem实例', () => {
      expect(system).toBeInstanceOf(DefenseCheckSystem);
    });

    it('应该正确初始化配置', () => {
      expect(system).toHaveProperty('config');
      expect(system.config.gameState).toBe(GameState.PLAYING);
      expect(system.config.defenseLineY).toBe(600);
      expect(system.config.defenseHp).toBe(100);
      expect(system.config.maxDefenseHp).toBe(100);
    });
  });

  describe('配置更新', () => {
    it('应该正确更新系统配置', () => {
      const newConfig: Partial<DefenseCheckSystemConfig> = {
        gameState: GameState.PAUSED,
        defenseHp: 80,
        deltaTime: 0.032,
      };
      
      system.updateConfig(newConfig);
      
      expect(system.config.gameState).toBe(GameState.PAUSED);
      expect(system.config.defenseHp).toBe(80);
      expect(system.config.deltaTime).toBe(0.032);
      // 其他配置应该保持不变
      expect(system.config.defenseLineY).toBe(600);
      expect(system.config.maxDefenseHp).toBe(100);
    });
  });

  describe('防线突破检查', () => {
    it('应该在非游戏状态下跳过检查', () => {
      system.updateConfig({ gameState: GameState.PAUSED });
      
      const roaches: Roach[] = [
        createTestRoach(1, 400, 650, RoachType.SMALL), // 突破防线
      ];
      
      const result = system.checkDefense(roaches);
      
      expect(result.breachOccurred).toBe(false);
      expect(result.damageDealt).toBe(0);
      expect(result.breachingRoachIds).toEqual([]);
      expect(result.newDefenseHp).toBe(100);
    });

    it('应该检测到蟑螂突破防线', () => {
      const roaches: Roach[] = [
        createTestRoach(1, 400, 610, RoachType.SMALL), // 蟑螂底部位置：610 + 28*0.4 = 621.2 > 600
      ];
      
      const result = system.checkDefense(roaches);
      
      expect(result.breachOccurred).toBe(true);
      expect(result.damageDealt).toBe(2); // 小蟑螂在普通难度下造成2点伤害
      expect(result.breachingRoachIds).toEqual([1]);
      expect(result.newDefenseHp).toBe(98);
    });

    it('应该处理护盾抵消伤害', () => {
      system.updateConfig({ playerShieldTimer: 5.0 });
      
      const roaches: Roach[] = [
        createTestRoach(1, 400, 610, RoachType.SMALL),
      ];
      
      const result = system.checkDefense(roaches);
      
      expect(result.breachOccurred).toBe(true);
      expect(result.damageDealt).toBe(2);
      expect(result.newDefenseHp).toBe(100); // 护盾抵消伤害，生命值不变
      
      // 应该显示护盾抵消文本
      expect(mockOnAddFloatingText).toHaveBeenCalledWith(
        400,
        580,
        '护盾抵消!',
        '#22d3ee'
      );
    });

    it('应该考虑伤害减免', () => {
      system.updateConfig({ playerDamageReduction: 0.5 }); // 50%伤害减免
      
      const roaches: Roach[] = [
        createTestRoach(1, 400, 610, RoachType.SMALL),
      ];
      
      const result = system.checkDefense(roaches);
      
      expect(result.damageDealt).toBe(1); // 2 * (1 - 0.5) = 1
      expect(result.newDefenseHp).toBe(99);
    });

    it('应该处理自杀蟑螂爆炸', () => {
      const roach = createTestRoach(1, 400, 610, RoachType.SUICIDE);
      const roaches: Roach[] = [roach];
      
      const result = system.checkDefense(roaches);
      
      // 自杀蟑螂应该触发爆炸事件
      expect(mockOnSuicideExplosion).toHaveBeenCalledWith(roach, 0);
      expect(mockOnPlayAudio).toHaveBeenCalledWith('explosion');
      expect(mockOnScreenShake).toHaveBeenCalledWith(15);
      
      // 自杀蟑螂不造成直接伤害，但会从数组中移除
      expect(result.breachOccurred).toBe(false);
      expect(result.damageDealt).toBe(0);
      expect(roaches.length).toBe(0);
    });

    it('应该处理定时自杀蟑螂', () => {
      // 测试已放置炸弹的情况
      const roach1 = createTestRoach(1, 400, 610, RoachType.TIMED_SUICIDE);
      roach1.hasPlacedBomb = true;
      
      const roaches: Roach[] = [roach1];
      
      const result = system.checkDefense(roaches);
      
      expect(result.breachOccurred).toBe(true);
      expect(result.damageDealt).toBe(5); // 定时自杀蟑螂在普通难度下造成5点伤害
      
      // 测试未放置炸弹的情况
      const roach2 = createTestRoach(2, 400, 610, RoachType.TIMED_SUICIDE);
      roach2.hasPlacedBomb = false;
      
      const roaches2: Roach[] = [roach2];
      const result2 = system.checkDefense(roaches2);
      
      expect(result2.breachOccurred).toBe(false);
      expect(roaches2[0].y).toBe(536); // 600 - 64 = 536
    });

    it('应该处理Boss在Boss战中的特殊行为', () => {
      const roach = createTestRoach(1, 400, 610, RoachType.QUEEN);
      roach.isBoss = true;
      
      const roaches: Roach[] = [roach];
      
      const result = system.checkDefense(roaches);
      
      expect(result.breachOccurred).toBe(false);
      expect(roaches[0].y).toBe(585); // Math.min(610, 600 - 15) = 585
    });
  });

  describe('游戏失败条件', () => {
    it('应该在防线生命值≤0时触发游戏失败', () => {
      system.updateConfig({ defenseHp: 2 });
      
      const roaches: Roach[] = [
        createTestRoach(1, 400, 610, RoachType.SMALL), // 造成2点伤害
      ];
      
      const result = system.checkDefense(roaches);
      
      expect(result.breachOccurred).toBe(true);
      expect(result.newDefenseHp).toBe(0);
      
      // 应该触发游戏失败回调
      expect(mockOnGameDefeat).toHaveBeenCalled();
      expect(mockOnGameOver).toHaveBeenCalled();
      expect(mockOnStateChange).toHaveBeenCalledWith(GameState.GAME_OVER);
      expect(mockOnTriggerVibration).toHaveBeenCalledWith('game_over');
    });

    it('应该正确处理多次突破', () => {
      system.updateConfig({ defenseHp: 10 });
      
      const roaches: Roach[] = [
        createTestRoach(1, 400, 610, RoachType.SMALL), // 2点伤害
        createTestRoach(2, 450, 610, RoachType.LARGE), // 5点伤害
      ];
      
      const result = system.checkDefense(roaches);
      
      expect(result.breachOccurred).toBe(true);
      expect(result.damageDealt).toBe(7); // 2 + 5
      expect(result.newDefenseHp).toBe(3);
      expect(result.breachingRoachIds).toEqual([1, 2]);
    });
  });

  describe('防线修复', () => {
    it('应该正确修复防线', () => {
      system.updateConfig({ defenseHp: 50 });
      
      system.repairDefense(30);
      
      expect(system.config.defenseHp).toBe(80);
      expect(mockOnDefenseUpdate).toHaveBeenCalledWith(80, 100);
      
      // 应该显示修复文本
      expect(mockOnAddFloatingText).toHaveBeenCalledWith(
        600,
        540,
        '防线修复 +30',
        '#10b981'
      );
    });

    it('不应该超过最大生命值', () => {
      system.updateConfig({ defenseHp: 90 });
      
      system.repairDefense(20);
      
      expect(system.config.defenseHp).toBe(100); // 不超过最大生命值
    });

    it('不应该修复负值', () => {
      system.updateConfig({ defenseHp: 90 });
      
      system.repairDefense(-10);
      
      expect(system.config.defenseHp).toBe(80); // 90 - 10 = 80
    });
  });

  describe('防线状态', () => {
    it('应该正确获取防线状态', () => {
      system.updateConfig({ defenseHp: 75 });
      
      const status = system.getDefenseStatus();
      
      expect(status.hp).toBe(75);
      expect(status.maxHp).toBe(100);
      expect(status.hpPercent).toBe(75);
      expect(status.breachCount).toBe(0);
      expect(status.isBreached).toBe(true); // 75 < 100
    });

    it('应该正确计算生命值百分比', () => {
      system.updateConfig({ defenseHp: 33, maxDefenseHp: 150 });
      
      const status = system.getDefenseStatus();
      
      expect(status.hpPercent).toBe(22); // (33/150)*100 = 22
    });
  });

  describe('系统重置', () => {
    it('应该正确重置系统状态', () => {
      // 模拟一些突破
      const roaches: Roach[] = [
        createTestRoach(1, 400, 610, RoachType.SMALL),
      ];
      
      system.checkDefense(roaches);
      
      // 重置系统
      system.reset();
      
      const status = system.getDefenseStatus();
      expect(status.breachCount).toBe(0);
    });
  });
});

/**
 * 创建测试用的蟑螂对象
 */
function createTestRoach(
  id: number,
  x: number,
  y: number,
  type: RoachType
): Roach {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    type,
    hp: 1,
    maxHp: 1,
    state: RoachState.ALIVE,
    speed: 1.6,
    baseSpeed: 1.6,
    burnDamage: 0,
    inFire: false,
    angle: 0,
    wobbleOffset: 0,
    wobbleSpeed: 2,
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
    // 添加缺失的属性
    hasPlacedBomb: false,
    isArmorBroken: false,
  };
}