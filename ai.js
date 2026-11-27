// Bot players. Every level shares one brain:
//   1. a strategic value map (what each province is worth to this power right now),
//   2. a stochastic order generator that coordinates moves and supports from that map,
//   3. (medium+) search: candidate order sets are played against sampled opponent orders
//      with the real adjudicator, then hill-climbed one unit at a time.
// Levels differ in search breadth, opponent modelling, strategic focus and how they treat deals.
import { PROVS, IDS, POWERS, ADJ, ARMY_ADJ, FLEET_ADJ, canMove, WIN } from './shared/map.js';
import { resolveMovement, validate, unitAt, scCount, alive, adjustments, convoyable } from './shared/engine.js';

export const LEVELS = {
  easy:   { label: 'Easy',   cands: 0,  samples: 0,  temp: 2.5, blunder: 0.3,  climb: 0, leader: 0,   pact: 40, oppTemp: 1.5, honor: 1 },
  medium: { label: 'Medium', cands: 5,  samples: 2,  temp: 1.2, blunder: 0.05, climb: 0, leader: 0.5, pact: 25, oppTemp: 1.2, honor: 1 },
  // Hard: real search and strategy, but it only *predicts* you, looks one phase ahead and keeps its word.
  hard:   { label: 'Hard',   cands: 14, samples: 6,  temp: 0.8, blunder: 0,    climb: 1, leader: 1.5, pact: 16, oppTemp: 0.9, honor: 0.95, target: true },
  // Brutal: wide search, robust scoring, models opponents with search, and reads human orders already submitted.
  brutal: { label: 'Brutal', cands: 30, samples: 10, temp: 0.6, blunder: 0,    climb: 4, leader: 2.5, pact: 7,  oppTemp: 0.7, honor: 0.5, target: true, peek: true, smart: true, model: 'hard' },
};

export const newRelations = () => ({ pacts: {}, trust: {}, target: null, vs: null, vsUntil: 0, promises: [] });
const NEUTRAL = newRelations();
const pactWith = (rel, p, s) => (rel.pacts[p] ?? -1) >= s.year;
const phaseKey = s => `${s.year}${s.season}${s.phase}`;
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const DIST = {};
for (const a of IDS) {
  const d = { [a]: 0 }, q = [a];
  while (q.length) { const n = q.shift(); for (const m of ADJ[n]) if (!(m in d)) { d[m] = d[n] + 1; q.push(m); } }
  DIST[a] = d;
}

function softmax(opts, temp) {
  const mx = Math.max(...opts.map(o => o.sc));
  const w = opts.map(o => Math.exp((o.sc - mx) / Math.max(temp, 0.01)));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < opts.length; i++) if ((r -= w[i]) <= 0) return opts[i];
  return opts[opts.length - 1];
}

const threatsTo = (s, me, id, rel) => s.units.reduce((t, u) => t + (u.power !== me && canMove(u.type, u.prov, id) ? (pactWith(rel, u.power, s) ? 0.2 : 1) : 0), 0);

export function valueMaps(s, me, rel = NEUTRAL) {
  const fall = s.season === 'F', base = {};
  for (const id of IDS) {
    base[id] = 0;
    if (!PROVS[id].sc) continue;
    const owner = s.owners[id], occ = unitAt(s, id);
    if (owner === me && !(occ && occ.power !== me)) {
      const t = threatsTo(s, me, id, rel);
      base[id] = t ? (2.5 + 2 * t) * (fall ? 1.4 : 1) : 0.6;
    } else {
      let v = owner === me ? 7 : owner ? 3.5 + 0.3 * scCount(s, owner) : 7;
      if (owner && owner !== me && pactWith(rel, owner, s)) v *= 0.15;
      else if (owner && (owner === rel.target || owner === rel.vs)) v *= 1.6;
      else if (owner && owner !== me && rel.target) v *= 0.75; // one war at a time
      if (owner && owner !== me) v *= 1.6 - (rel.trust[owner] ?? 0.6); // hit those who hit us
      base[id] = v * (fall ? 1.3 : 1);
    }
  }
  const out = {};
  for (const [t, adj] of [['A', ARMY_ADJ], ['F', FLEET_ADJ]]) {
    let v = base;
    for (let k = 0; k < 5; k++) {
      const nv = {};
      for (const id of IDS) {
        let mx = 0, sum = 0;
        for (const n of adj[id]) { if (v[n] > mx) mx = v[n]; sum += v[n]; }
        nv[id] = base[id] + 0.5 * mx + 0.06 * sum;
      }
      v = nv;
    }
    out[t] = v;
  }
  out.base = base;
  return out;
}

// One coordinated order set. `fixed` = orders already decided (promises).
function generate(s, me, V, temp, rel, fixed = []) {
  const orders = {}, dest = {};
  for (const o of fixed) { orders[o.unit] = o; if (o.type === 'M') dest[o.to] = o.unit; }
  const mine = shuffle(s.units.filter(u => u.power === me));
  const spring = s.season === 'S';
  for (const u of mine) {
    if (orders[u.prov]) continue;
    const Vt = V[u.type];
    const holdBonus = spring && PROVS[u.prov].sc && s.owners[u.prov] !== me ? 8 : 0;
    const opts = [{ o: { unit: u.prov, type: 'H' }, sc: Vt[u.prov] * 0.9 + holdBonus }];
    for (const to of (u.type === 'A' ? ARMY_ADJ : FLEET_ADJ)[u.prov]) {
      const own = unitAt(s, to);
      if (own && own.power === me && orders[to]?.type !== 'M') continue; // no chains into units that may stay
      if (dest[to]) opts.push({ o: { unit: u.prov, type: 'S', from: dest[to], to }, sc: Vt[to] * 0.55 });
      else opts.push({ o: { unit: u.prov, type: 'M', to }, sc: Vt[to] });
    }
    if (u.type === 'A' && PROVS[u.prov].coast) {
      for (const f of s.units) {
        if (f.power !== me || f.type !== 'F' || PROVS[f.prov].land || orders[f.prov] || !FLEET_ADJ[u.prov].includes(f.prov)) continue;
        for (const c of FLEET_ADJ[f.prov]) if (PROVS[c].land && c !== u.prov && !dest[c] && !ARMY_ADJ[u.prov].includes(c))
          opts.push({ o: { unit: u.prov, type: 'M', to: c }, via: f.prov, sc: V.A[c] - 0.5 });
      }
    }
    const ch = softmax(opts, temp);
    orders[u.prov] = ch.o;
    if (ch.o.type === 'M') dest[ch.o.to] = u.prov;
    if (ch.via) orders[ch.via] = { unit: ch.via, type: 'C', from: u.prov, to: ch.o.to };
  }
  // Holding units support instead: a supporter still defends, so this is never worse than holding.
  for (const u of mine) {
    if (orders[u.prov].type !== 'H') continue;
    const opts = [{ o: orders[u.prov], sc: 0 }];
    for (const o of Object.values(orders)) {
      if (o.unit === u.prov) continue;
      if (o.type === 'M' && o.to !== u.prov && canMove(u.type, u.prov, o.to)) {
        const contested = s.units.some(e => e.power !== me && (e.prov === o.to || canMove(e.type, e.prov, o.to)));
        opts.push({ o: { unit: u.prov, type: 'S', from: o.unit, to: o.to }, sc: (contested ? 1 : 0.1) * V[u.type][o.to] * 0.5 });
      } else if (o.type !== 'M' && canMove(u.type, u.prov, o.unit)) {
        const t = threatsTo(s, me, o.unit, rel);
        if (t) opts.push({ o: { unit: u.prov, type: 'S', from: o.unit, to: o.unit }, sc: t * (PROVS[o.unit].sc ? 3 : 1) });
      }
    }
    orders[u.prov] = softmax(opts, temp).o;
  }
  return Object.values(orders);
}

function randomOrder(s, u) {
  const to = pick([u.prov, ...(u.type === 'A' ? ARMY_ADJ : FLEET_ADJ)[u.prov]]);
  return to === u.prov ? { unit: u.prov, type: 'H' } : { unit: u.prov, type: 'M', to };
}

// How much this power wants to take centres from `p` right now (neutral = 1).
const attitude = (s, rel, p) => !p ? 1 : pactWith(rel, p, s) ? 0.1
  : (p === rel.target || p === rel.vs) ? 1.3 : (1.6 - (rel.trust[p] ?? 0.6)) * (rel.target ? 0.8 : 0.9);

function evaluate(s0, r, me, rel, P) {
  const fall = s0.season === 'F', pos = {}, counts = {};
  for (const u of r.units) pos[u.prov] = u;
  let score = 0;
  for (const id of IDS) {
    if (!PROVS[id].sc) continue;
    const occ = pos[id], owner = s0.owners[id], fin = fall && occ ? occ.power : owner;
    if (fin) counts[fin] = (counts[fin] || 0) + 1;
    const att = owner === me ? 1 : attitude(s0, rel, owner);
    if (fin === me) score += 10 * att;
    if (!fall) {
      if (occ && occ.power === me && owner !== me) score += 6 * att;
      else if (owner === me && occ && occ.power !== me) score -= 6;
    }
    let mine = 0;
    const theirs = {};
    for (const u of r.units) if (u.prov === id || canMove(u.type, u.prov, id)) {
      if (u.power === me) mine++;
      else theirs[u.power] = (theirs[u.power] || 0) + (pactWith(rel, u.power, s0) ? 0.3 : 1);
    }
    const enemy = Math.max(0, ...Object.values(theirs));
    if (fin === me) {
      if (enemy > mine) score -= fall ? 2 : 4;
      else if (!occ && enemy > 0) score -= fall ? 1 : 3; // empty and reachable: any bounce lost = centre lost
    }
    else {
      const def = occ && occ.power !== me ? theirs[occ.power] : enemy;
      if (mine > def) score += (fall ? 1.5 : 3) * att;
    }
  }
  score += 2 * r.units.filter(u => u.power === me).length;
  for (const d of r.dislodged) {
    if (d.power === me) score += d.options.length ? 0.5 : -1.5;
    else if (!pactWith(rel, d.power, s0)) score += 1;
  }
  const maxOther = Math.max(0, ...Object.entries(counts).filter(([p]) => p !== me).map(([, c]) => c));
  score -= P.leader * Math.max(0, maxOther - 8);
  for (const p in rel.pacts) {
    if (!pactWith(rel, p, s0)) continue;
    if (r.dislodged.some(d => d.power === p && pos[d.prov]?.power === me)) score -= P.pact;
    for (const id of IDS) if (s0.owners[id] === p && pos[id]?.power === me && unitAt(s0, id)?.power !== me) score -= P.pact;
  }
  return score;
}

function alternatives(s, u, orders) {
  const out = [{ unit: u.prov, type: 'H' }];
  for (const to of (u.type === 'A' ? ARMY_ADJ : FLEET_ADJ)[u.prov]) out.push({ unit: u.prov, type: 'M', to });
  for (const o of orders) {
    if (o.unit === u.prov) continue;
    if (o.type === 'M' && o.to !== u.prov && canMove(u.type, u.prov, o.to)) out.push({ unit: u.prov, type: 'S', from: o.unit, to: o.to });
    else if (o.type !== 'M' && canMove(u.type, u.prov, o.unit)) out.push({ unit: u.prov, type: 'S', from: o.unit, to: o.unit });
  }
  return out;
}

function search(s, me, P, rel, V, samples, fixed) {
  const fixedUnits = new Set(fixed.map(o => o.unit));
  const partners = Object.keys(rel.pacts).filter(q => pactWith(rel, q, s));
  // An attempted attack on a partner is a breach even if it bounces (that's how partners judge it too).
  const breaches = cand => cand.filter(o => o.type === 'M' && partners.some(q => s.owners[o.to] === q || unitAt(s, o.to)?.power === q)).length;
  const score = cand => {
    let tot = 0, mn = Infinity;
    for (const smp of samples) {
      const v = evaluate(s, resolveMovement(s, { ...smp, [me]: cand }), me, rel, P);
      tot += v; if (v < mn) mn = v;
    }
    const mean = tot / samples.length;
    return (P.robust ? (1 - P.robust) * mean + P.robust * mn : mean) - P.pact * breaches(cand);
  };
  let best = generate(s, me, V, 0.05, rel, fixed), bestSc = score(best);
  for (let i = 0; i < P.cands; i++) {
    const c = generate(s, me, V, P.temp, rel, fixed), sc = score(c);
    if (sc > bestSc) { best = c; bestSc = sc; }
  }
  for (let pass = 0; pass < P.climb; pass++) {
    let improved = false;
    for (const u of shuffle(s.units.filter(x => x.power === me && !fixedUnits.has(x.prov)))) {
      // Don't break a convoy pairing by re-ordering just one half of it.
      if (best.some(o => o.type === 'C' && (o.unit === u.prov || o.from === u.prov))) continue;
      for (const alt of alternatives(s, u, best)) {
        const cand = best.map(o => (o.unit === u.prov ? alt : o)), sc = score(cand);
        if (sc > bestSc + 1e-9) { best = cand; bestSc = sc; improved = true; }
      }
    }
    if (!improved) break;
  }
  return { orders: best, score: bestSc };
}

function updateTarget(s, me, rel, ctx) {
  if (rel.vs && alive(s, rel.vs) && rel.vsUntil >= s.year) { rel.target = rel.vs; return; }
  const mine = s.units.filter(u => u.power === me);
  const freeNear = IDS.filter(id => PROVS[id].sc && !s.owners[id] && mine.some(u => DIST[u.prov][id] <= 2)).length;
  if (s.year <= 2 && freeNear >= 2 && !rel.target) return; // grab neutrals before picking a war
  let best = null, bs = -Infinity;
  for (const p in POWERS) {
    if (p === me || !alive(s, p) || pactWith(rel, p, s)) continue;
    const near = IDS.filter(id => s.owners[id] === p && mine.some(u => DIST[u.prov][id] <= 2)).length;
    const threat = s.units.filter(u => u.power === p && IDS.some(id => s.owners[id] === me && canMove(u.type, u.prov, id))).length;
    const size = scCount(s, p);
    // Pile-on discount: other bots already at war with p (keeps one victim from being eaten by everyone).
    const piled = Object.keys(POWERS).filter(q => q !== me && q !== p && ctx.relOf?.(q)?.target === p).length;
    const sc = near * 2 + threat * 1.5 + 0.3 * size + 1.5 * Math.max(0, size - 7) + (p === rel.target ? 2 : 0)
      - 3 * (rel.trust[p] ?? 0.6) - 2.5 * Math.max(0, piled - (size > 7 ? 2 : 0));
    if (sc > bs) { bs = sc; best = p; }
  }
  rel.target = best;
}

function moveOrders(s, me, lvl, rel, ctx) {
  const P = LEVELS[lvl], last = s.lastResults || [];
  s = { ...s, lastResults: null };
  if (P.target) updateTarget(s, me, rel, ctx);
  const fixed = rel.promises.filter(p => p.key === phaseKey(s) && Math.random() < P.honor)
    .map(p => p.order).filter(o => validate(s, me, o));
  const V = valueMaps(s, me, rel);
  if (!P.cands) {
    const fixedUnits = new Set(fixed.map(o => o.unit));
    return generate(s, me, V, P.temp, rel, fixed).map(o => (!fixedUnits.has(o.unit) && o.type !== 'C' && Math.random() < P.blunder ? randomOrder(s, unitAt(s, o.unit)) : o));
  }
  const others = Object.keys(POWERS).filter(p => p !== me && s.units.some(u => u.power === p));
  const oppV = Object.fromEntries(others.map(p => [p, valueMaps(s, p, ctx.relOf?.(p) || NEUTRAL)]));
  let smart = null;
  if (P.smart) { // model each opponent as a medium-level searcher replying to greedy play
    const greedy = Object.fromEntries(others.map(p => [p, generate(s, p, oppV[p], 0.05, NEUTRAL)]));
    smart = Object.fromEntries(others.map(p => [p, search(s, p, LEVELS[P.model || 'medium'], ctx.relOf?.(p) || NEUTRAL, oppV[p], [greedy], []).orders]));
  }
  // Habit model: what each opponent did last movement phase, re-applied where the units still stand.
  const habit = {};
  for (const r of last) if (r.type !== 'H' && unitAt(s, r.unit)?.power === r.power) (habit[r.power] ||= []).push({ unit: r.unit, type: r.type, to: r.to, from: r.from });
  const samples = [];
  for (let k = 0; k < P.samples; k++) {
    const smp = {};
    for (const p of others) {
      if (P.peek && ctx.known?.[p]) smp[p] = ctx.known[p];
      else if (P.target && k === P.samples - 1 && habit[p]) smp[p] = habit[p];
      else if (smart && k < P.samples / 2) smp[p] = smart[p];
      else smp[p] = generate(s, p, oppV[p], P.oppTemp, NEUTRAL);
    }
    samples.push(smp);
  }
  return search(s, me, P, rel, V, samples, fixed).orders;
}

function retreatOrders(s, me, lvl, rel) {
  const V = valueMaps(s, me, rel), taken = new Set(), out = [];
  for (const d of s.dislodged.filter(d => d.power === me)) {
    const opts = d.options.filter(o => !taken.has(o));
    if (!opts.length) continue;
    const to = lvl === 'easy' ? pick(opts) : opts.reduce((a, b) => (V[d.type][b] > V[d.type][a] ? b : a));
    taken.add(to); out.push({ unit: d.prov, type: 'R', to });
  }
  return out;
}

function adjustOrders(s, me, lvl, rel) {
  const n = adjustments(s)[me] || 0, V = valueMaps(s, me, rel), out = [];
  if (n > 0) {
    const homes = IDS.filter(i => PROVS[i].home === me && s.owners[i] === me && !unitAt(s, i))
      .sort((a, b) => threatsTo(s, me, b, rel) - threatsTo(s, me, a, rel));
    const fleets = s.units.filter(u => u.power === me && u.type === 'F').length;
    const armies = s.units.filter(u => u.power === me && u.type === 'A').length;
    for (const h of homes.slice(0, n)) {
      const aVal = Math.max(0, ...ARMY_ADJ[h].map(x => V.A[x]));
      const fVal = PROVS[h].coast ? Math.max(0, ...FLEET_ADJ[h].map(x => V.F[x])) : -1;
      // Island powers need armies to have something to convoy; keep some balance.
      let type = fVal > aVal ? 'F' : 'A';
      if (!ARMY_ADJ[h].some(x => !PROVS[x].home || PROVS[x].home !== me) && armies < fleets / 2) type = 'A';
      if (!PROVS[h].coast) type = 'A';
      if (lvl === 'easy' && PROVS[h].coast && Math.random() < 0.4) type = pick(['A', 'F']);
      out.push({ type: 'B', prov: h, unitType: type });
    }
  } else if (n < 0) {
    const own = s.units.filter(u => u.power === me).sort((a, b) => V[a.type][a.prov] - V[b.type][b.prov]);
    for (const u of own.slice(0, -n)) out.push({ type: 'X', prov: u.prov });
  }
  return out;
}

// ctx: { relOf(power) -> relations of another bot, known: {power: submitted orders} }
export function botOrders(s, me, lvl, rel, ctx = {}) {
  if (s.phase === 'M') return moveOrders(s, me, lvl, rel, ctx);
  if (s.phase === 'R') return retreatOrders(s, me, lvl, rel);
  return adjustOrders(s, me, lvl, rel);
}

const say = (ok, yes, no) => ({ accept: ok, text: ok ? pick(yes) : pick(no) });

// Structured deals from a human. Returns { accept, text } and updates `rel` when accepted.
export function considerProposal(s, me, from, prop, lvl, rel) {
  const trust = rel.trust[from] ?? 0.6, mySc = scCount(s, me), theirSc = scCount(s, from);
  const easy = lvl === 'easy';
  if (prop.type === 'peace') {
    if (pactWith(rel, from, s)) return { accept: true, text: 'We already have an understanding.' };
    let ok = easy ? Math.random() < 0.8
      : trust >= 0.4 && from !== rel.target && theirSc <= mySc + (lvl === 'medium' ? 4 : 2) && theirSc < WIN - 4;
    if (lvl === 'brutal' && trust >= 0.3 && theirSc < WIN - 6) ok = true; // signing costs it nothing
    if (ok) rel.pacts[from] = s.year + 1;
    return say(ok, ['Agreed. Our borders stay quiet through next year.', 'Peace it is. Do not make us regret it.'],
      [trust < 0.4 ? 'Your word is worth little to us now.' : 'We have other plans.', 'No. You are getting too strong.']);
  }
  if (prop.type === 'ally') {
    const x = prop.vs;
    if (!POWERS[x] || x === me || x === from || !alive(s, x)) return { accept: false, text: 'That makes no sense to us.' };
    const mine = s.units.filter(u => u.power === me);
    const near = IDS.some(id => s.owners[id] === x && mine.some(u => DIST[u.prov][id] <= 2));
    const ok = easy ? Math.random() < 0.7 : trust >= 0.45 && near && !pactWith(rel, x, s) && rel.target !== from;
    if (ok) { rel.pacts[from] = s.year + 1; rel.vs = x; rel.vsUntil = s.year + 1; rel.target = x; }
    return say(ok, [`Together, then. ${POWERS[x].name} falls.`, `Agreed. We march on ${POWERS[x].name}.`],
      [near ? `We are not ready to fight ${POWERS[x].name}.` : `${POWERS[x].name} is too far from us.`, 'We decline.']);
  }
  if (prop.type === 'support') {
    if (s.phase !== 'M') return { accept: false, text: 'Not now.' };
    const target = unitAt(s, prop.unit);
    if (!target || target.power !== from) return { accept: false, text: 'That is not your unit.' };
    const to = prop.to || prop.unit;
    if (s.owners[to] === me || unitAt(s, to)?.power === me)
      return { accept: false, text: 'You want our help taking what is ours? No.' };
    const helpers = s.units.filter(u => u.power === me && validate(s, me, { unit: u.prov, type: 'S', from: prop.unit, to }));
    if (!helpers.length) return { accept: false, text: 'None of our units can reach.' };
    const ok = easy ? Math.random() < 0.75 : (pactWith(rel, from, s) && trust >= 0.4) || trust >= 0.8;
    if (ok) {
      const V = valueMaps(s, me, rel);
      const h = helpers.reduce((a, b) => (V[a.type][a.prov] <= V[b.type][b.prov] ? a : b)); // least useful elsewhere
      rel.promises = rel.promises.filter(p => p.key === phaseKey(s) && p.order.unit !== h.prov);
      rel.promises.push({ key: phaseKey(s), order: { unit: h.prov, type: 'S', from: prop.unit, to } });
      return { accept: true, text: `Our ${h.type === 'A' ? 'army' : 'fleet'} in ${PROVS[h.prov].name} will support you.` };
    }
    return { accept: false, text: pactWith(rel, from, s) ? 'We cannot spare the unit.' : 'We help friends, not strangers.' };
  }
  return { accept: false, text: 'We do not understand.' };
}

// After a movement phase: detect who attacked this bot, adjust trust and pacts.
// Tracks every power (bots feud with bots too); returns chat lines meant for humans.
export function updateRelations(s0, results, me, lvl, rel, humans = []) {
  const msgs = [];
  for (const p in rel.pacts) if (rel.pacts[p] < s0.year) delete rel.pacts[p];
  for (const h in POWERS) {
    if (h === me) continue;
    const hostile = results.some(o => o.power === h && o.type === 'M' && (unitAt(s0, o.to)?.power === me || s0.owners[o.to] === me));
    const hadPact = pactWith(rel, h, s0);
    if (hostile) {
      rel.trust[h] = Math.max(0, (rel.trust[h] ?? 0.6) - (hadPact ? 0.5 : 0.15));
      if (hadPact) {
        delete rel.pacts[h];
        if (LEVELS[lvl].target) { rel.target = h; rel.vs = null; }
        msgs.push({ to: h, text: pick(['You broke our pact. We will not forget it.', 'Treachery. You will pay for this.', 'So that is what your word is worth.']) });
      }
    } else rel.trust[h] = Math.min(1, (rel.trust[h] ?? 0.6) + (hadPact ? 0.05 : 0.02));
    const betrayed = hadPact && results.some(o => o.power === me && o.type === 'M' && (unitAt(s0, o.to)?.power === h || s0.owners[o.to] === h));
    if (betrayed) { delete rel.pacts[h]; msgs.push({ to: h, text: pick(['Nothing personal.', 'Circumstances have changed.']) }); }
  }
  rel.promises = [];
  return msgs.filter(m => humans.includes(m.to));
}

// Call after any phase resolves. `bots` = {power: level}. Returns [{from, to, text}] for humans.
export function afterPhase(s0, next, bots, rels, humans = []) {
  if (s0.phase !== 'M') return [];
  return Object.entries(bots).flatMap(([b, lvl]) => updateRelations(s0, next.lastResults, b, lvl, rels[b], humans).map(m => ({ from: b, ...m })));
}
