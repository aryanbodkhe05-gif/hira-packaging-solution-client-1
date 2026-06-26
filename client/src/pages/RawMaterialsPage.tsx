import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import { rawMaterialsDb } from '../lib/db';
import { DEFAULT_RAW_MATERIALS, RAW_MATERIALS_KEY } from '../config';
import type { RawMaterial } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { ListSelect } from '../components/ui/ListSelect';
import { formatDate } from '../lib/utils';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

const emptyItem: Omit<RawMaterial, 'id'> = { name: '', unit: 'kg', quantity: 0, dateAdded: today() };

function ItemForm({ initial, onSave, onClose }: {
  initial: Omit<RawMaterial, 'id'>; onSave: (d: Omit<RawMaterial, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() { if (!f.name) { toast.error('Item name is required'); return; } onSave(f); }
  return (
    <div className="space-y-4">
      <div><label className="label">Item Name *</label><ListSelect value={f.name} onChange={(v) => set('name', v)} listKey={RAW_MATERIALS_KEY} defaults={DEFAULT_RAW_MATERIALS} placeholder="Select item…" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Unit</label><input className="input-field" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="kg / litre / bobbin" /></div>
        <div><label className="label">Quantity / Stock</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.quantity || ''} onChange={(e) => set('quantity', num(e.target.value))} /></div>
        <div className="col-span-2"><label className="label">Date</label><input className="input-field" type="date" value={f.dateAdded} onChange={(e) => set('dateAdded', e.target.value)} /></div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Item</button>
      </div>
    </div>
  );
}

export function RawMaterialsPage() {
  const [items, setItems] = useState<RawMaterial[]>(() => rawMaterialsDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; item?: RawMaterial } | null>(null);
  const reload = useCallback(() => setItems(rawMaterialsDb.getAll()), []);

  function handleSave(data: Omit<RawMaterial, 'id'>) {
    if (modal?.type === 'edit' && modal.item) { rawMaterialsDb.update(modal.item.id, data); toast.success('Item updated'); }
    else { rawMaterialsDb.create(data); toast.success('Item added'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { rawMaterialsDb.delete(id); toast.success('Item deleted'); reload(); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [items, search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const low = items.filter((m) => m.quantity < 20).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">Raw Materials</h1><p className="text-muted text-sm mt-1">Inks, solvents, thread, granules, adhesive — consumables stock</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Item</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Items" value={items.length} icon={FlaskConical} iconColor="text-accent" mono />
        <StatCard label="Low Stock (<20)" value={low} icon={FlaskConical} iconColor="text-red-400" mono />
        <StatCard label="Total Units" value={items.reduce((s, m) => s + (m.quantity || 0), 0).toLocaleString('en-IN')} icon={FlaskConical} iconColor="text-green-400" mono />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item…" className="input-field pl-9" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Item', 'Unit', 'Quantity', 'Date', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={5}><EmptyState icon={FlaskConical} title="No raw materials" action={{ label: 'Add First Item', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((m) => (
                <tr key={m.id} className="table-row">
                  <td className="table-cell text-white/90 font-medium">{m.name}</td>
                  <td className="table-cell text-muted text-xs">{m.unit}</td>
                  <td className={'table-cell font-mono ' + (m.quantity < 20 ? 'text-red-300' : 'text-white/80')}>{m.quantity.toLocaleString('en-IN')}</td>
                  <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(m.dateAdded)}</td>
                  <td className="table-cell"><div className="flex gap-1.5">
                    <button onClick={() => setModal({ type: 'edit', item: m })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Raw Material' : 'Edit Item'} size="md">
          <ItemForm initial={modal.item ?? { ...emptyItem, dateAdded: today() }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
