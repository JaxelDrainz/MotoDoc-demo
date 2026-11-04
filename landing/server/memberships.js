import { z } from 'zod';
import { BASIC_BENEFITS, BASIC_PRICE } from '../src/membership.js';
import { platformSettings } from './admin.js';

const addYears = (iso, years = 1) => {
  const date = new Date(iso);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
};
const euro = (cents) => `€${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
const day = (iso) => iso.slice(0, 10);

export function registerMemberships(app, ctx) {
  const { one, all, run, db, transaction, fail, parse, id, clock, ownGarage, ownerGarage } = ctx;
  const { can, driverOnly, world, worldOf } = ctx;
  const now = () => new Date(clock()).toISOString();

  const notify = (userId, kind, title, body, link = '#memberships') =>
    run(
      'INSERT INTO notices(id,user_id,kind,title,body,at,link) VALUES(?,?,?,?,?,?,?)',
      id(),
      userId,
      kind,
      title,
      body,
      now(),
      link,
    );
  const notifyGarage = async (garageId, kind, title, body) => {
    const g = await one('SELECT owner_id FROM garages WHERE id=?', garageId);
    if (g) await notify(g.owner_id, kind, title, body);
  };

  const settle = async () => {
    const due = await all(
      "SELECT * FROM memberships WHERE status='active' AND renews_at IS NOT NULL AND renews_at<=?",
      now(),
    );
    for (const m of due) {
      if (m.auto_renew && !m.garage_stopped) {
        let next = m.renews_at;
        while (next <= now()) next = addYears(next);
        await run('UPDATE memberships SET renews_at=? WHERE id=?', next, m.id);
      } else
        await run("UPDATE memberships SET status='cancelled',ended_at=renews_at WHERE id=?", m.id);
    }
  };

  const stateOf = (m) => {
    if (m.status !== 'active') return m.refund_at ? 'refunded' : 'ended';
    if (!m.auto_renew) return 'ends';
    return Date.parse(m.renews_at) - clock() < 30 * 86400000 ? 'renews soon' : 'active';
  };
  const select = `SELECT m.*,p.name plan_name,p.kind plan_kind,p.benefits,p.price_cents plan_price_cents,p.garage_id,g.name garage_name,g.city garage_city,u.name driver_name,u.email driver_email,COALESCE(gd.membership_offering,1) offering FROM memberships m JOIN plans p ON p.id=m.plan_id JOIN garages g ON g.id=p.garage_id JOIN users u ON u.id=m.driver_id LEFT JOIN garage_details gd ON gd.garage_id=g.id`;
  const view = async (rows) => {
    const out = [];
    for (const m of rows)
      out.push({
        ...m,
        auto_renew: !!m.auto_renew,
        garage_stopped: !!m.garage_stopped,
        offering: !!m.offering,
        state: stateOf(m),
        vehicles: await all(
          'SELECT v.id,v.make,v.model,v.registration FROM membership_vehicles mv JOIN vehicles v ON v.id=mv.vehicle_id WHERE mv.membership_id=? ORDER BY v.registration',
          m.id,
        ),
      });
    return out;
  };

  const planSelect = `SELECT p.*,g.name garage_name,g.city garage_city,gd.hourly_rate_cents,gd.member_rate_cents FROM plans p JOIN garages g ON g.id=p.garage_id JOIN garage_details gd ON gd.garage_id=g.id WHERE p.active=1 AND g.published=1 AND g.verification<>'rejected' AND gd.membership_offering=1 AND gd.membership_launched_at IS NOT NULL AND ${worldOf('g.owner_id')}=?`;

  app.get('/api/plans', async (req, res) => {
    if (req.user.role === 'garage') {
      if (!can(req.user, 'memberships')) return res.json([]);
      const g = await ownGarage(req.user);
      return res.json(
        await all("SELECT * FROM plans WHERE garage_id=? ORDER BY kind='garage'", g.id),
      );
    }
    res.json(await all(`${planSelect} ORDER BY g.name,p.kind='garage'`, world(req.user)));
  });

  app.get('/api/memberships', async (req, res) => {
    const driver = req.user.role === 'driver';
    if (!driver && !can(req.user, 'memberships')) return res.json([]);
    await settle();
    res.json(
      await view(
        await all(
          `${select} WHERE ${driver ? 'm.driver_id' : 'p.garage_id'}=? ORDER BY m.status='active' DESC,m.member_since DESC`,
          driver ? req.user.id : req.user.garage_id,
        ),
      ),
    );
  });

  app.post('/api/memberships', async (req, res) => {
    driverOnly(req.user);
    const d = parse(
      z.object({
        plan_id: z.string().min(1).max(64),
        vehicle_ids: z
          .array(z.string().min(1).max(64))
          .min(1, 'Choose at least one car to cover.')
          .max(10),
        billing: z.enum(['yearly', 'instalments']).default('yearly'),
      }),
      req,
    );
    const plan = await one(`${planSelect} AND p.id=?`, world(req.user), d.plan_id);
    if (!plan) throw fail(404, 'This plan isn’t available any more.');
    const ids = [...new Set(d.vehicle_ids)];
    for (const vehicleId of ids)
      if (
        !(await one(
          'SELECT 1 FROM vehicles WHERE id=? AND owner_id=? AND archived_at IS NULL',
          vehicleId,
          req.user.id,
        ))
      )
        throw fail(404, 'Vehicle not found.');
    await settle();
    for (const vehicleId of ids) {
      const covered = await one(
        "SELECT v.registration FROM membership_vehicles mv JOIN memberships m ON m.id=mv.membership_id JOIN plans p ON p.id=m.plan_id JOIN vehicles v ON v.id=mv.vehicle_id WHERE p.garage_id=? AND m.status='active' AND mv.vehicle_id=?",
        plan.garage_id,
        vehicleId,
      );
      if (covered) throw fail(409, `${covered.registration} is already covered at this garage.`);
    }
    const existing = await one(
      'SELECT * FROM memberships WHERE driver_id=? AND plan_id=?',
      req.user.id,
      plan.id,
    );
    const added = plan.price_cents * ids.length;
    let key = existing?.id || id();
    await transaction(db, async () => {
      if (existing?.status === 'active')
        await run(
          'UPDATE memberships SET price_cents=price_cents+? WHERE id=?',
          added,
          existing.id,
        );
      else {
        if (existing) {
          await run('DELETE FROM membership_vehicles WHERE membership_id=?', existing.id);
          await run(
            "UPDATE memberships SET status='active',price_cents=?,billing=?,member_since=?,renews_at=?,auto_renew=1,garage_stopped=0,ended_at=NULL,refund_cents=NULL,refund_reason='',refund_at=NULL WHERE id=?",
            added,
            d.billing,
            now(),
            addYears(now()),
            existing.id,
          );
        } else
          await run(
            "INSERT INTO memberships(id,driver_id,plan_id,status,price_cents,billing,member_since,renews_at,created_at) VALUES(?,?,?,'active',?,?,?,?,?)",
            key,
            req.user.id,
            plan.id,
            added,
            d.billing,
            now(),
            addYears(now()),
            now(),
          );
      }
      for (const vehicleId of ids)
        await run(
          'INSERT OR IGNORE INTO membership_vehicles(membership_id,vehicle_id) VALUES(?,?)',
          key,
          vehicleId,
        );
      await notifyGarage(
        plan.garage_id,
        'membership',
        'New member',
        `${req.user.name} joined ${plan.name} for ${ids.length} ${ids.length === 1 ? 'car' : 'cars'}.`,
      );
    });
    res.status(201).json({
      id: key,
      plan_name: plan.name,
      garage_name: plan.garage_name,
      price_cents: added,
    });
  });

  const mine = async (req) => {
    driverOnly(req.user);
    await settle();
    const m = await one(
      `${select} WHERE m.id=? AND m.driver_id=? AND m.status='active'`,
      req.params.id,
      req.user.id,
    );
    if (!m) throw fail(404, 'Membership not found.');
    return m;
  };

  app.post('/api/memberships/:id/cancel', async (req, res) => {
    const m = await mine(req);
    if (!m.auto_renew) throw fail(409, 'This membership is already set to end.');
    await run('UPDATE memberships SET auto_renew=0 WHERE id=?', m.id);
    await notifyGarage(
      m.garage_id,
      'membership',
      'Membership won’t renew',
      `${m.driver_name} cancelled ${m.plan_name}. Their benefits stay until ${day(m.renews_at)}.`,
    );
    res.json({ ok: true, ends_at: m.renews_at });
  });

  app.post('/api/memberships/:id/resume', async (req, res) => {
    const m = await mine(req);
    if (m.garage_stopped || !m.offering)
      throw fail(409, `${m.garage_name} has stopped offering memberships, so it can’t renew.`);
    await run('UPDATE memberships SET auto_renew=1 WHERE id=?', m.id);
    res.json({ ok: true });
  });

  app.post('/api/memberships/:id/refund', async (req, res) => {
    const m = await mine(req);
    const { reason } = parse(z.object({ reason: z.enum(['unused', 'unsatisfied']) }), req);
    await transaction(db, async () => {
      await run(
        "UPDATE memberships SET status='cancelled',auto_renew=0,ended_at=?,refund_cents=price_cents,refund_reason=?,refund_at=? WHERE id=?",
        now(),
        reason,
        now(),
        m.id,
      );
      await notifyGarage(
        m.garage_id,
        'membership',
        'Refund requested',
        `${m.driver_name} asked for a refund of ${euro(m.price_cents)} for ${m.plan_name}.`,
      );
    });
    res.json({ ok: true, refund_cents: m.price_cents });
  });

  const livePlans = (garageId) =>
    all(
      "SELECT m.*,p.kind FROM memberships m JOIN plans p ON p.id=m.plan_id WHERE p.garage_id=? AND m.status='active'",
      garageId,
    );

  app.get('/api/garage/membership', async (req, res) => {
    const g = await ownGarage(req.user, 'memberships');
    await settle();
    const details = await one('SELECT * FROM garage_details WHERE garage_id=?', g.id);
    const plans = await all('SELECT * FROM plans WHERE garage_id=?', g.id);
    const live = await livePlans(g.id);
    const plan = plans.find((p) => p.kind === 'garage') || null;
    const last = await one(
      'SELECT audience,recipients,sent_at FROM member_updates WHERE garage_id=? ORDER BY sent_at DESC LIMIT 1',
      g.id,
    );
    const yearly = live.reduce((sum, m) => sum + m.price_cents, 0);
    const share = (await platformSettings(all)).motodoc_share;
    res.json({
      launched_at: details?.membership_launched_at || null,
      offering: details ? !!details.membership_offering : true,
      hourly_rate: details?.hourly_rate_cents ? details.hourly_rate_cents / 100 : null,
      member_rate: details?.member_rate_cents ? details.member_rate_cents / 100 : null,
      plan,
      basic: plans.find((p) => p.kind === 'basic') || null,
      stats: {
        subscribers: new Set(live.map((m) => m.driver_id)).size,
        on_plan: new Set(live.filter((m) => m.kind === 'garage').map((m) => m.driver_id)).size,
        on_basic: new Set(live.filter((m) => m.kind === 'basic').map((m) => m.driver_id)).size,
        yearly_cents: yearly,
        keep_cents: Math.round((yearly * (100 - share)) / 100),
        share,
      },
      last_update: last,
    });
  });

  const rates = (v) => v.member_rate <= v.hourly_rate;
  const rateMessage = {
    message: 'The member hourly rate can’t be higher than your normal hourly rate.',
    path: ['member_rate'],
  };
  const perksSchema = z
    .array(z.string().trim().min(3).max(80))
    .min(3, 'Choose at least 3 perks.')
    .max(6);

  app.post('/api/garage/membership', async (req, res) => {
    const g = await ownerGarage(req.user, 'memberships');
    const d = parse(
      z
        .object({
          price: z.number().int().min(29).max(59),
          hourly_rate: z.number().positive().max(1000),
          member_rate: z.number().positive().max(1000),
          perks: perksSchema,
          own_perk: z.string().trim().max(60).default(''),
        })
        .refine(rates, rateMessage),
      req,
    );
    if (
      (await one('SELECT membership_launched_at FROM garage_details WHERE garage_id=?', g.id))
        ?.membership_launched_at
    )
      throw fail(409, 'Your membership is already live.');
    const perks = [...d.perks, ...(d.own_perk ? [d.own_perk] : [])];
    await transaction(db, async () => {
      await run(
        "INSERT INTO plans(id,garage_id,name,benefits,price_cents,kind) VALUES(?,?,?,?,?,'garage')",
        id(),
        g.id,
        `${g.name} membership`,
        perks.join('\n'),
        d.price * 100,
      );
      await run(
        "INSERT INTO plans(id,garage_id,name,benefits,price_cents,kind) VALUES(?,?,'Basic',?,?,'basic')",
        id(),
        g.id,
        BASIC_BENEFITS.join('\n'),
        BASIC_PRICE * 100,
      );
      await run(
        `INSERT INTO garage_details(garage_id,hourly_rate_cents,member_rate_cents,membership_launched_at,membership_offering) VALUES(?,?,?,?,1)
         ON CONFLICT(garage_id) DO UPDATE SET hourly_rate_cents=excluded.hourly_rate_cents,member_rate_cents=excluded.member_rate_cents,membership_launched_at=excluded.membership_launched_at,membership_offering=1`,
        g.id,
        Math.round(d.hourly_rate * 100),
        Math.round(d.member_rate * 100),
        now(),
      );
    });
    res.status(201).json({ ok: true });
  });

  const launched = async (req) => {
    const g = await ownerGarage(req.user, 'memberships');
    const plan = await one("SELECT * FROM plans WHERE garage_id=? AND kind='garage'", g.id);
    if (!plan) throw fail(409, 'Set up your membership first.');
    return { g, plan };
  };

  app.put('/api/garage/membership', async (req, res) => {
    const { g, plan } = await launched(req);
    const d = parse(
      z
        .object({
          price: z.number().int().min(29).max(59),
          hourly_rate: z.number().positive().max(1000),
          member_rate: z.number().positive().max(1000),
          perks: perksSchema.optional(),
        })
        .refine(rates, rateMessage),
      req,
    );
    await transaction(db, async () => {
      await run(
        'UPDATE plans SET price_cents=?,benefits=? WHERE id=?',
        d.price * 100,
        d.perks ? d.perks.join('\n') : plan.benefits,
        plan.id,
      );
      await run(
        'UPDATE garage_details SET hourly_rate_cents=?,member_rate_cents=? WHERE garage_id=?',
        Math.round(d.hourly_rate * 100),
        Math.round(d.member_rate * 100),
        g.id,
      );
    });
    res.json({ ok: true });
  });

  app.put('/api/garage/membership/offering', async (req, res) => {
    const { g } = await launched(req);
    const { on } = parse(z.object({ on: z.boolean() }), req);
    await settle();
    const affected = await all(
      `SELECT m.id,m.driver_id,m.renews_at FROM memberships m JOIN plans p ON p.id=m.plan_id WHERE p.garage_id=? AND m.status='active' AND ${on ? 'm.garage_stopped=1' : 'm.auto_renew=1'}`,
      g.id,
    );
    await transaction(db, async () => {
      await run(
        'UPDATE garage_details SET membership_offering=? WHERE garage_id=?',
        Number(on),
        g.id,
      );
      await run('UPDATE plans SET active=? WHERE garage_id=?', Number(on), g.id);
      for (const m of affected) {
        await run(
          'UPDATE memberships SET auto_renew=?,garage_stopped=? WHERE id=?',
          Number(on),
          Number(!on),
          m.id,
        );
        await notify(
          m.driver_id,
          'membership',
          on ? 'Your garage membership continues' : 'Your garage membership is ending',
          on
            ? `${g.name} is offering memberships again. Yours will renew as usual.`
            : `${g.name} has stopped offering memberships. Your benefits stay until ${day(m.renews_at)}, then it ends and you won’t be charged again.`,
        );
      }
    });
    res.json({ ok: true, notified: affected.length });
  });

  app.post('/api/garage/membership/updates', async (req, res) => {
    const g = await ownGarage(req.user, 'memberships');
    const d = parse(
      z.object({
        audience: z.enum(['all', 'basic', 'plan']),
        message: z.string().trim().min(10, 'Write a short message to your members.').max(600),
      }),
      req,
    );
    const live = await livePlans(g.id);
    const drivers = [
      ...new Set(
        live
          .filter(
            (m) => d.audience === 'all' || m.kind === (d.audience === 'basic' ? 'basic' : 'garage'),
          )
          .map((m) => m.driver_id),
      ),
    ];
    if (!drivers.length) throw fail(400, 'You don’t have members to send this to yet.');
    await transaction(db, async () => {
      for (const driverId of drivers)
        await notify(driverId, 'membership', 'News from your garage', `${g.name}: ${d.message}`);
      await run(
        'INSERT INTO member_updates(id,garage_id,audience,message,recipients,sent_at,sent_by) VALUES(?,?,?,?,?,?,?)',
        id(),
        g.id,
        d.audience,
        d.message,
        drivers.length,
        now(),
        req.user.id,
      );
    });
    res.status(201).json({ recipients: drivers.length });
  });

  app.post('/api/garage/membership/custom', async (req, res) => {
    const g = await ownerGarage(req.user, 'memberships');
    const { message } = parse(
      z.object({
        message: z
          .string()
          .trim()
          .min(10, 'Tell us what you’d like in your custom plan.')
          .max(1500),
      }),
      req,
    );
    await run(
      'INSERT INTO custom_plan_requests(id,garage_id,message,created_at,created_by) VALUES(?,?,?,?,?)',
      id(),
      g.id,
      message,
      now(),
      req.user.id,
    );
    res.status(201).json({ ok: true });
  });

  return { settle, notify };
}
