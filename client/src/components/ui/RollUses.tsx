import { useState, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2, Search, QrCode, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { invRollsDb, boppFilmsDb } from '../../lib/db';
import { canViewCosts } from '../../lib/roles';
import { currentUser } from '../../lib/auth';
import { formatINR } from '../../lib/jobcard';
import { CommitNumberInput } from './CommitNumberInput';
import { RollScanModal } from './ScanRollButton';
import type { RollUse } from '../../types/models';
import type { Finish } from '../../config';

// Size shown as digits + unit (never the word "size"). A bare number gets "mm"
// (roll/film sizes are in mm); sizes that already carry a unit (e.g. "2.5 inch")
// are left as-is.
function fmtSize(size?: string): string {
  const s = (size ?? '').trim();
  if (!s) return '—';
  return /^\d+(\.\d+)?$/.test(s) ? `${s}mm` : s;
}

type StockItem = { key: string; kind: 'roll' | 'film'; id: string; no: string; label: string; available: number; rate: number | null; type?: string; size?: string; gm?: number };

// Per-roll consumption. Every roll used gets its OWN line showing its roll no,
// its own rate and whether it was finished or left with a balance — two rolls
// never share a line. Stock is committed on save.
export function RollUsesPanel({ value, onChange, kinds = ['roll', 'film'], filmFinishes, title = 'Roll consumption' }: {
  value: RollUse[];
  onChange: (next: RollUse[]) => void;
  kinds?: ('roll' | 'film')[];
  filmFinishes?: Finish[];   // when set, only films with these finishes are selectable (e.g. Metalize → Metalized, Printing → Matte/Glossy)
  title?: string;
}) {
  const showCosts = canViewCosts();
  // What this picker consumes — drives the scan button/modal wording (roll, film, or both).
  const scanNoun = kinds.includes('roll') && kinds.includes('film') ? 'roll / film' : kinds.includes('film') ? 'film' : 'roll';
  const [filter, setFilter] = useState('');   // search box for the roll/film picker
  const [scanOpen, setScanOpen] = useState(false);
  // A scanned roll/film awaiting confirmation — pre-filled, NOT yet added to consumption
  // (Parts 2–3). Nothing is added, and no stock changes, until the user confirms.
  const [pending, setPending] = useState<null | { s: StockItem; dup: boolean; qty: number; finished: boolean }>(null);

  // Scan-to-select: resolve the scanned roll/film by id in THIS picker's available stock,
  // then PRE-FILL a confirmation line (whole item by default). The user confirms to add it
  // (or edits/cancels). A re-scan of an item already on the stage is flagged as a duplicate
  // but still allowed. Selection only — stock changes on job-card save, never on scan.
  function selectByScan(parsed: { id: string; token: string }) {
    setScanOpen(false);
    const s = stock.find((x) => x.id === parsed.id);
    if (!s) { toast.error('That code isn’t selectable here — not in this stage’s available stock (dispatched, in transit, or a different item type).'); return; }
    const dup = value.some((u) => u.rollId === s.id);
    setPending({ s, dup, qty: s.available, finished: true });
    if (dup) toast('⚠️ Already added to this stage — confirm to add another, or cancel.', { icon: '⚠️' });
  }
  // Confirm the scanned line → add it as a normal consumption row (scan-tagged).
  function confirmPending() {
    if (!pending) return;
    const { s, finished } = pending;
    const qty = finished ? s.available : Math.max(0, pending.qty);
    onChange([...value, {
      rollId: s.id, rollNo: s.no, kind: s.kind, type: s.type, size: s.size, gm: s.gm,
      qtyKg: qty, rate: s.rate, lineCost: s.rate != null ? +(qty * s.rate).toFixed(2) : 0,
      finished, balanceKg: finished ? 0 : Math.max(0, s.available - qty),
      scannedAt: new Date().toISOString(), scannedBy: currentUser()?.name,
    }]);
    setPending(null);
    toast.success(`${s.no} added to consumption`);
  }

  // Rolls already committed by this card stay selectable so the line can be edited.
  const stock = useMemo(() => {
    const out: StockItem[] = [];
    if (kinds.includes('roll')) {
      for (const r of invRollsDb.getAll().filter((x) => !x.dispatched && !x.inTransit)) {
        out.push({ key: `roll:${r.id}`, kind: 'roll', id: r.id, no: r.rollNo, label: `${r.rollNo} · ${r.type}`, available: r.nWt, rate: r.rate ?? null, type: r.type, size: r.size, gm: r.gm });
      }
    }
    if (kinds.includes('film')) {
      for (const f of boppFilmsDb.getAll().filter((x) =>
        (!x.balanceUsed || (x.nWt ?? x.kg) > 0) &&
        (!filmFinishes || (x.finish != null && filmFinishes.includes(x.finish))))) {
        out.push({ key: `film:${f.id}`, kind: 'film', id: f.id, no: f.filmNo, label: `${f.filmNo} · ${f.finish ?? 'film'}`, available: f.nWt ?? f.kg, rate: f.rate ?? null, type: f.finish, size: f.size, gm: f.gm });
      }
    }
    return out;
  }, [kinds, filmFinishes]);

  function addRoll(key: string) {
    const s = stock.find((x) => x.key === key);
    if (!s) return;
    if (value.some((u) => u.rollId === s.id)) { toast.error(`${s.label} is already on this stage`); return; }
    onChange([...value, {
      rollId: s.id, rollNo: s.no, kind: s.kind, type: s.type, size: s.size, gm: s.gm,
      qtyKg: 0, rate: s.rate, lineCost: 0, finished: false, balanceKg: s.available,
    }]);
    setFilter('');
  }

  function patch(i: number, p: Partial<RollUse>) {
    onChange(value.map((u, j) => {
      if (j !== i) return u;
      const next = { ...u, ...p };
      next.lineCost = next.rate != null ? +(next.qtyKg * next.rate).toFixed(2) : 0;
      return next;
    }));
  }

  return (
    <div className="rounded-lg border border-accent/10 overflow-hidden">
      <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide">{title}</div>
      <div className="p-3 space-y-2">
        {value.length === 0 && <p className="text-muted text-xs">No rolls added yet. Each roll used gets its own line.</p>}

        {value.map((u, i) => {
          const src = stock.find((s) => s.id === u.rollId);
          const available = src?.available ?? 0;
          // Over-consumption is checked against the TOTAL used for this roll across all its
          // lines (a roll can appear on more than one line after a confirmed duplicate scan).
          const lineCount = value.filter((v) => v.rollId === u.rollId).length;
          const usedForRoll = value.reduce((sum, v) => sum + (v.rollId === u.rollId ? (v.qtyKg || 0) : 0), 0);
          const over = usedForRoll > available + 0.001;
          return (
            <div key={u.rollId + i} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
              {/* Compact identity — BOPP: size · type · roll no · qty · rate;
                  Roll: size · gm · type · roll no · qty · rate. (digits+unit, no "size" word) */}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-mono text-white/90">{fmtSize(u.size)}</span>
                {u.kind === 'roll' && <span className="text-muted text-xs">{u.gm ?? '—'} GM</span>}
                {u.type && <span className="text-muted text-xs">{u.type}</span>}
                <span className="font-mono text-accent">{u.rollNo}</span>
                {u.scannedAt && (
                  <span title={`Selected by scan${u.scannedBy ? ` · ${u.scannedBy}` : ''} · ${new Date(u.scannedAt).toLocaleString('en-IN')}`}
                    className="inline-flex items-center gap-1 badge bg-primary/15 text-accent border border-primary/30 text-[10px]">
                    <QrCode className="w-3 h-3" /> scanned
                  </span>
                )}
                <span className="text-muted text-xs">{available.toLocaleString('en-IN')}kg</span>
                <span className="text-muted text-xs">{u.rate == null ? '—' : `₹${u.rate.toLocaleString('en-IN')}`}</span>
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="ml-auto p-1 rounded hover:bg-red-500/20 text-muted hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="label !text-[10px]">Used (kg)</label>
                  <CommitNumberInput className="input-field font-mono py-1 text-sm"
                    value={u.qtyKg} onCommit={(v) => patch(i, { qtyKg: v })} />
                </div>
                <div>
                  <label className="label !text-[10px]">Rate (₹/kg)</label>
                  <div className="font-mono text-sm py-1.5">
                    {u.rate == null
                      ? <span className="badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px]">not set</span>
                      : <span className="text-white/85">₹{u.rate.toLocaleString('en-IN')}</span>}
                  </div>
                </div>
                <div>
                  <label className="label !text-[10px]">After this run</label>
                  <div className="flex gap-1">
                    {([[false, 'Balance'], [true, 'Finished']] as const).map(([val, lbl]) => (
                      <button key={lbl} type="button"
                        onClick={() => patch(i, val
                          // Finished → the whole roll/film is used: auto-fill qty with its full weight.
                          ? { finished: true, qtyKg: available, balanceKg: 0 }
                          // Balance → keep the manually-entered qty; remaining stays in stock.
                          : { finished: false, balanceKg: Math.max(0, available - u.qtyKg) })}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${u.finished === val ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white'}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                {showCosts && (
                  <div>
                    <label className="label !text-[10px]">Line cost</label>
                    <div className="font-mono text-sm py-1.5 text-white/85">{u.lineCost > 0 ? formatINR(u.lineCost) : '—'}</div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted flex items-center gap-1.5">
                {u.finished
                  ? <><CheckCircle2 className="w-3 h-3 text-green-400" /> Roll fully used — moves to Finished Rolls on save.</>
                  : <>Balance {Math.max(0, available - u.qtyKg).toLocaleString('en-IN')} kg stays in stock.</>}
              </p>
              {over && (
                <p className="text-[11px] text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> {lineCount > 1
                    ? `Total used across ${lineCount} lines (${usedForRoll.toLocaleString('en-IN')} kg) exceeds this roll’s stock (${available} kg).`
                    : `More than this roll holds (${available} kg).`}
                </p>
              )}
              {u.rate == null && u.qtyKg > 0 && (
                <p className="text-[11px] text-yellow-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> This roll has no rate — excluded from cost totals.
                </p>
              )}
            </div>
          );
        })}

        {/* Scanned item — pre-filled, confirm to add (Parts 2–3). Nothing is added to
            consumption, and no stock changes, until the user confirms. */}
        {pending && (
          <div className="rounded-lg border border-primary/40 bg-primary/[0.07] p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <ScanLine className="w-4 h-4 text-accent" />
              <span className="text-accent font-semibold">Scanned {pending.s.kind === 'film' ? 'BOPP film' : 'roll'} — confirm to add</span>
            </div>
            {pending.dup && (
              <p className="text-[11px] text-yellow-300 flex items-start gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                This {pending.s.kind === 'film' ? 'film' : 'roll'} is already added to this stage. Confirm again to add another line, or cancel.
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="font-mono text-white/90">{fmtSize(pending.s.size)}</span>
              {pending.s.kind === 'roll' && <span className="text-muted text-xs">{pending.s.gm ?? '—'} GM</span>}
              {pending.s.type && <span className="text-muted text-xs">{pending.s.type}</span>}
              <span className="font-mono text-accent">{pending.s.no}</span>
              <span className="text-muted text-xs">{pending.s.available.toLocaleString('en-IN')}kg in stock</span>
              <span className="text-muted text-xs">{pending.s.rate == null ? 'no rate' : `₹${pending.s.rate.toLocaleString('en-IN')}`}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
              <div>
                <label className="label !text-[10px]">Used (kg)</label>
                <CommitNumberInput className="input-field font-mono py-1 text-sm" value={pending.qty}
                  onCommit={(v) => setPending((p) => p && ({ ...p, qty: v, finished: v >= p.s.available - 0.001 }))} />
              </div>
              <div>
                <label className="label !text-[10px]">After this run</label>
                <div className="flex gap-1">
                  {([[false, 'Balance'], [true, 'Finished']] as const).map(([val, lbl]) => (
                    <button key={lbl} type="button"
                      onClick={() => setPending((p) => p && ({ ...p, finished: val, qty: val ? p.s.available : p.qty }))}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${pending.finished === val ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setPending(null)} className="btn-secondary flex-1 justify-center text-sm py-1.5">Cancel</button>
              <button type="button" onClick={confirmPending} className="btn-primary flex-1 justify-center text-sm py-1.5">
                <Plus className="w-4 h-4" /> {pending.dup ? 'Add another line' : 'Add to consumption'}
              </button>
            </div>
            <p className="text-[11px] text-muted">Stock isn’t affected until the job card is saved.</p>
          </div>
        )}

        {/* Searchable picker — filter stock by roll no, size, type or GM instead of
            scrolling a long dropdown, then click to add. */}
        {(() => {
          const avail = stock.filter((s) => !value.some((u) => u.rollId === s.id));
          const tokens = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
          const matches = tokens.length
            ? avail.filter((s) => {
                const hay = `${s.no} ${fmtSize(s.size)} ${s.size ?? ''} ${s.type ?? ''} ${s.gm ?? ''} ${s.kind}`.toLowerCase();
                return tokens.every((t) => hay.includes(t));   // every word must match (roll no / size / type / GM)
              })
            : avail;
          return (
            <div className="pt-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input className="input-field pl-9 py-1.5 text-sm w-full" placeholder="Search stock by roll no, size, type or GM…"
                    value={filter} onChange={(e) => setFilter(e.target.value)} />
                </div>
                {/* Scan-to-select — pre-fills the line from a roll/film QR; search stays available. */}
                <button type="button" onClick={() => setScanOpen(true)} title={`Scan a ${scanNoun} QR to select it`}
                  className="btn-secondary py-1.5 shrink-0"><ScanLine className="w-4 h-4" /> Scan</button>
              </div>
              {avail.length === 0 ? (
                <p className="text-muted text-xs">No more stock available to add.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                  {matches.length === 0 ? (
                    <p className="text-muted text-xs px-3 py-2">No stock matches “{filter}”.</p>
                  ) : matches.map((s) => (
                    <button key={s.key} type="button" onClick={() => addRoll(s.key)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-primary/10 transition-colors">
                      <Plus className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span className="font-mono text-white/90">{fmtSize(s.size)}</span>
                      {s.kind === 'roll' && <span className="text-muted text-xs">{s.gm ?? '—'}GM</span>}
                      <span className="text-muted text-xs">{s.type ?? (s.kind === 'film' ? 'film' : '')}</span>
                      <span className="font-mono text-accent">{s.no}</span>
                      <span className="ml-auto text-muted text-xs whitespace-nowrap">{s.available.toLocaleString('en-IN')}kg{s.rate == null ? ' · no rate' : ` · ₹${s.rate}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {scanOpen && (
        <RollScanModal
          title={`Scan a ${scanNoun} to select`}
          hint={`Point the camera at a ${scanNoun} QR label. It pre-fills a line to confirm — stock isn’t changed until you save.`}
          onClose={() => setScanOpen(false)}
          onDecode={selectByScan}
        />
      )}
    </div>
  );
}
