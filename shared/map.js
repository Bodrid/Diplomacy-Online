// Original board: Europe, 1901. Real coastlines, but our own province division: each province is the land
// (or water) closest to its city/site. Adjacency is derived from that geometry, so the map the client draws
// is exactly the map the engine plays on.
export const W = 1000, H = 700;
const P = ([lon, lat]) => [(lon + 11) * 17.4, (66.6 - lat) * 22.6]; // equirectangular, lon -11..46.5, lat 35.6..66.6

export const POWERS = {
  BRI: { name: 'Britain', color: '#ff6b6b' },
  FRA: { name: 'France', color: '#4f8cff' },
  GER: { name: 'Germany', color: '#e8e8f0' },
  AUS: { name: 'Austria-Hungary', color: '#b07cff' },
  ITA: { name: 'Italy', color: '#ffb547' },
  RUS: { name: 'Russia', color: '#3ddc97' },
  OTT: { name: 'Ottomans', color: '#ff7ac6' },
};

// [id, name, lon, lat, supplyCentre, homePower, startUnit, extraSites]
const LAND = [
  // Britain & Ireland
  ['LON', 'London', 0.0, 51.5, 1, 'BRI', 'F'],
  ['MAN', 'Manchester', -2.4, 53.5, 1, 'BRI', 'A'],
  ['GLA', 'Glasgow', -4.4, 55.9, 1, 'BRI', 'F'],
  ['HIG', 'Highlands', -4.3, 57.5, 0],
  ['NEW', 'Northumbria', -1.5, 54.6, 0],
  ['WAL', 'Wales', -3.7, 52.3, 0],
  ['DEV', 'Devon', -3.9, 50.7, 0],
  ['DUB', 'Dublin', -6.5, 53.5, 1, null, null, [[-6.8, 54.6]]],
  ['COR', 'Munster', -8.7, 52.4, 0],
  // France
  ['PAR', 'Paris', 2.35, 48.85, 1, 'FRA', 'A'],
  ['LYO', 'Lyon', 4.85, 45.8, 1, 'FRA', 'A'],
  ['BOR', 'Bordeaux', -0.6, 44.8, 1, 'FRA', 'F'],
  ['BRT', 'Brittany', -2.9, 48.1, 0],
  ['NML', 'Normandy', 0.2, 49.2, 0],
  ['FLA', 'Flanders', 3.0, 50.5, 0],
  ['MAR', 'Provence', 5.7, 43.7, 0],
  ['TOU', 'Toulouse', 1.4, 43.6, 0],
  ['CSC', 'Corsica', 9.1, 42.6, 0, null, null, [[9.0, 42.0]]],
  // Germany
  ['BER', 'Berlin', 13.4, 52.5, 1, 'GER', 'A'],
  ['HAM', 'Hamburg', 10.0, 53.6, 1, 'GER', 'F'],
  ['MUN', 'Munich', 11.6, 48.2, 1, 'GER', 'A'],
  ['RHI', 'Rhineland', 6.9, 50.8, 0],
  ['ALS', 'Alsace', 7.2, 48.5, 0],
  ['FRK', 'Franconia', 10.2, 50.1, 0],
  ['SAX', 'Saxony', 13.0, 51.0, 0],
  ['POM', 'Pomerania', 15.6, 53.7, 0],
  ['MEC', 'Mecklenburg', 12.0, 53.7, 0],
  ['PRU', 'East Prussia', 20.6, 54.3, 1, 'GER', 'A'],
  ['BRS', 'Breslau', 17.1, 51.1, 0],
  // Austria-Hungary
  ['VIE', 'Vienna', 16.4, 48.2, 1, 'AUS', 'A'],
  ['BUD', 'Budapest', 19.1, 47.4, 1, 'AUS', 'A'],
  ['FIU', 'Fiume', 14.6, 45.4, 1, 'AUS', 'F'],
  ['PRG', 'Bohemia', 14.4, 49.9, 0],
  ['SLZ', 'Salzburg', 12.3, 47.0, 0],
  ['LEM', 'Lemberg', 22.2, 49.9, 1, 'AUS', 'A'],
  ['TRA', 'Transylvania', 24.0, 46.6, 0],
  ['BOS', 'Bosnia', 17.8, 44.0, 0],
  // Italy
  ['ROM', 'Rome', 12.6, 42.0, 1, 'ITA', 'A'],
  ['MIL', 'Milan', 9.4, 45.6, 1, 'ITA', 'A'],
  ['NAP', 'Naples', 14.6, 40.9, 1, 'ITA', 'F'],
  ['GEN', 'Genoa', 8.4, 44.6, 0],
  ['VEN', 'Venice', 12.0, 45.6, 0],
  ['FLO', 'Tuscany', 11.2, 43.5, 0],
  ['BAR', 'Apulia', 16.6, 40.9, 0],
  ['CAL', 'Calabria', 16.3, 39.0, 0, null, null, [[15.9, 38.1]]],
  ['SIC', 'Sicily', 14.1, 37.6, 1, null, null, [[15.35, 38.1]]],
  ['SAR', 'Sardinia', 9.0, 40.7, 0, null, null, [[8.9, 39.4]]],
  // Russia
  ['STP', 'St. Petersburg', 30.3, 59.9, 1, 'RUS', 'F'],
  ['MOS', 'Moscow', 37.6, 55.75, 1, 'RUS', 'A'],
  ['WAR', 'Warsaw', 21.0, 52.2, 1, 'RUS', 'A'],
  ['ODE', 'Odessa', 30.7, 46.6, 1, 'RUS', 'F'],
  ['FIN', 'Finland', 25.5, 61.6, 0],
  ['LAP', 'Lapland', 22.5, 66.1, 0],
  ['KRL', 'Karelia', 33.0, 63.0, 0],
  ['VOL', 'Vologda', 40.5, 60.5, 0],
  ['NOV', 'Novgorod', 31.3, 58.3, 0],
  ['NIZ', 'Nizhny', 44.0, 56.0, 0],
  ['RIG', 'Livonia', 25.0, 57.6, 0],
  ['LIT', 'Lithuania', 25.3, 54.8, 0],
  ['MIN', 'Minsk', 28.0, 53.5, 0],
  ['SMO', 'Smolensk', 32.5, 54.9, 0],
  ['KIE', 'Kiev', 30.5, 50.4, 0],
  ['KHR', 'Kharkov', 36.3, 50.1, 0],
  ['VLG', 'Volga', 44.3, 50.0, 0],
  ['DON', 'Don', 40.0, 47.3, 0],
  ['CRI', 'Crimea', 34.2, 45.2, 0],
  ['CAU', 'Caucasus', 43.8, 43.4, 0],
  // Ottomans
  ['CON', 'Constantinople', 27.9, 41.1, 1, 'OTT', 'F'],
  ['SMY', 'Smyrna', 27.6, 38.6, 1, 'OTT', 'A'],
  ['SAL', 'Salonika', 22.9, 40.8, 1, 'OTT', 'A'],
  ['BUS', 'Bursa', 29.8, 39.9, 0],
  ['ANK', 'Ankara', 33.0, 40.3, 0],
  ['KON', 'Konya', 32.5, 37.9, 0],
  ['ADA', 'Adana', 35.6, 37.4, 0],
  ['TRE', 'Trebizond', 38.6, 40.4, 0],
  ['ERZ', 'Armenia', 42.0, 39.9, 0],
  ['ALB', 'Albania', 20.0, 41.2, 0],
  // Neutral lands
  ['MAD', 'Madrid', -3.7, 40.4, 1],
  ['LIS', 'Lisbon', -8.6, 39.0, 1],
  ['BCN', 'Barcelona', 1.6, 41.8, 0],
  ['AND', 'Andalusia', -5.0, 37.6, 0, null, null, [[-5.5, 36.3], [-3.0, 37.2]]],
  ['LEO', 'León', -6.3, 42.6, 0],
  ['OPO', 'Porto', -8.2, 41.3, 0],
  ['VAL', 'Valencia', -0.8, 39.0, 0],
  ['BIL', 'Basque Lands', -2.4, 42.9, 0],
  ['AMS', 'Holland', 5.6, 52.3, 1],
  ['BRU', 'Belgium', 4.5, 50.7, 1],
  ['DEN', 'Denmark', 9.2, 56.1, 1, null, null, [[11.75, 55.45], [10.2, 55.25]]],
  ['OSL', 'Christiania', 10.4, 60.2, 1],
  ['BRG', 'Bergen', 6.5, 61.0, 0],
  ['AGD', 'Agder', 7.8, 58.6, 0],
  ['TRD', 'Trondheim', 11.5, 63.8, 0],
  ['STO', 'Stockholm', 16.8, 59.6, 1],
  ['GOT', 'Götaland', 14.2, 57.3, 0, null, null, [[13.5, 55.9]]],
  ['NRL', 'Norrland', 16.6, 63.4, 0],
  ['SWI', 'Switzerland', 8.2, 46.8, 0],
  ['BEL', 'Serbia', 20.9, 44.0, 1],
  ['BUC', 'Romania', 25.8, 44.7, 1],
  ['MOL', 'Moldavia', 27.3, 47.1, 0],
  ['SOF', 'Bulgaria', 25.6, 42.8, 1],
  ['ATH', 'Greece', 22.4, 38.2, 1],
  ['EPI', 'Thessaly', 21.6, 39.6, 0],
  ['TUN', 'Tunis', 9.7, 36.2, 1],
  ['ALG', 'Algiers', 3.0, 36.2, 0],
  ['MOR', 'Morocco', -4.5, 35.5, 0, null, null, [[-5.6, 35.65]]],
];
// Impassable land (drawn, not played): the Levant, Mesopotamia, Persia.
const VOID = [[38.0, 36.0], [42.5, 36.6], [46.2, 38.6]];

// [id, name, lon, lat, extraSites]
const SEA = [
  ['NAT', 'North Atlantic', -9.5, 57.5, [[-10.5, 60.5], [-10.5, 54.5]]],
  ['NWG', 'Norwegian Sea', 2.0, 64.0, [[-6.0, 63.5], [8.0, 66.0]]],
  ['NNS', 'North Sea', 2.5, 58.5, [[-1.0, 56.8]]],
  ['DOG', 'Dogger Bank', 3.5, 54.5, [[0.8, 54.0], [7.0, 55.5]]],
  ['KAT', 'Kattegat', 11.3, 57.3],
  ['BAL', 'Baltic Sea', 17.0, 55.5, [[20.0, 57.2]]],
  ['BOT', 'Gulf of Bothnia', 20.0, 62.0, [[22.6, 64.8]]],
  ['GOF', 'Gulf of Finland', 26.5, 59.85],
  ['IRI', 'Irish Sea', -5.0, 53.7],
  ['CHN', 'The Channel', -2.0, 50.0, [[0.8, 50.4]]],
  ['CEL', 'Celtic Sea', -7.5, 50.5, [[-4.5, 51.35]]],
  ['BIS', 'Bay of Biscay', -4.5, 45.5, [[-8.5, 46.5]]],
  ['LUS', 'Lusitanian Sea', -10.5, 41.0, [[-10.0, 37.5], [-7.2, 36.5]]],
  ['ALN', 'Alboran Sea', -3.5, 36.2],
  ['BLR', 'Balearic Sea', 2.5, 40.0],
  ['LYN', 'Gulf of Lion', 4.5, 42.6],
  ['AGS', 'Algerian Sea', 5.0, 38.0, [[7.0, 40.0]]],
  ['LIG', 'Ligurian Sea', 8.0, 43.4],
  ['TYS', 'Tyrrhenian Sea', 12.0, 40.0, [[10.5, 41.2]]],
  ['STR', 'Strait of Sicily', 12.2, 36.6],
  ['ION', 'Ionian Sea', 18.0, 38.0, [[20.0, 36.2], [17.3, 39.6]]],
  ['ADR', 'Adriatic Sea', 15.0, 43.0, [[13.0, 44.6], [18.0, 41.7]]],
  ['AEG', 'Aegean Sea', 25.0, 39.0],
  ['CRT', 'Cretan Sea', 25.0, 36.1],
  ['LEV', 'Levantine Sea', 31.5, 35.9],
  ['MRM', 'Sea of Marmara', 28.3, 40.75],
  ['WBS', 'West Black Sea', 30.5, 43.3, [[28.9, 41.7]]],
  ['EBS', 'East Black Sea', 36.5, 43.0, [[37.0, 46.3]]],
];

// Simplified coastlines [lon, lat]. Even-odd: the Black Sea is a hole in the mainland.
const COASTLINES = [
  [ // Mainland Europe, Scandinavia, Russia, Anatolia (traced from Gibraltar, clockwise round the north)
    [-5.6, 36.0], [-6.3, 36.5], [-7.4, 37.2], [-8.0, 37.0], [-8.95, 37.0], [-8.8, 38.0], [-9.2, 38.6], [-9.5, 38.8], [-8.9, 40.2], [-8.7, 41.2],
    [-8.9, 42.2], [-9.3, 42.9], [-8.4, 43.4], [-7.7, 43.75], [-5.8, 43.6], [-3.8, 43.45], [-1.8, 43.4], [-1.45, 43.6], [-1.2, 44.6], [-1.15, 45.6],
    [-1.8, 46.5], [-2.2, 47.2], [-3.0, 47.5], [-4.4, 47.8], [-4.8, 48.4], [-3.5, 48.85], [-2.0, 48.65], [-1.6, 48.7], [-1.9, 49.7], [-1.25, 49.65],
    [-0.2, 49.3], [0.1, 49.5], [1.1, 49.9], [1.6, 50.7], [1.85, 50.95], [2.5, 51.1], [3.2, 51.35], [3.6, 51.45], [4.1, 51.95], [4.6, 52.45],
    [4.75, 52.95], [5.4, 53.25], [6.0, 53.45], [7.2, 53.35], [8.1, 53.55], [8.7, 53.85], [8.9, 54.4], [8.6, 55.0], [8.1, 55.5], [8.1, 56.5],
    [8.6, 57.1], [10.6, 57.75], [10.5, 57.0], [10.9, 56.4], [10.2, 56.0], [9.8, 55.5], [9.9, 54.85], [10.2, 54.4], [11.0, 54.0], [12.1, 54.2],
    [13.4, 54.6], [14.2, 53.9], [16.0, 54.25], [17.6, 54.75], [18.5, 54.75], [18.7, 54.4], [19.6, 54.45], [20.0, 54.9], [21.1, 55.3], [21.1, 55.75],
    [21.0, 56.6], [21.6, 57.4], [22.6, 57.75], [23.6, 57.0], [24.1, 57.05], [24.4, 58.4], [23.5, 58.6], [23.5, 59.2], [24.7, 59.45], [26.5, 59.55],
    [28.0, 59.45], [29.9, 59.9], [30.3, 59.95], [29.9, 60.15], [28.7, 60.7], [27.0, 60.5], [25.0, 60.15], [23.0, 59.85], [22.0, 60.4], [21.4, 61.1],
    [21.5, 61.8], [21.2, 62.4], [21.6, 63.1], [22.8, 63.9], [24.5, 64.8], [25.4, 65.0], [24.6, 65.6], [24.15, 65.85], [22.2, 65.6], [21.2, 64.75],
    [20.3, 63.8], [18.6, 63.2], [17.4, 62.4], [17.2, 61.6], [17.2, 60.7], [18.6, 60.2], [19.0, 59.7], [18.4, 59.3], [17.0, 58.7], [16.6, 57.8],
    [16.4, 56.7], [15.6, 56.15], [14.3, 55.95], [14.2, 55.45], [12.9, 55.4], [12.95, 55.6], [12.8, 56.1], [12.85, 56.65], [12.0, 57.7], [11.4, 58.3],
    [11.1, 59.0], [10.6, 59.4], [10.75, 59.85], [10.4, 59.3], [9.6, 59.0], [8.8, 58.45], [8.0, 58.1], [7.0, 58.0], [6.0, 58.4], [5.6, 58.9],
    [5.3, 59.4], [5.0, 60.4], [4.9, 61.2], [5.3, 62.3], [7.0, 62.8], [8.6, 63.5], [10.4, 64.2], [11.5, 64.9], [12.5, 65.9], [13.2, 66.6],
    [13.6, 67.6], [47.5, 67.6], [47.5, 35.0], [36.0, 35.0], [35.8, 35.55], [35.95, 36.3], [36.15, 36.6], [35.0, 36.75], [34.6, 36.8], [33.9, 36.3],
    [32.8, 36.05], [32.0, 36.55], [30.7, 36.85], [29.6, 36.2], [29.1, 36.6], [28.2, 36.75], [27.4, 37.0], [27.25, 37.85], [27.0, 38.4], [26.3, 38.3],
    [26.7, 38.8], [26.7, 39.3], [26.9, 39.55], [26.45, 40.0], [26.8, 40.3], [27.5, 40.4], [28.9, 40.45], [29.1, 40.7], [28.9, 40.95],
    [28.0, 40.95], [27.5, 40.97], [26.9, 40.6], [26.6, 40.42], [26.15, 40.08], [26.0, 40.6], [25.9, 40.85], [24.4, 40.94], [23.9, 40.7], [23.75, 40.2],
    [23.4, 39.95], [22.95, 40.6], [22.6, 40.4], [22.6, 39.9], [22.9, 39.4], [23.1, 39.0], [23.6, 38.6], [24.5, 38.15], [24.0, 37.65], [23.6, 37.94],
    [23.15, 37.85], [23.2, 37.4], [23.2, 36.45], [22.48, 36.38], [21.9, 36.8], [21.7, 37.0], [21.6, 37.4], [21.3, 37.65], [21.4, 38.35], [20.75, 38.95],
    [20.2, 39.5], [20.0, 39.7], [19.4, 40.4], [19.45, 41.32], [19.4, 41.85], [18.9, 42.3], [18.1, 42.65], [16.45, 43.5], [15.2, 44.1], [14.45, 45.3],
    [13.9, 44.8], [13.5, 45.5], [13.75, 45.65], [13.1, 45.75], [12.35, 45.45], [12.5, 44.95], [12.3, 44.4], [12.55, 44.05], [13.5, 43.6], [14.2, 42.45],
    [16.1, 41.9], [16.85, 41.12], [17.95, 40.65], [18.5, 40.15], [18.35, 39.8], [17.2, 40.45], [16.6, 40.1], [16.6, 39.4], [17.1, 39.05], [16.5, 38.4],
    [16.0, 37.95], [15.72, 37.93], [15.75, 38.3], [16.1, 38.9], [15.75, 39.8], [14.75, 40.65], [14.2, 40.8], [13.55, 41.2], [12.6, 41.45], [12.3, 41.75],
    [11.8, 42.1], [10.5, 42.95], [10.3, 43.55], [9.85, 44.1], [8.95, 44.4], [8.45, 44.3], [7.75, 43.8], [7.25, 43.7], [5.9, 43.1], [5.35, 43.3],
    [4.6, 43.4], [3.7, 43.4], [3.1, 42.9], [3.3, 42.3], [2.15, 41.38], [1.25, 41.1], [0.85, 40.7], [0.0, 39.95], [-0.35, 39.45], [0.2, 38.75],
    [-0.5, 38.35], [-1.0, 37.6], [-2.2, 36.75], [-2.45, 36.85], [-4.4, 36.7], [-5.35, 36.15],
  ],
  [ // Black Sea and Sea of Azov (hole)
    [29.25, 41.3], [29.6, 41.2], [31.4, 41.3], [32.6, 41.85], [33.8, 42.0], [35.15, 42.05], [36.3, 41.4], [37.5, 41.1], [39.7, 41.0], [41.6, 41.6],
    [41.7, 42.2], [41.0, 43.0], [39.7, 43.6], [37.8, 44.7], [36.75, 45.2], [37.3, 45.4], [38.3, 46.1], [38.9, 47.2], [37.5, 47.05], [36.8, 46.75],
    [35.4, 46.45], [34.8, 46.2], [35.4, 45.45], [36.0, 45.45], [36.5, 45.25], [35.4, 45.0], [34.2, 44.45], [33.5, 44.6], [33.35, 45.2], [33.6, 46.0],
    [32.6, 46.1], [31.5, 46.6], [30.75, 46.45], [30.2, 46.0], [29.7, 45.2], [28.65, 44.15], [27.95, 43.2], [27.5, 42.5], [28.0, 41.65], [28.9, 41.35],
  ],
  [ // North Africa
    [-11, 33], [-6.0, 35.5], [-5.8, 35.78], [-5.3, 35.9], [-5.2, 35.6], [-3.9, 35.25], [-2.95, 35.3], [-0.65, 35.7], [0.1, 35.95], [1.3, 36.5],
    [3.05, 36.78], [3.9, 36.9], [5.1, 36.75], [5.8, 36.82], [6.9, 36.88], [7.75, 36.9], [8.75, 36.95], [9.87, 37.27], [10.3, 36.85], [11.05, 37.08],
    [10.6, 36.4], [10.64, 35.83], [11.07, 35.5], [11.0, 33.0],
  ],
  [ // Great Britain
    [1.4, 51.15], [1.45, 51.35], [0.9, 51.5], [1.3, 51.9], [1.75, 52.5], [1.3, 52.95], [0.3, 52.85], [0.35, 53.5], [0.1, 53.6], [-0.1, 54.1],
    [-0.6, 54.5], [-1.15, 54.65], [-1.4, 55.0], [-2.0, 55.75], [-2.5, 56.0], [-2.6, 56.3], [-2.5, 56.6], [-2.05, 57.15], [-1.8, 57.5], [-2.0, 57.7],
    [-3.0, 57.65], [-4.0, 57.6], [-3.5, 57.9], [-3.0, 58.4], [-3.1, 58.65], [-5.0, 58.6], [-5.3, 58.2], [-5.7, 57.5], [-5.7, 56.9], [-6.2, 56.3],
    [-5.6, 56.0], [-5.6, 55.3], [-4.85, 55.85], [-4.65, 55.45], [-5.15, 54.85], [-4.4, 54.7], [-3.3, 54.9], [-3.5, 54.4], [-3.0, 54.05], [-3.05, 53.45],
    [-3.4, 53.35], [-4.6, 53.3], [-4.75, 52.8], [-4.2, 52.4], [-4.6, 52.1], [-5.25, 51.75], [-4.2, 51.6], [-3.2, 51.45], [-2.7, 51.5], [-3.4, 51.2],
    [-4.5, 51.0], [-5.1, 50.5], [-5.7, 50.05], [-5.2, 50.0], [-4.15, 50.35], [-3.65, 50.2], [-3.4, 50.6], [-2.45, 50.55], [-1.4, 50.8], [-0.15, 50.8],
    [0.25, 50.75], [0.95, 50.9],
  ],
  [ // Ireland
    [-6.15, 53.35], [-6.0, 52.95], [-6.35, 52.2], [-7.0, 52.15], [-8.3, 51.8], [-9.8, 51.45], [-10.3, 51.95], [-9.9, 52.6], [-9.4, 53.0], [-9.05, 53.25],
    [-10.1, 53.5], [-9.9, 54.2], [-8.5, 54.3], [-8.7, 54.8], [-7.35, 55.4], [-6.2, 55.2], [-5.9, 54.65], [-5.5, 54.4], [-6.3, 54.0],
  ],
  [[10.95, 55.7], [11.1, 55.25], [12.1, 55.0], [12.6, 55.5], [12.45, 56.0], [11.8, 55.95]], // Zealand
  [[9.75, 55.5], [10.5, 55.45], [10.8, 55.1], [10.2, 54.95], [9.7, 55.15]], // Funen
  [[9.4, 43.0], [9.55, 42.6], [9.4, 41.4], [9.15, 41.4], [8.6, 41.9], [8.6, 42.35], [9.3, 42.7]], // Corsica
  [[9.25, 41.25], [9.8, 40.9], [9.65, 40.0], [9.6, 39.15], [9.0, 39.0], [8.4, 38.95], [8.4, 39.9], [8.15, 40.6], [8.3, 41.1], [8.9, 40.95]], // Sardinia
  [[12.4, 38.1], [13.3, 38.2], [14.5, 38.05], [15.55, 38.27], [15.1, 37.3], [15.25, 36.7], [14.4, 36.75], [12.6, 37.6]], // Sicily
].map(poly => poly.map(P));

// ---------- Geometry ----------
const site = (prov, ll) => { const [x, y] = P(ll); return { prov, x, y }; };
const landSites = [], seaSites = [];
export const PROVS = {};
for (const [id, name, lon, lat, sc, home, unit, extra = []] of LAND) {
  const [x, y] = P([lon, lat]);
  PROVS[id] = { id, name, land: true, x, y, sc: !!sc, home: home || null, unit: unit || null };
  for (const ll of [[lon, lat], ...extra]) landSites.push(site(id, ll));
}
for (const ll of VOID) landSites.push(site(null, ll));
for (const [id, name, lon, lat, extra = []] of SEA) {
  const [x, y] = P([lon, lat]);
  PROVS[id] = { id, name, land: false, x, y, sc: false, home: null, unit: null };
  for (const ll of [[lon, lat], ...extra]) seaSites.push(site(id, ll));
}
export const IDS = Object.keys(PROVS);
export const SC_COUNT = IDS.filter(i => PROVS[i].sc).length;
export const WIN = Math.floor(SC_COUNT / 2) + 1;

// Clip polygon to the half-plane closer to a than b (Sutherland–Hodgman on the bisector).
function clipHalf(poly, a, b) {
  const nx = b.x - a.x, ny = b.y - a.y, c = (b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y) / 2;
  const inside = p => p[0] * nx + p[1] * ny <= c, out = [];
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
const voronoi = sites => sites.map(a => sites.reduce((poly, b) => (b === a ? poly : clipHalf(poly, a, b)), [[0, 0], [W, 0], [W, H], [0, H]]));
const area = poly => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
// Clip any polygon (e.g. a coastline) by a convex one.
function clipConvex(subject, conv) {
  const sg = Math.sign(area(conv));
  let out = subject;
  for (let i = 0; i < conv.length && out.length; i++) {
    const a = conv[i], b = conv[(i + 1) % conv.length], inp = out;
    const d = p => sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], dp = d(p), dq = d(q);
      if (dp >= 0) out.push(p);
      if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
  }
  return out;
}
function inLand(x, y) {
  let c = false;
  for (const poly of COASTLINES) for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const nearest = (sites, x, y) => { let best = null, bd = Infinity; for (const s of sites) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = s; } } return best; };
const fmt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const pathOf = poly => `M${poly.map(fmt).join('L')}Z`;

const landCells = voronoi(landSites), seaCells = voronoi(seaSites);

// Province outlines for drawing (land = its cells cut to the coastline; sea = its cells, drawn under the land).
export const SHAPES = Object.fromEntries(IDS.map(id => [id, '']));
let voidD = '';
landCells.forEach((cell, i) => {
  const d = COASTLINES.map(c => clipConvex(c, cell)).filter(p => p.length > 2 && Math.abs(area(p)) > 0.5).map(pathOf).join('');
  if (landSites[i].prov) SHAPES[landSites[i].prov] += d; else voidD += d;
});
seaCells.forEach((cell, i) => { SHAPES[seaSites[i].prov] += pathOf(cell); });
export const VOID_D = voidD;
export const COAST_D = COASTLINES.map(pathOf).join('');

const adjSet = Object.fromEntries(IDS.map(id => [id, { army: new Set(), fleet: new Set() }]));
const link = (a, b, kind) => { if (a && b && a !== b) { adjSet[a][kind].add(b); adjSet[b][kind].add(a); } };
const near = (p, q) => Math.abs(p[0] - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5;

// Borders between different provinces: land borders count only where they cross land, sea borders only over water.
const borderD = { land: '', sea: '' };
function borders(cells, sites, onLand) {
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = sites[i].prov, b = sites[j].prov;
    if (a === b) continue;
    const s = cells[i].filter(p => cells[j].some(q => near(p, q)));
    if (s.length < 2) continue;
    const [p, q] = s, len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(2, Math.ceil(len / 2));
    let run = null, total = 0;
    for (let k = 0; k <= n; k++) {
      const x = p[0] + ((q[0] - p[0]) * k) / n, y = p[1] + ((q[1] - p[1]) * k) / n, ok = inLand(x, y) === onLand;
      if (ok && !run) run = [x, y];
      if ((!ok || k === n) && run) {
        const e = ok ? [x, y] : [p[0] + ((q[0] - p[0]) * (k - 1)) / n, p[1] + ((q[1] - p[1]) * (k - 1)) / n];
        const l = Math.hypot(e[0] - run[0], e[1] - run[1]);
        if (a && b && l > 0) borderD[onLand ? 'land' : 'sea'] += `M${fmt(run)}L${fmt(e)}`;
        total += l; run = null;
      }
    }
    if (total > (onLand ? 6 : 3)) link(a, b, onLand ? 'army' : 'fleet'); // seas meet through narrow straits
  }
}
borders(landCells, landSites, true);
borders(seaCells, seaSites, false);
export const BORDERS = borderD;

// Walk every coastline: which land and sea province meet there, and where land borders reach the sea.
const coastHits = {};
for (const poly of COASTLINES) {
  let prev = null;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2));
    for (let k = 0; k < n; k++) {
      const x = p[0] + ((q[0] - p[0]) * k) / n, y = p[1] + ((q[1] - p[1]) * k) / n;
      if (x < 0 || y < 0 || x > W || y > H) { prev = null; continue; }
      const L = nearest(landSites, x, y).prov, S = nearest(seaSites, x, y).prov;
      if (L) { const key = L + '|' + S; coastHits[key] = (coastHits[key] || 0) + 1; }
      if (L && prev && L !== prev) link(L, prev, 'fleet');
      prev = L;
    }
  }
}
for (const key in coastHits) if (coastHits[key] >= 3) { const [L, S] = key.split('|'); link(L, S, 'fleet'); }

export const ARMY_ADJ = {}, FLEET_ADJ = {}, ADJ = {};
for (const id of IDS) {
  ARMY_ADJ[id] = PROVS[id].land ? [...adjSet[id].army] : [];
  FLEET_ADJ[id] = [...adjSet[id].fleet];
  ADJ[id] = [...new Set([...ARMY_ADJ[id], ...FLEET_ADJ[id]])];
  PROVS[id].coast = PROVS[id].land && FLEET_ADJ[id].some(n => !PROVS[n].land);
}
// Coast-to-coast fleet moves only between coastal land provinces that also share a land border.
for (const id of IDS) if (PROVS[id].land) FLEET_ADJ[id] = FLEET_ADJ[id].filter(n => !PROVS[n].land ? true : PROVS[id].coast && PROVS[n].coast && ARMY_ADJ[id].includes(n));

export const canMove = (type, from, to) => (type === 'A' ? ARMY_ADJ : FLEET_ADJ)[from].includes(to);
