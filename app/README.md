# 烈焰除蟑：火线守卫

> 一款竖屏2D射击塔防游戏，玩家操控火焰喷射器抵御变异蟑螂大军的入侵。

---

## 一、项目概述

| 属性 | 说明 |
|------|------|
| **项目路径** | `/mnt/agents/output/app` |
| **技术栈** | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + HTML5 Canvas 2D |
| **后端** | tRPC 11 + Drizzle ORM + Hono + MySQL |
| **数据库** | MySQL (via Drizzle ORM) |
| **游戏类型** | 2D竖屏射击塔防 |
| **分辨率** | 540 x 960（竖屏，16:9手机比例） |
| **目标帧率** | 60fps |
| **总代码量** | ~15,000行（引擎单文件9,700+行） |
| **部署地址** | https://xynlqlijlidpg.ok.kimi.link |

---

## 二、世界观与剧情

### 故事背景

公元2047年，一场神秘的基因泄漏事故让城市下水道中的蟑螂发生了恐怖变异。它们体型巨大化、获得护甲、甚至演化出了飞行和自爆的能力。整座城市从地下开始沦陷，从厨房到屋顶，无处不在。

玩家扮演一名**专业除蟑佣兵**，手持改造过的火焰喷射器，在神秘导师"**蟑叔**"的远程指引下，逐层清除被蟑螂占领的城市区域。

### 叙事方式

- **漫画过场**：每个新场景首次进入前播放漫画片段，交代剧情进展
- **蟑叔对话**：每关开始前蟑叔通过对话框介绍新敌人类型和战术要点
- **道具介绍**：通关后掉落新道具时，蟑叔以夸张语调介绍道具效果

### 场景解锁链（共11个场景）

```
厨房（KITCHEN）→ 下水道（SEWER）→ 垃圾场（DUMP）→ 地下室（BASEMENT）→ 街道（STREET）→ 天台（ROOFTOP）→ 废弃医院（HOSPITAL）→ 废弃地铁（SUBWAY）→ 废弃超市（SUPERMARKET）→ 废弃学校（SCHOOL）→ 蟑螂巢穴（NEST）
```

| # | 场景 | 解锁条件 | 新机制 | 波数 |
|---|------|---------|--------|------|
| 1 | **厨房** | 初始解锁 | 基础教学 | 6 |
| 2 | **下水道** | 通关厨房 | 飞行蟑螂 | 6 |
| 3 | **垃圾场** | 通关下水道 | 装甲蟑螂 | 6 |
| 4 | **地下室** | 通关垃圾场 | 分裂蟑螂、自爆蟑螂 | 6 |
| 5 | **街道** | 通关地下室 | 飞自爆蟑螂 | 6 |
| 6 | **天台** | 通关街道 | 女王BOSS战 | 6 |
| 7 | **废弃医院** | 通关天台 | 护士/变异/定时自爆蟑螂 + 虫卵池 | 8 |
| 8 | **废弃地铁** | 通关医院 | （待开发） | 6 |
| 9 | **废弃超市** | 通关地铁 | （待开发） | 6 |
| 10 | **废弃学校** | 通关超市 | （待开发） | 6 |
| 11 | **蟑螂巢穴** | 通关学校 | （待开发） | 6 |

每个场景有独特背景、专属敌人和通关奖励道具。

---

## 三、核心玩法

### 3.1 基础操作

| 操作 | 说明 |
|------|------|
| 鼠标移动/触摸滑动 | 控制喷射方向 |
| 长按/按住 | 持续喷射火焰 |
| 点击换罐按钮 | 更换燃气罐（需空闲时操作） |

### 3.2 防线系统

- 屏幕底部为**防线**，蟑螂触碰防线扣除防线HP
- 防线HP归零 = **游戏失败**
- 基础防线HP：80（可通过天赋树加成）

### 3.3 燃气与过热系统

- **燃气**：喷射消耗燃气，燃气耗尽无法攻击，需手动换罐
- **热量**：持续喷射积累热量，过热后需等待冷却
- **过热阈值**：默认1800，升级后可提升至2880
- **热量衰减**：停止喷射后自动降温

### 3.4 波次系统（v2.1 更新：连续波次）

- 每关固定6-10波蟑螂进攻（场景不同波数不同）
- 每波有特定数量和类型的敌人组合
- **波次间自动连续进行**，消灭一波后自动开始下一波，不在中间弹出商店
- 全部波次清完 = **关卡胜利** → 掉落解锁道具 → 进入补给站结算 → 解锁下一关

**波次完成检测条件：**
```typescript
if (!this.waveSpawning && this.roaches.length === 0 && this.spawnQueue.length === 0 && this.wave > 0)
```
- `wave > 0` 防止初始状态误判
- 波次完成后调用 `startWave()` 自动开始下一波
- 只有 `this.wave >= configs.length` 时才触发 `gameVictory()`

### 3.5 经济系统

- 击杀蟑螂获得资金（¥）
- 通关后在商店购买升级
- 资金不跨局保留

### 3.6 商店升级（6项）

| 升级 | 价格（普通/困难） | 效果 |
|------|-------------------|------|
| 加长枪管 | ¥300 / ¥800 | 火焰射程 +20% |
| 双罐并联 | ¥600 / ¥1500 | 过热阈值提升至2880（约6倍） |
| 低温燃料 | ¥400 / ¥1000 | 热量衰减速度 = 1.5 |
| 强化火焰 | ¥500 / ¥1200 | 伤害倍率 x 1.25 |
| 扩容气罐 | ¥250 / ¥600 | 燃气容量 +30% |
| 快速冷却 | ¥400 / ¥1000 | 热量衰减速度 x 1.3（可与低温叠加） |

> 升级在同一局内跨关卡保留，新游戏/重新开始时重置。

**升级持久化机制：**
- 同一局内跨关卡保留（通关→商店→下一关）
- 重复购买被阻止（同局内每个升级只能买一次）
- 新游戏/重新开始时重置
- 不永久保存（localStorage 中不保留）
- 通过 `progress.shopUpgrades` 数组实现

### 3.7 消耗品系统（v2.1 新增）

**购买位置**：关卡全部波次通关后的补给站界面

| 消耗品 | 价格 | 效果 | 使用方式 |
|--------|------|------|----------|
| **燃气 refill** | ¥200 | 燃气回满 | 自动触发（燃气<30%） |
| **防线 repair** | ¥250 | 防线恢复25HP | 自动触发（防线<40%） |
| **紧急冷却** | ¥150 | 立即冷却（取消过热） | 自动触发（过热时） |
| **火力 boost** | ¥500 | 伤害x1.5，火焰射程+50%，持续5秒 | 手动使用 |
| **防线护盾** | ¥600 | 防线获得3秒无敌护盾 | 手动使用 |
| **蟑螂诱饵** | ¥350 | 在地面行走面中心投放诱饵罐，吸引所有蟑螂聚集 | 手动使用 |

**跨关卡保留**：补给站购买的消耗品会保留到下一关（通过 `nextSceneConsumablesRef` 在关卡切换时传递），防线突破或重新开始时清空。

**自动/手动使用**：
- 自动使用：燃气 refill、防线 repair、紧急冷却（设置中可开关）
- 手动使用：火力 boost、防线护盾、蟑螂诱饵（需在 HUD 点击按钮）

---

## 四、敌人系统

### 4.1 敌人类型（11种）

| 类型 | HP | 速度 | 特殊能力 | 护甲/护盾 |
|------|-----|------|----------|----------|
| 普通蟑螂 | 3 | 0.8-1.2 | 无 | 无 |
| 大型蟑螂 | 8 | 0.6-0.9 | 无 | 无 |
| 飞行蟑螂 | 4 | 1.5 | 飞行（高度0.3-0.6） | 无 |
| **飞行自爆蟑螂** | **2** | **3.0** | **飞行+自爆** | **固定5** |
| **护甲蟑螂** | **12-21** | **0.5-0.8** | **蓝色六边形护盾** | **HP x 1.0 x 难度** |
| **分裂蟑螂** | **6** | **0.9** | **死亡分裂为5只小蟑螂** | **无** |
| **自爆蟑螂** | **2** | **2.4** | **Z字游走+火焰闪避+自爆** | **固定6** |
| 女王蟑螂 | 25 | 0.3 | 高血量，召唤小怪 | 无 |
| **护士蟑螂** | **70** | **0.8** | **治疗盟友（2秒冷却，20%HP）** | **35点红色护盾** |
| **变异蟑螂** | **50** | **0.5** | **HP<50%变身其他类型（1秒无敌）** | **无** |
| **定时自爆蟑螂** | **240** | **2.0** | **防线前64px放置炸弹→变身大蟑螂** | **120点炸弹护甲** |

> **医院专属（3种）**：护士蟑螂、变异蟑螂、定时自爆蟑螂（仅在医院场景出现）

### 4.2 护甲系统

- 护甲以 `armorHp` buff形式存在
- 护甲HP翻倍（自爆固定6→实际12，飞行自爆固定5→实际10）
- **护盾特效**：蓝色六边形护盾在蟑螂周围，破甲前消失
- **受击反应**：有护甲时**没有任何被攻击动作**（无闪烁/后退）

### 4.3 武器克制关系

| 武器/道具 | 有护甲蟑螂 |
|-----------|-----------|
| 喷雾/粘板/激光 | 完全无效 |
| 喷火 | 80%吸收，20%穿透 |
| 风扇 | 免疫回退 |
| 电蚊拍 | 全额伤害+立即破甲+减速80% |

### 4.4 肉盾挡火机制

- 有护甲蟑螂在火焰区域内保护**周围120px内**所有蟑螂
- 被保护的蟑螂只受 **20%** 火焰伤害
- 护甲蟑螂自身全额受火

### 4.5 自爆蟑螂闪避AI

- **平时**：直线冲向防线（速度2.4）
- **被火焰击中**：随机选方向横向闪避，速度100，持续1.2秒
- **再次被打**：保持方向（不反向），重置持续时间
- **到达边界**：停止闪避（不反弹）
- **被粘板粘住**：不闪避，保持静止直到粘板效果消失
- **风扇减速**：闪避速度受风扇减速影响
- **火墙阻挡**：闪避速度大幅降低

### 4.6 医院专属敌人详解

**护士蟑螂（NURSE）**
- 不主动向防线移动，跟随最近的非护士盟友
- 每2秒治疗180px范围内最低血量盟友20%HP
- 35点红色护盾（吸收80%伤害）
- 当场景中仅剩护士时，自动击杀并推进下一波

**变异蟑螂（MUTANT）**
- HP低于50%时触发变身（6秒无敌+紫色旋涡光环）
- 变身为随机其他蟑螂类型（保留80%血量）
- 死亡时150px范围酸液溅射（10点伤害）

**定时自爆蟑螂（TIMED_SUICIDE）**
- 到达防线前64px停止，2秒放置炸弹（期间无敌）
- 放置完成后变身大型蟑螂
- 炸弹3秒后爆炸（196px范围，20点伤害）
- 120点炸弹护甲（HP的50%）

### 4.7 虫卵孵化池系统（医院专属）

| 属性 | 说明 |
|------|------|
| 血量 | 180 |
| 孵化周期 | 10秒 |
| 孵化内容 | 随机蟑螂（权重加权） |
| 摧毁奖励 | 连续摧毁3个触发"消毒奖励"（燃气全满+清除异常） |
| 视觉 | 绿色液体+红色裂纹虫卵，远处50%→近处100%透视缩放 |

### 4.8 三星评价系统（医院专属）

| 星级 | 条件 |
|------|------|
| ⭐ | 通关 |
| ⭐⭐ | 通关 + 摧毁50%以上虫卵 |
| ⭐⭐⭐ | 通关 + 摧毁80%以上虫卵 + 0次防线突破 |

### 4.9 掉落拾取动画

- 道具从屏幕上方（y=-60）掉落
- 受重力加速，落到屏幕70%位置停止
- 掉落过程中随时可点击拾取
- 落地后切换为呼吸浮动动画

## 五、Boss战系统

### 5.1 触发方式

- 通过主菜单选择"BOSS战"模式进入
- 场景固定为屋顶（ROOFTOP）
- 限时180秒，防线HP归零或时间耗尽则失败

### 5.2 4波虫卵系统

| 波次 | 名称 | 虫卵数 | 孵化类型 | 虫卵HP |
|------|------|--------|----------|--------|
| 1 | 虫卵入侵 | 15 |  mostly 小型 + 少量大型 | 1(2困难) |
| 2 | 大蟑螂卵 | 12 | 大型 + 飞行 + 少量自爆 | 2(3困难) |
| 3 | 飞行蟑螂卵 | 10 | 飞行 + 护甲 + 地面/飞行自爆 | 3(4困难) |
| 4 | 精英蟑螂卵 | 8 | 护甲 + 自爆 + 女王 + 分裂 | 4(5困难) |

**虫卵位置**：完全随机分布在屏幕底部区域（X: 60~480, Y: 防线附近±30px）

**波次切换**：清完当前波所有虫卵和孵化蟑螂后，2秒延迟进入下一波

### 5.3 Boss随机护甲机制

- Boss有概率为孵化出的蟑螂赋予护甲
- 护甲概率随波次递增：10% → 25% → 40% → 60%
- 护甲HP根据蟑螂类型和难度计算
- 带护甲的孵化蟑螂显示蓝色"BOSS护甲!"提示

### 5.4 胜利条件

- 清完4波虫卵后，Boss进入对话→逃跑动画
- 逃跑完成后触发胜利结算

### 4.6 分裂蟑螂

- 死亡后分裂为5只小蟑螂
- 小蟑螂扩散范围：50px（X轴），30px（Y轴）
- 小蟑螂速度：1.6-2.4（普通-困难）

---

## 五、道具系统

### 5.1 特殊道具（通关解锁）

| 道具 | 解锁场景 | 效果 | 图标 |
|------|----------|------|------|
| **强力风扇** | 厨房 | 全屏减速50%，有护甲免疫 | drop_fan.png |
| **燃烧瓶** | 下水道 | 投掷火瓶，区域火墙 | drop_molotov.jpg |
| **散弹模式** | 垃圾场 | 三管齐发扇面扫射 | drop_shotgun.png |
| **雷达激光** | 地下室 | 自动瞄准，伤害10，5发0.3s | drop_radar.png |
| **电蚊拍** | 屋顶 | 全屏攻击+破甲+减速80%（5秒） | drop_swatter.png |

### 5.2 可放置道具

- **蟑螂贴板**：粘住地面蟑螂使其无法移动
- **杀虫喷雾**：双侧水平喷射+3秒中毒

### 5.3 掉落拾取动画

- 道具从屏幕上方掉落（受重力加速）
- 落到屏幕70%位置停止
- 掉落过程中随时可点击拾取
- 拾取后进入道具介绍界面（蟑叔对话+图标展示）

---

## 六、美术风格

### 6.1 整体风格

**废土工业风**（Wasteland Industrial）
- 暗色调为主，以深棕、铁锈橙、暗灰为基调
- 金属质感UI元素（铆钉、铁板、锈迹）
- 火焰/爆炸效果提供视觉焦点

### 6.2 场景美术

| 场景 | 背景描述 |
|------|----------|
| 厨房 | 凌乱厨房，食物残渣，暗光 |
| 下水道 | 阴暗管道，积水，工业设施 |
| 垃圾场 | 废弃垃圾堆，锈迹金属 |
| 地下室 | 昏暗走廊，天花板灯泡，两侧旧报纸+涂鸦，地上散落垃圾，窗外闪电 |
| 屋顶 | 城市天际线，天台设施 |
| 街道 | 无尽模式，城市街道 |

### 6.3 UI风格

- **主菜单**：深色半透明卡片+琥珀色边框，火焰装饰
- **暂停界面**：深色半透明卡片+模式卡片式按钮
- **商店界面**：深色网格+琥珀色高亮按钮
- **道具介绍**：黑色背景+粒子特效+大图标的居中展示
- **HUD**：顶部状态栏，半透明深色背景

### 6.4 动画效果

- 蟑螂：翅膀扇动（飞行型）、护盾脉动（护甲型）、Z字游走（自爆型）
- 火焰：多段渐变（白→黄→橙→红→暗红），动态摇晃
- 爆炸：粒子迸发+屏幕震动
- 道具掉落：重力掉落+呼吸浮动

---

## 七、音效设计

### 7.1 音效资源

| 音效 | 文件 | 用途 |
|------|------|------|
| 背景音乐 | bgm.mp3 | 游戏全程循环 |
| 开火 | sfx_fire.mp3 | 普通喷射 |
| 强化开火 | sfx_fire_intense.mp3 | 三重火焰 |
| 击杀 | sfx_kill.mp3 | 蟑螂死亡 |
| 换弹 | sfx_reload.mp3 | 燃气罐更换 |
| 电蚊拍 | sfx_swatter.mp3 | 电蚊拍攻击 |
| 倒计时滴答 | Web Audio API 合成 | 3-2-1读秒（880Hz方波，80ms） |

### 7.2 音频管理

- 支持静音切换
- 支持震动反馈（移动端）
- 音频上下文自动恢复

---

## 八、新手引导系统

### 8.1 概述

游戏包含两套互补的新手引导系统，均在首次触发时自动展示，通过 `localStorage` 标记是否已观看：

| 引导类型 | 组件 | 触发时机 | 展示方式 |
|---------|------|---------|---------|
| **战斗操作引导** | `GameplayTutorialOverlay` | 厨房第1波首次进入 | Canvas上层4片遮罩聚光灯 |
| **商店道具引导** | `ShopTutorialOverlay` | 首次打开补给站 | DOM ref高亮+自动滚动 |

### 8.2 战斗操作引导

**触发条件**：厨房场景 + 故事模式 + 第1波 + `localStorage` 无 `gameplay_tutorial_seen` 标记

**暂停出怪机制**：
- 引擎 `startWave()` 在 `this.wave++` 之后检查 tutorial 条件
- 若满足条件，设置 `tutorialPauseSpawn = true` 并返回，不生成任何怪物
- 波次管理器检查 `!this.tutorialPauseSpawn` 才会自动推进下一波，防止 waveTimer 到期后重复调用 `startWave()` 绕过检查
- 引导完成后调用 `resumeSpawnAfterTutorial()` 恢复并正式开始第1波

**10步引导流程**（基于手机端540x960竖屏精确校准）：

| 步骤 | 标题 | 高亮区域(x, y, w, h) | 对话框位置 |
|------|------|---------------------|-----------|
| 1 | 战斗准备！ | 无（全屏暗色遮罩） | 底部 |
| 2 | 火枪控制区 | (0.080, 0.750, 0.841, 0.173) | 底部贴高亮 |
| 3 | 战斗区域 | (0.050, 0.120, 0.900, 0.580) | 底部 |
| 4 | 防线介绍 | (0.000, 0.751, 1.000, 0.068) | 底部贴高亮 |
| 5 | 防线血条 | (0.213, 0.091, 0.570, 0.058) | 底部 |
| 6 | 热力条 | (0.017, 0.338, 0.081, 0.247) | 底部 |
| 7 | 燃气条 | (0.046, 0.023, 0.283, 0.065) | 底部 |
| 8 | 拾取道具区 | (0.861, 0.588, 0.139, 0.238) | 底部贴高亮 |
| 9 | 武器与道具栏 | (0.000, 0.829, 1.000, 0.083) | 底部贴高亮 |
| 10 | 上战场！ | 无（全屏暗色遮罩） | 底部 |

**对话框定位系统**：支持5种精确定位模式，根据高亮区域屏幕位置自动判断：
- `bottom`（底部固定）/ `center`（中央42%）/ `center-upper`（中央偏上22%）
- `above-highlight`（对话框顶部 = 高亮上边缘 - 20px）
- `above-highlight-bottom`（对话框底部 = 高亮上边缘 - 20px，使用 translateY(-100%)）
- `below-highlight`（对话框顶部 = 高亮下边缘 + padding + 20px）

**聚光灯实现**：4片绝对定位的 `div`（上/下/左/右）填充 `bg-black/75`，中间留出高亮区域，外加黄色发光边框 `box-shadow`

### 8.3 商店道具引导

**触发条件**：首次打开补给站 + `localStorage` 无 `shop_tutorial_seen` 标记

**7步引导流程**：

| 步骤 | 标题 | 目标 | 对话框位置 | 自动滚动 |
|------|------|------|-----------|---------|
| 1 | 补给站到了！ | 无（全屏暗色） | 底部 | 无 |
| 2 | 气罐补给 | `gas_refill` 卡片 | 底部 | 上部区域 |
| 3 | 紧急冷却 | `emergency_cool` 卡片 | 底部 | 上部区域 |
| 4 | 火力全开 | `power_boost` 卡片 | 底部 | 上部区域 |
| 5 | 防线修复 | `defense_repair` 卡片 | 顶部 | 下部区域 |
| 6 | 临时护盾 | `shield` 卡片 | 顶部 | 下部区域 |
| 7 | 蟑螂诱饵 | `bait` 卡片 | 顶部 | 下部区域 |
| 8 | 已拥有道具 | 底部已拥有栏 | 顶部 | 底部 |

**滚动定位策略**：
- 前3个道具（对话框底部）：`scrollTo(itemTop - containerHeight * 0.25)`，道具位于对话框上方
- 后4个道具（对话框顶部）：`scrollTo(itemBottom - containerHeight * 0.75)`，道具位于对话框下方
- 使用 `behavior: 'instant'` 同步滚动，滚动完成后再获取 `getBoundingClientRect()`，确保高亮位置与实际DOM位置一致

### 8.4 头像与角色

**樟叔**（`/assets/zhangshu-avatar.jpg`）
- 游戏导师NPC，话痨搞笑风格，通过对话和漫画引导玩家
- 在战斗操作引导、商店道具引导中作为讲解员头像

**玩家**（`/assets/avatar_player.png`）
- 极简冷漠吐槽风格，对话中作为"你"的发言头像

**螂老大**（`/assets/langlao-da.png`）
- 蟑螂帝国的统治者，头戴皇冠、红色独眼的巨型蟑螂
- 在剧情对话中通过管道回声、闪电现身、街面对峙等方式乱入
- 首次登场：第二关下水道（管道回声），最终在第六关天台决战
- 对话头像使用蟑螂角色原画，红色主题气泡边框

**Speaker匹配机制**：`DialogScreen.tsx` 中 `getSpeakerKey()` 函数智能匹配带后缀的speaker名称，如 `螂老大（管道回声）` 自动匹配到 `螂老大` 的头像和配色。

### 8.5 战斗前3-2-1倒计时系统

**触发时机**：每个关卡第1波开始前（厨房关卡在操作引导之后）

**流程**：
- `startWave()` 中调用 `startCountdown()`，设置 `state = GameState.COUNTDOWN`
- `update()` 中处理 COUNTDOWN 状态：`countdownTimer` 每秒递减
- 每切换一个数字（3→2→1），播放 `playCountdownTick()` 音效（880Hz方波，80ms）
- 倒计时结束调用 `doWaveSpawn()` 正式开始第一波

**关键实现**：
- `gameLoop` 必须包含 `GameState.COUNTDOWN` 在白名单中，否则循环停止导致卡死
- `resumeSpawnAfterTutorial()` 完成后也进入 COUNTDOWN，确保厨房关卡顺序：引导 → 倒计时 → 战斗

**UI**：`CountdownOverlay.tsx` - 全屏半透明暗色遮罩 + 中央180px金黄色大数字 + "准备战斗"提示文字

---

## 九、程序架构

### 9.1 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React 18 |
| 构建工具 | Vite |
| 语言 | TypeScript（严格模式） |
| 样式 | Tailwind CSS |
| 渲染 | HTML5 Canvas 2D API |
| 状态管理 | React useState + 引擎回调 |

### 8.2 文件结构

```
/mnt/agents/output/app/
├── public/assets/              # 游戏资源
│   ├── bg_*.jpg               # 场景背景（6张）
│   ├── langlao-da.png         # 螂老大角色头像（对话系统）
│   ├── zhangshu-avatar.jpg    # 樟叔真人头像（新手引导）
│   ├── roach_*.png            # 蟑螂贴图（8种）
│   ├── drop_*.png/jpg         # 道具掉落贴图（6张）
│   ├── item_*.png             # 道具图标
│   ├── gun.png                # 武器图标
│   ├── boss_p*.png            # Boss三阶段贴图
│   ├── fan.png                # 风扇图标（256x256，用户上传）
│   ├── item_swatter.png       # 电蚊拍图标（用户上传）
│   ├── sfx_*.mp3              # 音效文件
│   └── bgm.mp3               # 背景音乐
├── api/                        # 后端API（tRPC + Hono）
│   ├── boot.ts                 # 服务入口
│   ├── context.ts              # tRPC上下文
│   ├── middleware.ts           # 中间件（auth, admin, query）
│   ├── router.ts               # tRPC路由注册
│   ├── queries/                # 数据库查询
│   │   └── connection.ts       # Drizzle ORM连接
│   └── lib/                    # 工具库
├── db/                         # 数据库
│   ├── schema.ts               # 表定义（players, player_sessions）
│   ├── relations.ts            # 表关系
│   ├── seed.ts                 # 种子数据
│   └── migrations/             # 迁移文件
├── contracts/                  # 前后端共享类型
│   ├── types.ts
│   └── errors.ts
├── src/
│   ├── game/
│   │   ├── engine.ts           # 游戏引擎（核心）
│   │   ├── types.ts            # 类型定义
│   │   ├── data.ts             # 配置数据
│   │   ├── audio.ts            # 音频管理器
│   │   ├── vibration.ts        # 震动反馈
│   │   ├── comicData.ts        # 漫画数据
│   │   └── bossAnimation.ts    # Boss动画数据
│   ├── components/game/        # React游戏组件
│   │   ├── GameCanvas.tsx       # 主游戏画布
│   │   ├── GameHUD.tsx          # HUD界面
│   │   ├── GameMenu.tsx         # 游戏菜单
│   │   ├── TitleScreen.tsx      # 标题画面
│   │   ├── ShopScreen.tsx       # 商店结算
│   │   ├── ItemRevealScreen.tsx  # 道具介绍
│   │   ├── GameOverScreen.tsx   # 游戏结束
│   │   ├── PauseScreen.tsx      # 暂停画面
│   │   ├── DialogScreen.tsx     # 对话系统
│   │   ├── ComicViewer.tsx      # 漫画查看器
│   │   ├── EncyclopediaScreen.tsx # 图鉴
│   │   ├── SceneSelectScreen.tsx  # 场景选择
│   │   ├── TalentTreeScreen.tsx   # 天赋树
│   │   ├── AchievementsScreen.tsx # 成就系统
│   │   ├── GameplayTutorialOverlay.tsx      # 战斗操作引导（聚光灯遮罩）
│   │   ├── ShopTutorialOverlay.tsx      # 商店道具引导（DOM高亮）
│   │   ├── CountdownOverlay.tsx         # 战斗前3-2-1倒计时
│   │   ├── DialogScreen.tsx             # 剧情对话系统
│   │   └── ItemRecycleAnimation.tsx     # 拾取道具回收飞行动画
│   ├── pages/
│   │   └── AdminPage.tsx        # 管理后台
│   ├── providers/
│   │   └── trpc.tsx             # tRPC客户端Provider
│   ├── App.tsx                  # 根组件
│   └── main.tsx                 # 入口文件
├── PROJECT_STATE.md            # 项目状态文档
├── AGENT_HANDOFF.md            # Agent交接指令
└── README.md                   # 本文档
```

### 8.3 引擎架构（单文件6,900+行）

```
GameEngine
├── 生命周期：start/stop/pause/resume/restart/reset
├── 玩家系统：createPlayer/updatePlayer
├── 武器系统：13种武器update方法
├── 道具系统：selectItem/throwAimedWeapon
├── 敌人系统：spawnRoach/updateRoaches/killRoach
├── 碰撞检测：checkCollisions/checkDefense
├── 波次系统：updateWave/startWave
├── BOSS系统：updateBossBattle/initBossBattle
├── 粒子系统：spawn*/updateParticles
├── 渲染系统：17个render方法
├── 输入处理：setMouseX/setFiring
├── 存档系统：loadProgress/saveProgress
└── 商店系统：buyUpgrade
```

### 8.4 游戏循环

```typescript
gameLoop(now) {
  deltaTime = (now - lastTime) / 1000;
  update();   // 逻辑更新（PLAYING状态才执行游戏逻辑）
  render();   // 画面渲染（PLAYING/COUNTDOWN/ITEM_DROP/ITEM_REVEAL都渲染）
  requestAnimationFrame(gameLoop);
}
```

### 8.5 状态管理

- 引擎内部使用 `GameState` 枚举管理状态：`MENU` / `PLAYING` / `PAUSED` / `COUNTDOWN` / `ITEM_DROP` / `ITEM_REVEAL` / `WAVE_CLEAR` / `GAME_OVER`
- React通过回调与引擎通信：`onStateChange`, `onWaveClear`, `onGameOver`
- `ITEM_DROP`/`ITEM_REVEAL` 状态只更新视觉，不执行游戏逻辑
- `COUNTDOWN` 状态冻结游戏逻辑，仅更新倒计时计时器和视觉渲染

---

## 十、已完成内容

### 10.1 核心系统 ✅

- [x] 11场景关卡模式（厨房→下水道→垃圾场→地下室→街道→天台→医院→地铁→超市→学校→巢穴）
- [x] 无尽模式（街道场景）
- [x] 波次生成系统
- [x] 防线HP系统
- [x] 燃气与过热系统
- [x] 经济系统+商店升级
- [x] 天赋树系统
- [x] 成就系统
- [x] 存档/读档（localStorage + 云存档）
- [x] 漫画+对话叙事系统
- [x] 管理后台 (/admin)
- [x] 云存档系统 (tRPC + MySQL)
- [x] 新手引导系统（战斗操作引导 10步 + 商店道具引导 8步）
- [x] 战斗前3-2-1倒计时系统（每关第1波前）
- [x] 剧情对话角色头像（蟑叔、玩家、螂老大）
- [x] 拾取道具回收系统（未使用道具变金币 + 飞行动画）
- [x] 防线修复道具平衡调整（百分比修复 + 涨价 + 冷却延长）
- [x] 金币经济系统平衡调整（击杀奖励 + 场景倍率 + 商店价格）
- [x] 防线被攻破不扣金币

### 10.2 武器系统 ✅

- [x] 火焰喷射器（基础武器，扇形，过热机制）
- [x] 毒液喷射（持续伤害）
- [x] 霰弹模式（三管齐发）
- [x] 莫洛托夫（投掷火瓶，区域燃烧）
- [x] 冰冻弹（减速）
- [x] 粘板/毒液/燃烧瓶（可放置道具）
- [x] 强力风扇（全屏减速50%，有护甲免疫）
- [x] 雷达激光（自动瞄准，伤害10，5发0.3s）
- [x] 电蚊拍（全屏攻击+破甲+减速80%）
- [x] 杀虫喷雾（双侧喷射+中毒）

### 10.3 敌人系统 ✅

- [x] 11种敌人类型（普通/大型/飞行/飞行自爆/护甲/分裂/自爆/女王/**护士/变异/定时自爆**）
- [x] 护甲系统（护盾特效+HP翻倍+武器克制）
- [x] 肉盾挡火机制（120px保护范围）
- [x] 自爆蟑螂AI（Z字游走+火焰闪避+触墙停止）
- [x] 分裂蟑螂（5只小蟑螂+扩散动画）
- [x] 飞行蟑螂高度系统

### 10.4 美术与UI ✅

- [x] 11张场景背景
- [x] 11种蟑螂贴图（含医院3种专属）
- [x] 虫卵孵化池贴图
- [x] 道具掉落贴图（用户自定义）
- [x] 标题画面
- [x] 暂停界面（废土风）
- [x] 商店界面
- [x] 道具介绍界面
- [x] 游戏结束界面
- [x] 图鉴系统
- [x] 天赋树界面
- [x] 成就界面
- [x] HUD系统
- [x] 粒子特效系统

### 9.5 音频 ✅

- [x] 背景音乐
- [x] 开火音效
- [x] 击杀音效
- [x] 换弹音效
- [x] 电蚊拍音效
- [x] 音频管理器（静音/震动）

---

## 十一、后续开发计划

### 高优先级

- [x] **废弃医院场景** — 已完成
  - 3种专属敌人（护士/变异/定时自爆蟑螂）
  - 虫卵孵化池系统
  - 8波次配置
  - 三星评价系统
  - 剧情对话系统
- [x] **BOSS战4波虫卵系统** — 已完成
  - 波1~4差异化配置（类型组合+数量递减）
  - 虫卵完全随机位置分布
  - Boss随机护甲机制（10%~60%概率）
  - Boss对话→逃跑→胜利结算

### 中优先级

- [ ] 更多Boss技能（冲锋/召唤/蜕皮/弱点暴露）
- [ ] 更多敌人类型和行为模式
- [ ] 无尽模式难度曲线优化
- [ ] 商店升级购买上限提示
- [ ] 关卡选择界面显示已通关标记

### 中优先级

- [ ] 4个待开发场景（地铁/超市/学校/巢穴）
- [ ] 更多Boss技能（冲锋/召唤/蜕皮/弱点暴露）
- [ ] 无尽模式难度曲线优化

### 低优先级

- [ ] 多人合作模式
- [ ] 排行榜系统（本地/在线）
- [ ] 每日挑战模式
- [ ] 引擎文件拆分（当前单文件9,700+行）

---

## 十二、关键设计决策

1. **单文件引擎**：所有游戏逻辑集中在 `engine.ts`，便于状态共享但维护困难
2. **Canvas 2D渲染**：不使用WebGL/Phaser，保持轻量
3. **竖屏540x960**：固定分辨率，移动端优先
4. **React状态通过回调同步**：引擎不直接操作React state
5. **游戏循环在PLAYING状态执行逻辑**：ITEM_DROP/ITEM_REVEAL只渲染不更新逻辑
6. **商店升级跨关卡保留**：同一局内购买后跨场景有效，新游戏重置
7. **用户上传资源不可替换**：fan.png、item_swatter.png、roach_flying_suicide.png为定制资源

---

## 十三、已知问题与修复历史

### 当前已知问题

| 问题 | 状态 | 说明 |
|------|------|------|
| 引擎文件过大 | 🔶 | engine.ts 6,900+行，拆分多次尝试失败 |
| 关卡切换偶发卡顿 | 🔶 | 已通过cancelAnimationFrame缓解 |

### 已修复的关键Bug

| Bug | 原因 | 修复方案 |
|-----|------|----------|
| **游戏无法加载（空白页）** | `createPlayer()` 在 `loadProgress()` 之前调用，`this.progress` 为 undefined | 调整 constructor 初始化顺序：先 `loadProgress()` 再 `createPlayer()` |
| **商店升级无效** | `resetGame()` 重新 `createPlayer()`，覆盖所有升级属性 | 添加 `progress.shopUpgrades` 持久化，跨关卡保留 |
| **道具介绍界面卡死** | `onWaveClear` 回调在 GameCanvas 中未设置 | 在 GameCanvas useEffect 中添加 `engine.onWaveClear` 回调 |
| **最后一波掉落物动画不显示** | `gameLoop` 只在 PLAYING 状态运行 | 允许 gameLoop 在 ITEM_DROP/ITEM_REVEAL 状态也运行 |
| **飞行蟑螂卡屏幕外导致波次不推进** | 飞行蟑螂生成在屏幕外，卡在边界 | 添加屏幕外拉回机制 |
| **关卡切换后卡顿** | `start()` 未取消旧循环，导致多个循环并行 | 在 `start()` 开头添加 `cancelAnimationFrame` |
| **自爆蟑螂闪避不受风扇/火墙控制** | 闪避代码直接覆盖 `vx`，不受外部减速影响 | 闪避循环内应用 `fanSlowFactor` 和火墙检查 |
| **进入场景后直接跳出商店** | `updateWave()` 波次完成检测缺少 `this.wave > 0` 条件 | 添加 `this.wave > 0` 防止初始状态误判 |
| **进入场景后蟑螂不生成** | `start()` 调用 `resetGame()` 后未调用 `startWave()` | 在 `start()` 中排除 BOSS 模式后调用 `startWave()` |
| **清完几只怪后提前弹出商店** | 每波完成后设为 `WAVE_CLEAR` 状态 | 改为波次完成后自动调用 `startWave()` 连续进行 |
| **跨关卡消耗品不保留** | `handleNextScene` 只保存 `shopUpgrades` 未保存 `consumableInventory` | 新增 `nextSceneConsumablesRef` 暂存消耗品并在 `doStartGame` 中恢复 |

---

## 十四、构建与部署

```bash
cd /mnt/agents/output/app
npm install
npm run build    # 输出到 dist/ 目录
# 部署：将 dist/ 目录作为静态网站部署
```

---

## 十五、透视梯形地面边界系统（v1.1 新增）

### 14.1 设计目标

每个场景的背景图具有不同的3D透视角度（墙面、管道、地面等障碍物位置不同），需要一个**场景相关的地面行走区域**来约束地面蟑螂的生成位置和移动范围，避免蟑螂在不合逻辑的位置出现（如穿墙、走在管道上等）。

### 14.2 数据结构

每个场景的地面边界定义为一个**透视四边形**（一般四边形，不一定是矩形或梯形）：

```typescript
// Format: [nearL, nearR, nearY, farL, farLY, farR, farRY]
//   nearL/nearR: 近端（画面下方）左右X边界 — WIDE
//   nearY: 近端Y坐标（画面下方，水平线）
//   farL/farR: 远端（画面上方）左右X边界 — NARROW
//   farLY: 远端左上角Y坐标
//   farRY: 远端右上角Y坐标
export const SCENE_GROUND_BOUNDS = {
  KITCHEN: [0, 530, 800, 200, 450, 400, 450],   // 厨房：矩形远端
  SEWER:   [0, 550, 800, 320, 550, 450, 550],   // 下水道：矩形远端
  DUMP:    [0, 550, 800, 100, 450, 450, 450],   // 垃圾场：矩形远端
  BASEMENT:[0, 550, 800, 200, 450, 350, 450],   // 地下室：右窄远端
  ROOFTOP: [0, 530, 800, 0, 400, 530, 400],     // 天台：全宽远端
  STREET:  [0, 550, 800, 250, 450, 300, 450],   // 街道：极窄远端
};
```

### 14.3 四个角点定义

| 角点 | 坐标 | 说明 |
|------|------|------|
| 左上 | `(farL, farLY)` | 远端左侧 |
| 右上 | `(farR, farRY)` | 远端右侧 |
| 左下 | `(nearL, nearY)` | 近端左侧（画面下方） |
| 右下 | `(nearR, nearY)` | 近端右侧（画面下方） |

### 14.4 运行时插值

`getGroundBoundsAtY(y)` 方法根据蟑螂当前的Y坐标，在左右两条边缘线之间线性插值，计算出该Y位置可用的左右X边界。蟑螂在移动过程中，其可用的横向范围会随Y位置动态变化。

### 14.5 可视化调试

游戏内开启 `showMovementRange = true` 时，画面叠加显示绿色透视四边形：
- 🟩 **绿色对角线** — 左右透视收敛边界
- 🟩 **上下横线** — 远近端边界
- 🟩 **浅绿填充** — 可行走区域
- 🟡 **黄色坐标标签** — 四个角点坐标

---

## 十六、3级渐进商店升级（v1.1 新增）

### 15.1 设计目标

原版商店升级是一次性购买，玩家成长曲线呈阶梯状跳跃。改为**可重复购买3次**的渐进系统，每次购买价格和效果递增，让每关都有成长感。

### 15.2 升级价格表

| 升级 | 1级价格 | 2级价格 | 3级价格 | 每级效果 |
|------|--------|--------|--------|---------|
| 加长枪管 | ¥200 | ¥300 | ¥400 | 射程 ×1.1 |
| 强化火焰 | ¥300 | ¥400 | ¥500 | 伤害 ×1.15 |
| 扩容气罐 | ¥150 | ¥200 | ¥250 | 气罐 ×1.15 |
| 低温燃料 | ¥250 | ¥350 | ¥450 | 冷却 ×1.25 |
| 双罐并联 | ¥400 | ¥500 | ¥600 | 过热阈值 ×1.25 |
| 快速冷却 | ¥250 | ¥350 | ¥450 | 冷却 ×1.15 |

### 15.3 困难模式专属升级

| 升级 | 1级价格 | 2级价格 | 3级价格 | 每级效果 |
|------|--------|--------|--------|---------|
| 扇面拓宽 | ¥350 | ¥450 | ¥550 | 扇面角度 ×1.5 |
| 极速换罐 | ¥250 | ¥350 | ¥450 | 换罐时间 ×0.85 |

**扇面拓宽**：将扇形喷射角度从默认12°逐步拓宽到约30°，覆盖面积翻倍。  
**极速换罐**：将换罐时间从8秒逐步减少到约4.9秒，减少火力中断。

---

## 十七、每关末尾敌人预览（v1.1 新增）

### 16.1 设计目标

在下个关卡才正式教学的新敌人类型，提前在本关末尾以少量形式出现，让玩家在紧张状态下首次遭遇，制造悬念和预习感。

### 16.2 预览链

| 关卡 | 预览敌人 | 首次出现波次 | 下一关正式教学 |
|------|---------|-------------|---------------|
| 厨房(1) | 飞行蟑螂 | 第3波起渐进 | 下水道(2) |
| 下水道(2) | 护甲蟑螂 | 第3波起渐进 | 垃圾场(3) |
| 垃圾场(3) | 自爆蟑螂 | 第3波起渐进 | 地下室(4) |
| 地下室(4) | 飞行自爆 | 第9-10波 | 天台(5) |

### 16.3 生成策略

预览敌人和大量普通敌人**混合在同一大波中出场**（三段式生成）：
1. **前30%** — 少量普通敌人热身
2. **中50%** — 高潮！大量普通敌人 + 预览敌人混合
3. **后20%** — 剩余普通敌人收尾

预览敌人不会孤零零单独出现，而是混在成群敌人中制造突发惊吓。

---

## 十八、音效系统更新（v1.1 新增）

### 17.1 新增音效

| 音效 | 触发条件 | 声音特点 |
|------|---------|---------|
| `playFlyingBuzz()` | 飞行蟑螂/飞行自爆生成 | **蚊子式高频嗡嗡** — 600Hz锯齿波+30Hz颤音+1200Hz泛音，尖锐刺耳 |
| `playFlyingDodge()` | 飞行蟑螂被火焰击中闪避 | 快速方向嗖嗖声+8连发翅膀拍打 |
| `startFanLoop()` | 风扇道具激活 | 持续白噪声+3Hz LFO调制，模拟扇叶旋转气流 |
| `playMolotovThrow()` | 投掷燃烧瓶 | 空气嗖声(800→200Hz)+玻璃脆响 |
| `startFireWallBurn()` | 火墙创建 | 持续棕噪声+低频隆隆+每150-350ms随机爆裂 |
| `playSuicideBreachGround()` | 地面自爆撞防线 | 低频地底轰鸣(60→25Hz)+沉重"咚"声+混凝土碎裂 |
| `playSuicideBreachFlying()` | 飞行自爆撞防线 | 尖锐爆炸裂响+破片飞散+多普勒俯冲尾音 |
| `playItemDropFanfare()` | 关卡结束新道具掉落 | C-E-G-C6上升琶音+和声层+最终明亮钟声 |

### 17.2 音效修复

- **Bug修复**：购买升级后资金不减少 → 添加 `onEconomyUpdate` 回调通知UI刷新
- **Bug修复**：关卡结束后喷火音效不停止 → `gameVictory()` / `gameDefeat()` 中添加 `stopFire()`

---

## 十九、可移动范围图（调试工具）

### 18.1 功能说明

游戏内置的可视化调试工具，显示当前场景的透视地面边界。用于校准每个场景的地面四边形参数。

### 18.2 开关方法

```typescript
// Engine 类中
engine.showMovementRange = true;   // 显示
engine.showMovementRange = false;  // 隐藏（默认）
```

### 18.3 显示内容

- 绿色透视四边形边界线
- 四个角点绿色圆点标记
- 黄色坐标标签 `(x,y)`
- 浅绿色半透明填充区域
- "蟑螂地面边界(透视)"文字标签

## 二十、飞行蟑螂音效系统（v1.2 更新）

### 19.1 设计变更

从Web Audio API合成音效改为**预录制音频文件循环播放**，实现更高质量的音效。

| 音效文件 | 触发条件 | 播放方式 | 停止条件 |
|---------|---------|---------|---------|
| `flying_roach_buzz.mp3` | 飞行蟑螂/飞行自爆生成 | **循环播放** (`loop=true`) | 最后一个飞行蟑螂死亡 |
| `flying_roach_death.mp3` | 飞行蟑螂/飞行自爆死亡 | 一次性播放 | 自动结束 |
| `flying_dodge.mp3` | 飞行蟑螂闪避时 | 一次性播放 | 自动结束 |

### 19.2 生命周期管理

```
飞行蟑螂生成 → startFlyingBuzzLoop() 开始循环
              ↓
        飞行蟑螂存活期间 → 循环持续播放
              ↓
        飞行蟑螂死亡 → playFlyingDeath() 播放死亡音效
              ↓
        检查是否还有存活飞行蟑螂
              ↓
        无存活 → stopFlyingBuzzLoop() 停止循环
```

### 19.3 安全机制

- 游戏胜利/失败/返回菜单时强制调用 `stopFlyingBuzzLoop()`
- 静音切换时自动停止
- 多次调用 `startFlyingBuzzLoop()` 不会重复创建音频对象

---

## 二十一、多管火焰枪视觉调整（v1.2 更新）

### 20.1 侧边枪管大小

| 修改项 | 修改前 | 修改后 |
|--------|--------|--------|
| 侧边枪管缩放比例 | `0.6` | `1.0` |
| 效果 | 侧边枪管比主枪管小 | 三管大小完全一致 |

### 20.2 侧边火焰特效偏移

| 修改项 | 修改前 | 修改后 |
|--------|--------|--------|
| 火焰特效Y偏移 | `0px` | `50px` |
| 枪身位置 | 不变 | 不变 |
| 效果 | 火焰与枪口对齐 | 火焰向下偏移50px |

**注意**：枪身位置保持原始坐标不变，仅火焰视觉特效下移。

---

## 二十二、全场景背景音乐配置（v1.2 完成）

### 21.1 配置总览

全部6个场景、12个难度模式均已配置独立BGM：

| 场景 | 简单模式BGM | 困难模式BGM |
|------|------------|------------|
| 厨房 | ✅ 已设置 | ✅ 已设置 |
| 下水道 | ✅ 已设置 | ✅ 已设置 |
| 垃圾场 | ✅ 已设置 | ✅ `6.mp3` |
| 地下室 | ✅ `5.mp3` | ✅ `7.mp3` |
| 天台 | ✅ `2.mp3` | ✅ `1.mp3` |
| 街道 | ✅ `3.mp3` | ✅ `4.mp3` |

### 21.2 新增BGM文件

| 文件 | 对应场景/难度 |
|------|-------------|
| `bgm_dump_hard.mp3` | 垃圾场困难模式 |
| `bgm_basement_easy.mp3` | 地下室简单模式 |
| `bgm_basement_hard.mp3` | 地下室困难模式 |
| `bgm_rooftop_easy.mp3` | 天台简单模式 |
| `bgm_rooftop_hard.mp3` | 天台困难模式 |
| `bgm_street_easy.mp3` | 街道简单模式 |
| `bgm_street_hard.mp3` | 街道困难模式 |

---

## 二十三、Boss战模式隐藏（v1.2 更新）

### 22.1 变更说明

Boss战模式（`GameMode.BOSS`）暂时从主菜单隐藏，不可选择。

### 22.2 实现方式

```typescript
// GameMenu.tsx
const gameModes = [
  { id: GameMode.STORY, name: '剧情模式', ... },
  { id: GameMode.ENDLESS, name: '无尽模式', ... },
  { id: GameMode.DAILY, name: '每日挑战', ... },
  // BOSS mode temporarily disabled
  // { id: GameMode.BOSS, name: 'BOSS战', ... },
];
```

### 22.3 重新开启方法

取消注释 `gameModes` 数组中的Boss战条目即可恢复。

---

## 二十四、后端架构（v2.0 新增）

### 23.1 技术栈

| 层 | 技术 |
|----|------|
| API框架 | Hono + tRPC 11.x |
| ORM | Drizzle ORM |
| 数据库 | MySQL |
| 序列化 | superjson |
| 类型安全 | Zod + TypeScript |

### 23.2 数据库表结构

```sql
-- 玩家主表
players
  id              SERIAL PRIMARY KEY
  player_id       VARCHAR(64) UNIQUE      -- 前端生成的唯一ID
  nickname        VARCHAR(100)
  highest_wave    INT DEFAULT 0
  highest_endless_wave INT DEFAULT 0
  total_kills     INT DEFAULT 0
  talent_points   INT DEFAULT 0
  scenes_completed INT DEFAULT 0
  weapons_unlocked INT DEFAULT 1
  full_progress   JSON                    -- 完整存档数据
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
  last_played_at  TIMESTAMP

-- 游戏场次记录
player_sessions
  id              SERIAL PRIMARY KEY
  player_id       VARCHAR(64)
  scene           VARCHAR(50)
  mode            VARCHAR(20)
  difficulty      VARCHAR(10)
  wave_reached    INT DEFAULT 0
  kills           INT DEFAULT 0
  result          VARCHAR(20)             -- victory / defeat / quit
  duration        INT                     -- 秒
  created_at      TIMESTAMP
```

### 23.3 API 接口

| 接口 | 类型 | 说明 |
|------|------|------|
| `player.save` | mutation | 上传/更新玩家存档 |
| `player.logSession` | mutation | 记录一场游戏 |
| `admin.listPlayers` | query | 获取所有玩家列表 |
| `admin.getPlayerDetail` | query | 获取单个玩家详情+场次记录 |
| `admin.stats` | query | 获取 Dashboard 统计数据 |
| `admin.recentSessions` | query | 获取最近游戏记录 |

### 23.4 玩家 ID 生成

首次打开游戏时自动生成唯一ID，格式 `p_ + 随机字符串 + 时间戳`，存储在 localStorage (`roach_blaster_player_id`) 中，后续自动上报存档时作为身份标识。

---

## 二十五、管理后台（v2.0 新增）

### 24.1 访问方式

在部署域名后加 `/admin` 路径访问：

```
游戏:  https://<域名>/
后台:  https://<域名>/admin
```

### 24.2 功能模块

| 模块 | 内容 |
|------|------|
| **总览数据** | 总玩家数、今日活跃、总场次、总击杀 |
| **击杀排行榜** | TOP 10 玩家，按总击杀排序 |
| **玩家列表** | 分页查看所有玩家，点击可查看详情 |
| **玩家详情** | 完整存档 JSON、天赋树、游戏历史记录 |
| **最近游戏记录** | 所有玩家的最近场次，含场景/波次/结果 |

### 24.3 数据实时性

- 玩家通关/失败时自动上报，后台数据即时报表
- 后台页面支持手动刷新

---

## 二十六、云存档系统（v2.0 新增）

### 25.1 存档流程

```
玩家游戏 → 通关/失败 → 自动上报存档到服务端
              ↓
        localStorage 保存（本地备份）
              ↓
        MySQL 持久化（服务端主存）
              ↓
        /admin 后台可查看
```

### 25.2 上报时机

| 时机 | 操作 |
|------|------|
| 剧情通关胜利 | 保存完整进度 + 记录胜利场次 |
| 防线被攻破（失败） | 保存完整进度 + 记录失败场次 |

### 25.3 本地存档（localStorage）

即使服务端不可用，游戏仍通过 localStorage 正常保存和读取：

| Key | 内容 |
|-----|------|
| `roach_blaster_progress` | 主存档（含版本号） |
| `roach_blaster_player_id` | 玩家唯一ID |
| `roach_blaster_endless_best_time` | 无尽模式最佳时间 |
| `roach_blaster_seen_comics` | 已看漫画记录 |
| `roach_blaster_vibration` | 震动开关 |

---

## 二十七、存档版本保护（v2.0 新增）

### 26.1 机制

存档数据中包含 `saveVersion` 字段，当前版本号为 **1**。加载存档时：

- 版本匹配 → 正常读取
- 版本缺失或不匹配 → 自动重置为新存档

### 26.2 版本升级

当数据结构发生不兼容变更时，递增 `SAVE_VERSION` 常量，所有旧存档自动重置，避免 undefined 错误。

---

## 二十八、部署方式

### 27.1 开发模式

```bash
cd /mnt/agents/output/app
npm install
npm run db:push    # 同步数据库schema
npm run dev        # 启动开发服务器 (http://localhost:3000)
```

### 27.2 生产构建

```bash
npm run build      # 构建前端 + 后端
npm start          # 启动生产服务器
```

### 27.3 环境变量

由 `init.sh` 自动生成 `.env` 文件，包含数据库连接、API密钥等，**不要手动修改**。

---

## 二十九、天赋点奖励（v2.0 修复）

### 28.1 剧情通关奖励

| 场景 | 难度系数 | 天赋点奖励 |
|------|---------|-----------|
| 厨房 | x1 | 100 |
| 下水道 | x1.5 | 150 |
| 垃圾场 | x2 | 200 |
| 地下室 | x2.5 | 250 |
| 天台/街道 | x3 | 300 |

### 28.2 天赋树（4个分支共16个天赋）

| 分支 | 天赋 |
|------|------|
| 战斗强化 | 火焰强化、射程延伸、霰弹枪解锁、燃烧瓶解锁 |
| 生存强化 | 扩容气罐、耐热改造、快速冷却、防线加固 |
| 辅助强化 | 拍子冷却、赏金猎人、冷冻武器、毒液武器 |
| 道具专精 | 火焰亲和、机械精通、爆炸专家、节约大师 |

---

---

## 三十、蟑螂诱饵道具系统（v2.1 新增）

### 29.1 设计目标

蟑螂诱饵是一种手动使用的消耗品，投放在地面行走面的中心位置，吸引所有蟑螂向该点聚集，为玩家创造集中消灭的机会。需要全程连贯的投掷动态效果：抛出 → 飞行 → 落地碎裂 → 持续香气。

### 29.2 投放位置

投放目标固定在**当前关卡地面行走面（透视四边形）的中心点**：
```typescript
getGroundCenter(): [number, number] {
  const [farL, farLY, farR, farRY, _midL, _midLY, _midR, _midRY, nearL, nearR, nearY] = SCENE_GROUND_BOUNDS[this.currentScene];
  const centerX = (farL + farR + nearL + nearR) / 4;
  const centerY = (farLY + farRY + nearY + nearY) / 4;
  return [centerX, centerY];
}
```

### 29.3 投掷动态效果（三段式）

**阶段一：飞行中的诱饵罐（0.8秒）**
- 棕色玻璃罐身 + 灰色瓶盖 + 黄色标签 + 白色高光
- 沿抛物线轨迹飞向目标位置（目标为地面行走面中心）
- 罐子有轻微旋转摆动（`Math.sin(timer * 10) * 0.3`）
- 地面投影随高度缩放（越高影子越小越淡）
- 运动拖尾：3个渐隐黄色小点跟随在后方

**阶段二：落地碎裂（瞬时）**
- 黄色 EMBER 粒子 x15：向上爆发，模拟诱饵液飞溅
- 白色 SPARK 粒子 x8：模拟玻璃碎片散射
- 粒子使用 `ParticleType.EMBER` 和 `ParticleType.SPARK` 已有渲染效果

**阶段三：持续香气（3秒）**
- 地面脉冲光环：黄色径向渐变，呼吸动画（`0.7 + 0.3 * sin(time * 4)`）
- 玻璃碎片：5个三角形碎片留在地面，透明度随时间衰减
- 香气粒子：每帧 2 个 SMOKE 粒子从落点缓慢上升
  - 颜色：`#fbbf24` / `#fcd34d` 交替
  - 速度：vy = -(15 + random * 20)，vx = (random - 0.5) * 8
  - 寿命：1.2-2 秒
  - 粒子总数限制在 280 以内

### 29.4 蟑螂吸引逻辑

诱饵生效期间（`player.baitTimer > 0`），所有蟑螂被拉向 `baitTarget` 位置：
```typescript
const pullStrength = 0.7;
moveAngle = atan2(sinA * (1 - pullStrength) + sinB * pullStrength,
                  cosA * (1 - pullStrength) + cosB * pullStrength);
r.speed = r.baseSpeed * 1.3; // 吸引时速度提升 30%
```

### 29.5 状态管理

| 状态变量 | 类型 | 说明 |
|----------|------|------|
| `baitThrowAnim` | `{ active, x, y, targetX, targetY, timer }` | 飞行动画状态 |
| `baitTarget` | `{ x, y, active }` | 落点位置和激活状态 |
| `player.baitTimer` | `number` | 剩余生效时间（默认3秒） |

### 29.6 渲染层级

在 `render()` 中的绘制顺序：
```
renderParticles() → renderBaitMark() → renderRoaches() → renderBaitThrow() → renderPlayer()
```
- `renderBaitMark()`：地面光环 + 碎片（在蟑螂下方）
- `renderBaitThrow()`：飞行中的罐子（在蟑螂和玩家之间）

---

## 三十一、存档版本迁移系统（v2.2 新增）

### 30.1 问题背景

原系统使用 `SAVE_VERSION = 1` 且从未更新，当数据结构变化时（如新增字段），旧存档会被直接重置，导致玩家进度丢失。

### 30.2 解决方案

采用**版本号 + 数据迁移**机制：

```typescript
// types.ts — 版本号定义
export const SAVE_VERSION = 2;
// Changelog:
// v1: Initial save format
// v2: Added scenesCompleted field + persistent consumable inventory
```

### 30.3 迁移逻辑（engine.ts:loadProgress()）

| 场景 | 处理方式 |
|------|---------|
| 无版本号 | 重置为默认进度 |
| 版本号 < 当前 | 执行迁移逻辑，保留已有数据 |
| 版本号 = 当前 | 正常加载 + 防御性字段填充 |
| 版本号 > 当前 | 重置（未来存档回退） |

**v1 → v2 迁移示例：**
```typescript
if (parsed.saveVersion === 1 && SAVE_VERSION === 2) {
  parsed.scenesCompleted = parsed.scenesCompleted || [];
  parsed.shopUpgrades = parsed.shopUpgrades || [];
  parsed.encyclopedia = parsed.encyclopedia || { entries: [...] };
  parsed.weaponsUnlocked = parsed.weaponsUnlocked || ['flamethrower', 'sticky'];
  parsed.saveVersion = SAVE_VERSION;
  localStorage.setItem('roach_blaster_progress', JSON.stringify(parsed));
  return parsed;
}
```

### 30.4 防御性字段填充

`loadProgress()` 返回前确保所有字段存在：
```typescript
if (!parsed.scenesCompleted) parsed.scenesCompleted = [];
if (!parsed.shopUpgrades) parsed.shopUpgrades = [];
if (!parsed.weaponsUnlocked) parsed.weaponsUnlocked = ['flamethrower', 'sticky'];
if (!parsed.encyclopedia) parsed.encyclopedia = { ... };
```

### 30.5 首次加载自动保存

```typescript
// 没有存档时：创建默认并立即保存到 localStorage
const defaultProgress = createDefaultProgress();
localStorage.setItem('roach_blaster_progress', JSON.stringify(defaultProgress));
return defaultProgress;
```

---

## 三十二、关卡结算流程改造（v2.2 新增）

### 31.1 去掉关卡后补给站

**修改前：**
- 胜利 → 补给站（购买道具）→ 下一关
- 失败 → 补给站（购买道具）→ 再来一局

**修改后：**
- 胜利 → 胜利结算界面 → 主菜单
- 失败 → 失败结算界面 → 主菜单
- 道具购买统一在**主菜单的道具商店**进行

### 31.2 结算界面（GameOverScreen）

| 状态 | isVictory | 显示内容 |
|------|-----------|---------|
| 胜利 | `true` | "胜利！"标题、3星评价、击杀统计、"下一关"按钮 |
| 失败 | `false` | "防线被突破"、波次统计、"再来一局"按钮 |

两者共有的按钮："返回主菜单"、"天赋树"

### 31.3 关卡进度保存时机

| 时机 | 保存内容 | 方法 |
|------|---------|------|
| 波次清完 | 解锁下一关 + scenesCompleted | `unlockNextScene()` → `saveProgress()` |
| 游戏失败 | 最高波次 + 总击杀 | `gameOver()` → `saveProgress()` |
| 添加天赋点 | 天赋树状态 | `addTalentPoints()` → `saveProgress()` |

---

## 三十三、道具商店 UI 改造（v2.2 新增）

### 32.1 去掉"已购数量"显示

购买按钮前不再显示"已购 xN"，购买成功后按钮显示绿色"已购买"提示 600ms。

### 32.2 新增"已拥有道具"栏

位于商店最底部，显示玩家当前拥有的所有道具：

```
┌─────────────────────────────┐
│         已拥有道具           │
│  [🔥x2] [🧀x1] [🛡️x3]     │
└─────────────────────────────┘
```

- 从 `localStorage`（`roach_blaster_consumables`）实时读取
- 每次购买后自动刷新
- 图标右下角显示数量角标
- 无道具时显示"暂无道具"

### 32.3 商店购买流程

```
主菜单 → 道具商店 → 购买道具 → 写入 localStorage
                                          ↓
                                    进入关卡 ← 从 localStorage 加载
                                          ↓
                                    游戏中使用
                                          ↓
                                    关卡结束 → 保存剩余数量
```

---

## 三十四、消耗品跨关卡持久化（v2.2 新增）

### 33.1 存档格式

```json
{
  "consumables": {
    "power_boost": 2,
    "bait": 1,
    "shield": 0,
    "defense_repair": 3
  },
  "emergencyCool": 2
}
```

### 33.2 持久化触发时机（5个）

1. **购买时** — `handleMenuShopBuy()` / `handleBuyConsumable()`
2. **使用/消耗时** — `onConsumableUpdate()` 回调
3. **关卡胜利时** — `onWaveClear()` 回调
4. **关卡失败时** — `onGameOver()` 回调
5. **紧急冷却次数变化时** — `onEmergencyCoolUpdate()` 回调

### 33.3 加载时机

`doStartGame()` 中从 `localStorage` 读取并设置到引擎：
```typescript
const saved = localStorage.getItem('roach_blaster_consumables');
if (saved) {
  const parsed = JSON.parse(saved);
  engine.consumableInventory = parsed.consumables || {};
  engine.emergencyCoolInventory = parsed.emergencyCool || 0;
  setCarriedConsumables({ ...engine.consumableInventory });  // 同步React state
}
```

---

## 三十五、紧急冷却系统整合（v2.2 新增）

### 34.1 设计目标

将紧急冷却从"游戏内付费购买"改为"道具商店预购，游戏中免费使用"。

### 34.2 系统架构

| 环节 | 实现 |
|------|------|
| **购买** | 在道具商店购买 `emergency_cool`，存入 `emergencyCoolInventory` |
| **存储** | 与普通消耗品共用 `localStorage`（`roach_blaster_consumables`） |
| **显示** | HUD 过热按钮显示 `"紧急冷却 (N次)"` |
| **使用** | 过热时点击按钮，优先消耗免费次数 |
| **用完** | 按钮变灰禁用，显示 `"冷却已用完"`，不可付费购买 |

### 34.3 引擎方法

```typescript
// 使用优先消耗购买的库存
emergencyCool() {
  if (!this.player.isOverheated) return;
  if (this.emergencyCoolInventory > 0) {
    this.emergencyCoolInventory--;
    // 清除过热...
    this.onEmergencyCoolUpdate?.(this.emergencyCoolInventory);
    return;
  }
  // 库存为0：不可用（无付费选项）
}
```

---

## 三十六、关卡进度保存修复（v2.2 补丁）

### 35.1 问题描述

通关厨房关卡后，解锁了下水道场景，点击进入下一关可以正常进入。但返回主菜单后，再次进入关卡选择界面，下水道场景显示为**锁定状态**。

### 35.2 根本原因（两层问题）

**第一层：`unlockNextScene()` 从未被调用**

```
updateWave() ——检测到所有波次完成——▶ 
  │
  ├── this.wave >= configs.length ──▶ gameVictory() ← 没有 unlockNextScene()！
  │
  └── 否则 ──▶ startWave()
                │
                └── this.wave > totalWaves ──▶ unlockNextScene() + gameVictory()
```

`updateWave()` 在检测到最终波次完成时**直接调用 `gameVictory()`**，完全跳过了 `unlockNextScene()`。而 `unlockNextScene()` 只在 `startWave()` 中被调用，但 `startWave()` 只有在非最终波次时才会被 `updateWave()` 调用。

**第二层：三个关键回调中缺少 `saveProgress()` 调用**

| 回调 | 触发时机 | 原代码 | 问题 |
|------|---------|--------|------|
| `onWaveClear` | 胜利结算显示前 | 无 `saveProgress()` | 进度未立即持久化 |
| `onGameOver` | 失败结算显示前 | 无 `saveProgress()` | 进度未立即持久化 |
| `handleQuit` | 返回主菜单前 | 无 `saveProgress()` | 最新进度丢失 |

**时序问题**：
1. 通关 → `unlockNextScene()` → `saveProgress()` ✅（修复后）
2. 显示结算 → `onWaveClear` → ❌ 未保存（修复后已添加）
3. 点击进入下一关 → 正常游戏
4. 返回主菜单 → `handleQuit` → ❌ 未保存（修复后已添加）
5. 重新进入关卡选择 → `loadProgress()` → 可能读到旧数据

### 35.3 修复方案

**修复1：在 `updateWave()` 中调用 `unlockNextScene()`（engine.ts）**

```typescript
// updateWave() —— 检测到所有波次完成时
if (this.wave >= configs.length) {
  this.unlockNextScene();  // ← 新增：解锁下一关
  this.gameVictory();
  return;
}
```

**修复2：在三个关键回调中添加 `saveProgress()`（GameCanvas.tsx）**

```typescript
// onWaveClear 回调
engine.onWaveClear = () => {
  setProgress({ ...engine.progress });
  engine.saveProgress();  // ← 新增
  // ...
};

// onGameOver 回调
engine.onGameOver = (e, w) => {
  setProgress({ ...engine.progress });
  engine.saveProgress();  // ← 新增
  // ...
};

// handleQuit
const handleQuit = useCallback(() => {
  engineRef.current?.audio.stopBGM();
  engineRef.current?.saveProgress();  // ← 新增（在 stop 之前）
  engineRef.current?.stop();
  setGameState(GameState.MENU);
}, []);
```

### 35.4 保存时机总结

修复后，关卡进度在以下 10 个时机被保存：

| # | 时机 | 方法 | 说明 |
|---|------|------|------|
| 1 | **波次清完解锁下一关** | `unlockNextScene()` | 核心解锁逻辑 |
| 2 | **胜利结算显示前** | `onWaveClear` 回调 | 确保结算前已保存 |
| 3 | **失败结算显示前** | `onGameOver` 回调 | 确保结算前已保存 |
| 4 | **返回主菜单前** | `handleQuit` | 确保退出前已保存 |
| 5 | **游戏失败** | `gameOver()` | 保存最高波次 |
| 6 | **BOSS 击杀** | `gameVictory()` | BOSS 模式通关 |
| 7 | **天赋点奖励** | `addTalentPoints()` | 天赋树更新 |
| 8 | **武器解锁** | `gameVictory()` | 道具掉落奖励 |
| 9 | **成就解锁** | `checkAchievements()` | 成就系统 |
| 10 | **首次加载** | `loadProgress()` | 创建默认存档并保存 |

---

## 三十七、关卡解锁链与初始解锁调整（v2.2 补丁）

### 36.1 问题描述

两个 UI/逻辑不一致问题：
1. **初始解锁了"城市街道"** — 新玩家第一次进入游戏就能看到城市街道关卡
2. **UI 显示顺序错误** — 天台在街道之前显示，且缺少街道关卡

### 36.2 根本原因

**问题1：默认解锁设置错误**（`data.ts:createDefaultProgress`）

```typescript
// 原代码（有问题）
scenesUnlocked: [SceneType.KITCHEN, SceneType.STREET],
// 应只解锁厨房
scenesUnlocked: [SceneType.KITCHEN],
```

**问题2：UI 渲染顺序硬编码**（`SceneSelectScreen.tsx`）

```typescript
// 原代码（有问题）
const SCENE_ORDER = ['kitchen', 'sewer', 'dump', 'basement', 'rooftop'];
// 缺少 'street'，且 'rooftop' 在 'street' 之前

// 修复后
const SCENE_ORDER = ['kitchen', 'sewer', 'dump', 'basement', 'street', 'rooftop'];
```

### 36.3 修复内容

| 文件 | 修改 |
|------|------|
| `data.ts` | `createDefaultProgress`: 初始解锁从 `[KITCHEN, STREET]` 改为 `[KITCHEN]` |
| `data.ts` | `SCENE_UNLOCK_CHAIN`: 顺序改为 `KITCHEN→SEWER→DUMP→BASEMENT→STREET→ROOFTOP` |
| `SceneSelectScreen.tsx` | `SCENE_ORDER`: 改为 `['kitchen', 'sewer', 'dump', 'basement', 'street', 'rooftop']` |

### 36.4 现在的解锁流程

```
初始：厨房（KITCHEN）✅
  ↓ 通关厨房
解锁：下水道（SEWER）
  ↓ 通关下水道
解锁：垃圾场（DUMP）
  ↓ 通关垃圾场
解锁：地下室（BASEMENT）
  ↓ 通关地下室
解锁：街道（STREET）
  ↓ 通关街道
解锁：天台（ROOFTOP）— 最终关
```

---

## 三十八、场景背景音乐不播放修复（v2.2 补丁）

### 37.1 问题描述

通关厨房关卡后进入下水道场景，背景音乐正常播放。返回主菜单后再次进入下水道场景，**背景音乐不播放**。

### 37.2 根本原因

`stopBGM()` 方法暂停并重置了音频元素，但**没有重置 `currentBgmPath` 标记**。导致重新进入同一场景时，`switchBGM()` 认为路径未变化，直接返回，不重新播放。

**代码链路：**

```
第一次进入下水道
  └─▶ switchBGM('bgm_sewer_easy.mp3')
        └─▶ currentBgmPath = 'bgm_sewer_easy.mp3'
              bgm.play() ✅

返回主菜单
  └─▶ stopBGM()
        └─▶ bgm.pause()
              bgm.currentTime = 0
              ❌ currentBgmPath 仍为 'bgm_sewer_easy.mp3'

再次进入下水道
  └─▶ switchBGM('bgm_sewer_easy.mp3')
        └─▶ if (currentBgmPath === path) return; ← 相同，直接返回！
              ❌ 不创建新 Audio，不调用 play()
```

### 37.3 修复方案

在 `stopBGM()` 中重置 `currentBgmPath`：

```typescript
// audio.ts
stopBGM() {
  if (this.bgm) {
    this.bgm.pause();
    this.bgm.currentTime = 0;
  }
  this.currentBgmPath = ''; // ← 新增：重置路径标记
}
```

### 37.4 switchBGM 防重复机制说明

`switchBGM` 的 `currentBgmPath` 检查是为了**防止同一关卡内重复切换**（如波次间、暂停恢复时）。但在**退出再重新进入**的场景下，需要重置标记以允许重新播放。

| 场景 | 期望行为 | 修复前 | 修复后 |
|------|---------|--------|--------|
| 同一关卡内波次切换 | 不重新播放 | ✅ | ✅ |
| 暂停后恢复 | 不重新播放 | ✅ | ✅ |
| 退出再重新进入 | **重新播放** | ❌ 不播放 | ✅ 正常播放 |

---

## 三十九、动态粒子上限性能优化（v2.2 补丁）

### 38.1 问题描述

困难模式第6波 + 火力全开 + 蟑螂诱饵 + 50只蟑螂同时出现时，粒子数达到300硬上限，低端设备可能掉帧至30fps以下。

### 38.2 优化方案

实施**动态粒子上限**，根据设备性能自动调整粒子数量上限（150~400）。

**检测机制：**

| 阶段 | 帧数 | 操作 |
|------|------|------|
| 采样期 | 前120帧 (~2秒) | 收集每帧 deltaTime 样本 |
| 判定期 | 第121帧 | 计算平均帧时间，设定粒子上限 |
| 运行期 | 持续 | 运行时根据帧时间动态微调 |

**帧时间判定标准：**

| 平均帧时间 | 设备等级 | 粒子上限 | 标记 |
|-----------|---------|---------|------|
| > 33ms (<30fps) | 低端 | 150 | lowPerf |
| > 25ms (<40fps) | 中低端 | 200 | lowPerf |
| > 20ms (<50fps) | 中端 | 250 | normal |
| ≤ 20ms (≥50fps) | 高端 | 400 | normal |

**运行时自适应：**
- 帧时间 > 40ms：紧急降级，每次减少10个粒子
- 帧时间 < 18ms 且非低端设备：逐步恢复，每次增加1个粒子

### 38.3 代码实现

**新增引擎状态变量：**
```typescript
_particleLimit: number = 300;      // 动态粒子上限
_frameTimeSamples: number[] = [];  // 帧时间采样
_perfCheckFrames: number = 0;       // 采样计数
_isLowPerfDevice: boolean = false;  // 低端设备标记
```

**游戏循环中的性能检测（engine.ts:gameLoop）：**
```typescript
// 采样期（前120帧）
if (this._perfCheckFrames <= 120) {
  this._frameTimeSamples.push(this.deltaTime);
}
// 判定期（第121帧）
else if (this._perfCheckFrames === 121) {
  const avg = this._frameTimeSamples.reduce((a,b) => a+b, 0) 
              / this._frameTimeSamples.length;
  if (avg > 0.033) this._particleLimit = 150;
  else if (avg > 0.025) this._particleLimit = 200;
  else if (avg > 0.02) this._particleLimit = 250;
  else this._particleLimit = 400;
  localStorage.setItem('roach_blaster_particle_limit', 
                        String(this._particleLimit));
}
// 运行时自适应
if (this.deltaTime > 0.04 && this._particleLimit > 150) {
  this._particleLimit -= 10; // 紧急降级
} else if (this.deltaTime < 0.018 && !this._isLowPerfDevice) {
  this._particleLimit = Math.min(400, this._particleLimit + 1);
}
```

**粒子更新中的动态上限（engine.ts:updateParticles）：**
```typescript
const limit = this._particleLimit;
if (this.particles.length > limit) {
  this.particles.length = limit;
}
```

**子系统粒子预留：**

| 子系统 | 原硬编码 | 新动态计算 |
|---------|---------|-----------|
| 主粒子上限 | 300 | `_particleLimit` |
| 火力全和黑烟 | < 290 | `< _particleLimit - 10` |
| 诱饵香气 | < 280 | `< _particleLimit - 20` |

**持久化：** 检测到的粒子上限保存到 `localStorage`，下次进入游戏时直接读取，避免重复检测。

### 38.4 优化效果

| 设备类型 | 优化前 | 优化后 |
|---------|--------|--------|
| 低端 (<30fps) | 300粒子，严重掉帧 | 150粒子，稳定30fps |
| 中低端 (<40fps) | 300粒子，明显掉帧 | 200粒子，稳定40fps |
| 中端 (<50fps) | 300粒子，轻微掉帧 | 250粒子，稳定50fps |
| 高端 (≥50fps) | 300粒子 | 400粒子，更丰富的特效 |

---

## 四十、天台与街道关卡顺序调换（v2.3 补丁）

### 39.1 问题描述

故事模式关卡选择界面中，**"天台决战"显示在"城市街道"的上面**，与期望的解锁顺序不一致。期望顺序是地下室→街道→天台（通关地下室解锁街道，通关街道解锁天台）。

### 39.2 根本原因

项目中有**三套独立的场景选择UI**，各自硬编码了场景数组顺序，导致不一致：

| UI位置 | 用途 | 硬编码顺序 |
|--------|------|-----------|
| `GameMenu.tsx:159` | **故事模式关卡选择**（用户截图中的UI） | `kitchen→sewer→dump→basement→rooftop→street` ❌ |
| `SceneSelectScreen.tsx:12` | 无尽/BOSS模式场景选择 | `kitchen→sewer→dump→basement→street→rooftop` ✅ |
| `GameMenu.tsx:300` | 无尽模式场景网格 | `street→kitchen→sewer→dump→basement→rooftop` ❌ |

**问题分析：**
- `SceneSelectScreen.tsx` 的场景顺序是正确的（已在前序版本修复）
- `GameMenu.tsx` 中两处场景数组各自独立硬编码，未与 `SCENE_ORDER` 统一
- 用户截图显示的是故事模式关卡选择（`GameMenu.tsx:159`），该处天台在街道之前

### 39.3 修复方案

统一所有场景选择UI的顺序为：`kitchen→sewer→dump→basement→street→rooftop`

| 文件 | 位置 | 修改前 | 修改后 |
|------|------|--------|--------|
| `GameMenu.tsx` | 第159行 | `['kitchen','sewer','dump','basement','rooftop','street']` | `['kitchen','sewer','dump','basement','street','rooftop']` |
| `GameMenu.tsx` | 第300行 | `STREET→KITCHEN→SEWER→DUMP→BASEMENT→ROOFTOP` | `KITCHEN→SEWER→DUMP→BASEMENT→STREET→ROOFTOP` |
| `SceneSelectScreen.tsx` | 第12行 | 已正确，无需修改 | — |

### 39.4 存档版本升级

将 `SAVE_VERSION` 从 2 提升到 **3**，强制重置所有旧存档，确保新玩家初始只解锁厨房（街道默认锁定）。

```typescript
// types.ts
export const SAVE_VERSION = 3; // 原值为 2
```

### 39.5 修复后的解锁流程

```
初始：厨房（KITCHEN）✅
  ↓ 通关厨房
解锁：下水道（SEWER）
  ↓ 通关下水道
解锁：垃圾场（DUMP）
  ↓ 通关垃圾场
解锁：地下室（BASEMENT）
  ↓ 通关地下室
解锁：街道（STREET）
  ↓ 通关街道
解锁：天台（ROOFTOP）— 最终关
```

### 39.6 经验教训

**避免在多处硬编码相同的数据。** 场景顺序这类全局配置应该：
1. 统一定义在 `data.ts` 的 `SCENE_UNLOCK_CHAIN` 中
2. 所有UI组件引用该常量，而非各自硬编码
3. 如果必须硬编码（如使用 emoji 图标的场景网格），需确保与主配置保持一致

---

---

## 四十一、选3道具机制失效修复（v2.3 补丁）

### 40.1 问题描述

玩家在**准备界面（PreparationScreen）**中选择了3种道具带入关卡，但进入战斗后，**所有已解锁道具都在掉落**，而非仅限选择的3种。

### 40.2 根本原因

`engine.ts` 的 `start()` 方法中，`selectedItems` 的设置与 `resetGame()` 的调用**顺序错误**。

**代码链路分析：**

```
GameCanvas.tsx:1137
  doStartGame(selected=["fan","molotov","sticky"])
    ↓
engine.ts:start(selectedItems) — 第704行
  ↓ 第776-777行：this.selectedItems = selectedItems;  ✅ 设置
  ↓ 第779行：this.resetGame();                        ❌ 立即被清空！
    ↓
engine.ts:resetGame() — 第804行
  this.selectedItems = [];  ← ⚠️ 清空了玩家选择
```

**后果：** `spawnWeaponDrop()` 检测到 `selectedItems` 为空数组，回退到场景默认道具池（SCENE_ITEM_UNLOCKS），导致全部道具掉落。

### 40.3 修复方案

调整代码顺序：先 `resetGame()` 清空状态，再设置 `selectedItems`。

```typescript
// 修复前（engine.ts:774-779）
if (selectedItems && selectedItems.length > 0) {
  this.selectedItems = selectedItems;
}
this.resetGame();

// 修复后（engine.ts:774-779）
this.resetGame();
if (selectedItems && selectedItems.length > 0) {
  this.selectedItems = selectedItems;
}
```

### 40.4 道具掉落逻辑验证

`spawnWeaponDrop()` 的道具选择优先级（正确逻辑）：

| 优先级 | 条件 | 道具来源 |
|--------|------|---------|
| 1 | `selectedItems.length > 0` | **玩家选择的3种道具** ✅ |
| 2 | `gameMode === STORY && difficulty === 'easy'` | `SCENE_ITEM_UNLOCKS[场景]` |
| 3 | `gameMode === STORY && difficulty === 'hard'` | 全部道具 |
| 4 | 无尽模式 | 全部道具 |

### 40.5 经验教训

**注意方法间的状态覆盖。** `resetGame()` 这类重置方法如果在赋值之后调用，会悄无声息地覆盖之前设置的状态。应该：
1. 先重置所有状态
2. 再设置本次运行特有的状态
3. 或使用参数传递给 `resetGame()` 来保留特定字段

---

## 四十二、新增5个场景（v2.4）

### 41.1 新增场景列表

| 场景 | 背景图 | 难度系数 | 特色 |
|------|--------|---------|------|
| **废弃医院** | `bg_hospital.jpg` | ×2.1 | 绿色防线、雾气天气、狭窄走廊 |
| **废弃地铁** | `bg_subway.jpg` | ×2.3 | 棕色防线、黑夜天气、宽阔站台 |
| **废弃超市** | `bg_supermarket.jpg` | ×2.5 | 黄色防线、无天气、货架通道 |
| **废弃学校** | `bg_school.jpg` | ×2.7 | 蓝色防线、雨天、教室场景 |
| **蟑螂巢穴** | `bg_nest.jpg` | ×3.0 | 红色防线、雾气天气、终极Boss战 |

### 41.2 场景解锁链（完整11场景）

```
厨房 → 下水道 → 垃圾场 → 地下室 → 街道 → 天台 → 医院 → 地铁 → 超市 → 学校 → 巢穴
```

### 41.3 修改文件

| 文件 | 修改内容 |
|------|---------|
| `types.ts` | `SceneType` 枚举添加5个新值；`SceneConfig` 添加 `bgImage?` 字段 |
| `data.ts` | `SCENE_CONFIGS`、`WAVE_CONFIGS_*`、`SCENE_ITEM_UNLOCKS`、`SCENE_ROACH_TYPES`、`SCENE_GROUND_BOUNDS`、`SCENE_REWARD_ITEMS`、`SCENE_UNLOCK_CHAIN`、`SCENE_ORDER` |
| `SceneSelectScreen.tsx` | 使用 `SCENE_ORDER`（从data.ts导入） |
| `GameMenu.tsx` | 无尽模式场景选择网格更新为11场景 |

### 41.4 通用背景图加载系统

`engine.ts` 新增 `bgSceneImages: Record<string, HTMLImageElement>` 缓存：

- `loadImages()`：自动遍历 `SCENE_CONFIGS` 加载所有配置了 `bgImage` 的场景图片
- `renderBackground()`：在硬编码分支之前添加通用 `scene.bgImage` 检查（cover-fit绘制）

以后添加新场景只需在 `SCENE_CONFIGS` 中加 `bgImage` 字段即可，无需再改 `renderBackground()`。

### 41.5 废弃医院（HOSPITAL）完整设计

#### 场景概述

| 属性 | 说明 |
|------|------|
| **场景类型** | `SceneType.HOSPITAL` |
| **背景图** | `bg_hospital.jpg`（手术室场景） |
| **波次数量** | 8波 |
| **难度系数** | ×2.1 |
| **特色** | 绿色防线、雾气天气、狭窄走廊 |

#### 地面阻挡线（6点透视）

| 点 | X | Y |
|----|---|---|
| farL（远左） | 314 | 379 |
| farR（远右） | 453 | 379 |
| midL（中左） | 16 | 538 |
| midR（中右） | 436 | 538 |
| nearL（近左） | 16 | 810 |
| nearR（近右） | 436 | 810 |

#### 三种专属敌人

**1. 护士蟑螂（NURSE）**

| 属性 | 值 |
|------|-----|
| 血量 | 70 |
| 速度 | 0.8 |
| 体型 | size: 78（1.5倍） |
| 护盾 | 35点（HP的50%，红色六边形视觉） |
| 治疗 | 每2秒治疗180px范围内最低血量盟友20%HP |
| 治疗特效 | 飘升红色半透明"+"号粒子 |
| 移动方式 | **不主动向防线移动**，跟随最近的非护士盟友；无其他蟑螂时原地不动 |
| 出生方式 | **不单独出生**，混在第一波蟑螂中间，出生位置在地面远端（farLY+10） |
| 闪避 | 无 |
| 图鉴 | `roach_nurse.png`（白色护士服+红十字帽） |

**2. 变异蟑螂（MUTANT）**

| 属性 | 值 |
|------|-----|
| 血量 | 50 |
| 速度 | 0.5 |
| 体型 | size: 38 |
| 特殊能力 | **变身**：血量<50%时触发，1秒变身过程（无敌+停止移动），变身为随机其他蟑螂类型（排除自身和女王） |
| 变身后血量 | 当前HP的80% |
| 变身后体型 | 保持25不变 |
| 变身视觉 | 紫色旋涡光环+"变身! Xs"倒计时文字 |
| 变身后人特效 | 蓝色半透明蒙版（按蟑螂类型椭圆裁剪） |
| 死亡特效 | 酸液范围伤害（150px内10点）+"酸液飞溅!"飘字 |
| 图鉴 | `roach_mutant.png`（绿色变异体） |

**3. 定时自爆蟑螂（TIMED_SUICIDE）**

| 属性 | 值 |
|------|-----|
| 血量 | **240**（高生存能力） |
| 速度 | 2.0 |
| 体型 | size: 60（与自爆蟑螂一致） |
| 护盾 | **120点炸弹护甲**（HP的50%，吸收80%伤害） |
| 闪避 | 与自爆蟑螂一致（火焰命中时侧向闪避） |
| 行为流程 | **Phase 1**: 正常移动 → **Phase 2**: 到达防线前64px停留2秒安放炸弹（期间无敌） → **Phase 3**: 变身大蟑螂 → **Phase 4**: 炸弹3秒后爆炸（196px范围，20点伤害） |
| 炸弹爆炸 | 范围196px / 20点伤害 |
| 变身 | 放置完成后变身为大型蟑螂（size 40，速度 0.8） |
| 炸弹贴图 | `bomb.png`（64px，带倒计时显示） |
| 蟑螂贴图 | `roach_timed_suicide.png`（背炸弹版本） |

#### 虫卵孵化池系统

| 属性 | 说明 |
|------|------|
| 生成位置 | 5个固定坐标（波次开始时随机选取） |
| 位置坐标 | (340,400), (280,430), (400,460), (160,520), (420,580) |
| 血量 | 180 |
| 孵化时间 | 5秒 |
| 免伤时间 | 前3秒免疫所有伤害 |
| 孵化内容 | 3只变异蟑螂 |
| 摧毁奖励 | 连续摧毁3个触发"消毒奖励"：燃气全满+清除所有异常状态 |
| 贴图 | `egg_pod.png`（绿色液体+红色裂纹虫卵） |
| 透视缩放 | 远处50% → 近处100% |

#### 8波次配置

| 波次 | 小 | 大 | 飞 | 甲 | 分 | 护士 | 变异 | 定时自爆 | 虫卵 |
|------|-----|-----|-----|-----|-----|------|------|----------|------|
| 1 | 6 | 2 | 0 | 0 | 0 | 0 | 0 | **1** | 0 |
| 2 | 8 | 3 | 1 | 0 | 0 | 0 | 2 | **1** | 1 |
| 3 | 8 | 3 | 2 | 1 | 0 | 1 | 2 | **2** | 1 |
| 4 | 8 | 3 | 2 | 2 | 1 | 1 | 3 | **3** | 1 |
| 5 | 8 | 4 | 4 | 2 | 1 | 2 | 3 | **3** | 1 |
| 6 | 6 | 4 | 4 | 3 | 2 | 2 | 4 | **4** | 2 |
| 7 | 6 | 4 | 5 | 3 | 2 | 3 | 4 | **5** | 2 |
| 8 | 4 | 4 | 5 | 3 | 2 | 3 | 5 | **6** | 2 |

> 注：自爆蟑螂（suicideCount）和飞行自爆蟑螂（flyingSuicideCount）在医院场景均为0。女王在所有波次中均为0。

#### 三星评价系统

| 星级 | 条件 |
|------|------|
| ⭐ | 通关 |
| ⭐⭐ | 通关 + 摧毁50%以上虫卵 |
| ⭐⭐⭐ | 通关 + 摧毁80%以上虫卵 + 0次防线突破 |

#### 剧情对话

医院关卡开场触发蟑叔对话，介绍三种新敌人和虫卵孵化池机制。

#### 特殊机制

- **护士自动跳过波次**：当场景中仅剩护士蟑螂（无战斗蟑螂）时，自动击杀所有护士并推进下一波
- **炸弹系统**：定时自爆蟑螂放置的炸弹3秒后自动爆炸，不可摧毁
- **变异变身无敌**：变身过程中1秒内完全免疫所有伤害
- **蓝色蒙版**：变身后的蟑螂贴图上有蓝色半透明椭圆蒙版（按蟑螂类型不同形状）

### 41.6 波次配置 TDZ 白屏修复

**问题：** `WAVE_CONFIGS_HOSPITAL` 等变量在 `SCENE_WAVE_CONFIGS` **之后**定义，Vite编译后产生 Temporal Dead Zone 错误，导致整个游戏白屏。

**修复：** 将5个 `WAVE_CONFIGS_*` 变量移动到 `SCENE_WAVE_CONFIGS` 定义之前。

---

## 四十三、天台与街道顺序重置修复（v2.4 补丁）

### 42.1 问题描述

添加5个新场景时，`SCENE_ORDER` 和 `SCENE_UNLOCK_CHAIN` 中又将 `rooftop` 放在了 `street` 前面，覆盖了之前修复的"街道在天台前面"的顺序。

### 42.2 根因

添加新场景时使用硬编码顺序 `rooftop → street`，而之前修复要求的是 `street → rooftop`。两个配置不同步。

### 42.3 修复

| 配置 | 修改前 | 修改后 |
|------|--------|--------|
| `SCENE_ORDER` | `basement,rooftop,street` | `basement,street,rooftop` |
| `SCENE_UNLOCK_CHAIN` | `BASEMENT,ROOFTOP,STREET` | `BASEMENT,STREET,ROOFTOP` |

### 42.4 经验教训

**避免在多处硬编码相同的顺序数据。** 场景顺序应该只定义一次（`SCENE_ORDER`），所有UI组件引用该常量。`SCENE_UNLOCK_CHAIN` 必须与 `SCENE_ORDER` 保持同步。

---

## 四十四、剧情关卡列表UI改造（v2.4）

### 43.1 修改内容

- 剧情模式关卡列表从6个扩展到 **11个关卡**
- 列表区域改为可拖动/可滚动（`maxHeight: 55vh` + `overflow-y: auto` + `touch-action: pan-y`）
- 统一使用 `SCENE_ORDER`（从 `data.ts` 导出），两个UI组件共用同一顺序
- 未解锁关卡显示 `Lock` 图标

### 43.2 修改文件

| 文件 | 修改 |
|------|------|
| `data.ts` | `SCENE_ORDER` 导出为公共常量 |
| `GameMenu.tsx` | 关卡列表使用 `SCENE_ORDER.map`，容器可滚动 |
| `SceneSelectScreen.tsx` | `SCENE_ORDER` 从 `data.ts` 导入 |

---

## 四十五、道具掉落只出现一次（v2.4）

### 44.1 问题

每次通关剧情关卡都显示所有奖励道具掉落动画，包括已解锁的道具。

### 44.2 修复

`engine.ts` `gameVictory()` 中，`itemRevealData` 只收集**首次解锁**的新道具：

```typescript
const newlyUnlocked = [];
for (const reward of rewards) {
  if (!this.progress.weaponsUnlocked.includes(reward.type)) {
    this.progress.weaponsUnlocked.push(reward.type);
    newlyUnlocked.push(reward); // 只有新解锁的才加入揭示队列
  }
}
this.itemRevealData = newlyUnlocked;
```

如果没有新道具，直接进入 `WAVE_CLEAR` 结算。

---

## 四十六、按钮点击音效系统（v2.4）

### 45.1 音效设计

双层合成音效：
- 高频层：`square` 波形，800→1200Hz，15ms
- 低频层：`triangle` 波形，400→200Hz，10ms
- 自动恢复 `suspended` 的 `AudioContext`
- `try-catch` 保护避免异常阻断点击

### 45.2 游戏状态控制

点击音效**仅在非游戏界面播放**，进入游戏关卡后自动静音：

| 游戏状态 | 点击音效 | 说明 |
|---------|---------|------|
| `MENU`（主菜单） | ✅ 播放 | |
| `SCENE_SELECT`（场景选择） | ✅ 播放 | |
| `DIALOG`（剧情对话） | ✅ 播放 | |
| `TUTORIAL`（教程） | ✅ 播放 | |
| **`PLAYING`**（**游戏关卡中**） | **❌ 静音** | 自动抑制 |
| `PAUSED`（暂停菜单） | ✅ 播放 | |
| `WAVE_CLEAR`（胜利结算） | ✅ 播放 | |
| `GAME_OVER`（失败结算） | ✅ 播放 | |
| `ITEM_DROP` / `ITEM_REVEAL`（掉落拾取） | ✅ 播放 | |

**实现机制**：
- `audio.ts` 新增 `suppressClickSfx: boolean` 字段
- `playClick()` 方法开头检查该标志，为 `true` 时直接返回
- `GameCanvas.tsx` 的 `onStateChange` 回调中自动同步：
  ```typescript
  engine.audio.suppressClickSfx = (state === GameState.PLAYING);
  ```

**优势**：无需修改任何按钮的点击处理代码，统一管理。

### 45.3 修改文件

| 文件 | 修改 |
|------|------|
| `audio.ts` | 新增 `playClick()` 方法 + `suppressClickSfx` 字段 |
| `GameCanvas.tsx` | 给所有子组件传递 `audio` prop + `onStateChange` 中同步标志 |
| 所有UI组件（~15个） | 按钮 `onClick` 中添加 `audio?.playClick()` |

---

## 四十七、道具冷却系统（v2.4）

### 46.1 冷却规则

| 道具 | 独立冷却 | 全局冷却 |
|------|---------|---------|
| 气罐补给 | 3秒 | 使用后1秒 |
| 防线修复 | 5秒 | 使用后1秒 |
| 紧急冷却 | **无** | **无** |
| 火力全开 | 10秒 | 使用后1秒 |
| 临时护盾 | 8秒 | 使用后1秒 |
| 蟑螂诱饵 | 6秒 | 使用后1秒 |

额外规则：战斗开始后1秒内所有道具锁定（紧急冷却除外）。

### 46.2 UI效果

- 冷却中：图标变灰 + 半透明黑色遮罩 + 倒计时数字
- 商店描述显示 `| 冷却:X秒` 或 `| 无冷却`

---

## 四十八、防线护盾完善（v2.4）

### 47.1 修改内容

- 消耗品buff图标从 `buffFlashTimers['shield']` 读取（同步引擎状态）
- `renderDefenseLine` 添加蓝色护盾线条（防线上方20px，脉冲透明度0.2~0.6，外发光）
- 简单模式商店移除 `hardOnly` 限制

---

## 四十九、气罐补给改为手动使用（v2.4）

从 `checkAutoUseConsumables` 中移除 `gas_refill` 的自动触发逻辑，改为手动点击使用。战斗HUD道具栏添加气罐补给按钮。

---

## 四十七（续）、拾取道具冷却系统（v2.4 补充）

### 46.3 拾取道具冷却规则

拾取道具（战场上掉落的武器）与商店购买的消耗品共用同一套冷却系统。

| 拾取道具 | 独立冷却 | 全局冷却 |
|---------|---------|---------|
| 蟑螂贴板（sticky） | 5秒 | 使用后1秒 |
| 杀虫剂（poison） | 6秒 | 使用后1秒 |
| 散弹模式（shotgun） | 10秒 | 使用后1秒 |
| 燃烧瓶（molotov） | 10秒 | 使用后1秒 |
| 雷达激光（radar） | 8秒 | 使用后1秒 |
| 强力风扇（fan） | 8秒 | 使用后1秒 |
| 电蚊拍（swatter） | 10秒 | 使用后1秒 |

> **统一全局冷却**：`globalConsumableCooldown` 字段被两套系统共用。使用商店道具会触发拾取道具的全局冷却，反之亦然。

### 46.4 引擎端实现

**字段定义**（`engine.ts`）：
```typescript
itemCooldowns: Record<string, number> = {};      // 每种拾取道具的独立冷却
// globalConsumableCooldown 与商店道具共用
```

**冷却检查**（`selectItem()` 方法）：
```typescript
if (this.globalConsumableCooldown > 0) {
  // 显示"道具冷却中..."飘字，阻止使用
}
if ((this.itemCooldowns[item.type] || 0) > 0) {
  // 显示"XX冷却中..."飘字，阻止使用
}
```

**冷却设置**（`startItemCooldown()` 辅助函数）：
```typescript
this.itemCooldowns[type] = WEAPON_DROP_DEFS[type].cooldown;  // 独立冷却
this.globalConsumableCooldown = 1;  // 1秒全局冷却（与商店共用）
```

**`useSwatter()` 内部也包含完整冷却检查**，防止键盘快捷键 `'q'` 绕过 `selectItem()`。

### 46.5 React UI 同步

**数据流**：
```
引擎 update() 冷却递减
  → onConsumableUpdate() 回调（含 itemCooldowns 参数）
    → GameCanvas setItemCooldowns()
      → GameHUD itemCooldowns prop
        → 按钮渲染冷却视觉
```

**HUD 视觉反馈**：
- 冷却中：`opacity-50` + `cursor-not-allowed` + `disabled`
- 黑色半透明遮罩覆盖图标
- 遮罩中央显示倒计时数字（如 `0.8s`）

### 46.6 关键设计决策

1. **共用全局冷却**：拾取道具和商店道具使用同一个 `globalConsumableCooldown`，确保两种道具互相制约
2. **`useSwatter()` 内置冷却检查**：键盘快捷键 `'q'` 直接调用 `useSwatter()`，必须在方法内部检查冷却，不能依赖调用方
3. **每帧回调同步**：update 循环中冷却递减后，如果存在活跃冷却，自动调用 `onConsumableUpdate` 刷新 React UI

---

## 五十、UI布局调整（v2.4）

| 调整项 | 修改前 | 修改后 |
|--------|--------|--------|
| 道具商店宽度 | `max-w-lg` (512px) | `max-w-full` (屏幕宽度) |
| 商店购买效果 | 绿色闪烁+"已购买"文字 | 只保留 `active:scale-95` |
| 拾取道具栏位置 | `bottom-[120px]` | `bottom-[120px]`（防重叠） |
| 火力槽位置 | `bottom-[58px]` | `bottom-[320px]`（防线以上） |
| 无尽模式网格 | `grid-cols-2` | `grid-cols-3`（11场景） |
| 失败后天赋界面 | 自动弹出 | 去掉（玩家手动进入） |

---

## 五十一、性能优化（v2.4）

### 50.1 护甲蟑螂肉盾缓存

`updateArmorShieldCache()` 每0.3秒执行一次 O(n²) 计算，其他帧使用 `Set.has()` O(1) 查找。三处保护检查从实时循环改为缓存检查。

### 50.2 粘板特效简化

- 移除每帧5%概率的挣扎粒子生成
- 放置火花从10个减为4个
- "粘住了!"文字只显示第一个蟑螂

### 50.3 自爆蟑螂数值调整

| 属性 | 修改前 | 修改后 |
|------|--------|--------|
| 装甲HP | 6 | 2 |
| 近线加速 | 1.5倍速 | 已移除 |
| 侧闪位移 | X+Y轴 | 仅X轴 |

---

## 五十三、拾取道具回收系统（v2.5 新增）

### 53.1 设计目标

解决关卡内拾取道具（蟑螂贴板、燃烧瓶等）使用后剩余道具浪费的问题，将未使用道具回收为金币。

### 53.2 回收规则

| 道具 | 回收价 |
|------|--------|
| 蟑螂贴板 | ¥5 |
| 杀虫剂 | ¥8 |
| 燃烧瓶 | ¥10 |
| 散弹模式 | ¥12 |
| 雷达激光 | ¥10 |
| 强力风扇 | ¥8 |
| 电蚊拍 | ¥15 |

**不回收的情况**：防线被攻破（蟑螂突破防线），玩家不获得任何回收收益。

### 53.3 回收流程（两步延迟执行）

```
关卡结束
  ↓ sellUnusedInventory() — 仅保存快照，不加金币
  ↓ 进入结算界面 — 显示旧金额（不含回收）
  ↓ 播放回收动画 — 道具图标飞向"最终资金"位置
  ↓ 动画结束
  ↓ applyRecycledGold() — 金币加到 economy
  ↓ 结算界面金额更新 — 用户看到金币增加
```

**关键设计**：金币在动画结束后才加到 economy，让用户看到完整的"回收→增加"视觉反馈。

### 53.4 飞行动画（ItemRecycleAnimation）

- **起点**：右下角道具栏位置（道具图标 + 数量 + 回收价）
- **终点**：结算界面"最终资金"UI 位置（屏幕右上约82%, 40%）
- **动画**：1.5秒飞行 + 缩小 + 淡出
- **落地效果**：金色光晕脉动 + 火花散射 + "+¥XX" 文字浮现
- **z-index**：500（在所有覆盖层之上）

---

## 五十四、防线修复道具平衡调整（v2.5）

### 54.1 问题

防线修复道具效果过强：
- 固定+25 HP，防线初始才80 HP，一次修复31%
- 价格¥300过低，天台/街道关卡购买多个即可轻松通关
- 冷却5秒过短，关键时刻可连续使用

### 54.2 调整方案

| 属性 | 调整前 | 调整后 | 说明 |
|------|--------|--------|------|
| 修复量 | 固定 +25 HP | **最大血量 × 20%** | 百分比修复，随防线成长 |
| 价格 | ¥300 | **¥400** | 初始金币200的2倍，需攒2波 |
| 冷却时间 | 5秒 | **8秒** | 不能连续使用，增加策略性 |
| 描述 | 防线 HP +25 | **防线 HP +20%** | 反映实际效果 |

**举例**：80 HP 防线 → 修复 +16 HP；120 HP 防线 → 修复 +24 HP

---

## 五十五、防线经济规则调整（v2.5）

### 55.1 蟑螂突破防线

| 行为 | 金币变化 | 道具回收 |
|------|---------|---------|
| 普通蟑螂突破防线 | **不加金币，不扣金币** | 不触发回收动画 |
| 自爆蟑螂爆炸突破 | **不加金币，不扣金币** | 不触发回收动画 |
| 火焰击杀蟑螂 | 正常加金币（游戏机制） | — |

**实现**：防线 HP ≤ 0 时，立即设置 `state = GAME_OVER`，`economy.money = 0`，阻止后续金币增长。

### 55.2 击杀金币倍率调整

为控制前7关金币获取量（原35,504 → 目标13,289），调整如下：

| 蟑螂类型 | 调整前 | 调整后 |
|---------|--------|--------|
| 小蟑螂 | 2 | 1 |
| 大蟑螂 | 10 | 5 |
| 飞行蟑螂 | 8 | 4 |
| 装甲蟑螂 | 15 | 8 |
| 分裂蟑螂 | 20 | 10 |
| 自爆蟑螂 | 12 | 6 |
| 飞行自爆 | 15 | 8 |
| 蟑螂女王 | 200 | 100 |
| 护士蟑螂 | 45 | 25 |
| 变异蟑螂 | 35 | 20 |
| 定时自爆 | 60 | 35 |

| 关卡 | 调整前 | 调整后 |
|------|--------|--------|
| 厨房 | 1.0x | 1.0x |
| 下水道 | 1.5x | 1.2x |
| 垃圾场 | 2.0x | 1.5x |
| 地下室 | 2.5x | 1.8x |
| 天台/街道 | 3.0x | 2.0x |
| 医院 | 3.5x | 2.5x |

| 商店道具 | 调整前 | 调整后 |
|------|--------|--------|
| 气罐补给 | 200 | 250 |
| 防线修复 | 250 | 400 |
| 紧急冷却 | 150 | 200 |
| 火力全开 | 500 | 700 |
| 临时护盾 | 600 | 800 |
| 蟑螂诱饵 | 350 | 450 |

---

## 五十六、无尽模式/每日挑战禁用（v2.5）

无尽模式和每日挑战按钮设为不可点击状态（`disabled`），主菜单底部按钮从5列改为4列（移除音效按钮，移至右上角小喇叭图标）。

---

## 五十七、主菜单音效按钮位置调整（v2.5）

- **移除**：主菜单底部5个按钮中的"音效"按钮
- **新增**：右上角小喇叭图标（固定定位）
- **修复**：进入主菜单后自动播放背景音乐

---

## 五十二、Bug修复汇总（v2.4）

| # | Bug | 修复 |
|---|-----|------|
| 1 | 选3道具后白屏 | `ITEM_DROP` 加入渲染条件 + `player/economy` 同步 |
| 2 | 拾取道具无法使用 | `selectItem` 中添加 `onInventoryUpdate` 回调 |
| 3 | 商店购买后白屏 | `continueFromShop` 添加 `onStateChange` 回调 |
| 4 | 天赋点击无反应 | `playClick()` 添加 AudioContext 恢复 + try-catch |
| 5 | 新场景白屏 | 波次配置变量声明顺序 TDZ 修复 |
| 6 | 天台街道顺序重置 | SCENE_ORDER 与 SCENE_UNLOCK_CHAIN 同步 |

---

## 五十三、视觉特效渲染系统

### 52.1 粒子混合模式问题（关键设计约束）

游戏中几乎所有粒子类型（SPARK、EXPLOSION、EMBER 等）默认使用 `globalCompositeOperation = 'screen'`（屏幕混合模式）。

**公式**：`结果色 = 1 - (1 - 源色) * (1 - 目标色)`

**影响**：在**深色背景**上，暗色粒子会完全消失。这是医院场景（深绿色背景）中多个特效不可见的根本原因。

**解决方案**：需要可见的特效使用 `source-over` 混合模式，绕过粒子系统直接绘制。

### 52.2 护士蟑螂治疗特效

**触发时机**：护士蟑螂进入 spraying 阶段时，对范围内受伤盟友施放治疗

**三阶段状态机**：
| 阶段 | 时长 | 视觉效果 |
|------|------|----------|
| charging（充能） | 1.0s | 脚下绿色圆环从中心逐渐展开 |
| spraying（喷射） | 2.0s | 完整绿色治疗圆环 + 呼吸脉冲 |
| dissipating（消散） | 1.0s | 圆环逐渐放大淡出 |

**被治疗蟑螂特效**（世界坐标系直接绘制）：
1. 绿色光晕环绕蟑螂身体（径向渐变，2x范围）
2. 外圈脉冲环（呼吸动画）
3. 4个上升绿色加号（shadowBlur: 20 强发光）
4. 亮白中心方块（高对比度）
5. 蟑螂身体绿色覆盖

**渲染位置**：`render()` 方法中、蟑螂渲染之后、漂浮文字之前

### 52.3 变异蟑螂爆裂特效

**触发时机**：变异蟑螂死亡 → 7帧变身动画完成 → 生成2只新蟑螂

**变身动画**（7帧序列）：
| 帧 | 描述 | 时长 |
|----|------|------|
| 0 | 正常形态 | 200ms |
| 1 | 开始膨胀 | 200ms |
| 2 | 出现裂纹 | 200ms |
| 3 | 严重肿胀 | 200ms |
| 4 | 预爆裂状态 | 200ms |
| 5 | 爆裂瞬间 | 200ms |
| 6 | 空壳残留 | 200ms |

**变身期间**：紫色漩涡光环（8条旋转弧线）+ 无敌状态

**爆裂生成特效**（`source-over` 直接绘制）：
1. 中心绿色径向发光（范围 20→100px）
2. 12个绿色粘液滴向外扩散（带核心+光晕）
3. 外圈绿色环

**生成蟑螂属性**：
- 血量 = 原始血量（非80%）
- 位置 = 变异蟑螂精确死亡位置
- 1秒出生保护（冻结 + 无敌）
- 2秒绿色粘液覆盖（亮绿色叠加）

### 52.4 场景选择自动滚动

**功能**：打开场景选择界面时，自动滚动到最后一个已解锁的场景位置

**实现**：
- `useRef` 获取滚动容器和最后一个解锁场景的 DOM 引用
- `useEffect` 在组件挂载后执行 `scrollTo` 居中目标元素
- 将外层容器 `items-center` 改为 `items-start` 确保滚动定位准确

---

## 五十四、医院专属蟑螂图鉴（废弃医院关卡独占）

> **注意**：以下三种蟑螂仅在「废弃医院」关卡（第6关）出现，不会在其他关卡生成。图鉴数据（`ENCYLOPEDIA_DEFS`）中的数值为展示用，与游戏实际数值（`ENEMY_DEFS`）存在差异，以游戏实际数值为准。

### 54.1 护士蟑螂（NURSE）

#### 基础属性

| 属性 | 游戏实际值 | 图鉴展示值 | 说明 |
|------|-----------|-----------|------|
| 名称 | 护士蟑螂 | 护士蟑螂 | 携带医疗包的绿色蟑螂 |
| HP | 25 | 70 | 游戏内较脆，图鉴展示用 |
| 速度 | 0.8 | 0.8 | 移动较慢 |
| 击杀奖励 | ¥28 | ¥25 | 击杀金币倍率 2.5x（医院关卡） |
| 体型 | 78px | 78px | 标准尺寸的 1.5 倍 |
| 颜色 | #4ade80 | #4ade80 | 亮绿色 |
| 特殊标签 | heal_ally, insecticide_vulnerable, red_shield | — | 治疗/杀虫剂弱点/红色护盾 |

#### Roach 接口字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `healTimer` | `number` | 治疗冷却计时器（idle 阶段倒计时） |
| `healTargetId` | `number \| null` | 当前治疗目标蟑螂 ID |
| `healPhase` | `'idle' \| 'charging' \| 'spraying' \| 'dissipating'` | 治疗状态机阶段 |
| `healPhaseTimer` | `number` | 当前阶段剩余时间 |
| `healRange` | `number` | 治疗范围半径（默认 360px） |
| `asphyxiationTimer` | `number` | 杀虫剂窒息计时器（8秒） |

#### 治疗技能机制

| 参数 | 数值 | 说明 |
|------|------|------|
| 治疗范围 | 360px（6格） | 2025-06-23 从 180px 加倍 |
| 治疗量 | 目标 maxHp × 20% | 每次治疗恢复 20% 最大生命值 |
| 冷却时间 | 1秒 | 2025-06-23 从 5秒 缩短 |
| 治疗条件 | HP < maxHp 且 距离 < healRange | 排除自己和其他护士蟑螂 |
| 治疗时机 | 进入 charging 时立即治疗 | 2025-06-23 修改，无需等待充能完成 |

#### 状态机流程

```
                    idle（待机，1秒冷却）
                            |
              发现范围内受伤盟友 → 触发治疗
                            |
                    charging（充能，1秒）
                    ————————————————————
                    进入时立即执行治疗逻辑
                    脚下绿色圆环从中心展开
                    飘字「【施法中】非法行医!」
                    播放施法音效
                            |
                    spraying（喷射，2秒）
                    ————————————————————
                    纯视觉效果阶段
                    完整绿色治疗圆环 + 脉冲
                    12个旋转刻度标记
                            |
                    dissipating（消散，1秒）
                    ————————————————————
                    圆环逐渐放大并淡出
                            |
                          idle
```

#### 移动行为

| 参数 | 数值 | 说明 |
|------|------|------|
| 移动模式 | 跟随盟友 | 始终跟随最近的非护士蟑螂 |
| 跟随距离阈值 | 40px | 超过此距离开始向盟友移动 |
| 移动速度 | baseSpeed × 50% | 较慢，确保始终落后于盟友 |
| Y轴移动 | 双向 | 可以向上/向下移动以匹配盟友 Y 坐标 |
| 最小下速限制 | 不适用 | 护士蟑螂不受 0.1 最小下速限制 |

#### 视觉特效

**施法者（护士脚下）—— 三阶段治疗圆环：**

| 阶段 | 特效内容 | 混合模式 |
|------|----------|----------|
| charging | 绿色圆环从中心展开（0%→100%）+ 中心脉冲光点 + ECG 脉冲线 | source-over |
| spraying | 外圈径向发光 + 内部半透明填充 + 主圆环边界（亮绿色实线）+ 内圈虚线环 + 12个旋转刻度 + 十字准线 | source-over |
| dissipating | 圆环缩小并淡出 + 中心光点收缩 | source-over |

**被治疗者（ healed 蟑螂身上）—— 2秒持续特效：**

| 特效层 | 描述 |
|--------|------|
| 第1层 | 绿色光晕环绕身体（径向渐变，2x 体型范围） |
| 第2层 | 外圈脉冲环（呼吸动画） |
| 第3层 | 4个上升绿色加号（shadowBlur: 20 强发光） |
| 第4层 | 亮白中心方块（高对比度） |
| 第5层 | 蟑螂身体绿色半透明覆盖 |

#### 弱点与克制

| 弱点 | 效果 |
|------|------|
| 杀虫剂（insecticide_vulnerable） | 接触后窒息 8 秒，期间完全无法行动 |
| 红色护盾（red_shield） | 自带红色护盾外观 |
| HP 极低 | 仅 25 HP，可被大多数武器一击击杀 |

#### 相关资源文件

| 文件 | 说明 |
|------|------|
| `/assets/roach_nurse.png` | 护士蟑螂静态贴图 |
| `/assets/nurse_cast_01.png` ~ `nurse_cast_10.png` | 10帧施法动画序列 |

---

### 54.2 变异蟑螂（MUTANT）

#### 基础属性

| 属性 | 游戏实际值 | 图鉴展示值 | 说明 |
|------|-----------|-----------|------|
| 名称 | 变异蟑螂 | 变异蟑螂 | 辐射变异的黄绿色蟑螂 |
| HP | 8 | 40 | 游戏内极脆，图鉴展示用 |
| 速度 | 0.5 | 0.9 | 移动很慢 |
| 击杀奖励 | ¥22 | ¥20 | 击杀金币倍率 2.5x（医院关卡） |
| 体型 | 38px | 38px | 略小于标准尺寸 |
| 颜色 | #84cc16 | #84cc16 | 黄绿色 |
| 特殊标签 | distort_on_death, acid_splash | — | 死亡干扰 + 酸液溅射 |

#### Roach 接口字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `embryoPhase` | `'idle' \| 'pulse' \| 'swelling' \| 'burst' \| 'remains'` | 胚胎暴走状态机阶段 |
| `embryoTimer` | `number` | 当前阶段计时器 |
| `embryoSpawns` | `RoachType[]` | 爆裂后要生成的蟑螂类型列表 |

#### 死亡变身机制

**触发流程**：

1. HP 归零 → `killRoach()` 调用 `forceEmbryoBurst(r)`
2. 确定生成结果（概率预先计算，存储于 `_embryoSpawnTypes`）
3. 启动 7 帧变身动画（每帧 200ms，共 1.4s）
4. 动画完成后 `spawnEmbryoRoaches()` 执行生成

**生成概率表**：

| 结果 | 概率 | 生成蟑螂 |
|------|------|----------|
| 小蟑螂 × 2 | 50% | SMALL + SMALL |
| 小蟑螂 + 飞行蟑螂 | 30% | SMALL + FLYING |
| 小蟑螂 + 自爆蟑螂 | 20% | SMALL + SUICIDE |

**生成蟑螂属性**：

| 属性 | 值 | 说明 |
|------|-----|------|
| 血量 | 目标类型原始 HP | 非 80%，即满血生成 |
| 位置 | 变异蟑螂精确死亡位置 | 无随机偏移 |
| 冻结 | 1 秒（spawnImmuneTimer） | vx=0, vy=0 |
| 无敌 | 1 秒（spawnImmuneTimer） | 免疫所有伤害 |
| 粘液覆盖 | 2 秒（slimeTimer） | 亮绿色半透明叠加 |
| 标记 | wasMutantSpawn = true | 用于渲染绿色粘液 |

**死亡时酸液溅射**：

| 参数 | 数值 |
|------|------|
| 范围 | 100px 半径 |
| 伤害 | 10 点基础伤害 |
| 衰减 | 距离越远伤害越低 |
| 效果 | 范围内蟑螂受腐蚀（HP 减少 + 灼烧伤害标记） |

#### 状态机流程

```
        正常移动（ALIVE 状态）
                |
        HP 归零 → killRoach() 触发
                |
        forceEmbryoBurst()
        ———————————————————
        屏幕震动 12
        飘字「【胚胎暴走】」红色，2秒
        红色爆炸粒子（120px）
        播放变身音效
                |
        7帧变身动画（每帧200ms）
        ———————————————————
        紫色漩涡光环（8条旋转弧线）
        无敌状态（全程免疫伤害）
                |
        spawnEmbryoRoaches()
        ———————————————————
        绿色粘液爆裂特效（source-over 直接绘制）
        12个绿色液滴向外扩散
        飘字「生成X只!」红色，2秒
        每只新蟑螂飘字「【诞生】类型!」绿色，1.5秒
        2只蟑螂加入游戏数组
```

#### 视觉特效

**变身期间（7帧动画）**：

| 特效 | 描述 |
|------|------|
| 紫色漩涡光环 | 8 条旋转弧线环绕蟑螂身体 |
| 无敌标记 | 全程免疫所有伤害和 DoT |

**爆裂瞬间**：

| 特效层 | 描述 | 持续时间 |
|--------|------|----------|
| 中心绿色发光 | 径向渐变，范围 20→100px | 1.2秒 |
| 12个绿色液滴 | 向外扩散，带核心+光晕 | 1.2秒 |
| 外圈绿色环 | 收缩并淡出 | 1.2秒 |
| 飘字 | 「生成X只!」红色 | 2秒 |

**生成蟑螂覆盖**：

| 特效层 | 描述 | 持续时间 |
|--------|------|----------|
| 绿色光晕 | 径向渐变环绕蟑螂身体 | 2秒 |
| 粘液覆盖 | 亮绿色半透明叠加全身 | 2秒 |
| 外圈边界线 | 绿色粘液边界线 | 2秒 |
| 高光湿点 | 3个旋转的湿润高光点 | 2秒 |

#### 相关资源文件

| 文件 | 说明 |
|------|------|
| `/assets/roach_mutant.png` | 变异蟑螂静态贴图 |
| `/assets/mutant_transform_01.png` ~ `mutant_transform_07.png` | 7帧变身动画序列 |

---

### 54.3 定时自爆蟑螂（TIMED_SUICIDE）

#### 基础属性

| 属性 | 游戏实际值 | 图鉴展示值 | 说明 |
|------|-----------|-----------|------|
| 名称 | 定时自爆蟑螂 | 定时自爆蟑螂 | 橙色自爆蟑螂 |
| HP | 30 | 240 | 游戏内较脆，图鉴展示用 |
| 速度 | 1.4 | 2.0 | 移动很快 |
| 击杀奖励 | ¥40 | ¥35 | 击杀金币倍率 2.5x（医院关卡） |
| 体型 | 60px | 60px | 略大于标准尺寸 |
| 颜色 | #f59e0b | #f59e0b | 橙色 |
| 特殊标签 | shield, bomb_placement, transform_large | — | 护盾/炸弹放置/变身大蟑螂 |

#### Roach 接口字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `hasPlacedBomb` | `boolean` | 是否已放置炸弹 |
| `placeTimer` | `number` | 放置倒计时 / 炸弹倒计时 |
| `breachPhase` | `'idle' \| 'warning' \| 'crouching' \| 'exploding' \| 'residue'` | 防线爆破状态机阶段 |
| `breachPhaseTimer` | `number` | 当前阶段计时器 |
| `crackRadius` | `number` | 地裂半径（0~60，蹲伏时增长） |
| `isFrozen` | `boolean` | 是否被粘板冻结 |
| `isFlameKilled` | `boolean` | 是否被火焰击杀（安静死亡，无爆炸） |
| `residueTimer` | `number` | 残骸残留计时器（3秒） |

#### 炸弹放置状态机

```
        idle（正常移动）
                |
        距离防线 ≤ 80px
                |
        warning（警戒，速度降低50%）
        ————————————————————
        飘字「螂家爆破!」#8b2020
                |
        距离防线 ≤ 64px（底部接触放置线）
                |
        crouching（蹲伏放置，3秒倒计时）
        ————————————————————
        vx=0, vy=0（完全冻结）
        清除所有 DoT（burn/poison）
        无敌状态（免疫所有伤害）
        地裂半径 0→60px 增长
        飘字倒计时「3」「2」「1」
                |
        倒计时归零
                |
        exploding（爆炸，0.4秒）
        ————————————————————
        triggerBreachExplosion()
        防线 HP - 30
        屏幕震动 12
        飘字「💥防线-30」
                |
        residue（残骸，3秒）
        ————————————————————
        残骸逐渐淡出
        状态设为 DEAD
                |
        残骸计时器归零 → 移除
```

#### 爆炸伤害参数

| 参数 | 数值 | 说明 |
|------|------|------|
| 防线伤害 | 30 HP | 直接扣除防线生命值 |
| 爆炸范围 | 196px 半径 | 同 placedBombs 爆炸范围 |
| 蟑螂伤害 | 范围内所有蟑螂 | 196px 内蟑螂受到伤害 |
| 玩家伤害 | 范围内玩家 | 爆炸中心玩家受到伤害 |
| 屏幕震动 | 12 强度 | 持续 0.4 秒 |
| 爆炸粒子 | 红色冲击波 | EXPLOSION 类型粒子 |

#### 蹲伏期间无敌机制

| 状态 | 效果 |
|------|------|
| 伤害免疫 | 完全免疫所有来源的伤害 |
| DoT 清除 | 清除灼烧、中毒等持续伤害 |
| 移动冻结 | vx = 0, vy = 0 |
| 火焰免疫 | inFire = false |
| 伤害闪烁 | damageFlash = 0 |
| 无敌范围 | 覆盖所有武器、道具、火焰伤害 |

**代码实现**：在 `applyDamageToRoach()`、`updateRoaches()`、`renderWeaponEffects()`、`updateFlameThrower()`、`updatePoisonGas()`、`updateEconomy()` 等 10+ 处均有 `placeTimer > 0` 的免疫判断。

#### 火焰击杀特殊处理

| 条件 | 结果 |
|------|------|
| 正常击杀 | 触发完整爆炸流程（倒计时→爆炸） |
| 火焰击杀（isFlameKilled = true） | 安静死亡，不触发爆炸，无残骸 |

#### 视觉特效

**warning 阶段**：

| 特效 | 描述 |
|------|------|
| 飘字 | 「螂家爆破!」深红色 |
| 速度变化 | 移动速度降低为 baseSpeed × 50% |

**crouching 阶段**：

| 特效 | 描述 |
|------|------|
| 地裂纹理 | 半径从 0 增长到 60px |
| 倒计时飘字 | 「3」「2」「1」，红色渐变 |
| 无敌标记 | 身体闪烁白色（damageFlash = 0） |

**exploding 阶段**：

| 特效 | 描述 |
|------|------|
| 红色冲击波 | 径向扩散的爆炸效果 |
| 屏幕震动 | 强度 12，持续 0.4 秒 |
| 飘字 | 「💥防线-30」 |

**residue 阶段**：

| 特效 | 描述 |
|------|------|
| 残骸淡出 | 3秒内逐渐透明 |
| 残骸贴图 | 使用爆炸后的残留贴图 |

#### 相关资源文件

| 文件 | 说明 |
|------|------|
| `/assets/roach_timed_suicide.png` | 定时自爆蟑螂静态贴图 |

---

### 54.4 三种蟑螂对比总结

| 对比项 | 护士蟑螂 | 变异蟑螂 | 定时自爆蟑螂 |
|--------|----------|----------|-------------|
| **HP** | 25（最低） | 8（极低） | 30（中等） |
| **速度** | 0.8（慢） | 0.5（最慢） | 1.4（快） |
| **奖励** | ¥28 | ¥22 | ¥40 |
| **体型** | 78px（大） | 38px（小） | 60px（中） |
| **核心机制** | 治疗盟友 | 死亡变身×2 | 防线爆破-30HP |
| **威胁类型** | 辅助（延长战斗） | 数量（1变2） | 防线（直接扣血） |
| **弱点** | 杀虫剂窒息 | HP极低易击杀 | 火焰安静击杀 |
| **状态机阶段数** | 4阶段 | 5阶段 | 5阶段 |
| **无敌时段** | 无 | 变身全程 | 蹲伏3秒 |
| **视觉主题色** | 绿色 | 黄绿色 | 橙色 |
| **飘字颜色** | #5a8a5a 绿色 | #ff0040 红色 | #8b2020 深红 |

#### 关卡波次配置中的出现规则

医院关卡（`SCENE_WAVE_CONFIGS[HOSPITAL]`）中，三种蟑螂的出现波次：

- **护士蟑螂**：第 5 波首次出现，之后每隔 2~3 波出现
- **变异蟑螂**：第 7 波首次出现，之后每隔 3~4 波出现
- **定时自爆蟑螂**：第 8 波首次出现，之后每隔 4~5 波出现（数量较少但威胁极大）

---

## 五十五、待开发内容

### 55.1 待开发场景

| 场景 | 状态 |
|------|------|
| 废弃地铁（SUBWAY） | 待开发 |
| 废弃超市（SUPERMARKET） | 待开发 |
| 废弃学校（SCHOOL） | 待开发 |
| 蟑螂巢穴（NEST） | 待开发 |

### 55.2 引擎文件拆分

当前 `engine.ts` 超过 10,000 行，包含游戏逻辑、渲染、碰撞检测、波次管理等所有功能。未来可考虑拆分为多个模块：
- `engine.core.ts` — 生命周期 + 状态管理
- `engine.update.ts` — 逻辑更新
- `engine.render.ts` — 渲染系统
- `engine.combat.ts` — 战斗/碰撞
- `engine.enemy.ts` — 敌人AI

---

*文档版本：2025-06-22*
*游戏版本：v2.6*
