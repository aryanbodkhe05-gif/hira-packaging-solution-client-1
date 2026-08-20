import { useState, useCallback, useMemo, Fragment } from 'react';
import { Plus, Pencil, Trash2, Search, FlaskConical, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { rawMaterialsDb, rawMaterialReceiptsDb, syncMaterialPools } from '../lib/db';
import { canViewCosts } from '../lib/roles';
import { DEFAULT_RAW_MATERIALS, RAW_MATERIALS_KEY, DEFAULT_PARTIES, PARTIES_KEY } from '../config';
import type { RawMaterial, RawMaterialReceipt } from '../types/models';
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

// ── Add-material form: name, unit, qty, rate, date. The qty/rate become the item's
// first receipt into its moving-average pool. (Edit mode changes only name/unit.)
export interface ItemFormData { name: string; unit: string; dateAdded: string; qty: number; rate: number | null; party: string; billNo: string; }
function ItemForm({ initial, editing, onSave, onSaveAndNew, onClose }: {
  initial: RawMaterial | null; editing?: boolean;
  onSave: (d: ItemFormData) => void; onSaveAndNew?: (d: ItemFormData) => void; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? 'kg');
  const [date, setDate] = useState(initial?.dateAdded ?? today());
  const [qtyText, setQtyText] = useState('');
  const [rateText, setRateText] = useState('');
  const [party, setParty] = useState('');
  const [billNo, setBillNo] = useState('');
  // Validate + build the payload; returns null (and toasts) if invalid.
  function build(): ItemFormData | null {
    if (!name.trim()) { toast.error('Item name is required'); return null; }
    if (!editing && num(qtyText) <= 0) { toast.error('Quantity is required'); return null; }
    rememberTypeAhead(RAW_MATERIALS_KEY, name, DEFAULT_RAW_MATERIALS);
    if (party.trim()) rememberTypeAhead(PARTIES_KEY, party, DEFAULT_PARTIES);
    return { name: name.trim(), unit: unit.trim() || 'kg', dateAdded: date, qty: num(qtyText), rate: rateText.trim() === '' ? null : num(rateText), party: party.trim(), billNo: billNo.trim() };
  }
  // Clear the per-item fields (keep unit + date) so the next material can be typed.
  function resetForNext() { setName(''); setQtyText(''); setRateText(''); setParty(''); setBillNo(''); }
  function submitClose() { const d = build(); if (d) onSave(d); }
  function submitAnother() { const d = build(); if (d) { (onSaveAndNew ?? onSave)(d); resetForNext(); } }
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Item Name *</label>
        <TypeAhead value={name} onChange={setName} listKey={RAW_MATERIALS_KEY} defaults={DEFAULT_RAW_MATERIALS} placeholder="Type a few letters…" autoFocus />
        <p className="text-muted text-[11px] mt-1">Free text — saved to your item list for next time.{!editing && ' Adding the same name again receives more into its pool.'}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Unit</label><input className="input-field" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg / litre / bobbin" /></div>
        <div><label className="label">Date</label><input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {!editing && <div><label className="label">Quantity *</label><input className="input-field font-mono" type="number" min="0" step="any" value={qtyText} onChange={(e) => setQtyText(e.target.value)} /></div>}
        {!editing && <div><label className="label">Rate (₹/{unit || 'unit'})</label><input className="input-field font-mono" type="number" min="0" step="any" value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder="optional" /></div>}
      </div>
      {!editing && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Party Name</label><TypeAhead value={party} onChange={setParty} listKey={PARTIES_KEY} defaults={DEFAULT_PARTIES} placeholder="supplier / party" /></div>
          <div><label className="label">Bill No.</label><input className="input-field font-mono" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="invoice / bill no." /></div>
        </div>
      )}
      {!editing && rateText.trim() === '' && (
        <p className="text-yellow-300/90 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
          Saved without a rate — this stock is held as unrated and excluded from the average and value until priced (never counted as ₹0).
        </p>
      )}
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">{editing ? 'Cancel' : 'Done'}</button>
        {!editing && onSaveAndNew && (
          <button onClick={submitAnother} className="btn-secondary flex-1 justify-center"><Plus className="w-4 h-4" /> Save &amp; Add Another</button>
        )}
        <button onClick={submitClose} className="btn-primary flex-1 justify-center">{editing ? 'Save Item' : 'Add Material'}</button>
      </div>
    </div>
  );
}

// ── Receipt form: qty + rate + date. Rate is optional and can be priced later. ──
function ReceiptForm({ initial, unit, editing, onSave, onClose }: {
  initial: Omit<RawMaterialReceipt, 'id'>; unit: string; editing?: boolean;
  onSave: (d: Omit<RawMaterialReceipt, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const [rateText, setRateText] = useState(initial.rate == null ? '' : String(initial.rate));
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.qty) { toast.error('Quantity is required'); return; }
    const rate = rateText.trim() === '' ? null : num(rateText);
    // Editing an existing receipt's quantity changes the material's stock — confirm first.
    if (editing && f.qty !== initial.qty &&
        !confirm(`⚠️ Change stock quantity from ${initial.qty} to ${f.qty} ${unit}?`)) return;
    if (f.party?.trim()) rememberTypeAhead(PARTIES_KEY, f.party, DEFAULT_PARTIES);
    onSave({ ...f, rate });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Quantity Received{editing ? '' : ' *'} ({unit})</label>
          <input className="input-field font-mono" type="number" min="0" step="any" autoFocus={!editing}
            value={f.qty || ''} onChange={(e) => set('qty', num(e.target.value))} />
        </div>
        <div>
          <label className="label">Rate (₹/{unit})</label>
          <input className="input-field font-mono" type="number" min="0" step="any" autoFocus={editing}
            value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder="set the rate now or later" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Party Name</label><TypeAhead value={f.party ?? ''} onChange={(v) => set('party', v)} listKey={PARTIES_KEY} defaults={DEFAULT_PARTIES} placeholder="supplier / party" /></div>
        <div><label className="label">Bill No.</label><input className="input-field font-mono" value={f.billNo ?? ''} onChange={(e) => set('billNo', e.target.value)} placeholder="invoice / bill no." /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Receipt Date</label><input className="input-field" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label className="label">Note</label><input className="input-field" value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="extra note" /></div>
      </div>
      {editing && (
        <p className="text-muted text-xs">Editing this receipt. Changing the quantity asks for confirmation before it updates stock.</p>
      )}
      {rateText.trim() === '' && (
        <p className="text-yellow-300/90 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          Saved without a rate. This stock is held as unrated — excluded from the average and value until priced (never counted as ₹0).
        </p>
      )}
      <p className="text-muted text-xs">Received qty × rate is blended into the running average — all stock is charged one pooled rate.</p>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Receipt</button>
      </div>
    </div>
  );
}

export function RawMaterialsPage() {
  const [items, setItems] = useState<RawMaterial[]>(() => rawMaterialsDb.getAll());
  const [receipts, setReceipts] = useState<RawMaterialReceipt[]>(() => rawMaterialReceiptsDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; item?: RawMaterial } | null>(null);
  const [receiptModal, setReceiptModal] = useState<{ item: RawMaterial; receipt?: RawMaterialReceipt } | null>(null);
  const showCosts = canViewCosts();

  const reload = useCallback(() => {
    syncMaterialPools();
    setItems(rawMaterialsDb.getAll());
    setReceipts(rawMaterialReceiptsDb.getAll());
  }, []);

  function createItem(data: ItemFormData) {
    if (modal?.type === 'edit' && modal.item) {
      rawMaterialsDb.update(modal.item.id, { name: data.name, unit: data.unit });
      toast.success('Item updated');
      return;
    }
    // Find-or-create the item by name, then log this receipt into its pool.
    const existing = rawMaterialsDb.getAll().find((m) => m.name.trim().toLowerCase() === data.name.toLowerCase());
    const materialId = existing ? existing.id : rawMaterialsDb.create({ name: data.name, unit: data.unit, quantity: 0, totalValue: 0, avgRate: null, unratedQty: 0, dateAdded: data.dateAdded }).id;
    rawMaterialReceiptsDb.create({ materialId, qty: data.qty, rate: data.rate, date: data.dateAdded, party: data.party || undefined, billNo: data.billNo || undefined, createdAt: new Date().toISOString() });
    toast.success(existing ? `Stock received into ${data.name}` : `${data.name} added`);
  }
  // Save & close.
  function handleSave(data: ItemFormData) { createItem(data); setModal(null); reload(); }
  // Save & keep the modal open so several new materials can be added in a row.
  function handleSaveAndNew(data: ItemFormData) { createItem(data); reload(); }
  function handleDelete(id: string) {
    rawMaterialReceiptsDb.getAll().filter((r) => r.materialId === id).forEach((r) => rawMaterialReceiptsDb.delete(r.id));
    rawMaterialsDb.delete(id); toast.success('Item and its receipts deleted'); reload();
  }
  function handleReceiptSave(data: Omit<RawMaterialReceipt, 'id'>) {
    if (receiptModal?.receipt) { rawMaterialReceiptsDb.update(receiptModal.receipt.id, data); toast.success('Receipt updated'); }
    else { rawMaterialReceiptsDb.create(data); toast.success('Stock received'); }
    setReceiptModal(null); reload();
  }
  function handleReceiptDelete(id: string) { rawMaterialReceiptsDb.delete(id); toast.success('Receipt deleted'); reload(); }

  // Receipt history newest-first for the audit trail.
  const receiptsFor = useCallback((id: string) => receipts
    .filter((r) => r.materialId === id)
    .sort((a, b) => (b.date !== a.date ? (b.date < a.date ? -1 : 1) : (b.createdAt || '').localeCompare(a.createdAt || ''))), [receipts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [items, search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const low = items.filter((m) => m.quantity < 20).length;
  const unratedItems = items.filter((m) => (m.unratedQty ?? 0) > 0).length;
  const stockValue = items.reduce((s, m) => s + (m.totalValue || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-header">Raw Materials</h1>
          <p className="text-muted text-sm mt-1">Inks, solvents, thread, adhesive — one moving-average pool per material</p>
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Item</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Items" value={items.length} icon={FlaskConical} iconColor="text-accent" mono />
        <StatCard label="Low Stock (<20)" value={low} icon={FlaskConical} iconColor="text-red-400" mono />
        <StatCard label="Unrated Stock" value={unratedItems} icon={AlertTriangle} iconColor="text-yellow-400" mono />
        {showCosts && <StatCard label="Stock Value" value={formatINR(stockValue)} icon={FlaskConical} iconColor="text-green-400" mono />}
      </div>

      {unratedItems > 0 && (
        <div className="glass-card border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 flex gap-2 text-sm text-yellow-200/90">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{unratedItems} item{unratedItems === 1 ? '' : 's'} hold unrated stock. It stays out of the average and value — and can't be consumed — until you price the receipt.</span>
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
              {['', 'Item', 'Unit', 'Current Qty', ...(showCosts ? ['Avg Rate', 'Total Value'] : []), 'Receipts', 'Date', ''].map((h, i) => <th key={i} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={showCosts ? 9 : 7}><EmptyState icon={FlaskConical} title="No raw materials" action={{ label: 'Add First Item', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((m) => {
                const rs = receiptsFor(m.id);
                const open = !!expanded[m.id];
                const hasUnrated = (m.unratedQty ?? 0) > 0;
                return (
                  <Fragment key={m.id}>
                    <tr className="table-row">
                      <td className="table-cell w-8">
                        <button onClick={() => setExpanded((p) => ({ ...p, [m.id]: !p[m.id] }))}
                          className="p-1 rounded hover:bg-white/10 text-muted hover:text-white" title="Show receipts">
                          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="table-cell text-white/90 font-medium">
                        {m.name}
                        {hasUnrated && <span className="ml-2 badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px]">{m.unratedQty.toLocaleString('en-IN')} {m.unit} unrated</span>}
                      </td>
                      <td className="table-cell text-muted text-xs">{m.unit}</td>
                      <td className={'table-cell font-mono ' + (m.quantity < 20 ? 'text-red-300' : 'text-white/80')}>{m.quantity.toLocaleString('en-IN')}</td>
                      {showCosts && <td className="table-cell font-mono text-white/80">{m.avgRate == null ? <span className="text-muted">—</span> : `₹${m.avgRate.toLocaleString('en-IN')}`}</td>}
                      {showCosts && <td className="table-cell font-mono text-white/80">{m.totalValue > 0 ? formatINR(m.totalValue) : <span className="text-muted">—</span>}</td>}
                      <td className="table-cell font-mono text-muted text-xs">{rs.length}</td>
                      <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(m.dateAdded)}</td>
                      <td className="table-cell"><div className="flex gap-1.5">
                        <button onClick={() => setReceiptModal({ item: m })} title="Receive stock"
                          className="p-1.5 rounded hover:bg-primary/20 text-muted hover:text-accent transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setModal({ type: 'edit', item: m })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={showCosts ? 9 : 7} className="px-5 py-3 bg-navy/40">
                          {rs.length === 0 ? (
                            <p className="text-muted text-xs">No receipts yet — receive stock to give this item quantity and a rate.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead><tr className="text-muted">
                                <th className="text-left py-1 font-medium">Received</th>
                                <th className="text-left py-1 font-medium">Qty</th>
                                <th className="text-left py-1 font-medium">Rate</th>
                                {showCosts && <th className="text-left py-1 font-medium">Value</th>}
                                <th className="text-left py-1 font-medium">Party</th>
                                <th className="text-left py-1 font-medium">Bill No</th>
                                <th className="text-left py-1 font-medium">Note</th>
                                <th></th>
                              </tr></thead>
                              <tbody>
                                {rs.map((r) => (
                                  <tr key={r.id} className="border-t border-white/5">
                                    <td className="py-1.5 font-mono text-white/70 whitespace-nowrap">{formatDate(r.date)}</td>
                                    <td className="py-1.5 font-mono text-white/70">{r.qty.toLocaleString('en-IN')}</td>
                                    <td className="py-1.5 font-mono">
                                      {r.rate == null
                                        ? <span className="badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px]">rate not set</span>
                                        : <span className="text-white/90">₹{r.rate.toLocaleString('en-IN')}/{m.unit}</span>}
                                    </td>
                                    {showCosts && <td className="py-1.5 font-mono text-white/70">{r.rate == null ? '—' : formatINR(r.qty * r.rate)}</td>}
                                    <td className="py-1.5 text-white/70">{r.party || '—'}</td>
                                    <td className="py-1.5 font-mono text-white/60">{r.billNo || '—'}</td>
                                    <td className="py-1.5 text-muted">{r.note ?? r.grnRef ?? '—'}</td>
                                    <td className="py-1.5"><div className="flex gap-1 justify-end">
                                      <button onClick={() => setReceiptModal({ item: m, receipt: r })} title={r.rate == null ? 'Set rate' : 'Edit'} className="p-1 rounded hover:bg-accent/20 text-muted hover:text-accent"><Pencil className="w-3 h-3" /></button>
                                      <button onClick={() => handleReceiptDelete(r.id)} className="p-1 rounded hover:bg-red-500/20 text-muted hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                    </div></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Raw Material' : 'Edit Item'} size="md">
          <ItemForm initial={modal.item ?? null} editing={modal.type === 'edit'} onSave={handleSave} onSaveAndNew={handleSaveAndNew} onClose={() => setModal(null)} />
        </Modal>
      )}

      {receiptModal && (
        <Modal open onClose={() => setReceiptModal(null)} size="md"
          title={receiptModal.receipt ? `Reprice receipt — ${receiptModal.item.name}` : `Receive stock — ${receiptModal.item.name}`}>
          <ReceiptForm unit={receiptModal.item.unit} editing={!!receiptModal.receipt}
            initial={receiptModal.receipt ?? {
              materialId: receiptModal.item.id, qty: 0, rate: null,
              date: today(), createdAt: new Date().toISOString(),
            }}
            onSave={handleReceiptSave} onClose={() => setReceiptModal(null)} />
        </Modal>
      )}
    </div>
  );
}
