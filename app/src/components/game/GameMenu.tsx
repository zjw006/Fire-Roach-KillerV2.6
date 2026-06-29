import React, { useEffect, useState } from 'react';
import {
  Flame, Volume2, VolumeX, Swords, Trophy,
  Skull, Sparkles, Map, Award, Bug,
  ShoppingBag, RotateCcw, AlertTriangle, Trash2, Lock,
} from 'lucide-react';
import { GameMode, SceneType, type GameProgress } from '@/game/types';
import { SCENE_CONFIGS, SCENE_ORDER } from '@/game/data';
import { resetSeenComics } from '@/game/comicData';
import type { AudioManager } from '@/game/audio';

interface GameMenuProps {
  onStart: (difficulty: 'easy' | 'hard', mode: GameMode, scene: SceneType) => void;
  onOpenTalentTree: () => void;
  onOpenAchievements: () => void;
  onOpenSceneSelect: () => void;
  onOpenEncyclopedia: () => void;
  audioMuted: boolean;
  onToggleMute: () => void;
  onOpenShop: () => void;
  progress: GameProgress | null;
  talentPoints: number;
  audio?: AudioManager;
}

export const GameMenu: React.FC<GameMenuProps> = ({
  onStart, onOpenTalentTree, onOpenAchievements, onOpenEncyclopedia,
  audioMuted, onToggleMute, onOpenShop, progress, talentPoints, audio}) => {
  const [bgLoaded, setBgLoaded] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [selectedScene, setSelectedScene] = useState<SceneType>(SceneType.KITCHEN);
  // Story mode: 'difficulty' → select easy/hard, 'scenes' → select level
  const [storyStep, setStoryStep] = useState<'difficulty' | 'scenes'>('difficulty');
  const [storyDifficulty, setStoryDifficulty] = useState<'easy' | 'hard' | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/assets/menu_bg.jpg';
  }, []);

  const scenesUnlocked = progress?.scenesUnlocked || [SceneType.KITCHEN];

  const gameModes = [
    { id: GameMode.STORY, name: '剧情模式', icon: <Swords size={24} />, desc: '10波标准关卡', disabled: false },
    { id: GameMode.ENDLESS, name: '无尽模式', icon: <Skull size={24} />, desc: '无限波次挑战', disabled: true },
    { id: GameMode.DAILY, name: '每日挑战', icon: <Trophy size={24} />, desc: '每日随机种子', disabled: true },
    // BOSS mode temporarily disabled
    // { id: GameMode.BOSS, name: 'BOSS战', icon: <Shield size={24} />, desc: '挑战螂老大' },
  ];

  const handleReset = () => {
    resetSeenComics();
    localStorage.clear();
    setTimeout(() => {
      window.location.href = window.location.pathname + '?reset=' + Date.now();
    }, 100);
  };

  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    if (mode === GameMode.STORY) {
      setStoryStep('difficulty');
      setStoryDifficulty(null);
      setShowModes(true);
    } else {
      setShowModes(true);
    }
  };

  // Talent overlay REMOVED - handled by parent GameCanvas
  // Achievements overlay REMOVED - handled by parent GameCanvas

  if (showModes && selectedMode === GameMode.STORY) {
    return (
      <div className="absolute inset-0 flex items-center justify-center overflow-y-auto py-4">
        <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-700" style={{ backgroundImage: 'url(/assets/menu_bg.jpg)', opacity: bgLoaded ? 1 : 0 }} />
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative z-10 text-center max-w-sm w-full mx-4 my-auto">
          {/* Talent tree button */}
          <button
            onClick={() => { audio?.playClick(); onOpenTalentTree(); }}
            className="mb-3 w-full bg-yellow-900/60 border border-yellow-600/40 rounded-lg px-3 py-1.5 flex items-center justify-center gap-2 hover:bg-yellow-800/60 transition-all hover:scale-105"
          >
            <Sparkles size={14} className="text-yellow-400" />
            <span className="text-yellow-300 text-sm font-bold">天赋树</span>
            {talentPoints > 0 && (
              <span className="ml-1 text-yellow-400 text-xs">({talentPoints})</span>
            )}
          </button>

          {storyStep === 'difficulty' ? (
            <>
              {/* STEP 1: Difficulty Selection */}
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <Swords size={20} className="text-amber-400" />
                选择难度
              </h2>
              <p className="text-stone-400 text-sm mb-6">剧情模式 — 选择你的挑战</p>

              {/* Easy — wasteland riveted metal */}
              <button
                onClick={() => { audio?.playClick(); setStoryDifficulty('easy'); setStoryStep('scenes'); }}
                className="relative w-full py-4 text-amber-100 font-bold text-xl font-mono tracking-wider hover:text-white transition-all hover:scale-105 active:scale-95 mb-3"
                style={{
                  background: 'linear-gradient(180deg, #3d3020 0%, #2a2218 100%)',
                  border: '2px solid #5a4a30',
                  borderRadius: '3px',
                  boxShadow: 'inset 0 1px 0 rgba(255,200,100,0.1), 0 3px 8px rgba(0,0,0,0.4)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}
              >
                <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <Swords size={20} className="inline mr-2" />
                简单
              </button>
              <div className="text-[10px] font-mono text-center mb-5" style={{ color: 'rgba(201,169,110,0.35)' }}>防线80HP · 中等难度 · 正常奖励</div>

              {/* Hard — wasteland ember plate */}
              <button
                onClick={() => { audio?.playClick(); setStoryDifficulty('hard'); setStoryStep('scenes'); }}
                className="relative w-full py-4 text-amber-100 font-bold text-xl font-mono tracking-wider hover:text-white transition-all hover:scale-105 active:scale-95 mb-3"
                style={{
                  background: 'linear-gradient(180deg, #5a1a00 0%, #3d1000 100%)',
                  border: '2px solid #6b3020',
                  borderRadius: '3px',
                  boxShadow: 'inset 0 1px 0 rgba(255,150,60,0.2), 0 3px 8px rgba(0,0,0,0.4)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}
              >
                <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <Flame size={20} className="inline mr-2" />
                困难
              </button>
              <div className="text-[10px] font-mono text-center" style={{ color: 'rgba(201,169,110,0.35)' }}>防线80HP · 极限挑战 · 更高奖励</div>

              <button onClick={() => { audio?.playClick(); setShowModes(false); setSelectedMode(null); setStoryStep('difficulty'); setStoryDifficulty(null); }} className="text-stone-400 hover:text-white text-sm font-mono transition-colors tracking-wider mt-6">
                [ 返回 ]
              </button>
            </>
          ) : (
            <>
              {/* STEP 2: Scene Selection */}
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <Map size={20} className="text-amber-400" />
                选择关卡
              </h2>
              <p className="text-stone-400 text-sm mb-4">
                {storyDifficulty === 'easy' ? '简单模式' : '困难模式'} — 选择一个场景
              </p>
              {/* Draggable scene list */}
              <div className="w-full mb-4" style={{ maxHeight: '55vh', overflowY: 'auto', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
                <div className="space-y-2 pr-1">
                  {SCENE_ORDER.map((sceneType) => {
                    const scene = SCENE_CONFIGS[sceneType];
                    const isUnlocked = scenesUnlocked.includes(sceneType);
                    return (
                      <button
                        key={sceneType}
                        onClick={() => { audio?.playClick(); if (isUnlocked && storyDifficulty) onStart(storyDifficulty, GameMode.STORY, sceneType); }}
                        disabled={!isUnlocked}
                        className={`w-full text-left rounded-xl border transition-all overflow-hidden ${
                          isUnlocked ? 'border-stone-600 hover:border-stone-400 hover:scale-[1.02]' : 'border-stone-800 opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <div className="h-14 flex items-center px-4" style={{ background: `linear-gradient(135deg, ${scene.bgColor}dd, ${scene.bgColor}88)` }}>
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isUnlocked ? 'bg-white/20' : 'bg-black/30'}`}>
                              {isUnlocked ? <Map size={16} className="text-white" /> : <Lock size={14} className="text-stone-600" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`font-bold text-sm ${isUnlocked ? 'text-white' : 'text-stone-500'}`}>{scene.name}</div>
                              <div className="text-[10px] text-stone-400 truncate">{scene.description}</div>
                            </div>
                          </div>
                          {isUnlocked ? (
                            <span className="text-[10px] text-yellow-400 font-bold ml-2">x{scene.rewardMultiplier}奖励</span>
                          ) : (
                            <span className="text-[10px] text-stone-600 ml-2">锁定</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={() => { audio?.playClick(); setStoryStep('difficulty'); }} className="text-stone-400 hover:text-white text-sm font-mono transition-colors tracking-wider">
                [ 返回难度选择 ]
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-700" style={{ backgroundImage: 'url(/assets/menu_bg.jpg)', opacity: bgLoaded ? 1 : 0 }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

      <div className="relative z-10 text-center max-w-sm w-full mx-4 flex flex-col items-center">

        {/* Audio toggle — top-right corner speaker icon */}
        <button
          onClick={() => { audio?.playClick(); onToggleMute(); }}
          className="fixed top-3 right-3 z-50 p-2 rounded-full bg-black/40 text-stone-400 hover:text-amber-300 hover:bg-black/60 transition-all"
          title={audioMuted ? '开启音效' : '静音'}
        >
          {audioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        {/* Title — wasteland style */}
        <div className="mb-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Flame size={28} style={{ color: '#8B4513', filter: 'drop-shadow(0 0 6px rgba(255,100,30,0.4))' }} />
            <h1
              className="text-5xl font-black tracking-wider"
              style={{
                color: '#c9a96e',
                textShadow: '0 0 20px rgba(201,169,110,0.3), 0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6)',
              }}
            >
              烈焰除蟑
            </h1>
            <Flame size={28} style={{ color: '#8B4513', filter: 'drop-shadow(0 0 6px rgba(255,100,30,0.4))' }} />
          </div>
          <h2
            className="text-base font-bold tracking-[0.5em] font-mono"
            style={{ color: 'rgba(201, 169, 110, 0.5)' }}
          >
            火线守卫
          </h2>
        </div>

        {/* Gun image */}
        <div className="mb-5">
          <img src="/assets/gun.png" alt="gun" className="w-24 h-24 object-contain drop-shadow-2xl" draggable={false} />
        </div>

        {/* Talent tree entrance button */}
        <button
          onClick={() => { audio?.playClick(); onOpenTalentTree(); }}
          className="mb-3 w-full bg-yellow-900/60 border border-yellow-600/40 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-yellow-800/60 transition-all hover:scale-105"
        >
          <Sparkles size={14} className="text-yellow-400" />
          <span className="text-yellow-300 text-sm font-bold">天赋树</span>
          {talentPoints > 0 && (
            <span className="ml-1 text-yellow-400 text-xs">({talentPoints})</span>
          )}
        </button>

        {/* 4 Game Mode Cards — wasteland riveted metal plates */}
        {!showModes ? (
          <div className="w-full grid grid-cols-2 gap-3 mb-4">
            {gameModes.map((mode) => (
              <button
                key={mode.id}
                disabled={mode.disabled}
                onClick={() => {
                  if (mode.id === GameMode.STORY) {
                    handleModeSelect(mode.id);
                    setShowModes(true);
                  } else if (mode.id === GameMode.ENDLESS) {
                    handleModeSelect(mode.id);
                    setShowModes(true);
                  } else {
                    setShowModes(true);
                    handleModeSelect(mode.id);
                    const scene = SceneType.KITCHEN;
                    onStart('easy', mode.id, scene);
                  }
                }}
                className={`relative flex flex-col items-center gap-2 p-4 font-bold transition-all ${mode.disabled ? 'text-stone-600 cursor-not-allowed opacity-60' : 'text-amber-100/80 hover:text-amber-100 hover:scale-105 active:scale-95'}`}
                style={{
                  background: 'linear-gradient(180deg, #2a2218 0%, #1a1410 100%)',
                  border: '2px solid #3d3020',
                  borderRadius: '4px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 3px 8px rgba(0,0,0,0.4)',
                }}
              >
                {/* Rivets */}
                <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
                <div className="w-12 h-12 rounded-sm flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}>
                  {mode.icon}
                </div>
                <div className="text-center">
                  <div className="text-sm font-mono tracking-wider">{mode.name}</div>
                  <div className="text-[9px] font-mono" style={{ color: 'rgba(201,169,110,0.4)' }}>{mode.desc}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Endless/Boss Mode: Scene + Difficulty Selection */
          <div className="w-full space-y-2 mb-4">
            {/* Scene selection for endless mode */}
            {selectedMode === GameMode.ENDLESS && (
              <div className="w-full space-y-2 mb-3">
                <div className="text-center text-white font-bold text-lg mb-2">选择场景</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: SceneType.KITCHEN, icon: '🍳', label: '恐怖厨房' },
                    { type: SceneType.SEWER, icon: '🕳️', label: '阴暗下水道' },
                    { type: SceneType.DUMP, icon: '🗑️', label: '垃圾场' },
                    { type: SceneType.BASEMENT, icon: '🏚️', label: '地下室' },
                    { type: SceneType.STREET, icon: '🌃', label: '城市街道' },
                    { type: SceneType.ROOFTOP, icon: '🏢', label: '天台' },
                    { type: SceneType.HOSPITAL, icon: '🏥', label: '废弃医院' },
                    { type: SceneType.SUBWAY, icon: '🚇', label: '废弃地铁' },
                    { type: SceneType.SUPERMARKET, icon: '🛒', label: '废弃超市' },
                    { type: SceneType.SCHOOL, icon: '📚', label: '废弃学校' },
                    { type: SceneType.NEST, icon: '👑', label: '蟑螂巢穴' },
                  ].map(({ type, icon, label }) => (
                    <button
                      key={type}
                      onClick={() => { audio?.playClick(); setSelectedScene(type); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                        selectedScene === type
                          ? 'bg-amber-900/60 border-amber-500 text-amber-300'
                          : 'bg-stone-900/40 border-stone-700/50 text-stone-400 hover:border-stone-500'
                      }`}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center text-white font-bold text-lg mb-3">选择难度</div>
            {/* Easy — wasteland metal plate */}
            <button
              onClick={() => {
                audio?.playClick();
                const scene = selectedScene || SceneType.STREET;
                onStart('easy', selectedMode || GameMode.ENDLESS, scene);
              }}
              className="relative w-full flex items-center justify-center gap-2 text-amber-100 font-bold text-lg py-3.5 font-mono tracking-wider hover:text-white transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(180deg, #3d3020 0%, #2a2218 100%)',
                border: '2px solid #5a4a30',
                borderRadius: '3px',
                boxShadow: 'inset 0 1px 0 rgba(255,200,100,0.1), 0 3px 8px rgba(0,0,0,0.4)',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}
            >
              <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
              <Swords size={20} />
              简单模式
            </button>
            <div className="text-[10px] font-mono text-center" style={{ color: 'rgba(201,169,110,0.35)' }}>防线80HP · 中等难度</div>

            {/* Hard — wasteland ember plate */}
            <button
              onClick={() => {
                audio?.playClick();
                const scene = selectedScene || SceneType.STREET;
                onStart('hard', selectedMode || GameMode.ENDLESS, scene);
              }}
              className="relative w-full flex items-center justify-center gap-2 text-amber-100 font-bold text-lg py-3.5 font-mono tracking-wider hover:text-white transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(180deg, #5a1a00 0%, #3d1000 100%)',
                border: '2px solid #6b3020',
                borderRadius: '3px',
                boxShadow: 'inset 0 1px 0 rgba(255,150,60,0.2), 0 3px 8px rgba(0,0,0,0.4)',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}
            >
              <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
              <Flame size={20} />
              困难模式
            </button>
            <div className="text-[10px] text-stone-400 text-center">防线80HP · 极限挑战</div>

            <button onClick={() => { audio?.playClick(); setShowModes(false); setSelectedMode(null); }} className="text-stone-400 hover:text-white text-sm transition-colors mt-1">
              返回模式选择
            </button>
          </div>
        )}

        {/* Bottom buttons — wasteland riveted metal plates */}
        {/* Order: 道具商店 → 天赋 → 成就 → 图鉴 */}
        <div className="w-full grid grid-cols-4 gap-2 mb-3">
          {/* 1. 道具商店 */}
          <button
            onClick={() => { audio?.playClick(); onOpenShop(); }}
            className="relative flex flex-col items-center gap-1.5 py-3 text-amber-200/60 hover:text-amber-200 transition-all"
            style={{
              background: 'linear-gradient(180deg, #2a2218 0%, #1a1410 100%)',
              border: '1px solid #3d3020',
              borderRadius: '3px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <ShoppingBag size={16} />
            <span className="text-[9px] font-mono tracking-wider">道具商店</span>
          </button>

          {/* 2. 天赋 */}
          <button
            onClick={onOpenTalentTree}
            className="relative flex flex-col items-center gap-1.5 py-3 text-amber-200/60 hover:text-amber-200 transition-all"
            style={{
              background: 'linear-gradient(180deg, #2a2218 0%, #1a1410 100%)',
              border: '1px solid #3d3020',
              borderRadius: '3px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <Sparkles size={16} />
            <span className="text-[9px] font-mono tracking-wider">天赋</span>
            {talentPoints > 0 && (
              <span className="absolute -top-1.5 -right-1 bg-red-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-stone-900">{talentPoints}</span>
            )}
          </button>

          {/* 3. 成就 */}
          <button
            onClick={() => { audio?.playClick(); onOpenAchievements(); }}
            className="relative flex flex-col items-center gap-1.5 py-3 text-amber-200/60 hover:text-amber-200 transition-all"
            style={{
              background: 'linear-gradient(180deg, #2a2218 0%, #1a1410 100%)',
              border: '1px solid #3d3020',
              borderRadius: '3px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <Award size={16} />
            <span className="text-[9px] font-mono tracking-wider">成就</span>
          </button>

          {/* 4. 图鉴 */}
          <button
            onClick={() => { audio?.playClick(); onOpenEncyclopedia(); }}
            className="relative flex flex-col items-center gap-1.5 py-3 text-amber-200/60 hover:text-amber-200 transition-all"
            style={{
              background: 'linear-gradient(180deg, #2a2218 0%, #1a1410 100%)',
              border: '1px solid #3d3020',
              borderRadius: '3px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <Bug size={16} />
            <span className="text-[9px] font-mono tracking-wider">图鉴</span>
          </button>

        </div>

        {/* Reset progress button */}
        <div className="w-full flex justify-start mt-2">
          <button
            onClick={() => { audio?.playClick(); setShowResetConfirm(true); }}
            className="flex items-center gap-1.5 text-stone-500 hover:text-red-400 transition-colors py-1.5 px-2 rounded hover:bg-stone-800/50"
            title="重置游戏进度"
          >
            <RotateCcw size={12} />
            <span className="text-[10px] font-mono tracking-wider">重置</span>
          </button>
        </div>

        {/* Custom reset confirmation dialog */}
        {showResetConfirm && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowResetConfirm(false); }}
          >
            <div className="bg-stone-900 border border-red-900/60 rounded-xl p-6 max-w-xs w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">重置进度</h3>
                  <p className="text-stone-400 text-xs">此操作不可恢复</p>
                </div>
              </div>
              <p className="text-stone-300 text-sm mb-6 leading-relaxed">
                确定要删除所有游戏存档吗？包括天赋点、关卡解锁进度、成就和设置都将被清除。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { audio?.playClick(); setShowResetConfirm(false); }}
                  className="flex-1 py-2.5 rounded-lg bg-stone-800 text-stone-300 font-bold text-sm hover:bg-stone-700 transition-all active:scale-95"
                >
                  取消
                </button>
                <button
                  onClick={() => { audio?.playClick(); handleReset(); }}
                  className="flex-1 py-2.5 rounded-lg bg-red-900/80 text-red-200 font-bold text-sm hover:bg-red-800 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};