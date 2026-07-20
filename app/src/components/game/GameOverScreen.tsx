/**
 * @fileoverview 游戏结束结算界面组件
 * 根据胜利/失败状态展示不同的结算画面，包含到达波次、总击杀、最终资金等战斗统计数据，
 * 胜利时支持进入下一场景或前往天赋树加点，失败时可重新开始或返回主菜单。
 */

import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Home, Skull, Trophy, Flame, Sparkles, Map, ChevronRight, Lightbulb } from 'lucide-react';
import { TEXT_CONFIG } from '@/game/data';
import type { Economy, GameMode, SceneType } from '@/game/types';
import type { AudioManager } from '@/game/audio';


interface GameOverScreenProps {
  economy: Economy;
  wave: number;
  gameMode?: GameMode;
  currentScene?: SceneType;
  isVictory: boolean;
  hasNextScene?: boolean;
  nextSceneName?: string;
  onRestart: () => void;
  onQuit: () => void;
  onNextScene?: () => void;
  talentPoints?: number;
  bossDefeated?: boolean;
  onOpenTalentTree?: () => void;
  audio?: AudioManager;
  menuMoney?: number; // Cross-level total money (menuShopMoney)
  /** 关卡内获得的金币奖励（用于胜利结算动画） */
  victoryGoldReward?: number;
  /** 结算动画完成后回调（发放金币到经济系统） */
  onSettleGold?: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ economy, wave, gameMode, currentScene, isVictory, hasNextScene, nextSceneName, onRestart, onQuit, onNextScene, talentPoints, bossDefeated, onOpenTalentTree, audio, victoryGoldReward, onSettleGold}) => {
  /** 判断当前场景和模式类型 */
  const isBasement = currentScene === 'basement';
  const isBossMode = bossDefeated;
  const isEndless = gameMode === 'endless';
  const videoRef = useRef<HTMLVideoElement>(null);

  /** 金币动画状态 */
  const hasReward = (victoryGoldReward ?? 0) > 0;
  const baseGold = economy.money;
  const finalGold = baseGold + (victoryGoldReward ?? 0);
  const [displayGold, setDisplayGold] = useState(hasReward ? baseGold : finalGold);
  const [animationDone, setAnimationDone] = useState(!hasReward);

  useEffect(() => {
    if (!hasReward) {
      // No reward to animate, settle immediately
      onSettleGold?.();
      return;
    }

    const reward = victoryGoldReward ?? 0;
    // 动态时长：基础 1000ms + 每金币 3ms，最低 800ms，最高 5000ms
    const duration = Math.max(800, Math.min(1000 + reward * 3, 5000));
    const tickInterval = 50; // 固定 50ms 间隔，音效以固定节奏播放
    const steps = Math.round(duration / tickInterval);
    const stepAmount = reward / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newGold = Math.min(baseGold + Math.round(stepAmount * currentStep), finalGold);
      setDisplayGold(newGold);
      audio?.playCoinTick();

      if (currentStep >= steps) {
        clearInterval(timer);
        setDisplayGold(finalGold);
        setAnimationDone(true);
        onSettleGold?.();
      }
    }, tickInterval);

    return () => clearInterval(timer);
  }, []); // Run only once on mount

  const modeName = isBossMode ? TEXT_CONFIG.ui.gameOver.bossModeName : isEndless ? TEXT_CONFIG.ui.gameOver.endlessMode : gameMode === 'daily' ? TEXT_CONFIG.ui.gameOver.dailyModeName : TEXT_CONFIG.ui.gameOver.storyMode;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
      {/* Video background - full screen loop */}
      <video
        ref={videoRef}
        src="/assets/gameover_bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-sm mx-4 flex flex-col items-center">
        {/* Header */}
        <div className="mb-4">
          {isVictory ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-3 shadow-lg shadow-yellow-500/30 ring-2 ring-yellow-400/50">
                <Trophy size={32} className="text-white" />
              </div>
              <h2 className="text-3xl font-black text-yellow-400 text-center drop-shadow-lg">{isBossMode ? TEXT_CONFIG.ui.gameOver.bossDefeatedShort : TEXT_CONFIG.combat.victory}</h2>
              <p className="text-stone-300 text-center text-sm mt-1 drop-shadow">{isBossMode ? TEXT_CONFIG.ui.gameOver.bossVictoryDesc : TEXT_CONFIG.ui.gameOver.victoryDesc}</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mb-3 shadow-lg shadow-red-600/30 ring-2 ring-red-500/50">
                <Skull size={32} className="text-white" />
              </div>
              <h2 className="text-3xl font-black text-red-400 text-center drop-shadow-lg">{TEXT_CONFIG.ui.gameOver.defenseBreached}</h2>
              <p className="text-stone-300 text-center text-sm mt-1 drop-shadow">
                {isEndless ? TEXT_CONFIG.ui.gameOver.endlessDefeat(wave) : TEXT_CONFIG.ui.gameOver.defeatDesc}
              </p>
            </>
          )}
        </div>

        {/* Mode badge */}
        <div className="mb-3 bg-black/50 rounded-lg px-3 py-1 flex items-center gap-2">
          <Map size={12} className="text-stone-400" />
          <span className="text-xs text-stone-300">{modeName}</span>
          {talentPoints !== undefined && talentPoints > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <Sparkles size={12} className="text-yellow-400" />
              <span className="text-xs text-yellow-400">{talentPoints} 天赋点</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 mb-4 w-full border border-white/10 shadow-xl">
          {/** 战斗统计数据：波次、击杀、资金、各类蟑螂击杀数 */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center">
              <div className="text-stone-400 text-[10px]">{TEXT_CONFIG.ui.gameOver.waveReached}</div>
              <div className="text-lg font-bold text-white">{wave}</div>
            </div>
            <div className="text-center">
              <div className="text-stone-400 text-[10px]">{TEXT_CONFIG.ui.gameOver.totalKills}</div>
              <div className="text-lg font-bold text-red-400">{economy.totalKills}</div>
            </div>
            <div className="text-center">
              <div className="text-stone-400 text-[10px]">{TEXT_CONFIG.ui.gameOver.finalMoney}</div>
              <div className={`text-lg font-bold text-amber-400 ${hasReward && !animationDone ? 'animate-pulse' : ''}`}>
                ¥{animationDone ? economy.money : displayGold}
                {hasReward && !animationDone && (
                  <span className="text-xs text-green-400 ml-0.5">+{victoryGoldReward}</span>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="text-stone-400 text-[10px]">{TEXT_CONFIG.ui.gameOver.smallRoach}</div>
              <div className="text-base font-bold text-orange-300">{economy.smallKills}</div>
            </div>
            <div className="text-center">
              <div className="text-stone-400 text-[10px]">{TEXT_CONFIG.ui.gameOver.largeRoach}</div>
              <div className="text-base font-bold text-orange-300">{economy.largeKills}</div>
            </div>
            <div className="text-center">
              <div className="text-stone-400 text-[10px]">{TEXT_CONFIG.ui.gameOver.breaches}</div>
              <div className="text-base font-bold text-red-300">{economy.breaches}</div>
            </div>
          </div>

          {/* New enemy kills */}
          {(economy.flyingKills > 0 || economy.armoredKills > 0 || economy.queenKills > 0) && (
            <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-4 gap-1">
              {/** 特殊敌人击杀统计：飞行、装甲、分裂、女王 */}
              {economy.flyingKills > 0 && (
                <div className="text-center">
                  <div className="text-stone-500 text-[9px]">{TEXT_CONFIG.ui.gameOver.flying}</div>
                  <div className="text-sm font-bold text-amber-300">{economy.flyingKills}</div>
                </div>
              )}
              {economy.armoredKills > 0 && (
                <div className="text-center">
                  <div className="text-stone-500 text-[9px]">{TEXT_CONFIG.ui.gameOver.armored}</div>
                  <div className="text-sm font-bold text-stone-300">{economy.armoredKills}</div>
                </div>
              )}
              {economy.splittingKills > 0 && (
                <div className="text-center">
                  <div className="text-stone-500 text-[9px]">{TEXT_CONFIG.ui.gameOver.splitting}</div>
                  <div className="text-sm font-bold text-amber-300">{economy.splittingKills}</div>
                </div>
              )}
              {economy.queenKills > 0 && (
                <div className="text-center">
                  <div className="text-stone-500 text-[9px]">{TEXT_CONFIG.ui.gameOver.queen}</div>
                  <div className="text-sm font-bold text-rose-300">{economy.queenKills}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ratings */}
        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 3].map((star) => (
            <div
              key={star}
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md ${
                (isVictory && star <= 3) || (!isVictory && star <= 1)
                  ? 'bg-yellow-500 text-white'
                  : 'bg-stone-800/80 text-stone-600 border border-stone-700'
              }`}
            >
              <Flame size={16} />
            </div>
          ))}
        </div>

        {/* Basement talent guide */}
        {/** 地下室通关后引导玩家前往天赋树加点 */}
        {isBasement && talentPoints && talentPoints > 0 && onOpenTalentTree && (
          <div className="bg-gradient-to-r from-yellow-900/60 to-orange-900/60 border border-yellow-500/40 rounded-xl p-3 mb-4 flex items-center gap-3 animate-pulse">
            <Lightbulb size={24} className="text-yellow-400 shrink-0" />
            <div className="flex-1">
              <div className="text-yellow-300 text-sm font-bold">{TEXT_CONFIG.ui.gameOver.talentUnlocked}</div>
              <div className="text-yellow-400/70 text-xs">{TEXT_CONFIG.ui.gameOver.talentDesc}</div>
            </div>
            <button
              onClick={() => { audio?.playClick(); onOpenTalentTree(); }}
              className="shrink-0 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <Sparkles size={12} />
              {TEXT_CONFIG.ui.gameOver.goAddPoints}
            </button>
          </div>
        )}

        {/* Buttons */}
        <div className="w-full space-y-2">
          {/* Next Scene button - only show on victory in story mode when next scene exists */}
          {isVictory && hasNextScene && onNextScene && (
            <button
              onClick={() => { audio?.playClick(); onNextScene(); }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-900/40 animate-pulse"
            >
              <span>{TEXT_CONFIG.ui.gameOver.nextLevel(nextSceneName || '')}</span>
              <ChevronRight size={18} />
            </button>
          )}

          <button
            onClick={() => { audio?.playClick(); onRestart(); }}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-900/40"
          >
            <RotateCcw size={18} />
            {TEXT_CONFIG.ui.gameOver.playAgain}
          </button>

          <button
            onClick={() => { audio?.playClick(); onQuit(); }}
            className="w-full flex items-center justify-center gap-2 bg-stone-800/80 hover:bg-stone-700/80 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105 active:scale-95 border border-stone-600/50 backdrop-blur-sm"
          >
            <Home size={18} />
            {TEXT_CONFIG.ui.gameOver.backToMenu}
          </button>
        </div>
      </div>
    </div>
  );
};
