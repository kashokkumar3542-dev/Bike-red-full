import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BikeSpec } from './types';

export interface BuiltMotorcycle {
  group: THREE.Group;
  bodyGroup: THREE.Group; // Pitches on wheelie/braking & vertical suspension travel
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  riderGroup: THREE.Group | null;
  flameMeshes: THREE.Mesh[];
  taillightMat: THREE.MeshStandardMaterial;
  isCustomGlb?: boolean;
  dispose: () => void;
}

// Shared procedural high-resolution PBR textures (zero external 404s, cached once)
let sharedContactShadowTex: THREE.CanvasTexture | null = null;
let sharedTireTreadTex: THREE.CanvasTexture | null = null;
let sharedTireBumpTex: THREE.CanvasTexture | null = null;
let sharedCarbonTex: THREE.CanvasTexture | null = null;
let sharedTitaniumTex: THREE.CanvasTexture | null = null;
let sharedRotorTex: THREE.CanvasTexture | null = null;
let sharedDashTex: THREE.CanvasTexture | null = null;
let sharedPlateTex: THREE.CanvasTexture | null = null;
const liveryTexCache = new Map<string, THREE.CanvasTexture>();

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function getContactShadowTexture(): THREE.CanvasTexture {
  if (sharedContactShadowTex) return sharedContactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 256, 20, 128, 256, 118);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.36)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.scale(1, 2);
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedContactShadowTex = tex;
  return tex;
}

function getTireTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  if (sharedTireTreadTex && sharedTireBumpTex) {
    return { map: sharedTireTreadTex, bump: sharedTireBumpTex };
  }

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, '#141519');
  grad.addColorStop(0.22, '#1d1f24');
  grad.addColorStop(0.5, '#25272d');
  grad.addColorStop(0.78, '#1d1f24');
  grad.addColorStop(1.0, '#141519');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  for (let y = -20; y < 540; y += 36) {
    ctx.beginPath();
    ctx.moveTo(118, y);
    ctx.quadraticCurveTo(86, y + 10, 58, y + 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(138, y + 18);
    ctx.quadraticCurveTo(170, y + 28, 198, y + 44);
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 5);
  map.colorSpace = THREE.SRGBColorSpace;

  const b = document.createElement('canvas');
  b.width = 256;
  b.height = 512;
  const bctx = b.getContext('2d')!;
  bctx.fillStyle = '#c8c8c8';
  bctx.fillRect(0, 0, 256, 512);
  bctx.strokeStyle = '#181818';
  bctx.lineWidth = 5;
  bctx.lineCap = 'round';
  for (let y = -20; y < 540; y += 36) {
    bctx.beginPath();
    bctx.moveTo(118, y);
    bctx.quadraticCurveTo(86, y + 10, 58, y + 26);
    bctx.stroke();
    bctx.beginPath();
    bctx.moveTo(138, y + 18);
    bctx.quadraticCurveTo(170, y + 28, 198, y + 44);
    bctx.stroke();
  }

  const bump = new THREE.CanvasTexture(b);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(1, 5);

  sharedTireTreadTex = map;
  sharedTireBumpTex = bump;
  return { map, bump };
}

function getCarbonFiberTexture(): THREE.CanvasTexture {
  if (sharedCarbonTex) return sharedCarbonTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#14161c';
  ctx.fillRect(0, 0, 64, 64);

  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const diag = ((x + y) / 8) % 2 === 0;
      ctx.fillStyle = diag ? '#252932' : '#0f1116';
      ctx.fillRect(x, y, 6, 4);
      ctx.fillStyle = diag ? '#1a1d24' : '#2c313c';
      ctx.fillRect(x + 2, y + 4, 6, 4);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedCarbonTex = tex;
  return tex;
}

function getTitaniumExhaustTexture(): THREE.CanvasTexture {
  if (sharedTitaniumTex) return sharedTitaniumTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#c8d0d8');
  grad.addColorStop(0.55, '#b6bec8');
  grad.addColorStop(0.74, '#c7a46b');
  grad.addColorStop(0.86, '#6d5e9c');
  grad.addColorStop(0.95, '#3b6ea8');
  grad.addColorStop(1.0, '#2a3342');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < 256; y += 2) {
    ctx.fillRect(0, y, 128, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedTitaniumTex = tex;
  return tex;
}

function getBrakeRotorTexture(): THREE.CanvasTexture {
  if (sharedRotorTex) return sharedRotorTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.arc(128, 128, 66, 0, Math.PI * 2, true);
  ctx.fillStyle = '#c4ccd6';
  ctx.fill();

  ctx.strokeStyle = 'rgba(60, 70, 85, 0.32)';
  ctx.lineWidth = 2;
  for (let r = 74; r <= 114; r += 8) {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#181b22';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    for (let j = 0; j < 3; j++) {
      const rr = 80 + j * 14;
      const aa = a + j * 0.09;
      ctx.beginPath();
      ctx.arc(128 + Math.cos(aa) * rr, 128 + Math.sin(aa) * rr, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.beginPath();
  ctx.arc(128, 128, 66, 0, Math.PI * 2);
  ctx.arc(128, 128, 34, 0, Math.PI * 2, true);
  ctx.fillStyle = '#262b36';
  ctx.fill();

  ctx.fillStyle = '#eab308';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * 65, 128 + Math.sin(a) * 65, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedRotorTex = tex;
  return tex;
}

function getTftDashTexture(): THREE.CanvasTexture {
  if (sharedDashTex) return sharedDashTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#090c14';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 120);

  const grad = ctx.createLinearGradient(20, 0, 236, 0);
  grad.addColorStop(0, '#22c55e');
  grad.addColorStop(0.65, '#f59e0b');
  grad.addColorStop(1, '#ef4444');
  ctx.fillStyle = grad;
  ctx.fillRect(20, 20, 195, 18);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('299', 24, 96);
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('G6', 175, 94);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedDashTex = tex;
  return tex;
}

function getLicensePlateTexture(): THREE.CanvasTexture {
  if (sharedPlateTex) return sharedPlateTex;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 160, 80);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, 154, 74);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(6, 6, 148, 15);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RP 300', 80, 52);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedPlateTex = tex;
  return tex;
}

/**
 * Generates authentic per-model racing livery decal plaques (e.g. R15 V4, NINJA H2R, S1000RR M-stripes,
 * FIREBLADE HRC tricolor, PANIGALE V4, HARLEY X440, PULSAR N160).
 */
function getLiveryBadgeTexture(spec: BikeSpec): THREE.CanvasTexture {
  const cached = liveryTexCache.get(spec.id);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 160);

  // Diagonal factory racing slash stripes
  const p = hexToCss(spec.primaryColor);
  const s = hexToCss(spec.secondaryColor);
  const a = hexToCss(spec.accentColor);

  ctx.fillStyle = spec.modelProfile === 'harley_x440' ? '#17191f' : 'rgba(12,15,22,0.88)';
  ctx.beginPath();
  ctx.moveTo(26, 20);
  ctx.lineTo(486, 20);
  ctx.lineTo(460, 140);
  ctx.lineTo(0, 140);
  ctx.closePath();
  ctx.fill();

  // Model-specific stripe palette
  if (spec.modelProfile === 'bmw_s1000rr') {
    // BMW M Motorsport Light Blue / Dark Blue / Red diagonal stripes
    const stripes = ['#38bdf8', '#1d4ed8', '#e11d48'];
    stripes.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(34 + i * 24, 20);
      ctx.lineTo(52 + i * 24, 20);
      ctx.lineTo(26 + i * 24, 140);
      ctx.lineTo(8 + i * 24, 140);
      ctx.closePath();
      ctx.fill();
    });
  } else if (spec.modelProfile === 'cbr1000rrr') {
    // HRC Red / White / Blue racing bands
    const stripes = ['#dc2626', '#ffffff', '#1d4ed8'];
    stripes.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(0, 114 + i * 9, 470, 8);
    });
  } else {
    ctx.fillStyle = a;
    ctx.fillRect(14, 122, 444, 10);
    ctx.fillStyle = spec.modelProfile === 'harley_x440' ? p : s;
    ctx.fillRect(24, 26, 448, 8);
  }

  // Crisp model typography
  ctx.fillStyle = spec.modelProfile === 'ninja_h2r' ? '#39e519' : '#f8fafc';
  ctx.font = 'italic 900 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.badgeText, 258, 76);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  liveryTexCache.set(spec.id, tex);
  return tex;
}

/**
 * Builds a realistic curved-shoulder sport motorcycle tire using LatheGeometry.
 */
function createRealisticTireGeometry(
  outerRadius: number,
  halfWidth: number,
  rimRadius: number
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = -Math.PI * 0.5 + t * Math.PI;
    const y = Math.sin(angle) * halfWidth;
    const profileCurve = Math.pow(Math.cos(angle), 0.72);
    const r = rimRadius + (outerRadius - rimRadius) * profileCurve;
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, 36);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createRealisticWheel(
  outerRadius: number,
  halfWidth: number,
  rimColor: number,
  fullColoredRim: boolean,
  dualRotor: boolean,
  rubberMat: THREE.Material,
  darkAlloyMat: THREE.Material,
  rotorMat: THREE.Material,
  caliperMat: THREE.Material,
  chromeMat: THREE.Material,
  disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] }
): THREE.Group {
  const wheelGroup = new THREE.Group();
  const rimRadius = outerRadius * 0.68;

  const tireGeo = createRealisticTireGeometry(outerRadius, halfWidth, rimRadius);
  disposables.geometries.push(tireGeo);
  const tireMesh = new THREE.Mesh(tireGeo, rubberMat);
  tireMesh.castShadow = true;
  wheelGroup.add(tireMesh);

  const paintedRimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    metalness: 0.72,
    roughness: 0.24,
  });
  disposables.materials.push(paintedRimMat);
  const spokeMaterial = fullColoredRim ? paintedRimMat : darkAlloyMat;

  const barrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, halfWidth * 1.55, 32, 1, true);
  barrelGeo.rotateZ(Math.PI / 2);
  disposables.geometries.push(barrelGeo);
  wheelGroup.add(new THREE.Mesh(barrelGeo, spokeMaterial));

  // Signature colored rim tape / pinstripe ring
  const lipGeo = new THREE.TorusGeometry(rimRadius + 0.005, 0.013, 8, 32);
  lipGeo.rotateY(Math.PI / 2);
  disposables.geometries.push(lipGeo);
  [-halfWidth * 0.76, halfWidth * 0.76].forEach((lx) => {
    const lip = new THREE.Mesh(lipGeo, paintedRimMat);
    lip.position.x = lx;
    wheelGroup.add(lip);
  });

  const hubGeo = new THREE.CylinderGeometry(0.068, 0.068, halfWidth * 1.9, 18);
  hubGeo.rotateZ(Math.PI / 2);
  disposables.geometries.push(hubGeo);
  wheelGroup.add(new THREE.Mesh(hubGeo, spokeMaterial));

  const axleGeo = new THREE.CylinderGeometry(0.026, 0.026, halfWidth * 2.15, 12);
  axleGeo.rotateZ(Math.PI / 2);
  disposables.geometries.push(axleGeo);
  wheelGroup.add(new THREE.Mesh(axleGeo, chromeMat));

  // 5 Split Y-Spokes (10 forged spokes)
  const spokeGeo = new THREE.BoxGeometry(0.022, rimRadius * 0.9, 0.025);
  disposables.geometries.push(spokeGeo);
  for (let i = 0; i < 5; i++) {
    const baseAngle = (i / 5) * Math.PI * 2;
    [-0.14, 0.14].forEach((offset) => {
      const a = baseAngle + offset;
      const spoke = new THREE.Mesh(spokeGeo, spokeMaterial);
      const midR = rimRadius * 0.48;
      spoke.position.set(0, Math.cos(a) * midR, Math.sin(a) * midR);
      spoke.rotation.x = a;
      wheelGroup.add(spoke);
    });
  }

  // Drilled ventilated brake discs + radial calipers
  const rotorRadius = rimRadius * 0.85;
  const rotorGeo = new THREE.CircleGeometry(rotorRadius, 28);
  rotorGeo.rotateY(Math.PI / 2);
  disposables.geometries.push(rotorGeo);

  const caliperGeo = new THREE.BoxGeometry(0.055, 0.115, 0.075);
  disposables.geometries.push(caliperGeo);

  const sides = dualRotor ? [-1, 1] : [1];
  for (const s of sides) {
    const rotor = new THREE.Mesh(rotorGeo, rotorMat);
    rotor.position.x = s * (halfWidth * 0.85);
    wheelGroup.add(rotor);

    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(s * (halfWidth * 0.88), rotorRadius * 0.56, rotorRadius * 0.52);
    caliper.rotation.x = -0.65;
    wheelGroup.add(caliper);
  }

  return wheelGroup;
}

/**
 * Helper to create a crisp steel tube connecting two 3D points (for real exposed Trellis & Roadster frames!)
 */
function addFrameTube(
  parent: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): void {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.001) return;
  const geo = trackGeo(new THREE.CylinderGeometry(radius, radius, len, 8));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(mesh);
}

/**
 * Builds a model-accurate, strictly TWO-WHEELED 3D real-world motorcycle with authentic
 * proportions, frame type, fairing/winglet silhouette, headlights, exhaust, and livery.
 */
export function buildMotorcycle(
  spec: BikeSpec,
  options: { includeRider?: boolean; isRival?: boolean } = {}
): BuiltMotorcycle {
  const { includeRider = true, isRival = false } = options;
  const disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } = {
    geometries: [],
    materials: [],
  };

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.materials.push(m);
    return m;
  };

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const profile = spec.modelProfile;
  const isRoadster = profile === 'harley_x440';
  const isNaked = profile === 'pulsar_n160';
  const isHayabusa = profile === 'hayabusa';
  const isH2R = profile === 'ninja_h2r';
  const isDucati = profile === 'panigale_v4';
  const isBmw = profile === 'bmw_s1000rr';
  const isHonda = profile === 'cbr1000rrr';
  const isAprilia = profile === 'aprilia_rsv4';
  const isKtm = profile === 'ktm_rc390';
  const isR15 = profile === 'r15_v4';
  const isFullFaired = !isRoadster && !isNaked;

  const tireTex = getTireTextures();
  const carbonTex = getCarbonFiberTexture();
  const titaniumTex = getTitaniumExhaustTexture();
  const rotorTex = getBrakeRotorTexture();
  const dashTex = getTftDashTexture();
  const liveryTex = getLiveryBadgeTexture(spec);

  // Calibrated Real-World Automotive PBR Materials
  const paintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: spec.primaryColor,
      metalness: isH2R ? 0.88 : isHayabusa ? 0.72 : isNaked ? 0.35 : 0.56,
      roughness: isH2R ? 0.08 : isAprilia ? 0.34 : 0.14,
      clearcoat: isAprilia ? 0.35 : 1.0,
      clearcoatRoughness: 0.05,
    })
  );
  const secondaryMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: spec.secondaryColor,
      metalness: 0.38,
      roughness: 0.32,
      clearcoat: 0.55,
    })
  );
  const whiteTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf4f7fb,
      metalness: 0.2,
      roughness: 0.16,
      clearcoat: 0.95,
    })
  );
  const carbonMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: carbonTex,
      bumpMap: carbonTex,
      bumpScale: 0.008,
      metalness: 0.28,
      roughness: 0.25,
      clearcoat: 0.88,
      clearcoatRoughness: 0.12,
    })
  );
  const accentMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: spec.accentColor,
      metalness: 0.62,
      roughness: 0.18,
      clearcoat: 0.9,
    })
  );
  const frameMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: spec.frameColor,
      metalness: spec.frameStyle === 'trellis' ? 0.45 : 0.84,
      roughness: spec.frameStyle === 'trellis' ? 0.24 : 0.28,
      clearcoat: spec.frameStyle === 'trellis' ? 0.8 : 0.2,
    })
  );
  const rubberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tireTex.map,
      bumpMap: tireTex.bump,
      bumpScale: 0.018,
      metalness: 0.04,
      roughness: 0.84,
    })
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeaf0f7,
      metalness: 0.97,
      roughness: 0.1,
    })
  );
  const titaniumMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: titaniumTex,
      metalness: 0.9,
      roughness: 0.22,
    })
  );
  const matteExhaustMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1b1e24,
      metalness: 0.55,
      roughness: 0.58,
    })
  );
  const aluminumMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa2acb9,
      metalness: 0.86,
      roughness: 0.26,
    })
  );
  const darkAlloyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1b1f28,
      metalness: 0.82,
      roughness: 0.3,
    })
  );
  const engineMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isRoadster || isNaked ? 0x1d2027 : 0x323845,
      metalness: 0.78,
      roughness: 0.38,
    })
  );
  const forkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: spec.forkColor,
      metalness: 0.92,
      roughness: 0.15,
    })
  );
  const rotorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: rotorTex,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
      metalness: 0.88,
      roughness: 0.24,
    })
  );
  const caliperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isH2R ? 0x39e519 : isDucati || isAprilia ? 0xdc2626 : 0xd4a038,
      metalness: 0.76,
      roughness: 0.22,
    })
  );
  const seatMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x14151a,
      metalness: 0.05,
      roughness: 0.82,
    })
  );
  const screenGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: isKtm ? 0x1a2638 : 0x0b1322,
      metalness: 0.15,
      roughness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: isKtm ? 0.45 : 0.64,
    })
  );
  const visorMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0a1020,
      metalness: 0.55,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    })
  );
  const mirrorGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0.98,
      roughness: 0.04,
    })
  );
  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff8e6,
      emissiveIntensity: 2.4,
      roughness: 0.08,
    })
  );
  const drlMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0f9ff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    })
  );
  const taillightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff1a1a,
      emissive: 0xff0d0d,
      emissiveIntensity: 2.6,
      roughness: 0.1,
    })
  );
  const turnSignalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.9,
      roughness: 0.18,
    })
  );
  const dashMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: dashTex,
      emissiveMap: dashTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.95,
      roughness: 0.12,
    })
  );
  const liveryBadgeMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: liveryTex,
      transparent: true,
      roughness: 0.22,
      metalness: 0.25,
    })
  );
  const plateMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: getLicensePlateTexture(),
      roughness: 0.38,
      metalness: 0.12,
    })
  );

  // Authentic real-world wheelbase & tire widths (strictly 2 wheels!)
  const wb = spec.wheelbaseScale;
  const wheelRadius = isRoadster ? 0.35 : 0.342;
  const frontHalfWidth = isRoadster ? 0.068 : isR15 || isNaked ? 0.062 : 0.072;
  const rearHalfWidth = isHayabusa || isH2R || isDucati ? 0.118 : isRoadster || isNaked || isR15 ? 0.092 : 0.112;
  const frontZ = -0.82 * wb;
  const rearZ = 0.77 * wb;
  const fullColoredRim = isKtm || isAprilia || isR15;

  // 1. TWO REALISTIC MOTORCYCLE WHEELS (1 front, 1 rear)
  const frontWheel = createRealisticWheel(
    wheelRadius,
    frontHalfWidth,
    spec.rimColor,
    fullColoredRim,
    !isNaked && !isRoadster && !isR15,
    rubberMat,
    darkAlloyMat,
    rotorMat,
    caliperMat,
    chromeMat,
    disposables
  );
  frontWheel.position.set(0, wheelRadius, frontZ);
  root.add(frontWheel);

  const rearWheel = createRealisticWheel(
    wheelRadius,
    rearHalfWidth,
    spec.rimColor,
    fullColoredRim,
    false,
    rubberMat,
    darkAlloyMat,
    rotorMat,
    caliperMat,
    chromeMat,
    disposables
  );
  rearWheel.position.set(0, wheelRadius, rearZ);
  root.add(rearWheel);

  // 2. Grounded Contact Shadow
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(1.12, 2.55 * wb));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.set(0, 0.016, 0);
  root.add(shadowPlane);

  // 3. Swingarm, Rear Suspension (Twin Shocks on Harley X440 vs. Monoshock on Sports), Chain & Hugger
  const swingShape = new THREE.Shape();
  swingShape.moveTo(0, 0.0);
  swingShape.quadraticCurveTo(0.32 * wb, 0.09, 0.68 * wb, -0.02);
  swingShape.lineTo(0.68 * wb, -0.11);
  swingShape.quadraticCurveTo(0.32 * wb, -0.04, 0, -0.12);
  swingShape.closePath();
  const swingGeo = trackGeo(
    new THREE.ExtrudeGeometry(swingShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    })
  );
  swingGeo.rotateY(-Math.PI / 2);

  // Ducati Panigale V4 & Kawasaki H2R feature dramatic single-sided look on left; others dual swingarm
  const swingSides = isDucati || isH2R ? [-0.15] : [-0.142, 0.142];
  swingSides.forEach((sx) => {
    const arm = new THREE.Mesh(swingGeo, isRoadster || isNaked ? darkAlloyMat : aluminumMat);
    arm.position.set(sx + 0.025, 0.44, 0.12);
    arm.castShadow = true;
    bodyGroup.add(arm);
  });

  // Rear tire hugger (prominent on Pulsar N160 & superbikes)
  const huggerGeo = trackGeo(
    new THREE.CylinderGeometry(
      wheelRadius + 0.032,
      wheelRadius + 0.032,
      rearHalfWidth * 2.02,
      18,
      1,
      true,
      isNaked ? -0.45 : -0.95,
      isNaked ? 1.85 : 1.35
    )
  );
  huggerGeo.rotateZ(Math.PI / 2);
  const hugger = new THREE.Mesh(huggerGeo, isRoadster ? secondaryMat : carbonMat);
  hugger.position.set(0, wheelRadius, rearZ);
  bodyGroup.add(hugger);

  // Rear sprocket & drive chain
  const sprocketGeo = trackGeo(new THREE.CylinderGeometry(0.115, 0.115, 0.018, 22));
  sprocketGeo.rotateZ(Math.PI / 2);
  const sprocket = new THREE.Mesh(sprocketGeo, caliperMat);
  sprocket.position.set(-rearHalfWidth - 0.02, wheelRadius, rearZ);
  bodyGroup.add(sprocket);

  const chainGeo = trackGeo(new THREE.BoxGeometry(0.018, 0.03, 0.66 * wb));
  const chainTop = new THREE.Mesh(chainGeo, darkAlloyMat);
  chainTop.position.set(-rearHalfWidth - 0.02, wheelRadius + 0.09, rearZ - 0.34 * wb);
  chainTop.rotation.x = 0.08;
  bodyGroup.add(chainTop);

  // Suspension: Classic Twin External Coil Shocks on Harley-Davidson X440 vs. Central Monoshock
  if (isRoadster) {
    const shockRodGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 10));
    const springGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 12));
    [-0.175, 0.175].forEach((sx) => {
      const rod = new THREE.Mesh(shockRodGeo, chromeMat);
      rod.position.set(sx, 0.56, 0.54);
      rod.rotation.x = 0.36;
      bodyGroup.add(rod);

      const spring = new THREE.Mesh(springGeo, darkAlloyMat);
      spring.position.set(sx, 0.56, 0.54);
      spring.rotation.x = 0.36;
      bodyGroup.add(spring);
    });
  } else {
    const shockRodGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.35, 10));
    const shockRod = new THREE.Mesh(shockRodGeo, chromeMat);
    shockRod.position.set(0, 0.56, 0.28);
    shockRod.rotation.x = -0.45;
    bodyGroup.add(shockRod);

    const springGeo = trackGeo(new THREE.CylinderGeometry(0.044, 0.044, 0.22, 12));
    const spring = new THREE.Mesh(springGeo, accentMat);
    spring.position.set(0, 0.56, 0.28);
    spring.rotation.x = -0.45;
    bodyGroup.add(spring);
  }

  // 4. Engine Architecture & Model-Specific Frame (Exposed Trellis, Roadster Cradle, or Twin-Spar)
  const engineCoreGeo = trackGeo(new THREE.CylinderGeometry(0.185, 0.205, isRoadster ? 0.36 : 0.44, 14));
  engineCoreGeo.rotateZ(Math.PI / 2);
  const engineCore = new THREE.Mesh(engineCoreGeo, engineMetalMat);
  engineCore.position.set(0, 0.47, -0.08);
  engineCore.castShadow = true;
  bodyGroup.add(engineCore);

  // Air-oil cooled finned vertical cylinder block on Harley-Davidson X440 & Pulsar N160
  if (isRoadster || isNaked) {
    const finGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.016, 0.24));
    for (let f = 0; f < 6; f++) {
      const fin = new THREE.Mesh(finGeo, engineMetalMat);
      fin.position.set(0, 0.54 + f * 0.032, -0.15);
      fin.rotation.x = 0.16;
      bodyGroup.add(fin);
    }
    // Machined silver circular crank/clutch cover badge
    const badgeRingGeo = trackGeo(new THREE.CylinderGeometry(0.092, 0.092, 0.41, 20));
    badgeRingGeo.rotateZ(Math.PI / 2);
    const badgeRing = new THREE.Mesh(badgeRingGeo, isRoadster ? aluminumMat : darkAlloyMat);
    badgeRing.position.set(0, 0.39, 0.01);
    bodyGroup.add(badgeRing);
  } else {
    const clutchCoverGeo = trackGeo(new THREE.CylinderGeometry(0.115, 0.125, 0.48, 18));
    clutchCoverGeo.rotateZ(Math.PI / 2);
    const clutchCover = new THREE.Mesh(clutchCoverGeo, darkAlloyMat);
    clutchCover.position.set(0, 0.39, 0.02);
    bodyGroup.add(clutchCover);
  }

  // Belly pan / engine cowl (skipped on classic open-bottom Harley X440)
  if (!isRoadster) {
    const bellyShape = new THREE.Shape();
    bellyShape.moveTo(-0.46, 0.04);
    bellyShape.quadraticCurveTo(-0.18, -0.08, 0.34, -0.02);
    bellyShape.lineTo(0.28, 0.14);
    bellyShape.lineTo(-0.42, 0.17);
    bellyShape.closePath();
    const bellyGeo = trackGeo(
      new THREE.ExtrudeGeometry(bellyShape, {
        depth: 0.28,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.025,
        bevelSegments: 3,
      })
    );
    bellyGeo.center();
    bellyGeo.rotateY(Math.PI / 2);
    const bellyMat = isHonda ? secondaryMat : isDucati || isHayabusa ? paintMat : carbonMat;
    const bellyPan = new THREE.Mesh(bellyGeo, bellyMat);
    bellyPan.position.set(0, 0.26, -0.14);
    bodyGroup.add(bellyPan);
  }

  // Model-specific Chassis Frame!
  if (spec.frameStyle === 'trellis') {
    // Iconic exposed multi-tube Steel Trellis Frame (Lime Green on Ninja H2R, KTM Orange on RC 390!)
    [-1, 1].forEach((side) => {
      const xOuter = side * 0.225;
      const xInner = side * 0.165;
      const pHeadTop = new THREE.Vector3(xInner, 0.91, -0.49);
      const pHeadBot = new THREE.Vector3(xInner, 0.72, -0.45);
      const pMidTop = new THREE.Vector3(xOuter, 0.77, -0.14);
      const pMidBot = new THREE.Vector3(xOuter, 0.56, -0.14);
      const pPivot = new THREE.Vector3(xInner, 0.48, 0.16);
      const pSubTail = new THREE.Vector3(xInner * 0.9, 0.76, 0.34);

      addFrameTube(bodyGroup, pHeadTop, pMidTop, 0.018, frameMat, trackGeo);
      addFrameTube(bodyGroup, pHeadBot, pMidBot, 0.018, frameMat, trackGeo);
      addFrameTube(bodyGroup, pMidTop, pPivot, 0.018, frameMat, trackGeo);
      addFrameTube(bodyGroup, pMidBot, pPivot, 0.018, frameMat, trackGeo);
      // Signature diagonal trellis triangulation struts
      addFrameTube(bodyGroup, pHeadTop, pMidBot, 0.014, frameMat, trackGeo);
      addFrameTube(bodyGroup, pHeadBot, pMidTop, 0.014, frameMat, trackGeo);
      addFrameTube(bodyGroup, pMidTop, pSubTail, 0.015, frameMat, trackGeo);
      addFrameTube(bodyGroup, pPivot, pSubTail, 0.015, frameMat, trackGeo);
    });
  } else if (spec.frameStyle === 'roadster') {
    // Double-cradle classic tubular roadster frame (Harley-Davidson X440)
    [-1, 1].forEach((side) => {
      const x = side * 0.165;
      addFrameTube(bodyGroup, new THREE.Vector3(x, 0.9, -0.46), new THREE.Vector3(x, 0.34, -0.34), 0.018, frameMat, trackGeo);
      addFrameTube(bodyGroup, new THREE.Vector3(x, 0.34, -0.34), new THREE.Vector3(x, 0.35, 0.18), 0.018, frameMat, trackGeo);
      addFrameTube(bodyGroup, new THREE.Vector3(x, 0.74, 0.08), new THREE.Vector3(x, 0.72, 0.72), 0.017, frameMat, trackGeo);
    });
  } else {
    // Cast Aluminum Twin-Spar / Deltabox Perimeter Frame
    [-1, 1].forEach((side) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.15, 0.92, -0.52),
        new THREE.Vector3(side * 0.225, 0.74, -0.15),
        new THREE.Vector3(side * 0.17, 0.48, 0.16),
      ]);
      const sparGeo = trackGeo(new THREE.TubeGeometry(curve, 14, 0.034, 8, false));
      bodyGroup.add(new THREE.Mesh(sparGeo, frameMat));
    });
  }

  // Radiator behind front wheel
  const radGeo = trackGeo(new THREE.BoxGeometry(isRoadster ? 0.24 : 0.36, 0.28, 0.045));
  const rad = new THREE.Mesh(radGeo, darkAlloyMat);
  rad.position.set(0, 0.54, -0.45 * wb);
  rad.rotation.x = 0.28;
  bodyGroup.add(rad);

  // 5. Sculpted Model-Specific Fuel Tank + Side Model Livery Plaque
  const tankShape = new THREE.Shape();
  if (isRoadster) {
    // Iconic Harley-Davidson X440 flat-bottom sculpted teardrop tank
    tankShape.moveTo(-0.34, -0.02);
    tankShape.bezierCurveTo(-0.32, 0.2, -0.12, 0.24, 0.12, 0.18);
    tankShape.bezierCurveTo(0.26, 0.14, 0.33, 0.05, 0.34, -0.02);
    tankShape.closePath();
  } else if (isHayabusa) {
    // Smooth long-sweeping low aerodynamic Hayabusa tank
    tankShape.moveTo(-0.42, -0.02);
    tankShape.bezierCurveTo(-0.35, 0.24, -0.1, 0.31, 0.14, 0.24);
    tankShape.bezierCurveTo(0.3, 0.18, 0.38, 0.08, 0.42, -0.01);
    tankShape.lineTo(0.36, -0.06);
    tankShape.lineTo(-0.36, -0.06);
    tankShape.closePath();
  } else {
    // Aggressive carved superbike/streetfighter knee-recessed fuel tank
    tankShape.moveTo(-0.38, -0.02);
    tankShape.bezierCurveTo(-0.34, 0.23, -0.14, 0.32, 0.06, 0.27);
    tankShape.bezierCurveTo(0.24, 0.24, 0.34, 0.1, 0.39, 0.0);
    tankShape.lineTo(0.34, -0.06);
    tankShape.lineTo(-0.34, -0.06);
    tankShape.closePath();
  }

  const tankGeo = trackGeo(
    new THREE.ExtrudeGeometry(tankShape, {
      depth: isRoadster ? 0.26 : isHayabusa ? 0.34 : 0.3,
      bevelEnabled: true,
      bevelThickness: 0.072,
      bevelSize: 0.052,
      bevelSegments: 5,
    })
  );
  tankGeo.center();
  tankGeo.rotateY(Math.PI / 2);
  const fuelTank = new THREE.Mesh(tankGeo, paintMat);
  fuelTank.position.set(0, isRoadster ? 0.85 : 0.87, -0.16 * wb);
  fuelTank.castShadow = true;
  bodyGroup.add(fuelTank);

  // Tank center pad & billet fuel cap
  const tankPadGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.018, 0.4));
  const tankPad = new THREE.Mesh(tankPadGeo, isRoadster ? secondaryMat : carbonMat);
  tankPad.position.set(0, isRoadster ? 0.99 : 1.03, -0.16 * wb);
  tankPad.rotation.x = 0.1;
  bodyGroup.add(tankPad);

  const gasCapGeo = trackGeo(new THREE.CylinderGeometry(0.046, 0.05, 0.018, 16));
  const gasCap = new THREE.Mesh(gasCapGeo, isRoadster ? chromeMat : aluminumMat);
  gasCap.position.set(0, isRoadster ? 1.005 : 1.045, -0.24 * wb);
  gasCap.rotation.x = 0.08;
  bodyGroup.add(gasCap);

  // Side Tank / Fairing Model Nameplate Decal (authentic model badge visible on both sides!)
  const plaqueW = isRoadster ? 0.34 : 0.42;
  const plaqueH = isRoadster ? 0.11 : 0.135;
  const plaqueGeo = trackGeo(new THREE.PlaneGeometry(plaqueW, plaqueH));
  [-1, 1].forEach((side) => {
    const plaque = new THREE.Mesh(plaqueGeo, liveryBadgeMat);
    if (isRoadster || isNaked) {
      plaque.position.set(side * 0.215, 0.87, -0.16 * wb);
    } else {
      plaque.position.set(side * 0.266, 0.68, -0.34 * wb);
    }
    plaque.rotation.y = side * (Math.PI / 2);
    bodyGroup.add(plaque);
  });

  // 6. Rider Saddle & Model-Specific Tail Cowl + LED Taillight Assembly
  if (isRoadster) {
    // Harley-Davidson X440 flat-contoured black roadster saddle + Vivid Orange rear fender tail
    const flatSeatGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.095, 0.64));
    const flatSeat = new THREE.Mesh(flatSeatGeo, seatMat);
    flatSeat.position.set(0, 0.74, 0.36);
    bodyGroup.add(flatSeat);

    const rearFenderGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.06, 0.42));
    const rearFender = new THREE.Mesh(rearFenderGeo, paintMat);
    rearFender.position.set(0, 0.71, 0.78);
    rearFender.rotation.x = -0.18;
    bodyGroup.add(rearFender);

    // Side matte black battery cover panels (classic X440 look)
    const sidePanelGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.18, 0.36));
    const sidePanel = new THREE.Mesh(sidePanelGeo, secondaryMat);
    sidePanel.position.set(0, 0.61, 0.26);
    bodyGroup.add(sidePanel);

    // Classic compact round LED taillight at rear fender tip
    const roundTailGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 16));
    roundTailGeo.rotateX(Math.PI / 2);
    const roundTail = new THREE.Mesh(roundTailGeo, taillightMat);
    roundTail.position.set(0, 0.76, 0.99);
    bodyGroup.add(roundTail);
  } else {
    const seatCurveShape = new THREE.Shape();
    seatCurveShape.moveTo(-0.24, 0.02);
    seatCurveShape.quadraticCurveTo(0.0, -0.03, 0.24, 0.05);
    seatCurveShape.lineTo(0.22, -0.04);
    seatCurveShape.lineTo(-0.22, -0.04);
    seatCurveShape.closePath();
    const seatGeo = trackGeo(
      new THREE.ExtrudeGeometry(seatCurveShape, {
        depth: 0.24,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.025,
        bevelSegments: 3,
      })
    );
    seatGeo.center();
    seatGeo.rotateY(Math.PI / 2);
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 0.78, 0.28 * wb);
    bodyGroup.add(seat);

    // Tail cowl silhouette: Swooping rounded Hayabusa hump vs. sharp upswept superbike tail
    const tailSideShape = new THREE.Shape();
    if (isHayabusa) {
      tailSideShape.moveTo(0.0, 0.0);
      tailSideShape.quadraticCurveTo(0.28, 0.22, 0.66, 0.14);
      tailSideShape.lineTo(0.68, 0.04);
      tailSideShape.quadraticCurveTo(0.36, -0.04, 0.06, -0.09);
      tailSideShape.closePath();
    } else {
      tailSideShape.moveTo(0.0, 0.0);
      tailSideShape.quadraticCurveTo(0.26, 0.17, 0.58, 0.22);
      tailSideShape.lineTo(0.62, 0.12);
      tailSideShape.quadraticCurveTo(0.32, 0.02, 0.06, -0.09);
      tailSideShape.closePath();
    }
    const tailMainGeo = trackGeo(
      new THREE.ExtrudeGeometry(tailSideShape, {
        depth: isHayabusa ? 0.28 : 0.2,
        bevelEnabled: true,
        bevelThickness: 0.045,
        bevelSize: 0.03,
        bevelSegments: 4,
      })
    );
    tailMainGeo.center();
    tailMainGeo.rotateY(-Math.PI / 2);
    const tailCowl = new THREE.Mesh(tailMainGeo, paintMat);
    tailCowl.position.set(0, isHayabusa ? 0.87 : 0.91, 0.72 * wb);
    tailCowl.castShadow = true;
    bodyGroup.add(tailCowl);

    // Carbon tail undertray
    const undertrayGeo = trackGeo(new THREE.BoxGeometry(0.19, 0.04, 0.52));
    const undertray = new THREE.Mesh(undertrayGeo, carbonMat);
    undertray.position.set(0, 0.83, 0.7 * wb);
    undertray.rotation.x = 0.28;
    bodyGroup.add(undertray);

    // Signature twin V-blade LED Taillights (iconic view from rear chase camera!)
    const bladeCurveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.125, 0.96, 0.93 * wb),
      new THREE.Vector3(-0.075, 0.985, 1.01 * wb),
      new THREE.Vector3(-0.02, 0.945, 1.04 * wb),
    ]);
    const bladeCurveR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.125, 0.96, 0.93 * wb),
      new THREE.Vector3(0.075, 0.985, 1.01 * wb),
      new THREE.Vector3(0.02, 0.945, 1.04 * wb),
    ]);
    [bladeCurveL, bladeCurveR].forEach((curve) => {
      const bladeGeo = trackGeo(new THREE.TubeGeometry(curve, 10, 0.016, 8, false));
      bodyGroup.add(new THREE.Mesh(bladeGeo, taillightMat));
    });
  }

  // Tail-tidy bracket, plate & turn signals
  const tailTidyGeo = trackGeo(new THREE.BoxGeometry(0.045, 0.022, 0.22));
  const tailTidy = new THREE.Mesh(tailTidyGeo, darkAlloyMat);
  tailTidy.position.set(0, isRoadster ? 0.67 : 0.78, 0.98 * wb);
  tailTidy.rotation.x = -0.78;
  bodyGroup.add(tailTidy);

  const plateGeo = trackGeo(new THREE.BoxGeometry(0.165, 0.088, 0.01));
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, isRoadster ? 0.61 : 0.72, 1.05 * wb);
  plate.rotation.x = -0.38;
  bodyGroup.add(plate);

  const blinkerGeo = trackGeo(new THREE.ConeGeometry(0.018, 0.068, 6));
  [-1, 1].forEach((side) => {
    const blinker = new THREE.Mesh(blinkerGeo, turnSignalMat);
    blinker.position.set(side * 0.12, isRoadster ? 0.69 : 0.79, 1.01 * wb);
    blinker.rotation.z = side * -Math.PI * 0.5;
    bodyGroup.add(blinker);
  });

  // 7. USD Front Forks, Triple Clamp, Front Fender, Handlebars, TFT Dash & Mirrors
  const forkLength = isRoadster ? 0.82 : 0.76;
  const forkAngle = isRoadster ? 0.42 : 0.34;
  const upperForkGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.03, forkLength * 0.62, 14));
  const lowerStanchionGeo = trackGeo(new THREE.CylinderGeometry(0.024, 0.024, forkLength * 0.45, 12));

  [-0.126, 0.126].forEach((sideX) => {
    const upper = new THREE.Mesh(upperForkGeo, forkMat);
    upper.position.set(sideX, 0.73, frontZ + 0.18);
    upper.rotation.x = forkAngle;
    upper.castShadow = true;
    bodyGroup.add(upper);

    const lower = new THREE.Mesh(lowerStanchionGeo, chromeMat);
    lower.position.set(sideX, 0.48, frontZ + 0.07);
    lower.rotation.x = forkAngle;
    bodyGroup.add(lower);
  });

  const tripleGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.034, 0.12));
  const tripleClamp = new THREE.Mesh(tripleGeo, isRoadster ? darkAlloyMat : aluminumMat);
  tripleClamp.position.set(0, 0.96, -0.56 * wb);
  tripleClamp.rotation.x = forkAngle;
  bodyGroup.add(tripleClamp);

  // Front mudguard (Vivid Orange on Harley X440, Paint-matched on superbikes, Carbon on H2R/N160)
  const frontMudGeo = trackGeo(
    new THREE.CylinderGeometry(
      wheelRadius + 0.028,
      wheelRadius + 0.028,
      frontHalfWidth * 2.15,
      16,
      1,
      true,
      -0.8,
      1.5
    )
  );
  frontMudGeo.rotateZ(Math.PI / 2);
  const frontMud = new THREE.Mesh(
    frontMudGeo,
    isH2R || isNaked ? carbonMat : paintMat
  );
  frontMud.position.set(0, wheelRadius, frontZ);
  bodyGroup.add(frontMud);

  // Handlebars (Tall wide bars on Harley X440 & Pulsar N160 vs. low racing clip-ons on superbikes)
  const barWidth = isRoadster ? 0.78 : isNaked ? 0.72 : 0.58;
  const barY = isRoadster ? 1.09 : isNaked ? 1.03 : 0.93;
  const barZ = isRoadster ? -0.46 : isNaked ? -0.49 : -0.53 * wb;
  const clipBarGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, barWidth * 0.46, 10));
  clipBarGeo.rotateZ(Math.PI / 2);
  const gripGeo = trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.13, 12));
  gripGeo.rotateZ(Math.PI / 2);
  const leverGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.012, 0.016));

  [-1, 1].forEach((side) => {
    const bar = new THREE.Mesh(clipBarGeo, darkAlloyMat);
    bar.position.set(side * (barWidth * 0.27), barY, barZ);
    bar.rotation.y = side * (isRoadster ? -0.08 : -0.18);
    bar.rotation.z = side * (isRoadster ? 0.04 : -0.09);
    bodyGroup.add(bar);

    const grip = new THREE.Mesh(gripGeo, seatMat);
    grip.position.set(side * (barWidth * 0.44), barY - (isRoadster ? -0.006 : 0.012), barZ + 0.022);
    grip.rotation.y = side * (isRoadster ? -0.08 : -0.18);
    bodyGroup.add(grip);

    const lever = new THREE.Mesh(leverGeo, aluminumMat);
    lever.position.set(side * (barWidth * 0.42), barY - (isRoadster ? -0.006 : 0.012), barZ - 0.032);
    lever.rotation.y = side * -0.12;
    bodyGroup.add(lever);
  });

  // TFT Instrument Cluster (Round retro digital pod on Harley X440 vs. Rectangular TFT on sports bikes)
  if (isRoadster) {
    const podGeo = trackGeo(new THREE.CylinderGeometry(0.056, 0.052, 0.036, 18));
    podGeo.rotateX(Math.PI / 2 - 0.5);
    const pod = new THREE.Mesh(podGeo, darkAlloyMat);
    pod.position.set(0, 1.07, -0.62);
    bodyGroup.add(pod);
  } else {
    const dashBodyGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.095, 0.025));
    const dashBody = new THREE.Mesh(dashBodyGeo, darkAlloyMat);
    dashBody.position.set(0, 1.01, -0.66 * wb);
    dashBody.rotation.x = -0.52;
    bodyGroup.add(dashBody);

    const dashScreenGeo = trackGeo(new THREE.PlaneGeometry(0.16, 0.078));
    const dashScreen = new THREE.Mesh(dashScreenGeo, dashMat);
    dashScreen.position.set(0, 1.012, -0.646 * wb);
    dashScreen.rotation.x = -0.52;
    bodyGroup.add(dashScreen);
  }

  // Mirrors (Kawasaki Ninja H2R replaces mirrors with upper carbon aero wings!)
  if (!isH2R) {
    const mirrorStalkGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.011, isRoadster ? 0.24 : 0.21, 8));
    const mirrorShellGeo = trackGeo(
      isRoadster ? new THREE.CylinderGeometry(0.058, 0.058, 0.024, 16) : new THREE.SphereGeometry(0.065, 12, 10)
    );
    if (isRoadster) {
      mirrorShellGeo.rotateX(Math.PI / 2);
    } else {
      mirrorShellGeo.scale(1.1, 0.56, 0.48);
    }
    const mirrorGlassGeo = trackGeo(new THREE.CircleGeometry(0.048, 12));
    if (!isRoadster) mirrorGlassGeo.scale(1.15, 0.62, 1);

    [-1, 1].forEach((side) => {
      const mx = side * (isFullFaired ? 0.33 : barWidth * 0.46);
      const my = barY + (isRoadster ? 0.2 : 0.16);
      const mz = isFullFaired ? -0.66 * wb : barZ - 0.05;

      const stalk = new THREE.Mesh(mirrorStalkGeo, darkAlloyMat);
      stalk.position.set(mx - side * 0.07, my - 0.08, mz);
      stalk.rotation.z = -side * (isRoadster ? 0.34 : 0.68);
      bodyGroup.add(stalk);

      const shell = new THREE.Mesh(mirrorShellGeo, isRoadster ? darkAlloyMat : carbonMat);
      shell.position.set(mx, my, mz - 0.012);
      shell.rotation.y = side * 0.18;
      bodyGroup.add(shell);

      const glass = new THREE.Mesh(mirrorGlassGeo, mirrorGlassMat);
      glass.position.set(mx, my, mz + 0.016);
      glass.rotation.y = side * 0.18;
      bodyGroup.add(glass);
    });
  }

  // 8. Model-Specific Fairings, Side Details, Aero Winglets & Recognizable Headlight Signatures
  if (isFullFaired) {
    const fairingProfile = new THREE.Shape();
    if (isHayabusa) {
      // Smooth bulbous aerodynamic wind-tunnel Suzuki Hayabusa side profile
      fairingProfile.moveTo(-0.56, 0.04);
      fairingProfile.bezierCurveTo(-0.46, 0.42, -0.05, 0.48, 0.22, 0.42);
      fairingProfile.quadraticCurveTo(0.42, 0.32, 0.44, 0.12);
      fairingProfile.lineTo(0.32, -0.07);
      fairingProfile.quadraticCurveTo(-0.1, -0.1, -0.52, -0.02);
      fairingProfile.closePath();
    } else if (isH2R || isKtm) {
      // Razor-sharp faceted stealth angular fairing (Ninja H2R & KTM RC 390)
      fairingProfile.moveTo(-0.52, 0.08);
      fairingProfile.lineTo(-0.34, 0.44);
      fairingProfile.lineTo(0.08, 0.42);
      fairingProfile.lineTo(0.34, 0.24);
      fairingProfile.lineTo(0.18, -0.02);
      fairingProfile.lineTo(-0.42, -0.03);
      fairingProfile.closePath();
    } else {
      // Classic sculpted Italian/Japanese superbike fairing (Panigale V4, S1000RR, Fireblade, RSV4, R15 V4)
      fairingProfile.moveTo(-0.48, 0.04);
      fairingProfile.quadraticCurveTo(-0.34, 0.42, 0.05, 0.44);
      fairingProfile.quadraticCurveTo(0.26, 0.42, 0.36, 0.16);
      fairingProfile.lineTo(0.24, -0.05);
      fairingProfile.quadraticCurveTo(-0.1, -0.08, -0.44, -0.02);
      fairingProfile.closePath();
    }

    const sideCowlGeo = trackGeo(
      new THREE.ExtrudeGeometry(fairingProfile, {
        depth: isHayabusa ? 0.068 : 0.048,
        bevelEnabled: true,
        bevelThickness: isHayabusa ? 0.036 : 0.022,
        bevelSize: isHayabusa ? 0.028 : 0.018,
        bevelSegments: 3,
      })
    );
    sideCowlGeo.center();
    sideCowlGeo.rotateY(Math.PI / 2);

    const cowlX = isHayabusa ? 0.25 : 0.22;
    [-cowlX, cowlX].forEach((fx) => {
      const cowl = new THREE.Mesh(sideCowlGeo, isH2R ? carbonMat : paintMat);
      cowl.position.set(fx, 0.62, -0.42 * wb);
      cowl.rotation.y = fx < 0 ? 0.1 : -0.1;
      cowl.castShadow = true;
      bodyGroup.add(cowl);

      // Model-specific side fairing accents:
      if (isBmw) {
        // BMW S1000RR signature 3 dark shark-gill side vents!
        const gillGeo = trackGeo(new THREE.BoxGeometry(0.032, 0.028, 0.16));
        for (let g = 0; g < 3; g++) {
          const gill = new THREE.Mesh(gillGeo, secondaryMat);
          gill.position.set(fx * 1.07, 0.68 - g * 0.055, -0.34 * wb);
          gill.rotation.x = 0.24;
          bodyGroup.add(gill);
        }
      } else if (isHonda) {
        // Honda Fireblade HRC Pearl White mid-fairing band
        const bandGeo = trackGeo(new THREE.BoxGeometry(0.028, 0.13, 0.42));
        const band = new THREE.Mesh(bandGeo, whiteTrimMat);
        band.position.set(fx * 1.05, 0.56, -0.4 * wb);
        band.rotation.x = -0.14;
        bodyGroup.add(band);
      } else if (isAprilia) {
        // Aprilia RSV4 Racing Red lower aero cheek accent
        const cheekGeo = trackGeo(new THREE.BoxGeometry(0.028, 0.14, 0.36));
        const cheek = new THREE.Mesh(cheekGeo, secondaryMat);
        cheek.position.set(fx * 1.06, 0.58, -0.42 * wb);
        bodyGroup.add(cheek);
      } else if (isHayabusa) {
        // Hayabusa gold aero gill vent accent
        const busaVentGeo = trackGeo(new THREE.BoxGeometry(0.03, 0.12, 0.32));
        const busaVent = new THREE.Mesh(busaVentGeo, accentMat);
        busaVent.position.set(fx * 1.06, 0.61, -0.36 * wb);
        bodyGroup.add(busaVent);
      } else if (isH2R) {
        // Ninja H2R mirror-silver sculpted upper cheek cowls over the exposed green trellis!
        const cheekGeo = trackGeo(new THREE.BoxGeometry(0.045, 0.2, 0.42));
        const cheek = new THREE.Mesh(cheekGeo, paintMat);
        cheek.position.set(fx * 1.04, 0.72, -0.52 * wb);
        cheek.rotation.x = 0.2;
        bodyGroup.add(cheek);
      } else {
        const ventGeo = trackGeo(new THREE.BoxGeometry(0.032, 0.15, 0.26));
        const vent = new THREE.Mesh(ventGeo, isDucati ? secondaryMat : carbonMat);
        vent.position.set(fx * 1.03, 0.64, -0.36 * wb);
        vent.rotation.z = fx < 0 ? 0.15 : -0.15;
        bodyGroup.add(vent);
      }
    });

    // Aerodynamic Nose Cowl & Curved Bubble Windscreen
    const noseGeo = trackGeo(new THREE.SphereGeometry(isHayabusa ? 0.26 : 0.235, 18, 14));
    noseGeo.scale(isHayabusa ? 1.05 : 0.94, isHayabusa ? 0.78 : 0.82, isHayabusa ? 1.78 : 1.56);
    const nose = new THREE.Mesh(noseGeo, isH2R ? carbonMat : paintMat);
    nose.position.set(0, isHayabusa ? 0.84 : 0.87, -0.76 * wb);
    nose.rotation.x = 0.2;
    bodyGroup.add(nose);

    const bubbleGeo = trackGeo(
      new THREE.SphereGeometry(isKtm ? 0.27 : 0.25, 18, 12, 0, Math.PI, 0, Math.PI * 0.54)
    );
    bubbleGeo.scale(0.88, isKtm ? 0.84 : 0.72, 1.48);
    const bubble = new THREE.Mesh(bubbleGeo, screenGlassMat);
    bubble.position.set(0, 0.99, -0.66 * wb);
    bubble.rotation.x = -0.38;
    bodyGroup.add(bubble);

    // Model-Specific Headlight Signatures!
    if (spec.headlightStyle === 'central_m_eye') {
      // Yamaha R15 V4: Central circular M-duct projector eye + twin razor LED brows
      const projGeo = trackGeo(new THREE.CylinderGeometry(0.046, 0.046, 0.05, 16));
      projGeo.rotateX(Math.PI / 2);
      const proj = new THREE.Mesh(projGeo, headlightMat);
      proj.position.set(0, 0.84, -1.03 * wb);
      bodyGroup.add(proj);

      const drlGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.014, 0.04));
      [-0.105, 0.105].forEach((lx) => {
        const drl = new THREE.Mesh(drlGeo, drlMat);
        drl.position.set(lx, 0.88, -1.01 * wb);
        drl.rotation.z = lx < 0 ? -0.26 : 0.26;
        bodyGroup.add(drl);
      });
    } else if (spec.headlightStyle === 'aprilia_triple') {
      // Aprilia RSV4: Signature Triple-LED front headlight cluster
      const centerBarGeo = trackGeo(new THREE.BoxGeometry(0.095, 0.034, 0.04));
      const centerBar = new THREE.Mesh(centerBarGeo, headlightMat);
      centerBar.position.set(0, 0.84, -1.05 * wb);
      bodyGroup.add(centerBar);

      const sideWingEyeGeo = trackGeo(new THREE.BoxGeometry(0.105, 0.022, 0.04));
      [-0.12, 0.12].forEach((lx) => {
        const eye = new THREE.Mesh(sideWingEyeGeo, drlMat);
        eye.position.set(lx, 0.87, -1.02 * wb);
        eye.rotation.z = lx < 0 ? -0.28 : 0.28;
        eye.rotation.y = lx < 0 ? -0.28 : 0.28;
        bodyGroup.add(eye);
      });
    } else if (spec.headlightStyle === 'hayabusa_aero') {
      // Suzuki Hayabusa: Vertical stacked central aero projector + twin gold-ring corner vents
      const busaLampGeo = trackGeo(new THREE.BoxGeometry(0.095, 0.125, 0.04));
      const busaLamp = new THREE.Mesh(busaLampGeo, headlightMat);
      busaLamp.position.set(0, 0.83, -1.11 * wb);
      busaLamp.rotation.x = -0.22;
      bodyGroup.add(busaLamp);

      const cornerGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.045, 0.04));
      [-0.14, 0.14].forEach((lx) => {
        const c = new THREE.Mesh(cornerGeo, drlMat);
        c.position.set(lx, 0.81, -1.05 * wb);
        bodyGroup.add(c);
      });
    } else if (spec.headlightStyle === 'h2r_ram_air') {
      // Kawasaki Ninja H2R: Carbon chin ram-air intake snout + razor central scoop + green accent fangs
      const snoutGeo = trackGeo(new THREE.BoxGeometry(0.15, 0.068, 0.09));
      const snout = new THREE.Mesh(snoutGeo, darkAlloyMat);
      snout.position.set(0, 0.83, -1.06 * wb);
      bodyGroup.add(snout);

      const fangGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.016, 0.04));
      [-0.105, 0.105].forEach((lx) => {
        const fang = new THREE.Mesh(fangGeo, drlMat);
        fang.position.set(lx, 0.87, -1.04 * wb);
        fang.rotation.z = lx < 0 ? -0.28 : 0.28;
        bodyGroup.add(fang);
      });
    } else {
      // Twin aggressive split superbike LED headlights + central ram-air duct (S1000RR, Panigale V4, Fireblade, RC 390)
      const eyeGeo = trackGeo(new THREE.BoxGeometry(0.115, 0.032, 0.04));
      const drlGeo = trackGeo(new THREE.BoxGeometry(0.135, 0.012, 0.04));
      [-0.105, 0.105].forEach((lx) => {
        const eye = new THREE.Mesh(eyeGeo, headlightMat);
        eye.position.set(lx, 0.84, -1.04 * wb);
        eye.rotation.y = lx < 0 ? -0.26 : 0.26;
        bodyGroup.add(eye);

        const drl = new THREE.Mesh(drlGeo, drlMat);
        drl.position.set(lx, 0.87, -1.03 * wb);
        drl.rotation.z = lx < 0 ? -0.24 : 0.24;
        bodyGroup.add(drl);
      });

      const ductGeo = trackGeo(new THREE.BoxGeometry(0.075, 0.042, 0.05));
      const duct = new THREE.Mesh(ductGeo, darkAlloyMat);
      duct.position.set(0, 0.83, -1.05 * wb);
      bodyGroup.add(duct);
    }

    // Model-Specific Aero Winglets!
    if (spec.wingletStyle === 'h2r_wings') {
      // Kawasaki Ninja H2R: Signature Upper Carbon Aero Wings (mirror position) + Lower Side Winglets
      const upperWingGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.022, 0.14));
      const lowerWingGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.02, 0.15));
      [-1, 1].forEach((side) => {
        const uWing = new THREE.Mesh(upperWingGeo, carbonMat);
        uWing.position.set(side * 0.34, 1.07, -0.68 * wb);
        uWing.rotation.z = side * 0.32;
        uWing.rotation.x = 0.12;
        bodyGroup.add(uWing);

        const lWing = new THREE.Mesh(lowerWingGeo, carbonMat);
        lWing.position.set(side * 0.29, 0.78, -0.66 * wb);
        lWing.rotation.z = side * 0.18;
        lWing.rotation.x = 0.14;
        bodyGroup.add(lWing);
      });
    } else if (spec.wingletStyle === 'biplane') {
      // Ducati Panigale V4: Double-Layer Biplane Carbon Winglets!
      const wingGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.018, 0.13));
      const endPlateGeo = trackGeo(new THREE.BoxGeometry(0.016, 0.085, 0.12));
      [-1, 1].forEach((side) => {
        [0.77, 0.825].forEach((wy) => {
          const w = new THREE.Mesh(wingGeo, carbonMat);
          w.position.set(side * 0.28, wy, -0.63 * wb);
          w.rotation.z = side * 0.16;
          bodyGroup.add(w);
        });
        const ep = new THREE.Mesh(endPlateGeo, carbonMat);
        ep.position.set(side * 0.385, 0.798, -0.63 * wb);
        bodyGroup.add(ep);
      });
    } else if (spec.wingletStyle === 'recessed') {
      // BMW S1000RR / Fireblade / RSV4 sleek aero side winglets
      const wingGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.02, 0.12));
      [-1, 1].forEach((side) => {
        const w = new THREE.Mesh(wingGeo, carbonMat);
        w.position.set(side * 0.265, 0.77, -0.62 * wb);
        w.rotation.z = side * 0.22;
        bodyGroup.add(w);
      });
    }
  } else if (isRoadster) {
    // Harley-Davidson X440: Iconic Classic Round Chrome-Bezel LED Headlamp + Horizontal Signature DRL
    const housingGeo = trackGeo(new THREE.CylinderGeometry(0.125, 0.105, 0.14, 22));
    housingGeo.rotateX(Math.PI / 2);
    const housing = new THREE.Mesh(housingGeo, darkAlloyMat);
    housing.position.set(0, 0.91, -0.76 * wb);
    bodyGroup.add(housing);

    const bezelGeo = trackGeo(new THREE.TorusGeometry(0.122, 0.014, 10, 24));
    const bezel = new THREE.Mesh(bezelGeo, chromeMat);
    bezel.position.set(0, 0.91, -0.83 * wb);
    bodyGroup.add(bezel);

    const lensGeo = trackGeo(new THREE.CircleGeometry(0.112, 22));
    lensGeo.rotateY(Math.PI);
    const lens = new THREE.Mesh(lensGeo, headlightMat);
    lens.position.set(0, 0.91, -0.834 * wb);
    bodyGroup.add(lens);

    const barDrlGeo = trackGeo(new THREE.BoxGeometry(0.21, 0.018, 0.014));
    const barDrl = new THREE.Mesh(barDrlGeo, drlMat);
    barDrl.position.set(0, 0.91, -0.84 * wb);
    bodyGroup.add(barDrl);
  } else {
    // Bajaj Pulsar N160: Muscular Black Tank Shrouds with Red Graphic Slashes + Wolf-Eye Projector Mask
    const shroudShape = new THREE.Shape();
    shroudShape.moveTo(0, 0);
    shroudShape.quadraticCurveTo(0.24, 0.22, 0.46, 0.15);
    shroudShape.lineTo(0.38, -0.11);
    shroudShape.lineTo(0.04, -0.12);
    shroudShape.closePath();
    const shroudGeo = trackGeo(
      new THREE.ExtrudeGeometry(shroudShape, {
        depth: 0.042,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.015,
        bevelSegments: 3,
      })
    );
    shroudGeo.center();
    shroudGeo.rotateY(Math.PI / 2);

    const slashGeo = trackGeo(new THREE.BoxGeometry(0.02, 0.03, 0.22));
    [-0.22, 0.22].forEach((sx) => {
      const shroud = new THREE.Mesh(shroudGeo, paintMat);
      shroud.position.set(sx, 0.72, -0.35 * wb);
      shroud.rotation.y = sx < 0 ? 0.18 : -0.18;
      shroud.castShadow = true;
      bodyGroup.add(shroud);

      const slash = new THREE.Mesh(slashGeo, accentMat);
      slash.position.set(sx * 1.12, 0.67, -0.38 * wb);
      slash.rotation.x = 0.22;
      bodyGroup.add(slash);
    });

    // Wolf-eye streetfighter headlight cowling (central projector + angry slanted DRL brows)
    const maskGeo = trackGeo(new THREE.SphereGeometry(0.175, 14, 12));
    maskGeo.scale(0.92, 0.98, 1.15);
    const mask = new THREE.Mesh(maskGeo, paintMat);
    mask.position.set(0, 0.87, -0.77 * wb);
    bodyGroup.add(mask);

    const projGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 16));
    projGeo.rotateX(Math.PI / 2);
    const proj = new THREE.Mesh(projGeo, headlightMat);
    proj.position.set(0, 0.85, -0.95 * wb);
    bodyGroup.add(proj);

    const browGeo = trackGeo(new THREE.BoxGeometry(0.095, 0.016, 0.035));
    [-0.085, 0.085].forEach((lx) => {
      const brow = new THREE.Mesh(browGeo, drlMat);
      brow.position.set(lx, 0.91, -0.93 * wb);
      brow.rotation.z = lx < 0 ? -0.34 : 0.34;
      bodyGroup.add(brow);
    });
  }

  // 9. Model-Specific Exhaust Systems & Header Pipes + Exhaust Flame Cones
  const flameMeshes: THREE.Mesh[] = [];
  const flameMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xff5a1f,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  // Header pipes (single curved header on single-cyl bikes, 4-into-1 manifold on Inline-4/V4)
  const headerOffsets =
    isRoadster || isNaked || isR15 || isKtm ? [0.04] : [-0.09, -0.03, 0.03, 0.09];
  headerOffsets.forEach((hx) => {
    const headerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, 0.56, -0.26 * wb),
      new THREE.Vector3(hx * 1.1, 0.38, -0.34 * wb),
      new THREE.Vector3(hx * 0.7, 0.24, -0.18 * wb),
      new THREE.Vector3(hx * 0.4, 0.25, 0.14 * wb),
    ]);
    const hGeo = trackGeo(new THREE.TubeGeometry(headerCurve, 12, 0.022, 8, false));
    bodyGroup.add(new THREE.Mesh(hGeo, isRoadster ? matteExhaustMat : titaniumMat));
  });

  const addMuffler = (
    x: number,
    y: number,
    z: number,
    rotX: number,
    len: number,
    rad: number,
    bodyMat: THREE.Material,
    capMat: THREE.Material
  ) => {
    const pipeGeo = trackGeo(new THREE.CylinderGeometry(rad * 1.24, rad * 0.78, len, 16));
    pipeGeo.rotateX(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, bodyMat);
    pipe.position.set(x, y, z);
    pipe.rotation.x = rotX;
    pipe.castShadow = true;
    bodyGroup.add(pipe);

    const capGeo = trackGeo(new THREE.CylinderGeometry(rad * 0.96, rad * 1.24, 0.09, 16));
    capGeo.rotateX(Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(
      x,
      y + Math.sin(rotX) * (len * 0.52),
      z + Math.cos(rotX) * (len * 0.52)
    );
    cap.rotation.x = rotX;
    bodyGroup.add(cap);

    const boreGeo = trackGeo(new THREE.CylinderGeometry(rad * 0.65, rad * 0.65, 0.04, 12));
    boreGeo.rotateX(Math.PI / 2);
    const bore = new THREE.Mesh(boreGeo, seatMat);
    bore.position.set(
      x,
      y + Math.sin(rotX) * (len * 0.56),
      z + Math.cos(rotX) * (len * 0.56)
    );
    bore.rotation.x = rotX;
    bodyGroup.add(bore);

    if (!isRival) {
      const flameGeo = trackGeo(new THREE.ConeGeometry(rad * 1.05, 0.44, 8));
      flameGeo.rotateX(Math.PI / 2);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(
        x,
        y + Math.sin(rotX) * (len * 0.6),
        z + Math.cos(rotX) * (len * 0.6) + 0.18
      );
      flame.rotation.x = rotX;
      bodyGroup.add(flame);
      flameMeshes.push(flame);
    }
  };

  if (spec.exhaustStyle === 'twin_chrome_mega') {
    // Suzuki Hayabusa: Iconic Twin Large Polished Chrome Megaphones!
    addMuffler(-0.265, 0.43, 0.56 * wb, 0.14, 0.78, 0.068, chromeMat, chromeMat);
    addMuffler(0.265, 0.43, 0.56 * wb, 0.14, 0.78, 0.068, chromeMat, chromeMat);
  } else if (spec.exhaustStyle === 'roadster_horizontal') {
    // Harley-Davidson X440: Matte-black horizontal upswept right-side muffler
    addMuffler(0.24, 0.36, 0.54 * wb, 0.07, 0.74, 0.064, matteExhaustMat, chromeMat);
  } else if (spec.exhaustStyle === 'underbelly_stub') {
    // Bajaj Pulsar N160: Clean compact underbelly stubby exhaust tip
    addMuffler(0.185, 0.25, 0.18 * wb, 0.05, 0.28, 0.046, matteExhaustMat, aluminumMat);
  } else if (spec.exhaustStyle === 'underbelly_twin') {
    // Ducati Panigale V4: Clean twin underbelly outlets below the swingarm
    addMuffler(-0.145, 0.25, 0.24 * wb, 0.06, 0.32, 0.044, titaniumMat, carbonMat);
    addMuffler(0.145, 0.25, 0.24 * wb, 0.06, 0.32, 0.044, titaniumMat, carbonMat);
  } else if (spec.exhaustStyle === 'h2r_megapipe') {
    // Kawasaki Ninja H2R: Massive upswept brushed-titanium GP megapipe!
    addMuffler(0.26, 0.5, 0.52 * wb, 0.36, 0.72, 0.064, titaniumMat, titaniumMat);
  } else if (spec.exhaustStyle === 'titanium_side_high') {
    // BMW S1000RR / Honda Fireblade / Aprilia RSV4: Upswept titanium Akrapovic-style side can
    addMuffler(0.248, 0.48, 0.5 * wb, 0.32, 0.64, 0.058, titaniumMat, carbonMat);
  } else {
    // Yamaha R15 V4 / KTM RC 390: Sport right-side exhaust can
    addMuffler(0.24, 0.44, 0.46 * wb, 0.26, 0.58, 0.054, matteExhaustMat, aluminumMat);
  }

  // 10. Anatomically Sculpted Realistic Rider (Adapts Posture for Roadster vs. Superbike!)
  let riderGroup: THREE.Group | null = null;
  if (includeRider) {
    riderGroup = new THREE.Group();
    riderGroup.position.set(0, isRoadster ? 0.79 : 0.81, 0.25 * wb);
    bodyGroup.add(riderGroup);

    const torsoLean = isRoadster ? 0.24 : isNaked ? 0.42 : 0.68;

    const leatherMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: spec.riderJacketColor,
        roughness: 0.48,
        metalness: 0.08,
        clearcoat: 0.22,
      })
    );
    const pantsLeatherMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x15171d,
        roughness: 0.58,
        metalness: 0.06,
      })
    );
    const bootMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x111216,
        roughness: 0.42,
        metalness: 0.18,
      })
    );
    const helmetShellMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: spec.helmetColor,
        metalness: 0.42,
        roughness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      })
    );

    const pelvisGeo = trackGeo(new THREE.CapsuleGeometry(0.135, 0.12, 8, 14));
    pelvisGeo.rotateZ(Math.PI / 2);
    const pelvis = new THREE.Mesh(pelvisGeo, pantsLeatherMat);
    pelvis.position.set(0, 0.03, 0.04);
    riderGroup.add(pelvis);

    const torsoGeo = trackGeo(new THREE.CapsuleGeometry(0.17, 0.32, 10, 16));
    torsoGeo.scale(1.12, 1.0, 0.76);
    const torso = new THREE.Mesh(torsoGeo, leatherMat);
    torso.position.set(0, isRoadster ? 0.31 : 0.27, isRoadster ? -0.02 : -0.11);
    torso.rotation.x = torsoLean;
    torso.castShadow = true;
    riderGroup.add(torso);

    if (!isRoadster) {
      const humpGeo = trackGeo(new THREE.CapsuleGeometry(0.085, 0.2, 8, 12));
      humpGeo.scale(1.05, 1.0, 0.65);
      const hump = new THREE.Mesh(humpGeo, accentMat);
      hump.position.set(0, 0.39, -0.02);
      hump.rotation.x = torsoLean + 0.06;
      riderGroup.add(hump);
    }

    const neckGeo = trackGeo(new THREE.CylinderGeometry(0.068, 0.082, 0.1, 12));
    const neck = new THREE.Mesh(neckGeo, pantsLeatherMat);
    neck.position.set(0, isRoadster ? 0.56 : 0.48, isRoadster ? -0.08 : -0.25);
    neck.rotation.x = isRoadster ? 0.15 : 0.4;
    riderGroup.add(neck);

    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0, isRoadster ? 0.68 : 0.59, isRoadster ? -0.1 : -0.31);
    helmetGroup.rotation.x = isRoadster ? 0.06 : 0.14;
    riderGroup.add(helmetGroup);

    const shellGeo = trackGeo(new THREE.SphereGeometry(0.158, 22, 18));
    shellGeo.scale(0.94, 0.98, 1.18);
    const shell = new THREE.Mesh(shellGeo, helmetShellMat);
    shell.castShadow = true;
    helmetGroup.add(shell);

    if (!isRoadster) {
      const spoilerGeo = trackGeo(new THREE.BoxGeometry(0.15, 0.032, 0.1));
      const spoiler = new THREE.Mesh(spoilerGeo, carbonMat);
      spoiler.position.set(0, 0.045, 0.165);
      spoiler.rotation.x = -0.22;
      helmetGroup.add(spoiler);
    }

    const hStripeGeo = trackGeo(new THREE.SphereGeometry(0.161, 14, 12, -0.22, 0.44, 0.15, 1.8));
    hStripeGeo.scale(0.94, 0.98, 1.18);
    hStripeGeo.rotateY(Math.PI);
    helmetGroup.add(new THREE.Mesh(hStripeGeo, accentMat));

    const visorGeo = trackGeo(
      new THREE.SphereGeometry(0.162, 16, 12, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.34, Math.PI * 0.32)
    );
    visorGeo.scale(0.94, 0.98, 1.18);
    visorGeo.rotateY(Math.PI);
    helmetGroup.add(new THREE.Mesh(visorGeo, visorMat));

    // Arms & Armored Gloves
    const shoulderGeo = trackGeo(new THREE.SphereGeometry(0.088, 12, 10));
    const upperArmGeo = trackGeo(new THREE.CapsuleGeometry(0.056, 0.22, 8, 12));
    const forearmGeo = trackGeo(new THREE.CapsuleGeometry(0.048, 0.22, 8, 12));
    const gloveGeo = trackGeo(new THREE.SphereGeometry(0.05, 10, 8));

    [-1, 1].forEach((side) => {
      const sh = new THREE.Mesh(shoulderGeo, isRoadster ? leatherMat : accentMat);
      sh.position.set(side * 0.215, isRoadster ? 0.46 : 0.4, isRoadster ? -0.08 : -0.24);
      riderGroup!.add(sh);

      const uArm = new THREE.Mesh(upperArmGeo, leatherMat);
      uArm.position.set(side * 0.26, isRoadster ? 0.36 : 0.28, isRoadster ? -0.2 : -0.32);
      uArm.rotation.x = isRoadster ? 0.95 : 0.78;
      uArm.rotation.z = side * -0.22;
      riderGroup!.add(uArm);

      const fArm = new THREE.Mesh(forearmGeo, leatherMat);
      fArm.position.set(side * (isRoadster ? 0.31 : 0.26), isRoadster ? 0.3 : 0.2, isRoadster ? -0.44 : -0.52);
      fArm.rotation.x = 1.48;
      fArm.rotation.z = side * 0.1;
      riderGroup!.add(fArm);

      const glove = new THREE.Mesh(gloveGeo, bootMat);
      glove.position.set(
        side * (barWidth * 0.44),
        barY - (isRoadster ? 0.78 : 0.82),
        barZ - 0.23 * wb
      );
      riderGroup!.add(glove);
    });

    // Legs & Armored Boots
    const thighGeo = trackGeo(new THREE.CapsuleGeometry(0.078, 0.28, 8, 12));
    const kneeGeo = trackGeo(new THREE.SphereGeometry(0.068, 10, 8));
    const puckGeo = trackGeo(new THREE.BoxGeometry(0.025, 0.08, 0.05));
    const calfGeo = trackGeo(new THREE.CapsuleGeometry(0.06, 0.28, 8, 12));
    const bootFootGeo = trackGeo(new THREE.CapsuleGeometry(0.048, 0.14, 8, 10));
    bootFootGeo.rotateX(Math.PI / 2);

    [-1, 1].forEach((side) => {
      const thigh = new THREE.Mesh(thighGeo, pantsLeatherMat);
      thigh.position.set(side * 0.2, -0.06, -0.11);
      thigh.rotation.x = 1.02;
      thigh.rotation.z = side * -0.14;
      riderGroup!.add(thigh);

      const knee = new THREE.Mesh(kneeGeo, pantsLeatherMat);
      knee.position.set(side * 0.235, -0.15, -0.27);
      riderGroup!.add(knee);

      if (!isRoadster) {
        const puck = new THREE.Mesh(puckGeo, accentMat);
        puck.position.set(side * 0.295, -0.15, -0.27);
        riderGroup!.add(puck);
      }

      const calf = new THREE.Mesh(calfGeo, bootMat);
      calf.position.set(side * 0.215, -0.33, isRoadster ? -0.2 : -0.14);
      calf.rotation.x = isRoadster ? -0.25 : -0.62;
      riderGroup!.add(calf);

      const foot = new THREE.Mesh(bootFootGeo, bootMat);
      foot.position.set(side * 0.21, -0.45, isRoadster ? -0.18 : -0.05);
      riderGroup!.add(foot);
    });
  }

  const dispose = () => {
    disposables.geometries.forEach((g) => g.dispose());
    disposables.materials.forEach((m) => m.dispose());
  };

  return {
    group: root,
    bodyGroup,
    frontWheel,
    rearWheel,
    riderGroup,
    flameMeshes,
    taillightMat,
    isCustomGlb: false,
    dispose,
  };
}

/**
 * Loads a user-imported real-world .GLB / .GLTF motorcycle binary via Three.js GLTFLoader,
 * auto-normalizes scale to ~2.12m real motorcycle length, grounds tires cleanly to y = 0,
 * detects front/rear wheel meshes by name for rotation, and adds grounded contact shadow.
 */
export function loadCustomGlbMotorcycle(
  arrayBuffer: ArrayBuffer,
  spec: BikeSpec
): Promise<BuiltMotorcycle> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(
      arrayBuffer,
      '',
      (gltf) => {
        const root = new THREE.Group();
        const bodyGroup = new THREE.Group();
        root.add(bodyGroup);

        const model = gltf.scene;
        // Measure raw bounds and orient longest horizontal axis along Z (forward = -Z)
        const rawBox = new THREE.Box3().setFromObject(model);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        if (rawSize.x > rawSize.z * 1.15) {
          model.rotation.y = Math.PI / 2;
        }
        model.updateMatrixWorld(true);

        const alignedBox = new THREE.Box3().setFromObject(model);
        const alignedSize = alignedBox.getSize(new THREE.Vector3());
        const longestAxis = Math.max(alignedSize.z, alignedSize.x, alignedSize.y, 0.001);
        const targetLength = 2.12 * spec.wheelbaseScale;
        const scale = targetLength / longestAxis;
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);

        const finalBox = new THREE.Box3().setFromObject(model);
        const center = finalBox.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= finalBox.min.y; // Ground tires flush to y = 0!
        bodyGroup.add(model);

        const frontWheel = new THREE.Group();
        const rearWheel = new THREE.Group();
        const detectedWheels: Array<{ obj: THREE.Object3D; z: number }> = [];

        model.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              const std = m as THREE.MeshStandardMaterial;
              if (std && 'envMapIntensity' in std) {
                std.envMapIntensity = 1.15;
              }
            }
          }
          if (/wheel|tire|tyre|rim/i.test(node.name)) {
            const worldPos = new THREE.Vector3();
            node.getWorldPosition(worldPos);
            detectedWheels.push({ obj: node, z: worldPos.z });
          }
        });

        // Attach contact shadow below custom GLB
        const shadowGeo = new THREE.PlaneGeometry(1.15, 2.45);
        shadowGeo.rotateX(-Math.PI / 2);
        const shadowMat = new THREE.MeshBasicMaterial({
          map: getContactShadowTexture(),
          transparent: true,
          depthWrite: false,
          opacity: 0.72,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
        shadowPlane.position.set(0, 0.016, 0);
        root.add(shadowPlane);

        const taillightMat = new THREE.MeshStandardMaterial({
          color: 0xff1a1a,
          emissive: 0xff0d0d,
          emissiveIntensity: 2.2,
        });

        // Keep dummy wheel rotation proxies synced to any detected GLB wheel sub-meshes
        if (detectedWheels.length >= 2) {
          detectedWheels.sort((a, b) => a.z - b.z);
          const frontTarget = detectedWheels[0].obj;
          const rearTarget = detectedWheels[detectedWheels.length - 1].obj;
          frontWheel.userData.targetWheel = frontTarget;
          rearWheel.userData.targetWheel = rearTarget;
        }

        const dispose = () => {
          shadowGeo.dispose();
          shadowMat.dispose();
          taillightMat.dispose();
          model.traverse((node) => {
            const mesh = node as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.geometry?.dispose();
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((mat) => mat?.dispose());
            }
          });
        };

        resolve({
          group: root,
          bodyGroup,
          frontWheel,
          rearWheel,
          riderGroup: null,
          flameMeshes: [],
          taillightMat,
          isCustomGlb: true,
          dispose,
        });
      },
      (err) => {
        reject(err instanceof Error ? err : new Error('Invalid GLB/GLTF file format.'));
      }
    );
  });
}
