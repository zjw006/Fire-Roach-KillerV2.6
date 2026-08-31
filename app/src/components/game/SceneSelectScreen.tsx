/**
 * @fileoverview 场景选择界面组件
 * 按固定顺序展示所有可解锁场景，已解锁场景显示名称、敌人强度、奖励倍率和天气信息，
 * 未解锁场景显示解锁条件，页面加载后自动滚动到最新解锁的场景位置。
 */

import React, { useRef, useLayoutEffect } from 'react';
import { ArrowLeft, Map, Lock, Check, Flame } from 'lucide-react';
import type { GameProgress, SceneType } from '@/game/types';
import { SCENE_CONFIGS, STORY_LEVELS } from '@/game/data';
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

  /** 找到最后一个已解锁关卡，用于自动滚动定位 */
  const lastUnlockedLevel = [...STORY_LEVELS].reverse().find(l => scenesUnlocked.includes(l.id));
  const lastUnlockedIndex = lastUnlockedLevel ? STORY_LEVELS.indexOf(lastUnlockedLevel) : 0;

  /** 自动滚动到最新解锁关卡 */
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

  /** 关卡列表：按 STORY_LEVELS 顺序渲染（11 简单 + 6 困难），已解锁可点击选择 */
  return (
    <div ref={containerRef} className="absolute inset-0 flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-md mx-auto px-4 pt-4 pb-2 shrink-0">
        {/* Header - 顶部固定区域 */}
        <h2 className="text-2xl font-bold text-white text-center mb-4 flex items-center justify-center gap-2">
          <Map size={20} className="text-amber-400" />
          场景选择
          <span className="text-sm font-normal text-amber-400 ml-1">({scenesUnlocked.length}/{STORY_LEVELS.length})</span>
        </h2>
      </div>

      {/* 中间可滚动列表区 */}
      <div className="flex-1 overflow-y-auto px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-700/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-stone-600/60">
        <div className="w-full max-w-md mx-auto">
          <div className="space-y-3 py-2">
          {STORY_LEVELS.map((level, index) => {
            const scene = SCENE_CONFIGS[level.scene];
            const isHard = level.difficulty === 'hard';
            const isUnlocked = scenesUnlocked.includes(level.id);
            const isLastUnlocked = index === lastUnlockedIndex;
            // 该关卡历史最佳星级（0-3，防线血量不含加血评级，过关多次取最多）
            const bestStars = progress?.levelStars?.[level.id] ?? 0;

            return (
              <div
                key={level.id}
                id={'scene-card-' + index}
                className={isLastUnlocked ? 'ring-2 ring-amber-400 rounded-xl' : ''}
              >
                <button
                  onClick={() => { audio?.playClick(); if (isUnlocked) onSelectScene(level.scene); }}
                  disabled={!isUnlocked}
                  className={`w-full text-left rounded-xl border transition-all overflow-hidden ${
                    isUnlocked
                      ? isHard ? 'border-red-900/80 hover:border-red-700 hover:scale-[1.02]' : 'border-stone-600 hover:border-stone-400 hover:scale-[1.02]'
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
                      <div className={`font-bold text-sm flex items-center gap-1.5 ${isUnlocked ? 'text-white' : 'text-stone-500'}`}>
                        {level.name}
                        {isHard && isUnlocked && (
                          <span className="text-[9px] font-mono text-red-400 border border-red-700/70 rounded px-1 py-px leading-none">困难</span>
                        )}
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
                        通关{index > 0 ? STORY_LEVELS[index - 1].name : ''}解锁
                      </div>
                    )}
                  </div>
                </div>

                {/* 星级评价槽：默认3槽，点亮历史最佳（图标与结算界面一致） */}
                <div className="bg-black/70 px-4 py-1.5 flex items-center justify-center gap-2">
                  {[1, 2, 3].map((star) => (
                    <div
                      key={star}
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isUnlocked && star <= bestStars
                          ? 'bg-yellow-500 text-white shadow-md'
                          : 'bg-stone-800/80 text-stone-600 border border-stone-700'
                      }`}
                    >
                      <Flame size={11} />
                    </div>
                  ))}
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
          {/* 底部占位，给返回按钮留出可视空间 */}
          <div className="h-2" />
        </div>
      </div>

      {/* 底部固定返回按钮区域 */}
      <div className="w-full max-w-md mx-auto px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] shrink-0">
        <button
          onClick={() => { audio?.playClick(); onClose(); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800/80 border border-stone-700 text-stone-300 hover:text-white hover:border-stone-500 hover:bg-stone-700/80 active:scale-[0.98] transition-all"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">返回主菜单</span>
        </button>
      </div>
    </div>
  );
};
