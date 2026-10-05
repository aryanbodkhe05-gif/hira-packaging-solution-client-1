import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, AlertTriangle, Camera, CameraOff } from 'lucide-react';
import { Modal } from './Modal';
import { parseRollScanUrl } from '../../lib/rolls';
import { cn } from '../../lib/utils';

const READER_ID = 'roll-qr-reader';
const LIVE_READER_ID = 'roll-qr-live-reader';

function cameraErrorMessage(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) return 'Camera permission denied — allow camera access and try again.';
  if (msg.includes('notfound') || msg.includes('no camera') || msg.includes('devices')) return 'No camera found on this device.';
  if (msg.includes('secure') || msg.includes('https')) return 'Camera needs a secure (https) connection.';
  return 'Could not start the camera. Try again, or type the roll in manually.';
}

// A live-camera QR scanner that, on decoding a roll label, opens that roll's scan-result
// page in-app. Decode-only — it never writes to stock. Manual search/dropdowns stay the
// primary way in; this is an added entry point.
export function ScanRollButton({ className, label = 'Scan a roll' }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? 'btn-secondary'}>
        <QrCode className="w-4 h-4" /> {label}
      </button>
      {open && (
        <RollScanModal
          onClose={() => setOpen(false)}
          onDecode={(p) => { setOpen(false); nav(`/scan/${p.kind}/${encodeURIComponent(p.id)}?t=${encodeURIComponent(p.token)}`); }}
        />
      )}
    </>
  );
}

// Reusable camera scan modal. Calls `onDecode({id, token})` once, on the first frame
// that decodes a valid roll-label URL — nothing else fires, and it never writes stock.
// Phase 2 uses it to navigate; Phase 3 uses it to fill a roll-selection field.
export function RollScanModal({ onDecode, onClose, title = 'Scan a roll QR', hint }: {
  onDecode: (parsed: { kind: 'roll' | 'film'; id: string; token: string }) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
}) {
  const [err, setErr] = useState('');
  const handledRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(READER_ID, /* verbose */ false);

    const stop = async () => {
      try { if (scanner.isScanning) await scanner.stop(); } catch { /* ignore */ }
      try { scanner.clear(); } catch { /* ignore */ }
    };

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (handledRef.current) return;              // first good decode wins
          const parsed = parseRollScanUrl(decodedText);
          if (!parsed) { setErr('That’s not a Hira roll QR code.'); return; }
          handledRef.current = true;
          stop().finally(() => onDecode(parsed));
        },
        () => { /* per-frame decode misses — ignore */ },
      )
      .catch((e) => setErr(cameraErrorMessage(e)));

    return () => { void stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <div className="space-y-3">
        <div id={READER_ID} className={cn('w-full min-h-[240px] rounded-lg overflow-hidden bg-black/40 grid place-items-center', '[&_video]:rounded-lg')} />
        {err
          ? <p className="text-red-300 text-sm flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> {err}</p>
          : <p className="text-muted text-xs">{hint ?? 'Point the camera at a roll’s printed QR label. It never changes stock.'}</p>}
        <button onClick={onClose} className="btn-secondary w-full justify-center">Cancel</button>
      </div>
    </Modal>
  );
}

// Persistent inline camera scanner (for the Scanner info view). Start it once and it
// keeps scanning: every decoded roll/film label fires `onScan` immediately (the same
// code is ignored for a couple of seconds so one label doesn't fire repeatedly).
export function LiveRollScanner({ onScan }: { onScan: (parsed: { kind: 'roll' | 'film'; id: string; token: string }) => void }) {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const last = useRef<{ id: string; at: number }>({ id: '', at: 0 });

  useEffect(() => {
    if (!on) return;
    setErr('');
    const scanner = new Html5Qrcode(LIVE_READER_ID, false);
    const stop = async () => {
      try { if (scanner.isScanning) await scanner.stop(); } catch { /* ignore */ }
      try { scanner.clear(); } catch { /* ignore */ }
    };
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          const parsed = parseRollScanUrl(decodedText);
          if (!parsed) return;
          const now = Date.now();
          if (parsed.id === last.current.id && now - last.current.at < 2500) return;   // debounce same label
          last.current = { id: parsed.id, at: now };
          onScan(parsed);
        },
        () => { /* per-frame misses — ignore */ },
      )
      .catch((e) => { setErr(cameraErrorMessage(e)); setOn(false); });
    return () => { void stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOn((v) => !v)} className={on ? 'btn-secondary' : 'btn-primary'}>
        {on ? <><CameraOff className="w-4 h-4" /> Stop camera</> : <><Camera className="w-4 h-4" /> Scan with camera</>}
      </button>
      {on && <div id={LIVE_READER_ID} className={cn('w-full max-w-sm min-h-[240px] rounded-lg overflow-hidden bg-black/40 grid place-items-center', '[&_video]:rounded-lg')} />}
      {on && !err && <p className="text-muted text-xs">Camera on — scan any roll or BOPP film QR; its info opens below automatically.</p>}
      {err && <p className="text-red-300 text-sm flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> {err}</p>}
    </div>
  );
}
