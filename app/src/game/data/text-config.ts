// ========== 文案配置 ==========
export const TEXT_CONFIG = {
  // ===== 战斗特效文字 =====
  combat: {
    // 防线/碰撞
    defenseBreach: '防线突破!',
    shieldBlock: '护盾抵消!',
    armorBreak: '破甲!',
    armorShatter: '护甲碎裂!',
    armorImmune: '护甲免疫',

    // 投掷物落地
    stickyLand: '冰冻!',
    poisonLand: '毒雾!',
    molotovLand: '燃烧!',

    // 蟑螂贴板
    stickyLaunch: '蟑螂贴板发射!',
    stickyTracking: '10个追踪水滴',
    stickyCapture: '粘住12秒!',
    stickyBoard: '贴板!',
    stickyStuck: '粘住!',

    // 雷达激光
    radarActivate: '雷达激光启动! 自动追踪目标',
    radarDesc: '5发激光，伤害与小蟑螂一致',
    radarCountdown: (s: number) => `雷达激光 ${s}秒...`,
    radarClosing: '雷达激光即将关闭!',
    radarClosed: '雷达激光关闭',
    radarShot: (n: number) => `激光 x${n}`,
    radarExhausted: '激光发射完毕!',
    radarKill: '激光击杀!',

    // 电蚊拍
    swatterReady: '⚡ 电蚊拍就绪!',
    swatterHit: (hit: number, armor: number) => `⚡电蚊拍全屏!命中${hit}只!破甲${armor}!`,
    swatterHitParalyze: (hit: number) => `⚡电蚊拍全屏!命中${hit}只!麻痹!`,
    swatterMiss: '⚡电蚊拍!未命中',
    swatterNoItem: '没有电蚊拍!',
    swatterCooldown: (s: string) => `电蚊拍冷却中... (${s}s)`,
    globalCooldown: (s: string) => `道具冷却中... (${s}s)`,
    swatterPickup: '获得电蚊拍!',

    // 强力风扇
    fanActivate: '强力风扇启动!',
    fanDesc: '蟑螂被吹退8秒!',
    fanRefresh: '风扇已续期!',
    fanDurationWithTalent: (baseDuration: number, mult: number) => `蟑螂被吹退${(baseDuration * mult).toFixed(1)}秒!(+天赋)`,
    fanStop: '风扇停止',

    // 毒气喷射
    insecticideActivate: '双侧毒气喷射!',
    insecticideDesc: '两侧横向毒雾3秒',
    insecticideClosing: '毒气喷射即将结束!',
    insecticideEnd: '毒气喷射结束',
    insecticideHit: (n: number) => `毒气命中${n}只!`,

    // 蟑螂AI
    queenSummon: '女王召唤了小蟑螂!',
    bombPlaced: '炸弹已安放!',
    transformBig: '变身大蟑螂!',
    nurseCasting: '【施法中】',
    nurseIllegal: '非法行医!',
    bombFailed: '炸弹没响...',
    corpseBomb: (s: number) => `尸体炸弹 ${s}秒!`,
    bossDefeated: 'BOSS 击败!',
    killReward: (reward: number) => `+¥${reward}`,

    // Boss
    bossAppear: '螂老大出现了!',
    bossSpawnEggs: '它正在产卵!消灭虫卵!',
    bossDefeatedText: '螂老大被消灭了!',
    victory: '胜利!',
    bossSummon: '召唤虫卵!',
    bossDialogue1: '螂老大: "不...不可能!"',
    bossDialogue2: '螂老大: "我的虫卵大军...全灭了..."',

    // 波次
    waveCleared: '支援单位已清除，推进下一波!',
    waveClearedN: (wave: number) => `第${wave}波清除!`,
    gameVictory: '游戏胜利',
    countdown: '倒计时3-2-1...',

    // 消耗品
    gasRefill: '燃气已回满!',
    powerBoost: (s: number) => `>>> 火力全开 ${s}秒 <<<`,
    shieldActive: (s: number) => `>>> 防线护盾 ${s}秒 <<<`,

    // 渲染器
    transformCountdown: (s: number) => `变身! ${s}s`,
    spawnCount: (n: number) => `生成${n}只!`,
    roachQueen: '蟑螂女王',
    defenseLine: '防 线',
    groundBounds: '蟑螂地面边界(6点折线)',

    // 蟑螂AI - 更多
    nurseSpray: '治疗喷射!',
    bigExplosion: (n: number) => `大爆炸!(${n}只受波及)`,
    deathExplosion: (n: number) => `死亡爆炸!(${n}只受波及)`,
    boom: '轰!',
    splitSpawn: '分裂x5!',
    disintegrate: '解体!',
    explode: (n: number) => `爆炸!(${n}只受波及)`,
    embryoBurst: '【胚胎暴走】',
    acidSplash: '酸液飞溅!',
    acidCorrode: (n: number) => `${n}只受腐蚀`,
    suicideDamage: (dmg: number) => `自爆伤害! -${dmg}`,
    bombExplode: (dmg: number) => `炸弹爆炸! -${dmg}`,
    backlash: (dmg: number) => `反噬 -${dmg}`,
    spawnBirth: (name: string) => `【诞生】${name}!`,

    // 消耗品 - 更多
    baitPlaced: '>>> 蟑螂诱饵已投放 <<<',
    baitEnd: '诱饵效果 消失',
    powerBoostEnd: '火力全开 结束',
    shieldEnd: '防线护盾 消失',

    // 天气
    lightning: '⚡ 闪电 ⚡',

    // 三喷火枪
    tripleFlameActivate: '三喷火枪模式! 持续15秒',
    tripleFlameRefresh: '三喷火枪已刷新! 持续15秒',
    tripleFlameWarning: '⚠ 三喷火枪即将消失! 5秒 ⚠',
    tripleFlameEnd: '三喷火枪模式结束',

    // 风扇
    fanBlowing: '吹退中',

    // Boss - 更多
    bossDialogue3: '螂老大: "这次算你赢了!我会回来的!"',
    bossFlee: '螂老大飞走了...',
    bossPhase1: '第一波:虫卵',
    bossAppearTitle: '【螂老大来袭】',
    bossDefendLine: '消灭虫卵和蟑螂!保卫防线!',
    bossDialogueShort: '不...不可能!我的虫卵大军...',
    bossSummoning: 'BOSS正在召唤虫卵...',
    preparing: '准备中',
    bossFleeing: 'BOSS逃跑中',

    // 投掷物 - 更多
    poisonHit: (n: number) => `毒雾!(${n}只)`,

    // 放置
    placeItem: (name: string) => `点击放置 ${name}`,

    // 波次/虫卵
    waveEggRelease: (wave: number) => `第${wave}波虫卵释放!`,
    eggHatchPending: (count: number) => `${count}个虫卵即将孵化`,

    // 结算
    itemRecycle: (amount: number) => `道具回收 +¥${amount}`,
    talentReward: (points: number) => `+${points} 天赋点!`,
    starRating: ['', '通关!', '优秀!', '完美!'],
    breachCount: (count: number) => `防线突破: ${count}次`,
    defeat: '防线被攻破! 战斗失败!',

    // 无尽模式
    newRecord: '你创造了新纪录!',
    bestTimeRefreshed: '历史最高时长已刷新!',

    // 武器/道具拾取
    weaponPickup: (name: string, bonus: string) => `拾取: ${name}!${bonus}`,
    weaponSwitch: (name: string) => `切换到: ${name}`,
    weaponExpired: '武器已过期',
    barrelCooldown: '⚠️ 枪管冷却中!',
    openFire: '>>> 开 火 <<<',
    itemCooldown: (s: string) => `道具冷却中... (${s}s)`,
    namedCooldown: (name: string, s: string) => `${name}冷却中... (${s}s)`,

    // 火焰墙
    fireWall: (count: number) => `火焰墙!(${count}只)`,
    fireWallSimple: '火焰墙!',

    // 尸体炸弹
    corpseBombExplode: '尸体炸弹爆炸!',
    corpseBombDamage: (dmg: number) => `尸体炸弹! -${dmg}`,

    // 定时自爆
    timedSuicideNext: '定时自爆蟑螂出现! 下一只8秒后',
    timedSuicideAll: '定时自爆蟑螂全部出现!',
    bombWarning: '!!',

    // 场景解锁
    sceneUnlock: (name: string) => `解锁新场景: ${name}!`,

    // 投掷武器
    throwWeapon: (name: string) => `投掷${name}!`,

    // 雷达激光伤害
    radarDamage: (dmg: number) => `-${dmg}`,

    // 消耗品 - 冷却相关
    combatStartCooldown: (s: string) => `冷却中... (${s}s)`,
    consumableGlobalCooldown: (s: string) => `全局冷却中... (${s}s)`,
    defenseRepair: (heal: number) => `防线修复 +${heal}`,
    emergencyCoolAdd: (n: number) => `紧急冷却 +1 (共${n}次)`,
    emergencyCoolUse: (n: number) => `紧急冷却! (剩余${n}次)`,
    powerBoostCountdown: (s: number) => `火力全开 ${s}秒`,

    // Boss - 更多
    bossWaveNames: ['', '虫卵入侵', '大蟑螂卵', '飞行蟑螂卵', '精英蟑螂卵'] as readonly string[],
    bossWaveTitle: (wave: number, name: string) => `【第${wave}波: ${name}】`,
    bossPhaseTitle: (phaseName: string) => `螂老大 - ${phaseName}`,
    bossWaveProgress: (wave: number) => `第${wave}/4波`,
    bossTimeRemaining: (secs: number) => `剩余时间: ${secs}秒`,

    // 成就
    achievementUnlock: (name: string, reward: number) => `成就: ${name} +¥${reward}`,

    // 定时器显示
    fanTimer: (timer: string) => `风扇 ${timer}s`,
    insecticideTimer: (timer: string) => `杀虫剂 ${timer}s`,
  },

  // ===== 道具名称 =====
  items: {
    sticky: '蟑螂贴板',
    poison: '杀虫剂',
    insecticide: '杀虫喷雾',
    molotov: '燃烧瓶',
    shotgun: '散弹模式',
    radar: '雷达激光',
    fan: '强力风扇',
    swatter: '电蚊拍',
  },

  // ===== 武器名称 =====
  weapons: {
    flamethrower: '火焰',
    shotgun: '散弹',
  },

  // ===== UI 组件文字 =====
  ui: {
    // 标题屏幕
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

    // 主菜单
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

    // HUD
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

    // 倒计时
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

    // 漫画
    comic: {
      skip: '跳过',
      syncing: '同步数据中...',
      startBattle: '开始战斗',
      clickToSkip: '[ 点击跳过 ]',
      clickOrSwipe: '[ 点击或滑动切换 ]',
      comicPanelAlt: (n: number) => `漫画 ${n}`,
    },

    // 对话
    dialog: {
      skip: '跳过',
      clickToSkip: '点击跳过打字',
      starting: '即将开始...',
      clickToContinue: '点击继续',
    },

    // 商店
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

    // 游戏结束
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
      breaches: '防线突破',
      talentUnlocked: '获得天赋点！',
      talentDesc: '地下室通关奖励，可用于强化角色能力',
      goAddPoints: '去加点',
      nextLevel: (name: string) => `下一关：${name}`,
      playAgain: '再来一局',
      backToMenu: '返回主菜单',
      storyMode: '剧情模式',
      endlessMode: '无尽模式',
    },

    // 通用
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
    itemReveal: {
      newUnlock: '战斗胜利！解锁新道具',
      zhangshuSays: '蟑叔说：',
      clickToClose: '点击任意处关闭',
    },

    // ===== 道具回收 =====
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