/* Shared helpers — Employment Application System (Form 127) */

(function (global) {
  'use strict';

  /* ---- Cookie helpers ---- */
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + encodeURIComponent(name) + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  /* ---- CSRF ---- */
  function csrfToken() {
    return getCookie('ea.csrf') || '';
  }

  // Prime the CSRF cookie (needed on serverless hosts where pages are static).
  (async () => { try { await api('GET', '/api/csrf'); } catch (_) {} })();

  function csrfHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = csrfToken();
    if (token) headers['X-CSRF-Token'] = token;
    return headers;
  }

  /* ---- API ---- */
  async function api(method, path, body) {
    const opts = { method, headers: csrfHeaders(), credentials: 'same-origin' };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Request failed.');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const get = (p) => api('GET', p);
  const post = (p, b) => api('POST', p, b === undefined ? {} : b);
  const put = (p, b) => api('PUT', p, b);
  const patch = (p, b) => api('PATCH', p, b);
  const del = (p) => api('DELETE', p);

  /* ---- Toast ---- */
  function toast(message, type) {
    let region = document.querySelector('.toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    if (type === 'success') path.setAttribute('d', 'M20 6L9 17l-5-5');
    else if (type === 'error') path.setAttribute('d', 'M18 6L6 18M6 6l12 12');
    else path.setAttribute('d', 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z');
    icon.appendChild(path);
    el.appendChild(icon);
    const span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
    }, 4200);
  }

  /* ---- Language / i18n ---- */
  const LANG_KEY = 'ea.lang';
  function currentLang() {
    return (localStorage.getItem(LANG_KEY) || document.documentElement.lang || 'en');
  }
  function setLang(lang) {
    const doc = document.documentElement;
    doc.lang = lang;
    doc.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(LANG_KEY, lang);
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const text = window.I18N && I18N[lang] && I18N[lang][key];
      if (text) el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = window.I18N && I18N[lang] && I18N[lang][key];
      if (text) el.setAttribute('placeholder', text);
    });
  }
  function t(key, lang) {
    const l = lang || currentLang();
    return (window.I18N && I18N[l] && I18N[l][key]) || key;
  }

  /* ---- Helpers ---- */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(v) {
    if (!v) return '';
    const d = String(v).slice(0, 10);
    return d.replace(/-/g, '/');
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  global.App = {
    getCookie, csrfToken, csrfHeaders, api, get, post, put, patch, del,
    toast, currentLang, setLang, t, escapeHtml, formatDate, debounce, qs, qsa,
  };
})(window);