import { useMemo } from 'react';
import { AlertTriangle, Trash2, Plus } from 'lucide-react';
import { rawMaterialsDb, rawMaterialBatchesDb } from '../../lib/db';
import { allocateFifo, blendedRate, lotsCost } from '../../lib/batches';
import { canViewCosts } from '../../lib/roles';
import { formatINR } from '../../lib/jobcard';
import { formatDate } from '../../lib/utils';
import type { Consumption } from '../../types/models';

// Preview the FIFO draw for a quantity without committing it, so the operator
// sees which batches (and rates) a quantity will consume as they type. The
// authoritative allocation is recomputed by syncBatchStock() on save.
export function previewAllocation(materialId: string, qty: number, existing?: Consumption): Consumption {
  const mat = rawMaterialsDb.getAll().find((m) => m.id === materialId);
  // Work on copies so previewing never mutates stored remainders.
  const pool = rawMaterialBatchesDb.forItem(materialId).map((b) => ({ ...b }));
  // Un-consume THIS row's own prior draw before re-allocating. The stored
  // `remaining` on each batch already has this card's previous consumption
  // subtracted, so without adding it back an edit would see the batches its own
  // earlier save emptied — the FIFO draw would stop at the first batch and never
  // roll into the next. Adding it back makes the preview match the authoritative
  // recompute (syncBatchStock), which resets all remainders before replaying.
  for (const l of existing?.lots ?? []) {
    const b = pool.find((x) => x.id === l.batchId);
    if (b) b.remaining = Math.round((b.remaining + (l.qty || 0)) * 1000) / 1000;
  }
  const priorRates = new Map((existing?.lots ?? []).map((l) => [l.batchId, l.rate]));
  const { lots, shortfall } = allocateFifo(qty, pool, priorRates);
  return {
    materialId,
    materialName: mat?.name ?? existing?.materialName ?? '',
    unit: mat?.unit ?? existing?.unit ?? 'kg',
    qty,
    lots,
    shortfall: shortfall || undefined,
    rateSnapshot: blendedRate(lots),
    lineCost: lotsCost(lots),
    source: 'batch',
  };
}

// One material line: quantity in, FIFO batch breakdown out. When a quantity
// spans two batches, each batch shows as its own priced sub-line.
export function MaterialLine({ row, onQty, onRemove, readOnlyQty, label, hint }: {
  row: Consumption;
  onQty: (qty: number) => void;
  onRemove?: () => void;
  readOnlyQty?: boolean;
  label?: string;
  hint?: string;
}) {
  const showCosts = canViewCosts();
  const lots = row.lots ?? [];
  const split = lots.length > 1;
  const unpriced = row.qty > 0 && (row.rateSnapshot == null || (row.shortfall ?? 0) > 0);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-white/85 text-sm font-medium flex-1 min-w-28">{label ?? row.materialName}</span>
        <input className="input-field font-mono w-24 py-1 text-sm" type="number" min="0" step="any"
          value={row.qty || ''} readOnly={readOnlyQty} onChange={(e) => onQty(Math.max(0, parseFloat(e.target.value) || 0))} />
        <span className="text-muted text-xs w-10">{row.unit}</span>
        {showCosts && (
          <span className="font-mono text-sm w-24 text-right">
            {row.lineCost > 0 ? <span className="text-white/85">{formatINR(row.lineCost)}</span> : <span className="text-muted">—</span>}
          </span>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-red-500/20 text-muted hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {hint && <p className="text-muted text-[11px]">{hint}</p>}

      {/* FIFO breakdown — one line per batch consumed */}
      {row.qty > 0 && lots.length > 0 && (
        <div className="pl-1 space-y-0.5">
          {lots.map((l, i) => (
            <div key={l.batchId + i} className="flex items-center gap-2 text-[11px] font-mono text-muted">
              <span className="text-white/50">└</span>
              <span className="text-white/70">{l.qty.toLocaleString('en-IN')} {row.unit}</span>
              <span>×</span>
              {l.rate == null
                ? <span className="text-yellow-300">rate not set</span>
                : <span className="text-white/70">₹{l.rate.toLocaleString('en-IN')}</span>}
              <span className="text-white/30">·</span>
              <span>batch {formatDate(l.batchDate)}</span>
              {showCosts && l.rate != null && <span className="ml-auto text-white/60">{formatINR(l.lineCost)}</span>}
            </div>
          ))}
          {split && row.rateSnapshot != null && (
            <p className="text-[11px] text-muted pl-3">Effective ₹{row.rateSnapshot.toLocaleString('en-IN')}/{row.unit} across {lots.length} batches</p>
          )}
        </div>
      )}

      {(row.shortfall ?? 0) > 0 && (
        <p className="text-[11px] text-red-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {row.shortfall!.toLocaleString('en-IN')} {row.unit} not covered by any batch — receive more stock.
        </p>
      )}
      {unpriced && (row.shortfall ?? 0) === 0 && (
        <p className="text-[11px] text-yellow-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Rate not set on the consumed batch — excluded from cost totals.
        </p>
      )}
    </div>
  );
}

// Picker to add another raw material line to a stage.
export function AddMaterial({ exclude, onAdd }: { exclude: string[]; onAdd: (materialId: string) => void }) {
  const options = useMemo(
    () => rawMaterialsDb.getAll().filter((m) => !exclude.includes(m.id)),
    [exclude],
  );
  if (!options.length) return null;
  return (
    <div className="flex items-center gap-2">
      <Plus className="w-3.5 h-3.5 text-muted" />
      <select className="input-field py-1 text-sm w-auto" value=""
        onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}>
        <option value="">Add material…</option>
        {options.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.quantity.toLocaleString('en-IN')} {m.unit} in stock)</option>)}
      </select>
    </div>
  );
}
