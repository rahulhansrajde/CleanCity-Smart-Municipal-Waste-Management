import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Map, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { del, errMsg, get, post, put } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useEditor } from '../hooks/useEditor';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useTheme } from '../context/ThemeContext';
import { FormModal } from '../components/Modal';
import { Badge, Card, Empty, ErrorBox, Field, Gauge, MiniStat, PageHeader, RangeTabs, Skeleton } from '../components/ui';
import { ZONES } from '../utils/constants';
import { fmtCompact, fmtNum, fmtPct, rateTone } from '../utils/format';

const blank = { code: '', name: '', zone: 'North', population: '', households: '', areaSqKm: '', supervisor: '', targetSegregation: 80 };

export default function Wards() {
  const { canManage, isAdmin } = useAuth();
  const confirm = useConfirm();
  const { chart } = useTheme();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [q, setQ] = useState('');
  const [zone, setZone] = useState('');
  const { data, loading, error, reload } = useAsync(() => get('/wards', { days }), [days]);
  const editor = useEditor(blank);

  const list = useMemo(
    () =>
      (data || []).filter(
        (w) =>
          (!zone || w.zone === zone) &&
          (!q || `${w.code} ${w.name} ${w.supervisor}`.toLowerCase().includes(q.toLowerCase()))
      ),
    [data, q, zone]
  );

  const totals = useMemo(() => {
    const all = data || [];
    const pop = all.reduce((s, w) => s + (w.population || 0), 0);
    const t = all.reduce((s, w) => s + w.stats.totalTonnes, 0);
    const mixed = all.reduce((s, w) => s + w.stats.mixedTonnes, 0);
    return {
      wards: all.length,
      pop,
      perCapita: pop ? (t * 1000) / pop / days : 0,
      rate: t ? ((t - mixed) / t) * 100 : 0,
      onTarget: all.filter((w) => w.stats.segregationRate >= w.targetSegregation).length,
    };
  }, [data, days]);

  const save = () =>
    editor.submit(
      (form, editing) => (editing ? put(`/wards/${editing._id}`, form) : post('/wards', form)),
      editor.editing ? 'Ward updated' : 'Ward created'
    ).then((ok) => ok && reload());

  const remove = async (w) => {
    if (!(await confirm({ title: `Delete ${w.name}?`, message: 'Wards with collection history cannot be deleted.' }))) return;
    try {
      await del(`/wards/${w._id}`);
      toast.success('Ward deleted');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <PageHeader icon={Map} title="Wards" subtitle="How well each ward separates its waste.">
        <RangeTabs value={days} onChange={setDays} />
        {canManage && (
          <button className="btn btn-primary" onClick={() => editor.open()}>
            <Plus size={16} /> Add ward
          </button>
        )}
      </PageHeader>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="card strip" style={{ marginBottom: 18 }}>
        <MiniStat label="Wards" value={totals.wards} />
        <MiniStat label="People" value={fmtCompact(totals.pop)} />
        <MiniStat label="City segregation" value={fmtPct(totals.rate)} sub="Target 80%" />
        <MiniStat label="Wards on target" value={`${totals.onTarget} of ${totals.wards}`} />
      </div>

      <div className="filters">
        <div className="input-icon grow">
          <Search size={16} />
          <input className="input" placeholder="Search wards…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">
          <option value="">All zones</option>
          {ZONES.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </div>

      <div className="grid cards-auto">
        {!data && loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={250} />)}
        {list.map((w) => {
          const tone = rateTone(w.stats.segregationRate, w.targetSegregation);
          return (
            <article className="card entity-card" key={w._id}>
              <div className="ec-head">
                <div>
                  <div className="ec-code">{w.zone} zone</div>
                  <h3>{w.name}</h3>
                  <div className="cell-sub row" style={{ gap: 5, marginTop: 4 }}>
                    <Users size={13} /> {w.supervisor || 'No supervisor'}
                  </div>
                  <div className="mt-1">
                    <Badge tone={tone}>{tone === 'good' ? 'On target' : tone === 'warning' ? 'Close to target' : 'Needs work'}</Badge>
                  </div>
                </div>
                <Gauge value={w.stats.segregationRate} color={chart.series[0]} sub="segregated" size={88} />
              </div>
              <div className="ec-body">
                <dl className="kv">
                  <div>
                    <dt>Collected</dt>
                    <dd>{fmtNum(w.stats.totalTonnes, 0)} t</dd>
                  </div>
                  <div>
                    <dt>People</dt>
                    <dd>{fmtCompact(w.population)}</dd>
                  </div>
                  <div>
                    <dt>Homes covered</dt>
                    <dd>{fmtPct(w.stats.coverage, 0)}</dd>
                  </div>
                </dl>
              </div>
              <div className="ec-foot">
                <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/segregation?ward=${w._id}`)}>
                  View records <ArrowRight size={14} />
                </button>
                <div>
                  {canManage && (
                    <button className="icon-btn" onClick={() => editor.open(w)} aria-label="Edit ward">
                      <Pencil size={15} />
                    </button>
                  )}
                  {isAdmin && (
                    <button className="icon-btn danger" onClick={() => remove(w)} aria-label="Delete ward">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {data && list.length === 0 && (
        <Card>
          <Empty icon={Map} title="No wards found" />
        </Card>
      )}

      <FormModal
        open={editor.isOpen}
        title={editor.editing ? `Edit ${editor.editing.name}` : 'Add ward'}
        onClose={editor.close}
        onSubmit={save}
        saving={editor.saving}
      >
        <div className="form-grid">
          <Field label="Ward code *">
            <input className="input" required placeholder="W13" {...editor.bind('code')} />
          </Field>
          <Field label="Ward name *">
            <input className="input" required {...editor.bind('name')} />
          </Field>
          <Field label="Zone *">
            <select className="select" required {...editor.bind('zone')}>
              {ZONES.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </Field>
          <Field label="Ward supervisor">
            <input className="input" {...editor.bind('supervisor')} />
          </Field>
          <Field label="Population">
            <input className="input" type="number" min="0" {...editor.bind('population')} />
          </Field>
          <Field label="Households">
            <input className="input" type="number" min="0" {...editor.bind('households')} />
          </Field>
          <Field label="Area (km²)">
            <input className="input" type="number" min="0" step="0.1" {...editor.bind('areaSqKm')} />
          </Field>
          <Field label="Segregation target (%)">
            <input className="input" type="number" min="0" max="100" {...editor.bind('targetSegregation')} />
          </Field>
        </div>
      </FormModal>
    </>
  );
}
