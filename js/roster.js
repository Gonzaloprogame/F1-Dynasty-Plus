// Importador de plantillas externas.
// Admite el formato JSON que exporta el editor de plantillas de F1 Dynasty (f1dynasty.com),
// p. ej. las plantillas de la comunidad. Los archivos NO se incluyen en este repositorio:
// el jugador los carga en tiempo de ejecución y pertenecen a sus autores.
'use strict';

function defaultRoster() {
  return { name: 'Paddock Plus (ficticia)', teams: TEAMS, drivers: DRIVERS, calendar: CIRCUITS, sponsors: SPONSOR_NAMES, points: POINTS, startSeason: 2027 };
}

const NAT_CODES = {
  British: 'GBR', Dutch: 'NED', French: 'FRA', German: 'GER', Spanish: 'ESP', Italian: 'ITA', Australian: 'AUS', Canadian: 'CAN',
  Mexican: 'MEX', Brazilian: 'BRA', Finnish: 'FIN', Monegasque: 'MON', Thai: 'THA', 'New Zealand': 'NZL', 'New Zealander': 'NZL',
  Argentine: 'ARG', Argentinian: 'ARG', Japanese: 'JPN', Chinese: 'CHN', American: 'USA', Danish: 'DEN', Swiss: 'SUI', Belgian: 'BEL',
  Austrian: 'AUT', Swedish: 'SWE', Norwegian: 'NOR', Polish: 'POL', Estonian: 'EST', Irish: 'IRL', Indian: 'IND', Israeli: 'ISR',
  Colombian: 'COL', Chilean: 'CHI', Portuguese: 'POR', Czech: 'CZE', Russian: 'RUS', Korean: 'KOR', Indonesian: 'INA', Venezuelan: 'VEN',
  Uruguayan: 'URU', Peruvian: 'PER', Emirati: 'UAE', Saudi: 'KSA', Turkish: 'TUR', Hungarian: 'HUN', Greek: 'GRE', 'South African': 'RSA',
};
const RAIN_BY_COUNTRY = {
  UK: 0.35, Belgium: 0.4, Brazil: 0.4, Japan: 0.25, Singapore: 0.3, Malaysia: 0.4, Canada: 0.25, Netherlands: 0.3, Hungary: 0.15,
  Austria: 0.25, China: 0.2, Australia: 0.15, Qatar: 0.02, UAE: 0.01, Bahrain: 0.02, 'Saudi Arabia': 0.02, Azerbaijan: 0.05,
};

function rosterYears(raw) { return raw && raw.seasonDrivers ? Object.keys(raw.seasonDrivers).sort() : []; }

function convertExternalRoster(raw, driverSet, label) {
  if (!raw || !Array.isArray(raw.teams) || !raw.teams.length) throw new Error('El archivo no contiene equipos.');
  const avg = (...xs) => { const v = xs.filter(x => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 75; };
  const squash = x => clamp(65 + (x - 50) * 0.6, 60, 95);
  const engines = Object.fromEntries((raw.engineManufacturers || []).map(e => [e.id, e]));
  const useYear = driverSet && driverSet !== 'base' && raw.seasonDrivers && raw.seasonDrivers[driverSet];
  let n = 0;
  const seen = new Set();
  const mkDriver = (d, teamId) => {
    if (!d || !d.name || seen.has(d.name)) return null;
    seen.add(d.name);
    const pace = avg(d.qualifying, d.racePace, d.rating);
    return {
      id: 'd' + (n++), name: String(d.name), nat: NAT_CODES[d.nationality] || String(d.nationality || '—').slice(0, 3).toUpperCase(),
      age: d.age || 25, pace, craft: avg(d.racePace, d.aggression, d.rating), cons: avg(d.consistency, d.rating),
      wet: typeof d.wet === 'number' ? d.wet : undefined, pot: Math.max(d.potential || 0, pace),
      teamId, salary: Math.max(0.5, +d.salary || 1), contract: teamId ? clamp(d.contract || 1, 1, 3) : 0,
      titles: 0, wins: 0, podiums: 0, starts: 0,
    };
  };

  const teams = raw.teams.map(t => {
    const eng = engines[t.engineManufacturer] || {};
    let color = /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : '#888888';
    const lum = parseInt(color.slice(1, 3), 16) + parseInt(color.slice(3, 5), 16) + parseInt(color.slice(5, 7), 16);
    if (lum < 90) color = '#9aa0a6'; // los colores casi negros no se verían en el tema oscuro
    return {
      id: String(t.id), name: String(t.name), short: String(t.id).slice(0, 3).toUpperCase(), color,
      budget: clamp((t.revenue || 120) / 2, 45, 170), rep: clamp(t.prestige || 50, 20, 99),
      crew: clamp(60 + (t.facilities || 60) * 0.33, 60, 95),
      car: {
        aero: squash(avg(t.cornering, t.aeroEfficiency, t.carPerformance)),
        power: squash(avg(t.topSpeed, eng.powerRating, t.carPerformance)),
        chassis: squash(avg(t.carPerformance, t.tyreManagement, t.dirtyAir)),
        rel: clamp(62 + avg(t.reliability, eng.reliability) * 0.35, 70, 97),
      },
    };
  });

  const drivers = [];
  raw.teams.forEach(t => {
    const list = useYear ? (raw.seasonDrivers[driverSet][t.id] || []) : (t.baseDrivers || []);
    list.slice(0, 2).forEach(d => { const x = mkDriver(d, String(t.id)); if (x) drivers.push(x); });
  });
  const extras = [];
  Object.values(raw.reserveDrivers || {}).forEach(l => (l || []).forEach(d => extras.push(d)));
  (raw.namedFreeAgents || []).forEach(d => extras.push(d));
  (raw.namedProspects || []).forEach(d => extras.push(d));
  extras.filter(d => d && (d.age || 18) >= 17).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 40)
    .forEach(d => { const x = mkDriver(d, null); if (x) drivers.push(x); });

  const cal = (raw.customCalendar && raw.customCalendar.length ? raw.customCalendar : null);
  const calendar = cal ? cal.map(c => {
    const idf = typeof c.idealDownforce === 'number' ? c.idealDownforce : 60;
    const laps = c.laps || 57;
    return {
      name: String(c.name), city: String(c.location || c.country || ''), laps,
      base: Math.round((305 / laps) / (250 - idf * 0.7) * 3600 * 10) / 10,
      df: clamp(0.4 + idf / 90, 0.4, 1.5), pw: clamp(1.7 - idf / 80, 0.5, 1.6),
      wear: clamp(0.6 + (c.tireDeg ?? 0.5) * 0.8, 0.6, 1.4), ovt: clamp(1 - (c.overtakingDiff ?? 0.5), 0.05, 0.8),
      rain: RAIN_BY_COUNTRY[c.country] ?? 0.15, sc: clamp(c.safetyCar ?? 0.4, 0, 0.95),
    };
  }) : CIRCUITS;

  const sponsors = (raw.sponsorPool || []).map(s => s && s.name).filter(Boolean);
  const year = useYear ? +driverSet : 2026;
  return {
    name: label || 'Plantilla importada', teams, drivers, calendar,
    sponsors: sponsors.length >= 3 ? sponsors : SPONSOR_NAMES,
    points: Array.isArray(raw.customPoints) && raw.customPoints.length ? raw.customPoints : POINTS,
    startSeason: year,
  };
}
