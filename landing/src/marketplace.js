export const MARKET_DURATIONS = [
  [60, '1 h'],
  [120, '2 h'],
  [180, '3 h'],
  [240, 'Half a day'],
  [480, '1 day'],
  [1440, '2–3 days'],
];
export const URGENCY = [
  ['urgent', 'Urgent', 'As soon as possible, today or tomorrow'],
  ['week', 'This week', 'Within the next few days'],
  ['flexible', 'Flexible', 'Whenever suits the garage'],
];
export const durationLabel = (minutes) =>
  MARKET_DURATIONS.find(([m]) => m === minutes)?.[1] || `${minutes} min`;
