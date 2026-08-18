import ExcelJS from 'exceljs';

/**
 * Build a production-grade XLSX workbook from a set of applicants.
 * Worksheets: Summary, Personal Information, Education, Additional Training,
 * Language Skills, Work Experience, General Information (+ Arabic summary tab).
 * Each sheet: frozen header row, auto-filter, styled header, auto column sizing.
 */

const HEADERS = {
  summary: ['Application No.', 'Name', 'Job', 'Position Applying', 'Email', 'Mobile', 'Status', 'Submitted'],
  personal: ['Application No.', 'Name', 'Job', 'Address', 'Email', 'Car', 'ID', 'Mobile', 'Marital Status', 'Date of Birth', 'Faculty', 'Graduation Year', 'Grade', 'Religion', 'Nationality', 'Home Tel', 'No. of Children'],
  education: ['Application No.', 'Course', 'Qualification / Certificate', 'Date of Certification'],
  training: ['Application No.', 'Training / Study', 'Date of Certification'],
  languages: ['Application No.', 'Language', 'Spoken', 'Written', 'Comprehension', 'Reading'],
  experience: ['Application No.', 'Company Name', 'Joining Date', 'Leaving Date', 'Position', 'Function', 'Salary', 'Reason of Leaving'],
  general: ['Application No.', 'Position Applying For', 'Total Salary Expected', 'Available to Start', 'Last Salary', 'Location Restriction', 'Computer Skills', 'Signature', 'Declaration Date'],
};

const arabicSummaryHeaders = ['رقم الطلب', 'الاسم', 'الوظيفة', 'الوظيفة المتقدم لها', 'البريد الإلكتروني', 'المحمول', 'الحالة', 'تاريخ التقديم'];

const STATUS_LABELS = {
  new: 'New',
  review: 'In Review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  rejected: 'Rejected',
  hired: 'Hired',
  archived: 'Archived',
};

function fmtDate(v) {
  return v ? String(v).slice(0, 10) : '';
}

function yesNo(v) {
  if (v === 1 || v === true || v === '1' || v === 'true') return 'Yes';
  if (v === 0 || v === false || v === '0' || v === 'false') return 'No';
  return '';
}

function buildSheet(wb, name, headers, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = headers.map((h) => ({ header: h, width: Math.max(12, h.length + 4) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A5C' } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 22;
  rows.forEach((r, i) => {
    const row = ws.addRow(r);
    if (i % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5F8' } };
    }
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(2, ws.rowCount), column: headers.length } };
  return ws;
}

export async function buildWorkbook(applicants) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Employment Application System';
  wb.created = new Date();

  const summaryRows = applicants.map((a) => [
    a.ref_no,
    a.name,
    a.job || '',
    a.position_applying || '',
    a.email || '',
    a.mobile || '',
    STATUS_LABELS[a.status] || a.status,
    fmtDate(a.submitted_at),
  ]);

  const sheets = [
    ['Summary', HEADERS.summary, summaryRows],
    ['Personal Information', HEADERS.personal, applicants.map((a) => [
      a.ref_no, a.name, a.job || '', a.address || '', a.email || '', yesNo(a.has_car),
      a.id_number || '', a.mobile || '', a.marital_status || '', fmtDate(a.date_of_birth),
      a.faculty || '', a.graduation_year || '', a.grade || '', a.religion || '',
      a.nationality || '', a.home_tel || '', a.no_of_children || '',
    ])],
    ['Education', HEADERS.education, applicants.flatMap((a) => (a.education || []).map((e) => [
      a.ref_no, e.course || '', e.qualification || '', fmtDate(e.certification_date),
    ]))],
    ['Additional Training', HEADERS.training, applicants.flatMap((a) => (a.additional_training || []).map((t) => [
      a.ref_no, t.training || '', fmtDate(t.certification_date),
    ]))],
    ['Language Skills', HEADERS.languages, applicants.flatMap((a) => (a.language_skills || []).map((l) => [
      a.ref_no, l.language, l.spoken || '', l.written || '', l.comprehension || '', l.reading || '',
    ]))],
    ['Work Experience', HEADERS.experience, applicants.flatMap((a) => (a.work_experience || []).map((w) => [
      a.ref_no, w.company_name || '', fmtDate(w.joining_date), fmtDate(w.leaving_date),
      w.position || '', w.function || '', w.salary || '', w.reason_leaving || '',
    ]))],
    ['General Information', HEADERS.general, applicants.map((a) => [
      a.ref_no, a.position_applying || '', a.salary_expected || '', a.available_start || '',
      a.last_salary || '', yesNo(a.location_restriction), a.computer_skills || '',
      a.declaration_signature || '', fmtDate(a.declaration_date),
    ])],
  ];

  for (const [name, headers, rows] of sheets) {
    buildSheet(wb, name, headers, rows);
  }

  // Bilingual tab — Arabic summary for RTL readers.
  const ar = wb.addWorksheet('القائمة العربية', { views: [{ state: 'frozen', ySplit: 1 }] });
  ar.columns = arabicSummaryHeaders.map((h) => ({ header: h, width: Math.max(12, h.length + 4) }));
  ar.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ar.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } };
  summaryRows.forEach((r) => ar.addRow(r));
  ar.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(2, ar.rowCount), column: arabicSummaryHeaders.length } };

  return wb;
}

export { HEADERS, arabicSummaryHeaders };