/**
 * @fileoverview UI系统模块入口
 * @description 导出UI管理器及相关工具函数
 */

export * from './UIManager';

/**
 * 创建UI管理器实例
 * @param config - UI管理器配置
 * @returns UI管理器实例
 */
export function createUIManager(config: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  audio?: any;
}) {
  // 动态导入UIManager类
  const { UIManager } = require('./UIManager');
  return new UIManager(config);
}