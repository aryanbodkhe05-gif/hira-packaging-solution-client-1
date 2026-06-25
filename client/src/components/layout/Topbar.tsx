import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { COMPANY } from '../../config';
import { useBranding } from '../../lib/branding';
import { timeAgo, ALERT_TYPE_COLORS, ALERT_TYPE_LABELS, cn } from '../../lib/utils';
import { useAlerts } from '../../context/AlertContext';
import { useLiveClock } from '../../hooks/useLiveClock';

export function Topbar() {
  const { alerts, unreadCount, markSeen, markAllSeen } = useAlerts();
  const branding = useBranding();
  const clock = useLiveClock();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-accent/10 bg-navy/80 backdrop-blur-sm flex-shrink-0">
      <span className="text-white/60 text-sm font-medium hidden sm:block">{branding.companyName}</span>

      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-muted hidden md:block">{clock} IST</span>

        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <button onClick={() => setNotifOpen((p) => !p)}
            className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
            <Bell className="w-5 h-5 text-white/70" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 w-80 glass-card border border-accent/20 shadow-2xl z-50 animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-accent/10">
                <span className="text-sm font-semibold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllSeen} className="text-xs text-accent hover:text-white transition-colors">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                {alerts.length === 0 ? (
                  <p className="text-muted text-sm text-center py-6">No notifications</p>
                ) : alerts.slice(0, 15).map((alert) => (
                  <button key={alert.id} onClick={() => markSeen(alert.id)}
                    className={cn('w-full text-left px-4 py-3 hover:bg-white/5 transition-colors', !alert.seen && 'bg-primary/10')}>
                    <div className="flex items-start gap-2">
                      {!alert.seen && <span className="w-2 h-2 mt-1.5 rounded-full bg-accent flex-shrink-0" />}
                      <div className={cn('flex-1', alert.seen && 'ml-4')}>
                        <span className={cn('badge text-[10px]', ALERT_TYPE_COLORS[alert.type])}>
                          {ALERT_TYPE_LABELS[alert.type]}
                        </span>
                        <p className="text-white/80 text-xs mt-0.5 line-clamp-2">{alert.title}</p>
                        <p className="text-muted text-[10px] mt-1">{timeAgo(alert.sentAt)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Owner chip */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
            {COMPANY.owner.charAt(0)}
          </div>
          <span className="hidden sm:block text-white text-xs font-medium">{COMPANY.owner}</span>
        </div>
      </div>
    </header>
  );
}
