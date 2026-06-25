import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Truck, Search, Factory, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { ordersDb, jobCardsDb } from '../lib/db';
import { PRODUCT_TYPES, ORDER_STATUSES, MAKING_TYPES } from '../config';
import type { Order } from '../types/models';
import type { ProductType, OrderStatus, MakingType } from '../config';
import { createJobCardFromOrder, genJobNo } from '../lib/jobcard';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  'Dispatched':    'bg-success/20 text-success border-success/30',
  'Ready':         'bg-accent/20 text-accent border-accent/30',
  'In Production': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'QC Check':      'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Pending':       'bg-white/10 text-white/60 border-white/10',
};
const TYPE_COLORS: Record<string, string> = {
  BOPP: '#3131B5', UL: '#5E5EE8', Natural: '#12B76A', Laminated: '#f59e0b',
};

function genOrderId(): string {
  const ymd = format(new Date(), 'yyyyMMdd');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `NF-${ymd}-${rand}`;
}

// ── Order Form ─────────────────────────────────────────────────────────────────
const emptyOrder: Omit<Order, 'id'> = {
  orderId: '', clientName: '', productType: 'BOPP',
  makingType: 'Bag',
  length: 0, width: 0, gsm: 0, sizeDisplay: '',
  quantityKg: undefined, quantityNos: undefined, quantityUnit: 'Both',
  status: 'Pending', notes: '', createdAt: new Date().toISOString(),
};

function OrderForm({ initial, onSave, onClose }: {
  initial: Omit<Order, 'id'>;
  onSave: (data: Omit<Order, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({ ...initial, orderId: initial.orderId || genOrderId() });
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({
    ...p, [k]: v,
    ...(k === 'length' || k === 'width' || k === 'gsm' ? {
      sizeDisplay: `${k === 'length' ? v : p.length} × ${k === 'width' ? v : p.width} + ${k === 'gsm' ? v : p.gsm} gm`
    } : {})
  }));

  function submit() {
    if (!f.clientName.trim()) { toast.error('Client name required'); return; }
    if (!f.length || !f.width) { toast.error('Length and width required'); return; }
    onSave({ ...f, sizeDisplay: `${f.length} × ${f.width} + ${f.gsm} gm` });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Order ID</label>
          <input className="input-field font-mono text-accent" value={f.orderId} readOnly />
        </div>
        <div>
          <label className="label">Product Type</label>
          <select className="input-field" value={f.productType}
            onChange={(e) => {
              const pt = e.target.value as ProductType;
              setF((p) => ({ ...p, productType: pt, makingType: pt === 'BOPP' ? (p.makingType ?? 'Bag') : undefined }));
            }}>
            {PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Making Type — only for BOPP. Roll → roll-only card (no cutting); Bag → full flow. */}
      {f.productType === 'BOPP' && (
        <div>
          <label className="label">Making Type *</label>
          <div className="flex gap-2">
            {MAKING_TYPES.map((m) => (
              <button key={m} type="button" onClick={() => set('makingType', m)}
                className={cn('px-4 py-1.5 rounded text-sm font-medium transition-colors',
                  (f.makingType ?? 'Bag') === m ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white')}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label">Client Name *</label>
        <input className="input-field" value={f.clientName}
          onChange={(e) => set('clientName', e.target.value)}
          placeholder="e.g. Amrit Snacks Pvt Ltd" autoFocus />
      </div>

      {/* Size inputs */}
      <div>
        <label className="label">Size (Length × Width + GSM)</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <input className="input-field font-mono" type="number" min="0" step="0.01"
              value={f.length || ''} onChange={(e) => set('length', parseFloat(e.target.value) || 0)}
              placeholder="Length" />
            <p className="text-muted text-[10px] mt-0.5 ml-1">Length</p>
          </div>
          <div>
            <input className="input-field font-mono" type="number" min="0" step="0.01"
              value={f.width || ''} onChange={(e) => set('width', parseFloat(e.target.value) || 0)}
              placeholder="Width" />
            <p className="text-muted text-[10px] mt-0.5 ml-1">Width</p>
          </div>
          <div>
            <input className="input-field font-mono" type="number" min="0" step="0.01"
              value={f.gsm || ''} onChange={(e) => set('gsm', parseFloat(e.target.value) || 0)}
              placeholder="0.96" />
            <p className="text-muted text-[10px] mt-0.5 ml-1">GSM</p>
          </div>
        </div>
        {f.length > 0 && f.width > 0 && (
          <p className="text-accent text-xs font-mono mt-1.5 bg-accent/10 px-3 py-1 rounded-lg inline-block">
            Preview: {f.length} × {f.width} + {f.gsm} gm
          </p>
        )}
      </div>

      {/* Quantity */}
      <div>
        <label className="label">Quantity Unit</label>
        <div className="flex gap-2 mb-2">
          {(['KG', 'Nos', 'Both'] as const).map((u) => (
            <button key={u}
              onClick={() => set('quantityUnit', u)}
              className={cn('px-3 py-1 rounded text-xs font-medium transition-colors',
                f.quantityUnit === u ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white')}
            >{u}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(f.quantityUnit === 'KG' || f.quantityUnit === 'Both') && (
            <div>
              <label className="label">Quantity (KG)</label>
              <input className="input-field font-mono" type="number" min="0"
                value={f.quantityKg || ''} onChange={(e) => set('quantityKg', parseFloat(e.target.value) || undefined)}
                placeholder="450" />
            </div>
          )}
          {(f.quantityUnit === 'Nos' || f.quantityUnit === 'Both') && (
            <div>
              <label className="label">Quantity (Nos)</label>
              <input className="input-field font-mono" type="number" min="0"
                value={f.quantityNos || ''} onChange={(e) => set('quantityNos', parseFloat(e.target.value) || undefined)}
                placeholder="12000" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Status</label>
          <select className="input-field" value={f.status}
            onChange={(e) => set('status', e.target.value as OrderStatus)}>
            {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input-field" type="date"
            value={f.createdAt.slice(0, 10)}
            onChange={(e) => set('createdAt', e.target.value + 'T09:00:00Z')} />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input-field resize-none" rows={2} value={f.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Special instructions…" />
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Order</button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
// Note: order-side dispatch was removed — dispatch is now triggered only from the
// Job Card (Send to Dispatch), which posts a dispatch record and flips the linked
// order to Dispatched. See JobCardDetailPage.
export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(() => ordersDb.getAll());
  const [search, setSearch]   = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // 'YYYY-MM'
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; order?: Order } | null>(null);
  const nav = useNavigate();

  const reload = useCallback(() => setOrders(ordersDb.getAll()), []);

  // Push an order into Production — creates the correct, pre-filled, linked Job Card.
  function sendToProduction(order: Order) {
    if (order.jobCardId && jobCardsDb.get(order.jobCardId)) {
      nav(`/job-card/${order.jobCardId}`);
      return;
    }
    if (order.productType === 'BOPP' && !order.makingType) {
      toast.error('Set Making Type (Roll / Bag) on the order first'); return;
    }
    const now = new Date().toISOString();
    const draft = createJobCardFromOrder(order);
    const jobNo = genJobNo(jobCardsDb.getAll().map((j) => j.jobNo));
    const created = jobCardsDb.create({ ...draft, jobNo, ratesAsOf: now, createdAt: now, updatedAt: now });
    ordersDb.update(order.id, { status: 'In Production', jobCardId: created.id });
    const dest = created.cardType === 'Normal' ? 'Normal Bag' : `BOPP (${created.makingType})`;
    toast.success(`Sent to Production → ${dest} job card ${created.jobNo}`);
    reload();
    nav(`/job-card/${created.id}`);
  }

  // Build month options from order dates
  const months = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => set.add(o.createdAt.slice(0, 7)));
    return [...set].sort().reverse();
  }, [orders]);

  const filtered = useMemo(() => orders.filter((o) => {
    const ms = !search || o.clientName.toLowerCase().includes(search.toLowerCase()) || o.orderId.toLowerCase().includes(search.toLowerCase());
    const mt = !typeFilter || o.productType === typeFilter;
    const mst = !statusFilter || o.status === statusFilter;
    const mm = !selectedMonth || o.createdAt.startsWith(selectedMonth);
    return ms && mt && mst && mm;
  }), [orders, search, typeFilter, statusFilter, selectedMonth]);

  function handleSave(data: Omit<Order, 'id'>) {
    if (modal?.type === 'edit' && modal.order) {
      ordersDb.update(modal.order.id, data);
      toast.success('Order updated');
    } else {
      ordersDb.create(data);
      toast.success('Order created!');
    }
    reload();
    setModal(null);
  }

  function handleDelete(id: string) {
    ordersDb.delete(id);
    toast.success('Order deleted');
    reload();
  }

  // Group by month for month-based view
  const grouped = useMemo(() => {
    const map: Record<string, Order[]> = {};
    filtered.forEach((o) => {
      const m = o.createdAt.slice(0, 7);
      if (!map[m]) map[m] = [];
      map[m].push(o);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-header">Orders</h1>
          <p className="text-muted text-sm mt-1">Manage orders with month-based tracking</p>
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary">
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or order ID…" className="input-field pl-9 w-52" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-36">
          <option value="">All Types</option>
          {PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-40">
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="input-field w-36">
          <option value="">All Months</option>
          {months.map((m) => (
            <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMM yyyy')}</option>
          ))}
        </select>
      </div>

      {/* Month-grouped tables */}
      {grouped.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={Truck} title="No orders found"
            action={{ label: 'Create First Order', onClick: () => setModal({ type: 'add' }) }} />
        </div>
      ) : (
        grouped.map(([month, monthOrders]) => (
          <div key={month} className="glass-card overflow-hidden">
            {/* Month header */}
            <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-semibold">
                  {format(parseISO(month + '-01'), 'MMMM yyyy')}
                </h3>
                <span className="text-muted text-xs font-mono">{monthOrders.length} orders</span>
                <span className="text-muted text-xs font-mono">
                  {monthOrders.reduce((s, o) => s + (o.quantityKg ?? 0), 0).toLocaleString('en-IN')} KG
                </span>
              </div>
              <span className="text-xs text-success font-medium">
                {monthOrders.filter((o) => o.status === 'Dispatched').length} dispatched
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="table-header">Order ID</th>
                    <th className="table-header">Client</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Size</th>
                    <th className="table-header">KG</th>
                    <th className="table-header">Nos</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Bill No.</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody>
                  {monthOrders.map((o) => (
                    <tr key={o.id} className="table-row">
                      <td className="table-cell font-mono text-accent text-xs">{o.orderId}</td>
                      <td className="table-cell font-medium">{o.clientName}</td>
                      <td className="table-cell">
                        <span className="badge text-xs" style={{ background: TYPE_COLORS[o.productType] + '22', color: TYPE_COLORS[o.productType], border: `1px solid ${TYPE_COLORS[o.productType]}44` }}>
                          {o.productType}
                        </span>
                      </td>
                      <td className="table-cell font-mono text-xs text-muted">{o.sizeDisplay}</td>
                      <td className="table-cell font-mono">{o.quantityKg?.toLocaleString('en-IN') ?? '—'}</td>
                      <td className="table-cell font-mono">{o.quantityNos?.toLocaleString('en-IN') ?? '—'}</td>
                      <td className="table-cell">
                        <span className={cn('badge border text-xs', STATUS_COLORS[o.status] ?? 'bg-white/10 text-muted')}>{o.status}</span>
                      </td>
                      <td className="table-cell font-mono text-xs">{o.billNo ?? '—'}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          {o.jobCardId ? (
                            <button onClick={() => nav(`/job-card/${o.jobCardId}`)}
                              className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors" title="Open linked Job Card">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          ) : o.status !== 'Dispatched' && (
                            <button onClick={() => sendToProduction(o)}
                              className="p-1.5 rounded hover:bg-primary/20 text-muted hover:text-accent transition-colors" title="Send to Production">
                              <Factory className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setModal({ type: 'edit', order: o })}
                            className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(o.id)}
                            className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Modals */}
      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <Modal open onClose={() => setModal(null)}
          title={modal.type === 'add' ? 'New Order' : 'Edit Order'} size="lg">
          <OrderForm
            initial={modal.order
              ? { ...modal.order }
              : { ...emptyOrder, createdAt: new Date().toISOString() }}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
