/**
 * @fileoverview 补给站 / 商店界面组件。
 * 支持两种模式：
 * - 菜单商店（isMenuShop）：从主菜单入口进入，使用持久化的 menuShopMoney 购买道具
 * - 局内商店：在关卡之间（波次通关后）展示，使用 economy.money 购买道具，并可进入下一关
 *
 * v2.7：商店界面改为 540×960 逻辑坐标绝对定位（由 UI 布局编辑器导出），
 * Fixed-Height 缩放（scaleH = 视口高 / 960），水平居中，窄屏左右裁切。
 * 2×3 道具卡片网格 + 顶部金币栏 + 底部已拥有道具栏。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Home } from 'lucide-react';
import { CONSUMABLE_DEFS, TEXT_CONFIG } from '@/game/data';
import type { Economy, SceneType } from '@/game/types';
import type { AudioManager } from '@/game/audio';

interface ShopScreenProps {
  economy: Economy;
  onBuy: (id: string) => boolean;
  onContinue: () => void;
  onQuit: () => void;
  talentPoints?: number;
  nextSceneName?: string;
  onNextScene?: () => void;
  difficulty?: 'easy' | 'hard';
  currentScene?: SceneType;
  onOpenTalentTree?: () => void;
  isMenuShop?: boolean;
  audio?: AudioManager;
  /** 天赋系统是否已解锁（通关地下室后），用于显示常驻天赋加点入口 */
  talentUnlocked?: boolean;
}

/** 商店卡片布局（540×960 逻辑坐标，来自 UI 布局编辑器导出） */
interface ShopCardLayout {
  /** 对应 CONSUMABLE_DEFS 的道具 id */
  id: string;
  /** 卡片上显示的名称（部分道具名称与 CONSUMABLE_DEFS 不一致，以布局为准） */
  name: string;
  card: { x: number; y: number };
  icon: { x: number; y: number };
  label: { x: number; y: number; w: number; h: number };
  price: { x: number; y: number; w: number; h: number };
  buy: { x: number; y: number };
}

/** 卡片尺寸（固定 150×190） */
const CARD_W = 150;
const CARD_H = 190;
const ICON_W = 110;
const ICON_H = 110;
const BUY_W = 34;
const BUY_H = 34.5;

/** 6 张卡片（2×3 网格，顺序：气罐补给 / 紧急冷却 / 火力全开 / 防线修复 / 防线护盾 / 蟑螂诱饵） */
const SHOP_CARDS: ShopCardLayout[] = [
  { id: 'gas_refill', name: '气罐补给', card: { x: 130, y: 170 }, icon: { x: 150, y: 180 }, label: { x: 160, y: 290, w: 90.4, h: 40 }, price: { x: 160, y: 320, w: 90.4, h: 40 }, buy: { x: 240, y: 320 } },
  { id: 'emergency_cool', name: '紧急冷却', card: { x: 290, y: 170 }, icon: { x: 310, y: 180 }, label: { x: 300, y: 290, w: 125.5, h: 40 }, price: { x: 300, y: 320, w: 125.5, h: 40 }, buy: { x: 400, y: 320 } },
  { id: 'power_boost', name: '火力全开', card: { x: 130, y: 380 }, icon: { x: 150, y: 390 }, label: { x: 150, y: 500, w: 110, h: 27 }, price: { x: 150, y: 530, w: 110, h: 27 }, buy: { x: 240, y: 530 } },
  { id: 'defense_repair', name: '防线修复', card: { x: 290, y: 380 }, icon: { x: 310, y: 390 }, label: { x: 310, y: 500, w: 107.1, h: 28.3 }, price: { x: 330, y: 530, w: 70, h: 30 }, buy: { x: 400, y: 530 } },
  { id: 'shield', name: '防线护盾', card: { x: 130, y: 590 }, icon: { x: 150, y: 600 }, label: { x: 140, y: 710, w: 121.9, h: 26.9 }, price: { x: 140, y: 740, w: 121.9, h: 26.9 }, buy: { x: 240, y: 740 } },
  { id: 'bait', name: '蟑螂诱饵', card: { x: 290, y: 590 }, icon: { x: 310, y: 600 }, label: { x: 310, y: 710, w: 101, h: 28.8 }, price: { x: 310, y: 740, w: 101, h: 28.8 }, buy: { x: 400, y: 740 } },
];

export const ShopScreen: React.FC<ShopScreenProps> = ({
  economy, onBuy, onContinue, onQuit,
  nextSceneName, onNextScene,
  isMenuShop = false, audio}) => {
  // ── 状态管理 ──
  const [localMoney, setLocalMoney] = useState(economy.money);
  /** 从 localStorage 加载已拥有的消耗品数量 */
  const [ownedConsumables, setOwnedConsumables] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('roach_blaster_consumables');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.consumables || {};
      }
    } catch { /* ignore */ }
    return {};
  });
  const [ownedEmergencyCool, setOwnedEmergencyCool] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('roach_blaster_consumables');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.emergencyCool || 0;
      }
    } catch { /* ignore */ }
    return 0;
  });

  // ── Fixed-Height 缩放（scaleH = 视口高 / 960），水平居中 ──
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 540,
    h: typeof window !== 'undefined' ? window.innerHeight : 960,
  }));
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  const scaleH = viewport.h / 960;
  const frameLeft = (viewport.w - 540 * scaleH) / 2;

  /** 某道具当前拥有数量 */
  const countOf = (id: string) =>
    id === 'emergency_cool' ? ownedEmergencyCool : (ownedConsumables[id] || 0);

  /** 有持有数量的道具列表（用于底部已拥有道具栏） */
  const ownedList = useMemo(() => {
    return CONSUMABLE_DEFS.filter(c => countOf(c.id) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedConsumables, ownedEmergencyCool]);

  /** 购买消耗品：检查资金 → 调用父组件 onBuy → 更新本地状态 */
  const handleBuy = (id: string) => {
    const item = CONSUMABLE_DEFS.find(c => c.id === id);
    if (!item || localMoney < item.cost) return;
    const success = onBuy(id);
    if (success) {
      setLocalMoney(prev => prev - item.cost);
      try {
        const saved = localStorage.getItem('roach_blaster_consumables');
        if (saved) {
          const parsed = JSON.parse(saved);
          setOwnedConsumables(parsed.consumables || {});
          setOwnedEmergencyCool(parsed.emergencyCool || 0);
        }
      } catch { /* ignore */ }
    }
  };

  return (
    <div className="absolute inset-0 bg-black overflow-hidden select-none">
      {/* Fixed-Height 层：540×960 设计坐标，随高度缩放、水平居中（窄屏左右裁切） */}
      <div
        style={{
          position: 'absolute',
          left: frameLeft,
          top: 0,
          width: 540,
          height: 960,
          transform: `scale(${scaleH})`,
          transformOrigin: 'top left',
        }}
      >
        {/* 全屏底图 + 中部背景 */}
        <img
          src="/assets/UI/main_bg.png.jpg"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 0, top: 0.5, width: 540, height: 960 }}
        />
        <img
          src="/assets/UI/bg_shop_zh.png"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 107.4, top: 143.5, width: 369, height: 681.2 }}
        />

        {/* 返回按钮 */}
        <button
          onClick={() => { audio?.playClick(); onQuit(); }}
          className="absolute transition-all hover:scale-105 active:scale-95"
          style={{ left: 82.2, top: 11.3, width: 70, height: 50 }}
          title={TEXT_CONFIG.ui.menu.back}
        >
          <img src="/assets/UI/btn_shop_back_zh.png" alt="返回" className="w-full h-full" draggable={false} />
        </button>

        {/* 商店标题 */}
        <img
          src="/assets/UI/bg_shop_title_zh.png"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 250, top: 10, width: 87.4, height: 44.8 }}
        />

        {/* 金币栏：背景 + 数量 + 图标 */}
        <img
          src="/assets/UI/bg_shop_gold_bar_zh.png"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 101.3, top: 72.6, width: 337.5, height: 55.1 }}
        />
        <div
          className="absolute flex items-center justify-center font-bold"
          style={{
            left: 297.1, top: 78.4, width: 94, height: 41.1,
            fontSize: 30, color: '#debc17',
            WebkitTextStroke: '1px #545454',
            textShadow: '-1px -1px 0 #545454, 1px -1px 0 #545454, -1px 1px 0 #545454, 1px 1px 0 #545454',
          }}
        >
          {localMoney}
        </div>
        <img
          src="/assets/UI/icon_coin_zh.png"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 389.7, top: 79.7, width: 38.7, height: 38.1 }}
        />

        {/* 左侧标签：战场道具 / 火枪皮肤 */}
        <img
          src="/assets/UI/btn_shop_gun_item_tab_zh.png"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 60, top: 170, width: 48.1, height: 189.2 }}
        />
        <img
          src="/assets/UI/btn_shop_gun_skin_tab_zh.png"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 60, top: 360, width: 47.4, height: 186.8 }}
        />

        {/* 2×3 道具卡片网格 */}
        {SHOP_CARDS.map((c) => {
          const def = CONSUMABLE_DEFS.find(d => d.id === c.id);
          if (!def) return null;
          const canAfford = localMoney >= def.cost;
          return (
            <div
              key={c.id}
              className="absolute"
              style={{ left: c.card.x, top: c.card.y, width: CARD_W, height: CARD_H }}
            >
              {/* 卡片背景 */}
              <img
                src="/assets/UI/shop_card_bg_zh.png"
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full"
              />
              {/* 道具图标 */}
              <img
                src={def.icon}
                alt={def.name}
                draggable={false}
                className="absolute"
                style={{
                  left: c.icon.x - c.card.x,
                  top: c.icon.y - c.card.y,
                  width: ICON_W,
                  height: ICON_H,
                }}
              />
              {/* 道具名称 */}
              <div
                className="absolute flex items-center justify-center font-bold"
                style={{
                  left: c.label.x - c.card.x,
                  top: c.label.y - c.card.y,
                  width: c.label.w,
                  height: c.label.h,
                  fontSize: 20,
                  color: '#4a4036',
                }}
              >
                {c.name}
              </div>
              {/* 价格（名称下方，颜色与名称一致） */}
              <div
                className={`absolute flex items-center justify-center ${canAfford ? '' : 'opacity-40'}`}
                style={{
                  left: c.price.x - c.card.x,
                  top: c.price.y - c.card.y,
                  width: c.price.w,
                  height: c.price.h,
                  fontSize: 20,
                  color: '#4a4036',
                }}
              >
                {def.cost}
              </div>
              {/* 购买按钮 */}
              <button
                onClick={() => { audio?.playClick(); handleBuy(c.id); }}
                disabled={!canAfford}
                className={`absolute transition-all ${canAfford ? 'hover:scale-105 active:scale-95' : 'opacity-40 cursor-not-allowed'}`}
                style={{
                  left: c.buy.x - c.card.x,
                  top: c.buy.y - c.card.y,
                  width: BUY_W,
                  height: BUY_H,
                }}
                title={`${c.name} &yen;${def.cost}`}
              >
                <img src="/assets/UI/btn_bg_buy_zh.png" alt="购买" className="w-full h-full" draggable={false} />
              </button>
            </div>
          );
        })}

        {/* 底部已拥有道具栏 */}
        <img
          src="/assets/UI/bg_shop_bottom_item_bar_zh.png"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 111.5, top: 832, width: 361.9, height: 117.9 }}
        />
        {/* 标题 */}
        <div
          className="absolute flex items-center justify-center"
          style={{ left: 182.3, top: 838.7, width: 220, height: 40, fontSize: 20, color: '#f9c453' }}
        >
          {TEXT_CONFIG.ui.shop.ownedItems}
        </div>
        {ownedList.length === 0 ? (
          <div
            className="absolute flex items-center justify-center"
            style={{ left: 111.5, top: 832, width: 361.9, height: 117.9, fontSize: 14, color: '#9ca3af' }}
          >
            {TEXT_CONFIG.ui.shop.noItems}
          </div>
        ) : (
          ownedList.map((item, i) => {
            // 6 个已拥有道具在道具栏内均匀排布（图标 58px 间距，起点 122.5）
            const x = 122.5 + i * 58;
            const count = countOf(item.id);
            return (
              <div key={item.id}>
                {/* 已拥有道具图标 */}
                <img
                  src={item.icon}
                  alt={item.name}
                  draggable={false}
                  style={{ position: 'absolute', left: x, top: 880.1, width: 58.1, height: 58.1 }}
                />
                {/* 数量角标背景 + 数字（前面加 x） */}
                <img
                  src="/assets/UI/bg_item_num_bg_zh.png"
                  alt=""
                  draggable={false}
                  style={{ position: 'absolute', left: x + 32.4, top: 910, width: 30.1, height: 34 }}
                />
                <div
                  className="absolute flex items-center justify-center font-bold"
                  style={{ left: x + 37.5, top: 918.1, width: 21.5, height: 20.9, fontSize: 15, color: '#3f3d36' }}
                >
                  X{count}
                </div>
              </div>
            );
          })
        )}

        {/* 滚动条（装饰） */}
        <img
          src="/assets/UI/shop_scroll_track.png"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 450, top: 180, width: 20, height: 603.3 }}
        />
        <img
          src="/assets/UI/shop_scroll_bar.png"
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: 450, top: 240, width: 20, height: 460 }}
        />

        {/* 局内商店：底部「下一关 / 返回主菜单」按钮（覆盖在已拥有道具栏下方） */}
        {!isMenuShop && (
          <div
            className="absolute flex items-center justify-center gap-3"
            style={{ left: 0, top: 960 - 90, width: 540, height: 70, background: 'rgba(0,0,0,0.6)' }}
          >
            {onNextScene ? (
              <button
                onClick={() => { audio?.playClick(); onNextScene?.(); }}
                className="flex items-center gap-2 text-white font-bold px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 transition-all active:scale-95"
              >
                {TEXT_CONFIG.ui.shop.nextLevel(nextSceneName || '')}
                <ArrowRight size={20} />
              </button>
            ) : (
              <button
                onClick={() => { audio?.playClick(); onContinue(); }}
                className="flex items-center gap-2 text-white font-bold px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 transition-all active:scale-95"
              >
                {TEXT_CONFIG.ui.shop.playAgain}
                <ArrowRight size={20} />
              </button>
            )}
            <button
              onClick={() => { audio?.playClick(); onQuit(); }}
              className="flex items-center gap-2 text-white font-bold px-6 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 transition-all active:scale-95"
            >
              <Home size={20} />
              {TEXT_CONFIG.ui.shop.backToMenu}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
