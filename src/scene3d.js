import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Deterministic PRNG for reproducible organic 3D anatomy & crystal facets
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function initUrology3DScene() {
  const container = document.getElementById('webgl-container');
  if (!container) return null;

  const appState = {
    scrollTarget: 0,
    scrollCurrent: 0,
    stoneSizeMm: 8, // 4, 8, 14, 22
    modality: 'ursl', // 'ursl' | 'rirs' | 'pcnl'
    theme: 'dark', // 'dark' | 'light'
    userYawTarget: 0,
    userYawCurrent: 0,
    userPitchTarget: 0,
    userPitchCurrent: 0
  };

  // =========================================================================
  // 1. RENDERER, SCENE, CAMERA & HDR STUDIO POST-PROCESSING
  // =========================================================================
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  const initialDpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(initialDpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const darkBg = new THREE.Color(0x08131f);
  const lightBg = new THREE.Color(0xeef4f8);
  scene.background = darkBg.clone();
  scene.fog = new THREE.FogExp2(0x08131f, 0.032);

  const camera = new THREE.PerspectiveCamera(
    38,
    window.innerWidth / window.innerHeight,
    0.1,
    80
  );
  camera.position.set(0.3, 4.1, 7.2);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.75;

  const renderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth * initialDpr,
    window.innerHeight * initialDpr,
    { type: THREE.HalfFloatType, samples: 4 }
  );
  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.34,
    0.45,
    0.88
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // =========================================================================
  // 2. SURGICAL STUDIO 3-POINT LIGHTING
  // =========================================================================
  const ambientLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.65);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfff8f0, 2.2);
  keyLight.position.set(5.5, 8.0, 6.5);
  scene.add(keyLight);

  const rimLightCyan = new THREE.DirectionalLight(0x38bdf8, 1.65);
  rimLightCyan.position.set(-6.0, 3.0, -4.5);
  scene.add(rimLightCyan);

  const warmSubsurfaceLight = new THREE.PointLight(0xff6b5b, 1.8, 12, 1.6);
  warmSubsurfaceLight.position.set(1.2, 4.2, -1.6);
  scene.add(warmSubsurfaceLight);

  const organRoot = new THREE.Group();
  scene.add(organRoot);

  // =========================================================================
  // 3. PROCEDURAL ORGANIC TISSUE BUMP & STRIATION TEXTURES
  // =========================================================================
  function createParenchymaTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    const rand = mulberry32(3109);

    g.fillStyle = '#808080';
    g.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 6500; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const r = 1 + rand() * 4.2;
      const v = rand() > 0.5 ? 158 : 98;
      g.fillStyle = `rgba(${v},${v},${v},0.08)`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function createSoftParticleSprite() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,235,190,0.85)');
    grad.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  const tissueBumpTex = createParenchymaTexture();

  // =========================================================================
  // 4. SCULPTED 3D KIDNEY (Capsule + 7 Medullary Pyramids + Calyces + Vessels)
  // =========================================================================
  const kidneyGroup = new THREE.Group();
  kidneyGroup.position.set(0.92, 4.18, 0.0);
  kidneyGroup.rotation.z = 0.14;
  organRoot.add(kidneyGroup);

  const kidneyGeo = new THREE.SphereGeometry(1, 104, 80);
  const kPos = kidneyGeo.attributes.position;
  for (let i = 0; i < kPos.count; i++) {
    const vx = kPos.getX(i);
    const vy = kPos.getY(i);
    const vz = kPos.getZ(i);

    let x = vx * 1.12;
    let y = vy * 1.78;
    let z = vz * 0.76;

    x -= 0.36 * (vy * vy);

    const hilumVertical = Math.exp(-(vy * vy) / 0.16);
    const hilumMedial = smoothstep(-0.08, -0.92, vx);
    const hilumIndent = hilumVertical * hilumMedial;
    x += hilumIndent * 0.82;
    z *= 1.0 - hilumIndent * 0.32;

    const lobule =
      0.022 * Math.sin(vx * 6.5 + 0.5) * Math.cos(vy * 8.0) * Math.cos(vz * 6.0);
    x += vx * lobule;
    y += vy * lobule;
    z += vz * lobule;

    kPos.setXYZ(i, x, y, z);
  }
  kidneyGeo.computeVertexNormals();

  const kidneyCortexMat = new THREE.MeshPhysicalMaterial({
    color: 0xc84d50,
    attenuationColor: new THREE.Color(0x63101a),
    attenuationDistance: 1.45,
    transmission: 0.64,
    thickness: 1.95,
    ior: 1.38,
    roughness: 0.18,
    bumpMap: tissueBumpTex,
    bumpScale: 0.018,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.88
  });
  const kidneyMesh = new THREE.Mesh(kidneyGeo, kidneyCortexMat);
  kidneyGroup.add(kidneyMesh);

  const pyramidMat = new THREE.MeshPhysicalMaterial({
    color: 0x691525,
    emissive: 0x24040a,
    roughness: 0.36,
    bumpMap: tissueBumpTex,
    bumpScale: 0.025,
    clearcoat: 0.65
  });

  const calyxMat = new THREE.MeshPhysicalMaterial({
    color: 0xebd0cb,
    attenuationColor: new THREE.Color(0x9e4b4c),
    attenuationDistance: 0.9,
    transmission: 0.52,
    thickness: 0.6,
    roughness: 0.16,
    clearcoat: 0.9
  });

  const pyramidAngles = [-1.12, -0.76, -0.38, 0.0, 0.38, 0.76, 1.12];
  const pelvisHub = new THREE.Vector3(-0.36, -0.06, 0.0);

  pyramidAngles.forEach((ang, idx) => {
    const zOffset = idx % 2 === 0 ? 0.11 : -0.11;
    const radiusOut = 0.74;
    const px = Math.cos(ang) * radiusOut - 0.06 * (ang * ang);
    const py = Math.sin(ang) * 1.24;

    const pGeo = new THREE.ConeGeometry(0.23, 0.52, 24, 4);
    const pMesh = new THREE.Mesh(pGeo, pyramidMat);
    pMesh.position.set(px, py, zOffset);

    const dirToPelvis = new THREE.Vector3()
      .subVectors(pelvisHub, pMesh.position)
      .normalize();
    pMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirToPelvis);
    kidneyGroup.add(pMesh);

    const papillaTip = pMesh.position
      .clone()
      .addScaledVector(dirToPelvis, 0.22);
    const midCtrl = papillaTip
      .clone()
      .lerp(pelvisHub, 0.55)
      .add(new THREE.Vector3(0, 0, zOffset * 0.4));
    const calyxCurve = new THREE.CatmullRomCurve3([
      papillaTip,
      midCtrl,
      pelvisHub.clone()
    ]);
    const calyxGeo = new THREE.TubeGeometry(calyxCurve, 16, 0.075, 14, false);
    kidneyGroup.add(new THREE.Mesh(calyxGeo, calyxMat));
  });

  const pelvisCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 0.12, 0),
    new THREE.Vector3(-0.42, -0.08, 0.02),
    new THREE.Vector3(-0.68, -0.48, 0.05)
  ]);
  const pelvisGeo = new THREE.TubeGeometry(pelvisCurve, 24, 0.21, 20, false);
  kidneyGroup.add(new THREE.Mesh(pelvisGeo, calyxMat));

  const arteryMat = new THREE.MeshPhysicalMaterial({
    color: 0xb82032,
    roughness: 0.24,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12
  });
  const veinMat = new THREE.MeshPhysicalMaterial({
    color: 0x26588c,
    roughness: 0.26,
    clearcoat: 0.88,
    clearcoatRoughness: 0.14
  });

  const arteryGroup = new THREE.Group();
  const mainArtery = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.15, 0.28, -0.16),
    new THREE.Vector3(-1.35, 0.22, -0.14),
    new THREE.Vector3(-0.62, 0.14, -0.10),
    new THREE.Vector3(-0.22, 0.16, -0.06)
  ]);
  arteryGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(mainArtery, 28, 0.125, 16, false), arteryMat)
  );
  const supArtery = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.92, 0.18, -0.12),
    new THREE.Vector3(-0.55, 0.42, -0.06),
    new THREE.Vector3(-0.20, 0.62, 0.02)
  ]);
  arteryGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(supArtery, 20, 0.068, 12, false), arteryMat)
  );
  kidneyGroup.add(arteryGroup);

  const mainVein = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.22, -0.04, 0.18),
    new THREE.Vector3(-1.32, -0.02, 0.18),
    new THREE.Vector3(-0.58, -0.02, 0.14),
    new THREE.Vector3(-0.20, -0.02, 0.08)
  ]);
  kidneyGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(mainVein, 28, 0.165, 18, false), veinMat)
  );

  // =========================================================================
  // 5. 3D ANATOMICAL S-CURVE URETER (Real-Time Elastic 3D Mesh Deformation)
  // =========================================================================
  const ureterCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.46, 3.92, 0.02),
    new THREE.Vector3(0.14, 3.32, 0.07),
    new THREE.Vector3(-0.04, 2.55, 0.14),
    new THREE.Vector3(-0.14, 1.35, 0.24),
    new THREE.Vector3(0.10, 0.12, 0.42),
    new THREE.Vector3(-0.20, -1.25, -0.12),
    new THREE.Vector3(-0.18, -2.55, -0.04),
    new THREE.Vector3(-0.12, -3.55, 0.06),
    new THREE.Vector3(-0.04, -4.28, 0.12)
  ]);

  const iliacArtCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.35, 0.72, 0.06),
    new THREE.Vector3(0.08, 0.14, 0.14),
    new THREE.Vector3(1.45, -0.58, -0.08)
  ]);
  const iliacVeinCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.42, 0.48, -0.08),
    new THREE.Vector3(0.02, -0.08, 0.00),
    new THREE.Vector3(1.38, -0.82, -0.22)
  ]);
  const iliacArtMat = new THREE.MeshPhysicalMaterial({
    color: 0x9e2434,
    roughness: 0.35,
    transparent: true,
    opacity: 0.42
  });
  const iliacVeinMat = new THREE.MeshPhysicalMaterial({
    color: 0x264f7d,
    roughness: 0.38,
    transparent: true,
    opacity: 0.42
  });
  organRoot.add(
    new THREE.Mesh(new THREE.TubeGeometry(iliacArtCurve, 28, 0.17, 14, false), iliacArtMat)
  );
  organRoot.add(
    new THREE.Mesh(new THREE.TubeGeometry(iliacVeinCurve, 28, 0.21, 14, false), iliacVeinMat)
  );

  const U_RINGS = 180;
  const U_RADIAL = 32;
  const ureterFrames = ureterCurve.computeFrenetFrames(U_RINGS, false);
  const ureterCenters = [];
  const ureterBaseRadii = [];

  for (let i = 0; i <= U_RINGS; i++) {
    const u = i / U_RINGS;
    ureterCenters.push(ureterCurve.getPointAt(u));

    let r = 0.145;
    if (u < 0.12) {
      r = 0.34 - smoothstep(0.0, 0.12, u) * 0.225;
    } else {
      const upjPinch = Math.exp(-Math.pow((u - 0.12) / 0.045, 2)) * 0.032;
      const iliacPinch = Math.exp(-Math.pow((u - 0.48) / 0.055, 2)) * 0.030;
      const uvjPinch = Math.exp(-Math.pow((u - 0.95) / 0.045, 2)) * 0.038;
      r = 0.152 - upjPinch - iliacPinch - uvjPinch;
    }
    ureterBaseRadii.push(r);
  }

  const ureterGeo = new THREE.BufferGeometry();
  const uVertCount = (U_RINGS + 1) * (U_RADIAL + 1);
  const uPositions = new Float32Array(uVertCount * 3);
  const uUVs = new Float32Array(uVertCount * 2);
  const uIndices = [];

  for (let i = 0; i <= U_RINGS; i++) {
    for (let j = 0; j <= U_RADIAL; j++) {
      const idx = i * (U_RADIAL + 1) + j;
      uUVs[idx * 2] = j / U_RADIAL;
      uUVs[idx * 2 + 1] = i / U_RINGS;
    }
  }
  for (let i = 0; i < U_RINGS; i++) {
    for (let j = 0; j < U_RADIAL; j++) {
      const a = i * (U_RADIAL + 1) + j;
      const b = (i + 1) * (U_RADIAL + 1) + j;
      const c = (i + 1) * (U_RADIAL + 1) + (j + 1);
      const d = i * (U_RADIAL + 1) + (j + 1);
      uIndices.push(a, b, d, b, c, d);
    }
  }
  ureterGeo.setAttribute('position', new THREE.BufferAttribute(uPositions, 3));
  ureterGeo.setAttribute('uv', new THREE.BufferAttribute(uUVs, 2));
  ureterGeo.setIndex(uIndices);

  const ureterMat = new THREE.MeshPhysicalMaterial({
    color: 0xe38886,
    attenuationColor: new THREE.Color(0x8f2932),
    attenuationDistance: 0.85,
    transmission: 0.78,
    thickness: 0.52,
    ior: 1.38,
    roughness: 0.10,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide
  });

  const ureterMesh = new THREE.Mesh(ureterGeo, ureterMat);
  organRoot.add(ureterMesh);

  function updateUreterDeformation(stoneU, stoneWorldRadius, intactWeight, elapsed) {
    const posAttr = ureterGeo.attributes.position;
    for (let i = 0; i <= U_RINGS; i++) {
      const u = i / U_RINGS;
      const center = ureterCenters[i];
      const N = ureterFrames.normals[i];
      const B = ureterFrames.binormals[i];

      let r = ureterBaseRadii[i];
      r += Math.sin(u * 18.0 - elapsed * 2.4) * 0.007;

      if (intactWeight > 0.02) {
        const du = u - stoneU;
        if (Math.abs(du) < 0.055) {
          const shape = Math.cos((du / 0.055) * (Math.PI * 0.5));
          const stretch = Math.max(0, stoneWorldRadius * 1.16 - r);
          r += stretch * shape * intactWeight;
        } else if (du < 0 && du > -0.20 && stoneU > 0.08) {
          const hydro = (1 - Math.abs(du) / 0.20) * 0.032 * intactWeight;
          r += hydro;
        }
      }

      for (let j = 0; j <= U_RADIAL; j++) {
        const theta = (j / U_RADIAL) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const vx = center.x + r * (cosT * N.x + sinT * B.x);
        const vy = center.y + r * (cosT * N.y + sinT * B.y);
        const vz = center.z + r * (cosT * N.z + sinT * B.z);

        const idx = (i * (U_RADIAL + 1) + j) * 3;
        uPositions[idx] = vx;
        uPositions[idx + 1] = vy;
        uPositions[idx + 2] = vz;
      }
    }
    posAttr.needsUpdate = true;
    ureterGeo.computeVertexNormals();
  }

  // =========================================================================
  // 6. 3D CUTAWAY TRANSLUCENT URINARY BLADDER, FLUID POOL & PROSTATE COLLAR
  // =========================================================================
  const bladderGroup = new THREE.Group();
  bladderGroup.position.set(0.18, -4.95, 0.08);
  organRoot.add(bladderGroup);

  const bladderPts = [];
  const bProfile = [
    [0.001, 0.92],
    [0.42, 0.90],
    [0.86, 0.74],
    [1.14, 0.42],
    [1.18, 0.02],
    [0.98, -0.42],
    [0.54, -0.78],
    [0.19, -1.04],
    [0.14, -1.48],
    [0.13, -1.85]
  ];
  bProfile.forEach(p => bladderPts.push(new THREE.Vector2(p[0], p[1])));
  const bladderGeo = new THREE.LatheGeometry(bladderPts, 56);
  bladderGeo.scale(1.04, 1.0, 0.78);
  bladderGeo.computeVertexNormals();

  const bladderMat = new THREE.MeshPhysicalMaterial({
    color: 0xd97375,
    attenuationColor: new THREE.Color(0x7d202b),
    attenuationDistance: 1.25,
    transmission: 0.72,
    thickness: 1.05,
    ior: 1.38,
    roughness: 0.14,
    bumpMap: tissueBumpTex,
    bumpScale: 0.012,
    clearcoat: 1.0,
    clearcoatRoughness: 0.07,
    transparent: true,
    opacity: 0.86
  });
  const bladderMesh = new THREE.Mesh(bladderGeo, bladderMat);
  bladderGroup.add(bladderMesh);

  const fluidPts = [
    new THREE.Vector2(0.001, -0.08),
    new THREE.Vector2(0.98, -0.08),
    new THREE.Vector2(0.84, -0.42),
    new THREE.Vector2(0.46, -0.75),
    new THREE.Vector2(0.14, -1.04),
    new THREE.Vector2(0.10, -1.82)
  ];
  const fluidGeo = new THREE.LatheGeometry(fluidPts, 44);
  fluidGeo.scale(1.0, 1.0, 0.75);
  const fluidMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x07364d,
    emissiveIntensity: 0.35,
    transmission: 0.82,
    thickness: 1.2,
    ior: 1.333,
    roughness: 0.06,
    transparent: true,
    opacity: 0.58
  });
  const bladderFluidMesh = new THREE.Mesh(fluidGeo, fluidMat);
  bladderGroup.add(bladderFluidMesh);

  // 3D Sculpted Prostate Gland Collar around Proximal Urethra (HoLEP & TURP Zone)
  const prostateGeo = new THREE.SphereGeometry(0.46, 36, 28);
  const prPos = prostateGeo.attributes.position;
  for (let i = 0; i < prPos.count; i++) {
    let x = prPos.getX(i) * 1.16;
    let y = prPos.getY(i) * 0.86;
    let z = prPos.getZ(i) * 0.92;
    const groove = Math.exp(-(x * x) / 0.045) * 0.09;
    z -= groove * Math.sign(z || 1);
    prPos.setXYZ(i, x, y, z);
  }
  prostateGeo.computeVertexNormals();

  const prostateMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9686f,
    emissive: 0x24080e,
    emissiveIntensity: 0.35,
    attenuationColor: new THREE.Color(0x6e1b26),
    attenuationDistance: 0.95,
    transmission: 0.56,
    thickness: 0.85,
    roughness: 0.22,
    bumpMap: tissueBumpTex,
    bumpScale: 0.015,
    clearcoat: 0.9,
    transparent: true,
    opacity: 0.84
  });
  const prostateMesh = new THREE.Mesh(prostateGeo, prostateMat);
  prostateMesh.position.set(0, -1.28, 0);
  bladderGroup.add(prostateMesh);

  const leftUreterStump = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.95, -3.25, -0.06),
    new THREE.Vector3(0.66, -3.82, 0.02),
    new THREE.Vector3(0.42, -4.28, 0.10)
  ]);
  const stumpMat = ureterMat.clone();
  stumpMat.opacity = 0.45;
  organRoot.add(
    new THREE.Mesh(new THREE.TubeGeometry(leftUreterStump, 24, 0.11, 16, false), stumpMat)
  );

  // =========================================================================
  // 7. 3D JAGGED CALCIUM OXALATE CRYSTAL CALCULUS + SPASM RINGS
  // =========================================================================
  const stoneGeo = new THREE.IcosahedronGeometry(1.0, 3);
  const sPos = stoneGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const vx = sPos.getX(i);
    const vy = sPos.getY(i);
    const vz = sPos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const nx = vx / len, ny = vy / len, nz = vz / len;

    const ridge1 = Math.abs(Math.sin(nx * 5.2 + ny * 3.8) * Math.cos(nz * 4.7));
    const ridge2 = Math.pow(Math.abs(Math.cos(nx * 8.5 - nz * 7.1)), 2.2);
    const r = 0.74 + ridge1 * 0.34 + ridge2 * 0.22;

    sPos.setXYZ(i, nx * r * 0.92, ny * r * 1.18, nz * r * 0.90);
  }
  stoneGeo.computeVertexNormals();

  const stoneMat = new THREE.MeshPhysicalMaterial({
    color: 0xe69519,
    emissive: 0x7c3a04,
    emissiveIntensity: 0.72,
    roughness: 0.26,
    metalness: 0.08,
    flatShading: true,
    clearcoat: 0.85,
    clearcoatRoughness: 0.15
  });
  const stoneMesh = new THREE.Mesh(stoneGeo, stoneMat);
  organRoot.add(stoneMesh);

  const stoneLight = new THREE.PointLight(0xf59e0b, 1.4, 2.6, 1.8);
  organRoot.add(stoneLight);

  const spasmRings = [];
  for (let i = 0; i < 3; i++) {
    const rGeo = new THREE.TorusGeometry(1.0, 0.016, 12, 48);
    const rMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const rMesh = new THREE.Mesh(rGeo, rMat);
    organRoot.add(rMesh);
    spasmRings.push(rMesh);
  }

  // =========================================================================
  // 8. 3D ENDOSCOPIC INSTRUMENTS: URSL, RIRS FLEXIBLE & MINI-PCNL KEYHOLE
  // =========================================================================
  const scopeGroup = new THREE.Group();
  organRoot.add(scopeGroup);

  const scopeSheathMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    metalness: 0.45,
    roughness: 0.28,
    clearcoat: 0.9
  });
  let scopeMesh = null;

  const scopeTipBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.09, 20),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.15 })
  );
  scopeGroup.add(scopeTipBezel);

  const scopeHeadlamp = new THREE.PointLight(0xe0f2fe, 0, 2.2, 1.5);
  scopeGroup.add(scopeHeadlamp);

  const laserBeamGeo = new THREE.CylinderGeometry(0.016, 0.022, 1.0, 16);
  laserBeamGeo.translate(0, 0.5, 0);
  const laserBeamMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0
  });
  const laserBeamMesh = new THREE.Mesh(laserBeamGeo, laserBeamMat);
  organRoot.add(laserBeamMesh);

  const plasmaFlashMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xecfeff, transparent: true, opacity: 0 })
  );
  organRoot.add(plasmaFlashMesh);
  const laserFlashLight = new THREE.PointLight(0x22d3ee, 0, 3.4, 1.5);
  organRoot.add(laserFlashLight);

  const pcnlCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.85, 3.62, 0.36),
    new THREE.Vector3(1.82, 3.74, 0.20),
    new THREE.Vector3(0.84, 3.86, 0.06)
  ]);
  const pcnlSheathMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.85,
    roughness: 0.20
  });
  const pcnlSheathMesh = new THREE.Mesh(
    new THREE.TubeGeometry(pcnlCurve, 20, 0.062, 16, false),
    pcnlSheathMat
  );
  pcnlSheathMesh.visible = false;
  organRoot.add(pcnlSheathMesh);

  function rebuildScopeTube(tipU) {
    if (scopeMesh) {
      scopeGroup.remove(scopeMesh);
      scopeMesh.geometry.dispose();
      scopeMesh = null;
    }
    if (tipU >= 1.06) {
      scopeTipBezel.visible = false;
      return null;
    }

    const pts = [
      new THREE.Vector3(0.18, -6.75, 0.08),
      new THREE.Vector3(0.18, -5.85, 0.08),
      new THREE.Vector3(0.06, -5.05, 0.10),
      new THREE.Vector3(-0.04, -4.28, 0.12)
    ];

    const clampedTip = Math.max(0.04, Math.min(0.99, tipU));
    if (tipU < 1.0) {
      const steps = clampedTip < 0.35 ? 36 : 18;
      for (let s = 1; s <= steps; s++) {
        const u = 1.0 - (1.0 - clampedTip) * (s / steps);
        pts.push(ureterCurve.getPointAt(u));
      }
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 52, 0.044, 14, false);
    scopeMesh = new THREE.Mesh(geo, scopeSheathMat);
    scopeGroup.add(scopeMesh);

    const endPt = pts[pts.length - 1];
    const prevPt = pts[pts.length - 2];
    const tangent = new THREE.Vector3().subVectors(endPt, prevPt).normalize();

    scopeTipBezel.visible = true;
    scopeTipBezel.position.copy(endPt);
    scopeTipBezel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    scopeHeadlamp.position.copy(endPt).addScaledVector(tangent, 0.08);

    return { tipPos: endPt, tangent };
  }

  // =========================================================================
  // 9. 38 3D CRYSTAL FRACTURE SHARDS + 900 VORTEX MICRO-DUST PARTICLES
  // =========================================================================
  const SHARD_COUNT = 38;
  const shardGeo = new THREE.TetrahedronGeometry(0.048, 0);
  const shardMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    emissive: 0x92400e,
    emissiveIntensity: 0.7,
    roughness: 0.25,
    flatShading: true
  });
  const shardInstanced = new THREE.InstancedMesh(shardGeo, shardMat, SHARD_COUNT);
  organRoot.add(shardInstanced);

  const shardSeeds = [];
  const pRand = mulberry32(5512);
  for (let i = 0; i < SHARD_COUNT; i++) {
    shardSeeds.push({
      dir: new THREE.Vector3(
        (pRand() - 0.5) * 2,
        (pRand() - 0.35) * 2,
        (pRand() - 0.5) * 2
      ).normalize(),
      rotSpeed: new THREE.Vector3(pRand() * 6, pRand() * 6, pRand() * 6),
      delay: pRand() * 0.35,
      scale: 0.55 + pRand() * 0.85
    });
  }

  const DUST_COUNT = 900;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  const dustColors = new Float32Array(DUST_COUNT * 3);
  const dustMeta = [];

  for (let i = 0; i < DUST_COUNT; i++) {
    dustMeta.push({
      offset: pRand() * 0.55,
      speed: 0.55 + pRand() * 0.85,
      angle: pRand() * Math.PI * 2,
      radial: 0.15 + pRand() * 0.80,
      warm: pRand() > 0.25
    });
    dustPos[i * 3 + 1] = -999;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

  const dustMat = new THREE.PointsMaterial({
    size: 0.068,
    map: createSoftParticleSprite(),
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  organRoot.add(dustPoints);

  const bokehGeo = new THREE.BufferGeometry();
  const bokehCount = 90;
  const bokehArr = new Float32Array(bokehCount * 3);
  for (let i = 0; i < bokehCount; i++) {
    bokehArr[i * 3] = (pRand() - 0.5) * 14;
    bokehArr[i * 3 + 1] = 6 - pRand() * 14;
    bokehArr[i * 3 + 2] = -1.5 - pRand() * 5;
  }
  bokehGeo.setAttribute('position', new THREE.BufferAttribute(bokehArr, 3));
  const bokehMat = new THREE.PointsMaterial({
    size: 0.08,
    map: createSoftParticleSprite(),
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.22,
    depthWrite: false
  });
  scene.add(new THREE.Points(bokehGeo, bokehMat));

  // =========================================================================
  // 10. POINTER / TOUCH HORIZONTAL 3D ORBIT INTERACTION
  // =========================================================================
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  container.addEventListener('pointerdown', e => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener(
    'pointermove',
    e => {
      if (!isDragging) {
        if (window.innerWidth >= 900) {
          const nx = (e.clientX / window.innerWidth - 0.5) * 2;
          const ny = (e.clientY / window.innerHeight - 0.5) * 2;
          appState.userYawTarget = nx * 0.22;
          appState.userPitchTarget = ny * 0.08;
        }
        return;
      }
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      appState.userYawTarget = Math.max(
        -0.72,
        Math.min(0.72, appState.userYawTarget + dx * 0.0065)
      );
      appState.userPitchTarget = Math.max(
        -0.22,
        Math.min(0.22, appState.userPitchTarget + dy * 0.0025)
      );
    },
    { passive: true }
  );

  window.addEventListener('pointerup', () => {
    isDragging = false;
  });
  window.addEventListener('pointercancel', () => {
    isDragging = false;
  });

  // =========================================================================
  // 11. SCROLL & RESIZE HANDLERS + HUD DOM REFS
  // =========================================================================
  function onScroll() {
    const anchor = document.getElementById('journey-end-anchor');
    if (!anchor) return;
    const total = Math.max(1, anchor.offsetTop - window.innerHeight * 0.45);
    appState.scrollTarget = Math.max(0, Math.min(1, window.scrollY / total));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', onResize, { passive: true });

  const hudDot = document.getElementById('hud-dot');
  const hudStage = document.getElementById('hud-stage');
  const hudMetric = document.getElementById('hud-metric');
  const railFill = document.getElementById('tract-rail-fill');

  function applyStudioTheme(themeName) {
    appState.theme = themeName;
    const isLight = themeName === 'light';
    const targetBg = isLight ? lightBg : darkBg;
    scene.background.copy(targetBg);
    scene.fog.color.copy(targetBg);
    scene.fog.density = isLight ? 0.018 : 0.032;
    ambientLight.intensity = isLight ? 1.25 : 0.65;
    keyLight.intensity = isLight ? 2.5 : 2.2;
    bloomPass.strength = isLight ? 0.18 : 0.34;
    bokehMat.opacity = isLight ? 0.08 : 0.22;
  }

  // =========================================================================
  // 12. MAIN 60FPS ANIMATION & 3D CHOREOGRAPHY LOOP
  // =========================================================================
  const dummyObj = new THREE.Object3D();
  const tempVec = new THREE.Vector3();
  const camTargetLook = new THREE.Vector3();
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();
    appState.scrollCurrent += (appState.scrollTarget - appState.scrollCurrent) * 0.09;
    const p = appState.scrollCurrent;

    const heartWave = Math.pow(Math.max(0, Math.sin(elapsed * 3.55)), 4);
    arteryGroup.scale.setScalar(1 + heartWave * 0.025);
    kidneyGroup.position.y = 4.18 + Math.sin(elapsed * 1.1) * 0.03;

    appState.userYawCurrent += (appState.userYawTarget - appState.userYawCurrent) * 0.10;
    appState.userPitchCurrent += (appState.userPitchTarget - appState.userPitchCurrent) * 0.10;

    const autoScrollYaw = Math.sin(p * Math.PI * 1.65) * 0.32;
    organRoot.rotation.y = autoScrollYaw + appState.userYawCurrent;
    organRoot.rotation.x = appState.userPitchCurrent;

    const isRenalTarget = appState.modality === 'rirs' || appState.modality === 'pcnl';
    let stoneU = 0.015;
    let erosion = 0;
    let laserIntensity = 0;
    let dustProgress = 0;
    let flushProgress = 0;
    let symptomPulse = 0;

    if (p <= 0.14) {
      stoneU = 0.015 + (p / 0.14) * 0.055;
    } else if (p <= 0.50) {
      const t = (p - 0.14) / 0.36;
      const eased = t + 0.032 * Math.sin(t * Math.PI * 3);
      stoneU = 0.07 + Math.max(0, Math.min(1, eased)) * (isRenalTarget ? 0.04 : 0.67);
      symptomPulse = Math.sin(t * Math.PI);
    } else if (p <= 0.75) {
      const t = (p - 0.50) / 0.25;
      stoneU = isRenalTarget ? 0.065 : 0.74 + t * 0.025;
      laserIntensity = Math.sin(Math.min(1, t * 1.15) * Math.PI);
      erosion = smoothstep(0.10, 0.90, t);
      dustProgress = smoothstep(0.08, 0.96, t);
      symptomPulse = Math.max(0, (1 - t * 2.5) * 0.45);
    } else {
      const t = (p - 0.75) / 0.25;
      stoneU = isRenalTarget ? 0.065 : 0.765;
      erosion = 1.0;
      dustProgress = 1.0;
      flushProgress = t;
    }

    const stoneCenter = ureterCurve.getPointAt(Math.min(1, stoneU));
    const clampedMm = Math.min(16, appState.stoneSizeMm);
    const baseStoneRadius = 0.108 + (clampedMm - 4) * 0.0095;
    const intactScale = Math.max(0, 1 - erosion * 0.95);
    const activeStoneRadius = baseStoneRadius * intactScale;

    if (intactScale > 0.03) {
      stoneMesh.visible = true;
      stoneMesh.position.copy(stoneCenter);
      stoneMesh.scale.setScalar(activeStoneRadius);
      stoneMesh.rotation.set(
        p * 8.5 + elapsed * 0.45,
        p * 12.0 + elapsed * 0.62,
        p * 5.2
      );
      if (laserIntensity > 0.1) {
        stoneMat.emissive.setHex(0x38bdf8);
        stoneMat.emissiveIntensity = 0.8 + laserIntensity * 1.6;
      } else {
        stoneMat.emissive.setHex(0x7c3a04);
        stoneMat.emissiveIntensity = 0.72 + symptomPulse * 0.5;
      }

      stoneLight.position.copy(stoneCenter).add(new THREE.Vector3(0, 0, 0.25));
      stoneLight.color.setHex(symptomPulse > 0.25 ? 0xf97316 : 0xf59e0b);
      stoneLight.intensity = (1.3 + symptomPulse * 1.8) * intactScale;
    } else {
      stoneMesh.visible = false;
      stoneLight.intensity = 0;
    }

    spasmRings.forEach((ring, idx) => {
      if (symptomPulse > 0.04) {
        ring.visible = true;
        const phase = (elapsed * 0.75 + idx * 0.33) % 1;
        const scale = 0.18 + phase * 0.58;
        ring.position.copy(stoneCenter);
        ring.scale.setScalar(scale);
        ring.rotation.x = Math.PI * 0.42;
        ring.material.opacity = (1 - phase) * 0.52 * symptomPulse;
      } else {
        ring.visible = false;
      }
    });

    updateUreterDeformation(stoneU, activeStoneRadius, intactScale, elapsed);

    laserBeamMesh.visible = false;
    plasmaFlashMesh.visible = false;
    laserFlashLight.intensity = 0;
    scopeHeadlamp.intensity = 0;
    pcnlSheathMesh.visible = false;

    if ((appState.modality === 'ursl' || appState.modality === 'rirs') && p > 0.41 && p < 0.83) {
      const enter = smoothstep(0.41, 0.51, p);
      const retract = p > 0.73 ? 1 - smoothstep(0.73, 0.82, p) : 1;
      const reach = enter * retract;
      const desiredTipU = Math.min(0.99, stoneU + 0.055);
      const currentTipU = 1.07 - (1.07 - desiredTipU) * reach;

      const scopeInfo = rebuildScopeTube(currentTipU);
      if (scopeInfo && reach > 0.78) {
        scopeHeadlamp.intensity = 2.2 * reach;

        if (laserIntensity > 0.05 && intactScale > 0.04) {
          const pulse = 0.6 + 0.4 * Math.sin(elapsed * 38.0);
          const beamVec = tempVec.subVectors(stoneCenter, scopeInfo.tipPos);
          const dist = beamVec.length();

          laserBeamMesh.visible = true;
          laserBeamMesh.position.copy(scopeInfo.tipPos);
          laserBeamMesh.scale.set(1, dist, 1);
          laserBeamMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            beamVec.clone().normalize()
          );
          laserBeamMat.opacity = 0.88 * laserIntensity * pulse;

          plasmaFlashMesh.visible = true;
          plasmaFlashMesh.position
            .copy(stoneCenter)
            .add(new THREE.Vector3(0, -activeStoneRadius * 0.65, 0));
          plasmaFlashMesh.scale.setScalar((0.7 + pulse * 0.7) * laserIntensity);
          plasmaFlashMesh.material.opacity = 0.92 * laserIntensity;

          laserFlashLight.position.copy(plasmaFlashMesh.position);
          laserFlashLight.intensity = 4.2 * laserIntensity * pulse;
        }
      }
    } else if (appState.modality === 'pcnl' && p > 0.42 && p < 0.82) {
      rebuildScopeTube(1.1);
      const enter = smoothstep(0.42, 0.50, p);
      const retract = p > 0.73 ? 1 - smoothstep(0.73, 0.81, p) : 1;
      const reach = enter * retract;
      pcnlSheathMesh.visible = reach > 0.05;
      pcnlSheathMesh.position.x = (1 - reach) * 1.6;

      if (reach > 0.82 && laserIntensity > 0.05 && intactScale > 0.04) {
        const pulse = 0.6 + 0.4 * Math.sin(elapsed * 38.0);
        const pcnlTip = new THREE.Vector3(0.84, 3.86, 0.06);
        const beamVec = tempVec.subVectors(stoneCenter, pcnlTip);
        const dist = beamVec.length();

        laserBeamMesh.visible = true;
        laserBeamMesh.position.copy(pcnlTip);
        laserBeamMesh.scale.set(1.2, dist, 1.2);
        laserBeamMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          beamVec.clone().normalize()
        );
        laserBeamMat.opacity = 0.9 * laserIntensity * pulse;

        plasmaFlashMesh.visible = true;
        plasmaFlashMesh.position.copy(stoneCenter);
        plasmaFlashMesh.scale.setScalar((0.8 + pulse * 0.7) * laserIntensity);
        plasmaFlashMesh.material.opacity = 0.94 * laserIntensity;

        laserFlashLight.position.copy(stoneCenter);
        laserFlashLight.intensity = 4.4 * laserIntensity * pulse;
      }
    } else {
      rebuildScopeTube(1.1);
    }

    const burstOriginU = isRenalTarget ? 0.07 : 0.75;
    const showBurst = dustProgress > 0.01;
    shardInstanced.visible = showBurst && flushProgress < 0.55;
    if (shardInstanced.visible) {
      for (let i = 0; i < SHARD_COUNT; i++) {
        const s = shardSeeds[i];
        const localT = Math.max(0, (dustProgress - s.delay) / (1 - s.delay));
        const shrink = Math.max(0, 1 - localT * 1.15);
        if (localT <= 0 || shrink <= 0.01) {
          dummyObj.scale.setScalar(0.0001);
        } else {
          const burstDist = localT * 0.22;
          const driftU = Math.min(0.99, burstOriginU + localT * 0.18);
          const basePt = ureterCurve.getPointAt(driftU);
          dummyObj.position
            .copy(basePt)
            .addScaledVector(s.dir, burstDist * 0.48);
          dummyObj.rotation.set(
            elapsed * s.rotSpeed.x,
            elapsed * s.rotSpeed.y,
            elapsed * s.rotSpeed.z
          );
          dummyObj.scale.setScalar(s.scale * shrink);
        }
        dummyObj.updateMatrix();
        shardInstanced.setMatrixAt(i, dummyObj.matrix);
      }
      shardInstanced.instanceMatrix.needsUpdate = true;
    }

    dustPoints.visible = showBurst;
    if (showBurst) {
      const pAttr = dustGeo.attributes.position;
      const cAttr = dustGeo.attributes.color;

      for (let i = 0; i < DUST_COUNT; i++) {
        const m = dustMeta[i];
        const travel =
          (dustProgress * 0.55 + flushProgress * 1.15) * m.speed - m.offset * 0.42;

        if (travel <= 0) {
          dustPos[i * 3 + 1] = -999;
          continue;
        }

        const spanScale = isRenalTarget ? 0.85 : 0.36;
        const uTrack = burstOriginU + travel * spanScale;
        if (uTrack <= 1.0) {
          const idxRing = Math.min(U_RINGS, Math.floor(uTrack * U_RINGS));
          const cPt = ureterCenters[idxRing];
          const N = ureterFrames.normals[idxRing];
          const B = ureterFrames.binormals[idxRing];
          const ang = m.angle + elapsed * 3.8 + uTrack * 22.0;
          const rad = 0.095 * m.radial;

          dustPos[i * 3] = cPt.x + rad * (Math.cos(ang) * N.x + Math.sin(ang) * B.x);
          dustPos[i * 3 + 1] = cPt.y + rad * (Math.cos(ang) * N.y + Math.sin(ang) * B.y);
          dustPos[i * 3 + 2] = cPt.z + rad * (Math.cos(ang) * N.z + Math.sin(ang) * B.z);
        } else {
          const bT = (uTrack - 1.0) * 2.1;
          if (bT > 1.45) {
            dustPos[i * 3 + 1] = -999;
            continue;
          }
          const funnelR = Math.max(0.06, (1 - Math.min(1, bT * 0.78)) * 0.78) * m.radial;
          const swirlAng = m.angle + elapsed * 2.2 + bT * 6.5;
          dustPos[i * 3] = 0.18 + Math.cos(swirlAng) * funnelR;
          dustPos[i * 3 + 1] = -4.32 - bT * 1.75;
          dustPos[i * 3 + 2] = 0.08 + Math.sin(swirlAng) * funnelR * 0.72;
        }

        const coolShift = Math.min(1, Math.max(0, (uTrack - 0.92) * 1.8));
        if (m.warm) {
          dustColors[i * 3] = 1.0 - coolShift * 0.65;
          dustColors[i * 3 + 1] = 0.76 + coolShift * 0.16;
          dustColors[i * 3 + 2] = 0.32 + coolShift * 0.66;
        } else {
          dustColors[i * 3] = 0.45;
          dustColors[i * 3 + 1] = 0.92;
          dustColors[i * 3 + 2] = 1.0;
        }
      }
      pAttr.needsUpdate = true;
      cAttr.needsUpdate = true;
    }

    bladderFluidMesh.position.y = Math.sin(elapsed * 1.9) * 0.025;
    bladderFluidMesh.rotation.y = elapsed * 0.35;
    const prostateFocus = smoothstep(0.76, 0.92, p);
    prostateMat.emissive.setHex(prostateFocus > 0.2 ? 0x164e63 : 0x24080e);
    prostateMat.emissiveIntensity = 0.35 + prostateFocus * (0.45 + 0.2 * Math.sin(elapsed * 3.0));

    const isDesktop = window.innerWidth >= 900;

    let focusY, focusX, camDist, camElevOffset;
    if (p < 0.14) {
      const k = p / 0.14;
      focusX = 0.65 - k * 0.35;
      focusY = 4.15 - k * 0.65;
      camDist = 6.2 - k * 0.5;
      camElevOffset = 0.35;
    } else if (p < 0.50) {
      focusX = stoneCenter.x;
      focusY = stoneCenter.y;
      camDist = 5.4;
      camElevOffset = 0.25;
    } else if (p < 0.75) {
      const mZoom = Math.sin(((p - 0.50) / 0.25) * Math.PI);
      focusX = stoneCenter.x + (isRenalTarget ? 0.25 : 0);
      focusY = stoneCenter.y - (isRenalTarget ? -0.10 : 0.15);
      camDist = 5.3 - mZoom * 1.35;
      camElevOffset = isRenalTarget ? 0.22 : -0.25 * mZoom;
    } else {
      const b = (p - 0.75) / 0.25;
      focusX = 0.15;
      focusY = -3.4 - smoothstep(0, 0.75, b) * 2.15;
      camDist = 5.4 + b * 0.55;
      camElevOffset = 0.18;
    }

    if (isDesktop) {
      const desktopShiftX = -1.65 * (camDist / 5.8);
      camera.position.set(
        focusX + desktopShiftX + Math.sin(p * 3.2) * 0.45,
        focusY + camElevOffset,
        camDist
      );
      camTargetLook.set(focusX + desktopShiftX, focusY, 0);
    } else {
      const mobileShiftY = -0.58 * (camDist / 5.6);
      camera.position.set(
        focusX + Math.sin(p * 3.0) * 0.38,
        focusY + mobileShiftY + camElevOffset,
        camDist * 1.06
      );
      camTargetLook.set(focusX, focusY + mobileShiftY, 0);
    }
    camera.lookAt(camTargetLook);

    if (railFill) railFill.style.height = (p * 100).toFixed(1) + '%';
    if (hudStage && hudMetric && hudDot) {
      hudMetric.textContent = (p * 26.0).toFixed(1) + ' cm';
      if (p < 0.14) {
        hudStage.textContent = '3D Kidney · Renal Pelvis';
        hudDot.style.backgroundColor = 'hsl(36, 92%, 56%)';
      } else if (p < 0.32) {
        hudStage.textContent = isRenalTarget ? 'Intrarenal Calyx' : 'UPJ Narrowing';
        hudDot.style.backgroundColor = 'hsl(18, 88%, 56%)';
      } else if (p < 0.50) {
        hudStage.textContent = isRenalTarget ? 'Renal Pelvis Target' : 'Mid-Ureter · Iliac Arch';
        hudDot.style.backgroundColor = 'hsl(11, 82%, 60%)';
      } else if (p < 0.75) {
        hudStage.textContent =
          appState.modality === 'rirs'
            ? 'RIRS Flexible Kidney Laser'
            : appState.modality === 'pcnl'
            ? 'Mini-PCNL Keyhole Clearance'
            : 'URSL Holmium Laser Dusting';
        hudDot.style.backgroundColor = 'hsl(190, 78%, 50%)';
      } else {
        hudStage.textContent = 'Bladder & Prostate (HoLEP · TURP)';
        hudDot.style.backgroundColor = 'hsl(168, 76%, 44%)';
      }
    }

    composer.render();
  }

  animate();

  return {
    setStoneSize(mm) {
      appState.stoneSizeMm = mm;
    },
    setModality(mod) {
      appState.modality = mod;
    },
    setTheme(theme) {
      applyStudioTheme(theme);
    }
  };
}
