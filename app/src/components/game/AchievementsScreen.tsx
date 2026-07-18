/**
 * @fileoverview 成就系统界面组件
 * 展示玩家已解锁和未解锁的成就列表，支持按"全部/已解锁/未解锁"分类筛选，
 * 包含进度条、分类图标和奖励展示。
 */

import React, { useState } from 'react';
import {
  ArrowLeft, Lock, Check, Trophy, Target, Zap,
  Shield, Flame, Star, Crown, Crosshair, TrendingUp
} from 'lucide-react';
import type { GameProgress } from '@/game/types';
import type { AudioManager } from '@/game/audio';


interface AchievementsScreenProps {
  progress: GameProgress;
  onClose: () => void;
  audio?: AudioManager;
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

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({ progress, onClose, audio}) => {
  /** 筛选状态：全部 / 已解锁 / 未解锁 */
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const all = progress.achievements;
  const unlockedList = all.filter(a => a.unlocked);
  const lockedList = all.filter(a => !a.unlocked);

  /** 根据筛选条件计算当前展示列表与完成度 */
  const displayList = filter === 'all' ? all : filter === 'unlocked' ? unlockedList : lockedList;
  const unlocked = unlockedList.length;
  const total = all.length;
  const progressPercent = total > 0 ? (unlocked / total) * 100 : 0;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Background image - rooftop with lightning (fixed to viewport) */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/assets/achieve_bg.jpg)' }}
      />
      {/* Dark overlay for readability (fixed to viewport) */}
      <div className="fixed inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col h-dvh">
        {/* Fixed header section: 返回、成就数量、标题、进度条、页签 */}
        <div className="pt-6 shrink-0">
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
              <Trophy size={16} className="text-yellow-400" />
              <span className="text-yellow-400 font-bold">{unlocked}/{total}</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white text-center mb-2">成就系统</h2>

          {/* Progress bar */}
          <div className="bg-stone-800 rounded-full h-2.5 mb-1 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-center text-xs text-stone-500 mb-4">
            完成度 {progressPercent.toFixed(1)}%
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
                {f === 'all' ? '全部' : f === 'unlocked' ? '已解锁' : '未解锁'}
              </button>
            ))}
          </div>
        </div>

        {/* 可滚动的成就列表：按筛选条件展示，每项包含图标、名称、描述、奖励和状态 */}
        <div className="space-y-2 overflow-y-auto flex-1 border border-stone-700/40 rounded-xl p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-700/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-stone-600/60">
          {displayList.map((ach) => {
            const category = getCategory(ach.id);
            return (
              <div
                key={ach.id}
                className={`rounded-xl p-3 border transition-all ${
                  ach.unlocked
                    ? 'bg-gradient-to-r from-yellow-950/40 to-orange-950/30 border-yellow-600/40 shadow-lg shadow-yellow-900/10'
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
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">{ach.description}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-bold ${ach.unlocked ? 'text-amber-400' : 'text-stone-600'}`}>
                      ¥{ach.reward}
                    </div>
                    {ach.unlocked ? (
                      <div className="text-[10px] text-yellow-500">已解锁</div>
                    ) : (
                      <div className="text-[10px] text-stone-600">未解锁</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {displayList.length === 0 && (
            <div className="text-center text-stone-500 text-sm py-8">
              该分类下没有成就
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
