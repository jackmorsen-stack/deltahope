/* Public application wizard — Employment Application System (Form 127) */
(function () {
  'use strict';

  const App = window.App;
  const $ = App.qs, $$ = App.qsa;
  const TOTAL_STEPS = 7;

  const DRAFT_KEY = 'ea.draft.v1';
  const SUBMITTED_KEY = 'ea.submitted.ref';

  const state = {
    step: 1,
    data: defaultData(),
  };

  function defaultData() {
    return {
      name: '', job: '', address: '', email: '', has_car: null,
      id_number: '', mobile: '', marital_status: '', date_of_birth: '',
      faculty: '', graduation_year: '', grade: '', religion: '', nationality: '',
      home_tel: '', no_of_children: '',
      education: [], additional_training: [], language_skills: [],
      work_experience: [], computer_skills: '',
      position_applying: '', salary_expected: '', available_start: '',
      last_salary: '', location_restriction: null,
      declaration_signature: '', declaration_date: '',
    };
  }

  /* ============ Init ============ */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    initLang();
    bindEvents();
    restoreDraft();
    setupSteps();
    renderLangTable();
    if (localStorage.getItem(SUBMITTED_KEY)) {
      const ref = localStorage.getItem(SUBMITTED_KEY);
      showSuccess(ref);
      return;
    }
    updateStartButtons();
  }

  /* ============ Language ============ */
  function initLang() {
    const lang = App.currentLang();
    $$('.lang-btn').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    applyLang(lang);
    document.addEventListener('langchange', () => updateStartButtons());
  }

  function applyLang(lang) {
    App.setLang(lang);
    $$('.lang-btn').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  }

  function bindEvents() {
    $$('.lang-btn').forEach((b) => {
      b.addEventListener('click', () => applyLang(b.dataset.lang));
    });

    $('#btn-start').addEventListener('click', () => showForm(1));
    $('#btn-resume').addEventListener('click', () => showForm(state.step));

    $('#btn-back').addEventListener('click', () => goStep(state.step - 1));
    $('#btn-next').addEventListener('click', () => goNext());
    $('#btn-again').addEventListener('click', () => {
      localStorage.removeItem(SUBMITTED_KEY);
      localStorage.removeItem(DRAFT_KEY);
      state.data = defaultData();
      $('#apply-form').reset();
      renderLangTable();
      renderRepeatables();
      updateReview();
      showForm(1);
    });

    $('#btn-add-course').addEventListener('click', () => { addRepeatable('education'); autosave(); });
    $('#btn-add-training').addEventListener('click', () => { addRepeatable('additional_training'); autosave(); });
    $('#btn-add-experience').addEventListener('click', () => { addRepeatable('work_experience'); autosave(); });

    $('#apply-form').addEventListener('input', (e) => {
      const el = e.target;
      if (el.closest('.repeat-item')) return; // handled by repeatable binding
      syncField(el);
      if (el.hasAttribute('data-required') || el.hasAttribute('data-email') || el.hasAttribute('data-date')) {
        validateField(el);
      }
      autosave();
    });
    $('#apply-form').addEventListener('change', (e) => {
      const el = e.target;
      if (el.type === 'radio') {
        el.closest('.radio-group').querySelectorAll('.radio-option').forEach((o) => o.classList.toggle('selected', o.contains(el) && el.checked));
        syncField(el);
        if (el.name === 'has_car' || el.name === 'location_restriction') autosave();
      }
      if (el.classList.contains('grade-input')) {
        syncGrade(el);
      }
    });

    // Real-time validation on blur
    $('#apply-form').addEventListener('focusout', (e) => {
      const el = e.target;
      if (el.hasAttribute('data-required') || el.hasAttribute('data-email') || el.hasAttribute('data-date')) {
        validateField(el);
      }
    });

    // Keyboard: left/right arrows navigate steps
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const inForm = !$('#view-form').hidden;
      if (!inForm) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goStep(state.step - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goStep(state.step + 1); }
    });
  }

  /* ============ Views ============ */
  function showView(name) {
    $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (name === 'form') updateStepper();
  }

  function showForm(step) {
    if (step < 1) return;
    showView('form');
    goStep(step);
  }

  function showSuccess(ref) {
    $('#ref-value').textContent = ref;
    $('#apply-form').reset();
    showView('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ============ Steps ============ */
  function setupSteps() {
    // Seed a blank repeatable row for each section so the UI isn't empty
    if (!state.data.education.length) addRepeatable('education', { blank: true });
    if (!state.data.additional_training.length) addRepeatable('additional_training', { blank: true });
    if (!state.data.work_experience.length) addRepeatable('work_experience', { blank: true });
  }

  function goStep(step) {
    if (step < 1) step = 1;
    if (step > TOTAL_STEPS) step = TOTAL_STEPS;
    state.step = step;

    $$('.step-panel').forEach((p) => { p.hidden = p.dataset.panel !== String(step); });

    const isReview = step === 7;
    const btnNext = $('#btn-next');
    const btnBack = $('#btn-back');
    btnBack.disabled = step === 1;

    if (isReview) {
      updateReview();
      btnNext.textContent = App.t('submit.application');
    } else {
      btnNext.textContent = App.t('next');
    }
    btnNext.classList.toggle('btn-success-mode', isReview);

    updateStepper();
    $('#apply-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function updateStepper() {
    const pct = Math.round(((state.step - 1) / (TOTAL_STEPS - 1)) * 100);
    $$('.step-item').forEach((item) => {
      const n = Number(item.dataset.step);
      item.classList.toggle('active', n === state.step);
      item.classList.toggle('done', n < state.step);
    });
    $('#progress-fill').style.width = pct + '%';
    const bar = $('.progress-track');
    bar.setAttribute('aria-valuenow', String(pct));
    $('#action-pct').textContent = pct + '%';
  }

  function goNext() {
    if (state.step === 7) {
      submitApplication();
      return;
    }
    if (validateStep(state.step)) {
      goStep(state.step + 1);
    } else {
      showErrors();
    }
  }

  function showErrors() {
    const summary = $('#error-summary');
    summary.hidden = false;
    const firstError = $('#apply-form').querySelector('.is-invalid');
    if (firstError) firstError.focus();
    summary.scrollIntoView({ block: 'center', behavior: 'smooth' });
    App.toast(App.t('errors.title'), 'error');
  }

  /* ============ Field sync ============ */
  function syncField(el) {
    const name = el.name;
    if (!name || !(name in state.data)) return;
    if (el.type === 'radio') {
      state.data[name] = el.checked ? (el.dataset.bool === '1' ? 1 : 0) : state.data[name];
    } else {
      state.data[name] = el.value;
    }
  }

  function syncGrade(input) {
    const langRow = input.closest('tr');
    const lang = langRow.dataset.lang;
    const grade = input.dataset.grade;
    langRow.querySelectorAll('.grade-btn').forEach((b) => b.classList.remove('selected'));
    langRow.querySelectorAll('.grade-btn').forEach((b) => {
      if (b.dataset.grade === grade) b.classList.add('selected');
    });
    let entry = state.data.language_skills.find((l) => l.language === lang);
    if (!entry) {
      entry = { language: lang, spoken: '', written: '', comprehension: '', reading: '' };
      state.data.language_skills.push(entry);
    }
    entry[grade] = input.checked ? input.value : '';
    autosave();
  }

  function renderLangTable() {
    $$('.lang-table tbody tr').forEach((row) => {
      const lang = row.dataset.lang;
      const entry = state.data.language_skills.find((l) => l.language === lang) || {};
      ['spoken', 'written', 'comprehension', 'reading'].forEach((grade) => {
        const td = row.querySelector(`td[data-grade="${grade}"]`);
        td.innerHTML = '';
        const box = document.createElement('div');
        box.className = 'grade-cell';
        ['A', 'B', 'C', 'D'].forEach((lvl) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'grade-btn' + (entry[grade] === lvl ? ' selected' : '');
          btn.dataset.grade = grade;
          btn.textContent = lvl;
          btn.setAttribute('aria-label', grade + ' ' + lvl);
          btn.setAttribute('aria-pressed', String(entry[grade] === lvl));
          btn.addEventListener('click', () => {
            const isOn = btn.classList.contains('selected');
            btn.classList.toggle('selected', !isOn);
            btn.setAttribute('aria-pressed', String(!isOn));
            const cell = row.querySelector(`td[data-grade="${grade}"]`);
            cell.querySelectorAll('.grade-btn').forEach((b) => {
              if (b !== btn) { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); }
            });
            let e = state.data.language_skills.find((l) => l.language === lang);
            if (!e) {
              e = { language: lang, spoken: '', written: '', comprehension: '', reading: '' };
              state.data.language_skills.push(e);
            }
            e[grade] = isOn ? '' : lvl;
            autosave();
          });
          box.appendChild(btn);
        });
        td.appendChild(box);
      });
    });
  }

  /* ============ Repeatables ============ */
  const REPEATABLE_FIELDS = {
    education: [
      { name: 'course', label: 'education.course', type: 'text', cls: '' },
      { name: 'qualification', label: 'education.qualification', type: 'text', cls: 'span-full' },
      { name: 'certification_date', label: 'education.date', type: 'date', cls: 'ltr' },
    ],
    additional_training: [
      { name: 'training', label: 'training.name', type: 'text', cls: 'span-full' },
      { name: 'certification_date', label: 'training.date', type: 'date', cls: 'ltr' },
    ],
    work_experience: [
      { name: 'company_name', label: 'experience.company', type: 'text', cls: '' },
      { name: 'position', label: 'experience.position', type: 'text', cls: '' },
      { name: 'joining_date', label: 'experience.joining', type: 'date', cls: 'ltr' },
      { name: 'leaving_date', label: 'experience.leaving', type: 'date', cls: 'ltr' },
      { name: 'function', label: 'experience.function', type: 'textarea', cls: 'span-full' },
      { name: 'salary', label: 'experience.salary', type: 'text', cls: 'ltr' },
      { name: 'reason_leaving', label: 'experience.reason', type: 'text', cls: 'span-full' },
    ],
  };

  const LIST_ID = { education: 'education-list', additional_training: 'training-list', work_experience: 'experience-list' };

  function addRepeatable(type, opts) {
    const blank = opts && opts.blank;
    if (!blank) {
      state.data[type].push({});
    }
    renderRepeatables(type);
  }

  function renderRepeatables(onlyType) {
    const types = onlyType ? [onlyType] : Object.keys(LIST_ID);
    types.forEach((type) => {
      const list = $('#' + LIST_ID[type]);
      list.innerHTML = '';
      state.data[type].forEach((item, idx) => {
        list.appendChild(buildRepeatItem(type, item, idx));
      });
    });
  }

  function buildRepeatItem(type, item, idx) {
    const card = document.createElement('div');
    card.className = 'repeat-item';

    const fields = REPEATABLE_FIELDS[type];
    const grid = document.createElement('div');
    grid.className = 'form-grid';

    fields.forEach((f) => {
      const wrap = document.createElement('div');
      wrap.className = 'field' + (f.cls === 'span-full' ? ' span-full' : '');
      const label = document.createElement('label');
      label.className = 'field-label';
      label.htmlFor = `${type}-${idx}-${f.name}`;
      label.textContent = App.t(f.label);
      const value = item[f.name] || '';
      let input;
      if (f.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else {
        input = document.createElement('input');
        input.type = f.type;
      }
      input.name = `${type}.${idx}.${f.name}`;
      input.id = `${type}-${idx}-${f.name}`;
      input.value = value;
      if (f.cls.includes('ltr')) input.classList.add('ltr');
      input.addEventListener('input', () => {
        state.data[type][idx][f.name] = input.value;
        autosave();
      });
      const err = document.createElement('p');
      err.className = 'field-error';
      err.dataset.for = `${type}.${idx}.${f.name}`;
      err.hidden = true;
      wrap.appendChild(label);
      wrap.appendChild(input);
      wrap.appendChild(err);
      grid.appendChild(wrap);
    });

    card.appendChild(grid);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-ghost btn-sm repeat-item-remove';
    rm.innerHTML = '✕ ' + App.t('remove');
    rm.setAttribute('aria-label', App.t('remove'));
    rm.addEventListener('click', () => {
      state.data[type].splice(idx, 1);
      if (!state.data[type].length) addRepeatable(type, { blank: true });
      renderRepeatables(type);
      autosave();
    });
    card.appendChild(rm);

    return card;
  }

  /* ============ Validation ============ */
  function validateField(el) {
    const name = el.name;
    const errEl = $(`[data-for="${name}"]`);
    const ok = { value: true, msg: '' };

    if (el.hasAttribute('data-required')) {
      const v = el.type === 'checkbox' ? el.checked : el.value.trim();
      if (!v) { ok.value = false; ok.msg = App.t('required'); }
    }
    if (ok.value && el.hasAttribute('data-email') && el.value.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) { ok.value = false; ok.msg = App.t('invalid.email'); }
    }
    if (ok.value && el.hasAttribute('data-date') && el.value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(el.value)) { ok.value = false; ok.msg = App.t('invalid.date'); }
    }

    el.classList.toggle('is-invalid', !ok.value);
    if (ok.value) el.classList.remove('is-valid');
    else el.classList.add('is-invalid');
    if (errEl) {
      errEl.textContent = ok.msg;
      errEl.hidden = ok.value;
    }
    return ok.value;
  }

  function validateStep(step) {
    let valid = true;
    const panel = $(`.step-panel[data-panel="${step}"]`);
    if (step === 1) {
      ['name', 'id_number', 'mobile', 'email', 'date_of_birth', 'nationality'].forEach((name) => {
        const el = panel.querySelector(`[name="${name}"]`);
        if (el && !validateField(el)) valid = false;
      });
    } else if (step === 2) {
      // Education / training / optional — skip if blank rows
      valid = true;
    } else if (step === 3) {
      // Optional; if any grade partially filled, fine
      valid = true;
    } else if (step === 4) {
      valid = true;
    } else if (step === 5) {
      valid = true;
    } else if (step === 6) {
      ['position_applying', 'declaration_signature'].forEach((name) => {
        const el = panel.querySelector(`[name="${name}"]`);
        if (el && !validateField(el)) valid = false;
      });
    }
    return valid;
  }

  /* ============ Review ============ */
  function reviewRow(labelKey, value) {
    const shown = (value === null || value === undefined || value === '') ? '' : value;
    const item = document.createElement('div');
    item.className = 'review-item';
    const l = document.createElement('div');
    l.className = 'review-label';
    l.textContent = App.t(labelKey);
    const v = document.createElement('div');
    v.className = 'review-value' + (shown === '' ? ' empty' : '');
    v.textContent = shown === '' ? App.t('not.provided') : shown;
    item.appendChild(l);
    item.appendChild(v);
    return item;
  }

  function reviewBool(v) {
    if (v === 1 || v === true) return App.t('yes');
    if (v === 0 || v === false) return App.t('no');
    return '';
  }

  function buildReviewSection(titleKey, editStep, grid, rows) {
    const sec = document.createElement('section');
    sec.className = 'review-section';

    const head = document.createElement('div');
    head.className = 'review-section-head';
    const h = document.createElement('h3');
    h.textContent = App.t(titleKey);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn-outline btn-sm';
    edit.textContent = App.t('edit');
    edit.addEventListener('click', () => goStep(editStep));
    head.appendChild(h);
    head.appendChild(edit);
    sec.appendChild(head);

    const body = document.createElement('div');
    body.className = 'review-section-body';
    body.appendChild(rows);
    sec.appendChild(body);
    return sec;
  }

  function reviewSubblocks(titleKey, items, labelKeyFn) {
    const box = document.createElement('div');
    if (!items.length) {
      box.appendChild(reviewRow(titleKey, ''));
      return box;
    }
    items.forEach((item, idx) => {
      const sub = document.createElement('div');
      sub.className = 'review-subblock';
      sub.appendChild(reviewRow(titleKey + '.n', '#' + (idx + 1)));
      labelKeyFn(sub, item);
      box.appendChild(sub);
    });
    return box;
  }

  function updateReview() {
    const body = $('#review-body');
    body.innerHTML = '';
    const d = state.data;

    /* Personal */
    const grid = document.createElement('div');
    grid.className = 'review-grid cols-2';
    grid.appendChild(reviewRow('field.name', d.name));
    grid.appendChild(reviewRow('field.job', d.job));
    grid.appendChild(reviewRow('field.id', d.id_number));
    grid.appendChild(reviewRow('field.mobile', d.mobile));
    grid.appendChild(reviewRow('field.email', d.email));
    grid.appendChild(reviewRow('field.dob', App.formatDate(d.date_of_birth)));
    grid.appendChild(reviewRow('field.nationality', d.nationality));
    grid.appendChild(reviewRow('field.marital', d.marital_status));
    grid.appendChild(reviewRow('field.address', d.address));
    grid.appendChild(reviewRow('field.faculty', d.faculty));
    grid.appendChild(reviewRow('field.graduation', d.graduation_year));
    grid.appendChild(reviewRow('field.grade', d.grade));
    grid.appendChild(reviewRow('field.religion', d.religion));
    grid.appendChild(reviewRow('field.home_tel', d.home_tel));
    grid.appendChild(reviewRow('field.children', d.no_of_children));
    grid.appendChild(reviewRow('field.car', reviewBool(d.has_car)));
    body.appendChild(buildReviewSection('review.personal', 1, grid));

    /* Education */
    if (d.education.length) {
      const edu = document.createElement('div');
      edu.className = 'review-grid';
      d.education.forEach((e, i) => {
        const sub = document.createElement('div');
        sub.className = 'review-subblock';
        sub.appendChild(reviewRow('education.course', e.course));
        sub.appendChild(reviewRow('education.qualification', e.qualification));
        sub.appendChild(reviewRow('education.date', App.formatDate(e.certification_date)));
        edu.appendChild(sub);
      });
      body.appendChild(buildReviewSection('review.education', 2, edu));
    }

    /* Training */
    if (d.additional_training.length) {
      const trn = document.createElement('div');
      trn.className = 'review-grid';
      d.additional_training.forEach((t, i) => {
        const sub = document.createElement('div');
        sub.className = 'review-subblock';
        sub.appendChild(reviewRow('training.name', t.training));
        sub.appendChild(reviewRow('training.date', App.formatDate(t.certification_date)));
        trn.appendChild(sub);
      });
      body.appendChild(buildReviewSection('review.training', 2, trn));
    }

    /* Languages */
    const langs = document.createElement('div');
    langs.className = 'review-grid cols-2';
    d.language_skills.forEach((l) => {
      langs.appendChild(reviewRow('language.' + l.language, [
        l.spoken && 'Spoken: ' + l.spoken,
        l.written && 'Written: ' + l.written,
        l.comprehension && 'Comprehension: ' + l.comprehension,
        l.reading && 'Reading: ' + l.reading,
      ].filter(Boolean).join(' · ') || ''));
    });
    body.appendChild(buildReviewSection('review.languages', 3, langs));

    /* Experience */
    if (d.work_experience.length) {
      const exp = document.createElement('div');
      exp.className = 'review-grid';
      d.work_experience.forEach((w, i) => {
        const sub = document.createElement('div');
        sub.className = 'review-subblock';
        sub.appendChild(reviewRow('experience.company', w.company_name));
        sub.appendChild(reviewRow('experience.position', w.position));
        sub.appendChild(reviewRow('experience.joining', App.formatDate(w.joining_date)));
        sub.appendChild(reviewRow('experience.leaving', App.formatDate(w.leaving_date)));
        sub.appendChild(reviewRow('experience.function', w.function));
        sub.appendChild(reviewRow('experience.salary', w.salary));
        sub.appendChild(reviewRow('experience.reason', w.reason_leaving));
        exp.appendChild(sub);
      });
      body.appendChild(buildReviewSection('review.experience', 4, exp));
    }

    /* Skills */
    const skillGrid = document.createElement('div');
    skillGrid.className = 'review-grid';
    skillGrid.appendChild(reviewRow('skills.computer', d.computer_skills));
    body.appendChild(buildReviewSection('review.skills', 5, skillGrid));

    /* General */
    const gen = document.createElement('div');
    gen.className = 'review-grid cols-2';
    gen.appendChild(reviewRow('general.position', d.position_applying));
    gen.appendChild(reviewRow('general.salary', d.salary_expected));
    gen.appendChild(reviewRow('general.available', d.available_start));
    gen.appendChild(reviewRow('general.last_salary', d.last_salary));
    gen.appendChild(reviewRow('general.location', reviewBool(d.location_restriction)));
    gen.appendChild(reviewRow('field.signature', d.declaration_signature));
    gen.appendChild(reviewRow('field.date', App.formatDate(d.declaration_date)));
    body.appendChild(buildReviewSection('review.general', 6, gen));
  }

  /* ============ Autosave ============ */
  let saveTimer;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state.data));
      } catch (_) { /* storage may be unavailable */ }
    }, 400);
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      state.data = Object.assign(defaultData(), d);
      $('#apply-form').reset();
      Object.keys(state.data).forEach((key) => {
        const el = $(`[name="${key}"]`);
        if (el && typeof state.data[key] === 'string') {
          if (el.type === 'radio') {
            const boolVal = state.data[key];
            const target = document.querySelector(`input[name="${key}"][data-bool="${boolVal}"]`);
            if (target) target.checked = true;
          } else {
            el.value = state.data[key];
          }
        }
      });
      renderRepeatables();
      renderLangTable();
    } catch (_) { /* ignore corrupt draft */ }
  }

  function updateStartButtons() {
    const hasDraft = !!localStorage.getItem(DRAFT_KEY);
    $('#btn-resume').style.display = hasDraft ? 'inline-flex' : 'none';
  }

  /* ============ Submission ============ */
  async function submitApplication() {
    // Final validation on required step 1 & 6 fields
    let ok = true;
    ['name', 'id_number', 'mobile', 'email', 'date_of_birth', 'nationality', 'position_applying', 'declaration_signature'].forEach((name) => {
      const el = $(`[name="${name}"]`);
      if (el && !validateField(el)) ok = false;
    });
    if (!ok) { showErrors(); goStep(state.step); return; }

    const btn = $('#btn-next');
    const original = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> ' + App.t('submitting');

    // Prepare payload — clean empty rows
    const payload = buildPayload();

    try {
      const res = await App.post('/api/applications', payload);
      localStorage.removeItem(DRAFT_KEY);
      localStorage.setItem(SUBMITTED_KEY, res.ref_no);
      showSuccess(res.ref_no);
    } catch (err) {
      App.toast(App.t('submit.error'), 'error');
      console.error('submit failed', err);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  function buildPayload() {
    const d = state.data;
    return {
      name: d.name, job: d.job, address: d.address, email: d.email,
      has_car: d.has_car === 1 ? true : false,
      id_number: d.id_number, mobile: d.mobile, marital_status: d.marital_status,
      date_of_birth: d.date_of_birth, faculty: d.faculty, graduation_year: d.graduation_year,
      grade: d.grade, religion: d.religion, nationality: d.nationality,
      home_tel: d.home_tel, no_of_children: d.no_of_children,
      education: d.education.filter((e) => e.course || e.qualification || e.certification_date),
      additional_training: d.additional_training.filter((t) => t.training || t.certification_date),
      language_skills: d.language_skills.filter((l) => l.spoken || l.written || l.comprehension || l.reading),
      work_experience: d.work_experience.filter((w) => w.company_name || w.position || w.joining_date || w.leaving_date || w.function || w.salary || w.reason_leaving),
      computer_skills: d.computer_skills,
      position_applying: d.position_applying, salary_expected: d.salary_expected,
      available_start: d.available_start, last_salary: d.last_salary,
      location_restriction: d.location_restriction === 1 ? true : false,
      declaration_signature: d.declaration_signature, declaration_date: d.declaration_date,
    };
  }
})();