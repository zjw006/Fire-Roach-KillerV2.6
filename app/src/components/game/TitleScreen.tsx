/**
 * @fileoverview 标题屏幕（LOADING）组件 — 游戏启动时播放统一的 LOADING 动画视频
 * （背景 + 进度条合为一段 540×960 / ~5s 的 MP4），动画播完且资源就绪后点击或按键淡出进入游戏。
 *
 * 实现方式：视频以静音内联自动播放，<video> 硬件顺序解码（不做逐帧 seek，避免拖动抖动、最省电流畅）；
 * 播放进度即加载进度（资源为本地打包，加载耗时≈视频时长），视频 'ended' 且资源就绪 → 允许进入。
 * 视频未就绪时用 poster（loading_title.jpg）兜底首帧；视频加载失败时回退为静帧 + CSS 进度条。
 *
 * v2.6 适配：画面严格按 9:16（540×960 逻辑坐标）居中显示，等比缩放，超出区域纯黑填充；无叠加文字。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { AudioManager } from '@/game/audio';

const LOADING_VIDEO = '/assets/UI/loading_anim.mp4';
const LOADING_POSTER = '/comics/loading_title.jpg';

interface TitleScreenProps {
  onStart: () => void;
  audioMuted: boolean;
  onToggleMute: () => void;
  audio?: AudioManager;
  /** 游戏画布在视口中的位置/尺寸：标题画面按 540×960(9:16) 逻辑坐标居中时用于对齐与缩放 */
  canvasBounds?: { left: number; top: number; width: number; height: number } | null;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  audioMuted,
  onToggleMute, audio, canvasBounds}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);   // 已可播放（canplay）
  const [videoFailed, setVideoFailed] = useState(false); // 视频加载失败 → 回退静帧
  const [fadingOut, setFadingOut] = useState(false);

  // 加载进度（0..1）：视频模式下由播放时间驱动；回退模式下由 rAF 计时驱动
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadComplete, setLoadComplete] = useState(false);
  const rafRef = useRef<number>(0);

  /** 资源就绪标志：本地打包资源，挂载后即视为就绪（保留扩展点供未来真实预加载对接） */
  const assetsReadyRef = useRef(false);
  const [assetsReady, setAssetsReady] = useState(false);

  // 资源就绪（本地资源，下一帧即就绪）
  useEffect(() => {
    const id = window.setTimeout(() => { assetsReadyRef.current = true; setAssetsReady(true); }, 0);
    return () => window.clearTimeout(id);
  }, []);

  /** 尝试静音内联自动播放（muted+playsInline 允许自动播放）；带看门狗，任何原因暂停/被节流都自动恢复 */
  useEffect(() => {
    if (videoFailed) return;
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => {
      if (v.ended) return;
      const p = v.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // 自动播放被拦截（极少见，因已静音）：任意首次手势后重试
          const resume = () => { v.play().catch(() => {}); };
          window.addEventListener('pointerdown', resume, { once: true });
        });
      }
    };
    // 就绪即播（媒体事件在 JSX 里也会调 tryPlay，这里覆盖 effect 注册时机晚于事件的情况）
    if (v.readyState >= 2) tryPlay();
    else {
      v.addEventListener('canplay', tryPlay, { once: true });
      v.addEventListener('loadeddata', tryPlay, { once: true });
    }
    // 看门狗：页面可见、视频就绪但被暂停（后台标签节流/自动播放延迟/stall）时自动恢复播放
    const watchdog = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !v.ended && v.paused && v.readyState >= 2) {
        tryPlay();
      }
    }, 400);
    // 回到前台时立即恢复
    const onVis = () => { if (!document.hidden && !v.ended && v.readyState >= 2) tryPlay(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(watchdog);
      document.removeEventListener('visibilitychange', onVis);
      v.removeEventListener('canplay', tryPlay);
      v.removeEventListener('loadeddata', tryPlay);
    };
  }, [videoFailed]);

  /** 视频播放进度 → loadProgress；ended 且资源就绪 → 完成 */
  useEffect(() => {
    if (videoFailed) return;
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const dur = v.duration || 5.08;
      setLoadProgress(Math.min(v.currentTime / dur, 1));
      // 保险：播放到最后一帧（个别浏览器可能漏发 ended）且资源就绪 → 完成
      if (v.currentTime >= dur - 0.05 && assetsReadyRef.current) setLoadComplete(true);
    };
    const onEnded = () => {
      setLoadProgress(1);
      if (assetsReadyRef.current) setLoadComplete(true);
      else {
        // 视频播完但资源尚未就绪：停在最后一帧，轮询直到就绪
        const iv = window.setInterval(() => {
          if (assetsReadyRef.current) { setLoadComplete(true); window.clearInterval(iv); }
        }, 100);
      }
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnded);
    };
  }, [videoFailed, assetsReady]);

  /** 回退模式（视频不可用）：rAF 计时模拟进度，约 3.5s */
  useEffect(() => {
    if (!videoFailed) return;
    const startTime = Date.now();
    const duration = 3500;
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const raw = Math.min(elapsed / duration, 1);
      let eased: number;
      if (raw < 0.3) eased = raw * 1.5;
      else if (raw < 0.7) eased = 0.45 + (raw - 0.3) * 0.5;
      else eased = 0.65 + (raw - 0.7) * 1.17;
      setLoadProgress(Math.min(Math.max(eased, 0), 1));
      if (raw < 1) rafRef.current = requestAnimationFrame(animate);
      else { setLoadComplete(true); setLoadProgress(1); }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [videoFailed]);

  const handleClick = useCallback(() => {
    if (fadingOut || !loadComplete) return;
    setFadingOut(true);
    setTimeout(() => { onStart(); }, 600);
  }, [fadingOut, loadComplete, onStart]);

  // 键盘：任意键进入
  useEffect(() => {
    const handleKey = () => handleClick();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleClick]);

  const progressPercent = Math.floor(loadProgress * 100);

  // ── 9:16（540×960）逻辑坐标层：等比缩放并在画布/视口中居中，层外纯黑填充 ──
  const DESIGN_W = 540;
  const DESIGN_H = 960;
  const vw = canvasBounds?.width ?? (typeof window !== 'undefined' ? window.innerWidth : DESIGN_W);
  const vh = canvasBounds?.height ?? (typeof window !== 'undefined' ? window.innerHeight : DESIGN_H);
  const vx = canvasBounds?.left ?? 0;
  const vy = canvasBounds?.top ?? 0;
  const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
  const frameW = DESIGN_W * scale;
  const frameH = DESIGN_H * scale;
  const frameStyle: React.CSSProperties = {
    position: 'fixed',
    left: vx + (vw - frameW) / 2,
    top: vy + (vh - frameH) / 2,
    width: DESIGN_W,
    height: DESIGN_H,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  };
  // 背景层：Fixed Height（开发准则 27.5）——高度填满，宽按比例水平居中，窄屏左右裁切、宽屏两侧黑
  const bgLayerStyle: React.CSSProperties = {
    position: 'fixed',
    left: vx, top: vy, width: vw, height: vh,
    overflow: 'hidden',
  };

  return (
    <div
      className="absolute inset-0 z-50 overflow-hidden select-none"
      style={{
        background: '#000',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity .6s',
        pointerEvents: fadingOut ? 'none' : 'auto',
        cursor: loadComplete ? 'pointer' : 'default',
      }}
      onClick={() => { audio?.playClick(); handleClick(); }}
    >
      {/* 背景层：Fixed-Height 铺满。视频为主（含背景+进度条动画），失败时回退静帧 */}
      <div style={bgLayerStyle}>
        {!videoFailed && (
          <video
            ref={videoRef}
            src={LOADING_VIDEO}
            poster={LOADING_POSTER}
            muted
            playsInline
            preload="auto"
            autoPlay
            className="absolute top-0"
            style={{
              left: '50%', height: '100%', width: 'auto',
              transform: 'translateX(-50%)',
              opacity: videoReady ? 1 : 0,
              transition: 'opacity .4s',
              objectFit: 'contain',
            }}
            onCanPlay={(e) => { setVideoReady(true); const v = e.currentTarget; if (!v.ended) v.play().catch(() => {}); }}
            onLoadedData={(e) => { setVideoReady(true); const v = e.currentTarget; if (!v.ended) v.play().catch(() => {}); }}
            onError={() => setVideoFailed(true)}
          />
        )}
        {videoFailed && (
          <img
            src={LOADING_POSTER}
            alt=""
            draggable={false}
            className="absolute top-0"
            style={{ left: '50%', height: '100%', width: 'auto', transform: 'translateX(-50%)' }}
          />
        )}
      </div>

      {/* UI 层：540×960 等比 Contain 居中，透明底 */}
      <div style={frameStyle}>
        {/* 标题 Logo 叠加（位置/尺寸来自 UI 布局编辑器导出，浮于 LOADING 视频之上，不拦截点击） */}
        <img
          src="/assets/UI/main_logo_main_zh.png"
          alt=""
          draggable={false}
          className="absolute pointer-events-none"
          style={{ left: 93, top: 36.1, width: 354, height: 150 }}
        />

        {/* 静音开关（右上角，层内坐标） */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          className="absolute flex items-center justify-center rounded-full bg-black/40 text-stone-300 hover:text-amber-300 transition-colors"
          style={{ left: 486, top: 16, width: 42, height: 42 }}
        >
          {audioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        {/* 回退模式：视频不可用时才显示 CSS 进度条（正常模式进度条已烤入视频） */}
        {videoFailed && !loadComplete && (
          <div className="absolute" style={{ left: 100, top: 884, width: 340, height: 14 }}>
            <div
              className="absolute inset-0 rounded-sm overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #2a2218 0%, #1a1410 50%, #2a2218 100%)',
                border: '1px solid #3d3020',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              <div
                className="h-full transition-all duration-100 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(180deg, #8B4513 0%, #D2691E 20%, #FF6B1A 40%, #CC3300 60%, #8B2500 80%, #4A1500 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,200,100,0.4)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 视频未就绪时的纯黑底，避免闪白（poster 会在视频首帧前显示） */}
      {!videoReady && !videoFailed && <div className="absolute inset-0" style={{ background: '#000' }} />}
    </div>
  );
};
