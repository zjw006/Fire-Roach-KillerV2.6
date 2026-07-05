/**
 * @fileoverview 暂停菜单覆盖层组件
 * 在游戏战斗过程中弹出，提供"继续游戏"、"重新开始"和"返回主菜单"三个操作选项，
 * 采用暗色调半透明背景和火焰主题装饰，与标题画面风格保持一致。
 */

import React from 'react';
import { Play, RotateCcw, Home, Flame } from 'lucide-react';
import type { AudioManager } from '@/game/audio';


interface PauseScreenProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  audio?: AudioManager;
}

export const PauseScreen: React.FC<PauseScreenProps> = ({ onResume, onRestart, onQuit, audio}) => {
  /** 暂停菜单：继续游戏、重新开始、返回主菜单三个操作 */
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative max-w-sm w-full mx-4">
        {/* Main card - dark with brown border like title screen */}
        <div className="relative bg-stone-900/90 rounded-2xl p-6 text-center border-2 border-amber-900/60"
          style={{ boxShadow: '0 0 40px rgba(139,69,19,0.3), inset 0 0 20px rgba(0,0,0,0.5)' }}>

          {/* Title with flame decorations */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <Flame size={22} className="text-orange-500" />
            <h2 className="text-3xl font-black text-amber-300 tracking-wider"
              style={{ textShadow: '0 2px 8px rgba(139,69,19,0.5), 0 0 20px rgba(245,158,11,0.3)' }}>
              游戏暂停
            </h2>
            <Flame size={22} className="text-orange-500" />
          </div>

          {/* Divider */}
          <div className="w-32 h-0.5 mx-auto mb-6 bg-amber-800/40" />

          {/* Menu buttons - styled like title screen mode cards */}
          <div className="space-y-3">
            {/* Resume */}
            <button onClick={() => { audio?.playClick(); onResume(); }}
              className="w-full flex items-center gap-3 bg-stone-800/80 border border-amber-800/40 rounded-xl p-3 transition-all hover:scale-[1.02] hover:border-amber-600/60 active:scale-95">
              <div className="w-12 h-12 rounded-lg bg-amber-900/40 flex items-center justify-center border border-amber-700/30">
                <Play size={24} className="text-amber-300 ml-0.5" />
              </div>
              <div className="text-left">
                <div className="text-amber-200 font-bold text-base">继续游戏</div>
                <div className="text-amber-700 text-xs">返回战斗</div>
              </div>
            </button>

            {/* Restart */}
            <button onClick={() => { audio?.playClick(); onRestart(); }}
              className="w-full flex items-center gap-3 bg-stone-800/80 border border-amber-800/40 rounded-xl p-3 transition-all hover:scale-[1.02] hover:border-amber-600/60 active:scale-95">
              <div className="w-12 h-12 rounded-lg bg-orange-900/40 flex items-center justify-center border border-orange-700/30">
                <RotateCcw size={24} className="text-orange-300" />
              </div>
              <div className="text-left">
                <div className="text-orange-200 font-bold text-base">重新开始</div>
                <div className="text-orange-700 text-xs">重新挑战本关</div>
              </div>
            </button>

            {/* Quit */}
            <button onClick={() => { audio?.playClick(); onQuit(); }}
              className="w-full flex items-center gap-3 bg-stone-800/80 border border-stone-700/40 rounded-xl p-3 transition-all hover:scale-[1.02] hover:border-stone-500/60 active:scale-95">
              <div className="w-12 h-12 rounded-lg bg-stone-700/40 flex items-center justify-center border border-stone-600/30">
                <Home size={24} className="text-stone-400" />
              </div>
              <div className="text-left">
                <div className="text-stone-300 font-bold text-base">返回主菜单</div>
                <div className="text-stone-600 text-xs">保存进度并退出</div>
              </div>
            </button>
          </div>

          {/* Bottom tagline */}
          <p className="mt-5 text-xs tracking-widest text-amber-900/60">
            烈焰除蟑 · 火线守卫
          </p>
        </div>
      </div>
    </div>
  );
};
