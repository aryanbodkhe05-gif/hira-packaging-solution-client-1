// Partial-dispatch progress — COMPUTED, never stored. Pending = order total −
// Σ dispatched across ALL dispatch records linked to the order (any job card).
import type { Order, DispatchRecord } from '../types/models';

export interface DispatchProgress {
  dispatchedPcs: number;
  dispatchedKg: number;
  totalPcs: number;
  totalKg: number;
  pendingPcs: number;
  pendingKg: number;
  pct: number;        // 0–100 by pieces if the order tracks pcs, else by kg
  closed: boolean;    // short-closed
  status: 'Pending' | 'Partially Dispatched' | 'Dispatched' | 'Short-Closed';
}

export function orderDispatchProgress(order: Order, dispatches: DispatchRecord[]): DispatchProgress {
  const mine = dispatches.filter((d) => d.orderRef === order.id);
  const dispatchedPcs = mine.reduce((s, d) => s + (d.qtyPieces || 0), 0);
  const dispatchedKg = mine.reduce((s, d) => s + (d.qtyKg || 0), 0);
  const totalPcs = order.quantityNos ?? 0;
  const totalKg = order.quantityKg ?? 0;
  const base = totalPcs > 0 ? { done: dispatchedPcs, total: totalPcs } : { done: dispatchedKg, total: totalKg };
  const pct = base.total > 0 ? Math.min(100, (base.done / base.total) * 100) : 0;
  const closed = !!order.closedAt;
  const status: DispatchProgress['status'] =
    closed ? 'Short-Closed' : pct >= 100 ? 'Dispatched' : pct > 0 ? 'Partially Dispatched' : 'Pending';
  return {
    dispatchedPcs, dispatchedKg, totalPcs, totalKg,
    pendingPcs: Math.max(0, totalPcs - dispatchedPcs),
    pendingKg: Math.max(0, totalKg - dispatchedKg),
    pct, closed, status,
  };
}

// Small inline progress bar (Tailwind). Used on order/job-card lists.
export function progressBarClass(pct: number): string {
  return pct >= 100 ? 'bg-success' : pct > 0 ? 'bg-accent' : 'bg-white/20';
}
