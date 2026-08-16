/**
 * @fileoverview 特效工作台资源管理器
 * @description 以资源列表形式呈现游戏内特效资源，两大类：
 *              - 原子特效（EFFECTS ↔ BALANCE_CONFIG.particle 配置组）
 *              - 特效预制体（PREFABS ↔ 游戏内完整事件的时序配方：掉落道具/商店道具/怪物技能）
 *              支持搜索过滤、分类分组、点击选中、拖拽到预览画布/编辑器加载。
 */

import { useMemo, useState } from 'react';
import {
  Bomb,
  CircleDot,
  Cloud,
  CloudRain,
  CloudFog,
  CloudLightning,
  Cookie,
  Cross,
  Crosshair,
  Crown,
  Dna,
  Droplet,
  Fan,
  Flame,
  Fuel,
  Gauge,
  GripVertical,
  HeartPulse,
  Sword,
  Magnet,
  MousePointerClick,
  Radar,
  Search,
  Shapes,
  Shield,
  ShieldPlus,
  Snowflake,
  Sparkles,
  SprayCan,
  Timer,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { CATEGORY_META, type EffectDef } from './effectDefs';
import { PREFAB_CATEGORY_META, type EffectPrefab } from './prefabDefs';

/** 拖拽 MIME（自定义类型必须全小写，dataTransfer.types 会被浏览器归一化为小写） */
export const EFFECT_DRAG_MIME = 'application/x-roach-effect';
export const PREFAB_DRAG_MIME = 'application/x-roach-prefab';

const ICONS: Record<string, LucideIcon> = {
  coneFire: Flame,
  explosion: Bomb,
  shockwave: Radar,
  smoke: Cloud,
  fireRing: CircleDot,
  lightning: Zap,
  ash: Wind,
  blood: Droplet,
  spark: Sparkles,
  debris: Shapes,
  armorSpray: SprayCan,
  shieldRepair: Wrench,
  weatherRain: CloudRain,
  weatherFog: CloudFog,
  weatherLightning: CloudLightning,
};

const PREFAB_ICONS: Record<string, LucideIcon> = {
  p_pickup: MousePointerClick,
  p_molotov: Flame,
  p_poison: Cloud,
  p_shotgun: Crosshair,
  p_swatter: Zap,
  p_radar: Radar,
  p_knife: Sword,
  p_fan: Fan,
  p_sticky: Magnet,
  p_gas_refill: Fuel,
  p_defense_repair: ShieldPlus,
  p_emergency_cool: Snowflake,
  p_shield: Shield,
  p_bait: Cookie,
  s_mutant: Dna,
  s_suicide: Bomb,
  s_timed_bomb: Timer,
  s_nurse: HeartPulse,
  s_armor_spray: SprayCan,
  s_shield_up: Shield,
  s_elite: Gauge,
  s_queen_death: Crown,
};

/** 预制体分类强调色（边框/图标底色） */
const PREFAB_CAT_ACCENT: Record<string, string> = {
  itemDrop: 'text-amber-400',
  shop: 'text-emerald-400',
  skill: 'text-rose-400',
};

interface ResourceExplorerProps {
  effects: EffectDef[];
  activeId: string;
  onSelect: (id: string) => void;
  prefabs: EffectPrefab[];
  activePrefabId: string | null;
  onSelectPrefab: (id: string) => void;
}

export function ResourceExplorer({
  effects,
  activeId,
  onSelect,
  prefabs,
  activePrefabId,
  onSelectPrefab,
}: ResourceExplorerProps) {
  const [query, setQuery] = useState('');

  const filteredEffects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return effects;
    return effects.filter(
      (e) =>
        e.name.includes(query.trim()) ||
        e.en.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q),
    );
  }, [effects, query]);

  const filteredPrefabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prefabs;
    return prefabs.filter(
      (p) =>
        p.name.includes(query.trim()) ||
        p.en.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [prefabs, query]);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[#2c2c30] bg-[#1a1a1c]">
      {/* 头部 */}
      <div className="border-b border-[#2c2c30] px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[10px] font-bold tracking-[0.18em] text-zinc-400 uppercase">
            资源库
          </h2>
          <span className="font-mono text-[8px] tracking-[0.2em] text-zinc-700">RESOURCES</span>
        </div>
        <div className="relative mt-2">
          <Search
            size={12}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索特效 / 预制体…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-1 pl-7 pr-2 text-[11px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-orange-600/60"
          />
        </div>
      </div>

      {/* 资源列表 */}
      <div className="flex-1 space-y-3 overflow-y-auto p-2">
        {/* ===== 特效预制体（组合事件） ===== */}
        <div className="px-1 pt-1">
          <span className="text-[10px] font-bold tracking-widest text-orange-400/80">
            特效预制体
          </span>
          <span className="ml-1.5 font-mono text-[8px] tracking-[0.15em] text-zinc-700">
            PREFABS
          </span>
        </div>
        {PREFAB_CATEGORY_META.map((cat) => {
          const list = filteredPrefabs.filter((p) => p.category === cat.id);
          if (list.length === 0) return null;
          return (
            <section key={cat.id}>
              <header className="mb-1 flex items-baseline gap-1.5 px-1">
                <span className="text-[10px] font-semibold tracking-wider text-zinc-500">
                  {cat.label}
                </span>
                <span className="font-mono text-[8px] tracking-[0.15em] text-zinc-700">
                  {cat.en}
                </span>
                <span className="ml-auto font-mono text-[9px] text-zinc-700">{list.length}</span>
              </header>
              <div className="space-y-1">
                {list.map((p) => (
                  <PrefabCard
                    key={p.id}
                    prefab={p}
                    active={p.id === activePrefabId}
                    onSelect={onSelectPrefab}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* ===== 原子特效 ===== */}
        <div className="px-1 pt-1">
          <span className="text-[10px] font-bold tracking-widest text-zinc-400">原子特效</span>
          <span className="ml-1.5 font-mono text-[8px] tracking-[0.15em] text-zinc-700">ATOMS</span>
        </div>
        {CATEGORY_META.map((cat) => {
          const list = filteredEffects.filter((e) => e.category === cat.id);
          if (list.length === 0) return null;
          return (
            <section key={cat.id}>
              <header className="mb-1 flex items-baseline gap-1.5 px-1">
                <span className="text-[10px] font-semibold tracking-wider text-zinc-500">
                  {cat.label}
                </span>
                <span className="font-mono text-[8px] tracking-[0.15em] text-zinc-700">
                  {cat.en}
                </span>
                <span className="ml-auto font-mono text-[9px] text-zinc-700">{list.length}</span>
              </header>
              <div className="space-y-1">
                {list.map((e) => (
                  <ResourceCard
                    key={e.id}
                    effect={e}
                    active={e.id === activeId && activePrefabId === null}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {filteredEffects.length === 0 && filteredPrefabs.length === 0 && (
          <p className="px-2 py-6 text-center text-[11px] text-zinc-600">无匹配资源</p>
        )}
      </div>

      {/* 底部提示 */}
      <div className="border-t border-zinc-800/80 px-3 py-2">
        <p className="text-[10px] leading-4 text-zinc-600">
          点击直接编辑，或将特效拖入右侧画布加载
        </p>
      </div>
    </aside>
  );
}

function ResourceCard({
  effect,
  active,
  onSelect,
}: {
  effect: EffectDef;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = ICONS[effect.id] ?? Sparkles;
  return (
    <button
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.setData(EFFECT_DRAG_MIME, effect.id);
        ev.dataTransfer.setData('text/plain', effect.id);
        ev.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onSelect(effect.id)}
      title={`${effect.name} · 点击编辑 / 拖入画布`}
      className={`group flex w-full cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors active:cursor-grabbing ${
        active
          ? 'border-orange-600/70 bg-orange-950/30'
          : 'border-zinc-800/70 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
          active ? 'bg-orange-900/50 text-orange-300' : 'bg-zinc-800/70 text-zinc-400'
        }`}
      >
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={`truncate text-xs font-semibold ${
              active ? 'text-orange-200' : 'text-zinc-300'
            }`}
          >
            {effect.name}
          </span>
          <span
            className={`shrink-0 rounded px-1 font-mono text-[8px] leading-3 ${
              effect.mode === 'continuous'
                ? 'bg-emerald-950/60 text-emerald-400/90'
                : 'bg-amber-950/60 text-amber-400/90'
            }`}
          >
            {effect.mode === 'continuous' ? '持续' : '爆发'}
          </span>
        </span>
        <span className="block truncate font-mono text-[8px] tracking-widest text-zinc-600">
          {effect.en}
        </span>
      </span>
      <GripVertical
        size={12}
        className="shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-60"
      />
    </button>
  );
}

function PrefabCard({
  prefab,
  active,
  onSelect,
}: {
  prefab: EffectPrefab;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = PREFAB_ICONS[prefab.id] ?? Cross;
  const accent = PREFAB_CAT_ACCENT[prefab.category] ?? 'text-orange-400';
  return (
    <button
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.setData(PREFAB_DRAG_MIME, prefab.id);
        ev.dataTransfer.setData('text/plain', prefab.id);
        ev.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onSelect(prefab.id)}
      title={`${prefab.name} · ${prefab.desc}`}
      className={`group flex w-full cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors active:cursor-grabbing ${
        active
          ? 'border-orange-600/70 bg-orange-950/30'
          : 'border-zinc-800/70 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
          active ? 'bg-orange-900/50 text-orange-300' : `bg-zinc-800/70 ${accent}`
        }`}
      >
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={`truncate text-xs font-semibold ${
              active ? 'text-orange-200' : 'text-zinc-300'
            }`}
          >
            {prefab.name}
          </span>
          <span className="shrink-0 rounded bg-violet-950/60 px-1 font-mono text-[8px] leading-3 text-violet-400/90">
            组合
          </span>
        </span>
        <span className="block truncate font-mono text-[8px] tracking-widest text-zinc-600">
          {prefab.en} · {(prefab.duration / 1000).toFixed(1)}s
        </span>
      </span>
      <GripVertical
        size={12}
        className="shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-60"
      />
    </button>
  );
}
