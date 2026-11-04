const CITIES = {
  helsinki: [60.1699, 24.9384],
  helsingfors: [60.1699, 24.9384],
  espoo: [60.2055, 24.6559],
  esbo: [60.2055, 24.6559],
  vantaa: [60.2934, 25.0378],
  vanda: [60.2934, 25.0378],
  kauniainen: [60.2108, 24.7295],
  tampere: [61.4978, 23.761],
  tammerfors: [61.4978, 23.761],
  turku: [60.4518, 22.2666],
  åbo: [60.4518, 22.2666],
  oulu: [65.0121, 25.4651],
  uleåborg: [65.0121, 25.4651],
  jyväskylä: [62.2426, 25.7473],
  lahti: [60.9827, 25.6612],
  kuopio: [62.8924, 27.677],
  pori: [61.4851, 21.7974],
  kouvola: [60.8681, 26.7042],
  joensuu: [62.601, 29.7636],
  lappeenranta: [61.0587, 28.1887],
  hämeenlinna: [60.9959, 24.4643],
  vaasa: [63.0951, 21.6165],
  vasa: [63.0951, 21.6165],
  seinäjoki: [62.7903, 22.8403],
  rovaniemi: [66.5039, 25.7294],
  mikkeli: [61.6886, 27.2723],
  kotka: [60.4664, 26.9458],
  salo: [60.3845, 23.1289],
  porvoo: [60.3932, 25.665],
  borgå: [60.3932, 25.665],
  kokkola: [63.8385, 23.1307],
  hyvinkää: [60.6309, 24.859],
  lohja: [60.2486, 24.0653],
  järvenpää: [60.4737, 25.0899],
  rauma: [61.1286, 21.5114],
  kajaani: [64.2273, 27.7285],
  kerava: [60.4034, 25.105],
  savonlinna: [61.8687, 28.879],
  nokia: [61.4778, 23.5085],
  kangasala: [61.4639, 24.065],
  riihimäki: [60.7377, 24.7773],
  raahe: [64.6847, 24.4787],
  imatra: [61.1717, 28.7529],
  tornio: [65.8481, 24.1466],
  kemi: [65.7364, 24.5637],
  iisalmi: [63.561, 27.188],
  varkaus: [62.3157, 27.8732],
  pirkkala: [61.4659, 23.6485],
  tuusula: [60.4033, 25.0259],
  sipoo: [60.3767, 25.2711],
  nurmijärvi: [60.4646, 24.8076],
  kirkkonummi: [60.1236, 24.4387],
  ylöjärvi: [61.556, 23.596],
  raisio: [60.4859, 22.1689],
  kaarina: [60.4074, 22.3698],
  naantali: [60.4675, 22.0264],
  hanko: [59.8236, 22.9681],
  lieto: [60.5047, 22.4553],
  forssa: [60.8146, 23.6211],
  valkeakoski: [61.2645, 24.0313],
  heinola: [61.2027, 26.0333],
  jakobstad: [63.6751, 22.7033],
  pietarsaari: [63.6751, 22.7033],
  mariehamn: [60.0973, 19.9348],
  maarianhamina: [60.0973, 19.9348],
};

export const cityPoint = (city) =>
  CITIES[
    String(city || '')
      .trim()
      .toLowerCase()
      .split(/[\s,]+/)[0]
  ] || null;

export const distanceKm = ([lat1, lon1], [lat2, lon2]) => {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const distanceText = (km) => (km < 1 ? '< 1 km' : `${Math.round(km)} km`);
