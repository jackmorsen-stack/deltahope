import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { restoreDb } from './blobstore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(config.dataDir, { recursive: true });

// On Vercel: pull the persisted DB from Blob before opening it.
await restoreDb();

const db = new Database(config.dbFile);
// WAL needs shared memory files; on serverless use the simplest journal.
db.pragma(config.onVercel ? 'journal_mode = DELETE' : 'journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','hr')),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applicants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  job TEXT,
  address TEXT,
  email TEXT,
  has_car INTEGER,
  id_number TEXT,
  mobile TEXT,
  marital_status TEXT,
  date_of_birth TEXT,
  faculty TEXT,
  graduation_year TEXT,
  grade TEXT,
  religion TEXT,
  nationality TEXT,
  home_tel TEXT,
  no_of_children TEXT,
  computer_skills TEXT,
  position_applying TEXT,
  salary_expected TEXT,
  available_start TEXT,
  last_salary TEXT,
  location_restriction INTEGER,
  declaration_signature TEXT,
  declaration_date TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','review','shortlisted','interview','rejected','hired','archived')),
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  course TEXT,
  qualification TEXT,
  certification_date TEXT
);

CREATE TABLE IF NOT EXISTS additional_training (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  training TEXT,
  certification_date TEXT
);

CREATE TABLE IF NOT EXISTS language_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  spoken TEXT,
  written TEXT,
  comprehension TEXT,
  reading TEXT,
  UNIQUE (applicant_id, language)
);

CREATE TABLE IF NOT EXISTS work_experience (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  company_name TEXT,
  joining_date TEXT,
  leaving_date TEXT,
  position TEXT,
  function TEXT,
  salary TEXT,
  reason_leaving TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id INTEGER,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_education_applicant ON education(applicant_id);
CREATE INDEX IF NOT EXISTS idx_training_applicant ON additional_training(applicant_id);
CREATE INDEX IF NOT EXISTS idx_lang_applicant ON language_skills(applicant_id);
CREATE INDEX IF NOT EXISTS idx_work_applicant ON work_experience(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applicants_submitted ON applicants(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_name ON applicants(name);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
`;

export function migrate() {
  db.exec(MIGRATIONS);
  db.prepare('INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)').run('schema_version', '1');
}

export const STATEMENTS = {
  applicants: {
    insert: `INSERT INTO applicants (
      ref_no, name, job, address, email, has_car, id_number, mobile, marital_status,
      date_of_birth, faculty, graduation_year, grade, religion, nationality, home_tel,
      no_of_children, computer_skills, position_applying, salary_expected, available_start,
      last_salary, location_restriction, declaration_signature, declaration_date, status
    ) VALUES (@ref_no, @name, @job, @address, @email, @has_car, @id_number, @mobile, @marital_status,
      @date_of_birth, @faculty, @graduation_year, @grade, @religion, @nationality, @home_tel,
      @no_of_children, @computer_skills, @position_applying, @salary_expected, @available_start,
      @last_salary, @location_restriction, @declaration_signature, @declaration_date, 'new')`,
  },
};

export function createSeedUser() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (existing > 0) return;
  const insert = db.prepare(
    'INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)'
  );
  const hash = bcrypt.hashSync('Admin@127', 12);
  insert.run('admin', hash, 'System Administrator', 'admin');
  const hrHash = bcrypt.hashSync('HR@127', 12);
  insert.run('hr', hrHash, 'HR Officer', 'hr');
  console.log('[seed] Created default users: admin / Admin@127, hr / HR@127');
}

// Allow `node src/db.js --reset` to rebuild a clean database.
const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect && process.argv.includes('--reset')) {
  db.close();
  fs.rmSync(config.dbFile, { force: true });
  fs.rmSync(config.dbFile + '-wal', { force: true });
  fs.rmSync(config.dbFile + '-shm', { force: true });
  const fresh = new Database(config.dbFile);
  fresh.pragma('foreign_keys = ON');
  fresh.exec(MIGRATIONS);
  fresh.prepare('INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)').run('schema_version', '1');
  const insert = fresh.prepare(
    'INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)'
  );
  insert.run('admin', bcrypt.hashSync('Admin@127', 12), 'System Administrator', 'admin');
  insert.run('hr', bcrypt.hashSync('HR@127', 12), 'HR Officer', 'hr');
  fresh.close();
  console.log('[reset] Database rebuilt and re-seeded.');
}

export { db };
export default db;