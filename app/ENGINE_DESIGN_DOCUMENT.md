# 《烈焰除蟑》旧引擎设计文档

> 基于 `src/game/engine.ts`（v2.6，~10,000 行）源码分析生成

---

## 目录

1. [架构概览](#1-架构概览)
2. [类结构](#2-类结构)
3. [属性清单](#3-属性清单)
4. [方法清单](#4-方法清单)
5. [调用链路](#5-调用链路)
6. [关键子系统详解](#6-关键子系统详解)
7. [外部接口](#7-外部接口)
8. [与新引擎的对比](#8-与新引擎的对比)

---

## 1. 架构概览

### 1.1 基本特征

| 属性 | 值 |
|------|-----|
| 文件路径 | `src/game/engine.ts` |
| 代码行数 | ~10,000 行 |
| 类名 | `GameEngine` |
| 架构模式 | 单文件巨型类 |
| 属性数量 | ~200 个 |
| 方法数量 | ~180 个 |
| 依赖模块 | `types.ts`, `data.ts`, `audio.ts`, `vibration.ts`, `bossAnimation.ts` |

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      GameEngine                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  constructor() → resize() → loadImages() →           │   │
│  │  loadProgress() → createPlayer() → createEconomy()   │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  start() → resetGame() → gameLoop() →                │   │
│  │    ┌─────────────────────────────────────────────┐    │   │
│  │    │  per-frame: update() → render()             │    │   │
│  │    │                                           │    │   │
│  │    │  update() 调用 30+ 个子系统更新方法        │    │   │
│  │    │  render() 调用 25+ 个子渲染方法            │    │   │
│  │    └─────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  外部回调：onStateChange, onEconomyUpdate,          │   │
│  │  onWaveUpdate, onGameOver, onBossUpdate 等          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 设计原则

1. **自包含**：引擎不依赖任何外部库，纯 Canvas 2D API 实现
2. **事件驱动**：通过回调函数向外部 UI 组件通信，引擎不直接操作 DOM
3. **配置驱动**：波次配置、敌人属性、道具属性全部从 `data.ts` 读取
4. **性能自适应**：前 120 帧采样帧率，动态调整粒子数量上限
5. **状态机驱动**：游戏状态通过 `GameState` 枚举管理，决定 update/render 行为

---

## 2. 类结构

### 2.1 完整类图

```
GameEngine
├── 属性 (~200)
│   ├── 画布/渲染 (8)
│   │   ├── canvas: HTMLCanvasElement
│   │   ├── ctx: CanvasRenderingContext2D
│   │   ├── width, height: number
│   │   ├── scale: number
│   │   ├── dpr: number
│   │   ├── aspectRatio: number
│   │   └── lastTime: number
│   │
│   ├── 游戏状态/模式 (6)
│   │   ├── state: GameState
│   │   ├── gameMode: GameMode
│   │   ├── currentScene: SceneType
│   │   ├── difficulty: string
│   │   ├── isEasyMode: boolean
│   │   └── isClient: boolean
│   │
│   ├── 玩家/经济 (3)
│   │   ├── player: Player
│   │   ├── economy: Economy
│   │   ├── mouseX, mouseY: number
│   │   └── isFiring: boolean
│   │
│   ├── 实体容器 (15)
│   │   ├── roaches: Roach[]
│   │   ├── particles: Particle[]
│   │   ├── fireZones: FireZone[]
│   │   ├── weaponDrops: WeaponDrop[]
│   │   ├── stickyBoards: StickyBoard[]
│   │   ├── stickyDrops: StickyDrop[]
│   │   ├── fireWalls: FireWall[]
│   │   ├── floatingTexts: FloatingText[]
│   │   ├── throwables: ThrowableProjectile[]
│   │   └── ...more
│   │
│   ├── 波次系统 (8)
│   │   ├── wave: number
│   │   ├── waveTimer: number
│   │   ├── spawnQueue: SpawnEntry[]
│   │   ├── spawnTimer: number
│   │   ├── waveSpawning: boolean
│   │   ├── waveJustCleared: boolean
│   │   ├── countdownTimer: number
│   │   └── countdownPhase: number
│   │
│   ├── Boss 战斗 (30+)
│   │   ├── bossBattle: BossBattleState
│   │   │   ├── active: boolean
│   │   │   ├── phase: number
│   │   │   ├── maxPhase: number
│   │   │   ├── currentWave: number
│   │   │   ├── totalWaves: number
│   │   │   ├── spawnTimer: number
│   │   │   ├── stateTimer: number
│   │   │   ├── dialogueState: string
│   │   │   ├── bossDefeated: boolean
│   │   │   ├── bossFleeing: boolean
│   │   │   ├── bossFled: boolean
│   │   │   └── ...more
│   │   └── activeBosses: number
│   │
│   ├── 武器系统 (12)
│   │   ├── swatterActive: boolean
│   │   ├── swatterTimer: number
│   │   ├── tripleFlame: TripleFlameState
│   │   ├── radarLaser: RadarLaser
│   │   ├── insecticideSpray: InsecticideSpray
│   │   ├── insecticideTrail: Particle[]
│   │   ├── aimingState: AimingState
│   │   ├── weaponDamages: Record<string, number>
│   │   └── ...more
│   │
│   ├── 道具/消耗品 (10)
│   │   ├── inventory: InventoryItem[]
│   │   ├── consumableInventory: Record<string, number>
│   │   ├── itemCooldowns: Record<string, number>
│   │   ├── consumableCooldowns: Record<string, number>
│   │   ├── globalConsumableCooldown: number
│   │   ├── combatStartTimer: number
│   │   ├── selectedItems: string[]
│   │   ├── itemRevealData: ItemRevealData[]
│   │   └── ...more
│   │
│   ├── 场景/天气 (6)
│   │   ├── fanState: FanState
│   │   ├── weatherParticles: Particle[]
│   │   ├── weatherTimer: number
│   │   ├── lightningTimer: number
│   │   ├── screenShake: ScreenShake
│   │   └── ...more
│   │
│   ├── 图片资源 (~50)
│   │   ├── gunImg: HTMLImageElement
│   │   ├── roachImg: HTMLImageElement
│   │   ├── bgImg: HTMLImageElement
│   │   ├── roachSmallImg, roachLargeImg, roachFlyingImg
│   │   ├── roachArmoredImg, roachSplittingImg
│   │   ├── roachSuicideImg, roachQueenImg
│   │   ├── roachNurseImg, roachMutantImg
│   │   ├── roachTimedSuicideImg, roachTimedBombImg
│   │   ├── roachGhostImg, roachFlyingSuicideImg
│   │   ├── roachEggImg, roachEmbryoImg
│   │   ├── sceneBgImgs: Record<string, HTMLImageElement>
│   │   ├── weaponDropImgs: Record<string, HTMLImageElement>
│   │   ├── itemImgs: Record<string, HTMLImageElement>
│   │   └── ...more
│   │
│   ├── 音频 (2)
│   │   ├── audio: AudioManager
│   │   └── bgmLoopInterval: number
│   │
│   ├── 存档/进度 (5)
│   │   ├── progress: GameProgress
│   │   ├── talentMultipliers: TalentMultipliers
│   │   ├── scenesCleared: Set<SceneType>
│   │   ├── endlessBestTime: number
│   │   └── dailySeed: number
│   │
│   ├── 回调 (10)
│   │   ├── onStateChange: (state: GameState) => void
│   │   ├── onEconomyUpdate: (economy: Economy) => void
│   │   ├── onWaveUpdate: (wave: number, total: number) => void
│   │   ├── onDefenseUpdate: (defense: number) => void
│   │   ├── onGameOver: (reason: string) => void
│   │   ├── onBossUpdate: (state: BossBattleState) => void
│   │   ├── onConsumableUpdate: (inventory: Record<string, number>) => void
│   │   ├── onInventoryUpdate: (inventory: InventoryItem[]) => void
│   │   ├── onPlayerUpdate: (player: Player) => void
│   │   └── onWaveCompleted: () => void
│   │
│   ├── 医院专属 (10)
│   │   ├── hospitalEggPods: EggPod[]
│   │   ├── placedBombs: PlacedBomb[]
│   │   ├── deadTimedBombs: DeadTimedBomb[]
│   │   ├── hospitalStarRating: { bugs: number, bombs: number, eggs: number }
│   │   └── ...more
│   │
│   └── 性能监控 (5)
│       ├── deltaTime: number
│       ├── frameTimeSamples: number[]
│       ├── frameTimeSampleIndex: number
│       ├── avgFPS: number
│       └── maxParticles: number
│
└── 方法 (~180)
    ├── 生命周期 (8)
    │   ├── constructor(canvas)
    │   ├── resize()
    │   ├── loadImages()
    │   ├── start(mode, scene, keepShopUpgrades, selectedItems, initialMoney)
    │   ├── stop()
    │   ├── pause()
    │   ├── resume()
    │   └── restart()
    │
    ├── 主循环 (3)
    │   ├── gameLoop(now)
    │   ├── update()
    │   └── render()
    │
    ├── 玩家系统 (6)
    │   ├── createPlayer()
    │   ├── createEconomy(initialMoney?)
    │   ├── updatePlayer()
    │   ├── updateFlamethrower(dt)
    │   ├── updatePoisonSpray(dt)
    │   └── updateShotgun(dt)
    │
    ├── 敌人系统 (15)
    │   ├── spawnRoach(type, clusterId?)
    │   ├── updateRoaches()
    │   ├── updateStatusEffects(r)
    │   ├── applyDamageToRoach(r, damage, index, source?)
    │   ├── killRoach(r, index)
    │   ├── forceEmbryoBurst(r, index)
    │   ├── spawnEmbryoRoaches(x, y, count)
    │   ├── mutantDeathEffect(r, index)
    │   ├── suicideExplode(r, index)
    │   ├── triggerBreachExplosion(r)
    │   ├── triggerPanicOnArmorBreak(r)
    │   ├── createSmallRoachFromSplit(x, y)
    │   ├── spawnSwatterPickup(x, y)
    │   └── ...more
    │
    ├── 波次系统 (6)
    │   ├── updateWave()
    │   ├── startWave()
    │   ├── startCountdown()
    │   ├── doWaveSpawn()
    │   ├── getWaveConfig(wave)
    │   └── continueFromShop()
    │
    ├── Boss 战斗 (12)
    │   ├── initBossBattle()
    │   ├── spawnBoss()
    │   ├── updateBossBattle()
    │   ├── updateBossDeathSequence()
    │   ├── triggerBossDeathSequence()
    │   ├── updateEggPodSystem()
    │   ├── updateEggPods()
    │   ├── startBossSummonCast(wave)
    │   ├── spawnEggWave(wave)
    │   ├── startBossDialogue()
    │   ├── gameVictory()
    │   └── gameDefeat()
    │
    ├── 碰撞检测 (5)
    │   ├── checkCollisions()
    │   ├── checkDefense()
    │   ├── getWeaponDamage(p)
    │   ├── applyWeaponEffect(r, weapon)
    │   └── isStuckByBoard(roachId)
    │
    ├── 武器系统 (15)
    │   ├── switchWeapon(weapon)
    │   ├── useSwatter()
    │   ├── throwMolotov()
    │   ├── spawnMolotovProjectile(x, y, angle)
    │   ├── activateTripleFlame()
    │   ├── updateTripleFlame(dt)
    │   ├── activateRadarLaser()
    │   ├── updateRadarLaser(dt)
    │   ├── activateInsecticideSpray()
    │   ├── updateInsecticideSpray(dt)
    │   ├── spawnInsecticideParticles(x, y, count)
    │   ├── spawnInsecticideFade(x, y)
    │   ├── applyInsecticideDamage(x, y, radius, damage)
    │   ├── activateStickySpray()
    │   └── scheduleStickyDrop(x, y)
    │
    ├── 瞄准/投掷 (6)
    │   ├── startAiming()
    │   ├── updateAiming()
    │   ├── adjustAim(dx, dy)
    │   ├── throwAimedWeapon()
    │   ├── cancelAiming()
    │   └── updateThrowables(dt)
    │
    ├── 道具系统 (10)
    │   ├── spawnWeaponDrop(x, y, weaponType?)
    │   ├── pickupWeaponDrop(drop)
    │   ├── updateWeaponDrops(dt)
    │   ├── selectItem(itemId)
    │   ├── onItemFirstClick(x, y)
    │   ├── onItemDrag(x, y)
    │   ├── onItemRelease()
    │   ├── cancelItemPlacement()
    │   ├── completeItemReveal()
    │   └── handleItemDropClick(clientX, clientY)
    │
    ├── 消耗品系统 (8)
    │   ├── buyConsumable(id)
    │   ├── useConsumable(id)
    │   ├── toggleAutoUse(id)
    │   ├── checkAutoUseConsumables()
    │   ├── updateConsumableEffects(dt)
    │   ├── updateBuffFlashTimers(dt)
    │   ├── sellUnusedInventory()
    │   └── applyRecycledGold()
    │
    ├── 粒子系统 (14)
    │   ├── spawnConeFire(gx, gy, angle, range, spread, damage, type)
    │   ├── spawnSmokeParticles(x, y, count)
    │   ├── spawnAshParticles(x, y, count)
    │   ├── spawnBloodParticles(x, y, count)
    │   ├── spawnSparkParticles(x, y, count)
    │   ├── spawnExplosionParticles(x, y, count)
    │   ├── spawnDebrisParticles(x, y, count)
    │   ├── spawnFireRingParticles(x, y, radius)
    │   ├── spawnShockwaveRing(x, y, radius)
    │   ├── spawnLightningParticles(centerX, topY)
    │   ├── addFloatingText(x, y, text, color, durationMs?, fontSize?)
    │   ├── updateParticles()
    │   ├── updateFloatingTexts()
    │   └── ...more
    │
    ├── 场景特效 (8)
    │   ├── updateFireZones()
    │   ├── updateFireWalls()
    │   ├── updateStickyBoards()
    │   ├── updateStickyDrops()
    │   ├── updateScreenShake()
    │   ├── updateSwatter()
    │   ├── activateFan()
    │   └── updateFan()
    │
    ├── 渲染系统 (30)
    │   ├── render()
    │   ├── renderBackground(ctx, w, h)
    │   ├── renderWeatherBackground(ctx, w, h)
    │   ├── renderWeatherForeground(ctx, w)
    │   ├── renderDefenseLine(ctx, w)
    │   ├── renderMovementRange(ctx)
    │   ├── renderFireZones(ctx)
    │   ├── renderFireWalls(ctx)
    │   ├── renderStickyBoards()
    │   ├── renderStickyDrops(ctx)
    │   ├── renderWeaponDrops(ctx)
    │   ├── renderBaitThrow(ctx)
    │   ├── renderBaitMark(ctx)
    │   ├── renderParticles(ctx)
    │   ├── renderRoaches(ctx)
    │   ├── renderRoach(ctx, r)
    │   ├── renderPlayer(ctx)
    │   ├── renderItemPlacement(ctx)
    │   ├── renderThrowableAim(ctx)
    │   ├── renderThrowables(ctx)
    │   ├── renderSwatter(ctx)
    │   ├── renderMuzzleFlash(ctx)
    │   ├── renderFloatingTexts(ctx)
    │   ├── renderBossUI(ctx, w, h)
    │   ├── renderInsecticideSpray(ctx)
    │   ├── renderRadarLaser(ctx)
    │   ├── renderFan(ctx)
    │   ├── renderItemDropOnField(ctx)
    │   ├── renderHospitalEggPods(ctx)
    │   └── renderEggPods(ctx, pods)
    │
    ├── 存档系统 (6)
    │   ├── loadProgress()
    │   ├── saveProgress()
    │   ├── recalcTalentMultipliers()
    │   ├── checkAchievements()
    │   ├── unlockNextScene()
    │   └── loadEndlessBestTime() / saveEndlessBestTime()
    │
    ├── 输入处理 (6)
    │   ├── setMousePos(x, y)
    │   ├── setMouseX(x)
    │   ├── handleScreenClick(x, y)
    │   ├── setFiring(firing)
    │   ├── setFlameMode()
    │   └── cycleFlameMode()
    │
    ├── 医院专属 (5)
    │   ├── spawnHospitalEggPods(config)
    │   ├── updateHospitalEggPods()
    │   ├── hatchHospitalEggPod(pod)
    │   ├── damageHospitalEggPod(pod, damage)
    │   └── triggerDisinfectionReward()
    │
    └── 辅助方法 (10)
        ├── getGroundBoundsAtY(y)
        ├── getGroundCenter()
        ├── getPerspectiveScale(y)
        ├── getSceneConfig()
        ├── getFlameColor(t, weapon)
        ├── getFanEffectByType()
        ├── applyFanEffect(roach, strength)
        ├── getDailySeed()
        ├── canControlBoss()
        └── resetGame(initialMoney?)
```

---

## 3. 属性清单

### 3.1 画布/渲染属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `canvas` | HTMLCanvasElement | 游戏画布 |
| `ctx` | CanvasRenderingContext2D | 2D 渲染上下文 |
| `width` | number | 画布逻辑宽度 (540) |
| `height` | number | 画布逻辑高度 (960) |
| `scale` | number | DPR 缩放比例 |
| `dpr` | number | 设备像素比 |
| `aspectRatio` | number | 宽高比 |
| `lastTime` | number | 上一帧时间戳 |

### 3.2 游戏状态属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `state` | GameState | 当前游戏状态 (MENU/PLAYING/COUNTDOWN/WAVE_CLEAR/SHOP 等) |
| `gameMode` | GameMode | 游戏模式 (STORY/ENDLESS/DAILY/BOSS) |
| `currentScene` | SceneType | 当前场景 |
| `difficulty` | string | 难度 ('easy'/'hard') |
| `isEasyMode` | boolean | 是否简单模式 |
| `isClient` | boolean | 是否客户端 |

### 3.3 玩家属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `player` | Player | 玩家状态 (x, y, HP, 燃气, 过热, 武器等) |
| `economy` | Economy | 经济状态 (money, totalEarned, totalSpent) |
| `mouseX` | number | 鼠标 X 坐标 |
| `mouseY` | number | 鼠标 Y 坐标 |
| `isFiring` | boolean | 是否正在开火 |

### 3.4 实体容器

| 属性 | 类型 | 说明 |
|------|------|------|
| `roaches` | Roach[] | 所有蟑螂实体 |
| `particles` | Particle[] | 所有粒子实体 |
| `fireZones` | FireZone[] | 火焰区域 |
| `weaponDrops` | WeaponDrop[] | 武器掉落物 |
| `stickyBoards` | StickyBoard[] | 粘板 |
| `stickyDrops` | StickyDrop[] | 粘性掉落 |
| `fireWalls` | FireWall[] | 火墙 |
| `floatingTexts` | FloatingText[] | 浮动文字 |
| `throwables` | ThrowableProjectile[] | 飞行中的投掷物 |

### 3.5 波次系统属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `wave` | number | 当前波次 |
| `waveTimer` | number | 波次计时器 |
| `spawnQueue` | SpawnEntry[] | 生成队列 |
| `spawnTimer` | number | 生成计时器 |
| `waveSpawning` | boolean | 是否正在生成中 |
| `waveJustCleared` | boolean | 波次是否刚清除 |
| `countdownTimer` | number | 倒计时器 |
| `countdownPhase` | number | 倒计时阶段 (3/2/1) |

### 3.6 Boss 战斗属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `bossBattle` | BossBattleState | Boss 战斗状态 (30+ 子字段) |
| `bossBattle.active` | boolean | Boss 战是否激活 |
| `bossBattle.phase` | number | 当前阶段 (1-4) |
| `bossBattle.maxPhase` | number | 最大阶段 |
| `bossBattle.currentWave` | number | 当前 Boss 波次 |
| `bossBattle.totalWaves` | number | Boss 总波次 |
| `bossBattle.spawnTimer` | number | 生成计时器 |
| `bossBattle.stateTimer` | number | 状态计时器 |
| `bossBattle.dialogueState` | string | 对话状态 |
| `bossBattle.bossDefeated` | boolean | Boss 是否已击败 |
| `bossBattle.bossFleeing` | boolean | Boss 是否正在逃跑 |
| `bossBattle.bossFled` | boolean | Boss 是否已逃跑 |
| `activeBosses` | number | 活跃 Boss 数量 |

### 3.7 武器系统属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `swatterActive` | boolean | 电蚊拍是否激活 |
| `swatterTimer` | number | 电蚊拍计时器 |
| `swatterKnockback` | number | 电蚊拍击退力 |
| `tripleFlame` | TripleFlameState | 三连火焰状态 |
| `radarLaser` | RadarLaser | 雷达激光状态 |
| `insecticideSpray` | InsecticideSpray | 杀虫喷雾状态 |
| `insecticideTrail` | Particle[] | 杀虫剂轨迹粒子 |
| `aimingState` | AimingState | 瞄准状态 |
| `weaponDamages` | Record<string, number> | 各武器伤害缓存 |

### 3.8 道具/消耗品属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `inventory` | InventoryItem[] | 道具库存 |
| `consumableInventory` | Record<string, number> | 消耗品库存 |
| `itemCooldowns` | Record<string, number> | 道具冷却计时器 |
| `consumableCooldowns` | Record<string, number> | 消耗品冷却计时器 |
| `globalConsumableCooldown` | number | 全局消耗品冷却 |
| `combatStartTimer` | number | 战斗开始锁定计时器 |
| `selectedItems` | string[] | 已选道具 |
| `itemRevealData` | ItemRevealData[] | 物品揭示数据 |
| `itemDropOnField` | WeaponDrop | 场上掉落物品 |

### 3.9 图片资源 (~50 张)

| 属性 | 说明 |
|------|------|
| `gunImg` | 火焰喷射器图片 |
| `roachImg` | 默认蟑螂图片 |
| `bgImg` | 背景图片 |
| `roachSmallImg` | 小蟑螂图片 |
| `roachLargeImg` | 大蟑螂图片 |
| `roachFlyingImg` | 飞行蟑螂图片 |
| `roachArmoredImg` | 装甲蟑螂图片 |
| `roachSplittingImg` | 分裂蟑螂图片 |
| `roachSuicideImg` | 自爆蟑螂图片 |
| `roachQueenImg` | 蟑螂女王图片 |
| `roachNurseImg` | 护士蟑螂图片 |
| `roachMutantImg` | 变异蟑螂图片 |
| `roachTimedSuicideImg` | 定时自爆蟑螂图片 |
| `roachTimedBombImg` | 定时炸弹图片 |
| `roachGhostImg` | 幽灵蟑螂图片 |
| `roachFlyingSuicideImg` | 飞行自爆蟑螂图片 |
| `roachEggImg` | 虫卵图片 |
| `roachEmbryoImg` | 胚胎图片 |
| `sceneBgImgs` | 各场景背景图 |
| `weaponDropImgs` | 各武器掉落图标 |
| `itemImgs` | 各道具图标 |

### 3.10 回调函数

| 回调 | 签名 | 触发时机 |
|------|------|----------|
| `onStateChange` | (state: GameState) => void | 状态变化时 |
| `onEconomyUpdate` | (economy: Economy) => void | 经济变化时 |
| `onWaveUpdate` | (wave: number, total: number) => void | 波次变化时 |
| `onDefenseUpdate` | (defense: number) => void | 防线 HP 变化时 |
| `onGameOver` | (reason: string) => void | 游戏失败时 |
| `onBossUpdate` | (state: BossBattleState) => void | Boss 状态变化时 |
| `onConsumableUpdate` | (inventory: Record<string, number>) => void | 消耗品库存变化时 |
| `onInventoryUpdate` | (inventory: InventoryItem[]) => void | 道具库存变化时 |
| `onPlayerUpdate` | (player: Player) => void | 玩家状态变化时 |
| `onWaveCompleted` | () => void | 波次完成时 |

---

## 4. 方法清单

### 4.1 生命周期方法 (8 个)

| 方法 | 参数 | 返回值 | 功能 |
|------|------|--------|------|
| `constructor()` | canvas: HTMLCanvasElement | void | 初始化画布、加载图片、读档、创建玩家 |
| `resize()` | 无 | void | 响应式画布尺寸适配 |
| `loadImages()` | 无 | Promise<void> | 异步加载全部游戏图片资源 |
| `start()` | mode, scene, keepShopUpgrades, selectedItems, initialMoney | void | 启动游戏，重置状态，开始波次 |
| `stop()` | 无 | void | 停止游戏，取消动画帧，停止音频 |
| `pause()` | 无 | void | 暂停游戏 |
| `resume()` | 无 | void | 恢复游戏 |
| `restart()` | 无 | void | 重新开始当前关卡 |

### 4.2 主循环 (3 个)

| 方法 | 参数 | 返回值 | 功能 |
|------|------|--------|------|
| `gameLoop()` | now: number | void | requestAnimationFrame 回调，驱动 update() + render() |
| `update()` | 无 | void | 每帧逻辑更新，按顺序调用所有子系统 |
| `render()` | 无 | void | 主渲染入口，按顺序调用所有子渲染 |

### 4.3 玩家系统 (6 个)

| 方法 | 功能 |
|------|------|
| `createPlayer()` | 创建玩家属性 |
| `createEconomy(initialMoney?)` | 创建经济系统 |
| `updatePlayer()` | 更新玩家位置、火焰喷射器状态 |
| `updateFlamethrower(dt)` | 更新火焰喷射器逻辑 |
| `updatePoisonSpray(dt)` | 更新毒雾喷射 |
| `updateShotgun(dt)` | 更新霰弹枪 |

### 4.4 敌人系统 (15 个)

| 方法 | 功能 |
|------|------|
| `spawnRoach(type, clusterId?)` | 生成蟑螂（支持多种类型、地面边界计算） |
| `updateRoaches()` | 更新所有蟑螂 AI（移动、攻击、特殊行为） |
| `updateStatusEffects(r)` | 更新状态效果（燃烧、减速、眩晕等） |
| `applyDamageToRoach(r, damage, index, source?)` | 对蟑螂造成伤害 |
| `killRoach(r, index)` | 蟑螂死亡处理 |
| `forceEmbryoBurst(r, index)` | 胚胎爆裂 |
| `spawnEmbryoRoaches(x, y, count)` | 生成胚胎蟑螂 |
| `mutantDeathEffect(r, index)` | 突变体死亡特效 |
| `suicideExplode(r, index)` | 自爆蟑螂爆炸 |
| `triggerBreachExplosion(r)` | 防线突破爆炸 |
| `triggerPanicOnArmorBreak(r)` | 护甲破裂触发恐慌 |
| `createSmallRoachFromSplit(x, y)` | 分裂生成小蟑螂 |
| `spawnSwatterPickup(x, y)` | 电蚊拍拾取 |

### 4.5 波次系统 (6 个)

| 方法 | 功能 |
|------|------|
| `updateWave()` | 波次管理（自动推进、生成、清除） |
| `startWave()` | 开始新波次 |
| `startCountdown()` | 3-2-1 倒计时 |
| `doWaveSpawn()` | 执行波次生成 |
| `getWaveConfig(wave)` | 获取波次配置 |
| `continueFromShop()` | 商店结束后继续下一波 |

### 4.6 Boss 战斗 (12 个)

| 方法 | 功能 |
|------|------|
| `initBossBattle()` | 初始化 Boss 战 |
| `spawnBoss()` | 生成 Boss |
| `updateBossBattle()` | Boss 战逻辑更新（多阶段） |
| `updateBossDeathSequence()` | Boss 死亡动画更新 |
| `triggerBossDeathSequence()` | Boss 死亡序列 |
| `updateEggPodSystem()` | 虫卵系统更新 |
| `updateEggPods()` | 虫卵更新 |
| `startBossSummonCast(wave)` | Boss 召唤施法 |
| `spawnEggWave(wave)` | 虫卵波次生成 |
| `startBossDialogue()` | Boss 对话系统 |
| `gameVictory()` | 游戏胜利处理 |
| `gameDefeat()` | 游戏失败处理 |

### 4.7 碰撞检测 (5 个)

| 方法 | 功能 |
|------|------|
| `checkCollisions()` | 火焰/武器碰撞检测 |
| `checkDefense()` | 防线突破检测 |
| `getWeaponDamage(p)` | 获取武器伤害值 |
| `applyWeaponEffect(r, weapon)` | 应用武器特殊效果 |
| `isStuckByBoard(roachId)` | 检查蟑螂是否被粘板粘住 |

### 4.8 武器系统 (15 个)

| 方法 | 功能 |
|------|------|
| `switchWeapon(weapon)` | 切换武器 |
| `useSwatter()` | 使用电蚊拍 |
| `throwMolotov()` | 投掷燃烧瓶 |
| `spawnMolotovProjectile(x, y, angle)` | 生成燃烧瓶弹道 |
| `activateTripleFlame()` | 激活三连火焰 |
| `updateTripleFlame(dt)` | 更新三连火焰 |
| `activateRadarLaser()` | 激活雷达激光 |
| `updateRadarLaser(dt)` | 更新雷达激光 |
| `activateInsecticideSpray()` | 激活杀虫喷雾 |
| `updateInsecticideSpray(dt)` | 更新杀虫喷雾 |
| `spawnInsecticideParticles(x, y, count)` | 杀虫剂粒子 |
| `spawnInsecticideFade(x, y)` | 杀虫剂消散 |
| `applyInsecticideDamage(x, y, radius, damage)` | 杀虫剂伤害 |
| `activateStickySpray()` | 激活粘性喷雾 |
| `scheduleStickyDrop(x, y)` | 安排粘性掉落 |

### 4.9 瞄准/投掷 (6 个)

| 方法 | 功能 |
|------|------|
| `startAiming()` | 开始瞄准 |
| `updateAiming()` | 更新瞄准状态 |
| `adjustAim(dx, dy)` | 调整瞄准方向 |
| `throwAimedWeapon()` | 投掷瞄准武器 |
| `cancelAiming()` | 取消瞄准 |
| `updateThrowables(dt)` | 更新飞行中的投掷物 |

### 4.10 道具系统 (10 个)

| 方法 | 功能 |
|------|------|
| `spawnWeaponDrop(x, y, weaponType?)` | 生成武器掉落 |
| `pickupWeaponDrop(drop)` | 拾取武器掉落 |
| `updateWeaponDrops(dt)` | 更新武器掉落 |
| `selectItem(itemId)` | 选择物品 |
| `onItemFirstClick(x, y)` | 物品首次点击 |
| `onItemDrag(x, y)` | 物品拖拽 |
| `onItemRelease()` | 物品释放 |
| `cancelItemPlacement()` | 取消物品放置 |
| `completeItemReveal()` | 完成物品揭示 |
| `handleItemDropClick(clientX, clientY)` | 处理物品掉落点击 |

### 4.11 消耗品系统 (8 个)

| 方法 | 功能 |
|------|------|
| `buyConsumable(id)` | 购买消耗品 |
| `useConsumable(id)` | 使用消耗品 |
| `toggleAutoUse(id)` | 切换自动使用 |
| `checkAutoUseConsumables()` | 检查自动使用 |
| `updateConsumableEffects(dt)` | 更新消耗品效果 |
| `updateBuffFlashTimers(dt)` | 更新 Buff 闪烁 |
| `sellUnusedInventory()` | 出售未使用库存 |
| `applyRecycledGold()` | 应用回收金币 |

### 4.12 粒子系统 (14 个)

| 方法 | 功能 |
|------|------|
| `spawnConeFire(...)` | 锥形火焰粒子 |
| `spawnSmokeParticles(x, y, count)` | 烟雾粒子 |
| `spawnAshParticles(x, y, count)` | 灰烬粒子 |
| `spawnBloodParticles(x, y, count)` | 血液粒子 |
| `spawnSparkParticles(x, y, count)` | 火花粒子 |
| `spawnExplosionParticles(x, y, count)` | 爆炸粒子 |
| `spawnDebrisParticles(x, y, count)` | 碎片粒子 |
| `spawnFireRingParticles(x, y, radius)` | 火环粒子 |
| `spawnShockwaveRing(x, y, radius)` | 冲击波环 |
| `spawnLightningParticles(centerX, topY)` | 闪电粒子 |
| `addFloatingText(...)` | 浮动文字 |
| `updateParticles()` | 更新所有粒子 |
| `updateFloatingTexts()` | 更新浮动文字 |

### 4.13 场景特效 (8 个)

| 方法 | 功能 |
|------|------|
| `updateFireZones()` | 更新火焰区域 |
| `updateFireWalls()` | 更新火墙 |
| `updateStickyBoards()` | 更新粘板 |
| `updateStickyDrops()` | 更新粘性掉落 |
| `updateScreenShake()` | 更新屏幕震动 |
| `updateSwatter()` | 更新电蚊拍 |
| `activateFan()` | 激活风扇 |
| `updateFan()` | 更新风扇 |

### 4.14 渲染系统 (30 个)

| 方法 | 功能 |
|------|------|
| `render()` | 主渲染入口 |
| `renderBackground(ctx, w, h)` | 背景渲染 |
| `renderWeatherBackground(ctx, w, h)` | 天气背景 |
| `renderWeatherForeground(ctx, w)` | 天气前景 |
| `renderDefenseLine(ctx, w)` | 防线渲染 |
| `renderMovementRange(ctx)` | 移动范围 |
| `renderFireZones(ctx)` | 火焰区域 |
| `renderFireWalls(ctx)` | 火墙 |
| `renderStickyBoards()` | 粘板 |
| `renderStickyDrops(ctx)` | 粘性掉落 |
| `renderWeaponDrops(ctx)` | 武器掉落 |
| `renderBaitThrow(ctx)` | 诱饵投掷 |
| `renderBaitMark(ctx)` | 诱饵标记 |
| `renderParticles(ctx)` | 粒子 |
| `renderRoaches(ctx)` | 全部蟑螂 |
| `renderRoach(ctx, r)` | 单个蟑螂（含动画帧） |
| `renderPlayer(ctx)` | 玩家 |
| `renderItemPlacement(ctx)` | 物品放置 |
| `renderThrowableAim(ctx)` | 瞄准线 |
| `renderThrowables(ctx)` | 投掷物 |
| `renderSwatter(ctx)` | 电蚊拍 |
| `renderMuzzleFlash(ctx)` | 枪口火焰 |
| `renderFloatingTexts(ctx)` | 浮动文字 |
| `renderBossUI(ctx, w, h)` | Boss UI 叠加层 |
| `renderInsecticideSpray(ctx)` | 杀虫喷雾 |
| `renderRadarLaser(ctx)` | 雷达激光 |
| `renderFan(ctx)` | 风扇 |
| `renderItemDropOnField(ctx)` | 场上掉落物品 |
| `renderHospitalEggPods(ctx)` | 医院虫卵 |
| `renderEggPods(ctx, pods)` | 虫卵通用 |

### 4.15 存档系统 (6 个)

| 方法 | 功能 |
|------|------|
| `loadProgress()` | 加载存档 (含版本迁移) |
| `saveProgress()` | 保存存档 |
| `recalcTalentMultipliers()` | 重新计算天赋加成 |
| `checkAchievements()` | 检查成就 |
| `unlockNextScene()` | 解锁下一场景 |
| `loadEndlessBestTime()` / `saveEndlessBestTime()` | 无尽模式最佳时间 |

### 4.16 输入处理 (6 个)

| 方法 | 功能 |
|------|------|
| `setMousePos(x, y)` | 设置鼠标位置 |
| `setMouseX(x)` | 设置鼠标 X 坐标 |
| `handleScreenClick(x, y)` | 处理屏幕点击 |
| `setFiring(firing)` | 设置开火状态 |
| `setFlameMode()` | 设置火焰模式 |
| `cycleFlameMode()` | 切换火焰模式 |

### 4.17 医院专属 (5 个)

| 方法 | 功能 |
|------|------|
| `spawnHospitalEggPods(config)` | 生成医院虫卵 |
| `updateHospitalEggPods()` | 更新医院虫卵 |
| `hatchHospitalEggPod(pod)` | 虫卵孵化 |
| `damageHospitalEggPod(pod, damage)` | 虫卵受伤 |
| `triggerDisinfectionReward()` | 消毒奖励 |

---

## 5. 调用链路

### 5.1 启动流程

```
外部: const engine = new GameEngine(canvas)
  └─> constructor(canvas)
       ├─> resize()                    // 计算画布尺寸
       ├─> loadImages()                // 异步加载 ~50 张图片
       ├─> loadProgress()              // 从 localStorage 读取存档
       ├─> createPlayer()              // 创建玩家属性
       ├─> createEconomy()             // 创建经济系统
       ├─> loadEndlessBestTime()       // 读取无尽最佳时间
       └─> recalcTalentMultipliers()   // 计算天赋加成

外部: engine.start(GameMode.STORY, SceneType.KITCHEN, false, [], 0)
  └─> start(mode, scene, keepShopUpgrades, selectedItems, initialMoney)
       ├─> 设置 gameMode / currentScene / difficulty
       ├─> 设置 selectedItems / consumableInventory
       ├─> resetGame(initialMoney)
       │    ├─> createPlayer()
       │    ├─> createEconomy(initialMoney)
       │    ├─> 清空所有实体数组
       │    ├─> 重置波次/计时器
       │    └─> 根据模式初始化 (Boss → initBossBattle, Daily → getDailySeed)
       ├─> startWave()
       │    ├─> 获取波次配置
       │    ├─> 如有配置 → startCountdown()
       │    └─> 如无配置 → 游戏结束
       └─> gameLoop(this.lastTime)     // 进入主循环
```

### 5.2 主循环

```
gameLoop(now)
  ├─> 计算 deltaTime (限制最大 100ms)
  ├─> 帧时间采样 (前 120 帧)
  ├─> 动态调整粒子数量上限
  │
  ├─> update()                        // 逻辑更新
  │    ├─> [状态检查] COUNTDOWN → 倒计时逻辑
  │    ├─> [状态检查] ITEM_DROP → 物品掉落动画
  │    ├─> [状态检查] ITEM_REVEAL → 物品揭示动画
  │    ├─> [状态检查] WAVE_CLEAR → 仅更新特效
  │    │
  │    ├─> updateArmorShieldCache()   // 护甲肉盾缓存
  │    ├─> updatePlayer()             // 玩家位置 + 武器
  │    ├─> updateRoaches()            // 蟑螂 AI（最长子模块）
  │    ├─> updateConsumableEffects()  // 消耗品效果
  │    ├─> checkAutoUseConsumables()  // 自动使用消耗品
  │    ├─> updateBuffFlashTimers()    // Buff 闪烁计时器
  │    ├─> updateParticles()          // 粒子更新
  │    ├─> updateFloatingTexts()      // 浮动文字
  │    ├─> updateFireZones()          // 火焰区域
  │    ├─> updateFireWalls()          // 火墙
  │    ├─> updateStickyBoards()       // 粘板
  │    ├─> updateStickyDrops()        // 粘性掉落
  │    ├─> updateBossBattle() / updateWave()  // Boss 或普通波次
  │    ├─> updateScreenShake()        // 屏幕震动
  │    ├─> updateSwatter()            // 电蚊拍
  │    ├─> updateWeaponDrops()        // 武器掉落
  │    ├─> updateAiming()             // 瞄准
  │    ├─> updateThrowables()         // 飞行中的投掷物
  │    ├─> updateTripleFlame()        // 三连火焰
  │    ├─> updateRadarLaser()         // 雷达激光
  │    ├─> updateInsecticideSpray()   // 杀虫喷雾
  │    ├─> updateFan()                // 风扇
  │    ├─> updateWeather()            // 天气
  │    ├─> checkCollisions()          // 碰撞检测
  │    ├─> checkDefense()             // 防线检测
  │    └─> checkAchievements()        // 成就检查
  │
  ├─> render()                        // 渲染
  │    ├─> renderBackground()         // 背景图
  │    ├─> renderMovementRange()      // 移动范围
  │    ├─> renderWeatherBackground()  // 天气背景
  │    ├─> renderFireZones()          // 火焰区域
  │    ├─> renderFireWalls()          // 火墙
  │    ├─> renderStickyBoards()       // 粘板
  │    ├─> renderStickyDrops()        // 粘性掉落
  │    ├─> renderWeaponDrops()        // 武器掉落
  │    ├─> renderParticles()          // 粒子
  │    ├─> renderBaitMark()           // 诱饵标记
  │    ├─> renderRoaches()            // 蟑螂（逐个 renderRoach）
  │    ├─> renderBaitThrow()          // 诱饵投掷
  │    ├─> renderPlayer()             // 玩家
  │    ├─> renderFloatingTexts()      // 浮动文字
  │    ├─> renderSwatter()            // 电蚊拍
  │    ├─> renderMuzzleFlash()        // 枪口火焰
  │    ├─> renderThrowableAim()       // 瞄准线
  │    ├─> renderThrowables()         // 飞行中的投掷物
  │    ├─> renderItemPlacement()      // 物品放置
  │    ├─> renderInsecticideSpray()   // 杀虫喷雾
  │    ├─> renderFan()                // 风扇
  │    ├─> renderRadarLaser()         // 雷达激光
  │    ├─> renderWeatherForeground()  // 天气前景
  │    ├─> renderBossUI()             // Boss UI 叠加层
  │    └─> renderItemDropOnField()    // 战后掉落物品
  │
  └─> requestAnimationFrame(gameLoop) // 请求下一帧
```

### 5.3 玩家输入链路

```
外部: engine.setMousePos(clientX, clientY)
  └─> setMousePos(x, y)
       ├─> 转换坐标 (client → game)
       ├─> 更新 player.x
       └─> 更新 mouseX, mouseY

外部: engine.setFiring(true)
  └─> setFiring(firing)
       ├─> 设置 isFiring
       └─> 触发音频/震动

外部: engine.handleScreenClick(x, y)
  └─> handleScreenClick(x, y)
       ├─> 设置鼠标位置
       ├─> [ITEM_REVEAL] → completeItemReveal()
       ├─> [ITEM_DROP] → handleItemDropClick()
       ├─> [道具拖拽] → onItemRelease()
       └─> [电蚊拍] → useSwatter()

外部: engine.cycleFlameMode()
  └─> cycleFlameMode()
       └─> 切换 flamethrower ↔ poison_spray ↔ shotgun
```

### 5.4 武器使用链路

```
外部: engine.useSwatter()
  └─> useSwatter()
       ├─> 消耗电蚊拍
       ├─> 全屏闪电粒子
       ├─> 对所有蟑螂造成伤害
       └─> 触发震动

外部: engine.startAiming()
  └─> startAiming()
       └─> 设置 aimingState

外部: engine.throwAimedWeapon()
  └─> throwAimedWeapon()
       ├─> 计算投掷方向
       ├─> [燃烧瓶] → throwMolotov()
       └─> 加入 throwables 数组
```

### 5.5 物品使用链路

```
外部: engine.selectItem('sticky')
  └─> selectItem('sticky')
       ├─> 检查库存
       ├─> 设置 selectedItem
       └─> 进入 ITEM_PLACEMENT 状态

外部: engine.handleScreenClick(x, y) [在 ITEM_PLACEMENT 状态]
  └─> onItemRelease()
       ├─> [粘板] → applyStickyBoardEffect()
       ├─> [风扇] → activateFan()
       ├─> [燃烧瓶] → activateMolotovFireWall()
       └─> 减少库存，触发冷却
```

### 5.6 消耗品使用链路

```
外部: engine.buyConsumable('gas_refill')
  └─> buyConsumable('gas_refill')
       ├─> 检查资金
       ├─> 增加库存
       └─> 减少资金

外部: engine.useConsumable('gas_refill')
  └─> useConsumable('gas_refill')
       ├─> 检查库存和冷却
       ├─> [gas_refill] → 回满燃气
       ├─> [defense_repair] → 修复防线
       ├─> [emergency_cool] → 清除过热
       ├─> [power_boost] → 设置伤害加倍
       ├─> [shield] → 设置护盾
       ├─> [bait] → 设置诱饵目标
       └─> 减少库存，触发冷却
```

---

## 6. 关键子系统详解

### 6.1 游戏状态机

```
                         ┌──────────────┐
                         │    MENU      │
                         └──────┬───────┘
                                │ start()
                                ▼
                         ┌──────────────┐
                         │  COUNTDOWN   │ (3-2-1)
                         └──────┬───────┘
                                │ 倒计时结束
                                ▼
              ┌──────────────────────────────────┐
              │            PLAYING               │
              │  ┌───────────┐  ┌─────────────┐  │
              │  │ 常规波次  │  │ Boss 波次   │  │
              │  │ updateWave│  │updateBossBtl│  │
              │  └───────────┘  └─────────────┘  │
              └───────┬──────────────┬───────────┘
                      │              │
                 波次清除          Boss 被击败
                      │              │
                      ▼              ▼
              ┌──────────────┐  ┌──────────────┐
              │  WAVE_CLEAR  │  │  ITEM_DROP   │
              │  (商店)      │  │  (战后掉落)  │
              └──────┬───────┘  └──────┬───────┘
                     │                 │
                 continueFromShop()    │
                     │                 ▼
                     ▼          ┌──────────────┐
              回到 PLAYING       │ ITEM_REVEAL  │
                                 │ (物品揭示)   │
                                 └──────┬───────┘
                                        │
                                        ▼
                                  ┌──────────────┐
                                  │    MENU      │
                                  └──────────────┘

                    防线被突破
                         │
                         ▼
                  ┌──────────────┐
                  │  GAME_OVER   │
                  └──────┬───────┘
                         │
                         ▼
                        MENU
```

### 6.2 敌人生成流程

```
spawnRoach(type, clusterId?)
  ├─> 获取敌人类别定义 (ENEMY_DEFS)
  ├─> 计算初始位置 (地面边界内)
  │    ├─> 普通蟑螂 → 远端正中间
  │    ├─> 飞行蟑螂 → 屏幕两侧
  │    └─> 蟑螂女王 → 屏幕中央上方
  ├─> 创建 Roach 实例
  │    ├─> id: nextId++
  │    ├─> 属性: HP, speed, size, reward 等
  │    ├─> 状态: RoachState.IDLE
  │    ├─> 特殊字段: [armor, splitCount, fuseTimer, healTimer 等]
  │    └─> 形态框: morphFrames (变异专用)
  ├─> 加入 roaches 数组
  └─> 更新图鉴 (ENCYCLOPEDIA_DEFS)
```

### 6.3 敌人 AI 更新流程

```
updateRoaches()
  └─> 遍历所有蟑螂 (roaches)
       ├─> [状态效果] updateStatusEffects(r)
       │    ├─> 燃烧: HP 持续减少
       │    ├─> 减速: 速度降低
       │    └─> 眩晕: 停止移动
       │
       ├─> [粘板检测] isStuckByBoard(r.id)
       │    └─> 被粘住 → 跳过移动
       │
       ├─> [定时炸弹] timed_suicide 倒计时
       │    └─> 倒计时结束 → 爆炸
       │
       ├─> [移动逻辑]
       │    ├─> 普通蟑螂: 随机游走 + 向防线偏移
       │    ├─> 飞行蟑螂: 空中移动 + 飞行高度
       │    ├─> 自爆蟑螂: 直线冲向防线
       │    ├─> 护士蟑螂: 跟随其他蟑螂 + 治疗
       │    └─> 蟑螂女王: 悬停 + 召唤
       │
       ├─> [特殊行为]
       │    ├─> 大蟑螂愤怒: HP < 50% → 速度 ×1.5
       │    ├─> 飞行蟑螂闪避: 受攻击 → 横向躲闪
       │    └─> 护士蟑螂治疗: 5s 间隔 → 治疗 3 格内最低 HP 盟友
       │
       ├─> [死亡检测] HP <= 0
       │    ├─> 分裂蟑螂 → spawnEmbryoRoaches(5)
       │    ├─> 变异蟑螂 → mutantDeathEffect()
       │    ├─> 自爆蟑螂 → suicideExplode()
       │    ├─> 蟑螂女王 → triggerBossDeathSequence()
       │    └─> 普通 → killRoach()
       │
       └─> [防线检测] 到达防线 → triggerBreachExplosion()
```

### 6.4 碰撞检测流程

```
checkCollisions()
  └─> 遍历所有火焰粒子 (particles)
       ├─> 跳过同帧已检测的粒子
       ├─> 遍历所有蟑螂 (roaches)
       │    ├─> 跳过已死亡/即将死亡的
       │    ├─> 距离检测 (粒子 vs 蟑螂)
       │    ├─> [飞行蟑螂特殊处理] 飞行高度允许额外命中
       │    ├─> 命中 → applyDamageToRoach()
       │    │    ├─> 装甲蟑螂: 先扣护甲
       │    │    ├─> 普通蟑螂: 直接扣 HP
       │    │    └─> 触发伤害特效
       │    └─> 记录命中 (防止同帧重复处理)
       │
       └─> 标记粒子为已检测
```

### 6.5 波次推进流程

```
updateWave()
  ├─> [跳过检查] ITEM_DROP / ITEM_REVEAL → 不处理
  ├─> [波次刚清除]
  │    ├─> 暂停波次推进
  │    ├─> [故事模式] → WAVE_CLEAR (显示商店)
  │    ├─> [无尽模式] → 自动进入下一波
  │    └─> [Boss 模式] → 特殊处理
  │
  ├─> [波次生成中]
  │    ├─> spawnTimer 倒计时
  │    ├─> 时间到 → 从 spawnQueue 取一个 → spawnRoach()
  │    └─> spawnQueue 为空 → waveSpawning = false
  │
  ├─> [波次检查]
  │    ├─> 场上无蟑螂 + 生成完毕 → waveJustCleared = true
  │    ├─> 是最后一波 → 游戏胜利
  │    └─> 否则 → wave++, startWave()
  │
  └─> [特殊处理]
       ├─> [医院场景] 额外生成虫卵
       └─> [Boss 模式] 委托给 updateBossBattle()
```

### 6.6 渲染管线

```
render()
  ├─> 清屏
  ├─> [1] renderBackground(ctx, w, h)         // 场景背景图
  ├─> [2] renderMovementRange(ctx)             // 玩家移动范围线
  ├─> [3] renderWeatherBackground(ctx, w, h)   // 天气背景 (雾/夜幕)
  ├─> [4] renderFireZones(ctx)                 // 火焰区域
  ├─> [5] renderFireWalls(ctx)                 // 火墙
  ├─> [6] renderStickyBoards()                 // 粘板
  ├─> [7] renderStickyDrops(ctx)               // 粘性掉落
  ├─> [8] renderWeaponDrops(ctx)               // 武器掉落
  ├─> [9] renderParticles(ctx)                 // 粒子
  ├─> [10] renderBaitMark(ctx)                 // 诱饵标记
  ├─> [11] renderRoaches(ctx)                  // 蟑螂 (逐个 renderRoach)
  │     └─> renderRoach(ctx, r) [每个蟑螂]
  │          ├─> 透视缩放
  │          ├─> 动画帧选择
  │          ├─> 绘制虫体
  │          ├─> 绘制护甲 (装甲蟑螂)
  │          ├─> 绘制 HP 条
  │          └─> 绘制状态效果
  ├─> [12] renderBaitThrow(ctx)                // 诱饵投掷
  ├─> [13] renderPlayer(ctx)                   // 玩家
  ├─> [14] renderFloatingTexts(ctx)            // 浮动文字
  ├─> [15] renderSwatter(ctx)                  // 电蚊拍
  ├─> [16] renderMuzzleFlash(ctx)              // 枪口火焰
  ├─> [17] renderThrowableAim(ctx)             // 瞄准线
  ├─> [18] renderThrowables(ctx)               // 飞行中的投掷物
  ├─> [19] renderItemPlacement(ctx)            // 物品放置预览
  ├─> [20] renderInsecticideSpray(ctx)         // 杀虫喷雾
  ├─> [21] renderFan(ctx)                      // 风扇
  ├─> [22] renderRadarLaser(ctx)               // 雷达激光
  ├─> [23] renderWeatherForeground(ctx, w)     // 天气前景 (雨滴)
  ├─> [24] renderBossUI(ctx, w, h)             // Boss UI 叠加层
  └─> [25] renderItemDropOnField(ctx)          // 战后掉落物品
```

---

## 7. 外部接口

### 7.1 引擎控制接口

| 方法 | 调用方 | 说明 |
|------|--------|------|
| `start(mode, scene, ...)` | GameCanvas | 启动游戏 |
| `stop()` | GameCanvas | 停止游戏 |
| `pause()` | GameCanvas | 暂停游戏 |
| `resume()` | GameCanvas | 恢复游戏 |
| `restart()` | GameCanvas | 重新开始 |

### 7.2 输入接口

| 方法 | 调用方 | 说明 |
|------|--------|------|
| `setMousePos(x, y)` | GameCanvas | 设置鼠标位置 |
| `setMouseX(x)` | GameCanvas | 设置鼠标 X 坐标 |
| `handleScreenClick(x, y)` | GameCanvas | 处理屏幕点击 |
| `setFiring(firing)` | GameCanvas | 设置开火状态 |
| `cycleFlameMode()` | GameCanvas / UI | 切换火焰模式 |

### 7.3 武器/道具接口

| 方法 | 调用方 | 说明 |
|------|--------|------|
| `useSwatter()` | GameCanvas | 使用电蚊拍 |
| `startAiming()` | GameCanvas | 开始瞄准 |
| `throwAimedWeapon()` | GameCanvas | 投掷 |
| `cancelAiming()` | GameCanvas | 取消瞄准 |
| `selectItem(itemId)` | GameCanvas / UI | 选择物品 |
| `handleItemDropClick(x, y)` | UI | 处理掉落点击 |
| `buyConsumable(id)` | UI | 购买消耗品 |
| `useConsumable(id)` | UI | 使用消耗品 |
| `toggleAutoUse(id)` | UI | 切换自动使用 |

### 7.4 回调接口

| 回调 | 使用者 | 说明 |
|------|--------|------|
| `onStateChange` | UI Manager | 状态变化通知 |
| `onEconomyUpdate` | Shop UI | 经济变化通知 |
| `onWaveUpdate` | HUD | 波次变化通知 |
| `onDefenseUpdate` | HUD | 防线 HP 通知 |
| `onGameOver` | GameOverScreen | 游戏结束通知 |
| `onBossUpdate` | Boss UI | Boss 状态通知 |
| `onConsumableUpdate` | HUD | 消耗品库存通知 |
| `onInventoryUpdate` | HUD | 道具库存通知 |
| `onPlayerUpdate` | HUD | 玩家状态通知 |
| `onWaveCompleted` | Shop UI | 波次完成通知 |

---

## 8. 与新引擎的对比

| 维度 | 旧引擎 (engine.ts) | 新引擎 (engine/index.ts + 模块) |
|------|-------------------|------------------------------|
| 文件数 | 1 | 12+ |
| 代码行数 | ~10,000 | 分散在各模块 |
| 架构 | 单文件巨型类 | 模块化系统拆分 |
| 属性数 | ~200 (全部在 GameEngine) | 各系统独立管理 |
| 方法数 | ~180 (全部在 GameEngine) | 各系统独立方法 |
| 可维护性 | 低 | 高 |
| 可测试性 | 难 (无法单元测试) | 易 (各系统独立测试) |
| 代码复用 | 不可复用 | 系统间可复用 |
| 新增功能 | 需要修改巨型类 | 新增独立模块即可 |
| 并行开发 | 困难 (文件冲突) | 容易 (不同文件) |

### 8.1 新引擎模块映射

| 旧引擎模块 | 新引擎对应模块 |
|-----------|---------------|
| 玩家系统 | `engine/player/PlayerControlSystem.ts` |
| 经济系统 | `engine/economy/EconomyManager.ts` |
| 波次系统 | `engine/wave/WaveManager.ts` |
| 武器系统 | `engine/weapon/WeaponSystem.ts`, `WeaponManager.ts` |
| 碰撞检测 | `engine/collision/CollisionSystem.ts` |
| 敌人 AI | `engine/ai/RoachAISystem.ts` |
| 存档系统 | `engine/save/SaveSystem.ts`, `ProgressManager.ts` |
| 成就系统 | `engine/achievement/AchievementSystem.ts` |
| 商店系统 | `engine/economy/ShopManager.ts` |
| UI 管理 | `engine/ui/UIManager.ts` |
| 统计系统 | `engine/stats/StatsSystem.ts` |
| 性能监控 | `engine/performance/PerformanceMonitorSystem.ts` |

---

> 本文档基于 `src/game/engine.ts` (v2.6, ~10,000 行) 源码分析生成，反映旧引擎的完整架构和调用逻辑。