// Bundled catalogue of makes and models sold in Europe, grouped by body type.
// It answers searches instantly and offline; the NHTSA lookup below only fills gaps.
const source = {
  'Abarth': 'hatchback: 500, 595, 695, Punto | convertible: 124 Spider',
  'Alfa Romeo': 'hatchback: MiTo, Giulietta, 147 | saloon: Giulia, 159, 156 | suv: Stelvio, Tonale, Junior | coupe: 4C, Brera, GT | convertible: Spider',
  'Alpine': 'coupe: A110 | hatchback: A290',
  'Aston Martin': 'coupe: Vantage, DB9, DB11, DB12, DBS | suv: DBX | saloon: Rapide',
  'Audi': 'hatchback: A1, A2, A3, S3, RS3 | saloon: A4, A5, A6, A8, S4, S6, S8, RS4, RS6, e-tron GT | estate: A4 Avant, A6 Avant, A4 allroad, A6 allroad, RS4 Avant, RS6 Avant | suv: Q2, Q3, Q4 e-tron, Q5, Q6 e-tron, Q7, Q8, Q8 e-tron, e-tron, SQ5, SQ7 | coupe: A7, TT, R8, S5 | convertible: A3 Cabriolet, A5 Cabriolet, TT Roadster',
  'Bentley': 'coupe: Continental GT | saloon: Flying Spur, Mulsanne | suv: Bentayga',
  'BMW': 'hatchback: 1 Series, 2 Series Active Tourer, i3 | saloon: 2 Series Gran Coupe, 3 Series, 5 Series, 7 Series, i4, i5, i7, M3, M5 | estate: 3 Series Touring, 5 Series Touring | suv: X1, X2, X3, X4, X5, X6, X7, iX, iX1, iX2, iX3, XM | coupe: 2 Series, 4 Series, 6 Series, 8 Series, M2, M4 | convertible: Z4, 4 Series Convertible | mpv: 2 Series Gran Tourer',
  'BYD': 'hatchback: Dolphin | saloon: Seal, Han | suv: Atto 3, Seal U, Tang, Sealion 7',
  'Cadillac': 'saloon: CT4, CT5, CTS | suv: XT4, XT5, Escalade, Lyriq',
  'Chevrolet': 'hatchback: Spark, Aveo, Bolt | saloon: Cruze, Malibu | suv: Captiva, Trax, Equinox, Tahoe | coupe: Camaro, Corvette | mpv: Orlando | pickup: Silverado, Colorado',
  'Chrysler': 'saloon: 300C | mpv: Voyager, Grand Voyager, Pacifica | convertible: Sebring',
  'Citroën': 'hatchback: C1, C2, C3, C4, C4 Cactus, DS3, DS4, ë-C3, Ami | saloon: C5, C6, C-Elysée | estate: C5 Tourer | suv: C3 Aircross, C4 X, C5 Aircross, C5 X | mpv: Berlingo, C3 Picasso, C4 Picasso, C4 SpaceTourer, Grand C4 Picasso, SpaceTourer | van: Jumpy, Jumper, Dispatch, Relay',
  'Cupra': 'hatchback: Born, Leon | estate: Leon Sportstourer | suv: Formentor, Ateca, Tavascan, Terramar',
  'Dacia': 'hatchback: Sandero, Spring | saloon: Logan | estate: Logan MCV, Jogger | suv: Duster, Bigster, Sandero Stepway | mpv: Lodgy, Dokker',
  'Daewoo': 'hatchback: Matiz, Lanos, Kalos | saloon: Nubira, Leganza',
  'Daihatsu': 'hatchback: Sirion, Cuore, Charade | suv: Terios',
  'Dodge': 'saloon: Charger, Avenger | coupe: Challenger | suv: Durango, Journey, Nitro | mpv: Grand Caravan | pickup: Ram',
  'DS': 'hatchback: DS 3, DS 4 | saloon: DS 9 | suv: DS 3 Crossback, DS 7',
  'Ferrari': 'coupe: 296 GTB, 458 Italia, 488 GTB, F8 Tributo, Roma, 812 Superfast, SF90 Stradale | convertible: Portofino, California | suv: Purosangue',
  'Fiat': 'hatchback: 500, 500e, 600, Panda, Punto, Grande Punto, Bravo, Tipo, Uno | saloon: Linea | estate: Tipo Station Wagon | suv: 500X, 600e, Sedici, Freemont | convertible: 124 Spider, 500C | mpv: 500L, Doblò, Qubo, Multipla | van: Ducato, Scudo, Talento, Fiorino',
  'Ford': 'hatchback: Ka, Fiesta, Focus, Focus ST | saloon: Mondeo, Fusion | estate: Focus Estate, Mondeo Estate | suv: EcoSport, Puma, Kuga, Edge, Explorer, Mustang Mach-E, Bronco | coupe: Mustang | mpv: B-Max, C-Max, Grand C-Max, S-Max, Galaxy, Tourneo Connect, Tourneo Custom, Tourneo Courier | van: Transit, Transit Custom, Transit Connect, Transit Courier | pickup: Ranger, F-150',
  'Genesis': 'saloon: G70, G80, G90 | suv: GV60, GV70, GV80',
  'Honda': 'hatchback: Jazz, Civic, Civic Type R, e, Insight | saloon: Accord, Legend | estate: Accord Tourer, Civic Tourer | suv: HR-V, CR-V, ZR-V, e:Ny1 | coupe: CR-Z, NSX | convertible: S2000 | mpv: FR-V, Stream',
  'Hyundai': 'hatchback: i10, i20, i30, i30 N, Getz, Ioniq, Veloster | saloon: i40, Elantra, Sonata, Ioniq 6 | estate: i30 Wagon, i40 Wagon | suv: Bayon, Kona, Tucson, Santa Fe, ix20, ix35, Nexo, Ioniq 5, Ioniq 9, Inster | mpv: ix55, Staria, H-1',
  'Infiniti': 'saloon: Q50, Q70 | hatchback: Q30 | suv: QX30, QX50, QX70 | coupe: Q60',
  'Isuzu': 'pickup: D-Max | suv: Trooper',
  'Iveco': 'van: Daily',
  'Jaguar': 'saloon: XE, XF, XJ, S-Type, X-Type | estate: XF Sportbrake | suv: E-Pace, F-Pace, I-Pace | coupe: F-Type, XK',
  'Jeep': 'suv: Avenger, Renegade, Compass, Cherokee, Grand Cherokee, Wrangler, Patriot, Commander | pickup: Gladiator',
  'Kia': 'hatchback: Picanto, Rio, Ceed, ProCeed, Soul, e-Soul, Stonic, EV3 | saloon: Optima, Stinger, K5, EV4 | estate: Ceed Sportswagon, Optima Sportswagon | suv: XCeed, Niro, e-Niro, Sportage, Sorento, EV5, EV6, EV9 | mpv: Venga, Carens, Carnival',
  'Lada': 'saloon: Granta, Vesta, 2107 | hatchback: Kalina, Samara | suv: Niva',
  'Lamborghini': 'coupe: Huracán, Aventador, Gallardo, Revuelto | suv: Urus',
  'Lancia': 'hatchback: Ypsilon, Delta | mpv: Voyager | saloon: Thema',
  'Land Rover': 'suv: Defender, Discovery, Discovery Sport, Freelander, Range Rover, Range Rover Sport, Range Rover Velar, Range Rover Evoque',
  'Lexus': 'hatchback: CT, LBX | saloon: IS, ES, GS, LS | suv: UX, NX, RX, RZ, GX, LX | coupe: RC, LC',
  'Lotus': 'coupe: Elise, Exige, Evora, Emira | suv: Eletre | saloon: Emeya',
  'Lynk & Co': 'suv: 01, 02, 08',
  'Maserati': 'saloon: Ghibli, Quattroporte | suv: Levante, Grecale | coupe: GranTurismo, MC20 | convertible: GranCabrio',
  'Mazda': 'hatchback: 2, 3, MX-30 | saloon: 6, 3 Sedan, 6e | estate: 6 Wagon | suv: CX-3, CX-30, CX-5, CX-60, CX-7, CX-80 | convertible: MX-5 | coupe: RX-8 | mpv: 5',
  'McLaren': 'coupe: 540C, 570S, 720S, 750S, Artura, GT',
  'Mercedes-Benz': 'hatchback: A-Class, B-Class | saloon: C-Class, E-Class, S-Class, CLA, CLS, EQE, EQS, A-Class Saloon | estate: C-Class Estate, E-Class Estate, CLA Shooting Brake | suv: GLA, GLB, GLC, GLE, GLS, G-Class, EQA, EQB, EQC, EQE SUV, EQS SUV, ML | coupe: C-Class Coupe, E-Class Coupe, CLE, AMG GT, CLK | convertible: SL, SLK, SLC | mpv: V-Class, Citan, R-Class, EQV | van: Vito, Sprinter | pickup: X-Class',
  'MG': 'hatchback: MG3, MG4 | estate: MG5 | suv: ZS, HS, EHS, Marvel R, MGS5 | convertible: Cyberster, TF',
  'MINI': 'hatchback: Hatch, Cooper, Cooper S, One, Clubman, Aceman | suv: Countryman, Paceman | convertible: Convertible | coupe: Coupe',
  'Mitsubishi': 'hatchback: Colt, Space Star, Mirage | saloon: Lancer, Galant | suv: ASX, Eclipse Cross, Outlander, Pajero, Pajero Sport | pickup: L200 | mpv: Grandis',
  'Nissan': 'hatchback: Micra, Note, Pulsar, Leaf, Almera | saloon: Primera, Maxima | suv: Juke, Qashqai, X-Trail, Ariya, Murano, Pathfinder, Patrol | coupe: 350Z, 370Z, GT-R | mpv: Townstar, NV200, Evalia | van: Primastar, Interstar, NV300 | pickup: Navara',
  'Opel': 'hatchback: Adam, Karl, Agila, Corsa, Astra, Ampera | saloon: Insignia, Vectra, Omega | estate: Astra Sports Tourer, Insignia Sports Tourer | suv: Mokka, Crossland, Grandland, Frontera, Antara | coupe: Tigra, GT | mpv: Meriva, Zafira, Zafira Life, Combo | van: Vivaro, Movano',
  'Peugeot': 'hatchback: 107, 108, 206, 207, 208, e-208, 307, 308 | saloon: 301, 407, 508 | estate: 308 SW, 508 SW | suv: 2008, 3008, 4008, 5008, 408 | coupe: RCZ | mpv: Rifter, Partner, Traveller, 5008 MPV | van: Expert, Boxer',
  'Polestar': 'saloon: 2 | suv: 3, 4 | coupe: 1',
  'Porsche': 'coupe: 911, Cayman, 718 Cayman | convertible: Boxster, 718 Boxster | saloon: Panamera, Taycan | estate: Taycan Sport Turismo | suv: Macan, Cayenne',
  'Renault': 'hatchback: Twingo, Clio, Mégane, Zoe, 5, 4 | saloon: Fluence, Laguna, Talisman, Mégane Sedan | estate: Clio Estate, Mégane Estate, Talisman Estate | suv: Captur, Arkana, Austral, Kadjar, Koleos, Symbioz, Rafale, Scenic E-Tech, Mégane E-Tech | mpv: Scénic, Grand Scénic, Espace, Kangoo, Modus | van: Trafic, Master',
  'Rolls-Royce': 'saloon: Ghost, Phantom | coupe: Wraith, Spectre | suv: Cullinan | convertible: Dawn',
  'Saab': 'saloon: 9-3, 9-5, 900, 9000 | estate: 9-3 SportCombi, 9-5 SportCombi | convertible: 9-3 Convertible',
  'SEAT': 'hatchback: Mii, Ibiza, Leon | saloon: Toledo, Exeo | estate: Leon ST, Ibiza ST, Exeo ST | suv: Arona, Ateca, Tarraco | mpv: Altea, Alhambra',
  'Škoda': 'hatchback: Citigo, Fabia, Scala, Rapid, Rapid Spaceback | saloon: Octavia, Superb | estate: Fabia Combi, Octavia Combi, Superb Combi | suv: Kamiq, Karoq, Kodiaq, Enyaq, Elroq, Yeti | mpv: Roomster',
  'Smart': 'hatchback: Fortwo, Forfour | suv: #1, #3, #5',
  'SsangYong': 'suv: Tivoli, Korando, Rexton, Kyron | pickup: Musso | mpv: Rodius',
  'Subaru': 'hatchback: Impreza, Justy | saloon: Legacy, WRX | estate: Outback, Levorg | suv: XV, Crosstrek, Forester, Solterra | coupe: BRZ',
  'Suzuki': 'hatchback: Alto, Celerio, Ignis, Swift, Baleno, Splash | saloon: SX4 Sedan | estate: Swace | suv: Jimny, Vitara, Grand Vitara, S-Cross, SX4, Across',
  'Tesla': 'saloon: Model 3, Model S | suv: Model Y, Model X | pickup: Cybertruck',
  'Toyota': 'hatchback: Aygo, Aygo X, Yaris, Auris, Corolla, Prius, Mirai, GR Yaris | saloon: Avensis, Camry, Corolla Sedan | estate: Avensis Touring Sports, Auris Touring Sports, Corolla Touring Sports | suv: Yaris Cross, C-HR, RAV4, Highlander, Land Cruiser, bZ4X, Urban Cruiser | coupe: GT86, GR86, Supra, Celica | mpv: Verso, Proace City Verso, Proace Verso | van: Proace, Proace City, Hiace | pickup: Hilux',
  'Volkswagen': 'hatchback: up!, Lupo, Fox, Polo, Golf, Golf GTI, Golf R, ID.3, Beetle, Scirocco | saloon: Jetta, Passat, Arteon, Phaeton, ID.7 | estate: Golf Variant, Passat Variant, Arteon Shooting Brake, ID.7 Tourer | suv: T-Cross, Taigo, T-Roc, Tiguan, Tayron, Touareg, ID.4, ID.5 | convertible: Eos, Golf Cabriolet | mpv: Touran, Sharan, Caddy, Multivan, ID. Buzz, Caravelle | van: Transporter, Crafter | pickup: Amarok',
  'Volvo': 'hatchback: C30, V40 | saloon: S40, S60, S80, S90, ES90 | estate: V50, V60, V70, V90, V60 Cross Country, V90 Cross Country, XC70 | suv: XC40, XC60, XC90, C40, EX30, EX40, EX90, EC40 | convertible: C70',
  'Xpeng': 'saloon: P7 | suv: G6, G9',
  'Zeekr': 'hatchback: 001, X | suv: 7X',
};

export const key = value => String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const catalog = new Map(Object.entries(source).map(([make, groups]) => [key(make), {
  make,
  models: groups.split('|').flatMap(group => {
    const [body, names] = group.split(':');
    return names.split(',').map(name => ({ name: name.trim(), body: body.trim() }));
  }).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })),
}]));

export const bodyTypes = ['hatchback', 'saloon', 'estate', 'suv', 'coupe', 'convertible', 'mpv', 'van', 'pickup'];
export const catalogSize = { makes: catalog.size, models: [...catalog.values()].reduce((n, entry) => n + entry.models.length, 0) };
const matches = (name, query) => !query || key(name).split(' ').some(word => word.startsWith(query)) || key(name).startsWith(query);

export function searchMakes(query = '') {
  const q = key(query);
  return [...catalog.values()].map(entry => entry.make).filter(make => matches(make, q));
}

export function searchModels(make, query = '') {
  const q = key(query);
  return (catalog.get(key(make))?.models || []).map(model => model.name).filter(name => matches(name, q));
}

export const knownMake = make => catalog.has(key(make));

/** Catalogue entry for a stored vehicle, so "XC60 Recharge T8" still resolves through "XC60". */
export function catalogModel(make, model) {
  const wanted = key(model);
  let best;
  for (const candidate of catalog.get(key(make))?.models || []) {
    const name = key(candidate.name);
    if ((wanted === name || wanted.startsWith(`${name} `)) && (!best || name.length > key(best.name).length)) best = candidate;
  }
  return best || null;
}
export const bodyOf = (make, model) => catalogModel(make, model)?.body || null;

/** NHTSA vPIC, a free public US vehicle database. Results are kept for the life of the process. */
export function nhtsaLookup({ fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  const cache = new Map();
  const load = path => {
    if (!cache.has(path)) cache.set(path, fetchImpl(`https://vpic.nhtsa.dot.gov/api/vehicles/${path}?format=json`, { signal: AbortSignal.timeout(timeoutMs) })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('lookup failed')))
      .then(data => data.Results || [])
      .catch(error => { cache.delete(path); throw error; }));
    return cache.get(path);
  };
  const title = name => name.trim().replace(/\S+/g, word => word.length > 3 && word === word.toUpperCase() ? word[0] + word.slice(1).toLowerCase() : word);
  return {
    async makes(query) { return (await load('GetMakesForVehicleType/car')).map(row => title(row.MakeName)).filter(name => matches(name, key(query))); },
    async models(make, query) { return (await load(`GetModelsForMake/${encodeURIComponent(make.trim())}`)).map(row => row.Model_Name.trim()).filter(name => matches(name, key(query))); },
  };
}
