import { Home, Pencil, Plus, ShieldCheck, Trash2, UserCog, Users as UsersIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { del, errMsg, get, post, put } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useEditor } from '../hooks/useEditor';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { FormModal } from '../components/Modal';
import { Badge, Card, ErrorBox, Field, PageHeader, Skeleton } from '../components/ui';
import { ROLES } from '../utils/constants';
import { fmtDate, initials } from '../utils/format';

const ROLE_INFO = {
  admin: { icon: ShieldCheck, text: 'Can do everything' },
  supervisor: { icon: UserCog, text: 'Manages wards, vehicles and sites' },
  operator: { icon: UsersIcon, text: 'Adds daily records' },
  citizen: { icon: Home, text: 'Reports problems in their area' },
};

const blank = { name: '', email: '', password: '', role: 'operator', phone: '', department: '', active: true };
const fromDoc = (u) => ({ ...u, password: '' });

export default function Users() {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useAsync(() => get('/users'), []);
  const editor = useEditor(blank, fromDoc);

  const save = () =>
    editor.submit(
      (form, editing) => (editing ? put(`/users/${editing._id}`, form) : post('/users', form)),
      editor.editing ? 'User updated' : 'User created'
    ).then((ok) => ok && reload());

  const remove = async (u) => {
    if (!(await confirm({ title: `Delete ${u.name}?`, message: 'This user will lose access immediately.' }))) return;
    try {
      await del(`/users/${u._id}`);
      toast.success('User deleted');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <PageHeader icon={UsersIcon} title="Users" subtitle="Who can use CleanCity.">
        <button className="btn btn-primary" onClick={() => editor.open()}>
          <Plus size={16} /> Add user
        </button>
      </PageHeader>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        {ROLES.map((r) => {
          const Info = ROLE_INFO[r];
          return (
            <div className="card card-pad row" key={r} style={{ gap: 14 }}>
              <span className="stat-icon">
                <Info.icon size={18} />
              </span>
              <div>
                <b style={{ textTransform: 'capitalize' }}>
                  {r} · {(data || []).filter((u) => u.role === r).length}
                </b>
                <div className="cell-sub">{Info.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <Card bodyClass="">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data && loading && (
                <tr>
                  <td colSpan={7}>
                    <Skeleton height={120} />
                  </td>
                </tr>
              )}
              {(data || []).map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="row">
                      <span className="avatar">{initials(u.name)}</span>
                      <div>
                        <div className="cell-main">
                          {u.name} {u._id === me._id && <span className="muted">(you)</span>}
                        </div>
                        <div className="cell-sub">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge brand" style={{ textTransform: 'capitalize' }}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.department || '—'}</td>
                  <td className="nowrap">{u.phone || '—'}</td>
                  <td>{u.active ? <Badge tone="good">Active</Badge> : <Badge tone="neutral">Disabled</Badge>}</td>
                  <td className="nowrap">{fmtDate(u.createdAt)}</td>
                  <td className="actions">
                    <button className="icon-btn" onClick={() => editor.open(u)} aria-label="Edit user">
                      <Pencil size={15} />
                    </button>
                    {u._id !== me._id && (
                      <button className="icon-btn danger" onClick={() => remove(u)} aria-label="Delete user">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <FormModal open={editor.isOpen} title={editor.editing ? `Edit ${editor.editing.name}` : 'Add user'} onClose={editor.close} onSubmit={save} saving={editor.saving}>
        <div className="form-grid">
          <Field label="Full name *">
            <input className="input" required {...editor.bind('name')} />
          </Field>
          <Field label="Email *">
            <input className="input" type="email" required {...editor.bind('email')} />
          </Field>
          <Field label={editor.editing ? 'New password' : 'Password *'} hint={editor.editing ? 'Leave blank to keep current password' : 'Minimum 6 characters'}>
            <input className="input" type="password" minLength={6} required={!editor.editing} autoComplete="new-password" {...editor.bind('password')} />
          </Field>
          <Field label="Role">
            <select className="select" {...editor.bind('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r[0].toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <input className="input" {...editor.bind('department')} />
          </Field>
          <Field label="Phone">
            <input className="input" {...editor.bind('phone')} />
          </Field>
          <label className="check full">
            <input type="checkbox" {...editor.bindCheck('active')} /> Account active
          </label>
        </div>
      </FormModal>
    </>
  );
}
