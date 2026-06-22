import { useState, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, IndianRupee, Tags, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { rateMasterDb } from '../lib/db';
import { RATE_CATEGORIES } from '../config';
import type { RateCategory } from '../config';
import type { RateMasterItem } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { canEditRates } from '../lib/roles';
import { formatINR } from '../lib/jobcard';
import { formatDate, cn } from '../lib/utils';

const emptyItem: Omit<RateMasterItem, 'id'> = {
  name: '', unit: '₹/kg', rate: null, category: 'Printing', active: true, createdAt: '', updatedAt: '',
};

const CATEGORY_COLORS: Record<RateCategory, string> = {
  Printing:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Metalize:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Slitting:   'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Lamination: 'bg-green-500/20 text-green-300 border-green-500/30',
  Cutting:    'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Dispatch:   'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Any:        'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function RateForm({ initial, onSave, onClose }: {
  initial: Omit<RateMasterItem, 'id'>;
  onSave: (d: Omit<RateMasterItem, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.name.trim()) { toast.error('Material name is required'); return; }
    if (f.rate != null && f.rate < 0) { toast.error('Rate cannot be negative'); return; }
    onSave({ ...f, name: f.name.trim(), unit: f.unit.trim() || '₹/kg' });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Material name *</label>
          <input className="input-field" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="BOPP film – Glossy" autoFocus />
        </div>
        <div>
          <label className="label">Stage / category</label>
          <select className="input-field" value={f.category} onChange={(e) => set('category', e.target.value as RateCategory)}>
            {RATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Unit</label>
          <input className="input-field" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="₹/kg" />
        </div>
        <div>
          <label className="label">Rate (₹)</label>
          <input className="input-field font-mono" type="number" min="0" step="any"
            value={f.rate ?? ''} onChange={(e) => set('rate', e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="leave blank if not set" />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-primary" checked={f.active} onChange={(e) => set('active', e.target.checked)} />
            <span className="text-sm text-white/80">Active</span>
          </label>
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Rate</button>
      </div>
    </div>
  );
}

export function RateMasterPage() {
  const [items, setItems] = useState<RateMasterItem[]>(() => rateMasterDb.getAll());
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; item?: RateMasterItem } | null>(null);

  const reload = useCallback(() => setItems(rateMasterDb.getAll()), []);

  // Owner/Manager only — Staff is redirected away
  if (!canEditRates()) return <Navigate to="/job-card" replace />;

  function handleSave(data: Omit<RateMasterItem, 'id'>) {
    const now = new Date().toISOString();
    if (modal?.type === 'edit' && modal.item) {
      rateMasterDb.update(modal.item.id, { ...data, updatedAt: now });
      toast.success('Rate updated');
    } else {
      rateMasterDb.create({ ...data, createdAt: now, updatedAt: now });
      toast.success('Rate added');
    }
    setModal(null);
    reload();
  }
  function handleDelete(id: string) {
    rateMasterDb.delete(id);
    toast.success('Rate deleted');
    reload();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) =>
      (!q || m.name.toLowerCase().includes(q)) && (!catFilter || m.category === catFilter)
    );
  }, [items, search, catFilter]);

  const unset = items.filter((m) => m.active && m.rate == null).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header flex items-center gap-2">Rate Master <Lock className="w-4 h-4 text-muted" /></h1>
        <p className="text-muted text-sm mt-1">Owner-maintained raw-material rates that drive live Job Card costing</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Materials" value={items.length} icon={Tags} iconColor="text-accent" mono />
        <StatCard label="Active" value={items.filter((m) => m.active).length} icon={IndianRupee} iconColor="text-green-400" mono />
        <StatCard label="Rate Not Set" value={unset} icon={IndianRupee} iconColor="text-red-400" mono />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search material…" className="input-field pl-9" />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Stages</option>
          {RATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Rate</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Material', 'Stage', 'Unit', 'Rate', 'Active', 'Updated', ''].map((h) => (
                  <th key={h} className="table-header whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}>
                  <EmptyState icon={Tags} title="No rates" action={{ label: 'Add First Rate', onClick: () => setModal({ type: 'add' }) }} />
                </td></tr>
              ) : filtered.map((m) => (
                <tr key={m.id} className={cn('table-row', !m.active && 'opacity-50')}>
                  <td className="table-cell text-white/90 font-medium">{m.name}</td>
                  <td className="table-cell"><span className={cn('badge border text-xs', CATEGORY_COLORS[m.category])}>{m.category}</span></td>
                  <td className="table-cell text-muted text-xs">{m.unit}</td>
                  <td className="table-cell font-mono">
                    {m.rate == null ? <span className="text-red-300 text-xs">not set</span> : <span className="text-white/90">{formatINR(m.rate)}</span>}
                  </td>
                  <td className="table-cell">{m.active ? <span className="text-green-300 text-xs">Yes</span> : <span className="text-muted text-xs">No</span>}</td>
                  <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(m.updatedAt)}</td>
                  <td className="table-cell">
                    <div className="flex gap-1.5">
                      <button onClick={() => setModal({ type: 'edit', item: m })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-accent/10 text-muted text-xs">{filtered.length} materials</div>
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Rate' : 'Edit Rate'} size="md">
          <RateForm initial={modal.item ?? { ...emptyItem }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
