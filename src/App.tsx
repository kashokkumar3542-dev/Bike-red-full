import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike,
  Flag,
  Home,
  Pause,
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  ShoppingBag,
  Sparkles,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BikeShopModal } from './components/BikeShopModal';
import { LaughBubble, OldManCharacter } from './components/OldManCharacter';
import { SettingsModal } from './components/SettingsModal';
import { SpeedMeter } from './components/SpeedMeter';
import { HighwayGameEngine } from './game/HighwayGameEngine';
import { loadCustomGlbMotorcycle } from './game/bikeBuilder';
import { deleteCustomGlb, listCustomGlbMap, saveCustomGlb } from './game/glbStore';
import { SoundEngine } from './game/soundEngine';
import { loadSaveData, persistSaveData, resetSaveData } from './game/storage';
import {
  AudioSettings,
  BIKE_CATALOG,
  BikeSpec,
  GameScreen,
  HudTelemetry,
  isBikeUnlocked,
  isMilestoneMet,
  RunResults,
  SaveData,
} from './game/types';

const INITIAL_HUD: HudTelemetry = {
  speedKmh: 0,
  rpmRatio: 0.12,
  gear: 1,
  distanceKm: 0,
  timeRemaining: 45,
  hasStartedMoving: false,
  nextCheckpointKm: 1.0,
  checkpointNumber: 1,
  bikesPassed: 0,
  bridgesCrossed: 0,
  dividerHits: 0,
  roadZone: 'normal',
  isAccelerating: false,
  topSpeedKmh: 0,
  peakZone: 'normal',
  bannerMessage: null,
  bannerAccent: 'gold',
};

export default function App() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [returnScreen, setReturnScreen] = useState<GameScreen>('menu');
  const [previewBikeId, setPreviewBikeId] = useState<string>(() => loadSaveData().equippedBikeId);
  const [hud, setHud] = useState<HudTelemetry>(INITIAL_HUD);
  const [results, setResults] = useState<RunResults | null>(null);
  const [laughBubbles, setLaughBubbles] = useState<LaughBubble[]>([]);
  const [collisionFlash, setCollisionFlash] = useState(false);
  const [customGlbFiles, setCustomGlbFiles] = useState<Record<string, string>>({});

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HighwayGameEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const saveRef = useRef<SaveData>(saveData);
  const screenRef = useRef<GameScreen>(screen);
  const bubbleIdRef = useRef(1);
  const touchOriginXRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  saveRef.current = saveData;
  screenRef.current = screen;

  const equippedBike = useMemo(
    () => BIKE_CATALOG.find((b) => b.id === saveData.equippedBikeId) ?? BIKE_CATALOG[0],
    [saveData.equippedBikeId]
  );

  // Load list of any previously imported custom .GLB files from IndexedDB
  useEffect(() => {
    void listCustomGlbMap().then(setCustomGlbFiles);
  }, []);

  // Persist save changes & sync audio/vibration settings
  useEffect(() => {
    persistSaveData(saveData);
    soundRef.current?.applySettings(saveData.settings);
    engineRef.current?.setVibrationEnabled(saveData.settings.vibrationEnabled);
  }, [saveData]);

  // Spawn an animated "HA HA!" bubble beside the old man, synced with voice laugh
  const triggerLaughBubble = useCallback((intensity: 'mild' | 'excited' | 'turbo') => {
    const id = bubbleIdRef.current++;
    const texts =
      intensity === 'turbo'
        ? ['HA HA HA!!', 'WHOA HA HA!', 'HA HA!!']
        : intensity === 'excited'
          ? ['HA HA HA!', 'HA HA!!']
          : ['HA HA!', 'HEH HA HA!'];
    const text = texts[Math.floor(Math.random() * texts.length)];
    const accent: 'normal' | 'red' | 'black' =
      intensity === 'turbo' ? 'black' : intensity === 'excited' ? 'red' : 'normal';

    const bubble: LaughBubble = {
      id,
      text,
      offsetX: Math.round(Math.random() * 26),
      offsetY: Math.round(Math.random() * 22),
      accent,
    };

    setLaughBubbles((prev) => [...prev.slice(-3), bubble]);
    window.setTimeout(() => {
      setLaughBubbles((prev) => prev.filter((item) => item.id !== id));
    }, 950);
  }, []);

  // Initialize Three.js Engine & Web Audio Sound Engine ONCE
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const sound = new SoundEngine(saveRef.current.settings);
    soundRef.current = sound;

    const engine = new HighwayGameEngine(mount, sound, {
      onHudUpdate: (telemetry) => {
        setHud(telemetry);
      },
      onOldManLaugh: (intensity) => {
        triggerLaughBubble(intensity);
      },
      onDividerHit: () => {
        setCollisionFlash(true);
        window.setTimeout(() => setCollisionFlash(false), 260);
      },
      onGameOver: (rawResults) => {
        const current = saveRef.current;
        const isNewBestDistance = rawResults.distanceKm > current.bestDistanceKm;
        const isNewBestSpeed = rawResults.topSpeedKmh > current.bestSpeedKmh;

        const nextSave: SaveData = {
          ...current,
          bestDistanceKm: Math.max(current.bestDistanceKm, rawResults.distanceKm),
          totalDistanceKm: Number((current.totalDistanceKm + rawResults.distanceKm).toFixed(2)),
          bestSpeedKmh: Math.max(current.bestSpeedKmh, rawResults.topSpeedKmh),
          totalRuns: current.totalRuns + 1,
        };

        // Automatically unlock any bikes whose riding milestones were newly reached!
        const newlyUnlockedNames: string[] = [];
        const updatedUnlocked = [...nextSave.unlockedBikeIds];
        for (const bike of BIKE_CATALOG) {
          if (!updatedUnlocked.includes(bike.id) && isMilestoneMet(bike, nextSave)) {
            updatedUnlocked.push(bike.id);
            newlyUnlockedNames.push(bike.name);
          }
        }
        nextSave.unlockedBikeIds = updatedUnlocked;
        if (newlyUnlockedNames.length > 0) {
          sound.playUnlock();
        }

        setSaveData(nextSave);
        setResults({
          ...rawResults,
          isNewBestDistance,
          isNewBestSpeed,
          newlyUnlockedBikeNames: newlyUnlockedNames,
        });
        setScreen('gameover');
      },
    });

    engine.setVibrationEnabled(saveRef.current.settings.vibrationEnabled);
    engineRef.current = engine;
    const initialSpec =
      BIKE_CATALOG.find((b) => b.id === saveRef.current.equippedBikeId) ?? BIKE_CATALOG[0];
    engine.setScreen('menu', initialSpec);

    return () => {
      engine.dispose();
      sound.dispose();
      engineRef.current = null;
      soundRef.current = null;
    };
  }, [triggerLaughBubble]);

  // Keyboard controls for desktop testing (Space/Up/W hold to accelerate, Left/Right/A/D subtle lean, Esc pause)
  useEffect(() => {
    const keys = { left: false, right: false };
    const syncSteer = () => {
      const val = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      engineRef.current?.setSteerInput(val);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (screenRef.current === 'playing') {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          engineRef.current?.setTouching(true);
        } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          keys.left = true;
          syncSteer();
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          keys.right = true;
          syncSteer();
        } else if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setScreen('paused');
          engineRef.current?.setScreen('paused', equippedBike);
        }
      } else if (screenRef.current === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) {
        e.preventDefault();
        setScreen('playing');
        engineRef.current?.setScreen('playing', equippedBike);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        engineRef.current?.setTouching(false);
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        keys.left = false;
        syncSteer();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        keys.right = false;
        syncSteer();
      }
    };

    const onBlur = () => {
      keys.left = false;
      keys.right = false;
      engineRef.current?.setTouching(false);
      engineRef.current?.setSteerInput(0);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [equippedBike]);

  const handleUpdateSettings = useCallback((patch: Partial<AudioSettings>) => {
    soundRef.current?.init();
    setSaveData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const toggleMasterSound = useCallback(() => {
    soundRef.current?.init();
    setSaveData((prev) => ({
      ...prev,
      settings: { ...prev.settings, soundEnabled: !prev.settings.soundEnabled },
    }));
  }, []);

  const handleResetProgress = useCallback(() => {
    const fresh = resetSaveData();
    setSaveData(fresh);
    setPreviewBikeId(fresh.equippedBikeId);
    engineRef.current?.setPlayerBike(BIKE_CATALOG[0], true);
  }, []);

  const handleStartGame = useCallback(() => {
    soundRef.current?.init();
    soundRef.current?.applySettings(saveRef.current.settings);
    setResults(null);
    setLaughBubbles([]);
    setCollisionFlash(false);
    setScreen('playing');
    engineRef.current?.startFreshRun(equippedBike);
  }, [equippedBike]);

  const handlePause = useCallback(() => {
    setScreen('paused');
    engineRef.current?.setScreen('paused', equippedBike);
  }, [equippedBike]);

  const handleResume = useCallback(() => {
    setScreen('playing');
    engineRef.current?.setScreen('playing', equippedBike);
  }, [equippedBike]);

  const handleOpenShowroom = useCallback((targetMode: 'shop' | 'select') => {
    soundRef.current?.init();
    soundRef.current?.playUiSelect();
    const currentId = saveRef.current.equippedBikeId;
    setPreviewBikeId(currentId);
    setScreen(targetMode);
    const spec = BIKE_CATALOG.find((b) => b.id === currentId) ?? BIKE_CATALOG[0];
    engineRef.current?.setScreen(targetMode, spec);
  }, []);

  const handleOpenSettings = useCallback((from: GameScreen) => {
    soundRef.current?.init();
    soundRef.current?.playUiSelect();
    setReturnScreen(from);
    setScreen('settings');
  }, []);

  const handleCloseSettings = useCallback(() => {
    soundRef.current?.playUiSelect();
    setScreen(returnScreen);
    if (returnScreen === 'menu') {
      engineRef.current?.setScreen('menu', equippedBike);
    }
  }, [returnScreen, equippedBike]);

  const handleGoMenu = useCallback(() => {
    soundRef.current?.playUiSelect();
    setScreen('menu');
    engineRef.current?.setScreen('menu', equippedBike);
  }, [equippedBike]);

  const handleSelectShopPreview = useCallback((bikeId: string) => {
    soundRef.current?.init();
    soundRef.current?.playUiSelect();
    setPreviewBikeId(bikeId);
    const spec = BIKE_CATALOG.find((b) => b.id === bikeId);
    if (spec) {
      engineRef.current?.setPlayerBike(spec, false);
    }
  }, []);

  const handleUnlockBike = useCallback((bike: BikeSpec) => {
    soundRef.current?.init();
    setSaveData((prev) => {
      if (prev.unlockedBikeIds.includes(bike.id) || !isMilestoneMet(bike, prev)) return prev;
      soundRef.current?.playUnlock();
      return {
        ...prev,
        unlockedBikeIds: [...prev.unlockedBikeIds, bike.id],
        equippedBikeId: bike.id,
      };
    });
  }, []);

  const handleEquipBike = useCallback((bikeId: string) => {
    soundRef.current?.init();
    setSaveData((prev) => {
      if (!isBikeUnlocked(bikeId, prev)) return prev;
      soundRef.current?.playUiSelect();
      return { ...prev, equippedBikeId: bikeId };
    });
  }, []);

  const handleImportGlb = useCallback(async (bikeId: string, file: File) => {
    const spec = BIKE_CATALOG.find((b) => b.id === bikeId) ?? BIKE_CATALOG[0];
    const arrayBuffer = await file.arrayBuffer();
    // Validate parseable GLB/GLTF before persisting into IndexedDB
    const testBuild = await loadCustomGlbMotorcycle(arrayBuffer.slice(0), spec);
    testBuild.dispose();

    await saveCustomGlb(bikeId, file.name, arrayBuffer);
    setCustomGlbFiles((prev) => ({ ...prev, [bikeId]: file.name }));
    engineRef.current?.reloadCurrentBike();
    soundRef.current?.playUnlock();
  }, []);

  const handleResetGlb = useCallback(async (bikeId: string) => {
    await deleteCustomGlb(bikeId);
    setCustomGlbFiles((prev) => {
      const next = { ...prev };
      delete next[bikeId];
      return next;
    });
    engineRef.current?.reloadCurrentBike();
    soundRef.current?.playUiSelect();
  }, []);

  const handleRotateShowroom = useCallback((deltaRad: number) => {
    engineRef.current?.rotateShowroomBy(deltaRad);
  }, []);

  const handleSetShowroomDragging = useCallback((dragging: boolean) => {
    engineRef.current?.setShowroomDragging(dragging);
  }, []);

  // FULL-SCREEN TOUCH & HOLD ACCELERATION (with subtle invisible finger-slide lean, ZERO buttons!)
  const handleTouchStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (screenRef.current !== 'playing') return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    activePointerIdRef.current = e.pointerId;
    touchOriginXRef.current = e.clientX;
    engineRef.current?.setTouching(true);
    engineRef.current?.setSteerInput(0);
  }, []);

  const handleTouchMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (screenRef.current !== 'playing') return;
    if (activePointerIdRef.current !== e.pointerId || touchOriginXRef.current === null) return;
    const dx = e.clientX - touchOriginXRef.current;
    // Deadzone of 14px so pure touch-and-hold stays rock-straight; sliding leans naturally
    if (Math.abs(dx) < 14) {
      engineRef.current?.setSteerInput(0);
    } else {
      const normalized = Math.max(-1, Math.min(1, (dx - Math.sign(dx) * 14) / 90));
      engineRef.current?.setSteerInput(normalized);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    activePointerIdRef.current = null;
    touchOriginXRef.current = null;
    engineRef.current?.setTouching(false);
    engineRef.current?.setSteerInput(0);
  }, []);

  const timerLow = hud.hasStartedMoving && hud.timeRemaining <= 8;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#7ec4f2] text-white select-none">
      {/* Isolated WebGL 3D Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {/* =================================================================== */}
      {/* SCREEN 1: MAIN MENU                                                 */}
      {/* =================================================================== */}
      {screen === 'menu' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-t from-[#08101c]/88 via-transparent to-[#08101c]/55">
          {/* Compact Top Bar */}
          <header className="flex items-center justify-between gap-3">
            <div className="min-h-[44px] px-3.5 rounded-xl bg-[#0c1322]/85 border border-white/18 flex items-center gap-2 text-xs sm:text-sm font-display tabular-nums text-white/90">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Best {saveData.bestSpeedKmh} KM/H</span>
              <span className="text-white/35" aria-hidden="true">·</span>
              <span>{saveData.totalDistanceKm.toFixed(1)} KM Total</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMasterSound}
                aria-label={saveData.settings.soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
                className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#0c1322]/85 border border-white/18 hover:bg-white/18 active:scale-95 transition flex items-center justify-center cursor-pointer"
              >
                {saveData.settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-white/55" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleOpenSettings('menu')}
                aria-label="Open Settings"
                className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#0c1322]/85 border border-white/18 hover:bg-white/18 active:scale-95 transition flex items-center justify-center cursor-pointer"
              >
                <SettingsIcon className="w-4 h-4 text-white" />
              </button>
            </div>
          </header>

          {/* Hero Title Block */}
          <div className="mt-1 sm:mt-3 text-center pointer-events-none">
            <h1 className="font-display font-bold italic text-5xl sm:text-7xl tracking-tight leading-none text-white drop-shadow-[0_6px_22px_rgba(8,16,28,0.65)]">
              BIKE <span className="text-red-500">RED</span> PULL
            </h1>
            <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1 rounded-xl bg-[#09101c]/70 text-xs sm:text-sm text-white/90">
              <span>Daytime Countryside Highway</span>
              <span aria-hidden="true">·</span>
              <span className="text-red-400 font-semibold">150+ Red Road</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-300 font-semibold">200+ Black Road</span>
            </div>
          </div>

          {/* Open Center for Live 3D Motorcycle & Countryside View */}
          <div className="flex-1" />

          {/* Bottom Thumb-Zone Navigation */}
          <div className="max-w-md w-full mx-auto space-y-2.5 pb-1">
            <div className="flex items-center justify-between text-xs text-white/85 px-1">
              <span className="truncate">
                Equipped: <strong className="font-display text-white">{equippedBike.name}</strong>
              </span>
              <span className="font-display tabular-nums shrink-0 text-white/80">
                Top {equippedBike.topSpeedKmh} KM/H
              </span>
            </div>

            <button
              type="button"
              onClick={handleStartGame}
              className="w-full min-h-[54px] px-6 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition text-white font-display font-bold text-lg tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-red-600/35 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>PLAY GAME</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenShowroom('select')}
                className="min-h-[48px] px-4 rounded-xl bg-[#0e1524]/92 hover:bg-[#172136] border border-white/18 active:scale-[0.98] transition text-white font-display font-bold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Bike className="w-4 h-4 text-sky-400" />
                <span>BIKE SELECTION</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenShowroom('shop')}
                className="min-h-[48px] px-4 rounded-xl bg-[#0e1524]/92 hover:bg-[#172136] border border-white/18 active:scale-[0.98] transition text-white font-display font-bold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span>BIKE SHOP</span>
              </button>
            </div>

            <p className="text-center text-xs text-white/75">
              Touch and hold anywhere on screen to accelerate · Release to slow down
            </p>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SCREEN 2: PLAY GAME (TOUCH-ONLY ACCELERATION, ZERO CONTROL BUTTONS) */}
      {/* =================================================================== */}
      {screen === 'playing' && (
        <div
          onPointerDown={handleTouchStart}
          onPointerMove={handleTouchMove}
          onPointerUp={handleTouchEnd}
          onPointerCancel={handleTouchEnd}
          onPointerLeave={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="fixed inset-0 z-20 flex flex-col justify-between touch-none cursor-pointer"
        >
          {/* High-Speed Visual Edge Tint & Collision Impact Flash */}
          <div
            className={`pointer-events-none fixed inset-0 transition-opacity duration-200 ${
              collisionFlash
                ? 'opacity-100 bg-red-600/28 shadow-[inset_0_0_95px_rgba(239,68,68,0.85)]'
                : hud.roadZone === 'black'
                  ? 'opacity-100 shadow-[inset_0_0_85px_rgba(251,191,36,0.22)]'
                  : hud.roadZone === 'red'
                    ? 'opacity-100 shadow-[inset_0_0_85px_rgba(239,68,68,0.34)]'
                    : 'opacity-0'
            }`}
          />

          {/* Compact Top Racing Bar (NO coin counter!) */}
          <header className="relative z-10 flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3.5 bg-gradient-to-b from-[#08101c]/78 to-transparent">
            <div className="min-h-[40px] px-3.5 rounded-xl bg-[#0b111e]/86 border border-white/16 flex items-center gap-2 text-xs sm:text-sm font-display tabular-nums">
              <span className="font-bold text-white">{hud.distanceKm.toFixed(2)} KM</span>
              <span className="hidden sm:inline text-white/35">/</span>
              <span className="hidden sm:inline text-white/70">
                Next CP {hud.nextCheckpointKm.toFixed(1)} KM
              </span>
            </div>

            <div
              className={`min-h-[40px] px-3.5 rounded-xl border flex items-center gap-1.5 font-display font-bold tabular-nums text-base sm:text-lg ${
                timerLow
                  ? 'bg-red-950/92 border-red-500 text-red-300'
                  : 'bg-[#0b111e]/86 border-white/18 text-white'
              }`}
            >
              <Timer className={`w-4 h-4 ${timerLow ? 'text-red-400' : 'text-sky-300'}`} />
              <span>{hud.timeRemaining.toFixed(1)}s</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMasterSound();
                }}
                aria-label={saveData.settings.soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#0b111e]/86 border border-white/18 hover:bg-white/18 active:scale-95 transition flex items-center justify-center cursor-pointer"
              >
                {saveData.settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-white/55" />
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePause();
                }}
                aria-label="Pause Game"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#0b111e]/86 border border-white/18 hover:bg-white/18 active:scale-95 transition flex items-center justify-center cursor-pointer"
              >
                <Pause className="w-4 h-4 text-white" />
              </button>
            </div>
          </header>

          {/* Dynamic Event Banner & Initial 0 KM/H Hold Prompt */}
          <div className="pointer-events-none relative z-10 flex flex-col items-center px-4 mt-2">
            {hud.bannerMessage && (
              <div
                className={`px-4 py-1.5 rounded-xl font-display font-bold text-xs sm:text-sm tracking-wider border shadow-lg ${
                  hud.bannerAccent === 'warning'
                    ? 'bg-red-700/95 border-amber-300 text-white'
                    : hud.bannerAccent === 'red'
                      ? 'bg-red-600/95 border-red-200 text-white'
                      : hud.bannerAccent === 'black'
                        ? 'bg-[#090a10]/95 border-amber-400 text-amber-300'
                        : hud.bannerAccent === 'green'
                          ? 'bg-emerald-600/95 border-emerald-200 text-white'
                          : 'bg-[#0f1626]/92 border-white/25 text-white'
                }`}
              >
                {hud.bannerMessage}
              </div>
            )}

            {!hud.hasStartedMoving && (
              <div className="mt-8 px-5 py-3 rounded-2xl bg-[#0a101d]/88 border border-white/22 text-center shadow-xl">
                <div className="font-display font-bold text-sm sm:text-base tracking-wider text-white">
                  TOUCH &amp; HOLD ANYWHERE TO RIDE
                </div>
                <div className="text-xs text-white/70 mt-0.5">
                  Release to slow down · Slide finger gently to stay off dividers
                </div>
              </div>
            )}
          </div>

          {/* 100% Open Highway, River, Bridges & Rear-View Motorcycle Center */}
          <div className="flex-1" />

          {/* Bottom Corners: Funny Old Man (Left) + Large Digital Speedometer (Right) */}
          <footer className="relative z-10 flex items-end justify-between px-3 pb-3.5 sm:px-6 sm:pb-5 pointer-events-none">
            <OldManCharacter
              speedKmh={hud.speedKmh}
              isAccelerating={hud.isAccelerating}
              roadZone={hud.roadZone}
              bubbles={laughBubbles}
            />

            <SpeedMeter
              speedKmh={hud.speedKmh}
              rpmRatio={hud.rpmRatio}
              gear={hud.gear}
              roadZone={hud.roadZone}
            />
          </footer>
        </div>
      )}

      {/* =================================================================== */}
      {/* SCREEN 3 & 4: BIKE SELECTION & BIKE SHOP                            */}
      {/* =================================================================== */}
      {(screen === 'shop' || screen === 'select') && (
        <BikeShopModal
          mode={screen}
          saveData={saveData}
          previewBikeId={previewBikeId}
          customGlbFiles={customGlbFiles}
          onSelectPreview={handleSelectShopPreview}
          onUnlockBike={handleUnlockBike}
          onEquipBike={handleEquipBike}
          onImportGlb={handleImportGlb}
          onResetGlb={handleResetGlb}
          onRotateShowroom={handleRotateShowroom}
          onSetShowroomDragging={handleSetShowroomDragging}
          onPlayNow={handleStartGame}
          onSwitchMode={(nextMode) => handleOpenShowroom(nextMode)}
          onBack={handleGoMenu}
        />
      )}

      {/* =================================================================== */}
      {/* SCREEN 5: SETTINGS                                                  */}
      {/* =================================================================== */}
      {screen === 'settings' && (
        <SettingsModal
          settings={saveData.settings}
          onUpdateSettings={handleUpdateSettings}
          onResetProgress={handleResetProgress}
          onBack={handleCloseSettings}
        />
      )}

      {/* =================================================================== */}
      {/* SCREEN 6: PAUSE MENU                                                */}
      {/* =================================================================== */}
      {screen === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#070b14]/80">
          <div className="w-full max-w-sm rounded-3xl bg-[#0e1422] border border-white/15 p-6 shadow-2xl">
            <h2 className="font-display font-bold text-3xl tracking-wider text-center text-white">
              PAUSED
            </h2>
            <div className="mt-1.5 flex items-center justify-center gap-2 text-xs text-white/70 tabular-nums font-display">
              <span>{hud.distanceKm.toFixed(2)} KM</span>
              <span aria-hidden="true">·</span>
              <span>Top {hud.topSpeedKmh} KM/H</span>
              <span aria-hidden="true">·</span>
              <span>{hud.bridgesCrossed} Bridges</span>
            </div>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={handleResume}
                className="w-full min-h-[48px] rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition text-white font-display font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>RESUME</span>
              </button>

              <button
                type="button"
                onClick={handleStartGame}
                className="w-full min-h-[48px] rounded-xl bg-white/10 hover:bg-white/16 active:scale-[0.98] transition text-white font-display font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESTART</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenSettings('paused')}
                className="w-full min-h-[48px] rounded-xl bg-white/[0.06] hover:bg-white/12 active:scale-[0.98] transition text-white font-display font-semibold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <SettingsIcon className="w-4 h-4 text-sky-400" />
                <span>SETTINGS</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenShowroom('shop')}
                className="w-full min-h-[48px] rounded-xl bg-white/[0.06] hover:bg-white/12 active:scale-[0.98] transition text-white font-display font-semibold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span>BIKE SHOP</span>
              </button>

              <button
                type="button"
                onClick={handleGoMenu}
                className="w-full min-h-[44px] rounded-xl text-white/65 hover:text-white transition text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Main Menu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SCREEN 7: GAME RESULTS (ZERO COINS!)                                */}
      {/* =================================================================== */}
      {screen === 'gameover' && results && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#070b14]/84">
          <div className="w-full max-w-md rounded-3xl bg-[#0e1422] border border-white/15 p-6 shadow-2xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-xs font-display font-semibold tracking-widest text-red-400">
                <Flag className="w-3.5 h-3.5" />
                <span>HIGHWAY RIDE COMPLETE</span>
              </div>
              <h2 className="mt-1 font-display font-bold text-3xl sm:text-4xl tracking-tight text-white">
                GAME RESULTS
              </h2>
            </div>

            {results.newlyUnlockedBikeNames.length > 0 && (
              <div className="mt-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 px-4 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm text-emerald-200">
                <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>
                  New Bike Unlocked:{' '}
                  <strong className="font-display text-white">
                    {results.newlyUnlockedBikeNames.join(', ')}
                  </strong>
                </span>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3.5">
                <div className="text-xs text-white/60">Top Speed</div>
                <div className="mt-1 font-display font-bold text-2xl sm:text-3xl tabular-nums text-white">
                  {results.topSpeedKmh} <span className="text-sm text-white/65">KM/H</span>
                </div>
                {results.isNewBestSpeed && (
                  <div className="mt-0.5 text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> New Record
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3.5">
                <div className="text-xs text-white/60">Distance</div>
                <div className="mt-1 font-display font-bold text-2xl sm:text-3xl tabular-nums text-white">
                  {results.distanceKm.toFixed(2)} <span className="text-sm text-white/65">KM</span>
                </div>
                {results.isNewBestDistance && (
                  <div className="mt-0.5 text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> New Record
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3.5">
                <div className="text-xs text-white/60">Peak Road Zone</div>
                <div
                  className={`mt-1 font-display font-bold text-lg ${
                    results.peakZone === 'black'
                      ? 'text-amber-300'
                      : results.peakZone === 'red'
                        ? 'text-red-400'
                        : 'text-white'
                  }`}
                >
                  {results.peakZone === 'black'
                    ? 'BLACK 200+'
                    : results.peakZone === 'red'
                      ? 'RED 150+'
                      : 'NORMAL ROAD'}
                </div>
                <div className="mt-0.5 text-[11px] text-white/55 tabular-nums">
                  {results.checkpointsCleared} checkpoints · {results.bikesPassed} bikes passed
                </div>
              </div>

              <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3.5">
                <div className="text-xs text-white/60">Countryside Stats</div>
                <div className="mt-1 font-display font-bold text-xl tabular-nums text-sky-300">
                  {results.bridgesCrossed} {results.bridgesCrossed === 1 ? 'Bridge' : 'Bridges'}
                </div>
                <div className="mt-0.5 text-[11px] text-white/55 tabular-nums">
                  Divider hits: {results.dividerHits}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={handleStartGame}
                className="w-full min-h-[52px] rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition text-white font-display font-bold text-base tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESTART RIDE</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOpenShowroom('shop')}
                  className="min-h-[48px] rounded-xl bg-white/10 hover:bg-white/16 active:scale-[0.98] transition text-white font-display font-bold text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  <span>BIKE SHOP</span>
                </button>

                <button
                  type="button"
                  onClick={handleGoMenu}
                  className="min-h-[48px] rounded-xl bg-white/[0.06] hover:bg-white/12 active:scale-[0.98] transition text-white font-display font-bold text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>MAIN MENU</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
