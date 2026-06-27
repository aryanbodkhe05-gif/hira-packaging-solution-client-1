import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Boxes, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ppGranulesDb } from '../lib/db';
import { GRANULE_TYPES, GRANULE_TYPE_COLORS } from '../config';
import type { GranuleType } from '../config';
import type { PPGranuleItem } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { formatDate, cn } from '../lib/utils';

const PAGE_SIZE = 20;
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

const emptyItem: Omit<PPGranuleItem, 'id'> = {
  name: '', type: 'P.P.', supplier: '', costPerKg: undefined, currentStockKg: 0, minStockAlert: undefined, grnRef: '', createdAt: '', updatedAt: '',
};

function ItemForm({ initial, onSave, onClose }: {
  initial: Omit<PPGranuleItem, 'id'>; onSave: (d: Omit<PPGranuleItem, 'id'>) => void; onClose: () => void;
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
        <div><label className="label">Type *</label>
          <select className="input-field" value={f.type} onChange={(e) => set('type', e.target.value as GranuleType)}>
            {GRANULE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div><label className="label">Name *</label><input className="input-field" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Virgin PP Grade A" autoFocus /></div>
        <div><label className="label">Supplier</label><input className="input-field" value={f.supplier ?? ''} onChange={(e) => set('supplier', e.target.value)} /></div>
        <div><label className="label">Cost / kg (₹)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.costPerKg ?? ''} onChange={(e) => set('costPerKg', e.target.value === '' ? undefined : num(e.target.value))} /></div>
        <div><label className="label">Current Stock (kg)</label><input className="input-field font-mono" type="number" step="any" value={f.currentStockKg || ''} onChange={(e) => set('currentStockKg', num(e.target.value))} /></div>
        <div><label className="label">Min Stock Alert (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.minStockAlert ?? ''} onChange={(e) => set('minStockAlert', e.target.value === '' ? undefined : num(e.target.value))} placeholder="optional" /></div>
        <div className="sm:col-span-2"><label className="label">GRN ref</label><input className="input-field font-mono" value={f.grnRef ?? ''} onChange={(e) => set('grnRef', e.target.value)} placeholder="optional" /></div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Item</button>
      </div>
    </div>
  );
}

export function PPGranuleStockPage() {
  const [rows, setRows] = useState<PPGranuleItem[]>(() => ppGranulesDb.getAll());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; row?: PPGranuleItem } | null>(null);
  const reload = useCallback(() => setRows(ppGranulesDb.getAll()), []);

  function handleSave(data: Omit<PPGranuleItem, 'id'>) {
    const now = new Date().toISOString();
    if (modal?.type === 'edit' && modal.row) { ppGranulesDb.update(modal.row.id, { ...data, updatedAt: now }); toast.success('Item updated'); }
    else { ppGranulesDb.create({ ...data, createdAt: now, updatedAt: now }); toast.success('Granule item added'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { ppGranulesDb.delete(id); toast.success('Item deleted'); reload(); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (!q || r.name.toLowerCase().includes(q) || (r.supplier ?? '').toLowerCase().includes(q)) && (!typeFilter || r.type === typeFilter));
  }, [rows, search, typeFilter]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const ppKg = rows.filter((r) => r.type === 'P.P.').reduce((s, r) => s + r.currentStockKg, 0);
  const fillerKg = rows.filter((r) => r.type === 'Filler').reduce((s, r) => s + r.currentStockKg, 0);
  const lowStock = rows.filter((r) => r.minStockAlert != null && r.currentStockKg <= r.minStockAlert).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">P.P. Granule Stock</h1><p className="text-muted text-sm mt-1">P.P and Filler tracked as separate items; stock deducts when used in PP Fabric</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Item</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="P.P. Stock (kg)" value={ppKg.toLocaleString('en-IN')} icon={Boxes} iconColor="text-blue-400" mono />
        <StatCard label="Filler Stock (kg)" value={fillerKg.toLocaleString('en-IN')} icon={Boxes} iconColor="text-orange-400" mono />
        <StatCard label="Low Stock Alerts" value={lowStock} icon={AlertTriangle} iconColor="text-red-400" mono />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or supplier…" className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Types</option>
          {GRANULE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Type', 'Name', 'GRN', 'Current Stock (kg)', 'Min Alert', 'Updated', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Boxes} title="No granule items" action={{ label: 'Add First Item', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((r) => {
                const low = r.minStockAlert != null && r.currentStockKg <= r.minStockAlert;
                const tint = r.type === 'P.P.' ? 'bg-blue-500/5' : r.type === 'Filler' ? 'bg-orange-500/5' : '';
                return (
                  <tr key={r.id} className={cn('table-row', tint)}>
                    <td className="table-cell"><span className={cn('badge border text-xs', GRANULE_TYPE_COLORS[r.type])}>{r.type}</span></td>
                    <td className="table-cell text-white/90 font-medium">{r.name}</td>
                    <td className="table-cell font-mono text-white/60 text-xs">{r.grnRef || '—'}</td>
                    <td className={cn('table-cell font-mono', low ? 'text-red-300' : 'text-white/80')}>{r.currentStockKg.toLocaleString('en-IN')}{low && <span className="ml-1.5 text-[10px]">low</span>}</td>
                    <td className="table-cell font-mono text-muted text-xs">{r.minStockAlert ?? '—'}</td>
                    <td className="table-cell text-muted text-xs whitespace-nowrap">{r.updatedAt ? formatDate(r.updatedAt) : '—'}</td>
                    <td className="table-cell"><div className="flex gap-1.5">
                      <button onClick={() => setModal({ type: 'edit', row: r })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Granule Item' : 'Edit Item'} size="lg">
          <ItemForm initial={modal.row ?? { ...emptyItem }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
