// Partial-dispatch progress — COMPUTED, never stored. Pending = order total −
// Σ dispatched across ALL dispatch records linked to the order (any job card).
import type { Order, DispatchRecord, JobCard } from '../types/models';
import { jobCardMade } from './jobcard';

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

// Made vs dispatched — the "balance bags" case. Distinct from order-level pending:
//   dispatched        = Σ shipped across the order's dispatch records
//   made              = Σ produced across the order's job cards
//   readyToDispatch   = made − dispatched   (produced, physically waiting to ship)
//   stillToProduce    = order qty − made    (not yet produced)
// A later dispatch draws readyToDispatch down first (it can only ship what's made).
export interface OrderProduction {
  madePcs: number; madeKg: number;
  dispatchedPcs: number; dispatchedKg: number;
  readyPcs: number; readyKg: number;         // made but not dispatched
  stillToProducePcs: number; stillToProduceKg: number;
  orderPcs: number; orderKg: number;
}
export function orderProduction(order: Order, cards: JobCard[], dispatches: DispatchRecord[]): OrderProduction {
  const mine = cards.filter((c) => c.orderRef === order.id);
  const made = mine.reduce((a, c) => { const m = jobCardMade(c); return { pcs: a.pcs + m.pieces, kg: a.kg + m.kg }; }, { pcs: 0, kg: 0 });
  const disp = dispatches.filter((d) => d.orderRef === order.id);
  const dispatchedPcs = disp.reduce((s, d) => s + (d.qtyPieces || 0), 0);
  const dispatchedKg = disp.reduce((s, d) => s + (d.qtyKg || 0), 0);
  const orderPcs = order.quantityNos ?? 0;
  const orderKg = order.quantityKg ?? 0;
  return {
    madePcs: made.pcs, madeKg: +made.kg.toFixed(2),
    dispatchedPcs, dispatchedKg,
    readyPcs: Math.max(0, made.pcs - dispatchedPcs), readyKg: Math.max(0, +(made.kg - dispatchedKg).toFixed(2)),
    stillToProducePcs: Math.max(0, orderPcs - made.pcs), stillToProduceKg: Math.max(0, +(orderKg - made.kg).toFixed(2)),
    orderPcs, orderKg,
  };
}

// Per-card ready-to-dispatch: made by this card − shipped from this card.
export function cardReadyToDispatch(card: JobCard, dispatches: DispatchRecord[]): { madePcs: number; dispatchedPcs: number; readyPcs: number; madeKg: number; dispatchedKg: number; readyKg: number } {
  const made = jobCardMade(card);
  const mine = dispatches.filter((d) => d.jobCardId === card.id);
  const dispatchedPcs = mine.reduce((s, d) => s + (d.qtyPieces || 0), 0);
  const dispatchedKg = mine.reduce((s, d) => s + (d.qtyKg || 0), 0);
  return {
    madePcs: made.pieces, dispatchedPcs, readyPcs: Math.max(0, made.pieces - dispatchedPcs),
    madeKg: +made.kg.toFixed(2), dispatchedKg, readyKg: Math.max(0, +(made.kg - dispatchedKg).toFixed(2)),
  };
}

// Small inline progress bar (Tailwind). Used on order/job-card lists.
export function progressBarClass(pct: number): string {
  return pct >= 100 ? 'bg-success' : pct > 0 ? 'bg-accent' : 'bg-white/20';
}
