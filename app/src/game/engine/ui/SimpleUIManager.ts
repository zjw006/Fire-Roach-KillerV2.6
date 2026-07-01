/**
 * @fileoverview 简化UI管理器
 * @description 提供基本的UI渲染功能，用于NewGameEngine的测试和演示
 */

import { GameState, GameMode } from '../../types';
import type { 
  SceneType, 
  Player,
  Economy
} from '../../types';

/**
 * 简化UI管理器配置接口
 */
export interface SimpleUIManagerConfig {
  /** 画布上下文 */
  ctx: CanvasRenderingContext2D;
  /** 画布宽度 */
  width: number;
  /** 画布高度 */
  height: number;
}

/**
 * 简化UI渲染数据接口
 */
export interface SimpleUIRenderData {
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
  /** 当前波次 */
  wave: number;
  /** 防御生命值 */
  defenseHp: number;
  /** 最大防御生命值 */
  maxDefenseHp: number;
  /** 时间（用于动画） */
  time: number;
}

/**
 * 简化UI管理器类
 * @description 提供基本的UI渲染功能
 */
export class SimpleUIManager {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  /**
   * 构造函数
   * @param config - UI管理器配置
   */
  constructor(config: SimpleUIManagerConfig) {
    this.ctx = config.ctx;
    this.width = config.width;
    this.height = config.height;
  }

  /**
   * 主渲染方法
   * @param data - UI渲染数据
   */
  render(data: SimpleUIRenderData): void {
    // 保存当前上下文状态
    this.ctx.save();
    
    // 根据游戏状态渲染不同的UI
    switch (data.gameState) {
      case GameState.MENU:
        this.renderMenu(data);
        break;
      case GameState.PLAYING:
        this.renderHUD(data);
        break;
      case GameState.PAUSED:
        this.renderPauseMenu(data);
        break;
      case GameState.GAME_OVER:
        this.renderGameOver(data);
        break;
      default:
        this.renderDefaultUI(data);
        break;
    }
    
    // 恢复上下文状态
    this.ctx.restore();
  }

  /**
   * 渲染菜单界面
   * @param data - UI渲染数据
   */
  private renderMenu(data: SimpleUIRenderData): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    
    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);
    
    // 游戏标题
    ctx.fillStyle = '#ff6b35';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('烈焰除蟑', w / 2, h / 3);
    
    // 副标题
    ctx.fillStyle = '#f7c59f';
    ctx.font = 'bold 30px Arial';
    ctx.fillText('火线守卫', w / 2, h / 3 + 70);
    
    // 游戏模式显示
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText(`模式: ${data.gameMode}`, w / 2, h / 2);
    
    // 难度显示
    ctx.fillText(`难度: ${data.difficulty}`, w / 2, h / 2 + 40);
    
    // 场景显示
    ctx.fillText(`场景: ${data.currentScene}`, w / 2, h / 2 + 80);
    
    // 提示信息
    ctx.fillStyle = '#cccccc';
    ctx.font = '18px Arial';
    ctx.fillText('按"启动引擎"按钮开始游戏', w / 2, h * 2 / 3);
  }

  /**
   * 渲染游戏HUD
   * @param data - UI渲染数据
   */
  private renderHUD(data: SimpleUIRenderData): void {
    // 左上角：波次信息
    this.renderWaveInfo(data);
    
    // 右上角：金钱信息
    this.renderMoneyInfo(data);
    
    // 底部：玩家状态
    this.renderPlayerStatus(data);
    
    // 底部中间：防御生命值
    this.renderDefenseHP(data);
  }

  /**
   * 渲染波次信息
   * @param data - UI渲染数据
   */
  private renderWaveInfo(data: SimpleUIRenderData): void {
    const ctx = this.ctx;
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(20, 20, 150, 50, 8);
    ctx.fill();
    
    // 波次图标
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('波次', 40, 45);
    
    // 波次数值
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'right';
    const waveText = data.gameMode === GameMode.ENDLESS ? `${data.wave}` : `${data.wave}`;
    ctx.fillText(waveText, 150, 50);
  }

  /**
   * 渲染金钱信息
   * @param data - UI渲染数据
   */
  private renderMoneyInfo(data: SimpleUIRenderData): void {
    const ctx = this.ctx;
    const w = this.width;
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(w - 170, 20, 150, 50, 8);
    ctx.fill();
    
    // 金钱图标
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('金钱', w - 150, 45);
    
    // 金钱数值
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`¥${data.economy.money}`, w - 30, 50);
  }

  /**
   * 渲染玩家状态
   * @param data - UI渲染数据
   */
  private renderPlayerStatus(data: SimpleUIRenderData): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    
    // 底部状态栏背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, h - 100, w, 100);
    
    // 燃料条
    this.renderBar(
      20, h - 80, w - 40, 20,
      data.player.gas, data.player.maxGas,
      '#3b82f6', '#1e40af', '燃料'
    );
    
    // 热量条
    this.renderBar(
      20, h - 50, w - 40, 20,
      data.player.heat, data.player.maxHeat,
      '#ef4444', '#991b1b', '热量'
    );
    
    // 当前武器
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`武器: ${data.player.currentWeapon}`, 20, h - 20);
  }

  /**
   * 渲染防御生命值
   * @param data - UI渲染数据
   */
  private renderDefenseHP(data: SimpleUIRenderData): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    
    // 防御生命值条
    const barWidth = 300;
    const barHeight = 30;
    const barX = (w - barWidth) / 2;
    const barY = h - 150;
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 15);
    ctx.fill();
    
    // 填充（根据生命值比例）
    const fillWidth = (data.defenseHp / data.maxDefenseHp) * barWidth;
    const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
    gradient.addColorStop(0, '#10b981');
    gradient.addColorStop(0.5, '#059669');
    gradient.addColorStop(1, '#047857');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillWidth, barHeight, 15);
    ctx.fill();
    
    // 文字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `防御: ${data.defenseHp}/${data.maxDefenseHp}`,
      w / 2,
      barY + barHeight / 2
    );
  }

  /**
   * 渲染进度条
   * @param x - X坐标
   * @param y - Y坐标
   * @param width - 宽度
   * @param height - 高度
   * @param current - 当前值
   * @param max - 最大值
   * @param fillColor - 填充颜色
   * @param bgColor - 背景颜色
   * @param label - 标签
   */
  private renderBar(
    x: number, y: number, width: number, height: number,
    current: number, max: number,
    fillColor: string, bgColor: string,
    label: string
  ): void {
    const ctx = this.ctx;
    
    // 背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, width, height);
    
    // 填充
    const fillWidth = (current / max) * width;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, fillWidth, height);
    
    // 边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // 标签
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 5, y + height / 2 + 5);
    
    // 数值
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(current)}/${max}`, x + width - 5, y + height / 2 + 5);
  }

  /**
   * 渲染暂停菜单
   * @param data - UI渲染数据
   */
  private renderPauseMenu(data: SimpleUIRenderData): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    
    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);
    
    // 标题
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('游戏暂停', w / 2, h / 3);
    
    // 提示信息
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText('按"启动引擎"按钮继续游戏', w / 2, h / 2);
    
    // 当前游戏信息
    ctx.fillStyle = '#cccccc';
    ctx.font = '20px Arial';
    ctx.fillText(`波次: ${data.wave}`, w / 2, h / 2 + 60);
    ctx.fillText(`金钱: ¥${data.economy.money}`, w / 2, h / 2 + 90);
  }

  /**
   * 渲染游戏结束界面
   * @param data - UI渲染数据
   */
  private renderGameOver(data: SimpleUIRenderData): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    
    // 半透明红色背景
    ctx.fillStyle = 'rgba(220, 38, 38, 0.8)';
    ctx.fillRect(0, 0, w, h);
    
    // 游戏结束标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('游戏结束', w / 2, h / 3);
    
    // 最终统计
    ctx.font = '28px Arial';
    ctx.fillText(`最终波次: ${data.wave}`, w / 2, h / 2);
    ctx.fillText(`总击杀数: ${data.economy.totalKills}`, w / 2, h / 2 + 40);
    ctx.fillText(`总金钱: ¥${data.economy.money}`, w / 2, h / 2 + 80);
    
    // 提示信息
    ctx.fillStyle = '#fbbf24';
    ctx.font = '22px Arial';
    ctx.fillText('按"重置引擎"按钮重新开始', w / 2, h * 2 / 3);
  }

  /**
   * 渲染默认UI
   * @param data - UI渲染数据
   */
  private renderDefaultUI(data: SimpleUIRenderData): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    
    // 简单背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);
    
    // 状态显示
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`游戏状态: ${data.gameState}`, w / 2, h / 2);
    
    // 基本信息
    ctx.font = '24px Arial';
    ctx.fillText(`模式: ${data.gameMode} | 难度: ${data.difficulty}`, w / 2, h / 2 + 50);
  }
}