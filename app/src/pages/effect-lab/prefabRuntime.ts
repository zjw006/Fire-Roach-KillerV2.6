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
  MarkerStep,
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
        // coneFire / shieldAura / armorSpray 为持续型，burst 退化为 1 帧窗口
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
      case 'shieldAura':
        ParticleSpawner.spawnShieldAura(particles, x, y, step.hw ?? 100);
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
      // ConsumableSystem:447 诱饵罐破碎：15 黄色爆裂(EMBER) + 8 玻璃碎片(SPARK)
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 60;
        particles.push({
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist * 0.3,
          vx: Math.cos(angle) * (30 + Math.random() * 40),
          vy: Math.sin(angle) * (15 + Math.random() * 25) - 20,
          life: 1.5 + Math.random(),
          maxLife: 2.5,
          color: RENDER_COLOR.armorStart,
          size: 2 + Math.random() * 3,
          type: ParticleType.EMBER,
        });
      }
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * (40 + Math.random() * 60),
          vy: Math.sin(angle) * (20 + Math.random() * 30) - 30,
          life: 1 + Math.random() * 0.8,
          maxLife: 1.8,
          color: '#e5e7eb',
          size: 1 + Math.random() * 2,
          type: ParticleType.SPARK,
        });
      }
    } else if (step.fn === 'breachFlash') {
      // engine.ts:3230 防线爆闪：3 层火焰闪光覆盖 + 15 块碎片
      for (let fi = 0; fi < 3; fi++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 30,
          y: y + (Math.random() - 0.5) * 20,
          vx: 0,
          vy: 0,
          life: 0.2 + fi * 0.1,
          maxLife: 0.2 + fi * 0.1,
          size: 60 + fi * 30,
          color: `rgba(255, ${180 - fi * 40}, ${50 - fi * 20}, ${0.5 - fi * 0.1})`,
          type: ParticleType.EXPLOSION,
        });
      }
      for (let d = 0; d < 15; d++) {
        const angle = (d / 15) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 100 + Math.random() * 150;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 30,
          life: 0.8 + Math.random() * 0.5,
          maxLife: 1.3,
          size: 3 + Math.random() * 6,
          color: `rgba(${200 + Math.floor(Math.random() * 55)}, ${100 + Math.floor(Math.random() * 80)}, 0, 0.9)`,
          type: ParticleType.ASH,
        });
      }
    }
  }

  /** 持续型 custom（窗口内每帧调用） */
  private spawnCustomTick(step: CustomStep, x: number, y: number, particles: Particle[]): void {
    if (step.fn === 'baitSmell') {
      // ConsumableSystem:357 诱饵持续气味（每帧 2 个）
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 30,
          y: y - Math.random() * 10,
          vx: (Math.random() - 0.5) * 8,
          vy: -(15 + Math.random() * 20),
          life: 1.2 + Math.random() * 0.8,
          maxLife: 2,
          color: Math.random() < 0.5 ? RENDER_COLOR.armorStart : '#fcd34d',
          size: 2 + Math.random() * 2.5,
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
          color: Math.random() < 0.3 ? RENDER_COLOR.fanWaveSecondary : RENDER_COLOR.fanWavePrimary,
          type: ParticleType.SMOKE,
        });
      }
    }
  }

  // ========== 渲染 ==========

  /** 区域/目标标注（在粒子层之下绘制） */
  renderMarkers(ctx: CanvasRenderingContext2D, now: number): void {
    if (!this.prefab) return;
    const elapsed = (this.paused ? this.pauseAt : now) - this.startMs;
    ctx.save();
    for (const m of this.markers) {
      const lifeMs = m.step.life ?? 800;
      const t = (elapsed - m.born) / lifeMs;
      if (t < 0 || t > 1) continue;
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      const x = this.prefab.anchor.x + (m.step.dx ?? 0);
      const y = this.prefab.anchor.y + (m.step.dy ?? 0);
      ctx.globalAlpha = Math.max(0, alpha) * 0.9;
      ctx.strokeStyle = m.step.color;
      ctx.fillStyle = m.step.color;
      ctx.lineWidth = 1.5;
      if (m.step.dashed) ctx.setLineDash([6, 5]);
      if (m.step.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, m.step.r ?? 20, 0, Math.PI * 2);
        ctx.globalAlpha *= 0.12;
        ctx.fill();
        ctx.globalAlpha /= 0.12;
        ctx.stroke();
      } else {
        const w = m.step.w ?? 40;
        const h = m.step.h ?? 40;
        ctx.globalAlpha *= 0.08;
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.globalAlpha /= 0.08;
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
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
    const fade = BALANCE_CONFIG.render.renderUtils.muzzleFlash.boostAlphaFade;
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
      type: RoachType.NORMAL,
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
      sprayAngle: -Math.PI / 2,
      spraySpread: (Math.PI * 2) / 3,
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
    const cycle = Math.max(1200, durationMs);
    const progress = ((localMs % cycle) / 1000) / 1.2; // 0→1 over 1.2s（与游戏一致）
    if (progress > 1) return;
    const alpha = Math.max(0, 1 - progress * 0.8);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // 1. Central green glow
    const glowR = 20 + progress * 80;
    const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    glowGrad.addColorStop(0, `rgba(100, 240, 100, ${alpha * 0.6})`);
    glowGrad.addColorStop(0.5, `rgba(60, 200, 60, ${alpha * 0.4})`);
    glowGrad.addColorStop(1, 'rgba(40, 120, 40, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 2. Green slime droplets spreading outward
    const dropCount = 12;
    for (let di = 0; di < dropCount; di++) {
      const baseAngle = (di / dropCount) * Math.PI * 2 + di * 0.7;
      const spreadDist = progress * 60;
      const dropX = x + Math.cos(baseAngle) * spreadDist;
      const dropY = y + Math.sin(baseAngle) * spreadDist * 0.5;
      const dropSize = (5 + di % 3 * 3) * (1 - progress * 0.3);
      const dropAlpha = alpha * (0.7 + (di % 3) * 0.1);

      // Glow behind each droplet
      const dGlow = ctx.createRadialGradient(dropX, dropY, 0, dropX, dropY, dropSize * 2);
      dGlow.addColorStop(0, `rgba(120, 255, 120, ${dropAlpha * 0.5})`);
      dGlow.addColorStop(1, 'rgba(60, 180, 60, 0)');
      ctx.fillStyle = dGlow;
      ctx.beginPath();
      ctx.arc(dropX, dropY, dropSize * 2, 0, Math.PI * 2);
      ctx.fill();

      // Solid droplet core
      ctx.fillStyle = `rgba(80, 220, 80, ${dropAlpha})`;
      ctx.beginPath();
      ctx.arc(dropX, dropY, dropSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Outer slime ring
    const ringR = 15 + progress * 50;
    ctx.strokeStyle = `rgba(100, 255, 130, ${alpha * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, ringR, ringR * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 治疗 BUFF：忠实复刻 engine.ts:4537-4620「HEAL BUFF: Rising green plus signs」
   * （绿色光晕 + 脉冲光环 + 4 个上升旋转 + 号（带发光/白芯） + 身体绿色染色）。
   * buffProgress 循环驱动（2s 一轮，与游戏 healBuffTimer 时长一致）。
   */
  private renderHealBuff(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const buffProgress = 1 - (t % 2.0) / 2.0; // 1→0（与游戏 healBuffTimer/2.0 一致）
    const baseAlpha = 0.9 * buffProgress;
    const size = 30;
    const fakeId = 1;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // 1. Large green glow halo around healed roach
    const haloR = size * 0.8;
    const haloGrad = ctx.createRadialGradient(x, y, 0, x, y, haloR * 2);
    haloGrad.addColorStop(0, `rgba(100, 255, 120, ${baseAlpha * 0.25})`);
    haloGrad.addColorStop(0.5, `rgba(60, 220, 80, ${baseAlpha * 0.4})`);
    haloGrad.addColorStop(1, 'rgba(40, 150, 60, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, haloR * 2, haloR, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Outer pulsing ring
    const pulseRingR = size * (0.6 + Math.sin(t * 4) * 0.15);
    ctx.strokeStyle = `rgba(120, 255, 160, ${baseAlpha * 0.6})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = `rgba(100, 255, 140, ${baseAlpha})`;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.ellipse(x, y, pulseRingR, pulseRingR * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Rising green plus signs (large + strong glow)
    const plusCount = 4;
    for (let pi = 0; pi < plusCount; pi++) {
      const cycleOffset = pi * (2.0 / plusCount);
      const cycleTime = (t + cycleOffset + fakeId * 0.5) % 2.0;
      const riseProgress = cycleTime / 2.0;

      const riseHeight = 55;
      const plusY = y - riseProgress * riseHeight;
      const orbitAngle = t * 2 + pi * 1.57 + fakeId;
      const orbitR = 16 * (0.4 + riseProgress);
      const plusX = x + Math.cos(orbitAngle) * orbitR;

      const plusAlpha = baseAlpha * Math.min(1, riseProgress * 3) * (1 - Math.pow(riseProgress, 2));
      if (plusAlpha <= 0.02) continue;

      const plusSize = 14 + riseProgress * 14;

      ctx.save();
      ctx.translate(plusX, plusY);
      ctx.rotate(Math.sin(t * 2 + pi + fakeId) * 0.2);

      // Strong outer glow
      ctx.shadowColor = `rgba(80, 255, 120, ${plusAlpha})`;
      ctx.shadowBlur = 20;

      // Thick green plus sign
      ctx.fillStyle = `rgba(100, 255, 150, ${plusAlpha})`;
      const barW = Math.max(3.5, plusSize * 0.32);
      const barL = plusSize;
      ctx.fillRect(-barW / 2, -barL / 2, barW, barL);
      ctx.fillRect(-barL / 2, -barW / 2, barL, barW);

      // Bright white center
      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(200, 255, 220, ${plusAlpha})`;
      ctx.fillStyle = `rgba(230, 255, 240, ${plusAlpha * 0.9})`;
      const cw = barW * 1.6;
      ctx.fillRect(-cw / 2, -cw / 2, cw, cw);

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 4. Bright green tint overlay on roach body
    ctx.fillStyle = `rgba(80, 200, 80, ${baseAlpha * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.52, size * 0.37, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 护甲六边形护盾：忠实复刻 RoachRenderer.ts:806-845「ARMOR SHIELD EFFECT」
   * （旋转六边形描边 + 径向内发光；颜色/脉冲/线宽取 BALANCE_CONFIG.render.roach.shield 普通款）。
   */
  private renderArmorRing(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const sc = BALANCE_CONFIG.render.roach.shield;
    const color = sc.normalColor;
    const fakeId = 1;
    const size = 30;
    const w = size * BALANCE_CONFIG.render.roach.bodyWidthRatio;
    const h = size;

    const shieldPulse = sc.normalPulseBase + Math.sin(t * 4 + fakeId) * 0.15;
    const shieldAlpha = shieldPulse;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(${color}, ${shieldAlpha})`;
    ctx.lineWidth = sc.normalLineWidth;
    ctx.shadowColor = `rgba(${color}, ${shieldAlpha * sc.normalShadowAlphaRatio})`;
    ctx.shadowBlur = sc.normalShadowBlur;
    const shieldR = Math.max(w, h) * sc.normalRadiusRatio;
    ctx.beginPath();
    for (let si = 0; si < 6; si++) {
      const sAngle = (si / 6) * Math.PI * 2 + t * 0.5;
      const sx = Math.cos(sAngle) * shieldR;
      const sy = Math.sin(sAngle) * shieldR;
      if (si === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.stroke();
    // Inner glow
    const glowGrad = ctx.createRadialGradient(0, 0, shieldR * 0.3, 0, 0, shieldR);
    glowGrad.addColorStop(0, `rgba(${color}, ${shieldAlpha * sc.normalGlowAlphaRatio})`);
    glowGrad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glowGrad;
    ctx.fill();
    ctx.restore();
  }

  /**
   * 螂家爆破预警：忠实复刻 RoachRenderer.ts:853-887 TIMED_SUICIDE「warning」阶段
   * （背部红色闪烁灯 3Hz + 地面不规则虚线危险圈（40px，滚动虚线） + 抖动倒计时数字）。
   */
  private renderBreachWarning(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const h = 30; // 蟑螂体高（与 size 一致）
    const fakeId = 1;
    ctx.save();
    ctx.translate(x, y);

    // Red blinking light on back (3Hz rapid flash)
    const blink = Math.sin(t * 18) > 0 ? 1 : 0.3;
    ctx.fillStyle = `rgba(180, 40, 40, ${blink})`;
    ctx.beginPath();
    ctx.arc(0, -h * 0.35, 5, 0, Math.PI * 2);
    ctx.fill();

    // Danger circle on ground (40px radius, irregular, 60% alpha)
    ctx.save();
    ctx.translate(0, h * 0.4);
    ctx.strokeStyle = 'rgba(140, 30, 30, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -t * 20;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2; a += 0.3) {
      const rough = 1 + Math.sin(a * 5 + fakeId) * 0.12;
      const rx = Math.cos(a) * 40 * rough;
      const ry = Math.sin(a) * 20 * rough;
      if (a === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Countdown number (dark red, slight jitter) — 3→1 循环
    const countdown = 3 - Math.floor(t % 3);
    const jitterX = Math.sin(t * 50) * 0.8;
    const jitterY = Math.cos(t * 45) * 0.6;
    ctx.font = RENDER_FONT.large;
    ctx.textAlign = 'center';
    ctx.fillStyle = RENDER_COLOR.bombCountdown;
    ctx.fillText(`${countdown}`, jitterX, -h * 0.6 + jitterY);

    ctx.restore();
  }

  /**
   * 定时炸弹倒计时：忠实复刻 engine.ts:4355-4413 placedBombs 渲染
   * （火焰辉光脉冲（随紧迫度增强） + bomb.png 64px + 缩放倒计时数字（1.8→3.3x，最后 1s 变红）
   *   + 最后 1s 紧急闪烁环）。3s 引信循环播放。
   */
  private renderTimedBomb(ctx: CanvasRenderingContext2D, x: number, y: number, localMs: number): void {
    const fuse = 3000;
    const timer = Math.max(0.01, (fuse - (localMs % fuse)) / 1000); // 3→0（与游戏 bomb.timer 语义一致）
    const t = localMs / 1000;
    const bombSize = 64;
    const img = this.getImage('/assets/bomb.png');

    ctx.save();
    ctx.translate(x, y);

    // Fire glow pulse (intensifies as timer counts down)
    const secs = Math.ceil(timer);
    const urgency = Math.max(0, 1 - timer / 3); // 0→1 as timer goes 3→0
    const pulseRadius = bombSize * 0.8 + urgency * 20 + Math.sin(t * 10) * urgency * 5;
    const glowAlpha = 0.15 + urgency * 0.35;
    const fireGradient = ctx.createRadialGradient(0, 0, bombSize * 0.3, 0, 0, pulseRadius);
    fireGradient.addColorStop(0, `rgba(255, 200, 50, ${glowAlpha})`);
    fireGradient.addColorStop(0.5, `rgba(255, 100, 20, ${glowAlpha * 0.6})`);
    fireGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = fireGradient;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bomb image
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -bombSize / 2, -bombSize / 2, bombSize, bombSize);
    } else {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, bombSize / 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Countdown number with zoom effect (scales up as timer decreases)
    const countColor = timer <= 1 ? '#ff0000' : '#ffaa00';
    const countScale = 1.8 + urgency * 1.5; // 1.8→3.3x scale (1.5× enlarged)
    ctx.save();
    ctx.scale(countScale, countScale);
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = countColor;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255,0,0,0.8)';
    ctx.shadowBlur = 10;
    const countY = (-bombSize / 2 - 20) / countScale;
    ctx.strokeText(`${secs}`, 0, countY);
    ctx.fillText(`${secs}`, 0, countY);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Urgent flash ring at last second
    if (timer <= 1) {
      const flashAlpha = 0.3 + Math.sin(t * 15) * 0.2;
      ctx.strokeStyle = `rgba(239, 68, 68, ${flashAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius * 0.7, 0, Math.PI * 2);
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
