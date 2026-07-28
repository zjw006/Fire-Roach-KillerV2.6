import { SceneType, RoachType } from '../types';

export const SCENE_ORDER: SceneType[] = ['kitchen', 'sewer', 'dump', 'basement', 'street', 'rooftop', 'hospital', 'subway', 'supermarket', 'school', 'nest'];

// 每关解锁道具顺序（由弱到强）：粘板 → 风扇 → 燃烧瓶 → 散弹 → 雷达
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
  // Subway: all items
  [SceneType.SUBWAY]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // Supermarket: all items
  [SceneType.SUPERMARKET]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // School: all items
  [SceneType.SCHOOL]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
  // Nest: all items (final challenge)
  [SceneType.NEST]: ['sticky', 'poison', 'fan', 'molotov', 'shotgun', 'radar', 'swatter'],
};

// 每关可用蟑螂类型
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

// 场景解锁链：通关当前场景后解锁下一关
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
  // Hospital: narrow corridor
  [SceneType.HOSPITAL]: [232,416, 333,449, 141,512, 401,486, 50,490,810],
  // Subway: wide platform
  [SceneType.SUBWAY]:   [220,440, 340,440,  100,620, 460,620,  0,530,800],
  // Supermarket: aisles
  [SceneType.SUPERMARKET]: [200,430, 380,430,  90,610, 450,610,  0,530,800],
  // School: classroom
  [SceneType.SCHOOL]:   [210,435, 370,435,  95,615, 455,615,  0,530,800],
  // Nest: organic tunnel
  [SceneType.NEST]:     [170,410, 370,410,  70,590, 470,590,  0,530,800],
};

// ========== 战后道具奖励揭示 ==========
// 每关通关后奖励下一关的新道具，附带蟑叔的搞笑说明
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
  // Subway reward: track electrifier
  [SceneType.SUBWAY]: [
    { type: 'swatter', name: '轨道电击器', icon: '/assets/drop_swatter.png', desc: '地铁第三轨的电流改装版！一炮下去整条轨道带电，蟑螂们踩着铁轨冲过来，结果全部变成烤蟑螂！范围超大，持续时间超长，就是有点费铁轨……别告诉地铁公司是我干的！' },
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