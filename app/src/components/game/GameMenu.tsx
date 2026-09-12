/**
 * @fileoverview 主菜单组件。
 * 提供游戏模式选择（剧情 / 无尽 / 每日挑战 / BOSS 战）、
 * 剧情模式下的难度选择（简单 / 困难）和关卡选择，
 * 以及天赋树、道具商店、成就、图鉴等子界面的入口。
 * 采用废土风格（铆钉金属板）视觉设计。
 *
 * v2.6：主界面改为 540×960 逻辑坐标绝对定位（由 UI 布局编辑器导出），
 * 按游戏画布显示宽度等比缩放并对齐画布，按钮点击逻辑保持不变。
 */
import React, { useEffect, useState } from 'react';
import {
  Volume2, VolumeX,
  RotateCcw, AlertTriangle, Trash2, Lock, Settings,
} from 'lucide-react';
import { GameMode, SceneType, type GameProgress } from '@/game/types';
import { TEXT_CONFIG } from '@/game/data';
import { resetSeenComics } from '@/game/comicData';
import type { AudioManager } from '@/game/audio';

/** 关卡选择界面图素路径（来自 UI 布局编辑器导出，已提取到 public/assets/UI/） */
const SCENE_SELECT_IMG = {
  bg: '/assets/UI/scene_level_bg.png',                       // 地图底图（背景图）
  map: '/assets/UI/scene_level_map_3d.png',                   // 3D 地图总图
  topBar: '/assets/UI/scene_level_tab_bar_zh.png',            // 顶部标签栏
  arrowClear: '/assets/UI/scene_level_arrow_clear.png',       // 通关金色箭头
  arrowLock: '/assets/UI/scene_level_arrow_lock.png',         // 未通关灰色箭头
  arrowCurrent: '/assets/UI/scene_level_arrow_current.png',   // 当前选择箭头（静态，后续替换序列帧）
  starGold: '/assets/UI/scene_level_star_gold.png',           // 单颗金星
  starGray: '/assets/UI/scene_level_star_gray.png',           // 四颗灰星底图
  labelClear: '/assets/UI/bg_level_clear_zh.png',             // 已解锁关卡名称标签框
  labelLock: '/assets/UI/bg_level_lock_zh.png',               // 未解锁关卡名称标签框
  back: '/assets/UI/scene_level_back.png',                    // 返回按钮
};

/** 单个关卡节点布局（540×960 逻辑坐标，来自 UI 布局编辑器导出） */
interface SceneLevelNode {
  id: SceneType;
  name: string;
  arrow: { x: number; y: number; w: number; h: number };
  /** 选中区域（透明热区）：UI 编辑器里虚线框可见、游戏内不显示 */
  hit: { x: number; y: number; w: number; h: number };
  stars: { x: number; y: number };
  label: { x: number; y: number; w: number; h: number };
  text: { x: number; y: number; w: number };
}

/** 11 个简单关节点（顺序与 SCENE_ORDER 一致：厨房→…→巢穴） */
const LEVEL_NODES: SceneLevelNode[] = [
  { id: SceneType.KITCHEN, name: '厨房', arrow: { x: 103.1, y: 199.4, w: 24, h: 37 }, hit: { x: 64.3, y: 240, w: 100.2, h: 104.5 }, stars: { x: 132.2, y: 331.9 }, label: { x: 132.9, y: 306, w: 60, h: 24 }, text: { x: 137.1, y: 309.2, w: 50.9 } },
  { id: SceneType.SEWER, name: '下水道', arrow: { x: 259.1, y: 171.8, w: 24, h: 37 }, hit: { x: 234.1, y: 221.3, w: 74, h: 103.1 }, stars: { x: 238.9, y: 329 }, label: { x: 237.4, y: 305.2, w: 66.1, h: 24 }, text: { x: 239.8, y: 309.5, w: 61.4 } },
  { id: SceneType.DUMP, name: '垃圾场', arrow: { x: 427.1, y: 197.5, w: 24, h: 37 }, hit: { x: 304.8, y: 335.1, w: 74, h: 74 }, stars: { x: 405.8, y: 335.8 }, label: { x: 317.3, y: 396, w: 60, h: 24 }, text: { x: 319.7, y: 400.2, w: 55.9 } },
  { id: SceneType.BASEMENT, name: '地下室', arrow: { x: 335.6, y: 292.7, w: 24, h: 37 }, hit: { x: 402.2, y: 266.4, w: 75.6, h: 78.9 }, stars: { x: 317.9, y: 418.9 }, label: { x: 399, y: 307.6, w: 75, h: 24 }, text: { x: 400.7, y: 312.6, w: 71.9 } },
  { id: SceneType.STREET, name: '城市街道', arrow: { x: 482.8, y: 299.9, w: 46.3, h: 72 }, hit: { x: 225.1, y: 443.3, w: 118.4, h: 109 }, stars: { x: 268.6, y: 573.3 }, label: { x: 260.8, y: 547.7, w: 79, h: 24 }, text: { x: 264.5, y: 550.6, w: 72.2 } },
  { id: SceneType.ROOFTOP, name: '天台', arrow: { x: 112.3, y: 428.9, w: 24, h: 37 }, hit: { x: 401.7, y: 376, w: 88.6, h: 120.6 }, stars: { x: 408, y: 470 }, label: { x: 415, y: 447.4, w: 44, h: 24 }, text: { x: 413, y: 450, w: 50 } },
  { id: SceneType.HOSPITAL, name: '废弃医院', arrow: { x: 267.4, y: 382, w: 24, h: 37 }, hit: { x: 64.3, y: 441.8, w: 107.4, h: 143.2 }, stars: { x: 104.4, y: 589.6 }, label: { x: 96.7, y: 564.1, w: 79, h: 24 }, text: { x: 99.7, y: 567.4, w: 69.8 } },
  { id: SceneType.SUBWAY, name: '废弃地铁', arrow: { x: 396, y: 500.4, w: 24, h: 37 }, hit: { x: 377.4, y: 511.3, w: 148, h: 79.7 }, stars: { x: 409.4, y: 596 }, label: { x: 401.5, y: 568.4, w: 79, h: 24 }, text: { x: 406.1, y: 571.5, w: 73.2 } },
  { id: SceneType.SUPERMARKET, name: '废弃超市', arrow: { x: 102.7, y: 623.7, w: 24, h: 37 }, hit: { x: 220.9, y: 610.1, w: 107.6, h: 100 }, stars: { x: 113.9, y: 766.3 }, label: { x: 244.6, y: 689.7, w: 79, h: 24 }, text: { x: 253.1, y: 692.1, w: 67.7 } },
  { id: SceneType.SCHOOL, name: '废弃学校', arrow: { x: 262.1, y: 598.2, w: 24, h: 37 }, hit: { x: 70.3, y: 642.3, w: 112.1, h: 111 }, stars: { x: 253.9, y: 717.4 }, label: { x: 104.8, y: 739.9, w: 79, h: 24 }, text: { x: 104.1, y: 744.3, w: 80.8 } },
  { id: SceneType.NEST, name: '巢穴', arrow: { x: 401.6, y: 642.6, w: 24, h: 37 }, hit: { x: 372.2, y: 660, w: 104.9, h: 112.7 }, stars: { x: 372.7, y: 780.2 }, label: { x: 360.8, y: 755.5, w: 79, h: 24 }, text: { x: 373.6, y: 757.4, w: 55.6 } },
];

/** 四颗灰星底图宽（62）均分单颗 ≈ 15.5，用于金星从左覆盖 */
const STAR_SLOT_W = 15.5;
const STAR_H = 14;

interface GameMenuProps {
  onStart: (difficulty: 'easy' | 'hard', mode: GameMode, scene: SceneType) => void;
  onOpenTalentTree: () => void;
  onOpenAchievements: () => void;
  onOpenSceneSelect: () => void;
  onOpenEncyclopedia: () => void;
  audioMuted: boolean;
  onToggleMute: () => void;
  onOpenShop: (scene?: SceneType) => void;
  progress: GameProgress | null;
  talentPoints: number;
  audio?: AudioManager;
  /** 游戏画布在视口中的位置/尺寸：主菜单按 540 逻辑坐标绝对定位时用于对齐与缩放 */
  canvasBounds?: { left: number; top: number; width: number; height: number } | null;
  /** 从结算界面返回时自动打开的关卡选择地图并定位箭头；null = 正常进入主菜单 */
  initialLevelSelect?: SceneType | null;
}

export const GameMenu: React.FC<GameMenuProps> = ({
  onStart, onOpenTalentTree, onOpenAchievements, onOpenEncyclopedia,
  audioMuted, onToggleMute, onOpenShop, progress, talentPoints, audio, canvasBounds, initialLevelSelect}) => {
  // ── 状态管理 ──
  const [bgLoaded, setBgLoaded] = useState(false);
  const [showModes, setShowModes] = useState(initialLevelSelect != null);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(initialLevelSelect != null ? GameMode.STORY : null);
  /** v2.6：难度选择已移除，剧情模式直接进入关卡选择（简单 11 关 + 巢穴后 6 个困难关） */
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  /** 当前选中的关卡（地图式关卡选择）；null = 使用默认（第一个未通关的已解锁关卡） */
  const [selectedLevelId, setSelectedLevelId] = useState<SceneType | null>(initialLevelSelect ?? null);

  /** 预加载菜单背景图 */
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/assets/bg_kitchen_easy.jpg';
  }, []);

  const scenesUnlocked = progress?.scenesUnlocked || [SceneType.KITCHEN];
  // 天赋系统解锁门槛：通关地下室(basement)后解锁，此前主菜单天赋入口锁定
  const talentUnlocked = !!progress?.scenesCompleted?.includes('basement');

  // 默认选中：第一个「已解锁但未通关」的关卡；全部通关则选中最后一关
  const defaultSel = LEVEL_NODES.find(n => scenesUnlocked.includes(n.id) && (progress?.levelStars?.[n.id] ?? 0) === 0)?.id
    ?? LEVEL_NODES[LEVEL_NODES.length - 1].id;
  const curSel = selectedLevelId ?? defaultSel;

  /** 重置所有游戏进度：清除 localStorage → 刷新页面 */
  const handleReset = () => {
    resetSeenComics();
    localStorage.clear();
    setTimeout(() => {
      window.location.href = window.location.pathname + '?reset=' + Date.now();
    }, 100);
  };

  /** 选择游戏模式：剧情模式直接进入关卡选择（难度选择已移除） */
  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    setShowModes(true);
  };

  // 画布边界未就绪时先渲染纯黑占位，避免按钮以 fallback 坐标渲染后跳到设计位置（跳动）
  if (!canvasBounds) {
    return <div className="absolute inset-0" style={{ background: '#000' }} />;
  }

  {/* ═══ 剧情模式 → 地图式关卡选择（9:16，3D 地图 + 星级 + 名称标签 + 选中区域）═══ */}
  if (showModes && selectedMode === GameMode.STORY) {
    // 背景与 UI 统一使用 Fixed-Height 缩放（scaleH = vh/960），水平居中。
    // UI 元素不单独 Contain 缩放，因此相对地图不缩小、不位移（需求：UI 不缩小不改变位置）。
    const vwS = canvasBounds?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 540);
    const vhS = canvasBounds?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 960);
    const vxS = canvasBounds?.left ?? 0;
    const vyS = canvasBounds?.top ?? 0;
    const scaleH = vhS / 960;
    const innerStyle: React.CSSProperties = {
      position: 'absolute',
      left: (vwS - 540 * scaleH) / 2,
      top: 0,
      width: 540,
      height: 960,
      transform: `scale(${scaleH})`,
      transformOrigin: 'top left',
    };

    return (
      <div className="absolute inset-0 overflow-hidden" style={{ background: '#000' }}>
        {/* 单一 Fixed-Height 层：背景图 + 全部 UI 都在 540×960 设计坐标内，随高度缩放、水平居中（窄屏左右裁切） */}
        <div style={{ position: 'fixed', left: vxS, top: vyS, width: vwS, height: vhS, overflow: 'hidden', zIndex: 0 }}>
          <div style={innerStyle}>
            {/* 背景层 */}
            <div className="pointer-events-none">
              <img src={SCENE_SELECT_IMG.bg} alt="" draggable={false}
                style={{ position: 'absolute', left: 0, top: 0, width: 540, height: 960 }} />
              <img src={SCENE_SELECT_IMG.map} alt="" draggable={false}
                style={{ position: 'absolute', left: 0, top: 177, width: 540, height: 783 }} />
            </div>

            {/* 顶部标签栏 */}
            <img src={SCENE_SELECT_IMG.topBar} alt="" draggable={false}
              style={{ position: 'absolute', left: 73.2, top: 18.7, width: 396.5, height: 92.2 }} />

            {/* 返回按钮 */}
            <button
              onClick={() => { audio?.playClick(); setShowModes(false); setSelectedMode(null); setSelectedLevelId(null); }}
              className="absolute transition-transform hover:scale-105 active:scale-95"
              style={{ left: 82.5, top: 27.6, width: 67.7, height: 67.7 }}
              title="返回"
            >
              <img src={SCENE_SELECT_IMG.back} alt="返回" className="w-full h-full" draggable={false} />
            </button>

            {/* 关卡节点：星级 + 名称标签 + 选中区域（透明热区，箭头已移除） */}
            {LEVEL_NODES.map((node) => {
              const isUnlocked = scenesUnlocked.includes(node.id);
              const bestStars = progress?.levelStars?.[node.id] ?? 0;
              const isSelected = curSel === node.id;       // 当前选中 → 显示当前箭头特效
              return (
                <div key={node.id}>
                  {/* 当前选择箭头（静态，后续替换序列帧）：仅显示在选中关卡上 */}
                  {isSelected && (
                    <img
                      src={SCENE_SELECT_IMG.arrowCurrent}
                      alt="" draggable={false}
                      style={{ position: 'absolute', left: node.arrow.x - 4, top: node.arrow.y - 4, width: node.arrow.w + 8, height: node.arrow.h + 8 }}
                    />
                  )}

                  {/* 星级评价：四颗灰星底图，按最佳星级从左到右用金星覆盖 */}
                  <img
                    src={SCENE_SELECT_IMG.starGray} alt="" draggable={false}
                    style={{ position: 'absolute', left: node.stars.x, top: node.stars.y, width: STAR_SLOT_W * 4, height: STAR_H }}
                  />
                  {[0, 1, 2, 3].slice(0, bestStars).map((i) => (
                    <img
                      key={i}
                      src={SCENE_SELECT_IMG.starGold} alt="" draggable={false}
                      style={{ position: 'absolute', left: node.stars.x + i * STAR_SLOT_W, top: node.stars.y, width: STAR_SLOT_W, height: STAR_H }}
                    />
                  ))}

                  {/* 关卡名称标签框 + 文字 */}
                  <img
                    src={isUnlocked ? SCENE_SELECT_IMG.labelClear : SCENE_SELECT_IMG.labelLock} alt="" draggable={false}
                    style={{ position: 'absolute', left: node.label.x, top: node.label.y, width: node.label.w, height: node.label.h }}
                  />
                  <div
                    className="absolute flex items-center justify-center font-bold"
                    style={{
                      left: node.text.x, top: node.text.y, width: node.text.w, height: 20,
                      fontSize: 13, color: isUnlocked ? '#fff' : '#8a8a8a',
                      textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                    }}
                  >
                    {node.name}
                  </div>

                  {/* 选中区域（透明热区，游戏内不显示虚线框）：首次点击选中，再次点击已选中关卡进入游戏 */}
                  <button
                    onClick={() => {
                      audio?.playClick();
                      if (curSel === node.id) {
                        if (isUnlocked) onStart('easy', GameMode.STORY, node.id);
                      } else {
                        setSelectedLevelId(node.id);
                      }
                    }}
                    className="absolute"
                    style={{
                      left: node.hit.x, top: node.hit.y, width: node.hit.w, height: node.hit.h,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                    }}
                    aria-label={`选择 ${node.name}`}
                  />
                </div>
              );
            })}

            {/* 底部功能入口：商店 / 天赋 / 成就 / 图鉴（自主菜单移入，80×80 图标） */}
            <button
              onClick={() => { audio?.playClick(); onOpenShop(curSel); }}
              className="absolute transition-transform hover:scale-105 active:scale-95"
              style={{ left: 76, top: 865.4, width: 80, height: 80 }}
              title="商店"
            >
              <img src="/assets/UI/btn_shop_zh.png" alt="商店" className="w-full h-full" draggable={false} />
            </button>
            <button
              onClick={talentUnlocked ? () => { audio?.playClick(); onOpenTalentTree(); } : undefined}
              className={`absolute transition-transform ${talentUnlocked ? 'hover:scale-105 active:scale-95' : 'opacity-40 cursor-not-allowed'}`}
              style={{ left: 178.8, top: 864.9, width: 80, height: 80 }}
              title="天赋"
            >
              <img src="/assets/UI/btn_talent_zh.png" alt="天赋" className="w-full h-full" draggable={false} />
              {!talentUnlocked ? (
                <Lock size={16} className="absolute -top-1 -right-1 text-stone-300" />
              ) : (
                talentPoints > 0 && (
                  <span className="absolute -top-1.5 -right-1 bg-red-600 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center border border-stone-900" style={{ fontSize: 11 }}>{talentPoints}</span>
                )
              )}
            </button>
            <button
              onClick={() => { audio?.playClick(); onOpenAchievements(); }}
              className="absolute transition-transform hover:scale-105 active:scale-95"
              style={{ left: 282.5, top: 863.9, width: 80, height: 80 }}
              title="成就"
            >
              <img src="/assets/UI/btn_achievement_zh.png" alt="成就" className="w-full h-full" draggable={false} />
            </button>
            <button
              onClick={() => { audio?.playClick(); onOpenEncyclopedia(); }}
              className="absolute transition-transform hover:scale-105 active:scale-95"
              style={{ left: 377.2, top: 863.2, width: 80, height: 80 }}
              title="图鉴"
            >
              <img src="/assets/UI/btn_encyclopedia_zh.png" alt="图鉴" className="w-full h-full" draggable={false} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 主菜单：540×960（9:16）逻辑坐标层，等比缩放并在画布中居中，超出区域纯黑填充 ──
  const DESIGN_W = 540;
  const DESIGN_H = 960;
  const vw = canvasBounds?.width ?? (typeof window !== 'undefined' ? window.innerWidth : DESIGN_W);
  const vh = canvasBounds?.height ?? (typeof window !== 'undefined' ? window.innerHeight : DESIGN_H);
  const vx = canvasBounds?.left ?? 0;
  const vy = canvasBounds?.top ?? 0;
  const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H); // 边缘锚点元素（LOGO/音效/重置）Contain 缩放
  const frameW = DESIGN_W * scale;
  // 背景/立绘/按钮统一 Fixed Height（开发准则 27.5）——高度填满画布区域，宽度按图片比例(540:960)水平居中；
  // 窄屏左右自然裁切、宽屏两侧黑色填充，上下永远无黑边；按钮大小/位置不随屏幕 Contain 缩放
  const bgLayerStyle: React.CSSProperties = {
    position: 'fixed',
    left: vx, top: vy, width: vw, height: vh,
    overflow: 'hidden',
  };
  // Fixed-Height 坐标系内层：540×960 设计坐标按 scaleH(=vh/960) 缩放，水平居中；父层 overflow 裁切
  const scaleH = vh / DESIGN_H;
  const fhInnerStyle: React.CSSProperties = {
    position: 'absolute',
    left: (vw - DESIGN_W * scaleH) / 2,
    top: 0,
    width: DESIGN_W,
    height: DESIGN_H,
    transform: `scale(${scaleH})`,
    transformOrigin: 'top left',
  };

  // ── 边缘锚点元素（LOGO 钉顶居中 / 音效钉顶右 / 重置钉底左）──
  // 尺寸随 Contain 缩放(scale)，位置从设计坐标映射到屏幕；夹取在可见区内：宽屏自然落在居中画面区，窄屏不溢出
  const frameLeft = vx + (vw - frameW) / 2;
  const clampX = (designLeft: number, designWidth: number) =>
    Math.max(vx + 8, Math.min(frameLeft + designLeft * scale, vx + vw - designWidth * scale - 8));
  // LOGO：与顶部距离固定（不再随居中黑边下移）
  const logoW = 354 * scale, logoH = 150 * scale;
  const logoStyle: React.CSSProperties = {
    position: 'fixed', top: vy + 28.9 * scale, left: clampX(90, 354),
    width: logoW, height: logoH,
  };
  // 音效：与顶部距离固定（右上角）
  const muteBoxW = 42 * scale;
  const muteWrapStyle: React.CSSProperties = {
    position: 'fixed', top: vy + 16 * scale, left: clampX(486, 42),
    width: muteBoxW, height: muteBoxW, zIndex: 20,
  };
  // 重置：与底部距离固定（左下角；设计底距 ≈ 26px；bottom 相对视口，需补偿画布下方留白）
  const gapBelow = (typeof window !== 'undefined' ? window.innerHeight : vh) - (vy + vh);
  const resetWrapStyle: React.CSSProperties = {
    position: 'fixed', bottom: gapBelow + 26 * scale, left: clampX(16, 110),
    width: 110 * scale, height: 26 * scale, zIndex: 20,
  };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#000' }}>
      {/* 背景 + 立绘 + 按钮：统一 Fixed-Height 层（540×960 设计坐标，随高度缩放、水平居中，窄屏左右裁切；按钮不随屏幕 Contain 缩放） */}
      <div style={bgLayerStyle} className="z-0">
        <div style={fhInnerStyle}>
          {/* 背景图（540×960，位置不变） */}
          <img src="/assets/UI/main_bg.png.jpg" alt="" draggable={false}
            className="absolute select-none"
            style={{ left: 0, top: 0, width: 540, height: 960 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          {/* 主角色立绘：Fixed-Height 坐标，不随屏幕缩小，窄屏左右直接裁切 */}
          <img src="/assets/UI/main_char_01_zh.png" alt="" draggable={false}
            className="absolute select-none pointer-events-none" style={{ left: 7.6, top: 294.8, width: 302, height: 579 }} />

          {/* 剧情模式（关卡模式按钮） */}
          <button
            onClick={() => { audio?.playClick(); handleModeSelect(GameMode.STORY); }}
            className="absolute transition-transform hover:scale-105 active:scale-95"
            style={{ left: 334.2, top: 297.8, width: 128, height: 128 }}
          >
            <img src="/assets/UI/btn_story_zh.png" alt="剧情模式" className="w-full h-full" draggable={false} />
          </button>

          {/* 图鉴 */}
          <button
            onClick={() => { audio?.playClick(); onOpenEncyclopedia(); }}
            className="absolute transition-transform hover:scale-105 active:scale-95"
            style={{ left: 340.7, top: 443, width: 128, height: 128 }}
          >
            <img src="/assets/UI/btn_encyclopedia _zh.png" alt="图鉴" className="w-full h-full" draggable={false} />
          </button>

          {/* 每日活动 */}
          <button
            onClick={() => { audio?.playClick(); onStart('easy', GameMode.DAILY, SceneType.KITCHEN); }}
            className="absolute transition-transform hover:scale-105 active:scale-95"
            style={{ left: 342.3, top: 602.7, width: 128, height: 128 }}
          >
            <img src="/assets/UI/btn_daily_zh.png" alt="每日活动" className="w-full h-full" draggable={false} />
          </button>

          {/* 设置（齿轮）：打开设置面板 */}
          <button
            onClick={() => { audio?.playClick(); setShowSettings(true); }}
            className="absolute transition-transform hover:scale-105 active:scale-95"
            style={{ left: 413.1, top: 203.9, width: 48.6, height: 50 }}
            title="设置"
          >
            <img src="/assets/UI/main_btn_settings_normal.png" alt="设置" className="w-full h-full" draggable={false} />
          </button>
        </div>
      </div>

      {/* ═══ 边缘锚点层（不随 Contain 层居中偏移）：LOGO 钉顶、音效钉顶右、重置钉底左 ═══ */}
      {/* LOGO：与顶部距离固定（尺寸随 UI 缩放，水平按设计坐标映射并夹取在可见区） */}
      <img src="/assets/UI/main_logo_main_zh.png" alt={TEXT_CONFIG.ui.menu.title} draggable={false}
        className="pointer-events-none select-none" style={{ ...logoStyle, zIndex: 15 }} />

      {/* 音效开关（右上角，与顶部距离固定） */}
      <div style={muteWrapStyle}>
        <div style={{ width: 42, height: 42, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <button
            onClick={() => { audio?.playClick(); onToggleMute(); }}
            className="rounded-full bg-black/40 text-stone-300 hover:text-amber-300 flex items-center justify-center"
            style={{ width: 42, height: 42 }}
            title={audioMuted ? TEXT_CONFIG.ui.menu.unmute : TEXT_CONFIG.ui.menu.mute}
          >
            {audioMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>
        </div>
      </div>

      {/* 重置进度（左下角，与底部距离固定） */}
      <div style={resetWrapStyle}>
        <div style={{ position: 'absolute', left: 0, bottom: 0, transform: `scale(${scale})`, transformOrigin: 'bottom left' }}>
          <button
            onClick={() => { audio?.playClick(); setShowResetConfirm(true); }}
            className="flex items-center gap-1.5 text-stone-300 hover:text-red-400 transition-colors px-2 py-1 rounded whitespace-nowrap"
            title="重置游戏进度"
          >
            <RotateCcw size={14} />
            <span className="font-mono tracking-wider" style={{ fontSize: 12 }}>{TEXT_CONFIG.ui.menu.reset}</span>
          </button>
        </div>
      </div>

      {/* ═══ 设置面板 ═══ */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 max-w-xs w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0">
                <Settings size={20} className="text-amber-400" />
              </div>
              <h3 className="text-white font-bold text-lg">设置</h3>
            </div>
            {/* 音效开关 */}
            <button
              onClick={() => { onToggleMute(); }}
              className="w-full flex items-center justify-between py-3 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 transition-all active:scale-95 mb-3"
            >
              <span className="flex items-center gap-2 text-stone-200 text-sm font-bold">
                {audioMuted ? <VolumeX size={18} className="text-stone-400" /> : <Volume2 size={18} className="text-amber-400" />}
                音效
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${audioMuted ? 'bg-stone-700 text-stone-400' : 'bg-amber-500/20 text-amber-300'}`}>
                {audioMuted ? '已关闭' : '已开启'}
              </span>
            </button>
            {/* 重置进度 */}
            <button
              onClick={() => { audio?.playClick(); setShowSettings(false); setShowResetConfirm(true); }}
              className="w-full flex items-center justify-between py-3 px-3 rounded-lg bg-stone-800 hover:bg-red-900/40 transition-all active:scale-95"
            >
              <span className="flex items-center gap-2 text-stone-200 text-sm font-bold">
                <RotateCcw size={18} className="text-red-400" />
                重置游戏进度
              </span>
              <span className="text-stone-500 text-xs">›</span>
            </button>
            <button
              onClick={() => { audio?.playClick(); setShowSettings(false); }}
              className="w-full mt-5 py-2.5 rounded-lg bg-stone-800 text-stone-300 font-bold text-sm hover:bg-stone-700 transition-all active:scale-95"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ═══ 重置确认对话框 ═══ */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowResetConfirm(false); }}
        >
          <div className="bg-stone-900 border border-red-900/60 rounded-xl p-6 max-w-xs w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">{TEXT_CONFIG.ui.menu.resetTitle}</h3>
                <p className="text-stone-400 text-xs">{TEXT_CONFIG.ui.menu.resetDesc}</p>
              </div>
            </div>
            <p className="text-stone-300 text-sm mb-6 leading-relaxed">
              {TEXT_CONFIG.ui.menu.resetConfirm}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { audio?.playClick(); setShowResetConfirm(false); }}
                className="flex-1 py-2.5 rounded-lg bg-stone-800 text-stone-300 font-bold text-sm hover:bg-stone-700 transition-all active:scale-95"
              >
                {TEXT_CONFIG.ui.menu.cancel}
              </button>
              <button
                onClick={() => { audio?.playClick(); handleReset(); }}
                className="flex-1 py-2.5 rounded-lg bg-red-900/80 text-red-200 font-bold text-sm hover:bg-red-800 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                {TEXT_CONFIG.ui.menu.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
