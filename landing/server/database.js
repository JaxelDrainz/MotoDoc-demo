import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const schemaSql = `
    CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('driver','garage')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS garages(
      id TEXT PRIMARY KEY,owner_id TEXT NOT NULL UNIQUE REFERENCES users(id),name TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',
      services TEXT NOT NULL DEFAULT '[]',published INTEGER NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS vehicles(
      id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),make TEXT NOT NULL,model TEXT NOT NULL,
      year INTEGER NOT NULL,registration TEXT NOT NULL,mileage INTEGER NOT NULL DEFAULT 0,
      UNIQUE(owner_id,registration));
    CREATE TABLE IF NOT EXISTS bookings(
      id TEXT PRIMARY KEY,driver_id TEXT NOT NULL REFERENCES users(id),garage_id TEXT NOT NULL REFERENCES garages(id),
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id),service TEXT NOT NULL,starts_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','confirmed','completed','cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS garage_slot ON bookings(garage_id,starts_at) WHERE status IN ('pending','confirmed');
    CREATE UNIQUE INDEX IF NOT EXISTS vehicle_slot ON bookings(vehicle_id,starts_at) WHERE status IN ('pending','confirmed');
    CREATE INDEX IF NOT EXISTS driver_bookings ON bookings(driver_id);
    CREATE TABLE IF NOT EXISTS service_records(
      id TEXT PRIMARY KEY,booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),garage_id TEXT NOT NULL REFERENCES garages(id),
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id),driver_id TEXT NOT NULL REFERENCES users(id),
      summary TEXT NOT NULL,mileage INTEGER NOT NULL,performed_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS plans(
      id TEXT PRIMARY KEY,garage_id TEXT NOT NULL REFERENCES garages(id),name TEXT NOT NULL,
      benefits TEXT NOT NULL,price_cents INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS memberships(
      id TEXT PRIMARY KEY,driver_id TEXT NOT NULL REFERENCES users(id),plan_id TEXT NOT NULL REFERENCES plans(id),
      status TEXT NOT NULL CHECK(status IN('requested','active','cancelled')),created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(driver_id,plan_id));
    CREATE TABLE IF NOT EXISTS invoices(
      id TEXT PRIMARY KEY,booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),garage_id TEXT NOT NULL REFERENCES garages(id),
      driver_id TEXT NOT NULL REFERENCES users(id),description TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
      status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN('unpaid','paid','void')),due_date TEXT NOT NULL,
      payment_reference TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS reminders(
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,due_date TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS customer_notes(
      garage_id TEXT NOT NULL REFERENCES garages(id),driver_id TEXT NOT NULL REFERENCES users(id),
      notes TEXT NOT NULL DEFAULT '',tags TEXT NOT NULL DEFAULT '',PRIMARY KEY(garage_id,driver_id));
    CREATE TABLE IF NOT EXISTS vehicle_condition(
      vehicle_id TEXT PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
      oil_life INTEGER CHECK(oil_life BETWEEN 0 AND 100),
      brake_wear INTEGER CHECK(brake_wear BETWEEN 0 AND 100),
      mot_due TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS garage_contact(
      garage_id TEXT PRIMARY KEY REFERENCES garages(id) ON DELETE CASCADE,
      phone TEXT NOT NULL DEFAULT '',opening_hours TEXT NOT NULL DEFAULT '',
      mechanic_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS messages(
      id TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES bookings(id),
      sender_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,
      created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS booking_messages ON messages(booking_id,created_at);
    CREATE TABLE IF NOT EXISTS reviews(
      booking_id TEXT PRIMARY KEY REFERENCES bookings(id),garage_id TEXT NOT NULL REFERENCES garages(id),
      driver_id TEXT NOT NULL REFERENCES users(id),rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS garage_reviews ON reviews(garage_id);
    CREATE TABLE IF NOT EXISTS vehicle_images(
      key TEXT PRIMARY KEY,image_url TEXT,image_source TEXT,image_credit TEXT,image_license TEXT,
      fetched_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS photos(
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      mime TEXT NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS booking_events(
      id TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES bookings(id),
      actor_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS booking_event_times ON booking_events(booking_id,at);
    CREATE TABLE IF NOT EXISTS notification_reads(
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,seen_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS site_revisions(
      id TEXT PRIMARY KEY,data TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS site_revision_times ON site_revisions(created_at);
    CREATE TABLE IF NOT EXISTS site_assets(
      id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS garage_staff(
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,garage_id TEXT NOT NULL REFERENCES garages(id),
      role TEXT NOT NULL DEFAULT 'mechanic',created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS garage_team ON garage_staff(garage_id);
    CREATE TABLE IF NOT EXISTS demo_users(
      user_id TEXT PRIMARY KEY,world TEXT NOT NULL,persona TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS demo_worlds ON demo_users(world,created_at);
    CREATE TABLE IF NOT EXISTS user_settings(
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',email_updates INTEGER NOT NULL DEFAULT 1,email_chat INTEGER NOT NULL DEFAULT 0,
      request_sound INTEGER NOT NULL DEFAULT 1,terms_accepted_at TEXT,onboarded_at TEXT);
    CREATE TABLE IF NOT EXISTS garage_details(
      garage_id TEXT PRIMARY KEY REFERENCES garages(id) ON DELETE CASCADE,business_id TEXT NOT NULL DEFAULT '',
      hourly_rate_cents INTEGER,member_rate_cents INTEGER,specializations TEXT NOT NULL DEFAULT '[]',
      main_focus TEXT NOT NULL DEFAULT '',hours TEXT NOT NULL DEFAULT '',membership_launched_at TEXT);
    CREATE TABLE IF NOT EXISTS booking_jobs(
      booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,requested_by TEXT NOT NULL DEFAULT 'driver',
      stage TEXT NOT NULL DEFAULT 'booked',mechanic TEXT NOT NULL DEFAULT '',pickup_at TEXT,pickup_note TEXT NOT NULL DEFAULT '',
      completed_at TEXT,no_show INTEGER NOT NULL DEFAULT 0,declined INTEGER NOT NULL DEFAULT 0,cancel_reason TEXT NOT NULL DEFAULT '',
      cancelled_by TEXT NOT NULL DEFAULT '',cost_cents INTEGER,parts TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS garage_services(
      id TEXT PRIMARY KEY,garage_id TEXT NOT NULL REFERENCES garages(id) ON DELETE CASCADE,name TEXT NOT NULL,
      price_min_cents INTEGER,price_max_cents INTEGER,minutes INTEGER,description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,sort INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS garage_menu ON garage_services(garage_id,sort);
    CREATE TABLE IF NOT EXISTS garage_blocked(
      garage_id TEXT NOT NULL REFERENCES garages(id) ON DELETE CASCADE,date TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',PRIMARY KEY(garage_id,date));
    CREATE TABLE IF NOT EXISTS invoice_lines(
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,position INTEGER NOT NULL,
      description TEXT NOT NULL,quantity REAL NOT NULL DEFAULT 1,unit_cents INTEGER NOT NULL,
      discount_pct REAL NOT NULL DEFAULT 0,PRIMARY KEY(invoice_id,position));
    INSERT OR IGNORE INTO schema_versions(version) VALUES(1);
  `;

export const migrations = [
  [
    2,
    [
      'INSERT OR IGNORE INTO user_settings(user_id,terms_accepted_at,onboarded_at) SELECT id,created_at,created_at FROM users',
    ],
  ],
  [
    3,
    [
      "ALTER TABLE booking_events ADD COLUMN detail TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE reviews ADD COLUMN comment TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE reviews ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
      'ALTER TABLE reviews ADD COLUMN reply TEXT',
      'ALTER TABLE reviews ADD COLUMN reply_at TEXT',
      'ALTER TABLE reviews ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0',
      "INSERT OR IGNORE INTO booking_jobs(booking_id,stage,completed_at) SELECT id,CASE WHEN status='completed' THEN 'finished' ELSE 'booked' END,CASE WHEN status='completed' THEN starts_at END FROM bookings",
    ],
  ],
  [
    4,
    [
      'ALTER TABLE garage_details ADD COLUMN online INTEGER NOT NULL DEFAULT 1',
      'INSERT INTO garage_services(id,garage_id,name,sort) SELECT lower(hex(randomblob(16))),g.id,j.value,j.key FROM garages g,json_each(g.services) j',
    ],
  ],
  [
    5,
    [
      "ALTER TABLE invoices ADD COLUMN number TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE invoices ADD COLUMN reference TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE invoices ADD COLUMN vat_rate REAL NOT NULL DEFAULT 25.5',
      "ALTER TABLE invoices ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'none'",
      'ALTER TABLE invoices ADD COLUMN discount_value INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE invoices ADD COLUMN discount_reason TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE invoices ADD COLUMN mileage INTEGER',
      "ALTER TABLE invoices ADD COLUMN business_id TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE invoices ADD COLUMN einvoice_address TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE invoices ADD COLUMN operator TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE invoices ADD COLUMN delivery TEXT NOT NULL DEFAULT 'motodoc'",
      "ALTER TABLE invoices ADD COLUMN notes TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE invoices ADD COLUMN reminders TEXT NOT NULL DEFAULT '[]'",
      'ALTER TABLE invoices ADD COLUMN paid_at TEXT',
      'ALTER TABLE invoices ADD COLUMN paid_method TEXT',
      'INSERT OR IGNORE INTO invoice_lines(invoice_id,position,description,quantity,unit_cents,discount_pct) SELECT id,0,description,1,amount_cents,0 FROM invoices',
      "UPDATE invoices SET number='INV-'||substr(created_at,1,4)||'-'||upper(substr(id,1,4)) WHERE number=''",
    ],
  ],
  [
    6,
    [
      "ALTER TABLE garage_staff ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]'",
      'ALTER TABLE garage_staff ADD COLUMN active INTEGER NOT NULL DEFAULT 1',
      `UPDATE garage_staff SET permissions='["bookings","jobs","records","customers"]' WHERE role='mechanic'`,
      `CREATE TABLE IF NOT EXISTS team_invites(
        code TEXT PRIMARY KEY,garage_id TEXT NOT NULL REFERENCES garages(id) ON DELETE CASCADE,name TEXT NOT NULL,
        email TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',role TEXT NOT NULL,permissions TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'invited',invited_at TEXT NOT NULL,invited_by TEXT NOT NULL DEFAULT '',user_id TEXT)`,
      'CREATE INDEX IF NOT EXISTS team_invite_garage ON team_invites(garage_id,status)',
    ],
  ],
  [
    7,
    [
      "ALTER TABLE plans ADD COLUMN kind TEXT NOT NULL DEFAULT 'garage'",
      'ALTER TABLE memberships ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE memberships ADD COLUMN billing TEXT NOT NULL DEFAULT 'yearly'",
      'ALTER TABLE memberships ADD COLUMN member_since TEXT',
      'ALTER TABLE memberships ADD COLUMN renews_at TEXT',
      'ALTER TABLE memberships ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE memberships ADD COLUMN garage_stopped INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE memberships ADD COLUMN ended_at TEXT',
      'ALTER TABLE memberships ADD COLUMN refund_cents INTEGER',
      "ALTER TABLE memberships ADD COLUMN refund_reason TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE memberships ADD COLUMN refund_at TEXT',
      'ALTER TABLE garage_details ADD COLUMN membership_offering INTEGER NOT NULL DEFAULT 1',
      `CREATE TABLE IF NOT EXISTS membership_vehicles(
        membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,PRIMARY KEY(membership_id,vehicle_id))`,
      `CREATE TABLE IF NOT EXISTS notices(
        id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,
        title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',at TEXT NOT NULL,link TEXT NOT NULL DEFAULT '')`,
      'CREATE INDEX IF NOT EXISTS notice_user ON notices(user_id,at)',
      `CREATE TABLE IF NOT EXISTS member_updates(
        id TEXT PRIMARY KEY,garage_id TEXT NOT NULL REFERENCES garages(id) ON DELETE CASCADE,audience TEXT NOT NULL,
        message TEXT NOT NULL,recipients INTEGER NOT NULL,sent_at TEXT NOT NULL,sent_by TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS custom_plan_requests(
        id TEXT PRIMARY KEY,garage_id TEXT NOT NULL REFERENCES garages(id) ON DELETE CASCADE,message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',created_at TEXT NOT NULL,created_by TEXT NOT NULL)`,
      "UPDATE memberships SET status='active' WHERE status='requested'",
      "UPDATE memberships SET member_since=COALESCE(created_at,datetime('now')),price_cents=(SELECT price_cents FROM plans WHERE id=memberships.plan_id)",
      "UPDATE memberships SET renews_at=strftime('%Y-%m-%dT%H:%M:%fZ',member_since,'+1 year')",
      "UPDATE memberships SET auto_renew=0,ended_at=member_since WHERE status='cancelled'",
      'INSERT OR IGNORE INTO membership_vehicles(membership_id,vehicle_id) SELECT m.id,v.id FROM memberships m JOIN vehicles v ON v.owner_id=m.driver_id',
      `INSERT INTO plans(id,garage_id,name,benefits,price_cents,kind) SELECT lower(hex(randomblob(16))),garage_id,'Basic','All your service history in one place
Inspection & service reminders
Direct contact with garage',1200,'basic' FROM garage_details WHERE membership_launched_at IS NOT NULL`,
    ],
  ],
  [
    8,
    [
      `CREATE TABLE IF NOT EXISTS market_requests(
        id TEXT PRIMARY KEY,driver_id TEXT NOT NULL REFERENCES users(id),vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        service TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'service',urgency TEXT NOT NULL DEFAULT 'week',
        preferred_date TEXT NOT NULL,area TEXT NOT NULL,description TEXT NOT NULL,mileage INTEGER,
        status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL,closed_at TEXT,booking_id TEXT)`,
      'CREATE INDEX IF NOT EXISTS market_open ON market_requests(status,created_at)',
      `CREATE TABLE IF NOT EXISTS market_photos(
        id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES market_requests(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,mime TEXT NOT NULL,data TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS market_quotes(
        id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES market_requests(id) ON DELETE CASCADE,
        garage_id TEXT NOT NULL REFERENCES garages(id),price_cents INTEGER NOT NULL,starts_at TEXT NOT NULL,
        minutes INTEGER NOT NULL,notes TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'sent',
        created_at TEXT NOT NULL,UNIQUE(request_id,garage_id))`,
      "ALTER TABLE booking_jobs ADD COLUMN source TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE booking_jobs ADD COLUMN quote_cents INTEGER',
      'ALTER TABLE booking_jobs ADD COLUMN quote_minutes INTEGER',
    ],
  ],
  [
    9,
    [
      'ALTER TABLE users ADD COLUMN suspended_at TEXT',
      "ALTER TABLE users ADD COLUMN suspended_reason TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE garages ADD COLUMN verification TEXT NOT NULL DEFAULT 'pending'",
      'ALTER TABLE garages ADD COLUMN verified_at TEXT',
      "ALTER TABLE garages ADD COLUMN verification_note TEXT NOT NULL DEFAULT ''",
      `CREATE TABLE IF NOT EXISTS feedback(
        id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,kind TEXT NOT NULL,
        message TEXT NOT NULL,page TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'new',created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS announcements(
        id TEXT PRIMARY KEY,world TEXT NOT NULL DEFAULT '',audience TEXT NOT NULL,title TEXT NOT NULL,
        message TEXT NOT NULL,recipients INTEGER NOT NULL,sent_at TEXT NOT NULL,sent_by TEXT NOT NULL)`,
      'CREATE TABLE IF NOT EXISTS platform_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)',
      `CREATE TABLE IF NOT EXISTS admin_audit(
        id TEXT PRIMARY KEY,world TEXT NOT NULL DEFAULT '',admin_id TEXT NOT NULL,admin_name TEXT NOT NULL,
        action TEXT NOT NULL,target TEXT NOT NULL DEFAULT '',detail TEXT NOT NULL DEFAULT '',at TEXT NOT NULL)`,
      'CREATE INDEX IF NOT EXISTS admin_audit_time ON admin_audit(world,at)',
    ],
  ],
  [
    10,
    [
      `CREATE TABLE IF NOT EXISTS fuel_days(
        id TEXT PRIMARY KEY,world TEXT NOT NULL DEFAULT '',station_name TEXT NOT NULL,station_address TEXT NOT NULL,
        date TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,amount_cents INTEGER NOT NULL,cap INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL,created_by TEXT NOT NULL,live_at TEXT,ended_at TEXT)`,
      'CREATE INDEX IF NOT EXISTS fuel_day_world ON fuel_days(world,date)',
      `CREATE TABLE IF NOT EXISTS fuel_passes(
        code TEXT PRIMARY KEY,fuel_day_id TEXT NOT NULL REFERENCES fuel_days(id) ON DELETE CASCADE,
        driver_id TEXT NOT NULL REFERENCES users(id),vehicle_id TEXT,car_label TEXT NOT NULL,plate TEXT NOT NULL,
        claimed_at TEXT NOT NULL,used_at TEXT,used_by TEXT NOT NULL DEFAULT '',
        UNIQUE(fuel_day_id,driver_id),UNIQUE(fuel_day_id,plate))`,
    ],
  ],
  [
    11,
    [
      `CREATE TABLE IF NOT EXISTS notification_deliveries(
        id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_id TEXT NOT NULL,channel TEXT NOT NULL,status TEXT NOT NULL,sent_at TEXT NOT NULL,
        UNIQUE(user_id,source_id,channel))`,
      'CREATE INDEX IF NOT EXISTS notification_delivery_user ON notification_deliveries(user_id,sent_at)',
    ],
  ],
];

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(schemaSql);
  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  if (!userColumns.some((c) => c.name === 'google_id')) {
    db.exec('ALTER TABLE users ADD COLUMN google_id TEXT;');
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;',
    );
  }
  for (const [version, statements] of migrations)
    if (!db.prepare('SELECT 1 FROM schema_versions WHERE version=?').get(version)) {
      for (const sql of statements) db.exec(sql);
      db.prepare('INSERT INTO schema_versions(version) VALUES(?)').run(version);
    }
  return db;
}

export async function transaction(db, fn) {
  if (db.withTransaction) return db.withTransaction(fn);
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = await fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
