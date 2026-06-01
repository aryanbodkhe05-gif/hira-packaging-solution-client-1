import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Factory,
  Users, DollarSign, Building2, Bell, Settings, ChevronLeft, ChevronRight,
  Zap,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard',    icon: LayoutDashboard, to: '/' },
  { label: 'Inventory',    icon: Package,          to: '/inventory' },
  { label: 'Orders',       icon: ShoppingCart,     to: '/orders' },
  { label: 'Dispatch',     icon: Truck,            to: '/dispatch' },
  { label: 'Production',   icon: Factory,          to: '/production' },
  { label: 'CRM',          icon: Users,            to: '/crm' },
  { label: 'Finance',      icon: DollarSign,       to: '/finance' },
  { label: 'Vendors',      icon: Building2,        to: '/vendors' },
  { label: 'Alerts',       icon: Bell,             to: '/alerts' },
  { label: 'Settings',     icon: Settings,         to: '/settings' },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        'sidebar-transition flex flex-col bg-navy border-r border-accent/10 h-full',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-accent/10',
        collapsed && 'justify-center px-0'
      )}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-tight">PackFlow</p>
            <p className="text-muted text-xs">ERP System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map(({ label, icon: Icon, to }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to);

            return (
              <li key={to}>
                <NavLink
                  to={to}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    collapsed && 'justify-center px-0 w-10 mx-auto',
                    isActive
                      ? 'bg-primary/30 text-white border border-primary/40'
                      : 'text-muted hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-accent')} />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-full py-3 border-t border-accent/10 text-muted hover:text-white transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
