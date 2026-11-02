import express from 'express';
import { z } from 'zod';
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openDatabase, transaction } from './database.js';
import { openRemoteDatabase } from './remote-database.js';
import { OAuth2Client } from 'google-auth-library';
import {
  bodyOf,
  catalogModel,
  key as catalogKey,
  nhtsaLookup,
  searchMakes,
  searchModels,
} from './catalog.js';
import { wikimediaImages } from './vehicle-images.js';
import { mergeSite, siteDefaults, siteSchema, siteStyle } from './site.js';
import { vehicleArt } from './vehicle-art.js';
import { buildDemoWorld, demoLifetime, demoPersonas, purgeDemoWorld } from './demo.js';
import { REVIEW_TAGS, decorateBooking, jobColumns, jobJoins, registerJobs } from './jobs.js';
import { registerGarageOps } from './garage-ops.js';
import { registerInvoices } from './invoices.js';
import { registerInviteRoutes, registerTeam } from './team.js';
import { registerMemberships } from './memberships.js';
import { registerMarketplace } from './marketplace.js';
import { platformSettings, registerAdmin, registerFeedback } from './admin.js';
import { registerFuelDay } from './fuelday.js';
import { registerNotifications } from './notifications.js';
import { AREA_KEYS } from '../src/team.js';
import {
  FI_PLATE,
  SPECIALIZATIONS,
  WEEKDAYS,
  formatPlate,
  hoursProblem,
  passwordProblem,
  validBusinessId,
} from '../src/finland.js';

const scrypt = promisify(scryptCallback);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const id = () => randomUUID();
const text = (max = 160) => z.string().trim().min(1).max(max);
const optional = (max = 2000) => z.string().trim().max(max).default('');
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .max(128)
  .superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Use a valid date.',
  );
const money = z.number().int().min(0).max(100000000);
const staffAreas = (u) =>
  Number(u.staff_active) === 1 ? JSON.parse(u.staff_permissions || '[]') : [];
const NO_ACCESS =
  'You don’t have access to this. Ask the garage owner to give you access under Team & access.';
const userView = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  googleLinked: !!u.google_id,
  photo: u.photo || null,
  garageRole: u.role === 'garage' ? u.staff_role || 'owner' : null,
  permissions: u.role !== 'garage' ? [] : u.staff_role ? staffAreas(u) : AREA_KEYS,
  teamStatus: !u.staff_role
    ? null
    : Number(u.staff_active) === 1
      ? 'active'
      : Number(u.staff_active) === 0
        ? 'paused'
        : 'removed',
  demo: u.demo_persona || null,
  phone: u.phone || '',
  address: u.address || '',
  termsAccepted: !!u.terms_accepted_at,
  suspended: !!u.suspended_at,
  hasPassword: !!u.password_hash && !String(u.password_hash).startsWith('oauth:'),
  prefs: {
    emailUpdates:
      u.email_updates === undefined || u.email_updates === null ? true : !!u.email_updates,
    emailChat: !!u.email_chat,
    requestSound:
      u.request_sound === undefined || u.request_sound === null ? true : !!u.request_sound,
  },
});
const photoOf = (column) =>
  `(SELECT '/api/photos/'||user_id||'?v='||updated_at FROM photos WHERE user_id=${column})`;

const worldOf = (column) => `COALESCE((SELECT world FROM demo_users WHERE user_id=${column}),'')`;
const userSelect = `SELECT u.*,${photoOf('u.id')} photo,COALESCE((SELECT id FROM garages WHERE owner_id=u.id),(SELECT garage_id FROM garage_staff WHERE user_id=u.id)) garage_id,(SELECT role FROM garage_staff WHERE user_id=u.id) staff_role,(SELECT permissions FROM garage_staff WHERE user_id=u.id) staff_permissions,(SELECT active FROM garage_staff WHERE user_id=u.id) staff_active,(SELECT world FROM demo_users WHERE user_id=u.id) demo_world,(SELECT persona FROM demo_users WHERE user_id=u.id) demo_persona,us.phone,us.address,us.email_updates,us.email_chat,us.request_sound,us.terms_accepted_at,us.onboarded_at FROM users u LEFT JOIN user_settings us ON us.user_id=u.id`;
const ratingColumns = `(SELECT ROUND(AVG(rating),1) FROM reviews WHERE garage_id=g.id AND hidden=0) rating,(SELECT COUNT(*) FROM reviews WHERE garage_id=g.id AND hidden=0) review_count,g.verification`;
const garageView = (g) => ({ ...g, services: JSON.parse(g.services), published: !!g.published });
const fail = (status, message) => Object.assign(new Error(message), { status });

export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:32768:8:3:${salt}:${(await scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 })).toString('hex')}`;
}
async function passwordMatches(password, stored) {
  if (!stored || stored.startsWith('oauth:')) return false;
  const parts = stored.split(':');
  const modern = parts.length === 6;
  const [salt, key] = modern ? parts.slice(4) : parts;
  const candidate = await scrypt(
    password,
    salt,
    64,
    modern ? { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 } : {},
  );
  return timingSafeEqual(candidate, Buffer.from(key, 'hex'));
}

async function defaultVerifyGoogleToken(token, expectedClientId) {
  let payload;
  try {
    const ticket = await new OAuth2Client(expectedClientId).verifyIdToken({
      idToken: token,
      audience: expectedClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw fail(401, 'Invalid or expired Google token.');
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw fail(400, 'Google account must have a verified email address.');
  }
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
  };
}

export async function createApp({
  databasePath = resolve('data/motodoc.sqlite'),
  database,
  outboxPath = resolve('data/mailbox'),
  appOrigin = 'http://localhost:4173',
  production = false,
  clock = Date.now,
  googleClientId = process.env.GOOGLE_CLIENT_ID,
  verifyGoogleToken,
  vehicleLookup = nhtsaLookup(),
  imageLookup = wikimediaImages(),
  adminEmails = process.env.ADMIN_EMAILS || '',
  sendNotificationEmail,
} = {}) {
  if (production && !database && !process.env.TURSO_DATABASE_URL)
    throw new Error(
      'Hosted database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.',
    );
  const db =
    database ||
    (process.env.TURSO_DATABASE_URL ? await openRemoteDatabase() : openDatabase(databasePath));
  const app = express();
  app.disable('x-powered-by');
  const origin = new URL(appOrigin).origin;
  const acceptedOrigins = new Set([origin]);
  if (!production && origin.startsWith('http://localhost:'))
    acceptedOrigins.add(origin.replace('localhost', '127.0.0.1'));
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: production,
    path: '/',
    maxAge: 7 * 86400000,
  };
  const one = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const parse = (schema, req) => schema.parse(req.body);
  const ownGarage = async (user, area) => {
    if (user.role !== 'garage' || !user.garage_id) throw fail(403, 'A garage account is required.');
    if (
      user.staff_role &&
      (Number(user.staff_active) !== 1 || (area && !staffAreas(user).includes(area)))
    )
      throw fail(403, NO_ACCESS);
    return await one('SELECT * FROM garages WHERE id=?', user.garage_id);
  };
  const ownerGarage = async (user, area) => {
    const garage = await ownGarage(user, area);
    if (!area && user.staff_role) throw fail(403, 'Only the garage owner can do this.');
    return garage;
  };
  const can = (user, area) => !user.staff_role || staffAreas(user).includes(area);
  const world = (user) => user.demo_world || '';
  const driverOnly = (user) => {
    if (user.role !== 'driver') throw fail(403, 'A driver account is required.');
  };
  const sessionToken = (req) =>
    (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('motodoc_session='))
      ?.slice(16);
  const session = async (req, res, user) => {
    const previous = sessionToken(req);
    if (previous) await run('DELETE FROM sessions WHERE token_hash=?', hash(previous));
    const token = randomBytes(32).toString('hex');
    await run('INSERT INTO sessions VALUES(?,?,?)', hash(token), user.id, clock() + 7 * 86400000);
    res.cookie('motodoc_session', token, cookieOptions);
  };
  const rateLimit = async (req, category, limit = 10, subject = '') => {
    const now = clock();
    await run('DELETE FROM rate_limits WHERE expires_at<=?', now);
    for (const key of [
      hash(`${category}:ip:${req.ip}`),
      ...(subject ? [hash(`${category}:subject:${subject}`)] : []),
    ]) {
      await run(
        'INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1',
        key,
        now + 15 * 60000,
      );
      if ((await one('SELECT hits FROM rate_limits WHERE key=?', key)).hits > limit)
        throw fail(429, 'Too many attempts. Please try again in 15 minutes.');
    }
  };

  app.use(
    '/api',
    async (req, res, next) => {
      res.set({
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      });
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const requestOrigin = req.get('origin');
        const sameOrigin = production && requestOrigin === `https://${req.get('host')}`;
        if (
          !(acceptedOrigins.has(requestOrigin) || sameOrigin) ||
          req.get('X-MotoDoc-Request') !== '1' ||
          !req.is('application/json')
        )
          return res.status(403).json({ error: 'This request must come from the MotoDoc app.' });
      }
      next();
    },
    (req, res, next) =>
      express.json({
        limit:
          req.path.startsWith('/admin/') || /^\/market\/requests\/[^/]+\/photos$/.test(req.path)
            ? '1500kb'
            : '24kb',
      })(req, res, next),
  );
  app.get('/api/health', async (_req, res) => res.json({ ok: true }));
  const admins = new Set(
    adminEmails
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const isAdmin = (user) =>
    admins.has(String(user.email).toLowerCase()) || user.demo_persona === 'admin';
  const currentSite = async () => {
    const latest = await one(
      'SELECT data FROM site_revisions ORDER BY created_at DESC, id DESC LIMIT 1',
    );
    return mergeSite(siteDefaults, latest ? JSON.parse(latest.data) : {});
  };
  app.get('/api/site', async (_req, res) => {
    const site = await currentSite();
    res.set('Cache-Control', 'public, max-age=20, stale-while-revalidate=300');
    res.json({ site, style: siteStyle(site) });
  });
  app.get('/api/assets/:id', async (req, res) => {
    const asset = await one('SELECT mime,data FROM site_assets WHERE id=?', req.params.id);
    if (!asset) throw fail(404, 'Image not found.');
    res
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .type(asset.mime)
      .send(Buffer.from(asset.data, 'base64'));
  });
  app.get('/api/catalog/art/:file', (req, res) => {
    const svg = vehicleArt(req.params.file.replace(/\.svg$/, ''));
    if (!svg) throw fail(404, 'Illustration not found.');
    res.set('Cache-Control', 'public, max-age=86400').type('image/svg+xml').send(svg);
  });
  app.get('/api/config', async (_req, res) =>
    res.json({
      local: !production,
      recoveryDelivery: production ? 'unavailable' : 'local-mailbox',
      googleClientId: googleClientId || null,
    }),
  );
  app.post('/api/auth/google', async (req, res) => {
    await rateLimit(req, 'google-auth', 20);
    const data = parse(
      z.object({
        credential: z.string().min(10).max(8192),
        role: z.enum(['driver', 'garage']).default('driver'),
      }),
      req,
    );
    if (!googleClientId && !verifyGoogleToken) {
      throw fail(
        503,
        'Google Sign-In is not configured. Set GOOGLE_CLIENT_ID in your environment.',
      );
    }
    const verifier = verifyGoogleToken || ((tok) => defaultVerifyGoogleToken(tok, googleClientId));
    const googleUser = await verifier(data.credential);
    let user = await one('SELECT * FROM users WHERE google_id=?', googleUser.googleId);
    if (!user && (await one('SELECT id FROM users WHERE email=?', googleUser.email))) {
      throw fail(
        409,
        'An account already uses this email. Log in with your password to link Google.',
      );
    }
    if (!user) {
      user = {
        id: id(),
        name: googleUser.name,
        email: googleUser.email,
        role: data.role,
        google_id: googleUser.googleId,
      };
      await transaction(db, async () => {
        await run(
          'INSERT INTO users(id,name,email,password_hash,role,google_id) VALUES(?,?,?,?,?,?)',
          user.id,
          user.name,
          user.email,
          'oauth:google',
          user.role,
          user.google_id,
        );
        if (user.role === 'garage')
          await run(
            'INSERT INTO garages(id,owner_id,name) VALUES(?,?,?)',
            id(),
            user.id,
            `${user.name}’s garage`,
          );
      });
    }
    await session(req, res, user);
    res.status(200).json({ user: userView(user) });
  });
  app.post('/api/auth/signup', async (req, res) => {
    await rateLimit(req, 'signup', 10);
    const data = parse(
      z
        .object({
          name: text(100),
          email: emailSchema,
          password: passwordSchema,
          role: z.enum(['driver', 'garage']),
          terms: z
            .boolean()
            .refine(Boolean, 'Please accept the terms and privacy policy to continue.'),
        })
        .strict(),
      req,
    );
    if (await one('SELECT id FROM users WHERE email=?', data.email))
      throw fail(409, 'Unable to create this account. Try logging in or resetting your password.');
    const password = await passwordHash(data.password);
    const { terms: _terms, ...fields } = data;
    const user = { id: id(), ...fields };
    await transaction(db, async () => {
      await run(
        'INSERT INTO users(id,name,email,password_hash,role) VALUES(?,?,?,?,?)',
        user.id,
        data.name,
        data.email,
        password,
        data.role,
      );
      await run(
        'INSERT INTO user_settings(user_id,terms_accepted_at) VALUES(?,?)',
        user.id,
        new Date(clock()).toISOString(),
      );
      if (data.role === 'garage')
        await run(
          'INSERT INTO garages(id,owner_id,name) VALUES(?,?,?)',
          id(),
          user.id,
          `${data.name}’s garage`,
        );
    });
    await session(req, res, user);
    res.status(201).json({ user: userView(user) });
  });
  app.post('/api/auth/login', async (req, res) => {
    const data = parse(z.object({ email: emailSchema, password: z.string().min(1).max(128) }), req);
    await rateLimit(req, 'login', 20, data.email);
    const user = await one('SELECT * FROM users WHERE email=?', data.email);

    const valid = await passwordMatches(
      data.password,
      user?.password_hash || `scrypt:32768:8:3:${'0'.repeat(32)}:${'0'.repeat(128)}`,
    );
    if (!user || !valid) throw fail(401, 'Email or password is incorrect.');
    if (user.suspended_at)
      throw fail(403, 'Your account is suspended. Contact MotoDoc if you think this is a mistake.');
    if (!user.password_hash.startsWith('scrypt:'))
      await run(
        'UPDATE users SET password_hash=? WHERE id=?',
        await passwordHash(data.password),
        user.id,
      );
    await session(req, res, user);
    res.json({ user: userView(user) });
  });
  app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = parse(z.object({ email: emailSchema }), req);
    await rateLimit(req, 'recovery', 5, email);
    if (production)
      throw fail(503, 'Password recovery email is not configured. Contact the site administrator.');
    const user = await one('SELECT id FROM users WHERE email=?', email);
    if (user) {
      const token = randomBytes(32).toString('hex');
      await transaction(db, async () => {
        await run('DELETE FROM resets WHERE user_id=?', user.id);
        await run('INSERT INTO resets VALUES(?,?,?)', hash(token), user.id, clock() + 30 * 60000);
      });
      await mkdir(outboxPath, { recursive: true });
      await writeFile(
        join(outboxPath, `${id()}.json`),
        JSON.stringify(
          {
            to: email,
            subject: 'Reset your MotoDoc password',
            url: `${origin}/reset-password#token=${token}`,
            expiresInMinutes: 30,
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
    }
    res.json({
      message:
        'If this account exists, a reset link has been saved to the local development mailbox. No external email was sent.',
    });
  });
  app.post('/api/auth/reset-password', async (req, res) => {
    await rateLimit(req, 'reset', 10);
    const data = parse(
      z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: passwordSchema }),
      req,
    );
    const reset = await one(
      'SELECT * FROM resets WHERE token_hash=? AND expires_at>?',
      hash(data.token),
      clock(),
    );
    if (!reset) throw fail(400, 'This reset link has expired or has already been used.');
    const password = await passwordHash(data.password);
    await transaction(db, async () => {
      if (
        !(await one(
          'SELECT * FROM resets WHERE token_hash=? AND expires_at>?',
          hash(data.token),
          clock(),
        ))
      )
        throw fail(400, 'This reset link is no longer valid.');
      await run('UPDATE users SET password_hash=? WHERE id=?', password, reset.user_id);
      await run('DELETE FROM resets WHERE user_id=?', reset.user_id);
      await run('DELETE FROM sessions WHERE user_id=?', reset.user_id);
    });
    res.clearCookie('motodoc_session', { ...cookieOptions, maxAge: undefined });
    res.json({ message: 'Password updated. Log in with your new password.' });
  });

  app.post('/api/demo', async (req, res) => {
    const { persona } = parse(z.object({ persona: z.enum(demoPersonas) }), req);
    const token = sessionToken(req);
    const current =
      token &&
      (await one(
        'SELECT d.world,(SELECT MIN(created_at) FROM demo_users WHERE world=d.world) born FROM sessions s JOIN demo_users d ON d.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
        hash(token),
        clock(),
      ));
    let worldId = current && Number(current.born) > clock() - demoLifetime ? current.world : '';
    if (worldId) await rateLimit(req, 'demo-switch', 120);
    else {
      await rateLimit(req, 'demo', 10);
      for (const old of await all(
        'SELECT DISTINCT world FROM demo_users WHERE created_at<=? LIMIT 20',
        clock() - demoLifetime,
      ))
        await transaction(db, () => purgeDemoWorld({ run, world: old.world }));
      worldId = randomUUID();
      await transaction(db, () => buildDemoWorld({ run, clock, world: worldId }));
    }
    const user = await one(
      `${userSelect} JOIN demo_users w ON w.user_id=u.id WHERE w.world=? AND w.persona=?`,
      worldId,
      persona,
    );
    await session(req, res, user);
    res.status(201).json({
      user: { ...userView(user), admin: isAdmin(user) },
      redirect: persona === 'admin' ? '/admin' : '/app',
    });
  });
  const teamCtx = {
    one,
    all,
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
    garageFor: ownerGarage,
  };
  registerInviteRoutes(app, teamCtx);
  app.use('/api', async (req, res, next) => {
    const token = sessionToken(req);
    req.user =
      token &&
      (await one(
        `${userSelect} JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?`,
        hash(token),
        clock(),
      ));
    if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
    if (req.user.suspended_at && !['/auth/me', '/auth/logout'].includes(req.path))
      return res.status(403).json({
        error: 'Your account is suspended. Contact MotoDoc if you think this is a mistake.',
      });
    if (
      req.user.staff_role &&
      Number(req.user.staff_active) !== 1 &&
      !['/auth/me', '/auth/logout'].includes(req.path)
    )
      return res.status(403).json({
        error:
          Number(req.user.staff_active) === 0
            ? 'Your access is paused. Ask the garage owner to turn it back on.'
            : 'You were removed from this garage team.',
      });
    next();
  });
  app.get('/api/auth/me', async (req, res) =>
    res.json({
      user: {
        ...userView(req.user),
        admin: isAdmin(req.user),
        onboarded: !!(req.user.onboarded_at || req.user.staff_role || isAdmin(req.user)),
      },
    }),
  );
  const now = () => new Date(clock()).toISOString();
  const saveSettings = (userId, fields) => {
    const keys = Object.keys(fields);
    return run(
      `INSERT INTO user_settings(user_id,${keys.join(',')}) VALUES(?${',?'.repeat(keys.length)}) ON CONFLICT(user_id) DO UPDATE SET ${keys.map((k) => `${k}=excluded.${k}`).join(',')}`,
      userId,
      ...Object.values(fields),
    );
  };
  const phoneSchema = z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/, 'Use digits, spaces and + only.')
    .default('');
  const specKeys = SPECIALIZATIONS.map(([key]) => key);
  const hoursSchema = z
    .object(
      Object.fromEntries(
        WEEKDAYS.map(([key]) => [
          key,
          z.object({
            open: z.boolean(),
            from: z.string().regex(/^\d{2}:\d{2}$/),
            to: z.string().regex(/^\d{2}:\d{2}$/),
          }),
        ]),
      ),
    )
    .superRefine((hours, ctx) => {
      const problem = hoursProblem(hours);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    });
  const hoursText = (hours) =>
    WEEKDAYS.filter(([key]) => hours[key].open)
      .map(([key]) => `${key[0].toUpperCase()}${key.slice(1)} ${hours[key].from}–${hours[key].to}`)
      .join(', ');
  const garageDetails = async (garageId) => {
    const row = await one('SELECT * FROM garage_details WHERE garage_id=?', garageId);
    return {
      business_id: row?.business_id || '',
      hourly_rate: row?.hourly_rate_cents ? row.hourly_rate_cents / 100 : null,
      member_rate: row?.member_rate_cents ? row.member_rate_cents / 100 : null,
      specializations: row ? JSON.parse(row.specializations) : [],
      main_focus: row?.main_focus || '',
      hours: row?.hours ? JSON.parse(row.hours) : null,
      membership_launched_at: row?.membership_launched_at || null,
      membership_offering: row ? !!row.membership_offering : true,
    };
  };
  app.post('/api/onboarding', async (req, res) => {
    if (req.user.staff_role) throw fail(403, 'Team members don’t need to set up an account.');
    const base = {
      phone: phoneSchema,
      terms: z.boolean().optional(),
      email_updates: z.boolean().default(true),
    };
    const garage = req.user.role === 'garage';
    const d = parse(
      garage
        ? z.object({
            ...base,
            request_sound: z.boolean().default(true),
            garage: z
              .object({
                name: z.string().trim().min(2, 'Add the garage name.').max(100),
                address: z.string().trim().min(4, 'Add the street address and city.').max(200),
                business_id: z
                  .string()
                  .trim()
                  .max(9)
                  .default('')
                  .refine(
                    (v) => !v || validBusinessId(v),
                    'This Business ID doesn’t look right. Check the digits, for example 1234567-1.',
                  ),
                services: z.array(text(80)).min(1, 'Pick at least one service.').max(20),
                specializations: z
                  .array(z.enum(specKeys))
                  .min(1, 'Pick at least one specialisation.'),
                main_focus: z.enum(specKeys),
                hourly_rate: z.number().positive().max(1000),
                hours: hoursSchema,
              })
              .refine((g) => g.specializations.includes(g.main_focus), {
                message: 'Your main focus must be one of your specialisations.',
                path: ['main_focus'],
              }),
          })
        : z.object({
            ...base,
            car: z.object({
              plate: z
                .string()
                .trim()
                .regex(FI_PLATE, 'Use the Finnish format, for example ABC-123.'),
              make: text(60),
              model: text(60),
              year: z
                .number()
                .int()
                .min(1950)
                .max(new Date().getFullYear() + 1),
            }),
          }),
      req,
    );
    if (!req.user.terms_accepted_at && !d.terms)
      throw fail(400, 'Please accept the terms and privacy policy to continue.');
    await transaction(db, async () => {
      if (garage) {
        const g = d.garage;
        const city = g.address.split(',').pop().replace(/\d+/g, '').trim() || g.address;
        await run(
          'UPDATE garages SET name=?,address=?,city=?,services=?,published=1 WHERE id=?',
          g.name,
          g.address,
          city,
          JSON.stringify([...new Set(g.services)]),
          req.user.garage_id,
        );
        for (const [index, name] of [...new Set(g.services)].entries())
          if (
            !(await one(
              'SELECT 1 FROM garage_services WHERE garage_id=? AND lower(name)=lower(?)',
              req.user.garage_id,
              name,
            ))
          )
            await run(
              'INSERT INTO garage_services(id,garage_id,name,sort) VALUES(?,?,?,?)',
              id(),
              req.user.garage_id,
              name,
              index,
            );
        await run(
          `INSERT INTO garage_details(garage_id,business_id,hourly_rate_cents,specializations,main_focus,hours) VALUES(?,?,?,?,?,?)
           ON CONFLICT(garage_id) DO UPDATE SET business_id=excluded.business_id,hourly_rate_cents=excluded.hourly_rate_cents,specializations=excluded.specializations,main_focus=excluded.main_focus,hours=excluded.hours`,
          req.user.garage_id,
          g.business_id,
          Math.round(g.hourly_rate * 100),
          JSON.stringify(g.specializations),
          g.main_focus,
          JSON.stringify(g.hours),
        );
        await run(
          'INSERT INTO garage_contact(garage_id,phone,opening_hours) VALUES(?,?,?) ON CONFLICT(garage_id) DO UPDATE SET phone=excluded.phone,opening_hours=excluded.opening_hours',
          req.user.garage_id,
          d.phone,
          hoursText(g.hours),
        );
      } else {
        const plate = formatPlate(d.car.plate);
        if (
          !(await one(
            'SELECT id FROM vehicles WHERE owner_id=? AND registration=?',
            req.user.id,
            plate,
          ))
        )
          await run(
            'INSERT INTO vehicles(id,owner_id,make,model,year,registration,mileage) VALUES(?,?,?,?,?,?,0)',
            id(),
            req.user.id,
            d.car.make,
            d.car.model,
            d.car.year,
            plate,
          );
      }
      await saveSettings(req.user.id, {
        phone: d.phone,
        email_updates: Number(d.email_updates),
        ...(garage ? { request_sound: Number(d.request_sound) } : {}),
        terms_accepted_at: req.user.terms_accepted_at || now(),
        onboarded_at: now(),
      });
    });
    res.json({ next: garage ? '/onboarding/membership' : '/app' });
  });
  app.put('/api/account/settings', async (req, res) => {
    const d = parse(
      z.object({
        name: text(100).optional(),
        phone: phoneSchema,
        address: optional(200),
        email_updates: z.boolean(),
        email_chat: z.boolean(),
        request_sound: z.boolean().optional(),
      }),
      req,
    );
    if (d.name) await run('UPDATE users SET name=? WHERE id=?', d.name, req.user.id);
    await saveSettings(req.user.id, {
      phone: d.phone,
      address: d.address,
      email_updates: Number(d.email_updates),
      email_chat: Number(d.email_chat),
      ...(d.request_sound === undefined ? {} : { request_sound: Number(d.request_sound) }),
    });
    res.json({ ok: true });
  });
  app.post('/api/account/password', async (req, res) => {
    await rateLimit(req, 'password-change', 10, req.user.id);
    const d = parse(z.object({ current: z.string().min(1).max(128), next: passwordSchema }), req);
    const stored = (await one('SELECT password_hash FROM users WHERE id=?', req.user.id))
      .password_hash;
    if (stored.startsWith('oauth:'))
      throw fail(
        400,
        req.user.demo_persona
          ? 'Demo accounts don’t have a password.'
          : 'You sign in with Google, so your password is managed there.',
      );
    if (!(await passwordMatches(d.current, stored)))
      throw fail(400, 'Your current password is incorrect.');
    if (d.current === d.next) throw fail(400, 'Choose a password you haven’t used here before.');
    await run(
      'UPDATE users SET password_hash=? WHERE id=?',
      await passwordHash(d.next),
      req.user.id,
    );
    await run(
      'DELETE FROM sessions WHERE user_id=? AND token_hash<>?',
      req.user.id,
      hash(sessionToken(req)),
    );
    res.json({ ok: true });
  });
  app.delete('/api/account', async (req, res) => {
    const userId = req.user.id;
    await transaction(db, async () => {
      if (req.user.role === 'garage' && !req.user.staff_role && req.user.garage_id) {
        await run('UPDATE garages SET published=0 WHERE id=?', req.user.garage_id);
        await run('DELETE FROM garage_staff WHERE garage_id=?', req.user.garage_id);
      }
      for (const table of [
        'sessions',
        'resets',
        'photos',
        'notification_reads',
        'notification_deliveries',
        'notices',
        'reminders',
        'garage_staff',
        'user_settings',
      ])
        await run(`DELETE FROM ${table} WHERE user_id=?`, userId);
      await run(
        "UPDATE users SET name='Deleted user',email=?,password_hash='oauth:deleted',google_id=NULL WHERE id=?",
        `deleted-${userId}@deleted.invalid`,
        userId,
      );
    });
    res.clearCookie('motodoc_session', { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true });
  });
  app.use('/api/admin', (req, _res, next) => {
    if (!isAdmin(req.user))
      throw fail(403, 'Only MotoDoc administrators can change site settings.');
    if (
      req.user.demo_persona === 'admin' &&
      req.method !== 'GET' &&
      /^\/(site|revisions|assets|settings)/.test(req.path)
    )
      throw fail(
        403,
        'This is the demo admin. You can look around, but changes are not saved to the live site.',
      );
    next();
  });
  registerAdmin(app, { one, all, run, db, transaction, fail, parse, id, clock, isAdmin, worldOf });
  registerFuelDay(app, {
    one,
    all,
    run,
    db,
    transaction,
    fail,
    parse,
    id,
    clock,
    driverOnly,
    worldOf,
    isAdmin,
  });
  app.get('/api/admin/site', async (_req, res) => {
    const revisions = await all(
      'SELECT r.id,r.created_at,u.name author FROM site_revisions r LEFT JOIN users u ON u.id=r.created_by ORDER BY r.created_at DESC, r.id DESC LIMIT 30',
    );
    res.json({ site: await currentSite(), defaults: siteDefaults, revisions });
  });
  app.put('/api/admin/site', async (req, res) => {
    const site = siteSchema.parse(mergeSite(siteDefaults, req.body?.site));
    await run(
      'INSERT INTO site_revisions(id,data,created_by,created_at) VALUES(?,?,?,?)',
      id(),
      JSON.stringify(site),
      req.user.id,
      new Date(clock()).toISOString(),
    );
    res.json({ site, style: siteStyle(site) });
  });
  app.post('/api/admin/revisions/:id/restore', async (req, res) => {
    const revision = await one('SELECT data FROM site_revisions WHERE id=?', req.params.id);
    if (!revision) throw fail(404, 'Version not found.');
    await run(
      'INSERT INTO site_revisions(id,data,created_by,created_at) VALUES(?,?,?,?)',
      id(),
      revision.data,
      req.user.id,
      new Date(clock()).toISOString(),
    );
    res.json({ ok: true });
  });
  app.get('/api/admin/assets', async (_req, res) =>
    res.json(
      (await all('SELECT id,name,mime,created_at FROM site_assets ORDER BY created_at DESC')).map(
        (asset) => ({ ...asset, url: `/api/assets/${asset.id}` }),
      ),
    ),
  );
  app.post('/api/admin/assets', async (req, res) => {
    const { name, image } = parse(
      z.object({
        name: z.string().trim().min(1).max(120),
        image: z
          .string()
          .max(1400000)
          .regex(
            /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/,
            'Upload a JPG, PNG or WebP image.',
          ),
      }),
      req,
    );
    const [, mime, data] = image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    const key = randomUUID();
    await run(
      'INSERT INTO site_assets(id,name,mime,data,created_at) VALUES(?,?,?,?,?)',
      key,
      name,
      mime,
      data,
      new Date(clock()).toISOString(),
    );
    res.status(201).json({ id: key, url: `/api/assets/${key}` });
  });
  app.post('/api/auth/link-google', async (req, res) => {
    await rateLimit(req, 'google-link', 10, req.user.id);
    if (!googleClientId && !verifyGoogleToken) throw fail(503, 'Google Sign-In is not configured.');
    const { credential } = parse(z.object({ credential: z.string().min(10).max(8192) }), req);
    const googleUser = await (
      verifyGoogleToken || ((tok) => defaultVerifyGoogleToken(tok, googleClientId))
    )(credential);
    if (googleUser.email !== req.user.email)
      throw fail(409, 'Choose the Google account with the same email as your MotoDoc account.');
    if (
      await one(
        'SELECT id FROM users WHERE google_id=? AND id<>?',
        googleUser.googleId,
        req.user.id,
      )
    )
      throw fail(409, 'This Google account is already connected to another MotoDoc account.');
    await run('UPDATE users SET google_id=? WHERE id=?', googleUser.googleId, req.user.id);
    res.json({ ok: true });
  });
  app.put('/api/account/photo', async (req, res) => {
    await rateLimit(req, 'photo', 30, req.user.id);
    const { image } = parse(
      z.object({
        image: z
          .string()
          .max(22000)
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
      }),
      req,
    );
    const [, mime, data] = image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    await run(
      'INSERT INTO photos(user_id,mime,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET mime=excluded.mime,data=excluded.data,updated_at=excluded.updated_at',
      req.user.id,
      mime,
      data,
      String(clock()),
    );
    res.json({ ok: true });
  });
  app.delete('/api/account/photo', async (req, res) => {
    await run('DELETE FROM photos WHERE user_id=?', req.user.id);
    res.json({ ok: true });
  });
  app.get('/api/photos/:id', async (req, res) => {
    const photo = await one('SELECT mime,data FROM photos WHERE user_id=?', req.params.id);
    if (!photo) throw fail(404, 'Photo not found.');
    res
      .set('Cache-Control', 'private, max-age=31536000, immutable')
      .type(photo.mime)
      .send(Buffer.from(photo.data, 'base64'));
  });
  app.post('/api/auth/logout', async (req, res) => {
    await run('DELETE FROM sessions WHERE token_hash=?', hash(sessionToken(req)));
    res.clearCookie('motodoc_session', { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true });
  });

  const term = (value) =>
    String(value || '')
      .trim()
      .slice(0, 60);
  const fallback = async (lookup) => {
    try {
      return [...new Set(await lookup)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    } catch {
      return [];
    }
  };
  app.get('/api/catalog/makes', async (req, res) => {
    const q = term(req.query.q),
      found = searchMakes(q);
    res.json(
      (found.length || q.length < 2 ? found : await fallback(vehicleLookup.makes(q))).slice(0, 80),
    );
  });
  app.get('/api/catalog/models', async (req, res) => {
    const make = term(req.query.make),
      q = term(req.query.q);
    if (!make) return res.json([]);
    const found = searchModels(make, q);
    res.json((found.length ? found : await fallback(vehicleLookup.models(make, q))).slice(0, 80));
  });

  const vehicleImage = async (make, model) => {
    const name = catalogModel(make, model)?.name || model,
      cacheKey = `${catalogKey(make)}|${catalogKey(name)}`;
    let row = await one(
      'SELECT image_url,image_source,image_credit,image_license FROM vehicle_images WHERE key=?',
      cacheKey,
    );
    if (!row) {
      try {
        row = (await imageLookup(make, name)) || {
          image_url: null,
          image_source: null,
          image_credit: null,
          image_license: null,
        };
      } catch {
        return { image_url: null };
      }
      await run(
        'INSERT INTO vehicle_images(key,image_url,image_source,image_credit,image_license,fetched_at) VALUES(?,?,?,?,?,?) ON CONFLICT(key) DO NOTHING',
        cacheKey,
        row.image_url,
        row.image_source,
        row.image_credit,
        row.image_license,
        new Date(clock()).toISOString(),
      );
    }
    return row;
  };
  app.get('/api/catalog/image', async (req, res) => {
    await rateLimit(req, 'catalog-image', 120);
    const make = term(req.query.make),
      model = term(req.query.model);
    if (!make || !model) throw fail(400, 'Choose a make and model.');
    res.json({ ...(await vehicleImage(make, model)), body: bodyOf(make, model) });
  });
  app.get('/api/vehicles', async (req, res) => {
    driverOnly(req.user);
    res.json(
      await Promise.all(
        (
          await all(
            'SELECT v.*,c.oil_life,c.brake_wear,c.mot_due,c.updated_at condition_updated_at FROM vehicles v LEFT JOIN vehicle_condition c ON c.vehicle_id=v.id WHERE v.owner_id=? ORDER BY v.make,v.model',
            req.user.id,
          )
        ).map(async (v) => ({
          ...v,
          body: bodyOf(v.make, v.model),
          ...(await vehicleImage(v.make, v.model)),
        })),
      ),
    );
  });
  app.put('/api/vehicles/:id/condition', async (req, res) => {
    driverOnly(req.user);
    if (
      !(await one('SELECT id FROM vehicles WHERE id=? AND owner_id=?', req.params.id, req.user.id))
    )
      throw fail(404, 'Vehicle not found.');
    const d = parse(
      z.object({
        oil_life: z.number().int().min(0).max(100).nullable(),
        brake_wear: z.number().int().min(0).max(100).nullable(),
        mot_due: dateSchema.nullable(),
      }),
      req,
    );
    await run(
      'INSERT INTO vehicle_condition(vehicle_id,oil_life,brake_wear,mot_due,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(vehicle_id) DO UPDATE SET oil_life=excluded.oil_life,brake_wear=excluded.brake_wear,mot_due=excluded.mot_due,updated_at=excluded.updated_at',
      req.params.id,
      d.oil_life,
      d.brake_wear,
      d.mot_due,
      new Date(clock()).toISOString(),
    );
    res.json({ ok: true });
  });
  const vehicleSchema = z.object({
    make: text(60),
    model: text(60),
    year: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 1),
    registration: text(24).transform((v) => v.toUpperCase()),
    mileage: z.number().int().min(0).max(5000000),
  });
  app.post('/api/vehicles', async (req, res) => {
    driverOnly(req.user);
    const d = parse(vehicleSchema, req),
      key = id();
    await run(
      'INSERT INTO vehicles VALUES(?,?,?,?,?,?,?)',
      key,
      req.user.id,
      d.make,
      d.model,
      d.year,
      d.registration,
      d.mileage,
    );
    res.status(201).json(await one('SELECT * FROM vehicles WHERE id=?', key));
  });
  app.patch('/api/vehicles/:id', async (req, res) => {
    driverOnly(req.user);
    const d = parse(vehicleSchema, req);
    if (
      !(
        await run(
          'UPDATE vehicles SET make=?,model=?,year=?,registration=?,mileage=? WHERE id=? AND owner_id=?',
          d.make,
          d.model,
          d.year,
          d.registration,
          d.mileage,
          req.params.id,
          req.user.id,
        )
      ).changes
    )
      throw fail(404, 'Vehicle not found.');
    res.json({ ok: true });
  });
  app.delete('/api/vehicles/:id', async (req, res) => {
    driverOnly(req.user);
    if (
      !(await one('SELECT id FROM vehicles WHERE id=? AND owner_id=?', req.params.id, req.user.id))
    )
      throw fail(404, 'Vehicle not found.');
    if (await one('SELECT id FROM bookings WHERE vehicle_id=?', req.params.id))
      throw fail(409, 'Vehicles with bookings or service history cannot be deleted.');
    if (
      await one(
        "SELECT 1 FROM membership_vehicles mv JOIN memberships m ON m.id=mv.membership_id WHERE mv.vehicle_id=? AND m.status='active'",
        req.params.id,
      )
    )
      throw fail(409, 'This car is covered by a membership. Cancel the membership first.');
    await run('DELETE FROM membership_vehicles WHERE vehicle_id=?', req.params.id);
    await run('DELETE FROM vehicles WHERE id=?', req.params.id);
    res.json({ ok: true });
  });
  app.get('/api/garages', async (req, res) => {
    const list = (
      await all(
        `SELECT g.id,g.name,g.city,g.address,g.description,g.services,g.published,${ratingColumns} FROM garages g WHERE g.published=1 AND g.verification<>'rejected' AND ${worldOf('g.owner_id')}=? ORDER BY g.name`,
        world(req.user),
      )
    ).map(garageView);
    for (const g of list) Object.assign(g, await ops.publicInfo(g.id));
    res.json(list);
  });
  app.get('/api/garage/profile', async (req, res) => {
    const g = await ownGarage(req.user);
    res.json({
      ...garageView(g),
      ...(await garageDetails(g.id)),
      ...(await ops.publicInfo(g.id)),
      phone: '',
      opening_hours: '',
      mechanic_name: '',
      ...(await one(
        'SELECT phone,opening_hours,mechanic_name FROM garage_contact WHERE garage_id=?',
        g.id,
      )),
    });
  });
  app.put('/api/garage/contact', async (req, res) => {
    const g = await ownerGarage(req.user, 'services');
    const d = parse(
      z.object({
        phone: z
          .string()
          .trim()
          .max(30)
          .regex(/^[+\d\s().-]*$/),
        opening_hours: optional(200),
        mechanic_name: optional(100),
      }),
      req,
    );
    await run(
      'INSERT INTO garage_contact(garage_id,phone,opening_hours,mechanic_name) VALUES(?,?,?,?) ON CONFLICT(garage_id) DO UPDATE SET phone=excluded.phone,opening_hours=excluded.opening_hours,mechanic_name=excluded.mechanic_name',
      g.id,
      d.phone,
      d.opening_hours,
      d.mechanic_name,
    );
    res.json({ ok: true });
  });
  app.put('/api/garage/profile', async (req, res) => {
    const garage = await ownerGarage(req.user, 'services');
    const d = parse(
      z.object({
        name: text(100),
        city: text(100),
        address: text(200),
        description: optional(1500),
        services: z.array(text(80)).min(1).max(20),
        published: z.boolean(),
      }),
      req,
    );
    await run(
      'UPDATE garages SET name=?,city=?,address=?,description=?,services=?,published=? WHERE id=?',
      d.name,
      d.city,
      d.address,
      d.description,
      JSON.stringify([...new Set(d.services)]),
      Number(d.published),
      garage.id,
    );
    const names = [...new Set(d.services)];
    for (const [index, name] of names.entries())
      if (
        !(await one(
          'SELECT 1 FROM garage_services WHERE garage_id=? AND lower(name)=lower(?)',
          garage.id,
          name,
        ))
      )
        await run(
          'INSERT INTO garage_services(id,garage_id,name,sort) VALUES(?,?,?,?)',
          id(),
          garage.id,
          name,
          index,
        );
    const keep = names.map((name) => name.toLowerCase());
    for (const row of await all('SELECT id,name FROM garage_services WHERE garage_id=?', garage.id))
      await run(
        'UPDATE garage_services SET active=? WHERE id=?',
        Number(keep.includes(row.name.toLowerCase())),
        row.id,
      );
    await ops.syncServiceNames(garage.id);
    res.json({ ok: true });
  });
  const bookingSelect = `SELECT b.*,g.name garage_name,g.address garage_address,g.city garage_city,c.phone,c.opening_hours,c.mechanic_name,${photoOf('g.owner_id')} garage_photo,${photoOf('b.driver_id')} driver_photo,${ratingColumns},u.name driver_name,v.make,v.model,v.registration,${jobColumns},(SELECT COUNT(*) FROM memberships m JOIN plans p ON p.id=m.plan_id WHERE m.driver_id=b.driver_id AND p.garage_id=b.garage_id AND m.status='active') member_count FROM bookings b JOIN garages g ON g.id=b.garage_id JOIN users u ON u.id=b.driver_id JOIN vehicles v ON v.id=b.vehicle_id LEFT JOIN garage_contact c ON c.garage_id=g.id ${jobJoins}`;
  const scopedBookings = async (user) =>
    (user.role === 'driver'
      ? await all(`${bookingSelect} WHERE b.driver_id=? ORDER BY b.starts_at DESC`, user.id)
      : await all(`${bookingSelect} WHERE g.id=? ORDER BY b.starts_at DESC`, user.garage_id)
    ).map((b) => decorateBooking(b, clock(), b.member_count > 0));
  app.get('/api/bookings', async (req, res) =>
    res.json(
      can(req.user, 'bookings') || can(req.user, 'jobs') ? await scopedBookings(req.user) : [],
    ),
  );
  const bookingEvent = (bookingId, actorId, kind, detail = '') =>
    run(
      'INSERT INTO booking_events(id,booking_id,actor_id,kind,detail,at) VALUES(?,?,?,?,?,?)',
      id(),
      bookingId,
      actorId,
      kind,
      detail,
      new Date(clock()).toISOString(),
    );
  app.get('/api/garages/:id/busy', async (req, res) => {
    const range = z.object({ from: z.iso.datetime(), to: z.iso.datetime() }).parse(req.query);
    res.json(
      (
        await all(
          "SELECT starts_at FROM bookings WHERE garage_id=? AND status IN ('pending','confirmed') AND starts_at>=? AND starts_at<? ORDER BY starts_at",
          req.params.id,
          new Date(range.from).toISOString(),
          new Date(range.to).toISOString(),
        )
      ).map((row) => row.starts_at),
    );
  });
  registerNotifications(app, {
    one,
    all,
    run,
    id,
    clock,
    outboxPath,
    appOrigin,
    production,
    sendNotificationEmail,
  });
  app.get('/api/messages', async (req, res) => {
    const driver = req.user.role === 'driver';
    if (!driver && !can(req.user, 'jobs')) return res.json([]);
    res.json(
      await all(
        `SELECT m.*,u.name sender_name,${photoOf('m.sender_id')} sender_photo FROM messages m JOIN bookings b ON b.id=m.booking_id JOIN users u ON u.id=m.sender_id WHERE ${driver ? 'b.driver_id' : 'b.garage_id'}=? ORDER BY m.created_at,m.id`,
        driver ? req.user.id : req.user.garage_id,
      ),
    );
  });
  app.post('/api/bookings/:id/messages', async (req, res) => {
    const d = parse(z.object({ body: text(2000) }), req);
    if (req.user.role === 'garage') await ownGarage(req.user, 'jobs');
    const chat = (await scopedBookings(req.user)).find((b) => b.id === req.params.id);
    if (!chat) throw fail(404, 'Booking not found.');
    if (!chat.chat_open)
      throw fail(
        403,
        req.user.role === 'driver'
          ? 'This chat closed 24 hours after your repair. Garage members can keep chatting with their garage.'
          : 'This chat closed 24 hours after the repair. The customer isn’t a member of your garage.',
      );
    const key = id();
    await run(
      'INSERT INTO messages(id,booking_id,sender_id,body,created_at) VALUES(?,?,?,?,?)',
      key,
      req.params.id,
      req.user.id,
      d.body,
      new Date(clock()).toISOString(),
    );
    res.status(201).json({ id: key });
  });
  const appointment = (startsAt) => {
    const date = new Date(startsAt),
      time = date.getTime();
    if (
      time <= clock() ||
      time > clock() + 366 * 86400000 ||
      date.getUTCMinutes() ||
      date.getUTCSeconds() ||
      date.getUTCMilliseconds()
    )
      throw fail(400, 'Choose a future hourly appointment within the next year.');
    return date;
  };
  const ops = registerGarageOps(app, {
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
  });
  registerTeam(app, teamCtx);
  registerFeedback(app, { run, parse, id, clock });
  registerMemberships(app, {
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
    can,
    driverOnly,
    world,
    worldOf,
  });
  registerInvoices(app, {
    one,
    all,
    run,
    db,
    transaction,
    fail,
    parse,
    id,
    clock,
    ownerGarage,
    bookingEvent,
    text,
    optional,
    dateSchema,
  });
  const jobs = registerJobs(app, {
    checkSlot: (...args) => ops.checkSlot(...args),
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
  });
  registerMarketplace(app, {
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
    driverOnly,
    world,
    worldOf,
    text,
    optional,
    dateSchema,
    checkSlot: (...args) => ops.checkSlot(...args),
    jobs,
    bookingEvent,
    rateLimit,
  });
  app.put('/api/bookings/:id/schedule', async (req, res) => {
    driverOnly(req.user);
    const date = appointment(parse(z.object({ starts_at: z.iso.datetime() }), req).starts_at);
    const b = await one(
      'SELECT status,garage_id FROM bookings WHERE id=? AND driver_id=?',
      req.params.id,
      req.user.id,
    );
    if (!b) throw fail(404, 'Booking not found.');
    if (!['pending', 'confirmed'].includes(b.status))
      throw fail(409, 'Only upcoming bookings can be rescheduled.');
    await ops.checkSlot(b.garage_id, date.toISOString());
    const job = await one('SELECT stage FROM booking_jobs WHERE booking_id=?', req.params.id);
    if (job && job.stage !== 'booked')
      throw fail(409, 'Started appointments cannot be rescheduled.');

    await run(
      "UPDATE bookings SET starts_at=?,status='pending' WHERE id=?",
      date.toISOString(),
      req.params.id,
    );
    await jobs.ensureJob(req.params.id);
    await run("UPDATE booking_jobs SET requested_by='driver' WHERE booking_id=?", req.params.id);
    await bookingEvent(req.params.id, req.user.id, 'rescheduled');
    res.json({ ok: true });
  });
  app.put('/api/bookings/:id/review', async (req, res) => {
    driverOnly(req.user);
    const { rating, tags, comment } = parse(
      z.object({
        rating: z.number().int().min(1).max(5),
        tags: z.array(z.enum(REVIEW_TAGS)).max(6).default([]),
        comment: optional(1000),
      }),
      req,
    );
    const b = await one(
      "SELECT garage_id FROM bookings WHERE id=? AND driver_id=? AND status='completed'",
      req.params.id,
      req.user.id,
    );
    if (!b) throw fail(404, 'Only your completed services can be reviewed.');
    await run(
      'INSERT INTO reviews(booking_id,garage_id,driver_id,rating,tags,comment,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET rating=excluded.rating,tags=excluded.tags,comment=excluded.comment',
      req.params.id,
      b.garage_id,
      req.user.id,
      rating,
      JSON.stringify([...new Set(tags)]),
      comment,
      new Date(clock()).toISOString(),
    );
    await bookingEvent(req.params.id, req.user.id, 'review', `${rating}/5`);
    res.json({ ok: true });
  });
  app.post('/api/bookings', async (req, res) => {
    driverOnly(req.user);
    const d = parse(
      z.object({
        garage_id: z.uuid(),
        vehicle_id: z.uuid(),
        service: text(80),
        starts_at: z.iso.datetime(),
        notes: optional(1000),
      }),
      req,
    );
    const date = appointment(d.starts_at);
    if (
      !(await one('SELECT id FROM vehicles WHERE id=? AND owner_id=?', d.vehicle_id, req.user.id))
    )
      throw fail(404, 'Vehicle not found.');
    await ops.checkSlot(d.garage_id, date.toISOString());
    const garage = await one(
      `SELECT * FROM garages g WHERE g.id=? AND g.published=1 AND g.verification<>'rejected' AND ${worldOf('g.owner_id')}=?`,
      d.garage_id,
      world(req.user),
    );
    if (!garage || !JSON.parse(garage.services).includes(d.service))
      throw fail(400, 'Select a service offered by this garage.');
    const key = id();
    await run(
      'INSERT INTO bookings(id,driver_id,garage_id,vehicle_id,service,starts_at,notes) VALUES(?,?,?,?,?,?,?)',
      key,
      req.user.id,
      d.garage_id,
      d.vehicle_id,
      d.service,
      date.toISOString(),
      d.notes,
    );
    await jobs.ensureJob(key);
    await bookingEvent(key, req.user.id, 'requested');
    res.status(201).json({ id: key });
  });
  app.patch('/api/bookings/:id', async (req, res) => {
    const d = parse(
      z.object({
        status: z.enum(['confirmed', 'cancelled', 'completed']),
        summary: optional(2000),
        mileage: z.number().int().min(0).max(5000000).optional(),
      }),
      req,
    );
    if (req.user.role === 'garage')
      await ownGarage(req.user, d.status === 'completed' ? 'jobs' : 'bookings');
    const b = (await scopedBookings(req.user)).find((b) => b.id === req.params.id);
    if (!b) throw fail(404, 'Booking not found.');
    if (req.user.role === 'driver' && d.status !== 'cancelled')
      throw fail(403, 'Only your garage can update service progress.');
    if (d.status === 'cancelled') await jobs.cancel(req, b, {});
    else if (d.status === 'completed') {
      if (!d.summary || d.mileage === undefined)
        throw fail(400, 'Add a service summary and mileage to complete the booking.');
      await jobs.complete(req, b, { summary: d.summary, mileage: d.mileage });
    } else {
      if (b.status !== 'pending' || b.requested_by === 'garage')
        throw fail(409, 'This booking cannot make that status change.');
      await transaction(db, async () => {
        await run("UPDATE bookings SET status='confirmed' WHERE id=?", b.id);
        await jobs.ensureJob(b.id);
        await bookingEvent(b.id, req.user.id, 'confirmed');
      });
    }
    res.json({ ok: true });
  });
  app.get('/api/service-history', async (req, res) => {
    const driver = req.user.role === 'driver';
    if (!driver && !can(req.user, 'records')) return res.json([]);
    res.json(
      await all(
        `SELECT r.*,g.name garage_name,v.registration,b.service,(SELECT rating FROM reviews WHERE booking_id=r.booking_id) rating FROM service_records r JOIN garages g ON r.garage_id=g.id JOIN vehicles v ON v.id=r.vehicle_id JOIN bookings b ON b.id=r.booking_id WHERE ${driver ? 'r.driver_id' : 'r.garage_id'}=? ORDER BY r.performed_at DESC`,
        driver ? req.user.id : req.user.garage_id,
      ),
    );
  });
  app.get('/api/reminders', async (req, res) =>
    res.json(
      await all('SELECT * FROM reminders WHERE user_id=? ORDER BY done,due_date', req.user.id),
    ),
  );
  app.post('/api/reminders', async (req, res) => {
    const d = parse(z.object({ title: text(160), due_date: dateSchema }), req),
      key = id();
    await run(
      'INSERT INTO reminders(id,user_id,title,due_date) VALUES(?,?,?,?)',
      key,
      req.user.id,
      d.title,
      d.due_date,
    );
    res.status(201).json({ id: key });
  });
  app.patch('/api/reminders/:id', async (req, res) => {
    const { done } = parse(z.object({ done: z.boolean() }), req);
    if (
      !(
        await run(
          'UPDATE reminders SET done=? WHERE id=? AND user_id=?',
          Number(done),
          req.params.id,
          req.user.id,
        )
      ).changes
    )
      throw fail(404, 'Reminder not found.');
    res.json({ ok: true });
  });
  app.get('/api/customers', async (req, res) => {
    const g = await ownGarage(req.user, 'customers');
    const customers = await all(
      `SELECT u.id,u.name,u.email,${photoOf('u.id')} photo,COUNT(b.id) booking_count,COALESCE(n.notes,'') notes,COALESCE(n.tags,'') tags FROM users u JOIN bookings b ON b.driver_id=u.id LEFT JOIN customer_notes n ON n.driver_id=u.id AND n.garage_id=b.garage_id WHERE b.garage_id=? GROUP BY u.id ORDER BY u.name`,
      g.id,
    );
    for (const customer of customers)
      customer.vehicles = await all(
        'SELECT id,make,model,year,registration FROM vehicles WHERE owner_id=? ORDER BY make,model',
        customer.id,
      );
    res.json(customers);
  });
  app.put('/api/customers/:id', async (req, res) => {
    const g = await ownGarage(req.user, 'customers'),
      d = parse(z.object({ notes: optional(3000), tags: optional(300) }), req);
    if (
      !(await one('SELECT id FROM bookings WHERE garage_id=? AND driver_id=?', g.id, req.params.id))
    )
      throw fail(404, 'Customer not found.');
    await run(
      'INSERT INTO customer_notes VALUES(?,?,?,?) ON CONFLICT(garage_id,driver_id) DO UPDATE SET notes=excluded.notes,tags=excluded.tags',
      g.id,
      req.params.id,
      d.notes,
      d.tags,
    );
    res.json({ ok: true });
  });
  app.get('/api/overview', async (req, res) => {
    const bookings = await scopedBookings(req.user),
      isGarage = req.user.role === 'garage';
    const accountId = isGarage ? (await ownGarage(req.user)).id : req.user.id,
      col = isGarage ? 'garage_id' : 'driver_id';
    const invoiceTotals = !can(req.user, 'invoicing')
      ? null
      : await one(
          `SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END),0) paid,COALESCE(SUM(CASE WHEN status='unpaid' THEN amount_cents ELSE 0 END),0) unpaid FROM invoices WHERE ${col}=?`,
          accountId,
        );
    res.json({
      bookings: bookings.length,
      upcoming: bookings.filter((b) => ['pending', 'confirmed'].includes(b.status)).length,
      completed: bookings.filter((b) => b.status === 'completed').length,
      invoiceTotals,
      recentBookings: bookings.slice(0, 5),
    });
  });
  app.use('/api', async (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ') });
    if (
      (error.code?.startsWith('ERR_SQLITE') || error.code?.startsWith('SQLITE_')) &&
      /UNIQUE constraint failed/.test(error.message)
    )
      return res.status(409).json({
        error: 'This record already exists, or the appointment slot is no longer available.',
      });
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'Invalid JSON request.' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'Request is too large.' });
    if (!error.status) console.error('Request failed:', error.code || error.name);
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'Unable to complete the request. Please try again.',
    });
  });
  return { app, db };
}
