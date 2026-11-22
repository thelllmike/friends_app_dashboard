// Hand-drawn SVG charts (no library). Line/area with crosshair tooltip; sparklines; table fallback.
import { h, s, showTip, hideTip, fmtDay } from './lib.js';

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * Area chart for a daily series.
 * points: [{date:'YYYY-MM-DD', value:number}], opts: {label, format(v), height}
 */
export function areaChart(points, { label, format = String, height = 220 } = {}) {
  const wrap = h('div', { class: 'chart' });
  if (!points.length || points.every((p) => !p.value)) {
    wrap.append(h('div', { class: 'chart-empty' }, `No ${label.toLowerCase()} in this period yet`));
    return wrap;
  }
  const W = 600, H = height, top = 12, bottom = H - 8, left = 0;
  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const n = points.length;
  const x = (i) => left + (n === 1 ? W / 2 : (i / (n - 1)) * (W - left));
  const y = (v) => bottom - (v / max) * (bottom - top);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)} ${bottom} L${x(0).toFixed(1)} ${bottom} Z`;

  const first = points[0], last = points[n - 1];
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a));
  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', style: `height:${H}px`, role: 'img',
    'aria-label': `${label} per day, ${fmtDay(first.date)} to ${fmtDay(last.date)}. Latest ${format(last.value)}, peak ${format(peak.value)} on ${fmtDay(peak.date)}.`,
  });
  for (const f of [0, 0.5, 1]) {
    const yy = y(max * f);
    svg.append(s('line', { x1: 0, x2: W, y1: yy, y2: yy, stroke: 'var(--grid)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
  }
  svg.append(
    s('path', { d: area, fill: 'var(--area)' }),
    s('path', { d: line, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }),
  );
  const cross = s('line', { y1: top, y2: bottom, stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '3 3', 'vector-effect': 'non-scaling-stroke', visibility: 'hidden' });
  svg.append(cross);
  const hit = s('rect', { class: 'hit', x: 0, y: 0, width: W, height: H, fill: 'transparent' });
  svg.append(hit);

  // The dot is HTML so it stays round under preserveAspectRatio="none".
  const dot = h('span', { style: { position: 'absolute', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--surface)', transform: 'translate(-50%,-50%)', pointerEvents: 'none', display: 'none' } });
  const yLabels = h('div', { style: { position: 'absolute', left: '0', top: '0', bottom: '0', width: '52px', pointerEvents: 'none' } },
    [1, 0.5, 0].map((f) => h('span', { class: 'muted num', style: { position: 'absolute', right: '8px', top: `calc(${(y(max * f) / H) * 100}% - 8px)`, fontSize: '11px', whiteSpace: 'nowrap' } }, format(max * f))));
  const inner = h('div', { style: { position: 'relative', marginLeft: '52px' } }, svg, dot);
  const plot = h('div', { style: { position: 'relative' } }, yLabels, inner);

  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - left) / (W - left)) * (n - 1))));
    const p = points[i];
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    Object.assign(dot.style, { display: 'block', left: `${(x(i) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` });
    showTip(r.left + (x(i) / W) * r.width, r.top + (y(p.value) / H) * r.height, h('b', null, fmtDay(p.date)), h('br'), `${label}: ${format(p.value)}`);
  };
  const leave = () => { cross.setAttribute('visibility', 'hidden'); dot.style.display = 'none'; hideTip(); };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', leave);

  const ticks = [0, Math.floor((n - 1) / 2), n - 1];
  const axis = h('div', { class: 'axis-x', style: { marginLeft: '52px' } }, ticks.map((i) => h('span', null, fmtDay(points[i].date))));
  wrap.append(plot, axis);
  return wrap;
}

/** Tiny trend line for KPI tiles. values: number[] */
export function sparkline(values, { tone = 'accent', label = 'trend' } = {}) {
  const W = 120, H = 36, pad = 4;
  if (!values || values.length < 2) return s('svg', { class: 'spark', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * W).toFixed(1)} ${(H - pad - ((v - min) / span) * (H - pad * 2)).toFixed(1)}`).join(' ');
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'good' ? 'var(--good)' : 'var(--accent)';
  return s('svg', { class: 'spark', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label },
    s('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

/** Collapsible data table for a chart (accessibility + exact numbers). */
export function dataTable(rows, cols) {
  return h('details', { style: { marginTop: '12px' } },
    h('summary', { class: 'muted', style: { fontSize: '13px', cursor: 'pointer' } }, 'Show as table'),
    h('div', { class: 'table-wrap', style: { maxHeight: '280px', overflowY: 'auto' } },
      h('table', null,
        h('thead', null, h('tr', null, cols.map((c) => h('th', { class: c.r ? 'r' : '' }, c.label)))),
        h('tbody', null, rows.map((r) => h('tr', null, cols.map((c) => h('td', { class: c.r ? 'r num' : '' }, c.get(r)))))))));
}
