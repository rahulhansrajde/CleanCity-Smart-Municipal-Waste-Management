import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Factory, Gauge as Gauge2, MapPin, Pencil, Plus, Recycle, Search, Trash2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { del, errMsg, get, post, put } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useEditor } from '../hooks/useEditor';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useTheme } from '../context/ThemeContext';
import { FormModal } from '../components/Modal';
import { Card, Empty, ErrorBox, Field, Gauge, PageHeader, RangeTabs, Skeleton, StatCard, StatusBadge } from '../components/ui';
import { PLANT_STATUS, PLANT_TYPES, ZONES } from '../utils/constants';
import { fmtNum, fmtPct, toInputDate } from '../utils/format';

const blank = {
  code: '',
  name: '',
  type: 'Composting',
  location: '',
  zone: 'North',
  capacityTPD: '',
  materials: '',
  status: 'Operational',
  operator: '',
  contactPerson: '',
  commissionedOn: '',
};
const fromDoc = (p) => ({ ...p, materials: (p.materials || []).join(', '), commissionedOn: toInputDate(p.commissionedOn) });
export const toPlantPayload = (form) => ({
  ...form,
  materials: String(form.materials || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});

export function PlantForm({ editor }) {
  return (
    <div className="form-grid">
      <Field label="Plant code *">
        <input className="input" required placeholder="RP-08" {...editor.bind('code')} />
      </Field>
      <Field label="Plant name *">
        <input className="input" required {...editor.bind('name')} />
      </Field>
      <Field label="Type *">
        <select className="select" required {...editor.bind('type')}>
          {PLANT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Capacity (tonnes/day) *">
        <input className="input" type="number" min="0.1" step="0.1" required {...editor.bind('capacityTPD')} />
      </Field>
      <Field label="Zone">
        <select className="select" {...editor.bind('zone')}>
          {ZONES.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select className="select" {...editor.bind('status')}>
          {PLANT_STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Location" className="full">
        <input className="input" {...editor.bind('location')} />
      </Field>
      <Field label="Materials" hint="Separate with commas, e.g. Plastic, Paper" className="full">
        <input className="input" {...editor.bind('materials')} />
      </Field>
      <Field label="Run by">
        <input className="input" {...editor.bind('operator')} />
      </Field>
      <Field label="Contact person">
        <input className="input" {...editor.bind('contactPerson')} />
      </Field>
      <Field label="Started on">
        <input className="input" type="date" {...editor.bind('commissionedOn')} />
      </Field>
    </div>
  );
}

export function usePlantEditor() {
  return useEditor(blank, fromDoc);
}

export default function Plants() {
  const { canManage, isAdmin } = useAuth();
  const confirm = useConfirm();
  const { chart } = useTheme();
  const [days, setDays] = useState(30);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const { data, loading, error, reload } = useAsync(() => get('/plants', { days }), [days]);
  const editor = usePlantEditor();

  const list = useMemo(
    () => (data || []).filter((p) => (!type || p.type === type) && (!q || `${p.code} ${p.name} ${p.location}`.toLowerCase().includes(q.toLowerCase()))),
    [data, q, type]
  );

  const k = useMemo(() => {
    const all = data || [];
    const op = all.filter((p) => p.status === 'Operational');
    const cap = all.reduce((s, p) => s + p.capacityTPD, 0);
    const opCap = op.reduce((s, p) => s + p.capacityTPD, 0);
    const input = op.reduce((s, p) => s + p.stats.avgDailyInput, 0);
    const processed = all.reduce((s, p) => s + p.stats.processedTonnes, 0);
    const recovered = all.reduce((s, p) => s + p.stats.recoveredTonnes, 0);
    return {
      cap,
      count: all.length,
      operational: op.length,
      utilization: opCap ? (input / opCap) * 100 : 0,
      recovered,
      recovery: processed ? (recovered / processed) * 100 : 0,
      energy: all.reduce((s, p) => s + p.stats.energyKwh, 0),
    };
  }, [data]);

  const save = () =>
    editor.submit(
      (form, editing) => (editing ? put(`/plants/${editing._id}`, toPlantPayload(form)) : post('/plants', toPlantPayload(form))),
      editor.editing ? 'Plant updated' : 'Plant registered'
    ).then((ok) => ok && reload());

  const remove = async (p) => {
    if (!(await confirm({ title: `Delete ${p.name}?`, message: 'The plant and all of its daily throughput logs will be permanently deleted.' }))) return;
    try {
      await del(`/plants/${p._id}`);
      toast.success('Plant deleted');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <PageHeader icon={Factory} title="Recycling Plants" subtitle="Plants that turn waste into compost, material or energy.">
        <RangeTabs value={days} onChange={setDays} />
        {canManage && (
          <button className="btn btn-primary" onClick={() => editor.open()}>
            <Plus size={16} /> Add plant
          </button>
        )}
      </PageHeader>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Plants working" icon={Factory} value={`${k.operational} of ${k.count}`} foot={`Can handle ${fmtNum(k.cap, 0)} tonnes/day`} />
        <StatCard label="Capacity used" hint="How much of the plants' daily capacity is being used." icon={Gauge2} tone="blue" value={fmtNum(k.utilization, 0)} unit="%" />
        <StatCard label="Recycled" icon={Recycle} tone="violet" value={fmtNum(k.recovered, 0)} unit="tonnes" foot={`${fmtPct(k.recovery, 0)} of waste received`} />
        <StatCard label="Electricity made" icon={Zap} tone="amber" value={fmtNum(k.energy / 1000, 0)} unit="MWh" foot="From waste-to-energy" />
      </div>

      <div className="filters">
        <div className="input-icon grow">
          <Search size={16} />
          <input className="input" placeholder="Search plants…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Plant type">
          <option value="">All types</option>
          {PLANT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="grid cards-auto">
        {!data && loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={280} />)}
        {list.map((p) => (
          <article className="card entity-card" key={p._id}>
            <div className="ec-head">
              <div style={{ minWidth: 0 }}>
                <div className="ec-code">{p.type}</div>
                <h3>{p.name}</h3>
                <div className="cell-sub row" style={{ gap: 5, marginTop: 4 }}>
                  <MapPin size={13} /> {p.location || '—'}
                </div>
                <div className="mt-1">
                  <StatusBadge status={p.status} />
                </div>
              </div>
              <Gauge value={p.stats.utilization} color={chart.series[0]} sub="in use" size={88} />
            </div>
            <div className="ec-body">
              <dl className="kv">
                <div>
                  <dt>Capacity</dt>
                  <dd>{fmtNum(p.capacityTPD, 0)} t/day</dd>
                </div>
                <div>
                  <dt>Receives</dt>
                  <dd>{fmtNum(p.stats.avgDailyInput, 0)} t/day</dd>
                </div>
                <div>
                  <dt>Recycled</dt>
                  <dd>{fmtPct(p.stats.recoveryRate, 0)}</dd>
                </div>
              </dl>
              <div className="chips mt-2">
                {p.materials?.map((m) => (
                  <span className="chip" key={m}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <div className="ec-foot">
              <Link className="btn btn-sm btn-ghost" to={`/plants/${p._id}`}>
                Details <ArrowRight size={14} />
              </Link>
              <div>
                {canManage && (
                  <button className="icon-btn" onClick={() => editor.open(p)} aria-label="Edit plant">
                    <Pencil size={15} />
                  </button>
                )}
                {isAdmin && (
                  <button className="icon-btn danger" onClick={() => remove(p)} aria-label="Delete plant">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {data && list.length === 0 && (
        <Card>
          <Empty icon={Factory} title="No plants found" />
        </Card>
      )}

      <FormModal open={editor.isOpen} title={editor.editing ? `Edit ${editor.editing.name}` : 'Register processing plant'} onClose={editor.close} onSubmit={save} saving={editor.saving}>
        <PlantForm editor={editor} />
      </FormModal>
    </>
  );
}
