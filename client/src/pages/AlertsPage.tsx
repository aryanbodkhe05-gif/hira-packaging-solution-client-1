import { Bell, CheckCheck, AlertTriangle } from 'lucide-react';
import { useAlerts } from '../context/AlertContext';
import { cn, timeAgo, ALERT_TYPE_LABELS, ALERT_TYPE_COLORS } from '../lib/utils';
import { EmptyState } from '../components/ui/EmptyState';
import type { Alert } from '../types';

const ICONS: Record<string, string> = {
  LOW_STOCK: '🚨',
  OVERDUE_ORDER: '⏰',
  MACHINE_DOWN: '⚙️',
  PAYMENT_DEFAULT: '💸',
  DISPATCH_DELAY: '🚚',
  SYSTEM: '🔔',
};

function AlertRow({ alert, onSeen }: { alert: Alert; onSeen: (id: string) => void }) {
  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4 rounded-xl border transition-all',
        !alert.seen
          ? 'bg-primary/10 border-primary/25'
          : 'bg-white/3 border-transparent hover:bg-white/5'
      )}
    >
      <span className="text-2xl flex-shrink-0 mt-0.5">{ICONS[alert.type] ?? '🔔'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('badge text-xs', ALERT_TYPE_COLORS[alert.type])}>
                {ALERT_TYPE_LABELS[alert.type]}
              </span>
              <span className="badge bg-white/5 text-muted border border-white/10 text-[10px]">
                {alert.channel}
              </span>
              {!alert.seen && (
                <span className="w-2 h-2 rounded-full bg-accent alert-pulse" />
              )}
            </div>
            <p className="text-white font-medium text-sm">{alert.title}</p>
            <p className="text-white/60 text-xs mt-1 leading-relaxed">{alert.message}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-muted text-xs font-mono">{timeAgo(alert.sentAt)}</p>
            {!alert.seen && (
              <button
                onClick={() => onSeen(alert.id)}
                className="text-accent text-xs hover:text-white transition-colors mt-1 flex items-center gap-1 ml-auto"
              >
                <CheckCheck className="w-3 h-3" /> Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertsPage() {
  const { alerts, unreadCount, markSeen, markAllSeen } = useAlerts();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-header">Alert Engine</h1>
          <p className="text-muted text-sm mt-1">All system alerts — real-time and historical</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllSeen} className="btn-secondary">
            <CheckCheck className="w-4 h-4" />
            Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      {unreadCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-red-400 font-medium text-sm">
            {unreadCount} unread alert{unreadCount > 1 ? 's' : ''} require your attention
          </p>
        </div>
      )}

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <div className="glass-card">
            <EmptyState
              icon={Bell}
              title="No alerts yet"
              description="All systems are running normally. Alerts will appear here when triggered."
            />
          </div>
        ) : (
          <>
            {/* Unread */}
            {alerts.filter((a) => !a.seen).length > 0 && (
              <div className="space-y-2">
                <p className="text-muted text-xs uppercase tracking-wide font-medium px-1">
                  Unread ({alerts.filter((a) => !a.seen).length})
                </p>
                {alerts.filter((a) => !a.seen).map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onSeen={markSeen} />
                ))}
              </div>
            )}

            {/* Read */}
            {alerts.filter((a) => a.seen).length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-muted text-xs uppercase tracking-wide font-medium px-1">
                  Earlier
                </p>
                {alerts.filter((a) => a.seen).map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onSeen={markSeen} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
