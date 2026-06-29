import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, SkipForward, ShoppingCart } from 'lucide-react';
import type { AudioManager } from '@/game/audio';

const TUTORIAL_KEY = 'shop_tutorial_seen';

interface ShopTutorialStep {
  id: string;
  title: string;
  zhangshuText: string;
  consumableId?: string;
  highlightOwned?: boolean;
  // Dynamic dialog position based on highlighted item position
  dialogPosition: 'top' | 'bottom';
}

const SHOP_TUTORIAL_STEPS: ShopTutorialStep[] = [
  {
    id: 'welcome',
    title: '补给站到了！',
    dialogPosition: 'bottom',
    zhangshuText: '嘿，新兵！欢迎来到补给站。这里是你的物资采购中心。让我给你介绍一下各种道具的用途，买对了道具能让你在战场上轻松不少！',
  },
  {
    id: 'gas_refill',
    title: '气罐补给',
    consumableId: 'gas_refill',
    dialogPosition: 'bottom',
    zhangshuText: '这是「气罐补给」，回满你的燃气！火焰喷射器没有燃气就是废铁。每次用完记得补充，这是最基础的消耗品。',
  },
  {
    id: 'emergency_cool',
    title: '紧急冷却',
    consumableId: 'emergency_cool',
    dialogPosition: 'bottom',
    zhangshuText: '「紧急冷却」，瞬间清除过热状态！当你喷火过热熄火时，用这个立刻恢复，不用等自然冷却。关键时刻能救命！',
  },
  {
    id: 'power_boost',
    title: '火力全开',
    consumableId: 'power_boost',
    dialogPosition: 'bottom',
    zhangshuText: '「火力全开」，10秒内火焰伤害翻倍！对付大群蟑螂或者大蟑螂时特别有效。冷却时间较长，要把握好使用时机。',
  },
  {
    id: 'defense_repair',
    title: '防线修复',
    consumableId: 'defense_repair',
    dialogPosition: 'top',
    zhangshuText: '「防线修复」，回复防线血量！防线被蟑螂突破了？用这个修一修，让防线多扛一会儿。推荐随时备一两个。',
  },
  {
    id: 'shield',
    title: '临时护盾',
    consumableId: 'shield',
    dialogPosition: 'top',
    zhangshuText: '「临时护盾」，给角色套上护盾抵消伤害！被蟑螂包围了？开护盾硬扛一波。注意护盾持续时间短，别浪费。',
  },
  {
    id: 'bait',
    title: '蟑螂诱饵',
    consumableId: 'bait',
    dialogPosition: 'top',
    zhangshuText: '「蟑螂诱饵」，吸引范围内所有蟑螂走向放置点！可以把蟑螂聚在一起然后一把火烧掉。战略性道具，用得好能扭转战局。',
  },
  {
    id: 'owned_items',
    title: '已拥有道具',
    highlightOwned: true,
    dialogPosition: 'top',
    zhangshuText: '这是你已拥有的道具展示区。购买的道具会在这里显示数量。战斗中点击右侧道具栏就能使用。好了，去采购吧，新兵！',
  },
];

interface ShopTutorialOverlayProps {
  audio?: AudioManager;
  cardRefs?: React.RefObject<Record<string, HTMLDivElement | null>>;
  ownedRef?: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onComplete?: () => void;
  onSkip?: () => void;
}

export const ShopTutorialOverlay: React.FC<ShopTutorialOverlayProps> = ({
  audio, cardRefs, ownedRef, scrollContainerRef, onComplete, onSkip,
}) => {
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_KEY);
    } catch {
      return true;
    }
  });
  const [step, setStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const currentStep = SHOP_TUTORIAL_STEPS[step];

  // Auto-scroll to highlighted item
  useEffect(() => {
    if (!showTutorial || !currentStep) return;

    let targetEl: HTMLElement | null = null;
    if (currentStep.consumableId && cardRefs?.current) {
      targetEl = cardRefs.current[currentStep.consumableId];
    } else if (currentStep.highlightOwned && ownedRef?.current) {
      targetEl = ownedRef.current;
    }

    if (targetEl) {
      const timer = setTimeout(() => {
        // Step 1: Scroll first (instant, synchronous)
        const container = scrollContainerRef.current;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const elTopInContainer = targetEl!.getBoundingClientRect().top - containerRect.top + container.scrollTop;
          const elBottomInContainer = elTopInContainer + targetEl!.getBoundingClientRect().height;
          const containerHeight = container.clientHeight;

          if (currentStep.dialogPosition === 'bottom') {
            // Dialog at bottom: scroll item to upper area
            const targetScroll = elTopInContainer - containerHeight * 0.25;
            container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'instant' });
          } else {
            // Dialog at top: scroll item to lower area
            const targetScroll = elBottomInContainer - containerHeight * 0.75;
            container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'instant' });
          }
        }

        // Step 2: Get rect AFTER scrolling (ensures highlight matches actual visible position)
        const rect = targetEl!.getBoundingClientRect();
        setHighlightRect(rect);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setHighlightRect(null);
    }
  }, [showTutorial, step, currentStep, cardRefs, ownedRef]);

  const handleNext = useCallback(() => {
    audio?.playClick();
    if (step < SHOP_TUTORIAL_STEPS.length - 1) {
      setStep(prev => prev + 1);
    } else {
      localStorage.setItem(TUTORIAL_KEY, 'true');
      setShowTutorial(false);
      onComplete?.();
    }
  }, [step, audio, onComplete]);

  const handleSkip = useCallback(() => {
    audio?.playClick();
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setShowTutorial(false);
    onSkip?.();
  }, [audio, onSkip]);

  if (!showTutorial) return null;

  const isLast = step === SHOP_TUTORIAL_STEPS.length - 1;
  const padding = 8;
  const isDialogTop = currentStep.dialogPosition === 'top';

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* 4-piece mask spotlight */}
      {highlightRect && (
        <>
          <div className="absolute bg-black/75 pointer-events-auto transition-all duration-300" style={{ left: 0, top: 0, width: '100%', height: Math.max(0, highlightRect.top - padding) }} />
          <div className="absolute bg-black/75 pointer-events-auto transition-all duration-300" style={{ left: 0, top: highlightRect.bottom + padding, width: '100%', height: `calc(100% - ${highlightRect.bottom + padding}px)` }} />
          <div className="absolute bg-black/75 pointer-events-auto transition-all duration-300" style={{ left: 0, top: Math.max(0, highlightRect.top - padding), width: Math.max(0, highlightRect.left - padding), height: highlightRect.height + padding * 2 }} />
          <div className="absolute bg-black/75 pointer-events-auto transition-all duration-300" style={{ left: highlightRect.right + padding, top: Math.max(0, highlightRect.top - padding), width: `calc(100% - ${highlightRect.right + padding}px)`, height: highlightRect.height + padding * 2 }} />
          {/* Yellow glow border */}
          <div className="absolute pointer-events-none transition-all duration-300" style={{
            left: highlightRect.left - padding,
            top: highlightRect.top - padding,
            width: highlightRect.width + padding * 2,
            height: highlightRect.height + padding * 2,
            borderRadius: '12px',
            boxShadow: '0 0 20px 4px rgba(251,191,36,0.5), inset 0 0 0 2px rgba(251,191,36,0.6)',
          }} />
        </>
      )}
      {/* Full dark overlay for welcome/final steps */}
      {!highlightRect && <div className="absolute inset-0 bg-black/75 pointer-events-auto" />}

      {/* Zhangshu dialog - position based on step */}
      <div className={`absolute left-0 right-0 px-4 pointer-events-none ${
        isDialogTop ? 'top-4' : 'bottom-24'
      }`}>
        <div className="max-w-lg mx-auto pointer-events-auto">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 border-2 border-amber-400 flex items-center justify-center shrink-0 shadow-lg overflow-hidden">
              <img src="/assets/zhangshu-avatar.jpg" alt="樟叔" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="bg-amber-900/90 border border-amber-600/50 rounded-xl rounded-tl-sm px-4 py-3 shadow-xl">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart size={16} className="text-amber-400" />
                  <span className="text-amber-300 text-xs font-bold">{currentStep.title}</span>
                </div>
                <p className="text-stone-200 text-sm leading-relaxed">{currentStep.zhangshuText}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {SHOP_TUTORIAL_STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-yellow-400' : i < step ? 'w-1.5 bg-yellow-600' : 'w-1.5 bg-stone-600'}`} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 mt-3">
            <button onClick={handleSkip} className="flex items-center gap-1 text-stone-400 hover:text-stone-300 text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 pointer-events-auto">
              <SkipForward size={14} /> 跳过引导
            </button>
            <button onClick={handleNext} className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold px-6 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg pointer-events-auto">
              {isLast ? '去采购！' : '下一步'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const resetShopTutorial = () => {
  localStorage.removeItem(TUTORIAL_KEY);
};

export const hasSeenShopTutorial = (): boolean => {
  return !!localStorage.getItem(TUTORIAL_KEY);
};
