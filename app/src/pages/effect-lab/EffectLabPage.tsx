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

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  Contrast,
  Download,
  FileDown,
  Grid3x3,
  Pause,
  Play,
  RotateCcw,
  SeparatorHorizontal,
  StepForward,
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
  backupCfg,
  backupFanCfg,
  backupRenderCfg,
  EFFECTS,
  PREFAB_CONFIG_SECTIONS,
  fanCfg,
  particleCfg,
  renderCfg,
  sectionsForAtoms,
  type ConeVariant,
  type EffectDef,
} from './effectDefs';
import { PREFABS, type PrefabStep } from './prefabDefs';
import { PrefabPlayer } from './prefabRuntime';
import { TimelineDock, type LifeCurveInfo } from './TimelineDock';
import {
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
};

const STEP_KIND_LABEL: Record<PrefabStep['kind'], string> = {
  atom: '特效',
  text: '文字',
  marker: '标注',
  sprite: '贴图',
  custom: '内联',
  vfx: '渲染',
};

/** 步骤摘要（检查器步骤列表一行） */
function stepSummary(s: PrefabStep): string {
  switch (s.kind) {
    case 'atom':
      return `${s.atom}${s.count ? ` ×${s.count}` : ''}${s.duration ? ` ${s.duration}ms` : ''}`;
    case 'text':
      return s.text;
    case 'marker':
      return s.shape === 'circle' ? `圆 r=${s.r ?? 20}` : `矩形 ${s.w}×${s.h}`;
    case 'sprite':
      return s.frames ? `序列帧 ×${s.frames.length}` : (s.src?.split('/').pop() ?? '贴图');
    case 'custom':
      return s.fn;
    case 'vfx':
      return `${s.fn} ${s.duration}ms`;
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

  /**
   * 参数修改回调：使渲染器预计算缓存失效（NurseRenderer 刻度数据依赖配置）并触发 UI 刷新。
   * 配置原地写入 BALANCE_CONFIG，预览循环每帧读取，无需额外同步。
   */
  const handleConfigChange = () => {
    NurseRenderer.invalidateTickCache();
    bump();
  };

  /** 预制体检查器参数节：原子共享组 + 预制体专属渲染配置节（如护士光环 nurseHealVFX） */
  const prefabSections = prefab
    ? [...sectionsForAtoms(prefab.atoms), ...(PREFAB_CONFIG_SECTIONS[prefab.id] ?? [])]
    : [];

  const updateSim = (patch: Partial<{ paused: boolean; timeScale: number }>) => {
    Object.assign(simRef.current, patch);
    setSimUI((s) => ({ ...s, ...patch }));
  };

  const selectAtom = (id: string) => {
    setActiveId(id);
    setActivePrefabId(null);
  };
  const selectPrefab = (id: string) => setActivePrefabId(id);

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
          } else if (def.id === 'shieldAura') {
            ParticleSpawner.spawnShieldAura(particles, W / 2, H * 0.62, t.hw ?? 100);
          } else if (def.id === 'shieldRepair') {
            // 护盾修复：按帧概率生成（复刻 RoachAISystem 内联逻辑）
            const rc = particleCfg.shieldRepair;
            if (Math.random() < rc.spawnChance) {
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
        if (def.id === 'shieldAura') {
          // 护盾矩形参考线 + 锚点
          const t = trigRef.current[def.id] ?? defaultTriggers(def);
          const hw = t.hw ?? 100;
          const rh = BALANCE_CONFIG.subway.shieldRectHeight;
          const ay = H * 0.62;
          ctx.strokeStyle = 'rgba(103, 232, 249, 0.35)';
          ctx.setLineDash([6, 5]);
          ctx.strokeRect(W / 2 - hw, ay - rh, hw * 2, rh);
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(103, 232, 249, 0.8)';
          ctx.beginPath();
          ctx.arc(W / 2, ay, 4, 0, Math.PI * 2);
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
  }, [def.id, prefab?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!prefab) return;
    const atomSections = sectionsForAtoms(prefab.atoms);
    const renderSections = PREFAB_CONFIG_SECTIONS[prefab.id] ?? [];
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
        steps: prefab.steps,
      },
      2,
    );
    setExportData({
      title: `导出预制体「${prefab.name}」`,
      hint: '粒子/渲染参数合并回 render-balance.ts 对应节点；steps 时序配方供核对/复刻',
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
            prefab={prefab}
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

                {/* 时序步骤列表 */}
                <InspectorModule title={`时序步骤（${prefab.steps.length}）`} accent="#c084fc">
                  <div className="space-y-1">
                    {prefab.steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] leading-4">
                        <span className="w-12 shrink-0 text-right font-mono text-zinc-500">
                          {s.at}ms
                        </span>
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: STEP_KIND_COLOR[s.kind] }}
                        />
                        <span className="shrink-0 font-mono text-zinc-600">
                          {STEP_KIND_LABEL[s.kind]}
                        </span>
                        <span className="truncate font-mono text-zinc-400">{stepSummary(s)}</span>
                      </div>
                    ))}
                  </div>
                </InspectorModule>

                {/* 聚合参数（原子共享组 + 预制体专属渲染配置节） */}
                {prefabSections.length > 0 ? (
                  <ParamPanel sections={prefabSections} onChange={handleConfigChange} />
                ) : (
                  <p className="rounded-md border border-[#2c2c30] bg-[#1e1e21] px-3 py-2.5 text-[11px] leading-4 text-zinc-500">
                    此预制体未引用原子特效（纯文字/标注/内联粒子），无可调参数。
                  </p>
                )}
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
