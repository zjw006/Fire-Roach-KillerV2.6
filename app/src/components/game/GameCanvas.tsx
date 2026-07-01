import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createGameEngine } from '@/game/engine/index';
import { GameState, GameMode, SceneType, type Player, type Economy, type GameProgress, type DialogConfig, type BossBattleState, type InventoryItem } from '@/game/types';
import { DIALOG_CONFIGS, SCENE_CONFIGS, SCENE_UNLOCK_CHAIN } from '@/game/data';
import * as Vibration from '@/game/vibration';
import { trpc } from '@/providers/trpc';
import { GameHUD } from './GameHUD';
import { GameMenu } from './GameMenu';
import { GameOverScreen } from './GameOverScreen';
import { ShopScreen } from './ShopScreen';
import { PauseScreen } from './PauseScreen';
import { TalentTreeScreen } from './TalentTreeScreen';
import { AchievementsScreen } from './AchievementsScreen';
import { SceneSelectScreen } from './SceneSelectScreen';
import { DialogScreen } from './DialogScreen';
import { EncyclopediaScreen } from './EncyclopediaScreen';
import { ComicViewer } from './ComicViewer';
import { TitleScreen } from './TitleScreen';
import { ItemRevealScreen } from './ItemRevealScreen';
import { PreparationScreen } from './PreparationScreen';
import { GameplayTutorialOverlay } from './GameplayTutorialOverlay';
// import { ShopTutorialOverlay, hasSeenShopTutorial } from './ShopTutorialOverlay';
import { CountdownOverlay } from './CountdownOverlay';
import { ItemRecycleAnimation } from './ItemRecycleAnimation';
import { getComicChapter, hasSeenComic, type ComicChapter } from '@/game/comicData';

// Generate or retrieve persistent player ID
function getOrCreatePlayerId(): string {
  const key = 'roach_blaster_player_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any | null>(null);
  const nextSceneUpgradesRef = useRef<string[]>([]);
  // const nextSceneConsumablesRef = useRef<Record<string, number>>({});
  // const nextSceneEmergencyCoolRef = useRef<number>(0);
  // const menuShopInventoryRef = useRef<Record<string, number>>({});
  const playerIdRef = useRef<string>(getOrCreatePlayerId());

  // tRPC mutations for cloud save
  const saveMutation = trpc.player.save.useMutation();
  const logSessionMutation = trpc.player.logSession.useMutation();

  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [player, setPlayer] = useState<Player | null>(null);
  const [economy, setEconomy] = useState<Economy | null>(null);
  const [wave, setWave] = useState(0);
  const [defenseHp, setDefenseHp] = useState(80);
  const [maxDefenseHp, setMaxDefenseHp] = useState(80);
  const [finalWave, setFinalWave] = useState(0);
  const [bossDefeated, setBossDefeated] = useState(false);
  const [isAiming, setIsAiming] = useState(false);
  const [inventory, setInventory] = useState<{ type: 'sticky' | 'poison' | 'molotov' | 'shotgun' | 'radar' | 'fan' | 'swatter'; count: number }[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const [isPlacingItem, setIsPlacingItem] = useState(false);
  const [tripleFlameActive, setTripleFlameActive] = useState(false);
  const [tripleFlameTimer, setTripleFlameTimer] = useState(0);
  const [powerBoostTimer, setPowerBoostTimer] = useState(0);
  // const [powerBoostFlash, setPowerBoostFlash] = useState(false);
  const [bossState, setBossState] = useState<BossBattleState | null>(null);
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.STORY);
  const [currentScene, setCurrentScene] = useState<SceneType>(SceneType.KITCHEN);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingDialogConfig, setPendingDialogConfig] = useState<DialogConfig | null>(null);
  const [pendingStartParams, setPendingStartParams] = useState<{ diff: 'easy' | 'hard'; mode: GameMode; scene: SceneType } | null>(null);
  const [seenDialogs, setSeenDialogs] = useState<Set<SceneType>>(new Set());
  const [currentWeapon, setCurrentWeapon] = useState('flamethrower');
  const [showTalentTree, setShowTalentTree] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showSceneSelect, setShowSceneSelect] = useState(false);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [talentPoints, setTalentPoints] = useState(0);
  const [progress, setProgress] = useState<GameProgress | null>(null);

  // Comic viewer state
  const [showComic, setShowComic] = useState(false);
  const [comicChapter, setComicChapter] = useState<ComicChapter | null>(null);
  const [pendingComicParams, setPendingComicParams] = useState<{ diff: 'easy' | 'hard'; mode: GameMode; scene: SceneType } | null>(null);

  // Item reveal state
  const [itemRevealData, setItemRevealData] = useState<{ type: string; name: string; icon: string; desc: string }[]>([]);

  // Preparation screen (item selection before level start)
  const [showPreparation, setShowPreparation] = useState(false);
  const [preparationItems, setPreparationItems] = useState<string[]>([]);
  const [pendingPreparationParams, setPendingPreparationParams] = useState<{ diff: 'easy' | 'hard'; mode: GameMode; scene: SceneType } | null>(null);

  // Tutorial pause spawn state (kitchen first wave)
  const [tutorialPauseSpawn, setTutorialPauseSpawn] = useState(false);

  // Countdown state (pre-wave 3-2-1)
  const [countdownPhase, setCountdownPhase] = useState(3);
  const [countdownTimer, setCountdownTimer] = useState(0);

  // Item recycle animation state (unsold inventory -> gold at level end)
  const [showRecycleAnim, setShowRecycleAnim] = useState(false);
  const [recycleInventory, setRecycleInventory] = useState<{ type: string; count: number }[]>([]);

  // Carried consumables inventory
  const [carriedConsumables, setCarriedConsumables] = useState<Record<string, number>>({});
  const [buffFlashTimers, setBuffFlashTimers] = useState<Record<string, number>>({});
  const [emergencyCoolCount, setEmergencyCoolCount] = useState(0);
  const [consumableCooldowns, setConsumableCooldowns] = useState<Record<string, number>>({});
  const [globalConsumableCooldown, setGlobalConsumableCooldown] = useState(0);
  const [combatStartTimer, setCombatStartTimer] = useState(0);
  const [itemCooldowns, setItemCooldowns] = useState<Record<string, number>>({});

  // Endless mode timer UI state
  const [endlessTimer, setEndlessTimer] = useState(0);
  const [endlessBestTime, setEndlessBestTime] = useState(0);
  const [endlessNewRecordVisible, setEndlessNewRecordVisible] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const engine = createGameEngine({
      canvas,
      ctx,
      gameMode: GameMode.STORY,
      difficulty: 'easy',
      currentScene: SceneType.KITCHEN,
      audio: undefined
    });
    engineRef.current = engine;

    engine.onStateChange = (state) => {
      setGameState(state);
      // Suppress UI click SFX during gameplay, enable in all other UI states
      engine.audio.suppressClickSfx = (state === GameState.PLAYING);
      // Sync item reveal data when entering ITEM_DROP or ITEM_REVEAL state
      if (state === GameState.ITEM_DROP || state === GameState.ITEM_REVEAL) {
        setItemRevealData([...engine.itemRevealData]);
      }
      // Sync countdown state immediately when entering COUNTDOWN
      if (state === GameState.COUNTDOWN) {
        setCountdownPhase(engine.countdownPhase);
        setCountdownTimer(engine.countdownTimer);
      }
      // Note: Auto-show talent tree on game over removed - player can access via menu manually
    };

    engine.onTutorialPauseChange = (paused) => {
      setTutorialPauseSpawn(paused);
    };

    engine.onConsumableUpdate = (
      inv: Record<string, number>, 
      buffTimers: Record<string, number>, 
      cooldowns?: Record<string, number>, 
      globalCd?: number, 
      combatTimer?: number, 
      itemCds?: Record<string, number>
    ) => {
      setCarriedConsumables({ ...inv });
      setBuffFlashTimers({ ...buffTimers });
      if (cooldowns) setConsumableCooldowns({ ...cooldowns });
      if (globalCd !== undefined) setGlobalConsumableCooldown(globalCd);
      if (combatTimer !== undefined) setCombatStartTimer(combatTimer);
      if (itemCds) setItemCooldowns({ ...itemCds });
      // Persist to GameProgress (v3: consumables now part of main progress)
      engine.saveProgress();
      // Also keep the separate localStorage for backwards compatibility
      try {
        localStorage.setItem('roach_blaster_consumables', JSON.stringify({
          consumables: inv,
          emergencyCool: engineRef.current?.emergencyCoolInventory || 0,
        }));
      } catch { /* ignore */ }
    };
    engine.onEmergencyCoolUpdate = (count: number) => {
      setEmergencyCoolCount(count);
      // Persist to GameProgress (v3)
      engine.saveProgress();
      // Also keep the separate localStorage for backwards compatibility
      try {
        localStorage.setItem('roach_blaster_consumables', JSON.stringify({
          consumables: engineRef.current?.consumableInventory || {},
          emergencyCool: count,
        }));
      } catch { /* ignore */ }
    };
    engine.onWaveClear = () => {
      // Trigger item recycle animation after item reveal screen is closed
      // engine.recycledInventory is set by sellUnusedInventory() in gameVictory()
      const recycled = engine.recycledInventory;
      if (recycled.length > 0) {
        setRecycleInventory([...recycled]);
        setShowRecycleAnim(true);
        // Gold is applied in handleRecycleComplete() after animation finishes
      }
      setWave(engine.wave);
      setEconomy({ ...engine.economy });
      setProgress({ ...engine.progress });
      setTalentPoints(engine.progress.talentTree.points);
      // Ensure progress is saved to localStorage
      engine.saveProgress();
      // Sync level-end economy.money to menuShopMoney (remaining gold carries over)
      const victoryReward = engine.economy.money;
      setMenuShopMoney(() => {
        const newVal = victoryReward;
        try { localStorage.setItem('roach_blaster_menu_money', String(newVal)); } catch { /* ignore */ }
        return newVal;
      });
      // Save remaining consumables to localStorage (cross-level persistence)
      try {
        localStorage.setItem('roach_blaster_consumables', JSON.stringify({
          consumables: engine.consumableInventory,
          emergencyCool: engine.emergencyCoolInventory,
        }));
      } catch { /* ignore */ }
      // Show victory screen (GameOverScreen with isVictory=true)
      engine.audio.fadeOutBGM(0.08, 2500);
      setGameState(GameState.WAVE_CLEAR);
      // Cloud save: upload progress on victory
      const pid = playerIdRef.current;
      const prog = engine.progress;
      try {
        saveMutation.mutate({ playerId: pid, progress: prog as any });
        logSessionMutation.mutate({
          playerId: pid,
          scene: engine.currentScene,
          mode: engine.gameMode,
          difficulty: engine.difficulty,
          waveReached: engine.wave,
          kills: engine.economy.totalKills,
          result: 'victory',
        });
      } catch { /* ignore network errors */ }
    };
    engine.onPlayerUpdate = (p: Player) => {
      setPlayer({ ...p });
      setCurrentWeapon(p.currentWeapon);
      setPowerBoostTimer(p.powerBoostTimer);
    };
    engine.onEconomyUpdate = (e: Economy) => setEconomy({ ...e });
    engine.onWaveUpdate = (w: number) => setWave(w);
    engine.onDefenseUpdate = (hp: number, maxHp: number) => {
      setDefenseHp(hp);
      setMaxDefenseHp(maxHp);
    };
    engine.onGameOver = (e: Economy, w: number) => {
      // Trigger item recycle animation if inventory has unused items
      const recycled = engine.recycledInventory;
      if (recycled.length > 0) {
        setRecycleInventory([...recycled]);
        setShowRecycleAnim(true);
        // Gold is applied in handleRecycleComplete() after animation finishes
      }
      setEconomy({ ...e });
      setFinalWave(w);
      setProgress({ ...engine.progress });
      setTalentPoints(engine.progress.talentTree.points);
      engine.saveProgress();
      // Sync level-end economy.money to menuShopMoney (remaining gold carries over)
      const defeatReward = e.money;
      setMenuShopMoney(() => {
        const newVal = defeatReward;
        try { localStorage.setItem('roach_blaster_menu_money', String(newVal)); } catch { /* ignore */ }
        return newVal;
      });
      // Save remaining consumables to localStorage (cross-level persistence)
      try {
        localStorage.setItem('roach_blaster_consumables', JSON.stringify({
          consumables: engine.consumableInventory,
          emergencyCool: engine.emergencyCoolInventory,
        }));
      } catch { /* ignore */ }
      // Detect BOSS defeat: game mode is BOSS and wave=1 (boss death always passes wave=1)
      setBossDefeated(engine.gameMode === GameMode.BOSS && w === 1);
      // Fade out BGM when settlement screen appears (continues at low volume)
      engine.audio.fadeOutBGM(0.08, 2500);
      // Cloud save: upload progress on defeat
      const pid = playerIdRef.current;
      const prog = engine.progress;
      try {
        saveMutation.mutate({ playerId: pid, progress: prog as any });
        logSessionMutation.mutate({
          playerId: pid,
          scene: engine.currentScene,
          mode: engine.gameMode,
          difficulty: engine.difficulty,
          waveReached: w,
          kills: engine.economy.totalKills,
          result: 'defeat',
        });
      } catch { /* ignore network errors */ }
    };
    engine.onBossUpdate = (bb: BossBattleState) => setBossState({ ...bb });
    engine.onInventoryUpdate = (inv: InventoryItem[]) => setInventory([...inv]);

    setProgress(engine.progress);
    setTalentPoints(engine.progress.talentTree.points);

    return () => {
      engine.stop();
    };
  }, []);

  // Poll aim state and inventory
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (engine) {
        setCurrentWeapon(engine.player.currentWeapon);
        setIsAiming(engine.isAiming);
        setInventory([...engine.inventory]);
        setSelectedItemIndex(engine.selectedItemIndex);
        setIsPlacingItem(engine.itemPlaceState !== 'idle');
        setTripleFlameActive(engine.tripleFlame.active);
        setTripleFlameTimer(engine.tripleFlame.timer);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [gameState]);

  const [audioMuted, setAudioMuted] = useState(false);
  const [showMenuShop, setShowMenuShop] = useState(false);
  const [menuShopMoney, setMenuShopMoney] = useState(() => {
    try {
      const saved = localStorage.getItem('roach_blaster_menu_money');
      return saved ? parseInt(saved, 10) : 200; // default starting money
    } catch { return 200; }
  });

  const handleToggleMute = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      const muted = engine.audio.toggleMute();
      setAudioMuted(muted);
    }
  }, []);

  // Check if dialog should be shown for this scene
  const shouldShowDialog = useCallback((scene: SceneType, mode: GameMode) => {
    // Only show dialog in story mode for scenes not yet seen
    if (mode !== GameMode.STORY) return false;
    if (seenDialogs.has(scene)) return false;
    return DIALOG_CONFIGS.some(d => d.sceneType === scene);
  }, [seenDialogs]);

  // Actually start the game engine after dialog/comic/preparation completes
  const doStartGame = useCallback((diff: 'easy' | 'hard', mode: GameMode, scene: SceneType, selectedItems?: string[]) => {
    setDifficulty(diff);
    setGameMode(mode);
    setCurrentScene(scene);
    if (engineRef.current) {
      engineRef.current.difficulty = diff;
      engineRef.current.gameMode = mode;
      engineRef.current.currentScene = scene;
      engineRef.current.audio.setMuted(audioMuted);
      engineRef.current.start(mode, scene, false, selectedItems, menuShopMoney);
      // Sync React state immediately (player/economy are created in start/resetGame)
      setPlayer({ ...engineRef.current.player });
      setEconomy({ ...engineRef.current.economy });
      setWave(engineRef.current.wave);
      setDefenseHp(engineRef.current.defenseHp);
      setMaxDefenseHp(engineRef.current.maxDefenseHp);
      setCarriedConsumables({ ...engineRef.current.consumableInventory });
      setEmergencyCoolCount(engineRef.current.emergencyCoolInventory);
      // Restore shop upgrades when going to next scene (preserves across scenes)
      if (nextSceneUpgradesRef.current.length > 0) {
        engineRef.current.progress.shopUpgrades = nextSceneUpgradesRef.current;
        nextSceneUpgradesRef.current = [];
      }
      // 根据用户需求：不要默认的背景音乐，只在战斗开始后播放关卡音乐
      // 所以这里不调用任何音频播放方法，关卡音乐会在战斗开始时由引擎自动播放
      if (mode === GameMode.STORY) {
        engineRef.current.audio.switchBGMForScene(scene, diff);
      }
      // 非故事模式也不播放音乐，等待战斗开始
    }
  }, [audioMuted, menuShopMoney]);

  // Check if we should show the preparation screen (item selection) before starting
  const maybeShowPreparation = useCallback((diff: 'easy' | 'hard', mode: GameMode, scene: SceneType) => {
    // Show preparation in story mode when player has 4+ unlocked items
    if (mode === GameMode.STORY && engineRef.current) {
      const unlocked = engineRef.current.progress.weaponsUnlocked;
      if (unlocked && unlocked.length >= 4) {
        setPreparationItems(unlocked);
        setPendingPreparationParams({ diff, mode, scene });
        setShowPreparation(true);
        return;
      }
    }
    // Skip preparation, start directly
    doStartGame(diff, mode, scene);
  }, [doStartGame]);

  const handleStart = useCallback((diff: 'easy' | 'hard', mode: GameMode, scene: SceneType) => {
    // Check if we need to show a comic first (story mode only)
    if (mode === GameMode.STORY && !hasSeenComic(scene)) {
      const chapter = getComicChapter(scene);
      if (chapter) {
        setComicChapter(chapter);
        setPendingComicParams({ diff, mode, scene });
        setShowComic(true);
        return;
      }
    }
    // No comic needed, check dialog
    if (shouldShowDialog(scene, mode)) {
      const dialogConfig = DIALOG_CONFIGS.find(d => d.sceneType === scene);
      if (dialogConfig) {
        setPendingDialogConfig(dialogConfig);
        setPendingStartParams({ diff, mode, scene });
        setShowDialog(true);
        return;
      }
    }
    // No comic or dialog needed, check preparation screen
    maybeShowPreparation(diff, mode, scene);
  }, [shouldShowDialog, maybeShowPreparation]);

  const handleDialogComplete = useCallback(() => {
    setShowDialog(false);
    if (pendingDialogConfig && pendingStartParams) {
      // Mark this scene's dialog as seen
      setSeenDialogs(prev => new Set([...prev, pendingDialogConfig.sceneType]));
      // Check preparation screen before starting
      maybeShowPreparation(pendingStartParams.diff, pendingStartParams.mode, pendingStartParams.scene);
    }
    setPendingDialogConfig(null);
    setPendingStartParams(null);
  }, [pendingDialogConfig, pendingStartParams, maybeShowPreparation]);

  const handleDialogSkip = useCallback(() => {
    setShowDialog(false);
    if (pendingDialogConfig && pendingStartParams) {
      setSeenDialogs(prev => new Set([...prev, pendingDialogConfig.sceneType]));
      // Check preparation screen before starting
      maybeShowPreparation(pendingStartParams.diff, pendingStartParams.mode, pendingStartParams.scene);
    }
    setPendingDialogConfig(null);
    setPendingStartParams(null);
  }, [pendingDialogConfig, pendingStartParams, maybeShowPreparation]);

  // Comic viewer callbacks
  const handleComicComplete = useCallback(() => {
    setShowComic(false);
    setComicChapter(null);
    if (pendingComicParams) {
      const { diff, mode, scene } = pendingComicParams;
      // After comic, check dialog
      if (shouldShowDialog(scene, mode)) {
        const dialogConfig = DIALOG_CONFIGS.find(d => d.sceneType === scene);
        if (dialogConfig) {
          setPendingDialogConfig(dialogConfig);
          setPendingStartParams({ diff, mode, scene });
          setShowDialog(true);
          setPendingComicParams(null);
          return;
        }
      }
      // No dialog, check preparation screen
      maybeShowPreparation(diff, mode, scene);
    }
    setPendingComicParams(null);
  }, [pendingComicParams, shouldShowDialog, maybeShowPreparation]);

  const handleComicSkip = useCallback(() => {
    setShowComic(false);
    setComicChapter(null);
    if (pendingComicParams) {
      const { diff, mode, scene } = pendingComicParams;
      // After comic skip, check dialog
      if (shouldShowDialog(scene, mode)) {
        const dialogConfig = DIALOG_CONFIGS.find(d => d.sceneType === scene);
        if (dialogConfig) {
          setPendingDialogConfig(dialogConfig);
          setPendingStartParams({ diff, mode, scene });
          setShowDialog(true);
          setPendingComicParams(null);
          return;
        }
      }
      // No dialog, check preparation screen
      maybeShowPreparation(diff, mode, scene);
    }
    setPendingComicParams(null);
  }, [pendingComicParams, shouldShowDialog, doStartGame]);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resume();
  }, []);

  // Power Boost: trigger white flash on activation
  // useEffect(() => {
  //   if (powerBoostTimer > 0 && prevPowerBoostRef.current <= 0) {
  //     setPowerBoostFlash(true);
  //     setTimeout(() => setPowerBoostFlash(false), 400);
  //   }
  //   prevPowerBoostRef.current = powerBoostTimer;
  // }, [powerBoostTimer]);

  const handleRestart = useCallback(() => {
    setBossDefeated(false);
    engineRef.current?.audio.stopBGM();
    engineRef.current?.audio.stopVictoryBGM();
    engineRef.current?.audio.stopGameOverBGM();
    engineRef.current?.restart();
    // Sync React state with engine's consumable inventory (preserved across restarts)
    setTimeout(() => {
      const engine = engineRef.current;
      if (!engine) return;
      setCarriedConsumables({ ...engine.consumableInventory });
      setEmergencyCoolCount(engine.emergencyCoolInventory);
    }, 100);
    // 根据用户需求：不要默认的背景音乐，只在战斗开始后播放关卡音乐
    // 所以游戏重启后也不播放音乐，等待战斗开始
    const engine = engineRef.current;
    if (engine && engine.gameMode === GameMode.STORY) {
      setTimeout(() => {
        engine.audio.switchBGMForScene(engine.currentScene, engine.difficulty);
        // 不调用startBGM()，等待战斗开始
      }, 100);
    }
    // 非故事模式也不播放音乐，等待战斗开始
  }, []);

  // Continue to next wave after shopping
  // const handleContinueFromShop = useCallback(() => {
  //   engineRef.current?.continueFromShop();
  // }, []);

  const handleNextScene = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.audio.stopBGM();
    engine.audio.stopVictoryBGM();
    // Save shop upgrades before transitioning to next scene
    nextSceneUpgradesRef.current = [...(engine.progress.shopUpgrades || [])];
    // Consumables are now auto-saved to localStorage in onWaveClear/onGameOver/onConsumableUpdate
    // Find next scene in chain
    const currentIdx = SCENE_UNLOCK_CHAIN.indexOf(engine.currentScene);
    if (currentIdx >= 0 && currentIdx < SCENE_UNLOCK_CHAIN.length - 1) {
      const nextScene = SCENE_UNLOCK_CHAIN[currentIdx + 1];
      // Check if we need to show a comic first
      if (!hasSeenComic(nextScene)) {
        const chapter = getComicChapter(nextScene);
        if (chapter) {
          setComicChapter(chapter);
          setPendingComicParams({ diff: 'easy', mode: GameMode.STORY, scene: nextScene });
          setShowComic(true);
          return;
        }
      }
      // Check if we need to show a dialog
      if (shouldShowDialog(nextScene, GameMode.STORY)) {
        const dialogConfig = DIALOG_CONFIGS.find(d => d.sceneType === nextScene);
        if (dialogConfig) {
          setPendingDialogConfig(dialogConfig);
          setPendingStartParams({ diff: 'easy', mode: GameMode.STORY, scene: nextScene });
          setShowDialog(true);
          return;
        }
      }
      // No dialog needed, start immediately (shop upgrades preserved via ref)
      doStartGame('easy', GameMode.STORY, nextScene);
    }
  }, [doStartGame, shouldShowDialog]);

  // Called when item recycle animation completes — apply gold, refresh UI
  const handleRecycleComplete = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    // Apply recycled gold to economy (animation has finished)
    engine.applyRecycledGold();
    engine.clearRecycledInventory();
    // Refresh settlement UI with updated gold
    setEconomy({ ...engine.economy });
    // Sync to menu shop money
    setMenuShopMoney(engine.economy.money);
    try { localStorage.setItem('roach_blaster_menu_money', String(engine.economy.money)); } catch { /* ignore */ }
    setShowRecycleAnim(false);
  }, []);

  const handleQuit = useCallback(() => {
    engineRef.current?.audio.stopBGM();
    engineRef.current?.saveProgress();
    engineRef.current?.stop();
    setShowTalentTree(false);
    setShowAchievements(false);
    setShowSceneSelect(false);
    setShowEncyclopedia(false);
    setGameState(GameState.MENU);
  }, []);

  const handleReload = useCallback(() => {
    engineRef.current?.startReload();
  }, []);

  const handleEmergencyCool = useCallback(() => {
    engineRef.current?.emergencyCool();
  }, []);



  // Menu shop: buy consumable with menuShopMoney (persistent across levels)
  const handleMenuShopBuy = useCallback((id: string) => {
    const costs: Record<string, number> = {
      gas_refill: 250, defense_repair: 300, emergency_cool: 200,
      power_boost: 700, shield: 800, bait: 450,
    };
    const cost = costs[id];
    if (!cost || menuShopMoney < cost) return false;
    const newMoney = menuShopMoney - cost;
    setMenuShopMoney(newMoney);
    try { localStorage.setItem('roach_blaster_menu_money', String(newMoney)); } catch { /* ignore */ }
    // Update engine + React state + persist to localStorage
    const engine = engineRef.current;
    if (engine) {
      if (id === 'emergency_cool') {
        engine.emergencyCoolInventory++;
        setEmergencyCoolCount(engine.emergencyCoolInventory);
      } else {
        engine.consumableInventory[id] = (engine.consumableInventory[id] || 0) + 1;
      }
      setCarriedConsumables({ ...engine.consumableInventory });
      // Save to GameProgress (v3: consumables now persisted in main progress)
      engine.saveProgress();
    }
    // Also keep the separate localStorage for backwards compatibility
    try {
      const saved = localStorage.getItem('roach_blaster_consumables');
      const parsed = saved ? JSON.parse(saved) : { consumables: {}, emergencyCool: 0 };
      if (id === 'emergency_cool') {
        parsed.emergencyCool = (parsed.emergencyCool || 0) + 1;
      } else {
        parsed.consumables = parsed.consumables || {};
        parsed.consumables[id] = (parsed.consumables[id] || 0) + 1;
      }
      localStorage.setItem('roach_blaster_consumables', JSON.stringify(parsed));
    } catch { /* ignore */ }
    return true;
  }, [menuShopMoney]);

  const handleUseConsumable = useCallback((id: string) => {
    engineRef.current?.useConsumable(id);
  }, []);

  // const handleToggleAutoUse = useCallback((id: string) => {
  //   engineRef.current?.toggleAutoUse(id);
  // }, []);

  const handleSwitchWeapon = useCallback((weapon: string) => {
    return engineRef.current?.switchWeapon(weapon) ?? false;
  }, []);

  const handleCycleWeapon = useCallback(() => {
    engineRef.current?.cycleFlameMode();
  }, []);

  const handleSpendTalent = useCallback((talentId: string) => {
    const engine = engineRef.current;
    if (!engine) return false;
    const result = engine.spendTalentPoint(talentId);
    if (result) {
      setTalentPoints(engine.progress.talentTree.points);
      setProgress({ ...engine.progress });
    }
    return result;
  }, []);

  // Global input
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      // placing state: drag to move range position
      if (engine.itemPlaceState === 'placing') {
        engine.setMousePos(e.clientX, e.clientY);
        return;
      }
      if (engine.isAiming) {
        const rect = engine.canvas.getBoundingClientRect();
        const scaleX = engine.width / rect.width;
        const gameX = (e.clientX - rect.left) * scaleX;
        engine.aimTargetX = gameX;
        return;
      }
      engine.setMouseX(e.clientX);
    };
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const engine = engineRef.current;
      if (!engine) return;
      // DEBUG: Check Win Now button click first
      // ITEM_DROP state: click to pick up the dropped item
      if (engine.state === GameState.ITEM_DROP) {
        engine.handleItemDropClick(e.clientX, e.clientY);
        return;
      }
      // Step 1: pending_click → first click shows range
      if (engine.itemPlaceState === 'pending_click') {
        engine.handleScreenClick(e.clientX, e.clientY);
        return;
      }
      // Step 2: placing → don't fire, just drag
      if (engine.itemPlaceState === 'placing') return;
      if (engine.isAiming) return;
      engine.setFiring(true);
      engine.setMouseX(e.clientX);
      // Fire haptic feedback in user gesture handler (browser requires this)
      Vibration.vibrateFire();
    };
    const handleGlobalMouseUp = () => {
      const engine = engineRef.current;
      if (!engine) return;
      // Step 3: placing → release to deploy
      if (engine.itemPlaceState === 'placing') {
        engine.onItemRelease();
        return;
      }
      engine.setFiring(false);
    };
    const handleGlobalTouchMove = (e: TouchEvent) => {
      const engine = engineRef.current;
      // Prevent scroll only when touching the canvas (game area)
      if (e.target === canvasRef.current) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      if (!touch) return;
      if (!engine) return;
      // placing: drag to move range position
      if (engine.itemPlaceState === 'placing') {
        engine.setMousePos(touch.clientX, touch.clientY);
        return;
      }
      if (engine.isAiming) {
        const rect = engine.canvas.getBoundingClientRect();
        const scaleX = engine.width / rect.width;
        const gameX = (touch.clientX - rect.left) * scaleX;
        engine.aimTargetX = gameX;
        return;
      }
      engine.setMouseX(touch.clientX);
    };
    const handleGlobalTouchStart = (e: TouchEvent) => {
      const engine = engineRef.current;
      // Prevent default only when touching canvas (allow UI buttons to generate click events)
      if (e.target === canvasRef.current) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      if (!touch) return;
      if (!engine) return;
      // ITEM_DROP state: touch to pick up the dropped item
      if (engine.state === GameState.ITEM_DROP) {
        engine.handleItemDropClick(touch.clientX, touch.clientY);
        return;
      }
      // pending_click → first touch shows range
      if (engine.itemPlaceState === 'pending_click') {
        engine.handleScreenClick(touch.clientX, touch.clientY);
        return;
      }
      // placing → don't fire
      if (engine.itemPlaceState === 'placing') return;
      if (engine.isAiming) return;
      engine.setMouseX(touch.clientX);
      engine.setFiring(true);
      // Fire haptic feedback in user gesture handler (browser requires this)
      Vibration.vibrateFire();
    };
    const handleGlobalTouchEnd = () => {
      const engine = engineRef.current;
      if (!engine) return;
      // placing → release to deploy
      if (engine.itemPlaceState === 'placing') {
        engine.onItemRelease();
        return;
      }
      engine.setFiring(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mousedown', handleGlobalMouseDown);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchstart', handleGlobalTouchStart, { passive: false });
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mousedown', handleGlobalMouseDown);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchstart', handleGlobalTouchStart);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        engine.setFiring(true);
        break;
      case 'r':
      case 'R':
        engine.startReload();
        break;
      case 'q':
      case 'Q':
        engine.useSwatter();
        break;
      case 'e':
      case 'E':
        engine.cycleFlameMode();
        break;
      case '1':
        engine.switchWeapon('flamethrower');
        break;
      case '2':
        engine.switchWeapon('sticky');
        break;
      case '3':
        engine.switchWeapon('poison');
        break;
      case '4':
        engine.switchWeapon('shotgun');
        break;
      case '5':
        engine.switchWeapon('molotov');
        break;
      case 'Escape':
        if (engine.state === GameState.PLAYING) {
          engine.pause();
        } else if (engine.state === GameState.PAUSED) {
          engine.resume();
        }
        break;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      engineRef.current?.setFiring(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Endless mode timer polling
  useEffect(() => {
    if (gameMode !== GameMode.ENDLESS || gameState !== GameState.PLAYING) return;
    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      setEndlessTimer(engine.endlessElapsedTime);
      setEndlessBestTime(engine.endlessBestTime);
      setEndlessNewRecordVisible(engine.endlessNewRecordTimer > 0);
    }, 100);
    return () => clearInterval(interval);
  }, [gameMode, gameState]);

  // Countdown state polling
  useEffect(() => {
    if (gameState !== GameState.COUNTDOWN) return;
    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      setCountdownPhase(engine.countdownPhase);
      setCountdownTimer(engine.countdownTimer);
    }, 50);
    return () => clearInterval(interval);
  }, [gameState]);

  const handleCanvasMouseDown = useCallback((_e: React.MouseEvent) => {}, []);
  const handleCanvasTouchStart = useCallback((_e: React.TouchEvent) => {}, []);

  return (
    <div className="relative w-screen h-screen bg-black flex items-center justify-center overflow-hidden select-none">
      {/* Game container: wraps canvas + HUD so HUD aligns precisely with game area */}
      <div id="game-container" className="relative w-full h-full flex items-center justify-center">
      {/* Power Boost: border glow + blue-purple tint overlay */}
      {powerBoostTimer > 0 && (
        <div
          className="absolute inset-0 z-5 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 60px rgba(139, 92, 246, 0.5), inset 0 0 120px rgba(168, 130, 255, 0.25)',
            animation: 'powerBoostPulse 0.8s ease-in-out infinite alternate',
          }}
        />
      )}
      {/* Power Boost: blue-purple color tint */}
      {powerBoostTimer > 0 && (
        <div
          className="absolute inset-0 z-5 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center 80%, rgba(139, 92, 246, 0.1) 0%, rgba(100, 60, 200, 0.04) 50%, transparent 80%)',
            mixBlendMode: 'screen',
          }}
        />
      )}
      {/* Defense critical (< 10%): red border flash warning */}
      {defenseHp > 0 && defenseHp / maxDefenseHp < 0.1 && (
        <div
          className="absolute inset-0 z-6 pointer-events-none"
          style={{
            animation: 'defenseCriticalFlash 0.6s ease-in-out infinite',
          }}
        />
      )}

      <canvas
        ref={canvasRef}
        className="block cursor-crosshair touch-none"
        style={{ touchAction: 'none' }}
        onMouseDown={handleCanvasMouseDown}
        onTouchStart={handleCanvasTouchStart}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Pre-wave 3-2-1 countdown overlay */}
      {gameState === GameState.COUNTDOWN && (
        <CountdownOverlay phase={countdownPhase} timer={countdownTimer} />
      )}

      {/* Title Screen - shown before main menu */}
      {showTitleScreen && (
        <TitleScreen
          onStart={() => {
            setShowTitleScreen(false);
            // 根据用户需求：不要默认的背景音乐，只在战斗开始后播放关卡音乐
            // 所以标题屏幕进入主菜单时不播放任何音乐
            const engine = engineRef.current;
            if (engine) {
              engine.audio.setMuted(audioMuted);
              // 不调用switchBGMForScene和startBGM，等待战斗开始
            }
          }}
          audioMuted={audioMuted}
          onToggleMute={handleToggleMute}
          audio={engineRef.current?.audio}
        />
      )}

      {gameState === GameState.MENU && !showTitleScreen && !showMenuShop && !showTalentTree && !showAchievements && !showEncyclopedia && (
        <GameMenu
          onStart={handleStart}
          onOpenTalentTree={() => setShowTalentTree(true)}
          onOpenAchievements={() => setShowAchievements(true)}
          onOpenSceneSelect={() => setShowSceneSelect(true)}
          onOpenEncyclopedia={() => setShowEncyclopedia(true)}
          audioMuted={audioMuted}
          onToggleMute={handleToggleMute}
          onOpenShop={() => setShowMenuShop(true)}
          progress={progress}
          talentPoints={talentPoints}
          audio={engineRef.current?.audio}
        />
      )}

      {/* Menu Shop —道具商店入口（从主菜单打开） */}
      {showMenuShop && (
        <ShopScreen
          economy={{
            money: menuShopMoney,
            totalKills: 0,
            smallKills: 0,
            largeKills: 0,
            flyingKills: 0,
            armoredKills: 0,
            splittingKills: 0,
            suicideKills: 0,
            flyingSuicideKills: 0,
            queenKills: 0,
            nurseKills: 0,
            mutantKills: 0,
            timedSuicideKills: 0,
            perfectWaves: 0,
            gasSavedBonus: 0,
            breaches: 0,
            gasCanistersUsed: 0,
            highestWave: 0,
            highestEndlessWave: 0,
            totalGamesPlayed: 0,
            totalMoneyEarned: 0,
            totalDamage: 0,
            totalMoneySpent: 0,
            totalConsumablesUsed: 0,
            totalWeaponsUnlocked: 0,
            totalUpgradesPurchased: 0,
            totalAchievements: 0
          }}
          onBuy={handleMenuShopBuy}
          onContinue={() => setShowMenuShop(false)}
          onQuit={() => setShowMenuShop(false)}
          talentPoints={talentPoints}
          difficulty={difficulty}
          currentScene={currentScene}
          onOpenTalentTree={() => {
            setShowMenuShop(false);
            setShowTalentTree(true);
          }}
          isMenuShop
          audio={engineRef.current?.audio}
        />
      )}

      {showTalentTree && progress && (
        <TalentTreeScreen
          progress={progress}
          talentPoints={talentPoints}
          onSpendTalent={handleSpendTalent}
          onClose={() => {
            setShowTalentTree(false);
            setGameState(GameState.MENU);
          }}
          audio={engineRef.current?.audio}
        />
      )}

      {showAchievements && progress && (
        <AchievementsScreen
          progress={progress}
          onClose={() => {
            setShowAchievements(false);
            setGameState(GameState.MENU);
          }}
        />
      )}

      {showEncyclopedia && progress && (
        <EncyclopediaScreen
          progress={progress}
          onClose={() => {
            setShowEncyclopedia(false);
            setGameState(GameState.MENU);
          }}
        />
      )}

      {showSceneSelect && progress && (
        <SceneSelectScreen
          progress={progress}
          onSelectScene={(scene) => {
            setShowSceneSelect(false);
            setCurrentScene(scene);
          }}
          onClose={() => {
            setShowSceneSelect(false);
            setGameState(GameState.MENU);
          }}
          audio={engineRef.current?.audio}
        />
      )}

      {/* Kitchen first-wave gameplay tutorial overlay */}
      {tutorialPauseSpawn && (
        <GameplayTutorialOverlay
          audio={engineRef.current?.audio}
          onComplete={() => {
            engineRef.current?.resumeSpawnAfterTutorial();
          }}
          onSkip={() => {
            engineRef.current?.resumeSpawnAfterTutorial();
          }}
        />
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.ITEM_DROP) && player && economy && (
        <GameHUD
          player={player}
          economy={economy}
          wave={wave}
          defenseHp={defenseHp}
          maxDefenseHp={maxDefenseHp}
          onPause={handlePause}
          onReload={handleReload}
          onEmergencyCool={handleEmergencyCool}
          difficulty={difficulty}
          gameMode={gameMode}
          currentWeapon={currentWeapon}
          onSwitchWeapon={handleSwitchWeapon}
          onCycleWeapon={handleCycleWeapon}
          progress={progress}
          isAiming={isAiming}
          onStartAim={(weapon) => engineRef.current?.startAiming(weapon)}
          onThrow={() => engineRef.current?.throwAimedWeapon()}
          onCancelAim={() => engineRef.current?.cancelAiming()}
          inventory={inventory}
          selectedItemIndex={selectedItemIndex}
          isPlacingItem={isPlacingItem}
          onSelectItem={(idx) => engineRef.current?.selectItem(idx)}
          currentScene={currentScene}
          tripleFlameActive={tripleFlameActive}
          tripleFlameTimer={tripleFlameTimer}
          tripleFlameDuration={15}
          bossState={bossState}
          carriedConsumables={carriedConsumables}
          buffFlashTimers={buffFlashTimers}
          onUseConsumable={handleUseConsumable}
          consumableCooldowns={consumableCooldowns}
          globalConsumableCooldown={globalConsumableCooldown}
          combatStartTimer={combatStartTimer}
          itemCooldowns={itemCooldowns}
          shieldTimer={engineRef.current?.player?.shieldTimer || 0}
          emergencyCoolInventory={emergencyCoolCount}
          audio={engineRef.current?.audio}
        />
      )}

      {/* Endless Mode Timer - top right */}
      {gameMode === GameMode.ENDLESS && gameState === GameState.PLAYING && (
        <div className="absolute top-[200px] right-3 z-30 flex flex-col items-end gap-1 pointer-events-none">
          {/* Current timer */}
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-orange-500/30">
            <div className="text-[10px] text-orange-300/70 uppercase tracking-wider">本次坚持</div>
            <div className="text-xl font-black text-orange-400 font-mono leading-tight">
              {Math.floor(endlessTimer / 60)}:{String(Math.floor(endlessTimer % 60)).padStart(2, '0')}
              <span className="text-sm">.{String(Math.floor((endlessTimer % 1) * 10))}</span>
            </div>
          </div>

          {/* Best time (hidden when new record) */}
          {endlessBestTime > 0 && !endlessNewRecordVisible && (
            <div className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1 border border-yellow-500/20">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <div className="text-[10px] text-yellow-400/60 uppercase tracking-wider">历史最高</div>
              </div>
              <div className="text-sm font-bold text-yellow-400/80 font-mono">
                {Math.floor(endlessBestTime / 60)}:{String(Math.floor(endlessBestTime % 60)).padStart(2, '0')}
              </div>
            </div>
          )}

          {/* New Record notification */}
          {endlessNewRecordVisible && (
            <div className="bg-gradient-to-r from-yellow-900/80 to-orange-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-yellow-400/50 animate-pulse">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fbbf24" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span className="text-sm font-black text-yellow-300">你创造了新纪录!</span>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === GameState.PAUSED && (
        <PauseScreen
          onResume={handleResume}
          onRestart={handleRestart}
          onQuit={handleQuit}
          audio={engineRef.current?.audio}
        />
      )}

      {gameState === GameState.GAME_OVER && economy && (
        <GameOverScreen
          economy={economy}
          wave={finalWave}
          gameMode={gameMode}
          currentScene={currentScene}
          isVictory={false}
          hasNextScene={false}
          onRestart={handleRestart}
          onQuit={handleQuit}
          talentPoints={talentPoints}
          bossDefeated={bossDefeated}
          onOpenTalentTree={() => setShowTalentTree(true)}
          audio={engineRef.current?.audio}
          menuMoney={menuShopMoney}
        />
      )}

      {/* Post-battle item reveal overlay */}
      {gameState === GameState.ITEM_REVEAL && (
        <ItemRevealScreen
          item={itemRevealData.length > 0 ? itemRevealData[engineRef.current?.rewardIndex || 0] : null}
          onComplete={() => {
            engineRef.current?.completeItemReveal();
          }}
          audio={engineRef.current?.audio}
        />
      )}

      {gameState === GameState.WAVE_CLEAR && economy && (
        <GameOverScreen
          economy={economy}
          wave={wave}
          gameMode={gameMode}
          currentScene={currentScene}
          isVictory={true}
          hasNextScene={(() => {
            const idx = SCENE_UNLOCK_CHAIN.indexOf(currentScene);
            return idx >= 0 && idx < SCENE_UNLOCK_CHAIN.length - 1;
          })()}
          onRestart={handleRestart}
          onQuit={handleQuit}
          talentPoints={talentPoints}
          bossDefeated={false}
          onOpenTalentTree={() => setShowTalentTree(true)}
          onNextScene={(() => {
            const idx = SCENE_UNLOCK_CHAIN.indexOf(currentScene);
            if (idx >= 0 && idx < SCENE_UNLOCK_CHAIN.length - 1) {
              return handleNextScene;
            }
            return undefined;
          })()}
          audio={engineRef.current?.audio}
          menuMoney={menuShopMoney}
        />
      )}

      {/* Comic viewer overlay */}
      {showComic && comicChapter && (
        <ComicViewer
          chapter={comicChapter}
          onComplete={handleComicComplete}
          onSkip={handleComicSkip}
          audio={engineRef.current?.audio}
        />
      )}

      {/* Dialog overlay - highest z-index */}
      {showDialog && pendingDialogConfig && (
        <DialogScreen
          config={pendingDialogConfig}
          difficulty={pendingStartParams?.diff}
          onComplete={handleDialogComplete}
          onSkip={handleDialogSkip}
          audio={engineRef.current?.audio}
        />
      )}

      {/* Preparation screen - item selection before level start */}
      {showPreparation && pendingPreparationParams && (
        <PreparationScreen
          scene={SCENE_CONFIGS[pendingPreparationParams.scene].name}
          difficulty={pendingPreparationParams.diff}
          availableItems={preparationItems}
          onStart={(selected) => {
            setShowPreparation(false);
            if (pendingPreparationParams) {
              doStartGame(
                pendingPreparationParams.diff,
                pendingPreparationParams.mode,
                pendingPreparationParams.scene,
                selected
              );
            }
            setPendingPreparationParams(null);
          }}
          onBack={() => {
            setShowPreparation(false);
            setPendingPreparationParams(null);
            // Return to menu
            if (engineRef.current) {
              engineRef.current.state = GameState.MENU;
              setGameState(GameState.MENU);
            }
          }}
          audio={engineRef.current?.audio}
        />
      )}

      {/* Unused inventory -> gold recycle animation (rendered LAST to be on top of everything) */}
      {showRecycleAnim && (
        <ItemRecycleAnimation
          inventory={recycleInventory}
          onComplete={handleRecycleComplete}
        />
      )}
    </div>
    </div>
  );
};
