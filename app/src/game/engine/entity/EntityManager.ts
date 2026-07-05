/**
 * @fileoverview 实体系统管理器
 * @description 负责管理游戏中的所有实体，包括蟑螂、子弹、特效等
 */

import type { Roach, Particle, FireZone, FireWall, StickyBoard, StickyDrop, FanState, RadarLaser, ThrowableProjectile, SceneType } from '../../types';
import { RoachType, RoachState } from '../../types';
import { RoachManager } from './RoachManager';
import { BOSS_CONFIG, ENEMY_DEFS } from '../../data';

/**
 * 实体管理器类
 * @description 管理游戏中的所有实体
 */
export class EntityManager {
  private roachManager: RoachManager;
  private particles: Particle[] = [];
  private fireZones: FireZone[] = [];
  private fireWalls: FireWall[] = [];
  private stickyBoards: StickyBoard[] = [];
  private stickyDrops: StickyDrop[] = [];
  private fanStates: FanState[] = [];
  private radarLasers: RadarLaser[] = [];
  private throwableProjectiles: ThrowableProjectile[] = [];
  private deltaTime: number = 0;

  /**
   * 构造函数
   * @param {number} width - 游戏区域宽度
   * @param {number} height - 游戏区域高度
   * @param {() => number} defenseLineY - 获取防御线Y坐标的函数
   * @param {SceneType} [currentScene] - 当前场景类型（可选）
   */
  constructor(width: number, height: number, defenseLineY: () => number, currentScene?: SceneType) {
    this.roachManager = new RoachManager(width, height, defenseLineY, currentScene);
  }

  /**
   * 更新所有实体
   * @param {number} deltaTime - 时间增量
   */
  update(deltaTime: number): void {
    this.deltaTime = deltaTime;
    this.roachManager.update(deltaTime);
    this.updateParticles();
    this.updateFireZones();
    this.updateFireWalls();
    this.updateStickyDrops();
    this.updateThrowableProjectiles();
  }

  /**
   * 获取蟑螂管理器
   * @returns {RoachManager} 蟑螂管理器
   */
  getRoachManager(): RoachManager {
    return this.roachManager;
  }

  /**
   * 获取所有蟑螂实体
   * @returns {Roach[]} 蟑螂实体列表
   */
  getRoaches(): Roach[] {
    return this.roachManager.getRoaches();
  }

  /**
   * 设置蟑螂实体列表
   * @param {Roach[]} roaches - 蟑螂实体列表
   */
  setRoaches(roaches: Roach[]): void {
    this.roachManager.setRoaches(roaches);
  }

  /**
   * 获取所有粒子
   * @returns {Particle[]} 粒子列表
   */
  getParticles(): Particle[] {
    return this.particles;
  }

  /**
   * 设置粒子列表
   * @param {Particle[]} particles - 粒子列表
   */
  setParticles(particles: Particle[]): void {
    this.particles = particles;
  }

  /**
   * 获取所有火焰区域
   * @returns {FireZone[]} 火焰区域列表
   */
  getFireZones(): FireZone[] {
    return this.fireZones;
  }

  /**
   * 设置火焰区域列表
   * @param {FireZone[]} fireZones - 火焰区域列表
   */
  setFireZones(fireZones: FireZone[]): void {
    this.fireZones = fireZones;
  }

  /**
   * 获取所有火焰墙
   * @returns {FireWall[]} 火焰墙列表
   */
  getFireWalls(): FireWall[] {
    return this.fireWalls;
  }

  /**
   * 设置火焰墙列表
   * @param {FireWall[]} fireWalls - 火焰墙列表
   */
  setFireWalls(fireWalls: FireWall[]): void {
    this.fireWalls = fireWalls;
  }

  /**
   * 获取所有粘板
   * @returns {StickyBoard[]} 粘板列表
   */
  getStickyBoards(): StickyBoard[] {
    return this.stickyBoards;
  }

  /**
   * 设置粘板列表
   * @param {StickyBoard[]} stickyBoards - 粘板列表
   */
  setStickyBoards(stickyBoards: StickyBoard[]): void {
    this.stickyBoards = stickyBoards;
  }

  /**
   * 获取所有粘性弹丸
   * @returns {StickyDrop[]} 粘性弹丸列表
   */
  getStickyDrops(): StickyDrop[] {
    return this.stickyDrops;
  }

  /**
   * 设置粘性弹丸列表
   * @param {StickyDrop[]} stickyDrops - 粘性弹丸列表
   */
  setStickyDrops(stickyDrops: StickyDrop[]): void {
    this.stickyDrops = stickyDrops;
  }

  /**
   * 获取所有风扇状态
   * @returns {FanState[]} 风扇状态列表
   */
  getFanStates(): FanState[] {
    return this.fanStates;
  }

  /**
   * 设置风扇状态列表
   * @param {FanState[]} fanStates - 风扇状态列表
   */
  setFanStates(fanStates: FanState[]): void {
    this.fanStates = fanStates;
  }

  /**
   * 获取所有雷达激光
   * @returns {RadarLaser[]} 雷达激光列表
   */
  getRadarLasers(): RadarLaser[] {
    return this.radarLasers;
  }

  /**
   * 设置雷达激光列表
   * @param {RadarLaser[]} radarLasers - 雷达激光列表
   */
  setRadarLasers(radarLasers: RadarLaser[]): void {
    this.radarLasers = radarLasers;
  }

  /**
   * 获取所有投掷物
   * @returns {ThrowableProjectile[]} 投掷物列表
   */
  getThrowableProjectiles(): ThrowableProjectile[] {
    return this.throwableProjectiles;
  }

  /**
   * 设置投掷物列表
   * @param {ThrowableProjectile[]} throwableProjectiles - 投掷物列表
   */
  setThrowableProjectiles(throwableProjectiles: ThrowableProjectile[]): void {
    this.throwableProjectiles = throwableProjectiles;
  }

  /**
   * 更新时间和增量时间
   * @param {number} time - 当前时间
   * @param {number} deltaTime - 时间增量
   */
  updateTime(time: number, deltaTime: number): void {
    this.roachManager.updateTime(time, deltaTime);
  }

  /**
   * 更新所有实体
   * @param {Function} updateStatusEffects - 更新状态效果的函数
   * @param {Function} isStuckByBoard - 检查是否被粘板粘住的函数
   * @param {Function} addFloatingText - 添加浮动文本的函数
   */
  updateEntities(
    updateStatusEffects: (roach: Roach) => void,
    isStuckByBoard: (id: number) => boolean
  ): void {
    this.roachManager.updateRoaches(updateStatusEffects, isStuckByBoard);
    
    // 更新粒子
    this.updateParticles();
    
    // 更新火焰区域
    this.updateFireZones();
    
    // 更新火焰墙
    this.updateFireWalls();
    
    // 更新粘性弹丸
    this.updateStickyDrops();
    
    // 更新投掷物
    this.updateThrowableProjectiles();
  }

  /**
   * 更新粒子
   */
  private updateParticles(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= this.deltaTime;
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      // 更新粒子位置
      p.x += p.vx * this.deltaTime;
      p.y += p.vy * this.deltaTime;
    }
  }

  /**
   * 更新火焰区域
   */
  private updateFireZones(): void {
    for (let i = this.fireZones.length - 1; i >= 0; i--) {
      const fz = this.fireZones[i];
      fz.life -= this.deltaTime;
      
      if (fz.life <= 0) {
        this.fireZones.splice(i, 1);
      }
    }
  }

  /**
   * 更新火焰墙
   */
  private updateFireWalls(): void {
    for (let i = this.fireWalls.length - 1; i >= 0; i--) {
      const fw = this.fireWalls[i];
      fw.life -= this.deltaTime;
      
      if (fw.life <= 0) {
        this.fireWalls.splice(i, 1);
      }
    }
  }

  /**
   * 更新粘性弹丸
   */
  private updateStickyDrops(): void {
    for (let i = this.stickyDrops.length - 1; i >= 0; i--) {
      const sd = this.stickyDrops[i];
      sd.life -= this.deltaTime;
      
      if (sd.life <= 0) {
        this.stickyDrops.splice(i, 1);
      }
    }
  }

  /**
   * 更新投掷物
   */
  private updateThrowableProjectiles(): void {
    for (let i = this.throwableProjectiles.length - 1; i >= 0; i--) {
      const tp = this.throwableProjectiles[i];
      tp.life -= this.deltaTime;
      
      if (tp.life <= 0) {
        this.throwableProjectiles.splice(i, 1);
        continue;
      }
      
      // 更新投掷物位置
      tp.x += tp.vx * this.deltaTime;
      tp.y += tp.vy * this.deltaTime;
    }
  }

  /**
   * 清除所有实体
   */
  clearAll(): void {
    this.roachManager.clearAll();
    this.particles = [];
    this.fireZones = [];
    this.fireWalls = [];
    this.stickyBoards = [];
    this.stickyDrops = [];
    this.fanStates = [];
    this.radarLasers = [];
    this.throwableProjectiles = [];
  }

  /**
   * 获取实体统计信息
   * @returns {Record<string, number>} 实体统计信息
   */
  getEntityStats(): Record<string, number> {
    return {
      roaches: this.roachManager.getRoachCount(),
      particles: this.particles.length,
      fireZones: this.fireZones.length,
      fireWalls: this.fireWalls.length,
      stickyBoards: this.stickyBoards.length,
      stickyDrops: this.stickyDrops.length,
      fanStates: this.fanStates.length,
      radarLasers: this.radarLasers.length,
      throwableProjectiles: this.throwableProjectiles.length
    };
  }

  /**
   * 更新蟑螂列表
   * @param {Roach[]} roaches - 新的蟑螂列表
   */
  updateRoaches(roaches: Roach[]): void {
    this.roachManager.setRoaches(roaches);
  }

  /**
   * 移除指定的蟑螂
   * @param {number[]} roachIds - 要移除的蟑螂ID列表
   */
  removeRoaches(roachIds: number[]): void {
    const currentRoaches = this.getRoaches();
    const updatedRoaches = currentRoaches.filter(roach => !roachIds.includes(roach.id));
    this.setRoaches(updatedRoaches);
  }

  /**
   * 皇后产卵 - 生成小蟑螂
   * @description 从旧引擎移植：女王蟑螂定期召唤小蟑螂
   * 每 BOSS_CONFIG.queen.spawnInterval (8秒) 触发一次
   * 生成 BOSS_CONFIG.queen.minionCount (3) 只小蟑螂
   * @param queenRoach 皇后蟑螂实例
   */
  spawnQueenEggs(queenRoach: Roach): void {
    const count = BOSS_CONFIG.queen.minionCount;
    for (let m = 0; m < count; m++) {
      const newRoach = this.roachManager.spawnRoach(RoachType.SMALL);
      if (newRoach) {
        // 在皇后附近生成
        newRoach.x = queenRoach.x + (Math.random() - 0.5) * 60;
        newRoach.y = queenRoach.y + (Math.random() - 0.5) * 40;
      }
    }
  }

  /**
   * 变异体胚胎爆发 - 生成胚胎蟑螂
   * @description 从旧引擎移植：变异体蟑螂死亡后触发7帧转换动画
   * 动画完成后随机生成以下组合之一：
   * - 50%: 2只小蟑螂
   * - 30%: 1只小蟑螂 + 1只飞行蟑螂
   * - 20%: 1只小蟑螂 + 1只自爆蟑螂
   * @param parentRoach 变异体蟑螂实例（已死亡）
   */
  spawnEmbryoRoaches(parentRoach: Roach): void {
    const sx = parentRoach.x;
    const sy = parentRoach.y;

    // 随机决定生成类型
    const roll = Math.random();
    let spawnTypes: RoachType[];
    if (roll < 0.5) {
      spawnTypes = [RoachType.SMALL, RoachType.SMALL]; // 50%
    } else if (roll < 0.8) {
      spawnTypes = [RoachType.SMALL, RoachType.FLYING]; // 30%
    } else {
      spawnTypes = [RoachType.SMALL, RoachType.SUICIDE]; // 20%
    }

    let spawnedCount = 0;
    for (const spawnType of spawnTypes) {
      const newRoach = this.roachManager.spawnRoach(spawnType);
      if (!newRoach) break;
      spawnedCount++;

      // 在变异体死亡位置生成
      newRoach.x = sx;
      newRoach.y = sy;
      newRoach.hp = ENEMY_DEFS[spawnType].hp;
      newRoach.maxHp = ENEMY_DEFS[spawnType].hp;
      newRoach.slimeTimer = 2.0;
      newRoach.wasMutantSpawn = true;
      // 1秒生成免疫：冻结在原地 + 无敌
      newRoach.spawnImmuneTimer = 1.0;

      if (spawnType === RoachType.SUICIDE) {
        newRoach.size = Math.floor(ENEMY_DEFS[spawnType].size * 0.6);
        newRoach.hp = ENEMY_DEFS[spawnType].hp;
        newRoach.maxHp = ENEMY_DEFS[spawnType].hp;
        newRoach.fuseTimer = 3;
      }
    }
  }
}