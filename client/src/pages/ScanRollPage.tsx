import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Scroll, Wifi, WifiOff, AlertTriangle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { hydrateFromServer } from '../lib/db';
import { findRollScanView, type RollScanView } from '../lib/rolls';
import { canViewCosts } from '../lib/roles';
import { formatINR } from '../lib/jobcard';

type State = 'loading' | 'ok' | 'invalid' | 'notfound';

// Read-only roll card opened by scanning a roll's QR label. Shows LIVE data when the
// backend is reachable (refreshed on open), else this device's last-known data with
// an offline notice. Rate is shown only to cost-viewing roles (Owner/Manager/Dev).
export function ScanRollPage() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const token = sp.get('t') ?? '';

  const [state, setState] = useState<State>('loading');
  const [online, setOnline] = useState(false);
  const [roll, setRoll] = useState<RollScanView | null>(null);
  const showCosts = canViewCosts();

  useEffect(() => {
    let alive = true;
    (async () => {
      // Refresh from the shared backend first; the boolean tells us live vs offline.
      const isOnline = await hydrateFromServer().catch(() => false);
      if (!alive) return;
      setOnline(isOnline);
      const found = findRollScanView(id);
      if (!found) { setState('notfound'); return; }
      if (!token || found.qrToken !== token) { setState('invalid'); return; }
      setRoll(found);
      setState('ok');
    })();
    return () => { alive = false; };
  }, [id, token]);

  return (
    <div className="min-h-[70vh] flex items-start justify-center px-4 py-8 animate-fade-in">
      <div className="w-full max-w-md space-y-4">
        <Link to="/inventory/rolls" className="inline-flex items-center gap-1.5 text-muted hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Rolls
        </Link>

        {state === 'loading' && (
          <div className="glass-card p-8 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {state === 'invalid' && (
          <div className="glass-card p-6 space-y-2 border border-red-500/30">
            <div className="flex items-center gap-2 text-red-300"><ShieldAlert className="w-5 h-5" /><span className="font-semibold">Invalid or expired code</span></div>
            <p className="text-muted text-sm">This QR code doesn’t match the roll’s current label. It may have been reprinted (regenerated). Scan the roll’s latest label.</p>
          </div>
        )}

        {state === 'notfound' && (
          <div className="glass-card p-6 space-y-2 border border-yellow-500/30">
            <div className="flex items-center gap-2 text-yellow-300"><AlertTriangle className="w-5 h-5" /><span className="font-semibold">Roll not found</span></div>
            <p className="text-muted text-sm">
              {online
                ? 'No roll with this code exists in the system.'
                : 'You’re offline and this roll isn’t in this device’s last-known data. Connect to the internet and scan again.'}
            </p>
          </div>
        )}

        {state === 'ok' && roll && (
          <div className="glass-card overflow-hidden">
            {/* Header: identity + live/offline badge */}
            <div className="px-5 py-4 border-b border-accent/10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 grid place-items-center"><Scroll className="w-5 h-5 text-accent" /></div>
                <div>
                  <p className="text-white font-semibold font-mono text-lg leading-tight">{roll.rollNo || '(no roll no)'}</p>
                  <p className="text-muted text-xs">{roll.kind === 'unit' ? 'Loom / unit roll' : 'Inventory roll'}{roll.type ? ` · ${roll.type}` : ''}</p>
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

            {/* Read-only fields */}
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
        )}
      </div>
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
