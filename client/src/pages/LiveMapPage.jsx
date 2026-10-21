import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Map as MapIcon, Pause, Play, Plus } from 'lucide-react';
import { errMsg, get, post } from '../api';
import { useAsync } from '../hooks/useAsync';
import { usePoll } from '../hooks/usePoll';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, Empty, ErrorBox, PageHeader } from '../components/ui';
import LiveMap, { MapLegend, truckState } from '../components/LiveMap';
import { ACTIVE_REQUEST, REQUEST_STATUS, TRUCK_STATE } from '../utils/constants';
import { canControlSim } from '../utils/access';
import { timeAgo } from '../utils/format';

const STATE_ORDER = ['idle', 'to_job', 'collecting', 'returning', 'off'];
const STATUS_ORDER = { Open: 0, Dispatched: 1, 'In progress': 2, Resolved: 3, Cancelled: 4 };

export default function LiveMapPage() {
  const { user } = useAuth();
  const canControl = canControlSim(user.role);
  const [params] = useSearchParams();
  const places = useAsync(() => get('/live/places'), []);
  const live = usePoll(() => get('/live'), 1000);
  const [selected, setSelected] = useState(null);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(false);

  const vehicles = live.data?.vehicles || [];
  const requests = live.data?.requests || [];
  const sim = live.data?.sim;

  const select = (r) => {
    setSelected(r._id);
    setFocus({ key: `${r._id}-${Date.now()}`, lat: r.lat, lng: r.lng });
  };

  // Deep link from the requests table: /map?focus=<requestId>
  const focusId = params.get('focus');
  useEffect(() => {
    if (!focusId || selected) return;
    const r = requests.find((x) => x._id === focusId);
    if (r) select(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, requests.length]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATE_ORDER.map((s) => [s, 0]));
    vehicles.forEach((v) => (c[truckState(v)] += 1));
    return c;
  }, [vehicles]);

  const list = useMemo(
    () => [...requests].filter((r) => r.status !== 'Cancelled').sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || new Date(b.reportedAt) - new Date(a.reportedAt)),
    [requests]
  );
  const active = list.filter((r) => ACTIVE_REQUEST.includes(r.status)).length;

  const control = async (body) => {
    setBusy(true);
    try {
      await post('/live/sim', body);
      live.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const addRandom = async () => {
    setBusy(true);
    try {
      await post('/live/sim/random');
      toast.success('New request added. Nearest free truck sent.');
      live.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader icon={MapIcon} title="Live Map" subtitle="Trucks and citizen requests in real time. The nearest free truck is sent automatically." />

      {live.error && <ErrorBox message={live.error} onRetry={live.refresh} />}

      <div className="map-layout">
        <div>
          <LiveMap vehicles={vehicles} requests={list} places={places.data} focus={focus} selectedId={selected} onSelectRequest={select} height={640} />
          <MapLegend />
        </div>

        <div className="stack">
          {canControl && sim && (
            <Card title="Simulation">
              <div className="row" style={{ gap: 10 }}>
                <button className={`btn ${sim.running ? '' : 'btn-primary'}`} style={{ flex: 1 }} disabled={busy} onClick={() => control({ running: !sim.running })}>
                  {sim.running ? <Pause size={16} /> : <Play size={16} />}
                  {sim.running ? 'Pause' : 'Play'}
                </button>
                <div className="segmented" role="group" aria-label="Speed">
                  {sim.speeds.map((s) => (
                    <button key={s} className={sim.speed === s ? 'on' : ''} onClick={() => control({ speed: s })} disabled={busy}>
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
              <label className="row-between mt-2" style={{ cursor: 'pointer' }}>
                <span>
                  <b style={{ display: 'block', fontSize: 13.5 }}>Random requests</b>
                  <span className="cell-sub">Citizens report a new problem every few seconds</span>
                </span>
                <span className="switch">
                  <input type="checkbox" checked={sim.autoRequests} onChange={(e) => control({ autoRequests: e.target.checked })} disabled={busy} />
                  <span />
                </span>
              </label>
              <button className="btn mt-2" style={{ width: '100%' }} onClick={addRandom} disabled={busy}>
                <Plus size={16} /> Add one request now
              </button>
            </Card>
          )}

          <Card title="Trucks" subtitle={`${vehicles.length} in total`}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {STATE_ORDER.map((s) => (
                <div key={s} className="row" style={{ gap: 8 }}>
                  <span className="state-dot" style={{ background: `var(--tr-${s})` }} />
                  <span className="text-2" style={{ flex: 1 }}>
                    {TRUCK_STATE[s]}
                  </span>
                  <b className="num">{counts[s]}</b>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Requests" subtitle={`${active} active`}>
            {list.length === 0 ? (
              <Empty title="No requests right now" />
            ) : (
              <div className="side-list">
                {list.map((r) => (
                  <button key={r._id} className={`side-item ${selected === r._id ? 'on' : ''}`} onClick={() => select(r)}>
                    <span className="state-dot" style={{ background: `var(--st-${{ Open: 'open', Dispatched: 'dispatched', 'In progress': 'progress', Resolved: 'done' }[r.status]})` }} />
                    <span className="meta">
                      <b>
                        {r.type} · {r.ward?.name || '—'}
                      </b>
                      <small>
                        {r.code} · {timeAgo(r.reportedAt)}
                        {r.vehicle ? ` · ${r.vehicle.registrationNo}` : ''}
                      </small>
                    </span>
                    <Badge tone={REQUEST_STATUS[r.status].tone} icon={false}>
                      {REQUEST_STATUS[r.status].label}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
