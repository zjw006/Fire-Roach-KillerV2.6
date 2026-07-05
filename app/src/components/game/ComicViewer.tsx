/**
 * @fileoverview 漫画查看器组件 — 以分镜形式展示剧情漫画，支持滑动手势和键盘导航切换页面。
 * 每页漫画加载后自动播放打字机效果的文字对话，点击可跳过打字或翻到下一页。
 * 最后一页显示"开始战斗"按钮，支持跳过功能。采用废土工业风格 UI。
 * 打开时暂停背景音乐，关闭时恢复。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SkipForward, ChevronLeft, ChevronRight, Swords } from 'lucide-react';
import type { ComicChapter } from '@/game/comicData';
import { markComicSeen } from '@/game/comicData';
import { AudioManager } from '@/game/audio';

interface ComicViewerProps {
  chapter: ComicChapter;
  onComplete: () => void;
  onSkip: () => void;
  audio?: AudioManager;
}

export const ComicViewer: React.FC<ComicViewerProps> = ({ chapter, onComplete, onSkip, audio }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev' | 'none'>('none');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const hasStartedTyping = useRef(false);

  const totalPanels = chapter.panels.length;
  const currentPanel = chapter.panels[currentIndex];
  const isLastPanel = currentIndex === totalPanels - 1;
  const progress = ((currentIndex + 1) / totalPanels) * 100;

  /** 打开漫画时暂停 BGM，关闭时恢复 */
  // Pause BGM when comic opens, resume on close
  useEffect(() => {
    audio?.pauseBGM();
    return () => {
      audio?.resumeBGM();
    };
  }, [audio]);

  // Stop typing
  const stopTyping = useCallback(() => {
    if (typingRef.current) {
      clearInterval(typingRef.current);
      typingRef.current = null;
    }
  }, []);

  /** 启动打字机效果：逐字显示对话文本，速度约 40ms/字 */
  // Start typing effect
  const startTyping = useCallback((text: string) => {
    stopTyping();
    setDisplayedText('');
    setIsTyping(true);
    hasStartedTyping.current = true;

    let charIndex = 0;
    const speed = 40; // ms per character

    typingRef.current = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        stopTyping();
      }
    }, speed);
  }, [stopTyping]);

  /** 切换分镜时：预加载图片 → 图片加载完成后启动打字机效果 */
  // When panel changes, start typing
  useEffect(() => {
    setImageLoaded(false);
    // Preload image
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      // Start typing after image is loaded
      startTyping(currentPanel.dialog);
    };
    img.onerror = () => {
      setImageLoaded(true);
      startTyping(currentPanel.dialog);
    };
    img.src = currentPanel.image;

    return () => {
      stopTyping();
    };
  }, [currentIndex, currentPanel.dialog, currentPanel.image, startTyping, stopTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  /** 翻到下一页：打字中则跳过打字，最后一页则完成漫画，否则带动画翻页 */
  const goNext = useCallback(() => {
    if (isTransitioning) return;

    // Play click/page flip sound
    audio?.playDialogSwitch();

    if (isTyping) {
      // 打字中：跳过打字，直接显示完整文本
      // Skip typing, show full text
      setDisplayedText(currentPanel.dialog);
      setIsTyping(false);
      stopTyping();
      return;
    }

    if (isLastPanel) {
      // 最后一页：标记已读并完成漫画
      // Complete
      markComicSeen(chapter.scene);
      setIsTransitioning(true);
      setTimeout(() => {
        onComplete();
      }, 300);
      return;
    }

    // 翻到下一页，带滑动动画
    setDirection('next');
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setDirection('none');
      setIsTransitioning(false);
    }, 300);
  }, [isTyping, isLastPanel, currentPanel.dialog, onComplete, chapter.scene, isTransitioning, stopTyping]);

  const goPrev = useCallback(() => {
    if (isTransitioning || currentIndex <= 0) return;

    stopTyping();
    setDirection('prev');
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => prev - 1);
      setDirection('none');
      setIsTransitioning(false);
    }, 300);
  }, [currentIndex, isTransitioning, stopTyping]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  /** 触摸滑动处理：左滑翻下一页，右滑翻上一页，阈值 60px */
  // Touch/swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0]?.clientX ?? 0;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 60) {
      if (diff > 0) {
        goNext();
      } else {
        goPrev();
      }
    }
  };

  const handleSkip = useCallback(() => {
    markComicSeen(chapter.scene);
    onSkip();
  }, [chapter.scene, onSkip]);

  /** 根据翻页方向返回对应的滑出动画类名 */
  // Slide animation classes
  const getSlideClass = () => {
    if (direction === 'next') return 'animate-slideOutLeft';
    if (direction === 'prev') return 'animate-slideOutRight';
    return '';
  };

  const getEnterClass = () => {
    if (direction === 'next') return 'animate-slideInRight';
    if (direction === 'prev') return 'animate-slideInLeft';
    return '';
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-50 flex flex-col bg-black select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar: Title + Skip */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white/80 tracking-wider">{chapter.title}</h2>
          <span className="text-[10px] text-stone-600">{currentIndex + 1}/{totalPanels}</span>
        </div>
        {/* Wasteland skip button — riveted metal plate */}
        <button
          onClick={() => { audio?.playClick(); handleSkip(); }}
          className="relative flex items-center gap-1.5 px-3 py-1.5 text-stone-400 hover:text-amber-200 transition-all"
          style={{
            background: 'linear-gradient(180deg, #2a2218 0%, #1a1410 100%)',
            border: '1px solid #3d3020',
            borderRadius: '4px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          {/* Rivet top-left */}
          <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px #1a1410' }} />
          {/* Rivet top-right */}
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px #1a1410' }} />
          {/* Rivet bottom-left */}
          <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px #1a1410' }} />
          {/* Rivet bottom-right */}
          <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px #1a1410' }} />
          <SkipForward size={13} />
          <span className="text-xs font-mono tracking-wider">跳过</span>
        </button>
      </div>

      {/* Progress bar — wasteland industrial gauge */}
      <div className="relative z-20 px-4 pb-2">
        <div className="relative h-2 flex items-center">
          {/* Left bolt */}
          <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full z-20" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }}>
            <div className="absolute inset-[2px] rounded-full bg-stone-900" />
          </div>
          {/* Right bolt */}
          <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full z-20" style={{ background: 'radial-gradient(circle at 30% 30%, #5a4d3a, #2a2218)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }}>
            <div className="absolute inset-[2px] rounded-full bg-stone-900" />
          </div>
          {/* Bar track */}
          <div className="flex-1 h-2 mx-1 rounded-sm overflow-hidden relative" style={{ background: 'linear-gradient(180deg, #1a1410 0%, #0d0a08 100%)', border: '1px solid #2a2218' }}>
            {/* Progress fill — ember glow */}
            <div className="h-full relative transition-all duration-500 ease-out" style={{ width: `${progress}%`, background: 'linear-gradient(180deg, #8B4513 0%, #CC5500 40%, #FF6B1A 60%, #8B2500 100%)', boxShadow: 'inset 0 1px 0 rgba(255,200,100,0.3)' }}>
              {progress > 0 && progress < 100 && (
                <div className="absolute right-0 top-0 bottom-0 w-[2px]" style={{ background: 'linear-gradient(180deg, rgba(255,200,100,0.8), rgba(255,100,30,1))', boxShadow: '0 0 4px 1px rgba(255,100,30,0.5)' }} />
              )}
            </div>
            {/* Grid marks */}
            <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(0,0,0,0.4) 24px, rgba(0,0,0,0.4) 25px)' }} />
          </div>
        </div>
      </div>

      {/* Comic image area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden px-4 pb-2">
        {/* Previous button (left) — rusted metal gear */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center text-stone-400 hover:text-amber-200 transition-all"
            style={{
              background: 'radial-gradient(circle, #2a2218 0%, #1a1410 70%)',
              border: '2px solid #3d3020',
              borderRadius: '50%',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 3px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.3)',
            }}
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Next button (right) — rusted metal gear */}
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-11 h-11 flex items-center justify-center text-stone-400 hover:text-amber-200 transition-all"
          style={{
            background: 'radial-gradient(circle, #2a2218 0%, #1a1410 70%)',
            border: '2px solid #3d3020',
            borderRadius: '50%',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 3px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.3)',
          }}
        >
          <ChevronRight size={22} />
        </button>

        {/* Image container */}
        <div
          className={`relative w-full h-full max-w-md mx-auto rounded-lg overflow-hidden ${getSlideClass()}`}
          onClick={() => { audio?.playClick(); goNext(); }}
        >
          {/* Loading placeholder — wasteland style */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #1a1410, #0d0a08)' }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-amber-700/40 border-t-amber-500 rounded-full animate-spin" />
                <span className="text-[11px] font-mono tracking-wider" style={{ color: 'rgba(201, 169, 110, 0.5)' }}>
                  同步数据中...
                </span>
              </div>
            </div>
          )}

          {/* Actual image */}
          <img
            key={currentIndex}
            src={currentPanel.image}
            alt={`漫画 ${currentIndex + 1}`}
            className={`w-full h-full object-contain transition-opacity duration-500 ${getEnterClass()} ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            draggable={false}
          />

          {/* Vignette overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            boxShadow: 'inset 0 0 80px 20px rgba(0,0,0,0.4)',
          }} />

          {/* Dialog text overlay — directly on the image bottom */}
          {imageLoaded && (
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10">
              <div className="bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-16 pb-5 px-5">
                <p
                  className="text-white text-[15px] leading-relaxed font-medium tracking-wide"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8), 0 0 1px rgba(0,0,0,1)' }}
                >
                  {displayedText}
                  {isTyping && (
                    <span className="inline-block w-0.5 h-4 bg-white/70 ml-1 animate-pulse align-middle" />
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Page rivets + hint/button */}
      <div className="relative z-20 px-4 py-3 flex items-center justify-between">
        {/* Rivet indicators instead of dots */}
        <div className="flex items-center gap-2">
          {chapter.panels.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (!isTransitioning && idx !== currentIndex) {
                  setDirection(idx > currentIndex ? 'next' : 'prev');
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setCurrentIndex(idx);
                    setDirection('none');
                    setIsTransitioning(false);
                  }, 300);
                }
              }}
              className="relative transition-all duration-300"
              style={{ width: idx === currentIndex ? 18 : 8, height: 8 }}
            >
              <div
                className="w-full h-full rounded-sm transition-all duration-300"
                style={{
                  background: idx === currentIndex
                    ? 'linear-gradient(180deg, #CC5500, #8B2500)'
                    : 'linear-gradient(180deg, #3d3020, #1a1410)',
                  border: idx === currentIndex ? '1px solid #FF6B1A' : '1px solid #2a2218',
                  boxShadow: idx === currentIndex
                    ? 'inset 0 1px 0 rgba(255,200,100,0.4), 0 0 6px rgba(255,100,30,0.3)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              />
            </button>
          ))}
        </div>

        {/* Hint or Start Battle button */}
        {isLastPanel && !isTyping ? (
          /* Wasteland heavy metal CTA button */
          <button
            onClick={(e) => { e.stopPropagation(); markComicSeen(chapter.scene); onComplete(); }}
            className="relative flex items-center gap-2 px-5 py-2.5 text-amber-100 text-sm font-bold tracking-wider transition-all hover:text-white active:scale-95"
            style={{
              background: 'linear-gradient(180deg, #8B2500 0%, #5a1800 40%, #3d1000 100%)',
              border: '2px solid #5a3a20',
              borderRadius: '3px',
              boxShadow: 'inset 0 1px 0 rgba(255,150,60,0.3), 0 3px 10px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.3)',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {/* Corner rivets */}
            <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #6b5b4a, #3d3020)', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }} />
            <Swords size={15} />
            <span className="font-mono">开始战斗</span>
          </button>
        ) : (
          <span className="text-[10px] font-mono tracking-wider" style={{ color: 'rgba(201, 169, 110, 0.4)' }}>
            {isTyping ? '[ 点击跳过 ]' : '[ 点击或滑动切换 ]'}
          </span>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(60px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-60px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-60px); opacity: 0; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(60px); opacity: 0; }
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out;
        }
        .animate-slideInLeft {
          animation: slideInLeft 0.3s ease-out;
        }
        .animate-slideOutLeft {
          animation: slideOutLeft 0.3s ease-in;
        }
        .animate-slideOutRight {
          animation: slideOutRight 0.3s ease-in;
        }
      `}</style>
    </div>
  );
};
