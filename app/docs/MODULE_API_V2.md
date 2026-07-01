# 《烈焰除蟑：火线守卫》模块调用文档 V2.0

## 文档概述

本文档是《烈焰除蟑：火线守卫》游戏模块化架构的详细API调用指南。游戏引擎已从9700+行的单一`engine.ts`文件拆分为10个独立的模块化组件，每个模块负责特定的游戏功能。

**文档版本**: 2.0  
**最后更新**: 2026-06-29  
**适用引擎版本**: v2.6+  
**技术栈**: TypeScript + React + HTML5 Canvas 2D

## 目录

1. [模块架构总览](#模块架构总览)
2. [快速开始](#快速开始)
3. [核心引擎API](#核心引擎api)
4. [模块详细API](#模块详细api)
   - [4.1 经济系统模块](#41-经济系统模块)
   - [4.2 波次系统模块](#42-波次系统模块)
   - [4.3 物理粒子系统模块](#43-物理粒子系统模块)
   - [4.4 武器系统模块](#44-武器系统模块)
   - [4.5 实体系统模块](#45-实体系统模块)
   - [4.6 渲染系统模块](#46-渲染系统模块)
   - [4.7 UI系统模块](#47-ui系统模块)
   - [4.8 存档系统模块](#48-存档系统模块)
   - [4.9 工具模块](#49-工具模块)
5. [模块集成指南](#模块集成指南)
6. [实际应用示例](#实际应用示例)
7. [性能优化建议](#性能优化建议)
8. [常见问题解答](#常见问题解答)
9. [故障排除](#故障排除)

## 模块架构总览

### 模块化设计理念

游戏采用**领域驱动设计(DDD)**原则，将游戏功能按业务领域拆分为独立的模块：

```
src/game/engine/
├── index.ts                    # 模块入口，提供向后兼容API
├── NewGameEngine.ts           # 新的模块化游戏引擎类（主控制器）
├── GameEngineAdapter.ts       # 引擎适配器（兼容原始接口）
│
├── economy/                   # 经济系统模块
│   ├── EconomyManager.ts     # 经济管理（金钱、奖励、统计）
│   ├── AchievementManager.ts # 成就系统（成就解锁、进度跟踪）
│   ├── ShopManager.ts        # 商店系统（物品购买、升级）
│   ├── types.ts              # 经济系统类型定义
│   └── index.ts              # 模块导出
│
├── wave/                      # 波次系统模块
│   ├── WaveManager.ts       # 波次管理（波次控制、状态跟踪）
│   ├── WaveGenerator.ts     # 波次生成（敌人配置、难度曲线）
│   ├── types.ts             # 波次系统类型定义
│   └── index.ts             # 模块导出
│
├── physics/                   # 物理粒子系统模块
│   ├── PhysicsSystem.ts     # 物理系统（碰撞检测、运动模拟）
│   ├── ParticleManager.ts   # 粒子管理（特效、视觉效果）
│   ├── types.ts             # 物理系统类型定义
│   └── index.ts             # 模块导出
│
├── weapon/                    # 武器系统模块
│   ├── WeaponManager.ts     # 武器管理（武器切换、发射逻辑）
│   ├── WeaponUpgradeManager.ts # 武器升级（属性提升、特殊效果）
│   ├── types.ts             # 武器系统类型定义
│   └── index.ts             # 模块导出
│
├── entity/                    # 实体系统模块
│   ├── EntityManager.ts     # 实体管理（实体生命周期、查询）
│   ├── RoachManager.ts      # 蟑螂管理（AI行为、状态控制）
│   ├── types.ts             # 实体系统类型定义
│   └── index.ts             # 模块导出
│
├── render/                    # 渲染系统模块
│   ├── RenderManager.ts     # 渲染管理（场景渲染、特效）
│   ├── types.ts             # 渲染系统类型定义
│   └── index.ts             # 模块导出
│
├── ui/                        # UI系统模块
│   ├── UIManager.ts         # UI管理（HUD、菜单、对话框）
│   ├── types.ts             # UI系统类型定义
│   └── index.ts             # 模块导出
│
├── save/                      # 存档系统模块
│   ├── SaveSystem.ts        # 存档系统（本地存储、进度管理）
│   ├── ProgressManager.ts   # 进度管理（游戏进度统计）
│   ├── CloudSave.ts         # 云存档（远程同步）
│   ├── types.ts             # 存档系统类型定义
│   └── index.ts             # 模块导出
│
└── utils/                     # 工具模块
    ├── MathUtils.ts         # 数学工具（计算、转换）
    ├── PerformanceUtils.ts  # 性能工具（监控、优化）
    ├── DebugUtils.ts        # 调试工具（日志、分析）
    ├── types.ts             # 工具模块类型定义
    └── index.ts             # 模块导出
```

### 模块依赖关系

```
NewGameEngine (主控制器)
    ├── depends on → EntityManager
    ├── depends on → PhysicsSystem
    ├── depends on → WeaponManager
    ├── depends on → EconomyManager
    ├── depends on → WaveManager
    ├── depends on → RenderManager
    ├── depends on → UIManager
    └── depends on → SaveSystem
        └── depends on → ProgressManager
            └── depends on → CloudSave (可选)
```

### 数据流架构

```
用户输入 → NewGameEngine → 模块处理 → 渲染输出
    ↓           ↓              ↓          ↓
键盘/鼠标   路由到对应模块   更新游戏状态    Canvas绘制
```

## 快速开始

### 环境要求

```bash
# Node.js版本要求
node >= 18.0.0
npm >= 9.0.0

# 项目依赖
typescript >= 5.0.0
react >= 19.0.0
```

### 安装与构建

```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 类型检查
npm run check

# 构建生产版本
npm run build
```

### 最小化示例

```typescript
// 1. 创建HTML结构
// index.html
<div id="app">
  <canvas id="game-canvas" width="540" height="960"></canvas>
</div>

// 2. 创建游戏应用
// GameApp.ts
import { createGameEngine } from '@/game/engine';
import { GameMode, SceneType } from '@/game/types';

class GameApp {
  private engine: any;
  
  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
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
  }
  
  start(): void {
    this.engine.start();
  }
  
  stop(): void {
    this.engine.stop();
  }
}

// 3. 启动游戏
const gameApp = new GameApp();
gameApp.start();
```

## 核心引擎API

### 引擎创建选项

```typescript
interface GameEngineOptions {
  /** Canvas元素 */
  canvas: HTMLCanvasElement;
  /** 2D渲染上下文 */
  ctx: CanvasRenderingContext2D;
  /** 游戏模式 */
  gameMode: GameMode;
  /** 游戏难度 */
  difficulty: 'easy' | 'normal' | 'hard';
  /** 当前场景 */
  currentScene: SceneType;
  /** 音频管理器（可选） */
  audio?: any;
  /** 调试模式（可选） */
  debug?: boolean;
  /** 帧率限制（可选，默认60） */
  fpsLimit?: number;
}
```

### 主要API方法

#### 1. 创建引擎

```typescript
// 方式1：使用向后兼容API（推荐）
import { createGameEngine } from '@/game/engine';

const engine = createGameEngine(options);

// 方式2：直接使用新引擎
import { NewGameEngine } from '@/game/engine/NewGameEngine';

const engine = new NewGameEngine(options);

// 方式3：使用适配器（兼容原始接口）
import { GameEngineAdapter } from '@/game/engine/GameEngineAdapter';

const adapter = new GameEngineAdapter(options);
```

#### 2. 生命周期控制

```typescript
// 启动游戏
engine.start(): void;

// 暂停游戏
engine.pause(): void;

// 恢复游戏
engine.resume(): void;

// 停止游戏
engine.stop(): void;

// 重启游戏
engine.restart(): void;

// 重置游戏状态
engine.reset(): void;
```

#### 3. 状态管理

```typescript
// 获取当前游戏状态
const state = engine.getState(): GameState;

// 检查游戏是否运行中
const isRunning = engine.isRunning(): boolean;

// 检查游戏是否暂停
const isPaused = engine.isPaused(): boolean;

// 获取游戏统计信息
const stats = engine.getStats(): GameStats;
```

#### 4. 进度管理

```typescript
// 保存游戏进度
const progress = engine.saveProgress(): GameProgress;

// 加载游戏进度
engine.loadProgress(progress: GameProgress): void;

// 获取当前进度
const currentProgress = engine.getProgress(): GameProgress;

// 重置进度
engine.resetProgress(): void;
```

#### 5. 事件监听

```typescript
// 设置事件监听器
engine.on(event: string, callback: Function): void;

// 移除事件监听器
engine.off(event: string, callback: Function): void;

// 触发事件
engine.emit(event: string, ...args: any[]): void;

// 常用事件
engine.on('waveStart', (waveNumber: number) => {});
engine.on('waveComplete', (waveNumber: number) => {});
engine.on('enemyKilled', (enemyType: string, reward: number) => {});
engine.on('moneyChanged', (amount: number, total: number) => {});
engine.on('gameOver', (isVictory: boolean, wave: number, money: number) => {});
engine.on('error', (error: Error) => {});
```

### 引擎配置

```typescript
// 获取配置
const config = engine.getConfig(): GameConfig;

// 更新配置
engine.updateConfig(partialConfig: Partial<GameConfig>): void;

// 重置为默认配置
engine.resetConfig(): void;

// 配置示例
const customConfig = {
  graphics: {
    quality: 'high',
    effects: true,
    particles: true
  },
  audio: {
    volume: 0.8,
    music: true,
    sfx: true
  },
  gameplay: {
    autoAim: false,
    showDamageNumbers: true,
    screenShake: true
  }
};

engine.updateConfig(customConfig);
```

## 模块详细API

### 4.1 经济系统模块

#### 模块导入

```typescript
// 完整导入
import { 
  EconomyManager,
  AchievementManager, 
  ShopManager,
  formatMoney,
  calculateKillReward,
  type EconomyStats,
  type Achievement,
  type ShopItem
} from '@/game/engine/economy';

// 按需导入
import { EconomyManager } from '@/game/engine/economy/EconomyManager';
import { AchievementManager } from '@/game/engine/economy/AchievementManager';
import { ShopManager } from '@/game/engine/economy/ShopManager';
```

#### EconomyManager API

```typescript
class EconomyManager {
  // 构造函数
  constructor(initialMoney?: number);
  
  // 金钱管理
  addMoney(amount: number): void;
  spendMoney(amount: number): boolean;
  getMoney(): number;
  setMoney(amount: number): void;
  
  // 击杀奖励
  addKillReward(enemyType: string, multiplier?: number): number;
  getTotalKills(): number;
  getKillsByType(enemyType: string): number;
  
  // 统计信息
  getStats(): EconomyStats;
  resetStats(): void;
  
  // 事件
  onMoneyChanged(callback: (amount: number, total: number) => void): void;
  onKillAdded(callback: (enemyType: string, reward: number) => void): void;
}

// 使用示例
const economy = new EconomyManager(1000);

// 添加金钱
economy.addMoney(500); // 现在有1500

// 消费金钱
const canBuy = economy.spendMoney(200); // 返回true，剩余1300

// 添加击杀奖励
const reward = economy.addKillReward('small_roach', 1.5); // 基础奖励 * 1.5

// 获取统计
const stats = economy.getStats();
console.log(`总金钱: ${stats.totalMoney}, 总击杀: ${stats.totalKills}`);
```

#### AchievementManager API

```typescript
class AchievementManager {
  // 构造函数
  constructor(achievements?: Achievement[]);
  
  // 成就管理
  checkAchievement(achievementId: string, progressData: any): boolean;
  unlockAchievement(achievementId: string): void;
  isUnlocked(achievementId: string): boolean;
  
  // 进度跟踪
  getAchievementProgress(achievementId: string): number;
  updateProgress(achievementId: string, progress: number): void;
  
  // 获取成就信息
  getUnlockedAchievements(): Achievement[];
  getLockedAchievements(): Achievement[];
  getAllAchievements(): Achievement[];
  
  // 重置
  resetAchievements(): void;
}

// 使用示例
const achievements = new AchievementManager();

// 定义成就
const killAchievements = [
  {
    id: 'kill_100',
    name: '蟑螂杀手',
    description: '击杀100只蟑螂',
    icon: '🏆',
    requirement: { kills: 100 },
    reward: { money: 1000 }
  }
];

// 检查成就
const playerProgress = { kills: 105 };
const unlocked = achievements.checkAchievement('kill_100', playerProgress);

if (unlocked) {
  console.log('成就解锁: 蟑螂杀手');
}
```

#### ShopManager API

```typescript
class ShopManager {
  // 构造函数
  constructor(items?: ShopItem[]);
  
  // 物品管理
  getAvailableItems(playerProgress: any): ShopItem[];
  purchaseItem(itemId: string, playerProgress: any, economy: EconomyManager): PurchaseResult;
  canPurchase(itemId: string, playerProgress: any, money: number): boolean;
  
  // 价格计算
  getItemPrice(itemId: string, currentLevel?: number): number;
  getUpgradeCost(itemId: string, currentLevel: number): number;
  
  // 物品效果
  applyItemEffect(itemId: string, target: any): void;
  getItemEffect(itemId: string): ItemEffect;
  
  // 库存管理
  addToInventory(itemId: string, quantity?: number): void;
  removeFromInventory(itemId: string, quantity?: number): void;
  getInventory(): Record<string, number>;
}

// 使用示例
const shop = new ShopManager();

// 获取可购买物品
const availableItems = shop.getAvailableItems(playerProgress);

// 购买物品
const purchaseResult = shop.purchaseItem('weapon_upgrade', playerProgress, economy);

if (purchaseResult.success) {
  console.log(`购买成功! 花费: ¥${purchaseResult.cost}`);
  // 应用物品效果
  shop.applyItemEffect('weapon_upgrade', player);
}
```

#### 工具函数

```typescript
// 格式化金钱显示
const formatted = formatMoney(1234567); // "¥1,234,567"
const compact = formatMoney(1234567, { compact: true }); // "¥1.23M"

// 计算击杀奖励
const baseReward = 50;
const difficultyMultiplier = 1.5;
const waveMultiplier = 1.2;
const totalReward = calculateKillReward(baseReward, difficultyMultiplier, waveMultiplier); // 90

// 计算升级价格
const basePrice = 100;
const level = 5;
const upgradeCost = calculateUpgradeCost(basePrice, level); // 几何增长
```

### 4.2 波次系统模块

#### 模块导入

```typescript
import { 
  WaveManager,
  WaveGenerator,
  type WaveConfig,
  type WaveInfo,
  type EnemySpawnConfig
} from '@/game/engine/wave';
```

#### WaveManager API

```typescript
class WaveManager {
  // 构造函数
  constructor(options: WaveManagerOptions);
  
  // 波次控制
  startNextWave(): WaveConfig;
  endCurrentWave(): void;
  restartWave(): void;
  
  // 状态管理
  getCurrentWaveInfo(): WaveInfo;
  isWaveComplete(): boolean;
  isBossWave(): boolean;
  getWaveProgress(): number; // 0-1
  
  // 敌人管理
  spawnEnemies(deltaTime: number): Enemy[];
  getRemainingEnemies(): number;
  getTotalEnemiesInWave(): number;
  
  // 难度调整
  increaseDifficulty(): void;
  getDifficultyMultiplier(): number;
  
  // 事件
  onWaveStart(callback: (waveNumber: number) => void): void;
  onWaveComplete(callback: (waveNumber: number, isBossWave: boolean) => void): void;
  onBossSpawn(callback: (bossType: string) => void): void;
}

// 使用示例
const waveManager = new WaveManager({
  sceneType: SceneType.KITCHEN,
  gameMode: GameMode.STORY,
  difficulty: 'normal',
  initialWave: 1
});

// 开始新波次
const waveConfig = waveManager.startNextWave();
console.log(`第${waveConfig.waveNumber}波开始，敌人数量: ${waveConfig.totalEnemies}`);

// 游戏循环中更新
function gameLoop(deltaTime: number) {
  // 生成敌人
  const newEnemies = waveManager.spawnEnemies(deltaTime);
  
  // 检查波次是否完成
  if (waveManager.isWaveComplete()) {
    console.log('波次完成!');
    // 可以开始下一波
    waveManager.startNextWave();
  }
}
```

#### WaveGenerator API

```typescript
class WaveGenerator {
  // 构造函数
  constructor(templates?: WaveTemplate[]);
  
  // 波次生成
  generateWave(options: GenerateWaveOptions): WaveConfig;
  generateBossWave(waveNumber: number, sceneType: SceneType): WaveConfig;
  
  // 模板管理
  addTemplate(template: WaveTemplate): void;
  getTemplate(waveNumber: number): WaveTemplate | undefined;
  
  // 难度曲线
  calculateDifficulty(waveNumber: number, baseDifficulty: string): number;
  getEnemyComposition(waveNumber: number, sceneType: SceneType): EnemyComposition;
  
  // 随机化
  randomizeSpawnPoints(count: number, sceneBounds: Bounds): Point[];
  randomizeEnemyTypes(composition: EnemyComposition): EnemySpawnConfig[];
}

// 使用示例
const waveGenerator = new WaveGenerator();

// 生成波次配置
const waveConfig = waveGenerator.generateWave({
  waveNumber: 10,
  sceneType: SceneType.KITCHEN,
  difficulty: 'hard',
  playerLevel: 5
});

// 自定义波次模板
const customTemplate = {
  waveNumber: 15,
  name: '精英波次',
  description: '大量精英敌人',
  enemies: [
    { type: 'elite_roach', count: 10, spawnDelay: 1 },
    { type: 'boss_roach', count: 1, spawnDelay: 5 }
  ],
  rewards: {
    money: 5000,
    items: ['rare_weapon']
  }
};

waveGenerator.addTemplate(customTemplate);
```

### 4.3 物理粒子系统模块

#### 模块导入

```typescript
import { 
  PhysicsSystem,
  ParticleManager,
  type CollisionResult,
  type Particle,
  type PhysicsBody
} from '@/game/engine/physics';
```

#### PhysicsSystem API

```typescript
class PhysicsSystem {
  // 构造函数
  constructor(options?: PhysicsOptions);
  
  // 碰撞检测
  checkCollision(body1: PhysicsBody, body2: PhysicsBody): CollisionResult;
  checkCollisions(bodies: PhysicsBody[]): CollisionResult[];
  spatialQuery(position: Point, radius: number): PhysicsBody[];
  
  // 运动模拟
  updatePosition(body: PhysicsBody, deltaTime: number): void;
  applyForce(body: PhysicsBody, force: Vector): void;
  applyImpulse(body: PhysicsBody, impulse: Vector): void;
  
  // 物理属性
  setGravity(gravity: Vector): void;
  setFriction(friction: number): void;
  setElasticity(elasticity: number): void;
  
  // 性能优化
  enableSpatialPartitioning(gridSize: number): void;
  disableSpatialPartitioning(): void;
  
  // 调试
  drawDebug(ctx: CanvasRenderingContext2D): void;
}

// 使用示例
const physics = new PhysicsSystem({
  gravity: { x: 0, y: 98 }, // 模拟重力
  friction: 0.1,
  elasticity: 0.5
});

// 启用空间分区优化
physics.enableSpatialPartitioning(100);

// 游戏循环中更新
function updatePhysics(deltaTime: number, entities: Entity[]) {
  // 转换为物理体
  const bodies = entities.map(e => e.getPhysicsBody());
  
  // 检测碰撞
  const collisions = physics.checkCollisions(bodies);
  
  // 处理碰撞
  collisions.forEach(collision => {
    // 应用碰撞响应
    handleCollisionResponse(collision.body1, collision.body2, collision);
  });
  
  // 更新位置
  bodies.forEach(body => {
    physics.updatePosition(body, deltaTime);
  });
}
```

#### ParticleManager API

```typescript
class ParticleManager {
  // 构造函数
  constructor(options?: ParticleOptions);
  
  // 粒子创建
  createExplosion(x: number, y: number, intensity: number): Particle[];
  createFire(x: number, y: number, size: number, duration: number): Particle[];
  createSmoke(x: number, y: number, amount: number): Particle[];
  createSparkle(x: number, y: number, color: string, count: number): Particle[];
  createCustomParticle(config: ParticleConfig): Particle;
  
  // 粒子管理
  addParticle(particle: Particle): void;
  removeParticle(particleId: string): void;
  getParticles(): Particle[];
  getParticlesByType(type: string): Particle[];
  
  // 更新与渲染
  update(deltaTime: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  
  // 性能控制
  setMaxParticles(max: number): void;
  cleanupExpiredParticles(): void;
  
  // 特效组合
  createWeaponEffect(weaponType: string, position: Point, direction: Vector): Particle[];
  createDamageEffect(target: Entity, damage: number): Particle[];
  createHealingEffect(target: Entity, amount: number): Particle[];
}

// 使用示例
const particles = new ParticleManager({
  maxParticles: 1000,
  autoCleanup: true
});

// 创建爆炸效果
function createExplosionEffect(x: number, y: number) {
  // 核心爆炸
  particles.createExplosion(x, y, 1.0);
  
  // 火焰效果
  particles.createFire(x, y, 50, 2.0);
  
  // 烟雾效果
  particles.createSmoke(x, y, 20);
  
  // 火花效果
  particles.createSparkle(x, y, '#FF9900', 30);
}

// 游戏循环中更新
function gameLoop(deltaTime: number) {
  // 更新粒子
  particles.update(deltaTime);
  
  // 渲染粒子
  particles.render(ctx);
}
```

### 4.4 武器系统模块

#### 模块导入

```typescript
import { 
  WeaponManager,
  WeaponUpgradeManager,
  type Weapon,
  type WeaponState,
  type UpgradeEffect
} from '@/game/engine/weapon';
```

#### WeaponManager API

```typescript
class WeaponManager {
  // 构造函数
  constructor(weapons?: Weapon[]);
  
  // 武器控制
  switchWeapon(weaponType: string, player: Player): boolean;
  cycleWeapon(player: Player, direction: 'next' | 'prev'): string;
  getCurrentWeapon(): Weapon | null;
  
  // 发射逻辑
  fireWeapon(player: Player, targetX: number, targetY: number): Projectile[];
  canFire(weaponType: string): boolean;
  getCooldown(weaponType: string): number;
  
  // 弹药管理
  addAmmo(weaponType: string, amount: number): void;
  getAmmo(weaponType: string): number;
  hasAmmo(weaponType: string): boolean;
  
  // 状态获取
  getWeaponState(): WeaponState;
  getAvailableWeapons(playerProgress: any): Weapon[];
  
  // 事件
  onWeaponSwitched(callback: (oldWeapon: string, newWeapon: string) => void): void;
  onWeaponFired(callback: (weaponType: string, projectiles: Projectile[]) => void): void;
  onAmmoChanged(callback: (weaponType: string, current: number, max: number) => void): void;
}

// 使用示例
const weaponManager = new WeaponManager();

// 注册武器
const flamethrower: Weapon = {
  type: 'flamethrower',
  name: '火焰喷射器',
  damage: 15,
  range: 200,
  fireRate: 0.1,
  ammo: 100,
  maxAmmo: 100,
  projectileType: 'flame',
  specialEffects: ['burn', 'area']
};

weaponManager.registerWeapon(flamethrower);

// 切换武器
weaponManager.switchWeapon('flamethrower', player);

// 发射武器
function handleFire(targetX: number, targetY: number) {
  if (weaponManager.canFire('flamethrower')) {
    const projectiles = weaponManager.fireWeapon(player, targetX, targetY);
    // 处理发射的弹丸
    projectiles.forEach(p => game.addProjectile(p));
  }
}
```

#### WeaponUpgradeManager API

```typescript
class WeaponUpgradeManager {
  // 构造函数
  constructor(upgrades?: UpgradeDefinition[]);
  
  // 升级管理
  getAvailableUpgrades(playerProgress: any, weaponType: string): UpgradeDefinition[];
  applyUpgrade(upgradeId: string, weapon: Weapon, player: Player): Weapon;
  canUpgrade(upgradeId: string, playerProgress: any, money: number): boolean;
  
  // 效果计算
  getUpgradeEffect(upgradeId: string): UpgradeEffect;
  calculateUpgradedStats(baseWeapon: Weapon, upgrades: string[]): WeaponStats;
  
  // 升级树
  getUpgradeTree(weaponType: string): UpgradeTree;
  getPrerequisites(upgradeId: string): string[];
  getDependents(upgradeId: string): string[];
  
  // 重置
  resetUpgrades(weaponType?: string): void;
}

// 使用示例
const upgradeManager = new WeaponUpgradeManager();

// 定义升级
const damageUpgrade: UpgradeDefinition = {
  id: 'damage_boost_1',
  name: '伤害提升 I',
  description: '基础伤害提升20%',
  cost: 500,
  effect: {
    type: 'multiply',
    property: 'damage',
    value: 1.2
  },
  prerequisites: [],
  weaponType: 'flamethrower'
};

upgradeManager.addUpgrade(damageUpgrade);

// 应用升级
const upgradedWeapon = upgradeManager.applyUpgrade('damage_boost_1', currentWeapon, player);

// 获取升级后的属性
const stats = upgradeManager.calculateUpgradedStats(baseWeapon, ['damage_boost_1', 'range_boost_1']);
console.log(`升级后伤害: ${stats.damage}, 射程: ${stats.range}`);
```

### 4.5 实体系统模块

#### 模块导入

```typescript
import { 
  EntityManager,
  RoachManager,
  type Entity,
  type Roach,
  type EntityQuery
} from '@/game/engine/entity';
```

#### EntityManager API

```typescript
class EntityManager {
  // 构造函数
  constructor();
  
  // 实体管理
  addEntity(entity: Entity): string;
  removeEntity(entityId: string): boolean;
  getEntity(entityId: string): Entity | null;
  getAllEntities(): Entity[];
  
  // 查询系统
  queryEntities(query: EntityQuery): Entity[];
  getEntitiesByType(type: string): Entity[];
  getEntitiesInRange(position: Point, radius: number): Entity[];
  getNearestEntity(position: Point, maxDistance?: number): Entity | null;
  
  // 生命周期
  updateEntities(deltaTime: number): void;
  cleanupDeadEntities(): void;
  
  // 分组管理
  createGroup(name: string): void;
  addToGroup(entityId: string, groupName: string): void;
  getGroupEntities(groupName: string): Entity[];
  
  // 性能统计
  getStats(): EntityStats;
  
  // 事件
  onEntityAdded(callback: (entity: Entity) => void): void;
  onEntityRemoved(callback: (entityId: string) => void): void;
}

// 使用示例
const entityManager = new EntityManager();

// 添加实体
const roach = createRoach({ type: 'small', x: 100, y: 100 });
const roachId = entityManager.addEntity(roach);

// 查询实体
// 查询所有活着的蟑螂
const aliveRoaches = entityManager.queryEntities({
  type: 'roach',
  filters: [
    { property: 'state', operator: '!=', value: 'dead' }
  ],
  sortBy: 'distance',
  sortDirection: 'asc'
});

// 获取最近的敌人
const playerPosition = player.getPosition();
const nearestEnemy = entityManager.getNearestEntity(playerPosition, 300);

// 游戏循环中更新
function updateEntities(deltaTime: number) {
  entityManager.updateEntities(deltaTime);
  entityManager.cleanupDeadEntities();
}
```

#### RoachManager API

```typescript
class RoachManager {
  // 构造函数
  constructor();
  
  // 蟑螂创建
  spawnRoach(config: RoachSpawnConfig): Roach;
  spawnRoachGroup(count: number, config: GroupSpawnConfig): Roach[];
  
  // AI行为
  updateRoachAI(roach: Roach, playerPosition: Point, deltaTime: number): void;
  setRoachBehavior(roach: Roach, behavior: RoachBehavior): void;
  getRoachBehavior(roach: Roach): RoachBehavior;
  
  // 状态管理
  applyDamage(roach: Roach, damage: number, damageType?: string): boolean;
  healRoach(roach: Roach, amount: number): void;
  killRoach(roach: Roach, instant?: boolean): void;
  
  // 特殊能力
  activateSpecialAbility(roach: Roach, ability: string): boolean;
  getActiveAbilities(roach: Roach): string[];
  
  // 群体控制
  applyGroupEffect(roaches: Roach[], effect: GroupEffect): void;
  getRoachGroup(leaderId: string): Roach[];
  
  // 调试
  drawRoachDebug(ctx: CanvasRenderingContext2D, roach: Roach): void;
}

// 使用示例
const roachManager = new RoachManager();

// 生成蟑螂
const roach = roachManager.spawnRoach({
  type: 'elite',
  x: 200,
  y: 300,
  waveNumber: 10,
  healthMultiplier: 1.5,
  speedMultiplier: 1.2
});

// 应用伤害
const isDead = roachManager.applyDamage(roach, 50, 'fire');

if (isDead) {
  // 给予击杀奖励
  const reward = economy.addKillReward('elite_roach');
  console.log(`击杀精英蟑螂，获得¥${reward}`);
}

// 更新蟑螂AI
function updateRoaches(deltaTime: number) {
  const playerPos = player.getPosition();
  const roaches = entityManager.getEntitiesByType('roach');
  
  roaches.forEach(roach => {
    roachManager.updateRoachAI(roach, playerPos, deltaTime);
  });
}
```

### 4.6 渲染系统模块

#### 模块导入

```typescript
import { 
  RenderManager,
  type RenderOptions,
  type SceneData,
  type UIData,
  type EffectData
} from '@/game/engine/render';
```

#### RenderManager API

```typescript
class RenderManager {
  // 构造函数
  constructor(options: RenderOptions);
  
  // 场景渲染
  renderScene(data: SceneData): void;
  renderBackground(ctx: CanvasRenderingContext2D, sceneType: SceneType): void;
  renderEntities(ctx: CanvasRenderingContext2D, entities: Entity[]): void;
  renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void;
  
  // UI渲染
  renderUI(data: UIData): void;
  renderHUD(ctx: CanvasRenderingContext2D, hudData: HUDData): void;
  renderMenu(ctx: CanvasRenderingContext2D, menuData: MenuData): void;
  renderDialog(ctx: CanvasRenderingContext2D, dialogData: DialogData): void;
  
  // 特效渲染
  renderEffects(data: EffectData): void;
  applyScreenShake(ctx: CanvasRenderingContext2D, intensity: number): void;
  applyFlash(ctx: CanvasRenderingContext2D, color: string, alpha: number): void;
  applyBlur(ctx: CanvasRenderingContext2D, amount: number): void;
  
  // 性能优化
  enableBatching(): void;
  disableBatching(): void;
  setRenderQuality(quality: 'low' | 'medium' | 'high'): void;
  
  // 调试工具
  drawDebugOverlay(ctx: CanvasRenderingContext2D, debugData: DebugData): void;
  drawFPS(ctx: CanvasRenderingContext2D, fps: number): void;
  drawEntityCount(ctx: CanvasRenderingContext2D, count: number): void;
}

// 使用示例
const renderManager = new RenderManager({
  canvas,
  ctx,
  width: 540,
  height: 960,
  quality: 'high',
  enableEffects: true
});

// 渲染完整游戏帧
function renderGameFrame() {
  // 清除画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 渲染场景
  renderManager.renderScene({
    player,
    entities: gameEntities,
    particles: activeParticles,
    weather: currentWeather,
    timeOfDay: currentTime
  });
  
  // 渲染UI
  renderManager.renderUI({
    money: economy.getMoney(),
    wave: waveManager.getCurrentWaveInfo().number,
    playerHealth: player.hp,
    playerMaxHealth: player.maxHp,
    heat: player.heat,
    maxHeat: player.maxHeat,
    defenseHp: defense.currentHp,
    maxDefenseHp: defense.maxHp
  });
  
  // 应用屏幕震动（如果有）
  if (screenShakeIntensity > 0) {
    renderManager.applyScreenShake(ctx, screenShakeIntensity);
  }
}