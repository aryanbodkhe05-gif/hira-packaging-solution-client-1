// ── Auto-FIFO raw-material consumption ──────────────────────────────────────────
// Raw materials are stocked as batches, each with its own rate + date. Consumption
// drains the OLDEST batch first, flowing into newer batches, and records a line per
// batch drained so the job card shows the split. Stock never goes negative — a
// quantity larger than what's available is blocked before it reaches here.

import type { RawMaterialBatch, FifoLine, MaterialUse } from '../types/models';
import { rawMaterialsDb, rawMaterialBatchesDb } from './db';

const round = (n: number) => Math.round(n * 1000) / 1000;
const money = (n: number) => Math.round(n * 100) / 100;

// Oldest first: by receipt date, then created-at, then id — fully deterministic.
export function fifoOrder(batches: RawMaterialBatch[]): RawMaterialBatch[] {
  return [...batches].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ca = a.createdAt || '', cb = b.createdAt || '';
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Drain `qty` from `batches` (oldest first), mutating each batch's `remaining`.
// Returns one line per batch touched, plus any shortfall that couldn't be covered.
export function allocateFifo(qty: number, batches: RawMaterialBatch[]): { lines: FifoLine[]; shortfall: number } {
  const lines: FifoLine[] = [];
  let left = round(qty);
  if (left <= 0) return { lines, shortfall: 0 };
  for (const b of fifoOrder(batches)) {
    if (left <= 0) break;
    if (b.remaining <= 0) continue;
    const take = round(Math.min(b.remaining, left));
    if (take <= 0) continue;
    lines.push({ batchId: b.id, batchDate: b.date, take, rate: b.rate ?? null, cost: b.rate != null ? money(take * b.rate) : 0 });
    b.remaining = round(b.remaining - take);
    left = round(left - take);
  }
  return { lines, shortfall: left > 0 ? round(left) : 0 };
}

// Total available stock of a material = Σ remaining across its batches, adding back
// what `existing` (this card's own current entry) already consumed — so editing a
// quantity doesn't see its own draw as gone.
export function materialAvailable(materialId: string, existing?: MaterialUse): number {
  const batches = rawMaterialBatchesDb.forItem(materialId);
  let total = batches.reduce((s, b) => s + b.remaining, 0);
  for (const l of existing?.lines ?? []) total += l.take;
  return round(total);
}

// Preview the FIFO split for a quantity (for live display + the block check). The
// authoritative allocation is recomputed on save by syncBatchStock.
export function previewFifo(materialId: string, qty: number, existing?: MaterialUse): MaterialUse {
  const mat = rawMaterialsDb.getAll().find((m) => m.id === materialId);
  // Work on copies; add back this row's own prior take so an edit sees true stock.
  const batches = rawMaterialBatchesDb.forItem(materialId).map((b) => ({ ...b }));
  for (const l of existing?.lines ?? []) {
    const b = batches.find((x) => x.id === l.batchId);
    if (b) b.remaining = round(b.remaining + l.take);
  }
  const { lines, shortfall } = allocateFifo(qty, batches);
  return {
    materialId,
    materialName: mat?.name ?? existing?.materialName ?? '',
    unit: mat?.unit ?? existing?.unit ?? 'kg',
    qty,
    lines,
    totalCost: money(lines.reduce((s, l) => s + (l.cost || 0), 0)),
    shortfall: shortfall > 0 ? shortfall : undefined,
  };
}
