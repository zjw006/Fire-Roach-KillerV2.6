/**
 * @fileoverview 主菜单组件。
 * 提供游戏模式选择（剧情 / 无尽 / 每日挑战 / BOSS 战）、
 * 剧情模式下的难度选择（简单 / 困难）和关卡选择，
 * 以及天赋树、道具商店、成就、图鉴等子界面的入口。
 * 采用废土风格（铆钉金属板）视觉设计。
 */
import React, { useEffect, useState } from 'react';
import {
  Flame, Volume2, VolumeX, Swords,
  Skull, Map, RotateCcw, AlertTriangle, Trash2, Lock,
} from 'lucide-react';
import { GameMode, SceneType, type GameProgress } from '@/game/types';
import { SCENE_CONFIGS, STORY_LEVELS, TEXT_CONFIG } from '@/game/data';
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
  // ── 状态管理 ──
  const [bgLoaded, setBgLoaded] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [selectedScene, setSelectedScene] = useState<SceneType>(SceneType.KITCHEN);
  /** v2.6：难度选择已移除，剧情模式直接进入关卡选择（简单 11 关 + 巢穴后 6 个困难关） */
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  /** 预加载菜单背景图 */
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/assets/bg_kitchen_easy.jpg';
  }, []);

  const scenesUnlocked = progress?.scenesUnlocked || [SceneType.KITCHEN];
  // 天赋系统解锁门槛：通关地下室(basement)后解锁，此前主菜单天赋入口锁定
  const talentUnlocked = !!progress?.scenesCompleted?.includes('basement');

  /** 游戏模式列表（部分模式暂未开放） */
  const gameModes: { id: GameMode; name: string; icon: React.ReactNode; desc: string; disabled: boolean }[] = [
    { id: GameMode.STORY, name: TEXT_CONFIG.ui.menu.storyMode, icon: <Swords size={24} />, desc: TEXT_CONFIG.ui.menu.storyDesc, disabled: false },
    { id: GameMode.ENDLESS, name: TEXT_CONFIG.ui.menu.endlessMode, icon: <Skull size={24} />, desc: TEXT_CONFIG.ui.menu.endlessDesc, disabled: true },
    // BOSS mode temporarily disabled
    // { id: GameMode.BOSS, name: 'BOSS战', icon: <Shield size={24} />, desc: '挑战螂老大' },
  ];

  /** 重置所有游戏进度：清除 localStorage → 刷新页面 */
  const handleReset = () => {
    resetSeenComics();
    localStorage.clear();
    setTimeout(() => {
      window.location.href = window.location.pathname + '?reset=' + Date.now();
    }, 100);
  };

  /** 选择游戏模式：剧情模式直接进入关卡选择（难度选择已移除） */
  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    setShowModes(true);
  };

  // Talent overlay REMOVED - handled by parent GameCanvas
  // Achievements overlay REMOVED - handled by parent GameCanvas

  {/* ═══ 剧情模式 → 关卡选择（v2.6：难度选择已移除，巢穴后追加 6 个困难关）═══ */}
  if (showModes && selectedMode === GameMode.STORY) {
    return (
      <div className="absolute inset-0 flex items-center justify-center overflow-y-auto py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-700/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-stone-600/60">
        <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-700" style={{ backgroundImage: 'url(/assets/bg_kitchen_easy.jpg)', opacity: bgLoaded ? 1 : 0 }} />
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative z-10 text-center max-w-sm w-full mx-4 my-auto">
          {/* Talent tree button */}
          <button
            onClick={() => { audio?.playClick(); onOpenTalentTree(); }}
            className="mb-3 w-full relative transition-all hover:scale-105 active:scale-95 hidden"
          >
            <img src="/assets/UI/btn_talent_tree.png" alt="" className="w-full h-auto" draggable={false} />
            <span className="absolute inset-0 flex items-center justify-center text-yellow-300 text-sm font-bold [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000]">{TEXT_CONFIG.ui.menu.talent}</span>
            {talentPoints > 0 && (
              <span className="absolute top-1 right-2 bg-red-600 text-white text-[10px] font-bold rounded-full px-2 py-0.5 border border-stone-900">{talentPoints}</span>
            )}
          </button>

          {/* 关卡选择（11 简单关 + 6 困难关） */}
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Map size={20} className="text-amber-400" />
            {TEXT_CONFIG.ui.menu.selectScene}
          </h2>
          <p className="text-stone-400 text-sm mb-4">选择一个关卡</p>
          {/* Draggable scene list */}
          <div className="w-full mb-4" style={{ maxHeight: '55vh', overflowY: 'auto', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
            <div className="space-y-2 pr-1">
              {STORY_LEVELS.map((level) => {
                const scene = SCENE_CONFIGS[level.scene];
                const isHard = level.difficulty === 'hard';
                const isUnlocked = scenesUnlocked.includes(level.id);
                // 该关卡历史最佳星级（0-3，防线血量不含加血评级，过关多次取最多）
                const bestStars = progress?.levelStars?.[level.id] ?? 0;
                return (
                  <button
                    key={level.id}
                    onClick={() => { audio?.playClick(); if (isUnlocked) onStart(level.difficulty, GameMode.STORY, level.scene); }}
                    disabled={!isUnlocked}
                    className={`w-full text-left rounded-xl border transition-all overflow-hidden ${
                      isUnlocked
                        ? isHard ? 'border-red-900/80 hover:border-red-700 hover:scale-[1.02]' : 'border-stone-600 hover:border-stone-400 hover:scale-[1.02]'
                        : 'border-stone-800 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="h-14 flex items-center px-4" style={{ background: `linear-gradient(135deg, ${scene.bgColor}dd, ${scene.bgColor}88)` }}>
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isUnlocked ? 'bg-white/20' : 'bg-black/30'}`}>
                          {isUnlocked ? <Map size={16} className="text-white" /> : <Lock size={14} className="text-stone-600" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`font-bold text-sm flex items-center gap-1.5 ${isUnlocked ? 'text-white' : 'text-stone-500'}`}>
                            {level.name}
                            {isHard && isUnlocked && (
                              <span className="text-[9px] font-mono text-red-400 border border-red-700/70 rounded px-1 py-px leading-none">困难</span>
                            )}
                          </div>
                          <div className="text-[10px] text-stone-400 truncate">{scene.description}</div>
                        </div>
                      </div>
                      {/* 星级评价槽：默认3槽，点亮历史最佳（图标与结算界面一致） */}
                      <div className="flex items-center gap-1 mx-2">
                        {[1, 2, 3].map((star) => (
                          <div
                            key={star}
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              isUnlocked && star <= bestStars
                                ? 'bg-yellow-500 text-white shadow-md'
                                : 'bg-stone-800/80 text-stone-600 border border-stone-700'
                            }`}
                          >
                            <Flame size={9} />
                          </div>
                        ))}
                      </div>
                      {isUnlocked ? (
                        <span className="text-[10px] text-yellow-400 font-bold ml-2">{TEXT_CONFIG.ui.menu.rewardMultiplier(scene.rewardMultiplier)}</span>
                      ) : (
                        <span className="text-[10px] text-stone-600 ml-2">{TEXT_CONFIG.ui.menu.locked}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={() => { audio?.playClick(); setShowModes(false); setSelectedMode(null); }} className="text-stone-400 hover:text-white text-sm font-mono transition-colors tracking-wider">
            [ {TEXT_CONFIG.ui.menu.back} ]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-700" style={{ backgroundImage: 'url(/assets/bg_kitchen_easy.jpg)', opacity: bgLoaded ? 1 : 0 }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

      <div className="relative z-10 text-center max-w-sm w-full mx-4 flex flex-col items-center pb-28 mt-[30px]">

        {/* ═══ 音频开关按钮（右上角）═══ */}
        <button
          onClick={() => { audio?.playClick(); onToggleMute(); }}
          className="absolute top-[-38px] right-0 p-2 rounded-full bg-black/40 text-stone-400 hover:text-amber-300 hover:bg-black/60 transition-all"
          title={audioMuted ? TEXT_CONFIG.ui.menu.unmute : TEXT_CONFIG.ui.menu.mute}
        >
          {audioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        {/* ═══ 游戏标题（废土风格）═══ */}
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
              {TEXT_CONFIG.ui.menu.title}
            </h1>
            <Flame size={28} style={{ color: '#8B4513', filter: 'drop-shadow(0 0 6px rgba(255,100,30,0.4))' }} />
          </div>
          <h2
            className="text-base font-bold tracking-[0.5em] font-mono"
            style={{ color: 'rgba(201, 169, 110, 0.5)' }}
          >
            {TEXT_CONFIG.ui.menu.subtitle}
          </h2>
        </div>

        {/* ═══ 喷火枪图片 ═══ */}
        <div className="mb-5">
          <img src="/assets/gun.png" alt="gun" className="w-24 h-24 object-contain drop-shadow-2xl" draggable={false} />
        </div>

        {/* ═══ 天赋树入口按钮 ═══ */}
        <button
          onClick={() => { audio?.playClick(); onOpenTalentTree(); }}
          className="mb-3 w-full transition-all hover:scale-105 active:scale-95 relative hidden"
        >
          <img src="/assets/UI/btn_talent_tree.png" alt="天赋树" className="w-full h-auto" draggable={false} />
          {talentPoints > 0 && (
            <span className="absolute top-1 right-2 bg-red-600 text-white text-[10px] font-bold rounded-full px-2 py-0.5 border border-stone-900">{talentPoints}</span>
          )}
        </button>

        {/* ═══ 游戏模式卡片（图片资源）═══ */}
        {!showModes ? (
          <div className="w-full grid grid-cols-2 gap-3 mb-4">
            {gameModes.map((mode) => {
              const modeImages: Record<string, string> = {
                [GameMode.STORY]: '/assets/UI/btn_story.png',
                [GameMode.ENDLESS]: '/assets/UI/btn_endless.png',
              };
              return (
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
                className={`relative transition-all ${mode.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
              >
                <img src={modeImages[mode.id]} alt="" className="w-full h-auto" draggable={false} />
                <span className="absolute inset-0 flex items-center justify-center text-amber-100/80 text-sm font-mono tracking-wider font-bold [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000] pt-[30%]">{mode.name}</span>
              </button>
            );
            })}
          </div>
        ) : (
          /* ═══ 无尽 / Boss 模式：场景 + 难度选择 ═══ */
          <div className="w-full space-y-2 mb-4">
            {/* Scene selection for endless mode */}
            {selectedMode === GameMode.ENDLESS && (
              <div className="w-full space-y-2 mb-3">
                <div className="text-center text-white font-bold text-lg mb-2">{TEXT_CONFIG.ui.menu.selectScene}</div>
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

            {/* 仅简单模式（v2.6：困难模式已移除，困难关卡作为剧情关卡置于巢穴后） */}
            <button
              onClick={() => {
                audio?.playClick();
                const scene = selectedScene || SceneType.STREET;
                onStart('easy', selectedMode || GameMode.ENDLESS, scene);
              }}
              className="relative w-full transition-all hover:scale-105 active:scale-95"
            >
              <img src="/assets/UI/btn_easy.png" alt="" className="w-full h-auto" draggable={false} />
              <span className="absolute inset-0 flex items-center justify-center text-amber-100 font-bold text-lg font-mono tracking-wider [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000] pl-[5%]">{TEXT_CONFIG.ui.menu.easy}</span>
            </button>

            <button onClick={() => { audio?.playClick(); setShowModes(false); setSelectedMode(null); }} className="text-stone-400 hover:text-white text-sm transition-colors mt-1">
              {TEXT_CONFIG.ui.menu.backToMode}
            </button>
          </div>
        )}
      </div>

      {/* ═══ 固定底部栏：功能按钮 + 重置 ═══ */}
      <div className="absolute bottom-0 left-0 right-0 z-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 60%, transparent 100%)' }}>
        <div className="max-w-sm mx-auto px-4 pt-4 pb-3">
          {/* 底部功能按钮：道具商店 → 天赋 → 成就 → 图鉴 */}
          <div className="w-full grid grid-cols-4 gap-2 mb-2">
            {/* 1. 道具商店 */}
            <button
              onClick={() => { audio?.playClick(); onOpenShop(); }}
              className="relative transition-all hover:scale-105 active:scale-95"
            >
              <img src="/assets/UI/btn_shop.png" alt="" className="w-full h-auto" draggable={false} />
              <span className="absolute inset-0 flex items-center justify-center text-amber-200/80 text-[9px] font-mono tracking-wider [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000] pt-[25%]">{TEXT_CONFIG.ui.menu.shop}</span>
            </button>

            {/* 2. 天赋（通关地下室后解锁） */}
            <button
              onClick={talentUnlocked ? onOpenTalentTree : undefined}
              className={`relative transition-all hover:scale-105 active:scale-95 ${talentUnlocked ? '' : 'opacity-40 cursor-not-allowed'}`}
            >
              <img src="/assets/UI/btn_talent.png" alt="" className="w-full h-auto" draggable={false} />
              <span className="absolute inset-0 flex items-center justify-center text-amber-200/80 text-[9px] font-mono tracking-wider [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000] pt-[25%]">{TEXT_CONFIG.ui.menu.talent}</span>
              {!talentUnlocked ? (
                <Lock size={12} className="absolute -top-1.5 -right-1 text-stone-500" />
              ) : (
                talentPoints > 0 && (
                  <span className="absolute -top-1.5 -right-1 bg-red-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-stone-900">{talentPoints}</span>
                )
              )}
            </button>

            {/* 3. 成就 */}
            <button
              onClick={() => { audio?.playClick(); onOpenAchievements(); }}
              className="relative transition-all hover:scale-105 active:scale-95"
            >
              <img src="/assets/UI/btn_achievement.png" alt="" className="w-full h-auto" draggable={false} />
              <span className="absolute inset-0 flex items-center justify-center text-amber-200/80 text-[9px] font-mono tracking-wider [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000] pt-[25%]">{TEXT_CONFIG.ui.menu.achievements}</span>
            </button>

            {/* 4. 图鉴 */}
            <button
              onClick={() => { audio?.playClick(); onOpenEncyclopedia(); }}
              className="relative transition-all hover:scale-105 active:scale-95"
            >
              <img src="/assets/UI/btn_encyclopedia.png" alt="" className="w-full h-auto" draggable={false} />
              <span className="absolute inset-0 flex items-center justify-center text-amber-200/80 text-[9px] font-mono tracking-wider [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000] pt-[25%]">{TEXT_CONFIG.ui.menu.encyclopedia}</span>
            </button>
          </div>

          {/* 重置进度按钮 */}
          <div className="w-full flex justify-start">
            <button
              onClick={() => { audio?.playClick(); setShowResetConfirm(true); }}
              className="flex items-center gap-1.5 text-stone-500 hover:text-red-400 transition-colors py-1.5 px-2 rounded hover:bg-stone-800/50"
              title="重置游戏进度"
            >
              <RotateCcw size={12} />
              <span className="text-[10px] font-mono tracking-wider">{TEXT_CONFIG.ui.menu.reset}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 重置确认对话框 ═══ */}
      {showResetConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowResetConfirm(false); }}
          >
            <div className="bg-stone-900 border border-red-900/60 rounded-xl p-6 max-w-xs w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">{TEXT_CONFIG.ui.menu.resetTitle}</h3>
                  <p className="text-stone-400 text-xs">{TEXT_CONFIG.ui.menu.resetDesc}</p>
                </div>
              </div>
              <p className="text-stone-300 text-sm mb-6 leading-relaxed">
                {TEXT_CONFIG.ui.menu.resetConfirm}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { audio?.playClick(); setShowResetConfirm(false); }}
                  className="flex-1 py-2.5 rounded-lg bg-stone-800 text-stone-300 font-bold text-sm hover:bg-stone-700 transition-all active:scale-95"
                >
                  {TEXT_CONFIG.ui.menu.cancel}
                </button>
                <button
                  onClick={() => { audio?.playClick(); handleReset(); }}
                  className="flex-1 py-2.5 rounded-lg bg-red-900/80 text-red-200 font-bold text-sm hover:bg-red-800 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  {TEXT_CONFIG.ui.menu.confirmDelete}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};