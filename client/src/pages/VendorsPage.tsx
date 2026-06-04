import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Building2, Search, Star, Package } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import { vendorsDb, purchaseOrdersDb, getSettings } from '../lib/db';
import { PO_STATUSES } from '../config';
import type { Vendor, PurchaseOrder } from '../types/models';
import type { POStatus } from '../config';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/utils';

// ── PO status colors ──────────────────────────────────────────────────────────
const PO_COLORS: Record<POStatus, string> = {
  'Draft':     'bg-white/10 text-white/60 border-white/10',
  'Sent':      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Confirmed': 'bg-accent/20 text-accent border-accent/30',
  'Delivered': 'bg-success/20 text-success border-success/30',
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} className={cn('w-3 h-3', i <= Math.round(value) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20')} />
      ))}
      <span className="text-xs text-muted ml-1">{value.toFixed(1)}</span>
    </div>
  );
}

// ── Vendor form ───────────────────────────────────────────────────────────────
const emptyVendor: Omit<Vendor, 'id'> = {
  name: '', contactName: '', phone: '', email: '', materialSupplied: '',
  rating: 4, paymentTerms: 'Net 30', pricePerUnit: undefined, unit: 'kg',
  leadTimeDays: 7, reliability: 4, createdAt: new Date().toISOString(),
};

function VendorForm({ initial, onSave, onClose }: {
  initial: Omit<Vendor, 'id'>;
  onSave: (d: Omit<Vendor, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    if (!f.name.trim() || !f.phone.trim()) { toast.error('Name & phone required'); return; }
    onSave(f);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Vendor Name *</label>
          <input className="input-field" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Jindal Poly Films Ltd" autoFocus />
        </div>
        <div>
          <label className="label">Contact Name</label>
          <input className="input-field" value={f.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Ravi Jindal" />
        </div>
        <div>
          <label className="label">Phone *</label>
          <input className="input-field font-mono" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91XXXXXXXXXX" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input-field" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="contact@vendor.com" />
        </div>
        <div>
          <label className="label">Material Supplied</label>
          <input className="input-field" value={f.materialSupplied} onChange={(e) => set('materialSupplied', e.target.value)} placeholder="BOPP Film, Ink..." />
        </div>
        <div>
          <label className="label">Payment Terms</label>
          <input className="input-field" value={f.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} placeholder="Net 30" />
        </div>
        <div>
          <label className="label">Price / Unit</label>
          <input className="input-field font-mono" type="number" value={f.pricePerUnit ?? ''} onChange={(e) => set('pricePerUnit', parseFloat(e.target.value) || undefined)} placeholder="145" />
        </div>
        <div>
          <label className="label">Unit</label>
          <input className="input-field" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="kg / litre / roll" />
        </div>
        <div>
          <label className="label">Lead Time (days)</label>
          <input className="input-field font-mono" type="number" value={f.leadTimeDays ?? ''} onChange={(e) => set('leadTimeDays', parseInt(e.target.value) || undefined)} placeholder="7" />
        </div>
        <div>
          <label className="label">Reliability (1–5)</label>
          <input className="input-field font-mono" type="number" min="1" max="5" step="0.1" value={f.reliability ?? ''} onChange={(e) => set('reliability', parseFloat(e.target.value) || undefined)} placeholder="4.5" />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Vendor</button>
      </div>
    </div>
  );
}

// ── PO form ───────────────────────────────────────────────────────────────────
function POForm({ vendors, onSave, onClose }: {
  vendors: Vendor[];
  onSave: (d: Omit<PurchaseOrder, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    vendorId: vendors[0]?.id ?? '', material: '', quantity: 0, unit: 'kg',
    pricePerUnit: 0, expectedDelivery: '', notes: '',
    status: 'Draft' as POStatus,
  });

  const vendor = vendors.find((v) => v.id === f.vendorId);

  function submit() {
    if (!f.material.trim() || !f.quantity || !f.expectedDelivery) { toast.error('Fill required fields'); return; }
    const now = new Date();
    const ymd = format(now, 'yyyyMMdd');
    const seq  = purchaseOrdersDb.getAll().length + 1;
    onSave({
      poNumber: `PO-${ymd}-${String(seq).padStart(4, '0')}`,
      vendorId: f.vendorId,
      vendorName: vendor?.name ?? '',
      material: f.material,
      quantity: f.quantity,
      unit: f.unit,
      pricePerUnit: f.pricePerUnit || undefined,
      totalAmount: f.pricePerUnit ? f.quantity * f.pricePerUnit : undefined,
      expectedDelivery: f.expectedDelivery,
      status: f.status,
      notes: f.notes,
      createdAt: now.toISOString(),
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Vendor</label>
          <select className="input-field" value={f.vendorId} onChange={(e) => setF((p) => ({ ...p, vendorId: e.target.value }))}>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Material *</label>
          <input className="input-field" value={f.material} onChange={(e) => setF((p) => ({ ...p, material: e.target.value }))} placeholder="BOPP Film" autoFocus />
        </div>
        <div>
          <label className="label">Quantity *</label>
          <input className="input-field font-mono" type="number" value={f.quantity || ''} onChange={(e) => setF((p) => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))} placeholder="2000" />
        </div>
        <div>
          <label className="label">Unit</label>
          <input className="input-field" value={f.unit} onChange={(e) => setF((p) => ({ ...p, unit: e.target.value }))} placeholder="kg" />
        </div>
        <div>
          <label className="label">Price / Unit (₹)</label>
          <input className="input-field font-mono" type="number" value={f.pricePerUnit || ''} onChange={(e) => setF((p) => ({ ...p, pricePerUnit: parseFloat(e.target.value) || 0 }))} placeholder="145" />
        </div>
        <div>
          <label className="label">Expected Delivery *</label>
          <input className="input-field" type="date" value={f.expectedDelivery} onChange={(e) => setF((p) => ({ ...p, expectedDelivery: e.target.value }))} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input-field" value={f.status} onChange={(e) => setF((p) => ({ ...p, status: e.target.value as POStatus }))}>
            {PO_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input-field" value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
      </div>
      {f.quantity > 0 && f.pricePerUnit > 0 && (
        <div className="p-3 bg-accent/5 rounded-lg text-sm">
          <span className="text-muted">Total: </span>
          <span className="font-mono font-bold text-accent">₹{(f.quantity * f.pricePerUnit).toLocaleString('en-IN')}</span>
        </div>
      )}
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Create PO</button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function VendorsPage() {
  const [vendors, setVendors]   = useState<Vendor[]>(() => vendorsDb.getAll());
  const [pos, setPOs]           = useState<PurchaseOrder[]>(() => purchaseOrdersDb.getAll());
  const [tab, setTab]           = useState<'vendors' | 'pos' | 'compare'>('vendors');
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState<{ type: 'addV' | 'editV' | 'addPO'; vendor?: Vendor } | null>(null);

  const reload = useCallback(() => {
    setVendors(vendorsDb.getAll());
    setPOs(purchaseOrdersDb.getAll());
  }, []);

  function handleSaveVendor(data: Omit<Vendor, 'id'>) {
    if (modal?.type === 'editV' && modal.vendor) {
      vendorsDb.update(modal.vendor.id, data);
      toast.success('Vendor updated');
    } else {
      vendorsDb.create(data);
      toast.success('Vendor added');
    }
    reload(); setModal(null);
  }

  function handleSavePO(data: Omit<PurchaseOrder, 'id'>) {
    purchaseOrdersDb.create(data);
    toast.success('Purchase order created');
    reload(); setModal(null);
  }

  function updatePOStatus(id: string, status: POStatus) {
    const patch: Partial<PurchaseOrder> = { status };
    if (status === 'Delivered') patch.deliveredAt = new Date().toISOString();
    purchaseOrdersDb.update(id, patch);
    reload();
    toast.success('PO updated');
  }

  // Delay alerts
  const delayedPOs = pos.filter((po) =>
    po.status !== 'Delivered' && isPast(parseISO(po.expectedDelivery))
  );

  const filteredVendors = vendors.filter((v) =>
    !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.materialSupplied.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Vendors & Purchase</h1>
          <p className="text-muted text-sm mt-1">Vendor database, purchase orders, supplier comparison</p>
        </div>
        <div className="flex gap-2">
          {tab === 'vendors' && (
            <button onClick={() => setModal({ type: 'addV' })} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
          )}
          {tab === 'pos' && (
            <button onClick={() => setModal({ type: 'addPO' })} className="btn-primary">
              <Plus className="w-4 h-4" /> New PO
            </button>
          )}
        </div>
      </div>

      {/* PO delay alert */}
      {delayedPOs.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <Package className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm mb-1">⚠️ {delayedPOs.length} PO(s) past expected delivery</p>
            {delayedPOs.map((po) => {
              const settings = getSettings();
              const msg = `📦 PO ${po.poNumber} from ${po.vendorName} was expected on ${po.expectedDelivery} but not confirmed.\nMaterial: ${po.material}.\nContact vendor urgently.`;
              return (
                <div key={po.id} className="flex items-center gap-3 text-sm">
                  <span className="text-white/70">{po.poNumber} · {po.vendorName} · {po.material}</span>
                  <button onClick={() => { const p = vendors.find((v) => v.id === po.vendorId); if (p?.phone) { const clean = p.phone.replace(/\D/g, ''); window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank'); } else toast.error('No vendor phone'); }}
                    className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs transition-colors">
                    📱 Alert Vendor
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10 w-fit">
        {(['vendors', 'pos', 'compare'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-primary text-white' : 'text-muted hover:text-white')}>
            {t === 'vendors' ? `🏭 Vendors (${vendors.length})` : t === 'pos' ? `📋 Purchase Orders (${pos.length})` : '📊 Compare'}
          </button>
        ))}
      </div>

      {/* Vendors tab */}
      {tab === 'vendors' && (
        <div className="space-y-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendors…" className="input-field pl-9" />
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/5">
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Material</th>
                  <th className="table-header">Price/Unit</th>
                  <th className="table-header">Lead Time</th>
                  <th className="table-header">Rating</th>
                  <th className="table-header">Terms</th>
                  <th className="table-header"></th>
                </tr></thead>
                <tbody>
                  {filteredVendors.length === 0 ? (
                    <tr><td colSpan={7}><EmptyState icon={Building2} title="No vendors" action={{ label: 'Add Vendor', onClick: () => setModal({ type: 'addV' }) }} /></td></tr>
                  ) : filteredVendors.map((v) => (
                    <tr key={v.id} className="table-row">
                      <td className="table-cell">
                        <p className="font-medium text-white">{v.name}</p>
                        <p className="text-muted text-xs">{v.contactName} · {v.phone}</p>
                      </td>
                      <td className="table-cell text-white/70">{v.materialSupplied}</td>
                      <td className="table-cell font-mono">{v.pricePerUnit ? `₹${v.pricePerUnit}/${v.unit}` : '—'}</td>
                      <td className="table-cell font-mono text-muted">{v.leadTimeDays ? `${v.leadTimeDays} days` : '—'}</td>
                      <td className="table-cell"><StarRating value={v.rating} /></td>
                      <td className="table-cell text-muted text-xs">{v.paymentTerms}</td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          <button onClick={() => setModal({ type: 'editV', vendor: v })}
                            className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { vendorsDb.delete(v.id); reload(); toast.success('Vendor deleted'); }}
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
        </div>
      )}

      {/* POs tab */}
      {tab === 'pos' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/5">
                <th className="table-header">PO No.</th>
                <th className="table-header">Vendor</th>
                <th className="table-header">Material</th>
                <th className="table-header">Qty</th>
                <th className="table-header">Total</th>
                <th className="table-header">Expected</th>
                <th className="table-header">Status</th>
                <th className="table-header"></th>
              </tr></thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon={Package} title="No purchase orders" action={{ label: 'Create PO', onClick: () => setModal({ type: 'addPO' }) }} /></td></tr>
                ) : pos.map((po) => {
                  const isLate = po.status !== 'Delivered' && isPast(parseISO(po.expectedDelivery));
                  return (
                    <tr key={po.id} className={cn('table-row', isLate && 'bg-red-500/5')}>
                      <td className="table-cell font-mono text-accent text-xs">{po.poNumber}</td>
                      <td className="table-cell font-medium">{po.vendorName}</td>
                      <td className="table-cell text-white/70">{po.material}</td>
                      <td className="table-cell font-mono">{po.quantity.toLocaleString('en-IN')} {po.unit}</td>
                      <td className="table-cell font-mono">{po.totalAmount ? `₹${po.totalAmount.toLocaleString('en-IN')}` : '—'}</td>
                      <td className={cn('table-cell font-mono text-xs', isLate ? 'text-red-400' : 'text-muted')}>
                        {po.expectedDelivery}
                      </td>
                      <td className="table-cell">
                        <span className={cn('badge border text-xs', PO_COLORS[po.status])}>{po.status}</span>
                      </td>
                      <td className="table-cell">
                        {po.status !== 'Delivered' && (
                          <select
                            value={po.status}
                            onChange={(e) => updatePOStatus(po.id, e.target.value as POStatus)}
                            className="bg-white/5 border border-white/10 text-white text-xs rounded px-2 py-1 focus:outline-none">
                            {PO_STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compare tab */}
      {tab === 'compare' && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-accent/10"><p className="section-title">Supplier Comparison</p></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/5">
                <th className="table-header">Vendor</th>
                <th className="table-header">Material</th>
                <th className="table-header">Price / Unit</th>
                <th className="table-header">Lead Time</th>
                <th className="table-header">Reliability</th>
                <th className="table-header">Rating</th>
                <th className="table-header">Terms</th>
              </tr></thead>
              <tbody>
                {vendors.sort((a, b) => b.rating - a.rating).map((v) => (
                  <tr key={v.id} className="table-row">
                    <td className="table-cell font-medium">{v.name}</td>
                    <td className="table-cell text-muted">{v.materialSupplied}</td>
                    <td className="table-cell font-mono text-accent">{v.pricePerUnit ? `₹${v.pricePerUnit}/${v.unit}` : '—'}</td>
                    <td className="table-cell font-mono">{v.leadTimeDays ? `${v.leadTimeDays}d` : '—'}</td>
                    <td className="table-cell"><StarRating value={v.reliability ?? 3} /></td>
                    <td className="table-cell"><StarRating value={v.rating} /></td>
                    <td className="table-cell text-muted text-xs">{v.paymentTerms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {(modal?.type === 'addV' || modal?.type === 'editV') && (
        <Modal open onClose={() => setModal(null)}
          title={modal.type === 'addV' ? 'Add Vendor' : 'Edit Vendor'} size="md">
          <VendorForm
            initial={modal.vendor ?? { ...emptyVendor, createdAt: new Date().toISOString() }}
            onSave={handleSaveVendor}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'addPO' && (
        <Modal open onClose={() => setModal(null)} title="Create Purchase Order" size="md">
          <POForm vendors={vendors} onSave={handleSavePO} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
