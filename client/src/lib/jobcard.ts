// ── Job Card helpers: empty factories, metrics, carry-forward, costing ─────────
import type {
  JobCard, RateMasterItem, Consumption, JobCardHeader,
  PrintingStage, MetalizeStage, SlittingStage, LaminationStage, CuttingStage, DispatchStage,
} from '../types/models';
import { JOB_STAGES } from '../config';
import type { JobStage, Finish } from '../config';

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

export function emptyJobCard(finish: Finish = 'Glossy'): Omit<JobCard, 'id'> {
  const base = { na: false, consumption: emptyConsumption() };
  return {
    jobNo: '',
    header: { brand: '', qty: 0, size: '', finish, date: new Date().toLocaleDateString('en-CA') },
    printing:   { ...base } as PrintingStage,
    metalize:   { ...base, na: finish !== 'Metalized' } as MetalizeStage, // only metalized orders metalize
    slitting:   { ...base, rolls: [] } as SlittingStage,
    lamination: { ...base, rows: [{}] } as LaminationStage,
    cutting:    { ...base, gusset: false, perforation: false, rows: [{}] } as CuttingStage,
    dispatch:   { ...base, lines: [{}], bagsPerBale: 100 } as DispatchStage,
    status: 'In Progress',
    currentStage: 'Printing',
    createdAt: '',
    updatedAt: '',
  };
}

// Ensure arrays exist (covers older/partial records read from storage)
export function normalizeJobCard(j: JobCard): JobCard {
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

// ── Per-stage primary input / output (kg) for balance + carry-forward ──────────
export function stagePrimary(j: JobCard, key: StageKey): { input: number; output: number; rejection: number } {
  switch (key) {
    case 'printing': { const s = j.printing; return { input: num(s.inputKg), output: num(s.outputKg), rejection: num(s.rejectionKg) }; }
    case 'metalize': { const s = j.metalize; return { input: num(s.metalizeInputKg), output: num(s.outputKg), rejection: num(s.rejectionKg) }; }
    case 'slitting': { const s = j.slitting; return { input: num(s.grossInputKg), output: sum(s.rolls.map((r) => num(r.outputKg))), rejection: num(s.rejectionKg) }; }
    case 'lamination': { const s = j.lamination; return { input: sum(s.rows.map((r) => num(r.boppInKg))), output: sum(s.rows.map((r) => num(r.outKg))), rejection: 0 }; }
    case 'cutting': { const s = j.cutting; return { input: sum(s.rows.map((r) => num(r.inputKg))), output: 0, rejection: num(s.rejectionKg) }; }
    case 'dispatch': { const s = j.dispatch; return { input: 0, output: sum(s.lines.map((l) => num(l.quantityKg))), rejection: 0 }; }
  }
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
export interface CostingResult {
  stageCosts: Record<StageKey, number>;
  totalJobCost: number;
  totalBags: number;
  costPerBag: number;
  finalOutputKg: number;
  costPerKg: number;
  wastageKg: number;
  overallYieldPct: number;
  hasUnsetRates: boolean;       // some consumed material had no rate
}

export function stageCost(j: JobCard, key: StageKey): number {
  if (!isStageActive(j, key)) return 0;
  return sum(j[key].consumption.map((c) => num(c.lineCost)));
}

export function totalBags(j: JobCard): number {
  if (!isStageActive(j, 'cutting')) return 0;
  return sum(j.cutting.rows.map((r) => num(r.noOfBags)));
}

export function computeCosting(j: JobCard): CostingResult {
  const stageCosts = {} as Record<StageKey, number>;
  let total = 0;
  let hasUnset = false;
  for (const k of STAGE_KEYS) {
    const c = stageCost(j, k);
    stageCosts[k] = c;
    total += c;
    if (isStageActive(j, k) && j[k].consumption.some((x) => x.rateSnapshot == null && num(x.qty) > 0)) hasUnset = true;
  }

  const bags = totalBags(j);

  // final output kg = last active stage (in order) that has a positive kg output
  let finalOutputKg = 0;
  for (let i = STAGE_KEYS.length - 1; i >= 0; i--) {
    const k = STAGE_KEYS[i];
    if (!isStageActive(j, k)) continue;
    const out = stagePrimary(j, k).output;
    if (out > 0) { finalOutputKg = out; break; }
  }
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

  return {
    stageCosts,
    totalJobCost: total,
    totalBags: bags,
    costPerBag: bags > 0 ? total / bags : 0,
    finalOutputKg,
    costPerKg: finalOutputKg > 0 ? total / finalOutputKg : 0,
    wastageKg,
    overallYieldPct: firstInputKg > 0 ? (finalOutputKg / firstInputKg) * 100 : 0,
    hasUnsetRates: hasUnset,
  };
}

// ── Consumption helpers ────────────────────────────────────────────────────────
// Materials relevant to a stage = active rate items of that category (+ 'Any').
export function materialsForStage(items: RateMasterItem[], stage: JobStage): RateMasterItem[] {
  return items.filter((m) => m.active && (m.category === stage || m.category === 'Any'));
}

// Build the consumption rows for a stage, preserving any quantity already
// entered and snapshotting the current rate for each line.
export function buildConsumption(items: RateMasterItem[], stage: JobStage, existing: Consumption[]): Consumption[] {
  const byId = new Map(existing.map((c) => [c.materialId, c]));
  return materialsForStage(items, stage).map((m) => {
    const prev = byId.get(m.id);
    const qty = prev ? num(prev.qty) : 0;
    const rate = m.rate;
    return {
      materialId: m.id,
      materialName: m.name,
      unit: m.unit,
      qty,
      rateSnapshot: rate,
      lineCost: rate != null ? qty * rate : 0,
    };
  });
}

export function formatINR(n: number): string {
  return '₹' + (isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Stage label list in floor order (re-exported for convenience)
export const STAGE_ORDER = JOB_STAGES;
