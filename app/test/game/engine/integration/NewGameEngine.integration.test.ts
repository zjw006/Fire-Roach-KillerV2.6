/**
 * @fileoverview NewGameEngine集成测试
 * @description 测试模块间的协同工作和游戏循环流程
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NewGameEngine } from '../../../../src/game/engine/NewGameEngine';
import { GameMode, SceneType, GameState } from '../../../../src/game/types';

/**
 * 创建模拟Canvas元素
 */
const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = {
    width: 800,
    height: 600,
    getContext: vi.fn(() => ({
      fillRect: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      clearRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left' as CanvasTextAlign,
      textBaseline: 'alphabetic' as CanvasTextBaseline,
    })),
  } as unknown as HTMLCanvasElement;
  
  return canvas;
};

/**
 * 创建模拟音频管理器
 */
const createMockAudioManager = () => ({
  playSoundById: vi.fn(),
  stopSoundById: vi.fn(),
  setMasterVolume: vi.fn(),
  setSoundVolume: vi.fn(),
  setMusicVolume: vi.fn(),
  playMusic: vi.fn(),
  stopMusic: vi.fn(),
  pauseMusic: vi.fn(),
  resumeMusic: vi.fn(),
  stopFire: vi.fn(),
  stopGameOverBGM: vi.fn(),
  stopVictoryBGM: vi.fn(),
});

/**
 * 创建模拟输入处理器
 */
const createMockInputHandler = () => ({
  mouseX: 400,
  mouseY: 300,
  isFiring: false,
  isMouseDown: false,
  keys: {},
  updateMousePosition: vi.fn(),
  setFiring: vi.fn(),
  setMouseDown: vi.fn(),
  setKey: vi.fn(),
  clearKeys: vi.fn(),
  reset: vi.fn(),
});

describe('NewGameEngine集成测试', () => {
  let engine: NewGameEngine;
  let mockCanvas: HTMLCanvasElement;
  let mockAudioManager: any;
  let mockInputHandler: any;

  beforeEach(() => {
    mockCanvas = createMockCanvas();
    mockAudioManager = createMockAudioManager();
    mockInputHandler = createMockInputHandler();
    
    engine = new NewGameEngine({
      canvas: mockCanvas,
      ctx: mockCanvas.getContext('2d') as CanvasRenderingContext2D,
      gameMode: GameMode.NORMAL,
      difficulty: 'easy',
      currentScene: SceneType.KITCHEN,
      audio: mockAudioManager,
      inputHandler: mockInputHandler,
    });
  });

  describe('引擎初始化', () => {
    it('应该正确初始化所有模块', () => {
      expect(engine).toBeDefined();
      expect(engine['economyManager']).toBeDefined();
      expect(engine['waveManager']).toBeDefined();
      expect(engine['entityManager']).toBeDefined();
      expect(engine['renderManager']).toBeDefined();
      expect(engine['collisionSystem']).toBeDefined();
      expect(engine['weaponSystem']).toBeDefined();
      expect(engine['particleSystem']).toBeDefined();
      expect(engine['roachAISystem']).toBeDefined();
      expect(engine['bossBattleSystem']).toBeDefined();
      expect(engine['throwableSystem']).toBeDefined();
      expect(engine['stickySystem']).toBeDefined();
      expect(engine['aimingSystem']).toBeDefined();
      expect(engine['tripleFlameSystem']).toBeDefined();
      expect(engine['radarLaserSystem']).toBeDefined();
      expect(engine['fanSystem']).toBeDefined();
      expect(engine['consumableSystem']).toBeDefined();
      expect(engine['weatherSystem']).toBeDefined();
      expect(engine['itemSystem']).toBeDefined();
      expect(engine['achievementSystem']).toBeDefined();
      expect(engine['statsSystem']).toBeDefined();
      expect(engine['playerControlSystem']).toBeDefined();
      expect(engine['defenseCheckSystem']).toBeDefined();
    });

    it('应该正确设置游戏状态', () => {
      expect(engine['state']).toBe(GameState.MENU);
      expect(engine['player']).toBeDefined();
      expect(engine['economy']).toBeDefined();
      expect(engine['wave']).toBe(1);
    });
  });

  describe('游戏循环流程', () => {
    it('应该正确处理游戏更新循环', () => {
      // 模拟游戏状态为进行中
      engine['state'] = GameState.PLAYING;
      
      // 模拟bossBattleSystem
      engine['bossBattleSystem'] = {
        getState: vi.fn(() => undefined),
        updateConfig: vi.fn(),
        updateBossBattle: vi.fn(),
      };
      
      // 模拟波次管理器返回要生成的蟑螂
      const mockSpawn = {
        type: 'small' as const,
        clusterId: 1,
      };
      vi.spyOn(engine['waveManager'], 'getNextSpawn').mockReturnValue(mockSpawn);
      
      // 模拟蟑螂生成成功
      const mockRoach = {
        id: 1,
        x: 100,
        y: 100,
        type: 'small' as const,
        state: 'alive' as const,
        health: 100,
      };
      vi.spyOn(engine['entityManager'].getRoachManager(), 'spawnRoach').mockReturnValue(mockRoach);
      
      // 模拟波次配置
      vi.spyOn(engine['waveManager'], 'getWaveConfig').mockReturnValue({
        spawnInterval: 1.0,
      });
      
      // 模拟移除已生成的蟑螂
      vi.spyOn(engine['waveManager'], 'removeSpawned');
      
      // 执行更新
      engine['update'](0.016); // 约60fps的一帧
      
      // 验证波次管理器被调用
      expect(engine['waveManager'].getNextSpawn).toHaveBeenCalled();
      
      // 验证蟑螂生成被调用
      expect(engine['entityManager'].getRoachManager().spawnRoach).toHaveBeenCalledWith(
        'small',
        1,
        {
          difficulty: 'easy',
          waveConfig: expect.any(Object),
          bossBattle: undefined,
        }
      );
      
      // 验证已生成的蟑螂被移除
      expect(engine['waveManager'].removeSpawned).toHaveBeenCalled();
      
      // 验证bossBattleSystem被调用
      expect(engine['bossBattleSystem'].updateConfig).toHaveBeenCalled();
      expect(engine['bossBattleSystem'].updateBossBattle).toHaveBeenCalled();
    });

    it('应该正确处理波次完成逻辑', () => {
      // 模拟波次完成
      vi.spyOn(engine['waveManager'], 'isWaveComplete').mockReturnValue(true);
      vi.spyOn(engine['waveManager'], 'calculateTalentReward').mockReturnValue(2);
      
      // 模拟添加天赋点
      const mockAddTalentPoints = vi.fn();
      engine['waveManager'].addTalentPoints = mockAddTalentPoints;
      
      // 模拟完美波次记录
      vi.spyOn(engine['economyManager'], 'recordPerfectWave');
      
      // 执行波次状态检查
      engine['checkWaveStatus']();
      
      // 验证天赋点奖励计算被调用
      expect(engine['waveManager'].calculateTalentReward).toHaveBeenCalledWith(SceneType.KITCHEN);
      
      // 验证天赋点添加被调用
      expect(mockAddTalentPoints).toHaveBeenCalled();
    });
  });

  describe('地面阻挡线功能集成', () => {
    it('应该正确传递场景类型给RoachManager', () => {
      // 获取EntityManager中的RoachManager
      const roachManager = engine['entityManager'].getRoachManager();
      
      // 验证RoachManager正确接收了场景类型
      // 注意：RoachManager没有config属性，而是直接有currentScene属性
      expect(roachManager['currentScene']).toBe(SceneType.KITCHEN);
    });

    it('应该支持地面边界计算', () => {
      // 获取EntityManager中的RoachManager
      const roachManager = engine['entityManager'].getRoachManager();
      
      // 测试地面边界计算
      const [leftX, rightX] = roachManager.getGroundBoundsAtY(500);
      
      // 验证返回有效的边界值
      expect(leftX).toBeGreaterThanOrEqual(0);
      expect(rightX).toBeGreaterThan(leftX);
      expect(rightX).toBeLessThanOrEqual(800); // 画布宽度
    });

    it('应该正确处理地面蟑螂生成位置', () => {
      // 获取roachManager引用
      const roachManager = engine['entityManager'].getRoachManager();
      
      // 模拟波次管理器返回地面蟑螂
      const mockSpawn = {
        type: 'small' as const,
        clusterId: 1,
      };
      vi.spyOn(engine['waveManager'], 'getNextSpawn').mockReturnValue(mockSpawn);
      
      // 模拟bossBattleSystem
      engine['bossBattleSystem'] = {
        getState: vi.fn(() => undefined),
        updateConfig: vi.fn(),
      };
      
      // 模拟蟑螂生成成功
      const mockRoach = {
        id: 1,
        x: 100,
        y: 100,
        type: 'small' as const,
        state: 'alive' as const,
        health: 100,
      };
      vi.spyOn(roachManager, 'spawnRoach').mockReturnValue(mockRoach);
      
      // 重置生成计时器
      engine['spawnTimer'] = 0;
      
      // 执行波次生成处理
      engine['handleWaveSpawning'](0.016);
      
      // 验证蟑螂生成被调用
      expect(roachManager.spawnRoach).toHaveBeenCalled();
    });
  });

  describe('模块间通信', () => {
    it('应该正确处理碰撞检测事件', () => {
      // 模拟游戏状态为进行中
      engine['state'] = GameState.PLAYING;
      
      // 模拟bossBattleSystem
      engine['bossBattleSystem'] = {
        getState: vi.fn(() => undefined),
        updateConfig: vi.fn(),
        updateBossBattle: vi.fn(),
      };
      
      // 模拟碰撞检测系统
      const mockCheckCollisions = vi.spyOn(engine, 'checkCollisions' as any);
      
      // 执行更新
      engine['update'](0.016);
      
      // 验证碰撞检测被调用
      expect(mockCheckCollisions).toHaveBeenCalled();
      
      // 验证bossBattleSystem被调用
      expect(engine['bossBattleSystem'].updateConfig).toHaveBeenCalled();
      expect(engine['bossBattleSystem'].updateBossBattle).toHaveBeenCalled();
    });

    it('应该正确处理防御检查事件', () => {
      // 模拟游戏状态为进行中
      engine['state'] = GameState.PLAYING;
      
      // 模拟bossBattleSystem
      engine['bossBattleSystem'] = {
        getState: vi.fn(() => undefined),
        updateConfig: vi.fn(),
        updateBossBattle: vi.fn(),
      };
      
      // 模拟防御检查系统
      const mockUpdateNewModules = vi.spyOn(engine, 'updateNewModules' as any);
      
      // 执行更新
      engine['update'](0.016);
      
      // 验证防御检查被调用
      expect(mockUpdateNewModules).toHaveBeenCalledWith(0.016);
      
      // 验证bossBattleSystem被调用
      expect(engine['bossBattleSystem'].updateConfig).toHaveBeenCalled();
      expect(engine['bossBattleSystem'].updateBossBattle).toHaveBeenCalled();
    });
  });

  describe('游戏状态管理', () => {
    it('应该支持游戏状态切换', () => {
      // 初始状态为菜单
      expect(engine['state']).toBe(GameState.MENU);
      
      // 切换到游戏进行中
      engine['state'] = GameState.PLAYING;
      expect(engine['state']).toBe(GameState.PLAYING);
      
      // 切换到游戏暂停
      engine['state'] = GameState.PAUSED;
      expect(engine['state']).toBe(GameState.PAUSED);
      
      // 切换到游戏结束
      engine['state'] = GameState.GAME_OVER;
      expect(engine['state']).toBe(GameState.GAME_OVER);
    });

    it('应该正确处理游戏重置', () => {
      // 修改一些游戏状态
      engine['state'] = GameState.GAME_OVER;
      engine['currentWave'] = 10;
      engine['defenseHp'] = 50;
      
      // 执行游戏重置（通过backToMenu方法）
      engine['backToMenu']();
      
      // 验证游戏状态被重置
      expect(engine['state']).toBe(GameState.MENU);
      expect(engine['currentWave']).toBe(1);
      expect(engine['defenseHp']).toBe(engine['maxDefenseHp']);
    });
  });
});