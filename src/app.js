import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { migrate, createSeedUser } from './db.js';
import { applySession } from './auth.js';
import { applyHelmet, csrfProtection, apiLimiter } from './security.js';
import publicRoutes from './routes/api-public.js';
import authRoutes from './routes/api-auth.js';
import adminRoutes from './routes/api-admin.js';
import { backupDb } from './blobstore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = config.root;
const publicDir = path.join(root, 'public');

migrate();
createSeedUser();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

applyHelmet(app);
app.use(cookieParser());
app.use(express.json({ limit: config.security.maxPayloadBytes }));
applySession(app);
app.use(csrfProtection);

// Health check (must be registered before the 404 handler)
app.get('/api/health', (req, res) => res.json({ ok: true, env: config.env }));

// CSRF cookie priming — static pages on Vercel don't pass through Express,
// so the client calls this on load to ensure the csrf cookie exists.
app.get('/api/csrf', (req, res) => res.json({ ok: true, csrf: req.csrfToken || null }));

// Static assets with modest caching
app.use(
  '/assets',
  express.static(path.join(publicDir, 'assets'), {
    maxAge: config.env === 'production' ? '1h' : 0,
    immutable: false,
  })
);

// Persist the DB back to Vercel Blob after any data-modifying request.
// Fire-and-forget so it never blocks the response. No-op outside Vercel.
app.use((req, res, next) => {
  res.on('finish', () => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      backupDb();
    }
  });
  next();
});

// API routes
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Client routes
const adminPages = {
  '/admin/login': 'admin/login.html',
  '/admin': 'admin/dashboard.html',
  '/admin/applications': 'admin/applications.html',
  '/admin/applications/new': 'admin/applications.html',
};

for (const [route, file] of Object.entries(adminPages)) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(publicDir, file));
  });
}

app.get('/admin/applications/:id', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin/application.html'));
});

// Public form + success
app.get(['/', '/apply', '/success'], (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 404 for unknown paths
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

// Central error handler — never leak stack traces.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.path}:`, err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error.' });
});

export { app };
export default app;