// ── Batch-wise FIFO costing ────────────────────────────────────────────────────
// Raw materials are stocked as batches, each with its own rate captured at
// receipt. Consumption draws from the oldest batch with stock remaining first, so
// a job is costed at what the material it actually used cost — not a global rate.
//
// Stock is always FULLY RECOMPUTED from the batches + every job card's recorded
// consumption (see syncBatchStock in db.ts). That keeps edits drift-free: change
// a quantity and every downstream remaining/lot is re-derived, never patched.
//
// Rates, however, are STICKY. Once a lot has snapshotted a batch's rate, a later
// correction to that batch's rate does not change the historical job cost. Only
// lots that have never been priced pick up the batch's current rate.

import type { RawMaterialBatch, ConsumptionLot } from '../types/models';

const round = (n: number) => Math.round(n * 1000) / 1000;
const money = (n: number) => Math.round(n * 100) / 100;

// Oldest first; ties broken by insertion order so allocation is deterministic.
export function fifoOrder(batches: RawMaterialBatch[]): RawMaterialBatch[] {
  return [...batches].sort((a, b) =>
    a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date));
}

export interface Allocation {
  lots: ConsumptionLot[];
  shortfall: number;        // qty that no batch could cover
}

// Draw `qty` from `batches` (FIFO), mutating each batch's `remaining`.
// `priorRates` carries rates already snapshotted for this row keyed by batchId,
// so historical costs stay put when a batch rate is corrected later.
export function allocateFifo(
  qty: number,
  batches: RawMaterialBatch[],
  priorRates?: Map<string, number | null>,
): Allocation {
  const lots: ConsumptionLot[] = [];
  let left = round(qty);
  if (left <= 0) return { lots, shortfall: 0 };

  for (const b of fifoOrder(batches)) {
    if (left <= 0) break;
    if (b.remaining <= 0) continue;
    const take = round(Math.min(left, b.remaining));
    if (take <= 0) continue;

    // Sticky rate: reuse the snapshot if this row already drew from this batch.
    const prior = priorRates?.get(b.id);
    const rate = prior !== undefined ? prior : b.rate ?? null;

    lots.push({
      batchId: b.id,
      qty: take,
      rate,
      batchDate: b.date,
      lineCost: rate != null ? money(take * rate) : 0,
    });
    b.remaining = round(b.remaining - take);
    left = round(left - take);
  }

  return { lots, shortfall: left > 0 ? left : 0 };
}

// Effective ₹/unit across a row's lots. Null when NO lot carries a rate — the
// row is then shown as "rate not set" and excluded from totals rather than
// silently costed at ₹0. Partially-priced rows report the priced portion.
export function blendedRate(lots: ConsumptionLot[]): number | null {
  const priced = lots.filter((l) => l.rate != null && l.qty > 0);
  if (!priced.length) return null;
  const qty = priced.reduce((s, l) => s + l.qty, 0);
  if (qty <= 0) return null;
  return money(priced.reduce((s, l) => s + l.qty * (l.rate as number), 0) / qty);
}

export function lotsCost(lots: ConsumptionLot[]): number {
  return money(lots.reduce((s, l) => s + (l.lineCost || 0), 0));
}

// True when any part of this row's quantity could not be priced — either an
// unpriced batch or stock that ran short. Drives the "rate not set" flag.
export function hasUnpricedQty(qty: number, lots: ConsumptionLot[], shortfall = 0): boolean {
  if (qty <= 0) return false;
  const pricedQty = lots.filter((l) => l.rate != null).reduce((s, l) => s + l.qty, 0);
  return round(pricedQty) < round(qty - 0) || shortfall > 0;
}
