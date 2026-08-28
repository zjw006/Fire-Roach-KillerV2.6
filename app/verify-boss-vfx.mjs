// 一次性验证脚本：巢穴 BOSS 战新机制冒烟（波次并行供怪 / 技能AI决策 / 休整 / 循环波次）
// 用法: node verify-boss-vfx.mjs
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GAME_URL = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const EXE = existsSync(CHROME) ? CHROME : EDGE;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: ['--mute-audio', '--no-first-run', '--disable-gpu'],
  defaultViewport: { width: 580, height: 1080 },
  userDataDir: join(tmpdir(), 'roach-boss-ai-verify-' + Date.now()),
});
const page = await browser.newPage();
page.on('console', m => {
  const t = m.text();
  if (t.includes('[BossKing]')) console.log('PAGE:', t);
});
await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.waitForFunction('window.__engine !== undefined', { timeout: 30_000 });
await sleep(1500);
await page.evaluate(() => window.__engine.start('story', 'nest', false, []));
console.log('已强制开局巢穴（Boss 战 + 波次并行 + 自动清场），采样 120s...');

let maxWaveSeen = 0, maxRoaches = 0, bombsSeen = 0, loopSeen = false, prevWave = 0;
for (let i = 0; i < 50; i++) {
  // 自动清场+防线回满：保持战斗不结束，让波次推进到第 6 波验证循环（killRoach 走引擎正规击杀管线）
  await page.evaluate(() => {
    const e = window.__engine;
    if (e.state !== 'playing') return;
    if (typeof e.maxDefenseHp === 'number') e.defenseHp = e.maxDefenseHp; // 仅验证用：抵消漏弹 -30，防止提前败北
    for (let k = e.roaches.length - 1; k >= 0; k--) {
      const r = e.roaches[k];
      if (r && !r.isBoss && r.state === 'alive') e.killRoach(r, k);
    }
  }).catch(() => {});
  const st = await page.evaluate(() => {
    const e = window.__engine;
    const bk = e.bossKingSystem;
    const roaches = e.roaches.filter(r => r.state === 'alive').length;
    return {
      state: e.state,
      wave: e.waveManager?.wave ?? -1,
      waveSpawning: e.waveManager?.waveSpawning ?? false,
      spawnQueue: e.waveManager?.spawnQueue?.length ?? -1,
      roaches,
      bkActive: bk?.isActive() ?? false,
      bkPhase: bk?.state.phase ?? 0,
      bkSkill: bk ? `${bk.state.skillState}/${bk.state.telegraphSkill}` : '-',
      skillsCasted: bk?.state.skillsCasted ?? -1,
      bombs: bk ? bk.bombs.getBombs().length : 0,
      bossHp: bk?.state.boss.hp ?? -1,
      bossSize: bk ? (await0 => 0, 0) : 0, // placeholder 占位避免 evaluate 复杂度
    };
  }).catch(err => ({ err: String(err) }));
  if (st.err) { console.log('采样异常:', st.err); break; }
  if (prevWave >= 5 && st.wave === 1) loopSeen = true; // 第 5/6 波后回到第 1 波 = 循环生效
  prevWave = st.wave;
  maxWaveSeen = Math.max(maxWaveSeen, st.wave);
  maxRoaches = Math.max(maxRoaches, st.roaches);
  bombsSeen = Math.max(bombsSeen, st.bombs);
  console.log(`t=${(i + 1) * 3}s state=${st.state} wave=${st.wave} 怪=${st.roaches}(峰值${maxRoaches}) 队列=${st.spawnQueue} bossHP=${st.bossHp} 技能=${st.bkSkill} 已施放=${st.skillsCasted} 弹=${st.bombs}`);
  await sleep(3000);
}

console.log(`\n===== 冒烟结论 =====`);
console.log(`波次推进: 最高 wave=${maxWaveSeen}（>1 说明波次在推进）`);
console.log(`循环波次: ${loopSeen ? '是（第 6 波清空后回到第 1 波）' : '否/未观察到'}`);
console.log(`小怪供应: 存活峰值 ${maxRoaches}（>0 说明波次在出怪）`);
console.log(`炸弹出现: ${bombsSeen > 0 ? '是' : '否'}（投弹技能生效）`);
await browser.close();
