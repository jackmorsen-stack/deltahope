/* Admin applications table — search, filter, sort, pagination, bulk, export */
(function () {
  'use strict';
  const App = window.App, Admin = window.Admin;

  const query = {
    search: '', status: '', page: 1, limit: 20,
    sort: 'submitted_at', dir: 'desc',
  };
  const selected = new Set();

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await Admin.requireAuth();
    if (!user) return;
    Admin.buildShell();
    document.querySelector('[data-page-title]').textContent = 'Applications';

    const content = document.getElementById('admin-content');
    content.innerHTML = buildToolbar();
    content.innerHTML += '<div class="bulk-bar" id="bulk-bar" hidden></div><div id="table-region"></div>';

    bindToolbar(content);
    await load();
  });

  function buildToolbar() {
    const opts = '<option value="">All statuses</option>' + Admin.STATUSES.map((s) => `<option value="${s}">${Admin.STATUS_LABELS[s]}</option>`).join('');
    return `
      <div class="toolbar">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="search" id="q-search" placeholder="Search name, reference, email, phone, ID…" value="${App.escapeHtml(query.search)}" aria-label="Search applications">
        </div>
        <div class="select-box">
          <select id="q-status" aria-label="Filter by status">${opts}</select>
        </div>
        <div class="select-box">
          <select id="q-limit" aria-label="Rows per page">
            <option value="10">10 / page</option>
            <option value="20" selected>20 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-outline" id="btn-export">Export XLSX</button>
      </div>`;
  }

  function bindToolbar(content) {
    const searchInput = content.querySelector('#q-search');
    const statusSel = content.querySelector('#q-status');
    const limitSel = content.querySelector('#q-limit');

    searchInput.addEventListener('input', App.debounce(() => {
      query.search = searchInput.value.trim();
      query.page = 1;
      load();
    }, 350));

    statusSel.addEventListener('change', () => { query.status = statusSel.value; query.page = 1; load(); });
    limitSel.addEventListener('change', () => { query.limit = Number(limitSel.value); query.page = 1; load(); });

    content.querySelector('#btn-export').addEventListener('click', () => {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.status) params.set('status', query.status);
      if (selected.size) {
        selected.forEach((id) => params.append('ids', id));
      }
      window.location.href = '/api/admin/applications/export?' + params.toString();
    });
  }

  async function load() {
    const region = document.getElementById('table-region');
    region.innerHTML = '<div class="panel"><div class="panel-body" style="text-align:center;padding:48px"><span class="spinner"></span></div></div>';
    try {
      const params = new URLSearchParams({
        search: query.search, status: query.status,
        page: query.page, limit: query.limit,
        sort: query.sort, dir: query.dir,
      });
      const res = await App.get('/api/admin/applications?' + params.toString());
      selected.clear();
      renderTable(region, res);
      renderBulk();
    } catch (err) {
      region.innerHTML = '<div class="empty-state"><p>' + App.escapeHtml(err.message || 'Could not load applications.') + '</p></div>';
    }
  }

  function sortable(name, label) {
    const arrow = query.sort === name ? (query.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th scope="col" class="sortable" data-sort="${name}">${label}<span class="sort-arrow">${arrow}</span></th>`;
  }

  function renderTable(region, res) {
    const rows = res.rows || [];
    const total = res.total || 0;
    const pages = Math.max(1, Math.ceil(total / res.limit));

    const head = `
      <thead>
        <tr>
          <th scope="col" style="width:36px"><input type="checkbox" id="sel-all" class="row-select" aria-label="Select all"></th>
          ${sortable('ref_no', 'Application No.')}
          ${sortable('name', 'Name')}
          ${sortable('job', 'Job')}
          <th scope="col">Contact</th>
          ${sortable('graduation_year', 'Graduation')}
          ${sortable('status', 'Status')}
          ${sortable('submitted_at', 'Submitted')}
          <th scope="col">Actions</th>
        </tr>
      </thead>`;

    const body = rows.length ? rows.map((r) => `
      <tr>
        <td><input type="checkbox" class="row-select row-check" data-id="${r.id}" aria-label="Select ${r.ref_no}"></td>
        <td class="cell-ref">${Admin.fmt(r.ref_no)}</td>
        <td class="cell-name">${Admin.fmt(r.name)}</td>
        <td>${Admin.fmt(r.job)}</td>
        <td>${Admin.fmt(r.email)}<br><span class="muted ltr">${Admin.fmt(r.mobile)}</span></td>
        <td class="mono">${Admin.fmt(r.graduation_year)}</td>
        <td>${Admin.statusBadge(r.status)}</td>
        <td class="mono">${Admin.fmtDate(r.submitted_at)}</td>
        <td>
          <div class="cell-actions">
            <a class="btn btn-outline btn-sm" href="/admin/applications/${r.id}">View</a>
          </div>
        </td>
      </tr>`).join('')
      : `<tr><td colspan="9"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M9 3h6v3h5v15H4V6h5V3zm4 2v1h-2V5h2z"/></svg>
        <h3>No applications found</h3><p>Try adjusting your search or filters.</p>
      </div></td></tr>`;

    const pageBtns = [];
    for (let p = 1; p <= pages; p++) {
      if (pages > 9 && p > 3 && p < pages - 2 && Math.abs(p - res.page) > 1) {
        if (pageBtns[pageBtns.length - 1] !== '…') pageBtns.push('…');
        continue;
      }
      pageBtns.push(`<button class="page-btn ${p === res.page ? 'active' : ''}" data-page="${p}" ${p === res.page ? 'aria-current="page"' : ''}>${p}</button>`);
    }

    region.innerHTML = `
      <div class="panel">
        <div class="table-wrap">
          <table class="data-table">
            ${head}
            <tbody>${body}</tbody>
          </table>
        </div>
        <div class="panel-body" style="border-top:1px solid var(--color-border)">
          <div class="pagination">
            <span class="muted">Showing ${rows.length ? ((res.page - 1) * res.limit + 1) : 0}–${Math.min((res.page - 1) * res.limit + rows.length, total)} of ${total}</span>
            <div class="page-buttons">
              <button class="page-btn" data-page="${res.page - 1}" ${res.page <= 1 ? 'disabled' : ''}>‹</button>
              ${pageBtns.join('')}
              <button class="page-btn" data-page="${res.page + 1}" ${res.page >= pages ? 'disabled' : ''}>›</button>
            </div>
          </div>
        </div>
      </div>`;

    bindTable(region, res);
  }

  function bindTable(region, res) {
    region.querySelectorAll('.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const name = th.dataset.sort;
        if (query.sort === name) query.dir = query.dir === 'asc' ? 'desc' : 'asc';
        else { query.sort = name; query.dir = 'asc'; }
        query.page = 1;
        load();
      });
    });

    region.querySelectorAll('.page-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const p = Number(b.dataset.page);
        if (p >= 1 && p <= Math.ceil(res.total / res.limit)) {
          query.page = p;
          load();
        }
      });
    });

    const selAll = region.querySelector('#sel-all');
    if (selAll) {
      selAll.addEventListener('change', () => {
        const checks = region.querySelectorAll('.row-check');
        checks.forEach((c) => {
          c.checked = selAll.checked;
          if (selAll.checked) selected.add(c.dataset.id);
          else selected.delete(c.dataset.id);
        });
        renderBulk();
      });
    }

    region.querySelectorAll('.row-check').forEach((c) => {
      c.addEventListener('change', () => {
        if (c.checked) selected.add(c.dataset.id);
        else selected.delete(c.dataset.id);
        renderBulk();
      });
    });
  }

  function renderBulk() {
    const bar = document.getElementById('bulk-bar');
    const n = selected.size;
    if (!n) { bar.hidden = true; return; }

    const statusOpts = '<option value="">Set status…</option>' + Admin.STATUSES.map((s) => `<option value="${s}">${Admin.STATUS_LABELS[s]}</option>`).join('');

    bar.innerHTML = `
      <strong>${n} selected</strong>
      <select id="bulk-status" style="max-width:180px">${statusOpts}</select>
      <button class="btn btn-secondary btn-sm" id="bulk-apply">Apply</button>
      <span class="spacer"></span>
      <button class="btn btn-danger btn-sm" id="bulk-delete">Delete</button>
      <button class="btn btn-ghost btn-sm" id="bulk-clear">Clear</button>`;
    bar.hidden = false;

    const ids = Array.from(selected);
    bar.querySelector('#bulk-apply').addEventListener('click', async () => {
      const status = bar.querySelector('#bulk-status').value;
      if (!status) return App.toast('Select a status first.', 'error');
      try {
        await App.post('/api/admin/applications/bulk', { ids, mode: 'status', status });
        App.toast('Status updated.', 'success');
        await load();
      } catch (err) { App.toast(err.message, 'error'); }
    });

    bar.querySelector('#bulk-delete').addEventListener('click', () => {
      openConfirm('Delete ' + n + ' application(s)?', 'This action cannot be undone.', async () => {
        try {
          await App.post('/api/admin/applications/bulk', { ids, mode: 'delete' });
          App.toast('Applications deleted.', 'success');
          await load();
        } catch (err) { App.toast(err.message, 'error'); }
      });
    });

    bar.querySelector('#bulk-clear').addEventListener('click', () => { selected.clear(); renderBulk(); load(); });
  }

  /* Confirm modal */
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