import { SceneType, RoachType } from '../types';

/**
 * @fileoverview 场景规则配置
 * @description 定义场景解锁顺序、每关可用的道具和蟑螂类型、地面边界、以及战后奖励。
 * 这些规则控制游戏的渐进式解锁机制——玩家在每个新场景会遇到新敌人和新道具。
 */

// 场景索引顺序（用于 UI 显示和排序）
export const SCENE_ORDER: SceneType[] = ['kitchen', 'sewer', 'dump', 'basement', 'street', 'rooftop', 'hospital', 'subway', 'supermarket', 'school', 'nest'];

// 每关解锁道具顺序（由弱到强）：粘板 → 风扇 → 燃烧瓶 → 散弹 → 雷达
/**
 * 场景道具解锁表
 * @description 定义每个场景可掉落的武器道具类型。
 * 道具按从弱到强的顺序逐步解锁，保证游戏难度曲线平滑。
 * 医院场景额外包含专属蟑螂类型的道具掉落。
 */
export const SCENE_ITEM_UNLOCKS: Record<SceneType, string[]> = {
  // Kitchen: sticky board only (tutorial scene, fewer drops)
  [SceneType.KITCHEN]: ['sticky'],
  // Sewer: fan is the new item
  [SceneType.SEWER]: ['sticky', 'fan'],
  // Dump: molotov is the new item
  [SceneType.DUMP]: ['sticky', 'fan', 'molotov'],
  // Basement: swatter unlocked from dump reward, available here
  [SceneType.BASEMENT]: ['sticky', 'fan', 'molotov', 'swatter'],
  // Rooftop: swatter available
  [SceneType.ROOFTOP]: ['sticky', 'poison', 'fan', 'molotov', 'swatter'],
  // Street: all items including swatter
  [SceneType.STREET]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // Hospital: all items + hospital exclusive roaches
  [SceneType.HOSPITAL]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter', 'nurse', 'mutant', 'timed_suicide'],
  // Subway: all items + 专属列车召唤器
  [SceneType.SUBWAY]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter', 'train'],
  // Supermarket: all items
  [SceneType.SUPERMARKET]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // School: all items
  [SceneType.SCHOOL]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // Nest: all items (final challenge)
  [SceneType.NEST]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
};

/**
 * 场景可用蟑螂类型表
 * @description 定义每个场景中可以出现的蟑螂类型。
 * 蟑螂类型按场景逐步解锁：厨房只有小、大、飞行蟑螂 → 下水道加入装甲 → 垃圾场加入自爆 → 地下室加入分裂和飞行自爆 → 医院加入护士、变异、定时自爆、女王
 */
export const SCENE_ROACH_TYPES: Record<SceneType, RoachType[]> = {
  [SceneType.KITCHEN]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING],
  [SceneType.SEWER]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED],
  [SceneType.DUMP]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SUICIDE],
  [SceneType.BASEMENT]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE],
  [SceneType.ROOFTOP]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE],
  [SceneType.STREET]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE],
  [SceneType.HOSPITAL]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN, RoachType.NURSE, RoachType.MUTANT, RoachType.TIMED_SUICIDE],
  [SceneType.SUBWAY]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN],
  [SceneType.SUPERMARKET]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN],
  [SceneType.SCHOOL]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN],
  [SceneType.NEST]: [RoachType.SMALL, RoachType.LARGE, RoachType.FLYING, RoachType.ARMORED, RoachType.SPLITTING, RoachType.SUICIDE, RoachType.FLYING_SUICIDE, RoachType.QUEEN],
};

/**
 * 场景解锁链
 * @description 定义关卡解锁顺序。通关当前场景后自动解锁下一关。
 * 解锁链：厨房 → 下水道 → 垃圾场 → 地下室 → 街道 → 天台 → 医院 → 地铁 → 超市 → 学校 → 巢穴
 */
export const SCENE_UNLOCK_CHAIN: SceneType[] = [
  SceneType.KITCHEN,
  SceneType.SEWER,
  SceneType.DUMP,
  SceneType.BASEMENT,
  SceneType.STREET,
  SceneType.ROOFTOP,
  SceneType.HOSPITAL,
  SceneType.SUBWAY,
  SceneType.SUPERMARKET,
  SceneType.SCHOOL,
  SceneType.NEST,
];

// ===== 地面边界：地面蟑螂的 6 点透视可行走区域 =====
// Each scene's ground boundary is defined by 6 points (3 per side),
// forming a 2-segment polyline on each side to match irregular obstacles.
// Format: [farL,farLY, farR,farRY, midL,midLY, midR,midRY, nearL,nearR,nearY]
//   farL/farR = farthest pair (top, distance)
//   midL/midR = middle pair (NEW! inserted between far and near)
//   nearL/nearR = nearest pair (bottom, close to camera)
//   nearY = bottom horizontal line Y
// Each side forms a 2-segment broken line: far→mid→near
/**
 * 场景地面边界配置
 * @description 定义每个场景中地面蟑螂可移动的 6 点透视区域。
 * 格式：[farL, farLY, farR, farRY, midL, midLY, midR, midRY, nearL, nearR, nearY]
 * - farL/farLY: 左侧远点坐标（远离相机，屏幕上方）
 * - farR/farRY: 右侧远点坐标
 * - midL/midLY: 左侧中点坐标
 * - midR/midRY: 右侧中点坐标
 * - nearL: 左侧近点 X 坐标（靠近相机，屏幕下方）
 * - nearR: 右侧近点 X 坐标
 * - nearY: 近点 Y 坐标（两侧共用）
 * 每侧形成 2 段折线：far→mid→near，产生透视效果。
 */
export const SCENE_GROUND_BOUNDS: Record<SceneType, [number, number, number, number, number, number, number, number, number, number, number]> = {
  // Kitchen: straight line (mid = far→near midpoint)
  [SceneType.KITCHEN]: [200,450, 400,450,  100,625, 465,625,  0,530,800],
  // Sewer: custom corridor with distant far points
  [SceneType.SEWER]:   [310,388, 471,384,  50,435, 470,454,  50,470, 810],
  // Dump: custom garbage corridor perspective
  [SceneType.DUMP]:    [98,392, 342,442,  141,669, 446,612,  140,461, 810],
  // Basement: straight line (mid = far→near midpoint)
  [SceneType.BASEMENT]:[200,450, 350,450,  100,625, 450,625,  0,530,800],
  // Rooftop: straight line (mid = far→near midpoint)
  [SceneType.ROOFTOP]: [150,400, 380,400,   75,600, 455,600,  0,530,800],
  // Street: straight line (mid = far→near midpoint)
  [SceneType.STREET]:  [250,450, 300,450,  125,625, 425,625,  0,530,800],
  // Hospital: narrow corridor (窄走廊，增强沉浸感)
  [SceneType.HOSPITAL]: [232,416, 333,449, 141,512, 401,486, 50,490,810],
  // Subway: wide platform (宽平台)
  [SceneType.SUBWAY]:   [220,440, 340,440,  100,620, 460,620,  0,530,800],
  // Supermarket: aisles (货架通道)
  [SceneType.SUPERMARKET]: [200,430, 380,430,  90,610, 450,610,  0,530,800],
  // School: classroom (教室)
  [SceneType.SCHOOL]:   [210,435, 370,435,  95,615, 455,615,  0,530,800],
  // Nest: organic tunnel (有机隧道)
  [SceneType.NEST]:     [170,410, 370,410,  70,590, 470,590,  0,530,800],
};

// ========== 战后道具奖励揭示 ==========
// 每关通关后奖励下一关的新道具，附带蟑叔的搞笑说明
/**
 * 场景战后道具奖励
 * @description 定义每关通关后揭示的新道具，包含蟑叔的搞笑介绍。
 * 奖励道具在下一关可用，奖励揭示在通关结算界面展示。
 */
export const SCENE_REWARD_ITEMS: Record<SceneType, { type: string; name: string; icon: string; desc: string }[]> = {
  [SceneType.KITCHEN]: [
    { type: 'fan', name: '强力风扇', icon: '/assets/drop_fan.png', desc: '嘿嘿嘿，听说过"风神降临"吗？按下开关，全场蟑螂秒变慢动作回放！扇叶一转，小强的腿都跑软了，你就站那儿看着它们爬，跟看纪录片似的。关键是——这风扇不用你扛着，自动全场覆盖！蟑叔我亲自改装的，风速三档可调，第三档能把蟑螂吹成背头造型！' },
  ],
  [SceneType.SEWER]: [
    { type: 'molotov', name: '燃烧瓶', icon: '/assets/drop_molotov.png', desc: '这可是我从隔壁烧烤摊"借"来的秘方！瓶子里装的不是酒，是梦想——烧死蟑螂的梦想！往地上一摔，"轰"的一下火墙立起来，蟑螂们排着队往火里冲，拦都拦不住！温馨提示：千万别在封闭空间用，上次我在厕所试了一下，眉毛少了一半……' },
  ],
  [SceneType.DUMP]: [
    { type: 'swatter', name: '电蚊拍', icon: '/assets/drop_swatter.png', desc: '终——极——武——器！！！全屏放电，一扫而空！"噼里啪啦"一阵电闪雷鸣，满屏蟑螂瞬间灰飞烟灭，连渣都不剩！这玩意儿拿在手里，你就是雷神托尔，就是宙斯下凡，就是蟑螂们的末日审判！蟑叔我纵横除蟑界三十年，就这电蚊拍能让我激动得睡不着。用吧，少年，以雷霆击碎黑暗！！！' },
  ],
  [SceneType.BASEMENT]: [
    { type: 'poison', name: '杀虫喷雾', icon: '/assets/drop_poison.png', desc: '新型改良版杀虫剂，双侧喷射系统加上3秒持续性中毒效果！喷一下，蟑螂们先晕，再吐，最后倒，整个过程比看电视剧还精彩。蟑叔我加了点特殊配方，这味道对人类无害但对蟑螂来说……嘿嘿，就像闻到前任的香水一样致命！' },
  ],
  // Rooftop: no new reward (swatter moved to dump)
  [SceneType.ROOFTOP]: [],
  [SceneType.STREET]: [
    { type: 'shotgun', name: '散弹模式', icon: '/assets/drop_shotgun.png', desc: '三！管！齐！发！这已经不是喷火枪了，这是喷火机关枪！扇面扫射，覆盖面大到连飞过的小鸟都得绕道走。一只蟑螂？三发全中。一群蟑螂？三发全中。满屏蟑螂？还是三发全中！唯一的缺点嘛……气罐消耗快得跟我的头发一样。多囤气罐，听蟑叔的准没错！' },
    { type: 'radar', name: '雷达激光', icon: '/assets/drop_radar.png', desc: '来来来，见识一下什么叫"科技改变灭蟑"！这玩意儿自带追踪雷达，哪只蟑螂离得最近，激光"咻"的一下就锁过去了！biu~biu~biu~跟打靶似的，指哪打哪，百发百中！在这条赛博街道上，雷达激光就是你的终极利器！蟑叔我当年要是早点发明这个，也不至于被蟑螂追了三条街……' },
  ],
  // Hospital reward: advanced medical supplies for cockroach eradication
  [SceneType.HOSPITAL]: [
    { type: 'gas_refill', name: '医疗气罐', icon: '/assets/consumable_gas.png', desc: '从医院氧气瓶改装的超级气罐！容量是普通气罐的两倍，持续时间超长。蟑叔我亲自从ICU"借"来的，护士追了我三层楼……但值得！有了这玩意儿，你可以放心大胆地喷火，不用担心气不够用！' },
  ],
  // Subway reward: train summon beacon
  [SceneType.SUBWAY]: [
    { type: 'train', name: '列车召唤器', icon: '/assets/drop_train.png', desc: '地铁调度室的紧急呼叫按钮！按下去，一列满载的幽灵列车就会从隧道里呼啸而出，把轨道上的一切蟑螂碾成饼！蟑叔我当年在地铁公司上班，偷……呃不，"借用"了一个调度终端。记住，列车不长眼，放的时候离轨道远点！' },
  ],
  // Supermarket reward: shelf domino
  [SceneType.SUPERMARKET]: [
    { type: 'molotov', name: '货架燃烧弹', icon: '/assets/drop_molotov.png', desc: '超市货架倒塌+燃烧瓶=完美火海！推倒一整排货架，火焰沿着货架蔓延，整个超市变成烤箱！蟑螂们连逃跑的路线都被堵死了。蟑叔温馨提示：使用后请记得买保险……' },
  ],
  // School reward: chalk dust bomb
  [SceneType.SCHOOL]: [
    { type: 'poison', name: '粉笔灰毒气', icon: '/assets/drop_poison.png', desc: '三十年陈年老粉笔灰+杀虫剂=生化武器！扬起来整个教室都是毒雾，蟑螂们吸入后直接开始跳舞……然后倒下。对人类无害（大概），对蟑螂致命！校长的粉笔灰终于派上用场了！' },
  ],
  // Nest: final reward - crown of the cockroach king
  [SceneType.NEST]: [
    { type: 'radar', name: '女王之冠', icon: '/assets/drop_radar.png', desc: '你做到了！你击败了蟑螂女王，夺走了她的王冠！这顶 Crown 现在属于你的了——戴上它，你就是蟑螂界的终结者，是所有小强的噩梦！蟑叔我为你骄傲，热泪盈眶！从今以后，这片土地上再也不会有蟑螂敢抬头！' },
  ],
};