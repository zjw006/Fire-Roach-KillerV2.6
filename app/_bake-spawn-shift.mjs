// 一次性脚本：把出生上移变换固化进 waves.ts 超市阵型 slots 坐标
// 变换规则（与 FormationSystem.addPlan 原运行时一致）：组顶 → 远边(353)+6，纵深偏移 ×0.75
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'D:/CocosGreater/Fire Roach KillerV2.6/app/src/game/data/waves.ts';
const FAR_TOP = 353, MARGIN = 6, SCALE = 0.75;
const SHIFT_TOP = FAR_TOP + MARGIN;

let text = readFileSync(PATH, 'utf8');
const pageData = []; // 供页面使用的数据

let groupIdx = 0;
const out = text.replace(/\{ slots: \[([\s\S]*?)\]\s*\}/g, (m, body) => {
  const slotRe = /\{ type: RoachType\.(\w+), x: (\d+), y: (\d+)(, anchor: true)?(, motion: '(\w+)')? \}/g;
  const slots = [];
  let sm;
  while ((sm = slotRe.exec(body)) !== null) {
    slots.push({ type: sm[1], x: +sm[2], y: +sm[3], anchor: !!sm[4], motion: sm[6] || null });
  }
  if (slots.length === 0) return m;
  const topY = Math.min(...slots.map(s => s.y));
  for (const s of slots) s.y = Math.round(SHIFT_TOP + (s.y - topY) * SCALE);
  pageData.push({ group: ++groupIdx, slots });
  const lines = slots.map(s => {
    let line = `        { type: RoachType.${s.type}, x: ${s.x}, y: ${s.y}`;
    if (s.anchor) line += ', anchor: true';
    if (s.motion) line += `, motion: '${s.motion}'`;
    return line + ' },';
  });
  return `{ slots: [\n${lines.join('\n')}\n      ] }`;
});

writeFileSync(PATH, out, 'utf8');
console.log('groups transformed:', groupIdx);
console.log('PAGE_DATA=' + JSON.stringify(pageData));
