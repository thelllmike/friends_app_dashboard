// Shared helpers: DOM building (text is always set via textContent, never innerHTML), API, formatting.

// ---- DOM ------------------------------------------------------------------------------------------
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') { if (typeof v === 'object') Object.assign(el.style, v); else el.style.cssText = v; }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v; // CSP-safe (no style attribute parsing)
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

const ICONS = {
  overview: ['M3 13h8V3H3z', 'M13 21h8V11h-8z', 'M13 3v6h8V3z', 'M3 21h8v-6H3z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  calls: ['M23 7l-7 5 7 5V7z', 'M3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'],
  reports: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  countries: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
  up: ['M6 15l6-6 6 6'],
  down: ['M6 9l6 6 6-6'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  close: ['M18 6L6 18', 'M6 6l12 12'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  refresh: ['M23 4v6h-6', 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10'],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  logo: [],
};

export function icon(name, cls = 'ic') {
  if (name === 'logo') {
    return s('svg', { class: cls, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
      s('circle', { cx: 9, cy: 12, r: 5.5 }), s('circle', { cx: 15, cy: 12, r: 5.5 }));
  }
  return s('svg', { class: cls, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    ...(ICONS[name] || []).map((d) => s('path', { d })));
}

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

// ---- API ------------------------------------------------------------------------------------------
const TOKEN_KEY = 'friends_admin_token';
export const auth = {
  get token() { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set token(v) { try { v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
  me: null,
  can(perm) { return !!this.me && this.me.permissions.includes(perm); },
  onExpired: () => {},
};

export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}

export async function api(path, { method = 'GET', body, query } = {}) {
  let url = path;
  if (query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') q.set(k, v);
    const qs = q.toString();
    if (qs) url += '?' + qs;
  }
  const headers = { Accept: 'application/json' };
  if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', "Can't reach the server. Check your connection.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const e = data?.error || {};
    if (res.status === 401 && path !== '/admin/auth/login') auth.onExpired();
    let msg = e.message || `Request failed (${res.status})`;
    if (e.code === 'validation_error' && Array.isArray(e.details) && e.details.length) {
      msg = e.details.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ');
    }
    throw new ApiError(res.status, e.code || 'error', msg, e.details);
  }
  return data;
}

// ---- formatting -----------------------------------------------------------------------------------
const nf = new Intl.NumberFormat('en-US');
export const fmtNum = (n) => (n === null || n === undefined ? '—' : nf.format(Math.round(n)));
export function fmtDuration(sec) {
  if (sec === null || sec === undefined) return '—';
  sec = Math.round(sec);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), r = sec % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const hh = Math.floor(m / 60);
  return `${hh}h ${m % 60}m`;
}
let regionNames = null;
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* old browser */ }
export function countryName(code) {
  if (!code) return '—';
  try { return regionNames?.of(code) || code; } catch { return code; }
}
const dtf = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const df = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtDateTime = (iso) => (iso ? dtf.format(new Date(iso)) : '—');
export const fmtDate = (iso) => (iso ? df.format(new Date(iso)) : '—');
export function fmtDay(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function timeAgo(iso) {
  if (!iso) return '—';
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400)}d ago`;
  return fmtDate(iso);
}
export const titleCase = (s) => (s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const PLATFORM_LABEL = { android: 'Android', ios: 'iOS', web: 'Web' };
export const money = (cents, cur) => {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${cur}`; }
};

// ---- UI bits --------------------------------------------------------------------------------------
export function avatar(user, cls = 'avatar') {
  const name = user?.display_name || '?';
  if (user?.photo_url) return h('img', { class: cls, src: user.photo_url, alt: '', loading: 'lazy' });
  return h('span', { class: cls, 'aria-hidden': 'true' }, name.trim().charAt(0).toUpperCase() || '?');
}

export function userCell(user, sub) {
  if (!user) return h('span', { class: 'muted' }, 'Deleted user');
  return h('div', { class: 'user-cell' }, avatar(user),
    h('div', null, h('b', null, user.display_name || 'No name yet'), sub ? h('small', null, sub) : null));
}

export function pill(text, kind = 'plain') { return h('span', { class: `pill ${kind}` }, text); }

export function toast(msg, kind = '') {
  const t = h('div', { class: `toast ${kind}`, role: kind === 'bad' ? 'alert' : 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 6000 : 3000);
}

export function errorToast(e) { toast(e?.message || 'Something went wrong', 'bad'); }

/** Button that disables itself while its async handler runs. */
export function actionBtn(label, cls, fn, attrs = {}) {
  const b = h('button', { class: `btn ${cls}`, type: 'button', ...attrs }, label);
  b.addEventListener('click', async () => {
    if (b.disabled) return;
    b.disabled = true;
    try { await fn(b); } catch (e) { errorToast(e); } finally { if (b.isConnected) b.disabled = false; }
  });
  return b;
}

let openDrawer = null;
export function drawer(build) {
  closeDrawer();
  const prevFocus = document.activeElement;
  const panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' });
  const ov = h('div', { class: 'overlay', onclick: closeDrawer });
  const onKey = (e) => { if (e.key === 'Escape') closeDrawer(); };
  document.addEventListener('keydown', onKey);
  document.body.append(ov, panel);
  openDrawer = { panel, ov, onKey, prevFocus };
  const render = async () => {
    clear(panel).append(h('div', { class: 'empty' }, 'Loading…'));
    try {
      const content = await build({ close: closeDrawer, refresh: render });
      if (openDrawer?.panel === panel) clear(panel).append(content);
    } catch (e) {
      clear(panel).append(h('div', { class: 'drawer-head' }, h('div', { class: 'spacer' }), closeBtn()),
        h('div', { class: 'empty' }, e.message || 'Could not load'));
    }
  };
  render();
  panel.focus();
  return { refresh: render };
}

export function closeDrawer() {
  if (!openDrawer) return;
  const { panel, ov, onKey, prevFocus } = openDrawer;
  panel.remove(); ov.remove();
  document.removeEventListener('keydown', onKey);
  openDrawer = null;
  if (prevFocus?.focus) prevFocus.focus();
}

export function closeBtn() {
  return h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Close', onclick: closeDrawer }, icon('close'));
}

export function fact(label, value) {
  return h('div', { class: 'fact' }, h('small', null, label), h('span', null, value ?? '—'));
}

export function pager(total, offset, limit, go) {
  const from = total ? offset + 1 : 0, to = Math.min(offset + limit, total);
  return h('div', { class: 'pager' },
    h('span', { class: 'muted' }, `${fmtNum(from)}–${fmtNum(to)} of ${fmtNum(total)}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn sec sm', type: 'button', disabled: offset === 0, onclick: () => go(Math.max(0, offset - limit)) }, 'Previous'),
      h('button', { class: 'btn sec sm', type: 'button', disabled: to >= total, onclick: () => go(offset + limit) }, 'Next')));
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem('fa_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fa_' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// ---- tooltip --------------------------------------------------------------------------------------
const tip = () => document.getElementById('tooltip');
export function showTip(x, y, ...content) {
  const t = tip();
  clear(t).append(...content);
  t.hidden = false;
  const r = t.getBoundingClientRect();
  let left = x + 14, top = y - r.height - 10;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
  if (top < 8) top = y + 16;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${top}px`;
}
export function hideTip() { tip().hidden = true; }
