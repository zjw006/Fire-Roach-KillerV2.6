import React, { useState } from 'react';
import {
  ArrowLeft, Lock, Bug, Heart, Zap, Skull, Star, Sparkles, X, Flame, Shield, Wind, Bomb, Crown
} from 'lucide-react';
import { RoachType, type EncyclopediaEntry, type GameProgress } from '@/game/types';
import type { AudioManager } from '@/game/audio';


interface EncyclopediaScreenProps {
  progress: GameProgress;
  onClose: () => void;
  audio?: AudioManager;
}

const ROACH_ICONS: Record<RoachType, React.ReactNode> = {
  [RoachType.SMALL]: <Bug size={20} />,
  [RoachType.LARGE]: <Bug size={22} />,
  [RoachType.FLYING]: <Wind size={20} />,
  [RoachType.ARMORED]: <Shield size={20} />,
  [RoachType.SPLITTING]: <Zap size={20} />,
  [RoachType.SUICIDE]: <Bomb size={20} />,
  [RoachType.FLYING_SUICIDE]: <Bomb size={20} />,
  [RoachType.QUEEN]: <Crown size={22} />,
  [RoachType.NURSE]: <Bug size={20} />,
  [RoachType.MUTANT]: <Bug size={22} />,
  [RoachType.TIMED_SUICIDE]: <Bomb size={20} />,
};

const ROACH_COLORS: Record<RoachType, string> = {
  [RoachType.SMALL]: 'from-amber-700 to-amber-600',
  [RoachType.LARGE]: 'from-orange-700 to-orange-600',
  [RoachType.FLYING]: 'from-amber-700 to-amber-600',
  [RoachType.ARMORED]: 'from-gray-600 to-gray-500',
  [RoachType.SPLITTING]: 'from-purple-700 to-purple-600',
  [RoachType.SUICIDE]: 'from-red-700 to-red-600',
  [RoachType.FLYING_SUICIDE]: 'from-pink-700 to-pink-600',
  [RoachType.QUEEN]: 'from-red-800 to-red-700',
  [RoachType.NURSE]: 'from-blue-700 to-blue-600',
  [RoachType.MUTANT]: 'from-green-700 to-green-600',
  [RoachType.TIMED_SUICIDE]: 'from-yellow-700 to-yellow-600',
};

const ROACH_BG_COLORS: Record<RoachType, string> = {
  [RoachType.SMALL]: 'bg-amber-950/40 border-amber-800/40',
  [RoachType.LARGE]: 'bg-orange-950/40 border-orange-800/40',
  [RoachType.FLYING]: 'bg-amber-950/40 border-amber-800/40',
  [RoachType.ARMORED]: 'bg-stone-950/40 border-stone-700/40',
  [RoachType.SPLITTING]: 'bg-purple-950/40 border-purple-800/40',
  [RoachType.SUICIDE]: 'bg-red-950/40 border-red-800/40',
  [RoachType.FLYING_SUICIDE]: 'bg-pink-950/40 border-pink-800/40',
  [RoachType.QUEEN]: 'bg-red-950/40 border-red-800/40',
  [RoachType.NURSE]: 'bg-blue-950/40 border-blue-800/40',
  [RoachType.MUTANT]: 'bg-green-950/40 border-green-800/40',
  [RoachType.TIMED_SUICIDE]: 'bg-yellow-950/40 border-yellow-800/40',
};

const ROACH_TEXT_COLORS: Record<RoachType, string> = {
  [RoachType.SMALL]: 'text-amber-400',
  [RoachType.LARGE]: 'text-orange-400',
  [RoachType.FLYING]: 'text-amber-400',
  [RoachType.ARMORED]: 'text-stone-400',
  [RoachType.SPLITTING]: 'text-purple-400',
  [RoachType.SUICIDE]: 'text-red-400',
  [RoachType.FLYING_SUICIDE]: 'text-pink-400',
  [RoachType.QUEEN]: 'text-rose-400',
  [RoachType.NURSE]: 'text-blue-400',
  [RoachType.MUTANT]: 'text-green-400',
  [RoachType.TIMED_SUICIDE]: 'text-yellow-400',
};

const ROACH_GLOW_COLORS: Record<RoachType, string> = {
  [RoachType.SMALL]: 'shadow-amber-900/30',
  [RoachType.LARGE]: 'shadow-orange-900/30',
  [RoachType.FLYING]: 'shadow-amber-900/30',
  [RoachType.ARMORED]: 'shadow-gray-900/30',
  [RoachType.SPLITTING]: 'shadow-purple-900/30',
  [RoachType.SUICIDE]: 'shadow-red-900/30',
  [RoachType.FLYING_SUICIDE]: 'shadow-pink-900/30',
  [RoachType.QUEEN]: 'shadow-red-900/30',
  [RoachType.NURSE]: 'shadow-blue-900/30',
  [RoachType.MUTANT]: 'shadow-green-900/30',
  [RoachType.TIMED_SUICIDE]: 'shadow-yellow-900/30',
};

function getSpeedStars(speed: number): number {
  if (speed <= 0.4) return 1;
  if (speed <= 0.7) return 2;
  if (speed <= 0.9) return 3;
  if (speed <= 1.2) return 4;
  return 5;
}

function getHpBars(hp: number): number {
  if (hp <= 1) return 1;
  if (hp <= 3) return 2;
  if (hp <= 6) return 3;
  if (hp <= 15) return 4;
  return 5;
}

export const EncyclopediaScreen: React.FC<EncyclopediaScreenProps> = ({ progress, onClose, audio}) => {
  const [selectedRoach, setSelectedRoach] = useState<EncyclopediaEntry | null>(null);

  const entries = progress.encyclopedia?.entries || [];
  const totalKills = entries.reduce((sum, e) => sum + (e.killCount || 0), 0);
  const unlockedCount = entries.filter(e => e.unlocked).length;
  const totalCount = entries.length;

  return (
    <div className="absolute inset-0 overflow-y-auto">
      {/* Dark background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-[#0d0d1f] to-[#0a0a1a]" />

      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-6 min-h-screen">
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
            <Bug size={16} className="text-orange-400" />
            <span className="text-orange-400 font-bold">{unlockedCount}/{totalCount}</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center justify-center gap-2">
            <Flame size={24} className="text-orange-500" />
            蟑螂图鉴
            <Flame size={24} className="text-orange-500" />
          </h2>
          <div className="text-sm text-stone-500">
            累计击杀 <span className="text-red-400 font-bold">{totalKills}</span> 只蟑螂
          </div>
        </div>

        {/* Roach Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {entries.map((entry) => {
            const isUnlocked = entry.unlocked;
            return (
              <button
                key={entry.id}
                onClick={() => { audio?.playClick(); isUnlocked && setSelectedRoach(entry); }}
                className={`relative rounded-xl border p-3 text-left transition-all duration-200 ${
                  isUnlocked
                    ? `${ROACH_BG_COLORS[entry.type]} hover:scale-105 hover:shadow-lg ${ROACH_GLOW_COLORS[entry.type]} active:scale-95`
                    : 'bg-stone-950/40 border-stone-800 opacity-50 cursor-not-allowed'
                }`}
              >
                {/* Image area */}
                <div className="flex items-center justify-center mb-2">
                  {isUnlocked ? (
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${ROACH_COLORS[entry.type]} flex items-center justify-center shadow-lg`}>
                      <img
                        src={entry.image}
                        alt={entry.name}
                        className="w-14 h-14 object-contain drop-shadow-md"
                        draggable={false}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-stone-800 flex items-center justify-center">
                      <Lock size={24} className="text-stone-600" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="text-center">
                  <div className={`font-bold text-sm mb-1 ${isUnlocked ? ROACH_TEXT_COLORS[entry.type] : 'text-stone-600'}`}>
                    {isUnlocked ? entry.name : '???'}
                  </div>
                  {isUnlocked && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-stone-500">
                      <Skull size={10} className="text-red-500" />
                      <span>击杀 {entry.killCount || 0}</span>
                    </div>
                  )}
                </div>

                {/* New badge */}
                {isUnlocked && (entry.killCount || 0) > 0 && (entry.killCount || 0) < 5 && (
                  <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    NEW
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom hint */}
        <div className="text-center text-xs text-stone-600 mb-4">
          点击已解锁的蟑螂查看详细信息
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => { audio?.playClick(); setSelectedRoach(null); }}
          />

          {/* Modal content */}
          <div className={`relative w-full max-w-sm rounded-2xl border ${ROACH_BG_COLORS[selectedRoach.type]} p-5 shadow-2xl ${ROACH_GLOW_COLORS[selectedRoach.type]}`}>
            {/* Close button */}
            <button
              onClick={() => { audio?.playClick(); setSelectedRoach(null); }}
              className="absolute top-3 right-3 text-stone-500 hover:text-white transition-colors z-10"
            >
              <X size={20} />
            </button>

            {/* Header with image */}
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${ROACH_COLORS[selectedRoach.type]} flex items-center justify-center shadow-lg shrink-0`}>
                <img
                  src={selectedRoach.image}
                  alt={selectedRoach.name}
                  className="w-16 h-16 object-contain drop-shadow-lg"
                  draggable={false}
                />
              </div>
              <div>
                <div className={`text-xl font-black ${ROACH_TEXT_COLORS[selectedRoach.type]}`}>
                  {selectedRoach.name}
                </div>
                <div className="flex items-center gap-1 text-xs text-stone-500 mt-0.5">
                  {ROACH_ICONS[selectedRoach.type]}
                  <span>{selectedRoach.type === RoachType.QUEEN ? 'BOSS' : selectedRoach.type.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
                  <Skull size={12} />
                  <span className="font-bold">已击杀 {selectedRoach.killCount || 0} 只</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-black/30 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-1">
                  <Heart size={12} className="text-red-500" />
                  <span>生命值</span>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
                        i < getHpBars(selectedRoach.hp)
                          ? 'bg-gradient-to-r from-red-500 to-red-400'
                          : 'bg-stone-700'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-stone-400 mt-1">{selectedRoach.hp} HP</div>
              </div>

              <div className="bg-black/30 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-1">
                  <Zap size={12} className="text-yellow-500" />
                  <span>速度</span>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
                        i < getSpeedStars(selectedRoach.speed)
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                          : 'bg-stone-700'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-stone-400 mt-1">{selectedRoach.speed.toFixed(1)}</div>
              </div>
            </div>

            {/* Special ability */}
            <div className="bg-black/30 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-1.5">
                <Star size={12} className="text-amber-400" />
                <span>特殊能力</span>
              </div>
              <div className="text-sm text-stone-300 font-medium">
                {selectedRoach.special}
              </div>
            </div>

            {/* Description */}
            <div className="bg-black/30 rounded-xl p-3 mb-3">
              <div className="text-xs text-stone-500 mb-1.5 flex items-center gap-1.5">
                <Bug size={12} className="text-orange-400" />
                <span>描述</span>
              </div>
              <div className="text-sm text-stone-300 leading-relaxed">
                {selectedRoach.description}
              </div>
            </div>

            {/* Fun fact */}
            <div className="bg-gradient-to-r from-yellow-950/30 to-orange-950/30 border border-yellow-700/20 rounded-xl p-3">
              <div className="text-xs text-yellow-500 mb-1.5 flex items-center gap-1.5">
                <Sparkles size={12} />
                <span>趣味冷知识</span>
              </div>
              <div className="text-sm text-yellow-200/70 italic leading-relaxed">
                "{selectedRoach.funFact}"
              </div>
            </div>

            {/* Bottom button */}
            <button
              onClick={() => { audio?.playClick(); setSelectedRoach(null); }}
              className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 bg-gradient-to-r ${ROACH_COLORS[selectedRoach.type]} text-white`}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
