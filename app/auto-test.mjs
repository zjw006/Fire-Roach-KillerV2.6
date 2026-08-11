// =============================================================================
// 关卡数值自测脚本（全真 UI 点击流程版）
// 用法: node auto-test.mjs [easy|hard] [--headless] [--only=kitchen]
// 流程: 启动浏览器 → 点击"点击开始"进入 → 剧情模式 → 简单 → 选关
//       → 自动跳过漫画/对话/新手引导 → 战斗中自动瞄准开火、拾取并使用掉落道具
//       → 战后拾取奖励道具/跳过揭示 → 结算界面返回主菜单 → 选下一关循环
//       → 11 关完成后生成研究报告
// 产出: traces/*.json + auto-report.html + 控制台汇总
// =============================================================================
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIFF = (process.argv[2] === 'hard') ? 'hard' : 'easy';
const DIFF_NAME = DIFF === 'hard' ? '困难' : '简单';
const HEADLESS = process.argv.includes('--headless');
// --only=kitchen 只跑指定关卡（冒烟测试/单关调试用）
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
const GAME_URL = process.env.GAME_URL || 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const EXE = existsSync(CHROME) ? CHROME : EDGE;

// 与 SCENE_UNLOCK_CHAIN 一致的关卡顺序 + 场景显示名（SCENE_CONFIGS.name）
const SCENES = ['kitchen', 'sewer', 'dump', 'basement', 'street', 'rooftop', 'hospital', 'subway', 'supermarket', 'school', 'nest'];
const SCENE_NAME = {
  kitchen: '恐怖厨房', sewer: '阴暗下水道', dump: '垃圾场', basement: '地下室',
  street: '城市街道', rooftop: '天台决战', hospital: '废弃医院', subway: '废弃地铁',
  supermarket: '废弃超市', school: '废弃学校', nest: '蟑螂巢穴',
};
const NAME = { kitchen: '厨房', sewer: '下水道', dump: '垃圾场', basement: '地下室', street: '街道', rooftop: '天台', hospital: '医院', subway: '地铁', supermarket: '超市', school: '学校', nest: '巢穴' };
const TRACE_DIR = fileURLToPath(new URL('./traces/', import.meta.url)); // fileURLToPath 正确解码 %20 等转义
const LEVEL_TIMEOUT = 480_000;  // 单关战斗超时 8 分钟
const UI_TIMEOUT = 90_000;      // UI 导航超时 90 秒

mkdirSync(TRACE_DIR, { recursive: true });

// ---------- 注入页面侧的驱动器 ----------
// 原则：UI 界面用真实 DOM 点击（button.click()），战斗操作用引擎 API（瞄准/开火/道具放置）
const DRIVER = `
window.__driver = {
  targetSceneName: null,
  diffName: '简单',
  itemTimer: 0,
  prepSelected: false, // 战前准备界面是否已选中道具（防止重复点击导致取消选中）

  visible(el) { return !!(el && el.offsetParent); },

  // 查找包含指定文字的可见元素（优先 button，跳过整页大容器）
  findText(text) {
    const els = document.querySelectorAll('button, a, span, p, div');
    let fallback = null;
    for (const el of els) {
      if (!this.visible(el)) continue;
      const t = (el.textContent || '').replace(/\\s+/g, '');
      if (!t.includes(text)) continue;
      if (t.length > 60) continue; // 跳过大容器（整页文本）
      if (el.tagName === 'BUTTON') return el;
      if (!fallback) fallback = el;
    }
    return fallback;
  },
  clickText(text) { const el = this.findText(text); if (el) el.click(); return !!el; },
  hasText(text) { return !!this.findText(text); },

  // 点击最顶层可见的全屏浮层（用于"点击任意位置关闭"的界面，如道具揭示）
  // 注意：ItemRevealScreen 根元素是 absolute inset-0 z-50 cursor-pointer（非 fixed），且文字揭示动画完成前点击无效（组件内门控，重试无害）
  clickTopOverlay() {
    const els = [...document.querySelectorAll('div.fixed.inset-0, div.absolute.inset-0.z-50.cursor-pointer')].filter(el => this.visible(el));
    const top = els[els.length - 1];
    if (top) { top.click(); return true; }
    return false;
  },

  // UI 界面处理（每拍调用一次），返回本拍动作描述或 null
  ui() {
    const e = window.__engine;
    // 1. 标题/加载页："点击开始"
    if (this.clickText('点击开始')) return 'title:start';
    // 2. 厨房新手引导："跳过引导"
    if (this.clickText('跳过引导')) return 'tutorial:skip';
    // 3. 漫画/剧情对话："跳过"
    if (this.clickText('跳过')) return 'dialog:skip';
    // 4. 地铁精英/斩螂教学对话（无跳过按钮，引擎暂停标记）：点击对话框推进
    if (e && e.state === 'playing' && (e.eliteTutorialPause || e.knifeTutorialPause)) {
      if (this.clickText('继续') || this.clickText('跳过') || this.clickTopOverlay()) return 'subway_tutorial:advance';
    }
    // 5. 战前准备界面：先按道具名选中一个道具（道具按钮是 lucide svg 图标，无 <img>），再点"开始战斗"
    //    注意：道具按钮是切换式的，重复点击会取消选中，故用 prepSelected 保证只选一次
    if (this.hasText('开始战斗')) {
      if (!this.prepSelected) {
        const ITEM_NAMES = ['蟑螂贴板', '强力风扇', '燃烧瓶', '杀虫喷雾', '散弹模式', '电蚊拍', '雷达激光', '斩螂'];
        for (const n of ITEM_NAMES) { if (this.clickText(n)) { this.prepSelected = true; break; } }
      }
      this.clickText('开始战斗');
      return 'preparation:start';
    }
    // 6. 结算界面：交还给 Node 侧处理（先采 trace 再点返回主菜单）
    if (e && (e.state === 'wave_clear' || e.state === 'game_over')) return null;
    // 7. 选关界面：点击目标关卡卡片
    if (this.targetSceneName && this.clickText(this.targetSceneName)) return 'scene:' + this.targetSceneName;
    // 8. 难度选择
    if (this.clickText(this.diffName)) return 'difficulty:' + this.diffName;
    // 9. 主菜单：剧情模式
    if (this.clickText('剧情模式')) return 'mode:story';
    return null;
  },

  // 战斗节拍：瞄准/开火/道具使用/战后道具拾取信息
  tick() {
    const e = window.__engine;
    if (!e) return { state: 'no_engine' };
    const st = e.state;

    // 先处理可能覆盖在战斗上的 UI（新手引导/教学对话等）
    const uiAction = this.ui();

    if (st === 'playing') {
      // 道具放置流程：pending_click → 点目标位置；placing → 松手部署
      if (e.itemPlaceState === 'pending_click') {
        let tx = e.width / 2, ty = e.height * 0.4, by = -1;
        for (const r of e.roaches) {
          if (r.state !== 'alive') continue;
          if (r.y > by) { by = r.y; tx = r.x; ty = r.y; }
        }
        const rect = e.canvas.getBoundingClientRect();
        e.handleScreenClick(rect.left + tx * rect.width / e.width, rect.top + ty * rect.height / e.height);
      } else if (e.itemPlaceState === 'placing') {
        e.onItemRelease();
      } else {
        // 自动瞄准：锁定最靠近防线的活蟑螂（y 最大）
        let best = null, count = 0;
        for (const r of e.roaches) {
          if (r.state !== 'alive') continue;
          count++;
          if (!best || r.y > best.y) best = r;
        }
        if (best) {
          e.mouseX = best.x; // 玩家 x 跟随，火焰束对齐目标（走近掉落道具时自动拾取）
          e.player.isFiring = true;
        } else {
          e.player.isFiring = false; // 场上无怪，停火省燃气
        }
        // 自动使用掉落道具：场上有怪且库存非空时，每 ~3 秒用掉第一个（即点即用型直接生效，放置型走上面的放置流程）
        this.itemTimer++;
        if (count >= 2 && e.inventory.length > 0 && this.itemTimer >= 12) {
          this.itemTimer = 0;
          e.selectItem(0);
        }
      }
      return { state: st, wave: e.wave, ui: uiAction, inventory: e.inventory.length };
    }

    if (st === 'item_drop') {
      const it = e.itemDropOnField;
      const rect = e.canvas.getBoundingClientRect();
      return {
        state: st,
        item: it ? { x: it.x, y: it.y, falling: it.falling, collected: it.collected } : null,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        w: e.width, h: e.height,
      };
    }

    if (st === 'item_reveal') {
      // 道具揭示界面："点击任意位置关闭"
      this.clickTopOverlay();
      return { state: st };
    }

    return { state: st, wave: e.wave, ui: uiAction };
  },

  getTrace() { try { return localStorage.getItem('roach_trace_last'); } catch { return null; } },
  clearTrace() { try { localStorage.removeItem('roach_trace_last'); } catch {} },

  // 结算界面 → 返回主菜单（重试直到成功）
  quitToMenu() {
    return this.clickText('返回主菜单');
  },

  // 解锁全部关卡 + 全部武器道具（首次运行播种用；武器 ≥4 才会触发战前准备界面，全解锁可覆盖该 UI 路径）
  unlockAllScenes(scenes) {
    const e = window.__engine;
    if (!e) return false;
    e.progress.scenesUnlocked = scenes.slice();
    e.progress.weaponsUnlocked = ['flamethrower', 'sticky', 'fan', 'molotov', 'poison', 'shotgun', 'swatter', 'radar', 'knife'];
    try { e.saveProgress(); } catch {}
    return true;
  },
};`;

// ---------- 指标计算（与 balance-report.mjs 同口径） ----------
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 主流程 ----------
async function main() {
  const browser = await puppeteer.launch({
    executablePath: EXE,
    headless: HEADLESS,
    defaultViewport: { width: 560, height: 1000 },
    userDataDir: join(tmpdir(), 'roach-auto-test-profile'), // 独立配置目录，避免与用户浏览器冲突
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=580,1080', '--disable-features=TranslateUI'],
  });
  const page = await browser.newPage();
  page.on('pageerror', () => {}); // 忽略页面报错（音频等）

  console.log(`[auto-test] 打开 ${GAME_URL} (难度=${DIFF}, headless=${HEADLESS})`);
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction('window.__engine !== undefined', { timeout: 30_000 });

  // 清空存档 → 注入驱动器 → 解锁全部关卡 → 刷新（保证可从选关界面点任意关卡）
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__engine !== undefined', { timeout: 30_000 });
  await page.evaluate(DRIVER);
  await page.evaluate((scenes) => window.__driver.unlockAllScenes(scenes), SCENES);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__engine !== undefined', { timeout: 30_000 });
  await page.evaluate(DRIVER);
  console.log('[auto-test] 存档已重置并解锁全部 11 关，开始全真 UI 流程\n');

  const results = [];
  const scenesToRun = ONLY ? SCENES.filter(s => s === ONLY) : SCENES;
  if (scenesToRun.length === 0) { console.error(`[auto-test] --only=${ONLY} 不在关卡列表中`); await browser.close(); process.exit(1); }

  for (let i = 0; i < scenesToRun.length; i++) {
    const scene = scenesToRun[i];
    console.log(`[${i + 1}/${scenesToRun.length}] ${NAME[scene]}(${scene}) — UI 导航中...`);
    await page.evaluate((sn, dn) => {
      window.__driver.targetSceneName = sn;
      window.__driver.diffName = dn;
      window.__driver.prepSelected = false; // 每关重置战前准备选择状态
      window.__driver.clearTrace();
    }, SCENE_NAME[scene], DIFF_NAME);

    // ── 阶段 1：UI 导航（标题页 → 剧情模式 → 简单 → 选关 → 跳过漫画/对话/引导 → 进入战斗）──
    const uiT0 = Date.now();
    let inCombat = false, lastUiLog = 0;
    while (Date.now() - uiT0 < UI_TIMEOUT) {
      const r = await page.evaluate(() => {
        const action = window.__driver.ui();
        return { action, state: window.__engine?.state };
      });
      if (r.action && Date.now() - lastUiLog > 300) {
        console.log(`  UI: ${r.action}`);
        lastUiLog = Date.now();
      }
      if (r.state === 'countdown' || r.state === 'playing') { inCombat = true; break; }
      await sleep(400);
    }
    if (!inCombat) {
      // 兜底：打印当前可见按钮，强制引擎开局，防止整个流程卡死
      const dump = await page.evaluate(() => [...document.querySelectorAll('button')]
        .filter(b => b.offsetParent).map(b => (b.textContent || '').trim().slice(0, 20)).slice(0, 20));
      console.log(`  !! UI 导航超时，可见按钮: ${JSON.stringify(dump)}`);
      console.log('  !! 兜底：直接 engine.start 进入本关');
      await page.evaluate((sc, df) => window.__engine.start('story', sc, false, []), scene, DIFF);
    }

    // ── 阶段 2：战斗循环（瞄准/开火/用道具/拾取战后道具）──
    const t0 = Date.now();
    let finalState = null, lastLog = 0;
    while (Date.now() - t0 < LEVEL_TIMEOUT) {
      const s = await page.evaluate(() => window.__driver.tick());
      // 战后奖励道具掉落：用真实鼠标点击拾取
      if (s.state === 'item_drop' && s.item && !s.item.collected) {
        const cx = s.rect.left + s.item.x * s.rect.width / s.w;
        const cy = s.rect.top + s.item.y * s.rect.height / s.h;
        await page.mouse.click(cx, cy);
      }
      if (Date.now() - lastLog > 10_000) {
        console.log(`  ... state=${s.state} wave=${s.wave ?? '-'}${s.ui ? ' ui=' + s.ui : ''} t=${((Date.now() - t0) / 1000).toFixed(0)}s`);
        lastLog = Date.now();
      }
      if (s.state === 'wave_clear' || s.state === 'game_over') { finalState = s.state; break; }
      await sleep(250);
    }
    if (!finalState) {
      console.log(`  !! 战斗超时 ${LEVEL_TIMEOUT / 1000}s，记录为 timeout，尝试返回主菜单继续`);
      results.push({ scene, result: 'timeout' });
    } else {
      const result = finalState === 'wave_clear' ? 'victory' : 'defeat';
      const traceJson = await page.evaluate(() => window.__driver.getTrace());
      if (traceJson) {
        const data = JSON.parse(traceJson);
        data.result = result;
        const file = join(TRACE_DIR, `roach-trace-${scene}-${result}-${Date.now()}.json`);
        writeFileSync(file, JSON.stringify(data));
        const m = metrics(data);
        console.log(`  >> ${result === 'victory' ? '胜利' : '失败'} | 时长 ${m.dur}s | 波次 ${m.waves} | 生成 ${m.spawn} | 火焰输出 ${m.dmg} | 峰值在屏 ${m.peak} | 交战DPS ${m.combatDps.toFixed(1)} | 开火占比 ${(m.duty * 100).toFixed(0)}%`);
        results.push({ scene, result, file, m });
      } else {
        console.log(`  !! 无 trace 数据（${result}）`);
        results.push({ scene, result });
      }
    }

    // ── 阶段 3：结算界面 → 返回主菜单（为下一关做准备）──
    for (let k = 0; k < 40; k++) {
      const st = await page.evaluate(() => window.__engine?.state);
      if (st === 'menu') break;
      await page.evaluate(() => window.__driver.quitToMenu());
      await sleep(500);
    }
    await sleep(500);
  }

  await browser.close();
  console.log('\n[auto-test] 11 关流程结束，生成报告...');
  generateReport(results.filter(r => r.m));
}

// ---------- 报告生成 ----------
function generateReport(sessions) {
  const stats = SCENES.map(sc => sessions.find(s => s.scene === sc)).filter(Boolean).map(s => s.m);
  if (stats.length === 0) { console.log('无有效数据，报告跳过'); return; }

  console.log('\n关卡   | 结果 | 时长  | 生成总量 | 火焰输出 | 输出/生成 | 峰值在屏 | 交战DPS | 开火占比 | 非火焰掉血');
  for (const m of stats) {
    const ratio = m.spawn > 0 ? (m.dmg / m.spawn) : 0;
    console.log(
      `${m.name.padEnd(4)} | ${m.result === 'victory' ? '胜' : '败'}   | ${String(m.dur).padStart(5)}s | ${String(m.spawn).padStart(8)} | ${String(m.dmg).padStart(8)} | ${ratio.toFixed(2).padStart(7)} | ${String(m.peak).padStart(8)} | ${m.combatDps.toFixed(1).padStart(7)} | ${(m.duty * 100).toFixed(0).padStart(6)}% | ${m.breach.toFixed(0)}`
    );
  }

  const esc = s => JSON.stringify(s).replace(/</g, '\\u003c');
  const DATA = stats.map(m => ({
    scene: m.scene, name: m.name, result: m.result, dur: m.dur, waves: m.waves,
    spawn: m.spawn, dmg: m.dmg, peak: m.peak, cbt: +m.combatDps.toFixed(1),
    duty: +m.duty.toFixed(2), breach: Math.round(m.breach), samples: m.samples,
  }));

  const rows = DATA.map(d => {
    const ratio = d.spawn > 0 ? d.dmg / d.spawn : 0;
    const cls = d.result !== 'victory' ? 'bad' : ratio >= 1 ? 'good' : ratio >= 0.7 ? 'warn' : 'bad';
    return `<tr>
      <td>${d.name}</td><td class="${d.result === 'victory' ? 'good' : 'bad'}">${d.result === 'victory' ? '胜利' : '失败'}</td>
      <td>${d.dur}s</td><td>${d.waves}</td><td>${d.spawn.toLocaleString()}</td><td>${d.dmg.toLocaleString()}</td>
      <td class="${cls}">${ratio.toFixed(2)}</td><td>${d.peak}</td><td>${d.cbt}</td><td>${(d.duty * 100).toFixed(0)}%</td><td>${d.breach}</td>
    </tr>`;
  }).join('');

  const sceneCards = DATA.map((d, i) => `
  <div class="card">
    <h2>${i + 1}. ${d.name}（${d.scene}）· ${d.result === 'victory' ? '胜利' : '失败'} · ${d.dur}s · ${d.waves} 波</h2>
    <canvas id="sv${i}" width="940" height="260"></canvas>
  </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>喷火枪伤害 vs 关卡难度 · 自测研究报告</title>
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
  th, td { border:1px solid #262b38; padding:6px; text-align:center; white-space:nowrap; }
  th { background:#1c2230; color:#fbbf24; }
  td:first-child { color:#9ca3af; }
  .good { color:#4ade80; font-weight:700; }
  .warn { color:#fbbf24; font-weight:700; }
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
  <h1>喷火枪伤害 vs 关卡难度 · 自测研究报告</h1>
  <p class="sub">auto-test.mjs 全真 UI 流程自动生成｜难度 ${DIFF}｜干净存档（无天赋）+ 自动使用掉落道具｜0.5s 采样｜${new Date().toLocaleString('zh-CN')}</p>

  <div class="card">
    <h2>一、11 关汇总表</h2>
    <table>
      <tr><th>关卡</th><th>结果</th><th>时长</th><th>波次</th><th>生成总量</th><th>火焰输出</th><th>输出/生成</th><th>峰值在屏</th><th>交战DPS</th><th>开火占比</th><th>非火焰掉血</th></tr>
      ${rows}
    </table>
    <div class="note">
      <b>生成总量</b> = 全关怪物 HP+护甲 流入（关卡难度）；<b>火焰输出</b> = 喷火枪实际造成的总伤害；<b>输出/生成</b> ≥1 表示火枪独自即可清场（绿），0.7~1 表示需道具/突破兜底（黄），&lt;0.7 表示明显火力不足（红）；<b>交战DPS</b> = 在屏有怪时段的火焰输出速率；<b>非火焰掉血</b> ≈ 突破防线/道具伤害。
    </div>
  </div>

  <div class="card">
    <h2>二、难度曲线 vs 喷火枪输出曲线</h2>
    <div class="legend">
      <span><span class="dot" style="background:#e5e7eb"></span>生成总量（难度）</span>
      <span><span class="dot" style="background:#4ade80"></span>火焰总输出</span>
      <span><span class="dot" style="background:#f87171"></span>峰值在屏（压力）</span>
    </div>
    <canvas id="curve" width="940" height="320"></canvas>
    <div class="note">横轴为关卡顺序（厨房→巢穴）。火焰输出曲线贴合生成总量曲线 = 火枪数值与关卡难度匹配；输出明显低于生成 = 该关火力不足需依赖道具。</div>
  </div>

  <div class="card">
    <h2>三、交战 DPS 曲线（火枪真实命中水平）</h2>
    <canvas id="dps" width="940" height="260"></canvas>
    <div class="note">交战 DPS 越平稳，说明火枪手感越一致；陡降的关卡即数值断点。</div>
  </div>

  <div class="card">
    <h2>四、逐关时序（在屏压力 vs 累计输出）</h2>
    <div class="legend">
      <span><span class="dot" style="background:#f87171"></span>在屏血量+护甲（红面积）</span>
      <span><span class="dot" style="background:#4ade80"></span>火焰累计输出</span>
      <span><span class="dot" style="background:#d1d5db"></span>生成累计（虚线）</span>
    </div>
    ${sceneCards}
  </div>

  <div class="card">
    <h2>五、自动结论</h2>
    <div class="concl" id="concl"></div>
  </div>
</div>
<script>
const DATA = ${esc(DATA)};

function drawCurve() {
  const cv = document.getElementById('curve'), ctx = cv.getContext('2d');
  const W = 940, H = 320, padL = 60, padR = 16, padT = 20, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  let yMax = 10;
  for (const d of DATA) yMax = Math.max(yMax, d.spawn, d.dmg, d.peak);
  yMax *= 1.1;
  const X = i => padL + (i / (DATA.length - 1)) * plotW;
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
  DATA.forEach((d, i) => { ctx.fillStyle = '#9ca3af'; ctx.fillText(d.name, X(i), H - 14); });
  const line = (f, color, dash, width) => {
    ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    DATA.forEach((d, i) => i ? ctx.lineTo(X(i), Y(f(d))) : ctx.moveTo(X(i), Y(f(d))));
    ctx.stroke(); ctx.setLineDash([]);
    DATA.forEach((d, i) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(i), Y(f(d)), 3, 0, 7); ctx.fill(); });
  };
  line(d => d.spawn, '#e5e7eb', [], 2);
  line(d => d.dmg, '#4ade80', [], 2.2);
  line(d => d.peak, '#f87171', [5, 4], 1.5);
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.strokeRect(padL, padT, plotW, plotH);
}

function drawDps() {
  const cv = document.getElementById('dps'), ctx = cv.getContext('2d');
  const W = 940, H = 260, padL = 50, padR = 16, padT = 20, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  let yMax = 10;
  for (const d of DATA) yMax = Math.max(yMax, d.cbt);
  yMax *= 1.15;
  const X = i => padL + (i / (DATA.length - 1)) * plotW;
  const Y = v => padT + plotH - (v / yMax) * plotH;
  ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#262b38'; ctx.lineWidth = 1;
  const step = Math.ceil(yMax / 4 / 10) * 10;
  for (let g = 0; g <= yMax; g += step) {
    const y = Y(g);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'right'; ctx.fillText(String(g), padL - 6, y);
  }
  ctx.textAlign = 'center';
  DATA.forEach((d, i) => { ctx.fillStyle = '#9ca3af'; ctx.fillText(d.name, X(i), H - 14); });
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.2; ctx.beginPath();
  DATA.forEach((d, i) => i ? ctx.lineTo(X(i), Y(d.cbt)) : ctx.moveTo(X(i), Y(d.cbt)));
  ctx.stroke();
  DATA.forEach((d, i) => {
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(X(i), Y(d.cbt), 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#e5e7eb'; ctx.fillText(String(d.cbt), X(i), Y(d.cbt) - 12);
  });
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.strokeRect(padL, padT, plotW, plotH);
}

DATA.forEach((d, idx) => {
  const cv = document.getElementById('sv' + idx);
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = 940, H = 260, padL = 58, padR = 14, padT = 18, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const tMax = d.dur;
  let yMax = 10;
  for (const q of d.samples) yMax = Math.max(yMax, q.hp + q.armor, q.flameDmg, q.spawnHp);
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
  const arr = d.samples;
  ctx.setLineDash([5, 4]); ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1.2; ctx.beginPath();
  arr.forEach((q, i) => i ? ctx.lineTo(X(q.t), Y(q.spawnHp)) : ctx.moveTo(X(q.t), Y(q.spawnHp)));
  ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(X(arr[0].t), Y(0));
  arr.forEach(q => ctx.lineTo(X(q.t), Y(q.hp + q.armor)));
  ctx.lineTo(X(arr[arr.length - 1].t), Y(0)); ctx.closePath();
  ctx.fillStyle = 'rgba(248,113,113,0.22)'; ctx.fill();
  ctx.beginPath(); arr.forEach((q, i) => i ? ctx.lineTo(X(q.t), Y(q.hp + q.armor)) : ctx.moveTo(X(q.t), Y(q.hp + q.armor)));
  ctx.strokeStyle = '#f87171'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); arr.forEach((q, i) => i ? ctx.lineTo(X(q.t), Y(q.flameDmg)) : ctx.moveTo(X(q.t), Y(q.flameDmg)));
  ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.strokeRect(padL, padT, plotW, plotH);
});

const fails = DATA.filter(d => d.result !== 'victory');
const weak = DATA.filter(d => d.result === 'victory' && d.spawn > 0 && d.dmg / d.spawn < 0.7);
const tight = DATA.filter(d => d.result === 'victory' && d.spawn > 0 && d.dmg / d.spawn >= 0.7 && d.dmg / d.spawn < 1);
const cbts = DATA.map(d => d.cbt);
const cbtMin = Math.min(...cbts), cbtMax = Math.max(...cbts);
const minDpsLv = DATA[cbts.indexOf(cbtMin)], maxDpsLv = DATA[cbts.indexOf(cbtMax)];
let html = '';
if (fails.length) html += '<li><b>未能通关</b>：' + fails.map(d => d.name).join('、') + ' —— 纯火枪数值不足，建议下调生成量或上调火枪 DPS。</li>';
if (weak.length) html += '<li><b>火力明显不足（输出/生成 &lt; 0.7）</b>：' + weak.map(d => d.name + '(' + (d.dmg / d.spawn).toFixed(2) + ')').join('、') + ' —— 依赖道具/突破兜底。</li>';
if (tight.length) html += '<li><b>火力偏紧（0.7~1.0）</b>：' + tight.map(d => d.name + '(' + (d.dmg / d.spawn).toFixed(2) + ')').join('、') + '。</li>';
html += '<li><b>交战 DPS 区间</b>：' + cbtMin + '（' + minDpsLv.name + '）~ ' + cbtMax + '（' + maxDpsLv.name + '），跨度 ' + (cbtMax / Math.max(1, cbtMin)).toFixed(1) + ' 倍。跨度越小手感越一致；' + minDpsLv.name + ' 为当前数值断点，优先检查。</li>';
html += '<li><b>曲线形态</b>：见第二节，火焰输出曲线若全程 ≥ 生成总量曲线则数值富裕；被难度曲线反超的关卡即需要调整的节点。</li>';
document.getElementById('concl').innerHTML = html;

drawCurve();
drawDps();
</script>
</body>
</html>`;

  writeFileSync(fileURLToPath(new URL('./auto-report.html', import.meta.url)), html, 'utf8');
  console.log('[auto-test] auto-report.html 已生成（' + stats.length + ' 关数据）');
}

main().catch(e => { console.error('[auto-test] 失败:', e.message); process.exit(1); });
