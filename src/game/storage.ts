import { AudioSettings, BIKE_CATALOG, isMilestoneMet, SaveData } from './types';

const STORAGE_KEY = 'bike_red_pull_save_v3';
const LEGACY_STORAGE_KEY = 'bike_red_pull_save_v2';

export const DEFAULT_SETTINGS: AudioSettings = {
  soundEnabled: true,
  musicEnabled: true,
  oldManVoiceEnabled: true,
  vibrationEnabled: true,
  unlockAllBikes: false,
};

export const DEFAULT_SAVE: SaveData = {
  unlockedBikeIds: [BIKE_CATALOG[0].id],
  equippedBikeId: BIKE_CATALOG[0].id,
  bestDistanceKm: 0,
  totalDistanceKm: 0,
  bestSpeedKmh: 0,
  totalRuns: 0,
  settings: { ...DEFAULT_SETTINGS },
};

export function loadSaveData(): SaveData {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS } };
    const parsed = JSON.parse(raw) as Partial<SaveData>;

    const settings: AudioSettings = {
      soundEnabled:
        typeof parsed.settings?.soundEnabled === 'boolean'
          ? parsed.settings.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled,
      musicEnabled:
        typeof parsed.settings?.musicEnabled === 'boolean'
          ? parsed.settings.musicEnabled
          : DEFAULT_SETTINGS.musicEnabled,
      oldManVoiceEnabled:
        typeof parsed.settings?.oldManVoiceEnabled === 'boolean'
          ? parsed.settings.oldManVoiceEnabled
          : DEFAULT_SETTINGS.oldManVoiceEnabled,
      vibrationEnabled:
        typeof parsed.settings?.vibrationEnabled === 'boolean'
          ? parsed.settings.vibrationEnabled
          : DEFAULT_SETTINGS.vibrationEnabled,
      unlockAllBikes:
        typeof parsed.settings?.unlockAllBikes === 'boolean'
          ? parsed.settings.unlockAllBikes
          : DEFAULT_SETTINGS.unlockAllBikes,
    };

    const bestDistanceKm =
      typeof parsed.bestDistanceKm === 'number' && Number.isFinite(parsed.bestDistanceKm)
        ? Math.max(0, parsed.bestDistanceKm)
        : 0;
    const totalDistanceKm =
      typeof parsed.totalDistanceKm === 'number' && Number.isFinite(parsed.totalDistanceKm)
        ? Math.max(0, parsed.totalDistanceKm)
        : 0;
    const bestSpeedKmh =
      typeof parsed.bestSpeedKmh === 'number' && Number.isFinite(parsed.bestSpeedKmh)
        ? Math.max(0, Math.floor(parsed.bestSpeedKmh))
        : 0;
    const totalRuns =
      typeof parsed.totalRuns === 'number' && Number.isFinite(parsed.totalRuns)
        ? Math.max(0, Math.floor(parsed.totalRuns))
        : 0;

    const validIds = new Set(BIKE_CATALOG.map((b) => b.id));
    const unlocked = Array.isArray(parsed.unlockedBikeIds)
      ? parsed.unlockedBikeIds.filter((id) => validIds.has(id))
      : [];
    if (!unlocked.includes(BIKE_CATALOG[0].id)) {
      unlocked.unshift(BIKE_CATALOG[0].id);
    }

    // Grant any newly added real-world bikes whose milestones are already exceeded by migrated stats
    const tempSave: SaveData = {
      unlockedBikeIds: unlocked,
      equippedBikeId: BIKE_CATALOG[0].id,
      bestDistanceKm,
      totalDistanceKm,
      bestSpeedKmh,
      totalRuns,
      settings,
    };
    for (const bike of BIKE_CATALOG) {
      if (!unlocked.includes(bike.id) && isMilestoneMet(bike, tempSave)) {
        unlocked.push(bike.id);
      }
    }

    const equipped =
      parsed.equippedBikeId &&
      validIds.has(parsed.equippedBikeId) &&
      (settings.unlockAllBikes || unlocked.includes(parsed.equippedBikeId))
        ? parsed.equippedBikeId
        : BIKE_CATALOG[0].id;

    return {
      unlockedBikeIds: unlocked,
      equippedBikeId: equipped,
      bestDistanceKm,
      totalDistanceKm,
      bestSpeedKmh,
      totalRuns,
      settings,
    };
  } catch {
    return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS } };
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors in restricted webviews
  }
}

export function resetSaveData(): SaveData {
  const fresh: SaveData = {
    ...DEFAULT_SAVE,
    unlockedBikeIds: [BIKE_CATALOG[0].id],
    settings: { ...DEFAULT_SETTINGS },
  };
  persistSaveData(fresh);
  return fresh;
}
