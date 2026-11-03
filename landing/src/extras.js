export const PLAN_FEATURES = {
  driver: {
    free: [
      'Up to 2 cars',
      'Up to 5 bookings a month',
      'Service history and reminders',
      'Emergency marketplace',
    ],
    pro: [
      'Unlimited cars and bookings',
      'Service recommendations for every car',
      'Inspection and tax reminders',
      'Priority support',
    ],
  },
  garage: {
    free: [
      'Up to 20 customers',
      'Basic booking',
      'Standard invoicing',
      'Basic analytics',
      'Community support',
    ],
    pro: [
      'Unlimited customers',
      'Advanced booking and scheduling',
      'Full analytics and reports',
      'Membership program tools',
      'Priority listing for drivers',
      'Priority support',
    ],
  },
};
export const FREE_LIMITS = { vehicles: 2, bookings: 5, customers: 20 };
export const PRIORITY = [
  ['overdue', 'Overdue'],
  ['due_soon', 'Due soon'],
  ['upcoming', 'Upcoming'],
  ['on_track', 'On track'],
];
export const COMING_SOON = [
  [
    'inspection',
    'Book an inspection',
    'Book your katsastus from MotoDoc, with the date filled in from Traficom. Until then, set a reminder under Inspections.',
  ],
  ['tax', 'Road tax', 'See and pay your vehicle tax in MotoDoc, with a reminder before it’s due.'],
  ['insurance', 'Insurance', 'Compare and renew your car insurance in MotoDoc.'],
];
