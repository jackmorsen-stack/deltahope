import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, asyncHandler, cleanStr, toBool, toInt } from '../security.js';
import { audit, listAuditLogs } from '../audit.js';
import { buildWorkbook } from '../export.js';

const router = Router();

const SORTABLE = new Set(['ref_no', 'name', 'job', 'email', 'mobile', 'graduation_year', 'status', 'submitted_at', 'id']);

const STATUSES = ['new', 'review', 'shortlisted', 'interview', 'rejected', 'hired', 'archived'];

function parseListQuery(q) {
  const search = cleanStr(q.search, 120);
  const status = STATUSES.includes(q.status) ? q.status : null;
  const page = Math.max(1, toInt(q.page, 1_000_000) || 1);
  const limit = Math.min(100, Math.max(5, toInt(q.limit, 100) || 20));
  const sort = SORTABLE.has(q.sort) ? q.sort : 'submitted_at';
  const dir = q.dir === 'asc' ? 'asc' : 'desc';
  return { search, status, page, limit, sort, dir };
}

function buildWhere({ search, status }) {
  const clauses = [];
  const params = {};
  if (search) {
    clauses.push('(name LIKE @s OR ref_no LIKE @s OR email LIKE @s OR mobile LIKE @s OR id_number LIKE @s)');
    params.s = `%${search}%`;
  }
  if (status) {
    clauses.push('status = @status');
    params.status = status;
  }
  return { where: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', params };
}

function getApplicantRows(id) {
  const applicant = db.prepare('SELECT * FROM applicants WHERE id = ?').get(id);
  if (!applicant) return null;
  applicant.education = db.prepare('SELECT * FROM education WHERE applicant_id = ? ORDER BY id').all(id);
  applicant.additional_training = db.prepare('SELECT * FROM additional_training WHERE applicant_id = ? ORDER BY id').all(id);
  applicant.language_skills = db.prepare('SELECT * FROM language_skills WHERE applicant_id = ? ORDER BY id').all(id);
  applicant.work_experience = db.prepare('SELECT * FROM work_experience WHERE applicant_id = ? ORDER BY id').all(id);
  return applicant;
}

// Overview stats
router.get('/stats', requireAuth(['admin', 'hr']), (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM applicants').get().c;
  const today = db.prepare("SELECT COUNT(*) AS c FROM applicants WHERE date(submitted_at) = date('now')").get().c;
  const month = db.prepare("SELECT COUNT(*) AS c FROM applicants WHERE strftime('%Y-%m', submitted_at) = strftime('%Y-%m', 'now')").get().c;
  const byStatus = db.prepare('SELECT status, COUNT(*) AS c FROM applicants GROUP BY status').all();
  const recent = db.prepare('SELECT ref_no, name, job, status, submitted_at FROM applicants ORDER BY submitted_at DESC, id DESC LIMIT 8').all();
  const activity = listAuditLogs({ limit: 10 }).rows;
  res.json({ total, today, month, byStatus, recent, activity });
});

// List with search / filter / sort / pagination
router.get('/applications', requireAuth(['admin', 'hr']), (req, res) => {
  const q = parseListQuery(req.query);
  const { where, params } = buildWhere(q);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM applicants ${where}`).get(params).c;
  const rows = db
    .prepare(`SELECT id, ref_no, name, job, position_applying, email, mobile, graduation_year, status, submitted_at FROM applicants ${where} ORDER BY ${q.sort} ${q.dir === 'desc' ? 'DESC' : 'ASC'} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: q.limit, offset: (q.page - 1) * q.limit });
  res.json({ total, page: q.page, limit: q.limit, sort: q.sort, dir: q.dir, rows });
});

// Excel export of current filter set (single + bulk share this route)
router.get('/applications/export', requireAuth(['admin', 'hr']), asyncHandler(async (req, res) => {
  const q = parseListQuery(req.query);
  const { where, params } = buildWhere(q);
  const ids = (Array.isArray(req.query.ids) ? req.query.ids : [])
    .map((v) => toInt(v))
    .filter((v) => v);
  let applicants;
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    applicants = db.prepare(`SELECT * FROM applicants WHERE id IN (${placeholders})`).all(...ids);
  } else {
    applicants = db.prepare(`SELECT * FROM applicants ${where} ORDER BY submitted_at DESC`).all(params);
  }
  if (!applicants.length) return res.status(404).json({ error: 'No applications to export.' });

  for (const a of applicants) {
    a.education = db.prepare('SELECT * FROM education WHERE applicant_id = ?').all(a.id);
    a.additional_training = db.prepare('SELECT * FROM additional_training WHERE applicant_id = ?').all(a.id);
    a.language_skills = db.prepare('SELECT * FROM language_skills WHERE applicant_id = ?').all(a.id);
    a.work_experience = db.prepare('SELECT * FROM work_experience WHERE applicant_id = ?').all(a.id);
  }

  const wb = await buildWorkbook(applicants);
  audit({ user: req.user, action: 'export', resource: 'applicant', details: { count: applicants.length, refs: applicants.map((a) => a.ref_no) }, ip: req.ip });

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="applications-${stamp}.xlsx"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  await wb.xlsx.write(res);
  res.end();
}));

// Single applicant (full profile)
router.get('/applications/:id', requireAuth(['admin', 'hr']), (req, res) => {
  const id = toInt(req.params.id);
  const applicant = id ? getApplicantRows(id) : null;
  if (!applicant) return res.status(404).json({ error: 'Application not found.' });
  audit({ user: req.user, action: 'view', resource: 'applicant', resourceId: id, ip: req.ip });
  res.json({ applicant });
});

// Update status
router.patch('/applications/:id/status', requireAuth(['admin', 'hr']), (req, res) => {
  const id = toInt(req.params.id);
  const status = STATUSES.includes(req.body?.status) ? req.body.status : null;
  if (!id || !status) return res.status(422).json({ error: 'Invalid status or id.' });
  const existing = db.prepare('SELECT ref_no FROM applicants WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Application not found.' });
  db.prepare("UPDATE applicants SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  audit({ user: req.user, action: 'status.update', resource: 'applicant', resourceId: id, details: { ref_no: existing.ref_no, status }, ip: req.ip });
  res.json({ ok: true });
});

// Edit core applicant fields (data-modifying admin action)
router.put('/applications/:id', requireAuth(['admin', 'hr']), (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(422).json({ error: 'Invalid id.' });
  const existing = getApplicantRows(id);
  if (!existing) return res.status(404).json({ error: 'Application not found.' });

  const b = req.body || {};
  const status = STATUSES.includes(b.status) ? b.status : existing.status;
  const fields = {
    name: cleanStr(b.name, 120) || existing.name,
    job: cleanStr(b.job, 120) ?? existing.job,
    email: cleanStr(b.email, 254) ?? existing.email,
    mobile: cleanStr(b.mobile, 40) ?? existing.mobile,
    position_applying: cleanStr(b.position_applying, 120) ?? existing.position_applying,
    status,
  };
  db.prepare(
    "UPDATE applicants SET name=@name, job=@job, email=@email, mobile=@mobile, position_applying=@position_applying, status=@status, updated_at=datetime('now') WHERE id=@id"
  ).run({ ...fields, id });
  audit({ user: req.user, action: 'update', resource: 'applicant', resourceId: id, details: { ref_no: existing.ref_no, fields: Object.keys(fields) }, ip: req.ip });
  res.json({ ok: true, applicant: getApplicantRows(id) });
});

// Delete
router.delete('/applications/:id', requireAuth(['admin']), (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(422).json({ error: 'Invalid id.' });
  const existing = db.prepare('SELECT ref_no FROM applicants WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Application not found.' });
  db.prepare('DELETE FROM applicants WHERE id = ?').run(id);
  audit({ user: req.user, action: 'delete', resource: 'applicant', resourceId: id, details: { ref_no: existing.ref_no }, ip: req.ip });
  res.json({ ok: true });
});

// Bulk actions: delete or status change on selected ids
router.post('/applications/bulk', requireAuth(['admin', 'hr']), (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
    .map((v) => toInt(v))
    .filter((v) => v);
  if (!ids.length) return res.status(422).json({ error: 'No applications selected.' });
  const mode = req.body?.mode;
  const status = STATUSES.includes(req.body?.status) ? req.body.status : null;

  db.transaction(() => {
    for (const id of ids) {
      const existing = db.prepare('SELECT ref_no FROM applicants WHERE id = ?').get(id);
      if (!existing) continue;
      if (mode === 'delete') {
        db.prepare('DELETE FROM applicants WHERE id = ?').run(id);
        audit({ user: req.user, action: 'bulk.delete', resource: 'applicant', resourceId: id, details: { ref_no: existing.ref_no }, ip: req.ip });
      } else if (mode === 'status' && status) {
        db.prepare("UPDATE applicants SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
        audit({ user: req.user, action: 'bulk.status', resource: 'applicant', resourceId: id, details: { ref_no: existing.ref_no, status }, ip: req.ip });
      }
    }
  })();
  res.json({ ok: true });
});

// Audit log
router.get('/audit', requireAuth(['admin']), (req, res) => {
  const search = cleanStr(req.query.search, 120);
  const page = Math.max(1, toInt(req.query.page, 1_000_000) || 1);
  const limit = Math.min(100, Math.max(5, toInt(req.query.limit, 100) || 25));
  res.json(listAuditLogs({ search, page, limit }));
});

export default router;