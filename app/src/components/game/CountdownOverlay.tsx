import React, { useState, useEffect } from 'react';

interface CountdownOverlayProps {
  phase: number;     // current displayed number (3, 2, 1)
  timer: number;     // remaining time in seconds
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ phase, timer }) => {
  const [displayNum, setDisplayNum] = useState(phase);
  const [animating, setAnimating] = useState(false);

  // Trigger animation when phase changes
  useEffect(() => {
    if (phase !== displayNum) {
      setAnimating(true);
      setDisplayNum(phase);
      const t = setTimeout(() => setAnimating(false), 500);
      return () => clearTimeout(t);
    }
  }, [phase, displayNum]);

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
      {/* Subtle instruction text below the number */}
      <div
        className="absolute bottom-1/3 left-0 right-0 text-center text-stone-300 text-sm tracking-widest"
        style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
      >
        {showGo ? '战斗开始！' : '准备战斗'}
      </div>
    </div>
  );
};
