import React from 'react';
import type { Player, Economy, GameProgress, BossBattleState, SceneType } from '@/game/types';
import { GameMode } from '@/game/types';
import { SCENE_WAVE_CONFIGS, CONSUMABLE_DEFS } from '@/game/data';
import { Pause, Droplets, Gauge, Target, Flame, ChevronRight } from 'lucide-react';
import type { AudioManager } from '@/game/audio';


interface GameHUDProps {
  player: Player;
  economy: Economy;
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
  inventory: { type: 'sticky' | 'poison' | 'molotov' | 'shotgun' | 'radar' | 'fan' | 'swatter'; count: number
  audio?: AudioManager;
}[];
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
  globalConsumableCooldown?: number;
  combatStartTimer?: number;
}

const WEAPON_ICONS: Record<string, { icon: React.ReactNode; name: string; color: string; key: string }> = {
  flamethrower: { icon: <Flame size={14} />, name: '火焰', color: 'text-orange-400', key: '1' },
  shotgun: { icon: <Target size={14} />, name: '散弹', color: 'text-yellow-400', key: '2' },
};

const ITEM_IMAGES: Record<string, string> = {
  sticky: '/assets/item_sticky.png',
  poison: '/assets/item_poison.png',
  molotov: '/assets/item_molotov.png',
  shotgun: '/assets/item_shotgun.png',
  radar: '/assets/item_radar.png',
  fan: '/assets/fan.png',
  swatter: '/assets/item_swatter.png',
};

const ITEM_NAMES: Record<string, string> = {
  sticky: '蟑螂贴板',
  poison: '杀虫剂',
  molotov: '燃烧瓶',
  shotgun: '散弹模式',
  radar: '雷达激光',
  fan: '强力风扇',
  swatter: '电蚊拍',
};

const ITEM_BG_COLORS: Record<string, string> = {
  sticky: 'border-amber-500/50 bg-amber-900/30',
  poison: 'border-amber-500/50 bg-amber-900/30',
  molotov: 'border-red-500/50 bg-red-900/30',
  shotgun: 'border-orange-500/50 bg-orange-900/30',
  radar: 'border-orange-500/50 bg-orange-900/30',
  fan: 'border-stone-500/50 bg-stone-900/30',
  swatter: 'border-amber-500/50 bg-amber-900/30',
};

const ITEM_ACTIVE_COLORS: Record<string, string> = {
  sticky: 'border-amber-400 ring-2 ring-amber-400/60',
  poison: 'border-amber-400 ring-2 ring-amber-400/60',
  molotov: 'border-red-400 ring-2 ring-red-400/60',
  shotgun: 'border-orange-400 ring-2 ring-orange-400/60',
  radar: 'border-orange-400 ring-2 ring-orange-400/60',
  fan: 'border-stone-400 ring-2 ring-stone-400/60',
  swatter: 'border-amber-400 ring-2 ring-amber-400/60',
};

// Buff icon component - 1/4 size (~12x12) with flash animation
const BuffIcon: React.FC<{ src: string; alt: string; color: string; timer: number }> = ({ src, alt, color, timer }) => (
  <div
    className={`w-3 h-3 rounded-sm overflow-hidden animate-pulse border ${color}`}
    style={{ animationDuration: '0.3s', opacity: timer > 0.5 ? 1 : 0.3 }}
    title={alt}
  >
    <img src={src} alt={alt} className="w-full h-full object-contain" draggable={false} />
  </div>
);

// Manual consumable icon - full size clickable
const ManualItemIcon: React.FC<{
  def: { id: string; name: string; icon: string; color: string; cooldown?: number };
  count: number;
  onClick: () => void;
  cooldown?: number;
  globalCooldown?: number;
  combatStartTimer?: number;
  audio?: AudioManager;
}> = ({ def, count, onClick, cooldown, globalCooldown, combatStartTimer, audio }) => {
  const isOnCooldown = (cooldown ?? 0) > 0;
  const isGlobalLocked = (globalCooldown ?? 0) > 0;
  const isCombatLocked = (combatStartTimer ?? 0) > 0;
  const isLocked = isOnCooldown || isGlobalLocked || isCombatLocked;
  // Show the dominant cooldown value
  const displayCd = Math.max(cooldown ?? 0, globalCooldown ?? 0, combatStartTimer ?? 0);
  return (
    <button
      onClick={() => { audio?.playClick(); onClick(); }}
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
  bossState,
  carriedConsumables = {},
  buffFlashTimers = {},
  onUseConsumable,
  shieldTimer = 0,
  emergencyCoolInventory = 0,
  consumableCooldowns = {},
  globalConsumableCooldown = 0,
  combatStartTimer = 0,
  itemCooldowns = {},
  audio}) => {
  const gasPercent = (player.gas / player.maxGas) * 100;
  const heatPercent = (player.heat / player.overheatThreshold) * 100;
  const defensePercent = (defenseHp / maxDefenseHp) * 100;
  const reloadCost = difficulty === 'hard' ? '¥5' : '免费';
  const coolCost = difficulty === 'hard' ? '¥15' : '¥5';

  const totalWaves = gameMode === GameMode.ENDLESS ? '∞' : (SCENE_WAVE_CONFIGS[currentScene as keyof typeof SCENE_WAVE_CONFIGS]?.length || 10);

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
      {/* Top bar - content centered, max-w matches narrow screen width */}
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-center">
        <div className="w-full max-w-[380px] flex items-center gap-1">
          {/* Gas bar */}
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 flex flex-col gap-0.5 flex-1 min-w-0 relative">
          <div className="flex justify-between text-[10px] text-stone-300 leading-tight">
            <span className="flex items-center gap-1"><Droplets size={10} /> 燃气</span>
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
            <button onClick={() => { audio?.playClick(); onReload(); }} className="pointer-events-auto text-[9px] bg-amber-600 hover:bg-amber-500 text-white rounded px-1 py-0.5 transition-colors">
              换罐 ({reloadCost})
            </button>
          )}
          {player.isReloading && (
            <div className="text-[9px] text-yellow-400 animate-pulse">换罐中...{Math.ceil(player.reloadTimer)}s</div>
          )}
        </div>

        {/* Wave/Money/Kills cluster */}
        <div className="flex gap-1.5 items-center">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 text-white text-center min-w-[42px]">
            <div className="text-[9px] text-stone-400">波次</div>
            <div className="text-base font-black text-yellow-400 leading-tight">{wave}/{totalWaves}</div>
          </div>
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 text-white text-center min-w-[52px]">
            <div className="text-[9px] text-stone-400">资金</div>
            <div className="text-base font-black text-amber-400 leading-tight">¥{economy.money}</div>
          </div>
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 text-white text-center min-w-[36px]">
            <div className="text-[9px] text-stone-400">击杀</div>
            <div className="text-lg font-black text-red-500 leading-tight">{economy.totalKills}</div>
          </div>
          <button onClick={() => { audio?.playClick(); onPause(); }} className="pointer-events-auto bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-lg p-1.5 text-white transition-colors ml-0.5">
            <Pause size={16} />
          </button>
        </div>{/* /inner max-w */}
      </div>{/* /top bar */}
      </div>{/* /top bar outer */}

      {/* Defense HP - with buff icons on the right */}
      <div className="absolute top-[58px] left-1/2 -translate-x-1/2 w-48">
        <div className="flex items-center gap-1">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 flex-1">
            <div className="flex justify-between text-[10px] text-stone-300 mb-0.5">
              <span>防线</span>
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

      {/* Weapon selector - bottom center with manual consumables */}
      <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-sm rounded-xl px-2 py-1.5 flex items-center gap-1">
          {allWeapons.map((w) => {
            const def = WEAPON_ICONS[w];
            const isUnlocked = unlockedWeapons.includes(w);
            const isActive = currentWeapon === w;
            return (
              <button
                key={w}
                onClick={() => { audio?.playClick(); isUnlocked && onSwitchWeapon(w); }}
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
              audio={audio}
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
              audio={audio}
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
              audio={audio}
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
              audio={audio}
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
              audio={audio}
            />
          )}
          <button onClick={() => { audio?.playClick(); onCycleWeapon(); }} className="ml-1 text-stone-400 hover:text-white transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Left side - Heat bar (moved above defense line to avoid overlap with consumable bar) */}
      <div className="absolute bottom-[320px] left-2 pointer-events-auto">
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
              {emergencyCoolInventory > 0 ? `紧急冷却 (${emergencyCoolInventory}次)` : '冷却已用完'}
            </button>
          )}
        </div>
      </div>

      {/* Right side - Triple flame status + Inventory items + Swatter */}
      <div className="absolute bottom-[120px] right-2 flex flex-col items-center gap-1.5">
        {/* Triple flame status */}
        {tripleFlameActive && (
          <div className={`rounded-lg px-2 py-1 mb-1 border ${tripleFlameTimer <= 5 ? 'bg-red-900/80 border-red-500 animate-pulse' : 'bg-yellow-900/70 border-yellow-500/50'}`}>
            <div className={`text-[9px] font-bold text-center ${tripleFlameTimer <= 5 ? 'text-red-300' : 'text-yellow-400'}`}>
              三喷火枪
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
                  onClick={() => { audio?.playClick(); onSelectItem(idx); }}
                  disabled={isInCooldown}
                  className={`pointer-events-auto relative w-12 h-12 rounded-lg border-2 overflow-hidden transition-all ${
                    selectedItemIndex === idx && isPlacingItem
                      ? 'border-stone-400 ring-2 ring-stone-400/60 bg-white/20'
                      : 'border-stone-600 bg-white/10 backdrop-blur-sm'
                  } ${isPlacingItem && selectedItemIndex !== idx ? 'opacity-40' : ''} ${isInCooldown ? 'opacity-50 cursor-not-allowed border-stone-700 bg-black/40' : 'hover:scale-110 hover:border-stone-400 hover:bg-white/20'}`}
                  title={isInCooldown ? `${ITEM_NAMES[item.type]} 冷却中...` : ITEM_NAMES[item.type]}
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

      {/* Pending click: waiting for screen click to show range */}
      {isPlacingItem && selectedItemIndex >= 0 && (
        <div className="absolute bottom-[120px] left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-yellow-900/80 border border-yellow-500/50 rounded-lg px-3 py-1.5 text-center">
            <div className="text-yellow-300 text-xs font-bold">
              点击屏幕放置位置
            </div>
            <div className="text-yellow-400/70 text-[10px]">点击图标取消</div>
          </div>
        </div>
      )}

      {/* Overheat warning */}
      {player.isOverheated && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="bg-red-900/80 backdrop-blur-sm rounded-lg px-4 py-2 text-center animate-pulse">
            <div className="text-red-400 font-bold text-lg">过热警告!</div>
            <div className="text-red-300 text-sm">{Math.ceil(player.overheatTimer)}s</div>
          </div>
        </div>
      )}
    </div>
  );
};
