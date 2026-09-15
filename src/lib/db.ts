import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

export const DEFAULT_LOG_ROOT = "C:\\MyHolidays\\XMLLogs";

const DB_FILE =
  process.env.LOGTRAIL_DB_PATH ?? path.join(process.cwd(), "data", "logtrail.db");

let instance: Database.Database | null = null;

function migrate(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'viewer',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      user_agent TEXT,
      ip         TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS saved_searches (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      query      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      level        TEXT NOT NULL DEFAULT 'ERROR',
      contains     TEXT,
      threshold    INTEGER NOT NULL DEFAULT 1,
      window_mins  INTEGER NOT NULL DEFAULT 60,
      enabled      INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      at         TEXT NOT NULL DEFAULT (datetime('now')),
      actor      TEXT,
      action     TEXT NOT NULL,
      detail     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC);
  `);
}

function seed(db: Database.Database) {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get() as {
    count: number;
  };

  if (count === 0) {
    const username = process.env.LOGTRAIL_ADMIN_USER ?? "admin";
    const email = process.env.LOGTRAIL_ADMIN_EMAIL ?? "admin@logtrail.local";
    const password = process.env.LOGTRAIL_ADMIN_PASSWORD ?? "Admin@12345";

    db.prepare(
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    ).run(username, email, bcrypt.hashSync(password, 12));

    db.prepare("INSERT INTO audit_log (actor, action, detail) VALUES (?, ?, ?)").run(
      "system",
      "seed.admin",
      `Created initial admin user "${username}"`,
    );
  }

  const defaults: Record<string, string> = {
    logRoot: process.env.LOGTRAIL_LOG_ROOT ?? DEFAULT_LOG_ROOT,
    filePatterns: ".xml,.log,.txt",
    maxDepth: "6",
    retentionDays: "90",
    refreshSeconds: "15",
    maxFilesPerScan: "500",
    timezone: "local",
  };

  const insert = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value, updated_by) VALUES (?, ?, 'system')",
  );
  for (const [key, value] of Object.entries(defaults)) insert.run(key, value);
}

export function getDb(): Database.Database {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const db = new Database(DB_FILE);
  migrate(db);
  seed(db);
  instance = db;
  return db;
}

export function audit(actor: string, action: string, detail?: string) {
  getDb()
    .prepare("INSERT INTO audit_log (actor, action, detail) VALUES (?, ?, ?)")
    .run(actor, action, detail ?? null);
}

export { DB_FILE };
