/**
 * @fileoverview 特效编辑器（开发工具，/effect-lab）
 * @description 参考 Unity Particle System / Unreal Cascade 的引擎编辑器界面形式：
 *              - 左 dock：资源库（原子特效 + 特效预制体，可搜索/拖拽加载）
 *              - 中栏：视口（Simulate 模拟控制条：播放/暂停/重播/单帧步进/倍速 + 视口显示开关）
 *              - 右 dock：检查器（Unity 模块风格的可折叠参数面板，原地写入 BALANCE_CONFIG）
 *              - 底部：时间轴坞（预制体 = 多轨时间轴可拖拽 seek；原子 = 生命周期曲线）
 *              - 底部状态栏：模式 / 配置路径 / 画布 / 时钟 / FPS / 粒子数
 *              模拟层复用游戏同一套 ParticleSpawner + ParticleSystem 管线，
 *              固定步长（DT = 1/60）+ 虚拟时钟驱动，预制体 seek 通过清空后快进模拟实现。
 *              路由：/effect-lab
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  Contrast,
  Download,
  FileDown,
  Grid3x3,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SeparatorHorizontal,
  StepForward,
  Trash2,
  Undo2,
} from 'lucide-react';
import { BALANCE_CONFIG } from '@/game/data';
import { ParticleSpawner } from '@/game/engine/particle/ParticleSpawner';
import { ParticleSystem } from '@/game/engine/particle/ParticleSystem';
import { NurseRenderer } from '@/game/engine/render/NurseRenderer';
import { ParticleType, type FireZone } from '@/game/types';
import { ParamPanel } from './ParamPanel';
import { EFFECT_DRAG_MIME, PREFAB_DRAG_MIME, ResourceExplorer } from './ResourceExplorer';
import {
  backupBaitCfg,
  backupBombExplosionCfg,
  backupCfg,
  backupFanCfg,
  backupRenderCfg,
  backupTimedBombCfg,
  EFFECTS,
  PREFAB_CONFIG_SECTIONS,
  baitCfg,
  bombExplosionCfg,
  fanCfg,
  particleCfg,
  renderCfg,
  sectionsForAtoms,
  timedBombCfg,
  type ConeVariant,
  type EffectDef,
} from './effectDefs';
import {
  PREFABS,
  SHAPE_KEY_META,
  SHAPE_KIND_META,
  type KeyframableStep,
  type Keyframe,
  type MarkerStep,
  type PrefabStep,
  type ShapeKeyParam,
  type ShapeKind,
  type ShapeStep,
} from './prefabDefs';
import { PrefabPlayer } from './prefabRuntime';
import { TimelineDock, type LifeCurveInfo } from './TimelineDock';
import {
  clamp,
  deepAssign,
  exportEffectSnippet,
  exportParticleSnippet,
  toTsLiteral,
  type AnyRecord,
} from './effectLabUtils';

/** 预览画布逻辑尺寸（与游戏一致的 540 逻辑宽） */
const W = 540;
const H = 800;
/** 固定步长（与引擎一致：deltaTime = 0.016） */
const DT = 1 / 60;
/** 防线 Y（与游戏 height - 130 一致） */
const DEFENSE_Y = H - 130;
/** seek 快进的最大模拟步数（防止超长预制体卡死） */
const MAX_SEEK_STEPS = 720;
/** 每帧最大补偿步数（防止倍速下螺旋失速） */
const MAX_FRAME_STEPS = 8;

/** 视口显示选项 */
interface ViewOpts {
  grid: boolean;
  defense: boolean;
  bg: 'scene' | 'black' | 'checker';
}

/** 绘制预览场景背景（视口选项驱动） */
function drawScene(ctx: CanvasRenderingContext2D, view: ViewOpts) {
  if (view.bg === 'scene') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#101014');
    g.addColorStop(1, '#1b140d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (view.bg === 'black') {
    // 纯黑：检验 screen/发光混合的真实观感（同 Unity 视口的黑色背景）
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
  } else {
    // 棋盘格：检验半透明粒子的覆盖表现
    const cell = 27;
    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        ctx.fillStyle = ((x / cell + y / cell) | 0) % 2 === 0 ? '#151517' : '#1a1a1d';
        ctx.fillRect(x, y, cell, cell);
      }
    }
  }

  if (view.grid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 54; x < W; x += 54) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 54; y < H; y += 54) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  }

  if (view.defense) {
    ctx.strokeStyle = 'rgba(255, 150, 60, 0.45)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, DEFENSE_Y);
    ctx.lineTo(W, DEFENSE_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 150, 60, 0.5)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('防线 DEFENSE LINE', 8, DEFENSE_Y + 16);
  }
}

/** 触发参数默认值（HMR 热更新后旧状态可能缺新特效，需防御性回退） */
function defaultTriggers(d: EffectDef): Record<string, number> {
  return Object.fromEntries(d.triggers.map((t) => [t.key, t.defaultValue]));
}

/** 导出弹窗内容 */
interface ExportData {
  title: string;
  hint: string;
  code: string;
  filename: string;
}

/** 预制体步骤在检查器步骤列表中的颜色 */
const STEP_KIND_COLOR: Record<PrefabStep['kind'], string> = {
  atom: '#fb923c',
  text: '#4ade80',
  marker: '#22d3ee',
  sprite: '#c084fc',
  custom: '#f472b6',
  vfx: '#34d399',
  shape: '#fbbf24',
};

const STEP_KIND_LABEL: Record<PrefabStep['kind'], string> = {
  atom: '特效',
  text: '文字',
  marker: '标注',
  sprite: '贴图',
  custom: '内联',
  vfx: '渲染',
  shape: '图形',
};

/** 步骤摘要（检查器步骤列表一行） */
function stepSummary(s: PrefabStep): string {
  switch (s.kind) {
    case 'atom':
      return `${s.atom}${s.count ? ` ×${s.count}` : ''}${s.duration ? ` ${s.duration}ms` : ''}`;
    case 'text':
      return s.text;
    case 'marker': {
      const base = s.shape === 'circle' ? `圆 r=${s.r ?? 20}` : `矩形 ${s.w}×${s.h}`;
      // 参数打点徽标：keys 存在时附加 ◆×N
      const keyCount = s.keys
        ? Object.values(s.keys).reduce((n, a) => n + (a?.length ?? 0), 0)
        : 0;
      return keyCount > 0 ? `${base} ◆×${keyCount}` : base;
    }
    case 'sprite':
      return s.frames ? `序列帧 ×${s.frames.length}` : (s.src?.split('/').pop() ?? '贴图');
    case 'custom':
      return s.fn;
    case 'vfx':
      return `${s.fn} ${s.duration}ms`;
    case 'shape': {
      // 尺寸：rect 显 w×h，圆/环/三角显 r
      const size = s.shape === 'rect' ? ` ${s.w}×${s.h}` : ` r=${s.r}`;
      const grad = s.gradient === 'radial' ? ' 径向渐变' : '';
      // 扩散粒子徽标：✦颗数@生命
      const bolt = s.sparks ? ` ✦×${s.sparks.count}@${s.sparks.life}ms` : '';
      // 参数打点徽标：keys 存在时附加 ◆×N
      const keyCount = s.keys
        ? Object.values(s.keys).reduce((n, a) => n + (a?.length ?? 0), 0)
        : 0;
      const keyBadge = keyCount > 0 ? ` ◆×${keyCount}` : '';
      return `${SHAPE_KIND_META[s.shape].label}${size}${grad}${bolt}${keyBadge}`;
    }
  }
}

/** 倍速档位 */
const TIME_SCALES = [0.25, 0.5, 1, 2];

export default function EffectLabPage() {
  const [activeId, setActiveId] = useState(EFFECTS[0].id);
  const [activePrefabId, setActivePrefabId] = useState<string | null>(null);
  const [variant, setVariant] = useState<ConeVariant>('fire');
  const [trigValues, setTrigValues] = useState<Record<string, Record<string, number>>>(() =>
    Object.fromEntries(EFFECTS.map((d) => [d.id, defaultTriggers(d)])),
  );
  const [hud, setHud] = useState({ fps: 0, count: 0, elapsed: 0 });
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [, setVersion] = useState(0);
  /** 模拟控制（UI 镜像，真值在 simRef 供 RAF 循环读取） */
  const [simUI, setSimUI] = useState({ paused: false, timeScale: 1 });
  /** 视口显示选项 */
  const [view, setView] = useState<ViewOpts>({ grid: true, defense: true, bg: 'scene' });
  /** 用户通过「添加 Canvas2D 图形」追加到预制体时间轴的自由图形步骤（key = 预制体 id，会话内有效） */
  const [extraSteps, setExtraSteps] = useState<Record<string, ShapeStep[]>>({});
  /** 当前选中编辑的自由图形步骤下标（在当前预制体 extraSteps 数组内；null = 未选中） */
  const [selectedExtraIdx, setSelectedExtraIdx] = useState<number | null>(null);
  /** 内置步骤的编辑器覆盖补丁（key = 预制体 id → 步骤下标 → 补丁；标注打点/参数修改合并进有效预制体，不改内置配方常量） */
  const [stepOverrides, setStepOverrides] = useState<
    Record<string, Record<number, Partial<PrefabStep>>>
  >({});
  /** 当前选中编辑的内置标注步骤下标（在 prefab.steps 内；null = 未选中） */
  const [selectedMarkerIdx, setSelectedMarkerIdx] = useState<number | null>(null);
  /** 当前选中编辑的内置图形步骤下标（在 prefab.steps 内，如气体护盾光带；null = 未选中） */
  const [selectedBaseShapeIdx, setSelectedBaseShapeIdx] = useState<number | null>(null);
  /** 「添加 Canvas2D 图形」形状选择器展开态 */
  const [shapePickerOpen, setShapePickerOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trigRef = useRef(trigValues);
  const variantRef = useRef(variant);
  const viewRef = useRef(view);
  trigRef.current = trigValues;
  variantRef.current = variant;
  viewRef.current = view;

  /** 模拟控制真值（RAF 闭包读取）：paused 冻结模拟；step 为单帧步进请求 */
  const simRef = useRef({ paused: false, timeScale: 1, step: false });
  /** seek / restart 由预览循环闭包实现，通过 ref 暴露给 UI */
  const seekRef = useRef<(ms: number) => void>(() => {});
  const restartRef = useRef<() => void>(() => {});

  const def = EFFECTS.find((d) => d.id === activeId) ?? EFFECTS[0];
  const prefab = activePrefabId ? (PREFABS.find((p) => p.id === activePrefabId) ?? null) : null;
  const bump = () => setVersion((v) => v + 1);

  /** 合并内置步骤覆盖补丁 + 用户追加的自由图形步骤后的有效预制体（预览/步骤列表/导出共用） */
  const effectivePrefab = useMemo(() => {
    if (!prefab) return null;
    const ov = stepOverrides[prefab.id] ?? {};
    const hasOv = Object.keys(ov).length > 0;
    const base = hasOv
      ? prefab.steps.map((s, i) => (ov[i] ? ({ ...s, ...ov[i] } as PrefabStep) : s))
      : prefab.steps;
    const extra = extraSteps[prefab.id] ?? [];
    return hasOv || extra.length > 0 ? { ...prefab, steps: [...base, ...extra] } : prefab;
  }, [prefab, extraSteps, stepOverrides]);

  /** 当前选中的自由图形步骤（随 extraSteps 更新实时反映最新参数） */
  const selectedShape: ShapeStep | null =
    prefab && selectedExtraIdx != null
      ? ((extraSteps[prefab.id] ?? [])[selectedExtraIdx] ?? null)
      : null;

  /** 当前选中的内置标注步骤（取合并覆盖补丁后的最新值，随 stepOverrides 更新实时反映） */
  const selectedMarker: MarkerStep | null = (() => {
    if (!prefab || selectedMarkerIdx == null || selectedMarkerIdx >= prefab.steps.length) {
      return null;
    }
    const s = effectivePrefab?.steps[selectedMarkerIdx];
    return s && s.kind === 'marker' ? s : null;
  })();

  /** 当前选中的内置图形步骤（取合并覆盖补丁后的最新值，随 stepOverrides 更新实时反映） */
  const selectedBaseShape: ShapeStep | null = (() => {
    if (!prefab || selectedBaseShapeIdx == null || selectedBaseShapeIdx >= prefab.steps.length) {
      return null;
    }
    const s = effectivePrefab?.steps[selectedBaseShapeIdx];
    return s && s.kind === 'shape' ? s : null;
  })();

  /** 修改内置步骤参数（标注打点/数值补丁写入 stepOverrides，合并进有效预制体随 steps 一并导出） */
  const updateBaseStep = (prefabId: string, idx: number, patch: Partial<PrefabStep>) => {
    setStepOverrides((prev) => ({
      ...prev,
      [prefabId]: {
        ...(prev[prefabId] ?? {}),
        // 判别联合的 Partial 展开合并后需断言回 Partial<PrefabStep>
        [idx]: { ...(prev[prefabId]?.[idx] ?? {}), ...patch } as Partial<PrefabStep>,
      },
    }));
  };

  /** 向当前预制体追加一个 Canvas2D 自由图形步骤（at=0 起，参数取 SHAPE_KIND_META 默认值）并选中 */
  const addShapeStep = (kind: ShapeKind) => {
    if (!prefab) return;
    const meta = SHAPE_KIND_META[kind];
    const step: ShapeStep = { kind: 'shape', shape: kind, at: 0, ...meta.defaults };
    setExtraSteps((prev) => {
      const list = [...(prev[prefab.id] ?? []), step];
      setSelectedExtraIdx(list.length - 1);
      return { ...prev, [prefab.id]: list };
    });
    setSelectedMarkerIdx(null);
    setSelectedBaseShapeIdx(null);
  };

  /** 修改追加图形步骤的参数（时序 at/duration 及形状/大小/颜色/动画等全部实例参数） */
  const updateExtraStep = (prefabId: string, idx: number, patch: Partial<ShapeStep>) => {
    setExtraSteps((prev) => ({
      ...prev,
      [prefabId]: (prev[prefabId] ?? []).map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  /** 移除追加图形步骤（若移除的是选中项或使其下标失效，同步修正选中态） */
  const removeExtraStep = (prefabId: string, idx: number) => {
    setExtraSteps((prev) => ({
      ...prev,
      [prefabId]: (prev[prefabId] ?? []).filter((_, i) => i !== idx),
    }));
    setSelectedExtraIdx((sel) => {
      if (sel == null) return sel;
      if (sel === idx) return null;
      return sel > idx ? sel - 1 : sel;
    });
  };

  /**
   * 参数修改回调：使渲染器预计算缓存失效（NurseRenderer 刻度数据依赖配置）并触发 UI 刷新。
   * 配置原地写入 BALANCE_CONFIG，预览循环每帧读取，无需额外同步。
   */
  const handleConfigChange = () => {
    NurseRenderer.invalidateTickCache();
    bump();
  };

  /**
    * 预制体检查器参数节：原子共享组 + 预制体专属渲染配置节（如护士光环 nurseHealVFX）。
    * 自由图形（shape 步骤）的参数存于步骤实例本身，不注册到此处（单独显示于「图形参数」模块）。
    */
   const prefabSections = useMemo(() => {
      if (!prefab) return [];
      const seen = new Set<string>();
      const out = sectionsForAtoms(prefab.atoms);
      for (const sec of out) seen.add(`${sec.path}|${sec.title}`);
      for (const sec of PREFAB_CONFIG_SECTIONS[prefab.id] ?? []) {
        const key = `${sec.path}|${sec.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(sec);
      }
      return out;
    }, [prefab]);

  const updateSim = (patch: Partial<{ paused: boolean; timeScale: number }>) => {
    Object.assign(simRef.current, patch);
    setSimUI((s) => ({ ...s, ...patch }));
  };

  const selectAtom = (id: string) => {
    setActiveId(id);
    setActivePrefabId(null);
  };
  const selectPrefab = (id: string) => {
    setActivePrefabId(id);
    setSelectedMarkerIdx(null);
  };

  /** 原子模式生命周期曲线数据：从首个物理组推导大小乘数，从首个生成组取 lifeMax */
  const curveInfo: LifeCurveInfo | null = (() => {
    if (prefab) return null;
    const physSec = def.sections.find((s) => s.path.startsWith('physics.'));
    const physObj = physSec?.obj as AnyRecord | undefined;
    const factor =
      physObj && typeof physObj.sizeDecay === 'number'
        ? (physObj.sizeDecay as number)
        : physObj && typeof physObj.sizeGrowth === 'number'
          ? (physObj.sizeGrowth as number)
          : null;
    const spawnObj = def.sections.find((s) => !s.path.startsWith('physics.'))?.obj as
      | AnyRecord
      | undefined;
    const lifeMax =
      typeof spawnObj?.lifeMax === 'number'
        ? (spawnObj.lifeMax as number)
        : typeof spawnObj?.streamLifeMax === 'number'
          ? (spawnObj.streamLifeMax as number)
          : 1;
    return { physPath: physSec?.path ?? null, sizeFactorPerFrame: factor, lifeMax };
  })();

  // ========== 预览循环：虚拟时钟 + 固定步长，复用游戏同一套生成/更新/渲染管线 ==========
  useEffect(() => {
    // 预览使用合并了追加 Canvas2D 步骤的有效预制体（extraSteps 变化时本 effect 重建并重播）
    const prefab = effectivePrefab;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const sys = new ParticleSystem({
      particleLimit: 3000,
      deltaTime: DT,
      defenseLineY: DEFENSE_Y,
      canvasWidth: W,
      canvasHeight: H,
    });
    const particles = sys.getParticles();
    const fireZones: FireZone[] = [];

    // 预制体模式：装载时序播放器（合成时钟：startMs = 0，与 clock.vNow 同原点）
    const player = prefab ? new PrefabPlayer() : null;
    if (player && prefab) player.play(prefab, 0);

    /** 虚拟时钟：vNow 为模拟时间（ms），acc 为固定步长累加器（秒） */
    const clock = { vNow: 0, acc: 0, last: performance.now() };
    let lastBurst = -1e9;

    // 切换特效/预制体时恢复播放态
    simRef.current.paused = false;
    simRef.current.step = false;
    setSimUI((s) => ({ ...s, paused: false }));

    /** 单步固定模拟（生成 + 更新），推进时钟由调用方负责 */
    const tick = () => {
      if (player && prefab) {
        player.update(clock.vNow, particles, fireZones);
      } else {
        const t = trigRef.current[def.id] ?? defaultTriggers(def);
        if (def.mode === 'continuous') {
          if (def.id === 'coneFire') {
            // 锥形火焰：每帧持续喷射（与游戏中按住喷火一致）
            ParticleSpawner.spawnConeFire({
              particles,
              fireZones,
              deltaTime: DT,
              x: W / 2,
              y: H - 150,
              angle: -Math.PI / 2,
              range: t.range ?? 200,
              baseDamage: 0,
              type: variantRef.current,
            });
          } else if (def.id === 'shieldRepair') {
            // 护盾修复：按帧概率生成（复刻 RoachAISystem 内联逻辑）
            const rc = particleCfg.shieldRepair;
            if (Math.random() < rc.emitter.spawnChance) {
              const life = rc.lifeMin + Math.random() * (rc.lifeMax - rc.lifeMin);
              particles.push({
                x: W / 2 + (Math.random() - 0.5) * 30,
                y: H * 0.45 + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 20,
                vy: -(rc.speedMin + Math.random() * (rc.speedMax - rc.speedMin)),
                life,
                maxLife: life,
                size: rc.sizeMin + Math.random() * (rc.sizeMax - rc.sizeMin),
                color: rc.color,
                type: ParticleType.SPARK,
              });
            }
          }
        } else if (clock.vNow - lastBurst >= (t.interval ?? 1000)) {
          lastBurst = clock.vNow;
          if (def.id === 'explosion') {
            ParticleSpawner.spawnExplosionParticles(particles, W / 2, H * 0.42, t.count);
          } else if (def.id === 'shockwave') {
            ParticleSpawner.spawnShockwaveRing(particles, W / 2, H * 0.42, t.count);
          } else if (def.id === 'smoke') {
            ParticleSpawner.spawnSmokeParticles(particles, W / 2, H * 0.45, t.count);
          } else if (def.id === 'fireRing') {
            ParticleSpawner.spawnFireRingParticles(particles, W / 2, H * 0.42, t.count);
          } else if (def.id === 'lightning') {
            ParticleSpawner.spawnLightningParticles(particles, W / 2, 30, W * 0.95, H * 0.8);
          } else if (def.id === 'ash') {
            ParticleSpawner.spawnAshParticles(particles, W / 2, H * 0.42, t.count);
          } else if (def.id === 'blood') {
            ParticleSpawner.spawnBloodParticles(particles, W / 2, H * 0.5, t.count);
          } else if (def.id === 'spark') {
            ParticleSpawner.spawnSparkParticles(particles, W / 2, H * 0.45, t.count);
          } else if (def.id === 'debris') {
            ParticleSpawner.spawnDebrisParticles(particles, W / 2, H * 0.45, t.count);
          } else if (def.id === 'armorSpray') {
            const fx = W / 2 - 110;
            const fy = H * 0.52;
            const tx = W / 2 + 90;
            const ty = H * 0.4;
            ParticleSpawner.spawnArmorSprayStream(particles, fx, fy, tx, ty);
            ParticleSpawner.spawnArmorHealPlus(particles, tx, ty);
          }
        }
      }
      sys.update([]);
    };

    /** 重播：清空粒子与调度状态，时钟归零 */
    restartRef.current = () => {
      particles.length = 0;
      fireZones.length = 0;
      clock.vNow = 0;
      clock.acc = 0;
      lastBurst = -1e9;
      if (player && prefab) player.play(prefab, 0);
    };

    /** seek（预制体时间轴拖拽）：清空后从 0 快进模拟到目标时刻，随后暂停在该帧 */
    seekRef.current = (ms: number) => {
      if (!player || !prefab) return;
      particles.length = 0;
      fireZones.length = 0;
      player.play(prefab, 0);
      const target = Math.max(0, Math.min(ms, prefab.duration));
      const steps = Math.min(Math.floor(target / (DT * 1000)), MAX_SEEK_STEPS);
      clock.vNow = 0;
      for (let i = 0; i < steps; i++) {
        clock.vNow = i * DT * 1000;
        tick();
      }
      clock.vNow = target;
      clock.acc = 0;
      simRef.current.paused = true;
      simRef.current.step = false;
      setSimUI((s) => ({ ...s, paused: true }));
      setHud((h) => ({ ...h, elapsed: target }));
    };

    let raf = 0;
    let fps = 60;
    let lastHud = 0;

    const frame = (now: number) => {
      const realDt = Math.min(Math.max((now - clock.last) / 1000, 1e-4), 0.1);
      clock.last = now;
      fps = fps * 0.95 + (1 / realDt) * 0.05;

      const sim = simRef.current;
      if (sim.step) {
        // 单帧步进：恰好推进一个固定步长（暂停态下可用）
        sim.step = false;
        clock.vNow += DT * 1000;
        tick();
      } else if (!sim.paused) {
        // 固定步长累加器：倍速通过每帧多步/隔帧单步实现，保证模拟确定性
        clock.acc += realDt * sim.timeScale;
        let n = 0;
        while (clock.acc >= DT && n < MAX_FRAME_STEPS) {
          clock.acc -= DT;
          clock.vNow += DT * 1000;
          tick();
          n++;
        }
        if (n >= MAX_FRAME_STEPS) clock.acc = 0;
      }

      // ===== 渲染 =====
      const v = viewRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, v);

      if (player && prefab) {
        player.renderMarkers(ctx, clock.vNow); // 标注在粒子层之下
        player.renderVfx(ctx, clock.vNow); // 渲染器直连特效（护士光环等地面效果）
        ParticleSystem.renderParticles(ctx, particles);
        player.renderSprites(ctx, clock.vNow); // 序列帧贴图在粒子层之上
        player.renderShapes(ctx, clock.vNow); // 自由图形在贴图之上（叠加元素）
        player.renderTexts(ctx); // 浮动文字最上层
        // 锚点十字
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(prefab.anchor.x - 7, prefab.anchor.y);
        ctx.lineTo(prefab.anchor.x + 7, prefab.anchor.y);
        ctx.moveTo(prefab.anchor.x, prefab.anchor.y - 7);
        ctx.lineTo(prefab.anchor.x, prefab.anchor.y + 7);
        ctx.stroke();
      } else {
        ParticleSystem.renderParticles(ctx, particles);

        if (def.id === 'coneFire') {
          // 喷嘴标记
          ctx.fillStyle = 'rgba(255, 200, 120, 0.9)';
          ctx.beginPath();
          ctx.arc(W / 2, H - 150, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        if (def.id === 'armorSpray') {
          // 喷涂源/目标标记
          ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
          ctx.beginPath();
          ctx.arc(W / 2 - 110, H * 0.52, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(203, 213, 225, 0.9)';
          ctx.beginPath();
          ctx.arc(W / 2 + 90, H * 0.4, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (def.id === 'shieldRepair') {
          // 修复锚点标记
          ctx.fillStyle = 'rgba(103, 232, 249, 0.8)';
          ctx.beginPath();
          ctx.arc(W / 2, H * 0.45, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (now - lastHud > 100) {
        lastHud = now;
        const elapsed =
          player && prefab ? player.progress(clock.vNow).elapsed : clock.vNow;
        setHud({ fps: Math.round(fps), count: sys.getParticleCount(), elapsed });
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      seekRef.current = () => {};
      restartRef.current = () => {};
      cancelAnimationFrame(raf);
    };
  }, [def.id, effectivePrefab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== 拖拽加载特效/预制体 ==========
  const dropHandlers = {
    onDragOver: (e: DragEvent) => {
      if (
        e.dataTransfer.types.includes(EFFECT_DRAG_MIME) ||
        e.dataTransfer.types.includes(PREFAB_DRAG_MIME)
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOver(true);
      }
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
    },
    onDrop: (e: DragEvent) => {
      const effectId = e.dataTransfer.getData(EFFECT_DRAG_MIME);
      const prefabId = e.dataTransfer.getData(PREFAB_DRAG_MIME);
      if (prefabId && PREFABS.some((p) => p.id === prefabId)) {
        e.preventDefault();
        selectPrefab(prefabId);
      } else if (effectId && EFFECTS.some((d) => d.id === effectId)) {
        e.preventDefault();
        selectAtom(effectId);
      }
      setDragOver(false);
    },
  };

  // ========== 操作 ==========
  const handleReset = () => {
    if (!window.confirm('重置所有粒子/渲染参数为代码初始值？（未导出的修改将丢失）')) return;
    deepAssign(particleCfg, backupCfg);
    deepAssign(renderCfg, backupRenderCfg);
    deepAssign(fanCfg, backupFanCfg);
    deepAssign(baitCfg, backupBaitCfg);
    deepAssign(timedBombCfg, backupTimedBombCfg);
    deepAssign(bombExplosionCfg, backupBombExplosionCfg);
    NurseRenderer.invalidateTickCache();
    bump();
  };

  const handleExportAll = () => {
    setExportData({
      title: '导出 particle 全量配置',
      hint: '整体替换 render-balance.ts 中的 particle 节点',
      code: exportParticleSnippet(particleCfg),
      filename: 'particle-config.ts',
    });
    setCopied(false);
  };

  const handleExportEffect = () => {
    setExportData({
      title: `导出特效「${def.name}」配置`,
      hint: '按键合并回 render-balance.ts 的 particle 节点（共享组影响见片段内注释）',
      code: exportEffectSnippet(def.name, def.en, def.sections, particleCfg),
      filename: `effect-${def.id}.ts`,
    });
    setCopied(false);
  };

  const handleExportPrefab = () => {
    if (!prefab || !effectivePrefab) return;
    // 参数节与检查器面板同一份（prefabSections）；按「path 是否可解析于 particle 节点」拆回两条导出通道：
    // - particle 通道（atom 原子组，root=particleCfg，如 coneFire / physics.*）
    // - 渲染/系统通道（root=BALANCE_CONFIG 按顶层分组，如 render.* / fan / subway —— 护盾高度在此通道）
    const resolvesInParticle = (path: string) => {
      let cur: unknown = particleCfg;
      for (const seg of path.split('.')) {
        if (cur == null || typeof cur !== 'object') return false;
        cur = (cur as AnyRecord)[seg];
      }
      return cur != null && typeof cur === 'object';
    };
    const atomSections = prefabSections.filter((s) => resolvesInParticle(s.path));
    const renderSections = prefabSections.filter((s) => !resolvesInParticle(s.path));
    const addedCount = effectivePrefab.steps.length - prefab.steps.length;
    const overrideCount = Object.keys(stepOverrides[prefab.id] ?? {}).length;
    const configParts: string[] = [];
    if (atomSections.length > 0) {
      configParts.push(exportEffectSnippet(prefab.name, prefab.en, atomSections, particleCfg));
    }
    if (renderSections.length > 0) {
      // 渲染/系统配置节的 path 相对 BALANCE_CONFIG 根（render.* / fan 等），按顶层节点分组导出
      const groups = new Map<string, typeof renderSections>();
      for (const sec of renderSections) {
        const top = sec.path.split('.')[0];
        const arr = groups.get(top) ?? [];
        arr.push(sec);
        groups.set(top, arr);
      }
      for (const [top, secs] of groups) {
        configParts.push(
          exportEffectSnippet(prefab.name, prefab.en, secs, BALANCE_CONFIG as unknown as AnyRecord, top),
        );
      }
    }
    const stepsPart = toTsLiteral(
      {
        id: prefab.id,
        duration: prefab.duration,
        anchor: prefab.anchor,
        steps: effectivePrefab.steps,
      },
      2,
    );
    setExportData({
      title: `导出预制体「${prefab.name}」`,
      hint: `粒子/渲染参数合并回 render-balance.ts 对应节点；steps 时序配方供核对/复刻${
        addedCount > 0 ? `（含 ${addedCount} 个追加的 Canvas2D 自由图形步骤）` : ''
      }${overrideCount > 0 ? `（含 ${overrideCount} 处内置步骤参数覆盖/打点）` : ''}`,
      code: `${configParts.join('\n')}\n// ===== 预制体时序配方（${prefab.source}） =====\nconst prefab = ${stepsPart}\n`,
      filename: `prefab-${prefab.id}.ts`,
    });
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!exportData) return;
    try {
      await navigator.clipboard.writeText(exportData.code);
      setCopied(true);
    } catch {
      // 剪贴板不可用时用户可直接全选文本框复制
    }
  };

  const handleDownload = () => {
    if (!exportData) return;
    const blob = new Blob([exportData.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportData.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cycleTimeScale = () => {
    const i = TIME_SCALES.indexOf(simUI.timeScale);
    updateSim({ timeScale: TIME_SCALES[(i + 1) % TIME_SCALES.length] });
  };

  const cycleBg = () => {
    setView((v) => ({
      ...v,
      bg: v.bg === 'scene' ? 'black' : v.bg === 'black' ? 'checker' : 'scene',
    }));
  };

  const bgLabel = { scene: '场景', black: '纯黑', checker: '棋盘' }[view.bg];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#161617] text-zinc-300">
      {/* ===== 顶部工具栏 ===== */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[#2c2c30] bg-[#1c1c1f] px-4">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-orange-600/90 font-mono text-[10px] font-bold text-white">
          FX
        </span>
        <div className="flex items-baseline gap-2">
          <h1 className="text-[13px] font-bold tracking-wide text-zinc-100">特效编辑器</h1>
          <span className="font-mono text-[9px] tracking-[0.25em] text-orange-500/80">
            EFFECT LAB
          </span>
        </div>
        <span className="rounded border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-[9px] text-amber-500">
          DEV ONLY
        </span>
        <span className="font-mono text-[9px] text-zinc-600">/effect-lab</span>

        <div className="ml-auto flex items-center gap-1.5">
          <ToolButton onClick={handleExportEffect} disabled={!!prefab} title="导出当前特效配置">
            <FileDown size={12} />
            导出当前
          </ToolButton>
          <ToolButton onClick={handleExportAll} title="导出 particle 全量配置">
            <Download size={12} />
            导出全部
          </ToolButton>
          <div className="mx-1 h-4 w-px bg-[#2c2c30]" />
          <ToolButton onClick={handleReset} title="重置所有参数为代码初始值">
            <Undo2 size={12} />
            重置
          </ToolButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ===== 左 dock：资源库 ===== */}
        <ResourceExplorer
          effects={EFFECTS}
          activeId={activeId}
          onSelect={selectAtom}
          prefabs={PREFABS}
          activePrefabId={activePrefabId}
          onSelectPrefab={selectPrefab}
        />

        {/* ===== 中栏：视口 + 时间轴 ===== */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Simulate 模拟控制条（参考 Unity 场景视口工具条） */}
          <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[#2c2c30] bg-[#1c1c1f] px-2">
            <span className="mr-1 font-mono text-[9px] tracking-[0.2em] text-zinc-600">
              SIMULATE
            </span>
            <SimButton
              onClick={() => updateSim({ paused: !simUI.paused })}
              title={simUI.paused ? '播放 (Play)' : '暂停 (Pause)'}
              active={!simUI.paused}
            >
              {simUI.paused ? <Play size={12} /> : <Pause size={12} />}
            </SimButton>
            <SimButton onClick={() => restartRef.current()} title="重播 (Restart)">
              <RotateCcw size={12} />
            </SimButton>
            <SimButton
              onClick={() => {
                simRef.current.step = true;
              }}
              title="单帧步进 (Step，1/60s)"
            >
              <StepForward size={12} />
            </SimButton>
            <button
              onClick={cycleTimeScale}
              title="模拟倍速（固定步长累加，慢放不丢细节）"
              className="ml-1 rounded border border-[#333338] bg-[#242428] px-2 py-1 font-mono text-[10px] text-orange-200 transition-colors hover:border-orange-600/60"
            >
              {simUI.timeScale}×
            </button>

            <div className="mx-2 h-4 w-px bg-[#2c2c30]" />

            <SimButton
              onClick={() => setView((v) => ({ ...v, grid: !v.grid }))}
              title="网格"
              active={view.grid}
            >
              <Grid3x3 size={12} />
            </SimButton>
            <SimButton
              onClick={() => setView((v) => ({ ...v, defense: !v.defense }))}
              title="防线参考"
              active={view.defense}
            >
              <SeparatorHorizontal size={12} />
            </SimButton>
            <button
              onClick={cycleBg}
              title="视口背景（场景/纯黑/棋盘格）"
              className="flex items-center gap-1 rounded border border-[#333338] bg-[#242428] px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:border-zinc-500"
            >
              <Contrast size={11} />
              {bgLabel}
            </button>

            <span className="ml-auto truncate font-mono text-[10px] text-zinc-500">
              {prefab ? (
                <>
                  <span className="text-violet-400">{prefab.en}</span>
                  <span className="text-zinc-700"> · 预制体 · 循环 {(prefab.duration / 1000).toFixed(1)}s</span>
                </>
              ) : (
                <>
                  <span className="text-orange-400">{def.en}</span>
                  <span className="text-zinc-700">
                    {' '}
                    · 原子 · {def.mode === 'continuous' ? '持续发射' : '周期爆发'}
                  </span>
                </>
              )}
            </span>
          </div>

          {/* 视口（拖放目标） */}
          <main
            {...dropHandlers}
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,110,30,0.08), transparent 70%)',
              }}
            />
            <canvas
              ref={canvasRef}
              className="relative rounded-lg border border-[#333338] shadow-[0_0_60px_rgba(255,110,30,0.07)]"
              style={{ height: 'min(100% - 24px, 800px)', aspectRatio: `${W} / ${H}` }}
            />
            {/* HUD：FPS / 粒子数 */}
            <div className="absolute right-4 top-3 rounded border border-[#333338] bg-[#161618]/85 px-2.5 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur">
              FPS <span className="text-orange-300">{hud.fps}</span>
              <span className="mx-1.5 text-zinc-700">|</span>
              粒子 <span className="text-orange-300">{hud.count}</span>
            </div>

            {/* 拖放提示遮罩 */}
            {dragOver && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/60">
                <div className="rounded-xl border-2 border-dashed border-orange-500/70 bg-zinc-900/80 px-8 py-5 text-center">
                  <p className="text-sm font-semibold text-orange-200">松开鼠标，加载特效到编辑器</p>
                  <p className="mt-1 font-mono text-[10px] tracking-widest text-zinc-500">
                    DROP TO EDIT
                  </p>
                </div>
              </div>
            )}
          </main>

          {/* ===== 底部时间轴坞 ===== */}
          <TimelineDock
            mode={prefab ? 'prefab' : 'atom'}
            prefab={effectivePrefab}
            elapsedMs={hud.elapsed}
            onSeek={(ms) => seekRef.current(ms)}
            curve={curveInfo}
          />
        </div>

        {/* ===== 右 dock：检查器（Unity Inspector 风格，拖放目标） ===== */}
        <aside
          {...dropHandlers}
          className="flex w-[380px] shrink-0 flex-col border-l border-[#2c2c30] bg-[#1a1a1c]"
        >
          <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[#2c2c30] px-3">
            <span className="text-[10px] font-bold tracking-[0.18em] text-zinc-400 uppercase">
              检查器
            </span>
            <span className="font-mono text-[8px] tracking-[0.2em] text-zinc-700">INSPECTOR</span>
            <span className="ml-auto font-mono text-[9px] text-zinc-600">
              {prefab ? `prefab:${prefab.id}` : `particle.${def.id}`}
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {prefab ? (
              <>
                {/* 预制体信息卡片 */}
                <div className="rounded-md border border-violet-900/40 bg-gradient-to-br from-violet-950/30 to-zinc-900/40 p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-violet-950/60 px-1.5 py-0.5 font-mono text-[9px] leading-3 text-violet-400">
                      预制体
                    </span>
                    <h2 className="text-sm font-bold text-violet-100">{prefab.name}</h2>
                    <span className="font-mono text-[9px] tracking-widest text-zinc-500">
                      {prefab.en}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">{prefab.desc}</p>
                  <p className="mt-1.5 font-mono text-[9px] leading-4 text-zinc-600">
                    {prefab.source}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-zinc-400">
                    <span className="rounded border border-[#333338] bg-[#242428] px-1.5 py-0.5 font-mono">
                      {(prefab.duration / 1000).toFixed(1)}s 循环
                    </span>
                    <span className="rounded border border-[#333338] bg-[#242428] px-1.5 py-0.5 font-mono">
                      {prefab.steps.length} 步骤
                    </span>
                    <span className="rounded border border-[#333338] bg-[#242428] px-1.5 py-0.5 font-mono">
                      锚点 ({prefab.anchor.x}, {prefab.anchor.y})
                    </span>
                  </div>
                  {/* 组合原子（点击跳转原子编辑器） */}
                  {prefab.atoms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {prefab.atoms.map((atomId) => {
                        const atomDef = EFFECTS.find((e) => e.id === atomId);
                        return (
                          <button
                            key={atomId}
                            onClick={() => selectAtom(atomId)}
                            title={`跳转到原子特效「${atomDef?.name ?? atomId}」`}
                            className="rounded border border-orange-900/50 bg-orange-950/30 px-1.5 py-0.5 font-mono text-[9px] text-orange-300/90 transition-colors hover:bg-orange-900/40 hover:text-orange-200"
                          >
                            {atomDef?.name ?? atomId}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={handleExportPrefab}
                    className="mt-2.5 w-full rounded border border-violet-700/50 bg-violet-950/40 px-2 py-1.5 text-[11px] font-semibold text-violet-300 transition-colors hover:bg-violet-900/50 hover:text-violet-200"
                  >
                    导出此预制体配置
                  </button>
                </div>

                {/* 时序步骤列表（含追加的 Canvas2D 自由图形：点击选中编辑、可调 at/duration、可删除） */}
                <InspectorModule
                  title={`时序步骤（${effectivePrefab?.steps.length ?? 0}）`}
                  accent="#c084fc"
                >
                  <div className="space-y-1">
                    {(effectivePrefab?.steps ?? []).map((s, i) => {
                      const extraIdx = i - prefab.steps.length;
                      const shape = extraIdx >= 0 && s.kind === 'shape' ? s : null;
                      const marker = extraIdx < 0 && s.kind === 'marker' ? s : null;
                      // 内置图形步骤（如气体护盾光带）：可选中，经 stepOverrides 补丁编辑
                      const baseShape = extraIdx < 0 && s.kind === 'shape' ? s : null;
                      const isSelected =
                        (shape != null && extraIdx === selectedExtraIdx) ||
                        (marker != null && i === selectedMarkerIdx) ||
                        (baseShape != null && i === selectedBaseShapeIdx);
                      return (
                        <div
                          key={i}
                          onClick={
                            shape
                              ? () => {
                                  setSelectedExtraIdx(extraIdx);
                                  setSelectedMarkerIdx(null);
                                  setSelectedBaseShapeIdx(null);
                                }
                              : marker
                                ? () => {
                                    setSelectedMarkerIdx(i);
                                    setSelectedExtraIdx(null);
                                    setSelectedBaseShapeIdx(null);
                                  }
                                : baseShape
                                  ? () => {
                                      setSelectedBaseShapeIdx(i);
                                      setSelectedExtraIdx(null);
                                      setSelectedMarkerIdx(null);
                                    }
                                  : undefined
                          }
                          title={
                            shape
                              ? '点击选中，在下方「图形参数」模块编辑形状/大小/颜色/动画'
                              : marker
                                ? '点击选中，在下方「标注参数」模块编辑位置/大小/参数打点'
                                : baseShape
                                  ? '点击选中，在下方「图形参数」模块编辑矩形/渐变/闪电参数（补丁随 steps 导出）'
                                  : undefined
                          }
                          className={`flex items-center gap-2 rounded px-1 py-0.5 text-[10px] leading-4 ${
                            shape || marker || baseShape
                              ? `cursor-pointer ${
                                  isSelected
                                    ? marker
                                      ? 'bg-cyan-950/40 ring-1 ring-cyan-600/50'
                                      : 'bg-amber-950/40 ring-1 ring-amber-600/50'
                                    : 'hover:bg-[#26262c]'
                                }`
                              : ''
                          }`}
                        >
                          {shape ? (
                            <input
                              type="number"
                              value={shape.at}
                              min={0}
                              step={50}
                              title="触发时刻 at（ms）"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                updateExtraStep(prefab.id, extraIdx, {
                                  at: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="w-12 shrink-0 rounded border border-amber-900/60 bg-[#201a10] px-1 py-0.5 text-right font-mono text-[10px] leading-3 text-amber-300 outline-none focus:border-amber-600"
                            />
                          ) : (
                            <span className="w-12 shrink-0 text-right font-mono text-zinc-500">
                              {s.at}ms
                            </span>
                          )}
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: STEP_KIND_COLOR[s.kind] }}
                          />
                          <span className="shrink-0 font-mono text-zinc-600">
                            {STEP_KIND_LABEL[s.kind]}
                          </span>
                          {(shape ?? baseShape) && (
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm border border-white/25"
                              style={{ background: (shape ?? baseShape)!.color }}
                              title={`主颜色 ${(shape ?? baseShape)!.color}`}
                            />
                          )}
                          <span className="truncate font-mono text-zinc-400">
                            {stepSummary(s)}
                          </span>
                          {shape && (
                            <>
                              <input
                                type="number"
                                value={shape.duration}
                                min={50}
                                step={50}
                                title="持续窗口 duration（ms）"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  updateExtraStep(prefab.id, extraIdx, {
                                    duration: Math.max(50, Number(e.target.value) || 50),
                                  })
                                }
                                className="w-14 shrink-0 rounded border border-amber-900/60 bg-[#201a10] px-1 py-0.5 text-right font-mono text-[10px] leading-3 text-amber-300 outline-none focus:border-amber-600"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeExtraStep(prefab.id, extraIdx);
                                }}
                                title="删除此 Canvas2D 图形"
                                className="shrink-0 rounded p-0.5 text-zinc-600 transition-colors hover:bg-red-950/40 hover:text-red-400"
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </InspectorModule>

                {/* 图形参数（选中的 Canvas2D 自由图形：位置/大小/颜色/缩放动画/旋转/淡出，存于步骤实例随预制体合并导出） */}
                {selectedShape && selectedExtraIdx != null && (
                  <InspectorModule
                    title={`图形参数 · ${SHAPE_KIND_META[selectedShape.shape].label}`}
                    sub="SHAPE"
                    accent="#fbbf24"
                  >
                    <ShapeParamEditor
                      step={selectedShape}
                      onChange={(patch) => updateExtraStep(prefab.id, selectedExtraIdx, patch)}
                      onDelete={() => removeExtraStep(prefab.id, selectedExtraIdx)}
                    />
                  </InspectorModule>
                )}

                {/* 图形参数（选中的内置 shape 步骤，如气体护盾光带：矩形/渐变/闪电参数，补丁经 stepOverrides 合并随 steps 导出；内置步骤不可删除） */}
                {selectedBaseShape && selectedBaseShapeIdx != null && (
                  <InspectorModule
                    title={`图形参数 · ${SHAPE_KIND_META[selectedBaseShape.shape].label}（内置）`}
                    sub="SHAPE"
                    accent="#fbbf24"
                  >
                    <ShapeParamEditor
                      step={selectedBaseShape}
                      onChange={(patch) =>
                        updateBaseStep(prefab.id, selectedBaseShapeIdx, patch)
                      }
                    />
                  </InspectorModule>
                )}

                {/* 标注参数（选中的内置 marker 步骤，如气体护盾矩形虚框：位置/大小可打点，补丁经 stepOverrides 合并随 steps 导出） */}
                {selectedMarker && selectedMarkerIdx != null && (
                  <InspectorModule
                    title={`标注参数 · ${selectedMarker.shape === 'rect' ? '矩形' : '圆形'}`}
                    sub="MARKER"
                    accent="#22d3ee"
                  >
                    <MarkerParamEditor
                      step={selectedMarker}
                      onChange={(patch) => updateBaseStep(prefab.id, selectedMarkerIdx, patch)}
                    />
                  </InspectorModule>
                )}

                {/* 聚合参数（原子共享组 + 预制体专属渲染配置节 + 追加 Canvas2D 图形注册节） */}
                {prefabSections.length > 0 ? (
                  <ParamPanel sections={prefabSections} onChange={handleConfigChange} />
                ) : (
                  <p className="rounded-md border border-[#2c2c30] bg-[#1e1e21] px-3 py-2.5 text-[11px] leading-4 text-zinc-500">
                    此预制体未引用原子特效（纯文字/标注/内联粒子），无可调参数。
                  </p>
                )}

                {/* 添加 Canvas2D 自由图形：形状选择器（参数风格参考现有 Canvas2D 技能；实例参数存于步骤，随预制体合并导出、可删除） */}
                <InspectorModule title="添加 Canvas2D 图形" sub="ADD SHAPE" accent="#fbbf24">
                  <button
                    onClick={() => setShapePickerOpen((o) => !o)}
                    className={`flex w-full items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                      shapePickerOpen
                        ? 'border-amber-600/60 bg-amber-950/50 text-amber-200'
                        : 'border-amber-800/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 hover:text-amber-200'
                    }`}
                  >
                    <Plus size={12} />
                    {shapePickerOpen ? '收起形状库' : '选择图形形状…'}
                  </button>
                  {shapePickerOpen && (
                    <div className="mt-2">
                      <div className="grid grid-cols-2 gap-1">
                        {(
                          Object.entries(SHAPE_KIND_META) as [
                            ShapeKind,
                            (typeof SHAPE_KIND_META)[ShapeKind],
                          ][]
                        ).map(([kind, meta]) => (
                          <button
                            key={kind}
                            onClick={() => addShapeStep(kind)}
                            title={`追加一个${meta.label}到时间轴（at=0 起）并选中`}
                            className="flex items-center gap-1.5 rounded border border-[#333338] bg-[#242428] px-1.5 py-1 text-left transition-colors hover:border-amber-700/60 hover:bg-amber-950/30"
                          >
                            <ShapeGlyph kind={kind} color={meta.defaults.color} />
                            <span className="truncate text-[10px] font-semibold text-zinc-300">
                              {meta.label}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[9px] leading-3.5 text-zinc-600">
                        点击形状追加到时间轴（at=0 起）并自动选中：大小/颜色/缩放动画/旋转等在「图形参数」模块调节，时序可在步骤列表调整，可删除，导出随预制体合并。
                      </p>
                    </div>
                  )}
                </InspectorModule>
              </>
            ) : (
              <>
                {/* 当前特效卡片 */}
                <div className="rounded-md border border-orange-900/40 bg-gradient-to-br from-orange-950/30 to-zinc-900/40 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] leading-3 ${
                        def.mode === 'continuous'
                          ? 'bg-emerald-950/60 text-emerald-400'
                          : 'bg-amber-950/60 text-amber-400'
                      }`}
                    >
                      {def.mode === 'continuous' ? '持续' : '爆发'}
                    </span>
                    <h2 className="text-sm font-bold text-orange-100">{def.name}</h2>
                    <span className="font-mono text-[9px] tracking-widest text-zinc-500">
                      {def.en}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">{def.desc}</p>
                  <button
                    onClick={handleExportEffect}
                    className="mt-2.5 w-full rounded border border-orange-700/50 bg-orange-950/40 px-2 py-1.5 text-[11px] font-semibold text-orange-300 transition-colors hover:bg-orange-900/50 hover:text-orange-200"
                  >
                    导出此特效配置
                  </button>
                </div>

                {/* 触发参数（调用方参数，不写入配置） */}
                {(def.triggers.length > 0 || def.id === 'coneFire') && (
                  <InspectorModule title="触发参数" sub="RUNTIME（不入配置）" accent="#22d3ee">
                    <div className="space-y-2">
                      {def.triggers.map((tr) => {
                        const v = (trigValues[def.id] ?? defaultTriggers(def))[tr.key];
                        return (
                          <div key={tr.key}>
                            <div className="mb-0.5 flex items-center justify-between">
                              <label className="text-[11px] text-zinc-400">{tr.label}</label>
                              <span className="font-mono text-[11px] text-orange-200">{v}</span>
                            </div>
                            <input
                              type="range"
                              min={tr.min}
                              max={tr.max}
                              step={tr.step}
                              value={v}
                              onChange={(e) =>
                                setTrigValues((prev) => ({
                                  ...prev,
                                  [def.id]: { ...prev[def.id], [tr.key]: Number(e.target.value) },
                                }))
                              }
                              className="h-1 w-full cursor-pointer accent-orange-500"
                            />
                          </div>
                        );
                      })}
                      {/* 锥形火焰专属：火焰类型 */}
                      {def.id === 'coneFire' && (
                        <div>
                          <label className="mb-1 block text-[11px] text-zinc-400">火焰类型</label>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                ['fire', '火焰'],
                                ['ice', '冰冻'],
                                ['poison', '毒气'],
                              ] as [ConeVariant, string][]
                            ).map(([val, label]) => (
                              <button
                                key={val}
                                onClick={() => setVariant(val)}
                                className={`rounded border py-1 text-[11px] transition-colors ${
                                  variant === val
                                    ? 'border-orange-600/70 bg-orange-950/40 text-orange-200'
                                    : 'border-[#333338] text-zinc-400 hover:border-zinc-600'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </InspectorModule>
                )}

                {/* 特效参数（写入 BALANCE_CONFIG） */}
                <ParamPanel sections={def.sections} onChange={handleConfigChange} />
              </>
            )}

            <p className="text-[10px] leading-4 text-zinc-600">
              参数实时生效于内存中的 BALANCE_CONFIG：同标签页内切回游戏可立即验证，刷新页面后还原。
              持久化请使用「导出」并合并回 render-balance.ts。
            </p>
          </div>
        </aside>
      </div>

      {/* ===== 状态栏 ===== */}
      <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-[#2c2c30] bg-[#1c1c1f] px-3 font-mono text-[10px] text-zinc-500">
        <span>
          模式 <span className="text-zinc-300">{prefab ? '预制体' : '原子特效'}</span>
        </span>
        <span>
          目标{' '}
          <span className="text-zinc-300">{prefab ? prefab.id : `particle.${def.id}`}</span>
        </span>
        <span>
          画布 <span className="text-zinc-300">{W}×{H}</span>
        </span>
        <span>
          时钟 <span className="text-zinc-300">{(hud.elapsed / 1000).toFixed(2)}s</span>
          <span className="text-zinc-700"> @{simUI.timeScale}×{simUI.paused ? ' 已暂停' : ''}</span>
        </span>
        <span className="ml-auto">
          <span className="text-orange-300/90">{hud.fps}</span> FPS
          <span className="mx-2 text-zinc-700">|</span>
          <span className="text-orange-300/90">{hud.count}</span> 粒子
          <span className="mx-2 text-zinc-700">|</span>
          步长 <span className="text-zinc-300">1/60s</span>
        </span>
      </footer>

      {/* ===== 导出弹窗 ===== */}
      {exportData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setExportData(null)}
        >
          <div
            className="flex max-h-[80vh] w-[640px] flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-200">{exportData.title}</h2>
              <button
                onClick={() => setExportData(null)}
                className="text-zinc-500 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>
            <textarea
              readOnly
              value={exportData.code}
              className="mx-4 my-3 h-80 shrink resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-4 text-orange-100/90 outline-none"
              onFocus={(e) => e.target.select()}
            />
            <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
              <p className="text-[11px] text-zinc-500">{exportData.hint}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                >
                  下载 .ts
                </button>
                <button
                  onClick={handleCopy}
                  className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-500"
                >
                  {copied ? '已复制 ✓' : '复制到剪贴板'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 顶栏工具按钮 */
function ToolButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded border border-[#333338] bg-[#242428] px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-orange-600/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Simulate 条图标按钮 */
function SimButton({
  children,
  onClick,
  title,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
        active
          ? 'border-orange-600/60 bg-orange-950/40 text-orange-300'
          : 'border-[#333338] bg-[#242428] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}

/** 检查器折叠模块（与 Unity Particle System 模块卡片同构） */
function InspectorModule({
  title,
  sub,
  accent,
  children,
}: {
  title: string;
  sub?: string;
  accent: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-md border border-[#2e2e33] bg-[#1e1e21]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-[#232328] px-2.5 py-1.5 text-left transition-colors hover:bg-[#26262c]"
      >
        <span
          className="font-mono text-[9px] text-zinc-500 transition-transform"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          ▼
        </span>
        <span className="h-3 w-1 rounded-sm" style={{ background: accent }} />
        <span className="text-[11px] font-semibold text-zinc-300">{title}</span>
        {sub && <span className="font-mono text-[8px] tracking-[0.15em] text-zinc-600">{sub}</span>}
      </button>
      {open && <div className="px-2.5 pb-2.5 pt-2">{children}</div>}
    </div>
  );
}

/** 形状选择器小图标（SVG 预览：形状 + 默认主颜色） */
function ShapeGlyph({ kind, color }: { kind: ShapeKind; color: string }) {
  const props = { fill: kind === 'circle' || kind === 'triangle' ? color : 'none', stroke: color };
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      {kind === 'circle' && <circle cx="7" cy="7" r="5.5" {...props} strokeWidth="1.5" />}
      {kind === 'rect' && <rect x="1.5" y="3" width="11" height="8" {...props} strokeWidth="1.5" />}
      {kind === 'ring' && <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="2.5" />}
      {kind === 'triangle' && <path d="M7 1.5 L12.5 11.5 L1.5 11.5 Z" {...props} strokeWidth="1.5" />}
    </svg>
  );
}

/** 数字滑杆行（自由图形实例参数编辑：label + range + 数值输入） */
function ShapeSlider({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <label className="text-[11px] text-zinc-400">{label}</label>
        <span className="font-mono text-[11px] text-amber-200">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-400"
      />
    </div>
  );
}

/**
 * 元素设置框（矩形三层元素：矩形主元素 / 格子线·闪电附属元素）。
 * 标题 + 主/附属徽标 + 内容 + 可选底部移除按钮（设置框下放删除框）。
 */
function ElementBox({
  title,
  badge,
  children,
  onRemove,
  removeText,
}: {
  title: string;
  badge: string;
  children: ReactNode;
  /** 移除回调：省略时隐藏移除按钮（矩形主元素不可移除） */
  onRemove?: () => void;
  removeText?: string;
}) {
  return (
    <div className="space-y-1 rounded border border-[#2a2a2e] bg-[#1b1b1d] p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-300">{title}</span>
        <span
          className={`rounded px-1 py-px text-[9px] ${
            badge === '主元素' ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-500/15 text-zinc-400'
          }`}
        >
          {badge}
        </span>
      </div>
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="mt-0.5 flex w-full items-center justify-center gap-1 rounded border border-red-800/40 bg-red-950/20 px-1 py-0.5 text-[10px] text-red-300/90 transition-colors hover:bg-red-900/30 hover:text-red-200"
        >
          <Trash2 size={10} />
          {removeText ?? '移除'}
        </button>
      )}
    </div>
  );
}

/** 元素颜色选择行：颜色选择框 + 本层透明度 alpha 滑条（0~1，渲染时与整体透明度叠乘） */
function ColorAlphaRow({
  color,
  alpha,
  onColor,
  onAlpha,
}: {
  color: string;
  alpha: number;
  onColor: (c: string) => void;
  onAlpha: (a: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-8 shrink-0 text-[10px] text-zinc-500">颜色</span>
      <input
        type="color"
        value={color}
        onChange={(e) => onColor(e.target.value)}
        className="h-5 w-8 shrink-0 cursor-pointer rounded border border-[#3a3a40] bg-transparent"
      />
      <span className="shrink-0 font-mono text-[10px] text-zinc-500">{color}</span>
      <span className="ml-auto shrink-0 text-[10px] text-zinc-500">alpha</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={alpha}
        onChange={(e) => onAlpha(Math.max(0, Math.min(1, Number(e.target.value))))}
        className="w-16 accent-amber-400"
      />
      <span className="w-7 shrink-0 text-right font-mono text-[10px] text-amber-200">
        {alpha.toFixed(2)}
      </span>
    </div>
  );
}

/** 附属元素添加按钮（虚线框，点击后以默认参数附加到矩形主元素上） */
function AddElementButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-[#3a3a40] px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:border-amber-400/50 hover:text-amber-200"
    >
      <Plus size={10} />
      {label}
    </button>
  );
}

/**
 * 自由图形参数编辑器（「添加 Canvas2D 图形」追加的 shape 步骤）。
 * 参数风格参考现有 Canvas2D 技能（breatheAmplitude → scaleAmp、breatheTimeScale → scaleFreq），
 * 全部写入步骤实例（Patch → updateExtraStep），不触碰 BALANCE_CONFIG。
 * 数值参数均可打点（◆ 切换关键帧曲线），关键帧存于 step.keys 随预制体合并导出。
 * 矩形按三层元素组织：① 矩形（主元素，含整体透明度）② 格子线（附属，可移除）③ 光带闪电（附属，可移除）；
 * 附属元素移除写入 null（JSON 安全的补丁语义），三元素透明度在各自颜色行内分别设置。
 */
function ShapeParamEditor({
  step,
  onChange,
  onDelete,
}: {
  step: ShapeStep;
  onChange: (patch: Partial<ShapeStep>) => void;
  /** 删除回调：省略时隐藏删除按钮（内置步骤不可删除） */
  onDelete?: () => void;
}) {
  const isRect = step.shape === 'rect';
  const isRing = step.shape === 'ring';
  return (
    <div className="space-y-2">
      {/* 位置偏移（相对预制体锚点；矩形三层元素共用同一位置与动画） */}
      <KeyframableSlider param="dx" unit="px" step={step} onChange={onChange} />
      <KeyframableSlider param="dy" unit="px" step={step} onChange={onChange} />

      {isRect ? (
        <>
          {/* ① 矩形（主元素）：宽高 + 颜色行（本层透明度 fillAlpha）+ 填充/渐变/混合 + 整体透明度 */}
          <ElementBox title="矩形" badge="主元素">
            <KeyframableSlider param="w" unit="px" step={step} onChange={onChange} />
            <KeyframableSlider param="h" unit="px" step={step} onChange={onChange} />
            <ColorAlphaRow
              color={step.color}
              alpha={step.fillAlpha ?? 1}
              onColor={(c) => onChange({ color: c })}
              onAlpha={(a) => onChange({ fillAlpha: a })}
            />
            <div className="flex items-center gap-3 pt-0.5">
              <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-zinc-400">
                <input
                  type="checkbox"
                  checked={step.fill}
                  onChange={(e) => onChange({ fill: e.target.checked })}
                  className="accent-amber-400"
                />
                填充
              </label>
              {step.fill && (
                <>
                  <label
                    className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-zinc-400"
                    title="中心实色 → 四周边缘透明（椭圆渐变覆盖矩形）"
                  >
                    <input
                      type="checkbox"
                      checked={step.gradient === 'radial'}
                      onChange={(e) => onChange({ gradient: e.target.checked ? 'radial' : undefined })}
                      className="accent-amber-400"
                    />
                    径向渐变
                  </label>
                  <label
                    className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-zinc-400"
                    title="lighter 叠加混合：填充与背景相加增亮，呈现发光感"
                  >
                    <input
                      type="checkbox"
                      checked={step.blend === 'lighter'}
                      onChange={(e) => onChange({ blend: e.target.checked ? 'lighter' : undefined })}
                      className="accent-amber-400"
                    />
                    叠加增亮
                  </label>
                </>
              )}
            </div>
            {/* 整体透明度滑条：矩形/格子线/闪电三层的公共乘数，支持打点（◆ 关键帧曲线） */}
            <KeyframableSlider param="alpha" label="整体透明度" step={step} onChange={onChange} />
          </ElementBox>

          {/* ② 格子线（附属元素）：设置框下放移除按钮；已移除时显示添加按钮 */}
          {step.fill &&
            (step.grid ? (
              <ElementBox
                title="格子线"
                badge="附属"
                onRemove={() => onChange({ grid: null })}
                removeText="移除格子线"
              >
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[10px] text-zinc-500">间隔px</span>
                  <input
                    type="number" min={2} max={100}
                    value={step.grid.gap}
                    onChange={(e) => onChange({ grid: { ...step.grid!, gap: Math.max(2, Number(e.target.value) || 5) } })}
                    className="w-14 rounded bg-[#141416] px-1 py-0.5 font-mono text-[10px] text-zinc-200 outline-none"
                  />
                  <span className="w-14 shrink-0 text-[10px] text-zinc-500">线宽px</span>
                  <input
                    type="number" min={0.5} max={10} step={0.5}
                    value={step.grid.lineWidth}
                    onChange={(e) => onChange({ grid: { ...step.grid!, lineWidth: Math.max(0.5, Number(e.target.value) || 1) } })}
                    className="w-14 rounded bg-[#141416] px-1 py-0.5 font-mono text-[10px] text-zinc-200 outline-none"
                  />
                </div>
                <ColorAlphaRow
                  color={step.grid.color}
                  alpha={step.grid.alpha ?? 1}
                  onColor={(c) => onChange({ grid: { ...step.grid!, color: c } })}
                  onAlpha={(a) => onChange({ grid: { ...step.grid!, alpha: a } })}
                />
              </ElementBox>
            ) : (
              <AddElementButton
                label="添加格子线（边缘渐隐）"
                onClick={() =>
                  onChange({ grid: { gap: 5, lineWidth: 1, color: '#e0f2fe', alpha: 1 } })
                }
              />
            ))}

          {/* ③ 扩散粒子（附属元素，需径向渐变底）：设置框下放移除按钮；已移除时显示添加按钮 */}
          {step.fill &&
            step.gradient === 'radial' &&
            (step.sparks ? (
              <ElementBox
                title="扩散粒子"
                badge="附属"
                onRemove={() => onChange({ sparks: null })}
                removeText="移除扩散粒子"
              >
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[10px] text-zinc-500">数量</span>
                  <input
                    type="number" min={1} max={30}
                    value={step.sparks.count}
                    onChange={(e) => onChange({ sparks: { ...step.sparks!, count: Math.max(1, Math.min(30, Number(e.target.value) || 1)) } })}
                    className="w-14 rounded bg-[#141416] px-1 py-0.5 font-mono text-[10px] text-zinc-200 outline-none"
                  />
                  <span className="w-14 shrink-0 text-[10px] text-zinc-500">生命ms</span>
                  <input
                    type="number" min={100} max={2000} step={50}
                    value={step.sparks.life}
                    onChange={(e) => onChange({ sparks: { ...step.sparks!, life: Math.max(100, Number(e.target.value) || 900) } })}
                    className="w-14 rounded bg-[#141416] px-1 py-0.5 font-mono text-[10px] text-zinc-200 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[10px] text-zinc-500">大小px</span>
                  <input
                    type="number" min={0.5} max={10} step={0.1}
                    value={step.sparks.size}
                    onChange={(e) => onChange({ sparks: { ...step.sparks!, size: Math.max(0.5, Number(e.target.value) || 2.5) } })}
                    className="w-14 rounded bg-[#141416] px-1 py-0.5 font-mono text-[10px] text-zinc-200 outline-none"
                  />
                </div>
                <ColorAlphaRow
                  color={step.sparks.color}
                  alpha={step.sparks.alpha ?? 1}
                  onColor={(c) => onChange({ sparks: { ...step.sparks!, color: c } })}
                  onAlpha={(a) => onChange({ sparks: { ...step.sparks!, alpha: a } })}
                />
                {/* 叠加混合方式：缺省 lighter（叠加增亮，保证粒子亮度高于渐变底） */}
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[10px] text-zinc-500">叠加方式</span>
                  <select
                    value={step.sparks.blend ?? 'lighter'}
                    onChange={(e) => {
                      const v = e.target.value as GlobalCompositeOperation;
                      onChange({ sparks: { ...step.sparks!, blend: v === 'lighter' ? undefined : v } });
                    }}
                    className="rounded bg-[#141416] px-1 py-0.5 text-[10px] text-zinc-200 outline-none"
                    title="lighter=叠加增亮（发光感）；screen=滤色（柔和提亮）；source-over=普通覆盖；multiply=正片叠底（变暗）"
                  >
                    <option value="lighter">lighter 叠加增亮</option>
                    <option value="screen">screen 滤色</option>
                    <option value="source-over">source-over 普通</option>
                    <option value="multiply">multiply 正片叠底</option>
                  </select>
                </div>
              </ElementBox>
            ) : (
              <AddElementButton
                label="添加扩散粒子（中心 → 四周）"
                onClick={() =>
                  onChange({
                    sparks: { count: 12, life: 900, size: 2.5, color: '#e0f2fe', alpha: 1 },
                  })
                }
              />
            ))}
        </>
      ) : (
        <>
          {/* 大小：非矩形用半径 */}
          <KeyframableSlider param="r" unit="px" step={step} onChange={onChange} />
          {/* 颜色 + 填充（颜色/填充不打点，随窗口恒定） */}
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[11px] text-zinc-400">颜色</label>
            <input
              type="color"
              value={step.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-5 w-8 shrink-0 cursor-pointer rounded border border-[#3a3a40] bg-transparent"
            />
            <span className="font-mono text-[10px] text-zinc-500">{step.color}</span>
            {!isRing && (
              <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-zinc-400">
                <input
                  type="checkbox"
                  checked={step.fill}
                  onChange={(e) => onChange({ fill: e.target.checked })}
                  className="accent-amber-400"
                />
                填充
              </label>
            )}
          </div>
          <KeyframableSlider param="alpha" step={step} onChange={onChange} />
        </>
      )}

      {(!step.fill || isRing) && (
        <KeyframableSlider
          param="lineWidth"
          label={isRing ? '环宽' : '描边线宽'}
          unit="px"
          step={step}
          onChange={onChange}
        />
      )}
      {/* 缩放动画/旋转/结尾淡出（矩形三层元素共用；呼吸：1 + amp·sin(2π·freq·t)） */}
      <KeyframableSlider param="scaleAmp" step={step} onChange={onChange} />
      <KeyframableSlider param="scaleFreq" unit="/s" step={step} onChange={onChange} />
      <KeyframableSlider param="rotSpeed" unit="圈/s" step={step} onChange={onChange} />
      <ShapeSlider label="结尾淡出" value={step.fadeOut} min={0} max={1} step={0.05} onChange={(v) => onChange({ fadeOut: v })} />
      {onDelete && (
        <button
          onClick={onDelete}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-red-800/50 bg-red-950/30 px-2 py-1 text-[10px] font-semibold text-red-300 transition-colors hover:bg-red-900/40 hover:text-red-200"
        >
          <Trash2 size={11} />
          删除此图形
        </button>
      )}
    </div>
  );
}

/**
 * 区域标注参数编辑器（内置 marker 步骤，如气体护盾矩形虚框）。
 * 数值参数（偏移 X/Y、宽/高/半径）均可打点（◆ 切换关键帧曲线，t 相对 life 窗口归一化），
 * 修改经 stepOverrides 补丁合并进有效预制体，随预制体 steps 一并导出（不改动内置配方常量）。
 */
function MarkerParamEditor({
  step,
  onChange,
}: {
  step: MarkerStep;
  onChange: (patch: Partial<MarkerStep>) => void;
}) {
  const isRect = step.shape === 'rect';
  return (
    <div className="space-y-2">
      {/* 位置偏移（相对预制体锚点） */}
      <KeyframableSlider param="dx" unit="px" step={step} onChange={onChange} />
      <KeyframableSlider param="dy" unit="px" step={step} onChange={onChange} />
      {/* 大小：矩形用宽/高，圆形用半径 */}
      {isRect ? (
        <>
          <KeyframableSlider param="w" unit="px" step={step} onChange={onChange} />
          <KeyframableSlider param="h" unit="px" step={step} onChange={onChange} />
        </>
      ) : (
        <KeyframableSlider param="r" unit="px" step={step} onChange={onChange} />
      )}
      {/* 颜色 + 虚线（不打点，随窗口恒定） */}
      <div className="flex items-center gap-2">
        <label className="shrink-0 text-[11px] text-zinc-400">颜色</label>
        <input
          type="color"
          value={step.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-5 w-8 shrink-0 cursor-pointer rounded border border-[#3a3a40] bg-transparent"
        />
        <span className="font-mono text-[10px] text-zinc-500">{step.color}</span>
        <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-zinc-400">
          <input
            type="checkbox"
            checked={step.dashed ?? false}
            onChange={(e) => onChange({ dashed: e.target.checked })}
            className="accent-cyan-400"
          />
          虚线
        </label>
      </div>
      {/* 存活时间（打点窗口长度，ms） */}
      <ShapeSlider
        label="存活时间（打点窗口）"
        value={step.life ?? 800}
        min={100}
        max={5000}
        step={50}
        unit="ms"
        onChange={(v) => onChange({ life: v })}
      />
    </div>
  );
}

/**
 * 可打点的数值参数行（参考 Unity Curve Editor 的参数曲线，shape / marker 步骤共用）：
 * 常量模式为滑杆；点击 ◆ 切换为关键帧曲线编辑器（横轴 = 步骤窗口内归一化时间，纵轴 = 参数值）。
 * 关键帧存于 step.keys[param]（t 升序、线性插值），取消打点则回退到同名常量字段。
 */
function KeyframableSlider<T extends KeyframableStep>({
  param,
  label,
  unit = '',
  step,
  onChange,
}: {
  param: ShapeKeyParam;
  label?: string;
  unit?: string;
  step: T;
  onChange: (patch: Partial<T>) => void;
}) {
  const meta = SHAPE_KEY_META[param];
  const keys = step.keys?.[param];
  const constVal = step[param] ?? 0;

  /** 写入/清除该参数的关键帧数组（清空时删除条目；全空时 keys 置 undefined 保持导出干净） */
  const setKeys = (next: Keyframe[] | undefined) => {
    const rest: Partial<Record<ShapeKeyParam, Keyframe[]>> = { ...(step.keys ?? {}) };
    if (next && next.length > 0) rest[param] = next;
    else delete rest[param];
    onChange({ keys: Object.keys(rest).length > 0 ? rest : undefined } as Partial<T>);
  };

  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <label className="text-[11px] text-zinc-400">{label ?? meta.label}</label>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-amber-200">
            {keys ? `◆×${keys.length}` : `${constVal}${unit}`}
          </span>
          <button
            onClick={() =>
              keys
                ? setKeys(undefined)
                : setKeys([
                    { t: 0, v: constVal },
                    { t: 1, v: constVal },
                  ])
            }
            title={keys ? '取消打点（回退为常量）' : '打点：在步骤窗口内按时间编辑参数曲线'}
            className={`rounded px-1 py-0.5 font-mono text-[9px] leading-3 transition-colors ${
              keys
                ? 'bg-amber-950/60 text-amber-300 ring-1 ring-amber-600/50'
                : 'text-zinc-600 hover:bg-[#2a2a2e] hover:text-amber-300'
            }`}
          >
            ◆
          </button>
        </div>
      </div>
      {keys ? (
        <KeyCurveEditor
          keys={keys}
          min={meta.min}
          max={meta.max}
          valStep={meta.step}
          onChange={setKeys}
        />
      ) : (
        <input
          type="range"
          min={meta.min}
          max={meta.max}
          step={meta.step}
          value={constVal}
          onChange={(e) => onChange({ [param]: Number(e.target.value) } as unknown as Partial<T>)}
          className="w-full accent-amber-400"
        />
      )}
    </div>
  );
}

/**
 * 关键帧迷你曲线编辑器（参考 Unity Curve Editor 单参数曲线）：
 * 点击空白处打点，拖动菱形点调整时间/数值，双击删点；底部数值行可精确输入。
 * 数据约定：t ∈ [0,1] 升序（相对步骤窗口），v 按 valStep 取整。
 */
function KeyCurveEditor({
  keys,
  min,
  max,
  valStep,
  onChange,
}: {
  keys: Keyframe[];
  min: number;
  max: number;
  valStep: number;
  onChange: (next: Keyframe[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const W2 = 320;
  const H2 = 64;
  const PAD = 8;

  const toX = (t: number) => PAD + t * (W2 - PAD * 2);
  const toY = (v: number) => H2 - PAD - ((v - min) / (max - min || 1)) * (H2 - PAD * 2);
  /** 指针位置 → (t, v)（viewBox 固定 320×64，元素宽度自适应，按矩形比例换算） */
  const fromPointer = (e: { clientX: number; clientY: number }) => {
    const el = svgRef.current;
    if (!el) return { t: 0, v: min };
    const rect = el.getBoundingClientRect();
    const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const ny = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    return {
      t: clamp((nx * W2 - PAD) / (W2 - PAD * 2), 0, 1),
      v: clamp(min + (1 - (ny * H2 - PAD) / (H2 - PAD * 2)) * (max - min), min, max),
    };
  };
  /** 数值取整（t 两位小数，v 按 valStep 步进） */
  const snapT = (t: number) => Math.round(clamp(t, 0, 1) * 100) / 100;
  const snapV = (v: number) =>
    Number((Math.round(clamp(v, min, max) / valStep) * valStep).toFixed(4));

  /** 移动选中点并保持 t 升序（以对象引用追踪排序后的新下标） */
  const moveSelected = (t: number, v: number) => {
    if (sel == null || sel >= keys.length) return;
    const item = { t: snapT(t), v: snapV(v) };
    const next = keys.map((k, i) => (i === sel ? item : k));
    next.sort((a, b) => a.t - b.t);
    onChange(next);
    setSel(next.indexOf(item));
  };
  /** 删除指定点（清空后由父组件回退常量模式） */
  const removeKey = (i: number) => {
    setSel(null);
    onChange(keys.filter((_, j) => j !== i));
  };

  const handleBgDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = fromPointer(e);
    const item = { t: snapT(p.t), v: snapV(p.v) };
    const next = [...keys, item].sort((a, b) => a.t - b.t);
    onChange(next);
    setSel(next.indexOf(item));
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (sel == null || !(e.buttons & 1)) return;
    const p = fromPointer(e);
    moveSelected(p.t, p.v);
  };

  const selKey = sel != null && sel < keys.length ? keys[sel] : null;
  const line = keys.map((k) => `${toX(k.t).toFixed(1)},${toY(k.v).toFixed(1)}`).join(' ');
  const area =
    keys.length > 1
      ? `${toX(keys[0].t).toFixed(1)},${toY(min).toFixed(1)} ${line} ${toX(keys[keys.length - 1].t).toFixed(1)},${toY(min).toFixed(1)}`
      : null;

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W2} ${H2}`}
        className="block h-16 w-full cursor-crosshair rounded border border-[#2c2c30] bg-[#161618]"
        onPointerDown={handleBgDown}
        onPointerMove={handleMove}
      >
        {/* 网格（时间 1/4 刻度 + 值中线；含 0 值参考线） */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={`v${g}`}
            x1={toX(g)}
            x2={toX(g)}
            y1={PAD}
            y2={H2 - PAD}
            stroke="#2a2a2e"
            strokeWidth={1}
          />
        ))}
        <line x1={PAD} x2={W2 - PAD} y1={toY((min + max) / 2)} y2={toY((min + max) / 2)} stroke="#2a2a2e" strokeWidth={1} />
        {min < 0 && max > 0 && (
          <line x1={PAD} x2={W2 - PAD} y1={toY(0)} y2={toY(0)} stroke="#3f3f46" strokeWidth={1} />
        )}
        {/* 曲线下面积 + 折线 */}
        {area && <polygon points={area} fill="#fbbf24" opacity={0.08} />}
        {keys.length > 1 && (
          <polyline points={line} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeLinejoin="round" />
        )}
        {/* 菱形关键点（大透明 hit 圆便于点按） */}
        {keys.map((k, i) => (
          <g
            key={i}
            transform={`translate(${toX(k.t)}, ${toY(k.v)})`}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSel(i);
              svgRef.current?.setPointerCapture(e.pointerId);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              removeKey(i);
            }}
            className="cursor-grab"
          >
            <circle r={7} fill="transparent" />
            <rect
              x={-3.2}
              y={-3.2}
              width={6.4}
              height={6.4}
              transform="rotate(45)"
              fill={i === sel ? '#fbbf24' : '#a1a1aa'}
              stroke="#161618"
              strokeWidth={1}
            />
          </g>
        ))}
      </svg>
      {/* 数值行：选中点精确编辑 / 操作提示 */}
      <div className="mt-1 flex items-center gap-1.5 text-[9px] text-zinc-600">
        {selKey && sel != null ? (
          <>
            <span>t</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={selKey.t}
              onChange={(e) => moveSelected(Number(e.target.value) || 0, selKey.v)}
              className="w-12 rounded border border-[#3a3a40] bg-[#1a1a1d] px-1 py-0.5 text-right font-mono text-[9px] leading-3 text-amber-200 outline-none focus:border-amber-600"
            />
            <span>v</span>
            <input
              type="number"
              min={min}
              max={max}
              step={valStep}
              value={selKey.v}
              onChange={(e) => moveSelected(selKey.t, Number(e.target.value) || 0)}
              className="w-14 rounded border border-[#3a3a40] bg-[#1a1a1d] px-1 py-0.5 text-right font-mono text-[9px] leading-3 text-amber-200 outline-none focus:border-amber-600"
            />
            <button
              onClick={() => removeKey(sel)}
              className="ml-auto rounded px-1 py-0.5 text-zinc-500 transition-colors hover:bg-red-950/40 hover:text-red-400"
              title="删除选中点（双击点同效）"
            >
              删点
            </button>
          </>
        ) : (
          <span>点击空白打点 · 拖动调时间/数值 · 双击删点（t=0~1 为窗口内归一化时间）</span>
        )}
      </div>
    </div>
  );
}
