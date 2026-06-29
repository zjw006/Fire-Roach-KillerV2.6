/**
 * @fileoverview 漫画过场数据模块
 * @description 定义游戏各场景首次进入前的漫画章节、面板与对话内容，并提供 localStorage 阅读标记管理。
 */

import type { SceneType } from './types';

/** 单张漫画面板数据 */
export interface ComicPanel {
  /** 漫画图片路径 */
  image: string;
  /** 对话文本 */
  dialog: string;
  /** 说话者名称 */
  speaker: string;
}

/** 漫画章节数据 */
export interface ComicChapter {
  /** 关联场景类型 */
  scene: SceneType;
  /** 章节标题 */
  title: string;
  /** 面板列表 */
  panels: ComicPanel[];
}

/** 全游戏漫画章节静态数据 */
export const COMIC_DATA: ComicChapter[] = [
  // 序章 - 开场故事
  {
    scene: 'kitchen' as SceneType,
    title: '序章：新工作的第一天',
    panels: [
      {
        image: '/comics/prologue/01.jpg',
        dialog: '今天，是新工作的第一天。',
        speaker: '旁白',
      },
      {
        image: '/comics/prologue/02.jpg',
        dialog: '年轻人，欢迎来到烈焰除蟑事务所。我可是这一带最有名的蟑螂猎手——蟑叔。',
        speaker: '蟑叔',
      },
      {
        image: '/comics/prologue/03.jpg',
        dialog: '就是这里了，我们的事务所。别看地方小，工具可是一应俱全。',
        speaker: '蟑叔',
      },
      {
        image: '/comics/prologue/04.jpg',
        dialog: '准备好了吗？让我们去见识一下真正的蟑螂巢穴吧。',
        speaker: '蟑叔',
      },
    ],
  },
  // 第一关：恐怖厨房
  {
    scene: 'kitchen' as SceneType,
    title: '第一关：恐怖厨房',
    panels: [
      {
        image: '/comics/kitchen/01.jpg',
        dialog: '水槽里的碗碟堆成山，蟑螂从各个角落涌了出来……',
        speaker: '旁白',
      },
      {
        image: '/comics/kitchen/02.jpg',
        dialog: '火焰喷射器正好派上用场！把它们统统烧掉！',
        speaker: '蟑叔',
      },
      {
        image: '/comics/kitchen/03.jpg',
        dialog: '这些蟑螂贴板还不错，涂上诱饵，等着它们自投罗网就好。',
        speaker: '旁白',
      },
      {
        image: '/comics/kitchen/04.jpg',
        dialog: '干得漂亮！第一单顺利收尾。你的天赋不错嘛。',
        speaker: '蟑叔',
      },
    ],
  },
  // 第二关：阴暗下水道
  {
    scene: 'sewer' as SceneType,
    title: '第二关：阴暗下水道',
    panels: [
      {
        image: '/comics/sewer/01.jpg',
        dialog: '下水道的气味令人窒息……据说这里有会飞的蟑螂。',
        speaker: '旁白',
      },
      {
        image: '/comics/sewer/02.jpg',
        dialog: '小心！飞行蟑螂从上方俯冲下来了！',
        speaker: '蟑叔',
      },
      {
        image: '/comics/sewer/03.jpg',
        dialog: '杀虫剂喷射！别让它们飞走！',
        speaker: '旁白',
      },
      {
        image: '/comics/sewer/04.jpg',
        dialog: '又是一笔收入。走，回去喝杯热茶暖暖身子。',
        speaker: '蟑叔',
      },
    ],
  },
  // 第三关：垃圾场
  {
    scene: 'dump' as SceneType,
    title: '第三关：垃圾场',
    panels: [
      {
        image: '/comics/dump/01.jpg',
        dialog: '末日般的垃圾山……还有背上背着金属垃圾的蟑螂。',
        speaker: '旁白',
      },
      {
        image: '/comics/dump/02.jpg',
        dialog: '火焰对它不起作用！甲壳太厚了！',
        speaker: '你',
      },
      {
        image: '/comics/dump/03.jpg',
        dialog: '用燃烧瓶！制造火墙把它困住！',
        speaker: '蟑叔',
      },
      {
        image: '/comics/dump/04.jpg',
        dialog: '嗯……闻起来像烤虾。嘿，刀叉呢？',
        speaker: '蟑叔',
      },
    ],
  },
  // 第四关：地下室
  {
    scene: 'basement' as SceneType,
    title: '第四关：地下室',
    panels: [
      {
        image: '/comics/basement/01.jpg',
        dialog: '几乎全黑的地下室，只有闪电偶尔照亮那些发光的眼睛……',
        speaker: '旁白',
      },
      {
        image: '/comics/basement/02.jpg',
        dialog: '砰！分裂蟑螂炸开来了，变成了更多小蟑螂！',
        speaker: '你',
      },
      {
        image: '/comics/basement/03.jpg',
        dialog: '那是自爆蟑螂……背上绑着炸弹，千万小心！',
        speaker: '蟑叔',
      },
      {
        image: '/comics/basement/04.jpg',
        dialog: '散弹模式开启！全部清场！',
        speaker: '你',
      },
    ],
  },
  // 第五关：天台决战
  {
    scene: 'rooftop' as SceneType,
    title: '最终关：天台决战',
    panels: [
      {
        image: '/comics/rooftop/01.jpg',
        dialog: '城市的最高处。阴影在月光下缓缓移动……',
        speaker: '旁白',
      },
      {
        image: '/comics/rooftop/02.jpg',
        dialog: '天哪……那是蟑螂女王！螂老大！',
        speaker: '蟑叔',
      },
      {
        image: '/comics/rooftop/03.jpg',
        dialog: '它在召唤援军！四面八方都是蟑螂！',
        speaker: '你',
      },
      {
        image: '/comics/rooftop/04.jpg',
        dialog: '锁定目标。雷达激光——发射！',
        speaker: '你',
      },
      {
        image: '/comics/rooftop/05.jpg',
        dialog: '结束了……我们赢了。天边已经泛起了晨光。',
        speaker: '蟑叔',
      },
    ],
  },
];

/**
 * 根据场景类型获取对应漫画章节
 * @param {SceneType} scene - 场景类型
 * @returns {ComicChapter | undefined} 对应章节数据，未找到则返回 undefined
 */
export function getComicChapter(scene: SceneType): ComicChapter | undefined {
  return COMIC_DATA.find(c => c.scene === scene);
}

/**
 * 检查指定场景的漫画是否已观看过
 * @param {SceneType} scene - 场景类型
 * @returns {boolean} 已观看返回 true
 */
export function hasSeenComic(scene: SceneType): boolean {
  try {
    const seen = localStorage.getItem('roach_blaster_seen_comics');
    if (!seen) return false;
    const scenes: string[] = JSON.parse(seen);
    return scenes.includes(scene);
  } catch {
    return false;
  }
}

/**
 * 将指定场景的漫画标记为已观看
 * @param {SceneType} scene - 场景类型
 */
export function markComicSeen(scene: SceneType): void {
  try {
    const seen = localStorage.getItem('roach_blaster_seen_comics');
    const scenes: string[] = seen ? JSON.parse(seen) : [];
    if (!scenes.includes(scene)) {
      scenes.push(scene);
      localStorage.setItem('roach_blaster_seen_comics', JSON.stringify(scenes));
    }
  } catch {
    // 忽略存储错误
  }
}

/**
 * 重置漫画观看记录（调试用）
 */
export function resetSeenComics(): void {
  try {
    localStorage.removeItem('roach_blaster_seen_comics');
  } catch {
    // ignore
  }
}

/**
 * 获取全游戏漫画面板总数
 * @returns {number} 面板总数量
 */
export function getTotalComicCount(): number {
  return COMIC_DATA.reduce((sum, chapter) => sum + chapter.panels.length, 0);
}
