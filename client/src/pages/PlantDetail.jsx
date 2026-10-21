import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Factory, Pencil, Plus, Recycle, Trash2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { del, errMsg, get, post, put } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useEditor } from '../hooks/useEditor';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { FormModal } from '../components/Modal';
import { Card, Empty, ErrorBox, Field, Legend, PageHeader, PageSkeleton, RangeTabs, StatCard, StatusBadge } from '../components/ui';
import { SimpleBarChart } from '../components/charts';
import { useTheme } from '../context/ThemeContext';
import { PlantForm, toPlantPayload, usePlantEditor } from './Plants';
import { fmtDate, fmtNum, todayInput } from '../utils/format';

const blankLog = () => ({ date: todayInput(), inputTonnes: '', processedTonnes: '', rejectTonnes: '', recoveredTonnes: '', downtimeHours: 0, energyKwh: '', notes: '' });

export default function PlantDetail() {
  const { id } = useParams();
  const { canManage, canRecord, canDeleteRecords } = useAuth();
  const confirm = useConfirm();
  const { chart } = useTheme();
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([get('/plants', { days }), get(`/plants/${id}/logs`, { days })]),
    [id, days]
  );
  const [plants, logs] = data || [];
  const plant = plants?.find((p) => p._id === id);
  const logEditor = useEditor(blankLog);
  const plantEditor = usePlantEditor();

  const series = useMemo(
    () =>
      [...(logs || [])]
        .reverse()
        .map((l) => ({ date: l.date, recovered: l.recoveredTonnes, rejects: l.rejectTonnes, input: l.inputTonnes })),
    [logs]
  );

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data && loading) return <PageSkeleton />;
  if (!plant)
    return (
      <Card>
        <Empty icon={Factory} title="Plant not found" action={<Link to="/plants" className="btn">Back to plants</Link>} />
      </Card>
    );

  const s = plant.stats;

  const saveLog = () =>
    logEditor.submit((form) => post(`/plants/${id}/logs`, form), 'Daily log recorded').then((ok) => ok && reload());
  const savePlant = () =>
    plantEditor.submit((form) => put(`/plants/${id}`, toPlantPayload(form)), 'Plant updated').then((ok) => ok && reload());

  const removeLog = async (l) => {
    if (!(await confirm({ title: 'Delete this log?', message: `Log for ${fmtDate(l.date)} will be removed.` }))) return;
    try {
      await del(`/plants/logs/${l._id}`);
      toast.success('Log deleted');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <Link to="/plants" className="btn btn-sm btn-ghost" style={{ marginBottom: 10, marginLeft: -10 }}>
        <ArrowLeft size={15} /> All plants
      </Link>
      <PageHeader
        icon={Factory}
        title={plant.name}
        subtitle={
          <span className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span>{plant.type}</span>
            <StatusBadge status={plant.status} />
          </span>
        }
      >
        <RangeTabs value={days} onChange={setDays} />
        {canManage && (
          <button className="btn" onClick={() => plantEditor.open(plant)}>
            <Pencil size={15} /> Edit
          </button>
        )}
        {canRecord && (
          <button className="btn btn-primary" onClick={() => logEditor.open()}>
            <Plus size={16} /> Add daily entry
          </button>
        )}
      </PageHeader>

      <div className="stack">
        <div className="grid grid-4">
          <StatCard label="Capacity used" icon={Factory} value={fmtNum(s.utilization, 0)} unit="%" foot={`${fmtNum(s.avgDailyInput, 0)} of ${plant.capacityTPD} tonnes/day`} />
          <StatCard label="Recycled" icon={Recycle} tone="violet" value={fmtNum(s.recoveryRate, 0)} unit="%" foot={`${fmtNum(s.recoveredTonnes, 0)} tonnes`} />
          <StatCard label="Running time" hint="Share of time the plant was working (not broken down)." icon={Clock} tone="blue" value={fmtNum(s.uptime, 0)} unit="%" foot={`${fmtNum(s.downtimeHours, 0)} hours stopped`} />
          {s.energyKwh > 0 ? (
            <StatCard label="Electricity made" icon={Zap} tone="amber" value={fmtNum(s.energyKwh / 1000, 0)} unit="MWh" />
          ) : (
            <StatCard label="Leftover waste" hint="Waste the plant could not use, sent to landfill." icon={Trash2} tone="amber" value={fmtNum(s.rejectTonnes, 0)} unit="tonnes" />
          )}
        </div>

        <div className="grid grid-2-1">
          <Card title="Daily output" subtitle="Tonnes recycled vs left over" actions={<Legend items={[{ label: 'Recycled', color: chart.series[0] }, { label: 'Left over', color: chart.series[1] }]} />}>
            <SimpleBarChart
              data={series}
              xKey="date"
              stacked
              series={[
                { key: 'recovered', label: 'Recycled', slot: 0 },
                { key: 'rejects', label: 'Left over', slot: 1 },
              ]}
            />
          </Card>
          <Card title="About this plant">
            <dl className="info-list">
              <dt>Type</dt>
              <dd>{plant.type}</dd>
              <dt>Capacity</dt>
              <dd>{plant.capacityTPD} tonnes/day</dd>
              <dt>Location</dt>
              <dd>{plant.location || '—'}</dd>
              <dt>Run by</dt>
              <dd>{plant.operator || '—'}</dd>
              <dt>Contact</dt>
              <dd>{plant.contactPerson || '—'}</dd>
              <dt>Started</dt>
              <dd>{fmtDate(plant.commissionedOn)}</dd>
            </dl>
            <div className="chips mt-2">
              {plant.materials?.map((m) => (
                <span key={m} className="chip">
                  {m}
                </span>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Daily entries" bodyClass="" className="">
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="r">Received (t)</th>
                  <th className="r">Recycled (t)</th>
                  <th className="r">Left over (t)</th>
                  <th className="r">Stopped (hours)</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l._id}>
                    <td className="nowrap cell-main">{fmtDate(l.date)}</td>
                    <td className="r">{fmtNum(l.inputTonnes, 1)}</td>
                    <td className="r">{fmtNum(l.recoveredTonnes, 1)}</td>
                    <td className="r">{fmtNum(l.rejectTonnes, 1)}</td>
                    <td className="r">{l.downtimeHours || '—'}</td>
                    <td className="text-2">{l.notes || ''}</td>
                    <td className="actions">
                      {canDeleteRecords && (
                        <button className="icon-btn danger" onClick={() => removeLog(l)} aria-label="Delete log">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <Empty title="No entries yet" />}
          </div>
        </Card>
      </div>

      <FormModal open={logEditor.isOpen} title="Add daily entry" subtitle={plant.name} onClose={logEditor.close} onSubmit={saveLog} saving={logEditor.saving}>
        <div className="form-grid">
          <Field label="Date *">
            <input className="input" type="date" required max={todayInput()} {...logEditor.bind('date')} />
          </Field>
          <Field label="Waste received (tonnes) *">
            <input className="input" type="number" min="0" step="0.01" required {...logEditor.bind('inputTonnes')} />
          </Field>
          <Field label="Left over (tonnes)" hint="Waste that could not be used">
            <input className="input" type="number" min="0" step="0.01" {...logEditor.bind('rejectTonnes')} />
          </Field>
          <Field label="Hours stopped">
            <input className="input" type="number" min="0" max="24" step="0.5" {...logEditor.bind('downtimeHours')} />
          </Field>
          {plant.type === 'Waste-to-Energy' && (
            <Field label="Electricity made (kWh)">
              <input className="input" type="number" min="0" {...logEditor.bind('energyKwh')} />
            </Field>
          )}
          <Field label="Notes">
            <input className="input" {...logEditor.bind('notes')} />
          </Field>
        </div>
      </FormModal>

      <FormModal open={plantEditor.isOpen} title={`Edit ${plant.name}`} onClose={plantEditor.close} onSubmit={savePlant} saving={plantEditor.saving}>
        <PlantForm editor={plantEditor} />
      </FormModal>
    </>
  );
}
