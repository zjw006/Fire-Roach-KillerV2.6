# 拆分 data.ts 计划

## Context

`src/game/data.ts` 当前为 2174 行的巨型单体文件，包含 24 个独立区块（场景配置、敌人属性、天赋、成就、对话、波次、道具、Boss、图鉴、平衡参数、文案、颜色、字体等）。每次修改任何一个小节都需要在 2000+ 行文件中定位，维护困难。

本次拆分目标：将 `data.ts` 拆分为 12 个子模块，存入 `src/game/data/` 目录，原 `data.ts` 变为 barrel 重导出文件。**所有 44 个引用文件无需任何修改**，因为 import 路径不变。

## 目录结构

```
src/game/
  data.ts                    # barrel 重导出文件（替换原单体文件）
  data/
    scenes.ts                # SCENE_CONFIGS
    enemies.ts               # ENEMY_DEFS
    talents.ts               # TALENT_DEFS
    achievements.ts          # ACHIEVEMENT_DEFS + createDefaultProgress
    dialogs.ts               # DIALOG_CONFIGS
    waves.ts                 # WAVE_CONFIGS_* × 11 + SCENE_WAVE_CONFIGS
    scene-rules.ts           # SCENE_ORDER / SCENE_ITEM_UNLOCKS / SCENE_ROACH_TYPES / SCENE_UNLOCK_CHAIN / SCENE_GROUND_BOUNDS / SCENE_REWARD_ITEMS
    items.ts                 # CONSUMABLE_DEFS / WEAPON_DROP_DEFS / INVENTORY_SELL_PRICES / BOSS_CONFIG
    encyclopedia.ts          # ENCYCLOPEDIA_DEFS
    balance.ts               # BALANCE_CONFIG
    text-config.ts           # TEXT_CONFIG
    render.ts                # FLOAT_COLOR / RENDER_COLOR / RENDER_FONT
```

## 内部交叉引用

唯一跨文件引用：`achievements.ts` → `encyclopedia.ts`（`createDefaultProgress` 使用了 `ENCYCLOPEDIA_DEFS`）。通过 `import { ENCYCLOPEDIA_DEFS } from './encyclopedia'` 解决。

## 实施步骤

### Phase 1: 创建目录 + 无依赖的子模块
1. 创建 `src/game/data/` 目录
2. 创建 `scenes.ts`、`enemies.ts`、`talents.ts`、`dialogs.ts`、`waves.ts`、`scene-rules.ts`、`items.ts`、`balance.ts`、`text-config.ts`、`render.ts`（无交叉引用，可并行创建）
3. 创建 `encyclopedia.ts`（在 `achievements.ts` 之前，因为后者依赖它）
4. 创建 `achievements.ts`（含对 `encyclopedia.ts` 的 import）

### Phase 2: 替换 barrel 文件
5. 将 `data.ts` 替换为 barrel 重导出文件（约 15 行），重新导出所有 12 个子模块的所有符号

### Phase 3: 验证
6. `npx tsc --noEmit` — TypeScript 编译零错误
7. `npx vite build` — 构建成功
8. 确认 `engine/index.ts` 无需修改（其 `import from '../data'` 自动解析到 barrel）

## 关键约束

- 每个子模块的 import 需遵循 `verbatimModuleSyntax`：类型导入用 `import type { ... }`，值导入用 `import { ... }`
- 所有 `as const` 断言保留在原位
- barrel 文件必须导出原 `data.ts` 的所有公开符号，不得遗漏
- 44 个引用文件零修改

## 验证方法

1. `npx tsc --noEmit` 编译通过
2. `npx vite build` 构建通过
3. 可选：`npm run dev` 启动后验证游戏菜单、场景、战斗等核心功能正常