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

// ── Made / Dispatched / Ready — derived ONLY from real entries ──────────────────
// Dispatched is the Σ of the job card's own Dispatch-section lines (bags + kg).
// Carried-over lines (fromCardId set) dispatch ANOTHER card's balance, so they
// count against the source card, never the card they sit on — keeping the same
// bags from being counted twice across job cards.
const num = (v?: number) => (typeof v === 'number' && isFinite(v) ? v : 0);

export interface CardBalance {
  madePcs: number; madeKg: number; isEstimate: boolean;   // madePcs is DISPLAY (actual, or planned when nothing made yet)
  dispatchedPcs: number; dispatchedKg: number;   // own lines + carried-against-this-card
  readyPcs: number; readyKg: number;             // from ACTUAL made only
}
export function cardReadyToDispatch(card: JobCard, allCards: JobCard[]): CardBalance {
  const made = jobCardMade(card);   // actual produced (0 until Cutting bags entered)
  // Own dispatch lines (not carried from elsewhere).
  const own = (card.dispatch.lines ?? []).filter((l) => !l.fromCardId);
  let dPcs = own.reduce((s, l) => s + num(l.pieces), 0);
  let dKg = own.reduce((s, l) => s + num(l.quantityKg), 0);
  // Carried-over lines on OTHER cards that dispatch THIS card's balance. A carried
  // line only draws the source down once it is actually dispatched (has a date);
  // until then it's a pre-filled reminder and the source keeps its ready balance.
  for (const c of allCards) {
    if (c.id === card.id) continue;
    for (const l of c.dispatch.lines ?? []) {
      if (l.fromCardId === card.id && l.dispatchDate) { dPcs += num(l.pieces); dKg += num(l.quantityKg); }
    }
  }
  // Display made: actual if produced, else the planned qty flagged as an estimate.
  const isEstimate = made.pieces === 0 && num(card.header.qty) > 0;
  const displayMade = made.pieces > 0 ? made.pieces : num(card.header.qty);
  return {
    madePcs: displayMade, madeKg: made.kg, isEstimate,
    dispatchedPcs: dPcs, dispatchedKg: dKg,
    // Ready uses ACTUAL made — you can't ship an estimate.
    readyPcs: Math.max(0, made.pieces - dPcs), readyKg: Math.max(0, +(made.kg - dKg).toFixed(2)),
  };
}

// Order-level rollup across all its job cards.
export interface OrderProduction {
  madePcs: number; madeKg: number;
  dispatchedPcs: number; dispatchedKg: number;
  readyPcs: number; readyKg: number;
  stillToProducePcs: number; stillToProduceKg: number;
  orderPcs: number; orderKg: number;
}
export function orderProduction(order: Order, cards: JobCard[], _dispatches?: DispatchRecord[]): OrderProduction {
  const mine = cards.filter((c) => c.orderRef === order.id);
  let madePcs = 0, madeKg = 0, dispatchedPcs = 0, dispatchedKg = 0, readyPcs = 0, readyKg = 0;
  for (const c of mine) {
    const actual = jobCardMade(c);   // ACTUAL produced — estimates never roll up
    const b = cardReadyToDispatch(c, cards);
    madePcs += actual.pieces; madeKg += actual.kg;
    dispatchedPcs += b.dispatchedPcs; dispatchedKg += b.dispatchedKg;
    readyPcs += b.readyPcs; readyKg += b.readyKg;
  }
  const orderPcs = order.quantityNos ?? 0;
  const orderKg = order.quantityKg ?? 0;
  return {
    madePcs, madeKg: +madeKg.toFixed(2),
    dispatchedPcs, dispatchedKg: +dispatchedKg.toFixed(2),
    readyPcs, readyKg: +readyKg.toFixed(2),
    stillToProducePcs: Math.max(0, orderPcs - madePcs), stillToProduceKg: Math.max(0, +(orderKg - madeKg).toFixed(2)),
    orderPcs, orderKg,
  };
}

// Small inline progress bar (Tailwind). Used on order/job-card lists.
export function progressBarClass(pct: number): string {
  return pct >= 100 ? 'bg-success' : pct > 0 ? 'bg-accent' : 'bg-white/20';
}
