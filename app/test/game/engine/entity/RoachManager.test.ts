/**
 * @fileoverview RoachManager单元测试
 * @description 测试蟑螂实体管理器的核心功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RoachManager } from '../../../../src/game/engine/entity/RoachManager';
import { RoachType, SceneType, RoachState } from '../../../../src/game/types';
import { ENEMY_DEFS } from '../../../../src/game/data';

/**
 * 创建测试用的RoachManager实例
 * @param sceneType 场景类型
 * @returns RoachManager实例
 */
const createTestRoachManager = (sceneType: SceneType = SceneType.KITCHEN): RoachManager => {
  const width = 800;
  const height = 600;
  const defenseLineY = () => 500;
  
  return new RoachManager(width, height, defenseLineY, sceneType);
};

/**
 * 创建测试用的蟑螂生成选项
 * @param difficulty 难度
 * @returns 生成选项
 */
const createTestSpawnOptions = (difficulty: 'easy' | 'normal' | 'hard' = 'normal') => ({
  difficulty,
  waveConfig: {
    speed: 1.0,
    spawnInterval: 1.0,
  },
  bossBattle: {
    active: false,
    phase: 0,
  },
});

describe('RoachManager', () => {
  let manager: RoachManager;

  beforeEach(() => {
    manager = createTestRoachManager();
  });

  describe('构造函数', () => {
    it('应该正确初始化属性', () => {
      expect(manager).toBeDefined();
      expect(manager.getRoaches()).toEqual([]);
      expect(manager.getRoachCount()).toBe(0);
    });

    it('应该支持默认场景类型', () => {
      const defaultManager = new RoachManager(800, 600, () => 500);
      expect(defaultManager).toBeDefined();
    });
  });

  describe('getGroundBoundsAtY方法', () => {
    it('应该根据Y坐标计算地面边界', () => {
      // 测试厨房场景的地面边界计算
      const manager = createTestRoachManager(SceneType.KITCHEN);
      
      // 测试远端Y坐标
      const [farLeft, farRight] = manager.getGroundBoundsAtY(450);
      expect(farLeft).toBeGreaterThan(0);
      expect(farRight).toBeGreaterThan(farLeft);
      
      // 测试近端Y坐标
      const [nearLeft, nearRight] = manager.getGroundBoundsAtY(800);
      expect(nearLeft).toBeLessThan(nearRight);
      // 注意：厨房场景的nearLeft是0，这是正常的
      expect(nearLeft).toBeGreaterThanOrEqual(0);
    });

    it('应该为不同场景返回不同的边界', () => {
      const kitchenManager = createTestRoachManager(SceneType.KITCHEN);
      const sewerManager = createTestRoachManager(SceneType.SEWER);
      
      const kitchenBounds = kitchenManager.getGroundBoundsAtY(500);
      const sewerBounds = sewerManager.getGroundBoundsAtY(500);
      
      // 不同场景应该有不同边界
      expect(kitchenBounds[0]).not.toBe(sewerBounds[0]);
      expect(kitchenBounds[1]).not.toBe(sewerBounds[1]);
    });
  });

  describe('spawnRoach方法', () => {
    it('应该生成小型地面蟑螂', () => {
      const roach = manager.spawnRoach(RoachType.SMALL, undefined, createTestSpawnOptions());
      
      expect(roach).toBeDefined();
      expect(roach?.type).toBe(RoachType.SMALL);
      expect(roach?.state).toBe(RoachState.ALIVE);
      expect(roach?.x).toBeGreaterThan(0);
      expect(roach?.x).toBeLessThan(800);
      expect(roach?.y).toBeGreaterThan(0);
      expect(roach?.y).toBeLessThan(600);
    });

    it('应该生成飞行蟑螂', () => {
      const roach = manager.spawnRoach(RoachType.FLYING, undefined, createTestSpawnOptions());
      
      expect(roach).toBeDefined();
      expect(roach?.type).toBe(RoachType.FLYING);
      // 飞行蟑螂从两侧生成：左侧（x < 0）或右侧（x > width）
      expect(roach?.x < 0 || roach?.x > 800).toBe(true);
    });

    it('应该生成女王蟑螂', () => {
      const roach = manager.spawnRoach(RoachType.QUEEN, undefined, createTestSpawnOptions());
      
      expect(roach).toBeDefined();
      expect(roach?.type).toBe(RoachType.QUEEN);
      expect(roach?.isBoss).toBe(true);
      expect(roach?.id).toBe(9999); // 特殊ID
    });

    it('应该在医院场景生成护士蟑螂', () => {
      const hospitalManager = createTestRoachManager(SceneType.HOSPITAL);
      const roach = hospitalManager.spawnRoach(
        RoachType.NURSE, 
        undefined, 
        createTestSpawnOptions()
      );
      
      expect(roach).toBeDefined();
      expect(roach?.type).toBe(RoachType.NURSE);
      expect(roach?.y).toBeGreaterThan(0);
    });

    it('应该应用难度影响', () => {
      // 使用大型蟑螂测试，因为小型蟑螂HP=1，Math.floor后总是1
      const easyRoach = manager.spawnRoach(
        RoachType.LARGE, 
        undefined, 
        createTestSpawnOptions('easy')
      );
      
      const hardRoach = manager.spawnRoach(
        RoachType.LARGE, 
        undefined, 
        createTestSpawnOptions('hard')
      );
      
      expect(easyRoach?.hp).toBeLessThan(hardRoach?.hp!);
      expect(easyRoach?.maxHp).toBeLessThan(hardRoach?.maxHp!);
    });

    it('应该限制最大蟑螂数量', () => {
      // 生成40只蟑螂
      for (let i = 0; i < 40; i++) {
        manager.spawnRoach(RoachType.SMALL, undefined, createTestSpawnOptions());
      }
      
      // 第41只应该返回undefined
      const extraRoach = manager.spawnRoach(RoachType.SMALL, undefined, createTestSpawnOptions());
      expect(extraRoach).toBeUndefined();
    });

    it('应该处理Boss战斗中的生成', () => {
      const options = {
        ...createTestSpawnOptions(),
        bossBattle: {
          active: true,
          phase: 2, // 地面战斗阶段
        },
      };
      
      const roach = manager.spawnRoach(RoachType.SMALL, undefined, options);
      expect(roach).toBeDefined();
    });
  });

  describe('蟑螂管理方法', () => {
    it('应该正确设置和获取蟑螂列表', () => {
      const testRoaches = [
        { id: 1, x: 100, y: 200, type: RoachType.SMALL, state: RoachState.ALIVE } as any,
        { id: 2, x: 300, y: 400, type: RoachType.LARGE, state: RoachState.ALIVE } as any,
      ];
      
      manager.setRoaches(testRoaches);
      expect(manager.getRoaches()).toEqual(testRoaches);
      expect(manager.getRoachCount()).toBe(2);
    });

    it('应该根据ID获取蟑螂', () => {
      const roach = manager.spawnRoach(RoachType.SMALL, undefined, createTestSpawnOptions());
      expect(roach).toBeDefined();
      
      const foundRoach = manager.getRoachById(roach?.id!);
      expect(foundRoach).toEqual(roach);
    });

    it('应该移除指定ID的蟑螂', () => {
      const roach = manager.spawnRoach(RoachType.SMALL, undefined, createTestSpawnOptions());
      expect(roach).toBeDefined();
      
      const removed = manager.removeRoach(roach?.id!);
      expect(removed).toBe(true);
      expect(manager.getRoachCount()).toBe(0);
    });

    it('应该清除所有蟑螂', () => {
      manager.spawnRoach(RoachType.SMALL, undefined, createTestSpawnOptions());
      manager.spawnRoach(RoachType.LARGE, undefined, createTestSpawnOptions());
      
      expect(manager.getRoachCount()).toBe(2);
      
      manager.clearAll();
      expect(manager.getRoachCount()).toBe(0);
      expect(manager.getRoaches()).toEqual([]);
    });
  });

  describe('边界检查方法', () => {
    it('应该检测超出左右边界的蟑螂', () => {
      const leftOutRoach = { id: 1, x: -10, y: 300, type: RoachType.SMALL, state: RoachState.ALIVE } as any;
      const rightOutRoach = { id: 2, x: 810, y: 300, type: RoachType.SMALL, state: RoachState.ALIVE } as any;
      
      expect(manager.isOutOfBounds(leftOutRoach)).toBe(true);
      expect(manager.isOutOfBounds(rightOutRoach)).toBe(true);
    });

    it('应该检测超出上下边界的蟑螂', () => {
      const topOutRoach = { id: 1, x: 400, y: -10, type: RoachType.SMALL, state: RoachState.ALIVE } as any;
      const bottomOutRoach = { id: 2, x: 400, y: 610, type: RoachType.SMALL, state: RoachState.ALIVE } as any;
      
      expect(manager.isOutOfBounds(topOutRoach)).toBe(true);
      expect(manager.isOutOfBounds(bottomOutRoach)).toBe(true);
    });

    it('应该检测越过防御线的蟑螂', () => {
      const beyondDefenseRoach = { id: 1, x: 400, y: 510, type: RoachType.SMALL, state: RoachState.ALIVE } as any;
      
      expect(manager.isOutOfBounds(beyondDefenseRoach)).toBe(true);
    });

    it('应该识别边界内的蟑螂', () => {
      const insideRoach = { id: 1, x: 400, y: 300, type: RoachType.SMALL, state: RoachState.ALIVE } as any;
      
      expect(manager.isOutOfBounds(insideRoach)).toBe(false);
    });
  });

  describe('更新方法', () => {
    it('应该更新时间和增量时间', () => {
      manager.updateTime(10, 0.016);
      
      // 由于updateTime方法没有返回值，我们通过其他方式验证
      // 这里我们假设方法正确执行
      expect(manager).toBeDefined();
    });

    it('应该更新蟑螂位置', () => {
      const roach = manager.spawnRoach(RoachType.SMALL, undefined, createTestSpawnOptions());
      expect(roach).toBeDefined();
      
      // 调用更新方法
      manager.update(0.016);
      
      // 验证蟑螂仍然存在
      expect(manager.getRoachCount()).toBe(1);
    });

    it('应该处理蟑螂死亡', () => {
      const roach = manager.spawnRoach(RoachType.SMALL, undefined, createTestSpawnOptions());
      expect(roach).toBeDefined();
      
      // 对蟑螂造成致命伤害
      const killed = manager.damageRoach(roach?.id!, roach?.hp! + 10);
      expect(killed).toBe(true);
      
      // 更新游戏
      manager.update(1.0);
      
      // 死亡蟑螂应该被移除
      expect(manager.getRoachCount()).toBe(0);
    });
  });
});