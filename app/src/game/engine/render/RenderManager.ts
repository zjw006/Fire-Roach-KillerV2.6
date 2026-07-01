/**
 * @fileoverview 渲染管理器类
 * @description 负责游戏画面的绘制与渲染效果管理，包括背景、实体、特效、UI等所有视觉元素的渲染
 */

import {
  SceneType,
  type Roach,
  type Particle,
  type FireZone,
  type FireWall,
  type StickyBoard,
  type StickyDrop,
  type WeaponDrop,
  type Player,
  type FloatingText,
  type GameState,
  type GameMode,
  type WeatherType
} from '../../types';

/**
 * 渲染管理器配置接口
 */
export interface RenderManagerConfig {
  /** Canvas 2D 渲染上下文 */
  ctx: CanvasRenderingContext2D;
  /** 画布宽度 */
  width: number;
  /** 画布高度 */
  height: number;
  /** 获取防御线Y坐标的函数 */
  getDefenseLineY: () => number;
}

/**
 * 渲染数据接口
 */
export interface RenderData {
  /** 游戏状态 */
  gameState: GameState;
  /** 游戏模式 */
  gameMode: GameMode;
  /** 难度 */
  difficulty: 'easy' | 'hard';
  /** 当前场景 */
  currentScene: SceneType;
  /** 时间（用于动画） */
  time: number;
  /** 屏幕抖动X偏移 */
  screenShakeX: number;
  /** 屏幕抖动Y偏移 */
  screenShakeY: number;
  /** 是否显示移动范围 */
  showMovementRange: boolean;
  /** 天气类型 */
  weather: WeatherType;
  /** 天气强度 */
  weatherIntensity: number;
  /** 天气计时器 */
  weatherTimer: number;
  /** 粘液爆发计时 */
  slimeBurstTimer: number;
  /** 粘液爆发X坐标 */
  slimeBurstX: number;
  /** 粘液爆发Y坐标 */
  slimeBurstY: number;
  /** 波次战斗数据 */
  bossBattle: {
    active: boolean;
    timer: number;
    maxTimer: number;
    eggPools: Array<{
      x: number;
      y: number;
      hp: number;
      maxHp: number;
      spawnTimer: number;
      spawnInterval: number;
    }>;
  };
  /** 放置的炸弹 */
  placedBombs: Array<{
    x: number;
    y: number;
    timer: number;
    maxTimer: number;
  }>;
  /** 死亡定时炸弹 */
  deadTimedBombs: Array<{
    x: number;
    y: number;
    timer: number;
    flashPhase: number;
  }>;
  /** 蟑螂实体列表 */
  roaches: Roach[];
  /** 粒子列表 */
  particles: Particle[];
  /** 火焰区域列表 */
  fireZones: FireZone[];
  /** 火焰墙列表 */
  fireWalls: FireWall[];
  /** 粘板列表 */
  stickyBoards: StickyBoard[];
  /** 粘性弹丸列表 */
  stickyDrops: StickyDrop[];
  /** 武器掉落物列表 */
  weaponDrops: WeaponDrop[];
  /** 玩家数据 */
  player: Player;
  /** 浮动文本列表 */
  floatingTexts: FloatingText[];
  /** 投掷物列表 */
  throwableProjectiles: Array<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: string;
    life: number;
    maxLife: number;
  }>;
  /** 风扇状态列表 */
  fanStates: Array<{
    active: boolean;
    timer: number;
    duration: number;
    slowFactor: number;
    bladeAngle: number;
    bladeSpeed: number;
  }>;
  /** 雷达激光列表 */
  radarLasers: Array<{
    active: boolean;
    timer: number;
    duration: number;
    targetId: number | null;
    fireTimer: number;
    fireInterval: number;
    damage: number;
    laserAlpha: number;
    shotsRemaining: number;
  }>;
  /** 场上道具掉落列表 */
  itemDropsOnField: Array<{
    id: string;
    x: number;
    y: number;
    type: string;
    name: string;
    description: string;
    icon: string;
    life: number;
    maxLife: number;
    bobPhase: number;
  }>;
  /** 图像资源 */
  images: {
    bgImg?: HTMLImageElement;
    bgKitchenHardImg?: HTMLImageElement;
    bgKitchenEasyImg?: HTMLImageElement;
    bgSewerImg?: HTMLImageElement;
    bgSewerHardImg?: HTMLImageElement;
    bgSewerEasyImg?: HTMLImageElement;
    bgDumpImg?: HTMLImageElement;
    bgDumpHardImg?: HTMLImageElement;
    bgDumpEasyImg?: HTMLImageElement;
    bgHospitalImg?: HTMLImageElement;
    bgHospitalHardImg?: HTMLImageElement;
    bgHospitalEasyImg?: HTMLImageElement;
    bgSceneImages: Record<SceneType, HTMLImageElement | undefined>;
    bombImg?: HTMLImageElement;
    roachImg?: HTMLImageElement;
    roachQueenImg?: HTMLImageElement;
    roachMutantImg?: HTMLImageElement;
    roachTankImg?: HTMLImageElement;
    roachFlyImg?: HTMLImageElement;
    roachSmallImg?: HTMLImageElement;
    roachMediumImg?: HTMLImageElement;
    roachLargeImg?: HTMLImageElement;
    playerImg?: HTMLImageElement;
    weaponDropImgs: Record<string, HTMLImageElement | undefined>;
    itemDropImgs: Record<string, HTMLImageElement | undefined>;
  };
  /** 图像是否已加载完成 */
  imagesLoaded: boolean;
}

/**
 * 渲染管理器类
 */
export class RenderManager {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private getDefenseLineY: () => number;

  /**
   * 构造函数
   * @param config - 渲染管理器配置
   */
  constructor(config: RenderManagerConfig) {
    this.ctx = config.ctx;
    this.width = config.width;
    this.height = config.height;
    this.getDefenseLineY = config.getDefenseLineY;
  }

  /**
   * 主渲染方法
   * @param data - 渲染数据
   */
  render(data: RenderData): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.translate(data.screenShakeX, data.screenShakeY);

    // 渲染背景
    this.renderBackground(ctx, w, h, data);
    
    // 渲染防御线
    this.renderDefenseLine(ctx, w, h);
    
    // 显示移动范围覆盖层
    if (data.showMovementRange) {
      this.renderMovementRange(ctx, data);
    }
    
    // 渲染天气背景
    this.renderWeatherBackground(ctx, w, h, data);
    
    // 渲染游戏实体
    this.renderFireZones(ctx, data);
    this.renderFireWalls(ctx, data);
    this.renderStickyBoards(ctx, data);
    this.renderStickyDrops(ctx, data);
    this.renderWeaponDrops(ctx, data);
    this.renderParticles(ctx, data);
    this.renderBaitMark(ctx, data);
    
    // 渲染放置的炸弹
    if (data.placedBombs.length > 0) {
      this.renderPlacedBombs(ctx, data);
    }
    
    // 渲染死亡定时炸弹
    if (data.deadTimedBombs.length > 0) {
      this.renderDeadTimedBombs(ctx, data);
    }
    
    // 渲染蟑螂
    this.renderRoaches(ctx, data);
    
    // 渲染治疗buff效果
    this.renderHealBuff(ctx, data);
    
    // 渲染粘液爆发效果
    if (data.slimeBurstTimer > 0) {
      this.renderSlimeBurst(ctx, data);
    }
    
    // 渲染蛋荚（Boss战）
    if (data.bossBattle.active) {
      this.renderEggPods(ctx, data);
    }
    
    // 渲染其他实体
    this.renderBaitThrow(ctx, data);
    this.renderPlayer(ctx, data);
    this.renderFloatingTexts(ctx, data);
    this.renderSwatter(ctx, data);
    this.renderMuzzleFlash(ctx, data);
    this.renderThrowableAim(ctx, data);
    this.renderThrowables(ctx, data);
    this.renderItemPlacement(ctx, data);
    this.renderInsecticideSpray(ctx, data);
    this.renderFan(ctx, data);
    this.renderRadarLaser(ctx, data);
    this.renderWeatherForeground(ctx, w, h, data);
    
    // 渲染防御线
    this.renderDefenseLine(ctx, w, h);
    
    // 渲染Boss UI
    if (data.bossBattle.active) {
      this.renderBossUI(ctx, w, h, data);
    }
    
    // 渲染场上道具掉落
    if (data.gameState === 'item_drop' && data.itemDropsOnField.length > 0) {
      this.renderItemDropOnField(ctx, w, h, data);
    }

    ctx.restore();
  }

  // ==================== 私有渲染方法 ====================

  /**
   * 渲染背景
   */
  private renderBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: RenderData
  ): void {
    const scene = this.getSceneConfig(data.currentScene);
    const diff = data.difficulty;
    const currScene = data.currentScene;
    const isHard = diff === 'hard';
    const isEasy = diff === 'easy';

    // ===== GENERIC bgImage support for new scenes =====
    if (scene.bgImage && data.images.bgSceneImages[currScene]) {
      const bgImg = data.images.bgSceneImages[currScene];
      if (bgImg?.complete && bgImg.naturalWidth > 0) {
        // Cover-fit the background image
        const imgRatio = bgImg.naturalWidth / bgImg.naturalHeight;
        const canvasRatio = w / h;
        let drawW: number, drawH: number, drawX: number, drawY: number;
        if (imgRatio > canvasRatio) {
          drawH = h;
          drawW = h * imgRatio;
          drawX = (w - drawW) / 2;
          drawY = 0;
        } else {
          drawW = w;
          drawH = w / imgRatio;
          drawX = 0;
          drawY = (h - drawH) / 2;
        }
        ctx.globalAlpha = 0.8;
        ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
        ctx.globalAlpha = 1;
        return;
      }
    }

    // ===== KITCHEN =====
    if (currScene === SceneType.KITCHEN && isHard && data.images.bgKitchenHardImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgKitchenHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.KITCHEN && isEasy && data.images.bgKitchenEasyImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgKitchenEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.KITCHEN && data.images.bgImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgImg, 0, 0, w, h);
    // ===== SEWER =====
    } else if (currScene === SceneType.SEWER && isHard && data.images.bgSewerHardImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgSewerHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.SEWER && isEasy && data.images.bgSewerEasyImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgSewerEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.SEWER && data.images.bgSewerImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgSewerImg, 0, 0, w, h);
    // ===== DUMP =====
    } else if (currScene === SceneType.DUMP && isHard && data.images.bgDumpHardImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgDumpHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.DUMP && isEasy && data.images.bgDumpEasyImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgDumpEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.DUMP && data.images.bgDumpImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgDumpImg, 0, 0, w, h);
    // ===== HOSPITAL =====
    } else if (currScene === SceneType.HOSPITAL && isHard && data.images.bgHospitalHardImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgHospitalHardImg, 0, 0, w, h);
    } else if (currScene === SceneType.HOSPITAL && isEasy && data.images.bgHospitalEasyImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgHospitalEasyImg, 0, 0, w, h);
    } else if (currScene === SceneType.HOSPITAL && data.images.bgHospitalImg && data.imagesLoaded) {
      ctx.drawImage(data.images.bgHospitalImg, 0, 0, w, h);
    // ===== FALLBACK: solid color =====
    } else {
      // 根据场景选择背景色
      let bgColor: string;
      switch (currScene) {
        case SceneType.KITCHEN:
          bgColor = '#2c3e50'; // 深蓝灰
          break;
        case SceneType.SEWER:
          bgColor = '#1a365d'; // 深蓝
          break;
        case SceneType.DUMP:
          bgColor = '#4a5568'; // 灰蓝
          break;
        case SceneType.HOSPITAL:
          bgColor = '#2d3748'; // 深灰蓝
          break;
        default:
          bgColor = '#1a202c'; // 接近黑色
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /**
   * 渲染防御线
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   */
  private renderDefenseLine(
    ctx: CanvasRenderingContext2D,
    w: number,
    _h: number
  ): void {
    const defenseLineY = this.getDefenseLineY();
    
    // 绘制防御线
    ctx.save();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, defenseLineY);
    ctx.lineTo(w, defenseLineY);
    ctx.stroke();
    
    // 绘制防御线文字
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('防御线', w / 2, defenseLineY - 10);
    
    ctx.restore();
  }

  /**
   * 渲染天气背景
   */
  private renderWeatherBackground(
    _ctx: CanvasRenderingContext2D,
    _w: number,
    _h: number,
    _data: RenderData
  ): void {
    // 天气效果渲染实现
    // TODO: 从原始引擎迁移天气渲染逻辑
  }

  /**
   * 渲染移动范围
   */
  private renderMovementRange(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 移动范围渲染实现
    // TODO: 从原始引擎迁移移动范围渲染逻辑
  }

  /**
   * 渲染火焰区域
   */
  private renderFireZones(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 火焰区域渲染实现
    // TODO: 从原始引擎迁移火焰区域渲染逻辑
  }

  /**
   * 渲染火焰墙
   */
  private renderFireWalls(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 火焰墙渲染实现
    // TODO: 从原始引擎迁移火焰墙渲染逻辑
  }

  /**
   * 渲染粘板
   */
  private renderStickyBoards(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 粘板渲染实现
    // TODO: 从原始引擎迁移粘板渲染逻辑
  }

  /**
   * 渲染粘性弹丸
   */
  private renderStickyDrops(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 粘性弹丸渲染实现
    // TODO: 从原始引擎迁移粘性弹丸渲染逻辑
  }

  /**
   * 渲染武器掉落物
   */
  private renderWeaponDrops(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 武器掉落物渲染实现
    // TODO: 从原始引擎迁移武器掉落物渲染逻辑
  }

  /**
   * 渲染粒子
   */
  private renderParticles(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 粒子渲染实现
    // TODO: 从原始引擎迁移粒子渲染逻辑
  }

  /**
   * 渲染诱饵标记
   */
  private renderBaitMark(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 诱饵标记渲染实现
    // TODO: 从原始引擎迁移诱饵标记渲染逻辑
  }

  /**
   * 渲染放置的炸弹
   */
  private renderPlacedBombs(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 放置炸弹渲染实现
    // TODO: 从原始引擎迁移放置炸弹渲染逻辑
  }

  /**
   * 渲染死亡定时炸弹
   */
  private renderDeadTimedBombs(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 死亡定时炸弹渲染实现
    // TODO: 从原始引擎迁移死亡定时炸弹渲染逻辑
  }

  /**
   * 渲染蟑螂
   */
  private renderRoaches(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 蟑螂渲染实现
    // TODO: 从原始引擎迁移蟑螂渲染逻辑
  }

  /**
   * 渲染治疗buff效果
   */
  private renderHealBuff(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 治疗buff渲染实现
    // TODO: 从原始引擎迁移治疗buff渲染逻辑
  }

  /**
   * 渲染粘液爆发效果
   */
  private renderSlimeBurst(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 粘液爆发渲染实现
    // TODO: 从原始引擎迁移粘液爆发渲染逻辑
  }

  /**
   * 渲染蛋荚
   */
  private renderEggPods(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 蛋荚渲染实现
    // TODO: 从原始引擎迁移蛋荚渲染逻辑
  }

  /**
   * 渲染诱饵投掷
   */
  private renderBaitThrow(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 诱饵投掷渲染实现
    // TODO: 从原始引擎迁移诱饵投掷渲染逻辑
  }

  /**
   * 渲染玩家
   */
  private renderPlayer(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 玩家渲染实现
    // TODO: 从原始引擎迁移玩家渲染逻辑
  }

  /**
   * 渲染浮动文本
   */
  private renderFloatingTexts(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 浮动文本渲染实现
    // TODO: 从原始引擎迁移浮动文本渲染逻辑
  }

  /**
   * 渲染苍蝇拍
   */
  private renderSwatter(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 苍蝇拍渲染实现
    // TODO: 从原始引擎迁移苍蝇拍渲染逻辑
  }

  /**
   * 渲染枪口闪光
   */
  private renderMuzzleFlash(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 枪口闪光渲染实现
    // TODO: 从原始引擎迁移枪口闪光渲染逻辑
  }

  /**
   * 渲染投掷物瞄准
   */
  private renderThrowableAim(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 投掷物瞄准渲染实现
    // TODO: 从原始引擎迁移投掷物瞄准渲染逻辑
  }

  /**
   * 渲染投掷物
   */
  private renderThrowables(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 投掷物渲染实现
    // TODO: 从原始引擎迁移投掷物渲染逻辑
  }

  /**
   * 渲染物品放置
   */
  private renderItemPlacement(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 物品放置渲染实现
    // TODO: 从原始引擎迁移物品放置渲染逻辑
  }

  /**
   * 渲染杀虫剂喷雾
   */
  private renderInsecticideSpray(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 杀虫剂喷雾渲染实现
    // TODO: 从原始引擎迁移杀虫剂喷雾渲染逻辑
  }

  /**
   * 渲染风扇
   */
  private renderFan(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 风扇渲染实现
    // TODO: 从原始引擎迁移风扇渲染逻辑
  }

  /**
   * 渲染雷达激光
   */
  private renderRadarLaser(
    _ctx: CanvasRenderingContext2D,
    _data: RenderData
  ): void {
    // 雷达激光渲染实现
    // TODO: 从原始引擎迁移雷达激光渲染逻辑
  }

  /**
   * 渲染天气前景
   */
  private renderWeatherForeground(
    _ctx: CanvasRenderingContext2D,
    _w: number,
    _h: number,
    _data: RenderData
  ): void {
    // 天气前景渲染实现
    // TODO: 从原始引擎迁移天气前景渲染逻辑
  }



  /**
   * 渲染Boss UI
   */
  private renderBossUI(
    _ctx: CanvasRenderingContext2D,
    _w: number,
    _h: number,
    _data: RenderData
  ): void {
    // Boss UI渲染实现
    // TODO: 从原始引擎迁移Boss UI渲染逻辑
  }

  /**
   * 渲染场上道具掉落
   */
  private renderItemDropOnField(
    _ctx: CanvasRenderingContext2D,
    _w: number,
    _h: number,
    _data: RenderData
  ): void {
    // 场上道具掉落渲染实现
    // TODO: 从原始引擎迁移场上道具掉落渲染逻辑
  }

  // ==================== 工具方法 ====================

  /**
   * 获取场景配置
   */
  private getSceneConfig(_sceneType: SceneType): any {
    // TODO: 从游戏数据中获取场景配置
    return {};
  }
}