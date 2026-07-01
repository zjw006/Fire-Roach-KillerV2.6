/**
 * @fileoverview 实体系统模块入口
 * @description 导出实体系统的所有管理器和工具函数
 */

import { EntityManager } from './EntityManager';
import { RoachManager } from './RoachManager';

export { EntityManager, RoachManager };

/**
 * 创建实体管理器
 * @param {number} width - 游戏区域宽度
 * @param {number} height - 游戏区域高度
 * @param {() => number} defenseLineY - 获取防御线Y坐标的函数
 * @returns {EntityManager} 实体管理器实例
 */
export function createEntityManager(
  width: number,
  height: number,
  defenseLineY: () => number
): EntityManager {
  return new EntityManager(width, height, defenseLineY);
}

/**
 * 创建蟑螂管理器
 * @param {number} width - 游戏区域宽度
 * @param {number} height - 游戏区域高度
 * @param {() => number} defenseLineY - 获取防御线Y坐标的函数
 * @returns {RoachManager} 蟑螂管理器实例
 */
export function createRoachManager(
  width: number,
  height: number,
  defenseLineY: () => number
): RoachManager {
  return new RoachManager(width, height, defenseLineY);
}

/**
 * 实体系统工具函数
 */
export const EntityUtils = {
  /**
   * 检查实体是否在屏幕内
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} width - 游戏区域宽度
   * @param {number} height - 游戏区域高度
   * @param {number} margin - 边距
   * @returns {boolean} 是否在屏幕内
   */
  isInScreen(x: number, y: number, width: number, height: number, margin: number = 100): boolean {
    return x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
  },

  /**
   * 计算两个实体之间的距离
   * @param {number} x1 - 第一个实体的X坐标
   * @param {number} y1 - 第一个实体的Y坐标
   * @param {number} x2 - 第二个实体的X坐标
   * @param {number} y2 - 第二个实体的Y坐标
   * @returns {number} 距离
   */
  distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * 检查两个实体是否碰撞
   * @param {number} x1 - 第一个实体的X坐标
   * @param {number} y1 - 第一个实体的Y坐标
   * @param {number} r1 - 第一个实体的半径
   * @param {number} x2 - 第二个实体的X坐标
   * @param {number} y2 - 第二个实体的Y坐标
   * @param {number} r2 - 第二个实体的半径
   * @returns {boolean} 是否碰撞
   */
  isColliding(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < r1 + r2;
  },

  /**
   * 生成随机位置
   * @param {number} minX - 最小X坐标
   * @param {number} maxX - 最大X坐标
   * @param {number} minY - 最小Y坐标
   * @param {number} maxY - 最大Y坐标
   * @returns {{x: number, y: number}} 随机位置
   */
  randomPosition(minX: number, maxX: number, minY: number, maxY: number): { x: number; y: number } {
    return {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY)
    };
  }
};