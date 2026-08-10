// 读取下载目录的 roach-trace JSON，聚合统计并生成 trace-analysis.html
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DL = 'C:/Users/16265/Downloads';
const NAME = { kitchen:'厨房', sewer:'下水道', dump:'垃圾场', basement:'地下室', rooftop:'天台', street:'街道', hospital:'医院', subway:'地铁', supermarket:'超市', school:'学校', nest:'巢穴' };
const ORDER = ['kitchen','sewer','dump','basement','rooftop','street','hospital','subway','supermarket','school','nest'];

const files = readdirSync(DL).filter(f => f.startsWith('roach-trace-') && f.endsWith('.json'));
const sessions = files.map(f => ({ file: f, ...JSON.parse(readFileSync(`${DL}/${f}`, 'utf8')) }));
sessions.sort((a, b) => ORDER.indexOf(a.scene) - ORDER.indexOf(b.scene));

const stats = sessions.map(s => {
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
      const dDrop = (q.hp + q.armor) - (p.hp + p.armor);   // 在屏血量下降
      const dDmg = p.flameDmg - q.flameDmg;                // 火焰结算
      if (dDrop > 0 && dDrop - dDmg > 3) breach += dDrop - dDmg; // 未被火焰解释的下降≈突破/其他
      if (p.hp + p.armor > 0 || q.hp + q.armor > 0) { combatDmg += dDmg; combatTime += p.t - q.t; }
    }
  }
  const duty = firingN / arr.length;
  return {
    scene: s.scene, name: NAME[s.scene] || s.scene, result: s.result, dur: s.duration,
    waves: last.wave, spawn: last.spawnHp, dmg: last.flameDmg,
    peak, peakT, peakShield,
    duty, avgDps: last.flameDmg / s.duration,
    firingDps: duty > 0 ? last.flameDmg / (duty * s.duration) : 0,
    combatDps: combatTime > 0 ? combatDmg / combatTime : 0,
    breach,
  };
});

console.log('scene      dur(s)  spawn  flame  peak(armor)  peakT   duty   avgDPS  fireDPS  cbtDPS  breach');
for (const r of stats) {
  console.log(
    `${r.name.padEnd(6)} ${String(r.dur).padStart(6)} ${String(r.spawn).padStart(6)} ${String(r.dmg).padStart(6)} ${String(r.peak).padStart(8)} ${String(r.peakT).padStart(6)} ${(r.duty*100).toFixed(0).padStart(5)}% ${r.avgDps.toFixed(0).padStart(7)} ${r.firingDps.toFixed(0).padStart(8)} ${r.combatDps.toFixed(0).padStart(7)} ${r.breach.toFixed(0).padStart(7)}`
  );
}

// ---------- 生成 HTML ----------
const esc = s => JSON.stringify(s).replace(/</g, '\\u003c');
const cards = stats.map((r, i) => `
  <div class="card">
    <h2>${i + 1}. ${r.name}（${r.scene}）· ${r.result === 'victory' ? '胜利' : '失败'} · 时长 ${r.dur}s</h2>
    <canvas id="cv${i}" width="940" height="260"></canvas>
  </div>`).join('');

const tableRows = stats.map(r => `<tr>
  <td>${r.name}</td><td>${r.dur}</td><td>${r.waves}</td><td>${r.spawn.toLocaleString()}</td>
  <td>${r.dmg.toLocaleString()}</td><td>${r.peak}</td><td>${r.peakT}s</td><td>${r.peakShield || '—'}</td>
  <td>${(r.duty * 100).toFixed(0)}%</td><td>${r.avgDps.toFixed(0)}</td><td>${r.firingDps.toFixed(0)}</td><td>${r.combatDps.toFixed(0)}</td><td>${r.breach.toFixed(0)}</td>
</tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>实战采集 · 在屏血量 vs 喷火枪输出</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif; background:#0f1117; color:#e5e7eb; padding:24px; }
  h1 { text-align:center; font-size:20px; margin-bottom:4px; }
  .sub { text-align:center; color:#9ca3af; font-size:13px; margin-bottom:20px; }
  .wrap { max-width:1000px; margin:0 auto; }
  .card { background:#161a23; border:1px solid #262b38; border-radius:12px; padding:18px; margin-bottom:22px; }
  .card h2 { font-size:15px; margin-bottom:10px; color:#f3f4f6; }
  canvas { width:100%; }
  .legend { display:flex; gap:18px; font-size:12px; color:#9ca3af; margin-bottom:8px; flex-wrap:wrap; }
  .legend .dot { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:5px; vertical-align:middle; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th, td { border:1px solid #262b38; padding:6px 8px; text-align:center; }
  th { background:#1c2230; color:#fbbf24; }
  td:first-child { color:#9ca3af; text-align:left; }
  .hi { color:#f87171; font-weight:700; }
  .note { font-size:12px; color:#9ca3af; line-height:1.7; margin-top:10px; }
  .note b { color:#e5e7eb; }
</style>
</head>
<body>
<div class="wrap">
  <h1>实战采集 · 在屏血量+护甲 vs 喷火枪输出</h1>
  <p class="sub">8 局实测（easy）· 0.5s 采样 · 红=在屏血量+护甲（面积）｜蓝=在屏气体护盾｜绿=火焰累计输出｜灰虚线=累计生成血量+护甲</p>

  <div class="card">
    <h2>汇总指标</h2>
    <table>
      <tr><th>关卡</th><th>时长(s)</th><th>波数</th><th>生成总量</th><th>火焰总输出</th><th>峰值在屏</th><th>峰值时刻</th><th>峰值护盾</th><th>开火占比</th><th>平均DPS</th><th>开火DPS</th><th>交战DPS</th><th>非火焰掉血</th></tr>
      ${tableRows}
    </table>
    <div class="note">
      <b>开火DPS</b> = 总输出 ÷ 开火时间（含空扫/过热循环）；<b>交战DPS</b> = 在屏有怪时段的实际输出速率（更接近真实命中水平）；<b>非火焰掉血</b> = 在屏血量下降中未被火焰伤害解释的部分（≈突破防线/道具/其他来源，估算口径）。
    </div>
  </div>
  ${cards}
</div>
<script>
const SESSIONS = ${esc(sessions.map(s => ({ name: NAME[s.scene] || s.scene, duration: s.duration, samples: s.samples })))};
const COLORS = { hp:'#f87171', armor:'#fb923c', shield:'#60a5fa', dmg:'#4ade80', spawn:'#9ca3af' };
SESSIONS.forEach((sess, idx) => {
  const cv = document.getElementById('cv' + idx), ctx = cv.getContext('2d');
  const W = 940, H = 260, padL = 58, padR = 14, padT = 26, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const arr = sess.samples, last = arr[arr.length - 1];
  let yMax = Math.max(last.spawnHp, last.flameDmg, 10);
  for (const p of arr) yMax = Math.max(yMax, p.hp + p.armor);
  yMax *= 1.08;
  const X = t => padL + (t / sess.duration) * plotW;
  const Y = v => padT + plotH - (v / yMax) * plotH;
  ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle';
  // 网格
  ctx.lineWidth = 1; ctx.strokeStyle = '#262b38';
  const step = yMax > 8000 ? 4000 : yMax > 2000 ? 1000 : yMax > 400 ? 200 : 100;
  for (let g = 0; g <= yMax; g += step) {
    const y = Y(g);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'right'; ctx.fillText(g.toLocaleString(), padL - 6, y);
  }
  // 波次分界线
  let prevWave = arr[0].wave;
  ctx.setLineDash([3, 4]);
  for (const p of arr) {
    if (p.wave !== prevWave) {
      const x = X(p.t);
      ctx.strokeStyle = '#3a4152'; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.fillStyle = '#6b7280'; ctx.textAlign = 'center'; ctx.fillText('W' + p.wave, x, padT - 8);
      prevWave = p.wave;
    }
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#6b7280'; ctx.textAlign = 'center'; ctx.fillText('W' + arr[0].wave, X(arr[0].t) + 8, padT - 8);
  // 累计生成（灰虚线）
  ctx.setLineDash([5, 4]); ctx.strokeStyle = COLORS.spawn; ctx.lineWidth = 1.5; ctx.beginPath();
  arr.forEach((p, i) => i ? ctx.lineTo(X(p.t), Y(p.spawnHp)) : ctx.moveTo(X(p.t), Y(p.spawnHp)));
  ctx.stroke(); ctx.setLineDash([]);
  // 在屏血量+护甲（红面积）
  ctx.beginPath(); ctx.moveTo(X(arr[0].t), Y(0));
  arr.forEach(p => ctx.lineTo(X(p.t), Y(p.hp + p.armor)));
  ctx.lineTo(X(last.t), Y(0)); ctx.closePath();
  ctx.fillStyle = 'rgba(248,113,113,0.28)'; ctx.fill();
  ctx.beginPath(); arr.forEach((p, i) => i ? ctx.lineTo(X(p.t), Y(p.hp + p.armor)) : ctx.moveTo(X(p.t), Y(p.hp + p.armor)));
  ctx.strokeStyle = COLORS.hp; ctx.lineWidth = 1.8; ctx.stroke();
  // 气体护盾（蓝线，如有）
  if (arr.some(p => p.shield > 0)) {
    ctx.beginPath(); arr.forEach((p, i) => i ? ctx.lineTo(X(p.t), Y(p.shield)) : ctx.moveTo(X(p.t), Y(p.shield)));
    ctx.strokeStyle = COLORS.shield; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // 火焰累计输出（绿线）
  ctx.beginPath(); arr.forEach((p, i) => i ? ctx.lineTo(X(p.t), Y(p.flameDmg)) : ctx.moveTo(X(p.t), Y(p.flameDmg)));
  ctx.strokeStyle = COLORS.dmg; ctx.lineWidth = 2; ctx.stroke();
  // 底部开火条
  ctx.fillStyle = 'rgba(74,222,128,0.35)';
  arr.forEach(p => { if (p.firing) ctx.fillRect(X(p.t), padT + plotH + 6, Math.max(1, plotW / arr.length), 5); });
  ctx.fillStyle = '#6b7280'; ctx.textAlign = 'left';
  ctx.fillText('开火', 4, padT + plotH + 9);
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.strokeRect(padL, padT, plotW, plotH);
});
</script>
</body>
</html>`;

writeFileSync('D:/CocosGreater/Fire Roach KillerV2.6/app/trace-analysis.html', html, 'utf8');
console.log('\ntrace-analysis.html written, sessions:', sessions.length);
