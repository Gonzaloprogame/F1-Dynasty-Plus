// Interfaz de usuario.
'use strict';

let S = load();
let view = S ? 'hq' : 'new';
let live = null; // carrera o sprint en directo
let V3D = null;   // módulo 3D (se carga al activarlo)
let pref3d = (() => { try { return localStorage.getItem('pp_view3d') === '1'; } catch (e) { return false; } })();
const CAMS = { chase: 'Persecución', tv: 'TV', heli: 'Helicóptero', onboard: 'Cámara T', free: 'Libre' };
let roster = defaultRoster();
let rosterRaw = null, rosterLabel = '', rosterSet = 'base';
const EXAMPLE_ROSTER_URL = 'https://raw.githubusercontent.com/RuleImpossible3362/F1DynastyRosters/refs/heads/main/F1%20DYNASTY%202026%20ROSTER.json';

const $app = document.getElementById('app');
const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const teamChip = t => t ? `<span class="chip" style="background:${t.color}"></span>` : '';
const r1 = n => Math.round(n);
const abbr = name => { const p = name.split(' '); return (p[p.length - 1] || name).slice(0, 3).toUpperCase(); };
const tyre = c => `<span class="tyre" style="--c:${COMPOUNDS[c].color}" title="${COMPOUNDS[c].name}">${COMPOUNDS[c].short}</span>`;
const wxIcon = w => w < 0.05 ? '☀️' : w < 0.3 ? '🌦️' : w < 0.7 ? '🌧️' : '⛈️';
const wxText = w => w < 0.05 ? 'Seco' : w < 0.15 ? 'Humedad leve' : w < 0.45 ? 'Mojado' : w < 0.75 ? 'Lluvia' : 'Lluvia intensa';
const moraleTxt = m => m >= 80 ? '😄' : m >= 60 ? '🙂' : m >= 40 ? '😐' : '😠';

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 3500);
}
// Confirmación en la propia página (los diálogos del navegador no siempre están disponibles)
function armed(el, msg) {
  if (el.dataset.armed) { delete el.dataset.armed; return true; }
  el.dataset.armed = '1'; el.dataset.label = el.textContent; el.textContent = 'Pulsa otra vez para confirmar';
  toast(msg);
  setTimeout(() => { if (el.dataset.armed) { delete el.dataset.armed; el.textContent = el.dataset.label; } }, 4000);
  return false;
}
function go(v) {
  if (live && v !== 'weekend') { live.paused = true; cancelAnimationFrame(live.raf); }
  view = v; render(); window.scrollTo(0, 0);
}

// ---------- plantillas ----------
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

// ---------- barra superior y pestañas ----------
function renderChrome() {
  const tabs = document.getElementById('tabs');
  const status = document.getElementById('status');
  if (!S) { tabs.innerHTML = ''; status.innerHTML = ''; return; }
  const me = myTeam(S);
  document.documentElement.style.setProperty('--team', me.color);
  const items = [['hq', 'Cuartel general'], ['weekend', S.phase === 'season' ? '🏁 Fin de semana' : 'Temporada'], ['standings', 'Clasificación'], ['calendar', 'Calendario'], ['car', 'Coche e I+D'], ['drivers', 'Pilotos'], ['staff', 'Personal'], ['finance', 'Finanzas'], ['history', 'Historial'], ['settings', 'Partida']];
  tabs.innerHTML = items.map(([k, l]) => `<button class="${view === k ? 'active' : ''}" data-go="${k}">${l}</button>`).join('');
  const round = S.phase === 'season' ? `Ronda ${S.round + 1}/${S.calendar.length}` : S.phase === 'offseason' ? 'Pretemporada' : 'Fin de temporada';
  status.innerHTML = `<span>${teamChip(me)}<b>${esc(me.name)}</b></span><span>Temporada <b>${S.season}</b></span><span>${round}</span><span>Caja <b class="${S.money < 0 ? 'bad' : ''}">${fmtM(S.money)}</b></span>`;
}

const STAGES = { practice: 'Prácticas', sprint: 'Sprint', qualy: 'Clasificación', race: 'Carrera' };
function stageBar(wk) {
  const st = ['practice', ...(wk.sprint ? ['sprint'] : []), 'qualy', 'race'];
  const cur = st.indexOf(wk.stage);
  return `<div class="stages">${st.map((k, i) => `<span class="${i < cur ? 'done' : i === cur ? 'cur' : ''}">${i < cur ? '✓ ' : ''}${STAGES[k]}</span>`).join('')}</div>`;
}
function forecastHTML(wk) {
  return `<div class="forecast">${wk.weather.forecast.map((p, i) => `<div><div class="muted small">${['Inicio', '1/4', '1/2', '3/4'][i]}</div><div class="fx">${p >= 50 ? '🌧️' : p >= 20 ? '🌦️' : '☀️'}</div><b>${p}%</b></div>`).join('')}</div>`;
}

// ---------- vistas ----------
const VIEWS = {
  new() {
    const years = rosterRaw ? rosterYears(rosterRaw) : [];
    return `<div class="card hero"><h1>Paddock Plus</h1>
      <p class="muted">Dirige una escudería durante temporadas: ajusta el coche en prácticas, lucha en la clasificación, decide paradas y ritmo en directo, ficha pilotos y personal, y desarrolla el coche dentro del límite de gasto.</p></div>
      <div class="grid" style="margin-top:14px">
      <div class="card"><div class="row spread"><h3>Plantilla: ${esc(roster.name)}</h3>
        ${rosterRaw ? '<button class="btn sm ghost" data-act="rosterDefault">Volver a la ficticia</button>' : ''}</div>
        ${years.length ? `<div class="row small" style="margin-bottom:8px">Pilotos: <select id="rosterSet"><option value="base" ${rosterSet === 'base' ? 'selected' : ''}>Plantilla base</option>${years.map(y => `<option value="${y}" ${rosterSet === y ? 'selected' : ''}>Temporada ${y}</option>`).join('')}</select></div>` : ''}
        <p class="small muted">Carga una plantilla JSON del editor de F1 Dynasty (por ejemplo, las de la comunidad), desde un archivo o una URL. Las plantillas pertenecen a sus autores y no se incluyen en Paddock Plus.</p>
        <div class="row"><input id="rosterUrl" type="url" placeholder="URL del JSON" value="${esc(EXAMPLE_ROSTER_URL)}" style="flex:1;min-width:180px">
          <button class="btn sm" data-act="rosterUrl">Cargar URL</button>
          <label class="btn sm ghost">Subir archivo<input type="file" accept=".json,application/json" id="rosterFile" hidden></label></div>
      </div>
      <div class="card"><h3>…o crea tu propio equipo</h3>
        <p class="small muted">Tu equipo ocupa la plaza del equipo con menos prestigio (con sus pilotos y su coche). Empiezas desde abajo.</p>
        <div class="row"><input id="ctName" placeholder="Nombre del equipo" maxlength="28" style="flex:1;min-width:160px"><input id="ctShort" placeholder="ABR" maxlength="3" style="width:64px"><input id="ctColor" type="color" value="#e10600" aria-label="Color del equipo"></div>
        <div class="row" style="margin-top:8px"><button class="btn sm" data-act="createTeam">Crear equipo y empezar</button></div>
      </div></div>
      <h2 style="margin:18px 0 10px">Elige tu escudería</h2>
      <div class="grid">${roster.teams.map(t => {
        const ds = roster.drivers.filter(d => d.teamId === t.id).map(d => esc(d.name)).join(' · ');
        return `<div class="card teampick" style="--c:${t.color}" data-act="pickTeam" data-id="${esc(t.id)}" tabindex="0">
          <h3>${esc(t.name)}</h3>
          <div class="small muted">${ds}</div>
          <div class="row small" style="margin-top:8px"><span>Coche <b>${carRating(t.car)}</b></span><span>Presupuesto <b>${Math.round(t.budget)} M€</b></span><span>Prestigio <b>${Math.round(t.rep)}</b></span></div>
        </div>`;
      }).join('')}</div>`;
  },

  hq() {
    const me = myTeam(S), ts = teamStandings(S), ds = driverStandings(S);
    const pos = ts.findIndex(t => t.id === S.teamId) + 1;
    const next = S.calendar[S.round];
    let action = '';
    if (S.phase === 'season') action = `<div class="row spread"><h3>Siguiente: ${esc(next.name)} ${next.sprint ? '<span class="badge accent">Sprint</span>' : ''}</h3></div>
      <p class="muted small">${esc(next.city)} · ${next.laps} vueltas · lluvia ${r1(next.rain * 100)}%</p>
      ${S.weekend ? stageBar(S.weekend) : ''}
      <div class="trackmini">${trackSVG(next, { id: 'hqtrk' })}</div>
      <button class="btn" data-go="weekend">${S.weekend ? 'Continuar el fin de semana' : 'Ir al fin de semana'}</button>`;
    else if (S.phase === 'seasonEnd') action = `<h3>¡Temporada ${S.season} terminada!</h3><p class="muted small">Campeón: ${esc(ds[0].d.name)} · Constructores: ${esc(ts[0].name)}</p><button class="btn" data-act="endSeason">Cerrar la temporada e ir a la pretemporada</button>`;
    else action = `<h3>Pretemporada ${S.season}</h3><p class="muted small">Ficha pilotos y personal, y elige patrocinador antes de arrancar.</p><div class="row"><button class="btn ghost" data-go="drivers">Pilotos</button><button class="btn ghost" data-go="staff">Personal</button><button class="btn ghost" data-go="finance">Patrocinadores</button><button class="btn" data-act="startSeason">Iniciar temporada</button></div>`;
    return `<div class="grid">
      <div class="card hero">${action}</div>
      <div class="card"><h3>Situación</h3>
        <div class="kpis"><div><div class="muted small">Constructores</div><div class="kpi">${S.phase === 'offseason' ? '—' : ordinal(pos)}</div></div>
        <div><div class="muted small">Objetivo</div><div class="kpi">${ordinal(boardTarget(S))}</div></div>
        <div><div class="muted small">Puntos</div><div class="kpi">${me.points}</div></div></div>
        <h3 style="margin-top:14px">Tus pilotos</h3>${teamDrivers(S, S.teamId).map(d => `<div class="row spread"><span>${esc(d.name)} <span class="badge">${esc(d.nat)}</span></span><span class="small muted">Media ${driverRating(d)} · ${moraleTxt(d.morale)} ${r1(d.morale)} · ${d.seasonPts || 0} pts</span></div>`).join('') || '<p class="muted">Sin pilotos.</p>'}
        <h3 style="margin-top:14px">Coche</h3><div class="row small muted"><span>Media <b>${carRating(me.car)}</b></span><span>Límite de gasto: ${fmtM(capLeft(S))} libres</span></div></div>
    </div>
    <div class="grid" style="margin-top:14px">
      <div class="card"><h3>Noticias</h3><div class="feed">${S.news.map(n => `<div><span class="badge">${n.season}</span> ${esc(n.text)}</div>`).join('')}</div></div>
      <div class="card"><h3>Top 5 pilotos</h3><table>${ds.slice(0, 5).map((x, i) => `<tr class="${x.d.teamId === S.teamId ? 'mine' : ''}"><td>${i + 1}</td><td>${teamChip(team(S, x.d.teamId))}${esc(x.d.name)}</td><td class="num">${x.pts}</td></tr>`).join('')}</table></div>
    </div>`;
  },

  weekend() {
    if (live) return liveView();
    if (S.phase !== 'season') return `<div class="card"><p>No hay ningún fin de semana en curso.</p><button class="btn" data-go="hq">Volver al cuartel general</button></div>`;
    const c = S.calendar[S.round];
    if (!S.weekend) {
      const trait = (v, lo, hi) => v > 1.15 ? hi : v < 0.85 ? lo : 'Media';
      return `<div class="grid">
        <div class="card hero"><h2>${esc(c.name)} ${c.sprint ? '<span class="badge accent">Sprint</span>' : ''}</h2><p class="muted">${esc(c.city)} · Ronda ${S.round + 1} de ${S.calendar.length}</p>
          <div class="trackwrap">${trackSVG(c, { id: 'pvtrk' })}</div></div>
        <div class="card"><h3>Ficha del circuito</h3><table class="small">
          <tr><td>Vueltas</td><td class="num">${c.laps}</td></tr>
          <tr><td>Carga aerodinámica</td><td class="num">${trait(c.df, 'Baja', 'Alta')}</td></tr>
          <tr><td>Importancia del motor</td><td class="num">${trait(c.pw, 'Baja', 'Alta')}</td></tr>
          <tr><td>Desgaste de neumáticos</td><td class="num">${trait(c.wear, 'Bajo', 'Alto')}</td></tr>
          <tr><td>Facilidad para adelantar</td><td class="num">${c.ovt > 0.6 ? 'Alta' : c.ovt < 0.3 ? 'Muy baja' : 'Media'}</td></tr>
          <tr><td>Probabilidad de lluvia</td><td class="num">${r1(c.rain * 100)}%</td></tr>
          <tr><td>Coche de seguridad</td><td class="num">${r1(c.sc * 100)}%</td></tr></table>
          <p class="small">Tu coche aquí: <b>${ordinal([...S.teams].sort((a, b) => carScore(b, c) - carScore(a, c)).findIndex(t => t.id === S.teamId) + 1)}</b> de ${S.teams.length}.</p>
          <button class="btn" data-act="startWeekend">Empezar el fin de semana</button></div></div>`;
    }
    const wk = S.weekend;
    const head = `<div class="card hero"><div class="row spread"><h2>${esc(c.name)}</h2>${stageBar(wk)}</div><div class="row spread"><span class="muted small">Previsión meteorológica</span>${forecastHTML(wk)}</div></div>`;
    return head + `<div style="margin-top:14px">${({ practice: practiceView, sprint: sprintView, qualy: qualyView, race: preRaceView })[wk.stage]()}</div>`;
  },

  standings() {
    const ds = driverStandings(S).filter(x => x.d.teamId || x.pts);
    const ts = teamStandings(S);
    return `<div class="card"><h3>Evolución del campeonato · top 5 pilotos</h3>${pointsChart(ds.slice(0, 5).map(x => x.d))}</div>
      <div class="grid" style="margin-top:14px">
      <div class="card"><h3>Pilotos</h3><div class="tablewrap"><table><tr><th>#</th><th>Piloto</th><th class="num">V</th><th class="num">Pts</th></tr>
        ${ds.map((x, i) => `<tr class="${x.d.teamId === S.teamId ? 'mine' : ''}"><td>${i + 1}</td><td>${teamChip(team(S, x.d.teamId))}${esc(x.d.name)}</td><td class="num">${x.wins}</td><td class="num">${x.pts}</td></tr>`).join('')}</table></div></div>
      <div class="card"><h3>Constructores</h3><table><tr><th>#</th><th>Equipo</th><th class="num">Coche</th><th class="num">Pts</th></tr>
        ${ts.map((t, i) => `<tr class="${t.id === S.teamId ? 'mine' : ''}"><td>${i + 1}</td><td>${teamChip(t)}${esc(t.name)}</td><td class="num">${carRating(t.car)}</td><td class="num">${t.points}</td></tr>`).join('')}</table></div></div>`;
  },

  calendar() {
    return `<div class="card"><h3>Calendario ${S.season}</h3><div class="tablewrap"><table><tr><th>R</th><th>Gran Premio</th><th>Formato</th><th>Ganador</th><th>Tu mejor resultado</th></tr>
      ${S.calendar.map((c, i) => {
        const race = S.raceResults.find(r => r.round === i && r.kind === 'race');
        const w = race && race.results[0];
        const mine = race && race.results.filter(r => r.teamId === S.teamId).sort((a, b) => a.pos - b.pos)[0];
        return `<tr class="${i === S.round && S.phase === 'season' ? 'mine' : ''}"><td>${i + 1}</td><td>${esc(c.name)}<div class="small muted">${esc(c.city)}</div></td><td>${c.sprint ? '<span class="badge accent">Sprint</span>' : '<span class="badge">Normal</span>'}</td>
          <td>${w ? teamChip(team(S, w.teamId)) + esc(driver(S, w.id)?.name || '—') + (race.wet ? ' 🌧️' : '') : i === S.round && S.phase === 'season' ? '<b>Siguiente</b>' : '—'}</td><td>${mine ? (mine.out ? 'Abandono' : ordinal(mine.pos)) : '—'}</td></tr>`;
      }).join('')}</table></div></div>`;
  },

  car() {
    const me = myTeam(S);
    const avg = k => S.teams.reduce((a, t) => a + t.car[k], 0) / S.teams.length;
    const best = k => Math.max(...S.teams.map(t => t.car[k]));
    const used = S.capSpent || 0;
    return `<div class="grid">
      <div class="card hero"><h3>Tu monoplaza · media ${carRating(me.car)}</h3>
        ${Object.entries(PILLARS).map(([k, l]) => `<div class="stat"><span class="small">${l}</span><div class="bar"><i style="width:${me.car[k]}%;background:${me.color}"></i></div><b class="num">${me.car[k].toFixed(1)}</b></div>
          <div class="small muted statnote">Media de la parrilla ${avg(k).toFixed(1)} · mejor ${best(k).toFixed(1)}</div>`).join('')}
        <div class="row small muted"><span>Fábrica: nivel ${me.facility}/5</span><span>Equipo de boxes: ${me.crew.toFixed(0)}</span></div>
      </div>
      <div class="card"><h3>Límite de gasto ${S.season}</h3>
        <div class="bar big"><i style="width:${Math.min(100, used / COST_CAP * 100)}%"></i></div>
        <p class="small muted">${fmtM(used)} de ${fmtM(COST_CAP)} usados en I+D, fábrica y entrenamiento.</p>
        <h3 style="margin-top:12px">Proyectos de I+D</h3>
        ${S.rd.length ? S.rd.map(p => `<div class="row spread"><span>${PILLARS[p.pillar]} · ${RD_SIZES[p.size].label}</span><span class="badge">${p.left} carrera(s)</span></div>`).join('') : '<p class="muted small">No hay proyectos en curso.</p>'}
        ${S.phase === 'season' ? `<div class="row" style="margin-top:12px">
          <select id="rdPillar">${Object.entries(PILLARS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          <select id="rdSize">${Object.entries(RD_SIZES).map(([k, v]) => `<option value="${k}">${v.label} · ${v.cost} M€ · ${v.races} carrera(s)</option>`).join('')}</select>
          <button class="btn sm" data-act="startRD">Iniciar</button></div>
          <p class="small muted">Máximo 2 proyectos a la vez. Las mejoras rinden menos cuanto más desarrollada está un área; tu director técnico (${staffRating(S, 'td')}) y la fábrica multiplican las ganancias. Un 8% de los proyectos fracasa en el túnel de viento.</p>` : '<p class="small muted">El I+D se reanuda con la temporada. En invierno los coches pierden parte de sus mejoras y cada 4 años cambia el reglamento.</p>'}
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
    const row = (d, extra) => `<tr><td>${esc(d.name)} ${d.rookie ? '<span class="badge">Novato</span>' : ''}<div class="small muted">${esc(d.nat)} · ${d.age} años</div></td><td class="num">${r1(d.pace)}</td><td class="num">${r1(d.craft)}</td><td class="num">${r1(d.cons)}</td><td class="num">${d.age <= 26 ? r1(d.pot) : '—'}</td><td class="num"><b>${driverRating(d)}</b></td>${extra}</tr>`;
    const head = extra => `<tr><th>Piloto</th><th class="num">Ritmo</th><th class="num">Duelo</th><th class="num">Const.</th><th class="num">Pot.</th><th class="num">Media</th>${extra}</tr>`;
    return `<div class="card hero"><h3>Tus pilotos</h3><div class="tablewrap"><table>${head('<th class="num">Moral</th><th class="num">Salario</th><th class="num">Años</th><th></th>')}
      ${mine.map(d => row(d, `<td class="num">${moraleTxt(d.morale)} ${r1(d.morale)}</td><td class="num">${fmtM(d.salary)}</td><td class="num">${d.contract}</td><td>${off ? `<div class="row"><button class="btn sm ghost" data-act="renew" data-id="${d.id}">Renovar +1 (${fmtM(requiredSalary(S, d))})</button><button class="btn sm ghost" data-act="release" data-id="${d.id}">Liberar</button></div>` : ''}</td>`)).join('')}
    </table></div><p class="small muted">La moral sube con buenos resultados y baja con abandonos u órdenes de equipo. Un piloto con la moral baja rinde menos y no quiere renovar.${off ? '' : ' Los fichajes, renovaciones y despidos se hacen en la pretemporada.'}</p></div>
    <div class="card" style="margin-top:14px"><h3>Agentes libres ${off ? '' : '<span class="badge">solo consulta</span>'}</h3>
      <div class="tablewrap"><table>${head('<th class="num">Pide</th><th></th>')}
      ${fa.map(d => row(d, `<td class="num">${fmtM(requiredSalary(S, d))}</td><td>${off ? `<div class="row nowrap"><select data-years="${d.id}"><option value="1">1 año</option><option value="2" selected>2 años</option><option value="3">3 años</option></select><input type="number" step="0.1" min="0.5" value="${requiredSalary(S, d)}" data-salary="${d.id}" style="width:76px" aria-label="Salario ofrecido"><button class="btn sm" data-act="sign" data-id="${d.id}">Ofrecer</button></div>` : ''}</td>`)).join('') || '<tr><td colspan="8" class="muted">No hay agentes libres.</td></tr>'}
      </table></div></div>`;
  },

  staff() {
    return `<div class="grid">${Object.entries(STAFF_ROLES).map(([k, role]) => {
      const st = S.staff[k];
      return `<div class="card"><h3>${role.label}</h3><p class="small muted">${role.desc}</p>
        <div class="row spread"><b>${esc(st.name)}</b><span class="badge">${esc(st.nat)}</span></div>
        <div class="stat"><span class="small">Valoración</span><div class="bar"><i style="width:${st.rating}%"></i></div><b class="num">${st.rating}</b></div>
        <p class="small muted">Salario: ${fmtM(st.salary)}/temporada</p>
        <h3 style="margin-top:10px;font-size:14px">Candidatos</h3>
        ${S.staffMarket[k].map((c, i) => `<div class="row spread cand"><span>${esc(c.name)} <span class="small muted">${c.rating} · ${fmtM(c.salary)}</span></span><button class="btn sm ${c.rating > st.rating ? '' : 'ghost'}" data-act="hire" data-role="${k}" data-i="${i}">Fichar</button></div>`).join('')}
      </div>`;
    }).join('')}</div>
    <p class="small muted" style="margin-top:10px">Fichar a alguien cuesta la mitad de su salario anual como prima, más la mitad del salario de la persona que se va. Los candidatos se renuevan cada pretemporada.</p>`;
  },

  finance() {
    const offers = S.sponsorOffers || [];
    return `<div class="grid">
      <div class="card hero"><h3>Caja</h3><div class="kpi ${S.money < 0 ? 'bad' : ''}">${fmtM(S.money)}</div>
        <p class="small muted">Presupuesto anual del equipo: ${fmtM(myTeam(S).budget)} · Prestigio: ${r1(myTeam(S).rep)}</p></div>
      <div class="card"><h3>Patrocinador principal</h3>
        ${S.sponsor ? `<b>${esc(S.sponsor.name)}</b> <span class="badge">${S.sponsor.tag}</span><p class="small">${fmtM(S.sponsor.perRace)} por carrera${S.sponsor.bonus ? ` · bonus de ${fmtM(S.sponsor.bonus)} si terminas ${ordinal(S.sponsor.target)} o mejor` : ''}</p>` : ''}
        ${offers.map((o, i) => `<div class="card inner"><div class="row spread"><b>${esc(o.name)}</b><span class="badge">${o.tag}</span></div>
          <p class="small">${fmtM(o.perRace)} por carrera${o.bonus ? ` · bonus de ${fmtM(o.bonus)} si terminas ${ordinal(o.target)} o mejor` : ' · sin objetivos'}</p>
          <button class="btn sm" data-act="sponsor" data-i="${i}">Firmar</button></div>`).join('')}
      </div></div>
      <div class="card" style="margin-top:14px"><h3>Movimientos</h3><div class="tablewrap"><table>
        ${S.ledger.map(l => `<tr><td class="small muted">${l.season} · R${l.round + 1}</td><td>${esc(l.label)}</td><td class="num ${l.amount < 0 ? 'bad' : 'good'}">${fmtM(l.amount)}</td></tr>`).join('') || '<tr><td class="muted">Sin movimientos todavía.</td></tr>'}
      </table></div></div>`;
  },

  history() {
    return `<div class="card"><h3>Palmarés</h3>${S.history.length ? `<div class="tablewrap"><table><tr><th>Temporada</th><th>Campeón</th><th>Constructores</th><th class="num">Tu equipo</th></tr>
      ${S.history.map(h => `<tr><td>${h.season}</td><td>${esc(h.driver)} <span class="small muted">(${esc(h.driverTeam)})</span></td><td>${esc(h.team)}</td><td class="num">${ordinal(h.myPos)} · ${h.myPts} pts</td></tr>`).join('')}</table></div>` : '<p class="muted">Aún no ha terminado ninguna temporada.</p>'}</div>
      <div class="card" style="margin-top:14px"><h3>Estadísticas de pilotos en activo</h3><div class="tablewrap"><table><tr><th>Piloto</th><th class="num">Títulos</th><th class="num">Victorias</th><th class="num">Podios</th><th class="num">Salidas</th></tr>
      ${[...S.drivers].filter(d => d.starts).sort((a, b) => b.titles - a.titles || b.wins - a.wins).slice(0, 15).map(d => `<tr><td>${esc(d.name)}</td><td class="num">${d.titles}</td><td class="num">${d.wins}</td><td class="num">${d.podiums}</td><td class="num">${d.starts}</td></tr>`).join('')}</table></div></div>`;
  },

  settings() {
    return `<div class="card"><h3>Partida</h3><p class="small muted">La partida se guarda automáticamente en este navegador (plantilla: ${esc(S.rosterName || 'Paddock Plus')}). Si recargas a mitad de una sesión en directo, esa sesión vuelve a empezar.</p>
      <div class="row"><button class="btn ghost" data-act="export">Exportar partida</button>
      <label class="btn ghost">Importar partida<input type="file" accept=".json" id="importFile" hidden></label>
      <button class="btn ghost" data-act="pasteImport">Importar desde texto</button>
      <button class="btn" data-act="reset">Nueva partida</button></div>
      <div id="pasteBox" hidden style="margin-top:12px"><textarea id="pasteText" rows="4" style="width:100%" placeholder="Pega aquí la partida exportada"></textarea><button class="btn sm" data-act="pasteLoad">Cargar partida</button></div></div>`;
  },

  credits() {
    return `<div class="card hero"><h2>Créditos</h2>
      <p><b>Paddock Plus</b> es un juego original de gestión de escuderías. Se inspira en las ideas del género: en
      <a href="https://f1dynasty.com/" target="_blank" rel="noopener">F1 Dynasty</a> (gestor de dinastías en el navegador) y en los juegos de gestión de monoplazas como F1® Manager 2024 (retransmisión en directo, decisiones de estrategia, reglajes y personal). Gracias a sus creadores por la inspiración.</p>
      <p>Ninguno de esos juegos publica su código bajo una licencia abierta, así que este proyecto <b>no copia su código, sus textos, su arte ni sus datos</b>: todo se ha escrito desde cero y los trazados de los circuitos se generan de forma procedural.</p>
      <p>La retransmisión 3D se inspira en <a href="https://hybridsim.app/" target="_blank" rel="noopener">HybridSim</a> (circuitos reconstruidos a partir de datos abiertos en el navegador). No usa su código, sus modelos ni sus texturas: el coche, el circuito 3D y las texturas se generan aquí. Usa <a href="https://threejs.org/" target="_blank" rel="noopener">three.js</a> (licencia MIT).</p>
      <p>Los trazados reales proceden de la <a href="https://github.com/TUMFTM/racetrack-database" target="_blank" rel="noopener">TUM racetrack-database</a> de la Universidad Técnica de Múnich (LGPL-3.0), incluida sin modificar en <code>data/racetrack-database</code>, con líneas centrales originales de © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a> (ODbL). Los circuitos que no están en esa base de datos usan un trazado generado.</p>
      <p>El importador de plantillas lee el formato JSON del editor de F1 Dynasty para que puedas usar las plantillas de la comunidad, como las de <a href="https://github.com/RuleImpossible3362/F1DynastyRosters" target="_blank" rel="noopener">RuleImpossible3362/F1DynastyRosters</a>. Esas plantillas pertenecen a sus autores, se descargan en tu navegador y no forman parte de este proyecto.</p>
      <p>No está afiliado a Formula One Group, la FIA, Frontier Developments ni ninguna escudería. "Formula 1", "F1" y "F1 Manager" son marcas de sus respectivos propietarios. Los equipos, pilotos y patrocinadores de la plantilla por defecto son ficticios.</p>
      <button class="btn ghost" data-go="${S ? 'hq' : 'new'}">Volver</button></div>`;
  },
};

// ---------- prácticas ----------
function practiceView() {
  const wk = S.weekend;
  const last = wk.runs[wk.runs.length - 1];
  const vals = last ? last.vals : { wing: 50, susp: 50, height: 50 };
  return `<div class="grid">
    <div class="card"><h3>Reglaje del coche</h3>
      <p class="small muted">Haz tandas y escucha a tus pilotos. Cuanto mejor sea el reglaje, más ritmo tendrás en clasificación y carrera. Tandas restantes: <b>${wk.runsLeft}</b>.</p>
      ${Object.entries(SETUP_KEYS).map(([k, l]) => `<label class="setup"><span>${l}</span><input type="range" min="0" max="100" value="${vals[k]}" data-setup="${k}"><b id="sv-${k}">${vals[k]}</b>
        ${last ? `<span class="fb ${last.fb[k].cls}">${last.fb[k].txt}</span>` : '<span class="fb muted">—</span>'}</label>`).join('')}
      <div class="row" style="margin-top:12px">
        <button class="btn" data-act="practiceRun" ${wk.runsLeft <= 0 ? 'disabled' : ''}>Salir a pista</button>
        <button class="btn ghost" data-act="finishPractice">${wk.runs.length ? 'Terminar prácticas' : 'Saltar prácticas (reglaje genérico)'}</button></div>
    </div>
    <div class="card"><h3>Confianza en el reglaje</h3>
      <div class="kpi">${wk.best ?? '—'}${wk.best !== undefined ? '%' : ''}</div>
      <div class="bar big"><i style="width:${wk.best || 0}%"></i></div>
      <p class="small muted">Se usará tu mejor tanda. Con un ingeniero de carrera de 85 o más tienes una tanda extra y comentarios más precisos.</p>
      ${wk.runs.length ? `<table class="small"><tr><th>Tanda</th>${Object.values(SETUP_KEYS).map(l => `<th class="num">${l.split(' ')[0]}</th>`).join('')}<th class="num">Confianza</th></tr>${wk.runs.map((r, i) => `<tr><td>${i + 1}</td>${Object.keys(SETUP_KEYS).map(k => `<td class="num">${r.vals[k]}</td>`).join('')}<td class="num"><b>${r.quality}%</b></td></tr>`).join('')}</table>` : ''}
    </div></div>`;
}

// ---------- sprint ----------
function sprintView() {
  const wk = S.weekend;
  if (!wk.sprintGrid) return `<div class="card"><h3>Clasificación sprint</h3><p class="small muted">Sesión corta que decide la parrilla del sprint. El sprint dura un tercio de la carrera, sin paradas obligatorias, y reparte puntos a los 8 primeros.</p><button class="btn" data-act="sprintQualy">Disputar la clasificación sprint</button></div>`;
  return `<div class="grid"><div class="card"><h3>Parrilla del sprint</h3>${gridList(wk.sprintGrid)}</div>
    <div class="card"><h3>Sprint</h3><p class="small muted">${Math.ceil(S.calendar[S.round].laps / 3)} vueltas.</p>
      <div class="row"><button class="btn" data-act="liveSprint">Ver en directo</button><button class="btn ghost" data-act="quickSprint">Simulación rápida</button></div></div></div>`;
}
function gridList(grid) {
  return `<ol class="gridlist">${grid.map(id => { const d = driver(S, id); return `<li class="${d.teamId === S.teamId ? 'mine' : ''}">${teamChip(team(S, d.teamId))}${esc(d.name)}</li>`; }).join('')}</ol>`;
}

// ---------- clasificación ----------
function qualyView() {
  const wk = S.weekend;
  if (!wk.qualy) return `<div class="card"><h3>Clasificación</h3><p class="small muted">Q1 y Q2 eliminan a los más lentos; los 10 mejores luchan por la pole en Q3. Tu reglaje: <b>${wk.setups[S.teamId]}%</b>.</p><button class="btn" data-act="qualy">Disputar la clasificación</button></div>`;
  const q = wk.qualy;
  const t = {};
  q.sessions.forEach((ss, i) => ss.times.forEach(x => { (t[x.id] = t[x.id] || [])[i] = x.time; }));
  const pole = q.sessions[2].times[0];
  return `<div class="card"><div class="row spread"><h3>Resultado de la clasificación</h3><button class="btn" data-act="toRace">Preparar la carrera</button></div>
    <p class="small">🏁 Pole para <b>${esc(driver(S, q.grid[0]).name)}</b> (${fmtLap(pole.time)})</p>
    <div class="tablewrap"><table><tr><th>Pos</th><th>Piloto</th><th class="num">Q1</th><th class="num">Q2</th><th class="num">Q3</th></tr>
    ${q.grid.map((id, i) => { const d = driver(S, id); const tt = t[id] || []; return `<tr class="${d.teamId === S.teamId ? 'mine' : ''}"><td>${i + 1}</td><td>${teamChip(team(S, d.teamId))}${esc(d.name)}</td>${[0, 1, 2].map(k => `<td class="num">${tt[k] ? fmtLap(tt[k]) : ''}</td>`).join('')}</tr>`; }).join('')}
    </table></div></div>`;
}

// ---------- antes de la carrera ----------
function preRaceView() {
  const wk = S.weekend, c = S.calendar[S.round];
  const w0 = wk.weather.w[0];
  const opts = strategyOptions(c, c.laps);
  wk.plans = wk.plans || {};
  const mine = teamDrivers(S, S.teamId);
  return `<div class="grid">
    <div class="card"><h3>Estrategia</h3>
    ${w0 > 0.15 ? `<p>🌧️ La pista está mojada: tus pilotos saldrán con <b>${COMPOUNDS[bestCompoundFor(w0)].name.toLowerCase()}</b>. Tendrás que decidir en directo cuándo cambiar a gomas de seco.</p>` :
      mine.map(d => {
        const sel = wk.plans[d.id] ? wk.plans[d.id].key : 0;
        return `<div class="stratblock"><b>${esc(d.name)}</b> <span class="small muted">sale ${ordinal(wk.qualy.grid.indexOf(d.id) + 1)}</span>
          ${opts.map((o, i) => `<label class="strat"><input type="radio" name="st-${d.id}" value="${i}" data-plan="${d.id}" ${sel === i ? 'checked' : ''}>
            <span>${o.seq.map(tyre).join('<span class="arrow">→</span>')}</span><span class="small">${o.nStops} parada${o.nStops > 1 ? 's' : ''}${o.stops.length ? ' · V' + o.stops.map(x => x.lap).join(', V') : ''}</span><span class="small muted">${i === 0 ? 'Óptima' : '+' + o.delta.toFixed(1) + ' s'}</span></label>`).join('')}
        </div>`;
      }).join('')}
    <p class="small muted">En seco hay que usar al menos dos compuestos distintos. Durante la carrera podrás cambiar el ritmo, adelantar o retrasar paradas y dar órdenes de equipo.</p>
    <button class="btn" data-act="liveRace">🚦 ¡Luces fuera!</button></div>
    <div class="card"><h3>Parrilla de salida</h3>${gridList(wk.qualy.grid)}</div></div>`;
}

// ---------- directo ----------
function startLive(kind, quick) {
  const wk = S.weekend, c = S.calendar[S.round];
  const opts = strategyOptions(c, c.laps);
  const plans = {};
  if (kind === 'race') teamDrivers(S, S.teamId).forEach(d => { const o = opts[(wk.plans && wk.plans[d.id] ? wk.plans[d.id].key : 0)] || opts[0]; plans[d.id] = { start: o.seq[0], stops: o.stops }; });
  const sim = kind === 'race'
    ? new RaceSim(S, { kind, grid: wk.qualy.grid, setups: wk.setups, weather: wk.weather, plans })
    : new RaceSim(S, { kind, grid: wk.sprintGrid, setups: wk.setups, weather: wk.sprintWeather, laps: Math.ceil(c.laps / 3) });
  live = { sim, kind, prev: sim.snap, next: sim.snap, t0: 0, f: 1, speed: 1, paused: false, raf: 0, done: false };
  recordHist();
  if (quick) { sim.runToEnd(); live.prev = live.next = sim.snap; live.done = true; }
  render();
}

function liveView() {
  const L = live, sim = L.sim, c = sim.c;
  if (L.done) return resultsView();
  const svgCars = sim.cars.map(x => `<g id="car-${x.id}" class="car ${x.mine ? 'mine' : ''}"><circle r="${x.mine ? 6 : 4.5}" fill="${team(S, x.teamId).color}"/>${x.mine ? `<text y="-9">${abbr(x.d.name)}</text>` : ''}</g>`).join('');
  const where = `<span class="small muted trackname">${hasRealTrack(c) ? '📍 ' + esc(getTrackGeometry(c).label) : 'Trazado generado'}</span>`;
  const viewSeg = `<div class="seg" role="group" aria-label="Vista"><button class="${pref3d ? '' : 'on'}" data-act="view2d">2D</button><button class="${pref3d ? 'on' : ''}" data-act="view3d">3D</button></div>`;
  const feed = `<div class="grid live-lower">
      <div id="myCars" class="mycars"></div>
      <div class="card"><h3>Directo</h3><div id="feed" class="feed"></div></div>
    </div>`;
  if (pref3d) {
    // Retransmisión: marcador, clasificación, minimapa y piloto seguido superpuestos a la imagen 3D
    return `<div class="live">
      <div class="broadcast">
        <div id="v3d" class="v3d">
          <div class="v3d-loading">Cargando la vista 3D…</div>
          <div class="ov ov-head" id="liveHead"></div>
          <div class="ov ov-tower"><div id="tower" class="tower tv" role="list" aria-label="Clasificación en carrera"></div></div>
          <div class="ov ov-map">${trackSVG(c, { id: 'livetrk', cars: svgCars })}</div>
          <div id="v3dHud" class="v3d-hud"></div>
        </div>
        <div class="bc-controls">
          <div class="bc-group">${viewSeg}<div class="seg seg-scroll" role="group" aria-label="Cámara">${Object.entries(CAMS).map(([k, l]) => `<button data-act="cam" data-m="${k}" class="${(L.cam || 'chase') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
          <div class="bc-group" id="liveCtl"></div>
        </div>
        <p class="small muted v3d-tip">Arrastra para girar la cámara, usa la rueda (en cámara libre) para acercar y toca un coche o su fila para seguirlo. ${where}</p>
      </div>
      ${feed}</div>`;
  }
  return `<div class="live">
    <div class="card livebar"><div class="row spread"><div id="liveHead" class="row"></div><div id="liveCtl" class="row"></div></div></div>
    <div class="livegrid">
      <div class="card trackcard"><div class="row spread viewbar">${viewSeg}${where}</div>${trackSVG(c, { id: 'livetrk', cars: svgCars })}</div>
      <div class="card"><div id="tower" class="tower" role="list" aria-label="Clasificación en carrera"></div></div>
    </div>
    ${feed}</div>`;
}

function liveHUD() {
  const L = live; if (!L) return;
  const sim = L.sim, snap = sim.snap, w = sim.wet, ref = sim.c.base;
  const head = document.getElementById('liveHead');
  if (!head) return;
  const flag = sim.sc ? `<span class="flag yellow">${sim.sc.type === 'SC' ? 'SAFETY CAR' : 'VSC'}</span>` : sim.finished ? '<span class="flag chk">🏁 FINAL</span>' : sim.lap === 0 ? '<span class="flag flag-grid">PARRILLA</span>' : '<span class="flag green">VERDE</span>';
  head.innerHTML = `<b class="racename">${esc(sim.c.name)}${sim.kind === 'sprint' ? ' · Sprint' : ''}</b><span class="lapbig">V ${Math.min(sim.lap, sim.totalLaps)}<small>/${sim.totalLaps}</small></span>${flag}<span class="wx" title="${wxText(w)}">${wxIcon(w)} ${wxText(w)}</span>`;
  const ctl = document.getElementById('liveCtl');
  if (ctl) ctl.innerHTML = `${L.paused ? '<button class="btn sm" data-act="lvPause">▶ Seguir</button>' : '<button class="btn sm ghost" data-act="lvPause">⏸ Pausa</button>'}
      <div class="seg" role="group" aria-label="Velocidad">${(is3D() ? SPEEDS_3D : SPEEDS_2D).map(x => `<button class="${(is3D() ? (L.speed3 || 1) : L.speed) === x ? 'on' : ''}" data-act="lvSpeed" data-x="${x}" title="${is3D() ? (x === 1 ? 'Tiempo real' : x + ' veces más rápido que en la realidad') : ''}">${x}×</button>`).join('')}</div>
      <button class="btn sm ghost" data-act="lvSkip">⏭ Al final</button>`;

  const foll = L.v3d ? L.v3d.getFollow() : null;
  document.getElementById('tower').innerHTML = snap.cars.map((x, i) => {
    const car = sim.byId[x.id];
    const gap = x.out ? '<span class="bad">OUT</span>' : i === 0 ? (sim.lap === 0 ? '' : 'Líder') : x.gap > ref ? '+' + Math.floor(x.gap / ref) + ' V' : '+' + x.gap.toFixed(1);
    return `<div class="r ${car.mine ? 'mine' : ''} ${x.out ? 'out' : ''} ${foll === x.id ? 'foll' : ''}" role="listitem button" tabindex="0" data-act="follow" data-id="${x.id}" style="--tc:${team(S, car.teamId).color}" aria-label="${i + 1}º ${esc(car.d.name)}"><b class="pos">${i + 1}</b><span class="nm"><i class="tbar"></i>${esc(abbr(car.d.name))} <span class="small muted hide-sm full">${esc(car.d.name)}</span></span>${x.out ? '<span></span>' : tyre(x.comp)}<span class="num small gap">${x.pitted ? '<span class="badge">BOX</span>' : gap}</span></div>`;
  }).join('');

  const mine = sim.cars.filter(x => x.mine);
  document.getElementById('myCars').innerHTML = mine.map(x => {
    const i = sim.order.indexOf(x.id);
    const ahead = i > 0 ? sim.byId[sim.order[i - 1]] : null, behind = sim.byId[sim.order[i + 1]];
    const gA = ahead && !x.out ? (x.t - ahead.t).toFixed(1) : '—', gB = behind && !behind.out && !x.out ? (behind.t - x.t).toFixed(1) : '—';
    const next = x.plan[0];
    if (x.out) return `<div class="card mycar out"><b>${esc(x.d.name)}</b><p class="bad">Abandono en la vuelta ${x.outLap}: ${esc(x.reason.toLowerCase())}.</p></div>`;
    return `<div class="card mycar" style="--c:${team(S, x.teamId).color}">
      <div class="row spread"><b class="mc-name">P${i + 1} · ${esc(x.d.name)}</b><span class="small muted">↑ ${gA} s · ↓ ${gB} s</span></div>
      <div class="row small" style="margin:6px 0">${tyre(x.compound)} <span>${x.age} v.</span><div class="bar wear" style="flex:1"><i style="width:${Math.min(100, x.wear)}%;background:${x.wear > 85 ? 'var(--bad)' : x.wear > 60 ? 'var(--warn)' : 'var(--good)'}"></i></div><span>${Math.round(x.wear)}%</span></div>
      <div class="row small muted">${x.box ? `<span class="warn">🔧 Entrará en boxes: ${COMPOUNDS[x.box].name}</span> <button class="btn sm ghost" data-act="lvCancel" data-id="${x.id}">Cancelar</button>` : next ? `Parada prevista: V${next.lap} → ${COMPOUNDS[next.compound].name}` : 'Sin más paradas previstas'}</div>
      <div class="seg" role="group" aria-label="Ritmo">${Object.entries(MODES).map(([k, m]) => `<button class="${x.mode === k ? 'on' : ''}" data-act="lvMode" data-id="${x.id}" data-m="${k}">${m.label}</button>`).join('')}</div>
      <div class="row small" style="margin-top:8px"><span>Boxes:</span>${Object.keys(COMPOUNDS).map(k => `<button class="tyrebtn" data-act="lvBox" data-id="${x.id}" data-c="${k}" title="Parar a por ${COMPOUNDS[k].name.toLowerCase()}" aria-label="Parar a por ${COMPOUNDS[k].name.toLowerCase()}">${tyre(k)}</button>`).join('')}
        <label class="auto"><input type="checkbox" data-auto="${x.id}" ${x.auto ? 'checked' : ''}> IA de estrategia</label></div>
    </div>`;
  }).join('') + (mine.filter(x => !x.out).length === 2 ? `<button class="btn sm ghost" data-act="lvOrder">📻 Orden de equipo: intercambiar posiciones</button>` : '');

  document.getElementById('feed').innerHTML = [...sim.events].reverse().slice(0, 60).map(e => `<div class="${e.type} ${e.mine ? 'mineev' : ''}"><span class="badge">V${e.lap}</span> ${esc(e.text)}</div>`).join('');
}

// Posición física de cada coche a partir de sus propios tiempos de paso por meta (no de la diferencia con el líder).
// En la vuelta en que para, conduce hasta la línea, se queda en su garaje el tiempo de la parada y sale.
function recordHist() {
  const L = live, sim = L.sim;
  L.hist = L.hist || Object.fromEntries(sim.cars.map(x => [x.id, { t: [x.grid === 1 ? 0 : x.t], pit: [false], loss: [0] }]));
  L.T = L.T || [0];
  if (sim.lap === 0) return;
  for (const x of sim.cars) {
    if (x.out) continue;
    const h = L.hist[x.id];
    if (h.t.length > sim.lap) continue;
    h.t.push(x.t); h.pit.push(!!x.pitted); h.loss.push(x.pitted ? x.pitLoss || 0 : 0);
  }
  const lead = sim.byId[sim.order[0]];
  L.T.push(lead && !lead.out ? lead.t : Math.min(...sim.cars.filter(x => !x.out).map(x => x.t)));
}
function liveStep() { const L = live; L.prev = L.sim.snap; L.sim.step(); L.next = L.sim.snap; recordHist(); }
function animTime(f) { const T = live.T || [0], k = T.length - 1; return k === 0 ? 0 : T[k - 1] + (T[k] - T[k - 1]) * f; }
function physProg(id, Tm) {
  const h = live.hist && live.hist[id];
  if (!h || Tm <= h.t[0]) return { p: 0, frac: 0, n: 1, grid: true };
  let n = 1;
  while (n < h.t.length && h.t[n] < Tm) n++;
  if (n >= h.t.length) return { p: h.t.length - 1, frac: 1, n: h.t.length - 1, stale: true };
  const start = h.t[n - 1], loss = h.pit[n] ? h.loss[n] : 0, drive = Math.max(1, h.t[n] - start - loss);
  const frac = (Tm - start) / drive;
  if (frac >= 1) return { p: n, frac: 1, n, stop: true, pitLap: true };
  return { p: n - 1 + frac, frac, n, pitLap: h.pit[n], afterPit: h.pit[n - 1] };
}
function carProgs(f) {
  const Tm = animTime(f);
  return live.next.cars.map(x => ({ x, ph: x.out ? null : physProg(x.id, Tm) }));
}

function drawCars(f) {
  const path = document.getElementById('livetrk');
  if (!path || !live) return;
  const len = path.getTotalLength();
  const geo = getTrackGeometry(live.sim.c), real = hasRealTrack(live.sim.c);
  for (const { x, ph } of carProgs(f)) {
    const g = document.getElementById('car-' + x.id);
    if (!g) continue;
    if (x.out || !ph) { g.style.display = 'none'; continue; }
    const frac = (((ph.p % 1) + 1) % 1);
    const pt = path.getPointAtLength(real ? geo.fracToDist(frac) / geo.line.length * len : frac * len);
    g.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
  }
}

function liveLoop(now) {
  const L = live;
  if (!L || view !== 'weekend' || L.done) return;
  const dur = lapDur();
  if (!L.paused) {
    if (!L.t0) L.t0 = now - dur + (pref3d && L.sim.lap === 0 ? GRID_HOLD : 0); // en 3D, unos segundos de parrilla con el semáforo
    L.f = (now - L.t0) / dur;
    if (L.f >= 1) {
      if (L.sim.finished) { L.done = true; end3D(); render(); return; }
      liveStep(); L.t0 = now; L.f = 0;
      liveHUD();
    }
  }
  drawCars(Math.min(1, Math.max(0, L.f)));
  if (L.v3d && pref3d && document.getElementById('v3d')) {
    const dt = L.lastNow ? (now - L.lastNow) / 1000 : 0.016;
    L.last3D = applyRacecraft(state3D(Math.min(1, Math.max(0, L.f)), now));
    L.v3d.frame(L.last3D, dt);
    if (now - (L.hudT || 0) > 120) { L.hudT = now; hud3D(now); }
  }
  L.lastNow = now;
  L.raf = requestAnimationFrame(liveLoop);
}

// ---------- vista 3D ----------
// En 2D una vuelta dura 1,5 s a 1×; en 3D la escala es de tiempo real (1× = la vuelta dura lo que duraría de verdad)
const SPEEDS_2D = [1, 2, 4, 8], SPEEDS_3D = [1, 4, 16, 60];
const GRID_HOLD = 4500;
function is3D() { return pref3d && !!live; }
function lapDur() {
  if (!live) return 1500;
  if (is3D()) return getTrackGeometry(live.sim.c).lapTime * 1000 / (live.speed3 || 1);
  return 1500 / live.speed;
}
function retime(fn) { const f = Math.max(0, live.f); fn(); live.t0 = performance.now() - f * lapDur(); }
function set3D(on) {
  if (live && live.t0) { const f = Math.max(0, live.f); pref3d = on; live.t0 = performance.now() - f * lapDur(); }
  pref3d = on;
  try { localStorage.setItem('pp_view3d', on ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
  render();
}
async function mount3D() {
  const L = live, el = document.getElementById('v3d');
  if (!L || !el) return;
  if (L.v3d) { L.v3d.attach(el); el.querySelector('.v3d-loading')?.remove(); return; }
  if (L.v3dLoading) return;
  L.v3dLoading = true;
  try {
    await ensureRealTrack(L.sim.c);
    V3D = V3D || await import('./view3d.js');
    if (live !== L || L.done) return;
    const target = document.getElementById('v3d');
    if (!target) return;
    L.v3d = V3D.createView3D(target, {
      geo: getTrackGeometry(L.sim.c),
      cars: L.sim.cars.map(x => ({ id: x.id, teamId: x.teamId, color: team(S, x.teamId).color, mine: x.mine, label: abbr(x.d.name) })),
      onFollow: () => { liveHUD(); hud3D(performance.now()); },
      onCamera: m => { L.cam = m; document.querySelectorAll('[data-act="cam"]').forEach(b => b.classList.toggle('on', b.dataset.m === m)); },
    });
    L.v3d.setCamera(L.cam || 'chase');
    if (L.t0) { const f = Math.max(0, L.f); L.t0 = performance.now() - f * lapDur(); }
    liveHUD();
    target.querySelector('.v3d-loading')?.remove();
    L.last3D = applyRacecraft(state3D(Math.min(1, Math.max(0, L.f)), performance.now()));
    L.v3d.frame(L.last3D, 0.016);
  } catch (err) {
    console.warn(err);
    toast('No se pudo iniciar la vista 3D en este dispositivo. Se muestra la vista 2D.');
    pref3d = false; render();
  } finally { L.v3dLoading = false; }
}
function end3D() { if (live && live.v3d) { live.v3d.dispose(); live.v3d = null; } }

const GEARS = [0, 85, 120, 155, 190, 225, 262, 296];
function liveSpeedKmh(geo, dist) {
  const sim = live.sim;
  let v = geo.speedAt(dist) * 3.6 * Math.min(1.1, Math.max(0.75, geo.lapTime / sim.c.base));
  if (sim.sc) v *= sim.sc.type === 'SC' ? 0.5 : 0.6;
  return v * (1 - 0.18 * sim.wet);
}
const smooth01 = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function state3D(f, now = performance.now()) {
  const L = live, sim = L.sim, geo = getTrackGeometry(sim.c), len = geo.line.length;
  const list = carProgs(f).map(({ x, ph }) => {
    const car = sim.byId[x.id];
    const D = ph ? Math.floor(ph.p) * len + geo.fracToDist(((ph.p % 1) + 1) % 1) : null;
    const c = { id: x.id, teamId: car.teamId, D, dist: D === null ? 0 : ((D % len) + len) % len, out: x.out, comp: x.comp, pos: x.pos, pitted: x.pitted, label: abbr(car.d.name), mine: car.mine, lat: 0, kmh: 0 };
    if (ph && !ph.grid) {
      const toLine = ph.n * len - D, fromLine = D - (ph.n - 1) * len;
      if (ph.stop) c.pit = { phase: 'stop', t: 0 };
      else if (ph.pitLap && toLine < -PIT_IN) c.pit = { phase: 'in', t: 1 - toLine / -PIT_IN };
      else if (ph.afterPit && fromLine < PIT_OUT) c.pit = { phase: 'out', t: fromLine / PIT_OUT };
      c.kmh = c.pit ? (c.pit.phase === 'stop' ? 0 : 80) : liveSpeedKmh(geo, c.dist);
    }
    if (ph && ph.grid) c.grid = { k: car.grid - 1, blend: 0 };
    else if (ph && ph.n === 1 && ph.frac < 0.12) c.grid = { k: car.grid - 1, blend: smooth01(ph.frac / 0.12) };
    return c;
  });
  // Semáforo: se encienden las cinco luces una a una y se apagan en la salida
  let lights = 0;
  if (sim.lap === 0 && L.t0) { const left = L.t0 + lapDur() - now; lights = Math.max(0, Math.min(5, Math.ceil((GRID_HOLD - 600 - left) / 700))); }
  return { cars: list, wet: sim.wet, sc: sim.sc ? sim.sc.type : null, lights, compColors: Object.fromEntries(Object.entries(COMPOUNDS).map(([k, v]) => [k, v.color])) };
}
// Comportamiento en pista para la vista 3D: los coches hacen fila y solo adelantan en las frenadas fuertes
// (nunca con coche de seguridad); el adelantamiento se completa en paralelo, sin saltos.
const FOLLOW_GAP = 7.5;
function applyRacecraft(st) {
  const L = live, sim = L.sim, geo = getTrackGeometry(sim.c), len = geo.line.length;
  L.vis = L.vis || {};
  const cars = st.cars.filter(c => !c.out && c.D !== null);
  cars.sort((a, b) => (L.vis[b.id] ? L.vis[b.id].D : b.D) - (L.vis[a.id] ? L.vis[a.id].D : a.D));
  let prev = null;
  for (const c of cars) {
    c.raw = c.D;
    const V = L.vis[c.id] || (L.vis[c.id] = { D: c.D, raw: c.D, prevD: c.D });
    V.prevD = V.D;
    const free = c.grid || c.pit;
    const rawAdv = Math.max(0, c.D - V.raw);
    let target = free ? c.D : Math.min(c.D, V.D + rawAdv * 1.35 + 0.02);
    if (!free && target < V.D) target = V.D;
    if (prev && !free && !prev.grid && !prev.pit && prev.Dv - target < len / 2) {
      const limit = prev.Dv - FOLLOW_GAP;
      if (target > limit) {
        const wantsPass = c.raw > prev.raw + 0.5;
        const alongside = V.passing === prev.id && wantsPass;
        if (alongside || (wantsPass && !sim.sc && geo.inZone(target))) V.passing = prev.id;
        else {
          const prevAdv = Math.max(0, prev.Dv - (L.vis[prev.id].prevD ?? prev.Dv));
          target = Math.min(target, Math.max(limit, V.D + prevAdv * 0.97));
          V.passing = null;
        }
      }
    }
    if (V.passing && prev && target > prev.Dv + 1) V.passing = null; // adelantamiento completado
    V.D = target; V.raw = c.D;
    c.Dv = target; c.D = target; c.dist = ((target % len) + len) % len;
    prev = c;
  }
  // Carriles por posición física en la pista (incluye coches doblados): cada coche busca un carril libre
  L.sides = L.sides || {};
  const onTrack = cars.filter(c => !c.pit && !c.grid);
  if (onTrack.length) {
    const ds = onTrack.map(c => c.dist).sort((a, b) => a - b);
    let cut = 0, gapMax = -1;
    ds.forEach((d, i) => { const g = i === 0 ? ds[0] + len - ds[ds.length - 1] : d - ds[i - 1]; if (g > gapMax) { gapMax = g; cut = d - g / 2; } });
    const rel = c => ((c.dist - cut) % len + len) % len;
    onTrack.sort((a, b) => rel(b) - rel(a));
    const LANES = [0, 2.9, -2.9], placed = [];
    for (const c of onTrack) {
      const near = placed.filter(o => rel(o) - rel(c) < 8.5);
      let lane = 0;
      if (near.length) {
        const prefs = [L.sides[c.id] ?? 0, 0, 2.9, -2.9];
        lane = prefs.find(l => near.every(o => Math.abs(o.lat - l) >= 2.4));
        if (lane === undefined) lane = LANES.reduce((best, l) => Math.min(...near.map(o => Math.abs(o.lat - l))) > Math.min(...near.map(o => Math.abs(o.lat - best))) ? l : best, 0);
      } else if (L.sides[c.id] && placed.some(o => rel(o) - rel(c) < 18)) lane = L.sides[c.id];
      c.lat = lane; L.sides[c.id] = lane; placed.push(c);
    }
  }
  return st;
}
function hud3D(now = performance.now()) {
  const L = live, el = document.getElementById('v3dHud');
  if (!L || !L.v3d || !el) return;
  const id = L.v3d.getFollow(), car = L.sim.byId[id];
  if (!car) return;
  const st = (L.last3D || applyRacecraft(state3D(Math.min(1, Math.max(0, L.f)), now))).cars.find(c => c.id === id);
  if (!st) return;
  const still = car.out || L.sim.lap === 0 || (st.pit && st.pit.phase === 'stop');
  const kmh = still ? 0 : Math.round(st.kmh);
  const gear = still ? 'N' : GEARS.filter(g => kmh >= g).length;
  const i = (st.pos || L.sim.order.indexOf(id) + 1) - 1, ahead = L.sim.order.indexOf(id) > 0 ? L.sim.byId[L.sim.order[L.sim.order.indexOf(id) - 1]] : null;
  const status = car.out ? '<span class="hud-tag bad">Abandono</span>' : st.pit ? `<span class="hud-tag">${st.pit.phase === 'stop' ? 'Parada en boxes' : 'Calle de boxes · 80 km/h'}</span>` : '';
  el.innerHTML = `<div class="hud-name"><i class="tbar" style="--tc:${team(S, car.teamId).color}"></i><b>P${i + 1}</b> ${esc(car.d.name)}</div>
    <div class="hud-main"><span class="hud-speed">${kmh}</span><span class="small">km/h</span><span class="hud-gear">${gear}</span></div>
    <div class="hud-row">${tyre(car.compound)} <span>${Math.round(car.wear)}%</span>${ahead && !car.out ? `<span>↑ ${(car.t - ahead.t).toFixed(1)} s</span>` : ''}${status}</div>`;
}

function resultsView() {
  const sim = live.sim, res = sim.results();
  const mine = res.filter(r => r.teamId === S.teamId);
  return `<div class="card hero"><div class="row spread"><h2>${sim.kind === 'sprint' ? 'Resultado del sprint' : 'Resultado final'} · ${esc(sim.c.name)}</h2><button class="btn" data-act="liveContinue">Continuar</button></div>
    ${mine.map(r => `<div>${esc(driver(S, r.id).name)}: <b>${r.out ? 'Abandono (' + esc(r.reason) + ')' : ordinal(r.pos)}</b> · salió ${ordinal(r.grid)} · ${r.pts} pts</div>`).join('')}
    <div class="podium">${res.slice(0, 3).map((r, i) => `<div class="p${i + 1}"><div class="pn">${i + 1}</div>${teamChip(team(S, r.teamId))}<b>${esc(driver(S, r.id).name)}</b><div class="small muted">${esc(team(S, r.teamId).name)}</div></div>`).join('')}</div>
    <div class="tablewrap"><table><tr><th>#</th><th>Piloto</th><th class="num">Salida</th><th>Neumáticos</th><th class="num">Diferencia</th><th class="num">Pts</th></tr>
    ${res.map(r => `<tr class="${r.teamId === S.teamId ? 'mine' : ''}"><td>${r.out ? '—' : r.pos}</td><td>${teamChip(team(S, r.teamId))}${esc(driver(S, r.id).name)}${r.fl ? ' ⏱️' : ''}</td><td class="num">${r.grid}</td><td>${r.used.map(tyre).join('')}</td>
      <td class="num">${r.out ? 'V' + r.outLap + ' · ' + esc(r.reason) : r.pos === 1 ? fmtLap(r.total) : '+' + r.gap.toFixed(1) + ' s'}${r.penalty ? ' <span class="badge">+' + r.penalty + ' s</span>' : ''}</td><td class="num">${r.pts}</td></tr>`).join('')}
    </table></div></div>
    <div class="card" style="margin-top:14px"><h3>Resumen</h3><div class="feed">${sim.events.reverse().map(e => `<div class="${e.type}"><span class="badge">V${e.lap}</span> ${esc(e.text)}</div>`).join('')}</div></div>`;
}

// ---------- gráfico del campeonato ----------
const SERIES_VARS = ['--s1', '--s2', '--s3', '--s4', '--s5'];
function pointsChart(drivers) {
  const { rounds, series } = pointsProgression(S, drivers.map(d => d.id));
  if (rounds.length < 2) return '<p class="muted small">El gráfico aparecerá tras la segunda ronda.</p>';
  const W = 640, H = 240, m = { l: 36, r: 12, t: 10, b: 26 };
  const max = Math.max(10, ...series.flatMap(s => s.values));
  const x = i => m.l + (i / (rounds.length - 1)) * (W - m.l - m.r);
  const y = v => H - m.b - (v / max) * (H - m.t - m.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(max * f));
  const data = series.map((s, k) => ({ name: driver(S, s.id).name, color: `var(${SERIES_VARS[k]})`, values: s.values }));
  window.__chart = { data, rounds, x, y, W };
  return `<div class="legend">${data.map(d => `<span><i style="background:${d.color}"></i>${esc(d.name)}</span>`).join('')}</div>
    <div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" class="chart" id="ptsChart" role="img" aria-label="Puntos acumulados por ronda de los cinco primeros pilotos">
      ${ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" class="gridline"/><text x="${m.l - 6}" y="${y(t) + 4}" class="ax" text-anchor="end">${t}</text>`).join('')}
      ${rounds.map((r, i) => (rounds.length <= 12 || i % 2 === 0) ? `<text x="${x(i)}" y="${H - 8}" class="ax" text-anchor="middle">R${r + 1}</text>` : '').join('')}
      ${data.map(d => `<polyline fill="none" stroke="${d.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${d.values.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ')}"/>`).join('')}
      <line id="xhair" y1="${m.t}" y2="${H - m.b}" class="xhair" style="display:none"/>
      <g id="xdots"></g>
      <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" id="chartHit"/>
    </svg><div id="chartTip" class="tip" hidden></div></div>`;
}
function chartHover(e) {
  const ch = window.__chart, svg = document.getElementById('ptsChart');
  if (!ch || !svg) return;
  const rect = svg.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width * ch.W;
  let best = 0;
  ch.rounds.forEach((r, i) => { if (Math.abs(ch.x(i) - px) < Math.abs(ch.x(best) - px)) best = i; });
  const xh = document.getElementById('xhair');
  xh.style.display = ''; xh.setAttribute('x1', ch.x(best)); xh.setAttribute('x2', ch.x(best));
  document.getElementById('xdots').innerHTML = ch.data.map(d => `<circle cx="${ch.x(best)}" cy="${ch.y(d.values[best])}" r="4.5" fill="${d.color}" stroke="var(--panel)" stroke-width="2"/>`).join('');
  const tip = document.getElementById('chartTip');
  tip.hidden = false;
  tip.innerHTML = `<b>Ronda ${ch.rounds[best] + 1} · ${esc(S.calendar[ch.rounds[best]].name)}</b>` + [...ch.data].sort((a, b) => b.values[best] - a.values[best]).map(d => `<div><i style="background:${d.color}"></i>${esc(d.name)} <b>${d.values[best]}</b></div>`).join('');
  const left = (ch.x(best) / ch.W) * rect.width;
  tip.style.left = Math.min(rect.width - 190, Math.max(0, left + 12)) + 'px';
}
function chartLeave() {
  const tip = document.getElementById('chartTip'), xh = document.getElementById('xhair'), dots = document.getElementById('xdots');
  if (tip) tip.hidden = true;
  if (xh) xh.style.display = 'none';
  if (dots) dots.innerHTML = '';
}

// ---------- acciones ----------
function readSetup() { const v = {}; document.querySelectorAll('[data-setup]').forEach(el => v[el.dataset.setup] = +el.value); return v; }

const ACTIONS = {
  pickTeam(el) { S = newGame(el.dataset.id, roster); save(S); go('finance'); toast('Elige un patrocinador principal para empezar.'); },
  createTeam() {
    const name = document.getElementById('ctName').value.trim();
    if (name.length < 3) return toast('Ponle un nombre a tu equipo (mínimo 3 letras).');
    const { roster: r, teamId } = customizeRoster(roster, { name, short: document.getElementById('ctShort').value.trim() || name, color: document.getElementById('ctColor').value });
    S = newGame(teamId, r); save(S); go('finance'); toast(`¡${name} entra en la parrilla! Elige patrocinador.`);
  },
  startWeekend() {
    if (!S.sponsor) { toast('Elige antes un patrocinador principal (pestaña Finanzas).'); return go('finance'); }
    startWeekend(S); render();
  },
  practiceRun() { practiceRun(S, readSetup()); render(); },
  finishPractice() { finishPractice(S); render(); },
  sprintQualy() {
    const wk = S.weekend, c = S.calendar[S.round];
    wk.sprintWeather = makeWeather(c, Math.ceil(c.laps / 3));
    wk.sprintGrid = simulateQualifying(S, c, wk.sprintWeather.w[0], wk.setups).grid;
    save(S); render();
  },
  liveSprint() { startLive('sprint', false); },
  quickSprint() { startLive('sprint', true); },
  qualy() { runQualifying(S); render(); },
  toRace() { S.weekend.stage = 'race'; save(S); render(); },
  liveRace() { startLive('race', false); },
  liveContinue() {
    end3D();
    const res = live.sim.results();
    if (live.kind === 'sprint') { finishSprint(S, res); live = null; render(); }
    else { finishRace(S, res, S.weekend.weather.kind !== 'dry'); live = null; go('hq'); }
  },
  lvPause() { live.paused = !live.paused; if (!live.paused) live.t0 = performance.now() - live.f * lapDur(); liveHUD(); },
  lvSpeed(el) { retime(() => { if (is3D()) live.speed3 = +el.dataset.x; else live.speed = +el.dataset.x; }); liveHUD(); },
  lvSkip() { teamDrivers(S, S.teamId).forEach(d => live.sim.setAuto(d.id, true)); live.sim.runToEnd(); live.done = true; end3D(); render(); },
  lvMode(el) { live.sim.setMode(el.dataset.id, el.dataset.m); liveHUD(); },
  lvBox(el) { live.sim.requestBox(el.dataset.id, el.dataset.c); liveHUD(); },
  lvCancel(el) { live.sim.cancelBox(el.dataset.id); liveHUD(); },
  view2d() { set3D(false); },
  view3d() { set3D(true); },
  cam(el) { if (live) { live.cam = el.dataset.m; live.v3d && live.v3d.setCamera(live.cam); document.querySelectorAll('[data-act="cam"]').forEach(b => b.classList.toggle('on', b === el)); } },
  follow(el) { if (live && live.v3d) { live.v3d.setFollow(el.dataset.id); hud3D(); liveHUD(); } },
  lvOrder() { const e = live.sim.teamOrder(S.teamId); if (e) toast(e); liveHUD(); },
  endSeason() { endSeason(S); go('hq'); },
  startSeason() { const e = startSeason(S); e ? toast(e) : go('hq'); },
  startRD() { const e = startRD(S, document.getElementById('rdPillar').value, document.getElementById('rdSize').value); toast(e || 'Proyecto iniciado.'); render(); },
  facility() { const e = upgradeFacility(S); toast(e || 'Fábrica ampliada.'); render(); },
  crew() { const e = trainCrew(S); toast(e || 'El equipo de boxes ha mejorado.'); render(); },
  hire(el) { const e = hireStaff(S, el.dataset.role, +el.dataset.i); toast(e || 'Fichaje cerrado.'); render(); },
  sponsor(el) { chooseSponsor(S, +el.dataset.i); toast('Patrocinador firmado.'); render(); },
  sign(el) {
    const id = el.dataset.id;
    const sal = parseFloat(document.querySelector(`[data-salary="${id}"]`).value);
    const yrs = parseInt(document.querySelector(`[data-years="${id}"]`).value, 10);
    const e = signDriver(S, id, sal, yrs); toast(e || '¡Fichaje cerrado!'); render();
  },
  release(el) { if (!armed(el, 'Liberar al piloto cuesta la mitad del contrato restante.')) return; const e = releaseDriver(S, el.dataset.id); if (e) toast(e); render(); },
  renew(el) { const e = renewDriver(S, el.dataset.id, 1); toast(e || 'Contrato renovado.'); render(); },
  async rosterUrl() {
    const url = document.getElementById('rosterUrl').value.trim();
    if (!/^https?:\/\//.test(url)) return toast('Introduce una URL válida.');
    toast('Descargando plantilla…');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      useRoster(await res.json(), decodeURIComponent(url.split('/').pop()).replace(/\.json$/i, ''));
    } catch (err) { toast('No se pudo descargar la plantilla (' + err.message + '). Si el enlace está bloqueado, descarga el JSON y usa «Subir archivo».'); }
  },
  rosterDefault() { roster = defaultRoster(); rosterRaw = null; rosterSet = 'base'; render(); },
  export() {
    const json = JSON.stringify(S);
    if (navigator.clipboard) navigator.clipboard.writeText(json).then(() => toast('Partida copiada al portapapeles (y descargada si tu navegador lo permite).')).catch(() => {});
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `paddockplus-${S.season}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  pasteImport() { document.getElementById('pasteBox').hidden = false; document.getElementById('pasteText').focus(); },
  pasteLoad() {
    try { const data = migrate(JSON.parse(document.getElementById('pasteText').value)); if (!data.teams || !data.drivers) throw new Error(); S = data; save(S); live = null; go('hq'); toast('Partida importada.'); }
    catch (err) { toast('El texto no es una partida válida.'); }
  },
  reset(el) { if (!armed(el, 'Se borrará la partida actual de este navegador.')) return; wipe(); S = null; end3D(); live = null; go('new'); },
};

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); return go(g.dataset.go); }
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled && ACTIONS[a.dataset.act]) ACTIONS[a.dataset.act](a);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.teampick')) { e.preventDefault(); ACTIONS.pickTeam(e.target); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.tower .r')) { e.preventDefault(); ACTIONS.follow(e.target); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.setup) document.getElementById('sv-' + t.dataset.setup).textContent = t.value;
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.plan) { S.weekend.plans = S.weekend.plans || {}; S.weekend.plans[t.dataset.plan] = { key: +t.value }; save(S); }
  if (t.dataset.auto && live) live.sim.setAuto(t.dataset.auto, t.checked);
  if (t.id === 'rosterSet') { rosterSet = t.value; roster = convertExternalRoster(rosterRaw, rosterSet, rosterLabel); render(); }
  if (t.id === 'rosterFile' && t.files[0]) {
    const f = t.files[0];
    f.text().then(txt => { try { useRoster(JSON.parse(txt), f.name.replace(/\.json$/i, '')); } catch (err) { toast('El archivo no es un JSON válido.'); } });
  }
  if (t.id === 'importFile' && t.files[0]) {
    t.files[0].text().then(txt => {
      try { const data = migrate(JSON.parse(txt)); if (!data.teams || !data.drivers) throw new Error(); S = data; save(S); live = null; go('hq'); toast('Partida importada.'); }
      catch (err) { toast('El archivo no es una partida válida.'); }
    });
  }
});
document.addEventListener('mousemove', e => { if (e.target.id === 'chartHit') chartHover(e); });
document.addEventListener('mouseout', e => { if (e.target.id === 'chartHit') chartLeave(); });
document.addEventListener('touchstart', e => { if (e.target.id === 'chartHit') chartHover(e.touches[0]); }, { passive: true });

function render() {
  if (!S && view !== 'credits') view = 'new';
  renderChrome();
  $app.innerHTML = VIEWS[view]();
  ['hqtrk', 'pvtrk', 'livetrk'].forEach(id => document.getElementById(id) && placeStartLine(id));
  // Carga en segundo plano el trazado real del circuito que se está mostrando y vuelve a dibujar
  const shown = live ? live.sim.c : (S && S.phase === 'season' ? S.calendar[S.round] : null);
  const key = shown && realTrackKey(shown);
  if (key && !(key in TRACK_GEO) && !render.loading) { render.loading = true; ensureRealTrack(shown).then(g => { render.loading = false; if (g) render(); }); }
  if (live && view === 'weekend' && !live.done) {
    liveHUD(); drawCars(Math.min(1, live.f));
    if (pref3d) mount3D();
    cancelAnimationFrame(live.raf); live.raf = requestAnimationFrame(liveLoop);
  }
}
render();
