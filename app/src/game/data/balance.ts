/**
 * @fileoverview 全局平衡参数配置（barrel 文件）
 * @description 从各领域模块导入并合并 BALANCE_CONFIG，保持向后兼容。
 * 实际数据定义已拆分到：
 *   - enemies.ts: defense / player / collision / roachAI
 *   - items.ts: weaponDamage / weapons / boss / consumable / economy / ...
 *   - render-balance.ts: screenShake / performance / particle / render / ...
 *   - waves.ts: wave
 * 6 段 UI 文案（pause/itemReveal/itemRecycle/sceneSelect/preparation/talentTree）
 * 已从 BALANCE_CONFIG 移除，统一使用 TEXT_CONFIG。
 * 
 * 使用方式：import { BALANCE_CONFIG } from './data';
 *          BALANCE_CONFIG.player.baseGasCapacity 等
 */

import { BALANCE_ENEMIES } from './enemies';
import { BALANCE_ITEMS } from './items';
import { BALANCE_RENDER } from './render-balance';
import { BALANCE_WAVE } from './waves';

/**
 * 全局平衡配置
 * 通过对象展开将四个子模块的数据合并为一个统一的配置对象。
 * 子模块字段：
 * - BALANCE_ENEMIES: 防线、玩家、碰撞检测、蟑螂 AI 参数
 * - BALANCE_ITEMS: 武器伤害、道具、消耗品、Boss、经济参数
 * - BALANCE_RENDER: 屏幕震动、粒子、渲染、天气参数
 * - BALANCE_WAVE: 波次系统参数
 */
export const BALANCE_CONFIG = {
  ...BALANCE_ENEMIES,
  ...BALANCE_ITEMS,
  ...BALANCE_RENDER,
  ...BALANCE_WAVE,
} as const;