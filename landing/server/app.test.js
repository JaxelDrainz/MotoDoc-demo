import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'motodoc-test-'));
  const { app, db } = await createApp({
    databasePath: join(dir, 'test.sqlite'),
    outboxPath: join(dir, 'mailbox'),
    imageLookup: async () => null,
    ...options,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let cookie = '';
    return async (path, body, method = body === undefined ? 'GET' : 'POST', extra = {}) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          origin: 'http://localhost:4173',
          'X-MotoDoc-Request': '1',
          'Content-Type': 'application/json',
          cookie,
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.headers.has('set-cookie'))
        cookie = response.headers.get('set-cookie').split(';')[0];
      return {
        status: response.status,
        data: (response.headers.get('content-type') || '').includes('json')
          ? await response.json()
          : await response.arrayBuffer(),
        cookie: response.headers.get('set-cookie'),
      };
    };
  };
  return { db, dir, client, base };
}
const signup = (c, email, role = 'driver') =>
  c('/api/auth/signup', {
    name: role === 'garage' ? 'Test Garage' : 'Test Driver',
    email,
    password: 'testing-password-42',
    role,
    terms: true,
  });
const vehicle = (c) =>
  c('/api/vehicles', {
    make: 'Toyota',
    model: 'Corolla',
    year: 2021,
    registration: 'TEST-123',
    mileage: 12000,
  });
async function garage(c, email = 'garage@example.test') {
  await signup(c, email, 'garage');
  await c(
    '/api/garage/profile',
    {
      name: 'Test Garage',
      city: 'Tampere',
      address: 'Test street 1',
      description: 'Test fixture',
      services: ['Oil change'],
      published: true,
    },
    'PUT',
  );
  await c(
    '/api/garage/hours',
    {
      hours: Object.fromEntries(
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
          d,
          { open: true, from: '00:00', to: '24:00' },
        ]),
      ),
    },
    'PUT',
  );
  return (await c('/api/garage/profile')).data;
}
const future = () => {
  const d = new Date(Date.now() + 86400000);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
};

test('account persistence, password hashing, session rotation and logout', async (t) => {
  const { client, db } = await fixture(t),
    c = client();
  assert.equal((await c('/api/vehicles')).status, 401);
  const created = await signup(c, '  DRIVER@Example.test  ');
  assert.equal(created.status, 201);
  assert.equal(created.data.user.email, 'driver@example.test');
  assert.match(created.cookie, /HttpOnly/);
  assert.match(created.cookie, /SameSite=Strict/);
  const stored = db.prepare('SELECT * FROM users').get();
  assert.notEqual(stored.password_hash, 'testing-password-42');
  assert(!JSON.stringify(created.data).includes('password'));
  assert.equal((await c('/api/auth/me')).status, 200);
  assert.equal(
    (await c('/api/auth/login', { email: 'driver@example.test', password: 'wrong' })).status,
    401,
  );
  assert.equal(
    (await c('/api/auth/login', { email: 'driver@example.test', password: 'testing-password-42' }))
      .status,
    200,
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 1);
  await c('/api/auth/logout', {});
  assert.equal((await c('/api/auth/me')).status, 401);
  assert.equal((await signup(client(), 'driver@example.test')).status, 409);
});
test('cross-origin writes, invalid roles and unauthenticated access are rejected', async (t) => {
  const { client } = await fixture(t),
    c = client();
  assert.equal(
    (await c('/api/auth/signup', {}, 'POST', { origin: 'https://evil.example' })).status,
    403,
  );
  assert.equal((await c('/api/auth/signup', {}, 'POST', { 'X-MotoDoc-Request': '' })).status, 403);
  assert.equal((await signup(c, 'evil@example.test', 'admin')).status, 400);
  await signup(c, 'driver@example.test');
  assert.equal((await c('/api/garage/profile', { name: 'mine' }, 'PUT')).status, 403);
  assert.equal(
    (
      await c('/api/auth/signup', {
        name: 'x',
        email: 'x@x.test',
        password: 'short',
        role: 'driver',
      })
    ).status,
    400,
  );
});
test('vehicle ownership and SQL injection resistance', async (t) => {
  const { client, db } = await fixture(t),
    a = client(),
    b = client();
  await signup(a, 'a@example.test');
  await signup(b, 'b@example.test');
  const v = (await vehicle(a)).data;
  assert.equal((await b('/api/vehicles')).data.length, 0);
  assert.equal((await b(`/api/vehicles/${v.id}`, {}, 'DELETE')).status, 404);
  assert.equal(
    (
      await a('/api/vehicles', {
        make: "'); DROP TABLE users; --",
        model: 'Safe',
        year: 2020,
        registration: 'SAFE',
        mileage: 0,
      })
    ).status,
    201,
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 2);
});
test('booking lifecycle, unique slots, tenant isolation and atomic service history', async (t) => {
  const { client } = await fixture(t),
    d = client(),
    g = client(),
    other = client();
  await signup(d, 'd@example.test');
  const profile = await garage(g);
  await garage(other, 'other@example.test');
  const v = (await vehicle(d)).data,
    body = {
      garage_id: profile.id,
      vehicle_id: v.id,
      service: 'Oil change',
      starts_at: future(),
      notes: '',
    };
  const result = await d('/api/bookings', body);
  assert.equal(result.status, 201);
  const key = result.data.id;
  assert.equal((await d('/api/bookings', body)).status, 409);
  assert.equal((await other('/api/bookings')).data.length, 0);
  assert.equal((await other(`/api/bookings/${key}`, { status: 'confirmed' }, 'PATCH')).status, 404);
  assert.equal((await d(`/api/bookings/${key}`, { status: 'completed' }, 'PATCH')).status, 403);
  assert.equal((await g(`/api/bookings/${key}`, { status: 'confirmed' }, 'PATCH')).status, 200);
  assert.equal(
    (
      await g(
        `/api/bookings/${key}`,
        { status: 'completed', summary: 'Done', mileage: 100 },
        'PATCH',
      )
    ).status,
    400,
  );
  assert.equal((await g('/api/bookings')).data[0].status, 'confirmed');
  assert.equal(
    (
      await g(
        `/api/bookings/${key}`,
        { status: 'completed', summary: 'Oil and filter replaced', mileage: 13000 },
        'PATCH',
      )
    ).status,
    200,
  );
  assert.equal((await d('/api/service-history')).data[0].mileage, 13000);
  assert.equal((await other('/api/service-history')).data.length, 0);
  assert.equal((await d(`/api/vehicles/${v.id}`, {}, 'DELETE')).status, 409);
  assert.equal((await g(`/api/bookings/${key}`, { status: 'cancelled' }, 'PATCH')).status, 409);
});
test('reset links expire, are single use, and revoke existing sessions', async (t) => {
  let now = Date.now();
  const { client, dir } = await fixture(t, { clock: () => now }),
    a = client(),
    b = client();
  await signup(a, 'reset@example.test');
  const missing = await b('/api/auth/forgot-password', { email: 'missing@example.test' });
  const found = await b('/api/auth/forgot-password', { email: 'reset@example.test' });
  assert.deepEqual(missing.data, found.data);
  const files = await readdir(join(dir, 'mailbox'));
  const mail = JSON.parse(await readFile(join(dir, 'mailbox', files[0]), 'utf8'));
  const token = new URLSearchParams(new URL(mail.url).hash.slice(1)).get('token');
  assert.equal(
    (await b('/api/auth/reset-password', { token, password: 'new-testing-password-7' })).status,
    200,
  );
  assert.equal((await a('/api/auth/me')).status, 401);
  assert.equal(
    (await b('/api/auth/reset-password', { token, password: 'other-password-8' })).status,
    400,
  );
  assert.equal(
    (await b('/api/auth/login', { email: 'reset@example.test', password: 'testing-password-42' }))
      .status,
    401,
  );
  assert.equal(
    (
      await b('/api/auth/login', {
        email: 'reset@example.test',
        password: 'new-testing-password-7',
      })
    ).status,
    200,
  );
  await b('/api/auth/forgot-password', { email: 'reset@example.test' });
  const latest = (await readdir(join(dir, 'mailbox'))).filter((f) => f !== files[0])[0];
  const expiredToken = new URLSearchParams(
    new URL(JSON.parse(await readFile(join(dir, 'mailbox', latest), 'utf8')).url).hash.slice(1),
  ).get('token');
  now += 31 * 60000;
  assert.equal(
    (
      await b('/api/auth/reset-password', {
        token: expiredToken,
        password: 'next-testing-password-9',
      })
    ).status,
    400,
  );
});
test('private customer notes, invoices and reminders are scoped', async (t) => {
  const { client } = await fixture(t),
    d = client(),
    g = client(),
    other = client();
  await signup(d, 'member@example.test');
  const gp = await garage(g);
  await garage(other, 'private@example.test');
  const v = (await vehicle(d)).data;
  const b = (
    await d('/api/bookings', {
      garage_id: gp.id,
      vehicle_id: v.id,
      service: 'Oil change',
      starts_at: future(),
    })
  ).data;
  await g(`/api/bookings/${b.id}`, { status: 'confirmed' }, 'PATCH');
  await g(
    `/api/bookings/${b.id}`,
    { status: 'completed', summary: 'Done', mileage: 13000 },
    'PATCH',
  );
  const customer = (await g('/api/customers')).data[0];
  await g(`/api/customers/${customer.id}`, { notes: 'Private note', tags: 'Regular' }, 'PUT');
  assert.equal(
    (await other(`/api/customers/${customer.id}`, { notes: 'Overwrite' }, 'PUT')).status,
    404,
  );
  const invoice = await g('/api/invoices', {
    booking_id: b.id,
    description: 'Oil change',
    amount_cents: 9500,
    due_date: '2027-01-01',
  });
  assert.equal(invoice.status, 201);
  assert.equal((await d('/api/invoices')).data[0].amount_cents, 9500);
  assert.equal((await other('/api/invoices')).data.length, 0);
  assert.equal(
    (
      await d(
        `/api/invoices/${invoice.data.id}`,
        { status: 'paid', payment_reference: 'fake' },
        'PATCH',
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await g(
        `/api/invoices/${invoice.data.id}`,
        { status: 'paid', payment_reference: 'Bank transfer test' },
        'PATCH',
      )
    ).status,
    200,
  );
  assert.equal((await g('/api/overview')).data.invoiceTotals.paid, 9500);
  const reminder = (await d('/api/reminders', { title: 'Inspection', due_date: '2027-01-01' }))
    .data;
  assert.equal((await other(`/api/reminders/${reminder.id}`, { done: true }, 'PATCH')).status, 404);
});
test('repeated login attempts are throttled and session expiry is enforced', async (t) => {
  let now = Date.now();
  const { client } = await fixture(t, { clock: () => now }),
    c = client();
  await signup(c, 'rate@example.test');
  now += 8 * 86400000;
  assert.equal((await c('/api/auth/me')).status, 401);
  for (let i = 0; i < 20; i++)
    assert.equal(
      (await c('/api/auth/login', { email: 'rate@example.test', password: 'incorrect' })).status,
      401,
    );
  assert.equal(
    (await c('/api/auth/login', { email: 'rate@example.test', password: 'incorrect' })).status,
    429,
  );
});
test('google authentication handles new drivers, garages, account linking and unconfigured state', async (t) => {
  const { client: unconfiguredClient } = await fixture(t);
  const u = unconfiguredClient();
  const unconfiguredRes = await u('/api/auth/google', {
    credential: 'some-test-token',
    role: 'driver',
  });
  assert.equal(unconfiguredRes.status, 503);

  const mockTokens = {
    'driver-token': {
      googleId: 'google-sub-1',
      email: 'googledriver@example.test',
      name: 'Google Driver',
    },
    'garage-token': {
      googleId: 'google-sub-2',
      email: 'googlegarage@example.test',
      name: 'Google Garage',
    },
    'existing-token': {
      googleId: 'google-sub-3',
      email: 'existing@example.test',
      name: 'Existing Person',
    },
  };
  const mockVerifier = async (token) => {
    if (!mockTokens[token]) throw Object.assign(new Error('Invalid token'), { status: 401 });
    return mockTokens[token];
  };

  const { client, db } = await fixture(t, {
    googleClientId: 'mock-client-id.apps.googleusercontent.com',
    verifyGoogleToken: mockVerifier,
  });
  const c1 = client(),
    c2 = client(),
    c3 = client();

  const dRes = await c1('/api/auth/google', { credential: 'driver-token', role: 'driver' });
  assert.equal(dRes.status, 200);
  assert.equal(dRes.data.user.email, 'googledriver@example.test');
  assert.equal(dRes.data.user.role, 'driver');
  assert.match(dRes.cookie, /HttpOnly/);

  assert.equal((await c1('/api/vehicles')).status, 200);

  const gRes = await c2('/api/auth/google', { credential: 'garage-token', role: 'garage' });
  assert.equal(gRes.status, 200);
  assert.equal(gRes.data.user.role, 'garage');

  const garageProfile = await c2('/api/garage/profile');
  assert.equal(garageProfile.status, 200);
  assert.match(garageProfile.data.name, /Google Garage/);

  await signup(c3, 'existing@example.test');
  const unlinked = await client()('/api/auth/google', { credential: 'existing-token' });
  assert.equal(unlinked.status, 409);
  const linkRes = await c3('/api/auth/link-google', { credential: 'existing-token' });
  assert.equal(linkRes.status, 200);
  const userRow = db
    .prepare('SELECT google_id FROM users WHERE email=?')
    .get('existing@example.test');
  assert.equal(userRow.google_id, 'google-sub-3');

  const oauthOnly = client();
  assert.equal(
    (
      await oauthOnly('/api/auth/login', {
        email: 'googledriver@example.test',
        password: 'any-guess',
      })
    ).status,
    401,
  );
});
test('vehicle condition, garage contact, booking messages and rescheduling are scoped', async (t) => {
  const { client } = await fixture(t),
    d = client(),
    g = client(),
    stranger = client(),
    otherGarage = client();
  await signup(d, 'd@example.test');
  await signup(stranger, 's@example.test');
  const profile = await garage(g);
  await garage(otherGarage, 'other@example.test');
  assert.equal(profile.phone, '');
  const v = (await vehicle(d)).data;

  assert.equal((await d('/api/vehicles')).data[0].oil_life, null);
  assert.equal(
    (
      await stranger(
        `/api/vehicles/${v.id}/condition`,
        { oil_life: 1, brake_wear: 1, mot_due: null },
        'PUT',
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await d(
        `/api/vehicles/${v.id}/condition`,
        { oil_life: 101, brake_wear: 1, mot_due: null },
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await d(
        `/api/vehicles/${v.id}/condition`,
        { oil_life: 84, brake_wear: 72, mot_due: '2027-02-26' },
        'PUT',
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await d(
        `/api/vehicles/${v.id}/condition`,
        { oil_life: 80, brake_wear: null, mot_due: '2027-02-26' },
        'PUT',
      )
    ).status,
    200,
  );
  const stored = (await d('/api/vehicles')).data[0];
  assert.deepEqual([stored.oil_life, stored.brake_wear, stored.mot_due], [80, null, '2027-02-26']);

  assert.equal(
    (await d('/api/garage/contact', { phone: '1', opening_hours: '', mechanic_name: '' }, 'PUT'))
      .status,
    403,
  );
  assert.equal(
    (
      await g(
        '/api/garage/contact',
        { phone: 'call me', opening_hours: '', mechanic_name: '' },
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await g(
        '/api/garage/contact',
        {
          phone: '+358 40 123 4567',
          opening_hours: 'Mon-Fri 08:00-17:00',
          mechanic_name: 'Test Mechanic',
        },
        'PUT',
      )
    ).status,
    200,
  );
  assert.equal((await g('/api/garage/profile')).data.mechanic_name, 'Test Mechanic');

  const first = future(),
    key = (
      await d('/api/bookings', {
        garage_id: profile.id,
        vehicle_id: v.id,
        service: 'Oil change',
        starts_at: first,
        notes: '',
      })
    ).data.id;
  const booked = (await d('/api/bookings')).data[0];
  assert.deepEqual(
    [booked.phone, booked.opening_hours, booked.mechanic_name, booked.garage_city],
    ['+358 40 123 4567', 'Mon-Fri 08:00-17:00', 'Test Mechanic', 'Tampere'],
  );

  assert.equal(
    (await d(`/api/bookings/${key}/messages`, { body: 'Can I wait on site?' })).status,
    201,
  );
  assert.equal(
    (await g(`/api/bookings/${key}/messages`, { body: 'Yes, about an hour.' })).status,
    201,
  );
  assert.equal((await stranger(`/api/bookings/${key}/messages`, { body: 'x' })).status, 404);
  assert.equal((await otherGarage(`/api/bookings/${key}/messages`, { body: 'x' })).status, 404);
  assert.equal((await d(`/api/bookings/${key}/messages`, { body: '   ' })).status, 400);
  const thread = (await g('/api/messages')).data;
  assert.deepEqual(
    thread.map((m) => [m.sender_name, m.body]),
    [
      ['Test Driver', 'Can I wait on site?'],
      ['Test Garage', 'Yes, about an hour.'],
    ],
  );
  assert.equal((await d('/api/messages')).data.length, 2);
  assert.equal((await stranger('/api/messages')).data.length, 0);
  assert.equal((await otherGarage('/api/messages')).data.length, 0);

  await g(`/api/bookings/${key}`, { status: 'confirmed' }, 'PATCH');
  const later = new Date(Date.parse(first) + 2 * 3600000).toISOString();
  assert.equal((await g(`/api/bookings/${key}/schedule`, { starts_at: later }, 'PUT')).status, 403);
  assert.equal(
    (await stranger(`/api/bookings/${key}/schedule`, { starts_at: later }, 'PUT')).status,
    404,
  );
  assert.equal(
    (
      await d(
        `/api/bookings/${key}/schedule`,
        { starts_at: new Date(Date.parse(first) + 1800000).toISOString() },
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal((await d(`/api/bookings/${key}/schedule`, { starts_at: later }, 'PUT')).status, 200);
  const moved = (await d('/api/bookings')).data[0];
  assert.deepEqual([moved.starts_at, moved.status], [later, 'pending']);

  const v2 = (
    await stranger('/api/vehicles', {
      make: 'Volvo',
      model: 'XC60',
      year: 2022,
      registration: 'TWO-222',
      mileage: 5,
    })
  ).data;
  assert.equal(
    (
      await stranger('/api/bookings', {
        garage_id: profile.id,
        vehicle_id: v2.id,
        service: 'Oil change',
        starts_at: first,
        notes: '',
      })
    ).status,
    201,
  );
  assert.equal((await d(`/api/bookings/${key}/schedule`, { starts_at: first }, 'PUT')).status, 409);
  await d(`/api/bookings/${key}`, { status: 'cancelled' }, 'PATCH');
  assert.equal((await d(`/api/bookings/${key}/schedule`, { starts_at: later }, 'PUT')).status, 409);
});
test('reviews need a completed booking and feed the garage rating', async (t) => {
  const { client } = await fixture(t),
    d = client(),
    other = client(),
    g = client();
  await signup(d, 'd@example.test');
  await signup(other, 'o@example.test');
  const profile = await garage(g);
  const v = (await vehicle(d)).data,
    key = (
      await d('/api/bookings', {
        garage_id: profile.id,
        vehicle_id: v.id,
        service: 'Oil change',
        starts_at: future(),
        notes: '',
      })
    ).data.id;
  assert.equal((await d(`/api/bookings/${key}/review`, { rating: 5 }, 'PUT')).status, 404);
  await g(`/api/bookings/${key}`, { status: 'confirmed' }, 'PATCH');
  await g(
    `/api/bookings/${key}`,
    { status: 'completed', summary: 'Done', mileage: 12500 },
    'PATCH',
  );
  assert.equal((await other(`/api/bookings/${key}/review`, { rating: 1 }, 'PUT')).status, 404);
  assert.equal((await g(`/api/bookings/${key}/review`, { rating: 5 }, 'PUT')).status, 403);
  assert.equal((await d(`/api/bookings/${key}/review`, { rating: 6 }, 'PUT')).status, 400);
  assert.equal((await d(`/api/bookings/${key}/review`, { rating: 5 }, 'PUT')).status, 200);
  assert.equal((await d(`/api/bookings/${key}/review`, { rating: 4 }, 'PUT')).status, 200);
  const listed = (await other('/api/garages')).data[0];
  assert.deepEqual([listed.rating, listed.review_count], [4, 1]);
  const booked = (await d('/api/bookings')).data[0];
  assert.deepEqual([booked.rating, booked.review_count], [4, 1]);
  assert.equal((await d('/api/service-history')).data[0].rating, 4);
});
test('vehicle catalogue searches bundled data first, falls back to the lookup, and serves illustrations', async (t) => {
  const asked = [];
  const vehicleLookup = {
    makes: async (q) => {
      asked.push(`makes:${q}`);
      return ['Zenvo', 'Zenvo'];
    },
    models: async (make, q) => {
      asked.push(`models:${make}:${q}`);
      if (make === 'Broken') throw new Error('offline');
      return ['TS1 GT', 'ST1'];
    },
  };
  const photos = [],
    imageLookup = async (make, model) => {
      photos.push(`${make} ${model}`);
      if (make === 'Zenvo') throw new Error('offline');
      return model === 'XC60'
        ? {
            image_url: 'https://upload.example/xc60.jpg',
            image_source: 'https://commons.example/xc60',
            image_credit: 'A. Photographer',
            image_license: 'CC BY-SA 4.0',
          }
        : null;
    };
  const { client, base } = await fixture(t, { vehicleLookup, imageLookup }),
    c = client();
  assert.equal((await c('/api/catalog/makes?q=vol')).status, 401);
  await signup(c, 'd@example.test');
  assert.deepEqual((await c('/api/catalog/makes?q=vol')).data, ['Volkswagen', 'Volvo']);
  assert((await c('/api/catalog/makes')).data.length > 50);
  assert.deepEqual((await c('/api/catalog/makes?q=skoda')).data, ['Škoda']);
  assert.deepEqual((await c('/api/catalog/models?make=volvo&q=xc')).data, [
    'XC40',
    'XC60',
    'XC70',
    'XC90',
  ]);
  assert.deepEqual((await c('/api/catalog/models?q=xc')).data, []);
  assert.deepEqual(asked, []);
  assert.deepEqual((await c('/api/catalog/makes?q=zenv')).data, ['Zenvo']);
  assert.deepEqual((await c('/api/catalog/models?make=Zenvo&q=')).data, ['ST1', 'TS1 GT']);
  assert.deepEqual((await c('/api/catalog/models?make=Broken')).data, []);
  assert.deepEqual(asked, ['makes:zenv', 'models:Zenvo:', 'models:Broken:']);

  await c('/api/vehicles', {
    make: 'Volvo',
    model: 'XC60 Recharge T8',
    year: 2023,
    registration: 'ABC-123',
    mileage: 1,
  });
  await c('/api/vehicles', {
    make: 'Zenvo',
    model: 'ST1',
    year: 2023,
    registration: 'ZEN-1',
    mileage: 1,
  });
  assert.deepEqual(
    (await c('/api/vehicles')).data.map((v) => v.body),
    ['suv', null],
  );

  await c('/api/vehicles', {
    make: 'Volvo',
    model: 'V60',
    year: 2020,
    registration: 'V-60',
    mileage: 1,
  });
  const listed = (await c('/api/vehicles')).data;
  assert.deepEqual(
    listed.map((v) => v.image_url),
    [null, 'https://upload.example/xc60.jpg', null],
  );
  assert.deepEqual(
    [listed[1].image_credit, listed[1].image_license],
    ['A. Photographer', 'CC BY-SA 4.0'],
  );
  const preview = (await c('/api/catalog/image?make=Volvo&model=XC60')).data;
  assert.deepEqual([preview.image_url, preview.body], ['https://upload.example/xc60.jpg', 'suv']);
  assert.equal((await c('/api/catalog/image?make=Volvo')).status, 400);
  await c('/api/vehicles');
  assert.deepEqual(photos, ['Volvo XC60', 'Zenvo ST1', 'Volvo V60', 'Zenvo ST1', 'Zenvo ST1']);

  const art = await fetch(`${base}/api/catalog/art/suv.svg`);
  assert.equal(art.status, 200);
  assert.match(art.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await art.text(), /^<svg /);
  assert.equal((await fetch(`${base}/api/catalog/art/spaceship.svg`)).status, 404);
});
test('profile photos are validated, versioned and shown to the other side of a booking', async (t) => {
  const { client } = await fixture(t),
    d = client(),
    g = client();
  await signup(d, 'd@example.test');
  const profile = await garage(g);
  const pixel =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal((await d('/api/auth/me')).data.user.photo, null);
  assert.equal(
    (await d('/api/account/photo', { image: 'data:image/svg+xml;base64,AAAA' }, 'PUT')).status,
    400,
  );
  assert.equal(
    (await d('/api/account/photo', { image: `${pixel}${'A'.repeat(23000)}` }, 'PUT')).status,
    400,
  );
  assert.equal((await g('/api/account/photo', { image: pixel }, 'PUT')).status, 200);
  const url = (await g('/api/auth/me')).data.user.photo;
  assert.match(url, /^\/api\/photos\/[0-9a-f-]+\?v=\d+$/);
  const v = (await vehicle(d)).data;
  await d('/api/bookings', {
    garage_id: profile.id,
    vehicle_id: v.id,
    service: 'Oil change',
    starts_at: future(),
    notes: '',
  });
  const booked = (await d('/api/bookings')).data[0];
  assert.deepEqual([booked.garage_photo, booked.driver_photo], [url, null]);
  await g(`/api/bookings/${booked.id}/messages`, { body: 'Hello' });
  assert.equal((await d('/api/messages')).data[0].sender_photo, url);
  assert.equal((await d('/api/account/photo', { image: pixel }, 'PUT')).status, 200);
  const customer = (await g('/api/customers')).data[0];
  assert.match(customer.photo, /^\/api\/photos\//);
  assert.equal((await g('/api/bookings')).data[0].driver_photo, customer.photo);
  assert.equal((await g('/api/account/photo', {}, 'DELETE')).status, 200);
  assert.equal((await g('/api/auth/me')).data.user.photo, null);
});
test('free slots and notifications follow bookings, messages and reminders', async (t) => {
  const { client } = await fixture(t),
    d = client(),
    g = client(),
    other = client();
  await signup(d, 'd@example.test');
  await signup(other, 'o@example.test');
  const profile = await garage(g);
  const v = (await vehicle(d)).data,
    start = future();
  const key = (
    await d('/api/bookings', {
      garage_id: profile.id,
      vehicle_id: v.id,
      service: 'Oil change',
      starts_at: start,
      notes: '',
    })
  ).data.id;
  const day = new Date(start);
  day.setUTCHours(0, 0, 0, 0);
  const range = `from=${day.toISOString()}&to=${new Date(day.getTime() + 86400000).toISOString()}`;
  assert.deepEqual((await other(`/api/garages/${profile.id}/busy?${range}`)).data, [start]);
  assert.equal((await other(`/api/garages/${profile.id}/busy?from=x&to=y`)).status, 400);

  assert.equal((await d('/api/notifications')).data.unread, 0);
  const forGarage = (await g('/api/notifications')).data;
  assert.deepEqual([forGarage.unread, forGarage.items[0].type], [1, 'requested']);
  assert.equal(forGarage.counts.bookings, 1);
  assert.equal(forGarage.items[0].email_sent, true);
  await g(`/api/bookings/${key}`, { status: 'confirmed' }, 'PATCH');
  await g(`/api/bookings/${key}/messages`, { body: 'See you then' });
  await d('/api/reminders', {
    title: 'Renew insurance',
    due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
  });
  await d('/api/reminders', {
    title: 'Far away',
    due_date: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
  });
  const forDriver = (await d('/api/notifications')).data;
  assert.equal(forDriver.unread, 3);
  assert.deepEqual(forDriver.items.map((item) => item.type).sort(), [
    'confirmed',
    'message',
    'reminder',
  ]);
  assert.equal(forDriver.items.find((item) => item.type === 'confirmed').email_sent, true);
  assert.equal(forDriver.items.find((item) => item.type === 'message').email_sent, false);
  assert.equal((await other('/api/notifications')).data.items.length, 0);
  assert.equal((await d('/api/notifications/seen', {})).status, 200);
  assert.equal((await d('/api/notifications')).data.unread, 0);
  await d(`/api/bookings/${key}`, { status: 'cancelled' }, 'PATCH');
  assert.deepEqual((await other(`/api/garages/${profile.id}/busy?${range}`)).data, []);
  assert.equal((await g('/api/notifications')).data.items[0].type, 'cancelled');
});
test('notification email preferences, area badges and server reply reminders', async (t) => {
  let now = Date.UTC(2026, 10, 2, 10, 0, 0);
  const sent = [];
  const { client } = await fixture(t, {
      clock: () => now,
      sendNotificationEmail: async (message) => {
        sent.push(message);
        return true;
      },
    }),
    driver = client(),
    shop = client();
  await signup(driver, 'notify-driver@example.test');
  const profile = await garage(shop, 'notify-garage@example.test');
  const car = (await vehicle(driver)).data;
  const booking = (
    await driver('/api/bookings', {
      garage_id: profile.id,
      vehicle_id: car.id,
      service: 'Oil change',
      starts_at: new Date(now + 3 * 86400000).toISOString(),
      notes: '',
    })
  ).data.id;

  const requestFeed = (await shop('/api/notifications')).data;
  assert.equal(requestFeed.counts.bookings, 1);
  assert.equal(requestFeed.items[0].email_sent, true);
  assert.equal(sent.at(-1).to, 'notify-garage@example.test');

  await shop(`/api/bookings/${booking}/messages`, { body: 'Can you confirm the mileage?' });
  let driverFeed = (await driver('/api/notifications')).data;
  assert.equal(driverFeed.items.find((item) => item.type === 'message').email_sent, false);
  await driver(
    '/api/account/settings',
    {
      name: 'Test Driver',
      phone: '',
      address: '',
      email_updates: true,
      email_chat: true,
    },
    'PUT',
  );
  now += 24 * 3600000 + 1000;
  driverFeed = (await driver('/api/notifications')).data;
  assert(driverFeed.items.some((item) => item.type === 'reply-reminder'));
  assert(driverFeed.items.find((item) => item.type === 'message').email_sent);
  assert.equal(driverFeed.counts.bookings >= 1, true);

  await driver(`/api/bookings/${booking}/messages`, { body: 'The mileage is 12,000 km.' });
  now += 2 * 3600000 + 1000;
  const garageFeed = (await shop('/api/notifications')).data;
  assert(garageFeed.items.some((item) => item.type === 'reply-reminder'));
  await shop('/api/notifications/seen', {});
  assert.deepEqual((await shop('/api/notifications')).data.counts, {});
});
test('only administrators can change site settings, which are versioned and public', async (t) => {
  const { client, base } = await fixture(t, { adminEmails: 'boss@example.test' }),
    admin = client(),
    driver = client();
  await signup(admin, 'boss@example.test');
  await signup(driver, 'd@example.test');
  assert.equal((await admin('/api/auth/me')).data.user.admin, true);
  assert.equal((await driver('/api/auth/me')).data.user.admin, false);
  const anonymous = await fetch(`${base}/api/site`).then((r) => r.json());
  assert.equal(anonymous.site.content.hero.tagline, 'All in one place.');
  assert.match(anonymous.style.css, /--green:#087658/);
  assert.equal((await driver('/api/admin/site')).status, 403);
  assert.equal((await driver('/api/admin/site', { site: {} }, 'PUT')).status, 403);
  const draft = (await admin('/api/admin/site')).data.site;
  draft.theme.light.primary = '#123456';
  draft.motion.pixelFill = false;
  draft.content.hero.tagline = 'Car care, sorted.';
  assert.equal(
    (
      await admin(
        '/api/admin/site',
        {
          site: {
            ...draft,
            theme: { ...draft.theme, light: { ...draft.theme.light, primary: 'red' } },
          },
        },
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await admin(
        '/api/admin/site',
        { site: { ...draft, images: { ...draft.images, hero: 'https://evil.example/x.png' } } },
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal((await admin('/api/admin/site', { site: draft }, 'PUT')).status, 200);
  const live = await fetch(`${base}/api/site`).then((r) => r.json());
  assert.equal(live.site.content.hero.tagline, 'Car care, sorted.');
  assert.match(live.style.css, /--green:#123456/);
  assert(live.style.classes.includes('md-no-pixel'));
  const pixel =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal((await driver('/api/admin/assets', { name: 'x', image: pixel })).status, 403);
  const asset = (await admin('/api/admin/assets', { name: 'Hero', image: pixel })).data;
  assert.equal((await fetch(`${base}${asset.url}`)).headers.get('content-type'), 'image/png');
  const revisions = (await admin('/api/admin/site')).data.revisions;
  assert.equal(revisions.length, 1);
  draft.content.hero.tagline = 'Second';
  await admin('/api/admin/site', { site: draft }, 'PUT');
  assert.equal((await admin(`/api/admin/revisions/${revisions[0].id}/restore`, {})).status, 200);
  const restored = await fetch(`${base}/api/site`).then((r) => r.json());
  assert.equal(restored.site.content.hero.tagline, 'Car care, sorted.');
});

test('demo worlds give each visitor private sample data across roles and expire', async (t) => {
  let now = Date.now();
  const { client } = await fixture(t, { clock: () => now }),
    visitor = client(),
    stranger = client(),
    real = client();
  const driver = await visitor('/api/demo', { persona: 'driver' });
  assert.equal(driver.status, 201);
  assert.equal(driver.data.user.demo, 'driver');
  assert.equal(driver.data.redirect, '/app');
  assert.equal((await visitor('/api/vehicles')).data.length, 2);
  assert.equal((await visitor('/api/memberships')).data[0].status, 'active');
  const [demoGarage] = (await visitor('/api/garages')).data;
  assert.equal(demoGarage.name, 'MotoDoc Demo Garage');

  await signup(real, 'real@example.test');
  assert.equal((await real('/api/garages')).data.length, 0);
  await stranger('/api/demo', { persona: 'driver' });
  assert.notEqual((await stranger('/api/garages')).data[0].id, demoGarage.id);

  const mechanic = await visitor('/api/demo', { persona: 'mechanic' });
  assert.equal(mechanic.data.user.garageRole, 'mechanic');
  const jobs = (await visitor('/api/bookings')).data;
  assert.equal(jobs.length, 7);
  assert.equal((await visitor('/api/invoices')).status, 403);
  assert.equal(
    (
      await visitor(
        '/api/garage/membership',
        { price: 39, hourly_rate: 80, member_rate: 70 },
        'PUT',
      )
    ).status,
    403,
  );
  assert.equal((await visitor('/api/customers')).status, 200);
  const pending = jobs.find((b) => b.status === 'pending' && b.requested_by !== 'garage');
  assert.equal(
    (await visitor(`/api/bookings/${pending.id}`, { status: 'confirmed' }, 'PATCH')).status,
    200,
  );

  await visitor('/api/demo', { persona: 'garage' });
  const owner = (await visitor('/api/auth/me')).data.user;
  assert.equal(owner.garageRole, 'owner');
  const demoTeam = (await visitor('/api/team')).data;
  assert.equal(demoTeam.members[0].role, 'mechanic');
  assert.equal(demoTeam.invites[0].role, 'receptionist');
  assert.equal((await visitor('/api/invoices')).data.length, 2);
  assert((await visitor('/api/notifications')).data.items.some((n) => n.type === 'confirmed'));

  const admin = await visitor('/api/demo', { persona: 'admin' });
  assert.equal(admin.data.redirect, '/admin');
  assert.equal(admin.data.user.admin, true);
  const site = (await visitor('/api/admin/site')).data.site;
  assert.equal((await visitor('/api/admin/site', { site }, 'PUT')).status, 403);

  assert.equal((await visitor('/api/demo', { persona: 'boss' })).status, 400);
  now += 25 * 3600000;
  assert.equal((await visitor('/api/auth/me')).status, 200);
  await client()('/api/demo', { persona: 'driver' });
  assert.equal((await visitor('/api/auth/me')).status, 401);
  assert.equal((await real('/api/auth/me')).status, 200);
});

test('onboarding, terms, password rule, settings, password change and account deletion', async (t) => {
  const { client } = await fixture(t),
    driver = client(),
    garage = client(),
    other = client();
  const noTerms = await driver('/api/auth/signup', {
    name: 'No Terms',
    email: 'noterms@example.test',
    password: 'testing-password-42',
    role: 'driver',
  });
  assert.equal(noTerms.status, 400);
  const weak = await driver('/api/auth/signup', {
    name: 'Weak',
    email: 'weak@example.test',
    password: 'onlyletters',
    role: 'driver',
    terms: true,
  });
  assert.equal(weak.status, 400);
  assert.match(weak.data.error, /letters and numbers/);

  await signup(driver, 'onboard@example.test');
  let me = (await driver('/api/auth/me')).data.user;
  assert.equal(me.onboarded, false);
  assert.equal(me.termsAccepted, true);
  const badPlate = await driver('/api/onboarding', {
    phone: '+358 40 123 4567',
    car: { plate: 'NOTAPLATE1', make: 'Toyota', model: 'Corolla', year: 2019 },
  });
  assert.equal(badPlate.status, 400);
  const done = await driver('/api/onboarding', {
    phone: '+358 40 123 4567',
    email_updates: false,
    car: { plate: 'abc123', make: 'Toyota', model: 'Corolla', year: 2019 },
  });
  assert.equal(done.status, 200);
  assert.equal(done.data.next, '/app');
  me = (await driver('/api/auth/me')).data.user;
  assert.equal(me.onboarded, true);
  assert.equal(me.phone, '+358 40 123 4567');
  assert.equal(me.prefs.emailUpdates, false);
  assert.equal((await driver('/api/vehicles')).data[0].registration, 'ABC-123');

  await signup(garage, 'workshop@example.test', 'garage');
  const hours = Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
      d,
      { open: !['sat', 'sun'].includes(d), from: '08:00', to: '17:00' },
    ]),
  );
  const garageBody = {
    phone: '+358 9 123 456',
    request_sound: false,
    garage: {
      name: 'Kallio Auto',
      address: 'Mannerheimintie 42, 00100 Helsinki',
      business_id: '1234567-8',
      services: ['Oil Change', 'Brake Service'],
      specializations: ['diesel', 'ev'],
      main_focus: 'ev',
      hourly_rate: 75,
      hours,
    },
  };
  assert.equal((await garage('/api/onboarding', garageBody)).status, 400);
  garageBody.garage.business_id = '2345678-0';
  assert.equal(
    (
      await garage('/api/onboarding', {
        ...garageBody,
        garage: {
          ...garageBody.garage,
          hours: { ...hours, mon: { open: true, from: '17:00', to: '08:00' } },
        },
      })
    ).status,
    400,
  );
  const garageDone = await garage('/api/onboarding', garageBody);
  assert.equal(garageDone.data.next, '/onboarding/membership');
  const profile = (await garage('/api/garage/profile')).data;
  assert.equal(profile.city, 'Helsinki');
  assert.equal(profile.hourly_rate, 75);
  assert.deepEqual(profile.specializations, ['diesel', 'ev']);
  assert.equal(profile.published, true);
  const perks = [
    'Priority booking within 5 days',
    'Free annual safety check (30 min)',
    'Free loaner car during service',
  ];
  assert.equal(
    (await garage('/api/garage/membership', { price: 49, hourly_rate: 75, member_rate: 80, perks }))
      .status,
    400,
  );
  assert.equal(
    (
      await garage('/api/garage/membership', {
        price: 49,
        hourly_rate: 75,
        member_rate: 68,
        perks: perks.slice(0, 2),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await garage('/api/garage/membership', {
        price: 49,
        hourly_rate: 75,
        member_rate: 68,
        perks,
        own_perk: 'Coffee',
      })
    ).status,
    201,
  );
  assert.equal(
    (await garage('/api/garage/membership', { price: 49, hourly_rate: 75, member_rate: 68, perks }))
      .status,
    409,
  );
  const plans = (await driver('/api/plans')).data;
  const own = plans.find((p) => p.kind === 'garage');
  assert.equal(own.price_cents, 4900);
  assert.match(own.benefits, /Coffee/);
  assert.equal(plans.find((p) => p.kind === 'basic').price_cents, 1200);

  assert.equal(
    (
      await driver(
        '/api/account/settings',
        { phone: '+358 50 1', address: 'Home 1', email_updates: true, email_chat: true },
        'PUT',
      )
    ).status,
    200,
  );
  assert.equal((await driver('/api/auth/me')).data.user.prefs.emailChat, true);
  assert.equal(
    (await driver('/api/account/password', { current: 'wrong', next: 'brand-new-pass-1' })).status,
    400,
  );
  assert.equal(
    (
      await driver('/api/account/password', {
        current: 'testing-password-42',
        next: 'testing-password-42',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await driver('/api/account/password', {
        current: 'testing-password-42',
        next: 'brand-new-pass-1',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await other('/api/auth/login', {
        email: 'onboard@example.test',
        password: 'brand-new-pass-1',
      })
    ).status,
    200,
  );
  assert.equal((await driver('/api/account', {}, 'DELETE')).status, 200);
  assert.equal((await driver('/api/auth/me')).status, 401);
  assert.equal((await other('/api/auth/me')).status, 401);
  assert.equal(
    (
      await other('/api/auth/login', {
        email: 'onboard@example.test',
        password: 'brand-new-pass-1',
      })
    ).status,
    401,
  );
});

test('booking to pickup: approve, decline, garage-made appointments, stages, pickup, reviews and chat close', async (t) => {
  let now = Date.now();
  const { client } = await fixture(t, { clock: () => now }),
    shop = client(),
    driver = client(),
    other = client();
  await garage(shop);
  await signup(driver, 'flow@example.test');
  const car = (await vehicle(driver)).data.id;
  const g = (await driver('/api/garages')).data[0];
  const hour = (h) => {
    const d = new Date(now + h * 3600000);
    d.setUTCMinutes(0, 0, 0);
    return d.toISOString();
  };
  const book = async (h) =>
    (
      await driver('/api/bookings', {
        garage_id: g.id,
        vehicle_id: car,
        service: 'Oil change',
        starts_at: hour(h),
      })
    ).data.id;

  const declined = await book(30);
  assert.equal((await driver(`/api/bookings/${declined}/approve`, {})).status, 403);
  assert.equal(
    (await shop(`/api/bookings/${declined}/decline`, { reason: 'No free slot that week' })).status,
    200,
  );
  let rows = (await driver('/api/bookings')).data;
  let row = rows.find((b) => b.id === declined);
  assert.equal(row.state, 'declined');
  assert.equal(row.cancel_reason, 'No free slot that week');
  const items = (await driver('/api/notifications')).data.items;
  assert(
    items.some((n) => n.title === 'Booking declined' && n.detail === 'No free slot that week'),
  );

  const proposed = await book(32);
  assert.equal(
    (
      await shop(`/api/bookings/${proposed}/propose`, {
        starts_at: hour(56),
        reason: 'Busy that day',
      })
    ).status,
    200,
  );
  row = (await driver('/api/bookings')).data.find((b) => b.id === proposed);
  assert.equal(row.state, 'confirmed');
  assert.equal(row.starts_at, hour(56));

  const job = await book(26);
  assert.equal((await shop(`/api/bookings/${job}/stage`, { stage: 'in_progress' })).status, 409);
  assert.equal(
    (await shop(`/api/bookings/${job}/approve`, { starts_at: hour(27), mechanic: 'Mikko' })).status,
    200,
  );
  row = (await shop('/api/bookings')).data.find((b) => b.id === job);
  assert.equal(row.mechanic, 'Mikko');
  assert.equal(row.starts_at, hour(27));
  assert.equal((await shop(`/api/bookings/${job}/stage`, { stage: 'finished' })).status, 409);
  assert.equal((await shop(`/api/bookings/${job}/stage`, { stage: 'in_progress' })).status, 200);
  assert.equal(
    (await driver(`/api/bookings/${job}/cancel`, { reason: 'Changed my mind' })).status,
    409,
  );
  assert.equal(
    (await shop(`/api/bookings/${job}/notes`, { note: 'Front pads are worn.' })).status,
    201,
  );
  assert.equal(
    (await shop(`/api/bookings/${job}/ready`, { pickup_at: hour(30), mileage: 12500 })).status,
    409,
  );
  assert.equal((await shop(`/api/bookings/${job}/stage`, { stage: 'finished' })).status, 200);
  assert.equal(
    (await shop(`/api/bookings/${job}/ready`, { pickup_at: hour(30), mileage: 100 })).status,
    400,
  );
  assert.equal(
    (
      await shop(`/api/bookings/${job}/ready`, {
        pickup_at: hour(30),
        mileage: 12500,
        note: 'Keys at the desk.',
      })
    ).status,
    200,
  );
  row = (await driver('/api/bookings')).data.find((b) => b.id === job);
  assert.equal(row.state, 'ready');
  assert.equal(row.review_due, true);
  assert.equal(row.chat_open, true);
  assert.equal((await driver('/api/vehicles')).data[0].mileage, 12500);
  assert.equal((await driver('/api/service-history')).data.length, 1);
  const titles = (await driver('/api/notifications')).data.items.map((n) => n.title);
  assert(titles.includes('Your car is ready for pickup'));
  assert(titles.includes('Mechanic note'));
  assert(titles.includes('Repair progress updated'));

  assert.equal(
    (
      await driver(
        `/api/bookings/${job}/review`,
        { rating: 5, tags: ['On time', 'Not a tag'] },
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await driver(
        `/api/bookings/${job}/review`,
        { rating: 4, tags: ['On time'], comment: 'Quick and clear.' },
        'PUT',
      )
    ).status,
    200,
  );
  assert.equal((await shop(`/api/bookings/${job}/review/reply`, { reply: 'Thanks!' })).status, 201);
  assert.equal((await shop(`/api/bookings/${job}/review/reply`, { reply: 'Again' })).status, 409);
  row = (await driver('/api/bookings')).data.find((b) => b.id === job);
  assert.equal(row.review_comment, 'Quick and clear.');
  assert.deepEqual(row.review_tags, ['On time']);
  assert.equal(row.review_reply, 'Thanks!');

  now += 45 * 3600000;
  row = (await driver('/api/bookings')).data.find((b) => b.id === job);
  assert.equal(row.state, 'completed');
  assert.equal(row.chat_open, false);
  assert.equal((await driver(`/api/bookings/${job}/messages`, { body: 'Hello?' })).status, 403);

  const driverId = (await driver('/api/auth/me')).data.user.id;
  const made = await shop('/api/bookings/schedule', {
    driver_id: driverId,
    vehicle_id: car,
    service: 'Oil change',
    starts_at: hour(48),
    notes: 'Free slot before winter.',
  });
  assert.equal(made.status, 201);
  row = (await driver('/api/bookings')).data.find((b) => b.id === made.data.id);
  assert.equal(row.state, 'needs_approval');
  await signup(other, 'stranger@example.test');
  const strangerId = (await other('/api/auth/me')).data.user.id;
  assert.equal(
    (
      await shop('/api/bookings/schedule', {
        driver_id: strangerId,
        vehicle_id: car,
        service: 'Oil change',
        starts_at: hour(50),
      })
    ).status,
    404,
  );
  assert.equal((await shop(`/api/bookings/${made.data.id}/approve`, {})).status, 409);
  assert.equal(
    (await driver(`/api/bookings/${made.data.id}/respond`, { accept: true })).status,
    200,
  );
  assert(
    (await shop('/api/notifications')).data.items.some(
      (n) => n.title === 'Customer approved the appointment',
    ),
  );

  const noShow = await book(60);
  await shop(`/api/bookings/${noShow}/approve`, {});
  assert.equal((await driver(`/api/bookings/${noShow}/cancel`, { no_show: true })).status, 403);
  assert.equal(
    (await shop(`/api/bookings/${noShow}/move`, { starts_at: hour(62), reason: 'Mechanic ill' }))
      .status,
    200,
  );
  assert.equal(
    (
      await shop(`/api/bookings/${noShow}/cancel`, {
        reason: 'Customer did not show up',
        no_show: true,
      })
    ).status,
    200,
  );
  assert.equal((await driver('/api/bookings')).data.find((b) => b.id === noShow).state, 'no_show');
});

test('services menu, opening hours, blocked days and online status control bookings', async (t) => {
  let now = Date.parse('2026-11-02T06:30:00Z');
  const { client } = await fixture(t, { clock: () => now }),
    shop = client(),
    driver = client();
  await garage(shop);
  await signup(driver, 'slots@example.test');
  const car = (await vehicle(driver)).data.id;
  const weekdays = Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
      d,
      { open: !['sat', 'sun'].includes(d), from: '09:00', to: '17:00' },
    ]),
  );
  assert.equal(
    (
      await shop(
        '/api/garage/hours',
        { hours: { ...weekdays, mon: { open: true, from: '17:00', to: '09:00' } } },
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal((await shop('/api/garage/hours', { hours: weekdays }, 'PUT')).status, 200);
  const g = (await driver('/api/garages')).data[0];
  assert.equal(g.online, true);
  assert.equal(g.hours.sat.open, false);

  const days = (await driver(`/api/garages/${g.id}/availability?days=7`)).data;
  assert.equal(days[0].date, '2026-11-02');
  assert.equal(days[0].status, 'open');
  assert.equal(days[0].slots[0], '2026-11-02T07:00:00.000Z');
  assert(!days[0].slots.includes('2026-11-02T10:00:00.000Z'));
  assert.equal(days.find((d) => d.date === '2026-11-07').status, 'closed');

  const book = (starts_at) =>
    driver('/api/bookings', { garage_id: g.id, vehicle_id: car, service: 'Oil change', starts_at });
  assert.equal((await book('2026-11-07T08:00:00.000Z')).status, 400);
  assert.equal((await book('2026-11-03T05:00:00.000Z')).status, 400);
  assert.equal((await book('2026-11-03T07:00:00.000Z')).status, 201);
  const after = (await driver(`/api/garages/${g.id}/availability?days=2`)).data;
  assert(!after[1].slots.includes('2026-11-03T07:00:00.000Z'));

  assert.equal(
    (await shop('/api/garage/blocked', { date: '2026-11-04', reason: 'Training day' })).status,
    201,
  );
  assert.equal((await shop('/api/garage/blocked', { date: '2026-10-01' })).status, 400);
  const blocked = (await driver(`/api/garages/${g.id}/availability?days=3`)).data[2];
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.reason, 'Training day');
  assert.equal((await book('2026-11-04T08:00:00.000Z')).status, 400);
  assert.equal((await shop('/api/garage/blocked/2026-11-04', {}, 'DELETE')).status, 200);
  assert.equal((await book('2026-11-04T08:00:00.000Z')).status, 201);

  assert.equal((await shop('/api/garage/online', { online: false }, 'PUT')).status, 200);
  assert.equal(
    (await driver(`/api/garages/${g.id}/availability?days=1`)).data[0].status,
    'offline',
  );
  assert.equal((await book('2026-11-05T08:00:00.000Z')).status, 400);
  await shop('/api/garage/online', { online: true }, 'PUT');

  const menu = (await shop('/api/garage/services')).data;
  assert.deepEqual(
    menu.map((s) => s.name),
    ['Oil change'],
  );
  assert.equal(
    (await shop('/api/garage/services', { name: 'Brakes', price_min: 90, price_max: 50 })).status,
    400,
  );
  const added = await shop('/api/garage/services', {
    name: 'Brakes',
    price_min: 50,
    price_max: 90,
    minutes: 60,
  });
  assert.equal(added.status, 201);
  assert.equal((await shop('/api/garage/services', { name: 'brakes' })).status, 409);
  let listed = (await driver('/api/garages')).data[0];
  assert.deepEqual(listed.services, ['Oil change', 'Brakes']);
  assert.equal(listed.menu.find((s) => s.name === 'Brakes').price_max_cents, 9000);
  await shop(`/api/garage/services/${added.data.id}`, { name: 'Brakes', active: false }, 'PUT');
  listed = (await driver('/api/garages')).data[0];
  assert.deepEqual(listed.services, ['Oil change']);
  const hidden = await driver('/api/bookings', {
    garage_id: g.id,
    vehicle_id: car,
    service: 'Brakes',
    starts_at: '2026-11-05T09:00:00.000Z',
  });
  assert.equal(hidden.status, 400);
  assert.equal((await shop(`/api/garage/services/${added.data.id}`, {}, 'DELETE')).status, 200);
});

test('invoices: line items, discounts, VAT, numbering, Finnish reference, e-invoice, reminders and payment', async (t) => {
  const { client } = await fixture(t),
    shop = client(),
    driver = client();
  await garage(shop);
  await signup(driver, 'pay@example.test');
  const car = (await vehicle(driver)).data.id;
  const g = (await driver('/api/garages')).data[0];
  const done = async (hours) => {
    const start = new Date(Date.now() + hours * 3600000);
    start.setUTCMinutes(0, 0, 0);
    const b = (
      await driver('/api/bookings', {
        garage_id: g.id,
        vehicle_id: car,
        service: 'Oil change',
        starts_at: start.toISOString(),
      })
    ).data.id;
    await shop(`/api/bookings/${b}/approve`, {});
    await shop(`/api/bookings/${b}/complete`, {
      summary: 'Tyres and alignment',
      mileage: 13000 + hours,
    });
    return b;
  };
  const first = await done(30);
  const body = {
    booking_id: first,
    service_description: 'Tyre change and wheel alignment for winter.',
    mileage: 13030,
    lines: [
      { description: 'Tyre change', quantity: 1, unit_cents: 6000, discount_pct: 10 },
      { description: 'Wheel alignment', quantity: 1, unit_cents: 4500 },
    ],
    discount: { type: 'amount', value: 500, reason: 'Loyal customer' },
  };
  assert.equal(
    (await shop('/api/invoices', { ...body, service_description: 'Short' })).status,
    400,
  );
  assert.equal(
    (await shop('/api/invoices', { ...body, lines: [{ description: 'Free', unit_cents: 0 }] }))
      .status,
    400,
  );
  assert.equal(
    (await shop('/api/invoices', { ...body, discount: { type: 'amount', value: 20000 } })).status,
    400,
  );
  assert.equal(
    (
      await shop('/api/invoices', {
        ...body,
        business: {
          business_id: '1234567-8',
          einvoice_address: '003712345678',
          operator: 'Maventa',
        },
      })
    ).status,
    400,
  );
  const created = await shop('/api/invoices', body);
  assert.equal(created.status, 201);
  const year = new Date().getFullYear();
  assert.equal(created.data.number, `INV-${year}-001`);
  assert.equal((await shop('/api/invoices', body)).status, 409);

  const [mine] = (await driver('/api/invoices')).data;
  assert.equal(mine.totals.total, 9400);
  assert.equal(mine.totals.net, 7490);
  assert.equal(mine.totals.vat, 1910);
  assert.equal(mine.totals.savings, 1100);
  assert.equal(mine.lines[0].total, 5400);
  assert.equal(mine.reference.replace(/\s/g, '').slice(0, -1), `${year}001`);
  assert.equal(mine.state, 'unpaid');
  assert.equal(mine.registration, 'TEST-123');
  assert((await driver('/api/notifications')).data.items.some((n) => n.title === 'New invoice'));

  const second = await done(54);
  const business = await shop('/api/invoices', {
    booking_id: second,
    service_description: 'Annual service with brake fluid change.',
    lines: [{ description: 'Annual service', unit_cents: 18900 }],
    discount: { type: 'percent', value: 10, reason: 'Campaign' },
    business: {
      business_id: '2345678-0',
      einvoice_address: 'FI12 3456 7890 1234 56',
      operator: 'Maventa',
    },
  });
  assert.equal(business.data.number, `INV-${year}-002`);
  const biz = (await shop('/api/invoices')).data.find((i) => i.id === business.data.id);
  assert.equal(biz.delivery, 'einvoice');
  assert.equal(biz.einvoice_address, 'FI1234567890123456');
  assert.equal(biz.totals.total, 17010);

  assert.equal(
    (await shop(`/api/invoices/${created.data.id}/remind`, { note: 'Due soon' })).data.reminders,
    1,
  );
  assert(
    (await driver('/api/notifications')).data.items.some((n) => n.title === 'Payment reminder'),
  );
  assert.equal(
    (
      await shop(
        `/api/invoices/${created.data.id}`,
        { status: 'paid', payment_reference: 'Bank 2211' },
        'PATCH',
      )
    ).status,
    200,
  );
  const paid = (await driver('/api/invoices')).data.find((i) => i.id === created.data.id);
  assert.equal(paid.state, 'paid');
  assert.equal(paid.paid_method, 'bank_transfer');
  assert.equal((await shop(`/api/invoices/${created.data.id}/remind`, {})).status, 404);
});

test('team: invites, roles, per-area access, pause and remove', async (t) => {
  const { client } = await fixture(t),
    owner = client(),
    staff = client(),
    stranger = client();
  await garage(owner);
  const team = async () => (await owner('/api/team')).data;
  assert.equal((await team()).owner.role, 'owner');

  assert.equal(
    (await owner('/api/team/invites', { name: 'Bad', email: 'nope', role: 'mechanic' })).status,
    400,
  );
  assert.equal(
    (await owner('/api/team/invites', { name: 'Owner', email: 'garage@example.test' })).status,
    409,
  );
  const invited = await owner('/api/team/invites', {
    name: 'Rita Reception',
    email: 'rita@example.test',
    role: 'receptionist',
  });
  assert.equal(invited.status, 201);
  const { code } = invited.data;
  assert.equal(
    (await owner('/api/team/invites', { name: 'Rita', email: 'rita@example.test' })).status,
    409,
  );
  const listed = (await team()).invites[0];
  assert.deepEqual(listed.permissions, ['bookings', 'jobs', 'customers', 'invoicing']);
  assert.equal((await owner(`/api/team/invites/${code}/resend`, {})).status, 200);

  const look = await stranger(`/api/invites/${code}`);
  assert.equal(look.data.garage_name, 'Test Garage');
  assert.equal(look.data.role, 'receptionist');
  assert.equal(
    (await staff(`/api/invites/${code}/accept`, { name: 'Rita', password: 'short', terms: true }))
      .status,
    400,
  );
  const accepted = await staff(`/api/invites/${code}/accept`, {
    name: 'Rita Reception',
    password: 'testing-password-42',
    terms: true,
  });
  assert.equal(accepted.status, 201);
  assert.equal((await stranger(`/api/invites/${code}`)).status, 404);
  const me = (await staff('/api/auth/me')).data.user;
  assert.equal(me.garageRole, 'receptionist');
  assert.equal(me.teamStatus, 'active');
  assert.equal(me.onboarded, true);
  assert.deepEqual(me.permissions, ['bookings', 'jobs', 'customers', 'invoicing']);

  assert.equal((await staff('/api/invoices')).status, 200);
  assert.equal((await staff('/api/customers')).status, 200);
  assert.equal((await staff('/api/team')).status, 403);
  assert.equal((await staff('/api/garage/contact', { phone: '+358401234567' }, 'PUT')).status, 403);
  assert.equal(
    (await staff('/api/garage/membership', { price: 39, hourly_rate: 80, member_rate: 70 }, 'PUT'))
      .status,
    403,
  );
  assert.deepEqual((await staff('/api/service-history')).data, []);

  const member = (await team()).members[0];
  assert.equal(member.status, 'active');
  assert.equal(
    (await owner(`/api/team/members/${member.id}`, { permissions: ['customers', 'nope'] }, 'PUT'))
      .status,
    400,
  );
  await owner(`/api/team/members/${member.id}`, { permissions: ['customers'] }, 'PUT');
  assert.equal((await staff('/api/invoices')).status, 403);
  assert.deepEqual((await staff('/api/bookings')).data, []);
  await owner(`/api/team/members/${member.id}`, { role: 'manager' }, 'PUT');
  assert.equal((await staff('/api/auth/me')).data.user.garageRole, 'manager');
  assert.equal((await staff('/api/invoices')).status, 200);
  assert.equal((await staff('/api/team')).status, 403);
  assert.equal(
    (await owner(`/api/team/members/${(await team()).owner.id}`, { active: false }, 'PUT')).status,
    403,
  );

  await owner(`/api/team/members/${member.id}`, { active: false }, 'PUT');
  assert.equal((await staff('/api/auth/me')).status, 401);
  assert.equal(
    (
      await staff('/api/auth/login', {
        email: 'rita@example.test',
        password: 'testing-password-42',
      })
    ).status,
    200,
  );
  assert.equal((await staff('/api/auth/me')).data.user.teamStatus, 'paused');
  assert.equal((await staff('/api/bookings')).status, 403);
  assert.equal((await team()).members[0].status, 'paused');
  await owner(`/api/team/members/${member.id}`, { active: true }, 'PUT');
  assert.equal((await staff('/api/bookings')).status, 200);

  assert.equal((await owner(`/api/team/members/${member.id}`, {}, 'DELETE')).status, 200);
  assert.equal((await team()).members.length, 0);
  await staff('/api/auth/login', { email: 'rita@example.test', password: 'testing-password-42' });
  assert.equal((await staff('/api/auth/me')).data.user.teamStatus, 'removed');
  assert.equal((await staff('/api/customers')).status, 403);

  const second = (await owner('/api/team/invites', { name: 'Kalle', email: 'kalle@example.test' }))
    .data.code;
  assert.equal((await owner(`/api/team/invites/${second}`, {}, 'DELETE')).status, 200);
  assert.equal((await stranger(`/api/invites/${second}`)).status, 404);

  const other = client();
  await garage(other, 'other@example.test');
  assert.equal(
    (await other(`/api/team/members/${member.id}`, { active: true }, 'PUT')).status,
    404,
  );
});

test('memberships: Basic and own plan, cars, cancel, keep, refund, offering switch, updates', async (t) => {
  let now = Date.now();
  const { client } = await fixture(t, { clock: () => now }),
    d = client(),
    g = client(),
    other = client();
  await signup(d, 'member@example.test');
  await signup(other, 'other@example.test');
  const gp = await garage(g);
  assert.deepEqual((await d('/api/plans')).data, []);
  await g('/api/garage/membership', {
    price: 49,
    hourly_rate: 75,
    member_rate: 68,
    perks: ['Priority booking within 5 days', 'Free annual safety check', 'Free loaner car'],
  });
  const plans = (await d('/api/plans')).data;
  assert.deepEqual(
    plans.map((p) => [p.kind, p.price_cents]),
    [
      ['basic', 1200],
      ['garage', 4900],
    ],
  );
  const own = plans[1];
  const car = (await vehicle(d)).data;
  const van = (
    await d('/api/vehicles', {
      make: 'Ford',
      model: 'Transit',
      year: 2020,
      registration: 'VAN-1',
      mileage: 5000,
    })
  ).data;
  assert.equal((await d('/api/memberships', { plan_id: own.id, vehicle_ids: [] })).status, 400);
  const joined = await d('/api/memberships', {
    plan_id: own.id,
    vehicle_ids: [car.id, van.id],
    billing: 'instalments',
  });
  assert.equal(joined.status, 201);
  assert.equal(joined.data.price_cents, 9800);
  assert.equal(
    (await d('/api/memberships', { plan_id: plans[0].id, vehicle_ids: [car.id] })).status,
    409,
  );
  const [m] = (await d('/api/memberships')).data;
  assert.equal(m.state, 'active');
  assert.equal(m.billing, 'instalments');
  assert.equal(m.vehicles.length, 2);
  assert.equal((await d(`/api/vehicles/${car.id}`, {}, 'DELETE')).status, 409);
  assert((await g('/api/notifications')).data.items.some((n) => n.title === 'New member'));

  const summary = (await g('/api/garage/membership')).data;
  assert.equal(summary.stats.subscribers, 1);
  assert.equal(summary.stats.keep_cents, Math.round(9800 * 0.7));
  assert.equal((await other(`/api/memberships/${m.id}/cancel`, {})).status, 404);

  assert.equal((await d(`/api/memberships/${m.id}/cancel`, {})).status, 200);
  assert.equal((await d('/api/memberships')).data[0].state, 'ends');
  assert.equal((await d(`/api/memberships/${m.id}/resume`, {})).status, 200);
  assert.equal((await d('/api/memberships')).data[0].state, 'active');

  assert.equal(
    (await g('/api/garage/membership', { price: 55, hourly_rate: 60, member_rate: 70 }, 'PUT'))
      .status,
    400,
  );
  await g('/api/garage/membership', { price: 55, hourly_rate: 80, member_rate: 70 }, 'PUT');
  assert.equal((await d('/api/plans')).data[1].price_cents, 5500);
  assert.equal((await d('/api/memberships')).data[0].price_cents, 9800);

  assert.equal(
    (await g('/api/garage/membership/updates', { audience: 'basic', message: 'Winter tyres!' }))
      .status,
    400,
  );
  const sent = await g('/api/garage/membership/updates', {
    audience: 'all',
    message: 'Winter tyre season starts Monday.',
  });
  assert.equal(sent.data.recipients, 1);
  assert(
    (await d('/api/notifications')).data.items.some((n) => n.title === 'News from your garage'),
  );
  assert.equal(
    (await g('/api/garage/membership/custom', { message: 'A fleet plan for taxis please.' }))
      .status,
    201,
  );

  await g('/api/garage/membership/offering', { on: false }, 'PUT');
  assert.deepEqual((await d('/api/plans')).data, []);
  const stopped = (await d('/api/memberships')).data[0];
  assert.equal(stopped.state, 'ends');
  assert.equal(stopped.garage_stopped, true);
  assert.equal((await d(`/api/memberships/${m.id}/resume`, {})).status, 409);
  assert.equal((await g('/api/garage/profile')).data.member_rate, null);
  await g('/api/garage/membership/offering', { on: true }, 'PUT');
  assert.equal((await d('/api/memberships')).data[0].state, 'active');
  const titles = (await d('/api/notifications')).data.items.map((n) => n.title);
  assert(titles.includes('Your garage membership is ending'));
  assert(titles.includes('Your garage membership continues'));
  assert.equal(gp.id, (await g('/api/garage/profile')).data.id);

  now += 366 * 86400000;
  await d('/api/auth/login', { email: 'member@example.test', password: 'testing-password-42' });
  const renewed = (await d('/api/memberships')).data[0];
  assert.equal(renewed.status, 'active');
  assert(renewed.renews_at > new Date(now).toISOString());

  await d(`/api/memberships/${m.id}/cancel`, {});
  now += 366 * 86400000;
  await d('/api/auth/login', { email: 'member@example.test', password: 'testing-password-42' });
  assert.equal((await d('/api/memberships')).data[0].state, 'ended');

  const again = await d('/api/memberships', { plan_id: own.id, vehicle_ids: [car.id] });
  assert.equal(again.status, 201);
  const refund = await d(`/api/memberships/${again.data.id}/refund`, { reason: 'unused' });
  assert.equal(refund.data.refund_cents, 5500);
  assert.equal((await d('/api/memberships')).data[0].state, 'refunded');
  await g('/api/auth/login', { email: 'garage@example.test', password: 'testing-password-42' });
  assert((await g('/api/notifications')).data.items.some((n) => n.title === 'Refund requested'));
});

test('marketplace: post, nearby garages quote once, accept books, close, photos', async (t) => {
  const { client } = await fixture(t),
    d = client(),
    g = client(),
    far = client(),
    stranger = client();
  await signup(d, 'help@example.test');
  await signup(stranger, 'stranger@example.test');
  const gp = await garage(g);
  await garage(far, 'far@example.test');
  await far(
    '/api/garage/profile',
    {
      name: 'Far Garage',
      city: 'Oulu',
      address: 'North road 1, 90100 Oulu',
      description: 'Far away',
      services: ['Oil change'],
      published: true,
    },
    'PUT',
  );
  const car = (await vehicle(d)).data;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const base = {
    vehicle_id: car.id,
    service: 'Brake check',
    urgency: 'urgent',
    preferred_date: tomorrow,
    area: 'Tampere',
    description: 'Squeaky brakes.',
    mileage: 12100,
  };
  assert.equal(
    (await d('/api/market/requests', { ...base, preferred_date: '2020-01-01' })).status,
    400,
  );
  assert.equal((await d('/api/market/requests', { ...base, description: '' })).status, 400);
  const posted = await d('/api/market/requests', base);
  assert.equal(posted.status, 201);
  assert.equal(posted.data.garages, 1);
  const rid = posted.data.id;
  assert(
    (await g('/api/notifications')).data.items.some((n) => n.title === 'New marketplace request'),
  );
  assert.equal((await far('/api/market/garage')).data.length, 0);
  const seen = (await g('/api/market/garage')).data;
  assert.equal(seen[0].tab, 'to_quote');
  assert.equal(seen[0].registration, 'TEST-123');

  const pixel =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const photo = await d(`/api/market/requests/${rid}/photos`, { data: pixel });
  assert.equal(photo.status, 201);
  assert.equal(
    (await d(`/api/market/requests/${rid}/photos`, { data: 'data:text/html;base64,PGI+' })).status,
    400,
  );
  assert.equal((await g(photo.data.url)).status, 200);
  assert.equal((await stranger(photo.data.url)).status, 404);

  const start = new Date(Date.now() + 2 * 86400000);
  start.setUTCHours(9, 0, 0, 0);
  assert.equal(
    (
      await far(`/api/market/requests/${rid}/quotes`, {
        price: 80,
        minutes: 60,
        starts_at: start.toISOString(),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await g(`/api/market/requests/${rid}/quotes`, {
        price: 0,
        minutes: 60,
        starts_at: start.toISOString(),
      })
    ).status,
    400,
  );
  const quote = {
    price: 89.5,
    minutes: 120,
    starts_at: start.toISOString(),
    notes: 'Pads + check',
  };
  assert.equal((await g(`/api/market/requests/${rid}/quotes`, quote)).status, 201);
  assert.equal((await g(`/api/market/requests/${rid}/quotes`, quote)).status, 409);
  assert.equal((await g('/api/market/garage')).data[0].tab, 'sent');

  const mine = (await d('/api/market/requests')).data[0];
  assert.equal(mine.quotes.length, 1);
  assert.equal(mine.quotes[0].price_cents, 8950);
  assert.equal(mine.photos.length, 1);
  assert((await d('/api/notifications')).data.items.some((n) => n.title === 'New quote'));
  assert.equal((await stranger(`/api/market/quotes/${mine.quotes[0].id}/accept`, {})).status, 404);

  assert.equal((await d(`/api/market/requests/${rid}/close`, {})).status, 200);
  assert.equal(
    (await g(`/api/market/requests/${rid}/quotes`, { ...quote, price: 70 })).status,
    409,
  );
  assert(
    (await g('/api/notifications')).data.items.some(
      (n) => n.title === 'Marketplace request closed',
    ),
  );

  const accepted = await d(`/api/market/quotes/${mine.quotes[0].id}/accept`, {});
  assert.equal(accepted.status, 201);
  assert.equal((await d(`/api/market/quotes/${mine.quotes[0].id}/accept`, {})).status, 409);
  const booking = (await d('/api/bookings')).data.find((b) => b.id === accepted.data.booking_id);
  assert.equal(booking.status, 'confirmed');
  assert.equal(booking.source, 'marketplace');
  assert.equal(booking.quote_cents, 8950);
  assert.equal(booking.garage_id, gp.id);
  assert.equal((await g('/api/market/garage')).data[0].tab, 'won');
  assert((await g('/api/notifications')).data.items.some((n) => n.title === 'Quote accepted'));
  assert.equal((await d('/api/market/requests')).data[0].status, 'booked');
});

test('admin console: overview, suspend, verify, reviews, feedback, announcements, settings, audit, demo scope', async (t) => {
  const { client } = await fixture(t, { adminEmails: 'boss@example.test' }),
    admin = client(),
    d = client(),
    g = client(),
    visitor = client();
  await signup(admin, 'boss@example.test');
  await signup(d, 'driver@example.test');
  const gp = await garage(g);
  assert.equal((await d('/api/admin/overview')).status, 403);

  const overview = (await admin('/api/admin/overview')).data;
  assert.equal(overview.tiles.drivers, 2);
  assert.equal(overview.tiles.garages, 1);
  assert.equal(overview.attention.find((a) => a.section === 'garages').count, 1);

  const users = (await admin('/api/admin/users?q=driver@')).data;
  assert.equal(users.length, 1);
  const driverId = users[0].id;
  const me = (await admin('/api/admin/users?q=boss')).data[0];
  assert.equal(me.admin, true);
  assert.equal((await admin(`/api/admin/users/${me.id}/suspend`, { reason: 'Test' })).status, 403);
  assert.equal((await admin(`/api/admin/users/${driverId}/suspend`, { reason: '' })).status, 400);
  assert.equal(
    (await admin(`/api/admin/users/${driverId}/suspend`, { reason: 'Spam bookings' })).status,
    200,
  );
  assert.equal((await d('/api/auth/me')).status, 401);
  assert.equal(
    (await d('/api/auth/login', { email: 'driver@example.test', password: 'testing-password-42' }))
      .status,
    403,
  );
  await admin(`/api/admin/users/${driverId}/reactivate`, {});
  assert.equal(
    (await d('/api/auth/login', { email: 'driver@example.test', password: 'testing-password-42' }))
      .status,
    200,
  );

  assert.equal(
    (await admin(`/api/admin/garages/${gp.id}/reject`, { reason: 'No Y-tunnus' })).status,
    200,
  );
  assert.equal((await d('/api/garages')).data.length, 0);
  await admin(`/api/admin/garages/${gp.id}/verify`, {});
  const listed = (await d('/api/garages')).data;
  assert.equal(listed[0].verification, 'verified');
  assert(
    (await g('/api/notifications')).data.items.some((n) => n.title === 'Your garage is verified'),
  );

  assert.equal((await d('/api/feedback', { kind: 'problem', message: 'Bug' })).status, 400);
  assert.equal(
    (await d('/api/feedback', { kind: 'problem', message: 'The calendar skips a day.' })).status,
    201,
  );
  const [fb] = (await admin('/api/admin/feedback')).data;
  assert.equal(fb.status, 'new');
  await admin(`/api/admin/feedback/${fb.id}/checked`, {});
  assert.equal((await admin('/api/admin/feedback')).data[0].status, 'checked');

  const sent = await admin('/api/admin/announcements', {
    audience: 'garages',
    title: 'New features',
    message: 'Team access is now live for every garage.',
  });
  assert.equal(sent.data.recipients, 1);
  assert((await g('/api/notifications')).data.items.some((n) => n.title === 'New features'));
  assert(!(await d('/api/notifications')).data.items.some((n) => n.title === 'New features'));

  const settings = (await admin('/api/admin/settings')).data;
  assert.equal(settings.vat_rate, 25.5);
  assert.equal(
    (await admin('/api/admin/settings', { ...settings, motodoc_share: 25 }, 'PUT')).status,
    200,
  );
  assert.equal((await admin('/api/admin/settings')).data.motodoc_share, 25);

  const log = (await admin('/api/admin/audit')).data.map((a) => a.action);
  for (const action of [
    'Suspended account',
    'Reactivated account',
    'Rejected garage',
    'Verified garage',
    'Checked feedback',
    'Sent announcement',
    'Changed platform settings',
  ])
    assert(log.includes(action), action);

  const demo = await visitor('/api/demo', { persona: 'admin' });
  assert.equal(demo.status, 201);
  const demoUsers = (await visitor('/api/admin/users')).data;
  assert(!demoUsers.some((u) => u.email === 'driver@example.test'));
  assert(demoUsers.length >= 5);
  assert.equal((await visitor('/api/admin/audit')).data.length, 0);
  assert.equal((await visitor('/api/admin/settings', settings, 'PUT')).status, 403);
  const demoReview = (await visitor('/api/admin/reviews')).data[0];
  assert.equal(
    (await visitor(`/api/admin/reviews/${demoReview.id}/visibility`, { hidden: true })).status,
    200,
  );
  assert.equal((await visitor('/api/admin/feedback')).data.length, 1);
});

test('fuel day: setup, go live, claim rules, attendant check, use, undo, end, funnel, CSV', async (t) => {
  let now = Date.parse('2026-06-10T07:00:00Z');
  const { client } = await fixture(t, { adminEmails: 'boss@example.test', clock: () => now }),
    admin = client(),
    d = client(),
    e = client(),
    nocar = client();
  await signup(admin, 'boss@example.test');
  await signup(d, 'one@example.test');
  await signup(e, 'two@example.test');
  await signup(nocar, 'three@example.test');
  const car = (await vehicle(d)).data;
  const sameplate = (await vehicle(e)).data;
  assert.equal((await d('/api/fuel-day')).data.day, null);
  assert.equal((await d('/api/admin/fuel-days')).status, 403);

  const setup = {
    station_name: 'Neste Kamppi',
    station_address: 'Runeberginkatu 1, Helsinki',
    date: '2026-06-10',
    start_time: '10:00',
    end_time: '18:00',
    amount: 10,
    cap: 2,
  };
  assert.equal((await admin('/api/admin/fuel-days', { ...setup, end_time: '09:00' })).status, 400);
  const created = await admin('/api/admin/fuel-days', setup);
  assert.equal(created.status, 201);
  const dayId = created.data.id;
  assert.equal(
    (await d('/api/fuel-day/passes', { fuel_day_id: dayId, vehicle_id: car.id })).status,
    409,
  );
  const live = await admin(`/api/admin/fuel-days/${dayId}/live`, {});
  assert.equal(live.data.notified, 4);
  assert(
    (await d('/api/notifications')).data.items.some(
      (n) => n.title === 'Fuel Day: free fuel with MotoDoc',
    ),
  );
  const offer = (await d('/api/fuel-day')).data;
  assert.equal(offer.day.places_left, 2);
  assert.equal(offer.day.phase, 'live');

  assert.equal((await nocar('/api/fuel-day/passes', { fuel_day_id: dayId })).status, 400);
  const got = await d('/api/fuel-day/passes', { fuel_day_id: dayId, vehicle_id: car.id });
  assert.equal(got.status, 201);
  assert.match(got.data.code, /^FD-[A-Z2-9]{5}$/);
  assert.equal(
    (await d('/api/fuel-day/passes', { fuel_day_id: dayId, vehicle_id: car.id })).status,
    409,
  );
  assert.equal(
    (await e('/api/fuel-day/passes', { fuel_day_id: dayId, vehicle_id: sameplate.id })).data.error,
    'This car already has a pass.',
  );
  assert.equal((await d('/api/fuel-day')).data.pass.code, got.data.code);

  const lower = got.data.code.toLowerCase().replace('-', ' ');
  assert.equal(
    (await admin(`/api/admin/fuel-passes/${encodeURIComponent(lower)}`)).data.status,
    'valid',
  );
  assert.equal((await admin('/api/admin/fuel-passes/FD-ZZZZZ')).data.status, 'not_found');
  assert.equal((await admin(`/api/admin/fuel-passes/${got.data.code}/use`, {})).status, 200);
  const used = (await admin(`/api/admin/fuel-passes/${got.data.code}`)).data;
  assert.equal(used.status, 'used');
  assert.equal(used.pass.used_by, 'Test Driver');
  assert.equal((await admin(`/api/admin/fuel-passes/${got.data.code}/use`, {})).status, 409);
  assert.equal((await d(`/api/fuel-day/passes/${got.data.code}`, {}, 'DELETE')).status, 409);
  assert.equal((await admin(`/api/admin/fuel-passes/${got.data.code}/undo`, {})).status, 200);
  assert.equal((await d(`/api/fuel-day/passes/${got.data.code}`, {}, 'DELETE')).status, 200);
  const again = await d('/api/fuel-day/passes', { fuel_day_id: dayId, vehicle_id: car.id });
  await admin(`/api/admin/fuel-passes/${again.data.code}/use`, {});

  await d('/api/market/requests', {
    vehicle_id: car.id,
    service: 'Brake check',
    preferred_date: '2026-06-12',
    area: 'Helsinki',
    description: 'Squeaks.',
  });
  assert.equal(
    (await admin(`/api/admin/fuel-days/${dayId}`, { ...setup, cap: 0 }, 'PUT')).status,
    400,
  );
  let report = (await admin('/api/admin/fuel-days')).data;
  assert.equal(report.day.claimed, 1);
  assert.equal(report.funnel.got, 1);
  assert.equal(report.funnel.used, 1);
  assert.equal(report.funnel.quote, 1);
  assert.equal(report.funnel.verdict, 'too_early');

  now = Date.parse('2026-06-10T17:00:00Z');
  assert.equal(
    (await e('/api/fuel-day/passes', { fuel_day_id: dayId, vehicle_id: sameplate.id })).data.error,
    'This Fuel Day is over.',
  );
  await admin(`/api/admin/fuel-days/${dayId}/end`, {});
  report = (await admin('/api/admin/fuel-days')).data;
  assert.equal(report.funnel.verdict, 'meets');
  const exported = await admin(`/api/admin/fuel-days/${dayId}/export`);
  const csv = new TextDecoder().decode(exported.data);
  assert.match(csv, /^code,driver,car,plate,claimed_at,used_at,used_by,amount_eur\n/);
  assert.match(csv, /TEST-123/);
  const log = (await admin('/api/admin/audit')).data.map((a) => a.action);
  for (const action of [
    'Created Fuel Day',
    'Fuel Day live',
    'Fuel Day pass used',
    'Fuel Day pass reset',
    'Fuel Day ended',
  ])
    assert(log.includes(action), action);
});
