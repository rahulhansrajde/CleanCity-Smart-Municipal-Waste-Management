import { useId } from 'react';
import { AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Info, Inbox, Minus, OctagonAlert, Wrench } from 'lucide-react';
import { STATUS_TONE, RANGE_PRESETS } from '../utils/constants';
import { fmtNum } from '../utils/format';

export function PageHeader({ title, subtitle, icon: Icon, eyebrow, children }) {
  return (
    <div className="page-head">
      <div className="page-title">
        {Icon && (
          <span className="page-icon">
            <Icon size={22} />
          </span>
        )}
        <div>
          {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

/** Tiny trend line for stat tiles; values only, no axes. */
export function Sparkline({ data, color, width = 104, height = 36 }) {
  const gid = `spark${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 4 - ((v - min) / span) * (height - 8)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.5" fill={color} stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

/** Decorative fill-level graphic for landfill sites. */
export function FillTank({ value = 0, tone = 'good', size = 72 }) {
  const cid = `tank${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const v = Math.max(0, Math.min(100, value || 0));
  const inner = size - 8;
  const y = 4 + inner - (v / 100) * inner;
  const w = size + 24;
  const wave = `M-12 ${y} Q ${w / 8} ${y - 4} ${w / 4} ${y} T ${w / 2} ${y} T ${(w * 3) / 4} ${y} T ${w} ${y} V ${size} H -12 Z`;
  return (
    <svg className="tank" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <clipPath id={cid}>
          <rect x="4" y="4" width={inner} height={inner} rx="16" />
        </clipPath>
      </defs>
      <rect x="4" y="4" width={inner} height={inner} rx="16" fill="var(--surface-2)" />
      <g clipPath={`url(#${cid})`}>
        <path className="tank-wave" d={wave} fill={`var(--${tone})`} opacity="0.9" />
      </g>
      <rect x="4" y="4" width={inner} height={inner} rx="16" fill="none" stroke="var(--border-strong)" />
    </svg>
  );
}

export function Card({ title, subtitle, actions, children, className = '', bodyClass = 'card-body' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/**
 * Headline metric tile. `delta` is a change vs. the previous period;
 * `goodWhen` says which direction is an improvement ("up" | "down").
 */
export function StatCard({ label, value, unit, icon: Icon, tone = '', delta, deltaUnit = '%', goodWhen = 'up', foot, hint, spark, sparkColor = '#2a78d6' }) {
  let cls = 'flat';
  let DIcon = Minus;
  if (delta !== null && delta !== undefined && Math.abs(delta) >= 0.05) {
    const improved = goodWhen === 'up' ? delta > 0 : delta < 0;
    cls = goodWhen === 'neutral' ? 'flat' : improved ? 'up' : 'down';
    DIcon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  }
  return (
    <div className="card stat">
      <div className="stat-head">
        {Icon && (
          <span className={`stat-icon ${tone ? `t-${tone}` : ''}`}>
            <Icon size={18} />
          </span>
        )}
        <span className="stat-label">
          {label}
          {hint && <InfoTip text={hint} />}
        </span>
      </div>
      <div className="stat-row">
        <div className="stat-value">
          {value}
          {unit && <small>{unit}</small>}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      {(foot || (delta !== null && delta !== undefined)) && (
        <div className="stat-foot">
          {delta !== null && delta !== undefined && (
            <span className={`delta ${cls}`} title="Change from the previous period">
              <DIcon size={13} />
              {delta > 0 ? '+' : ''}
              {fmtNum(delta, 1)}
              {deltaUnit}
            </span>
          )}
          {foot}
        </div>
      )}
    </div>
  );
}

/** Small "i" icon that explains a term on hover or focus. */
export function InfoTip({ text }) {
  return (
    <span className="info-tip" tabIndex={0} aria-label={text}>
      <Info size={13} />
      <span className="info-tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}

export function MiniStat({ label, value, sub }) {
  return (
    <div className="mini-stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="cell-sub">{sub}</div>}
    </div>
  );
}

const TONE_ICON = {
  good: CheckCircle2,
  warning: AlertTriangle,
  serious: AlertCircle,
  critical: OctagonAlert,
  info: Info,
  neutral: Circle,
};

// Status colours always ship with an icon and a text label.
export function Badge({ tone = 'neutral', icon = true, children, className = '' }) {
  const Icon = TONE_ICON[tone] || Circle;
  return (
    <span className={`badge ${tone} ${className}`}>
      {icon && <Icon size={13} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

// Friendlier display text for a few technical status values.
const STATUS_TEXT = { 'Under Remediation': 'Being cleaned up', Maintenance: 'In repair', Operational: 'Working' };

export function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || 'neutral';
  const text = STATUS_TEXT[status] || status;
  if (status === 'Maintenance')
    return (
      <span className="badge warning">
        <Wrench size={12} strokeWidth={2.4} />
        {text}
      </span>
    );
  return <Badge tone={tone}>{text}</Badge>;
}

export function Progress({ value = 0, tone = '', size = '', label }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={`progress ${tone} ${size}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

// Circular meter for a single percentage.
export function Gauge({ value = 0, size = 92, stroke = 9, color = 'var(--brand)', track = 'var(--surface-2)', label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div className="gauge-label">
        <div>
          <b>{label ?? `${fmtNum(v, 0)}%`}</b>
          {sub && <small>{sub}</small>}
        </div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function Empty({ title = 'Nothing here yet', message, icon: Icon = Inbox, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={22} />
      </div>
      <b>{title}</b>
      {message && <p>{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="error-box">
      <OctagonAlert size={18} color="var(--critical)" />
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

export function PageSkeleton({ cards = 4 }) {
  return (
    <div className="stack">
      <div className="grid grid-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} height={128} />
        ))}
      </div>
      <div className="grid grid-2-1">
        <Skeleton height={340} />
        <Skeleton height={340} />
      </div>
    </div>
  );
}

export function RangeTabs({ value, onChange, presets = RANGE_PRESETS }) {
  return (
    <div className="segmented" role="tablist" aria-label="Time range">
      {presets.map((p) => (
        <button key={p.days} role="tab" aria-selected={value === p.days} className={value === p.days ? 'on' : ''} onClick={() => onChange(p.days)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label} className="legend-item">
          <span className="swatch" style={{ background: i.color }} />
          {i.label}
          {i.value !== undefined && <b className="num" style={{ color: 'var(--text)' }}>{i.value}</b>}
        </span>
      ))}
    </div>
  );
}

export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = (v) => fmtNum(v, 1), total }) {
  if (!active || !payload?.length) return null;
  const sum = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div className="chart-tip">
      <div className="tip-title">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      {[...payload].reverse().map((p) => (
        <div className="tip-row" key={p.dataKey}>
          <span className="row" style={{ gap: 7 }}>
            <span className="swatch" style={{ background: p.color || p.payload?.fill }} />
            {p.name}
          </span>
          <b>{valueFormatter(p.value, p)}</b>
        </div>
      ))}
      {total && payload.length > 1 && (
        <div className="tip-row tip-total">
          <span>Total</span>
          <b>{valueFormatter(sum)}</b>
        </div>
      )}
    </div>
  );
}
