import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AREA_KEYS, ASSIGNABLE, ROLES } from '../src/team.js';

const inviteCode = () =>
  [...randomBytes(10)].map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

export function registerInviteRoutes(app, ctx) {
  const {
    one,
    run,
    db,
    transaction,
    fail,
    parse,
    id,
    clock,
    passwordHash,
    passwordSchema,
    session,
    rateLimit,
    text,
  } = ctx;
  const findInvite = async (code) => {
    const invite = await one(
      "SELECT i.*,g.name garage_name FROM team_invites i JOIN garages g ON g.id=i.garage_id WHERE i.code=? AND i.status='invited'",
      String(code).toUpperCase(),
    );
    if (!invite)
      throw fail(
        404,
        'This invite link doesn’t work any more. It was already used or the invite was cancelled. Ask the garage owner to send a new one.',
      );
    return invite;
  };
  app.get('/api/invites/:code', async (req, res) => {
    await rateLimit(req, 'invite-look', 60);
    const invite = await findInvite(req.params.code);
    res.json({
      garage_name: invite.garage_name,
      name: invite.name,
      email: invite.email,
      role: invite.role,
    });
  });
  app.post('/api/invites/:code/accept', async (req, res) => {
    await rateLimit(req, 'invite-accept', 10);
    const invite = await findInvite(req.params.code);
    const d = parse(
      z.object({
        name: text(100),
        password: passwordSchema,
        terms: z
          .boolean()
          .refine(Boolean, 'Please accept the terms and privacy policy to continue.'),
      }),
      req,
    );
    if (await one('SELECT id FROM users WHERE email=?', invite.email))
      throw fail(
        409,
        'An account with this email already exists. Ask the garage owner to invite a different email address.',
      );
    const user = { id: id(), name: d.name, email: invite.email, role: 'garage' };
    const now = new Date(clock()).toISOString();
    await transaction(db, async () => {
      await run(
        'INSERT INTO users(id,name,email,password_hash,role) VALUES(?,?,?,?,?)',
        user.id,
        d.name,
        invite.email,
        await passwordHash(d.password),
        'garage',
      );
      await run(
        'INSERT INTO user_settings(user_id,phone,terms_accepted_at,onboarded_at) VALUES(?,?,?,?)',
        user.id,
        invite.phone,
        now,
        now,
      );
      await run(
        'INSERT INTO garage_staff(user_id,garage_id,role,permissions,active,created_at) VALUES(?,?,?,?,1,?)',
        user.id,
        invite.garage_id,
        invite.role,
        invite.permissions,
        now,
      );
      const demo = await one(
        'SELECT world FROM demo_users WHERE user_id=(SELECT owner_id FROM garages WHERE id=?)',
        invite.garage_id,
      );
      if (demo)
        await run(
          "INSERT INTO demo_users(user_id,world,persona,created_at) VALUES(?,?,'staff',?)",
          user.id,
          demo.world,
          clock(),
        );
      await run(
        "UPDATE team_invites SET status='accepted',user_id=? WHERE code=?",
        user.id,
        invite.code,
      );
    });
    await session(req, res, user);
    res.status(201).json({ garage_name: invite.garage_name });
  });
}

export function registerTeam(app, ctx) {
  const { one, all, run, db, transaction, fail, parse, clock, garageFor, text } = ctx;
  const presets = (role) => JSON.stringify(ROLES[role][2]);

  app.get('/api/team', async (req, res) => {
    const g = await garageFor(req.user, 'team');
    const owner = await one(
      `SELECT u.id,u.name,u.email,us.phone FROM garages g JOIN users u ON u.id=g.owner_id LEFT JOIN user_settings us ON us.user_id=u.id WHERE g.id=?`,
      g.id,
    );
    const members = await all(
      `SELECT u.id,u.name,u.email,us.phone,s.role,s.permissions,s.active,s.created_at FROM garage_staff s JOIN users u ON u.id=s.user_id LEFT JOIN user_settings us ON us.user_id=u.id WHERE s.garage_id=? AND s.active>=0 ORDER BY u.name`,
      g.id,
    );
    const invites = await all(
      "SELECT code,name,email,phone,role,permissions,invited_at FROM team_invites WHERE garage_id=? AND status='invited' ORDER BY invited_at DESC",
      g.id,
    );
    res.json({
      owner: { ...owner, role: 'owner', permissions: AREA_KEYS, status: 'active' },
      members: members.map((m) => ({
        ...m,
        permissions: JSON.parse(m.permissions),
        status: m.active ? 'active' : 'paused',
        active: !!m.active,
      })),
      invites: invites.map((i) => ({
        ...i,
        permissions: JSON.parse(i.permissions),
        status: 'invited',
      })),
    });
  });

  app.post('/api/team/invites', async (req, res) => {
    const g = await garageFor(req.user, 'team');
    const d = parse(
      z.object({
        name: text(100),
        email: z.string().trim().toLowerCase().email('Add a name and an email address.').max(254),
        phone: z.string().trim().max(30).default(''),
        role: z.enum(ASSIGNABLE).default('mechanic'),
      }),
      req,
    );
    if (
      await one(
        `SELECT 1 FROM team_invites WHERE garage_id=? AND email=? AND status='invited'
         UNION SELECT 1 FROM garage_staff s JOIN users u ON u.id=s.user_id WHERE s.garage_id=? AND s.active>=0 AND u.email=?
         UNION SELECT 1 FROM garages g JOIN users u ON u.id=g.owner_id WHERE g.id=? AND u.email=?`,
        g.id,
        d.email,
        g.id,
        d.email,
        g.id,
        d.email,
      )
    )
      throw fail(409, 'This person is already on your team or has an invite.');
    const code = inviteCode();
    await run(
      "INSERT INTO team_invites(code,garage_id,name,email,phone,role,permissions,status,invited_at,invited_by) VALUES(?,?,?,?,?,?,?,'invited',?,?)",
      code,
      g.id,
      d.name,
      d.email,
      d.phone,
      d.role,
      presets(d.role),
      new Date(clock()).toISOString(),
      req.user.id,
    );
    res.status(201).json({ code });
  });

  app.post('/api/team/invites/:code/resend', async (req, res) => {
    const g = await garageFor(req.user, 'team');
    const result = await run(
      "UPDATE team_invites SET invited_at=? WHERE code=? AND garage_id=? AND status='invited'",
      new Date(clock()).toISOString(),
      req.params.code,
      g.id,
    );
    if (!result.changes) throw fail(404, 'Invite not found.');
    res.json({ ok: true });
  });

  app.delete('/api/team/invites/:code', async (req, res) => {
    const g = await garageFor(req.user, 'team');
    const result = await run(
      "UPDATE team_invites SET status='cancelled' WHERE code=? AND garage_id=? AND status='invited'",
      req.params.code,
      g.id,
    );
    if (!result.changes) throw fail(404, 'Invite not found.');
    res.json({ ok: true });
  });

  const member = async (req) => {
    const g = await garageFor(req.user, 'team');
    if (req.params.id === req.user.id)
      throw fail(403, 'You can’t change your own access. Ask the garage owner.');
    const m = await one(
      'SELECT * FROM garage_staff WHERE user_id=? AND garage_id=? AND active>=0',
      req.params.id,
      g.id,
    );
    if (!m) throw fail(404, 'Team member not found. The owner always has full access.');
    return m;
  };

  app.put('/api/team/members/:id', async (req, res) => {
    const m = await member(req);
    const d = parse(
      z.object({
        role: z.enum(ASSIGNABLE).optional(),
        permissions: z.array(z.enum(AREA_KEYS)).max(AREA_KEYS.length).optional(),
        active: z.boolean().optional(),
      }),
      req,
    );
    const permissions = d.permissions
      ? JSON.stringify([...new Set(d.permissions)])
      : d.role && d.role !== m.role
        ? presets(d.role)
        : m.permissions;
    await transaction(db, async () => {
      await run(
        'UPDATE garage_staff SET role=?,permissions=?,active=? WHERE user_id=?',
        d.role || m.role,
        permissions,
        d.active === undefined ? m.active : Number(d.active),
        m.user_id,
      );
      if (d.active === false) await run('DELETE FROM sessions WHERE user_id=?', m.user_id);
    });
    res.json({ ok: true });
  });

  app.delete('/api/team/members/:id', async (req, res) => {
    const m = await member(req);
    await transaction(db, async () => {
      await run('UPDATE garage_staff SET active=-1,permissions=? WHERE user_id=?', '[]', m.user_id);
      await run('DELETE FROM sessions WHERE user_id=?', m.user_id);
    });
    res.json({ ok: true });
  });
}
