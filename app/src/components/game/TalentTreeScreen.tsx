/**
 * @fileoverview 天赋树界面组件（v4 天赋工坊）
 * 三分支 × 五层树状结构 + 预留槽：
 * - 猛火系 inferno：火枪伤害 · 近程爆发
 * - 长枪系 lance：火枪射程 · 远程精准
 * - 装备系 support：生存 · 经济 · 道具专精
 * 交互：可升级节点单击直升（爆发粒子 + Toast），锁定节点点击查看原因；
 * 层门禁/前置满级/互斥组统一由 canUpgradeTalent 校验；右下角支持一键重置返还点数。
 * 结点间以虚线链接呈现路径（分叉/集中）：源结点已投入 → 分支色点亮；目标可升级 → 琥珀色流动虚线。
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react';
import type { GameProgress, Talent } from '@/game/types';
import { TALENT_DEFS, TALENT_TIER_GATE, branchSpentPoints, canUpgradeTalent, TEXT_CONFIG } from '@/game/data';
import type { AudioManager } from '@/game/audio';

interface TalentTreeScreenProps {
  progress: GameProgress;
  talentPoints: number;
  onSpendTalent: (talentId: string) => boolean;
  /** 重置天赋树，返回返还的点数 */
  onResetTalents: () => number;
  onClose: () => void;
  audio?: AudioManager;
}

const T = TEXT_CONFIG.ui.talentTree;

// ========== 静态结构（模块级，TALENT_DEFS 为常量） ==========

type BranchId = 'inferno' | 'lance' | 'support';
const BRANCHES: { id: BranchId }[] = [{ id: 'inferno' }, { id: 'lance' }, { id: 'support' }];

/** 节点表情图标（对齐预览原型） */
const TALENT_EMOJI: Record<string, string> = {
  pressure: '🔥', hotfuel: '🧪', alloy: '🛡️', bluecore: '🔵', burst: '💥', trimastery: '🔱', overdrive: '🌋',
  nozzle: '🎯', fins: '💨', tank: '🛢️', steel: '🔩', focus: '🌪️', lance: '⚡',
  bounty: '💰', saver: '📦', shieldm: '🛡️', wall: '🧱', mech: '⚙️', molfuel: '🧪', poisonup: '🧫',
  swatterm: '⚡', radarup: '📡', baitm: '🪤',
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

/** 天赋 id → 定义（静态查表） */
const TALENT_BY_ID: Record<string, Talent> = (() => {
  const map: Record<string, Talent> = {};
  for (const def of TALENT_DEFS) map[def.id] = def;
  return map;
})();

/**
 * 结点链接（静态计算）：每个非预留结点 → 同分支上一层全部非预留结点。
 * 一层多结点时天然形成「分叉」（一对多）与「集中」（多对一）路径。
 */
const NODE_LINKS: Record<BranchId, { from: string; to: string }[]> = (() => {
  const map: Record<BranchId, { from: string; to: string }[]> = { inferno: [], lance: [], support: [] };
  for (const def of TALENT_DEFS) {
    if (def.reserved || def.tier <= 1) continue;
    const b = def.branch as BranchId;
    if (!map[b]) continue;
    for (const parent of TALENT_DEFS) {
      if (parent.reserved || parent.branch !== def.branch || parent.tier !== def.tier - 1) continue;
      map[b].push({ from: parent.id, to: def.id });
    }
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

/** 结点间虚线链接（测量后） */
interface PipeLine {
  key: string;
  d: string;
  cls: string; // 'lit'（源已投入）/ 'avail'（目标可升级）/ '' 未点亮
}

export const TalentTreeScreen: React.FC<TalentTreeScreenProps> = ({ progress, talentPoints, onSpendTalent, onResetTalents, onClose, audio }) => {
  const talents = progress.talentTree.talents;

  // ── 页签（三分支随时切换） ──
  const [activeTab, setActiveTab] = useState<BranchId>('inferno');

  // ── Toast ──
  const [toast, setToast] = useState<{ title: string; desc?: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((title: string, desc?: string) => {
    setToast({ title, desc });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ── 节点 hover 提示（下一级升级效果） ──
  const [hoverNode, setHoverNode] = useState<string | null>(null);

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
  const totalSpent = spent.inferno + spent.lance + spent.support;

  // ── 重置天赋（两段确认：3 秒内再次点击生效） ──
  const [resetArmed, setResetArmed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);
  const onResetTap = () => {
    audio?.playClick();
    if (totalSpent <= 0) return;
    if (!resetArmed) {
      setResetArmed(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setResetArmed(false), 3000);
      return;
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setResetArmed(false);
    const refund = onResetTalents();
    showToast(`🔄 ${T.resetDone(refund)}`);
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
          const circEl = (e.currentTarget as HTMLElement).querySelector('.tt-circ-single');
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

  // ── SVG 虚线链接测量（签名守卫避免渲染循环） ──
  const [pipes, setPipes] = useState<PipeLine[]>([]);
  const pipeSigRef = useRef('');
  const treeRef = useRef<HTMLDivElement | null>(null);
  const treeWrapRef = useRef<HTMLDivElement | null>(null);
  const branchRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const talentsRef = useRef(talents);
  talentsRef.current = talents;
  const pointsRef = useRef(talentPoints);
  pointsRef.current = talentPoints;

  const measure = useCallback(() => {
    const wrap = treeRef.current;
    if (!wrap) return;
    const wrect = wrap.getBoundingClientRect();
    const lines: PipeLine[] = [];
    // 单分支模式：只测量当前页签的列（非激活页签的分支容器已卸载，ref 为 null）
    const b = BRANCHES.find(x => branchRefs.current[x.id]);
    if (b) {
      const col = branchRefs.current[b.id]!;
      const centerOf = (tid: string) => {
        const el = col.querySelector(`[data-tid="${tid}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - wrect.left, y: r.top + r.height / 2 - wrect.top };
      };
      const tals = talentsRef.current;
      const pts = pointsRef.current;
      for (const link of NODE_LINKS[b.id]) {
        const c1 = centerOf(link.from);
        const c2 = centerOf(link.to);
        if (!c1 || !c2) continue;
        const toDef = TALENT_BY_ID[link.to];
        // 源结点已投入 → 分支色点亮；目标当前可升级 → 琥珀色流动虚线（优先级更高）
        let cls = (tals[link.from] || 0) > 0 ? 'lit' : '';
        if (toDef && canUpgradeTalent(toDef, tals).ok && pts >= toDef.cost) cls = 'avail';
        lines.push({
          key: `${link.from}>${link.to}`,
          d: `M ${c1.x} ${c1.y} C ${c1.x} ${(c1.y + c2.y) / 2}, ${c2.x} ${(c1.y + c2.y) / 2}, ${c2.x} ${c2.y}`,
          cls,
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
          <h1 className="text-center text-xl font-extrabold text-white tracking-[2px] pt-1.5 pb-0.5">{T.title}</h1>
        </div>

        {/* ═══ 页签栏 ═══ */}
        <div className="shrink-0 flex border-b border-stone-800 bg-stone-950/80 z-[5]">
          {BRANCHES.map(b => {
            const bp = spent[b.id];
            const isActive = activeTab === b.id;
            return (
              <button
                key={b.id}
                onClick={() => { audio?.playClick(); setActiveTab(b.id); }}
                className={`tt-tab ${isActive ? 'active' : ''} ${b.id}`}
              >
                <span className="tt-tname">{T.branchName[b.id]}</span>
                <span className="tt-tpts">{bp} 点</span>
                {isActive && <span className="tt-tind" />}
              </button>
            );
          })}
        </div>

        {/* ═══ 天赋树区（单分支全宽） ═══ */}
        <div
          ref={treeWrapRef}
          className="flex-1 overflow-y-auto relative px-4 pt-3 pb-6"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
          <div ref={treeRef} className="relative flex flex-col items-center">
            {/* SVG 虚线链接层 */}
            <svg className="tt-pipes">
              {pipes.map(p => (
                <path key={p.key} d={p.d} className={`${activeTab}${p.cls ? ` ${p.cls}` : ''}`} />
              ))}
            </svg>

            {/* 当前分支 */}
            {(() => {
              const b = BRANCHES.find(x => x.id === activeTab)!;
              const tiers = TIERS_BY_BRANCH[b.id];
              const bp = spent[b.id];
              const mx = BRANCH_MAX_SPENT[b.id];
              return (
                <div
                  key={b.id}
                  ref={el => { branchRefs.current[b.id] = el; }}
                  className={`tt-branch-single ${b.id}`}
                >
                  {/* 分支头（大号） */}
                  <div className="tt-bhead-single">
                    <div className="t">{T.branchName[b.id]}</div>
                    <div className="s">{T.branchSub[b.id]}</div>
                    <div className="ptsbar"><i style={{ width: `${Math.min(100, (bp / mx) * 100)}%` }} /></div>
                    <div className="n">{bp} / {mx} 点</div>
                  </div>

                  {/* 层 */}
                  {tiers.map((row, ti) => {
                    const tier = ti + 1;
                    const gate = TALENT_TIER_GATE[tier];
                    const exclTag = exclusiveTagFor(b.id, tier);
                    return (
                      <div key={tier} className="tt-tier-single">
                        {gate !== undefined && (
                          <div className={`tt-gatechip${bp >= gate ? ' open' : ''}`}>
                            {bp >= gate ? T.tierUnlocked(tier) : T.tierGate(gate)}
                          </div>
                        )}
                        <div className="tt-noderow-single">
                          {row.map(def => {
                            const st = stateFor(def);
                            const lv = talents[def.id] || 0;
                            const cls = [
                              'tt-node-single',
                              def.keystone ? 'keystone' : '',
                              def.reserved ? 'reserved' : '',
                              st.kind === 'avail' ? 'avail' : '',
                              st.kind === 'maxed' ? 'maxed' : '',
                              st.kind === 'locked' ? 'locked' : '',
                            ].filter(Boolean).join(' ');
                            return (
                              <div key={def.id} className={cls} onClick={e => onTap(def, e)}>
                                <div
                                  className="tt-circ-single"
                                  data-tid={def.id}
                                  onMouseEnter={() => setHoverNode(def.id)}
                                  onMouseLeave={() => setHoverNode(null)}
                                >
                                  {def.reserved ? '?' : (TALENT_EMOJI[def.id] || '✨')}
                                  {def.keystone && <span className="tt-kbadge">★</span>}
                                  {(st.kind === 'locked' || st.kind === 'pts') && <span className="tt-lockico">🔒</span>}
                                  {/* hover 提示：下一级升级效果 */}
                                  {hoverNode === def.id && !def.reserved && (
                                    <div className="tt-tooltip">
                                      <div className="tt-tt-name">{def.name}{lv > 0 && <span className="tt-tt-lv">Lv.{lv}</span>}</div>
                                      {lv >= def.maxLevel ? (
                                        <div className="tt-tt-max">{T.maxedSuffix}</div>
                                      ) : (
                                        <>
                                          <div className="tt-tt-next">下一级效果</div>
                                          <div className="tt-tt-desc">{def.description}</div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="tt-nm-single">{def.name}</div>
                                <div className="tt-pips-single">
                                  {Array.from({ length: def.maxLevel }, (_, i) => (
                                    <i key={i} className={i < lv ? 'on' : ''} />
                                  ))}
                                </div>
                                <div className="tt-why-single">{st.kind === 'locked' || st.kind === 'pts' ? st.short : ''}</div>
                              </div>
                            );
                          })}
                        </div>
                        {exclTag && <div className="tt-excltag-single">{exclTag}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* 分支已激活效果摘要 */}
          {(() => {
            const b = BRANCHES.find(x => x.id === activeTab)!;
            const defs = TALENT_DEFS.filter(d => d.branch === b.id && !d.reserved);
            const active = defs.filter(d => (talents[d.id] || 0) > 0);
            if (active.length === 0) return null;
            return (
              <div className="tt-summary">
                <div className="tt-sum-title">✦ 已激活效果</div>
                <div className="tt-sum-list">
                  {active.map(d => (
                    <div key={d.id} className="tt-sum-item">
                      <span className="tt-sum-ico">{TALENT_EMOJI[d.id] || '✨'}</span>
                      <span className="tt-sum-name">{d.name}</span>
                      <span className="tt-sum-lv">Lv.{talents[d.id]}</span>
                      <span className="tt-sum-desc">{d.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 图例 */}
          <div className="flex justify-center gap-3 pt-4 pb-1 text-[10px] text-stone-500">
            {T.legend.map((s, i) => <span key={i}>{s}</span>)}
          </div>
        </div>

        {/* ═══ 底栏：提示居中 + 右下角重置 ═══ */}
        <div
          className="shrink-0 relative flex items-center justify-center border-t border-stone-800 bg-stone-950/90 px-3.5 pt-2 z-[5]"
          style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
        >
          <span className="text-center text-[10px] text-stone-500 px-16">{T.hint}</span>
          <button
            onClick={onResetTap}
            disabled={totalSpent <= 0}
            className={`tt-reset absolute right-3.5 top-1/2 -translate-y-1/2${resetArmed ? ' armed' : ''}`}
          >
            <RotateCcw size={11} />
            <span>{resetArmed ? T.resetConfirm : T.reset}</span>
          </button>
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

// ========== 组件样式（tt- 前缀隔离） ==========
const TT_CSS = `
/* 页签栏 */
.tt-tab { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:10px 4px 8px; position:relative; cursor:pointer; transition:all .2s; border:none; background:transparent; }
.tt-tab .tt-tname { font-size:13px; font-weight:700; letter-spacing:1px; color:#78716c; transition:color .2s; }
.tt-tab .tt-tpts { font-size:9px; color:#57534e; margin-top:2px; transition:color .2s; }
.tt-tab .tt-tind { position:absolute; bottom:0; left:20%; right:20%; height:2.5px; border-radius:2px; transition:all .25s; }
.tt-tab.active .tt-tname { color:#e7e5e4; }
.tt-tab.active .tt-tpts { color:#a8a29e; }
.tt-tab.inferno.active .tt-tind { background:#f97316; box-shadow:0 0 6px rgba(249,115,22,.5); }
.tt-tab.lance.active .tt-tind { background:#38bdf8; box-shadow:0 0 6px rgba(56,189,248,.5); }
.tt-tab.support.active .tt-tind { background:#84cc16; box-shadow:0 0 6px rgba(132,204,22,.5); }
.tt-tab.inferno.active .tt-tname { color:#fb923c; }
.tt-tab.lance.active .tt-tname { color:#7dd3fc; }
.tt-tab.support.active .tt-tname { color:#a3e635; }

/* 单分支列 */
.tt-branch-single { width:100%; max-width:360px; position:relative; z-index:1; }
.tt-bhead-single { text-align:center; padding:10px 6px 12px; border-radius:14px; margin-bottom:4px;
  background:rgba(28,25,23,.85); border:1px solid #44403c; }
.tt-bhead-single .t { font-size:16px; font-weight:800; letter-spacing:2px; }
.tt-bhead-single .s { font-size:10px; color:#78716c; margin-top:2px; }
.tt-bhead-single .ptsbar { height:5px; border-radius:3px; background:#292524; margin:8px 10px 4px; overflow:hidden; }
.tt-bhead-single .ptsbar i { display:block; height:100%; border-radius:3px; transition:width .35s; }
.tt-bhead-single .n { font-size:10px; color:#a8a29e; margin-top:2px; }
.tt-branch-single.inferno .t { color:#fb923c; } .tt-branch-single.inferno .ptsbar i { background:#f97316; }
.tt-branch-single.lance .t { color:#7dd3fc; } .tt-branch-single.lance .ptsbar i { background:#38bdf8; }
.tt-branch-single.support .t { color:#a3e635; } .tt-branch-single.support .ptsbar i { background:#84cc16; }

/* 层 + 门禁（单分支） */
.tt-tier-single { position:relative; min-height:130px; display:flex; flex-direction:column; align-items:center;
  justify-content:flex-start; padding-top:8px; }
.tt-gatechip { position:absolute; top:-8px; left:50%; transform:translateX(-50%); z-index:2;
  font-size:9px; padding:2px 8px; border-radius:10px; background:#292524; color:#a8a29e;
  border:1px solid #44403c; white-space:nowrap; }
.tt-gatechip.open { background:#431407; color:#fdba74; border-color:#9a3412; }
.tt-noderow-single { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
.tt-excltag-single { font-size:9px; color:#fca5a5; margin-top:3px; text-align:center; }

/* 节点（单分支 · 加大） */
.tt-node-single { display:flex; flex-direction:column; align-items:center; width:84px; cursor:pointer; transition:transform .12s; }
.tt-node-single:active { transform:scale(.93); }
.tt-node-single .tt-circ-single { width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  position:relative; font-size:28px; border:3px solid #57534e; background:#1c1917; transition:all .25s; }
.tt-node-single .tt-nm-single { font-size:11px; color:#d6d3d1; margin-top:4px; text-align:center; line-height:1.2; height:26px; }
.tt-node-single .tt-pips-single { display:flex; gap:3px; margin-top:2px; height:6px; }
.tt-node-single .tt-pips-single i { width:6px; height:6px; border-radius:50%; background:#44403c; }
.tt-node-single .tt-pips-single i.on { background:#fbbf24; }
.tt-node-single .tt-why-single { font-size:9px; color:#f87171; margin-top:2px; height:10px; }
.tt-node-single.avail .tt-circ-single { border-color:#fbbf24; box-shadow:0 0 12px rgba(251,191,36,.5); animation:tt-pulse 1.6s ease-in-out infinite; }
@keyframes tt-pulse { 0%,100%{box-shadow:0 0 7px rgba(251,191,36,.3);} 50%{box-shadow:0 0 16px rgba(251,191,36,.7);} }
.tt-node-single.maxed .tt-circ-single { border-color:#f59e0b; background:linear-gradient(145deg,#78350f,#451a03); }
.tt-node-single.maxed .tt-pips-single i.on { background:#fbbf24; box-shadow:0 0 5px #fbbf24; }
.tt-node-single.locked .tt-circ-single { border-style:dashed; opacity:.6; filter:grayscale(.7); }
.tt-node-single.locked .tt-nm-single { color:#78716c; }
.tt-node-single .tt-lockico { position:absolute; right:-4px; bottom:-4px; width:18px; height:18px; border-radius:50%;
  background:#292524; border:1px solid #57534e; font-size:10px; display:flex; align-items:center; justify-content:center; }
/* 基石 */
.tt-node-single.keystone .tt-circ-single { width:68px; height:68px; border-color:#a855f7; }
.tt-node-single.keystone.avail .tt-circ-single { border-color:#c084fc; box-shadow:0 0 14px rgba(192,132,252,.55); animation:tt-pulse2 1.6s infinite; }
@keyframes tt-pulse2 { 0%,100%{box-shadow:0 0 8px rgba(192,132,252,.3);} 50%{box-shadow:0 0 18px rgba(192,132,252,.75);} }
.tt-node-single.keystone.maxed .tt-circ-single { border-color:#c084fc; background:linear-gradient(145deg,#581c87,#3b0764); }
.tt-node-single .tt-kbadge { position:absolute; top:-8px; left:50%; transform:translateX(-50%); font-size:10px; color:#c084fc; line-height:1; }
/* 预留 */
.tt-node-single.reserved { cursor:default; }
.tt-node-single.reserved .tt-circ-single { border-style:dashed; border-color:#44403c; background:#0c0a09; font-size:14px; color:#57534e; }
.tt-node-single.reserved .tt-nm-single { color:#57534c; }

/* 节点 hover 提示（下一级升级效果） */
.tt-tooltip { position:absolute; bottom:calc(100% + 10px); left:50%; transform:translateX(-50%); z-index:30;
  min-width:130px; max-width:190px; padding:8px 10px; border-radius:9px;
  background:rgba(12,10,9,.97); border:1px solid rgba(251,191,36,.4); box-shadow:0 4px 16px rgba(0,0,0,.7);
  text-align:left; pointer-events:none; animation:tt-tip-in .15s ease-out; }
.tt-tooltip::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%);
  border:5px solid transparent; border-top-color:rgba(251,191,36,.4); }
@keyframes tt-tip-in { from { opacity:0; transform:translateX(-50%) translateY(4px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
.tt-tt-name { font-size:11px; font-weight:700; color:#fde68a; line-height:1.3; white-space:nowrap; }
.tt-tt-lv { margin-left:4px; font-size:9px; font-weight:700; color:#fbbf24; }
.tt-tt-next { font-size:9px; font-weight:700; color:#a8a29e; letter-spacing:1px; margin-top:4px; }
.tt-tt-desc { font-size:10px; color:#e7e5e4; line-height:1.45; margin-top:2px; }
.tt-tt-max { font-size:10px; font-weight:700; color:#f59e0b; margin-top:4px; }

/* 已激活效果摘要 */
.tt-summary { margin-top:10px; padding:10px 12px; border-radius:12px;
  background:rgba(28,25,23,.6); border:1px solid rgba(68,64,60,.4); }
.tt-sum-title { font-size:11px; font-weight:700; color:#d6d3d1; letter-spacing:1px; margin-bottom:6px; }
.tt-sum-list { display:flex; flex-direction:column; gap:4px; }
.tt-sum-item { display:flex; align-items:baseline; gap:6px; font-size:10px; line-height:1.4; }
.tt-sum-ico { font-size:12px; flex-shrink:0; }
.tt-sum-name { color:#d6d3d1; font-weight:600; white-space:nowrap; }
.tt-sum-lv { color:#fbbf24; font-weight:700; font-size:9px; white-space:nowrap; }
.tt-sum-desc { color:#78716c; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* SVG 结点虚线链接（细虚线；分叉/集中路径） */
.tt-pipes { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:0; }
.tt-pipes path { fill:none; stroke:#44403c; stroke-width:1.6; stroke-dasharray:5 5; opacity:.5;
  transition:stroke .4s, opacity .4s; }
/* 源结点已投入 → 分支色点亮 */
.tt-pipes path.inferno.lit { stroke:#f97316; opacity:.85; filter:drop-shadow(0 0 3px rgba(249,115,22,.45)); }
.tt-pipes path.lance.lit { stroke:#38bdf8; opacity:.85; filter:drop-shadow(0 0 3px rgba(56,189,248,.45)); }
.tt-pipes path.support.lit { stroke:#84cc16; opacity:.85; filter:drop-shadow(0 0 3px rgba(132,204,22,.45)); }
/* 目标可升级 → 琥珀色流动虚线（可升级路径） */
.tt-pipes path.avail { stroke:#fbbf24; stroke-width:2; opacity:1;
  filter:drop-shadow(0 0 4px rgba(251,191,36,.55)); animation:tt-dashflow 1.1s linear infinite; }
@keyframes tt-dashflow { to { stroke-dashoffset:-10; } }

/* 重置按钮（底栏右下角） */
.tt-reset { display:flex; align-items:center; gap:4px; font-size:10px; font-weight:700; letter-spacing:.5px;
  color:#a8a29e; background:rgba(41,37,36,.9); border:1px solid #57534e; border-radius:9px;
  padding:4px 9px; cursor:pointer; transition:all .2s; white-space:nowrap; }
.tt-reset:active { transform:translateY(-50%) scale(.94); }
.tt-reset:disabled { opacity:.35; cursor:default; }
.tt-reset.armed { color:#fecaca; border-color:#ef4444; background:rgba(69,10,10,.85);
  box-shadow:0 0 10px rgba(239,68,68,.35); animation:tt-pulse3 1s ease-in-out infinite; }
@keyframes tt-pulse3 { 0%,100%{box-shadow:0 0 5px rgba(239,68,68,.25);} 50%{box-shadow:0 0 14px rgba(239,68,68,.6);} }

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
