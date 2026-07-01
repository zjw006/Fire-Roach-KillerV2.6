# 《烈焰除蟑：火线守卫》模块调用文档

## 概述

本文档详细介绍了《烈焰除蟑：火线守卫》游戏的模块化架构和API调用方式。游戏引擎已从单一的大型`engine.ts`文件拆分为多个独立的模块，每个模块负责特定的游戏功能。

## 模块架构总览

```
src/game/engine/
├── index.ts                    # 模块入口，提供向后兼容API
├── NewGameEngine.ts           # 新的模块化游戏引擎类
├── GameEngineAdapter.ts       # 引擎适配器（兼容原始接口）
├── economy/                   # 经济系统模块
│   ├── EconomyManager.ts     # 经济管理
│   ├── AchievementManager.ts # 成就系统
│   ├── ShopManager.ts        # 商店系统
│   └── index.ts
├── wave/                      # 波次系统模块
│   ├── WaveManager.ts       # 波次管理
│   ├── WaveGenerator.ts     # 波次生成
│   └── index.ts
├── physics/                   # 物理粒子系统模块
│   ├── PhysicsSystem.ts     # 物理系统
│   ├── ParticleManager.ts   # 粒子管理
│   └── index.ts
├── weapon/                    # 武器系统模块
│   ├── WeaponManager.ts     # 武器管理
│   ├── WeaponUpgradeManager.ts # 武器升级
│   └── index.ts
├── entity/                    # 实体系统模块
│   ├── EntityManager.ts     # 实体管理
│   ├── RoachManager.ts      # 蟑螂管理
│   └── index.ts
├── render/                    # 渲染系统模块
│   ├── RenderManager.ts     # 渲染管理
│   └── index.ts
├── ui/                        # UI系统模块
│   ├── UIManager.ts         # UI管理
│   └── index.ts
├── save/                      # 存档系统模块
│   ├── SaveSystem.ts        # 存档系统
│   ├── ProgressManager.ts   # 进度管理
│   └── CloudSave.ts         # 云存档
└── utils/                     # 工具模块
    ├── MathUtils.ts         # 数学工具
    ├── PerformanceUtils.ts  # 性能工具
    └── index.ts
```

## 核心API调用

### 1. 创建游戏引擎

#### 向后兼容方式（推荐）

```typescript
import { createGameEngine } from '@/game/engine';
import { GameMode, SceneType } from '@/game/types';

// 获取Canvas元素
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// 创建游戏引擎
const engine = createGameEngine({
  canvas,
  ctx,
  gameMode: GameMode.STORY,
  difficulty: 'easy',
  currentScene: SceneType.KITCHEN,
  audio: undefined // 可选音频管理器
});

// 启动游戏
engine.start();
```

#### 直接使用新引擎

```typescript
import { NewGameEngine } from '@/game/engine/NewGameEngine';

const engine = new NewGameEngine({
  canvas,
  ctx,
  gameMode: GameMode.STORY,
  difficulty: 'easy',
  currentScene: SceneType.KITCHEN,
  audio: undefined
});

engine.start();
```

#### 使用适配器（兼容原始接口）

```typescript
import { GameEngineAdapter } from '@/game/engine/GameEngineAdapter';

const adapter = new GameEngineAdapter({
  canvas,
  ctx,
  gameMode: GameMode.STORY,
  difficulty: 'easy',
  currentScene: SceneType.KITCHEN,
  audio: undefined
});

// 适配器提供与原始引擎相同的接口
adapter.start();
```

### 2. 经济系统模块

#### 导入方式

```typescript
import { 
  EconomyManager, 
  AchievementManager, 
  ShopManager,
  formatMoney,
  calculateKillReward
} from '@/game/engine/economy';
```

#### 经济管理器

```typescript
// 创建经济管理器
const economyManager = new EconomyManager();

// 添加金钱
economyManager.addMoney(100);

// 消费金钱
const success = economyManager.spendMoney(50);

// 获取经济统计
const stats = economyManager.getStats();
console.log(`总金钱: ${stats.totalMoney}, 总击杀: ${stats.totalKills}`);

// 格式化金钱显示
const formatted = formatMoney(1234567); // "¥1,234,567"
```

#### 成就系统

```typescript
// 创建成就管理器
const achievementManager = new AchievementManager();

// 检查并解锁成就
achievementManager.checkAchievement('kill_100', playerProgress);

// 获取已解锁成就
const unlocked = achievementManager.getUnlockedAchievements();

// 获取成就进度
const progress = achievementManager.getAchievementProgress('kill_1000');
```

#### 商店系统

```typescript
// 创建商店管理器
const shopManager = new ShopManager();

// 获取可购买物品
const availableItems = shopManager.getAvailableItems(playerProgress);

// 购买物品
const purchaseResult = shopManager.purchaseItem('weapon_upgrade', playerProgress, economy);

// 获取升级价格
const upgradeCost = shopManager.getUpgradeCost('damage_boost', currentLevel);
```

### 3. 波次系统模块

#### 导入方式

```typescript
import { WaveManager, WaveGenerator } from '@/game/engine/wave';
```

#### 波次管理器

```typescript
// 创建波次管理器
const waveManager = new WaveManager({
  sceneType: SceneType.KITCHEN,
  gameMode: GameMode.STORY,
  difficulty: 'easy'
});

// 开始新波次
const waveConfig = waveManager.startNextWave();

// 更新波次状态
waveManager.update(deltaTime);

// 获取当前波次信息
const waveInfo = waveManager.getCurrentWaveInfo();
console.log(`波次: ${waveInfo.number}, 剩余敌人: ${waveInfo.enemiesRemaining}`);

// 检查波次是否完成
if (waveManager.isWaveComplete()) {
  console.log('波次完成！');
}
```

#### 波次生成器

```typescript
// 创建波次生成器
const waveGenerator = new WaveGenerator();

// 生成波次配置
const waveConfig = waveGenerator.generateWave({
  waveNumber: 5,
  sceneType: SceneType.KITCHEN,
  difficulty: 'hard'
});

// 获取波次敌人列表
const enemies = waveConfig.enemies;
```

### 4. 物理粒子系统模块

#### 导入方式

```typescript
import { PhysicsSystem, ParticleManager } from '@/game/engine/physics';
```

#### 物理系统

```typescript
// 创建物理系统
const physicsSystem = new PhysicsSystem();

// 更新物理模拟
physicsSystem.update(deltaTime, gameEntities);

// 检查碰撞
const collisions = physicsSystem.checkCollisions(entity1, entity2);

// 应用力
physicsSystem.applyForce(entity, forceVector);
```

#### 粒子管理器

```typescript
// 创建粒子管理器
const particleManager = new ParticleManager();

// 创建粒子效果
particleManager.createExplosion(x, y, intensity);

// 创建火焰粒子
particleManager.createFireParticles(x, y, count, lifetime);

// 更新所有粒子
particleManager.update(deltaTime);

// 渲染粒子
particleManager.render(ctx);
```

### 5. 武器系统模块

#### 导入方式

```typescript
import { WeaponManager, WeaponUpgradeManager } from '@/game/engine/weapon';
```

#### 武器管理器

```typescript
// 创建武器管理器
const weaponManager = new WeaponManager();

// 切换武器
weaponManager.switchWeapon('shotgun', player);

// 发射武器
const projectiles = weaponManager.fireWeapon(player, targetX, targetY);

// 获取当前武器状态
const weaponState = weaponManager.getWeaponState();

// 检查弹药
const hasAmmo = weaponManager.hasAmmo('molotov');
```

#### 武器升级管理器

```typescript
// 创建武器升级管理器
const upgradeManager = new WeaponUpgradeManager();

// 获取可用的升级
const availableUpgrades = upgradeManager.getAvailableUpgrades(playerProgress);

// 应用升级
const upgradedWeapon = upgradeManager.applyUpgrade('damage_boost', weapon, player);

// 获取升级效果
const upgradeEffect = upgradeManager.getUpgradeEffect('range_boost');
```

### 6. 实体系统模块

#### 导入方式

```typescript
import { EntityManager, RoachManager } from '@/game/engine/entity';
```

#### 实体管理器

```typescript
// 创建实体管理器
const entityManager = new EntityManager();

// 添加实体
entityManager.addEntity(roach);

// 移除实体
entityManager.removeEntity(entityId);

// 获取所有实体
const allEntities = entityManager.getAllEntities();

// 按类型筛选实体
const roaches = entityManager.getEntitiesByType('roach');

// 更新所有实体
entityManager.update(deltaTime);
```

#### 蟑螂管理器

```typescript
// 创建蟑螂管理器
const roachManager = new RoachManager();

// 生成蟑螂
const roach = roachManager.spawnRoach({
  type: RoachType.SMALL,
  x: spawnX,
  y: spawnY,
  waveNumber: currentWave
});

// 更新蟑螂AI
roachManager.updateRoachAI(roach, playerPosition, deltaTime);

// 处理蟑螂受伤
const isDead = roachManager.applyDamage(roach, damageAmount, damageType);
```

### 7. 渲染系统模块

#### 导入方式

```typescript
import { RenderManager } from '@/game/engine/render';
```

#### 渲染管理器

```typescript
// 创建渲染管理器
const renderManager = new RenderManager({
  canvas,
  ctx,
  width: 540,
  height: 960
});

// 渲染游戏场景
renderManager.renderScene({
  player,
  entities: allEntities,
  particles: activeParticles,
  weather: currentWeather,
  gameState: currentGameState
});

// 渲染UI元素
renderManager.renderUI({
  economy,
  wave: currentWave,
  defenseHp,
  maxDefenseHp,
  playerHealth: player.hp
});

// 渲染特效
renderManager.renderEffects({
  screenShake: shakeIntensity,
  flash: flashAlpha,
  blur: blurAmount
});
```

### 8. UI系统模块

#### 导入方式

```typescript
import { UIManager } from '@/game/engine/ui';
```

#### UI管理器

```typescript
// 创建UI管理器
const uiManager = new UIManager({
  canvas,
  ctx,
  width: 540,
  height: 960
});

// 渲染HUD
uiManager.renderHUD({
  money: economy.money,
  wave: currentWave,
  playerHealth: player.hp,
  playerMaxHealth: player.maxHp,
  heat: player.heat,
  maxHeat: player.maxHeat
});

// 渲染菜单
uiManager.renderMenu({
  options: menuOptions,
  selectedIndex: currentSelection
});

// 渲染对话框
uiManager.renderDialog({
  text: dialogText,
  character: speaker,
  choices: dialogChoices
});
```

### 9. 存档系统模块

#### 导入方式

```typescript
import { SaveSystem, ProgressManager, CloudSave } from '@/game/engine/save';
```

#### 存档系统

```typescript
// 创建存档系统
const saveSystem = new SaveSystem();

// 保存游戏进度
saveSystem.saveProgress(playerProgress);

// 加载游戏进度
const loadedProgress = saveSystem.loadProgress();

// 删除存档
saveSystem.deleteSave(slotId);
```

#### 进度管理器

```typescript
// 创建进度管理器
const progressManager = new ProgressManager();

// 更新进度
progressManager.updateProgress(player, economy, wave);

// 获取进度统计
const progressStats = progressManager.getStats();

// 重置进度
progressManager.resetProgress();
```

#### 云存档

```typescript
// 创建云存档管理器
const cloudSave = new CloudSave({
  apiUrl: 'https://api.yourgame.com/save',
  authToken: 'user-auth-token'
});

// 上传存档到云端
await cloudSave.uploadProgress(playerProgress);

// 从云端下载存档
const cloudProgress = await cloudSave.downloadProgress();

// 同步本地和云端存档
await cloudSave.syncProgress(localProgress);
```

### 10. 工具模块

#### 导入方式

```typescript
import { 
  clamp, 
  lerp, 
  randomRange,
  checkPerformance,
  throttleUpdate
} from '@/game/engine/utils';
```

#### 数学工具

```typescript
// 限制数值范围
const clamped = clamp(value, 0, 100);

// 线性插值
const interpolated = lerp(start, end, t);

// 随机范围
const random = randomRange(min, max);

// 角度转换
const radians = degToRad(degrees);
const degrees = radToDeg(radians);
```

#### 性能工具

```typescript
// 检查设备性能
const isLowPerf = checkPerformance();

// 节流更新
const throttledUpdate = throttleUpdate(updateFunction, 16); // 60fps

// 帧率监控
const fps = getCurrentFPS();
```

## 模块集成示例

### 完整游戏循环示例

```typescript
import { createGameEngine } from '@/game/engine';
import { GameMode, SceneType } from '@/game/types';

class GameApp {
  private engine: any;
  private lastTime: number = 0;
  private isRunning: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!;
    
    // 创建游戏引擎
    this.engine = createGameEngine({
      canvas,
      ctx,
      gameMode: GameMode.STORY,
      difficulty: 'easy',
      currentScene: SceneType.KITCHEN,
      audio: undefined
    });

    // 设置回调函数
    this.setupCallbacks();
  }

  private setupCallbacks(): void {
    // 经济更新回调
    this.engine.onEconomyUpdate = (economy: any) => {
      console.log(`金钱: ¥${economy.money}, 击杀: ${economy.totalKills}`);
    };

    // 波次更新回调
    this.engine.onWaveUpdate = (wave: number) => {
      console.log(`当前波次: ${wave}`);
    };

    // 游戏结束回调
    this.engine.onGameOver = (economy: any, wave: number) => {
      console.log(`游戏结束！最终波次: ${wave}, 总金钱: ¥${economy.money}`);
    };
  }

  start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.engine.start();
    this.gameLoop();
  }

  stop(): void {
    this.isRunning = false;
    this.engine.stop();
  }

  private gameLoop(): void {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // 转换为秒
    this.lastTime = currentTime;

    // 更新游戏逻辑
    this.engine.update(deltaTime);

    // 渲染游戏
    this.engine.render();

    // 继续游戏循环
    requestAnimationFrame(() => this.gameLoop());
  }
}

// 使用示例
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const gameApp = new GameApp(canvas);
gameApp.start();
```

### React组件集成示例

```typescript
import React, { useRef, useEffect } from 'react';
import { createGameEngine } from '@/game/engine';
import { GameMode, SceneType } from '@/game/types';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 创建游戏引擎
    const engine = createGameEngine({
      canvas,
      ctx,
      gameMode: GameMode.STORY,
      difficulty: 'easy',
      currentScene: SceneType.KITCHEN,
      audio: undefined
    });

    engineRef.current = engine;

    // 启动游戏
    engine.start();

    // 清理函数
    return () => {
      engine.stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={540}
      height={960}
      style={{ display: 'block', margin: '0 auto' }}
    />
  );
};

export default GameCanvas;
```

## 最佳实践

### 1. 模块初始化顺序

```typescript
// 正确的初始化顺序
1. 核心工具模块 (utils)
2. 实体系统模块 (entity)
3. 物理系统模块 (physics)
4. 武器系统模块 (weapon)
5. 经济系统模块 (economy)
6. 波次系统模块 (wave)
7. 渲染系统模块 (render)
8. UI系统模块 (ui)
9. 存档系统模块 (save)
10. 游戏引擎 (NewGameEngine/GameEngineAdapter)
```

### 2. 内存管理

```typescript
// 及时清理不再使用的实体
entityManager.removeEntity(deadEntityId);

// 定期清理过期粒子
particleManager.cleanupExpiredParticles();

// 使用对象池重用频繁创建的对象
const roachPool = new ObjectPool(() => createRoach(), 50);
```

### 3. 性能优化

```typescript
// 使用节流控制更新频率
const throttledUpdate = throttleUpdate(updateFunction, 16); // 60fps

// 批量渲染减少draw call
renderManager.batchRender(entities);

// 使用空间分区优化碰撞检测
const spatialHash = new SpatialHash(gridSize);
```

### 4. 错误处理

```typescript
try {
  // 游戏逻辑
  engine.update(deltaTime);
} catch (error) {
  console.error('游戏更新错误:', error);
  // 优雅降级或重启游戏
  engine.restart();
}
```

## 常见问题解答

### Q1: 如何切换游戏模式？

```typescript
// 创建新的引擎实例
const newEngine = createGameEngine({
  canvas,
  ctx,
  gameMode: GameMode.ENDLESS, // 切换到无尽模式
  difficulty: 'hard',
  currentScene: SceneType.KITCHEN,
  audio: undefined
});

// 停止旧引擎，启动新引擎
oldEngine.stop();
newEngine.start();
```

### Q2: 如何保存和加载游戏进度？

```typescript
// 保存进度
const progress = engine.getProgress();
localStorage.setItem('game_progress', JSON.stringify(progress));

// 加载进度
const savedProgress = JSON.parse(localStorage.getItem('game_progress') || '{}');
engine.loadProgress(savedProgress);
```

### Q3: 如何添加自定义敌人类型？

```typescript
// 1. 在types.ts中定义新的敌人类型
export enum RoachType {
  // ... 现有类型
  CUSTOM = 'custom'
}

// 2. 在data.ts中配置敌人属性
export const ENEMY_DEFS = {
  // ... 现有配置
  custom: {
    hp: 150,
    speed: 80,
    size: 25,
    reward: 30
  }
};

// 3. 使用RoachManager生成自定义敌人
const customRoach = roachManager.spawnRoach({
  type: RoachType.CUSTOM,
  x: spawnX,
  y: spawnY,
  waveNumber: currentWave
});
```

### Q4: 如何扩展武器系统？

```typescript
// 1. 定义新的武器类型
const customWeapon = {
  type: 'custom_weapon',
  damage: 50,
  range: 300,
  fireRate: 0.5,
  ammo: 10
};

// 2. 注册到武器管理器
weaponManager.registerWeapon(customWeapon);

// 3. 使用新武器
weaponManager.switchWeapon('custom_weapon', player);
```

## 版本兼容性

### 从原始引擎迁移到模块化引擎

```typescript
// 旧代码（使用原始引擎）
import { GameEngine } from '@/game/engine';

const engine = new GameEngine(canvas);
engine.start();

// 新代码（使用模块化引擎）
import { createGameEngine } from '@/game/engine';

const engine = createGameEngine({
  canvas,
  ctx: canvas.getContext('2d')!,
  gameMode: GameMode.STORY,
  difficulty: 'easy',
  currentScene: SceneType.KITCHEN,
  audio: undefined
});

engine.start();
```

### 模块版本

- **v1.0.0**: 初始模块化版本，拆分原始引擎功能
- **v1.1.0**: 添加适配器层，保持向后兼容
- **v1.2.0**: 优化模块接口，添加类型安全
- **v2.0.0**: 完全模块化架构，移除对原始引擎的依赖

## 技术支持

### 调试工具

```typescript
// 启用调试模式
import { enableDebug } from '@/game/engine/utils/debug';

enableDebug({
  showFPS: true,
  showEntityCount: true,
  showPerformance: true
});

// 性能分析
import { startProfiling, stopProfiling } from '@/game/engine/utils/profiler';

startProfiling('game_update');
// ... 游戏逻辑
stopProfiling('game_update');
```

### 日志系统

```typescript
import { Logger } from '@/game/engine/utils/logger';

const logger = new Logger({
  level: 'debug', // debug, info, warn, error
  output: 'console' // console, file, remote
});

logger.info('游戏启动');
logger.warn('内存使用较高');
logger.error('渲染错误', error);
```

## 总结

本文档详细介绍了《烈焰除蟑：火线守卫》游戏的模块化架构和API调用方式。通过模块化设计，游戏引擎变得更加可维护、可扩展和可测试。开发者可以根据需要选择使用完整的游戏引擎，或单独使用特定的功能模块。

模块化架构的主要优势：
1. **可维护性**: 每个模块职责单一，易于理解和修改
2. **可测试性**: 模块可以独立测试，提高代码质量
3. **可扩展性**: 可以轻松添加新的功能模块
4. **代码复用**: 模块可以在不同项目中重用
5. **团队协作**: 不同开发者可以并行开发不同模块

希望本文档能帮助你更好地理解和使用游戏的模块化架构。如有任何问题或建议，请随时联系开发团队。