/* Admin shared — auth guard, shell, common helpers */
(function () {
  'use strict';
  const App = window.App;

  function buildShell() {
    const active = document.body.dataset.page || '';
    const t = App.t;
    const navLinks = [
      { href: '/admin', page: 'dashboard', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z', label: 'Dashboard' },
      { href: '/admin/applications', page: 'applications', icon: 'M9 3h6v3h5v15H4V6h5V3zm4 2v1h-2V5h2zM8 9h8v2H8V9zm0 4h8v2H8v-2zm0 4h5v2H8v-2z', label: 'Applications' },
    ];
    const links = navLinks.map((n) =>
      `<a href="${n.href}" class="${active === n.page ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${n.icon}"/></svg>
        <span>${n.label}</span>
      </a>`).join('');

    const initials = (window.__ADMIN_USER__ && window.__ADMIN_USER__.name || 'A').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

    const shell = `
    <div class="admin-shell">
      <div class="admin-sidebar" id="admin-sidebar">
        <div class="admin-brand">
          <span class="brand-mark"><img class="brand-img" src="/assets/img/logo.jpg" alt="Delta Hope" width="120" height="auto"></span>
          <strong>Employment Application System</strong>
        </div>
        <nav class="admin-nav" aria-label="Admin navigation">${links}</nav>
        <div class="admin-user">
          <span class="avatar">${App.escapeHtml(initials)}</span>
          <div class="user-meta">
            <div class="user-name">${App.escapeHtml(window.__ADMIN_USER__?.name || '')}</div>
            <div class="user-role">${App.escapeHtml(window.__ADMIN_USER__?.role || '')}</div>
          </div>
          <button class="icon-btn" id="btn-logout" title="Logout" aria-label="Logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </div>
      </div>
      <div class="admin-main">
        <div class="admin-topbar">
          <button class="icon-btn menu-toggle" id="btn-menu" aria-label="Menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
          <h1 data-page-title>Dashboard</h1>
          <button class="icon-btn" id="btn-logout-mobile" title="Logout" aria-label="Logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </div>
        <main class="admin-content" id="admin-content"></main>
      </div>
    </div>`;
    document.body.innerHTML = shell;

    const toggle = (open) => document.getElementById('admin-sidebar').classList.toggle('open', open);
    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) menuBtn.addEventListener('click', () => toggle(true));
    const logoutBtns = [document.getElementById('btn-logout'), document.getElementById('btn-logout-mobile')];
    logoutBtns.forEach((b) => {
      if (b) b.addEventListener('click', async () => {
        try { await App.post('/api/auth/logout'); } catch (_) {}
        window.location.href = '/admin/login';
      });
    });
    document.addEventListener('click', (e) => {
      if (window.innerWidth < 768 && !e.target.closest('.admin-sidebar')) toggle(false);
    });
  }

  async function requireAuth() {
    try {
      const res = await App.get('/api/auth/me');
      if (!res.user) { window.location.href = '/admin/login'; return null; }
      window.__ADMIN_USER__ = res.user;
      return res.user;
    } catch (_) {
      window.location.href = '/admin/login';
      return null;
    }
  }

  const STATUS_LABELS = {
    new: 'New', review: 'In Review', shortlisted: 'Shortlisted',
    interview: 'Interview', rejected: 'Rejected', hired: 'Hired', archived: 'Archived',
  };
  const STATUSES = ['new', 'review', 'shortlisted', 'interview', 'rejected', 'hired', 'archived'];

  function statusBadge(status) {
    const label = STATUS_LABELS[status] || status;
    return `<span class="badge badge-${status}">${App.escapeHtml(label)}</span>`;
  }

  function statusSelect(name, value, extra) {
    const opts = STATUSES.map((s) => `<option value="${s}" ${s === value ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('');
    return `<select name="${name}" class="${extra || ''}">${opts}</select>`;
  }

  function fmt(v) {
    if (v === null || v === undefined || v === '') return '';
    return App.escapeHtml(String(v));
  }

  function yesNo(v) {
    if (v === 1 || v === true) return 'Yes';
    if (v === 0 || v === false) return 'No';
    return '';
  }

  function fmtDate(v) { return App.formatDate(v); }

  window.Admin = { buildShell, requireAuth, statusBadge, statusSelect, statusSelectNames: STATUSES, STATUS_LABELS, fmt, yesNo, fmtDate };
})();