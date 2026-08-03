import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Truck, Search, Factory, ExternalLink, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { ordersDb, jobCardsDb, dispatchesDb, getList, addToList } from '../lib/db';
import { orderDispatchProgress, progressBarClass, orderProduction, cardReadyToDispatch } from '../lib/dispatch';
import { canEditRates } from '../lib/roles';
import { PRODUCT_TYPES, ORDER_STATUSES, MAKING_TYPES, BAG_TYPES_KEY, DEFAULT_BAG_TYPES } from '../config';
import type { Order, JobCard, DispatchLine } from '../types/models';
import type { ProductType, OrderStatus, MakingType } from '../config';
import { createJobCardFromOrder, genJobNo, nextOrderJobSeq, jobCardLabel } from '../lib/jobcard';
import { useAuth } from '../context/AuthContext';
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
  'Partially Dispatched': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Short-Closed':  'bg-orange-500/20 text-orange-300 border-orange-500/30',
};
const TYPE_COLORS: Record<string, string> = {
  BOPP: '#3131B5', Laminated: '#f59e0b', Flexo: '#5E5EE8', Plain: '#12B76A',
};

function genOrderId(): string {
  const ymd = format(new Date(), 'yyyyMMdd');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `NF-${ymd}-${rand}`;
}

// ── Order Form ─────────────────────────────────────────────────────────────────
const emptyOrder: Omit<Order, 'id'> = {
  orderId: '', brandName: '', productType: 'BOPP',
  makingType: 'Bag',
  length: 0, width: 0, grm: 0, sizeDisplay: '',
  bagType: '', boppFilmSizes: [],
  metalizeSize: '', linerSize: '', linerGrm: undefined,
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
    ...(k === 'length' || k === 'width' || k === 'grm' ? {
      sizeDisplay: `${k === 'length' ? v : p.length} × ${k === 'width' ? v : p.width} + ${k === 'grm' ? v : p.grm} gm`
    } : {})
  }));

  // Multiple BOPP film sizes — repeatable rows, every one optional.
  const boppSizes = f.boppFilmSizes ?? [];
  const setBoppSize = (i: number, v: string) =>
    setF((p) => ({ ...p, boppFilmSizes: (p.boppFilmSizes ?? []).map((s, j) => (j === i ? v : s)) }));
  const addBoppSize = () => setF((p) => ({ ...p, boppFilmSizes: [...(p.boppFilmSizes ?? []), ''] }));
  const removeBoppSize = (i: number) =>
    setF((p) => ({ ...p, boppFilmSizes: (p.boppFilmSizes ?? []).filter((_, j) => j !== i) }));

  // ── F4: auto-populate from this brand's previous orders ──
  const [loadedFrom, setLoadedFrom] = useState<{ orderId: string; date: string } | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const matches = useMemo(() => {
    const q = f.brandName.trim().toLowerCase();
    if (q.length < 2 || loadedFrom) return [];
    return ordersDb.getAll()
      .filter((o) => (o.brandName ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);
  }, [f.brandName, loadedFrom]);

  function applyOrder(o: Order) {
    setF((p) => ({
      ...p,
      brandName: o.brandName, productType: o.productType, makingType: o.makingType,
      bagType: o.bagType ?? '', boppFilmSizes: [...(o.boppFilmSizes ?? [])],
      metalizeSize: o.metalizeSize ?? '', linerSize: o.linerSize ?? '', linerGrm: o.linerGrm,
      length: o.length, width: o.width, grm: o.grm, sizeDisplay: o.sizeDisplay,
      quantityKg: o.quantityKg, quantityNos: o.quantityNos, quantityUnit: o.quantityUnit,
      notes: o.notes ?? '',
      orderId: genOrderId(), status: 'Pending', createdAt: new Date().toISOString(),
      billNo: undefined, dispatchDate: undefined, dispatchedAt: undefined, jobCardId: undefined,
    }));
    setLoadedFrom({ orderId: o.orderId, date: o.createdAt });
    setShowSuggest(false);
  }
  function startFresh() {
    setF({ ...emptyOrder, orderId: genOrderId(), createdAt: new Date().toISOString() });
    setLoadedFrom(null);
  }

  function submit() {
    // Brand Name is the only required field — every size/GRM/liner field is
    // optional so an order can be raised before the specs are finalised.
    if (!f.brandName.trim()) { toast.error('Brand name required'); return; }
    if (f.bagType?.trim()) addToList(BAG_TYPES_KEY, f.bagType.trim(), DEFAULT_BAG_TYPES); // remember for type-ahead
    onSave({
      ...f,
      bagType: f.bagType?.trim(),
      boppFilmSizes: (f.boppFilmSizes ?? []).map((s) => s.trim()).filter(Boolean),
      metalizeSize: f.metalizeSize?.trim() || undefined,
      linerSize: f.linerSize?.trim() || undefined,
      sizeDisplay: `${f.length} × ${f.width} + ${f.grm} gm`,
    });
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

      <div className="relative">
        <label className="label">Brand Name *</label>
        <input className="input-field" value={f.brandName}
          onChange={(e) => { set('brandName', e.target.value); setLoadedFrom(null); setShowSuggest(true); }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          placeholder="Type a brand to reuse a previous order…" autoFocus />
        {showSuggest && matches.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 glass-card border border-accent/30 max-h-56 overflow-y-auto shadow-2xl">
            <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted border-b border-white/5">Previous orders — click to reuse</p>
            {matches.map((o) => (
              <button key={o.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyOrder(o)}
                className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="text-white/90 text-sm font-medium">{o.brandName}</span>
                  <span className="text-muted text-[10px] font-mono">{format(parseISO(o.createdAt), 'dd MMM yy')}</span>
                </div>
                <p className="text-muted text-xs font-mono">{o.orderId} · {o.productType} · {o.sizeDisplay}{o.quantityKg ? ` · ${o.quantityKg}kg` : ''}{o.quantityNos ? ` · ${o.quantityNos} nos` : ''}</p>
              </button>
            ))}
          </div>
        )}
        {loadedFrom && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="badge bg-accent/20 text-accent border border-accent/30">Loaded from {loadedFrom.orderId} · {format(parseISO(loadedFrom.date), 'dd MMM yy')}</span>
            <button type="button" onClick={startFresh} className="text-muted hover:text-white underline">Start Fresh</button>
          </div>
        )}
      </div>

      {/* Bag Type (type-ahead) */}
      <div>
        <label className="label">Bag Type</label>
        <input className="input-field" list="order-bag-types" value={f.bagType ?? ''} onChange={(e) => set('bagType', e.target.value)} placeholder="handle / laminated / non-laminated" />
        <datalist id="order-bag-types">{getList(BAG_TYPES_KEY, DEFAULT_BAG_TYPES).map((t) => <option key={t} value={t} />)}</datalist>
      </div>

      {/* BOPP film sizes — one or more, all optional */}
      <div>
        <label className="label">BOPP Film Size (mm)</label>
        <div className="space-y-2">
          {boppSizes.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input className="input-field font-mono flex-1" value={s}
                onChange={(e) => setBoppSize(i, e.target.value)} placeholder="e.g. 520" />
              <button type="button" onClick={() => removeBoppSize(i)}
                className="p-2 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors" title="Remove this size">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addBoppSize} className="btn-secondary text-xs">
            <Plus className="w-3.5 h-3.5" /> {boppSizes.length ? 'Add another size' : 'Add BOPP film size'}
          </button>
        </div>
      </div>

      {/* Metalize + Liner — all optional */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Metalize Size (mm)</label>
          <input className="input-field font-mono" value={f.metalizeSize ?? ''}
            onChange={(e) => set('metalizeSize', e.target.value)} placeholder="e.g. 480" />
        </div>
        <div>
          <label className="label">Liner Size (mm)</label>
          <input className="input-field font-mono" value={f.linerSize ?? ''}
            onChange={(e) => set('linerSize', e.target.value)} placeholder="e.g. 500" />
        </div>
        <div>
          <label className="label">Liner GRM</label>
          <input className="input-field font-mono" type="number" min="0" step="0.01" value={f.linerGrm ?? ''}
            onChange={(e) => set('linerGrm', parseFloat(e.target.value) || undefined)} placeholder="e.g. 1.2" />
        </div>
      </div>

      {/* Size inputs */}
      <div>
        <label className="label">Size (Length × Width + GRM)</label>
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
              value={f.grm || ''} onChange={(e) => set('grm', parseFloat(e.target.value) || 0)}
              placeholder="0.96" />
            <p className="text-muted text-[10px] mt-0.5 ml-1">GRM</p>
          </div>
        </div>
        {f.length > 0 && f.width > 0 && (
          <p className="text-accent text-xs font-mono mt-1.5 bg-accent/10 px-3 py-1 rounded-lg inline-block">
            Preview: {f.length} × {f.width} + {f.grm} gm
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
  const [cardsModal, setCardsModal] = useState<Order | null>(null);
  const nav = useNavigate();

  const { user } = useAuth();
  const reload = useCallback(() => setOrders(ordersDb.getAll()), []);
  const dispatches = useMemo(() => dispatchesDb.getAll(), [orders]);
  const allCards = useMemo(() => jobCardsDb.getAll(), [orders]);
  const cardsForOrder = useCallback((orderId: string) => jobCardsDb.getAll().filter((c) => c.orderRef === orderId), []);

  // Short-close: owner/manager closes an order before 100% (client wanted less /
  // capacity). Requires a confirm; records who + optional reason; stops pending.
  function shortClose(o: Order) {
    const p = orderDispatchProgress(o, dispatches);
    if (!window.confirm(`⚠️ Are you sure?\n\nThis will CLOSE order ${o.orderId} with ${p.pendingPcs.toLocaleString('en-IN')} pcs / ${p.pendingKg.toLocaleString('en-IN')} kg still pending, and stop it counting as pending.`)) return;
    const reason = window.prompt('Optional reason for short-close:') ?? '';
    ordersDb.update(o.id, { closedAt: new Date().toISOString(), closedBy: user?.name ?? 'unknown', closeReason: reason.trim() || undefined });
    toast.success(`Order ${o.orderId} short-closed`);
    reload();
  }

  // Create the next job card for an order (JC-n numbered). Same description; an
  // order can span multiple cards.
  function createNextJobCard(order: Order) {
    if (order.productType === 'BOPP' && !order.makingType) {
      toast.error('Set Making Type (Roll / Bag) on the order first'); return;
    }
    const now = new Date().toISOString();
    const draft = createJobCardFromOrder(order);
    const jobNo = genJobNo(jobCardsDb.getAll().map((j) => j.jobNo));
    const seq = nextOrderJobSeq(cardsForOrder(order.id));
    // No auto-carry: any earlier card's ready-to-dispatch balance is moved onto
    // this card later via the explicit "Add ready-to-dispatch balance" button in
    // the Dispatch section (Part 2, Read B).
    const created = jobCardsDb.create({ ...draft, jobNo, orderJobSeq: seq, ratesAsOf: now, createdAt: now, updatedAt: now });
    // Keep the first card linked for backward compatibility; all cards are found via orderRef.
    ordersDb.update(order.id, { status: 'In Production', jobCardId: order.jobCardId ?? created.id });
    toast.success(`Created ${jobCardLabel(created)}`);
    reload();
    nav(`/job-card/${created.id}`);
  }

  // Open an order: if it already has job cards, show them all; else create JC-1.
  function openOrder(order: Order) {
    const cards = cardsForOrder(order.id);
    if (cards.length === 0) { createNextJobCard(order); return; }
    setCardsModal(order);
  }

  // Build month options from order dates
  const months = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => set.add(o.createdAt.slice(0, 7)));
    return [...set].sort().reverse();
  }, [orders]);

  const filtered = useMemo(() => orders.filter((o) => {
    const ms = !search || (o.brandName ?? '').toLowerCase().includes(search.toLowerCase()) || o.orderId.toLowerCase().includes(search.toLowerCase());
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
            placeholder="Search brand or order ID…" className="input-field pl-9 w-52" />
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
                    <th className="table-header">Brand</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Size</th>
                    <th className="table-header">KG</th>
                    <th className="table-header">Nos</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Dispatch</th>
                    <th className="table-header">Made / Ready</th>
                    <th className="table-header">Bill No.</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody>
                  {monthOrders.map((o) => (
                    <tr key={o.id} className="table-row">
                      <td className="table-cell font-mono text-accent text-xs">{o.orderId}</td>
                      <td className="table-cell font-medium">{o.brandName}</td>
                      <td className="table-cell">
                        <span className="badge text-xs" style={{ background: TYPE_COLORS[o.productType] + '22', color: TYPE_COLORS[o.productType], border: `1px solid ${TYPE_COLORS[o.productType]}44` }}>
                          {o.productType}
                        </span>
                      </td>
                      <td className="table-cell font-mono text-xs text-muted">{o.sizeDisplay}</td>
                      <td className="table-cell font-mono">{o.quantityKg?.toLocaleString('en-IN') ?? '—'}</td>
                      <td className="table-cell font-mono">{o.quantityNos?.toLocaleString('en-IN') ?? '—'}</td>
                      <td className="table-cell">
                        {(() => {
                          // Status/progress derived from the job-card dispatch lines (not the register).
                          const pr = orderProduction(o, allCards);
                          const total = pr.orderPcs || pr.orderKg || 0;
                          const done = pr.orderPcs ? pr.dispatchedPcs : pr.dispatchedKg;
                          const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
                          const st = o.closedAt ? 'Short-Closed' : pct >= 100 ? 'Dispatched' : (done > 0 || pr.madePcs > 0) ? 'In Production' : 'Pending';
                          return <span className={cn('badge border text-xs', STATUS_COLORS[st] ?? 'bg-white/10 text-muted')}>{st}</span>;
                        })()}
                      </td>
                      <td className="table-cell">
                        {(() => {
                          const pr = orderProduction(o, allCards);
                          const total = pr.orderPcs || pr.orderKg || 0;
                          const done = pr.orderPcs ? pr.dispatchedPcs : pr.dispatchedKg;
                          const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
                          return (
                            <div className="min-w-[76px]">
                              <p className="text-[10px] text-muted mb-0.5">{o.closedAt ? 'closed' : `${Math.round(pct)}%`}</p>
                              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={cn('h-full', progressBarClass(pct))} style={{ width: `${pct}%` }} /></div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="table-cell">
                        {(() => {
                          const pr = orderProduction(o, allCards, dispatches);
                          const nCards = allCards.filter((c) => c.orderRef === o.id).length;
                          if (nCards === 0) return <span className="text-muted text-xs">—</span>;
                          return (
                            <div className="text-[11px] leading-tight font-mono">
                              <span className="text-white/80">{pr.madePcs.toLocaleString('en-IN')} made</span>
                              {pr.readyPcs > 0 && <div className="text-amber-300">{pr.readyPcs.toLocaleString('en-IN')} ready to ship</div>}
                              {pr.stillToProducePcs > 0 && <div className="text-muted">{pr.stillToProducePcs.toLocaleString('en-IN')} to produce</div>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="table-cell font-mono text-xs">{o.billNo ?? '—'}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          {cardsForOrder(o.id).length > 0 ? (
                            <button onClick={() => openOrder(o)}
                              className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors" title="Open job cards">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button onClick={() => openOrder(o)}
                              className="p-1.5 rounded hover:bg-primary/20 text-muted hover:text-accent transition-colors" title="Send to Production">
                              <Factory className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setModal({ type: 'edit', order: o })}
                            className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {canEditRates() && !o.closedAt && (
                            <button onClick={() => shortClose(o)} title="Short-close order"
                              className="p-1.5 rounded hover:bg-orange-500/20 text-muted hover:text-orange-400 transition-colors">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Order → job cards list (an order can span multiple cards) */}
      {cardsModal && (
        <Modal open onClose={() => setCardsModal(null)} size="lg"
          title={`${cardsModal.orderId} — Job Cards`}>
          <OrderJobCards order={cardsModal}
            onOpen={(id) => nav(`/job-card/${id}`)}
            onCreateNext={() => createNextJobCard(cardsModal)} />
        </Modal>
      )}
    </div>
  );
}

// ── Order → job cards list + made/dispatched/ready per card ─────────────────────
function OrderJobCards({ order, onOpen, onCreateNext }: {
  order: Order; onOpen: (id: string) => void; onCreateNext: () => void;
}) {
  const allCards = jobCardsDb.getAll();
  const cards: JobCard[] = allCards
    .filter((c) => c.orderRef === order.id)
    .sort((a, b) => (a.orderJobSeq ?? 0) - (b.orderJobSeq ?? 0));
  const pr = orderProduction(order, allCards);

  return (
    <div className="space-y-4">
      <p className="text-muted text-sm">{order.brandName} · {order.sizeDisplay} · target {order.quantityNos?.toLocaleString('en-IN') ?? '—'} nos</p>

      {/* Order-level rollup: dispatched / ready-to-ship / still-to-produce */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-navy/40 rounded-lg p-2.5"><p className="text-muted text-[11px]">Dispatched</p><p className="font-mono text-white">{pr.dispatchedPcs.toLocaleString('en-IN')}</p></div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5"><p className="text-amber-300/80 text-[11px]">Ready to dispatch</p><p className="font-mono text-amber-300">{pr.readyPcs.toLocaleString('en-IN')}</p></div>
        <div className="bg-navy/40 rounded-lg p-2.5"><p className="text-muted text-[11px]">Still to produce</p><p className="font-mono text-white">{pr.stillToProducePcs.toLocaleString('en-IN')}</p></div>
      </div>
      {pr.readyPcs > 0 && (
        <p className="text-amber-300/90 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          {pr.readyPcs.toLocaleString('en-IN')} bags produced, pending dispatch — a later dispatch draws these down first.
        </p>
      )}

      <div className="space-y-2">
        {cards.map((c) => {
          const b = cardReadyToDispatch(c, allCards);
          const made = { pieces: b.madePcs };
          const disp = b.dispatchedPcs;
          const ready = b.readyPcs;
          return (
            <button key={c.id} onClick={() => onOpen(c.id)}
              className="w-full text-left glass-card px-4 py-3 hover:border-accent/40 border border-white/10 transition-colors flex items-center justify-between gap-3">
              <div>
                <p className="text-white font-medium font-mono">{jobCardLabel(c)}</p>
                <p className="text-muted text-xs">{c.status} · {c.cardType}{c.makingType ? ` (${c.makingType})` : ''}</p>
              </div>
              <div className="text-right text-xs font-mono">
                <p className="text-white/80">Made {made.pieces.toLocaleString('en-IN')} · Disp {disp.toLocaleString('en-IN')}</p>
                {ready > 0 && <p className="text-amber-300">Ready {ready.toLocaleString('en-IN')}</p>}
              </div>
            </button>
          );
        })}
      </div>

      <button onClick={onCreateNext} className="btn-primary w-full justify-center">
        <Plus className="w-4 h-4" /> Create next job card ({order.orderId} / JC-{nextOrderJobSeq(cards)})
      </button>
    </div>
  );
}
