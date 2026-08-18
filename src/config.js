import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env if present (Node >= 20.12) — best-effort so dev setup stays simple.
const envFile = path.join(path.resolve(__dirname, '..'), '.env');
if (fs.existsSync(envFile)) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envFile);
    } else {
      const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch (err) {
    console.warn('[config] could not load .env:', err.message);
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  env: process.env.NODE_ENV || 'development',
  onVercel: !!process.env.VERCEL,
  // Absolute path of the project root (two levels up from src/)
  root: path.resolve(__dirname, '..'),
  // Serverless filesystems are read-only except /tmp — use it on Vercel.
  dataDir: process.env.VERCEL
    ? '/tmp'
    : path.join(path.resolve(__dirname, '..'), 'data'),
  dbFile: process.env.VERCEL
    ? '/tmp/applications.db'
    : path.join(path.resolve(__dirname, '..'), 'data', 'applications.db'),
  exportDir: process.env.VERCEL
    ? '/tmp/exports'
    : path.join(path.resolve(__dirname, '..'), 'data', 'exports'),
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  session: {
    secret: process.env.SESSION_SECRET || 'form127-employment-session-secret-change-me-in-production',
    name: 'ea.sid',
    ttlMs: 8 * 60 * 60 * 1000, // 8 hours
  },
  security: {
    passwordMinLength: 8,
    loginMaxAttempts: 8,
    loginWindowMs: 15 * 60 * 1000,
    submitMaxPerWindow: 6,
    submitWindowMs: 60 * 60 * 1000,
    apiMaxPerMinute: 240,
    csrfCookie: 'ea.csrf',
    maxPayloadBytes: '200kb',
  },
  // Reference number prefix, e.g. EMP-2026-000001
  refPrefix: process.env.REF_PREFIX || 'EMP',
  audit: {
    enabled: true,
  },
};

export default config;