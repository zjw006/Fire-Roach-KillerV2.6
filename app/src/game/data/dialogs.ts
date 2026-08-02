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
];