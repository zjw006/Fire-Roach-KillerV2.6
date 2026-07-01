/**
 * @fileoverview 玩家控制系统模块
 * @description 负责管理玩家输入、武器切换、热量管理、移动控制等核心战斗逻辑
 */

import { GameState, type Player, type Particle, ParticleType } from '../../types';

/**
 * 玩家控制系统配置接口
 */
export interface PlayerControlSystemConfig {
  /** 游戏难度 */
  difficulty: 'easy' | 'hard';
  /** 当前游戏状态 */
  gameState: GameState;
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 时间增量 */
  deltaTime: number;
  /** 鼠标X坐标 */
  mouseX: number;
  /** 鼠标Y坐标 */
  mouseY: number;
  /** 是否正在开火 */
  isFiring: boolean;
  /** 是否处于教程暂停状态 */
  tutorialPauseSpawn?: boolean;
  /** 玩家天赋加成 */
  talentMultipliers?: {
    /** 热量衰减率加成 */
    heatDecayRate?: number;
    /** 过热阈值加成 */
    overheatThreshold?: number;
    /** 伤害加成 */
    damageMultiplier?: number;
    /** 射程加成 */
    fireRange?: number;
    /** 燃气消耗率加成 */
    gasCostMultiplier?: number;
  };
  /** 添加浮动文字回调 */
  onAddFloatingText?: (x: number, y: number, text: string, color: string, duration?: number, fontSize?: number) => void;
  /** 添加粒子回调 */
  onAddParticle?: (particle: Particle) => void;
  /** 播放音效回调 */
  onPlaySound?: (soundId: string) => void;
  /** 停止音效回调 */
  onStopSound?: (soundId: string) => void;
  /** 屏幕震动回调 */
  onVibrate?: () => void;
  /** 玩家更新回调 */
  onPlayerUpdate?: (player: Player) => void;
}

/**
 * 玩家控制系统类
 * @description 管理玩家输入、武器切换、热量管理、移动控制等核心战斗逻辑
 */
export class PlayerControlSystem {
  /** 系统配置 */
  private config: PlayerControlSystemConfig;
  /** 玩家状态 */
  private player: Player;
  /** 热量警告计时器 */
  private heatWarningTimer: number = 0;
  /** 屏幕震动强度 */
  private screenShake: number = 0;

  /**
   * 构造函数
   * @param config - 系统配置
   */
  constructor(config: PlayerControlSystemConfig) {
    this.config = config;
    
    // 初始化玩家状态
    this.player = {
      x: config.canvasWidth / 2,
      y: config.canvasHeight - 100,
      angle: -Math.PI / 2,
      isFiring: false,
      flameMode: 'cone',
      currentWeapon: 'flamethrower',
      isTempWeapon: false,
      weaponTimer: 0,
      weaponAmmo: {
        flamethrower: Infinity,
        sticky: 0,
        poison: 0,
        shotgun: 0,
        molotov: 0,
      },
      gas: 100,
      maxGas: 100,
      heat: 0,
      maxHeat: 1800,
      overheatThreshold: 1800,
      isOverheated: false,
      overheatTimer: 0,
      heatDecayRate: 1.5,
      isReloading: false,
      reloadTimer: 0,
      maxReloadTime: 8,
      coolingTimer: 0,
      heatWarningTimer: 0,
      powerBoostTimer: 0,
      shieldTimer: 0,
      baitTimer: 0,
      paralyzeTimer: 0,
      damageMultiplier: 1,
      fireRange: 440,
      flameSpreadMultiplier: 1,
      reloadTimeMultiplier: 1,
      gasCostMultiplier: 1,
      shotgunPellets: 5,
      molotovCount: 0,
      shieldActive: false,
      shieldHp: 0,
      damageReduction: 0,
      weaponsUnlocked: ['flamethrower'],
      money: 0,
    };

    // 应用天赋加成
    this.applyTalentMultipliers();
  }

  /**
   * 应用天赋加成
   */
  private applyTalentMultipliers(): void {
    const multipliers = this.config.talentMultipliers || {};
    
    if (multipliers.heatDecayRate) {
      this.player.heatDecayRate *= multipliers.heatDecayRate;
    }
    
    if (multipliers.overheatThreshold) {
      this.player.overheatThreshold *= multipliers.overheatThreshold;
    }
    
    if (multipliers.damageMultiplier) {
      this.player.damageMultiplier *= multipliers.damageMultiplier;
    }
    
    if (multipliers.fireRange) {
      this.player.fireRange *= multipliers.fireRange;
    }
    
    if (multipliers.gasCostMultiplier) {
      this.player.gasCostMultiplier *= multipliers.gasCostMultiplier;
    }
  }

  /**
   * 更新系统配置
   * @param config - 新的配置
   */
  updateConfig(config: Partial<PlayerControlSystemConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取玩家状态
   * @returns 玩家状态
   */
  getPlayer(): Player {
    return { ...this.player };
  }

  /**
   * 更新玩家状态
   * @param deltaTime - 时间增量
   */
  update(deltaTime: number): void {
    this.config.deltaTime = deltaTime;
    
    // 更新玩家位置和角度
    this.updatePlayerPosition();
    
    // 检查临时武器是否过期
    this.checkTempWeapon();
    
    // 检查热量警告
    this.checkHeatWarning();
    
    // 处理开火逻辑
    this.handleFiring();
    
    // 更新热量衰减
    this.updateHeatDecay();
    
    // 更新过热状态
    this.updateOverheat();
    
    // 更新热量警告计时器
    this.updateHeatWarningTimer();
    
    // 更新重新装填状态
    this.updateReloading();
    
    // 检查燃气耗尽
    this.checkGasEmpty();
    
    // 调用玩家更新回调
    if (this.config.onPlayerUpdate) {
      this.config.onPlayerUpdate(this.player);
    }
  }

  /**
   * 更新玩家位置和角度
   */
  private updatePlayerPosition(): void {
    const { tutorialPauseSpawn, mouseX, canvasWidth } = this.config;
    
    // 教程暂停状态下，只更新位置，不处理其他逻辑
    if (tutorialPauseSpawn) {
      this.player.x = Math.max(10, Math.min(canvasWidth - 10, mouseX));
      this.player.angle = -Math.PI / 2;
      this.player.isFiring = false; // 强制停止火焰喷射器
      
      if (this.config.onStopSound) {
        this.config.onStopSound('fire');
      }
      return;
    }

    // 更新麻痹计时器
    if (this.player.paralyzeTimer > 0) {
      this.player.paralyzeTimer -= this.config.deltaTime;
      if (this.player.paralyzeTimer < 0) this.player.paralyzeTimer = 0;
    }

    // 麻痹状态下，不能移动并强制停止火焰喷射器
    if (this.player.paralyzeTimer > 0) {
      this.player.isFiring = false;
      
      // 麻痹效果：在防线位置显示紫色火花特效
      const defenseLineY = this.config.canvasHeight * 0.7; // 假设防线在70%高度
      if (Math.random() < 0.4 && this.config.onAddParticle) {
        this.config.onAddParticle({
          x: this.player.x + (Math.random() - 0.5) * 40,
          y: defenseLineY - 40 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 50,
          vy: -30 - Math.random() * 40,
          life: 0.4,
          maxLife: 0.4,
          size: 4,
          color: '#ff00ff',
          type: ParticleType.SPARK,
        });
      }
      
      this.player.angle = -Math.PI / 2;
      return;
    }

    // 正常移动
    this.player.x = Math.max(10, Math.min(canvasWidth - 10, mouseX));
    this.player.angle = -Math.PI / 2;
  }

  /**
   * 检查临时武器是否过期
   */
  private checkTempWeapon(): void {
    if (this.player.isTempWeapon && this.player.weaponTimer > 0) {
      this.player.weaponTimer -= this.config.deltaTime;
      if (this.player.weaponTimer <= 0) {
        this.player.currentWeapon = 'flamethrower';
        this.player.isTempWeapon = false;
        
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.player.x,
            this.player.y - 60,
            '武器已过期',
            '#9ca3af'
          );
        }
      }
    }
  }

  /**
   * 检查热量警告
   */
  private checkHeatWarning(): void {
    const warnThreshold = this.player.overheatThreshold - 300; // 1500 for default overheatThreshold=1800
    
    if (this.player.heat >= warnThreshold && 
        this.heatWarningTimer <= 0 && 
        !this.player.isOverheated &&
        this.config.onAddFloatingText) {
      
      this.heatWarningTimer = 3;
      this.config.onAddFloatingText(
        this.player.x,
        this.player.y - 60,
        '⚠️ 枪管冷却中!',
        '#fbbf24',
        1500,
        18
      );
    }
  }

  /**
   * 处理开火逻辑
   */
  private handleFiring(): void {
    const { isFiring, tutorialPauseSpawn } = this.config;
    
    // 阻止麻痹状态下的开火
    if (this.player.paralyzeTimer > 0) {
      this.player.isFiring = false;
    }
    
    // 设置开火状态
    this.player.isFiring = isFiring;
    
    // 检查是否可以开火
    if (this.player.isFiring && 
        !this.player.isOverheated && 
        !this.player.isReloading && 
        this.player.gas > 0 && 
        this.player.paralyzeTimer <= 0 &&
        !tutorialPauseSpawn) {
      
      const ammoKey = this.player.currentWeapon;
      const ammo = this.player.weaponAmmo[ammoKey] || 0;
      
      // 检查弹药是否耗尽（火焰喷射器除外）
      if (ammo <= 0 && ammoKey !== 'flamethrower') {
        this.player.currentWeapon = 'flamethrower';
        this.player.isTempWeapon = false;
        return;
      }

      // 播放开火音效
      if (this.config.onPlaySound) {
        this.config.onPlaySound('fire');
      }

      // 根据当前武器处理开火逻辑
      switch (this.player.currentWeapon) {
        case 'flamethrower':
          this.updateFlamethrower();
          break;
        case 'sticky':
          // 粘性板是放置物品，不是武器 - 由selectItem/onItemRelease处理
          break;
        case 'poison':
          this.updatePoisonSpray();
          break;
        case 'shotgun':
          this.updateShotgun();
          break;
        case 'molotov':
          // 燃烧瓶是点击投掷，不是持续开火
          break;
      }

      // 消耗临时武器弹药
      if (this.player.isTempWeapon && ammoKey !== 'flamethrower') {
        this.player.weaponAmmo[ammoKey] = Math.max(
          0, 
          (this.player.weaponAmmo[ammoKey] || 0) - this.config.deltaTime * 3
        );
      }
    } else {
      // 停止开火音效
      if (this.config.onStopSound) {
        this.config.onStopSound('fire');
      }
    }
  }

  /**
   * 更新火焰喷射器
   */
  private updateFlamethrower(): void {
    const gasCost = this.config.deltaTime * (this.player.powerBoostTimer > 0 ? 2 : 1);
    const heatGain = this.config.deltaTime * 1.0;
    
    // 生成锥形火焰（这里只是逻辑，实际生成由其他系统处理）
    // this.spawnConeFire(...);
    
    // 强力提升期间在火焰尖端生成黑烟粒子
    if (this.player.powerBoostTimer > 0 && 
        this.config.onAddParticle && 
        Math.random() < 0.4) {
      
      const tipY = this.player.y - 322 - this.player.fireRange * 0.5;
      this.config.onAddParticle({
        x: this.player.x + (Math.random() - 0.5) * 20,
        y: tipY,
        vx: (Math.random() - 0.5) * 15,
        vy: -(20 + Math.random() * 30),
        life: 1.5 + Math.random(),
        maxLife: 2.5,
        color: '#2a2a2a',
        size: 4 + Math.random() * 6,
        type: ParticleType.SMOKE,
      });
    }
    
    // 消耗燃气
    this.player.gas -= gasCost * this.player.gasCostMultiplier;
    if (this.player.gas < 0) this.player.gas = 0;
    
    // 增加热量
    this.player.heat += heatGain * 100;

    // 检查是否过热
    if (this.player.heat >= this.player.overheatThreshold) {
      this.player.heat = this.player.overheatThreshold;
      this.player.isOverheated = true;
      this.player.overheatTimer = 10;
      this.heatWarningTimer = 0; // 清除警告
      
      // 生成烟雾粒子
      if (this.config.onAddParticle) {
        for (let i = 0; i < 30; i++) {
          this.config.onAddParticle({
            x: this.player.x + (Math.random() - 0.5) * 60,
            y: this.player.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 80,
            vy: -(30 + Math.random() * 50),
            life: 1 + Math.random() * 1.5,
            maxLife: 2.5,
            color: '#4a4a4a',
            size: 3 + Math.random() * 5,
            type: ParticleType.SMOKE,
          });
        }
      }
      
      // 屏幕震动
      this.screenShake = 3;
      if (this.config.onVibrate) {
        this.config.onVibrate();
      }
    }
  }

  /**
   * 更新毒气喷雾
   */
  private updatePoisonSpray(): void {
    const gasCost = this.config.deltaTime;
    
    // 生成锥形毒气（这里只是逻辑，实际生成由其他系统处理）
    // this.spawnConeFire(...);
    
    // 消耗燃气
    this.player.gas -= gasCost * this.player.gasCostMultiplier;
    if (this.player.gas < 0) this.player.gas = 0;
    
    // 增加热量
    this.player.heat += this.config.deltaTime * 80;
    
    // 检查是否过热
    if (this.player.heat >= this.player.overheatThreshold) {
      this.player.heat = this.player.overheatThreshold;
      this.player.isOverheated = true;
      this.player.overheatTimer = 6;
    }
  }

  /**
   * 更新霰弹枪
   */
  private updateShotgun(): void {
    // 霰弹枪逻辑将在后续实现
    // 暂时只消耗燃气和增加热量
    const gasCost = this.config.deltaTime * 1.5;
    
    this.player.gas -= gasCost * this.player.gasCostMultiplier;
    if (this.player.gas < 0) this.player.gas = 0;
    
    this.player.heat += this.config.deltaTime * 120;
    
    if (this.player.heat >= this.player.overheatThreshold) {
      this.player.heat = this.player.overheatThreshold;
      this.player.isOverheated = true;
      this.player.overheatTimer = 8;
    }
  }

  /**
   * 更新热量衰减
   */
  private updateHeatDecay(): void {
    if (!this.player.isFiring) {
      this.player.heat -= this.config.deltaTime * 360 * this.player.heatDecayRate;
      if (this.player.heat < 0) this.player.heat = 0;
    }
  }

  /**
   * 更新过热状态
   */
  private updateOverheat(): void {
    if (this.player.isOverheated) {
      this.player.overheatTimer -= this.config.deltaTime;
      if (this.player.overheatTimer <= 0) {
        this.player.isOverheated = false;
        this.player.heat = 0;
        
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.config.canvasWidth / 2,
            this.config.canvasHeight / 2,
            '>>> 开 火 <<<',
            '#22c55e',
            2000,
            28
          );
        }
      }
    }
  }

  /**
   * 更新热量警告计时器
   */
  private updateHeatWarningTimer(): void {
    if (this.heatWarningTimer > 0) {
      this.heatWarningTimer -= this.config.deltaTime;
      if (this.heatWarningTimer < 0) this.heatWarningTimer = 0;
    }
  }

  /**
   * 更新重新装填状态
   */
  private updateReloading(): void {
    if (this.player.isReloading) {
      this.player.reloadTimer -= this.config.deltaTime;
      if (this.player.reloadTimer <= 0) {
        this.player.isReloading = false;
        this.player.gas = this.player.maxGas;
        
        if (this.config.onAddFloatingText) {
          this.config.onAddFloatingText(
            this.config.canvasWidth / 2,
            this.config.canvasHeight / 2,
            '>>> 开 火 <<<',
            '#22c55e',
            2000,
            28
          );
        }
      }
    }
  }

  /**
   * 检查燃气耗尽
   */
  private checkGasEmpty(): void {
    if (this.player.gas <= 0 && 
        !this.player.isReloading && 
        !this.player.isOverheated) {
      this.startReload();
    }
  }

  /**
   * 开始重新装填
   */
  startReload(): void {
    this.player.isReloading = true;
    this.player.reloadTimer = 3; // 3秒装填时间
  }

  /**
   * 切换武器
   * @param weaponId - 武器ID
   */
  switchWeapon(weaponId: Player['currentWeapon']): void {
    if (this.player.currentWeapon === weaponId) return;
    
    this.player.currentWeapon = weaponId;
    this.player.isTempWeapon = weaponId !== 'flamethrower';
    
    if (this.player.isTempWeapon) {
      this.player.weaponTimer = 30; // 临时武器持续时间30秒
    }
  }

  /**
   * 添加弹药
   * @param weaponId - 武器ID
   * @param amount - 弹药数量
   */
  addAmmo(weaponId: string, amount: number): void {
    if (!this.player.weaponAmmo[weaponId]) {
      this.player.weaponAmmo[weaponId] = 0;
    }
    
    this.player.weaponAmmo[weaponId] += amount;
  }

  /**
   * 激活强力提升
   * @param duration - 持续时间（秒）
   */
  activatePowerBoost(duration: number): void {
    this.player.powerBoostTimer = duration;
  }

  /**
   * 麻痹玩家
   * @param duration - 麻痹持续时间（秒）
   */
  paralyzePlayer(duration: number): void {
    this.player.paralyzeTimer = duration;
    this.player.isFiring = false; // 强制停止开火
  }

  /**
   * 获取屏幕震动强度
   * @returns 屏幕震动强度
   */
  getScreenShake(): number {
    return this.screenShake;
  }

  /**
   * 更新屏幕震动
   * @param deltaTime - 时间增量
   */
  updateScreenShake(deltaTime: number): void {
    if (this.screenShake > 0) {
      this.screenShake -= deltaTime * 10;
      if (this.screenShake < 0) this.screenShake = 0;
    }
  }
}
