import { PROVS, IDS, CELLS, POWERS, ARMY_ADJ, FLEET_ADJ, WIN } from '/shared/map.js';
import { validate, unitAt, orderText, adjustments, scCount, needsOrders } from '/shared/engine.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const PW = Object.keys(POWERS);
const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard', brutal: 'Brutal' };

let session = null, V = null, es = null;
let draft = [], sel = null, phaseKey = '', showLast = false, tab = 'orders', channel = 'all', composerKey = '';
const seen = {};

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
async function post(path, body = {}) {
  const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, ...(session || {}) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
const act = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
function show(id) { for (const s of ['home', 'lobby', 'game']) $('#' + s).hidden = s !== id; }

// ---------- Home ----------
const savedName = store.get('accord:name');
if (savedName) document.querySelectorAll('[name=name]').forEach(i => (i.value = savedName));
$('#createForm').onsubmit = act(async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  store.set('accord:name', f.name);
  connect(await post('create', f));
});
$('#joinForm').onsubmit = async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  store.set('accord:name', f.name);
  try { connect(await post('join', { name: f.name, code: f.code.toUpperCase() })); }
  catch (err) { $('#homeError').textContent = err.message; }
};

function connect({ code, token }) {
  session = { code, token };
  store.set('accord:' + code, session);
  history.replaceState(null, '', '?room=' + code);
  es?.close();
  let got = false;
  es = new EventSource(`/api/stream?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
  es.onmessage = e => { got = true; onView(JSON.parse(e.data)); };
  es.onerror = () => {
    if (!got) { // room is gone (server restarted) or token unknown
      es.close(); session = null; show('home');
      $('#joinForm [name=code]').value = code;
      $('#homeError').textContent = 'That room no longer exists, or your seat expired. Join again.';
    }
  };
}

const room = new URLSearchParams(location.search).get('room')?.toUpperCase();
if (room && store.get('accord:' + room)) connect(store.get('accord:' + room));
else { show('home'); if (room) $('#joinForm [name=code]').value = room; }

// ---------- Lobby ----------
$('#copyLink').onclick = () => navigator.clipboard?.writeText(`${location.origin}/?room=${V.code}`).then(() => toast('Invite link copied'));
$('#startBtn').onclick = act(() => post('start'));

function renderLobby() {
  $('#lobbyCode').textContent = V.code;
  const timer = V.deadline ? `${V.deadline >= 3600 ? V.deadline / 3600 + 'h' : V.deadline / 60 + ' min'} turns` : 'no turn timer';
  $('#lobbyInfo').textContent = `Pick a seat. Every empty seat will be played by a ${LEVEL_NAMES[V.level]} bot · ${timer}. Share the code or link with friends.`;
  $('#seatGrid').innerHTML = PW.map(p => {
    const seat = V.seats[p], mine = V.you.power === p;
    const who = mine ? 'You · click to leave' : seat ? esc(seat.name) : `${LEVEL_NAMES[V.level]} bot · click to take`;
    return `<button class="seat ${mine ? 'mine' : ''} ${seat && !mine ? 'taken' : ''}" style="--c:${POWERS[p].color}" data-seat="${p}" ${seat && !mine ? 'disabled' : ''}>
      <b>${POWERS[p].name}</b><span class="who">${who}</span></button>`;
  }).join('');
  $('#spectators').textContent = V.spectators.length ? `Watching: ${V.spectators.join(', ')}` : '';
  $('#startBtn').hidden = !V.you.host;
}
$('#seatGrid').onclick = act(async e => {
  const b = e.target.closest('[data-seat]');
  if (b) await post('seat', { power: V.you.power === b.dataset.seat ? null : b.dataset.seat });
});

// ---------- Game state ----------
function onView(v) {
  V = v;
  if (!v.started) { show('lobby'); renderLobby(); return; }
  show('game');
  const s = v.state, key = `${s.year}${s.season}${s.phase}${s.over}`;
  if (key !== phaseKey) { phaseKey = key; draft = v.myOrders.slice(); sel = null; }
  render();
}
const me = () => V.you.power;
const canAct = () => !!me() && !V.state.over && needsOrders(V.state).includes(me());
const isReady = () => V.ready.includes(me());

function render() { renderTop(); renderMap(); renderSide(); }

function renderTop() {
  const s = V.state;
  $('#phase').textContent = s.over ? `Game over · ${POWERS[s.winner].name} wins` : V.phase;
  const need = new Set(needsOrders(s));
  $('#standings').innerHTML = PW.slice().sort((a, b) => scCount(s, b) - scCount(s, a)).map(p => {
    const seat = V.seats[p], out = !s.units.some(u => u.power === p) && !scCount(s, p);
    const st = !seat || !need.has(p) ? '' : V.ready.includes(p) ? 'done' : 'waiting';
    const take = !seat && !me() && !out;
    return `<button class="pchip ${p === me() ? 'me' : ''} ${out ? 'out' : ''} ${st}" style="--c:${POWERS[p].color}" ${take ? `data-take="${p}" title="Take over this power"` : 'tabindex="-1"'}>
      <span class="dot"></span>${POWERS[p].name} <b>${scCount(s, p)}</b><span class="tag">${seat ? esc(seat.name) : 'bot'}</span></button>`;
  }).join('');
  const b = $('#banner');
  b.hidden = !s.over;
  if (s.over) b.innerHTML = `<h2 style="color:${POWERS[s.winner].color}">${POWERS[s.winner].name} wins</h2>
    <p class="muted">${scCount(s, s.winner) >= WIN ? `Control of ${scCount(s, s.winner)} supply centres.` : 'Most supply centres when time ran out.'}</p>
    <button class="primary" onclick="location.href='/'">New game</button>`;
}
$('#standings').onclick = act(async e => {
  const b = e.target.closest('[data-take]');
  if (b && confirm(`Take over ${POWERS[b.dataset.take].name} from the bot?`)) await post('seat', { power: b.dataset.take });
});

setInterval(() => {
  const t = $('#timer');
  if (!V?.started || V.state.over) { t.textContent = ''; return; }
  if (!V.deadlineAt) { t.textContent = V.waiting.length ? `waiting on ${V.waiting.length}` : ''; t.classList.remove('urgent'); return; }
  const left = Math.max(0, Math.round((V.deadlineAt - Date.now()) / 1000));
  const h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), sec = left % 60;
  t.textContent = (h ? `${h}:${String(m).padStart(2, '0')}` : m) + ':' + String(sec).padStart(2, '0');
  t.classList.toggle('urgent', left < 30);
}, 500);

// ---------- Map ----------
function targets() {
  const out = new Set(), s = V.state, p = me();
  if (!canAct() || isReady()) return out;
  if (s.phase === 'M' && sel) {
    const ok = o => validate(s, p, o);
    if (sel.mode === 'M') IDS.forEach(t => ok({ unit: sel.unit, type: 'M', to: t }) && out.add(t));
    if (sel.mode === 'S' && !sel.from) IDS.forEach(f => f !== sel.unit && unitAt(s, f) && IDS.some(t => ok({ unit: sel.unit, type: 'S', from: f, to: t })) && out.add(f));
    if (sel.mode === 'S' && sel.from) IDS.forEach(t => ok({ unit: sel.unit, type: 'S', from: sel.from, to: t }) && out.add(t));
    if (sel.mode === 'C' && !sel.from) IDS.forEach(f => IDS.some(t => ok({ unit: sel.unit, type: 'C', from: f, to: t })) && out.add(f));
    if (sel.mode === 'C' && sel.from) IDS.forEach(t => ok({ unit: sel.unit, type: 'C', from: sel.from, to: t }) && out.add(t));
  }
  if (s.phase === 'R' && sel) s.dislodged.find(d => d.prov === sel.unit && d.power === p)?.options.forEach(o => out.add(o));
  if (s.phase === 'A' && (adjustments(s)[p] || 0) > 0)
    IDS.filter(i => PROVS[i].home === p && s.owners[i] === p && !unitAt(s, i)).forEach(i => out.add(i));
  return out;
}

const COLORS = { ...Object.fromEntries(PW.map(p => [p, POWERS[p].color])), fail: '#ff6b6b' };
function line(o, color, fail, s) {
  const a = PROVS[o.unit], cls = fail ? ' fail' : '';
  const end = (b, cut) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; return [b.x - dx / d * cut, b.y - dy / d * cut]; };
  const mk = `url(#arrow-${fail ? 'fail' : color})`;
  if (o.type === 'H') return `<circle class="order-ring${cls}" cx="${a.x}" cy="${a.y}" r="17" stroke="${COLORS[color]}"/>`;
  if (o.type === 'M' || o.type === 'R') {
    const [x, y] = end(PROVS[o.to], 15);
    const mx = (a.x + x) / 2 - (y - a.y) * 0.12, my = (a.y + y) / 2 + (x - a.x) * 0.12;
    return `<path class="order-line${cls}" d="M${a.x},${a.y} Q${mx},${my} ${x},${y}" stroke="${COLORS[color]}" marker-end="${mk}"/>`;
  }
  if (o.type === 'S') {
    const f = PROVS[o.from], t = PROVS[o.to];
    if (o.from === o.to) { const [x, y] = end(f, 17); return `<path class="order-line support${cls}" d="M${a.x},${a.y} L${x},${y}" stroke="${COLORS[color]}"/><circle class="order-ring${cls}" cx="${f.x}" cy="${f.y}" r="17" stroke="${COLORS[color]}" stroke-dasharray="2 5"/>`; }
    const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
    return `<path class="order-line support${cls}" d="M${a.x},${a.y} L${mx},${my}" stroke="${COLORS[color]}" marker-end="${mk}"/>`;
  }
  if (o.type === 'C') { const f = PROVS[o.from], t = PROVS[o.to]; return `<path class="order-line convoy${cls}" d="M${f.x},${f.y} L${a.x},${a.y} L${t.x},${t.y}" stroke="${COLORS[color]}"/>`; }
  return '';
}
function unitSvg(u, x, y, extra = '') {
  const c = POWERS[u.power].color;
  const body = u.type === 'A' ? `<circle class="body" r="11" fill="${c}"/>` : `<rect class="body" x="-9.5" y="-9.5" width="19" height="19" rx="4" fill="${c}" transform="rotate(45)"/>`;
  return `<g class="unit ${extra}" transform="translate(${x},${y})">${body}<text>${u.type}</text></g>`;
}

function renderMap() {
  const s = V.state, T = targets(), p = me();
  let h = '<defs>' + Object.entries(COLORS).map(([k, c]) => `<marker id="arrow-${k}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('') + '</defs>';
  for (const id of IDS) {
    const pr = PROVS[id], owner = pr.sc && s.owners[id];
    const fill = owner ? ` style="fill:color-mix(in srgb, ${POWERS[owner].color} 42%, var(--land))"` : '';
    const own = unitAt(s, id)?.power === p || s.dislodged?.some(d => d.prov === id && d.power === p);
    h += `<polygon class="prov ${pr.land ? 'land' : 'sea'} ${T.has(id) ? 'target' : ''} ${own && canAct() ? 'clickable' : ''}" data-id="${id}" points="${CELLS[id].map(q => q.join(',')).join(' ')}"${fill}/>`;
  }
  for (const id of IDS) {
    const pr = PROVS[id];
    h += `<text class="plabel ${pr.land ? '' : 'sea'}" x="${pr.x}" y="${pr.y + 26}">${esc(pr.name)}</text>`;
    if (pr.sc) h += `<circle class="sc" cx="${pr.x}" cy="${pr.y - 20}" r="4.5" fill="${s.owners[id] ? POWERS[s.owners[id]].color : '#5b6578'}"/>`;
  }
  if (showLast && s.lastResults) for (const r of s.lastResults) if (r.type !== 'H') h += line(r, r.power, !r.ok, s);
  if (p && !showLast) for (const o of draft) if (o.unit && (s.phase === 'M' || o.type === 'R')) h += line(o, p, false, s);
  for (const u of s.units) {
    const x = draft.find(o => o.type === 'X' && o.prov === u.prov && u.power === p);
    h += unitSvg(u, PROVS[u.prov].x, PROVS[u.prov].y, `${sel?.unit === u.prov && s.phase === 'M' ? 'sel' : ''} ${x ? 'dislodged' : ''}`);
    if (x) h += `<path d="M${PROVS[u.prov].x - 8},${PROVS[u.prov].y - 8} l16,16 m0,-16 l-16,16" stroke="#ff6b6b" stroke-width="3" stroke-linecap="round"/>`;
  }
  for (const d of s.dislodged || []) {
    const x = PROVS[d.prov].x + 16, y = PROVS[d.prov].y + 12;
    h += `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-dasharray="3 3"/>` + unitSvg(d, x, y, `dislodged ${sel?.unit === d.prov ? 'sel' : ''}`);
  }
  for (const o of draft) if (o.type === 'B') h += unitSvg({ power: p, type: o.unitType }, PROVS[o.prov].x, PROVS[o.prov].y, 'dislodged');
  $('#map').innerHTML = h;
}

$('#map').addEventListener('mouseover', e => {
  const id = e.target.closest?.('[data-id]')?.dataset.id;
  if (!id || !V?.state) { $('#hoverInfo').textContent = ''; return; }
  const pr = PROVS[id], s = V.state, u = unitAt(s, id), o = s.owners[id];
  $('#hoverInfo').textContent = [pr.name, pr.sc ? `supply centre${o ? ' · ' + POWERS[o].name : ' · neutral'}` : pr.land ? '' : 'sea',
    u ? `${u.type === 'A' ? 'army' : 'fleet'} of ${POWERS[u.power].name}` : ''].filter(Boolean).join(' · ');
});
$('#map').addEventListener('mouseleave', () => ($('#hoverInfo').textContent = ''));
$('#map').addEventListener('click', e => { const id = e.target.closest?.('[data-id]')?.dataset.id; if (id) onProv(id); });
$('#lastTurnBtn').onclick = () => { showLast = !showLast; $('#lastTurnBtn').setAttribute('aria-pressed', showLast); renderMap(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sel) { sel = null; render(); } });

// ---------- Order entry ----------
function setOrder(o) {
  draft = draft.filter(x => (x.unit ?? x.prov) !== (o.unit ?? o.prov));
  draft.push(o);
  sel = null;
  sync(false);
}
function removeOrder(key) { draft = draft.filter(x => (x.unit ?? x.prov) !== key); sync(false); }
const sync = act(async ready => {
  render();
  const r = await post('orders', { orders: draft, ready });
  if (!V.state.over && V.state.phase && r.orders) draft = r.orders;
  if (ready) toast('Orders submitted');
});

function onProv(id) {
  if (!canAct() || isReady()) return;
  const s = V.state, p = me(), u = unitAt(s, id), T = targets();
  if (s.phase === 'M') {
    if (!sel) { if (u?.power === p) sel = { unit: id, mode: 'M' }; return render(); }
    if (sel.mode === 'M') {
      if (id === sel.unit) return setOrder({ unit: id, type: 'H' });
      if (T.has(id)) return setOrder({ unit: sel.unit, type: 'M', to: id });
      sel = u?.power === p ? { unit: id, mode: 'M' } : null; return render();
    }
    if (!sel.from) { if (T.has(id)) sel.from = id; else sel = null; return render(); }
    if (!T.has(id)) { toast('Not a valid destination'); return; }
    if (sel.mode === 'S') return setOrder({ unit: sel.unit, type: 'S', from: sel.from, to: id });
    const army = unitAt(s, sel.from), c = { unit: sel.unit, type: 'C', from: sel.from, to: id };
    if (army.power === p) { draft = draft.filter(x => x.unit !== sel.from); draft.push({ unit: sel.from, type: 'M', to: id }); }
    return setOrder(c);
  }
  if (s.phase === 'R') {
    if (s.dislodged.some(d => d.prov === id && d.power === p) && sel?.unit !== id) { sel = { unit: id }; return render(); }
    if (sel && T.has(id)) return setOrder({ unit: sel.unit, type: 'R', to: id });
    sel = null; return render();
  }
  const n = adjustments(s)[p] || 0;
  if (n > 0 && T.has(id)) { // cycle: army → fleet → nothing
    const cur = draft.find(o => o.prov === id);
    if (!cur) { if (draft.length >= n) return toast(`You can only build ${n}`); return setOrder({ type: 'B', prov: id, unitType: 'A' }); }
    if (cur.unitType === 'A' && PROVS[id].coast) return setOrder({ type: 'B', prov: id, unitType: 'F' });
    return removeOrder(id);
  }
  if (n < 0 && u?.power === p) {
    if (draft.some(o => o.prov === id)) return removeOrder(id);
    if (draft.length >= -n) return toast(`Disband ${-n} unit${n < -1 ? 's' : ''}`);
    return setOrder({ type: 'X', prov: id });
  }
}

// ---------- Sidebar ----------
document.querySelector('.tabs').onclick = e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  tab = b.dataset.tab;
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('active', x === b));
  for (const t of ['orders', 'diplo', 'log']) $('#tab-' + t).hidden = t !== tab;
  renderSide();
};
function renderSide() { renderOrders(); renderDiplo(); renderLog(); }

function hint() {
  const s = V.state;
  if (s.phase === 'M') {
    if (!sel) return 'Click one of your units to give it an order.';
    const u = unitAt(s, sel.unit);
    if (sel.mode === 'M') return `${u.type === 'A' ? 'Army' : 'Fleet'} in ${PROVS[sel.unit].name}: click a highlighted province to move, or the unit again to hold.`;
    if (sel.mode === 'S') return sel.from ? `Supporting ${PROVS[sel.from].name}: click where it is going (or the unit itself to support it holding).` : 'Click the unit you want to support.';
    return sel.from ? 'Click the coastal destination of the convoy.' : 'Click the army to convoy.';
  }
  if (s.phase === 'R') return sel ? 'Click a highlighted province to retreat into. Units without orders are disbanded.' : 'Your dislodged units are circled in red. Click one to retreat it.';
  const n = adjustments(s)[me()] || 0;
  return n > 0 ? `You may build ${n} unit${n > 1 ? 's' : ''}. Click a highlighted home centre: once for an army, twice for a fleet.` : `You must disband ${-n} unit${n < -1 ? 's' : ''}. Click units to mark them.`;
}

function renderOrders() {
  const el = $('#tab-orders'), s = V.state, p = me();
  if (s.over) { el.innerHTML = `<div class="hint">The game is over. ${POWERS[s.winner].name} wins.</div>`; return; }
  if (!p) { el.innerHTML = `<div class="hint">You're watching. Click a power marked “bot” in the top bar to take it over.</div>`; return; }
  if (!canAct()) { el.innerHTML = `<div class="hint">Nothing for ${POWERS[p].name} to do this phase. Waiting for ${V.waiting.length ? V.waiting.map(w => POWERS[w].name).join(', ') : 'the bots'}.</div>` + leaveBtn(); bindLeave(); return; }
  let h = `<div class="section-title">${POWERS[p].name} · ${V.phase}</div>`;
  h += isReady() ? `<div class="hint ready-note">Orders submitted. Waiting for ${V.waiting.length ? V.waiting.map(w => POWERS[w].name).join(', ') : 'the bots'}…</div>` : `<div class="hint">${hint()}</div>`;
  if (s.phase === 'M' && sel && !isReady()) {
    const u = unitAt(s, sel.unit), convoyable = u.type === 'F' && !PROVS[u.prov].land;
    h += `<div class="modes">${[['M', 'Move'], ['S', 'Support'], ...(convoyable ? [['C', 'Convoy']] : [])].map(([m, l]) => `<button data-mode="${m}" class="${sel.mode === m ? 'on' : ''}">${l}</button>`).join('')}
      <button data-hold>Hold</button><button data-cancel class="ghost">Cancel</button></div>`;
  }
  h += '<div class="section-title">Orders</div><ul class="olist">';
  if (s.phase === 'M') for (const u of s.units.filter(u => u.power === p)) {
    const o = draft.find(x => x.unit === u.prov);
    h += o ? `<li>${esc(orderText(s, o))}${isReady() ? '' : `<button data-rm="${u.prov}" aria-label="Remove order">×</button>`}</li>` : `<li class="missing">${u.type} ${u.prov} holds (no order)</li>`;
  }
  if (s.phase === 'R') for (const d of s.dislodged.filter(d => d.power === p)) {
    const o = draft.find(x => x.unit === d.prov);
    h += o ? `<li>${d.type} ${d.prov} retreats → ${o.to}${isReady() ? '' : `<button data-rm="${d.prov}">×</button>`}</li>` : `<li class="missing">${d.type} ${d.prov} disbands (no order)</li>`;
  }
  if (s.phase === 'A') {
    for (const o of draft) h += `<li>${o.type === 'B' ? `Build ${o.unitType === 'A' ? 'army' : 'fleet'} in ${PROVS[o.prov].name}` : `Disband unit in ${PROVS[o.prov].name}`}${isReady() ? '' : `<button data-rm="${o.prov}">×</button>`}</li>`;
    if (!draft.length) h += `<li class="missing">${(adjustments(s)[p] || 0) > 0 ? 'No builds yet' : 'Units furthest from home will be disbanded'}</li>`;
  }
  h += '</ul>';
  h += `<div class="submit-row">${isReady() ? '<button data-unready>Edit orders</button>' : '<button class="primary" data-ready>Submit orders</button>'}</div>` + leaveBtn();
  el.innerHTML = h;
  el.querySelectorAll('[data-mode]').forEach(b => (b.onclick = () => { sel = { unit: sel.unit, mode: b.dataset.mode }; render(); }));
  el.querySelector('[data-hold]')?.addEventListener('click', () => setOrder({ unit: sel.unit, type: 'H' }));
  el.querySelector('[data-cancel]')?.addEventListener('click', () => { sel = null; render(); });
  el.querySelectorAll('[data-rm]').forEach(b => (b.onclick = () => removeOrder(b.dataset.rm)));
  el.querySelector('[data-ready]')?.addEventListener('click', () => { sel = null; sync(true); });
  el.querySelector('[data-unready]')?.addEventListener('click', () => sync(false));
  bindLeave();
}
const leaveBtn = () => `<p style="margin-top:18px"><button class="ghost" data-leave>Leave seat (a bot takes over)</button></p>`;
const bindLeave = () => $('#tab-orders [data-leave]')?.addEventListener('click', act(async () => { if (confirm('Hand your power to a bot?')) await post('seat', { power: null }); }));

// Diplomacy
const inChannel = (m, c) => c === 'all' ? m.to === 'all' : (m.from === c && m.to === me()) || (m.from === me() && m.to === c);
function renderDiplo() {
  const s = V.state, p = me();
  const chans = ['all', ...(p ? PW.filter(x => x !== p && (s.units.some(u => u.power === x) || scCount(s, x))) : [])];
  if (!chans.includes(channel)) channel = 'all';
  if (tab === 'diplo') seen[channel] = V.chat.filter(m => inChannel(m, channel)).length;
  const unread = c => V.chat.filter(m => inChannel(m, c)).length > (seen[c] || 0);
  $('#channels').innerHTML = chans.map(c => `<button data-ch="${c}" class="${c === channel ? 'on' : ''}" ${c === 'all' ? '' : `style="--c:${POWERS[c].color}"`}>
    ${c === 'all' ? 'Everyone' : `<span class="dot"></span>${POWERS[c].name}${V.seats[c] ? '' : ' 🤖'}`}${unread(c) && c !== channel ? '<span class="unread"></span>' : ''}</button>`).join('');
  const total = chans.filter(c => unread(c)).length;
  $('#unread').hidden = !total || tab === 'diplo';
  $('#unread').textContent = total;
  const msgs = V.chat.filter(m => inChannel(m, channel));
  const box = $('#messages'), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = msgs.length ? msgs.map(m => {
    const who = m.from ? POWERS[m.from].name + (V.seats[m.from] && m.name ? ` · ${esc(m.name)}` : '') : `${esc(m.name)} (watching)`;
    return `<div class="msg ${m.from && m.from === p ? 'mine' : ''} ${m.proposal ? 'proposal' : ''}" style="--c:${m.from ? POWERS[m.from].color : ''}">
      <div class="from">${who}${m.verdict ? `<span class="verdict ${m.verdict}">${m.verdict}</span>` : ''}</div>${esc(m.text)}</div>`;
  }).join('') : `<p class="muted">${channel === 'all' ? 'Public channel. Everyone at the table can read this.' : V.seats[channel] ? `Private channel with ${POWERS[channel].name}.` : `${POWERS[channel].name} is a bot. Send it a proposal below — it will answer, and remember.`}</p>`;
  if (atBottom) box.scrollTop = box.scrollHeight;
  const key = `${channel}|${phaseKey}|${p}`;
  if (key !== composerKey) { composerKey = key; renderComposer(); }
}
$('#channels').onclick = e => { const b = e.target.closest('[data-ch]'); if (b) { channel = b.dataset.ch; renderDiplo(); } };

function renderComposer() {
  const el = $('#composer'), s = V.state, p = me();
  const bot = channel !== 'all' && !V.seats[channel];
  if (!bot) {
    el.innerHTML = `<form><input name="text" maxlength="400" placeholder="Message ${channel === 'all' ? 'everyone' : POWERS[channel].name}…" autocomplete="off"><button class="primary">Send</button></form>`;
    el.querySelector('form').onsubmit = act(async e => {
      e.preventDefault();
      const i = e.target.text; if (!i.value.trim()) return;
      await post('chat', { to: channel, text: i.value }); i.value = '';
    });
    return;
  }
  if (!p || s.over) { el.innerHTML = ''; return; }
  const mine = s.units.filter(u => u.power === p);
  const others = PW.filter(x => x !== p && x !== channel && s.units.some(u => u.power === x));
  el.innerHTML = `
    <div class="prow"><button data-prop="peace" style="flex:1">Propose peace (until end of next year)</button></div>
    <div class="prow"><select id="allyVs" aria-label="Alliance target">${others.map(x => `<option value="${x}">${POWERS[x].name}</option>`).join('')}</select><button data-prop="ally">Ally against</button></div>
    ${s.phase === 'M' && mine.length ? `<div class="prow"><select id="supUnit" aria-label="Your unit">${mine.map(u => `<option value="${u.prov}">${u.type} ${PROVS[u.prov].name}</option>`).join('')}</select>
      <select id="supTo" aria-label="Destination"></select><button data-prop="support">Ask support</button></div>` : ''}`;
  const fillTo = () => {
    const u = unitAt(s, $('#supUnit').value);
    $('#supTo').innerHTML = `<option value="${u.prov}">holds</option>` + (u.type === 'A' ? ARMY_ADJ : FLEET_ADJ)[u.prov].map(t => `<option value="${t}">→ ${PROVS[t].name}</option>`).join('');
  };
  if ($('#supUnit')) { fillTo(); $('#supUnit').onchange = fillTo; }
  el.querySelectorAll('[data-prop]').forEach(b => (b.onclick = act(async () => {
    const type = b.dataset.prop;
    await post('propose', { to: channel, type, vs: $('#allyVs')?.value, unit: $('#supUnit')?.value, target: $('#supTo')?.value });
  })));
}

function renderLog() {
  $('#tab-log').innerHTML = V.log.slice().reverse().map(e => `<div class="log-phase"><h4>${esc(e.phase)}</h4>${(e.results || [])
    .filter(r => !r.text.endsWith('holds') || r.dislodged)
    .map(r => `<div class="log-line ${r.ok ? '' : 'fail'}" style="--c:${POWERS[r.power].color}">${esc(r.text)}${r.dislodged ? ' <span class="x">dislodged</span>' : ''}</div>`).join('')}</div>`).join('') || '<p class="muted">Nothing yet.</p>';
}
