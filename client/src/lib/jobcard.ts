// ── Job Card helpers: empty factories, metrics, carry-forward, costing ─────────
import type {
  JobCard, RateMasterItem, Consumption, JobCardHeader, Order,
  PrintingStage, MetalizeStage, SlittingStage, LaminationStage, CuttingStage, DispatchStage,
} from '../types/models';
import { JOB_STAGES } from '../config';
import { getSettings, rateMasterDb } from './db';
import type { JobStage, Finish, CardType, MakingType } from '../config';

export const STAGE_KEYS = ['printing', 'metalize', 'slitting', 'lamination', 'cutting', 'dispatch'] as const;
export type StageKey = typeof STAGE_KEYS[number];

export const STAGE_LABEL: Record<StageKey, JobStage> = {
  printing: 'Printing', metalize: 'Metalize', slitting: 'Slitting',
  lamination: 'Lamination', cutting: 'Cutting', dispatch: 'Dispatch',
};

const num = (v?: number) => (typeof v === 'number' && isFinite(v) ? v : 0);
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

// ── Empty factories ────────────────────────────────────────────────────────────
function emptyConsumption(): Consumption[] { return []; }

export function emptyJobCard(cardType: CardType = 'BOPP', finish: Finish = 'Glossy', makingType?: MakingType): Omit<JobCard, 'id'> {
  const base = { na: false, consumption: emptyConsumption(), materials: [], rollUses: [] };
  // Pre-mark stages N/A that the variant doesn't use (excluded from costing + carry-forward).
  const isOther = cardType === 'Other';
  const isRoll = cardType === 'BOPP' && makingType === 'Roll'; // roll jobs hide Cutting only
  return {
    jobNo: '',
    cardType,
    makingType,
    header: { brand: '', qty: 0, size: '', finish, date: new Date().toLocaleDateString('en-CA') },
    printing:   { ...base } as PrintingStage,
    metalize:   { ...base, na: isOther || finish !== 'Metalized' } as MetalizeStage,
    slitting:   { ...base, na: isOther, rolls: [] } as SlittingStage,
    lamination: { ...base, na: false, rows: [{}] } as LaminationStage,
    cutting:    { ...base, na: isRoll, gusset: false, perforation: false, rows: [{}] } as CuttingStage,
    dispatch:   { ...base, lines: [{}], bagsPerBale: 100 } as DispatchStage,
    status: 'In Progress',
    currentStage: 'Printing',
    createdAt: '',
    updatedAt: '',
  };
}

// Stages shown for a card, by variant. Roll jobs stop at the slitting/roll output
// (bag-conversion stages hidden); Normal cards run Printing → Cutting → Dispatch.
export function visibleStageKeys(card: Pick<JobCard, 'cardType' | 'makingType'>): StageKey[] {
  // Other (flexo) card per the paper form: Lamination → Flexo(printing) → Cutting → Dispatch.
  if (card.cardType === 'Other') return ['lamination', 'printing', 'cutting', 'dispatch'];
  if (card.makingType === 'Roll') return ['printing', 'metalize', 'slitting', 'lamination', 'dispatch'];
  return [...STAGE_KEYS];
}

// Build a job card pre-filled from an order, routed by product category / making type.
export function createJobCardFromOrder(order: Order): Omit<JobCard, 'id'> {
  const cardType: CardType = order.productType === 'BOPP' ? 'BOPP' : 'Other';
  const makingType: MakingType | undefined = cardType === 'BOPP' ? (order.makingType ?? 'Bag') : undefined;
  const card = emptyJobCard(cardType, 'Glossy', makingType);
  card.header.brand = order.brandName;
  card.header.size = order.sizeDisplay;
  card.header.bagType = order.bagType;
  card.header.boppFilmSizes = [...(order.boppFilmSizes ?? [])];
  card.header.metalizeSize = order.metalizeSize;
  card.header.linerSize = order.linerSize;
  card.header.linerGrm = order.linerGrm;
  card.header.qty = order.quantityNos ?? order.quantityKg ?? 0;
  card.header.qtyUnit = order.quantityUnit === 'KG' ? 'Kg' : 'Nos';
  card.client = order.brandName;
  card.orderRef = order.id;
  card.orderNo = order.orderId;
  return card;
}

// Ensure arrays exist (covers older/partial records read from storage)
export function normalizeJobCard(j: JobCard): JobCard {
  j.cardType ??= 'BOPP';
  if ((j.cardType as string) === 'Normal') j.cardType = 'Other'; // migrate legacy label
  for (const k of STAGE_KEYS) {
    const st = j[k] as { rollUses?: unknown[]; materials?: unknown[] };
    st.rollUses ??= [];
    st.materials ??= [];
  }
  j.printing.consumption ??= [];
  j.metalize.consumption ??= [];
  j.slitting.consumption ??= [];
  (j.slitting as SlittingStage).rolls ??= [];
  j.lamination.consumption ??= [];
  (j.lamination as LaminationStage).rows ??= [{}];
  j.cutting.consumption ??= [];
  (j.cutting as CuttingStage).rows ??= [{}];
  j.dispatch.consumption ??= [];
  (j.dispatch as DispatchStage).lines ??= [{}];
  return j;
}

// ── Job No. — HPS-YYYY-#### (sequential per year) ──────────────────────────────
export function genJobNo(existing: string[]): string {
  const year = new Date().getFullYear();
  const stem = `HPS-${year}-`;
  const used = existing
    .filter((j) => j.startsWith(stem))
    .map((j) => parseInt(j.slice(stem.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${stem}${String(next).padStart(4, '0')}`;
}

// ── Lamination Total KG (full laminated weight) + cutting carry-in ──────────────
// BOPP carried in for lamination = the boppInKg on its rows (fallback: inputKg).
function laminationBoppIn(j: JobCard): number {
  return sum(j.lamination.rows.map((r) => num(r.boppInKg))) || num(j.lamination.inputKg);
}
// Total KG (auto) = BOPP carried in + fabric/roll kg consumed + material kg consumed.
export function laminationAutoTotalKg(j: JobCard): number {
  const s = j.lamination;
  const rollKg = sum((s.rollUses ?? []).map((r) => num(r.qtyKg)));
  const matKg = sum((s.materials ?? []).map((m) => num(m.qty)));
  return +(laminationBoppIn(j) + rollKg + matKg).toFixed(3);
}
// Lamination OUTPUT (kg) = Total KG — the operator's override when set, else the auto
// sum. This full laminated weight is what carries forward into Cutting.
export function laminationOutputKg(j: JobCard): number {
  const t = j.lamination.totalKg;
  return t != null && isFinite(t) ? t : laminationAutoTotalKg(j);
}
// Amount of Total KG the operator passes to Cutting. Defaults to the full Total KG
// (whole batch goes to cutting); clamped so it can never exceed Total KG.
export function laminationSentToCuttingKg(j: JobCard): number {
  const total = laminationOutputKg(j);
  const s = j.lamination.sentToCuttingKg;
  const sent = s != null && isFinite(s) ? s : total;   // default = full Total KG
  return Math.min(Math.max(0, sent), total);
}
// kg fed into this card's Cutting from OTHER jobs' lamination leftover (carried in).
export function cuttingCarriedInKg(j: JobCard): number {
  return sum((j.cutting.carriedIn ?? []).map((c) => num(c.kg)));
}
// This card's OWN cutting input (excludes carried-in material). When Lamination
// directly feeds Cutting, it is exactly the Lamination "Sent to Cutting" value; on
// cards where Lamination doesn't precede Cutting, it falls back to the cutting rows.
export function cuttingOwnInputKg(j: JobCard): number {
  if (prevActiveStage(j, 'cutting') === 'lamination') return laminationSentToCuttingKg(j);
  const s = j.cutting;
  return s.method === 'Back Seal' ? num(s.bsInputKg) : sum(s.rows.map((r) => num(r.inputKg)));
}
// Lamination Balance = Total KG − Sent to Cutting (never negative). The gross leftover
// shown next to the field; the sibling carry-offer nets out what's already moved out.
export function laminationBalanceKg(j: JobCard): number {
  if (j.lamination.na) return 0;
  return Math.max(0, +(laminationOutputKg(j) - laminationSentToCuttingKg(j)).toFixed(3));
}

// ── Per-stage primary input / output (kg) for balance + carry-forward ──────────
// Output is ALWAYS CALCULATED — input minus this stage's rejection/wastage — never
// the separately-typed output field. This calculated value is what flows into the
// next stage's input and drives balance/yield. (This app has one loss field per
// stage, labelled "Wastage" and stored as rejectionKg; when none is entered the
// carried output equals the input.) Dispatch is terminal: its "output" is shipped qty.
export function stagePrimary(j: JobCard, key: StageKey): { input: number; output: number; rejection: number } {
  const calc = (input: number, rejection: number) => ({ input, output: Math.max(0, +(input - rejection).toFixed(3)), rejection });
  switch (key) {
    case 'printing': { const s = j.printing; return calc(num(s.inputKg), num(s.rejectionKg)); }
    case 'metalize': { const s = j.metalize; return calc(num(s.boppInputKg) || num(s.metalizeInputKg), num(s.rejectionKg)); }
    case 'slitting': { const s = j.slitting; return calc(num(s.inputKg) || num(s.grossInputKg), num(s.rejectionKg)); }
    // Lamination ADDS mass (fabric + LD/granule), so its output is the Total KG (full
    // laminated weight), not input − wastage.
    case 'lamination': { const s = j.lamination; return { input: laminationBoppIn(j), output: laminationOutputKg(j), rejection: num(s.rejectionKg) }; }
    case 'cutting': {
      const s = j.cutting;
      // Input = own rows/Back-Seal input + any lamination leftover carried in from a
      // sibling job of the same order.
      const input = cuttingOwnInputKg(j) + cuttingCarriedInKg(j);
      return calc(input, num(s.rejectionKg));
    }
    case 'dispatch': { const s = j.dispatch; return { input: 0, output: sum(s.lines.map((l) => num(l.quantityKg))), rejection: 0 }; }
  }
}

// True when a stage has entered a rejection/wastage OR a leftover balance — i.e. a
// smaller carried output is explained, so no cross-stage reconciliation warning is due.
export function stageLossAccounted(j: JobCard, key: StageKey): boolean {
  const s = j[key] as { rejectionKg?: number; balanceKg?: number; balance?: number; bsBalanceKg?: number };
  return num(s.rejectionKg) > 0 || num(s.balanceKg) > 0 || num(s.balance) > 0 || num(s.bsBalanceKg) > 0;
}

export interface StageMetrics { input: number; output: number; rejection: number; balance: number; yieldPct: number; }
export function stageMetrics(j: JobCard, key: StageKey): StageMetrics {
  const { input, output, rejection } = stagePrimary(j, key);
  return {
    input, output, rejection,
    balance: input - output - rejection,
    yieldPct: input > 0 ? (output / input) * 100 : 0,
  };
}

export function isStageActive(j: JobCard, key: StageKey): boolean {
  return !j[key].na;
}

// Active stages in floor order
export function activeStageKeys(j: JobCard): StageKey[] {
  return STAGE_KEYS.filter((k) => isStageActive(j, k));
}

// The previous active stage before `key` (for carry-forward / mismatch warning)
export function prevActiveStage(j: JobCard, key: StageKey): StageKey | null {
  const idx = STAGE_KEYS.indexOf(key);
  for (let i = idx - 1; i >= 0; i--) {
    if (isStageActive(j, STAGE_KEYS[i])) return STAGE_KEYS[i];
  }
  return null;
}

export function nextActiveStage(j: JobCard, key: StageKey): StageKey | null {
  const idx = STAGE_KEYS.indexOf(key);
  for (let i = idx + 1; i < STAGE_KEYS.length; i++) {
    if (isStageActive(j, STAGE_KEYS[i])) return STAGE_KEYS[i];
  }
  return null;
}

// ── Costing ────────────────────────────────────────────────────────────────────
// One auto-applied labour/overhead line: rate (₹/kg) × the job's final output kg.
export interface LabourLine { name: string; unit: string; rate: number | null; kg: number; cost: number; }

export interface CostingResult {
  stageCosts: Record<StageKey, number>;
  materialCost: number;         // stage material + roll consumption only
  labourLines: LabourLine[];    // auto labour/overhead (Rate Master × output kg)
  labourCost: number;
  totalJobCost: number;
  totalBags: number;
  costPerBag: number;
  finalOutputKg: number;
  costPerKg: number;
  wastageKg: number;
  overallYieldPct: number;
  hasUnsetRates: boolean;       // some consumed material had no rate
}

// Stage cost = moving-average material consumption + per-roll consumption. Labour /
// overhead is auto-applied globally against the job's final output kg (see
// computeCosting), not per stage.
export function stageCost(j: JobCard, key: StageKey): number {
  if (!isStageActive(j, key)) return 0;
  return sum((j[key].materials ?? []).map((m) => num(m.cost)))
    + sum((j[key].rollUses ?? []).map((r) => num(r.lineCost)));
}

// The job's final output kg used to cost labour/overhead: prefer the dispatched
// quantity (this card's OWN lines only — carried lines dispatch another card's
// balance, not this card's production), else the last stage with a positive kg.
// (Carried lines excluded so a carried kg never inflates the source card's made.)
export function finalOutputKg(j: JobCard): number {
  const dispatched = sum(j.dispatch.lines.filter((l) => !l.fromCardId).map((l) => num(l.quantityKg)));
  if (dispatched > 0) return dispatched;
  for (let i = STAGE_KEYS.length - 1; i >= 0; i--) {
    const k = STAGE_KEYS[i];
    if (k === 'dispatch') continue;   // dispatch lines aren't production output (and carried lines aren't this card's)
    if (!isStageActive(j, k)) continue;
    const out = stagePrimary(j, k).output;
    if (out > 0) return out;
  }
  return 0;
}

// Auto labour/overhead lines: every active Rate Master rate (₹/kg) multiplied by
// the job's final output kg. No one enters kg. Unpriced rates are shown but
// excluded from the total.
export function labourLines(j: JobCard): LabourLine[] {
  const kg = finalOutputKg(j);
  return rateMasterDb.getAll()
    .filter((m) => m.active)
    .map((m) => ({
      name: m.name,
      unit: m.unit,
      rate: m.rate,
      kg,
      cost: m.rate != null ? +(m.rate * kg).toFixed(2) : 0,
    }));
}

// Any active stage that consumes more of a material than is in stock (blocks save).
// `have` = the qty actually coverable (need − shortfall).
export function firstMaterialShortfall(j: JobCard): { name: string; need: number; have: number } | null {
  for (const k of STAGE_KEYS) {
    if (!isStageActive(j, k)) continue;
    for (const m of j[k].materials ?? []) {
      if ((m.shortfall ?? 0) > 0) return { name: m.materialName, need: m.qty, have: +(m.qty - (m.shortfall ?? 0)).toFixed(3) };
    }
  }
  return null;
}

export function totalBags(j: JobCard): number {
  if (!isStageActive(j, 'cutting')) return 0;
  if (j.cutting.method === 'Back Seal') return num(j.cutting.bsPieces);
  return sum(j.cutting.rows.map((r) => num(r.noOfBags)));
}

export function computeCosting(j: JobCard): CostingResult {
  const stageCosts = {} as Record<StageKey, number>;
  let materialCost = 0;
  let hasUnset = false;
  for (const k of STAGE_KEYS) {
    const c = stageCost(j, k);
    stageCosts[k] = c;
    materialCost += c;
    if (!isStageActive(j, k)) continue;
    // Flagged (never ₹0'd) when a consumed material's pool is unrated, or stock ran short.
    if ((j[k].materials ?? []).some((m) => (m.shortfall ?? 0) > 0 || (num(m.qty) > 0 && m.avgRate == null))) hasUnset = true;
    if ((j[k].rollUses ?? []).some((r) => num(r.qtyKg) > 0 && r.rate == null)) hasUnset = true;
  }

  const bags = totalBags(j);
  const outKg = finalOutputKg(j);

  // first input kg = first active stage with a positive input
  let firstInputKg = 0;
  for (const k of STAGE_KEYS) {
    if (!isStageActive(j, k)) continue;
    const inp = stagePrimary(j, k).input;
    if (inp > 0) { firstInputKg = inp; break; }
  }

  const wastageKg =
    sum(activeStageKeys(j).map((k) => stagePrimary(j, k).rejection)) +
    (isStageActive(j, 'slitting') ? num(j.slitting.trimKg) : 0);

  // Auto labour/overhead — Rate Master (₹/kg) × final output kg.
  const labour = labourLines(j);
  const labourCost = sum(labour.map((l) => l.cost));
  if (outKg > 0 && labour.some((l) => l.rate == null)) hasUnset = true;
  const total = materialCost + labourCost;

  return {
    stageCosts,
    materialCost,
    labourLines: labour,
    labourCost,
    totalJobCost: total,
    totalBags: bags,
    costPerBag: bags > 0 ? total / bags : 0,
    finalOutputKg: outKg,
    costPerKg: outKg > 0 ? total / outKg : 0,
    wastageKg,
    overallYieldPct: firstInputKg > 0 ? (outKg / firstInputKg) * 100 : 0,
    hasUnsetRates: hasUnset,
  };
}

// ── Consumption helpers ────────────────────────────────────────────────────────
// Labour/overhead lines relevant to a stage = active rate items of that category
// (+ 'Any'). Materials are NOT sourced here — they come from inventory batches.
export function materialsForStage(items: RateMasterItem[], stage: JobStage): RateMasterItem[] {
  return items.filter((m) => m.active && (m.category === stage || m.category === 'Any'));
}

// Build the labour consumption rows for a stage, preserving any quantity already
// entered and snapshotting the current rate for each line.
export function buildLabourConsumption(items: RateMasterItem[], stage: JobStage, existing: Consumption[]): Consumption[] {
  const byId = new Map(existing.map((c) => [c.materialId, c]));
  return materialsForStage(items, stage).map((m) => {
    const prev = byId.get(m.id);
    const qty = prev ? num(prev.qty) : 0;
    // Rate stays snapshotted once entered, so later Rate Master edits don't
    // rewrite historical job costs.
    const rate = prev && prev.qty > 0 && prev.rateSnapshot != null ? prev.rateSnapshot : m.rate;
    return {
      materialId: m.id,
      materialName: m.name,
      unit: m.unit,
      qty,
      rateSnapshot: rate,
      lineCost: rate != null ? qty * rate : 0,
      source: 'labour' as const,
    };
  });
}

// Total value of a stage's per-roll consumption lines (each at its own rate).
export function rollUsesCost(j: JobCard, key: StageKey): number {
  return sum((j[key].rollUses ?? []).map((r) => num(r.lineCost)));
}

// ── Auto-calculated consumption (ink, thread) ──────────────────────────────────
// Ink is a percentage of BOPP input kg; thread a percentage of cutting input kg.
// The default lives in Settings; each job card may override it.
export function autoPct(override: number | undefined, settingKey: string, fallback: number): number {
  if (override != null && isFinite(override) && override >= 0) return override;
  const raw = getSettings()[settingKey];
  const n = raw == null ? NaN : parseFloat(raw);
  return isFinite(n) && n >= 0 ? n : fallback;
}

export function autoQty(baseKg: number | undefined, pct: number): number {
  return +(num(baseKg) * (pct / 100)).toFixed(3);
}

export function formatINR(n: number): string {
  return '₹' + (isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Numbering + made-vs-dispatched ──────────────────────────────────────────────
// Display label: order number + JC-n when the card belongs to an order (an order
// can span several cards), else the internal HPS job number.
export function jobCardLabel(card: Pick<JobCard, 'jobNo' | 'orderNo' | 'orderJobSeq'>): string {
  if (card.orderNo && card.orderJobSeq) return `${card.orderNo} / JC-${card.orderJobSeq}`;
  return card.jobNo;
}

// Next JC-n sequence for an order, given its existing cards.
export function nextOrderJobSeq(existing: Pick<JobCard, 'orderJobSeq'>[]): number {
  const seqs = existing.map((c) => c.orderJobSeq ?? 0).filter((n) => n > 0);
  return (seqs.length ? Math.max(...seqs) : 0) + 1;
}

// What this job card has ACTUALLY PRODUCED — the No. of bags entered at Cutting
// (0 until entered). Never invented. The planned qty is only a display estimate
// (see cardReadyToDispatch), and it is never used for ready/rollup maths.
export function jobCardMade(card: JobCard): { pieces: number; kg: number } {
  return { pieces: totalBags(card), kg: finalOutputKg(card) };
}

// ── Dispatch: bale groups + shipped totals ──────────────────────────────────────
// Bales are grouped by pieces-per-bale, each group carrying its own total weight.
export function baleTotals(stage: DispatchStage): { pieces: number; count: number; weight: number; autoWeight: number } {
  const groups = stage.bales ?? [];
  const pieces = groups.reduce((s, g) => s + num(g.piecesPerBale) * num(g.bales), 0);
  const count = groups.reduce((s, g) => s + num(g.bales), 0);
  const autoWeight = +groups.reduce((s, g) => s + num(g.weightKg), 0).toFixed(3);
  // Total Bale Weight box: the operator's override when set, else the auto sum.
  const weight = stage.baleWeightKg != null && isFinite(stage.baleWeightKg) ? stage.baleWeightKg : autoWeight;
  return { pieces, count, weight, autoWeight };
}
// What this card actually ships — pieces + kg. Bales are the primary source
// (pieces = Σ piecesPerBale × bales, kg = Total Bale Weight); the older dispatch
// lines are the fallback when no bales are entered.
export function dispatchShipped(card: JobCard): { pcs: number; kg: number } {
  const bt = baleTotals(card.dispatch);
  const linePcs = sum((card.dispatch.lines ?? []).map((l) => num(l.pieces)));
  const lineKg = sum((card.dispatch.lines ?? []).map((l) => num(l.quantityKg)));
  return { pcs: bt.pieces || linePcs, kg: bt.weight || lineKg };
}

// Stage label list in floor order (re-exported for convenience)
export const STAGE_ORDER = JOB_STAGES;
