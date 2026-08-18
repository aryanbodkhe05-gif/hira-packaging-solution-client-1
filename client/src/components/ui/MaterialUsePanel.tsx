import { useMemo } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { rawMaterialsDb } from '../../lib/db';
import { previewMaterial, materialPoolAvailable } from '../../lib/materials';
import { canViewCosts } from '../../lib/roles';
import { formatINR } from '../../lib/jobcard';
import { CommitNumberInput } from './CommitNumberInput';
import type { MaterialUse } from '../../types/models';

// A quick-add suggestion: a material this stage typically uses, optionally with a
// suggested qty (e.g. ink auto-% of BOPP input).
export interface Suggestion { materialName: string; autoQty?: number; label?: string }

// Simple moving-average material consumption. For each material the worker enters
// ONE quantity used; it is auto-costed at the material's current average rate and
// deducted from its pool. No batch picking, no per-batch lines. Consuming more than
// the rated stock on hand is flagged "insufficient stock" (blocked on save).
export function MaterialUsePanel({ value, saved = [], onChange, suggestions = [], title = 'Materials — auto-costed at the moving-average rate' }: {
  value: MaterialUse[];
  // Last-SAVED materials for this stage. The pool already reflects these draws, so
  // the availability check adds them back — the worker can edit a line without its
  // own saved quantity showing as gone.
  saved?: MaterialUse[];
  onChange: (next: MaterialUse[]) => void;
  suggestions?: Suggestion[];
  title?: string;
}) {
  const showCosts = canViewCosts();
  const materials = useMemo(() => rawMaterialsDb.getAll(), []);
  const savedOf = (materialId: string) => saved.find((m) => m.materialId === materialId);

  function setQty(materialId: string, qty: number) {
    const next = previewMaterial(materialId, qty, savedOf(materialId));
    // Preserve the row's position (replace in place); appending on every keystroke
    // re-ordered the list and cost the qty input its focus after one digit.
    onChange(value.some((m) => m.materialId === materialId)
      ? value.map((m) => (m.materialId === materialId ? next : m))
      : [...value, next]);
  }
  function addMaterial(materialId: string) {
    if (value.some((m) => m.materialId === materialId)) return;
    setQty(materialId, 0);
  }
  function removeMaterial(materialId: string) {
    onChange(value.filter((m) => m.materialId !== materialId));
  }

  const total = value.reduce((s, m) => s + (m.cost || 0), 0);

  const renderLine = (m: MaterialUse) => {
    const avail = materialPoolAvailable(m.materialId, savedOf(m.materialId));
    const short = (m.shortfall ?? 0) > 0;
    return (
      <div key={m.materialId} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/85 text-sm font-medium flex-1 min-w-28">{m.materialName}</span>
          <CommitNumberInput className="input-field font-mono w-24 py-1 text-sm"
            value={m.qty} onCommit={(v) => setQty(m.materialId, v)} />
          <span className="text-muted text-xs w-8">{m.unit}</span>
          {showCosts && <span className="font-mono text-sm w-24 text-right">{m.cost > 0 ? formatINR(m.cost) : <span className="text-muted">—</span>}</span>}
          <button type="button" onClick={() => removeMaterial(m.materialId)} className="p-1 rounded hover:bg-red-500/20 text-muted hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Avg-rate applied — one line, no batch split */}
        {m.qty > 0 && (
          <div className="pl-1 flex items-center gap-2 text-[11px] font-mono text-muted">
            <span className="text-white/50">└</span>
            <span className="text-white/70">{m.qty.toLocaleString('en-IN')} {m.unit}</span>
            <span>×</span>
            {m.avgRate == null
              ? <span className="text-yellow-300">no rate (pool unpriced)</span>
              : <span className="text-white/70">₹{m.avgRate.toLocaleString('en-IN')}/{m.unit} avg</span>}
            {showCosts && m.avgRate != null && <span className="ml-auto text-white/60">{formatINR(m.cost)}</span>}
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
        {value.length === 0 && <p className="text-muted text-xs">No materials yet. Add one and enter the quantity — it is costed at the material's average rate.</p>}

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
              <option key={m.id} value={m.id}>{m.name} ({m.quantity.toLocaleString('en-IN')} {m.unit} in stock{m.avgRate != null ? ` @ ₹${m.avgRate}` : ''})</option>
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
