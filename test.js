// Run: node test.js   (engine rules + AI smoke games)
import assert from 'node:assert/strict';
import { initialState, resolveMovement, resolveRetreats, step, needsOrders, unitAt, scCount, validate } from './shared/engine.js';
import { ARMY_ADJ, FLEET_ADJ, PROVS } from './shared/map.js';

const S = (units, extra = {}) => ({ ...initialState(), units: units.map(([power, type, prov]) => ({ power, type, prov })), ...extra });
const M = (unit, to) => ({ unit, type: 'M', to });
const Sup = (unit, from, to = from) => ({ unit, type: 'S', from, to });
const C = (unit, from, to) => ({ unit, type: 'C', from, to });
const at = (s, p) => unitAt(s, p)?.power;
let n = 0;
const t = (name, fn) => { fn(); n++; };

t('map: geography the tests rely on', () => {
  for (const [a, b] of [['FLA', 'BRU'], ['AMS', 'BRU'], ['RHI', 'BRU'], ['RHI', 'AMS'], ['FLA', 'PAR'], ['NML', 'FLA'], ['CHA', 'ALS'], ['PAR', 'CHA']]) assert.ok(ARMY_ADJ[a].includes(b), `${a}-${b}`);
  assert.ok(!ARMY_ADJ.PAR.includes('BRU'), 'France meets Belgium through Flanders and Champagne');
  assert.ok(!ARMY_ADJ.LON.includes('NML') && !ARMY_ADJ.LON.includes('FLA') && !ARMY_ADJ.SIC.includes('CAL') && !ARMY_ADJ.MOR.includes('AND') && !ARMY_ADJ.DUB.includes('GLA'), 'no land bridges across water');
  assert.ok(FLEET_ADJ.CHN.includes('LON') && FLEET_ADJ.CHN.includes('NML') && FLEET_ADJ.CHN.includes('BRT'));
  assert.ok(!FLEET_ADJ.AEG.includes('WBS') && FLEET_ADJ.CON.includes('WBS') && FLEET_ADJ.CON.includes('AEG'), 'the straits run through Constantinople');
  for (const id in PROVS) for (const m of FLEET_ADJ[id]) assert.ok(FLEET_ADJ[m].includes(id), `asymmetric ${id}-${m}`);
});
t('bounce', () => {
  const r = resolveMovement(S([['FRA', 'A', 'FLA'], ['GER', 'A', 'RHI']]), { FRA: [M('FLA', 'BRU')], GER: [M('RHI', 'BRU')] });
  assert.equal(at(r, 'FLA'), 'FRA'); assert.equal(at(r, 'RHI'), 'GER'); assert.equal(at(r, 'BRU'), undefined);
});
t('supported move wins', () => {
  const r = resolveMovement(S([['FRA', 'A', 'FLA'], ['FRA', 'A', 'AMS'], ['GER', 'A', 'RHI']]), { FRA: [M('FLA', 'BRU'), Sup('AMS', 'FLA', 'BRU')], GER: [M('RHI', 'BRU')] });
  assert.equal(at(r, 'BRU'), 'FRA');
});
t('dislodge + retreat options exclude attacker origin', () => {
  const r = resolveMovement(S([['FRA', 'A', 'FLA'], ['FRA', 'A', 'AMS'], ['GER', 'A', 'BRU']]), { FRA: [M('FLA', 'BRU'), Sup('AMS', 'FLA', 'BRU')] });
  assert.equal(r.phase, 'R'); assert.equal(at(r, 'BRU'), 'FRA');
  assert.ok(!r.dislodged[0].options.includes('FLA')); assert.ok(r.dislodged[0].options.includes('RHI'));
});
t('support cut', () => {
  const r = resolveMovement(S([['FRA', 'A', 'FLA'], ['FRA', 'A', 'AMS'], ['GER', 'A', 'BRU'], ['BRI', 'F', 'DOG']]), { FRA: [M('FLA', 'BRU'), Sup('AMS', 'FLA', 'BRU')], BRI: [M('DOG', 'AMS')] });
  assert.equal(at(r, 'BRU'), 'GER');
});
t('attack from target does not cut support', () => {
  const r = resolveMovement(S([['FRA', 'A', 'FLA'], ['FRA', 'A', 'AMS'], ['GER', 'A', 'BRU']]), { FRA: [M('FLA', 'BRU'), Sup('AMS', 'FLA', 'BRU')], GER: [M('BRU', 'AMS')] });
  assert.equal(at(r, 'BRU'), 'FRA'); assert.equal(r.dislodged[0].prov, 'BRU');
});
t('head-to-head', () => {
  let r = resolveMovement(S([['FRA', 'A', 'FLA'], ['GER', 'A', 'BRU']]), { FRA: [M('FLA', 'BRU')], GER: [M('BRU', 'FLA')] });
  assert.equal(at(r, 'FLA'), 'FRA'); assert.equal(at(r, 'BRU'), 'GER');
  r = resolveMovement(S([['FRA', 'A', 'FLA'], ['FRA', 'A', 'AMS'], ['GER', 'A', 'BRU']]), { FRA: [M('FLA', 'BRU'), Sup('AMS', 'FLA', 'BRU')], GER: [M('BRU', 'FLA')] });
  assert.equal(at(r, 'BRU'), 'FRA'); assert.equal(r.dislodged[0].prov, 'BRU');
});
t('circular movement', () => {
  const r = resolveMovement(S([['FRA', 'A', 'AMS'], ['GER', 'A', 'BRU'], ['ITA', 'A', 'RHI']]), { FRA: [M('AMS', 'BRU')], GER: [M('BRU', 'RHI')], ITA: [M('RHI', 'AMS')] });
  assert.equal(at(r, 'BRU'), 'FRA'); assert.equal(at(r, 'RHI'), 'GER'); assert.equal(at(r, 'AMS'), 'ITA');
});
t('convoy', () => {
  const r = resolveMovement(S([['BRI', 'A', 'LON'], ['BRI', 'F', 'CHN']]), { BRI: [M('LON', 'NML'), C('CHN', 'LON', 'NML')] });
  assert.equal(at(r, 'NML'), 'BRI');
});
t('disrupted convoy', () => {
  const r = resolveMovement(S([['BRI', 'A', 'LON'], ['BRI', 'F', 'CHN'], ['FRA', 'F', 'BRT'], ['FRA', 'F', 'FLA']]),
    { BRI: [M('LON', 'NML'), C('CHN', 'LON', 'NML')], FRA: [M('BRT', 'CHN'), Sup('FLA', 'BRT', 'CHN')] });
  assert.equal(at(r, 'LON'), 'BRI'); assert.equal(at(r, 'CHN'), 'FRA');
});
t('no self-dislodge', () => {
  const r = resolveMovement(S([['FRA', 'A', 'FLA'], ['FRA', 'A', 'AMS'], ['FRA', 'A', 'BRU']]), { FRA: [M('FLA', 'BRU'), Sup('AMS', 'FLA', 'BRU')] });
  assert.equal(at(r, 'FLA'), 'FRA'); assert.equal(r.dislodged.length, 0);
});
t('beleaguered garrison', () => {
  const r = resolveMovement(S([['FRA', 'A', 'FLA'], ['FRA', 'A', 'AMS'], ['GER', 'A', 'RHI'], ['GER', 'F', 'CHN'], ['ITA', 'A', 'BRU']]),
    { FRA: [M('FLA', 'BRU'), Sup('AMS', 'FLA', 'BRU')], GER: [M('RHI', 'BRU'), Sup('CHN', 'RHI', 'BRU')] });
  assert.equal(at(r, 'BRU'), 'ITA');
});
t('illegal orders become holds', () => {
  const r = resolveMovement(S([['FRA', 'A', 'PAR']]), { FRA: [M('PAR', 'TUN')], GER: [M('PAR', 'BRU')] });
  assert.equal(at(r, 'PAR'), 'FRA');
});
t('armies cross water only along a chain of fleets', () => {
  const s = initialState();
  for (const to of ['FIN', 'BOS', 'NML']) assert.equal(validate(s, 'GER', M('PRU', to)), null, `PRU->${to}`);
  assert.equal(validate(S([['BRI', 'A', 'LON']]), 'BRI', M('LON', 'NML')), null, 'no fleet, no convoy');
  assert.ok(validate(S([['BRI', 'A', 'LON'], ['FRA', 'F', 'CHN']]), 'BRI', M('LON', 'NML')), 'any power\'s fleet can carry it');
});
t('retreat collision disbands both', () => {
  const s = { ...S([['FRA', 'A', 'BRU']]), phase: 'R', dislodged: [{ power: 'GER', type: 'A', prov: 'X1', options: ['RHI'] }, { power: 'ITA', type: 'A', prov: 'X2', options: ['RHI'] }] };
  const r = resolveRetreats(s, { GER: [{ unit: 'X1', type: 'R', to: 'RHI' }], ITA: [{ unit: 'X2', type: 'R', to: 'RHI' }] });
  assert.equal(at(r, 'RHI'), undefined);
});
t('fall capture -> build', () => {
  let s = initialState();
  s = step(s, { FRA: [M('PAR', 'FLA')] });               // Spring: Paris to Flanders
  s = step(s, { FRA: [M('FLA', 'BRU')] });               // Fall: into Belgium
  assert.equal(s.owners.BRU, 'FRA'); assert.equal(s.phase, 'A');
  assert.deepEqual(needsOrders(s), ['FRA']);
  s = step(s, { FRA: [{ type: 'B', prov: 'PAR', unitType: 'A' }] });
  assert.equal(at(s, 'PAR'), 'FRA'); assert.equal(s.year, 2); assert.equal(scCount(s, 'FRA'), 4);
});

t('starting territories, taken over by Fall occupation', () => {
  let s = initialState();
  assert.equal(s.control.HIG, 'BRI'); assert.equal(s.control.LON, 'BRI'); assert.equal(s.control.ALS, 'GER'); assert.equal(s.control.BRU, undefined);
  assert.equal(scCount(s, 'BRI'), 3, 'territory is not supply centres');
  s.units.push({ power: 'FRA', type: 'A', prov: 'CHA' });
  s = step(s, { FRA: [M('CHA', 'ALS')] });   // Spring
  assert.equal(s.control.ALS, 'GER');         // only Fall counts
  s = step(s, {});
  assert.equal(s.control.ALS, 'FRA'); assert.equal(scCount(s, 'FRA'), 3);
});

const { botOrders, newRelations, considerProposal } = await import('./ai.js');
t('hard bot keeps a pact even when an attack would only bounce', () => {
  const s = { ...S([['FRA', 'A', 'BRU'], ['FRA', 'A', 'FLA'], ['FRA', 'A', 'PAR'], ['GER', 'A', 'RHI'], ['GER', 'A', 'AMS'], ['GER', 'A', 'ALS'], ['GER', 'F', 'HAM']]), season: 'F' };
  const rel = newRelations();
  assert.equal(considerProposal(s, 'GER', 'FRA', { type: 'peace' }, 'hard', rel).accept, true);
  for (let i = 0; i < 8; i++) {
    const hostile = botOrders(s, 'GER', 'hard', rel).filter(o => o.type === 'M' && unitAt(s, o.to)?.power === 'FRA');
    assert.deepEqual(hostile, [], 'Hard bot attacked its pact partner');
  }
});

console.log(`engine: ${n} tests passed`);
if (process.argv.includes('--ai')) await import('./ai-test.js');
