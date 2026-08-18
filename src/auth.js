import session from 'express-session';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { config } from './config.js';
import { audit } from './audit.js';

const MemoryStore = session.MemoryStore;

export function applySession(app) {
  const store = new MemoryStore();
  const prune = () => {
    try {
      store.all?.((err, sessions) => {
        if (err || !sessions) return;
        const now = Date.now();
        for (const [sid, s] of Object.entries(sessions)) {
          if (s?.cookie?.expires && new Date(s.cookie.expires).getTime() < now) {
            store.destroy?.(sid, () => {});
          }
        }
      });
    } catch {
      /* best-effort prune */
    }
  };
  const timer = setInterval(prune, 15 * 60 * 1000);
  timer.unref?.();

  app.use(
    session({
      store,
      name: config.session.name,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: config.env === 'production',
        maxAge: config.session.ttlMs,
      },
    })
  );
}

export function verifyCredentials(username, password) {
  const row = db
    .prepare('SELECT * FROM users WHERE username = ? AND is_active = 1')
    .get(String(username || '').trim());
  if (!row) return null;
  if (!bcrypt.compareSync(String(password || ''), row.password_hash)) return null;
  return row;
}

export function touchLogin(userId) {
  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(userId);
}

export function buildSessionUser(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    is_active: row.is_active,
  };
}

export function login(req, res, next) {
  const { username, password } = req.body || {};
  const user = verifyCredentials(username, password);
  const ip = req.ip || null;
  if (!user) {
    audit({ action: 'login.failed', details: { username }, ip });
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  touchLogin(user.id);
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = buildSessionUser(user);
    audit({ user: req.session.user, action: 'login', ip });
    res.json({ user: req.session.user });
  });
}

export function logout(req, res) {
  const user = req.session?.user;
  audit({ user, action: 'logout', ip: req.ip });
  req.session.destroy(() => {
    res.clearCookie(config.session.name);
    res.json({ ok: true });
  });
}

export { config };