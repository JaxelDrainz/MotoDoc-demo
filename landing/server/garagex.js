import { z } from 'zod';

export function registerGarageExtras(app, ctx) {
  const { one, all, run, db, transaction, fail, parse, id, clock, ownGarage, jobs, bookingEvent } =
    ctx;
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
