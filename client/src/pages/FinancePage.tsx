import { useState, useMemo, useCallback } from 'react';
import { DollarSign, Download, Printer, Search, RefreshCw, TrendingUp } from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { invoicesDb, ordersDb, getSettings } from '../lib/db';
import { GST_RATE, COMPANY } from '../config';
import type { Invoice } from '../types/models';
import { cn, formatCurrency } from '../lib/utils';
import { EmptyState } from '../components/ui/EmptyState';

// ── Aging color ───────────────────────────────────────────────────────────────
function agingClass(daysOverdue: number) {
  if (daysOverdue <= 0)  return 'text-success';
  if (daysOverdue <= 30) return 'text-yellow-400';
  if (daysOverdue <= 60) return 'text-orange-400';
  return 'text-red-400';
}
function agingBadge(daysOverdue: number) {
  if (daysOverdue <= 0)  return 'bg-success/20 text-success border-success/30';
  if (daysOverdue <= 30) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (daysOverdue <= 60) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

// ── WhatsApp payment reminder ─────────────────────────────────────────────────
function openWhatsApp(phone: string, message: string) {
  const clean = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`, '_blank');
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(invoices: Invoice[]) {
  const header = ['Invoice No.', 'Client', 'Product', 'Subtotal', 'GST', 'Total', 'Due Date', 'Status', 'Days Overdue'];
  const rows = invoices.map((inv) => {
    const daysOverdue = differenceInDays(new Date(), parseISO(inv.dueDate));
    return [
      inv.invoiceNumber, inv.clientName, inv.productType,
      inv.subtotal, inv.gstAmount, inv.totalAmount,
      inv.dueDate, inv.status,
      inv.status === 'Paid' ? '—' : Math.max(0, daysOverdue),
    ];
  });
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `nicoflex_invoices_${format(new Date(), 'yyyyMMdd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV downloaded');
}

// ── Invoice print ─────────────────────────────────────────────────────────────
function printInvoice(inv: Invoice) {
  const html = `
    <!DOCTYPE html><html><head>
    <title>${inv.invoiceNumber}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a2e; font-size: 13px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #3131B5; padding-bottom: 20px; margin-bottom: 24px; }
      .company-name { font-size: 22px; font-weight: 800; color: #3131B5; }
      .invoice-title { font-size: 28px; font-weight: 700; color: #3131B5; text-align: right; }
      .invoice-no { font-size: 14px; color: #555; text-align: right; }
      .section { margin-bottom: 20px; }
      .section-title { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f0f0f8; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; }
      td { padding: 10px 12px; border-bottom: 1px solid #eee; }
      .total-table td { font-size: 14px; }
      .grand-total { font-size: 18px; font-weight: 800; color: #3131B5; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 11px; }
    </style></head><body>
    <div class="header">
      <div>
        <div class="company-name">${COMPANY.name}</div>
        <div style="color:#555;margin-top:6px;line-height:1.6">
          ${COMPANY.address}<br>GST: ${COMPANY.gst}<br>${COMPANY.phone} · ${COMPANY.email}
        </div>
      </div>
      <div>
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-no">${inv.invoiceNumber}</div>
        <div class="invoice-no" style="margin-top:4px">Date: ${format(parseISO(inv.createdAt), 'dd MMM yyyy')}</div>
        <div class="invoice-no">Due: ${format(parseISO(inv.dueDate), 'dd MMM yyyy')}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Bill To</div>
      <div style="font-weight:700;font-size:15px">${inv.clientName}</div>
    </div>
    <div class="section">
      <table>
        <thead><tr><th>Description</th><th>Product</th><th>Size</th><th>Qty (KG)</th><th style="text-align:right">Amount (₹)</th></tr></thead>
        <tbody>
          <tr>
            <td>Flexible Packaging Supply</td>
            <td>${inv.productType}</td>
            <td>${inv.sizeDisplay}</td>
            <td>${inv.quantityKg?.toLocaleString('en-IN') ?? '—'}</td>
            <td style="text-align:right">₹${inv.subtotal.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:flex-end">
      <table class="total-table" style="width:280px">
        <tr><td>Subtotal</td><td style="text-align:right">₹${inv.subtotal.toLocaleString('en-IN')}</td></tr>
        <tr><td>GST @ ${inv.gstRate}%</td><td style="text-align:right">₹${inv.gstAmount.toLocaleString('en-IN')}</td></tr>
        <tr><td class="grand-total">Total</td><td class="grand-total" style="text-align:right">₹${inv.totalAmount.toLocaleString('en-IN')}</td></tr>
      </table>
    </div>
    <div class="footer">Thank you for your business! · Payment due within 30 days · ${COMPANY.name}</div>
    </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { toast.error('Pop-ups blocked — allow pop-ups to print'); return; }
  win.document.write(html);
  win.document.close();
  win.print();
}

// ── Auto-generate invoice from dispatched order ──────────────────────────────
function generateInvoiceFromOrder(orderId: string): boolean {
  const orders = ordersDb.getAll();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return false;
  // check not already invoiced
  const existing = invoicesDb.getAll().find((i) => i.orderId === orderId);
  if (existing) return false;

  const subtotal = Math.round((order.quantityKg ?? 0) * 150); // ₹150/kg est.
  const gstAmt   = Math.round(subtotal * GST_RATE / 100);
  const now = new Date();
  const ymd = format(now, 'yyyyMMdd');
  const seq = invoicesDb.getAll().length + 1;

  invoicesDb.create({
    invoiceNumber: `INV-${ymd}-${String(seq).padStart(4, '0')}`,
    orderId,
    clientName:   order.clientName,
    orderDetails: order.orderId,
    sizeDisplay:  order.sizeDisplay,
    productType:  order.productType,
    quantityKg:   order.quantityKg,
    subtotal,
    gstRate:      GST_RATE,
    gstAmount:    gstAmt,
    totalAmount:  subtotal + gstAmt,
    dueDate:      format(new Date(now.getTime() + 30 * 86400000), 'yyyy-MM-dd'),
    status:       'Sent',
    createdAt:    now.toISOString(),
  });
  return true;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function FinancePage() {
  const [invoices, setInvoices] = useState<Invoice[]>(() => invoicesDb.getAll());
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tab, setTab] = useState<'outstanding' | 'all' | 'pl'>('outstanding');

  const reload = useCallback(() => setInvoices(invoicesDb.getAll()), []);

  // Auto-generate invoices for any dispatched orders without one
  const syncInvoices = useCallback(() => {
    const dispatched = ordersDb.getAll().filter((o) => o.status === 'Dispatched');
    let count = 0;
    dispatched.forEach((o) => { if (generateInvoiceFromOrder(o.id)) count++; });
    reload();
    if (count > 0) toast.success(`Generated ${count} new invoice${count > 1 ? 's' : ''}`);
    else toast('All dispatched orders are invoiced', { icon: '✅' });
  }, [reload]);

  const filtered = useMemo(() => invoices.filter((inv) => {
    const ms = !search || inv.clientName.toLowerCase().includes(search.toLowerCase()) || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const mst = !statusFilter || inv.status === statusFilter;
    return ms && mst;
  }), [invoices, search, statusFilter]);

  const outstanding = filtered.filter((inv) => inv.status !== 'Paid');
  const paid        = filtered.filter((inv) => inv.status === 'Paid');

  // P&L
  const totalInvoiced    = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalReceived    = invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + (i.paidAmount ?? i.totalAmount), 0);
  const totalOutstanding = totalInvoiced - totalReceived;

  // Monthly P&L
  const monthlyPL = useMemo(() => {
    const map: Record<string, { month: string; invoiced: number; received: number }> = {};
    invoices.forEach((inv) => {
      const m = inv.createdAt.slice(0, 7);
      if (!map[m]) map[m] = { month: format(parseISO(m + '-01'), 'MMM yy'), invoiced: 0, received: 0 };
      map[m].invoiced  += inv.totalAmount;
      if (inv.status === 'Paid') map[m].received += (inv.paidAmount ?? inv.totalAmount);
    });
    return Object.values(map).slice(-6);
  }, [invoices]);

  function markPaid(inv: Invoice) {
    invoicesDb.update(inv.id, { status: 'Paid', paidAt: new Date().toISOString(), paidAmount: inv.totalAmount });
    reload();
    toast.success(`Invoice ${inv.invoiceNumber} marked as paid`);
  }

  function sendPaymentReminder(inv: Invoice, days: number) {
    const settings = getSettings();
    const phone = settings.owner_whatsapp;
    // In real app we'd send to client; here we open WA to owner with reminder
    let msg = '';
    if (days === 0)      msg = `🙏 Namaste ${inv.clientName}, invoice ${inv.invoiceNumber} for ₹${inv.totalAmount.toLocaleString('en-IN')} is due today. Please arrange payment.`;
    else if (days <= 3)  msg = `📋 Gentle reminder: Invoice ${inv.invoiceNumber} for ₹${inv.totalAmount.toLocaleString('en-IN')} from ${inv.clientName} is ${days} day(s) overdue. Kindly clear at earliest.`;
    else                 msg = `⚠️ PAYMENT OVERDUE — Invoice ${inv.invoiceNumber} for ₹${inv.totalAmount.toLocaleString('en-IN')} from ${inv.clientName} is ${days}+ days overdue. Immediate action required.`;
    if (phone) openWhatsApp(phone, msg);
    else toast.error('Set WhatsApp number in Settings first');
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Finance & Billing</h1>
          <p className="text-muted text-sm mt-1">Invoices, outstanding payments, P&L</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncInvoices} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Sync Invoices
          </button>
          <button onClick={() => exportCSV(filtered)} className="btn-secondary">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* P&L summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-muted text-xs">Total Invoiced</p>
          <p className="text-2xl font-bold font-mono text-white mt-1">{formatCurrency(totalInvoiced)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-muted text-xs">Total Received</p>
          <p className="text-2xl font-bold font-mono text-success mt-1">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-muted text-xs">Outstanding</p>
          <p className="text-2xl font-bold font-mono text-orange-400 mt-1">{formatCurrency(totalOutstanding)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10 w-fit">
        {(['outstanding', 'all', 'pl'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              tab === t ? 'bg-primary text-white' : 'text-muted hover:text-white')}>
            {t === 'outstanding' ? `Outstanding (${outstanding.length})` : t === 'all' ? 'All Invoices' : 'P&L Summary'}
          </button>
        ))}
      </div>

      {tab === 'pl' ? (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-accent/10"><p className="section-title">Monthly P&L</p></div>
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              <th className="table-header">Month</th>
              <th className="table-header">Invoiced</th>
              <th className="table-header">Received</th>
              <th className="table-header">Outstanding</th>
              <th className="table-header">Collection %</th>
            </tr></thead>
            <tbody>
              {monthlyPL.map((m) => (
                <tr key={m.month} className="table-row">
                  <td className="table-cell font-medium">{m.month}</td>
                  <td className="table-cell font-mono">{formatCurrency(m.invoiced)}</td>
                  <td className="table-cell font-mono text-success">{formatCurrency(m.received)}</td>
                  <td className="table-cell font-mono text-orange-400">{formatCurrency(m.invoiced - m.received)}</td>
                  <td className="table-cell font-mono">
                    <span className={cn('font-bold', m.invoiced > 0 && (m.received / m.invoiced) >= 0.8 ? 'text-success' : 'text-orange-400')}>
                      {m.invoiced > 0 ? Math.round((m.received / m.invoiced) * 100) + '%' : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client or invoice…" className="input-field pl-9 w-52" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-36">
              <option value="">All Statuses</option>
              {['Draft', 'Sent', 'Paid', 'Overdue'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/5">
                  <th className="table-header">Invoice No.</th>
                  <th className="table-header">Client</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Due Date</th>
                  <th className="table-header">Aging</th>
                  <th className="table-header">Status</th>
                  <th className="table-header"></th>
                </tr></thead>
                <tbody>
                  {(tab === 'outstanding' ? outstanding : filtered).length === 0 ? (
                    <tr><td colSpan={7}>
                      <EmptyState icon={DollarSign} title="No invoices" description="Sync dispatched orders to generate invoices" />
                    </td></tr>
                  ) : (tab === 'outstanding' ? outstanding : filtered).map((inv) => {
                    const daysOverdue = differenceInDays(new Date(), parseISO(inv.dueDate));
                    return (
                      <tr key={inv.id} className="table-row">
                        <td className="table-cell font-mono text-accent text-xs">{inv.invoiceNumber}</td>
                        <td className="table-cell font-medium">{inv.clientName}</td>
                        <td className="table-cell font-mono font-bold">{formatCurrency(inv.totalAmount)}</td>
                        <td className="table-cell font-mono text-xs text-muted">
                          {format(parseISO(inv.dueDate), 'dd MMM yyyy')}
                        </td>
                        <td className="table-cell">
                          {inv.status === 'Paid' ? (
                            <span className="text-muted text-xs">Paid</span>
                          ) : (
                            <span className={cn('badge border text-xs', agingBadge(daysOverdue))}>
                              {daysOverdue > 0 ? `${daysOverdue}d overdue` : daysOverdue === 0 ? 'Due today' : `${Math.abs(daysOverdue)}d left`}
                            </span>
                          )}
                        </td>
                        <td className="table-cell">
                          <span className={cn('badge border text-xs', {
                            'bg-success/20 text-success border-success/30':         inv.status === 'Paid',
                            'bg-yellow-500/20 text-yellow-400 border-yellow-500/30': inv.status === 'Sent',
                            'bg-red-500/20 text-red-400 border-red-500/30':          inv.status === 'Overdue',
                            'bg-white/10 text-white/60 border-white/10':             inv.status === 'Draft',
                          })}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-1">
                            <button onClick={() => printInvoice(inv)}
                              className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors" title="Print invoice">
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {inv.status !== 'Paid' && (
                              <>
                                <button onClick={() => markPaid(inv)}
                                  className="px-2 py-1 rounded bg-success/10 hover:bg-success/20 text-success text-xs transition-colors">
                                  Mark Paid
                                </button>
                                <button onClick={() => sendPaymentReminder(inv, Math.max(0, daysOverdue))}
                                  className="px-2 py-1 rounded bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs transition-colors">
                                  📱 Remind
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2 border-t border-accent/10 text-muted text-xs">
              {tab === 'outstanding' ? outstanding.length : filtered.length} invoices
            </div>
          </div>
        </>
      )}
    </div>
  );
}
