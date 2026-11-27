// Original board: the continent of Aurel. Province shapes are Voronoi cells of these sites,
// so adjacency is derived from geometry and the client draws exactly what the engine uses.
export const W = 1000, H = 700;

export const POWERS = {
  VAL: { name: 'Valdris', color: '#4f8cff' },
  CAS: { name: 'Castellane', color: '#ff6b6b' },
  SOL: { name: 'Solenne', color: '#ffb547' },
  MOR: { name: 'Morvaine', color: '#b07cff' },
  KHA: { name: 'Kharzad', color: '#e8e8f0' },
  OST: { name: 'Ostrava', color: '#3ddc97' },
  TAV: { name: 'Tavros', color: '#ff7ac6' },
};

// [id, name, land?, x, y, sc?, homePower?, startUnit?]
const RAW = [
  // Valdris (island)
  ['VAL', 'Valhurst', 1, 165, 125, 1, 'VAL', 'F'],
  ['HAR', 'Harrowgate', 1, 235, 200, 1, 'VAL', 'F'],
  ['KEL', 'Kelmoor', 1, 140, 250, 1, 'VAL', 'A'],
  // Castellane
  ['BRE', 'Brenmoor', 1, 395, 205, 1, 'CAS', 'F'],
  ['CAS', 'Castell', 1, 370, 330, 1, 'CAS', 'A'],
  ['ORL', 'Orlin', 1, 465, 270, 1, 'CAS', 'A'],
  // Solenne
  ['SOL', 'Solenne', 1, 420, 545, 1, 'SOL', 'A'],
  ['ARC', 'Arcena', 1, 405, 635, 1, 'SOL', 'F'],
  ['VER', 'Veradis', 1, 470, 480, 1, 'SOL', 'A'],
  // Morvaine
  ['MOR', 'Morvay', 1, 605, 250, 1, 'MOR', 'A'],
  ['LUM', 'Lumen', 1, 560, 150, 1, 'MOR', 'F'],
  ['TAL', 'Talvik', 1, 665, 165, 1, 'MOR', 'A'],
  // Kharzad
  ['KHA', 'Kharzad', 1, 850, 215, 1, 'KHA', 'A'],
  ['IRG', 'Irgal', 1, 765, 125, 1, 'KHA', 'F'],
  ['VOS', 'Vostrel', 1, 905, 300, 1, 'KHA', 'A'],
  // Ostrava
  ['OST', 'Ostrava', 1, 770, 325, 1, 'OST', 'A'],
  ['ZEM', 'Zemlin', 1, 695, 420, 1, 'OST', 'F'],
  ['RIV', 'Riven', 1, 625, 405, 1, 'OST', 'A'],
  // Tavros
  ['TAV', 'Tavros', 1, 870, 575, 1, 'TAV', 'F'],
  ['ESK', 'Eskar', 1, 790, 510, 1, 'TAV', 'A'],
  ['HAL', 'Halvar', 1, 920, 445, 1, 'TAV', 'A'],
  // Neutral supply centres
  ['SKA', 'Skarn', 1, 320, 40, 1],
  ['COV', 'Corvant', 1, 285, 575, 1],
  ['PAL', 'Palvers', 1, 345, 445, 1],
  ['HLD', 'Halden', 1, 475, 160, 1],
  ['GEL', 'Gelderan', 1, 545, 345, 1],
  ['DRA', 'Draven', 1, 670, 315, 1],
  ['BRK', 'Brask', 1, 760, 230, 1],
  ['NRN', 'Norrin', 1, 875, 110, 1],
  ['ASH', 'Ashmark', 1, 965, 190, 1],
  ['MIR', 'Mira', 1, 630, 575, 1],
  ['LOR', 'Lorne', 1, 445, 385, 1],
  ['BRN', 'Branok', 1, 825, 410, 1],
  // Neutral land, no centre
  ['KSH', 'Kesh', 1, 965, 545, 0],
  ['TRN', 'Tarn Isle', 1, 75, 505, 0],
  // Buffers so no two powers start with touching home centres
  ['VEL', 'Vellmark', 1, 535, 250, 0],
  ['FEN', 'Fenmark', 1, 715, 140, 0],
  ['SAL', 'Saldor', 1, 830, 280, 0],
  ['MRW', 'Morrow', 1, 745, 465, 0],
  ['IVL', 'Ivel', 1, 900, 380, 0],
  ['SEL', 'Selm', 1, 550, 435, 0],
  // Seas
  ['NWO', 'Frost Deep', 0, 45, 130],
  ['NRC', 'Northern Reach', 0, 205, 35],
  ['NAR', 'The Narrows', 0, 315, 240],
  ['TSD', 'Tarn Deep', 0, 70, 645],
  ['ARD', 'Arcen Deep', 0, 410, 698],
  ['SCA', 'Scald Sea', 0, 830, 692],
  ['IRB', 'Irgal Bight', 0, 790, 30],
  ['WOC', 'Western Ocean', 0, 40, 345],
  ['GRY', 'Grey Strait', 0, 300, 140],
  ['MIS', 'Mist Channel', 0, 255, 320],
  ['NSE', 'Pale Sea', 0, 420, 55],
  ['NOR', 'Boreal Sea', 0, 640, 50],
  ['NEA', 'Ice Sea', 0, 960, 30],
  ['DAW', 'Dawn Sea', 0, 990, 365],
  ['ESE', 'Ember Sea', 0, 960, 665],
  ['SOC', 'Southern Ocean', 0, 650, 670],
  ['SWO', 'Coral Sea', 0, 200, 660],
  ['COB', 'Cobalt Gulf', 0, 225, 455],
  ['SAP', 'Sapphire Sea', 0, 630, 480],
  ['LYR', 'Gulf of Lyr', 0, 530, 590],
  ['EMB', 'Ember Gulf', 0, 735, 590],
];

export const PROVS = {};
for (const [id, name, land, x, y, sc, home, unit] of RAW)
  PROVS[id] = { id, name, land: !!land, x, y, sc: !!sc, home: home || null, unit: unit || null };
export const IDS = Object.keys(PROVS);
export const SC_COUNT = IDS.filter(i => PROVS[i].sc).length;
export const WIN = Math.floor(SC_COUNT / 2) + 1;

// Clip polygon to the half-plane closer to a than b (Sutherland–Hodgman on the bisector).
function clip(poly, a, b) {
  const nx = b.x - a.x, ny = b.y - a.y, c = (b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y) / 2;
  const inside = p => p[0] * nx + p[1] * ny <= c;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], pin = inside(p), qin = inside(q);
    if (pin) out.push(p);
    if (pin !== qin) {
      const t = (c - p[0] * nx - p[1] * ny) / ((q[0] - p[0]) * nx + (q[1] - p[1]) * ny);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

export const CELLS = {};
for (const a of IDS) {
  let poly = [[0, 0], [W, 0], [W, H], [0, H]];
  for (const b of IDS) if (a !== b) poly = clip(poly, PROVS[a], PROVS[b]);
  CELLS[a] = poly;
}

const near = (p, q) => Math.abs(p[0] - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5;
const onBorder = p => p[0] < 0.5 || p[1] < 0.5 || p[0] > W - 0.5 || p[1] > H - 0.5;
// Shared border of two cells = the vertices they have in common.
function shared(a, b) { return CELLS[a].filter(p => CELLS[b].some(q => near(p, q))); }

export const ADJ = {}; // any shared border (armies use land-land, fleets see FLEET_ADJ)
export const FLEET_ADJ = {};
for (const a of IDS) { ADJ[a] = []; FLEET_ADJ[a] = []; }
for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) {
  const a = IDS[i], b = IDS[j], s = shared(a, b);
  if (s.length < 2 || Math.hypot(s[0][0] - s[1][0], s[0][1] - s[1][1]) < 6) continue;
  ADJ[a].push(b); ADJ[b].push(a);
  const la = PROVS[a].land, lb = PROVS[b].land;
  // Fleets: sea-sea, sea-coast, or coast-coast when the shared border reaches the sea.
  const coastal = !la || !lb || s.some(p => !onBorder(p) && IDS.some(k => !PROVS[k].land && CELLS[k].some(q => near(p, q))));
  if (coastal) { FLEET_ADJ[a].push(b); FLEET_ADJ[b].push(a); }
}
for (const id of IDS) PROVS[id].coast = PROVS[id].land && ADJ[id].some(n => !PROVS[n].land);

export const ARMY_ADJ = {};
for (const id of IDS) ARMY_ADJ[id] = PROVS[id].land ? ADJ[id].filter(n => PROVS[n].land) : [];

export const canMove = (type, from, to) => (type === 'A' ? ARMY_ADJ : FLEET_ADJ)[from].includes(to);
