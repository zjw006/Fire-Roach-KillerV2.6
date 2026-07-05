# 新引擎模块化架构分析及与老引擎对比

## 一、新引擎架构总览

### 1.1 模块化设计理念

新引擎 `NewGameEngine.ts` 采用**依赖注入 + 回调驱动**的模块化架构，将原来约 10,000 行的单文件 `GameEngine` 类拆分为 **20+ 个独立子系统模块**。每个模块：

- 拥有独立的 `Config` 接口，通过 `updateConfig()` 方法接收外部状态
- 通过回调函数（`onXxx`）与引擎和其他模块通信
- 引擎作为"编排器"（Orchestrator），负责模块初始化、每帧更新调度和模块间数据传递

### 1.2 模块分类

| 分类 | 模块 | 文件路径 | 职责 |
|------|------|----------|------|
| **核心管理器** | EconomyManager | `engine/economy/` | 经济统计、击杀奖励 |
| | WaveManager | `engine/wave/` | 波次生成、配置、倒计时 |
| | EntityManager | `engine/entity/` | 实体容器（蟑螂、粒子、火焰区等） |
| | RenderManager | `engine/render/` | 分层渲染管线 |
| | UIManager | `engine/ui/` | 菜单/HUD UI 渲染 |
| **核心系统** | CollisionSystem | `engine/collision/` | 火焰碰撞检测、伤害计算 |
| | WeaponSystem | `engine/weapon/` | 武器掉落生成、拾取、切换 |
| | ParticleSystem | `engine/particle/` | 粒子效果、浮动文字、火焰区/墙 |
| | RoachAISystem | `engine/ai/` | 蟑螂 AI、移动、特殊行为、状态效果 |
| **功能模块** | BossBattleSystem | `engine/boss/` | Boss 战斗管理 |
| | ThrowableSystem | `engine/throwable/` | 投掷物（燃烧瓶等） |
| | StickySystem | `engine/sticky/` | 粘性板放置与效果 |
| | AimingSystem | `engine/aiming/` | 瞄准辅助 |
| | TripleFlameSystem | `engine/triple/` | 三连火焰 |
| | RadarLaserSystem | `engine/radar/` | 雷达激光 |
| | FanSystem | `engine/fan/` | 强力风扇 |
| | ConsumableSystem | `engine/consumable/` | 消耗品使用、冷却、Buff |
| | WeatherSystem | `engine/weather/` | 天气效果 |
| | ItemSystem | `engine/item/` | 道具掉落、收集、揭示 |
| | ItemManagementSystem | `engine/item/` | 道具解锁、库存、持久化 |
| | AchievementSystem | `engine/achievement/` | 成就检测与解锁 |
| | StatsSystem | `engine/stats/` | 统计追踪 |
| **高级模块** | PlayerControlSystem | `engine/player/` | 玩家输入、热量、武器切换 |
| | DefenseCheckSystem | `engine/defense/` | 防线突破检测 |
| **工具模块** | PerformanceMonitor | `engine/utils/` | FPS/帧时间/内存监控 |
| | PerformanceMonitorSystem | `engine/performance/` | 性能自适应 |

---

## 二、模块调用关系

### 2.1 初始化流程

```
NewGameEngine 构造函数
  │
  ├─ 创建核心状态: player, economy, progress
  ├─ 初始化 EconomyManager(economy)
  ├─ 初始化 WaveManager(scene, mode, difficulty)
  ├─ 初始化 EntityManager(width, height, getDefenseLineY)
  ├─ 初始化 RenderManager(ctx, width, height, getDefenseLineY)
  ├─ 初始化 CollisionSystem(difficulty, gameState)
  ├─ 初始化 WeaponSystem(difficulty, gameState, ...)
  ├─ 初始化 ParticleSystem(particleLimit, ...)
  ├─ 初始化 RoachAISystem(gameState, difficulty, ...)
  ├─ 初始化 BossBattleSystem(...) ──┐
  ├─ 初始化 ThrowableSystem(...) ──┤
  ├─ 初始化 StickySystem(...) ─────┤
  ├─ 初始化 AimingSystem(...) ─────┤  通过回调注入
  ├─ 初始化 TripleFlameSystem(...) ─┤  addFloatingText
  ├─ 初始化 RadarLaserSystem(...) ──┤  playSoundById
  ├─ 初始化 FanSystem(...) ────────┤  addParticle
  ├─ 初始化 ConsumableSystem(...) ──┤  playerUpdate
  ├─ 初始化 WeatherSystem(...) ────┤  defenseUpdate
  ├─ 初始化 ItemSystem(...) ───────┤  stateChange
  ├─ 初始化 AchievementSystem(...) ─┤  gameDefeat
  ├─ 初始化 StatsSystem(...) ──────┘
  ├─ 初始化 PlayerControlSystem(...)
  ├─ 初始化 DefenseCheckSystem(...)
  ├─ 初始化 ItemManagementSystem(...)
  ├─ 初始化 UIManager(ctx, width, height)
  ├─ 初始化 InputHandler
  └─ 初始化 PerformanceMonitor(s)
```

**关键设计**：所有模块在构造时就通过回调函数建立了与引擎的通信桥梁。例如：
- `onAddFloatingText` → 引擎的 `addFloatingText()` → 转发到 `ParticleSystem.addFloatingText()`
- `onPlaySound` → 引擎的 `playSoundById()` → 转发到 `AudioManager`
- `onPlayerUpdate` → 直接更新引擎的 `this.player`

### 2.2 每帧更新链路

```
gameLoop() → update(deltaTime)
  │
  ├─ GameState.COUNTDOWN:
  │   └─ updateCountdown() → updateParticleSystem() + updateFloatingTexts() + updateScreenShake()
  │
  ├─ GameState.ITEM_DROP / ITEM_REVEAL / WAVE_CLEAR / PAUSED / GAME_OVER:
  │   └─ updateVisualEffects() → updateParticleSystem() + updateFloatingTexts() + updateScreenShake()
  │
  └─ GameState.PLAYING:
      └─ updateGameplay(deltaTime)
          │
          ├─ 1. updateInputHandler()
          │     └─ PlayerControlSystem.updateConfig(mouseX, mouseY, isFiring)
          │
          ├─ 2. updateRoaches(deltaTime)
          │     └─ RoachAISystem.updateConfig(gameState, deltaTime, playerX, playerY)
          │     └─ RoachAISystem.updateRoaches(roaches) → 返回更新后的蟑螂
          │     └─ EntityManager.updateRoaches(updatedRoaches)
          │
          ├─ 3. EntityManager.updateEntities(updateStatusEffects, isStuckByBoard)
          │
          ├─ 4. updateWeaponSystem(deltaTime)
          │     └─ WeaponSystem.updateConfig(difficulty, gameState, ...)
          │     └─ WeaponSystem.update(deltaTime, player, defenseLineY)
          │
          ├─ 5. updateParticleSystem(deltaTime)
          │     └─ ParticleSystem.updateConfig(particleLimit, deltaTime, ...)
          │     └─ ParticleSystem.update(roaches)
          │
          ├─ 6. WaveManager.update(deltaTime)
          │
          ├─ 7. handleWaveSpawning(deltaTime)
          │     └─ WaveManager.getNextSpawn()
          │     └─ EntityManager.getRoachManager().spawnRoach()
          │
          ├─ 8. checkCollisions()
          │     └─ CollisionSystem.updateConfig(difficulty, gameState)
          │     └─ CollisionSystem.checkFlameCollisions(player, roaches, tripleFlame, ...)
          │     └─ handleKilledRoaches() → economyManager.recordKillWithReward()
          │
          ├─ 9. updateNewModules(deltaTime)
          │     ├─ updateHighPriorityModules()
          │     │   ├─ PlayerControlSystem.update(deltaTime)
          │     │   └─ DefenseCheckSystem.checkDefense(roaches)
          │     ├─ updateMediumPriorityModules()
          │     │   └─ ItemManagementSystem.update(deltaTime)
          │     ├─ updateBossBattleSystem(deltaTime)
          │     ├─ updateThrowableSystem(deltaTime)
          │     ├─ updateStickySystem(deltaTime)
          │     ├─ updateAimingSystem(deltaTime)
          │     ├─ updateTripleFlameSystem(deltaTime)
          │     ├─ updateRadarLaserSystem(deltaTime)
          │     ├─ updateFanSystem(deltaTime)
          │     ├─ updateConsumableSystem(deltaTime)
          │     ├─ updateWeatherSystem(deltaTime)
          │     ├─ updateItemSystem(deltaTime)
          │     ├─ updateAchievementSystem()
          │     └─ updateStatsSystem()
          │
          ├─ 10. updateTestEntities(deltaTime)
          │
          └─ 11. checkWaveStatus()
                └─ WaveManager.isWaveComplete()
                └─ WaveManager.startWave()
```

### 2.3 渲染链路

```
render() → 根据状态分发
  │
  ├─ GameState.COUNTDOWN → renderCountdown() → renderDefault() (TODO)
  ├─ GameState.ITEM_DROP/ITEM_REVEAL/WAVE_CLEAR → renderVisualEffects() → renderDefault() (TODO)
  ├─ GameState.PLAYING → renderGameplay()
  │     └─ 构建硬编码的 renderData（空数组）
  │     └─ RenderManager.render(renderData)
  ├─ GameState.PAUSED → renderGameplay() + renderPauseMenu()
  └─ GameState.GAME_OVER → renderGameplay() + renderGameOverScreen()
```

**关键问题**：`renderGameplay()` 中构建的 `renderData` 是**硬编码的空数据结构**，没有从各模块获取实际数据，导致渲染管线无法显示真实的游戏画面。

---

## 三、四大重点领域对比分析

### 3.1 剧情战斗流程管理

#### 老引擎实现

老引擎的 `engine.ts` 拥有完整的战斗流程状态机，所有状态转换在一个类中完成：

```
MENU → COUNTDOWN(3-2-1) → PLAYING → (波次完成) → WAVE_CLEAR
  → ITEM_DROP → ITEM_REVEAL → (下一波) → COUNTDOWN → PLAYING
  → ... → (所有波次完成) → SHOP → MENU
```

关键逻辑：
- **波次管理**：`startWave()` → `doWaveSpawn()` → 根据 `SCENE_WAVE_CONFIGS` 生成蟑螂队列 → 逐只生成
- **波次间倒计时**：每波之间有 3-2-1 倒计时（`updateCountdown()`）
- **波次完成检测**：`checkWaveComplete()` 检测所有蟑螂是否死亡 → 触发 `WAVE_CLEAR` 状态
- **道具揭示流程**：`WAVE_CLEAR` → 生成 `itemRevealData` → `ITEM_REVEAL` → 逐个展示 → `ITEM_DROP` → 玩家点击拾取
- **通关流程**：所有波次完成 → 显示奖励 → 解锁新场景/武器 → 返回菜单
- **教程系统**：厨房第一波支持教程暂停（`tutorialPauseSpawn`），暂停生成和火焰

#### 新引擎实现

新引擎的 `WaveManager` 实现了核心波次逻辑，但整体流程**不完整**：

**已实现：**
- WaveManager: 波次配置读取、生成队列、倒计时、波次完成检测
- ItemSystem: 道具揭示序列、掉落动画、点击拾取
- 基础状态机：MENU → COUNTDOWN → PLAYING → WAVE_CLEAR/ITEM_DROP/ITEM_REVEAL

**缺失/未完成：**
- `updateCountdown()` 中倒计时结束直接调用 `doWaveSpawn()`，但**没有处理波次间倒计时**（仅第一波有倒计时）
- `checkWaveStatus()` 中波次完成后没有进入 `WAVE_CLEAR` 状态，而是直接调用 `startWave()` 启动下一波
- 道具揭示流程（`ITEM_REVEAL → ITEM_DROP → WAVE_CLEAR`）的**状态转换逻辑不完整**
- `WaveManager` 没有 `waveJustCleared` 和 `waveClearTimer` 的实际使用
- **教程系统缺失**：`tutorialPauseSpawn` 在 PlayerControlSystem 中定义了但未与 WaveManager 联动
- **通关流程缺失**：所有波次完成后没有胜利处理逻辑
- **商店流程缺失**：`shouldShowShop()` 方法存在但未被调用

#### 缺失总结

| 功能 | 老引擎 | 新引擎 | 状态 |
|------|--------|--------|------|
| 3-2-1 倒计时（第一波） | 完整 | 完整 | ✅ |
| 波次间倒计时 | 完整 | 未实现 | ❌ |
| 波次生成队列 | 完整 | 完整 | ✅ |
| 波次完成检测 | 完整 | 完整 | ✅ |
| WAVE_CLEAR 状态过渡 | 完整 | 不完整 | ⚠️ |
| ITEM_REVEAL 序列 | 完整 | 骨架存在 | ⚠️ |
| ITEM_DROP 拾取 | 完整 | 骨架存在 | ⚠️ |
| 通关/胜利流程 | 完整 | 未实现 | ❌ |
| 教程暂停系统 | 完整 | 未实现 | ❌ |
| 商店显示判断 | 完整 | 方法存在但未调用 | ❌ |

---

### 3.2 怪物表现：AI、行为、动作、特殊属性、特效和音效

#### 老引擎实现

老引擎在一个类中实现了**完整的怪物系统**，包括：

**AI 行为（`updateRoaches()`）：**
- 移动逻辑：向防线移动、横向摆动、透视边界钳制
- 闪避系统：小蟑螂/自爆蟑螂被火焰击中时横向闪避（`dodgeDir`/`dodgeTimer`）
- 愤怒系统：HP < 20% 时速度翻倍（`isEnraged`）
- 恐慌系统：被爆炸惊吓后反向移动（`panicTimer`/`panicAngle`）
- 飞行蟑螂：加速俯冲、翅膀动画、死亡坠落
- 装甲系统：装甲值衰减、破碎效果、破甲后减速
- 诱饵系统：诱饵激活时所有蟑螂被拉向诱饵

**特殊行为：**
- 护士蟑螂：四阶段 AOE 治疗（idle → charging → spraying → dissipating），施法音效、治疗粒子
- 变异蟑螂：死亡时 7 帧序列帧转换动画（`mutant_01.png` ~ `mutant_07.png`），200ms/帧，生成胚胎蟑螂
- 定时自爆蟑螂：四阶段（warning → crouching → exploding → residue），放置炸弹无敌，炸弹倒计时爆炸，变身大蟑螂
- 分裂蟑螂：死亡时分裂为 5 个小蟑螂
- 皇后蟑螂：定期产卵生成小蟑螂
- 自杀蟑螂：接近防线激活引信，引信火花粒子，爆炸

**特效和音效：**
- 每种怪物有专属音效：`playNurseCast()`, `playMutantTransform()`, `playSuicideExplode()`, `playFlyingDeath()`, `playSuicideBreachGround()`, `playSuicideBreachFlying()`
- 每种怪物有专属粒子：`spawnExplosionParticles()`, `spawnFireRingParticles()`, `spawnSparkParticles()`
- 专属震动反馈：`vibrateSuicideExplode()`, `vibrateKill()`, `vibrateBreach()`, `vibrateGameOver()`

#### 新引擎实现

新引擎的 `RoachAISystem` 有**良好的结构框架**，但**大量功能标记为 TODO**：

**已实现：**
- 基础移动逻辑（含透视边界钳制、地面边界计算）
- 闪避系统（小蟑螂/自爆蟑螂横向闪避）
- 愤怒系统（HP < 20% 速度翻倍）
- 飞行蟑螂坠落效果
- 状态效果（燃烧伤害、中毒伤害）
- 装甲系统（衰减、破碎、减速）
- 分裂蟑螂（死亡分裂 5 个小蟑螂）
- 变异蟑螂转换动画框架（7 帧，200ms/帧）
- 护士蟑螂四阶段状态机框架
- 定时自爆蟑螂四阶段状态机框架
- 粒子生成方法（`generateExplosionParticles`, `generateSparkParticles`, `generateHealParticles`, `generatePoisonParticles`）

**缺失/未完成（标记为 TODO）：**

| 功能 | 缺失详情 |
|------|----------|
| 护士蟑螂访问蟑螂数组 | 无法遍历所有蟑螂找到受伤盟友（`TODO: 需要访问所有蟑螂数组`） |
| 护士蟑螂施法音效 | `TODO: 播放护士施法音效` |
| 护士蟑螂治疗浮动文字 | `TODO: 添加浮动文本` |
| 护士蟑螂治疗粒子 | 未调用 `generateHealParticles()` |
| 变异体胚胎生成 | `TODO: 生成胚胎蟑螂`（`spawnEmbryoRoaches` 回调未连接） |
| 定时自爆蟑螂爆炸 | `TODO: 触发突破爆炸` |
| 定时自爆蟑螂浮动文字 | `TODO: 添加浮动文本`（多处） |
| 定时自爆蟑螂炸弹放置粒子 | `TODO: 添加放置炸弹`（粒子效果） |
| 定时自爆蟑螂变身 | 变身代码存在但未触发（`roach.type = RoachType.LARGE`） |
| 自杀蟑螂引信火花 | `TODO: 生成火花粒子` |
| 自杀蟑螂爆炸效果 | `TODO: 触发爆炸效果和伤害` |
| 火焰墙阻挡 | `TODO: 需要访问火焰墙数组`（多处） |
| 诱饵系统 | `TODO: 需要从游戏引擎获取诱饵状态` |
| 粘性板检查 | `isStuckByBoard()` 始终返回 false（`TODO: 实现粘性板检查逻辑`） |
| 风扇效果 | `TODO: 需要访问火焰墙数组`（躲避期间） |
| 皇后产卵 | `onQueenSpawn` 回调定义但未连接 |
| 飞行蟑螂翅膀碎片 | `generateWingDebrisParticles` 回调定义但未连接 |

**音效集成缺失：**
- 新引擎的 `RoachAISystem` 没有 `onPlaySound` 回调，无法播放怪物专属音效
- 所有特殊行为的音效都是 TODO 状态

#### 缺失总结

| 功能 | 老引擎 | 新引擎 |
|------|--------|--------|
| 基础移动 AI | 完整 | 完整 |
| 闪避系统 | 完整 | 完整 |
| 愤怒系统 | 完整 | 完整 |
| 状态效果（燃烧/中毒） | 完整 | 完整 |
| 装甲系统 | 完整 | 完整 |
| 分裂蟑螂 | 完整 | 完整 |
| 护士蟑螂治疗 | 完整 | 框架存在，核心逻辑 TODO |
| 变异体转换动画 | 完整 | 框架存在，胚胎生成 TODO |
| 定时自爆完整流程 | 完整 | 框架存在，爆炸/变身 TODO |
| 自杀蟑螂爆炸 | 完整 | 框架存在，效果 TODO |
| 皇后产卵 | 完整 | 回调未连接 |
| 飞行蟑螂死亡特效 | 完整 | 回调未连接 |
| 怪物专属音效 | 12+ 种 | 0 种（无回调） |
| 怪物专属粒子 | 完整 | 方法存在但未调用 |
| 怪物专属震动 | 完整 | 0 种（无回调） |
| 火焰墙阻挡 | 完整 | TODO |
| 诱饵系统 | 完整 | TODO |

---

### 3.3 玩家喷火枪模型调用特效表现

#### 老引擎实现

老引擎的喷火枪系统完整实现了以下特效链：

1. **火焰粒子生成**：`spawnConeFire()` 在锥形范围内生成多层火焰粒子（内焰+外焰），基于鼠标位置计算角度
2. **烟雾粒子**：过热时 `spawnSmokeParticles()` 生成黑烟
3. **枪口闪光**：`renderMuzzleFlash()` 渲染枪口火焰闪烁
4. **火焰音效**：`playFire()` / `stopFire()` 循环播放火焰喷射音效
5. **开火震动**：`vibrateFire()` 持续震动反馈
6. **热量视觉反馈**：屏幕边缘红色警告闪烁、热量条
7. **过热特效**：大量烟雾粒子 + 屏幕震动 + "枪管冷却中" 浮动文字
8. **强力提升特效**：火焰尖端黑烟粒子

#### 新引擎实现

新引擎的 `PlayerControlSystem` 处理输入和热量管理，但**火焰特效生成与渲染脱节**：

**已实现：**
- 玩家位置/角度更新
- 热量管理（增加、衰减、过热检测、冷却）
- 燃气消耗
- 重新装填
- 麻痹效果
- 临时武器切换与过期
- 天赋加成应用
- 热量警告浮动文字
- 过热烟雾粒子（通过 `onAddParticle` 回调）
- 强力提升黑烟粒子

**缺失/未完成：**

| 功能 | 详情 |
|------|------|
| 锥形火焰粒子生成 | `updateFlamethrower()` 中注释 `TODO: 实际生成由其他系统处理`，未调用 |
| 火焰渲染 | `renderGameplay()` 中 `particles` 和 `fireZones` 硬编码为空数组 |
| 枪口闪光渲染 | 未实现 |
| 火焰音效 | 有 `onPlaySound('fire')` 回调，但依赖外部系统正确连接 |
| 开火震动 | 有 `onVibrate()` 回调，但依赖外部系统正确连接 |
| 屏幕边缘热量警告 | 未实现 |
| 毒气喷雾粒子 | 未实现 |
| 霰弹枪粒子 | 未实现 |

**核心问题**：`PlayerControlSystem` 的火焰粒子生成逻辑被注释掉（`// this.spawnConeFire(...);`），实际的火焰粒子应该由 `ParticleSystem` 生成，但两个系统之间没有建立数据通路。`ParticleSystem` 的 `update()` 方法会处理粒子生命周期，但**没有接收来自 PlayerControlSystem 的火焰生成请求**。

#### 缺失总结

| 功能 | 老引擎 | 新引擎 |
|------|--------|--------|
| 锥形火焰粒子 | 完整 | 未实现（注释掉） |
| 烟雾粒子（过热/强力） | 完整 | 回调存在，但通路未验证 |
| 枪口闪光 | 完整 | 未实现 |
| 火焰音效循环 | 完整 | 回调存在，但通路未验证 |
| 开火震动 | 完整 | 回调存在，但通路未验证 |
| 热量视觉警告 | 完整 | 未实现 |
| 火焰渲染到画布 | 完整 | 硬编码空数据 |
| 毒气喷雾特效 | 完整 | 未实现 |
| 霰弹枪特效 | 完整 | 未实现 |

---

### 3.4 掉落品拾取和使用管理

#### 老引擎实现

老引擎的掉落品系统完整实现了：

**武器掉落：**
- `spawnWeaponDrop()`：在防线上方随机位置生成掉落物，支持多个同时掉落
- `pickupWeaponDrop()`：玩家经过时自动拾取，放入库存，播放音效，显示浮动文字
- 掉落生命周期：12 秒后自动消失，浮动动画
- 库存管理：`inventory` 数组，支持堆叠，最多 3 个槽位
- 道具使用：`selectItem()` 选择道具，放置/投掷模式

**道具揭示（波次奖励）：**
- `itemRevealData`：波次清除后生成奖励列表
- `itemDropOnField`：单个道具从天空掉落 → 地面弹跳 → 浮动动画
- `handleItemDropClick()`：玩家点击拾取
- 重力动画：`fallSpeed` 递增，到达 `targetY` 停止
- 漂浮动画：`bobPhase` 正弦波

**消耗品：**
- `buyConsumable()`：商店购买
- `useConsumable()`：手动使用（紧急冷却、燃气补充、防御修复、护盾、强力提升、诱饵）
- 自动使用：`checkAutoUseConsumables()` 在特定条件下自动触发
- 冷却系统：`consumableCooldowns` + `globalConsumableCooldown`（全局 1.5 秒）
- Buff 闪烁：`buffFlashTimers` 显示 Buff 剩余时间

#### 新引擎实现

新引擎将掉落品系统拆分为三个模块：

**ItemSystem（道具揭示）：**
- 已实现：道具揭示数据管理、下落动画、浮动动画、点击拾取、重力模拟
- 缺失：`triggerGameVictory()` 中医院星级评定逻辑未完成，天赋点奖励计算未完成

**ItemManagementSystem（道具管理）：**
- 已实现：道具解锁检测、场景解锁、消耗品库存、自动使用设置、武器掉落生成、拾取、库存管理、道具使用
- 缺失：`checkSceneUnlocks()` 中的解锁逻辑与 `SCENE_REWARD_ITEMS` 集成，但 `ItemSystem` 和 `ItemManagementSystem` 是两个独立模块，道具揭示流程和道具解锁流程没有打通

**ConsumableSystem（消耗品）：**
- 已实现：消耗品库存管理、自动使用逻辑、冷却系统、Buff 计时器、效果应用（防御修复、护盾、燃气补充、强力提升、诱饵、紧急冷却）
- 缺失：与 `ItemManagementSystem` 的消耗品库存数据同步未验证

**集成问题：**

| 问题 | 详情 |
|------|------|
| 模块间数据孤岛 | `ItemSystem` 和 `ItemManagementSystem` 各自维护独立的道具揭示数据，没有统一的数据源 |
| 武器掉落重复 | `WeaponSystem` 和 `ItemManagementSystem` 都维护 `weaponDrops` 数组，可能冲突 |
| 掉落渲染缺失 | `renderGameplay()` 中 `weaponDrops` 和 `itemDropsOnField` 硬编码为空数组 |
| 消耗品库存同步 | `ConsumableSystem` 和 `ItemManagementSystem` 各维护独立的 `consumableInventory` |
| 道具使用回调 | 道具使用后的效果应用回调链路不完整 |

#### 缺失总结

| 功能 | 老引擎 | 新引擎 |
|------|--------|--------|
| 武器掉落生成 | 完整 | 完整（两个模块） |
| 武器掉落拾取 | 完整 | 完整 |
| 武器掉落生命周期 | 完整 | 完整 |
| 道具库存管理 | 完整 | 完整 |
| 道具揭示下落动画 | 完整 | 完整 |
| 道具点击拾取 | 完整 | 完整 |
| 消耗品商店购买 | 完整 | 完整（ItemManagementSystem） |
| 消耗品手动使用 | 完整 | 完整（ConsumableSystem） |
| 消耗品冷却系统 | 完整 | 完整（ConsumableSystem） |
| Buff 计时器 | 完整 | 完整 |
| 掉落渲染 | 完整 | 未实现（硬编码空数据） |
| 模块间数据统一 | N/A（单体） | 数据孤岛问题 |
| 武器掉落重复管理 | N/A | 两个模块重复维护 |
| 通关奖励计算 | 完整 | 未完成 |

---

## 四、总体评估

### 4.1 新引擎的架构优势

1. **模块独立性**：每个子系统可以独立测试和维护
2. **依赖注入**：通过回调函数解耦模块间依赖
3. **配置驱动**：每个模块有清晰的 `Config` 接口
4. **代码可读性**：每个文件职责单一，约 200-800 行
5. **扩展性**：新增功能只需添加新模块并注册到 `updateNewModules()`

### 4.2 新引擎的当前问题

1. **大量 TODO 标记**：估计有 50+ 处 TODO，涉及核心游戏逻辑
2. **渲染管线断裂**：`renderGameplay()` 中的数据是硬编码空数组，没有从各模块获取实际数据
3. **模块间数据孤岛**：`ItemSystem` 和 `ItemManagementSystem`、`WeaponSystem` 和 `ItemManagementSystem` 重复维护数据
4. **音效系统未集成**：`RoachAISystem` 没有 `onPlaySound` 回调，怪物专属音效全部缺失
5. **状态机不完整**：`WAVE_CLEAR → ITEM_DROP → ITEM_REVEAL` 的状态转换链路断裂
6. **回调链路未验证**：大量回调定义了但实际调用路径未经过测试
7. **旧代码残留**：`testEntities` 和 `performanceInfo` 渲染是测试代码，不应出现在生产引擎中

### 4.3 与老引擎的功能完成度对比

| 功能领域 | 老引擎完成度 | 新引擎完成度 | 差距 |
|----------|:----------:|:----------:|:----:|
| 剧情战斗流程管理 | 100% | ~40% | 状态转换、通关、教程缺失 |
| 怪物 AI 框架 | 100% | ~70% | 数据结构完整，特殊行为 TODO |
| 怪物特效和音效 | 100% | ~10% | 粒子方法存在但未调用，音效全部缺失 |
| 玩家喷火枪特效 | 100% | ~20% | 火焰粒子生成未实现，渲染通路断裂 |
| 掉落品系统 | 100% | ~60% | 数据管理完整，渲染和模块集成缺失 |
| 总体估计 | 100% | ~35% | 新引擎处于早期开发阶段 |

### 4.4 建议的修复优先级

1. **P0 - 渲染管线修复**：打通 `renderGameplay()` 与实际模块数据的连接，让游戏画面可见
2. **P0 - 火焰粒子生成**：实现 `PlayerControlSystem` 与 `ParticleSystem` 的火焰生成数据通路
3. **P1 - 怪物 AI 完善**：补全 `RoachAISystem` 中的 TODO 项，特别是护士治疗、变异体转换、定时自爆
4. **P1 - 音效回调集成**：为 `RoachAISystem` 添加 `onPlaySound` 回调，连接所有怪物专属音效
5. **P1 - 状态机完善**：补全 `WAVE_CLEAR → ITEM_DROP → ITEM_REVEAL` 状态转换链路
6. **P2 - 模块数据统一**：合并 `ItemSystem`/`ItemManagementSystem`/`WeaponSystem` 中的重复数据
7. **P2 - 通关流程**：实现所有波次完成后的胜利处理和奖励结算
8. **P3 - 清理测试代码**：移除 `testEntities` 和 `performanceInfo` 渲染