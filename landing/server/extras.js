import { createHash } from 'node:crypto';
import { z } from 'zod';
import { FREE_LIMITS } from '../src/extras.js';
import { platformSettings } from './admin.js';

const DAY = 86400000;
const iso = (value) =>
  !value ? null : value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;

export const effectivePlan = (chosen, launchBonus) =>
  chosen === 'free' ? 'free' : launchBonus ? 'pro' : chosen === 'pro_paid' ? 'pro' : 'free';

export function recommendationsFor(vehicle, records, condition, now) {
  const today = new Date(now).toISOString().slice(0, 10);
  const month = new Date(now).getUTCMonth() + 1;
  const daysUntil = (date) => Math.round((Date.parse(`${date}T12:00:00Z`) - now) / DAY);
  const addDays = (ms, days) => new Date(ms + days * DAY).toISOString().slice(0, 10);
  const lastOf = (pattern) =>
    records
      .filter((r) => pattern.test(`${r.service} ${r.summary}`))
      .sort((a, b) => (iso(a.performed_at) < iso(b.performed_at) ? 1 : -1))[0];
  const byDays = (days) =>
    days < 0 ? 'overdue' : days <= 30 ? 'due_soon' : days <= 90 ? 'upcoming' : 'on_track';
  const items = [];

  const oil = lastOf(/oil|öljy|annual service|huolto/i);
  const oilKm = oil ? vehicle.mileage - oil.mileage : null;
  const oilDays = oil ? Math.round((now - Date.parse(iso(oil.performed_at))) / DAY) : null;
  let oilPriority = 'upcoming';
  if (condition?.oil_life != null)
    oilPriority =
      condition.oil_life <= 5
        ? 'overdue'
        : condition.oil_life <= 20
          ? 'due_soon'
          : condition.oil_life <= 40
            ? 'upcoming'
            : 'on_track';
  else if (oil)
    oilPriority =
      oilKm >= 15000 || oilDays >= 365
        ? 'overdue'
        : oilKm >= 13000 || oilDays >= 330
          ? 'due_soon'
          : oilKm >= 10000 || oilDays >= 270
            ? 'upcoming'
            : 'on_track';
  items.push({
    id: 'oil',
    title: 'Oil change',
    service: 'Oil change',
    priority: oilPriority,
    estimate: [60, 120],
    last_done: oil ? { date: iso(oil.performed_at).slice(0, 10), mileage: oil.mileage } : null,
    interval: 'Every 15 000 km or once a year',
    next_due: oil
      ? `${(oil.mileage + 15000).toLocaleString('en-FI')} km or ${addDays(Date.parse(iso(oil.performed_at)), 365)}`
      : condition?.oil_life != null
        ? `Oil life ${condition.oil_life}%`
        : 'No oil change on record',
    why: 'Old oil wears the engine faster and can lead to expensive repairs.',
    tip: 'Check the oil level every few fill-ups, and before long trips.',
  });

  if (condition?.brake_wear != null || vehicle.mileage) {
    const wear = condition?.brake_wear;
    const brakes = lastOf(/brake|jarru/i);
    const sinceKm = brakes ? vehicle.mileage - brakes.mileage : vehicle.mileage;
    items.push({
      id: 'brakes',
      title: 'Brake check',
      service: 'Brake check',
      priority:
        wear != null
          ? wear >= 90
            ? 'overdue'
            : wear >= 75
              ? 'due_soon'
              : wear >= 50
                ? 'upcoming'
                : 'on_track'
          : sinceKm >= 30000
            ? 'due_soon'
            : 'on_track',
      estimate: [40, 250],
      last_done: brakes
        ? { date: iso(brakes.performed_at).slice(0, 10), mileage: brakes.mileage }
        : null,
      interval: 'Check every 30 000 km or when they squeak',
      next_due:
        wear != null
          ? `Brake wear ${wear}%`
          : `${sinceKm.toLocaleString('en-FI')} km since the last check`,
      why: 'Worn pads take longer to stop the car and can damage the discs.',
      tip: 'Squeaking, grinding or a soft pedal means it’s time for a check.',
    });
  }

  if (condition?.mot_due) {
    const days = daysUntil(condition.mot_due);
    items.push({
      id: 'inspection',
      title: 'Inspection (katsastus)',
      service: 'Inspection prep',
      priority: byDays(days),
      estimate: [50, 90],
      last_done: null,
      interval: 'Set by Traficom for your car',
      next_due: condition.mot_due,
      why: 'Driving without a valid inspection can get you fined and void your insurance.',
      tip: 'A pre-inspection check at your garage helps you pass first time.',
    });
  }

  const winter = month >= 10 || month <= 2;
  const tyres = lastOf(/tyre|tire|rengas|renkaat/i);
  const seasonDone = tyres && now - Date.parse(iso(tyres.performed_at)) < 120 * DAY;
  if (month >= 3 && month <= 5) {
    items.push({
      id: 'summer-tyres',
      title: 'Summer tyres',
      service: 'Tyre change',
      priority: seasonDone ? 'on_track' : month === 5 ? 'due_soon' : 'upcoming',
      estimate: [40, 80],
      last_done: tyres
        ? { date: iso(tyres.performed_at).slice(0, 10), mileage: tyres.mileage }
        : null,
      interval: 'Twice a year',
      next_due: 'After the snow, usually April–May',
      why: 'Studded tyres must come off after the season ends, and summer tyres grip better on dry roads.',
      tip: 'Book early; garages get busy when the weather turns.',
    });
  } else if (winter || month >= 9) {
    const deadline = `${new Date(now).getUTCFullYear()}-12-01`;
    items.push({
      id: 'winter-tyres',
      title: 'Winter tyres',
      service: 'Tyre change',
      priority: seasonDone
        ? 'on_track'
        : month >= 12 || month <= 2
          ? 'overdue'
          : month === 11 || month === 10
            ? 'due_soon'
            : 'upcoming',
      estimate: [40, 80],
      last_done: tyres
        ? { date: iso(tyres.performed_at).slice(0, 10), mileage: tyres.mileage }
        : null,
      interval: 'Twice a year',
      next_due: month <= 2 ? 'Now' : `By ${deadline}`,
      why: 'Winter tyres are required by law in Finland from December to February when conditions call for them.',
      tip: 'Check the tread depth: at least 3 mm for winter tyres, more is safer.',
    });
  }

  const service = lastOf(/annual service|service|huolto/i);
  const serviceDays = service
    ? Math.round((now - Date.parse(iso(service.performed_at))) / DAY)
    : null;
  items.push({
    id: 'service',
    title: 'Annual service',
    service: 'Annual service',
    priority:
      serviceDays == null
        ? vehicle.year <= new Date(now).getUTCFullYear() - 2
          ? 'due_soon'
          : 'upcoming'
        : serviceDays >= 365
          ? 'overdue'
          : serviceDays >= 330
            ? 'due_soon'
            : serviceDays >= 270
              ? 'upcoming'
              : 'on_track',
    estimate: [180, 400],
    last_done: service
      ? { date: iso(service.performed_at).slice(0, 10), mileage: service.mileage }
      : null,
    interval: 'Once a year',
    next_due: service
      ? addDays(Date.parse(iso(service.performed_at)), 365)
      : 'No service on record',
    why: 'A yearly service catches small problems before they become big ones, and keeps the warranty valid.',
    tip: 'Keep every service in MotoDoc: a full history helps when you sell the car.',
  });
  const order = ['overdue', 'due_soon', 'upcoming', 'on_track'];
  return items
    .sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority))
    .map((item) => ({ ...item, today }));
}

export function registerExtras(app, ctx) {
  const { one, all, run, fail, parse, id, clock, driverOnly, ownerGarage } = ctx;
  const now = () => new Date(clock()).toISOString();
  const refCode = (userId) =>
    createHash('sha256').update(`ref:${userId}`).digest('hex').slice(0, 8).toUpperCase();

  const usage = async (user) => {
    if (user.role === 'driver') {
      const month = now().slice(0, 7);
      return {
        vehicles: Number(
          (
            await one(
              'SELECT COUNT(*) n FROM vehicles WHERE owner_id=? AND archived_at IS NULL',
              user.id,
            )
          ).n,
        ),
        bookings: (await all('SELECT created_at FROM bookings WHERE driver_id=?', user.id)).filter(
          (b) => iso(b.created_at).startsWith(month),
        ).length,
      };
    }
    return {
      customers: Number(
        (
          await one(
            'SELECT COUNT(DISTINCT driver_id) n FROM bookings WHERE garage_id=?',
            user.garage_id,
          )
        ).n,
      ),
    };
  };

  app.get('/api/subscription', async (req, res) => {
    const settings = await platformSettings(all);
    const row = await one(
      'SELECT plan,plan_period,plan_changed_at FROM user_settings WHERE user_id=?',
      req.user.id,
    );
    const role = req.user.role === 'garage' ? 'garage' : 'driver';
    res.json({
      role,
      plan: effectivePlan(row?.plan || '', settings.launch_bonus),
      period: row?.plan_period || 'monthly',
      changed_at: row?.plan_changed_at || null,
      launch_bonus: settings.launch_bonus,
      price_month: role === 'garage' ? settings.pro_price_garage : settings.pro_price_driver,
      limits: FREE_LIMITS,
      usage: await usage(req.user),
      can_change: !req.user.staff_role,
    });
  });

  app.put('/api/subscription', async (req, res) => {
    if (req.user.staff_role) throw fail(403, 'Only the garage owner can change the plan.');
    const d = parse(
      z.object({ plan: z.enum(['free', 'pro']), period: z.enum(['monthly', 'yearly']) }),
      req,
    );
    const settings = await platformSettings(all);
    if (d.plan === 'pro' && !settings.launch_bonus)
      throw fail(
        402,
        'Pro can’t be bought yet because online payments aren’t connected. It will be available soon.',
      );
    await run(
      'INSERT INTO user_settings(user_id,plan,plan_period,plan_changed_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,plan_period=excluded.plan_period,plan_changed_at=excluded.plan_changed_at',
      req.user.id,
      d.plan,
      d.period,
      now(),
    );
    res.json({ plan: d.plan });
  });

  const freeLimit = async (user, kind) => {
    const row = await one('SELECT plan FROM user_settings WHERE user_id=?', user.id);
    const settings = await platformSettings(all);
    if (effectivePlan(row?.plan || '', settings.launch_bonus) === 'pro') return;
    const used = await usage(user);
    if (kind === 'vehicles' && used.vehicles >= FREE_LIMITS.vehicles)
      throw fail(
        403,
        `The Free plan covers up to ${FREE_LIMITS.vehicles} cars. Switch to Pro under Plan to add more.`,
      );
    if (kind === 'bookings' && used.bookings >= FREE_LIMITS.bookings)
      throw fail(
        403,
        `The Free plan covers up to ${FREE_LIMITS.bookings} bookings a month. Switch to Pro under Plan for more.`,
      );
  };

  app.get('/api/recommendations', async (req, res) => {
    driverOnly(req.user);
    const vehicles = await all(
      'SELECT * FROM vehicles WHERE owner_id=? AND archived_at IS NULL ORDER BY registration',
      req.user.id,
    );
    const out = [];
    for (const v of vehicles) {
      const records = await all(
        'SELECT r.summary,r.mileage,r.performed_at,b.service FROM service_records r JOIN bookings b ON b.id=r.booking_id WHERE r.vehicle_id=?',
        v.id,
      );
      const condition = await one('SELECT * FROM vehicle_condition WHERE vehicle_id=?', v.id);
      out.push({
        vehicle: {
          id: v.id,
          make: v.make,
          model: v.model,
          registration: v.registration,
          mileage: v.mileage,
        },
        mot_due: condition?.mot_due || null,
        items: recommendationsFor(v, records, condition, clock()),
      });
    }
    res.json(out);
  });

  app.get('/api/referrals', async (req, res) => {
    if (req.user.role === 'garage') await ownerGarage(req.user, 'memberships');
    const code = refCode(req.user.id);
    await run(
      "UPDATE user_settings SET ref_code=? WHERE user_id=? AND ref_code=''",
      code,
      req.user.id,
    );
    res.json({
      code,
      invites: await all(
        'SELECT id,email,kind,created_at,resent_at,joined_at FROM referrals WHERE user_id=? ORDER BY created_at DESC',
        req.user.id,
      ),
    });
  });

  app.post('/api/referrals', async (req, res) => {
    if (req.user.role === 'garage') await ownerGarage(req.user, 'memberships');
    const d = parse(
      z.object({
        email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
        kind: z.enum(['driver', 'garage']),
      }),
      req,
    );
    if (d.email === String(req.user.email).toLowerCase())
      throw fail(400, 'That’s your own email address.');
    if (await one('SELECT 1 FROM referrals WHERE user_id=? AND email=?', req.user.id, d.email))
      throw fail(409, 'You’ve already invited this email.');
    const existing = await one('SELECT id FROM users WHERE email=?', d.email);
    await run(
      'INSERT INTO referrals(id,user_id,email,kind,created_at,joined_user_id,joined_at) VALUES(?,?,?,?,?,?,?)',
      id(),
      req.user.id,
      d.email,
      d.kind,
      now(),
      existing ? existing.id : null,
      existing ? now() : null,
    );
    res.status(201).json({ already: !!existing });
  });

  app.post('/api/referrals/:id/resend', async (req, res) => {
    const r = await one(
      'SELECT * FROM referrals WHERE id=? AND user_id=?',
      req.params.id,
      req.user.id,
    );
    if (!r) throw fail(404, 'Invite not found.');
    await run('UPDATE referrals SET resent_at=? WHERE id=?', now(), r.id);
    res.json({ ok: true });
  });

  const joined = async (user, ref) => {
    const inviter = ref
      ? await one('SELECT user_id FROM user_settings WHERE ref_code=?', String(ref).toUpperCase())
      : null;
    if (inviter && inviter.user_id !== user.id)
      await run('UPDATE user_settings SET referred_by=? WHERE user_id=?', inviter.user_id, user.id);
    await run(
      'UPDATE referrals SET joined_user_id=?,joined_at=? WHERE email=? AND joined_user_id IS NULL',
      user.id,
      now(),
      String(user.email).toLowerCase(),
    );
    if (inviter && inviter.user_id !== user.id)
      await run(
        'INSERT OR IGNORE INTO referrals(id,user_id,email,kind,created_at,joined_user_id,joined_at) VALUES(?,?,?,?,?,?,?)',
        id(),
        inviter.user_id,
        String(user.email).toLowerCase(),
        user.role,
        now(),
        user.id,
        now(),
      );
  };

  return { freeLimit, joined };
}
