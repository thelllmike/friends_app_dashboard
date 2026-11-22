// App shell: login, role-aware navigation, hash router.
import { h, icon, clear, api, auth, closeDrawer, hideTip, store } from './lib.js';
import * as overview from './pages/overview.js';
import * as users from './pages/users.js';
import * as calls from './pages/calls.js';
import * as reports from './pages/reports.js';
import * as countries from './pages/countries.js';
import * as settingsPage from './pages/settings.js';

const PAGES = [
  { id: 'overview', label: 'Overview', perm: 'stats:read', mod: overview },
  { id: 'users', label: 'Users', perm: 'users:read', mod: users },
  { id: 'calls', label: 'Calls', perm: 'stats:read', mod: calls },
  { id: 'reports', label: 'Reports', perm: 'reports:manage', mod: reports },
  { id: 'countries', label: 'Countries', perm: 'stats:read', mod: countries },
  { id: 'settings', label: 'Settings', perm: 'stats:read', mod: settingsPage },
];

const root = document.getElementById('root');
let cleanup = null;
let navEls = {};
let badgeTimer = null;

// Theme: follows the system unless the admin picked one.
const savedTheme = store.get('theme', null);
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
function toggleTheme() {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
}

auth.onExpired = () => { auth.token = null; auth.me = null; showLogin('Your session expired. Sign in again.'); };

function showLogin(message) {
  if (cleanup) { cleanup(); cleanup = null; }
  clearInterval(badgeTimer);
  closeDrawer();
  const err = h('p', { class: 'err', role: 'alert' }, message || '');
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', required: true, id: 'email' });
  const pass = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true, id: 'pass' });
  const btn = h('button', { class: 'btn pri block', type: 'submit' }, 'Sign in');
  const form = h('form', { class: 'card', novalidate: true },
    h('div', { class: 'brand' }, h('div', { class: 'logo' }, icon('logo')), h('span', { class: 'dsp' }, 'Friends Admin')),
    h('h1', { class: 'dsp' }, 'Sign in'),
    h('label', { class: 'field', for: 'email' }, 'Email', email),
    h('label', { class: 'field', for: 'pass' }, 'Password', pass),
    err, btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!email.value || !pass.value) { err.textContent = 'Enter your email and password.'; return; }
    btn.disabled = true; err.textContent = '';
    try {
      const r = await api('/admin/auth/login', { method: 'POST', body: { email: email.value.trim(), password: pass.value } });
      auth.token = r.access_token;
      await boot();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  });
  clear(root).append(h('div', { class: 'login' }, form));
  email.focus();
}

function allowed() { return PAGES.filter((p) => auth.can(p.perm)); }

function shell() {
  const main = h('main', { class: 'main', id: 'main' });
  navEls = {};
  const links = allowed().map((p) => {
    const a = h('a', { class: 'nav-link', href: `#/${p.id}` }, icon(p.id), h('span', null, p.label));
    navEls[p.id] = a;
    return a;
  });
  const side = h('nav', { class: 'side', 'aria-label': 'Main' },
    h('div', { class: 'brand' }, h('div', { class: 'logo' }, icon('logo')), h('span', { class: 'dsp' }, 'Friends Admin')),
    links,
    h('div', { class: 'side-foot' },
      h('div', { class: 'who' }, h('b', null, auth.me.email), h('span', { class: 'muted' }, auth.me.role)),
      h('div', { class: 'row', style: { gap: '4px' } },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: toggleTheme, 'aria-label': 'Switch light or dark theme', title: 'Theme' }, icon('moon')),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: logout, title: 'Sign out' }, icon('logout'), h('span', null, 'Sign out')))));
  clear(root).append(h('div', { class: 'shell' }, side, main));
  return main;
}

function logout() { auth.token = null; auth.me = null; location.hash = ''; showLogin(); }

async function refreshBadge() {
  const link = navEls.reports;
  if (!link) return;
  try {
    const r = await api('/admin/reports', { query: { status: 'open', limit: 1 } });
    link.querySelector('.badge-count')?.remove();
    if (r.total > 0) link.append(h('span', { class: 'badge-count', 'aria-label': `${r.total} open` }, r.total > 99 ? '99+' : String(r.total)));
  } catch { /* ignore */ }
}

function route() {
  const list = allowed();
  if (!list.length) {
    clear(document.getElementById('main')).append(h('div', { class: 'empty' }, 'Your account has no dashboard permissions.'));
    return;
  }
  const [id, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  const page = list.find((p) => p.id === id) || list[0];
  if (page.id !== id) { history.replaceState(null, '', `#/${page.id}`); }
  for (const [pid, el] of Object.entries(navEls)) {
    el.classList.toggle('on', pid === page.id);
    if (pid === page.id) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  }
  if (cleanup) { cleanup(); cleanup = null; }
  closeDrawer(); hideTip();
  const main = clear(document.getElementById('main'));
  document.title = `${page.label} · Friends Admin`;
  cleanup = page.mod.render(main, { param: rest.join('/') || null, refreshBadge }) || null;
  window.scrollTo(0, 0);
}

async function boot() {
  if (!auth.token) { showLogin(); return; }
  try {
    auth.me = await api('/admin/me');
  } catch (e) {
    if (e.status === 401) return; // onExpired already showed login
    clear(root).append(h('div', { class: 'login' }, h('div', { class: 'card' }, h('p', { class: 'err' }, e.message),
      h('button', { class: 'btn sec', type: 'button', onclick: boot }, 'Try again'))));
    return;
  }
  shell();
  route();
  refreshBadge();
  clearInterval(badgeTimer);
  badgeTimer = setInterval(refreshBadge, 60000);
}

window.addEventListener('hashchange', () => { if (auth.me) route(); });
boot();
