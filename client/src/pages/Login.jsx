import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, Factory, Home, Leaf, Lock, Mail, MapPinned, Megaphone, Phone, Recycle, ShieldCheck, User, UserCog, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import { Field } from '../components/ui';

const DEMO = [
  { role: 'Admin', email: 'admin@cleancity.gov', password: 'admin123', icon: ShieldCheck },
  { role: 'Supervisor', email: 'supervisor@cleancity.gov', password: 'super123', icon: UserCog },
  { role: 'Operator', email: 'operator@cleancity.gov', password: 'oper123', icon: Users },
  { role: 'Citizen', email: 'citizen@cleancity.gov', password: 'citizen123', icon: Home },
];

const FEATURES = [
  { icon: Recycle, title: 'Segregation' },
  { icon: Factory, title: 'Recycling plants' },
  { icon: Megaphone, title: 'Citizen requests' },
  { icon: MapPinned, title: 'Live truck map' },
];

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = async (fn, welcome) => {
    setBusy(true);
    try {
      const u = await fn();
      toast.success(`${welcome}, ${u.name.split(' ')[0]}`);
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'login') run(() => login(form.email, form.password), 'Welcome');
    else run(() => register(form), 'Welcome to CleanCity');
  };

  const isLogin = mode === 'login';

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="row" style={{ gap: 12 }}>
          <div className="logo-mark">
            <Leaf size={19} />
          </div>
          <b style={{ color: '#fff', fontSize: 17 }}>CleanCity</b>
        </div>

        <div>
          <h1>
            Track city waste, <em>from collection to disposal.</em>
          </h1>
          <div className="hero-features">
            {FEATURES.map((f) => (
              <div className="hero-feature" key={f.title}>
                <f.icon size={18} />
                <b>{f.title}</b>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#a898cc' }}>Municipal Corporation · Waste Management</div>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <h2>{isLogin ? 'Sign in' : 'Create citizen account'}</h2>
          {!isLogin && (
            <p className="text-2" style={{ marginTop: 6 }}>
              Report waste problems in your area and track the truck.
            </p>
          )}

          <div className="stack" style={{ gap: 14, marginTop: 22 }}>
            {!isLogin && (
              <Field label="Full name">
                <div className="input-icon">
                  <User size={16} />
                  <input className="input" required autoComplete="name" placeholder="Your name" value={form.name} onChange={set('name')} />
                </div>
              </Field>
            )}
            <Field label="Email">
              <div className="input-icon">
                <Mail size={16} />
                <input className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
              </div>
            </Field>
            {!isLogin && (
              <Field label="Phone">
                <div className="input-icon">
                  <Phone size={16} />
                  <input className="input" type="tel" autoComplete="tel" placeholder="Optional" value={form.phone} onChange={set('phone')} />
                </div>
              </Field>
            )}
            <Field label="Password" hint={isLogin ? undefined : 'At least 6 characters'}>
              <div className="input-icon">
                <Lock size={16} />
                <input
                  className="input"
                  type="password"
                  required
                  minLength={isLogin ? undefined : 6}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder="Password"
                  value={form.password}
                  onChange={set('password')}
                />
              </div>
            </Field>
            <button className="btn btn-primary" style={{ height: 44 }} disabled={busy}>
              {busy && <span className="spinner" style={{ width: 16, height: 16, borderTopColor: 'currentColor' }} />}
              {isLogin ? 'Sign in' : 'Create account'} <ArrowRight size={16} />
            </button>
            <p className="text-2" style={{ textAlign: 'center', fontSize: 13.5 }}>
              {isLogin ? 'Are you a citizen? ' : 'Already have an account? '}
              <button type="button" className="link-btn" onClick={() => setMode(isLogin ? 'register' : 'login')}>
                {isLogin ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </div>

          {isLogin && (
            <>
              <div className="divider">or try a demo account</div>
              <div className="demo-grid">
                {DEMO.map((d) => (
                  <button type="button" key={d.email} className="demo-acc" disabled={busy} onClick={() => run(() => login(d.email, d.password), 'Welcome')}>
                    <span className="stat-icon">
                      <d.icon size={17} />
                    </span>
                    <b>{d.role}</b>
                  </button>
                ))}
              </div>
            </>
          )}
        </form>
      </section>
    </div>
  );
}
