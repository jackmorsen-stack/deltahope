import { cleanStr, cleanEmail, cleanLevel, cleanDate, toBool, toInt } from './security.js';

/**
 * Normalize and validate the applicant payload against the Form 127 data model.
 * Returns { value, errors }. `value` contains only safe, typed, trimmed fields.
 *
 * Content preservation: every original field is represented; no fields are
 * added or renamed. The PHOTO section is deliberately absent (only approved
 * removal).
 */

const LANGUAGES = ['english', 'french', 'other'];

function cleanRepeatable(rows, map) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      return map(r);
    })
    .filter(Boolean);
}

export function normalizeApplication(raw) {
  const b = raw || {};
  const errors = {};

  const person = {
    name: cleanStr(b.name, 120),
    job: cleanStr(b.job, 120),
    address: cleanStr(b.address, 500),
    email: cleanEmail(b.email),
    has_car: toBool(b.has_car),
    id_number: cleanStr(b.id_number, 40),
    mobile: cleanStr(b.mobile, 40),
    marital_status: cleanStr(b.marital_status, 60),
    date_of_birth: cleanDate(b.date_of_birth),
    faculty: cleanStr(b.faculty, 120),
    graduation_year: cleanStr(b.graduation_year, 20),
    grade: cleanStr(b.grade, 60),
    religion: cleanStr(b.religion, 60),
    nationality: cleanStr(b.nationality, 60),
    home_tel: cleanStr(b.home_tel, 40),
    no_of_children: cleanStr(b.no_of_children, 20),
  };

  // Required (source-of-truth minimums to keep the record useful).
  const required = ['name', 'id_number', 'mobile', 'email', 'date_of_birth', 'nationality'];
  for (const key of required) {
    if (!person[key]) errors[key] = 'required';
  }

  const education = cleanRepeatable(b.education, (r) => {
    const course = cleanStr(r.course, 200);
    const qualification = cleanStr(r.qualification, 500);
    const certification_date = cleanDate(r.certification_date);
    if (!course && !qualification && !certification_date) return null;
    return { course, qualification, certification_date };
  });

  const additional_training = cleanRepeatable(b.additional_training, (r) => {
    const training = cleanStr(r.training, 500);
    const certification_date = cleanDate(r.certification_date);
    if (!training && !certification_date) return null;
    return { training, certification_date };
  });

  // Language skills — only the three original languages; grading A/B/C/D preserved.
  const language_skills = cleanRepeatable(b.language_skills, (r) => {
    if (!r || !LANGUAGES.includes(r.language)) return null;
    return {
      language: r.language,
      spoken: cleanLevel(r.spoken),
      written: cleanLevel(r.written),
      comprehension: cleanLevel(r.comprehension),
      reading: cleanLevel(r.reading),
    };
  });

  const work_experience = cleanRepeatable(b.work_experience, (r) => {
    const company_name = cleanStr(r.company_name, 200);
    const joining_date = cleanDate(r.joining_date);
    const leaving_date = cleanDate(r.leaving_date);
    const position = cleanStr(r.position, 120);
    const function_ = cleanStr(r.function, 500);
    const salary = cleanStr(r.salary, 60);
    const reason_leaving = cleanStr(r.reason_leaving, 300);
    if (!company_name && !joining_date && !leaving_date && !position && !function_ && !salary && !reason_leaving) {
      return null;
    }
    return { company_name, joining_date, leaving_date, position, function: function_, salary, reason_leaving };
  });

  const computer_skills = cleanStr(b.computer_skills, 5000);

  const general = {
    position_applying: cleanStr(b.position_applying, 120),
    salary_expected: cleanStr(b.salary_expected, 60),
    available_start: cleanStr(b.available_start, 120),
    last_salary: cleanStr(b.last_salary, 60),
    location_restriction: toBool(b.location_restriction),
    declaration_signature: cleanStr(b.declaration_signature, 120),
    declaration_date: cleanDate(b.declaration_date),
  };

  if (!general.position_applying) errors.position_applying = 'required';
  if (!general.declaration_signature) errors.declaration_signature = 'required';

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    value: { person, education, additional_training, language_skills, work_experience, computer_skills, general },
  };
}

/**
 * Build the flat applicant row for INSERT plus the child rows.
 */
export function toRows(normalized) {
  const { person, general, education, additional_training, language_skills, work_experience, computer_skills } = normalized;
  return {
    applicant: {
      ...person,
      computer_skills,
      position_applying: general.position_applying,
      salary_expected: general.salary_expected,
      available_start: general.available_start,
      last_salary: general.last_salary,
      location_restriction: general.location_restriction,
      declaration_signature: general.declaration_signature,
      declaration_date: general.declaration_date,
    },
    education,
    additional_training,
    language_skills,
    work_experience,
  };
}

export function toIntSafe(v, max) {
  return toInt(v, max);
}