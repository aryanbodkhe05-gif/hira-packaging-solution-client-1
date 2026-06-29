import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Boxes, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ppGranulesDb, getList } from '../lib/db';
import { DEFAULT_GRANULE_TYPES, GRANULE_TYPES_KEY, granuleTypeColor, DEFAULT_BAG_WEIGHT_KG } from '../config';
import type { PPGranuleItem } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { ListSelect } from '../components/ui/ListSelect';
import { formatDate, cn } from '../lib/utils';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

// Bags remaining is derived from the running kg balance and the avg bag weight,
// so it stays live as stock is consumed in PP Fabric production.
function bagsRemaining(it: Pick<PPGranuleItem, 'currentStockKg' | 'bagWeightKg'>): number | undefined {
  return it.bagWeightKg && it.bagWeightKg > 0 ? it.currentStockKg / it.bagWeightKg : undefined;
}

const emptyItem: Omit<PPGranuleItem, 'id'> = {
  name: '', type: 'P.P.', supplier: '', costPerKg: undefined, currentStockKg: 0,
  bagWeightKg: undefined, dateReceived: today(), minStockAlert: undefined, grnRef: '', createdAt: '', updatedAt: '',
};

function ItemForm({ initial, onSave, onClose }: {
  initial: Omit<PPGranuleItem, 'id'>; onSave: (d: Omit<PPGranuleItem, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  // Bags is an entry-time quantity; we derive avg bag weight from kg ÷ bags on save.
  const [bags, setBags] = useState<number | undefined>(
    initial.bagWeightKg && initial.bagWeightKg > 0 ? +(initial.currentStockKg / initial.bagWeightKg).toFixed(2) : undefined
  );
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    if (!f.name.trim()) { toast.error('Name is required'); return; }
    if (!f.type) { toast.error('Type is required'); return; }
    const bagWeightKg = bags && bags > 0 ? +(f.currentStockKg / bags).toFixed(3) : f.bagWeightKg;
    onSave({ ...f, name: f.name.trim(), bagWeightKg, dateReceived: f.dateReceived || today() });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Type *</label>
          <ListSelect value={f.type} onChange={(v) => set('type', v)} listKey={GRANULE_TYPES_KEY} defaults={DEFAULT_GRANULE_TYPES} placeholder="Select type…" />
        </div>
        <div><label className="label">Name *</label><input className="input-field" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Virgin PP Grade A" autoFocus /></div>
        <div><label className="label">Current Stock (kg)</label><input className="input-field font-mono" type="number" step="any" value={f.currentStockKg || ''} onChange={(e) => set('currentStockKg', num(e.target.value))} /></div>
        <div><label className="label">Bags</label><input className="input-field font-mono" type="number" min="0" step="any" value={bags ?? ''} onChange={(e) => setBags(e.target.value === '' ? undefined : num(e.target.value))} placeholder="no. of bags" /></div>
        <div><label className="label">Date Received</label><input className="input-field" type="date" value={f.dateReceived} onChange={(e) => set('dateReceived', e.target.value)} /></div>
        <div><label className="label">Supplier</label><input className="input-field" value={f.supplier ?? ''} onChange={(e) => set('supplier', e.target.value)} /></div>
        <div><label className="label">Cost / kg (₹)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.costPerKg ?? ''} onChange={(e) => set('costPerKg', e.target.value === '' ? undefined : num(e.target.value))} /></div>
        <div><label className="label">Min Stock Alert (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.minStockAlert ?? ''} onChange={(e) => set('minStockAlert', e.target.value === '' ? undefined : num(e.target.value))} placeholder="optional" /></div>
        <div className="sm:col-span-2"><label className="label">GRN ref</label><input className="input-field font-mono" value={f.grnRef ?? ''} onChange={(e) => set('grnRef', e.target.value)} placeholder="optional" /></div>
      </div>
      {bags && bags > 0 && f.currentStockKg > 0 && (
        <p className="text-muted text-xs">≈ {(f.currentStockKg / bags).toFixed(1)} kg per bag — bags remaining update automatically as stock is consumed.</p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
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

  const typeOptions = useMemo(() => getList(GRANULE_TYPES_KEY, DEFAULT_GRANULE_TYPES), []);

  function handleSave(data: Omit<PPGranuleItem, 'id'>) {
    const now = new Date().toISOString();
    if (modal?.type === 'edit' && modal.row) { ppGranulesDb.update(modal.row.id, { ...data, updatedAt: now }); toast.success('Item updated'); }
    else { ppGranulesDb.create({ ...data, createdAt: now, updatedAt: now }); toast.success('Granule item added'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { ppGranulesDb.delete(id); toast.success('Item deleted'); reload(); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (!q || r.name.toLowerCase().includes(q) || (r.supplier ?? '').toLowerCase().includes(q)) && (!typeFilter || r.type === typeFilter))
      .sort((a, b) => (b.dateReceived || '').localeCompare(a.dateReceived || ''));   // newest receipts first
  }, [rows, search, typeFilter]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Per-type running balance (kg + bags remaining) across all types present
  const byType = useMemo(() => {
    const m: Record<string, { kg: number; bags: number; hasBags: boolean }> = {};
    for (const r of rows) {
      const e = (m[r.type] ??= { kg: 0, bags: 0, hasBags: false });
      e.kg += r.currentStockKg;
      const b = bagsRemaining(r);
      if (b != null) { e.bags += b; e.hasBags = true; }
    }
    return m;
  }, [rows]);

  const lowStock = rows.filter((r) => r.minStockAlert != null && r.currentStockKg <= r.minStockAlert).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">P.P. Granule Stock</h1><p className="text-muted text-sm mt-1">P.P, Filler, RP &amp; Colour tracked as separate items; stock deducts when used in PP Fabric</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Item</button>
      </div>

      {/* Per-type running balance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.entries(byType).map(([t, v]) => (
          <div key={t} className="glass-card p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className={cn('badge border text-xs', granuleTypeColor(t))}>{t}</span>
              <Boxes className="w-4 h-4 text-muted" />
            </div>
            <span className="font-mono text-xl font-bold text-white mt-1">{v.kg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} <span className="text-sm text-muted font-normal">kg</span></span>
            {v.hasBags && <span className="text-muted text-xs font-mono">≈ {Math.round(v.bags).toLocaleString('en-IN')} bags remaining</span>}
          </div>
        ))}
        <StatCard label="Low Stock Alerts" value={lowStock} icon={AlertTriangle} iconColor="text-red-400" mono />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or supplier…" className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Types</option>
          {typeOptions.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Type', 'Name', 'GRN', 'Stock (kg)', 'Bags Left', 'Min Alert', 'Received', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={Boxes} title="No granule items" action={{ label: 'Add First Item', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((r) => {
                const low = r.minStockAlert != null && r.currentStockKg <= r.minStockAlert;
                const bags = bagsRemaining(r);
                return (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell"><span className={cn('badge border text-xs', granuleTypeColor(r.type))}>{r.type}</span></td>
                    <td className="table-cell text-white/90 font-medium">{r.name}</td>
                    <td className="table-cell font-mono text-white/60 text-xs">{r.grnRef || '—'}</td>
                    <td className={cn('table-cell font-mono', low ? 'text-red-300' : 'text-white/80')}>{r.currentStockKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}{low && <span className="ml-1.5 text-[10px]">low</span>}</td>
                    <td className="table-cell font-mono text-white/70 text-xs">{bags != null ? Math.round(bags).toLocaleString('en-IN') : '—'}</td>
                    <td className="table-cell font-mono text-muted text-xs">{r.minStockAlert ?? '—'}</td>
                    <td className="table-cell text-muted text-xs whitespace-nowrap">{r.dateReceived ? formatDate(r.dateReceived) : '—'}</td>
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
