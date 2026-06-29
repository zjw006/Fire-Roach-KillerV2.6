import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Lock, Check, Sparkles, Flame, Target, Gauge, Wind, Shield, Zap, DollarSign, Snowflake, Skull, Bomb, Wrench, Package, X, ChevronUp, ChevronRight } from 'lucide-react';
import type { GameProgress, TalentDef } from '@/game/types';
import { TALENT_DEFS } from '@/game/data';
import type { AudioManager } from '@/game/audio';


interface TalentTreeScreenProps {
  progress: GameProgress;
  talentPoints: number;
  onSpendTalent: (talentId: string) => boolean;
  onClose: () => void;
  audio?: AudioManager;
}

const TALENT_ICONS: Record<string, React.ReactNode> = {
  fire_damage: <Flame size={20} />,
  fire_range: <Target size={20} />,
  gas_capacity: <Gauge size={20} />,
  overheat_resist: <Shield size={20} />,
  cool_speed: <Wind size={20} />,
  defense_hp: <Shield size={20} />,
  swatter_cd: <Zap size={20} />,
  money_boost: <DollarSign size={20} />,
  freeze_weapon: <Snowflake size={20} />,
  poison_weapon: <Skull size={20} />,
  shotgun_weapon: <Target size={20} />,
  molotov_weapon: <Bomb size={20} />,
  fire_affinity: <Flame size={20} />,
  mechanical_mastery: <Wrench size={20} />,
  explosive_expert: <Bomb size={20} />,
  resource_saver: <Package size={20} />,
};

// Talent category definitions
const CATEGORIES = [
  {
    id: 'combat',
    title: '战斗强化',
    icon: <Flame size={14} />,
    color: 'text-orange-400',
    borderColor: 'border-stone-700',
    talents: ['fire_damage', 'fire_range', 'shotgun_weapon', 'molotov_weapon'],
  },
  {
    id: 'survival',
    title: '生存强化',
    icon: <Shield size={14} />,
    color: 'text-amber-400',
    borderColor: 'border-stone-700',
    talents: ['gas_capacity', 'overheat_resist', 'cool_speed', 'defense_hp'],
  },
  {
    id: 'utility',
    title: '辅助强化',
    icon: <Zap size={14} />,
    color: 'text-amber-400',
    borderColor: 'border-stone-700',
    talents: ['swatter_cd', 'money_boost', 'freeze_weapon', 'poison_weapon'],
  },
  {
    id: 'item',
    title: '道具专精',
    icon: <Package size={14} />,
    color: 'text-orange-400',
    borderColor: 'border-orange-600/50',
    talents: ['fire_affinity', 'mechanical_mastery', 'explosive_expert', 'resource_saver'],
  },
];

// Tutorial steps: 2 combat + 4 survival talents
const TUTORIAL_STEPS: { talentId: string; zhangshuText: string }[] = [
  {
    talentId: 'fire_damage',
    zhangshuText: '这是「火焰伤害」，提升你的火焰喷射伤害！每级+10%伤害，最多5级。对付大蟑螂特别有效！',
  },
  {
    talentId: 'fire_range',
    zhangshuText: '这是「火焰范围」，增加喷射距离！每级+15%范围，最多5级。烧得更远更安全！',
  },
  {
    talentId: 'gas_capacity',
    zhangshuText: '这是「气罐容量」，增加燃料上限！每级+20%容量，最多5级。少换气罐多烧一会儿！',
  },
  {
    talentId: 'overheat_resist',
    zhangshuText: '这是「过热抗性」，提升过热上限！每级+15%阈值，最多5级。连续喷射不容易熄火！',
  },
  {
    talentId: 'cool_speed',
    zhangshuText: '这是「冷却速度」，加快散热速度！每级+20%冷却，最多5级。熄火后更快恢复开火！',
  },
  {
    talentId: 'defense_hp',
    zhangshuText: '这是「防线生命」，增加防线血量！每级+15%血量，最多5级。防线更坚挺，蟑螂更难突破！',
  },
];

const TUTORIAL_KEY = 'talent_tree_tutorial_seen';

export const TalentTreeScreen: React.FC<TalentTreeScreenProps> = ({ progress, talentPoints, onSpendTalent, onClose, audio}) => {
  const [selectedTalentId, setSelectedTalentId] = useState<string | null>(null);
  const [flashTalent, setFlashTalent] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const talentRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Check if first time entering talent tree
  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) {
      setShowTutorial(true);
      setTutorialStep(0);
    }
  }, []);

  // Update highlight position when step changes
  useEffect(() => {
    if (showTutorial && tutorialStep >= 0 && tutorialStep < TUTORIAL_STEPS.length) {
      const talentId = TUTORIAL_STEPS[tutorialStep].talentId;
      const el = talentRefs.current[talentId];
      if (el) {
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          setHighlightRect(rect);
        }, 50);
      }
    }
  }, [showTutorial, tutorialStep]);

  const talents = TALENT_DEFS.map(def => {
    const currentLevel = progress.talentTree.talents[def.id] || 0;
    const isMaxed = currentLevel >= def.maxLevel;
    const canAfford = talentPoints >= def.cost;
    return { ...def, currentLevel, isMaxed, canAfford };
  });

  const selectedTalent = selectedTalentId ? talents.find(t => t.id === selectedTalentId) || null : null;

  const handleUpgrade = () => {
    if (!selectedTalent) return;
    const success = onSpendTalent(selectedTalent.id);
    if (success) {
      setFlashTalent(true);
      setTimeout(() => setFlashTalent(false), 300);
      const newLevel = (progress.talentTree.talents[selectedTalent.id] || 0) + 1;
      if (newLevel >= selectedTalent.maxLevel) {
        setTimeout(() => setSelectedTalentId(null), 400);
      }
    }
  };

  const handleNextTutorialStep = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(tutorialStep + 1);
    } else {
      // Tutorial complete
      setShowTutorial(false);
      localStorage.setItem(TUTORIAL_KEY, 'true');
    }
  };

  const handleSkipTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem(TUTORIAL_KEY, 'true');
  };

  const currentTutorial = showTutorial && tutorialStep < TUTORIAL_STEPS.length
    ? TUTORIAL_STEPS[tutorialStep]
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: '#000000' }}>
      {/* ====== SCREEN 1: Talent List ====== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-stone-800">
          <button
            onClick={() => { audio?.playClick(); onClose(); }}
            className="flex items-center gap-1 text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">返回</span>
          </button>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-yellow-400" />
            <span className="text-yellow-400 font-bold">{talentPoints} 天赋点</span>
          </div>
        </div>

        {/* Scrollable talent grid */}
        <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          <div className="max-w-md mx-auto px-4 py-4 space-y-3">
            <h2 className="text-2xl font-bold text-white text-center mb-4">天赋树</h2>

            {CATEGORIES.map(cat => (
              <div key={cat.id} className={`bg-stone-900/80 rounded-xl p-3 border ${cat.borderColor}`}>
                <div className={`text-sm font-bold ${cat.color} mb-2 flex items-center gap-1`}>
                  {cat.icon} {cat.title}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {talents.filter(t => cat.talents.includes(t.id)).map(t => (
                    <TalentCard
                      key={t.id}
                      talent={t}
                      onClick={() => { audio?.playClick(); setSelectedTalentId(t.id); }}
                      refEl={(el: HTMLButtonElement | null) => { talentRefs.current[t.id] = el; }}
                      isHighlighted={showTutorial && currentTutorial?.talentId === t.id}
                      audio={audio}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Bottom spacer */}
            <div className="h-4" />
          </div>
        </div>
      </div>

      {/* ====== TUTORIAL OVERLAY ====== */}
      {showTutorial && currentTutorial && (
        <div className="fixed inset-0 z-[120]">
          {/* 4-piece mask: covers top, bottom, left, right — leaving the highlight area fully transparent */}
          {highlightRect && (
            <>
              {/* Top */}
              <div
                className="absolute bg-black/80"
                style={{ left: 0, top: 0, width: '100%', height: Math.max(0, highlightRect.top - 8) }}
              />
              {/* Bottom */}
              <div
                className="absolute bg-black/80"
                style={{ left: 0, top: highlightRect.bottom + 8, width: '100%', height: `calc(100% - ${highlightRect.bottom + 8}px)` }}
              />
              {/* Left of highlight */}
              <div
                className="absolute bg-black/80"
                style={{ left: 0, top: Math.max(0, highlightRect.top - 8), width: Math.max(0, highlightRect.left - 8), height: highlightRect.height + 16 }}
              />
              {/* Right of highlight */}
              <div
                className="absolute bg-black/80"
                style={{ left: highlightRect.right + 8, top: Math.max(0, highlightRect.top - 8), width: `calc(100% - ${highlightRect.right + 8}px)`, height: highlightRect.height + 16 }}
              />
              {/* Yellow glow border around highlight area */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: highlightRect.left - 8,
                  top: highlightRect.top - 8,
                  width: highlightRect.width + 16,
                  height: highlightRect.height + 16,
                  borderRadius: '12px',
                  boxShadow: '0 0 20px 4px rgba(251,191,36,0.5), inset 0 0 0 2px rgba(251,191,36,0.6)',
                }}
              />
            </>
          )}

          {/* Zhangshu dialog at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="max-w-md mx-auto">
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-1 mb-3">
                {TUTORIAL_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === tutorialStep ? 'bg-yellow-400 w-4' : i < tutorialStep ? 'bg-yellow-600' : 'bg-stone-700'
                    }`}
                  />
                ))}
              </div>

              {/* Zhangshu avatar + dialog */}
              <div className="bg-stone-900/95 border border-stone-600 rounded-xl p-4 flex items-start gap-3">
                <div className="shrink-0 w-14 h-14 rounded-full overflow-hidden border-2 border-yellow-600/50">
                  <img
                    src="/assets/avatar_zhangshu.png"
                    alt="蟑叔"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-yellow-400 text-sm font-bold mb-1">蟑叔</div>
                  <div className="text-stone-200 text-sm leading-relaxed">
                    {currentTutorial.zhangshuText}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => { audio?.playClick(); handleSkipTutorial(); }}
                  className="flex-1 py-2.5 rounded-lg bg-stone-800 text-stone-400 font-bold text-sm hover:bg-stone-700 transition-all"
                >
                  跳过引导
                </button>
                <button
                  onClick={() => { audio?.playClick(); handleNextTutorialStep(); }}
                  className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold text-sm hover:from-yellow-500 hover:to-orange-500 transition-all flex items-center justify-center gap-1"
                >
                  {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                    <>下一步 <ChevronRight size={14} /></>
                  ) : (
                    <>知道了，开始加点</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== SCREEN 2: Talent Detail Modal ====== */}
      {selectedTalent && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTalentId(null); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" onClick={() => { audio?.playClick(); setSelectedTalentId(null); }} />

          {/* Detail Panel */}
          <div className={`relative w-full max-w-md mx-auto bg-stone-900 rounded-t-2xl border-t border-x border-stone-600 shadow-2xl transition-transform duration-300 ${flashTalent ? 'scale-[1.02]' : 'scale-100'}`}>
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-600" />
            </div>

            {/* Close button */}
            <button
              onClick={() => { audio?.playClick(); setSelectedTalentId(null); }}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-stone-400 hover:text-white hover:bg-stone-700 transition-all"
            >
              <X size={14} />
            </button>

            <div className="px-5 pb-6 pt-1">
              {/* Talent header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${selectedTalent.currentLevel > 0 ? 'bg-gradient-to-br from-yellow-600 to-orange-700' : 'bg-gradient-to-br from-stone-700 to-stone-800'}`}>
                  {TALENT_ICONS[selectedTalent.id] || <Sparkles size={24} />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white text-lg">{selectedTalent.name}</div>
                  <div className="text-xs text-stone-400">{selectedTalent.description}</div>
                </div>
              </div>

              {/* Level indicator */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-stone-400">当前等级</span>
                  <span className="text-sm font-bold text-white">{selectedTalent.currentLevel} / {selectedTalent.maxLevel}</span>
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: selectedTalent.maxLevel }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2.5 rounded-full transition-all ${
                        i < selectedTalent.currentLevel
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                          : 'bg-stone-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Cost info */}
              <div className="bg-stone-800/50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-400">升级消耗</span>
                  <span className="text-sm font-bold text-yellow-400 flex items-center gap-1">
                    <Sparkles size={12} />
                    {selectedTalent.cost} 天赋点
                  </span>
                </div>
              </div>

              {/* Upgrade button */}
              <button
                onClick={() => { audio?.playClick(); handleUpgrade(); }}
                disabled={selectedTalent.isMaxed || !selectedTalent.canAfford}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  selectedTalent.isMaxed
                    ? 'bg-amber-900/40 text-amber-400 cursor-default'
                    : selectedTalent.canAfford
                    ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white active:scale-[0.98]'
                    : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                }`}
              >
                {selectedTalent.isMaxed ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check size={16} /> 已满级
                  </span>
                ) : selectedTalent.canAfford ? (
                  <span className="flex items-center justify-center gap-2">
                    <ChevronUp size={16} /> 升级天赋 ({selectedTalent.cost} 点)
                  </span>
                ) : (
                  <span>天赋点不足 (需要 {selectedTalent.cost} 点)</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function TalentCard({
  talent,
  onClick,
  refEl,
  isHighlighted,
  audio,
}: {
  talent: any;
  onClick: () => void;
  refEl?: (el: HTMLButtonElement | null) => void;
  isHighlighted?: boolean;
  audio?: AudioManager;
}) {
  const isWeapon = talent.maxLevel === 1;
  return (
    <button
      ref={refEl}
      onClick={() => { audio?.playClick(); onClick(); }}
      className={`rounded-lg p-2.5 border transition-all text-left active:scale-95 ${
        isHighlighted
          ? 'border-yellow-400'
          : talent.currentLevel > 0
          ? isWeapon
            ? 'border-red-600/50 bg-red-900/20'
            : 'border-yellow-600/50 bg-yellow-900/20'
          : 'border-stone-700 bg-black/40 hover:border-stone-500'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={talent.currentLevel > 0 ? 'text-white' : 'text-stone-500'}>
          {TALENT_ICONS[talent.id] || <Sparkles size={14} />}
        </span>
        <span className="text-xs font-bold text-white truncate">{talent.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {Array.from({ length: talent.maxLevel }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i < talent.currentLevel ? (isWeapon ? 'bg-red-400' : 'bg-yellow-400') : 'bg-stone-700'}`}
            />
          ))}
        </div>
        {talent.currentLevel === 0 && talent.maxLevel === 1 && (
          <Lock size={10} className="text-stone-600" />
        )}
      </div>
    </button>
  );
}
