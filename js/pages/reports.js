// Reports queue + review drawer.
import { h, clear, api, fmtNum, fmtDateTime, fmtDuration, countryName, userCell, pill, titleCase, timeAgo, drawer, closeBtn, fact, pager, actionBtn, toast, avatar, PLATFORM_LABEL } from '../lib.js';
import { openUser } from './users.js';

const TABS = [['open', 'Open'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed']];
const LIMIT = 25;

export const BAN_OPTIONS = [['24', '24 hours'], ['72', '3 days'], ['168', '7 days'], ['720', '30 days'], ['', 'Permanent']];

const statusPill = (st) => (st === 'open' ? pill('Open', 'open') : st === 'actioned' ? pill('Actioned', 'good') : pill('Dismissed', 'plain'));

export function openReport(id, onDone) {
  drawer(async ({ close, refresh }) => {
    const r = await api(`/admin/reports/${id}`);
    const u = r.reported;
    const note = h('textarea', { class: 'input', maxlength: '1000', placeholder: 'Note for other moderators (optional)' }, r.review_note || '');
    const hours = h('select', { class: 'input', 'aria-label': 'Ban length' }, BAN_OPTIONS.map(([v, l]) => h('option', { value: v, selected: v === '24' }, l)));
    const review = async (action) => {
      const body = { action, note: note.value.trim() || null };
      if (action === 'ban') body.ban_hours = hours.value ? Number(hours.value) : null;
      await api(`/admin/reports/${id}/review`, { method: 'POST', body });
      toast(action === 'ban' ? 'User banned and report closed' : action === 'dismiss' ? 'Report dismissed' : 'Report resolved');
      close();
      onDone?.();
    };
    const isOpen = r.status === 'open';
    return h('div', { style: { display: 'contents' } },
      h('div', { class: 'drawer-head' },
        h('div', { style: { flex: '1' } }, h('h2', { class: 'dsp' }, titleCase(r.reason)),
          h('div', { class: 'row', style: { marginTop: '6px' } }, statusPill(r.status), h('span', { class: 'muted', style: { fontSize: '13px' } }, `Reported ${fmtDateTime(r.created_at)}`))),
        closeBtn()),
      r.details ? h('section', null, h('h3', null, 'Reporter wrote'), h('p', null, r.details)) : null,
      h('section', null, h('h3', null, 'Reported user'),
        u ? h('div', { class: 'row' }, avatar(u, 'avatar lg'),
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('b', { style: { fontSize: '16px' } }, u.display_name || 'No name yet'),
            h('div', { class: 'muted', style: { fontSize: '13px' } }, [u.age ? `${u.age}` : null, countryName(u.country), u.gender ? titleCase(u.gender) : null].filter(Boolean).join(' · ')),
            h('div', { class: 'row', style: { marginTop: '6px' } },
              u.is_banned ? pill(u.permanently_banned ? 'Banned permanently' : `Banned until ${fmtDateTime(u.banned_until)}`, 'bad') : null,
              u.is_premium ? pill('Premium', 'info') : null,
              pill(`${fmtNum(u.reports_received)} reports total`, u.reports_received >= 3 ? 'bad' : 'plain'))),
          h('button', { class: 'btn sec sm', type: 'button', onclick: () => openUser(u.id, onDone) }, 'Open profile'))
          : h('p', { class: 'muted' }, 'This account has been deleted.')),
      r.room ? h('section', null, h('h3', null, 'The call'),
        h('div', { class: 'facts' },
          fact('Started', fmtDateTime(r.room.matched_at)),
          fact('Length', r.room.connected_at ? fmtDuration(r.room.duration_seconds) : 'Never connected'),
          fact('Ended by', titleCase(r.room.end_reason) || 'Still live'),
          fact('Platforms', [r.room.caller_platform, r.room.callee_platform].map((p) => PLATFORM_LABEL[p] || '—').join(' ↔ ')),
          fact('Room', h('span', { class: 'mono' }, r.room.id)))) : null,
      r.other_reports.length ? h('section', null, h('h3', null, `Other reports on this user (${r.other_reports.length})`),
        h('div', { class: 'list' }, r.other_reports.map((o) => h('div', null,
          h('span', null, titleCase(o.reason)), h('span', { class: 'row' }, h('span', { class: 'muted' }, timeAgo(o.created_at)), statusPill(o.status)))))) : null,
      isOpen ? h('section', null, h('h3', null, 'Decision'), note,
        h('div', { class: 'actions' },
          actionBtn('Dismiss', 'sec', () => review('dismiss')),
          actionBtn('Resolve, no ban', 'sec', () => review('resolve')),
          h('span', { class: 'spacer' }),
          u ? h('div', { class: 'row', style: { gap: '8px' } }, hours, actionBtn('Ban user', 'danger', () => review('ban'))) : null),
        h('p', { class: 'note' }, 'Banning ends any live call for this user and blocks sign-in until the ban expires.'))
        : h('section', null, h('h3', null, 'Decision'),
          h('p', null, `${titleCase(r.status)} ${fmtDateTime(r.reviewed_at)}`),
          r.review_note ? h('p', { class: 'muted' }, r.review_note) : null),
    );
  });
}

export function render(main, { refreshBadge }) {
  let status = 'open', offset = 0, alive = true;
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const card = h('section', { class: 'card' });
  main.append(h('div', { class: 'page-head' }, h('div', null, h('h1', { class: 'dsp' }, 'Reports'),
    h('p', { class: 'muted' }, 'Reports are never shown to the reported user. Open reports are sorted oldest first.')), tabs), card);

  function drawTabs() {
    clear(tabs).append(...TABS.map(([id, label]) => h('button', {
      class: `chip${id === status ? ' on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(id === status),
      onclick: () => { status = id; offset = 0; drawTabs(); load(); },
    }, label)));
  }

  async function load() {
    clear(card).append(h('div', { class: 'empty' }, 'Loading…'));
    try {
      const r = await api('/admin/reports', { query: { status, limit: LIMIT, offset } });
      if (!alive) return;
      clear(card);
      if (!r.items.length) { card.append(h('div', { class: 'empty' }, status === 'open' ? 'No open reports.' : 'Nothing here yet.')); return; }
      const done = () => { load(); refreshBadge(); };
      card.append(h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '720px' } },
        h('thead', null, h('tr', null, ['Reported user', 'Country', 'Reason', 'Reported by', 'When', 'Status'].map((t) => h('th', null, t)), h('th', null, h('span', { class: 'sr' }, 'Actions')))),
        h('tbody', null, r.items.map((x) => h('tr', { class: 'click', onclick: (e) => { if (!e.target.closest('button')) openReport(x.id, done); } },
          h('td', null, userCell(x.reported, x.reported_open_reports > 1 ? `${x.reported_open_reports} open reports` : null)),
          h('td', { class: 'muted' }, countryName(x.reported?.country)),
          h('td', null, titleCase(x.reason)),
          h('td', null, x.reporter ? x.reporter.display_name || 'No name' : h('span', { class: 'muted' }, 'Deleted')),
          h('td', { class: 'muted' }, timeAgo(x.created_at)),
          h('td', null, statusPill(x.status), ' ', x.reported?.is_banned ? pill('Banned', 'bad') : null),
          h('td', { class: 'r' }, h('button', { class: 'chip sm', type: 'button', onclick: () => openReport(x.id, done) }, x.status === 'open' ? 'Review' : 'View'))))))),
      pager(r.total, offset, LIMIT, (o) => { offset = o; load(); }));
    } catch (e) {
      if (alive) clear(card).append(h('div', { class: 'empty' }, e.message));
    }
  }

  drawTabs();
  load();
  return () => { alive = false; };
}
