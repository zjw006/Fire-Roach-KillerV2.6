# PROJECT STATE - Cockroach Defense (蟑螂射击塔防)

## 1. 项目概览

- **项目名称**: 烈焰除蟑：火线守卫
- **项目路径**: `/mnt/agents/output/app`
- **技术栈**: React 18 + Vite + TypeScript + Tailwind CSS + HTML5 Canvas
- **游戏类型**: 2D射击塔防（竖屏，Canvas渲染）
- **总代码量**: ~13,000行（engine.ts 6,965行为核心）
- **部署地址**: https://xynlqlijlidpg.ok.kimi.link

## 2. 文件结构

```
/mnt/agents/output/app/
├── public/assets/              # 游戏资源（图片/音效/视频）
│   ├── bg.jpg                  # 厨房场景背景
│   ├── bg_*.jpg                # 各场景背景（sewer/dump/rooftop/street/basement）
│   ├── roach.png               # 基础蟑螂
│   ├── roach_armored.png       # 护甲蟑螂
│   ├── roach_flying.png        # 飞行蟑螂
│   ├── roach_flying_suicide.png # 飞行自爆蟑螂（用户上传）
│   ├── roach_suicide.png       # 自爆蟑螂
│   ├── roach_queen.png         # 女王蟑螂
│   ├── roach_splitting.png     # 分裂蟑螂
│   ├── fan.png                 # 风扇道具图标（用户上传，256x256）
│   ├── item_swatter.png        # 电蚊拍道具图标（用户上传）
│   ├── item_*.png              # 其他道具图标
│   ├── gun.png                 # 武器图标
│   ├── boss_p1/p2/p3.png      # Boss三阶段贴图
│   ├── bgm.mp3                 # 背景音乐
│   └── sfx_*.mp3              # 音效文件
├── src/
│   ├── game/
│   │   ├── engine.ts           # 游戏主引擎（6,965行，包含所有游戏逻辑）
│   │   ├── types.ts            # 类型定义（539行，所有接口/枚举/类型）
│   │   ├── data.ts             # 游戏配置数据（723行，敌人定义/场景/波次）
│   │   ├── audio.ts            # 音频管理器（731行）
│   │   ├── vibration.ts        # 震动反馈（95行）
│   │   ├── comicData.ts        # 漫画数据（228行）
│   │   └── bossAnimation.ts    # Boss动画数据（57行）
│   ├── components/game/
│   │   ├── GameCanvas.tsx       # 主游戏画布组件（794行）
│   │   ├── GameHUD.tsx          # HUD界面（296行）
│   │   ├── GameMenu.tsx         # 游戏菜单（428行）
│   │   ├── TitleScreen.tsx      # 标题画面（379行）
│   │   ├── ShopScreen.tsx       # 商店/结算界面（131行）
│   │   ├── ItemRevealScreen.tsx # 道具介绍界面（178行）
│   │   ├── GameOverScreen.tsx   # 游戏结束画面（187行）
│   │   ├── PauseScreen.tsx      # 暂停画面（44行）
│   │   ├── DialogScreen.tsx     # 对话系统（250行）
│   │   ├── ComicViewer.tsx      # 漫画查看器（444行）
│   │   ├── EncyclopediaScreen.tsx # 图鉴（321行）
│   │   ├── SceneSelectScreen.tsx # 场景选择（110行）
│   │   ├── TalentTreeScreen.tsx # 天赋树（193行）
│   │   └── AchievementsScreen.tsx # 成就系统（166行）
│   ├── App.tsx                 # 根组件
│   └── main.tsx                # 入口文件
├── PROJECT_STATE.md            # 本文档
└── package.json
```

## 3. 已实现功能（全部已完成✅）

### 3.1 核心玩法
- 竖屏Canvas射击，玩家控制火焰喷射器
- 6种场景：厨房→下水道→垃圾场→地下室→屋顶→街道（无尽）
- 关卡模式和无尽模式
- 波次系统，每场景6波
- 防线HP系统（80基础值，天赋可加成）
- 经济系统（击杀获得资金，关卡间商店升级）
- 天赋树系统
- 成就系统
- 存档/读档（localStorage）
- 漫画+对话叙事系统

### 3.2 武器系统

| 武器 | 描述 | 状态 |
|------|------|------|
| 火焰喷射器 | 基础武器，扇形火焰，过热机制 | ✅ |
| 毒液喷射 | 绿色毒液，持续伤害 | ✅ |
| 霰弹模式 | 三管齐发，扇面扫射 | ✅ |
| 莫洛托夫 | 投掷火瓶，区域燃烧 | ✅ |
| 冰冻弹 | 减速效果 | ✅ |
| 粘板/毒液/燃烧瓶 | 可放置道具 | ✅ |

### 3.3 特殊道具（用户自定义开发）

| 道具 | 效果 | 获取方式 |
|------|------|----------|
| **强力风扇** | 全屏减速50%，有护甲蟑螂免疫回退 | 通关厨房场景解锁 |
| **燃烧瓶** | 火墙效果 | 通关下水道解锁 |
| **散弹模式** | 三管齐发 | 通关垃圾场解锁 |
| **雷达激光** | 自动瞄准最近目标，伤害10，5发，间隔0.3s | 通关地下室解锁 |
| **电蚊拍** | 全屏攻击，护甲破除+减速80%（5秒），消耗道具 | 通关屋顶解锁，用户上传图标 |

#### 雷达激光详细规则
- 伤害=10（狙击枪定位）
- 5发弹药，间隔0.3s
- 自动瞄准离防线最近的蟑螂
- 遇到有护甲的蟑螂：跳过并继续寻找下一个目标
- 优先攻击无护甲目标

#### 电蚊拍详细规则
- 全屏范围攻击（无距离限制）
- 立即破坏目标护甲
- 减速80%持续5秒
- 消耗型道具（拾取获得，用完消失）
- 关卡模式：DUMP场景后首次掉落
- 无尽模式：同等概率掉落

### 3.4 敌人系统

#### 敌人类型

| 类型 | HP | 速度 | 特殊能力 | 护甲 |
|------|-----|------|----------|------|
| 普通蟑螂 | 3 | 0.8-1.2 | 无 | 无 |
| 大型蟑螂 | 8 | 0.6-0.9 | 无 | 无 |
| 飞行蟑螂 | 4 | 1.5 | 飞行（altitude 0.3-0.6） | 无 |
| **飞行自爆蟑螂** | **2** | **3.0** | **飞行+自爆，爆炸音效** | **固定5（无尽30%概率+2）** |
| 护甲蟑螂 | 12-21 | 0.5-0.8 | 蓝色六边形护盾 | HP×1.0×难度 |
| 分裂蟑螂 | 6 | 0.9 | 死亡分裂为2只小蟑螂 | 无 |
| 自爆蟑螂 | 5 | 1.8 | 接近防线自爆 | 固定6（无尽30%概率+3） |
| 女王蟑螂 | 25 | 0.3 | 高血量，召唤小怪 | 无 |

#### 护甲系统详细规则
1. 护甲以 `armorHp` buff形式存在，非独立实体
2. 护甲HP翻倍（自爆固定6→12，飞行自爆固定5→10）
3. **护盾特效**：蓝色六边形护盾在蟑螂周围，破甲前消失
4. **受击反应**：有护甲时**没有任何被攻击的动作反应**（无闪烁/后退）
5. **武器克制**：
   - 喷雾/粘板/激光：对有护甲蟑螂**完全无效**（激光会跳过寻找下一个目标）
   - 喷火：80%伤害被护甲吸收，20%穿透
   - 风扇：有护甲蟑螂**免疫**回退效果
   - 电蚊拍：**全额伤害+立即破甲+减速80%**
6. **肉盾挡火**：有护甲蟑螂在火焰区域内会保护身后蟑螂（其他蟑螂只受20%伤害）
7. **喷火无停顿**：有护甲蟑螂被喷火时不会停顿

#### 飞行自爆蟑螂特殊规则
- 速度3.0（普通飞行蟑螂2倍）
- 护甲固定5（无尽模式30%概率额外+2）
- 护甲HP翻倍后实际为10（或14）
- 有自爆倒计时（fuseTimer）
- 接近防线时爆炸（suicideExplode）
- 使用自爆蟑螂同款爆炸音效
- 全模式出现（关卡+无尽）
- 飞行高度系统（altitude 0.3-0.6）

### 3.5 BOSS战系统

#### 当前状态
- 所有旧战斗逻辑已清除
- 保留基础框架：HP显示、召唤系统、对话系统
- **待开发**：4波虫卵系统完整实现

#### 已保留框架
- 4层HP条UI
- Boss对话→逃跑动画序列
- 虫卵（EggPod）生成/孵化基础设施
- 波次清除检测
- Boss受击反馈

#### 待实现的4波虫卵系统
```
波1：基础虫卵 → 孵化普通蟑螂
波2：强化虫卵 → 孵化混合类型
波3：精英虫卵 → 孵化护甲+自爆
波4：终极虫卵 → 孵化全类型rush
Boss在每个波次间进行对话
全部波次清完后Boss逃跑
```

### 3.6 场景与波次

#### 场景解锁链
厨房（KITCHEN）→ 下水道（SEWER）→ 垃圾场（DUMP）→ 地下室（BASEMENT）→ 屋顶（ROOFTOP）→ 街道（STREET，无尽模式）

#### 各场景特点
| 场景 | 波数 | 特色敌人类型 | 解锁道具 |
|------|------|-------------|----------|
| 厨房 | 6 | 基础蟑螂 | 风扇 |
| 下水道 | 6 | +飞行蟑螂 | 燃烧瓶 |
| 垃圾场 | 8 | +护甲蟑螂 | 散弹模式 |
| 地下室 | 8 | +分裂蟑螂 | 雷达激光 |
| 屋顶 | 8 | +自爆蟑螂 | 电蚊拍 |
| 街道 | 无尽 | 全部类型 | 无 |

## 4. 技术架构

### 4.1 渲染架构
- 单一Canvas 2D渲染
- 分辨率：540x960（竖屏）
- 60fps requestAnimationFrame游戏循环
- 所有渲染在GameEngine.render()中集中处理

### 4.2 游戏循环
```typescript
gameLoop(now) {
  if (state !== PLAYING) return;  // 关键：非PLAYING状态停止循环
  deltaTime = (now - lastTime) / 1000;
  update();   // 逻辑更新
  render();   // 画面渲染
}
```

### 4.3 状态管理
- 使用GameState枚举：MENU | PLAYING | PAUSED | GAME_OVER | WAVE_CLEAR | ITEM_DROP | ITEM_REVEAL
- React通过回调与引擎通信（onStateChange, onWaveClear等）
- **关键修复**：`onWaveClear`回调必须在GameCanvas中设置，否则道具介绍界面关闭后无法进入结算

### 4.4 引擎类结构（单文件6965行）
```
GameEngine
├── 生命周期：start/stop/pause/resume/reset
├── 玩家系统：createPlayer/updatePlayer
├── 武器系统：updateFlamethrower/updateShotgun/...（13种武器）
├── 道具系统：selectItem/throwAimedWeapon/updateThrowables
├── 敌人系统：spawnRoach/updateRoaches/killRoach
├── 碰撞检测：checkCollisions/checkDefense
├── 波次系统：updateWave/startWave/getWaveConfig
├── BOSS系统：updateBossBattle/initBossBattle/...
├── 粒子系统：spawn*/updateParticles
├── 渲染系统：render*/renderRoach（17个渲染方法）
└── 输入处理：setMouseX/setFiring/handleScreenClick
```

### 4.5 关键类型定义
- `Roach`：敌人实体（位置/HP/状态/类型/护甲等）
- `Player`：玩家状态（武器/热量/弹药等）
- `RoachType`：枚举（SMALL/LARGE/FLYING/ARMORED/SPLITTING/SUICIDE/FLYING_SUICIDE/QUEEN）
- `RoachState`：枚举（ALIVE/STUCK/DEAD/DYING）
- `GameState`：枚举（MENU/PLAYING/PAUSED/GAME_OVER/WAVE_CLEAR/ITEM_DROP/ITEM_REVEAL）
- `WaveConfig`：波次配置（各类型敌人数量/速度/间隔）
- `BossBattleState`：Boss战状态
- `EnemyDef`：敌人属性定义（HP/速度/大小/描述）

## 5. 已修复的Bug（重要历史）

| Bug | 原因 | 修复方案 |
|-----|------|----------|
| 道具介绍界面卡死 | `onWaveClear`回调在GameCanvas中未设置 | 在GameCanvas.useEffect中添加`engine.onWaveClear`回调 |
| 飞行自爆蟑螂不出现 | 无尽模式availableTypes缺少FLYING_SUICIDE | 添加到生成队列 |
| 飞行自爆蟑螂位置错误 | spawn位置检查只匹配FLYING | 修改为FLYING\|\|FLYING_SUICIDE |
| 激光打护甲后停止 | return退出整个updateRadarLaser | 改为targetId=null继续搜索 |
| 双重消耗电蚊拍 | selectItem和useSwatter都扣减 | 移除selectItem中的扣减逻辑 |
| 电蚊拍无范围检查 | useSwatter缺少范围判断 | 重写为全屏攻击（用户要求） |
| renderPlayer调用缺失 | BOSS代码清除时误删 | 补回调用 |

## 6. 待开发内容（按优先级）

### 高优先级
1. **BOSS战4波虫卵系统完整实现**（框架已保留，需填充战斗逻辑）
2. **engine.ts拆分**（当前6965行，查改极慢，拆分方案待确定）

### 中优先级
3. 更多Boss技能（冲锋/召唤/蜕皮等）
4. Boss弱点系统（眼睛/腹部暴露机制）
5. 更多敌人类型和行为模式

### 低优先级
6. 多人合作模式
7. 排行榜系统
8. 更多场景/关卡

## 7. 关键设计决策（不可更改）

1. **单文件引擎**：当前所有游戏逻辑在engine.ts中，修改时必须精确定位代码位置
2. **Canvas 2D渲染**：不使用WebGL/Phaser等框架
3. **竖屏540x960**：固定分辨率，移动端优先
4. **React状态通过回调同步**：引擎不直接操作React state
5. **游戏循环在PLAYING状态才执行**：ITEM_DROP/ITEM_REVEAL状态跳过update()
6. **风扇图标256x256**：用户指定尺寸
7. **电蚊拍全屏攻击**：用户要求，非范围攻击
8. **护甲HP翻倍**：用户指定，所有护甲HP×2
9. **用户上传图标不可替换**：fan.png、item_swatter.png、roach_flying_suicide.png

## 8. 资源清单

### 图片资源（34个）
- 背景：7张（6场景+1成就）
- 角色：9张（蟑螂7种+玩家+蟑叔+Boss）
- 道具：8张（风扇+电蚊拍+雷达+散弹+燃烧瓶+冰冻+粘板+手枪）
- Boss：3张（三阶段）
- UI：3张（菜单+游戏结束+成就）
- 其他：3张（粘板图鉴+蟑叔头像+下水道背景）

### 音效资源（5个）
- bgm.mp3（背景音乐）
- sfx_fire.mp3（开火）
- sfx_fire_intense.mp3（强化开火）
- sfx_kill.mp3（击杀）
- sfx_reload.mp3（换弹）
- sfx_swatter.mp3（电蚊拍）

### 视频资源（2个）
- cockroach_dance.mp4
- gameover_bg.mp4

## 9. 构建与部署

```bash
cd /mnt/agents/output/app
npm run build    # 构建 → dist/
# 部署：dist/目录作为静态网站部署
```

## 10. 会话快照（当前状态）

```
📦 蟑螂射击塔防 /mnt/agents/output/app
✅ 道具卡死修复完成
✅ 护甲系统完整实现
✅ 激光狙击（伤害10/5发/0.3s）
✅ 电蚊拍全屏攻击+破甲+减速80%
✅ 风扇256x256+全屏减速50%
✅ 飞行自爆蟑螂（速度3.0/护甲5/全模式）
✅ 护甲HP翻倍（自爆12/飞行自爆10）
✅ 肉盾挡火机制
✅ 护盾特效+破甲前无受击反应
✅ 喷雾/粘板/激光对护甲无效
✅ 喷火80%吸收+20%穿透
✅ 风扇对护甲免疫
✅ 电蚊拍道具掉落场景控制
✅ 无尽模式飞行自爆蟑螂30%护甲
🐛 当前无已知bug
📋 待开发：BOSS战4波虫卵系统
📁 engine.ts 6965行（拆分尝试失败，保持单文件）
🔗 https://xynlqlijlidpg.ok.kimi.link
```
