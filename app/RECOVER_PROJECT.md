# 项目恢复指令

## 情况
沙箱文件已被清理，需要根据文档重新初始化项目并恢复源码。

## 恢复步骤

### 第1步：初始化项目框架（必须）

先读取 webapp-building skill，然后按skill初始化项目：

```bash
# 1. 按skill要求初始化webapp项目到 /mnt/agents/output/app
# 2. 安装额外依赖
cd /mnt/agents/output/app
npm install lucide-react
```

### 第2步：恢复源代码

用户提供了一个完整的tar.gz备份，里面包含src/和public/assets/目录。

如果用户上传了tar.gz文件，解压到项目根目录：
```bash
cd /mnt/agents/output/app
tar xzf /path/to/user/uploaded/backup.tar.gz -C /mnt/agents/output/
# 或者直接解压覆盖
tar xzf /path/to/backup.tar.gz
```

如果用户直接粘贴了文件内容，按路径逐个写入文件。

### 第3步：验证文件完整性

```bash
ls -la /mnt/agents/output/app/src/game/engine.ts
ls -la /mnt/agents/output/app/src/game/types.ts
ls -la /mnt/agents/output/app/src/game/data.ts
ls -la /mnt/agents/output/app/public/assets/
```

engine.ts 应该约 6965 行。

### 第4步：构建验证

```bash
cd /mnt/agents/output/app
npm run build
```

构建通过后即可开始开发。

### 第5步：阅读项目文档

```bash
cat /mnt/agents/output/app/PROJECT_STATE.md
cat /mnt/agents/output/app/AGENT_HANDOFF.md
```

## 关键文件清单（确认都存在）

| 文件 | 路径 | 大致行数 |
|------|------|----------|
| 游戏引擎 | src/game/engine.ts | ~6965 |
| 类型定义 | src/game/types.ts | ~539 |
| 游戏数据 | src/game/data.ts | ~723 |
| 音频管理 | src/game/audio.ts | ~731 |
| 主组件 | src/components/game/GameCanvas.tsx | ~794 |
| 项目状态 | PROJECT_STATE.md | - |
| 交接指令 | AGENT_HANDOFF.md | - |

## 注意事项

- 不要重新创建engine.ts、types.ts、data.ts等已有文件
- 所有修改基于现有代码用edit_file
- 构建必须通过后才开始新功能开发
- 参考AGENT_HANDOFF.md中的绝对禁令
