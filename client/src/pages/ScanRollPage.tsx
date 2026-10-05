import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { hydrateFromServer } from '../lib/db';
import { findRollScanView, type RollScanView } from '../lib/rolls';
import { RollInfoCard } from '../components/ui/RollInfoCard';

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

        {state === 'ok' && roll && <RollInfoCard roll={roll} online={online} />}
      </div>
    </div>
  );
}
