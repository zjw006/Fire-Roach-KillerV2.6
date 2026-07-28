/**
 * @fileoverview 倒计时遮罩组件 — 仅第一波战斗开始前显示 3-2-1-GO! 倒计时动画。
 * 通过 phase 和 timer 驱动显示内容，带有缩放动画和发光文字效果。
 * 倒计时结束时显示绿色的 "GO!" 和"战斗开始！"提示。
 */

import React, { useState, useEffect } from 'react';
import { TEXT_CONFIG } from '@/game/data';

interface CountdownOverlayProps {
  phase: number;     // current displayed number (3, 2, 1)
  timer: number;     // remaining time in seconds
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ phase, timer }) => {
  const [displayNum, setDisplayNum] = useState(phase);
  const [animating, setAnimating] = useState(false);

  /** 当 phase 变化时触发缩放动画，500ms 后恢复 */
  // Trigger animation when phase changes
  useEffect(() => {
    if (phase !== displayNum) {
      setAnimating(true);
      setDisplayNum(phase);
      const t = setTimeout(() => setAnimating(false), 500);
      return () => clearTimeout(t);
    }
  }, [phase, displayNum]);

  /** 倒计时即将结束时（timer ≤ 0.2s）显示绿色的 "GO!" */
  // Show "GO!" when timer is nearly finished
  const showGo = timer <= 0.2 && timer > 0;
  const number = showGo ? 'GO!' : String(displayNum);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none select-none"
      style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        className={`text-white font-black transition-all duration-300 ${
          animating ? 'scale-150 opacity-100' : 'scale-100 opacity-90'
        }`}
        style={{
          fontSize: showGo ? '140px' : '180px',
          textShadow: '0 0 40px rgba(251,191,36,0.8), 0 0 80px rgba(251,191,36,0.4), 0 4px 12px rgba(0,0,0,0.8)',
          color: showGo ? '#4ade80' : '#fbbf24',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          letterSpacing: '4px',
        }}
      >
        {number}
      </div>
      {/* 底部提示文字：GO! 时显示"战斗开始！"，否则显示"准备战斗" */}
      {/* Subtle instruction text below the number */}
      <div
        className="absolute bottom-1/3 left-0 right-0 text-center text-stone-300 text-sm tracking-widest"
        style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
      >
        {showGo ? TEXT_CONFIG.ui.countdown.battleStart : TEXT_CONFIG.ui.countdown.prepare}
      </div>
    </div>
  );
};
