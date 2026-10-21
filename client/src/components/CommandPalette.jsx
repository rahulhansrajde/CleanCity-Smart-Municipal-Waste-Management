import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Factory, Map, Mountain, Search, Truck } from 'lucide-react';
import { get } from '../api';
import { canSee } from '../utils/access';

/**
 * Ctrl/⌘+K quick switcher across pages, wards, plants, landfills and vehicles.
 * `pages` = [{ to, text, icon }] from the sidebar definition.
 */
export default function CommandPalette({ open, onClose, pages, role }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [records, setRecords] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    // Only search the record types this role is allowed to open.
    const load = (page, url) => (canSee(role, page) ? get(url) : Promise.resolve([]));
    if (!records)
      Promise.all([load('segregation', '/wards'), load('plants', '/plants'), load('landfills', '/landfills'), load('fleet', '/vehicles')])
        .then(([wards, plants, landfills, vehicles]) => setRecords({ wards, plants, landfills, vehicles }))
        .catch(() => setRecords({ wards: [], plants: [], landfills: [], vehicles: [] }));
  }, [open, records, role]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (...parts) => !term || parts.join(' ').toLowerCase().includes(term);
    const r = records || { wards: [], plants: [], landfills: [], vehicles: [] };
    const limit = term ? 6 : 3;
    return [
      { label: 'Pages', items: pages.filter((p) => match(p.text)).map((p) => ({ key: p.to, icon: p.icon, title: p.text, to: p.to })) },
      {
        label: 'Wards',
        items: r.wards
          .filter((w) => match(w.code, w.name, w.zone))
          .slice(0, limit)
          .map((w) => ({ key: w._id, icon: Map, title: w.name, sub: `${w.zone} zone · collection records`, to: `/segregation?ward=${w._id}` })),
      },
      {
        label: 'Recycling plants',
        items: r.plants
          .filter((p) => match(p.code, p.name, p.type))
          .slice(0, limit)
          .map((p) => ({ key: p._id, icon: Factory, title: p.name, sub: `${p.code} · ${p.type}`, to: `/plants/${p._id}` })),
      },
      {
        label: 'Landfills',
        items: r.landfills
          .filter((l) => match(l.code, l.name, l.location))
          .slice(0, limit)
          .map((l) => ({ key: l._id, icon: Mountain, title: l.name, sub: `${l.code} · ${l.stats.utilization}% full`, to: `/landfills/${l._id}` })),
      },
      {
        label: 'Vehicles',
        items: term
          ? r.vehicles
              .filter((v) => match(v.registrationNo, v.driverName, v.type))
              .slice(0, limit)
              .map((v) => ({ key: v._id, icon: Truck, title: v.registrationNo, sub: `${v.type} · ${v.driverName || 'No driver'}`, to: `/fleet?q=${encodeURIComponent(v.registrationNo)}` }))
          : [],
      },
    ].filter((g) => g.items.length);
  }, [q, records, pages]);

  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[active]);
    } else if (e.key === 'Escape') onClose();
  };

  let idx = -1;
  return createPortal(
    <div className="cmdk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search">
        <div className="cmdk-input">
          <Search size={18} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search pages, wards, plants, landfills, vehicles…"
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            aria-label="Search"
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {flat.length === 0 && <div className="empty">{records ? `No results for “${q}”` : 'Loading…'}</div>}
          {groups.map((g) => (
            <div key={g.label}>
              <div className="cmdk-group">{g.label}</div>
              {g.items.map((it) => {
                idx += 1;
                const i = idx;
                return (
                  <button key={it.key} className={`cmdk-item ${i === active ? 'active' : ''}`} onMouseMove={() => setActive(i)} onClick={() => go(it)}>
                    <span className="ci-icon">
                      <it.icon size={16} />
                    </span>
                    <span className="ci-text">
                      {it.title}
                      {it.sub && <small>{it.sub}</small>}
                    </span>
                    {i === active && <CornerDownLeft size={15} className="muted" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">Enter</span> open
          </span>
          <span>
            <span className="kbd">Esc</span> close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
