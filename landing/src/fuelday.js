export const FUEL_FUNNEL_DAYS = 60;
export const FUEL_TARGET = 0.1;
export const normalisePass = (value) => {
  const raw = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('FD') ? raw.slice(2) : raw;
  return body ? `FD-${body}` : '';
};
export const passLink = (origin, code) =>
  `${origin}/admin/fuel-day?pass=${encodeURIComponent(code)}`;
