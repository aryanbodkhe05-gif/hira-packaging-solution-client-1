import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Boxes, Scale } from 'lucide-react';
import toast from 'react-hot-toast';
import { ppGranulesDb, getGranuleBalances } from '../lib/db';
import { DEFAULT_GRANULE_TYPES, GRANULE_TYPES_KEY } from '../config';
import type { PPGranule } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { ListSelect } from '../components/ui/ListSelect';
import { formatDate, cn } from '../lib/utils';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

const emptyGranule: Omit<PPGranule, 'id'> = { type: '', kg: 0, bags: 0, dateReceived: today(), supplier: '', grnRef: '' };

function GranuleForm({ initial, onSave, onClose }: {
  initial: Omit<PPGranule, 'id'>; onSave: (d: Omit<PPGranule, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.type) { toast.error('Type is required'); return; }
    if (!f.kg && !f.bags) { toast.error('Enter KG or Bags'); return; }
    onSave(f);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Type *</label><ListSelect value={f.type} onChange={(v) => set('type', v)} listKey={GRANULE_TYPES_KEY} defaults={DEFAULT_GRANULE_TYPES} placeholder="Select type…" /></div>
        <div><label className="label">Date received</label><input className="input-field" type="date" value={f.dateReceived} onChange={(e) => set('dateReceived', e.target.value)} /></div>
        <div><label className="label">Quantity (KG)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.kg || ''} onChange={(e) => set('kg', num(e.target.value))} /></div>
        <div><label className="label">Quantity (Bags)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.bags || ''} onChange={(e) => set('bags', num(e.target.value))} /></div>
        <div><label className="label">Supplier (optional)</label><input className="input-field" value={f.supplier ?? ''} onChange={(e) => set('supplier', e.target.value)} /></div>
        <div><label className="label">GRN ref (optional)</label><input className="input-field font-mono" value={f.grnRef ?? ''} onChange={(e) => set('grnRef', e.target.value)} /></div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Entry</button>
      </div>
    </div>
  );
}

export function PPGranuleStockPage() {
  const [rows, setRows] = useState<PPGranule[]>(() => ppGranulesDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; row?: PPGranule } | null>(null);
  const reload = useCallback(() => setRows(ppGranulesDb.getAll()), []);

  const balances = useMemo(() => { void rows; return getGranuleBalances(); }, [rows]);

  function handleSave(data: Omit<PPGranule, 'id'>) {
    if (modal?.type === 'edit' && modal.row) { ppGranulesDb.update(modal.row.id, data); toast.success('Entry updated'); }
    else { ppGranulesDb.create(data); toast.success('Granule stock added'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { ppGranulesDb.delete(id); toast.success('Entry deleted'); reload(); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || r.type.toLowerCase().includes(q) || (r.supplier ?? '').toLowerCase().includes(q));
  }, [rows, search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">P.P. Granule Stock</h1><p className="text-muted text-sm mt-1">Granule receipts with running balance per type (consumed by PP Fabric)</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Granule</button>
      </div>

      {/* Per-type running balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {balances.length === 0 ? (
          <p className="text-muted text-sm">No granule stock yet.</p>
        ) : balances.map((b) => (
          <div key={b.type} className="glass-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">{b.type}</p>
              <Scale className="w-4 h-4 text-accent" />
            </div>
            <p className={cn('font-mono text-2xl font-bold mt-1', b.remainingKg <= 0 ? 'text-red-300' : 'text-white')}>{b.remainingKg.toLocaleString('en-IN')} <span className="text-sm text-muted">kg left</span></p>
            <p className="text-muted text-xs mt-1">Received {b.receivedKg.toLocaleString('en-IN')} kg · {b.receivedBags} bags · Consumed {b.consumedKg.toLocaleString('en-IN')} kg</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search type or supplier…" className="input-field pl-9" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Type', 'KG', 'Bags', 'Date received', 'Supplier', 'GRN', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Boxes} title="No granule stock" action={{ label: 'Add First Entry', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell text-white/90 font-medium">{r.type}</td>
                  <td className="table-cell font-mono text-white/80">{r.kg.toLocaleString('en-IN')}</td>
                  <td className="table-cell font-mono text-white/70">{r.bags}</td>
                  <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(r.dateReceived)}</td>
                  <td className="table-cell text-white/70">{r.supplier || '—'}</td>
                  <td className="table-cell font-mono text-white/60 text-xs">{r.grnRef || '—'}</td>
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
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Granule Stock' : 'Edit Entry'} size="lg">
          <GranuleForm initial={modal.row ?? { ...emptyGranule, dateReceived: today() }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
