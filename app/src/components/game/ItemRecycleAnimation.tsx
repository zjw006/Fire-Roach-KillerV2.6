/**
 * @fileoverview 未使用道具回收金币动画组件 — 在结算界面将背包中未消耗的道具飞向目标位置并显示回收金币数。
 * 道具从各自起始位置依次飞向"最终资金"区域，伴随发光效果和粒子特效，
 * 最后显示总回收金额。动画分为"飞行中"和"已落地"两个阶段。
 */

import React, { useEffect, useState, useRef } from 'react';
import { INVENTORY_SELL_PRICES, WEAPON_DROP_DEFS, TEXT_CONFIG } from '@/game/data';

/** 单个回收道具的飞行参数 */
interface RecycleItem {
  type: string;
  count: number;
  price: number;
  startX: number;
  startY: number;
}

interface ItemRecycleAnimationProps {
  inventory: { type: string; count: number }[];
  onComplete?: () => void;
}

// Target position: the "最终资金" gold amount in settlement screen
// From screenshots: top-right area of settlement stats row
const TARGET_X_PCT = 82;  // right side of screen (最终资金 position)
const TARGET_Y_PCT = 40;  // upper-mid area of screen

export const ItemRecycleAnimation: React.FC<ItemRecycleAnimationProps> = ({ inventory, onComplete }) => {
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [totalGold, setTotalGold] = useState(0);
  const [phase, setPhase] = useState<'flying' | 'landed'>('flying');
  const containerRef = useRef<HTMLDivElement>(null);

  /** 初始化回收道具列表：筛选有售价且数量大于 0 的道具，计算飞行起始位置 */
  useEffect(() => {
    const recycled = inventory
      .filter(item => (INVENTORY_SELL_PRICES[item.type] || 0) > 0 && item.count > 0)
      .map((item, i) => ({
        type: item.type,
        count: item.count,
        price: (INVENTORY_SELL_PRICES[item.type] || 0) * item.count,
        startX: 75 + (i % 3) * 8,  // staggered starting positions (right side)
        startY: 78 + Math.floor(i / 3) * 10,
      }));

    const total = recycled.reduce((s, it) => s + it.price, 0);
    setItems(recycled);
    setTotalGold(total);

    // 动画阶段切换：1.4s 后从飞行切换到落地，1.8s 后触发 onComplete
    // Phase transition: flying → landed
    const t = setTimeout(() => setPhase('landed'), 1400);
    // Call onComplete after full animation
    const t2 = setTimeout(() => onComplete?.(), 1800);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [inventory, onComplete]);

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[500] pointer-events-none select-none">
      {/* Target glow area — where gold lands (最终资金 UI position) */}
      <div
        className="absolute"
        style={{
          left: `${TARGET_X_PCT}%`,
          top: `${TARGET_Y_PCT}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Pulsing gold glow ring */}
        <div
          className="absolute -inset-6 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)',
            animation: 'recycleTargetGlow 0.8s ease-out infinite alternate',
          }}
        />
        {/* Gold coin icon at landing spot */}
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #fbbf24, #d97706)',
            boxShadow: '0 0 20px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.4)',
            opacity: phase === 'landed' ? 1 : 0,
            transform: phase === 'landed' ? 'scale(1)' : 'scale(0)',
            transition: 'all 0.3s ease-out',
          }}
        >
          <span className="text-lg font-black text-white drop-shadow">¥</span>
        </div>
        {/* Landing sparkles */}
        {phase === 'landed' && (
          <>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-yellow-300"
                style={{
                  left: '50%',
                  top: '50%',
                  animation: `recycleSparkle 0.6s ease-out ${i * 0.05}s forwards`,
                  '--angle': `${i * 60}deg`,
                } as React.CSSProperties}
              />
            ))}
          </>
        )}
      </div>

      {/* Flying items — each travels from start position to target */}
      {items.map((item, i) => {
        const def = WEAPON_DROP_DEFS[item.type as keyof typeof WEAPON_DROP_DEFS];
        const name = def?.name || item.type;
        const dx = TARGET_X_PCT - item.startX;
        const dy = TARGET_Y_PCT - item.startY;

        return (
          <div
            key={item.type}
            className="absolute flex flex-col items-center"
            style={{
              left: `${item.startX}%`,
              top: `${item.startY}%`,
              animation: `recycleFlyToGold 1.4s ease-in-out ${i * 0.12}s forwards`,
              ['--dx' as string]: `${dx}vw`,
              ['--dy' as string]: `${dy}vh`,
            }}
          >
            {/* Item icon */}
            <div
              className="w-10 h-10 rounded-lg border-2 flex items-center justify-center shadow-lg"
              style={{
                borderColor: '#fbbf24',
                background: `linear-gradient(135deg, ${def?.color || '#fbbf24'}cc, #fbbf2488)`,
                boxShadow: '0 0 15px rgba(251,191,36,0.5)',
              }}
            >
              <span className="text-xs font-bold text-white drop-shadow-md">{item.count}</span>
            </div>
            <span className="text-[9px] text-yellow-300 mt-0.5 font-bold whitespace-nowrap"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              {name}
            </span>
            {/* Price tag */}
            <span className="text-[10px] text-amber-300 font-black"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              ¥{item.price}
            </span>
          </div>
        );
      })}

      {/* Total gold amount — appears after landing */}
      <div
        className="absolute text-center transition-all duration-500"
        style={{
          left: `${TARGET_X_PCT}%`,
          top: `${TARGET_Y_PCT + 8}%`,
          transform: 'translateX(-50%)',
          opacity: phase === 'landed' ? 1 : 0,
        }}
      >
        <div className="text-2xl font-black text-yellow-300 drop-shadow-lg"
          style={{ textShadow: '0 0 20px rgba(251,191,36,0.8)' }}>
          +¥{totalGold}
        </div>
        <div className="text-xs text-amber-200/70">道具回收</div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes recycleFlyToGold {
          0% {
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
          30% {
            transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) scale(1.1) rotate(10deg);
            opacity: 1;
          }
          70% {
            transform: translate(calc(var(--dx) * 0.85), calc(var(--dy) * 0.85)) scale(0.7) rotate(-5deg);
            opacity: 0.8;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0.2) rotate(0deg);
            opacity: 0;
          }
        }
        @keyframes recycleTargetGlow {
          0% { transform: scale(0.8); opacity: 0.4; }
          100% { transform: scale(1.3); opacity: 0.8; }
        }
        @keyframes recycleSparkle {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(
              calc(-50% + cos(var(--angle)) * 30px),
              calc(-50% + sin(var(--angle)) * 30px)
            ) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
