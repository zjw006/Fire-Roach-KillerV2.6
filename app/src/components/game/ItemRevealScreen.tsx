import React, { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, Star, Zap } from 'lucide-react';
import { AudioManager } from '@/game/audio';

interface ItemRevealScreenProps {
  item: { type: string; name: string; icon: string; desc: string } | null | undefined;
  onComplete: () => void;
  audio?: AudioManager;
}

export const ItemRevealScreen: React.FC<ItemRevealScreenProps> = ({ item, onComplete, audio }) => {
  const [show, setShow] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [textRevealed, setTextRevealed] = useState(false);
  const [particles, setParticles] = useState<Array<{
    id: number; x: number; y: number; size: number;
    speed: number; delay: number; type: 'sparkle' | 'star' | 'zap';
  }>>([]);

  useEffect(() => {
    if (item) {
      audio?.playItemDropFanfare();
      setTimeout(() => setShow(true), 100);
      setTimeout(() => setAnimate(true), 300);
      setTimeout(() => setTextRevealed(true), 900);
      const sparkles = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        x: 10 + Math.random() * 80,
        y: 5 + Math.random() * 90,
        size: 3 + Math.random() * 5,
        speed: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 2,
        type: (['sparkle', 'star', 'zap'] as const)[Math.floor(Math.random() * 3)],
      }));
      setParticles(sparkles);
    }
  }, [item, audio]);

  const handleClick = useCallback(() => {
    if (!show || !textRevealed) return;
    audio?.playDialogSwitch();
    setShow(false);
    setAnimate(false);
    setTimeout(() => {
      onComplete();
    }, 400);
  }, [show, textRevealed, onComplete, audio]);

  if (!item) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center cursor-pointer select-none transition-all duration-700 ${show ? 'bg-black/80 backdrop-blur-md' : 'bg-black/0'}`}
      onClick={() => { audio?.playClick(); handleClick(); }}
    >
      {/* Animated particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animation: `sparkleFloat ${p.speed}s ease-in-out ${p.delay}s infinite alternate`,
            opacity: show ? (p.type === 'sparkle' ? 0.7 : 0.5) : 0,
            transition: 'opacity 1s',
          }}
        >
          {p.type === 'sparkle' && <Sparkles size={p.size} className="text-yellow-400" />}
          {p.type === 'star' && <Star size={p.size} className="text-amber-300" />}
          {p.type === 'zap' && <Zap size={p.size} className="text-orange-400" />}
        </div>
      ))}

      {/* Main reveal card */}
      <div
        className={`relative flex flex-col items-center text-center max-w-[400px] w-[88%] mx-4 transition-all duration-800 ease-out ${
          animate ? 'scale-100 opacity-100 translate-y-0' : 'scale-40 opacity-0 translate-y-16'
        }`}
      >
        {/* Animated glow background */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-600/30 via-amber-900/60 to-stone-950/90 border-2 border-amber-400/40 shadow-[0_0_60px_rgba(245,158,11,0.4)]" 
          style={{ animation: 'glowPulse 3s ease-in-out infinite' }} />

        {/* Top banner */}
        <div className="relative z-10 -mt-4 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 text-white px-7 py-2 rounded-full text-sm font-black shadow-lg tracking-wider"
          style={{ animation: animate ? 'bannerBounce 0.6s ease-out' : 'none' }}>
          <Star size={14} className="inline-block mr-1 -mt-0.5" />
          战斗胜利！解锁新道具
          <Star size={14} className="inline-block ml-1 -mt-0.5" />
        </div>

        {/* Item icon with dramatic entrance */}
        <div className="relative z-10 mt-6 mb-4">
          {/* Outer rotating ring */}
          <div className={`w-32 h-32 rounded-full border-2 border-dashed border-amber-400/40 absolute -inset-2 transition-all duration-1000 ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
            style={{ animation: 'spinSlow 8s linear infinite' }} />
          {/* Icon container */}
          <div className={`w-28 h-28 rounded-2xl flex items-center justify-center bg-gradient-to-br from-amber-600/60 to-stone-800/80 border-2 border-amber-400/50 shadow-inner transition-all duration-700 delay-200 ${animate ? 'scale-100' : 'scale-0'}`}
            style={{ boxShadow: '0 0 30px rgba(245,158,11,0.3), inset 0 0 20px rgba(251,191,36,0.1)' }}>
            <img
              src={item.icon}
              alt={item.name}
              className="w-22 h-22 object-contain drop-shadow-xl"
              style={{ width: '80px', height: '80px' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/item_sticky.png';
              }}
            />
          </div>
          {/* Pulsing glow */}
          <div className={`absolute inset-0 rounded-2xl border-2 border-yellow-300/50 transition-all duration-1000 ${animate ? 'opacity-100 scale-110' : 'opacity-0 scale-90'}`}
            style={{ animation: 'pingSlow 2s ease-in-out infinite' }} />
        </div>

        {/* Item name */}
        <h2 className={`relative z-10 text-3xl font-black text-amber-300 mb-1 transition-all duration-600 delay-300 ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ textShadow: '0 0 20px rgba(251,191,36,0.5), 0 2px 4px rgba(0,0,0,0.8)' }}>
          {item.name}
        </h2>

        {/* Decorative divider */}
        <div className={`relative z-10 w-32 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent my-3 transition-all duration-500 delay-500 ${animate ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />

        {/* Zhang Shu's description */}
        <div className={`relative z-10 bg-black/40 rounded-xl px-5 py-4 mx-4 mb-2 transition-all duration-700 delay-700 ${textRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {/* Speaker label */}
          <div className="flex items-center gap-2 mb-2">
            <img src="/assets/avatar_zhangshu.png" alt="蟑叔" className="w-8 h-8 rounded-full border border-amber-500/50 object-cover" />
            <span className="text-amber-400 text-xs font-bold">蟑叔说：</span>
          </div>
          <p className="text-amber-100 text-sm leading-relaxed text-left" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
            {item.desc}
          </p>
        </div>

        {/* Hint to close */}
        <div className={`relative z-10 flex items-center gap-2 text-stone-400 text-xs mt-3 mb-4 transition-all duration-500 delay-1000 ${textRevealed ? 'opacity-100' : 'opacity-0'}`}
          style={{ animation: textRevealed ? 'pulseHint 2s ease-in-out infinite' : 'none' }}>
          <X size={13} />
          <span>点击任意处关闭</span>
          <X size={13} />
        </div>
      </div>

      <style>{`
        @keyframes sparkleFloat {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 0.3; }
          100% { transform: translateY(-25px) scale(1.4) rotate(15deg); opacity: 0.8; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 40px rgba(245,158,11,0.3); }
          50% { box-shadow: 0 0 70px rgba(245,158,11,0.5); }
        }
        @keyframes bannerBounce {
          0% { transform: translateY(-20px) scale(0.8); opacity: 0; }
          60% { transform: translateY(4px) scale(1.05); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pingSlow {
          0%, 100% { opacity: 0.4; transform: scale(1.1); }
          50% { opacity: 0.7; transform: scale(1.25); }
        }
        @keyframes pulseHint {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
