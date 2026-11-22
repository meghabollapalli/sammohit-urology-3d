import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { journeyValue } from './lib/journey.js';

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

/**
 * Builds the scroll-driven urinary-tract scene inside `container`.
 * @param {object} opts
 * @param {HTMLElement} opts.container element the canvas is appended to
 * @param {boolean} [opts.lowPower] phones / low-memory devices: lower pixel
 *   density, no bloom, fewer particles
 * @param {() => void} [opts.onFirstFrame] called once the first frame is drawn
 */
export function initUrology3DScene({ container, lowPower = false, onFirstFrame } = {}) {
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
    antialias: false,
    powerPreference: lowPower ? 'default' : 'high-performance'
  });
  const MAX_DPR = lowPower ? 1.5 : 2;
  const initialDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  // The canvas fills its container (the whole screen on wide layouts, the pinned
  // top panel on phones), not the window.
  const viewSize = () => ({ w: container.clientWidth || window.innerWidth, h: container.clientHeight || window.innerHeight });
  let { w: viewW, h: viewH } = viewSize();
  renderer.setPixelRatio(initialDpr);
  renderer.setSize(viewW, viewH);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Cinematic backdrop: a soft teal-navy glow behind the anatomy, falling off to near black.
  function createBackdropTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(640, 420, 40, 560, 520, 760);
    grad.addColorStop(0, '#16303f');
    grad.addColorStop(0.35, '#0c1b26');
    grad.addColorStop(0.75, '#060c12');
    grad.addColorStop(1, '#04070b');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 1024);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  scene.background = createBackdropTexture();
  scene.fog = new THREE.FogExp2(0x060c12, 0.03);

  const camera = new THREE.PerspectiveCamera(
    38,
    viewW / viewH,
    0.1,
    80
  );
  camera.position.set(0.3, 4.1, 7.2);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.6;

  const renderTarget = new THREE.WebGLRenderTarget(
    viewW * initialDpr,
    viewH * initialDpr,
    { type: THREE.HalfFloatType, samples: lowPower ? 2 : 4 }
  );
  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(viewW, viewH),
    0.24,
    0.5,
    0.92
  );
  if (!lowPower) composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // Film finish: vignette, fine animated grain and a whisper of lens fringing at the edges.
  const filmPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uGrain: { value: lowPower ? 0.035 : 0.045 },
      uVignette: { value: 0.9 },
      uFringe: { value: lowPower ? 0.0 : 0.0016 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime, uGrain, uVignette, uFringe;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 c = vUv - 0.5;
        float d = length(c);
        vec2 off = c * d * uFringe * 8.0;
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + off).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - off).b;
        col *= mix(1.0, smoothstep(0.85, 0.2, d), uVignette);
        float n = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 97.0) - 0.5;
        col += n * uGrain;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  composer.addPass(filmPass);

  // =========================================================================
  // 2. SURGICAL STUDIO 3-POINT LIGHTING
  // =========================================================================
  const ambientLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.65);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.9);
  keyLight.position.set(5.5, 8.0, 6.5);
  scene.add(keyLight);

  const rimLightCyan = new THREE.DirectionalLight(0x5fd4ff, 1.3);
  rimLightCyan.position.set(-6.0, 4.0, -5.5);
  scene.add(rimLightCyan);

  // Warm back light from the other side: separates the organs from the background.
  const rimLightWarm = new THREE.DirectionalLight(0xffb48a, 0.9);
  rimLightWarm.position.set(6.5, 1.5, -5.0);
  scene.add(rimLightWarm);

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
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
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

  // The outer shell is plain alpha-blended tissue drawn after everything inside
  // it, so the collecting system shows faintly through and is revealed
  // smoothly when the shell fades for treatment.
  const kidneyCortexMat = new THREE.MeshPhysicalMaterial({
    color: 0xc84d50,
    roughness: 0.34,
    bumpMap: tissueBumpTex,
    bumpScale: 0.018,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  const kidneyMesh = new THREE.Mesh(kidneyGeo, kidneyCortexMat);
  kidneyMesh.renderOrder = 2;
  kidneyGroup.add(kidneyMesh);

  const pyramidMat = new THREE.MeshPhysicalMaterial({
    color: 0x8a2230,
    emissive: 0x24040a,
    roughness: 0.36,
    bumpMap: tissueBumpTex,
    bumpScale: 0.025,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4
  });

  // Collecting system (urothelium). Only its inner far wall is drawn, like an
  // anatomical cutaway: once the kidney's shell fades for treatment you look
  // straight into the pelvis and calyces, with the stone and scope inside.
  const calyxMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6a57c,
    roughness: 0.6,
    clearcoat: 0.25,
    clearcoatRoughness: 0.5
  });
  // The near wall is a thin, glossy veil over that, which gives the pelvis its
  // rounded volume without hiding what is inside.
  const calyxVeilMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0cfa6,
    roughness: 0.3,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.BackSide
  });
  function addLining(geo) {
    kidneyGroup.add(new THREE.Mesh(geo, calyxMat));
    const veil = new THREE.Mesh(geo, calyxVeilMat);
    veil.renderOrder = 1;
    kidneyGroup.add(veil);
  }

  // A tube whose radius changes along its length (funnels, cups, sacs).
  // `radiusAt(t)` gives the radius at t = 0..1; `flatten` squashes it front to back.
  function taperedTube(points, radiusAt, { segments = 28, radial = 20, flatten = 1 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points);
    const Z = new THREE.Vector3(0, 0, 1);
    const T = new THREE.Vector3();
    const N = new THREE.Vector3();
    const B = new THREE.Vector3();
    const positions = new Float32Array((segments + 1) * (radial + 1) * 3);
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const c = curve.getPointAt(t);
      const r = radiusAt(t);
      // A fixed frame (depth axis plus the in-plane normal) keeps the surface
      // smooth; these curves lie almost flat in the kidney's plane.
      curve.getTangentAt(t, T);
      B.copy(Z).addScaledVector(T, -Z.dot(T)).normalize();
      N.crossVectors(B, T).normalize();
      for (let k = 0; k <= radial; k++) {
        const th = (k / radial) * Math.PI * 2;
        const ox = r * (Math.cos(th) * N.x + Math.sin(th) * B.x);
        const oy = r * (Math.cos(th) * N.y + Math.sin(th) * B.y);
        const oz = r * (Math.cos(th) * N.z + Math.sin(th) * B.z) * flatten;
        const idx = (i * (radial + 1) + k) * 3;
        positions[idx] = c.x + ox;
        positions[idx + 1] = c.y + oy;
        positions[idx + 2] = c.z + oz;
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let k = 0; k < radial; k++) {
        const p0 = i * (radial + 1) + k;
        const p1 = (i + 1) * (radial + 1) + k;
        // Wound so the faces point inwards: only the far inner wall is drawn.
        indices.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
  // Piecewise-linear radius profile: [[t, r], ...]
  const profile = stops => t => {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, r0] = stops[i - 1];
        const [t1, r1] = stops[i];
        const k = smoothstep(t0, t1, t);
        return r0 + (r1 - r0) * k;
      }
    }
    return stops[stops.length - 1][1];
  };
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

  // Where the ureter leaves the kidney (root coordinates), and the same point
  // in the kidney's own coordinates.
  const UPJ_ROOT = V(0.46, 3.92, 0.02);
  kidneyGroup.updateMatrixWorld(true);
  const upjLocal = kidneyGroup.worldToLocal(UPJ_ROOT.clone());

  // Renal pelvis: a roomy, slightly flattened funnel that narrows into the ureter.
  addLining(
    taperedTube(
      [V(0.22, 0.02), V(0.0, 0.03), V(-0.24, -0.04), upjLocal.clone().lerp(V(-0.24, -0.04), 0.35), upjLocal],
      profile([[0, 0.03], [0.12, 0.26], [0.42, 0.4], [0.75, 0.3], [1, 0.2]]),
      { segments: 36, radial: 28, flatten: 0.62 }
    )
  );

  // Three major calyces branch off the pelvis towards the upper, middle and
  // lower groups of pyramids. The lower one is where kidney stones are treated.
  const MAJOR = {
    upper: [V(-0.02, 0.2), V(0.08, 0.48), V(0.16, 0.74)],
    middle: [V(0.1, 0.03), V(0.22, 0.03), V(0.34, 0.02)],
    lower: [V(-0.04, -0.18), V(0.04, -0.46), V(0.13, -0.72)]
  };
  addLining(taperedTube(MAJOR.upper, profile([[0, 0.2], [0.5, 0.15], [1, 0.15]]), { flatten: 0.8 }));
  addLining(taperedTube(MAJOR.middle, profile([[0, 0.2], [1, 0.15]]), { segments: 10, flatten: 0.8 }));
  addLining(taperedTube(MAJOR.lower, profile([[0, 0.24], [0.45, 0.21], [1, 0.25]]), { flatten: 0.8 }));

  // Pyramids, each capped by a cup-shaped minor calyx that drains into the
  // nearest major calyx.
  const pyramidAngles = [-1.12, -0.76, -0.38, 0.0, 0.38, 0.76, 1.12];
  // A rounded pyramid: broad base in the cortex, blunt papilla pointing at its calyx.
  const pyramidGeo = new THREE.LatheGeometry(
    [
      [0.001, 0.27],
      [0.05, 0.25],
      [0.1, 0.17],
      [0.19, 0.02],
      [0.26, -0.12],
      [0.27, -0.21],
      [0.21, -0.28],
      [0.001, -0.3]
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    32
  );
  pyramidGeo.scale(1, 1, 0.82);
  pyramidGeo.computeVertexNormals();
  pyramidAngles.forEach((ang, idx) => {
    const zOffset = idx % 2 === 0 ? 0.1 : -0.1;
    const px = Math.cos(ang) * 0.72 - 0.08 * (ang * ang);
    const py = Math.sin(ang) * 1.18;
    const major = ang < -0.5 ? MAJOR.lower : ang > 0.5 ? MAJOR.upper : MAJOR.middle;
    const drain = major[2];

    const pMesh = new THREE.Mesh(pyramidGeo, pyramidMat);
    pMesh.position.set(px, py, zOffset);
    const dirToCalyx = new THREE.Vector3().subVectors(drain, pMesh.position).normalize();
    pMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirToCalyx);
    kidneyGroup.add(pMesh);

    const papilla = pMesh.position.clone().addScaledVector(dirToCalyx, 0.24);
    const cupRim = papilla.clone().addScaledVector(dirToCalyx, -0.14);
    const neck = papilla.clone().lerp(drain, 0.55);
    addLining(
      taperedTube([drain.clone(), neck, papilla, cupRim], profile([[0, 0.11], [0.45, 0.085], [0.8, 0.13], [1, 0.2]]), {
        segments: 18,
        radial: 16,
        flatten: 0.85
      })
    );
  });

  // The path an instrument (or a stone) takes inside the kidney: from the top
  // of the ureter, across the pelvis and down into the lower calyx.
  const renalCurve = new THREE.CatmullRomCurve3(
    [
      upjLocal.clone(),
      V(-0.34, -0.02, 0.02),
      V(-0.17, 0.07, 0.02),
      V(-0.02, 0.0, 0.02),
      V(0.03, -0.24, 0.02),
      V(0.07, -0.48, 0.02),
      V(0.1, -0.64, 0.02)
    ].map(pt => kidneyGroup.localToWorld(pt))
  );

  const arteryMat = new THREE.MeshPhysicalMaterial({
    color: 0xb82032,
    roughness: 0.42,
    clearcoat: 0.5,
    clearcoatRoughness: 0.35
  });
  const veinMat = new THREE.MeshPhysicalMaterial({
    color: 0x26588c,
    roughness: 0.44,
    clearcoat: 0.5,
    clearcoatRoughness: 0.35
  });

  const arteryGroup = new THREE.Group();
  const mainArtery = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.6, 0.61, -0.16),
    new THREE.Vector3(-1.15, 0.56, -0.14),
    new THREE.Vector3(-0.62, 0.48, -0.10),
    new THREE.Vector3(-0.22, 0.50, -0.06)
  ]);
  arteryGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(mainArtery, 28, 0.125, 16, false), arteryMat)
  );
  const supArtery = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.92, 0.52, -0.12),
    new THREE.Vector3(-0.55, 0.76, -0.06),
    new THREE.Vector3(-0.20, 0.96, 0.02)
  ]);
  arteryGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(supArtery, 20, 0.068, 12, false), arteryMat)
  );
  kidneyGroup.add(arteryGroup);

  const mainVein = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.66, 0.30, 0.18),
    new THREE.Vector3(-1.15, 0.32, 0.18),
    new THREE.Vector3(-0.58, 0.32, 0.14),
    new THREE.Vector3(-0.20, 0.32, 0.08)
  ]);
  kidneyGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(mainVein, 28, 0.165, 18, false), veinMat)
  );

  // =========================================================================
  // 5. 3D ANATOMICAL S-CURVE URETER (Real-Time Elastic 3D Mesh Deformation)
  // =========================================================================
  const ureterCurve = new THREE.CatmullRomCurve3([
    UPJ_ROOT.clone(),
    new THREE.Vector3(0.14, 3.32, 0.07),
    new THREE.Vector3(-0.04, 2.55, 0.14),
    new THREE.Vector3(-0.14, 1.35, 0.24),
    new THREE.Vector3(0.10, 0.12, 0.42),
    new THREE.Vector3(-0.20, -1.25, -0.12),
    new THREE.Vector3(-0.18, -2.55, -0.04),
    new THREE.Vector3(-0.12, -3.55, 0.06),
    new THREE.Vector3(-0.04, -4.28, 0.12)
  ]);

  // One parameter for the whole urinary tract: 0..1 runs down the ureter, and
  // negative values run back up into the kidney, ending in the lower calyx.
  const RENAL_SPAN = renalCurve.getLength() / ureterCurve.getLength();
  function tractAt(v, out = new THREE.Vector3()) {
    if (v >= 0) return out.copy(ureterCurve.getPointAt(Math.min(1, v)));
    return out.copy(renalCurve.getPointAt(Math.min(1, -v / RENAL_SPAN)));
  }

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
      r = 0.2 - smoothstep(0.0, 0.12, u) * 0.085;
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

  // A see-through tube (plain alpha blending, no refraction), so the stone,
  // scope and laser inside it are always easy to make out.
  const ureterMat = new THREE.MeshPhysicalMaterial({
    color: 0xe38886,
    roughness: 0.38,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    transparent: true,
    opacity: 0.4,
    depthWrite: false
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
  // This is the left kidney seen from the front, so the body's midline, the
  // bladder and the prostate sit to the screen-left of where its ureter ends.
  bladderGroup.position.set(-0.26, -4.95, 0.08);
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

  // The other (right) ureter, entering the far side of the bladder.
  const otherUreterStump = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.03, -3.25, -0.06),
    new THREE.Vector3(-0.74, -3.82, 0.02),
    new THREE.Vector3(-0.50, -4.28, 0.10)
  ]);
  const stumpMat = new THREE.MeshStandardMaterial({
    color: 0xc97a78,
    roughness: 0.55,
    transparent: true,
    opacity: 0.3
  });
  organRoot.add(
    new THREE.Mesh(new THREE.TubeGeometry(otherUreterStump, 24, 0.11, 16, false), stumpMat)
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
    rMesh.renderOrder = 3;
    organRoot.add(rMesh);
    spasmRings.push(rMesh);
  }

  // =========================================================================
  // 8. 3D ENDOSCOPIC INSTRUMENTS: URSL, RIRS FLEXIBLE & MINI-PCNL KEYHOLE
  // =========================================================================
  const scopeGroup = new THREE.Group();
  organRoot.add(scopeGroup);

  const scopeSheathMat = new THREE.MeshPhysicalMaterial({
    color: 0x8fa3b8,
    emissive: 0x1c2a38,
    metalness: 0.55,
    roughness: 0.35
  });
  let scopeMesh = null;

  const scopeTipBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.09, 20),
    new THREE.MeshStandardMaterial({ color: 0xaab4bf, metalness: 0.4, roughness: 0.5 })
  );
  scopeGroup.add(scopeTipBezel);

  const scopeHeadlamp = new THREE.PointLight(0xe0f2fe, 0, 2.2, 1.5);
  scopeGroup.add(scopeHeadlamp);

  // The laser fibre: a hair-thin glass fibre that slides out of the scope and
  // touches the stone. It does not glow; a real holmium or thulium laser is
  // invisible, so the only light is a small steady aiming dot at the fibre tip.
  const laserBeamGeo = new THREE.CylinderGeometry(0.009, 0.009, 1.0, 12);
  laserBeamGeo.translate(0, 0.5, 0);
  const laserBeamMat = new THREE.MeshStandardMaterial({
    color: 0x9fc4cf,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0
  });
  const laserBeamMesh = new THREE.Mesh(laserBeamGeo, laserBeamMat);
  laserBeamMesh.renderOrder = 3;
  organRoot.add(laserBeamMesh);

  const plasmaFlashMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x3fae6a, transparent: true, opacity: 0 })
  );
  plasmaFlashMesh.renderOrder = 3;
  organRoot.add(plasmaFlashMesh);

  // The PCNL sheath enters through the back of the kidney's lower pole and
  // stops just short of the stone in the lower calyx.
  const pcnlTip = tractAt(-RENAL_SPAN).add(new THREE.Vector3(0.3, -0.1, 0.06));
  const pcnlCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.0, 2.75, 0.42),
    new THREE.Vector3(2.1, 3.02, 0.26),
    pcnlTip.clone()
  ]);
  // Brushed steel, kept matte so it never blows out to white under the key light.
  const pcnlSheathMat = new THREE.MeshStandardMaterial({
    color: 0x7f8c99,
    metalness: 0.35,
    roughness: 0.6
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
      new THREE.Vector3(-0.26, -6.75, 0.08),
      new THREE.Vector3(-0.26, -5.85, 0.08),
      new THREE.Vector3(-0.16, -5.05, 0.10),
      new THREE.Vector3(-0.04, -4.28, 0.12)
    ];

    const clampedTip = Math.max(-RENAL_SPAN, Math.min(0.99, tipU));
    if (tipU < 1.0) {
      const ureterEnd = Math.max(0, clampedTip);
      const steps = ureterEnd < 0.35 ? 30 : 18;
      for (let s = 1; s <= steps; s++) {
        pts.push(tractAt(1.0 - (1.0 - ureterEnd) * (s / steps)));
      }
      // Inside the kidney the scope bends tightly, so sample it more finely.
      if (clampedTip < 0) {
        const renalSteps = Math.max(2, Math.ceil((-clampedTip / RENAL_SPAN) * 18));
        for (let s = 1; s <= renalSteps; s++) pts.push(tractAt(clampedTip * (s / renalSteps)));
      }
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 110, 0.044, 14, false);
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

  const DUST_COUNT = lowPower ? 300 : 900;
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
    size: 0.06,
    map: createSoftParticleSprite(),
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.renderOrder = 3;
  organRoot.add(dustPoints);

  const bokehGeo = new THREE.BufferGeometry();
  const bokehCount = lowPower ? 40 : 90;
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
  // The journey value (0 hero, 1 symptoms, 2 treatment, 3 prostate) comes from
  // the same helper as the chapter rail, so the scene always matches the text.
  function onScroll() {
    appState.scrollTarget = journeyValue();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function onResize() {
    const { w, h } = viewSize();
    onScroll();
    if (w === viewW && h === viewH) return;
    viewW = w;
    viewH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(container);
  window.addEventListener('resize', onResize, { passive: true });



  // =========================================================================
  // 12. MAIN 60FPS ANIMATION & 3D CHOREOGRAPHY LOOP
  // =========================================================================
  const dummyObj = new THREE.Object3D();
  const camTargetLook = new THREE.Vector3();
  const clock = new THREE.Timer();

  // Tissue finish: keep the wet clearcoat, add a faint deep-red sheen at grazing
  // angles for a soft-tissue look. Phones skip the costly transmission pass.
  kidneyCortexMat.color.setHex(0xb8343f);
  [kidneyCortexMat, ureterMat, bladderMat, prostateMat, pyramidMat].forEach(m => {
    m.sheen = 0.3;
    m.sheenColor = new THREE.Color(0xff5a4a);
    m.sheenRoughness = 0.55;
    m.clearcoatRoughness = Math.max(m.clearcoatRoughness, 0.14);
    if (lowPower && m.transmission > 0) {
      m.transmission = 0;
      m.opacity = Math.max(m.opacity, 0.94);
    }
  });

  let running = false;
  let rafId = 0;
  let firstFrameSent = false;

  // -------------------------------------------------------------------------
  // Choreography. Everything below is a continuous function of the journey
  // value j (0 hero, 1 symptoms, 2 treatment, 3 prostate) plus a few eased
  // "mix" values for the pickers, so nothing in the scene ever cuts.
  // -------------------------------------------------------------------------
  const SITE_KIDNEY = -RENAL_SPAN; // lower calyx: where the stone forms, and where RIRS or PCNL treats it
  const SITE_ORIGIN = SITE_KIDNEY;
  const SITE_URETER = 0.22; // stuck in the upper ureter (treated by URSL)
  const PROSTATE_FOCUS = new THREE.Vector3(-0.26, -5.45, 0);
  const PCNL_TIP = pcnlTip;
  const UP = new THREE.Vector3(0, 1, 0);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = x => Math.max(0, Math.min(1, x));

  const mix = { renal: 0, scope: 1, pcnl: 0, mm: Math.min(16, appState.stoneSizeMm) };
  const camPosSmooth = new THREE.Vector3();
  const camLookSmooth = new THREE.Vector3();
  const camPosGoal = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const tractPt = new THREE.Vector3();
  const beamDir = new THREE.Vector3();
  const dustTmp = new THREE.Vector3();
  let primed = false;
  let lastElapsed = 0;
  let frameCount = 0;
  const kidneyBaseOpacity = kidneyCortexMat.opacity;

  // A point that travels down the urinary tract: along the ureter, then into
  // the bladder and on to the prostate. Used for the camera's last leg.
  function tractPoint(w, out) {
    if (w < 0.8) return out.copy(ureterCurve.getPointAt(lerp(0.2, 1, w / 0.8)));
    return out.copy(ureterCurve.getPointAt(1)).lerp(PROSTATE_FOCUS, smoothstep(0.8, 1, w));
  }

  function animate() {
    if (!running) return;
    rafId = requestAnimationFrame(animate);

    clock.update();
    const elapsed = clock.getElapsed();
    const dt = Math.min(0.1, Math.max(0, elapsed - lastElapsed));
    lastElapsed = elapsed;
    filmPass.uniforms.uTime.value = elapsed;

    // Layout can shift after fonts load, so refresh the target now and then.
    if (frameCount++ % 30 === 0) onScroll();
    if (!primed) appState.scrollCurrent = appState.scrollTarget;
    appState.scrollCurrent += (appState.scrollTarget - appState.scrollCurrent) * (1 - Math.exp(-dt * 5));
    const j = appState.scrollCurrent;

    const ease = 1 - Math.exp(-dt * 3.2);
    mix.renal += ((appState.modality === 'ursl' ? 0 : 1) - mix.renal) * (1 - Math.exp(-dt * 2.4));
    mix.scope += ((appState.modality === 'pcnl' ? 0 : 1) - mix.scope) * ease;
    mix.pcnl += ((appState.modality === 'pcnl' ? 1 : 0) - mix.pcnl) * ease;
    mix.mm += (Math.min(16, appState.stoneSizeMm) - mix.mm) * ease;
    const renalMix = mix.renal * mix.renal * (3 - 2 * mix.renal);

    // Timeline.
    const travel = smoothstep(0.35, 1.35, j);
    const symptomPulse = smoothstep(0.45, 0.9, j) * (1 - smoothstep(1.45, 1.9, j));
    const treat = smoothstep(1.4, 1.85, j) * (1 - smoothstep(2.5, 2.85, j));
    const laserOn = smoothstep(1.85, 1.97, j) * (1 - smoothstep(2.42, 2.52, j));
    const erosion = smoothstep(1.98, 2.5, j);
    const dustProgress = smoothstep(1.96, 2.6, j);
    const flushProgress = clamp01((j - 2.45) / 0.55);
    const prostateFocus = smoothstep(2.6, 3.0, j);

    const heartWave = Math.pow(Math.max(0, Math.sin(elapsed * 3.55)), 4);
    arteryGroup.scale.setScalar(1 + heartWave * 0.025);

    appState.userYawCurrent += (appState.userYawTarget - appState.userYawCurrent) * 0.10;
    appState.userPitchCurrent += (appState.userPitchTarget - appState.userPitchCurrent) * 0.10;
    organRoot.rotation.y = Math.sin(j * 1.25) * 0.14 * (1 - treat) + appState.userYawCurrent;
    organRoot.rotation.x = appState.userPitchCurrent;

    // Stone. On a procedure switch the scope glides along the tract (pathU)
    // while the stone shrinks away at its old site and grows back at the new
    // one. Both sites sit inside the same camera frame.
    const stoneUFor = r => lerp(SITE_ORIGIN, lerp(SITE_URETER, SITE_KIDNEY, r), travel);
    const pathU = stoneUFor(renalMix);
    const stoneU = stoneUFor(renalMix < 0.5 ? 0 : 1);
    const swapScale = Math.min(1, Math.abs(renalMix * 2 - 1) * 1.6);
    const stoneCenter = tractAt(stoneU);
    const baseStoneRadius = 0.138 + (mix.mm - 4) * 0.0095;
    const intactScale = Math.max(0, 1 - erosion * 0.95) * swapScale;
    const activeStoneRadius = baseStoneRadius * intactScale;

    if (intactScale > 0.03) {
      stoneMesh.visible = true;
      stoneMesh.position.copy(stoneCenter);
      stoneMesh.scale.setScalar(activeStoneRadius);
      stoneMesh.rotation.set(j * 2.6 + elapsed * 0.3, j * 3.4 + elapsed * 0.4, j * 1.8);
      stoneMat.emissiveIntensity = 0.4 + symptomPulse * 0.25 - laserOn * 0.15;
      stoneLight.position.copy(stoneCenter);
      stoneLight.position.z += 0.3;
      stoneLight.intensity = (0.3 + symptomPulse * 0.45) * intactScale;
    } else {
      stoneMesh.visible = false;
      stoneLight.intensity = 0;
    }

    spasmRings.forEach((ring, idx) => {
      if (symptomPulse > 0.04 && swapScale > 0.5) {
        ring.visible = true;
        const phase = (elapsed * 0.75 + idx * 0.33) % 1;
        ring.position.copy(stoneCenter);
        ring.scale.setScalar(0.18 + phase * 0.58);
        ring.rotation.x = Math.PI * 0.42;
        ring.material.opacity = (1 - phase) * 0.45 * symptomPulse * swapScale;
      } else {
        ring.visible = false;
      }
    });

    updateUreterDeformation(stoneU, activeStoneRadius, intactScale, elapsed);

    // Fade the kidney's outer shell while treating inside it, so the stone and
    // instruments stay visible.
    kidneyCortexMat.opacity = kidneyBaseOpacity - (kidneyBaseOpacity - 0.3) * treat * renalMix;

    // Instruments.
    laserBeamMesh.visible = false;
    plasmaFlashMesh.visible = false;
    scopeHeadlamp.intensity = 0;

    const canFire = laserOn > 0.05 && intactScale > 0.04 && swapScale > 0.9;
    let laserFrom = null;

    const scopeReach = treat * mix.scope;
    if (scopeReach > 0.01) {
      const desiredTipU = Math.min(0.99, pathU + lerp(0.05, 0.03, renalMix));
      const scopeInfo = rebuildScopeTube(1.07 - (1.07 - desiredTipU) * scopeReach);
      if (scopeInfo && scopeReach > 0.9) {
        scopeHeadlamp.intensity = 0.2;
        if (appState.modality !== 'pcnl') laserFrom = scopeInfo.tipPos;
      }
    } else {
      rebuildScopeTube(1.1);
    }

    const pcnlReach = treat * mix.pcnl;
    pcnlSheathMesh.visible = pcnlReach > 0.03;
    pcnlSheathMesh.position.x = (1 - pcnlReach) * 1.8;
    if (pcnlReach > 0.9 && appState.modality === 'pcnl') laserFrom = PCNL_TIP;

    if (laserFrom && canFire) {
      // The fibre reaches from the instrument to the stone's surface and follows
      // the surface in as the stone is dusted away.
      beamDir.subVectors(stoneCenter, laserFrom);
      const dist = Math.max(0.02, beamDir.length() - activeStoneRadius * 0.82);
      beamDir.normalize();
      laserBeamMesh.visible = true;
      laserBeamMesh.position.copy(laserFrom);
      laserBeamMesh.scale.set(1, dist, 1);
      laserBeamMesh.quaternion.setFromUnitVectors(UP, beamDir);
      laserBeamMat.opacity = 0.95 * laserOn;

      plasmaFlashMesh.visible = true;
      plasmaFlashMesh.position.copy(laserFrom).addScaledVector(beamDir, dist);
      plasmaFlashMesh.material.opacity = 0.85 * laserOn;
    }

    // Fragments and dust wash down the tract after treatment.
    const burstOriginU = lerp(SITE_URETER, SITE_KIDNEY, renalMix);
    const spanScale = lerp(0.6, 0.72, renalMix);
    const showBurst = dustProgress > 0.01;
    // Fragments for a ureter stone; a kidney stone is dusted instead (fine particles only).
    shardInstanced.visible = showBurst && flushProgress < 0.55 && renalMix < 0.5;
    if (shardInstanced.visible) {
      for (let i = 0; i < SHARD_COUNT; i++) {
        const s = shardSeeds[i];
        const localT = Math.max(0, (dustProgress - s.delay) / (1 - s.delay));
        const shrink = Math.max(0, 1 - localT * 1.15);
        if (localT <= 0 || shrink <= 0.01) {
          dummyObj.scale.setScalar(0.0001);
        } else {
          const driftU = Math.min(0.99, burstOriginU + localT * 0.14);
          dummyObj.position.copy(tractAt(driftU)).addScaledVector(s.dir, localT * 0.1);
          dummyObj.rotation.set(elapsed * s.rotSpeed.x, elapsed * s.rotSpeed.y, elapsed * s.rotSpeed.z);
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
        // While the laser works, dust from a kidney stone swirls inside the calyx and
        // pelvis; it only drains down the ureter on the flush.
        const dustTravel =
          (dustProgress * lerp(0.4, 0.16, renalMix) + flushProgress * 1.3) * m.speed - m.offset * lerp(0.42, 0.12, renalMix);

        if (dustTravel <= 0) {
          dustPos[i * 3 + 1] = -999;
          continue;
        }

        const uTrack = burstOriginU + dustTravel * spanScale;
        if (uTrack < 0) {
          tractAt(uTrack, dustTmp);
          const ang = m.angle + elapsed * 1.6 + uTrack * 30.0;
          const rad = 0.15 * m.radial;
          dustPos[i * 3] = dustTmp.x + Math.cos(ang) * rad;
          dustPos[i * 3 + 1] = dustTmp.y + Math.sin(ang * 1.3 + m.angle) * rad * 0.8;
          dustPos[i * 3 + 2] = dustTmp.z + Math.sin(ang) * rad * 0.6;
        } else if (uTrack <= 1.0) {
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
          dustPos[i * 3] = -0.26 + Math.cos(swirlAng) * funnelR;
          dustPos[i * 3 + 1] = -4.32 - bT * 1.75;
          dustPos[i * 3 + 2] = 0.08 + Math.sin(swirlAng) * funnelR * 0.72;
        }

        const coolShift = Math.min(1, Math.max(0, (uTrack - 0.92) * 1.8));
        if (m.warm) {
          dustColors[i * 3] = 0.74 - coolShift * 0.15;
          dustColors[i * 3 + 1] = 0.44 + coolShift * 0.1;
          dustColors[i * 3 + 2] = 0.12 + coolShift * 0.3;
        } else {
          dustColors[i * 3] = 0.6;
          dustColors[i * 3 + 1] = 0.48;
          dustColors[i * 3 + 2] = 0.3;
        }
      }
      pAttr.needsUpdate = true;
      cAttr.needsUpdate = true;
    }

    bladderFluidMesh.position.y = Math.sin(elapsed * 1.9) * 0.025;
    bladderFluidMesh.rotation.y = elapsed * 0.35;
    prostateMat.emissive.setHex(prostateFocus > 0.2 ? 0x164e63 : 0x24080e);
    prostateMat.emissiveIntensity = 0.35 + prostateFocus * (0.45 + 0.2 * Math.sin(elapsed * 3.0));

    // Camera: one continuous path. Kidney (hero), kidney with upper ureter
    // (symptoms and treatment share almost the same frame, and it does not
    // change with the procedure), then down the ureter to bladder and prostate.
    const e01 = smoothstep(0, 1, j);
    const e12 = smoothstep(1, 2, j);
    const e23 = smoothstep(2.4, 3, j);
    focus.set(lerp(lerp(0.65, 0.8, e01), 0.95, e12), lerp(lerp(4.15, 3.5, e01), 3.1, e12), 0);
    if (e23 > 0) focus.lerp(tractPoint(e23, tractPt), smoothstep(0, 0.3, e23));
    const camDist = lerp(lerp(lerp(6.2, 6.6, e01), 7.0, e12), 5.9, e23) - Math.sin(e23 * Math.PI) * 0.5;
    const camElev = lerp(lerp(lerp(0.35, 0.25, e01), 0.15, e12), 0.18, e23);
    const sway = Math.sin(j * 1.25) * 0.3 * (1 - treat);

    if (window.innerWidth >= 900) {
      const desktopShiftX = -1.65 * (camDist / 5.8);
      camPosGoal.set(focus.x + desktopShiftX + sway, focus.y + camElev, camDist);
      camTargetLook.set(focus.x + desktopShiftX, focus.y, 0);
    } else {
      // Phones and tablets: the canvas is the panel pinned above the text, so
      // the anatomy sits in the middle of it. Narrow panels pull back a little.
      // The look point sits a little high to keep the anatomy clear of the header.
      const fit = Math.max(1.08, 1.2 / camera.aspect);
      const lift = 0.3 * (camDist / 6);
      camPosGoal.set(focus.x + sway * 0.5, focus.y + lift + camElev, camDist * fit);
      camTargetLook.set(focus.x, focus.y + lift, 0);
    }
    if (!primed) {
      camPosSmooth.copy(camPosGoal);
      camLookSmooth.copy(camTargetLook);
      primed = true;
    } else {
      const k = 1 - Math.exp(-dt * 6);
      camPosSmooth.lerp(camPosGoal, k);
      camLookSmooth.lerp(camTargetLook, k);
    }
    camera.position.copy(camPosSmooth);
    camera.lookAt(camLookSmooth);

    composer.render();
    if (!firstFrameSent) {
      firstFrameSent = true;
      if (onFirstFrame) onFirstFrame();
    }
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(animate);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  start();

  return {
    start,
    stop,
    setStoneSize(mm) {
      appState.stoneSizeMm = mm;
    },
    setModality(mod) {
      appState.modality = mod;
    }
  };
}
