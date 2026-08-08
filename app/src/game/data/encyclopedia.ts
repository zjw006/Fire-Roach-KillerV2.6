import { RoachType, type EncyclopediaEntry } from '../types';
import { ENEMY_DEFS } from './enemies';

// ========== 图鉴展示数据（仅包含文案/图片，不包含数值） ==========
/**
 * 图鉴展示元数据
 * @description 仅包含图鉴的展示/文案数据（id、图片、描述、趣味冷知识、特殊能力说明）。
 * hp、speed、name 等数值字段从 ENEMY_DEFS 自动派生，确保图鉴数值与敌人实际属性始终一致。
 * 修改 ENEMY_DEFS 中的数值后，图鉴会自动同步，无需手动更新此处。
 */
// Partial<Record> 而非 Record：允许部分 RoachType 没有图鉴条目（如 FLYING_SUICIDE 暂未单独设图鉴）
const ENCYCLOPEDIA_META: Partial<Record<RoachType, {
  id: string;
  image: string;
  description: string;
  funFact: string;
  special: string;
}>> = {
  [RoachType.SMALL]: {
    id: 'roach_small',
    image: '/assets/roach.png',
    description: '最基础的蟑螂单位，体型小速度快，喜欢成群结队出现。',
    funFact: '一只怀揣梦想的蟑螂，梦想是吃光你的外卖。它每天跑的距离相当于人类跑马拉松。',
    special: '无特殊能力，但数量众多',
  },
  [RoachType.LARGE]: {
    id: 'roach_large',
    image: '/assets/roach.png',
    description: '体型庞大的蟑螂，血量更多，更加耐打。愤怒时会加速冲刺。',
    funFact: '健身房常客，八块腹肌，但怕火。它曾试图报名参加健美比赛，因不符合"人类"标准被拒。',
    special: '愤怒加速：血量低于50%时速度提升50%',
  },
  [RoachType.FLYING]: {
    id: 'roach_flying',
    image: '/assets/roach_flying.png',
    description: '拥有翅膀的蟑螂，从空中掠过，速度极快。会俯冲攻击防线。',
    funFact: '刚拿到飞行驾照，还在实习期。它的飞行教练是一只 retired 的蜜蜂。',
    special: '飞行：不受地面陷阱影响，可俯冲攻击',
  },
  [RoachType.ARMORED]: {
    id: 'roach_armored',
    image: '/assets/roach_armored.png',
    description: '身披厚重甲壳的蟑螂，护甲可吸收50%伤害。甲壳破损后露出本体。',
    funFact: '它穿的不是盔甲，是它的外卖盒做的。环保主义先锋，甲壳回收率100%。',
    special: '护甲：吸收50%伤害，护甲值耗尽后变为普通蟑螂外观',
  },
  [RoachType.SPLITTING]: {
    id: 'roach_splitting',
    image: '/assets/roach_splitting.png',
    description: '死亡时会分裂成5只小蟑螂的恐怖存在。母体死亡瞬间爆发分裂。',
    funFact: '它的座右铭是"一个我倒下，五个我站起来"。它参加了当地的克隆技术研究小组。',
    special: '分裂：死亡后分裂为5只小蟑螂',
  },
  [RoachType.SUICIDE]: {
    id: 'roach_suicide',
    image: '/assets/roach_suicide.png',
    description: '背上绑着TNT的疯狂蟑螂，靠近防线会自爆造成范围伤害。死亡后也会爆炸。',
    funFact: '它背上的TNT是从蟑螂黑市买来的，花了它三个月的外卖钱。它是蟑螂界的极端主义者。',
    special: '自爆：靠近防线时爆炸，对范围内蟑螂和防线造成伤害',
  },
  [RoachType.QUEEN]: {
    id: 'roach_queen',
    image: '/assets/roach_queen.png',
    description: 'BOSS级敌人，庞大的身躯和恐怖的繁殖能力。会不断召唤小蟑螂加入战斗。',
    funFact: '三年洗洁精，一朝变女王。不要问，问就是喝了假酒。她的皇冠是用易拉罐做的。',
    special: '召唤：每8秒召唤3只小蟑螂；火焰抗性50%',
  },
  // ===== 医院场景专属蟑螂 =====
  [RoachType.NURSE]: {
    id: 'roach_nurse',
    image: '/assets/roach_nurse.png',
    description: '携带医疗包的蟑螂，定期为周围受伤蟑螂恢复20%HP。对杀虫剂极度敏感，接触后窒息8秒。',
    funFact: '它从医院药房偷来的医疗包，里面的"药品"其实是过期的小强营养素。它自称是"南丁格尔转世"。',
    special: '治疗：每5秒治疗3格内最低血量盟友20%HP；杀虫剂敏感：接触后窒息8秒',
  },
  [RoachType.MUTANT]: {
    id: 'roach_mutant',
    image: '/assets/roach_mutant.png',
    description: '经过辐射变异的蟑螂，死亡时释放强腐蚀性酸液，屏幕闪烁绿色干扰视野3秒。',
    funFact: '它曾经是一只普通蟑螂，直到有一天它爬进了医院的X光机。现在它的体液是绿色的，据说味道像青苹果……没人敢验证。',
    special: '酸液爆发：死亡时对周围造成酸液伤害+绿色屏幕干扰2秒',
  },
  [RoachType.TIMED_SUICIDE]: {
    id: 'roach_timed_suicide',
    image: '/assets/roach_timed_suicide.png',
    description: '高生存能力的蟑螂，到达防线前64px放置炸弹后变身大蟑螂。炸弹3秒后爆炸，造成大范围伤害。',
    funFact: '它背上的炸弹是从医院手术室偷来的定时器改造的。放置炸弹后它会莫名其妙地变成大蟑螂——大概是辐射后遗症。',
    special: '放置炸弹：到达防线前64px放置炸弹，3秒后爆炸（范围196px）；变身：放置后变成大蟑螂',
  },
  // ===== 地铁场景专属蟑螂 =====
  [RoachType.TUNNEL_WORKER]: {
    id: 'roach_tunnel_worker',
    image: '/assets/roach_tunnel_worker.png',
    description: '背着工具箱的地铁蟑螂，会为同伴喷涂护甲，是优先击杀的辅助单位。',
    funFact: '它在地铁干了三十年维修工，退休金被蟑螂女王克扣了一半。它的工具箱里除了扳手，还有半块发霉的披萨。',
    special: '护甲喷涂：每6秒为周围血量最高的蟑螂添加护甲150',
  },
  [RoachType.SUBWAY_ELITE]: {
    id: 'roach_subway_elite',
    image: '/assets/roach_subway_elite.png',
    description: '沿铁轨高速冲刺的精英蟑螂，冲刺时无视蟑螂贴板。被列车碾压后会分裂为2只普通小蟑螂。',
    funFact: '它是地铁蟑螂界的短跑冠军，梦想是参加奥运会。可惜每次冲刺的终点不是火墙就是列车。',
    special: '轨道冲刺：出场2秒后沿铁轨高速冲刺；被列车碾压后分裂为2只小蟑螂；斩螂·110拦截不触发分裂',
  },
};

// ========== 图鉴数据（从 ENEMY_DEFS 自动派生 hp/speed/name） ==========
/**
 * 图鉴定义
 * @description 从 ENEMY_DEFS 自动派生 hp、speed、name 等数值字段，
 * 合并 ENCYCLOPEDIA_META 中的展示/文案数据。
 * 修改 ENEMY_DEFS 后，图鉴数值会自动同步，无需手动更新。
 * - killCount: 击杀计数，用于图鉴中显示击杀数
 * - unlocked: 是否已解锁（默认 true，所有蟑螂类型初始可见）
 */
export const ENCYCLOPEDIA_DEFS: EncyclopediaEntry[] = (
  Object.entries(ENEMY_DEFS) as [RoachType, typeof ENEMY_DEFS[RoachType]][]
)
  // 仅生成有图鉴展示数据的条目（跳过 FLYING_SUICIDE 等暂未设图鉴的类型）
  .filter(([type]) => ENCYCLOPEDIA_META[type] !== undefined)
  .map(([type, def]) => {
    const meta = ENCYCLOPEDIA_META[type]!; // filter 已保证非 undefined
    return {
      id: meta.id,
      name: def.name,
      type,
      image: meta.image,
      description: meta.description,
      funFact: meta.funFact,
      hp: def.hp,          // 从 ENEMY_DEFS 自动派生
      speed: def.speed,    // 从 ENEMY_DEFS 自动派生
      special: meta.special,
      killCount: 0,
      unlocked: true,
    };
  });