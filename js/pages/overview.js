// Overview — matches the "Admin dashboard · trends" board.
import { h, icon, clear, api, auth, fmtNum, fmtDuration, countryName, userCell, pill, titleCase, timeAgo, store, PLATFORM_LABEL, showTip, hideTip } from '../lib.js';
import { areaChart, sparkline, dataTable } from '../charts.js';
import { openReport } from './reports.js';

const RANGES = [14, 30, 90];

function delta(m, { higherIsGood = true, absolute = false } = {}) {
  if (m.last_week === null || m.last_week === undefined || m.value === null || m.value === undefined) {
    return h('span', { class: 'delta flat' }, h('span', { class: 'muted' }, 'No data from last week yet'));
  }
  const diff = m.value - m.last_week;
  if (diff === 0) return h('span', { class: 'delta flat' }, 'No change', h('span', { class: 'muted' }, 'vs last week'));
  const up = diff > 0;
  const good = up === higherIsGood;
  let text;
  if (absolute || m.change_pct === null) text = `${up ? '+' : '−'}${fmtNum(Math.abs(diff))}`;
  else text = `${up ? '+' : '−'}${Math.abs(m.change_pct).toFixed(1)}%`;
  return h('span', { class: `delta ${good ? 'good' : 'bad'}` }, icon(up ? 'up' : 'down'),
    h('span', { class: 'sr' }, up ? 'Up ' : 'Down '), text, h('span', { class: 'muted' }, 'vs last week'));
}

function kpi(label, value, m, spark, opts) {
  return h('div', { class: 'card kpi' },
    h('span', { class: 'kpi-label' }, label),
    h('div', { class: 'kpi-body' }, h('span', { class: 'kpi-value dsp num' }, value), spark),
    delta(m, opts));
}

function trendTone(values, higherIsGood = true) {
  if (!values || values.length < 2) return 'accent';
  const up = values[values.length - 1] >= values[0];
  return up === higherIsGood ? 'accent' : 'bad';
}

function trendNote(series) {
  const vals = series.map((p) => p.calls);
  const half = Math.max(1, Math.floor(vals.length / 2));
  const a = vals.slice(0, half).reduce((x, y) => x + y, 0), b = vals.slice(-half).reduce((x, y) => x + y, 0);
  if (!a && !b) return 'No calls yet';
  if (!a) return 'New activity this period';
  const pct = Math.round(((b - a) / a) * 100);
  return pct === 0 ? 'Flat over the period' : `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% vs the first half`;
}

function platformCard(ov) {
  const parts = ['android', 'ios', 'web'].map((p) => ({ p, n: ov.online_by_platform[p].value || 0 }));
  const total = parts.reduce((a, b) => a + b.n, 0);
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const bar = h('div', { class: 'stack', role: 'img', 'aria-label': parts.map((x) => `${PLATFORM_LABEL[x.p]} ${pct(x.n)} percent`).join(', ') },
    total ? parts.filter((x) => x.n).map((x) => {
      const seg = h('span', { style: { width: `${(x.n / total) * 100}%`, background: `var(--s-${x.p})` } });
      seg.addEventListener('pointermove', (e) => showTip(e.clientX, e.clientY, h('b', null, PLATFORM_LABEL[x.p]), h('br'), `${fmtNum(x.n)} online · ${pct(x.n)}%`));
      seg.addEventListener('pointerleave', hideTip);
      return seg;
    }) : null);
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'Users online by platform'),
      h('span', { class: 'muted' }, `${fmtNum(total)} total right now`)),
    bar,
    h('div', { class: 'legend' }, parts.map((x) => h('div', { class: 'legend-row' },
      h('span', { class: 'swatch', style: { background: `var(--s-${x.p})` } }),
      h('span', { style: { flex: '1' } }, PLATFORM_LABEL[x.p]),
      h('span', { class: 'muted num' }, fmtNum(x.n)),
      h('span', { class: 'num', style: { fontWeight: '600', width: '44px', textAlign: 'right' } }, `${pct(x.n)}%`)))));
}

function countriesCard(top, days) {
  const max = Math.max(1, ...top.map((c) => c.active_users));
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'Top countries'), h('span', { class: 'muted' }, `Active users · ${days} days`)),
    top.length
      ? h('div', { class: 'bars' }, top.map((c) => {
        const row = h('div', { class: 'bar-row' },
          h('span', null, countryName(c.country)),
          h('span', { class: 'track' }, h('span', { style: { width: `${(c.active_users / max) * 100}%` } })),
          h('span', { class: 'muted num', style: { textAlign: 'right' } }, fmtNum(c.active_users)));
        row.addEventListener('pointermove', (e) => showTip(e.clientX, e.clientY, h('b', null, countryName(c.country)), h('br'), `${fmtNum(c.active_users)} active · ${c.share_pct}% of top countries`));
        row.addEventListener('pointerleave', hideTip);
        return row;
      }))
      : h('div', { class: 'empty' }, 'No active users with a country yet'));
}

function reportsCard(rep, refresh) {
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'Reports queue'),
      h('span', { class: 'muted' }, rep.total ? `${fmtNum(rep.total)} open · waiting longest first` : 'All clear')),
    rep.items.length
      ? h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '560px' } },
        h('thead', null, h('tr', null, h('th', null, 'User'), h('th', null, 'Country'), h('th', null, 'Reason'), h('th', null, 'Reported'), h('th', null, 'Status'), h('th', null, h('span', { class: 'sr' }, 'Actions')))),
        h('tbody', null, rep.items.map((r) => h('tr', null,
          h('td', null, userCell(r.reported, r.reported_open_reports > 1 ? `${r.reported_open_reports} open reports` : null)),
          h('td', { class: 'muted' }, countryName(r.reported?.country)),
          h('td', null, titleCase(r.reason)),
          h('td', { class: 'muted' }, timeAgo(r.created_at)),
          h('td', null, r.reported?.is_banned ? pill('Banned', 'bad') : r.reported_open_reports >= 3 ? pill('Escalated', 'bad') : pill('Open', 'open')),
          h('td', { class: 'r' }, h('button', { class: 'chip sm', type: 'button', onclick: () => openReport(r.id, refresh) }, 'Review')))))))
      : h('div', { class: 'empty' }, 'No open reports. Nice.'),
    rep.total > rep.items.length ? h('div', { style: { marginTop: '12px' } }, h('a', { href: '#/reports' }, 'See all open reports')) : null);
}

export function render(main) {
  let days = store.get('range', 14);
  if (!RANGES.includes(days)) days = 14;
  let alive = true;
  const chips = h('div', { class: 'row', role: 'group', 'aria-label': 'Date range' });
  const sub = h('p', { class: 'muted' });
  const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } }, h('div', { class: 'empty' }, 'Loading…'));
  main.append(h('div', { class: 'page-head' }, h('div', null, h('h1', { class: 'dsp' }, 'Overview'), sub), chips), body);

  function drawChips() {
    clear(chips).append(...RANGES.map((d) => h('button', {
      class: `chip${d === days ? ' on' : ''}`, type: 'button', 'aria-pressed': String(d === days),
      onclick: () => { days = d; store.set('range', d); drawChips(); load(); },
    }, `${d} days`)));
    sub.textContent = `Last ${days} days · live numbers refresh every 30 seconds`;
  }

  async function load() {
    const canReports = auth.can('reports:manage');
    try {
      const [ov, callsRes, top, hist, rep] = await Promise.all([
        api('/admin/overview'),
        api('/admin/stats/calls', { query: { days } }),
        api('/admin/stats/top-countries', { query: { days, limit: 6 } }),
        api('/admin/stats/online-history', { query: { hours: 24, points: 24 } }),
        canReports ? api('/admin/reports', { query: { status: 'open', limit: 5 } }) : Promise.resolve(null),
      ]);
      if (!alive) return;
      const series = callsRes.series;
      const onlineVals = hist.series.map((p) => p.total).concat(ov.online_now.value);
      const webVals = hist.series.map((p) => p.web).concat(ov.web_users_online.value);
      const callVals = series.slice(-14).map((p) => p.calls);
      const avgVals = series.slice(-14).filter((p) => p.avg_seconds > 0).map((p) => p.avg_seconds);

      const kpis = h('div', { class: 'kpis' },
        kpi('Online now', fmtNum(ov.online_now.value), ov.online_now, sparkline(onlineVals, { tone: trendTone(onlineVals), label: 'Online users, last 24 hours' })),
        kpi('Web users online', fmtNum(ov.web_users_online.value), ov.web_users_online, sparkline(webVals, { tone: trendTone(webVals), label: 'Web users online, last 24 hours' })),
        kpi('Calls today', fmtNum(ov.calls_today.value), ov.calls_today, sparkline(callVals, { tone: trendTone(callVals), label: 'Calls per day, last 14 days' })),
        kpi('Avg call length', fmtDuration(ov.avg_call_seconds.value), ov.avg_call_seconds, sparkline(avgVals, { tone: trendTone(avgVals), label: 'Average call length per day' })),
        kpi('Open reports', fmtNum(ov.open_reports.value), ov.open_reports, null, { higherIsGood: false, absolute: true }));

      const callsCard = h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', { class: 'dsp' }, 'Calls per day'), h('span', { class: 'muted' }, trendNote(series))),
        areaChart(series.map((p) => ({ date: p.date, value: p.calls })), { label: 'Calls', format: fmtNum }),
        dataTable([...series].reverse(), [
          { label: 'Day', get: (r) => r.date },
          { label: 'Calls', r: true, get: (r) => fmtNum(r.calls) },
          { label: 'Avg length', r: true, get: (r) => fmtDuration(r.avg_seconds || null) }]));

      clear(body).append(kpis,
        h('div', { class: 'grid-2' }, callsCard, countriesCard(top, days)),
        platformCard(ov),
        rep ? reportsCard(rep, load) : null);
    } catch (e) {
      if (!alive) return;
      clear(body).append(h('div', { class: 'card empty' }, e.message, h('div', { style: { marginTop: '12px' } },
        h('button', { class: 'btn sec sm', type: 'button', onclick: load }, 'Try again'))));
    }
  }

  drawChips();
  load();
  const timer = setInterval(() => { if (!document.hidden && !document.querySelector('.drawer')) load(); }, 30000);
  return () => { alive = false; clearInterval(timer); };
}
