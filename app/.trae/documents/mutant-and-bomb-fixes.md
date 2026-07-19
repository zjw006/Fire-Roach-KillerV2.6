# 变异蟑螂多杀 & 定时自爆蟑螂炸弹行为 修复计划

## Context

两个问题需要修复：

1. **变异蟑螂多杀 Bug**：医院场景中，当两个或多个变异蟑螂在同一帧被杀死时，只有最后一只发生变异（胚胎暴走），其他变异蟑螂的变异被覆盖丢失。
2. **定时自爆蟑螂炸弹行为改进**：在 breach 系统（突破阶段）中，定时自爆蟑螂蹲下后应安放炸弹并变身为大蟑螂冲向防线，炸弹留在原地 3 秒倒计时爆炸；倒计时数字需要放大 1.5 倍。

---

## 问题 1：变异蟑螂多杀 Bug

### 根因分析

在 `RoachAISystem.ts` 中，`forceEmbryoBurst()` 方法使用**单例状态变量**追踪变异动画：

```typescript
// 单例状态（同一时间只能追踪一个变异）
mutantTransformActive: boolean = false;
mutantTransformFrame: number = 0;
mutantTransformTimer: number = 0;
mutantTransformX: number = 0;
mutantTransformY: number = 0;
_embryoSpawnTypes: RoachType[] = [];
```

当两个变异蟑螂在同一帧内被杀死（例如被火焰喷射器、爆炸同时击中），调用链为：
1. 第一只变异蟑螂 → `killRoach()` → `forceEmbryoBurst(r1)` → 写入状态（位置、类型等）
2. 第二只变异蟑螂 → `killRoach()` → `forceEmbryoBurst(r2)` → **覆盖**第一只的状态

动画完成后，`spawnEmbryoRoaches()` 只生成第二只变异蟑螂的胚胎，第一只的变异丢失。

### 修复方案：将变换状态存储在 Roach 对象上

不维护全局单例，而是将变换状态直接存储在每只变异蟑螂的 Roach 对象上。Roach 接口已有 `transformTimer` 字段（`types.ts:431`），可复用。

**修改文件**：

#### 1. `types.ts` — 添加 Roach 变换相关字段

在第 431 行 `transformTimer` 附近添加：
```typescript
transformFrame?: number;       // 变异变换动画帧 (0-6)
transformSpawnTypes?: RoachType[];  // 胚胎暴走生成的蟑螂类型
```

#### 2. `RoachAISystem.ts` — 核心修改

**删除单例状态变量**（第 98-107 行）：
- 删除 `mutantTransformActive`, `mutantTransformFrame`, `mutantTransformTimer`, `mutantTransformX`, `mutantTransformY`
- 删除 `_embryoSpawnTypes: RoachType[]`

**`reset()` 方法**（第 134-146 行）：
- 删除对这些单例变量的重置（它们不再存在）

**`forceEmbryoBurst(r)` 方法**（第 1299-1325 行）：
- 不再写入单例变量，改为写入 `r` 的属性：
  ```typescript
  r.transformFrame = 0;
  r.transformTimer = 0.6;  // 复用已有的 transformTimer
  r.transformSpawnTypes = [随机类型];
  ```
- 保留屏幕震动、音效、浮动文字、粒子等效果

**`update()` 中的变换动画更新**（第 167-178 行）：
- 替换为遍历所有 DEAD MUTANT roach，独立更新每个的 `transformTimer` 和 `transformFrame`
- 当某个 MUTANT roach 的 `transformFrame >= 7` 时，调用 `spawnEmbryoRoaches(r)` 并移除该 roach

**死亡处理**（第 209 行）：
- 从 `if (r.type === RoachType.MUTANT && this.mutantTransformActive)` 
- 改为 `if (r.type === RoachType.MUTANT && r.transformFrame !== undefined && r.transformFrame < 7)`

**`spawnEmbryoRoaches()` 方法**（第 1327-1366 行）：
- 接受 `r: Roach` 参数，从 `r.x`, `r.y`, `r.transformSpawnTypes` 读取数据
- 移除对 `this.mutantTransformX/Y` 和 `this._embryoSpawnTypes` 的引用

**`mutantDeathEffect()` 方法**（第 1372-1408 行）：
- 无需修改（已使用 `r.x`, `r.y`，不依赖单例状态）

#### 3. `engine.ts` — 渲染配置传递

**第 4303 行**：移除 `mutantTransformActive` 和 `mutantTransformFrame` 的传递：
```typescript
// 删除
mutantTransformActive: this.roachAISystem!.mutantTransformActive, 
mutantTransformFrame: this.roachAISystem!.mutantTransformFrame,
```

#### 4. `RoachRenderer.ts` — 渲染逻辑修改

**配置接口** `RoachRendererConfig`（第 30-32 行）：
- 删除 `mutantTransformActive` 和 `mutantTransformFrame` 字段

**渲染逻辑**（第 340 行）：
- 从 `config.mutantTransformActive` 改为 `r.transformFrame !== undefined && r.transformFrame < 7`

**渲染逻辑**（第 517-519 行）：
- 从 `config.mutantTransformActive` 改为 `r.transformFrame !== undefined && r.transformFrame < 7`
- 从 `config.mutantTransformFrames[config.mutantTransformFrame]` 改为 `config.mutantTransformFrames[r.transformFrame]`

---

## 问题 2：定时自爆蟑螂炸弹行为改进

### 当前行为

在 `updateTimedSuicideBreach()` 的 `crouching` 阶段（第 764-788 行）：
- 蟑螂蹲下 3 秒后自身爆炸
- **没有**安放炸弹到 `placedBombs` 数组
- **没有**变身为大蟑螂

而在 legacy 路径（第 495-539 行）中，蟑螂到达防线后会安放炸弹并变身为大蟑螂。两条路径行为不一致。

### 修复方案

#### 1. `RoachAISystem.ts` — `crouching` 阶段修改

修改 `updateTimedSuicideBreach()` 中 `crouching` 阶段的进入逻辑（第 755-759 行）：

进入 `crouching` 时：
1. Push 炸弹到 `this.cfg.placedBombs`（位置为蟑螂当前位置 `r.x`, `r.y`）
2. 将蟑螂类型改为 `RoachType.LARGE`，更新 `size`, `speed`, `baseSpeed`, `hp`, `maxHp`
3. 设置 `r.hasPlacedBomb = true`
4. 蟑螂退出 crouching 阶段，恢复正常 AI 行为（向防线移动）
5. 添加浮动文字提示（"炸弹已安放!" + "变身大蟑螂!"）

然后 `crouching` 阶段本身不再需要——蟑螂已变身并离开，炸弹在 `placedBombs` 中独立倒计时。

#### 2. `engine.ts` — 倒计时数字放大 1.5 倍

**placed bombs 渲染**（第 3912-3916 行）：
- `countScale` 从 `1.2 + urgency * 1.0` 改为 `1.8 + urgency * 1.5`（整体放大 1.5x）
- `font` 从 `'bold 28px sans-serif'` 改为 `'bold 42px sans-serif'`

---

## 涉及文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `types.ts` | 新增字段 | 添加 `transformFrame`, `transformSpawnTypes` 到 Roach 接口 |
| `RoachAISystem.ts` | 主要修改 | 问题1：变换状态从单例迁移到 Roach 对象；问题2：crouching 阶段安放炸弹+变身 |
| `engine.ts` | 次要修改 | 问题1：移除 mutantTransformActive/Frame 渲染传参；问题2：炸弹倒计时数字放大 1.5x |
| `RoachRenderer.ts` | 次要修改 | 问题1：从 `r.transformFrame` 读取变换帧，移除 config 中的单例字段 |

---

## 验证方式

1. **TypeScript 编译**：`npx tsc --noEmit`
2. **Vite 构建**：`npx vite build`
3. **手动测试**：
   - 问题 1：进入医院关卡，使用火焰喷射器或范围武器同时击杀两只变异蟑螂，确认两只都产生胚胎暴走（各生成 2 只小蟑螂）
   - 问题 2：进入医院关卡，观察定时自爆蟑螂到达防线附近后是否安放炸弹、变身大蟑螂冲锋、炸弹 3 秒后爆炸并对防线造成伤害
   - 倒计时数字是否比之前大 1.5 倍