/**
 * @fileoverview 新游戏引擎测试页面
 * @description 用于测试NewGameEngine的功能和性能
 */

import React, { useEffect, useRef, useState } from 'react';
import { NewGameEngine, type NewGameEngineConfig } from '../game/engine/NewGameEngine';
import { GameMode, SceneType } from '../game/types';

/**
 * 新游戏引擎测试页面组件
 */
const TestEngine: React.FC = () => {
  // 画布引用
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 游戏引擎实例引用
  const engineRef = useRef<NewGameEngine | null>(null);
  
  // 游戏状态
  const [isRunning, setIsRunning] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.STORY);
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');
  const [scene, setScene] = useState<SceneType>(SceneType.KITCHEN);
  const [gameState, setGameState] = useState<string>('MENU');
  const [isMuted, setIsMuted] = useState(false);
  
  /**
   * 初始化游戏引擎
   */
  const initEngine = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('无法获取Canvas上下文');
      return;
    }
    
    // 创建引擎配置
    const config: NewGameEngineConfig = {
      canvas,
      ctx,
      gameMode,
      difficulty,
      currentScene: scene
    };
    
    // 创建游戏引擎实例
    engineRef.current = new NewGameEngine(config);
    
    console.log('游戏引擎初始化完成');
  };
  
  /**
   * 启动游戏引擎
   */
  const startEngine = () => {
    if (!engineRef.current) {
      console.error('游戏引擎未初始化');
      return;
    }
    
    engineRef.current.start();
    setIsRunning(true);
    console.log('游戏引擎已启动');
  };
  
  /**
   * 停止游戏引擎
   */
  const stopEngine = () => {
    if (!engineRef.current) {
      console.error('游戏引擎未初始化');
      return;
    }
    
    engineRef.current.stop();
    setIsRunning(false);
    console.log('游戏引擎已停止');
  };
  
  /**
   * 切换游戏状态
   */
  const toggleEngine = () => {
    if (isRunning) {
      stopEngine();
    } else {
      startEngine();
    }
  };
  
  /**
   * 重置游戏引擎
   */
  const resetEngine = () => {
    stopEngine();
    initEngine();
    console.log('游戏引擎已重置');
  };
  
  /**
   * 获取玩家信息
   */
  const getPlayerInfo = () => {
    if (!engineRef.current) return null;
    
    const player = engineRef.current.getPlayer();
    return {
      position: `(${player.x.toFixed(1)}, ${player.y.toFixed(1)})`,
      gas: `${player.gas.toFixed(1)}/${player.maxGas}`,
      heat: `${player.heat.toFixed(1)}/${player.maxHeat}`,
      weapon: player.currentWeapon
    };
  };
  
  /**
   * 获取游戏状态信息
   */
  const getGameInfo = () => {
    if (!engineRef.current) return null;
    
    return {
      wave: engineRef.current.getCurrentWave(),
      defenseHp: `${engineRef.current.getDefenseHp()}/${engineRef.current.getMaxDefenseHp()}`,
      money: engineRef.current.getEconomy().money
    };
  };
  
  // 组件挂载时初始化引擎
  useEffect(() => {
    initEngine();
    
    // 定期更新游戏状态显示
    const updateInterval = setInterval(() => {
      if (engineRef.current) {
        setGameState(engineRef.current.getState());
        setIsMuted(engineRef.current.isMuted());
      }
    }, 100); // 每100毫秒更新一次
    
    // 组件卸载时停止引擎和定时器
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
      clearInterval(updateInterval);
    };
  }, []);
  
  // 当游戏模式、难度或场景变化时重新初始化引擎
  useEffect(() => {
    if (engineRef.current) {
      resetEngine();
    }
  }, [gameMode, difficulty, scene]);
  
  const playerInfo = getPlayerInfo();
  const gameInfo = getGameInfo();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* 标题区域 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">新游戏引擎测试页面</h1>
          <p className="text-gray-400">测试NewGameEngine的功能和性能</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：控制面板 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 引擎控制 */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">引擎控制</h2>
              
              <div className="space-y-4">
                <button
                  onClick={toggleEngine}
                  className={`w-full py-3 rounded-lg font-bold transition-colors ${
                    isRunning 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isRunning ? '停止引擎' : '启动引擎'}
                </button>
                
                <button
                  onClick={resetEngine}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors"
                >
                  重置引擎
                </button>
                
                {/* 游戏状态切换按钮 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => engineRef.current?.startGame()}
                    className="py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold transition-colors"
                  >
                    开始游戏
                  </button>
                  
                  <button
                    onClick={() => engineRef.current?.pauseGame()}
                    className="py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold transition-colors"
                  >
                    暂停游戏
                  </button>
                  
                  <button
                    onClick={() => engineRef.current?.resumeGame()}
                    className="py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors"
                  >
                    继续游戏
                  </button>
                  
                  <button
                    onClick={() => engineRef.current?.gameOver()}
                    className="py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
                  >
                    游戏结束
                  </button>
                  
                  <button
                    onClick={() => engineRef.current?.backToMenu()}
                    className="col-span-2 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition-colors"
                  >
                    返回主菜单
                  </button>
                </div>
                
                {/* 音效控制按钮 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => engineRef.current?.playFire()}
                    className="py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold transition-colors"
                  >
                    开火音效
                  </button>
                  
                  <button
                    onClick={() => engineRef.current?.stopFire()}
                    className="py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-bold transition-colors"
                  >
                    停止开火
                  </button>
                  
                  <button
                    onClick={() => engineRef.current?.playKill()}
                    className="py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
                  >
                    击杀音效
                  </button>
                  
                  <button
                    onClick={() => engineRef.current?.playSwatter()}
                    className="py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold transition-colors"
                  >
                    电蚊拍音效
                  </button>
                  
                  <button
                    onClick={() => engineRef.current?.toggleMute()}
                    className="col-span-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors"
                  >
                    切换静音
                  </button>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">引擎状态:</span>
                  <span className={`font-bold ${isRunning ? 'text-green-400' : 'text-red-400'}`}>
                    {isRunning ? '运行中' : '已停止'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <span className="text-gray-300">游戏状态:</span>
                  <span className={`font-bold ${
                    gameState === 'MENU' ? 'text-blue-400' :
                    gameState === 'COUNTDOWN' ? 'text-yellow-400' :
                    gameState === 'PLAYING' ? 'text-green-400' :
                    gameState === 'PAUSED' ? 'text-orange-400' :
                    gameState === 'GAME_OVER' ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {gameState || '未知'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <span className="text-gray-300">静音状态:</span>
                  <span className={`font-bold ${isMuted ? 'text-red-400' : 'text-green-400'}`}>
                    {isMuted ? '已静音' : '正常'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* 游戏设置 */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">游戏设置</h2>
              
              <div className="space-y-4">
                {/* 游戏模式 */}
                <div>
                  <label className="block text-gray-300 mb-2">游戏模式</label>
                  <div className="flex space-x-2">
                    {Object.values(GameMode).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setGameMode(mode)}
                        className={`flex-1 py-2 rounded-lg transition-colors ${
                          gameMode === mode
                            ? 'bg-purple-600'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* 难度 */}
                <div>
                  <label className="block text-gray-300 mb-2">难度</label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setDifficulty('easy')}
                      className={`flex-1 py-2 rounded-lg transition-colors ${
                        difficulty === 'easy'
                          ? 'bg-green-600'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      简单
                    </button>
                    <button
                      onClick={() => setDifficulty('hard')}
                      className={`flex-1 py-2 rounded-lg transition-colors ${
                        difficulty === 'hard'
                          ? 'bg-red-600'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      困难
                    </button>
                  </div>
                </div>
                
                {/* 场景 */}
                <div>
                  <label className="block text-gray-300 mb-2">场景</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(SceneType).map((sceneType) => (
                      <button
                        key={sceneType}
                        onClick={() => setScene(sceneType)}
                        className={`py-2 rounded-lg transition-colors ${
                          scene === sceneType
                            ? 'bg-blue-600'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        {sceneType}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 玩家信息 */}
            {playerInfo && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4">玩家信息</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">位置:</span>
                    <span className="font-bold">{playerInfo.position}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-300">燃料:</span>
                    <span className="font-bold">{playerInfo.gas}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-300">热量:</span>
                    <span className="font-bold">{playerInfo.heat}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-300">当前武器:</span>
                    <span className="font-bold">{playerInfo.weapon}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* 游戏信息 */}
            {gameInfo && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4">游戏信息</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">当前波次:</span>
                    <span className="font-bold">{gameInfo.wave}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-300">防御生命值:</span>
                    <span className="font-bold">{gameInfo.defenseHp}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-300">金钱:</span>
                    <span className="font-bold">${gameInfo.money}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* 右侧：游戏画布 */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-xl p-6 h-full">
              <h2 className="text-xl font-bold mb-4">游戏画面</h2>
              
              <div className="relative">
                {/* 画布容器 */}
                <div className="bg-black rounded-lg overflow-hidden border-2 border-gray-700">
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    className="w-full h-auto"
                  />
                </div>
                
                {/* 画布说明 */}
                <div className="mt-4 text-gray-400 text-sm">
                  <p>画布尺寸: 800 × 600 像素</p>
                  <p className="mt-1">
                    当前显示: {isRunning ? '游戏运行中' : '默认画面'}
                    {isRunning && ' - 查看左上角的性能监控信息'}
                  </p>
                </div>
                
                {/* 测试说明 */}
                <div className="mt-6 bg-gray-900 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2">测试说明</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li>• 点击"启动引擎"按钮开始游戏循环</li>
                    <li>• 左上角显示FPS、帧时间和内存使用情况</li>
                    <li>• 彩色圆形为测试实体，使用MathUtils工具函数进行移动</li>
                    <li>• 红色圆形为玩家，黄色线条表示玩家方向</li>
                    <li>• 当测试实体靠近玩家时，会改变颜色并显示距离</li>
                    <li>• 玩家属性（燃料、热量）会自动更新和限制</li>
                    <li>• 使用"游戏状态切换"按钮测试不同游戏状态</li>
                    <li>• 暂停和游戏结束状态会显示相应的界面</li>
                    <li>• 使用"音效控制"按钮测试音效系统</li>
                    <li>• 开火音效会自动根据玩家开火状态控制</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 底部信息 */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400">
              <p>NewGameEngine版本: 1.0.0 | 模块化架构测试版</p>
            </div>
            
            <div className="mt-4 md:mt-0">
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestEngine;