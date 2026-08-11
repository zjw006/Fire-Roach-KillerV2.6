/**
 * @fileoverview 场景选择界面组件
 * 按固定顺序展示所有可解锁场景，已解锁场景显示名称、敌人强度、奖励倍率和天气信息，
 * 未解锁场景显示解锁条件，页面加载后自动滚动到最新解锁的场景位置。
 */

import React, { useRef, useLayoutEffect } from 'react';
import { ArrowLeft, Map, Lock, Check } from 'lucide-react';
import type { GameProgress, SceneType } from '@/game/types';
import { SCENE_CONFIGS, SCENE_ORDER } from '@/game/data';
import type { AudioManager } from '@/game/audio';

interface SceneSelectScreenProps {
  progress: GameProgress;
  onSelectScene: (scene: SceneType) => void;
  onClose: () => void;
  audio?: AudioManager;
}

export const SceneSelectScreen: React.FC<SceneSelectScreenProps> = ({ progress, onSelectScene, onClose, audio }) => {
  const scenesUnlocked = progress?.scenesUnlocked || ['kitchen'];
  const containerRef = useRef<HTMLDivElement>(null);

  /** 找到最后一个已解锁场景，用于自动滚动定位 */
  const lastUnlockedScene = [...SCENE_ORDER].reverse().find(s => scenesUnlocked.includes(s));
  const lastUnlockedIndex = SCENE_ORDER.indexOf(lastUnlockedScene as SceneType);

  /** 自动滚动到最新解锁场景 */
  useLayoutEffect(() => {
    const doScroll = () => {
      const el = document.getElementById('scene-card-' + lastUnlockedIndex);
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      }
    };
    // Immediate attempt + delayed fallback for async layouts
    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 50);
  }, [lastUnlockedIndex]);

  /** 场景列表：按 SCENE_ORDER 顺序渲染，已解锁可点击选择，未解锁显示解锁条件 */
  return (
    <div ref={containerRef} className="absolute inset-0 flex items-start justify-center bg-black/90 backdrop-blur-sm overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-700/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-stone-600/60">
      <div className="w-full max-w-md mx-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => { audio?.playClick(); onClose(); }}
            className="flex items-center gap-1 text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">返回</span>
          </button>
          <div className="flex items-center gap-2">
            <Map size={16} className="text-amber-400" />
            <span className="text-amber-400 font-bold">{scenesUnlocked.length}/{SCENE_ORDER.length}</span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-4">场景选择</h2>

        <div className="space-y-3 pb-8 pt-2">
          {SCENE_ORDER.map((sceneType, index) => {
            const scene = SCENE_CONFIGS[sceneType];
            const isUnlocked = scenesUnlocked.includes(sceneType);
            const isLastUnlocked = index === lastUnlockedIndex;

            return (
              <div
                key={sceneType}
                id={'scene-card-' + index}
                className={isLastUnlocked ? 'ring-2 ring-amber-400 rounded-xl' : ''}
              >
                <button
                  onClick={() => { audio?.playClick(); if (isUnlocked) onSelectScene(sceneType); }}
                  disabled={!isUnlocked}
                  className={`w-full text-left rounded-xl border transition-all overflow-hidden ${
                    isUnlocked
                      ? 'border-stone-600 hover:border-stone-400 hover:scale-[1.02]'
                      : 'border-stone-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                {/* Scene preview */}
                <div
                  className="h-16 flex items-center px-4"
                  style={{ background: `linear-gradient(135deg, ${scene.bgColor}dd, ${scene.bgColor}88)` }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isUnlocked ? 'bg-white/20' : 'bg-black/30'
                    }`}>
                      {isUnlocked ? (
                        <Map size={18} className="text-white" />
                      ) : (
                        <Lock size={16} className="text-stone-500" />
                      )}
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${isUnlocked ? 'text-white' : 'text-stone-500'}`}>
                        {scene.name}
                      </div>
                      <div className="text-[10px] text-stone-400">{scene.description}</div>
                    </div>
                  </div>

                  <div className="ml-auto text-right">
                    {isUnlocked ? (
                      <>
                        <div className="text-[10px] text-amber-400 flex items-center gap-1">
                          <Check size={10} /> 已解锁
                        </div>
                        <div className="text-[10px] text-yellow-400">
                          奖励x{scene.rewardMultiplier}
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-stone-600">
                        通关{SCENE_ORDER[index - 1] ? SCENE_CONFIGS[SCENE_ORDER[index - 1]].name : ''}解锁
                      </div>
                    )}
                  </div>
                </div>

                {/* Scene info */}
                {isUnlocked && (
                  <div className="bg-black/60 px-4 py-2 flex items-center gap-3 text-[10px] text-stone-400">
                    <span>敌人强度: <span className="text-red-400">{scene.enemyModifier}x</span></span>
                    <span>奖励倍率: <span className="text-yellow-400">{scene.rewardMultiplier}x</span></span>
                    <span>天气: <span className="text-amber-400">{scene.weather === 'none' ? '无' : scene.weather === 'rain' ? '雨' : scene.weather === 'fog' ? '雾' : '夜间'}</span></span>
                  </div>
                )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
