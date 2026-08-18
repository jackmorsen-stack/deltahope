/* Admin dashboard — overview stats, status breakdown, recent activity */
(function () {
  'use strict';
  const App = window.App, Admin = window.Admin;

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await Admin.requireAuth();
    if (!user) return;
    Admin.buildShell();
    document.querySelector('[data-page-title]').textContent = 'Dashboard';

    const content = document.getElementById('admin-content');
    content.innerHTML = '<div class="panel"><div class="panel-body" style="text-align:center;padding:48px"><span class="spinner"></span></div></div>';

    try {
      const stats = await App.get('/api/admin/stats');
      render(content, stats, user);
    } catch (err) {
      content.innerHTML = '<div class="empty-state"><p>' + App.escapeHtml(err.message || 'Could not load dashboard.') + '</p></div>';
    }
  });

  function render(content, s, user) {
    const byStatus = {};
    (s.byStatus || []).forEach((r) => { byStatus[r.status] = r.c; });

    const statusRows = Object.keys(Admin.STATUS_LABELS).map((st) => {
      const c = byStatus[st] || 0;
      const pct = s.total ? Math.round((c / s.total) * 100) : 0;
      return `<div class="status-row">
        <span class="status-name">${Admin.fmt(Admin.STATUS_LABELS[st])}</span>
        <span class="status-bar"><span class="status-bar-fill" style="width:${pct}%"></span></span>
        <span class="status-count">${c}</span>
      </div>`;
    }).join('');

    const recent = (s.recent || []).map((r) => `
      <a class="recent-item" href="/admin/applications/${r.id}">
        <span class="recent-ref">${Admin.fmt(r.ref_no)}</span>
        <span class="recent-meta">
          <span class="recent-name">${Admin.fmt(r.name)}</span>
          <span class="recent-job">${Admin.fmt(r.job)}</span>
        </span>
        ${Admin.statusBadge(r.status)}
        <span class="recent-date">${Admin.fmtDate(r.submitted_at)}</span>
      </a>`).join('') || '<div class="empty-state"><p>No applications yet.</p></div>';

    const activity = (s.activity || []).map((a) => `
      <div class="activity-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <div class="activity-details">
          <span class="activity-action">${Admin.fmt(a.action)}</span>
          <span class="muted"> — ${Admin.fmt(a.username || 'system')}</span>
          <div class="activity-time">${Admin.fmtDate(a.created_at)}</div>
        </div>
      </div>`).join('') || '<div class="empty-state"><p>No activity yet.</p></div>';

    const auditLink = '';

    content.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg></span>
          <div class="stat-value">${s.total}</div>
          <div class="stat-label">Total Applications</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span>
          <div class="stat-value">${s.today}</div>
          <div class="stat-label">Today</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/></svg></span>
          <div class="stat-value">${s.month}</div>
          <div class="stat-label">This Month</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></span>
          <div class="stat-value">${Object.keys(byStatus).length}</div>
          <div class="stat-label">Active Statuses</div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="panel">
          <div class="panel-head"><h2>Status Breakdown</h2></div>
          <div class="panel-body"><div class="status-list">${statusRows}</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Recent Activity</h2>${auditLink}</div>
          <div class="panel-body">${activity}</div>
        </div>
      </div>

      <div class="panel" style="margin-top:24px">
        <div class="panel-head">
          <h2>Recent Applications</h2>
          <a class="btn btn-outline btn-sm" href="/admin/applications">View all</a>
        </div>
        <div class="panel-body"><div class="recent-list">${recent}</div></div>
      </div>`;
  }
})();