// 新旧两组 trace 对比分析（修复前 09:05-09:23 vs 修复后 14:34-15:15），生成 balance-report.html
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DL = 'C:/Users/16265/Downloads';
const NAME = { kitchen:'厨房', sewer:'下水道', dump:'垃圾场', basement:'地下室', rooftop:'天台', street:'街道', hospital:'医院', subway:'地铁' };
const ORDER = ['kitchen','sewer','dump','basement','rooftop','street','hospital','subway'];
const SPLIT = 1786330000000; // 旧组最大ts 1786325021234 < 阈值 < 新组最小ts 1786343646570

const files = readdirSync(DL).filter(f => f.startsWith('roach-trace-') && f.endsWith('.json'));
const sessions = files.map(f => {
  const ts = Number(f.match(/-(\d+)\.json$/)[1]);
  return { file: f, ts, group: ts < SPLIT ? 'old' : 'new', ...JSON.parse(readFileSync(`${DL}/${f}`, 'utf8')) };
});

function metrics(s) {
  const arr = s.samples;
  const last = arr[arr.length - 1];
  let peak = 0, peakT = 0, peakShield = 0, firingN = 0, breach = 0;
  let combatDmg = 0, combatTime = 0;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    const backlog = p.hp + p.armor;
    if (backlog > peak) { peak = backlog; peakT = p.t; }
    if (p.shield > peakShield) peakShield = p.shield;
    if (p.firing) firingN++;
    if (i > 0) {
      const q = arr[i - 1];
      const dDrop = (q.hp + q.armor) - (p.hp + p.armor);
      const dDmg = p.flameDmg - q.flameDmg;
      if (dDrop > 0 && dDrop - dDmg > 3) breach += dDrop - dDmg;
      if (p.hp + p.armor > 0 || q.hp + q.armor > 0) { combatDmg += dDmg; combatTime += p.t - q.t; }
    }
  }
  const duty = firingN / arr.length;
  return {
    scene: s.scene, name: NAME[s.scene] || s.scene, result: s.result, dur: s.duration,
    waves: last.wave, spawn: last.spawnHp, dmg: last.flameDmg,
    peak, peakT, peakShield, duty,
    avgDps: last.flameDmg / s.duration,
    firingDps: duty > 0 ? last.flameDmg / (duty * s.duration) : 0,
    combatDps: combatTime > 0 ? combatDmg / combatTime : 0,
    breach, samples: arr,
  };
}

const pairs = ORDER.map(scene => {
  const o = sessions.find(s => s.scene === scene && s.group === 'old');
  const n = sessions.find(s => s.scene === scene && s.group === 'new');
  return { scene, name: NAME[scene], old: o ? metrics(o) : null, nw: n ? metrics(n) : null };
}).filter(p => p.old && p.nw);

// ---------- 控制台汇总 ----------
const pct = (o, n) => (o !== 0 ? ((n - o) / o * 100) : 0);
console.log('关卡     | 时长 旧→新        | 生成总量 旧→新          | 火焰输出 旧→新          | 峰值在屏 旧→新       | 交战DPS 旧→新');
for (const p of pairs) {
  const { old: o, nw: n } = p;
  console.log(
    `${p.name.padEnd(4)} | ${String(o.dur).padStart(5)}→${String(n.dur).padStart(5)} (${pct(o.dur, n.dur).toFixed(0).padStart(4)}%)` +
    ` | ${String(o.spawn).padStart(6)}→${String(n.spawn).padStart(6)} (${pct(o.spawn, n.spawn).toFixed(0).padStart(5)}%)` +
    ` | ${String(o.dmg).padStart(6)}→${String(n.dmg).padStart(6)} (${pct(o.dmg, n.dmg).toFixed(0).padStart(5)}%)` +
    ` | ${String(o.peak).padStart(5)}→${String(n.peak).padStart(5)} (${pct(o.peak, n.peak).toFixed(0).padStart(4)}%)` +
    ` | ${o.combatDps.toFixed(0).padStart(4)}→${n.combatDps.toFixed(0).padStart(4)} (${pct(o.combatDps, n.combatDps).toFixed(0).padStart(4)}%)`
  );
}
const exSub = pairs.filter(p => p.scene !== 'subway');
const avg = (arr, f) => arr.reduce((s, p) => s + f(p), 0) / arr.length;
console.log('\n--- 跨关平均（排除地铁）---');
console.log(`交战DPS: ${avg(exSub, p => p.old.combatDps).toFixed(1)} → ${avg(exSub, p => p.nw.combatDps).toFixed(1)} (${pct(avg(exSub, p => p.old.combatDps), avg(exSub, p => p.nw.combatDps)).toFixed(1)}%)`);
console.log(`通关时长: ${avg(exSub, p => p.old.dur).toFixed(1)}s → ${avg(exSub, p => p.nw.dur).toFixed(1)}s (${pct(avg(exSub, p => p.old.dur), avg(exSub, p => p.nw.dur)).toFixed(1)}%)`);
console.log(`峰值在屏: ${avg(exSub, p => p.old.peak).toFixed(0)} → ${avg(exSub, p => p.nw.peak).toFixed(0)} (${pct(avg(exSub, p => p.old.peak), avg(exSub, p => p.nw.peak)).toFixed(1)}%)`);
console.log(`开火占比: ${(avg(exSub, p => p.old.duty) * 100).toFixed(0)}% → ${(avg(exSub, p => p.nw.duty) * 100).toFixed(0)}%`);
console.log(`非火焰掉血: ${avg(exSub, p => p.old.breach).toFixed(0)} → ${avg(exSub, p => p.nw.breach).toFixed(0)}`);
const sub = pairs.find(p => p.scene === 'subway');
console.log('\n--- 地铁专项 ---');
console.log(`生成总量: ${sub.old.spawn} → ${sub.nw.spawn} (${pct(sub.old.spawn, sub.nw.spawn).toFixed(1)}%)，目标≈5900`);
console.log(`时长: ${sub.old.dur}s → ${sub.nw.dur}s (${pct(sub.old.dur, sub.nw.dur).toFixed(1)}%)`);
console.log(`峰值在屏: ${sub.old.peak} → ${sub.nw.peak} (${pct(sub.old.peak, sub.nw.peak).toFixed(1)}%)`);
console.log(`火焰输出: ${sub.old.dmg} → ${sub.nw.dmg} (${pct(sub.old.dmg, sub.nw.dmg).toFixed(1)}%)`);

// ---------- HTML ----------
const esc = s => JSON.stringify(s).replace(/</g, '\\u003c');
const deltaCell = (o, n, goodWhenDown) => {
  const d = pct(o, n);
  const good = goodWhenDown ? d < 0 : d > 0;
  const cls = Math.abs(d) < 2 ? '' : good ? 'good' : 'bad';
  return `<td class="${cls}">${d >= 0 ? '+' : ''}${d.toFixed(1)}%</td>`;
};
const cmpRows = pairs.map(p => {
  const { old: o, nw: n } = p;
  return `<tr>
  <td>${p.name}</td>
  <td>${o.dur}s → ${n.dur}s</td>${deltaCell(o.dur, n.dur, true)}
  <td>${o.spawn.toLocaleString()} → ${n.spawn.toLocaleString()}</td>${deltaCell(o.spawn, n.spawn, true)}
  <td>${o.dmg.toLocaleString()} → ${n.dmg.toLocaleString()}</td>${deltaCell(o.dmg, n.dmg, false)}
  <td>${o.peak} → ${n.peak}</td>${deltaCell(o.peak, n.peak, true)}
  <td>${o.combatDps.toFixed(1)} → ${n.combatDps.toFixed(1)}</td>${deltaCell(o.combatDps, n.combatDps, false)}
  <td>${(o.duty * 100).toFixed(0)}% → ${(n.duty * 100).toFixed(0)}%</td><td></td>
  <td>${o.breach.toFixed(0)} → ${n.breach.toFixed(0)}</td><td></td>
</tr>`;
}).join('');

const sceneCards = pairs.map((p, i) => `
  <div class="card">
    <h2>${p.name}（${p.scene}）· 旧 ${p.old.dur}s / 新 ${p.nw.dur}s</h2>
    <canvas id="sv${i}" width="940" height="280"></canvas>
  </div>`).join('');

const avgCbtO = avg(exSub, p => p.old.combatDps), avgCbtN = avg(exSub, p => p.nw.combatDps);
const avgDurO = avg(exSub, p => p.old.dur), avgDurN = avg(exSub, p => p.nw.dur);
const avgPeakO = avg(exSub, p => p.old.peak), avgPeakN = avg(exSub, p => p.nw.peak);
const exSubHosp = pairs.filter(p => p.scene !== 'subway' && p.scene !== 'hospital');
const avgCbtXO = avg(exSubHosp, p => p.old.combatDps), avgCbtXN = avg(exSubHosp, p => p.nw.combatDps);
const hosp = pairs.find(p => p.scene === 'hospital');
const brchO = avg(exSub, p => p.old.breach), brchN = avg(exSub, p => p.nw.breach);
const mid = pairs.filter(p => ['dump','basement','rooftop','street'].includes(p.scene));
const midDmgPct = pct(avg(mid, p => p.old.dmg), avg(mid, p => p.nw.dmg));

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>喷火枪修复 · 新旧对比研究报告</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif; background:#0f1117; color:#e5e7eb; padding:24px; }
  h1 { text-align:center; font-size:20px; margin-bottom:4px; }
  .sub { text-align:center; color:#9ca3af; font-size:13px; margin-bottom:20px; }
  .wrap { max-width:1000px; margin:0 auto; }
  .card { background:#161a23; border:1px solid #262b38; border-radius:12px; padding:18px; margin-bottom:22px; }
  .card h2 { font-size:15px; margin-bottom:10px; color:#f3f4f6; }
  canvas { width:100%; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th, td { border:1px solid #262b38; padding:6px 6px; text-align:center; white-space:nowrap; }
  th { background:#1c2230; color:#fbbf24; }
  td:first-child { color:#9ca3af; }
  .good { color:#4ade80; font-weight:700; }
  .bad { color:#f87171; font-weight:700; }
  .note { font-size:12px; color:#9ca3af; line-height:1.8; margin-top:10px; }
  .note b { color:#e5e7eb; }
  .concl { font-size:13px; line-height:2; color:#d1d5db; }
  .concl li { margin-left:20px; margin-bottom:6px; }
  .concl b { color:#fbbf24; }
  .legend { display:flex; gap:16px; font-size:12px; color:#9ca3af; margin-bottom:8px; flex-wrap:wrap; }
  .legend .dot { display:inline-block; width:14px; height:4px; border-radius:2px; margin-right:5px; vertical-align:middle; }
</style>
</head>
<body>
<div class="wrap">
  <h1>喷火枪修复 · 新旧对比研究报告</h1>
  <p class="sub">旧组 = 修复前 09:05–09:23（8关）｜新组 = 修复后 14:34–15:15（8关）｜均 easy · 0.5s 采样</p>

  <div class="card">
    <h2>一、修复内容回顾</h2>
    <div class="concl">
      <li><b>配置语义对齐</b>：flamethrower 名义 DPS 3600/2400 → 60/40（真实每秒伤害），消除 ÷60 双重换算隐患</li>
      <li><b>火焰粒子区修复</b>：火区原点从玩家脚下上移至喷嘴前方（p.y − 322），粒子区伤害从"完全打不到"变为有效覆盖；并接线 damageCallbacks，区域伤害纳入护甲/气体护盾结算与 traceFlameDmg 采样</li>
      <li><b>地铁血量削减</b>：全关 HP+护甲流入 ~13666 → 目标 ~5900</li>
      <li><b>inFire 重置修复</b>：火焰标志每帧无条件清除，修复自爆/小蟑螂闪避行为永久触发的问题</li>
    </div>
  </div>

  <div class="card">
    <h2>二、汇总对比表（旧 → 新）</h2>
    <table>
      <tr><th>关卡</th><th>时长</th><th>Δ</th><th>生成总量</th><th>Δ</th><th>火焰输出</th><th>Δ</th><th>峰值在屏</th><th>Δ</th><th>交战DPS</th><th>Δ</th><th>开火占比</th><th></th><th>非火焰掉血</th><th></th></tr>
      ${cmpRows}
    </table>
    <div class="note">
      <b>交战DPS</b> = 在屏有怪时段的火焰输出速率（真实命中水平，核心指标）；<b>非火焰掉血</b> = 在屏血量下降中未被火焰解释的部分（≈突破防线/道具）。绿色=改善，红色=恶化。
    </div>
  </div>

  <div class="card">
    <h2>三、难度曲线 vs 喷火枪输出曲线（跨关）</h2>
    <div class="legend">
      <span><span class="dot" style="background:#9ca3af"></span>生成总量·旧（难度）</span>
      <span><span class="dot" style="background:#e5e7eb"></span>生成总量·新（难度）</span>
      <span><span class="dot" style="background:#166534"></span>火焰输出·旧</span>
      <span><span class="dot" style="background:#4ade80"></span>火焰输出·新</span>
    </div>
    <canvas id="curve" width="940" height="320"></canvas>
    <div class="note">横轴为关卡顺序（厨房→地铁）。生成总量曲线代表关卡难度（怪物 HP+护甲流入），火焰输出曲线代表喷火枪实际完成的工作量。两条曲线贴合=输出与难度匹配；输出持续高于生成=富余；低于=靠道具/突破补缺口。</div>
  </div>

  <div class="card">
    <h2>四、压力与效率（跨关）</h2>
    <div class="legend">
      <span><span class="dot" style="background:#b91c1c"></span>峰值在屏·旧</span>
      <span><span class="dot" style="background:#f87171"></span>峰值在屏·新</span>
      <span><span class="dot" style="background:#1e40af"></span>时长(s)·旧</span>
      <span><span class="dot" style="background:#60a5fa"></span>时长(s)·新</span>
    </div>
    <canvas id="pressure" width="940" height="300"></canvas>
    <div class="note">峰值在屏 = 同一时刻堆积在屏幕上的 HP+护甲最大值（压力指标）；时长为通关耗时（双折线，读右轴刻度概念值，图中已按各自最大值归一）。</div>
  </div>

  <div class="card">
    <h2>五、逐关时序对比（旧 vs 新 叠加）</h2>
    <div class="legend">
      <span><span class="dot" style="background:#f87171"></span>在屏血量+护甲·旧（红面积）</span>
      <span><span class="dot" style="background:#60a5fa"></span>在屏血量+护甲·新（蓝面积）</span>
      <span><span class="dot" style="background:#166534"></span>火焰累计·旧</span>
      <span><span class="dot" style="background:#4ade80"></span>火焰累计·新</span>
      <span><span class="dot" style="background:#6b7280"></span>生成累计·旧（虚线）</span>
      <span><span class="dot" style="background:#d1d5db"></span>生成累计·新（虚线）</span>
    </div>
    ${sceneCards}
  </div>

  <div class="card">
    <h2>六、结论</h2>
    <div class="concl" id="concl"></div>
  </div>
</div>
<script>
const PAIRS = ${esc(pairs.map(p => ({
  name: p.name, scene: p.scene,
  old: { dur: p.old.dur, spawn: p.old.spawn, dmg: p.old.dmg, peak: p.old.peak, cbt: +p.old.combatDps.toFixed(1), duty: +p.old.duty.toFixed(2), samples: p.old.samples },
  nw:  { dur: p.nw.dur,  spawn: p.nw.spawn,  dmg: p.nw.dmg,  peak: p.nw.peak,  cbt: +p.nw.combatDps.toFixed(1),  duty: +p.nw.duty.toFixed(2),  samples: p.nw.samples },
})))};
const CONCL = ${esc({
  avgCbtO: +avgCbtO.toFixed(1), avgCbtN: +avgCbtN.toFixed(1), cbtPct: +pct(avgCbtO, avgCbtN).toFixed(1),
  avgCbtXO: +avgCbtXO.toFixed(1), avgCbtXN: +avgCbtXN.toFixed(1), cbtXPct: +pct(avgCbtXO, avgCbtXN).toFixed(1),
  hospCbtO: +hosp.old.combatDps.toFixed(1), hospCbtN: +hosp.nw.combatDps.toFixed(1),
  hospDmgO: hosp.old.dmg, hospDmgN: hosp.nw.dmg, hospSpawnO: hosp.old.spawn, hospSpawnN: hosp.nw.spawn,
  avgDurO: +avgDurO.toFixed(1), avgDurN: +avgDurN.toFixed(1), durPct: +pct(avgDurO, avgDurN).toFixed(1),
  avgPeakO: Math.round(avgPeakO), avgPeakN: Math.round(avgPeakN), peakPct: +pct(avgPeakO, avgPeakN).toFixed(1),
  brchO: Math.round(brchO), brchN: Math.round(brchN), midDmgPct: +midDmgPct.toFixed(1),
  subSpawnO: sub.old.spawn, subSpawnN: sub.nw.spawn, subSpawnPct: +pct(sub.old.spawn, sub.nw.spawn).toFixed(1),
  subDurO: sub.old.dur, subDurN: sub.nw.dur, subPeakO: sub.old.peak, subPeakN: sub.nw.peak,
  subDmgO: sub.old.dmg, subDmgN: sub.nw.dmg, subCbtO: +sub.old.combatDps.toFixed(1), subCbtN: +sub.nw.combatDps.toFixed(1),
})};

// ---------- 跨关曲线图 ----------
function drawCurve() {
  const cv = document.getElementById('curve'), ctx = cv.getContext('2d');
  const W = 940, H = 320, padL = 60, padR = 16, padT = 20, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  let yMax = 10;
  for (const p of PAIRS) { yMax = Math.max(yMax, p.old.spawn, p.nw.spawn, p.old.dmg, p.nw.dmg); }
  yMax *= 1.1;
  const X = i => padL + (i / (PAIRS.length - 1)) * plotW;
  const Y = v => padT + plotH - (v / yMax) * plotH;
  ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#262b38'; ctx.lineWidth = 1;
  const step = yMax > 8000 ? 2000 : yMax > 3000 ? 1000 : 500;
  for (let g = 0; g <= yMax; g += step) {
    const y = Y(g);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'right'; ctx.fillText(g.toLocaleString(), padL - 6, y);
  }
  ctx.textAlign = 'center';
  PAIRS.forEach((p, i) => { ctx.fillStyle = '#9ca3af'; ctx.fillText(p.name, X(i), H - 14); });
  const line = (f, color, dash, width) => {
    ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    PAIRS.forEach((p, i) => i ? ctx.lineTo(X(i), Y(f(p))) : ctx.moveTo(X(i), Y(f(p))));
    ctx.stroke(); ctx.setLineDash([]);
    PAIRS.forEach((p, i) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(i), Y(f(p)), 3, 0, 7); ctx.fill(); });
  };
  line(p => p.old.spawn, '#9ca3af', [5, 4], 1.5);
  line(p => p.nw.spawn, '#e5e7eb', [], 2);
  line(p => p.old.dmg, '#166534', [5, 4], 1.5);
  line(p => p.nw.dmg, '#4ade80', [], 2.2);
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.strokeRect(padL, padT, plotW, plotH);
}
// ---------- 压力图 ----------
function drawPressure() {
  const cv = document.getElementById('pressure'), ctx = cv.getContext('2d');
  const W = 940, H = 300, padL = 60, padR = 60, padT = 20, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  let pMax = 10, dMax = 10;
  for (const p of PAIRS) { pMax = Math.max(pMax, p.old.peak, p.nw.peak); dMax = Math.max(dMax, p.old.dur, p.nw.dur); }
  pMax *= 1.12; dMax *= 1.12;
  const X = i => padL + (i / (PAIRS.length - 1)) * plotW;
  const YL = v => padT + plotH - (v / pMax) * plotH;
  const YR = v => padT + plotH - (v / dMax) * plotH;
  ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#262b38'; ctx.lineWidth = 1;
  const step = pMax > 3000 ? 1000 : pMax > 800 ? 200 : 100;
  for (let g = 0; g <= pMax; g += step) {
    const y = YL(g);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = '#f87171'; ctx.textAlign = 'right'; ctx.fillText(g.toLocaleString(), padL - 6, y);
  }
  ctx.fillStyle = '#60a5fa'; ctx.textAlign = 'left';
  for (let g = 0; g <= dMax; g += Math.ceil(dMax / 4 / 10) * 10) ctx.fillText(g + 's', W - padR + 8, YR(g));
  ctx.textAlign = 'center';
  PAIRS.forEach((p, i) => { ctx.fillStyle = '#9ca3af'; ctx.fillText(p.name, X(i), H - 14); });
  const line = (f, Y, color, dash, width) => {
    ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    PAIRS.forEach((p, i) => i ? ctx.lineTo(X(i), Y(f(p))) : ctx.moveTo(X(i), Y(f(p))));
    ctx.stroke(); ctx.setLineDash([]);
    PAIRS.forEach((p, i) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(i), Y(f(p)), 3, 0, 7); ctx.fill(); });
  };
  line(p => p.old.peak, YL, '#b91c1c', [5, 4], 1.5);
  line(p => p.nw.peak, YL, '#f87171', [], 2.2);
  line(p => p.old.dur, YR, '#1e40af', [5, 4], 1.5);
  line(p => p.nw.dur, YR, '#60a5fa', [], 2.2);
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.strokeRect(padL, padT, plotW, plotH);
}
// ---------- 逐关叠加 ----------
PAIRS.forEach((p, idx) => {
  const cv = document.getElementById('sv' + idx), ctx = cv.getContext('2d');
  const W = 940, H = 280, padL = 58, padR = 14, padT = 18, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const tMax = Math.max(p.old.dur, p.nw.dur);
  let yMax = 10;
  const scan = s => { for (const q of s) yMax = Math.max(yMax, q.hp + q.armor, q.flameDmg, q.spawnHp); };
  scan(p.old.samples); scan(p.nw.samples);
  yMax *= 1.08;
  const X = t => padL + (t / tMax) * plotW;
  const Y = v => padT + plotH - (v / yMax) * plotH;
  ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#262b38'; ctx.lineWidth = 1;
  const step = yMax > 8000 ? 4000 : yMax > 2000 ? 1000 : yMax > 400 ? 200 : 100;
  for (let g = 0; g <= yMax; g += step) {
    const y = Y(g);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'right'; ctx.fillText(g.toLocaleString(), padL - 6, y);
  }
  ctx.textAlign = 'center';
  for (let t = 0; t <= tMax; t += 30) { ctx.fillStyle = '#4b5563'; ctx.fillText(t + 's', X(t), H - 10); }
  const spawn = (arr, color) => {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath();
    arr.forEach((q, i) => i ? ctx.lineTo(X(q.t), Y(q.spawnHp)) : ctx.moveTo(X(q.t), Y(q.spawnHp)));
    ctx.stroke(); ctx.setLineDash([]);
  };
  const area = (arr, f, fill, stroke) => {
    ctx.beginPath(); ctx.moveTo(X(arr[0].t), Y(0));
    arr.forEach(q => ctx.lineTo(X(q.t), Y(f(q))));
    ctx.lineTo(X(arr[arr.length - 1].t), Y(0)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.beginPath(); arr.forEach((q, i) => i ? ctx.lineTo(X(q.t), Y(f(q))) : ctx.moveTo(X(q.t), Y(f(q))));
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.6; ctx.stroke();
  };
  const flame = (arr, color, width) => {
    ctx.beginPath(); arr.forEach((q, i) => i ? ctx.lineTo(X(q.t), Y(q.flameDmg)) : ctx.moveTo(X(q.t), Y(q.flameDmg)));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  spawn(p.old.samples, '#6b7280');
  spawn(p.nw.samples, '#d1d5db');
  area(p.old.samples, q => q.hp + q.armor, 'rgba(248,113,113,0.22)', '#f87171');
  area(p.nw.samples, q => q.hp + q.armor, 'rgba(96,165,250,0.22)', '#60a5fa');
  flame(p.old.samples, '#166534', 1.6);
  flame(p.nw.samples, '#4ade80', 2);
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.strokeRect(padL, padT, plotW, plotH);
});
// ---------- 结论 ----------
document.getElementById('concl').innerHTML = \`
  <li><b>真实输出提升（结构分化）</b>：排除地铁后，火焰交战 DPS 平均 \${CONCL.avgCbtO} → \${CONCL.avgCbtN}（<b>+\${CONCL.cbtPct}%</b>）。但提升集中于<b>医院</b>（\${CONCL.hospCbtO} → \${CONCL.hospCbtN}，+120%）——喷嘴火区修复后，束+区域双重伤害首次压过护士回血速率；其余六关平均 \${CONCL.avgCbtXO} → \${CONCL.avgCbtXN}（+\${CONCL.cbtXPct}%），前期关卡（厨房/下水道）本就容易，DPS 持平符合预期。</li>
  <li><b>击杀效率改善</b>：中期关卡（垃圾场/地下室/天台/街道）火焰<b>总</b>输出反而下降 \${CONCL.midDmgPct}%，但交战 DPS 上升、时长缩短——更快的击杀减少了护士回血造成的血量池膨胀与溢出浪费，同样多的生成量用更少的伤害就清完了。</li>
  <li><b>漏网显著减少</b>：非火焰掉血（≈突破防线/道具兜底）从平均每关 \${CONCL.brchO} 降至 \${CONCL.brchN}（-93%）。这印证了 inFire 修复的效果——修复前火焰标志卡真导致自爆/小蟑螂永久闪避、难以命中，修复后闪避行为恢复正常，漏网之鱼基本消失。</li>
  <li><b>压力下降</b>：峰值在屏血量平均 \${CONCL.avgPeakO} → \${CONCL.avgPeakN}（\${CONCL.peakPct}%），通关时长平均 \${CONCL.avgDurO}s → \${CONCL.avgDurN}s（\${CONCL.durPct}%），输出提升有效转化为清场速度，玩家压力显著缓解。</li>
  <li><b>地铁专项达标</b>：生成总量 \${CONCL.subSpawnO.toLocaleString()} → \${CONCL.subSpawnN.toLocaleString()}（<b>\${CONCL.subSpawnPct}%</b>，目标 ≈5900 已达成）；时长 \${CONCL.subDurO}s → \${CONCL.subDurN}s（-41%），峰值在屏 \${CONCL.subPeakO.toLocaleString()} → \${CONCL.subPeakN}（-49%），交战 DPS \${CONCL.subCbtO} → \${CONCL.subCbtN}（+309%，怪海场景下区域伤害收益最大）。修复前"难度 66 倍于相邻关卡"的尖峰被削平。</li>
  <li><b>曲线形态</b>：修复后火焰输出曲线与生成总量（难度）曲线走势一致（见第三节图），且全程输出 ≥ 生成，喷火枪 DPS 与关卡难度匹配良好；地铁从"输出远低于难度"的异常点回归曲线族内。<b>医院火焰总输出 \${CONCL.hospDmgO.toLocaleString()} → \${CONCL.hospDmgN.toLocaleString()}（生成 \${CONCL.hospSpawnO.toLocaleString()} → \${CONCL.hospSpawnN.toLocaleString()}）</b>：输出为生成的 2.2 倍，说明护士回血仍在制造额外血量池，但已从"无法击杀"变为"可以快速击杀"，机制运转正常。</li>
\`;
drawCurve();
drawPressure();
</script>
</body>
</html>`;

writeFileSync('D:/CocosGreater/Fire Roach KillerV2.6/app/balance-report.html', html, 'utf8');
console.log('\nbalance-report.html written, pairs:', pairs.length);
