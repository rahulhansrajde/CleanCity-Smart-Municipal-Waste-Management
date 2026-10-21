import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Fuel, Gauge as GaugeIcon, Pencil, Plus, Route, Search, Trash2, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { del, errMsg, get, post, put } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useEditor } from '../hooks/useEditor';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { FormModal } from '../components/Modal';
import { Card, Empty, ErrorBox, Field, PageHeader, Progress, RangeTabs, Skeleton, StatCard, StatusBadge } from '../components/ui';
import { FUEL_TYPES, VEHICLE_STATUS, VEHICLE_TYPES } from '../utils/constants';
import { fmtNum, fmtPct, toInputDate } from '../utils/format';

const blank = {
  registrationNo: '',
  type: 'Compactor',
  capacityTonnes: 8,
  fuelType: 'Diesel',
  driverName: '',
  driverPhone: '',
  ward: '',
  status: 'Active',
  gpsEnabled: true,
  lastServiceDate: '',
};
const fromDoc = (v) => ({ ...v, ward: v.ward?._id || '', lastServiceDate: toInputDate(v.lastServiceDate) });

export default function Fleet() {
  const { canManage, isAdmin } = useAuth();
  const confirm = useConfirm();
  const [days, setDays] = useState(30);
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const { data, loading, error, reload } = useAsync(() => get('/vehicles', { days }), [days]);
  const wards = useAsync(() => get('/wards'), []);
  const editor = useEditor(blank, fromDoc);

  const list = useMemo(
    () =>
      (data || []).filter(
        (v) =>
          (!status || v.status === status) &&
          (!type || v.type === type) &&
          (!q || `${v.registrationNo} ${v.driverName} ${v.ward?.name}`.toLowerCase().includes(q.toLowerCase()))
      ),
    [data, q, status, type]
  );

  const k = useMemo(() => {
    const all = data || [];
    const sum = (f) => all.reduce((s, v) => s + (v.stats[f] || 0), 0);
    const trips = sum('trips');
    const tonnes = sum('tonnes');
    const fuel = sum('fuelLitres');
    const capTrips = all.reduce((s, v) => s + v.stats.trips * v.capacityTonnes, 0);
    return {
      total: all.length,
      active: all.filter((v) => v.status === 'Active').length,
      maint: all.filter((v) => v.status === 'Maintenance').length,
      trips,
      tonnes,
      loadFactor: capTrips ? (tonnes / capTrips) * 100 : 0,
      fuelPerTonne: tonnes ? fuel / tonnes : 0,
      distance: sum('distanceKm'),
    };
  }, [data]);

  const save = () =>
    editor.submit(
      (form, editing) => (editing ? put(`/vehicles/${editing._id}`, form) : post('/vehicles', form)),
      editor.editing ? 'Vehicle updated' : 'Vehicle added to fleet'
    ).then((ok) => ok && reload());

  const remove = async (v) => {
    if (!(await confirm({ title: `Remove ${v.registrationNo}?`, message: 'The vehicle will be removed from the fleet register. Past collection logs are kept.' }))) return;
    try {
      await del(`/vehicles/${v._id}`);
      toast.success('Vehicle removed');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <PageHeader icon={Truck} title="Vehicles" subtitle="Garbage trucks and how well they are used.">
        <RangeTabs value={days} onChange={setDays} />
        {canManage && (
          <button className="btn btn-primary" onClick={() => editor.open()}>
            <Plus size={16} /> Add vehicle
          </button>
        )}
      </PageHeader>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Vehicles working" icon={Truck} tone="blue" value={`${k.active} of ${k.total}`} foot={`${k.maint} in repair`} />
        <StatCard label="Truck load used" hint="How full trucks are on each trip, on average." icon={GaugeIcon} value={fmtNum(k.loadFactor, 0)} unit="%" foot="Higher is better" />
        <StatCard label="Fuel per tonne" hint="Litres of fuel used to carry one tonne of waste. Lower is better." icon={Fuel} tone="amber" value={fmtNum(k.fuelPerTonne, 2)} unit="litres" foot={`${fmtNum(k.tonnes, 0)} tonnes carried`} />
        <StatCard label="Trips" icon={Route} tone="violet" value={fmtNum(k.trips, 0)} foot={`${fmtNum(k.distance, 0)} km driven`} />
      </div>

      <div className="filters">
        <div className="input-icon grow">
          <Search size={16} />
          <input className="input" placeholder="Search vehicles…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Vehicle type">
          <option value="">All types</option>
          {VEHICLE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {VEHICLE_STATUS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <Card bodyClass="">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Ward</th>
                <th>Driver</th>
                <th>Status</th>
                <th className="r">Trips</th>
                <th className="r">Tonnes</th>
                <th style={{ minWidth: 150 }}>Load used</th>
                <th className="r">Fuel / tonne</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data && loading && (
                <tr>
                  <td colSpan={9}>
                    <Skeleton height={160} />
                  </td>
                </tr>
              )}
              {list.map((v) => (
                <tr key={v._id}>
                  <td>
                    <div className="cell-main nowrap">{v.registrationNo}</div>
                    <div className="cell-sub nowrap">
                      {v.type} · {v.capacityTonnes} t
                    </div>
                  </td>
                  <td>{v.ward?.name || '—'}</td>
                  <td className="nowrap">{v.driverName || '—'}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="r">{fmtNum(v.stats.trips, 0)}</td>
                  <td className="r">{fmtNum(v.stats.tonnes, 0)}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <Progress value={v.stats.loadFactor} tone="series" label="Load factor" />
                      </div>
                      <span className="num" style={{ minWidth: 40, textAlign: 'right' }}>
                        {v.stats.trips ? fmtPct(v.stats.loadFactor, 0) : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="r">{v.stats.fuelPerTonne ? `${fmtNum(v.stats.fuelPerTonne, 2)} L` : '—'}</td>
                  <td className="actions">
                    {canManage && (
                      <button className="icon-btn" onClick={() => editor.open(v)} aria-label="Edit vehicle">
                        <Pencil size={15} />
                      </button>
                    )}
                    {isAdmin && (
                      <button className="icon-btn danger" onClick={() => remove(v)} aria-label="Remove vehicle">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && list.length === 0 && <Empty icon={Truck} title="No vehicles found" />}
        </div>
      </Card>

      <FormModal
        open={editor.isOpen}
        title={editor.editing ? `Edit ${editor.editing.registrationNo}` : 'Add vehicle'}
        onClose={editor.close}
        onSubmit={save}
        saving={editor.saving}
      >
        <div className="form-grid">
          <Field label="Registration no. *">
            <input className="input" required placeholder="MH12 AB 1234" {...editor.bind('registrationNo')} />
          </Field>
          <Field label="Vehicle type *">
            <select className="select" required {...editor.bind('type')}>
              {VEHICLE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Capacity (tonnes) *">
            <input className="input" type="number" min="0.1" step="0.1" required {...editor.bind('capacityTonnes')} />
          </Field>
          <Field label="Fuel type">
            <select className="select" {...editor.bind('fuelType')}>
              {FUEL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Driver name">
            <input className="input" {...editor.bind('driverName')} />
          </Field>
          <Field label="Driver phone">
            <input className="input" {...editor.bind('driverPhone')} />
          </Field>
          <Field label="Assigned ward">
            <select className="select" {...editor.bind('ward')}>
              <option value="">Unassigned</option>
              {(wards.data || []).map((w) => (
                <option key={w._id} value={w._id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="select" {...editor.bind('status')}>
              {VEHICLE_STATUS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Last service date">
            <input className="input" type="date" {...editor.bind('lastServiceDate')} />
          </Field>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label className="check" style={{ height: 38 }}>
              <input type="checkbox" {...editor.bindCheck('gpsEnabled')} /> GPS tracking enabled
            </label>
          </div>
        </div>
      </FormModal>
    </>
  );
}
