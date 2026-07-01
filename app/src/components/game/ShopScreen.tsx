import React, { useState, useMemo, useRef } from 'react';
import {
  ArrowRight, ArrowLeft, Home, Sparkles, Flame, Shield,
} from 'lucide-react';
import { CONSUMABLE_DEFS } from '@/game/data';
import type { Economy, SceneType } from '@/game/types';
import type { AudioManager } from '@/game/audio';
import { ShopTutorialOverlay } from './ShopTutorialOverlay';

interface ShopScreenProps {
  economy: Economy;
  onBuy: (id: string) => boolean;
  onContinue: () => void;
  onQuit: () => void;
  talentPoints?: number;
  nextSceneName?: string;
  onNextScene?: () => void;
  difficulty?: 'easy' | 'hard';
  currentScene?: SceneType;
  onOpenTalentTree?: () => void;
  isMenuShop?: boolean;
  audio?: AudioManager;
}

// Flame gun related consumables
const FLAME_CONSUMABLE_IDS = ['gas_refill', 'emergency_cool', 'power_boost'];
// Other consumables
const OTHER_CONSUMABLE_IDS = ['defense_repair', 'shield', 'bait'];

export const ShopScreen: React.FC<ShopScreenProps> = ({
  economy, onBuy, onContinue, onQuit,
  talentPoints, nextSceneName, onNextScene,
  difficulty = 'easy', currentScene, onOpenTalentTree,
  isMenuShop = false, audio}) => {
  const isBasement = currentScene === 'basement';

  const [localMoney, setLocalMoney] = useState(economy.money);
  // Load owned consumables from localStorage
  const [ownedConsumables, setOwnedConsumables] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('roach_blaster_consumables');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.consumables || {};
      }
    } catch { /* ignore */ }
    return {};
  });
  const [ownedEmergencyCool, setOwnedEmergencyCool] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('roach_blaster_consumables');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.emergencyCool || 0;
      }
    } catch { /* ignore */ }
    return 0;
  });

  // Refs for shop tutorial highlighting
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const ownedRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const visibleConsumables = useMemo(() => {
    return CONSUMABLE_DEFS.filter(c => !c.hardOnly || difficulty === 'hard');
  }, [difficulty]);

  const flameConsumables = useMemo(() => {
    return visibleConsumables.filter(c => FLAME_CONSUMABLE_IDS.includes(c.id));
  }, [visibleConsumables]);

  const otherConsumables = useMemo(() => {
    return visibleConsumables.filter(c => OTHER_CONSUMABLE_IDS.includes(c.id));
  }, [visibleConsumables]);

  const handleBuy = (id: string) => {
    const item = CONSUMABLE_DEFS.find(c => c.id === id);
    if (!item || localMoney < item.cost) return;
    const success = onBuy(id);
    if (success) {
      setLocalMoney(prev => prev - item.cost);
      // Refresh owned consumables display
      try {
        const saved = localStorage.getItem('roach_blaster_consumables');
        if (saved) {
          const parsed = JSON.parse(saved);
          setOwnedConsumables(parsed.consumables || {});
          setOwnedEmergencyCool(parsed.emergencyCool || 0);
        }
      } catch { /* ignore */ }
    }
  };

  const renderItemRow = (item: typeof CONSUMABLE_DEFS[0]) => {
    const canAfford = localMoney >= item.cost;
    return (
      <div
        key={item.id}
        ref={(el) => { cardRefs.current[item.id] = el; }}
        className={`bg-stone-800/60 rounded-xl p-3 flex items-center gap-3 border-2 transition-all shadow-md ${
          canAfford
            ? 'border-stone-500 hover:border-yellow-500/60 hover:bg-stone-700/60 hover:shadow-lg'
            : 'border-stone-700 opacity-50'
        }`}
      >
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shrink-0 overflow-hidden`}>
          <img src={item.icon} alt={item.name} className="w-9 h-9 object-contain" />
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="font-bold text-white text-sm leading-tight">
            {item.name}
            {item.hardOnly && <span className="text-red-400 text-[10px] ml-1">[困]</span>}
          </div>
          <div className="text-xs text-stone-400 leading-tight">{item.description}</div>
          <div className="text-[10px] text-stone-500 leading-tight">{item.effectDesc}{item.cooldown ? ` | 冷却:${item.cooldown}秒` : ' | 无冷却'}</div>
        </div>
        {/* Price & Buy */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="text-yellow-400 font-bold text-sm">&yen;{item.cost}</div>
          <button
            onClick={() => { audio?.playClick(); handleBuy(item.id); }}
            disabled={!canAfford}
            className={`text-xs px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
              canAfford
                ? 'bg-yellow-600 hover:bg-yellow-500 text-white active:scale-95'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed'
            }`}
          >
            {canAfford ? '购买' : '资金不足'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-stone-900/90 rounded-2xl p-4 max-w-full w-full mx-2 border border-stone-700 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          {isMenuShop ? (
            <button
              onClick={() => { audio?.playClick(); onQuit(); }}
              className="flex items-center gap-1 text-stone-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-sm">返回</span>
            </button>
          ) : (
            <div /> // spacer
          )}
          <h2 className="text-3xl font-bold text-yellow-400">补给站</h2>
          <div /> {/* right spacer for balance */}
        </div>
        <p className="text-stone-400 text-sm text-center mb-3 shrink-0">
          购买一次性消耗品，为下一关做准备
          {difficulty === 'hard' && <span className="text-red-400 ml-2">[困难模式]</span>}
        </p>

        {/* Stats */}
        {isMenuShop ? (
          <div className="text-center mb-3 shrink-0">
            <div className="text-stone-400 text-xs">当前资金</div>
            <div className="text-xl font-bold text-amber-400 shop-money">&yen;{localMoney}</div>
          </div>
        ) : (
          <div className="bg-black/50 rounded-xl px-4 py-2 mb-3 flex items-center justify-between shrink-0">
            <div className="text-center">
              <div className="text-stone-400 text-xs">当前资金</div>
              <div className="text-xl font-bold text-amber-400 shop-money">&yen;{localMoney}</div>
            </div>
            {talentPoints !== undefined && (
              <div className="text-center">
                <div className="text-stone-400 text-xs">天赋点</div>
                <div className="text-xl font-bold text-yellow-400 flex items-center gap-1">
                  <Sparkles size={14} /> {talentPoints}
                </div>
              </div>
            )}
            <div className="text-center">
              <div className="text-stone-400 text-xs">总击杀</div>
              <div className="text-xl font-bold text-red-400">{economy.totalKills}</div>
            </div>
          </div>
        )}

        {/* Scrollable item list */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-1 mb-3">
          {/* Flame Gun Consumables */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={16} className="text-orange-400" />
              <h3 className="text-orange-400 text-sm font-bold">火枪相关</h3>
              <div className="flex-1 h-px bg-orange-900/50" />
            </div>
            <div className="flex flex-col gap-2">
              {flameConsumables.map(renderItemRow)}
            </div>
          </div>

          {/* Other Consumables */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-cyan-400" />
              <h3 className="text-cyan-400 text-sm font-bold">辅助道具</h3>
              <div className="flex-1 h-px bg-cyan-900/50" />
            </div>
            <div className="flex flex-col gap-2">
              {otherConsumables.map(renderItemRow)}
            </div>
          </div>

          {/* Basement talent guide hint — hidden in menu shop */}
          {!isMenuShop && isBasement && talentPoints && talentPoints > 0 && onOpenTalentTree && (
            <div className="bg-gradient-to-r from-yellow-900/60 to-orange-900/60 border border-yellow-500/40 rounded-xl p-3 mb-3 flex items-center gap-3 animate-pulse">
              <Sparkles size={24} className="text-yellow-400 shrink-0" />
              <div className="flex-1">
                <div className="text-yellow-300 text-sm font-bold">获得天赋点！</div>
                <div className="text-yellow-400/70 text-xs">通关奖励，可用于永久强化角色能力</div>
              </div>
              <button
                onClick={() => { audio?.playClick(); onOpenTalentTree?.(); }}
                className="shrink-0 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <Sparkles size={12} />
                去加点
              </button>
            </div>
          )}
        </div>

        {/* Sticky bottom: Owned consumables */}
        <div ref={ownedRef} className="shrink-0 bg-stone-900/95 border border-stone-600 rounded-xl p-3 -mx-1">
          <div className="text-stone-400 text-xs mb-2 text-center font-bold">已拥有道具</div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {visibleConsumables.map((item) => {
              const count = item.id === 'emergency_cool' ? ownedEmergencyCool : (ownedConsumables[item.id] || 0);
              if (count <= 0) return null;
              return (
                <div key={item.id} className="relative flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center overflow-hidden border-2 border-stone-500`}>
                    <img src={item.icon} alt={item.name} className="w-7 h-7 object-contain" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 bg-black/80 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-stone-500">
                    {count}
                  </span>
                </div>
              );
            })}
            {/* Show empty state if no consumables owned */}
            {visibleConsumables.every(item => {
              const count = item.id === 'emergency_cool' ? ownedEmergencyCool : (ownedConsumables[item.id] || 0);
              return count <= 0;
            }) && (
              <div className="text-stone-600 text-xs">暂无道具</div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          {!isMenuShop && (
            onNextScene ? (
              <button
                onClick={() => { audio?.playClick(); onNextScene?.(); }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105 shadow-lg shadow-amber-900/40"
              >
                进入下一关：{nextSceneName}
                <ArrowRight size={20} />
              </button>
            ) : (
              <button
                onClick={() => { audio?.playClick(); onContinue(); }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-600 hover:from-amber-500 hover:to-amber-500 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105"
              >
                再来一局
                <ArrowRight size={20} />
              </button>
            )
          )}
          {!isMenuShop && (
            <button
              onClick={() => { audio?.playClick(); onQuit(); }}
              className="w-full flex items-center justify-center gap-2 bg-stone-700 hover:bg-stone-600 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105"
            >
              <Home size={20} />
              返回主菜单
            </button>
          )}
        </div>

        {/* Shop tutorial overlay - highlights each consumable */}
        <ShopTutorialOverlay
          audio={audio}
          cardRefs={cardRefs}
          ownedRef={ownedRef}
          scrollContainerRef={scrollContainerRef}
          onComplete={() => { /* shop tutorial done */ }}
          onSkip={() => { /* shop tutorial skipped */ }}
        />
      </div>
    </div>
  );
};
