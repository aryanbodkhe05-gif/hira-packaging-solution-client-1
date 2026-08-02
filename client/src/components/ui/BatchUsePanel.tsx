import { useMemo } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { rawMaterialsDb, rawMaterialBatchesDb } from '../../lib/db';
import { fifoOrder } from '../../lib/batches';
import { canViewCosts } from '../../lib/roles';
import { formatINR } from '../../lib/jobcard';
import { formatDate } from '../../lib/utils';
import type { BatchUse } from '../../types/models';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// A quick-add suggestion: a material this stage typically uses, optionally with a
// suggested qty (e.g. ink auto-% of BOPP input).
export interface Suggestion { materialName: string; autoQty?: number; label?: string }

// Manual batch-pick material consumption — the same pattern as roll consumption.
// Each line = pick a material's batch (rate + remaining shown) + qty used. A
// second batch is another line. No auto-FIFO. Costed at each line's batch rate.
export function BatchUsePanel({ value, onChange, suggestions = [], title = 'Materials — pick a batch per line, costed at its rate' }: {
  value: BatchUse[];
  onChange: (next: BatchUse[]) => void;
  suggestions?: Suggestion[];
  title?: string;
}) {
  const showCosts = canViewCosts();
  const materials = useMemo(() => rawMaterialsDb.getAll(), []);
  const batchesFor = (materialId: string) => fifoOrder(rawMaterialBatchesDb.forItem(materialId));

  // Remaining available on a batch, adding back what THIS line already draws so an
  // edit doesn't see its own consumption as gone.
  function availableFor(batchId: string, lineQty: number): number {
    const b = rawMaterialBatchesDb.getAll().find((x) => x.id === batchId);
    if (!b) return 0;
    return +(b.remaining + (lineQty || 0)).toFixed(3);
  }

  function addLine(materialId: string, qty = 0) {
    const m = materials.find((x) => x.id === materialId);
    if (!m) return;
    const batches = batchesFor(materialId);
    const b = batches.find((x) => x.remaining > 0) ?? batches[0];
    onChange([...value, {
      id: genId(), materialId, materialName: m.name, unit: m.unit,
      batchId: b?.id ?? '', batchDate: b?.date, qty,
      rate: b?.rate ?? null, lineCost: b?.rate != null ? +(qty * b.rate).toFixed(2) : 0,
    }]);
  }

  function patch(i: number, p: Partial<BatchUse>) {
    onChange(value.map((u, j) => {
      if (j !== i) return u;
      const next = { ...u, ...p };
      // Re-snapshot rate/date when the batch changes.
      if (p.batchId != null && p.batchId !== u.batchId) {
        const b = rawMaterialBatchesDb.getAll().find((x) => x.id === p.batchId);
        next.rate = b?.rate ?? null;
        next.batchDate = b?.date;
      }
      next.lineCost = next.rate != null ? +(next.qty * next.rate).toFixed(2) : 0;
      return next;
    }));
  }

  const total = value.reduce((s, u) => s + (u.lineCost || 0), 0);
  const addable = materials;   // any raw material can be picked

  return (
    <div className="rounded-lg border border-accent/10 overflow-hidden">
      <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide">{title}</div>
      <div className="p-3 space-y-2">
        {value.length === 0 && <p className="text-muted text-xs">No material lines yet. Add one per batch used — pick the batch and enter the qty.</p>}

        {value.map((u, i) => {
          const batches = batchesFor(u.materialId);
          const avail = availableFor(u.batchId, u.qty);
          const over = u.qty > avail + 0.001;
          return (
            <div key={u.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white/85 text-sm font-medium">{u.materialName}</span>
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="ml-auto p-1 rounded hover:bg-red-500/20 text-muted hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div className="sm:col-span-2">
                  <label className="label !text-[10px]">Batch (oldest first)</label>
                  <select className="input-field py-1 text-sm" value={u.batchId} onChange={(e) => patch(i, { batchId: e.target.value })}>
                    {batches.length === 0 && <option value="">no batches</option>}
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {formatDate(b.date)} · {b.rate == null ? 'no rate' : `₹${b.rate}`} · {b.remaining.toLocaleString('en-IN')} {u.unit} left
                      </option>
                    ))}
                    {u.batchId && !batches.some((b) => b.id === u.batchId) && <option value={u.batchId}>previous batch</option>}
                  </select>
                </div>
                <div>
                  <label className="label !text-[10px]">Qty ({u.unit})</label>
                  <input className="input-field font-mono py-1 text-sm" type="number" min="0" step="any"
                    value={u.qty || ''} onChange={(e) => patch(i, { qty: Math.max(0, parseFloat(e.target.value) || 0) })} />
                </div>
                {showCosts && (
                  <div>
                    <label className="label !text-[10px]">Line cost</label>
                    <div className="font-mono text-sm py-1.5 text-white/85">{u.lineCost > 0 ? formatINR(u.lineCost) : '—'}</div>
                  </div>
                )}
              </div>
              {over && (
                <p className="text-[11px] text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> More than this batch holds ({avail} {u.unit} available).
                </p>
              )}
              {u.rate == null && u.qty > 0 && (
                <p className="text-[11px] text-yellow-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> This batch has no rate — excluded from cost totals.
                </p>
              )}
            </div>
          );
        })}

        {/* Quick-add chips for this stage's typical materials (ink/thread carry an auto qty) */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => {
              const m = materials.find((x) => x.name.trim().toLowerCase() === s.materialName.trim().toLowerCase());
              if (!m) return (
                <span key={s.materialName} className="text-[11px] text-yellow-300/80 px-2 py-1">
                  {s.materialName}: add it in Raw Materials
                </span>
              );
              return (
                <button key={s.materialName} type="button" onClick={() => addLine(m.id, s.autoQty ?? 0)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30 text-accent hover:bg-primary/25 transition-colors flex items-center gap-1">
                  <Plus className="w-3 h-3" /> {s.label ?? s.materialName}{s.autoQty ? ` (${s.autoQty} ${m.unit})` : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* Add any other material */}
        <div className="flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-muted" />
          <select className="input-field py-1 text-sm w-auto" value="" onChange={(e) => { if (e.target.value) addLine(e.target.value); }}>
            <option value="">Add material batch…</option>
            {addable.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.quantity.toLocaleString('en-IN')} {m.unit} in stock)</option>)}
          </select>
        </div>

        {showCosts && value.length > 0 && (
          <div className="flex justify-between border-t border-accent/20 pt-2 text-sm">
            <span className="text-muted text-xs">Stage material cost</span>
            <span className="font-mono text-white font-semibold">{formatINR(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
