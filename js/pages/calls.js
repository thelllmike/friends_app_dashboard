// Calls: volume and average length per day (two charts, one axis each) + recent calls.
import { h, clear, api, auth, fmtNum, fmtDuration, fmtDateTime, countryName, titleCase, pill, pager, store, PLATFORM_LABEL } from '../lib.js';
import { areaChart, dataTable } from '../charts.js';
import { openUser } from './users.js';

const RANGES = [14, 30, 90];
const LIMIT = 25;

export function render(main) {
  let days = store.get('range', 14);
  if (!RANGES.includes(days)) days = 14;
  let offset = 0, alive = true;
  const chips = h('div', { class: 'row', role: 'group', 'aria-label': 'Date range' });
  const charts = h('div', { class: 'grid-2' }, h('div', { class: 'card empty' }, 'Loading…'));
  const list = h('section', { class: 'card' });
  main.append(h('div', { class: 'page-head' }, h('div', null, h('h1', { class: 'dsp' }, 'Calls'), h('p', { class: 'muted' }, 'Days are in UTC')), chips), charts,
    auth.can('users:read') ? list : null);

  function drawChips() {
    clear(chips).append(...RANGES.map((d) => h('button', {
      class: `chip${d === days ? ' on' : ''}`, type: 'button', 'aria-pressed': String(d === days),
      onclick: () => { days = d; store.set('range', d); drawChips(); loadCharts(); },
    }, `${d} days`)));
  }

  async function loadCharts() {
    try {
      const { series } = await api('/admin/stats/calls', { query: { days } });
      if (!alive) return;
      const total = series.reduce((a, b) => a + b.calls, 0);
      const withLen = series.filter((p) => p.avg_seconds > 0);
      const weighted = withLen.reduce((a, b) => a + b.avg_seconds * b.calls, 0) / Math.max(1, withLen.reduce((a, b) => a + b.calls, 0));
      clear(charts).append(
        h('section', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'Calls per day'), h('span', { class: 'muted' }, `${fmtNum(total)} in ${days} days`)),
          areaChart(series.map((p) => ({ date: p.date, value: p.calls })), { label: 'Calls', format: fmtNum })),
        h('section', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'Average call length'), h('span', { class: 'muted' }, withLen.length ? `${fmtDuration(weighted)} overall` : 'No connected calls')),
          areaChart(series.map((p) => ({ date: p.date, value: p.avg_seconds })), { label: 'Avg length', format: fmtDuration }),
          dataTable([...series].reverse(), [
            { label: 'Day', get: (r) => r.date },
            { label: 'Calls', r: true, get: (r) => fmtNum(r.calls) },
            { label: 'Avg length', r: true, get: (r) => fmtDuration(r.avg_seconds || null) }])));
    } catch (e) {
      if (alive) clear(charts).append(h('div', { class: 'card empty' }, e.message));
    }
  }

  async function loadList() {
    if (!auth.can('users:read')) return;
    clear(list).append(h('div', { class: 'empty' }, 'Loading…'));
    try {
      const r = await api('/admin/calls', { query: { limit: LIMIT, offset } });
      if (!alive) return;
      const person = (u, p) => (u
        ? h('button', { type: 'button', style: { textAlign: 'left' }, onclick: () => openUser(u.id, loadList) },
          h('b', { style: { fontWeight: '500' } }, u.display_name || 'No name'), h('br'),
          h('small', { class: 'muted' }, [countryName(u.country), PLATFORM_LABEL[p]].filter(Boolean).join(' · ')))
        : h('span', { class: 'muted' }, 'Deleted user'));
      clear(list).append(h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'Recent calls'), h('span', { class: 'muted' }, 'Newest first')));
      if (!r.items.length) { list.append(h('div', { class: 'empty' }, 'No calls yet.')); return; }
      list.append(h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '680px' } },
        h('thead', null, h('tr', null, ['Started', 'Caller', 'Callee', 'Length', 'Ended by'].map((t, i) => h('th', { class: i === 3 ? 'r' : '' }, t)))),
        h('tbody', null, r.items.map((c) => h('tr', null,
          h('td', { class: 'muted' }, fmtDateTime(c.matched_at)),
          h('td', null, person(c.caller, c.caller_platform)),
          h('td', null, person(c.callee, c.callee_platform)),
          h('td', { class: 'r num' }, c.connected_at ? fmtDuration(c.duration_seconds ?? (c.ended_at ? null : (Date.now() - new Date(c.connected_at)) / 1000)) : h('span', { class: 'muted' }, 'Not connected')),
          h('td', null, c.ended_at ? (c.end_reason === 'report' ? pill('Report', 'bad') : titleCase(c.end_reason) || '—') : pill('Live', 'good'))))))),
      pager(r.total, offset, LIMIT, (o) => { offset = o; loadList(); }));
    } catch (e) {
      if (alive) clear(list).append(h('div', { class: 'empty' }, e.message));
    }
  }

  drawChips();
  loadCharts();
  loadList();
  return () => { alive = false; };
}
