import express from 'express';
import { z } from 'zod';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openDatabase, transaction } from './database.js';
import { openRemoteDatabase } from './remote-database.js';
import { OAuth2Client } from 'google-auth-library';
import { bodyOf, catalogModel, key as catalogKey, nhtsaLookup, searchMakes, searchModels } from './catalog.js';
import { wikimediaImages } from './vehicle-images.js';
import { vehicleArt } from './vehicle-art.js';

const scrypt = promisify(scryptCallback);
const hash = value => createHash('sha256').update(value).digest('hex');
const id = () => randomUUID();
const text = (max = 160) => z.string().trim().min(1).max(max);
const optional = (max = 2000) => z.string().trim().max(max).default('');
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(8, 'Use at least 8 characters.').max(128);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Use a valid date.');
const money = z.number().int().min(0).max(100000000);
const userView = u => ({ id:u.id, name:u.name, email:u.email, role:u.role, googleLinked:!!u.google_id });
// Reviews can only be left on a completed booking, so every one counted here is verified.
const ratingColumns = `(SELECT ROUND(AVG(rating),1) FROM reviews WHERE garage_id=g.id) rating,(SELECT COUNT(*) FROM reviews WHERE garage_id=g.id) review_count`;
const garageView = g => ({ ...g, services: JSON.parse(g.services), published:!!g.published });
const fail = (status, message) => Object.assign(new Error(message), { status });

export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:32768:8:3:${salt}:${(await scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024})).toString('hex')}`;
}
async function passwordMatches(password, stored) {
  if (!stored || stored.startsWith('oauth:')) return false;
  const parts=stored.split(':');
  const modern=parts.length===6;
  const [salt,key]=modern?parts.slice(4):parts;
  const candidate = await scrypt(password,salt,64,modern?{N:32768,r:8,p:3,maxmem:64*1024*1024}:{});
  return timingSafeEqual(candidate,Buffer.from(key,'hex'));
}

async function defaultVerifyGoogleToken(token, expectedClientId) {
  let payload;
  try {
    const ticket = await new OAuth2Client(expectedClientId).verifyIdToken({idToken:token,audience:expectedClientId});
    payload = ticket.getPayload();
  } catch { throw fail(401, 'Invalid or expired Google token.'); }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw fail(400, 'Google account must have a verified email address.');
  }
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
  };
}

export async function createApp({ databasePath = resolve('data/motodoc.sqlite'), database, outboxPath = resolve('data/mailbox'), appOrigin = 'http://localhost:4173', production = false, clock = Date.now, googleClientId = process.env.GOOGLE_CLIENT_ID, verifyGoogleToken, vehicleLookup = nhtsaLookup(), imageLookup = wikimediaImages() } = {}) {
  if (production && !database && !process.env.TURSO_DATABASE_URL) throw new Error('Hosted database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
  const db = database || (process.env.TURSO_DATABASE_URL ? await openRemoteDatabase() : openDatabase(databasePath));
  const app = express();
  app.disable('x-powered-by');
  const origin = new URL(appOrigin).origin;
  const acceptedOrigins = new Set([origin]);
  if (!production && origin.startsWith('http://localhost:')) acceptedOrigins.add(origin.replace('localhost','127.0.0.1'));
  const cookieOptions = { httpOnly:true, sameSite:'strict', secure:production, path:'/', maxAge:7*86400000 };
  const one = (sql,...params) => db.prepare(sql).get(...params);
  const all = (sql,...params) => db.prepare(sql).all(...params);
  const run = (sql,...params) => db.prepare(sql).run(...params);
  const parse = (schema, req) => schema.parse(req.body);
  const ownGarage = async user => {
    if (user.role !== 'garage') throw fail(403,'A garage account is required.');
    return await one('SELECT * FROM garages WHERE owner_id=?',user.id);
  };
  const driverOnly = user => { if (user.role !== 'driver') throw fail(403,'A driver account is required.'); };
  const sessionToken = req => (req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith('motodoc_session='))?.slice(16);
  const session = async (req,res,user) => {
    const previous = sessionToken(req);
    if (previous) await run('DELETE FROM sessions WHERE token_hash=?',hash(previous));
    const token = randomBytes(32).toString('hex');
    await run('INSERT INTO sessions VALUES(?,?,?)',hash(token),user.id,clock()+7*86400000);
    res.cookie('motodoc_session',token,cookieOptions);
  };
  const rateLimit = async (req, category, limit = 10, subject = '') => {
    const now = clock();
    await run('DELETE FROM rate_limits WHERE expires_at<=?',now);
    for (const key of [hash(`${category}:ip:${req.ip}`), ...(subject ? [hash(`${category}:subject:${subject}`)] : [])]) {
      await run('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1',key,now+15*60000);
      if ((await one('SELECT hits FROM rate_limits WHERE key=?',key)).hits > limit) throw fail(429,'Too many attempts. Please try again in 15 minutes.');
    }
  };

  app.use('/api',async (req,res,next)=>{
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const requestOrigin = req.get('origin');
      const sameOrigin = production && requestOrigin === `https://${req.get('host')}`;
      if (!(acceptedOrigins.has(requestOrigin) || sameOrigin) || req.get('X-MotoDoc-Request') !== '1' || !req.is('application/json')) return res.status(403).json({error:'This request must come from the MotoDoc app.'});
    }
    next();
  },express.json({ limit:'24kb' }));
  app.get('/api/health',async (_req,res)=>res.json({ok:true}));
  app.get('/api/catalog/art/:file',(req,res)=>{
    const svg=vehicleArt(req.params.file.replace(/\.svg$/,''));
    if(!svg) throw fail(404,'Illustration not found.');
    res.set('Cache-Control','public, max-age=86400').type('image/svg+xml').send(svg);
  });
  app.get('/api/config',async (_req,res)=>res.json({local:!production,recoveryDelivery:production?'unavailable':'local-mailbox',googleClientId:googleClientId||null}));
  app.post('/api/auth/google',async(req,res)=>{
    await rateLimit(req,'google-auth',20);
    const data = parse(z.object({
      credential: z.string().min(10).max(8192),
      role: z.enum(['driver','garage']).default('driver')
    }),req);
    if (!googleClientId && !verifyGoogleToken) {
      throw fail(503, 'Google Sign-In is not configured. Set GOOGLE_CLIENT_ID in your environment.');
    }
    const verifier = verifyGoogleToken || (tok => defaultVerifyGoogleToken(tok, googleClientId));
    const googleUser = await verifier(data.credential);
    let user = await one('SELECT * FROM users WHERE google_id=?', googleUser.googleId);
    if (!user && await one('SELECT id FROM users WHERE email=?',googleUser.email)) {
      throw fail(409,'An account already uses this email. Log in with your password to link Google.');
    }
    if (!user) {
      user = {
        id: id(),
        name: googleUser.name,
        email: googleUser.email,
        role: data.role,
        google_id: googleUser.googleId
      };
      await transaction(db,async()=>{
        await run('INSERT INTO users(id,name,email,password_hash,role,google_id) VALUES(?,?,?,?,?,?)',
          user.id, user.name, user.email, 'oauth:google', user.role, user.google_id);
        if (user.role === 'garage') await run('INSERT INTO garages(id,owner_id,name) VALUES(?,?,?)', id(), user.id, `${user.name}’s garage`);
      });
    }
    await session(req,res,user);
    res.status(200).json({user:userView(user)});
  });
  app.post('/api/auth/signup',async(req,res)=>{
    await rateLimit(req,'signup',10);
    const data = parse(z.object({name:text(100),email:emailSchema,password:passwordSchema,role:z.enum(['driver','garage'])}).strict(),req);
    if (await one('SELECT id FROM users WHERE email=?',data.email)) throw fail(409,'Unable to create this account. Try logging in or resetting your password.');
    const password = await passwordHash(data.password);
    const user = {id:id(),...data};
    await transaction(db,async()=>{
      await run('INSERT INTO users(id,name,email,password_hash,role) VALUES(?,?,?,?,?)',user.id,data.name,data.email,password,data.role);
      if (data.role === 'garage') await run('INSERT INTO garages(id,owner_id,name) VALUES(?,?,?)',id(),user.id,`${data.name}’s garage`);
    });
    await session(req,res,user);
    res.status(201).json({user:userView(user)});
  });
  app.post('/api/auth/login',async(req,res)=>{
    const data = parse(z.object({email:emailSchema,password:z.string().min(1).max(128)}),req);
    await rateLimit(req,'login',20,data.email);
    const user = await one('SELECT * FROM users WHERE email=?',data.email);
    // Equivalent password work for unknown accounts avoids a fast missing-user path.
    const valid = await passwordMatches(data.password,user?.password_hash || `scrypt:32768:8:3:${'0'.repeat(32)}:${'0'.repeat(128)}`);
    if (!user || !valid) throw fail(401,'Email or password is incorrect.');
    if(!user.password_hash.startsWith('scrypt:')) await run('UPDATE users SET password_hash=? WHERE id=?',await passwordHash(data.password),user.id);
    await session(req,res,user); res.json({user:userView(user)});
  });
  app.post('/api/auth/forgot-password',async(req,res)=>{
    const {email} = parse(z.object({email:emailSchema}),req);
    await rateLimit(req,'recovery',5,email);
    if (production) throw fail(503,'Password recovery email is not configured. Contact the site administrator.');
    const user = await one('SELECT id FROM users WHERE email=?',email);
    if (user) {
      const token = randomBytes(32).toString('hex');
      await transaction(db,async()=>{await run('DELETE FROM resets WHERE user_id=?',user.id);await run('INSERT INTO resets VALUES(?,?,?)',hash(token),user.id,clock()+30*60000);});
      await mkdir(outboxPath,{recursive:true});
      await writeFile(join(outboxPath,`${id()}.json`),JSON.stringify({to:email,subject:'Reset your MotoDoc password',url:`${origin}/reset-password#token=${token}`,expiresInMinutes:30},null,2),{mode:0o600});
    }
    res.json({message:'If this account exists, a reset link has been saved to the local development mailbox. No external email was sent.'});
  });
  app.post('/api/auth/reset-password',async(req,res)=>{
    await rateLimit(req,'reset',10);
    const data = parse(z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:passwordSchema}),req);
    const reset = await one('SELECT * FROM resets WHERE token_hash=? AND expires_at>?',hash(data.token),clock());
    if (!reset) throw fail(400,'This reset link has expired or has already been used.');
    const password = await passwordHash(data.password);
    await transaction(db,async()=>{
      // Re-check after hashing, so concurrent attempts cannot reuse a consumed link.
      if (!await one('SELECT * FROM resets WHERE token_hash=? AND expires_at>?',hash(data.token),clock())) throw fail(400,'This reset link is no longer valid.');
      await run('UPDATE users SET password_hash=? WHERE id=?',password,reset.user_id);
      await run('DELETE FROM resets WHERE user_id=?',reset.user_id);await run('DELETE FROM sessions WHERE user_id=?',reset.user_id);
    });
    res.clearCookie('motodoc_session',{...cookieOptions,maxAge:undefined});
    res.json({message:'Password updated. Log in with your new password.'});
  });

  app.use('/api',async (req,res,next)=>{
    const token = sessionToken(req);
    req.user = token && await one('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',hash(token),clock());
    if (!req.user) return res.status(401).json({error:'Please log in to continue.'});
    next();
  });
  app.get('/api/auth/me',async (req,res)=>res.json({user:userView(req.user)}));
  app.post('/api/auth/link-google',async(req,res)=>{
    await rateLimit(req,'google-link',10,req.user.id);
    if (!googleClientId && !verifyGoogleToken) throw fail(503,'Google Sign-In is not configured.');
    const {credential}=parse(z.object({credential:z.string().min(10).max(8192)}),req);
    const googleUser=await (verifyGoogleToken || (tok=>defaultVerifyGoogleToken(tok,googleClientId)))(credential);
    if (googleUser.email !== req.user.email) throw fail(409,'Choose the Google account with the same email as your MotoDoc account.');
    if (await one('SELECT id FROM users WHERE google_id=? AND id<>?',googleUser.googleId,req.user.id)) throw fail(409,'This Google account is already connected to another MotoDoc account.');
    await run('UPDATE users SET google_id=? WHERE id=?',googleUser.googleId,req.user.id);
    res.json({ok:true});
  });
  app.post('/api/auth/logout',async (req,res)=>{await run('DELETE FROM sessions WHERE token_hash=?',hash(sessionToken(req)));res.clearCookie('motodoc_session',{...cookieOptions,maxAge:undefined});res.json({ok:true});});

  // The bundled catalogue answers first; the public NHTSA database only fills gaps, and its failures are not errors.
  const term=value=>String(value||'').trim().slice(0,60);
  const fallback=async lookup=>{try{return [...new Set(await lookup)].sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));}catch{return [];}};
  app.get('/api/catalog/makes',async(req,res)=>{
    const q=term(req.query.q),found=searchMakes(q);
    res.json((found.length || q.length<2 ? found : await fallback(vehicleLookup.makes(q))).slice(0,80));
  });
  app.get('/api/catalog/models',async(req,res)=>{
    const make=term(req.query.make),q=term(req.query.q);
    if(!make) return res.json([]);
    const found=searchModels(make,q);
    res.json((found.length ? found : await fallback(vehicleLookup.models(make,q))).slice(0,80));
  });
  // One photo per make and model, looked up once and then served from the database, including "none found".
  const vehicleImage=async(make,model)=>{
    const name=catalogModel(make,model)?.name || model,cacheKey=`${catalogKey(make)}|${catalogKey(name)}`;
    let row=await one('SELECT image_url,image_source,image_credit,image_license FROM vehicle_images WHERE key=?',cacheKey);
    if(!row) {
      try{row=await imageLookup(make,name) || {image_url:null,image_source:null,image_credit:null,image_license:null};}
      catch{return {image_url:null};}
      await run('INSERT INTO vehicle_images(key,image_url,image_source,image_credit,image_license,fetched_at) VALUES(?,?,?,?,?,?) ON CONFLICT(key) DO NOTHING',cacheKey,row.image_url,row.image_source,row.image_credit,row.image_license,new Date(clock()).toISOString());
    }
    return row;
  };
  app.get('/api/catalog/image',async(req,res)=>{
    await rateLimit(req,'catalog-image',120);
    const make=term(req.query.make),model=term(req.query.model);
    if(!make || !model) throw fail(400,'Choose a make and model.');
    res.json({...await vehicleImage(make,model),body:bodyOf(make,model)});
  });
  app.get('/api/vehicles',async (req,res)=>{driverOnly(req.user);res.json(await Promise.all((await all('SELECT v.*,c.oil_life,c.brake_wear,c.mot_due,c.updated_at condition_updated_at FROM vehicles v LEFT JOIN vehicle_condition c ON c.vehicle_id=v.id WHERE v.owner_id=? ORDER BY v.make,v.model',req.user.id)).map(async v=>({...v,body:bodyOf(v.make,v.model),...await vehicleImage(v.make,v.model)}))));});
  app.put('/api/vehicles/:id/condition',async(req,res)=>{
    driverOnly(req.user);
    if(!await one('SELECT id FROM vehicles WHERE id=? AND owner_id=?',req.params.id,req.user.id)) throw fail(404,'Vehicle not found.');
    const d=parse(z.object({oil_life:z.number().int().min(0).max(100).nullable(),brake_wear:z.number().int().min(0).max(100).nullable(),mot_due:dateSchema.nullable()}),req);
    await run('INSERT INTO vehicle_condition(vehicle_id,oil_life,brake_wear,mot_due,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(vehicle_id) DO UPDATE SET oil_life=excluded.oil_life,brake_wear=excluded.brake_wear,mot_due=excluded.mot_due,updated_at=excluded.updated_at',req.params.id,d.oil_life,d.brake_wear,d.mot_due,new Date(clock()).toISOString());
    res.json({ok:true});
  });
  const vehicleSchema = z.object({make:text(60),model:text(60),year:z.number().int().min(1900).max(new Date().getFullYear()+1),registration:text(24).transform(v=>v.toUpperCase()),mileage:z.number().int().min(0).max(5000000)});
  app.post('/api/vehicles',async (req,res)=>{
    driverOnly(req.user);const d=parse(vehicleSchema,req),key=id();
    await run('INSERT INTO vehicles VALUES(?,?,?,?,?,?,?)',key,req.user.id,d.make,d.model,d.year,d.registration,d.mileage);res.status(201).json(await one('SELECT * FROM vehicles WHERE id=?',key));
  });
  app.patch('/api/vehicles/:id',async (req,res)=>{
    driverOnly(req.user);const d=parse(vehicleSchema,req);
    if(!(await run('UPDATE vehicles SET make=?,model=?,year=?,registration=?,mileage=? WHERE id=? AND owner_id=?',d.make,d.model,d.year,d.registration,d.mileage,req.params.id,req.user.id)).changes) throw fail(404,'Vehicle not found.');res.json({ok:true});
  });
  app.delete('/api/vehicles/:id',async (req,res)=>{
    driverOnly(req.user);if(!await one('SELECT id FROM vehicles WHERE id=? AND owner_id=?',req.params.id,req.user.id)) throw fail(404,'Vehicle not found.');
    if(await one('SELECT id FROM bookings WHERE vehicle_id=?',req.params.id)) throw fail(409,'Vehicles with bookings or service history cannot be deleted.');
    await run('DELETE FROM vehicles WHERE id=?',req.params.id);res.json({ok:true});
  });
  app.get('/api/garages',async (req,res)=>res.json((await all(`SELECT g.id,g.name,g.city,g.address,g.description,g.services,g.published,${ratingColumns} FROM garages g WHERE g.published=1 ORDER BY g.name`)).map(garageView)));
  app.get('/api/garage/profile',async (req,res)=>{
    const g=await ownGarage(req.user);
    res.json({...garageView(g),phone:'',opening_hours:'',mechanic_name:'',...await one('SELECT phone,opening_hours,mechanic_name FROM garage_contact WHERE garage_id=?',g.id)});
  });
  app.put('/api/garage/contact',async(req,res)=>{
    const g=await ownGarage(req.user);
    const d=parse(z.object({phone:z.string().trim().max(30).regex(/^[+\d\s().-]*$/),opening_hours:optional(200),mechanic_name:optional(100)}),req);
    await run('INSERT INTO garage_contact(garage_id,phone,opening_hours,mechanic_name) VALUES(?,?,?,?) ON CONFLICT(garage_id) DO UPDATE SET phone=excluded.phone,opening_hours=excluded.opening_hours,mechanic_name=excluded.mechanic_name',g.id,d.phone,d.opening_hours,d.mechanic_name);
    res.json({ok:true});
  });
  app.put('/api/garage/profile',async (req,res)=>{
    const garage=await ownGarage(req.user);
    const d=parse(z.object({name:text(100),city:text(100),address:text(200),description:optional(1500),services:z.array(text(80)).min(1).max(20),published:z.boolean()}),req);
    await run('UPDATE garages SET name=?,city=?,address=?,description=?,services=?,published=? WHERE id=?',d.name,d.city,d.address,d.description,JSON.stringify([...new Set(d.services)]),Number(d.published),garage.id);res.json({ok:true});
  });
  const bookingSelect = `SELECT b.*,g.name garage_name,g.address garage_address,g.city garage_city,c.phone,c.opening_hours,c.mechanic_name,${ratingColumns},u.name driver_name,v.make,v.model,v.registration FROM bookings b JOIN garages g ON g.id=b.garage_id JOIN users u ON u.id=b.driver_id JOIN vehicles v ON v.id=b.vehicle_id LEFT JOIN garage_contact c ON c.garage_id=g.id`;
  const scopedBookings = async user => user.role==='driver' ? await all(`${bookingSelect} WHERE b.driver_id=? ORDER BY b.starts_at DESC`,user.id) : await all(`${bookingSelect} WHERE g.owner_id=? ORDER BY b.starts_at DESC`,user.id);
  app.get('/api/bookings',async (req,res)=>res.json(await scopedBookings(req.user)));
  app.get('/api/messages',async(req,res)=>{
    const column=req.user.role==='driver'?'b.driver_id':'g.owner_id';
    res.json(await all(`SELECT m.*,u.name sender_name FROM messages m JOIN bookings b ON b.id=m.booking_id JOIN garages g ON g.id=b.garage_id JOIN users u ON u.id=m.sender_id WHERE ${column}=? ORDER BY m.created_at,m.id`,req.user.id));
  });
  app.post('/api/bookings/:id/messages',async(req,res)=>{
    const d=parse(z.object({body:text(2000)}),req);
    if(!(await scopedBookings(req.user)).some(b=>b.id===req.params.id)) throw fail(404,'Booking not found.');
    const key=id();
    await run('INSERT INTO messages(id,booking_id,sender_id,body,created_at) VALUES(?,?,?,?,?)',key,req.params.id,req.user.id,d.body,new Date(clock()).toISOString());
    res.status(201).json({id:key});
  });
  const appointment = startsAt => {
    const date=new Date(startsAt),time=date.getTime();
    if(time<=clock() || time>clock()+366*86400000 || date.getUTCMinutes() || date.getUTCSeconds() || date.getUTCMilliseconds()) throw fail(400,'Choose a future hourly appointment within the next year.');
    return date;
  };
  app.put('/api/bookings/:id/schedule',async(req,res)=>{
    driverOnly(req.user);
    const date=appointment(parse(z.object({starts_at:z.iso.datetime()}),req).starts_at);
    const b=await one('SELECT status FROM bookings WHERE id=? AND driver_id=?',req.params.id,req.user.id);
    if(!b) throw fail(404,'Booking not found.');
    if(!['pending','confirmed'].includes(b.status)) throw fail(409,'Only upcoming bookings can be rescheduled.');
    // A new time needs the garage's confirmation again.
    await run("UPDATE bookings SET starts_at=?,status='pending' WHERE id=?",date.toISOString(),req.params.id);
    res.json({ok:true});
  });
  app.put('/api/bookings/:id/review',async(req,res)=>{
    driverOnly(req.user);
    const {rating}=parse(z.object({rating:z.number().int().min(1).max(5)}),req);
    const b=await one("SELECT garage_id FROM bookings WHERE id=? AND driver_id=? AND status='completed'",req.params.id,req.user.id);
    if(!b) throw fail(404,'Only your completed services can be reviewed.');
    await run('INSERT INTO reviews(booking_id,garage_id,driver_id,rating,created_at) VALUES(?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET rating=excluded.rating',req.params.id,b.garage_id,req.user.id,rating,new Date(clock()).toISOString());
    res.json({ok:true});
  });
  app.post('/api/bookings',async (req,res)=>{
    driverOnly(req.user);
    const d=parse(z.object({garage_id:z.uuid(),vehicle_id:z.uuid(),service:text(80),starts_at:z.iso.datetime(),notes:optional(1000)}),req);
    const date=appointment(d.starts_at);
    if(!await one('SELECT id FROM vehicles WHERE id=? AND owner_id=?',d.vehicle_id,req.user.id)) throw fail(404,'Vehicle not found.');
    const garage=await one('SELECT * FROM garages WHERE id=? AND published=1',d.garage_id);
    if(!garage || !JSON.parse(garage.services).includes(d.service)) throw fail(400,'Select a service offered by this garage.');
    const key=id();await run('INSERT INTO bookings(id,driver_id,garage_id,vehicle_id,service,starts_at,notes) VALUES(?,?,?,?,?,?,?)',key,req.user.id,d.garage_id,d.vehicle_id,d.service,date.toISOString(),d.notes);res.status(201).json({id:key});
  });
  app.patch('/api/bookings/:id',async (req,res)=>{
    const d=parse(z.object({status:z.enum(['confirmed','cancelled','completed']),summary:optional(2000),mileage:z.number().int().min(0).max(5000000).optional()}),req);
    const b=(await scopedBookings(req.user)).find(b=>b.id===req.params.id);
    if(!b) throw fail(404,'Booking not found.');
    if(req.user.role==='driver' && d.status!=='cancelled') throw fail(403,'Only your garage can update service progress.');
    const allowed={pending:['confirmed','cancelled'],confirmed:['completed','cancelled'],completed:[],cancelled:[]};
    if(!allowed[b.status].includes(d.status)) throw fail(409,'This booking cannot make that status change.');
    if(d.status==='completed' && (!d.summary || d.mileage===undefined)) throw fail(400,'Add a service summary and mileage to complete the booking.');
    await transaction(db,async()=>{
      await run('UPDATE bookings SET status=? WHERE id=?',d.status,b.id);
      if(d.status==='completed') {
        const vehicle=await one('SELECT mileage FROM vehicles WHERE id=?',b.vehicle_id);
        if(d.mileage<vehicle.mileage) throw fail(400,'Mileage cannot be lower than the vehicle’s recorded mileage.');
        await run('INSERT INTO service_records VALUES(?,?,?,?,?,?,?,?)',id(),b.id,b.garage_id,b.vehicle_id,b.driver_id,d.summary,d.mileage,new Date(clock()).toISOString());
        await run('UPDATE vehicles SET mileage=? WHERE id=?',d.mileage,b.vehicle_id);
      }
    });res.json({ok:true});
  });
  app.get('/api/service-history',async (req,res)=>{
    const column=req.user.role==='driver'?'r.driver_id':'g.owner_id';
    res.json(await all(`SELECT r.*,g.name garage_name,v.registration,b.service,(SELECT rating FROM reviews WHERE booking_id=r.booking_id) rating FROM service_records r JOIN garages g ON r.garage_id=g.id JOIN vehicles v ON v.id=r.vehicle_id JOIN bookings b ON b.id=r.booking_id WHERE ${column}=? ORDER BY r.performed_at DESC`,req.user.id));
  });
  app.get('/api/plans',async (req,res)=>res.json(req.user.role==='garage'?await all('SELECT * FROM plans WHERE garage_id=?',(await ownGarage(req.user)).id):await all('SELECT p.*,g.name garage_name FROM plans p JOIN garages g ON g.id=p.garage_id WHERE p.active=1 AND g.published=1')));
  app.post('/api/plans',async (req,res)=>{
    const g=await ownGarage(req.user),d=parse(z.object({name:text(100),benefits:text(1500),price_cents:money}),req),key=id();
    await run('INSERT INTO plans(id,garage_id,name,benefits,price_cents) VALUES(?,?,?,?,?)',key,g.id,d.name,d.benefits,d.price_cents);res.status(201).json({id:key});
  });
  app.get('/api/memberships',async (req,res)=>{
    const column=req.user.role==='driver'?'m.driver_id':'g.owner_id';
    res.json(await all(`SELECT m.*,p.name plan_name,p.benefits,p.price_cents,g.name garage_name,u.name driver_name FROM memberships m JOIN plans p ON p.id=m.plan_id JOIN garages g ON g.id=p.garage_id JOIN users u ON u.id=m.driver_id WHERE ${column}=? ORDER BY m.created_at DESC`,req.user.id));
  });
  app.post('/api/memberships',async (req,res)=>{
    driverOnly(req.user);const {plan_id}=parse(z.object({plan_id:z.uuid()}),req);
    if(!await one('SELECT p.id FROM plans p JOIN garages g ON g.id=p.garage_id WHERE p.id=? AND p.active=1 AND g.published=1',plan_id)) throw fail(404,'Plan not found.');
    const existing=await one('SELECT * FROM memberships WHERE driver_id=? AND plan_id=?',req.user.id,plan_id);
    if(existing && existing.status!=='cancelled') throw fail(409,'You already have a request or membership for this plan.');
    if(existing) await run("UPDATE memberships SET status='requested' WHERE id=?",existing.id);
    else await run("INSERT INTO memberships(id,driver_id,plan_id,status) VALUES(?,?,?,'requested')",id(),req.user.id,plan_id);
    res.status(201).json({ok:true});
  });
  app.patch('/api/memberships/:id',async (req,res)=>{
    const {status}=parse(z.object({status:z.enum(['active','cancelled'])}),req);
    const m=await one('SELECT m.*,g.owner_id FROM memberships m JOIN plans p ON p.id=m.plan_id JOIN garages g ON g.id=p.garage_id WHERE m.id=?',req.params.id);
    if(!m || (m.driver_id!==req.user.id && m.owner_id!==req.user.id)) throw fail(404,'Membership not found.');
    if(status==='active' && (req.user.id!==m.owner_id || m.status!=='requested')) throw fail(403,'Only the garage can approve a pending membership.');
    await run('UPDATE memberships SET status=? WHERE id=?',status,m.id);res.json({ok:true});
  });
  app.get('/api/invoices',async (req,res)=>res.json(await all(`SELECT i.*,g.name garage_name,u.name driver_name FROM invoices i JOIN garages g ON g.id=i.garage_id JOIN users u ON u.id=i.driver_id WHERE ${req.user.role==='driver'?'i.driver_id':'g.owner_id'}=? ORDER BY i.created_at DESC`,req.user.id)));
  app.post('/api/invoices',async (req,res)=>{
    const g=await ownGarage(req.user),d=parse(z.object({booking_id:z.uuid(),description:text(1000),amount_cents:money.refine(v=>v>0),due_date:dateSchema}),req);
    const b=await one("SELECT * FROM bookings WHERE id=? AND garage_id=? AND status='completed'",d.booking_id,g.id);
    if(!b) throw fail(400,'Invoices require a completed booking at your garage.');
    const key=id();await run('INSERT INTO invoices(id,booking_id,garage_id,driver_id,description,amount_cents,due_date) VALUES(?,?,?,?,?,?,?)',key,b.id,g.id,b.driver_id,d.description,d.amount_cents,d.due_date);res.status(201).json({id:key});
  });
  app.patch('/api/invoices/:id',async (req,res)=>{
    const g=await ownGarage(req.user),d=parse(z.object({status:z.enum(['paid','void']),payment_reference:optional(200)}),req);
    if(d.status==='paid'&&!d.payment_reference) throw fail(400,'Enter the reference for the payment received outside MotoDoc.');
    if(!(await run("UPDATE invoices SET status=?,payment_reference=? WHERE id=? AND garage_id=? AND status='unpaid'",d.status,d.payment_reference,req.params.id,g.id)).changes) throw fail(404,'Unpaid invoice not found.');res.json({ok:true});
  });
  app.get('/api/reminders',async (req,res)=>res.json(await all('SELECT * FROM reminders WHERE user_id=? ORDER BY done,due_date',req.user.id)));
  app.post('/api/reminders',async (req,res)=>{const d=parse(z.object({title:text(160),due_date:dateSchema}),req),key=id();await run('INSERT INTO reminders(id,user_id,title,due_date) VALUES(?,?,?,?)',key,req.user.id,d.title,d.due_date);res.status(201).json({id:key});});
  app.patch('/api/reminders/:id',async (req,res)=>{const {done}=parse(z.object({done:z.boolean()}),req);if(!(await run('UPDATE reminders SET done=? WHERE id=? AND user_id=?',Number(done),req.params.id,req.user.id)).changes) throw fail(404,'Reminder not found.');res.json({ok:true});});
  app.get('/api/customers',async (req,res)=>{
    const g=await ownGarage(req.user);
    res.json(await all(`SELECT u.id,u.name,u.email,COUNT(b.id) booking_count,COALESCE(n.notes,'') notes,COALESCE(n.tags,'') tags FROM users u JOIN bookings b ON b.driver_id=u.id LEFT JOIN customer_notes n ON n.driver_id=u.id AND n.garage_id=b.garage_id WHERE b.garage_id=? GROUP BY u.id ORDER BY u.name`,g.id));
  });
  app.put('/api/customers/:id',async (req,res)=>{
    const g=await ownGarage(req.user),d=parse(z.object({notes:optional(3000),tags:optional(300)}),req);
    if(!await one('SELECT id FROM bookings WHERE garage_id=? AND driver_id=?',g.id,req.params.id)) throw fail(404,'Customer not found.');
    await run('INSERT INTO customer_notes VALUES(?,?,?,?) ON CONFLICT(garage_id,driver_id) DO UPDATE SET notes=excluded.notes,tags=excluded.tags',g.id,req.params.id,d.notes,d.tags);res.json({ok:true});
  });
  app.get('/api/overview',async (req,res)=>{
    const bookings=await scopedBookings(req.user),isGarage=req.user.role==='garage';
    const accountId=isGarage?(await ownGarage(req.user)).id:req.user.id, col=isGarage?'garage_id':'driver_id';
    const invoiceTotals=await one(`SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END),0) paid,COALESCE(SUM(CASE WHEN status='unpaid' THEN amount_cents ELSE 0 END),0) unpaid FROM invoices WHERE ${col}=?`,accountId);
    res.json({bookings:bookings.length,upcoming:bookings.filter(b=>['pending','confirmed'].includes(b.status)).length,completed:bookings.filter(b=>b.status==='completed').length,invoiceTotals,recentBookings:bookings.slice(0,5)});
  });
  app.use('/api',async (_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
  app.use((error,_req,res,_next)=>{
    if(error instanceof z.ZodError) return res.status(400).json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join(' ')});
    if((error.code?.startsWith('ERR_SQLITE') || error.code?.startsWith('SQLITE_')) && /UNIQUE constraint failed/.test(error.message)) return res.status(409).json({error:'This record already exists, or the appointment slot is no longer available.'});
    if(error.type==='entity.parse.failed') return res.status(400).json({error:'Invalid JSON request.'});
    if(error.type==='entity.too.large') return res.status(413).json({error:'Request is too large.'});
    if(!error.status) console.error('Request failed:',error.code || error.name);
    res.status(error.status || 500).json({error:error.status?error.message:'Unable to complete the request. Please try again.'});
  });
  return {app,db};
}
