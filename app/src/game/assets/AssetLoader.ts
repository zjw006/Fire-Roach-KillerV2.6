import type { SceneType } from '../types';

/**
 * @fileoverview 统一图片资源预加载器。
 *
 * 设计目标：
 * - 清单化：资源用声明式 AssetEntry 描述，调用方不再手写逐条 new Image()。
 * - 分级加载：`scenes` 省略/为空视为 global（首屏 critical）资源；
 *   标注 `scenes` 的资源延迟到进入对应场景时按需加载（场景懒加载）。
 * - 幂等缓存：同一 key 只加载一次，重复调用 loadScene/loadGlobal 不会重复请求。
 * - 进度可观测：onProgress 回调（loaded/total），供未来加载屏使用（当前仅后台预加载）。
 * - 失败不阻塞：单资源失败仅告警并跳过，渲染侧有程序化回退兜底。
 *
 * 注：音频由 AudioManager 独立管理，场景 BGM 已通过 switchBGMForScene 按需懒加载，
 * 故本加载器仅负责图片，避免与音频状态管理重复。
 */

export interface AssetEntry {
  /** 唯一键，用于去重与缓存；惯例：engine 字段名（如 'roachJockImg'） */
  key: string;
  /** 资源 URL */
  url: string;
  /** 归属场景数组；省略/空数组 = global（首屏必载） */
  scenes?: SceneType[];
  /** 加载完成后回填（如把结果赋给 engine 字段） */
  apply?: (img: HTMLImageElement) => void;
}

export interface AssetProgress {
  loaded: number;
  total: number;
}

export class AssetLoader {
  private entries: AssetEntry[] = [];
  private cache = new Map<string, HTMLImageElement>();
  private loadedKeys = new Set<string>();
  private loadingKeys = new Set<string>();

  /** 进度回调（loaded/total，基于已注册条目总数） */
  onProgress?: (p: AssetProgress) => void;

  /** 注册一批资源清单 */
  register(entries: AssetEntry[]): void {
    this.entries.push(...entries);
  }

  /** 按 key 取已加载资源，未加载返回 null（渲染侧据此走回退） */
  get(key: string): HTMLImageElement | null {
    return this.cache.get(key) ?? null;
  }

  /** key 是否已缓存 */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** 加载全部 global 资源（scenes 为空） */
  async loadGlobal(): Promise<void> {
    await this.loadWhere((e) => !e.scenes || e.scenes.length === 0);
  }

  /** 懒加载某场景资源（幂等） */
  async loadScene(scene: SceneType): Promise<void> {
    await this.loadWhere((e) => !!e.scenes && e.scenes.length > 0 && e.scenes.includes(scene));
  }

  private async loadWhere(filter: (e: AssetEntry) => boolean): Promise<void> {
    const targets = this.entries.filter(filter);
    await Promise.all(targets.map((e) => this.loadEntry(e)));
  }

  private async loadEntry(entry: AssetEntry): Promise<void> {
    if (this.loadedKeys.has(entry.key) || this.loadingKeys.has(entry.key)) return;
    this.loadingKeys.add(entry.key);
    try {
      const img = await this.loadImage(entry.url);
      if (img) {
        this.cache.set(entry.key, img);
        entry.apply?.(img);
        this.loadedKeys.add(entry.key);
        this.emitProgress();
      }
    } catch {
      console.warn(`[AssetLoader] load failed: ${entry.key} → ${entry.url}`);
    } finally {
      this.loadingKeys.delete(entry.key);
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`[AssetLoader] image load failed: ${url}`);
        resolve(null);
      };
      img.src = url;
    });
  }

  private emitProgress(): void {
    this.onProgress?.({ loaded: this.loadedKeys.size, total: this.entries.length });
  }
}