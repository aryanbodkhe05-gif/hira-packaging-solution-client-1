import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, UserCog, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersDb } from '../lib/db';
import { USER_ROLES } from '../config';
import type { User, UserRole } from '../types';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { canEditRates, getViewRole, setViewRole } from '../lib/roles';
import { cn } from '../lib/utils';

const ROLE_COLORS: Record<UserRole, string> = {
  OWNER:   'bg-accent/20 text-accent border-accent/30',
  MANAGER: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  STAFF:   'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const emptyUser: Omit<User, 'id'> = { name: '', email: '', role: 'STAFF', phone: '' };

function UserForm({ initial, onSave, onClose }: {
  initial: Omit<User, 'id'>; onSave: (d: Omit<User, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.name.trim()) { toast.error('Name is required'); return; }
    onSave({ ...f, name: f.name.trim() });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Name *</label><input className="input-field" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></div>
        <div><label className="label">Role</label>
          <select className="input-field" value={f.role} onChange={(e) => set('role', e.target.value as UserRole)}>
            {USER_ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div><label className="label">Email</label><input className="input-field" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.in" /></div>
        <div><label className="label">Phone</label><input className="input-field font-mono" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></div>
      </div>
      <p className="text-muted text-xs">Owner / Manager can view costs; Staff sees quantities only.</p>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save User</button>
      </div>
    </div>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>(() => usersDb.getAll());
  const [activeRole, setActiveRole] = useState<UserRole>(() => getViewRole());
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; user?: User } | null>(null);
  const reload = useCallback(() => setUsers(usersDb.getAll()), []);

  if (!canEditRates()) return <Navigate to="/" replace />;

  function handleSave(data: Omit<User, 'id'>) {
    if (modal?.type === 'edit' && modal.user) { usersDb.update(modal.user.id, data); toast.success('User updated'); }
    else { usersDb.create(data); toast.success('User added'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { usersDb.delete(id); toast.success('User deleted'); reload(); }
  function setActive(u: User) { setViewRole(u.role); setActiveRole(u.role); toast.success(`Now viewing as ${u.name} (${u.role})`); }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">Users &amp; Roles</h1><p className="text-muted text-sm mt-1">Manage users; role drives cost visibility (Owner/Manager see ₹, Staff don't)</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add User</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Name', 'Role', 'Email', 'Phone', 'Active view', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={UserCog} title="No users yet" action={{ label: 'Add First User', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="table-row">
                  <td className="table-cell text-white/90 font-medium">{u.name}</td>
                  <td className="table-cell"><span className={cn('badge border text-xs', ROLE_COLORS[u.role])}>{u.role}</span></td>
                  <td className="table-cell text-white/70 text-sm">{u.email || '—'}</td>
                  <td className="table-cell font-mono text-white/70 text-xs">{u.phone || '—'}</td>
                  <td className="table-cell">
                    {activeRole === u.role
                      ? <span className="text-green-300 text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {u.role}</span>
                      : <button onClick={() => setActive(u)} className="text-xs text-accent hover:underline">View as this</button>}
                  </td>
                  <td className="table-cell"><div className="flex gap-1.5">
                    <button onClick={() => setModal({ type: 'edit', user: u })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-accent/10 text-muted text-xs">{users.length} users · active view role: <span className="text-white/80">{activeRole}</span></div>
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add User' : 'Edit User'} size="md">
          <UserForm initial={modal.user ?? { ...emptyUser }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
