/**
 * @fileoverview 成就系统界面组件
 * 展示玩家已解锁和未解锁的成就列表，支持按"全部/已解锁/未解锁"分类筛选。
 * 打开时通过遮罩层依次高亮新解锁成就，点击鼠标推进到下一个成就，
 * 樟叔对话框跟随当前高亮卡片移动。
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Lock, Check, Trophy, Target, Zap,
  Shield, Flame, Star, Crown, Crosshair, TrendingUp
} from 'lucide-react';
import { TEXT_CONFIG } from '@/game/data';
import { ACHIEVEMENT_DIALOG_TEXT } from '@/game/data/achievements';
import type { GameProgress } from '@/game/types';
import type { AudioManager } from '@/game/audio';
import type { AchievementData } from '@/game/engine/achievement/AchievementSystem';


interface AchievementsScreenProps {
  progress: GameProgress;
  onClose: () => void;
  audio?: AudioManager;
  pendingAnimations?: AchievementData[];
  onAnimationComplete?: (id: string) => void;
  onAllAnimationsComplete?: () => void;
  unclaimedAchievements?: AchievementData[];
  onClaimReward?: (id: string) => void;
}

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

interface DialogPosition {
  cardTop: number;
  cardLeft: number;
  cardWidth: number;
  cardHeight: number;
  cardBottom: number;
}

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({
  progress, onClose, audio,
  pendingAnimations, onAnimationComplete, onAllAnimationsComplete,
  unclaimedAchievements, onClaimReward,
}) => {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [animIndex, setAnimIndex] = useState(0);
  const [animationsDone, setAnimationsDone] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [dialogPos, setDialogPos] = useState<DialogPosition | null>(null);
  const [dialogPhase, setDialogPhase] = useState<'enter' | 'show'>('enter');
  /** 每次进入成就界面后先停留 800ms，再播放第一个解锁动画（组件挂载/卸载时自动重置） */
  const [initialDelayDone, setInitialDelayDone] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /** 合并后的动画队列（动态，会随 onClaimReward 变化） */
  const mergedAnimations = React.useMemo(() => {
    const seen = new Set<string>();
    const result: AchievementData[] = [];
    for (const a of pendingAnimations ?? []) {
      if (!seen.has(a.id)) { seen.add(a.id); result.push(a); }
    }
    for (const a of unclaimedAchievements ?? []) {
      if (!seen.has(a.id)) { seen.add(a.id); result.push(a); }
    }
    return result;
  }, [pendingAnimations, unclaimedAchievements]);

  const hasAnimations = mergedAnimations.length > 0;

  /** 动画队列快照：首次进入时冻结，避免 onClaimReward 收缩队列导致索引错位 */
  const queueSnapshotRef = useRef<AchievementData[]>([]);
  if (hasAnimations && queueSnapshotRef.current.length === 0) {
    queueSnapshotRef.current = [...mergedAnimations];
  }
  // 当动画全部完成后重置快照（下次进入时重新创建）
  useEffect(() => {
    if (animationsDone) {
      queueSnapshotRef.current = [];
    }
  }, [animationsDone]);

  /** 当前动画目标：从快照中取，不受后续状态变化影响 */
  const currentAnim = queueSnapshotRef.current[animIndex];
  const isLastAnim = animIndex >= queueSnapshotRef.current.length - 1;

  useEffect(() => {
    if (!hasAnimations) {
      setAnimationsDone(true);
    }
  }, [hasAnimations]);

  // 每次进入成就界面（组件挂载）后先停留 800ms，再开始播放解锁动画
  useEffect(() => {
    if (hasAnimations && !animationsDone) {
      setInitialDelayDone(false);
      const timer = setTimeout(() => setInitialDelayDone(true), 200);
      return () => clearTimeout(timer);
    }
  }, [hasAnimations, animationsDone]);

  // 越界安全处理
  useEffect(() => {
    if (hasAnimations && !animationsDone && !currentAnim) {
      setAnimationsDone(true);
      onAllAnimationsComplete?.();
    }
  }, [currentAnim, hasAnimations, animationsDone, onAllAnimationsComplete]);

  // 当前动画成就变化时：加入高亮集合、滚动、计算对话框位置
  // 首次进入需等待 initialDelayDone 才播放动画
  useEffect(() => {
    if (currentAnim && !animationsDone && initialDelayDone) {
      audio?.playAchievementUnlock();

      setDialogPhase('enter');

      // 卡片和浮层同步过渡：400ms 后同时从锁定→解锁
      const enterTimer = setTimeout(() => {
        setHighlightedIds(prev => {
          const next = new Set(prev);
          next.add(currentAnim.id);
          return next;
        });
        setDialogPhase('show');
      }, 400);
      const scrollTimer = setTimeout(() => {
        const card = cardRefs.current.get(currentAnim.id);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => updateDialogPosition(), 400);
        }
      }, 100);

      return () => {
        clearTimeout(enterTimer);
        clearTimeout(scrollTimer);
      };
    }
  }, [currentAnim, animationsDone, audio, initialDelayDone]);

  // 监听滚动更新对话框位置
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || animationsDone) return;
    const handleScroll = () => updateDialogPosition();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [animationsDone, currentAnim]);

  const updateDialogPosition = useCallback(() => {
    if (!currentAnim) return;
    const card = cardRefs.current.get(currentAnim.id);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    setDialogPos({
      cardTop: rect.top,
      cardLeft: rect.left,
      cardWidth: rect.width,
      cardHeight: rect.height,
      cardBottom: rect.bottom,
    });
  }, [currentAnim]);

  /** 点击推进到下一个成就（使用快照队列长度，避免闭包过期） */
  const handleAdvance = useCallback(() => {
    if (!currentAnim || animationsDone) return;
    audio?.playClick();

    onAnimationComplete?.(currentAnim.id);
    if (unclaimedAchievements?.some(a => a.id === currentAnim.id)) {
      onClaimReward?.(currentAnim.id);
    }

    const nextIndex = animIndex + 1;
    if (nextIndex < queueSnapshotRef.current.length) {
      setAnimIndex(nextIndex);
    } else {
      setAnimationsDone(true);
      onAllAnimationsComplete?.();
    }
  }, [currentAnim, animationsDone, animIndex, audio, onAnimationComplete, unclaimedAchievements, onClaimReward, onAllAnimationsComplete]);

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) { cardRefs.current.set(id, el); }
    else { cardRefs.current.delete(id); }
  }, []);

  const all = progress.achievements;
  const unlockedList = all.filter(a => a.unlocked);
  const lockedList = all.filter(a => !a.unlocked);
  const displayList = filter === 'all' ? all : filter === 'unlocked' ? unlockedList : lockedList;
  const unlocked = unlockedList.length;
  const total = all.length;
  const progressPercent = total > 0 ? (unlocked / total) * 100 : 0;

  return (
    <>
      {/* ═══ 遮罩 + 卡片克隆 + 对话框（动画进行中）═══ */}
      {hasAnimations && !animationsDone && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-40 bg-black/60 cursor-pointer"
            onClick={handleAdvance}
          />

          {/* 卡片克隆浮层 — 在遮罩上方显示当前高亮卡片，带解锁动画 */}
          {dialogPos && currentAnim && (
            (() => {
              const isUnlocked = dialogPhase === 'show';
              return (
            <div
              className="fixed z-50 pointer-events-none"
              style={{
                top: dialogPos.cardTop,
                left: dialogPos.cardLeft,
                width: dialogPos.cardWidth,
                height: dialogPos.cardHeight,
                transition: 'all 0.35s ease-out',
              }}
            >
              {/* 克隆卡片：从灰色锁定 → 彩色解锁 */}
              <div
                className="rounded-xl p-3 border-2 w-full h-full"
                style={{
                  background: isUnlocked
                    ? 'linear-gradient(to right, rgba(113,63,18,0.5), rgba(124,45,18,0.4))'
                    : 'rgba(28,25,23,0.6)',
                  borderColor: isUnlocked ? '#fbbf24' : '#57534e',
                  boxShadow: isUnlocked
                    ? '0 0 20px rgba(251, 191, 36, 0.5), inset 0 0 12px rgba(251, 191, 36, 0.15)'
                    : 'none',
                  transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <div className="flex items-center gap-3 h-full">
                  {/* 图标：锁 → 对钩（仅旋转，无缩放/渐变/发光） */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-yellow-500 to-orange-500"
                    style={{
                      transform: isUnlocked ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                  >
                    {isUnlocked ? (
                      <Check size={18} className="text-white" />
                    ) : (
                      <Lock size={14} className="text-stone-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {/* 分类图标 */}
                      <span className="text-xs"
                        style={{ color: isUnlocked ? '#eab308' : '#78716c', transition: 'color 0.5s' }}>
                        {CATEGORY_ICONS[getCategory(currentAnim.id)]}
                      </span>
                      {/* 成就名称 */}
                      <div className="font-bold text-sm truncate"
                        style={{
                          color: isUnlocked ? '#fde68a' : '#a8a29e',
                          transition: 'color 0.5s',
                        }}>
                        {currentAnim.name}
                      </div>
                    </div>
                    {/* 描述 */}
                    <div className="text-xs mt-0.5"
                      style={{
                        color: isUnlocked ? '#a8a29e' : '#78716c',
                        transition: 'color 0.5s',
                      }}>
                      {currentAnim.description}
                    </div>
                  </div>

                  {/* 奖励 */}
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold"
                      style={{
                        color: isUnlocked ? '#fbbf24' : '#78716c',
                        transition: 'color 0.5s',
                      }}>
                      ¥{currentAnim.reward}
                    </div>
                    <div className="text-[10px]"
                      style={{
                        color: isUnlocked ? '#eab308' : '#57534e',
                        transition: 'color 0.5s',
                      }}>
                      {isUnlocked ? TEXT_CONFIG.ui.achievements.unlocked : TEXT_CONFIG.ui.achievements.locked}
                    </div>
                  </div>
                </div>
              </div>
            </div>
              );
            })()
          )}

          {/* 樟叔对话框 — 卡片下方 */}
          {dialogPos && currentAnim && (
            <div
              className="fixed z-50 flex items-center justify-center cursor-pointer"
              style={{
                top: dialogPos.cardBottom + 12,
                left: '50%',
                transform: 'translateX(-50%)',
                transition: 'top 0.35s ease-out',
              }}
              onClick={handleAdvance}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                <img
                  src="/assets/avatar_zhangshu.png"
                  alt="樟叔"
                  style={{
                    width: 48, height: 48, borderRadius: '50%',
                    border: '2px solid #fbbf24',
                    boxShadow: '0 0 16px rgba(251, 191, 36, 0.3)',
                    objectFit: 'cover', flexShrink: 0,
                    transform: dialogPhase === 'enter' ? 'translateX(-30px) scale(0.8)' : 'translateX(0) scale(1)',
                    opacity: dialogPhase === 'enter' ? 0 : 1,
                    transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                  onError={(e) => { (e.target as HTMLImageElement).src = '/assets/zhangshu-avatar.jpg'; }}
                />
                <div style={{
                  position: 'relative',
                  background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
                  border: '2px solid #fbbf24', borderRadius: 14, padding: '10px 16px', maxWidth: 400,
                  transform: dialogPhase === 'enter' ? 'scale(0)' : 'scale(1)',
                  opacity: dialogPhase === 'enter' ? 0 : 1,
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)', transitionDelay: '0.1s',
                }}>
                  <div style={{ position: 'absolute', left: -7, top: '50%', transform: 'translateY(-50%)',
                    width: 0, height: 0, borderTop: '7px solid transparent',
                    borderBottom: '7px solid transparent', borderRight: '7px solid #fbbf24' }} />
                  <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, marginBottom: 3 }}>
                    {ACHIEVEMENT_DIALOG_TEXT.unlockTitle}
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 800, marginBottom: 1 }}>
                    {currentAnim.name}
                  </div>
                  
                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>
                    {ACHIEVEMENT_DIALOG_TEXT.rewardTemplate(currentAnim.reward)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderTop: '1px solid rgba(251,191,36,0.2)', paddingTop: 6 }}>
                    <span style={{ fontSize: 9, color: '#78716c' }}>
                      {ACHIEVEMENT_DIALOG_TEXT.progressIndicator(animIndex + 1, queueSnapshotRef.current.length)}
                    </span>
                    <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>
                      {isLastAnim ? ACHIEVEMENT_DIALOG_TEXT.clickToFinish : ACHIEVEMENT_DIALOG_TEXT.clickToContinue}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ 成就列表主界面 ═══ */}
      <div className="absolute inset-0 flex flex-col">
        <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/assets/bg_rooftop_easy.jpg)' }} />
        <div className="fixed inset-0 bg-black/70" />

        <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col h-dvh">
          <div className="pt-6 shrink-0">
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
            <div className="bg-stone-800 rounded-full h-2.5 mb-1 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="text-center text-xs text-stone-500 mb-4">
              {TEXT_CONFIG.ui.achievements.completion(progressPercent.toFixed(1))}
            </div>
            <div className="flex gap-1 mb-3 bg-stone-900/60 rounded-xl p-1">
              {(['all', 'unlocked', 'locked'] as const).map((f) => (
                <button key={f} onClick={() => { audio?.playClick(); setFilter(f); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filter === f ? 'bg-stone-700 text-white' : 'text-stone-500 hover:text-stone-300'}`}>
                  {f === 'all' ? TEXT_CONFIG.ui.achievements.all : f === 'unlocked' ? TEXT_CONFIG.ui.achievements.unlocked : TEXT_CONFIG.ui.achievements.locked}
                </button>
              ))}
            </div>
          </div>

          <div ref={scrollContainerRef}
            className="space-y-2 overflow-y-auto flex-1 border border-stone-700/40 rounded-xl p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-700/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-stone-600/60">
            {displayList.map((ach) => {
              const category = getCategory(ach.id);
              const isNew = pendingAnimations?.some(pa => pa.id === ach.id) ?? false;
              const isUnclaimed = unclaimedAchievements?.some(ua => ua.id === ach.id) ?? false;
              const isNewUnlock = isNew || isUnclaimed;
              const isCurrentHighlight = currentAnim?.id === ach.id && !animationsDone;
              const isPersistentHighlight = highlightedIds.has(ach.id) && !isCurrentHighlight;
              // 新解锁的成就在高亮前显示为未解锁状态（灰色+锁），高亮后过渡为彩色+对钩
              const effectiveUnlocked = ach.unlocked && (!isNewUnlock || highlightedIds.has(ach.id));

              return (
                <div key={ach.id} ref={(el) => { setCardRef(ach.id, el); }}
                  className={`rounded-xl p-3 border transition-all duration-500 ${
                    effectiveUnlocked
                      ? `bg-gradient-to-r from-yellow-950/40 to-orange-950/30 border-yellow-600/40 shadow-lg ${
                          isCurrentHighlight
                            ? 'border-yellow-400 shadow-yellow-400/30 ring-2 ring-yellow-400/50'
                            : isPersistentHighlight
                              ? 'border-yellow-400/50 shadow-yellow-400/20'
                              : isNew ? 'shadow-yellow-900/30 ring-1 ring-yellow-400/50' : 'shadow-yellow-900/10'
                        }`
                      : 'bg-stone-900/40 border-stone-800'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                      effectiveUnlocked
                        ? isCurrentHighlight
                          ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-orange-400/50 scale-110'
                          : 'bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg shadow-orange-500/30'
                        : 'bg-stone-800'
                    }`}>
                      {effectiveUnlocked ? <Check size={18} className="text-white" /> : <Lock size={16} className="text-stone-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${effectiveUnlocked ? 'text-yellow-500' : 'text-stone-600'}`}>
                          {CATEGORY_ICONS[category]}
                        </span>
                        <div className={`font-bold text-sm truncate transition-colors duration-300 ${
                          isCurrentHighlight ? 'text-yellow-200' : effectiveUnlocked ? 'text-yellow-300' : 'text-stone-400'
                        }`}>{ach.name}</div>
                        {isNew && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold animate-pulse">NEW</span>}
                        {isUnclaimed && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">💰</span>}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">{ach.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold ${effectiveUnlocked ? 'text-amber-400' : 'text-stone-600'}`}>¥{ach.reward}</div>
                      {effectiveUnlocked
                        ? <div className="text-[10px] text-yellow-500">{TEXT_CONFIG.ui.achievements.unlocked}</div>
                        : <div className="text-[10px] text-stone-600">{TEXT_CONFIG.ui.achievements.locked}</div>
                      }
                    </div>
                  </div>
                </div>
              );
            })}
            {displayList.length === 0 && (
              <div className="text-center text-stone-500 text-sm py-8">{TEXT_CONFIG.ui.achievements.empty}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};