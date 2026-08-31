import { SceneType, type DialogConfig } from '../types';

/**
 * 场景对话配置
 * @description 定义每个场景关卡开始前的剧情对话。
 * 对话以搞笑风格呈现，讲述蟑叔和玩家一起消灭蟑螂的故事。
 * 每个场景引入新蟑螂类型和新道具。
 * 对话线中包含 speaker（说话者）、text（对话内容）、emotion（表情）字段。
 */
export const DIALOG_CONFIGS: DialogConfig[] = [
  // Scene 1: Kitchen - 教程关卡，介绍火焰喷射器
  {
    sceneType: SceneType.KITCHEN,
    title: '第一关：厨房',
    bgImage: '/assets/bg.jpg',
    lines: [
      { speaker: '蟑叔', text: '欢迎参加"厨房除虫嘉年华"！蟑螂密度五倍，按只提成！', emotion: 'happy' },
      { speaker: '你', text: '油烟机上的油比蟑螂厚。' },
      { speaker: '蟑叔', text: '油是小事！给你【火焰喷射器】，一喷变烧烤！……客户没买保险，所以快打！', emotion: 'excited' },
    ],
  },
  // Scene 2: Sewer - 下水道，介绍粘板陷阱
  {
    sceneType: SceneType.SEWER,
    title: '第二关：下水道',
    bgImage: '/assets/sewer_bg.jpg',
    lines: [
      { speaker: '蟑叔', text: '这地方像我二舅诊所，就是没这么多腿毛。下雨天蟑螂冲浪，速度贼快！', emotion: 'normal' },
      { speaker: '你', text: '你在发抖。' },
      { speaker: '蟑叔', text: '冷！给你【贴板陷阱】，铺水流必经之地，冲浪板变停尸板！', emotion: 'excited' },
      { speaker: '螂老大（管道回声）', text: '张螂……本皇听见你了……' }, // Boss 首次出现
      { speaker: '蟑叔', text: '别理，下水道广播坏了，继续铺！', emotion: 'normal' },
    ],
  },
  // Scene 3: Dump - 垃圾场，介绍燃烧瓶
  {
    sceneType: SceneType.DUMP,
    title: '第三关：垃圾场',
    bgImage: '/assets/bg_dump.jpg',
    lines: [
      { speaker: '蟑叔', text: '欢迎来到蟑螂"山姆会员店"！能见度两米，建议牵着我衣角……哎我衣角呢？', emotion: 'happy' },
      { speaker: '你', text: '你在我前面三米。' },
      { speaker: '蟑叔', text: '哦。给你【燃烧瓶】，扔出去就是火墙！对了，别往红色冰箱后走，上一个临时工……', emotion: 'normal' },
      { speaker: '你', text: '失踪了？' },
      { speaker: '蟑叔', text: '不，他在里面找到了过期可乐，现在还在厕所。', emotion: 'happy' },
    ],
  },
  // Scene 4: Basement - 地下室，介绍夜视仪
  {
    sceneType: SceneType.BASEMENT,
    title: '第四关：地下室',
    bgImage: '/assets/bg_basement.jpg',
    lines: [
      { speaker: '蟑叔', text: '轰隆！刺激吧？闪电亮时记位置，黑下去时放陷阱！', emotion: 'excited' },
      { speaker: '你', text: '每次闪电我都以为你要现原形。' },
      { speaker: '蟑叔', text: '现原形的是它们！给你【夜视仪】，戴上后蟑螂像圣诞树！', emotion: 'happy' },
      { speaker: '螂老大（闪电中现身）', text: '张螂……你烧毁了本皇在7号楼的温床……' },
      { speaker: '蟑叔', text: '7号楼？那单客户只给了80，我还嫌少。你谁啊？', emotion: 'normal' },
    ],
  },
  // Scene 5: Street - 街道，螂老大正式登场
  {
    sceneType: SceneType.STREET,
    title: '第五关：街道',
    bgImage: '/assets/bg_street.jpg',
    lines: [
      { speaker: '螂老大（街对面）', text: '张螂！本皇观察你很久了！你是人类最顽固的灭蟑者！' },
      { speaker: '蟑叔', text: '观察我？你欠我钱？', emotion: 'normal' },
      { speaker: '螂老大', text: '三个月前，你烧毁了本皇的孵化室！' },
      { speaker: '蟑叔', text: '哦，那单客户只给了80。你这帝国挺便宜的。', emotion: 'happy' },
      { speaker: '你', text: '……它好像哭了。' },
    ],
  },
  // Scene 6: Rooftop - 天台决战，Boss 战前奏
  {
    sceneType: SceneType.ROOFTOP,
    title: '第六关：天台',
    bgImage: '/assets/bg_rooftop.jpg',
    lines: [
      { speaker: '蟑叔', text: '年轻人……大场面……真正的大场面……', emotion: 'scared' },
      { speaker: '螂老大（翅膀展开）', text: '张螂！今夜终结你的暴政！' },
      { speaker: '蟑叔', text: '终结前能开发票吗？不开发票得加钱。', emotion: 'normal' },
      { speaker: '你', text: '它不会开的。' },
      { speaker: '蟑叔', text: '所以！给你【斩螂·110】！重二两，锋110点！砍骨如切黄油！', emotion: 'excited' },
      { speaker: '你', text: '为什么叫110？' },
      { speaker: '蟑叔', text: '因为遇到它，你得报警！……为了报销！冲啊！', emotion: 'excited' },
      { speaker: '螂老大', text: '又是报销！！！' },
    ],
  },
  // Scene 7: Hospital - 废弃医院，新蟑螂类型 + 虫卵孵化池
  {
    sceneType: SceneType.HOSPITAL,
    title: '第七关：废弃医院',
    bgImage: '/assets/bg_hospital.jpg',
    lines: [
      { speaker: '蟑叔', text: '等等……你闻到没有？消毒水味。' },
      { speaker: '你', text: '……所长，您管这种阴森森的废弃医院叫"消毒水味"？这分明是停尸房的味道。' },
      { speaker: '蟑叔', text: '嘿嘿，新敌人——【护士蟑螂】！背着医疗包的蟑螂，每5秒给周围3格内最低血量的蟑螂回血20%！', emotion: 'normal' },
      { speaker: '蟑叔', text: '还有【变异蟑螂】！死亡时释放强腐蚀性酸液，屏幕绿色干扰3秒！千万别在视野不好的时候贪刀！', emotion: 'serious' },
      { speaker: '蟑叔', text: '最可怕的是【定时自爆蟑螂】！背着精密定时炸弹，5秒必爆！不过好消息是——蟑螂贴板能暂停它的倒计时！', emotion: 'scared' },
      { speaker: '你', text: '定时炸弹？！蟑螂界已经发展到这种军工水平了吗？' },
      { speaker: '蟑叔', text: '小心【虫卵孵化池】！每波可能在6个固定位置生成，5秒倒计时，孵化3只变异蟑螂！', emotion: 'serious' },
      { speaker: '蟑叔', text: '摧毁虫卵有消毒奖励——连续摧毁3个，燃气全满+清除所有异常状态！', emotion: 'happy' },
      { speaker: '你', text: '……所长，您确定这不是在打游戏副本吗？' },
      { speaker: '蟑叔', text: '副本？不不不，这是你的工作！发票开"医疗废弃物处理费"，走！', emotion: 'happy' },
    ],
  },
  // Scene 8: Subway - 地铁，列车碾压 + 精英/破盾教学在战斗中第1/4波触发
  {
    sceneType: SceneType.SUBWAY,
    title: '第八关：地铁',
    bgImage: '/assets/bg_subway.jpg',
    lines: [
      { speaker: '蟑叔', text: '末班车停运三年了，但铁轨上的"乘客"可一点没少。', emotion: 'normal' },
      { speaker: '你', text: '……所长，这条线的蟑螂是不是有点太壮了？' },
      { speaker: '蟑叔', text: '地铁蟑螂！天天扒列车练出来的，个个腿粗触须硬！', emotion: 'serious' },
      { speaker: '蟑叔', text: '不过好消息——虽然末班车停运了，调度系统还没坏！铁轨上的列车会定时驶过，拦路的蟑螂统统被碾过去！', emotion: 'excited' },
      { speaker: '你', text: '免费的帮手？那我们把它们往铁轨上赶？' },
      { speaker: '蟑叔', text: '聪明！贴板、火墙，把它们安排到轨道上"安检"！', emotion: 'happy' },
      { speaker: '蟑叔', text: '但要小心——听说这站最近来了个"大家伙"，连贴板都粘不住它……来了再说，先上车！', emotion: 'scared' },
      { speaker: '你', text: '发票这单开什么？' },
      { speaker: '蟑叔', text: '"轨道交通公共卫生服务费"……记得让螂老大签字报销！', emotion: 'excited' },
    ],
  },
  // Scene 9: Supermarket - 废弃超市，蟑螂阵型协同作战 + 隧道工修盾
  {
    sceneType: SceneType.SUPERMARKET,
    title: '第九关：废弃超市',
    bgImage: '/assets/bg_supermarket.jpg',
    lines: [
      { speaker: '蟑叔', text: '快看！蟑螂们组团来抢购了！……不对，它们是排队来送死的！', emotion: 'happy' },
      { speaker: '你', text: '它们居然在列队前进。蟑螂界也开始卷军事化了？' },
      { speaker: '蟑叔', text: '这叫【阵型】！护盾蟑螂顶在前面挡火，护士蟑螂在后面奶，还有新面孔——【隧道工蟑螂】！', emotion: 'serious' },
      { speaker: '蟑叔', text: '隧道工会喷加固胶，被它罩住的蟑螂壳更硬！它还会给护盾蟑螂修盾，蓝色连线就是它在施工！', emotion: 'normal' },
      { speaker: '你', text: '那先斩了修理工不就行了？' },
      { speaker: '蟑叔', text: '聪明！记住口诀：擒贼先擒王，破阵先破锚！护盾、护士、隧道工就是阵型的锚点，锚点全灭，阵型当场解散！', emotion: 'excited' },
      { speaker: '蟑叔', text: '还有还有，有的阵列会左右摇摆，有的绕圈巡逻——别被阵型带着跑，盯着锚点烧！', emotion: 'normal' },
      { speaker: '你', text: '……所长，您管这叫抢购？这明明是攻城。' },
      { speaker: '蟑叔', text: '攻城好啊！发票开"大型商超消杀服务费"，加急翻倍！冲！', emotion: 'excited' },
    ],
  },
  // Scene 10: School - 废弃学校，体育生蟑螂跳跃袭击 + 地铁精英复现
  {
    sceneType: SceneType.SCHOOL,
    title: '第十关：废弃学校',
    bgImage: '/assets/bg_school.jpg',
    lines: [
      { speaker: '蟑叔', text: '我的天……这学校的蟑螂，居然在晨跑？！', emotion: 'scared' },
      { speaker: '你', text: '操场那一排……是穿着运动服的蟑螂？' },
      { speaker: '蟑叔', text: '那是【体育生蟑螂】！它蓄力时会亮出红色抛物线虚线——那就是它的起跳路线，快躲开落点！', emotion: 'serious' },
      { speaker: '蟑叔', text: '它腾空一跃能飞出老远，落地还有冲击波！更糟的是铁轨那批地铁精英也转学来这了，冲刺照样横冲直撞！', emotion: 'normal' },
      { speaker: '你', text: '跳来跳去的，火焰怎么烧？' },
      { speaker: '蟑叔', text: '蓄力那0.7秒它动不了！看到红虚线就往它站的位置猛喷，让它起跳前先吃个满嘴灰！', emotion: 'excited' },
      { speaker: '你', text: '以其人之道，还治其人之身。' },
      { speaker: '蟑叔', text: '对！打完这单，发票开"课外兴趣班场地消毒费"……别愣着，上课铃响了！', emotion: 'happy' },
    ],
  },
  // Scene 11: Nest - 蟑螂巢穴，蟑老大最终决战（引爆炸弹反伤 Boss）
  {
    sceneType: SceneType.NEST,
    title: '第十一关：蟑螂巢穴',
    bgImage: '/assets/bg_nest.jpg',
    lines: [
      { speaker: '蟑叔', text: '到了……就是这里。整座城市的蟑螂，都是从这个洞里爬出来的。', emotion: 'serious' },
      { speaker: '螂老大（巢穴深处）', text: '张螂……你终究还是追到本皇的老巢来了。' },
      { speaker: '蟑叔', text: '老巢？好啊，端了老窝，发票开"根除服务"，这单我要开十倍的价！', emotion: 'excited' },
      { speaker: '螂老大', text: '愚蠢！本皇的甲壳淬炼千年，防火防电防发票！你的火焰，烧不到本皇一根触须！' },
      { speaker: '你', text: '……它好像真的不怕火。' },
      { speaker: '蟑叔', text: '别慌！它怕自己的炸弹！它每过一阵就会朝我们扔炸弹——用火枪在半空引爆那些炸弹，爆炸就能崩掉它300血！', emotion: 'serious' },
      { speaker: '蟑叔', text: '注意三件事：它周身冒红光是技能预警；它扇风时小怪会加速冲锋；它召唤的净化金光会解除小怪身上的减益！', emotion: 'normal' },
      { speaker: '你', text: '也就是说，它扔十次炸弹，我引爆十次，它就完了？' },
      { speaker: '蟑叔', text: '没错！这里的蟑螂杀不完也没关系——杀死螂老大，一切就都结束了。最后一单，走！', emotion: 'excited' },
    ],
  },
];

/**
 * 地铁第1波：精英蟑螂登场教学对话（战斗中触发，暂停生成）
 * @description 首次进入地铁第1波时弹出，介绍地铁蟑螂精英的冲刺机制与应对方式。
 * 通过 localStorage 'subway_elite_tutorial_seen' 标记只显示一次。
 */
export const SUBWAY_ELITE_TUTORIAL_DIALOG: DialogConfig = {
  sceneType: SceneType.SUBWAY,
  title: '警告：精英出没',
  bgImage: '/assets/bg_subway.jpg',
  lines: [
    { speaker: '蟑叔', text: '注意！铁轨那边来了个大家伙——【地铁蟑螂精英】！', emotion: 'scared' },
    { speaker: '蟑叔', text: '它出场2秒后会沿着铁轨高速冲刺，横冲直撞，蟑螂贴板根本粘不住它！', emotion: 'serious' },
    { speaker: '你', text: '那怎么拦？' },
    { speaker: '蟑叔', text: '火墙烧它、风扇吹它，都能打断冲刺！打断之后它就是只普通蟑螂了。', emotion: 'normal' },
    { speaker: '蟑叔', text: '还有个更爽的——铁轨上的列车会定时驶过，直接把拦路的蟑螂碾过去！不过它被碾后会"啪"地分裂成两只小蟑螂，记得补刀！', emotion: 'excited' },
    { speaker: '你', text: '分裂这么麻烦，那我用【斩螂·110】直接斩了它。' },
    { speaker: '蟑叔', text: '聪明！斩击一击必杀，不触发分裂！去吧，让它知道什么叫"到站不下车"的下场！', emotion: 'happy' },
  ],
};

/**
 * 地铁第4波：斩螂·110 对阵护盾蟑螂教学（战斗中触发，暂停生成）
 * @description 首次进入地铁第4波（护盾蟑螂首登场）时弹出，教学斩螂·110 破盾机制。
 * 通过 localStorage 'subway_knife_tutorial_seen' 标记只显示一次。
 */
export const SUBWAY_KNIFE_TUTORIAL_DIALOG: DialogConfig = {
  sceneType: SceneType.SUBWAY,
  title: '斩螂·110 破盾教学',
  bgImage: '/assets/bg_subway.jpg',
  lines: [
    { speaker: '蟑叔', text: '看前面！那团淡青色的气体——是【护盾蟑螂】！它释放的气体护盾把身后的大片蟑螂都罩住了！', emotion: 'scared' },
    { speaker: '蟑叔', text: '火焰直射被护盾挡住，根本烧不到后面的蟑螂！不过，护盾挡不住物理斩击！', emotion: 'serious' },
    { speaker: '你', text: '【斩螂·110】？' },
    { speaker: '蟑叔', text: '对！斩螂·110 是近战斩击，直接绕过气体护盾，跃向目标一击必杀！', emotion: 'excited' },
    { speaker: '蟑叔', text: '优先斩杀护盾蟑螂——它是阵型核心，后面的隧道工会跟着它帮忙修盾。斩了它，盾墙就散了！', emotion: 'normal' },
    { speaker: '你', text: '斩首行动，懂了。' },
    { speaker: '蟑叔', text: '注意：其他伤害也会消耗护盾，但火焰被挡得最狠。用斩螂·110 直接秒掉护盾蟑螂，才是最快破阵的办法！上！', emotion: 'happy' },
  ],
};