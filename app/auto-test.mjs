// =============================================================================
// 关卡数值自测脚本（全真 UI 点击流程版）— 已合并 auto-report.mjs
// 用法:
//   node auto-test.mjs                      → 全真 UI 测试（可见浏览器窗口）
//   node auto-test.mjs --headless           → 全真 UI 测试（无头浏览器，不显示窗口）
//   node auto-test.mjs --headless hard      → 困难难度 + 无头测试
//   node auto-test.mjs --only=kitchen       → 只跑指定关卡（冒烟/单关调试）
//   node auto-test.mjs --report             → 仅从现有 traces 重生成报告（不启动浏览器）
//   node auto-test.mjs --report --no-open   → 生成报告但不自动打开浏览器
//   node auto-test.mjs --clear              → 仅清空 traces 旧数据，不做其他
// 流程: 启动浏览器 → 点击"点击开始"进入 → 剧情模式 → 简单 → 选关
//       → 自动跳过漫画/对话/新手引导 → 战斗中自动瞄准开火、拾取并使用掉落道具
//       → 战后拾取奖励道具/跳过揭示 → 结算界面返回主菜单 → 选下一关循环
//       → 11 关完成后生成研究报告并自动打开
// 产出: traces/*.json + auto-report.html + 控制台汇总
// =============================================================================
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const ARGS = process.argv.slice(2);
const DIFF = ARGS.includes('hard') ? 'hard' : 'easy';
const DIFF_NAME = DIFF === 'hard' ? '困难' : '简单';
// --headless：无头浏览器（关闭可见窗口）；不加则显示浏览器窗口便于观察
const HEADLESS = ARGS.includes('--headless');
// --only=kitchen 只跑指定关卡（冒烟测试/单关调试用）
const ONLY = (ARGS.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
// --report：仅重生成报告（读取 traces 最新数据，不启动浏览器测试）
const REPORT_ONLY = ARGS.includes('--report');
// --no-open：生成报告后不自动在浏览器中打开
const NO_OPEN = ARGS.includes('--no-open');
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
const TRACE_DIR = 'D:/CocosGreater/Fire Roach KillerV2.6/app/traces'; // trace JSON 写入目录（D 盘），报告生成时也从这里读取
const REPORT_PATH = fileURLToPath(new URL('./auto-report.html', import.meta.url));
const CONFIG_TOTALS_PATH = fileURLToPath(new URL('./config-totals.json', import.meta.url)); // 每关配置总强度（供 --report 复用）
const LEVEL_TIMEOUT = 480_000;  // 单关战斗超时 8 分钟
const UI_TIMEOUT = 90_000;      // UI 导航超时 90 秒

mkdirSync(TRACE_DIR, { recursive: true });

// 当前喷火枪数值配置（用于报告页面开头展示，需与 src/game/data 中的实际配置保持一致）
// [项目, 当前值, 说明]
const FIRE_INFO = [
  ['火焰总 DPS', '25 / 秒', 'BALANCE_CONFIG.weaponDamage.flamethrower（easy = hard = 25）'],
  ['火焰束 DPS', '18.75 / 秒', '= 25 × 束占比 flamethrowerBeamShare 0.75；近端满伤，远端 ×0.7 衰减'],
  ['火焰粒子区 DPS', '6.25 / 秒', '= 25 × (1 − 0.75)；火区区域持续伤害'],
  ['束有效范围', '125 px', '= 射程 250 × flameRangeRatio 0.5（自喷嘴向上）'],
  ['束宽度', '30 px', 'beamHalfWidth 15（半宽，碰撞检测用）'],
  ['基础火焰射程', '250 px', 'baseFireRange；天赋满级 ×1.4 = 350'],
  ['火区中心 / 半径', '62.5 / 100 px', '范围=射程×0.5=125，中心=喷嘴前范围÷2，半径=范围×0.8'],
  ['火区存活 / 上限', '0.5 s / 25', 'fireZoneMaxLife / fireZoneMaxCount'],
  ['燃气容量', '100 帧', 'baseGasCapacity（喷射帧数）'],
  ['过热阈值', '1800', 'baseOverheatThreshold（累积热量）'],
  ['喷嘴 Y 偏移', '322 px', 'nozzleOffsetY（火焰从喷嘴喷出）'],
];

// ---------- 注入页面侧的驱动器 ----------
// 原则：UI 界面用真实 DOM 点击（button.click()），战斗操作用引擎 API（瞄准/开火/道具放置）
const DRIVER = `
// 拦截带 download 属性的 <a> 点击：游戏的 exportTrace 会自动下载 trace JSON，
// 沙箱会拦截 Chrome 写 Downloads 导致进程终止；trace 已由 Node 侧 writeFileSync 写盘，此下载冗余，屏蔽之。
(() => {
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) return; return orig.call(this); };
})();
window.__driver = {
  targetSceneName: null,
  diffName: '简单',
  itemTimer: 0,
  prepSelected: false, // 战前准备界面是否已完成道具选择（防止重复选择）
  prepClickedList: [], // 战前准备已点击过的道具名（配合 400ms 间隔逐个选中，避免 React 批处理丢选）

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
    // 0. 菜单商店遮罩兜底：若商店打开（有"气罐补给"且无"开始战斗"），先跳过樟叔引导再点"返回"关闭，
    //    防止选关/导航被商店界面卡死（首次进入商店会出现引导遮罩，其文案含"气罐补给"，会干扰商店关闭判断）
    if (this.hasText('气罐补给') && !this.hasText('开始战斗')) {
      if (this.clickText('跳过引导')) return 'shop:tutorial_skip';
      if (this.clickText('下一步')) return 'shop:tutorial_next';
      if (this.clickText('去采购！')) return 'shop:tutorial_done';
      if (this.clickText('返回')) return 'shop:close';
    }
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
    // 5. 战前准备界面：按道具名逐个选中道具，选满 3 个后点"开始战斗"
    //    注意：道具按钮是切换式的；且 React 会在同一事件循环内批处理多次 setSelected，
    //    若同步连点 3 次会因闭包拿到旧 selected 只保留最后一次选择。
    //    故每次 ui() 只点 1 个道具，靠外部 UI 循环的 400ms 间隔让 React 重渲染后再点下一个。
    if (this.hasText('开始战斗')) {
      if (!this.prepSelected) {
        if (!this.prepClickedList) this.prepClickedList = [];
        const ITEM_NAMES = ['蟑螂贴板', '强力风扇', '燃烧瓶', '杀虫喷雾', '散弹模式', '电蚊拍', '雷达激光', '斩螂·110'];
        let clickedOne = false;
        for (const n of ITEM_NAMES) {
          if (this.prepClickedList.includes(n)) continue; // 已点过的道具不再重复点，避免切换取消选中
          if (this.clickText(n)) { this.prepClickedList.push(n); clickedOne = true; break; }
        }
        // 已选满 3 个，或已遍历全部可用道具名无法再点选时，视为准备完成
        if (this.prepClickedList.length >= 3 || (!clickedOne && this.prepClickedList.length > 0)) {
          this.prepSelected = true;
        }
        return 'preparation:select';
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
          // 过热保护：看到过热提示读秒(heatWarningTimer>0)或已过热(isOverheated)时停止开火，
          // 等待冷却读秒完成后 (isOverheated=false 且提示清零) 再恢复开火，避免过热空转/浪费
          if (e.player.isOverheated || e.player.heatWarningTimer > 0) {
            e.player.isFiring = false;
          } else {
            e.player.isFiring = true;
          }
        } else {
          e.player.isFiring = false; // 场上无怪，停火省燃气
        }
        // 自动使用掉落道具：场上有怪且库存非空时，每 ~3 秒用掉第一个（即点即用型直接生效，放置型走上面的放置流程）
        this.itemTimer++;
        if (count >= 2 && e.inventory.length > 0 && this.itemTimer >= 12) {
          this.itemTimer = 0;
          e.selectItem(0);
        }
        // 气罐补给：战斗中燃气低于 20% 时自动使用（需从商店购买带入）
        if (e.player && e.consumableInventory && e.consumableInventory['gas_refill'] > 0 &&
            e.player.gas / e.player.maxGas < 0.20) {
          e.useConsumable('gas_refill');
        }
      }
      return { state: st, wave: e.wave, ui: uiAction, inventory: e.inventory.length };
    }

    if (st === 'item_drop') {
      const it = e.itemDropOnField;
      const rect = e.canvas.getBoundingClientRect();
      return {
        state: st,
        item: it ? {
          x: it.x, y: it.y, falling: it.falling, collected: it.collected,
          bobY: Math.sin(it.bobPhase) * 12, // 上下浮动偏移，拾取点击需叠加修正
        } : null,
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

  // 结算界面上的"道具商店"按钮（打开菜单商店）
  clickShop() {
    return this.clickText('道具商店');
  },

  // 在商店中购买"气罐补给"：定位"气罐补给"所在行，点行内"购买"按钮（钱不够时按钮为"金币不足"且禁用，不会误点）
  buyGasRefill() {
    const rows = [...document.querySelectorAll('div')].filter(el =>
      this.visible(el) &&
      el.textContent.includes('气罐补给') &&
      el.textContent.length < 80 &&
      el.querySelector('button'));
    for (const row of rows) {
      const btn = [...row.querySelectorAll('button')].find(b => b.offsetParent && (b.textContent || '').trim() === '购买');
      if (btn) { btn.click(); return true; }
    }
    return false;
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

  // 从数值配置计算每关怪物总强度（固定/解析曲线，非实测）
  // 口径与 engine.spawnRoach 保持一致：hpMult = 简单1.2 / 困难1.8；女王困难再 ×1.5。
  // 护甲/护盾为生成时固定值；加血/加护甲为"单次施放潜力"估计（依赖运行时目标，故标注为潜力）。
  async computeConfigTotals(diffKey) {
    const data = await import('/src/game/data.ts');
    const ENEMY_DEFS = data.ENEMY_DEFS;
    const SCENE_WAVE_CONFIGS = data.SCENE_WAVE_CONFIGS;
    const BALANCE_CONFIG = data.BALANCE_CONFIG;
    const isHard = diffKey === 'hard';
    const hpMult = isHard ? 1.8 : 1.2;
    const scenes = ['kitchen','sewer','dump','basement','street','rooftop','hospital','subway','supermarket','school','nest'];
    const T = { small:'smallCount', large:'largeCount', flying:'flyingCount', armored:'armoredCount',
      splitting:'splittingCount', suicide:'suicideCount', flying_suicide:'flyingSuicideCount',
      queen:'queenCount', nurse:'nurseCount', mutant:'mutantCount', timed_suicide:'timedSuicideCount',
      tunnel_worker:'tunnelWorkerCount', subway_elite:'eliteCount', shield:'shieldCount' };
    const out = {};
    for (const sc of scenes) {
      const waves = SCENE_WAVE_CONFIGS[sc] || [];
      let hp = 0, armor = 0, shield = 0, heal = 0, armorAdd = 0, maxAllies = 0, alliesHp = 0, allyN = 0;
      for (const w of waves) {
        for (const [type, key] of Object.entries(T)) {
          const cnt = w[key] || 0;
          if (!cnt) continue;
          const defHp = ENEMY_DEFS[type].hp;
          const hpV = Math.floor(defHp * hpMult * (type === 'queen' && isHard ? 1.5 : 1));
          hp += cnt * hpV;
          // 生成时固定护甲
          let arm = 0;
          if (type === 'armored') arm = Math.floor(defHp * hpMult * 1.0);
          else if (type === 'suicide') arm = 2;
          else if (type === 'flying_suicide') arm = 5;
          else if (type === 'nurse' || type === 'timed_suicide') arm = 12;
          else if (type === 'subway_elite') arm = 20;
          armor += cnt * arm;
          // 护盾
          if (type === 'shield') shield += cnt * (BALANCE_CONFIG.subway?.shieldMaxHp || 0);
          // 可被治疗/加护甲的目标池（非自身辅助单位）
          if (type !== 'nurse' && type !== 'tunnel_worker' && type !== 'shield') {
            maxAllies = Math.max(maxAllies, hpV);
            alliesHp += cnt * hpV; allyN += cnt;
          }
        }
      }
      // 加血潜力：护士每跳治疗 healPercent × 目标最大血量，取场景内最高可治目标血量作单次代表
      const nurseN = (waves.reduce((a, w) => a + (w.nurseCount || 0), 0));
      heal = nurseN * (BALANCE_CONFIG.roachAI?.healPercent ?? 0.2) * (maxAllies || 0);
      // 加护甲潜力：隧道工每次喷涂 armorSprayAmount，按隧道工数量 × 单次量作代表
      const twN = (waves.reduce((a, w) => a + (w.tunnelWorkerCount || 0), 0));
      armorAdd = twN * (BALANCE_CONFIG.subway?.armorSprayAmount || 0);
      out[sc] = { hp, armor, shield, heal, armorAdd, total: hp + armor + shield + heal + armorAdd };
    }
    return out;
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
    scene: s.scene, name: NAME[s.scene] || s.scene || 'unknown', result: s.result, dur: s.duration,
    waves: last.wave, spawn: last.spawnHp, dmg: last.flameDmg,
    peak, peakT, peakShield, duty,
    avgDps: last.flameDmg / s.duration,
    firingDps: duty > 0 ? last.flameDmg / (duty * s.duration) : 0,
    combatDps: combatTime > 0 ? combatDmg / combatTime : 0,
    breach, samples: arr,
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 每个场景取最新一个 trace（--report 重生成报告用，不启动浏览器）
function loadSessions() {
  const files = readdirSync(TRACE_DIR).filter(f => f.endsWith('.json'));
  const byScene = {};
  for (const f of files) {
    const m = f.match(/^roach-trace-([a-z]+)-(victory|defeat)-\d+\.json$/);
    if (!m) continue;
    const scene = m[1];
    const p = join(TRACE_DIR, f);
    const data = JSON.parse(readFileSync(p, 'utf8'));
    data.result = m[2];
    data.scene = scene;
    const mt = statSync(p).mtimeMs;
    if (!byScene[scene] || mt > byScene[scene].mt) byScene[scene] = { mt, m: metrics(data) };
  }
  return SCENES.map(sc => byScene[sc]).filter(Boolean).map(x => x.m);
}

// 清空之前的测试数据（删除 TRACE_DIR 中仅属于本测试的 trace 文件），用于新一轮测试前重置
// 注意：TRACE_DIR 为下载目录，只删 roach-trace-*.json，绝不碰其他文件
function clearTraces() {
  const files = readdirSync(TRACE_DIR).filter(f => /^roach-trace-.+\.json$/.test(f));
  for (const f of files) {
    try { unlinkSync(join(TRACE_DIR, f)); } catch {}
  }
  console.log('[auto-test] 已清空之前的测试数据（删除 ' + files.length + ' 个 trace）');
}

// ---------- 主流程（浏览器测试） ----------
async function main() {
  // 每次开始测试前自动重置：清空旧 trace 与配置总强度缓存，保证本次为新数据集
  clearTraces();
  try { if (existsSync(CONFIG_TOTALS_PATH)) unlinkSync(CONFIG_TOTALS_PATH); } catch {}

  // 使用每次运行唯一的 profile 目录，从根本上避免与上次残留的测试浏览器进程冲突
  // （"The browser is already running" 报错的根因）
  const profileDir = join(tmpdir(), 'roach-auto-test-profile-' + Date.now());
  const browser = await puppeteer.launch({
    executablePath: EXE,
    headless: HEADLESS,
    defaultViewport: { width: 560, height: 1000 },
    userDataDir: profileDir, // 独立且唯一的配置目录，避免与用户浏览器/上次运行冲突
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=580,1080', '--disable-features=TranslateUI',
      // 减少 Chrome 写系统日志/崩溃报告/组件更新/GPU缓存（这些写入可能被沙箱拦截导致进程被终止）
      '--disable-logging', '--log-level=3', '--disable-breakpad', '--disable-crash-reporter', '--no-crash-upload',
      '--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check',
      '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.on('pageerror', () => {}); // 忽略页面报错（音频等）

  // 允许浏览器下载文件，下载落地目录统一为 TRACE_DIR（下载目录）
  try {
    const cdp = await page.createCDPSession();
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: TRACE_DIR });
  } catch {}

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

  // 从数值配置计算每关怪物总强度（固定曲线），写盘供 --report 复用
  let cfgTotals = null;
  try {
    cfgTotals = await page.evaluate((diff) => window.__driver.computeConfigTotals(diff), DIFF);
    writeFileSync(CONFIG_TOTALS_PATH, JSON.stringify(cfgTotals));
    console.log('[auto-test] 已从配置计算 11 关怪物总强度曲线（config-totals.json）');
  } catch (e) { console.log('[auto-test] 配置总强度计算失败（忽略）: ' + e.message); }

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
      window.__driver.prepClickedList = []; // 每关重置已点击道具名
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
      // 战后奖励道具掉落：自动拾取（等待落地 + 反复点击直到拾取成功或超时）
      if (s.state === 'item_drop' && s.item) {
        const pickupT0 = Date.now();
        while (Date.now() - pickupT0 < 30_000) {
          const ss = await page.evaluate(() => window.__driver.tick());
          if (ss.state !== 'item_drop' || !ss.item || ss.item.collected) break; // 拾取成功/状态已切换
          if (!ss.item.falling) {
            // 叠加道具上下浮动偏移 bobY，确保点击落在 35px 命中框内
            const cx = ss.rect.left + ss.item.x * ss.rect.width / ss.w;
            const cy = ss.rect.top + (ss.item.y + (ss.item.bobY || 0)) * ss.rect.height / ss.h;
            await page.mouse.click(cx, cy);
          }
          await sleep(250);
        }
        continue; // 引擎拾取后会自动进入 item_reveal，回外层循环继续
      }
      if (Date.now() - lastLog > 10_000) {
        console.log(`  ... state=${s.state} wave=${s.wave ?? '-'}${s.ui ? ' ui=' + s.ui : ''} t=${((Date.now() - t0) / 1000).toFixed(0)}s`);
        lastLog = Date.now();
      }
      if (s.state === 'wave_clear' || s.state === 'game_over') { finalState = s.state; break; }
      await sleep(250);
    }
    let result = finalState ? (finalState === 'wave_clear' ? 'victory' : 'defeat') : 'timeout';
    if (!finalState) {
      console.log(`  !! 战斗超时 ${LEVEL_TIMEOUT / 1000}s，记录为 timeout，尝试返回主菜单继续`);
      results.push({ scene, result });
    } else {
      const traceJson = await page.evaluate(() => window.__driver.getTrace());
      if (traceJson) {
        const data = JSON.parse(traceJson);
        data.result = result;
        data.scene = scene; // trace JSON 无 scene 字段，需显式补充，否则 metrics 的 name 为 undefined 导致 padEnd 报错
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

    // ── 阶段 3：结算界面 → （胜利时进道具商店买气罐补给，点"返回"关闭）→ 点"下一关"进入下一关 ──
    if (result === 'victory') {
      // 3a. 打开结算界面上的"道具商店"
      for (let k = 0; k < 20; k++) {
        const st = await page.evaluate(() => window.__engine?.state);
        if (st === 'menu') break;
        if (await page.evaluate(() => window.__driver.clickShop())) break;
        await sleep(500);
      }
      // 3b. 在商店内购买"气罐补给"（买一次；先跳过樟叔引导；钱不够时按钮为"金币不足"禁用，自动跳过）
      for (let k = 0; k < 15; k++) {
        const inShop = await page.evaluate(() => window.__driver.hasText('气罐补给'));
        if (!inShop) {
          if (await page.evaluate(() => window.__driver.clickShop())) { await sleep(400); continue; }
          break;
        }
        const bought = await page.evaluate(() => window.__driver.buyGasRefill());
        console.log(bought ? '  商店：已购买 气罐补给' : '  商店：气罐补给购买失败/钱不足，跳过');
        break;
      }
      // 3c. 关闭商店：先跳过商店引导（其文案含"气罐补给"会干扰关闭判断），再点"返回"回到结算界面
      for (let k = 0; k < 10; k++) {
        const st = await page.evaluate(() => window.__engine?.state);
        if (st === 'menu') break;
        if (!await page.evaluate(() => window.__driver.hasText('气罐补给'))) break; // 商店已关闭
        await page.evaluate(() => window.__driver.clickText('跳过引导'));
        await page.evaluate(() => window.__driver.clickText('返回'));
        await sleep(500);
      }
    }
    // 3d. 结算界面 → 点"下一关"直接进入下一场景；若无"下一关"按钮（最后一关巢穴）则返回主菜单
    if (await page.evaluate(() => window.__driver.clickText('下一关'))) {
      console.log('  下一关：点击"下一关"进入下一场景');
      // 等待离开结算界面（可能先播漫画/对话，由下一关的 UI 导航阶段处理跳过）
      for (let k = 0; k < 30; k++) {
        const st = await page.evaluate(() => window.__engine?.state);
        if (st !== 'wave_clear' && st !== 'game_over') break;
        await sleep(500);
      }
    } else {
      // 最后一关（巢穴）没有"下一关"，返回主菜单
      for (let k = 0; k < 40; k++) {
        const st = await page.evaluate(() => window.__engine?.state);
        if (st === 'menu') break;
        await page.evaluate(() => window.__driver.quitToMenu());
        await sleep(500);
      }
    }
    await sleep(500);
  }

  await browser.close();
  console.log('\n[auto-test] 11 关流程结束，生成报告...');
  generateReport(results.filter(r => r.m), !NO_OPEN, cfgTotals);
}

// ---------- 报告生成 ----------
function generateReport(sessions, open = true, cfgTotals = null) {
  const stats = sessions;
  if (stats.length === 0) { console.log('无有效数据，报告跳过'); return; }
  // 兜底：主流程未传入时尝试从 config-totals.json 读取（供 --report 复用）
  if (!cfgTotals && existsSync(CONFIG_TOTALS_PATH)) {
    try { cfgTotals = JSON.parse(readFileSync(CONFIG_TOTALS_PATH, 'utf8')); } catch {}
  }

  console.log('\n关卡   | 结果 | 时长  | 生成总量 | 火焰输出 | 输出/生成 | 输出-生成差 | 平均DPS | 峰值在屏 | 交战DPS | 开火占比 | 非火焰掉血');
  const num = (x) => Number.isFinite(Number(x)) ? Number(x) : 0;
  const sname = (m) => String(m.name || m.scene || '?');
  for (const m of stats) {
    const spawn = num(m.spawn), dmg = num(m.dmg);
    const ratio = spawn > 0 ? (dmg / spawn) : 0;
    const diff = Math.round(dmg - spawn);
    console.log(
      `${sname(m).padEnd(4)} | ${m.result === 'victory' ? '胜' : '败'}   | ${String(num(m.dur)).padStart(5)}s | ${String(spawn).padStart(8)} | ${String(dmg).padStart(8)} | ${ratio.toFixed(2).padStart(7)} | ${String(diff > 0 ? '+' + diff : diff).padStart(9)} | ${num(m.avgDps).toFixed(1).padStart(6)} | ${String(num(m.peak)).padStart(8)} | ${num(m.combatDps).toFixed(1).padStart(7)} | ${(num(m.duty) * 100).toFixed(0).padStart(6)}% | ${num(m.breach).toFixed(0)}`
    );
  }

  const esc = s => JSON.stringify(s).replace(/</g, '\\u003c');
  const DATA = stats.map(m => {
    const cfg = cfgTotals?.[m.scene] || null;
    return {
      scene: m.scene, name: m.name, result: m.result, dur: m.dur, waves: m.waves,
      spawn: num(m.spawn), dmg: num(m.dmg), diff: Math.round(num(m.dmg) - num(m.spawn)), avgDps: +num(m.avgDps).toFixed(1),
      peak: num(m.peak), cbt: +num(m.combatDps).toFixed(1),
      duty: +num(m.duty).toFixed(2), breach: Math.round(num(m.breach)), samples: m.samples,
      cfg, // 配置总强度：{hp,armor,shield,heal,armorAdd,total}
    };
  });

  const rows = DATA.map(d => {
    const ratio = d.spawn > 0 ? d.dmg / d.spawn : 0;
    const cls = d.result !== 'victory' ? 'bad' : ratio >= 1 ? 'good' : ratio >= 0.7 ? 'warn' : 'bad';
    const diffCls = d.diff >= 0 ? 'good' : d.diff >= -d.spawn * 0.3 ? 'warn' : 'bad';
    return `<tr>
      <td>${d.name}</td><td class="${d.result === 'victory' ? 'good' : 'bad'}">${d.result === 'victory' ? '胜利' : '失败'}</td>
      <td>${d.dur}s</td><td>${d.waves}</td><td>${d.spawn.toLocaleString()}</td><td>${d.dmg.toLocaleString()}</td>
      <td class="${cls}">${ratio.toFixed(2)}</td><td class="${diffCls}">${d.diff > 0 ? '+' : ''}${d.diff.toLocaleString()}</td><td>${d.avgDps}</td><td>${d.peak}</td><td>${d.cbt}</td><td>${(d.duty * 100).toFixed(0)}%</td><td>${d.breach}</td>
    </tr>`;
  }).join('');

  const sceneCards = DATA.map((d, i) => `
  <div class="card">
    <h2>${i + 1}. ${d.name}（${d.scene}）· ${d.result === 'victory' ? '胜利' : '失败'} · ${d.dur}s · ${d.waves} 波</h2>
    <canvas id="sv${i}" width="940" height="260"></canvas>
  </div>`).join('');

  // 每关配置总强度明细表（血量/护甲/护盾/加血/加护甲/合计）
  const hasCfg = DATA.some(d => d.cfg && d.cfg.total != null);
  const configRows = hasCfg ? DATA.map(d => {
    const c = d.cfg || {};
    return `<tr><td>${d.name}</td><td>${(c.hp || 0).toLocaleString()}</td><td>${(c.armor || 0).toLocaleString()}</td><td>${(c.shield || 0).toLocaleString()}</td><td>${(c.heal || 0).toLocaleString()}</td><td>${(c.armorAdd || 0).toLocaleString()}</td><td class="good">${(c.total || 0).toLocaleString()}</td></tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center;color:#9ca3af">无配置总强度数据（需先跑全量测试以生成 config-totals.json）</td></tr>';

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
    <h2>当前喷火枪数值配置（难度 ${DIFF} · 干净存档无天赋）</h2>
    <table>
      <tr><th style="width:160px">项目</th><th style="width:130px">当前值</th><th>说明</th></tr>
      ${FIRE_INFO.map(([k, v, d]) => `<tr><td>${k}</td><td class="good">${v}</td><td style="text-align:left;color:#9ca3af">${d}</td></tr>`).join('')}
    </table>
  </div>

  <div class="card">
    <h2>一、11 关汇总表</h2>
    <table>
      <tr><th>关卡</th><th>结果</th><th>时长</th><th>波次</th><th>生成总量</th><th>火焰输出</th><th>输出/生成</th><th>输出-生成差</th><th>平均DPS</th><th>峰值在屏</th><th>交战DPS</th><th>开火占比</th><th>非火焰掉血</th></tr>
      ${rows}
    </table>
    <div class="note">
      <b>生成总量</b> = 全关怪物 HP+护甲 流入（关卡难度）；<b>火焰输出</b> = 喷火枪实际造成的总伤害；<b>输出/生成</b> ≥1 表示火枪独自即可清场（绿），0.7~1 表示需道具/突破兜底（黄），&lt;0.7 表示明显火力不足（红）；<b>输出-生成差</b> = 火焰输出 − 生成总量（正值=火力盈余，负值=火力缺口）；<b>平均DPS</b> = 火焰输出 / 总时长（含清场空档的整体水平）；<b>交战DPS</b> = 在屏有怪时段的火焰输出速率；<b>非火焰掉血</b> ≈ 突破防线/道具伤害。
    </div>
  </div>

  <div class="card">
    <h2>二、配置难度曲线 vs 喷火枪 DPS（同图）</h2>
    <div class="legend">
      <span><span class="dot" style="background:#4ade80"></span>怪物总强度（读取数值配置：HP+护甲+护盾+加血+加护甲）</span>
      <span><span class="dot" style="background:#fbbf24"></span>喷火枪 DPS（实测交战 DPS，右轴）</span>
    </div>
    <canvas id="cfgdps" width="940" height="320"></canvas>
    <table style="margin-top:10px">
      <tr><th>关卡</th><th>血量</th><th>护甲</th><th>护盾</th><th>加血</th><th>加护甲</th><th>总强度</th></tr>
      ${configRows}
    </table>
    <div class="note">横轴为关卡顺序（厨房→巢穴）。<b>怪物总强度曲线</b>由数值配置解析计算（口径同 spawnRoach：血量×难度系数，护甲/护盾取生成固定值）；<b>加血/加护甲</b>为"单次施放潜力"估计（护士 healPercent×最高目标血、隧道工 armorSprayAmount×数量），非全关累计。绿色曲线代表关卡"设计难度"，黄色曲线为火枪实际 DPS；两线同图便于判断火力与难度匹配，绿色远高于黄色处即火力不足节点。</div>
  </div>

  <div class="card">
    <h2>三、难度曲线 vs 喷火枪输出曲线</h2>
    <div class="legend">
      <span><span class="dot" style="background:#e5e7eb"></span>生成总量（难度）</span>
      <span><span class="dot" style="background:#4ade80"></span>火焰总输出</span>
      <span><span class="dot" style="background:#f87171"></span>峰值在屏（压力）</span>
    </div>
    <canvas id="curve" width="940" height="320"></canvas>
    <div class="note">横轴为关卡顺序（厨房→巢穴）。火焰输出曲线贴合生成总量曲线 = 火枪数值与关卡难度匹配；输出明显低于生成 = 该关火力不足需依赖道具。</div>
  </div>

  <div class="card">
    <h2>四、交战 DPS 曲线（火枪真实命中水平）</h2>
    <canvas id="dps" width="940" height="260"></canvas>
    <div class="note">交战 DPS 越平稳，说明火枪手感越一致；陡降的关卡即数值断点。</div>
  </div>

  <div class="card">
    <h2>五、逐关时序（在屏压力 vs 累计输出）</h2>
    <div class="legend">
      <span><span class="dot" style="background:#f87171"></span>在屏血量+护甲（红面积）</span>
      <span><span class="dot" style="background:#4ade80"></span>火焰累计输出</span>
      <span><span class="dot" style="background:#d1d5db"></span>生成累计（虚线）</span>
    </div>
    ${sceneCards}
  </div>

  <div class="card">
    <h2>六、自动结论</h2>
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

// 配置难度曲线 vs 喷火枪 DPS（双轴同图）：左轴=怪物总强度(配置)，右轴=交战 DPS
function drawCfgDps() {
  const cv = document.getElementById('cfgdps'), ctx = cv.getContext('2d');
  if (!cv) return;
  const W = 940, H = 320, padL = 64, padR = 56, padT = 20, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  let yMaxC = 10, yMaxD = 1;
  for (const d of DATA) {
    if (d.cfg && d.cfg.total != null) yMaxC = Math.max(yMaxC, d.cfg.total);
    yMaxD = Math.max(yMaxD, d.cbt);
  }
  yMaxC *= 1.12; yMaxD *= 1.15;
  const X = i => padL + (i / (DATA.length - 1)) * plotW;
  const Yc = v => padT + plotH - (v / yMaxC) * plotH;
  const Yd = v => padT + plotH - (v / yMaxD) * plotH;
  ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#262b38'; ctx.lineWidth = 1;
  const step = yMaxC > 8000 ? 2000 : yMaxC > 3000 ? 1000 : 500;
  for (let g = 0; g <= yMaxC; g += step) {
    const y = Yc(g);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'right'; ctx.fillText(g.toLocaleString(), padL - 6, y);
  }
  // 右轴（DPS）刻度
  const dstep = Math.max(1, Math.ceil(yMaxD / 5 / 10) * 10);
  ctx.textAlign = 'left';
  for (let g = 0; g <= yMaxD; g += dstep) {
    ctx.fillStyle = '#fbbf24'; ctx.fillText(String(Math.round(g)), W - padR + 6, Yd(g));
  }
  ctx.textAlign = 'center';
  DATA.forEach((d, i) => { ctx.fillStyle = '#9ca3af'; ctx.fillText(d.name, X(i), H - 14); });
  const line = (f, color, width) => {
    ctx.setLineDash([]); ctx.strokeStyle = color; ctx.lineWidth = width;
    let drawing = false;
    ctx.beginPath();
    DATA.forEach((d, i) => {
      const v = f(d);
      if (v == null) { drawing = false; return; }
      if (!drawing) { ctx.moveTo(X(i), v); drawing = true; }
      else ctx.lineTo(X(i), v);
    });
    ctx.stroke();
    DATA.forEach((d, i) => {
      const v = f(d);
      if (v == null) return;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(i), v, 3, 0, 7); ctx.fill();
    });
  };
  line(d => d.cfg && d.cfg.total != null ? Yc(d.cfg.total) : null, '#4ade80', 2.2);
  line(d => Yd(d.cbt), '#fbbf24', 2.2);
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
const totalDiff = DATA.reduce((a, d) => a + d.diff, 0);
const defScenes = DATA.filter(d => d.diff < 0).sort((a, b) => a.diff - b.diff);
const surScenes = DATA.filter(d => d.diff > 0).sort((a, b) => b.diff - a.diff);
const avgArr = DATA.map(d => d.avgDps);
const avgMin = Math.min(...avgArr), avgMax = Math.max(...avgArr);
const avgMinLv = DATA[avgArr.indexOf(avgMin)], avgMaxLv = DATA[avgArr.indexOf(avgMax)];
let html = '';
if (fails.length) html += '<li><b>未能通关</b>：' + fails.map(d => d.name).join('、') + ' —— 纯火枪数值不足，建议下调生成量或上调火枪 DPS。</li>';
if (weak.length) html += '<li><b>火力明显不足（输出/生成 &lt; 0.7）</b>：' + weak.map(d => d.name + '(' + (d.dmg / d.spawn).toFixed(2) + ')').join('、') + ' —— 依赖道具/突破兜底。</li>';
if (tight.length) html += '<li><b>火力偏紧（0.7~1.0）</b>：' + tight.map(d => d.name + '(' + (d.dmg / d.spawn).toFixed(2) + ')').join('、') + '。</li>';
html += '<li><b>输出-生成差（11 关累计）</b>：' + (totalDiff >= 0 ? '+' : '') + totalDiff.toLocaleString() + '。';
if (defScenes.length) html += '火力缺口最大：' + defScenes.slice(0, 3).map(d => d.name + '(' + d.diff.toLocaleString() + ')').join('、') + '。';
if (surScenes.length) html += '火力盈余最大：' + surScenes.slice(0, 3).map(d => d.name + '(+' + d.diff.toLocaleString() + ')').join('、') + '。';
html += '</li>';
html += '<li><b>交战 DPS 区间</b>：' + cbtMin + '（' + minDpsLv.name + '）~ ' + cbtMax + '（' + maxDpsLv.name + '），跨度 ' + (cbtMax / Math.max(1, cbtMin)).toFixed(1) + ' 倍。跨度越小手感越一致；' + minDpsLv.name + ' 为当前数值断点，优先检查。</li>';
html += '<li><b>平均DPS 区间</b>：' + avgMin + '（' + avgMinLv.name + '）~ ' + avgMax + '（' + avgMaxLv.name + '），反映含清场空档的整体输出水平，越低说明空转/射程不足越明显。</li>';
html += '<li><b>曲线形态</b>：见第三节，火焰输出曲线若全程 ≥ 生成总量曲线则数值富裕；被难度曲线反超的关卡即需要调整的节点。</li>';
document.getElementById('concl').innerHTML = html;

drawCfgDps();
drawCurve();
drawDps();
</script>
</body>
</html>`;

  writeFileSync(REPORT_PATH, html, 'utf8');
  console.log('[auto-test] auto-report.html 已生成（' + stats.length + ' 关数据）');

  if (open) {
    exec(`start "" "${REPORT_PATH}"`, (err) => {
      if (err) console.log('[auto-test] 自动打开浏览器失败：' + err.message);
      else console.log('[auto-test] 已在浏览器中打开：' + REPORT_PATH);
    });
  }
}

// ---------- 入口路由 ----------
if (ARGS.includes('--clear')) {
  clearTraces();
  process.exit(0);
}

if (REPORT_ONLY) {
  const sessions = loadSessions();
  console.log('已加载最新 trace：' + sessions.map(s => s.scene).join(', '));
  let cfgTotals = null;
  if (existsSync(CONFIG_TOTALS_PATH)) {
    try { cfgTotals = JSON.parse(readFileSync(CONFIG_TOTALS_PATH, 'utf8')); } catch {}
  }
  generateReport(sessions, !NO_OPEN, cfgTotals);
  process.exit(0);
}

main().catch(e => { console.error('[auto-test] 失败:', e.message); process.exit(1); });
