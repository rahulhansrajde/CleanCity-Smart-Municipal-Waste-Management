import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, Factory, FileText, Mountain, Plus, Recycle, RefreshCw, Scale, Trash2 } from 'lucide-react';
import { get } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Badge, Card, Empty, ErrorBox, Gauge, PageSkeleton, Progress, RangeTabs, StatCard } from '../components/ui';
import { CompositionDonut, RankBarChart, StreamAreaChart, StreamLegend } from '../components/charts';
import { capacityTone, fmtNum, fmtPct } from '../utils/format';
import { LEVEL_LABEL } from '../utils/constants';

const MODULE_LINK = { landfills: '/landfills', plants: '/plants', wards: '/wards', fleet: '/fleet', segregation: '/segregation', requests: '/requests' };

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAsync(() => get('/analytics/overview', { days }), [days]);

  return (
    <>
      <div className="toolbar">
        <span className="text-2">Showing the last {days} days</span>
        <div className="row">
          <RangeTabs value={days} onChange={setDays} />
          <button className="icon-btn bordered" onClick={reload} aria-label="Refresh" title="Refresh">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && loading && <PageSkeleton />}
      {data && <DashboardBody data={data} days={days} />}
    </>
  );
}

function Hero({ kpis, days }) {
  const { user, canRecord } = useAuth();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const onTarget = kpis.segregationRate >= 80;

  return (
    <section className="hero">
      <div>
        <h1>
          {greet}, {user?.name?.split(' ')[0]}
        </h1>
        <p>
          The city collected <b>{fmtNum(kpis.avgDailyCollected, 0)} tonnes a day</b> in the last {days} days.
        </p>
        <div className="hero-actions">
          {canRecord && (
            <Link to="/segregation?new=1" className="btn btn-hero">
              <Plus size={16} /> Add collection
            </Link>
          )}
          <Link to="/reports" className="btn btn-hero-ghost">
            <FileText size={16} /> Reports
          </Link>
        </div>
      </div>

      <div className="hero-score">
        <Gauge value={kpis.segregationRate} size={112} stroke={11} color="#d8b4fe" track="rgba(255,255,255,0.12)" label={`${fmtNum(kpis.segregationRate, 0)}%`} />
        <div className="score-lines">
          <div className="score-title">Segregation</div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{onTarget ? 'On target' : `${fmtNum(80 - kpis.segregationRate, 1)}% below target`}</div>
          <div style={{ color: '#d0c4f0', fontSize: 13 }}>Target is 80% of waste separated at home.</div>
        </div>
      </div>
    </section>
  );
}

function WasteFlow({ kpis, composition }) {
  const { chart } = useTheme();
  const total = kpis.totalCollected || 0;
  const mixed = composition.find((c) => c.key === 'mixed')?.value || 0;
  const steps = [
    { label: 'Collected', value: total, color: chart.series[0], icon: Scale },
    { label: 'Separated at home', value: total - mixed, color: chart.series[2], icon: Recycle },
    { label: 'Recycled', value: kpis.recoveredTonnes, color: chart.series[5], icon: Factory },
    { label: 'Sent to landfill', value: kpis.landfilledTonnes, color: chart.series[1], icon: Trash2 },
  ];
  return (
    <Card title="Where the waste goes">
      {steps.map((s) => {
        const share = total ? (s.value / total) * 100 : 0;
        return (
          <div className="flow-step" key={s.label}>
            <div className="flow-head">
              <span className="flow-dot" style={{ background: s.color }}>
                <s.icon size={16} />
              </span>
              <div className="meta">
                <b>{s.label}</b>
              </div>
              <div className="flow-val">
                <b>{fmtNum(s.value, 0)} t</b>
                <small>{fmtPct(share, 0)}</small>
              </div>
            </div>
            <div className="flow-bar">
              <span style={{ width: `${Math.min(100, share)}%`, background: s.color }} />
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function DashboardBody({ data, days }) {
  const { chart } = useTheme();
  const { kpis, trend, composition, wards, landfills, alerts } = data;
  const blue = chart.series[0];
  // Rolling mean keeps sparklines readable at tile size.
  const smooth = (vals) => {
    const w = vals.length > 14 ? 5 : 1;
    return vals.slice(w - 1).map((_, i) => vals.slice(i, i + w).reduce((a, b) => a + b, 0) / w);
  };
  const spark = (fn) => smooth(trend.map(fn));
  const landfillShare = Math.max(0, 100 - kpis.diversionRate);

  return (
    <div className="stack">
      <Hero kpis={kpis} days={days} />

      <div className="grid grid-4">
        <StatCard
          label="Waste collected"
          hint="Total waste picked up from all wards."
          icon={Scale}
          tone="blue"
          value={fmtNum(kpis.totalCollected, 0)}
          unit="tonnes"
          delta={kpis.collectedChange}
          goodWhen="neutral"
          spark={spark((d) => d.total)}
          sparkColor={blue}
          foot={`${fmtNum(kpis.avgDailyCollected, 0)} tonnes a day`}
        />
        <StatCard
          label="Segregated"
          hint="Waste already separated into wet, dry and other types by households."
          icon={Recycle}
          value={fmtNum(kpis.segregationRate, 1)}
          unit="%"
          delta={kpis.segregationChange}
          deltaUnit=" pts"
          spark={spark((d) => d.segregationRate)}
          sparkColor={blue}
          foot="Target 80%"
        />
        <StatCard
          label="Recycled"
          hint="Waste turned into compost, recyclable material or energy."
          icon={Factory}
          tone="violet"
          value={fmtNum(kpis.recyclingRate, 1)}
          unit="%"
          delta={kpis.recyclingChange}
          deltaUnit=" pts"
          spark={spark((d) => d.recyclingRate)}
          sparkColor={blue}
          foot={`${fmtNum(kpis.recoveredTonnes, 0)} tonnes`}
        />
        <StatCard
          label="Sent to landfill"
          hint="Waste dumped at landfill sites. Lower is better."
          icon={Mountain}
          tone="amber"
          value={fmtNum(landfillShare, 1)}
          unit="%"
          delta={kpis.diversionChange === null ? null : -kpis.diversionChange}
          deltaUnit=" pts"
          goodWhen="down"
          spark={spark((d) => (d.total ? 100 - d.diversionRate : 0))}
          sparkColor={blue}
          foot={`${fmtNum(kpis.landfilledTonnes, 0)} tonnes`}
        />
      </div>

      <div className="grid grid-2-1">
        <Card title="Waste collected per day" subtitle="In tonnes" actions={<StreamLegend />}>
          <StreamAreaChart data={trend} height="chart-box lg" />
        </Card>
        <Card title="Types of waste">
          <CompositionDonut data={composition} size={190} />
        </Card>
      </div>

      <div className="grid grid-1-1">
        <WasteFlow kpis={kpis} composition={composition} />
        <Card title="Needs attention">
          {alerts.length === 0 ? (
            <Empty icon={BellRing} title="All good" message="Nothing needs attention." />
          ) : (
            alerts.map((a, i) => (
              <Link to={MODULE_LINK[a.module] || '/'} className="alert-item" key={i} style={{ color: 'inherit' }}>
                <span className={`alert-icon ${a.level}`}>
                  <BellRing size={16} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{a.title}</b>
                  <p>{a.message}</p>
                </div>
                <Badge tone={a.level}>{LEVEL_LABEL[a.level]}</Badge>
              </Link>
            ))
          )}
        </Card>
      </div>

      <div className="grid grid-1-1">
        <Card
          title="Segregation by ward"
          subtitle="Dashed line = 80% target"
          actions={
            <Link to="/wards" className="btn btn-sm btn-ghost">
              All wards <ArrowRight size={14} />
            </Link>
          }
        >
          <RankBarChart data={wards.map((w) => ({ ...w, label: w.name }))} labelKey="label" valueKey="segregationRate" valueLabel="Segregated" target={80} />
        </Card>
        <Card
          title="Landfill space used"
          actions={
            <Link to="/landfills" className="btn btn-sm btn-ghost">
              All landfills <ArrowRight size={14} />
            </Link>
          }
        >
          {landfills.map((l) => (
            <div className="meter-row" key={l._id}>
              <div style={{ minWidth: 0 }}>
                <div className="meter-name">{l.name}</div>
                <div className="meter-sub">
                  {l.estimatedLifeYears !== null ? `About ${fmtNum(l.estimatedLifeYears, 0)} years left` : 'Not taking waste'}
                </div>
              </div>
              <b className="num">{fmtPct(l.utilization, 0)} full</b>
              <Progress value={l.utilization} tone={capacityTone(l.utilization)} label={`${l.name} space used`} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
