/**
 * @fileoverview 预制体时序播放器
 * @description 按 EffectPrefab.steps 时间轴循环调度一个完整游戏事件的特效：
 *              - atom   → ParticleSpawner 真实生成函数（burst 一次性 / duration 持续窗口每帧生成）
 *              - text   → 游戏同款浮动文字（ParticleSystem.renderFloatingTexts，上飘 + 淡出 + 描边）
 *              - marker → 区域/目标标注（编辑器辅助可视化：圆/矩形、虚线、淡出）
 *              - sprite → 序列帧/单图贴图（变异 7 帧、bomb.png 等，带图片缓存）
 *              - custom → 复刻游戏内联粒子（诱饵碎裂/气味、毒雾云、风扇气流、防线爆闪）
 *              仅供开发工具 EffectLab 使用，不参与游戏运行时逻辑。
 */

import { BALANCE_CONFIG, RENDER_COLOR, RENDER_FONT } from '@/game/data';
import { ConsumableSystem } from '@/game/engine/consumable/ConsumableSystem';
import { FanSystem } from '@/game/engine/fan/FanSystem';
import { ParticleSpawner } from '@/game/engine/particle/ParticleSpawner';
import { ParticleSystem } from '@/game/engine/particle/ParticleSystem';
import { BackgroundRenderer } from '@/game/engine/render/BackgroundRenderer';
import { DropRenderer } from '@/game/engine/render/DropRenderer';
import { NurseRenderer } from '@/game/engine/render/NurseRenderer';
import { RenderUtils, type InsecticideSprayState } from '@/game/engine/render/RenderUtils';
import { parseColorToRgba } from './effectLabUtils';
import {
  ParticleType,
  RoachState,
  RoachType,
  type FireWall,
  type FireZone,
  type FloatingText,
  type Particle,
  type Player,
  type Roach,
  type StickyDrop,
  type TripleFlameState,
  type WeaponDrop,
} from '@/game/types';
import type {
  AtomStep,
  CustomStep,
  EffectPrefab,
  KeyframableStep,
  MarkerStep,
  ShapeKeyParam,
  ShapeStep,
  SpriteStep,
  VfxStep,
} from './prefabDefs';

/** 与游戏一致的固定逻辑步长 */
const DT = 1 / 60;
/** 贴图绘制基准尺寸（px，× step.scale） */
const SPRITE_BASE = 96;
/** 编辑器预览画布逻辑尺寸（与 EffectLabPage 的 W/H 一致） */
const CANVAS_W = 540;
const CANVAS_H = 800;
/** 防线 Y（与游戏 height - 130 一致） */
const DEFENSE_Y = CANVAS_H - 130;

/** 持续窗口（atom.duration / custom.duration）：窗口内每帧生成 */
interface ActiveWindow {
  step: AtomStep | CustomStep;
  /** 窗口结束时刻（相对一轮开始，ms） */
  until: number;
}

interface TimedItem<T> {
  step: T;
  /** 触发时刻（相对一轮开始，ms） */
  born: number;
}

export class PrefabPlayer {
  private prefab: EffectPrefab | null = null;
  /** 一轮的起始时刻（performance.now ms） */
  private startMs = 0;
  /** 本轮已触发的一次性步骤下标 */
  private fired = new Set<number>();
  private windows: ActiveWindow[] = [];
  private markers: TimedItem<MarkerStep>[] = [];
  private sprites: TimedItem<SpriteStep>[] = [];
  private floatTexts: FloatingText[] = [];
  private paused = false;
  private pauseAt = 0;
  private imgCache = new Map<string, HTMLImageElement>();
  /** 格子线离屏贴图缓存（key = 参数组合；逐线渐变绘制成本高，烘焙一次复用） */
  private gridCache = new Map<string, HTMLCanvasElement | null>();

  // ========== 播放控制 ==========

  /** 装载预制体并从头播放 */
  play(prefab: EffectPrefab, now: number): void {
    this.prefab = prefab;
    this.restart(now);
  }

  /** 从头重新播放当前预制体 */
  restart(now: number): void {
    this.startMs = now;
    this.fired.clear();
    this.windows = [];
    this.markers = [];
    this.sprites = [];
    this.floatTexts = [];
  }

  setPaused(now: number, paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      this.pauseAt = now;
    } else {
      // 暂停期间的时间不计入播放进度
      this.startMs += now - this.pauseAt;
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** 当前播放进度（暂停时冻结） */
  progress(now: number): { elapsed: number; duration: number } {
    const duration = this.prefab?.duration ?? 1;
    const t = this.paused ? this.pauseAt : now;
    return { elapsed: Math.max(0, t - this.startMs), duration };
  }

  // ========== 每帧更新 ==========

  update(now: number, particles: Particle[], fireZones: FireZone[]): void {
    const p = this.prefab;
    if (!p || this.paused) return;

    let elapsed = now - this.startMs;
    // 循环：回绕时清空本轮状态重新调度
    if (elapsed >= p.duration) {
      this.startMs = now - (elapsed % p.duration);
      this.fired.clear();
      this.windows = [];
      this.markers = [];
      this.sprites = [];
      this.floatTexts = [];
      elapsed = now - this.startMs;
    }

    // 触发到点步骤
    p.steps.forEach((step, i) => {
      if (this.fired.has(i) || step.at > elapsed) return;
      this.fired.add(i);
      const x = p.anchor.x + (step.dx ?? 0);
      const y = p.anchor.y + (step.dy ?? 0);

      switch (step.kind) {
        case 'atom':
          if (step.duration) {
            this.windows.push({ step, until: step.at + step.duration });
          } else {
            this.spawnAtomBurst(step, x, y, particles, fireZones);
          }
          break;
        case 'custom':
          if (step.duration) {
            this.windows.push({ step, until: step.at + step.duration });
          } else {
            this.spawnCustomBurst(step, x, y, particles);
          }
          break;
        case 'text': {
          const lifeS = (step.life ?? 1200) / 1000;
          const ftCfg = (BALANCE_CONFIG.particle as unknown as Record<string, { defaultVy: number }>).floatingText;
          this.floatTexts.push({
            x,
            y,
            text: step.text,
            color: step.color,
            life: lifeS,
            maxLife: lifeS,
            vy: ftCfg.defaultVy,
            scale: (step.fontSize ?? 16) / 16,
          });
          break;
        }
        case 'marker':
          this.markers.push({ step, born: step.at });
          break;
        case 'sprite':
          this.preloadSprite(step);
          this.sprites.push({ step, born: step.at });
          break;
      }
    });

    // 持续窗口：每帧生成
    for (const w of this.windows) {
      if (elapsed > w.until) continue;
      const x = p.anchor.x + (w.step.dx ?? 0);
      const y = p.anchor.y + (w.step.dy ?? 0);
      if (w.step.kind === 'atom') this.spawnAtomTick(w.step, x, y, particles, fireZones);
      else this.spawnCustomTick(w.step, x, y, particles);
    }
    this.windows = this.windows.filter((w) => elapsed <= w.until);

    // 浮动文字推进（与游戏 updateFloatingTexts 一致：life -= dt, y += vy*dt）
    for (const t of this.floatTexts) {
      t.life -= DT;
      t.y += t.vy * DT;
    }
    this.floatTexts = this.floatTexts.filter((t) => t.life > 0);

    // 过期标注/贴图清理由渲染侧按 born+life 判定，这里只在一轮回绕时重置（见上）
  }

  // ========== 原子特效 ==========

  /** burst 类原子特效（一次性触发） */
  private spawnAtomBurst(
    step: AtomStep,
    x: number,
    y: number,
    particles: Particle[],
    fireZones: FireZone[],
  ): void {
    switch (step.atom) {
      case 'explosion':
        ParticleSpawner.spawnExplosionParticles(particles, x, y, step.count ?? 40);
        break;
      case 'shockwave':
        ParticleSpawner.spawnShockwaveRing(particles, x, y, step.count ?? 24);
        break;
      case 'smoke':
        ParticleSpawner.spawnSmokeParticles(particles, x, y, step.count ?? 20);
        break;
      case 'fireRing':
        ParticleSpawner.spawnFireRingParticles(particles, x, y, step.count ?? 30);
        break;
      case 'lightning':
        // 与游戏一致：顶部电弧 + 全屏竖直电光（540×800 逻辑画布）
        ParticleSpawner.spawnLightningParticles(particles, 270, 30, 540 * 0.95, 800 * 0.8);
        break;
      case 'ash':
        ParticleSpawner.spawnAshParticles(particles, x, y, step.count ?? 30);
        break;
      case 'blood':
        ParticleSpawner.spawnBloodParticles(particles, x, y, step.count ?? 25);
        break;
      case 'spark':
        ParticleSpawner.spawnSparkParticles(particles, x, y, step.count ?? 30);
        break;
      case 'debris':
        ParticleSpawner.spawnDebrisParticles(particles, x, y, step.count ?? 20);
        break;
      case 'armorPlus':
        ParticleSpawner.spawnArmorHealPlus(particles, x, y);
        break;
      default:
        // coneFire / armorSpray 为持续型，burst 退化为 1 帧窗口
        this.spawnAtomTick(step, x, y, particles, fireZones);
        break;
    }
  }

  /** 持续型原子特效（窗口内每帧调用） */
  private spawnAtomTick(
    step: AtomStep,
    x: number,
    y: number,
    particles: Particle[],
    fireZones: FireZone[],
  ): void {
    switch (step.atom) {
      case 'coneFire':
        ParticleSpawner.spawnConeFire({
          particles,
          fireZones,
          deltaTime: DT,
          x,
          y,
          angle: step.angle ?? -Math.PI / 2,
          range: step.range ?? 200,
          baseDamage: 0,
          type: step.variant ?? 'fire',
        });
        break;
      case 'armorSpray': {
        const to = step.to ?? { dx: 0, dy: 0 };
        // to 为相对预制体锚点的偏移（与 step.dx/dy 无关）
        const p = this.prefab;
        ParticleSpawner.spawnArmorSprayStream(
          particles,
          x,
          y,
          (p?.anchor.x ?? x) + to.dx,
          (p?.anchor.y ?? y) + to.dy,
        );
        break;
      }
      default:
        // 其余 atom 在窗口内按 burst 每帧重复无意义，忽略
        break;
    }
  }

  // ========== custom 内联粒子（复刻游戏非 ParticleSpawner 逻辑） ==========

  /** 一次性 custom（诱饵罐碎裂 / 防线爆闪） */
  private spawnCustomBurst(step: CustomStep, x: number, y: number, particles: Particle[]): void {
    if (step.fn === 'baitShatter') {
      // 复刻 ConsumableSystem 诱饵罐破碎（参数见 BALANCE_CONFIG.bait.shatter）
      const SH = BALANCE_CONFIG.bait.shatter;
      for (let i = 0; i < SH.emitter.burstCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * SH.emitter.burstSpreadDist;
        particles.push({
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist * SH.emitter.burstYScale,
          vx: Math.cos(angle) * (SH.burstVxMin + Math.random() * SH.burstVxRange),
          vy: Math.sin(angle) * (SH.burstVyMin + Math.random() * SH.burstVyRange) + SH.burstVyBias,
          life: SH.burstLifeMin + Math.random() * SH.burstLifeRange,
          maxLife: SH.burstMaxLife,
          color: RENDER_COLOR.armorStart,
          size: SH.burstSizeMin + Math.random() * SH.burstSizeRange,
          type: ParticleType.EMBER,
        });
      }
      for (let i = 0; i < SH.emitter.glassCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * (SH.glassVxMin + Math.random() * SH.glassVxRange),
          vy: Math.sin(angle) * (SH.glassVyMin + Math.random() * SH.glassVyRange) + SH.glassVyBias,
          life: SH.glassLifeMin + Math.random() * SH.glassLifeRange,
          maxLife: SH.glassMaxLife,
          color: SH.glassColor,
          size: SH.glassSizeMin + Math.random() * SH.glassSizeRange,
          type: ParticleType.SPARK,
        });
      }
    } else if (step.fn === 'breachFlash') {
      // 复刻 engine.ts 防线爆闪（参数见 BALANCE_CONFIG.bombExplosion）
      const BE = BALANCE_CONFIG.bombExplosion;
      for (let fi = 0; fi < BE.flash.emitter.layers; fi++) {
        particles.push({
          x: x + (Math.random() - 0.5) * BE.flash.emitter.offsetX,
          y: y + (Math.random() - 0.5) * BE.flash.emitter.offsetY,
          vx: 0,
          vy: 0,
          life: BE.flash.lifeBase + fi * BE.flash.lifeStep,
          maxLife: BE.flash.lifeBase + fi * BE.flash.lifeStep,
          size: BE.flash.sizeBase + fi * BE.flash.sizeStep,
          color: `rgba(${BE.flash.colorR}, ${BE.flash.colorGBase - fi * BE.flash.colorGStep}, ${BE.flash.colorBBase - fi * BE.flash.colorBStep}, ${BE.flash.alphaBase - fi * BE.flash.alphaStep})`,
          type: ParticleType.EXPLOSION,
        });
      }
      for (let d = 0; d < BE.debris.emitter.count; d++) {
        const angle = (d / BE.debris.emitter.count) * Math.PI * 2 + Math.random() * BE.debris.emitter.angleJitter;
        const speed = BE.debris.speedMin + Math.random() * BE.debris.speedRange;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + BE.debris.vyBias,
          life: BE.debris.lifeMin + Math.random() * BE.debris.lifeRange,
          maxLife: BE.debris.maxLife,
          size: BE.debris.sizeMin + Math.random() * BE.debris.sizeRange,
          color: `rgba(${BE.debris.colorRBase + Math.floor(Math.random() * BE.debris.colorRRange)}, ${BE.debris.colorGBase + Math.floor(Math.random() * BE.debris.colorGRange)}, 0, ${BE.debris.alpha})`,
          type: ParticleType.ASH,
        });
      }
    }
  }

  /** 持续型 custom（窗口内每帧调用） */
  private spawnCustomTick(step: CustomStep, x: number, y: number, particles: Particle[]): void {
    if (step.fn === 'baitSmell') {
      // 复刻 ConsumableSystem 诱饵持续气味（参数见 BALANCE_CONFIG.bait.smell）
      const SM = BALANCE_CONFIG.bait.smell;
      for (let i = 0; i < SM.emitter.perFrame; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * SM.emitter.spreadX,
          y: y - Math.random() * SM.emitter.spreadY,
          vx: (Math.random() - 0.5) * SM.vxRange,
          vy: -(SM.vyMin + Math.random() * SM.vyRange),
          life: SM.lifeMin + Math.random() * SM.lifeRange,
          maxLife: SM.maxLife,
          color: Math.random() < 0.5 ? RENDER_COLOR.armorStart : SM.colorAlt,
          size: SM.sizeMin + Math.random() * SM.sizeRange,
          type: ParticleType.SMOKE,
        });
      }
    } else if (step.fn === 'poisonPuff') {
      // PoisonSystem.spawnPoisonExplosion 的持续版：毒雾云缓慢扩散（BALANCE poisonCloud 配方）
      const cfg = BALANCE_CONFIG.poisonCloud;
      const angle = Math.random() * Math.PI * 2;
      const speed = cfg.speedMin + Math.random() * cfg.speedMax;
      const life = cfg.lifeMin + Math.random() * cfg.lifeMax;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life,
        maxLife: life,
        size: cfg.sizeMin + Math.random() * cfg.sizeMax,
        color: `hsl(${260 + Math.random() * 30}, 80%, ${50 + Math.random() * 20}%)`,
        type: ParticleType.POISON_CLOUD,
      });
    } else if (step.fn === 'fanGust') {
      // FanSystem 透视气流粒子的粒子化近似：紫色气流自风扇位向上吹送
      for (let i = 0; i < 2; i++) {
        const life = 1.0 + Math.random() * 0.4;
        particles.push({
          x: x + (Math.random() - 0.5) * 380,
          y: y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 24,
          vy: -(130 + Math.random() * 90),
          life,
          maxLife: life,
          size: 1.5 + Math.random() * 2,
          color: Math.random() < 0.3 ? BALANCE_CONFIG.fan.waveSecondaryColor : BALANCE_CONFIG.fan.wavePrimaryColor,
          type: ParticleType.SMOKE,
        });
      }
    } else if (step.fn === 'shieldRepair') {
      // 复刻 ParticleSpawner.spawnShieldRepairWorkerParticles（BALANCE_CONFIG.particle.shieldRepair.workerParticle 配方：
      // 每帧 count 颗，位置抖动 ±10，上升 30~50px/s，0.6~1.0s 生命，2~4px 青色 SPARK，lighter 叠加）
      const cfg = BALANCE_CONFIG.particle.shieldRepair.workerParticle;
      for (let i = 0; i < cfg.count; i++) {
        const life = cfg.lifeMin + Math.random() * (cfg.lifeMax - cfg.lifeMin);
        const alpha = cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin);
        particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * cfg.vxSpread * 2,
          vy: cfg.vyMin + Math.random() * (cfg.vyMax - cfg.vyMin),
          life,
          maxLife: life,
          size: cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin),
          color: `rgba(${cfg.color}, ${alpha})`,
          type: ParticleType.SPARK,
          blend: cfg.blend,
        });
      }
    }
  }

  // ========== 渲染 ==========

  /** 区域/目标标注（在粒子层之下绘制；dx/dy/r/w/h 支持关键帧打点插值，progress 相对 life 窗口） */
  renderMarkers(ctx: CanvasRenderingContext2D, now: number): void {
    if (!this.prefab) return;
    const elapsed = (this.paused ? this.pauseAt : now) - this.startMs;
    ctx.save();
    for (const m of this.markers) {
      const lifeMs = m.step.life ?? 800;
      const t = (elapsed - m.born) / lifeMs;
      if (t < 0 || t > 1) continue;
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      // 数值参数：有打点按关键帧插值（t 即 life 内归一化时间），否则用常量/缺省
      const dx = this.evalShapeParam(m.step, 'dx', t);
      const dy = this.evalShapeParam(m.step, 'dy', t);
      const x = this.prefab.anchor.x + dx;
      const y = this.prefab.anchor.y + dy;
      ctx.globalAlpha = Math.max(0, alpha) * 0.9;
      ctx.strokeStyle = m.step.color;
      ctx.fillStyle = m.step.color;
      ctx.lineWidth = 1.5;
      if (m.step.dashed) ctx.setLineDash([6, 5]);
      if (m.step.shape === 'circle') {
        const r = this.evalShapeParam(m.step, 'r', t, 20);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.globalAlpha *= 0.12;
        ctx.fill();
        ctx.globalAlpha /= 0.12;
        ctx.stroke();
      } else {
        const w = this.evalShapeParam(m.step, 'w', t, 40);
        const h = this.evalShapeParam(m.step, 'h', t, 40);
        ctx.globalAlpha *= 0.08;
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.globalAlpha /= 0.08;
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /** 确定性伪随机（0~1）：以时间槽为种子，保证逐帧渲染一致（扩散粒子方向用） */
  private hash01(n: number): number {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /**
   * 扩散粒子（shape rect + gradient + sparks）：
   * 粒子从中心向四周随机方向匀速扩散，飞行中渐隐并轻微缩小，到椭圆边缘附近消失；
   * 各粒子按 i/count 错相循环（持续有粒子从中心发出），方向随生命槽位哈希重随；
   * 无状态确定性渲染（seek/逐帧一致）。调用时处于 y 压缩坐标系：半径 radius 的圆即光带椭圆边缘。
   */
  private renderShapeSparks(
    ctx: CanvasRenderingContext2D,
    sparks: NonNullable<ShapeStep['sparks']>,
    local: number,
    radius: number,
  ): void {
    ctx.globalCompositeOperation = sparks.blend ?? 'lighter'; // 叠加混合可配置（缺省 lighter：叠加增亮，保证粒子亮度高于渐变底）
    const rgb = parseColorToRgba(sparks.color);
    const rgba = (a: number) =>
      rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${a})` : `rgba(255,255,255,${a})`;
    for (let i = 0; i < sparks.count; i++) {
      // 相位错开：各粒子生命起点均匀分布在一个周期内
      const t = local + (i / sparks.count) * sparks.life;
      const slot = Math.floor(t / sparks.life);          // 生命槽位（本轮方向种子）
      const p = (t - slot * sparks.life) / sparks.life;  // 槽内进度 0→1
      const angle = this.hash01(slot * 31 + i * 7) * Math.PI * 2; // 本轮扩散方向
      const reach = 0.75 + 0.25 * this.hash01(slot * 13 + i * 5); // 飞行距离 75%~100% 半径
      const dist = radius * reach * p;
      // 渐隐 + 轻微缩小：出生即峰值亮度，飞向边缘过程中消失
      const a = Math.max(0, 1 - p);
      ctx.fillStyle = rgba(a);
      ctx.beginPath();
      ctx.arc(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        Math.max(0.3, sparks.size * (1 - 0.4 * p)),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * 格子线离屏贴图（shape rect + grid）：横竖线按 gap 间隔、lineWidth 线宽，
   * 每条线段用 端点/中点 三档线性渐变近似椭圆径向衰减（与径向渐隐一致，线段边缘渐隐消失）。
   * 贴图按参数组合缓存复用，避免逐帧创建数十个渐变对象。
   */
  private gridTexture(
    grid: NonNullable<ShapeStep['grid']>,
    w: number,
    h: number,
  ): HTMLCanvasElement | null {
    const key = `${grid.gap}:${grid.lineWidth}:${grid.color}:${w}x${h}`;
    const hit = this.gridCache.get(key);
    if (hit !== undefined) return hit;
    const cvs = document.createElement('canvas');
    cvs.width = Math.max(1, Math.ceil(w));
    cvs.height = Math.max(1, Math.ceil(h));
    const g2 = cvs.getContext('2d');
    if (!g2) {
      this.gridCache.set(key, null);
      return null;
    }
    const rgb = parseColorToRgba(grid.color);
    // 整体强度系数 0.5：1px 亮线在 lighter 叠加下满 alpha 会过曝，降为质感层
    const c = (a: number) =>
      rgb
        ? `rgba(${rgb.r},${rgb.g},${rgb.b},${a * 0.5})`
        : `rgba(255,255,255,${a * 0.5})`;
    const rx = w / 2;
    const ry = h / 2;
    /** 椭圆归一化距离衰减：d≥1（椭圆上/外）→ 0，中心 → 1 */
    const fadeAt = (px: number, py: number) => Math.max(0, 1 - Math.hypot(px / rx, py / ry));
    g2.translate(cvs.width / 2, cvs.height / 2);
    g2.lineWidth = grid.lineWidth;
    // 竖线（y 方向渐变：上下端点必在椭圆上/外 → 透明，向中点渐亮）
    for (let x = -rx + grid.gap; x < rx - 1e-6; x += grid.gap) {
      const grad = g2.createLinearGradient(0, -ry, 0, ry);
      grad.addColorStop(0, c(fadeAt(x, -ry)));
      grad.addColorStop(0.5, c(fadeAt(x, 0)));
      grad.addColorStop(1, c(fadeAt(x, ry)));
      g2.strokeStyle = grad;
      g2.beginPath();
      g2.moveTo(x, -ry);
      g2.lineTo(x, ry);
      g2.stroke();
    }
    // 横线（x 方向渐变：左右端点同理）
    for (let y = -ry + grid.gap; y < ry - 1e-6; y += grid.gap) {
      const grad = g2.createLinearGradient(-rx, 0, rx, 0);
      grad.addColorStop(0, c(fadeAt(-rx, y)));
      grad.addColorStop(0.5, c(fadeAt(0, y)));
      grad.addColorStop(1, c(fadeAt(rx, y)));
      g2.strokeStyle = grad;
      g2.beginPath();
      g2.moveTo(-rx, y);
      g2.lineTo(rx, y);
      g2.stroke();
    }
    this.gridCache.set(key, cvs);
    return cvs;
  }

  /** 序列帧/单图贴图（在粒子层之上绘制） */
  renderSprites(ctx: CanvasRenderingContext2D, now: number): void {
    if (!this.prefab) return;
    const elapsed = (this.paused ? this.pauseAt : now) - this.startMs;
    ctx.save();
    for (const s of this.sprites) {
      const step = s.step;
      const frameMs = step.frameMs ?? 200;
      const frames = step.frames ?? (step.src ? [step.src] : []);
      if (frames.length === 0) continue;
      const lifeMs = step.life ?? frames.length * frameMs + 100;
      const t = elapsed - s.born;
      if (t < 0 || t > lifeMs) continue;

      const idx = Math.min(frames.length - 1, Math.floor(t / frameMs));
      const img = this.getImage(frames[idx]);
      if (!img.complete || img.naturalWidth === 0) continue;

      const size = SPRITE_BASE * (step.scale ?? 1);
      const x = this.prefab.anchor.x + (step.dx ?? 0);
      const y = this.prefab.anchor.y + (step.dy ?? 0);
      // 末段 300ms 淡出
      ctx.globalAlpha = t > lifeMs - 300 ? Math.max(0, (lifeMs - t) / 300) : 1;
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  }

  /**
   * Canvas2D 自由图形（shape 步骤）：编辑器原创图形元素。
   * 形状路径 + 呼吸缩放（scaleAmp/scaleFreq）+ 旋转（rotSpeed）+ 结尾淡出（fadeOut），
   * 全部参数存于步骤实例（不入 BALANCE_CONFIG）。在贴图层之上、浮动文字之下绘制。
   */
  renderShapes(ctx: CanvasRenderingContext2D, now: number): void {
    if (!this.prefab) return;
    const elapsed = (this.paused ? this.pauseAt : now) - this.startMs;
    for (const step of this.prefab.steps) {
      if (step.kind !== 'shape') continue;
      this.renderShapeStep(ctx, step, elapsed);
    }
  }

  /**
   * 可打点参数求值（关键帧"打点"，shape / marker 步骤共用）：keys[param] 存在时按 t 升序
   * 线性插值（端点外钳制），否则回退到步骤同名常量字段（缺省再用 fallback）。
   * progress = 窗口内归一化时间 0~1（shape 相对 duration，marker 相对 life）。
   */
  private evalShapeParam(
    step: KeyframableStep,
    key: ShapeKeyParam,
    progress: number,
    fallback = 0,
  ): number {
    const keys = step.keys?.[key];
    if (!keys || keys.length === 0) return step[key] ?? fallback;
    if (progress <= keys[0].t) return keys[0].v;
    const last = keys[keys.length - 1];
    if (progress >= last.t) return last.v;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (progress >= a.t && progress <= b.t) {
        const f = b.t > a.t ? (progress - a.t) / (b.t - a.t) : 0;
        return a.v + (b.v - a.v) * f;
      }
    }
    return last.v;
  }

  /** 单个自由图形步骤：窗口内按 缩放动画 → 旋转 → 透明度/淡出 合成绘制（数值参数支持关键帧打点插值） */
  private renderShapeStep(ctx: CanvasRenderingContext2D, step: ShapeStep, elapsed: number): void {
    if (!this.prefab) return;
    const local = elapsed - step.at;
    if (local < 0 || local > step.duration) return;
    // 窗口内归一化时间（关键帧求值基准）
    const progress = step.duration > 0 ? local / step.duration : 1;
    // 数值参数：有打点按关键帧插值，否则用常量（evalShapeParam 统一处理）
    const dx = this.evalShapeParam(step, 'dx', progress);
    const dy = this.evalShapeParam(step, 'dy', progress);
    const r = this.evalShapeParam(step, 'r', progress);
    const w = this.evalShapeParam(step, 'w', progress);
    const h = this.evalShapeParam(step, 'h', progress);
    const lineWidth = this.evalShapeParam(step, 'lineWidth', progress);
    const alpha = this.evalShapeParam(step, 'alpha', progress);
    const scaleAmp = this.evalShapeParam(step, 'scaleAmp', progress);
    const scaleFreq = this.evalShapeParam(step, 'scaleFreq', progress);
    const rotSpeed = this.evalShapeParam(step, 'rotSpeed', progress);

    const x = this.prefab.anchor.x + dx;
    const y = this.prefab.anchor.y + dy;
    const t = local / 1000;
    // 呼吸缩放（参考 breatheAmplitude/breatheTimeScale：1 + amp·sin(2π·freq·t)）
    const scale = 1 + scaleAmp * Math.sin(2 * Math.PI * scaleFreq * t);
    // 结尾线性淡出
    const fade =
      step.fadeOut > 0 && progress > 1 - step.fadeOut
        ? Math.max(0, (1 - progress) / step.fadeOut)
        : 1;
    // 整体透明度（alpha × 淡出）；三个元素的本层透明度（fillAlpha/grid.alpha/sparks.alpha）在各自绘制时与此叠乘
    const overall = Math.max(0, Math.min(1, alpha * fade));

    ctx.save();
    ctx.globalAlpha = overall;
    ctx.translate(x, y);
    if (rotSpeed !== 0) ctx.rotate(2 * Math.PI * rotSpeed * t);
    ctx.scale(scale, scale);
    ctx.fillStyle = step.color;
    ctx.strokeStyle = step.color;
    ctx.lineWidth = lineWidth;

    switch (step.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        if (step.fill) ctx.fill(); else ctx.stroke();
        break;
      case 'rect':
        if (step.fill && step.gradient === 'radial') {
          // 径向渐变填充：y 方向按 h/w 压缩坐标系，使圆形渐变呈椭圆恰好覆盖矩形四边
          // （中心实色 → 四周边缘透明；四角在椭圆外自然透明）
          const rgb = parseColorToRgba(step.color);
          ctx.save();
          ctx.scale(1, h / Math.max(w, 1e-6));
          // 叠加增亮：blend='lighter' 时渐变底以 lighter 混合绘制（粒子层恒为 lighter）
          if (step.blend === 'lighter') ctx.globalCompositeOperation = 'lighter';
          // 矩形本层透明度（与整体透明度叠乘）
          ctx.globalAlpha = overall * (step.fillAlpha ?? 1);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
          g.addColorStop(0, step.color);
          g.addColorStop(1, rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0)` : 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(-w / 2, -w / 2, w, w);
          ctx.restore();
          // 格子线覆盖层（正常坐标系：保持间隔/线宽真实；离屏贴图，叠加于渐变底之上）
          if (step.grid) {
            const tex = this.gridTexture(step.grid, w, h);
            if (tex) {
              ctx.save();
              if (step.blend === 'lighter') ctx.globalCompositeOperation = 'lighter';
              // 格子线本层透明度（与整体透明度叠乘）
              ctx.globalAlpha = overall * (step.grid.alpha ?? 1);
              ctx.drawImage(tex, -w / 2, -h / 2, w, h);
              ctx.restore();
            }
          }
          // 扩散粒子：中心向四周扩散渐隐（y 压缩坐标系内，半径 w/2 的圆即椭圆边缘；最顶层）
          if (step.sparks) {
            ctx.save();
            ctx.scale(1, h / Math.max(w, 1e-6));
            // 粒子本层透明度（与整体透明度叠乘；粒子 rgba 再乘此值）
            ctx.globalAlpha = overall * (step.sparks.alpha ?? 1);
            this.renderShapeSparks(ctx, step.sparks, local, w / 2);
            ctx.restore();
          }
        } else {
          ctx.beginPath();
          ctx.rect(-w / 2, -h / 2, w, h);
          if (step.fill) {
            // 普通填充同样应用矩形本层透明度
            ctx.globalAlpha = overall * (step.fillAlpha ?? 1);
            ctx.fill();
          } else {
            ctx.stroke();
          }
        }
        break;
      case 'ring':
        // 圆环固定描边（lineWidth 即环宽）
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.866, r * 0.5);
        ctx.lineTo(-r * 0.866, r * 0.5);
        ctx.closePath();
        if (step.fill) ctx.fill(); else ctx.stroke();
        break;
    }
    ctx.restore();
  }

  /**
   * 渲染器直连特效（vfx 步骤）：调用游戏真实渲染函数绘制非粒子特效。
   * 在标注层之上、粒子层之下绘制（光环为地面效果）。
   */
  renderVfx(ctx: CanvasRenderingContext2D, now: number): void {
    if (!this.prefab) return;
    const elapsed = (this.paused ? this.pauseAt : now) - this.startMs;
    for (const step of this.prefab.steps) {
      if (step.kind !== 'vfx') continue;
      const local = elapsed - step.at;
      if (local < 0 || local > step.duration) continue;
      const x = this.prefab.anchor.x + (step.dx ?? 0);
      const y = this.prefab.anchor.y + (step.dy ?? 0);
      const t = local / 1000;
      switch (step.fn) {
        case 'nurseHealAura': this.renderNurseHealAura(ctx, x, y, local); break;
        case 'flameCone': this.renderFlameCone(ctx, x, y, t, step); break;
        case 'muzzleFlash': this.renderMuzzleFlash(ctx, x, y, t); break;
        case 'fireWall': this.renderFireWall(ctx, x, y, t); break;
        case 'swatter': this.renderSwatter(ctx, x, local, step.duration); break;
        case 'radarLaser': this.renderRadarLaser(ctx, x, y, t); break;
        case 'insecticideSpray': this.renderInsecticideSpray(ctx, local, step.duration, t); break;
        case 'fan': this.renderFan(ctx, t); break;
        case 'baitThrow': this.renderBaitThrow(ctx, x, y, local, step.duration, t); break;
        case 'baitAura': this.renderBaitAura(ctx, x, y, t); break;
        case 'defenseShield': this.renderDefenseShield(ctx, t); break;
        case 'stickyDrop': this.renderStickyDrop(ctx, x, y, t); break;
        case 'weaponDrop': this.renderWeaponDrop(ctx, x, y, t, step); break;
        case 'slimeBurst': this.renderSlimeBurst(ctx, x, y, local, step.duration); break;
        case 'healBuff': this.renderHealBuff(ctx, x, y, t); break;
        case 'armorRing': this.renderArmorRing(ctx, x, y, t); break;
        case 'armorCastRing': this.renderArmorCastRing(ctx, x, y, local); break;
        case 'breachWarning': this.renderBreachWarning(ctx, x, y, t); break;
        case 'timedBomb': this.renderTimedBomb(ctx, x, y, local); break;
      }
    }
  }

  /**
   * 护士治疗光环：按时间轴位置推导 3 阶段（charging → spraying → dissipating），
   * 构造虚拟护士蟑螂调用真实 NurseRenderer.renderNurseHealVFX。
   * healPhaseTimer 语义与游戏一致：阶段内倒计时（时长 → 0）。
   * 脉冲动画的时间参数取时间轴秒数，暂停/seek 时动画随之冻结（与模拟时钟同步）。
   */
  private renderNurseHealAura(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    localMs: number,
  ): void {
    const phaseCfg = BALANCE_CONFIG.roachAI.nurseHealPhases;
    const t = localMs / 1000;
    const chEnd = phaseCfg.charging;
    const spEnd = chEnd + phaseCfg.spraying;
    const diEnd = spEnd + phaseCfg.dissipating;

    let healPhase: 'charging' | 'spraying' | 'dissipating';
    let healPhaseTimer: number;
    if (t < chEnd) {
      healPhase = 'charging';
      healPhaseTimer = chEnd - t;
    } else if (t < spEnd) {
      healPhase = 'spraying';
      healPhaseTimer = spEnd - t;
    } else if (t < diEnd) {
      healPhase = 'dissipating';
      healPhaseTimer = diEnd - t;
    } else {
      return; // 阶段全部结束（预制体循环留白）
    }

    const fakeNurse = {
      type: RoachType.NURSE,
      state: RoachState.ALIVE,
      healPhase,
      healPhaseTimer,
      x,
      y,
    } as unknown as Roach;
    NurseRenderer.renderNurseHealVFX(ctx, [fakeNurse], t);
  }

  /**
   * 喷火枪火焰锥：直接调用游戏真实 BackgroundRenderer.renderFireZones
   * （锥形分段条带 + 喷嘴核心辉光；颜色随 currentWeapon 变体切换）。
   * 构造虚拟玩家：持续开火、燃气充足、不过热；射程由 step.params.range 驱动。
   */
  private renderFlameCone(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
    step: VfxStep,
  ): void {
    const fakePlayer = {
      x,
      y,
      isFiring: true,
      isOverheated: false,
      isReloading: false,
      gas: 100,
      fireRange: step.params?.range ?? 200,
      currentWeapon: step.params?.weapon ?? 'flamethrower',
      powerBoostTimer: 0,
    } as unknown as Player;
    BackgroundRenderer.renderFireZones(ctx, {
      player: fakePlayer,
      tripleFlameState: { active: false, sideOffset: 0 },
      time: t,
    });
  }

  /**
   * 枪口强化粒子：直接调用游戏真实 RenderUtils.renderMuzzleFlash
   * （Power Boost 状态下喷嘴的橙色粒子喷射 + 辉光）。
   * powerBoostTimer 循环播放使其持续可见。
   */
  private renderMuzzleFlash(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const fade = BALANCE_CONFIG.render.renderUtils.muzzleFlash.boostAlphaFadeTime;
    const fakePlayer = {
      x,
      y,
      isFiring: true,
      isOverheated: false,
      isReloading: false,
      gas: 100,
      powerBoostTimer: Math.max(0.05, fade - (t % fade)),
    } as unknown as Player;
    RenderUtils.renderMuzzleFlash(ctx, fakePlayer, { active: false, sideOffset: 0 } as unknown as TripleFlameState);
  }

  /**
   * 火墙：直接调用游戏真实 ParticleSystem.renderFireWalls
   * （分段火柱 + 边缘柔化 + 核心亮线 + 外辉光 + 余烬火花 + 时长文字）。
   * life 循环播放模拟持续燃烧。
   */
  private renderFireWall(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const maxLife = 8;
    const wall: FireWall = {
      y,
      x1: x - 180,
      x2: x + 180,
      height: 26,
      damagePerSecond: 0,
      life: maxLife - (t % maxLife),
      maxLife,
    };
    ParticleSystem.renderFireWalls(ctx, [wall], t);
  }

  /**
   * 电蚊拍：直接调用游戏真实 RenderUtils.renderSwatter
   * （拍头扫落 + 网格 + 手柄 + 电弧），animTimer 按 animDuration 循环。
   */
  private renderSwatter(ctx: CanvasRenderingContext2D, x: number, localMs: number, durationMs: number): void {
    const animDuration = BALANCE_CONFIG.render.renderUtils.swatter.animDuration;
    const cycle = Math.max(animDuration * 1000, durationMs);
    const animTimer = Math.max(0, animDuration - (localMs % cycle) / 1000);
    RenderUtils.renderSwatter(ctx, {
      active: true,
      animTimer,
      swingX: x,
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      roaches: [],
    });
  }

  /**
   * 雷达激光：直接调用游戏真实 RenderUtils.renderRadarLaser
   * （三层辉光射线 + 脉冲），虚拟目标悬于锚点上方。
   */
  private renderRadarLaser(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const target = {
      x: x + 60,
      y: y - 180,
      type: RoachType.SMALL,
      state: RoachState.ALIVE,
    } as unknown as Roach;
    RenderUtils.renderRadarLaser(ctx, target, true, 1.0, x, y, t);
  }

  /**
   * 杀虫喷雾：直接调用游戏真实 RenderUtils.renderInsecticideSpray
   * （120° 喷雾锥 + 边界线 + 中心虚线 + 喷嘴辉光 + 计时文字）。
   * 渲染原点固定为画布底部中央（与游戏一致：cx=canvasWidth/2, cy=defenseLineY），忽略锚点。
   */
  private renderInsecticideSpray(ctx: CanvasRenderingContext2D, localMs: number, durationMs: number, t: number): void {
    const duration = 3;
    const cycle = Math.max(duration * 1000, durationMs);
    const timer = Math.max(0, duration - (localMs % cycle) / 1000);
    const state: InsecticideSprayState = {
      active: true,
      timer,
      duration,
      damageInterval: 0.3,
      damageTimer: 0,
      baseDamage: 2,
    };
    RenderUtils.renderInsecticideSpray(ctx, state, CANVAS_W, DEFENSE_Y, t);
  }

  /**
   * 风扇：直接实例化游戏真实 FanSystem（透视气流线 + 阵风前沿 + 悬浮粒子 + 风扇图标/叶片）。
   * 懒创建实例并激活；渲染时按固定步长推进 updateFan 驱动叶片旋转，计时耗尽后自动重新激活形成循环。
   */
  private fanPreview: FanSystem | null = null;

  private renderFan(ctx: CanvasRenderingContext2D, t: number): void {
    if (!this.fanPreview) {
      this.fanPreview = new FanSystem({
        getCanvasWidth: () => CANVAS_W,
        getCanvasHeight: () => CANVAS_H,
        getDefenseLineY: () => DEFENSE_Y,
      });
      this.fanPreview.activateFan();
    }
    if (!this.fanPreview.isActive()) this.fanPreview.activateFan();
    this.fanPreview.updateFan(DT, []);
    this.fanPreview.renderFan(ctx, t);
  }

  /**
   * 诱饵投掷：直接调用游戏真实 ConsumableSystem.renderBaitThrow
   * （玻璃罐飞行 + 地面阴影 + 拖尾点）。抛物线从锚点下方（玩家位）飞向锚点（落点）。
   */
  private renderBaitThrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    localMs: number,
    durationMs: number,
    t: number,
  ): void {
    const flight = Math.max(0.8, durationMs / 1000);
    const p = Math.min(1, (localMs / 1000) / flight);
    const startX = x + 100;
    const startY = y + 160;
    const jarX = startX + (x - startX) * p;
    const jarY = startY + (y - startY) * p - Math.sin(p * Math.PI) * 80;
    ConsumableSystem.renderBaitThrow(ctx, {
      active: true,
      x: jarX,
      y: jarY,
      targetX: x,
      targetY: y,
      timer: 0.8 * (1 - p),
    }, t);
  }

  /**
   * 诱饵光环：直接调用游戏真实 ConsumableSystem.renderBaitMark
   * （琥珀色香味光环 + 环绕玻璃碎片）。baitTimer 循环驱动碎片渐隐。
   */
  private renderBaitAura(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const baitTimer = 3 - (t % 2.5);
    ConsumableSystem.renderBaitMark(ctx, { active: true, x, y }, baitTimer, t);
  }

  /**
   * 防线能量护盾：直接调用游戏真实 RenderUtils.renderDefenseLine
   * （流动虚线 + 底部填充 + 标签 + 护盾辉光线）。使用厨房场景的红色防线配色。
   */
  private renderDefenseShield(ctx: CanvasRenderingContext2D, t: number): void {
    RenderUtils.renderDefenseLine(ctx, CANVAS_W, DEFENSE_Y, 'rgba(239, 68, 68, 0.7)', t, 1.0);
  }

  /**
   * 粘性弹丸：直接调用游戏真实 DropRenderer.renderStickyDrops
   * （外部辉光 + 主体液滴 + 高光 + 速度拖尾）。构造飞行中（未命中）的虚拟弹丸，
   * 以锚点为原点做小幅往复漂移（vx/vy 驱动拖尾方向）。
   */
  private renderStickyDrop(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const drop: StickyDrop = {
      id: 1,
      x: x + Math.sin(t * 1.6) * 40,
      y: y + Math.cos(t * 1.1) * 26 - 20,
      vx: Math.cos(t * 1.6) * 60,
      vy: -Math.sin(t * 1.1) * 50,
      targetId: null,
      speed: 200,
      life: 5,
      maxLife: 5,
      size: 8,
      hit: false,
    };
    DropRenderer.renderStickyDrops(ctx, [drop], [], t, DT);
  }

  /**
   * 武器掉落物：直接调用游戏真实 DropRenderer.renderWeaponDrops
   * （呼吸缩放 + 左右摇摆 + 倾斜 + 辉光环 + 名称标签；无图时回退彩色方块）。
   * bobPhase 由时间轴驱动，life 保持高位保证 alpha=1；类型由 step.params.type 指定。
   */
  private renderWeaponDrop(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
    step: VfxStep,
  ): void {
    const type = (step.params?.type ?? 'molotov') as WeaponDrop['type'];
    const drop: WeaponDrop = {
      id: 1,
      x,
      y,
      type,
      life: 99,
      maxLife: 99,
      bobPhase: t * 2.2,
    };
    DropRenderer.renderWeaponDrops(ctx, [drop], t);
  }

  /**
   * 变异粘液爆发：忠实复刻 engine.ts:4480-4535「MUTANT SPAWN: Green slime burst visual」
   * （中央绿光 + 12 粘液滴（辉光+实心核） + 外圈粘液环）。
   * 游戏内由 roachAISystem.slimeBurstTimer 驱动（1.2s 进程），此处按时间轴循环。
   */
  private renderSlimeBurst(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    localMs: number,
    durationMs: number,
  ): void {
    // 参数见 BALANCE_CONFIG.slimeBurst
    const SB = BALANCE_CONFIG.slimeBurst;
    const cycle = Math.max(SB.duration * 1000, durationMs);
    const progress = ((localMs % cycle) / 1000) / SB.duration; // 0→1 over 1.2s（与游戏一致）
    if (progress > 1) return;
    const alpha = Math.max(0, 1 - progress * SB.alphaFade);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // 1. Central green glow
    const glowR = SB.glowRadiusBase + progress * SB.glowRadiusGrowth;
    const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    glowGrad.addColorStop(0, `rgba(${SB.glowColorInner}, ${alpha * SB.glowAlphaInner})`);
    glowGrad.addColorStop(SB.glowMidStop, `rgba(${SB.glowColorMid}, ${alpha * SB.glowAlphaMid})`);
    glowGrad.addColorStop(1, `rgba(${SB.glowColorEdge}, 0)`);
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 2. Green slime droplets spreading outward
    const dropCount = SB.emitter.dropCount;
    for (let di = 0; di < dropCount; di++) {
      const baseAngle = (di / dropCount) * Math.PI * 2 + di * SB.emitter.dropAngleJitter;
      const spreadDist = progress * SB.dropSpreadDist;
      const dropX = x + Math.cos(baseAngle) * spreadDist;
      const dropY = y + Math.sin(baseAngle) * spreadDist * SB.dropYScale;
      const dropSize = (SB.dropSizeBase + di % 3 * SB.dropSizeStep) * (1 - progress * SB.dropSizeFade);
      const dropAlpha = alpha * (SB.dropAlphaBase + (di % 3) * SB.dropAlphaStep);

      // Glow behind each droplet
      const dGlow = ctx.createRadialGradient(dropX, dropY, 0, dropX, dropY, dropSize * SB.dropGlowScale);
      dGlow.addColorStop(0, `rgba(${SB.dropGlowColor}, ${dropAlpha * SB.dropGlowAlpha})`);
      dGlow.addColorStop(1, `rgba(${SB.dropGlowEdgeColor}, 0)`);
      ctx.fillStyle = dGlow;
      ctx.beginPath();
      ctx.arc(dropX, dropY, dropSize * SB.dropGlowScale, 0, Math.PI * 2);
      ctx.fill();

      // Solid droplet core
      ctx.fillStyle = `rgba(${SB.dropCoreColor}, ${dropAlpha})`;
      ctx.beginPath();
      ctx.arc(dropX, dropY, dropSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Outer slime ring
    const ringR = SB.ringRadiusBase + progress * SB.ringRadiusGrowth;
    ctx.strokeStyle = `rgba(${SB.ringColor}, ${alpha * SB.ringAlpha})`;
    ctx.lineWidth = SB.ringLineWidth;
    ctx.beginPath();
    ctx.ellipse(x, y, ringR, ringR * SB.ringYScale, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 治疗 BUFF：忠实复刻 engine.ts:4537-4620「HEAL BUFF: Rising green plus signs」
   * （绿色光晕 + 脉冲光环 + 4 个上升旋转 + 号（带发光/白芯） + 身体绿色染色）。
   * buffProgress 循环驱动（2s 一轮，与游戏 healBuffTimer 时长一致）。
   */
  private renderHealBuff(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    // 参数见 BALANCE_CONFIG.healBuff
    const HB = BALANCE_CONFIG.healBuff;
    const buffProgress = 1 - (t % HB.duration) / HB.duration; // 1→0（与游戏 healBuffTimer/2.0 一致）
    const baseAlpha = HB.baseAlphaMax * buffProgress;
    const size = 30;
    const fakeId = 1;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // 1. Large green glow halo around healed roach
    const haloR = size * HB.haloRadiusRatio;
    const haloGrad = ctx.createRadialGradient(x, y, 0, x, y, haloR * 2);
    haloGrad.addColorStop(0, `rgba(${HB.haloColorInner}, ${baseAlpha * HB.haloAlphaInner})`);
    haloGrad.addColorStop(HB.haloMidStop, `rgba(${HB.haloColorMid}, ${baseAlpha * HB.haloAlphaMid})`);
    haloGrad.addColorStop(1, `rgba(${HB.haloColorEdge}, 0)`);
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, haloR * 2, haloR * 2 * HB.haloYScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Outer pulsing ring
    const pulseRingR = size * (HB.ringRadiusBase + Math.sin(t * HB.ringPulseFreq) * HB.ringRadiusAmp);
    ctx.strokeStyle = `rgba(${HB.ringColor}, ${baseAlpha * HB.ringAlpha})`;
    ctx.lineWidth = HB.ringLineWidth;
    ctx.shadowColor = `rgba(${HB.ringShadowColor}, ${baseAlpha})`;
    ctx.shadowBlur = HB.ringShadowBlur;
    ctx.beginPath();
    ctx.ellipse(x, y, pulseRingR, pulseRingR * HB.ringYScale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Rising green plus signs (large + strong glow)
    const plusCount = HB.emitter.plusCount;
    for (let pi = 0; pi < plusCount; pi++) {
      const cycleOffset = pi * (HB.emitter.plusCycle / plusCount);
      const cycleTime = (t + cycleOffset + fakeId * HB.plusIdPhase) % HB.emitter.plusCycle;
      const riseProgress = cycleTime / HB.emitter.plusCycle;

      const riseHeight = HB.plusRiseHeight;
      const plusY = y - riseProgress * riseHeight;
      const orbitAngle = t * HB.plusOrbitSpeed + pi * HB.emitter.plusOrbitSpread + fakeId;
      const orbitR = HB.plusOrbitRadius * (HB.plusOrbitBase + riseProgress);
      const plusX = x + Math.cos(orbitAngle) * orbitR;

      const plusAlpha = baseAlpha * Math.min(1, riseProgress * HB.plusAlphaRiseRate) * (1 - Math.pow(riseProgress, HB.plusAlphaFallExp));
      if (plusAlpha <= HB.plusAlphaMin) continue;

      const plusSize = HB.plusSizeBase + riseProgress * HB.plusSizeGrowth;

      ctx.save();
      ctx.translate(plusX, plusY);
      ctx.rotate(Math.sin(t * HB.plusRotateSpeed + pi + fakeId) * HB.plusRotateAmp);

      // Strong outer glow
      ctx.shadowColor = `rgba(${HB.plusGlowColor}, ${plusAlpha})`;
      ctx.shadowBlur = HB.plusGlowBlur;

      // Thick green plus sign
      ctx.fillStyle = `rgba(${HB.plusColor}, ${plusAlpha})`;
      const barW = Math.max(HB.plusBarWidthMin, plusSize * HB.plusBarWidthRatio);
      const barL = plusSize;
      ctx.fillRect(-barW / 2, -barL / 2, barW, barL);
      ctx.fillRect(-barL / 2, -barW / 2, barL, barW);

      // Bright white center
      ctx.shadowBlur = HB.plusCenterGlowBlur;
      ctx.shadowColor = `rgba(${HB.plusCenterGlowColor}, ${plusAlpha})`;
      ctx.fillStyle = `rgba(${HB.plusCenterColor}, ${plusAlpha * HB.plusCenterAlpha})`;
      const cw = barW * HB.plusCenterScale;
      ctx.fillRect(-cw / 2, -cw / 2, cw, cw);

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 4. Bright green tint overlay on roach body
    ctx.fillStyle = `rgba(${HB.tintColor}, ${baseAlpha * HB.tintAlpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size * HB.tintWRatio, size * HB.tintHRatio, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 护甲六边形护盾：忠实复刻 RoachRenderer.ts「ARMOR SHIELD EFFECT」
   * （半透明玻璃质感：六边形渐变填充 + 清晰描边 + 顶部反光带；颜色/脉冲/线宽取 BALANCE_CONFIG.render.roach.shield 普通款）。
   */
  private renderArmorRing(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const sc = BALANCE_CONFIG.render.roach.shield;
    const color = sc.normalColor;
    const fakeId = 1;
    const size = 30;
    const w = size * BALANCE_CONFIG.render.roach.bodyWidthRatio;
    const h = size;

    const shieldPulse = sc.normalPulseBase + Math.sin(t * 4 + fakeId) * 0.15;
    const shieldR = Math.max(w, h) * sc.normalRadiusRatio;
    const g = sc.glass;
    ctx.save();
    ctx.globalCompositeOperation = sc.normalBlend; // 玻璃质感 source-over（与游戏同源）
    ctx.translate(x, y);
    // 六边形玻璃罩路径
    ctx.beginPath();
    for (let si = 0; si < 6; si++) {
      const sAngle = (si / 6) * Math.PI * 2 + t * 0.5;
      const sx = Math.cos(sAngle) * shieldR;
      const sy = Math.sin(sAngle) * shieldR;
      if (si === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    // 1) 半透明玻璃填充（纵向渐变：顶部偏白反光 → 中部微染色 → 底部略深）
    const glassGrad = ctx.createLinearGradient(0, -shieldR, 0, shieldR);
    glassGrad.addColorStop(0, `rgba(${g.reflection.color}, ${g.topAlpha})`);
    glassGrad.addColorStop(g.midStop, `rgba(${color}, ${g.midAlpha})`);
    glassGrad.addColorStop(1, `rgba(${color}, ${g.bottomAlpha})`);
    ctx.fillStyle = glassGrad;
    ctx.fill();
    // 2) 清晰玻璃边缘描边（轻微脉动，无辉光）
    ctx.strokeStyle = `rgba(${color}, ${Math.min(1, shieldPulse + g.edgeAlphaBoost)})`;
    ctx.lineWidth = sc.normalLineWidth;
    ctx.stroke();
    // 3) 顶部反光带（裁剪在六边形内的椭圆弧，上深下浅渐隐）
    ctx.clip();
    const refl = g.reflection;
    const ry = -shieldR * refl.yRatio;
    ctx.beginPath();
    ctx.ellipse(0, ry, shieldR * refl.rxRatio, shieldR * refl.ryRatio, 0, 0, Math.PI * 2);
    const reflGrad = ctx.createLinearGradient(0, ry - shieldR * refl.ryRatio, 0, ry + shieldR * refl.ryRatio);
    reflGrad.addColorStop(0, `rgba(${refl.color}, ${refl.alpha})`);
    reflGrad.addColorStop(1, `rgba(${refl.color}, 0)`);
    ctx.fillStyle = reflGrad;
    ctx.fill();
    ctx.restore();
  }

  /**
   * 隧道工施法警示光圈：忠实复刻 RoachRenderer.ts:673-695 armorSprayCastTimer 脉冲。
   * 喷涂瞬间一次范围光圈：半径 20%→100% 射程扩散、渐隐（0.9s 进程），
   * 地面透视压扁椭圆（径向渐变填充 + 内圈描边），参数实时读取 BALANCE_CONFIG.subway.armorSprayRange。
   */
  private renderArmorCastRing(ctx: CanvasRenderingContext2D, x: number, y: number, localMs: number): void {
    const ring = BALANCE_CONFIG.render.roach.armorCastRing; // 与游戏同源（vfx-balance）
    const castRange = BALANCE_CONFIG.subway.armorSprayRange;
    const progress = Math.min(1, Math.max(0, localMs / (ring.duration * 1000))); // 与游戏 1 - castTimer/duration 一致
    const ringScale = ring.startScale + progress * (1 - ring.startScale); // 从起始比例扩散到 100%
    const ringAlpha = (1 - progress) * ring.maxAlpha;                  // 渐隐
    const rangeR = castRange * ringScale;
    const dy = 60 * ring.footOffsetRatio; // 游戏内为蟑螂体高 × footOffsetRatio，编辑器体高近似 60px
    ctx.save();
    ctx.globalCompositeOperation = ring.blend; // lighter 叠加提亮（与游戏同源）
    ctx.translate(x, y);
    const grad = ctx.createRadialGradient(0, dy, rangeR * ring.gradInnerRatio, 0, dy, rangeR);
    grad.addColorStop(0, `rgba(${ring.colorMid}, 0)`);
    grad.addColorStop(ring.stopMid, `rgba(${ring.colorMid}, ${ringAlpha * ring.fillMidAlphaRatio})`);
    grad.addColorStop(ring.stopEdge, `rgba(${ring.colorEdge}, ${ringAlpha * ring.fillEdgeAlphaRatio})`);
    grad.addColorStop(1, `rgba(${ring.colorTip}, ${ringAlpha * ring.fillTipAlphaRatio})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, dy, rangeR, rangeR * ring.flatten, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${ring.colorEdge}, ${ringAlpha * ring.strokeAlphaRatio})`;
    ctx.lineWidth = ring.lineWidth;
    ctx.beginPath();
    ctx.ellipse(0, dy, rangeR * ring.strokeScale, rangeR * ring.strokeFlatten, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 螂家爆破预警：忠实复刻 RoachRenderer.ts:853-887 TIMED_SUICIDE「warning」阶段
   * （背部红色闪烁灯 3Hz + 地面不规则虚线危险圈（40px，滚动虚线） + 抖动倒计时数字）。
   */
  private renderBreachWarning(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    // 参数见 BALANCE_CONFIG.timedBomb.warning
    const W = BALANCE_CONFIG.timedBomb.warning;
    const h = 30; // 蟑螂体高（与 size 一致）
    const fakeId = 1;
    ctx.save();
    ctx.translate(x, y);

    // Red blinking light on back (3Hz rapid flash)
    const blink = Math.sin(t * W.blinkFreq) > 0 ? 1 : W.blinkOffAlpha;
    ctx.fillStyle = `rgba(${W.lightColor}, ${blink})`;
    ctx.beginPath();
    ctx.arc(0, -h * W.lightYRatio, W.lightRadius, 0, Math.PI * 2);
    ctx.fill();

    // Danger circle on ground (40px radius, irregular, 60% alpha)
    ctx.save();
    ctx.translate(0, h * W.circleYRatio);
    ctx.strokeStyle = `rgba(${W.circleColor}, ${W.circleAlpha})`;
    ctx.lineWidth = W.circleLineWidth;
    ctx.setLineDash([...W.circleDash]);
    ctx.lineDashOffset = -t * W.circleDashSpeed;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2; a += W.circleAngleStep) {
      const rough = 1 + Math.sin(a * W.circleRoughFreq + fakeId) * W.circleRoughAmp;
      const rx = Math.cos(a) * W.circleRadiusX * rough;
      const ry = Math.sin(a) * W.circleRadiusY * rough;
      if (a === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Countdown number (dark red, slight jitter) — 3→1 循环
    const countdown = 3 - Math.floor(t % 3);
    const jitterX = Math.sin(t * W.jitterXFreq) * W.jitterXAmp;
    const jitterY = Math.cos(t * W.jitterYFreq) * W.jitterYAmp;
    ctx.font = RENDER_FONT.large;
    ctx.textAlign = 'center';
    ctx.fillStyle = RENDER_COLOR.bombCountdown;
    ctx.fillText(`${countdown}`, jitterX, -h * W.countdownYRatio + jitterY);

    ctx.restore();
  }

  /**
   * 定时炸弹倒计时：忠实复刻 engine.ts:4355-4413 placedBombs 渲染
   * （火焰辉光脉冲（随紧迫度增强） + bomb.png 64px + 缩放倒计时数字（1.8→3.3x，最后 1s 变红）
   *   + 最后 1s 紧急闪烁环）。3s 引信循环播放。
   */
  private renderTimedBomb(ctx: CanvasRenderingContext2D, x: number, y: number, localMs: number): void {
    // 参数见 BALANCE_CONFIG.timedBomb.placed
    const P = BALANCE_CONFIG.timedBomb.placed;
    const fuse = P.fuseDuration * 1000;
    const timer = Math.max(0.01, (fuse - (localMs % fuse)) / 1000); // 3→0（与游戏 bomb.timer 语义一致）
    const t = localMs / 1000;
    const bombSize = P.bombSize;
    const img = this.getImage('/assets/bomb.png');

    ctx.save();
    ctx.translate(x, y);

    // Fire glow pulse (intensifies as timer counts down)
    const secs = Math.ceil(timer);
    const urgency = Math.max(0, 1 - timer / P.fuseDuration); // 0→1 as timer goes 3→0
    const pulseRadius = bombSize * P.glowRadiusRatio + urgency * P.glowRadiusUrgency + Math.sin(t * P.glowPulseFreq) * urgency * P.glowPulseAmp;
    const glowAlpha = P.glowAlphaBase + urgency * P.glowAlphaUrgency;
    const fireGradient = ctx.createRadialGradient(0, 0, bombSize * P.glowInnerRatio, 0, 0, pulseRadius);
    fireGradient.addColorStop(0, `rgba(${P.glowColorInner}, ${glowAlpha})`);
    fireGradient.addColorStop(0.5, `rgba(${P.glowColorMid}, ${glowAlpha * P.glowMidAlphaRatio})`);
    fireGradient.addColorStop(1, `rgba(${P.glowColorEdge}, 0)`);
    ctx.fillStyle = fireGradient;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bomb image
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -bombSize / 2, -bombSize / 2, bombSize, bombSize);
    } else {
      ctx.fillStyle = P.fallbackColor;
      ctx.beginPath();
      ctx.arc(0, 0, bombSize / P.fallbackRadiusRatio, 0, Math.PI * 2);
      ctx.fill();
    }

    // Countdown number with zoom effect (scales up as timer decreases)
    const countColor = timer <= P.urgentThreshold ? P.countdownUrgentColor : P.countdownColor;
    const countScale = P.countdownScaleBase + urgency * P.countdownScaleUrgency; // 1.8→3.3x scale (1.5× enlarged)
    ctx.save();
    ctx.scale(countScale, countScale);
    ctx.font = P.countdownFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = countColor;
    ctx.strokeStyle = P.countdownStrokeColor;
    ctx.lineWidth = P.countdownLineWidth;
    ctx.shadowColor = P.countdownShadowColor;
    ctx.shadowBlur = P.countdownShadowBlur;
    const countY = (-bombSize / 2 - P.countdownYOffset) / countScale;
    ctx.strokeText(`${secs}`, 0, countY);
    ctx.fillText(`${secs}`, 0, countY);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Urgent flash ring at last second
    if (timer <= P.urgentThreshold) {
      const flashAlpha = P.flashAlphaBase + Math.sin(t * P.flashFreq) * P.flashAlphaAmp;
      ctx.strokeStyle = `rgba(${P.flashColor}, ${flashAlpha})`;
      ctx.lineWidth = P.flashLineWidth;
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius * P.flashRadiusRatio, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** 浮动文字（最上层，游戏同款描边渲染） */
  renderTexts(ctx: CanvasRenderingContext2D): void {
    ParticleSystem.renderFloatingTexts(ctx, this.floatTexts);
  }

  // ========== 贴图缓存 ==========

  private preloadSprite(step: SpriteStep): void {
    for (const src of step.frames ?? (step.src ? [step.src] : [])) this.getImage(src);
  }

  private getImage(src: string): HTMLImageElement {
    let img = this.imgCache.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      this.imgCache.set(src, img);
    }
    return img;
  }
}
