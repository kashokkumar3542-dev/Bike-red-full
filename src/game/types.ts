export type GameScreen =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'select'
  | 'shop'
  | 'settings'
  | 'gameover';

export type RoadZone = 'normal' | 'red' | 'black';

export type BikeModelProfile =
  | 'r15_v4'
  | 'pulsar_n160'
  | 'harley_x440'
  | 'ktm_rc390'
  | 'hayabusa'
  | 'bmw_s1000rr'
  | 'cbr1000rrr'
  | 'aprilia_rsv4'
  | 'panigale_v4'
  | 'ninja_h2r';

export type FrameStyle = 'deltabox' | 'trellis' | 'perimeter' | 'roadster';

export type HeadlightStyle =
  | 'central_m_eye'
  | 'wolf_eye'
  | 'round_classic'
  | 'rc_angular'
  | 'hayabusa_aero'
  | 'bmw_split'
  | 'fireblade_slit'
  | 'aprilia_triple'
  | 'panigale_brow'
  | 'h2r_ram_air';

export type ExhaustStyle =
  | 'side_sport'
  | 'underbelly_stub'
  | 'roadster_horizontal'
  | 'twin_chrome_mega'
  | 'titanium_side_high'
  | 'underbelly_twin'
  | 'h2r_megapipe';

export type WingletStyle = 'none' | 'recessed' | 'biplane' | 'h2r_wings';

export type EngineAudioProfile =
  | 'single_sport'
  | 'single_street'
  | 'single_thumper'
  | 'inline4_torque'
  | 'inline4_screamer'
  | 'v4_bark'
  | 'supercharged_h2r';

export interface UnlockRequirement {
  type: 'free' | 'topSpeed' | 'totalDistance' | 'runs';
  target: number;
  label: string;
}

export interface BikeSpec {
  id: string;
  brand: string;
  name: string;
  badgeText: string;
  subtitle: string;
  modelProfile: BikeModelProfile;
  frameStyle: FrameStyle;
  headlightStyle: HeadlightStyle;
  exhaustStyle: ExhaustStyle;
  wingletStyle: WingletStyle;
  engineAudioProfile: EngineAudioProfile;
  soundLabel: string;
  engineCc: string;
  horsepower: string;
  weightKg: number;
  topSpeedKmh: number;
  accelerationRate: number; // km/h per second base pull
  decelerationRate: number; // coasting drag
  vibrationHz: number;
  vibrationAmp: number;
  suspensionStiffness: number;
  wheelbaseScale: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  frameColor: number;
  rimColor: number;
  forkColor: number;
  riderJacketColor: number;
  helmetColor: number;
  referenceImageUrl?: string;
  statSpeed: number; // 1-100 display bar
  statAccel: number; // 1-100 display bar
  statStability: number; // 1-100 display bar
  tagline: string;
  unlock: UnlockRequirement;
}

export const BIKE_CATALOG: BikeSpec[] = [
  {
    id: 'yamaha_r15_v4',
    brand: 'Yamaha',
    name: 'Yamaha R15 V4',
    badgeText: 'R15 V4',
    subtitle: 'Track-Bred Supersport',
    modelProfile: 'r15_v4',
    frameStyle: 'deltabox',
    headlightStyle: 'central_m_eye',
    exhaustStyle: 'side_sport',
    wingletStyle: 'none',
    engineAudioProfile: 'single_sport',
    soundLabel: 'VVA Single Rev',
    engineCc: '155 cc Liquid-Cooled',
    horsepower: '18.4 HP',
    weightKg: 142,
    topSpeedKmh: 178,
    accelerationRate: 30,
    decelerationRate: 24,
    vibrationHz: 54,
    vibrationAmp: 0.0032,
    suspensionStiffness: 0.92,
    wheelbaseScale: 0.96,
    primaryColor: 0x1644c7,
    secondaryColor: 0x121620,
    accentColor: 0xf8fafc,
    frameColor: 0x9aa4b2,
    rimColor: 0x1d4ed8,
    forkColor: 0xd4a038,
    riderJacketColor: 0x111827,
    helmetColor: 0x1d4ed8,
    statSpeed: 54,
    statAccel: 58,
    statStability: 78,
    tagline: 'Iconic Racing Blue Deltabox supersport with M-duct projector eye — unlocked free.',
    unlock: { type: 'free', target: 0, label: 'Free Starter Bike' },
  },
  {
    id: 'bajaj_pulsar_n160',
    brand: 'Bajaj',
    name: 'Bajaj Pulsar N160',
    badgeText: 'PULSAR N160',
    subtitle: 'Brooklyn Black Streetfighter',
    modelProfile: 'pulsar_n160',
    frameStyle: 'perimeter',
    headlightStyle: 'wolf_eye',
    exhaustStyle: 'underbelly_stub',
    wingletStyle: 'none',
    engineAudioProfile: 'single_street',
    soundLabel: 'Deep Street Exhaust',
    engineCc: '164.8 cc Oil-Cooled',
    horsepower: '16.0 HP',
    weightKg: 154,
    topSpeedKmh: 188,
    accelerationRate: 33,
    decelerationRate: 24,
    vibrationHz: 50,
    vibrationAmp: 0.0036,
    suspensionStiffness: 0.88,
    wheelbaseScale: 0.97,
    primaryColor: 0x15171d,
    secondaryColor: 0x262933,
    accentColor: 0xdc2626,
    frameColor: 0x222630,
    rimColor: 0xdc2626,
    forkColor: 0x2c313b,
    riderJacketColor: 0x14161c,
    helmetColor: 0x181a20,
    referenceImageUrl: '/assets/aistudio/62810_2022_Bajaj_Pulsar_N160_5_468x263_f396cb5d.jpg',
    statSpeed: 58,
    statAccel: 62,
    statStability: 80,
    tagline: 'Muscular Brooklyn Black naked streetfighter with wolf-eye projector, underbelly exhaust & red rim tape.',
    unlock: { type: 'topSpeed', target: 130, label: 'Reach 130 KM/H' },
  },
  {
    id: 'harley_x440',
    brand: 'Harley-Davidson',
    name: 'Harley-Davidson X440',
    badgeText: 'HARLEY X440',
    subtitle: 'Modern Torque Roadster',
    modelProfile: 'harley_x440',
    frameStyle: 'roadster',
    headlightStyle: 'round_classic',
    exhaustStyle: 'roadster_horizontal',
    wingletStyle: 'none',
    engineAudioProfile: 'single_thumper',
    soundLabel: '440cc Bass Thumper',
    engineCc: '440 cc Air-Oil Cooled',
    horsepower: '27.0 HP',
    weightKg: 190,
    topSpeedKmh: 204,
    accelerationRate: 37,
    decelerationRate: 23,
    vibrationHz: 36,
    vibrationAmp: 0.0052,
    suspensionStiffness: 0.82,
    wheelbaseScale: 1.04,
    primaryColor: 0xea6a18,
    secondaryColor: 0x15161a,
    accentColor: 0xf8fafc,
    frameColor: 0x1c1e24,
    rimColor: 0xcbd5e1,
    forkColor: 0x2a2d34,
    riderJacketColor: 0x231914,
    helmetColor: 0x16171c,
    referenceImageUrl: '/assets/aistudio/IMG_d679c322-19a7-47cc-abd3-f896a2cbd687_9ee3142e.jpg',
    statSpeed: 64,
    statAccel: 68,
    statStability: 86,
    tagline: 'Vivid Orange teardrop tank, upright wide bars, round headlamp & throaty 440cc torque rumble.',
    unlock: { type: 'topSpeed', target: 150, label: 'Hit 150 KM/H (Red Road)' },
  },
  {
    id: 'ktm_rc390',
    brand: 'KTM',
    name: 'KTM RC 390',
    badgeText: 'RC 390',
    subtitle: 'Ready To Race Track Bike',
    modelProfile: 'ktm_rc390',
    frameStyle: 'trellis',
    headlightStyle: 'rc_angular',
    exhaustStyle: 'side_sport',
    wingletStyle: 'none',
    engineAudioProfile: 'single_sport',
    soundLabel: 'Punchy 373cc Single',
    engineCc: '373 cc Single-Cylinder',
    horsepower: '43.5 HP',
    weightKg: 155,
    topSpeedKmh: 226,
    accelerationRate: 42,
    decelerationRate: 22,
    vibrationHz: 58,
    vibrationAmp: 0.0044,
    suspensionStiffness: 0.98,
    wheelbaseScale: 0.97,
    primaryColor: 0xff6200,
    secondaryColor: 0x12141a,
    accentColor: 0xf8fafc,
    frameColor: 0xff6200,
    rimColor: 0xff6200,
    forkColor: 0x242833,
    riderJacketColor: 0x17181f,
    helmetColor: 0xff6200,
    statSpeed: 72,
    statAccel: 76,
    statStability: 84,
    tagline: 'Razor-sharp KTM Orange fairing with exposed orange steel trellis frame and ferocious mid-range punch.',
    unlock: { type: 'totalDistance', target: 1.5, label: 'Ride 1.5 KM Total' },
  },
  {
    id: 'suzuki_hayabusa',
    brand: 'Suzuki',
    name: 'Suzuki Hayabusa',
    badgeText: 'HAYABUSA',
    subtitle: 'Ultimate Aero Hypersport',
    modelProfile: 'hayabusa',
    frameStyle: 'perimeter',
    headlightStyle: 'hayabusa_aero',
    exhaustStyle: 'twin_chrome_mega',
    wingletStyle: 'none',
    engineAudioProfile: 'inline4_torque',
    soundLabel: '1340cc Inline-4 Roar',
    engineCc: '1340 cc Inline-4',
    horsepower: '190 HP',
    weightKg: 264,
    topSpeedKmh: 304,
    accelerationRate: 51,
    decelerationRate: 20,
    vibrationHz: 72,
    vibrationAmp: 0.0028,
    suspensionStiffness: 0.9,
    wheelbaseScale: 1.09,
    primaryColor: 0xd2d8e2,
    secondaryColor: 0x1d2330,
    accentColor: 0xd99b26,
    frameColor: 0x9ca5b4,
    rimColor: 0xd99b26,
    forkColor: 0xd4a038,
    riderJacketColor: 0x181c24,
    helmetColor: 0xd2d8e2,
    statSpeed: 91,
    statAccel: 88,
    statStability: 97,
    tagline: 'Wind-tunnel sculpted long-wheelbase legend with iconic bulbous fairing & twin chrome megaphones.',
    unlock: { type: 'topSpeed', target: 200, label: 'Hit 200 KM/H (Black Road)' },
  },
  {
    id: 'bmw_s1000rr',
    brand: 'BMW Motorrad',
    name: 'BMW S1000RR',
    badgeText: 'S1000RR',
    subtitle: 'M-Motorsport Superbike',
    modelProfile: 'bmw_s1000rr',
    frameStyle: 'perimeter',
    headlightStyle: 'bmw_split',
    exhaustStyle: 'titanium_side_high',
    wingletStyle: 'recessed',
    engineAudioProfile: 'inline4_screamer',
    soundLabel: 'ShiftCam 14k Inline-4',
    engineCc: '999 cc ShiftCam I4',
    horsepower: '210 HP',
    weightKg: 197,
    topSpeedKmh: 312,
    accelerationRate: 54,
    decelerationRate: 20,
    vibrationHz: 84,
    vibrationAmp: 0.0031,
    suspensionStiffness: 1.0,
    wheelbaseScale: 1.01,
    primaryColor: 0xf4f7fb,
    secondaryColor: 0x142b72,
    accentColor: 0xe11d48,
    frameColor: 0x9ea8b8,
    rimColor: 0xe11d48,
    forkColor: 0xd4a038,
    riderJacketColor: 0x101828,
    helmetColor: 0xf4f7fb,
    statSpeed: 93,
    statAccel: 92,
    statStability: 94,
    tagline: 'M-Sport tricolor bodywork, signature side shark-gill vents & screaming ShiftCam inline-4.',
    unlock: { type: 'totalDistance', target: 3.0, label: 'Ride 3.0 KM Total' },
  },
  {
    id: 'honda_cbr1000rrr',
    brand: 'Honda',
    name: 'Honda CBR1000RR-R Fireblade',
    badgeText: 'FIREBLADE',
    subtitle: 'HRC Factory Track Weapon',
    modelProfile: 'cbr1000rrr',
    frameStyle: 'perimeter',
    headlightStyle: 'fireblade_slit',
    exhaustStyle: 'titanium_side_high',
    wingletStyle: 'recessed',
    engineAudioProfile: 'inline4_screamer',
    soundLabel: 'HRC High-Rev Inline-4',
    engineCc: '1000 cc Inline-4',
    horsepower: '217 HP',
    weightKg: 201,
    topSpeedKmh: 318,
    accelerationRate: 56,
    decelerationRate: 19.5,
    vibrationHz: 88,
    vibrationAmp: 0.003,
    suspensionStiffness: 1.02,
    wheelbaseScale: 1.01,
    primaryColor: 0xd91c24,
    secondaryColor: 0x1438a6,
    accentColor: 0xf8fafc,
    frameColor: 0xaab4c2,
    rimColor: 0xd4a038,
    forkColor: 0xe2ae3b,
    riderJacketColor: 0x991b1b,
    helmetColor: 0xd91c24,
    statSpeed: 95,
    statAccel: 94,
    statStability: 95,
    tagline: 'Grand Prix Red HRC tricolor livery, MotoGP recessed winglets & high-revving titanium Akrapovic howl.',
    unlock: { type: 'totalDistance', target: 4.5, label: 'Ride 4.5 KM Total' },
  },
  {
    id: 'aprilia_rsv4',
    brand: 'Aprilia',
    name: 'Aprilia RSV4',
    badgeText: 'RSV4 FACTORY',
    subtitle: '65° V4 Italian Factory Racer',
    modelProfile: 'aprilia_rsv4',
    frameStyle: 'perimeter',
    headlightStyle: 'aprilia_triple',
    exhaustStyle: 'titanium_side_high',
    wingletStyle: 'recessed',
    engineAudioProfile: 'v4_bark',
    soundLabel: '65° V4 Thunder Bark',
    engineCc: '1099 cc 65° V4',
    horsepower: '217 HP',
    weightKg: 202,
    topSpeedKmh: 322,
    accelerationRate: 58,
    decelerationRate: 19.5,
    vibrationHz: 78,
    vibrationAmp: 0.0038,
    suspensionStiffness: 1.04,
    wheelbaseScale: 1.0,
    primaryColor: 0x161820,
    secondaryColor: 0xdc1e2d,
    accentColor: 0xef4444,
    frameColor: 0xb0b8c5,
    rimColor: 0xdc1e2d,
    forkColor: 0xd4a038,
    riderJacketColor: 0x12141a,
    helmetColor: 0xdc1e2d,
    statSpeed: 96,
    statAccel: 95,
    statStability: 95,
    tagline: 'Factory Matte Black & Racing Red aero shell with triple-LED light bar and unmistakable V4 growl.',
    unlock: { type: 'topSpeed', target: 250, label: 'Reach 250 KM/H' },
  },
  {
    id: 'ducati_panigale_v4',
    brand: 'Ducati',
    name: 'Ducati Panigale V4',
    badgeText: 'PANIGALE V4',
    subtitle: 'Desmosedici Stradale Icon',
    modelProfile: 'panigale_v4',
    frameStyle: 'perimeter',
    headlightStyle: 'panigale_brow',
    exhaustStyle: 'underbelly_twin',
    wingletStyle: 'biplane',
    engineAudioProfile: 'v4_bark',
    soundLabel: 'Desmosedici V4 Growl',
    engineCc: '1103 cc Desmosedici V4',
    horsepower: '215.5 HP',
    weightKg: 198,
    topSpeedKmh: 328,
    accelerationRate: 60,
    decelerationRate: 19,
    vibrationHz: 80,
    vibrationAmp: 0.004,
    suspensionStiffness: 1.06,
    wheelbaseScale: 1.01,
    primaryColor: 0xc8101c,
    secondaryColor: 0x121318,
    accentColor: 0xf8fafc,
    frameColor: 0x303540,
    rimColor: 0x1e222b,
    forkColor: 0xe6b43d,
    riderJacketColor: 0x991119,
    helmetColor: 0xc8101c,
    statSpeed: 97,
    statAccel: 97,
    statStability: 96,
    tagline: 'Sculpted Rosso Corsa Italian masterpiece with carbon biplane winglets & clean underbelly twin exhaust.',
    unlock: { type: 'totalDistance', target: 6.5, label: 'Ride 6.5 KM Total' },
  },
  {
    id: 'kawasaki_ninja_h2r',
    brand: 'Kawasaki',
    name: 'Kawasaki Ninja H2R',
    badgeText: 'NINJA H2R',
    subtitle: 'Supercharged Track Hyperbike',
    modelProfile: 'ninja_h2r',
    frameStyle: 'trellis',
    headlightStyle: 'h2r_ram_air',
    exhaustStyle: 'h2r_megapipe',
    wingletStyle: 'h2r_wings',
    engineAudioProfile: 'supercharged_h2r',
    soundLabel: 'Supercharged H2R Whine',
    engineCc: '998 cc Supercharged I4',
    horsepower: '310 HP',
    weightKg: 216,
    topSpeedKmh: 360,
    accelerationRate: 68,
    decelerationRate: 18.5,
    vibrationHz: 94,
    vibrationAmp: 0.0045,
    suspensionStiffness: 1.1,
    wheelbaseScale: 1.03,
    primaryColor: 0x1f242e,
    secondaryColor: 0x0d1016,
    accentColor: 0x39e519,
    frameColor: 0x39e519,
    rimColor: 0x39e519,
    forkColor: 0x20252f,
    riderJacketColor: 0x0e1117,
    helmetColor: 0x1c222b,
    referenceImageUrl: '/assets/aistudio/IMG_93f38edc-9e6a-46f8-be35-943148a204a8_d356d88c.jpg',
    statSpeed: 100,
    statAccel: 100,
    statStability: 99,
    tagline: 'Mirror dark-chrome carbon aero wings, lime-green steel trellis frame & supercharged 310 HP impeller shriek.',
    unlock: { type: 'topSpeed', target: 290, label: 'Reach 290 KM/H' },
  },
];

export interface AudioSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  oldManVoiceEnabled: boolean;
  vibrationEnabled: boolean;
  unlockAllBikes: boolean;
}

export interface HudTelemetry {
  speedKmh: number;
  rpmRatio: number; // 0 to 1
  gear: number; // 1 to 6
  distanceKm: number;
  timeRemaining: number;
  hasStartedMoving: boolean;
  nextCheckpointKm: number;
  checkpointNumber: number;
  bikesPassed: number;
  bridgesCrossed: number;
  dividerHits: number;
  roadZone: RoadZone;
  isAccelerating: boolean;
  topSpeedKmh: number;
  peakZone: RoadZone;
  bannerMessage: string | null;
  bannerAccent: 'red' | 'gold' | 'black' | 'green' | 'warning';
}

export interface RunResults {
  distanceKm: number;
  topSpeedKmh: number;
  bikesPassed: number;
  bridgesCrossed: number;
  dividerHits: number;
  peakZone: RoadZone;
  checkpointsCleared: number;
  isNewBestDistance: boolean;
  isNewBestSpeed: boolean;
  newlyUnlockedBikeNames: string[];
}

export interface SaveData {
  unlockedBikeIds: string[];
  equippedBikeId: string;
  bestDistanceKm: number;
  totalDistanceKm: number;
  bestSpeedKmh: number;
  totalRuns: number;
  settings: AudioSettings;
}

export function isBikeUnlocked(bikeId: string, save: SaveData): boolean {
  return save.settings.unlockAllBikes || save.unlockedBikeIds.includes(bikeId);
}

export function isMilestoneMet(bike: BikeSpec, save: SaveData): boolean {
  switch (bike.unlock.type) {
    case 'free':
      return true;
    case 'topSpeed':
      return save.bestSpeedKmh >= bike.unlock.target;
    case 'totalDistance':
      return save.totalDistanceKm >= bike.unlock.target;
    case 'runs':
      return save.totalRuns >= bike.unlock.target;
    default:
      return false;
  }
}

export function getMilestoneProgress(bike: BikeSpec, save: SaveData): {
  current: number;
  target: number;
  percent: number;
  text: string;
} {
  if (bike.unlock.type === 'free') {
    return { current: 1, target: 1, percent: 100, text: 'Unlocked Free' };
  }
  if (bike.unlock.type === 'topSpeed') {
    const current = Math.min(bike.unlock.target, Math.round(save.bestSpeedKmh));
    return {
      current,
      target: bike.unlock.target,
      percent: Math.min(100, Math.round((current / bike.unlock.target) * 100)),
      text: `${current} / ${bike.unlock.target} KM/H`,
    };
  }
  if (bike.unlock.type === 'totalDistance') {
    const current = Math.min(bike.unlock.target, Number(save.totalDistanceKm.toFixed(2)));
    return {
      current,
      target: bike.unlock.target,
      percent: Math.min(100, Math.round((current / bike.unlock.target) * 100)),
      text: `${current.toFixed(1)} / ${bike.unlock.target.toFixed(1)} KM`,
    };
  }
  const current = Math.min(bike.unlock.target, save.totalRuns);
  return {
    current,
    target: bike.unlock.target,
    percent: Math.min(100, Math.round((current / bike.unlock.target) * 100)),
    text: `${current} / ${bike.unlock.target} Runs`,
  };
}
