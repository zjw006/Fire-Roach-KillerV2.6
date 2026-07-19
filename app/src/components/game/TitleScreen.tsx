/**
 * @fileoverview 标题屏幕组件 — 游戏启动时的主菜单界面，包含废土风格的加载进度条和模拟加载提示。
 * 加载完成后显示"点击开始"闪烁提示，点击或按键后淡出并进入游戏。
 * 包含 CRT 扫描线效果、暗角叠加、废土工业风进度条及中英文标题。
 * 支持音频静音切换。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { TEXT_CONFIG } from '@/game/data';
import type { AudioManager } from '@/game/audio';


interface TitleScreenProps {
  onStart: () => void;
  audioMuted: boolean;
  onToggleMute: () => void;
  audio?: AudioManager;
}

// Wasteland-style loading hints
const LOADING_HINTS = TEXT_CONFIG.ui.title.loadingHints;

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  audioMuted,
  onToggleMute, audio}) => {
  const [bgLoaded, setBgLoaded] = useState(false);
  const [showPressHint, setShowPressHint] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  // Loading progress state
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadComplete, setLoadComplete] = useState(false);
  const [currentHint, setCurrentHint] = useState(LOADING_HINTS[0]);
  const progressRef = useRef(0);
  const rafRef = useRef<number>(0);

  /** 模拟加载进度条：使用 requestAnimationFrame 驱动非线性进度动画（快→慢→快），持续约 3.5s */
  // Simulate loading progress
  useEffect(() => {
    const startTime = Date.now();
    const duration = 3500; // 3.5 seconds total loading

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min(elapsed / duration, 1);

      // Non-linear progress: starts fast, slows in middle, speeds up at end
      let easedProgress: number;
      if (rawProgress < 0.3) {
        // Fast start
        easedProgress = rawProgress * 1.5;
      } else if (rawProgress < 0.7) {
        // Slow middle (stalls around 40-60%)
        easedProgress = 0.45 + (rawProgress - 0.3) * 0.5;
      } else {
        // Fast finish
        easedProgress = 0.65 + (rawProgress - 0.7) * 1.17;
      }

      const finalProgress = Math.min(Math.max(easedProgress, 0), 1);
      progressRef.current = finalProgress;
      setLoadProgress(finalProgress);

      // Update hint based on progress
      const newHintIdx = Math.min(
        Math.floor(finalProgress * LOADING_HINTS.length),
        LOADING_HINTS.length - 1
      );
      setCurrentHint(LOADING_HINTS[newHintIdx]);

      if (rawProgress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setLoadComplete(true);
        setLoadProgress(100);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /** 加载完成后使"点击开始"文字闪烁（800ms 间隔切换可见性） */
  // Show "press to start" after loading is done
  useEffect(() => {
    if (!loadComplete) return;
    const interval = setInterval(() => {
      setShowPressHint((prev) => !prev);
    }, 800);
    return () => clearInterval(interval);
  }, [loadComplete]);

  /** 预加载标题背景图片，加载完成后渐显 */
  // Background image loading
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.onerror = () => setBgLoaded(true);
    img.src = '/comics/loading_title.jpg';
  }, []);

  const handleClick = useCallback(() => {
    if (fadingOut || !loadComplete) return;
    setFadingOut(true);
    setTimeout(() => {
      onStart();
    }, 600);
  }, [fadingOut, loadComplete, onStart]);

  // Keyboard handler
  useEffect(() => {
    const handleKey = () => handleClick();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleClick]);

  const progressPercent = Math.floor(loadProgress * 100);

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-between overflow-hidden select-none transition-opacity duration-600 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${loadComplete ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={() => { audio?.playClick(); handleClick(); }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{
          backgroundImage: 'url(/comics/loading_title.jpg)',
          opacity: bgLoaded ? 1 : 0,
        }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 120px 40px rgba(0,0,0,0.6)' }}
      />

      {/* Scanlines overlay - CRT effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
        }}
      />

      {/* Top: Sound toggle */}
      <div className="relative z-10 w-full flex justify-end px-4 pt-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white/60 hover:text-white transition-all backdrop-blur-sm border border-white/10"
        >
          {audioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Center: Title */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-8">
        {/* Chinese title */}
        <h1
          className="text-5xl sm:text-6xl font-black mb-3"
          style={{
            color: '#f0e6d3',
            letterSpacing: '0.15em',
            textShadow:
              '0 0 20px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,1)',
          }}
        >
          {TEXT_CONFIG.ui.title.title}
        </h1>

        {/* English subtitle */}
        <h2
          className="text-xs sm:text-sm font-bold tracking-[0.4em] mb-6"
          style={{
            color: '#c9a96e',
            textShadow:
              '0 0 12px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8), 0 0 1px rgba(0,0,0,1)',
          }}
        >
          ROACH BLASTER
        </h2>

        {/* Decorative line */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px w-14 sm:w-16 bg-gradient-to-r from-transparent to-amber-600/60" />
          <div className="w-1.5 h-1.5 rotate-45 border border-amber-500/60" />
          <div className="h-px w-14 sm:w-16 bg-gradient-to-l from-transparent to-amber-600/60" />
        </div>

        {/* Lore quote */}
        <p
          className="text-xs text-center max-w-[260px] leading-relaxed"
          style={{
            color: 'rgba(201, 169, 110, 0.7)',
            textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,1)',
          }}
        >
          {TEXT_CONFIG.ui.title.lore}
        </p>
      </div>

      {/* Bottom: Loading bar + press to start */}
      <div className="relative z-10 w-full max-w-[340px] mx-auto px-4 pb-10 flex flex-col items-center gap-4">
        {/* === WASTELAND LOADING BAR === */}
        {!loadComplete && (
          <div className="w-full flex flex-col items-center gap-2">
            {/* Progress bar container - industrial metal style */}
            <div className="relative w-full h-5 flex items-center">
              {/* Left bolt */}
              <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 border border-gray-600 z-20 shadow-lg">
                <div className="absolute inset-[2px] rounded-full bg-gray-800" />
                <div className="absolute top-[1px] left-[4px] w-[3px] h-[1px] bg-gray-400 rotate-45" />
              </div>
              {/* Right bolt */}
              <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 border border-gray-600 z-20 shadow-lg">
                <div className="absolute inset-[2px] rounded-full bg-gray-800" />
                <div className="absolute top-[1px] left-[4px] w-[3px] h-[1px] bg-gray-400 rotate-45" />
              </div>

              {/* Bar background - rusted metal */}
              <div
                className="flex-1 h-4 mx-1 rounded-sm overflow-hidden relative"
                style={{
                  background:
                    'linear-gradient(180deg, #2a2218 0%, #1a1410 40%, #1a1410 60%, #2a2218 100%)',
                  border: '1px solid #3d3020',
                  boxShadow:
                    'inset 0 1px 2px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                {/* Rust texture overlay */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(90,60,30,0.3) 8px, rgba(90,60,30,0.3) 9px)',
                  }}
                />

                {/* Progress fill - fire gradient */}
                <div
                  className="h-full relative transition-all duration-100 ease-out"
                  style={{
                    width: `${progressPercent}%`,
                    background: `linear-gradient(180deg,
                      #8B4513 0%,
                      #D2691E 20%,
                      #FF6B1A 40%,
                      #CC3300 60%,
                      #8B2500 80%,
                      #4A1500 100%)`,
                    boxShadow:
                      'inset 0 1px 0 rgba(255,200,100,0.4), inset 0 -1px 0 rgba(0,0,0,0.5)',
                  }}
                >
                  {/* Flame shimmer effect */}
                  <div
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,160,60,0.5) 3px, rgba(255,160,60,0.5) 5px, transparent 5px, transparent 8px)',
                      animation: 'shimmer 0.5s linear infinite',
                    }}
                  />

                  {/* Leading edge glow */}
                  {progressPercent > 0 && progressPercent < 100 && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-[2px]"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(255,200,100,0.8), rgba(255,100,30,1), rgba(255,200,100,0.8))',
                        boxShadow:
                          '0 0 6px 2px rgba(255,100,30,0.6), 0 0 12px 4px rgba(255,60,0,0.3)',
                      }}
                    />
                  )}
                </div>

                {/* Grid lines overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(0,0,0,0.3) 24px, rgba(0,0,0,0.3) 25px)',
                  }}
                />
              </div>
            </div>

            {/* Percentage + hint text */}
            <div className="flex items-center justify-between w-full px-1">
              <span
                className="text-[11px] font-mono tracking-wider"
                style={{
                  color: 'rgba(201, 169, 110, 0.9)',
                  textShadow: '0 0 8px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)',
                  fontFamily: 'monospace',
                }}
              >
                {currentHint}
              </span>
              <span
                className="text-[11px] font-mono tabular-nums"
                style={{
                  color: 'rgba(255, 140, 60, 0.9)',
                  textShadow: '0 0 8px rgba(255,80,0,0.4), 0 1px 2px rgba(0,0,0,0.8)',
                  fontFamily: 'monospace',
                }}
              >
                {progressPercent}%
              </span>
            </div>
          </div>
        )}

        {/* === COMPLETE: Press to start === */}
        {loadComplete && (
          <div className="flex flex-col items-center gap-3">
            <div
              className={`transition-opacity duration-300 ${
                showPressHint ? 'opacity-100' : 'opacity-15'
              }`}
            >
              <span
                className="text-sm font-medium tracking-[0.25em]"
                style={{
                  color: 'rgba(240, 230, 211, 0.9)',
                  textShadow:
                    '0 0 12px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8), 0 0 1px rgba(0,0,0,1)',
                }}
              >
                {TEXT_CONFIG.ui.title.clickToStart}
              </span>
            </div>

            {/* Version */}
            <span
              className="text-[10px]"
              style={{
                color: 'rgba(201, 169, 110, 0.3)',
              }}
            >
              v1.0.0
            </span>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(0); }
          100% { transform: translateX(-8px); }
        }
      `}</style>

      {/* Loading placeholder */}
      {!bgLoaded && (
        <div className="absolute inset-0 bg-gray-950 flex items-center justify-center z-20">
          <div className="text-gray-600 text-sm font-mono">{TEXT_CONFIG.ui.title.initializing}</div>
        </div>
      )}
    </div>
  );
};
