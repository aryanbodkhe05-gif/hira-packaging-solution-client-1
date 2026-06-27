import { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, Search, FileText, PackageCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  grnsDb, suppliersDb, rawMaterialsDb, boppFilmsDb, invRollsDb, ppGranulesDb,
} from '../lib/db';
import {
  GRN_DESTINATIONS, DEFAULT_RAW_MATERIALS, RAW_MATERIALS_KEY,
  DEFAULT_GRANULE_TYPES, GRANULE_TYPES_KEY, DEFAULT_ROLL_TYPES, ROLL_TYPES_KEY,
} from '../config';
import type { GrnDestination } from '../config';
import type { GRN, Supplier } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { ListSelect } from '../components/ui/ListSelect';
import { formatDate, genDailyId } from '../lib/utils';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

interface Draft {
  supplier: string; invoiceNo: string; date: string; destination: GrnDestination;
  itemName: string; rollType: string; qty: number; unit: string; bags: number; meter: number;
}
const emptyDraft: Draft = {
  supplier: '', invoiceNo: '', date: today(), destination: 'Raw Materials',
  itemName: '', rollType: '', qty: 0, unit: 'kg', bags: 0, meter: 0,
};

function GrnForm({ suppliers, onReceive, onClose }: {
  suppliers: Supplier[]; onReceive: (d: Draft) => void; onClose: () => void;
}) {
  const [f, setF] = useState<Draft>({ ...emptyDraft });
  const set = (k: keyof Draft, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const dest = f.destination;

  function submit() {
    if (!f.itemName.trim()) { toast.error('Enter the item being received'); return; }
    if (!f.qty || f.qty <= 0) { toast.error('Quantity must be greater than 0'); return; }
    onReceive(f);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Supplier</label>
          <select className="input-field" value={f.supplier} onChange={(e) => set('supplier', e.target.value)}>
            <option value="">Select supplier…</option>
            {suppliers.map((s) => <option key={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="label">Invoice No.</label><input className="input-field font-mono" value={f.invoiceNo} onChange={(e) => set('invoiceNo', e.target.value)} /></div>
        <div><label className="label">Date</label><input className="input-field" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label className="label">Receive into</label>
          <select className="input-field" value={f.destination} onChange={(e) => set('destination', e.target.value as GrnDestination)}>
            {GRN_DESTINATIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Destination-specific item fields */}
      <div className="rounded-lg border border-accent/10 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {dest === 'Raw Materials' && (<>
          <div><label className="label">Material *</label><ListSelect value={f.itemName} onChange={(v) => set('itemName', v)} listKey={RAW_MATERIALS_KEY} defaults={DEFAULT_RAW_MATERIALS} placeholder="Select material…" /></div>
          <div><label className="label">Unit</label><input className="input-field" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="kg / litre" /></div>
          <div><label className="label">Quantity *</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.qty || ''} onChange={(e) => set('qty', num(e.target.value))} /></div>
        </>)}
        {dest === 'BOPP Film' && (<>
          <div><label className="label">Film No *</label><input className="input-field font-mono" value={f.itemName} onChange={(e) => set('itemName', e.target.value)} placeholder="F-010" /></div>
          <div><label className="label">KG *</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.qty || ''} onChange={(e) => set('qty', num(e.target.value))} /></div>
          <div><label className="label">Meter</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.meter || ''} onChange={(e) => set('meter', num(e.target.value))} /></div>
        </>)}
        {dest === 'Rolls' && (<>
          <div><label className="label">Roll No *</label><input className="input-field font-mono" value={f.itemName} onChange={(e) => set('itemName', e.target.value)} placeholder="R-010" /></div>
          <div><label className="label">Type</label><ListSelect value={f.rollType} onChange={(v) => set('rollType', v)} listKey={ROLL_TYPES_KEY} defaults={DEFAULT_ROLL_TYPES} placeholder="Select type…" /></div>
          <div><label className="label">N.WT (kg) *</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.qty || ''} onChange={(e) => set('qty', num(e.target.value))} /></div>
          <div><label className="label">Meter</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.meter || ''} onChange={(e) => set('meter', num(e.target.value))} /></div>
        </>)}
        {dest === 'P.P. Granule' && (<>
          <div><label className="label">Type *</label><ListSelect value={f.itemName} onChange={(v) => set('itemName', v)} listKey={GRANULE_TYPES_KEY} defaults={DEFAULT_GRANULE_TYPES} placeholder="Select type…" /></div>
          <div><label className="label">KG *</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.qty || ''} onChange={(e) => set('qty', num(e.target.value))} /></div>
          <div><label className="label">Bags</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.bags || ''} onChange={(e) => set('bags', num(e.target.value))} /></div>
        </>)}
      </div>
      <p className="text-muted text-xs">On receive, this increments <span className="text-accent">{dest}</span> stock and logs the GRN.</p>

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center"><PackageCheck className="w-4 h-4" /> Receive &amp; Add Stock</button>
      </div>
    </div>
  );
}

export function GrnPage() {
  const [rows, setRows] = useState<GRN[]>(() => grnsDb.getAll());
  const [suppliers] = useState<Supplier[]>(() => suppliersDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const reload = useCallback(() => setRows(grnsDb.getAll()), []);

  function receive(d: Draft) {
    const grnNo = genDailyId('GRN', grnsDb.getAll().map((g) => g.grnNo), d.date);
    // Increment the correct inventory
    if (d.destination === 'Raw Materials') {
      const items = rawMaterialsDb.getAll();
      const ex = items.find((i) => i.name.toLowerCase() === d.itemName.toLowerCase());
      if (ex) rawMaterialsDb.update(ex.id, { quantity: ex.quantity + d.qty, openingQty: (ex.openingQty ?? ex.quantity) + d.qty });
      else rawMaterialsDb.create({ name: d.itemName, unit: d.unit || 'kg', quantity: d.qty, openingQty: d.qty, dateAdded: d.date });
    } else if (d.destination === 'BOPP Film') {
      boppFilmsDb.create({ filmNo: d.itemName, kg: d.qty, meter: d.meter || 0, dateAdded: d.date });
    } else if (d.destination === 'Rolls') {
      invRollsDb.create({ rollNo: d.itemName, type: d.rollType || 'UL', size: '', quality: 0, gWt: d.qty, nWt: d.qty, meter: d.meter || 0, dateAdded: d.date });
    } else if (d.destination === 'P.P. Granule') {
      ppGranulesDb.create({ type: d.itemName, kg: d.qty, bags: d.bags || 0, dateReceived: d.date, supplier: d.supplier, grnRef: grnNo });
    }
    grnsDb.create({
      grnNo, supplier: d.supplier, invoiceNo: d.invoiceNo, date: d.date, destination: d.destination,
      itemName: d.itemName, qty: d.qty, unit: d.unit, bags: d.bags, meter: d.meter, createdAt: new Date().toISOString(),
    });
    toast.success(`${grnNo} received — ${d.destination} stock updated`);
    setOpen(false);
    reload();
  }
  function handleDelete(id: string) {
    if (!confirm('Delete this GRN record? (stock already added will not be reversed)')) return;
    grnsDb.delete(id); toast.success('GRN deleted'); reload();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || r.grnNo.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q) || r.itemName.toLowerCase().includes(q));
  }, [rows, search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">GRN</h1><p className="text-muted text-sm mt-1">Goods Receipt Note — receive stock (no PO needed); increments the chosen inventory</p></div>
        <button onClick={() => setOpen(true)} className="btn-primary" disabled={suppliers.length === 0} title={suppliers.length === 0 ? 'Add a supplier first' : undefined}>
          <Plus className="w-4 h-4" /> New GRN
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search GRN, supplier, item…" className="input-field pl-9" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['GRN No', 'Date', 'Supplier', 'Invoice', 'Into', 'Item', 'Qty', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={FileText} title="No GRNs yet"
                  description={suppliers.length === 0 ? 'Add a supplier first, then receive stock.' : 'Receive stock to create a GRN.'}
                  action={suppliers.length ? { label: 'New GRN', onClick: () => setOpen(true) } : undefined} /></td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-mono text-accent whitespace-nowrap">{r.grnNo}</td>
                  <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="table-cell text-white/80">{r.supplier || '—'}</td>
                  <td className="table-cell font-mono text-white/60 text-xs">{r.invoiceNo || '—'}</td>
                  <td className="table-cell text-white/70">{r.destination}</td>
                  <td className="table-cell text-white/80">{r.itemName}</td>
                  <td className="table-cell font-mono text-white/80 whitespace-nowrap">{r.qty.toLocaleString('en-IN')}{r.unit ? ` ${r.unit}` : ''}{r.bags ? ` · ${r.bags} bags` : ''}</td>
                  <td className="table-cell">
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="New GRN — Receive Stock" size="lg">
          <GrnForm suppliers={suppliers} onReceive={receive} onClose={() => setOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
