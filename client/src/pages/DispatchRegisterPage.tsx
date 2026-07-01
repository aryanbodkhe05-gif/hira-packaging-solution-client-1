import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Search, Download, Trash2, ExternalLink, Check, X, Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { dispatchesDb, ordersDb, invRollsDb, jobCardsDb } from '../lib/db';
import type { DispatchRecord, Order, InvRoll } from '../types/models';
import type { DispatchType } from '../config';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { formatDate, exportToCsv, cn } from '../lib/utils';

const PAGE_SIZE = 20;
const todayStr = () => new Date().toLocaleDateString('en-CA');

// ═════════════════════════════════════════════════════════════════════════════
// ADD DISPATCH — manual fallback when the Job Card "Send to Dispatch" was missed.
// Bags: dispatch an existing order. Rolls: an existing order OR a roll from stock.
// ═════════════════════════════════════════════════════════════════════════════
function AddDispatchForm({ type, onDone, onClose }: { type: DispatchType; onDone: () => void; onClose: () => void }) {
  const isRoll = type === 'Roll';
  const [mode, setMode] = useState<'order' | 'stock'>('order');
  const [orderId, setOrderId] = useState('');
  const [rollId, setRollId] = useState('');
  const [party, setParty] = useState('');
  const [vehicle, setVehicle] = useState('');

  // Orders not yet dispatched, routed to this register by making type.
  const orders = useMemo(() => ordersDb.getAll().filter((o) =>
    o.status !== 'Dispatched' && (isRoll ? o.makingType === 'Roll' : o.makingType !== 'Roll')
  ), [isRoll]);
  // Rolls still in stock (not already dispatched).
  const stockRolls = useMemo(() => invRollsDb.getAll().filter((r) => !r.dispatched), []);

  function dispatchOrder() {
    const order = orders.find((o) => o.id === orderId) as Order | undefined;
    if (!order) { toast.error('Select an order'); return; }
    const now = new Date().toISOString();
    const date = todayStr();
    const jc = order.jobCardId ? jobCardsDb.get(order.jobCardId) : null;
    dispatchesDb.create({
      type, jobCardId: order.jobCardId, orderRef: order.id, orderNo: order.orderId,
      jobNo: jc?.jobNo ?? order.orderId, party: order.clientName, brand: order.productType,
      qtyKg: order.quantityKg,
      ...(isRoll ? { rolls: order.quantityNos ?? 1 } : { qtyPieces: order.quantityNos }),
      vehicle: vehicle.trim() || undefined, date, createdAt: now,
    });
    ordersDb.update(order.id, { status: 'Dispatched', dispatchedAt: now, dispatchDate: date });
    toast.success(`Order ${order.orderId} dispatched`);
    onDone();
  }

  function dispatchStockRoll() {
    const roll = stockRolls.find((r) => r.id === rollId) as InvRoll | undefined;
    if (!roll) { toast.error('Select a roll from stock'); return; }
    const now = new Date().toISOString();
    dispatchesDb.create({
      type: 'Roll', rollId: roll.id, jobNo: roll.rollNo, party: party.trim() || 'Stock dispatch',
      brand: roll.type, qtyKg: roll.nWt, rolls: 1, qtyMeters: roll.meter,
      vehicle: vehicle.trim() || undefined, date: todayStr(), createdAt: now,
    });
    invRollsDb.update(roll.id, { dispatched: true, dispatchedAt: now });
    toast.success(`Roll ${roll.rollNo} dispatched from stock`);
    onDone();
  }

  return (
    <div className="space-y-4">
      {isRoll && (
        <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10">
          {([['order', 'From Order'], ['stock', 'From Roll Stock']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all', mode === k ? 'bg-primary text-white' : 'text-muted hover:text-white')}>
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === 'order' || !isRoll ? (
        <>
          <div>
            <label className="label">Select {isRoll ? 'roll' : 'bag'} order *</label>
            <select className="input-field" value={orderId} onChange={(e) => setOrderId(e.target.value)} autoFocus>
              <option value="">Choose an order…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.orderId} · {o.clientName} · {o.sizeDisplay}{o.quantityKg ? ` · ${o.quantityKg}kg` : ''}{o.quantityNos ? ` · ${o.quantityNos} nos` : ''}</option>
              ))}
            </select>
            {orders.length === 0 && <p className="text-muted text-xs mt-1">No pending {isRoll ? 'roll' : 'bag'} orders to dispatch.</p>}
          </div>
          <div><label className="label">Vehicle No (optional)</label><input className="input-field" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="MH-12-AB-1234" /></div>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={dispatchOrder} disabled={!orderId} className="btn-primary flex-1 justify-center">Mark Dispatched</button>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="label">Select roll from stock *</label>
            <select className="input-field" value={rollId} onChange={(e) => setRollId(e.target.value)} autoFocus>
              <option value="">Choose a roll…</option>
              {stockRolls.map((r) => (
                <option key={r.id} value={r.id}>{r.rollNo} · {r.type}{r.size ? ` · ${r.size}` : ''}{r.meter ? ` · ${r.meter}m` : ''}{r.nWt ? ` · ${r.nWt}kg` : ''}</option>
              ))}
            </select>
            {stockRolls.length === 0 && <p className="text-muted text-xs mt-1">No rolls available in stock.</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Party / Customer (optional)</label><input className="input-field" value={party} onChange={(e) => setParty(e.target.value)} placeholder="Walk-in / customer" /></div>
            <div><label className="label">Vehicle No (optional)</label><input className="input-field" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="MH-12-AB-1234" /></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={dispatchStockRoll} disabled={!rollId} className="btn-primary flex-1 justify-center">Dispatch Roll</button>
          </div>
        </>
      )}
    </div>
  );
}

// Consolidated dispatch register, fed by Job Card "Send to Dispatch" and the
// manual "Add Dispatch" above. Reused for both Bags and Rolls via the `type` prop.
export function DispatchRegisterPage({ type }: { type: DispatchType }) {
  const nav = useNavigate();
  const [records, setRecords] = useState<DispatchRecord[]>(() => dispatchesDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);  // row being bill-edited
  const [billDraft, setBillDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const reload = () => setRecords(dispatchesDb.getAll());

  const isRoll = type === 'Roll';

  function handleDelete(id: string) {
    if (!confirm('Delete this dispatch record?')) return;
    dispatchesDb.delete(id);
    toast.success('Dispatch record deleted');
    reload();
  }
  function startBillEdit(r: DispatchRecord) { setEditId(r.id); setBillDraft(r.billNo ?? ''); }
  function saveBill(id: string) {
    dispatchesDb.update(id, { billNo: billDraft.trim() || undefined });
    setEditId(null);
    toast.success('Bill No updated');
    reload();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter((r) => r.type === type)
      .filter((r) => !q || r.party.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q) ||
        r.jobNo.toLowerCase().includes(q) || (r.orderNo ?? '').toLowerCase().includes(q));
  }, [records, type, search]);

  useEffect(() => { setPage(1); }, [search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalKg = filtered.reduce((s, r) => s + (r.qtyKg ?? 0), 0);
  const totalUnits = isRoll
    ? filtered.reduce((s, r) => s + (r.rolls ?? 0), 0)
    : filtered.reduce((s, r) => s + (r.qtyPieces ?? 0), 0);

  function handleExport() {
    if (!filtered.length) { toast.error('Nothing to export'); return; }
    const rows = filtered.map((r) => ({
      Date: r.date, 'Job No': r.jobNo, Order: r.orderNo ?? '', Party: r.party, Brand: r.brand,
      ...(isRoll ? { Rolls: r.rolls ?? 0, Meters: r.qtyMeters ?? 0 } : { Pieces: r.qtyPieces ?? 0 }),
      'Qty (kg)': r.qtyKg ?? 0, 'Bill No': r.billNo ?? '',
    }));
    exportToCsv(`dispatch-${type.toLowerCase()}s-${todayStr()}.csv`, rows);
    toast.success(`Exported ${rows.length} rows`);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Dispatch – {type}s</h1>
        <p className="text-muted text-sm mt-1">Finished-{isRoll ? 'roll' : 'bag'} dispatches — from Job Card "Send to Dispatch" or added manually</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Dispatches" value={filtered.length} icon={Truck} iconColor="text-accent" mono />
        <StatCard label={isRoll ? 'Total Rolls' : 'Total Pieces'} value={totalUnits.toLocaleString('en-IN')} icon={Truck} iconColor="text-blue-400" mono />
        <StatCard label="Total Kg" value={totalKg.toLocaleString('en-IN')} icon={Truck} iconColor="text-green-400" mono />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search party, brand, job/order no…" className="input-field pl-9" />
        </div>
        <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
        <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Dispatch</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Date', 'Job No', 'Order', 'Party', 'Brand', ...(isRoll ? ['Rolls', 'Meters'] : ['Pieces']), 'Kg', 'Bill No', ''].map((h) => (
                  <th key={h} className="table-header whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={isRoll ? 10 : 9}>
                  <EmptyState icon={Truck} title={`No ${type.toLowerCase()} dispatches yet`}
                    description={`Send a ${isRoll ? 'roll' : 'bag'} job card to dispatch, or click "Add Dispatch".`} />
                </td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell text-white/70 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="table-cell font-mono text-accent whitespace-nowrap">{r.jobNo}</td>
                  <td className="table-cell font-mono text-white/60 text-xs whitespace-nowrap">{r.orderNo ?? '—'}</td>
                  <td className="table-cell text-white/90">{r.party}</td>
                  <td className="table-cell text-white/70">{r.brand || '—'}</td>
                  {isRoll && <td className="table-cell font-mono text-white/80">{(r.rolls ?? 0).toLocaleString('en-IN')}</td>}
                  {isRoll && <td className="table-cell font-mono text-white/80">{(r.qtyMeters ?? 0).toLocaleString('en-IN')}</td>}
                  {!isRoll && <td className="table-cell font-mono text-white/80">{(r.qtyPieces ?? 0).toLocaleString('en-IN')}</td>}
                  <td className="table-cell font-mono text-white/80">{(r.qtyKg ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell">
                    {editId === r.id ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={billDraft} onChange={(e) => setBillDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveBill(r.id); if (e.key === 'Escape') setEditId(null); }}
                          className="input-field font-mono py-1 text-xs w-28" placeholder="Bill No" />
                        <button onClick={() => saveBill(r.id)} className="p-1 rounded bg-primary text-white"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditId(null)} className="p-1 rounded bg-white/10 text-muted"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startBillEdit(r)} className="flex items-center gap-1 text-xs hover:text-accent transition-colors group">
                        {r.billNo
                          ? <span className="font-mono text-white/80">{r.billNo}</span>
                          : <span className="text-muted">+ Bill No</span>}
                        <Pencil className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100" />
                      </button>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1.5">
                      {r.jobCardId && (
                        <button onClick={() => nav(`/job-card/${r.jobCardId}`)} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors" title="Open job card"><ExternalLink className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {addOpen && (
        <Modal open onClose={() => setAddOpen(false)} title={`Add ${type} Dispatch`} size="md">
          <AddDispatchForm type={type} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); reload(); }} />
        </Modal>
      )}
    </div>
  );
}
