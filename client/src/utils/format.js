const nf = (d) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const fmtNum = (n, d = 1) => (n === null || n === undefined || isNaN(n) ? '—' : nf(d).format(n));
export const fmtCompact = (n) => (n === null || n === undefined || isNaN(n) ? '—' : compact.format(n));
export const fmtPct = (n, d = 1) => (n === null || n === undefined || isNaN(n) ? '—' : `${nf(d).format(n)}%`);
export const fmtT = (n, d = 1) => `${fmtNum(n, d)} t`;

export const fmtDate = (d, opts = {}) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC', ...opts })
    : '—';
export const fmtDay = (d) => fmtDate(d, { year: undefined });
export const fmtMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export function timeAgo(d) {
  if (!d) return '—';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(d, { timeZone: undefined });
}

export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

export const toInputDate =(d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const todayInput = () => new Date().toISOString().slice(0, 10);
export const daysAgoInput = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

// Status thresholds used across the app (higher-is-better metrics).
export const rateTone = (v, target = 80) => (v >= target ? 'good' : v >= target - 15 ? 'warning' : 'critical');
// Capacity metrics where high is bad.
export const capacityTone = (v) => (v >= 95 ? 'critical' : v >= 85 ? 'serious' : v >= 70 ? 'warning' : 'good');

export function downloadCSV(filename, rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','));
  const blob = new Blob([[head, ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
