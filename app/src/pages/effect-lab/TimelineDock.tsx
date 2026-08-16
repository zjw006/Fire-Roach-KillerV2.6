/**
 * @fileoverview 特效编辑器时间轴坞（参考 Unreal Cascade / Unity Particle System 时间轴）
 * @description 预制体模式：多轨时间轴 —— 按步骤类型（特效/内联/贴图/文字/标注）分轨，
 *              色块表示步骤的时间窗口，播放头可点击/拖拽 seek（由父组件以固定步长快进模拟实现）。
 *              色块内叠加步骤自身的时间打点：shape 参数关键帧菱形点与结尾淡出遮罩、
 *              sprite 序列帧帧边界竖线、vfx 内部阶段/周期刻度（护士治疗三阶段带、
 *              定时炸弹引信爆炸点、史莱姆爆发/苍蝇拍循环周期线）。
 *              原子模式：生命周期曲线 —— Alpha（渲染统一线性淡出）与 Size over Lifetime
 *              （由物理配置 sizeDecay/sizeGrowth 推导的近似可视化，对应 Unity 的曲线模块）。
 *              仅供开发工具 EffectLab 使用，不参与游戏运行时逻辑。
 */

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BALANCE_CONFIG } from '@/game/data';
import { clamp } from './effectLabUtils';
import { SHAPE_KIND_META } from './prefabDefs';
import type { EffectPrefab, PrefabStep } from './prefabDefs';

/** 轨道顺序（自上而下）与步骤类型配色（与检查器步骤列表一致） */
const KIND_ORDER: PrefabStep['kind'][] = ['atom', 'custom', 'vfx', 'shape', 'sprite', 'text', 'marker'];
const KIND_COLOR: Record<PrefabStep['kind'], string> = {
  atom: '#fb923c',
  custom: '#f472b6',
  vfx: '#34d399',
  shape: '#fbbf24',
  sprite: '#c084fc',
  text: '#4ade80',
  marker: '#22d3ee',
};
const KIND_LABEL: Record<PrefabStep['kind'], string> = {
  atom: '特效',
  custom: '内联',
  vfx: '渲染',
  shape: '图形',
  sprite: '贴图',
  text: '文字',
  marker: '标注',
};

/** 步骤在时间轴上的可视窗口（ms）：持续型取 duration，瞬时型取 life，否则给最小可读宽度 */
function stepSpan(s: PrefabStep): number {
  if ((s.kind === 'atom' || s.kind === 'custom' || s.kind === 'vfx' || s.kind === 'shape') && s.duration) {
    return s.duration;
  }
  if (s.kind === 'text' || s.kind === 'marker') return s.life ?? 800;
  if (s.kind === 'sprite') {
    return s.life ?? (s.frames ? s.frames.length * (s.frameMs ?? 200) + 100 : 400);
  }
  return 150;
}

/** 步骤块内的摘要文字 */
function stepLabel(s: PrefabStep): string {
  switch (s.kind) {
    case 'atom':
      return `${s.atom}${s.count ? ` ×${s.count}` : ''}`;
    case 'custom':
      return s.fn;
    case 'vfx':
      return s.fn;
    case 'shape':
      return SHAPE_KIND_META[s.shape].label;
    case 'text':
      return s.text;
    case 'marker':
      return s.shape === 'circle' ? '○' : '▭';
    case 'sprite':
      return s.frames ? `序列帧×${s.frames.length}` : (s.src?.split('/').pop() ?? '贴图');
  }
}

/**
 * 步骤色块内的时间打点可视化（相对步骤窗口 at → at+span 定位）：
 * - shape / marker：keys 参数关键帧 → 底部菱形点（多参数同刻合并）；shape fadeOut → 末端暗化遮罩
 * - sprite：序列帧 → 每帧边界竖线（frameMs，默认 200ms）
 * - vfx nurseHealAura：charging/spraying/dissipating 三阶段色带 + 分界线
 * - vfx timedBomb：每个引信周期（fuseDuration）结束 → 爆炸竖线
 * - vfx slimeBurst / swatter：每次爆发/挥拍周期 → 循环刻度竖线
 */
function StepInnerMarks({ s, span }: { s: PrefabStep; span: number }) {
  if (span <= 0) return null;
  const toPct = (ms: number) => (ms / span) * 100;

  // shape / marker：参数关键帧菱形（shape 附加结尾淡出遮罩）
  if (s.kind === 'shape' || s.kind === 'marker') {
    const ts = new Set<number>();
    if (s.keys) {
      for (const arr of Object.values(s.keys)) {
        for (const k of arr ?? []) ts.add(Math.round(k.t * 100) / 100);
      }
    }
    // 菱形配色跟随轨道色（shape 琥珀 / marker 青）
    const dotColor = s.kind === 'marker' ? '#cffafe' : '#fef3c7';
    return (
      <>
        {s.kind === 'shape' && s.fadeOut > 0 && (
          <span
            className="absolute inset-y-0 right-0"
            style={{
              width: `${s.fadeOut * 100}%`,
              background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.5))',
            }}
          />
        )}
        {[...ts].map((t) => (
          <span
            key={t}
            className="absolute"
            style={{
              left: `${t * 100}%`,
              bottom: 1,
              width: 5,
              height: 5,
              transform: 'translateX(-50%) rotate(45deg)',
              background: dotColor,
              boxShadow: '0 0 3px rgba(0,0,0,0.9)',
            }}
          />
        ))}
      </>
    );
  }

  // sprite：序列帧帧边界竖线
  if (s.kind === 'sprite' && s.frames && s.frames.length > 1) {
    const frameMs = s.frameMs ?? 200;
    const lines: number[] = [];
    for (let i = 1; i < s.frames.length; i++) {
      const ms = i * frameMs;
      if (ms < span) lines.push(ms);
    }
    return (
      <>
        {lines.map((ms) => (
          <span
            key={ms}
            className="absolute inset-y-0 w-px"
            style={{ left: `${toPct(ms)}%`, background: 'rgba(255,255,255,0.22)' }}
          />
        ))}
      </>
    );
  }

  // vfx：护士治疗三阶段色带 + 分界线
  if (s.kind === 'vfx' && s.fn === 'nurseHealAura') {
    const ph = BALANCE_CONFIG.roachAI.nurseHealPhases;
    const ch = ph.charging * 1000;
    const sp = ch + ph.spraying * 1000;
    const chPct = Math.min(toPct(ch), 100);
    const spPct = Math.min(toPct(sp), 100);
    return (
      <>
        {/* charging 暗带 → spraying 亮带 → dissipating 保持底色渐隐 */}
        <span
          className="absolute inset-y-0 left-0"
          style={{ width: `${chPct}%`, background: 'rgba(0,0,0,0.28)' }}
        />
        <span
          className="absolute inset-y-0"
          style={{
            left: `${chPct}%`,
            width: `${Math.max(spPct - chPct, 0)}%`,
            background: 'rgba(255,255,255,0.10)',
          }}
        />
        {ch < span && (
          <span
            className="absolute inset-y-0 w-px"
            style={{ left: `${chPct}%`, background: 'rgba(255,255,255,0.45)' }}
          />
        )}
        {sp < span && (
          <span
            className="absolute inset-y-0 w-px"
            style={{ left: `${spPct}%`, background: 'rgba(255,255,255,0.45)' }}
          />
        )}
      </>
    );
  }

  // vfx：定时炸弹 —— 每个引信周期结束 = 爆炸点
  if (s.kind === 'vfx' && s.fn === 'timedBomb') {
    const fuse = BALANCE_CONFIG.timedBomb.placed.fuseDuration * 1000;
    const booms: number[] = [];
    for (let ms = fuse; ms < span; ms += fuse) booms.push(ms);
    return (
      <>
        {booms.map((ms) => (
          <span
            key={ms}
            className="absolute inset-y-0 w-[2px]"
            style={{ left: `${toPct(ms)}%`, background: 'rgba(254,202,202,0.7)' }}
          />
        ))}
      </>
    );
  }

  // vfx：史莱姆爆发 / 苍蝇拍 —— 每次爆发/挥拍周期刻度线
  if (s.kind === 'vfx' && (s.fn === 'slimeBurst' || s.fn === 'swatter')) {
    const cycleSec =
      s.fn === 'slimeBurst'
        ? BALANCE_CONFIG.slimeBurst.duration
        : BALANCE_CONFIG.render.renderUtils.swatter.animDuration;
    const cycle = cycleSec * 1000;
    if (cycle <= 0 || cycle >= span) return null;
    const marks: number[] = [];
    for (let ms = cycle; ms < span; ms += cycle) marks.push(ms);
    return (
      <>
        {marks.map((ms) => (
          <span
            key={ms}
            className="absolute inset-y-0 w-px"
            style={{ left: `${toPct(ms)}%`, background: 'rgba(255,255,255,0.3)' }}
          />
        ))}
      </>
    );
  }

  return null;
}

/** 原子模式生命周期曲线输入（父组件从物理配置推导） */
export interface LifeCurveInfo {
  /** 物理组路径（如 physics.ash），无物理组时为 null */
  physPath: string | null;
  /** 每帧大小乘数（sizeDecay 或 sizeGrowth），无则为 null（平直） */
  sizeFactorPerFrame: number | null;
  /** 粒子生命上限（秒），作为横轴范围 */
  lifeMax: number;
}

interface TimelineDockProps {
  mode: 'atom' | 'prefab';
  prefab: EffectPrefab | null;
  /** 当前播放头（ms，预制体模式） */
  elapsedMs: number;
  /** 拖拽 seek（预制体模式，父组件快进模拟到该时刻并暂停） */
  onSeek: (ms: number) => void;
  /** 原子模式曲线数据 */
  curve: LifeCurveInfo | null;
}

export function TimelineDock({ mode, prefab, elapsedMs, onSeek, curve }: TimelineDockProps) {
  return (
    <section className="flex h-[172px] shrink-0 flex-col border-t border-[#2c2c30] bg-[#1a1a1c]">
      <header className="flex h-7 shrink-0 items-center gap-2 border-b border-[#2c2c30] px-3">
        <span className="text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase">
          时间轴
        </span>
        <span className="font-mono text-[8px] tracking-[0.2em] text-zinc-700">
          {mode === 'prefab' ? 'TIMELINE' : 'LIFETIME CURVES'}
        </span>
        <span className="ml-auto font-mono text-[10px] text-zinc-500">
          {mode === 'prefab' && prefab ? (
            <>
              <span className="text-orange-300">{(elapsedMs / 1000).toFixed(2)}s</span>
              <span className="text-zinc-600"> / {(prefab.duration / 1000).toFixed(2)}s</span>
              <span className="ml-2 text-zinc-700">拖动播放头定位（定位后暂停）</span>
            </>
          ) : (
            <span className="text-zinc-700">由配置推导的近似曲线（渲染 Alpha 恒为线性淡出）</span>
          )}
        </span>
      </header>
      {mode === 'prefab' && prefab ? (
        <PrefabTracks prefab={prefab} elapsedMs={elapsedMs} onSeek={onSeek} />
      ) : (
        <AtomCurves curve={curve} />
      )}
    </section>
  );
}

// =========================================================================
// 预制体多轨时间轴
// =========================================================================

function PrefabTracks({
  prefab,
  elapsedMs,
  onSeek,
}: {
  prefab: EffectPrefab;
  elapsedMs: number;
  onSeek: (ms: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const duration = prefab.duration;
  const frac = clamp(elapsedMs / duration, 0, 1);

  /** 出现的步骤类型（按固定顺序） */
  const lanes = KIND_ORDER.filter((k) => prefab.steps.some((s) => s.kind === k));

  /** 刻度间隔：时长越短刻度越密 */
  const tickStep = duration <= 2000 ? 250 : duration <= 4000 ? 500 : 1000;
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= duration; t += tickStep) out.push(t);
    return out;
  }, [duration, tickStep]);

  const seekFromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const f = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    onSeek(Math.round(f * duration));
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekFromPointer(e);
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrubbing) seekFromPointer(e);
  };
  const handlePointerUp = () => setScrubbing(false);

  return (
    <div className="relative flex-1 select-none overflow-hidden px-3 pb-2 pt-1">
      {/* 左：轨道路标签列 + 右：轨道区（共享水平坐标系） */}
      <div className="flex h-full">
        {/* 标签列 */}
        <div className="flex w-12 shrink-0 flex-col">
          <div className="h-5 shrink-0" />
          {lanes.map((k) => (
            <div key={k} className="flex flex-1 items-center gap-1.5 pr-2">
              <span
                className="h-2 w-2 shrink-0 rounded-[3px]"
                style={{ background: KIND_COLOR[k] }}
              />
              <span className="truncate text-[10px] text-zinc-500">{KIND_LABEL[k]}</span>
            </div>
          ))}
        </div>

        {/* 轨道区（可点击/拖拽 seek） */}
        <div
          ref={trackRef}
          className={`relative flex-1 ${scrubbing ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* 刻度尺 */}
          <div className="relative h-5 shrink-0 border-b border-[#2c2c30]">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 h-full border-l border-[#2e2e33]"
                style={{ left: `${(t / duration) * 100}%` }}
              >
                <span className="absolute left-1 top-0 font-mono text-[8px] leading-4 text-zinc-600">
                  {(t / 1000).toFixed(tickStep < 500 ? 2 : 1)}s
                </span>
              </div>
            ))}
          </div>

          {/* 分轨色块 */}
          {lanes.map((k) => (
            <div key={k} className="relative flex-1 border-b border-[#242427] last:border-b-0">
              {prefab.steps.map((s, i) => {
                if (s.kind !== k) return null;
                const span = stepSpan(s);
                const left = (s.at / duration) * 100;
                const width = Math.max((span / duration) * 100, 0.8);
                const active = frac * duration >= s.at && frac * duration <= s.at + span;
                // 打点摘要（title）：shape/marker 关键帧数 / sprite 帧边界 / vfx 阶段刻度
                const keyCount =
                  (s.kind === 'shape' || s.kind === 'marker') && s.keys
                    ? Object.values(s.keys).reduce((n, a) => n + (a?.length ?? 0), 0)
                    : 0;
                const markInfo =
                  keyCount > 0
                    ? ` · ◆×${keyCount}`
                    : s.kind === 'sprite' && s.frames && s.frames.length > 1
                      ? ` · ${s.frames.length}帧@${s.frameMs ?? 200}ms`
                      : s.kind === 'vfx' && s.fn === 'nurseHealAura'
                        ? ' · 3阶段'
                        : '';
                return (
                  <div
                    key={i}
                    className="absolute top-1/2 flex h-[62%] -translate-y-1/2 items-center overflow-hidden rounded-[3px] px-1 transition-opacity"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      minWidth: 5,
                      background: `${KIND_COLOR[k]}${active ? '55' : '26'}`,
                      border: `1px solid ${KIND_COLOR[k]}${active ? '' : '66'}`,
                    }}
                    title={`${s.at}ms · ${KIND_LABEL[k]} · ${stepLabel(s)}${markInfo}`}
                  >
                    {/* 步骤内部时间打点层（关键帧/帧边界/阶段刻度），裁剪在色块内 */}
                    <span className="pointer-events-none absolute inset-0">
                      <StepInnerMarks s={s} span={span} />
                    </span>
                    <span
                      className="relative truncate font-mono text-[8px] leading-3"
                      style={{ color: KIND_COLOR[k] }}
                    >
                      {stepLabel(s)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          {/* 播放头 */}
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]"
            style={{ left: `${frac * 100}%` }}
          >
            <span className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-orange-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 原子模式：生命周期曲线（Alpha / Size over Lifetime）
// =========================================================================

function AtomCurves({ curve }: { curve: LifeCurveInfo | null }) {
  const lifeMax = curve?.lifeMax ?? 1;
  const factor = curve?.sizeFactorPerFrame ?? null;

  // Alpha：渲染层统一 alpha = life / maxLife（线性）
  const alphaFn = (t: number) => 1 - t;
  // Size：物理组每帧乘数 ^（帧率×秒）；无则平直
  const sizeFn = (t: number) => (factor == null ? 1 : Math.pow(factor, t * 60 * lifeMax));

  return (
    <div className="flex flex-1 items-stretch gap-4 overflow-hidden px-4 py-2">
      <CurveChart
        title="Alpha over Lifetime"
        sub="透明度 / 生命"
        color="#4ade80"
        fn={alphaFn}
        xMax={lifeMax}
        yMax={1}
        endLabel="1 → 0"
      />
      <CurveChart
        title="Size over Lifetime"
        sub={curve?.physPath ? `大小倍率 · ${curve.physPath}` : '大小倍率 · 无物理组'}
        color="#fb923c"
        fn={sizeFn}
        xMax={lifeMax}
        yMax={1.5}
        endLabel={
          factor == null
            ? '恒定'
            : `×${Math.pow(factor, 60 * lifeMax).toFixed(2)}（生命末）`
        }
      />
      <div className="ml-auto hidden max-w-[220px] flex-col justify-center gap-1 lg:flex">
        <p className="text-[10px] leading-4 text-zinc-600">
          曲线为配置的近似推导：Alpha 由渲染器按 life/maxLife 线性计算；Size 由物理组的
          sizeDecay / sizeGrowth 每帧乘数累计得出。
        </p>
        <p className="font-mono text-[9px] leading-4 text-zinc-700">
          横轴 0 ~ {lifeMax.toFixed(2)}s（lifeMax）
        </p>
      </div>
    </div>
  );
}

function CurveChart({
  title,
  sub,
  color,
  fn,
  xMax,
  yMax,
  endLabel,
}: {
  title: string;
  sub: string;
  color: string;
  fn: (t: number) => number;
  xMax: number;
  yMax: number;
  endLabel: string;
}) {
  const W2 = 200;
  const H2 = 74;
  const PAD = 6;
  const points = useMemo(() => {
    const N = 72;
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const v = clamp(fn(t), 0, yMax);
      const x = PAD + t * (W2 - PAD * 2);
      const y = PAD + (1 - v / yMax) * (H2 - PAD * 2 - 14);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, yMax]);

  return (
    <div className="flex flex-col rounded-md border border-[#2c2c30] bg-[#161618] px-2.5 py-1.5">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-mono text-[9px] font-semibold tracking-wider" style={{ color }}>
          {title}
        </span>
        <span className="text-[9px] text-zinc-600">{sub}</span>
        <span className="ml-auto font-mono text-[9px] text-zinc-500">{endLabel}</span>
      </div>
      <svg width={W2} height={H2} className="block">
        {/* 网格 */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={PAD}
            x2={W2 - PAD}
            y1={PAD + g * (H2 - PAD * 2 - 14)}
            y2={PAD + g * (H2 - PAD * 2 - 14)}
            stroke="#2a2a2e"
            strokeWidth={1}
          />
        ))}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            y1={PAD}
            y2={H2 - PAD - 14}
            x1={PAD + g * (W2 - PAD * 2)}
            x2={PAD + g * (W2 - PAD * 2)}
            stroke="#2a2a2e"
            strokeWidth={1}
          />
        ))}
        {/* 曲线 */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* 横轴标签 */}
        <text x={PAD} y={H2 - 2} fill="#52525b" fontSize={8} fontFamily="ui-monospace, monospace">
          0s
        </text>
        <text
          x={W2 - PAD}
          y={H2 - 2}
          fill="#52525b"
          fontSize={8}
          fontFamily="ui-monospace, monospace"
          textAnchor="end"
        >
          {xMax.toFixed(2)}s
        </text>
      </svg>
    </div>
  );
}
