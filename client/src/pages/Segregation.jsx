import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Recycle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { del, errMsg, get, post, put } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useEditor } from '../hooks/useEditor';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { STREAMS, useStreamColors } from '../context/ThemeContext';
import { FormModal } from '../components/Modal';
import { Badge, Card, Empty, ErrorBox, Field, Legend, PageHeader, Skeleton } from '../components/ui';
import { SHIFTS, ZONES } from '../utils/constants';
import { daysAgoInput, downloadCSV, fmtDate, fmtNum, fmtPct, rateTone, toInputDate, todayInput } from '../utils/format';

const LIMIT = 15;
// Field order follows how crews weigh loads; chart colours still follow STREAMS.
const FORM_ORDER = ['wet', 'dry', 'hazardous', 'eWaste', 'mixed'];

const blank = () => ({
  ward: '',
  vehicle: '',
  date: todayInput(),
  shift: 'Morning',
  wet: '',
  dry: '',
  hazardous: '',
  eWaste: '',
  mixed: '',
  trips: 1,
  distanceKm: '',
  fuelLitres: '',
  housesCovered: '',
  notes: '',
});

const fromDoc = (c) => ({
  ...c,
  ward: c.ward?._id || c.ward || '',
  vehicle: c.vehicle?._id || c.vehicle || '',
  date: toInputDate(c.date),
});

export default function Segregation() {
  const { canRecord, canDeleteRecords } = useAuth();
  const confirm = useConfirm();
  const colors = useStreamColors();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({
    from: daysAgoInput(29),
    to: todayInput(),
    ward: params.get('ward') || '',
    zone: '',
    shift: '',
  });
  const [page, setPage] = useState(1);

  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    if ('ward' in patch) setParams(patch.ward ? { ward: patch.ward } : {}, { replace: true });
  };

  const lookups = useAsync(() => Promise.all([get('/wards'), get('/vehicles')]), []);
  const [wards = [], vehicles = []] = lookups.data || [];
  const { data, loading, error, reload } = useAsync(() => get('/collections', { ...filters, page, limit: LIMIT }), [filters, page]);

  const editor = useEditor(blank, fromDoc);
  const f = editor.form;

  // Deep link from the dashboard: /segregation?new=1 opens the entry form.
  useEffect(() => {
    if (params.get('new') === '1' && canRecord) {
      editor.open();
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const preview = useMemo(() => {
    const vals = STREAMS.map((s) => ({ ...s, v: Number(f[s.key]) || 0 }));
    const total = vals.reduce((a, b) => a + b.v, 0);
    const mixed = Number(f.mixed) || 0;
    return { vals, total, rate: total ? ((total - mixed) / total) * 100 : 0 };
  }, [f]);

  const save = () =>
    editor.submit(
      (form, editing) => (editing ? put(`/collections/${editing._id}`, form) : post('/collections', form)),
      editor.editing ? 'Collection record updated' : 'Collection recorded'
    ).then((ok) => ok && reload());

  const remove = async (c) => {
    const ok = await confirm({
      title: 'Delete collection record?',
      message: `${c.ward?.name} on ${fmtDate(c.date)} (${fmtNum(c.total)} t) will be permanently removed.`,
    });
    if (!ok) return;
    try {
      await del(`/collections/${c._id}`);
      toast.success('Record deleted');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const exportCsv = async () => {
    try {
      const all = await get('/collections', { ...filters, page: 1, limit: 500 });
      downloadCSV(`segregation_${filters.from}_${filters.to}.csv`, all.items, [
        { label: 'Date', value: (r) => toInputDate(r.date) },
        { label: 'Ward', value: (r) => `${r.ward?.code} ${r.ward?.name}` },
        { label: 'Zone', value: (r) => r.ward?.zone },
        { label: 'Shift', value: 'shift' },
        { label: 'Vehicle', value: (r) => r.vehicle?.registrationNo },
        { label: 'Wet (t)', value: 'wet' },
        { label: 'Dry (t)', value: 'dry' },
        { label: 'Hazardous (t)', value: 'hazardous' },
        { label: 'E-Waste (t)', value: 'eWaste' },
        { label: 'Mixed (t)', value: 'mixed' },
        { label: 'Total (t)', value: 'total' },
        { label: 'Segregation %', value: 'segregationRate' },
        { label: 'Trips', value: 'trips' },
        { label: 'Distance (km)', value: 'distanceKm' },
        { label: 'Fuel (L)', value: 'fuelLitres' },
        { label: 'Households covered', value: 'housesCovered' },
      ]);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const s = data?.summary;
  const vehiclesForWard = f.ward ? [...vehicles].sort((a, b) => (b.ward?._id === f.ward) - (a.ward?._id === f.ward)) : vehicles;

  return (
    <>
      <PageHeader icon={Recycle} title="Segregation" subtitle="Waste collected from each ward, by type.">
        <button className="btn" onClick={exportCsv}>
          <Download size={16} /> Download
        </button>
        {canRecord && (
          <button className="btn btn-primary" onClick={() => editor.open()}>
            <Plus size={16} /> Add collection
          </button>
        )}
      </PageHeader>

      <div className="filters">
        <input className="input" type="date" value={filters.from} max={filters.to} onChange={(e) => setFilter({ from: e.target.value })} aria-label="From date" />
        <span className="muted">to</span>
        <input className="input" type="date" value={filters.to} min={filters.from} onChange={(e) => setFilter({ to: e.target.value })} aria-label="To date" />
        <select className="select" value={filters.zone} onChange={(e) => setFilter({ zone: e.target.value, ward: '' })} aria-label="Zone">
          <option value="">All zones</option>
          {ZONES.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
        <select className="select" value={filters.ward} onChange={(e) => setFilter({ ward: e.target.value })} aria-label="Ward">
          <option value="">All wards</option>
          {wards
            .filter((w) => !filters.zone || w.zone === filters.zone)
            .map((w) => (
              <option key={w._id} value={w._id}>
                {w.code} · {w.name}
              </option>
            ))}
        </select>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="stack">
        <Card bodyClass="card-body" className="">
          {!s ? (
            <Skeleton height={92} />
          ) : (
            <>
              <div className="row-between" style={{ flexWrap: 'wrap', gap: 18 }}>
                <div>
                  <div className="stat-label">Total collected</div>
                  <div className="stat-value">
                    {fmtNum(s.total, 0)}
                    <small>tonnes</small>
                  </div>
                </div>
                <div>
                  <div className="stat-label">Segregated</div>
                  <div className="row" style={{ gap: 10 }}>
                    <div className="stat-value">
                      {fmtNum(s.segregationRate, 1)}
                      <small>%</small>
                    </div>
                    <Badge tone={rateTone(s.segregationRate)}>{s.segregationRate >= 80 ? 'On target' : 'Below 80% target'}</Badge>
                  </div>
                </div>
                {STREAMS.map((st) => (
                  <div key={st.key}>
                    <div className="legend-item stat-label">
                      <span className="swatch" style={{ background: colors[st.key] }} />
                      {st.label}
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 700 }} className="num">
                      {fmtNum(s[st.key], 0)} t
                    </div>
                    <div className="cell-sub">{fmtPct(s.total ? (s[st.key] / s.total) * 100 : 0)}</div>
                  </div>
                ))}
              </div>
              <div className="stacked-bar mt-2" aria-hidden="true">
                {STREAMS.map((st) => (
                  <span key={st.key} style={{ width: `${s.total ? (s[st.key] / s.total) * 100 : 0}%`, background: colors[st.key] }} />
                ))}
              </div>
            </>
          )}
        </Card>

        <Card bodyClass="">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ward</th>
                  <th className="r">Wet (t)</th>
                  <th className="r">Dry (t)</th>
                  <th className="r">Hazardous (t)</th>
                  <th className="r">E-waste (t)</th>
                  <th className="r">Mixed (t)</th>
                  <th className="r">Total (t)</th>
                  <th>Segregated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!data &&
                  loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={10}>
                        <Skeleton height={20} />
                      </td>
                    </tr>
                  ))}
                {data?.items.map((c) => (
                  <tr key={c._id}>
                    <td className="nowrap cell-main">{fmtDate(c.date)}</td>
                    <td>
                      <div className="cell-main">{c.ward?.name || '—'}</div>
                      <div className="cell-sub">{c.ward?.zone} zone</div>
                    </td>
                    <td className="r">{fmtNum(c.wet, 1)}</td>
                    <td className="r">{fmtNum(c.dry, 1)}</td>
                    <td className="r">{fmtNum(c.hazardous, 1)}</td>
                    <td className="r">{fmtNum(c.eWaste, 1)}</td>
                    <td className="r">{fmtNum(c.mixed, 1)}</td>
                    <td className="r">
                      <b>{fmtNum(c.total, 1)}</b>
                    </td>
                    <td>
                      <Badge tone={rateTone(c.segregationRate)}>{fmtPct(c.segregationRate, 0)}</Badge>
                    </td>
                    <td className="actions">
                      {canRecord && (
                        <button className="icon-btn" onClick={() => editor.open(c)} aria-label="Edit">
                          <Pencil size={15} />
                        </button>
                      )}
                      {canDeleteRecords && (
                        <button className="icon-btn danger" onClick={() => remove(c)} aria-label="Delete">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && data.items.length === 0 && <Empty icon={Recycle} title="No records found" message="Try other dates or filters." />}
          </div>
          {data && data.total > 0 && (
            <div className="table-foot">
              <span>
                {(data.page - 1) * LIMIT + 1}–{Math.min(data.page * LIMIT, data.total)} of {fmtNum(data.total, 0)}
              </span>
              <div className="pager">
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                  <ChevronLeft size={15} />
                </button>
                <span>
                  Page {data.page} of {data.pages}
                </span>
                <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <FormModal
        open={editor.isOpen}
        size="lg"
        title={editor.editing ? 'Edit collection' : 'Add collection'}
        subtitle="All weights in tonnes"
        onClose={editor.close}
        onSubmit={save}
        saving={editor.saving}
        submitText="Save"
      >
        <div className="form-grid cols-3">
          <Field label="Ward *">
            <select
              className="select"
              required
              {...editor.bind('ward')}
              onChange={(e) => {
                const ward = e.target.value;
                const v = vehicles.find((x) => x.ward?._id === ward && x.status === 'Active');
                editor.set({ ward, vehicle: f.vehicle || v?._id || '' });
              }}
            >
              <option value="">Select ward</option>
              {wards.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date *">
            <input className="input" type="date" required max={todayInput()} {...editor.bind('date')} />
          </Field>
          <Field label="Shift">
            <select className="select" {...editor.bind('shift')}>
              {SHIFTS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>

          <div className="form-section">Waste by type</div>
          {FORM_ORDER.map((key) => STREAMS.find((st) => st.key === key)).map((st) => (
            <Field key={st.key} label={st.key === 'mixed' ? 'Mixed / unsegregated' : st.label}>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00" {...editor.bind(st.key)} />
            </Field>
          ))}
          <Field label="Households covered">
            <input className="input" type="number" min="0" step="1" {...editor.bind('housesCovered')} />
          </Field>

          <div className="preview-box">
            <div className="row-between" style={{ flexWrap: 'wrap' }}>
              <span>
                Total <b className="num">{fmtNum(preview.total, 2)} t</b>
              </span>
              <span className="row">
                Segregation <Badge tone={rateTone(preview.rate)}>{fmtPct(preview.rate)}</Badge>
              </span>
            </div>
            <div className="stacked-bar mt-1" aria-hidden="true">
              {preview.vals.map((v) => (
                <span key={v.key} style={{ width: `${preview.total ? (v.v / preview.total) * 100 : 0}%`, background: colors[v.key] }} />
              ))}
            </div>
            <div className="mt-1">
              <Legend items={STREAMS.map((st) => ({ label: st.label, color: colors[st.key] }))} />
            </div>
          </div>

          <div className="form-section">Vehicle (optional)</div>
          <Field label="Vehicle">
            <select className="select" {...editor.bind('vehicle')}>
              <option value="">Not specified</option>
              {vehiclesForWard.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.registrationNo} · {v.type}
                  {v.ward?._id === f.ward ? ' (assigned)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trips">
            <input className="input" type="number" min="1" step="1" {...editor.bind('trips')} />
          </Field>
          <Field label="Distance (km)">
            <input className="input" type="number" min="0" step="0.1" {...editor.bind('distanceKm')} />
          </Field>
          <Field label="Fuel used (litres)">
            <input className="input" type="number" min="0" step="0.1" {...editor.bind('fuelLitres')} />
          </Field>
          <Field label="Notes" className="span-2">
            <input className="input" placeholder="Optional remarks" {...editor.bind('notes')} />
          </Field>
        </div>
      </FormModal>
    </>
  );
}
