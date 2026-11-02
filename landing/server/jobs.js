import { z } from 'zod';

export const JOB_STAGES = ['booked', 'in_progress', 'finished', 'ready_for_pickup'];
export const REVIEW_TAGS = [
  'Quality work',
  'On time',
  'Fair price',
  'Clear communication',
  'Friendly staff',
  'Clean car on return',
];
const CHAT_HOURS = 24;
const PICKUP_HOURS = 12;

export const jobColumns =
  "COALESCE(j.requested_by,'driver') requested_by,COALESCE(j.stage,'booked') stage,COALESCE(j.mechanic,'') mechanic,j.pickup_at,COALESCE(j.pickup_note,'') pickup_note,j.completed_at,COALESCE(j.no_show,0) no_show,COALESCE(j.declined,0) declined,COALESCE(j.cancel_reason,'') cancel_reason,COALESCE(j.cancelled_by,'') cancelled_by,j.cost_cents,COALESCE(j.parts,'') parts,rv.rating review_rating,rv.comment review_comment,rv.tags review_tags,rv.reply review_reply,rv.reply_at review_reply_at";
export const jobJoins =
  'LEFT JOIN booking_jobs j ON j.booking_id=b.id LEFT JOIN reviews rv ON rv.booking_id=b.id';

export function bookingState(b, now) {
  if (b.status === 'pending') return b.requested_by === 'garage' ? 'needs_approval' : 'waiting';
  if (b.status === 'cancelled')
    return b.no_show ? 'no_show' : b.declined ? 'declined' : 'cancelled';
  if (
    b.stage === 'ready_for_pickup' &&
    b.pickup_at &&
    now < Date.parse(b.pickup_at) + PICKUP_HOURS * 3600000
  )
    return 'ready';
  if (b.status === 'completed') return 'completed';
  if (b.stage === 'in_progress') return 'in_progress';
  if (b.stage === 'finished') return 'finished';
  return 'confirmed';
}

export function decorateBooking(b, now, member) {
  const completedAt = b.completed_at || (b.status === 'completed' ? b.starts_at : null);
  const closesAt =
    completedAt && !member
      ? new Date(Date.parse(completedAt) + CHAT_HOURS * 3600000).toISOString()
      : null;
  return {
    ...b,
    no_show: !!b.no_show,
    declined: !!b.declined,
    state: bookingState(b, now),
    review_tags: b.review_tags ? JSON.parse(b.review_tags) : [],
    review_due: b.status === 'completed' && !b.review_rating,
    chat_closes_at: closesAt,
    chat_open: !closesAt || now < Date.parse(closesAt),
  };
}

export function registerJobs(app, ctx) {
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
    scopedBookings,
    bookingEvent,
    appointment,
    ownGarage,
    driverOnly,
    text,
    optional,
    checkSlot,
  } = ctx;
  const now = () => new Date(clock()).toISOString();
  const ensureJob = (bookingId, requestedBy = 'driver') =>
    run(
      'INSERT OR IGNORE INTO booking_jobs(booking_id,requested_by) VALUES(?,?)',
      bookingId,
      requestedBy,
    );
  const setJob = async (bookingId, fields) => {
    await ensureJob(bookingId);
    const keys = Object.keys(fields);
    await run(
      `UPDATE booking_jobs SET ${keys.map((k) => `${k}=?`).join(',')} WHERE booking_id=?`,
      ...Object.values(fields),
      bookingId,
    );
  };
  const find = async (req) => {
    const b = (await scopedBookings(req.user)).find((row) => row.id === req.params.id);
    if (!b) throw fail(404, 'Booking not found.');
    return b;
  };
  const garageBooking = async (req) => {
    await ownGarage(req.user);
    return find(req);
  };
  const notStarted = (b) => {
    if (b.status === 'cancelled' || b.status === 'completed' || b.stage !== 'booked')
      throw fail(409, 'Started appointments cannot be changed.');
  };
  const isoTime = z.iso.datetime();

  app.post('/api/bookings/:id/approve', async (req, res) => {
    const b = await garageBooking(req);
    const d = parse(z.object({ starts_at: isoTime.optional(), mechanic: optional(80) }), req);
    if (b.status !== 'pending' || b.requested_by === 'garage')
      throw fail(409, 'Only a waiting request can be approved.');
    const moved = d.starts_at && Date.parse(d.starts_at) !== Date.parse(b.starts_at);
    const startsAt = moved ? appointment(d.starts_at).toISOString() : b.starts_at;
    if (moved) await checkSlot(b.garage_id, startsAt);
    await transaction(db, async () => {
      await run("UPDATE bookings SET status='confirmed',starts_at=? WHERE id=?", startsAt, b.id);
      await setJob(b.id, { mechanic: d.mechanic || b.mechanic || '' });
      await bookingEvent(
        b.id,
        req.user.id,
        moved ? 'approved-new-time' : 'confirmed',
        moved ? startsAt : '',
      );
    });
    res.json({ ok: true });
  });

  app.post('/api/bookings/:id/decline', async (req, res) => {
    const b = await garageBooking(req);
    const { reason } = parse(z.object({ reason: optional(300) }), req);
    if (b.status !== 'pending' || b.requested_by === 'garage')
      throw fail(409, 'Only a waiting request can be declined.');
    await transaction(db, async () => {
      await run("UPDATE bookings SET status='cancelled' WHERE id=?", b.id);
      await setJob(b.id, { declined: 1, cancel_reason: reason, cancelled_by: 'garage' });
      await bookingEvent(b.id, req.user.id, 'declined', reason);
    });
    res.json({ ok: true });
  });

  app.post('/api/bookings/:id/propose', async (req, res) => {
    const b = await garageBooking(req);
    const d = parse(z.object({ starts_at: isoTime, reason: optional(300) }), req);
    if (b.status !== 'pending' || b.requested_by === 'garage')
      throw fail(409, 'Only a waiting request can get a new time.');
    const startsAt = appointment(d.starts_at).toISOString();
    await checkSlot(b.garage_id, startsAt);
    await transaction(db, async () => {
      await run("UPDATE bookings SET status='confirmed',starts_at=? WHERE id=?", startsAt, b.id);
      await ensureJob(b.id);
      await bookingEvent(
        b.id,
        req.user.id,
        'new-time',
        [startsAt, d.reason].filter(Boolean).join(' · '),
      );
    });
    res.json({ ok: true });
  });

  app.post('/api/bookings/schedule', async (req, res) => {
    const garage = await ownGarage(req.user);
    const d = parse(
      z.object({
        driver_id: z.uuid(),
        vehicle_id: z.uuid(),
        service: text(80),
        starts_at: isoTime,
        notes: optional(1000),
      }),
      req,
    );
    const customer = await one(
      `SELECT 1 FROM bookings WHERE garage_id=? AND driver_id=?
       UNION SELECT 1 FROM memberships m JOIN plans p ON p.id=m.plan_id WHERE p.garage_id=? AND m.driver_id=?`,
      garage.id,
      d.driver_id,
      garage.id,
      d.driver_id,
    );
    if (!customer) throw fail(404, 'Customer not found. Invite people who aren’t on MotoDoc yet.');
    if (
      !(await one('SELECT id FROM vehicles WHERE id=? AND owner_id=?', d.vehicle_id, d.driver_id))
    )
      throw fail(400, 'Choose one of the customer’s cars.');
    if (!JSON.parse(garage.services).includes(d.service))
      throw fail(400, 'Choose one of your services.');
    const date = appointment(d.starts_at);
    await checkSlot(garage.id, date.toISOString());
    const key = id();
    await transaction(db, async () => {
      await run(
        'INSERT INTO bookings(id,driver_id,garage_id,vehicle_id,service,starts_at,notes) VALUES(?,?,?,?,?,?,?)',
        key,
        d.driver_id,
        garage.id,
        d.vehicle_id,
        d.service,
        date.toISOString(),
        d.notes,
      );
      await ensureJob(key, 'garage');
      await bookingEvent(key, req.user.id, 'scheduled', d.notes);
    });
    res.status(201).json({ id: key });
  });

  app.post('/api/bookings/:id/respond', async (req, res) => {
    driverOnly(req.user);
    const b = await find(req);
    const { accept } = parse(z.object({ accept: z.boolean() }), req);
    if (b.status !== 'pending' || b.requested_by !== 'garage')
      throw fail(409, 'This appointment is not waiting for you.');
    await transaction(db, async () => {
      await run(
        'UPDATE bookings SET status=? WHERE id=?',
        accept ? 'confirmed' : 'cancelled',
        b.id,
      );
      if (!accept) await setJob(b.id, { declined: 1, cancelled_by: 'driver' });
      await bookingEvent(b.id, req.user.id, accept ? 'customer-approved' : 'customer-declined');
    });
    res.json({ ok: true });
  });

  app.post('/api/bookings/:id/stage', async (req, res) => {
    const b = await garageBooking(req);
    const { stage } = parse(z.object({ stage: z.enum(['in_progress', 'finished']) }), req);
    if (b.status !== 'confirmed') throw fail(409, 'Approve the request before starting work.');
    if (JOB_STAGES.indexOf(stage) !== JOB_STAGES.indexOf(b.stage) + 1)
      throw fail(409, 'Move the job forward one step at a time.');
    await transaction(db, async () => {
      await setJob(b.id, { stage });
      await bookingEvent(b.id, req.user.id, 'stage', stage);
    });
    res.json({ ok: true });
  });

  const recordRepair = async (b, { summary, mileage, cost, parts }) => {
    const vehicle = await one('SELECT mileage FROM vehicles WHERE id=?', b.vehicle_id);
    if (mileage < vehicle.mileage)
      throw fail(400, 'Mileage cannot be lower than the vehicle’s recorded mileage.');
    if (!(await one('SELECT id FROM service_records WHERE booking_id=?', b.id)))
      await run(
        'INSERT INTO service_records(id,booking_id,garage_id,vehicle_id,driver_id,summary,mileage,performed_at) VALUES(?,?,?,?,?,?,?,?)',
        id(),
        b.id,
        b.garage_id,
        b.vehicle_id,
        b.driver_id,
        summary,
        mileage,
        now(),
      );
    await run('UPDATE vehicles SET mileage=? WHERE id=?', mileage, b.vehicle_id);
    if (cost !== undefined || parts)
      await setJob(b.id, {
        ...(cost !== undefined ? { cost_cents: Math.round(cost * 100) } : {}),
        ...(parts ? { parts } : {}),
      });
  };

  app.post('/api/bookings/:id/ready', async (req, res) => {
    const b = await garageBooking(req);
    const d = parse(
      z.object({
        pickup_at: isoTime,
        mileage: z.number().int().positive().max(5000000),
        note: optional(500),
      }),
      req,
    );
    if (b.status !== 'confirmed' || b.stage !== 'finished')
      throw fail(409, 'Finish the work before sending the pickup time.');
    await transaction(db, async () => {
      await run("UPDATE bookings SET status='completed' WHERE id=?", b.id);
      await setJob(b.id, {
        stage: 'ready_for_pickup',
        pickup_at: new Date(d.pickup_at).toISOString(),
        pickup_note: d.note,
        completed_at: now(),
      });
      await recordRepair(b, { summary: d.note || b.service, mileage: d.mileage });
      await bookingEvent(b.id, req.user.id, 'ready', new Date(d.pickup_at).toISOString());
    });
    res.json({ ok: true });
  });

  const complete = async (req, b, d) => {
    if (b.status !== 'confirmed') throw fail(409, 'This booking cannot make that status change.');
    await transaction(db, async () => {
      await run("UPDATE bookings SET status='completed' WHERE id=?", b.id);
      await setJob(b.id, {
        stage: b.stage === 'ready_for_pickup' ? b.stage : 'finished',
        completed_at: now(),
      });
      await recordRepair(b, d);
      await bookingEvent(b.id, req.user.id, 'completed', d.summary);
    });
  };
  app.post('/api/bookings/:id/complete', async (req, res) => {
    const b = await garageBooking(req);
    const d = parse(
      z.object({
        summary: text(2000),
        mileage: z.number().int().positive().max(5000000),
        cost: z.number().min(0).max(1000000).optional(),
        parts: optional(500),
      }),
      req,
    );
    await complete(req, b, d);
    res.json({ ok: true });
  });

  app.post('/api/bookings/:id/move', async (req, res) => {
    const b = await garageBooking(req);
    const d = parse(z.object({ starts_at: isoTime, reason: optional(300) }), req);
    if (b.status !== 'confirmed') throw fail(409, 'Only approved appointments can be moved.');
    notStarted(b);
    const startsAt = appointment(d.starts_at).toISOString();
    await checkSlot(b.garage_id, startsAt);
    await transaction(db, async () => {
      await run('UPDATE bookings SET starts_at=? WHERE id=?', startsAt, b.id);
      await bookingEvent(
        b.id,
        req.user.id,
        'moved',
        [startsAt, d.reason].filter(Boolean).join(' · '),
      );
    });
    res.json({ ok: true });
  });

  const cancel = async (req, b, { reason = '', no_show = false }) => {
    const garage = req.user.role === 'garage';
    if (!['pending', 'confirmed'].includes(b.status) || b.stage !== 'booked')
      throw fail(409, 'Started appointments cannot be cancelled.');
    if (no_show && (!garage || b.status !== 'confirmed'))
      throw fail(403, 'Only the garage can mark an approved appointment as a no-show.');
    await transaction(db, async () => {
      await run("UPDATE bookings SET status='cancelled' WHERE id=?", b.id);
      await setJob(b.id, {
        cancel_reason: reason,
        cancelled_by: garage ? 'garage' : 'driver',
        no_show: Number(no_show),
      });
      await bookingEvent(b.id, req.user.id, no_show ? 'no-show' : 'cancelled', reason);
    });
  };
  app.post('/api/bookings/:id/cancel', async (req, res) => {
    const b = await find(req);
    const d = parse(z.object({ reason: optional(300), no_show: z.boolean().default(false) }), req);
    await cancel(req, b, d);
    res.json({ ok: true });
  });

  app.post('/api/bookings/:id/notes', async (req, res) => {
    const b = await garageBooking(req);
    const { note } = parse(z.object({ note: text(500) }), req);
    if (b.status !== 'confirmed') throw fail(409, 'Notes can be added to approved, active jobs.');
    await bookingEvent(b.id, req.user.id, 'note', note);
    res.status(201).json({ ok: true });
  });

  app.post('/api/bookings/:id/review/reply', async (req, res) => {
    const b = await garageBooking(req);
    const { reply } = parse(z.object({ reply: text(1000) }), req);
    const review = await one('SELECT reply FROM reviews WHERE booking_id=?', b.id);
    if (!review) throw fail(404, 'This job has no review yet.');
    if (review.reply) throw fail(409, 'You already replied to this review.');
    await run('UPDATE reviews SET reply=?,reply_at=? WHERE booking_id=?', reply, now(), b.id);
    await bookingEvent(b.id, req.user.id, 'reply', reply);
    res.status(201).json({ ok: true });
  });

  app.get('/api/bookings/:id/timeline', async (req, res) => {
    const b = await find(req);
    res.json(
      await all(
        "SELECT e.id,e.kind,e.detail,e.at,CASE WHEN e.actor_id=? THEN 'You' WHEN e.actor_id=b.driver_id THEN u.name ELSE g.name END actor FROM booking_events e JOIN bookings b ON b.id=e.booking_id JOIN garages g ON g.id=b.garage_id JOIN users u ON u.id=b.driver_id WHERE e.booking_id=? ORDER BY e.at DESC,e.id DESC",
        req.user.id,
        b.id,
      ),
    );
  });

  return { complete, cancel, ensureJob, setJob };
}
