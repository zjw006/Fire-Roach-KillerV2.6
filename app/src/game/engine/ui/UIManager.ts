/**
 * @fileoverview UI管理器
 * @description 负责管理游戏中的用户界面，包括HUD、菜单、对话框等
 */

import { GameState, GameMode } from '../../types';
import type { 
  SceneType, 
  WeatherType, 
  BossBattleState,
  Player,
  Economy,
  GameProgress
} from '../../types';

/**
 * UI管理器配置接口
 */
export interface UIManagerConfig {
  /** 画布上下文 */
  ctx: CanvasRenderingContext2D;
  /** 画布宽度 */
  width: number;
  /** 画布高度 */
  height: number;
  /** 音频管理器 */
  audio?: any;
}

/**
 * 浮动文字特效数据接口
 */
export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
  /** 可选字体缩放（1.0 = 默认 16px） */
  scale?: number;
}

/**
 * UI渲染数据接口
 */
export interface UIRenderData {
  /** 游戏状态 */
  gameState: GameState;
  /** 游戏模式 */
  gameMode: GameMode;
  /** 难度 */
  difficulty: 'easy' | 'hard';
  /** 当前场景 */
  currentScene: SceneType;
  /** 玩家信息 */
  player: Player;
  /** 经济统计 */
  economy: Economy;
  /** 游戏进度 */
  progress?: GameProgress;
  /** 当前波次 */
  wave: number;
  /** 防御生命值 */
  defenseHp: number;
  /** 最大防御生命值 */
  maxDefenseHp: number;
  /** 天气类型 */
  weather: WeatherType;
  /** 天气强度 */
  weatherIntensity: number;
  /** Boss战斗状态 */
  bossState?: BossBattleState | null;
  /** 选中的物品索引 */
  selectedItemIndex?: number;
  /** 是否正在放置物品 */
  isPlacingItem?: boolean;
  /** 物品冷却时间 */
  itemCooldowns?: Record<string, number>;
  /** 全局消耗品冷却时间 */
  globalConsumableCooldown?: number;
  /** 携带的商店消耗品 */
  carriedConsumables?: Record<string, number>;
  /** Buff闪烁计时器 */
  buffFlashTimers?: Record<string, number>;
  /** 紧急冷却库存 */
  emergencyCoolInventory?: number;
  /** 消耗品冷却时间 */
  consumableCooldowns?: Record<string, number>;
  /** 战斗开始计时器 */
  combatStartTimer?: number;
  /** 时间（用于动画） */
  time: number;
  /** 浮动文字特效列表 */
  floatingTexts?: FloatingText[];
}

/**
 * UI管理器类
 * @description 管理游戏中的用户界面
 */
export class UIManager {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  /**
   * 构造函数
   * @param config - UI管理器配置
   */
  constructor(config: UIManagerConfig) {
    this.ctx = config.ctx;
    this.width = config.width;
    this.height = config.height;
  }

  /**
   * 渲染游戏UI
   * @param data - UI渲染数据
   */
  render(data: UIRenderData): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 保存画布状态
    ctx.save();

    // 渲染HUD
    this.renderHUD(ctx, w, h, data);

    // 渲染Boss UI（如果存在）
    if (data.bossState) {
      this.renderBossUI(ctx, w, h, data);
    }

    // 渲染浮动文字（如果存在）
    if (data.floatingTexts && data.floatingTexts.length > 0) {
      this.renderFloatingTexts(ctx, data.floatingTexts);
    }

    // 恢复画布状态
    ctx.restore();
  }

  /**
   * 渲染HUD（抬头显示器）
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  private renderHUD(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: UIRenderData
  ): void {
    const { gameState, player } = data;
    
    // 游戏状态相关的HUD渲染
    if (gameState === GameState.PLAYING || gameState === GameState.WAVE_CLEAR) {
      this.renderGameHUD(ctx, w, h, data);
    } else if (gameState === GameState.SHOP) {
      this.renderShopHUD(ctx, w, h, data);
    } else if (gameState === GameState.TALENT_TREE) {
      this.renderUpgradeHUD(ctx, w, h, data);
    }
    
    // 通用HUD元素
    this.renderTopBar(ctx, w, h, data);
    
    // 过热警告HUD
    if (player.heatWarningTimer > 0 && !player.isOverheated) {
      this.renderHeatWarning(ctx, w, h, player);
    }
  }

  /**
   * 渲染金钱显示
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param money - 金钱数量
   */
  private renderMoney(
    ctx: CanvasRenderingContext2D,
    money: number
  ): void {
    ctx.save();
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 120, 30, 6);
    ctx.fill();

    // 金钱图标
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('¥', 20, 30);

    // 金钱数量
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(money.toString(), 40, 30);

    ctx.restore();
  }

  /**
   * 渲染波次显示
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param wave - 当前波次
   * @param gameMode - 游戏模式
   */
  private renderWave(
    ctx: CanvasRenderingContext2D,
    w: number,
    wave: number,
    gameMode: GameMode
  ): void {
    ctx.save();

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(w - 130, 10, 120, 30, 6);
    ctx.fill();

    // 波次图标
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('波次', w - 120, 30);

    // 波次数量
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'right';
    const waveText = gameMode === GameMode.ENDLESS ? `${wave}` : `${wave}`;
    ctx.fillText(waveText, w - 20, 30);

    ctx.restore();
  }

  /**
   * 渲染燃料条
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param gas - 当前燃料
   * @param maxGas - 最大燃料
   */
  private renderGasBar(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    gas: number,
    maxGas: number
  ): void {
    const barWidth = 200;
    const barHeight = 20;
    const barX = (w - barWidth) / 2;
    const barY = h - 50;

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 4);
    ctx.fill();

    // 燃料条
    const gasRatio = gas / maxGas;
    ctx.fillStyle = gasRatio > 0.3 ? '#22c55e' : '#ef4444';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth * gasRatio, barHeight, 4);
    ctx.fill();

    // 文字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`燃料: ${Math.round(gas)}/${maxGas}`, w / 2, barY + barHeight / 2);

    ctx.restore();
  }

  /**
   * 渲染热量条
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param heat - 当前热量
   * @param maxHeat - 最大热量
   */
  private renderHeatBar(
    ctx: CanvasRenderingContext2D,
    heat: number,
    maxHeat: number
  ): void {
    const barWidth = 200;
    const barHeight = 12;
    const x = 10;
    const y = 70;

    this.renderProgressBar(ctx, x, y, barWidth, barHeight, heat / maxHeat, '#ef4444', '热量');
  }

  /**
   * 渲染防御生命条
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param hp - 当前生命值
   * @param maxHp - 最大生命值
   */
  private renderDefenseBar(
    ctx: CanvasRenderingContext2D,
    hp: number,
    maxHp: number
  ): void {
    const barWidth = 200;
    const barHeight = 12;
    const x = 10;
    const y = 90;

    this.renderProgressBar(ctx, x, y, barWidth, barHeight, hp / maxHp, '#10b981', '防御');
  }

  /**
   * 渲染进度条
   * @param ctx - 画布上下文
   * @param x - X坐标
   * @param y - Y坐标
   * @param width - 宽度
   * @param height - 高度
   * @param progress - 进度（0-1）
   * @param color - 颜色
   * @param label - 标签
   */
  private renderProgressBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    progress: number,
    color: string,
    label: string
  ): void {
    ctx.save();

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    // 进度条
    const fillWidth = Math.max(0, Math.min(width, width * progress));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, fillWidth, height, 4);
    ctx.fill();

    // 标签
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 5, y + height / 2 + 3);

    // 百分比
    const percentText = `${Math.round(progress * 100)}%`;
    ctx.textAlign = 'right';
    ctx.fillText(percentText, x + width - 5, y + height / 2 + 3);

    ctx.restore();
  }

  /**
   * 渲染武器选择器
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  /**
   * 渲染武器选择器
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  private renderWeaponSelector(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: UIRenderData
  ): void {
    const { player, currentWeapon } = data;
    
    // 武器选择器位置（底部居中）
    const selectorWidth = 200;
    const selectorHeight = 40;
    const selectorX = (w - selectorWidth) / 2;
    const selectorY = h - 80;
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(selectorX, selectorY, selectorWidth, selectorHeight, 8);
    ctx.fill();
    
    // 可用武器列表
    const availableWeapons = ['flamethrower', 'shotgun'];
    
    // 渲染每个武器选项
    const optionWidth = selectorWidth / availableWeapons.length;
    availableWeapons.forEach((weapon, index) => {
      const optionX = selectorX + index * optionWidth;
      const isSelected = currentWeapon === weapon;
      
      // 选项背景
      ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(optionX, selectorY, optionWidth, selectorHeight, 8);
      ctx.fill();
      
      // 武器图标
      ctx.fillStyle = isSelected ? '#ffffff' : '#888888';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let icon = '🔥';
      if (weapon === 'shotgun') icon = '🔫';
      
      ctx.fillText(icon, optionX + optionWidth / 2, selectorY + selectorHeight / 2);
      
      // 快捷键显示
      ctx.fillStyle = isSelected ? '#fbbf24' : '#666666';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(`${index + 1}`, optionX + optionWidth / 2, selectorY + selectorHeight - 8);
    });
    
    // 热量警告（如果接近过热）
    if (player.heat > player.overheatThreshold * 0.8 && !player.isOverheated) {
      const warningX = selectorX + selectorWidth / 2;
      const warningY = selectorY - 20;
      
      const pulse = (Math.sin(data.time * 10) + 1) * 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.3 + pulse * 0.3})`;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ 热量过高', warningX, warningY);
    }
  }

  /**
   * 渲染消耗品栏
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  /**
   * 渲染消耗品栏
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  private renderConsumableBar(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: UIRenderData
  ): void {
    const { carriedConsumables = {}, consumableCooldowns = {}, globalConsumableCooldown = 0, combatStartTimer = 0 } = data;
    
    // 消耗品栏位置（底部右侧）
    const barWidth = 180;
    const barHeight = 50;
    const barX = w - barWidth - 20;
    const barY = h - 80;
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 8);
    ctx.fill();
    
    // 消耗品列表
    const consumableList = [
      { id: 'gas_refill', name: '气罐补给', icon: '⛽', color: '#fbbf24' },
      { id: 'defense_repair', name: '防线修复', icon: '🔧', color: '#10b981' },
      { id: 'emergency_cool', name: '紧急冷却', icon: '❄️', color: '#60a5fa' },
      { id: 'shield', name: '护盾', icon: '🛡️', color: '#8b5cf6' },
      { id: 'power_boost', name: '功率提升', icon: '⚡', color: '#f59e0b' },
      { id: 'bait', name: '诱饵', icon: '🍖', color: '#ef4444' }
    ];
    
    // 渲染每个消耗品
    const itemSize = 36;
    const spacing = 8;
    const startX = barX + (barWidth - (itemSize * 3 + spacing * 2)) / 2;
    const startY = barY + (barHeight - itemSize) / 2;
    
    consumableList.forEach((consumable, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const itemX = startX + col * (itemSize + spacing);
      const itemY = startY + row * (itemSize + spacing);
      
      const count = carriedConsumables[consumable.id] || 0;
      const cooldown = consumableCooldowns[consumable.id] || 0;
      const isOnCooldown = cooldown > 0;
      const isGlobalLocked = globalConsumableCooldown > 0;
      const isCombatLocked = combatStartTimer > 0;
      const isLocked = isOnCooldown || isGlobalLocked || isCombatLocked;
      
      // 显示消耗品
      if (count > 0) {
        // 背景
        ctx.fillStyle = isLocked ? 'rgba(50, 50, 50, 0.8)' : 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(itemX, itemY, itemSize, itemSize, 6);
        ctx.fill();
        
        // 边框
        ctx.strokeStyle = isLocked ? '#666666' : consumable.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(itemX, itemY, itemSize, itemSize);
        
        // 图标
        ctx.fillStyle = isLocked ? '#888888' : consumable.color;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(consumable.icon, itemX + itemSize / 2, itemY + itemSize / 2);
        
        // 数量
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(count.toString(), itemX + itemSize - 8, itemY + 12);
        
        // 冷却覆盖层
        if (isLocked) {
          const displayCd = Math.max(cooldown, globalConsumableCooldown, combatStartTimer);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(itemX, itemY, itemSize, itemSize);
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Arial';
          ctx.fillText(displayCd.toFixed(1), itemX + itemSize / 2, itemY + itemSize / 2);
        }
      }
    });
  }

  /**
   * 渲染Boss UI
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  private renderBossUI(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: UIRenderData
  ): void {
    const bossState = data.bossState;
    if (!bossState) return;

    const barW = Math.min(400, w * 0.7);
    const barH = 20;
    const barX = (w - barW) / 2;
    const barY = 82;

    // Boss名称 + 阶段
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(`螂老大 - ${bossState.phaseName}`, w / 2, barY - 8);
    ctx.shadowBlur = 0;

    // 4层HP条（虫卵波次进度）
    const layerColors = ['#22c55e', '#eab308', '#f97316', '#ef4444'];
    const layerWidth = barW / 4;

    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // 绘制4层
    for (let i = 0; i < 4; i++) {
      const isActive = i < bossState.currentWave;
      const lx = barX + i * layerWidth;
      ctx.fillStyle = isActive ? layerColors[i] : 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      const roundL = i === 0 ? 4 : 0;
      const roundR = i === 3 ? 4 : 0;
      ctx.roundRect(lx, barY, layerWidth - 1, barH, [roundL, roundR, roundR, roundL]);
      ctx.fill();

      // 层数编号
      ctx.fillStyle = isActive ? '#fff' : 'rgba(150,150,150,0.4)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, lx + layerWidth / 2, barY + barH / 2 + 3);

      // 分隔线
      if (i < 3) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx + layerWidth, barY + 3);
        ctx.lineTo(lx + layerWidth, barY + barH - 3);
        ctx.stroke();
      }
    }

    // 波次进度文本 - 显示1-4波，处理施法状态
    let waveDisplay = '准备中';
    if (bossState.currentWave >= 1 && bossState.currentWave <= 4) {
      waveDisplay = `第${bossState.currentWave}/4波`;
    } else if (bossState.currentWave >= 5) {
      waveDisplay = 'BOSS逃跑中';
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(waveDisplay, w / 2, barY + barH / 2 + 3);
    ctx.shadowBlur = 0;

    // 剩余时间
    const timeText = `剩余时间: ${Math.ceil(bossState.timeRemaining)}秒`;
    ctx.fillStyle = bossState.timeRemaining < 30 ? '#ef4444' : '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(timeText, w - 20, barY + barH + 18);

    // ===== 阶段变化横幅 =====
    if (bossState.phaseJustChanged && bossState.phaseChangeTimer > 0) {
      const alpha = Math.min(1, bossState.phaseChangeTimer / 1.5);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * alpha})`;
      ctx.fillRect(0, h / 2 - 60, w, 120);
      ctx.fillStyle = `rgba(255, 68, 68, ${alpha})`;
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillText(bossState.phaseChangeText, w / 2, h / 2 - 10);
      ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(bossState.phaseChangeSub, w / 2, h / 2 + 25);
      ctx.shadowBlur = 0;
    }
  }

  /**
   * 渲染菜单
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  renderMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: UIRenderData
  ): void {
    const { gameState, gameMode, difficulty, currentScene, player, economy, progress } = data;
    
    // 根据游戏状态渲染不同的菜单
    switch (gameState) {
      case GameState.MENU:
        this.renderMainMenu(ctx, w, h, gameMode, difficulty, currentScene, progress);
        break;
      case GameState.PAUSED:
        this.renderPauseMenu(ctx, w, h, player, economy, gameMode);
        break;
      case GameState.GAME_OVER:
        this.renderGameOverMenu(ctx, w, h, player, economy, gameMode);
        break;
      default:
        // 其他状态不渲染菜单
        break;
    }
  }

  /**
   * 渲染主菜单
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param gameMode - 游戏模式
   * @param difficulty - 难度
   * @param currentScene - 当前场景
   * @param progress - 游戏进度
   */
  private renderMainMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    gameMode: GameMode,
    difficulty: 'easy' | 'hard',
    currentScene: SceneType,
    progress?: GameProgress
  ): void {
    ctx.save();
    
    // 背景渐变
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    
    // 游戏标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('烈焰除蟑：火线守卫', w / 2, h / 4);
    ctx.shadowBlur = 0;
    
    // 副标题
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Fire Roach Killer', w / 2, h / 4 + 50);
    
    // 菜单选项
    const menuOptions = [
      { text: '开始游戏', action: 'start' },
      { text: '继续游戏', action: 'continue', enabled: progress && progress.currentScene !== 'none' },
      { text: '无尽模式', action: 'endless' },
      { text: '设置', action: 'settings' },
      { text: '退出', action: 'exit' }
    ];
    
    // 渲染菜单选项
    const optionHeight = 50;
    const startY = h / 2;
    
    menuOptions.forEach((option, index) => {
      const y = startY + index * (optionHeight + 15);
      const isEnabled = option.enabled !== false;
      
      // 背景
      ctx.fillStyle = isEnabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(100, 100, 100, 0.1)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 150, y - 25, 300, optionHeight, 10);
      ctx.fill();
      
      // 边框
      ctx.strokeStyle = isEnabled ? '#fbbf24' : '#666666';
      ctx.lineWidth = 2;
      ctx.strokeRect(w / 2 - 150, y - 25, 300, optionHeight);
      
      // 文字
      ctx.fillStyle = isEnabled ? '#ffffff' : '#888888';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(option.text, w / 2, y);
      
      // 快捷键提示
      if (isEnabled && index < 5) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`[${index + 1}]`, w / 2 + 120, y);
      }
    });
    
    // 版本信息
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('版本 2.6', w - 20, h - 20);
    
    ctx.restore();
  }

  /**
   * 渲染暂停菜单
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param player - 玩家信息
   * @param economy - 经济统计
   * @param gameMode - 游戏模式
   */
  private renderPauseMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    player: Player,
    economy: Economy,
    gameMode: GameMode
  ): void {
    ctx.save();
    
    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);
    
    // 暂停标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('游戏暂停', w / 2, h / 4);
    ctx.shadowBlur = 0;
    
    // 游戏状态信息
    const infoY = h / 3;
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    
    // 显示当前波次和金钱
    const waveText = gameMode === GameMode.ENDLESS ? '无尽模式' : `波次: ${player.wave || 0}`;
    ctx.fillText(waveText, w / 2, infoY);
    ctx.fillText(`金钱: ${economy.money}`, w / 2, infoY + 30);
    
    // 暂停菜单选项
    const pauseOptions = [
      { text: '继续游戏', action: 'resume' },
      { text: '重新开始', action: 'restart' },
      { text: '返回主菜单', action: 'main_menu' },
      { text: '设置', action: 'settings' }
    ];
    
    // 渲染暂停菜单选项
    const optionHeight = 45;
    const startY = h / 2;
    
    pauseOptions.forEach((option, index) => {
      const y = startY + index * (optionHeight + 10);
      
      // 背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 120, y - 22, 240, optionHeight, 8);
      ctx.fill();
      
      // 边框
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(w / 2 - 120, y - 22, 240, optionHeight);
      
      // 文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(option.text, w / 2, y);
      
      // 快捷键提示
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(`[${index + 1}]`, w / 2 + 90, y);
    });
    
    // 操作提示
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('按 ESC 键继续游戏', w / 2, h - 50);
    
    ctx.restore();
  }

  /**
   * 渲染游戏结束菜单
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param player - 玩家信息
   * @param economy - 经济统计
   * @param gameMode - 游戏模式
   */
  private renderGameOverMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    player: Player,
    economy: Economy,
    gameMode: GameMode
  ): void {
    ctx.save();
    
    // 红色半透明背景
    ctx.fillStyle = 'rgba(120, 0, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);
    
    // 游戏结束标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 12;
    ctx.fillText('游戏结束', w / 2, h / 4);
    ctx.shadowBlur = 0;
    
    // 结果信息
    const resultY = h / 3;
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    
    // 显示最终波次和金钱
    const finalWave = player.wave || 0;
    const finalMoney = economy.money;
    
    ctx.fillText(`最终波次: ${finalWave}`, w / 2, resultY);
    ctx.fillText(`获得金钱: ${finalMoney}`, w / 2, resultY + 30);
    
    // 无尽模式特殊显示
    if (gameMode === GameMode.ENDLESS) {
      const bestTime = economy.endlessBestTime || 0;
      const currentTime = economy.endlessElapsedTime || 0;
      
      ctx.fillText(`坚持时间: ${currentTime.toFixed(1)}秒`, w / 2, resultY + 60);
      ctx.fillText(`最佳记录: ${bestTime.toFixed(1)}秒`, w / 2, resultY + 90);
      
      // 新记录提示
      if (economy.endlessNewRecordShown) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('🎉 新记录!', w / 2, resultY + 120);
      }
    }
    
    // 游戏结束菜单选项
    const gameOverOptions = [
      { text: '重新开始', action: 'restart' },
      { text: '返回主菜单', action: 'main_menu' },
      { text: '查看统计', action: 'stats' }
    ];
    
    // 渲染游戏结束菜单选项
    const optionHeight = 45;
    const startY = h / 2 + 60;
    
    gameOverOptions.forEach((option, index) => {
      const y = startY + index * (optionHeight + 10);
      
      // 背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 120, y - 22, 240, optionHeight, 8);
      ctx.fill();
      
      // 边框
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(w / 2 - 120, y - 22, 240, optionHeight);
      
      // 文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(option.text, w / 2, y);
      
      // 快捷键提示
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(`[${index + 1}]`, w / 2 + 90, y);
    });
    
    // 操作提示
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('按 ESC 键返回主菜单', w / 2, h - 50);
    
    ctx.restore();
  }

  /**
   * 渲染游戏HUD
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  private renderGameHUD(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: UIRenderData
  ): void {
    const { player, economy, wave, gameMode, weather, weatherIntensity } = data;
    
    // 渲染金钱显示
    this.renderMoney(ctx, economy.money);
    
    // 渲染波次显示
    this.renderWave(ctx, w, wave, gameMode);
    
    // 渲染燃料条
    this.renderGasBar(ctx, w, h, player.gas, player.maxGas);
    
    // 渲染热量条
    this.renderHeatBar(ctx, player.heat, player.overheatThreshold);
    
    // 渲染防御生命条
    this.renderDefenseBar(ctx, data.defenseHp, data.maxDefenseHp);
    
    // 渲染武器选择器
    this.renderWeaponSelector(ctx, w, h, data);
    
    // 渲染消耗品栏
    this.renderConsumableBar(ctx, w, h, data);
    
    // 渲染天气效果UI
    this.renderWeatherUI(ctx, w, h, weather, weatherIntensity);
    
    // 渲染紧急冷却库存
    this.renderEmergencyCoolInventory(ctx, w, h, data.emergencyCoolInventory || 0);
  }

  /**
   * 渲染商店HUD
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  private renderShopHUD(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: UIRenderData
  ): void {
    const { economy, player, currentScene } = data;
    
    ctx.save();
    
    // 商店背景
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    
    // 商店标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('商店', w / 2, 80);
    ctx.shadowBlur = 0;
    
    // 金钱显示（商店版本）
    this.renderShopMoney(ctx, w, economy.money);
    
    // 商店物品列表
    const shopItems = this.getShopItems(currentScene, player);
    
    // 渲染商店物品
    this.renderShopItems(ctx, w, h, shopItems, economy.money);
    
    // 操作提示
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('点击物品购买，按 ESC 键继续游戏', w / 2, h - 40);
    
    ctx.restore();
  }

  /**
   * 渲染商店金钱显示
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param money - 金钱数量
   */
  private renderShopMoney(
    ctx: CanvasRenderingContext2D,
    w: number,
    money: number
  ): void {
    ctx.save();
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 100, 120, 200, 40, 8);
    ctx.fill();
    
    // 金钱图标
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💰', w / 2 - 60, 140);
    
    // 金钱数量
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(money.toString(), w / 2 + 20, 140);
    
    ctx.restore();
  }

  /**
   * 获取商店物品列表
   * @param scene - 当前场景
   * @param player - 玩家信息
   * @returns 商店物品列表
   */
  private getShopItems(
    scene: SceneType,
    player: Player
  ): Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    icon: string;
    color: string;
    maxCount?: number;
    currentCount?: number;
  }> {
    // 基础商店物品
    const baseItems = [
      {
        id: 'gas_refill',
        name: '气罐补给',
        description: '立即补充50%燃料',
        price: 100,
        icon: '⛽',
        color: '#fbbf24',
        maxCount: 3
      },
      {
        id: 'defense_repair',
        name: '防线修复',
        description: '修复50%防御生命值',
        price: 150,
        icon: '🔧',
        color: '#10b981',
        maxCount: 2
      },
      {
        id: 'emergency_cool',
        name: '紧急冷却',
        description: '立即降低50%热量',
        price: 120,
        icon: '❄️',
        color: '#60a5fa',
        maxCount: 3
      },
      {
        id: 'shield',
        name: '护盾',
        description: '10秒内免疫伤害',
        price: 200,
        icon: '🛡️',
        color: '#8b5cf6',
        maxCount: 1
      },
      {
        id: 'power_boost',
        name: '功率提升',
        description: '30秒内伤害+50%',
        price: 180,
        icon: '⚡',
        color: '#f59e0b',
        maxCount: 2
      },
      {
        id: 'bait',
        name: '诱饵',
        description: '吸引附近蟑螂',
        price: 80,
        icon: '🍖',
        color: '#ef4444',
        maxCount: 4
      }
    ];
    
    // 根据场景解锁额外物品
    const sceneItems: Record<SceneType, Array<{ id: string; name: string; description: string; price: number; icon: string; color: string }>> = {
      kitchen: [
        {
          id: 'flame_enhancer',
          name: '火焰增强剂',
          description: '火焰伤害+30%',
          price: 250,
          icon: '🔥',
          color: '#dc2626'
        }
      ],
      sewer: [
        {
          id: 'water_resistance',
          name: '防水涂层',
          description: '减少水环境影响',
          price: 180,
          icon: '💧',
          color: '#3b82f6'
        }
      ],
      dump: [
        {
          id: 'toxic_resistance',
          name: '抗毒涂层',
          description: '减少毒气影响',
          price: 200,
          icon: '☣️',
          color: '#10b981'
        }
      ],
      basement: [
        {
          id: 'darkvision',
          name: '夜视仪',
          description: '提高黑暗环境视野',
          price: 220,
          icon: '👁️',
          color: '#8b5cf6'
        }
      ],
      rooftop: [
        {
          id: 'wind_resistance',
          name: '抗风装置',
          description: '减少强风影响',
          price: 190,
          icon: '💨',
          color: '#a5b4fc'
        }
      ],
      hospital: [
        {
          id: 'medical_kit',
          name: '医疗包',
          description: '缓慢恢复生命值',
          price: 300,
          icon: '🏥',
          color: '#ef4444'
        }
      ],
      none: []
    };
    
    // 合并基础物品和场景物品
    const allItems = [...baseItems, ...(sceneItems[scene] || [])];
    
    // 添加当前数量信息
    return allItems.map(item => ({
      ...item,
      currentCount: player.consumableInventory?.[item.id] || 0
    }));
  }

  /**
   * 渲染商店物品
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param items - 商店物品列表
   * @param playerMoney - 玩家金钱
   */
  private renderShopItems(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    items: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      icon: string;
      color: string;
      maxCount?: number;
      currentCount?: number;
    }>,
    playerMoney: number
  ): void {
    const itemWidth = 160;
    const itemHeight = 180;
    const padding = 20;
    const itemsPerRow = 3;
    
    // 计算起始位置
    const totalWidth = itemsPerRow * itemWidth + (itemsPerRow - 1) * padding;
    const startX = (w - totalWidth) / 2;
    const startY = 180;
    
    items.forEach((item, index) => {
      const row = Math.floor(index / itemsPerRow);
      const col = index % itemsPerRow;
      
      const x = startX + col * (itemWidth + padding);
      const y = startY + row * (itemHeight + padding);
      
      const canAfford = playerMoney >= item.price;
      const canBuyMore = !item.maxCount || (item.currentCount || 0) < item.maxCount;
      const isAvailable = canAfford && canBuyMore;
      
      // 物品背景
      ctx.fillStyle = isAvailable ? 'rgba(255, 255, 255, 0.1)' : 'rgba(100, 100, 100, 0.1)';
      ctx.beginPath();
      ctx.roundRect(x, y, itemWidth, itemHeight, 12);
      ctx.fill();
      
      // 边框
      ctx.strokeStyle = isAvailable ? item.color : '#666666';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, itemWidth, itemHeight);
      
      // 物品图标
      ctx.fillStyle = isAvailable ? item.color : '#888888';
      ctx.font = `bold ${itemWidth / 3}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon, x + itemWidth / 2, y + 50);
      
      // 物品名称
      ctx.fillStyle = isAvailable ? '#ffffff' : '#888888';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(item.name, x + itemWidth / 2, y + 90);
      
      // 物品描述
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px Arial';
      const lines = this.wrapText(ctx, item.description, itemWidth - 20);
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, x + itemWidth / 2, y + 110 + lineIndex * 16);
      });
      
      // 价格
      const priceColor = canAfford ? '#fbbf24' : '#ef4444';
      ctx.fillStyle = priceColor;
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`${item.price}💰`, x + itemWidth / 2, y + itemHeight - 30);
      
      // 数量限制提示
      if (item.maxCount) {
        const countText = `${item.currentCount || 0}/${item.maxCount}`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Arial';
        ctx.fillText(countText, x + itemWidth - 25, y + 25);
      }
    });
  }

  /**
   * 文本换行处理
   * @param ctx - 画布上下文
   * @param text - 原始文本
   * @param maxWidth - 最大宽度
   * @returns 换行后的文本数组
   */
  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    
    lines.push(currentLine);
    return lines;
  }

  /**
   * 渲染升级HUD
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  private renderUpgradeHUD(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: UIRenderData
  ): void {
    const { economy, player, progress } = data;
    
    ctx.save();
    
    // 升级界面背景
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#1e1b4b');
    gradient.addColorStop(1, '#312e81');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    
    // 升级界面标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('天赋树', w / 2, 80);
    ctx.shadowBlur = 0;
    
    // 天赋点显示
    this.renderTalentPoints(ctx, w, player.talentPoints || 0);
    
    // 天赋树渲染
    this.renderTalentTree(ctx, w, h, player, progress);
    
    // 操作提示
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('点击天赋升级，按 ESC 键继续游戏', w / 2, h - 40);
    
    ctx.restore();
  }

  /**
   * 渲染天赋点显示
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param talentPoints - 天赋点数量
   */
  private renderTalentPoints(
    ctx: CanvasRenderingContext2D,
    w: number,
    talentPoints: number
  ): void {
    ctx.save();
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 120, 120, 240, 40, 8);
    ctx.fill();
    
    // 天赋点图标
    ctx.fillStyle = '#8b5cf6';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', w / 2 - 70, 140);
    
    // 天赋点数量
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`天赋点: ${talentPoints}`, w / 2 + 20, 140);
    
    ctx.restore();
  }

  /**
   * 渲染天赋树
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param player - 玩家信息
   * @param progress - 游戏进度
   */
  private renderTalentTree(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    player: Player,
    progress?: GameProgress
  ): void {
    // 天赋树定义
    const talentTree = {
      branches: [
        {
          id: 'flame',
          name: '火焰专精',
          color: '#ef4444',
          talents: [
            {
              id: 'flame_range',
              name: '火焰射程',
              description: '增加火焰喷射距离',
              maxLevel: 5,
              costPerLevel: 1,
              effectPerLevel: '+10%射程'
            },
            {
              id: 'flame_damage',
              name: '火焰伤害',
              description: '增加火焰基础伤害',
              maxLevel: 5,
              costPerLevel: 2,
              effectPerLevel: '+15%伤害'
            },
            {
              id: 'flame_pierce',
              name: '火焰穿透',
              description: '火焰可以穿透多个敌人',
              maxLevel: 3,
              costPerLevel: 3,
              effectPerLevel: '+1穿透目标'
            }
          ]
        },
        {
          id: 'defense',
          name: '防御专精',
          color: '#10b981',
          talents: [
            {
              id: 'defense_hp',
              name: '防御生命',
              description: '增加防御生命值上限',
              maxLevel: 5,
              costPerLevel: 1,
              effectPerLevel: '+20%生命值'
            },
            {
              id: 'defense_regen',
              name: '防御恢复',
              description: '防御生命值自动恢复',
              maxLevel: 3,
              costPerLevel: 2,
              effectPerLevel: '+5%每秒恢复'
            },
            {
              id: 'defense_shield',
              name: '能量护盾',
              description: '获得临时护盾吸收伤害',
              maxLevel: 3,
              costPerLevel: 3,
              effectPerLevel: '+10%最大生命值护盾'
            }
          ]
        },
        {
          id: 'utility',
          name: '实用专精',
          color: '#60a5fa',
          talents: [
            {
              id: 'move_speed',
              name: '移动速度',
              description: '增加玩家移动速度',
              maxLevel: 5,
              costPerLevel: 1,
              effectPerLevel: '+10%速度'
            },
            {
              id: 'gas_capacity',
              name: '燃料容量',
              description: '增加燃料最大容量',
              maxLevel: 5,
              costPerLevel: 2,
              effectPerLevel: '+20%容量'
            },
            {
              id: 'cooling_rate',
              name: '冷却效率',
              description: '提高热量消散速度',
              maxLevel: 3,
              costPerLevel: 3,
              effectPerLevel: '+15%冷却效率'
            }
          ]
        }
      ]
    };
    
    // 获取玩家当前天赋等级
    const playerTalents = player.talentLevels || {};
    
    // 渲染天赋树分支
    const branchWidth = w / 3;
    const startY = 180;
    const talentHeight = 100;
    const talentSpacing = 20;
    
    talentTree.branches.forEach((branch, branchIndex) => {
      const branchX = branchIndex * branchWidth;
      
      // 分支标题
      ctx.fillStyle = branch.color;
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(branch.name, branchX + branchWidth / 2, startY - 30);
      
      // 渲染该分支的天赋
      branch.talents.forEach((talent, talentIndex) => {
        const talentY = startY + talentIndex * (talentHeight + talentSpacing);
        const talentX = branchX + branchWidth / 2;
        
        // 获取当前等级
        const currentLevel = playerTalents[talent.id] || 0;
        const canUpgrade = currentLevel < talent.maxLevel && (player.talentPoints || 0) >= talent.costPerLevel;
        
        // 天赋背景
        ctx.fillStyle = canUpgrade ? 'rgba(255, 255, 255, 0.1)' : 'rgba(100, 100, 100, 0.1)';
        ctx.beginPath();
        ctx.roundRect(talentX - 140, talentY, 280, talentHeight, 10);
        ctx.fill();
        
        // 边框
        ctx.strokeStyle = canUpgrade ? branch.color : '#666666';
        ctx.lineWidth = 2;
        ctx.strokeRect(talentX - 140, talentY, 280, talentHeight);
        
        // 天赋名称
        ctx.fillStyle = canUpgrade ? '#ffffff' : '#888888';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(talent.name, talentX, talentY + 20);
        
        // 天赋描述
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Arial';
        const descLines = this.wrapText(ctx, talent.description, 260);
        descLines.forEach((line, lineIndex) => {
          ctx.fillText(line, talentX, talentY + 40 + lineIndex * 16);
        });
        
        // 等级显示
        const levelText = `等级: ${currentLevel}/${talent.maxLevel}`;
        ctx.fillStyle = canUpgrade ? '#fbbf24' : '#888888';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(levelText, talentX - 60, talentY + talentHeight - 20);
        
        // 升级效果
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(talent.effectPerLevel, talentX + 40, talentY + talentHeight - 20);
        
        // 升级按钮（如果可升级）
        if (canUpgrade) {
          ctx.fillStyle = branch.color;
          ctx.font = 'bold 14px Arial';
          ctx.fillText(`升级 [${talent.costPerLevel}点]`, talentX, talentY + talentHeight - 40);
        }
      });
    });
  }

  /**
   * 渲染顶部状态栏
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param data - UI渲染数据
   */
  private renderTopBar(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    data: UIRenderData
  ): void {
    // 顶部状态栏渲染实现
    // TODO: 从原始引擎迁移顶部状态栏渲染逻辑
    console.log('渲染顶部状态栏', ctx, w, h, data);
  }

  /**
   * 渲染天气效果UI
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param weather - 天气类型
   * @param intensity - 天气强度
   */
  private renderWeatherUI(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    weather: WeatherType,
    intensity: number
  ): void {
    if (weather === 'none' || intensity <= 0) return;
    
    ctx.save();
    
    // 天气图标位置（右上角）
    const iconSize = 32;
    const iconX = w - iconSize - 20;
    const iconY = 60;
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(iconX - 5, iconY - 5, iconSize + 10, iconSize + 10, 6);
    ctx.fill();
    
    // 根据天气类型显示不同图标
    let icon = '☀️';
    let color = '#fbbf24';
    let label = '晴天';
    
    switch (weather) {
      case 'rain':
        icon = '🌧️';
        color = '#60a5fa';
        label = '降雨';
        break;
      case 'fog':
        icon = '🌫️';
        color = '#d1d5db';
        label = '浓雾';
        break;
      case 'wind':
        icon = '💨';
        color = '#a5b4fc';
        label = '强风';
        break;
      case 'heatwave':
        icon = '🔥';
        color = '#ef4444';
        label = '热浪';
        break;
    }
    
    // 天气图标
    ctx.fillStyle = color;
    ctx.font = `bold ${iconSize - 8}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, iconX + iconSize / 2, iconY + iconSize / 2);
    
    // 天气强度条
    const barWidth = 60;
    const barHeight = 6;
    const barX = iconX + (iconSize - barWidth) / 2;
    const barY = iconY + iconSize + 5;
    
    // 背景条
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // 强度条
    const fillWidth = barWidth * intensity;
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, fillWidth, barHeight);
    
    // 天气标签
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, iconX + iconSize / 2, barY + barHeight + 12);
    
    ctx.restore();
  }

  /**
   * 渲染紧急冷却库存
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param count - 紧急冷却库存数量
   */
  private renderEmergencyCoolInventory(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    count: number
  ): void {
    if (count <= 0) return;
    
    ctx.save();
    
    // 紧急冷却库存位置（左上角，金钱显示下方）
    const iconSize = 28;
    const iconX = 15;
    const iconY = 50;
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(iconX - 5, iconY - 5, iconSize + 10, iconSize + 10, 6);
    ctx.fill();
    
    // 紧急冷却图标
    ctx.fillStyle = '#60a5fa';
    ctx.font = `bold ${iconSize - 8}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('❄️', iconX + iconSize / 2, iconY + iconSize / 2);
    
    // 数量显示
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(count.toString(), iconX + iconSize / 2, iconY + iconSize + 15);
    
    ctx.restore();
  }

  /**
   * 渲染过热警告
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param player - 玩家信息
   */
  private renderHeatWarning(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    player: Player
  ): void {
    // 从原始引擎迁移的过热警告渲染逻辑
    const warnPulse = (Math.sin(Date.now() / 1000 * 12) + 1) * 0.5;
    ctx.save();
    ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + warnPulse * 0.15})`;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + warnPulse * 0.2})`;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 10;
    const secondsLeft = Math.ceil(player.heatWarningTimer);
    ctx.fillText(`⚠️ 过热警告 ${secondsLeft}秒`, w / 2, h / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * 渲染金钱显示
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param money - 金钱数量
   */


  /**
   * 渲染浮动文字特效
   * @param ctx - 画布上下文
   * @param floatingTexts - 浮动文字列表
   */
  private renderFloatingTexts(
    ctx: CanvasRenderingContext2D,
    floatingTexts: FloatingText[]
  ): void {
    for (const t of floatingTexts) {
      const alpha = t.life / t.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      const fontSize = Math.round(16 * (t.scale || 1));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3 * (t.scale || 1);
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * 渲染对话框
   * @param ctx - 画布上下文
   * @param w - 画布宽度
   * @param h - 画布高度
   * @param title - 标题
   * @param message - 消息内容
   * @param options - 选项列表
   */
  renderDialog(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    title: string,
    message: string,
    options: Array<{ text: string; action: () => void }>
  ): void {
    // 对话框渲染实现
    // TODO: 从原始引擎迁移对话框渲染逻辑
    console.log(ctx, w, h, title, message, options);
  }
}