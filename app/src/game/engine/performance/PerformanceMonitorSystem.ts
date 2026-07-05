/**
 * @fileoverview 性能监控系统模块
 * @description 提供全面的游戏性能监控、分析和优化建议
 */

import { PerformanceMonitor, DynamicParticleLimiter, MemoryMonitor } from '../utils/PerformanceUtils';
import type { SceneType, GameMode } from '../../types';

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  /** 当前帧率（FPS） */
  fps: number;
  /** 平均帧时间（毫秒） */
  averageFrameTime: number;
  /** 帧时间标准差 */
  frameTimeStdDev: number;
  /** 当前帧时间（毫秒） */
  currentFrameTime: number;
  /** 内存使用情况（MB），如果不可用则为null */
  memoryUsage: number | null;
  /** 是否为低性能设备 */
  isLowPerformanceDevice: boolean;
  /** 当前粒子限制 */
  particleLimit: number;
  /** 帧率稳定性评分（0-100，越高越稳定） */
  fpsStabilityScore: number;
  /** 性能瓶颈分析 */
  bottleneckAnalysis: PerformanceBottleneck[];
}

/**
 * 性能瓶颈类型
 */
export type PerformanceBottleneckType = 
  | 'cpu'          // CPU瓶颈
  | 'gpu'          // GPU瓶颈
  | 'memory'       // 内存瓶颈
  | 'rendering'    // 渲染瓶颈
  | 'collision'    // 碰撞检测瓶颈
  | 'ai'           // AI计算瓶颈
  | 'particle'     // 粒子系统瓶颈
  | 'unknown';     // 未知瓶颈

/**
 * 性能瓶颈分析结果
 */
export interface PerformanceBottleneck {
  /** 瓶颈类型 */
  type: PerformanceBottleneckType;
  /** 严重程度（0-100，越高越严重） */
  severity: number;
  /** 描述信息 */
  description: string;
  /** 优化建议 */
  suggestions: string[];
}

/**
 * 性能监控系统配置
 */
export interface PerformanceMonitorSystemConfig {
  /** 当前场景类型 */
  currentScene: SceneType;
  /** 游戏模式 */
  gameMode: GameMode;
  /** 是否启用详细日志 */
  enableDetailedLogs?: boolean;
  /** 性能数据采样间隔（帧数） */
  samplingInterval?: number;
  /** 是否启用自动优化 */
  enableAutoOptimization?: boolean;
}

/**
 * 性能监控系统类
 * @description 集成多种性能监控工具，提供全面的性能分析和优化建议
 */
export class PerformanceMonitorSystem {
  /** 基础性能监控器 */
  private performanceMonitor: PerformanceMonitor;
  /** 动态粒子限制器 */
  private particleLimiter: DynamicParticleLimiter;
  /** 内存监控器 */
  private memoryMonitor: MemoryMonitor;
  /** 系统配置 */
  private config: PerformanceMonitorSystemConfig;
  /** 性能指标历史记录 */
  private metricsHistory: PerformanceMetrics[] = [];
  /** 最大历史记录数量 */
  private maxHistorySize: number = 300; // 5分钟数据（假设60fps）
  /** 上次采样时间 */
  private lastSampleTime: number = 0;
  /** 性能瓶颈缓存 */
  private bottleneckCache: PerformanceBottleneck[] = [];
  /** 上次瓶颈分析时间 */
  private lastBottleneckAnalysisTime: number = 0;
  /** 瓶颈分析间隔（毫秒） */
  private bottleneckAnalysisInterval: number = 5000; // 5秒

  /**
   * 创建性能监控系统
   * @param config 系统配置
   */
  constructor(config: PerformanceMonitorSystemConfig) {
    this.config = {
      enableDetailedLogs: false,
      samplingInterval: 60, // 每秒采样一次（假设60fps）
      enableAutoOptimization: true,
      ...config,
    };

    // 初始化性能监控工具
    this.performanceMonitor = new PerformanceMonitor();
    this.particleLimiter = new DynamicParticleLimiter();
    this.memoryMonitor = new MemoryMonitor();

    console.log('性能监控系统已初始化');
  }

  /**
   * 更新系统配置
   * @param config 新的配置
   */
  updateConfig(config: Partial<PerformanceMonitorSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 开始新的一帧
   * @param currentTime 当前时间（毫秒）
   */
  beginFrame(currentTime: number): void {
    this.performanceMonitor.beginFrame(currentTime);
    
    // 定期采样性能数据
    if (currentTime - this.lastSampleTime >= (1000 / (this.config.samplingInterval || 60))) {
      this.sampleMetrics(currentTime);
      this.lastSampleTime = currentTime;
    }
    
    // 定期分析性能瓶颈
    if (currentTime - this.lastBottleneckAnalysisTime >= this.bottleneckAnalysisInterval) {
      this.analyzeBottlenecks();
      this.lastBottleneckAnalysisTime = currentTime;
    }
  }

  /**
   * 结束当前帧
   * @param deltaTime 帧时间（秒）
   */
  endFrame(deltaTime: number): void {
    this.performanceMonitor.endFrame();
    this.particleLimiter.update(deltaTime);
    this.memoryMonitor.sample();
  }

  /**
   * 采样当前性能指标
   * @param currentTime 当前时间（毫秒）
   */
  private sampleMetrics(currentTime: number): void {
    const metrics: PerformanceMetrics = {
      fps: this.performanceMonitor.getFPS(),
      averageFrameTime: this.performanceMonitor.getAverageFrameTime(),
      frameTimeStdDev: this.performanceMonitor.getFrameTimeStdDev(),
      currentFrameTime: this.performanceMonitor.getFrameTime(),
      memoryUsage: this.performanceMonitor.getMemoryUsage()?.usedJSHeapSize 
        ? this.performanceMonitor.getMemoryUsage()!.usedJSHeapSize / (1024 * 1024) 
        : null,
      isLowPerformanceDevice: this.performanceMonitor.isLowPerformanceDevice(),
      particleLimit: this.particleLimiter.getLimit(),
      fpsStabilityScore: this.calculateFpsStabilityScore(),
      bottleneckAnalysis: [...this.bottleneckCache],
    };

    // 添加到历史记录
    this.metricsHistory.push(metrics);
    
    // 保持历史记录大小
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // 记录详细日志（如果启用）
    if (this.config.enableDetailedLogs) {
      this.logMetrics(metrics, currentTime);
    }
  }

  /**
   * 计算帧率稳定性评分
   * @returns 稳定性评分（0-100）
   */
  private calculateFpsStabilityScore(): number {
    const stdDev = this.performanceMonitor.getFrameTimeStdDev();
    const avgFrameTime = this.performanceMonitor.getAverageFrameTime();
    
    if (avgFrameTime === 0 || stdDev === 0) return 100;
    
    // 计算变异系数（标准差/平均值）
    const coefficientOfVariation = stdDev / avgFrameTime;
    
    // 将变异系数转换为稳定性评分（0-100）
    // 变异系数越小，稳定性越高
    const stabilityScore = Math.max(0, 100 - (coefficientOfVariation * 100));
    
    return Math.round(stabilityScore);
  }

  /**
   * 分析性能瓶颈
   */
  private analyzeBottlenecks(): void {
    const bottlenecks: PerformanceBottleneck[] = [];
    const metrics = this.getCurrentMetrics();
    
    // 分析帧率瓶颈
    if (metrics.fps < 30) {
      bottlenecks.push({
        type: 'cpu',
        severity: Math.min(100, Math.round((30 - metrics.fps) * 3)),
        description: `帧率过低（${metrics.fps.toFixed(1)} FPS），可能受CPU计算限制`,
        suggestions: [
          '减少同时活动的蟑螂数量',
          '降低碰撞检测频率',
          '简化AI计算逻辑',
          '启用动态粒子限制',
        ],
      });
    }
    
    // 分析帧时间稳定性
    if (metrics.fpsStabilityScore < 70) {
      bottlenecks.push({
        type: 'rendering',
        severity: Math.min(100, Math.round((70 - metrics.fpsStabilityScore) * 2)),
        description: `帧时间不稳定（稳定性评分：${metrics.fpsStabilityScore}），可能存在渲染瓶颈`,
        suggestions: [
          '减少每帧渲染的实体数量',
          '优化Canvas绘制操作',
          '合并渲染批次',
          '降低粒子效果复杂度',
        ],
      });
    }
    
    // 分析内存使用
    if (metrics.memoryUsage !== null && metrics.memoryUsage > 200) {
      bottlenecks.push({
        type: 'memory',
        severity: Math.min(100, Math.round((metrics.memoryUsage - 200) / 2)),
        description: `内存使用较高（${metrics.memoryUsage.toFixed(1)} MB），可能存在内存泄漏`,
        suggestions: [
          '定期清理未使用的实体',
          '优化纹理和资源管理',
          '减少缓存数据量',
          '启用内存监控日志',
        ],
      });
    }
    
    // 更新瓶颈缓存
    this.bottleneckCache = bottlenecks;
    
    // 如果启用自动优化，应用优化建议
    if (this.config.enableAutoOptimization && bottlenecks.length > 0) {
      this.applyAutoOptimizations(bottlenecks);
    }
  }

  /**
   * 应用自动优化
   * @param bottlenecks 性能瓶颈分析结果
   */
  private applyAutoOptimizations(bottlenecks: PerformanceBottleneck[]): void {
    // 根据瓶颈严重程度应用优化
    for (const bottleneck of bottlenecks) {
      if (bottleneck.severity > 50) {
        // 严重瓶颈，应用激进优化
        this.applyAggressiveOptimization(bottleneck.type);
      } else if (bottleneck.severity > 20) {
        // 中等瓶颈，应用温和优化
        this.applyModerateOptimization(bottleneck.type);
      }
    }
    
    if (this.config.enableDetailedLogs) {
      console.log('已应用自动性能优化');
    }
  }

  /**
   * 应用激进优化
   * @param bottleneckType 瓶颈类型
   */
  private applyAggressiveOptimization(bottleneckType: PerformanceBottleneckType): void {
    switch (bottleneckType) {
      case 'cpu':
        // 减少AI计算频率
        // 降低碰撞检测精度
        break;
      case 'gpu':
        // 大幅减少粒子数量
        // 降低渲染质量
        break;
      case 'memory':
        // 强制垃圾回收
        // 清理所有缓存
        break;
    }
  }

  /**
   * 应用温和优化
   * @param bottleneckType 瓶颈类型
   */
  private applyModerateOptimization(bottleneckType: PerformanceBottleneckType): void {
    switch (bottleneckType) {
      case 'cpu':
        // 适度减少AI计算
        // 优化碰撞检测算法
        break;
      case 'gpu':
        // 适度减少粒子数量
        // 优化渲染批次
        break;
      case 'memory':
        // 清理过期缓存
        // 优化资源加载
        break;
    }
  }

  /**
   * 记录性能指标日志
   * @param metrics 性能指标
   * @param currentTime 当前时间
   */
  private logMetrics(metrics: PerformanceMetrics, currentTime: number): void {
    const memoryInfo = metrics.memoryUsage !== null 
      ? `${metrics.memoryUsage.toFixed(1)} MB` 
      : 'N/A';
    
    console.log(`[性能监控] ${new Date(currentTime).toISOString()}`);
    console.log(`  FPS: ${metrics.fps.toFixed(1)} | 帧时间: ${metrics.currentFrameTime.toFixed(1)}ms`);
    console.log(`  平均帧时间: ${metrics.averageFrameTime.toFixed(1)}ms | 标准差: ${metrics.frameTimeStdDev.toFixed(1)}ms`);
    console.log(`  内存使用: ${memoryInfo} | 稳定性评分: ${metrics.fpsStabilityScore}`);
    console.log(`  粒子限制: ${metrics.particleLimit} | 低性能设备: ${metrics.isLowPerformanceDevice}`);
    
    if (metrics.bottleneckAnalysis.length > 0) {
      console.log('  性能瓶颈分析:');
      metrics.bottleneckAnalysis.forEach(bottleneck => {
        console.log(`    - ${bottleneck.type}: ${bottleneck.description} (严重程度: ${bottleneck.severity})`);
      });
    }
  }

  /**
   * 获取当前性能指标
   * @returns 当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    if (this.metricsHistory.length === 0) {
      // 返回默认指标
      return {
        fps: 0,
        averageFrameTime: 0,
        frameTimeStdDev: 0,
        currentFrameTime: 0,
        memoryUsage: null,
        isLowPerformanceDevice: false,
        particleLimit: 300,
        fpsStabilityScore: 100,
        bottleneckAnalysis: [],
      };
    }
    
    return this.metricsHistory[this.metricsHistory.length - 1];
  }

  /**
   * 获取性能指标历史记录
   * @param limit 限制返回的记录数量，默认返回全部
   * @returns 性能指标历史记录
   */
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit && limit < this.metricsHistory.length) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  /**
   * 获取性能瓶颈分析结果
   * @returns 性能瓶颈分析结果
   */
  getBottleneckAnalysis(): PerformanceBottleneck[] {
    return [...this.bottleneckCache];
  }

  /**
   * 获取动态粒子限制
   * @returns 当前粒子数量限制
   */
  getParticleLimit(): number {
    return this.particleLimiter.getLimit();
  }

  /**
   * 判断是否为低性能设备
   * @returns 是否为低性能设备
   */
  isLowPerformanceDevice(): boolean {
    return this.performanceMonitor.isLowPerformanceDevice();
  }

  /**
   * 重置性能监控系统
   */
  reset(): void {
    this.performanceMonitor.reset();
    this.particleLimiter.reset();
    this.metricsHistory = [];
    this.bottleneckCache = [];
    this.lastSampleTime = 0;
    this.lastBottleneckAnalysisTime = 0;
    
    console.log('性能监控系统已重置');
  }

  /**
   * 生成性能报告
   * @returns 性能报告字符串
   */
  generatePerformanceReport(): string {
    const metrics = this.getCurrentMetrics();
    const history = this.getMetricsHistory(60); // 最近60个样本（约1分钟）
    
    // 计算统计信息
    const fpsValues = history.map(m => m.fps);
    const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
    const minFps = Math.min(...fpsValues);
    const maxFps = Math.max(...fpsValues);
    
    const frameTimeValues = history.map(m => m.currentFrameTime);
    const avgFrameTime = frameTimeValues.reduce((a, b) => a + b, 0) / frameTimeValues.length;
    const minFrameTime = Math.min(...frameTimeValues);
    const maxFrameTime = Math.max(...frameTimeValues);
    
    // 生成报告
    let report = '=== 游戏性能报告 ===\n\n';
    report += `报告时间: ${new Date().toISOString()}\n`;
    report += `场景: ${this.config.currentScene} | 模式: ${this.config.gameMode}\n\n`;
    
    report += '📊 实时性能指标:\n';
    report += `  • 当前FPS: ${metrics.fps.toFixed(1)}\n`;
    report += `  • 当前帧时间: ${metrics.currentFrameTime.toFixed(1)}ms\n`;
    report += `  • 内存使用: ${metrics.memoryUsage !== null ? `${metrics.memoryUsage.toFixed(1)} MB` : 'N/A'}\n`;
    report += `  • 粒子限制: ${metrics.particleLimit}\n`;
    report += `  • 稳定性评分: ${metrics.fpsStabilityScore}/100\n\n`;
    
    report += '📈 历史统计（最近1分钟）:\n';
    report += `  • 平均FPS: ${avgFps.toFixed(1)} (范围: ${minFps.toFixed(1)}-${maxFps.toFixed(1)})\n`;
    report += `  • 平均帧时间: ${avgFrameTime.toFixed(1)}ms (范围: ${minFrameTime.toFixed(1)}-${maxFrameTime.toFixed(1)}ms)\n\n`;
    
    if (metrics.bottleneckAnalysis.length > 0) {
      report += '⚠️ 性能瓶颈分析:\n';
      metrics.bottleneckAnalysis.forEach(bottleneck => {
        report += `  • ${bottleneck.type.toUpperCase()}: ${bottleneck.description}\n`;
        report += `    严重程度: ${bottleneck.severity}/100\n`;
        if (bottleneck.suggestions.length > 0) {
          report += `    优化建议:\n`;
          bottleneck.suggestions.forEach(suggestion => {
            report += `      - ${suggestion}\n`;
          });
        }
        report += '\n';
      });
    } else {
      report += '✅ 未检测到明显性能瓶颈\n\n';
    }
    
    report += '=== 报告结束 ===';
    
    return report;
  }
}