/**
 * @fileoverview 游戏内 HUD 覆盖层组件。
 * 显示战斗中的各类实时信息：
 * - 顶部栏：燃气条、波次/资金/击杀统计、暂停按钮
 * - 防线血量条及 Buff 图标
 * - 底部武器选择器 + 携带消耗品快捷使用
 * - 左侧热量条 + 紧急冷却按钮
 * - 右侧三喷火枪状态 + 掉落道具库存
 * 所有元素均为 pointer-events-none 容器，仅交互按钮启用 pointer-events-auto。
 */
import React from 'react';
import type { Player, Economy, GameProgress, BossBattleState, InventoryItem } from '@/game/types';
import { GameMode, SceneType } from '@/game/types';
import { SCENE_WAVE_CONFIGS, CONSUMABLE_DEFS, TEXT_CONFIG } from '@/game/data';
import { Pause, Droplets, Gauge, Target, Flame, ChevronRight } from 'lucide-react';
import type { AudioManager } from '@/game/audio';


interface GameHUDProps {
  player: Player;
  economy: Economy;
  pendingRewards: number;
  wave: number;
  defenseHp: number;
  maxDefenseHp: number;
  onPause: () => void;
  onReload: () => void;
  onEmergencyCool: () => void;
  difficulty: 'easy' | 'hard';
  gameMode: GameMode;
  currentWeapon: string;
  onSwitchWeapon: (weapon: string) => boolean;
  onCycleWeapon: () => void;
  progress: GameProgress | null;
  isAiming: boolean;
  onStartAim: (weapon: 'sticky' | 'poison' | 'molotov') => void;
  onThrow: () => void;
  onCancelAim: () => void;
  // Item system
  inventory: InventoryItem[];
  selectedItemIndex: number;
  isPlacingItem: boolean;
  onSelectItem: (index: number) => void;
  // Picked-up item cooldowns (shares globalConsumableCooldown with shop consumables)
  itemCooldowns?: Record<string, number>;
  globalConsumableCooldown?: number;
  // Scene
  currentScene: SceneType;
  // Triple flame
  tripleFlameActive: boolean;
  tripleFlameTimer: number;
  tripleFlameDuration: number;
  // Boss battle
  bossState?: BossBattleState | null;
  // Carried shop consumables
  carriedConsumables?: Record<string, number>;
  buffFlashTimers?: Record<string, number>;
  onUseConsumable?: (id: string) => void;
  // Shield timer for buff display
  shieldTimer?: number;
  // Emergency cool inventory (purchased from shop)
  emergencyCoolInventory?: number;
  // Consumable cooldown system
  consumableCooldowns?: Record<string, number>;
  combatStartTimer?: number;
  audio?: AudioManager;
  /** 教程高亮元素注册回调（用于 DOM 精确定位） */
  onRegisterTutorialElement?: (id: string, el: HTMLElement | null) => void;
}

/** 武器图标 / 名称 / 快捷键映射 */
const WEAPON_ICONS: Record<string, { icon: React.ReactNode; name: string; color: string; key: string }> = {
  flamethrower: { icon: <Flame size={14} />, name: TEXT_CONFIG.weapons.flamethrower, color: 'text-orange-400', key: '1' },
  shotgun: { icon: <Target size={14} />, name: TEXT_CONFIG.weapons.shotgun, color: 'text-yellow-400', key: '2' },
};

/** 掉落道具图片映射 */
const ITEM_IMAGES: Record<string, string> = {
  sticky: '/assets/drop_sticky.png',
  poison: '/assets/drop_poison.png',
  molotov: '/assets/drop_molotov.png',
  shotgun: '/assets/drop_shotgun.png',
  radar: '/assets/drop_radar.png',
  fan: '/assets/drop_fan.png',
  swatter: '/assets/drop_swatter.png',
  knife: '/assets/drop_knife.png',
  invoice: '/assets/drop__invoice.png',
  jammer: '/assets/drop_Jammer.png',
};

/** 掉落道具中文名称映射 */
const ITEM_NAMES: Record<string, string> = {
  sticky: TEXT_CONFIG.items.sticky,
  poison: TEXT_CONFIG.items.poison,
  molotov: TEXT_CONFIG.items.molotov,
  shotgun: TEXT_CONFIG.items.shotgun,
  radar: TEXT_CONFIG.items.radar,
  fan: TEXT_CONFIG.items.fan,
  swatter: TEXT_CONFIG.items.swatter,
  knife: TEXT_CONFIG.items.knife,
  invoice: TEXT_CONFIG.items.invoice,
  jammer: TEXT_CONFIG.items.jammer,
};

/** Buff 图标子组件：缩略版（约 12×12），带闪烁动画 */
const BuffIcon: React.FC<{ src: string; alt: string; color: string; timer: number }> = ({ src, alt, color, timer }) => (
  <div
    className={`w-3 h-3 rounded-sm overflow-hidden animate-pulse border ${color}`}
    style={{ animationDuration: '0.3s', opacity: timer > 0.5 ? 1 : 0.3 }}
    title={alt}
  >
    <img src={src} alt={alt} className="w-full h-full object-contain" draggable={false} />
  </div>
);

/** 手动消耗品图标子组件：完整尺寸可点击，支持冷却遮罩和数量角标 */
const ManualItemIcon: React.FC<{
  def: { id: string; name: string; icon: string; color: string; cooldown?: number };
  count: number;
  onClick: () => void;
  cooldown?: number;
  globalCooldown?: number;
  combatStartTimer?: number;
}> = ({ def, count, onClick, cooldown, globalCooldown, combatStartTimer }) => {
  const isOnCooldown = (cooldown ?? 0) > 0;
  const isGlobalLocked = (globalCooldown ?? 0) > 0;
  const isCombatLocked = (combatStartTimer ?? 0) > 0;
  const isLocked = isOnCooldown || isGlobalLocked || isCombatLocked;
  // Show the dominant cooldown value
  const displayCd = Math.max(cooldown ?? 0, globalCooldown ?? 0, combatStartTimer ?? 0);
  return (
    <button
      onClick={() => { onClick(); }}
      disabled={isLocked}
      className={`pointer-events-auto relative w-12 h-12 rounded-lg border-2 overflow-hidden transition-all ${
        isLocked
          ? 'border-stone-700 bg-black/40 cursor-not-allowed opacity-70'
          : 'border-stone-600 bg-white/10 backdrop-blur-sm hover:scale-110 hover:border-stone-400 hover:bg-white/20'
      }`}
      title={`${def.name}${def.cooldown ? ` (冷却:${def.cooldown}秒)` : ''} (点击使用)`}
    >
      <img src={def.icon} alt={def.name} className="w-full h-full object-contain p-0.5" draggable={false} style={{ filter: isLocked ? 'grayscale(0.6) brightness(0.5)' : 'none' }} />
      {/* Count badge */}
      <div className="absolute -bottom-0.5 -right-0.5 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-stone-600">
        {count}
      </div>
      {/* Cooldown overlay mask */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">{displayCd.toFixed(1)}</span>
        </div>
      )}
    </button>
  );
};

export const GameHUD: React.FC<GameHUDProps> = ({
  player,
  economy,
  pendingRewards,
  wave,
  defenseHp,
  maxDefenseHp,
  onPause,
  onReload,
  onEmergencyCool,
  difficulty,
  gameMode,
  currentWeapon,
  onSwitchWeapon,
  onCycleWeapon,
  progress,
  inventory,
  selectedItemIndex,
  isPlacingItem,
  onSelectItem,
  currentScene,
  tripleFlameActive,
  tripleFlameTimer,
  tripleFlameDuration,
  carriedConsumables = {},
  buffFlashTimers = {},
  onUseConsumable,
  emergencyCoolInventory = 0,
  consumableCooldowns = {},
  globalConsumableCooldown = 0,
  combatStartTimer = 0,
  itemCooldowns = {},
  onRegisterTutorialElement,
}) => {
  const gasPercent = (player.gas / player.maxGas) * 100;
  const heatPercent = (player.heat / player.overheatThreshold) * 100;
  const defensePercent = (defenseHp / maxDefenseHp) * 100;
  const reloadCost = difficulty === 'hard' ? TEXT_CONFIG.ui.hud.reloadCost : TEXT_CONFIG.ui.hud.reloadFree;

  /** 教程元素注册辅助函数 */
  const registerRef = (id: string) => (el: HTMLElement | null) => {
    onRegisterTutorialElement?.(id, el);
  };

  const totalWaves = gameMode === GameMode.ENDLESS || currentScene === SceneType.NEST ? '∞' : (SCENE_WAVE_CONFIGS[currentScene as keyof typeof SCENE_WAVE_CONFIGS]?.length || 10);

  const allWeapons = ['flamethrower'];
  const unlockedWeapons = progress?.weaponsUnlocked || ['flamethrower'];

  // Get consumable defs
  const coolDef = CONSUMABLE_DEFS.find(c => c.id === 'emergency_cool');
  const gasDef = CONSUMABLE_DEFS.find(c => c.id === 'gas_refill');
  const repairDef = CONSUMABLE_DEFS.find(c => c.id === 'defense_repair');
  const shieldDef = CONSUMABLE_DEFS.find(c => c.id === 'shield');
  const powerDef = CONSUMABLE_DEFS.find(c => c.id === 'power_boost');
  const baitDef = CONSUMABLE_DEFS.find(c => c.id === 'bait');

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* ═══ 顶部栏：燃气条 + 波次/资金/击杀 + 暂停按钮 ═══ */}
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-center">
        <div className="w-full max-w-[380px] flex items-center gap-1">
          {/* Gas bar */}
          <div ref={registerRef('gasBar')} className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 flex flex-col gap-0.5 flex-1 min-w-0 relative">
          <div className="flex justify-between text-[10px] text-stone-300 leading-tight">
            <span className="flex items-center gap-1"><Droplets size={10} /> {TEXT_CONFIG.ui.hud.gas}</span>
            <span>{Math.ceil(player.gas)}S</span>
          </div>
          <div className="w-full h-2 bg-stone-700 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${gasPercent}%` }} />
          </div>
          {/* Gas refill buff icon - below gas bar */}
          {buffFlashTimers['gas_refill'] > 0 && gasDef && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
              <BuffIcon src={gasDef.icon} alt="气罐补给" color="border-amber-500" timer={buffFlashTimers['gas_refill']} />
            </div>
          )}
          {player.gas < 20 && !player.isReloading && (
            <button onClick={() => { onReload(); }} className="pointer-events-auto text-[9px] bg-amber-600 hover:bg-amber-500 text-white rounded px-1 py-0.5 transition-colors">
              {TEXT_CONFIG.ui.hud.reload} ({reloadCost})
            </button>
          )}
          {player.isReloading && (
            <div className="text-[9px] text-yellow-400 animate-pulse">{TEXT_CONFIG.ui.hud.reloading(Math.ceil(player.reloadTimer))}</div>
          )}
        </div>

        {/* Wave/Money/Kills cluster */}
        <div className="flex gap-1.5 items-center">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 text-white text-center min-w-[42px]">
            <div className="text-[9px] text-stone-400">{TEXT_CONFIG.ui.hud.wave}</div>
            <div className="text-base font-black text-yellow-400 leading-tight">{wave}/{totalWaves}</div>
          </div>
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 text-white text-center min-w-[52px]">
            <div className="text-[9px] text-stone-400">{TEXT_CONFIG.ui.hud.money}</div>
            <div className="text-base font-black text-amber-400 leading-tight">¥{pendingRewards}</div>
          </div>
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 text-white text-center min-w-[36px]">
            <div className="text-[9px] text-stone-400">{TEXT_CONFIG.ui.hud.kills}</div>
            <div className="text-lg font-black text-red-500 leading-tight">{economy.totalKills}</div>
          </div>
          <button onClick={() => { onPause(); }} className="pointer-events-auto bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-lg p-1.5 text-white transition-colors ml-0.5">
            <Pause size={16} />
          </button>
        </div>{/* /inner max-w */}
      </div>{/* /top bar */}
      </div>{/* /top bar outer */}

      {/* ═══ 防线血量条（含 Buff 图标）═══ */}
      <div ref={registerRef('defenseBar')} className="absolute top-[9%] left-1/2 -translate-x-1/2 w-48 pointer-events-none">
        <div className="flex items-center gap-1">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 flex-1">
            <div className="flex justify-between text-[10px] text-stone-300 mb-0.5">
              <span>{TEXT_CONFIG.ui.hud.defense}</span>
              <span>{defenseHp}/{maxDefenseHp}</span>
            </div>
            <div className="w-full h-1.5 bg-stone-700/50 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${defensePercent > 50 ? 'bg-amber-500' : defensePercent > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${defensePercent}%` }} />
            </div>
          </div>
          {/* Defense buff icons - right of defense bar */}
          <div className="flex flex-col gap-0.5">
            {buffFlashTimers['defense_repair'] > 0 && repairDef && (
              <BuffIcon src={repairDef.icon} alt="防线修复" color="border-green-500" timer={buffFlashTimers['defense_repair']} />
            )}
            {buffFlashTimers['shield'] > 0 && shieldDef && (
              <BuffIcon src={shieldDef.icon} alt="防线护盾" color="border-cyan-500" timer={buffFlashTimers['shield']} />
            )}
          </div>
        </div>
      </div>

      {/* ═══ 底部武器选择器 + 携带消耗品 ═══ */}
      <div ref={registerRef('weaponSelector')} className="absolute bottom-[2%] left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-sm rounded-xl px-2 py-1.5 flex items-center gap-1">
          {allWeapons.map((w) => {
            const def = WEAPON_ICONS[w];
            const isUnlocked = unlockedWeapons.includes(w);
            const isActive = currentWeapon === w;
            return (
              <button
                key={w}
                onClick={() => { isUnlocked && onSwitchWeapon(w); }}
                disabled={!isUnlocked}
                className={`relative flex flex-col items-center px-2 py-1 rounded-lg transition-all ${
                  isActive ? 'bg-white/20 ring-1 ring-white/40' : isUnlocked ? 'hover:bg-white/10' : 'opacity-30'
                }`}
                title={`${def.key}: ${def.name}`}
              >
                <span className={isActive ? def.color : 'text-stone-500'}>{def.icon}</span>
                <span className={`text-[8px] ${isActive ? 'text-white' : 'text-stone-500'}`}>{def.name}</span>
              </button>
            );
          })}
          {/* Manual consumables: gas refill */}
          {(carriedConsumables['gas_refill'] || 0) > 0 && gasDef && (
            <ManualItemIcon
              def={gasDef}
              count={carriedConsumables['gas_refill']}
              onClick={() => onUseConsumable?.('gas_refill')}
              cooldown={consumableCooldowns['gas_refill']}
              globalCooldown={globalConsumableCooldown}
              combatStartTimer={combatStartTimer}
            />
          )}
          {/* Manual consumables: defense repair */}
          {(carriedConsumables['defense_repair'] || 0) > 0 && repairDef && (
            <ManualItemIcon
              def={repairDef}
              count={carriedConsumables['defense_repair']}
              onClick={() => onUseConsumable?.('defense_repair')}
              cooldown={consumableCooldowns['defense_repair']}
              globalCooldown={globalConsumableCooldown}
              combatStartTimer={combatStartTimer}
            />
          )}
          {/* Manual consumables: shield */}
          {(carriedConsumables['shield'] || 0) > 0 && shieldDef && (
            <ManualItemIcon
              def={shieldDef}
              count={carriedConsumables['shield']}
              onClick={() => onUseConsumable?.('shield')}
              cooldown={consumableCooldowns['shield']}
              globalCooldown={globalConsumableCooldown}
              combatStartTimer={combatStartTimer}
            />
          )}
          {/* Manual consumables: power boost */}
          {(carriedConsumables['power_boost'] || 0) > 0 && powerDef && (
            <ManualItemIcon
              def={powerDef}
              count={carriedConsumables['power_boost']}
              onClick={() => onUseConsumable?.('power_boost')}
              cooldown={consumableCooldowns['power_boost']}
              globalCooldown={globalConsumableCooldown}
              combatStartTimer={combatStartTimer}
            />
          )}
          {/* Manual consumables: bait */}
          {(carriedConsumables['bait'] || 0) > 0 && baitDef && (
            <ManualItemIcon
              def={baitDef}
              count={carriedConsumables['bait']}
              onClick={() => onUseConsumable?.('bait')}
              cooldown={consumableCooldowns['bait']}
              globalCooldown={globalConsumableCooldown}
              combatStartTimer={combatStartTimer}
            />
          )}
          <button onClick={() => { onCycleWeapon(); }} className="ml-1 text-stone-400 hover:text-white transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ═══ 左侧热量条 + 紧急冷却按钮 ═══ */}
      <div ref={registerRef('heatBar')} className="absolute bottom-[33.33%] left-2 pointer-events-auto">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-1.5 py-2 flex flex-col items-center gap-1 relative">
          {/* Emergency cool buff icon - above heat bar */}
          {buffFlashTimers['emergency_cool'] > 0 && coolDef && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <BuffIcon src={coolDef.icon} alt="紧急冷却" color="border-blue-500" timer={buffFlashTimers['emergency_cool']} />
            </div>
          )}
          <div className="text-[9px] text-stone-300 flex items-center gap-1"><Gauge size={10} /></div>
          <div className="relative w-3 h-24 bg-stone-700/50 rounded-full overflow-hidden">
            <div className={`absolute bottom-0 w-full rounded-full transition-all ${heatPercent > 80 ? 'bg-red-500' : heatPercent > 50 ? 'bg-orange-500' : 'bg-yellow-500'}`} style={{ height: `${heatPercent}%` }} />
          </div>
          <div className="text-[9px] text-stone-300">{Math.round(heatPercent)}%</div>
          {player.isOverheated && (
            <button
              onClick={emergencyCoolInventory > 0 ? onEmergencyCool : undefined}
              disabled={emergencyCoolInventory <= 0}
              className={`pointer-events-auto text-[8px] rounded px-1 py-0.5 transition-colors whitespace-nowrap ${
                emergencyCoolInventory > 0
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-stone-700 text-stone-500 cursor-not-allowed'
              }`}
            >
              {emergencyCoolInventory > 0 ? TEXT_CONFIG.ui.hud.emergencyCool(emergencyCoolInventory) : TEXT_CONFIG.ui.hud.coolExhausted}
            </button>
          )}
        </div>
      </div>

      {/* ═══ 右侧：三喷火枪状态 + 掉落道具库存 ═══ */}
      <div ref={registerRef('inventoryItems')} className="absolute bottom-[12.5%] right-2 flex flex-col items-center gap-1.5 min-w-[56px] min-h-[56px]">
        {/* Triple flame status */}
        {tripleFlameActive && (
          <div className={`rounded-lg px-2 py-1 mb-1 border ${tripleFlameTimer <= 5 ? 'bg-red-900/80 border-red-500 animate-pulse' : 'bg-yellow-900/70 border-yellow-500/50'}`}>
            <div className={`text-[9px] font-bold text-center ${tripleFlameTimer <= 5 ? 'text-red-300' : 'text-yellow-400'}`}>
              {TEXT_CONFIG.ui.hud.tripleFlamethrower}
            </div>
            <div className="w-12 h-1.5 bg-stone-700 rounded-full overflow-hidden mt-0.5">
              <div
                className={`h-full rounded-full transition-all ${tripleFlameTimer <= 5 ? 'bg-red-500' : 'bg-yellow-400'}`}
                style={{ width: `${(tripleFlameTimer / tripleFlameDuration) * 100}%` }}
              />
            </div>
            <div className={`text-[10px] font-bold text-center ${tripleFlameTimer <= 5 ? 'text-red-400 text-base' : 'text-yellow-300'}`}>
              {tripleFlameTimer <= 5 && '⚠ '}{Math.ceil(tripleFlameTimer)}s{tripleFlameTimer <= 5 && ' ⚠'}
            </div>
          </div>
        )}

        {/* Inventory items (weapon drops) */}
        {inventory.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            {inventory.map((item, idx) => {
              const isItemCooldown = (itemCooldowns[item.type] || 0) > 0;
              const isGlobalCooldown = globalConsumableCooldown > 0;
              const isInCooldown = isItemCooldown || isGlobalCooldown;
              const cooldownTimer = isItemCooldown ? itemCooldowns[item.type] : (isGlobalCooldown ? globalConsumableCooldown : 0);
              return (
                <button
                  key={`${item.type}-${idx}`}
                  onClick={() => { onSelectItem(idx); }}
                  disabled={isInCooldown}
                  className={`pointer-events-auto relative w-12 h-12 rounded-lg border-2 overflow-hidden transition-all ${
                    selectedItemIndex === idx && isPlacingItem
                      ? 'border-stone-400 ring-2 ring-stone-400/60 bg-white/20'
                      : 'border-stone-600 bg-white/10 backdrop-blur-sm'
                  } ${isPlacingItem && selectedItemIndex !== idx ? 'opacity-40' : ''} ${isInCooldown ? 'opacity-50 cursor-not-allowed border-stone-700 bg-black/40' : 'hover:scale-110 hover:border-stone-400 hover:bg-white/20'}`}
                  title={isInCooldown ? TEXT_CONFIG.ui.hud.itemCooldown(ITEM_NAMES[item.type]) : ITEM_NAMES[item.type]}
                >
                  <img
                    src={ITEM_IMAGES[item.type]}
                    alt={ITEM_NAMES[item.type]}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 bg-black/70 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-stone-600">
                    {item.count}
                  </div>
                  {selectedItemIndex === idx && isPlacingItem && (
                    <div className="absolute inset-0 bg-yellow-400/20 animate-pulse" />
                  )}
                  {/* Cooldown overlay */}
                  {isInCooldown && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{cooldownTimer.toFixed(1)}s</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ 放置道具提示（等待点击屏幕）═══ */}
      {isPlacingItem && selectedItemIndex >= 0 && (
        <div className="absolute bottom-[12.5%] left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-yellow-900/80 border border-yellow-500/50 rounded-lg px-3 py-1.5 text-center">
            <div className="text-yellow-300 text-xs font-bold">
              {TEXT_CONFIG.ui.hud.placeItem}
            </div>
            <div className="text-yellow-400/70 text-[10px]">{TEXT_CONFIG.ui.hud.cancelPlace}</div>
          </div>
        </div>
      )}

      {/* ═══ 过热警告（屏幕中央）═══ */}
      {player.isOverheated && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="bg-red-900/80 backdrop-blur-sm rounded-lg px-4 py-2 text-center animate-pulse">
            <div className="text-red-400 font-bold text-lg">{TEXT_CONFIG.combat.barrelCooldown.text}</div>
            <div className="text-red-300 text-sm">{Math.ceil(player.overheatTimer)}s</div>
          </div>
        </div>
      )}
    </div>
  );
};
