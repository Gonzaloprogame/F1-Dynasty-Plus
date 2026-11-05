// Trazados 2D generados de forma procedural a partir del nombre del circuito (siempre el mismo dibujo para el mismo GP).
'use strict';

function hashStr(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) { let x = seed % 2147483647 || 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; }

function trackPoints(name) {
  const r = seeded(hashStr(name));
  const harm = [[2, 0.12 + r() * 0.18, r() * 6.28], [3, 0.05 + r() * 0.14, r() * 6.28], [5, r() * 0.07, r() * 6.28], [7, r() * 0.035, r() * 6.28]];
  const N = 18, pts = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    let rad = 1;
    for (const [k, a, ph] of harm) rad += a * Math.sin(k * th + ph);
    rad *= 0.92 + r() * 0.16;
    pts.push([Math.cos(th) * rad * 1.45, Math.sin(th) * rad]);
  }
  // Normaliza al lienzo 400x250
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sc = Math.min(360 / (maxX - minX), 210 / (maxY - minY));
  const ox = (400 - (maxX - minX) * sc) / 2, oy = (250 - (maxY - minY) * sc) / 2;
  return pts.map(([x, y]) => [ox + (x - minX) * sc, oy + (y - minY) * sc]);
}

function trackPathD(name) {
  const p = trackPoints(name), n = p.length;
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

function trackSVG(name, { id = 'trk', cars = '' } = {}) {
  const d = trackPathD(name);
  return `<svg class="track" viewBox="0 0 400 250" role="img" aria-label="Trazado de ${name.replace(/"/g, '')}">
    <path d="${d}" class="trk-run"/>
    <path d="${d}" class="trk-asphalt"/>
    <path d="${d}" class="trk-center" id="${id}"/>
    <g class="trk-start" id="${id}-start"></g>
    <g id="${id}-cars">${cars}</g>
  </svg>`;
}

// Coloca la línea de meta en el punto 0 del trazado (requiere que el SVG esté en el DOM)
function placeStartLine(id) {
  const path = document.getElementById(id), g = document.getElementById(id + '-start');
  if (!path || !g) return;
  const p0 = path.getPointAtLength(0), p1 = path.getPointAtLength(2);
  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
  g.innerHTML = `<rect x="-1.5" y="-8" width="3" height="16" fill="#fff" stroke="#111" stroke-width="0.6" transform="translate(${p0.x},${p0.y}) rotate(${ang})"/>`;
}
