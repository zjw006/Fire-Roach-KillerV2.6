/**
 * @fileoverview 天赋树界面组件（v4 改装工坊）
 * 三分支 × 五层树状结构 + 预留槽：
 * - 猛火系 inferno：火枪伤害 · 近程爆发（枪身进化）
 * - 长枪系 lance：火枪射程 · 远程精准（枪管进化）
 * - 装备系 support：生存 · 经济 · 道具专精
 * 交互：可升级节点单击直升（爆发粒子 + Toast），锁定节点点击查看原因；
 * 层门禁/前置满级/互斥组统一由 canUpgradeTalent 校验。
 * 视觉对齐 talent-tree-preview.html 原型：三列树、SVG 管道点燃、火枪外观双轨预览。
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { GameProgress, Talent } from '@/game/types';
import { TALENT_DEFS, TALENT_TIER_GATE, branchSpentPoints, canUpgradeTalent, TEXT_CONFIG } from '@/game/data';
import type { AudioManager } from '@/game/audio';

interface TalentTreeScreenProps {
  progress: GameProgress;
  talentPoints: number;
  onSpendTalent: (talentId: string) => boolean;
  onClose: () => void;
  audio?: AudioManager;
}

const T = TEXT_CONFIG.ui.talentTree;

// ========== 静态结构（模块级，TALENT_DEFS 为常量） ==========

type BranchId = 'inferno' | 'lance' | 'support';
const BRANCHES: { id: BranchId; pipeCls: string }[] = [
  { id: 'inferno', pipeCls: 'lit' },
  { id: 'lance', pipeCls: 'litL' },
  { id: 'support', pipeCls: 'litS' },
];

/** 节点表情图标（对齐预览原型） */
const TALENT_EMOJI: Record<string, string> = {
  pressure: '🔥', hotfuel: '🧪', alloy: '🛡️', bluecore: '🔵', burst: '💥', trimastery: '🔱', overdrive: '🌋',
  nozzle: '🎯', fins: '💨', tank: '🛢️', steel: '🔩', focus: '🌪️', lance: '⚡',
  bounty: '💰', saver: '📦', shieldm: '🛡️', wall: '🧱', mech: '⚙️', molfuel: '🧪', poisonup: '🧫',
  swatterm: '⚡', radarup: '📡',
};

/** 分支 → 层 → 节点列表（tier 从 1 开始；tier 6 为预留槽行） */
const TIERS_BY_BRANCH: Record<BranchId, Talent[][]> = (() => {
  const map: Record<BranchId, Talent[][]> = { inferno: [], lance: [], support: [] };
  for (const def of TALENT_DEFS) {
    const col = map[def.branch as BranchId];
    if (!col) continue;
    (col[def.tier - 1] ||= []).push(def);
  }
  return map;
})();

/** 分支满投点数（不含预留槽），用于分支头进度条 */
const BRANCH_MAX_SPENT: Record<BranchId, number> = (() => {
  const map = { inferno: 0, lance: 0, support: 0 } as Record<BranchId, number>;
  for (const def of TALENT_DEFS) {
    if (def.reserved) continue;
    const b = def.branch as BranchId;
    if (map[b] !== undefined) map[b] += def.maxLevel * def.cost;
  }
  return map;
})();

/** 互斥提示：该分支该层若有互斥节点，返回与另一方的互斥文案 */
function exclusiveTagFor(branchId: BranchId, tier: number): string | null {
  const def = TALENT_DEFS.find(d => d.branch === branchId && d.tier === tier && d.exclusiveGroup);
  if (!def) return null;
  const other = TALENT_DEFS.find(d => d.exclusiveGroup === def.exclusiveGroup && d.id !== def.id);
  return other ? T.exclusiveTag(other.name) : null;
}

/** 节点状态 */
type NodeSt =
  | { kind: 'avail' }
  | { kind: 'locked'; reason?: string; short: string }
  | { kind: 'pts'; short: string }
  | { kind: 'maxed' }
  | { kind: 'reserved' };

/** 管道线段 + 端点 */
interface PipeLine {
  key: string;
  d: string;
  litCls: string; // '' 未点燃
  dots: { x: number; y: number; lit: boolean }[];
}

/** 计算层内所有圆形节点的平均中心（相对树容器坐标） */
function rowCenter(tierEl: Element, wrect: DOMRect): { x: number; y: number } | null {
  const cs = tierEl.querySelectorAll('.tt-circ');
  if (!cs.length) return null;
  let x = 0, y = 0;
  cs.forEach(c => {
    const r = c.getBoundingClientRect();
    x += r.left + r.width / 2 - wrect.left;
    y += r.top + r.height / 2 - wrect.top;
  });
  return { x: x / cs.length, y: y / cs.length };
}

export const TalentTreeScreen: React.FC<TalentTreeScreenProps> = ({ progress, talentPoints, onSpendTalent, onClose, audio }) => {
  const talents = progress.talentTree.talents;

  // ── Toast ──
  const [toast, setToast] = useState<{ title: string; desc?: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((title: string, desc?: string) => {
    setToast({ title, desc });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ── 升级爆发粒子 ──
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; parts: { dx: number; dy: number; orange: boolean }[] }[]>([]);
  const burstId = useRef(0);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const spawnBurst = useCallback((el: Element) => {
    const phone = phoneRef.current;
    if (!phone) return;
    const r = el.getBoundingClientRect();
    const pr = phone.getBoundingClientRect();
    const id = ++burstId.current;
    const parts = Array.from({ length: 10 }, () => {
      const a = Math.random() * Math.PI * 2;
      const d = 24 + Math.random() * 26;
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, orange: Math.random() < 0.4 };
    });
    setBursts(bs => [...bs, { id, x: r.left - pr.left + r.width / 2, y: r.top - pr.top + r.height / 2, parts }]);
    setTimeout(() => setBursts(bs => bs.filter(b => b.id !== id)), 650);
  }, []);

  // ── 分支投入点数 ──
  const spent: Record<BranchId, number> = {
    inferno: branchSpentPoints(talents, 'inferno'),
    lance: branchSpentPoints(talents, 'lance'),
    support: branchSpentPoints(talents, 'support'),
  };

  // ── 节点状态计算 ──
  const stateFor = (def: Talent): NodeSt => {
    if (def.reserved) return { kind: 'reserved' };
    const lv = talents[def.id] || 0;
    if (lv >= def.maxLevel) return { kind: 'maxed' };
    const chk = canUpgradeTalent(def, talents);
    if (!chk.ok) {
      // 层门禁锁定显示短文案「需N点」，其余锁定短文案留空（点按看完整原因）
      const gate = TALENT_TIER_GATE[def.tier];
      const short = gate && chk.reason?.includes('投入') ? T.gateShort(gate) : '';
      return { kind: 'locked', reason: chk.reason, short };
    }
    if (talentPoints < def.cost) return { kind: 'pts', short: T.ptsShort };
    return { kind: 'avail' };
  };

  // ── 点击节点：可升级直升，否则 Toast 原因 ──
  const onTap = (def: Talent, e: React.MouseEvent<HTMLDivElement>) => {
    const st = stateFor(def);
    switch (st.kind) {
      case 'avail': {
        audio?.playClick();
        const ok = onSpendTalent(def.id);
        if (ok) {
          const circEl = (e.currentTarget as HTMLElement).querySelector('.tt-circ');
          if (circEl) spawnBurst(circEl);
          const newLv = (talents[def.id] || 0) + 1;
          showToast(`${TALENT_EMOJI[def.id] || '✨'} ${def.name} Lv.${newLv}`, def.description);
        }
        return;
      }
      case 'reserved':
        audio?.playClick();
        showToast(T.reservedTitle, T.reservedDesc);
        return;
      case 'maxed':
        audio?.playClick();
        showToast(`${TALENT_EMOJI[def.id] || '✨'} ${def.name} · ${T.maxedSuffix}`, def.description);
        return;
      case 'pts':
        audio?.playClick();
        showToast(T.ptsInsufficient);
        return;
      default:
        audio?.playClick();
        showToast(`🔒 ${def.name}`, st.reason);
    }
  };

  // ── SVG 管道测量（签名守卫避免渲染循环） ──
  const [pipes, setPipes] = useState<PipeLine[]>([]);
  const pipeSigRef = useRef('');
  const treeRef = useRef<HTMLDivElement | null>(null);
  const treeWrapRef = useRef<HTMLDivElement | null>(null);
  const branchRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const spentRef = useRef(spent);
  spentRef.current = spent;

  const measure = useCallback(() => {
    const wrap = treeRef.current;
    if (!wrap) return;
    const wrect = wrap.getBoundingClientRect();
    const lines: PipeLine[] = [];
    for (const b of BRANCHES) {
      const col = branchRefs.current[b.id];
      if (!col) continue;
      const bp = spentRef.current[b.id];
      const tiers = Array.from(col.querySelectorAll('.tt-tier'));
      for (let i = 0; i < tiers.length - 1; i++) {
        const c1 = rowCenter(tiers[i], wrect);
        const c2 = rowCenter(tiers[i + 1], wrect);
        if (!c1 || !c2) continue;
        // 通往 T(i+2) 的线：本系投入达到该层门禁则点燃（预留层不点燃）
        const gateTier = i + 2;
        const gate = TALENT_TIER_GATE[gateTier];
        const lit = gate !== undefined && bp >= gate;
        lines.push({
          key: `${b.id}-${i}`,
          d: `M ${c1.x} ${c1.y} C ${c1.x} ${(c1.y + c2.y) / 2}, ${c2.x} ${(c1.y + c2.y) / 2}, ${c2.x} ${c2.y}`,
          litCls: lit ? b.pipeCls : '',
          dots: [
            { x: c1.x, y: c1.y, lit },
            { x: c2.x, y: c2.y, lit },
          ],
        });
      }
    }
    const sig = JSON.stringify(lines);
    if (sig !== pipeSigRef.current) {
      pipeSigRef.current = sig;
      setPipes(lines);
    }
  }, []);

  useLayoutEffect(() => { measure(); });
  useEffect(() => {
    const wrap = treeWrapRef.current;
    const onScroll = () => requestAnimationFrame(measure);
    wrap?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      wrap?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [measure]);

  // ── 火枪外观双轨派生（枪身=猛火系，枪管=长枪系；对齐预览原型规则） ──
  const lvBluecore = (talents.bluecore || 0) > 0;
  const lvSteel = (talents.steel || 0) > 0;
  const lvOverdrive = (talents.overdrive || 0) > 0;
  const lvLance = (talents.lance || 0) > 0;
  const bpI = spent.inferno, bpL = spent.lance;
  let bodyStage = 0;
  if (bpI >= 3) bodyStage = 1;
  if (bpI >= 6 && lvBluecore) bodyStage = 2;
  if (bpI >= 10) bodyStage = 3;
  let barrelStage = 0;
  if (bpL >= 3) barrelStage = 1;
  if (bpL >= 6 && lvSteel) barrelStage = 2;
  if (bpL >= 10) barrelStage = 3;
  const gunName = lvOverdrive ? T.gunNames.overdrive
    : lvLance ? T.gunNames.lance
    : bodyStage >= 2 && barrelStage >= 2 ? T.gunNames.dual
    : bodyStage >= 2 ? T.gunNames.bluecore
    : barrelStage >= 2 ? T.gunNames.steel
    : bodyStage === 1 || barrelStage === 1 ? T.gunNames.mk2
    : T.gunNames.base;
  const gunTotal = bpI + bpL;
  const gunPips = [gunTotal >= 1, gunTotal >= 6, lvBluecore || lvSteel, gunTotal >= 16, lvOverdrive || lvLance];
  const gunCls = `tt-gunStage b${bodyStage} l${barrelStage}${lvOverdrive ? ' ovr' : ''}${lvLance ? ' lance' : ''}`;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-stone-950">
      <style>{TT_CSS}</style>
      <div
        ref={phoneRef}
        className="relative flex h-full w-full max-w-[420px] flex-col overflow-hidden border-x border-stone-800"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #292018 0%, #0c0a09 70%)', height: '100dvh' }}
      >
        {/* ═══ 顶栏 ═══ */}
        <div className="shrink-0 border-b border-stone-800 bg-stone-950/90 px-3.5 pt-2.5 pb-2 z-[5]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { audio?.playClick(); onClose(); }}
              className="flex items-center gap-1 text-stone-400 hover:text-white transition-colors text-[13px]"
            >
              <ArrowLeft size={16} />
              <span>{T.back}</span>
            </button>
            <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-sm">
              <Sparkles size={15} />
              <span>{talentPoints} {T.talentPoints}</span>
            </div>
          </div>
          <h1 className="text-center text-xl font-extrabold text-white tracking-[2px] pt-1.5">{T.title}</h1>
          <div className="text-center text-[10px] text-stone-500 tracking-[1px] mt-0.5">{T.subtitle}</div>
        </div>

        {/* ═══ 火枪外观预览条 ═══ */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-stone-700/50"
          style={{ background: 'linear-gradient(180deg, rgba(41,32,24,.6), rgba(12,10,9,0))' }}>
          <div className={gunCls}>
            <div className="tt-gunBody" />
            <div className="tt-nozzle n1" />
            <div className="tt-flame f1"><i className="o" /><i className="m" /><i className="c" /></div>
            <div className="tt-swirl" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-orange-300">{gunName}</div>
            <div className="flex gap-1 mt-1.5">
              {gunPips.map((on, i) => (
                <b key={i} className={`tt-wpip${on ? ' on' : ''}`} />
              ))}
            </div>
            <div className="text-[9px] text-stone-500 mt-1">{T.gunTip}</div>
          </div>
        </div>

        {/* ═══ 天赋树区（可滚动） ═══ */}
        <div
          ref={treeWrapRef}
          className="flex-1 overflow-y-auto relative px-2.5 pt-1.5 pb-4"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
          <div ref={treeRef} className="flex gap-2 relative">
            {/* SVG 管道层 */}
            <svg className="tt-pipes">
              <defs>
                <linearGradient id="tt-firegrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fbbf24" />
                  <stop offset="1" stopColor="#f97316" />
                </linearGradient>
              </defs>
              {pipes.map(p => (
                <g key={p.key}>
                  <path d={p.d} className={p.litCls} />
                  {p.dots.map((d, i) => (
                    <circle key={i} cx={d.x} cy={d.y} r={4} className={d.lit ? 'lit' : ''} />
                  ))}
                </g>
              ))}
            </svg>

            {BRANCHES.map(b => {
              const tiers = TIERS_BY_BRANCH[b.id];
              const bp = spent[b.id];
              const mx = BRANCH_MAX_SPENT[b.id];
              return (
                <div
                  key={b.id}
                  ref={el => { branchRefs.current[b.id] = el; }}
                  className={`tt-branch ${b.id}`}
                >
                  {/* 分支头 */}
                  <div className="tt-bhead">
                    <div className="t">{T.branchName[b.id]}</div>
                    <div className="s">{T.branchSub[b.id]}</div>
                    <div className="ptsbar"><i style={{ width: `${Math.min(100, (bp / mx) * 100)}%` }} /></div>
                    <div className="n">{bp} 点</div>
                  </div>

                  {/* 层 */}
                  {tiers.map((row, ti) => {
                    const tier = ti + 1;
                    const gate = TALENT_TIER_GATE[tier];
                    const exclTag = exclusiveTagFor(b.id, tier);
                    return (
                      <div key={tier} className="tt-tier">
                        {gate !== undefined && (
                          <div className={`tt-gatechip${bp >= gate ? ' open' : ''}`}>
                            {bp >= gate ? T.tierUnlocked(tier) : T.tierGate(gate)}
                          </div>
                        )}
                        <div className="tt-noderow">
                          {row.map(def => {
                            const st = stateFor(def);
                            const lv = talents[def.id] || 0;
                            const cls = [
                              'tt-node',
                              def.keystone ? 'keystone' : '',
                              def.reserved ? 'reserved' : '',
                              st.kind === 'avail' ? 'avail' : '',
                              st.kind === 'maxed' ? 'maxed' : '',
                              st.kind === 'locked' ? 'locked' : '',
                            ].filter(Boolean).join(' ');
                            return (
                              <div key={def.id} className={cls} onClick={e => onTap(def, e)}>
                                <div className="tt-circ">
                                  {def.reserved ? '?' : (TALENT_EMOJI[def.id] || '✨')}
                                  {def.keystone && <span className="tt-kbadge">★</span>}
                                  {(st.kind === 'locked' || st.kind === 'pts') && <span className="tt-lockico">🔒</span>}
                                </div>
                                <div className="tt-nm">{def.name}</div>
                                <div className="tt-pips">
                                  {Array.from({ length: def.maxLevel }, (_, i) => (
                                    <i key={i} className={i < lv ? 'on' : ''} />
                                  ))}
                                </div>
                                <div className="tt-why">{st.kind === 'locked' || st.kind === 'pts' ? st.short : ''}</div>
                              </div>
                            );
                          })}
                        </div>
                        {exclTag && <div className="tt-excltag">{exclTag}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* 图例 */}
          <div className="flex justify-center gap-2.5 pt-2 pb-0.5 text-[9px] text-stone-500">
            {T.legend.map((s, i) => <span key={i}>{s}</span>)}
          </div>
        </div>

        {/* ═══ 底栏 ═══ */}
        <div
          className="shrink-0 flex items-center gap-2.5 border-t border-stone-800 bg-stone-950/90 px-3.5 pt-2 z-[5]"
          style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
        >
          <span className="flex-1 flex items-center gap-1 text-[13px] text-yellow-400 font-bold">
            <Sparkles size={13} /> {talentPoints}
          </span>
          <span className="flex-[2] text-center text-[10px] text-stone-500">{T.hint}</span>
        </div>

        {/* ═══ 升级爆发粒子 ═══ */}
        {bursts.map(b => (
          <div key={b.id} className="tt-burst" style={{ left: b.x, top: b.y }}>
            {b.parts.map((p, i) => (
              <span
                key={i}
                style={{
                  ['--dx' as string]: `${p.dx}px`,
                  ['--dy' as string]: `${p.dy}px`,
                  background: p.orange ? '#f97316' : '#fbbf24',
                }}
              />
            ))}
          </div>
        ))}

        {/* ═══ Toast ═══ */}
        <div className={`tt-toast${toast ? ' show' : ''}`}>
          {toast && (
            <>
              <span className="tt">{toast.title}</span>
              {toast.desc && <><br />{toast.desc}</>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ========== 组件样式（对齐 talent-tree-preview.html，tt- 前缀隔离） ==========
const TT_CSS = `
/* 火枪外观预览 */
.tt-gunStage { position:relative; width:96px; height:64px; flex:0 0 auto; }
.tt-gunStage .tt-gunBody { position:absolute; left:8px; bottom:6px; width:56px; height:16px; border-radius:6px;
  background:linear-gradient(180deg,#57534e,#292524); box-shadow:inset 0 2px 3px rgba(255,255,255,.15); transition:all .4s; }
.tt-gunStage .tt-nozzle { position:absolute; bottom:10px; width:14px; height:8px; border-radius:3px; background:#78716c; transition:all .4s; }
.tt-gunStage .tt-nozzle.n1 { left:58px; }
.tt-gunStage .tt-flame { position:absolute; left:70px; bottom:8px; width:16px; height:26px; transform-origin:bottom center;
  animation:tt-flick .5s ease-in-out infinite alternate; transition:all .4s; }
.tt-gunStage .tt-flame i { position:absolute; inset:0; border-radius:50% 50% 50% 50%/60% 60% 40% 40%; }
.tt-gunStage .tt-flame .o { background:radial-gradient(ellipse at 50% 80%, rgba(249,115,22,.9), rgba(249,115,22,0) 70%); }
.tt-gunStage .tt-flame .m { inset:15% 20%; background:radial-gradient(ellipse at 50% 80%, rgba(251,191,36,.95), rgba(251,191,36,0) 70%); }
.tt-gunStage .tt-flame .c { inset:35% 35%; background:radial-gradient(ellipse at 50% 80%, #fff7ed, rgba(255,247,237,0) 75%); }
@keyframes tt-flick { from{transform:scaleY(.92) scaleX(1.05);} to{transform:scaleY(1.06) scaleX(.95);} }
/* 枪身阶段（猛火系） */
.tt-gunStage.b1 .tt-gunBody { background:linear-gradient(180deg,#b45309,#451a03); }
.tt-gunStage.b2 .tt-gunBody { background:linear-gradient(180deg,#1e40af,#172554); box-shadow:0 0 8px rgba(59,130,246,.5); }
.tt-gunStage.b2 .tt-flame .o { background:radial-gradient(ellipse at 50% 80%, rgba(59,130,246,.9), rgba(59,130,246,0) 70%); }
.tt-gunStage.b2 .tt-flame .m { background:radial-gradient(ellipse at 50% 80%, rgba(147,197,253,.95), rgba(147,197,253,0) 70%); }
.tt-gunStage.b3 .tt-flame { height:32px; }
.tt-gunStage.b3 .tt-swirl { display:block; }
.tt-gunStage .tt-swirl { display:none; position:absolute; left:64px; bottom:4px; width:28px; height:28px; border-radius:50%;
  border:2px dashed rgba(251,191,36,.7); animation:tt-spin 1.2s linear infinite; }
@keyframes tt-spin { to{transform:rotate(360deg);} }
/* 枪管阶段（长枪系） */
.tt-gunStage.l1 .tt-nozzle.n1 { width:20px; background:#b45309; }
.tt-gunStage.l1 .tt-flame { left:76px; }
.tt-gunStage.l2 .tt-nozzle.n1 { width:28px; background:#cbd5e1; box-shadow:0 0 4px rgba(203,213,225,.6); }
.tt-gunStage.l2 .tt-flame { left:84px; }
.tt-gunStage.l3 .tt-nozzle.n1 { width:34px; background:#e2e8f0; box-shadow:0 0 8px rgba(226,232,240,.8); }
.tt-gunStage.l3 .tt-flame { left:90px; height:30px; }
/* T5 终端形态 */
.tt-gunStage.ovr .tt-flame { height:36px; width:20px; left:74px; }
.tt-gunStage.ovr .tt-flame .o { background:radial-gradient(ellipse at 50% 80%, rgba(190,24,24,.95), rgba(124,58,237,0) 72%); }
.tt-gunStage.ovr .tt-flame .m { background:radial-gradient(ellipse at 50% 80%, rgba(249,115,22,.95), rgba(249,115,22,0) 70%); }
.tt-gunStage.ovr .tt-gunBody { background:linear-gradient(180deg,#7f1d1d,#450a0a); box-shadow:0 0 10px rgba(239,68,68,.6); }
.tt-gunStage.ovr .tt-swirl { display:block; border-color:rgba(239,68,68,.7); }
.tt-gunStage.lance .tt-nozzle.n1 { width:40px; background:#f8fafc; box-shadow:0 0 10px #fff; }
.tt-gunStage.lance .tt-flame { left:96px; height:44px; width:10px; }
.tt-gunStage.lance .tt-flame .o { background:radial-gradient(ellipse at 50% 80%, rgba(224,242,254,.95), rgba(224,242,254,0) 70%); }
.tt-gunStage.lance .tt-flame .c { background:radial-gradient(ellipse at 50% 80%, #fff, rgba(255,255,255,0) 80%); }
.tt-wpip { width:18px; height:5px; border-radius:3px; background:#44403c; transition:background .3s; }
.tt-wpip.on { background:linear-gradient(90deg,#f59e0b,#f97316); }

/* 分支列 */
.tt-branch { flex:1; min-width:0; position:relative; z-index:1; }
.tt-bhead { text-align:center; padding:6px 2px 8px; border-radius:10px; margin-bottom:2px;
  background:rgba(28,25,23,.85); border:1px solid #44403c; }
.tt-bhead .t { font-size:12px; font-weight:800; letter-spacing:1px; }
.tt-bhead .s { font-size:8px; color:#78716c; margin-top:1px; }
.tt-bhead .ptsbar { height:4px; border-radius:2px; background:#292524; margin:5px 6px 3px; overflow:hidden; }
.tt-bhead .ptsbar i { display:block; height:100%; border-radius:2px; transition:width .35s; }
.tt-bhead .n { font-size:9px; color:#a8a29e; }
.tt-branch.inferno .t { color:#fb923c; } .tt-branch.inferno .ptsbar i { background:#f97316; }
.tt-branch.lance .t { color:#7dd3fc; } .tt-branch.lance .ptsbar i { background:#38bdf8; }
.tt-branch.support .t { color:#a3e635; } .tt-branch.support .ptsbar i { background:#84cc16; }

/* 层 + 门禁 */
.tt-tier { position:relative; min-height:118px; display:flex; flex-direction:column; align-items:center;
  justify-content:flex-start; padding-top:6px; }
.tt-gatechip { position:absolute; top:-7px; left:50%; transform:translateX(-50%); z-index:2;
  font-size:8px; padding:1px 6px; border-radius:8px; background:#292524; color:#a8a29e;
  border:1px solid #44403c; white-space:nowrap; }
.tt-gatechip.open { background:#431407; color:#fdba74; border-color:#9a3412; }
.tt-noderow { display:flex; gap:6px; justify-content:center; }
.tt-excltag { font-size:8px; color:#fca5a5; margin-top:2px; text-align:center; }

/* 节点 */
.tt-node { display:flex; flex-direction:column; align-items:center; width:60px; cursor:pointer; transition:transform .12s; }
.tt-node:active { transform:scale(.93); }
.tt-node .tt-circ { width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  position:relative; font-size:23px; border:3px solid #57534e; background:#1c1917; transition:all .25s; }
.tt-node .tt-nm { font-size:9px; color:#d6d3d1; margin-top:3px; text-align:center; line-height:1.15; height:21px; }
.tt-node .tt-pips { display:flex; gap:2px; margin-top:1px; height:5px; }
.tt-node .tt-pips i { width:5px; height:5px; border-radius:50%; background:#44403c; }
.tt-node .tt-pips i.on { background:#fbbf24; }
.tt-node .tt-why { font-size:8px; color:#f87171; margin-top:1px; height:9px; }
.tt-node.avail .tt-circ { border-color:#fbbf24; box-shadow:0 0 10px rgba(251,191,36,.45); animation:tt-pulse 1.6s ease-in-out infinite; }
@keyframes tt-pulse { 0%,100%{box-shadow:0 0 6px rgba(251,191,36,.3);} 50%{box-shadow:0 0 14px rgba(251,191,36,.65);} }
.tt-node.maxed .tt-circ { border-color:#f59e0b; background:linear-gradient(145deg,#78350f,#451a03); }
.tt-node.maxed .tt-pips i.on { background:#fbbf24; box-shadow:0 0 4px #fbbf24; }
.tt-node.locked .tt-circ { border-style:dashed; opacity:.6; filter:grayscale(.7); }
.tt-node.locked .tt-nm { color:#78716c; }
.tt-node .tt-lockico { position:absolute; right:-3px; bottom:-3px; width:16px; height:16px; border-radius:50%;
  background:#292524; border:1px solid #57534e; font-size:9px; display:flex; align-items:center; justify-content:center; }
/* 基石 */
.tt-node.keystone .tt-circ { width:56px; height:56px; border-color:#a855f7; }
.tt-node.keystone.avail .tt-circ { border-color:#c084fc; box-shadow:0 0 12px rgba(192,132,252,.5); animation:tt-pulse2 1.6s infinite; }
@keyframes tt-pulse2 { 0%,100%{box-shadow:0 0 7px rgba(192,132,252,.3);} 50%{box-shadow:0 0 16px rgba(192,132,252,.7);} }
.tt-node.keystone.maxed .tt-circ { border-color:#c084fc; background:linear-gradient(145deg,#581c87,#3b0764); }
.tt-node .tt-kbadge { position:absolute; top:-7px; left:50%; transform:translateX(-50%); font-size:9px; color:#c084fc; line-height:1; }
/* 预留 */
.tt-node.reserved { cursor:default; }
.tt-node.reserved .tt-circ { border-style:dashed; border-color:#44403c; background:#0c0a09; font-size:12px; color:#57534e; }
.tt-node.reserved .tt-nm { color:#57534c; }

/* SVG 管道 */
.tt-pipes { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:0; }
.tt-pipes path { fill:none; stroke:#44403c; stroke-width:5; stroke-linecap:round; transition:stroke .5s; }
.tt-pipes path.lit { stroke:url(#tt-firegrad); filter:drop-shadow(0 0 4px rgba(249,115,22,.6)); }
.tt-pipes path.litL { stroke:#38bdf8; filter:drop-shadow(0 0 4px rgba(56,189,248,.5)); }
.tt-pipes path.litS { stroke:#84cc16; filter:drop-shadow(0 0 4px rgba(132,204,22,.5)); }
.tt-pipes circle { fill:#44403c; transition:fill .5s; }
.tt-pipes circle.lit { fill:#fb923c; }

/* 升级爆发粒子 */
.tt-burst { position:absolute; pointer-events:none; z-index:50; }
.tt-burst span { position:absolute; width:6px; height:6px; border-radius:50%; background:#fbbf24;
  animation:tt-bp .6s ease-out forwards; }
@keyframes tt-bp { to { transform:translate(var(--dx),var(--dy)) scale(.2); opacity:0; } }

/* Toast */
.tt-toast { position:absolute; left:50%; bottom:86px; transform:translateX(-50%) translateY(8px); max-width:86%;
  background:rgba(28,25,23,.96); border:1px solid #57534e; color:#e7e5e4; font-size:12px; line-height:1.5;
  padding:8px 14px; border-radius:10px; opacity:0; transition:all .25s; pointer-events:none; z-index:60; text-align:center; }
.tt-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
.tt-toast .tt { color:#fdba74; font-weight:700; }
`;
