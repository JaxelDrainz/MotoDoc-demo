import { z } from 'zod';
import { MARKET_DURATIONS } from '../src/marketplace.js';

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .trim();
const postcode = (s) => (String(s || '').match(/\b\d{5}\b/) || [])[0];
export const nearby = (area, g) => {
  const a = norm(area),
    city = norm(g.city);
  if (a && city && (a.includes(city) || city.includes(a))) return true;
  const p1 = postcode(area),
    p2 = postcode(g.address);
  return !!(p1 && p2 && p1.slice(0, 2) === p2.slice(0, 2));
};
const euro = (cents) => `€${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
const durationText = (minutes) =>
  MARKET_DURATIONS.find(([m]) => m === minutes)?.[1] || `${minutes} min`;

export function registerMarketplace(app, ctx) {
  const { one, all, run, db, transaction, fail, parse, id, clock, ownGarage, driverOnly } = ctx;
  const { world, worldOf, text, optional, dateSchema, checkSlot, jobs, bookingEvent, rateLimit } =
    ctx;
  const now = () => new Date(clock()).toISOString();
  const notify = (userId, title, body) =>
    run(
      "INSERT INTO notices(id,user_id,kind,title,body,at,link) VALUES(?,?,'market',?,?,?,'#marketplace')",
      id(),
      userId,
      title,
      body,
      now(),
    );

  const garagesFor = async (request, worldId) =>
    (
      await all(
        `SELECT g.id,g.owner_id,g.name,g.city,g.address FROM garages g LEFT JOIN garage_details gd ON gd.garage_id=g.id WHERE g.published=1 AND g.verification<>'rejected' AND COALESCE(gd.online,1)=1 AND ${worldOf('g.owner_id')}=?`,
        worldId,
      )
    ).filter((g) => nearby(request.area, g));

  const photos = async (requestId) =>
    (await all('SELECT id FROM market_photos WHERE request_id=? ORDER BY position', requestId)).map(
      (p) => `/api/market/photos/${p.id}`,
    );

  const requestSelect = `SELECT r.*,v.make,v.model,v.registration,u.name driver_name FROM market_requests r JOIN vehicles v ON v.id=r.vehicle_id JOIN users u ON u.id=r.driver_id`;

  app.get('/api/market/requests', async (req, res) => {
    driverOnly(req.user);
    const rows = await all(
      `${requestSelect} WHERE r.driver_id=? ORDER BY r.created_at DESC`,
      req.user.id,
    );
    const out = [];
    for (const r of rows)
      out.push({
        ...r,
        photos: await photos(r.id),
        quotes: await all(
          `SELECT q.*,g.name garage_name,g.address garage_address,g.city garage_city,c.phone garage_phone,gd.hourly_rate_cents,gd.member_rate_cents,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE garage_id=g.id AND hidden=0) rating,(SELECT COUNT(*) FROM reviews WHERE garage_id=g.id AND hidden=0) review_count FROM market_quotes q JOIN garages g ON g.id=q.garage_id LEFT JOIN garage_contact c ON c.garage_id=g.id LEFT JOIN garage_details gd ON gd.garage_id=g.id WHERE q.request_id=? ORDER BY q.starts_at`,
          r.id,
        ),
      });
    res.json(out);
  });

  app.post('/api/market/requests', async (req, res) => {
    driverOnly(req.user);
    await rateLimit(req, 'market-post', 10, req.user.id);
    const d = parse(
      z.object({
        vehicle_id: z.string().min(1).max(64),
        service: text(80),
        kind: z.enum(['service', 'diagnosis', 'custom']).default('service'),
        urgency: z.enum(['urgent', 'week', 'flexible']).default('week'),
        preferred_date: dateSchema,
        area: text(80),
        description: z
          .string()
          .trim()
          .min(1, 'Describe what’s wrong so garages can quote.')
          .max(2000),
        mileage: z.number().int().min(0).max(5000000).optional(),
      }),
      req,
    );
    if (d.preferred_date < now().slice(0, 10)) throw fail(400, 'Choose today or a later date.');
    if (
      !(await one('SELECT id FROM vehicles WHERE id=? AND owner_id=?', d.vehicle_id, req.user.id))
    )
      throw fail(404, 'Vehicle not found.');
    const key = id();
    const garages = await garagesFor(d, world(req.user));
    await transaction(db, async () => {
      await run(
        'INSERT INTO market_requests(id,driver_id,vehicle_id,service,kind,urgency,preferred_date,area,description,mileage,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        key,
        req.user.id,
        d.vehicle_id,
        d.service,
        d.kind,
        d.urgency,
        d.preferred_date,
        d.area,
        d.description,
        d.mileage ?? null,
        now(),
      );
      for (const g of garages)
        await notify(g.owner_id, 'New marketplace request', `${d.service} · ${d.area}`);
    });
    res.status(201).json({ id: key, garages: garages.length });
  });

  const ownRequest = async (req) => {
    driverOnly(req.user);
    const r = await one(
      'SELECT * FROM market_requests WHERE id=? AND driver_id=?',
      req.params.id,
      req.user.id,
    );
    if (!r) throw fail(404, 'Request not found.');
    return r;
  };

  app.post('/api/market/requests/:id/photos', async (req, res) => {
    const r = await ownRequest(req);
    if (r.status !== 'open') throw fail(409, 'This request is closed.');
    const { data } = parse(z.object({ data: z.string().max(1100000) }), req);
    const match = data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw fail(400, 'Add a JPEG, PNG or WebP photo.');
    if (Buffer.from(match[2], 'base64').length > 800000)
      throw fail(400, 'That photo is too large. Try a smaller one.');
    const count = (await one('SELECT COUNT(*) n FROM market_photos WHERE request_id=?', r.id)).n;
    if (Number(count) >= 4) throw fail(400, 'You can add up to 4 photos.');
    const key = id();
    await run(
      'INSERT INTO market_photos(id,request_id,position,mime,data) VALUES(?,?,?,?,?)',
      key,
      r.id,
      Number(count),
      match[1],
      match[2],
    );
    res.status(201).json({ url: `/api/market/photos/${key}` });
  });

  app.get('/api/market/photos/:id', async (req, res) => {
    const photo = await one(
      `SELECT p.mime,p.data,r.driver_id,${worldOf('r.driver_id')} world FROM market_photos p JOIN market_requests r ON r.id=p.request_id WHERE p.id=?`,
      req.params.id,
    );
    const allowed =
      photo &&
      (photo.driver_id === req.user.id ||
        (req.user.role === 'garage' && photo.world === world(req.user)));
    if (!allowed) throw fail(404, 'Photo not found.');
    res
      .set('Cache-Control', 'private, max-age=86400')
      .type(photo.mime)
      .send(Buffer.from(photo.data, 'base64'));
  });

  app.post('/api/market/requests/:id/close', async (req, res) => {
    const r = await ownRequest(req);
    if (r.status !== 'open') throw fail(409, 'This request is already closed.');
    const quoted = await all(
      'SELECT g.owner_id FROM market_quotes q JOIN garages g ON g.id=q.garage_id WHERE q.request_id=?',
      r.id,
    );
    await transaction(db, async () => {
      await run("UPDATE market_requests SET status='closed',closed_at=? WHERE id=?", now(), r.id);
      for (const g of quoted)
        await notify(
          g.owner_id,
          'Marketplace request closed',
          `${req.user.name} closed the request for ${r.service}.`,
        );
    });
    res.json({ ok: true, quotes: quoted.length });
  });

  app.post('/api/market/quotes/:id/accept', async (req, res) => {
    driverOnly(req.user);
    const q = await one(
      'SELECT q.*,r.driver_id,r.vehicle_id,r.service,r.description,r.status request_status,g.name garage_name FROM market_quotes q JOIN market_requests r ON r.id=q.request_id JOIN garages g ON g.id=q.garage_id WHERE q.id=? AND r.driver_id=?',
      req.params.id,
      req.user.id,
    );
    if (!q) throw fail(404, 'Quote not found.');
    if (q.request_status === 'booked' || q.status !== 'sent')
      throw fail(409, 'You’ve already accepted a quote for this request.');
    if (Date.parse(q.starts_at) <= clock())
      throw fail(409, 'This appointment time has passed. Ask the garage for a new quote.');
    const key = id();
    try {
      await transaction(db, async () => {
        await run(
          "INSERT INTO bookings(id,driver_id,garage_id,vehicle_id,service,starts_at,notes,status) VALUES(?,?,?,?,?,?,?,'confirmed')",
          key,
          req.user.id,
          q.garage_id,
          q.vehicle_id,
          q.service,
          q.starts_at,
          q.description,
        );
        await jobs.ensureJob(key);
        await jobs.setJob(key, {
          source: 'marketplace',
          quote_cents: q.price_cents,
          quote_minutes: q.minutes,
        });
        await bookingEvent(
          key,
          req.user.id,
          'quote-accepted',
          `${q.garage_name} — ${euro(q.price_cents)}, ${durationText(q.minutes)}`,
        );
        await run("UPDATE market_quotes SET status='accepted' WHERE id=?", q.id);
        await run(
          "UPDATE market_quotes SET status='not_selected' WHERE request_id=? AND id<>?",
          q.request_id,
          q.id,
        );
        await run(
          "UPDATE market_requests SET status='booked',booking_id=?,closed_at=COALESCE(closed_at,?) WHERE id=?",
          key,
          now(),
          q.request_id,
        );
      });
    } catch (error) {
      if (String(error.message).includes('UNIQUE'))
        throw fail(
          409,
          'That time was just booked by someone else. Ask the garage for a new quote.',
        );
      throw error;
    }
    res.status(201).json({ booking_id: key });
  });

  app.get('/api/market/garage', async (req, res) => {
    const g = await ownGarage(req.user, 'bookings');
    const since = new Date(clock() - 60 * 86400000).toISOString();
    const rows = await all(
      `${requestSelect} WHERE ${worldOf('r.driver_id')}=? AND r.created_at>=? ORDER BY r.created_at DESC`,
      world(req.user),
      since,
    );
    const out = [];
    for (const r of rows) {
      const mine = await one(
        'SELECT * FROM market_quotes WHERE request_id=? AND garage_id=?',
        r.id,
        g.id,
      );
      if (!mine && (r.status !== 'open' || !nearby(r.area, g))) continue;
      const tab = !mine
        ? 'to_quote'
        : mine.status === 'accepted'
          ? 'won'
          : mine.status === 'not_selected'
            ? 'lost'
            : 'sent';
      out.push({
        ...r,
        tab,
        my_quote: mine || null,
        quote_count: Number(
          (await one('SELECT COUNT(*) n FROM market_quotes WHERE request_id=?', r.id)).n,
        ),
        photos: await photos(r.id),
      });
    }
    res.json(out);
  });

  app.post('/api/market/requests/:id/quotes', async (req, res) => {
    const g = await ownGarage(req.user, 'bookings');
    const d = parse(
      z.object({
        price: z.number().positive('Enter a total price above €0.').max(100000),
        minutes: z
          .number()
          .int()
          .refine((m) => MARKET_DURATIONS.some(([v]) => v === m), 'Choose how long the job takes.'),
        starts_at: z.iso.datetime(),
        notes: optional(500),
      }),
      req,
    );
    const r = await one(
      `SELECT r.* FROM market_requests r WHERE r.id=? AND ${worldOf('r.driver_id')}=?`,
      req.params.id,
      world(req.user),
    );
    if (!r || !nearby(r.area, g)) throw fail(404, 'Request not found.');
    if (r.status !== 'open') throw fail(409, 'This request is no longer taking quotes.');
    if (await one('SELECT 1 FROM market_quotes WHERE request_id=? AND garage_id=?', r.id, g.id))
      throw fail(409, 'You’ve already sent a quote for this request.');
    const startsAt = new Date(d.starts_at);
    startsAt.setUTCMinutes(0, 0, 0);
    if (startsAt.getTime() <= clock()) throw fail(400, 'Offer an appointment in the future.');
    await checkSlot(g.id, startsAt.toISOString());
    if (
      await one(
        "SELECT 1 FROM bookings WHERE garage_id=? AND starts_at=? AND status IN ('pending','confirmed')",
        g.id,
        startsAt.toISOString(),
      )
    )
      throw fail(409, 'You already have a booking at that time. Offer another time.');
    const price = Math.round(d.price * 100);
    await transaction(db, async () => {
      await run(
        'INSERT INTO market_quotes(id,request_id,garage_id,price_cents,starts_at,minutes,notes,created_at) VALUES(?,?,?,?,?,?,?,?)',
        id(),
        r.id,
        g.id,
        price,
        startsAt.toISOString(),
        d.minutes,
        d.notes,
        now(),
      );
      await notify(r.driver_id, 'New quote', `${g.name} quoted ${euro(price)} for ${r.service}.`);
    });
    res.status(201).json({ ok: true });
  });
}
