import { useMemo } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { rawMaterialsDb } from '../../lib/db';
import { previewFifo, materialAvailable } from '../../lib/batches';
import { canViewCosts } from '../../lib/roles';
import { formatINR } from '../../lib/jobcard';
import { formatDate } from '../../lib/utils';
import type { MaterialUse } from '../../types/models';

// A quick-add suggestion: a material this stage typically uses, optionally with a
// suggested qty (e.g. ink auto-% of BOPP input).
export interface Suggestion { materialName: string; autoQty?: number; label?: string }

// Auto-FIFO material consumption. Enter ONE quantity for a material; the oldest
// batch drains first, flowing into newer batches, shown as per-batch cost lines.
// Consuming more than total available is flagged "insufficient stock" (blocked on
// save). Everything else about adding materials stays the same.
export function MaterialFifoPanel({ value, saved = [], onChange, suggestions = [], title = 'Materials — auto FIFO (oldest batch first), costed at each batch rate' }: {
  value: MaterialUse[];
  // Last-SAVED materials for this stage. batch.remaining already reflects these
  // takes, so the FIFO add-back / availability must use them — NOT the live
  // preview lines (which aren't deducted from stock until save re-runs sync).
  saved?: MaterialUse[];
  onChange: (next: MaterialUse[]) => void;
  suggestions?: Suggestion[];
  title?: string;
}) {
  const showCosts = canViewCosts();
  const materials = useMemo(() => rawMaterialsDb.getAll(), []);
  const savedOf = (materialId: string) => saved.find((m) => m.materialId === materialId);

  function setQty(materialId: string, qty: number) {
    const next = previewFifo(materialId, qty, savedOf(materialId));
    onChange([...value.filter((m) => m.materialId !== materialId), next]);
  }
  function addMaterial(materialId: string) {
    if (value.some((m) => m.materialId === materialId)) return;
    setQty(materialId, 0);
  }
  function removeMaterial(materialId: string) {
    onChange(value.filter((m) => m.materialId !== materialId));
  }

  const total = value.reduce((s, m) => s + (m.totalCost || 0), 0);

  const renderLine = (m: MaterialUse) => {
    const avail = materialAvailable(m.materialId, savedOf(m.materialId));
    const short = (m.shortfall ?? 0) > 0;
    return (
      <div key={m.materialId} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/85 text-sm font-medium flex-1 min-w-28">{m.materialName}</span>
          <input className="input-field font-mono w-24 py-1 text-sm" type="number" min="0" step="any"
            value={m.qty || ''} onChange={(e) => setQty(m.materialId, Math.max(0, parseFloat(e.target.value) || 0))} />
          <span className="text-muted text-xs w-8">{m.unit}</span>
          {showCosts && <span className="font-mono text-sm w-24 text-right">{m.totalCost > 0 ? formatINR(m.totalCost) : <span className="text-muted">—</span>}</span>}
          <button type="button" onClick={() => removeMaterial(m.materialId)} className="p-1 rounded hover:bg-red-500/20 text-muted hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* FIFO breakdown — one line per batch drained */}
        {m.qty > 0 && m.lines.length > 0 && (
          <div className="pl-1 space-y-0.5">
            {m.lines.map((l, i) => (
              <div key={l.batchId + i} className="flex items-center gap-2 text-[11px] font-mono text-muted">
                <span className="text-white/50">└</span>
                <span className="text-white/70">{l.take.toLocaleString('en-IN')} {m.unit}</span>
                <span>×</span>
                {l.rate == null ? <span className="text-yellow-300">no rate</span> : <span className="text-white/70">₹{l.rate.toLocaleString('en-IN')}</span>}
                <span className="text-white/30">·</span>
                <span>batch {formatDate(l.batchDate)}</span>
                {showCosts && l.rate != null && <span className="ml-auto text-white/60">{formatINR(l.cost)}</span>}
              </div>
            ))}
            {m.lines.length > 1 && (
              <p className="text-[11px] text-accent/80 pl-3">Split across {m.lines.length} batches (oldest first)</p>
            )}
          </div>
        )}

        {short && (
          <p className="text-[11px] text-red-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0" /> Insufficient stock: need {m.qty.toLocaleString('en-IN')} {m.unit}, have {avail.toLocaleString('en-IN')}.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-accent/10 overflow-hidden">
      <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide">{title}</div>
      <div className="p-3 space-y-2">
        {value.length === 0 && <p className="text-muted text-xs">No materials yet. Add one and enter the quantity — it drains the oldest batch first.</p>}

        {value.map(renderLine)}

        {/* Quick-add chips (ink/thread carry an auto qty) */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => {
              const m = materials.find((x) => x.name.trim().toLowerCase() === s.materialName.trim().toLowerCase());
              if (!m) return <span key={s.materialName} className="text-[11px] text-yellow-300/80 px-2 py-1">{s.materialName}: add it in Raw Materials</span>;
              const already = value.some((v) => v.materialId === m.id);
              return (
                <button key={s.materialName} type="button" disabled={already}
                  onClick={() => setQty(m.id, s.autoQty ?? 0)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30 text-accent hover:bg-primary/25 transition-colors flex items-center gap-1 disabled:opacity-40">
                  <Plus className="w-3 h-3" /> {s.label ?? s.materialName}{s.autoQty ? ` (${s.autoQty} ${m.unit})` : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* Add any other material */}
        <div className="flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-muted" />
          <select className="input-field py-1 text-sm w-auto" value="" onChange={(e) => { if (e.target.value) addMaterial(e.target.value); }}>
            <option value="">Add material…</option>
            {materials.filter((m) => !value.some((v) => v.materialId === m.id)).map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.quantity.toLocaleString('en-IN')} {m.unit} in stock)</option>
            ))}
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
