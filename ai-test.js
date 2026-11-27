// AI check: every level finishes games, and each level beats the one below it from every seat.
// The weaker side submits first (like humans), so Brutal gets to read their orders, as it does in real games.
// Run: node test.js --ai   (a few minutes)   Options: YEARS=8 PAIRS="hard,medium;brutal,hard"
import assert from 'node:assert/strict';
import { POWERS, SC_COUNT } from './shared/map.js';
import { initialState, step, needsOrders, scCount } from './shared/engine.js';
import { botOrders, newRelations, afterPhase, LEVELS } from './ai.js';

const time = {};
function play(levels, focal, years) {
  let s = initialState(years);
  const rels = Object.fromEntries(Object.keys(POWERS).map(p => [p, newRelations()]));
  while (!s.over) {
    const orders = {}, need = needsOrders(s);
    const run = (p, known) => {
      const t0 = performance.now();
      orders[p] = botOrders(s, p, levels[p], rels[p], { relOf: q => rels[q], known });
      if (s.phase === 'M') (time[levels[p]] ||= []).push(performance.now() - t0);
    };
    for (const p of need) if (p !== focal) run(p);
    if (need.includes(focal)) run(focal, LEVELS[levels[focal]].peek ? { ...orders } : undefined);
    const next = step(s, orders);
    afterPhase(s, next, levels, rels);
    s = next;
  }
  return s;
}

const powers = Object.keys(POWERS), years = Number(process.env.YEARS || 8), fair = SC_COUNT / powers.length;
const pairs = process.env.PAIRS ? process.env.PAIRS.split(';').map(p => p.split(',')) : [['medium', 'easy'], ['hard', 'medium'], ['brutal', 'hard']];
for (const [strong, weak] of pairs) {
  const res = powers.map(focal => scCount(play(Object.fromEntries(powers.map(p => [p, p === focal ? strong : weak])), focal, years), focal));
  const avg = res.reduce((a, b) => a + b, 0) / res.length;
  console.log(`${strong} vs 6x ${weak}: avg ${avg.toFixed(1)} SCs (fair share ${fair.toFixed(1)}) per seat ${res.join(' ')}`);
  assert.ok(avg > fair, `${strong} should beat ${weak}`);
}
for (const l in time) console.log(`${l}: ${(time[l].reduce((a, b) => a + b, 0) / time[l].length).toFixed(0)} ms avg, ${Math.max(...time[l]).toFixed(0)} ms max per move phase`);
