// Motor del juego: simulación de carreras, desarrollo, economía y mercado.
'use strict';

const SAVE_KEY = 'paddockplus_save_v1';
const PILLARS = { aero: 'Aerodinámica', power: 'Unidad de potencia', chassis: 'Chasis', rel: 'Fiabilidad' };
const STRATS = {
  '1': { label: '1 parada', stints: [0.5] },
  '2': { label: '2 paradas', stints: [0.33, 0.66] },
};
const AGGR = {
  cons: { label: 'Conservador', pace: 0.15, deg: 0.8, risk: 0.6 },
  norm: { label: 'Equilibrado', pace: 0, deg: 1, risk: 1 },
  aggr: { label: 'Agresivo', pace: -0.2, deg: 1.3, risk: 1.7 },
};
const RD_SIZES = {
  small:  { label: 'Pequeño', cost: 4,  races: 1, min: 0.6, max: 1.4 },
  medium: { label: 'Mediano', cost: 9,  races: 2, min: 1.5, max: 3.0 },
  big:    { label: 'Grande',  cost: 16, races: 3, min: 3.0, max: 5.5 },
};

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

// ---------- creación de partida ----------
function newGame(teamId, roster = defaultRoster()) {
  const s = {
    version: 1, season: roster.startSeason || 2027, round: 0, teamId, phase: 'season', rosterName: roster.name,
    teams: deepCopy(roster.teams).map(t => ({ ...t, facility: 1, points: 0, history: [] })),
    drivers: deepCopy(roster.drivers),
    calendar: deepCopy(roster.calendar), baseCalendar: deepCopy(roster.calendar),
    sponsorNames: [...roster.sponsors], points: [...roster.points],
    raceResults: [], rd: [], ledger: [], news: [], history: [], sponsor: null, sponsorOffers: [],
    strategy: {}, nextDriverId: roster.drivers.length, lastRace: null,
  };
  s.regsBase = s.season - 1;
  const me = team(s, teamId);
  s.money = me.budget * 0.35; // caja disponible tras costes fijos
  s.sponsorOffers = makeSponsorOffers(s);
  addNews(s, `Bienvenido a ${me.name}. El consejo espera terminar ${ordinal(boardTarget(s))} o mejor.`);
  return s;
}

const team = (s, id) => s.teams.find(t => t.id === id);
const driver = (s, id) => s.drivers.find(d => d.id === id);
const teamDrivers = (s, id) => s.drivers.filter(d => d.teamId === id);
const myTeam = s => team(s, s.teamId);
const ordinal = n => n + 'º';
function addNews(s, text) { s.news.unshift({ season: s.season, round: s.round, text }); s.news = s.news.slice(0, 40); }
function ledger(s, label, amount) { s.money += amount; s.ledger.unshift({ season: s.season, round: s.round, label, amount }); s.ledger = s.ledger.slice(0, 80); }

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

function aiStrategy(c) {
  const stops = c.wear >= 1.15 ? (Math.random() < 0.7 ? '2' : '1') : (Math.random() < 0.8 ? '1' : '2');
  const r = Math.random();
  return { stops, aggr: r < 0.2 ? 'cons' : r < 0.85 ? 'norm' : 'aggr' };
}

// ---------- simulación de un fin de semana ----------
function simulateWeekend(s) {
  const c = s.calendar[s.round];
  const wet = Math.random() < c.rain;
  const grid = s.drivers.filter(d => d.teamId);
  const cars = grid.map(d => {
    const strat = d.teamId === s.teamId ? (s.strategy[d.id] || { stops: '1', aggr: 'norm' }) : aiStrategy(c);
    return { id: d.id, teamId: d.teamId, p: perf(s, d, c, wet), d, strat, t: 0, tyre: 0, out: false, outLap: 0, outReason: '', best: Infinity, pits: 0 };
  });

  // Clasificación
  cars.forEach(x => { x.q = x.p + gauss((wet ? 1.6 : 0.8) * (1.15 - x.d.cons / 100) * 2) ; });
  const qOrder = [...cars].sort((a, b) => b.q - a.q);
  const qTimes = qOrder.map((x, i) => ({ id: x.id, time: c.base - (x.q - 70) * 0.075 + (wet ? 8 : 0) - 1.2 }));
  qOrder.forEach((x, i) => { x.grid = i + 1; x.t = i * 0.25; });

  // Plan de paradas y averías
  cars.forEach(x => {
    x.pitLaps = STRATS[x.strat.stops].stints.map(f => clamp(Math.round(c.laps * f + randInt(-3, 3)), 3, c.laps - 3));
    const ag = AGGR[x.strat.aggr];
    const rel = team(s, x.teamId).car.rel;
    const mech = 0.02 + Math.max(0, 100 - rel) * 0.003;
    const crash = (0.008 + (100 - x.d.cons) * 0.0009) * ag.risk * (wet ? 2.2 : 1);
    if (Math.random() < mech) { x.failLap = randInt(1, c.laps); x.failReason = pick(['Motor', 'Caja de cambios', 'Hidráulica', 'Frenos', 'Sistema eléctrico']); }
    else if (Math.random() < crash) { x.failLap = randInt(1, c.laps); x.failReason = 'Accidente'; }
  });

  const events = [];
  const laps = [];
  let order = qOrder.map(x => x.id);
  const byId = Object.fromEntries(cars.map(x => [x.id, x]));
  let scLaps = 0;
  const scLap = Math.random() < c.sc ? randInt(2, c.laps - 6) : -1;
  if (wet) events.push({ lap: 0, type: 'info', text: '🌧️ Carrera en mojado: la consistencia será clave.' });
  events.push({ lap: 0, type: 'info', text: `Pole para ${qOrder[0].d.name} (${team(s, qOrder[0].teamId).name}).` });

  for (let lap = 1; lap <= c.laps; lap++) {
    const scActive = scLaps > 0;
    const lapTimes = {};
    for (const x of cars) {
      if (x.out) continue;
      const ag = AGGR[x.strat.aggr];
      x.tyre++;
      const deg = 0.045 * c.wear * ag.deg * x.tyre + (x.tyre > 30 / c.wear ? 0.08 * (x.tyre - 30 / c.wear) : 0);
      let lt = c.base - (x.p - 70) * 0.058 + ag.pace + deg - lap * 0.025 + gauss(0.18 + (100 - x.d.cons) * 0.012) * (wet ? 1.8 : 1);
      if (wet) lt += 8;
      if (lap === 1) lt += 2 + gauss(0.5 * (1.1 - x.d.craft / 100) * 3);
      x.pitted = false;
      const nextPit = x.pitLaps[x.pits];
      if (nextPit !== undefined && (lap >= nextPit || (scActive && lap >= nextPit - 6))) {
        const crew = team(s, x.teamId).crew;
        let stop = (scActive ? 11 : 21) + Math.max(0, gauss(0.6)) + (100 - crew) * 0.03;
        if (Math.random() < 0.04 * (1.3 - crew / 100) * 3) { stop += rand(3, 8); events.push({ lap, type: 'warn', text: `Parada lenta para ${x.d.name}.` }); }
        lt += stop; x.tyre = 0; x.pits++; x.pitted = true;
      }
      if (!x.pitted && !scActive) x.best = Math.min(x.best, lt);
      lapTimes[x.id] = lt;
      if (x.failLap === lap) {
        x.out = true; x.outLap = lap; x.outReason = x.failReason;
        events.push({ lap, type: 'dnf', text: `❌ Abandono de ${x.d.name}: ${x.failReason.toLowerCase()}.` });
        if (x.failReason === 'Accidente' && scLap < 0 && scLaps === 0 && Math.random() < 0.7 && lap < c.laps - 3) scLaps = 4, events.push({ lap, type: 'sc', text: '🟡 Coche de seguridad en pista.' });
      }
    }
    if (lap === scLap && scLaps === 0) { scLaps = 4; events.push({ lap, type: 'sc', text: '🟡 Coche de seguridad por restos en la pista.' }); }

    // Avance y adelantamientos
    const active = order.filter(id => !byId[id].out);
    const newOrder = [];
    for (const id of active) {
      const x = byId[id];
      x.t += lapTimes[id];
      let pos = newOrder.length;
      while (pos > 0) {
        const ahead = byId[newOrder[pos - 1]];
        if (x.t >= ahead.t) break;
        const free = ahead.pitted && !x.pitted || ahead.t - x.t > 1.5;
        let ok = free;
        if (!ok && !scActive) {
          const pr = clamp(0.15 + c.ovt * 0.45 + (ahead.t - x.t) * 0.4 + (x.d.craft - ahead.d.craft) / 60, 0.05, 0.92);
          ok = Math.random() < pr;
        }
        if (ok) {
          pos--;
          if (pos === 0 && !free) events.push({ lap, type: 'lead', text: `🏁 ${x.d.name} pasa a liderar.` });
        } else { x.t = ahead.t + 0.3 + Math.random() * 0.2; break; }
      }
      newOrder.splice(pos, 0, id);
    }
    if (scActive) {
      const lead = byId[newOrder[0]].t;
      newOrder.forEach((id, i) => { byId[id].t = lead + i * 0.6; });
      scLaps--;
      if (scLaps === 0) events.push({ lap, type: 'sc', text: '🟢 Bandera verde, se reanuda la carrera.' });
    }
    const outs = order.filter(id => byId[id].out);
    order = [...newOrder, ...outs.sort((a, b) => byId[b].outLap - byId[a].outLap)];
    const leadT = byId[order[0]].t;
    laps.push(order.map(id => ({ id, gap: byId[id].out ? null : byId[id].t - leadT, out: byId[id].out })));
  }

  // Resultados
  const fl = cars.filter(x => !x.out).sort((a, b) => a.best - b.best)[0];
  const leadT = byId[order[0]].t;
  const results = order.map((id, i) => {
    const x = byId[id];
    const pts = !x.out ? (pointsTable(s)[i] || 0) : 0;
    return { id, teamId: x.teamId, pos: i + 1, grid: x.grid, gap: x.out ? null : x.t - leadT, out: x.out, outLap: x.outLap, reason: x.outReason, pts, pits: x.pits, total: x.t, fl: fl && fl.id === id };
  });
  if (fl) events.push({ lap: c.laps, type: 'info', text: `⏱️ Vuelta rápida: ${fl.d.name} (${fmtLap(fl.best)}).` });
  events.push({ lap: c.laps, type: 'lead', text: `🏆 ¡${byId[order[0]].d.name} gana el ${c.name}!` });

  return { circuit: c.name, round: s.round, season: s.season, wet, qualy: qTimes, laps, events, results, totalLaps: c.laps };
}

function pointsTable(s) { return s.points || POINTS; }
function fmtLap(t) { const m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(3).padStart(6, '0'); }

// ---------- aplicar resultados ----------
function applyRace(s, race) {
  for (const r of race.results) {
    const d = driver(s, r.id);
    d.starts++;
    d.seasonPts = (d.seasonPts || 0) + r.pts;
    if (r.pos === 1 && !r.out) d.wins++;
    if (r.pos <= 3 && !r.out) d.podiums++;
    team(s, r.teamId).points += r.pts;
  }
  s.raceResults.push({ circuit: race.circuit, wet: race.wet, results: race.results.map(r => ({ id: r.id, teamId: r.teamId, pos: r.pos, pts: r.pts, out: r.out })) });

  // Economía del jugador
  const me = myTeam(s);
  const myPts = race.results.filter(r => r.teamId === s.teamId).reduce((a, r) => a + r.pts, 0);
  const ops = 2.2;
  const salaries = teamDrivers(s, s.teamId).reduce((a, d) => a + d.salary, 0) / s.calendar.length;
  ledger(s, `Costes operativos (${race.circuit})`, -ops);
  ledger(s, 'Salarios de pilotos', -salaries);
  if (s.sponsor) ledger(s, `Patrocinio: ${s.sponsor.name}`, s.sponsor.perRace);
  ledger(s, 'Ingresos comerciales base', 1 + me.budget * 0.012);
  if (myPts) ledger(s, `Premio por puntos (${myPts} pts)`, myPts * 0.12);
  const myBest = race.results.find(r => r.teamId === s.teamId);
  if (myBest && myBest.pos === 1) addNews(s, `¡Victoria para ${driver(s, myBest.id).name} en el ${race.circuit}!`);
  else if (myBest && myBest.pos <= 3) addNews(s, `Podio para ${driver(s, myBest.id).name} en el ${race.circuit}.`);
  race.results.filter(r => r.teamId === s.teamId && r.out).forEach(r => addNews(s, `${driver(s, r.id).name} abandonó en el ${race.circuit} (${r.reason.toLowerCase()}).`));

  // Proyectos de I+D
  const done = [];
  s.rd.forEach(p => { p.left--; if (p.left <= 0) done.push(p); });
  s.rd = s.rd.filter(p => p.left > 0);
  done.forEach(p => {
    const t = myTeam(s);
    const sz = RD_SIZES[p.size];
    const diminish = clamp(1 - (t.car[p.pillar] - 70) / 45, 0.2, 1.2);
    const gain = rand(sz.min, sz.max) * diminish * (0.9 + t.facility * 0.1);
    t.car[p.pillar] = Math.min(99, t.car[p.pillar] + gain);
    addNews(s, `🔧 Mejora de ${PILLARS[p.pillar].toLowerCase()} lista: +${gain.toFixed(1)}.`);
  });

  // Desarrollo de la IA
  s.teams.forEach(t => {
    if (t.id === s.teamId) return;
    const pillar = pick(Object.keys(PILLARS));
    const gain = rand(0, 1.3) * (t.budget / 110) * clamp(1 - (t.car[pillar] - 70) / 45, 0.2, 1.2);
    t.car[pillar] = Math.min(99, t.car[pillar] + gain);
  });

  s.lastRace = race;
  s.round++;
  if (s.round >= s.calendar.length) s.phase = 'seasonEnd';
  save(s);
}

// ---------- I+D ----------
function startRD(s, pillar, size) {
  const sz = RD_SIZES[size];
  if (s.rd.length >= 2) return 'Solo puedes tener 2 proyectos en curso.';
  if (s.rd.some(p => p.pillar === pillar)) return 'Ya hay un proyecto en esa área.';
  if (s.money < sz.cost) return 'Fondos insuficientes.';
  ledger(s, `I+D: ${PILLARS[pillar]} (${sz.label.toLowerCase()})`, -sz.cost);
  s.rd.push({ pillar, size, left: sz.races });
  save(s);
  return null;
}
function facilityCost(s) { return 20 + myTeam(s).facility * 12; }
function upgradeFacility(s) {
  const cost = facilityCost(s);
  if (myTeam(s).facility >= 5) return 'Las instalaciones ya están al máximo.';
  if (s.money < cost) return 'Fondos insuficientes.';
  ledger(s, `Ampliación de la fábrica (nivel ${myTeam(s).facility + 1})`, -cost);
  myTeam(s).facility++;
  save(s); return null;
}
function trainCrew(s) {
  const t = myTeam(s);
  if (t.crew >= 98) return 'El equipo de boxes ya es de élite.';
  if (s.money < 5) return 'Fondos insuficientes.';
  ledger(s, 'Entrenamiento del equipo de boxes', -5);
  t.crew = Math.min(98, t.crew + rand(1.5, 3.5));
  save(s); return null;
}

// ---------- clasificaciones ----------
function driverStandings(s) {
  return s.drivers.filter(d => d.seasonPts !== undefined || d.teamId)
    .map(d => ({ d, pts: d.seasonPts || 0, wins: s.raceResults.filter(r => r.results.some(x => x.id === d.id && x.pos === 1)).length }))
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins);
}
function teamStandings(s) { return [...s.teams].sort((a, b) => b.points - a.points); }

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
function chooseSponsor(s, i) { s.sponsor = s.sponsorOffers[i]; s.sponsorOffers = []; addNews(s, `Nuevo patrocinador principal: ${s.sponsor.name}.`); save(s); }

// ---------- final de temporada y pretemporada ----------
function endSeason(s) {
  const ds = driverStandings(s), ts = teamStandings(s);
  const champ = ds[0].d, champTeam = ts[0];
  champ.titles++;
  const myPos = ts.findIndex(t => t.id === s.teamId) + 1;
  s.history.push({ season: s.season, driver: champ.name, driverTeam: team(s, champ.teamId).name, team: champTeam.name, myPos, myPts: myTeam(s).points });

  ledger(s, `Premio de constructores (${ordinal(myPos)})`, Math.max(8, 70 - (myPos - 1) * 6));
  if (s.sponsor && s.sponsor.bonus && myPos <= s.sponsor.target) ledger(s, `Bonus de ${s.sponsor.name} (objetivo cumplido)`, s.sponsor.bonus);
  const target = boardTarget(s);
  const verdict = myPos <= target ? 'El consejo está satisfecho con la temporada.' : 'El consejo esperaba más. Mejora el próximo año.';
  addNews(s, `Fin de temporada ${s.season}: ${champ.name} campeón; ${champTeam.name} gana el título de constructores. Tu equipo: ${ordinal(myPos)}. ${verdict}`);

  // Reputación y presupuestos
  ts.forEach((t, i) => {
    const expected = s.teams.length - Math.round(t.rep / 100 * s.teams.length);
    t.rep = clamp(t.rep + (expected - i) * 1.5, 20, 99);
    t.budget = clamp(t.budget * 0.85 + Math.max(8, 70 - i * 6) * 0.3 + t.rep * 0.15, 45, 170);
    t.history.push({ season: s.season, pos: i + 1, pts: t.points });
    t.points = 0;
  });

  // Coches: regresión hacia la media, cambio de reglamento cada 4 años
  const regs = (s.season - (s.regsBase ?? 2026)) % 4 === 0;
  s.teams.forEach(t => {
    for (const k of Object.keys(t.car)) {
      const keep = regs ? 0.45 : 0.75;
      t.car[k] = 72 + (t.car[k] - 72) * keep + (t.budget - 100) * 0.05 + rand(-1.5, 1.5);
      if (regs) t.car[k] += gauss(2.5);
    }
  });
  if (regs) addNews(s, '📜 Nuevo reglamento técnico: el orden competitivo puede cambiar por completo.');
  s.rd = [];

  // Pilotos: edad, evolución, contratos, retiros
  s.drivers.forEach(d => {
    d.age++;
    d.seasonPts = undefined;
    if (d.age <= 26) { d.pace += (d.pot - d.pace) * rand(0.15, 0.35); d.craft += rand(0, 2); d.cons += rand(0, 2.5); }
    else if (d.age <= 31) { d.pace += rand(-0.6, 0.8); d.craft += rand(0, 1); d.cons += rand(0, 1); }
    else { d.pace -= rand(0.4, 1.8); d.craft -= rand(0, 0.8); d.cons += rand(-0.5, 0.5); }
    ['pace', 'craft', 'cons'].forEach(k => d[k] = clamp(d[k], 55, 99));
    if (d.teamId) d.contract--;
  });
  const retiring = s.drivers.filter(d => d.age >= 39 || (d.age >= 35 && Math.random() < 0.3));
  retiring.forEach(d => addNews(s, `👋 ${d.name} anuncia su retirada a los ${d.age} años (${d.titles} títulos, ${d.wins} victorias).`));
  s.retired = (s.retired || []).concat(retiring.map(d => d.name));
  s.drivers = s.drivers.filter(d => !retiring.includes(d));
  s.drivers.forEach(d => {
    if (!d.teamId || d.contract > 0) return;
    if (d.teamId !== s.teamId && Math.random() < 0.6) { d.contract = randInt(1, 3); d.salary = driverValue(d); return; } // la IA renueva
    if (d.teamId === s.teamId) addNews(s, `📄 El contrato de ${d.name} ha terminado: renuévalo o ficha a otro piloto.`);
    d.teamId = null; d.contract = 0;
  });

  // Nuevos talentos
  for (let i = 0; i < 4; i++) s.drivers.push(makeRookie(s));

  // Renovaciones automáticas de la IA (mantienen a sus mejores pilotos)
  s.season++;
  s.round = 0;
  s.raceResults = [];
  s.lastRace = null;
  s.phase = 'offseason';
  s.sponsor = null;
  s.sponsorOffers = makeSponsorOffers(s);
  s.calendar = deepCopy(s.baseCalendar || CIRCUITS);
  save(s);
}

function makeRookie(s) {
  const pot = randInt(80, 95);
  const pace = randInt(70, 79);
  return {
    id: 'd' + (s.nextDriverId++), name: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES), nat: pick(NATS), age: randInt(18, 20),
    pace, craft: randInt(68, 77), cons: randInt(66, 75), pot, teamId: null, salary: 1, contract: 0,
    titles: 0, wins: 0, podiums: 0, starts: 0, rookie: true,
  };
}

function freeAgents(s) { return s.drivers.filter(d => !d.teamId).sort((a, b) => driverRating(b) - driverRating(a)); }

function requiredSalary(s, d) {
  const rep = myTeam(s).rep;
  return Math.round(driverValue(d) * (1.3 - rep / 200) * 10) / 10;
}
function signDriver(s, id, salary, years) {
  const d = driver(s, id);
  if (teamDrivers(s, s.teamId).length >= 2) return 'Ya tienes dos pilotos. Libera un asiento primero.';
  if (d.teamId) return 'El piloto ya tiene equipo.';
  const req = requiredSalary(s, d);
  if (salary < req) return `${d.name} rechaza la oferta. Pide al menos ${fmtM(req)} por temporada.`;
  if (d.age < 18) return 'Los pilotos menores de 18 años no pueden competir.';
  d.teamId = s.teamId; d.salary = salary; d.contract = years;
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
  d.salary = requiredSalary(s, d); d.contract += years;
  addNews(s, `🔁 ${d.name} renueva por ${years} temporada(s) más (${fmtM(d.salary)}/año).`);
  save(s); return null;
}

function aiFillSeats(s) {
  const order = [...s.teams].filter(t => t.id !== s.teamId).sort((a, b) => b.rep - a.rep);
  for (const t of order) {
    while (teamDrivers(s, t.id).length < 2) {
      const pool = freeAgents(s).filter(d => d.age >= 18);
      const affordable = pool.filter(d => driverValue(d) <= t.budget / 8) ;
      const d = (affordable.length ? affordable : pool)[0];
      if (!d) { s.drivers.push(makeRookie(s)); continue; }
      d.teamId = t.id; d.salary = driverValue(d); d.contract = randInt(1, 3);
    }
  }
}

function startSeason(s) {
  if (teamDrivers(s, s.teamId).length < 2) return 'Necesitas dos pilotos titulares para empezar la temporada.';
  if (!s.sponsor) return 'Elige un patrocinador principal antes de empezar.';
  aiFillSeats(s);
  ledger(s, 'Asignación de presupuesto de temporada', myTeam(s).budget * 0.35);
  s.phase = 'season';
  addNews(s, `Arranca la temporada ${s.season}. Objetivo del consejo: ${ordinal(boardTarget(s))} o mejor.`);
  save(s); return null;
}

// ---------- guardado ----------
function save(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* almacenamiento no disponible */ } }
function load() { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ } }
