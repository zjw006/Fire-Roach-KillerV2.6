// 平衡数值测算（只读 trace，不改配置）：算每关生成速率峰值 vs 实测交战DPS，给出建议火枪DPS
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TRACE_DIR = 'D:/CocosGreater/Fire Roach KillerV2.6/app/traces';
const NAME = { kitchen: '厨房', sewer: '下水道', dump: '垃圾场', basement: '地下室', street: '街道', rooftop: '天台', hospital: '医院', subway: '地铁', supermarket: '超市', school: '学校', nest: '巢穴' };
const SCENES = ['kitchen', 'sewer', 'dump', 'basement', 'street', 'rooftop', 'hospital', 'subway', 'supermarket', 'school', 'nest'];

// 当前火枪配置（与 items.ts 一致）
const NOMINAL_DPS = 25;           // 总 DPS
const BEAM_SHARE = 0.75;          // 束占比
const BEAM_DPS = NOMINAL_DPS * BEAM_SHARE; // 18.75

const files = readdirSync(TRACE_DIR).filter(f => /^roach-trace-([a-z]+)-(victory|defeat)-\d+\.json$/.test(f));
const byScene = {};
for (const f of files) {
  const m = f.match(/^roach-trace-([a-z]+)-(victory|defeat)-\d+\.json$/);
  const scene = m[1];
  const p = join(TRACE_DIR, f);
  const data = JSON.parse(readFileSync(p, 'utf8'));
  data.result = m[2];
  const mt = statSync(p).mtimeMs;
  if (!byScene[scene] || mt > byScene[scene].mt) byScene[scene] = { mt, m: data, result: m[2] };
}

function peakSpawnRate(samples, winS) {
  // 滑动窗口内最大生成速率（spawnHp 增量 / 时间）
  let peak = 0, peakT = 0;
  let j = 0;
  for (let i = 0; i < samples.length; i++) {
    while (samples[i].t - samples[j].t > winS) j++;
    const dt = samples[i].t - samples[j].t;
    if (dt > 0.1) {
      const rate = (samples[i].spawnHp - samples[j].spawnHp) / dt;
      if (rate > peak) { peak = rate; peakT = samples[i].t; }
    }
  }
  return { peak, peakT };
}

console.log('关卡   | 结果 | 时长  | 生成总量 | 火焰输出 | 输出/生成 | 平均生成率 | 峰值生成率 | 实测交战DPS | 有效系数');
console.log('       |      |       |          |          |           | (HP/s)     | (HP/s,5s)  | (HP/s)      | (交战/名义)');
for (const sc of SCENES) {
  const s = byScene[sc];
  if (!s) { console.log(sc.padEnd(4) + ' | 无数据'); continue; }
  const arr = s.m.samples;
  const last = arr[arr.length - 1];
  const dur = s.m.duration;
  const spawn = last.spawnHp;
  const dmg = last.flameDmg;
  const ratio = spawn > 0 ? dmg / spawn : 0;
  const avgRate = spawn / dur;
  const { peak, peakT } = peakSpawnRate(arr, 5);
  // 交战DPS：在屏有怪时段的输出速率
  let cd = 0, ct = 0;
  for (let i = 1; i < arr.length; i++) {
    const p = arr[i], q = arr[i - 1];
    if (p.hp + p.armor > 0 || q.hp + q.armor > 0) { cd += p.flameDmg - q.flameDmg; ct += p.t - q.t; }
  }
  const combatDps = ct > 0 ? cd / ct : 0;
  const eff = combatDps / NOMINAL_DPS;
  console.log(
    `${NAME[sc].padEnd(4)} | ${s.result === 'victory' ? '胜' : '败'}  | ${String(dur).padStart(5)}s | ${String(spawn).padStart(7)} | ${String(dmg).padStart(7)} | ${ratio.toFixed(2).padStart(6)} | ${avgRate.toFixed(1).padStart(7)} | ${peak.toFixed(1).padStart(9)} | ${combatDps.toFixed(1).padStart(8)} | ${(eff * 100).toFixed(0).padStart(3)}%`
  );
}

console.log('\n=== 建议：火枪名义DPS 应调到多少才顶得住各关峰值生成 ===');
console.log('按 有效系数≈0.7（实测交战DPS/名义DPS）折算 名义DPS = 峰值生成率 / 0.7');
for (const sc of SCENES) {
  const s = byScene[sc];
  if (!s) continue;
  const arr = s.m.samples;
  const dur = s.m.duration;
  const spawn = arr[arr.length - 1].spawnHp;
  const { peak } = peakSpawnRate(arr, 5);
  const reqNominal = Math.ceil(peak / 0.7);
  console.log(`${NAME[sc].padEnd(4)} | 峰值生成率 ${peak.toFixed(1)} HP/s → 建议名义DPS≈${reqNominal}  (束DPS≈${Math.round(reqNominal * BEAM_SHARE)})`);
}
