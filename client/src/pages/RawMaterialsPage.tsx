import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, FlaskConical, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { rawMaterialsDb, rawMaterialBatchesDb, syncBatchStock } from '../lib/db';
import { fifoOrder } from '../lib/batches';
import { canViewCosts } from '../lib/roles';
import { DEFAULT_RAW_MATERIALS, RAW_MATERIALS_KEY } from '../config';
import type { RawMaterial, RawMaterialBatch } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { TypeAhead, rememberTypeAhead } from '../components/ui/TypeAhead';
import { formatDate } from '../lib/utils';
import { formatINR } from '../lib/jobcard';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

// ── Item form: name + unit only. Stock and rate live on batches. ───────────────
function ItemForm({ initial, onSave, onClose }: {
  initial: Omit<RawMaterial, 'id'>; onSave: (d: Omit<RawMaterial, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.name.trim()) { toast.error('Item name is required'); return; }
    rememberTypeAhead(RAW_MATERIALS_KEY, f.name, DEFAULT_RAW_MATERIALS);
    onSave({ ...f, name: f.name.trim() });
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Item Name *</label>
        <TypeAhead value={f.name} onChange={(v) => set('name', v)} listKey={RAW_MATERIALS_KEY}
          defaults={DEFAULT_RAW_MATERIALS} placeholder="Type a few letters…" autoFocus />
        <p className="text-muted text-[11px] mt-1">Free text — saved to your item list for next time.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Unit</label><input className="input-field" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="kg / litre / bobbin" /></div>
        <div><label className="label">Date</label><input className="input-field" type="date" value={f.dateAdded} onChange={(e) => set('dateAdded', e.target.value)} /></div>
      </div>
      <p className="text-muted text-xs bg-white/5 rounded-lg px-3 py-2">
        Stock and rate are recorded per batch. Add a batch after saving the item.
      </p>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Item</button>
      </div>
    </div>
  );
}

// ── Batch form: qty + rate + date. Rate is optional and can be filled in later. ──
function BatchForm({ initial, unit, onSave, onClose }: {
  initial: Omit<RawMaterialBatch, 'id'>; unit: string;
  onSave: (d: Omit<RawMaterialBatch, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const [rateText, setRateText] = useState(initial.rate == null ? '' : String(initial.rate));
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.qty) { toast.error('Quantity is required'); return; }
    const rate = rateText.trim() === '' ? null : num(rateText);
    onSave({ ...f, rate, remaining: f.qty });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Quantity Received * ({unit})</label>
          <input className="input-field font-mono" type="number" min="0" step="any" autoFocus
            value={f.qty || ''} onChange={(e) => set('qty', num(e.target.value))} />
        </div>
        <div>
          <label className="label">Rate (₹/{unit})</label>
          <input className="input-field font-mono" type="number" min="0" step="any"
            value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder="leave blank if not known" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Receipt Date</label><input className="input-field" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label className="label">Note</label><input className="input-field" value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="supplier / invoice" /></div>
      </div>
      {rateText.trim() === '' && (
        <p className="text-yellow-300/90 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          Saved without a rate. This batch is excluded from cost totals until you price it — it is never counted as ₹0.
        </p>
      )}
      <p className="text-muted text-xs">Consumption draws from the oldest batch with stock left, so this batch is used at its own rate.</p>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Batch</button>
      </div>
    </div>
  );
}

export function RawMaterialsPage() {
  const [items, setItems] = useState<RawMaterial[]>(() => rawMaterialsDb.getAll());
  const [batches, setBatches] = useState<RawMaterialBatch[]>(() => rawMaterialBatchesDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; item?: RawMaterial } | null>(null);
  const [batchModal, setBatchModal] = useState<{ item: RawMaterial; batch?: RawMaterialBatch } | null>(null);
  const showCosts = canViewCosts();

  const reload = useCallback(() => {
    syncBatchStock();
    setItems(rawMaterialsDb.getAll());
    setBatches(rawMaterialBatchesDb.getAll());
  }, []);

  function handleSave(data: Omit<RawMaterial, 'id'>) {
    if (modal?.type === 'edit' && modal.item) { rawMaterialsDb.update(modal.item.id, data); toast.success('Item updated'); }
    else { rawMaterialsDb.create(data); toast.success('Item added — now add its first batch'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) {
    rawMaterialBatchesDb.getAll().filter((b) => b.materialId === id).forEach((b) => rawMaterialBatchesDb.delete(b.id));
    rawMaterialsDb.delete(id); toast.success('Item and its batches deleted'); reload();
  }
  function handleBatchSave(data: Omit<RawMaterialBatch, 'id'>) {
    if (batchModal?.batch) { rawMaterialBatchesDb.update(batchModal.batch.id, data); toast.success('Batch updated'); }
    else { rawMaterialBatchesDb.create(data); toast.success('Batch received'); }
    setBatchModal(null); reload();
  }
  function handleBatchDelete(id: string) { rawMaterialBatchesDb.delete(id); toast.success('Batch deleted'); reload(); }

  const batchesFor = useCallback((id: string) => fifoOrder(batches.filter((b) => b.materialId === id)), [batches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [items, search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const low = items.filter((m) => m.quantity < 20).length;
  const unpriced = batches.filter((b) => b.rate == null && b.remaining > 0).length;

  // Value on hand only counts priced batches — unpriced stock is never ₹0.
  const stockValue = batches.reduce((s, b) => s + (b.rate != null ? b.remaining * b.rate : 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-header">Raw Materials</h1>
          <p className="text-muted text-sm mt-1">Inks, solvents, thread, adhesive — stocked in batches, each at its own rate</p>
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Item</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Items" value={items.length} icon={FlaskConical} iconColor="text-accent" mono />
        <StatCard label="Low Stock (<20)" value={low} icon={FlaskConical} iconColor="text-red-400" mono />
        <StatCard label="Batches Unpriced" value={unpriced} icon={AlertTriangle} iconColor="text-yellow-400" mono />
        {showCosts && <StatCard label="Priced Stock Value" value={formatINR(stockValue)} icon={FlaskConical} iconColor="text-green-400" mono />}
      </div>

      {unpriced > 0 && (
        <div className="glass-card border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 flex gap-2 text-sm text-yellow-200/90">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{unpriced} batch{unpriced === 1 ? '' : 'es'} in stock ha{unpriced === 1 ? 's' : 've'} no rate set. Their consumption is left out of cost totals until priced.</span>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item…" className="input-field pl-9" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['', 'Item', 'Unit', 'In Stock', 'Batches', 'Date', ''].map((h, i) => <th key={i} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={FlaskConical} title="No raw materials" action={{ label: 'Add First Item', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((m) => {
                const bs = batchesFor(m.id);
                const open = !!expanded[m.id];
                const anyUnpriced = bs.some((b) => b.rate == null && b.remaining > 0);
                return (
                  <>
                    <tr key={m.id} className="table-row">
                      <td className="table-cell w-8">
                        <button onClick={() => setExpanded((p) => ({ ...p, [m.id]: !p[m.id] }))}
                          className="p-1 rounded hover:bg-white/10 text-muted hover:text-white" title="Show batches">
                          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="table-cell text-white/90 font-medium">
                        {m.name}
                        {anyUnpriced && <span className="ml-2 badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px]">rate not set</span>}
                      </td>
                      <td className="table-cell text-muted text-xs">{m.unit}</td>
                      <td className={'table-cell font-mono ' + (m.quantity < 20 ? 'text-red-300' : 'text-white/80')}>{m.quantity.toLocaleString('en-IN')}</td>
                      <td className="table-cell font-mono text-muted text-xs">{bs.length}</td>
                      <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(m.dateAdded)}</td>
                      <td className="table-cell"><div className="flex gap-1.5">
                        <button onClick={() => setBatchModal({ item: m })} title="Receive batch"
                          className="p-1.5 rounded hover:bg-primary/20 text-muted hover:text-accent transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setModal({ type: 'edit', item: m })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div></td>
                    </tr>
                    {open && (
                      <tr key={m.id + '-batches'}>
                        <td colSpan={7} className="px-5 py-3 bg-navy/40">
                          {bs.length === 0 ? (
                            <p className="text-muted text-xs">No batches yet — receive one to give this item stock and a rate.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead><tr className="text-muted">
                                <th className="text-left py-1 font-medium">Received</th>
                                <th className="text-left py-1 font-medium">Qty</th>
                                <th className="text-left py-1 font-medium">Remaining</th>
                                <th className="text-left py-1 font-medium">Rate</th>
                                <th className="text-left py-1 font-medium">Note</th>
                                <th></th>
                              </tr></thead>
                              <tbody>
                                {bs.map((b, i) => (
                                  <tr key={b.id} className="border-t border-white/5">
                                    <td className="py-1.5 font-mono text-white/70 whitespace-nowrap">
                                      {formatDate(b.date)}
                                      {i === 0 && b.remaining > 0 && <span className="ml-2 text-accent text-[10px]">next out</span>}
                                    </td>
                                    <td className="py-1.5 font-mono text-white/70">{b.qty.toLocaleString('en-IN')}</td>
                                    <td className={'py-1.5 font-mono ' + (b.remaining <= 0 ? 'text-muted' : 'text-white/90')}>
                                      {b.remaining.toLocaleString('en-IN')}{b.remaining <= 0 && ' (used up)'}
                                    </td>
                                    <td className="py-1.5 font-mono">
                                      {b.rate == null
                                        ? <span className="badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px]">rate not set</span>
                                        : <span className="text-white/90">₹{b.rate.toLocaleString('en-IN')}/{m.unit}</span>}
                                    </td>
                                    <td className="py-1.5 text-muted">{b.note ?? b.grnRef ?? '—'}</td>
                                    <td className="py-1.5"><div className="flex gap-1 justify-end">
                                      <button onClick={() => setBatchModal({ item: m, batch: b })} className="p-1 rounded hover:bg-accent/20 text-muted hover:text-accent"><Pencil className="w-3 h-3" /></button>
                                      <button onClick={() => handleBatchDelete(b.id)} className="p-1 rounded hover:bg-red-500/20 text-muted hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                    </div></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Raw Material' : 'Edit Item'} size="md">
          <ItemForm initial={modal.item ?? { name: '', unit: 'kg', quantity: 0, dateAdded: today() }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}

      {batchModal && (
        <Modal open onClose={() => setBatchModal(null)} size="md"
          title={batchModal.batch ? `Edit batch — ${batchModal.item.name}` : `Receive batch — ${batchModal.item.name}`}>
          <BatchForm unit={batchModal.item.unit}
            initial={batchModal.batch ?? {
              materialId: batchModal.item.id, qty: 0, remaining: 0, rate: null,
              date: today(), createdAt: new Date().toISOString(),
            }}
            onSave={handleBatchSave} onClose={() => setBatchModal(null)} />
        </Modal>
      )}
    </div>
  );
}
