# 新引擎缺失内容补充修复报告

> 基于 [NEW_ENGINE_MODULE_ANALYSIS.md](NEW_ENGINE_MODULE_ANALYSIS.md) 的分析结果，对 `src/game/engine/` 目录下的代码进行了系统性补充修复。

---

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `engine/ai/RoachAISystem.ts` | 大幅修改 | 补全 TODO、添加回调、修复特殊行为 |
| `engine/player/PlayerControlSystem.ts` | 小幅修改 | 添加锥形火焰粒子生成回调 |
| `engine/particle/ParticleSystem.ts` | 中幅修改 | 添加 getter 方法 + `spawnConeFire()` 锥形火焰算法 |
| `engine/entity/EntityManager.ts` | 中幅修改 | 添加 `spawnQueenEggs()` / `spawnEmbryoRoaches()` |
| `engine/item/ItemManagementSystem.ts` | 小幅修改 | 添加 `onStateChange` 回调 |
| `engine/NewGameEngine.ts` | 大幅修改 | 渲染管线、状态机、胜利流程、回调集成、清理测试代码 |
| `components/game/GameCanvas.tsx` | 小幅修改 | 删除重复 `handleRestart` 声明 |
| `components/game/GameHUD.tsx` | 小幅修改 | 补上未闭合 `</div>` |
| `components/game/ShopScreen.tsx` | 小幅修改 | 补上未闭合 `</div>` |
| `components/game/TalentTreeScreen.tsx` | 小幅修改 | 删除多余 `)` 字符 |
| `components/game/GameMenu.tsx` | 小幅修改 | 删除 6 处多余 `)` 字符 |

---

## 一、P0 修复：渲染管线

### 问题
`renderGameplay()` 中构建的 `renderData` 是硬编码的空数据结构，所有数组（`roaches`, `particles`, `fireZones` 等）均为空，导致渲染管线无法显示真实游戏画面。

### 修复
将所有硬编码的空数组替换为从各模块获取的真实数据，使用 `try-catch` 保护确保稳定性：

```typescript
// 修复前
const renderData = {
  roaches: [],
  particles: [],
  fireZones: [],
  ...
};

// 修复后
let roaches: any[] = [];
try { roaches = this.entityManager.getRoaches(); } catch (e) { /* ignore */ }

let particles: any[] = [];
try {
  const ps = this.particleSystem.getState();
  particles = ps.particles;
  fireZones = ps.fireZones;
  fireWalls = ps.fireWalls;
  floatingTexts = ps.floatingTexts;
} catch (e) { /* ignore */ }
// ... 其余 12 个数据源同理
```

**数据源映射：**

| 渲染数据字段 | 数据来源模块 |
|-------------|-------------|
| `roaches` | `EntityManager.getRoaches()` |
| `particles` | `ParticleSystem.getState().particles` |
| `fireZones` | `ParticleSystem.getState().fireZones` |
| `fireWalls` | `ParticleSystem.getState().fireWalls` |
| `floatingTexts` | `ParticleSystem.getState().floatingTexts` |
| `weaponDrops` | `ItemManagementSystem.getWeaponDrops()` → 回退 `WeaponSystem.getWeaponDrops()` |
| `stickyBoards` | `StickySystem.getStickyBoards()` |
| `stickyDrops` | `StickySystem.getStickyDrops()` |
| `throwableProjectiles` | `ThrowableSystem.getThrowables()` |
| `fanStates` | `FanSystem.getState()` |
| `radarLasers` | `RadarLaserSystem.getRadarLasers()` |
| `itemDropsOnField` | `ItemSystem.getFieldItemDrop()` |
| `bossBattle` | `BossBattleSystem.getBossState()` |
| `weather` | `WeatherSystem.getWeatherType()` |

### 配套修改
- `ParticleSystem` 新增 `getState()`、`getFireWalls()`、`getFireZones()`、`getParticles()` 公共 getter 方法
- `renderCountdown()` 从 TODO 改为实际绘制倒计时数字和提示文字
- `renderVisualEffects()` 从 TODO 改为绘制游戏场景背景和物品掉落动画

---

## 二、P0 修复：火焰粒子生成

### 问题
`PlayerControlSystem.updateFlamethrower()` 中锥形火焰粒子生成被注释掉（`// this.spawnConeFire(...);`），玩家开火时无法产生火焰粒子。

### 修复
在 `PlayerControlSystemConfig` 中添加 `onSpawnConeFire` 回调，在 `updateFlamethrower()` 中调用：

```typescript
// 新增回调接口
onSpawnConeFire?: (params: {
  x: number; y: number; angle: number; range: number;
  spreadAngle: number; innerCount: number; outerCount: number;
  deltaTime: number;
}) => void;

// 调用位置（updateFlamethrower 中）
this.config.onSpawnConeFire?.({
  x: this.player.x,
  y: this.player.y - 40,
  angle: this.player.angle,
  range: this.player.fireRange,
  spreadAngle: Math.PI / 6,
  innerCount: 8,
  outerCount: 15,
  deltaTime: this.config.deltaTime,
});
```

在 `NewGameEngine` 构造函数中，`PlayerControlSystem` 的 `onSpawnConeFire` 回调已连接到引擎的粒子生成逻辑。

---

## 三、P1 修复：RoachAISystem 补全

### 3.1 新增回调接口

在 `RoachAISystemConfig` 接口中新增 9 个回调：

| 回调 | 类型 | 用途 |
|------|------|------|
| `onPlaySound` | `(soundId: string) => void` | 怪物专属音效 |
| `onVibrate` | `(pattern: string) => void` | 震动反馈 |
| `onAddFloatingText` | `(x, y, text, color, duration?) => void` | 浮动文字 |
| `onAddParticle` | `(particle: any) => void` | 粒子效果 |
| `onTriggerBreachExplosion` | `(roach: Roach) => void` | 定时自爆爆炸 |
| `onGetAllRoaches` | `() => Roach[]` | 获取所有蟑螂 |
| `onGetFireWalls` | `() => FireWall[]` | 获取火焰墙 |
| `onGetBaitTarget` | `() => { active, x, y } \| null` | 获取诱饵状态 |
| `onGetStickyBoards` | `() => StickyBoard[]` | 获取粘性板 |

### 3.2 修复的具体功能

**护士蟑螂治疗（`updateNurseRoach`）：**
- 修复前：`TODO: 需要访问所有蟑螂数组`，无法找到受伤盟友
- 修复后：通过 `this.roaches` 遍历所有蟑螂，找到 360px 范围内 HP < maxHP 的盟友，治疗 20% 最大HP
- 添加音效：进入充能阶段调用 `onPlaySound?.('nurse_cast')`
- 添加浮动文字：`'非法行医!'`、`'+N'` 治疗数字

**定时自爆蟑螂（`updateTimedSuicideRoach`）：**
- 添加爆炸音效：`onPlaySound?.('suicide_explode')`
- 添加震动：`onVibrate?.('suicide_explode')`
- 添加浮动文字：`'螂家爆破!'`、`'BOOM!'`、`'炸弹已安放!'`、`'变身大蟑螂!'`、`'炸弹没响...'`
- 触发爆炸回调：`onTriggerBreachExplosion?.(roach)`

**自杀蟑螂火花粒子（`updateSuicideRoach`）：**
- 修复前：`TODO: 生成火花粒子`
- 修复后：通过 `onAddParticle` 回调生成实际火花粒子

**火焰墙阻挡：**
- 修复前：`TODO: 需要访问火焰墙数组`
- 修复后：通过 `onGetFireWalls?.()` 获取火焰墙，在移动和闪避时进行阻挡

**诱饵系统：**
- 修复前：`TODO: 需要从游戏引擎获取诱饵状态`
- 修复后：通过 `onGetBaitTarget?.()` 获取诱饵状态，将蟑螂拉向诱饵

**粘性板检查（`isStuckByBoard`）：**
- 修复前：始终返回 `false`
- 修复后：通过 `onGetStickyBoards?.()` 检查蟑螂是否被困住

**护士移动跟随：**
- 修复前：`TODO: 需要访问所有蟑螂数组`
- 修复后：通过 `this.roaches` 遍历找到最近的非护士盟友进行跟随

---

## 四、P1 修复：状态机完善

### 问题
`checkWaveStatus()` 波次完成后直接调用 `startWave()` 启动下一波，跳过了 `WAVE_CLEAR` 和 `ITEM_REVEAL` 状态转换。

### 修复
```typescript
// 修复后
if (this.waveManager.shouldShowShop() || this.waveManager.wave > this.waveManager.getTotalWaves()) {
  this.triggerVictory();  // 所有波次完成 → 胜利
} else {
  this.state = GameState.WAVE_CLEAR;    // → 波次清除
  this.onStateChange?.(this.state);
  this.state = GameState.ITEM_REVEAL;   // → 道具揭示
  this.onStateChange?.(this.state);
  this.waveManager.startWave();         // → 启动下一波
  this.currentWave = this.waveManager.wave;
}
```

**新增 `triggerVictory()` 方法：**
- 停止 BGM，播放胜利音乐
- 保存进度，更新 `scenesCompleted`
- 解锁下一场景

---

## 五、P2 修复：模块数据统一

### 问题
`ItemSystem` 和 `ItemManagementSystem` 各自维护独立的 `itemRevealData`，`WeaponSystem` 和 `ItemManagementSystem` 都维护 `weaponDrops` 数组。

### 修复
- 渲染管线中 `weaponDrops` 优先从 `ItemManagementSystem.getWeaponDrops()` 获取，回退到 `WeaponSystem.getWeaponDrops()`
- `ParticleSystem` 新增 `getState()`、`getFireWalls()` 等方法，统一数据访问接口
- `NewGameEngine` 新增 12 个公共 getter 方法，统一模块访问入口

---

## 六、P3：清理测试代码

### 删除内容
- `testEntities` 属性及类型定义
- `initTestEntities()` 方法
- `updateTestEntities()` 方法及调用
- `renderTestEntities()` 方法及调用
- `renderPerformanceInfo()` 方法及调用
- `resetGameState()` 中测试实体重置代码
- 未使用的导入：`clamp`、`lerp`、`randomInt`、`distance`

---

## 七、新增音效类型处理

`playSoundById()` 方法新增以下音效类型：

| 音效ID | 调用方法 | 用途 |
|--------|----------|------|
| `nurse_cast` | `audio.playNurseCast()` | 护士施法 |
| `mutant_transform` | `audio.playMutantTransform()` | 变异体转换 |
| `suicide_explode` | `audio.playSuicideExplode()` | 自爆蟑螂爆炸 |
| `flying_death` | `audio.playFlyingDeath()` | 飞行蟑螂死亡 |
| `fan_loop` | `audio.startFanLoop()` | 风扇循环 |
| `fire_wall_burn` | `audio.startFireWallBurn()` | 火墙燃烧 |
| `flying_buzz` | `audio.playFlyingBuzz()` | 飞行嗡嗡声 |
| `flying_dodge` | `audio.playFlyingDodge()` | 飞行闪避 |
| `breach_ground` | `audio.playSuicideBreachGround()` | 地面突破 |
| `breach_flying` | `audio.playSuicideBreachFlying()` | 飞行突破 |
| `pickup` | `audio.playKill()` | 拾取道具 |
| `countdown_tick` | `audio.playCountdownTick()` | 倒计时滴答 |
| `victory` | `audio.playVictoryBGM()` | 胜利 |
| `game_over` | `audio.playGameOverBGM()` | 游戏结束 |
| `click` | `audio.playClick()` | 点击 |
| `swatter` | `audio.playSwatter()` | 电蚊拍 |

---

---

## 八、第二轮补充：锥形火焰粒子生成算法

### 问题
第一轮修复中 `onSpawnConeFire` 回调已连接，但 `ParticleSystem` 中缺少具体的粒子生成算法。

### 修复
在 `ParticleSystem` 中新增 `ConeFireParams` 接口和 `spawnConeFire()` 方法，从旧引擎完整移植锥形火焰粒子生成算法：

```typescript
export interface ConeFireParams {
  x: number; y: number;
  angle: number; range: number;
  spreadAngle: number;
  baseDamage: number;
  type?: 'fire' | 'ice' | 'poison';
}
```

**算法特征：**
- 每帧生成 3-6 个火焰粒子，在锥形区域内随机分布
- 支持三种类型：火焰（橙色/黄色）、冰霜（蓝色）、毒雾（绿色）
- 枪口位置生成白色火花粒子
- 锥形中心区域生成火焰区域（FireZone），持续造成伤害
- 火焰区域数量上限 25，防止性能问题

---

## 九、第二轮补充：皇后产卵与变异体胚胎爆发

### 问题
`EntityManager` 中缺少 BOSS 特殊行为的具体实体生成逻辑。

### 修复
在 `EntityManager` 中新增两个方法：

**`spawnQueenEggs(queenRoach)`：**
- 从旧引擎移植：女王蟑螂每 8 秒触发一次
- 在皇后周围随机位置生成 3 只小蟑螂
- 使用 `RoachManager.spawnRoach()` 确保实体正确注册

**`spawnEmbryoRoaches(parentRoach)`：**
- 从旧引擎移植：变异体死亡后执行 7 帧转换动画后触发
- 随机生成以下组合之一：
  - 50%：2 只小蟑螂
  - 30%：1 只小蟑螂 + 1 只飞行蟑螂
  - 20%：1 只小蟑螂 + 1 只自爆蟑螂
- 生成的蟑螂有 1 秒生成免疫（冻结 + 无敌）
- 自爆蟑螂的引信时间设为 3 秒，尺寸缩小为 60%

---

## 十、第二轮补充：道具揭示系统状态回调

### 问题
`ItemManagementSystem` 的道具揭示完成事件无法通知引擎，导致状态机卡在 `ITEM_REVEAL` 状态。

### 修复
在 `ItemManagementSystemConfig` 接口中新增 `onStateChange` 回调：

```typescript
onStateChange?: (state: 'item_reveal_start' | 'item_reveal_complete') => void;
```

- `startItemReveal()` 触发 `'item_reveal_start'`
- `completeItemReveal()` 触发 `'item_reveal_complete'`

在 `NewGameEngine` 中，`'item_reveal_complete'` 回调自动启动下一波次：
```typescript
onStateChange: (state) => {
  if (state === 'item_reveal_complete') {
    this.state = GameState.WAVE_CLEAR;
    this.waveManager.startWave();
    this.startCountdown(() => { this.doWaveSpawn(); });
  }
}
```

---

## 十一、第二轮补充：UI 组件 JSX 修复

构建过程中发现 4 个 UI 组件存在遗留的 JSX 语法错误：

| 文件 | 问题 | 修复方式 |
|------|------|---------|
| `GameHUD.tsx` | 右侧面板 `<div>` 未闭合，导致后续 JSX "未终止" | 补上缺失的 `</div>` |
| `ShopScreen.tsx` | `scrollContainerRef` 的 `<div>` 未闭合 | 补上缺失的 `</div>` |
| `TalentTreeScreen.tsx` | 2 处多余的 `)}` 字符 | 删除多余的 `)` |
| `GameMenu.tsx` | 6 处多余的 `)}` 字符 | 全局替换删除 |
| `GameCanvas.tsx` | `handleRestart` 函数重复声明 | 删除重复声明 |

---

## 完成度对比

| 功能领域 | 修复前 | 第一轮 | 第二轮 |
|----------|:------:|:------:|:------:|
| 剧情战斗流程管理 | ~40% | ~85% | ~90% |
| 怪物 AI 框架 | ~70% | ~95% | ~95% |
| 怪物特效和音效 | ~10% | ~80% | ~85% |
| 玩家喷火枪特效 | ~20% | ~75% | ~90% |
| 掉落品系统 | ~60% | ~85% | ~90% |
| **总体估计** | **~35%** | **~85%** | **~90%** |

### 仍待后续完善
1. 各模块 getter 方法的 `try-catch` 为临时方案，模块接口稳定后可移除
2. 道具揭示系统的完整 UI 动画（`ItemRevealScreen` 组件已存在，需集成验证）
3. 部分武器特殊效果（冰霜减速、毒雾 DOT）的完整实现