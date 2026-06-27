import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { suppliersDb } from '../lib/db';
import type { Supplier } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';

const PAGE_SIZE = 20;
const emptySupplier: Omit<Supplier, 'id'> = { name: '', contact: '', gst: '', materials: '', createdAt: '' };

function SupplierForm({ initial, onSave, onClose }: {
  initial: Omit<Supplier, 'id'>; onSave: (d: Omit<Supplier, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() { if (!f.name.trim()) { toast.error('Name is required'); return; } onSave({ ...f, name: f.name.trim() }); }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Name *</label><input className="input-field" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></div>
        <div><label className="label">Contact</label><input className="input-field" value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Phone / person" /></div>
        <div><label className="label">GST No.</label><input className="input-field font-mono" value={f.gst} onChange={(e) => set('gst', e.target.value)} /></div>
        <div><label className="label">Materials supplied</label><input className="input-field" value={f.materials} onChange={(e) => set('materials', e.target.value)} placeholder="BOPP film, ink…" /></div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Supplier</button>
      </div>
    </div>
  );
}

export function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>(() => suppliersDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; row?: Supplier } | null>(null);
  const reload = useCallback(() => setRows(suppliersDb.getAll()), []);

  function handleSave(data: Omit<Supplier, 'id'>) {
    const now = new Date().toISOString();
    if (modal?.type === 'edit' && modal.row) { suppliersDb.update(modal.row.id, data); toast.success('Supplier updated'); }
    else { suppliersDb.create({ ...data, createdAt: now }); toast.success('Supplier added'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { suppliersDb.delete(id); toast.success('Supplier deleted'); reload(); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.materials.toLowerCase().includes(q));
  }, [rows, search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">Suppliers</h1><p className="text-muted text-sm mt-1">Supplier master — name, contact, GST, materials supplied</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Supplier</button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or material…" className="input-field pl-9" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Name', 'Contact', 'GST', 'Materials', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={5}><EmptyState icon={Building2} title="No suppliers yet" action={{ label: 'Add First Supplier', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell text-white/90 font-medium">{r.name}</td>
                  <td className="table-cell text-white/70">{r.contact || '—'}</td>
                  <td className="table-cell font-mono text-white/70 text-xs">{r.gst || '—'}</td>
                  <td className="table-cell text-white/70">{r.materials || '—'}</td>
                  <td className="table-cell"><div className="flex gap-1.5">
                    <button onClick={() => setModal({ type: 'edit', row: r })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Supplier' : 'Edit Supplier'} size="md">
          <SupplierForm initial={modal.row ?? { ...emptySupplier }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
