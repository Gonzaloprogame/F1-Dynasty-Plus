// Retransmisión 3D de la carrera con three.js (MIT). Módulo ES que se carga solo al activar la vista 3D.
// El circuito se construye con la geometría de realtracks.js (datos reales o trazado generado) y los coches
// son un diseño propio hecho con primitivas.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const RUNOFF = 12;           // m de escapatoria a cada lado
const BARRIER_GAP = 2;       // m entre escapatoria y barrera

// ---------- texturas generadas ----------
function canvasTex(w, h, draw, rep) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}
function speckle(ctx, w, h, base, n, amp) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const v = Math.random() < 0.5 ? 0 : 255; ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * amp})`; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
}
const TEX = () => ({
  asphalt: canvasTex(256, 256, (c, w, h) => speckle(c, w, h, '#6a6f77', 7000, 0.1)),
  grass: canvasTex(512, 512, (c, w, h) => {
    speckle(c, w, h, '#4d7a34', 14000, 0.12);
    for (let i = 0; i < 8; i += 2) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, i * h / 8, w, h / 8); }
  }),
  white: canvasTex(128, 128, (c, w, h) => speckle(c, w, h, '#ffffff', 2500, 0.18)),
  checker: canvasTex(64, 16, (c) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 4, y * 4, 4, 4); } }),
  crowd: canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = '#2a2d33'; c.fillRect(0, 0, w, h);
    const cols = ['#e63946', '#f1faee', '#ffd166', '#118ab2', '#06d6a0', '#ef476f', '#ff9f1c', '#8d99ae'];
    for (let i = 0; i < 2600; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [4, 1]),
  fence: canvasTex(64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(210,215,220,0.9)'; c.lineWidth = 1;
    for (let i = -h; i < w; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); }
  }),
  soft: canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }),
  sky: (wet) => {
    const t = canvasTex(1024, 512, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      if (wet) { g.addColorStop(0, '#4b5460'); g.addColorStop(0.47, '#959ea8'); g.addColorStop(0.5, '#8a929b'); g.addColorStop(1, '#7d858e'); }
      else { g.addColorStop(0, '#2b6fc0'); g.addColorStop(0.28, '#5f9fdc'); g.addColorStop(0.47, '#d3e6f5'); g.addColorStop(0.5, '#b8cbd8'); g.addColorStop(1, '#a8bac8'); }
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      if (!wet) {
        const sx = w * 0.62, sy = h * 0.22, sg = c.createRadialGradient(sx, sy, 0, sx, sy, 150);
        sg.addColorStop(0, 'rgba(255,252,240,1)'); sg.addColorStop(0.05, 'rgba(255,248,228,0.95)'); sg.addColorStop(0.22, 'rgba(255,240,205,0.3)'); sg.addColorStop(1, 'rgba(255,240,205,0)');
        c.fillStyle = sg; c.fillRect(0, 0, w, h);
      }
      const n = wet ? 160 : 55;
      for (let i = 0; i < n; i++) {
        const x = Math.random() * w, y = h * (0.1 + Math.random() * 0.34), r = 18 + Math.random() * (wet ? 90 : 55);
        const cg = c.createRadialGradient(x, y, 0, x, y, r * 2);
        cg.addColorStop(0, wet ? 'rgba(105,113,124,0.45)' : 'rgba(255,255,255,0.55)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = cg; c.beginPath(); c.ellipse(x, y, r * 2.4, r * 0.75, 0, 0, Math.PI * 2); c.fill();
      }
    });
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; return t;
  },
});

// ---------- utilidades de geometría ----------
const W = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
function mergeGeoms(list) {
  const parts = list.map(g => g.index ? g.toNonIndexed() : g);
  const total = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
function placed(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
  return geo.applyMatrix4(m);
}
// Banda a lo largo de la línea central entre dos desplazamientos laterales (positivo = izquierda)
function band(C, latA, latB, h, { vScale = 8, colorFn = null } = {}) {
  const n = C.n, pos = [], uv = [], col = [], idx = [];
  for (let k = 0; k <= n; k++) {
    const i = k % n, nx = -C.ty[i], ny = C.tx[i];
    const a = latA(i), b = latB(i);
    pos.push(C.x[i] + nx * a, h, -(C.y[i] + ny * a), C.x[i] + nx * b, h, -(C.y[i] + ny * b));
    const v = (k === n ? C.length : C.s[i]) / vScale;
    uv.push(0, v, 1, v);
    if (colorFn) { const c = colorFn(i); col.push(c[0], c[1], c[2], c[0], c[1], c[2]); }
    if (k < n) { const p = k * 2; idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // Asegura normales hacia arriba en bandas horizontales
  const nrm = g.attributes.normal;
  for (let i = 0; i < nrm.count; i++) if (nrm.getY(i) < 0) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  return g;
}
// Muro vertical a un desplazamiento lateral
function wall(C, lat, h0, h1, colorFn, skip = null) {
  const n = C.n, pos = [], col = [], uv = [], idx = [];
  for (let k = 0; k <= n; k++) {
    const i = k % n, nx = -C.ty[i], ny = C.tx[i], L = lat(i);
    const x = C.x[i] + nx * L, z = -(C.y[i] + ny * L);
    pos.push(x, h0, z, x, skip && skip(i) ? h0 : h1, z);
    const c = colorFn(i); col.push(...c, ...c);
    const u = (k === n ? C.length : C.s[i]) / 4; uv.push(u, 0, u, 1);
    if (k < n) { const p = k * 2; idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// Tira lateral solo en los tramos donde test(i) es cierto (pianos, calle de boxes…)
function strip(C, latA, latB, h, test, colorFn) {
  const pos = [], col = [], n = C.n;
  for (let i = 0; i < n; i++) {
    if (!test(i)) continue;
    const j = (i + 1) % n, c = colorFn ? colorFn(i) : null;
    const P = (k, lat) => [C.x[k] - C.ty[k] * lat, h, -(C.y[k] + C.tx[k] * lat)];
    const q = [P(i, latA(i)), P(i, latB(i)), P(j, latA(j)), P(j, latB(j))];
    for (const v of [q[0], q[1], q[2], q[1], q[3], q[2]]) { pos.push(...v); if (c) col.push(...c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return g;
}
function signTex(text) {
  return canvasTex(128, 96, (c, w, h) => {
    c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b2a8f'; c.fillRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#fff'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 3);
  });
}

// ---------- coche (diseño propio con primitivas; morro hacia +X) ----------
let BLOB = null;
function buildCar(color, { helmet = '#f4f4f4', accent = '#f2f2f2', safety = false } = {}) {
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.35 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.55, metalness: 0.2 });
  const acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.1 });
  const B = (x, y, z, sx, sy, sz, rz = 0) => placed(new THREE.BoxGeometry(sx, sy, sz), x, y, z, 0, 0, rz);
  const bodyG = mergeGeoms([
    B(0.2, 0.36, 0, 2.6, 0.42, 0.72),
    placed(new THREE.CylinderGeometry(0.08, 0.26, 1.5, 10), 2.15, 0.3, 0, 0, 0, -Math.PI / 2),
    B(-0.1, 0.32, 0.55, 1.5, 0.38, 0.42), B(-0.1, 0.32, -0.55, 1.5, 0.38, 0.42),
    B(-0.9, 0.52, 0, 1.6, 0.5, 0.5), B(-0.25, 0.86, 0, 0.35, 0.3, 0.3), B(-1.25, 0.86, 0, 1.2, 0.26, 0.02),
    B(2.75, 0.18, 0.93, 0.5, 0.22, 0.03), B(2.75, 0.18, -0.93, 0.5, 0.22, 0.03),
    B(-2.15, 0.75, 0.53, 0.7, 0.58, 0.03), B(-2.15, 0.75, -0.53, 0.7, 0.58, 0.03),
  ]);
  const carbonG = mergeGeoms([
    B(0, 0.07, 0, 4.8, 0.06, 1.7), B(2.75, 0.12, 0, 0.45, 0.04, 1.85), B(-2.2, 0.92, 0, 0.45, 0.05, 1.05),
    B(-2.35, 0.18, 0, 0.5, 0.18, 1.0), B(0.55, 0.66, 0, 0.42, 0.03, 0.05, -0.5),
    placed(new THREE.TorusGeometry(0.33, 0.035, 6, 18, Math.PI), 0.15, 0.72, 0, Math.PI / 2, 0, -Math.PI / 2),
  ]);
  const accG = mergeGeoms([B(2.68, 0.2, 0, 0.3, 0.03, 1.78), B(-2.12, 1.02, 0, 0.3, 0.04, 1.05), B(0.9, 0.58, 0, 0.6, 0.02, 0.5)]);
  const g = new THREE.Group();
  for (const [geo, mat] of [[bodyG, body], [carbonG, carbon], [accG, acc]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
  const hel = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), new THREE.MeshStandardMaterial({ color: helmet, roughness: 0.25, metalness: 0.2 }));
  hel.position.set(0.0, 0.66, 0); g.add(hel);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.92 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x000000 });
  const wheels = [];
  for (const [x, r, w, z] of [[1.85, 0.36, 0.36, 0.82], [1.85, 0.36, 0.36, -0.82], [-1.55, 0.37, 0.42, 0.8], [-1.55, 0.37, 0.42, -0.8]]) {
    const hub = new THREE.Group(); hub.position.set(x, r, z);
    const tyre = new THREE.Mesh(placed(new THREE.CylinderGeometry(r, r, w, 20), 0, 0, 0, Math.PI / 2, 0, 0), rubber); tyre.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, 0.028, 6, 24), stripe);
    ring.position.z = Math.sign(z) * (w / 2 + 0.004);
    const spokes = new THREE.Mesh(placed(new THREE.BoxGeometry(r * 1.2, 0.05, 0.02), 0, 0, Math.sign(z) * (w / 2 + 0.006)), carbon);
    hub.add(tyre, ring, spokes); g.add(hub); wheels.push(hub);
  }
  const rain = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 0 }));
  rain.position.set(-2.62, 0.42, 0); g.add(rain);
  let bar = null;
  if (safety) {
    bar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.9), new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0xffa000, emissiveIntensity: 2 }));
    bar.position.set(0.2, 1.0, 0); g.add(bar);
  }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, alphaMap: BLOB }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.035; g.add(blob);
  return { group: g, wheels, stripe, rain, bar, body };
}

// ---------- vista ----------
export function createView3D(container, { geo, cars, onFollow, onCamera }) {
  const C = geo.center, L = geo.line;
  const T = TEX();
  BLOB = BLOB || canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.6, '#999'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  BLOB.colorSpace = THREE.NoColorSpace;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement; canvas.className = 'v3d-canvas';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 6000);
  const skyDry = T.sky(false), skyWet = T.sky(true);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 24, 16), new THREE.MeshBasicMaterial({ map: skyDry, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(sky);
  scene.fog = new THREE.Fog(0xbfd6ea, 400, 3200);
  const hemi = new THREE.HemisphereLight(0xdcebff, 0x3d5228, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 300 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ map: skyDry, side: THREE.BackSide })));
  scene.environment = pmrem.fromScene(envScene).texture;

  // Límites del circuito
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < C.n; i++) { minX = Math.min(minX, C.x[i]); maxX = Math.max(maxX, C.x[i]); minY = Math.min(minY, C.y[i]); maxY = Math.max(maxY, C.y[i]); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, span = Math.max(maxX - minX, maxY - minY) + 1600;

  // Césped
  T.grass.repeat.set(span / 40, span / 40);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(span, span), new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, 0, -cy); ground.receiveShadow = true; scene.add(ground);

  const off = f => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide });
  const wl = i => C.wl[i], wr = i => C.wr[i];
  const kAbs = i => Math.abs(C.k[i]);
  // Escapatorias: grava en las curvas cerradas, asfalto pintado en el resto
  const runCol = i => kAbs(i) > 0.012 ? [0.78, 0.69, 0.52] : [0.42, 0.46, 0.5];
  const runMat = new THREE.MeshStandardMaterial({ map: T.white, vertexColors: true, roughness: 0.95, ...off(-1) });
  scene.add(new THREE.Mesh(band(C, wl, i => wl(i) + RUNOFF, 0.01, { colorFn: runCol }), runMat));
  scene.add(new THREE.Mesh(band(C, i => -wr(i) - RUNOFF, i => -wr(i), 0.01, { colorFn: runCol }), runMat));
  // Asfalto
  const asphalt = new THREE.MeshStandardMaterial({ map: T.asphalt, color: 0xffffff, roughness: 0.9, metalness: 0, envMapIntensity: 0.3, ...off(-2) });
  const road = new THREE.Mesh(band(C, i => -wr(i), wl, 0.02), asphalt); road.receiveShadow = true; scene.add(road);
  // Líneas blancas de borde
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6, ...off(-3) });
  scene.add(new THREE.Mesh(band(C, i => wl(i) - 0.55, i => wl(i) - 0.3, 0.03), lineMat));
  scene.add(new THREE.Mesh(band(C, i => -wr(i) + 0.3, i => -wr(i) + 0.55, 0.03), lineMat));
  // Pianos en las curvas
  {
    const pos = [], col = [], n = C.n;
    const add = (i, a, b) => {
      const j = (i + 1) % n, red = Math.floor(C.s[i] / 3) % 2 ? [0.85, 0.1, 0.1] : [0.95, 0.95, 0.95];
      const P = (k, lat) => [C.x[k] - C.ty[k] * lat, 0.035, -(C.y[k] + C.tx[k] * lat)];
      const q = [P(i, a(i)), P(i, b(i)), P(j, a(j)), P(j, b(j))];
      for (const v of [q[0], q[1], q[2], q[1], q[3], q[2]]) { pos.push(...v); col.push(...red); }
    };
    for (let i = 0; i < n; i++) {
      if (kAbs(i) < 0.0065) continue;
      add(i, wl, i => wl(i) + 1.4);
      add(i, i => -wr(i) - 1.4, i => -wr(i));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const nrm = g.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, ...off(-3) })));
  }
  // Calle de boxes (lado derecho de la recta de meta) y huecos de entrada/salida en la barrera
  const pitRel = d => { let r = ((d % C.length) + C.length) % C.length; if (r > C.length / 2) r -= C.length; return r; };
  const rOf = i => pitRel(C.s[i]);
  const wallLat = i => wr(i) + RUNOFF + BARRIER_GAP;
  const inGap = i => { const r = rOf(i); return (r > PIT_IN - 25 && r < PIT_IN + 70) || (r > PIT_OUT - 70 && r < PIT_OUT + 25); };
  const inPitZone = i => { const r = rOf(i); return r > PIT_IN - 25 && r < PIT_OUT + 25; };
  const pitAsphalt = new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.9, ...off(-2) });
  scene.add(new THREE.Mesh(strip(C, i => -wallLat(i) - 1, i => -wallLat(i) - 10, 0.025, inPitZone), pitAsphalt));
  scene.add(new THREE.Mesh(strip(C, i => -wr(i), i => -wallLat(i) - 1, 0.026, inGap), pitAsphalt));
  scene.add(new THREE.Mesh(strip(C, i => -wallLat(i) - 5.4, i => -wallLat(i) - 5.6, 0.03, i => inPitZone(i) && Math.floor(C.s[i] / 4) % 2 === 0), lineMat));
  // Goma en la trazada
  scene.add(new THREE.Mesh(band(L, () => 1.1, () => -1.1, 0.028), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false, ...off(-3) })));

  // Barreras y vallas
  const barCol = i => Math.floor(C.s[i] / 12) % 2 ? [0.92, 0.92, 0.92] : [0.12, 0.35, 0.78];
  const barMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
  const fenceMat = new THREE.MeshBasicMaterial({ map: T.fence, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.3 });
  for (const [lat, skip] of [[i => wl(i) + RUNOFF + BARRIER_GAP, null], [i => -wallLat(i), inGap]]) {
    scene.add(new THREE.Mesh(wall(C, lat, 0, 1.1, barCol, skip), barMat));
    scene.add(new THREE.Mesh(wall(C, lat, 1.1, 4, () => [1, 1, 1], skip), fenceMat));
  }
  // Garajes con el color de cada equipo y edificio del paddock detrás
  const teams = [...new Map(cars.map(c => [c.teamId, c.color])).entries()];
  const slotOf = {};
  {
    const wallM = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.9 });
    const span = (PIT_OUT - 70) - (PIT_IN + 70);
    teams.forEach(([tid, color], k) => {
      const r = PIT_IN + 70 + (teams.length > 1 ? k * span / (teams.length - 1) : span / 2);
      slotOf[tid] = r;
      const d = (r + C.length) % C.length, i = segIndex(C, d);
      const p = pointOn(C, d, -(wallLat(i) + 15.5)), th = Math.atan2(p.ty, p.tx);
      const gar = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(Math.max(8, span / teams.length - 1.5), 5.5, 9), wallM); box.position.y = 2.75; box.castShadow = true;
      const door = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(6, span / teams.length - 4), 3.6), dark); door.position.set(0, 1.8, 4.52);
      const band = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(8, span / teams.length - 1.5), 1.2), new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 }));
      band.position.set(0, 4.6, 4.53);
      gar.add(box, door, band); gar.position.set(p.x, 0, -p.y); gar.rotation.y = th + Math.PI; scene.add(gar);
    });
    const midR = (PIT_IN + PIT_OUT) / 2, d = (midR + C.length) % C.length, i = segIndex(C, d);
    const p = pointOn(C, d, -(wallLat(i) + 28)), th = Math.atan2(p.ty, p.tx);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(span + 60, 12, 16), new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.6, metalness: 0.2 }));
    pad.position.set(p.x, 6, -p.y); pad.rotation.y = th; pad.castShadow = true; scene.add(pad);
  }
  // Carteles de frenada (300/200/100 m) antes de las frenadas fuertes, según el perfil de velocidad
  {
    const V = geo.v, n = L.n, signs = [];
    for (let i = 0; i < n; i++) {
      const v = V[i];
      if (!(v <= V[(i - 1 + n) % n] && v < V[(i + 1) % n])) continue;
      let j = i, peak = v;
      for (let s = 0; s < n && L.s[i] - L.s[j] + (j > i ? L.length : 0) < 600; s++) { j = (j - 1 + n) % n; if (V[j] > peak) peak = V[j]; else if (V[j] < peak - 1) break; }
      if (peak - v < 22) continue;
      let bs = (L.s[j] + L.length) % L.length;
      if (signs.some(x => Math.abs(pitRel(x - bs)) < 400)) continue;
      signs.push(bs);
    }
    const tex = { 300: signTex('300'), 200: signTex('200'), 100: signTex('100') }, post = new THREE.MeshStandardMaterial({ color: 0x9aa0a8 });
    for (const bs of signs.slice(0, 14)) for (const [m, off2] of [[300, -200], [200, -100], [100, 0]]) {
      const d = bs + off2, i = segIndex(C, ((d % C.length) + C.length) % C.length);
      const side = C.k[i] > 0 ? -1 : 1, lat = side * ((side > 0 ? C.wl[i] : C.wr[i]) + RUNOFF - 1);
      const p = pointOn(C, d, lat), th = Math.atan2(p.ty, p.tx);
      const g = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshStandardMaterial({ map: tex[m], side: THREE.DoubleSide }));
      panel.position.y = 1.6; panel.rotation.y = -Math.PI / 2;
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), post); pole.position.y = 0.55;
      g.add(panel, pole); g.position.set(p.x, 0, -p.y); g.rotation.y = th; scene.add(g);
    }
  }
  // Salida: línea a cuadros, pórtico con semáforo y parrilla
  const p0 = pointOn(C, 0), th0 = Math.atan2(p0.ty, p0.tx);
  const w0 = C.wl[0] + C.wr[0];
  const chk = new THREE.Mesh(new THREE.PlaneGeometry(1.6, w0), new THREE.MeshStandardMaterial({ map: T.checker, ...off(-4) }));
  T.checker.repeat.set(1, Math.max(1, Math.round(w0 / 2)));
  chk.rotation.set(-Math.PI / 2, 0, th0);
  const mid = pointOn(C, 0, (C.wl[0] - C.wr[0]) / 2);
  chk.position.set(mid.x, 0.04, -mid.y); scene.add(chk);
  const gantry = new THREE.Group(), gm = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.6 });
  const half = w0 / 2 + 2;
  for (const z of [half, -half]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), gm); post.position.set(0, 3.5, z); gantry.add(post); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, w0 + 4), gm); beam.position.set(0, 6.8, 0); gantry.add(beam);
  const lightMats = [];
  for (let k = 0; k < 5; k++) { const lm = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1010, emissiveIntensity: 0 }); lightMats.push(lm); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lm); b.position.set(-0.32, 6.8, (k - 2) * 0.7); gantry.add(b); }
  gantry.position.set(mid.x, 0, -mid.y); gantry.rotation.y = th0; scene.add(gantry);
  {
    const marks = [];
    for (let k = 0; k < 24; k++) {
      const d = C.length - 10 - k * 8, side = k % 2 ? -2.6 : 2.6;
      const p = pointOn(C, d, side + (C.wl[0] - C.wr[0]) / 2), th = Math.atan2(p.ty, p.tx);
      marks.push(placed(new THREE.PlaneGeometry(0.25, 2.4), p.x, 0.045, -p.y, -Math.PI / 2, 0, th));
    }
    scene.add(new THREE.Mesh(mergeGeoms(marks), new THREE.MeshStandardMaterial({ color: 0xffffff, ...off(-4) })));
  }
  // Tribunas a lo largo de la recta de meta
  {
    const standMat = [new THREE.MeshStandardMaterial({ color: 0x5c626b, roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: T.crowd, roughness: 0.9 })];
    for (const [d, side] of [[-200, 1], [-120, 1], [-40, 1], [40, 1], [120, 1]]) {
      const dd = (d + C.length) % C.length, i = segIndex(C, dd);
      const lat = side * ((side > 0 ? C.wl[i] : C.wr[i]) + RUNOFF + BARRIER_GAP + 10);
      const p = pointOn(C, dd, lat), th = Math.atan2(p.ty, p.tx);
      const st = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(70, 9, 14), standMat[0]); base.position.y = 4.5; base.castShadow = true;
      const seats = new THREE.Mesh(new THREE.PlaneGeometry(70, 16), standMat[1]); seats.position.set(0, 5, 0); seats.rotation.x = -Math.PI / 2 + side * 0.55;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(72, 0.4, 16), standMat[0]); roof.position.set(0, 14, side * -1);
      st.add(base, seats, roof);
      st.position.set(p.x, 0, -p.y); st.rotation.y = th; scene.add(st);
    }
  }
  // Árboles y edificios lejanos (instanciados), lejos del asfalto
  {
    const far = (x, y, minD) => { for (let i = 0; i < C.n; i += 3) if (Math.hypot(C.x[i] - x, C.y[i] - y) < minD) return false; return true; };
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 10, 7), new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.9 }), 900);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 6), new THREE.MeshStandardMaterial({ color: 0x5a4030 }), 900);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    let n = 0;
    for (let t = 0; t < 6000 && n < 900; t++) {
      const x = minX - 350 + Math.random() * (maxX - minX + 700), y = minY - 350 + Math.random() * (maxY - minY + 700);
      if (!far(x, y, 40)) continue;
      const s = 0.7 + Math.random() * 0.8; sc.set(s, s, s);
      m.compose(new THREE.Vector3(x, 6.5 * s, -y), q, sc); crown.setMatrixAt(n, m);
      m.compose(new THREE.Vector3(x, 1.5 * s, -y), q, sc); trunk.setMatrixAt(n, m); n++;
    }
    crown.count = trunk.count = n; crown.castShadow = true; scene.add(crown, trunk);
    const bld = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.8 }), 80);
    let b = 0;
    for (let t = 0; t < 2000 && b < 80; t++) {
      const a = Math.random() * Math.PI * 2, r = Math.max(maxX - minX, maxY - minY) * 0.5 + 420 + Math.random() * 500;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, h = 15 + Math.random() * 70;
      m.compose(new THREE.Vector3(x, h / 2, -y), q.setFromEuler(new THREE.Euler(0, Math.random() * 3, 0)), new THREE.Vector3(20 + Math.random() * 25, h, 20 + Math.random() * 25));
      bld.setMatrixAt(b++, m); q.identity();
    }
    bld.count = b; scene.add(bld);
  }

  // Lluvia
  const RAIN_N = 2500;
  const rainPos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) { const x = (Math.random() - 0.5) * 120, y = Math.random() * 60, z = (Math.random() - 0.5) * 120; rainPos.set([x, y, z, x + 0.15, y + 0.9, z], i * 6); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainLines = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xaab8c6, transparent: true, opacity: 0.45 }));
  rainLines.frustumCulled = false; rainLines.visible = false; scene.add(rainLines);

  // Coches
  const helmets = ['#ffd400', '#f4f4f4'];
  const units = new Map();
  for (const c of cars) {
    const u = buildCar(c.color, { helmet: c.mine ? helmets[0] : helmets[1] });
    const spray = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.soft, color: 0xdde6ee, transparent: true, opacity: 0, depthWrite: false }));
    spray.scale.set(8, 2.6, 1); scene.add(u.group, spray);
    units.set(c.id, { ...u, spray, lat: 0, dist: 0, spin: 0, data: c, last: null, parked: null, pos: new THREE.Vector3(), fwd: new THREE.Vector3(1, 0, 0) });
  }
  const sc = buildCar('#c3c7cc', { accent: '#ffcc00', safety: true }); sc.group.visible = false; scene.add(sc.group);

  // Etiquetas
  const labels = document.createElement('div'); labels.className = 'v3d-labels';
  const labelEls = new Map();
  for (const c of cars) { const el = document.createElement('span'); el.className = 'v3d-label' + (c.mine ? ' mine' : ''); labels.appendChild(el); labelEls.set(c.id, el); }

  // Cámaras de TV a lo largo del circuito
  const tvSpots = [];
  for (let d = 0, k = 0; d < C.length; d += 230, k++) {
    const i = segIndex(C, d), side = k % 2 ? 1 : -1;
    const p = pointOn(C, d, side * ((side > 0 ? C.wl[i] : C.wr[i]) + RUNOFF + 10));
    tvSpots.push(new THREE.Vector3(p.x, 10 + (k % 3) * 4, -p.y));
  }

  let follow = (cars.find(c => c.mine) || cars[0]).id;
  let mode = 'chase', tvIdx = -1;
  const orbit = { yaw: 0.6, pitch: 0.35, dist: 22 };
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let first = true, wetNow = 0, elapsed = 0, lastTgt = null;

  // Interacción: arrastrar para orbitar (modo libre), rueda para acercar, clic para seguir un coche
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) { if (mode !== 'free') { mode = 'free'; onCamera && onCamera('free'); } orbit.yaw -= dx * 0.006; orbit.pitch = Math.min(1.45, Math.max(0.05, orbit.pitch + dy * 0.005)); drag.x = e.clientX; drag.y = e.clientY; }
  });
  canvas.addEventListener('pointerup', e => {
    if (drag && !drag.moved) {
      const r = canvas.getBoundingClientRect(); let best = null, bd = 45;
      for (const [id, u] of units) {
        if (!u.group.visible) continue;
        const v = u.pos.clone().setY(0.8).project(camera);
        if (v.z > 1) continue;
        const d = Math.hypot((v.x + 1) / 2 * r.width - (e.clientX - r.left), (1 - v.y) / 2 * r.height - (e.clientY - r.top));
        if (d < bd) { bd = d; best = id; }
      }
      if (best) { follow = best; lastTgt = null; first = true; onFollow && onFollow(best); }
    }
    drag = null;
  });
  canvas.addEventListener('wheel', e => { if (mode !== 'free' && !e.ctrlKey) return; e.preventDefault(); if (mode !== 'free') { mode = 'free'; onCamera && onCamera('free'); } orbit.dist = Math.min(400, Math.max(6, orbit.dist * (e.deltaY > 0 ? 1.12 : 0.89))); }, { passive: false });

  function resize() {
    const w = container.clientWidth || 640, h = container.clientHeight || 360;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  function attach(el) {
    container = el; el.appendChild(canvas); el.appendChild(labels); ro.disconnect(); ro.observe(el); resize();
  }
  attach(container);

  function setWeather(w) {
    if (Math.abs(w - wetNow) < 0.01) return;
    wetNow = w;
    sky.material.map = w > 0.25 ? skyWet : skyDry; sky.material.needsUpdate = true;
    scene.fog.color.set(w > 0.25 ? 0x8f98a2 : 0xbfd6ea); scene.fog.near = 400 - 300 * w; scene.fog.far = 3200 - 2300 * w;
    sun.intensity = 2.4 * (1 - 0.75 * w); hemi.intensity = 1.0 - 0.3 * w;
    asphalt.roughness = 0.9 - 0.6 * w; asphalt.color.setScalar(1 - 0.45 * w); asphalt.envMapIntensity = 0.3 + 1.2 * w;
    renderer.toneMappingExposure = 1 - 0.15 * w;
  }

  // state: { cars: [{ id, dist, lat, out, comp, pos, label, pitted }], wet, sc: 'SC'|'VSC'|null, lights, compColors }
  function frame(state, dt) {
    dt = Math.min(0.1, Math.max(0, dt)); elapsed += dt;
    setWeather(state.wet || 0);
    let leader = null;
    for (const c of state.cars) {
      const u = units.get(c.id); if (!u) continue;
      let dist = c.dist, latT = c.lat || 0;
      if (c.out) {
        if (!u.parked) { const i = segIndex(C, u.dist); u.parked = { dist: u.dist, lat: (u.lat >= 0 ? 1 : -1) * ((u.lat >= 0 ? C.wl[i] : C.wr[i]) + 6) }; }
        dist = u.parked.dist; latT = u.parked.lat;
      } else u.parked = null;
      const k = 1 - Math.exp(-dt * 7);
      u.lat += (latT - u.lat) * (first ? 1 : k);
      const moved = ((dist - u.dist) % L.length + L.length) % L.length;
      u.spin += (moved < 200 ? moved : 0) / 0.36;
      u.dist = dist;
      let p = pointOn(L, dist, u.lat);
      // Mantiene el coche dentro del asfalto aunque la trazada vaya pegada al borde y se abra para adelantar
      if (!c.out && L !== C) {
        let ci = Math.round(dist / L.length * C.n) % C.n, best = Infinity;
        for (let k = -18; k <= 18; k++) { const j = (ci + k + C.n) % C.n, dd = (C.x[j] - p.x) ** 2 + (C.y[j] - p.y) ** 2; if (dd < best) { best = dd; ci = j; } }
        const nx = -C.ty[ci], ny = C.tx[ci], lat = (p.x - C.x[ci]) * nx + (p.y - C.y[ci]) * ny;
        const lim = Math.max(lat - (C.wl[ci] - 1.3), 0) + Math.min(lat + (C.wr[ci] - 1.3), 0);
        if (lim) p = { ...p, x: p.x - nx * lim, y: p.y - ny * lim };
      }
      const mix = (q, b) => { if (b <= 0) return; const tx = p.tx + (q.tx - p.tx) * b, ty = p.ty + (q.ty - p.ty) * b, l = Math.hypot(tx, ty) || 1; p = { x: p.x + (q.x - p.x) * b, y: p.y + (q.y - p.y) * b, tx: tx / l, ty: ty / l }; };
      // Parrilla: casillas pintadas sobre la línea central
      if (c.grid) { const k = c.grid.k; mix(pointOn(C, C.length - 10 - k * 8, (k % 2 ? -2.6 : 2.6) + (C.wl[0] - C.wr[0]) / 2), 1 - c.grid.blend); }
      // Calle de boxes: entrada, parada en el garaje del equipo y salida
      if (c.pit) {
        const slot = slotOf[c.teamId] ?? 0;
        const r = c.pit.phase === 'in' ? PIT_IN + c.pit.t * (slot - PIT_IN) : c.pit.phase === 'stop' ? slot : slot + c.pit.t * (PIT_OUT - slot);
        const bl = c.pit.phase === 'in' ? Math.min(1, c.pit.t * -PIT_IN / 110) : c.pit.phase === 'out' ? Math.min(1, (1 - c.pit.t) * PIT_OUT / 110) : 1;
        const d = (r + C.length) % C.length, i = segIndex(C, d);
        mix(pointOn(C, d, -(wallLat(i) + (c.pit.phase === 'stop' ? 8.2 : 3.2))), bl * bl * (3 - 2 * bl));
      }
      u.pos.set(p.x, 0.02, -p.y); u.fwd.set(p.tx, 0, -p.ty);
      u.group.position.copy(u.pos); u.group.rotation.y = Math.atan2(p.ty, p.tx);
      const steer = Math.max(-0.38, Math.min(0.38, (geo.lineK[segIndex(L, dist)] || 0) * 9));
      u.steer = (u.steer || 0) + (steer - (u.steer || 0)) * Math.min(1, dt * 8);
      u.wheels.forEach((w, k) => { w.rotation.z = -u.spin; if (k < 2) w.rotation.y = c.pit && c.pit.phase === 'stop' ? 0 : u.steer; });
      u.kmh = c.kmh || 0;
      if (state.compColors && c.comp) u.stripe.color.set(state.compColors[c.comp] || '#fff');
      u.rain.material.emissiveIntensity = (state.wet > 0.15 || state.sc) ? (Math.sin(elapsed * 12) > 0 ? 3 : 0.2) : 0;
      u.spray.material.opacity = c.out ? 0 : Math.min(0.75, (state.wet || 0) * 0.9);
      u.spray.position.copy(u.pos).addScaledVector(u.fwd, -4.5).setY(0.9);
      u.data = c;
      if (!c.out && (!leader || c.pos < leader.pos)) leader = c;
    }
    // Coche de seguridad delante del líder
    sc.group.visible = state.sc === 'SC' && !!leader;
    if (sc.group.visible) {
      const p = pointOn(L, leader.dist + 55, 0); sc.group.position.set(p.x, 0.02, -p.y); sc.group.rotation.y = Math.atan2(p.ty, p.tx);
      sc.bar.material.emissiveIntensity = Math.sin(elapsed * 10) > 0 ? 3 : 0.4;
    }
    lightMats.forEach((m, k) => { m.emissiveIntensity = k < (state.lights || 0) ? 3.5 : 0; });

    // Cámara
    const u = units.get(follow) || units.values().next().value;
    const tgt = u.pos, fwd = u.fwd, up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(fwd, up);
    let desired, look, fov = 60, smooth = 1 - Math.exp(-dt * 5);
    if (mode === 'chase') { desired = tgt.clone().addScaledVector(fwd, -9.5).setY(3.1); look = tgt.clone().addScaledVector(fwd, 6).setY(0.9); fov = 56 + Math.max(0, Math.min(12, ((u.kmh || 0) - 120) / 18)); }
    else if (mode === 'onboard') { desired = tgt.clone().addScaledVector(fwd, -0.35).setY(1.28); look = tgt.clone().addScaledVector(fwd, 25).setY(0.9); fov = 72; smooth = 1; }
    else if (mode === 'heli') { desired = tgt.clone().addScaledVector(fwd, -45).addScaledVector(side, 25).setY(60); look = tgt.clone(); fov = 45; smooth = 1 - Math.exp(-dt * 2); }
    else if (mode === 'tv') {
      let bi = 0, bd = Infinity;
      tvSpots.forEach((s, i) => { const d = s.distanceTo(tgt); if (d < bd) { bd = d; bi = i; } });
      if (bi !== tvIdx) { tvIdx = bi; camPos.copy(tvSpots[bi]); }
      desired = tvSpots[bi].clone(); look = tgt.clone().setY(0.8);
      fov = Math.min(55, Math.max(4, 2 * Math.atan(11 / Math.max(1, bd)) * 180 / Math.PI)); smooth = 1;
    } else {
      desired = tgt.clone().add(new THREE.Vector3(Math.cos(orbit.yaw) * Math.cos(orbit.pitch), Math.sin(orbit.pitch), Math.sin(orbit.yaw) * Math.cos(orbit.pitch)).multiplyScalar(orbit.dist));
      look = tgt.clone().setY(0.6); fov = 55; smooth = 1 - Math.exp(-dt * 8);
    }
    // La cámara acompaña al coche y solo suaviza los cambios de dirección (sirve a cualquier velocidad de reproducción)
    if (lastTgt && mode !== 'tv') { const d = tgt.clone().sub(lastTgt); if (d.length() < 2000) { camPos.add(d); camLook.add(d); } }
    lastTgt = tgt.clone();
    if (first) { camPos.copy(desired); camLook.copy(look); first = false; }
    camPos.lerp(desired, smooth); camLook.lerp(look, mode === 'tv' ? 1 - Math.exp(-dt * 6) : smooth);
    if (mode === 'onboard') { camPos.copy(desired); camLook.copy(look); }
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
    sun.position.copy(tgt).add(new THREE.Vector3(70, 110, 40)); sun.target.position.copy(tgt);

    // Lluvia alrededor de la cámara
    rainLines.visible = wetNow > 0.12;
    if (rainLines.visible) {
      rainLines.material.opacity = Math.min(0.6, wetNow * 0.8);
      const a = rainGeo.attributes.position.array, fall = dt * (28 + 20 * wetNow);
      for (let i = 0; i < RAIN_N; i++) { const o = i * 6; a[o + 1] -= fall; a[o + 4] -= fall; if (a[o + 1] < 0) { a[o + 1] += 60; a[o + 4] += 60; } }
      rainGeo.attributes.position.needsUpdate = true;
      rainLines.position.set(camera.position.x, 0, camera.position.z);
    }

    // Oculta los coches pegados a la cámara para que no tapen la imagen
    {
      const toT = tgt.clone().sub(camera.position), dT = toT.length();
      for (const [id, un] of units) {
        if (id === follow) { un.group.visible = true; continue; }
        const v = un.pos.clone().sub(camera.position), d = v.length();
        const blocks = mode !== 'heli' && d < dT - 0.5 && v.angleTo(toT) < 0.42;
        un.group.visible = d > 5.5 && !blocks;
      }
    }
    renderer.render(scene, camera);

    // Etiquetas proyectadas
    const r = canvas.getBoundingClientRect();
    for (const [id, el] of labelEls) {
      const un = units.get(id), d = un.data;
      const v = un.pos.clone().setY(1.7);
      const dist = v.distanceTo(camera.position);
      v.project(camera);
      const show = d && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && (dist < 160 || id === follow || un.data.mine) && dist < 900;
      if (!show) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.textContent = d.out ? `${d.label} · OUT` : `P${d.pos} ${d.label}${d.pitted ? ' · BOX' : ''}`;
      el.classList.toggle('foll', id === follow);
      el.style.transform = `translate(${((v.x + 1) / 2 * r.width).toFixed(0)}px, ${((1 - v.y) / 2 * r.height).toFixed(0)}px) translate(-50%, -100%)`;
    }
  }

  function dispose() {
    ro.disconnect();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    pmrem.dispose(); renderer.dispose(); canvas.remove(); labels.remove();
  }

  return {
    canvas, attach, frame, dispose,
    setFollow(id) { if (units.has(id)) { follow = id; lastTgt = null; first = true; } },
    getFollow: () => follow,
    setCamera(m) { mode = m; tvIdx = -1; first = true; if (m === 'free') { orbit.dist = 22; } },
    getCamera: () => mode,
    debug: () => ({ cam: camera.position.toArray(), car: (units.get(follow) || {}).pos?.toArray(), c0: [C.x[0], 0, -C.y[0]], road: road.geometry.attributes.position.array.slice(0, 6) }),
  };
}
