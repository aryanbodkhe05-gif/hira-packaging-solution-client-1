// ── Raw-material batches ────────────────────────────────────────────────────────
// Raw materials are stocked as batches, each with its own rate captured at
// receipt. Consumption is now MANUAL batch-pick (see BatchUsePanel / BatchUse) —
// the worker chooses the batch on each line, so there is no auto-FIFO allocation.
// The only shared helper is ordering batches oldest-first, used to default the
// batch dropdown for convenience (any batch may still be picked).

import type { RawMaterialBatch } from '../types/models';

// Oldest first: by receipt date, then created-at, then id — fully deterministic.
export function fifoOrder(batches: RawMaterialBatch[]): RawMaterialBatch[] {
  return [...batches].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ca = a.createdAt || '', cb = b.createdAt || '';
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
