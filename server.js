// Accord game server: static files + JSON API + Server-Sent Events. No dependencies.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POWERS, PROVS } from './shared/map.js';
import { initialState, step, needsOrders, validate, adjustments, SEASON, orderText } from './shared/engine.js';
import { botOrders, newRelations, afterPhase, considerProposal, LEVELS } from './ai.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DEADLINES = [0, 60, 120, 300, 600, 1800, 3600, 86400];
// shortcut: rooms live in memory and vanish on restart; persist to disk/DB if games must survive deploys.
const rooms = new Map();

const code = () => { let c; do c = randomBytes(4).toString('base64').replace(/[^A-Z]/gi, '').slice(0, 5).toUpperCase(); while (c.length < 5 || rooms.has(c)); return c; };
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const phaseName = s => `${SEASON[s.season]} Year ${s.year}${s.phase === 'R' ? ' (retreats)' : s.phase === 'A' ? ' (builds)' : ''}`;

function view(room, token) {
  const me = room.players.get(token);
  const power = me?.power;
  const s = room.state;
  return {
    code: room.code, level: room.level, deadline: room.deadline, deadlineAt: room.deadlineAt, started: !!s,
    you: { name: me?.name, power, host: room.host === token },
    seats: Object.fromEntries(Object.keys(POWERS).map(p => [p, room.seats[p] ? { name: room.players.get(room.seats[p])?.name } : null])),
    spectators: [...room.players.values()].filter(p => !p.power).map(p => p.name),
    state: s, phase: s ? phaseName(s) : null,
    myOrders: power ? room.orders[power] || [] : [],
    ready: [...room.ready],
    waiting: s ? needsOrders(s).filter(p => room.seats[p] && !room.ready.has(p)) : [],
    chat: room.chat.filter(m => m.to === 'all' || m.to === power || m.from === power),
    log: room.log.slice(-60),
  };
}

function broadcast(room) {
  for (const c of room.clients) c.res.write(`data: ${JSON.stringify(view(room, c.token))}\n\n`);
}

function schedule(room) {
  clearTimeout(room.timer);
  room.deadlineAt = null;
  const s = room.state;
  if (!s || s.over) return;
  const humans = needsOrders(s).filter(p => room.seats[p]);
  if (!humans.length) { room.timer = setTimeout(() => resolve(room), 1500); return; } // bots only: pace it so people can watch
  if (room.deadline) {
    const secs = s.phase === 'M' ? room.deadline : Math.min(room.deadline, 120);
    room.deadlineAt = Date.now() + secs * 1000;
    room.timer = setTimeout(() => resolve(room), secs * 1000);
  }
}

function resolve(room) {
  const s = room.state;
  if (!s || s.over) return;
  const need = needsOrders(s), orders = {}, humanOrders = {};
  for (const p of need) if (room.seats[p]) orders[p] = humanOrders[p] = room.orders[p] || [];
  const bots = Object.fromEntries(Object.keys(POWERS).filter(p => !room.seats[p]).map(p => [p, room.level]));
  for (const p of need) if (!room.seats[p]) {
    orders[p] = botOrders(s, p, room.level, room.rels[p], {
      relOf: q => (room.seats[q] ? undefined : room.rels[q]),
      known: humanOrders, // only used by levels with `peek` (Brutal)
    });
  }
  let next;
  try { next = step(s, orders); } catch (e) { console.error('adjudication failed', e); return; }
  const humans = Object.keys(POWERS).filter(p => room.seats[p]);
  for (const m of afterPhase(s, next, bots, room.rels, humans)) room.chat.push({ from: m.from, to: m.to, text: m.text, t: Date.now() });
  room.log.push({ phase: phaseName(s), results: s.phase === 'M' ? next.lastResults.map(r => ({ power: r.power, text: orderText(s, r), ok: r.ok, dislodged: !!r.dislodged })) : null });
  if (next.over) room.log.push({ phase: `Game over: ${POWERS[next.winner].name} wins` });
  room.state = next; room.orders = {}; room.ready = new Set();
  schedule(room);
  broadcast(room);
}

// Stored orders are re-validated by the engine at resolution; this just keeps junk out early.
function sanitizeOrders(room, power, list) {
  const s = room.state;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const o of list.slice(0, 40)) {
    if (!o || typeof o !== 'object') continue;
    const x = { type: clean(o.type, 1), unit: clean(o.unit, 3), to: clean(o.to, 3), from: clean(o.from, 3), prov: clean(o.prov, 3), unitType: clean(o.unitType, 1) };
    if (s.phase === 'M') { const v = validate(s, power, x); if (v) out.push(v); }
    else if (s.phase === 'R' && x.type === 'R' && s.dislodged.some(d => d.power === power && d.prov === x.unit && d.options.includes(x.to))) out.push({ unit: x.unit, type: 'R', to: x.to });
    else if (s.phase === 'A' && (x.type === 'B' || x.type === 'X') && PROVS[x.prov]) out.push({ type: x.type, prov: x.prov, unitType: x.unitType });
  }
  return out;
}

const api = {
  create(b) {
    const level = LEVELS[b.level] ? b.level : 'hard';
    const deadline = DEADLINES.includes(Number(b.deadline)) ? Number(b.deadline) : 0;
    const maxYear = Math.min(50, Math.max(5, Number(b.maxYear) || 20));
    const token = randomUUID(), room = {
      code: code(), host: token, level, deadline, maxYear, seats: {}, players: new Map(), state: null,
      orders: {}, ready: new Set(), rels: Object.fromEntries(Object.keys(POWERS).map(p => [p, newRelations()])),
      chat: [], log: [], clients: new Set(), touched: Date.now(),
    };
    room.players.set(token, { name: clean(b.name, 20) || 'Host', power: null });
    rooms.set(room.code, room);
    return { code: room.code, token };
  },
  join(b) {
    const room = rooms.get(clean(b.code, 5).toUpperCase());
    if (!room) throw new Error('No room with that code.');
    if (room.players.size >= 40) throw new Error('Room is full.');
    const token = randomUUID();
    room.players.set(token, { name: clean(b.name, 20) || 'Player', power: null });
    broadcast(room);
    return { code: room.code, token };
  },
  seat(b, room, token, me) {
    const p = b.power === null ? null : clean(b.power, 3);
    if (p && !POWERS[p]) throw new Error('Unknown power.');
    if (p && room.seats[p]) throw new Error('Seat taken.');
    if (p && room.state && !room.state.units.some(u => u.power === p)) throw new Error('That power has been eliminated.');
    if (me.power) { delete room.seats[me.power]; room.ready.delete(me.power); delete room.orders[me.power]; }
    me.power = p;
    if (p) { room.seats[p] = token; room.rels[p] = newRelations(); }
    room.log.push({ phase: p ? `${me.name} took ${POWERS[p].name}` : `${me.name} left their seat (a bot takes over)` });
    if (room.state) schedule(room);
    broadcast(room);
    if (room.state && !needsOrders(room.state).some(q => room.seats[q] && !room.ready.has(q))) resolve(room);
    return {};
  },
  start(b, room, token) {
    if (room.host !== token) throw new Error('Only the host can start.');
    if (room.state) throw new Error('Already started.');
    room.state = initialState(room.maxYear);
    room.log.push({ phase: `Game started on ${LEVELS[room.level].label}. Empty seats are bots.` });
    schedule(room);
    broadcast(room);
    return {};
  },
  orders(b, room, token, me) {
    if (!room.state || room.state.over || !me.power) throw new Error('Nothing to order.');
    if (!needsOrders(room.state).includes(me.power)) throw new Error('You have nothing to do this phase.');
    room.orders[me.power] = sanitizeOrders(room, me.power, b.orders);
    if (b.ready) room.ready.add(me.power); else room.ready.delete(me.power);
    if (!needsOrders(room.state).some(p => room.seats[p] && !room.ready.has(p))) resolve(room);
    else broadcast(room);
    return { orders: room.orders[me.power] };
  },
  chat(b, room, token, me) {
    const to = b.to === 'all' ? 'all' : clean(b.to, 3), text = clean(b.text, 400);
    if (!text || (to !== 'all' && !POWERS[to])) throw new Error('Bad message.');
    if (to !== 'all' && !room.seats[to]) throw new Error('Bots only respond to proposals.');
    room.chat.push({ from: me.power || null, name: me.name, to, text, t: Date.now() });
    if (room.chat.length > 500) room.chat.splice(0, 100);
    broadcast(room);
    return {};
  },
  propose(b, room, token, me) {
    const to = clean(b.to, 3);
    if (!room.state || room.state.over || !me.power) throw new Error('Not in a game.');
    if (!POWERS[to] || room.seats[to] || to === me.power) throw new Error('Proposals go to bot powers.');
    const prop = { type: clean(b.type, 8), vs: clean(b.vs, 3), unit: clean(b.unit, 3), to: clean(b.target, 3) || undefined };
    const desc = prop.type === 'peace' ? 'proposes peace until the end of next year'
      : prop.type === 'ally' ? `proposes an alliance against ${POWERS[prop.vs]?.name || '?'}`
      : `asks for support: ${prop.unit} ${prop.to && prop.to !== prop.unit ? '→ ' + prop.to : 'holds'}`;
    room.chat.push({ from: me.power, name: me.name, to, text: desc, t: Date.now(), proposal: true });
    const r = considerProposal(room.state, to, me.power, prop, room.level, room.rels[to]);
    room.chat.push({ from: to, to: me.power, text: r.text, t: Date.now(), verdict: r.accept ? 'accepted' : 'declined' });
    broadcast(room);
    return r;
  },
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
async function serveStatic(req, res, url) {
  const rel = url.pathname === '/' ? 'public/index.html' : url.pathname.startsWith('/shared/') ? url.pathname.slice(1) : 'public' + url.pathname;
  const file = path.resolve(ROOT, rel);
  const base = path.resolve(ROOT, rel.startsWith('shared/') ? 'shared' : 'public');
  if (!file.startsWith(base + path.sep)) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
  } catch { res.writeHead(404).end('Not found'); }
}

function readBody(req) {
  return new Promise((ok, fail) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 32768) { fail(new Error('Too large')); req.destroy(); } });
    req.on('end', () => { try { ok(data ? JSON.parse(data) : {}); } catch { fail(new Error('Bad JSON')); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/api/stream') {
    const token = url.searchParams.get('token'), room = rooms.get(url.searchParams.get('code') || '');
    if (!room || !room.players.has(token)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const client = { res, token };
    room.clients.add(client);
    res.write(`data: ${JSON.stringify(view(room, token))}\n\n`);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(ping); room.clients.delete(client); });
    return;
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5);
    res.setHeader('Content-Type', 'application/json');
    try {
      if (!Object.hasOwn(api, name)) throw new Error('Unknown endpoint.');
      const b = await readBody(req);
      let out;
      if (name === 'create' || name === 'join') out = api[name](b);
      else {
        const room = rooms.get(clean(b.code, 5)), me = room?.players.get(b.token);
        if (!me) throw new Error('Not in this room.');
        room.touched = Date.now();
        out = api[name](b, room, b.token, me);
      }
      res.end(JSON.stringify(out));
    } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
    return;
  }
  if (req.method === 'GET') return serveStatic(req, res, url);
  res.writeHead(405).end();
});

// Drop rooms nobody has touched for two days.
setInterval(() => { for (const [c, r] of rooms) if (!r.clients.size && Date.now() - r.touched > 172800000) { clearTimeout(r.timer); rooms.delete(c); } }, 3600000).unref();

// Render's free tier sleeps after 15 idle minutes, wiping in-memory games. While any game is unfinished,
// ping our own public URL (Render sets RENDER_EXTERNAL_URL) so it counts as a visitor; with no games it may sleep.
const SELF = process.env.RENDER_EXTERNAL_URL;
if (SELF) setInterval(() => { if ([...rooms.values()].some(r => !r.state?.over)) fetch(SELF).catch(() => {}); }, 10 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`Accord running at http://localhost:${PORT}`));
