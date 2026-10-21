import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Hourglass, Mountain, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { del, errMsg, get, post, put } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useEditor } from '../hooks/useEditor';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useTheme } from '../context/ThemeContext';
import { FormModal } from '../components/Modal';
import { Card, Empty, ErrorBox, Field, Legend, PageHeader, PageSkeleton, Progress, RangeTabs, StatCard, StatusBadge } from '../components/ui';
import { SimpleBarChart } from '../components/charts';
import { Feature, LandfillForm, useLandfillEditor } from './Landfills';
import { LANDFILL_WASTE_TYPES } from '../utils/constants';
import { capacityTone, fmtCompact, fmtDate, fmtNum, todayInput } from '../utils/format';

const blankEntry = () => ({ date: todayInput(), tonnes: '', wasteType: 'Mixed', sourceWard: '', vehicle: '', notes: '' });
const TYPE_SERIES = LANDFILL_WASTE_TYPES.map((t, i) => ({ key: t, label: t, slot: i }));

export default function LandfillDetail() {
  const { id } = useParams();
  const { canManage, canRecord, canDeleteRecords } = useAuth();
  const confirm = useConfirm();
  const { chart } = useTheme();
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([get('/landfills', { days }), get(`/landfills/${id}/entries`, { days })]),
    [id, days]
  );
  const lookups = useAsync(() => Promise.all([get('/wards'), get('/vehicles')]), []);
  const [wards = [], vehicles = []] = lookups.data || [];
  const [landfills, entries] = data || [];
  const lf = landfills?.find((l) => l._id === id);
  const entryEditor = useEditor(blankEntry);
  const siteEditor = useLandfillEditor();

  // Daily tonnage stacked by waste type; only types present get a series.
  const { daily, present } = useMemo(() => {
    const byDay = new Map();
    const seen = new Set();
    for (const e of entries || []) {
      const key = e.date.slice(0, 10);
      const row = byDay.get(key) || { date: key };
      row[e.wasteType] = (row[e.wasteType] || 0) + e.tonnes;
      seen.add(e.wasteType);
      byDay.set(key, row);
    }
    return {
      daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      present: TYPE_SERIES.filter((s) => seen.has(s.key)),
    };
  }, [entries]);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data && loading) return <PageSkeleton />;
  if (!lf)
    return (
      <Card>
        <Empty icon={Mountain} title="Landfill not found" action={<Link to="/landfills" className="btn">Back to landfills</Link>} />
      </Card>
    );

  const s = lf.stats;
  const closed = lf.status === 'Closed';

  const saveEntry = () =>
    entryEditor.submit((form) => post(`/landfills/${id}/entries`, form), 'Inflow recorded').then((ok) => ok && reload());
  const saveSite = () => siteEditor.submit((form) => put(`/landfills/${id}`, form), 'Landfill updated').then((ok) => ok && reload());

  const removeEntry = async (e) => {
    if (!(await confirm({ title: 'Delete this entry?', message: `${fmtNum(e.tonnes, 1)} t on ${fmtDate(e.date)} will be removed.` }))) return;
    try {
      await del(`/landfills/entries/${e._id}`);
      toast.success('Entry deleted');
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <>
      <Link to="/landfills" className="btn btn-sm btn-ghost" style={{ marginBottom: 10, marginLeft: -10 }}>
        <ArrowLeft size={15} /> All landfills
      </Link>
      <PageHeader
        icon={Mountain}
        title={lf.name}
        subtitle={
          <span className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span>{lf.location}</span>
            <StatusBadge status={lf.status} />
          </span>
        }
      >
        <RangeTabs value={days} onChange={setDays} />
        {canManage && (
          <button className="btn" onClick={() => siteEditor.open(lf)}>
            <Pencil size={15} /> Edit
          </button>
        )}
        {canRecord && !closed && (
          <button className="btn btn-primary" onClick={() => entryEditor.open()}>
            <Plus size={16} /> Add waste entry
          </button>
        )}
      </PageHeader>

      <div className="stack">
        <div className="grid grid-4">
          <StatCard label="Space used" icon={Mountain} value={fmtNum(s.utilization, 0)} unit="%" foot={`${fmtCompact(s.usedTonnes)} of ${fmtCompact(lf.totalCapacityTonnes)} tonnes`} />
          <StatCard label="Space left" icon={Mountain} tone="blue" value={fmtCompact(s.remainingTonnes)} unit="tonnes" />
          <StatCard label="Waste coming in" icon={Truck} tone="amber" value={fmtNum(s.avgDailyInflow, 0)} unit="tonnes/day" />
          <StatCard label="Years left" hint="At the current rate of dumping." icon={Hourglass} tone="violet" value={s.estimatedLifeYears === null ? '—' : fmtNum(s.estimatedLifeYears, 0)} unit="years" />
        </div>

        <div className="grid grid-2-1">
          <Card
            title="Waste dumped per day"
            subtitle="In tonnes"
            actions={present.length > 1 && <Legend items={present.map((p) => ({ label: p.label, color: chart.series[p.slot] }))} />}
          >
            {daily.length ? (
              <SimpleBarChart data={daily} xKey="date" stacked={present.length > 1} series={present} />
            ) : (
              <Empty title="No waste dumped" message={closed || lf.status === 'Under Remediation' ? 'This site is not taking new waste.' : undefined} />
            )}
          </Card>
          <Card title="About this landfill">
            <div className="mt-1">
              <div className="row-between">
                <b>How full</b>
                <span className="num">{fmtNum(s.utilization, 0)}%</span>
              </div>
              <div className="mt-1">
                <Progress value={s.utilization} tone={capacityTone(s.utilization)} size="lg" label="How full" />
              </div>
            </div>
            <dl className="info-list mt-2">
              <dt>Total capacity</dt>
              <dd>{fmtNum(lf.totalCapacityTonnes, 0)} t</dd>
              <dt>Area</dt>
              <dd>{fmtNum(lf.areaAcres, 0)} acres</dd>
              <dt>Zone</dt>
              <dd>{lf.zone || '—'}</dd>
              <dt>Opened</dt>
              <dd>{fmtDate(lf.openedOn)}</dd>
            </dl>
            <div className="chips mt-2">
              <Feature on={lf.leachateTreatment}>Water treatment</Feature>
              <Feature on={lf.methaneCapture}>Gas capture</Feature>
            </div>
          </Card>
        </div>

        <Card title="Waste entries" bodyClass="">
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="r">Tonnes</th>
                  <th>From ward</th>
                  <th>Vehicle</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id}>
                    <td className="nowrap cell-main">{fmtDate(e.date)}</td>
                    <td>{e.wasteType}</td>
                    <td className="r">
                      <b>{fmtNum(e.tonnes, 1)}</b>
                    </td>
                    <td>{e.sourceWard?.name || '—'}</td>
                    <td className="nowrap">{e.vehicle?.registrationNo || '—'}</td>
                    <td className="actions">
                      {canDeleteRecords && (
                        <button className="icon-btn danger" onClick={() => removeEntry(e)} aria-label="Delete entry">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 && <Empty title="No entries yet" />}
          </div>
        </Card>
      </div>

      <FormModal open={entryEditor.isOpen} title="Add waste entry" subtitle={lf.name} onClose={entryEditor.close} onSubmit={saveEntry} saving={entryEditor.saving}>
        <div className="form-grid">
          <Field label="Date *">
            <input className="input" type="date" required max={todayInput()} {...entryEditor.bind('date')} />
          </Field>
          <Field label="Tonnes *">
            <input className="input" type="number" min="0" step="0.01" required {...entryEditor.bind('tonnes')} />
          </Field>
          <Field label="Waste type">
            <select className="select" {...entryEditor.bind('wasteType')}>
              {LANDFILL_WASTE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="From ward">
            <select className="select" {...entryEditor.bind('sourceWard')}>
              <option value="">Not specified</option>
              {wards.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vehicle">
            <select className="select" {...entryEditor.bind('vehicle')}>
              <option value="">Not specified</option>
              {vehicles.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.registrationNo} · {v.type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <input className="input" {...entryEditor.bind('notes')} />
          </Field>
        </div>
      </FormModal>

      <FormModal open={siteEditor.isOpen} title={`Edit ${lf.name}`} onClose={siteEditor.close} onSubmit={saveSite} saving={siteEditor.saving}>
        <LandfillForm editor={siteEditor} />
      </FormModal>
    </>
  );
}
