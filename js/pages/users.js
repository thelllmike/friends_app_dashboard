// Users list + profile drawer with ban / premium actions.
import { h, icon, clear, api, auth, fmtNum, fmtDate, fmtDateTime, fmtDuration, countryName, userCell, pill, titleCase, timeAgo, drawer, closeBtn, fact, pager, actionBtn, toast, avatar, debounce, PLATFORM_LABEL } from '../lib.js';
import { BAN_OPTIONS } from './reports.js';

const LIMIT = 25;
const FILTERS = [['all', 'All'], ['premium', 'Premium'], ['banned', 'Banned']];

function statusPills(u) {
  return [
    u.is_banned ? pill(u.permanently_banned ? 'Banned' : 'Temp banned', 'bad') : null,
    u.is_premium ? pill('Premium', 'info') : null,
  ];
}

export function openUser(id, onChange) {
  drawer(async ({ refresh }) => {
    const [u, callsRes, plans] = await Promise.all([
      api(`/admin/users/${id}`),
      api('/admin/calls', { query: { user_id: id, limit: 10 } }),
      auth.can('premium:manage') ? api('/admin/plans') : Promise.resolve([]),
    ]);
    const changed = () => { refresh(); onChange?.(); };

    // --- ban controls
    let banSection = null;
    if (auth.can('users:ban')) {
      if (u.is_banned) {
        banSection = h('section', null, h('h3', null, 'Ban'),
          h('p', null, u.permanently_banned ? 'Banned permanently.' : `Banned until ${fmtDateTime(u.banned_until)}.`),
          h('div', { class: 'actions' }, actionBtn('Lift ban', 'sec', async () => {
            await api(`/admin/users/${id}/unban`, { method: 'POST' }); toast('Ban lifted'); changed();
          })));
      } else {
        const hours = h('select', { class: 'input', 'aria-label': 'Ban length' }, BAN_OPTIONS.map(([v, l]) => h('option', { value: v, selected: v === '24' }, l)));
        const reason = h('input', { class: 'input', maxlength: '255', placeholder: 'Reason (required)', 'aria-label': 'Ban reason' });
        banSection = h('section', null, h('h3', null, 'Ban'),
          h('div', { class: 'form-grid' }, h('label', { class: 'field' }, 'Length', hours), h('label', { class: 'field', style: { gridColumn: 'span 2' } }, 'Reason', reason)),
          h('div', { class: 'actions' }, actionBtn('Ban user', 'danger', async () => {
            if (!reason.value.trim()) { reason.focus(); throw new Error('Add a reason for the ban'); }
            await api(`/admin/users/${id}/ban`, { method: 'POST', body: { hours: hours.value ? Number(hours.value) : null, reason: reason.value.trim() } });
            toast('User banned'); changed();
          })),
          h('p', { class: 'note' }, 'Banning ends any live call immediately.'));
      }
    }

    // --- premium controls
    let premSection = null;
    if (auth.can('premium:manage')) {
      const plan = h('select', { class: 'input', 'aria-label': 'Plan' },
        h('option', { value: '' }, 'Manual grant'),
        plans.map((p) => h('option', { value: p.code }, `${p.name} (${p.duration_days} days)`)));
      const days = h('input', { class: 'input', type: 'number', min: '1', max: '3650', value: '30', 'aria-label': 'Days' });
      plan.addEventListener('change', () => { const p = plans.find((x) => x.code === plan.value); if (p) days.value = p.duration_days; });
      premSection = h('section', null, h('h3', null, 'Premium'),
        h('p', null, u.is_premium ? `Premium until ${fmtDateTime(u.premium_until)}.` : 'Not premium.'),
        h('div', { class: 'form-grid' }, h('label', { class: 'field' }, 'Plan', plan), h('label', { class: 'field' }, 'Days', days),
          actionBtn(u.is_premium ? 'Extend' : 'Grant premium', 'pri', async () => {
            const n = Number(days.value);
            if (!Number.isInteger(n) || n < 1 || n > 3650) throw new Error('Days must be between 1 and 3650');
            await api(`/admin/users/${id}/premium`, { method: 'POST', body: { days: n, plan_code: plan.value || null } });
            toast('Premium granted'); changed();
          })),
        u.is_premium ? h('div', { class: 'actions' }, actionBtn('Revoke premium', 'sec', async () => {
          await api(`/admin/users/${id}/premium`, { method: 'DELETE' }); toast('Premium revoked'); changed();
        })) : null);
    }

    return h('div', { style: { display: 'contents' } },
      h('div', { class: 'drawer-head' }, avatar(u, 'avatar lg'),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('h2', { class: 'dsp' }, u.display_name || 'No name yet'),
          h('div', { class: 'muted', style: { fontSize: '13px' } }, [u.age, countryName(u.country), u.gender ? titleCase(u.gender) : null].filter(Boolean).join(' · ')),
          h('div', { class: 'row', style: { marginTop: '6px' } }, u.online ? pill('Online now', 'good') : pill(`Last seen ${timeAgo(u.last_active_at)}`, 'plain'), ...statusPills(u))),
        closeBtn()),
      h('section', null, h('h3', null, 'Account'),
        h('div', { class: 'facts' },
          fact('Email', u.email), fact('Phone', u.phone), fact('Joined', fmtDate(u.created_at)),
          fact('Platform', PLATFORM_LABEL[u.last_platform]), fact('Language', u.language?.toUpperCase()),
          fact('Calls', fmtNum(u.total_calls)), fact('Reports received', fmtNum(u.reports_received)),
          fact('Interests', u.interests?.length ? u.interests.map(titleCase).join(', ') : null),
          fact('User ID', h('span', { class: 'mono' }, u.id)))),
      banSection, premSection,
      u.reports.length ? h('section', null, h('h3', null, `Reports received (${u.reports.length})`),
        h('div', { class: 'list' }, u.reports.map((r) => h('div', null, h('span', null, titleCase(r.reason)),
          h('span', { class: 'row' }, h('span', { class: 'muted' }, timeAgo(r.created_at)),
            pill(titleCase(r.status), r.status === 'open' ? 'open' : r.status === 'actioned' ? 'good' : 'plain')))))) : null,
      u.bans.length ? h('section', null, h('h3', null, 'Ban history'),
        h('div', { class: 'list' }, u.bans.map((b) => h('div', null,
          h('span', { style: { minWidth: '0', overflowWrap: 'anywhere' } }, b.reason || '—', h('span', { class: 'muted' }, ` · ${b.source === 'auto' ? 'automatic' : 'by admin'}`)),
          h('span', { class: 'muted' }, `${fmtDate(b.created_at)} → ${b.lifted_at ? `lifted ${fmtDate(b.lifted_at)}` : b.expires_at ? fmtDate(b.expires_at) : 'permanent'}`))))) : null,
      u.subscriptions.length ? h('section', null, h('h3', null, 'Subscriptions'),
        h('div', { class: 'list' }, u.subscriptions.map((x) => h('div', null,
          h('span', null, `${titleCase(x.platform)} · ${x.product_id || 'manual'}`),
          h('span', { class: 'row' }, h('span', { class: 'muted' }, `until ${fmtDate(x.expires_at)}`), pill(titleCase(x.status), x.status === 'active' ? 'good' : 'plain')))))) : null,
      callsRes.items.length ? h('section', null, h('h3', null, `Recent calls (${fmtNum(callsRes.total)} total)`),
        h('div', { class: 'list' }, callsRes.items.map((c) => {
          const other = c.caller?.id === id ? c.callee : c.caller;
          return h('div', null, h('span', null, other?.display_name || 'Deleted user'),
            h('span', { class: 'muted' }, `${fmtDateTime(c.matched_at)} · ${c.connected_at ? fmtDuration(c.duration_seconds) : 'not connected'}`));
        }))) : null,
    );
  });
}

export function render(main, { param }) {
  let q = '', filter = 'all', country = '', offset = 0, alive = true;
  const card = h('section', { class: 'card' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search name, email, phone or ID', 'aria-label': 'Search users' });
  const countryIn = h('input', { class: 'input', placeholder: 'Country (e.g. LK)', maxlength: '2', style: { width: '150px' }, 'aria-label': 'Country code' });
  const chips = h('div', { class: 'tabs' });
  main.append(
    h('div', { class: 'page-head' }, h('div', null, h('h1', { class: 'dsp' }, 'Users'), h('p', { class: 'muted' }, 'Newest first'))),
    h('div', { class: 'row' }, h('div', { class: 'search' }, icon('search'), search), countryIn, chips),
    card);

  function drawChips() {
    clear(chips).append(...FILTERS.map(([id, label]) => h('button', {
      class: `chip${id === filter ? ' on' : ''}`, type: 'button', 'aria-pressed': String(id === filter),
      onclick: () => { filter = id; offset = 0; drawChips(); load(); },
    }, label)));
  }

  async function load() {
    clear(card).append(h('div', { class: 'empty' }, 'Loading…'));
    try {
      const r = await api('/admin/users', { query: {
        q: q || undefined, limit: LIMIT, offset, country: country || undefined,
        premium: filter === 'premium' ? 'true' : undefined, banned: filter === 'banned' ? 'true' : undefined } });
      if (!alive) return;
      clear(card);
      if (!r.items.length) { card.append(h('div', { class: 'empty' }, q || country || filter !== 'all' ? 'No users match these filters.' : 'No users yet.')); return; }
      card.append(h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '760px' } },
        h('thead', null, h('tr', null, ['User', 'Country', 'Platform', 'Status', 'Reports', 'Last active', 'Joined'].map((t, i) => h('th', { class: i === 4 ? 'r' : '' }, t)))),
        h('tbody', null, r.items.map((u) => h('tr', { class: 'click', tabindex: '0', onclick: () => openUser(u.id, load), onkeydown: (e) => { if (e.key === 'Enter') openUser(u.id, load); } },
          h('td', null, userCell(u, [u.age, u.gender ? titleCase(u.gender) : null].filter(Boolean).join(' · ') || null)),
          h('td', { class: 'muted' }, countryName(u.country)),
          h('td', { class: 'muted' }, PLATFORM_LABEL[u.last_platform] || '—'),
          h('td', null, h('div', { class: 'row', style: { gap: '6px' } }, ...statusPills(u), !u.is_banned && !u.is_premium ? h('span', { class: 'muted' }, 'Active') : null)),
          h('td', { class: 'r num' }, u.reports_received ? pill(fmtNum(u.reports_received), u.reports_received >= 3 ? 'bad' : 'warn') : h('span', { class: 'muted' }, '0')),
          h('td', { class: 'muted' }, timeAgo(u.last_active_at)),
          h('td', { class: 'muted' }, fmtDate(u.created_at))))))),
      pager(r.total, offset, LIMIT, (o) => { offset = o; load(); }));
    } catch (e) {
      if (alive) clear(card).append(h('div', { class: 'empty' }, e.message));
    }
  }

  const reload = debounce(() => { offset = 0; load(); }, 300);
  search.addEventListener('input', () => { q = search.value.trim(); reload(); });
  countryIn.addEventListener('input', () => {
    countryIn.value = countryIn.value.toUpperCase().replace(/[^A-Z]/g, '');
    const v = countryIn.value;
    if (v.length === 2 || v.length === 0) { country = v; reload(); }
  });
  drawChips();
  load();
  if (param) openUser(param, load);
  return () => { alive = false; };
}

