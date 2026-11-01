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
    INSERT OR IGNORE INTO schema_versions(version) VALUES(1);
  `;

export const migrations = [
  [
    2,
    'INSERT OR IGNORE INTO user_settings(user_id,terms_accepted_at,onboarded_at) SELECT id,created_at,created_at FROM users',
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
  for (const [version, sql] of migrations)
    if (!db.prepare('SELECT 1 FROM schema_versions WHERE version=?').get(version)) {
      db.exec(sql);
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
