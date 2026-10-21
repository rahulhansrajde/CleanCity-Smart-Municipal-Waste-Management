import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  BellRing,
  Factory,
  LayoutDashboard,
  Leaf,
  LogOut,
  Map,
  MapPinned,
  Megaphone,
  Menu,
  Moon,
  Mountain,
  PanelLeftClose,
  PanelLeftOpen,
  Recycle,
  Search,
  Sun,
  Truck,
  Users,
} from 'lucide-react';
import { get, storage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAsync } from '../hooks/useAsync';
import { initials } from '../utils/format';
import { LEVEL_LABEL } from '../utils/constants';
import { canSee } from '../utils/access';
import CommandPalette from './CommandPalette';
import { Badge } from './ui';

const NAV = [
  {
    label: 'Overview',
    items: [
      { page: 'dashboard', to: '/', icon: LayoutDashboard, text: 'Dashboard', end: true },
      { page: 'map', to: '/map', icon: MapPinned, text: 'Live Map' },
    ],
  },
  {
    label: 'Citizens',
    items: [
      { page: 'requests', to: '/requests', icon: Megaphone, text: 'Citizen Requests' },
      { page: 'myRequests', to: '/my-requests', icon: Megaphone, text: 'My Requests' },
    ],
  },
  {
    label: 'Collection',
    items: [
      { page: 'segregation', to: '/segregation', icon: Recycle, text: 'Segregation' },
      { page: 'wards', to: '/wards', icon: Map, text: 'Wards' },
      { page: 'fleet', to: '/fleet', icon: Truck, text: 'Vehicles' },
    ],
  },
  {
    label: 'Facilities',
    items: [
      { page: 'plants', to: '/plants', icon: Factory, text: 'Recycling Plants' },
      { page: 'landfills', to: '/landfills', icon: Mountain, text: 'Landfills' },
    ],
  },
  { label: 'Insights', items: [{ page: 'reports', to: '/reports', icon: BarChart3, text: 'Reports' }] },
  { label: 'Admin', items: [{ page: 'users', to: '/users', icon: Users, text: 'Users' }] },
];

const TITLES = {
  '': 'Dashboard',
  map: 'Live Map',
  requests: 'Citizen Requests',
  'my-requests': 'My Requests',
  segregation: 'Segregation',
  wards: 'Wards',
  fleet: 'Vehicles',
  plants: 'Recycling Plants',
  landfills: 'Landfills',
  reports: 'Reports',
  users: 'Users',
};

const MODULE_LINK = { landfills: '/landfills', plants: '/plants', wards: '/wards', fleet: '/fleet', segregation: '/segregation', requests: '/requests' };
const COLLAPSE_KEY = 'cleancity_sidebar';

// Close a popover when clicking outside its container.
function useOutside(ref, onOutside) {
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ref, onOutside]);
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => storage.get(COLLAPSE_KEY) === '1');
  const [bellOpen, setBellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const bellRef = useRef(null);
  const { pathname } = useLocation();
  const section = pathname.split('/')[1] || '';
  // Alerts summarise city-wide data, so only roles with the dashboard get the bell.
  const showAlerts = canSee(user?.role, 'dashboard');
  const alerts = useAsync(() => (showAlerts ? get('/analytics/alerts') : Promise.resolve([])), [showAlerts]);

  const groups = useMemo(
    () =>
      NAV.map((g) => ({ ...g, items: g.items.filter((i) => canSee(user?.role, i.page)) })).filter((g) => g.items.length),
    [user?.role]
  );
  const pages = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useOutside(bellRef, () => setBellOpen(false));

  useEffect(() => {
    setNavOpen(false);
    setBellOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapse = () =>
    setCollapsed((c) => {
      storage.set(COLLAPSE_KEY, c ? '0' : '1');
      return !c;
    });

  const alertList = alerts.data || [];
  const urgent = alertList.filter((a) => a.level !== 'info').length;

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="logo-mark">
            <Leaf size={19} />
          </div>
          <div>
            <strong>CleanCity</strong>
            <span>Waste Management</span>
          </div>
          <button className="icon-btn sidebar-toggle" onClick={toggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav>
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-label">{g.label}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} className="nav-link" title={collapsed ? i.text : undefined}>
                  <i.icon size={18} />
                  <span className="nav-text">{i.text}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar" title={collapsed ? user?.name : undefined}>
            {initials(user?.name)}
          </span>
          <div className="who">
            <b>{user?.name}</b>
            <small>{user?.role}</small>
          </div>
          <button className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className={`scrim ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div className="topbar-title">{TITLES[section] || 'CleanCity'}</div>
          <span className="crumb">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <div className="topbar-spacer" />
          <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Search">
            <Search size={16} />
            <span>Search…</span>
            <span className="kbd">Ctrl K</span>
          </button>

          {showAlerts && (
          <div className="dropdown bell" ref={bellRef}>
            <button
              className="icon-btn bordered"
              onClick={() => {
                if (!bellOpen) alerts.reload();
                setBellOpen((o) => !o);
              }}
              aria-label={`Alerts (${alertList.length})`}
              aria-expanded={bellOpen}
            >
              <Bell size={17} />
            </button>
            {urgent > 0 && <span className="count">{urgent}</span>}
            {bellOpen && (
              <div className="dropdown-menu notif-menu" role="menu">
                <div className="head">
                  <b>Needs attention</b>
                  <span className="cell-sub">{alertList.length} items</span>
                </div>
                <div className="notif-list">
                  {alertList.length === 0 && <div className="empty">All clear — no alerts.</div>}
                  {alertList.map((a, i) => (
                    <Link to={MODULE_LINK[a.module] || '/'} className="alert-item" key={i}>
                      <span className={`alert-icon ${a.level}`}>
                        <BellRing size={15} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <b>{a.title}</b>
                        <p>{a.message}</p>
                        <div className="mt-1">
                          <Badge tone={a.level}>{LEVEL_LABEL[a.level]}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          <button className="icon-btn bordered" onClick={toggle} aria-label="Toggle theme" title="Toggle light / dark">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>
        <main className="content">
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} pages={pages} role={user?.role} />
    </div>
  );
}
