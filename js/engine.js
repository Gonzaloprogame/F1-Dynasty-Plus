// Motor de gestión: partida, fin de semana, desarrollo, personal, economía y mercado.
'use strict';

const SAVE_KEY = 'paddockplus_save_v1';
const SAVE_VERSION = 2;
const COST_CAP = 60; // M€ por temporada en I+D, fábrica y entrenamiento
const PILLARS = { aero: 'Aerodinámica', power: 'Unidad de potencia', chassis: 'Chasis', rel: 'Fiabilidad' };
const RD_SIZES = {
  small:  { label: 'Pequeño', cost: 4,  races: 1, min: 0.6, max: 1.4 },
  medium: { label: 'Mediano', cost: 9,  races: 2, min: 1.5, max: 3.0 },
  big:    { label: 'Grande',  cost: 16, races: 3, min: 3.0, max: 5.5 },
};
const STAFF_ROLES = {
  td: { label: 'Director técnico', desc: 'Multiplica las mejoras de I+D y reduce la pérdida de rendimiento en invierno.' },
  re: { label: 'Ingeniero de carrera', desc: 'Da más ritmo a tus pilotos y más precisión en los reglajes de prácticas.' },
  pc: { label: 'Jefe de mecánicos', desc: 'Paradas más rápidas y mejor fiabilidad.' },
};
const SETUP_KEYS = { wing: 'Ala delantera/trasera', susp: 'Rigidez de suspensión', height: 'Altura de carrocería' };

// ---------- utilidades ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function gauss(sd = 1) {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}
const deepCopy = o => JSON.parse(JSON.stringify(o));
const fmtM = n => (n < 0 ? '-' : '') + Math.abs(n).toFixed(1) + ' M€';
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ordinal = n => n + 'º';
function fmtLap(t) { const m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(3).padStart(6, '0'); }

// ---------- creación de partida ----------
function customizeRoster(roster, custom) {
  // Sustituye al equipo con menos prestigio por el equipo creado por el jugador.
  const r = deepCopy(roster);
  const weakest = [...r.teams].sort((a, b) => a.rep - b.rep)[0];
  const id = 'custom';
  Object.assign(weakest, {
    name: custom.name, short: (custom.short || custom.name).slice(0, 3).toUpperCase(), color: custom.color,
    rep: Math.max(weakest.rep, 40), budget: Math.max(weakest.budget, 80),
  });
  r.drivers.forEach(d => { if (d.teamId === weakest.id) d.teamId = id; });
  weakest.id = id;
  return { roster: r, teamId: id };
}

function newGame(teamId, roster = defaultRoster()) {
  const s = {
    version: SAVE_VERSION, season: roster.startSeason || 2027, round: 0, teamId, phase: 'season', rosterName: roster.name,
    teams: deepCopy(roster.teams).map(t => ({ ...t, facility: 1, points: 0, history: [] })),
    drivers: deepCopy(roster.drivers).map(d => ({ ...d, morale: 65 })),
    calendar: deepCopy(roster.calendar), baseCalendar: deepCopy(roster.calendar),
    sponsorNames: [...roster.sponsors], points: [...roster.points],
    raceResults: [], rd: [], ledger: [], news: [], history: [], sponsor: null, sponsorOffers: [],
    nextDriverId: roster.drivers.length, weekend: null, capSpent: 0, staffMarket: {},
  };
  s.regsBase = s.season - 1;
  const me = team(s, teamId);
  s.staff = Object.fromEntries(Object.keys(STAFF_ROLES).map(k => [k, makeStaff(k, 58 + me.rep * 0.3)]));
  s.staffMarket = makeStaffMarket(s);
  s.money = me.budget * 0.35;
  s.sponsorOffers = makeSponsorOffers(s);
  addNews(s, `Bienvenido a ${me.name}. El consejo espera terminar ${ordinal(boardTarget(s))} o mejor.`);
  return s;
}

// Adapta partidas guardadas con versiones anteriores.
function migrate(s) {
  if (!s) return s;
  if ((s.version || 1) < 2) {
    s.drivers.forEach(d => { if (d.morale === undefined) d.morale = 65; });
    s.staff = s.staff || Object.fromEntries(Object.keys(STAFF_ROLES).map(k => [k, makeStaff(k, 58 + myTeam(s).rep * 0.3)]));
    s.staffMarket = makeStaffMarket(s);
    s.capSpent = s.capSpent || 0;
    s.weekend = null;
    s.baseCalendar = s.baseCalendar || deepCopy(CIRCUITS);
    s.raceResults.forEach((r, i) => { r.round = r.round ?? i; r.kind = r.kind || 'race'; });
    s.version = 2;
  }
  return s;
}

const team = (s, id) => s.teams.find(t => t.id === id);
const driver = (s, id) => s.drivers.find(d => d.id === id);
const teamDrivers = (s, id) => s.drivers.filter(d => d.teamId === id);
const myTeam = s => team(s, s.teamId);
function addNews(s, text) { s.news.unshift({ season: s.season, round: s.round, text }); s.news = s.news.slice(0, 50); }
function ledger(s, label, amount) { s.money += amount; s.ledger.unshift({ season: s.season, round: s.round, label, amount }); s.ledger = s.ledger.slice(0, 100); }
function pointsTable(s) { return s.points || POINTS; }

function boardTarget(s) {
  const sorted = [...s.teams].sort((a, b) => b.rep - a.rep);
  return clamp(sorted.findIndex(t => t.id === s.teamId) + 1, 1, s.teams.length);
}

function driverRating(d) { return Math.round(d.pace * 0.6 + d.craft * 0.25 + d.cons * 0.15); }
function carRating(c) { return Math.round((c.aero + c.power + c.chassis + c.rel) / 4); }
function driverValue(d) {
  const r = driverRating(d);
  const youth = d.age < 24 ? (d.pot - r) * 0.15 : 0;
  return Math.max(0.8, Math.round((Math.pow(Math.max(0, r - 72), 1.8) * 0.12 + youth + 0.8) * 10) / 10);
}

// ---------- rendimiento ----------
function carScore(t, c) {
  const k = t.car;
  return (k.aero * c.df + k.power * c.pw + k.chassis) / (c.df + c.pw + 1);
}
function driverScore(d, wet) {
  return wet ? (d.wet ?? d.pace) * 0.45 + d.craft * 0.2 + d.cons * 0.35 : d.pace * 0.6 + d.craft * 0.25 + d.cons * 0.15;
}
function perf(s, d, c, wet) { return 0.62 * carScore(team(s, d.teamId), c) + 0.38 * driverScore(d, wet); }

// ---------- fin de semana ----------
// Fases: practice → (sprint) → qualy → race
function startWeekend(s) {
  const c = s.calendar[s.round];
  const setups = {};
  s.teams.forEach(t => { if (t.id !== s.teamId) setups[t.id] = Math.round(rand(55, 92)); });
  const target = { wing: clamp(Math.round(15 + c.df * 50 + rand(-8, 8)), 5, 95), susp: randInt(15, 85), height: randInt(15, 85) };
  s.weekend = {
    round: s.round, stage: 'practice', target, runsLeft: staffRating(s, 're') >= 85 ? 5 : 4, runs: [], setups,
    weather: makeWeather(c, c.laps), sprint: !!c.sprint,
  };
  save(s);
  return s.weekend;
}

function setupFeedback(s, vals) {
  const wk = s.weekend, precise = staffRating(s, 're') >= 85;
  const fb = {};
  let total = 0;
  for (const k of Object.keys(SETUP_KEYS)) {
    const diff = vals[k] - wk.target[k];
    const a = Math.abs(diff);
    total += a;
    const dir = diff > 0 ? 'alto' : 'bajo';
    fb[k] = a <= 4 ? { txt: '¡Perfecto!', cls: 'good' } : a <= 12 ? { txt: `Un poco ${dir}`, cls: 'warn' } : a <= 25 ? { txt: `Demasiado ${dir}`, cls: 'bad' } : { txt: `Muy ${dir}`, cls: 'bad' };
    if (precise && a > 4) fb[k].txt += ` (≈${Math.ceil(a / 5) * 5})`;
  }
  return { fb, quality: Math.round(clamp(100 - (total / 3) * 2.2, 0, 100)) };
}
function practiceRun(s, vals) {
  const wk = s.weekend;
  if (wk.runsLeft <= 0) return null;
  const r = setupFeedback(s, vals);
  wk.runsLeft--;
  wk.runs.push({ vals: { ...vals }, ...r });
  wk.best = Math.max(wk.best || 0, r.quality);
  save(s);
  return r;
}
function finishPractice(s) {
  const wk = s.weekend;
  wk.setups[s.teamId] = wk.best ?? Math.round(rand(45, 60));
  wk.stage = wk.sprint ? 'sprint' : 'qualy';
  save(s);
}
function applySession(s, results, kind) {
  for (const r of results) {
    const d = driver(s, r.id);
    d.seasonPts = (d.seasonPts || 0) + r.pts;
    team(s, r.teamId).points += r.pts;
  }
  s.raceResults.push({ round: s.round, kind, circuit: s.calendar[s.round].name, results: results.map(r => ({ id: r.id, teamId: r.teamId, pos: r.pos, pts: r.pts, out: r.out })) });
}
function finishSprint(s, results) {
  applySession(s, results, 'sprint');
  const myPts = results.filter(r => r.teamId === s.teamId).reduce((a, r) => a + r.pts, 0);
  if (myPts) ledger(s, `Premio por puntos en el sprint (${myPts} pts)`, myPts * 0.08);
  s.weekend.stage = 'qualy';
  save(s);
}
function runQualifying(s) {
  const wk = s.weekend;
  wk.qualy = simulateQualifying(s, s.calendar[s.round], wk.weather.w[0], wk.setups);
  save(s);
  return wk.qualy;
}

function finishRace(s, results, wet) {
  const c = s.calendar[s.round];
  for (const r of results) {
    const d = driver(s, r.id);
    d.starts++;
    if (r.pos === 1 && !r.out) d.wins++;
    if (r.pos <= 3 && !r.out) d.podiums++;
  }
  applySession(s, results, 'race');
  s.raceResults[s.raceResults.length - 1].wet = wet;

  // Moral de los pilotos
  results.forEach(r => {
    const d = driver(s, r.id);
    let delta = (65 - d.morale) * 0.1;
    if (r.out) delta -= r.reason === 'Accidente' ? 3 : 6;
    else if (r.pos === 1) delta += 12; else if (r.pos <= 3) delta += 8; else if (r.pts) delta += 3; else delta -= 2;
    const mate = results.find(x => x.teamId === r.teamId && x.id !== r.id);
    if (mate && !r.out && !mate.out) delta += r.pos < mate.pos ? 2 : -2;
    d.morale = clamp(d.morale + delta, 5, 100);
  });

  // Economía
  const me = myTeam(s);
  const myPts = results.filter(r => r.teamId === s.teamId).reduce((a, r) => a + r.pts, 0);
  const salaries = teamDrivers(s, s.teamId).reduce((a, d) => a + d.salary, 0) / s.calendar.length;
  const staffSal = Object.values(s.staff).reduce((a, x) => a + x.salary, 0) / s.calendar.length;
  ledger(s, `Costes operativos (${c.name})`, -2.2);
  ledger(s, 'Salarios de pilotos', -salaries);
  ledger(s, 'Salarios del personal técnico', -staffSal);
  if (s.sponsor) ledger(s, `Patrocinio: ${s.sponsor.name}`, s.sponsor.perRace);
  ledger(s, 'Ingresos comerciales', 1 + me.budget * 0.012);
  if (myPts) ledger(s, `Premio por puntos (${myPts} pts)`, myPts * 0.12);
  const myBest = results.find(r => r.teamId === s.teamId);
  if (myBest && myBest.pos === 1 && !myBest.out) addNews(s, `🏆 ¡Victoria para ${driver(s, myBest.id).name} en el ${c.name}!`);
  else if (myBest && myBest.pos <= 3 && !myBest.out) addNews(s, `🍾 Podio para ${driver(s, myBest.id).name} en el ${c.name}.`);
  results.filter(r => r.teamId === s.teamId && r.out).forEach(r => addNews(s, `${driver(s, r.id).name} abandonó en el ${c.name} (${r.reason.toLowerCase()}).`));

  // I+D del jugador
  const done = [];
  s.rd.forEach(p => { p.left--; if (p.left <= 0) done.push(p); });
  s.rd = s.rd.filter(p => p.left > 0);
  const tdMult = 0.75 + (staffRating(s, 'td') - 60) / 80;
  done.forEach(p => {
    const sz = RD_SIZES[p.size];
    const diminish = clamp(1 - (me.car[p.pillar] - 70) / 45, 0.2, 1.2);
    const fail = Math.random() < 0.08;
    const gain = fail ? 0 : rand(sz.min, sz.max) * diminish * (0.9 + me.facility * 0.1) * tdMult;
    me.car[p.pillar] = Math.min(99, me.car[p.pillar] + gain);
    addNews(s, fail ? `🧪 El proyecto de ${PILLARS[p.pillar].toLowerCase()} no ha dado resultado en el túnel de viento.` : `🔧 Mejora de ${PILLARS[p.pillar].toLowerCase()} lista: +${gain.toFixed(1)}.`);
  });
  // Desarrollo de la IA
  s.teams.forEach(t => {
    if (t.id === s.teamId) return;
    const pillar = pick(Object.keys(PILLARS));
    t.car[pillar] = Math.min(99, t.car[pillar] + rand(0, 1.3) * (t.budget / 110) * clamp(1 - (t.car[pillar] - 70) / 45, 0.2, 1.2));
  });

  s.weekend = null;
  s.round++;
  if (s.round >= s.calendar.length) s.phase = 'seasonEnd';
  save(s);
}

// ---------- I+D y límite de gasto ----------
function capLeft(s) { return COST_CAP - (s.capSpent || 0); }
function spend(s, label, cost) {
  if (s.money < cost) return 'Fondos insuficientes.';
  if (capLeft(s) < cost) return `Superarías el límite de gasto (quedan ${fmtM(capLeft(s))} esta temporada).`;
  ledger(s, label, -cost); s.capSpent = (s.capSpent || 0) + cost;
  return null;
}
function startRD(s, pillar, size) {
  const sz = RD_SIZES[size];
  if (s.rd.length >= 2) return 'Solo puedes tener 2 proyectos en curso.';
  if (s.rd.some(p => p.pillar === pillar)) return 'Ya hay un proyecto en esa área.';
  const e = spend(s, `I+D: ${PILLARS[pillar]} (${sz.label.toLowerCase()})`, sz.cost);
  if (e) return e;
  s.rd.push({ pillar, size, left: sz.races });
  save(s); return null;
}
function facilityCost(s) { return 20 + myTeam(s).facility * 12; }
function upgradeFacility(s) {
  if (myTeam(s).facility >= 5) return 'Las instalaciones ya están al máximo.';
  const e = spend(s, `Ampliación de la fábrica (nivel ${myTeam(s).facility + 1})`, facilityCost(s));
  if (e) return e;
  myTeam(s).facility++;
  save(s); return null;
}
function trainCrew(s) {
  const t = myTeam(s);
  if (t.crew >= 98) return 'El equipo de boxes ya es de élite.';
  const e = spend(s, 'Entrenamiento del equipo de boxes', 5);
  if (e) return e;
  t.crew = Math.min(98, t.crew + rand(1.5, 3.5));
  save(s); return null;
}

// ---------- personal ----------
function makeStaff(role, level) {
  const rating = Math.round(clamp(level + gauss(5), 55, 97));
  return { role, name: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES), nat: pick(NATS), rating, salary: Math.round((0.6 + Math.pow(Math.max(0, rating - 55), 1.6) * 0.03) * 10) / 10 };
}
function makeStaffMarket(s) {
  return Object.fromEntries(Object.keys(STAFF_ROLES).map(k => [k, Array.from({ length: 4 }, () => makeStaff(k, randInt(62, 92))).sort((a, b) => b.rating - a.rating)]));
}
function hireStaff(s, role, i) {
  const c = s.staffMarket[role][i];
  const fee = Math.round(c.salary * 0.5 * 10) / 10;
  const severance = Math.round(s.staff[role].salary * 0.5 * 10) / 10;
  if (s.money < fee + severance) return `Necesitas ${fmtM(fee + severance)} (prima de fichaje + despido).`;
  ledger(s, `Fichaje de ${c.name} (${STAFF_ROLES[role].label.toLowerCase()})`, -fee);
  ledger(s, `Despido de ${s.staff[role].name}`, -severance);
  addNews(s, `🧑‍🔧 ${c.name} es el nuevo ${STAFF_ROLES[role].label.toLowerCase()} (valoración ${c.rating}).`);
  s.staffMarket[role].splice(i, 1, makeStaff(role, randInt(60, 88)));
  s.staffMarket[role].sort((a, b) => b.rating - a.rating);
  s.staff[role] = c;
  save(s); return null;
}

// ---------- clasificaciones ----------
function driverStandings(s) {
  return s.drivers.filter(d => d.seasonPts !== undefined || d.teamId)
    .map(d => ({ d, pts: d.seasonPts || 0, wins: s.raceResults.filter(r => r.kind !== 'sprint' && r.results.some(x => x.id === d.id && x.pos === 1 && !x.out)).length }))
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins);
}
function teamStandings(s) { return [...s.teams].sort((a, b) => b.points - a.points); }
function pointsProgression(s, ids) {
  const rounds = [...new Set(s.raceResults.map(r => r.round))].sort((a, b) => a - b);
  const series = ids.map(id => {
    let acc = 0;
    return { id, values: rounds.map(i => { s.raceResults.filter(r => r.round === i).forEach(r => { const x = r.results.find(y => y.id === id); if (x) acc += x.pts; }); return acc; }) };
  });
  return { rounds, series };
}

// ---------- patrocinio ----------
function makeSponsorOffers(s) {
  const rep = myTeam(s).rep;
  const names = shuffle([...(s.sponsorNames || SPONSOR_NAMES)]).slice(0, 3);
  const kinds = [
    { tag: 'Seguro', mult: 0.85, target: 0, bonus: 0 },
    { tag: 'Equilibrado', mult: 0.7, target: -1, bonus: 10 },
    { tag: 'Ambicioso', mult: 0.5, target: -3, bonus: 25 },
  ];
  const tgt = boardTarget(s);
  return kinds.map((k, i) => ({
    name: names[i], tag: k.tag,
    perRace: Math.round((0.6 + rep / 60) * k.mult * 10) / 10,
    target: clamp(tgt + k.target, 1, s.teams.length),
    bonus: Math.round(k.bonus * (0.5 + rep / 100)),
  }));
}
function chooseSponsor(s, i) { s.sponsor = s.sponsorOffers[i]; s.sponsorOffers = []; addNews(s, `🤝 Nuevo patrocinador principal: ${s.sponsor.name}.`); save(s); }

// ---------- final de temporada y pretemporada ----------
function endSeason(s) {
  const ds = driverStandings(s), ts = teamStandings(s);
  const champ = ds[0].d, champTeam = ts[0];
  champ.titles++;
  const myPos = ts.findIndex(t => t.id === s.teamId) + 1;
  s.history.push({ season: s.season, driver: champ.name, driverTeam: team(s, champ.teamId)?.name || '—', team: champTeam.name, myPos, myPts: myTeam(s).points });

  ledger(s, `Premio de constructores (${ordinal(myPos)})`, Math.max(8, 70 - (myPos - 1) * 6));
  if (s.sponsor && s.sponsor.bonus && myPos <= s.sponsor.target) ledger(s, `Bonus de ${s.sponsor.name} (objetivo cumplido)`, s.sponsor.bonus);
  const verdict = myPos <= boardTarget(s) ? 'El consejo está satisfecho con la temporada.' : 'El consejo esperaba más. Mejora el próximo año.';
  addNews(s, `🏁 Fin de temporada ${s.season}: ${champ.name} campeón; ${champTeam.name} gana el título de constructores. Tu equipo: ${ordinal(myPos)}. ${verdict}`);

  ts.forEach((t, i) => {
    const expected = s.teams.length - Math.round(t.rep / 100 * s.teams.length);
    t.rep = clamp(t.rep + (expected - i) * 1.5, 20, 99);
    t.budget = clamp(t.budget * 0.85 + Math.max(8, 70 - i * 6) * 0.3 + t.rep * 0.15, 45, 170);
    t.history.push({ season: s.season, pos: i + 1, pts: t.points });
    t.points = 0;
  });

  // Coches: regresión hacia la media, cambio de reglamento cada 4 años
  const regs = (s.season - (s.regsBase ?? 2026)) % 4 === 0;
  const tdKeep = (staffRating(s, 'td') - 75) * 0.004;
  s.teams.forEach(t => {
    for (const k of Object.keys(t.car)) {
      const keep = (regs ? 0.45 : 0.75) + (t.id === s.teamId ? tdKeep : 0);
      t.car[k] = 72 + (t.car[k] - 72) * keep + (t.budget - 100) * 0.05 + rand(-1.5, 1.5);
      if (regs) t.car[k] += gauss(2.5);
    }
  });
  if (regs) addNews(s, '📜 Nuevo reglamento técnico: el orden competitivo puede cambiar por completo.');
  s.rd = [];
  s.capSpent = 0;

  s.drivers.forEach(d => {
    d.age++;
    d.seasonPts = undefined;
    if (d.age <= 26) { d.pace += (d.pot - d.pace) * rand(0.15, 0.35); d.craft += rand(0, 2); d.cons += rand(0, 2.5); }
    else if (d.age <= 31) { d.pace += rand(-0.6, 0.8); d.craft += rand(0, 1); d.cons += rand(0, 1); }
    else { d.pace -= rand(0.4, 1.8); d.craft -= rand(0, 0.8); d.cons += rand(-0.5, 0.5); }
    ['pace', 'craft', 'cons'].forEach(k => d[k] = clamp(d[k], 55, 99));
    d.morale = clamp((d.morale ?? 65) * 0.5 + 33, 0, 100);
    if (d.teamId) d.contract--;
  });
  const retiring = s.drivers.filter(d => d.age >= 39 || (d.age >= 35 && Math.random() < 0.3));
  retiring.forEach(d => addNews(s, `👋 ${d.name} anuncia su retirada a los ${d.age} años (${d.titles} títulos, ${d.wins} victorias).`));
  s.drivers = s.drivers.filter(d => !retiring.includes(d));
  s.drivers.forEach(d => {
    if (!d.teamId || d.contract > 0) return;
    if (d.teamId !== s.teamId && Math.random() < 0.6) { d.contract = randInt(1, 3); d.salary = driverValue(d); return; }
    if (d.teamId === s.teamId) addNews(s, `📄 El contrato de ${d.name} ha terminado: renuévalo o ficha a otro piloto.`);
    d.teamId = null; d.contract = 0;
  });
  for (let i = 0; i < 4; i++) s.drivers.push(makeRookie(s));

  s.season++;
  s.round = 0;
  s.raceResults = [];
  s.weekend = null;
  s.phase = 'offseason';
  s.sponsor = null;
  s.sponsorOffers = makeSponsorOffers(s);
  s.staffMarket = makeStaffMarket(s);
  s.calendar = deepCopy(s.baseCalendar || CIRCUITS);
  save(s);
}

function makeRookie(s) {
  return {
    id: 'd' + (s.nextDriverId++), name: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES), nat: pick(NATS), age: randInt(18, 20),
    pace: randInt(70, 79), craft: randInt(68, 77), cons: randInt(66, 75), pot: randInt(80, 95), teamId: null, salary: 1, contract: 0,
    titles: 0, wins: 0, podiums: 0, starts: 0, rookie: true, morale: 70,
  };
}

function freeAgents(s) { return s.drivers.filter(d => !d.teamId).sort((a, b) => driverRating(b) - driverRating(a)); }
function requiredSalary(s, d) { return Math.round(driverValue(d) * (1.3 - myTeam(s).rep / 200) * 10) / 10; }
function signDriver(s, id, salary, years) {
  const d = driver(s, id);
  if (teamDrivers(s, s.teamId).length >= 2) return 'Ya tienes dos pilotos. Libera un asiento primero.';
  if (d.teamId) return 'El piloto ya tiene equipo.';
  if (d.age < 18) return 'Los pilotos menores de 18 años no pueden competir.';
  const req = requiredSalary(s, d);
  if (!(salary >= req)) return `${d.name} rechaza la oferta. Pide al menos ${fmtM(req)} por temporada.`;
  d.teamId = s.teamId; d.salary = salary; d.contract = years; d.morale = clamp(60 + (salary - req) * 5, 60, 90);
  addNews(s, `✍️ ${d.name} firma por ${years} temporada(s) con ${myTeam(s).name}.`);
  save(s); return null;
}
function releaseDriver(s, id) {
  const d = driver(s, id);
  const fee = Math.round(d.salary * d.contract * 0.5 * 10) / 10;
  if (s.money < fee) return `Necesitas ${fmtM(fee)} para rescindir el contrato.`;
  if (fee) ledger(s, `Rescisión de ${d.name}`, -fee);
  d.teamId = null; d.contract = 0;
  addNews(s, `${d.name} deja el equipo.`);
  save(s); return null;
}
function renewDriver(s, id, years) {
  const d = driver(s, id);
  if (d.contract + years > 3) return 'Los contratos tienen un máximo de 3 temporadas.';
  if ((d.morale ?? 65) < 35) return `${d.name} está descontento (moral ${Math.round(d.morale)}) y no quiere renovar.`;
  d.salary = requiredSalary(s, d); d.contract += years;
  addNews(s, `🔁 ${d.name} renueva por ${years} temporada(s) más (${fmtM(d.salary)}/año).`);
  save(s); return null;
}

function aiFillSeats(s) {
  const order = [...s.teams].filter(t => t.id !== s.teamId).sort((a, b) => b.rep - a.rep);
  for (const t of order) {
    while (teamDrivers(s, t.id).length < 2) {
      const pool = freeAgents(s).filter(d => d.age >= 18);
      const affordable = pool.filter(d => driverValue(d) <= t.budget / 8);
      const d = (affordable.length ? affordable : pool)[0];
      if (!d) { s.drivers.push(makeRookie(s)); continue; }
      d.teamId = t.id; d.salary = driverValue(d); d.contract = randInt(1, 3); d.morale = 70;
    }
  }
}

function startSeason(s) {
  if (teamDrivers(s, s.teamId).length < 2) return 'Necesitas dos pilotos titulares para empezar la temporada.';
  if (!s.sponsor) return 'Elige un patrocinador principal antes de empezar.';
  aiFillSeats(s);
  ledger(s, 'Asignación de presupuesto de temporada', myTeam(s).budget * 0.35);
  s.phase = 'season';
  addNews(s, `🚦 Arranca la temporada ${s.season}. Objetivo del consejo: ${ordinal(boardTarget(s))} o mejor.`);
  save(s); return null;
}

// ---------- guardado ----------
function save(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* almacenamiento no disponible */ } }
function load() { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? migrate(JSON.parse(raw)) : null; } catch (e) { return null; } }
function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ } }
