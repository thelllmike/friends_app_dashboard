// Settings: runtime flags/thresholds, premium plans and prices, admin accounts.
import { h, clear, api, auth, fmtDateTime, money, actionBtn, toast, titleCase } from '../lib.js';

const META = {
  maintenance_mode: ['Maintenance mode', 'Stops new matches. Use during upgrades.'],
  chat_enabled: ['In-call text chat', 'Lets matched users send text messages.'],
  gender_filter_enabled: ['Gender filter (Premium)', 'Premium users can choose who they match with.'],
  country_filter_enabled: ['Country filter (Premium)', 'Premium users can match by country.'],
  priority_matching_enabled: ['Priority matching (Premium)', 'Premium users are matched first.'],
  report_threshold: ['Reports before auto-ban', 'Different people reporting the same user within the window below.'],
  report_window_hours: ['Report window (hours)', 'How far back reports count toward the auto-ban.'],
  auto_ban_hours: ['Auto-ban length (hours)', 'How long an automatic ban lasts.'],
  recent_match_minutes: ['Rematch cooldown (minutes)', "Two people won't be matched again for this long. 0 turns it off."],
  supported_languages: ['App languages', 'Language codes, separated by commas.'],
};
const ROLES = ['analyst', 'moderator', 'admin', 'superadmin'];

function settingsCard() {
  const card = h('section', { class: 'card' }, h('div', { class: 'empty' }, 'Loading…'));
  const editable = auth.can('settings:manage');
  (async () => {
    let values;
    try { values = await api('/admin/settings'); } catch (e) { clear(card).append(h('div', { class: 'empty' }, e.message)); return; }
    const inputs = {};
    const rows = Object.keys(values).sort((a, b) => Object.keys(META).indexOf(a) - Object.keys(META).indexOf(b)).map((k) => {
      const v = values[k];
      const [label, help] = META[k] || [titleCase(k), ''];
      let ctl;
      if (typeof v === 'boolean') {
        const cb = h('input', { type: 'checkbox', checked: v, disabled: !editable, 'aria-label': label });
        inputs[k] = () => cb.checked;
        ctl = h('label', { class: 'switch' }, cb, h('span'));
      } else if (typeof v === 'number') {
        const i = h('input', { class: 'input', type: 'number', min: '0', step: '1', value: String(v), disabled: !editable, 'aria-label': label });
        inputs[k] = () => { const n = Number(i.value); if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a whole number of 0 or more`); return n; };
        ctl = i;
      } else if (Array.isArray(v)) {
        const i = h('input', { class: 'input wide', value: v.join(', '), disabled: !editable, 'aria-label': label });
        inputs[k] = () => i.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
        ctl = i;
      } else {
        const i = h('input', { class: 'input wide', value: String(v ?? ''), disabled: !editable, 'aria-label': label });
        inputs[k] = () => i.value;
        ctl = i;
      }
      return h('div', { class: 'set-row' }, h('div', null, h('b', null, label), help ? h('small', null, help) : null), ctl);
    });
    clear(card).append(
      h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'App settings'),
        h('span', { class: 'muted' }, editable ? 'Changes reach every server within 30 seconds' : 'Read only for your role')),
      h('div', { style: { marginTop: '8px' } }, rows),
      editable ? h('div', { class: 'actions', style: { marginTop: '12px' } }, actionBtn('Save settings', 'pri', async () => {
        const changed = {};
        for (const [k, get] of Object.entries(inputs)) {
          const nv = get();
          if (JSON.stringify(nv) !== JSON.stringify(values[k])) changed[k] = nv;
        }
        if (!Object.keys(changed).length) { toast('Nothing changed'); return; }
        values = await api('/admin/settings', { method: 'PUT', body: { values: changed } });
        toast('Settings saved');
      })) : null);
  })();
  return card;
}

function plansCard() {
  const card = h('section', { class: 'card' }, h('div', { class: 'empty' }, 'Loading…'));
  const editable = auth.can('settings:manage');
  const load = async () => {
    let plans;
    try { plans = await api('/admin/plans'); } catch (e) { clear(card).append(h('div', { class: 'empty' }, e.message)); return; }
    clear(card).append(
      h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'Premium plans'),
        h('span', { class: 'muted' }, 'Prices shown in the app. Store prices are set in Google Play and App Store Connect.')),
      h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '760px' } },
        h('thead', null, h('tr', null, ['Plan', 'Price', 'Currency', 'Days', 'Badge', 'Google product', 'Apple product', 'Active', ''].map((t) => h('th', null, t)))),
        h('tbody', null, plans.map((p) => {
          const name = h('input', { class: 'input', value: p.name, disabled: !editable, style: { width: '120px' }, 'aria-label': 'Name' });
          const price = h('input', { class: 'input', type: 'number', min: '0', step: '0.01', value: (p.price_cents / 100).toFixed(2), disabled: !editable, style: { width: '100px' }, 'aria-label': 'Price' });
          const cur = h('input', { class: 'input', value: p.currency, maxlength: '3', disabled: !editable, style: { width: '72px' }, 'aria-label': 'Currency' });
          const dur = h('input', { class: 'input', type: 'number', min: '1', value: String(p.duration_days), disabled: !editable, style: { width: '80px' }, 'aria-label': 'Duration in days' });
          const badge = h('input', { class: 'input', value: p.badge || '', disabled: !editable, style: { width: '110px' }, placeholder: 'e.g. Best value', 'aria-label': 'Badge' });
          const gid = h('input', { class: 'input', value: p.google_product_id || '', disabled: !editable, style: { width: '150px' }, 'aria-label': 'Google product ID' });
          const aid = h('input', { class: 'input', value: p.apple_product_id || '', disabled: !editable, style: { width: '150px' }, 'aria-label': 'Apple product ID' });
          const active = h('input', { type: 'checkbox', checked: p.active, disabled: !editable, 'aria-label': 'Active' });
          return h('tr', null,
            h('td', null, name, h('div', { class: 'muted mono', style: { marginTop: '4px' } }, p.code)),
            h('td', null, price, h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '4px' } }, money(p.price_cents, p.currency))),
            h('td', null, cur), h('td', null, dur), h('td', null, badge), h('td', null, gid), h('td', null, aid),
            h('td', null, h('label', { class: 'switch' }, active, h('span'))),
            h('td', null, editable ? actionBtn('Save', 'sec sm', async () => {
              const cents = Math.round(Number(price.value) * 100);
              if (!Number.isFinite(cents) || cents < 0) throw new Error('Price must be 0 or more');
              if (!/^[A-Za-z]{3}$/.test(cur.value)) throw new Error('Currency must be a 3-letter code like USD');
              await api(`/admin/plans/${encodeURIComponent(p.code)}`, { method: 'PATCH', body: {
                name: name.value.trim() || p.name, price_cents: cents, currency: cur.value, duration_days: Number(dur.value),
                badge: badge.value.trim() || null, google_product_id: gid.value.trim() || null, apple_product_id: aid.value.trim() || null, active: active.checked } });
              toast(`${name.value} saved`);
              load();
            }) : null));
        })))));
  };
  load();
  return card;
}

function adminsCard() {
  const card = h('section', { class: 'card' }, h('div', { class: 'empty' }, 'Loading…'));
  const load = async () => {
    let admins;
    try { admins = await api('/admin/admins'); } catch (e) { clear(card).append(h('div', { class: 'empty' }, e.message)); return; }
    const email = h('input', { class: 'input', type: 'email', placeholder: 'name@company.com', autocomplete: 'off', 'aria-label': 'Email' });
    const pass = h('input', { class: 'input', type: 'password', placeholder: 'At least 12 characters', autocomplete: 'new-password', 'aria-label': 'Password' });
    const role = h('select', { class: 'input', 'aria-label': 'Role' }, ROLES.map((r) => h('option', { value: r, selected: r === 'moderator' }, titleCase(r))));
    clear(card).append(
      h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'Admin accounts'), h('span', { class: 'muted' }, 'Analyst: stats only · Moderator: users and reports · Admin: plus premium and settings · Superadmin: plus admins')),
      h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Email', 'Role', 'Status', 'Last sign-in'].map((t) => h('th', null, t)))),
        h('tbody', null, admins.map((a) => h('tr', null,
          h('td', null, a.email, a.id === auth.me.id ? h('span', { class: 'muted' }, ' (you)') : null),
          h('td', null, titleCase(a.role)),
          h('td', null, a.active ? 'Active' : h('span', { class: 'muted' }, 'Disabled')),
          h('td', { class: 'muted' }, a.last_login_at ? fmtDateTime(a.last_login_at) : 'Never')))))),
      h('h3', { style: { marginTop: '20px', fontSize: '15px' } }, 'Add an admin'),
      h('div', { class: 'form-grid', style: { marginTop: '10px' } },
        h('label', { class: 'field' }, 'Email', email), h('label', { class: 'field' }, 'Password', pass), h('label', { class: 'field' }, 'Role', role),
        actionBtn('Add admin', 'pri', async () => {
          if (!email.value.includes('@')) throw new Error('Enter a valid email');
          if (pass.value.length < 12) throw new Error('Password must be at least 12 characters');
          await api('/admin/admins', { method: 'POST', body: { email: email.value.trim(), password: pass.value, role: role.value } });
          toast('Admin added');
          load();
        })));
  };
  load();
  return card;
}

export function render(main) {
  main.append(h('div', { class: 'page-head' }, h('div', null, h('h1', { class: 'dsp' }, 'Settings'),
    h('p', { class: 'muted' }, `Signed in as ${auth.me.email} (${auth.me.role})`))),
  settingsCard(), plansCard(), auth.can('admins:manage') ? adminsCard() : null);
}
