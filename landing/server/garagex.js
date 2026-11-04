import { z } from 'zod';

export function registerGarageExtras(app, ctx) {
  const { one, all, run, db, transaction, fail, parse, id, clock, ownGarage, jobs, bookingEvent } =
    ctx;
  const { worldOf } = ctx;
  const now = () => new Date(clock()).toISOString();

  app.post('/api/service-records', async (req, res) => {
    const g = await ownGarage(req.user, 'records');
    const d = parse(
      z.object({
        driver_id: z.string().min(1).max(64),
        vehicle_id: z.string().min(1).max(64),
        service: z.string().trim().min(2, 'Choose the service you did.').max(80),
        mileage: z
          .number()
          .int()
          .min(1, 'Add the mileage — it’s required on every record.')
          .max(5000000),
        cost: z.number().min(0).max(100000).optional(),
        parts: z.string().trim().max(500).default(''),
        summary: z.string().trim().min(3, 'Describe the work you did.').max(2000),
        performed_on: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
      req,
    );
    const customer = await one(
      `SELECT u.id,u.name FROM users u WHERE u.id=? AND (EXISTS(SELECT 1 FROM bookings b WHERE b.driver_id=u.id AND b.garage_id=?) OR EXISTS(SELECT 1 FROM memberships m JOIN plans p ON p.id=m.plan_id WHERE m.driver_id=u.id AND p.garage_id=? AND m.status='active'))`,
      d.driver_id,
      g.id,
      g.id,
    );
    if (!customer)
      throw fail(404, 'No customer found. Records can only be added for your MotoDoc customers.');
    const car = await one(
      'SELECT * FROM vehicles WHERE id=? AND owner_id=?',
      d.vehicle_id,
      customer.id,
    );
    if (!car) throw fail(404, 'Vehicle not found.');
    const today = now().slice(0, 10);
    if (d.performed_on && d.performed_on > today)
      throw fail(400, 'The service date can’t be in the future.');
    const performed =
      d.performed_on && d.performed_on < today ? `${d.performed_on}T09:00:00.000Z` : now();
    const bookingId = id();
    await transaction(db, async () => {
      await run(
        "INSERT INTO bookings(id,driver_id,garage_id,vehicle_id,service,starts_at,notes,status) VALUES(?,?,?,?,?,?,?,'completed')",
        bookingId,
        customer.id,
        g.id,
        car.id,
        d.service,
        performed,
        'Added by the garage',
      );
      await jobs.ensureJob(bookingId, 'garage');
      await jobs.setJob(bookingId, {
        stage: 'finished',
        completed_at: performed,
        source: 'manual',
        parts: d.parts,
        ...(d.cost != null ? { cost_cents: Math.round(d.cost * 100) } : {}),
      });
      await run(
        'INSERT INTO service_records(id,booking_id,garage_id,vehicle_id,driver_id,summary,mileage,performed_at) VALUES(?,?,?,?,?,?,?,?)',
        id(),
        bookingId,
        g.id,
        car.id,
        customer.id,
        d.summary,
        d.mileage,
        performed,
      );
      if (d.mileage > car.mileage)
        await run('UPDATE vehicles SET mileage=? WHERE id=?', d.mileage, car.id);
      await bookingEvent(bookingId, req.user.id, 'record-added', d.service);
    });
    res.status(201).json({ booking_id: bookingId });
  });

  app.get('/api/garages/:id/reviews', async (req, res) => {
    const g = await one(
      `SELECT g.id FROM garages g WHERE g.id=? AND g.published=1 AND ${worldOf('g.owner_id')}=?`,
      req.params.id,
      req.user.demo_world || '',
    );
    if (!g) throw fail(404, 'Garage not found.');
    const reviews = await all(
      'SELECT r.rating,r.comment,r.tags,r.reply,r.created_at,u.name driver_name FROM reviews r JOIN users u ON u.id=r.driver_id WHERE r.garage_id=? AND r.hidden=0 ORDER BY r.created_at DESC',
      g.id,
    );
    res.json({
      average: reviews.length
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : null,
      count: reviews.length,
      breakdown: [5, 4, 3, 2, 1].map((stars) => [
        stars,
        reviews.filter((r) => r.rating === stars).length,
      ]),
      latest: reviews.slice(0, 3).map((r) => ({
        ...r,
        driver_name: r.driver_name.split(' ')[0],
        tags: JSON.parse(r.tags || '[]'),
      })),
    });
  });

  app.post('/api/customers/:id/reminders', async (req, res) => {
    const g = await ownGarage(req.user, 'customers');
    const d = parse(
      z.object({
        title: z.string().trim().min(2).max(160),
        type: z.enum(['oil', 'tyres', 'inspection', 'insurance', 'tax', 'other']).default('other'),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.'),
        vehicle_id: z.string().max(64).optional(),
        note: z.string().trim().max(500).default(''),
      }),
      req,
    );
    if (d.due_date < now().slice(0, 10)) throw fail(400, 'Choose today or a later date.');
    const customer = await one(
      'SELECT u.id FROM users u WHERE u.id=? AND EXISTS(SELECT 1 FROM bookings b WHERE b.driver_id=u.id AND b.garage_id=?)',
      req.params.id,
      g.id,
    );
    if (!customer) throw fail(404, 'Customer not found.');
    if (
      d.vehicle_id &&
      !(await one('SELECT 1 FROM vehicles WHERE id=? AND owner_id=?', d.vehicle_id, customer.id))
    )
      throw fail(404, 'Vehicle not found.');
    await transaction(db, async () => {
      await run(
        'INSERT INTO reminders(id,user_id,title,due_date,type,vehicle_id,note) VALUES(?,?,?,?,?,?,?)',
        id(),
        customer.id,
        d.title,
        d.due_date,
        d.type,
        d.vehicle_id || null,
        [`From ${g.name}`, d.note].filter(Boolean).join(' · '),
      );
      await run(
        "INSERT INTO notices(id,user_id,kind,title,body,at,link) VALUES(?,?,'reminder',?,?,?,'#reminders')",
        id(),
        customer.id,
        `Reminder from ${g.name}`,
        `${d.title} · ${d.due_date}`,
        now(),
      );
    });
    res.status(201).json({ ok: true });
  });

  app.get('/api/garage/reviews', async (req, res) => {
    const g = await ownGarage(req.user, 'customers');
    const reviews = await all(
      'SELECT r.booking_id,r.rating,r.comment,r.tags,r.reply,r.reply_at,r.hidden,r.created_at,u.name driver_name,b.service FROM reviews r JOIN users u ON u.id=r.driver_id JOIN bookings b ON b.id=r.booking_id WHERE r.garage_id=? ORDER BY r.reply IS NOT NULL,r.created_at DESC',
      g.id,
    );
    const visible = reviews.filter((r) => !r.hidden);
    res.json({
      average: visible.length
        ? Math.round((visible.reduce((s, r) => s + r.rating, 0) / visible.length) * 10) / 10
        : null,
      breakdown: [5, 4, 3, 2, 1].map((stars) => [
        stars,
        visible.filter((r) => r.rating === stars).length,
      ]),
      reviews: reviews.map((r) => ({
        ...r,
        tags: JSON.parse(r.tags || '[]'),
        hidden: !!r.hidden,
      })),
    });
  });
}
