// Simulación de sesiones: clasificación, sprint y carrera vuelta a vuelta controlable en directo.
'use strict';

const COMPOUNDS = {
  S: { name: 'Blando',     short: 'B',  color: '#e8343a', pace: -0.7, deg: 0.085, life: 18 },
  M: { name: 'Medio',      short: 'M',  color: '#f5c518', pace: -0.3, deg: 0.055, life: 28 },
  H: { name: 'Duro',       short: 'D',  color: '#d9dde3', pace: 0,    deg: 0.036, life: 40 },
  I: { name: 'Intermedio', short: 'I',  color: '#2fbf71', pace: 0,    deg: 0.05,  life: 30 },
  W: { name: 'Lluvia',     short: 'LL', color: '#2f7bf5', pace: 0,    deg: 0.04,  life: 35 },
};
const DRY = ['S', 'M', 'H'];
const MODES = {
  push: { label: 'Atacar',    pace: -0.32, wear: 1.4, risk: 1.6 },
  norm: { label: 'Normal',    pace: 0,     wear: 1,   risk: 1 },
  save: { label: 'Conservar', pace: 0.38,  wear: 0.7, risk: 0.6 },
};
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

// Penalización (s/vuelta) de cada compuesto según la humedad de la pista (0 = seca, 1 = inundada)
function weatherPenalty(comp, w) {
  if (comp === 'I') return 18 * (w - 0.5) ** 2;
  if (comp === 'W') return 1 + 14 * (w - 0.9) ** 2;
  return 20 * Math.pow(w, 1.2);
}
function bestCompoundFor(w, dryChoice = 'M') {
  return [dryChoice, 'I', 'W'].sort((a, b) => weatherPenalty(a, w) - weatherPenalty(b, w))[0];
}
const isWetTyre = c => c === 'I' || c === 'W';
const stintMax = (comp, c) => COMPOUNDS[comp].life / c.wear;

// ---------- meteorología ----------
function makeWeather(c, laps) {
  const w = new Array(laps + 2).fill(0);
  const r = Math.random();
  let kind = 'dry';
  if (r < c.rain * 0.4) {
    kind = 'wet';
    let v = rand(0.5, 0.95); const dry = rand(0.004, 0.02);
    for (let i = 0; i < w.length; i++) { w[i] = clamp(v, 0, 1); v -= dry; }
  } else if (r < c.rain) {
    kind = 'shower';
    const start = randInt(3, Math.max(4, laps - 12)), len = randInt(5, Math.max(7, Math.floor(laps / 2)));
    const peak = rand(0.3, 0.9), dryRate = rand(0.02, 0.05);
    for (let i = 0; i < w.length; i++) {
      if (i < start) w[i] = 0;
      else if (i < start + len) w[i] = peak * Math.min(1, (i - start + 1) / 3);
      else w[i] = Math.max(0, peak - (i - start - len) * dryRate);
    }
  }
  // Previsión con incertidumbre: probabilidad de lluvia por cuartos de carrera
  const forecast = [0, 1, 2, 3].map(q => {
    const a = Math.floor(q * laps / 4), b = Math.floor((q + 1) * laps / 4);
    const rainy = w.slice(a, b + 1).some(x => x > 0.15);
    return Math.round(clamp(rainy ? rand(55, 95) : rand(0, c.rain * 100 * 0.8), 0, 100));
  });
  return { kind, w, forecast };
}

// ---------- rendimiento efectivo ----------
function staffRating(s, role) { return s.staff && s.staff[role] ? s.staff[role].rating : 75; }
function effectivePerf(s, d, c, w, setupQ) {
  const base = perf(s, d, c, false) * (1 - w) + perf(s, d, c, true) * w;
  const setup = (setupQ ?? 60) / 100 * 1.2;
  const eng = d.teamId === s.teamId ? (staffRating(s, 're') - 75) * 0.03 : 0;
  const morale = ((d.morale ?? 65) - 60) * 0.025;
  return base + setup + eng + morale;
}

// ---------- estrategias ----------
function strategyOptions(c, laps) {
  const seqs = [['M', 'H'], ['S', 'H'], ['H', 'M'], ['S', 'M'], ['S', 'M', 'S'], ['M', 'H', 'M'], ['S', 'S', 'M'], ['M', 'M', 'H'], ['S', 'H', 'S']];
  const opts = seqs.map(seq => {
    const lives = seq.map(x => COMPOUNDS[x].life);
    const sum = lives.reduce((a, b) => a + b, 0);
    let acc = 0;
    const lens = lives.map((l, i) => { if (i === seq.length - 1) return laps - acc; const n = Math.round(laps * l / sum); acc += n; return n; });
    const over = lens.reduce((a, n, i) => a + Math.max(0, n - stintMax(seq[i], c) * 1.02), 0);
    const time = lens.reduce((a, n, i) => a + n * COMPOUNDS[seq[i]].pace + COMPOUNDS[seq[i]].deg * c.wear * n * n / 2, 0) + (seq.length - 1) * 22 + over * 4;
    let lap = 0;
    const stops = lens.slice(0, -1).map((n, i) => ({ lap: (lap += n), compound: seq[i + 1] }));
    return { seq, stops, time, label: seq.map(x => COMPOUNDS[x].name).join(' → '), nStops: seq.length - 1 };
  }).sort((a, b) => a.time - b.time);
  const best = opts[0].time;
  opts.forEach(o => o.delta = o.time - best);
  return opts.slice(0, 4);
}
function aiPlan(c, laps, w0) {
  if (w0 > 0.15) return { start: bestCompoundFor(w0), stops: [] };
  const opts = strategyOptions(c, laps);
  const r = Math.random();
  const o = opts[r < 0.5 ? 0 : r < 0.8 ? 1 : 2] || opts[0];
  return { start: o.seq[0], stops: o.stops.map(x => ({ lap: clamp(x.lap + randInt(-3, 3), 2, laps - 2), compound: x.compound })) };
}

// ---------- clasificación ----------
function simulateQualifying(s, c, w, setups) {
  const ds = s.drivers.filter(d => d.teamId);
  const n = ds.length;
  const cut = Math.max(1, Math.floor((n - 10) / 2));
  const lapTime = d => {
    const p = effectivePerf(s, d, c, w, setups[d.teamId]);
    const comp = w > 0.15 ? bestCompoundFor(w, 'S') : 'S';
    return c.base - (p - 70) * 0.065 - 1.6 + COMPOUNDS[comp].pace + weatherPenalty(comp, w) + w * 6 + gauss(0.12 + (100 - d.cons) * 0.008) * (1 + w * 1.5);
  };
  let pool = ds.map(d => d.id);
  const sessions = [];
  const sizes = [n, n - cut, Math.min(10, n - cut)];
  const final = [];
  ['Q1', 'Q2', 'Q3'].forEach((name, si) => {
    const times = pool.map(id => ({ id, time: lapTime(driver(s, id)) })).sort((a, b) => a.time - b.time);
    const keep = si < 2 ? sizes[si + 1] : times.length;
    const out = times.slice(keep);
    sessions.push({ name, times, eliminated: out.map(x => x.id) });
    final.unshift(...out.map(x => x.id));
    pool = times.slice(0, keep).map(x => x.id);
  });
  const q3 = sessions[2].times.map(x => x.id);
  return { sessions, grid: [...q3, ...final.filter(id => !q3.includes(id))] };
}

// ---------- carrera ----------
class RaceSim {
  constructor(s, { kind = 'race', grid, setups = {}, weather, plans = {}, laps }) {
    this.s = s; this.kind = kind;
    this.c = s.calendar[s.round];
    this.totalLaps = laps || this.c.laps;
    this.weather = weather;
    this.lap = 0; this.events = []; this.sc = null; this.finished = false; this.scUsed = 0;
    this.stats = { ovt: 0, attempts: 0, repass: 0 };
    const w0 = weather.w[0];
    this.cars = grid.map((id, i) => {
      const d = driver(s, id);
      const mine = d.teamId === s.teamId;
      let plan = mine && plans[id] ? deepCopy(plans[id]) : null;
      if (!plan) plan = kind === 'sprint' ? { start: w0 > 0.15 ? bestCompoundFor(w0) : (Math.random() < 0.6 ? 'M' : 'S'), stops: [] } : aiPlan(this.c, this.totalLaps, w0);
      if (w0 > 0.15 && !isWetTyre(plan.start)) plan = { start: bestCompoundFor(w0), stops: [] };
      return {
        id, d, teamId: d.teamId, mine, grid: i + 1, setup: setups[d.teamId] ?? 60,
        compound: plan.start, used: [plan.start], plan: plan.stops, age: 0, wear: 0,
        mode: 'norm', auto: false, t: i * 0.22, out: false, outLap: 0, reason: '', best: Infinity, last: 0,
        pits: 0, box: null, pitted: false, penalty: 0, warned: {}, wxDelay: null,
      };
    });
    this.order = this.cars.map(x => x.id);
    this.byId = Object.fromEntries(this.cars.map(x => [x.id, x]));
    this.log(0, 'info', `${w0 > 0.15 ? '🌧️ Salida en mojado. ' : ''}Semáforos apagados... ¡comienza ${kind === 'sprint' ? 'el sprint' : 'la carrera'}!`);
    this.snap = this.snapshot();
  }

  log(lap, type, text, mine = false) { this.events.push({ lap, type, text, mine }); }
  get wet() { return this.weather.w[Math.min(this.lap, this.weather.w.length - 1)]; }
  remaining() { return this.totalLaps - this.lap; }
  active() { return this.order.filter(id => !this.byId[id].out).map(id => this.byId[id]); }

  // Órdenes del jugador
  requestBox(id, comp) { const x = this.byId[id]; if (x && !x.out) x.box = comp; }
  cancelBox(id) { const x = this.byId[id]; if (x) x.box = null; }
  setMode(id, mode) { const x = this.byId[id]; if (x) x.mode = mode; }
  setAuto(id, on) { const x = this.byId[id]; if (x) x.auto = on; }
  teamOrder(teamId) {
    const act = this.active();
    for (let i = 1; i < act.length; i++) {
      const A = act[i - 1], B = act[i];
      if (A.teamId === teamId && B.teamId === teamId) {
        if (B.t - A.t > 2.5) return 'Tus pilotos están demasiado separados para intercambiar posiciones.';
        const tA = A.t; B.t = tA; A.t = tA + 0.4;
        const ia = this.order.indexOf(A.id), ib = this.order.indexOf(B.id);
        [this.order[ia], this.order[ib]] = [this.order[ib], this.order[ia]];
        A.d.morale = clamp((A.d.morale ?? 65) - 8, 0, 100); B.d.morale = clamp((B.d.morale ?? 65) + 2, 0, 100);
        this.log(this.lap, 'radio', `📻 Orden de equipo: ${A.d.name} deja pasar a ${B.d.name}.`, true);
        this.snap = this.snapshot();
        return null;
      }
    }
    return 'Tus pilotos no van uno detrás del otro.';
  }

  needsSecondDry(x) { return this.kind === 'race' && !x.used.some(isWetTyre) && new Set(x.used).size < 2; }
  pickDry(x, rem) {
    const c = this.dryChoiceFor(rem);
    if (!this.needsSecondDry(x) || c !== x.used[0]) return c;
    return c === 'H' ? 'M' : c === 'M' ? (rem > stintMax('M', this.c) * 0.8 ? 'H' : 'S') : 'M';
  }
  dryChoiceFor(rem) {
    if (rem <= stintMax('S', this.c) * 0.95) return 'S';
    if (rem <= stintMax('M', this.c) * 0.95) return 'M';
    return 'H';
  }

  decide(x, lap) {
    if (x.box) return;
    const w = this.wet, rem = this.remaining() + 1;
    const ai = !x.mine || x.auto;
    const next = x.plan[0];
    if (next && lap >= next.lap && DRY.includes(x.compound) && w < 0.15) { x.box = next.compound; x.plan.shift(); return; }
    if (!ai) {
      const best = bestCompoundFor(w, this.dryChoiceFor(rem));
      if (weatherPenalty(x.compound, w) - weatherPenalty(best, w) > 1.2 && !x.warned['wx' + best]) {
        x.warned['wx' + best] = true;
        this.log(lap, 'radio', `📻 ${x.d.name}: «${isWetTyre(best) ? '¡Está lloviendo, necesito ' + COMPOUNDS[best].name.toLowerCase() + 's!' : 'La pista se está secando, ¡pongamos gomas de seco!'}»`, true);
      }
      if (x.wear > 80 && !x.warned.wear) { x.warned.wear = true; this.log(lap, 'radio', `📻 ${x.d.name}: «Los neumáticos están muy gastados (${Math.round(x.wear)}%).»`, true); }
      if (this.needsSecondDry(x) && !x.plan.length && rem === 15 && !x.warned.rule) { x.warned.rule = true; this.log(lap, 'radio', `📻 Ingeniero de ${x.d.name}: «Recuerda: aún tenemos que usar otro compuesto de seco o nos sancionarán.»`, true); }
      if (x.wear > 100 && !x.warned.cliff) { x.warned.cliff = true; this.log(lap, 'radio', `📻 ${x.d.name}: «¡No tengo agarre! ¡Hay que parar ya!»`, true); }
      return;
    }
    if (rem <= 2) return;
    // Contexto en pista: coche de delante y de detrás al empezar la vuelta
    const i = this.order.indexOf(x.id);
    const ahead = i > 0 ? this.byId[this.order[i - 1]] : null, behind = this.byId[this.order[i + 1]];
    const gapA = ahead && !ahead.out ? x.t - ahead.t : 99, gapB = behind && !behind.out ? behind.t - x.t : 99;
    // Ritmo: ahorra si los neumáticos no llegan a la parada prevista; ataca si tiene ritmo para pasar o en el final
    const perLap = 100 / COMPOUNDS[x.compound].life * this.c.wear;
    const lifeLeft = (100 - x.wear) / perLap, toStop = next ? next.lap - lap : rem;
    if (lifeLeft < toStop - 1 && toStop < rem) x.mode = 'save';
    else if (gapA < 1.0 && ahead && (x.lastClean ?? 99) < (ahead.lastClean ?? 0) - 0.05) x.mode = 'push';
    else if (rem <= 5 && (gapA < 1.6 || gapB < 1.0)) x.mode = 'push';
    else x.mode = lifeLeft < toStop + 2 && toStop < rem ? 'save' : 'norm';
    // Undercut si lleva varias vueltas atascado, o responde si el de detrás acaba de parar
    if (next && w < 0.15 && !this.sc) {
      x.stuck = gapA < 1.2 ? (x.stuck || 0) + 1 : 0;
      const soon = next.lap - lap;
      if (x.stuck >= 3 && soon > 0 && soon <= 7) { x.box = next.compound; x.plan.shift(); x.stuck = 0; return; }
      if (behind && behind.pitted && gapB < 2.5 && soon > 0 && soon <= 8) { x.box = next.compound; x.plan.shift(); return; }
    }
    // SC/VSC: parada barata
    if (this.sc && next && lap >= next.lap - 8 && w < 0.15) { x.box = next.compound; x.plan.shift(); return; }
    // Cambio de condiciones
    const best = bestCompoundFor(w, this.dryChoiceFor(rem));
    if (best !== x.compound && weatherPenalty(x.compound, w) - weatherPenalty(best, w) > 1.2) {
      if (x.wxDelay === null) x.wxDelay = randInt(0, 2);
      if (x.wxDelay-- <= 0) {
        x.box = isWetTyre(best) ? best : this.pickDry(x, rem); x.wxDelay = null; x.plan = [];
        if (!isWetTyre(best) && rem > stintMax(best, this.c)) x.plan = [{ lap: lap + Math.floor(rem / 2), compound: 'H' }];
      }
      return;
    }
    if (x.wear > 92 && rem > 4) { x.box = isWetTyre(x.compound) ? x.compound : this.pickDry(x, rem); x.plan = x.plan.filter(p => p.lap > lap + 6); return; }
    if (!x.plan.length && this.needsSecondDry(x) && rem <= 8 && w < 0.15) x.box = this.pickDry(x, rem);
  }

  step() {
    if (this.finished) return;
    const lap = ++this.lap, c = this.c, w = this.wet;
    const sc = this.sc;
    for (const x of this.active()) this.decide(x, lap);

    const lt = {};
    // Diferencia con el coche de delante al empezar la vuelta (aire sucio y alcance de DRS)
    const gap0 = {};
    { let prev = null; for (const x of this.active()) { gap0[x.id] = prev ? x.t - prev.t : 99; x.t0 = x.t; prev = x; } }
    for (const x of this.active()) {
      const m = MODES[x.mode], comp = COMPOUNDS[x.compound];
      x.pitted = false;
      let rate = 100 / comp.life * c.wear * m.wear;
      if (isWetTyre(x.compound) && w < 0.2) rate *= 3;
      if (!isWetTyre(x.compound) && w > 0.2) rate *= 0.6;
      x.age++; x.wear += rate;
      const p = effectivePerf(this.s, x.d, c, w, x.setup);
      const ageEq = x.wear / 100 * comp.life;
      const clean = c.base - (p - 70) * 0.058 + comp.pace + comp.deg * ageEq + Math.max(0, x.wear - 100) * 0.05
        + m.pace + weatherPenalty(x.compound, w) + w * 6 - lap * 0.025;
      x.clean = clean;
      let t = clean + gauss(0.12 + (100 - x.d.cons) * 0.008) * (1 + w);
      // Aire sucio: seguir de cerca cuesta tiempo en las curvas, menos en circuitos fáciles para adelantar
      if (gap0[x.id] < 1.0 && lap > 1) t += 0.18 * (1 - c.ovt);
      if (lap === 1) t += 1.5 + gauss((1.1 - x.d.craft / 100) * 1.5);
      if (sc && sc.type === 'VSC') t = c.base * 1.4 + gauss(0.05);
      if (sc && sc.type === 'SC') t = c.base * 1.5;

      // Pinchazo
      if (x.wear > 105 && Math.random() < 0.05) {
        t += 18; x.box = x.box || (isWetTyre(x.compound) ? x.compound : this.dryChoiceFor(this.remaining()));
        this.log(lap, 'warn', `💥 Pinchazo para ${x.d.name}.`, x.mine);
      }
      // Parada en boxes
      if (x.box && lap < this.totalLaps) {
        const crew = team(this.s, x.teamId).crew + (x.mine ? (staffRating(this.s, 'pc') - 75) * 0.4 : 0);
        let stat = 2.1 + Math.max(0, 100 - crew) * 0.02 + Math.abs(gauss(0.25));
        if (Math.random() < 0.05 * (1.4 - crew / 100) * 2) { stat += rand(2, 7); this.log(lap, 'warn', `🐢 Parada lenta para ${x.d.name} (${stat.toFixed(1)} s).`, x.mine); }
        const lane = sc ? (sc.type === 'SC' ? 9 : 12) : 19;
        t += lane + stat;
        if (x.mine) this.log(lap, 'pit', `🔧 ${x.d.name} entra en boxes: ${COMPOUNDS[x.box].name.toLowerCase()} (${stat.toFixed(1)} s).`, true);
        x.pitLoss = lane + stat;
        x.compound = x.box; x.box = null; x.age = 0; x.wear = 0; x.pits++; x.pitted = true;
        if (!x.used.includes(x.compound)) x.used.push(x.compound);
      }
      x.last = t; x.lastClean = clean;
      if (!x.pitted && !sc && lap > 1) x.best = Math.min(x.best, t);
      lt[x.id] = t;

      // Incidentes
      const rel = team(this.s, x.teamId).car.rel + (x.mine ? (staffRating(this.s, 'pc') - 75) * 0.15 : 0);
      const mech = (0.012 + Math.max(0, 100 - rel) * 0.0025) * Math.sqrt(m.risk) / this.totalLaps;
      const wrong = weatherPenalty(x.compound, w) > 2 ? 1 + weatherPenalty(x.compound, w) * 0.3 : 1;
      const crash = (0.004 + (100 - x.d.cons) * 0.0006) * m.risk * (1 + 3 * w) * wrong / this.totalLaps + (lap === 1 ? 0.004 : 0);
      if (!sc && Math.random() < crash) this.retire(x, lap, 'Accidente');
      else if (Math.random() < mech) this.retire(x, lap, pick(['Motor', 'Caja de cambios', 'Hidráulica', 'Frenos', 'Sistema eléctrico', 'Sobrecalentamiento']));
    }

    // Coche de seguridad aleatorio por restos en pista
    if (!this.sc && this.scUsed < 2 && lap > 1 && lap < this.totalLaps - 3 && Math.random() < c.sc * 0.3 / this.totalLaps) this.deploy(lap, Math.random() < 0.5 ? 'SC' : 'VSC', 'restos en la pista');

    // Posiciones y adelantamientos
    for (const x of this.cars) if (x.lostTo && lap - (x.lostLap || 0) > 2) x.lostTo = null;
    const act = this.order.filter(id => !this.byId[id].out && lt[id] !== undefined);
    const newOrder = [];
    for (const id of act) {
      const x = this.byId[id];
      x.t += lt[id];
      let pos = newOrder.length;
      while (pos > 0) {
        const ahead = this.byId[newOrder[pos - 1]];
        if (x.t >= ahead.t) break;
        const free = (ahead.pitted && !x.pitted) || ahead.t - x.t > 1.5;
        let ok = free;
        if (!ok && !sc) {
          // Ventaja de ritmo real (sin el ruido de la vuelta), DRS según el circuito, pericia y modo de ritmo
          const adv = (ahead.clean ?? 0) - (x.clean ?? 0);
          const inRange = (x.t0 - ahead.t0) < 1.0;
          // Cada circuito exige una ventaja mínima de ritmo para poder pasar (Monza ≈0,25 s/vuelta, Mónaco >2 s)
          const need = 0.2 + (1 - c.ovt) ** 2 * 2.1;
          let pr = 0.01 + c.ovt * 0.06 + (adv - need) * 0.45 + (x.d.craft - ahead.d.craft) / 150 + (x.mode === 'push' ? 0.05 : 0) - (ahead.mode === 'push' ? 0.04 : 0);
          if (!inRange) pr -= 0.15;
          if (x.lostTo === ahead.id && adv < 0.3) pr *= 0.25; // devolver el adelantamiento justo después es difícil
          ok = Math.random() < clamp(pr, 0.005, 0.8);
          // Toque en el intento
          if (Math.random() < 0.01 * MODES[x.mode].risk * (1 + 2 * w)) {
            const l1 = rand(1.5, 5), l2 = rand(1.5, 5); x.t += l1; ahead.t += l2;
            this.log(lap, 'warn', `💢 Toque entre ${x.d.name} y ${ahead.d.name}.`, x.mine || ahead.mine);
            if (x.t >= ahead.t) { x.t = Math.max(x.t, ahead.t + 0.3); break; }
          }
        }
        if (!free && !sc) this.stats.attempts++;
        if (ok) {
          pos--;
          if (!free) { this.stats.ovt++; if (x.lostTo === ahead.id || ahead.id === x.passedBy) this.stats.repass++; }
          if (!free) { ahead.t += 0.08 + Math.random() * 0.15; ahead.lostTo = x.id; ahead.lostLap = lap; }
          if (!free && (x.mine || ahead.mine)) this.log(lap, x.mine ? 'gain' : 'loss', `${x.mine ? '⬆️' : '⬇️'} ${x.d.name} adelanta a ${ahead.d.name} por la ${ordinal(pos + 1)} posición.`, true);
          if (pos === 0 && !free) this.log(lap, 'lead', `🏁 ${x.d.name} toma el liderato.`);
        } else { x.t = ahead.t + 0.25 + Math.random() * 0.25; if (!sc) ahead.t += Math.random() * 0.06; break; }
      }
      newOrder.splice(pos, 0, id);
      // Los coches que acaba de adelantar quedan detrás también en el tiempo (si luego se atascó tras otro coche)
      for (let k = pos + 1; k < newOrder.length; k++) {
        const behind = this.byId[newOrder[k]], front = this.byId[newOrder[k - 1]];
        if (behind.t <= front.t) behind.t = front.t + 0.15 + Math.random() * 0.1; else break;
      }
    }
    // Garantiza que el orden y los tiempos coinciden (la defensa y los toques pueden alterar tiempos ya asignados)
    for (let k = 1; k < newOrder.length; k++) { const b = this.byId[newOrder[k]], f = this.byId[newOrder[k - 1]]; if (b.t <= f.t) b.t = f.t + 0.12; }
    if (this.sc && this.sc.type === 'SC') {
      const lead = this.byId[newOrder[0]].t;
      newOrder.forEach((id, i) => { this.byId[id].t = lead + i * 0.6; });
    }
    if (this.sc) {
      this.sc.left--;
      if (this.sc.left <= 0) { this.log(lap, 'sc', this.sc.type === 'SC' ? '🟢 El coche de seguridad entra en boxes. ¡Relanzamiento!' : '🟢 Fin del coche de seguridad virtual.'); this.sc = null; }
    }
    const outs = this.order.filter(id => this.byId[id].out).sort((a, b) => this.byId[b].outLap - this.byId[a].outLap);
    this.order = [...newOrder, ...outs];

    if (lap >= this.totalLaps) this.finish();
    this.snap = this.snapshot();
  }

  retire(x, lap, reason) {
    x.out = true; x.outLap = lap; x.reason = reason;
    this.log(lap, 'dnf', `❌ Abandono de ${x.d.name}: ${reason.toLowerCase()}.`, x.mine);
    if (!this.sc && this.scUsed < 3 && lap < this.totalLaps - 2) {
      const r = Math.random();
      if (reason === 'Accidente' ? r < 0.55 : r < 0.15) this.deploy(lap, 'SC', 'accidente');
      else if (r < (reason === 'Accidente' ? 0.85 : 0.45)) this.deploy(lap, 'VSC', 'coche detenido');
    }
  }
  deploy(lap, type, why) {
    this.sc = { type, left: type === 'SC' ? randInt(3, 5) : randInt(2, 3) }; this.scUsed++;
    this.log(lap, 'sc', type === 'SC' ? `🟡 Coche de seguridad (${why}).` : `🟡 Coche de seguridad virtual (${why}).`);
  }

  finish() {
    this.finished = true;
    if (this.kind === 'race') {
      for (const x of this.cars) {
        if (x.out || x.used.some(isWetTyre)) continue;
        if (new Set(x.used.filter(c => DRY.includes(c))).size < 2) {
          x.penalty = 30; x.t += 30;
          this.log(this.lap, 'warn', `⚖️ ${x.d.name}: +30 s por no usar dos compuestos de seco.`, x.mine);
        }
      }
      const act = this.order.filter(id => !this.byId[id].out).sort((a, b) => this.byId[a].t - this.byId[b].t);
      this.order = [...act, ...this.order.filter(id => this.byId[id].out)];
    }
    const winner = this.byId[this.order[0]];
    const fl = this.cars.filter(x => !x.out && x.best < Infinity).sort((a, b) => a.best - b.best)[0];
    if (fl) this.log(this.lap, 'info', `⏱️ Vuelta rápida: ${fl.d.name} (${fmtLap(fl.best)}).`);
    this.log(this.lap, 'lead', `🏆 ¡${winner.d.name} gana ${this.kind === 'sprint' ? 'el sprint' : 'el ' + this.c.name}!`);
    this.flId = fl ? fl.id : null;
  }

  snapshot() {
    const act = this.order.filter(id => !this.byId[id].out);
    const lead = act.length ? this.byId[act[0]] : null;
    const ref = this.c.base;
    return {
      lap: this.lap,
      cars: this.order.map((id, i) => {
        const x = this.byId[id];
        const gap = x.out || !lead ? null : x.t - lead.t;
        return { id, pos: i + 1, gap, out: x.out, comp: x.compound, age: x.age, wear: x.wear, pitted: x.pitted, pitLoss: x.pitted ? x.pitLoss : 0, prog: x.out ? null : this.lap - (this.lap === 0 ? x.grid * 0.004 : gap / ref) };
      }),
    };
  }

  results() {
    const pts = this.kind === 'sprint' ? SPRINT_POINTS : pointsTable(this.s);
    const lead = this.byId[this.order[0]];
    return this.order.map((id, i) => {
      const x = this.byId[id];
      return {
        id, teamId: x.teamId, pos: i + 1, grid: x.grid, out: x.out, outLap: x.outLap, reason: x.reason,
        gap: x.out ? null : x.t - lead.t, total: x.t, pits: x.pits, used: x.used, fl: id === this.flId, penalty: x.penalty,
        pts: x.out ? 0 : (pts[i] || 0),
      };
    });
  }

  runToEnd() { while (!this.finished) this.step(); }
}
