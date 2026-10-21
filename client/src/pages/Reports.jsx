import { useState } from 'react';
import { BarChart3, Download, Factory, Mountain, Printer, Recycle, Scale } from 'lucide-react';
import { get } from '../api';
import { useAsync } from '../hooks/useAsync';
import { Badge, Card, ErrorBox, Legend, PageHeader, PageSkeleton, StatCard, StatusBadge } from '../components/ui';
import { RankBarChart, RateLineChart, StreamBarChart, StreamLegend } from '../components/charts';
import { useTheme } from '../context/ThemeContext';
import { capacityTone, daysAgoInput, downloadCSV, fmtCompact, fmtMonth, fmtNum, fmtPct, rateTone, todayInput } from '../utils/format';

const TABS = [
  { key: 'wards', label: 'Wards' },
  { key: 'plants', label: 'Plants' },
  { key: 'landfills', label: 'Landfills' },
  { key: 'vehicles', label: 'Vehicles' },
];

// Column definitions shared by the on-screen tables and the CSV export.
const COLUMNS = {
  wards: [
    { label: 'Ward', value: 'name' },
    { label: 'Zone', value: 'zone' },
    { label: 'People', value: 'population', compact: true },
    { label: 'Collected (t)', value: (r) => r.stats.totalTonnes, num: 0 },
    { label: 'Homes covered %', value: (r) => r.stats.coverage, num: 0 },
    { label: 'Segregated %', value: (r) => r.stats.segregationRate, rate: true },
  ],
  plants: [
    { label: 'Plant', value: 'name' },
    { label: 'Type', value: 'type' },
    { label: 'Status', value: 'status', status: true },
    { label: 'Received (t)', value: (r) => r.stats.inputTonnes, num: 0 },
    { label: 'Recycled (t)', value: (r) => r.stats.recoveredTonnes, num: 0 },
    { label: 'Capacity used %', value: (r) => r.stats.utilization, num: 0 },
  ],
  landfills: [
    { label: 'Landfill', value: 'name' },
    { label: 'Status', value: 'status', status: true },
    { label: 'Full %', value: (r) => r.stats.utilization, capacity: true },
    { label: 'Waste in (t)', value: (r) => r.stats.inflowTonnes, num: 0 },
    { label: 'Years left', value: (r) => r.stats.estimatedLifeYears ?? '', num: 0 },
  ],
  vehicles: [
    { label: 'Vehicle', value: 'registrationNo' },
    { label: 'Type', value: 'type' },
    { label: 'Ward', value: (r) => r.ward?.name || '' },
    { label: 'Status', value: 'status', status: true },
    { label: 'Trips', value: (r) => r.stats.trips, num: 0 },
    { label: 'Tonnes', value: (r) => r.stats.tonnes, num: 0 },
    { label: 'Fuel / tonne (L)', value: (r) => r.stats.fuelPerTonne, num: 2 },
  ],
};

const cellValue = (c, r) => (typeof c.value === 'function' ? c.value(r) : r[c.value]);

function renderCell(c, r) {
  const v = cellValue(c, r);
  if (c.status) return <StatusBadge status={v} />;
  if (c.rate) return <Badge tone={rateTone(v)}>{fmtPct(v)}</Badge>;
  if (c.capacity) return <Badge tone={capacityTone(v)}>{fmtPct(v)}</Badge>;
  if (c.compact) return fmtCompact(v);
  if (c.num !== undefined) return v === '' ? '—' : fmtNum(v, c.num);
  return v;
}

const isNumeric = (c) => c.num !== undefined || c.compact;

export default function Reports() {
  const { chart } = useTheme();
  const [range, setRange] = useState({ from: daysAgoInput(119), to: todayInput() });
  const [tab, setTab] = useState('wards');
  const { data, loading, error, reload } = useAsync(() => get('/analytics/report', range), [range]);

  const exportTab = () => {
    if (!data) return;
    downloadCSV(
      `cleancity_${tab}_${range.from}_${range.to}.csv`,
      data[tab],
      COLUMNS[tab].map((c) => ({ label: c.label, value: (r) => cellValue(c, r) }))
    );
  };

  const exportMonthly = () =>
    data &&
    downloadCSV(`cleancity_monthly_${range.from}_${range.to}.csv`, data.monthly, [
      { label: 'Month', value: 'month' },
      { label: 'Wet (t)', value: 'wet' },
      { label: 'Dry (t)', value: 'dry' },
      { label: 'Hazardous (t)', value: 'hazardous' },
      { label: 'E-Waste (t)', value: 'eWaste' },
      { label: 'Mixed (t)', value: 'mixed' },
      { label: 'Total (t)', value: 'total' },
      { label: 'Recovered (t)', value: 'recovered' },
      { label: 'Landfilled (t)', value: 'landfilled' },
      { label: 'Segregation %', value: 'segregationRate' },
      { label: 'Diversion %', value: 'diversionRate' },
    ]);

  const t = data?.totals;

  return (
    <>
      <PageHeader icon={BarChart3} title="Reports" subtitle="Pick dates to see trends and download data.">
        <input className="input" type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="From date" style={{ width: 150 }} />
        <span className="muted">to</span>
        <input className="input" type="date" value={range.to} min={range.from} max={todayInput()} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="To date" style={{ width: 150 }} />
        <button className="btn" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </button>
        <button className="btn btn-primary" onClick={exportMonthly} disabled={!data}>
          <Download size={16} /> Download
        </button>
      </PageHeader>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && loading && <PageSkeleton />}

      {data && (
        <div className="stack">
          <div className="grid grid-4">
            <StatCard label="Waste collected" icon={Scale} tone="blue" value={fmtNum(t.total, 0)} unit="tonnes" foot={`${fmtNum(t.total / data.range.days, 0)} tonnes a day`} />
            <StatCard label="Segregated" icon={Recycle} value={fmtNum(t.segregationRate, 1)} unit="%" foot="Target 80%" />
            <StatCard label="Recycled" icon={Factory} tone="violet" value={fmtNum(t.recyclingRate, 1)} unit="%" foot={`${fmtNum(t.recovered, 0)} tonnes`} />
            <StatCard label="Sent to landfill" icon={Mountain} tone="amber" value={fmtNum(100 - t.diversionRate, 1)} unit="%" foot={`${fmtNum(t.landfilled, 0)} tonnes`} />
          </div>

          <div className="grid grid-1-1">
            <Card title="Waste collected per month" subtitle="In tonnes" actions={<StreamLegend />}>
              <StreamBarChart data={data.monthly} xKey="month" xFormatter={fmtMonth} />
            </Card>
            <Card
              title="Segregated vs sent to landfill"
              subtitle="% of waste collected each month"
              actions={
                <Legend
                  items={[
                    { label: 'Segregated', color: chart.series[0] },
                    { label: 'Sent to landfill', color: chart.series[1] },
                  ]}
                />
              }
            >
              <RateLineChart
                data={data.monthly.map((m) => ({ ...m, landfillShare: m.total ? Math.round((100 - m.diversionRate) * 10) / 10 : 0 }))}
                xKey="month"
                xFormatter={fmtMonth}
                domain={[0, 100]}
                series={[
                  { key: 'segregationRate', label: 'Segregated' },
                  { key: 'landfillShare', label: 'Sent to landfill' },
                ]}
              />
            </Card>
          </div>

          <div className="grid grid-2-1">
            <Card bodyClass="">
            <div className="row-between" style={{ paddingRight: 14 }}>
              <div className="tabs" role="tablist" style={{ borderBottom: 0, flex: 1 }}>
                {TABS.map((x) => (
                  <button key={x.key} role="tab" aria-selected={tab === x.key} className={`tab ${tab === x.key ? 'on' : ''}`} onClick={() => setTab(x.key)}>
                    {x.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-sm no-print" onClick={exportTab}>
                <Download size={14} /> Download
              </button>
            </div>
            <div className="table-wrap" style={{ borderTop: '1px solid var(--border)' }}>
              <table className="table">
                <thead>
                  <tr>
                    {COLUMNS[tab].map((c) => (
                      <th key={c.label} className={isNumeric(c) ? 'r' : ''}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data[tab].map((r) => (
                    <tr key={r._id}>
                      {COLUMNS[tab].map((c, i) => (
                        <td key={c.label} className={`${isNumeric(c) ? 'r' : ''} ${i === 0 ? 'cell-main' : ''}`}>
                          {renderCell(c, r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </Card>
            <Card title="Segregation by zone" subtitle="Dashed line = 80% target">
              <RankBarChart data={[...data.zones].sort((a, b) => b.segregationRate - a.segregationRate)} labelKey="zone" valueKey="segregationRate" valueLabel="Segregated" target={80} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
