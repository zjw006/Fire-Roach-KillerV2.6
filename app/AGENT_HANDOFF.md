# AGENT HANDOFF INSTRUCTION
# 给新Agent的开发交接指令

## 0. 绝对禁令（违反会导致严重问题）

- **禁止重新生成已有文件**：不得重新创建engine.ts、types.ts、data.ts等已有文件
- **禁止修改已有功能逻辑**：不要更改护甲系统、武器系统、敌人AI等已完成的功能
- **禁止更改用户上传的资源**：fan.png、item_swatter.png、roach_flying_suicide.png不可替换
- **禁止修改关键数值**：护甲HP、伤害值、速度等平衡参数除非用户明确要求
- **禁止删除已有功能**：即使认为某些代码可以优化，也不得删除
- **所有修改必须基于现有代码**：用edit_file工具修改，不用write_file覆盖

## 1. 开始开发前必须做的

1. **阅读 PROJECT_STATE.md**（同目录下）：完整了解项目状态、已实现功能、待办事项
2. **阅读相关源文件**：修改哪个文件就先完整阅读该文件
3. **确认修改范围**：只修改与当前需求相关的代码，不动无关部分
4. **检查是否有git提交**：`cd /mnt/agents/output/app && git status`

## 2. 技术规范（必须遵守）

### 2.1 代码风格
- 使用现有代码风格（2空格缩进，单引号字符串）
- 类型标注必须完整，不能有任何`any`
- 方法使用现有命名规范（camelCase）
- 添加新类型到`types.ts`，新配置到`data.ts`

### 2.2 单文件引擎（engine.ts）
- 当前6965行，所有游戏逻辑在此文件中
- 添加新方法时放在同类方法附近
- 必须确保TypeScript编译通过：`cd /mnt/agents/output/app && npm run build`
- 不要尝试拆分（之前多次尝试失败），除非你有绝对把握

### 2.3 状态管理
- 引擎通过回调通知React：onStateChange, onWaveClear, onGameOver等
- 游戏循环只在PLAYING状态执行
- ITEM_DROP/ITEM_REVEAL状态update()只更新视觉，不执行游戏逻辑

### 2.4 渲染
- 使用Canvas 2D API（不用WebGL/Phaser）
- 分辨率540x960竖屏
- 所有渲染在render()及其子方法中

### 2.5 资源引用
- 图片路径：`/assets/xxx.png`（public/assets目录下）
- 不要移动或重命名已有资源文件

## 3. 工作流程

```
1. 读取 PROJECT_STATE.md
2. 读取需求相关源文件
3. 规划修改（哪些文件，哪些方法）
4. 用edit_file修改（不是write_file覆盖）
5. 构建验证：npm run build
6. 部署验证（如需）
```

## 4. 当前待办（按优先级）

### 高优先级
- **BOSS战4波虫卵系统**：框架已保留，需填充完整战斗逻辑
  - 相关文件：engine.ts（搜索initBossBattle、updateBossBattle、spawnEggWave、hatchEggPod）
  - 参考：PROJECT_STATE.md第3.5节

### 中优先级
- 更多Boss技能和行为模式
- 更多敌人类型

## 5. 常见问题

Q: engine.ts太长，怎么找代码？
A: 用grep搜索：`grep -n "methodName" /mnt/agents/output/app/src/game/engine.ts`

Q: 怎么添加新敌人类型？
A: 1) types.ts添加RoachType枚举值 2) data.ts ENEMY_DEFS添加定义 3) engine.ts spawnRoach添加生成逻辑 4) engine.ts updateRoaches添加AI 5) data.ts场景波次配置添加数量

Q: 怎么添加新武器？
A: 1) types.ts WeaponType添加 2) engine.ts添加updateXxx方法 3) engine.ts updatePlayer中添加切换逻辑 4) engine.ts render()中添加渲染 5) data.ts添加掉落配置

Q: 构建失败怎么办？
A: 先看错误信息，通常是需要import类型或方法签名不匹配。修复后继续构建直到通过。

## 6. 项目路径

```
/mnt/agents/output/app/
```

所有操作在此目录下进行。

## 7. 最后提醒

**用户是这个游戏的设计者，所有已实现的功能都是用户的要求。不要质疑设计，不要私自优化，严格执行用户的新需求即可。**
