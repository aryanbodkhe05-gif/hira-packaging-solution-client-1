// ── P.P. Granule costing + tape price ───────────────────────────────────────────
// Each granule item carries a rate (costPerKg) — its moving-average price. A
// granule TYPE (P.P. / Filler / Master Batch / Colour / Enhancer) exposes one
// running average = its items' rates weighted by current stock. Tape is priced like
// a job card: granules consumed (avg-costed) + labour/overhead (₹/kg × tape kg).

import { ppGranulesDb, rateMasterDb } from './db';
import type { GranuleUse, PPGranuleItem } from '../types/models';

const money = (n: number) => Math.round(n * 100) / 100;

// Moving-average rate blended on receipt: (oldStock×oldRate + addQty×addRate) ÷ total.
export function blendGranuleRate(oldStock: number, oldRate: number | null | undefined, addQty: number, addRate: number | null): number | null {
  const os = Math.max(0, oldStock || 0), aq = Math.max(0, addQty || 0);
  if (addRate == null) return oldRate ?? null;         // unrated receipt keeps the old rate
  if (oldRate == null || os <= 0) return addRate;      // first priced stock
  const total = os + aq;
  return total > 0 ? money((os * oldRate + aq * addRate) / total) : addRate;
}

// Stock-weighted average rate per granule type (null when no rated stock).
export function granuleTypeRates(items: PPGranuleItem[] = ppGranulesDb.getAll()): Record<string, number | null> {
  const acc: Record<string, { qty: number; val: number }> = {};
  for (const it of items) {
    if (it.costPerKg == null) continue;
    const a = acc[it.type] ?? { qty: 0, val: 0 };
    a.qty += it.currentStockKg || 0;
    a.val += (it.currentStockKg || 0) * it.costPerKg;
    acc[it.type] = a;
  }
  const out: Record<string, number | null> = {};
  for (const [t, a] of Object.entries(acc)) out[t] = a.qty > 0 ? money(a.val / a.qty) : null;
  return out;
}

// Cost of a set of granule uses: each item's qty × its own rate (its moving-average).
export function granuleUsesCost(uses: GranuleUse[], items: PPGranuleItem[] = ppGranulesDb.getAll()): { total: number; byType: Record<string, number>; hasUnrated: boolean } {
  const byType: Record<string, number> = {};
  let total = 0, hasUnrated = false;
  for (const u of uses) {
    if (!u.qtyKg) continue;
    const it = items.find((g) => g.id === u.itemId);
    const rate = it?.costPerKg ?? null;
    if (rate == null) { hasUnrated = true; continue; }
    const c = money(u.qtyKg * rate);
    total = money(total + c);
    byType[u.type] = money((byType[u.type] || 0) + c);
  }
  return { total, byType, hasUnrated };
}

export interface TapeLabourLine { name: string; rate: number | null; cost: number; }
// Labour/overhead for tape — every active Rate Master rate × the tape kg produced
// (same mechanism as the job card). Unpriced rates are shown but excluded.
export function tapeLabour(tapeKg: number): { lines: TapeLabourLine[]; total: number; hasUnset: boolean } {
  const lines = rateMasterDb.getAll().filter((m) => m.active).map((m) => ({
    name: m.name, rate: m.rate, cost: m.rate != null ? money(m.rate * tapeKg) : 0,
  }));
  const total = money(lines.reduce((s, l) => s + l.cost, 0));
  const hasUnset = tapeKg > 0 && lines.some((l) => l.rate == null);
  return { lines, total, hasUnset };
}

export interface TapePrice {
  granuleCost: number; granuleByType: Record<string, number>; granuleUnrated: boolean;
  labour: TapeLabourLine[]; labourCost: number; labourUnset: boolean;
  totalCost: number; tapeKg: number; pricePerKg: number;
}
// Full tape price for a batch: granules (avg-costed) + labour/overhead, per kg.
export function tapePrice(uses: GranuleUse[], tapeKg: number, items: PPGranuleItem[] = ppGranulesDb.getAll()): TapePrice {
  const g = granuleUsesCost(uses, items);
  const l = tapeLabour(tapeKg);
  const totalCost = money(g.total + l.total);
  return {
    granuleCost: g.total, granuleByType: g.byType, granuleUnrated: g.hasUnrated,
    labour: l.lines, labourCost: l.total, labourUnset: l.hasUnset,
    totalCost, tapeKg, pricePerKg: tapeKg > 0 ? money(totalCost / tapeKg) : 0,
  };
}

// Over-consumption guard: the first granule use that exceeds available stock.
// `origByItem` = qty this batch already booked (added back for edit-safety).
export function firstGranuleShortfall(uses: GranuleUse[], origByItem: Record<string, number> = {}, items: PPGranuleItem[] = ppGranulesDb.getAll()): { name: string; need: number; have: number } | null {
  for (const u of uses) {
    if (!u.itemId || !u.qtyKg) continue;
    const it = items.find((g) => g.id === u.itemId);
    const have = (it?.currentStockKg ?? 0) + (origByItem[u.itemId] ?? 0);
    if (u.qtyKg > have + 1e-6) return { name: it?.name ?? u.itemName, need: u.qtyKg, have: +have.toFixed(3) };
  }
  return null;
}
