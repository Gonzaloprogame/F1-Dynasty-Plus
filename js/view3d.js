// Retransmisión 3D de la carrera con three.js (MIT). Módulo ES que se carga solo al activar la vista 3D.
// El circuito se construye con la geometría de realtracks.js (datos reales o trazado generado). El coche, el
// circuito y todas las texturas son originales y se generan aquí.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const RUNOFF = 12;       // m de escapatoria máxima a cada lado
const KERB_W = 1.5;      // ancho de los pianos
const BRANDS = ['ZENTRA', 'NIMBUS', 'VOLTA', 'KREST', 'HELIX', 'LUMEN', 'QUASAR', 'OSTARA', 'ARCADIA', 'PIONEER'];
const BRAND_COLORS = ['#e63946', '#1d3557', '#ffb703', '#2a9d8f', '#6a4c93', '#ef476f', '#118ab2', '#073b4c', '#f77f00', '#3a86ff'];

// ---------- utilidades ----------
const rnd = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function canvasTex(w, h, draw, { rep = null, srgb = true } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}
function noiseFill(c, w, h, base, n, amp, size = 2) {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    c.fillStyle = `rgba(${v},${v},${v},${rnd() * amp})`;
    const s = 1 + rnd() * size; c.fillRect(rnd() * w, rnd() * h, s, s);
  }
}
// Ruido de valor suave (para el color del terreno)
function valueNoise(seed) {
  const r = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453; return s - Math.floor(s); };
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = r(xi, yi), b = r(xi + 1, yi), c = r(xi, yi + 1), d = r(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function makeTextures() {
  const asphalt = canvasTex(512, 512, (c, w, h) => {
    noiseFill(c, w, h, '#4a4e55', 26000, 0.16, 2);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`; c.beginPath(); c.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 60, 6 + rnd() * 16, rnd() * 3, 0, 7); c.fill(); }
  });
  const asphaltBump = canvasTex(256, 256, (c, w, h) => noiseFill(c, w, h, '#808080', 14000, 0.6, 1.5), { srgb: false });
  const grass = canvasTex(512, 512, (c, w, h) => {
    noiseFill(c, w, h, '#4f7d33', 22000, 0.14, 2);
    for (let i = 0; i < 6000; i++) { c.strokeStyle = `rgba(${rnd() < 0.5 ? '30,60,20' : '140,190,90'},0.25)`; const x = rnd() * w, y = rnd() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd() * 2 - 1, y - 2 - rnd() * 4); c.stroke(); }
  });
  const gravel = canvasTex(256, 256, (c, w, h) => { noiseFill(c, w, h, '#c9b48a', 20000, 0.35, 2.5); });
  const runoff = canvasTex(256, 256, (c, w, h) => { noiseFill(c, w, h, '#6e747c', 9000, 0.12, 2); });
  const checker = canvasTex(64, 16, (c) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 4, y * 4, 4, 4); } });
  const crowd = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#2b2f36'; c.fillRect(0, 0, w, h);
    const cols = ['#e63946', '#f1faee', '#ffd166', '#118ab2', '#06d6a0', '#ef476f', '#ff9f1c', '#adb5bd', '#ffffff', '#3a86ff'];
    for (let y = 2; y < h; y += 6) for (let x = 1; x < w; x += 4) if (rnd() < 0.85) { c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.fillRect(x + rnd(), y, 2.4, 3.4); }
  });
  const fence = canvasTex(64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(205,210,216,0.95)'; c.lineWidth = 1;
    for (let i = -h; i < w; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); }
  });
  const facade = canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#c9ccd1'; c.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 16) for (let x = 6; x < w; x += 14) { c.fillStyle = rnd() < 0.25 ? '#e9d9a8' : '#4b5a6b'; c.fillRect(x, y, 9, 10); }
  });
  const soft = canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const blob = canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#aaa'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, { srgb: false });
  const ads = BRANDS.map((b, i) => canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = BRAND_COLORS[i]; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = 'italic 900 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b, w / 2, h / 2 + 2);
  }));
  const sign = n => canvasTex(128, 96, (c, w, h) => {
    c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b2a8f'; c.fillRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#fff'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w / 2, h / 2 + 3);
  });
  return { asphalt, asphaltBump, grass, gravel, runoff, checker, crowd, fence, facade, soft, blob, ads, sign };
}

// ---------- geometría del circuito ----------
const nrm = (C, i) => [-C.ty[i], C.tx[i]];
const H = (C, i) => (C.h ? C.h[i] : 0);
// Superficie a lo largo de la línea central entre dos desplazamientos laterales (positivo = izquierda).
// Solo incluye los tramos donde test(i) es cierto. Triángulos sin índice: el color por tramo queda nítido.
function surf(C, latA, latB, { h = 0.02, hA = null, hB = null, test = null, colorFn = null, vScale = 10, uScale = 1 } = {}) {
  const n = C.n, pos = [], uv = [], col = [];
  for (let i = 0; i < n; i++) {
    if (test && !test(i)) continue;
    const j = (i + 1) % n, sj = j === 0 ? C.length : C.s[j];
    const P = (k, lat, hh) => { const [nx, ny] = nrm(C, k); return [C.x[k] + nx * lat, H(C, k) + hh, -(C.y[k] + ny * lat)]; };
    const a1 = latA(i), b1 = latB(i), a2 = latA(j), b2 = latB(j);
    const ha = hA ?? h, hb = hB ?? h;
    const q = [P(i, a1, ha), P(i, b1, hb), P(j, a2, ha), P(j, b2, hb)];
    const u = [[0, C.s[i] / vScale], [uScale, C.s[i] / vScale], [0, sj / vScale], [uScale, sj / vScale]];
    const c = colorFn ? colorFn(i) : null;
    for (const k of [0, 2, 1, 1, 2, 3]) { pos.push(...q[k]); uv.push(...u[k]); if (c) col.push(...c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const N = g.attributes.normal; for (let i = 0; i < N.count; i++) if (N.getY(i) < 0) N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i));
  return g;
}
// Pared vertical a un desplazamiento lateral, solo donde test(i)
function wallGeo(C, lat, h0, h1, test, colorFn = null, uScale = 4) {
  const n = C.n, pos = [], uv = [], col = [];
  for (let i = 0; i < n; i++) {
    if (test && !test(i)) continue;
    const j = (i + 1) % n, sj = j === 0 ? C.length : C.s[j];
    const P = (k, y) => { const [nx, ny] = nrm(C, k), L = lat(k); return [C.x[k] + nx * L, H(C, k) + y, -(C.y[k] + ny * L)]; };
    const q = [P(i, h0), P(i, h1), P(j, h0), P(j, h1)];
    const u = [[C.s[i] / uScale, 0], [C.s[i] / uScale, 1], [sj / uScale, 0], [sj / uScale, 1]];
    const c = colorFn ? colorFn(i) : null;
    for (const k of [0, 1, 2, 1, 3, 2]) { pos.push(...q[k]); uv.push(...u[k]); if (c) col.push(...c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- coche (diseño propio; morro hacia +X) ----------
// Secciones superelípticas a lo largo de X: [x, semiancho, semialto, altura del centro]
function loft(sections, { seg = 14, zOff = 0, p = 2.6 } = {}) {
  const pos = [], idx = [];
  sections.forEach(([x, w, h, yc]) => {
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const ex = Math.sign(ca) * Math.abs(ca) ** (2 / p), ey = Math.sign(sa) * Math.abs(sa) ** (2 / p);
      pos.push(x, yc + ey * h, zOff + ex * w);
    }
  });
  for (let r = 0; r < sections.length - 1; r++) for (let k = 0; k < seg; k++) {
    const a = r * seg + k, b = r * seg + (k + 1) % seg, c = a + seg, d = b + seg;
    idx.push(a, c, b, b, c, d);
  }
  const cap = (r, flip) => {
    const center = pos.length / 3; const [x, , , yc] = sections[r];
    pos.push(x, yc, zOff);
    for (let k = 0; k < seg; k++) { const a = r * seg + k, b = r * seg + (k + 1) % seg; if (flip) idx.push(center, b, a); else idx.push(center, a, b); }
  };
  cap(0, true); cap(sections.length - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g.toNonIndexed();
}
const box = (sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  return g.toNonIndexed();
};
const rod = (a, b, r = 0.018) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, 6);
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()), new THREE.Vector3(1, 1, 1)));
  return g.toNonIndexed();
};
const clean = gs => mergeGeometries(gs.map(g => { const h = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(h.attributes)) if (k !== 'position' && k !== 'normal') h.deleteAttribute(k); return h; }));

function tyreGeo(r, w) {
  const pts = [], hw = w / 2, sh = 0.06;
  pts.push(new THREE.Vector2(0.2, -hw));
  for (let k = 0; k <= 6; k++) { const a = -Math.PI / 2 + (k / 6) * Math.PI / 2; pts.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, -hw + sh + Math.sin(a) * sh)); }
  for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI / 2; pts.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh)); }
  pts.push(new THREE.Vector2(0.2, hw));
  const g = new THREE.LatheGeometry(pts, 28);
  g.rotateX(Math.PI / 2);
  return g;
}
function buildCarTemplate() {
  const paint = [], carbon = [], accent = [], dark = [];
  // Morro, monocasco y cubierta del motor
  paint.push(loft([[2.95, 0.05, 0.035, 0.2], [2.6, 0.11, 0.07, 0.24], [2.1, 0.17, 0.12, 0.31], [1.5, 0.24, 0.17, 0.4], [1.0, 0.3, 0.22, 0.45], [0.55, 0.36, 0.26, 0.47]]));
  paint.push(loft([[0.55, 0.36, 0.26, 0.47], [0.0, 0.42, 0.28, 0.49], [-0.45, 0.44, 0.33, 0.54], [-0.95, 0.38, 0.34, 0.55], [-1.5, 0.26, 0.27, 0.5], [-2.05, 0.13, 0.17, 0.42], [-2.3, 0.07, 0.1, 0.38]]));
  paint.push(loft([[-0.12, 0.13, 0.12, 0.86], [-0.35, 0.16, 0.16, 0.87], [-0.65, 0.12, 0.12, 0.8], [-0.9, 0.05, 0.05, 0.7]], { p: 2.2 }));
  for (const z of [0.6, -0.6]) paint.push(loft([[0.95, 0.12, 0.13, 0.36], [0.7, 0.26, 0.2, 0.37], [0.0, 0.3, 0.21, 0.36], [-0.8, 0.24, 0.17, 0.32], [-1.45, 0.12, 0.1, 0.27], [-1.7, 0.05, 0.05, 0.24]], { zOff: z, p: 3 }));
  paint.push(box(1.35, 0.32, 0.02, -1.25, 0.88, 0, 0, 0, 0.12));
  for (const z of [0.98, -0.98]) paint.push(box(0.62, 0.26, 0.03, 2.72, 0.2, z));
  for (const z of [0.55, -0.55]) paint.push(box(0.78, 0.62, 0.03, -2.25, 0.8, z));
  // Fibra de carbono: suelo, alerones, difusor, halo, retrovisores y suspensión
  {
    const sh = new THREE.Shape([[2.55, 0.35], [1.1, 0.42], [0.9, 0.92], [-1.3, 0.92], [-1.7, 0.6], [-2.45, 0.55], [-2.45, -0.55], [-1.7, -0.6], [-1.3, -0.92], [0.9, -0.92], [1.1, -0.42], [2.55, -0.35]].map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false });
    g.rotateX(Math.PI / 2); g.translate(0, 0.07, 0); carbon.push(g.index ? g.toNonIndexed() : g);
  }
  carbon.push(box(0.5, 0.03, 1.94, 2.78, 0.1, 0, 0, 0, 0.05));
  carbon.push(box(0.36, 0.025, 1.9, 2.66, 0.16, 0, 0, 0, 0.2));
  carbon.push(box(0.46, 0.04, 1.06, -2.28, 0.98, 0, 0, 0, -0.08));
  carbon.push(box(0.36, 0.2, 1.0, -2.45, 0.2, 0, 0, 0, 0.45));
  carbon.push(box(0.3, 0.03, 0.9, -2.35, 0.55, 0, 0, 0, -0.1));
  carbon.push(box(0.06, 0.5, 0.06, -2.3, 0.65, 0.18), box(0.06, 0.5, 0.06, -2.3, 0.65, -0.18));
  {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.15, 0.7, 0.3), new THREE.Vector3(0.1, 0.83, 0.27), new THREE.Vector3(0.4, 0.86, 0), new THREE.Vector3(0.1, 0.83, -0.27), new THREE.Vector3(-0.15, 0.7, -0.3)]);
    carbon.push(new THREE.TubeGeometry(curve, 24, 0.035, 8, false).toNonIndexed());
    carbon.push(rod([0.4, 0.86, 0], [0.62, 0.62, 0], 0.03));
  }
  for (const z of [0.52, -0.52]) { carbon.push(box(0.1, 0.06, 0.16, 0.45, 0.8, z)); carbon.push(rod([0.47, 0.78, z * 0.9], [0.5, 0.6, z * 0.62], 0.012)); }
  for (const s of [1, -1]) {
    carbon.push(rod([1.95, 0.4, s * 0.25], [1.85, 0.36, s * 0.78]), rod([1.6, 0.4, s * 0.25], [1.85, 0.36, s * 0.78]));
    carbon.push(rod([1.95, 0.25, s * 0.22], [1.85, 0.24, s * 0.78]), rod([1.6, 0.25, s * 0.22], [1.85, 0.24, s * 0.78]));
    carbon.push(rod([-1.3, 0.42, s * 0.3], [-1.55, 0.4, s * 0.78]), rod([-1.85, 0.42, s * 0.2], [-1.55, 0.4, s * 0.78]));
    carbon.push(rod([-1.3, 0.24, s * 0.3], [-1.55, 0.25, s * 0.78]), rod([-1.85, 0.24, s * 0.2], [-1.55, 0.25, s * 0.78]));
  }
  // Color secundario
  accent.push(box(0.26, 0.022, 1.86, 2.55, 0.22, 0, 0, 0, 0.32));
  accent.push(box(0.3, 0.035, 1.06, -2.18, 1.08, 0, 0, 0, -0.22));
  accent.push(loft([[2.97, 0.05, 0.034, 0.2], [2.78, 0.08, 0.05, 0.22]]));
  accent.push(box(1.2, 0.012, 0.16, -0.95, 0.89, 0));
  // Cabina
  dark.push(loft([[0.42, 0.2, 0.05, 0.72], [0.0, 0.26, 0.06, 0.74], [-0.2, 0.2, 0.05, 0.72]], { p: 3 }));
  return {
    paint: clean(paint), carbon: clean(carbon), accent: clean(accent), dark: clean(dark),
    tyreF: tyreGeo(0.36, 0.34), tyreR: tyreGeo(0.37, 0.42),
    rim: (() => { const g = new THREE.CylinderGeometry(0.22, 0.22, 0.02, 18); g.rotateX(Math.PI / 2); return g; })(),
    stripe: new THREE.TorusGeometry(0.29, 0.016, 6, 28),
    helmet: new THREE.SphereGeometry(0.15, 18, 12),
    visor: (() => { const g = new THREE.SphereGeometry(0.152, 18, 8, -0.9, 1.8, 1.15, 0.45); g.rotateY(Math.PI / 2); return g; })(),
    blob: new THREE.PlaneGeometry(5.8, 2.5),
    spoke: new THREE.BoxGeometry(0.4, 0.04, 0.01),
  };
}
function secondaryFor(hex) { const c = new THREE.Color(hex), l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; return l > 0.6 ? '#1b1d22' : '#f2f2f2'; }

// ---------- vista ----------
export function createView3D(container, { geo, cars, onFollow, onCamera }) {
  const C = geo.center, L = geo.line;
  const T = makeTextures();
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.3 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement; canvas.className = 'v3d-canvas';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.3, 9000);

  // Cielo con dispersión atmosférica; genera también la luz ambiental y los reflejos
  // El sombreador original da valores muy altos que se saturan con nuestra exposición: se atenúa solo el cielo
  const skyGain = { value: 0.42 };
  const tameSky = s => { s.material.onBeforeCompile = sh => { sh.uniforms.skyGain = skyGain; sh.fragmentShader = 'uniform float skyGain;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain * vec3( 0.86, 0.96, 1.14 ), 1.0 );'); }; return s; };
  const sky = tameSky(new Sky()); sky.scale.setScalar(8000); scene.add(sky);
  const sunDir = new THREE.Vector3();
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  function setSky(wet) {
    const cfg = { turbidity: wet ? 14 : 2.6, rayleigh: wet ? 0.6 : 2.4, mieCoefficient: wet ? 0.02 : 0.0035, mieDirectionalG: wet ? 0.6 : 0.85 };
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(wet ? 72 : 52), THREE.MathUtils.degToRad(135));
    const apply = s => { const u = s.material.uniforms; for (const k in cfg) u[k].value = cfg[k]; u.sunPosition.value.copy(sunDir); };
    apply(sky);
    const envScene = new THREE.Scene(), s2 = tameSky(new Sky()); s2.scale.setScalar(1000); apply(s2); envScene.add(s2);
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene); scene.environment = envRT.texture;
    s2.geometry.dispose(); s2.material.dispose();
  }
  scene.fog = new THREE.Fog(0xbfd3e6, 600, 4800);
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x48602e, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dd, 3.2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 400 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  setSky(false);

  // Límites
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < C.n; i++) { minX = Math.min(minX, C.x[i]); maxX = Math.max(maxX, C.x[i]); minY = Math.min(minY, C.y[i]); maxY = Math.max(maxY, C.y[i]); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, span = Math.max(maxX - minX, maxY - minY) + 2400;
  const clearOther = (x, y, s, win = 140) => geo.clearance(x, y, 60, { s, win });
  const clearAll = (x, y) => geo.clearance(x, y, 90);

  // Terreno con variación de color
  {
    const segs = small ? 90 : 160, g = new THREE.PlaneGeometry(span, span, segs, segs); g.rotateX(-Math.PI / 2);
    const nz = valueNoise(3.7), cols = [], p = g.attributes.position;
    const base = new THREE.Color('#5d8a3a'), dry = new THREE.Color('#8a9a4e'), deep = new THREE.Color('#3f6b2a');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), a = nz(x / 260, z / 260), b = nz(x / 70 + 9, z / 70 - 4);
      const c = base.clone().lerp(dry, Math.max(0, a - 0.45) * 1.2).lerp(deep, Math.max(0, 0.5 - b) * 0.8);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    T.grass.repeat.set(span / 30, span / 30);
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: T.grass, vertexColors: true, roughness: 1 }));
    ground.position.set(cx, -0.02, -cy); ground.receiveShadow = true; scene.add(ground);
  }

  // Curvatura suavizada para decidir pianos y grava
  const kS = new Float64Array(C.n);
  for (let i = 0; i < C.n; i++) { let a = 0; for (let k = -12; k <= 12; k++) a += C.k[(i + k + C.n) % C.n]; kS[i] = a / 25; }
  const wl = i => C.wl[i], wr = i => C.wr[i];
  // Espacio libre a cada lado, para no invadir otras partes del circuito
  const room = [new Float64Array(C.n), new Float64Array(C.n)]; // [izquierda, derecha]
  for (let i = 0; i < C.n; i += 3) for (const [side, si] of [[1, 0], [-1, 1]]) {
    let ok = 2;
    for (const d of [5, 9, 13, 17]) {
      const [nx, ny] = nrm(C, i), lat = side * ((side > 0 ? wl(i) : wr(i)) + d);
      if (clearOther(C.x[i] + nx * lat, C.y[i] + ny * lat, C.s[i]) < 3) break;
      ok = d;
    }
    for (let k = 0; k < 3 && i + k < C.n; k++) room[si][i + k] = ok;
  }
  for (const r of room) { const c = Float64Array.from(r); for (let i = 0; i < C.n; i++) { let m = Infinity; for (let k = -4; k <= 4; k++) m = Math.min(m, c[(i + k + C.n) % C.n]); r[i] = m; } }
  const runW = (si, i) => Math.max(2, Math.min(RUNOFF, room[si][i] - 3));
  const off = f => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide });

  // Asfalto
  const asphalt = new THREE.MeshStandardMaterial({ map: T.asphalt, bumpMap: T.asphaltBump, bumpScale: 0.6, roughness: 0.88, metalness: 0, envMapIntensity: 0.35, ...off(-2) });
  const road = new THREE.Mesh(surf(C, i => -wr(i), wl, { h: 0.03, vScale: 9 }), asphalt); road.receiveShadow = true; scene.add(road);
  scene.add(new THREE.Mesh(surf(L, () => 1.0, () => -1.0, { h: 0.035 }), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false, ...off(-3) })));
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.55, ...off(-4) });
  scene.add(new THREE.Mesh(mergeGeometries([surf(C, i => wl(i) - 0.45, i => wl(i) - 0.2, { h: 0.04 }), surf(C, i => -wr(i) + 0.2, i => -wr(i) + 0.45, { h: 0.04 })]), lineMat));
  // Escapatorias: grava en el exterior de las curvas, asfalto pintado en las rectas, césped en el resto
  const outside = (side, i) => (kS[i] > 0.004 && side < 0) || (kS[i] < -0.004 && side > 0);
  const gravelMat = new THREE.MeshStandardMaterial({ map: T.gravel, roughness: 1, ...off(-1) });
  const runMat = new THREE.MeshStandardMaterial({ map: T.runoff, roughness: 0.92, ...off(-1) });
  T.gravel.repeat.set(3, 1); T.runoff.repeat.set(3, 1);
  for (const [side, si] of [[1, 0], [-1, 1]]) {
    const edge = i => side * ((side > 0 ? wl(i) : wr(i)) + KERB_W);
    const outer = i => side * ((side > 0 ? wl(i) : wr(i)) + KERB_W + runW(si, i));
    scene.add(new THREE.Mesh(surf(C, side > 0 ? edge : outer, side > 0 ? outer : edge, { h: 0.015, test: i => outside(side, i) && room[si][i] >= 6, uScale: 3, vScale: 8 }), gravelMat));
    scene.add(new THREE.Mesh(surf(C, side > 0 ? edge : outer, side > 0 ? outer : edge, { h: 0.015, test: i => !outside(side, i) && Math.abs(kS[i]) < 0.004 && room[si][i] >= 6, uScale: 3, vScale: 8 }), runMat));
  }
  // Pianos con relieve en las curvas
  {
    const kerbTest = i => Math.abs(kS[i]) > 0.0045;
    const col = i => Math.floor(C.s[i] / 2.2) % 2 ? [0.82, 0.08, 0.08] : [0.95, 0.95, 0.95];
    const g = mergeGeometries([
      surf(C, wl, i => wl(i) + KERB_W, { hA: 0.03, hB: 0.1, test: kerbTest, colorFn: col }),
      surf(C, i => -wr(i) - KERB_W, i => -wr(i), { hA: 0.1, hB: 0.03, test: kerbTest, colorFn: col }),
    ]);
    const kerbs = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, ...off(-3) }));
    kerbs.receiveShadow = true; scene.add(kerbs);
  }

  // Calle de boxes (a la derecha de la recta de meta)
  const pitRel = d => { let r = ((d % C.length) + C.length) % C.length; if (r > C.length / 2) r -= C.length; return r; };
  const rOf = i => pitRel(C.s[i]);
  const wallLat = i => wr(i) + KERB_W + runW(1, i) + 0.5;
  const inGap = i => { const r = rOf(i); return (r > PIT_IN - 25 && r < PIT_IN + 70) || (r > PIT_OUT - 70 && r < PIT_OUT + 25); };
  const inPit = i => { const r = rOf(i); return r > PIT_IN - 25 && r < PIT_OUT + 25; };
  const pitLatIn = i => -(wallLat(i) + 1), pitLatOut = i => -(wallLat(i) + 10);
  scene.add(new THREE.Mesh(surf(C, pitLatOut, pitLatIn, { h: 0.03, test: inPit, vScale: 9 }), asphalt));
  scene.add(new THREE.Mesh(surf(C, i => -wallLat(i) - 1.2, i => -wr(i), { h: 0.028, test: inGap, vScale: 9 }), asphalt));
  scene.add(new THREE.Mesh(surf(C, i => pitLatIn(i) - 4.6, i => pitLatIn(i) - 4.4, { h: 0.04, test: i => inPit(i) && Math.floor(C.s[i] / 4) % 2 === 0 }), lineMat));

  // Barreras: quitamiedos en las rectas, muro de neumáticos en el exterior de las curvas y valla detrás
  const barTest = (side, si) => i => room[si][i] >= 6 && !(side < 0 && inGap(i));
  const barLat = (side, si) => i => side * ((side > 0 ? wl(i) : wr(i)) + KERB_W + runW(si, i) + 0.5);
  const armcoMat = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide });
  const fenceMat = new THREE.MeshBasicMaterial({ map: T.fence, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.45 });
  const tyreWallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const posts = [], fposts = [];
  for (const [side, si] of [[1, 0], [-1, 1]]) {
    const t = barTest(side, si), lat = barLat(side, si);
    const tyre = i => t(i) && outside(side, i), armco = i => t(i) && !outside(side, i);
    scene.add(new THREE.Mesh(mergeGeometries([wallGeo(C, lat, 0.45, 0.62, armco), wallGeo(C, lat, 0.72, 0.89, armco)]), armcoMat));
    const tyreCol = i => { const b = Math.floor(C.s[i] / 3) % 3; return b === 0 ? [0.75, 0.1, 0.1] : b === 1 ? [0.92, 0.92, 0.92] : [0.08, 0.08, 0.09]; };
    scene.add(new THREE.Mesh(wallGeo(C, lat, 0, 1.1, tyre, tyreCol), tyreWallMat));
    scene.add(new THREE.Mesh(wallGeo(C, i => lat(i) + side * 1.5, 1.2, 4.2, t, null, 4), fenceMat));
    for (let i = 0; i < C.n; i++) {
      const j = (i + 1) % C.n;
      if (!t(i)) continue;
      const [nx, ny] = nrm(C, i), L0 = lat(i);
      if (armco(i) && Math.floor(C.s[i] / 4) !== Math.floor((j ? C.s[j] : C.length) / 4)) posts.push([C.x[i] + nx * L0, H(C, i) + 0.5, -(C.y[i] + ny * L0)]);
      if (Math.floor(C.s[i] / 8) !== Math.floor((j ? C.s[j] : C.length) / 8)) { const L1 = L0 + side * 1.5; fposts.push([C.x[i] + nx * L1, H(C, i) + 2.1, -(C.y[i] + ny * L1)]); }
    }
  }
  for (const [geoP, list, mat] of [[new THREE.BoxGeometry(0.12, 1.0, 0.12), posts, armcoMat], [new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6), fposts, new THREE.MeshStandardMaterial({ color: 0x8a9097, metalness: 0.6, roughness: 0.4 })]]) {
    const im = new THREE.InstancedMesh(geoP, mat, Math.max(1, list.length)); const m = new THREE.Matrix4();
    list.forEach((p, k) => { m.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(k, m); }); im.count = list.length; scene.add(im);
  }
  // Puente en los cruces del trazado (pretiles, tablero y pilares)
  if (geo.crossings && geo.crossings.length) {
    const concrete = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.85, side: THREE.DoubleSide });
    const up = i => H(C, i) > 0.6;
    scene.add(new THREE.Mesh(mergeGeometries([wallGeo(C, i => wl(i) + 0.4, -0.2, 1.0, up), wallGeo(C, i => -wr(i) - 0.4, -0.2, 1.0, up), surf(C, i => -wr(i) - 0.5, i => wl(i) + 0.5, { h: -0.25, test: up })]), concrete));
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 10), concrete, 200); const m = new THREE.Matrix4(); let n = 0;
    for (let i = 0; i < C.n && n < 200; i += 5) if (H(C, i) > 2 && clearOther(C.x[i], C.y[i], C.s[i], 40) > 1) { m.compose(new THREE.Vector3(C.x[i], H(C, i) / 2 - 0.2, -C.y[i]), new THREE.Quaternion(), new THREE.Vector3(1, H(C, i), 1)); im.setMatrixAt(n++, m); }
    im.count = n; scene.add(im);
  }

  // Salida: línea a cuadros, pórtico con semáforo y casillas de parrilla
  const p0 = pointOn(C, 0), th0 = Math.atan2(p0.ty, p0.tx), w0 = C.wl[0] + C.wr[0];
  const mid = pointOn(C, 0, (C.wl[0] - C.wr[0]) / 2);
  {
    T.checker.repeat.set(1, Math.max(1, Math.round(w0 / 2)));
    const chk = new THREE.Mesh(new THREE.PlaneGeometry(1.6, w0), new THREE.MeshStandardMaterial({ map: T.checker, ...off(-5) }));
    chk.rotation.set(-Math.PI / 2, 0, th0); chk.position.set(mid.x, H(C, 0) + 0.045, -mid.y); scene.add(chk);
  }
  const gantry = new THREE.Group(), gm = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.4, metalness: 0.7 });
  for (const z of [w0 / 2 + 2.2, -w0 / 2 - 2.2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), gm); post.position.set(0, 4, z); post.castShadow = true; gantry.add(post); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, w0 + 5), gm); beam.position.set(0, 7.6, 0); gantry.add(beam);
  const lightMats = [];
  for (let k = 0; k < 5; k++) {
    const lm = new THREE.MeshStandardMaterial({ color: 0x1a0000, emissive: 0xff1a10, emissiveIntensity: 0 }); lightMats.push(lm);
    for (const yy of [7.35, 7.85]) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), lm); b.position.set(-0.41, yy, (k - 2) * 0.62); b.rotation.y = -Math.PI / 2; gantry.add(b); }
  }
  gantry.position.set(mid.x, H(C, 0), -mid.y); gantry.rotation.y = th0; scene.add(gantry);
  {
    const marks = [];
    for (let k = 0; k < 24; k++) {
      const d = C.length - 10 - k * 8, side = k % 2 ? -2.6 : 2.6, p = pointOn(C, d, side + (C.wl[0] - C.wr[0]) / 2), th = Math.atan2(p.ty, p.tx);
      const g1 = new THREE.PlaneGeometry(0.22, 2.2), g2 = new THREE.PlaneGeometry(1.2, 0.18);
      g2.translate(0.6, side > 0 ? -1.0 : 1.0, 0);
      for (const g of [g1, g2]) { g.rotateX(-Math.PI / 2); g.rotateY(th); g.translate(p.x, H(C, segIndex(C, d)) + 0.05, -p.y); marks.push(g); }
    }
    scene.add(new THREE.Mesh(mergeGeometries(marks), new THREE.MeshStandardMaterial({ color: 0xffffff, ...off(-5) })));
  }

  // Garajes por equipo y edificio de boxes
  const teams = [...new Map(cars.map(c => [c.teamId, c.color])).entries()];
  const slotOf = {};
  {
    const wallM = new THREE.MeshStandardMaterial({ color: 0x34383f, roughness: 0.7 }), glass = new THREE.MeshStandardMaterial({ color: 0x1e2a36, roughness: 0.1, metalness: 0.9 });
    const lit = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff4e0, emissiveIntensity: 0.6 });
    const spanP = (PIT_OUT - 70) - (PIT_IN + 70), wG = Math.max(8, spanP / Math.max(1, teams.length) - 1.2);
    teams.forEach(([tid, color], k) => {
      const r = PIT_IN + 70 + (teams.length > 1 ? k * spanP / (teams.length - 1) : spanP / 2);
      slotOf[tid] = r;
      const d = (r + C.length) % C.length, i = segIndex(C, d);
      const p = pointOn(C, d, -(wallLat(i) + 15.5)), th = Math.atan2(p.ty, p.tx);
      if (clearOther(p.x, p.y, C.s[i], 120) < 6) return;
      const gar = new THREE.Group();
      const bx = new THREE.Mesh(new THREE.BoxGeometry(wG, 6, 10), wallM); bx.position.y = 3; bx.castShadow = true;
      const inside = new THREE.Mesh(new THREE.PlaneGeometry(wG - 2, 3.8), lit); inside.position.set(0, 1.9, 5.02);
      const band = new THREE.Mesh(new THREE.PlaneGeometry(wG, 1.3), new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.25 })); band.position.set(0, 4.8, 5.03);
      gar.add(bx, inside, band); gar.position.set(p.x, H(C, i), -p.y); gar.rotation.y = th + Math.PI; scene.add(gar);
    });
    const midR = (PIT_IN + PIT_OUT) / 2, d = (midR + C.length) % C.length, i = segIndex(C, d);
    const p = pointOn(C, d, -(wallLat(i) + 30)), th = Math.atan2(p.ty, p.tx);
    if (clearOther(p.x, p.y, C.s[i], 160) > 14) {
      const pad = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(spanP + 60, 9, 16), new THREE.MeshStandardMaterial({ color: 0xe3e6ea, roughness: 0.5, metalness: 0.2 })); b1.position.y = 4.5;
      const g1 = new THREE.Mesh(new THREE.BoxGeometry(spanP + 58, 4, 16.2), glass); g1.position.y = 11;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(spanP + 66, 0.6, 20), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 })); roof.position.y = 13.3;
      pad.add(b1, g1, roof); pad.children.forEach(m => { m.castShadow = true; });
      pad.position.set(p.x, 0, -p.y); pad.rotation.y = th; scene.add(pad);
    }
  }

  // Tribunas: recta de meta (izquierda) y exterior de las frenadas fuertes
  {
    const seatMat = new THREE.MeshStandardMaterial({ map: T.crowd, roughness: 0.95 }), steel = new THREE.MeshStandardMaterial({ color: 0x5d636c, roughness: 0.6, metalness: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide });
    const spots = [[-150, 1], [-60, 1], [30, 1], [120, 1]].map(([d, side]) => ({ d: (d + C.length) % C.length, side, len: 70 }));
    for (const b of (geo.brakes || []).slice().sort((a, b) => b.drop - a.drop).slice(0, 4)) {
      const i = segIndex(C, b.apex), side = kS[i] > 0 ? -1 : 1;
      spots.push({ d: (b.apex - 40 + C.length) % C.length, side, len: 60 });
    }
    for (const sp of spots) {
      const i = segIndex(C, sp.d), si = sp.side > 0 ? 0 : 1;
      const lat = sp.side * ((sp.side > 0 ? wl(i) : wr(i)) + KERB_W + runW(si, i) + 12);
      const p = pointOn(C, sp.d, lat), th = Math.atan2(p.ty, p.tx);
      if (clearOther(p.x, p.y, C.s[i], 200) < 22 || clearAll(p.x, p.y) < 10) continue;
      const g = new THREE.Group(), back = -sp.side;
      for (let r = 0; r < 6; r++) { const step = new THREE.Mesh(new THREE.BoxGeometry(sp.len, 1.1, 1.6), seatMat); step.position.set(0, 0.55 + r * 1.1, back * (r * 1.55 + 1)); step.castShadow = true; step.receiveShadow = true; g.add(step); }
      const wallB = new THREE.Mesh(new THREE.BoxGeometry(sp.len, 8, 0.5), steel); wallB.position.set(0, 4, back * 10.2); g.add(wallB);
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(sp.len + 4, 12), roofMat); roof.rotation.x = -Math.PI / 2 - back * 0.12; roof.position.set(0, 10.5, back * 5); roof.castShadow = true; g.add(roof);
      for (let x = -sp.len / 2; x <= sp.len / 2; x += sp.len / 4) { const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, 10.5, 0.3), steel); col.position.set(x, 5.25, back * 10); g.add(col); }
      const ad = new THREE.Mesh(new THREE.PlaneGeometry(sp.len, 1.1), new THREE.MeshStandardMaterial({ map: T.ads[Math.floor(rnd() * T.ads.length)] }));
      ad.position.set(0, 0.6, -back * 0.82); ad.rotation.y = back > 0 ? Math.PI : 0; g.add(ad);
      g.position.set(p.x, 0, -p.y); g.rotation.y = th; scene.add(g);
    }
  }
  // Vallas publicitarias junto a las barreras en las rectas
  {
    const adMats = T.ads.map(t => new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide }));
    const per = adMats.map(() => []);
    for (let d = 40; d < C.length; d += 45) {
      const i = segIndex(C, d);
      if (Math.abs(kS[i]) > 0.003) continue;
      const side = Math.floor(d / 45) % 2 ? 1 : -1, si = side > 0 ? 0 : 1;
      if (room[si][i] < 6 || (side < 0 && inPit(i))) continue;
      const lat = side * ((side > 0 ? wl(i) : wr(i)) + KERB_W + runW(si, i) + 0.9);
      const p = pointOn(C, d, lat), th = Math.atan2(p.ty, p.tx);
      const g = new THREE.PlaneGeometry(7, 1.2); g.rotateY(side > 0 ? Math.PI : 0); g.rotateY(th); g.translate(p.x, H(C, i) + 1.6, -p.y);
      per[Math.floor(rnd() * per.length)].push(g);
    }
    per.forEach((list, k) => { if (list.length) scene.add(new THREE.Mesh(mergeGeometries(list), adMats[k])); });
  }
  // Carteles de frenada 300/200/100
  {
    const mats = { 300: new THREE.MeshStandardMaterial({ map: T.sign(300), side: THREE.DoubleSide }), 200: new THREE.MeshStandardMaterial({ map: T.sign(200), side: THREE.DoubleSide }), 100: new THREE.MeshStandardMaterial({ map: T.sign(100), side: THREE.DoubleSide }) };
    for (const b of (geo.brakes || []).filter(b => b.drop > 22).slice(0, 14)) for (const [m, back] of [[300, 200], [200, 100], [100, 0]]) {
      const d = ((b.start - back) % C.length + C.length) % C.length, i = segIndex(C, d);
      const side = kS[segIndex(C, b.apex)] > 0 ? -1 : 1, si = side > 0 ? 0 : 1;
      const lat = side * ((side > 0 ? wl(i) : wr(i)) + KERB_W + Math.min(4, runW(si, i)));
      const p = pointOn(C, d, lat), th = Math.atan2(p.ty, p.tx);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), mats[m]);
      panel.position.set(p.x, H(C, i) + 1.4, -p.y); panel.rotation.y = th - Math.PI / 2; scene.add(panel);
    }
  }
  // Árboles y edificios, lejos del asfalto
  {
    const N = small ? 700 : 1500;
    const conifer = new THREE.InstancedMesh(mergeGeometries([new THREE.ConeGeometry(2.6, 6, 7).translate(0, 5.5, 0), new THREE.ConeGeometry(2.0, 5, 7).translate(0, 8.4, 0), new THREE.CylinderGeometry(0.3, 0.4, 3, 6).translate(0, 1.5, 0)].map(g => g.toNonIndexed())), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), N);
    const leafy = new THREE.InstancedMesh(mergeGeometries([new THREE.IcosahedronGeometry(3.2, 1).translate(0, 6.5, 0), new THREE.CylinderGeometry(0.35, 0.5, 4.5, 6).translate(0, 2.2, 0).toNonIndexed()]), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    let a = 0, b = 0;
    for (let t = 0; t < N * 8 && (a + b) < N * 1.2; t++) {
      const x = minX - 450 + rnd() * (maxX - minX + 900), y = minY - 450 + rnd() * (maxY - minY + 900);
      if (clearAll(x, y) < 28) continue;
      const k = 0.75 + rnd() * 0.7; s.set(k, k * (0.85 + rnd() * 0.4), k); q.setFromAxisAngle(up, rnd() * 6.28);
      m.compose(new THREE.Vector3(x, 0, -y), q, s);
      if (rnd() < 0.5 && a < N) { conifer.setMatrixAt(a, m); conifer.setColorAt(a++, col.setHSL(0.3 + rnd() * 0.05, 0.45, 0.22 + rnd() * 0.08)); }
      else if (b < N) { leafy.setMatrixAt(b, m); leafy.setColorAt(b++, col.setHSL(0.22 + rnd() * 0.08, 0.45, 0.28 + rnd() * 0.1)); }
    }
    conifer.count = a; leafy.count = b; conifer.castShadow = leafy.castShadow = true; scene.add(conifer, leafy);
    const bld = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: T.facade, roughness: 0.8 }), 90);
    let nb = 0;
    for (let t = 0; t < 3000 && nb < 90; t++) {
      const ang = rnd() * Math.PI * 2, r = Math.max(maxX - minX, maxY - minY) * 0.5 + 520 + rnd() * 600;
      const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r, h = 18 + rnd() * 80;
      if (clearAll(x, y) < 60) continue;
      m.compose(new THREE.Vector3(x, 0, -y), q.setFromAxisAngle(up, rnd() * 3), new THREE.Vector3(22 + rnd() * 30, h, 22 + rnd() * 30));
      bld.setMatrixAt(nb++, m);
    }
    bld.count = nb; scene.add(bld);
  }

  // Lluvia
  const RAIN_N = small ? 1500 : 3000, rainPos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) { const x = (rnd() - 0.5) * 120, y = rnd() * 60, z = (rnd() - 0.5) * 120; rainPos.set([x, y, z, x + 0.12, y + 0.9, z], i * 6); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainLines = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xb4c2cf, transparent: true, opacity: 0.45 }));
  rainLines.frustumCulled = false; rainLines.visible = false; scene.add(rainLines);

  // Coches: geometría compartida y materiales por equipo
  const TPL = buildCarTemplate();
  const shared = {
    carbon: new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.45, metalness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.8 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.3, metalness: 0.9 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 0.05, metalness: 0.9 }),
    blob: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, alphaMap: T.blob }),
  };
  const teamMats = new Map();
  const matsFor = color => {
    if (!teamMats.has(color)) teamMats.set(color, {
      paint: new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
      accent: new THREE.MeshPhysicalMaterial({ color: secondaryFor(color), roughness: 0.35, metalness: 0.2, clearcoat: 0.8 }),
    });
    return teamMats.get(color);
  };
  function makeCar(color, { helmet = '#f4f4f4', safety = false } = {}) {
    const M = matsFor(color), g = new THREE.Group();
    for (const [geoP, mat] of [[TPL.paint, M.paint], [TPL.carbon, shared.carbon], [TPL.accent, M.accent], [TPL.dark, shared.dark]]) { const m = new THREE.Mesh(geoP, mat); m.castShadow = true; g.add(m); }
    const hel = new THREE.Mesh(TPL.helmet, new THREE.MeshPhysicalMaterial({ color: helmet, roughness: 0.25, clearcoat: 1 })); hel.position.set(-0.02, 0.86, 0); hel.castShadow = true;
    const vis = new THREE.Mesh(TPL.visor, shared.visor); vis.position.copy(hel.position);
    g.add(hel, vis);
    const stripe = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const wheels = [];
    for (const [x, front, z] of [[1.85, true, 0.84], [1.85, true, -0.84], [-1.55, false, 0.82], [-1.55, false, -0.82]]) {
      const hub = new THREE.Group(), r = front ? 0.36 : 0.37, w = front ? 0.34 : 0.42;
      hub.position.set(x, r, z);
      const spin = new THREE.Group();
      const tyre = new THREE.Mesh(front ? TPL.tyreF : TPL.tyreR, shared.rubber); tyre.castShadow = true;
      const rimO = new THREE.Mesh(TPL.rim, shared.rim); rimO.position.z = Math.sign(z) * (w / 2 - 0.02);
      const st = new THREE.Mesh(TPL.stripe, stripe); st.position.z = Math.sign(z) * (w / 2 + 0.002);
      const spoke = new THREE.Mesh(TPL.spoke, shared.rim); spoke.position.z = Math.sign(z) * (w / 2 - 0.005);
      spin.add(tyre, rimO, st, spoke); hub.add(spin); g.add(hub);
      wheels.push({ hub, spin, front });
    }
    const rain = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.14), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 0 }));
    rain.position.set(-2.62, 0.5, 0); g.add(rain);
    const blob = new THREE.Mesh(TPL.blob, shared.blob); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; g.add(blob);
    let bar = null;
    if (safety) { bar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.9), new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0xffa000, emissiveIntensity: 2 })); bar.position.set(-0.2, 1.05, 0); g.add(bar); }
    return { group: g, wheels, stripe, rain, bar };
  }
  const units = new Map();
  for (const c of cars) {
    const u = makeCar(c.color, { helmet: c.mine ? '#ffd400' : secondaryFor(c.color) === '#f2f2f2' ? '#f4f4f4' : '#30343b' });
    const spray = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.soft, color: 0xdde6ee, transparent: true, opacity: 0, depthWrite: false }));
    spray.scale.set(9, 2.8, 1); scene.add(u.group, spray);
    units.set(c.id, { ...u, spray, lat: 0, dist: 0, spin: 0, data: c, parked: null, pos: new THREE.Vector3(), fwd: new THREE.Vector3(1, 0, 0), steer: 0, ci: 0 });
  }
  const scCar = makeCar('#c3c7cc', { safety: true }); scCar.group.visible = false; scCar.ci = 0; scene.add(scCar.group);

  // Etiquetas
  const labels = document.createElement('div'); labels.className = 'v3d-labels';
  const labelEls = new Map();
  for (const c of cars) { const el = document.createElement('span'); el.className = 'v3d-label' + (c.mine ? ' mine' : ''); labels.appendChild(el); labelEls.set(c.id, el); }

  // Cámaras de TV: solo en puntos despejados y elevadas
  const tvSpots = [];
  for (let d = 0, k = 0; d < C.length; d += 210, k++) {
    const i = segIndex(C, d);
    for (const side of [k % 2 ? 1 : -1, k % 2 ? -1 : 1]) {
      const si = side > 0 ? 0 : 1, lat = side * ((side > 0 ? wl(i) : wr(i)) + KERB_W + runW(si, i) + 6);
      const p = pointOn(C, d, lat);
      if (clearOther(p.x, p.y, C.s[i], 160) < 4 || (side < 0 && inPit(i))) continue;
      tvSpots.push(new THREE.Vector3(p.x, H(C, i) + 9 + (k % 3) * 3, -p.y)); break;
    }
  }

  let follow = (cars.find(c => c.mine) || cars[0]).id;
  let mode = 'chase', tvIdx = -1;
  const orbit = { yaw: 0.6, pitch: 0.35, dist: 22 };
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let first = true, wetNow = -1, elapsed = 0, lastTgt = null;

  // Interacción: arrastrar = cámara libre, rueda = zoom (en libre), clic = seguir coche
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ } });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) { if (mode !== 'free') { mode = 'free'; if (onCamera) onCamera('free'); } orbit.yaw -= dx * 0.006; orbit.pitch = Math.min(1.45, Math.max(0.05, orbit.pitch + dy * 0.005)); drag.x = e.clientX; drag.y = e.clientY; }
  });
  canvas.addEventListener('pointerup', e => {
    if (drag && !drag.moved) {
      const r = canvas.getBoundingClientRect(); let best = null, bd = 45;
      for (const [id, u] of units) {
        if (!u.group.visible) continue;
        const v = u.pos.clone().setY(u.pos.y + 0.8).project(camera);
        if (v.z > 1) continue;
        const d = Math.hypot((v.x + 1) / 2 * r.width - (e.clientX - r.left), (1 - v.y) / 2 * r.height - (e.clientY - r.top));
        if (d < bd) { bd = d; best = id; }
      }
      if (best) { follow = best; lastTgt = null; first = true; if (onFollow) onFollow(best); }
    }
    drag = null;
  });
  canvas.addEventListener('wheel', e => { if (mode !== 'free' && !e.ctrlKey) return; e.preventDefault(); if (mode !== 'free') { mode = 'free'; if (onCamera) onCamera('free'); } orbit.dist = Math.min(400, Math.max(6, orbit.dist * (e.deltaY > 0 ? 1.12 : 0.89))); }, { passive: false });

  function resize() { const w = container.clientWidth || 640, h = container.clientHeight || 360; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize);
  function attach(el) { container = el; el.appendChild(canvas); el.appendChild(labels); ro.disconnect(); ro.observe(el); resize(); }
  attach(container);

  function setWeather(w) {
    const wet = w > 0.25;
    if (wetNow < 0 || wet !== (wetNow > 0.25)) setSky(wet);
    if (wetNow >= 0 && Math.abs(w - wetNow) < 0.01) return;
    wetNow = w;
    scene.fog.color.set(wet ? 0x9aa3ad : 0xbfd3e6); scene.fog.near = 600 - 470 * w; scene.fog.far = 4800 - 3700 * w;
    sun.intensity = 3.2 * (1 - 0.7 * w); hemi.intensity = 0.55 + 0.25 * w;
    asphalt.roughness = 0.88 - 0.62 * w; asphalt.color.setScalar(1 - 0.4 * w); asphalt.envMapIntensity = 0.35 + 1.3 * w;
    renderer.toneMappingExposure = 0.85 - 0.12 * w;
  }

  // Índice de la línea central más cercano (para la altura y para mantener el coche en el asfalto)
  function nearestC(u, x, y, dist) {
    const guess = Math.round(dist / L.length * C.n) % C.n;
    let ci = u.ci || guess, best = Infinity;
    for (const base of [u.ci || guess, guess]) for (let k = -14; k <= 14; k++) { const j = (base + k + C.n) % C.n, dd = (C.x[j] - x) ** 2 + (C.y[j] - y) ** 2; if (dd < best) { best = dd; ci = j; } }
    u.ci = ci; return ci;
  }

  // state: { cars: [{ id, teamId, dist, lat, out, comp, pos, label, pit, grid, kmh }], wet, sc, lights, compColors }
  function frame(state, dt) {
    dt = Math.min(0.1, Math.max(0, dt)); elapsed += dt;
    setWeather(state.wet || 0);
    let leader = null;
    for (const c of state.cars) {
      const u = units.get(c.id); if (!u) continue;
      let dist = c.dist, latT = c.lat || 0;
      if (c.out) {
        if (!u.parked) { const i = u.ci || 0; u.parked = { dist: u.dist, lat: (u.lat >= 0 ? 1 : -1) * ((u.lat >= 0 ? C.wl[i] : C.wr[i]) + KERB_W + 3) }; }
        dist = u.parked.dist; latT = u.parked.lat;
      } else u.parked = null;
      u.lat += (latT - u.lat) * (first ? 1 : 1 - Math.exp(-dt * 6));
      const moved = ((dist - u.dist) % L.length + L.length) % L.length;
      u.spin += (moved < 200 ? moved : 0) / 0.36;
      u.dist = dist;
      let p = pointOn(L, dist, u.lat);
      const mix = (q, b) => { if (b <= 0) return; const tx = p.tx + (q.tx - p.tx) * b, ty = p.ty + (q.ty - p.ty) * b, l = Math.hypot(tx, ty) || 1; p = { x: p.x + (q.x - p.x) * b, y: p.y + (q.y - p.y) * b, tx: tx / l, ty: ty / l }; };
      if (c.grid) { const k = c.grid.k; mix(pointOn(C, C.length - 10 - k * 8, (k % 2 ? -2.6 : 2.6) + (C.wl[0] - C.wr[0]) / 2), 1 - c.grid.blend); }
      let ci = nearestC(u, p.x, p.y, dist);
      if (!c.out && !c.pit) {
        const nx = -C.ty[ci], ny = C.tx[ci], lat = (p.x - C.x[ci]) * nx + (p.y - C.y[ci]) * ny;
        const lim = Math.max(lat - (C.wl[ci] - 1.2), 0) + Math.min(lat + (C.wr[ci] - 1.2), 0);
        if (lim) p = { ...p, x: p.x - nx * lim, y: p.y - ny * lim };
      }
      if (c.pit) {
        const slot = slotOf[c.teamId] ?? 0;
        const r = c.pit.phase === 'in' ? PIT_IN + c.pit.t * (slot - PIT_IN) : c.pit.phase === 'stop' ? slot : slot + c.pit.t * (PIT_OUT - slot);
        const bl = c.pit.phase === 'in' ? Math.min(1, c.pit.t * -PIT_IN / 110) : c.pit.phase === 'out' ? Math.min(1, (1 - c.pit.t) * PIT_OUT / 110) : 1;
        const d = (r + C.length) % C.length, i = segIndex(C, d);
        mix(pointOn(C, d, -(wallLat(i) + (c.pit.phase === 'stop' ? 8.2 : 3.4))), bl * bl * (3 - 2 * bl));
        ci = nearestC(u, p.x, p.y, dist);
      }
      // El coche gira ligeramente al cambiar de carril en lugar de deslizarse de lado
      const yawExtra = Math.max(-0.12, Math.min(0.12, (latT - u.lat) * 0.04));
      const y = H(C, ci);
      u.pos.set(p.x, y + 0.01, -p.y); u.fwd.set(p.tx, 0, -p.ty);
      u.group.position.copy(u.pos); u.group.rotation.y = Math.atan2(p.ty, p.tx) + yawExtra;
      const steer = Math.max(-0.35, Math.min(0.35, (geo.lineK[segIndex(L, dist)] || 0) * 9)) + yawExtra * 2;
      u.steer += (steer - u.steer) * Math.min(1, dt * 8);
      for (const w of u.wheels) { w.spin.rotation.z = -u.spin; if (w.front) w.hub.rotation.y = c.pit && c.pit.phase === 'stop' ? 0 : u.steer; }
      if (state.compColors && c.comp) u.stripe.color.set(state.compColors[c.comp] || '#fff');
      u.rain.material.emissiveIntensity = (state.wet > 0.15 || state.sc) ? (Math.sin(elapsed * 12) > 0 ? 3 : 0.2) : 0;
      u.spray.material.opacity = c.out || (c.pit && c.pit.phase === 'stop') ? 0 : Math.min(0.75, (state.wet || 0) * 0.9) * Math.min(1, (c.kmh || 0) / 150);
      u.spray.position.copy(u.pos).addScaledVector(u.fwd, -4.6).setY(y + 0.9);
      u.kmh = c.kmh || 0; u.data = c;
      if (!c.out && !c.pit && (!leader || c.pos < leader.pos)) leader = c;
    }
    scCar.group.visible = state.sc === 'SC' && !!leader;
    if (scCar.group.visible) {
      const lu = units.get(leader.id), p = pointOn(L, leader.dist + 60, 0), ci = nearestC(scCar, p.x, p.y, leader.dist + 60);
      scCar.group.position.set(p.x, H(C, ci) + 0.01, -p.y); scCar.group.rotation.y = Math.atan2(p.ty, p.tx);
      for (const w of scCar.wheels) w.spin.rotation.z = -lu.spin;
      scCar.bar.material.emissiveIntensity = Math.sin(elapsed * 10) > 0 ? 3 : 0.4;
    }
    lightMats.forEach((m, k) => { m.emissiveIntensity = k < (state.lights || 0) ? 4 : 0; });

    // Cámara
    const u = units.get(follow) || units.values().next().value;
    const tgt = u.pos, fwd = u.fwd, side = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    let desired, look, fov = 58, smooth = 1 - Math.exp(-dt * (mode === 'chase' ? 9 : 5));
    if (mode === 'chase') { desired = tgt.clone().addScaledVector(fwd, -8.2).add(new THREE.Vector3(0, 2.5, 0)); look = tgt.clone().addScaledVector(fwd, 7).add(new THREE.Vector3(0, 0.8, 0)); fov = 55 + Math.max(0, Math.min(12, ((u.kmh || 0) - 120) / 18)); }
    else if (mode === 'onboard') { desired = tgt.clone().addScaledVector(fwd, -0.25).add(new THREE.Vector3(0, 1.12, 0)); look = tgt.clone().addScaledVector(fwd, 25).add(new THREE.Vector3(0, 0.7, 0)); fov = 74; smooth = 1; }
    else if (mode === 'heli') { desired = tgt.clone().addScaledVector(fwd, -45).addScaledVector(side, 25).add(new THREE.Vector3(0, 60, 0)); look = tgt.clone(); fov = 45; smooth = 1 - Math.exp(-dt * 2); }
    else if (mode === 'tv' && tvSpots.length) {
      // Prefiere cámaras hacia las que el coche se acerca (lo ve de frente o de lado, no alejándose)
      const score = s => { const v = s.clone().sub(tgt), d = v.length(), ahead = v.setY(0).normalize().dot(fwd); return d * (ahead > -0.2 ? 1 : 2.5); };
      let bi = tvIdx >= 0 ? tvIdx : 0, bs = tvIdx >= 0 ? score(tvSpots[tvIdx]) * 0.8 : Infinity;
      tvSpots.forEach((s, i) => { const sc = score(s); if (sc < bs) { bs = sc; bi = i; } });
      const bd = tvSpots[bi].distanceTo(tgt);
      if (bi !== tvIdx) { tvIdx = bi; camPos.copy(tvSpots[bi]); }
      desired = tvSpots[bi].clone(); look = tgt.clone().add(new THREE.Vector3(0, 0.7, 0));
      fov = Math.min(50, Math.max(4, 2 * Math.atan(10 / Math.max(1, bd)) * 180 / Math.PI)); smooth = 1;
    } else {
      desired = tgt.clone().add(new THREE.Vector3(Math.cos(orbit.yaw) * Math.cos(orbit.pitch), Math.sin(orbit.pitch), Math.sin(orbit.yaw) * Math.cos(orbit.pitch)).multiplyScalar(orbit.dist));
      look = tgt.clone().add(new THREE.Vector3(0, 0.6, 0)); fov = 55; smooth = 1 - Math.exp(-dt * 8);
    }
    if (lastTgt && mode !== 'tv') { const d = tgt.clone().sub(lastTgt); if (d.length() < 2000) { camPos.add(d); camLook.add(d); } }
    lastTgt = tgt.clone();
    if (first) { camPos.copy(desired); camLook.copy(look); first = false; }
    camPos.lerp(desired, smooth); camLook.lerp(look, mode === 'tv' ? 1 - Math.exp(-dt * 6) : smooth);
    if (mode === 'onboard') { camPos.copy(desired); camLook.copy(look); }
    if (camPos.y < tgt.y + 0.4) camPos.y = tgt.y + 0.4;
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
    sun.position.copy(tgt).addScaledVector(sunDir, 150); sun.target.position.copy(tgt);

    rainLines.visible = wetNow > 0.12;
    if (rainLines.visible) {
      rainLines.material.opacity = Math.min(0.6, wetNow * 0.8);
      const a = rainGeo.attributes.position.array, fall = dt * (28 + 20 * wetNow);
      for (let i = 0; i < RAIN_N; i++) { const o = i * 6; a[o + 1] -= fall; a[o + 4] -= fall; if (a[o + 1] < 0) { a[o + 1] += 60; a[o + 4] += 60; } }
      rainGeo.attributes.position.needsUpdate = true;
      rainLines.position.set(camera.position.x, 0, camera.position.z);
    }

    // Oculta coches que tapan la cámara (pegados a ella o entre la cámara y el coche seguido)
    {
      const toT = tgt.clone().sub(camera.position), dT = toT.length();
      for (const [id, un] of units) {
        if (id === follow) { un.group.visible = true; continue; }
        const v = un.pos.clone().sub(camera.position), d = v.length();
        un.group.visible = d > 5 && !(mode !== 'heli' && d < dT - 0.5 && v.angleTo(toT) < 0.4);
      }
    }
    renderer.render(scene, camera);

    // Etiquetas: coche seguido, los del jugador y los cercanos
    const r = canvas.getBoundingClientRect();
    for (const [id, el] of labelEls) {
      const un = units.get(id), d = un.data;
      const v = un.pos.clone().setY(un.pos.y + 1.6), dist = v.distanceTo(camera.position);
      v.project(camera);
      const show = d && un.group.visible && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && (id === follow || d.mine || dist < 70) && dist < 700;
      if (!show) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.textContent = d.out ? `${d.label} · OUT` : `P${d.pos} ${d.label}${d.pit ? ' · BOX' : ''}`;
      el.classList.toggle('foll', id === follow);
      el.style.transform = `translate(${((v.x + 1) / 2 * r.width).toFixed(0)}px, ${((1 - v.y) / 2 * r.height).toFixed(0)}px) translate(-50%, -100%)`;
    }
  }

  function dispose() {
    ro.disconnect();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { for (const k of ['map', 'bumpMap', 'alphaMap']) if (m[k]) m[k].dispose(); m.dispose(); }); });
    if (envRT) envRT.dispose();
    pmrem.dispose(); renderer.dispose(); canvas.remove(); labels.remove();
  }

  return {
    canvas, attach, frame, dispose,
    setFollow(id) { if (units.has(id)) { follow = id; lastTgt = null; first = true; } },
    getFollow: () => follow,
    setCamera(m) { mode = m; tvIdx = -1; first = true; if (m === 'free') orbit.dist = 22; },
    getCamera: () => mode,
    debug: () => ({ cam: camera.position.toArray(), car: (units.get(follow) || {}).pos?.toArray(), tv: tvSpots.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  };
}
