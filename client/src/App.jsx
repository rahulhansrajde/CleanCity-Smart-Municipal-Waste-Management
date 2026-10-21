import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { canSee, homeFor } from './utils/access';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Segregation from './pages/Segregation';
import Wards from './pages/Wards';
import Fleet from './pages/Fleet';
import Plants from './pages/Plants';
import PlantDetail from './pages/PlantDetail';
import Landfills from './pages/Landfills';
import LandfillDetail from './pages/LandfillDetail';
import Reports from './pages/Reports';
import Users from './pages/Users';
import NotFound from './pages/NotFound';
import LiveMapPage from './pages/LiveMapPage';
import Requests from './pages/Requests';
import MyRequests from './pages/MyRequests';

function Splash() {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <div className="spinner" />
    </div>
  );
}

// Renders the page only for roles allowed to see it; others go to their home page.
function Guard({ page, children }) {
  const { user } = useAuth();
  return canSee(user.role, page) ? children : <Navigate to={homeFor(user.role)} replace />;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;

  if (!user)
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Guard page="dashboard"><Dashboard /></Guard>} />
        <Route path="map" element={<Guard page="map"><LiveMapPage /></Guard>} />
        <Route path="requests" element={<Guard page="requests"><Requests /></Guard>} />
        <Route path="my-requests" element={<Guard page="myRequests"><MyRequests /></Guard>} />
        <Route path="segregation" element={<Guard page="segregation"><Segregation /></Guard>} />
        <Route path="wards" element={<Guard page="wards"><Wards /></Guard>} />
        <Route path="fleet" element={<Guard page="fleet"><Fleet /></Guard>} />
        <Route path="plants" element={<Guard page="plants"><Plants /></Guard>} />
        <Route path="plants/:id" element={<Guard page="plants"><PlantDetail /></Guard>} />
        <Route path="landfills" element={<Guard page="landfills"><Landfills /></Guard>} />
        <Route path="landfills/:id" element={<Guard page="landfills"><LandfillDetail /></Guard>} />
        <Route path="reports" element={<Guard page="reports"><Reports /></Guard>} />
        <Route path="users" element={<Guard page="users"><Users /></Guard>} />
        <Route path="login" element={<Navigate to={homeFor(user.role)} replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
