import { useState, useMemo, useCallback, ReactNode } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Save, Printer, ArrowLeft, AlertTriangle,
  IndianRupee, Plus, Trash2, Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  jobCardsDb, rateMasterDb, dispatchesDb, ordersDb, rawMaterialsDb,
  syncBatchStock, consumeRoll, factoryMachinesDb, getList,
} from '../lib/db';
import {
  FINISHES, JOB_STAGES, JOBCARD_STATUSES, FABRIC_TYPES, COATING_SIDES,
  BAG_TYPES_KEY, DEFAULT_BAG_TYPES, CUTTING_METHODS,
  INK_PCT_KEY, THREAD_PCT_KEY, DEFAULT_INK_PCT, DEFAULT_THREAD_PCT,
  PRINTING_INK, PRINTING_SOLVENTS, METALIZE_MATERIALS, LAMINATION_MATERIALS,
  BCS_THREAD, BACKSEAL_GLUE,
} from '../config';
import type { Finish, JobStage, JobCardStatus, FabricType, CoatingSide, CuttingMethod } from '../config';
import type { JobCard, RateMasterItem, Consumption, DispatchRecord, RollUse } from '../types/models';
import { MaterialLine, AddMaterial, previewAllocation } from '../components/ui/MaterialConsumption';
import { RollUsesPanel } from '../components/ui/RollUses';
import {
  emptyJobCard, normalizeJobCard, genJobNo, STAGE_KEYS, STAGE_LABEL,
  stageMetrics, stageCost, computeCosting, buildLabourConsumption, formatINR,
  prevActiveStage, nextActiveStage, stagePrimary, visibleStageKeys, totalBags,
  autoPct, autoQty,
} from '../lib/jobcard';
import type { StageKey } from '../lib/jobcard';
import { canViewCosts } from '../lib/roles';
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

// ── Labour / overhead lines (Rate Master) ──────────────────────────────────────
function LabourEditor({ stage, items, consumption, showCosts, onChange }: {
  stage: JobStage; items: RateMasterItem[]; consumption: Consumption[];
  showCosts: boolean; onChange: (rows: Consumption[]) => void;
}) {
  const labour = consumption.filter((c) => c.source === 'labour');
  const rows = buildLabourConsumption(items, stage, labour);
  if (rows.length === 0) return null;

  function setQty(materialId: string, qty: number) {
    const next = rows.map((r) => (r.materialId === materialId
      ? { ...r, qty, lineCost: r.rateSnapshot != null ? qty * r.rateSnapshot : 0 }
      : r));
    onChange([...consumption.filter((c) => c.source !== 'labour'), ...next]);
  }

  const total = rows.reduce((s, r) => s + r.lineCost, 0);
  return (
    <div className="rounded-lg border border-accent/10 overflow-hidden">
      <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide">Labour &amp; overheads</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.materialId} className="border-t border-white/5">
              <td className="px-3 py-2 text-white/80">{r.materialName}</td>
              <td className="py-2 px-2 w-24">
                <input className="input-field font-mono py-1 text-sm text-right" type="number" min="0" step="any"
                  value={r.qty || ''} onChange={(e) => setQty(r.materialId, Math.max(0, parseFloat(e.target.value) || 0))} />
              </td>
              <td className="py-2 pr-3 text-muted text-xs">{r.unit.replace(/^₹\s*\/\s*/, '')}</td>
              {showCosts && (
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {r.rateSnapshot == null ? <span className="text-yellow-300">rate not set</span> : <span className="text-white/70">{formatINR(r.lineCost)}</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {showCosts && (
          <tfoot><tr className="border-t border-accent/20 bg-navy/40">
            <td className="px-3 py-2 text-muted text-xs" colSpan={3}>Stage labour</td>
            <td className="px-3 py-2 text-right font-mono text-white font-semibold">{formatINR(total)}</td>
          </tr></tfoot>
        )}
      </table>
    </div>
  );
}

// ── Stage shell (collapsible + N/A + metrics) ──────────────────────────────────
function StageCard({ jobKey, card, expanded, onToggle, onSetNA, children, label }: {
  jobKey: StageKey; card: JobCard; expanded: boolean;
  onToggle: () => void; onSetNA: (na: boolean) => void; children: ReactNode; label?: string;
}) {
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
  const [items] = useState<RateMasterItem[]>(() => rateMasterDb.getAll());
  const showCosts = canViewCosts();
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

  // Material consumption on a stage: set a quantity and preview its FIFO draw.
  function setMaterialQty(key: StageKey, materialId: string, qty: number) {
    setCard((p) => {
      if (!p) return p;
      const existing = p[key].consumption.find((c) => c.materialId === materialId);
      const row = previewAllocation(materialId, qty, existing);
      const rest = p[key].consumption.filter((c) => c.materialId !== materialId);
      return { ...p, [key]: { ...p[key], consumption: [...rest, row] } } as JobCard;
    });
  }
  function removeMaterial(key: StageKey, materialId: string) {
    setCard((p) => p && ({ ...p, [key]: { ...p[key], consumption: p[key].consumption.filter((c) => c.materialId !== materialId) } } as JobCard));
  }
  // Look up a raw-material id by name (case-insensitive) for the fixed per-stage lists.
  const materialIdByName = useCallback((name: string) => {
    const m = rawMaterialsDb.getAll().find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    return m?.id;
  }, []);

  function batchRows(key: StageKey): Consumption[] {
    return card![key].consumption.filter((c) => c.source !== 'labour');
  }
  // Render a fixed named material line, creating an empty row if it has none yet.
  function namedRow(key: StageKey, name: string): Consumption | null {
    const id = materialIdByName(name);
    if (!id) return null;
    const found = card![key].consumption.find((c) => c.materialId === id);
    return found ?? { materialId: id, materialName: name, unit: rawMaterialsDb.getAll().find((m) => m.id === id)?.unit ?? 'kg', qty: 0, rateSnapshot: null, lineCost: 0, lots: [], source: 'batch' };
  }

  function carryForward(fromKey: StageKey) {
    setCard((p) => {
      if (!p) return p;
      const next = nextActiveStage(p, fromKey);
      if (!next) return p;
      const out = stagePrimary(p, fromKey).output;
      if (out <= 0) return p;
      const clone = { ...p } as JobCard;
      const setIfEmpty = (cur: number | undefined) => (cur == null || cur === 0 ? out : cur);
      if (next === 'metalize') clone.metalize = { ...clone.metalize, boppInputKg: setIfEmpty(clone.metalize.boppInputKg) };
      else if (next === 'slitting') clone.slitting = { ...clone.slitting, inputKg: setIfEmpty(clone.slitting.inputKg) };
      else if (next === 'lamination') {
        const rows = clone.lamination.rows.length ? [...clone.lamination.rows] : [{}];
        rows[0] = { ...rows[0], boppInKg: setIfEmpty(rows[0].boppInKg) };
        clone.lamination = { ...clone.lamination, rows };
      } else if (next === 'cutting') {
        if (clone.cutting.method === 'Back Seal') clone.cutting = { ...clone.cutting, bsInputKg: setIfEmpty(clone.cutting.bsInputKg) };
        else {
          const rows = clone.cutting.rows.length ? [...clone.cutting.rows] : [{}];
          rows[0] = { ...rows[0], inputKg: setIfEmpty(rows[0].inputKg) };
          clone.cutting = { ...clone.cutting, rows };
        }
      }
      return clone;
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

  // Fixed named material line for a stage (ink/solvents/adhesive/…).
  const renderNamed = (key: StageKey, name: string, opts?: { readOnlyQty?: boolean; hint?: string; label?: string }) => {
    const row = namedRow(key, name);
    if (!row) {
      return (
        <p key={name} className="text-[11px] text-yellow-300/90">
          "{name}" is not in Raw Materials — add it there to consume and cost it.
        </p>
      );
    }
    return (
      <MaterialLine key={name} row={row} label={opts?.label} hint={opts?.hint} readOnlyQty={opts?.readOnlyQty}
        onQty={(q) => setMaterialQty(key, row.materialId, q)} />
    );
  };

  const fixedNames = (key: StageKey): string[] =>
    key === 'printing' ? [PRINTING_INK, ...PRINTING_SOLVENTS]
    : key === 'metalize' ? METALIZE_MATERIALS
    : key === 'lamination' ? LAMINATION_MATERIALS
    : key === 'cutting' ? [BCS_THREAD, BACKSEAL_GLUE]
    : [];

  // Extra ad-hoc materials the operator added beyond the fixed per-stage list.
  const extraRows = (key: StageKey) => {
    const fixedIds = fixedNames(key).map(materialIdByName).filter(Boolean) as string[];
    return batchRows(key).filter((r) => !fixedIds.includes(r.materialId));
  };

  const MaterialsBlock = ({ stageKey }: { stageKey: StageKey }) => (
    <div className="rounded-lg border border-accent/10 overflow-hidden">
      <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide flex items-center gap-1.5">
        <IndianRupee className="w-3 h-3" /> Materials from Raw Materials — costed at batch rate
      </div>
      <div className="p-3 space-y-2">
        {extraRows(stageKey).map((r) => (
          <MaterialLine key={r.materialId} row={r}
            onQty={(q) => setMaterialQty(stageKey, r.materialId, q)}
            onRemove={() => removeMaterial(stageKey, r.materialId)} />
        ))}
        <AddMaterial exclude={batchRows(stageKey).map((r) => r.materialId)} onAdd={(mid) => setMaterialQty(stageKey, mid, 0)} />
      </div>
    </div>
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
            <h1 className="page-header">{card.jobNo || 'New Job Card'}</h1>
            <p className="text-muted text-sm mt-0.5">Order traveler — fill each stage as the order moves</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => window.print()} className="btn-secondary"><Printer className="w-4 h-4" /> Print</button>
          <button onClick={() => persist(card)} className="btn-primary"><Save className="w-4 h-4" /> Save</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <div className="glass-card p-4 space-y-3">
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
          <StageCard jobKey="printing" card={card} expanded={expanded.has('printing')} onToggle={() => toggleExpand('printing')} onSetNA={(na) => setNA('printing', na)}>
            <StageWho brand={brand} operator={card.printing.operator} onOperator={(v) => patchStage('printing', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.printing.date} onChange={(v) => patchStage('printing', { date: v })} /></Field>
              <Field label="BOPP Input (kg)"><Num value={card.printing.inputKg} onChange={(v) => patchStage('printing', { inputKg: v })} /></Field>
              <Field label="BOPP Size"><Txt value={card.printing.boppSize} onChange={(v) => patchStage('printing', { boppSize: v })} placeholder="520" /></Field>
              <Field label="BOPP Roll No"><Txt value={card.printing.boppRollNo} onChange={(v) => patchStage('printing', { boppRollNo: v })} /></Field>
              <Field label="BOPP Type"><Txt value={card.printing.boppType} onChange={(v) => patchStage('printing', { boppType: v })} placeholder="Glossy / Matte" /></Field>
              <Field label="Balance BOPP (kg)"><Num value={card.printing.balanceKg} onChange={(v) => patchStage('printing', { balanceKg: v })} /></Field>
              <Field label="Output (kg)"><Num value={card.printing.outputKg} onChange={(v) => patchStage('printing', { outputKg: v })} /></Field>
              <Field label="Output (meter)"><Num value={card.printing.meter} onChange={(v) => patchStage('printing', { meter: v })} /></Field>
              <Field label="Wastage (kg)"><Num value={card.printing.rejectionKg} onChange={(v) => patchStage('printing', { rejectionKg: v })} /></Field>
            </div>
            <button onClick={() => carryForward('printing')} className="text-xs text-accent hover:underline">↳ Carry output to next stage input</button>

            {/* Per-roll BOPP consumption — one line per roll used */}
            <RollUsesPanel value={card.printing.rollUses ?? []} onChange={(u) => patchStage('printing', { rollUses: u })}
              title="BOPP roll / film consumed — one line per roll" />

            {/* Auto-calculated ink + manual solvents, all from Raw Materials */}
            <div className="rounded-lg border border-accent/10 overflow-hidden">
              <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide flex items-center gap-1.5">
                <IndianRupee className="w-3 h-3" /> Materials from Raw Materials — costed at batch rate
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-muted">Ink auto-calc:</span>
                  <input className="input-field font-mono w-20 py-1 text-sm" type="number" min="0" step="any"
                    value={card.printing.inkPct ?? inkPct}
                    onChange={(e) => patchStage('printing', { inkPct: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) })} />
                  <span className="text-muted">% of BOPP input ({card.printing.inputKg ?? 0} kg) = <span className="text-white/80 font-mono">{inkQty} kg</span></span>
                  {card.printing.inkPct != null && (
                    <button onClick={() => patchStage('printing', { inkPct: undefined })} className="text-accent hover:underline">reset to default</button>
                  )}
                </div>
                {(() => {
                  const row = namedRow('printing', PRINTING_INK);
                  if (!row) return <p className="text-[11px] text-yellow-300/90">"{PRINTING_INK}" is not in Raw Materials — add it there to consume and cost it.</p>;
                  // Keep the stored qty in step with the auto-calc unless overridden.
                  const shown = row.qty || inkQty;
                  const live = shown === row.qty ? row : previewAllocation(row.materialId, inkQty, row);
                  return <MaterialLine row={live} label={`${PRINTING_INK} (auto)`} hint="Auto-filled from the % above — type over it to override."
                    onQty={(q) => setMaterialQty('printing', row.materialId, q)} />;
                })()}
                {PRINTING_SOLVENTS.map((n) => renderNamed('printing', n, { hint: 'Manual entry' }))}
                {extraRows('printing').filter((r) => ![PRINTING_INK, ...PRINTING_SOLVENTS].map((n) => materialIdByName(n)).includes(r.materialId)).map((r) => (
                  <MaterialLine key={r.materialId} row={r} onQty={(q) => setMaterialQty('printing', r.materialId, q)} onRemove={() => removeMaterial('printing', r.materialId)} />
                ))}
                <AddMaterial exclude={batchRows('printing').map((r) => r.materialId)} onAdd={(mid) => setMaterialQty('printing', mid, 0)} />
              </div>
            </div>
            <LabourEditor stage="Printing" items={items} consumption={card.printing.consumption} showCosts={showCosts} onChange={(rows) => patchStage('printing', { consumption: rows })} />
          </StageCard>

          {/* C3 — Metalize */}
          <StageCard jobKey="metalize" card={card} expanded={expanded.has('metalize')} onToggle={() => toggleExpand('metalize')} onSetNA={(na) => setNA('metalize', na)}>
            <StageWho brand={brand} operator={card.metalize.operator} onOperator={(v) => patchStage('metalize', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.metalize.date} onChange={(v) => patchStage('metalize', { date: v })} /></Field>
              <Field label="Roll No"><Txt value={card.metalize.rollNo} onChange={(v) => patchStage('metalize', { rollNo: v })} /></Field>
              <Field label="Size"><Txt value={card.metalize.size} onChange={(v) => patchStage('metalize', { size: v })} /></Field>
              <Field label="Balance (roll)"><Txt value={card.metalize.rollBalance} onChange={(v) => patchStage('metalize', { rollBalance: v })} placeholder="balance roll no" /></Field>
              <Field label="BOPP Input (kg)"><Num value={card.metalize.boppInputKg} onChange={(v) => patchStage('metalize', { boppInputKg: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.metalize.balanceKg} onChange={(v) => patchStage('metalize', { balanceKg: v })} /></Field>
            </div>
            <button onClick={() => carryForward('metalize')} className="text-xs text-accent hover:underline">↳ Carry output to next stage input</button>
            <div className="rounded-lg border border-accent/10 overflow-hidden">
              <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide flex items-center gap-1.5">
                <IndianRupee className="w-3 h-3" /> Materials from Raw Materials — costed at batch rate
              </div>
              <div className="p-3 space-y-2">
                {METALIZE_MATERIALS.map((n) => renderNamed('metalize', n))}
                {extraRows('metalize').map((r) => (
                  <MaterialLine key={r.materialId} row={r} onQty={(q) => setMaterialQty('metalize', r.materialId, q)} onRemove={() => removeMaterial('metalize', r.materialId)} />
                ))}
                <AddMaterial exclude={batchRows('metalize').map((r) => r.materialId)} onAdd={(mid) => setMaterialQty('metalize', mid, 0)} />
              </div>
            </div>
            <LabourEditor stage="Metalize" items={items} consumption={card.metalize.consumption} showCosts={showCosts} onChange={(rows) => patchStage('metalize', { consumption: rows })} />
          </StageCard>

          {/* C2 — Slitting */}
          <StageCard jobKey="slitting" card={card} expanded={expanded.has('slitting')} onToggle={() => toggleExpand('slitting')} onSetNA={(na) => setNA('slitting', na)}>
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
            <button onClick={() => carryForward('slitting')} className="text-xs text-accent hover:underline block">↳ Carry output to next stage input</button>
            <LabourEditor stage="Slitting" items={items} consumption={card.slitting.consumption} showCosts={showCosts} onChange={(rows) => patchStage('slitting', { consumption: rows })} />
          </StageCard>

          {card.makingType === 'Roll' && (
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
          <StageCard jobKey="lamination" card={card} expanded={expanded.has('lamination')} onToggle={() => toggleExpand('lamination')} onSetNA={(na) => setNA('lamination', na)}>
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

            {/* P.P. / Filler / LD come from RAW MATERIALS, not P.P. Granule Stock */}
            <div className="rounded-lg border border-accent/10 overflow-hidden">
              <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide flex items-center gap-1.5">
                <IndianRupee className="w-3 h-3" /> Materials from Raw Materials — costed at batch rate
              </div>
              <div className="p-3 space-y-2">
                {LAMINATION_MATERIALS.map((n) => renderNamed('lamination', n))}
                {extraRows('lamination').map((r) => (
                  <MaterialLine key={r.materialId} row={r} onQty={(q) => setMaterialQty('lamination', r.materialId, q)} onRemove={() => removeMaterial('lamination', r.materialId)} />
                ))}
                <AddMaterial exclude={batchRows('lamination').map((r) => r.materialId)} onAdd={(mid) => setMaterialQty('lamination', mid, 0)} />
                <p className="text-muted text-[11px]">P.P., Filler and LD are drawn from Raw Materials — this stage no longer touches P.P. Granule Stock.</p>
              </div>
            </div>
            <button onClick={() => carryForward('lamination')} className="text-xs text-accent hover:underline block">↳ Carry output to next stage input</button>
            <LabourEditor stage="Lamination" items={items} consumption={card.lamination.consumption} showCosts={showCosts} onChange={(rows) => patchStage('lamination', { consumption: rows })} />
          </StageCard>

          {/* C5 — Cutting: BCS or Back Seal */}
          <StageCard jobKey="cutting" card={card} expanded={expanded.has('cutting')} onToggle={() => toggleExpand('cutting')} onSetNA={(na) => setNA('cutting', na)}>
            <StageWho brand={brand} operator={card.cutting.operator} onOperator={(v) => patchStage('cutting', { operator: v })} />
            <Field label="Cutting Method">
              <div className="flex gap-2">
                {CUTTING_METHODS.map((mth) => (
                  <button key={mth} type="button" onClick={() => patchStage('cutting', { method: mth as CuttingMethod })}
                    className={cn('px-4 py-1.5 rounded text-sm font-medium transition-colors',
                      (card.cutting.method ?? 'BCS') === mth ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white')}>
                    {mth}
                  </button>
                ))}
              </div>
            </Field>

            {(card.cutting.method ?? 'BCS') === 'BCS' ? (<>
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

              {/* Thread — auto-calculated like ink */}
              <div className="rounded-lg border border-accent/10 overflow-hidden">
                <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide flex items-center gap-1.5">
                  <IndianRupee className="w-3 h-3" /> Materials from Raw Materials — costed at batch rate
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-muted">Thread auto-calc:</span>
                    <input className="input-field font-mono w-20 py-1 text-sm" type="number" min="0" step="any"
                      value={card.cutting.threadPct ?? threadPct}
                      onChange={(e) => patchStage('cutting', { threadPct: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) })} />
                    <span className="text-muted">% of cutting input ({stagePrimary(card, 'cutting').input} kg) = <span className="text-white/80 font-mono">{threadQty} kg</span></span>
                    {card.cutting.threadPct != null && (
                      <button onClick={() => patchStage('cutting', { threadPct: undefined })} className="text-accent hover:underline">reset to default</button>
                    )}
                  </div>
                  {(() => {
                    const row = namedRow('cutting', BCS_THREAD);
                    if (!row) return <p className="text-[11px] text-yellow-300/90">"{BCS_THREAD}" is not in Raw Materials — add it there to consume and cost it.</p>;
                    const live = row.qty ? row : previewAllocation(row.materialId, threadQty, row);
                    return <MaterialLine row={live} label={`${BCS_THREAD} (auto)`} hint="Auto-filled from the % above — type over it to override."
                      onQty={(q) => setMaterialQty('cutting', row.materialId, q)} />;
                  })()}
                  {extraRows('cutting').filter((r) => r.materialId !== materialIdByName(BCS_THREAD)).map((r) => (
                    <MaterialLine key={r.materialId} row={r} onQty={(q) => setMaterialQty('cutting', r.materialId, q)} onRemove={() => removeMaterial('cutting', r.materialId)} />
                  ))}
                  <AddMaterial exclude={batchRows('cutting').map((r) => r.materialId)} onAdd={(mid) => setMaterialQty('cutting', mid, 0)} />
                </div>
              </div>
            </>) : (<>
              {/* Back Seal */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Date"><DateInput value={card.cutting.date} onChange={(v) => patchStage('cutting', { date: v })} /></Field>
                <Field label="Input (kg)"><Num value={card.cutting.bsInputKg} onChange={(v) => patchStage('cutting', { bsInputKg: v })} /></Field>
                <Field label="Balance (kg)"><Num value={card.cutting.bsBalanceKg} onChange={(v) => patchStage('cutting', { bsBalanceKg: v })} /></Field>
                <Field label="No. of Pieces"><Num value={card.cutting.bsPieces} onChange={(v) => patchStage('cutting', { bsPieces: v })} /></Field>
                <Field label="Wastage (kg)"><Num value={card.cutting.rejectionKg} onChange={(v) => patchStage('cutting', { rejectionKg: v })} /></Field>
              </div>
              <div className="rounded-lg border border-accent/10 overflow-hidden">
                <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide flex items-center gap-1.5">
                  <IndianRupee className="w-3 h-3" /> Materials from Raw Materials — costed at batch rate
                </div>
                <div className="p-3 space-y-2">
                  {renderNamed('cutting', BACKSEAL_GLUE, { hint: 'Manual entry' })}
                  {extraRows('cutting').filter((r) => r.materialId !== materialIdByName(BACKSEAL_GLUE)).map((r) => (
                    <MaterialLine key={r.materialId} row={r} onQty={(q) => setMaterialQty('cutting', r.materialId, q)} onRemove={() => removeMaterial('cutting', r.materialId)} />
                  ))}
                  <AddMaterial exclude={batchRows('cutting').map((r) => r.materialId)} onAdd={(mid) => setMaterialQty('cutting', mid, 0)} />
                </div>
              </div>
            </>)}
            <LabourEditor stage="Cutting" items={items} consumption={card.cutting.consumption} showCosts={showCosts} onChange={(rows) => patchStage('cutting', { consumption: rows })} />
          </StageCard>

          {card.makingType !== 'Roll' && (
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
          <StageCard jobKey="lamination" card={card} expanded={expanded.has('lamination')} onToggle={() => toggleExpand('lamination')} onSetNA={(na) => setNA('lamination', na)}>
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
            <div className="rounded-lg border border-accent/10 overflow-hidden">
              <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide flex items-center gap-1.5">
                <IndianRupee className="w-3 h-3" /> Materials from Raw Materials — costed at batch rate
              </div>
              <div className="p-3 space-y-2">
                {LAMINATION_MATERIALS.map((n) => renderNamed('lamination', n))}
                {extraRows('lamination').map((r) => (
                  <MaterialLine key={r.materialId} row={r} onQty={(q) => setMaterialQty('lamination', r.materialId, q)} onRemove={() => removeMaterial('lamination', r.materialId)} />
                ))}
                <AddMaterial exclude={batchRows('lamination').map((r) => r.materialId)} onAdd={(mid) => setMaterialQty('lamination', mid, 0)} />
              </div>
            </div>
            <LabourEditor stage="Lamination" items={items} consumption={card.lamination.consumption} showCosts={showCosts} onChange={(rows) => patchStage('lamination', { consumption: rows })} />
          </StageCard>

          <StageCard jobKey="cutting" card={card} expanded={expanded.has('cutting')} onToggle={() => toggleExpand('cutting')} onSetNA={(na) => setNA('cutting', na)}>
            <StageWho brand={brand} operator={card.cutting.operator} onOperator={(v) => patchStage('cutting', { operator: v })} />
            <Field label="Cutting Method">
              <div className="flex gap-2">
                {CUTTING_METHODS.map((mth) => (
                  <button key={mth} type="button" onClick={() => patchStage('cutting', { method: mth as CuttingMethod })}
                    className={cn('px-4 py-1.5 rounded text-sm font-medium transition-colors',
                      (card.cutting.method ?? 'BCS') === mth ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white')}>
                    {mth}
                  </button>
                ))}
              </div>
            </Field>
            {(card.cutting.method ?? 'BCS') === 'BCS' ? (<>
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
              {renderNamed('cutting', BCS_THREAD, { label: `${BCS_THREAD} (auto ${threadPct}% = ${threadQty} kg)` })}
            </>) : (<>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Date"><DateInput value={card.cutting.date} onChange={(v) => patchStage('cutting', { date: v })} /></Field>
                <Field label="Input (kg)"><Num value={card.cutting.bsInputKg} onChange={(v) => patchStage('cutting', { bsInputKg: v })} /></Field>
                <Field label="Balance (kg)"><Num value={card.cutting.bsBalanceKg} onChange={(v) => patchStage('cutting', { bsBalanceKg: v })} /></Field>
                <Field label="No. of Pieces"><Num value={card.cutting.bsPieces} onChange={(v) => patchStage('cutting', { bsPieces: v })} /></Field>
                <Field label="Wastage (kg)"><Num value={card.cutting.rejectionKg} onChange={(v) => patchStage('cutting', { rejectionKg: v })} /></Field>
              </div>
              {renderNamed('cutting', BACKSEAL_GLUE)}
            </>)}
            <LabourEditor stage="Cutting" items={items} consumption={card.cutting.consumption} showCosts={showCosts} onChange={(rows) => patchStage('cutting', { consumption: rows })} />
          </StageCard>

          <StageCard jobKey="printing" card={card} expanded={expanded.has('printing')} onToggle={() => toggleExpand('printing')} onSetNA={(na) => setNA('printing', na)} label="Flexo">
            <StageWho brand={brand} operator={card.printing.operator} onOperator={(v) => patchStage('printing', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.printing.date} onChange={(v) => patchStage('printing', { date: v })} /></Field>
              <Field label="Input (kg)"><Num value={card.printing.inputKg} onChange={(v) => patchStage('printing', { inputKg: v })} /></Field>
              <Field label="No. of Bags"><Num value={card.printing.noOfBags} onChange={(v) => patchStage('printing', { noOfBags: v })} /></Field>
              <Field label="Colour of print"><Txt value={card.printing.colour} onChange={(v) => patchStage('printing', { colour: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.printing.balanceKg} onChange={(v) => patchStage('printing', { balanceKg: v })} /></Field>
              <Field label="Wastage (kg)"><Num value={card.printing.rejectionKg} onChange={(v) => patchStage('printing', { rejectionKg: v })} /></Field>
            </div>
            <div className="rounded-lg border border-accent/10 overflow-hidden">
              <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide flex items-center gap-1.5">
                <IndianRupee className="w-3 h-3" /> Materials from Raw Materials — costed at batch rate
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-muted">Ink auto-calc:</span>
                  <input className="input-field font-mono w-20 py-1 text-sm" type="number" min="0" step="any"
                    value={card.printing.inkPct ?? inkPct}
                    onChange={(e) => patchStage('printing', { inkPct: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) })} />
                  <span className="text-muted">% of input ({card.printing.inputKg ?? 0} kg) = <span className="text-white/80 font-mono">{inkQty} kg</span></span>
                </div>
                {renderNamed('printing', PRINTING_INK, { label: `${PRINTING_INK} (auto)` })}
                {PRINTING_SOLVENTS.map((n) => renderNamed('printing', n, { hint: 'Manual entry' }))}
                <AddMaterial exclude={batchRows('printing').map((r) => r.materialId)} onAdd={(mid) => setMaterialQty('printing', mid, 0)} />
              </div>
            </div>
            <LabourEditor stage="Printing" items={items} consumption={card.printing.consumption} showCosts={showCosts} onChange={(rows) => patchStage('printing', { consumption: rows })} />
          </StageCard>

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
          </>)}

          {/* C6 — Dispatch: fields first, dispatch button underneath */}
          <StageCard jobKey="dispatch" card={card} expanded={expanded.has('dispatch')} onToggle={() => toggleExpand('dispatch')} onSetNA={(na) => setNA('dispatch', na)}>
            <StageWho brand={brand} operator={card.dispatch.operator} onOperator={(v) => patchStage('dispatch', { operator: v })} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Date"><DateInput value={card.dispatch.date} onChange={(v) => patchStage('dispatch', { date: v })} /></Field>
              <Field label="No. of Bales"><Num value={card.dispatch.noOfBales} onChange={(v) => patchStage('dispatch', { noOfBales: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.dispatch.balanceKg} onChange={(v) => patchStage('dispatch', { balanceKg: v })} /></Field>
              <Field label="Bags per bale"><Num value={card.dispatch.bagsPerBale} onChange={(v) => patchStage('dispatch', { bagsPerBale: v })} placeholder="100" /></Field>
            </div>
            <p className="label !mb-1">Dispatch lines: Quantity (kg) · Pieces · Date</p>
            {card.dispatch.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Num value={l.quantityKg} onChange={(v) => { const lines = [...card.dispatch.lines]; lines[i] = { ...lines[i], quantityKg: v }; patchStage('dispatch', { lines }); }} placeholder="Qty kg" />
                <Num value={l.pieces} onChange={(v) => { const lines = [...card.dispatch.lines]; lines[i] = { ...lines[i], pieces: v }; patchStage('dispatch', { lines }); }} placeholder="Pieces" />
                <DateInput value={l.dispatchDate} onChange={(v) => { const lines = [...card.dispatch.lines]; lines[i] = { ...lines[i], dispatchDate: v }; patchStage('dispatch', { lines }); }} />
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button onClick={() => patchStage('dispatch', { lines: [...card.dispatch.lines, {}] })} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add line</button>
              {card.dispatch.lines.length > 1 && <button onClick={() => patchStage('dispatch', { lines: card.dispatch.lines.slice(0, -1) })} className="text-xs text-red-300 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove last</button>}
            </div>
            <LabourEditor stage="Dispatch" items={items} consumption={card.dispatch.consumption} showCosts={showCosts} onChange={(rows) => patchStage('dispatch', { consumption: rows })} />

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
                </tbody>
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
