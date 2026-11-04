export const AREAS = [
  ['bookings', 'Bookings', 'Work', 'Bookings, the calendar, opening days and requests'],
  ['jobs', 'Jobs & messages', 'Work', 'The jobs board, job progress and customer chat'],
  ['records', 'Service records', 'Work', 'Service history and reminders'],
  ['customers', 'Customers', 'Customers', 'Customers, notes and reviews'],
  ['memberships', 'Memberships', 'Customers', 'Your membership plan and members'],
  [
    'services',
    'Services & profile',
    'Business',
    'Services menu, prices, hours and workshop profile',
  ],
  ['invoicing', 'Invoicing', 'Business', 'Creating invoices and recording payments'],
  ['wallet', 'Wallet & payouts', 'Business', 'Earnings and payouts'],
  ['analytics', 'Analytics', 'Business', 'Garage figures and trends'],
  ['team', 'Team & access', 'Business', 'Inviting people and changing access'],
];
export const AREA_KEYS = AREAS.map(([key]) => key);

export const ROLES = {
  owner: ['Owner', 'Full access, including payouts and the team.', AREA_KEYS],
  manager: [
    'Manager',
    'Runs the workshop day to day; no payouts or team changes.',
    AREA_KEYS.filter((key) => !['wallet', 'team'].includes(key)),
  ],
  mechanic: [
    'Mechanic',
    'Bookings, jobs, service records and customers.',
    ['bookings', 'jobs', 'records', 'customers'],
  ],
  receptionist: [
    'Receptionist',
    'Bookings, messages, customers and invoicing.',
    ['bookings', 'jobs', 'customers', 'invoicing'],
  ],
};
export const ASSIGNABLE = ['manager', 'mechanic', 'receptionist'];

export const TAB_AREAS = {
  profile: 'services',
  services: 'services',
  bookings: 'bookings',
  marketplace: 'bookings',
  refer: 'memberships',
  reviews: 'customers',
  jobs: 'jobs',
  history: 'records',
  reminders: 'records',
  customers: 'customers',
  memberships: 'memberships',
  invoices: 'invoicing',
  analytics: 'analytics',
  team: 'team',
};
