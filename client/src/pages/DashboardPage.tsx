import { useEffect, useState } from 'react';
import {
  ShoppingCart, Truck, AlertTriangle, Package,
  Factory, Users, DollarSign, TrendingUp,
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import api from '../lib/api';
import { formatCurrency, timeAgo, ALERT_TYPE_COLORS, ALERT_TYPE_LABELS, cn } from '../lib/utils';
import type { OrderStats, Alert } from '../types';

export function DashboardPage() {
  const { user } = useAuth();
  const { alerts, unreadCount } = useAlerts();
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, matRes] = await Promise.all([
          api.get('/orders/stats'),
          api.get('/inventory/materials'),
        ]);
        setOrderStats(statsRes.data);
        const lowStock = statsRes.data;
        setLowStockCount(
          matRes.data.filter((m: { currentStock: number; reorderThreshold: number }) =>
            m.currentStock <= m.reorderThreshold
          ).length
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <PageLoader />;

  const recentAlerts = alerts.slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="page-header">
          Good {getGreeting()}, {user?.name.split(' ')[0]} 👋
        </h1>
        <p className="text-muted text-sm mt-1">Here's what's happening at the factory today.</p>
      </div>

      {/* Order stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Pending Orders"
          value={orderStats?.pending ?? 0}
          icon={ShoppingCart}
          iconColor="text-blue-400"
          mono
        />
        <StatCard
          label="In Production"
          value={orderStats?.inProduction ?? 0}
          icon={Factory}
          iconColor="text-yellow-400"
          mono
        />
        <StatCard
          label="Ready to Dispatch"
          value={orderStats?.ready ?? 0}
          icon={Package}
          iconColor="text-accent"
          mono
        />
        <StatCard
          label="Dispatched Today"
          value={orderStats?.dispatched ?? 0}
          icon={Truck}
          iconColor="text-success"
          mono
        />
      </div>

      {/* Alert & stock row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Overdue Orders"
          value={orderStats?.overdue ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-400"
          mono
        />
        <StatCard
          label="Low Stock Items"
          value={lowStockCount}
          icon={Package}
          iconColor="text-orange-400"
          mono
        />
        <StatCard
          label="Unread Alerts"
          value={unreadCount}
          icon={AlertTriangle}
          iconColor="text-yellow-400"
          mono
        />
        <StatCard
          label="Active Users"
          value={3}
          icon={Users}
          iconColor="text-purple-400"
          mono
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent alerts */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Alerts</h2>
            <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">
              {unreadCount} unread
            </span>
          </div>
          <div className="space-y-2">
            {recentAlerts.length === 0 ? (
              <p className="text-muted text-sm text-center py-6">No alerts — all systems normal ✅</p>
            ) : (
              recentAlerts.map((alert: Alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    !alert.seen ? 'bg-primary/10 border-primary/20' : 'bg-white/5 border-transparent'
                  )}
                >
                  {!alert.seen && (
                    <span className="w-2 h-2 mt-1.5 rounded-full bg-accent flex-shrink-0 alert-pulse" />
                  )}
                  <div className={cn('flex-1', alert.seen && 'ml-4')}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn('badge text-[10px]', ALERT_TYPE_COLORS[alert.type])}>
                        {ALERT_TYPE_LABELS[alert.type]}
                      </span>
                      <span className="text-muted text-[10px]">{timeAgo(alert.sentAt)}</span>
                    </div>
                    <p className="text-white/80 text-xs">{alert.title}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="glass-card p-5">
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Order',      icon: ShoppingCart, href: '/orders',     color: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40' },
              { label: 'Stock In',       icon: Package,      href: '/inventory',  color: 'bg-success/10 border-success/20 hover:border-success/40' },
              { label: 'Mark Dispatch',  icon: Truck,        href: '/dispatch',   color: 'bg-accent/10 border-accent/20 hover:border-accent/40' },
              { label: 'View Finance',   icon: DollarSign,   href: '/finance',    color: 'bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/40' },
              { label: 'Production',     icon: Factory,      href: '/production', color: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40' },
              { label: 'CRM Leads',      icon: TrendingUp,   href: '/crm',        color: 'bg-pink-500/10 border-pink-500/20 hover:border-pink-500/40' },
            ].map(({ label, icon: Icon, href, color }) => (
              <a
                key={label}
                href={href}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border transition-all duration-200 text-white/70 hover:text-white',
                  color
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
