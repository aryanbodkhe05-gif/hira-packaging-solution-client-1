import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Phone, Search, Clock, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { differenceInDays, format, parseISO } from 'date-fns';
import { leadsDb, ordersDb, getSettings } from '../lib/db';
import { LEAD_SOURCES, LEAD_STATUSES } from '../config';
import type { Lead } from '../types/models';
import type { LeadSource, LeadStatus } from '../config';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/utils';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<LeadStatus, string> = {
  'New':           'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Contacted':     'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Interested':    'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Proposal Sent': 'bg-accent/20 text-accent border-accent/30',
  'Won':           'bg-success/20 text-success border-success/30',
  'Lost':          'bg-red-500/20 text-red-400 border-red-500/30',
};
const PIPELINE = LEAD_STATUSES.filter((s) => s !== 'Won' && s !== 'Lost');

// ── WhatsApp helper ───────────────────────────────────────────────────────────
function openWhatsApp(phone: string, message: string) {
  const clean = phone.replace(/\D/g, '');
  const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ leads }: { leads: Lead[] }) {
  const settings = getSettings();
  const threshold = parseInt(settings.followup_days ?? '3', 10);
  const now = new Date();

  const newLeads     = leads.filter((l) => l.status === 'New').length;
  const followupDue  = leads.filter((l) => {
    if (l.status === 'Won' || l.status === 'Lost') return false;
    const last = l.lastContactedAt ? parseISO(l.lastContactedAt) : parseISO(l.createdAt);
    return differenceInDays(now, last) >= threshold;
  }).length;
  const wonThisMonth = leads.filter((l) => {
    if (l.status !== 'Won') return false;
    const m = l.updatedAt?.slice(0, 7) ?? l.createdAt.slice(0, 7);
    return m === now.toISOString().slice(0, 7);
  }).length;

  const items = [
    { label: 'New Leads',      value: newLeads,    color: 'text-blue-400' },
    { label: 'Follow-up Due',  value: followupDue, color: 'text-orange-400' },
    { label: 'Won This Month', value: wonThisMonth,color: 'text-success' },
  ];

  return (
    <div className="glass-card p-5 flex items-center gap-8 flex-wrap">
      {items.map(({ label, value, color }) => (
        <div key={label}>
          <p className="text-muted text-xs">{label}</p>
          <p className={cn('text-3xl font-bold font-mono mt-0.5', color)}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Lead form ─────────────────────────────────────────────────────────────────
const emptyLead: Omit<Lead, 'id'> = {
  companyName: '', contactPerson: '', phone: '', email: '',
  source: 'Cold Call', productInterest: '', estimatedOrderSize: undefined,
  status: 'New', notes: '', lastContactedAt: undefined,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

function LeadForm({ initial, onSave, onClose }: {
  initial: Omit<Lead, 'id'>;
  onSave: (d: Omit<Lead, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    if (!f.companyName.trim() || !f.phone.trim()) { toast.error('Company & phone required'); return; }
    onSave({ ...f, updatedAt: new Date().toISOString() });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Company Name *</label>
          <input className="input-field" value={f.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Gujarat Polymers Ltd" autoFocus />
        </div>
        <div>
          <label className="label">Contact Person</label>
          <input className="input-field" value={f.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} placeholder="Ramesh Patel" />
        </div>
        <div>
          <label className="label">Phone *</label>
          <input className="input-field font-mono" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91XXXXXXXXXX" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input-field" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="contact@company.com" />
        </div>
        <div>
          <label className="label">Source</label>
          <select className="input-field" value={f.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
            {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Product Interest</label>
          <input className="input-field" value={f.productInterest} onChange={(e) => set('productInterest', e.target.value)} placeholder="BOPP rolls, Laminated..." />
        </div>
        <div>
          <label className="label">Est. Order Size (₹)</label>
          <input className="input-field font-mono" type="number" value={f.estimatedOrderSize ?? ''} onChange={(e) => set('estimatedOrderSize', parseFloat(e.target.value) || undefined)} placeholder="500000" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input-field" value={f.status} onChange={(e) => set('status', e.target.value as LeadStatus)}>
            {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Last Contacted</label>
          <input className="input-field" type="date"
            value={f.lastContactedAt ? f.lastContactedAt.slice(0, 10) : ''}
            onChange={(e) => set('lastContactedAt', e.target.value ? e.target.value + 'T09:00:00Z' : undefined)} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input-field resize-none" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Last conversation, action items..." />
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Lead</button>
      </div>
    </div>
  );
}

// ── Won history modal ─────────────────────────────────────────────────────────
function WonHistoryModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const orders = ordersDb.getAll().filter((o) =>
    o.clientName.toLowerCase() === lead.companyName.toLowerCase()
  );
  const total = orders.reduce((s, o) => s + (o.quantityKg ?? 0) * 150, 0); // est. ₹150/kg

  return (
    <Modal open onClose={onClose} title={`Order History — ${lead.companyName}`} size="lg">
      <div className="space-y-4">
        {orders.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">No order history found</p>
        ) : (
          <>
            <div className="flex gap-6 text-sm">
              <div><p className="text-muted text-xs">Total Orders</p><p className="font-mono font-bold text-white">{orders.length}</p></div>
              <div><p className="text-muted text-xs">Est. Revenue</p><p className="font-mono font-bold text-success">₹{total.toLocaleString('en-IN')}</p></div>
              <div><p className="text-muted text-xs">Last Order</p><p className="font-mono text-white">{orders[0]?.createdAt.slice(0, 10)}</p></div>
            </div>
            <table className="w-full">
              <thead><tr className="border-b border-white/5">
                <th className="table-header">Order ID</th>
                <th className="table-header">Product</th>
                <th className="table-header">Size</th>
                <th className="table-header">KG</th>
                <th className="table-header">Status</th>
              </tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="table-row">
                    <td className="table-cell font-mono text-accent text-xs">{o.orderId}</td>
                    <td className="table-cell">{o.productType}</td>
                    <td className="table-cell font-mono text-xs text-muted">{o.sizeDisplay}</td>
                    <td className="table-cell font-mono">{o.quantityKg?.toLocaleString('en-IN')}</td>
                    <td className="table-cell"><span className="badge bg-success/20 text-success border border-success/30 text-xs">{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function CRMPage() {
  const [leads, setLeads]     = useState<Lead[]>(() => leadsDb.getAll());
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [modal, setModal]     = useState<{ type: 'add' | 'edit' | 'won'; lead?: Lead } | null>(null);

  const reload = useCallback(() => setLeads(leadsDb.getAll()), []);
  const settings = getSettings();
  const threshold = parseInt(settings.followup_days ?? '3', 10);

  const followupDue = useMemo(() => {
    const now = new Date();
    return leads.filter((l) => {
      if (l.status === 'Won' || l.status === 'Lost') return false;
      const last = l.lastContactedAt ? parseISO(l.lastContactedAt) : parseISO(l.createdAt);
      return differenceInDays(now, last) >= threshold;
    });
  }, [leads, threshold]);

  const filtered = useMemo(() => leads.filter((l) => {
    const ms = !search || l.companyName.toLowerCase().includes(search.toLowerCase()) || l.contactPerson.toLowerCase().includes(search.toLowerCase());
    const mst = !statusFilter || l.status === statusFilter;
    return ms && mst;
  }), [leads, search, statusFilter]);

  function handleSave(data: Omit<Lead, 'id'>) {
    if (modal?.type === 'edit' && modal.lead) {
      leadsDb.update(modal.lead.id, data);
      toast.success('Lead updated');
    } else {
      leadsDb.create(data);
      toast.success('Lead added');
    }
    reload();
    setModal(null);
  }

  function handleDelete(id: string) {
    leadsDb.delete(id);
    toast.success('Lead deleted');
    reload();
  }

  function sendFollowUpWhatsApp(lead: Lead) {
    const ownerNumber = settings.owner_whatsapp ?? '';
    if (!ownerNumber) { toast.error('Set owner WhatsApp in Settings first'); return; }
    const days = differenceInDays(new Date(), lead.lastContactedAt ? parseISO(lead.lastContactedAt) : parseISO(lead.createdAt));
    const msg = `📋 FOLLOW-UP REMINDER: ${lead.companyName} hasn't been contacted in ${days} days.\nLast action: ${lead.notes || 'No notes'}.\nContact: ${lead.phone}`;
    openWhatsApp(ownerNumber, msg);
    toast.success('Opening WhatsApp…');
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-header">Sales CRM</h1>
          <p className="text-muted text-sm mt-1">Lead pipeline, follow-up reminders, won client history</p>
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      <SummaryCard leads={leads} />

      {/* Follow-up reminders banner */}
      {followupDue.length > 0 && (
        <div className="glass-card border border-orange-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-orange-400" />
            <p className="text-orange-300 font-semibold text-sm">{followupDue.length} leads need follow-up</p>
          </div>
          <div className="space-y-2">
            {followupDue.map((l) => {
              const days = differenceInDays(new Date(), l.lastContactedAt ? parseISO(l.lastContactedAt) : parseISO(l.createdAt));
              return (
                <div key={l.id} className="flex items-center justify-between bg-orange-500/5 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-white font-medium text-sm">{l.companyName}</span>
                    <span className="text-muted text-xs ml-2">· {l.contactPerson} · {l.phone}</span>
                    <span className="text-orange-400 text-xs ml-2">· {days}d ago</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => sendFollowUpWhatsApp(l)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-success/10 hover:bg-success/20 text-success text-xs transition-colors">
                      📱 WhatsApp
                    </button>
                    <button onClick={() => setModal({ type: 'edit', lead: l })}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-accent/10 hover:bg-accent/20 text-accent text-xs transition-colors">
                      Update
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pipeline summary */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PIPELINE.map((s) => {
          const count = leads.filter((l) => l.status === s).length;
          return (
            <div key={s} className={cn('glass-card px-4 py-3 flex-shrink-0 text-center min-w-28 border', STATUS_COLORS[s])}>
              <p className="text-lg font-bold font-mono">{count}</p>
              <p className="text-xs mt-0.5 opacity-80">{s}</p>
            </div>
          );
        })}
        <div className="glass-card px-4 py-3 flex-shrink-0 text-center min-w-28 border border-success/30">
          <p className="text-lg font-bold font-mono text-success">{leads.filter((l) => l.status === 'Won').length}</p>
          <p className="text-xs mt-0.5 text-success/70">Won</p>
        </div>
        <div className="glass-card px-4 py-3 flex-shrink-0 text-center min-w-28 border border-red-500/20">
          <p className="text-lg font-bold font-mono text-red-400">{leads.filter((l) => l.status === 'Lost').length}</p>
          <p className="text-xs mt-0.5 text-red-400/70">Lost</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or contact…" className="input-field pl-9 w-52" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatus | '')} className="input-field w-40">
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Leads table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              <th className="table-header">Company</th>
              <th className="table-header">Contact</th>
              <th className="table-header">Source</th>
              <th className="table-header">Interest</th>
              <th className="table-header">Est. Size</th>
              <th className="table-header">Status</th>
              <th className="table-header">Last Contact</th>
              <th className="table-header"></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState icon={TrendingUp} title="No leads found"
                    action={{ label: 'Add First Lead', onClick: () => setModal({ type: 'add' }) }} />
                </td></tr>
              ) : filtered.map((l) => {
                const days = l.lastContactedAt
                  ? differenceInDays(new Date(), parseISO(l.lastContactedAt))
                  : differenceInDays(new Date(), parseISO(l.createdAt));
                const overdue = days >= threshold && l.status !== 'Won' && l.status !== 'Lost';

                return (
                  <tr key={l.id} className={cn('table-row', overdue && 'bg-orange-500/5')}>
                    <td className="table-cell">
                      <p className="font-medium text-white">{l.companyName}</p>
                      <p className="text-muted text-xs">{l.phone}</p>
                    </td>
                    <td className="table-cell text-white/70">{l.contactPerson}</td>
                    <td className="table-cell">
                      <span className="badge bg-white/10 text-white/60 border border-white/10 text-xs">{l.source}</span>
                    </td>
                    <td className="table-cell text-muted text-xs">{l.productInterest || '—'}</td>
                    <td className="table-cell font-mono text-xs">
                      {l.estimatedOrderSize ? `₹${(l.estimatedOrderSize / 100000).toFixed(1)}L` : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={cn('badge border text-xs', STATUS_COLORS[l.status])}>{l.status}</span>
                    </td>
                    <td className="table-cell font-mono text-xs">
                      <span className={cn(overdue ? 'text-orange-400' : 'text-muted')}>
                        {l.lastContactedAt ? `${days}d ago` : 'Never'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        {l.status === 'Won' && (
                          <button onClick={() => setModal({ type: 'won', lead: l })}
                            className="p-1.5 rounded hover:bg-success/20 text-muted hover:text-success transition-colors" title="Order history">
                            <TrendingUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => openWhatsApp(l.phone, `Namaste ${l.contactPerson}, this is Tushar from Nico Flex Pvt Ltd. Following up regarding ${l.productInterest ?? 'your packaging requirements'}.`)}
                          className="p-1.5 rounded hover:bg-success/20 text-muted hover:text-success transition-colors" title="WhatsApp">
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setModal({ type: 'edit', lead: l })}
                          className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { handleDelete(l.id); }}
                          className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-accent/10 text-muted text-xs">{filtered.length} leads</div>
      </div>

      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <Modal open onClose={() => setModal(null)}
          title={modal.type === 'add' ? 'Add Lead' : 'Edit Lead'} size="md">
          <LeadForm
            initial={modal.lead ?? { ...emptyLead, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'won' && modal.lead && (
        <WonHistoryModal lead={modal.lead} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
