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
    INSERT OR IGNORE INTO schema_versions(version) VALUES(1);
  `;

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(schemaSql);
  const userColumns = db.prepare("PRAGMA table_info(users)").all();
  if (!userColumns.some(c => c.name === 'google_id')) {
    db.exec('ALTER TABLE users ADD COLUMN google_id TEXT;');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;');
  }
  return db;
}

export async function transaction(db, fn) {
  if (db.withTransaction) return db.withTransaction(fn);
  db.exec('BEGIN IMMEDIATE');
  try { const result = await fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
