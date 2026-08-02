# Fixed Width + Background Crop 屏幕适配实施计划

## Context

当前游戏使用 **Contain 模式**（540×960 固定分辨率，留黑边），在长屏设备（19.5:9）上黑边明显。用户希望改为 **Fixed Width + Background Crop** 方案：宽度固定 540，高度按设备自适应，背景图扩展后裁切，消除黑边。

## 核心公式

```
scale = rect.width / 540
this.width = 540（不变）
this.height = rect.height / scale（动态）
heightRatio = this.height / 960（Y 坐标缩放系数）
```

## 影响范围

`SCENE_GROUND_BOUNDS` 的 Y 坐标（450、625、800 等）设计为 960 高度，需乘以 `heightRatio` 缩放。已有 4 处直接使用：

| 文件 | 行号 | 方法 | 说明 |
|------|------|------|------|
| engine.ts | 2568 | `getGroundBoundsAtY()` | 地面边界插值 |
| engine.ts | 2601 | `getGroundCenter()` | 诱饵着陆中心点 |
| engine.ts | 2635 | `spawnRoach()` | 护士蟑螂医院场景 Y |
| engine.ts | 2641 | `spawnRoach()` | 地面蟑螂生成 Y |
| RenderUtils.ts | 630 | `renderMovementRange()` | 移动范围可视化 |

所有 `this.height * N` 形式的百分比定位（如 `this.height * 0.3`、`this.height / 2`）自动适配，无需修改。

## 实施步骤

### Step 1: 修改 `resize()` — 核心布局变更

**文件**: `engine.ts:886-906`

- 移除 `Math.min(scaleX, scaleY)` 的 Contain 逻辑
- `scale = rect.width / 540`
- `this.height = rect.height / scale`（动态计算）
- Canvas CSS 尺寸填满容器（`rect.width × rect.height`）
- Canvas 像素尺寸 = `rect.width * dpr × rect.height * dpr`
- `this.scale = canvas.width / 540`（公式不变）

### Step 2: 添加 `heightRatio` 和 `getScaledGroundBounds()`

**文件**: `engine.ts`

- 新增 `heightRatio()` getter：`return this.height / 960`
- 新增 `getScaledGroundBounds()` 方法：返回 Y 值已乘以 `heightRatio` 的边界数组（X 值不变）

### Step 3: 替换 `SCENE_GROUND_BOUNDS` 直接引用

**文件**: `engine.ts`

- `getGroundBoundsAtY()` (line 2568) → 使用 `this.getScaledGroundBounds()`
- `getGroundCenter()` (line 2601) → 使用 `this.getScaledGroundBounds()`
- `spawnRoach()` nurse (line 2635) → 使用 `this.getScaledGroundBounds()`
- `spawnRoach()` ground (line 2641) → 使用 `this.getScaledGroundBounds()`

**文件**: `RenderUtils.ts:630`

- 修改 `renderMovementRange()` 签名，增加 `scaledBounds` 参数
- 引擎侧 `renderMovementRange()` 调用传入 `this.getScaledGroundBounds()`

### Step 4: 背景渲染改为 Cover 模式

**文件**: `BackgroundRenderer.ts`

- 旧系统背景（line 113-115）：将 `ctx.drawImage(img, 0, 0, w, h)` 拉伸改为 Cover 裁切逻辑（与 `bgImage` 新系统相同的 if-else 裁切）
- `bgImage` 新系统背景（line 86-107）：已经是 Cover 逻辑，无需修改

### Step 5: 容器 CSS 微调

**文件**: `GameCanvas.tsx:972` 和 `index.css`

- `#game-container` 添加 `overflow: hidden` 确保无滚动条
- 外层容器已有的 `overflow-hidden` 和 `h-dvh` 保持不变

### Step 6: 编译构建验证

- `npx tsc --noEmit` 确保无类型错误
- `npx vite build` 确保构建成功

## 边界情况

- **超长屏设备**（9:21+）：`this.height` 可能很大，地面区域过长。可考虑 `Math.min(this.height, 1200)` 上限，超出部分留黑边
- **超短屏设备**（iPad 3:4）：`this.height` 约为 720，地面区域缩小，蟑螂更快到达防线
- **窗口 resize**：桌面端拖拽窗口时 `resize()` 重新计算，所有动态值自动更新

## 验证清单

- [ ] TypeScript 编译通过
- [ ] Vite 构建通过
- [ ] 开发服务器启动，页面正常加载
- [ ] 浏览器 DevTools 切换不同设备（iPhone SE、iPhone X、iPhone 14 Pro Max、iPad）：画布填满屏幕，无黑边
- [ ] 背景图正确裁切（不拉伸、不留白）
- [ ] 防线位于屏幕底部附近
- [ ] 蟑螂在可见地面范围内生成
- [ ] 移动范围可视化正常
- [ ] HUD 叠加层覆盖画布区域
- [ ] 浮动文字位置正常