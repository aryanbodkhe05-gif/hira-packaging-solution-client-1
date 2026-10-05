import { useCallback, useEffect, useState } from 'react';
import { ScanLine, Search, AlertTriangle } from 'lucide-react';
import { hydrateFromServer } from '../lib/db';
import { findRollScanView, findRollScanViewByQuery, type RollScanView } from '../lib/rolls';
import { LiveRollScanner } from '../components/ui/ScanRollButton';
import { RollInfoCard } from '../components/ui/RollInfoCard';

// Scanner info view — look up a roll / BOPP film's LIVE details, read-only (for checking
// specs, not consumption). Two ways in: type/paste a roll no, film no or id and Show; or
// turn on the camera and scan a QR — its info opens automatically with no further action.
export function ScannerPage() {
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState(false);
  const [roll, setRoll] = useState<RollScanView | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  // Refresh the shared data first (so info is live), then resolve the lookup.
  const lookup = useCallback(async (resolve: () => RollScanView | null) => {
    setBusy(true);
    const isOnline = await hydrateFromServer().catch(() => false);
    setOnline(isOnline);
    setRoll(resolve());
    setSearched(true);
    setBusy(false);
  }, []);

  useEffect(() => { hydrateFromServer().then(setOnline).catch(() => setOnline(false)); }, []);

  const showManual = () => { if (query.trim()) void lookup(() => findRollScanViewByQuery(query)); };
  // Camera decode → open that item's info immediately (no manual action).
  const onCameraScan = (p: { kind: 'roll' | 'film'; id: string; token: string }) => {
    setQuery(p.id);
    void lookup(() => findRollScanView(p.id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header flex items-center gap-2"><ScanLine className="w-5 h-5 text-accent" /> Scanner</h1>
        <p className="text-muted text-sm mt-1">Scan or look up a roll / BOPP film to see its live details — read-only, for checking specs (not consumption).</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Left: manual lookup + camera */}
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <p className="label !mb-0">Look up by roll no, film no or ID</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input className="input-field pl-9 w-full" placeholder="e.g. R-500-12-1 or F-520mm-1"
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') showManual(); }} />
              </div>
              <button type="button" onClick={showManual} disabled={busy || !query.trim()} className="btn-primary shrink-0">Show info</button>
            </div>
            <p className="text-muted text-[11px]">You can also paste a scan URL — the roll/film ID is read from it.</p>
          </div>

          <div className="glass-card p-4">
            <LiveRollScanner onScan={onCameraScan} />
          </div>
        </div>

        {/* Right: live info */}
        <div className="space-y-3">
          {busy && !roll && (
            <div className="glass-card p-8 flex items-center justify-center">
              <div className="w-7 h-7 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          )}
          {!busy && searched && !roll && (
            <div className="glass-card p-6 space-y-2 border border-yellow-500/30">
              <div className="flex items-center gap-2 text-yellow-300"><AlertTriangle className="w-5 h-5" /><span className="font-semibold">No match</span></div>
              <p className="text-muted text-sm">
                {online
                  ? 'No roll or BOPP film matches that roll no / film no / ID.'
                  : 'No match in this device’s last-known data — you may be offline. Connect and try again.'}
              </p>
            </div>
          )}
          {roll && <RollInfoCard roll={roll} online={online} />}
          {!searched && !busy && (
            <div className="glass-card p-6 text-muted text-sm">Scan a QR or enter a roll/film to see its details here.</div>
          )}
        </div>
      </div>
    </div>
  );
}
