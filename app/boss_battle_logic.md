# 蟑螂女王（BOSS战）完整逻辑梳理

## 一、初始化流程

```
进入BOSS关卡 → initBossBattle() → spawnBoss() → updateBossBattle()（每帧）
```

### 1.1 initBossBattle() — 初始化战斗状态

```typescript
// BossBattleState 初始值：
{
  active: true,
  bossHp: 3000 (简单) / 5000 (困难),
  bossMaxHp: 同上,
  phase: 1,              // 阶段一
  phaseName: '召唤之影',
  timeLimit: 180,        // 3分钟限时
  timeRemaining: 180,
  summonTimer: 3,        // 首次召唤倒计时3秒
  chargeTimer: 2,        // 首次冲锋倒计时2秒
  chargeWarning: false,  // 不在蓄力警告状态
  chargeWarningTimer: 0,
  stunCooldown: 0,
  bossDamageTaken: 0,
  enraged: false,
  chargeCooldown: 0,     // 冲锋冷却
}
→ 调用 spawnBoss()
→ 显示提示文字 + 屏幕震动
```

### 1.2 spawnBoss() — 生成BOSS实体

```typescript
// Roach 实体属性：
{
  type: RoachType.QUEEN,       // 蟑螂女王类型
  x: width / 2,                // 屏幕中央
  y: height * 0.25 + 200,     // 上方25% + 200px下移
  hp: 3000/5000,
  maxHp: 3000/5000,
  speed: 0.6,
  baseSpeed: 0.6,
  armorHp: 6 (简单) / 10 (困难),  // 甲壳值
  isBoss: true,                // 标记为BOSS
  isCharging: false,
  size: 120,                   // 独立size（不用ENEMY_DEFS）
  reward: 500,
  state: RoachState.ALIVE,
}
```

---

## 二、每帧更新流程 updateBossBattle()

```
1. 查找存活BOSS → 死亡则返回
2. 动画状态机 → 决定当前动作
3. 同步HP → bb.bossHp = boss.hp
4. 死亡检查 → hp <= 0 触发胜利
5. 时间检查 → 超时则防线崩溃
6. 阶段转换 → 根据HP切换阶段
7. 阶段行为 → 召唤/冲锋/召唤
8. 蓄力警告 → 倒计时→开始冲锋
9. 通知UI → 更新血条
```

### 2.1 动画状态机

```
if (死亡)          → 'die'      (死亡动画)
else if (冲锋中)   → 'charge'   (冲锋动画)
else if (蓄力警告) → 'summon'   (蓄力动画)
else if (移动中)   → 'walk'     (行走动画)
else if (血量<30%) → 'hurt'     (受伤动画)
else               → 'hover'    (悬停动画，默认)
```

### 2.2 死亡检查

```
if (boss.hp <= 0) {
  boss.hp = 0
  boss.state = DEAD
  state = GAME_OVER (胜利)
  显示"螂老大被消灭了! 胜利!"
  粒子爆炸 + 屏幕震动
  return; // 停止后续更新
}
```

### 2.3 阶段转换（基于HP百分比）

| 条件 | 转换 |
|------|------|
| `hp <= 30%` 且 `phase < 3` | → **阶段三：终极疯狂** |
| `hp <= 70%` 且 `phase < 2` | → **阶段二：天降狂暴** |

```
阶段二：speed = baseSpeed * 1.8  (加速80%)
阶段三：speed = baseSpeed * 2.5  (加速150%)
        + 召唤自爆蟑螂+分裂蟑螂
```

### 2.4 阶段行为

#### 阶段一（100%~70% HP）— 召唤之影
```
summonTimer 倒计时10秒：
  → 召唤 2只小蟑螂 + 1只大蟑螂
  → 重置 summonTimer = 10
  
特性：
- BOSS完全静止（不移动）
- 火焰伤害 ×0.5（抗火甲壳）
- 只召唤小怪，不冲锋
```

#### 阶段二（70%~30% HP）— 天降狂暴
```
chargeTimer 倒计时4秒：
  → 30%概率触发蓄力警告
  → 设置 chargeWarning = true
  → chargeWarningTimer = 1.0秒

蓄力警告结束：
  → 设置 boss.isCharging = true
  → BOSS开始向下冲锋

特性：
- 火焰伤害 ×1.5（破甲）
- 可冲锋攻击
```

#### 阶段三（<30% HP）— 终极疯狂
```
summonTimer 倒计时12秒：
  → 召唤 1只自爆蟑螂 + 1只分裂蟑螂

chargeTimer 倒计时2.5秒：
  → 50%概率触发蓄力警告

特性：
- 全伤害 ×1.25
- 冲锋更频繁
- 召唤精英怪
```

### 2.5 冲锋攻击流程

```
1. chargeTimer 倒计时结束
   → 随机判断是否触发（30%/50%）
   → chargeWarning = true
   → chargeWarningTimer = 1.0秒

2. 蓄力警告期间（1秒）
   → BOSS静止，轻微抖动
   → 红色粒子特效
   → 警告倒计时

3. 警告结束
   → 检查 chargeCooldown <= 0
   → boss.isCharging = true

4. 冲锋期间（updateRoaches中处理）
   → 直线向下冲刺
   → 速度：min(200 + phase*30, 300)
   → 到达防线前80px停止

5. 到达防线
   → r.isCharging = false
   → 防线扣血（20/35）
   → chargeCooldown = 3秒（冷却）
   → 弹回安全位置
```

---

## 三、伤害系统

### 3.1 伤害来源

| 来源 | 伤害类型 | 是否对BOSS有效 |
|------|---------|--------------|
| 火焰喷射器（coneFire） | fire | ✅ 有fireZone伤害 |
| 燃烧瓶（molotov） | fire | ✅ 有fireWall伤害+BOSS倍率 |
| 蟑螂贴板（stickyBoard） | normal | ✅ 通用碰撞伤害 |
| 雷达激光（radarLaser） | normal | ✅ 通用碰撞伤害 |
| 杀虫剂（insecticideSpray） | normal | ✅ 通用碰撞伤害 |
| 散弹火焰（shotgunFlame） | fire | ✅ 有fireZone伤害 |

### 3.2 伤害倍率 getBossDamageMultiplier()

```
基础倍率 = 1.0

阶段一 + 火焰 → ×0.5  (抗火)
阶段二/三 + 火焰 → ×1.5  (破甲)
阶段三 → ×1.25  (狂暴)
晕眩状态 → ×1.5  (拍子加成)

倍率叠加：
  阶段三 + 火焰 = 1.5 × 1.25 = 1.875
  阶段三 + 火焰 + 晕眩 = 1.5 × 1.25 × 1.5 = 2.8125
```

### 3.3 fireZone伤害（火焰喷射器）

```
在 updateFireZones() 中：
1. 遍历所有 fireZone
2. 检查蟑螂是否在范围内（距离 < radius + size/2）
3. 计算伤害：damagePerSecond × deltaTime × boss倍率
4. 扣减HP：r.hp -= damage
5. 设置 inFire = true, damageFlash = 0.1

fireZone参数：
  radius: range × 0.8  (覆盖范围)
  damagePerSecond: baseDamage/deltaTime × 3  (3倍伤害)
  life: 0.5秒  (持续时间)
```

### 3.4 fireWall伤害（燃烧瓶）

```
在 updateFireWalls() 中：
1. 遍历所有 fireWall
2. 检查蟑螂是否在墙范围内（x在范围内 + y距离 < height + size/2）
3. 计算伤害：damagePerSecond × deltaTime × boss倍率
4. 扣减HP：r.hp -= damage
5. 设置 burnDamage (持续伤害), inFire = true
```

---

## 四、移动系统 updateRoaches() 中BOSS部分

```
if (BOSS且存活) {
  // 冲锋状态
  if (isCharging) {
    直线向下冲刺
    速度 = min(200 + phase*30, 300)
    到达防线前80px → isCharging = false
    chargeCooldown = 3秒
  }
  
  // 非冲锋状态
  else {
    完全静止（不移动）
    // 只有翅膀动画
  }
  
  // 安全钳制
  y = min(y, defenseLine - 30)  // 不超过防线
  x = clamp(x, 80, width-80)    // 不超左右边界
}
```

---

## 五、渲染系统

### 5.1 动画帧选择

```
// 根据状态选择动作
const action = bossAnimState.action  // 'hover'/'charge'/'summon'/...
const frameIdx = bossAnimState.frameIndex
const frames = bossAnimFrames.get(action)
const img = frames[frameIdx]  // 当前帧图片

// 渲染
ctx.drawImage(img, -bossW/2, -bossH/2, bossW, bossH)
// bossW = normalWidth × 2  (放大一倍)
```

### 5.2 阶段图片选择

```
if (phase >= 3) → boss_p3.png (终极形态)
else if (phase >= 2) → boss_p2.png (狂暴形态)
else → boss_p1.png (基础形态)
```

### 5.3 HP血条渲染

```
位置：barY = 82 (屏幕顶部下方)
宽度：barW = min(400, width × 0.7)
颜色：根据HP百分比渐变（绿→黄→红）
```

---

## 六、胜负条件

### 胜利条件
```
BOSS血量 ≤ 0
→ GAME_OVER (胜利)
→ 显示"螂老大被消灭了! 胜利!"
```

### 失败条件
```
1. 时间耗尽（180秒）
   → defenseHp = 0
   → 显示"时间耗尽! 防线崩溃!"

2. 防线血量 ≤ 0
   → GAME_OVER (失败)
```

---

## 七、完整数据流

```
[玩家操作] → [火焰/燃烧瓶/拍子等]
    ↓
[updateFireZones/FireWalls] → 伤害计算
    ↓
[boss.hp -= damage] → HP减少
    ↓
[updateBossBattle] → 同步 bb.bossHp = boss.hp
    ↓
[死亡检查] → hp <= 0 ?
    ↓ 是
[boss.state = DEAD] → GAME_OVER (胜利)
    ↓
[渲染] → 显示死亡动画/胜利画面
```
