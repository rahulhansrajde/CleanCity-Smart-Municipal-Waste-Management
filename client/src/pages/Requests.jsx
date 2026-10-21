import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, Hourglass, MapPin, Megaphone, Recycle, Truck } from 'lucide-react';
import { errMsg, get, patch } from '../api';
import { usePoll } from '../hooks/usePoll';
import { useConfirm } from '../context/ConfirmContext';
import { Badge, Card, Empty, ErrorBox, PageHeader, Skeleton, StatCard } from '../components/ui';
import { ACTIVE_REQUEST, REQUEST_STATUS } from '../utils/constants';
import { fmtNum, timeAgo } from '../utils/format';

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'Resolved', label: 'Done' },
  { key: '', label: 'All' },
];

export default function Requests() {
  const confirm = useConfirm();
  const [filter, setFilter] = useState('active');
  const stats = usePoll(() => get('/requests/stats'), 3000);
  const list = usePoll(() => get('/requests', { status: filter || undefined, limit: 100 }), 3000, [filter]);
  const s = stats.data;

  const resolve = async (r) => {
    if (!(await confirm({ title: `Mark ${r.code} as done?`, message: 'Use this when the problem was fixed without the truck finishing the job.', confirmText: 'Mark done', danger: false })))
      return;
    try {
      await patch(`/requests/${r._id}/resolve`);
      toast.success(`${r.code} marked done`);
      list.refresh();
      stats.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <PageHeader icon={Megaphone} title="Citizen Requests" subtitle="Problems reported by citizens. Trucks are sent automatically.">
        <Link to="/map" className="btn btn-primary">
          <MapPin size={16} /> Open live map
        </Link>
      </PageHeader>

      {(list.error || stats.error) && <ErrorBox message={list.error || stats.error} onRetry={list.refresh} />}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Waiting for truck" icon={Hourglass} tone="rose" value={s ? s.waiting : '—'} foot={s?.waiting ? 'All trucks are busy' : 'None waiting'} />
        <StatCard label="Truck on the way" icon={Truck} tone="amber" value={s ? s.onTheWay : '—'} />
        <StatCard label="Being collected" icon={Recycle} tone="blue" value={s ? s.collecting : '—'} />
        <StatCard
          label="Average response"
          hint="Time from the report until the truck arrives, for requests closed in the last 7 days."
          icon={Clock}
          tone="violet"
          value={s ? fmtNum(s.avgResponseMin, 0) : '—'}
          unit="min"
          foot={s ? `${s.resolvedWeek} done this week` : ''}
        />
      </div>

      <div className="filters">
        <div className="segmented" role="tablist">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card bodyClass="">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Problem</th>
                <th>Area</th>
                <th>Reported by</th>
                <th>When</th>
                <th>Status</th>
                <th>Truck</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.loading && (
                <tr>
                  <td colSpan={8}>
                    <Skeleton height={140} />
                  </td>
                </tr>
              )}
              {list.data?.map((r) => (
                <tr key={r._id}>
                  <td className="cell-main nowrap">{r.code}</td>
                  <td style={{ maxWidth: 280 }}>
                    <div className="cell-main">{r.type}</div>
                    <div className="cell-sub">{r.description || r.landmark || '—'}</div>
                  </td>
                  <td>{r.ward?.name || '—'}</td>
                  <td className="nowrap">{r.source === 'simulated' ? <span className="muted">Simulated</span> : r.citizen?.name || '—'}</td>
                  <td className="nowrap text-2">{timeAgo(r.reportedAt)}</td>
                  <td>
                    <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                  </td>
                  <td className="nowrap">{r.vehicle?.registrationNo || '—'}</td>
                  <td className="actions">
                    <Link className="icon-btn" to={`/map?focus=${r._id}`} aria-label="Show on map" title="Show on map">
                      <MapPin size={15} />
                    </Link>
                    {ACTIVE_REQUEST.includes(r.status) && (
                      <button className="icon-btn" onClick={() => resolve(r)} aria-label="Mark done" title="Mark done">
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.data && list.data.length === 0 && <Empty icon={Megaphone} title={filter === 'active' ? 'No active requests' : 'No requests'} />}
        </div>
      </Card>
    </>
  );
}
