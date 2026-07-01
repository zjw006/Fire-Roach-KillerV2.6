/**
 * @fileoverview 数学工具模块
 * @description 提供游戏开发中常用的数学函数和工具
 */

/**
 * 二维向量接口
 */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * 限制数值在指定范围内
 * @param value 要限制的值
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的值
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 线性插值
 * @param a 起始值
 * @param b 结束值
 * @param t 插值系数 (0-1)
 * @returns 插值结果
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 计算两点之间的欧几里得距离
 * @param x1 第一个点的x坐标
 * @param y1 第一个点的y坐标
 * @param x2 第二个点的x坐标
 * @param y2 第二个点的y坐标
 * @returns 两点之间的距离
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算两点之间的角度（弧度）
 * @param x1 第一个点的x坐标
 * @param y1 第一个点的y坐标
 * @param x2 第二个点的x坐标
 * @param y2 第二个点的y坐标
 * @returns 从点1指向点2的角度（弧度）
 */
export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * 规范化角度到 [-π, π] 范围内
 * @param angle 角度（弧度）
 * @returns 规范化后的角度
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % (Math.PI * 2);
  if (normalized > Math.PI) normalized -= Math.PI * 2;
  if (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

/**
 * 角度差值（最短路径）
 * @param a 角度a（弧度）
 * @param b 角度b（弧度）
 * @returns 角度差值（弧度，-π到π）
 */
export function angleDifference(a: number, b: number): number {
  const diff = normalizeAngle(b - a);
  return diff;
}

/**
 * 随机整数范围
 * @param min 最小值（包含）
 * @param max 最大值（包含）
 * @returns 随机整数
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 随机浮点数范围
 * @param min 最小值
 * @param max 最大值
 * @returns 随机浮点数
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * 随机布尔值
 * @param probability 为true的概率（0-1）
 * @returns 随机布尔值
 */
export function randomBool(probability = 0.5): boolean {
  return Math.random() < probability;
}

/**
 * 向量归一化
 * @param x x分量
 * @param y y分量
 * @returns 归一化后的向量
 */
export function normalizeVector(x: number, y: number): Vec2 {
  const length = Math.sqrt(x * x + y * y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

/**
 * 向量点积
 * @param x1 第一个向量的x分量
 * @param y1 第一个向量的y分量
 * @param x2 第二个向量的x分量
 * @param y2 第二个向量的y分量
 * @returns 点积结果
 */
export function dotProduct(x1: number, y1: number, x2: number, y2: number): number {
  return x1 * x2 + y1 * y2;
}

/**
 * 向量叉积（二维叉积返回标量）
 * @param x1 第一个向量的x分量
 * @param y1 第一个向量的y分量
 * @param x2 第二个向量的x分量
 * @param y2 第二个向量的y分量
 * @returns 叉积结果（标量）
 */
export function crossProduct(x1: number, y1: number, x2: number, y2: number): number {
  return x1 * y2 - y1 * x2;
}

/**
 * 贝塞尔曲线插值（二次）
 * @param p0 起点
 * @param p1 控制点
 * @param p2 终点
 * @param t 插值系数 (0-1)
 * @returns 插值点
 */
export function quadraticBezier(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  
  return {
    x: uu * p0.x + 2 * u * t * p1.x + tt * p2.x,
    y: uu * p0.y + 2 * u * t * p1.y + tt * p2.y
  };
}

/**
 * 检查点是否在矩形内
 * @param x 点的x坐标
 * @param y 点的y坐标
 * @param rectX 矩形左上角x坐标
 * @param rectY 矩形左上角y坐标
 * @param rectWidth 矩形宽度
 * @param rectHeight 矩形高度
 * @returns 是否在矩形内
 */
export function pointInRect(
  x: number, 
  y: number, 
  rectX: number, 
  rectY: number, 
  rectWidth: number, 
  rectHeight: number
): boolean {
  return x >= rectX && x <= rectX + rectWidth && y >= rectY && y <= rectY + rectHeight;
}

/**
 * 映射数值范围
 * @param value 原始值
 * @param fromMin 原始范围最小值
 * @param fromMax 原始范围最大值
 * @param toMin 目标范围最小值
 * @param toMax 目标范围最大值
 * @returns 映射后的值
 */
export function mapRange(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
): number {
  return (value - fromMin) * (toMax - toMin) / (fromMax - fromMin) + toMin;
}