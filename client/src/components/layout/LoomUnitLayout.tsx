import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Gauge, Layers, Boxes, Scroll, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUnit } from '../../context/UnitContext';

const TABS = [
  { label: 'Loom Log',           icon: Gauge,  to: '/loom-unit/loom' },
  { label: 'P.P. Fabric',        icon: Layers, to: '/loom-unit/pp-fabric' },
  { label: 'P.P. Granule Stock', icon: Boxes,  to: '/loom-unit/pp-granule' },
  { label: 'Roll Count',         icon: Scroll, to: '/loom-unit/roll-count' },
];

// Sub-navigation + unit switcher shared by the Loom / P.P. Unit pages. Each unit
// has fully separate data. A unit-scoped Staff login is locked to its own unit;
// Owner / Manager / Developer switch freely.
export function LoomUnitLayout({ children }: { children: ReactNode }) {
  const { activeUnit, setActiveUnit, units, locked } = useUnit();

  return (
    <div className="space-y-5">
      <div className="glass-card px-4 py-3 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-white font-semibold">Loom / P.P. Unit</p>
            <p className="text-muted text-xs mt-0.5">Separate unit — granule stock, fabric, loom production and roll count. Each unit's data is independent.</p>
          </div>
          {/* Unit switcher */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {locked && <span className="flex items-center gap-1 text-[11px] text-muted"><Lock className="w-3 h-3" /> your unit</span>}
            <div className="flex gap-1 p-1 bg-navy/60 rounded-lg border border-accent/10">
              {units.map((u) => {
                const active = u.id === activeUnit;
                const disabled = locked && !active;
                return (
                  <button key={u.id} type="button" disabled={disabled} onClick={() => setActiveUnit(u.id)}
                    className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                      active ? 'bg-primary text-white' : 'text-muted hover:text-white',
                      disabled && 'opacity-40 cursor-not-allowed hover:text-muted')}>
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>
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
