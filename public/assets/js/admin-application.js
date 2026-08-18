/* Admin applicant profile — view, edit core fields, status, delete, export */
(function () {
  'use strict';
  const App = window.App, Admin = window.Admin;

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await Admin.requireAuth();
    if (!user) return;
    Admin.buildShell();
    document.querySelector('[data-page-title]').textContent = 'Application';

    const id = window.location.pathname.split('/').filter(Boolean).pop();
    const content = document.getElementById('admin-content');
    content.innerHTML = '<div class="panel"><div class="panel-body" style="text-align:center;padding:48px"><span class="spinner"></span></div></div>';

    try {
      const res = await App.get('/api/admin/applications/' + id);
      render(content, res.applicant, user);
    } catch (err) {
      content.innerHTML = '<div class="empty-state"><p>' + App.escapeHtml(err.message || 'Application not found.') + '</p></div>';
    }
  });

  function render(content, a, user) {
    const isAdmin = user.role === 'admin';

    content.innerHTML = `
      <div class="detail-head">
        <div class="detail-meta">
          <div class="detail-ref">${Admin.fmt(a.ref_no)}</div>
          <h1 class="detail-title">${Admin.fmt(a.name)}</h1>
          <div class="detail-sub">${Admin.fmt(a.job)} · submitted ${Admin.fmtDate(a.submitted_at)}</div>
        </div>
        <div class="status-pill">
          <label class="sr-only" for="status-select">Status</label>
          ${Admin.statusSelect('status', a.status, '')}
        </div>
        <button class="btn btn-outline" id="btn-toggle-edit">Edit</button>
        <button class="btn btn-outline" id="btn-export-one">Export</button>
        ${isAdmin ? '<button class="btn btn-danger" id="btn-delete">Delete</button>' : ''}
      </div>

      <div id="flash" class="error-summary" role="alert" hidden></div>

      <section class="panel" id="view-panel"></section>
      <section class="panel" id="edit-panel" style="display:none;margin-top:20px"></section>
    `;

    renderView(content, a);
    renderEdit(content, a);

    content.querySelector('#status-select').addEventListener('change', async (e) => {
      try {
        await App.patch('/api/admin/applications/' + a.id + '/status', { status: e.target.value });
        a.status = e.target.value;
        App.toast('Status updated to ' + Admin.STATUS_LABELS[a.status], 'success');
      } catch (err) { App.toast(err.message, 'error'); }
    });

    content.querySelector('#btn-toggle-edit').addEventListener('click', () => {
      const view = content.querySelector('#view-panel');
      const edit = content.querySelector('#edit-panel');
      const btn = content.querySelector('#btn-toggle-edit');
      const isOpen = edit.style.display !== 'none';
      edit.style.display = isOpen ? 'none' : 'block';
      btn.textContent = isOpen ? 'Edit' : 'Cancel';
      view.style.display = isOpen ? 'block' : 'none';
    });

    content.querySelector('#btn-export-one').addEventListener('click', () => {
      window.location.href = '/api/admin/applications/export?ids=' + a.id;
    });

    const delBtn = content.querySelector('#btn-delete');
    if (delBtn) delBtn.addEventListener('click', () => {
      openConfirm('Delete application ' + a.ref_no + '?', 'This action cannot be undone.', async () => {
        try {
          await App.del('/api/admin/applications/' + a.id);
          window.location.href = '/admin/applications';
        } catch (err) { App.toast(err.message, 'error'); }
      });
    });
  }

  function renderView(content, a) {
    const view = content.querySelector('#view-panel');
    const kv = (label, v, ltr) => `<div class="kv-item"><div class="kv-label">${Admin.fmt(label)}</div><div class="kv-value${ltr ? ' ltr' : ''}">${Admin.fmt(v) || '<span class="muted">—</span>'}</div></div>`;

    const personal = `
      <div class="kv-grid cols-3">
        ${kv('Full Name', a.name)}
        ${kv('Job', a.job)}
        ${kv('Address', a.address)}
        ${kv('Email', a.email, true)}
        ${kv('Car', Admin.yesNo(a.has_car))}
        ${kv('ID Number', a.id_number, true)}
        ${kv('Mobile', a.mobile, true)}
        ${kv('Marital Status', a.marital_status)}
        ${kv('Date of Birth', Admin.fmtDate(a.date_of_birth))}
        ${kv('Faculty', a.faculty)}
        ${kv('Graduation Year', a.graduation_year)}
        ${kv('Grade', a.grade)}
        ${kv('Religion', a.religion)}
        ${kv('Nationality', a.nationality)}
        ${kv('Home Tel.', a.home_tel, true)}
        ${kv('No. of Children', a.no_of_children)}
      </div>`;

    const education = (a.education || []).map((e) => `
      <div class="sub-entry">
        <div class="kv-grid cols-3">
          ${kv('Course', e.course)}
          ${kv('Qualification', e.qualification)}
          ${kv('Certification Date', Admin.fmtDate(e.certification_date))}
        </div>
      </div>`).join('') || '<div class="sub-entry muted">No education entries.</div>';

    const training = (a.additional_training || []).map((t) => `
      <div class="sub-entry">
        <div class="kv-grid cols-2">
          ${kv('Training / Study', t.training)}
          ${kv('Certification Date', Admin.fmtDate(t.certification_date))}
        </div>
      </div>`).join('') || '<div class="sub-entry muted">No training entries.</div>';

    const languages = (a.language_skills || []).map((l) => `
      <div class="sub-entry">
        <div class="kv-grid cols-4">
          ${kv('Language', l.language)}
          ${kv('Spoken', l.spoken)}
          ${kv('Written', l.written)}
          ${kv('Comprehension', l.comprehension)}
          ${kv('Reading', l.reading)}
        </div>
      </div>`).join('') || '<div class="sub-entry muted">No language skills.</div>';

    const experience = (a.work_experience || []).map((w) => `
      <div class="sub-entry">
        <div class="kv-grid cols-3">
          ${kv('Company', w.company_name)}
          ${kv('Position', w.position)}
          ${kv('Joining', Admin.fmtDate(w.joining_date))}
          ${kv('Leaving', Admin.fmtDate(w.leaving_date))}
          ${kv('Function', w.function)}
          ${kv('Salary', w.salary, true)}
          ${kv('Reason of Leaving', w.reason_leaving)}
        </div>
      </div>`).join('') || '<div class="sub-entry muted">No work experience.</div>';

    const general = `
      <div class="kv-grid cols-3">
        ${kv('Position Applying', a.position_applying)}
        ${kv('Expected Salary', a.salary_expected, true)}
        ${kv('Available to Start', a.available_start)}
        ${kv('Last Salary', a.last_salary, true)}
        ${kv('Location Restriction', Admin.yesNo(a.location_restriction))}
        ${kv('Declaration Signature', a.declaration_signature)}
        ${kv('Declaration Date', Admin.fmtDate(a.declaration_date))}
        ${kv('Computer Skills', a.computer_skills)}
      </div>`;

    view.innerHTML = `
      <div class="panel-head"><h2>Personal Information</h2></div>
      <div class="panel-body">${personal}</div>
      <div class="panel-head"><h2>Education</h2></div>
      <div class="panel-body sub-list">${education}</div>
      <div class="panel-head"><h2>Additional Studies / Training</h2></div>
      <div class="panel-body sub-list">${training}</div>
      <div class="panel-head"><h2>Language Skills</h2></div>
      <div class="panel-body sub-list">${languages}</div>
      <div class="panel-head"><h2>Work Experience</h2></div>
      <div class="panel-body sub-list">${experience}</div>
      <div class="panel-head"><h2>Computer Skills & Qualifications</h2></div>
      <div class="panel-body sub-list">${general}</div>`;
  }

  function renderEdit(content, a) {
    const edit = content.querySelector('#edit-panel');
    edit.innerHTML = `
      <div class="panel-head"><h2>Edit Core Fields</h2></div>
      <div class="panel-body">
        <form id="edit-form" class="form-grid cols-2" novalidate>
          <div class="field"><label class="field-label" for="e-name">Name</label><input id="e-name" name="name" value="${Admin.fmt(a.name)}"></div>
          <div class="field"><label class="field-label" for="e-job">Job</label><input id="e-job" name="job" value="${Admin.fmt(a.job)}"></div>
          <div class="field"><label class="field-label" for="e-email">Email</label><input id="e-email" name="email" type="email" class="ltr" value="${Admin.fmt(a.email)}"></div>
          <div class="field"><label class="field-label" for="e-mobile">Mobile</label><input id="e-mobile" name="mobile" class="ltr" value="${Admin.fmt(a.mobile)}"></div>
          <div class="field"><label class="field-label" for="e-position">Position Applying</label><input id="e-position" name="position_applying" value="${Admin.fmt(a.position_applying)}"></div>
          <div class="field"><label class="field-label" for="e-status">Status</label>${Admin.statusSelect('status', a.status)}</div>
          <div class="field" style="grid-column:1/-1">
            <button class="btn btn-primary" type="submit">Save Changes</button>
            <button class="btn btn-ghost" type="button" id="e-cancel">Cancel</button>
          </div>
        </form>
      </div>`;

    const form = edit.querySelector('#edit-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: form.elements.name.value.trim(),
        job: form.elements.job.value.trim(),
        email: form.elements.email.value.trim(),
        mobile: form.elements.mobile.value.trim(),
        position_applying: form.elements.position_applying.value.trim(),
        status: form.elements.status.value,
      };
      try {
        const res = await App.put('/api/admin/applications/' + a.id, payload);
        a = res.applicant;
        render(content, a, window.__ADMIN_USER__);
        App.toast('Changes saved.', 'success');
      } catch (err) { App.toast(err.message, 'error'); }
    });

    form.querySelector('#e-cancel').addEventListener('click', () => {
      content.querySelector('#view-panel').style.display = 'block';
      edit.style.display = 'none';
      content.querySelector('#btn-toggle-edit').textContent = 'Edit';
    });
  }

  function openConfirm(title, message, onOk) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="modal-head"><h3 id="confirm-title">${App.escapeHtml(title)}</h3></div>
        <div class="modal-body"><p class="muted">${App.escapeHtml(message)}</p></div>
        <div class="modal-foot">
          <button class="btn btn-ghost" data-act="cancel">Cancel</button>
          <button class="btn btn-danger" data-act="ok">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'cancel') close();
      if (act === 'ok') { close(); onOk(); }
    });
    backdrop.querySelector('[data-act="ok"]').focus();
  }
})();