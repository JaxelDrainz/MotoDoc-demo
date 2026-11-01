export const FI_PLATE = /^[A-ZÅÄÖ]{2,3}-?\d{1,3}$/i;

export const formatPlate = (value) => {
  const clean = String(value || '')
    .toUpperCase()
    .replace(/[^A-ZÅÄÖ0-9]/g, '');
  const match = clean.match(/^([A-ZÅÄÖ]{2,3})(\d{1,3})$/);
  return match ? `${match[1]}-${match[2]}` : String(value || '').toUpperCase();
};

export function validBusinessId(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d{7})-(\d)$/);
  if (!match) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2];
  const sum = [...match[1]].reduce((total, digit, i) => total + Number(digit) * weights[i], 0);
  const remainder = sum % 11;
  if (remainder === 1) return false;
  return Number(match[2]) === (remainder === 0 ? 0 : 11 - remainder);
}

export const passwordProblem = (password) =>
  String(password || '').length < 8
    ? 'Use at least 8 characters.'
    : !/[A-Za-zÅÄÖåäö]/.test(password) || !/\d/.test(password)
      ? 'Use both letters and numbers.'
      : '';

export const COMMON_SERVICES = [
  'Oil Change',
  'Tire Change',
  'Brake Service',
  'Full Inspection',
  'Engine Diagnostics',
  'Air Conditioning',
  'Battery Replacement',
  'Body Repair',
];

export const SPECIALIZATIONS = [
  ['ev', 'Electric (EV)'],
  ['hybrid', 'Hybrid'],
  ['diesel', 'Diesel'],
  ['petrol', 'Petrol'],
  ['tyres', 'Tyres & wheels'],
  ['bodywork', 'Bodywork & paint'],
  ['ac', 'Air conditioning'],
  ['diagnostics', 'Diagnostics & electronics'],
  ['performance', 'Performance & tuning'],
  ['vans', 'Vans & light trucks'],
  ['premium', 'Premium brands'],
  ['classic', 'Classic cars'],
];

export const WEEKDAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
];

export const defaultHours = () =>
  Object.fromEntries(
    WEEKDAYS.map(([key]) => [
      key,
      { open: !['sat', 'sun'].includes(key), from: '08:00', to: '17:00' },
    ]),
  );

export const hoursProblem = (hours) => {
  const days = WEEKDAYS.map(([key]) => hours?.[key]).filter(Boolean);
  if (!days.some((day) => day.open)) return 'Open at least one day a week.';
  if (days.some((day) => day.open && !(day.to > day.from)))
    return 'Closing time must be after opening time.';
  return '';
};

export const MEMBERSHIP_PERKS = [
  ['priority', 'Priority booking within {days} days'],
  ['safety', 'Free annual safety check (30 min)'],
  ['katsastus', 'Free katsastus prep check before inspection'],
  ['pickup', 'Pickup & drop-off in {city}'],
  ['loaner', 'Free loaner car during service'],
  ['oil', 'Fixed-price oil change once a year (€{price})'],
];
