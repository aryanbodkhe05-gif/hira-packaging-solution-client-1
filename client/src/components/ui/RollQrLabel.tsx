import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { Printer, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { scanUrl, COMPANY, type ScanKind } from '../../config';

// The subset of a roll (InvRoll / UnitRoll) or BOPP film a QR label needs.
export interface RollLabelData {
  id: string;
  kind?: ScanKind;    // 'roll' (default) or 'film' — sets the scan URL path
  rollNo?: string;
  type?: string;
  size?: string;
  gm?: number;
  qrToken?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string));
}

// Printable QR label for a roll: a scannable QR (error-correction M) over the roll's
// human-readable number + type/size. Rendered entirely in the browser (no backend).
// Printing opens an isolated window containing only the label, so it prints clean on a
// thermal printer regardless of the app's own print CSS.
export function RollQrLabel({ roll, onRegenerate }: { roll: RollLabelData; onRegenerate?: () => void }) {
  const [dataUrl, setDataUrl] = useState('');
  const token = roll.qrToken ?? '';
  const url = token ? scanUrl(roll.kind ?? 'roll', roll.id, token) : '';
  const rollNo = (roll.rollNo ?? '').trim() || '(no roll no)';
  const desc = [roll.type, roll.size, roll.gm != null ? `${roll.gm} GM` : ''].filter(Boolean).join('  ·  ');

  useEffect(() => {
    if (!url) { setDataUrl(''); return; }
    let alive = true;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 260 })
      .then((d) => { if (alive) setDataUrl(d); })
      .catch(() => { if (alive) setDataUrl(''); });
    return () => { alive = false; };
  }, [url]);

  const handlePrint = useCallback(() => {
    if (!dataUrl) { toast.error('QR not ready yet — try again in a moment'); return; }
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) { toast.error('Allow pop-ups to print the label'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Roll ${escapeHtml(rollNo)}</title>
      <style>
        @page { margin: 6mm; }
        html,body { margin:0; padding:0; }
        body { font-family: ui-monospace, Menlo, Consolas, monospace; text-align:center; color:#000; padding:10px; }
        img { width:200px; height:200px; image-rendering:pixelated; }
        .no { font-size:20px; font-weight:700; margin-top:6px; letter-spacing:.5px; }
        .desc { font-size:12px; margin-top:3px; }
        .co { font-size:10px; margin-top:8px; color:#333; }
      </style></head>
      <body>
        <img src="${dataUrl}" alt="QR"/>
        <div class="no">${escapeHtml(rollNo)}</div>
        <div class="desc">${escapeHtml(desc || '—')}</div>
        <div class="co">${escapeHtml(COMPANY.shortName)}</div>
        <script>window.onload=function(){setTimeout(function(){window.focus();window.print();},150);};<\/script>
      </body></html>`);
    w.document.close();
  }, [dataUrl, rollNo, desc]);

  if (!token) return <p className="text-muted text-sm">No QR token on this roll yet.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-accent/15 bg-white p-4">
        {dataUrl
          ? <img src={dataUrl} alt={`QR for ${rollNo}`} className="w-48 h-48" />
          : <div className="w-48 h-48 grid place-items-center text-gray-400 text-xs">generating…</div>}
        <div className="text-black font-mono font-bold text-lg">{rollNo}</div>
        <div className="text-gray-600 text-xs">{desc || '—'}</div>
      </div>
      <p className="text-muted text-[11px] break-all">Scans to: {url}</p>
      <div className="flex gap-3">
        <button type="button" onClick={handlePrint} className="btn-primary flex-1 justify-center"><Printer className="w-4 h-4" /> Print QR label</button>
        {onRegenerate && <button type="button" onClick={onRegenerate} className="btn-secondary justify-center"><RefreshCw className="w-4 h-4" /> Regenerate QR</button>}
      </div>
      <p className="text-muted text-[11px]">Regenerating issues a new code — any label already printed for this roll stops resolving.</p>
    </div>
  );
}
