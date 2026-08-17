/**
 * @fileoverview 文案与浮动文字颜色配置
 * @description 集中管理游戏内所有 UI 文案、战斗特效文字内容，以及对应的浮动文字颜色。
 * 每个 combat 条目为 { text, color } 对象，颜色紧跟在对应文字下方。
 * 使用方式：import { TEXT_CONFIG } from './data';
 *          this.addFloatingText(x, y, TEXT_CONFIG.combat.xxx.text, TEXT_CONFIG.combat.xxx.color);
 */

// ========== 文案配置 ==========
export const TEXT_CONFIG = {
  // ===== 战斗特效文字 =====
  // 战斗中出现的浮动文字，包含 text 内容和 color 颜色
  combat: {
    // 防线/碰撞
    defenseBreach: { text: '防线突破!', color: '#ef4444' },     // 红色警告
    shieldBlock: { text: '护盾抵消!', color: '#22d3ee' },       // 青色护盾
    armorBreak: { text: '破甲!', color: '#fbbf24' },            // 金色破甲
    armorShatter: { text: '护甲碎裂!', color: '#fbbf24' },      // 金色碎裂
    armorImmune: { text: '护甲免疫', color: '#60a5fa' },         // 蓝色免疫

    // 投掷物落地
    stickyLand: { text: '冰冻!', color: '#facc15' },             // 金色冰冻
    poisonLand: { text: '毒雾!', color: '#a78bfa' },             // 紫色毒雾
    molotovLand: { text: '燃烧!', color: '#f87171' },             // 红色燃烧

    // 蟑螂贴板
    stickyLaunch: { text: '蟑螂贴板发射!', color: '#facc15' },
    stickyTracking: { text: (n: number) => `${n}个追踪水滴`, color: '#fde047' },
    stickyCapture: { text: (d: number) => `粘住${d}秒!`, color: '#facc15' },
    stickyBoard: { text: '贴板!', color: '#facc15' },
    stickyStuck: { text: '粘住!', color: '#facc15' },

    // 雷达激光
    radarActivate: { text: '雷达激光启动! 自动追踪目标', color: '#22d3ee' },
    radarDesc: { text: (n: number) => `${n}发激光，伤害与小蟑螂一致`, color: '#67e8f9' },
    radarCountdown: { text: (s: number) => `雷达激光 ${s}秒...`, color: '#22d3ee' },
    radarClosing: { text: '雷达激光即将关闭!', color: '#f87171' },
    radarClosed: { text: '雷达激光关闭', color: '#9ca3af' },
    radarShot: { text: (n: number) => `激光 x${n}`, color: '#22d3ee' },
    radarExhausted: { text: '激光发射完毕!', color: '#9ca3af' },
    radarKill: { text: '激光击杀!', color: '#22d3ee' },

    // 电蚊拍
    swatterReady: { text: '⚡ 电蚊拍就绪!', color: '#4ade80' },
    swatterHit: { text: (hit: number, armor: number) => `⚡电蚊拍全屏!命中${hit}只!破甲${armor}!`, color: '#4ade80' },
    swatterHitParalyze: { text: (hit: number) => `⚡电蚊拍全屏!命中${hit}只!麻痹!`, color: '#4ade80' },
    swatterMiss: { text: '⚡电蚊拍!未命中', color: '#9ca3af' },
    swatterNoItem: { text: '没有电蚊拍!', color: '#9ca3af' },
    swatterCooldown: { text: (s: string) => `电蚊拍冷却中... (${s}s)`, color: '#94a3b8' },
    globalCooldown: { text: (s: string) => `道具冷却中... (${s}s)`, color: '#94a3b8' },
    swatterPickup: { text: '获得电蚊拍!', color: '#4ade80' },

    // 强力风扇
    fanActivate: { text: '强力风扇启动!', color: '#a78bfa' },
    fanDesc: { text: (d: number) => `蟑螂被吹退${d}秒!`, color: '#c4b5fd' },
    fanRefresh: { text: '风扇已续期!', color: '#a78bfa' },
    fanDurationWithTalent: { text: (baseDuration: number, mult: number) => `蟑螂被吹退${(baseDuration * mult).toFixed(1)}秒!(+天赋)`, color: '#c4b5fd' },
    fanStop: { text: '风扇停止', color: '#9ca3af' },

    // 毒气喷射
    insecticideActivate: { text: '双侧毒气喷射!', color: '#4ade80' },
    insecticideDesc: { text: (d: number) => `两侧横向毒雾${d}秒`, color: '#86efac' },
    insecticideClosing: { text: '毒气喷射即将结束!', color: '#f87171' },
    insecticideEnd: { text: '毒气喷射结束', color: '#9ca3af' },
    insecticideHit: { text: (n: number) => `毒气命中${n}只!`, color: '#4ade80' },

    // 蟑螂AI
    queenSummon: { text: '女王召唤了小蟑螂!', color: '#ff44aa' },
    bombPlaced: { text: '炸弹已安放!', color: '#ef4444' },
    transformBig: { text: '变身大蟑螂!', color: '#fbbf24' },
    nurseCasting: { text: '【施法中】', color: '#4ade80' },
    nurseIllegal: { text: '非法行医!', color: '#5a8a5a' },
    bombFailed: { text: '炸弹没响...', color: '#666666' },
    corpseBomb: { text: (s: number) => `尸体炸弹 ${s}秒!`, color: '#ff4444' },
    bossDefeated: { text: 'BOSS 击败!', color: '#fbbf24' },
    killReward: { text: (reward: number) => `+¥${reward}`, color: '#4ade80' },

    // Boss
    bossAppear: { text: '螂老大出现了!', color: '#ef4444' },
    bossSpawnEggs: { text: '它正在产卵!消灭虫卵!', color: '#fbbf24' },
    bossDefeatedText: { text: '螂老大被消灭了!', color: '#ef4444' },
    victory: { text: '胜利!', color: '#22c55e' },
    bossSummon: { text: '召唤虫卵!', color: '#a855f7' },
    bossDialogue1: { text: '螂老大: "不...不可能!"', color: '#ef4444' },
    bossDialogue2: { text: '螂老大: "我的虫卵大军...全灭了..."', color: '#ef4444' },

    // 波次
    waveCleared: { text: '支援单位已清除，推进下一波!', color: '#fbbf24' },
    waveClearedN: { text: (wave: number) => `第${wave}波清除!`, color: '#22c55e' },
    gameVictory: { text: '游戏胜利', color: '#22c55e' },
    countdown: { text: '倒计时3-2-1...', color: '#fbbf24' },

    // 消耗品
    gasRefill: { text: '燃气已回满!', color: '#fbbf24' },
    powerBoost: { text: (s: number) => `>>> 火力全开 ${s}秒 <<<`, color: '#ef4444' },
    shieldActive: { text: (s: number) => `>>> 防线护盾 ${s}秒 <<<`, color: '#06b6d4' },

    // 渲染器
    transformCountdown: { text: (s: number) => `变身! ${s}s`, color: '#fbbf24' },
    spawnCount: { text: (n: number) => `生成${n}只!`, color: '#ff0040' },
    roachQueen: { text: '蟑螂女王', color: '#ef4444' },
    defenseLine: { text: '防 线', color: '#e5e7eb' },
    groundBounds: { text: '蟑螂地面边界(6点折线)', color: '#e5e7eb' },

    // 蟑螂AI - 更多
    nurseSpray: { text: '治疗喷射!', color: '#5a8a5a' },
    nurseHeal: { text: (n: number) => `+${n}`, color: '#ef4444' }, // 治疗量浮动文字（红色）
    bigExplosion: { text: (n: number) => `大爆炸!(${n}只受波及)`, color: '#ff4400' },
    deathExplosion: { text: (n: number) => `死亡爆炸!(${n}只受波及)`, color: '#ff4400' },
    boom: { text: '轰!', color: '#8b2020' },
    splitSpawn: { text: '分裂x5!', color: '#ff8800' },
    trainWarning: { text: '列车即将进站！', color: '#fbbf24' },
    trainIncoming: { text: '列车进站！', color: '#fecaca' },
    trainKill: { text: '碾压！', color: '#fca5a5' },
    // 地铁场景：隧道工 / 精英 / 斩螂·110
    armorSpray: { text: '护甲喷涂!', color: '#a8a29e' },
    eliteCharge: { text: '轨道冲刺!', color: '#f97316' },
    eliteBroken: { text: '冲刺被打断!', color: '#fbbf24' },
    eliteSplit: { text: '分裂x2!', color: '#fb923c' },
    // 地铁场景：护盾蟑螂气体护盾
    shieldGasBlock: { text: '格挡!', color: '#67e8f9' },
    shieldBreak: { text: '护盾破碎!', color: '#fbbf24' },
    shieldRebuild: { text: '护盾重组!', color: '#67e8f9' },
    shieldRepair: { text: '护盾修理!', color: '#a8a29e' },
    knifeKill: { text: '一击必杀!', color: '#e2e8f0' },
    knifeNoTarget: { text: '没有可斩的目标!', color: '#9ca3af' },
    disintegrate: { text: '解体!', color: '#88ccff' },
    explode: { text: (n: number) => `爆炸!(${n}只受波及)`, color: '#ff6600' },
    embryoBurst: { text: '【胚胎暴走】', color: '#ff0040' },
    acidSplash: { text: '酸液飞溅!', color: '#84cc16' },
    acidCorrode: { text: (n: number) => `${n}只受腐蚀`, color: '#a3e635' },
    suicideDamage: { text: (dmg: number) => `自爆伤害! -${dmg}`, color: '#ef4444' },
    bombExplode: { text: (dmg: number) => `炸弹爆炸! -${dmg}`, color: '#ef4444' },
    backlash: { text: (dmg: number) => `反噬 -${dmg}`, color: '#a855f7' },
    spawnBirth: { text: (name: string) => `【诞生】${name}!`, color: '#00ff80' },
    berserk: { text: '狂暴!', color: '#ef4444' },

    // 消耗品 - 更多
    baitPlaced: { text: '>>> 蟑螂诱饵已投放 <<<', color: '#fbbf24' },
    baitEnd: { text: '诱饵效果 消失', color: '#fbbf24' },
    powerBoostEnd: { text: '火力全开 结束', color: '#f87171' },
    shieldEnd: { text: '防线护盾 消失', color: '#22d3ee' },

    // 天气
    lightning: { text: '⚡ 闪电 ⚡', color: '#fbbf24' },

    // 三喷火枪
    tripleFlameActivate: { text: (d: number) => `三喷火枪模式! 持续${d}秒`, color: '#fbbf24' },
    tripleFlameRefresh: { text: (d: number) => `三喷火枪已刷新! 持续${d}秒`, color: '#fbbf24' },
    tripleFlameWarning: { text: (d: number) => `⚠ 三喷火枪即将消失! ${d}秒 ⚠`, color: '#ef4444' },
    tripleFlameEnd: { text: '三喷火枪模式结束', color: '#9ca3af' },

    // 风扇
    fanBlowing: { text: '吹退中', color: '#a78bfa' },

    // Boss - 更多
    bossDialogue3: { text: '螂老大: "这次算你赢了!我会回来的!"', color: '#fbbf24' },
    bossFlee: { text: '螂老大飞走了...', color: '#9ca3af' },
    bossPhase1: { text: '第一波:虫卵', color: '#ef4444' },
    bossAppearTitle: { text: '【螂老大来袭】', color: '#ef4444' },
    bossDefendLine: { text: '消灭虫卵和蟑螂!保卫防线!', color: '#fbbf24' },
    bossDialogueShort: { text: '不...不可能!我的虫卵大军...', color: '#ef4444' },
    bossSummoning: { text: 'BOSS正在召唤虫卵...', color: '#a855f7' },
    preparing: { text: '准备中', color: '#9ca3af' },
    bossFleeing: { text: 'BOSS逃跑中', color: '#9ca3af' },

    // 投掷物 - 更多
    poisonHit: { text: (n: number) => `毒雾!(${n}只)`, color: '#a78bfa' },

    // 放置
    placeItem: { text: (name: string) => `点击放置 ${name}`, color: '#fbbf24' },

    // 波次/虫卵
    waveEggRelease: { text: (wave: number) => `第${wave}波虫卵释放!`, color: '#ef4444' },
    eggHatchPending: { text: (count: number) => `${count}个虫卵即将孵化`, color: '#fbbf24' },

    // 结算
    itemRecycle: { text: (amount: number) => `道具回收 +¥${amount}`, color: '#fbbf24' },
    talentReward: { text: (points: number) => `+${points} 天赋点!`, color: '#fbbf24' },
    starRating: { text: ['', '通关!', '优秀!', '完美!'] as readonly string[], color: '#fbbf24' },
    breachCount: { text: (count: number) => `防线突破: ${count}次`, color: '#f87171' },
    defeat: { text: '防线被攻破! 战斗失败!', color: '#ef4444' },

    // 无尽模式
    newRecord: { text: '你创造了新纪录!', color: '#fbbf24' },
    bestTimeRefreshed: { text: '历史最高时长已刷新!', color: '#fde047' },

    // 武器/道具拾取
    weaponPickup: { text: (name: string, bonus: string) => `拾取: ${name}!${bonus}`, color: '#4ade80' },
    weaponSwitch: { text: (name: string) => `切换到: ${name}`, color: '#facc15' },
    weaponExpired: { text: '武器已过期', color: '#9ca3af' },
    barrelCooldown: { text: '⚠️ 枪管冷却中!', color: '#fbbf24' },
    openFire: { text: '>>> 开 火 <<<', color: '#22c55e' },
    itemCooldown: { text: (s: string) => `道具冷却中... (${s}s)`, color: '#94a3b8' },
    namedCooldown: { text: (name: string, s: string) => `${name}冷却中... (${s}s)`, color: '#94a3b8' },

    // 火焰墙
    fireWall: { text: (count: number) => `火焰墙!(${count}只)`, color: '#f87171' },
    fireWallSimple: { text: '火焰墙!', color: '#f87171' },

    // 尸体炸弹
    corpseBombExplode: { text: '尸体炸弹爆炸!', color: '#ff4400' },
    corpseBombDamage: { text: (dmg: number) => `尸体炸弹! -${dmg}`, color: '#ef4444' },

    // 定时自爆
    timedSuicideNext: { text: '定时自爆蟑螂出现! 下一只8秒后', color: '#f59e0b' },
    timedSuicideAll: { text: '定时自爆蟑螂全部出现!', color: '#f59e0b' },
    bombWarning: { text: '!!', color: '#ff0000' },

    // 场景解锁
    sceneUnlock: { text: (name: string) => `解锁新场景: ${name}!`, color: '#fbbf24' },

    // 投掷武器
    throwWeapon: { text: (name: string) => `投掷${name}!`, color: '#fbbf24' },

    // 雷达激光伤害
    radarDamage: { text: (dmg: number) => `-${dmg}`, color: '#22d3ee' },

    // 消耗品 - 冷却相关
    combatStartCooldown: { text: (s: string) => `冷却中... (${s}s)`, color: '#94a3b8' },
    consumableGlobalCooldown: { text: (s: string) => `全局冷却中... (${s}s)`, color: '#94a3b8' },
    defenseRepair: { text: (heal: number) => `防线修复 +${heal}`, color: '#4ade80' },
    emergencyCoolAdd: { text: (n: number) => `紧急冷却 +1 (共${n}次)`, color: '#60a5fa' },
    emergencyCoolUse: { text: (n: number) => `紧急冷却! (剩余${n}次)`, color: '#60a5fa' },
    powerBoostCountdown: { text: (s: number) => `火力全开 ${s}秒`, color: '#ef4444' },

    // Boss - 更多
    bossWaveNames: { text: ['', '虫卵入侵', '大蟑螂卵', '飞行蟑螂卵', '精英蟑螂卵'] as readonly string[], color: '#fbbf24' },
    bossWaveTitle: { text: (wave: number, name: string) => `【第${wave}波: ${name}】`, color: '#fbbf24' },
    bossPhaseTitle: { text: (phaseName: string) => `螂老大 - ${phaseName}`, color: '#ef4444' },
    bossWaveProgress: { text: (wave: number) => `第${wave}/4波`, color: '#fbbf24' },
    bossTimeRemaining: { text: (secs: number) => `剩余时间: ${secs}秒`, color: '#9ca3af' },

    // 成就
    achievementUnlock: { text: (name: string, reward: number) => `成就: ${name} +¥${reward}`, color: '#fbbf24' },

    // 定时器显示
    fanTimer: { text: (timer: string) => `风扇 ${timer}s`, color: '#c4b5fd' },
    insecticideTimer: { text: (timer: string) => `杀虫剂 ${timer}s`, color: '#86efac' },

    // 爆炸通用回退
    explosionFallback: { text: '爆炸!', color: '#ff6600' },
    bigExplosionFallback: { text: '大爆炸!', color: '#ff4400' },
    deathExplosionFallback: { text: '死亡爆炸!', color: '#ff4400' },

    // 炸弹倒计时
    bombCountdown: { text: (s: number) => `${s}`, color: '#ff0000' },

    // 过热警告 HUD 覆盖层
    overheatWarningHud: { text: (s: number) => `⚠️ 过热警告 ${s}秒`, color: '#ef4444' },

    // 换气罐中
    reloadingText: { text: '更换气罐中', color: '#fbbf24' },

    // Boss 阶段名称
    bossPhaseNames: { text: ['虫卵入侵', '大蟑螂卵', '飞行蟑螂卵', '精英蟑螂卵'] as readonly string[], color: '#ef4444' },
  },

  // ===== 道具名称 =====
  // 道具的中文简称，用于 UI 显示
  items: {
    sticky: '蟑螂贴板',
    poison: '杀虫剂',
    insecticide: '杀虫喷雾',
    molotov: '燃烧瓶',
    shotgun: '散弹模式',
    radar: '雷达激光',
    fan: '强力风扇',
    swatter: '电蚊拍',
    knife: '斩螂·110',
  },

  // ===== 武器名称 =====
  // 武器模式的中文名称
  weapons: {
    flamethrower: '火焰',
    shotgun: '散弹',
  },

  // ===== UI 组件文字 =====
  // 所有 UI 界面的文案，包括标题、菜单、HUD、成就、图鉴、结算等
  ui: {
    // 标题屏幕 - 游戏启动时的加载/标题界面
    title: {
      title: '蟑螂猎手',
      subtitle: 'ROACH BLASTER',
      lore: '一寸灰烬，一寸血',
      clickToStart: '点击开始',
      initializing: '初始化系统...',
      loadingHints: [
        '正在连接灰烬区网络...',
        '加载蟑螂基因数据库...',
        '校准火焰喷射器...',
        '检查丙烷燃料储备...',
        '扫描辐射水平...',
        '同步雷达激光系统...',
        '读取蟑叔的除虫日志...',
        '正在初始化防线...',
        '蟑螂感应器预热中...',
        '准备燃烧瓶弹药...',
      ],
    },

    // 主菜单 - 模式选择、难度选择、场景选择
    menu: {
      title: '烈焰除蟑',
      subtitle: '火线守卫',
      storyMode: '剧情模式',
      endlessMode: '无尽模式',
      selectDifficulty: '选择难度',
      selectScene: '选择关卡',
      easy: '简单模式',
      hard: '困难模式',
      back: '返回',
      reset: '重置',
      resetTitle: '重置进度',
      resetDesc: '此操作不可恢复',
      resetConfirm: '确定要删除所有游戏存档吗？包括天赋点、关卡解锁进度、成就和设置都将被清除。',
      cancel: '取消',
      confirmDelete: '确认删除',
      shop: '道具商店',
      talent: '天赋',
      achievements: '成就',
      encyclopedia: '图鉴',
      locked: '锁定',
      rewardMultiplier: (n: number) => `x${n}奖励`,
      mute: '静音',
      unmute: '开启音效',
      easyShort: '简单',
      hardShort: '困难',
      storyDesc: '10波标准关卡',
      endlessDesc: '无限波次挑战',
      backToDifficulty: '[ 返回难度选择 ]',
      backToMode: '返回模式选择',
      storyDifficultySelect: (difficulty: string) => `${difficulty} — 选择一个场景`,
    },

    // HUD - 战斗中显示的信息（燃气、波次、金币、击杀、防线等）
    hud: {
      gas: '燃气',
      wave: '波次',
      waveDisplay: (current: number, total?: number) => total !== undefined && total > 0 ? `波次 ${current}/${total}` : `波次 ${current}`,
      money: '资金',
      kills: '击杀',
      defense: '防线',
      tripleFlamethrower: '三喷火枪',
      reload: '换罐',
      reloading: (s: number) => `换罐中...${s}s`,
      reloadFree: '免费',
      reloadCost: '¥5',
      overheating: '过热警告!',
      emergencyCool: (n: number) => `紧急冷却 (${n}次)`,
      coolExhausted: '冷却已用完',
      placeItem: '点击屏幕放置位置',
      cancelPlace: '点击图标取消',
      itemCooldown: (name: string) => `${name} 冷却中...`,
    },

    // 倒计时 - 战斗开始前的 3-2-1 倒计时
    countdown: {
      battleStart: '战斗开始！',
      prepare: '准备战斗',
    },

    // 成就
    achievements: {
      title: '成就系统',
      all: '全部',
      unlocked: '已解锁',
      locked: '未解锁',
      completion: (p: string) => `完成度 ${p}%`,
      empty: '该分类下没有成就',
      back: '返回',
      unlockTitle: '成就解锁！',
    },

    // 图鉴
    encyclopedia: {
      title: '蟑螂图鉴',
      totalKills: (n: number) => `累计击杀 ${n} 只蟑螂`,
      totalKillsPrefix: '累计击杀 ',
      totalKillsSuffix: ' 只蟑螂',
      hp: '生命值',
      speed: '速度',
      specialAbility: '特殊能力',
      description: '描述',
      funFact: '趣味冷知识',
      close: '关闭',
      killed: (n: number) => `已击杀 ${n} 只`,
      killedSimple: (n: number) => `击杀 ${n}`,
      hint: '点击已解锁的蟑螂查看详细信息',
      back: '返回',
    },

    // 漫画 - 关卡开始的漫画过场
    comic: {
      skip: '跳过',
      syncing: '同步数据中...',
      startBattle: '开始战斗',
      clickToSkip: '[ 点击跳过 ]',
      clickOrSwipe: '[ 点击或滑动切换 ]',
      comicPanelAlt: (n: number) => `漫画 ${n}`,
    },

    // 对话 - 关卡开始的对话过场
    dialog: {
      skip: '跳过',
      clickToSkip: '点击跳过打字',
      starting: '即将开始...',
      clickToContinue: '点击继续',
    },

    // 商店 - 关卡间的道具商店
    shop: {
      title: '补给站',
      buy: '购买',
      insufficient: '资金不足',
      desc: '购买一次性消耗品，为下一关做准备',
      hardMode: '[困难模式]',
      currentMoney: '当前资金',
      talentPoints: '天赋点',
      totalKills: '总击杀',
      flameCategory: '火枪相关',
      supportCategory: '辅助道具',
      talentUnlocked: '获得天赋点！',
      talentDesc: '通关奖励，可用于永久强化角色能力',
      goAddPoints: '去加点',
      ownedItems: '已拥有道具',
      noItems: '暂无道具',
      nextLevel: (name: string) => `进入下一关：${name}`,
      playAgain: '再来一局',
      backToMenu: '返回主菜单',
    },

    // 无尽模式
    endless: {
      currentRun: '本次坚持',
      bestRecord: '历史最高',
      newRecord: '你创造了新纪录!',
    },

    // 游戏结束 - 胜利/失败结算界面
    gameOver: {
      bossDefeatedShort: '螂老大被消灭!',
      bossVictoryDesc: '下水道重获安宁',
      victoryDesc: '成功守住所有波次',
      defeatDesc: '蟑螂突破了防线',
      bossModeName: 'BOSS战',
      dailyModeName: '每日挑战',
      defenseBreached: '防线失守',
      endlessDefeat: (wave: number) => `无尽模式坚持了 ${wave} 波`,
      waveReached: '到达波次',
      totalKills: '总击杀',
      finalMoney: '最终资金',
      smallRoach: '小蟑螂',
      largeRoach: '大蟑螂',
      flying: '飞行',
      armored: '装甲',
      splitting: '分裂',
      queen: '女王',
      tunnelWorker: '隧道工',
      subwayElite: '精英',
      breaches: '防线突破',
      talentUnlocked: '获得天赋点！',
      talentDesc: '通关奖励，可用于强化角色能力',
      goAddPoints: '去加点',
      nextLevel: (name: string) => `下一关：${name}`,
      playAgain: '再来一局',
      backToMenu: '返回主菜单',
      storyMode: '剧情模式',
      endlessMode: '无尽模式',
    },

    // 通用 - 共用按钮文字
    common: {
      back: '返回',
      close: '关闭',
      cancel: '取消',
      confirm: '确认',
    },

    // ===== 天赋树 =====
    talentTree: {
      title: '天赋树',
      talentPoints: '天赋点',
      skipTutorial: '跳过引导',
      nextStep: '下一步',
      doneTutorial: '知道了，开始加点',
      zhangshu: '蟑叔',
      currentLevel: '当前等级',
      upgradeCost: '升级消耗',
      maxed: '已满级',
      upgrade: '升级天赋',
      insufficient: '天赋点不足',
      categories: {
        combat: '战斗强化',
        survival: '生存强化',
        utility: '辅助强化',
        item: '道具专精',
      },
      tutorialSteps: [
        '这是「火焰伤害」，提升你的火焰喷射伤害！每级+10%伤害，最多5级。对付大蟑螂特别有效！',
        '这是「火焰范围」，增加喷射距离！每级+15%范围，最多5级。烧得更远更安全！',
        '这是「气罐容量」，增加燃料上限！每级+20%容量，最多5级。少换气罐多烧一会儿！',
        '这是「过热抗性」，提升过热上限！每级+15%阈值，最多5级。连续喷射不容易熄火！',
        '这是「冷却速度」，加快散热速度！每级+20%冷却，最多5级。熄火后更快恢复开火！',
        '这是「防线生命」，增加防线血量！每级+15%血量，最多5级。防线更坚挺，蟑螂更难突破！',
      ],
    },

    // ===== 暂停菜单 =====
    pause: {
      title: '游戏暂停',
      resume: '继续游戏',
      resumeDesc: '返回战斗',
      restart: '重新开始',
      restartDesc: '重新挑战本关',
      quit: '返回主菜单',
      quitDesc: '保存进度并退出',
      tagline: '烈焰除蟑 · 火线守卫',
    },

    // ===== 道具揭示 =====
    // 通关后解锁新道具的揭示界面
    itemReveal: {
      newUnlock: '战斗胜利！解锁新道具',
      zhangshuSays: '蟑叔说：',
      clickToClose: '点击任意处关闭',
    },

    // ===== 道具回收 =====
    // 关卡结束时的道具回收界面
    itemRecycle: {
      title: '道具回收',
    },

    // ===== 场景选择 =====
    sceneSelect: {
      title: '场景选择',
      unlocked: '已解锁',
      rewardMultiplier: '奖励',
      unlockCondition: '通关',
      enemyStrength: '敌人强度',
      rewardRate: '奖励倍率',
      weather: '天气',
      weatherNone: '无',
      weatherRain: '雨',
      weatherFog: '雾',
      weatherNight: '夜间',
    },

    // ===== 道具准备 =====
    // 战斗开始前的道具选择界面
    preparation: {
      title: '道具选择',
      selectHint: '选择',
      battle: '开始战斗',
      categories: {
        control: '控制',
        aoe: '范围',
        burst: '爆发',
      },
    },
  },
} as const;