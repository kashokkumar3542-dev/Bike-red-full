import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildMotorcycle,
  BuiltMotorcycle,
  loadCustomGlbMotorcycle,
} from './bikeBuilder';
import { loadCustomGlb } from './glbStore';
import { SoundEngine } from './soundEngine';
import {
  BIKE_CATALOG,
  BikeSpec,
  GameScreen,
  HudTelemetry,
  RoadZone,
  RunResults,
} from './types';

// Reusable module-scope math objects (zero GC in render loop)
const _dummy = new THREE.Object3D();

// Road speed-zone colors (lane markings remain crisp white across all zones!)
const ROAD_NORMAL_COLOR = new THREE.Color(0x525864);
const ROAD_RED_COLOR = new THREE.Color(0xc81e1e);
const ROAD_BLACK_COLOR = new THREE.Color(0x111218);

const ROAD_NORMAL_EMISSIVE = new THREE.Color(0x000000);
const ROAD_RED_EMISSIVE = new THREE.Color(0x991b1b);
const ROAD_BLACK_EMISSIVE = new THREE.Color(0x050508);

// Daytime sky & fog colors (fresh natural blue sky — no sun orb!)
const SKY_DAY_TOP = new THREE.Color(0x58ace8);
const SKY_DAY_HORIZON = new THREE.Color(0xc7e6fa);
const FOG_DAY_COLOR = new THREE.Color(0xc2e2f7);

const ROAD_WIDTH = 14.4;
const ROAD_LENGTH = 400;
const BRIDGE_SPAN_LOOP = 280; // Highway crosses a scenic blue river bridge every 280m

// Collision bounds (Right carriageway between center divider at x=0 and right barrier at x=+7.2)
const CENTER_DIVIDER_HALF = 0.72; // Raised center divider half-width + bike half-width
const OUTER_BARRIER_LIMIT = 6.25; // Raised edge curb & concrete safety barrier limit
const DEFAULT_LANE_X = 2.95; // Center of player's right carriageway lane

interface RivalBikeEntity {
  bike: BuiltMotorcycle;
  laneX: number;
  z: number;
  cruiseKmh: number;
  passed: boolean;
}

interface EngineCallbacks {
  onHudUpdate: (hud: HudTelemetry) => void;
  onGameOver: (results: RunResults) => void;
  onOldManLaugh: (intensity: 'mild' | 'excited' | 'turbo') => void;
  onDividerHit: (newSpeedKmh: number) => void;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Generates realistic asphalt albedo texture with high-contrast white lane markings
 * plus a separate lane-mask emissive map so white lane lines stay clearly readable
 * even when the road shifts to RED (150+) or BLACK (200+).
 */
function createRoadTextures(maxAniso: number): {
  asphaltMap: THREE.CanvasTexture;
  laneEmissiveMap: THREE.CanvasTexture;
} {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const ctx = c.getContext('2d')!;

  // Fine-grain realistic asphalt base
  ctx.fillStyle = '#aeb4be';
  ctx.fillRect(0, 0, 512, 1024);

  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 1024;
    const shade = 148 + Math.floor(Math.random() * 44);
    ctx.fillStyle = `rgb(${shade},${shade},${shade + 3})`;
    ctx.fillRect(x, y, 2, 3);
  }

  // Subtle tire wear tracks along 4 lanes (2 left, 2 right)
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(58, 0, 56, 1024);
  ctx.fillRect(156, 0, 56, 1024);
  ctx.fillRect(300, 0, 56, 1024);
  ctx.fillRect(398, 0, 56, 1024);

  // Solid crisp white outer edge lines
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(26, 0, 10, 1024);
  ctx.fillRect(476, 0, 10, 1024);

  // Double center divider safety lines (flanking the raised concrete center divider)
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(236, 0, 6, 1024);
  ctx.fillRect(270, 0, 6, 1024);

  // Crisp white dashed lane dividers for both carriageways
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < 1024; y += 128) {
    ctx.fillRect(130, y + 18, 9, 66);
    ctx.fillRect(374, y + 18, 9, 66);
  }

  const asphaltMap = new THREE.CanvasTexture(c);
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.repeat.set(1, 20);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.anisotropy = maxAniso;

  // High-contrast lane marking mask so lane markings remain unmistakable on Black/Red road
  const lm = document.createElement('canvas');
  lm.width = 512;
  lm.height = 1024;
  const lctx = lm.getContext('2d')!;
  lctx.fillStyle = '#181818';
  lctx.fillRect(0, 0, 512, 1024);

  lctx.fillStyle = '#ffffff';
  lctx.fillRect(26, 0, 10, 1024);
  lctx.fillRect(476, 0, 10, 1024);
  lctx.fillRect(236, 0, 6, 1024);
  lctx.fillRect(270, 0, 6, 1024);
  for (let y = 0; y < 1024; y += 128) {
    lctx.fillRect(130, y + 18, 9, 66);
    lctx.fillRect(374, y + 18, 9, 66);
  }

  const laneEmissiveMap = new THREE.CanvasTexture(lm);
  laneEmissiveMap.wrapS = THREE.RepeatWrapping;
  laneEmissiveMap.wrapT = THREE.RepeatWrapping;
  laneEmissiveMap.repeat.set(1, 20);
  laneEmissiveMap.colorSpace = THREE.SRGBColorSpace;
  laneEmissiveMap.anisotropy = maxAniso;

  return { asphaltMap, laneEmissiveMap };
}

function createGrassTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#538d3e';
  ctx.fillRect(0, 0, 512, 512);

  // Soft natural meadow variation patches
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 10 + Math.random() * 34;
    const hue = 94 + Math.random() * 20;
    const light = 33 + Math.random() * 14;
    ctx.fillStyle = `hsla(${hue}, 44%, ${light}%, 0.32)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine grass blades & gentle wildflowers
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = i % 90 === 0 ? '#fef9c3' : i % 2 === 0 ? '#69a64c' : '#3f732e';
    ctx.fillRect(x, y, 2, 4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(26, 36);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createWaterTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#38a3d8');
  grad.addColorStop(0.15, '#1982c4');
  grad.addColorStop(0.5, '#1d94d6');
  grad.addColorStop(0.85, '#1982c4');
  grad.addColorStop(1, '#38a3d8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Flowing water ripples & bright sky reflection glints
  for (let i = 0; i < 280; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 18 + Math.random() * 52;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(224, 244, 255, 0.34)' : 'rgba(12, 74, 110, 0.22)';
    ctx.fillRect(x, y, w, 3);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createDaySkyDome(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Smooth natural daytime blue sky gradient — ZERO circular sun orb!
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#3b8ed6');
  grad.addColorStop(0.35, '#6bb8ee');
  grad.addColorStop(0.58, '#a6daf9');
  grad.addColorStop(0.75, '#d5eefc');
  grad.addColorStop(1.0, '#c8e6f8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 256);

  const skyTex = new THREE.CanvasTexture(canvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;

  const skyGeo = new THREE.SphereGeometry(280, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Mesh(skyGeo, skyMat);
}

export class HighwayGameEngine {
  private container: HTMLElement;
  private sound: SoundEngine;
  private callbacks: EngineCallbacks;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private fog: THREE.FogExp2;
  private envTex: THREE.Texture | null = null;

  // Lighting
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fillLight: THREE.DirectionalLight;

  // World objects
  private roadMesh!: THREE.Mesh;
  private roadMat!: THREE.MeshStandardMaterial;
  private asphaltMap!: THREE.CanvasTexture;
  private laneEmissiveMap!: THREE.CanvasTexture;
  private grassMap!: THREE.CanvasTexture;
  private waterMap!: THREE.CanvasTexture;
  private valleyRiverMat!: THREE.MeshPhysicalMaterial;
  private bridgeRiverMat!: THREE.MeshPhysicalMaterial;
  private dividerPostsGroup = new THREE.Group();
  private treesGroup = new THREE.Group();
  private bushesGroup = new THREE.Group();
  private cloudsGroup = new THREE.Group();
  private bridgeSectionGroup = new THREE.Group();
  private checkpointArch = new THREE.Group();
  private speedLines!: THREE.Points;
  private speedLinesMat!: THREE.PointsMaterial;
  private speedLinePositions!: Float32Array;
  private shopTurntable!: THREE.Mesh;

  // Motorcycles (STRICTLY TWO-WHEELED ONLY — ZERO 4-wheeled vehicles, ZERO coins!)
  private playerBike: BuiltMotorcycle | null = null;
  private currentSpec: BikeSpec = BIKE_CATALOG[0];
  private currentIncludeRider = true;
  private bikeLoadToken = 0;
  private showroomYaw = 0.55;
  private showroomSpinVel = 0;
  private showroomDragging = false;
  private rivalBikes: RivalBikeEntity[] = [];

  // Gameplay & Physics State
  private screen: GameScreen = 'menu';
  private isTouching = false;
  private steerInput = 0; // Subtle lateral lean from finger drag or A/D keys (-1 to +1)
  private bikeX = DEFAULT_LANE_X;
  private lateralVel = 0;
  private collisionCooldown = 0;
  private cameraShakeTime = 0;
  private cameraShakeStrength = 0;

  private speedKmh = 0; // ALWAYS starts at 0 KM/H!
  private hasStartedMoving = false;
  private rpmRatio = 0.12;
  private gear = 1;
  private distanceKm = 0;
  private timeRemaining = 45;
  private checkpointNumber = 1;
  private nextCheckpointKm = 1.0;
  private bikesPassed = 0;
  private bridgesCrossed = 0;
  private bridgeZ = -135;
  private bridgeCounted = false;
  private dividerHits = 0;
  private topSpeedKmh = 0;
  private peakZone: RoadZone = 'normal';
  private roadZone: RoadZone = 'normal';
  private roadScroll = 0;
  private waterScroll = 0;
  private elapsedTime = 0;
  private oldManLaughCooldown = 0;
  private bannerMessage: string | null = null;
  private bannerAccent: 'red' | 'gold' | 'black' | 'green' | 'warning' = 'gold';
  private bannerTimer = 0;
  private hudEmitAccum = 0;
  private wheeliePitch = 0;
  private suspensionBounce = 0;
  private vibrationEnabled = true;

  // Loop & lifecycle
  private frameId = 0;
  private lastTimestamp = 0;
  private disposed = false;
  private onResizeBound: () => void;
  private onContextLostBound: (e: Event) => void;

  constructor(container: HTMLElement, sound: SoundEngine, callbacks: EngineCallbacks) {
    this.container = container;
    this.sound = sound;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // Bright natural daytime sky & matching soft horizon fog
    this.scene = new THREE.Scene();
    this.scene.background = SKY_DAY_HORIZON.clone();
    this.fog = new THREE.FogExp2(FOG_DAY_COLOR.getHex(), 0.0044);
    this.scene.fog = this.fog;

    // Sky gradient dome (no sun orb!)
    this.scene.add(createDaySkyDome());

    // Studio environment reflection for metallic bike rims, clearcoat paint & reflective water
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    pmrem.dispose();

    // Third-person rear chase camera
    const aspect =
      (container.clientWidth || window.innerWidth) /
      Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.15, 340);
    this.camera.position.set(DEFAULT_LANE_X, 1.82, 3.85);
    this.camera.lookAt(DEFAULT_LANE_X, 1.05, -20);

    // Natural Daytime Lighting Rig (no artificial glare or circular sun!)
    this.hemiLight = new THREE.HemisphereLight(0xbbe2ff, 0x4b7d39, 1.15);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff9ed, 2.1);
    this.keyLight.position.set(28, 42, 20);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 95;
    this.keyLight.shadow.camera.left = -16;
    this.keyLight.shadow.camera.right = 16;
    this.keyLight.shadow.camera.top = 16;
    this.keyLight.shadow.camera.bottom = -16;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xaad6ff, 0.65);
    this.fillLight.position.set(-22, 18, -14);
    this.scene.add(this.fillLight);

    // Build Countryside World, Soft Clouds, Highway, Barriers, Dividers, River & Bridges
    this.buildClouds();
    this.buildCountrysideHighway();
    this.buildRiverBridgeSection();
    this.buildSpeedLines();
    this.buildCheckpointArch();
    this.buildRivalMotorcycles();
    this.setPlayerBike(BIKE_CATALOG[0], true);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.onResizeBound = this.handleResize.bind(this);
    this.onContextLostBound = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('resize', this.onResizeBound);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLostBound, false);

    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  public setVibrationEnabled(enabled: boolean): void {
    this.vibrationEnabled = enabled;
  }

  /**
   * Soft natural fluffy daytime clouds floating in the light-blue sky (NO sun orb!)
   */
  private buildClouds(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92,
    });
    const puffGeo = new THREE.SphereGeometry(1, 12, 10);

    const cloudConfigs = [
      { x: -58, y: 42, z: -115, s: 7.5 },
      { x: 46, y: 46, z: -145, s: 8.5 },
      { x: -16, y: 52, z: -185, s: 9.2 },
      { x: 75, y: 38, z: -95, s: 6.8 },
      { x: -82, y: 40, z: -165, s: 8.0 },
      { x: 18, y: 48, z: -220, s: 10.0 },
      { x: -45, y: 36, z: -65, s: 6.2 },
      { x: 64, y: 44, z: -195, s: 8.8 },
    ];

    for (const cfg of cloudConfigs) {
      const cluster = new THREE.Group();
      cluster.position.set(cfg.x, cfg.y, cfg.z);

      const offsets = [
        [0, 0, 0, 1.0],
        [-1.15, -0.18, 0.2, 0.78],
        [1.2, -0.15, -0.1, 0.82],
        [0.45, 0.35, 0.25, 0.72],
        [-0.55, 0.28, -0.25, 0.68],
      ];

      for (const [ox, oy, oz, os] of offsets) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(ox * cfg.s, oy * cfg.s * 0.55, oz * cfg.s * 0.5);
        puff.scale.set(cfg.s * os * 1.25, cfg.s * os * 0.55, cfg.s * os * 0.85);
        cluster.add(puff);
      }

      this.cloudsGroup.add(cluster);
    }

    this.scene.add(this.cloudsGroup);
  }

  private buildCountrysideHighway(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const { asphaltMap, laneEmissiveMap } = createRoadTextures(maxAniso);
    this.asphaltMap = asphaltMap;
    this.laneEmissiveMap = laneEmissiveMap;
    this.grassMap = createGrassTexture(maxAniso);
    this.waterMap = createWaterTexture(maxAniso);

    // 1. Wide Realistic Highway Asphalt Surface (y = 0)
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
    roadGeo.rotateX(-Math.PI / 2);
    this.roadMat = new THREE.MeshStandardMaterial({
      color: ROAD_NORMAL_COLOR.clone(),
      map: this.asphaltMap,
      emissive: ROAD_NORMAL_EMISSIVE.clone(),
      emissiveMap: this.laneEmissiveMap,
      emissiveIntensity: 0.25,
      roughness: 0.74,
      metalness: 0.1,
    });
    this.roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    this.roadMesh.position.set(0, 0, -ROAD_LENGTH * 0.42);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);

    // 2. Open Green Countryside Meadows flanking both sides of the highway
    //    (Left & right meadow bands start cleanly outside the road shoulders)
    const meadowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.grassMap,
      roughness: 0.92,
      metalness: 0.02,
    });
    const meadowGeo = new THREE.PlaneGeometry(165, ROAD_LENGTH + 90);
    meadowGeo.rotateX(-Math.PI / 2);

    const rightMeadow = new THREE.Mesh(meadowGeo, meadowMat);
    rightMeadow.position.set(ROAD_WIDTH * 0.5 + 82.5, -0.08, -ROAD_LENGTH * 0.4);
    rightMeadow.receiveShadow = true;
    this.scene.add(rightMeadow);

    // Left grassy embankment (narrow strip before scenic flowing blue valley river!)
    const leftBankGeo = new THREE.PlaneGeometry(16, ROAD_LENGTH + 90);
    leftBankGeo.rotateX(-Math.PI / 2);
    const leftBank = new THREE.Mesh(leftBankGeo, meadowMat);
    leftBank.position.set(-(ROAD_WIDTH * 0.5 + 8), -0.08, -ROAD_LENGTH * 0.4);
    leftBank.receiveShadow = true;
    this.scene.add(leftBank);

    // Far-left meadow beyond the flowing blue river
    const farLeftMeadow = new THREE.Mesh(meadowGeo, meadowMat);
    farLeftMeadow.position.set(-(ROAD_WIDTH * 0.5 + 48 + 82.5), -0.08, -ROAD_LENGTH * 0.4);
    this.scene.add(farLeftMeadow);

    // 3. Sparkling Blue Flowing Countryside River running alongside the highway valley!
    this.valleyRiverMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e88d6,
      map: this.waterMap,
      metalness: 0.24,
      roughness: 0.09,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    const valleyRiverGeo = new THREE.PlaneGeometry(34, ROAD_LENGTH + 90);
    valleyRiverGeo.rotateX(-Math.PI / 2);
    const valleyRiver = new THREE.Mesh(valleyRiverGeo, this.valleyRiverMat);
    valleyRiver.position.set(-(ROAD_WIDTH * 0.5 + 32), -0.32, -ROAD_LENGTH * 0.4);
    this.scene.add(valleyRiver);

    // Soft sandy/pebble riverbank edges flanking the valley river
    const bankEdgeMat = new THREE.MeshStandardMaterial({ color: 0xb9a882, roughness: 0.94 });
    const bankStripGeo = new THREE.PlaneGeometry(2.6, ROAD_LENGTH + 90);
    bankStripGeo.rotateX(-Math.PI / 2);
    [-(ROAD_WIDTH * 0.5 + 15.6), -(ROAD_WIDTH * 0.5 + 48.4)].forEach((bx) => {
      const edge = new THREE.Mesh(bankStripGeo, bankEdgeMat);
      edge.position.set(bx, -0.18, -ROAD_LENGTH * 0.4);
      this.scene.add(edge);
    });

    // 4. Concrete Safety Barriers on BOTH outer sides of the highway
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xd6dbe2,
      roughness: 0.82,
      metalness: 0.06,
    });
    const darkConcreteMat = new THREE.MeshStandardMaterial({
      color: 0x9aa3af,
      roughness: 0.88,
      metalness: 0.05,
    });
    const reflectorMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      roughness: 0.2,
    });

    // Jersey-profile concrete safety walls (outer left & outer right)
    const wallBaseGeo = new THREE.BoxGeometry(0.56, 0.34, ROAD_LENGTH);
    const wallTopGeo = new THREE.BoxGeometry(0.32, 0.68, ROAD_LENGTH);
    const edgeCurbGeo = new THREE.BoxGeometry(0.32, 0.18, ROAD_LENGTH);

    [-1, 1].forEach((side) => {
      const wallBase = new THREE.Mesh(wallBaseGeo, darkConcreteMat);
      wallBase.position.set(side * (ROAD_WIDTH * 0.5 + 0.22), 0.17, -ROAD_LENGTH * 0.42);
      this.scene.add(wallBase);

      const wallTop = new THREE.Mesh(wallTopGeo, concreteMat);
      wallTop.position.set(side * (ROAD_WIDTH * 0.5 + 0.26), 0.54, -ROAD_LENGTH * 0.42);
      wallTop.castShadow = true;
      wallTop.receiveShadow = true;
      this.scene.add(wallTop);

      // Small raised road-edge divider curb right inside the concrete barrier
      const edgeCurb = new THREE.Mesh(edgeCurbGeo, concreteMat);
      edgeCurb.position.set(side * (ROAD_WIDTH * 0.5 - 0.16), 0.09, -ROAD_LENGTH * 0.42);
      this.scene.add(edgeCurb);
    });

    // 5. Small Raised Center Median Divider running cleanly down the middle of the highway (x = 0)
    const centerCurbBaseGeo = new THREE.BoxGeometry(0.64, 0.16, ROAD_LENGTH);
    const centerCurbTopGeo = new THREE.BoxGeometry(0.42, 0.26, ROAD_LENGTH);
    const centerBase = new THREE.Mesh(centerCurbBaseGeo, darkConcreteMat);
    centerBase.position.set(0, 0.08, -ROAD_LENGTH * 0.42);
    this.scene.add(centerBase);

    const centerTop = new THREE.Mesh(centerCurbTopGeo, concreteMat);
    centerTop.position.set(0, 0.2, -ROAD_LENGTH * 0.42);
    centerTop.castShadow = true;
    centerTop.receiveShadow = true;
    this.scene.add(centerTop);

    // Repeating reflective delineator bollards along the center divider & outer barriers (scroll seamlessly)
    const bollardGeo = new THREE.BoxGeometry(0.11, 0.36, 0.08);
    const capGeo = new THREE.BoxGeometry(0.12, 0.1, 0.1);
    const postCount = 24;
    const postSpacing = 16;
    for (let i = 0; i < postCount; i++) {
      const z = 16 - i * postSpacing;

      // Center median marker
      const cPost = new THREE.Mesh(bollardGeo, concreteMat);
      cPost.position.set(0, 0.46, z);
      this.dividerPostsGroup.add(cPost);

      const cCap = new THREE.Mesh(capGeo, reflectorMat);
      cCap.position.set(0, 0.58, z);
      this.dividerPostsGroup.add(cCap);

      // Outer concrete wall reflectors
      [-1, 1].forEach((side) => {
        const wRef = new THREE.Mesh(capGeo, reflectorMat);
        wRef.position.set(side * (ROAD_WIDTH * 0.5 + 0.08), 0.72, z);
        this.dividerPostsGroup.add(wRef);
      });
    }
    this.scene.add(this.dividerPostsGroup);

    // 6. Gentle Rolling Green Countryside Hills on the Distant Horizon (NO houses or buildings!)
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x4c8a46,
      roughness: 0.94,
      metalness: 0.0,
    });
    const farHillMat = new THREE.MeshStandardMaterial({
      color: 0x629e68,
      roughness: 0.96,
      metalness: 0.0,
    });
    const hillGeo = new THREE.SphereGeometry(1, 16, 12);

    const hillSpecs = [
      { x: 95, z: -120, rx: 52, ry: 22, rz: 48, far: false },
      { x: -108, z: -135, rx: 58, ry: 26, rz: 54, far: false },
      { x: 125, z: -215, rx: 72, ry: 34, rz: 60, far: true },
      { x: -130, z: -225, rx: 75, ry: 32, rz: 64, far: true },
      { x: 10, z: -265, rx: 95, ry: 28, rz: 55, far: true },
      { x: 88, z: -45, rx: 40, ry: 16, rz: 42, far: false },
    ];
    for (const h of hillSpecs) {
      const m = new THREE.Mesh(hillGeo, h.far ? farHillMat : hillMat);
      m.position.set(h.x, -4, h.z);
      m.scale.set(h.rx, h.ry, h.rz);
      this.scene.add(m);
    }

    // 7. Moderately Spaced Open Countryside Green Trees (Composite 4-part InstancedMesh — NOT a dense jungle!)
    const treeCount = 44;
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 2.7, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4c33, roughness: 0.92 });
    const canopyMainGeo = new THREE.DodecahedronGeometry(2.15, 1);
    const canopyTopGeo = new THREE.DodecahedronGeometry(1.55, 1);
    const canopySideGeo = new THREE.DodecahedronGeometry(1.35, 1);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0.02 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const cMain = new THREE.InstancedMesh(canopyMainGeo, canopyMat, treeCount);
    const cTop = new THREE.InstancedMesh(canopyTopGeo, canopyMat, treeCount);
    const cSide = new THREE.InstancedMesh(canopySideGeo, canopyMat, treeCount);
    [trunks, cMain, cTop, cSide].forEach((im) => {
      im.frustumCulled = false;
      im.castShadow = !this.isSoftwareGl;
    });

    for (let i = 0; i < treeCount; i++) {
      // Place trees on right meadow and beyond the left river bank (never in the road or river!)
      const isRight = i % 3 !== 0;
      const x = isRight
        ? ROAD_WIDTH * 0.5 + 5.5 + ((i * 7.3) % 36)
        : i % 2 === 0
          ? -(ROAD_WIDTH * 0.5 + 6.5 + (i % 6) * 1.1) // grassy riverbank
          : -(ROAD_WIDTH * 0.5 + 54 + ((i * 6.1) % 30)); // far meadow across river
      const z = 18 - Math.floor(i / 2) * 18;
      const sc = 0.85 + ((i * 17) % 35) / 100;

      _dummy.position.set(x, 1.3 * sc, z);
      _dummy.scale.set(sc, sc, sc);
      _dummy.rotation.set(0, i * 0.9, 0);
      _dummy.updateMatrix();
      trunks.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(x, 3.85 * sc, z);
      _dummy.updateMatrix();
      cMain.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(x + 0.55 * sc, 5.1 * sc, z - 0.3 * sc);
      _dummy.updateMatrix();
      cTop.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(x - 1.15 * sc, 3.6 * sc, z + 0.45 * sc);
      _dummy.updateMatrix();
      cSide.setMatrixAt(i, _dummy.matrix);

      const leafTint = new THREE.Color().setHSL(0.28 + ((i % 5) - 2) * 0.018, 0.48, 0.32 + (i % 3) * 0.04);
      cMain.setColorAt(i, leafTint);
      cTop.setColorAt(i, leafTint.clone().offsetHSL(0.01, 0.03, 0.06));
      cSide.setColorAt(i, leafTint.clone().offsetHSL(-0.01, -0.02, -0.03));
    }
    [trunks, cMain, cTop, cSide].forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });
    this.treesGroup.add(trunks, cMain, cTop, cSide);
    this.scene.add(this.treesGroup);

    // 8. Roadside Green Bushes & Natural Grass Plants (moderately spaced along highway verges)
    const bushCount = 40;
    const bushGeo = new THREE.DodecahedronGeometry(0.95, 1);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
    bushes.frustumCulled = false;

    for (let i = 0; i < bushCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (ROAD_WIDTH * 0.5 + 2.4 + (i % 5) * 1.4);
      const z = 14 - Math.floor(i / 2) * 18;
      const sx = 0.85 + (i % 4) * 0.22;
      const sy = 0.55 + (i % 3) * 0.16;
      _dummy.position.set(x, sy * 0.55, z);
      _dummy.scale.set(sx, sy, sx);
      _dummy.rotation.set(0, i * 1.2, 0);
      _dummy.updateMatrix();
      bushes.setMatrixAt(i, _dummy.matrix);

      const bTint = new THREE.Color().setHSL(0.29 + (i % 4) * 0.015, 0.5, 0.34 + (i % 3) * 0.05);
      bushes.setColorAt(i, bTint);
    }
    bushes.instanceMatrix.needsUpdate = true;
    if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
    this.bushesGroup.add(bushes);
    this.scene.add(this.bushesGroup);

    // 9. Showroom Turntable Pad (only visible in Bike Shop & Selection modes)
    const padGeo = new THREE.CylinderGeometry(2.15, 2.3, 0.14, 36);
    const padMat = new THREE.MeshPhysicalMaterial({
      color: 0x161922,
      metalness: 0.72,
      roughness: 0.2,
      clearcoat: 0.9,
    });
    this.shopTurntable = new THREE.Mesh(padGeo, padMat);
    this.shopTurntable.position.set(0, 0.07, 0);
    this.shopTurntable.visible = false;

    const padRingGeo = new THREE.TorusGeometry(2.12, 0.045, 10, 48);
    padRingGeo.rotateX(Math.PI / 2);
    const padRingMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.5,
    });
    const padRing = new THREE.Mesh(padRingGeo, padRingMat);
    padRing.position.y = 0.07;
    this.shopTurntable.add(padRing);
    this.scene.add(this.shopTurntable);
  }

  /**
   * Builds a scenic white steel Tied-Arch Highway Bridge spanning a wide sparkling
   * Blue Flowing River that crosses directly beneath the highway!
   */
  private buildRiverBridgeSection(): void {
    const bridgeLen = 76;

    // Wide blue river crossing beneath the highway bridge (with bright water reflections)
    this.bridgeRiverMat = new THREE.MeshPhysicalMaterial({
      color: 0x1b89d8,
      map: this.waterMap,
      metalness: 0.28,
      roughness: 0.07,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });
    const crossRiverGeo = new THREE.PlaneGeometry(240, 58);
    crossRiverGeo.rotateX(-Math.PI / 2);
    const crossRiver = new THREE.Mesh(crossRiverGeo, this.bridgeRiverMat);
    crossRiver.position.set(0, -0.05, 0);
    this.bridgeSectionGroup.add(crossRiver);

    // Subtle elevated bridge road deck shoulders & concrete curbs
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65, metalness: 0.12 });
    const steelWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.48 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.72 });

    // Twin bridge side deck walkways & guard railings
    const deckSideGeo = new THREE.BoxGeometry(1.1, 0.55, bridgeLen);
    const railTopGeo = new THREE.BoxGeometry(0.16, 0.14, bridgeLen);

    [-1, 1].forEach((side) => {
      const sx = side * (ROAD_WIDTH * 0.5 + 0.72);
      const deck = new THREE.Mesh(deckSideGeo, deckMat);
      deck.position.set(sx, 0.25, 0);
      this.bridgeSectionGroup.add(deck);

      const rail = new THREE.Mesh(railTopGeo, steelWhiteMat);
      rail.position.set(side * (ROAD_WIDTH * 0.5 + 1.15), 1.25, 0);
      this.bridgeSectionGroup.add(rail);

      // Graceful Parabolic Tied-Arch Rib built from curved TubeGeometry
      const archPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const z = -bridgeLen * 0.45 + t * bridgeLen * 0.9;
        const y = 0.6 + Math.sin(t * Math.PI) * 9.8;
        archPoints.push(new THREE.Vector3(sx, y, z));
      }
      const archCurve = new THREE.CatmullRomCurve3(archPoints);
      const archGeo = new THREE.TubeGeometry(archCurve, 28, 0.36, 10, false);
      const archMesh = new THREE.Mesh(archGeo, steelWhiteMat);
      archMesh.castShadow = !this.isSoftwareGl;
      this.bridgeSectionGroup.add(archMesh);

      // Vertical steel suspender cables from arch rib down to bridge deck
      for (let i = 2; i <= 14; i += 2) {
        const pt = archPoints[i];
        const cableH = pt.y - 0.5;
        const cableGeo = new THREE.CylinderGeometry(0.045, 0.045, cableH, 6);
        const cable = new THREE.Mesh(cableGeo, cableMat);
        cable.position.set(sx, 0.5 + cableH * 0.5, pt.z);
        this.bridgeSectionGroup.add(cable);
      }

      // Bridge concrete abutment towers at entry & exit
      const towerGeo = new THREE.BoxGeometry(1.3, 2.2, 1.4);
      [-bridgeLen * 0.46, bridgeLen * 0.46].forEach((tz) => {
        const tower = new THREE.Mesh(towerGeo, deckMat);
        tower.position.set(sx, 1.1, tz);
        this.bridgeSectionGroup.add(tower);
      });
    });

    // Overhead cross-bracing struts linking left & right bridge arches
    const strutGeo = new THREE.BoxGeometry(ROAD_WIDTH + 1.5, 0.34, 0.42);
    [-14, 0, 14].forEach((sz) => {
      const t = (sz + bridgeLen * 0.45) / (bridgeLen * 0.9);
      const y = 0.6 + Math.sin(t * Math.PI) * 9.8;
      const strut = new THREE.Mesh(strutGeo, steelWhiteMat);
      strut.position.set(0, y, sz);
      this.bridgeSectionGroup.add(strut);
    });

    this.bridgeSectionGroup.position.set(0, 0, this.bridgeZ);
    this.scene.add(this.bridgeSectionGroup);
  }

  private buildSpeedLines(): void {
    const count = 130;
    this.speedLinePositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.resetSpeedParticle(i, true);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.speedLinePositions, 3));
    this.speedLinesMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.2,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.speedLines = new THREE.Points(geo, this.speedLinesMat);
    this.scene.add(this.speedLines);
  }

  private resetSpeedParticle(idx: number, randomZ: boolean): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = 2.8 + Math.random() * 6.5;
    this.speedLinePositions[idx * 3] = this.bikeX + Math.cos(angle) * radius;
    this.speedLinePositions[idx * 3 + 1] = Math.max(0.45, Math.sin(angle) * radius * 0.5 + 2.2);
    this.speedLinePositions[idx * 3 + 2] = randomZ ? -Math.random() * 90 : -85 - Math.random() * 20;
  }

  private buildCheckpointArch(): void {
    const pillarGeo = new THREE.BoxGeometry(0.55, 6.2, 0.55);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.72, roughness: 0.3 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.4,
    });

    [-1, 1].forEach((side) => {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(side * (ROAD_WIDTH * 0.5 + 0.65), 3.1, 0);
      this.checkpointArch.add(p);
    });

    const beamGeo = new THREE.BoxGeometry(ROAD_WIDTH + 1.9, 1.0, 0.65);
    const beam = new THREE.Mesh(beamGeo, pillarMat);
    beam.position.set(0, 6.0, 0);
    this.checkpointArch.add(beam);

    const stripGeo = new THREE.BoxGeometry(ROAD_WIDTH + 1.3, 0.22, 0.72);
    const strip = new THREE.Mesh(stripGeo, glowMat);
    strip.position.set(0, 5.56, 0);
    this.checkpointArch.add(strip);

    this.checkpointArch.position.set(0, 0, -240);
    this.checkpointArch.visible = false;
    this.scene.add(this.checkpointArch);
  }

  /**
   * Spawns strictly TWO-WHEELED rival motorcycles ONLY in adjacent highway lanes.
   * ZERO cars, trucks, buses, jeeps, or four-wheeled vehicles anywhere!
   */
  private buildRivalMotorcycles(): void {
    const rivalSpecs = [
      BIKE_CATALOG[1], // Bajaj Pulsar N160
      BIKE_CATALOG[3], // KTM RC 390
      BIKE_CATALOG[4], // Suzuki Hayabusa
      BIKE_CATALOG[5], // BMW S1000RR
      BIKE_CATALOG[7], // Aprilia RSV4
      BIKE_CATALOG[8], // Ducati Panigale V4
    ];
    // Left carriageway (-3.6, -5.2) & far right edge lane (+5.15)
    const lanes = [-3.6, 5.15, -5.1, -2.2, 5.15, -3.8];

    for (let i = 0; i < 6; i++) {
      const spec = rivalSpecs[i % rivalSpecs.length];
      const built = buildMotorcycle(spec, { includeRider: true, isRival: true });
      const laneX = lanes[i % lanes.length];
      const z = -48 - i * 54;
      built.group.position.set(laneX, 0, z);
      built.group.visible = false;
      this.scene.add(built.group);

      this.rivalBikes.push({
        bike: built,
        laneX,
        z,
        cruiseKmh: 76 + (i % 4) * 16,
        passed: false,
      });
    }
  }

  private mountPlayerBike(built: BuiltMotorcycle): void {
    if (this.playerBike) {
      this.scene.remove(this.playerBike.group);
      this.playerBike.dispose();
      this.playerBike = null;
    }
    this.playerBike = built;
    const inShowroom = this.screen === 'shop' || this.screen === 'select';
    this.playerBike.group.position.set(inShowroom ? 0 : this.bikeX, inShowroom ? 0.14 : 0, 0);
    if (inShowroom) {
      this.playerBike.group.rotation.y = this.showroomYaw;
    }
    this.scene.add(this.playerBike.group);
  }

  public setPlayerBike(spec: BikeSpec, includeRider: boolean): void {
    this.currentSpec = spec;
    this.currentIncludeRider = includeRider;
    this.sound.setEngineProfile(spec.engineAudioProfile);

    const token = ++this.bikeLoadToken;
    // Render the model-accurate built-in 3D bike immediately for zero latency
    this.mountPlayerBike(buildMotorcycle(spec, { includeRider }));

    // Asynchronously upgrade to user's custom imported .GLB if stored in IndexedDB
    void loadCustomGlb(spec.id).then(async (record) => {
      if (!record || this.disposed || token !== this.bikeLoadToken) return;
      try {
        const customBuilt = await loadCustomGlbMotorcycle(record.data.slice(0), spec);
        if (this.disposed || token !== this.bikeLoadToken) {
          customBuilt.dispose();
          return;
        }
        this.mountPlayerBike(customBuilt);
      } catch {
        // Keep built-in model cleanly if custom GLB fails to parse
      }
    });
  }

  public reloadCurrentBike(): void {
    this.setPlayerBike(this.currentSpec, this.currentIncludeRider);
  }

  public setShowroomDragging(dragging: boolean): void {
    this.showroomDragging = dragging;
  }

  public rotateShowroomBy(deltaRad: number): void {
    this.showroomYaw += deltaRad;
    this.showroomSpinVel = THREE.MathUtils.clamp(deltaRad * 18, -5.5, 5.5);
  }

  public setScreen(screen: GameScreen, equippedSpec: BikeSpec): void {
    const prevScreen = this.screen;
    this.screen = screen;

    if (screen === 'shop' || screen === 'select') {
      this.isTouching = false;
      this.steerInput = 0;
      this.sound.setEngineActive(false);
      this.shopTurntable.visible = true;
      this.checkpointArch.visible = false;
      this.rivalBikes.forEach((r) => (r.bike.group.visible = false));
      this.resetVisualRoadToNormal();
      this.setPlayerBike(equippedSpec, false);
    } else if (screen === 'menu' || screen === 'settings') {
      this.isTouching = false;
      this.steerInput = 0;
      this.sound.setEngineActive(false);
      this.shopTurntable.visible = false;
      this.checkpointArch.visible = false;
      this.rivalBikes.forEach((r) => (r.bike.group.visible = false));
      this.bikeX = DEFAULT_LANE_X;
      this.resetVisualRoadToNormal();
      this.setPlayerBike(equippedSpec, true);
    } else if (screen === 'playing') {
      this.shopTurntable.visible = false;
      if (prevScreen !== 'paused') {
        this.startFreshRun(equippedSpec);
      } else {
        this.sound.setEngineActive(true);
      }
    } else if (screen === 'paused') {
      this.isTouching = false;
      this.steerInput = 0;
      this.sound.setEngineActive(false);
    } else if (screen === 'gameover') {
      this.isTouching = false;
      this.steerInput = 0;
      this.sound.setEngineActive(false);
    }
  }

  public startFreshRun(spec: BikeSpec): void {
    this.screen = 'playing';
    this.shopTurntable.visible = false;
    this.bikeX = DEFAULT_LANE_X;
    this.lateralVel = 0;
    this.steerInput = 0;
    this.collisionCooldown = 0;
    this.cameraShakeTime = 0;
    this.cameraShakeStrength = 0;
    this.setPlayerBike(spec, true);

    // STRICT REQUIREMENT: Initial speed MUST be 0 KM/H & completely stationary until touch!
    this.speedKmh = 0;
    this.hasStartedMoving = false;
    this.rpmRatio = 0.12;
    this.gear = 1;
    this.distanceKm = 0;
    this.timeRemaining = 45;
    this.checkpointNumber = 1;
    this.nextCheckpointKm = 1.0;
    this.bikesPassed = 0;
    this.bridgesCrossed = 0;
    this.bridgeZ = -135;
    this.bridgeCounted = false;
    this.bridgeSectionGroup.position.z = this.bridgeZ;
    this.dividerHits = 0;
    this.topSpeedKmh = 0;
    this.peakZone = 'normal';
    this.roadZone = 'normal';
    this.wheeliePitch = 0;
    this.isTouching = false;
    this.oldManLaughCooldown = 0.45;
    this.bannerMessage = null;
    this.bannerTimer = 0;

    this.resetVisualRoadToNormal();
    this.checkpointArch.visible = false;

    // Position rival two-wheeled motorcycles ahead
    this.rivalBikes.forEach((r, i) => {
      r.z = -52 - i * 52;
      r.passed = false;
      r.bike.group.position.set(r.laneX, 0, r.z);
      r.bike.group.visible = true;
    });

    // Place third-person rear chase camera cleanly behind the stationary motorcycle
    this.camera.position.set(this.bikeX, 1.66, 3.35);
    this.camera.fov = 56;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.bikeX, 1.05, -20);

    this.sound.init();
    this.sound.setEngineActive(true);
    this.emitHud();
  }

  public setTouching(touching: boolean): void {
    if (this.screen !== 'playing') {
      this.isTouching = false;
      return;
    }
    if (touching) {
      this.hasStartedMoving = true;
      this.sound.init();
      this.sound.setEngineActive(true);
    }
    this.isTouching = touching;
  }

  /**
   * Optional subtle lateral lean from finger drag while holding or A/D keys (-1 left to +1 right).
   * Never requires any on-screen steering buttons!
   */
  public setSteerInput(value: number): void {
    this.steerInput = THREE.MathUtils.clamp(value, -1, 1);
  }

  private showBanner(
    msg: string,
    accent: 'red' | 'gold' | 'black' | 'green' | 'warning',
    duration = 1.9
  ): void {
    this.bannerMessage = msg;
    this.bannerAccent = accent;
    this.bannerTimer = duration;
  }

  private resetVisualRoadToNormal(): void {
    this.roadMat.color.copy(ROAD_NORMAL_COLOR);
    this.roadMat.emissive.copy(ROAD_NORMAL_EMISSIVE);
    this.roadMat.emissiveIntensity = 0.25;
    this.roadMat.roughness = 0.74;
    (this.scene.background as THREE.Color).copy(SKY_DAY_HORIZON);
    this.fog.color.copy(FOG_DAY_COLOR);
    this.speedLinesMat.opacity = 0;
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(() => this.tick(), 60);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(0.08, Math.max(0.001, rawDt));
    this.elapsedTime += dt;

    // Gentle daytime water flow & soft cloud drift across all screens
    this.waterScroll += dt * 0.22;
    this.waterMap.offset.y = -this.waterScroll;
    this.waterMap.offset.x = Math.sin(this.elapsedTime * 0.25) * 0.08;
    for (let i = 0; i < this.cloudsGroup.children.length; i++) {
      const cloud = this.cloudsGroup.children[i];
      cloud.position.x += dt * (0.35 + (i % 3) * 0.14);
      if (cloud.position.x > 110) cloud.position.x = -110;
    }

    if (this.screen === 'playing') {
      this.updateGameplay(dt);
    } else if (this.screen === 'menu' || this.screen === 'settings') {
      this.updateMenuShowcase(dt);
    } else if (this.screen === 'shop' || this.screen === 'select') {
      this.updateShopShowcase(dt);
    } else if (this.screen === 'gameover') {
      this.updateGameOverIdle(dt);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  private updateMenuShowcase(dt: number): void {
    // Daytime countryside rear-3/4 showcase around the equipped sports motorcycle
    const angle = 0.45 + Math.sin(this.elapsedTime * 0.35) * 0.55;
    const targetX = DEFAULT_LANE_X + Math.sin(angle) * 3.2;
    const targetZ = Math.cos(angle) * 3.35;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetX, 3.5, dt);
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      1.62 + Math.sin(this.elapsedTime * 0.6) * 0.1,
      3.5,
      dt
    );
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 3.5, dt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 54, 4, dt);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(DEFAULT_LANE_X, 0.82, -0.4);

    if (this.playerBike) {
      this.playerBike.group.rotation.set(0, 0, 0);
      this.playerBike.group.position.set(DEFAULT_LANE_X, 0, 0);
      this.playerBike.bodyGroup.rotation.set(0, 0, 0);
      this.playerBike.bodyGroup.position.y = 0;
    }
  }

  private updateShopShowcase(dt: number): void {
    if (!this.showroomDragging) {
      // Gently decay manual spin velocity back to smooth showroom auto-rotation
      this.showroomSpinVel = THREE.MathUtils.damp(this.showroomSpinVel, 0.48, 3.2, dt);
      this.showroomYaw += this.showroomSpinVel * dt;
    }

    if (this.playerBike) {
      this.playerBike.group.position.set(0, 0.14, 0);
      this.playerBike.group.rotation.set(0, this.showroomYaw, 0);
      this.playerBike.bodyGroup.rotation.set(0, 0, 0);
      this.playerBike.bodyGroup.position.y = 0;
    }
    this.shopTurntable.rotation.y = this.showroomYaw;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, 2.55, 5, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 1.48, 5, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 2.95, 5, dt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 46, 5, dt);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0.72, 0);
  }

  private updateGameOverIdle(dt: number): void {
    this.speedKmh = THREE.MathUtils.damp(this.speedKmh, 0, 2.4, dt);
    const metersPerSec = this.speedKmh / 3.6;
    this.scrollWorld(metersPerSec * dt);
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.bikeX + 2.2, 2.5, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 1.75, 2.5, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 3.9, 2.5, dt);
    this.camera.lookAt(this.bikeX, 0.85, 0);
  }

  /**
   * Triggers realistic divider/barrier collision:
   * - Reduces current speed by EXACTLY 50 KM/H (never negative)
   * - Bounces motorcycle cleanly back into lane so it cannot pass through dividers
   * - Plays collision crunch sound, device haptic vibration, and camera shake
   * - Cooldown prevents repeated continuous penalties on the same contact
   */
  private triggerDividerCollision(pushDirection: 1 | -1): void {
    if (this.collisionCooldown > 0) return;

    this.collisionCooldown = 1.15;
    this.speedKmh = Math.max(0, this.speedKmh - 50);
    this.dividerHits++;
    this.lateralVel = pushDirection * 5.2;
    this.cameraShakeTime = 0.42;
    this.cameraShakeStrength = 0.24;
    this.suspensionBounce = 0.08;

    this.sound.playCollision();

    if (this.vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(115);
      } catch {
        // Ignore on unsupported browsers
      }
    }

    this.showBanner(`DIVIDER COLLISION  -50 KM/H`, 'warning', 1.7);
    this.callbacks.onDividerHit(Math.round(this.speedKmh));
    this.emitHud();
  }

  private updateGameplay(dt: number): void {
    const spec = this.currentSpec;

    if (this.collisionCooldown > 0) {
      this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    }

    // 1. Touch-and-Hold Acceleration / Release Smooth Deceleration (0 KM/H start, never auto-accelerates!)
    if (this.isTouching) {
      const ratio = this.speedKmh / spec.topSpeedKmh;
      const pullFactor = Math.max(0.24, 1.18 - ratio * 0.7);
      this.speedKmh = Math.min(spec.topSpeedKmh, this.speedKmh + spec.accelerationRate * pullFactor * dt);
    } else if (this.speedKmh > 0) {
      const drag = spec.decelerationRate * (0.45 + (this.speedKmh / spec.topSpeedKmh) * 0.85);
      this.speedKmh = Math.max(0, this.speedKmh - drag * dt);
    }

    if (this.speedKmh > this.topSpeedKmh) {
      this.topSpeedKmh = this.speedKmh;
    }

    // 2. Lateral Physics & Strict Divider / Concrete Barrier Collision Detection
    const speedFactor = Math.min(1, this.speedKmh / 65);
    const targetLatVel = this.steerInput * 6.4 * speedFactor;
    this.lateralVel = THREE.MathUtils.damp(this.lateralVel, targetLatVel, 6.5, dt);
    this.bikeX += this.lateralVel * dt;

    // Check collision against the raised Center Median Divider (x = 0)
    if (this.bikeX < CENTER_DIVIDER_HALF) {
      this.bikeX = CENTER_DIVIDER_HALF + 0.04;
      if (this.speedKmh > 8) {
        this.triggerDividerCollision(1);
      } else {
        this.lateralVel = Math.max(0, this.lateralVel);
      }
    }

    // Check collision against the Right Edge Divider & Concrete Safety Barrier (x = +7.2)
    if (this.bikeX > OUTER_BARRIER_LIMIT) {
      this.bikeX = OUTER_BARRIER_LIMIT - 0.04;
      if (this.speedKmh > 8) {
        this.triggerDividerCollision(-1);
      } else {
        this.lateralVel = Math.min(0, this.lateralVel);
      }
    }

    // 3. Realistic 6-Speed Gear & RPM Computation
    const normalized = Math.min(1, this.speedKmh / spec.topSpeedKmh);
    const gearFloat = normalized * 5.85;
    this.gear = this.speedKmh < 2 ? 1 : Math.min(6, Math.max(1, Math.floor(gearFloat) + 1));
    const gearMin = (this.gear - 1) / 6;
    const gearSpan = 1 / 6;
    const inGearRatio = Math.max(0, Math.min(1, (normalized - gearMin) / gearSpan));
    const targetRpm =
      this.speedKmh < 1.5
        ? this.isTouching
          ? 0.28
          : 0.12
        : Math.min(1, 0.26 + inGearRatio * 0.68 + (this.isTouching ? 0.06 : -0.05));
    this.rpmRatio = THREE.MathUtils.damp(this.rpmRatio, Math.max(0.11, targetRpm), 10, dt);

    // 4. Road Color Speed Effects (<150 Normal Asphalt, >=150 RED, >=200 BLACK)
    const prevZone = this.roadZone;
    if (this.speedKmh >= 200) {
      this.roadZone = 'black';
      this.peakZone = 'black';
    } else if (this.speedKmh >= 150) {
      this.roadZone = 'red';
      if (this.peakZone === 'normal') this.peakZone = 'red';
    } else {
      this.roadZone = 'normal';
    }

    if (this.roadZone !== prevZone) {
      if (this.roadZone === 'red' && prevZone === 'normal') {
        this.showBanner('150 KM/H — RED ROAD ACTIVATED!', 'red', 1.9);
      } else if (this.roadZone === 'black') {
        this.showBanner('200 KM/H — BLACK ROAD OVERDRIVE!', 'black', 2.0);
      }
    }

    const targetRoadColor =
      this.roadZone === 'black'
        ? ROAD_BLACK_COLOR
        : this.roadZone === 'red'
          ? ROAD_RED_COLOR
          : ROAD_NORMAL_COLOR;
    const targetRoadEmissive =
      this.roadZone === 'black'
        ? ROAD_BLACK_EMISSIVE
        : this.roadZone === 'red'
          ? ROAD_RED_EMISSIVE
          : ROAD_NORMAL_EMISSIVE;
    const targetEmissiveInt = this.roadZone === 'red' ? 0.95 : this.roadZone === 'black' ? 0.85 : 0.24;
    const targetRoughness = this.roadZone === 'black' ? 0.26 : this.roadZone === 'red' ? 0.48 : 0.74;

    const blendAlpha = 1 - Math.exp(-4.5 * dt);
    this.roadMat.color.lerp(targetRoadColor, blendAlpha);
    this.roadMat.emissive.lerp(targetRoadEmissive, blendAlpha);
    this.roadMat.emissiveIntensity = THREE.MathUtils.lerp(
      this.roadMat.emissiveIntensity,
      targetEmissiveInt,
      blendAlpha
    );
    this.roadMat.roughness = THREE.MathUtils.lerp(this.roadMat.roughness, targetRoughness, blendAlpha);

    // 5. Advance Highway Movement, Bridge Crossings & Timer (Timer only counts once player pulls off!)
    const metersPerSec = this.speedKmh / 3.6;
    const dz = metersPerSec * dt;
    this.distanceKm += dz / 1000;
    this.scrollWorld(dz);

    if (this.hasStartedMoving) {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    }

    // Scenic Bridge over Blue Flowing River loop
    this.bridgeZ += dz;
    if (!this.bridgeCounted && this.bridgeZ > 4) {
      this.bridgeCounted = true;
      this.bridgesCrossed++;
      // Subtle realistic suspension thump crossing bridge expansion joint
      this.suspensionBounce = 0.032;
    }
    if (this.bridgeZ > 85) {
      this.bridgeZ -= BRIDGE_SPAN_LOOP;
      this.bridgeCounted = false;
    }
    this.bridgeSectionGroup.position.z = this.bridgeZ;

    // Checkpoint Archway (adds time extension so skilled riders keep exploring!)
    const distToCheckpointMeters = (this.nextCheckpointKm - this.distanceKm) * 1000;
    if (distToCheckpointMeters < 210) {
      this.checkpointArch.visible = true;
      this.checkpointArch.position.z = -Math.max(-20, distToCheckpointMeters * 0.85);
    } else {
      this.checkpointArch.visible = false;
    }

    if (this.distanceKm >= this.nextCheckpointKm) {
      const timeBonus = Math.max(10, 16 - Math.floor(this.checkpointNumber * 0.6));
      this.timeRemaining = Math.min(60, this.timeRemaining + timeBonus);
      this.showBanner(`CHECKPOINT ${this.checkpointNumber} · +${timeBonus}s`, 'green', 2.0);
      this.checkpointNumber++;
      this.nextCheckpointKm += 1.0 + this.checkpointNumber * 0.25;
      this.sound.playCheckpoint();
    }

    // 6. Animate Realistic Two-Wheeled Sports Motorcycle (Wheel Spin, Suspension, Engine Vibe, Lean)
    if (this.playerBike) {
      const wheelAngular = (metersPerSec / 0.35) * dt;
      this.playerBike.frontWheel.rotation.x -= wheelAngular;
      this.playerBike.rearWheel.rotation.x -= wheelAngular;
      const customFront = this.playerBike.frontWheel.userData.targetWheel as THREE.Object3D | undefined;
      const customRear = this.playerBike.rearWheel.userData.targetWheel as THREE.Object3D | undefined;
      if (customFront) customFront.rotation.x -= wheelAngular;
      if (customRear) customRear.rotation.x -= wheelAngular;

      // Wheelie pitch on acceleration pull + gentle brake dive on deceleration
      const wheelieScale = 1 / spec.suspensionStiffness;
      const targetWheelie =
        this.isTouching && this.speedKmh > 6
          ? Math.min(0.11, (0.032 + (1 - normalized) * 0.058) * wheelieScale)
          : this.speedKmh > 12
            ? -0.022 * wheelieScale
            : 0;
      this.wheeliePitch = THREE.MathUtils.damp(this.wheeliePitch, targetWheelie, 7, dt);
      this.playerBike.bodyGroup.rotation.x = this.wheeliePitch;

      // Lean angle matches lateral movement naturally
      const targetLean = -THREE.MathUtils.clamp(this.lateralVel * 0.055, -0.34, 0.34);
      this.playerBike.group.rotation.z = THREE.MathUtils.damp(
        this.playerBike.group.rotation.z,
        targetLean,
        8,
        dt
      );
      this.playerBike.group.position.x = this.bikeX;

      // Per-bike realistic suspension travel + engine vibration frequency/amplitude while accelerating
      this.suspensionBounce = THREE.MathUtils.damp(
        this.suspensionBounce,
        0,
        7.5 * spec.suspensionStiffness,
        dt
      );
      const roadSuspension =
        this.speedKmh > 2
          ? Math.sin(this.elapsedTime * (12 + normalized * 16)) *
            (0.009 / spec.suspensionStiffness) *
            normalized
          : 0;
      const engineVibe = this.isTouching
        ? Math.sin(this.elapsedTime * spec.vibrationHz) *
          (spec.vibrationAmp + normalized * spec.vibrationAmp * 1.15)
        : Math.sin(this.elapsedTime * (spec.vibrationHz * 0.42)) * (spec.vibrationAmp * 0.38);
      this.playerBike.bodyGroup.position.y = roadSuspension + engineVibe + this.suspensionBounce;

      // Rider tucks smoothly into aerodynamic crouch above 70 KM/H
      if (this.playerBike.riderGroup) {
        const targetTuck = THREE.MathUtils.clamp((this.speedKmh - 65) / 145, 0, 1) * 0.25;
        this.playerBike.riderGroup.rotation.x = THREE.MathUtils.damp(
          this.playerBike.riderGroup.rotation.x,
          targetTuck,
          6,
          dt
        );
      }

      // Taillight brightens on deceleration/coasting
      this.playerBike.taillightMat.emissiveIntensity = this.isTouching ? 1.8 : 3.8;

      // Exhaust flames during hard high-speed pulls (>135 KM/H)
      const flameIntensity =
        this.isTouching && this.speedKmh > 135 ? Math.min(1, (this.speedKmh - 135) / 85) : 0;
      for (const fm of this.playerBike.flameMeshes) {
        const mat = fm.material as THREE.MeshBasicMaterial;
        mat.opacity = flameIntensity * (0.6 + Math.random() * 0.35);
        const s = 0.6 + flameIntensity * (0.85 + Math.random() * 0.5);
        fm.scale.set(1, 1, s);
        mat.color.setHex(this.roadZone === 'black' ? 0x38bdf8 : 0xff5a1f);
      }
    }

    // 7. Update Strictly Two-Wheeled Rival Motorcycles in Adjacent Lanes
    for (const rival of this.rivalBikes) {
      const relMps = (this.speedKmh - rival.cruiseKmh) / 3.6;
      rival.z += relMps * dt;
      rival.bike.group.position.z = rival.z;

      const rivalWheelSpin = (rival.cruiseKmh / 3.6 / 0.36) * dt;
      rival.bike.frontWheel.rotation.x -= rivalWheelSpin;
      rival.bike.rearWheel.rotation.x -= rivalWheelSpin;

      if (!rival.passed && rival.z > 1.2 && this.speedKmh > rival.cruiseKmh + 12) {
        rival.passed = true;
        this.bikesPassed++;
        this.sound.playPassWhoosh();
      }

      if (rival.z > 24) {
        rival.z = -195 - Math.random() * 120;
        rival.passed = false;
        rival.cruiseKmh = 74 + Math.random() * 62;
      } else if (rival.z < -340) {
        rival.z = -85 - Math.random() * 60;
        rival.passed = false;
      }
    }

    // 8. High-Speed Subtle Speed-Streak Blur Lines (above 135 KM/H)
    const speedLineStrength = THREE.MathUtils.clamp((this.speedKmh - 130) / 100, 0, 1);
    this.speedLinesMat.opacity = speedLineStrength * 0.62;
    this.speedLinesMat.color.setHex(
      this.roadZone === 'black' ? 0xfef08a : this.roadZone === 'red' ? 0xfecaca : 0xffffff
    );
    if (speedLineStrength > 0.02) {
      const pSpeed = (48 + this.speedKmh * 0.68) * dt;
      for (let i = 0; i < this.speedLinePositions.length / 3; i++) {
        this.speedLinePositions[i * 3 + 2] += pSpeed;
        if (this.speedLinePositions[i * 3 + 2] > 6) {
          this.resetSpeedParticle(i, false);
        }
      }
      this.speedLines.geometry.attributes.position.needsUpdate = true;
    }

    // 9. Smooth Third-Person Rear Chase Camera (realistic motorcycle framed heroically at bottom-center!)
    const targetFov = 56 + normalized * 22 + (this.roadZone === 'black' ? 3 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5.5, dt);
    this.camera.updateProjectionMatrix();

    // Combine subtle high-speed vibration + damped collision camera shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShakeTime > 0) {
      this.cameraShakeTime = Math.max(0, this.cameraShakeTime - dt);
      const decay = this.cameraShakeTime / 0.42;
      const amp = this.cameraShakeStrength * decay;
      shakeX += (Math.random() - 0.5) * 2 * amp;
      shakeY += (Math.random() - 0.5) * 2 * amp;
    }
    if (this.speedKmh > 160) {
      const hiAmp = ((this.speedKmh - 160) / 180) * 0.028;
      shakeX += (Math.random() - 0.5) * hiAmp;
      shakeY += (Math.random() - 0.5) * hiAmp;
    }

    const targetCamX = this.bikeX + shakeX;
    const targetCamY = 1.66 - normalized * 0.14 + shakeY;
    const targetCamZ = 3.32 + (this.isTouching && this.speedKmh > 5 ? 0.28 : 0) + normalized * 0.24;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 8, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 8, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 6.5, dt);
    // Look forward slightly above horizon so realistic bike sits prominently at bottom-center with full road/river/bridge view
    this.camera.lookAt(this.bikeX * 0.88, 1.06, -21);

    // 10. Sound Engine & Synchronized Funny Old Man "HA HA!" Voice + Animation
    this.sound.updateEngine(this.speedKmh, this.rpmRatio, this.gear, this.isTouching, this.roadZone);

    this.oldManLaughCooldown -= dt;
    if (this.isTouching && this.speedKmh >= 18 && this.oldManLaughCooldown <= 0) {
      const intensity: 'mild' | 'excited' | 'turbo' =
        this.speedKmh >= 200 ? 'turbo' : this.speedKmh >= 150 ? 'excited' : 'mild';
      this.sound.playOldManLaugh(intensity);
      this.callbacks.onOldManLaugh(intensity);
      this.oldManLaughCooldown =
        intensity === 'turbo' ? 1.15 : intensity === 'excited' ? 1.45 : 1.85;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerMessage = null;
      }
    }

    if (this.hasStartedMoving && this.timeRemaining <= 0) {
      this.finishRun();
      return;
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.033) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private scrollWorld(dz: number): void {
    if (dz <= 0) return;
    this.roadScroll += dz / 16.0;
    this.asphaltMap.offset.y = this.roadScroll;
    this.laneEmissiveMap.offset.y = this.roadScroll;
    this.grassMap.offset.y = this.roadScroll * 0.72;

    // Scroll divider bollards & reflectors
    const postSpan = 24 * 16;
    for (const child of this.dividerPostsGroup.children) {
      child.position.z += dz;
      if (child.position.z > 20) {
        child.position.z -= postSpan;
      }
    }

    // Scroll moderately spaced countryside trees & roadside bushes
    this.treesGroup.position.z += dz;
    if (this.treesGroup.position.z >= 18) {
      this.treesGroup.position.z -= 18;
    }

    this.bushesGroup.position.z += dz;
    if (this.bushesGroup.position.z >= 18) {
      this.bushesGroup.position.z -= 18;
    }
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate({
      speedKmh: Math.round(this.speedKmh),
      rpmRatio: this.rpmRatio,
      gear: this.gear,
      distanceKm: this.distanceKm,
      timeRemaining: this.timeRemaining,
      hasStartedMoving: this.hasStartedMoving,
      nextCheckpointKm: this.nextCheckpointKm,
      checkpointNumber: this.checkpointNumber,
      bikesPassed: this.bikesPassed,
      bridgesCrossed: this.bridgesCrossed,
      dividerHits: this.dividerHits,
      roadZone: this.roadZone,
      isAccelerating: this.isTouching,
      topSpeedKmh: Math.round(this.topSpeedKmh),
      peakZone: this.peakZone,
      bannerMessage: this.bannerMessage,
      bannerAccent: this.bannerAccent,
    });
  }

  public finishRun(): void {
    if (this.screen === 'gameover') return;
    this.screen = 'gameover';
    this.isTouching = false;
    this.steerInput = 0;
    this.sound.setEngineActive(false);
    this.sound.playGameOver();
    this.emitHud();

    this.callbacks.onGameOver({
      distanceKm: Number(this.distanceKm.toFixed(2)),
      topSpeedKmh: Math.round(this.topSpeedKmh),
      bikesPassed: this.bikesPassed,
      bridgesCrossed: this.bridgesCrossed,
      dividerHits: this.dividerHits,
      peakZone: this.peakZone,
      checkpointsCleared: Math.max(0, this.checkpointNumber - 1),
      isNewBestDistance: false,
      isNewBestSpeed: false,
      newlyUnlockedBikeNames: [],
    });
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResizeBound);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLostBound);

    this.playerBike?.dispose();
    this.rivalBikes.forEach((r) => r.bike.dispose());
    this.asphaltMap.dispose();
    this.laneEmissiveMap.dispose();
    this.grassMap.dispose();
    this.waterMap.dispose();
    this.envTex?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
