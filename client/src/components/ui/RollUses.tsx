import { useState, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { invRollsDb, boppFilmsDb } from '../../lib/db';
import { canViewCosts } from '../../lib/roles';
import { formatINR } from '../../lib/jobcard';
import { CommitNumberInput } from './CommitNumberInput';
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
  const [filter, setFilter] = useState('');   // search box for the roll/film picker

  // Rolls already committed by this card stay selectable so the line can be edited.
  const stock = useMemo(() => {
    const out: { key: string; kind: 'roll' | 'film'; id: string; no: string; label: string; available: number; rate: number | null; type?: string; size?: string; gm?: number }[] = [];
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
          const over = u.qtyKg > available + 0.001;
          return (
            <div key={u.rollId + i} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
              {/* Compact identity — BOPP: size · type · roll no · qty · rate;
                  Roll: size · gm · type · roll no · qty · rate. (digits+unit, no "size" word) */}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-mono text-white/90">{fmtSize(u.size)}</span>
                {u.kind === 'roll' && <span className="text-muted text-xs">{u.gm ?? '—'} GM</span>}
                {u.type && <span className="text-muted text-xs">{u.type}</span>}
                <span className="font-mono text-accent">{u.rollNo}</span>
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
                  <AlertTriangle className="w-3 h-3" /> More than this roll holds ({available} kg).
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input className="input-field pl-9 py-1.5 text-sm" placeholder="Search stock by roll no, size, type or GM…"
                  value={filter} onChange={(e) => setFilter(e.target.value)} />
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
    </div>
  );
}
