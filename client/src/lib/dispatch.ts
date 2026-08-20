// Partial-dispatch progress — COMPUTED, never stored. Pending = order total −
// Σ dispatched across ALL dispatch records linked to the order (any job card).
import type { Order, DispatchRecord, JobCard, CarriedIn } from '../types/models';
import { jobCardMade, jobCardLabel, laminationOutputKg, cuttingOwnInputKg } from './jobcard';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

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
// Dispatched = only what's actually shipped in this card's dispatch lines (NEVER
// the made qty). A ready-to-dispatch balance can be MOVED onto another card via
// the carry button (card.dispatch.carriedIn); on move it leaves the source, so:
//   available(card) = made + carriedIn − transferredOut(to other cards)
//   ready(card)     = available − dispatched(actual lines)
const num = (v?: number) => (typeof v === 'number' && isFinite(v) ? v : 0);

export interface CardBalance {
  madePcs: number; madeKg: number; isEstimate: boolean;   // madePcs is DISPLAY (actual, or planned when nothing made)
  dispatchedPcs: number; dispatchedKg: number;            // actual dispatch lines only
  carriedInPcs: number; carriedInKg: number;              // balances moved in from siblings
  transferredOutPcs: number;                              // balances moved out to siblings
  readyPcs: number; readyKg: number;
}
export function cardReadyToDispatch(card: JobCard, allCards: JobCard[]): CardBalance {
  const made = jobCardMade(card);   // actual produced (0 until Cutting bags entered)
  const lines = card.dispatch.lines ?? [];
  const dPcs = lines.reduce((s, l) => s + num(l.pieces), 0);
  const dKg = lines.reduce((s, l) => s + num(l.quantityKg), 0);
  const cIn = card.dispatch.carriedIn ?? [];
  const carriedInPcs = cIn.reduce((s, c) => s + num(c.pieces), 0);
  const carriedInKg = cIn.reduce((s, c) => s + num(c.kg), 0);
  // Balances moved OUT of this card = carriedIn entries on other cards pointing here.
  let outPcs = 0, outKg = 0;
  for (const c of allCards) {
    if (c.id === card.id) continue;
    for (const ci of c.dispatch.carriedIn ?? []) {
      if (ci.fromCardId === card.id) { outPcs += num(ci.pieces); outKg += num(ci.kg); }
    }
  }
  const availPcs = made.pieces + carriedInPcs - outPcs;
  const availKg = made.kg + carriedInKg - outKg;
  // Made display = actually produced bags; if none entered yet, show the planned
  // qty flagged as an estimate (never counted in ready/order maths).
  const isEstimate = made.pieces === 0 && num(card.header.qty) > 0;
  const displayMade = made.pieces > 0 ? made.pieces : num(card.header.qty);
  return {
    madePcs: displayMade, madeKg: made.kg, isEstimate,
    dispatchedPcs: dPcs, dispatchedKg: dKg,
    carriedInPcs, carriedInKg, transferredOutPcs: outPcs,
    readyPcs: Math.max(0, availPcs - dPcs), readyKg: Math.max(0, +(availKg - dKg).toFixed(2)),
  };
}

// Sibling cards of the same order that still hold a ready-to-dispatch balance and
// haven't already been carried onto `card` — the carry button's options.
export function siblingsWithReady(card: JobCard, allCards: JobCard[]): { card: JobCard; label: string; bal: CardBalance }[] {
  if (!card.orderRef) return [];
  const already = new Set((card.dispatch.carriedIn ?? []).map((c) => c.fromCardId));
  return allCards
    .filter((c) => c.id !== card.id && c.orderRef === card.orderRef && !already.has(c.id))
    .map((c) => ({ card: c, label: jobCardLabel(c).split(' / ').pop() || `JC-${c.orderJobSeq ?? ''}`, bal: cardReadyToDispatch(c, allCards) }))
    .filter(({ bal }) => bal.readyPcs > 0 || bal.readyKg > 0);
}

// Build the carriedIn entry that moves a sibling's whole ready balance onto a card.
export function moveCarriedBalance(sibling: JobCard, allCards: JobCard[]): CarriedIn | null {
  const bal = cardReadyToDispatch(sibling, allCards);
  if (bal.readyPcs <= 0 && bal.readyKg <= 0) return null;
  return {
    id: genId(), fromCardId: sibling.id,
    fromLabel: jobCardLabel(sibling).split(' / ').pop() || `JC-${sibling.orderJobSeq ?? ''}`,
    pieces: bal.readyPcs, kg: bal.readyKg || undefined, movedAt: new Date().toISOString(),
  };
}

// ── Lamination leftover balance — carries to the SAME ORDER's next job at Cutting ──
// Mirrors the ready-to-dispatch bag flow: a card's lamination output (Total KG) minus
// what its own cutting used is the leftover; it can be moved onto a sibling card's
// cutting (cutting.carriedIn), which nets it out here so it is never counted twice.
export interface LamBalance { producedKg: number; sentKg: number; transferredOutKg: number; leftoverKg: number; }
export function cardLaminationBalance(card: JobCard, allCards: JobCard[]): LamBalance {
  if (card.lamination.na) return { producedKg: 0, sentKg: 0, transferredOutKg: 0, leftoverKg: 0 };
  const producedKg = laminationOutputKg(card);
  const sentKg = cuttingOwnInputKg(card);   // this card's own cutting consumed from its lamination
  let transferredOutKg = 0;
  for (const c of allCards) {
    if (c.id === card.id) continue;
    for (const ci of c.cutting.carriedIn ?? []) {
      if (ci.fromCardId === card.id) transferredOutKg += num(ci.kg);
    }
  }
  const leftoverKg = Math.max(0, +(producedKg - sentKg - transferredOutKg).toFixed(2));
  return { producedKg, sentKg, transferredOutKg, leftoverKg };
}

// Sibling cards of the same order that still hold a lamination leftover and haven't
// already been carried onto `card`'s cutting — the cutting carry-in options.
export function siblingsWithLaminationBalance(card: JobCard, allCards: JobCard[]): { card: JobCard; label: string; bal: LamBalance }[] {
  if (!card.orderRef) return [];
  const already = new Set((card.cutting.carriedIn ?? []).map((c) => c.fromCardId));
  return allCards
    .filter((c) => c.id !== card.id && c.orderRef === card.orderRef && !already.has(c.id))
    .map((c) => ({ card: c, label: jobCardLabel(c).split(' / ').pop() || `JC-${c.orderJobSeq ?? ''}`, bal: cardLaminationBalance(c, allCards) }))
    .filter(({ bal }) => bal.leftoverKg > 0);
}

// Build the carriedIn entry that moves a sibling's lamination leftover onto a card's cutting.
export function moveLaminationBalance(sibling: JobCard, allCards: JobCard[]): CarriedIn | null {
  const bal = cardLaminationBalance(sibling, allCards);
  if (bal.leftoverKg <= 0) return null;
  return {
    id: genId(), fromCardId: sibling.id,
    fromLabel: jobCardLabel(sibling).split(' / ').pop() || `JC-${sibling.orderJobSeq ?? ''}`,
    pieces: 0, kg: bal.leftoverKg, movedAt: new Date().toISOString(),
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
