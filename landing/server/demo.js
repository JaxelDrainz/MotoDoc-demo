import { randomUUID } from 'node:crypto';

export const demoPersonas = ['driver', 'driver-basic', 'garage', 'mechanic', 'admin'];
export const demoLifetime = 24 * 3600000;

const day = 86400000;

export async function buildDemoWorld({ run, clock, world }) {
  const now = clock();
  const id = () => randomUUID();
  const at = (offset) => new Date(now + offset).toISOString();
  const slot = (days, hour) => {
    const date = new Date(now + days * day);
    date.setUTCHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  const dateOnly = (days) => new Date(now + days * day).toISOString().slice(0, 10);
  const tag = world.slice(0, 8);
  const people = {
    garage: [id(), 'Helmi Virtanen', 'garage'],
    mechanic: [id(), 'Mikko Mekaanikko', 'garage'],
    driver: [id(), 'John Demo', 'driver'],
    'driver-basic': [id(), 'Sara Demo', 'driver'],
    admin: [id(), 'Demo Admin', 'driver'],
  };
  for (const [persona, [key, name, role]] of Object.entries(people)) {
    await run(
      'INSERT INTO users(id,name,email,password_hash,role) VALUES(?,?,?,?,?)',
      key,
      name,
      `${persona}.${tag}@demo.motodoc.invalid`,
      'oauth:demo',
      role,
    );
    await run(
      'INSERT INTO user_settings(user_id,phone,terms_accepted_at,onboarded_at) VALUES(?,?,?,?)',
      key,
      '+358 40 000 0000',
      at(-120 * day),
      at(-120 * day),
    );
    await run(
      'INSERT INTO demo_users(user_id,world,persona,created_at) VALUES(?,?,?,?)',
      key,
      world,
      persona,
      now,
    );
  }
  const owner = people.garage[0],
    mechanic = people.mechanic[0],
    member = people.driver[0],
    basic = people['driver-basic'][0];
  const garage = id();
  await run(
    'INSERT INTO garages(id,owner_id,name,city,address,description,services,published) VALUES(?,?,?,?,?,?,?,1)',
    garage,
    owner,
    'MotoDoc Demo Garage',
    'Helsinki',
    'Demo street 1, 00100 Helsinki',
    'A practice garage for trying MotoDoc. Everything here is sample data and resets after a day.',
    JSON.stringify([
      'Annual service',
      'Oil change',
      'Tyre change',
      'Brake check',
      'Diagnostics',
      'Inspection prep',
    ]),
  );
  await run(
    'INSERT INTO garage_contact(garage_id,phone,opening_hours,mechanic_name) VALUES(?,?,?,?)',
    garage,
    '+358 40 000 0000',
    'Mon–Fri 8–17, Sat 10–14',
    'Mikko',
  );
  await run(
    'INSERT INTO garage_details(garage_id,business_id,hourly_rate_cents,member_rate_cents,specializations,main_focus,hours,membership_launched_at) VALUES(?,?,?,?,?,?,?,?)',
    garage,
    '1234567-1',
    7500,
    6800,
    JSON.stringify(['diagnostics', 'petrol', 'tyres']),
    'diagnostics',
    JSON.stringify({
      mon: { open: true, from: '08:00', to: '17:00' },
      tue: { open: true, from: '08:00', to: '17:00' },
      wed: { open: true, from: '08:00', to: '17:00' },
      thu: { open: true, from: '08:00', to: '17:00' },
      fri: { open: true, from: '08:00', to: '17:00' },
      sat: { open: true, from: '10:00', to: '14:00' },
      sun: { open: false, from: '08:00', to: '17:00' },
    }),
    at(-150 * day),
  );
  await run(
    "INSERT INTO garage_staff(user_id,garage_id,role,created_at) VALUES(?,?,'mechanic',?)",
    mechanic,
    garage,
    at(-90 * day),
  );
  const plan = id();
  await run(
    'INSERT INTO plans(id,garage_id,name,benefits,price_cents) VALUES(?,?,?,?,?)',
    plan,
    garage,
    'Demo Care Plus',
    'Member hourly rate, priority booking, a seasonal tyre check and a 24-hour money-back guarantee.',
    14900,
  );
  await run(
    "INSERT INTO memberships(id,driver_id,plan_id,status,created_at) VALUES(?,?,?,'active',?)",
    id(),
    member,
    plan,
    at(-120 * day),
  );
  const corolla = id(),
    golf = id(),
    octavia = id();
  for (const [key, ownerId, make, model, year, plate, mileage] of [
    [corolla, member, 'Toyota', 'Corolla', 2019, 'DEM-101', 84200],
    [golf, member, 'Volkswagen', 'Golf', 2021, 'DEM-102', 31800],
    [octavia, basic, 'Skoda', 'Octavia', 2017, 'DEM-201', 128400],
  ])
    await run(
      'INSERT INTO vehicles(id,owner_id,make,model,year,registration,mileage) VALUES(?,?,?,?,?,?,?)',
      key,
      ownerId,
      make,
      model,
      year,
      plate,
      mileage,
    );
  await run(
    'INSERT INTO vehicle_condition(vehicle_id,oil_life,brake_wear,mot_due,updated_at) VALUES(?,?,?,?,?)',
    corolla,
    35,
    62,
    dateOnly(40),
    at(-day),
  );
  const bookings = [
    [
      member,
      corolla,
      'Annual service',
      slot(-30, 7),
      'completed',
      'Please check the rattle under the car.',
    ],
    [member, corolla, 'Tyre change', slot(2, 7), 'confirmed', 'Winter tyres are in the boot.'],
    [member, golf, 'Brake check', slot(5, 11), 'pending', ''],
    [basic, octavia, 'Oil change', slot(-60, 8), 'completed', ''],
    [basic, octavia, 'Diagnostics', slot(3, 9), 'pending', 'Engine light came on yesterday.'],
    [member, golf, 'Air conditioning', slot(0, 6), 'confirmed', 'The air smells a bit musty.'],
    [basic, octavia, 'Inspection prep', slot(7, 10), 'pending', 'Katsastus is due next month.'],
  ].map(([driver, vehicle, service, startsAt, status, notes]) => ({
    key: id(),
    driver,
    vehicle,
    service,
    startsAt,
    status,
    notes,
  }));
  for (const b of bookings)
    await run(
      'INSERT INTO bookings(id,driver_id,garage_id,vehicle_id,service,starts_at,notes,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
      b.key,
      b.driver,
      garage,
      b.vehicle,
      b.service,
      b.startsAt,
      b.notes,
      b.status,
      at(-2 * day),
    );
  const [annual, tyres, brakes, oil, diagnostics, aircon, inspection] = bookings;
  const pickup = (booking) => new Date(Date.parse(booking.startsAt) + 6 * 3600000).toISOString();
  for (const [booking, fields] of [
    [
      annual,
      {
        stage: 'ready_for_pickup',
        mechanic: 'Mikko',
        pickup_at: pickup(annual),
        completed_at: pickup(annual),
        pickup_note: 'All done. Keys at the front desk.',
      },
    ],
    [
      oil,
      {
        stage: 'ready_for_pickup',
        mechanic: 'Mikko',
        pickup_at: pickup(oil),
        completed_at: pickup(oil),
      },
    ],
    [tyres, { mechanic: 'Mikko' }],
    [brakes, {}],
    [diagnostics, {}],
    [aircon, { stage: 'in_progress', mechanic: 'Mikko' }],
    [inspection, { requested_by: 'garage' }],
  ]) {
    const keys = ['booking_id', ...Object.keys(fields)];
    await run(
      `INSERT INTO booking_jobs(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`,
      booking.key,
      ...Object.values(fields),
    );
  }
  const event = (booking, actor, kind, offset, detail = '') =>
    run(
      'INSERT INTO booking_events(id,booking_id,actor_id,kind,detail,at) VALUES(?,?,?,?,?,?)',
      id(),
      booking.key,
      actor,
      kind,
      detail,
      at(offset),
    );
  await event(annual, member, 'requested', -33 * day);
  await event(annual, owner, 'confirmed', -32 * day);
  await event(annual, mechanic, 'completed', -30 * day);
  await event(oil, basic, 'requested', -62 * day);
  await event(oil, owner, 'confirmed', -61 * day);
  await event(oil, mechanic, 'completed', -60 * day);
  await event(tyres, member, 'requested', -3 * day);
  await event(tyres, owner, 'confirmed', -day);
  await event(brakes, member, 'requested', -3 * 3600000);
  await event(diagnostics, basic, 'requested', -5 * 3600000);
  await event(aircon, member, 'requested', -day);
  await event(aircon, owner, 'confirmed', -20 * 3600000);
  await event(aircon, mechanic, 'stage', -2 * 3600000, 'in_progress');
  await event(
    aircon,
    mechanic,
    'note',
    -3600000,
    'Compressor looks fine. Cleaning the cabin filter and refilling the gas now.',
  );
  await event(
    inspection,
    owner,
    'scheduled',
    -6 * 3600000,
    'We have a free slot before your katsastus. Does this time suit you?',
  );
  for (const [booking, vehicle, summary, mileage] of [
    [
      annual,
      corolla,
      'Annual service: oil and filter, brake fluid and cabin filter. No faults found.',
      84200,
    ],
    [oil, octavia, 'Oil and filter changed, tyre pressures set.', 128400],
  ])
    await run(
      'INSERT INTO service_records(id,booking_id,garage_id,vehicle_id,driver_id,summary,mileage,performed_at) VALUES(?,?,?,?,?,?,?,?)',
      id(),
      booking.key,
      garage,
      vehicle,
      booking.driver,
      summary,
      mileage,
      booking.startsAt,
    );
  await run(
    "INSERT INTO invoices(id,booking_id,garage_id,driver_id,description,amount_cents,status,due_date,payment_reference,created_at) VALUES(?,?,?,?,?,?,'paid',?,?,?)",
    id(),
    annual.key,
    garage,
    member,
    'Annual service, member rate',
    24900,
    dateOnly(-16),
    'DEMO-PAYMENT',
    at(-30 * day),
  );
  await run(
    "INSERT INTO invoices(id,booking_id,garage_id,driver_id,description,amount_cents,status,due_date,created_at) VALUES(?,?,?,?,?,?,'unpaid',?,?)",
    id(),
    oil.key,
    garage,
    basic,
    'Oil change',
    8900,
    dateOnly(7),
    at(-60 * day),
  );
  await run(
    'INSERT INTO reviews(booking_id,garage_id,driver_id,rating,tags,comment,reply,reply_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    annual.key,
    garage,
    member,
    5,
    JSON.stringify(['Quality work', 'On time', 'Clear communication']),
    'Mikko explained everything and the car was ready on time.',
    'Thanks John, see you for the winter tyres!',
    at(-28 * day),
    at(-29 * day),
  );
  for (const [booking, sender, body, offset] of [
    [tyres, owner, 'Hi John, your winter tyres are booked in. See you on the day.', -day],
    [tyres, member, 'Great, I will drop the car off just before.', -20 * 3600000],
    [brakes, member, 'The brakes squeak a little when they are cold.', -3 * 3600000],
    [diagnostics, basic, 'The engine light is orange, not red, if that helps.', -4 * 3600000],
  ])
    await run(
      'INSERT INTO messages(id,booking_id,sender_id,body,created_at) VALUES(?,?,?,?,?)',
      id(),
      booking.key,
      sender,
      body,
      at(offset),
    );
  for (const [user, title, due] of [
    [member, 'Inspection (katsastus)', 12],
    [member, 'Switch to winter tyres', 5],
    [basic, 'Next oil change', 20],
  ])
    await run(
      'INSERT INTO reminders(id,user_id,title,due_date) VALUES(?,?,?,?)',
      id(),
      user,
      title,
      dateOnly(due),
    );
  await run(
    'INSERT INTO customer_notes(garage_id,driver_id,notes,tags) VALUES(?,?,?,?)',
    garage,
    member,
    'Member. Prefers morning drop-off and a text when the car is ready.',
    'member, regular',
  );
}

const users = '(SELECT user_id FROM demo_users WHERE world=?)';
const garages = `(SELECT id FROM garages WHERE owner_id IN ${users})`;
const bookings = `(SELECT id FROM bookings WHERE driver_id IN ${users} OR garage_id IN ${garages})`;
const purgeSteps = [
  `DELETE FROM messages WHERE booking_id IN ${bookings}`,
  `DELETE FROM booking_events WHERE booking_id IN ${bookings}`,
  `DELETE FROM booking_jobs WHERE booking_id IN ${bookings}`,
  `DELETE FROM reviews WHERE booking_id IN ${bookings}`,
  `DELETE FROM invoices WHERE booking_id IN ${bookings}`,
  `DELETE FROM service_records WHERE booking_id IN ${bookings}`,
  `DELETE FROM bookings WHERE driver_id IN ${users} OR garage_id IN ${garages}`,
  `DELETE FROM memberships WHERE driver_id IN ${users} OR plan_id IN (SELECT id FROM plans WHERE garage_id IN ${garages})`,
  `DELETE FROM plans WHERE garage_id IN ${garages}`,
  `DELETE FROM customer_notes WHERE garage_id IN ${garages} OR driver_id IN ${users}`,
  `DELETE FROM garage_contact WHERE garage_id IN ${garages}`,
  `DELETE FROM garage_details WHERE garage_id IN ${garages}`,
  `DELETE FROM garage_staff WHERE user_id IN ${users} OR garage_id IN ${garages}`,
  `DELETE FROM vehicle_condition WHERE vehicle_id IN (SELECT id FROM vehicles WHERE owner_id IN ${users})`,
  `DELETE FROM vehicles WHERE owner_id IN ${users}`,
  `DELETE FROM reminders WHERE user_id IN ${users}`,
  `DELETE FROM garages WHERE owner_id IN ${users}`,
  ...['sessions', 'resets', 'photos', 'notification_reads', 'user_settings'].map(
    (table) => `DELETE FROM ${table} WHERE user_id IN ${users}`,
  ),
  `DELETE FROM users WHERE id IN ${users}`,
  'DELETE FROM demo_users WHERE world=?',
];

export async function purgeDemoWorld({ run, world }) {
  for (const sql of purgeSteps) await run(sql, ...Array(sql.split('?').length - 1).fill(world));
}
