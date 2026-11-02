import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { FUEL_FUNNEL_DAYS, FUEL_TARGET, normalisePass } from '../src/fuelday.js';

const ZONE = 'Europe/Helsinki';
const offsetAt = (ms) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return local - Math.floor(ms / 1000) * 1000;
};
export const helsinki = (date, time) => {
  const guess = Date.parse(`${date}T${time}:00Z`);
  return guess - offsetAt(guess - offsetAt(guess));
};
const localDay = (ms) => new Date(ms + offsetAt(ms)).toISOString().slice(0, 10);
const iso = (value) =>
  !value ? null : value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
const code = () =>
  `FD-${[...randomBytes(5)].map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')}`;
const euro = (cents) => `€${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;

export function registerFuelDay(app, ctx) {
  const { one, all, run, db, transaction, fail, parse, id, clock, driverOnly, worldOf, isAdmin } =
    ctx;
  const now = () => new Date(clock()).toISOString();
  const W = (req) => req.user.demo_world || '';
  const over = (d) => d.status === 'ended' || clock() > helsinki(d.date, d.end_time);
  const phase = (d) =>
    d.status === 'ended' ? 'ended' : d.status === 'live' && over(d) ? 'over' : d.status;
  const claimed = async (dayId) =>
    Number((await one('SELECT COUNT(*) n FROM fuel_passes WHERE fuel_day_id=?', dayId)).n);
  const dayView = async (d) => ({
    ...d,
    phase: phase(d),
    claimed: await claimed(d.id),
    used: Number(
      (
        await one(
          'SELECT COUNT(*) n FROM fuel_passes WHERE fuel_day_id=? AND used_at IS NOT NULL',
          d.id,
        )
      ).n,
    ),
    starts_at: new Date(helsinki(d.date, d.start_time)).toISOString(),
    ends_at: new Date(helsinki(d.date, d.end_time)).toISOString(),
  });
  const audit = (req, action, target = '', detail = '') =>
    run(
      'INSERT INTO admin_audit(id,world,admin_id,admin_name,action,target,detail,at) VALUES(?,?,?,?,?,?,?,?)',
      id(),
      W(req),
      req.user.id,
      req.user.name,
      action,
      target,
      detail,
      now(),
    );
  const adminOnly = (req) => {
    if (!isAdmin(req.user)) throw fail(403, 'Only MotoDoc administrators can do this.');
  };

  app.get('/api/fuel-day', async (req, res) => {
    driverOnly(req.user);
    const day =
      (await one(
        "SELECT * FROM fuel_days WHERE world=? AND status='live' ORDER BY date DESC LIMIT 1",
        W(req),
      )) ||
      (await one(
        `SELECT d.* FROM fuel_days d JOIN fuel_passes p ON p.fuel_day_id=d.id WHERE d.world=? AND p.driver_id=? AND d.date>=? ORDER BY d.date DESC LIMIT 1`,
        W(req),
        req.user.id,
        localDay(clock() - 7 * 86400000),
      ));
    if (!day) return res.json({ day: null, pass: null });
    const pass = await one(
      'SELECT * FROM fuel_passes WHERE fuel_day_id=? AND driver_id=?',
      day.id,
      req.user.id,
    );
    const view = await dayView(day);
    res.json({ day: { ...view, places_left: Math.max(0, day.cap - view.claimed) }, pass });
  });

  app.post('/api/fuel-day/passes', async (req, res) => {
    driverOnly(req.user);
    const { vehicle_id, fuel_day_id } = parse(
      z.object({
        fuel_day_id: z.string().min(1).max(64),
        vehicle_id: z.string().max(64).default(''),
      }),
      req,
    );
    const car = vehicle_id
      ? await one('SELECT * FROM vehicles WHERE id=? AND owner_id=?', vehicle_id, req.user.id)
      : null;
    if (!car?.registration) throw fail(400, 'Add your car first, with its plate number.');
    const day = await one('SELECT * FROM fuel_days WHERE id=? AND world=?', fuel_day_id, W(req));
    if (!day || day.status === 'draft') throw fail(409, 'This Fuel Day isn’t open yet.');
    if (over(day)) throw fail(409, 'This Fuel Day is over.');
    if (
      await one(
        'SELECT 1 FROM fuel_passes WHERE fuel_day_id=? AND driver_id=?',
        day.id,
        req.user.id,
      )
    )
      throw fail(409, 'You already have a pass.');
    const plate = car.registration.toUpperCase();
    if (await one('SELECT 1 FROM fuel_passes WHERE fuel_day_id=? AND plate=?', day.id, plate))
      throw fail(409, 'This car already has a pass.');
    const passCode = code();
    await transaction(db, async () => {
      if ((await claimed(day.id)) >= day.cap) throw fail(409, 'All passes are taken.');
      await run(
        'INSERT INTO fuel_passes(code,fuel_day_id,driver_id,vehicle_id,car_label,plate,claimed_at) VALUES(?,?,?,?,?,?,?)',
        passCode,
        day.id,
        req.user.id,
        car.id,
        `${car.make} ${car.model}`,
        plate,
        now(),
      );
    });
    res.status(201).json({ code: passCode });
  });

  app.delete('/api/fuel-day/passes/:code', async (req, res) => {
    driverOnly(req.user);
    const pass = await one(
      'SELECT * FROM fuel_passes WHERE code=? AND driver_id=?',
      normalisePass(req.params.code),
      req.user.id,
    );
    if (!pass) throw fail(404, 'Pass not found.');
    if (pass.used_at) throw fail(409, 'This pass was already used at the pump.');
    await run('DELETE FROM fuel_passes WHERE code=?', pass.code);
    res.json({ ok: true });
  });

  const dayIn = async (req) => {
    adminOnly(req);
    const d = await one('SELECT * FROM fuel_days WHERE id=? AND world=?', req.params.id, W(req));
    if (!d) throw fail(404, 'Fuel Day not found.');
    return d;
  };
  const daySchema = z
    .object({
      station_name: z.string().trim().min(2, 'Add the station name.').max(100),
      station_address: z.string().trim().min(3, 'Add the station address.').max(200),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.'),
      start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a start time.'),
      end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Choose an end time.'),
      amount: z.number().min(1, 'Fuel per pass must be at least €1.').max(500),
      cap: z.number().int().min(1, 'Allow at least one pass.').max(100000),
    })
    .refine((d) => d.end_time > d.start_time, {
      message: 'The end time must be after the start time.',
      path: ['end_time'],
    });

  const funnel = async (d) => {
    const passes = await all('SELECT * FROM fuel_passes WHERE fuel_day_id=?', d.id);
    const rows = { got: 0, used: 0, quote: 0, booking: 0, membership: 0, either: 0 };
    let eligible = 0;
    for (const p of passes) {
      const start = iso(p.claimed_at);
      const end = new Date(Date.parse(start) + FUEL_FUNNEL_DAYS * 86400000).toISOString();
      const before = (
        await all('SELECT created_at FROM bookings WHERE driver_id=?', p.driver_id)
      ).some((b) => iso(b.created_at) < start);
      if (before) continue;
      eligible += 1;
      rows.got += 1;
      if (p.used_at) rows.used += 1;
      const inWindow = (list) =>
        list.some((r) => {
          const at = iso(r.at);
          return at >= start && at <= end;
        });
      const quote = inWindow(
        await all('SELECT created_at at FROM market_requests WHERE driver_id=?', p.driver_id),
      );
      const booking = inWindow(
        await all('SELECT created_at at FROM bookings WHERE driver_id=?', p.driver_id),
      );
      const membership = inWindow(
        await all('SELECT member_since at FROM memberships WHERE driver_id=?', p.driver_id),
      );
      if (quote) rows.quote += 1;
      if (booking) rows.booking += 1;
      if (membership) rows.membership += 1;
      if (quote || booking) rows.either += 1;
    }
    const rate = eligible ? rows.either / eligible : 0;
    const done = phase(d) === 'ended' || phase(d) === 'over';
    return {
      ...rows,
      excluded: passes.length - eligible,
      rate,
      verdict: !done || !eligible ? 'too_early' : rate >= FUEL_TARGET ? 'meets' : 'below',
    };
  };

  app.get('/api/admin/fuel-days', async (req, res) => {
    adminOnly(req);
    const days = await all('SELECT * FROM fuel_days WHERE world=? ORDER BY date DESC', W(req));
    const pick =
      days.find((d) => d.id === req.query.id) || days.find((d) => d.status === 'live') || days[0];
    if (!pick) return res.json({ days: [], day: null });
    res.json({
      days: await Promise.all(days.map(dayView)),
      day: await dayView(pick),
      passes: await all(
        'SELECT p.*,u.name driver_name FROM fuel_passes p JOIN users u ON u.id=p.driver_id WHERE p.fuel_day_id=? ORDER BY p.claimed_at DESC',
        pick.id,
      ),
      funnel: await funnel(pick),
    });
  });

  app.post('/api/admin/fuel-days', async (req, res) => {
    adminOnly(req);
    const d = parse(daySchema, req);
    const key = id();
    await transaction(db, async () => {
      await run(
        'INSERT INTO fuel_days(id,world,station_name,station_address,date,start_time,end_time,amount_cents,cap,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        key,
        W(req),
        d.station_name,
        d.station_address,
        d.date,
        d.start_time,
        d.end_time,
        Math.round(d.amount * 100),
        d.cap,
        now(),
        req.user.id,
      );
      await audit(req, 'Created Fuel Day', d.station_name, d.date);
    });
    res.status(201).json({ id: key });
  });

  app.put('/api/admin/fuel-days/:id', async (req, res) => {
    const day = await dayIn(req);
    if (day.status === 'ended') throw fail(409, 'This Fuel Day has ended.');
    const d = parse(daySchema, req);
    if (d.cap < (await claimed(day.id)))
      throw fail(400, 'You can’t have fewer passes than drivers have already claimed.');
    await transaction(db, async () => {
      await run(
        'UPDATE fuel_days SET station_name=?,station_address=?,date=?,start_time=?,end_time=?,amount_cents=?,cap=? WHERE id=?',
        d.station_name,
        d.station_address,
        d.date,
        d.start_time,
        d.end_time,
        Math.round(d.amount * 100),
        d.cap,
        day.id,
      );
      await audit(req, 'Updated Fuel Day', d.station_name, d.date);
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/fuel-days/:id/live', async (req, res) => {
    const day = await dayIn(req);
    if (day.status !== 'draft') throw fail(409, 'This Fuel Day is already live or ended.');
    if (over(day)) throw fail(409, 'Pick a date and time that hasn’t passed yet.');
    if (await one("SELECT 1 FROM fuel_days WHERE world=? AND status='live'", W(req)))
      throw fail(409, 'Another Fuel Day is live. End it first.');
    const drivers = await all(
      `SELECT u.id FROM users u WHERE u.role='driver' AND u.suspended_at IS NULL AND ${worldOf('u.id')}=?`,
      W(req),
    );
    await transaction(db, async () => {
      await run("UPDATE fuel_days SET status='live',live_at=? WHERE id=?", now(), day.id);
      for (const u of drivers)
        await run(
          "INSERT INTO notices(id,user_id,kind,title,body,at,link) VALUES(?,?,'fuel','Fuel Day: free fuel with MotoDoc',?,?,'#fuel-day')",
          id(),
          u.id,
          `Get ${euro(day.amount_cents)} of fuel at ${day.station_name} on ${day.date}, ${day.start_time}–${day.end_time}. Places are limited.`,
          now(),
        );
      await audit(req, 'Fuel Day live', day.station_name, `${drivers.length} drivers notified`);
    });
    res.json({ ok: true, notified: drivers.length });
  });

  app.post('/api/admin/fuel-days/:id/end', async (req, res) => {
    const day = await dayIn(req);
    if (day.status === 'ended') throw fail(409, 'This Fuel Day has already ended.');
    await transaction(db, async () => {
      await run("UPDATE fuel_days SET status='ended',ended_at=? WHERE id=?", now(), day.id);
      await audit(req, 'Fuel Day ended', day.station_name);
    });
    res.json({ ok: true });
  });

  const passIn = async (req) => {
    adminOnly(req);
    const passCode = normalisePass(req.params.code);
    const p = await one(
      'SELECT p.*,u.name driver_name,d.date,d.status day_status,d.amount_cents,d.start_time,d.end_time,d.station_name FROM fuel_passes p JOIN fuel_days d ON d.id=p.fuel_day_id JOIN users u ON u.id=p.driver_id WHERE p.code=? AND d.world=?',
      passCode,
      W(req),
    );
    return { passCode, p };
  };
  const checkOf = (p) =>
    p.used_at
      ? 'used'
      : p.day_status === 'ended'
        ? 'ended'
        : p.date !== localDay(clock())
          ? 'not_today'
          : 'valid';

  app.get('/api/admin/fuel-passes/:code', async (req, res) => {
    const { passCode, p } = await passIn(req);
    if (!p) return res.json({ status: 'not_found', code: passCode });
    res.json({ status: checkOf(p), pass: p });
  });

  app.post('/api/admin/fuel-passes/:code/use', async (req, res) => {
    const { p } = await passIn(req);
    if (!p) throw fail(404, 'No pass with this code.');
    const status = checkOf(p);
    if (status === 'used') throw fail(409, 'This pass was already used.');
    if (status === 'ended')
      throw fail(409, 'This Fuel Day has ended, so the pass no longer works.');
    if (status === 'not_today') throw fail(409, `This pass is for ${p.date}.`);
    await transaction(db, async () => {
      await run(
        'UPDATE fuel_passes SET used_at=?,used_by=? WHERE code=?',
        now(),
        req.user.name,
        p.code,
      );
      await audit(req, 'Fuel Day pass used', p.code, `${p.plate} · ${euro(p.amount_cents)}`);
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/fuel-passes/:code/undo', async (req, res) => {
    const { p } = await passIn(req);
    if (!p?.used_at) throw fail(409, 'This pass isn’t marked as used.');
    await transaction(db, async () => {
      await run("UPDATE fuel_passes SET used_at=NULL,used_by='' WHERE code=?", p.code);
      await audit(req, 'Fuel Day pass reset', p.code);
    });
    res.json({ ok: true });
  });

  app.get('/api/admin/fuel-days/:id/export', async (req, res) => {
    const day = await dayIn(req);
    const rows = await all(
      'SELECT p.*,u.name driver_name FROM fuel_passes p JOIN users u ON u.id=p.driver_id WHERE p.fuel_day_id=? ORDER BY p.claimed_at',
      day.id,
    );
    const cell = (v) => {
      const s = String(v ?? '');
      return /[",\n]|^[=+\-@]/.test(s)
        ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`
        : s;
    };
    const csv = [
      ['code', 'driver', 'car', 'plate', 'claimed_at', 'used_at', 'used_by', 'amount_eur'],
      ...rows.map((p) => [
        p.code,
        p.driver_name,
        p.car_label,
        p.plate,
        p.claimed_at,
        p.used_at || '',
        p.used_by,
        p.used_at ? (day.amount_cents / 100).toFixed(2) : '',
      ]),
    ]
      .map((r) => r.map(cell).join(','))
      .join('\n');
    res
      .set('Content-Disposition', `attachment; filename="fuel-day-${day.date}.csv"`)
      .type('text/csv')
      .send(csv);
  });
}
