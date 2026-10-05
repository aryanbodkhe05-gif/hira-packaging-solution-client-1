import { Scroll, Wifi, WifiOff } from 'lucide-react';
import { canViewCosts } from '../../lib/roles';
import { formatINR } from '../../lib/jobcard';
import type { RollScanView } from '../../lib/rolls';

// Read-only live-info card for a scanned/looked-up roll or BOPP film. Shared by the
// public scan page and the internal Scanner view. Rate shows only to cost-viewing roles.
export function RollInfoCard({ roll, online }: { roll: RollScanView; online: boolean }) {
  const showCosts = canViewCosts();
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-accent/10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 grid place-items-center"><Scroll className="w-5 h-5 text-accent" /></div>
          <div>
            <p className="text-white font-semibold font-mono text-lg leading-tight">{roll.rollNo || '(no roll no)'}</p>
            <p className="text-muted text-xs">{roll.kind === 'film' ? 'BOPP film' : roll.kind === 'unit' ? 'Loom / unit roll' : 'Inventory roll'}{roll.type ? ` · ${roll.type}` : ''}</p>
          </div>
        </div>
        {online
          ? <span className="badge bg-green-500/15 text-green-300 border border-green-500/30 text-[10px] inline-flex items-center gap-1"><Wifi className="w-3 h-3" /> Live</span>
          : <span className="badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px] inline-flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline</span>}
      </div>

      {!online && (
        <div className="px-5 py-2 bg-yellow-500/[0.07] text-yellow-200/90 text-[11px] flex items-center gap-1.5">
          <WifiOff className="w-3.5 h-3.5 shrink-0" /> Showing last-known data from this device — not confirmed live.
        </div>
      )}

      <dl className="p-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Field label="Size" value={roll.size || '—'} mono />
        <Field label="GM" value={roll.gm != null ? String(roll.gm) : '—'} mono />
        <Field label="Net Wt (kg)" value={roll.nWt != null ? roll.nWt.toLocaleString('en-IN') : '—'} mono />
        <Field label="Gross Wt (kg)" value={roll.gWt != null ? roll.gWt.toLocaleString('en-IN') : '—'} mono />
        <Field label="Meter" value={roll.meter != null ? roll.meter.toLocaleString('en-IN') : '—'} mono />
        <Field label="Status" value={roll.status} />
        {roll.party && <Field label="Party" value={roll.party} />}
        {showCosts && (
          <Field label="Rate (₹/kg)" value={roll.rate == null ? 'not set' : formatINR(roll.rate)} mono accent />
        )}
      </dl>

      {!showCosts && (
        <p className="px-5 pb-4 -mt-1 text-muted text-[11px]">Rate is visible to Owner / Manager only.</p>
      )}
    </div>
  );
}

function Field({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div>
      <dt className="text-muted text-[11px] uppercase tracking-wide">{label}</dt>
      <dd className={`${mono ? 'font-mono ' : ''}${accent ? 'text-accent' : 'text-white/90'} mt-0.5`}>{value}</dd>
    </div>
  );
}
