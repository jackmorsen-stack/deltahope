import crypto from 'node:crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';

export function applyHelmet(app) {
  // Production-grade security headers. CSP is intentionally restricted but keeps
  // Google Fonts and inline-styles working without weakening the rest.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'same-origin' },
    })
  );
}

function clientIp(req) {
  return req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
}

export const loginLimiter = rateLimit({
  windowMs: config.security.loginWindowMs,
  limit: config.security.loginMaxAttempts,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req) => clientIp(req),
  message: { error: 'Too many login attempts. Please try again later.' },
});

export const publicSubmitLimiter = rateLimit({
  windowMs: config.security.submitWindowMs,
  limit: config.security.submitMaxPerWindow,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req) => clientIp(req) + '|' + (req.headers['x-forwarded-for'] || ''),
  message: { error: 'Too many submissions. Please try again later.' },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.security.apiMaxPerMinute,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req) => clientIp(req),
  message: { error: 'Too many requests. Please slow down.' },
});

/**
 * Double-submit cookie CSRF protection.
 * - GET: issues a random token cookie (SameSite=Strict).
 * - Any mutating request must echo the token back via X-CSRF-Token header
 *   (or `_csrf` body field). The check is constant-time.
 */
export function csrfProtection(req, res, next) {
  const cookieToken = req.cookies?.[config.security.csrfCookie];
  if (!cookieToken) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie(config.security.csrfCookie, token, {
      httpOnly: false,
      sameSite: 'strict',
      secure: config.env === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
    req.csrfToken = token;
  } else {
    req.csrfToken = cookieToken;
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const sent =
      (req.headers['x-csrf-token'] || '').trim() ||
      (req.body && typeof req.body._csrf === 'string' ? req.body._csrf : '') ||
      '';
    const a = Buffer.from(String(sent));
    const b = Buffer.from(String(cookieToken));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
    }
  }
  next();
}

/**
 * Centralized server-side validation + sanitization helpers.
 */
export function toBool(v) {
  if (v === true || v === 1 || v === 'true' || v === '1' || v === 'yes' || v === 'on') return 1;
  if (v === false || v === 0 || v === 'false' || v === '0' || v === 'no' || v === 'off') return 0;
  return null;
}

export function cleanStr(v, max = 500) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s.slice(0, max) : null;
}

export function cleanEmail(v) {
  const s = cleanStr(v, 254);
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : null;
}

export function cleanLevel(v) {
  const s = cleanStr(v, 1);
  return s && /^[ABCD]$/.test(s) ? s : null;
}

export function cleanDate(v) {
  const s = cleanStr(v, 10);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function toInt(v, max = 1000000) {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return null;
  return Math.min(Math.max(n, 1), max);
}

export function requireAuth(roles = ['admin', 'hr']) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled.' });
    }
    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    req.user = user;
    next();
  };
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}