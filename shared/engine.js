// Rules engine: order validation and simultaneous adjudication (Kruijswijk's guess-and-verify
// algorithm, with circular movement succeeding and convoy paradoxes resolved by Szykman's rule).
import { PROVS, IDS, POWERS, ARMY_ADJ, FLEET_ADJ, canMove, WIN } from './map.js';

export const SEASON = { S: 'Spring', F: 'Fall', W: 'Winter' };

export function initialState(maxYear = 20) {
  const units = [], owners = {};
  for (const id of IDS) {
    const p = PROVS[id];
    if (p.home) { owners[id] = p.home; units.push({ power: p.home, type: p.unit, prov: id }); }
  }
  return { year: 1, season: 'S', phase: 'M', units, owners, dislodged: [], maxYear, over: false, winner: null };
}

export const unitAt = (s, prov) => s.units.find(u => u.prov === prov);
export const scCount = (s, power) => Object.values(s.owners).filter(o => o === power).length;
export const alive = (s, power) => scCount(s, power) > 0 || s.units.some(u => u.power === power);

// Can an army be convoyed from a to b through some chain of sea provinces?
const convoyCache = {};
export function convoyable(a, b) {
  const k = a + b;
  if (k in convoyCache) return convoyCache[k];
  let ok = false;
  if (a !== b && PROVS[a].coast && PROVS[b].coast) {
    const seen = new Set(), q = FLEET_ADJ[a].filter(n => !PROVS[n].land);
    q.forEach(n => seen.add(n));
    while (q.length && !ok) {
      const n = q.shift();
      if (FLEET_ADJ[n].includes(b)) ok = true;
      for (const m of FLEET_ADJ[n]) if (!PROVS[m].land && !seen.has(m)) { seen.add(m); q.push(m); }
    }
  }
  return (convoyCache[k] = ok);
}
const reachable = (type, from, to) => canMove(type, from, to) || (type === 'A' && convoyable(from, to));

// Normalise a movement-phase order; returns null when illegal. Trust boundary for human input.
export function validate(s, power, o) {
  if (!o || typeof o !== 'object') return null;
  const u = unitAt(s, o.unit);
  if (!u || u.power !== power) return null;
  if (o.type === 'H') return { unit: u.prov, type: 'H' };
  if (o.type === 'M') return o.to !== u.prov && PROVS[o.to] && reachable(u.type, u.prov, o.to) ? { unit: u.prov, type: 'M', to: o.to } : null;
  if (o.type === 'S') {
    const t = unitAt(s, o.from);
    if (!t || t === u || !PROVS[o.to]) return null;
    if (o.to === o.from) return canMove(u.type, u.prov, o.from) ? { unit: u.prov, type: 'S', from: o.from, to: o.from } : null;
    if (o.to === u.prov || !canMove(u.type, u.prov, o.to) || !reachable(t.type, t.prov, o.to)) return null;
    return { unit: u.prov, type: 'S', from: o.from, to: o.to };
  }
  if (o.type === 'C') {
    const t = unitAt(s, o.from);
    if (u.type !== 'F' || PROVS[u.prov].land || !t || t.type !== 'A' || !PROVS[o.to] || !convoyable(o.from, o.to)) return null;
    return { unit: u.prov, type: 'C', from: o.from, to: o.to };
  }
  return null;
}

export function orderText(s, o) {
  const u = unitAt(s, o.unit) || o;
  const t = u.type || o.utype || '';
  if (o.type === 'H') return `${t} ${o.unit} holds`;
  if (o.type === 'M') return `${t} ${o.unit} → ${o.to}`;
  if (o.type === 'S') return o.from === o.to ? `${t} ${o.unit} supports ${o.from}` : `${t} ${o.unit} supports ${o.from} → ${o.to}`;
  if (o.type === 'C') return `${t} ${o.unit} convoys ${o.from} → ${o.to}`;
  return '';
}

export function resolveMovement(s, ordersByPower) {
  const orders = {};
  for (const u of s.units) orders[u.prov] = { unit: u.prov, type: 'H', power: u.power, utype: u.type };
  for (const p in ordersByPower) for (const o of ordersByPower[p] || []) {
    const v = validate(s, p, o);
    if (v) orders[v.unit] = { ...v, power: p, utype: orders[v.unit].utype };
  }
  const list = Object.values(orders);
  for (const o of list) {
    if (o.type === 'S') {
      const t = orders[o.from];
      o.void = o.to === o.from ? t.type === 'M' : !(t.type === 'M' && t.to === o.to);
    } else if (o.type === 'C') {
      const t = orders[o.from];
      o.void = !(t.type === 'M' && t.to === o.to);
    } else if (o.type === 'M') o.convoy = !canMove(o.utype, o.unit, o.to);
  }
  const into = {};
  for (const o of list) if (o.type === 'M') (into[o.to] ||= []).push(o);
  const movesTo = p => into[p] || [];

  const st = {}, res = {}, dep = [];
  function resolve(n) {
    if (st[n] === 2) return res[n];
    if (st[n] === 1) { if (!dep.includes(n)) dep.push(n); return res[n]; }
    const old = dep.length;
    res[n] = false; st[n] = 1;
    const r1 = adjudicate(n);
    if (dep.length === old) { if (st[n] !== 2) { res[n] = r1; st[n] = 2; } return r1; }
    if (dep[old] !== n) { dep.push(n); res[n] = r1; return r1; }
    while (dep.length > old) st[dep.pop()] = 0;
    res[n] = true; st[n] = 1;
    const r2 = adjudicate(n);
    if (r1 === r2) { while (dep.length > old) st[dep.pop()] = 0; res[n] = r1; st[n] = 2; return r1; }
    const cyc = dep.splice(old);
    if (cyc.every(c => orders[c].type === 'M')) for (const c of cyc) { res[c] = true; st[c] = 2; }
    else if (cyc.some(c => orders[c].type === 'C')) for (const c of cyc) { if (orders[c].type === 'C') { res[c] = false; st[c] = 2; } else st[c] = 0; }
    else for (const c of cyc) { res[c] = false; st[c] = 2; }
    return resolve(n);
  }

  const h2h = o => { const d = orders[o.to]; return !o.convoy && d && d.type === 'M' && d.to === o.unit && !d.convoy ? d : null; };
  function path(o) {
    if (!o.convoy) return true;
    const fleets = list.filter(c => c.type === 'C' && !c.void && c.from === o.unit && c.to === o.to);
    const seen = new Set(), q = fleets.filter(f => FLEET_ADJ[o.unit].includes(f.unit));
    q.forEach(f => seen.add(f));
    while (q.length) {
      const f = q.shift();
      if (!resolve(f.unit)) continue;
      if (FLEET_ADJ[f.unit].includes(o.to)) return true;
      for (const g of fleets) if (!seen.has(g) && FLEET_ADJ[f.unit].includes(g.unit)) { seen.add(g); q.push(g); }
    }
    return false;
  }
  function supports(o, notPower) {
    const to = o.type === 'M' ? o.to : o.unit;
    let n = 0;
    for (const x of list) if (x.type === 'S' && !x.void && x.from === o.unit && x.to === to && x.power !== notPower && resolve(x.unit)) n++;
    return n;
  }
  function holdStrength(p) {
    const u = orders[p];
    if (!u) return 0;
    if (u.type === 'M') return resolve(p) ? 0 : 1;
    return 1 + supports(u);
  }
  function attackStrength(o) {
    if (!path(o)) return 0;
    const d = orders[o.to];
    if (!d || (d.type === 'M' && !h2h(o) && resolve(d.unit))) return 1 + supports(o);
    if (d.power === o.power) return 0;
    return 1 + supports(o, d.power);
  }
  function preventStrength(o) {
    if (!path(o)) return 0;
    const d = h2h(o);
    if (d && resolve(d.unit)) return 0;
    return 1 + supports(o);
  }
  function adjudicate(n) {
    const o = orders[n];
    if (o.type === 'M') {
      const atk = attackStrength(o), d = h2h(o);
      if (atk <= (d ? 1 + supports(d) : holdStrength(o.to))) return false;
      for (const m of movesTo(o.to)) if (m !== o && atk <= preventStrength(m)) return false;
      return true;
    }
    if (o.type === 'S') {
      for (const m of movesTo(n)) {
        if (m.power === o.power) continue;
        if (m.unit === o.to ? resolve(m.unit) : path(m)) return false;
      }
      return true;
    }
    if (o.type === 'C') return !movesTo(n).some(m => resolve(m.unit));
    return true;
  }

  for (const o of list) resolve(o.unit);
  const results = list.map(o => ({ ...o, ok: o.type === 'M' ? res[o.unit] : o.type === 'H' ? true : res[o.unit] && !o.void }));
  const units = [], dislodged = [];
  for (const o of list) {
    const moved = o.type === 'M' && res[o.unit];
    const beaten = !moved && movesTo(o.unit).find(m => res[m.unit]);
    if (beaten) { dislodged.push({ power: o.power, type: o.utype, prov: o.unit, by: beaten.convoy ? null : beaten.unit }); results.find(r => r.unit === o.unit).dislodged = true; }
    else units.push({ power: o.power, type: o.utype, prov: moved ? o.to : o.unit });
  }
  const occupied = new Set(units.map(u => u.prov));
  const standoff = p => !occupied.has(p) && movesTo(p).filter(path).length >= 2;
  for (const d of dislodged)
    d.options = (d.type === 'A' ? ARMY_ADJ : FLEET_ADJ)[d.prov].filter(p => !occupied.has(p) && p !== d.by && !standoff(p));
  const next = { ...structuredClone(s), units, dislodged, lastResults: results };
  return dislodged.length ? { ...next, phase: 'R' } : advance(next);
}

export function resolveRetreats(s, ordersByPower) {
  const want = {};
  for (const p in ordersByPower) for (const o of ordersByPower[p] || []) {
    const d = s.dislodged.find(x => x.prov === o.unit && x.power === p);
    if (d && o.type === 'R' && d.options.includes(o.to)) want[d.prov] = o.to;
  }
  const count = {};
  for (const to of Object.values(want)) count[to] = (count[to] || 0) + 1;
  const next = structuredClone(s);
  for (const d of s.dislodged) {
    const to = want[d.prov];
    if (to && count[to] === 1) next.units.push({ power: d.power, type: d.type, prov: to });
  }
  return advance(next);
}

// Builds possible (positive) or disbands required (negative) per power.
export function adjustments(s) {
  const out = {};
  for (const p in POWERS) {
    const units = s.units.filter(u => u.power === p).length;
    let d = scCount(s, p) - units;
    if (d > 0) d = Math.min(d, IDS.filter(i => PROVS[i].home === p && s.owners[i] === p && !unitAt(s, i)).length);
    if (d) out[p] = d;
  }
  return out;
}

export function distanceFromHome(power) {
  const dist = {}, q = IDS.filter(i => PROVS[i].home === power);
  q.forEach(i => (dist[i] = 0));
  while (q.length) { const n = q.shift(); for (const m of [...ARMY_ADJ[n], ...FLEET_ADJ[n]]) if (!(m in dist)) { dist[m] = dist[n] + 1; q.push(m); } }
  return dist;
}

export function resolveAdjust(s, ordersByPower) {
  const next = structuredClone(s), adj = adjustments(s);
  for (const p in adj) {
    const mine = (ordersByPower[p] || []);
    if (adj[p] > 0) {
      let left = adj[p];
      for (const o of mine) {
        if (!left || o.type !== 'B' || !['A', 'F'].includes(o.unitType)) continue;
        const pr = PROVS[o.prov];
        if (!pr || pr.home !== p || next.owners[o.prov] !== p || unitAt(next, o.prov)) continue;
        if (o.unitType === 'F' && !pr.coast) continue;
        next.units.push({ power: p, type: o.unitType, prov: o.prov }); left--;
      }
    } else {
      let left = -adj[p];
      for (const o of mine) {
        if (!left || o.type !== 'X') continue;
        const i = next.units.findIndex(u => u.prov === o.prov && u.power === p);
        if (i >= 0) { next.units.splice(i, 1); left--; }
      }
      const dist = distanceFromHome(p); // civil disorder: drop the units furthest from home
      while (left-- > 0) {
        const own = next.units.filter(u => u.power === p).sort((a, b) => (dist[b.prov] ?? 99) - (dist[a.prov] ?? 99));
        next.units.splice(next.units.indexOf(own[0]), 1);
      }
    }
  }
  next.season = 'F'; // advance() from Fall-with-no-adjustment rolls into the next year
  return advance(next, true);
}

function advance(s, adjusted = false) {
  s.dislodged = [];
  if (s.season === 'S') return { ...s, season: 'F', phase: 'M' };
  if (s.season === 'F' && !adjusted) {
    for (const u of s.units) if (PROVS[u.prov].sc) s.owners[u.prov] = u.power;
    const best = Object.keys(POWERS).sort((a, b) => scCount(s, b) - scCount(s, a))[0];
    if (scCount(s, best) >= WIN) return { ...s, over: true, winner: best };
    if (Object.keys(adjustments(s)).length) return { ...s, season: 'W', phase: 'A' };
  }
  if (s.year >= s.maxYear) {
    const best = Object.keys(POWERS).sort((a, b) => scCount(s, b) - scCount(s, a))[0];
    return { ...s, over: true, winner: best };
  }
  return { ...s, year: s.year + 1, season: 'S', phase: 'M' };
}

export function step(s, ordersByPower) {
  if (s.phase === 'M') return resolveMovement(s, ordersByPower);
  if (s.phase === 'R') return resolveRetreats(s, ordersByPower);
  return resolveAdjust(s, ordersByPower);
}

// Which powers must act in the current phase.
export function needsOrders(s) {
  if (s.over) return [];
  if (s.phase === 'M') return [...new Set(s.units.map(u => u.power))];
  if (s.phase === 'R') return [...new Set(s.dislodged.map(d => d.power))];
  return Object.keys(adjustments(s));
}
