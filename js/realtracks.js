// Circuitos reales a partir de la TUM racetrack-database (LGPL-3.0, datos de OpenStreetMap).
// Los CSV están en data/racetrack-database y se leen sin modificar. Si un circuito no está en la base
// de datos (o no se puede cargar), se usa el trazado procedural de track.js.
'use strict';

const TRACK_DATA_BASE = 'data/racetrack-database/';
// Patrones (sin tildes, en minúsculas) → archivo. Primero se busca la ciudad y luego el nombre del GP.
const REAL_TRACK_CITY = [
  [/\bsakhir\b|\bbahrein\b|\bbarein\b/, 'Sakhir'], [/\bmelbourne\b/, 'Melbourne'], [/\bsuzuka\b/, 'Suzuka'],
  [/\bshanghai\b/, 'Shanghai'], [/\bmontreal\b/, 'Montreal'], [/\bbarcelona\b|\bcatalun/, 'Catalunya'],
  [/\bspielberg\b/, 'Spielberg'], [/\bsilverstone\b/, 'Silverstone'], [/\bspa\b|francorchamps/, 'Spa'],
  [/\bbudapest\b|hungaroring/, 'Budapest'], [/\bmonza\b/, 'Monza'], [/\baustin\b/, 'Austin'],
  [/sao paulo|interlagos/, 'SaoPaulo'], [/\byas\b/, 'YasMarina'], [/\bzandvoort\b/, 'Zandvoort'],
  [/mexico city|ciudad de mexico/, 'MexicoCity'], [/\bsepang\b/, 'Sepang'], [/\bsochi\b/, 'Sochi'],
  [/\bhockenheim\b/, 'Hockenheim'], [/nurburgring|nuerburgring/, 'Nuerburgring'], [/brands hatch/, 'BrandsHatch'],
];
const REAL_TRACK_NAME = [
  [/australia/, 'Melbourne'], [/japon|japan/, 'Suzuka'], [/\bchina\b|chinese/, 'Shanghai'], [/canada|canadian/, 'Montreal'],
  [/austria/, 'Spielberg'], [/gran bretana|british/, 'Silverstone'], [/belgica|belgian/, 'Spa'], [/hungria|hungarian/, 'Budapest'],
  [/italia|italian/, 'Monza'], [/americas|united states/, 'Austin'], [/brasil|brazil/, 'SaoPaulo'], [/abu dab|abu dhab/, 'YasMarina'],
  [/mexico/, 'MexicoCity'], [/paises bajos|dutch/, 'Zandvoort'], [/malasia|malaysia/, 'Sepang'],
];
const TRACK_LABELS = {
  Sakhir: 'Sakhir', Melbourne: 'Albert Park', Suzuka: 'Suzuka', Shanghai: 'Shanghái', Montreal: 'Gilles Villeneuve',
  Catalunya: 'Barcelona-Cataluña', Spielberg: 'Spielberg', Silverstone: 'Silverstone', Spa: 'Spa-Francorchamps',
  Budapest: 'Hungaroring', Monza: 'Monza', Austin: 'Austin', SaoPaulo: 'Interlagos', YasMarina: 'Yas Marina',
  Zandvoort: 'Zandvoort', MexicoCity: 'Hermanos Rodríguez', Sepang: 'Sepang', Sochi: 'Sochi', Hockenheim: 'Hockenheim',
  Nuerburgring: 'Nürburgring', BrandsHatch: 'Brands Hatch',
};

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function realTrackKey(c) {
  if (!c) return null;
  const city = fold(c.city), name = fold(c.name);
  for (const [re, key] of REAL_TRACK_CITY) if (re.test(city)) return key;
  for (const [re, key] of REAL_TRACK_CITY) if (re.test(name)) return key;
  for (const [re, key] of REAL_TRACK_NAME) if (re.test(name)) return key;
  return null;
}

const TRACK_GEO = {};      // clave → geometría
const TRACK_PENDING = {};  // clave → promesa
function parseTrackCSV(txt) {
  return txt.split(/\r?\n/).filter(l => l && l[0] !== '#').map(l => l.split(',').map(Number)).filter(r => r.every(Number.isFinite));
}
function ensureRealTrack(c) {
  const key = realTrackKey(c);
  if (!key) return Promise.resolve(null);
  if (TRACK_GEO[key]) return Promise.resolve(TRACK_GEO[key]);
  // Abierto como archivo local (file://) el navegador no permite leer los CSV: se usa el trazado generado
  if (typeof location !== 'undefined' && location.protocol === 'file:') { TRACK_GEO[key] = null; return Promise.resolve(null); }
  if (!TRACK_PENDING[key]) {
    TRACK_PENDING[key] = Promise.all([
      fetch(TRACK_DATA_BASE + 'tracks/' + key + '.csv').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
      fetch(TRACK_DATA_BASE + 'racelines/' + key + '.csv').then(r => r.ok ? r.text() : null).catch(() => null),
    ]).then(([t, rl]) => {
      const rows = parseTrackCSV(t);
      const line = rl ? parseTrackCSV(rl) : null;
      TRACK_GEO[key] = buildTrackGeometry({
        key, real: true, label: TRACK_LABELS[key] || key,
        x: rows.map(r => r[0]), y: rows.map(r => r[1]), wr: rows.map(r => r[2]), wl: rows.map(r => r[3]),
        line: line && line.length > 20 ? { x: line.map(r => r[0]), y: line.map(r => r[1]) } : null,
      });
      return TRACK_GEO[key];
    }).catch(() => { TRACK_GEO[key] = null; return null; });
  }
  return TRACK_PENDING[key];
}

// Trazado procedural (mismo dibujo que el 2D) convertido a metros, para los circuitos sin datos reales.
const PROC_GEO = {};
function proceduralGeometry(c) {
  if (PROC_GEO[c.name]) return PROC_GEO[c.name];
  const p = trackPoints(c.name), n = p.length, xs = [], ys = [];
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const f = (a, b, cc, d) => 0.5 * ((2 * b) + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      xs.push(f(p0[0], p1[0], p2[0], p3[0])); ys.push(-f(p0[1], p1[1], p2[1], p3[1]));
    }
  }
  let len = 0;
  for (let i = 0; i < xs.length; i++) { const j = (i + 1) % xs.length; len += Math.hypot(xs[j] - xs[i], ys[j] - ys[i]); }
  const k = 4800 / len;
  return (PROC_GEO[c.name] = buildTrackGeometry({
    key: null, real: false, label: 'Trazado generado',
    x: xs.map(v => v * k), y: ys.map(v => v * k), wr: xs.map(() => 6.5), wl: xs.map(() => 6.5), line: null,
  }));
}
function getTrackGeometry(c) { const key = realTrackKey(c); return (key && TRACK_GEO[key]) || proceduralGeometry(c); }
function hasRealTrack(c) { const key = realTrackKey(c); return !!(key && TRACK_GEO[key]); }

// ---------- geometría ----------
function polyline(x, y) {
  const n = x.length, s = new Float64Array(n + 1), tx = new Float64Array(n), ty = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    s[i + 1] = s[i] + Math.hypot(x[j] - x[i], y[j] - y[i]);
    const a = (i - 1 + n) % n;
    const dx = x[j] - x[a], dy = y[j] - y[a], l = Math.hypot(dx, dy) || 1;
    tx[i] = dx / l; ty[i] = dy / l;
  }
  return { x, y, n, s, length: s[n], tx, ty };
}
function curvature(P) {
  const { x, y, n } = P, k = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 3 + n) % n, b = (i + 3) % n;
    const ax = x[a], ay = y[a], bx = x[i], by = y[i], cx = x[b], cy = y[b];
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d = Math.hypot(bx - ax, by - ay) * Math.hypot(cx - bx, cy - by) * Math.hypot(cx - ax, cy - ay);
    k[i] = d > 1e-9 ? 2 * cross / d : 0;
  }
  return k;
}
function buildTrackGeometry(g) {
  const C = polyline(g.x, g.y);
  C.wl = g.wl; C.wr = g.wr; C.k = curvature(C);
  const L = g.line ? polyline(g.line.x, g.line.y) : C;
  const k = L === C ? C.k : curvature(L);
  // Perfil de velocidad (m/s): límite por curvatura + aceleración y frenada finitas
  const n = L.n, v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.min(92, Math.sqrt(38 / Math.max(1e-5, Math.abs(k[i]))));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i <= n; i++) { const a = (i - 1) % n, b = i % n, ds = L.s[i] - L.s[i - 1]; v[b] = Math.min(v[b], Math.sqrt(v[a] * v[a] + 2 * 11 * ds)); }
    for (let i = n; i >= 1; i--) { const a = i % n, b = i - 1, ds = L.s[i] - L.s[i - 1]; v[b] = Math.min(v[b], Math.sqrt(v[a] * v[a] + 2 * 38 * ds)); }
  }
  const tau = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) tau[i + 1] = tau[i] + (L.s[i + 1] - L.s[i]) / Math.max(5, (v[i] + v[(i + 1) % n]) / 2);
  const lapTime = tau[n];
  const geo = { key: g.key, real: g.real, label: g.label, center: C, line: L, lineK: k, v, tau, lapTime };
  // Fracción del tiempo de vuelta → distancia recorrida sobre la trazada
  geo.fracToDist = f => {
    const t = (((f % 1) + 1) % 1) * lapTime;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tau[m] <= t) lo = m; else hi = m; }
    const seg = (t - tau[lo]) / ((tau[lo + 1] - tau[lo]) || 1);
    return L.s[lo] + seg * (L.s[lo + 1] - L.s[lo]);
  };
  geo.speedAt = d => v[segIndex(L, d)];
  return geo;
}
function segIndex(P, d) {
  d = ((d % P.length) + P.length) % P.length;
  let lo = 0, hi = P.n;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.s[m] <= d) lo = m; else hi = m; }
  return lo;
}
// Punto sobre una polilínea a la distancia d, desplazado lateralmente (positivo = izquierda)
function pointOn(P, d, lat = 0) {
  d = ((d % P.length) + P.length) % P.length;
  const i = segIndex(P, d), j = (i + 1) % P.n;
  const t = (d - P.s[i]) / ((P.s[i + 1] - P.s[i]) || 1);
  const tx = P.tx[i] + (P.tx[j] - P.tx[i]) * t, ty = P.ty[i] + (P.ty[j] - P.ty[i]) * t, l = Math.hypot(tx, ty) || 1;
  const ux = tx / l, uy = ty / l;
  return { x: P.x[i] + (P.x[j] - P.x[i]) * t - uy * lat, y: P.y[i] + (P.y[j] - P.y[i]) * t + ux * lat, tx: ux, ty: uy, i };
}

// Ruta SVG del trazado real, girada para que el lado largo quede en horizontal y ajustada a 400×250
function realTrackPathD(geo) {
  const C = geo.center, n = C.n;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += C.x[i]; my += C.y[i]; }
  mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const dx = C.x[i] - mx, dy = C.y[i] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ca = Math.cos(-ang), sa = Math.sin(-ang);
  const pts = [];
  for (let i = 0; i < n; i++) { const dx = C.x[i] - mx, dy = C.y[i] - my; pts.push([dx * ca - dy * sa, -(dx * sa + dy * ca)]); }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sc = Math.min(360 / (maxX - minX), 210 / (maxY - minY));
  const ox = (400 - (maxX - minX) * sc) / 2, oy = (250 - (maxY - minY) * sc) / 2;
  return 'M' + pts.map(([x, y]) => (ox + (x - minX) * sc).toFixed(1) + ',' + (oy + (y - minY) * sc).toFixed(1)).join(' L') + 'Z';
}
