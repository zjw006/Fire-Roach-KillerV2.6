/**
 * @fileoverview 游戏武器管理器
 * @description 负责管理游戏中的武器系统，包括武器切换、弹药管理、武器掉落等
 */

import type { Player, WeaponDrop, FloatingText } from '../../types';
import { WEAPON_DROP_DEFS } from '../../data';

/**
 * 武器管理器类
 * @description 管理游戏中的武器系统
 */
export class WeaponManager {
  private weaponDrops: WeaponDrop[] = [];
  private nextDropId: number = 1;
  private player: Player;
  private floatingTexts: FloatingText[] = [];

  /**
   * 构造函数
   * @param {Player} player - 玩家对象
   */
  constructor(player: Player) {
    this.player = player;
    this.weaponDrops = [];
    this.nextDropId = 1;
  }

  /**
   * 获取武器掉落物列表
   * @returns {WeaponDrop[]} 武器掉落物列表
   */
  getWeaponDrops(): WeaponDrop[] {
    return this.weaponDrops;
  }

  /**
   * 设置武器掉落物列表
   * @param {WeaponDrop[]} drops - 武器掉落物列表
   */
  setWeaponDrops(drops: WeaponDrop[]): void {
    this.weaponDrops = drops;
  }

  /**
   * 获取浮动文本列表
   * @returns {FloatingText[]} 浮动文本列表
   */
  getFloatingTexts(): FloatingText[] {
    return this.floatingTexts;
  }

  /**
   * 设置浮动文本列表
   * @param {FloatingText[]} texts - 浮动文本列表
   */
  setFloatingTexts(texts: FloatingText[]): void {
    this.floatingTexts = texts;
  }

  /**
   * 切换武器
   * @param {string} weapon - 武器类型
   * @returns {boolean} 是否切换成功
   */
  switchWeapon(weapon: string): boolean {
    const p = this.player;
    
    if (weapon === 'flamethrower') {
      p.currentWeapon = 'flamethrower';
      p.isTempWeapon = false;
      return true;
    }

    const ammo = p.weaponAmmo[weapon] || 0;
    if (ammo <= 0 && !p.isTempWeapon && weapon !== 'flamethrower') return false;

    p.currentWeapon = weapon as Player['currentWeapon'];
    return true;
  }

  /**
   * 更新武器掉落物
   * @param {number} deltaTime - 时间增量
   * @param {boolean} tutorialPauseSpawn - 教程暂停生成标志
   */
  updateWeaponDrops(deltaTime: number, tutorialPauseSpawn: boolean = false): void {
    // 跳过教程暂停期间的武器掉落
    if (tutorialPauseSpawn) return;

    for (let i = this.weaponDrops.length - 1; i >= 0; i--) {
      const drop = this.weaponDrops[i];
      drop.life -= deltaTime;
      drop.bobPhase += deltaTime * 4;
      
      if (drop.life <= 0) {
        this.weaponDrops.splice(i, 1);
        continue;
      }
    }
  }

  /**
   * 生成武器掉落物
   * @param {number} count - 生成数量
   * @param {number} playerX - 玩家X坐标
   * @param {number} playerY - 玩家Y坐标
   * @param {number} screenWidth - 屏幕宽度
   * @returns {WeaponDrop[]} 生成的武器掉落物
   */
  spawnWeaponDrop(
    count: number = 1,
    playerX: number,
    playerY: number
  ): WeaponDrop[] {
    const newDrops: WeaponDrop[] = [];
    
    for (let i = 0; i < count; i++) {
      // 获取所有武器类型
      const weaponTypes = Object.keys(WEAPON_DROP_DEFS);
      if (weaponTypes.length === 0) continue;
      
      // 随机选择武器类型
    const typeKey = weaponTypes[Math.floor(Math.random() * weaponTypes.length)] as keyof typeof WEAPON_DROP_DEFS;
    
    // 生成位置
    const baseX = playerX;
    const baseY = playerY - 322; // 防御线位置
    const x = Math.random() < 0.5
      ? baseX - 100 + Math.random() * 200
      : baseX;
    const y = baseY + (Math.random() - 0.5) * 20; // 轻微Y变化
    
    const drop: WeaponDrop = {
      id: this.nextDropId++,
      x, y,
      type: typeKey,
      life: 12, maxLife: 12,
      bobPhase: Math.random() * Math.PI * 2,
    };
      
      newDrops.push(drop);
      this.weaponDrops.push(drop);
    }
    
    return newDrops;
  }

  /**
   * 拾取武器掉落物
   * @param {WeaponDrop} drop - 武器掉落物
   * @returns {boolean} 是否拾取成功
   */
  pickupWeaponDrop(drop: WeaponDrop): boolean {
    const p = this.player;
    const def = WEAPON_DROP_DEFS[drop.type as keyof typeof WEAPON_DROP_DEFS];
    if (!def) return false;

    // 添加弹药
    p.weaponAmmo[drop.type] = (p.weaponAmmo[drop.type] || 0) + def.ammo;
    
    return true;
  }

  /**
   * 检查武器掉落物拾取
   * @param {number} playerX - 玩家X坐标
   * @returns {WeaponDrop | null} 拾取的武器掉落物
   */
  checkWeaponDropPickup(playerX: number): WeaponDrop | null {
    for (let i = this.weaponDrops.length - 1; i >= 0; i--) {
      const drop = this.weaponDrops[i];
      const dx = Math.abs(drop.x - playerX);
      
      // 水平接近检测（掉落物在防御线附近）
      if (dx < 60) {
        const pickedUp = this.pickupWeaponDrop(drop);
        if (pickedUp) {
          this.weaponDrops.splice(i, 1);
          return drop;
        }
      }
    }
    
    return null;
  }

  /**
   * 更新武器计时器
   * @param {number} deltaTime - 时间增量
   */
  updateWeaponTimer(deltaTime: number): void {
    const p = this.player;
    
    // 检查临时武器是否过期
    if (p.isTempWeapon && p.weaponTimer > 0) {
      p.weaponTimer -= deltaTime;
      if (p.weaponTimer <= 0) {
        p.currentWeapon = 'flamethrower';
        p.isTempWeapon = false;
      }
    }
  }

  /**
   * 更新武器弹药
   * @param {number} deltaTime - 时间增量
   */
  updateWeaponAmmo(deltaTime: number): void {
    const p = this.player;
    const currentWeapon = p.currentWeapon;
    
    if (currentWeapon !== 'flamethrower') {
      const ammoKey = currentWeapon;
      
      if (p.isTempWeapon) {
        p.weaponAmmo[ammoKey] = Math.max(0, (p.weaponAmmo[ammoKey] || 0) - deltaTime * 3);
      }
    }
  }

  /**
   * 获取当前武器弹药
   * @returns {number} 当前武器弹药量
   */
  getCurrentWeaponAmmo(): number {
    const p = this.player;
    const currentWeapon = p.currentWeapon;
    
    if (currentWeapon === 'flamethrower') {
      return Infinity;
    }
    
    return p.weaponAmmo[currentWeapon] || 0;
  }

  /**
   * 检查武器是否已解锁
   * @param {string} weaponType - 武器类型
   * @returns {boolean} 是否已解锁
   */
  isWeaponUnlocked(weaponType: string): boolean {
    return this.player.weaponsUnlocked.includes(weaponType);
  }

  /**
   * 获取已解锁武器列表
   * @returns {string[]} 已解锁武器列表
   */
  getUnlockedWeapons(): string[] {
    return [...this.player.weaponsUnlocked];
  }

  /**
   * 添加浮动文本
   * @param {string} text - 文本内容
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {string} color - 文本颜色
   * @param {number} duration - 持续时间
   */
  addFloatingText(
    text: string,
    x: number,
    y: number,
    color: string = '#ffffff',
    duration: number = 1.5
  ): void {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      life: duration,
      maxLife: duration,
      vy: -60
    });
  }

  /**
   * 更新浮动文本
   * @param {number} deltaTime - 时间增量
   */
  updateFloatingTexts(deltaTime: number): void {
    const aliveTexts: FloatingText[] = [];
    
    for (const text of this.floatingTexts) {
      text.y += text.vy * deltaTime;
      text.life -= deltaTime;
      
      if (text.life > 0) {
        aliveTexts.push(text);
      }
    }
    
    this.floatingTexts = aliveTexts;
  }

  /**
   * 清空所有武器掉落物
   */
  clearWeaponDrops(): void {
    this.weaponDrops = [];
  }

  /**
   * 清空所有浮动文本
   */
  clearFloatingTexts(): void {
    this.floatingTexts = [];
  }
}