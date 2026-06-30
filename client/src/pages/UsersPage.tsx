import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, UserCog, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { formatDate, cn } from '../lib/utils';
import type { AuthUser, UserRole } from '../types';

// Developer is intentionally absent — it is never creatable from the UI.
const CREATABLE_ROLES: UserRole[] = ['OWNER', 'MANAGER', 'STAFF'];
const ROLE_COLORS: Record<string, string> = {
  DEVELOPER: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
  OWNER:   'bg-accent/20 text-accent border-accent/30',
  MANAGER: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  STAFF:   'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function errMsg(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

// ── Add / edit form ────────────────────────────────────────────────────────────
function UserForm({ initial, onSaved, onClose }: {
  initial?: AuthUser;
  onSaved: (creds?: { username: string; password: string }) => void;
  onClose: () => void;
}) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState<UserRole>(initial?.role ?? 'STAFF');
  const [active, setActive] = useState(initial?.active ?? true);
  const [useCustomPw, setUseCustomPw] = useState(false);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (useCustomPw && password.trim().length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      if (editing) {
        const body: Record<string, unknown> = { name: name.trim(), role, active };
        if (useCustomPw) body.password = password;
        const res = await api.patch(`/users/${initial!.id}`, body);
        toast.success('User updated');
        onSaved(res.data.credentials);
      } else {
        const body: Record<string, unknown> = { name: name.trim(), role };
        if (useCustomPw) body.password = password;
        const res = await api.post('/users', body);
        toast.success('User created');
        onSaved(res.data.credentials);
      }
    } catch (err) {
      toast.error(errMsg(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Name *</label><input className="input-field" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Amit Sharma" /></div>
        <div><label className="label">Role</label>
          <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {CREATABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {editing && (
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (unchecking revokes access immediately)
        </label>
      )}

      <div className="rounded-lg border border-accent/10 p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={useCustomPw} onChange={(e) => setUseCustomPw(e.target.checked)} />
          {editing ? 'Reset password to a custom value' : 'Set a custom password'}
        </label>
        {useCustomPw ? (
          <input className="input-field font-mono" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 characters" />
        ) : !editing ? (
          <p className="text-muted text-xs">Auto-generated: username (from name) + role, e.g. <span className="font-mono text-white/70">amitsharma{role.toLowerCase()}</span>. Shown once after creation.</p>
        ) : (
          <p className="text-muted text-xs">Leave unchecked to keep the current password.</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}</button>
      </div>
    </div>
  );
}

// ── Credentials shown exactly once after create / password reset ─────────────────
function CredentialsModal({ creds, onClose }: { creds: { username: string; password: string }; onClose: () => void }) {
  const copy = (text: string) => { navigator.clipboard?.writeText(text); toast.success('Copied'); };
  const both = `username: ${creds.username}\npassword: ${creds.password}`;
  return (
    <Modal open onClose={onClose} title="Credentials — copy them now" size="sm">
      <div className="space-y-4">
        <p className="text-yellow-300/90 text-xs flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Shown only once. Hand these to the user; you can reset later but can't view them again.</p>
        {(['username', 'password'] as const).map((k) => (
          <div key={k}>
            <label className="label">{k}</label>
            <div className="flex gap-2">
              <input readOnly value={creds[k]} className="input-field font-mono" />
              <button onClick={() => copy(creds[k])} className="btn-secondary px-3" title={`Copy ${k}`}><Copy className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        <div className="flex gap-3 pt-1">
          <button onClick={() => copy(both)} className="btn-secondary flex-1 justify-center"><Copy className="w-4 h-4" /> Copy both</button>
          <button onClick={onClose} className="btn-primary flex-1 justify-center">Done</button>
        </div>
      </div>
    </Modal>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; user?: AuthUser } | null>(null);
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users);
    } catch (err) {
      toast.error(errMsg(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(u: AuthUser) {
    if (!window.confirm(`Delete ${u.name}? This logs them out immediately.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(errMsg(err, 'Delete failed'));
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-header">Users &amp; Roles</h1>
          <p className="text-muted text-sm mt-1">Create logins with auto-generated credentials. Role controls access (Owner/Manager see ₹, Staff don't).</p>
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add User</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Name', 'Username', 'Role', 'Status', 'Created', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-10"><LoadingSpinner /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={UserCog} title="No users yet" description="Add Owner, Manager or Staff logins." action={{ label: 'Add First User', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="table-row">
                  <td className="table-cell text-white/90 font-medium">{u.name}</td>
                  <td className="table-cell font-mono text-white/70 text-sm">{u.username}</td>
                  <td className="table-cell"><span className={cn('badge border text-xs', ROLE_COLORS[u.role])}>{u.role}</span></td>
                  <td className="table-cell">
                    {u.active
                      ? <span className="text-green-300 text-xs flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Active</span>
                      : <span className="text-red-300 text-xs">Disabled</span>}
                  </td>
                  <td className="table-cell text-muted text-xs whitespace-nowrap">{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                  <td className="table-cell"><div className="flex gap-1.5">
                    <button onClick={() => setModal({ type: 'edit', user: u })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(u)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && <div className="px-5 py-2 border-t border-accent/10 text-muted text-xs">{users.length} user{users.length === 1 ? '' : 's'}</div>}
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add User' : 'Edit User'} size="md">
          <UserForm
            initial={modal.user}
            onClose={() => setModal(null)}
            onSaved={(c) => { setModal(null); load(); if (c) setCreds(c); }}
          />
        </Modal>
      )}

      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
    </div>
  );
}
