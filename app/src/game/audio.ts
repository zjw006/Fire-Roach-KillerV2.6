/**
 * @fileoverview 游戏音频管理器
 * @description 统一管理 BGM、SFX、Web Audio API 合成音效，并代理震动功能。
 */

import * as Vibration from './vibration';

/** 音频管理器：负责背景音乐、音效播放与震动代理 */
export class AudioManager {
  private bgm: HTMLAudioElement | null = null;
  private fireSfx: HTMLAudioElement | null = null;
  private killSfx: HTMLAudioElement | null = null;
  private swatterSfx: HTMLAudioElement | null = null;
  private reloadSfx: HTMLAudioElement | null = null;
  private clickSfx: HTMLAudioElement | null = null;
  /** 为 true 时静默忽略点击音效（用于游戏过程中屏蔽 UI 点击音） */
  suppressClickSfx: boolean = false;
  private gameOverBgm: HTMLAudioElement | null = null;
  private victoryBgm: HTMLAudioElement | null = null;

  private isMuted: boolean = false;
  private isVibrationEnabled: boolean = true;
  private audioContext: AudioContext | null = null;
  private currentBgmPath: string = '/assets/bgm_kitchen.mp3';
  private isStartupMusic: boolean = false; // 不再自动播放启动音乐

  constructor() {
    this.initAudio();
    // 从集中式震动模块同步开关状态
    this.isVibrationEnabled = Vibration.isVibrationEnabled();
  }

  // ========== 震动代理（全部委托给 vibration.ts） ==========
  /** 获取震动开关状态 */
  getVibrationEnabled(): boolean {
    this.isVibrationEnabled = Vibration.isVibrationEnabled();
    return this.isVibrationEnabled;
  }

  /** 设置震动开关状态 */
  setVibrationEnabled(enabled: boolean) {
    this.isVibrationEnabled = enabled;
    Vibration.setVibrationEnabled(enabled);
  }

  /** 切换震动开关状态 */
  toggleVibration(): boolean {
    const result = Vibration.toggleVibration();
    this.isVibrationEnabled = result;
    return result;
  }

  isVibrationSupported(): boolean { return Vibration.isVibrationSupported(); }
  vibrate(pattern: number | number[]) { Vibration.vibrate(pattern); }
  vibrateFire() { Vibration.vibrateFire(); }
  vibrateKill() { Vibration.vibrateKill(); }
  vibrateExplode() { Vibration.vibrateExplode(); }
  vibrateSuicideExplode() { Vibration.vibrateSuicideExplode(); }
  vibrateBreach() { Vibration.vibrateBreach(); }
  vibrateItemUse() { Vibration.vibrateItemUse(); }
  vibrateNewRecord() { Vibration.vibrateNewRecord(); }
  vibrateGameOver() { Vibration.vibrateGameOver(); }
  
  /**
   * @description 创建音频元素辅助函数
   * @param src - 音频文件路径
   * @param volume - 音量（0-1）
   * @returns 配置好的音频元素
   */
  private createAudioElement(src: string, volume: number = 1.0): HTMLAudioElement {
    const audio = new Audio();
    audio.volume = volume;
    audio.muted = true; // Start muted to avoid auto-play restrictions
    audio.preload = 'none'; // 延迟加载，等用户交互后再加载，避免浏览器拦截
    
    // 保存 src 到 data 属性，等用户交互后设置
    audio.dataset.src = src;
    
    // 添加错误处理
    audio.addEventListener('error', (e) => {
      console.warn(`Audio load error for ${src}:`, e);
    });
    
    return audio;
  }
  
  private initAudio() {
    console.log('Initializing audio manager...');
    
    try {
      // Initialize audio elements with muted attribute to avoid auto-play restrictions
      this.bgm = this.createAudioElement('/assets/bgm_kitchen.mp3', 0.6);
      this.bgm.loop = true;
      
      this.fireSfx = this.createAudioElement('/assets/sfx_fire_intense.mp3', 1.0);
      this.fireSfx.loop = true;
      
      this.killSfx = this.createAudioElement('/assets/sfx_kill.mp3', 0.9);
      
      this.swatterSfx = this.createAudioElement('/assets/sfx_swatter.mp3', 1.0);
      
      this.reloadSfx = this.createAudioElement('/assets/sfx_reload.mp3', 0.9);

      this.clickSfx = this.createAudioElement('/assets/sfx_click.mp3', 0.5);
      
      this.gameOverBgm = this.createAudioElement('/assets/bgm_gameover.mp3', 0.7);
      this.gameOverBgm.loop = true;

      // Victory BGM is also used as the general BGM for all scenes
      this.victoryBgm = this.createAudioElement('/assets/bgm_victory.mp3', 0.5);
      this.victoryBgm.loop = true;
      
      // Create breach sound using Web Audio API (short buzz)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      console.log('Audio manager initialized successfully');
      
      // Add user interaction listener to unmute audio
      this.setupAudioUnmute();
      
      // 预加载所有音频
      this.preloadAllAudio();
      
    } catch (error) {
      console.error('Failed to initialize audio manager:', error);
    }
  }
  
  /**
   * @description 预加载所有音频文件
   */
  private preloadAllAudio(): void {
    console.log('Preloading all audio files...');
    
    const audioElements = [
      this.bgm,
      this.fireSfx,
      this.killSfx,
      this.swatterSfx,
      this.reloadSfx,
      this.clickSfx,
      this.gameOverBgm,
      this.victoryBgm
    ];
    
    audioElements.forEach((audio, index) => {
      if (audio) {
        try {
          // 触发音频预加载
          audio.load();
          console.log(`Audio ${index} preloaded`);
        } catch (error) {
          console.warn(`Failed to preload audio ${index}:`, error);
        }
      }
    });
  }
  
  /**
   * @description 设置音频取消静音监听器
   * @remarks 在用户首次交互后取消所有音频的静音状态
   */
  private setupAudioUnmute(): void {
    const unmuteAudio = () => {
      console.log('User interaction detected, unmuting audio elements');
      
      // Unmute all audio elements
      if (this.bgm) {
        console.log('Unmuting BGM, previous muted state:', this.bgm.muted);
        this.bgm.muted = false;
        console.log('BGM muted state after unmute:', this.bgm.muted);
      }
      if (this.fireSfx) {
        this.fireSfx.muted = false;
        console.log('Fire SFX unmuted');
      }
      if (this.killSfx) {
        this.killSfx.muted = false;
        console.log('Kill SFX unmuted');
      }
      if (this.swatterSfx) {
        this.swatterSfx.muted = false;
        console.log('Swatter SFX unmuted');
      }
      if (this.reloadSfx) {
        this.reloadSfx.muted = false;
        console.log('Reload SFX unmuted');
      }
      if (this.clickSfx) {
        this.clickSfx.muted = false;
        console.log('Click SFX unmuted');
      }
      if (this.gameOverBgm) {
        this.gameOverBgm.muted = false;
        console.log('Game Over BGM unmuted');
      }
      if (this.victoryBgm) {
        this.victoryBgm.muted = false;
        console.log('Victory BGM unmuted');
      }
      
      console.log('Audio elements unmuted');
      
      // 用户交互后，设置 src 并触发所有音频文件的实际加载
      const allAudioElements = [
        this.bgm, this.fireSfx, this.killSfx, this.swatterSfx,
        this.reloadSfx, this.clickSfx, this.gameOverBgm, this.victoryBgm
      ];
      allAudioElements.forEach(audio => {
        if (audio && audio.dataset.src) {
          const timestamp = Date.now();
          const src = audio.dataset.src;
          const urlWithCacheBust = src.includes('?') ? `${src}&t=${timestamp}` : `${src}?t=${timestamp}`;
          audio.src = urlWithCacheBust;
          audio.load(); // 触发实际加载
        }
      });
      
      // Remove event listeners after first interaction
      document.removeEventListener('click', unmuteAudio);
      document.removeEventListener('touchstart', unmuteAudio);
      document.removeEventListener('keydown', unmuteAudio);
      
      // 不再自动播放 BGM，仅在进入关卡战斗时由 startLevelBGM() 播放
    };
    
    console.log('Setting up audio unmute listeners');
    
    // Listen for user interaction
    document.addEventListener('click', unmuteAudio, { once: true });
    document.addEventListener('touchstart', unmuteAudio, { once: true });
    document.addEventListener('keydown', unmuteAudio, { once: true });
    
    // 添加一个定时器，检查音频状态
    setTimeout(() => {
      console.log('Audio status check:', {
        bgmExists: !!this.bgm,
        bgmMuted: this.bgm?.muted,
        bgmPaused: this.bgm?.paused,
        bgmReadyState: this.bgm?.readyState,
        isMuted: this.isMuted
      });
    }, 1000);
  }
  
  /** 播放护士蟑螂治疗施法音效 */
  playNurseCast() {
    if (this.isMuted) return;
    const sfx = this.createAudioElement('/assets/nurse_cast.mp3', 0.7);
    sfx.play().catch(() => {});
  }

  /** 播放变异蟑螂变身音效 */
  playMutantTransform() {
    if (this.isMuted) return;
    const sfx = this.createAudioElement('/assets/mutant_transform.mp3', 0.8);
    sfx.play().catch(() => {});
  }

  /** 播放防线被突破的蜂鸣警告音效（Web Audio API 合成） */
  private playBreachSound() {
    if (!this.audioContext || this.isMuted) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.3);
    gain.gain.setValueAtTime(0.6, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.3);
  }

  /** 开始播放当前 BGM */
  startBGM() {
    console.log('AudioManager.startBGM() called', {
      bgmExists: !!this.bgm,
      isMuted: this.isMuted,
      bgmMuted: this.bgm?.muted,
      bgmPaused: this.bgm?.paused,
      bgmSrc: this.bgm?.src,
      currentBgmPath: this.currentBgmPath
    });
    
    // 根据用户需求：不要默认的背景音乐，只在战斗开始后播放关卡音乐
    // 所以startBGM方法应该直接播放当前设置的BGM（关卡音乐）
    this.playCurrentBGM();
  }
  
  /** 内部方法：在条件满足时播放 BGM */
  private _playBGMIfPossible(): void {
    if (this.bgm && !this.isMuted && !this.bgm.muted) {
      console.log('Playing BGM, currentTime:', this.bgm.currentTime);
      this.bgm.currentTime = 0;
      this.bgm.play().then(() => {
        console.log('BGM playback started successfully');
      }).catch((error) => {
        console.error('Failed to play BGM:', error);
        // 尝试强制取消静音并重试
        console.log('Attempting to unmute and retry...');
        this.bgm!.muted = false;
        this.bgm!.play().then(() => {
          console.log('BGM playback started after unmute');
        }).catch((retryError) => {
          console.error('Failed to play BGM even after unmute:', retryError);
        });
      });
    } else {
      console.warn('Cannot play BGM:', {
        bgmExists: !!this.bgm,
        isMuted: this.isMuted,
        bgmMuted: this.bgm?.muted
      });
      // 如果因为静音而无法播放，尝试取消静音
      if (this.bgm && this.bgm.muted) {
        console.log('BGM is muted, attempting to unmute...');
        this.bgm.muted = false;
        // 重试播放
        setTimeout(() => {
          this._playBGMIfPossible();
        }, 100);
      }
    }
  }

  /** 停止当前 BGM */
  stopBGM() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
    }
    this.currentBgmPath = ''; // 重置路径，确保重新进入时可再次播放
  }
  
  /** 停止启动音乐（厨房背景音乐） */
  stopStartupMusic(): void {
    console.log('Stopping startup music (kitchen BGM)');
    if (this.isStartupMusic && this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
      this.isStartupMusic = false;
      console.log('Startup music stopped');
    } else {
      console.log('Not startup music or no BGM to stop');
    }
  }
  
  /** 获取是否为启动音乐 */
  getIsStartupMusic(): boolean {
    return this.isStartupMusic;
  }

  /** 暂停当前 BGM */
  pauseBGM() {
    if (this.bgm) this.bgm.pause();
  }

  /** 恢复播放当前 BGM */
  resumeBGM() {
    console.log('AudioManager.resumeBGM() called', {
      bgmExists: !!this.bgm,
      isMuted: this.isMuted,
      bgmMuted: this.bgm?.muted
    });
    
    if (this.bgm && !this.isMuted && !this.bgm.muted) {
      this.bgm.play().catch((error) => {
        console.error('Failed to resume BGM:', error);
      });
    } else {
      console.warn('Cannot resume BGM:', {
        bgmExists: !!this.bgm,
        isMuted: this.isMuted,
        bgmMuted: this.bgm?.muted
      });
    }
  }

  /**
   * 渐变淡出 BGM 音量到目标级别
   * @param {number} targetVolume - 目标音量（默认 0.08）
   * @param {number} duration - 淡出持续时间，单位毫秒（默认 2500ms）
   */
  fadeOutBGM(targetVolume: number = 0.08, duration: number = 2500) {
    if (!this.bgm) return;
    const startVolume = this.bgm.volume;
    const startTime = performance.now();
    const step = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // 使用 ease-out cubic 实现平滑淡出
      const eased = 1 - Math.pow(1 - progress, 3);
      const newVolume = startVolume + (targetVolume - startVolume) * eased;
      if (this.bgm) {
        this.bgm.volume = Math.max(0, newVolume);
      }
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  /** 播放游戏结束 BGM */
  playGameOverBGM() {
    if (this.isMuted) return;
    // 每次重新创建 Audio 元素以确保可靠播放
    this.stopGameOverBGM();
    this.gameOverBgm = this.createAudioElement('/assets/bgm_gameover.mp3', 0.7);
    this.gameOverBgm.loop = true;
    this.gameOverBgm.play().catch(() => {});
  }

  /** 停止游戏结束 BGM */
  stopGameOverBGM() {
    if (this.gameOverBgm) {
      this.gameOverBgm.pause();
      this.gameOverBgm.currentTime = 0;
      this.gameOverBgm = null;
    }
  }

  /** 播放胜利 BGM */
  playVictoryBGM() {
    if (this.isMuted || !this.victoryBgm) return;
    this.victoryBgm.currentTime = 0;
    this.victoryBgm.play().catch(() => {});
  }

  /** 停止胜利 BGM */
  stopVictoryBGM() {
    if (this.victoryBgm) {
      this.victoryBgm.pause();
      this.victoryBgm.currentTime = 0;
    }
  }

  /**
   * 切换 BGM 到指定音轨（不立即播放）
   * @param {string} path - 音频文件路径
   */
  switchBGM(path: string) {
    console.log('AudioManager.switchBGM() called', {
      path,
      currentPath: this.currentBgmPath,
      isMuted: this.isMuted
    });
    
    if (this.currentBgmPath === path) return; // 同一首曲目，无需切换
    this.currentBgmPath = path;
    this.isStartupMusic = false; // 切换场景后不再是启动音乐
    // 彻底停止并清理旧 BGM 元素
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
      this.bgm.src = ''; // 清空 src，防止任何残留加载
      this.bgm.load(); // 重置音频元素状态
    }
    // 创建新的 BGM 元素，直接设置 src 并取消静音（用户已交互过）
    this.bgm = new Audio(path);
    this.bgm.volume = 0.6;
    this.bgm.loop = true;
    this.bgm.muted = false;
    // 添加错误处理
    this.bgm.addEventListener('error', (e) => {
      console.warn(`BGM load error for ${path}:`, e);
    });
    console.log('BGM switched to:', path, 'ready to play');
  }
  
  /**
   * 播放当前设置的 BGM
   */
  playCurrentBGM(): void {
    console.log('AudioManager.playCurrentBGM() called', {
      currentPath: this.currentBgmPath,
      bgmExists: !!this.bgm,
      isMuted: this.isMuted,
      bgmMuted: this.bgm?.muted
    });
    
    if (!this.bgm) {
      console.warn('Cannot play BGM: bgm is null');
      return;
    }
    
    if (!this.isMuted && !this.bgm.muted) {
      console.log('Playing current BGM');
      this.bgm.currentTime = 0;
      this.bgm.play().catch((error) => {
        console.error('Failed to play current BGM:', error);
      });
    } else {
      console.log('Current BGM not played:', {
        isMuted: this.isMuted,
        bgmMuted: this.bgm.muted
      });
    }
  }

  /**
   * 获取指定场景在简单/困难难度下的 BGM 路径
   * @param {string} sceneType - 场景类型
   * @returns {Object | null} 包含 easy 和 hard 路径的对象，若无自定义 BGM 则返回 null
   */
  getBgmForScene(sceneType: string): { easy: string; hard: string } | null {
    switch (sceneType) {
      case 'kitchen':
        return {
          easy: '/assets/bgm_kitchen_easy.mp3?v=7',
          hard: '/assets/bgm_kitchen_hard.mp3?v=4',
        };
      case 'sewer':
        return {
          easy: '/assets/bgm_sewer_easy.mp3?v=2',
          hard: '/assets/bgm_sewer_hard.mp3?v=1',
        };
      case 'dump':
        return {
          easy: '/assets/bgm_dump_easy.mp3?v=1',
          hard: '/assets/bgm_dump_hard.mp3?v=1',
        };
      case 'basement':
        return {
          easy: '/assets/bgm_basement_easy.mp3?v=1',
          hard: '/assets/bgm_basement_hard.mp3?v=1',
        };
      case 'rooftop':
        return {
          easy: '/assets/bgm_rooftop_easy.mp3?v=1',
          hard: '/assets/bgm_rooftop_hard.mp3?v=1',
        };
      case 'street':
        return {
          easy: '/assets/bgm_street_easy.mp3?v=1',
          hard: '/assets/bgm_street_hard.mp3?v=1',
        };
      case 'hospital':
        return {
          easy: '/assets/bgm_hospital.mp3?v=1',
          hard: '/assets/bgm_hospital.mp3?v=1',
        };
      default:
        return null; // 该场景无自定义 BGM
    }
  }

  /**
   * 根据场景与难度自动切换对应 BGM（不立即播放）
   * @param {string} sceneType - 场景类型
   * @param {string} difficulty - 难度等级（'easy' | 'hard'）
   */
  switchBGMForScene(sceneType: string, difficulty: string) {
    console.log(`Switching BGM for scene: ${sceneType}, difficulty: ${difficulty}`);
    
    const bgmMap = this.getBgmForScene(sceneType);
    if (!bgmMap) {
      console.log(`No custom BGM for scene: ${sceneType}, keeping current BGM`);
      return; // 无自定义 BGM，保持默认
    }
    
    // 进入关卡选择后停止启动音乐
    this.stopStartupMusic();
    
    const path = difficulty === 'hard' ? bgmMap.hard : bgmMap.easy;
    console.log(`Switching to BGM: ${path} (not playing yet)`);
    this.switchBGM(path);
  }
  
  /**
   * 开始播放关卡背景音乐（在战斗开始时调用）
   */
  startLevelBGM(): void {
    console.log('AudioManager.startLevelBGM() called', {
      currentPath: this.currentBgmPath
    });
    
    // 播放当前设置的关卡音乐
    this.playCurrentBGM();
  }

  /** 播放火焰喷射音效 */
  playFire() {
    if (this.fireSfx && !this.isMuted) {
      this.fireSfx.play().catch(() => {});
    }
  }

  /** 停止火焰喷射音效 */
  stopFire() {
    if (this.fireSfx) {
      this.fireSfx.pause();
      this.fireSfx.currentTime = 0;
    }
  }
  
  /** 播放击杀蟑螂音效 */
  playKill() {
    if (this.killSfx && !this.isMuted) {
      this.killSfx.currentTime = 0;
      this.killSfx.play().catch(() => {});
    }
  }

  /** 播放电蚊拍音效 */
  playSwatter() {
    if (this.swatterSfx && !this.isMuted) {
      this.swatterSfx.currentTime = 0;
      this.swatterSfx.play().catch(() => {});
    }
  }

  /** 播放换弹/换罐音效 */
  playReload() {
    if (this.reloadSfx && !this.isMuted) {
      this.reloadSfx.currentTime = 0;
      this.reloadSfx.play().catch(() => {});
    }
  }

  /** 播放防线突破警告音效 */
  playBreach() {
    if (this.isMuted) return;
    this.playBreachSound();
  }

  /** 播放 UI 点击音效（游戏过程中会被 suppressClickSfx 屏蔽） */
  playClick() {
    if (this.isMuted || this.suppressClickSfx) return;
    if (this.clickSfx) {
      this.clickSfx.currentTime = 0;
      this.clickSfx.play().catch(() => {});
    }
  }

  /** 播放波次倒计时滴答音效（880Hz 方波，80ms） */
  playCountdownTick() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    // 短促方波滴答音
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** 播放新道具掉落时的华丽登场音效（C5-E5-G5-C6 上行琶音 + 闪烁和声） */
  playItemDropFanfare() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    // Grand ascending arpeggio (C5-E5-G5-C6) with sparkle feel
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + i * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.4);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.4);
    });
    // Layer 2: shimmer/harmony
    const shimmerNotes = [783.99, 987.77, 1174.66, 1567.98];
    shimmerNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08 + 0.05);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08 + 0.05);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.08 + 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.05 + 0.5);
      osc.start(ctx.currentTime + i * 0.08 + 0.05);
      osc.stop(ctx.currentTime + i * 0.08 + 0.05 + 0.5);
    });
    // Final bright chime
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chimeOsc.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(2093.00, now + 0.45); // C7
    chimeGain.gain.setValueAtTime(0, now + 0.45);
    chimeGain.gain.linearRampToValueAtTime(0.6, now + 0.45 + 0.02);
    chimeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45 + 0.8);
    chimeOsc.start(now + 0.45);
    chimeOsc.stop(now + 0.45 + 0.8);
  }

  /** 播放弹幕/子弹飞过的锐利嗖嗖音效 */
  playDanmaku() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    // Sharp swish
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** 播放 Boss 冲锋蓄力时的低沉隆隆音效 */
  playBossCharge() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    // Deep rumble
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** 播放道具掉落的清脆提示音（C-E-G 上行琶音） */
  playItemDrop() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    // Bright chime for new item drop (C-E-G ascending arpeggio)
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.25);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.25);
    });
  }

  /** 播放麻痹/电击 zap 音效 */
  playParalyze() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    // 电击 zap
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** 播放 Boss 冲锋撞击的重击音效 */
  playBossChargeHit() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    // Heavy impact
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
    // Noise burst
    const noiseDur = 0.15;
    const bufferSize = ctx.sampleRate * noiseDur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(600, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + noiseDur);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + noiseDur);
  }

  /** 播放对话打字时的微妙按键滴答音效 */
  playDialogTypingTick() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.02);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  }

  /** 播放对话切换/翻页时的过渡提示音效 */
  playDialogSwitch() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Gentle chime
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, now); // C5
    osc.frequency.setValueAtTime(659, now + 0.06); // E5

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Soft click
    const click = ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1200, now);
    click.frequency.exponentialRampToValueAtTime(400, now + 0.04);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.25, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.04);
  }

  /** 播放飞行蟑螂翅膀高速振动的嗡嗡音效（多层合成：核心锯齿波 + 泛音 + 翅拍噪声） */
  playFlyingBuzz() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const duration = 0.45;

    // ===== Mosquito buzzing: annoying, high-pitched, whining =====
    // Core: ~600Hz sawtooth with rapid vibrato (±80Hz at 30Hz LFO rate)
    const coreOsc = ctx.createOscillator();
    coreOsc.type = 'sawtooth';
    coreOsc.frequency.setValueAtTime(600, now);
    const coreGain = ctx.createGain();
    coreGain.gain.setValueAtTime(0.25, now);
    coreGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    // Vibrato LFO: rapid pitch wobble ~30Hz
    const vibratoOsc = ctx.createOscillator();
    vibratoOsc.type = 'sine';
    vibratoOsc.frequency.setValueAtTime(30, now);
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.setValueAtTime(80, now);
    vibratoOsc.connect(vibratoGain);
    vibratoGain.connect(coreOsc.frequency);
    vibratoOsc.start(now);
    vibratoOsc.stop(now + duration);
    // Highpass to cut mud, keep the annoying buzz
    const coreFilter = ctx.createBiquadFilter();
    coreFilter.type = 'highpass';
    coreFilter.frequency.setValueAtTime(500, now);
    coreOsc.connect(coreFilter);
    coreFilter.connect(coreGain);
    coreGain.connect(ctx.destination);
    coreOsc.start(now);
    coreOsc.stop(now + duration);

    // Layer 2: 1200Hz overtone (mosquito's upper harmonic whine)
    const whineOsc = ctx.createOscillator();
    whineOsc.type = 'square';
    whineOsc.frequency.setValueAtTime(1200, now);
    const whineGain = ctx.createGain();
    whineGain.gain.setValueAtTime(0.12, now);
    whineGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    const whineFilter = ctx.createBiquadFilter();
    whineFilter.type = 'bandpass';
    whineFilter.frequency.setValueAtTime(1200, now);
    whineFilter.Q.setValueAtTime(2, now);
    whineOsc.connect(whineFilter);
    whineFilter.connect(whineGain);
    whineGain.connect(ctx.destination);
    whineOsc.start(now);
    whineOsc.stop(now + duration);

    // Layer 3: tiny noise bursts every ~50ms for wing "flap" texture
    for (let i = 0; i < 8; i++) {
      const t = now + i * 0.05;
      const flapNoise = ctx.createBufferSource();
      const bufSize = ctx.sampleRate * 0.02;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bufSize; j++) d[j] = (Math.random() * 2 - 1);
      flapNoise.buffer = buf;
      const flapGain = ctx.createGain();
      flapGain.gain.setValueAtTime(0.06, t);
      flapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      const flapFilter = ctx.createBiquadFilter();
      flapFilter.type = 'highpass';
      flapFilter.frequency.setValueAtTime(3000, t);
      flapNoise.connect(flapFilter);
      flapFilter.connect(flapGain);
      flapGain.connect(ctx.destination);
      flapNoise.start(t);
      flapNoise.stop(t + 0.02);
    }
  }

  /** 播放飞行蟑螂闪避时的快速方向嗖嗖音效 */
  playFlyingDodge() {
    if (this.isMuted) return;
    const audio = this.createAudioElement('/assets/flying_dodge.mp3', 0.7);
    audio.play().catch(() => {});
  }

  /** 播放地面自爆蟑螂突破防线时的重型地面震动撞击音效 */
  playSuicideBreachGround() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    // Layer 1: Deep underground rumble - felt more than heard
    const rumbleOsc = ctx.createOscillator();
    rumbleOsc.type = 'sine';
    rumbleOsc.frequency.setValueAtTime(60, now);
    rumbleOsc.frequency.exponentialRampToValueAtTime(25, now + 0.8);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(1.2, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumbleOsc.start(now);
    rumbleOsc.stop(now + 1.0);
    // Layer 2: Heavy "dong" impact - the core hit
    const dongOsc = ctx.createOscillator();
    dongOsc.type = 'sine';
    dongOsc.frequency.setValueAtTime(120, now);
    dongOsc.frequency.exponentialRampToValueAtTime(35, now + 0.4);
    const dongGain = ctx.createGain();
    dongGain.gain.setValueAtTime(1.5, now);
    dongGain.gain.exponentialRampToValueAtTime(0.3, now + 0.1);
    dongGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    dongOsc.connect(dongGain);
    dongGain.connect(ctx.destination);
    dongOsc.start(now);
    dongOsc.stop(now + 0.6);
    // Layer 3: Noise burst - concrete shattering texture
    const noiseDur = 0.25;
    const bufferSize = ctx.sampleRate * noiseDur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(150, now + noiseDur);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseDur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + noiseDur);
    // Layer 4: Short crack for ground fracture
    for (let i = 0; i < 4; i++) {
      const t = now + 0.05 + i * 0.04;
      const crack = ctx.createOscillator();
      crack.type = 'square';
      crack.frequency.setValueAtTime(2000 - i * 300, t);
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.15, t);
      cGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
      crack.connect(cGain);
      cGain.connect(ctx.destination);
      crack.start(t);
      crack.stop(t + 0.03);
    }
  }

  /** 播放飞行自爆蟑螂空中爆炸时的尖锐爆裂 + 碎片散射音效 */
  playSuicideBreachFlying() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    // Layer 1: Sharp explosion crack - high attack, fast decay
    const crackOsc = ctx.createOscillator();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(3000, now);
    crackOsc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.8, now);
    crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.setValueAtTime(800, now);
    crackOsc.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackOsc.start(now);
    crackOsc.stop(now + 0.15);
    // Layer 2: Noise burst - explosive debris scatter
    const noiseDur = 0.4;
    const bufferSize = ctx.sampleRate * noiseDur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(400, now + noiseDur);
    noiseFilter.Q.setValueAtTime(0.8, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseDur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + noiseDur);
    // Layer 3: Metallic debris scatter - rapid high-pitch drops
    for (let i = 0; i < 8; i++) {
      const t = now + 0.02 + i * 0.025;
      const debris = ctx.createOscillator();
      debris.type = 'triangle';
      debris.frequency.setValueAtTime(4000 + Math.random() * 3000, t);
      debris.frequency.exponentialRampToValueAtTime(500, t + 0.04);
      const dGain = ctx.createGain();
      dGain.gain.setValueAtTime(0.12, t);
      dGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      debris.connect(dGain);
      dGain.connect(ctx.destination);
      debris.start(t);
      debris.stop(t + 0.05);
    }
    // Layer 4: Doppler-like falling tail - the "俯冲" feel
    const dopplerOsc = ctx.createOscillator();
    dopplerOsc.type = 'sine';
    dopplerOsc.frequency.setValueAtTime(600, now + 0.05);
    dopplerOsc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
    const dopplerGain = ctx.createGain();
    dopplerGain.gain.setValueAtTime(0, now + 0.05);
    dopplerGain.gain.linearRampToValueAtTime(0.4, now + 0.08);
    dopplerGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    dopplerOsc.connect(dopplerGain);
    dopplerGain.connect(ctx.destination);
    dopplerOsc.start(now + 0.05);
    dopplerOsc.stop(now + 0.5);
  }

  /** 播放自爆蟑螂爆炸音效（深沉"咚"声 + 长混响尾音） */
  playSuicideExplode() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const duration = 3.6; // long reverb tail

    // Layer 1: Main "dong" impact - deep sine sweep (the core "咚")
    const dongOsc = ctx.createOscillator();
    dongOsc.type = 'sine';
    dongOsc.frequency.setValueAtTime(180, now);
    dongOsc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    // After initial sweep, hold low frequency for long tail
    dongOsc.frequency.setValueAtTime(40, now + 0.15);
    dongOsc.frequency.exponentialRampToValueAtTime(25, now + duration);
    const dongGain = ctx.createGain();
    dongGain.gain.setValueAtTime(12.0, now); // strong initial hit
    dongGain.gain.exponentialRampToValueAtTime(6.4, now + 0.1);
    dongGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    dongOsc.connect(dongGain);
    dongGain.connect(ctx.destination);
    dongOsc.start(now);
    dongOsc.stop(now + duration);

    // Layer 2: Impact click (short transient for the "砰" attack)
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(800, now);
    clickOsc.frequency.exponentialRampToValueAtTime(200, now + 0.03);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(3.2, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);

    // Layer 3: Short noise burst (explosion texture, very brief)
    const noiseDur = 0.12;
    const bufferSize = ctx.sampleRate * noiseDur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + noiseDur);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(4.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseDur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + noiseDur);

    // Layer 4: Long resonant tail (simulating room reverb on the "dong")
    // Multiple delayed low-frequency echoes for the lingering "嗡..."
    for (let i = 0; i < 5; i++) {
      const delay = 0.08 + i * 0.3;
      const decay = 1.2 - i * 0.2;
      const tailOsc = ctx.createOscillator();
      tailOsc.type = 'sine';
      const freq = 50 - i * 5;
      tailOsc.frequency.setValueAtTime(freq, now + delay);
      tailOsc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + delay + 0.5);
      const tailGain = ctx.createGain();
      tailGain.gain.setValueAtTime(0, now + delay);
      tailGain.gain.linearRampToValueAtTime(decay * 8, now + delay + 0.02);
      tailGain.gain.exponentialRampToValueAtTime(0.01, now + delay + 1.6);
      tailOsc.connect(tailGain);
      tailGain.connect(ctx.destination);
      tailOsc.start(now + delay);
      tailOsc.stop(now + delay + 0.8);
    }

    // Layer 5: Sub-bass rumble (very low, felt more than heard)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(35, now);
    subOsc.frequency.exponentialRampToValueAtTime(20, now + duration * 0.7);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(6.4, now);
    subGain.gain.exponentialRampToValueAtTime(2.4, now + 0.2);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + duration);
  }

  /** 播放定时炸弹蟑螂放置炸弹时的机械咔哒计时启动音效 */
  playTimedBombDrop() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    // Mechanical click - timer activation
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(1200, now);
    clickOsc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(2.0, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.12);
    // Second tick - timer running
    const tickOsc = ctx.createOscillator();
    tickOsc.type = 'sine';
    tickOsc.frequency.setValueAtTime(800, now + 0.15);
    tickOsc.frequency.exponentialRampToValueAtTime(200, now + 0.25);
    const tickGain = ctx.createGain();
    tickGain.gain.setValueAtTime(1.5, now + 0.15);
    tickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    tickOsc.connect(tickGain);
    tickGain.connect(ctx.destination);
    tickOsc.start(now + 0.15);
    tickOsc.stop(now + 0.3);
  }

  /** 播放定时炸弹爆炸音效（比自爆蟑螂更强力的 BOOM + 屏幕震动配合） */
  playTimedBombExplode() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const duration = 2.5;

    // Layer 1: Massive impact "dong" - deeper and louder than suicide explode
    const dongOsc = ctx.createOscillator();
    dongOsc.type = 'sine';
    dongOsc.frequency.setValueAtTime(220, now);
    dongOsc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
    dongOsc.frequency.setValueAtTime(30, now + 0.2);
    dongOsc.frequency.exponentialRampToValueAtTime(20, now + duration);
    const dongGain = ctx.createGain();
    dongGain.gain.setValueAtTime(16.0, now); // stronger than suicide
    dongGain.gain.exponentialRampToValueAtTime(8.0, now + 0.1);
    dongGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    dongOsc.connect(dongGain);
    dongGain.connect(ctx.destination);
    dongOsc.start(now);
    dongOsc.stop(now + duration);

    // Layer 2: Sharp impact click
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1000, now);
    clickOsc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(5.0, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);

    // Layer 3: Noise burst (explosion debris)
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.8;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(4.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // Layer 4: Sub-bass rumble
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(60, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.3);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(10.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
  }

  /** 播放杀虫喷雾 2 秒持续嘶嘶喷射音效 */
  playInsecticideSpray() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const duration = 2.0;
    const now = ctx.currentTime;

    // White noise buffer for hiss
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter for aerosol hiss character
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(3000, now);
    bandpass.frequency.linearRampToValueAtTime(5000, now + 0.5);
    bandpass.frequency.linearRampToValueAtTime(3500, now + duration);
    bandpass.Q.setValueAtTime(0.5, now);

    // Lowpass for body
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(800, now);
    lowpass.frequency.linearRampToValueAtTime(600, now + duration);

    // Gain envelope (fade in/out)
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
    gain.gain.setValueAtTime(0.5, now + duration - 0.3);
    gain.gain.linearRampToValueAtTime(0.01, now + duration);

    // Low-frequency rumble
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(60, now + duration);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.15, now);
    oscGain.gain.linearRampToValueAtTime(0.01, now + duration);

    // Connect
    noise.connect(bandpass);
    bandpass.connect(gain);
    osc.connect(oscGain);
    oscGain.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }

  /** 播放粘板喷雾连续弹出 10 次 pop-pop-pop 序列音效 */
  playStickySpray() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const count = 10;
    const interval = 0.08; // 80ms between drops

    for (let i = 0; i < count; i++) {
      const t = ctx.currentTime + i * interval;
      this.playStickyDropPop(ctx, t);
    }
  }

  /** 播放单次粘板弹丸 pop 音效（内部辅助方法） */
  private playStickyDropPop(ctx: AudioContext, time: number) {
    // 短促 pop 音，快速音高下降
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.08);

    // Slight click noise
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(2000, time);
    clickOsc.frequency.exponentialRampToValueAtTime(500, time + 0.02);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.15, time);
    clickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.02);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(time);
    clickOsc.stop(time + 0.02);
  }

  /** 播放燃烧瓶爆炸音效（低沉 boom + 爆裂 crackle） */
  playMolotovExplosion() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Low boom (sine sweep down)
    const boomOsc = ctx.createOscillator();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(150, now);
    boomOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(0.8, now);
    boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(now);
    boomOsc.stop(now + 0.4);

    // Noise burst (explosion texture)
    const noiseDuration = 0.5;
    const bufferSize = ctx.sampleRate * noiseDuration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // decay
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.5);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + noiseDuration);

    // Crackle (short high-pitch spikes)
    for (let i = 0; i < 6; i++) {
      const t = now + 0.1 + i * 0.06;
      const crackle = ctx.createOscillator();
      crackle.type = 'square';
      crackle.frequency.setValueAtTime(3000 + Math.random() * 2000, t);
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.1, t);
      cGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
      crackle.connect(cGain);
      cGain.connect(ctx.destination);
      crackle.start(t);
      crackle.stop(t + 0.03);
    }
  }

  /** 播放散弹模式激活时的强力爆发音效 */
  playShotgunActivate() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Heavy thump
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(100, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.6, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.2);

    // Metallic click
    const click = ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(2000, now + 0.05);
    click.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.2, now + 0.05);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now + 0.05);
    click.stop(now + 0.12);

    // Echo rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(60, now + 0.08);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.1, now + 0.08);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(300, now + 0.08);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start(now + 0.08);
    rumble.stop(now + 0.3);
  }

  /** 播放雷达激光单发射击的短促 zap 音效 */
  playRadarShot() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Short high-frequency zap
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3000, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    // Bandpass for laser character
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(1000, now + 0.08);
    filter.Q.setValueAtTime(2, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);

    // Click transient
    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(6000, now);
    click.frequency.exponentialRampToValueAtTime(2000, now + 0.02);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.08, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.02);
  }

  /** 播放雷达激光激活时的电子扫描 + 锁定提示音 */
  playRadarActivate() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Electronic scan sweep
    const scan = ctx.createOscillator();
    scan.type = 'sawtooth';
    scan.frequency.setValueAtTime(400, now);
    scan.frequency.linearRampToValueAtTime(1200, now + 0.15);
    scan.frequency.linearRampToValueAtTime(600, now + 0.3);
    const scanGain = ctx.createGain();
    scanGain.gain.setValueAtTime(0.12, now);
    scanGain.gain.linearRampToValueAtTime(0.06, now + 0.3);

    // Add ring modulator effect
    const ringOsc = ctx.createOscillator();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(30, now);
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(200, now);

    scan.connect(ringGain);
    ringOsc.connect(ringGain.gain);
    ringGain.connect(scanGain);
    scanGain.connect(ctx.destination);
    scan.start(now);
    scan.stop(now + 0.3);
    ringOsc.start(now);
    ringOsc.stop(now + 0.3);

    // Lock-on beep sequence
    for (let i = 0; i < 3; i++) {
      const t = now + 0.35 + i * 0.12;
      const beep = ctx.createOscillator();
      beep.type = 'sine';
      beep.frequency.setValueAtTime(880 + i * 220, t);
      const bGain = ctx.createGain();
      bGain.gain.setValueAtTime(0.2, t);
      bGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      beep.connect(bGain);
      bGain.connect(ctx.destination);
      beep.start(t);
      beep.stop(t + 0.08);
    }
  }

  /** 飞行蟑螂循环嗡嗡音频实例 */
  private flyingBuzzAudio: HTMLAudioElement | null = null;
  /** 飞行蟑螂嗡嗡是否正在播放 */
  private flyingBuzzPlaying: boolean = false;

  /** 启动飞行蟑螂持续嗡嗡循环（场上存在飞行蟑螂时调用） */
  startFlyingBuzzLoop() {
    if (this.isMuted || this.flyingBuzzPlaying) return;
    if (!this.flyingBuzzAudio) {
      this.flyingBuzzAudio = this.createAudioElement('/assets/flying_roach_buzz.mp3', 0.4);
      this.flyingBuzzAudio.loop = true;
    }
    this.flyingBuzzAudio.currentTime = 0;
    this.flyingBuzzAudio.play().catch(() => {});
    this.flyingBuzzPlaying = true;
  }

  /** 停止飞行蟑螂持续嗡嗡循环 */
  stopFlyingBuzzLoop() {
    if (this.flyingBuzzAudio) {
      this.flyingBuzzAudio.pause();
      this.flyingBuzzAudio.currentTime = 0;
    }
    this.flyingBuzzPlaying = false;
  }

  /** 播放飞行蟑螂死亡时的一次性死亡音效 */
  playFlyingDeath() {
    if (this.isMuted) return;
    const audio = this.createAudioElement('/assets/flying_roach_death.mp3', 0.5);
    audio.play().catch(() => {});
  }

  /** 切换静音状态 */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBGM();
      this.stopFire();
      this.stopFlyingBuzzLoop();
    } else {
      this.resumeBGM();
    }
    return this.isMuted;
  }

  /** 设置静音状态 */
  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopBGM();
      this.stopFire();
      this.stopFlyingBuzzLoop();
      this.stopGameOverBGM();
      this.stopVictoryBGM();
    }
  }

  /** 获取当前静音状态 */
  getMuted(): boolean {
    return this.isMuted;
  }
  
  /** 风扇持续气流噪音的音频节点 */
  private fanNodes: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode; lfoGain: GainNode } | null = null;

  /** 启动风扇持续气流循环音效 */
  startFanLoop() {
    if (!this.audioContext || this.isMuted || this.fanNodes) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // White noise through bandpass = rushing air
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Bandpass: focus on low-mid range for "whoosh"
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(300, now);
    bp.Q.setValueAtTime(0.5, now);

    // Slow LFO sweeping the filter = rotating blade feel
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(3, now); // 3Hz = fan blade rotation
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(150, now);
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    lfo.start(now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.3); // fade in

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    this.fanNodes = { osc: noise as unknown as OscillatorNode, gain, lfo, lfoGain };
  }

  /** 停止风扇持续气流循环音效（带淡出） */
  stopFanLoop() {
    if (!this.fanNodes || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    const { gain, lfo } = this.fanNodes;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3); // fade out
    lfo.stop(now + 0.3);
    setTimeout(() => { this.fanNodes = null; }, 350);
  }

  /** 播放燃烧瓶投掷时的玻璃瓶破空嗖嗖 + 碎裂音效 */
  playMolotovThrow() {
    if (!this.audioContext || this.isMuted) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Layer 1: air-whoosh (bottle flying through air)
    const whooshNoise = ctx.createBufferSource();
    const bufSize = ctx.sampleRate * 0.3;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
    whooshNoise.buffer = buf;
    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    whooshFilter.frequency.setValueAtTime(800, now);
    whooshFilter.frequency.linearRampToValueAtTime(200, now + 0.3);
    whooshFilter.Q.setValueAtTime(1, now);
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.3, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    whooshNoise.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whooshNoise.start(now);
    whooshNoise.stop(now + 0.3);

    // Layer 2: high-frequency glass shimmer
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.015;
      const glass = ctx.createOscillator();
      glass.type = 'sine';
      glass.frequency.setValueAtTime(3000 + Math.random() * 2000, t);
      const gGain = ctx.createGain();
      gGain.gain.setValueAtTime(0.08, t);
      gGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      glass.connect(gGain);
      gGain.connect(ctx.destination);
      glass.start(t);
      glass.stop(t + 0.05);
    }
  }

  /** 火墙持续燃烧音频节点 */
  private fireWallNodes: { noise: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** 启动火墙持续燃烧噼啪音效（低频噪音 + 随机爆裂） */
  startFireWallBurn() {
    if (!this.audioContext || this.isMuted || this.fireWallNodes) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Crackling fire: noise with random amplitude modulation
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      // Brown noise (deeper than white noise)
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Lowpass for deep rumble
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.5); // slow fade in

    noise.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    this.fireWallNodes = { noise, gain };

    // Periodic crackle pops (interval ref stored on the object)
    (this.fireWallNodes as any)._crackleInterval = setInterval(() => {
      if (!this.audioContext || this.isMuted) return;
      const cNow = this.audioContext.currentTime;
      // Random crackle
      const crackle = this.audioContext.createOscillator();
      crackle.type = 'square';
      crackle.frequency.setValueAtTime(200 + Math.random() * 600, cNow);
      const cGain = this.audioContext.createGain();
      cGain.gain.setValueAtTime(0.1 + Math.random() * 0.15, cNow);
      cGain.gain.exponentialRampToValueAtTime(0.01, cNow + 0.03 + Math.random() * 0.05);
      crackle.connect(cGain);
      cGain.connect(this.audioContext.destination);
      crackle.start(cNow);
      crackle.stop(cNow + 0.08);
    }, 150 + Math.random() * 200);
  }

  /** 停止火墙持续燃烧音效（带淡出） */
  stopFireWallBurn() {
    if (!this.fireWallNodes || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    const { gain, noise } = this.fireWallNodes;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5); // fade out
    // Clear crackle interval
    const interval = (this.fireWallNodes as any)._crackleInterval;
    if (interval) clearInterval(interval);
    setTimeout(() => {
      try { noise.stop(); } catch (_) {}
      this.fireWallNodes = null;
    }, 550);
  }

  /** 恢复被浏览器挂起的 AudioContext（用于处理自动播放策略） */
  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}