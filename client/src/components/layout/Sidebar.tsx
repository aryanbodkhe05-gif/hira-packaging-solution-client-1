import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { canEditRates } from '../../lib/roles';
import { useBranding } from '../../lib/branding';
import {
  LayoutDashboard, Package, Factory, ShoppingCart, Truck,
  Users, DollarSign, Building2, Bell, Settings, UserCog,
  ChevronLeft, ChevronRight, ChevronDown, Zap, Layers, Gauge,
  ClipboardList, IndianRupee, Boxes, FileText, Archive,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem { label: string; icon: LucideIcon; to: string; ownerOnly?: boolean }
interface NavSection { section: string; icon: LucideIcon; items: NavItem[] }

// 6-section tree. ownerOnly items are hidden for Staff (canEditRates()).
const NAV: NavSection[] = [
  { section: 'Dashboard', icon: LayoutDashboard, items: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
    { label: 'Alerts',    icon: Bell,            to: '/alerts' },
  ]},
  { section: 'Sales', icon: ShoppingCart, items: [
    { label: 'Orders',           icon: ShoppingCart, to: '/orders' },
    { label: 'Dispatch – Bags',  icon: Truck,        to: '/dispatch/bags' },
    { label: 'Dispatch – Rolls', icon: Truck,        to: '/dispatch/rolls' },
    { label: 'CRM',              icon: Users,        to: '/crm' },
    { label: 'Finance',          icon: DollarSign,   to: '/finance' },
  ]},
  { section: 'Production', icon: Factory, items: [
    { label: 'BOPP Job Card', icon: ClipboardList, to: '/job-card' },
    { label: 'Other Job Card', icon: ClipboardList, to: '/other' },
    { label: 'Loom Log',      icon: Gauge,         to: '/loom' },
    { label: 'PP Fabric',     icon: Layers,        to: '/pp-fabric' },
  ]},
  { section: 'Inventory', icon: Package, items: [
    { label: 'Rolls',          icon: Boxes,   to: '/inventory/rolls' },
    { label: 'Raw Materials',  icon: Package,  to: '/inventory/raw-materials' },
    { label: 'BOPP Film',      icon: Layers,   to: '/inventory/bopp-film' },
    { label: 'P.P. Granule',   icon: Boxes,    to: '/inventory/pp-granule' },
    { label: 'Finished Rolls', icon: Archive,  to: '/inventory/finished-rolls' },
  ]},
  { section: 'Supplier', icon: Building2, items: [
    { label: 'Suppliers',       icon: Building2,     to: '/suppliers' },
    { label: 'GRN',             icon: FileText,      to: '/grn' },
  ]},
  { section: 'Master', icon: Settings, items: [
    { label: 'Rate Master',       icon: IndianRupee, to: '/rate-master', ownerOnly: true },
    { label: 'Users & Roles',     icon: UserCog,     to: '/users', ownerOnly: true },
    { label: 'Settings',          icon: Settings,    to: '/settings', ownerOnly: true },
  ]},
];

interface Props { collapsed: boolean; onToggle: () => void; }

export function Sidebar({ collapsed, onToggle }: Props) {
  const location = useLocation();
  const branding = useBranding();

  const visibleSections = NAV
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.ownerOnly || canEditRates()) }))
    .filter((s) => s.items.length > 0);

  const isActive = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  // Track collapsed groups (default: all expanded). Section containing the
  // active route is always kept open.
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggleSection = (name: string) =>
    setClosed((p) => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });

  return (
    <aside className={cn(
      'sidebar-transition flex flex-col bg-navy border-r border-accent/10 h-full',
      collapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-accent/10', collapsed && 'justify-center px-0')}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-xs leading-tight truncate">{branding.companyName}</p>
            <p className="text-muted text-[10px] truncate">{branding.appName}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {collapsed ? (
          // Icon-only rail — flatten all items, no section headers
          <ul className="space-y-0.5 px-2">
            {visibleSections.flatMap((s) => s.items).map(({ label, icon: Icon, to }) => (
              <li key={to}>
                <NavLink to={to} title={label}
                  className={cn(
                    'flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all duration-150',
                    isActive(to) ? 'bg-primary/30 text-white border border-primary/40' : 'text-muted hover:text-white hover:bg-white/5'
                  )}>
                  <Icon className={cn('w-4 h-4', isActive(to) && 'text-accent')} />
                </NavLink>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-1 px-2">
            {visibleSections.map(({ section, icon: SecIcon, items }) => {
              const hasActive = items.some((i) => isActive(i.to));
              const open = hasActive || !closed.has(section);
              return (
                <div key={section}>
                  <button onClick={() => toggleSection(section)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted hover:text-white/80 transition-colors">
                    <span className="flex items-center gap-2"><SecIcon className="w-3.5 h-3.5" /> {section}</span>
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !open && '-rotate-90')} />
                  </button>
                  {open && (
                    <ul className="space-y-0.5 mb-1">
                      {items.map(({ label, icon: Icon, to }) => (
                        <li key={to + label}>
                          <NavLink to={to}
                            className={cn(
                              'flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                              isActive(to) ? 'bg-primary/30 text-white border border-primary/40' : 'text-muted hover:text-white hover:bg-white/5'
                            )}>
                            <Icon className={cn('w-4 h-4 flex-shrink-0', isActive(to) && 'text-accent')} />
                            <span className="truncate">{label}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      <button onClick={onToggle}
        className="flex items-center justify-center w-full py-3 border-t border-accent/10 text-muted hover:text-white transition-colors">
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
