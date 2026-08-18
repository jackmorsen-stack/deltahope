/* Admin login — Employment Application System */
(function () {
  'use strict';
  const App = window.App;

  document.addEventListener('DOMContentLoaded', () => {
    // If already authenticated, go to dashboard
    App.get('/api/auth/me').then((res) => {
      if (res.user) window.location.href = '/admin';
    }).catch(() => {});

    const form = document.getElementById('login-form');
    const errBox = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.hidden = true;

      let ok = true;
      [['username', 'Username is required.'], ['password', 'Password is required.']].forEach(([name, msg]) => {
        const el = form.elements[name];
        const valid = el.value.trim() !== '';
        el.classList.toggle('is-invalid', !valid);
        const errEl = document.querySelector(`[data-for="${name}"]`);
        if (errEl) { errEl.textContent = valid ? '' : msg; errEl.hidden = valid; }
        if (!valid) ok = false;
      });
      if (!ok) return;

      btn.disabled = true;
      btn.textContent = 'Signing in…';
      try {
        const res = await App.post('/api/auth/login', { username: form.elements.username.value.trim(), password: form.elements.password.value });
        window.location.href = '/admin';
      } catch (err) {
        errBox.textContent = err.message || 'Login failed. Please try again.';
        errBox.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });
  });
})();