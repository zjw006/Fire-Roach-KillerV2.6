/**
 * @fileoverview 性能工具模块
 * @description 提供游戏性能监控和优化工具
 */

/**
 * 性能监控器类
 * @description 监控帧率、帧时间等性能指标
 */
export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private maxSamples: number;
  private lastFrameTime: number = 0;
  private fps: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  
  /**
   * 创建性能监控器
   * @param maxSamples 最大采样数，默认60（1秒的帧数）
   */
  constructor(maxSamples: number = 60) {
    this.maxSamples = maxSamples;
  }
  
  /**
   * 开始新的一帧
   * @param currentTime 当前时间（毫秒）
   */
  beginFrame(currentTime: number): void {
    if (this.lastFrameTime > 0) {
      const frameTime = currentTime - this.lastFrameTime;
      this.frameTimes.push(frameTime);
      
      // 保持采样数量不超过最大值
      if (this.frameTimes.length > this.maxSamples) {
        this.frameTimes.shift();
      }
      
      // 更新FPS
      this.frameCount++;
      const now = Date.now();
      if (now - this.lastFpsUpdate >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
        this.frameCount = 0;
        this.lastFpsUpdate = now;
      }
    }
    this.lastFrameTime = currentTime;
  }
  
  /**
   * 获取平均帧时间（毫秒）
   * @returns 平均帧时间
   */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return sum / this.frameTimes.length;
  }
  
  /**
   * 获取当前FPS
   * @returns 当前帧率
   */
  getFPS(): number {
    return this.fps;
  }
  
  /**
   * 获取帧时间标准差
   * @returns 帧时间标准差
   */
  getFrameTimeStdDev(): number {
    if (this.frameTimes.length < 2) return 0;
    
    const mean = this.getAverageFrameTime();
    const squaredDiffs = this.frameTimes.map(time => {
      const diff = time - mean;
      return diff * diff;
    });
    
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return Math.sqrt(variance);
  }
  
  /**
   * 判断是否低性能设备
   * @param threshold 阈值，默认33ms（约30fps）
   * @returns 是否为低性能设备
   */
  isLowPerformanceDevice(threshold: number = 33): boolean {
    return this.getAverageFrameTime() > threshold;
  }
  
  /**
   * 结束当前帧
   */
  endFrame(): void {
    // 可以在这里添加帧结束时的处理逻辑
    // 例如：记录帧结束时间、计算帧时间等
  }
  
  /**
   * 获取当前帧时间（毫秒）
   * @returns 当前帧时间
   */
  getFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes[this.frameTimes.length - 1];
  }
  
  /**
   * 获取内存使用情况
   * @returns 内存使用信息或null（如果浏览器不支持）
   */
  getMemoryUsage(): { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null {
    if ('memory' in performance && (performance as any).memory) {
      return (performance as any).memory;
    }
    return null;
  }
  
  /**
   * 重置监控器
   */
  reset(): void {
    this.frameTimes = [];
    this.lastFrameTime = 0;
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsUpdate = Date.now();
  }
}

/**
 * 动态粒子限制器
 * @description 根据设备性能动态调整粒子数量限制
 */
export class DynamicParticleLimiter {
  private particleLimit: number;
  private frameTimeSamples: number[] = [];
  private maxSamples: number;
  private isLowPerfDevice: boolean = false;
  private checkInterval: number;
  private framesSinceLastCheck: number = 0;
  
  /**
   * 创建动态粒子限制器
   * @param initialLimit 初始粒子限制，默认300
   * @param maxSamples 最大采样数，默认30
   * @param checkInterval 检查间隔（帧数），默认30
   */
  constructor(
    initialLimit: number = 300,
    maxSamples: number = 30,
    checkInterval: number = 30
  ) {
    this.particleLimit = initialLimit;
    this.maxSamples = maxSamples;
    this.checkInterval = checkInterval;
    
    // 尝试从本地存储加载之前检测到的限制
    this.loadFromLocalStorage();
  }
  
  /**
   * 更新帧时间
   * @param deltaTime 帧时间（秒）
   */
  update(deltaTime: number): void {
    const frameTimeMs = deltaTime * 1000;
    this.frameTimeSamples.push(frameTimeMs);
    
    if (this.frameTimeSamples.length > this.maxSamples) {
      this.frameTimeSamples.shift();
    }
    
    this.framesSinceLastCheck++;
    if (this.framesSinceLastCheck >= this.checkInterval) {
      this.adjustLimit();
      this.framesSinceLastCheck = 0;
    }
  }
  
  /**
   * 获取当前粒子限制
   * @returns 粒子数量限制
   */
  getLimit(): number {
    return this.particleLimit;
  }
  
  /**
   * 判断是否为低性能设备
   * @returns 是否为低性能设备
   */
  isLowPerformanceDevice(): boolean {
    return this.isLowPerfDevice;
  }
  
  /**
   * 根据性能调整粒子限制
   */
  private adjustLimit(): void {
    if (this.frameTimeSamples.length < 10) return;
    
    const avgFrameTime = this.frameTimeSamples.reduce((a, b) => a + b, 0) / this.frameTimeSamples.length;
    
    if (avgFrameTime > 33) {
      // 帧时间 > 33ms（< 30fps）：低端设备，减少到150
      this.particleLimit = 150;
      this.isLowPerfDevice = true;
    } else if (avgFrameTime > 25) {
      // 帧时间 25-33ms（30-40fps）：中等设备，减少到200
      this.particleLimit = 200;
      this.isLowPerfDevice = false;
    } else if (avgFrameTime < 16) {
      // 帧时间 < 16ms（> 60fps）：高端设备，增加到400
      this.particleLimit = Math.min(400, this.particleLimit + 1);
      this.isLowPerfDevice = false;
    } else {
      // 帧时间 16-25ms（40-60fps）：良好性能，保持当前限制
      this.isLowPerfDevice = false;
    }
    
    // 保存到本地存储
    this.saveToLocalStorage();
  }
  
  /**
   * 从本地存储加载粒子限制
   */
  private loadFromLocalStorage(): void {
    try {
      const savedLimit = localStorage.getItem('roach_blaster_particle_limit');
      if (savedLimit) {
        this.particleLimit = parseInt(savedLimit, 10);
        this.isLowPerfDevice = this.particleLimit <= 200;
      }
    } catch (error) {
      // 忽略本地存储错误
      console.warn('Failed to load particle limit from localStorage:', error);
    }
  }
  
  /**
   * 保存粒子限制到本地存储
   */
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('roach_blaster_particle_limit', this.particleLimit.toString());
    } catch (error) {
      // 忽略本地存储错误
      console.warn('Failed to save particle limit to localStorage:', error);
    }
  }
  
  /**
   * 重置限制器
   */
  reset(): void {
    this.particleLimit = 300;
    this.frameTimeSamples = [];
    this.isLowPerfDevice = false;
    this.framesSinceLastCheck = 0;
  }
}

/**
 * 内存使用监控器
 * @description 监控内存使用情况（注意：浏览器环境限制较多）
 */
export class MemoryMonitor {
  private samples: number[] = [];
  private maxSamples: number;
  
  constructor(maxSamples: number = 60) {
    this.maxSamples = maxSamples;
  }
  
  /**
   * 采样当前内存使用情况
   * @returns 内存使用量（MB），如果无法获取则返回null
   */
  sample(): number | null {
    if ('memory' in performance) {
      // @ts-ignore - performance.memory 是非标准API
      const memoryInfo = (performance as any).memory;
      const usedMB = memoryInfo.usedJSHeapSize / (1024 * 1024);
      
      this.samples.push(usedMB);
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }
      
      return usedMB;
    }
    return null;
  }
  
  /**
   * 获取平均内存使用量（MB）
   * @returns 平均内存使用量，如果无法获取则返回null
   */
  getAverageMemoryUsage(): number | null {
    if (this.samples.length === 0) return null;
    const sum = this.samples.reduce((a, b) => a + b, 0);
    return sum / this.samples.length;
  }
  
  /**
   * 判断内存使用是否过高
   * @param threshold 阈值（MB），默认100
   * @returns 是否内存使用过高
   */
  isMemoryUsageHigh(threshold: number = 100): boolean {
    const avgUsage = this.getAverageMemoryUsage();
    return avgUsage !== null && avgUsage > threshold;
  }
  
  /**
   * 重置监控器
   */
  reset(): void {
    this.samples = [];
  }
}

/**
 * 性能优化工具函数
 */
export class PerformanceOptimizer {
  /**
   * 批量处理数组，避免单帧处理过多元素
   * @param array 要处理的数组
   * @param processFn 处理函数
   * @param maxPerFrame 每帧最大处理数量，默认50
   * @param startIndex 开始索引，默认0
   * @returns 是否处理完成
   */
  static processArrayInBatches<T>(
    array: T[],
    processFn: (item: T, index: number) => void,
    maxPerFrame: number = 50,
    startIndex: number = 0
  ): boolean {
    const endIndex = Math.min(startIndex + maxPerFrame, array.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      processFn(array[i], i);
    }
    
    return endIndex >= array.length;
  }
  
  /**
   * 延迟执行函数，避免阻塞主线程
   * @param fn 要执行的函数
   * @param timeout 延迟时间（毫秒），默认0
   */
  static defer(fn: () => void, timeout: number = 0): void {
    setTimeout(fn, timeout);
  }
  
  /**
   * 使用 requestAnimationFrame 进行节流
   * @param fn 要执行的函数
   * @returns 节流后的函数
   */
  static throttleByAnimationFrame(fn: () => void): () => void {
    let scheduled = false;
    
    return () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
          fn();
          scheduled = false;
        });
      }
    };
  }
  
  /**
   * 计算合适的更新间隔，基于当前帧率
   * @param targetFPS 目标帧率，默认60
   * @param currentFPS 当前帧率
   * @returns 建议的更新间隔（秒）
   */
  static calculateOptimalUpdateInterval(
    targetFPS: number = 60,
    currentFPS: number
  ): number {
    if (currentFPS <= 0) return 1 / targetFPS;
    
    // 如果当前帧率低于目标帧率，增加更新间隔以减少负载
    if (currentFPS < targetFPS * 0.8) {
      return 1 / (currentFPS * 0.8);
    }
    
    return 1 / targetFPS;
  }
}