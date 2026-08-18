import { db } from './db.js';
import { config } from './config.js';

/**
 * Write an audit log row. Best-effort: never throws into the request path.
 */
export function audit({ user, action, resource = null, resourceId = null, details = null, ip = null }) {
  if (!config.audit.enabled) return;
  try {
    db.prepare(
      `INSERT INTO audit_logs (user_id, username, action, resource, resource_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      user?.id ?? null,
      user?.username ?? null,
      action,
      resource,
      resourceId ?? null,
      details ? JSON.stringify(details) : null,
      ip ?? null
    );
  } catch {
    /* audit must never break a request */
  }
}

export function recentActivity(limit = 12) {
  return db
    .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(limit);
}

export function listAuditLogs({ search = '', page = 1, limit = 20 } = {}) {
  const where = search
    ? 'WHERE username LIKE ? OR action LIKE ? OR resource LIKE ? OR details LIKE ?'
    : '';
  const params = search
    ? Array(4).fill(`%${search}%`)
    : [];
  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_logs ${where}`).get(...params).c;
  const rows = db
    .prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);
  return { total, page, limit, rows };
}