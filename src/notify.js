import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { config } from './config.js';
import { buildWorkbook } from './export.js';

const TELEGRAM_API = 'https://api.telegram.org/bot';

function getApplicantWithChildren(id) {
  const applicant = db.prepare('SELECT * FROM applicants WHERE id = ?').get(id);
  if (!applicant) return null;
  applicant.education = db.prepare('SELECT * FROM education WHERE applicant_id = ? ORDER BY id').all(id);
  applicant.additional_training = db.prepare('SELECT * FROM additional_training WHERE applicant_id = ? ORDER BY id').all(id);
  applicant.language_skills = db.prepare('SELECT * FROM language_skills WHERE applicant_id = ? ORDER BY id').all(id);
  applicant.work_experience = db.prepare('SELECT * FROM work_experience WHERE applicant_id = ? ORDER BY id').all(id);
  return applicant;
}

function buildSummary(applicant) {
  const name = applicant.name || '';
  const job = applicant.job || '';
  const ref = applicant.ref_no || '';
  const position = applicant.position_applying || '';
  const email = applicant.email || '';
  const mobile = applicant.mobile || '';
  return [
    `🆕 New application: ${name}`,
    `📋 Ref: ${ref}`,
    job ? `💼 Job: ${job}` : null,
    position ? `🎯 Position: ${position}` : null,
    email ? `✉️ Email: ${email}` : null,
    mobile ? `📱 Mobile: ${mobile}` : null,
  ].filter(Boolean).join('\n');
}

/**
 * Save the application as a standalone multi-sheet XLSX workbook
 * inside data/exports/<ref_no>/. Returns the absolute file path or null.
 */
export async function saveApplicationWorkbook(id) {
  const applicant = getApplicantWithChildren(id);
  if (!applicant) return null;

  const wb = await buildWorkbook([applicant]);
  const buffer = await wb.xlsx.writeBuffer();

  const folder = path.join(config.exportDir, applicant.ref_no);
  fs.mkdirSync(folder, { recursive: true });
  const filePath = path.join(folder, `${applicant.ref_no}.xlsx`);
  fs.writeFileSync(filePath, Buffer.from(buffer));
  return filePath;
}

/**
 * Send the workbook plus a short summary to Telegram.
 * Best-effort: never throws into the request path.
 */
export async function sendTelegram({ filePath, applicant }) {
  const token = config.telegram.botToken;
  const chatId = config.telegram.chatId;
  if (!token || !chatId) return { skipped: true };

  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', buildSummary(applicant));
    const bytes = fs.readFileSync(filePath);
    form.append(
      'document',
      new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      path.basename(filePath)
    );

    const res = await fetch(`${TELEGRAM_API}${token}/sendDocument`, { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok !== true) {
      console.error('[telegram] send failed:', res.status, JSON.stringify(body).slice(0, 300));
      return { skipped: true };
    }
    return { ok: true };
  } catch (err) {
    console.error('[telegram] send error:', err.message);
    return { skipped: true };
  }
}

/**
 * Full pipeline for a freshly submitted application:
 * 1) Write the workbook to data/exports/<ref_no>/<ref_no>.xlsx
 * 2) Send it to Telegram (if configured)
 * Fire-and-forget: failures are logged, never break submission.
 */
export async function exportAndNotify(id) {
  try {
    const applicant = getApplicantWithChildren(id);
    if (!applicant) return null;
    const filePath = await saveApplicationWorkbook(id);
    if (!filePath) return null;
    await sendTelegram({ filePath, applicant });
    return filePath;
  } catch (err) {
    console.error('[export] pipeline failed:', err.message);
    return null;
  }
}