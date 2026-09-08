// ── P.P. Granule costing + tape price ───────────────────────────────────────────
// The Tape Plant consumes granules FIFO — oldest receipt (batch) first, each batch
// charged at its OWN receipt rate. A single consumption row can span several batches,
// producing one priced lot per batch. Tape is priced from those FIFO lots only (no
// labour/overhead — the Rate Master was retired). The moving-average helpers below
// are kept for the granule-TYPE mix summary, not for consumption costing.

import { ppGranulesDb, ppGranuleReceiptsDb, fabricBatchesDb, loomEntriesDb } from './db';
import type { GranuleUse, GranuleLot, PPGranuleItem, PPGranuleReceipt } from '../types/models';

const money = (n: number) => Math.round(n * 100) / 100;
const round = (n: number) => Math.round(n * 1000) / 1000;
const dpart = (s?: string) => (s ? s.slice(0, 10) : '');

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
    const rate = it.avgRate ?? it.costPerKg;
    if (rate == null) continue;
    const key = it.type ?? it.name;
    const qty = it.quantity ?? it.currentStockKg ?? 0;
    const a = acc[key] ?? { qty: 0, val: 0 };
    a.qty += qty;
    a.val += qty * rate;
    acc[key] = a;
  }
  const out: Record<string, number | null> = {};
  for (const [t, a] of Object.entries(acc)) out[t] = a.qty > 0 ? money(a.val / a.qty) : null;
  return out;
}

// ── FIFO batch consumption ──────────────────────────────────────────────────────
interface ConsumeEv { consumerId: string; date: string; seq: string; qty: number; }

// Every granule consumption of `itemId` across the Tape Plant (fabric batches) and
// loom granule uses, oldest first. `excludeConsumerId` skips one consumer so an
// edited batch/loom entry doesn't count its own draw as already gone.
export function granuleConsumption(itemId: string, excludeConsumerId?: string): ConsumeEv[] {
  const out: ConsumeEv[] = [];
  for (const b of fabricBatchesDb.getAll()) {
    if (b.id === excludeConsumerId) continue;
    for (const u of b.uses ?? []) if (u.itemId === itemId && (u.qtyKg || 0) > 0) out.push({ consumerId: b.id, date: dpart(b.date) || dpart(b.createdAt), seq: b.createdAt || b.id, qty: round(u.qtyKg) });
  }
  for (const e of loomEntriesDb.getAll()) {
    if (e.id === excludeConsumerId) continue;
    for (const u of e.granuleUses ?? []) if (u.itemId === itemId && (u.qtyKg || 0) > 0) out.push({ consumerId: e.id, date: dpart(e.date) || dpart(e.createdAt), seq: e.createdAt || e.id, qty: round(u.qtyKg) });
  }
  return out.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
}

export interface GranuleBatch {
  receiptId: string; date: string; seq: string;
  received: number; rate: number | null;
  remaining: number;      // kg left after all prior consumption drained FIFO
  runningTotal: number;   // cumulative remaining up to & including this batch
}

// Per-batch (receipt) remaining stock for a granule, oldest receipt first. All prior
// consumption is drained oldest-batch-first. `excludeConsumerId` adds back one
// consumer's draw (edit-safety).
export function granuleBatches(itemId: string, opts: { receipts?: PPGranuleReceipt[]; excludeConsumerId?: string } = {}): GranuleBatch[] {
  const batches: GranuleBatch[] = (opts.receipts ?? ppGranuleReceiptsDb.getAll())
    .filter((r) => r.granuleItemId === itemId)
    .map((r) => ({ receiptId: r.id, date: dpart(r.date) || dpart(r.createdAt), seq: r.createdAt || r.id, received: round(r.qty || 0), rate: r.rate ?? null, remaining: round(r.qty || 0), runningTotal: 0 }))
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
  let toConsume = granuleConsumption(itemId, opts.excludeConsumerId).reduce((s, e) => round(s + e.qty), 0);
  for (const b of batches) {
    if (toConsume <= 0) break;
    const take = Math.min(b.remaining, toConsume);
    b.remaining = round(b.remaining - take);
    toConsume = round(toConsume - take);
  }
  let run = 0;
  for (const b of batches) { run = round(run + b.remaining); b.runningTotal = run; }
  return batches;
}

// Allocate `qty` of a granule FIFO against its currently-remaining batches, returning
// one lot per batch drained (each at its batch rate) + any uncovered shortfall.
export function allocateGranuleFifo(itemId: string, qty: number, opts: { receipts?: PPGranuleReceipt[]; excludeConsumerId?: string } = {}): { lots: GranuleLot[]; shortfall: number } {
  const batches = granuleBatches(itemId, opts);
  const lots: GranuleLot[] = [];
  let need = round(qty);
  for (const b of batches) {
    if (need <= 0) break;
    if (b.remaining <= 0) continue;
    const take = round(Math.min(b.remaining, need));
    lots.push({ receiptId: b.receiptId, batchDate: b.date, qty: take, rate: b.rate, lineCost: b.rate != null ? money(take * b.rate) : 0 });
    need = round(need - take);
  }
  return { lots, shortfall: need > 1e-6 ? need : 0 };
}

// Cost of a set of granule uses, FIFO: use each row's saved lots when present, else
// allocate live (oldest batch first). Each lot is charged at its own batch rate.
export function granuleUsesCost(uses: GranuleUse[], _items: PPGranuleItem[] = ppGranulesDb.getAll(), opts: { excludeConsumerId?: string } = {}): { total: number; byType: Record<string, number>; hasUnrated: boolean } {
  const byType: Record<string, number> = {};
  let total = 0, hasUnrated = false;
  for (const u of uses) {
    if (!u.itemId || !u.qtyKg) continue;
    const alloc = u.lots?.length ? { lots: u.lots, shortfall: round(u.qtyKg - u.lots.reduce((s, l) => s + l.qty, 0)) } : allocateGranuleFifo(u.itemId, u.qtyKg, opts);
    let lineCost = 0;
    for (const lot of alloc.lots) {
      if (lot.rate == null) hasUnrated = true;
      else lineCost = money(lineCost + lot.lineCost);
    }
    if (alloc.shortfall > 1e-6) hasUnrated = true;   // uncovered qty has no batch → unpriced
    total = money(total + lineCost);
    byType[u.type] = money((byType[u.type] || 0) + lineCost);
  }
  return { total, byType, hasUnrated };
}

export interface TapePrice {
  granuleCost: number; granuleByType: Record<string, number>; granuleUnrated: boolean;
  totalCost: number; tapeKg: number; pricePerKg: number;
}
// Full tape price for a batch: granules (FIFO batch-costed), per kg. No labour /
// overhead — the Rate Master was retired; costing is batch rates only.
export function tapePrice(uses: GranuleUse[], tapeKg: number, items: PPGranuleItem[] = ppGranulesDb.getAll(), opts: { excludeConsumerId?: string } = {}): TapePrice {
  const g = granuleUsesCost(uses, items, opts);
  const totalCost = g.total;
  return {
    granuleCost: g.total, granuleByType: g.byType, granuleUnrated: g.hasUnrated,
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
