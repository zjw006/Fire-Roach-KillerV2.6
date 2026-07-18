import React, { useState, useCallback, useEffect } from 'react';
import { ArrowRight, SkipForward, Flame, Target, ShoppingCart, Package, Gauge, Fuel, Shield } from 'lucide-react';
import type { AudioManager } from '@/game/audio';

/**
 * @fileoverview 厨房首波战斗玩法引导覆盖层
 * 通过樟叔对话形式，分10步引导新玩家熟悉战斗界面核心区域。
 * 高亮定位采用混合策略：
 *   - Canvas 绘制区域（火焰控制区、战斗区域、防线）：使用百分比 × canvasBounds
 *   - HUD DOM 元素（血量条、热力条、燃气条、道具栏、武器栏）：使用 getBoundingClientRect() 精确定位
 * 引导状态通过 localStorage 持久化，首次进入厨房时自动展示。
 */

const TUTORIAL_KEY = 'gameplay_tutorial_seen';

interface TutorialStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  zhangshuText: string;
  /** Canvas 百分比高亮区域（0-1），用于画布绘制元素 */
  highlightArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** HUD DOM 元素 ref key，用于 getBoundingClientRect 精确定位 */
  highlightRef?: string;
  /** 高亮区域调整器（在 getBoundingClientRect 基础上进一步调整） */
  highlightAdjust?: (rect: { left: number; top: number; right: number; bottom: number; width: number; height: number }) => { left: number; top: number; right: number; bottom: number; width: number; height: number };
  dialogPosition?: 'top' | 'center-upper' | 'center' | 'bottom' | 'above-highlight' | 'above-highlight-bottom' | 'below-highlight';
}

/** 10步新手引导步骤定义 */
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '战斗准备！',
    icon: <Flame size={20} className="text-orange-400" />,
    zhangshuText: '新兵，欢迎来到厨房！这里是你的第一个战场。我来带你熟悉一下操作界面，听完讲解我们就要上战场了！',
    dialogPosition: 'bottom',
  },
  {
    id: 'flame_area',
    title: '火枪控制区',
    icon: <Flame size={20} className="text-orange-400" />,
    zhangshuText: '这是你的火焰喷射器控制区！按住屏幕左右平移来调整火焰方向。火焰是你的主要武器，记住控制好喷射角度！',
    highlightArea: { x: 0.00, y: 0.75, width: 1.00, height: 0.2 },
    dialogPosition: 'above-highlight-bottom',
  },
  {
    id: 'battle_area',
    title: '战斗区域',
    icon: <Target size={20} className="text-red-400" />,
    zhangshuText: '蟑螂会从这里向你冲来！看到远处的地面线了吗？蟑螂从那里生成，沿着路径前进。你的目标就是在它们到达防线前消灭它们！',
    highlightArea: { x: 0.00, y: 0.12, width: 1.00, height: 0.72 },
    dialogPosition: 'center',
  },
  {
    id: 'defense_line',
    title: '防线介绍',
    icon: <Shield size={20} className="text-red-500" />,
    zhangshuText: '注意看画面下方这条红线！这就是你的防线。蟑螂冲到这里就会开始啃食防线，防线被攻破你就输了！一定要在它们到达前用火焰消灭掉！',
    highlightArea: { x: 0.00, y: 0.82, width: 1.00, height: 0.07 },
    dialogPosition: 'above-highlight-bottom',
  },
  {
    id: 'defense_hp',
    title: '防线血条',
    icon: <Shield size={20} className="text-blue-400" />,
    zhangshuText: '顶部的蓝色条是防线血量！蟑螂攻击会扣血，血量降到0游戏就失败了！关卡中可以拾取修理包修复，也可以去补给站购买防线修复道具。保护好防线！',
    highlightRef: 'defenseBar',
    dialogPosition: 'below-highlight',
  },
  {
    id: 'heat_bar',
    title: '热力条',
    icon: <Gauge size={20} className="text-yellow-400" />,
    zhangshuText: '左边的热力条！持续喷火会积累热量，变红就是警告，满了就会过热熄火！松开手指让它冷却，或者使用紧急冷却道具。',
    highlightRef: 'heatBar',
    dialogPosition: 'below-highlight',
  },
  {
    id: 'gas_bar',
    title: '燃气条',
    icon: <Fuel size={20} className="text-amber-400" />,
    zhangshuText: '左上角的燃气条！喷火消耗燃气，燃气耗尽就无法喷火。记得去补给站买气罐，或者在战场上拾取燃气包！',
    highlightRef: 'gasBar',
    dialogPosition: 'below-highlight',
  },
  {
    id: 'shop_consumables',
    title: '拾取道具区',
    icon: <ShoppingCart size={20} className="text-cyan-400" />,
    zhangshuText: '右下角是你战场上拾取的道具！比如这个粘性陷阱，点击就能放置。战场上还会掉落燃气包等道具，记得捡！',
    highlightRef: 'inventoryItems',
    highlightAdjust: (rect) => {
      // 以右下角为基准，向上扩大4倍
      const newWidth = rect.width;
      const newHeight = rect.height * 4;
      return {
        left: rect.right - newWidth,
        top: rect.bottom - newHeight,
        right: rect.right,
        bottom: rect.bottom,
        width: newWidth,
        height: newHeight,
      };
    },
    dialogPosition: 'center-upper',
  },
  {
    id: 'shop_usage',
    title: '武器与道具栏',
    icon: <Package size={20} className="text-green-400" />,
    zhangshuText: '底部是你的武器和道具操作区！左边切换火焰模式，右边使用拾取道具。点击图标即可发动效果！',
    highlightRef: 'weaponSelector',
    highlightAdjust: (rect) => {
      // 以中心为基准，宽度扩大5倍
      const newWidth = rect.width * 5;
      const centerX = rect.left + rect.width / 2;
      return {
        left: centerX - newWidth / 2,
        top: rect.top,
        right: centerX + newWidth / 2,
        bottom: rect.bottom,
        width: newWidth,
        height: rect.height,
      };
    },
    dialogPosition: 'above-highlight-bottom',
  },
  {
    id: 'final',
    title: '上战场！',
    icon: <Flame size={20} className="text-orange-400" />,
    zhangshuText: '记住要点：控制火焰方向、注意过热、管理燃气、合理使用道具！好了，新兵，蟑螂要来了，准备好你的火焰喷射器，烧光它们！',
    dialogPosition: 'bottom',
  },
];

interface GameplayTutorialOverlayProps {
  audio?: AudioManager;
  onComplete?: () => void;
  onSkip?: () => void;
  /** 画布边界（用于画布绘制区域的高亮百分比计算） */
  canvasBounds?: { left: number; top: number; width: number; height: number } | null;
  /** HUD 元素 DOM 引用（用于 getBoundingClientRect 精确定位） */
  hudRefs?: React.MutableRefObject<Record<string, HTMLElement | null>>;
}

export const GameplayTutorialOverlay: React.FC<GameplayTutorialOverlayProps> = ({
  audio, onComplete, onSkip, canvasBounds, hudRefs,
}) => {
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_KEY);
    } catch {
      return true;
    }
  });
  const [step, setStep] = useState(0);
  /** 高亮区域（viewport 像素坐标），null 表示全屏遮罩 */
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const current = TUTORIAL_STEPS[step];

  /** 根据当前步骤计算高亮区域位置 */
  useEffect(() => {
    if (!showTutorial || !current) return;

    // 策略1：DOM ref 定位（HUD 元素）
    if (current.highlightRef && hudRefs?.current) {
      const el = hudRefs.current[current.highlightRef];
      if (el) {
        // 延迟一帧确保 DOM 已渲染
        const timer = setTimeout(() => {
          const rawRect = el.getBoundingClientRect();
          const adjusted = current.highlightAdjust ? current.highlightAdjust(rawRect) : rawRect;
          setHighlightRect(adjusted as DOMRect);
        }, 50);
        return () => clearTimeout(timer);
      }
    }

    // 策略2：百分比定位（Canvas 绘制区域）
    if (current.highlightArea && canvasBounds) {
      const area = current.highlightArea;
      const rect = {
        left: canvasBounds.left + area.x * canvasBounds.width,
        top: canvasBounds.top + area.y * canvasBounds.height,
        width: area.width * canvasBounds.width,
        height: area.height * canvasBounds.height,
        right: canvasBounds.left + (area.x + area.width) * canvasBounds.width,
        bottom: canvasBounds.top + (area.y + area.height) * canvasBounds.height,
        x: canvasBounds.left + area.x * canvasBounds.width,
        y: canvasBounds.top + area.y * canvasBounds.height,
        toJSON: () => '',
      } as DOMRect;
      setHighlightRect(rect);
      return;
    }

    // 无高亮：全屏遮罩
    setHighlightRect(null);
  }, [showTutorial, step, current, canvasBounds, hudRefs]);

  const handleNext = useCallback(() => {
    audio?.playClick();
    if (step < TUTORIAL_STEPS.length - 1) {
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

  const isLast = step === TUTORIAL_STEPS.length - 1;
  const padding = 12;

  /** 确定对话气泡垂直位置 */
  const getDialogPosition = (): string => {
    if (current.dialogPosition) return current.dialogPosition;
    if (current.highlightArea) {
      const centerY = current.highlightArea.y + current.highlightArea.height / 2;
      return centerY >= 0.5 ? 'top' : 'bottom';
    }
    return 'bottom';
  };
  const dialogPos = getDialogPosition();

  /** 对话气泡的 top 样式（用于动态定位） */
  const getDialogStyle = (): React.CSSProperties => {
    if (!highlightRect) {
      // 无高亮时：根据 dialogPosition 决定位置
      if (dialogPos === 'bottom') return { bottom: '1.5rem' };
      if (dialogPos === 'top') return { top: '1.5rem' };
      if (dialogPos === 'center') return { top: '50%', transform: 'translateY(-50%)' };
      if (dialogPos === 'center-upper') return { top: '35%' };
      return { bottom: '1.5rem' }; // 默认底部
    }

    if (dialogPos === 'above-highlight') {
      return { top: `${Math.max(0, highlightRect.top - padding - 20)}px` };
    }
    if (dialogPos === 'above-highlight-bottom') {
      return { top: `${Math.max(0, highlightRect.top - 20)}px`, transform: 'translateY(-100%)' };
    }
    if (dialogPos === 'below-highlight') {
      return { top: `${highlightRect.bottom + padding + 20}px` };
    }
    if (dialogPos === 'bottom') {
      return { bottom: '1.5rem' };
    }
    if (dialogPos === 'top') {
      return { top: '1.5rem' };
    }
    if (dialogPos === 'center') {
      return { top: '50%', transform: 'translateY(-50%)' };
    }
    if (dialogPos === 'center-upper') {
      return { top: '35%' };
    }
    return { bottom: '1.5rem' };
  };

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* 四片遮罩聚光灯 */}
      {highlightRect && (
        <>
          {/* Top */}
          <div
            className="absolute bg-black/75 pointer-events-auto"
            style={{ left: 0, top: 0, width: '100%', height: Math.max(0, highlightRect.top - padding) }}
          />
          {/* Bottom */}
          <div
            className="absolute bg-black/75 pointer-events-auto"
            style={{ left: 0, top: highlightRect.bottom + padding, width: '100%', height: `calc(100% - ${highlightRect.bottom + padding}px)` }}
          />
          {/* Left */}
          <div
            className="absolute bg-black/75 pointer-events-auto"
            style={{ left: 0, top: Math.max(0, highlightRect.top - padding), width: Math.max(0, highlightRect.left - padding), height: highlightRect.height + padding * 2 }}
          />
          {/* Right */}
          <div
            className="absolute bg-black/75 pointer-events-auto"
            style={{ left: highlightRect.right + padding, top: Math.max(0, highlightRect.top - padding), width: `calc(100% - ${highlightRect.right + padding}px)`, height: highlightRect.height + padding * 2 }}
          />
          {/* 黄色发光边框 */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: highlightRect.left - padding,
              top: highlightRect.top - padding,
              width: highlightRect.width + padding * 2,
              height: highlightRect.height + padding * 2,
              borderRadius: '12px',
              boxShadow: '0 0 24px 4px rgba(251,191,36,0.5), inset 0 0 0 2px rgba(251,191,36,0.6)',
            }}
          />
        </>
      )}

      {/* 无高亮时全屏遮罩 */}
      {!highlightRect && (
        <div className="absolute inset-0 bg-black/75 pointer-events-auto" />
      )}

      {/* 对话气泡 UI */}
      <div
        className="absolute left-0 right-0 px-4 pointer-events-none transition-all duration-300"
        style={getDialogStyle()}
      >
        <div className="max-w-lg mx-auto pointer-events-auto">
          {/* 樟叔对话 */}
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 border-2 border-amber-400 flex items-center justify-center shrink-0 shadow-lg overflow-hidden">
              <img src="/assets/zhangshu-avatar.jpg" alt="樟叔" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="bg-amber-900/90 border border-amber-600/50 rounded-xl rounded-tl-sm px-4 py-3 shadow-xl">
                <div className="flex items-center gap-2 mb-1">
                  {current.icon}
                  <span className="text-amber-300 text-xs font-bold">{current.title}</span>
                </div>
                <p className="text-stone-200 text-sm leading-relaxed">{current.zhangshuText}</p>
              </div>
            </div>
          </div>

          {/* 步骤指示点 */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {TUTORIAL_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-4 bg-yellow-400' :
                  i < step ? 'w-1.5 bg-yellow-600' :
                  'w-1.5 bg-stone-600'
                }`}
              />
            ))}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={handleSkip}
              className="flex items-center gap-1 text-stone-400 hover:text-stone-300 text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 pointer-events-auto"
            >
              <SkipForward size={14} />
              跳过引导
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold px-6 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg pointer-events-auto"
            >
              {isLast ? '开始战斗！' : '下一步'}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export helpers
export const resetGameplayTutorial = () => {
  localStorage.removeItem(TUTORIAL_KEY);
};

export const hasSeenGameplayTutorial = (): boolean => {
  return !!localStorage.getItem(TUTORIAL_KEY);
};