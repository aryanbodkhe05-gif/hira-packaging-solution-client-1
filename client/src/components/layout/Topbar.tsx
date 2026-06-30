import { useState, useRef, useEffect } from 'react';
import { Bell, Menu, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranding } from '../../lib/branding';
import { timeAgo, ALERT_TYPE_COLORS, ALERT_TYPE_LABELS, cn } from '../../lib/utils';
import { useAlerts } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
import { useLiveClock } from '../../hooks/useLiveClock';

const ROLE_LABEL: Record<string, string> = {
  DEVELOPER: 'Developer', OWNER: 'Owner', MANAGER: 'Manager', STAFF: 'Staff',
};

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { alerts, unreadCount, markSeen, markAllSeen } = useAlerts();
  const { user, logout } = useAuth();
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
    <header className="relative z-30 h-14 flex items-center justify-between px-4 sm:px-6 border-b border-accent/10 bg-navy/80 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onMenu} aria-label="Open menu"
          className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-white/10 text-white/70 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-white/60 text-sm font-medium truncate">{branding.companyName}</span>
      </div>

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
            <div className="fixed top-14 right-3 w-[calc(100vw-1.5rem)] max-w-sm sm:absolute sm:top-12 sm:right-0 sm:w-80 glass-card border border-accent/20 shadow-2xl z-50 animate-fade-in">
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

        {/* User chip + logout */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(user?.name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-white text-xs font-medium">{user?.name}</p>
            <p className="text-muted text-[10px]">{user ? ROLE_LABEL[user.role] ?? user.role : ''}</p>
          </div>
          <button
            onClick={async () => { await logout(); toast.success('Logged out'); }}
            title="Log out"
            className="p-2 rounded-lg hover:bg-white/10 text-muted hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
