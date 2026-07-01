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
    // 菜单渲染实现
    // TODO: 从原始引擎迁移菜单渲染逻辑
    // 暂时添加参数使用以避免TypeScript警告
    console.log(ctx, w, h, data);
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
    const { player, economy, wave, gameMode } = data;
    
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
    // 商店HUD渲染实现
    // TODO: 从原始引擎迁移商店HUD渲染逻辑
    console.log('渲染商店HUD', ctx, w, h, data);
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
    // 升级HUD渲染实现
    // TODO: 从原始引擎迁移升级HUD渲染逻辑
    console.log('渲染升级HUD', ctx, w, h, data);
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