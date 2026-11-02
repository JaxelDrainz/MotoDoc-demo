import { z } from 'zod';
import { PLATFORM_DEFAULTS } from '../src/platform.js';

export async function platformSettings(all) {
  const rows = await all('SELECT key,value FROM platform_settings');
  const out = { ...PLATFORM_DEFAULTS };
  for (const { key, value } of rows) if (key in out) out[key] = JSON.parse(value);
  return out;
}

export function registerFeedback(app, ctx) {
  const { run, parse, id, clock } = ctx;
  app.post('/api/feedback', async (req, res) => {
    const d = parse(
      z.object({
        kind: z.enum(['problem', 'idea']),
        message: z.string().trim().min(5, 'Tell us a little more so we can help.').max(2000),
        page: z.string().trim().max(200).default(''),
      }),
      req,
    );
    await run(
      'INSERT INTO feedback(id,user_id,kind,message,page,created_at) VALUES(?,?,?,?,?,?)',
      id(),
      req.user.id,
      d.kind,
      d.message,
      d.page,
      new Date(clock()).toISOString(),
    );
    res.status(201).json({ ok: true });
  });
}

export function registerAdmin(app, ctx) {
  const { one, all, run, db, transaction, fail, parse, id, clock, isAdmin, worldOf } = ctx;
  const now = () => new Date(clock()).toISOString();
  const W = (req) => req.user.demo_world || '';
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
  const count = async (sql, ...params) => Number((await one(sql, ...params))?.n || 0);
  const today = () => now().slice(0, 10);

  app.get('/api/admin/overview', async (req, res) => {
    const w = W(req);
    const invoices = await one(
      `SELECT COALESCE(SUM(CASE WHEN status<>'void' THEN amount_cents END),0) invoiced,COALESCE(SUM(CASE WHEN status='paid' THEN amount_cents END),0) paid,COUNT(CASE WHEN status='unpaid' AND due_date<? THEN 1 END) overdue FROM invoices i WHERE ${worldOf('i.driver_id')}=?`,
      today(),
      w,
    );
    const tiles = {
      drivers: await count(
        `SELECT COUNT(*) n FROM users u WHERE role='driver' AND COALESCE((SELECT persona FROM demo_users WHERE user_id=u.id),'')<>'admin' AND u.email NOT LIKE '%@deleted.invalid' AND ${worldOf('u.id')}=?`,
        w,
      ),
      garages: await count(`SELECT COUNT(*) n FROM garages g WHERE ${worldOf('g.owner_id')}=?`, w),
      verified: await count(
        `SELECT COUNT(*) n FROM garages g WHERE verification='verified' AND ${worldOf('g.owner_id')}=?`,
        w,
      ),
      bookings: await count(
        `SELECT COUNT(*) n FROM bookings b WHERE ${worldOf('b.driver_id')}=?`,
        w,
      ),
      open_market: await count(
        `SELECT COUNT(*) n FROM market_requests r WHERE status='open' AND ${worldOf('r.driver_id')}=?`,
        w,
      ),
      invoiced: invoices.invoiced,
      paid: invoices.paid,
      overdue: invoices.overdue,
      reviews: await count(`SELECT COUNT(*) n FROM reviews r WHERE ${worldOf('r.driver_id')}=?`, w),
    };
    const attention = [
      [
        'garages',
        ['garage waiting for verification', 'garages waiting for verification'],
        await count(
          `SELECT COUNT(*) n FROM garages g WHERE verification='pending' AND published=1 AND ${worldOf('g.owner_id')}=?`,
          w,
        ),
      ],
      ['payments', ['overdue invoice', 'overdue invoices'], invoices.overdue],
      [
        'marketplace',
        ['marketplace request with no quotes', 'marketplace requests with no quotes'],
        await count(
          `SELECT COUNT(*) n FROM market_requests r WHERE status='open' AND NOT EXISTS(SELECT 1 FROM market_quotes q WHERE q.request_id=r.id) AND ${worldOf('r.driver_id')}=?`,
          w,
        ),
      ],
      [
        'reviews',
        ['low-rated review to check', 'low-rated reviews to check'],
        await count(
          `SELECT COUNT(*) n FROM reviews r WHERE rating<=2 AND hidden=0 AND ${worldOf('r.driver_id')}=?`,
          w,
        ),
      ],
      [
        'users',
        ['suspended account', 'suspended accounts'],
        await count(
          `SELECT COUNT(*) n FROM users u WHERE suspended_at IS NOT NULL AND ${worldOf('u.id')}=?`,
          w,
        ),
      ],
      [
        'feedback',
        ['new feedback message', 'new feedback messages'],
        await count(
          `SELECT COUNT(*) n FROM feedback f WHERE status='new' AND ${worldOf('f.user_id')}=?`,
          w,
        ),
      ],
      [
        'garages',
        ['custom plan request', 'custom plan requests'],
        await count(
          `SELECT COUNT(*) n FROM custom_plan_requests c JOIN garages g ON g.id=c.garage_id WHERE c.status='new' AND ${worldOf('g.owner_id')}=?`,
          w,
        ),
      ],
    ].map(([section, [one, many], n]) => ({
      section,
      label: n === 1 ? one : many,
      plural: many,
      count: n,
    }));
    res.json({
      tiles,
      attention,
      activity: await all('SELECT * FROM admin_audit WHERE world=? ORDER BY at DESC LIMIT 5', w),
    });
  });

  app.get('/api/admin/users', async (req, res) => {
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase()
      .slice(0, 100);
    const rows = await all(
      `SELECT u.id,u.name,u.email,u.role,u.created_at,u.suspended_at,u.suspended_reason,(SELECT persona FROM demo_users WHERE user_id=u.id) persona,(SELECT role FROM garage_staff WHERE user_id=u.id) staff_role FROM users u WHERE ${worldOf('u.id')}=? AND u.email NOT LIKE '%@deleted.invalid' AND (?='' OR lower(u.name) LIKE ? OR lower(u.email) LIKE ?) ORDER BY u.created_at DESC LIMIT 300`,
      W(req),
      q,
      `%${q}%`,
      `%${q}%`,
    );
    res.json(
      rows.map((u) => ({
        ...u,
        admin: isAdmin({ email: u.email, demo_persona: u.persona }),
        kind: u.staff_role ? 'team' : u.role,
      })),
    );
  });

  const userIn = async (req) => {
    const u = await one(
      `SELECT u.*,(SELECT persona FROM demo_users WHERE user_id=u.id) persona FROM users u WHERE u.id=? AND ${worldOf('u.id')}=?`,
      req.params.id,
      W(req),
    );
    if (!u) throw fail(404, 'User not found.');
    if (u.id === req.user.id) throw fail(403, 'You can’t suspend your own account.');
    if (isAdmin({ email: u.email, demo_persona: u.persona }))
      throw fail(403, 'Administrators can’t be suspended here.');
    return u;
  };
  app.post('/api/admin/users/:id/suspend', async (req, res) => {
    const u = await userIn(req);
    const { reason } = parse(
      z.object({ reason: z.string().trim().min(3, 'Add a short reason.').max(300) }),
      req,
    );
    await transaction(db, async () => {
      await run(
        'UPDATE users SET suspended_at=?,suspended_reason=? WHERE id=?',
        now(),
        reason,
        u.id,
      );
      await run('DELETE FROM sessions WHERE user_id=?', u.id);
      await audit(req, 'Suspended account', u.email, reason);
    });
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:id/reactivate', async (req, res) => {
    const u = await userIn(req);
    await transaction(db, async () => {
      await run("UPDATE users SET suspended_at=NULL,suspended_reason='' WHERE id=?", u.id);
      await audit(req, 'Reactivated account', u.email);
    });
    res.json({ ok: true });
  });

  app.get('/api/admin/garages', async (req, res) => {
    const w = W(req);
    res.json({
      garages: await all(
        `SELECT g.id,g.name,g.city,g.address,g.published,g.verification,g.verified_at,g.verification_note,g.created_at,u.name owner_name,u.email owner_email,gd.business_id,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE garage_id=g.id AND hidden=0) rating,(SELECT COUNT(*) FROM reviews WHERE garage_id=g.id AND hidden=0) review_count FROM garages g JOIN users u ON u.id=g.owner_id LEFT JOIN garage_details gd ON gd.garage_id=g.id WHERE ${worldOf('g.owner_id')}=? ORDER BY g.verification='pending' DESC,g.created_at DESC`,
        w,
      ),
      requests: await all(
        `SELECT c.*,g.name garage_name FROM custom_plan_requests c JOIN garages g ON g.id=c.garage_id WHERE ${worldOf('g.owner_id')}=? ORDER BY c.status='new' DESC,c.created_at DESC LIMIT 50`,
        w,
      ),
    });
  });
  const garageIn = async (req) => {
    const g = await one(
      `SELECT * FROM garages g WHERE g.id=? AND ${worldOf('g.owner_id')}=?`,
      req.params.id,
      W(req),
    );
    if (!g) throw fail(404, 'Garage not found.');
    return g;
  };
  app.post('/api/admin/garages/:id/verify', async (req, res) => {
    const g = await garageIn(req);
    await transaction(db, async () => {
      await run(
        "UPDATE garages SET verification='verified',verified_at=?,verification_note='' WHERE id=?",
        now(),
        g.id,
      );
      await run(
        "INSERT INTO notices(id,user_id,kind,title,body,at,link) VALUES(?,?,'admin','Your garage is verified',?,?,'#profile')",
        id(),
        g.owner_id,
        `${g.name} now shows a verified badge to drivers.`,
        now(),
      );
      await audit(req, 'Verified garage', g.name);
    });
    res.json({ ok: true });
  });
  app.post('/api/admin/garages/:id/reject', async (req, res) => {
    const g = await garageIn(req);
    const { reason } = parse(
      z.object({ reason: z.string().trim().min(3, 'Add a short reason.').max(300) }),
      req,
    );
    await transaction(db, async () => {
      await run(
        "UPDATE garages SET verification='rejected',verified_at=NULL,verification_note=? WHERE id=?",
        reason,
        g.id,
      );
      await run(
        "INSERT INTO notices(id,user_id,kind,title,body,at,link) VALUES(?,?,'admin','Your garage wasn’t verified',?,?,'#profile')",
        id(),
        g.owner_id,
        `${reason} Drivers can’t find ${g.name} until this is sorted. Contact MotoDoc to fix it.`,
        now(),
      );
      await audit(req, 'Rejected garage', g.name, reason);
    });
    res.json({ ok: true });
  });
  app.post('/api/admin/custom-requests/:id/done', async (req, res) => {
    const r = await one(
      `SELECT c.*,g.name FROM custom_plan_requests c JOIN garages g ON g.id=c.garage_id WHERE c.id=? AND ${worldOf('g.owner_id')}=?`,
      req.params.id,
      W(req),
    );
    if (!r) throw fail(404, 'Request not found.');
    await run("UPDATE custom_plan_requests SET status='done' WHERE id=?", r.id);
    await audit(req, 'Handled custom plan request', r.name);
    res.json({ ok: true });
  });

  app.get('/api/admin/bookings', async (req, res) =>
    res.json(
      await all(
        `SELECT b.id,b.service,b.starts_at,b.status,b.created_at,u.name driver_name,g.name garage_name,COALESCE(j.source,'') source,COALESCE(j.requested_by,'driver') requested_by FROM bookings b JOIN users u ON u.id=b.driver_id JOIN garages g ON g.id=b.garage_id LEFT JOIN booking_jobs j ON j.booking_id=b.id WHERE ${worldOf('b.driver_id')}=? ORDER BY b.created_at DESC LIMIT 300`,
        W(req),
      ),
    ),
  );

  app.get('/api/admin/marketplace', async (req, res) =>
    res.json(
      await all(
        `SELECT r.id,r.service,r.area,r.status,r.urgency,r.created_at,u.name driver_name,(SELECT COUNT(*) FROM market_quotes q WHERE q.request_id=r.id) quotes,(SELECT MIN(price_cents) FROM market_quotes q WHERE q.request_id=r.id) min_cents,(SELECT MAX(price_cents) FROM market_quotes q WHERE q.request_id=r.id) max_cents FROM market_requests r JOIN users u ON u.id=r.driver_id WHERE ${worldOf('r.driver_id')}=? ORDER BY r.created_at DESC LIMIT 300`,
        W(req),
      ),
    ),
  );

  app.get('/api/admin/reviews', async (req, res) =>
    res.json(
      await all(
        `SELECT r.booking_id id,r.rating,r.comment,r.tags,r.reply,r.hidden,r.created_at,g.name garage_name,u.name author FROM reviews r JOIN garages g ON g.id=r.garage_id JOIN users u ON u.id=r.driver_id WHERE ${worldOf('r.driver_id')}=? ORDER BY r.hidden,r.rating,r.created_at DESC LIMIT 300`,
        W(req),
      ),
    ),
  );
  app.post('/api/admin/reviews/:id/visibility', async (req, res) => {
    const { hidden } = parse(z.object({ hidden: z.boolean() }), req);
    const r = await one(
      `SELECT r.booking_id,g.name FROM reviews r JOIN garages g ON g.id=r.garage_id WHERE r.booking_id=? AND ${worldOf('r.driver_id')}=?`,
      req.params.id,
      W(req),
    );
    if (!r) throw fail(404, 'Review not found.');
    await transaction(db, async () => {
      await run('UPDATE reviews SET hidden=? WHERE booking_id=?', Number(hidden), r.booking_id);
      await audit(req, hidden ? 'Hid review' : 'Showed review', r.name);
    });
    res.json({ ok: true });
  });

  app.get('/api/admin/payments', async (req, res) => {
    const rows = await all(
      `SELECT i.id,i.number,i.amount_cents,i.status,i.due_date,i.created_at,g.name garage_name,u.name driver_name FROM invoices i JOIN garages g ON g.id=i.garage_id JOIN users u ON u.id=i.driver_id WHERE ${worldOf('i.driver_id')}=? ORDER BY i.created_at DESC LIMIT 300`,
      W(req),
    );
    const t = today();
    const list = rows.map((i) => ({
      ...i,
      state: i.status === 'unpaid' && i.due_date < t ? 'overdue' : i.status,
    }));
    const sum = (f) => list.filter(f).reduce((s, i) => s + i.amount_cents, 0);
    res.json({
      tiles: {
        invoiced: sum((i) => i.status !== 'void'),
        paid: sum((i) => i.status === 'paid'),
        outstanding: sum((i) => i.status === 'unpaid'),
        overdue: sum((i) => i.state === 'overdue'),
      },
      invoices: list,
    });
  });

  app.get('/api/admin/feedback', async (req, res) =>
    res.json(
      await all(
        `SELECT f.*,u.name user_name,u.email user_email,u.role user_role FROM feedback f LEFT JOIN users u ON u.id=f.user_id WHERE ${worldOf('f.user_id')}=? ORDER BY f.status='new' DESC,f.created_at DESC LIMIT 300`,
        W(req),
      ),
    ),
  );
  app.post('/api/admin/feedback/:id/checked', async (req, res) => {
    const f = await one(
      `SELECT f.id FROM feedback f WHERE f.id=? AND ${worldOf('f.user_id')}=?`,
      req.params.id,
      W(req),
    );
    if (!f) throw fail(404, 'Feedback not found.');
    await run("UPDATE feedback SET status='checked' WHERE id=?", f.id);
    await audit(req, 'Checked feedback');
    res.json({ ok: true });
  });

  app.get('/api/admin/announcements', async (req, res) =>
    res.json(
      await all('SELECT * FROM announcements WHERE world=? ORDER BY sent_at DESC LIMIT 50', W(req)),
    ),
  );
  app.post('/api/admin/announcements', async (req, res) => {
    const d = parse(
      z.object({
        audience: z.enum(['everyone', 'drivers', 'garages']),
        title: z.string().trim().min(3, 'Add a title.').max(80),
        message: z.string().trim().min(10, 'Write a message of at least 10 characters.').max(1000),
      }),
      req,
    );
    const users = await all(
      `SELECT u.id FROM users u WHERE ${worldOf('u.id')}=? AND u.suspended_at IS NULL AND u.email NOT LIKE '%@deleted.invalid' AND (?='everyone' OR (?='drivers' AND u.role='driver') OR (?='garages' AND u.role='garage'))`,
      W(req),
      d.audience,
      d.audience,
      d.audience,
    );
    await transaction(db, async () => {
      for (const u of users)
        await run(
          "INSERT INTO notices(id,user_id,kind,title,body,at,link) VALUES(?,?,'announcement',?,?,?,'')",
          id(),
          u.id,
          d.title,
          d.message,
          now(),
        );
      await run(
        'INSERT INTO announcements(id,world,audience,title,message,recipients,sent_at,sent_by) VALUES(?,?,?,?,?,?,?,?)',
        id(),
        W(req),
        d.audience,
        d.title,
        d.message,
        users.length,
        now(),
        req.user.name,
      );
      await audit(req, 'Sent announcement', d.title, `${d.audience} · ${users.length}`);
    });
    res.status(201).json({ recipients: users.length });
  });

  app.get('/api/admin/settings', async (_req, res) => res.json(await platformSettings(all)));
  app.put('/api/admin/settings', async (req, res) => {
    const d = parse(
      z.object({
        launch_bonus: z.boolean(),
        pro_price_garage: z.number().min(0).max(10000),
        pro_price_driver: z.number().min(0).max(1000),
        motodoc_share: z.number().min(0).max(100),
        vat_rate: z.number().min(0).max(50),
        reply_garage_hours: z.number().int().min(1).max(168),
        reply_driver_hours: z.number().int().min(1).max(168),
      }),
      req,
    );
    const before = await platformSettings(all);
    const changed = Object.keys(d).filter((k) => before[k] !== d[k]);
    await transaction(db, async () => {
      for (const [key, value] of Object.entries(d))
        await run(
          'INSERT INTO platform_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
          key,
          JSON.stringify(value),
        );
      if (changed.length)
        await audit(
          req,
          'Changed platform settings',
          '',
          changed.map((k) => `${k}: ${before[k]} → ${d[k]}`).join(', '),
        );
    });
    res.json({ ok: true, changed: changed.length });
  });

  app.get('/api/admin/audit', async (req, res) =>
    res.json(
      await all('SELECT * FROM admin_audit WHERE world=? ORDER BY at DESC LIMIT 300', W(req)),
    ),
  );
}
