/**
 * @fileoverview RoachAISystem单元测试
 * @description 测试蟑螂AI系统的基本功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RoachAISystem, type RoachAISystemConfig } from '../../../../src/game/engine/ai/RoachAISystem';
import { Roach, RoachType, RoachState, GameState, SceneType } from '../../../../src/game/types';

describe('RoachAISystem', () => {
  let config: RoachAISystemConfig;
  let system: RoachAISystem;

  beforeEach(() => {
    config = {
      gameState: GameState.PLAYING,
      difficulty: 'normal',
      defenseLineY: 600,
      canvasWidth: 800,
      canvasHeight: 600,
      deltaTime: 0.016, // 约60fps
      currentScene: SceneType.KITCHEN,
      playerX: 400,
      playerY: 300,
    };
    
    system = new RoachAISystem(config);
  });

  describe('构造函数', () => {
    it('应该正确创建RoachAISystem实例', () => {
      expect(system).toBeInstanceOf(RoachAISystem);
    });

    it('应该正确初始化配置', () => {
      expect(system).toHaveProperty('config');
      expect(system.config.gameState).toBe(GameState.PLAYING);
      expect(system.config.difficulty).toBe('normal');
      expect(system.config.defenseLineY).toBe(600);
    });
  });

  describe('配置更新', () => {
    it('应该正确更新系统配置', () => {
      const newConfig: Partial<RoachAISystemConfig> = {
        gameState: GameState.PAUSED,
        deltaTime: 0.032,
      };
      
      system.updateConfig(newConfig);
      
      expect(system.config.gameState).toBe(GameState.PAUSED);
      expect(system.config.deltaTime).toBe(0.032);
      // 其他配置应该保持不变
      expect(system.config.difficulty).toBe('normal');
      expect(system.config.defenseLineY).toBe(600);
    });
  });

  describe('地面边界计算', () => {
    it('应该正确计算厨房场景的地面边界', () => {
      // 测试厨房场景的不同Y坐标
      // 配置: [200,450, 400,450, 100,625, 465,625, 0,530,800]
      // farL=200, farLY=450, farR=400, farRY=450
      // midL=100, midLY=625, midR=465, midRY=625
      // nearL=0, nearR=530, nearY=800
      
      const testCases = [
        { y: 450, expectedLeft: 200, expectedRight: 400 }, // 远段
        { y: 537.5, expectedLeft: 150, expectedRight: 432.5 }, // 远段到中段的中间点
        { y: 625, expectedLeft: 100, expectedRight: 465 }, // 中段
        { y: 712.5, expectedLeft: 50, expectedRight: 497.5 }, // 中段到近段的中间点
        { y: 800, expectedLeft: 0, expectedRight: 530 }, // 近段
      ];
      
      testCases.forEach(({ y, expectedLeft, expectedRight }) => {
        const [left, right] = system.getGroundBoundsAtY(y);
        expect(left).toBeCloseTo(expectedLeft, 1);
        expect(right).toBeCloseTo(expectedRight, 1);
      });
    });

    it('应该正确处理超出范围的Y坐标', () => {
      // Y坐标低于最小地面Y（450）
      const [left1, right1] = system.getGroundBoundsAtY(300);
      expect(left1).toBeCloseTo(200, 1); // 应该钳制到远段左边界
      expect(right1).toBeCloseTo(400, 1); // 应该钳制到远段右边界
      
      // Y坐标高于最大地面Y（800）
      const [left2, right2] = system.getGroundBoundsAtY(900);
      expect(left2).toBeCloseTo(0, 1); // 应该钳制到近段左边界
      expect(right2).toBeCloseTo(530, 1); // 应该钳制到近段右边界
    });
  });

  describe('变异体转换动画', () => {
    it('应该正确开始变异体转换动画', () => {
      system.startMutantTransform();
      
      const state = system.getMutantTransformState();
      expect(state.active).toBe(true);
      expect(state.frame).toBe(0);
      expect(state.timer).toBe(0.2);
    });

    it('应该正确获取变异体转换动画状态', () => {
      const state = system.getMutantTransformState();
      expect(state).toHaveProperty('active');
      expect(state).toHaveProperty('frame');
      expect(state).toHaveProperty('timer');
    });
  });

  describe('蟑螂更新', () => {
    it('应该正确处理空蟑螂数组', () => {
      const roaches: Roach[] = [];
      const result = system.updateRoaches(roaches);
      expect(result).toEqual([]);
    });

    it('应该正确处理死亡蟑螂', () => {
      const deadRoach: Roach = {
        id: 1,
        x: 400,
        y: 500,
        vx: 0,
        vy: 0,
        type: RoachType.SMALL,
        hp: 0,
        maxHp: 1,
        state: RoachState.DEAD,
        speed: 1.6,
        baseSpeed: 1.6,
        burnDamage: 0,
        inFire: false,
        angle: 0,
        wobbleOffset: 0,
        wobbleSpeed: 2,
        isEnraged: false,
        deathTimer: 1.0,
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
      };
      
      const result = system.updateRoaches([deadRoach]);
      expect(result.length).toBe(1);
      expect(result[0].deathTimer).toBeLessThan(1.0);
    });
  });
});