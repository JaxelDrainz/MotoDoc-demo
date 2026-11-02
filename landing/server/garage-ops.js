import { z } from 'zod';
import {
  SPECIALIZATIONS,
  WEEKDAYS,
  defaultHours,
  hoursProblem,
  validBusinessId,
} from '../src/finland.js';

export const TIME_ZONE = 'Europe/Helsinki';
export const SLOT_HOURS = [8, 9, 10, 11, 13, 14, 15, 16];
const KEYS = WEEKDAYS.map(([key]) => key);

const parts = (time) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(time))
      .map((p) => [p.type, p.value]),
  );
export const localDate = (time) => {
  const p = parts(time);
  return `${p.year}-${p.month}-${p.day}`;
};
export const localHour = (time) => Number(parts(time).hour);
export const weekdayKey = (date) => KEYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
export function zonedTime(date, hour) {
  const [y, m, d] = date.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, hour);
  for (let i = 0; i < 2; i++) {
    const p = parts(guess);
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    guess += Date.UTC(y, m - 1, d, hour) - shown;
  }
  return guess;
}
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function dayStatus({ hours, blocked, online }, date) {
  if (!online) return { status: 'offline', reason: 'The garage isn’t taking bookings right now.' };
  const block = blocked.find((b) => b.date === date);
  if (block) return { status: 'blocked', reason: block.reason || 'Closed this day.' };
  const day = hours[weekdayKey(date)];
  if (!day?.open) return { status: 'closed', reason: 'The garage is closed on this weekday.' };
  return { status: 'open', from: day.from, to: day.to };
}

export function slotsFor(schedule, date, busy, now) {
  const info = dayStatus(schedule, date);
  if (info.status !== 'open') return { ...info, slots: [] };
  const slots = SLOT_HOURS.filter(
    (h) => h * 60 >= toMinutes(info.from) && h * 60 + 60 <= toMinutes(info.to),
  )
    .map((h) => zonedTime(date, h))
    .filter((t) => t > now && !busy.has(new Date(t).toISOString()))
    .map((t) => new Date(t).toISOString());
  return {
    ...info,
    slots,
    reason: slots.length ? undefined : 'No times left on this day.',
  };
}

export function openNow(schedule, now) {
  const info = dayStatus(schedule, localDate(now));
  if (info.status !== 'open') return false;
  const p = parts(now);
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  return minutes >= toMinutes(info.from) && minutes < toMinutes(info.to);
}

export function registerGarageOps(app, ctx) {
  const {
    one,
    all,
    run,
    db,
    transaction,
    fail,
    parse,
    id,
    clock,
    ownGarage,
    ownerGarage,
    text,
    optional,
  } = ctx;

  const schedule = async (garageId) => {
    const details = await one(
      'SELECT hours,online FROM garage_details WHERE garage_id=?',
      garageId,
    );
    return {
      hours: details?.hours ? JSON.parse(details.hours) : defaultHours(),
      online: details ? details.online !== 0 : true,
      blocked: await all(
        'SELECT date,reason FROM garage_blocked WHERE garage_id=? ORDER BY date',
        garageId,
      ),
    };
  };
  const busySet = async (garageId, from, to) =>
    new Set(
      (
        await all(
          "SELECT starts_at FROM bookings WHERE garage_id=? AND status IN ('pending','confirmed') AND starts_at>=? AND starts_at<?",
          garageId,
          new Date(from).toISOString(),
          new Date(to).toISOString(),
        )
      ).map((r) => new Date(r.starts_at).toISOString()),
    );

  const checkSlot = async (garageId, startsAt) => {
    const time = Date.parse(startsAt);
    const sched = await schedule(garageId);
    const date = localDate(time);
    const info = dayStatus(sched, date);
    if (info.status !== 'open') throw fail(400, info.reason);
    const hour = localHour(time);
    if (hour * 60 < toMinutes(info.from) || hour * 60 + 60 > toMinutes(info.to))
      throw fail(400, 'Choose a time inside the garage’s opening hours.');
  };

  const syncServiceNames = async (garageId) => {
    const names = (
      await all(
        'SELECT name FROM garage_services WHERE garage_id=? AND active=1 ORDER BY sort,name',
        garageId,
      )
    ).map((r) => r.name);
    await run('UPDATE garages SET services=? WHERE id=?', JSON.stringify(names), garageId);
  };
  const menu = async (garageId, activeOnly = false) =>
    (
      await all(
        `SELECT id,name,price_min_cents,price_max_cents,minutes,description,active FROM garage_services WHERE garage_id=?${activeOnly ? ' AND active=1' : ''} ORDER BY sort,name`,
        garageId,
      )
    ).map((r) => ({ ...r, active: !!r.active }));

  app.get('/api/garages/:id/availability', async (req, res) => {
    const days = Math.min(Number(req.query.days) || 14, 90);
    const now = clock();
    const sched = await schedule(req.params.id);
    const start = localDate(now);
    const dates = Array.from({ length: days }, (_, i) =>
      localDate(zonedTime(start, 12) + i * 86400000),
    );
    const busy = await busySet(req.params.id, now - 86400000, now + (days + 1) * 86400000);
    res.json(dates.map((date) => ({ date, ...slotsFor(sched, date, busy, now) })));
  });

  app.get('/api/garage/schedule', async (req, res) => {
    const g = await ownGarage(req.user);
    const sched = await schedule(g.id);
    res.json({ ...sched, open_now: openNow(sched, clock()) });
  });
  const hoursSchema = z
    .object(
      Object.fromEntries(
        KEYS.map((key) => [
          key,
          z.object({
            open: z.boolean(),
            from: z.string().regex(/^\d{2}:\d{2}$/),
            to: z.string().regex(/^\d{2}:\d{2}$/),
          }),
        ]),
      ),
    )
    .superRefine((hours, issue) => {
      const problem = hoursProblem(hours);
      if (problem) issue.addIssue({ code: 'custom', message: problem });
    });
  const saveDetail = async (garageId, field, value) => {
    await run('INSERT OR IGNORE INTO garage_details(garage_id) VALUES(?)', garageId);
    await run(`UPDATE garage_details SET ${field}=? WHERE garage_id=?`, value, garageId);
  };
  app.put('/api/garage/hours', async (req, res) => {
    const g = await ownerGarage(req.user, 'services');
    const { hours } = parse(z.object({ hours: hoursSchema }), req);
    await saveDetail(g.id, 'hours', JSON.stringify(hours));
    await run(
      'INSERT INTO garage_contact(garage_id,opening_hours) VALUES(?,?) ON CONFLICT(garage_id) DO UPDATE SET opening_hours=excluded.opening_hours',
      g.id,
      KEYS.filter((k) => hours[k].open)
        .map((k) => `${k[0].toUpperCase()}${k.slice(1)} ${hours[k].from}–${hours[k].to}`)
        .join(', '),
    );
    res.json({ ok: true });
  });
  app.put('/api/garage/details', async (req, res) => {
    const g = await ownerGarage(req.user, 'services');
    const keys = SPECIALIZATIONS.map(([key]) => key);
    const d = parse(
      z
        .object({
          business_id: z
            .string()
            .trim()
            .max(9)
            .default('')
            .refine(
              (v) => !v || validBusinessId(v),
              'This Business ID doesn’t look right. Check the digits, for example 1234567-1.',
            ),
          hourly_rate: z.number().positive().max(1000),
          specializations: z.array(z.enum(keys)).min(1, 'Keep at least one specialisation.'),
          main_focus: z.enum(keys),
        })
        .refine((v) => v.specializations.includes(v.main_focus), {
          message: 'Your main focus must be one of your specialisations.',
          path: ['main_focus'],
        }),
      req,
    );
    const current = await one(
      'SELECT member_rate_cents FROM garage_details WHERE garage_id=?',
      g.id,
    );
    if (current?.member_rate_cents && current.member_rate_cents > Math.round(d.hourly_rate * 100))
      throw fail(400, 'Your hourly rate can’t be lower than your member hourly rate.');
    await run('INSERT OR IGNORE INTO garage_details(garage_id) VALUES(?)', g.id);
    await run(
      'UPDATE garage_details SET business_id=?,hourly_rate_cents=?,specializations=?,main_focus=? WHERE garage_id=?',
      d.business_id,
      Math.round(d.hourly_rate * 100),
      JSON.stringify([...new Set(d.specializations)]),
      d.main_focus,
      g.id,
    );
    res.json({ ok: true });
  });
  app.put('/api/garage/online', async (req, res) => {
    const g = await ownGarage(req.user, 'bookings');
    const { online } = parse(z.object({ online: z.boolean() }), req);
    await saveDetail(g.id, 'online', Number(online));
    res.json({ ok: true });
  });
  app.post('/api/garage/blocked', async (req, res) => {
    const g = await ownGarage(req.user, 'bookings');
    const d = parse(
      z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: optional(120) }),
      req,
    );
    if (d.date < localDate(clock())) throw fail(400, 'Pick a date that hasn’t passed.');
    await run(
      'INSERT INTO garage_blocked(garage_id,date,reason) VALUES(?,?,?) ON CONFLICT(garage_id,date) DO UPDATE SET reason=excluded.reason',
      g.id,
      d.date,
      d.reason,
    );
    res.status(201).json({ ok: true });
  });
  app.delete('/api/garage/blocked/:date', async (req, res) => {
    const g = await ownGarage(req.user, 'bookings');
    await run('DELETE FROM garage_blocked WHERE garage_id=? AND date=?', g.id, req.params.date);
    res.json({ ok: true });
  });

  const serviceSchema = z
    .object({
      name: text(80),
      price_min: z.number().min(0).max(100000).nullable().optional(),
      price_max: z.number().min(0).max(100000).nullable().optional(),
      minutes: z.number().int().min(5).max(10080).nullable().optional(),
      description: optional(300),
      active: z.boolean().default(true),
    })
    .refine((s) => s.price_min == null || s.price_max == null || s.price_min <= s.price_max, {
      message: 'The lowest price can’t be higher than the highest price.',
      path: ['price_max'],
    });
  const cents = (v) => (v == null ? null : Math.round(v * 100));
  app.get('/api/garage/services', async (req, res) => {
    const g = await ownGarage(req.user);
    res.json(await menu(g.id));
  });
  app.post('/api/garage/services', async (req, res) => {
    const g = await ownerGarage(req.user, 'services');
    const d = parse(serviceSchema, req);
    if (
      await one(
        'SELECT 1 FROM garage_services WHERE garage_id=? AND lower(name)=lower(?)',
        g.id,
        d.name,
      )
    )
      throw fail(409, 'You already have a service with this name.');
    const key = id();
    await transaction(db, async () => {
      await run(
        'INSERT INTO garage_services(id,garage_id,name,price_min_cents,price_max_cents,minutes,description,active,sort) VALUES(?,?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM garage_services WHERE garage_id=?))',
        key,
        g.id,
        d.name,
        cents(d.price_min),
        cents(d.price_max),
        d.minutes ?? null,
        d.description,
        Number(d.active),
        g.id,
      );
      await syncServiceNames(g.id);
    });
    res.status(201).json({ id: key });
  });
  app.put('/api/garage/services/:id', async (req, res) => {
    const g = await ownerGarage(req.user, 'services');
    const d = parse(serviceSchema, req);
    const current = await one(
      'SELECT name FROM garage_services WHERE id=? AND garage_id=?',
      req.params.id,
      g.id,
    );
    if (!current) throw fail(404, 'Service not found.');
    await transaction(db, async () => {
      await run(
        'UPDATE garage_services SET name=?,price_min_cents=?,price_max_cents=?,minutes=?,description=?,active=? WHERE id=?',
        d.name,
        cents(d.price_min),
        cents(d.price_max),
        d.minutes ?? null,
        d.description,
        Number(d.active),
        req.params.id,
      );
      await syncServiceNames(g.id);
    });
    res.json({ ok: true });
  });
  app.delete('/api/garage/services/:id', async (req, res) => {
    const g = await ownerGarage(req.user, 'services');
    const result = await run(
      'DELETE FROM garage_services WHERE id=? AND garage_id=?',
      req.params.id,
      g.id,
    );
    if (!result.changes) throw fail(404, 'Service not found.');
    await syncServiceNames(g.id);
    res.json({ ok: true });
  });

  const publicInfo = async (garageId) => {
    const sched = await schedule(garageId);
    const details = await one(
      'SELECT hourly_rate_cents,member_rate_cents,specializations,main_focus,business_id,membership_offering,membership_launched_at FROM garage_details WHERE garage_id=?',
      garageId,
    );
    return {
      menu: await menu(garageId, true),
      hours: sched.hours,
      online: sched.online,
      open_now: openNow(sched, clock()),
      hourly_rate: details?.hourly_rate_cents ? details.hourly_rate_cents / 100 : null,
      member_rate:
        details?.member_rate_cents && details.membership_offering
          ? details.member_rate_cents / 100
          : null,
      memberships: !!(details?.membership_launched_at && details.membership_offering),
      specializations: details ? JSON.parse(details.specializations || '[]') : [],
      main_focus: details?.main_focus || '',
      verified_business: !!details?.business_id,
    };
  };

  return { checkSlot, schedule, syncServiceNames, publicInfo, menu };
}
