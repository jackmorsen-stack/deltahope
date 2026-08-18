import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { normalizeApplication, toRows } from '../validation.js';
import { publicSubmitLimiter, asyncHandler } from '../security.js';
import { exportAndNotify } from '../notify.js';

const router = Router();

function nextRefNo() {
  const year = new Date().getFullYear();
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM applicants WHERE substr(ref_no, 5, 4) = ?")
    .get(String(year));
  const seq = (row?.c || 0) + 1;
  return `${config.refPrefix}-${year}-${String(seq).padStart(6, '0')}`;
}

function insertApplication(refNo, rows) {
  return db.transaction((ref, data) => {
    const a = data.applicant;
    const info = db
      .prepare(
        `INSERT INTO applicants (
           ref_no, name, job, address, email, has_car, id_number, mobile, marital_status,
           date_of_birth, faculty, graduation_year, grade, religion, nationality, home_tel,
           no_of_children, computer_skills, position_applying, salary_expected, available_start,
           last_salary, location_restriction, declaration_signature, declaration_date
         ) VALUES (
           @ref_no, @name, @job, @address, @email, @has_car, @id_number, @mobile, @marital_status,
           @date_of_birth, @faculty, @graduation_year, @grade, @religion, @nationality, @home_tel,
           @no_of_children, @computer_skills, @position_applying, @salary_expected, @available_start,
           @last_salary, @location_restriction, @declaration_signature, @declaration_date
         )`
      )
      .run({ ref_no: ref, ...a });
    const applicantId = info.lastInsertRowid;

    const insEdu = db.prepare(
      'INSERT INTO education (applicant_id, course, qualification, certification_date) VALUES (?, ?, ?, ?)'
    );
    for (const e of data.education) insEdu.run(applicantId, e.course, e.qualification, e.certification_date);

    const insTrn = db.prepare(
      'INSERT INTO additional_training (applicant_id, training, certification_date) VALUES (?, ?, ?)'
    );
    for (const t of data.additional_training) insTrn.run(applicantId, t.training, t.certification_date);

    const insLang = db.prepare(
      'INSERT INTO language_skills (applicant_id, language, spoken, written, comprehension, reading) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const l of data.language_skills) {
      insLang.run(applicantId, l.language, l.spoken, l.written, l.comprehension, l.reading);
    }

    const insWork = db.prepare(
      'INSERT INTO work_experience (applicant_id, company_name, joining_date, leaving_date, position, function, salary, reason_leaving) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const w of data.work_experience) {
      insWork.run(applicantId, w.company_name, w.joining_date, w.leaving_date, w.position, w.function, w.salary, w.reason_leaving);
    }

    return applicantId;
  })(refNo, rows);
}

// Public: submit a completed Form 127 application.
router.post(
  '/applications',
  publicSubmitLimiter,
  asyncHandler(async (req, res) => {
    const parsed = normalizeApplication(req.body);
    if (!parsed.valid) {
      return res.status(422).json({ error: 'Validation failed.', errors: parsed.errors });
    }
    const rows = toRows(parsed.value);

    let applicantId;
    try {
      applicantId = insertApplication(nextRefNo(), rows);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // Retry once with a fresh sequence number.
        applicantId = insertApplication(nextRefNo(), rows);
      } else {
        throw err;
      }
    }

    const refNo = db.prepare('SELECT ref_no FROM applicants WHERE id = ?').get(applicantId).ref_no;
    // Async export + Telegram (fire-and-forget, never blocks the response)
    exportAndNotify(applicantId);
    res.status(201).json({ ok: true, ref_no: refNo });
  })
);

export default router;