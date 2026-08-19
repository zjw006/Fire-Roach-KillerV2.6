/**
 * @fileoverview 战前道具选择界面 — 玩家在每波战斗前从可用道具中选择最多 3 种携带上阵。
 * 道具按类别（控制/范围/爆发）分组展示，带图标和描述，选中后高亮并显示勾选标记。
 * 底部显示已选道具列表和确认/返回按钮，未选择道具时"开始战斗"按钮禁用。
 */

import React, { useState } from 'react';
import { Check, ArrowRight, Bug, Wind, Flame, Droplets, Target, Zap, ScanLine, Sword } from 'lucide-react';
import type { AudioManager } from '@/game/audio';
import { TEXT_CONFIG } from '@/game/data';


interface PreparationScreenProps {
  scene: string;
  difficulty: 'easy' | 'hard';
  availableItems: string[];
  onStart: (selectedItems: string[]) => void;
  onBack: () => void;
  audio?: AudioManager;
}

const ALL_ITEMS = [
  { id: 'sticky', name: '蟑螂贴板', desc: '黏住蟑螂持续灼烧', icon: Bug, category: 'control' as const },
  { id: 'fan', name: '强力风扇', desc: '减速全场蟑螂', icon: Wind, category: 'control' as const },
  { id: 'molotov', name: '燃烧瓶', desc: '制造火墙持续伤害', icon: Flame, category: 'aoe' as const },
  { id: 'poison', name: '杀虫喷雾', desc: '全屏毒雾+中毒', icon: Droplets, category: 'aoe' as const },
  { id: 'shotgun', name: '散弹模式', desc: '三方向扇形火焰', icon: Target, category: 'aoe' as const },
  { id: 'swatter', name: '电蚊拍', desc: '全屏秒杀', icon: Zap, category: 'burst' as const },
  { id: 'radar', name: '雷达激光', desc: '自动追踪锁定', icon: ScanLine, category: 'burst' as const },
  { id: 'knife', name: '斩螂·110', desc: '自动跃向最高威胁目标', icon: Sword, category: 'burst' as const },
];

const CATEGORY_LABELS: Record<string, string> = {
  control: TEXT_CONFIG.ui.preparation.categories.control,
  aoe: TEXT_CONFIG.ui.preparation.categories.aoe,
  burst: TEXT_CONFIG.ui.preparation.categories.burst,
};

const CATEGORY_COLORS: Record<string, string> = {
  control: 'text-blue-400 border-blue-500/50 bg-blue-900/20',
  aoe: 'text-orange-400 border-orange-500/50 bg-orange-900/20',
  burst: 'text-red-400 border-red-500/50 bg-red-900/20',
};

export const PreparationScreen: React.FC<PreparationScreenProps> = ({ availableItems, onStart, onBack, audio}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const maxSelect = 3;

  /** 筛选当前场景的可用道具（按 availableItems 过滤） */
  const sceneItems = ALL_ITEMS.filter(item => availableItems.includes(item.id));

  /** 切换道具选中状态：已选中则取消，未选中且未满则添加 */
  const toggleItem = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id));
    } else if (selected.length < maxSelect) {
      setSelected([...selected, id]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" style={{ touchAction: 'pan-y' }}>
      <div className="w-full max-w-md mx-auto px-4 py-6">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold text-white mb-1">道具选择</h1>
          <p className="text-stone-400 text-sm">选择 {maxSelect} 种道具 ({selected.length}/{maxSelect})</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {sceneItems.map(item => {
            const isSelected = selected.includes(item.id);
            const isFull = selected.length >= maxSelect && !isSelected;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { audio?.playClick(); !isFull && toggleItem(item.id); }}
                disabled={isFull}
                className={`relative rounded-xl border p-3 text-left transition-all active:scale-95 ${
                  isSelected
                    ? 'border-yellow-500 bg-yellow-900/30'
                    : isFull
                    ? 'border-stone-800 bg-stone-900/30 opacity-40'
                    : 'border-stone-700 bg-stone-900/60 hover:border-stone-500'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                    <Check size={12} className="text-black" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${CATEGORY_COLORS[item.category]}`}>
                    <Icon size={18} />
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[item.category]}`}>
                    {CATEGORY_LABELS[item.category]}
                  </span>
                </div>
                <div className="text-sm font-bold text-white">{item.name}</div>
                <div className="text-xs text-stone-500">{item.desc}</div>
              </button>
            );
          })}
        </div>

        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {selected.map(id => {
              const item = ALL_ITEMS.find(i => i.id === id);
              return (
                <span key={id} className="text-xs bg-yellow-900/40 text-yellow-300 border border-yellow-600/30 px-2 py-1 rounded">
                  {item?.name}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { audio?.playClick(); onBack(); }} className="flex-1 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-white font-bold transition-all">
            返回
          </button>
          <button
            onClick={() => { audio?.playClick(); onStart(selected); }}
            disabled={selected.length === 0}
            className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              selected.length > 0
                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
            }`}
          >
            开始战斗 <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
