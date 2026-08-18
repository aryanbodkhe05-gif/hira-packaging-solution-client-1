// ── Tape stock + moving-average costing (Unit 1 / Umay) ─────────────────────────
// Unit 1 buys tape instead of extruding it. Tape is stocked BY SIZE — each size is
// its own pool with one moving-average rate (from purchase rates). Loom entries
// consume tape (kg) from a size's pool; consumption is charged at the average and
// never changes it. Pools are derived live from receipts − loom consumption, so
// editing/deleting a loom entry adjusts stock automatically.

import { tapeReceiptsDb, loomEntriesDb } from './db';

const money = (n: number) => Math.round(n * 100) / 100;
const round = (n: number) => Math.round(n * 1000) / 1000;

export interface TapePool {
  size: string;
  qty: number;              // kg on hand = Σ receipts − Σ loom consumption
  avgRate: number | null;   // ₹/kg moving-average (weighted over rated receipts)
  value: number;            // qty × avgRate
  unratedQty: number;       // received without a rate (flagged, excluded from avg/value)
  receiptCount: number;
}

// Tape used (kg) per size across a unit's loom entries (optionally excluding one
// entry — for edit-safety so a line doesn't see its own draw as gone).
function consumedBySize(unitId: string, excludeEntryId?: string): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const e of loomEntriesDb.getAll()) {
    if ((e.unitId ?? 'unit-1') !== unitId) continue;
    if (excludeEntryId && e.id === excludeEntryId) continue;
    if (e.tapeSize && (e.tapeUsedKg || 0) > 0) acc[e.tapeSize] = round((acc[e.tapeSize] || 0) + (e.tapeUsedKg || 0));
  }
  return acc;
}

export function tapePools(unitId: string, excludeEntryId?: string): TapePool[] {
  const receipts = tapeReceiptsDb.getAll().filter((r) => r.unitId === unitId);
  const consumed = consumedBySize(unitId, excludeEntryId);
  const bySize: Record<string, { recQty: number; ratedQty: number; ratedVal: number; unrated: number; count: number }> = {};
  for (const r of receipts) {
    const b = (bySize[r.size] ??= { recQty: 0, ratedQty: 0, ratedVal: 0, unrated: 0, count: 0 });
    b.recQty = round(b.recQty + r.qty); b.count += 1;
    if (r.rate != null) { b.ratedQty = round(b.ratedQty + r.qty); b.ratedVal = money(b.ratedVal + r.qty * r.rate); }
    else b.unrated = round(b.unrated + r.qty);
  }
  const sizes = new Set([...Object.keys(bySize), ...Object.keys(consumed)]);
  const out: TapePool[] = [];
  for (const size of sizes) {
    const b = bySize[size] ?? { recQty: 0, ratedQty: 0, ratedVal: 0, unrated: 0, count: 0 };
    const avgRate = b.ratedQty > 0 ? money(b.ratedVal / b.ratedQty) : null;
    const qty = round(b.recQty - (consumed[size] || 0));
    out.push({ size, qty, avgRate, value: avgRate != null ? money(Math.max(0, qty) * avgRate) : 0, unratedQty: b.unrated, receiptCount: b.count });
  }
  return out.sort((a, b) => (a.size < b.size ? -1 : a.size > b.size ? 1 : 0));
}

export function tapePool(unitId: string, size: string, excludeEntryId?: string): TapePool {
  return tapePools(unitId, excludeEntryId).find((p) => p.size === size)
    ?? { size, qty: 0, avgRate: null, value: 0, unratedQty: 0, receiptCount: 0 };
}

// kg available for a loom entry to consume from a size (excludes the entry's own
// prior draw so editing an existing entry isn't blocked by itself).
export function tapeAvailable(unitId: string, size: string, excludeEntryId?: string): number {
  return tapePool(unitId, size, excludeEntryId).qty;
}

export function tapeSizes(unitId: string): string[] {
  return [...new Set(tapeReceiptsDb.getAll().filter((r) => r.unitId === unitId).map((r) => r.size))].sort();
}
