import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ppGranulesDb } from '../../lib/db';
import { granuleTypeHex } from '../../config';
import type { GranuleUse, PPGranuleItem } from '../../types/models';
import { cn } from '../../lib/utils';

const toNum = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

// Granule consumption rows (type · item + kg). On the parent's save these are
// deducted from P.P. Granule stock via applyGranuleUses. `origByItem` is the
// qty this record already booked (so editing doesn't false-fail the balance).
export function GranuleUsesEditor({ value, onChange, origByItem = {} }: {
  value: GranuleUse[];
  onChange: (uses: GranuleUse[]) => void;
  origByItem?: Record<string, number>;
}) {
  const items = useMemo<PPGranuleItem[]>(() => ppGranulesDb.getAll(), []);
  const uses = value ?? [];
  const availableFor = (id: string) => (items.find((g) => g.id === id)?.currentStockKg ?? 0) + (origByItem[id] ?? 0);

  const setUse = (i: number, patch: Partial<GranuleUse>) => { const a = [...uses]; a[i] = { ...a[i], ...patch }; onChange(a); };
  const pick = (i: number, id: string) => { const it = items.find((g) => g.id === id); setUse(i, { itemId: id, itemName: it?.name ?? '', type: it?.type ?? 'P.P.' }); };
  const total = uses.reduce((s, u) => s + (u.qtyKg || 0), 0);

  return (
    <div className="rounded-lg border border-accent/10 p-3 space-y-2">
      <p className="label !mb-1">Granules used (deducts from P.P. Granule stock)</p>
      {items.length === 0 && <p className="text-red-300 text-xs">No granule items — add some in Inventory → P.P. Granule first.</p>}
      {uses.map((u, i) => {
        const avail = u.itemId ? availableFor(u.itemId) : 0;
        const over = u.itemId && u.qtyKg > avail + 1e-6;
        return (
          <div key={i} className="flex gap-2 items-start">
            <select className="input-field flex-1" value={u.itemId} onChange={(e) => pick(i, e.target.value)}>
              <option value="">Select granule…</option>
              {items.map((g) => <option key={g.id} value={g.id}>{g.type} · {g.name} — {g.currentStockKg.toLocaleString('en-IN')}kg</option>)}
            </select>
            <div className="w-24">
              <input className={cn('input-field font-mono text-right', over && 'border-red-500/60')} type="number" min="0" step="any"
                value={u.qtyKg || ''} onChange={(e) => setUse(i, { qtyKg: toNum(e.target.value) })} placeholder="kg" />
              {u.itemId && <p className={cn('text-[10px] mt-0.5', over ? 'text-red-300' : 'text-muted')}>avail {avail.toLocaleString('en-IN')}kg</p>}
            </div>
            <button type="button" onClick={() => onChange(uses.filter((_, j) => j !== i))} className="p-2 rounded hover:bg-red-500/20 text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        );
      })}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onChange([...uses, { itemId: '', itemName: '', type: 'P.P.', qtyKg: 0 }])} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add granule</button>
        {total > 0 && <span className="text-xs font-mono text-white/80">total {total.toLocaleString('en-IN')} kg</span>}
      </div>
      {uses.some((u) => u.type) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(uses.reduce((m, u) => { if (u.qtyKg) m[u.type] = (m[u.type] || 0) + u.qtyKg; return m; }, {} as Record<string, number>)).map(([t, v]) => (
            <span key={t} className="flex items-center gap-1 text-[11px]"><span className="w-2 h-2 rounded-full" style={{ background: granuleTypeHex(t) }} /><span className="text-muted">{t}</span><span className="font-mono text-white/80">{v}kg</span></span>
          ))}
        </div>
      )}
    </div>
  );
}
