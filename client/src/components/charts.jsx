import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { STREAMS, useStreamColors, useTheme } from '../context/ThemeContext';
import { ChartTooltip, Legend } from './ui';
import { fmtDay, fmtNum, fmtPct } from '../utils/format';

const axisProps = (chart) => ({
  tick: { fill: chart.tick, fontSize: 11.5 },
  tickLine: false,
  axisLine: { stroke: chart.axis },
});

export function StreamLegend({ streams = STREAMS }) {
  const colors = useStreamColors();
  return <Legend items={streams.map((s) => ({ label: s.label, color: colors[s.key] }))} />;
}

/** Stacked area of the five waste streams over time. */
export function StreamAreaChart({ data, xKey = 'date', xFormatter = fmtDay, height = 'chart-box' }) {
  const { chart } = useTheme();
  const colors = useStreamColors();
  return (
    <div className={height}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis dataKey={xKey} tickFormatter={xFormatter} minTickGap={28} {...axisProps(chart)} />
          <YAxis {...axisProps(chart)} axisLine={false} width={52} tickFormatter={(v) => fmtNum(v, 0)} />
          <Tooltip
            content={<ChartTooltip total labelFormatter={xFormatter} valueFormatter={(v) => `${fmtNum(v, 1)} t`} />}
            cursor={{ stroke: chart.axis, strokeWidth: 1 }}
          />
          {STREAMS.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId="1"
              stroke={chart.surface}
              strokeWidth={1.5}
              fill={colors[s.key]}
              fillOpacity={0.92}
              activeDot={{ r: 4, stroke: chart.surface, strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Stacked bars of waste streams, used for monthly summaries. */
export function StreamBarChart({ data, xKey, xFormatter, height = 'chart-box' }) {
  const { chart } = useTheme();
  const colors = useStreamColors();
  return (
    <div className={height}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis dataKey={xKey} tickFormatter={xFormatter} {...axisProps(chart)} />
          <YAxis {...axisProps(chart)} axisLine={false} width={60} tickFormatter={(v) => fmtNum(v, 0)} />
          <Tooltip
            content={<ChartTooltip total labelFormatter={xFormatter} valueFormatter={(v) => `${fmtNum(v, 1)} t`} />}
            cursor={{ fill: chart.grid, opacity: 0.5 }}
          />
          {STREAMS.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="1"
              fill={colors[s.key]}
              stroke={chart.surface}
              strokeWidth={2}
              radius={i === STREAMS.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Percentage series over time against a target line. `series` = [{ key, label }],
 * colored by categorical slot order.
 */
export function RateLineChart({ data, series, xKey = 'date', xFormatter = fmtDay, target, domain = [0, 100], height = 'chart-box' }) {
  const { chart } = useTheme();
  return (
    <div className={height}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis dataKey={xKey} tickFormatter={xFormatter} minTickGap={28} {...axisProps(chart)} />
          <YAxis domain={domain} {...axisProps(chart)} axisLine={false} width={48} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            content={<ChartTooltip labelFormatter={xFormatter} valueFormatter={(v) => fmtPct(v)} />}
            cursor={{ stroke: chart.axis, strokeWidth: 1 }}
          />
          {target !== undefined && (
            <ReferenceLine
              y={target}
              stroke={chart.target}
              strokeDasharray="4 4"
              label={{ value: `Target ${target}%`, position: 'insideTopRight', fill: chart.textMuted, fontSize: 11.5 }}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={chart.series[s.slot ?? i]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4.5, stroke: chart.surface, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranked bars for a percentage metric with an optional target reference. */
export function RankBarChart({ data, labelKey, valueKey, valueLabel, target, max = 100, unit = '%' }) {
  const { chart } = useTheme();
  const h = Math.max(220, data.length * 30 + 30);
  return (
    <div style={{ width: '100%', height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 0, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={chart.grid} />
          <XAxis type="number" domain={[0, max]} {...axisProps(chart)} tickFormatter={(v) => `${v}${unit}`} />
          <YAxis type="category" dataKey={labelKey} width={150} {...axisProps(chart)} axisLine={false} interval={0} />
          <Tooltip
            content={<ChartTooltip valueFormatter={(v) => `${fmtNum(v, 1)}${unit}`} />}
            cursor={{ fill: chart.grid, opacity: 0.5 }}
          />
          {target !== undefined && <ReferenceLine x={target} stroke={chart.target} strokeDasharray="4 4" />}
          <Bar dataKey={valueKey} name={valueLabel} fill={chart.series[0]} radius={[0, 4, 4, 0]} maxBarSize={16}>
            <LabelList dataKey={valueKey} position="right" formatter={(v) => `${fmtNum(v, 0)}${unit}`} style={{ fill: chart.textMuted, fontSize: 11.5 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vertical single-series bars (e.g. daily inflow or input). */
export function SimpleBarChart({ data, xKey, series, xFormatter = fmtDay, unit = 't', height = 'chart-box', stacked = false }) {
  const { chart } = useTheme();
  return (
    <div className={height}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis dataKey={xKey} tickFormatter={xFormatter} minTickGap={24} {...axisProps(chart)} />
          <YAxis {...axisProps(chart)} axisLine={false} width={52} tickFormatter={(v) => fmtNum(v, 0)} />
          <Tooltip
            content={<ChartTooltip total={stacked} labelFormatter={xFormatter} valueFormatter={(v) => `${fmtNum(v, 1)} ${unit}`} />}
            cursor={{ fill: chart.grid, opacity: 0.5 }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? '1' : undefined}
              fill={chart.series[s.slot ?? i]}
              stroke={stacked ? chart.surface : undefined}
              strokeWidth={stacked ? 1 : 0}
              radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={22}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Part-to-whole donut for waste composition; centre shows the total. */
export function CompositionDonut({ data, size = 210 }) {
  const { chart } = useTheme();
  const colors = useStreamColors();
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div style={{ position: 'relative', width: '100%', height: size }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="94%" paddingAngle={1.5} stroke={chart.surface} strokeWidth={2} startAngle={90} endAngle={-270}>
              {data.map((d) => (
                <Cell key={d.key} fill={colors[d.key]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `${fmtNum(v, 1)} t · ${fmtPct((v / total) * 100)}`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="gauge-label" style={{ pointerEvents: 'none' }}>
          <div>
            <b style={{ fontSize: 22 }}>{fmtNum(total, 0)}</b>
            <small>tonnes</small>
          </div>
        </div>
      </div>
      <div className="mt-2">
        {data.map((d) => (
          <div key={d.key} className="row-between" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
            <span className="legend-item text-2">
              <span className="swatch" style={{ background: colors[d.key] }} />
              {d.name}
            </span>
            <span className="num">
              <b>{fmtNum(d.value, 0)} t</b>
              <span className="muted" style={{ marginLeft: 8, display: 'inline-block', minWidth: 46, textAlign: 'right' }}>
                {fmtPct(total ? (d.value / total) * 100 : 0)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
