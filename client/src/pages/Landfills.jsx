import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Hourglass, MapPin, Mountain, Pencil, Plus, Trash2, Truck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { del, errMsg, get, post, put } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useEditor } from '../hooks/useEditor';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { FormModal } from '../components/Modal';
import { Card, Empty, ErrorBox, Field, FillTank, PageHeader, Progress, RangeTabs, Skeleton, StatCard, StatusBadge } from '../components/ui';
import { LANDFILL_STATUS, ZONES } from '../utils/constants';
import { capacityTone, fmtCompact, fmtNum, fmtPct, toInputDate } from '../utils/format';

const blank = {
  code: '',
  name: '',
  location: '',
  zone: 'North',
  totalCapacityTonnes: '',
  baseUsedTonnes: 0,
  areaAcres: '',
  status: 'Active',
  openedOn: '',
  leachateTreatment: false,
  methaneCapture: false,
  cells: 1,
};
const fromDoc = (l) => ({ ...l, openedOn: toInputDate(l.openedOn) });

export function useLandfillEditor() {
  return useEditor(blank, fromDoc);
}

export function LandfillForm({ editor }) {
  return (
    <div className="form-grid">
      <Field label="Code *">
        <input className="input" required placeholder="LF-04" {...editor.bind('code')} />
      </Field>
      <Field label="Name *">
        <input className="input" required {...editor.bind('name')} />
      </Field>
      <Field label="Location" className="full">
        <input className="input" {...editor.bind('location')} />
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
          {LANDFILL_STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Total capacity (tonnes) *">
        <input className="input" type="number" min="1" required {...editor.bind('totalCapacityTonnes')} />
      </Field>
      <Field label="Already filled (tonnes)">
        <input className="input" type="number" min="0" {...editor.bind('baseUsedTonnes')} />
      </Field>
      <Field label="Area (acres)">
        <input className="input" type="number" min="0" step="0.1" {...editor.bind('areaAcres')} />
      </Field>
      <Field label="Cells">
        <input className="input" type="number" min="0" {...editor.bind('cells')} />
      </Field>
      <Field label="Opened on">
        <input className="input" type="date" {...editor.bind('openedOn')} />
      </Field>
      <div className="field" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <label className="check">
          <input type="checkbox" {...editor.bindCheck('leachateTreatment')} /> Water treatment
        </label>
        <label className="check">
          <input type="checkbox" {...editor.bindCheck('methaneCapture')} /> Gas capture
        </label>
      </div>
    </div>
  );
}

export function Feature({ on, children }) {
  return (
    <span className="chip row" style={{ gap: 5, display: 'inline-flex' }}>
      {on ? <CheckCircle2 size={13} color="var(--good)" /> : <XCircle size={13} color="var(--text-muted)" />}
      {children}
    </span>
  );
}

export default function Landfills() {
  const { canManage, isAdmin } = useAuth();
  const confirm = useConfirm();
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAsync(() => get('/landfills', { days }), [days]);
  const editor = useLandfillEditor();

  const k = useMemo(() => {
    const active = (data || []).filter((l) => ['Active', 'Near Capacity'].includes(l.status));
    const cap = active.reduce((s, l) => s + l.totalCapacityTonnes, 0);
    const used = active.reduce((s, l) => s + l.stats.usedTonnes, 0);
    const inflow = active.reduce((s, l) => s + l.stats.avgDailyInflow, 0);
    return { sites: (data || []).length, active: active.length, cap, used, remaining: cap - used, inflow, life: inflow ? (cap - used) / inflow / 365 : null };
  }, [data]);

  const save = () =>
    editor.submit(
      (form, editing) => (editing ? put(`/landfills/${editing._id}`, form) : post('/landfills', form)),
      editor.editing ? 'Landfill updated' : 'Landfill site added'
    ).then((ok) => ok && reload());

  const remove = async (l) => {
    if (!(await confirm({ title: `Delete ${l.name}?`, message: 'The site and all its inflow records will be permanently deleted.' }))) return;
    try {
      await del(`/landfills/${l._id}`);
      toast.success('Landfill deleted');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <PageHeader icon={Mountain} title="Landfills" subtitle="How full each landfill is and how long it will last.">
        <RangeTabs value={days} onChange={setDays} />
        {canManage && (
          <button className="btn btn-primary" onClick={() => editor.open()}>
            <Plus size={16} /> Add site
          </button>
        )}
      </PageHeader>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Space used" hint="For landfills still accepting waste." icon={Mountain} value={fmtNum(k.cap ? (k.used / k.cap) * 100 : 0, 0)} unit="%" foot={`${k.active} of ${k.sites} sites open`} />
        <StatCard label="Space left" icon={Mountain} tone="blue" value={fmtCompact(k.remaining)} unit="tonnes" />
        <StatCard label="Waste coming in" icon={Truck} tone="amber" value={fmtNum(k.inflow, 0)} unit="tonnes/day" />
        <StatCard label="Years left" hint="At the current rate of dumping." icon={Hourglass} tone="violet" value={k.life === null ? '—' : fmtNum(k.life, 0)} unit="years" />
      </div>

      <div className="grid grid-3">
        {!data && loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={320} />)}
        {(data || []).map((l) => {
          const tone = capacityTone(l.stats.utilization);
          return (
            <article className="card entity-card" key={l._id}>
              <div className="ec-head">
                <div style={{ minWidth: 0 }}>
                  <div className="ec-code">{l.zone} zone</div>
                  <h3>{l.name}</h3>
                  <div className="cell-sub row" style={{ gap: 5, marginTop: 4 }}>
                    <MapPin size={13} /> {l.location || '—'}
                  </div>
                  <div className="mt-1">
                    <StatusBadge status={l.status} />
                  </div>
                </div>
                <FillTank value={l.stats.utilization} tone={tone} />
              </div>
              <div className="ec-body">
                <div className="row-between">
                  <span className="stat-value">
                    {fmtNum(l.stats.utilization, 0)}
                    <small>% full</small>
                  </span>
                  <span className="cell-sub">{fmtCompact(l.stats.remainingTonnes)} t left</span>
                </div>
                <div className="mt-1">
                  <Progress value={l.stats.utilization} tone={tone} size="lg" label={`${l.name} space used`} />
                </div>
                <dl className="kv mt-2">
                  <div>
                    <dt>Coming in</dt>
                    <dd>{fmtNum(l.stats.avgDailyInflow, 0)} t/day</dd>
                  </div>
                  <div>
                    <dt>Years left</dt>
                    <dd>{l.stats.estimatedLifeYears === null ? '—' : fmtNum(l.stats.estimatedLifeYears, 0)}</dd>
                  </div>
                  <div>
                    <dt>Area</dt>
                    <dd>{fmtNum(l.areaAcres, 0)} acres</dd>
                  </div>
                </dl>
                <div className="chips mt-2">
                  <Feature on={l.leachateTreatment}>Water treatment</Feature>
                  <Feature on={l.methaneCapture}>Gas capture</Feature>
                </div>
              </div>
              <div className="ec-foot">
                <Link className="btn btn-sm btn-ghost" to={`/landfills/${l._id}`}>
                  Details <ArrowRight size={14} />
                </Link>
                <div>
                  {canManage && (
                    <button className="icon-btn" onClick={() => editor.open(l)} aria-label="Edit site">
                      <Pencil size={15} />
                    </button>
                  )}
                  {isAdmin && (
                    <button className="icon-btn danger" onClick={() => remove(l)} aria-label="Delete site">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {data && data.length === 0 && (
        <Card>
          <Empty icon={Mountain} title="No landfill sites" message="Add a disposal site to start tracking capacity." />
        </Card>
      )}

      <FormModal open={editor.isOpen} title={editor.editing ? `Edit ${editor.editing.name}` : 'Add landfill site'} onClose={editor.close} onSubmit={save} saving={editor.saving}>
        <LandfillForm editor={editor} />
      </FormModal>
    </>
  );
}
