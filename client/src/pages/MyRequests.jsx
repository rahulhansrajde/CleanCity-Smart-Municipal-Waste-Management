import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Megaphone, PawPrint, Plus, Trash2, Truck, TriangleAlert, Ban, HelpCircle } from 'lucide-react';
import { errMsg, get, patch, post } from '../api';
import { useAsync } from '../hooks/useAsync';
import { usePoll } from '../hooks/usePoll';
import { useConfirm } from '../context/ConfirmContext';
import { FormModal } from '../components/Modal';
import { Badge, Card, Empty, ErrorBox, Field, PageHeader, Skeleton } from '../components/ui';
import LiveMap from '../components/LiveMap';
import { ACTIVE_REQUEST, REQUEST_STATUS, REQUEST_TYPES } from '../utils/constants';
import { distanceKm, nearest } from '../utils/geo';
import { fmtNum, fmtTime, timeAgo } from '../utils/format';

const TYPE_ICON = {
  'Overflowing bin': Trash2,
  'Missed collection': Truck,
  'Illegal dumping': Ban,
  'Dead animal': PawPrint,
  Other: HelpCircle,
};
const STEPS = ['Sent', 'Truck on the way', 'Collecting', 'Done'];
const STEP_INDEX = { Open: 0, Dispatched: 1, 'In progress': 2, Resolved: 4 };

function Steps({ status }) {
  const at = STEP_INDEX[status] ?? 0;
  return (
    <div className="steps" aria-label={`Progress: ${REQUEST_STATUS[status]?.label}`}>
      {STEPS.map((label, i) => {
        const cls = i < at || at === 4 ? 'done' : i === at ? 'current' : '';
        return (
          <div key={label} className={`step ${cls}`}>
            <span className="dot">{cls === 'done' && <Check size={12} strokeWidth={3} />}</span>
            {label}
          </div>
        );
      })}
    </div>
  );
}

const blank = () => ({ type: 'Overflowing bin', description: '', landmark: '', pick: null });

export default function MyRequests() {
  const confirm = useConfirm();
  const places = useAsync(() => get('/live/places'), []);
  const live = usePoll(() => get('/live'), 1500);
  const [selectedId, setSelectedId] = useState(null);
  const [focus, setFocus] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const requests = live.data?.requests || [];
  const vehicles = live.data?.vehicles || [];
  const selected = requests.find((r) => r._id === selectedId) || requests.find((r) => ACTIVE_REQUEST.includes(r.status)) || requests[0];

  // Keep the map centred on the selected request.
  useEffect(() => {
    if (selected) setFocus({ key: selected._id, lat: selected.lat, lng: selected.lng });
  }, [selected?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const truckFor = (r) => vehicles.find((v) => v.requestId === r._id);
  const pickWard = useMemo(() => (form?.pick ? nearest(form.pick, places.data?.wards) : null), [form?.pick, places.data]);

  const submit = async () => {
    if (!form.pick) return toast.error('Tap the map to mark the place');
    setSaving(true);
    try {
      const r = await post('/requests', { type: form.type, description: form.description, landmark: form.landmark, lat: form.pick.lat, lng: form.pick.lng });
      toast.success(r.status === 'Dispatched' ? `Request sent. Truck ${r.vehicle?.registrationNo} is on the way!` : 'Request sent. A truck will be sent soon.');
      setForm(null);
      setSelectedId(r._id);
      live.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (r) => {
    if (!(await confirm({ title: `Cancel ${r.code}?`, message: 'The truck will be sent back.', confirmText: 'Cancel request' }))) return;
    try {
      await patch(`/requests/${r._id}/cancel`);
      toast.success('Request cancelled');
      live.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const mapRequests = selected ? [selected] : [];
  const mapTrucks = selected ? vehicles.filter((v) => v.requestId === selected._id) : [];

  return (
    <>
      <PageHeader icon={Megaphone} title="My Requests" subtitle="Report a waste problem in your area and track the truck.">
        <button className="btn btn-primary" onClick={() => setForm(blank())}>
          <Plus size={16} /> Report a problem
        </button>
      </PageHeader>

      {live.error && <ErrorBox message={live.error} onRetry={live.refresh} />}

      {live.loading ? (
        <Skeleton height={300} />
      ) : requests.length === 0 ? (
        <Card>
          <Empty
            icon={Megaphone}
            title="No requests yet"
            message="Seen an overflowing bin or a missed pickup? Tell us and we'll send a truck."
            action={
              <button className="btn btn-primary" onClick={() => setForm(blank())}>
                <Plus size={16} /> Report a problem
              </button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-1-1">
          <div className="stack" style={{ gap: 12 }}>
            {requests.map((r) => {
              const Icon = TYPE_ICON[r.type] || TriangleAlert;
              const truck = truckFor(r);
              const active = ACTIVE_REQUEST.includes(r.status);
              return (
                <article key={r._id} className={`card req-card ${selected?._id === r._id ? 'on' : ''}`} onClick={() => setSelectedId(r._id)}>
                  <div className="row-between">
                    <div className="row">
                      <span className="stat-icon">
                        <Icon size={17} />
                      </span>
                      <div>
                        <b>{r.type}</b>
                        <div className="cell-sub">
                          {r.code} · {timeAgo(r.reportedAt)}
                          {r.ward?.name ? ` · ${r.ward.name}` : ''}
                        </div>
                      </div>
                    </div>
                    <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                  </div>
                  {r.status !== 'Cancelled' && <Steps status={r.status} />}
                  {(r.description || r.landmark) && (
                    <p className="text-2 mt-1" style={{ fontSize: 13.5 }}>
                      {r.description}
                      {r.landmark ? ` (${r.landmark})` : ''}
                    </p>
                  )}
                  <div className="row-between mt-1" style={{ fontSize: 13 }}>
                    <span className="text-2">
                      {r.status === 'Open' && 'All trucks are busy. One will be sent soon.'}
                      {r.status === 'Dispatched' && truck && (
                        <>
                          Truck <b>{r.vehicle?.registrationNo}</b> is {fmtNum(distanceKm(truck, r), 1)} km away
                        </>
                      )}
                      {r.status === 'In progress' && (
                        <>
                          Truck <b>{r.vehicle?.registrationNo}</b> is collecting now
                        </>
                      )}
                      {r.status === 'Resolved' && `Done at ${fmtTime(r.resolvedAt)}`}
                      {r.status === 'Cancelled' && 'You cancelled this request'}
                    </span>
                    {active && r.status !== 'In progress' && (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancel(r);
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div style={{ position: 'sticky', top: 80 }}>
            <Card title={selected ? `Tracking ${selected.code}` : 'Map'} subtitle={selected ? REQUEST_STATUS[selected.status].label : ''}>
              <LiveMap requests={mapRequests} vehicles={mapTrucks} focus={focus} selectedId={selected?._id} height={420} zoom={13} />
            </Card>
          </div>
        </div>
      )}

      <FormModal open={!!form} size="lg" title="Report a problem" subtitle="We'll send the nearest free truck." onClose={() => setForm(null)} onSubmit={submit} saving={saving} submitText="Send request">
        {form && (
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <div className="stat-label" style={{ marginBottom: 8 }}>
                What's the problem?
              </div>
              <div className="type-grid">
                {REQUEST_TYPES.map((t) => {
                  const Icon = TYPE_ICON[t];
                  return (
                    <button type="button" key={t} className={`type-opt ${form.type === t ? 'on' : ''}`} onClick={() => setForm({ ...form, type: t })}>
                      <Icon size={16} /> {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <span className="stat-label">Where is it? *</span>
                <span className="cell-sub">{pickWard ? `Ward: ${pickWard.name}` : 'Tap the map'}</span>
              </div>
              <div style={{ position: 'relative' }}>
                {!form.pick && <div className="pick-hint">Tap the map to mark the place</div>}
                <LiveMap onPick={(p) => setForm((f) => ({ ...f, pick: p }))} pick={form.pick} height={280} zoom={12} />
              </div>
            </div>

            <div className="form-grid">
              <Field label="Details">
                <input className="input" placeholder="e.g. Bin is full since yesterday" maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Field label="Landmark">
                <input className="input" placeholder="e.g. Near the bus stop" maxLength={120} value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </FormModal>
    </>
  );
}
