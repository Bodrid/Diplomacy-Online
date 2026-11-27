// Run: node test.js   (engine rules + AI smoke games)
import assert from 'node:assert/strict';
import { initialState, resolveMovement, resolveRetreats, step, needsOrders, unitAt, scCount } from './shared/engine.js';

const S = (units, extra = {}) => ({ ...initialState(), units: units.map(([power, type, prov]) => ({ power, type, prov })), ...extra });
const M = (unit, to) => ({ unit, type: 'M', to });
const Sup = (unit, from, to = from) => ({ unit, type: 'S', from, to });
const C = (unit, from, to) => ({ unit, type: 'C', from, to });
const at = (s, p) => unitAt(s, p)?.power;
let n = 0;
const t = (name, fn) => { fn(); n++; };

t('bounce', () => {
  const r = resolveMovement(S([['CAS', 'A', 'ORL'], ['MOR', 'A', 'MOR']]), { CAS: [M('ORL', 'GEL')], MOR: [M('MOR', 'GEL')] });
  assert.equal(at(r, 'ORL'), 'CAS'); assert.equal(at(r, 'MOR'), 'MOR'); assert.equal(at(r, 'GEL'), undefined);
});
t('supported move wins', () => {
  const r = resolveMovement(S([['CAS', 'A', 'ORL'], ['CAS', 'A', 'LOR'], ['MOR', 'A', 'MOR']]), { CAS: [M('ORL', 'GEL'), Sup('LOR', 'ORL', 'GEL')], MOR: [M('MOR', 'GEL')] });
  assert.equal(at(r, 'GEL'), 'CAS');
});
t('dislodge + retreat options exclude attacker origin', () => {
  const r = resolveMovement(S([['CAS', 'A', 'ORL'], ['CAS', 'A', 'LOR'], ['MOR', 'A', 'GEL']]), { CAS: [M('ORL', 'GEL'), Sup('LOR', 'ORL', 'GEL')] });
  assert.equal(r.phase, 'R'); assert.equal(at(r, 'GEL'), 'CAS');
  assert.ok(!r.dislodged[0].options.includes('ORL')); assert.ok(r.dislodged[0].options.includes('MOR'));
});
t('support cut', () => {
  const r = resolveMovement(S([['CAS', 'A', 'ORL'], ['CAS', 'A', 'LOR'], ['MOR', 'A', 'GEL'], ['SOL', 'A', 'VER']]), { CAS: [M('ORL', 'GEL'), Sup('LOR', 'ORL', 'GEL')], SOL: [M('VER', 'LOR')] });
  assert.equal(at(r, 'GEL'), 'MOR');
});
t('attack from target does not cut support', () => {
  const r = resolveMovement(S([['CAS', 'A', 'ORL'], ['CAS', 'A', 'LOR'], ['MOR', 'A', 'GEL']]), { CAS: [M('ORL', 'GEL'), Sup('LOR', 'ORL', 'GEL')], MOR: [M('GEL', 'LOR')] });
  assert.equal(at(r, 'GEL'), 'CAS'); assert.equal(r.dislodged[0].prov, 'GEL');
});
t('head-to-head', () => {
  let r = resolveMovement(S([['CAS', 'A', 'ORL'], ['MOR', 'A', 'GEL']]), { CAS: [M('ORL', 'GEL')], MOR: [M('GEL', 'ORL')] });
  assert.equal(at(r, 'ORL'), 'CAS'); assert.equal(at(r, 'GEL'), 'MOR');
  r = resolveMovement(S([['CAS', 'A', 'ORL'], ['CAS', 'A', 'LOR'], ['MOR', 'A', 'GEL']]), { CAS: [M('ORL', 'GEL'), Sup('LOR', 'ORL', 'GEL')], MOR: [M('GEL', 'ORL')] });
  assert.equal(at(r, 'GEL'), 'CAS'); assert.equal(r.dislodged[0].prov, 'GEL');
});
t('circular movement', () => {
  const r = resolveMovement(S([['CAS', 'A', 'ORL'], ['MOR', 'A', 'GEL'], ['SOL', 'A', 'LOR']]), { CAS: [M('ORL', 'GEL')], MOR: [M('GEL', 'LOR')], SOL: [M('LOR', 'ORL')] });
  assert.equal(at(r, 'GEL'), 'CAS'); assert.equal(at(r, 'LOR'), 'MOR'); assert.equal(at(r, 'ORL'), 'SOL');
});
t('convoy', () => {
  const r = resolveMovement(S([['VAL', 'A', 'KEL'], ['VAL', 'F', 'MIS']]), { VAL: [M('KEL', 'CAS'), C('MIS', 'KEL', 'CAS')] });
  assert.equal(at(r, 'CAS'), 'VAL');
});
t('disrupted convoy', () => {
  const r = resolveMovement(S([['VAL', 'A', 'KEL'], ['VAL', 'F', 'MIS'], ['CAS', 'F', 'NAR'], ['CAS', 'F', 'PAL']]),
    { VAL: [M('KEL', 'CAS'), C('MIS', 'KEL', 'CAS')], CAS: [M('NAR', 'MIS'), Sup('PAL', 'NAR', 'MIS')] });
  assert.equal(at(r, 'KEL'), 'VAL'); assert.equal(at(r, 'MIS'), 'CAS');
});
t('no self-dislodge', () => {
  const r = resolveMovement(S([['CAS', 'A', 'ORL'], ['CAS', 'A', 'LOR'], ['CAS', 'A', 'GEL']]), { CAS: [M('ORL', 'GEL'), Sup('LOR', 'ORL', 'GEL')] });
  assert.equal(r.phase, 'F' === r.season ? 'M' : r.phase); assert.equal(at(r, 'ORL'), 'CAS'); assert.equal(r.dislodged.length, 0);
});
t('beleaguered garrison', () => {
  const r = resolveMovement(S([['CAS', 'A', 'ORL'], ['CAS', 'A', 'LOR'], ['MOR', 'A', 'MOR'], ['MOR', 'A', 'DRA'], ['SOL', 'A', 'GEL']]),
    { CAS: [M('ORL', 'GEL'), Sup('LOR', 'ORL', 'GEL')], MOR: [M('MOR', 'GEL'), Sup('DRA', 'MOR', 'GEL')] });
  assert.equal(at(r, 'GEL'), 'SOL');
});
t('illegal orders become holds', () => {
  const r = resolveMovement(S([['CAS', 'A', 'ORL']]), { CAS: [M('ORL', 'TAV')], MOR: [M('ORL', 'GEL')] });
  assert.equal(at(r, 'ORL'), 'CAS');
});
t('retreat collision disbands both', () => {
  const s = { ...S([['CAS', 'A', 'GEL']]), phase: 'R', dislodged: [{ power: 'MOR', type: 'A', prov: 'X1', options: ['DRA'] }, { power: 'OST', type: 'A', prov: 'X2', options: ['DRA'] }] };
  const r = resolveRetreats(s, { MOR: [{ unit: 'X1', type: 'R', to: 'DRA' }], OST: [{ unit: 'X2', type: 'R', to: 'DRA' }] });
  assert.equal(at(r, 'DRA'), undefined);
});
t('fall capture -> build', () => {
  let s = initialState();
  s = step(s, { CAS: [M('ORL', 'GEL')] });              // Spring
  s = step(s, {});                                     // Fall: hold in GEL
  assert.equal(s.owners.GEL, 'CAS'); assert.equal(s.phase, 'A');
  assert.deepEqual(needsOrders(s), ['CAS']);
  s = step(s, { CAS: [{ type: 'B', prov: 'ORL', unitType: 'A' }] });
  assert.equal(at(s, 'ORL'), 'CAS'); assert.equal(s.year, 2); assert.equal(scCount(s, 'CAS'), 4);
});

const { botOrders, newRelations, considerProposal } = await import('./ai.js');
t('hard bot keeps a pact even when an attack would only bounce', () => {
  const s = { ...S([['CAS', 'A', 'LOR'], ['CAS', 'A', 'GEL'], ['CAS', 'F', 'BRE'], ['SOL', 'A', 'PAL'], ['SOL', 'F', 'COV'], ['SOL', 'A', 'SEL'], ['SOL', 'A', 'SOL']]), season: 'F' };
  const rel = newRelations();
  assert.equal(considerProposal(s, 'SOL', 'CAS', { type: 'peace' }, 'hard', rel).accept, true);
  for (let i = 0; i < 8; i++) {
    const hostile = botOrders(s, 'SOL', 'hard', rel).filter(o => o.type === 'M' && unitAt(s, o.to)?.power === 'CAS');
    assert.deepEqual(hostile, [], 'Hard bot attacked its pact partner');
  }
});

console.log(`engine: ${n} tests passed`);
if (process.argv.includes('--ai')) await import('./ai-test.js');
