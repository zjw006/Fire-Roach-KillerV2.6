import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, SkipForward, Flame, Target, ShoppingCart, Package, Gauge, Fuel, Shield } from 'lucide-react';
import type { AudioManager } from '@/game/audio';

/**
 * @fileoverview 厨房首波战斗玩法引导覆盖层
 * 通过樟叔对话形式，分10步引导新玩家熟悉战斗界面核心区域（火枪控制区、战斗区域、防线、
 * 血量条、热力条、燃气条、拾取道具区、武器道具栏），使用高亮聚光灯和百分比定位适配不同屏幕。
 * 引导状态通过 localStorage 持久化，首次进入厨房时自动展示。
 */

const TUTORIAL_KEY = 'gameplay_tutorial_seen';

interface TutorialStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  zhangshuText: string;
  /** 预定义的高亮区域（屏幕百分比，0-1） */
  highlightArea?: {
    x: number;      // left percentage
    y: number;      // top percentage
    width: number;  // width percentage
    height: number; // height percentage
  };
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
    highlightArea: { x: 0.080, y: 0.750, width: 0.841, height: 0.173 },
    dialogPosition: 'above-highlight-bottom',
  },
  {
    id: 'battle_area',
    title: '战斗区域',
    icon: <Target size={20} className="text-red-400" />,
    zhangshuText: '蟑螂会从这里向你冲来！看到远处的地面线了吗？蟑螂从那里生成，沿着路径前进。你的目标就是在它们到达防线前消灭它们！',
    highlightArea: { x: 0.050, y: 0.120, width: 0.900, height: 0.580 },
    dialogPosition: 'center',
  },
  {
    id: 'defense_line',
    title: '防线介绍',
    icon: <Shield size={20} className="text-red-500" />,
    zhangshuText: '注意看画面下方这条红线！这就是你的防线。蟑螂冲到这里就会开始啃食防线，防线被攻破你就输了！一定要在它们到达前用火焰消灭掉！',
    highlightArea: { x: 0.000, y: 0.751, width: 1.000, height: 0.068 },
    dialogPosition: 'above-highlight-bottom',
  },
  {
    id: 'defense_hp',
    title: '防线血条',
    icon: <Shield size={20} className="text-blue-400" />,
    zhangshuText: '顶部的蓝色条是防线血量！蟑螂攻击会扣血，血量降到0游戏就失败了！关卡中可以拾取修理包修复，也可以去补给站购买防线修复道具。保护好防线！',
    highlightArea: { x: 0.213, y: 0.091, width: 0.570, height: 0.058 },
    dialogPosition: 'below-highlight',
  },
  {
    id: 'heat_bar',
    title: '热力条',
    icon: <Gauge size={20} className="text-yellow-400" />,
    zhangshuText: '左边的热力条！持续喷火会积累热量，变红就是警告，满了就会过热熄火！松开手指让它冷却，或者使用紧急冷却道具。',
    highlightArea: { x: 0.017, y: 0.338, width: 0.081, height: 0.247 },
    dialogPosition: 'below-highlight',
  },
  {
    id: 'gas_bar',
    title: '燃气条',
    icon: <Fuel size={20} className="text-amber-400" />,
    zhangshuText: '左上角的燃气条！喷火消耗燃气，燃气耗尽就无法喷火。记得去补给站买气罐，或者在战场上拾取燃气包！',
    highlightArea: { x: 0.046, y: 0.023, width: 0.283, height: 0.065 },
    dialogPosition: 'below-highlight',
  },
  {
    id: 'shop_consumables',
    title: '拾取道具区',
    icon: <ShoppingCart size={20} className="text-cyan-400" />,
    zhangshuText: '右下角是你战场上拾取的道具！比如这个粘性陷阱，点击就能放置。战场上还会掉落燃气包等道具，记得捡！',
    highlightArea: { x: 0.861, y: 0.588, width: 0.139, height: 0.238 },
    dialogPosition: 'center-upper',
  },
  {
    id: 'shop_usage',
    title: '武器与道具栏',
    icon: <Package size={20} className="text-green-400" />,
    zhangshuText: '底部是你的武器和道具操作区！左边切换火焰模式，右边使用拾取道具。点击图标即可发动效果！',
    highlightArea: { x: 0.000, y: 0.829, width: 1.000, height: 0.083 },
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
}

export const GameplayTutorialOverlay: React.FC<GameplayTutorialOverlayProps> = ({ audio, onComplete, onSkip }) => {
  /** 检查 localStorage 判断是否需要展示引导 */
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_KEY);
    } catch {
      return true;
    }
  });
  /** 当前步骤索引 */
  const [step, setStep] = useState(0);
  /** 窗口尺寸，用于响应式高亮定位 */
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  /** 监听窗口尺寸变化 */
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /** 下一步：前进到下一步或完成引导 */
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

  /** 跳过引导，标记已查看 */
  const handleSkip = useCallback(() => {
    audio?.playClick();
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setShowTutorial(false);
    onSkip?.();
  }, [audio, onSkip]);

  if (!showTutorial) return null;

  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;
  const highlight = current.highlightArea;

  /** 将百分比高亮区域转换为像素坐标 */
  const getPixelRect = () => {
    if (!highlight) return null;
    return {
      left: highlight.x * windowSize.width,
      top: highlight.y * windowSize.height,
      width: highlight.width * windowSize.width,
      height: highlight.height * windowSize.height,
    };
  };

  const pixelRect = getPixelRect();
  const padding = 12;

  /** 确定对话气泡垂直位置：手动配置优先，否则根据高亮中心自动判断 */
  const getDialogPosition = (): string => {
    // If step has explicit dialogPosition, use it
    if (current.dialogPosition) {
      return current.dialogPosition;
    }
    // Otherwise auto-detect based on highlight center
    if (highlight) {
      const centerY = highlight.y + highlight.height / 2;
      return centerY >= 0.5 ? 'top' : 'bottom';
    }
    return 'bottom';
  };
  const dialogPos = getDialogPosition();

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* 4-piece mask spotlight */}
      {/** 四片遮罩实现聚光灯效果：上、下、左、右四块暗色遮罩围出高亮区域 */}
      {pixelRect && (
        <>
          {/* Top */}
          <div
            className="absolute bg-black/75 pointer-events-auto"
            style={{ left: 0, top: 0, width: '100%', height: Math.max(0, pixelRect.top - padding) }}
          />
          {/* Bottom */}
          <div
            className="absolute bg-black/75 pointer-events-auto"
            style={{ left: 0, top: pixelRect.top + pixelRect.height + padding, width: '100%', height: `calc(100% - ${pixelRect.top + pixelRect.height + padding}px)` }}
          />
          {/* Left */}
          <div
            className="absolute bg-black/75 pointer-events-auto"
            style={{ left: 0, top: Math.max(0, pixelRect.top - padding), width: Math.max(0, pixelRect.left - padding), height: pixelRect.height + padding * 2 }}
          />
          {/* Right */}
          <div
            className="absolute bg-black/75 pointer-events-auto"
            style={{ left: pixelRect.left + pixelRect.width + padding, top: Math.max(0, pixelRect.top - padding), width: `calc(100% - ${pixelRect.left + pixelRect.width + padding}px)`, height: pixelRect.height + padding * 2 }}
          />
          {/* Yellow glow border */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: pixelRect.left - padding,
              top: pixelRect.top - padding,
              width: pixelRect.width + padding * 2,
              height: pixelRect.height + padding * 2,
              borderRadius: '12px',
              boxShadow: '0 0 24px 4px rgba(251,191,36,0.5), inset 0 0 0 2px rgba(251,191,36,0.6)',
            }}
          />
        </>
      )}

      {/* Full dark overlay when no highlight */}
      {/** 无高亮区域时显示全屏暗色遮罩 */}
      {!pixelRect && (
        <div className="absolute inset-0 bg-black/75 pointer-events-auto" />
      )}

      {/* UI container: dialog + progress dots + buttons, positioned based on config */}
      {/** 引导 UI：樟叔对话气泡 + 步骤指示点 + 操作按钮，位置根据配置动态计算 */}
      <div className="absolute left-0 right-0 px-4 pointer-events-none transition-all duration-300"
        style={{
          ...(dialogPos === 'above-highlight' && pixelRect
            ? { top: `${((pixelRect.top - padding - 20) / windowSize.height) * 100}%` }
            : dialogPos === 'above-highlight-bottom' && pixelRect
            ? { top: `${((pixelRect.top - 20) / windowSize.height) * 100}%`, transform: 'translateY(-100%)' }
            : dialogPos === 'below-highlight' && pixelRect
            ? { top: `${((pixelRect.top + pixelRect.height + padding + 20) / windowSize.height) * 100}%` }
            : dialogPos === 'bottom' ? { bottom: '16px', top: 'auto' }
            : dialogPos === 'center' ? { top: '34%' }
            : dialogPos === 'center-upper' ? { top: '20%' }
            : { top: '16px' }),
        }}>
        <div className="max-w-lg mx-auto pointer-events-auto">
          {/* Zhangshu dialog */}
          <div className="flex items-start gap-3">
            {/* Zhangshu avatar */}
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

          {/* Step dots */}
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

          {/* Action buttons */}
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
