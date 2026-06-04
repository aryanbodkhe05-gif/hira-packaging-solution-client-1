import { useState, useMemo } from 'react';
import { Bell, CheckCheck, Zap, ExternalLink } from 'lucide-react';
import { differenceInDays, format, isPast, parseISO } from 'date-fns';
import { ordersDb, invoicesDb, leadsDb, purchaseOrdersDb, alertsDb, getSettings, saveSettings } from '../lib/db';
import { COMPANY, ALERT_TYPES } from '../config';
import type { AppAlert } from '../types/models';
import { cn, timeAgo, ALERT_TYPE_COLORS, ALERT_TYPE_LABELS } from '../lib/utils';
import { EmptyState } from '../components/ui/EmptyState';

const ICONS: Record<string, string> = {
  LOW_STOCK:      '🚨',
  OVERDUE_ORDER:  '⏰',
  PAYMENT_DEFAULT:'💸',
  DISPATCH_DELAY: '🚚',
  FOLLOW_UP:      '📋',
  PO_DELAY:       '📦',
};

// ── WhatsApp opener ───────────────────────────────────────────────────────────
function openWhatsApp(phone: string, message: string) {
  const clean = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`, '_blank');
}

// ── Scan for live conditions → push alerts ────────────────────────────────────
function scanAndCreateAlerts(): number {
  const settings   = getSettings();
  const threshold  = parseInt(settings.followup_days ?? '3', 10);
  const existing   = alertsDb.getAll();
  const now        = new Date();
  let count = 0;

  // helper: only create if no duplicate in last 24h
  function push(type: AppAlert['type'], title: string, message: string, channel: AppAlert['channel']) {
    const dup = existing.find((a) => a.title === title &&
      differenceInDays(now, parseISO(a.createdAt)) < 1
    );
    if (dup) return;
    alertsDb.create({ type, title, message, seen: false, channel, createdAt: now.toISOString() });
    count++;
  }

  // Overdue orders
  if (settings.alert_overdue === 'true') {
    ordersDb.getAll()
      .filter((o) => o.status !== 'Dispatched' && isPast(parseISO(o.createdAt)))
      .forEach((o) => {
        const ch: AppAlert['channel'] = settings.alert_overdue === 'true' ? 'BOTH' : 'IN_APP';
        push('OVERDUE_ORDER', `Overdue: ${o.orderId}`,
          `⏰ OVERDUE ORDER ${o.orderId} — ${o.clientName}. Status: ${o.status}`, ch);
      });
  }

  // Payment defaults
  if (settings.alert_payment === 'true') {
    invoicesDb.getAll()
      .filter((i) => i.status !== 'Paid' && isPast(parseISO(i.dueDate)))
      .forEach((i) => {
        const days = differenceInDays(now, parseISO(i.dueDate));
        push('PAYMENT_DEFAULT', `Payment Overdue: ${i.invoiceNumber}`,
          `💸 PAYMENT OVERDUE — ${i.clientName} owes ₹${i.totalAmount.toLocaleString('en-IN')}. Due ${days} day(s) ago`, 'BOTH');
      });
  }

  // Follow-up reminders
  if (settings.alert_followup === 'true') {
    leadsDb.getAll()
      .filter((l) => {
        if (l.status === 'Won' || l.status === 'Lost') return false;
        const last = l.lastContactedAt ? parseISO(l.lastContactedAt) : parseISO(l.createdAt);
        return differenceInDays(now, last) >= threshold;
      })
      .forEach((l) => {
        const days = differenceInDays(now, l.lastContactedAt ? parseISO(l.lastContactedAt) : parseISO(l.createdAt));
        push('FOLLOW_UP', `Follow-up: ${l.companyName}`,
          `📋 FOLLOW-UP REMINDER: ${l.companyName} hasn't been contacted in ${days} days. Last action: ${l.notes || '—'}. Contact: ${l.phone}`, 'IN_APP');
      });
  }

  // PO delays
  if (settings.alert_po_delay === 'true') {
    purchaseOrdersDb.getAll()
      .filter((po) => po.status !== 'Delivered' && isPast(parseISO(po.expectedDelivery)))
      .forEach((po) => {
        push('PO_DELAY', `PO Delay: ${po.poNumber}`,
          `📦 PO ${po.poNumber} from ${po.vendorName} was expected on ${po.expectedDelivery} but not confirmed. Material: ${po.material}`, 'BOTH');
      });
  }

  return count;
}

// ── Daily summary builder ────────────────────────────────────────────────────
function buildDailySummary(): string {
  const now = new Date();
  const orders   = ordersDb.getAll();
  const invoices = invoicesDb.getAll();
  const leads    = leadsDb.getAll();
  const settings = getSettings();
  const threshold = parseInt(settings.followup_days ?? '3', 10);

  const pendingDispatch = orders.filter((o) => o.status === 'Ready').length;
  const overdueOrders   = orders.filter((o) => o.status !== 'Dispatched' && isPast(parseISO(o.createdAt))).length;
  const dispatchedToday = orders.filter((o) => o.status === 'Dispatched' &&
    o.dispatchedAt && new Date(o.dispatchedAt).toDateString() === now.toDateString()
  ).length;

  const outstandingInv  = invoices.filter((i) => i.status !== 'Paid');
  const outstandingAmt  = outstandingInv.reduce((s, i) => s + i.totalAmount, 0);
  const dueToday        = outstandingInv.filter((i) => i.dueDate === format(now, 'yyyy-MM-dd')).length;

  const newLeads        = leads.filter((l) => l.status === 'New').length;
  const followupDue     = leads.filter((l) => {
    if (l.status === 'Won' || l.status === 'Lost') return false;
    const last = l.lastContactedAt ? parseISO(l.lastContactedAt) : parseISO(l.createdAt);
    return differenceInDays(now, last) >= threshold;
  }).length;

  return `🏭 *${COMPANY.name} Daily Report — ${format(now, 'dd MMM yyyy')}*

📦 *Orders*
- Pending dispatch: ${pendingDispatch} orders
- Overdue: ${overdueOrders} orders
- Dispatched today: ${dispatchedToday} orders

💰 *Finance*
- Outstanding: ₹${outstandingAmt.toLocaleString('en-IN')} from ${outstandingInv.length} clients
- Invoices due today: ${dueToday}

👥 *CRM*
- New leads: ${newLeads}
- Follow-ups due: ${followupDue}

*Have a productive day! — ${COMPANY.shortName} ERP*`;
}

// ── Alert row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert, onSeen }: { alert: AppAlert; onSeen: (id: string) => void }) {
  return (
    <div className={cn(
      'flex items-start gap-4 p-4 rounded-xl border transition-all',
      !alert.seen ? 'bg-primary/10 border-primary/25' : 'bg-white/3 border-transparent hover:bg-white/5'
    )}>
      <span className="text-2xl flex-shrink-0">{ICONS[alert.type] ?? '🔔'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn('badge text-xs border', ALERT_TYPE_COLORS[alert.type] ?? 'bg-white/10 text-muted')}>
                {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
              </span>
              <span className="badge bg-white/5 text-muted border border-white/10 text-[10px]">{alert.channel}</span>
              {!alert.seen && <span className="w-2 h-2 rounded-full bg-accent alert-pulse" />}
            </div>
            <p className="text-white font-medium text-sm">{alert.title}</p>
            <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{alert.message}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-muted text-xs font-mono">{timeAgo(alert.createdAt)}</p>
            {!alert.seen && (
              <button onClick={() => onSeen(alert.id)} className="text-accent text-xs hover:text-white mt-1 flex items-center gap-1 ml-auto">
                <CheckCheck className="w-3 h-3" /> Read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Settings section ──────────────────────────────────────────────────────────
function AlertSettings() {
  const [s, setS] = useState(getSettings());

  function toggle(key: string) {
    const val = s[key] === 'true' ? 'false' : 'true';
    saveSettings({ [key]: val });
    setS((p) => ({ ...p, [key]: val }));
  }

  const alertKeys = [
    { key: 'alert_low_stock', label: 'Low Stock', type: 'LOW_STOCK' },
    { key: 'alert_overdue',   label: 'Overdue Orders', type: 'OVERDUE_ORDER' },
    { key: 'alert_payment',   label: 'Payment Defaults', type: 'PAYMENT_DEFAULT' },
    { key: 'alert_dispatch',  label: 'Dispatch Delays', type: 'DISPATCH_DELAY' },
    { key: 'alert_followup',  label: 'CRM Follow-ups', type: 'FOLLOW_UP' },
    { key: 'alert_po_delay',  label: 'PO Delivery Delays', type: 'PO_DELAY' },
  ];

  return (
    <div className="glass-card p-5 space-y-4">
      <p className="section-title">Alert Configuration</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {alertKeys.map(({ key, label, type }) => (
          <div key={key} className={cn(
            'flex items-center justify-between p-3 rounded-lg border transition-all',
            s[key] === 'true' ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/10'
          )}>
            <div className="flex items-center gap-2">
              <span>{ICONS[type]}</span>
              <span className="text-sm text-white/80">{label}</span>
            </div>
            <button onClick={() => toggle(key)}
              className={cn('w-10 h-5 rounded-full transition-all relative', s[key] === 'true' ? 'bg-primary' : 'bg-white/20')}>
              <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all',
                s[key] === 'true' ? 'left-5' : 'left-0.5')} />
            </button>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-accent/10">
        <p className="text-muted text-xs">WhatsApp-enabled alerts open wa.me links. Ensure your owner WhatsApp is set in Settings.</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AlertEnginePage() {
  const [alerts, setAlerts] = useState<AppAlert[]>(() => alertsDb.getAll());
  const [tab, setTab] = useState<'log' | 'settings' | 'summary'>('log');
  const [summary, setSummary] = useState('');

  const unread = alerts.filter((a) => !a.seen).length;

  function scan() {
    const count = scanAndCreateAlerts();
    setAlerts(alertsDb.getAll());
    if (count > 0) toast(`Detected ${count} new alert${count > 1 ? 's' : ''}`, { icon: '🔔' });
    else toast('No new alerts detected', { icon: '✅' });
  }

  function markSeen(id: string) {
    alertsDb.markSeen(id);
    setAlerts(alertsDb.getAll());
  }

  function markAllSeen() {
    alerts.forEach((a) => alertsDb.markSeen(a.id));
    setAlerts(alertsDb.getAll());
  }

  function sendDailySummary() {
    const msg = buildDailySummary();
    setSummary(msg);
    const settings = getSettings();
    const phone    = settings.owner_whatsapp;
    if (phone) openWhatsApp(phone, msg);
    else { import('react-hot-toast').then(({ default: t }) => t.error('Set owner WhatsApp number in Settings first')); }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Alert Engine</h1>
          <p className="text-muted text-sm mt-1">Cross-module alerts, WhatsApp triggers, daily summary</p>
        </div>
        <div className="flex gap-2">
          <button onClick={scan} className="btn-secondary">
            <Zap className="w-4 h-4" /> Scan Now
          </button>
          {unread > 0 && (
            <button onClick={markAllSeen} className="btn-secondary">
              <CheckCheck className="w-4 h-4" /> Mark All Read ({unread})
            </button>
          )}
        </div>
      </div>

      {unread > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 alert-pulse">
          <Bell className="w-5 h-5 text-red-400" />
          <p className="text-red-300 font-medium text-sm">{unread} unread alert{unread > 1 ? 's' : ''} require attention</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10 w-fit">
        {(['log', 'settings', 'summary'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-primary text-white' : 'text-muted hover:text-white')}>
            {t === 'log' ? `🔔 Alert Log (${alerts.length})` : t === 'settings' ? '⚙️ Configure' : '📱 Daily Summary'}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="glass-card">
              <EmptyState icon={Bell} title="No alerts yet"
                description='Click "Scan Now" to check for conditions across all modules' />
            </div>
          ) : (
            <>
              {alerts.filter((a) => !a.seen).length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted text-xs uppercase tracking-wide font-medium">Unread</p>
                  {alerts.filter((a) => !a.seen).map((a) => <AlertRow key={a.id} alert={a} onSeen={markSeen} />)}
                </div>
              )}
              {alerts.filter((a) => a.seen).length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-muted text-xs uppercase tracking-wide font-medium">Earlier</p>
                  {alerts.filter((a) => a.seen).map((a) => <AlertRow key={a.id} alert={a} onSeen={markSeen} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'settings' && <AlertSettings />}

      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-title">WhatsApp Daily Summary</p>
              <button onClick={sendDailySummary} className="btn-primary">
                <ExternalLink className="w-4 h-4" /> Send via WhatsApp
              </button>
            </div>
            <p className="text-muted text-xs">Generates a live snapshot of all modules and opens WhatsApp with the message pre-filled for the owner's number.</p>
            {summary ? (
              <pre className="bg-navy/60 border border-accent/20 rounded-xl p-4 text-white/80 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {summary}
              </pre>
            ) : (
              <div className="bg-navy/60 border border-accent/10 rounded-xl p-6 text-center">
                <p className="text-muted text-sm">Click "Send via WhatsApp" to generate the summary</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// tiny toast helper
function toast(msg: string, opts?: { icon?: string }) {
  import('react-hot-toast').then(({ default: t }) => {
    (t as (msg: string, opts?: object) => void)(msg, { icon: opts?.icon, style: { background: '#1A1A70', color: '#fff', border: '1px solid rgba(94,94,232,0.3)' } });
  });
}
