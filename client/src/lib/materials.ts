// ── Moving-average raw-material consumption ─────────────────────────────────────
// Each raw material is ONE running pool (qty + value → average rate). Receipts
// change the average; consumption is charged at the current average and leaves it
// unchanged. Consuming more than the rated stock on hand is blocked before it gets
// here. No batches, no FIFO splitting — the blended average already includes the
// oldest stock.

import type { RawMaterial, MaterialUse } from '../types/models';
import { rawMaterialsDb } from './db';

const round = (n: number) => Math.round(n * 1000) / 1000;
const money = (n: number) => Math.round(n * 100) / 100;

// Rated stock available to consume on this card. Adds back the card's own SAVED
// draw (already deducted from the pool by syncMaterialPools) so editing a line
// doesn't see its own quantity as gone.
export function materialPoolAvailable(materialId: string, saved?: MaterialUse): number {
  const mat = rawMaterialsDb.getAll().find((m) => m.id === materialId);
  const onHand = mat ? mat.quantity : 0;
  return round(onHand + (saved?.qty ?? 0));
}

// Preview the moving-average cost of consuming `qty` of a material (live display +
// the block check). Charges at the pool's current average rate, snapshotted onto
// the line; syncMaterialPools recomputes the authoritative figure on save.
export function previewMaterial(materialId: string, qty: number, saved?: MaterialUse): MaterialUse {
  const mat = rawMaterialsDb.getAll().find((m) => m.id === materialId);
  const avail = materialPoolAvailable(materialId, saved);
  const avgRate = mat?.avgRate ?? null;
  const shortfall = qty > avail ? round(qty - avail) : undefined;
  const costable = round(qty - (shortfall ?? 0));
  return {
    materialId,
    materialName: mat?.name ?? saved?.materialName ?? '',
    unit: mat?.unit ?? saved?.unit ?? 'kg',
    qty,
    avgRate,
    cost: avgRate != null ? money(costable * avgRate) : 0,
    shortfall,
  };
}

// Convenience for the pool display: the moving-average snapshot of a material.
export function materialPool(mat: RawMaterial): { qty: number; value: number; avgRate: number | null; unratedQty: number } {
  return { qty: mat.quantity, value: mat.totalValue, avgRate: mat.avgRate, unratedQty: mat.unratedQty };
}
