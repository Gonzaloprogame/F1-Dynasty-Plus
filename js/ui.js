// Interfaz de usuario.
'use strict';

let S = load();
let view = S ? 'hq' : 'new';
let replay = null; // { race, lap, timer }
let roster = defaultRoster();      // plantilla elegida para la próxima partida
let rosterRaw = null, rosterLabel = '', rosterSet = 'base';
const EXAMPLE_ROSTER_URL = 'https://raw.githubusercontent.com/RuleImpossible3362/F1DynastyRosters/refs/heads/main/F1%20DYNASTY%202026%20ROSTER.json';

function useRoster(raw, label) {
  try {
    const years = rosterYears(raw);
    const set = years.includes(rosterSet) ? rosterSet : (years.length ? years[years.length - 1] : 'base');
    roster = convertExternalRoster(raw, set, label);
    rosterRaw = raw; rosterLabel = label; rosterSet = set;
    toast(`Plantilla cargada: ${roster.teams.length} equipos, ${roster.drivers.length} pilotos, ${roster.calendar.length} carreras.`);
  } catch (err) { toast('No se pudo leer la plantilla: ' + err.message); }
  render();
}

const $app = document.getElementById('app');
const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const teamChip = t => `<span class="chip" style="background:${t.color}"></span>`;
const r1 = n => Math.round(n);

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 3200);
}

function go(v) { view = v; if (v !== 'race') stopReplay(); render(); window.scrollTo(0, 0); }

// ---------- barra superior y pestañas ----------
function renderChrome() {
  const tabs = document.getElementById('tabs');
  const status = document.getElementById('status');
  if (!S) { tabs.innerHTML = ''; status.innerHTML = ''; return; }
  const me = myTeam(S);
  const items = [['hq', 'Cuartel general'], ['race', S.phase === 'season' ? 'Próxima carrera' : 'Temporada'], ['standings', 'Clasificación'], ['car', 'Coche e I+D'], ['drivers', 'Pilotos'], ['finance', 'Finanzas'], ['history', 'Historial'], ['settings', 'Partida']];
  tabs.innerHTML = items.map(([k, l]) => `<button class="${view === k ? 'active' : ''}" data-go="${k}">${l}</button>`).join('');
  const round = S.phase === 'season' ? `Ronda ${S.round + 1}/${S.calendar.length}` : S.phase === 'offseason' ? 'Pretemporada' : 'Fin de temporada';
  status.innerHTML = `<span>${teamChip(me)}<b>${esc(me.name)}</b></span><span>Temporada <b>${S.season}</b></span><span>${round}</span><span>Caja <b class="${S.money < 0 ? 'bad' : ''}">${fmtM(S.money)}</b></span>`;
}

// ---------- vistas ----------
const VIEWS = {
  new() {
    const years = rosterRaw ? rosterYears(rosterRaw) : [];
    return `<div class="card hero"><h1>Elige tu escudería</h1>
      <p class="muted">Dirige un equipo durante temporadas: ficha pilotos, invierte en I+D, gestiona patrocinadores y decide la estrategia de cada carrera. Los equipos punteros lo tienen más fácil; los modestos, más mérito.</p></div>
      <div class="card" style="margin-top:14px"><div class="row spread"><h3>Plantilla: ${esc(roster.name)}</h3>
        ${rosterRaw ? '<button class="btn sm ghost" data-act="rosterDefault">Volver a la ficticia</button>' : ''}</div>
        ${years.length ? `<div class="row small" style="margin-bottom:8px">Pilotos: <select id="rosterSet"><option value="base" ${rosterSet === 'base' ? 'selected' : ''}>Plantilla base</option>${years.map(y => `<option value="${y}" ${rosterSet === y ? 'selected' : ''}>Temporada ${y}</option>`).join('')}</select></div>` : ''}
        <p class="small muted">Puedes cargar una plantilla en formato JSON del editor de F1 Dynasty (por ejemplo, las de la comunidad), ya sea un archivo o una URL. Se importan los equipos, los pilotos, los reservas, los agentes libres, el calendario y los patrocinadores. Las plantillas pertenecen a sus autores y no se incluyen en Paddock Plus.</p>
        <div class="row"><input id="rosterUrl" type="url" placeholder="URL del JSON" value="${esc(EXAMPLE_ROSTER_URL)}" style="flex:1;min-width:200px">
          <button class="btn sm" data-act="rosterUrl">Cargar URL</button>
          <label class="btn sm ghost">Subir archivo<input type="file" accept=".json,application/json" id="rosterFile" hidden></label></div>
      </div>
      <div class="grid" style="margin-top:14px">${roster.teams.map(t => {
        const ds = roster.drivers.filter(d => d.teamId === t.id).map(d => esc(d.name)).join(' · ');
        return `<div class="card teampick" style="--c:${t.color}" data-act="pickTeam" data-id="${t.id}">
          <h3>${esc(t.name)}</h3>
          <div class="small muted">${ds}</div>
          <div class="row small" style="margin-top:8px"><span>Coche <b>${carRating(t.car)}</b></span><span>Presupuesto <b>${Math.round(t.budget)} M€</b></span><span>Prestigio <b>${t.rep}</b></span></div>
        </div>`;
      }).join('')}</div>`;
  },

  hq() {
    const me = myTeam(S), ts = teamStandings(S), ds = driverStandings(S);
    const pos = ts.findIndex(t => t.id === S.teamId) + 1;
    const next = S.calendar[S.round];
    let action = '';
    if (S.phase === 'season') action = `<h3>Siguiente: ${esc(next.name)}</h3><p class="muted small">${esc(next.city)} · ${next.laps} vueltas · probabilidad de lluvia ${r1(next.rain * 100)}%</p><button class="btn" data-go="race">Preparar la carrera</button>`;
    else if (S.phase === 'seasonEnd') action = `<h3>¡Temporada ${S.season} terminada!</h3><p class="muted small">Campeón: ${esc(ds[0].d.name)} · Constructores: ${esc(ts[0].name)}</p><button class="btn" data-act="endSeason">Cerrar temporada e ir a la pretemporada</button>`;
    else action = `<h3>Pretemporada ${S.season}</h3><p class="muted small">Ficha pilotos y elige patrocinador antes de arrancar.</p><button class="btn" data-go="drivers">Mercado de pilotos</button> <button class="btn ghost" data-go="finance">Patrocinadores</button> <button class="btn ghost" data-act="startSeason">Iniciar temporada</button>`;
    return `<div class="grid">
      <div class="card hero">${action}</div>
      <div class="card"><h3>Situación</h3>
        <div class="row spread"><div><div class="muted small">Constructores</div><div class="kpi">${S.phase === 'offseason' ? '—' : ordinal(pos)}</div></div>
        <div><div class="muted small">Objetivo del consejo</div><div class="kpi">${ordinal(boardTarget(S))}</div></div>
        <div><div class="muted small">Puntos</div><div class="kpi">${me.points}</div></div></div></div>
      <div class="card"><h3>Tus pilotos</h3>${teamDrivers(S, S.teamId).map(d => `<div class="row spread"><span>${esc(d.name)} <span class="badge">${d.nat}</span></span><span class="muted small">Media ${driverRating(d)} · ${d.seasonPts || 0} pts</span></div>`).join('') || '<p class="muted">Sin pilotos.</p>'}</div>
    </div>
    <div class="grid" style="margin-top:14px">
      <div class="card"><h3>Noticias</h3><div class="feed">${S.news.map(n => `<div><span class="badge">${n.season}</span> ${esc(n.text)}</div>`).join('')}</div></div>
      <div class="card"><h3>Top 5 pilotos</h3><table>${ds.slice(0, 5).map((x, i) => `<tr class="${x.d.teamId === S.teamId ? 'mine' : ''}"><td>${i + 1}</td><td>${x.d.teamId ? teamChip(team(S, x.d.teamId)) : ''}${esc(x.d.name)}</td><td class="num">${x.pts}</td></tr>`).join('')}</table></div>
    </div>`;
  },

  race() {
    if (replay) return raceReplayView();
    if (S.phase !== 'season') return `<div class="card"><p>No hay carrera pendiente.</p><button class="btn" data-go="hq">Volver al cuartel general</button></div>`;
    const c = S.calendar[S.round];
    const mine = teamDrivers(S, S.teamId);
    const rankings = [...S.teams].map(t => ({ t, sc: carScore(t, c) })).sort((a, b) => b.sc - a.sc);
    const myRank = rankings.findIndex(x => x.t.id === S.teamId) + 1;
    const trait = (v, lo, hi) => v > 1.15 ? hi : v < 0.85 ? lo : 'Media';
    return `<div class="grid">
      <div class="card hero"><h2>${esc(c.name)}</h2><p class="muted">${esc(c.city)} · Ronda ${S.round + 1} de ${S.calendar.length}</p>
        <table class="small">
          <tr><td>Vueltas</td><td class="num">${c.laps}</td></tr>
          <tr><td>Carga aerodinámica</td><td class="num">${trait(c.df, 'Baja', 'Alta')}</td></tr>
          <tr><td>Importancia del motor</td><td class="num">${trait(c.pw, 'Baja', 'Alta')}</td></tr>
          <tr><td>Desgaste de neumáticos</td><td class="num">${trait(c.wear, 'Bajo', 'Alto')}</td></tr>
          <tr><td>Facilidad para adelantar</td><td class="num">${c.ovt > 0.6 ? 'Alta' : c.ovt < 0.3 ? 'Muy baja' : 'Media'}</td></tr>
          <tr><td>Probabilidad de lluvia</td><td class="num">${r1(c.rain * 100)}%</td></tr>
          <tr><td>Coche de seguridad</td><td class="num">${r1(c.sc * 100)}%</td></tr>
        </table>
        <p class="small">Tu coche en este trazado: <b>${ordinal(myRank)}</b> de ${S.teams.length}.</p>
      </div>
      <div class="card"><h3>Estrategia</h3>
        ${mine.map(d => {
          const st = S.strategy[d.id] || { stops: c.wear >= 1.15 ? '2' : '1', aggr: 'norm' };
          S.strategy[d.id] = st;
          return `<div style="margin-bottom:12px"><b>${esc(d.name)}</b>
            <div class="row small" style="margin-top:4px">
              <select data-strat="${d.id}" data-k="stops">${Object.entries(STRATS).map(([k, v]) => `<option value="${k}" ${st.stops === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
              <select data-strat="${d.id}" data-k="aggr">${Object.entries(AGGR).map(([k, v]) => `<option value="${k}" ${st.aggr === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
            </div></div>`;
        }).join('')}
        <p class="small muted">Agresivo: más ritmo, más desgaste y más riesgo de accidente. Con mucho desgaste, 2 paradas suele compensar.</p>
        <button class="btn" data-act="simulate">Disputar el fin de semana</button>
      </div>
    </div>`;
  },

  standings() {
    const ds = driverStandings(S).filter(x => x.d.teamId || x.pts);
    const ts = teamStandings(S);
    return `<div class="grid">
      <div class="card"><h3>Pilotos</h3><div class="tablewrap"><table><tr><th>#</th><th>Piloto</th><th class="num">V</th><th class="num">Pts</th></tr>
        ${ds.map((x, i) => `<tr class="${x.d.teamId === S.teamId ? 'mine' : ''}"><td>${i + 1}</td><td>${x.d.teamId ? teamChip(team(S, x.d.teamId)) : ''}${esc(x.d.name)}</td><td class="num">${x.wins}</td><td class="num">${x.pts}</td></tr>`).join('')}</table></div></div>
      <div class="card"><h3>Constructores</h3><table><tr><th>#</th><th>Equipo</th><th class="num">Coche</th><th class="num">Pts</th></tr>
        ${ts.map((t, i) => `<tr class="${t.id === S.teamId ? 'mine' : ''}"><td>${i + 1}</td><td>${teamChip(t)}${esc(t.name)}</td><td class="num">${carRating(t.car)}</td><td class="num">${t.points}</td></tr>`).join('')}</table>
        ${S.raceResults.length ? `<h3 style="margin-top:16px">Ganadores</h3><table>${S.raceResults.map(r => { const w = r.results[0]; return `<tr><td>${esc(r.circuit)}${r.wet ? ' 🌧️' : ''}</td><td>${teamChip(team(S, w.teamId))}${esc(driver(S, w.id)?.name || '—')}</td></tr>`; }).join('')}</table>` : ''}
      </div></div>`;
  },

  car() {
    const me = myTeam(S);
    const avg = k => S.teams.reduce((a, t) => a + t.car[k], 0) / S.teams.length;
    const best = k => Math.max(...S.teams.map(t => t.car[k]));
    return `<div class="grid">
      <div class="card hero"><h3>Tu monoplaza · media ${carRating(me.car)}</h3>
        ${Object.entries(PILLARS).map(([k, l]) => `<div class="stat"><span class="small">${l}</span><div class="bar"><i style="width:${me.car[k]}%;background:${me.color}"></i></div><b class="num">${me.car[k].toFixed(1)}</b></div>
          <div class="small muted" style="margin:-4px 0 8px 138px">Media de la parrilla ${avg(k).toFixed(1)} · mejor ${best(k).toFixed(1)}</div>`).join('')}
        <div class="row small muted"><span>Fábrica: nivel ${me.facility}/5</span><span>Equipo de boxes: ${me.crew.toFixed(0)}</span></div>
      </div>
      <div class="card"><h3>Proyectos de I+D</h3>
        ${S.rd.length ? S.rd.map(p => `<div class="row spread"><span>${PILLARS[p.pillar]} · ${RD_SIZES[p.size].label}</span><span class="badge">${p.left} carrera(s)</span></div>`).join('') : '<p class="muted small">No hay proyectos en curso.</p>'}
        ${S.phase === 'season' ? `<div class="row" style="margin-top:12px">
          <select id="rdPillar">${Object.entries(PILLARS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          <select id="rdSize">${Object.entries(RD_SIZES).map(([k, v]) => `<option value="${k}">${v.label} · ${v.cost} M€ · ${v.races} carrera(s)</option>`).join('')}</select>
          <button class="btn sm" data-act="startRD">Iniciar</button></div>
          <p class="small muted">Máximo 2 proyectos a la vez. Las mejoras rinden menos cuanto más desarrollada está un área. La fábrica multiplica las ganancias.</p>` : '<p class="small muted">El I+D se reanuda con la temporada. Recuerda: los coches retroceden en invierno y cada 4 años cambia el reglamento.</p>'}
      </div>
      <div class="card"><h3>Infraestructura</h3>
        <div class="row spread"><span>Ampliar la fábrica</span><button class="btn sm" data-act="facility" ${me.facility >= 5 ? 'disabled' : ''}>${me.facility >= 5 ? 'Máximo' : fmtM(facilityCost(S))}</button></div>
        <div class="row spread" style="margin-top:10px"><span>Entrenar el equipo de boxes</span><button class="btn sm" data-act="crew">${fmtM(5)}</button></div>
      </div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Comparativa de la parrilla</h3><div class="tablewrap"><table><tr><th>Equipo</th>${Object.values(PILLARS).map(l => `<th class="num">${l}</th>`).join('')}<th class="num">Media</th></tr>
      ${[...S.teams].sort((a, b) => carRating(b.car) - carRating(a.car)).map(t => `<tr class="${t.id === S.teamId ? 'mine' : ''}"><td>${teamChip(t)}${esc(t.name)}</td>${Object.keys(PILLARS).map(k => `<td class="num">${t.car[k].toFixed(1)}</td>`).join('')}<td class="num"><b>${carRating(t.car)}</b></td></tr>`).join('')}</table></div></div>`;
  },

  drivers() {
    const mine = teamDrivers(S, S.teamId);
    const off = S.phase === 'offseason';
    const fa = freeAgents(S);
    const row = (d, extra) => `<tr><td>${esc(d.name)} ${d.rookie ? '<span class="badge">Novato</span>' : ''}<div class="small muted">${d.nat} · ${d.age} años</div></td><td class="num">${r1(d.pace)}</td><td class="num">${r1(d.craft)}</td><td class="num">${r1(d.cons)}</td><td class="num">${d.age <= 26 ? r1(d.pot) : '—'}</td><td class="num"><b>${driverRating(d)}</b></td>${extra}</tr>`;
    const head = extra => `<tr><th>Piloto</th><th class="num">Ritmo</th><th class="num">Duelo</th><th class="num">Const.</th><th class="num">Pot.</th><th class="num">Media</th>${extra}</tr>`;
    return `<div class="card hero"><h3>Tus pilotos</h3><div class="tablewrap"><table>${head('<th class="num">Salario</th><th class="num">Años</th><th></th>')}
      ${mine.map(d => row(d, `<td class="num">${fmtM(d.salary)}</td><td class="num">${d.contract}</td><td>${off ? `<button class="btn sm ghost" data-act="renew" data-id="${d.id}">Renovar +1 (${fmtM(requiredSalary(S, d))})</button> <button class="btn sm ghost" data-act="release" data-id="${d.id}">Liberar</button>` : ''}</td>`)).join('')}
    </table></div>${off ? '' : '<p class="small muted">Los fichajes, renovaciones y despidos se hacen en la pretemporada.</p>'}</div>
    <div class="card" style="margin-top:14px"><h3>Agentes libres ${off ? '' : '<span class="badge">solo consulta</span>'}</h3>
      <div class="tablewrap"><table>${head('<th class="num">Pide</th><th></th>')}
      ${fa.map(d => row(d, `<td class="num">${fmtM(requiredSalary(S, d))}</td><td>${off ? `<div class="row"><select data-years="${d.id}"><option value="1">1 año</option><option value="2" selected>2 años</option><option value="3">3 años</option></select><input type="number" step="0.1" min="0.5" value="${requiredSalary(S, d)}" data-salary="${d.id}" style="width:80px"><button class="btn sm" data-act="sign" data-id="${d.id}">Ofrecer</button></div>` : ''}</td>`)).join('') || '<tr><td colspan="8" class="muted">No hay agentes libres.</td></tr>'}
      </table></div><p class="small muted">Lo que pide cada piloto depende de su nivel, su potencial y el prestigio de tu equipo.</p></div>`;
  },

  finance() {
    const offers = S.sponsorOffers || [];
    return `<div class="grid">
      <div class="card hero"><h3>Caja</h3><div class="kpi ${S.money < 0 ? 'bad' : ''}">${fmtM(S.money)}</div>
        <p class="small muted">Presupuesto anual del equipo: ${fmtM(myTeam(S).budget)} · Prestigio: ${r1(myTeam(S).rep)}</p></div>
      <div class="card"><h3>Patrocinador principal</h3>
        ${S.sponsor ? `<b>${esc(S.sponsor.name)}</b> <span class="badge">${S.sponsor.tag}</span><p class="small">${fmtM(S.sponsor.perRace)} por carrera${S.sponsor.bonus ? ` · bonus de ${fmtM(S.sponsor.bonus)} si terminas ${ordinal(S.sponsor.target)} o mejor` : ''}</p>` : ''}
        ${offers.length ? offers.map((o, i) => `<div class="card" style="margin:8px 0;background:var(--panel2)"><div class="row spread"><b>${esc(o.name)}</b><span class="badge">${o.tag}</span></div>
          <p class="small">${fmtM(o.perRace)} por carrera${o.bonus ? ` · bonus de ${fmtM(o.bonus)} si terminas ${ordinal(o.target)} o mejor` : ' · sin objetivos'}</p>
          <button class="btn sm" data-act="sponsor" data-i="${i}">Firmar</button></div>`).join('') : ''}
      </div></div>
      <div class="card" style="margin-top:14px"><h3>Movimientos</h3><div class="tablewrap"><table>
        ${S.ledger.map(l => `<tr><td class="small muted">${l.season} · R${l.round + 1}</td><td>${esc(l.label)}</td><td class="num ${l.amount < 0 ? 'bad' : 'good'}">${fmtM(l.amount)}</td></tr>`).join('') || '<tr><td class="muted">Sin movimientos todavía.</td></tr>'}
      </table></div></div>`;
  },

  history() {
    return `<div class="card"><h3>Palmarés</h3>${S.history.length ? `<table><tr><th>Temporada</th><th>Campeón</th><th>Constructores</th><th class="num">Tu equipo</th></tr>
      ${S.history.map(h => `<tr><td>${h.season}</td><td>${esc(h.driver)} <span class="small muted">(${esc(h.driverTeam)})</span></td><td>${esc(h.team)}</td><td class="num">${ordinal(h.myPos)} · ${h.myPts} pts</td></tr>`).join('')}</table>` : '<p class="muted">Aún no ha terminado ninguna temporada.</p>'}</div>
      <div class="card" style="margin-top:14px"><h3>Leyendas en activo</h3><table><tr><th>Piloto</th><th class="num">Títulos</th><th class="num">Victorias</th><th class="num">Podios</th><th class="num">Salidas</th></tr>
      ${[...S.drivers].filter(d => d.starts).sort((a, b) => b.titles - a.titles || b.wins - a.wins).slice(0, 12).map(d => `<tr><td>${esc(d.name)}</td><td class="num">${d.titles}</td><td class="num">${d.wins}</td><td class="num">${d.podiums}</td><td class="num">${d.starts}</td></tr>`).join('')}</table></div>`;
  },

  settings() {
    return `<div class="card"><h3>Partida</h3><p class="small muted">La partida se guarda automáticamente en este navegador.</p>
      <div class="row"><button class="btn ghost" data-act="export">Exportar partida</button>
      <label class="btn ghost">Importar partida<input type="file" accept=".json" id="importFile" hidden></label>
      <button class="btn" data-act="reset">Nueva partida</button></div></div>`;
  },

  credits() {
    return `<div class="card hero"><h2>Créditos</h2>
      <p><b>Paddock Plus</b> es un juego original de gestión de escuderías. El género y la idea de un gestor de dinastías en el navegador están inspirados en
      <a href="https://f1dynasty.com/" target="_blank" rel="noopener">F1 Dynasty</a>. Muchas gracias a su creador por la inspiración.</p>
      <p>F1 Dynasty no publica su código bajo ninguna licencia abierta, así que este proyecto <b>no copia su código, sus textos, su arte ni sus datos</b>: todo se ha escrito desde cero.</p>
      <p>El importador de plantillas lee el formato JSON del editor de F1 Dynasty para que puedas usar las plantillas de la comunidad, como las de <a href="https://github.com/RuleImpossible3362/F1DynastyRosters" target="_blank" rel="noopener">RuleImpossible3362/F1DynastyRosters</a>. Esas plantillas pertenecen a sus autores, se descargan en tu navegador y no forman parte de este proyecto.</p>
      <p>No está afiliado a Formula One Group, la FIA ni ninguna escudería. "Formula 1" y "F1" son marcas de sus respectivos propietarios. Los equipos, pilotos y patrocinadores son ficticios.</p>
      <button class="btn ghost" data-go="${S ? 'hq' : 'new'}">Volver</button></div>`;
  },
};

// ---------- repetición de la carrera ----------
function raceReplayView() {
  const race = replay.race, lap = replay.lap;
  const done = lap >= race.totalLaps;
  const snap = lap === 0 ? race.qualy.map(q => ({ id: q.id, gap: null })) : race.laps[lap - 1];
  const tower = snap.map((x, i) => {
    const d = driver(S, x.id), t = team(S, d.teamId);
    const gap = lap === 0 ? '' : x.out ? 'OUT' : i === 0 ? 'Líder' : '+' + x.gap.toFixed(1);
    return `<div class="r ${d.teamId === S.teamId ? 'mine' : ''} ${x.out ? 'out' : ''}"><b>${i + 1}</b><span>${teamChip(t)}${esc(d.name)}</span><span class="num small">${gap}</span></div>`;
  }).join('');
  const evs = race.events.filter(e => e.lap <= lap).reverse();
  let summary = '';
  if (done) {
    const mine = race.results.filter(r => r.teamId === S.teamId);
    summary = `<div class="card hero" style="margin-bottom:14px"><h3>Resultado final</h3>
      ${mine.map(r => `<div>${esc(driver(S, r.id).name)}: <b>${r.out ? 'Abandono (' + esc(r.reason) + ')' : ordinal(r.pos)}</b> · salió ${ordinal(r.grid)} · ${r.pts} pts</div>`).join('')}
      <div class="tablewrap" style="margin-top:10px"><table><tr><th>#</th><th>Piloto</th><th class="num">Salida</th><th class="num">Paradas</th><th class="num">Diferencia</th><th class="num">Pts</th></tr>
      ${race.results.map(r => `<tr class="${r.teamId === S.teamId ? 'mine' : ''}"><td>${r.out ? '—' : r.pos}</td><td>${teamChip(team(S, r.teamId))}${esc(driver(S, r.id).name)}${r.fl ? ' ⏱️' : ''}</td><td class="num">${r.grid}</td><td class="num">${r.pits}</td><td class="num">${r.out ? 'V' + r.outLap + ' · ' + esc(r.reason) : r.pos === 1 ? fmtLap(r.total) : '+' + r.gap.toFixed(1) + 's'}</td><td class="num">${r.pts}</td></tr>`).join('')}
      </table></div><div class="row" style="margin-top:10px"><button class="btn" data-act="finishRace">Continuar</button></div></div>`;
  }
  return `${summary}<div class="grid">
    <div class="card"><div class="row spread"><h3>${esc(race.circuit)} ${race.wet ? '🌧️' : ''}</h3><span class="badge">${lap === 0 ? 'Parrilla' : `Vuelta ${lap}/${race.totalLaps}`}</span></div>
      <input type="range" min="0" max="${race.totalLaps}" value="${lap}" id="lapSlider">
      <div class="row" style="margin:8px 0">
        <button class="btn sm ghost" data-act="play">${replay.timer ? '⏸ Pausa' : '▶ Reproducir'}</button>
        <button class="btn sm ghost" data-act="skip">⏭ Ir al final</button></div>
      <div class="tower">${tower}</div></div>
    <div class="card"><h3>Directo</h3><div class="feed">${evs.map(e => `<div class="${e.type}"><span class="badge">V${e.lap}</span> ${esc(e.text)}</div>`).join('') || '<div class="muted">Los coches forman en la parrilla…</div>'}</div></div>
  </div>`;
}
function stopReplay() { if (replay && replay.timer) { clearInterval(replay.timer); replay.timer = null; } }
function playReplay() {
  if (replay.timer) { stopReplay(); render(); return; }
  replay.timer = setInterval(() => {
    replay.lap++;
    if (replay.lap >= replay.race.totalLaps) { replay.lap = replay.race.totalLaps; stopReplay(); }
    render();
  }, 260);
  render();
}

// ---------- acciones ----------
const ACTIONS = {
  pickTeam(el) { S = newGame(el.dataset.id, roster); save(S); go('finance'); toast('Elige un patrocinador principal para empezar.'); },
  simulate() {
    if (!S.sponsor) { toast('Elige antes un patrocinador principal (pestaña Finanzas).'); return go('finance'); }
    const race = simulateWeekend(S);
    replay = { race, lap: 0, timer: null };
    render(); playReplay();
  },
  play() { playReplay(); },
  skip() { stopReplay(); replay.lap = replay.race.totalLaps; render(); },
  finishRace() { stopReplay(); applyRace(S, replay.race); replay = null; go('hq'); },
  endSeason() { endSeason(S); go('hq'); },
  startSeason() { const e = startSeason(S); e ? toast(e) : go('hq'); },
  startRD() { const e = startRD(S, document.getElementById('rdPillar').value, document.getElementById('rdSize').value); toast(e || 'Proyecto iniciado.'); render(); },
  facility() { const e = upgradeFacility(S); toast(e || 'Fábrica ampliada.'); render(); },
  crew() { const e = trainCrew(S); toast(e || 'El equipo de boxes ha mejorado.'); render(); },
  sponsor(el) { chooseSponsor(S, +el.dataset.i); toast('Patrocinador firmado.'); render(); },
  sign(el) {
    const id = el.dataset.id;
    const sal = parseFloat(document.querySelector(`[data-salary="${id}"]`).value);
    const yrs = parseInt(document.querySelector(`[data-years="${id}"]`).value, 10);
    const e = signDriver(S, id, sal, yrs); toast(e || '¡Fichaje cerrado!'); render();
  },
  release(el) { if (!confirm('¿Liberar a este piloto? Pagarás la mitad del contrato restante.')) return; const e = releaseDriver(S, el.dataset.id); if (e) toast(e); render(); },
  renew(el) { const e = renewDriver(S, el.dataset.id, 1); toast(e || 'Contrato renovado.'); render(); },
  async rosterUrl() {
    const url = document.getElementById('rosterUrl').value.trim();
    if (!/^https?:\/\//.test(url)) return toast('Introduce una URL válida.');
    toast('Descargando plantilla…');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      useRoster(await res.json(), decodeURIComponent(url.split('/').pop()).replace(/\.json$/i, ''));
    } catch (err) { toast('No se pudo descargar la plantilla: ' + err.message); }
  },
  rosterDefault() { roster = defaultRoster(); rosterRaw = null; rosterSet = 'base'; render(); },
  export() {
    const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `paddockplus-${S.season}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  reset() { if (!confirm('¿Empezar una partida nueva? Se perderá la actual.')) return; wipe(); S = null; replay = null; go('new'); },
};

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); return go(g.dataset.go); }
  const a = e.target.closest('[data-act]');
  if (a && ACTIONS[a.dataset.act]) ACTIONS[a.dataset.act](a);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.strat) { S.strategy[t.dataset.strat][t.dataset.k] = t.value; save(S); }
  if (t.id === 'rosterSet') { rosterSet = t.value; roster = convertExternalRoster(rosterRaw, rosterSet, rosterLabel); render(); }
  if (t.id === 'rosterFile' && t.files[0]) {
    const f = t.files[0];
    f.text().then(txt => { try { useRoster(JSON.parse(txt), f.name.replace(/\.json$/i, '')); } catch (err) { toast('El archivo no es un JSON válido.'); } });
  }
  if (t.id === 'importFile' && t.files[0]) {
    t.files[0].text().then(txt => {
      try { const data = JSON.parse(txt); if (!data.teams || !data.drivers) throw new Error(); S = data; save(S); replay = null; go('hq'); toast('Partida importada.'); }
      catch (err) { toast('El archivo no es una partida válida.'); }
    });
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'lapSlider') { stopReplay(); replay.lap = +e.target.value; render(); }
});

function render() {
  if (!S && view !== 'credits') view = 'new';
  renderChrome();
  $app.innerHTML = VIEWS[view]();
}
render();
