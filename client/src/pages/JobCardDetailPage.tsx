import { useState, useMemo, useCallback, ReactNode } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Save, Printer, ArrowLeft, AlertTriangle,
  IndianRupee, Plus, Trash2, Truck, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  jobCardsDb, dispatchesDb, ordersDb,
  syncBatchStock, consumeRoll, factoryMachinesDb, getList, saveSettings,
} from '../lib/db';
import {
  FINISHES, JOB_STAGES, JOBCARD_STATUSES, FABRIC_TYPES, COATING_SIDES,
  BAG_TYPES_KEY, DEFAULT_BAG_TYPES, CUTTING_METHODS,
  INK_PCT_KEY, THREAD_PCT_KEY, DEFAULT_INK_PCT, DEFAULT_THREAD_PCT,
  PRINTING_INK, PRINTING_SOLVENTS, METALIZE_MATERIALS, LAMINATION_MATERIALS,
  BCS_THREAD, BACKSEAL_GLUE,
} from '../config';
import type { Finish, JobStage, JobCardStatus, FabricType, CoatingSide, CuttingMethod } from '../config';
import type { JobCard, DispatchRecord, RollUse, BatchUse, DispatchLine } from '../types/models';
import { BatchUsePanel, type Suggestion } from '../components/ui/BatchUsePanel';
import { RollUsesPanel } from '../components/ui/RollUses';
import {
  emptyJobCard, normalizeJobCard, genJobNo, STAGE_KEYS, STAGE_LABEL,
  stageMetrics, stageCost, computeCosting, formatINR,
  prevActiveStage, nextActiveStage, stagePrimary, visibleStageKeys, totalBags,
  autoPct, autoQty, jobCardLabel,
} from '../lib/jobcard';
import { cardReadyToDispatch } from '../lib/dispatch';
import type { StageKey } from '../lib/jobcard';
import { canViewCosts, staffScope } from '../lib/roles';
import { useBranding } from '../lib/branding';
import { cn } from '../lib/utils';

// ── Small field helpers ─────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
function Num({ value, onChange, placeholder = '0' }: { value?: number; onChange: (v: number | undefined) => void; placeholder?: string }) {
  return (
    <input className="input-field font-mono" type="number" min="0" step="any"
      value={value ?? ''} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0))} />
  );
}
function Txt({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className="input-field" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
function DateInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return <input className="input-field" type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

// Brand + Operator appear on every stage.
function StageWho({ brand, operator, onOperator }: { brand: string; operator?: string; onOperator: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Brand Name"><input className="input-field bg-white/5" value={brand} readOnly /></Field>
      <Field label="Operator Name"><Txt value={operator} onChange={onOperator} placeholder="operator" /></Field>
    </div>
  );
}

// ── Carry-forward: a stage's forward output {kg, meter} + how to land it as the
// next stage's input, mapped to each stage's ACTUAL current fields. ─────────────
const cnum = (v?: number) => (typeof v === 'number' && isFinite(v) ? v : 0);
const csum = (arr: (number | undefined)[]) => arr.reduce((a: number, b) => a + cnum(b), 0);

function stageForward(j: JobCard, key: StageKey): { kg: number; meter: number } {
  switch (key) {
    case 'printing': return { kg: cnum(j.printing.outputKg) || cnum(j.printing.inputKg), meter: cnum(j.printing.meter) };
    case 'metalize': return { kg: cnum(j.metalize.outputKg) || cnum(j.metalize.boppInputKg), meter: cnum(j.metalize.outputMtr) };
    case 'slitting': return { kg: cnum(j.slitting.outputKg) || cnum(j.slitting.inputKg), meter: cnum(j.slitting.outputMeter) || cnum(j.slitting.inputMeter) };
    case 'lamination': return { kg: cnum(j.lamination.outputKg) || csum(j.lamination.rows.map((r) => r.outKg)) || cnum(j.lamination.inputKg), meter: 0 };
    case 'cutting': return { kg: j.cutting.method === 'Back Seal' ? cnum(j.cutting.bsInputKg) : csum(j.cutting.rows.map((r) => r.inputKg)), meter: 0 };
    case 'dispatch': return { kg: csum(j.dispatch.lines.map((l) => l.quantityKg)), meter: 0 };
  }
}

// Land a carried {kg, meter} into a stage's input, only where the field is empty
// (never clobber a value the operator already entered).
function applyStageInput(j: JobCard, key: StageKey, v: { kg: number; meter: number }): JobCard {
  const put = (cur: number | undefined, val: number) => (cur == null || cur === 0) && val > 0 ? val : cur;
  switch (key) {
    case 'printing': return { ...j, printing: { ...j.printing, inputKg: put(j.printing.inputKg, v.kg) } };
    case 'metalize': return { ...j, metalize: { ...j.metalize, boppInputKg: put(j.metalize.boppInputKg, v.kg) } };
    case 'slitting': return { ...j, slitting: { ...j.slitting, inputKg: put(j.slitting.inputKg, v.kg), inputMeter: put(j.slitting.inputMeter, v.meter) } };
    case 'lamination': {
      // Other card uses a single inputKg; BOPP card keeps the legacy row field.
      if (j.cardType === 'Other') return { ...j, lamination: { ...j.lamination, inputKg: put(j.lamination.inputKg, v.kg) } };
      const rows = j.lamination.rows.length ? [...j.lamination.rows] : [{}];
      rows[0] = { ...rows[0], boppInKg: put(rows[0].boppInKg, v.kg) };
      return { ...j, lamination: { ...j.lamination, rows, inputKg: put(j.lamination.inputKg, v.kg) } };
    }
    case 'cutting': {
      if ((j.cutting.method ?? 'BCS') === 'Back Seal') return { ...j, cutting: { ...j.cutting, bsInputKg: put(j.cutting.bsInputKg, v.kg) } };
      const rows = j.cutting.rows.length ? [...j.cutting.rows] : [{}];
      rows[0] = { ...rows[0], inputKg: put(rows[0].inputKg, v.kg) };
      return { ...j, cutting: { ...j.cutting, rows } };
    }
    case 'dispatch': {
      const lines = j.dispatch.lines.length ? [...j.dispatch.lines] : [{}];
      lines[0] = { ...lines[0], quantityKg: put(lines[0].quantityKg, v.kg) };
      return { ...j, dispatch: { ...j.dispatch, lines } };
    }
  }
}

// ── Stage shell (collapsible + N/A + metrics) ──────────────────────────────────
function StageCard({ jobKey, card, expanded, onToggle, onSetNA, children, label, stageFilter }: {
  jobKey: StageKey; card: JobCard; expanded: boolean;
  onToggle: () => void; onSetNA: (na: boolean) => void; children: ReactNode; label?: string;
  stageFilter?: StageKey;   // when set (scoped Staff), only this stage renders
}) {
  if (stageFilter && jobKey !== stageFilter) return null;
  if (!visibleStageKeys(card).includes(jobKey)) return null;
  const stage = card[jobKey];
  const m = stageMetrics(card, jobKey);
  const prevKey = prevActiveStage(card, jobKey);
  const prevOut = prevKey ? stagePrimary(card, prevKey).output : 0;
  const myIn = m.input;
  const mismatch = !stage.na && prevKey && prevOut > 0 && myIn > 0 && Math.abs(prevOut - myIn) > 0.001;

  return (
    <div className={cn('glass-card overflow-hidden', stage.na && 'opacity-60')}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent/10">
        <button onClick={onToggle} className="flex items-center gap-2 text-left">
          {expanded ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-muted" />}
          <span className="text-white font-semibold">{label ?? STAGE_LABEL[jobKey]}</span>
          {!stage.na && (myIn > 0 || m.output > 0) && (
            <span className="text-xs text-muted font-mono ml-2">bal {m.balance.toFixed(1)} kg · yield {m.yieldPct.toFixed(0)}%</span>
          )}
        </button>
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-primary" checked={stage.na} onChange={(e) => onSetNA(e.target.checked)} />
          N/A
        </label>
      </div>
      {expanded && !stage.na && (
        <div className="p-4 space-y-3">
          {mismatch && (
            <div className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Input ({myIn} kg) doesn't match previous stage output ({prevOut} kg) — check for loss/error.
            </div>
          )}
          {children}
        </div>
      )}
      {expanded && stage.na && <div className="p-4 text-muted text-sm">Marked Not Applicable — excluded from balance carry-forward and costing.</div>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export function JobCardDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const isNew = id === 'new';
  const branding = useBranding();
  const showCosts = canViewCosts();
  // Process-scoped Staff see only their assigned stage on every job card.
  const scope = staffScope();
  const isScoped = !!scope && scope.area === 'jobcard';
  const staffStage = isScoped ? scope!.stageKey : undefined;   // undefined = see all (admin / legacy)
  const lockedMethod = isScoped ? scope!.method : undefined;   // Cutting-BCS vs Back Seal
  const cuttingMachines = useMemo(() => factoryMachinesDb.getAll().filter((m) => m.active && m.type === 'Cutting/BCS'), []);
  const bagTypeOptions = useMemo(() => getList(BAG_TYPES_KEY, DEFAULT_BAG_TYPES), []);
  const [expanded, setExpanded] = useState<Set<StageKey>>(() => new Set(STAGE_KEYS));

  const [card, setCard] = useState<JobCard | null>(() => {
    if (isNew) {
      const ct = params.get('type') === 'Other' ? 'Other' : 'BOPP';
      const mk = ct === 'BOPP' ? (params.get('making') === 'Roll' ? 'Roll' : 'Bag') : undefined;
      return normalizeJobCard({ ...emptyJobCard(ct, 'Glossy', mk), id: '' } as JobCard);
    }
    const found = jobCardsDb.get(id!);
    return found ? normalizeJobCard(found) : null;
  });

  const cost = useMemo(() => (card ? computeCosting(card) : null), [card]);

  const persist = useCallback((c: JobCard, silent = false) => {
    const now = new Date().toISOString();
    // Commit roll/film consumption to inventory, then re-snapshot each line's rate
    // from the roll it actually consumed.
    const committed: JobCard = { ...c };
    // A Cutting-BCS / Back Seal scoped staffer's method is forced on save.
    if (lockedMethod) committed.cutting = { ...committed.cutting, method: lockedMethod };
    for (const k of STAGE_KEYS) {
      const uses = (committed[k].rollUses ?? []).filter((u) => u.qtyKg > 0);
      if (!uses.length) continue;
      const prevUses = c.id ? (jobCardsDb.get(c.id)?.[k].rollUses ?? []) : [];
      const next: RollUse[] = uses.map((u) => {
        // Only commit a line the first time it is saved, so re-saving a card
        // doesn't decrement the same roll twice.
        const already = prevUses.find((p) => p.rollId === u.rollId && p.qtyKg === u.qtyKg && p.finished === u.finished);
        if (already) return u;
        const rate = consumeRoll({ rollId: u.rollId, kind: u.kind, qtyKg: u.qtyKg, finished: u.finished },
          { jobNo: c.jobNo, orderNo: c.orderNo });
        const eff = u.rate ?? rate;
        return { ...u, rate: eff, lineCost: eff != null ? +(u.qtyKg * eff).toFixed(2) : 0 };
      });
      (committed[k] as { rollUses?: RollUse[] }).rollUses = next;
    }

    if (!committed.id) {
      const jobNo = committed.jobNo || genJobNo(jobCardsDb.getAll().map((x) => x.jobNo));
      const created = jobCardsDb.create({ ...committed, jobNo, ratesAsOf: now, createdAt: now, updatedAt: now } as Omit<JobCard, 'id'>);
      syncBatchStock();
      if (!silent) toast.success(`Job card ${created.jobNo} created`);
      nav(`/job-card/${created.id}`, { replace: true });
      setCard(normalizeJobCard(jobCardsDb.get(created.id) ?? created));
    } else {
      jobCardsDb.update(committed.id, { ...committed, ratesAsOf: now, updatedAt: now });
      syncBatchStock();   // re-derive batch remainders + FIFO lots for every card
      if (!silent) toast.success('Saved');
      const fresh = jobCardsDb.get(committed.id);
      setCard(fresh ? normalizeJobCard(fresh) : { ...committed, ratesAsOf: now, updatedAt: now });
    }
  }, [nav]);

  if (!card) return <Navigate to="/job-card" replace />;

  // ── update helpers ──
  const patchHeader = (patch: Partial<JobCard['header']>) =>
    setCard((p) => p && ({ ...p, header: { ...p.header, ...patch } }));

  function patchStage<K extends StageKey>(key: K, patch: Partial<JobCard[K]>) {
    setCard((p) => p && ({ ...p, [key]: { ...p[key], ...patch } } as JobCard));
  }

  // Manual batch-pick consumption — the worker adds/edits batch lines directly.
  function setMaterialUses(key: StageKey, uses: BatchUse[]) {
    setCard((p) => p && ({ ...p, [key]: { ...p[key], materialUses: uses } } as JobCard));
  }
  function setPrintingInput(v: number | undefined) { patchStage('printing', { inputKg: v }); }

  // Sticky % — the value becomes the global default (Settings) and drives only the
  // "suggested qty" quick-add chip; it no longer auto-consumes (manual pick now).
  function setInkPct(v: number | undefined) {
    if (v != null) saveSettings({ [INK_PCT_KEY]: String(v) });
    patchStage('printing', { inkPct: v });
  }
  function setThreadPct(v: number | undefined) {
    if (v != null) saveSettings({ [THREAD_PCT_KEY]: String(v) });
    patchStage('cutting', { threadPct: v });
  }

  // Carry the current stage's output (kg AND meter) into the next active stage's input.
  function carryForward(fromKey: StageKey) {
    setCard((p) => {
      if (!p) return p;
      const next = nextActiveStage(p, fromKey);
      if (!next) return p;
      const val = stageForward(p, fromKey);
      if (val.kg <= 0 && val.meter <= 0) return p;
      return applyStageInput(p, next, val);
    });
  }

  function toggleExpand(k: StageKey) {
    setExpanded((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  function setNA(k: StageKey, na: boolean) { patchStage(k, { na } as Partial<JobCard[StageKey]>); }

  function sendToDispatch(kind: 'Roll' | 'Bag') {
    if (!card) return;
    if (!card.id) { toast.error('Save the job card first'); return; }
    const now = new Date().toISOString();
    let rec: Omit<DispatchRecord, 'id'>;
    if (kind === 'Roll') {
      rec = {
        type: 'Roll', jobCardId: card.id, jobNo: card.jobNo, orderRef: card.orderRef, orderNo: card.orderNo,
        party: card.client || card.header.brand, brand: card.header.brand,
        qtyKg: card.slitting.outputKg ?? card.slitting.rolls.reduce((s, r) => s + (r.outputKg || 0), 0),
        qtyMeters: card.slitting.outputMeter ?? card.slitting.rolls.reduce((s, r) => s + (r.meter || 0), 0),
        rolls: card.dispatch.noOfBales || card.slitting.rolls.filter((r) => (r.outputKg || 0) > 0).length,
        date: now.slice(0, 10), createdAt: now,
      };
    } else {
      rec = {
        type: 'Bag', jobCardId: card.id, jobNo: card.jobNo, orderRef: card.orderRef, orderNo: card.orderNo,
        party: card.client || card.header.brand, brand: card.header.brand,
        qtyPieces: totalBags(card),
        qtyKg: stagePrimary(card, 'cutting').input,
        date: now.slice(0, 10), createdAt: now,
      };
    }
    dispatchesDb.create(rec);
    const patch = kind === 'Roll' ? { rollDispatchedAt: now } : { bagDispatchedAt: now };
    jobCardsDb.update(card.id, { ...patch, status: 'Dispatched', updatedAt: now });
    if (card.orderRef) ordersDb.update(card.orderRef, { status: 'Dispatched', dispatchedAt: now });
    setCard({ ...card, ...patch, status: 'Dispatched' });
    toast.success(`${kind} dispatched → Dispatch – ${kind}s register`);
  }

  const h = card.header;
  const brand = h.brand;

  // Ink auto-calc: % of BOPP input kg. Default from Settings, editable per card.
  const inkPct = autoPct(card.printing.inkPct, INK_PCT_KEY, DEFAULT_INK_PCT);
  const inkQty = autoQty(card.printing.inputKg, inkPct);
  const threadPct = autoPct(card.cutting.threadPct, THREAD_PCT_KEY, DEFAULT_THREAD_PCT);
  const threadQty = autoQty(stagePrimary(card, 'cutting').input, threadPct);
  // Effective cutting method — forced for a Cutting-BCS / Back Seal scoped staffer.
  const cutMethod = lockedMethod ?? card.cutting.method ?? 'BCS';

  // Prominent carry-forward button — carries the stage's output (kg + meter) into
  // the next active stage's input.
  const CarryBtn = ({ from }: { from: StageKey }) => {
    const next = nextActiveStage(card, from);
    if (!next) return null;
    return (
      <button type="button" onClick={() => carryForward(from)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/20 border border-primary/40 text-accent font-semibold text-sm hover:bg-primary/30 transition-colors">
        <ArrowRight className="w-4 h-4" /> Carry output → {STAGE_LABEL[next]} input
      </button>
    );
  };

  // Quick-add suggestions per stage. Ink (Printing) and thread (BCS Cutting) carry
  // an auto qty (% of input); the rest are plain one-click adds. The worker still
  // picks the batch on each line.
  const stageSuggestions = (key: StageKey): Suggestion[] => {
    if (key === 'printing') return [{ materialName: PRINTING_INK, autoQty: inkQty || undefined, label: `${PRINTING_INK} (auto ${inkPct}%)` }, ...PRINTING_SOLVENTS.map((n) => ({ materialName: n }))];
    if (key === 'metalize') return METALIZE_MATERIALS.map((n) => ({ materialName: n }));
    if (key === 'lamination') return LAMINATION_MATERIALS.map((n) => ({ materialName: n }));
    if (key === 'cutting') return cutMethod === 'Back Seal'
      ? [{ materialName: BACKSEAL_GLUE }]
      : [{ materialName: BCS_THREAD, autoQty: threadQty || undefined, label: `${BCS_THREAD} (auto ${threadPct}%)` }];
    return [];
  };

  const StageMaterials = ({ stageKey }: { stageKey: StageKey }) => (
    <BatchUsePanel value={card![stageKey].materialUses ?? []} onChange={(u) => setMaterialUses(stageKey, u)} suggestions={stageSuggestions(stageKey)} />
  );

  return (
    <div className="space-y-6 animate-fade-in print-area">
      <div className="print-only mb-4 border-b border-black pb-2">
        <h2 className="text-xl font-bold">{branding.companyName}</h2>
        {(branding.companyAddress || branding.companyGstin) && (
          <p className="text-xs">{branding.companyAddress}{branding.companyGstin ? ` · GSTIN ${branding.companyGstin}` : ''}</p>
        )}
        <p className="text-xs">{branding.appName} — Job Card {card.jobNo}</p>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/job-card')} className="p-2 rounded-lg hover:bg-white/10 text-muted hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="page-header">{card.id ? jobCardLabel(card) : 'New Job Card'}</h1>
            <p className="text-muted text-sm mt-0.5">{card.jobNo ? `${card.jobNo} · ` : ''}Order traveler — fill each stage as the order moves</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => window.print()} className="btn-secondary"><Printer className="w-4 h-4" /> Print</button>
          <button onClick={() => persist(card)} className="btn-primary"><Save className="w-4 h-4" /> Save</button>
        </div>
      </div>

      {/* Made vs dispatched — produced vs shipped, with ready-to-dispatch balance */}
      {card.id && (!isScoped || staffStage === 'dispatch') && (() => {
        const p = cardReadyToDispatch(card, jobCardsDb.getAll());
        if (p.madePcs <= 0 && p.dispatchedPcs <= 0) return null;
        return (
          <div className="grid grid-cols-3 gap-3 no-print">
            <div className="glass-card p-3 text-center"><p className="text-muted text-xs">Made</p><p className="font-mono text-white text-lg">{p.madePcs.toLocaleString('en-IN')}</p></div>
            <div className="glass-card p-3 text-center"><p className="text-muted text-xs">Dispatched</p><p className="font-mono text-white text-lg">{p.dispatchedPcs.toLocaleString('en-IN')}</p></div>
            <div className={cn('glass-card p-3 text-center', p.readyPcs > 0 && 'border-amber-500/30')}><p className={cn('text-xs', p.readyPcs > 0 ? 'text-amber-300/80' : 'text-muted')}>Ready to Dispatch</p><p className={cn('font-mono text-lg', p.readyPcs > 0 ? 'text-amber-300' : 'text-white')}>{p.readyPcs.toLocaleString('en-IN')}</p></div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Scoped-Staff banner + read-only job summary */}
          {isScoped && (
            <div className="glass-card p-4 space-y-1 border-accent/30">
              <p className="text-accent text-xs font-semibold uppercase tracking-wide">Your process: {scope!.process}</p>
              <p className="text-white font-medium">{card.header.brand || '—'} <span className="text-muted font-mono text-sm">· {card.jobNo}</span></p>
              <p className="text-muted text-xs">{card.header.size}{card.orderNo ? ` · order ${card.orderNo}` : ''}. You see and fill only the {scope!.process} step of this job card.</p>
            </div>
          )}
          {/* Header (editable — hidden for scoped Staff) */}
          <div className={cn('glass-card p-4 space-y-3', isScoped && 'hidden')}>
            <p className="section-title text-base">Job Description</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Brand Name *"><Txt value={h.brand} onChange={(v) => patchHeader({ brand: v })} placeholder="Brand name" /></Field>
              {card.cardType === 'Other' ? (<>
                <Field label="Size"><Txt value={h.size} onChange={(v) => patchHeader({ size: v })} placeholder="18 x 28" /></Field>
                <Field label="Qty"><Num value={h.qty || undefined} onChange={(v) => patchHeader({ qty: v ?? 0 })} /></Field>
                <Field label="Nos / Kg">
                  <select className="input-field" value={h.qtyUnit ?? 'Nos'} onChange={(e) => patchHeader({ qtyUnit: e.target.value as 'Nos' | 'Kg' })}>
                    <option>Nos</option><option>Kg</option>
                  </select>
                </Field>
                <Field label="Type (Plain / Flexo)">
                  <div className="flex gap-2">
                    {([['Plain', false], ['Flexo', true]] as const).map(([lbl, val]) => (
                      <button key={lbl} type="button" onClick={() => patchHeader({ printed: val })}
                        className={cn('px-4 py-1.5 rounded text-sm font-medium transition-colors', (!!h.printed === val) ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white')}>{lbl}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Bag Type">
                  <input className="input-field" list="jc-bag-types" value={h.bagType ?? ''} onChange={(e) => patchHeader({ bagType: e.target.value })} placeholder="handle / laminated" />
                </Field>
              </>) : (<>
                <Field label="Qty"><Num value={h.qty || undefined} onChange={(v) => patchHeader({ qty: v ?? 0 })} /></Field>
                <Field label="Size"><Txt value={h.size} onChange={(v) => patchHeader({ size: v })} placeholder="18 x 28" /></Field>
                <Field label="Date"><DateInput value={h.date} onChange={(v) => patchHeader({ date: v })} /></Field>
                <Field label="Finish">
                  <select className="input-field" value={h.finish}
                    onChange={(e) => { const f = e.target.value as Finish; patchHeader({ finish: f }); patchStage('metalize', { na: f !== 'Metalized' }); }}>
                    {FINISHES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Bag Type">
                  <input className="input-field" list="jc-bag-types" value={h.bagType ?? ''} onChange={(e) => patchHeader({ bagType: e.target.value })} placeholder="handle / laminated" />
                </Field>
                <Field label="BOPP Film Size (mm)">
                  <Txt value={(h.boppFilmSizes ?? []).join(', ')}
                    onChange={(v) => patchHeader({ boppFilmSizes: v.split(',').map((s) => s.trim()).filter(Boolean) })}
                    placeholder="e.g. 520, 480" />
                </Field>
                <Field label="Metalize Size (mm)"><Txt value={h.metalizeSize} onChange={(v) => patchHeader({ metalizeSize: v })} /></Field>
                <Field label="Liner Size (mm)"><Txt value={h.linerSize} onChange={(v) => patchHeader({ linerSize: v })} /></Field>
                <Field label="Liner GRM"><Num value={h.linerGrm} onChange={(v) => patchHeader({ linerGrm: v })} /></Field>
              </>)}
              <datalist id="jc-bag-types">{bagTypeOptions.map((t) => <option key={t} value={t} />)}</datalist>
              <Field label="Status">
                <select className="input-field" value={card.status} onChange={(e) => setCard((p) => p && ({ ...p, status: e.target.value as JobCardStatus }))}>
                  {JOBCARD_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Current stage">
                <select className="input-field" value={card.currentStage} onChange={(e) => setCard((p) => p && ({ ...p, currentStage: e.target.value as JobStage }))}>
                  {JOB_STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* ════ BOPP card ════ */}
          {card.cardType === 'BOPP' && (<>
          {/* C1 — Printing */}
          <StageCard jobKey="printing" card={card} expanded={expanded.has('printing')} onToggle={() => toggleExpand('printing')} onSetNA={(na) => setNA('printing', na)} stageFilter={staffStage}>
            <StageWho brand={brand} operator={card.printing.operator} onOperator={(v) => patchStage('printing', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.printing.date} onChange={(v) => patchStage('printing', { date: v })} /></Field>
              <Field label="BOPP Input (kg)"><Num value={card.printing.inputKg} onChange={(v) => setPrintingInput(v)} /></Field>
              <Field label="BOPP Size"><Txt value={card.printing.boppSize} onChange={(v) => patchStage('printing', { boppSize: v })} placeholder="520" /></Field>
              <Field label="BOPP Roll No"><Txt value={card.printing.boppRollNo} onChange={(v) => patchStage('printing', { boppRollNo: v })} /></Field>
              <Field label="BOPP Type"><Txt value={card.printing.boppType} onChange={(v) => patchStage('printing', { boppType: v })} placeholder="Glossy / Matte" /></Field>
              <Field label="Balance BOPP (kg)"><Num value={card.printing.balanceKg} onChange={(v) => patchStage('printing', { balanceKg: v })} /></Field>
              <Field label="Output (kg)"><Num value={card.printing.outputKg} onChange={(v) => patchStage('printing', { outputKg: v })} /></Field>
              <Field label="Output (meter)"><Num value={card.printing.meter} onChange={(v) => patchStage('printing', { meter: v })} /></Field>
              <Field label="Wastage (kg)"><Num value={card.printing.rejectionKg} onChange={(v) => patchStage('printing', { rejectionKg: v })} /></Field>
            </div>
            <CarryBtn from="printing" />

            {/* Printing consumes BOPP FILM only — normal rolls are not selectable here */}
            <RollUsesPanel value={card.printing.rollUses ?? []} onChange={(u) => patchStage('printing', { rollUses: u })}
              kinds={['film']} title="BOPP film consumed — one line per film" />

            {/* Ink suggestion % (sticky global default) → drives the ink quick-add chip */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-muted">Ink auto %:</span>
              <input className="input-field font-mono w-20 py-1 text-sm" type="number" min="0" step="any"
                value={card.printing.inkPct ?? inkPct}
                onChange={(e) => setInkPct(e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0))} />
              <span className="text-muted">% of BOPP input ({card.printing.inputKg ?? 0} kg) = <span className="text-white/80 font-mono">{inkQty} kg</span> · new % becomes the global default</span>
            </div>
            {/* Manual batch-pick material consumption */}
            <StageMaterials stageKey="printing" />
          </StageCard>

          {/* C3 — Metalize */}
          <StageCard jobKey="metalize" card={card} expanded={expanded.has('metalize')} onToggle={() => toggleExpand('metalize')} onSetNA={(na) => setNA('metalize', na)} stageFilter={staffStage}>
            <StageWho brand={brand} operator={card.metalize.operator} onOperator={(v) => patchStage('metalize', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.metalize.date} onChange={(v) => patchStage('metalize', { date: v })} /></Field>
              <Field label="Roll No"><Txt value={card.metalize.rollNo} onChange={(v) => patchStage('metalize', { rollNo: v })} /></Field>
              <Field label="Size"><Txt value={card.metalize.size} onChange={(v) => patchStage('metalize', { size: v })} /></Field>
              <Field label="Balance (roll)"><Txt value={card.metalize.rollBalance} onChange={(v) => patchStage('metalize', { rollBalance: v })} placeholder="balance roll no" /></Field>
              <Field label="BOPP Input (kg)"><Num value={card.metalize.boppInputKg} onChange={(v) => patchStage('metalize', { boppInputKg: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.metalize.balanceKg} onChange={(v) => patchStage('metalize', { balanceKg: v })} /></Field>
            </div>
            <CarryBtn from="metalize" />
            <StageMaterials stageKey="metalize" />
          </StageCard>

          {/* C2 — Slitting */}
          <StageCard jobKey="slitting" card={card} expanded={expanded.has('slitting')} onToggle={() => toggleExpand('slitting')} onSetNA={(na) => setNA('slitting', na)} stageFilter={staffStage}>
            <StageWho brand={brand} operator={card.slitting.operator} onOperator={(v) => patchStage('slitting', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.slitting.date} onChange={(v) => patchStage('slitting', { date: v })} /></Field>
              <Field label="Input (kg)"><Num value={card.slitting.inputKg} onChange={(v) => patchStage('slitting', { inputKg: v })} /></Field>
              <Field label="Input (meter)"><Num value={card.slitting.inputMeter} onChange={(v) => patchStage('slitting', { inputMeter: v })} /></Field>
              <Field label="Output (kg)"><Num value={card.slitting.outputKg} onChange={(v) => patchStage('slitting', { outputKg: v })} /></Field>
              <Field label="Output (meter)"><Num value={card.slitting.outputMeter} onChange={(v) => patchStage('slitting', { outputMeter: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.slitting.balanceKg} onChange={(v) => patchStage('slitting', { balanceKg: v })} /></Field>
              <Field label="Balance (meter)"><Num value={card.slitting.balanceMeter} onChange={(v) => patchStage('slitting', { balanceMeter: v })} /></Field>
              <Field label="Wastage (kg)"><Num value={card.slitting.rejectionKg} onChange={(v) => patchStage('slitting', { rejectionKg: v })} /></Field>
            </div>
            <CarryBtn from="slitting" />
          </StageCard>

          {!isScoped && card.makingType === 'Roll' && (
            <div className="glass-card p-4 flex items-center justify-between gap-3 flex-wrap no-print border-accent/30">
              <div>
                <p className="text-white font-medium text-sm">Roll ready for dispatch</p>
                <p className="text-muted text-xs">Roll-making job — dispatch finished rolls from the slitting output.</p>
              </div>
              <button onClick={() => sendToDispatch('Roll')} disabled={!!card.rollDispatchedAt}
                className={cn('btn-primary', card.rollDispatchedAt && 'opacity-50 cursor-not-allowed')}>
                <Truck className="w-4 h-4" /> {card.rollDispatchedAt ? 'Roll Dispatched' : 'Send to Dispatch'}
              </button>
            </div>
          )}

          {/* C4 — Lamination */}
          <StageCard jobKey="lamination" card={card} expanded={expanded.has('lamination')} onToggle={() => toggleExpand('lamination')} onSetNA={(na) => setNA('lamination', na)} stageFilter={staffStage}>
            <StageWho brand={brand} operator={card.lamination.operator} onOperator={(v) => patchStage('lamination', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.lamination.date} onChange={(v) => patchStage('lamination', { date: v })} /></Field>
              <Field label="Fabric Type">
                <select className="input-field" value={card.lamination.fabricType ?? ''} onChange={(e) => patchStage('lamination', { fabricType: (e.target.value || undefined) as FabricType | undefined })}>
                  <option value="">—</option>{FABRIC_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Roll No"><Txt value={card.lamination.rollNo} onChange={(v) => patchStage('lamination', { rollNo: v })} /></Field>
              <Field label="Size"><Txt value={card.lamination.size} onChange={(v) => patchStage('lamination', { size: v })} /></Field>
              <Field label="GRM"><Num value={card.lamination.grm} onChange={(v) => patchStage('lamination', { grm: v })} /></Field>
              <Field label="Coating side">
                <select className="input-field" value={card.lamination.coatingSide ?? ''} onChange={(e) => patchStage('lamination', { coatingSide: (e.target.value || undefined) as CoatingSide | undefined })}>
                  <option value="">—</option>{COATING_SIDES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            {/* Per-roll consumption, same as Printing */}
            <RollUsesPanel value={card.lamination.rollUses ?? []} onChange={(u) => patchStage('lamination', { rollUses: u })}
              kinds={['roll']} title="Rolls consumed — one line per roll" />

            {/* P.P. / Filler / LD come from RAW MATERIALS (manual batch-pick), not P.P. Granule Stock */}
            <StageMaterials stageKey="lamination" />
            <p className="text-muted text-[11px]">P.P., Filler and LD are drawn from Raw Materials — this stage no longer touches P.P. Granule Stock.</p>
            <CarryBtn from="lamination" />
          </StageCard>

          {/* C5 — Cutting: BCS or Back Seal */}
          <StageCard jobKey="cutting" card={card} expanded={expanded.has('cutting')} onToggle={() => toggleExpand('cutting')} onSetNA={(na) => setNA('cutting', na)} stageFilter={staffStage}>
            <StageWho brand={brand} operator={card.cutting.operator} onOperator={(v) => patchStage('cutting', { operator: v })} />
            {lockedMethod ? (
              <p className="text-xs text-muted">Cutting method: <span className="text-white/80 font-medium">{cutMethod}</span> <span className="text-muted/70">(your assigned process)</span></p>
            ) : (
              <Field label="Cutting Method">
                <div className="flex gap-2">
                  {CUTTING_METHODS.map((mth) => (
                    <button key={mth} type="button" onClick={() => patchStage('cutting', { method: mth as CuttingMethod })}
                      className={cn('px-4 py-1.5 rounded text-sm font-medium transition-colors',
                        cutMethod === mth ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white')}>
                      {mth}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {cutMethod === 'BCS' ? (<>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Date"><DateInput value={card.cutting.date} onChange={(v) => patchStage('cutting', { date: v })} /></Field>
                <Field label="Balance (kg)"><Num value={card.cutting.balance} onChange={(v) => patchStage('cutting', { balance: v })} /></Field>
                <Field label="Wastage (kg)"><Num value={card.cutting.rejectionKg} onChange={(v) => patchStage('cutting', { rejectionKg: v })} /></Field>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-primary" checked={card.cutting.gusset} onChange={(e) => patchStage('cutting', { gusset: e.target.checked })} /> Gusset</label>
                <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-primary" checked={card.cutting.perforation} onChange={(e) => patchStage('cutting', { perforation: e.target.checked })} /> Perforation</label>
              </div>
              <p className="label !mb-1">Rows (up to 3): Input · No. of Bags · BCS machine</p>
              {card.cutting.rows.slice(0, 3).map((r, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <Num value={r.inputKg} onChange={(v) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], inputKg: v }; patchStage('cutting', { rows }); }} placeholder="Input kg" />
                  <Num value={r.noOfBags} onChange={(v) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], noOfBags: v }; patchStage('cutting', { rows }); }} placeholder="No. of Bags" />
                  <select className="input-field" value={r.machine ?? ''} onChange={(e) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], machine: e.target.value || undefined }; patchStage('cutting', { rows }); }}>
                    <option value="">BCS / machine</option>
                    {cuttingMachines.map((mc) => <option key={mc.id} value={mc.name}>{mc.name}</option>)}
                    {r.machine && !cuttingMachines.some((mc) => mc.name === r.machine) && <option>{r.machine}</option>}
                  </select>
                </div>
              ))}
              {card.cutting.rows.length < 3 && <button onClick={() => patchStage('cutting', { rows: [...card.cutting.rows, {}] })} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add row</button>}

              {/* Thread suggestion % (sticky global default) → drives the thread quick-add chip */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-muted">Thread auto %:</span>
                <input className="input-field font-mono w-20 py-1 text-sm" type="number" min="0" step="any"
                  value={card.cutting.threadPct ?? threadPct}
                  onChange={(e) => setThreadPct(e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0))} />
                <span className="text-muted">% of cutting input ({stagePrimary(card, 'cutting').input} kg) = <span className="text-white/80 font-mono">{threadQty} kg</span> · new % becomes the global default</span>
              </div>
              <StageMaterials stageKey="cutting" />
            </>) : (<>
              {/* Back Seal */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Date"><DateInput value={card.cutting.date} onChange={(v) => patchStage('cutting', { date: v })} /></Field>
                <Field label="Input (kg)"><Num value={card.cutting.bsInputKg} onChange={(v) => patchStage('cutting', { bsInputKg: v })} /></Field>
                <Field label="Balance (kg)"><Num value={card.cutting.bsBalanceKg} onChange={(v) => patchStage('cutting', { bsBalanceKg: v })} /></Field>
                <Field label="No. of Pieces"><Num value={card.cutting.bsPieces} onChange={(v) => patchStage('cutting', { bsPieces: v })} /></Field>
                <Field label="Wastage (kg)"><Num value={card.cutting.rejectionKg} onChange={(v) => patchStage('cutting', { rejectionKg: v })} /></Field>
              </div>
              <StageMaterials stageKey="cutting" />
            </>)}
            <CarryBtn from="cutting" />
          </StageCard>

          {!isScoped && card.makingType !== 'Roll' && (
            <div className="glass-card p-4 flex items-center justify-between gap-3 flex-wrap no-print border-accent/30">
              <div>
                <p className="text-white font-medium text-sm">Bags ready for dispatch</p>
                <p className="text-muted text-xs">Dispatch finished bags from the cutting output.</p>
              </div>
              <button onClick={() => sendToDispatch('Bag')} disabled={!!card.bagDispatchedAt}
                className={cn('btn-primary', card.bagDispatchedAt && 'opacity-50 cursor-not-allowed')}>
                <Truck className="w-4 h-4" /> {card.bagDispatchedAt ? 'Bags Dispatched' : 'Send to Dispatch'}
              </button>
            </div>
          )}
          </>)}

          {/* ════ Other/Flexo card ════ */}
          {card.cardType === 'Other' && (<>
          <StageCard jobKey="lamination" card={card} expanded={expanded.has('lamination')} onToggle={() => toggleExpand('lamination')} onSetNA={(na) => setNA('lamination', na)} stageFilter={staffStage}>
            <StageWho brand={brand} operator={card.lamination.operator} onOperator={(v) => patchStage('lamination', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.lamination.date} onChange={(v) => patchStage('lamination', { date: v })} /></Field>
              <Field label="Fabric Type">
                <select className="input-field" value={card.lamination.fabricType ?? ''} onChange={(e) => patchStage('lamination', { fabricType: (e.target.value || undefined) as FabricType | undefined })}>
                  <option value="">—</option>{FABRIC_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Roll No"><Txt value={card.lamination.rollNo} onChange={(v) => patchStage('lamination', { rollNo: v })} /></Field>
              <Field label="Size"><Txt value={card.lamination.size} onChange={(v) => patchStage('lamination', { size: v })} /></Field>
              <Field label="Input (kg)"><Num value={card.lamination.inputKg} onChange={(v) => patchStage('lamination', { inputKg: v })} /></Field>
              <Field label="Output (kg)"><Num value={card.lamination.outputKg} onChange={(v) => patchStage('lamination', { outputKg: v })} /></Field>
              <Field label="Balance Roll No"><Txt value={card.lamination.balanceRollNo} onChange={(v) => patchStage('lamination', { balanceRollNo: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.lamination.balanceKg} onChange={(v) => patchStage('lamination', { balanceKg: v })} /></Field>
            </div>
            <RollUsesPanel value={card.lamination.rollUses ?? []} onChange={(u) => patchStage('lamination', { rollUses: u })}
              kinds={['roll']} title="Rolls consumed — one line per roll" />
            <StageMaterials stageKey="lamination" />
            <CarryBtn from="lamination" />
          </StageCard>

          <StageCard jobKey="cutting" card={card} expanded={expanded.has('cutting')} onToggle={() => toggleExpand('cutting')} onSetNA={(na) => setNA('cutting', na)} stageFilter={staffStage}>
            <StageWho brand={brand} operator={card.cutting.operator} onOperator={(v) => patchStage('cutting', { operator: v })} />
            {lockedMethod ? (
              <p className="text-xs text-muted">Cutting method: <span className="text-white/80 font-medium">{cutMethod}</span> <span className="text-muted/70">(your assigned process)</span></p>
            ) : (
              <Field label="Cutting Method">
                <div className="flex gap-2">
                  {CUTTING_METHODS.map((mth) => (
                    <button key={mth} type="button" onClick={() => patchStage('cutting', { method: mth as CuttingMethod })}
                      className={cn('px-4 py-1.5 rounded text-sm font-medium transition-colors',
                        cutMethod === mth ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white')}>
                      {mth}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {cutMethod === 'BCS' ? (<>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Date"><DateInput value={card.cutting.date} onChange={(v) => patchStage('cutting', { date: v })} /></Field>
                <Field label="Balance (kg)"><Num value={card.cutting.balance} onChange={(v) => patchStage('cutting', { balance: v })} /></Field>
                <Field label="Wastage (kg)"><Num value={card.cutting.rejectionKg} onChange={(v) => patchStage('cutting', { rejectionKg: v })} /></Field>
              </div>
              {card.cutting.rows.slice(0, 3).map((r, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <Num value={r.inputKg} onChange={(v) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], inputKg: v }; patchStage('cutting', { rows }); }} placeholder="Input kg" />
                  <Num value={r.noOfBags} onChange={(v) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], noOfBags: v }; patchStage('cutting', { rows }); }} placeholder="No. of Bags" />
                  <select className="input-field" value={r.machine ?? ''} onChange={(e) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], machine: e.target.value || undefined }; patchStage('cutting', { rows }); }}>
                    <option value="">BCS / machine</option>
                    {cuttingMachines.map((mc) => <option key={mc.id} value={mc.name}>{mc.name}</option>)}
                  </select>
                </div>
              ))}
              {card.cutting.rows.length < 3 && <button onClick={() => patchStage('cutting', { rows: [...card.cutting.rows, {}] })} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add row</button>}
              <StageMaterials stageKey="cutting" />
            </>) : (<>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Date"><DateInput value={card.cutting.date} onChange={(v) => patchStage('cutting', { date: v })} /></Field>
                <Field label="Input (kg)"><Num value={card.cutting.bsInputKg} onChange={(v) => patchStage('cutting', { bsInputKg: v })} /></Field>
                <Field label="Balance (kg)"><Num value={card.cutting.bsBalanceKg} onChange={(v) => patchStage('cutting', { bsBalanceKg: v })} /></Field>
                <Field label="No. of Pieces"><Num value={card.cutting.bsPieces} onChange={(v) => patchStage('cutting', { bsPieces: v })} /></Field>
                <Field label="Wastage (kg)"><Num value={card.cutting.rejectionKg} onChange={(v) => patchStage('cutting', { rejectionKg: v })} /></Field>
              </div>
              <StageMaterials stageKey="cutting" />
            </>)}
            <CarryBtn from="cutting" />
          </StageCard>

          <StageCard jobKey="printing" card={card} expanded={expanded.has('printing')} onToggle={() => toggleExpand('printing')} onSetNA={(na) => setNA('printing', na)} stageFilter={staffStage} label="Flexo">
            <StageWho brand={brand} operator={card.printing.operator} onOperator={(v) => patchStage('printing', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.printing.date} onChange={(v) => patchStage('printing', { date: v })} /></Field>
              <Field label="Input (kg)"><Num value={card.printing.inputKg} onChange={(v) => patchStage('printing', { inputKg: v })} /></Field>
              <Field label="No. of Bags"><Num value={card.printing.noOfBags} onChange={(v) => patchStage('printing', { noOfBags: v })} /></Field>
              <Field label="Colour of print"><Txt value={card.printing.colour} onChange={(v) => patchStage('printing', { colour: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.printing.balanceKg} onChange={(v) => patchStage('printing', { balanceKg: v })} /></Field>
              <Field label="Wastage (kg)"><Num value={card.printing.rejectionKg} onChange={(v) => patchStage('printing', { rejectionKg: v })} /></Field>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-muted">Ink auto %:</span>
              <input className="input-field font-mono w-20 py-1 text-sm" type="number" min="0" step="any"
                value={card.printing.inkPct ?? inkPct}
                onChange={(e) => setInkPct(e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0))} />
              <span className="text-muted">% of input ({card.printing.inputKg ?? 0} kg) = <span className="text-white/80 font-mono">{inkQty} kg</span></span>
            </div>
            <StageMaterials stageKey="printing" />
          </StageCard>

          {!isScoped && (
          <div className="glass-card p-4 flex items-center justify-between gap-3 flex-wrap no-print border-accent/30">
            <div>
              <p className="text-white font-medium text-sm">Printed bags ready for dispatch</p>
              <p className="text-muted text-xs">Dispatch finished printed bags.</p>
            </div>
            <button onClick={() => sendToDispatch('Bag')} disabled={!!card.bagDispatchedAt}
              className={cn('btn-primary', card.bagDispatchedAt && 'opacity-50 cursor-not-allowed')}>
              <Truck className="w-4 h-4" /> {card.bagDispatchedAt ? 'Bags Dispatched' : 'Send to Dispatch'}
            </button>
          </div>
          )}
          </>)}

          {/* C6 — Dispatch: summary, carried-over balance, lines (kg + bags), button below */}
          <StageCard jobKey="dispatch" card={card} expanded={expanded.has('dispatch')} onToggle={() => toggleExpand('dispatch')} onSetNA={(na) => setNA('dispatch', na)} stageFilter={staffStage}>
            <StageWho brand={brand} operator={card.dispatch.operator} onOperator={(v) => patchStage('dispatch', { operator: v })} />

            {/* Summary — Made / Dispatched / Ready, all from real entries */}
            {(() => { const b = cardReadyToDispatch(card, jobCardsDb.getAll()); return (
              <div className="rounded-lg bg-navy/40 border border-white/10 px-3 py-2 text-sm flex flex-wrap gap-x-5 gap-y-1">
                <span className="text-muted">Made: <span className="font-mono text-white">{b.madePcs.toLocaleString('en-IN')}</span>{b.isEstimate && <span className="text-yellow-300 text-[10px] ml-1">est.</span>}</span>
                <span className="text-muted">Dispatched: <span className="font-mono text-white">{b.dispatchedPcs.toLocaleString('en-IN')}</span></span>
                <span className="text-muted">Ready to dispatch: <span className={cn('font-mono', b.readyPcs > 0 ? 'text-amber-300' : 'text-white')}>{b.readyPcs.toLocaleString('en-IN')}</span></span>
              </div>
            ); })()}

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Field label="Date"><DateInput value={card.dispatch.date} onChange={(v) => patchStage('dispatch', { date: v })} /></Field>
              <Field label="No. of Bales"><Num value={card.dispatch.noOfBales} onChange={(v) => patchStage('dispatch', { noOfBales: v })} /></Field>
              <Field label="Balance in kg"><Num value={card.dispatch.balanceKg} onChange={(v) => patchStage('dispatch', { balanceKg: v })} /></Field>
              {/* Balance in Nos — computed ready-to-dispatch bag balance (Made − Dispatched) */}
              <Field label="Balance in Nos">
                {(() => { const b = cardReadyToDispatch(card, jobCardsDb.getAll()); return (
                  <input className={cn('input-field font-mono bg-white/5', b.readyPcs > 0 && 'text-amber-300')} readOnly
                    value={b.readyPcs.toLocaleString('en-IN')} title="Bags still ready to dispatch (Made − Dispatched)" />
                ); })()}
              </Field>
              <Field label="Bags per bale"><Num value={card.dispatch.bagsPerBale} onChange={(v) => patchStage('dispatch', { bagsPerBale: v })} placeholder="100" /></Field>
            </div>

            <p className="label !mb-1">Dispatch lines: Qty (kg) · Qty (bags) · Date — either qty may be blank</p>
            {card.dispatch.lines.map((l, i) => (
              <div key={i} className="space-y-1">
                {l.fromCardId && (
                  <span className="inline-block badge bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px]">
                    Carried from {l.fromLabel}: {(l.pieces || 0).toLocaleString('en-IN')} bags
                  </span>
                )}
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <Num value={l.quantityKg} onChange={(v) => { const lines = [...card.dispatch.lines]; lines[i] = { ...lines[i], quantityKg: v }; patchStage('dispatch', { lines }); }} placeholder="Qty kg" />
                  <Num value={l.pieces} onChange={(v) => { const lines = [...card.dispatch.lines]; lines[i] = { ...lines[i], pieces: v }; patchStage('dispatch', { lines }); }} placeholder="Qty bags" />
                  <DateInput value={l.dispatchDate} onChange={(v) => { const lines = [...card.dispatch.lines]; lines[i] = { ...lines[i], dispatchDate: v }; patchStage('dispatch', { lines }); }} />
                  <button type="button" onClick={() => patchStage('dispatch', { lines: card.dispatch.lines.filter((_, j) => j !== i) })}
                    className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400" title="Remove line"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            <button onClick={() => patchStage('dispatch', { lines: [...card.dispatch.lines, {}] })} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add dispatch line</button>

            {/* Dispatch button sits below the fields */}
            <div className="pt-2 border-t border-white/5">
              <button onClick={() => sendToDispatch(card.makingType === 'Roll' ? 'Roll' : 'Bag')}
                disabled={card.makingType === 'Roll' ? !!card.rollDispatchedAt : !!card.bagDispatchedAt}
                className={cn('btn-primary w-full justify-center',
                  (card.makingType === 'Roll' ? card.rollDispatchedAt : card.bagDispatchedAt) && 'opacity-50 cursor-not-allowed')}>
                <Truck className="w-4 h-4" />
                {(card.makingType === 'Roll' ? card.rollDispatchedAt : card.bagDispatchedAt) ? 'Dispatched' : 'Send to Dispatch'}
              </button>
            </div>
          </StageCard>
        </div>

        {/* Right: sticky costing summary */}
        {showCosts && cost && (
          <div className="lg:col-span-1">
            <div className="glass-card p-5 space-y-4 lg:sticky lg:top-4">
              <div className="flex items-center justify-between">
                <p className="section-title text-base">Costing Summary</p>
                <IndianRupee className="w-4 h-4 text-accent" />
              </div>
              {cost.hasUnsetRates && (
                <div className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Some consumed stock has no rate set — excluded from the total.
                </div>
              )}
              <table className="w-full text-sm">
                <tbody>
                  {STAGE_KEYS.map((k) => {
                    const active = !card[k].na;
                    return (
                      <tr key={k} className="border-b border-white/5">
                        <td className="py-1.5 text-white/70">{STAGE_LABEL[k]}{!active && <span className="text-muted text-xs ml-1">(N/A)</span>}</td>
                        <td className="py-1.5 text-right font-mono text-white/80">{active ? formatINR(stageCost(card, k)) : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-b border-white/5">
                    <td className="py-1.5 text-muted text-xs">Materials subtotal</td>
                    <td className="py-1.5 text-right font-mono text-white/70 text-xs">{formatINR(cost.materialCost)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Auto labour & overhead — Rate Master (₹/kg) × final output kg */}
              <div className="rounded-lg border border-accent/10 overflow-hidden">
                <div className="px-3 py-1.5 bg-navy/40 text-[11px] text-muted uppercase tracking-wide">
                  Labour &amp; overhead · auto on {cost.finalOutputKg.toLocaleString('en-IN')} kg output
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {cost.labourLines.length === 0 ? (
                      <tr><td className="px-3 py-2 text-muted">No labour/overhead rates set in Rate Master.</td></tr>
                    ) : cost.labourLines.map((l) => (
                      <tr key={l.name} className="border-t border-white/5">
                        <td className="px-3 py-1.5 text-white/75">{l.name} <span className="text-muted">@ {l.rate == null ? '—' : `₹${l.rate}/kg`}</span></td>
                        <td className="px-3 py-1.5 text-right font-mono text-white/70">
                          {l.rate == null ? <span className="text-yellow-300">rate not set</span> : formatINR(l.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t border-accent/20 bg-navy/40">
                    <td className="px-3 py-1.5 text-muted">Labour subtotal</td>
                    <td className="px-3 py-1.5 text-right font-mono text-white/80">{formatINR(cost.labourCost)}</td>
                  </tr></tfoot>
                </table>
              </div>

              <table className="w-full text-sm">
                <tfoot>
                  <tr className="border-t border-accent/30">
                    <td className="py-2 text-white font-semibold">Total Job Cost</td>
                    <td className="py-2 text-right font-mono text-accent font-bold">{formatINR(cost.totalJobCost)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-navy/40 rounded-lg p-2.5"><p className="text-muted text-xs">Cost / bag</p><p className="font-mono text-white">{formatINR(cost.costPerBag)}</p></div>
                <div className="bg-navy/40 rounded-lg p-2.5"><p className="text-muted text-xs">Cost / kg</p><p className="font-mono text-white">{formatINR(cost.costPerKg)}</p></div>
                <div className="bg-navy/40 rounded-lg p-2.5"><p className="text-muted text-xs">Total bags</p><p className="font-mono text-white">{cost.totalBags.toLocaleString('en-IN')}</p></div>
                <div className="bg-navy/40 rounded-lg p-2.5"><p className="text-muted text-xs">Wastage</p><p className="font-mono text-white">{cost.wastageKg.toFixed(1)} kg</p></div>
                <div className="bg-navy/40 rounded-lg p-2.5 col-span-2"><p className="text-muted text-xs">Overall yield</p><p className="font-mono text-white">{cost.overallYieldPct.toFixed(1)}%</p></div>
              </div>
              {card.ratesAsOf && <p className="text-muted text-[11px]">Rates as of {new Date(card.ratesAsOf).toLocaleDateString('en-IN')}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
