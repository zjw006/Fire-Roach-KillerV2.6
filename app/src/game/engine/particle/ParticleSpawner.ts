/**
 * @fileoverview 粒子生成器 —— 从引擎迁移的粒子生成静态方法
 * @description 提供 10 种粒子类型（fire, smoke, ash, blood, spark, explosion, debris, fireRing, shockwave, lightning）的生成方法
 * 所有方法均为纯静态方法，接收目标数组作为参数，不依赖引擎实例
 */

import { ParticleType } from '../../types';
import type { Particle, FireZone } from '../../types';

/**
 * 粒子生成器 —— 静态方法集合
 */
export class ParticleSpawner {

  // ========== 锥形火焰粒子 ==========

  static spawnConeFire(
    particles: Particle[],
    fireZones: FireZone[],
    deltaTime: number,
    gx: number, gy: number, angle: number, range: number, _spread: number, baseDamage: number, type: 'fire' | 'ice' | 'poison' = 'fire'
  ): void {
    const count = Math.floor(3 + Math.random() * 3);
    const isIce = type === 'ice';
    const isPoison = type === 'poison';

    for (let i = 0; i < count; i++) {
      const rDist = Math.random() * range;
      const rAngle = angle + (Math.random() - 0.5) * 0.5;
      const px = gx + Math.cos(rAngle) * rDist;
      const py = gy + Math.sin(rAngle) * rDist;
      const life = 0.06 + Math.random() * 0.08;
      const flowSpeed = 100 + Math.random() * 60;
      let color = '';
      let particleType: ParticleType;
      let size = 0;

      if (isIce) {
        color = `rgba(${180 + Math.random() * 40}, ${220 + Math.random() * 20}, 255, ${0.5 + Math.random() * 0.5})`;
        particleType = ParticleType.ICE;
        size = 2 + Math.random() * 4;
      } else if (isPoison) {
        color = `rgba(${100 + Math.random() * 40}, ${220 + Math.random() * 30}, ${100 + Math.random() * 40}, ${0.4 + Math.random() * 0.4})`;
        particleType = ParticleType.POISON_CLOUD;
        size = 3 + Math.random() * 5;
      } else {
        const temp = Math.random();
        if (temp < 0.5) {
          color = `rgba(255, ${100 + Math.random() * 80}, ${Math.random() * 40}, ${0.7 + Math.random() * 0.3})`;
          particleType = ParticleType.FIRE;
          size = 2 + Math.random() * 5;
        } else {
          color = `rgba(255, ${200 + Math.random() * 55}, ${50 + Math.random() * 50}, ${0.5 + Math.random() * 0.5})`;
          particleType = ParticleType.EMBER;
          size = 1 + Math.random() * 3;
        }
      }

      particles.push({
        x: px, y: py,
        vx: Math.cos(rAngle) * flowSpeed,
        vy: Math.sin(rAngle) * flowSpeed,
        life, maxLife: life,
        size, color,
        type: particleType,
      });
    }

    // Single spark at gun muzzle
    particles.push({
      x: gx, y: gy,
      vx: (Math.random() - 0.5) * 60,
      vy: -60 - Math.random() * 40,
      life: 0.08,
      maxLife: 0.08,
      size: 2 + Math.random() * 3,
      color: '#fff',
      type: ParticleType.SPARK,
    });

    // Add fire zone
    fireZones.push({
      x: gx + Math.cos(angle) * range / 2,
      y: gy + Math.sin(angle) * range / 2,
      radius: range * 0.8,
      damagePerSecond: baseDamage / deltaTime * 3,
      life: 0.5, maxLife: 0.5,
      type,
    });
    if (fireZones.length > 25) {
      fireZones.length = 25;
    }
  }

  // ========== 烟雾粒子 ==========

  static spawnSmokeParticles(particles: Particle[], x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 50,
        life: 1 + Math.random() * 2, maxLife: 1 + Math.random() * 2,
        size: 6 + Math.random() * 16,
        color: `hsl(0, 0%, ${35 + Math.random() * 35}%)`,
        type: ParticleType.SMOKE,
      });
    }
  }

  // ========== 灰烬粒子 ==========

  static spawnAshParticles(particles: Particle[], x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.6 + Math.random() * 1.0, maxLife: 0.6 + Math.random() * 1.0,
        size: 2 + Math.random() * 6,
        color: `hsl(0, 0%, ${5 + Math.random() * 20}%)`,
        type: ParticleType.ASH,
      });
    }
  }

  // ========== 血粒子 ==========

  static spawnBloodParticles(particles: Particle[], x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 40,
        life: 0.5, maxLife: 0.5,
        size: 4 + Math.random() * 10,
        color: `rgba(${20 + Math.random() * 40}, ${120 + Math.random() * 60}, ${20 + Math.random() * 40}, ${0.5 + Math.random() * 0.5})`,
        type: ParticleType.BLOOD,
      });
    }
  }

  // ========== 火花粒子 ==========

  static spawnSparkParticles(particles: Particle[], x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.4, maxLife: 0.2 + Math.random() * 0.4,
        size: 1 + Math.random() * 3,
        color: `hsl(${30 + Math.random() * 30}, 100%, 75%)`,
        type: ParticleType.SPARK,
      });
    }
  }

  // ========== 爆炸粒子 ==========

  static spawnExplosionParticles(particles: Particle[], x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.3 + Math.random() * 0.5, maxLife: 0.3 + Math.random() * 0.5,
        size: 3 + Math.random() * 12,
        color: `hsl(${10 + Math.random() * 30}, 100%, ${50 + Math.random() * 25}%)`,
        type: ParticleType.EXPLOSION,
      });
    }
  }

  // ========== 碎片粒子（自爆蟑螂爆炸） ==========

  static spawnDebrisParticles(particles: Particle[], x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 3 + Math.random() * 2,
        maxLife: 3 + Math.random() * 2,
        size: 4 + Math.random() * 10,
        color: `hsl(${15 + Math.random() * 20}, 80%, ${30 + Math.random() * 20}%)`,
        type: ParticleType.ASH,
      });
    }
  }

  // ========== 火环粒子 ==========

  static spawnFireRingParticles(particles: Particle[], x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 1.5 + Math.random() * 1.5,
        maxLife: 1.5 + Math.random() * 1.5,
        size: 8 + Math.random() * 16,
        color: `hsl(${10 + Math.random() * 25}, 100%, 55%)`,
        type: ParticleType.EXPLOSION,
      });
    }
  }

  // ========== 冲击波环 ==========

  static spawnShockwaveRing(particles: Particle[], x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 150 + Math.random() * 200;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 0.8 + Math.random() * 0.4,
        size: 12 + Math.random() * 20,
        color: `rgba(255, ${200 + Math.random() * 55}, ${100 + Math.random() * 50}, 0.9)`,
        type: ParticleType.EXPLOSION,
      });
    }
    // Inner white core burst
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 150;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.5 + Math.random() * 0.3,
        size: 6 + Math.random() * 12,
        color: 'rgba(255, 255, 255, 0.95)',
        type: ParticleType.SPARK,
      });
    }
  }

  // ========== 闪电粒子（电蚊拍） ==========

  static spawnLightningParticles(particles: Particle[], centerX: number, topY: number, width: number, height: number): void {
    for (let i = 0; i < 20; i++) {
      const x = centerX + (Math.random() - 0.5) * width * 0.8;
      particles.push({
        x, y: topY + Math.random() * 50,
        vx: (Math.random() - 0.5) * 60,
        vy: 100 + Math.random() * 200,
        life: 0.4 + Math.random() * 0.4, maxLife: 0.4 + Math.random() * 0.4,
        size: 3 + Math.random() * 6,
        color: `rgba(150, 220, 255, ${0.6 + Math.random() * 0.4})`,
        type: ParticleType.LIGHTNING,
      });
    }
    for (let i = 0; i < 30; i++) {
      const x = centerX + (Math.random() - 0.5) * width;
      const y = Math.random() * height;
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100,
        life: 0.2 + Math.random() * 0.3, maxLife: 0.2 + Math.random() * 0.3,
        size: 2 + Math.random() * 4,
        color: `rgba(200, 240, 255, ${0.5 + Math.random() * 0.5})`,
        type: ParticleType.LIGHTNING,
      });
    }
  }
}