/**
 * @fileoverview 成就系统界面组件
 * 展示玩家已解锁和未解锁的成就列表，支持按"全部/已解锁/未解锁"分类筛选，
 * 包含进度条、分类图标和奖励展示。打开时自动播放新解锁成就的弹出动画。
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Lock, Check, Trophy, Target, Zap,
  Shield, Flame, Star, Crown, Crosshair, TrendingUp
} from 'lucide-react';
import { TEXT_CONFIG } from '@/game/data';
import type { GameProgress } from '@/game/types';
import type { AudioManager } from '@/game/audio';
import type { AchievementData } from '@/game/engine/achievement/AchievementSystem';


interface AchievementsScreenProps {
  progress: GameProgress;
  onClose: () => void;
  audio?: AudioManager;
  /** 待播放动画的新解锁成就列表 */
  pendingAnimations?: AchievementData[];
  /** 单个动画播放完成回调 */
  onAnimationComplete?: (id: string) => void;
  /** 全部动画播放完成（关闭动画队列） */
  onAllAnimationsComplete?: () => void;
}

/** 成就分类对应的图标映射 */
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  kill: <Crosshair size={14} />,
  wave: <TrendingUp size={14} />,
  endless: <Zap size={14} />,
  money: <Star size={14} />,
  perfect: <Shield size={14} />,
  boss: <Crown size={14} />,
  weapon: <Flame size={14} />,
  talent: <Target size={14} />,
  default: <Trophy size={14} />,
};

/** 根据成就 ID 推断其所属分类 */
function getCategory(id: string): string {
  if (id.includes('kill') || id.includes('slayer') || id.includes('exterminator') || id.includes('blood')) return 'kill';
  if (id.includes('wave')) return 'wave';
  if (id.includes('endless')) return 'endless';
  if (id.includes('money')) return 'money';
  if (id.includes('perfect') || id.includes('breach')) return 'perfect';
  if (id.includes('queen')) return 'boss';
  if (id.includes('weapon')) return 'weapon';
  if (id.includes('talent')) return 'talent';
  return 'default';
}

/** 成就解锁弹窗动画组件 */
const AchievementUnlockPopup: React.FC<{
  achievement: AchievementData;
  onComplete: () => void;
  audio?: AudioManager;
}> = ({ achievement, onComplete, audio }) => {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; angle: number; color: string; delay: number }[]>([]);

  useEffect(() => {
    // 播放音效
    audio?.playAchievementUnlock();

    // 生成粒子
    const colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#fef3c7', '#fffbeb'];
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 0,
      y: 0,
      angle: (i / 12) * 360,
      color: colors[i % colors.length],
      delay: 400 + i * 30,
    }));
    setParticles(newParticles);

    // 动画时序
    const enterTimer = setTimeout(() => setPhase('show'), 600);
    const exitTimer = setTimeout(() => setPhase('exit'), 1800);
    const completeTimer = setTimeout(() => onComplete(), 2200);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  // 阶段样式
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    opacity: phase === 'exit' ? 0 : 1,
    transition: 'opacity 0.4s ease-out',
  };

  const avatarStyle: React.CSSProperties = {
    width: 80,
    height: 80,
    borderRadius: '50%',
    border: '3px solid #fbbf24',
    boxShadow: '0 0 30px rgba(251, 191, 36, 0.5)',
    objectFit: 'cover',
    flexShrink: 0,
    transform: phase === 'enter' ? 'translateX(-60px) scale(0.8)' : 'translateX(0) scale(1)',
    opacity: phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1,
    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  const bubbleStyle: React.CSSProperties = {
    position: 'relative',
    background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
    border: '2px solid #fbbf24',
    borderRadius: 16,
    padding: '16px 20px',
    maxWidth: 220,
    transform: phase === 'enter' ? 'scale(0)' : 'scale(1)',
    opacity: phase === 'exit' ? 0 : 1,
    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transitionDelay: '0.15s',
  };

  const bubbleArrowStyle: React.CSSProperties = {
    position: 'absolute',
    left: -8,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 0,
    height: 0,
    borderTop: '8px solid transparent',
    borderBottom: '8px solid transparent',
    borderRight: '8px solid #fbbf24',
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
        {/* 樟树头像 */}
        <img
          src="/assets/avatar_zhangshu.png"
          alt="樟树"
          style={avatarStyle}
          onError={(e) => { (e.target as HTMLImageElement).src = '/assets/zhangshu-avatar.jpg'; }}
        />

        {/* 气泡文字 */}
        <div style={bubbleStyle}>
          <div style={bubbleArrowStyle} />
          <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>
            {TEXT_CONFIG.ui.achievements.unlockTitle || '成就解锁！'}
          </div>
          <div style={{ fontSize: 15, color: '#fff', fontWeight: 800, marginBottom: 2 }}>
            {achievement.name}
          </div>
          <div style={{ fontSize: 12, color: '#d6d3d1' }}>
            {achievement.description}
          </div>
          <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700, marginTop: 6 }}>
            +¥{achievement.reward}
          </div>
        </div>

        {/* 粒子特效 */}
        {particles.map((p) => {
          const isActive = phase === 'show';
          const dist = 80 + (p.id % 3) * 30;
          const rad = (p.angle * Math.PI) / 180;
          const dx = Math.cos(rad) * dist;
          const dy = Math.sin(rad) * dist;
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: p.color,
                transform: isActive ? `translate(${dx}px, ${dy}px) scale(1)` : 'translate(0, 0) scale(0)',
                opacity: isActive ? 1 : 0,
                transition: `all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
                transitionDelay: `${p.delay}ms`,
                boxShadow: `0 0 6px ${p.color}`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({
  progress, onClose, audio,
  pendingAnimations, onAnimationComplete, onAllAnimationsComplete,
}) => {
  /** 筛选状态：全部 / 已解锁 / 未解锁 */
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  /** 当前正在播放动画的成就索引 */
  const [animIndex, setAnimIndex] = useState(0);
  /** 动画是否全部播放完毕 */
  const [animationsDone, setAnimationsDone] = useState(false);
  const hasAnimations = pendingAnimations && pendingAnimations.length > 0;

  useEffect(() => {
    if (!hasAnimations) {
      setAnimationsDone(true);
    }
  }, [hasAnimations]);

  const handleAnimationComplete = (id: string) => {
    onAnimationComplete?.(id);
    if (pendingAnimations && animIndex + 1 < pendingAnimations.length) {
      setAnimIndex(prev => prev + 1);
    } else {
      setAnimationsDone(true);
      onAllAnimationsComplete?.();
    }
  };

  const all = progress.achievements;
  const unlockedList = all.filter(a => a.unlocked);
  const lockedList = all.filter(a => !a.unlocked);

  /** 根据筛选条件计算当前展示列表与完成度 */
  const displayList = filter === 'all' ? all : filter === 'unlocked' ? unlockedList : lockedList;
  const unlocked = unlockedList.length;
  const total = all.length;
  const progressPercent = total > 0 ? (unlocked / total) * 100 : 0;

  return (
    <>
      {/* 成就解锁动画覆盖层 */}
      {hasAnimations && !animationsDone && pendingAnimations && (
        <AchievementUnlockPopup
          achievement={pendingAnimations[animIndex]}
          onComplete={() => handleAnimationComplete(pendingAnimations[animIndex].id)}
          audio={audio}
        />
      )}

      <div className="absolute inset-0 flex flex-col">
        {/* Background image - rooftop with lightning (fixed to viewport) */}
        <div
          className="fixed inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/assets/achieve_bg.jpg)' }}
        />
        {/* Dark overlay for readability (fixed to viewport) */}
        <div className="fixed inset-0 bg-black/70" />

        <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col h-dvh">
          {/* Fixed header section */}
          <div className="pt-6 shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { audio?.playClick(); onClose(); }}
                className="flex items-center gap-1 text-stone-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={18} />
                <span className="text-sm">{TEXT_CONFIG.ui.achievements.back}</span>
              </button>
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-yellow-400" />
                <span className="text-yellow-400 font-bold">{unlocked}/{total}</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white text-center mb-2">{TEXT_CONFIG.ui.achievements.title}</h2>

            {/* Progress bar */}
            <div className="bg-stone-800 rounded-full h-2.5 mb-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-center text-xs text-stone-500 mb-4">
              {TEXT_CONFIG.ui.achievements.completion(progressPercent.toFixed(1))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-3 bg-stone-900/60 rounded-xl p-1">
              {(['all', 'unlocked', 'locked'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { audio?.playClick(); setFilter(f); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filter === f
                      ? 'bg-stone-700 text-white'
                      : 'text-stone-500 hover:text-stone-300'
                  }`}
                >
                  {f === 'all' ? TEXT_CONFIG.ui.achievements.all : f === 'unlocked' ? TEXT_CONFIG.ui.achievements.unlocked : TEXT_CONFIG.ui.achievements.locked}
                </button>
              ))}
            </div>
          </div>

          {/* 可滚动的成就列表 */}
          <div className="space-y-2 overflow-y-auto flex-1 border border-stone-700/40 rounded-xl p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-700/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-stone-600/60">
            {displayList.map((ach) => {
              const category = getCategory(ach.id);
              const isNew = pendingAnimations?.some(pa => pa.id === ach.id) ?? false;
              return (
                <div
                  key={ach.id}
                  className={`rounded-xl p-3 border transition-all ${
                    ach.unlocked
                      ? `bg-gradient-to-r from-yellow-950/40 to-orange-950/30 border-yellow-600/40 shadow-lg ${isNew ? 'shadow-yellow-900/30 ring-1 ring-yellow-400/50' : 'shadow-yellow-900/10'}`
                      : 'bg-stone-900/40 border-stone-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        ach.unlocked
                          ? 'bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg shadow-orange-500/30'
                          : 'bg-stone-800'
                      }`}
                    >
                      {ach.unlocked ? (
                        <Check size={18} className="text-white" />
                      ) : (
                        <Lock size={16} className="text-stone-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${ach.unlocked ? 'text-yellow-500' : 'text-stone-600'}`}>
                          {CATEGORY_ICONS[category]}
                        </span>
                        <div className={`font-bold text-sm truncate ${ach.unlocked ? 'text-yellow-300' : 'text-stone-400'}`}>
                          {ach.name}
                        </div>
                        {isNew && (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">{ach.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold ${ach.unlocked ? 'text-amber-400' : 'text-stone-600'}`}>
                        ¥{ach.reward}
                      </div>
                      {ach.unlocked ? (
                        <div className="text-[10px] text-yellow-500">{TEXT_CONFIG.ui.achievements.unlocked}</div>
                      ) : (
                        <div className="text-[10px] text-stone-600">{TEXT_CONFIG.ui.achievements.locked}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {displayList.length === 0 && (
              <div className="text-center text-stone-500 text-sm py-8">
                {TEXT_CONFIG.ui.achievements.empty}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
