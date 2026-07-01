/**
 * @fileoverview 渲染系统模块入口文件
 * @description 导出渲染管理器及相关工具函数，负责游戏画面的绘制与渲染效果管理
 */

import { RenderManager } from './RenderManager';

export { RenderManager };

/**
 * 创建渲染管理器实例
 * @param config - 渲染管理器配置
 * @returns 渲染管理器实例
 */
export function createRenderManager(config: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  getDefenseLineY: () => number;
}): RenderManager {
  return new RenderManager(config);
}