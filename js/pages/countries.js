// Countries: users, weekly actives, premium and live online per country. Sortable.
import { h, clear, api, fmtNum, countryName, icon } from '../lib.js';

const COLS = [
  { key: 'country', label: 'Country', get: (r) => countryName(r.country) },
  { key: 'users', label: 'Users', num: true },
  { key: 'active_7d', label: 'Active (7 days)', num: true },
  { key: 'premium', label: 'Premium', num: true },
  { key: 'online_now', label: 'Online now', num: true },
];

export function render(main) {
  let rows = [], sortKey = 'users', desc = true, alive = true, filter = '';
  const card = h('section', { class: 'card' }, h('div', { class: 'empty' }, 'Loading…'));
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Filter countries', 'aria-label': 'Filter countries' });
  main.append(h('div', { class: 'page-head' }, h('div', null, h('h1', { class: 'dsp' }, 'Countries'), h('p', { class: 'muted' }, 'From user profiles'))),
    h('div', { class: 'row' }, h('div', { class: 'search' }, icon('search'), search)), card);

  function draw() {
    const f = filter.toLowerCase();
    const list = rows.filter((r) => !f || countryName(r.country).toLowerCase().includes(f) || r.country.toLowerCase() === f)
      .sort((a, b) => {
        const va = sortKey === 'country' ? countryName(a.country) : a[sortKey];
        const vb = sortKey === 'country' ? countryName(b.country) : b[sortKey];
        const c = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return desc ? -c : c;
      });
    const totalUsers = rows.reduce((a, b) => a + b.users, 0) || 1;
    clear(card);
    if (!list.length) { card.append(h('div', { class: 'empty' }, rows.length ? 'No countries match.' : 'No users with a country yet.')); return; }
    card.append(h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '640px' } },
      h('thead', null, h('tr', null, COLS.map((c) => h('th', { class: c.num ? 'r' : '', 'aria-sort': c.key === sortKey ? (desc ? 'descending' : 'ascending') : 'none' },
        h('button', { type: 'button', onclick: () => { if (sortKey === c.key) desc = !desc; else { sortKey = c.key; desc = c.num; } draw(); } },
          c.label, c.key === sortKey ? icon(desc ? 'down' : 'up', 'ic') : null))), h('th', null, 'Share of users'))),
      h('tbody', null, list.map((r) => h('tr', null,
        h('td', null, countryName(r.country), h('span', { class: 'muted' }, ` ${r.country}`)),
        ...COLS.slice(1).map((c) => h('td', { class: 'r num' }, fmtNum(r[c.key]))),
        h('td', { style: { minWidth: '140px' } }, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'nowrap' } },
          h('span', { class: 'track', style: { flex: '1' } }, h('span', { style: { width: `${(r.users / totalUsers) * 100}%` } })),
          h('span', { class: 'muted num', style: { width: '44px', textAlign: 'right', fontSize: '13px' } }, `${((r.users / totalUsers) * 100).toFixed(1)}%`)))))))));
    card.querySelectorAll('th .ic').forEach((i) => { i.style.width = '14px'; i.style.height = '14px'; });
  }

  search.addEventListener('input', () => { filter = search.value.trim(); draw(); });
  api('/admin/countries').then((r) => { if (alive) { rows = r; draw(); } })
    .catch((e) => { if (alive) clear(card).append(h('div', { class: 'empty' }, e.message)); });
  return () => { alive = false; };
}
