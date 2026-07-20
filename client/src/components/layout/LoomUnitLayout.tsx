import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Gauge, Layers, Boxes } from 'lucide-react';
import { cn } from '../../lib/utils';

const TABS = [
  { label: 'Loom Log',           icon: Gauge,  to: '/loom-unit/loom' },
  { label: 'P.P. Fabric',        icon: Layers, to: '/loom-unit/pp-fabric' },
  { label: 'P.P. Granule Stock', icon: Boxes,  to: '/loom-unit/pp-granule' },
];

// Sub-navigation shared by the Loom / P.P. Unit pages. This unit belongs to a
// different company and does not feed the main BOPP/bag workflow — granule stock,
// fabric and the loom log only interlink with each other.
export function LoomUnitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="glass-card px-4 py-3 space-y-3">
        <div>
          <p className="text-white font-semibold">Loom / P.P. Unit</p>
          <p className="text-muted text-xs mt-0.5">Separate unit — granule stock, fabric and loom production. Independent of the BOPP job-card flow.</p>
        </div>
        <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10 overflow-x-auto">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to}
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                isActive ? 'bg-primary text-white' : 'text-muted hover:text-white')}>
              <t.icon className="w-4 h-4" /> {t.label}
            </NavLink>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
