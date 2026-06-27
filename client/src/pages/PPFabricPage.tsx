import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Search, Download, Layers, Recycle,
  Boxes, Percent, FolderOpen, Trash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fabricBatchesDb, fabricWastageDb, ppGranulesDb, applyGranuleUses } from '../lib/db';
import {
  SHIFTS, BATCH_STATUSES, WASTAGE_TYPES, WASTAGE_ACTIONS,
} from '../config';
import type {
  Shift, BatchStatus, WastageType, WastageAction, GranuleType,
} from '../config';
import type { FabricBatch, FabricWastage, GranuleUse, PPGranuleItem } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { cn, exportToCsv, genDailyId, formatDate } from '../lib/utils';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd

const BATCH_STATUS_COLORS: Record<BatchStatus, string> = {
  Open:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Closed: 'bg-green-500/20 text-green-300 border-green-500/30',
};
const WASTAGE_TYPE_COLORS: Record<WastageType, string> = {
  'Startup waste':       'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Edge trim':           'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Breakage':            'bg-red-500/20 text-red-300 border-red-500/30',
  'Colour change purge': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Other':               'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

// Hex colours per granule type for the live mix bar
const TYPE_HEX: Record<GranuleType, string> = { 'P.P.': '#3131B5', 'Filler': '#f59e0b', 'RP': '#12B76A', 'Colour': '#a855f7' };

function toNum(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function batchInput(b: Pick<FabricBatch, 'uses'>): number {
  return (b.uses ?? []).reduce((s, u) => s + (u.qtyKg || 0), 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// BATCH ENTRY FORM — granule items consumed (auto-deducts from stock)
// ═════════════════════════════════════════════════════════════════════════════
const emptyBatch: Omit<FabricBatch, 'id'> = {
  batchId: '', date: today(), shift: 'Morning', line: '',
  uses: [{ itemId: '', itemName: '', type: 'P.P.', qtyKg: 0 }], outputMeters: 0,
  status: 'Open', notes: '', createdAt: '', updatedAt: '',
};

function BatchForm({ initial, granuleItems, onSave, onClose }: {
  initial: Omit<FabricBatch, 'id'>;
  granuleItems: PPGranuleItem[];
  onSave: (d: Omit<FabricBatch, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const uses = f.uses ?? [];
  const total = uses.reduce((s, u) => s + (u.qtyKg || 0), 0);

  // Stock available for an item = current stock + the qty this batch already booked
  // against it (so editing an existing batch doesn't false-fail validation).
  const origByItem = useMemo(() => {
    const m: Record<string, number> = {};
    (initial.uses ?? []).forEach((u) => { if (u.itemId) m[u.itemId] = (m[u.itemId] ?? 0) + u.qtyKg; });
    return m;
  }, [initial]);
  const availableFor = (itemId: string) => (granuleItems.find((g) => g.id === itemId)?.currentStockKg ?? 0) + (origByItem[itemId] ?? 0);

  function setUse(i: number, patch: Partial<GranuleUse>) { const arr = [...uses]; arr[i] = { ...arr[i], ...patch }; set('uses', arr); }
  function pickItem(i: number, itemId: string) { const it = granuleItems.find((g) => g.id === itemId); setUse(i, { itemId, itemName: it?.name ?? '', type: it?.type ?? 'P.P.' }); }
  function addRow() { set('uses', [...uses, { itemId: '', itemName: '', type: 'P.P.' as GranuleType, qtyKg: 0 }]); }
  function removeRow(i: number) { set('uses', uses.filter((_, j) => j !== i)); }

  const byType: Record<string, number> = {};
  uses.forEach((u) => { byType[u.type] = (byType[u.type] ?? 0) + (u.qtyKg || 0); });

  function submit() {
    if (!f.line.trim()) { toast.error('Machine / Line No. is required'); return; }
    const valid = uses.filter((u) => u.itemId && u.qtyKg > 0);
    if (!valid.length) { toast.error('Add at least one granule consumption row'); return; }
    for (const u of valid) {
      if (u.qtyKg > availableFor(u.itemId) + 1e-6) {
        const it = granuleItems.find((g) => g.id === u.itemId);
        toast.error(`Not enough ${it?.name ?? 'stock'} — available ${availableFor(u.itemId).toLocaleString('en-IN')} kg`);
        return;
      }
    }
    if (!f.outputMeters || f.outputMeters < 1) { toast.error('Total fabric output must be at least 1 meter'); return; }
    onSave({ ...f, line: f.line.trim(), uses: valid });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Batch ID</label><input className="input-field font-mono text-accent" value={f.batchId || 'auto-generated on save'} disabled readOnly /></div>
        <div><label className="label">Date *</label><input className="input-field" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label className="label">Shift</label>
          <select className="input-field" value={f.shift} onChange={(e) => set('shift', e.target.value as Shift)}>{SHIFTS.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div><label className="label">Machine / Line No. *</label><input className="input-field" value={f.line} onChange={(e) => set('line', e.target.value)} placeholder="Line 3" autoFocus /></div>
      </div>

      {/* Granule consumption rows — deducted from P.P. Granule stock on save */}
      <div className="rounded-xl border border-accent/10 p-3 space-y-2">
        <p className="label !mb-1">Granules used (deducts from inventory)</p>
        {granuleItems.length === 0 && <p className="text-red-300 text-xs">No granule items in inventory — add some in P.P. Granule first.</p>}
        {uses.map((u, i) => {
          const avail = u.itemId ? availableFor(u.itemId) : 0;
          const over = u.itemId && u.qtyKg > avail + 1e-6;
          return (
            <div key={i} className="flex gap-2 items-start">
              <select className="input-field flex-1" value={u.itemId} onChange={(e) => pickItem(i, e.target.value)}>
                <option value="">Select granule item…</option>
                {granuleItems.map((g) => <option key={g.id} value={g.id}>{g.type} · {g.name} — {g.currentStockKg.toLocaleString('en-IN')}kg</option>)}
              </select>
              <div className="w-32">
                <input className={cn('input-field font-mono', over && 'border-red-500/60')} type="number" min="0" step="any" value={u.qtyKg || ''} onChange={(e) => setUse(i, { qtyKg: toNum(e.target.value) })} placeholder="kg" />
                {u.itemId && <p className={cn('text-[10px] mt-0.5', over ? 'text-red-300' : 'text-muted')}>avail {avail.toLocaleString('en-IN')}kg</p>}
              </div>
              <button type="button" onClick={() => removeRow(i)} className="p-2 rounded hover:bg-red-500/20 text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
        <button type="button" onClick={addRow} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add granule row</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Total Fabric Output (m) *</label><input className="input-field font-mono" type="number" min="1" step="any" value={f.outputMeters || ''} onChange={(e) => set('outputMeters', toNum(e.target.value))} placeholder="meters" /></div>
        <div><label className="label">Status</label>
          <select className="input-field" value={f.status} onChange={(e) => set('status', e.target.value as BatchStatus)}>{BATCH_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </div>

      <div><label className="label">Notes</label><textarea className="input-field min-h-[56px] resize-y" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional remarks" /></div>

      {/* Live total + per-type mix */}
      <div className="p-4 rounded-xl bg-navy/60 border border-accent/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted text-xs uppercase tracking-wide">Total granule input</span>
          <span className="font-mono text-lg font-bold text-white">{total.toLocaleString('en-IN')} kg</span>
        </div>
        <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden flex">
          {Object.entries(byType).map(([t, v]) => { const pct = total > 0 ? (v / total) * 100 : 0; return pct > 0 ? <div key={t} style={{ width: `${pct}%`, background: TYPE_HEX[t as GranuleType] }} title={`${t} ${pct.toFixed(1)}%`} /> : null; })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(byType).filter(([, v]) => v > 0).map(([t, v]) => (
            <div key={t} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_HEX[t as GranuleType] }} />
              <span className="text-muted">{t}</span>
              <span className="font-mono text-white/90">{(total > 0 ? (v / total) * 100 : 0).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Create &amp; Deduct from Inventory</button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// WASTAGE FORM (2B)
// ═════════════════════════════════════════════════════════════════════════════
const emptyWastage: Omit<FabricWastage, 'id'> = {
  batchRef: '', batchLabel: '', type: 'Startup waste', quantityKg: 0,
  action: 'Recycled back', notes: '', createdAt: '', updatedAt: '',
};

function WastageForm({ initial, batches, onSave, onClose }: {
  initial: Omit<FabricWastage, 'id'>;
  batches: FabricBatch[];
  onSave: (d: Omit<FabricWastage, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const batch = batches.find((b) => b.id === f.batchRef);
  const total = batch ? batchInput(batch) : 0;
  const wastagePct = total > 0 ? (f.quantityKg / total) * 100 : 0;

  function submit() {
    if (!f.batchRef) { toast.error('Select the batch this wastage belongs to'); return; }
    if (!f.quantityKg || f.quantityKg <= 0) { toast.error('Wastage quantity must be greater than 0'); return; }
    onSave({ ...f, batchLabel: batch?.batchId ?? f.batchLabel });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Batch reference *</label>
          <select className="input-field font-mono" value={f.batchRef} onChange={(e) => set('batchRef', e.target.value)}>
            <option value="">Select batch…</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.batchId} · {b.line} · {batchInput(b).toLocaleString('en-IN')} kg</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Wastage type</label>
          <select className="input-field" value={f.type} onChange={(e) => set('type', e.target.value as WastageType)}>
            {WASTAGE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Wastage quantity (kg) *</label>
          <input className="input-field font-mono" type="number" min="0" step="any" value={f.quantityKg || ''} onChange={(e) => set('quantityKg', toNum(e.target.value))} placeholder="0" />
        </div>
        <div>
          <label className="label">Action taken</label>
          <select className="input-field" value={f.action} onChange={(e) => set('action', e.target.value as WastageAction)}>
            {WASTAGE_ACTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Wastage %</label>
          <div className="input-field font-mono flex items-center justify-between">
            <span className={cn(wastagePct > 5 ? 'text-red-300' : 'text-white/90')}>{wastagePct.toFixed(2)}%</span>
            <span className="text-muted text-xs">{total > 0 ? `of ${total.toLocaleString('en-IN')} kg` : 'select batch'}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input-field min-h-[56px] resize-y" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Wastage</button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BATCHES TAB — list view (2C)
// ═════════════════════════════════════════════════════════════════════════════
function BatchesSection({ batches, wastageByBatch, openNew, onChanged }: {
  batches: FabricBatch[];
  wastageByBatch: Record<string, number>;
  openNew: boolean;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; batch?: FabricBatch } | null>(null);
  const [granuleItems, setGranuleItems] = useState<PPGranuleItem[]>(() => ppGranulesDb.getAll());

  useEffect(() => { if (openNew) setModal({ type: 'add' }); }, [openNew]);

  function handleSave(data: Omit<FabricBatch, 'id'>) {
    const now = new Date().toISOString();
    if (modal?.type === 'edit' && modal.batch) {
      applyGranuleUses(modal.batch.uses ?? [], 1);   // restore old consumption
      applyGranuleUses(data.uses, -1);                // deduct new consumption
      fabricBatchesDb.update(modal.batch.id, { ...data, updatedAt: now });
      toast.success('Batch updated — granule stock adjusted');
    } else {
      const ids = fabricBatchesDb.getAll().map((b) => b.batchId);
      applyGranuleUses(data.uses, -1);                // deduct from stock
      fabricBatchesDb.create({ ...data, batchId: genDailyId('HIRA', ids, data.date), createdAt: now, updatedAt: now });
      toast.success('Batch saved — granule stock deducted');
    }
    setGranuleItems(ppGranulesDb.getAll());
    setModal(null);
    onChanged();
  }
  function handleDelete(b: FabricBatch) {
    applyGranuleUses(b.uses ?? [], 1);                 // restore consumed stock
    fabricBatchesDb.delete(b.id);
    // Cascade: remove wastage linked to this batch
    fabricWastageDb.getAll().filter((w) => w.batchRef === b.id).forEach((w) => fabricWastageDb.delete(w.id));
    setGranuleItems(ppGranulesDb.getAll());
    toast.success('Batch deleted — granule stock restored');
    onChanged();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter((b) =>
      (!q || b.batchId.toLowerCase().includes(q) || b.line.toLowerCase().includes(q)) &&
      (!statusFilter || b.status === statusFilter) &&
      (!shiftFilter || b.shift === shiftFilter)
    );
  }, [batches, search, statusFilter, shiftFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter, shiftFilter]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleExport() {
    if (!filtered.length) { toast.error('Nothing to export'); return; }
    const rows = filtered.map((b) => {
      const input = batchInput(b);
      const waste = wastageByBatch[b.id] ?? 0;
      return {
        'Batch ID': b.batchId, Date: b.date, Shift: b.shift, Line: b.line,
        'Granules Used': (b.uses ?? []).map((u) => `${u.type}:${u.itemName} ${u.qtyKg}kg`).join('; '),
        'Total Input (kg)': input, 'Output (m)': b.outputMeters ?? 0, 'Wastage (kg)': waste,
        'Wastage %': input > 0 ? +((waste / input) * 100).toFixed(2) : 0,
        Status: b.status, Notes: b.notes ?? '', 'Last Updated': b.updatedAt,
      };
    });
    exportToCsv(`pp-fabric-batches-${today()}.csv`, rows);
    toast.success(`Exported ${rows.length} rows`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch ID or line…" className="input-field pl-9" />
        </div>
        <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Shifts</option>
          {SHIFTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Statuses</option>
          {BATCH_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> New Batch</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Batch ID', 'Date', 'Shift', 'Line', 'Total Input', 'Wastage', 'Wastage %', 'Status', ''].map((h) => (
                  <th key={h} className="table-header whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={9}>
                  <EmptyState icon={Layers} title="No batch entries yet"
                    description="Log the raw materials used to produce a batch of PP tape/fabric."
                    action={{ label: 'New Batch Entry', onClick: () => setModal({ type: 'add' }) }} />
                </td></tr>
              ) : pageRows.map((b) => {
                const input = batchInput(b);
                const waste = wastageByBatch[b.id] ?? 0;
                const pct = input > 0 ? (waste / input) * 100 : 0;
                return (
                  <tr key={b.id} className="table-row">
                    <td className="table-cell font-mono text-accent font-medium whitespace-nowrap">{b.batchId}</td>
                    <td className="table-cell text-white/70 whitespace-nowrap">{formatDate(b.date)}</td>
                    <td className="table-cell text-white/70">{b.shift}</td>
                    <td className="table-cell text-white/80">{b.line}</td>
                    <td className="table-cell font-mono text-white/80 whitespace-nowrap">{input.toLocaleString('en-IN')} kg</td>
                    <td className="table-cell font-mono text-white/70 whitespace-nowrap">{waste.toLocaleString('en-IN')} kg</td>
                    <td className={cn('table-cell font-mono', pct > 5 ? 'text-red-300' : 'text-white/80')}>{pct.toFixed(1)}%</td>
                    <td className="table-cell"><span className={cn('badge border text-xs', BATCH_STATUS_COLORS[b.status])}>{b.status}</span></td>
                    <td className="table-cell">
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal({ type: 'edit', batch: b })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(b)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'New PP Fabric Batch' : 'Edit Batch'} size="lg">
          <BatchForm
            initial={modal.batch ?? { ...emptyBatch, date: today() }}
            granuleItems={granuleItems}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// WASTAGE TAB — list view (2B)
// ═════════════════════════════════════════════════════════════════════════════
function WastageSection({ batches, wastage, onChanged }: {
  batches: FabricBatch[];
  wastage: FabricWastage[];
  onChanged: () => void;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; w?: FabricWastage } | null>(null);

  const batchById = useMemo(() => Object.fromEntries(batches.map((b) => [b.id, b])), [batches]);

  function handleSave(data: Omit<FabricWastage, 'id'>) {
    const now = new Date().toISOString();
    if (modal?.type === 'edit' && modal.w) {
      fabricWastageDb.update(modal.w.id, { ...data, updatedAt: now });
      toast.success('Wastage updated');
    } else {
      fabricWastageDb.create({ ...data, createdAt: now, updatedAt: now });
      toast.success('Wastage logged');
    }
    setModal(null);
    onChanged();
  }
  function handleDelete(id: string) {
    fabricWastageDb.delete(id);
    toast.success('Wastage deleted');
    onChanged();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return wastage.filter((w) =>
      (!q || w.batchLabel.toLowerCase().includes(q)) &&
      (!typeFilter || w.type === typeFilter)
    );
  }, [wastage, search, typeFilter]);

  useEffect(() => { setPage(1); }, [search, typeFilter]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function pctFor(w: FabricWastage): number {
    const b = batchById[w.batchRef];
    const input = b ? batchInput(b) : 0;
    return input > 0 ? (w.quantityKg / input) * 100 : 0;
  }

  function handleExport() {
    if (!filtered.length) { toast.error('Nothing to export'); return; }
    const rows = filtered.map((w) => ({
      Batch: w.batchLabel, Type: w.type, 'Quantity (kg)': w.quantityKg,
      'Wastage %': +pctFor(w).toFixed(2), Action: w.action, Notes: w.notes ?? '', 'Last Updated': w.updatedAt,
    }));
    exportToCsv(`pp-fabric-wastage-${today()}.csv`, rows);
    toast.success(`Exported ${rows.length} rows`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch ID…" className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Types</option>
          {WASTAGE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary" disabled={batches.length === 0}
          title={batches.length === 0 ? 'Add a batch first' : undefined}>
          <Plus className="w-4 h-4" /> Log Wastage
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Batch', 'Type', 'Quantity', 'Wastage %', 'Action', 'Notes', ''].map((h) => (
                  <th key={h} className="table-header whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={7}>
                  <EmptyState icon={Recycle} title="No wastage logged"
                    action={batches.length ? { label: 'Log First Wastage', onClick: () => setModal({ type: 'add' }) } : undefined} />
                </td></tr>
              ) : pageRows.map((w) => {
                const pct = pctFor(w);
                return (
                  <tr key={w.id} className="table-row">
                    <td className="table-cell font-mono text-accent whitespace-nowrap">{w.batchLabel}</td>
                    <td className="table-cell"><span className={cn('badge border text-xs', WASTAGE_TYPE_COLORS[w.type])}>{w.type}</span></td>
                    <td className="table-cell font-mono text-white/80 whitespace-nowrap">{w.quantityKg.toLocaleString('en-IN')} kg</td>
                    <td className={cn('table-cell font-mono', pct > 5 ? 'text-red-300' : 'text-white/80')}>{pct.toFixed(1)}%</td>
                    <td className="table-cell text-white/70">{w.action}</td>
                    <td className="table-cell text-muted text-xs max-w-[14rem] truncate">{w.notes || '—'}</td>
                    <td className="table-cell">
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal({ type: 'edit', w })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(w.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Log Wastage' : 'Edit Wastage'} size="md">
          <WastageForm
            initial={modal.w ?? { ...emptyWastage }}
            batches={batches}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export function PPFabricPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'batches' | 'wastage'>('batches');
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const wantNew = params.get('new') === '1';
  useEffect(() => {
    if (wantNew) { setTab('batches'); const p = new URLSearchParams(params); p.delete('new'); setParams(p, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { batches, wastage, wastageByBatch } = useMemo(() => {
    void tick;
    const batches = fabricBatchesDb.getAll();
    const wastage = fabricWastageDb.getAll();
    const wastageByBatch: Record<string, number> = {};
    wastage.forEach((w) => { wastageByBatch[w.batchRef] = (wastageByBatch[w.batchRef] ?? 0) + (w.quantityKg || 0); });
    return { batches, wastage, wastageByBatch };
  }, [tick]);

  const stats = useMemo(() => {
    const todayStr = today();
    const todayBatches = batches.filter((b) => b.date === todayStr);
    const todayInput = todayBatches.reduce((s, b) => s + batchInput(b), 0);
    const todayWaste = todayBatches.reduce((s, b) => s + (wastageByBatch[b.id] ?? 0), 0);
    const totalInput = batches.reduce((s, b) => s + batchInput(b), 0);
    const totalWaste = wastage.reduce((s, w) => s + (w.quantityKg || 0), 0);
    return {
      totalBatches: batches.length,
      todayInput,
      todayWastePct: todayInput > 0 ? (todayWaste / todayInput) * 100 : 0,
      overallWastePct: totalInput > 0 ? (totalWaste / totalInput) * 100 : 0,
      open: batches.filter((b) => b.status === 'Open').length,
    };
  }, [batches, wastage, wastageByBatch]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">PP Fabric Production</h1>
        <p className="text-muted text-sm mt-1">Log raw material batches and track wastage for PP tape / fabric</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Batches" value={stats.totalBatches} icon={Boxes} iconColor="text-accent" mono />
        <StatCard label="Today's Input" value={`${stats.todayInput.toLocaleString('en-IN')} kg`} icon={Layers} iconColor="text-blue-400" mono />
        <StatCard label="Overall Wastage" value={`${stats.overallWastePct.toFixed(1)}%`} icon={Percent} iconColor="text-red-400" mono />
        <StatCard label="Open Batches" value={stats.open} icon={FolderOpen} iconColor="text-yellow-400" mono />
      </div>

      <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10 w-fit">
        {([
          { k: 'batches', label: 'Batch Entries', icon: Layers },
          { k: 'wastage', label: 'Wastage', icon: Trash },
        ] as const).map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all',
              tab === k ? 'bg-primary text-white shadow' : 'text-muted hover:text-white')}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'batches' && (
        <BatchesSection batches={batches} wastageByBatch={wastageByBatch} openNew={wantNew} onChanged={bump} />
      )}
      {tab === 'wastage' && (
        <WastageSection batches={batches} wastage={wastage} onChanged={bump} />
      )}
    </div>
  );
}
