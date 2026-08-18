import { useState, useCallback, useMemo, useEffect, Fragment } from 'react';
import { Plus, Pencil, Trash2, Search, Layers, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { tapeReceiptsDb } from '../lib/db';
import { tapePools } from '../lib/tape';
import { useUnit } from '../context/UnitContext';
import { unitName } from '../lib/units';
import { canViewCosts } from '../lib/roles';
import {
  DEFAULT_TAPE_SIZES, TAPE_SIZES_KEY, DEFAULT_PARTIES, PARTIES_KEY, unitMakesTape,
} from '../config';
import type { TapeReceipt } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { TypeAhead, rememberTypeAhead } from '../components/ui/TypeAhead';
import { formatDate } from '../lib/utils';
import { formatINR } from '../lib/jobcard';

const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

// Add / receive a tape lot: Tape Size, Qty (kg), Party, Bill, Rate. Rate optional.
function TapeForm({ initial, fixedSize, editing, onSave, onClose }: {
  initial: Omit<TapeReceipt, 'id' | 'unitId'>; fixedSize?: string; editing?: boolean;
  onSave: (d: Omit<TapeReceipt, 'id' | 'unitId'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const [rateText, setRateText] = useState(initial.rate == null ? '' : String(initial.rate));
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.size.trim()) { toast.error('Tape size is required'); return; }
    if (!f.qty) { toast.error('Quantity is required'); return; }
    if (editing && f.qty !== initial.qty && !confirm(`⚠️ Change tape quantity from ${initial.qty} to ${f.qty} kg?`)) return;
    rememberTypeAhead(TAPE_SIZES_KEY, f.size, DEFAULT_TAPE_SIZES);
    if (f.party?.trim()) rememberTypeAhead(PARTIES_KEY, f.party, DEFAULT_PARTIES);
    onSave({ ...f, size: f.size.trim(), rate: rateText.trim() === '' ? null : num(rateText) });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tape Size *</label>
          {fixedSize ? <input className="input-field font-mono bg-white/5 text-white/60" value={f.size} readOnly />
            : <TypeAhead value={f.size} onChange={(v) => set('size', v)} listKey={TAPE_SIZES_KEY} defaults={DEFAULT_TAPE_SIZES} placeholder="e.g. 2.5 inch" />}
        </div>
        <div><label className="label">Qty (kg) *</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.qty || ''} onChange={(e) => set('qty', num(e.target.value))} /></div>
        <div><label className="label">Rate (₹/kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder="optional — price later" /></div>
        <div><label className="label">Date</label><input className="input-field" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label className="label">Party Name</label><TypeAhead value={f.party ?? ''} onChange={(v) => set('party', v)} listKey={PARTIES_KEY} defaults={DEFAULT_PARTIES} placeholder="supplier / party" /></div>
        <div><label className="label">Bill No.</label><input className="input-field font-mono" value={f.billNo ?? ''} onChange={(e) => set('billNo', e.target.value)} placeholder="invoice / bill no." /></div>
      </div>
      {rateText.trim() === '' && (
        <p className="text-yellow-300/90 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
          Saved without a rate — this tape is held as unrated, excluded from the average/value until priced.
        </p>
      )}
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">{editing ? 'Save' : 'Add Tape'}</button>
      </div>
    </div>
  );
}

export function TapeStockPage() {
  const { activeUnit } = useUnit();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [receiveSize, setReceiveSize] = useState<string | null>(null);   // add lot to a size
  const [editReceipt, setEditReceipt] = useState<TapeReceipt | null>(null);
  const showCosts = canViewCosts();
  const label = unitMakesTape(activeUnit) ? 'Tape Log' : 'Tape Stock';

  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => { reload(); }, [activeUnit, reload]);

  const pools = useMemo(() => { void tick; return tapePools(activeUnit); }, [tick, activeUnit]);
  const receipts = useMemo(() => { void tick; return tapeReceiptsDb.getAll().filter((r) => r.unitId === activeUnit); }, [tick, activeUnit]);
  const receiptsFor = (size: string) => receipts.filter((r) => r.size === size)
    .sort((a, b) => (b.date !== a.date ? (b.date < a.date ? -1 : 1) : (b.createdAt || '').localeCompare(a.createdAt || '')));

  function handleAdd(d: Omit<TapeReceipt, 'id' | 'unitId'>) {
    tapeReceiptsDb.create({ ...d, unitId: activeUnit });
    toast.success(`Tape added — ${d.size}`); setAddOpen(false); setReceiveSize(null); reload();
  }
  function handleEditSave(d: Omit<TapeReceipt, 'id' | 'unitId'>) {
    if (editReceipt) { tapeReceiptsDb.update(editReceipt.id, d); toast.success('Tape lot updated'); }
    setEditReceipt(null); reload();
  }
  function handleReceiptDelete(id: string) { tapeReceiptsDb.delete(id); toast.success('Tape lot deleted'); reload(); }
  function handleSizeDelete(size: string) {
    if (!confirm(`Delete ALL tape lots for size ${size}?`)) return;
    receipts.filter((r) => r.size === size).forEach((r) => tapeReceiptsDb.delete(r.id));
    toast.success(`Removed tape size ${size}`); reload();
  }

  const filtered = pools.filter((p) => !search.trim() || p.size.toLowerCase().includes(search.trim().toLowerCase()));
  const unratedSizes = pools.filter((p) => p.unratedQty > 0).length;
  const stockValue = pools.reduce((s, p) => s + (p.value || 0), 0);
  const totalKg = pools.reduce((s, p) => s + Math.max(0, p.qty), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-header">{label} — {unitName(activeUnit)}</h1>
          <p className="text-muted text-sm mt-1">{unitMakesTape(activeUnit)
            ? 'Tape made in the Tape Plant, stocked by size — moving-average rate per size, consumed by the loom.'
            : 'Purchased tape, stocked by size — moving-average rate per size, consumed by the loom.'}</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Tape</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tape Sizes" value={pools.length} icon={Layers} iconColor="text-accent" mono />
        <StatCard label="Total Stock (kg)" value={totalKg.toLocaleString('en-IN')} icon={Layers} iconColor="text-green-400" mono />
        <StatCard label="Unrated Sizes" value={unratedSizes} icon={AlertTriangle} iconColor="text-yellow-400" mono />
        {showCosts && <StatCard label="Stock Value" value={formatINR(stockValue)} icon={Layers} iconColor="text-green-400" mono />}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tape size…" className="input-field pl-9" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['', 'Tape Size', 'In Stock (kg)', ...(showCosts ? ['Avg Rate', 'Value'] : []), 'Lots', ''].map((h, i) => <th key={i} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={showCosts ? 7 : 5}><EmptyState icon={Layers} title="No tape in stock" action={{ label: 'Add Tape', onClick: () => setAddOpen(true) }} /></td></tr>
              ) : filtered.map((p) => {
                const open = !!expanded[p.size];
                return (
                  <Fragment key={p.size}>
                    <tr className="table-row">
                      <td className="table-cell w-8">
                        <button onClick={() => setExpanded((x) => ({ ...x, [p.size]: !x[p.size] }))} className="p-1 rounded hover:bg-white/10 text-muted hover:text-white" title="Show lots">
                          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="table-cell text-white/90 font-medium font-mono">
                        {p.size}
                        {p.unratedQty > 0 && <span className="ml-2 badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px]">{p.unratedQty} kg unrated</span>}
                      </td>
                      <td className={'table-cell font-mono ' + (p.qty < 20 ? 'text-red-300' : 'text-white/80')}>{p.qty.toLocaleString('en-IN')}</td>
                      {showCosts && <td className="table-cell font-mono text-white/80">{p.avgRate == null ? <span className="text-muted">—</span> : `₹${p.avgRate.toLocaleString('en-IN')}`}</td>}
                      {showCosts && <td className="table-cell font-mono text-white/80">{p.value > 0 ? formatINR(p.value) : <span className="text-muted">—</span>}</td>}
                      <td className="table-cell font-mono text-muted text-xs">{p.receiptCount}</td>
                      <td className="table-cell"><div className="flex gap-1.5">
                        <button onClick={() => setReceiveSize(p.size)} title="Receive more of this size" className="p-1.5 rounded hover:bg-primary/20 text-muted hover:text-accent transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleSizeDelete(p.size)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={showCosts ? 7 : 5} className="px-5 py-3 bg-navy/40">
                          <table className="w-full text-xs">
                            <thead><tr className="text-muted">
                              <th className="text-left py-1 font-medium">Received</th>
                              <th className="text-left py-1 font-medium">Qty</th>
                              <th className="text-left py-1 font-medium">Rate</th>
                              <th className="text-left py-1 font-medium">Party</th>
                              <th className="text-left py-1 font-medium">Bill No</th>
                              <th></th>
                            </tr></thead>
                            <tbody>
                              {receiptsFor(p.size).map((r) => (
                                <tr key={r.id} className="border-t border-white/5">
                                  <td className="py-1.5 font-mono text-white/70 whitespace-nowrap">{formatDate(r.date)}</td>
                                  <td className="py-1.5 font-mono text-white/70">{r.qty.toLocaleString('en-IN')}</td>
                                  <td className="py-1.5 font-mono">{r.rate == null ? <span className="badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px]">rate not set</span> : <span className="text-white/90">₹{r.rate}/kg</span>}</td>
                                  <td className="py-1.5 text-white/70">{r.party || '—'}</td>
                                  <td className="py-1.5 font-mono text-white/60">{r.billNo || '—'}</td>
                                  <td className="py-1.5"><div className="flex gap-1 justify-end">
                                    <button onClick={() => setEditReceipt(r)} className="p-1 rounded hover:bg-accent/20 text-muted hover:text-accent"><Pencil className="w-3 h-3" /></button>
                                    <button onClick={() => handleReceiptDelete(r.id)} className="p-1 rounded hover:bg-red-500/20 text-muted hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                  </div></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <Modal open onClose={() => setAddOpen(false)} title={`Add Tape — ${unitName(activeUnit)}`} size="md">
          <TapeForm initial={{ size: '', qty: 0, rate: null, date: today(), createdAt: new Date().toISOString() }} onSave={handleAdd} onClose={() => setAddOpen(false)} />
        </Modal>
      )}
      {receiveSize && (
        <Modal open onClose={() => setReceiveSize(null)} title={`Receive tape — ${receiveSize}`} size="md">
          <TapeForm fixedSize={receiveSize} initial={{ size: receiveSize, qty: 0, rate: null, date: today(), createdAt: new Date().toISOString() }} onSave={handleAdd} onClose={() => setReceiveSize(null)} />
        </Modal>
      )}
      {editReceipt && (
        <Modal open onClose={() => setEditReceipt(null)} title={`Edit lot — ${editReceipt.size}`} size="md">
          <TapeForm fixedSize={editReceipt.size} editing initial={editReceipt} onSave={handleEditSave} onClose={() => setEditReceipt(null)} />
        </Modal>
      )}
    </div>
  );
}
