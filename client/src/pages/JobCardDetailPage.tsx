import { useState, useMemo, useEffect, useCallback, ReactNode } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Save, Printer, ArrowLeft, AlertTriangle,
  IndianRupee, Plus, Trash2, Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jobCardsDb, rateMasterDb, dispatchesDb, ordersDb, invRollsDb, boppFilmsDb, finishedRollsDb, finishedFilmsDb } from '../lib/db';
import { FINISHES, JOB_STAGES, JOBCARD_STATUSES, FABRIC_TYPES, COATING_SIDES, BCS_OPTIONS } from '../config';
import type { Finish, JobStage, JobCardStatus, FabricType, CoatingSide } from '../config';
import type { JobCard, RateMasterItem, Consumption, DispatchRecord } from '../types/models';
import {
  emptyJobCard, normalizeJobCard, genJobNo, STAGE_KEYS, STAGE_LABEL,
  stageMetrics, stageCost, computeCosting, materialsForStage, formatINR,
  prevActiveStage, nextActiveStage, stagePrimary, visibleStageKeys, totalBags,
} from '../lib/jobcard';
import type { StageKey } from '../lib/jobcard';
import { canViewCosts } from '../lib/roles';
import { useBranding } from '../lib/branding';
import { RoleSwitcher } from '../components/ui/RoleSwitcher';
import { cn } from '../lib/utils';

// ── Stock Consumed panel — pick a Roll / BOPP Film from current Inventory stock,
// then mark it Finished (moves to Finished Rolls/Film) or Balance (updates the
// remaining weight in stock and flags it "used"). Shown on both job cards.
function StockConsumedPanel({ jobNo, orderNo, isBopp }: { jobNo: string; orderNo?: string; isBopp: boolean }) {
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);
  const rolls = useMemo(() => { void tick; return invRollsDb.getAll().filter((r) => !r.balanceUsed); }, [tick]);
  const films = useMemo(() => { void tick; return boppFilmsDb.getAll().filter((f) => !f.balanceUsed); }, [tick]);
  const [rollId, setRollId] = useState('');
  const [filmId, setFilmId] = useState('');
  const [balRoll, setBalRoll] = useState('');
  const [balFilm, setBalFilm] = useState('');

  function finishRoll() {
    const r = rolls.find((x) => x.id === rollId); if (!r) { toast.error('Select a roll'); return; }
    const { id, balanceUsed, ...rest } = r; void id; void balanceUsed;
    finishedRollsDb.create({ ...rest, consumedAt: new Date().toISOString(), jobNo, orderNo });
    invRollsDb.delete(r.id);
    toast.success(`Roll ${r.rollNo} finished → Finished Rolls`);
    setRollId(''); reload();
  }
  function balanceRoll() {
    const r = rolls.find((x) => x.id === rollId); if (!r) { toast.error('Select a roll'); return; }
    const w = parseFloat(balRoll); if (!(w >= 0)) { toast.error('Enter remaining weight'); return; }
    invRollsDb.update(r.id, { nWt: w, balanceUsed: true });
    toast.success(`Roll ${r.rollNo} balance set to ${w} kg (flagged used)`);
    setBalRoll(''); setRollId(''); reload();
  }
  function finishFilm() {
    const r = films.find((x) => x.id === filmId); if (!r) { toast.error('Select a film'); return; }
    const { id, balanceUsed, ...rest } = r; void id; void balanceUsed;
    finishedFilmsDb.create({ ...rest, consumedAt: new Date().toISOString(), jobNo, orderNo });
    boppFilmsDb.delete(r.id);
    toast.success(`Film ${r.filmNo} finished → Finished BOPP Film`);
    setFilmId(''); reload();
  }
  function balanceFilm() {
    const r = films.find((x) => x.id === filmId); if (!r) { toast.error('Select a film'); return; }
    const w = parseFloat(balFilm); if (!(w >= 0)) { toast.error('Enter remaining weight'); return; }
    boppFilmsDb.update(r.id, { kg: w, balanceUsed: true });
    toast.success(`Film ${r.filmNo} balance set to ${w} kg (flagged used)`);
    setBalFilm(''); setFilmId(''); reload();
  }

  return (
    <div className="glass-card p-4 space-y-3 no-print">
      <p className="section-title text-base">Stock Consumed</p>
      {/* Roll */}
      <div className="space-y-1.5">
        <label className="label">Roll No (from stock)</label>
        <div className="flex gap-2 flex-wrap items-center">
          <select className="input-field w-auto min-w-40" value={rollId} onChange={(e) => setRollId(e.target.value)}>
            <option value="">Select roll…</option>
            {rolls.map((r) => <option key={r.id} value={r.id}>{r.rollNo} · {r.type} · {r.nWt}kg</option>)}
          </select>
          <button onClick={finishRoll} disabled={!rollId} className="btn-secondary disabled:opacity-40">Roll Finished</button>
          <input className="input-field font-mono w-28" type="number" min="0" step="any" value={balRoll} onChange={(e) => setBalRoll(e.target.value)} placeholder="rem. kg" />
          <button onClick={balanceRoll} disabled={!rollId} className="btn-secondary disabled:opacity-40">Balance</button>
        </div>
      </div>
      {/* Film (BOPP only) */}
      {isBopp && (
        <div className="space-y-1.5">
          <label className="label">BOPP Film No (from stock)</label>
          <div className="flex gap-2 flex-wrap items-center">
            <select className="input-field w-auto min-w-40" value={filmId} onChange={(e) => setFilmId(e.target.value)}>
              <option value="">Select film…</option>
              {films.map((r) => <option key={r.id} value={r.id}>{r.filmNo} · {r.finish ?? '—'} · {r.kg}kg</option>)}
            </select>
            <button onClick={finishFilm} disabled={!filmId} className="btn-secondary disabled:opacity-40">Film Finished</button>
            <input className="input-field font-mono w-28" type="number" min="0" step="any" value={balFilm} onChange={(e) => setBalFilm(e.target.value)} placeholder="rem. kg" />
            <button onClick={balanceFilm} disabled={!filmId} className="btn-secondary disabled:opacity-40">Balance</button>
          </div>
        </div>
      )}
      <p className="text-muted text-xs">Finished = roll/film fully used (archived to Finished Rolls). Balance = enter remaining weight; the stock roll is updated and flagged used.</p>
    </div>
  );
}

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

// ── Consumption editor (qty always shown; ₹ only when canViewCosts) ─────────────
function ConsumptionEditor({ stage, items, consumption, showCosts, onChange }: {
  stage: JobStage;
  items: RateMasterItem[];
  consumption: Consumption[];
  showCosts: boolean;
  onChange: (rows: Consumption[]) => void;
}) {
  // Merge rate-master materials with any stored quantities. Snapshot the rate at
  // entry: keep the stored snapshot once a qty exists; otherwise use current rate.
  const rows: Consumption[] = materialsForStage(items, stage).map((m) => {
    const prev = consumption.find((c) => c.materialId === m.id);
    const qty = prev?.qty ?? 0;
    const rate = prev && qty > 0 && prev.rateSnapshot != null ? prev.rateSnapshot : m.rate;
    return { materialId: m.id, materialName: m.name, unit: m.unit, qty, rateSnapshot: rate, lineCost: rate != null ? qty * rate : 0 };
  });

  function setQty(materialId: string, qty: number | undefined) {
    const next = rows.map((r) => {
      if (r.materialId !== materialId) return r;
      const q = qty ?? 0;
      return { ...r, qty: q, lineCost: r.rateSnapshot != null ? q * r.rateSnapshot : 0 };
    });
    onChange(next);
  }

  if (rows.length === 0) return <p className="text-muted text-xs">No materials configured for this stage in the Rate Master.</p>;

  const stageTotal = rows.reduce((s, r) => s + r.lineCost, 0);

  return (
    <div className="rounded-lg border border-accent/10 overflow-hidden">
      <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide flex items-center gap-1.5">
        <IndianRupee className="w-3 h-3" /> Material consumption
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.materialId} className="border-t border-white/5">
              <td className="px-3 py-1.5 text-white/80">{r.materialName}</td>
              <td className="px-3 py-1.5 w-28">
                <input className="input-field font-mono py-1 text-xs" type="number" min="0" step="any"
                  value={r.qty || ''} placeholder="0"
                  onChange={(e) => setQty(r.materialId, e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0))} />
              </td>
              <td className="px-2 py-1.5 text-muted text-xs whitespace-nowrap">{r.unit.replace(/^₹\s*\/\s*/, '')}</td>
              {showCosts && (
                <td className="px-3 py-1.5 text-right font-mono text-xs whitespace-nowrap">
                  {r.rateSnapshot == null
                    ? <span className="text-red-300">rate not set</span>
                    : <span className="text-white/70">{formatINR(r.lineCost)}</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {showCosts && (
          <tfoot>
            <tr className="border-t border-accent/20 bg-navy/40">
              <td className="px-3 py-1.5 text-muted text-xs" colSpan={3}>Stage material cost</td>
              <td className="px-3 py-1.5 text-right font-mono text-white font-semibold whitespace-nowrap">{formatINR(stageTotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Stage shell (collapsible + N/A + metrics) ──────────────────────────────────
function StageCard({ jobKey, card, expanded, onToggle, onSetNA, children }: {
  jobKey: StageKey; card: JobCard; expanded: boolean;
  onToggle: () => void; onSetNA: (na: boolean) => void; children: ReactNode;
}) {
  // Hide stages this card variant doesn't use (Normal / roll-only jobs).
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
          <span className="text-white font-semibold">{STAGE_LABEL[jobKey]}</span>
          {!stage.na && (myIn > 0 || m.output > 0) && (
            <span className="text-xs text-muted font-mono ml-2">
              bal {m.balance.toFixed(1)} kg · yield {m.yieldPct.toFixed(0)}%
            </span>
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
  const [showCosts, setShowCosts] = useState(canViewCosts());
  const [expanded, setExpanded] = useState<Set<StageKey>>(() => new Set(STAGE_KEYS));
  const [showInkThinner, setShowInkThinner] = useState(false);

  const [card, setCard] = useState<JobCard | null>(() => {
    if (isNew) {
      const ct = params.get('type') === 'Other' ? 'Other' : 'BOPP';
      const mk = ct === 'BOPP' ? (params.get('making') === 'Roll' ? 'Roll' : 'Bag') : undefined;
      return normalizeJobCard({ ...emptyJobCard(ct, 'Glossy', mk), id: '' } as JobCard);
    }
    const found = jobCardsDb.get(id!);
    return found ? normalizeJobCard(found) : null;
  });

  // Costing recomputed live from current state (no save needed for display)
  const cost = useMemo(() => (card ? computeCosting(card) : null), [card]);

  const persist = useCallback((c: JobCard, silent = false) => {
    const now = new Date().toISOString();
    if (!c.id) {
      const jobNo = c.jobNo || genJobNo(jobCardsDb.getAll().map((x) => x.jobNo));
      const created = jobCardsDb.create({ ...c, jobNo, ratesAsOf: now, createdAt: now, updatedAt: now } as Omit<JobCard, 'id'>);
      if (!silent) toast.success(`Job card ${created.jobNo} created`);
      nav(`/job-card/${created.id}`, { replace: true });
      setCard(created);
    } else {
      jobCardsDb.update(c.id, { ...c, ratesAsOf: now, updatedAt: now });
      if (!silent) toast.success('Saved');
      setCard({ ...c, ratesAsOf: now, updatedAt: now });
    }
  }, [nav]);

  if (!card) return <Navigate to="/job-card" replace />;

  // ── update helpers ──
  const patchHeader = (patch: Partial<JobCard['header']>) =>
    setCard((p) => p && ({ ...p, header: { ...p.header, ...patch } }));

  function patchStage<K extends StageKey>(key: K, patch: Partial<JobCard[K]>) {
    setCard((p) => p && ({ ...p, [key]: { ...p[key], ...patch } } as JobCard));
  }

  // Auto-suggest next active stage's input from this stage's output (if empty)
  function carryForward(fromKey: StageKey) {
    setCard((p) => {
      if (!p) return p;
      const next = nextActiveStage(p, fromKey);
      if (!next) return p;
      const out = stagePrimary(p, fromKey).output;
      if (out <= 0) return p;
      const clone = { ...p } as JobCard;
      const setIfEmpty = (cur: number | undefined) => (cur == null || cur === 0 ? out : cur);
      if (next === 'metalize') clone.metalize = { ...clone.metalize, metalizeInputKg: setIfEmpty(clone.metalize.metalizeInputKg) };
      else if (next === 'slitting') clone.slitting = { ...clone.slitting, grossInputKg: setIfEmpty(clone.slitting.grossInputKg) };
      else if (next === 'lamination') {
        const rows = clone.lamination.rows.length ? [...clone.lamination.rows] : [{}];
        rows[0] = { ...rows[0], boppInKg: setIfEmpty(rows[0].boppInKg) };
        clone.lamination = { ...clone.lamination, rows };
      } else if (next === 'cutting') {
        const rows = clone.cutting.rows.length ? [...clone.cutting.rows] : [{}];
        rows[0] = { ...rows[0], inputKg: setIfEmpty(rows[0].inputKg) };
        clone.cutting = { ...clone.cutting, rows };
      }
      return clone;
    });
  }

  function toggleExpand(k: StageKey) {
    setExpanded((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  function setNA(k: StageKey, na: boolean) {
    patchStage(k, { na } as Partial<JobCard[StageKey]>);
  }

  // 1-click Send to Dispatch — posts a Roll or Bag dispatch record, marks the
  // job Dispatched, and flips the linked order to Dispatched.
  function sendToDispatch(kind: 'Roll' | 'Bag') {
    if (!card) return;
    if (!card.id) { toast.error('Save the job card first'); return; }
    const now = new Date().toISOString();
    let rec: Omit<DispatchRecord, 'id'>;
    if (kind === 'Roll') {
      const rolls = card.slitting.rolls || [];
      rec = {
        type: 'Roll', jobCardId: card.id, jobNo: card.jobNo, orderRef: card.orderRef, orderNo: card.orderNo,
        party: card.client || card.header.brand, brand: card.header.brand,
        qtyKg: rolls.reduce((s, r) => s + (r.outputKg || 0), 0),
        qtyMeters: rolls.reduce((s, r) => s + (r.meter || 0), 0),
        rolls: rolls.filter((r) => (r.outputKg || 0) > 0).length,
        date: now.slice(0, 10), createdAt: now,
      };
    } else {
      rec = {
        type: 'Bag', jobCardId: card.id, jobNo: card.jobNo, orderRef: card.orderRef, orderNo: card.orderNo,
        party: card.client || card.header.brand, brand: card.header.brand,
        qtyPieces: totalBags(card),
        qtyKg: card.cutting.rows.reduce((s, r) => s + (r.inputKg || 0), 0),
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

  return (
    <div className="space-y-6 animate-fade-in print-area">
      {/* Print-only company header (reads from editable Settings branding) */}
      <div className="print-only mb-4 border-b border-black pb-2">
        <h2 className="text-xl font-bold">{branding.companyName}</h2>
        {(branding.companyAddress || branding.companyGstin) && (
          <p className="text-xs">{branding.companyAddress}{branding.companyGstin ? ` · GSTIN ${branding.companyGstin}` : ''}</p>
        )}
        <p className="text-xs">{branding.appName} — Job Card {card.jobNo}</p>
      </div>

      {/* Top bar */}
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/job-card')} className="p-2 rounded-lg hover:bg-white/10 text-muted hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="page-header">{card.jobNo || 'New Job Card'}</h1>
            <p className="text-muted text-sm mt-0.5">Order traveler — fill each stage as the order moves</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RoleSwitcher onChange={() => setShowCosts(canViewCosts())} />
          <button onClick={() => window.print()} className="btn-secondary"><Printer className="w-4 h-4" /> Print</button>
          <button onClick={() => persist(card)} className="btn-primary"><Save className="w-4 h-4" /> Save</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: header + stages */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <div className="glass-card p-4 space-y-3">
            <p className="section-title text-base">Job Description</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Brand *"><Txt value={h.brand} onChange={(v) => patchHeader({ brand: v })} placeholder="Brand name" /></Field>
              {card.cardType === 'Other' ? (<>
                <Field label="Size"><Txt value={h.size} onChange={(v) => patchHeader({ size: v })} placeholder="18 x 28" /></Field>
                <Field label="Qty"><Num value={h.qty || undefined} onChange={(v) => patchHeader({ qty: v ?? 0 })} /></Field>
                <Field label="Nos / Kg">
                  <select className="input-field" value={h.qtyUnit ?? 'Nos'} onChange={(e) => patchHeader({ qtyUnit: e.target.value as 'Nos' | 'Kg' })}>
                    <option>Nos</option><option>Kg</option>
                  </select>
                </Field>
                <Field label="Finish (Plain / Printed)">
                  <div className="flex gap-2">
                    {([['Plain', false], ['Printed', true]] as const).map(([lbl, val]) => (
                      <button key={lbl} type="button" onClick={() => patchHeader({ printed: val })}
                        className={cn('px-4 py-1.5 rounded text-sm font-medium transition-colors', (!!h.printed === val) ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white')}>{lbl}</button>
                    ))}
                  </div>
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
              </>)}
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

          {/* Stock consumed — Roll/Film selectors + Finished/Balance (links to Inventory) */}
          <StockConsumedPanel jobNo={card.jobNo} orderNo={card.orderNo} isBopp={card.cardType === 'BOPP'} />

          {/* ════ BOPP card: full traveler (Printing → Metalize → Slitting → Lamination → Cutting) ════ */}
          {card.cardType === 'BOPP' && (<>
          {/* Printing */}
          <StageCard jobKey="printing" card={card} expanded={expanded.has('printing')} onToggle={() => toggleExpand('printing')} onSetNA={(na) => setNA('printing', na)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.printing.date} onChange={(v) => patchStage('printing', { date: v })} /></Field>
              <Field label="Operator"><Txt value={card.printing.operator} onChange={(v) => patchStage('printing', { operator: v })} /></Field>
              <Field label="Meter (m)"><Num value={card.printing.meter} onChange={(v) => patchStage('printing', { meter: v })} /></Field>
              <Field label="Input (kg)"><Num value={card.printing.inputKg} onChange={(v) => patchStage('printing', { inputKg: v })} /></Field>
              <Field label="Output (kg)"><Num value={card.printing.outputKg} onChange={(v) => { patchStage('printing', { outputKg: v }); }} /></Field>
              <Field label="Balance (kg)"><Num value={card.printing.balanceKg} onChange={(v) => patchStage('printing', { balanceKg: v })} /></Field>
            </div>
            <button onClick={() => carryForward('printing')} className="text-xs text-accent hover:underline">↳ Carry output to next stage input</button>
            <ConsumptionEditor stage="Printing" items={items} consumption={card.printing.consumption} showCosts={showCosts} onChange={(rows) => patchStage('printing', { consumption: rows })} />
          </StageCard>

          {/* Metalize */}
          <StageCard jobKey="metalize" card={card} expanded={expanded.has('metalize')} onToggle={() => toggleExpand('metalize')} onSetNA={(na) => setNA('metalize', na)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.metalize.date} onChange={(v) => patchStage('metalize', { date: v })} /></Field>
              <Field label="Operator"><Txt value={card.metalize.operator} onChange={(v) => patchStage('metalize', { operator: v })} /></Field>
              <Field label="Metalize Input (kg)"><Num value={card.metalize.metalizeInputKg} onChange={(v) => patchStage('metalize', { metalizeInputKg: v })} /></Field>
              <Field label="BOPP Input (kg)"><Num value={card.metalize.boppInputKg} onChange={(v) => patchStage('metalize', { boppInputKg: v })} /></Field>
              <Field label="Output (kg)"><Num value={card.metalize.outputKg} onChange={(v) => patchStage('metalize', { outputKg: v })} /></Field>
              <Field label="Output (mtr)"><Num value={card.metalize.outputMtr} onChange={(v) => patchStage('metalize', { outputMtr: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.metalize.balanceKg} onChange={(v) => patchStage('metalize', { balanceKg: v })} /></Field>
            </div>
            <button onClick={() => carryForward('metalize')} className="text-xs text-accent hover:underline">↳ Carry output to next stage input</button>
            <p className="text-muted text-xs">BOPP film cost is booked in Printing — Metalize only costs the metalizing consumable (no double counting).</p>
            <ConsumptionEditor stage="Metalize" items={items} consumption={card.metalize.consumption} showCosts={showCosts} onChange={(rows) => patchStage('metalize', { consumption: rows })} />
          </StageCard>

          {/* Slitting */}
          <StageCard jobKey="slitting" card={card} expanded={expanded.has('slitting')} onToggle={() => toggleExpand('slitting')} onSetNA={(na) => setNA('slitting', na)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.slitting.date} onChange={(v) => patchStage('slitting', { date: v })} /></Field>
              <Field label="Operator"><Txt value={card.slitting.operator} onChange={(v) => patchStage('slitting', { operator: v })} /></Field>
              <Field label="Gross Input (kg)"><Num value={card.slitting.grossInputKg} onChange={(v) => patchStage('slitting', { grossInputKg: v })} /></Field>
              <Field label="Input Core (kg)"><Num value={card.slitting.inputCoreKg} onChange={(v) => patchStage('slitting', { inputCoreKg: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.slitting.balanceKg} onChange={(v) => patchStage('slitting', { balanceKg: v })} /></Field>
              <Field label="Trim (kg)"><Num value={card.slitting.trimKg} onChange={(v) => patchStage('slitting', { trimKg: v })} /></Field>
            </div>
            <p className="label !mb-1">Output rolls (up to 3)</p>
            {card.slitting.rolls.slice(0, 3).map((r, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Num value={r.outputKg} onChange={(v) => { const rolls = [...card.slitting.rolls]; rolls[i] = { ...rolls[i], outputKg: v }; patchStage('slitting', { rolls }); }} placeholder="Output kg" />
                <Txt value={r.core} onChange={(v) => { const rolls = [...card.slitting.rolls]; rolls[i] = { ...rolls[i], core: v }; patchStage('slitting', { rolls }); }} placeholder="Core" />
                <Num value={r.meter} onChange={(v) => { const rolls = [...card.slitting.rolls]; rolls[i] = { ...rolls[i], meter: v }; patchStage('slitting', { rolls }); }} placeholder="Meter (m)" />
              </div>
            ))}
            {card.slitting.rolls.length < 3 && <button onClick={() => patchStage('slitting', { rolls: [...card.slitting.rolls, {}] })} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add roll</button>}
            <button onClick={() => carryForward('slitting')} className="text-xs text-accent hover:underline block">↳ Carry output to next stage input</button>
            <ConsumptionEditor stage="Slitting" items={items} consumption={card.slitting.consumption} showCosts={showCosts} onChange={(rows) => patchStage('slitting', { consumption: rows })} />
          </StageCard>

          {/* Roll dispatch point — roll-making jobs dispatch after the slitting/roll output */}
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

          {/* Lamination */}
          <StageCard jobKey="lamination" card={card} expanded={expanded.has('lamination')} onToggle={() => toggleExpand('lamination')} onSetNA={(na) => setNA('lamination', na)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.lamination.date} onChange={(v) => patchStage('lamination', { date: v })} /></Field>
              <Field label="Operator"><Txt value={card.lamination.operator} onChange={(v) => patchStage('lamination', { operator: v })} /></Field>
              <Field label="Fabric Size"><Txt value={card.lamination.fabricSize} onChange={(v) => patchStage('lamination', { fabricSize: v })} /></Field>
              <Field label="Fabric Type">
                <select className="input-field" value={card.lamination.fabricType ?? ''} onChange={(e) => patchStage('lamination', { fabricType: (e.target.value || undefined) as FabricType | undefined })}>
                  <option value="">—</option>{FABRIC_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="GSM"><Num value={card.lamination.gsm} onChange={(v) => patchStage('lamination', { gsm: v })} /></Field>
              <Field label="Avg"><Num value={card.lamination.avg} onChange={(v) => patchStage('lamination', { avg: v })} /></Field>
              <Field label="Coating"><Txt value={card.lamination.coating} onChange={(v) => patchStage('lamination', { coating: v })} /></Field>
              <Field label="Coating side">
                <select className="input-field" value={card.lamination.coatingSide ?? ''} onChange={(e) => patchStage('lamination', { coatingSide: (e.target.value || undefined) as CoatingSide | undefined })}>
                  <option value="">—</option>{COATING_SIDES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <p className="label !mb-1">Rows (up to 3): BOPP In · Fabric In · Meter · Out</p>
            {card.lamination.rows.slice(0, 3).map((r, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <Num value={r.boppInKg} onChange={(v) => { const rows = [...card.lamination.rows]; rows[i] = { ...rows[i], boppInKg: v }; patchStage('lamination', { rows }); }} placeholder="BOPP" />
                <Num value={r.fabricInKg} onChange={(v) => { const rows = [...card.lamination.rows]; rows[i] = { ...rows[i], fabricInKg: v }; patchStage('lamination', { rows }); }} placeholder="Fabric" />
                <Num value={r.meter} onChange={(v) => { const rows = [...card.lamination.rows]; rows[i] = { ...rows[i], meter: v }; patchStage('lamination', { rows }); }} placeholder="Meter" />
                <Num value={r.outKg} onChange={(v) => { const rows = [...card.lamination.rows]; rows[i] = { ...rows[i], outKg: v }; patchStage('lamination', { rows }); }} placeholder="Out" />
              </div>
            ))}
            {card.lamination.rows.length < 3 && <button onClick={() => patchStage('lamination', { rows: [...card.lamination.rows, {}] })} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add row</button>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total Roll (count)"><Num value={card.lamination.totalRoll} onChange={(v) => patchStage('lamination', { totalRoll: v })} /></Field>
              <Field label="Balance Roll (kg)"><Num value={card.lamination.balanceRoll} onChange={(v) => patchStage('lamination', { balanceRoll: v })} /></Field>
            </div>
            <button onClick={() => carryForward('lamination')} className="text-xs text-accent hover:underline block">↳ Carry output to next stage input</button>
            <ConsumptionEditor stage="Lamination" items={items} consumption={card.lamination.consumption} showCosts={showCosts} onChange={(rows) => patchStage('lamination', { consumption: rows })} />
          </StageCard>

          {/* Cutting */}
          <StageCard jobKey="cutting" card={card} expanded={expanded.has('cutting')} onToggle={() => toggleExpand('cutting')} onSetNA={(na) => setNA('cutting', na)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.cutting.date} onChange={(v) => patchStage('cutting', { date: v })} /></Field>
              <Field label="Operator"><Txt value={card.cutting.operator} onChange={(v) => patchStage('cutting', { operator: v })} /></Field>
              <Field label="Rejection (kg)"><Num value={card.cutting.rejectionKg} onChange={(v) => patchStage('cutting', { rejectionKg: v })} /></Field>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-primary" checked={card.cutting.gusset} onChange={(e) => patchStage('cutting', { gusset: e.target.checked })} /> Gusset</label>
              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-primary" checked={card.cutting.perforation} onChange={(e) => patchStage('cutting', { perforation: e.target.checked })} /> Perforation</label>
            </div>
            <p className="label !mb-1">Rows (up to 3): Input · No. of Bags · BCS</p>
            {card.cutting.rows.slice(0, 3).map((r, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Num value={r.inputKg} onChange={(v) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], inputKg: v }; patchStage('cutting', { rows }); }} placeholder="Input kg" />
                <Num value={r.noOfBags} onChange={(v) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], noOfBags: v }; patchStage('cutting', { rows }); }} placeholder="No. of Bags" />
                <select className="input-field" value={r.bcs ?? ''} onChange={(e) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], bcs: e.target.value ? Number(e.target.value) : undefined }; patchStage('cutting', { rows }); }}>
                  <option value="">BCS</option>{BCS_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            ))}
            {card.cutting.rows.length < 3 && <button onClick={() => patchStage('cutting', { rows: [...card.cutting.rows, {}] })} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add row</button>}
            <ConsumptionEditor stage="Cutting" items={items} consumption={card.cutting.consumption} showCosts={showCosts} onChange={(rows) => patchStage('cutting', { consumption: rows })} />
          </StageCard>

          {/* Bag dispatch point — BOPP bag jobs dispatch after cutting */}
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

          {/* ════ Other card: Cutting → Printing → Dispatch ════ */}
          {card.cardType === 'Other' && (<>
          {/* Cutting (same method as BOPP cutting) */}
          <StageCard jobKey="cutting" card={card} expanded={expanded.has('cutting')} onToggle={() => toggleExpand('cutting')} onSetNA={(na) => setNA('cutting', na)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.cutting.date} onChange={(v) => patchStage('cutting', { date: v })} /></Field>
              <Field label="Operator"><Txt value={card.cutting.operator} onChange={(v) => patchStage('cutting', { operator: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.cutting.balance} onChange={(v) => patchStage('cutting', { balance: v })} /></Field>
              <Field label="Rejection (kg)"><Num value={card.cutting.rejectionKg} onChange={(v) => patchStage('cutting', { rejectionKg: v })} /></Field>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-primary" checked={card.cutting.gusset} onChange={(e) => patchStage('cutting', { gusset: e.target.checked })} /> Gusset</label>
              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-primary" checked={card.cutting.perforation} onChange={(e) => patchStage('cutting', { perforation: e.target.checked })} /> Perforation</label>
            </div>
            <p className="label !mb-1">Rows (up to 3): Input · No. of Bags · BCS</p>
            {card.cutting.rows.slice(0, 3).map((r, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Num value={r.inputKg} onChange={(v) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], inputKg: v }; patchStage('cutting', { rows }); }} placeholder="Input kg" />
                <Num value={r.noOfBags} onChange={(v) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], noOfBags: v }; patchStage('cutting', { rows }); }} placeholder="No. of Bags" />
                <select className="input-field" value={r.bcs ?? ''} onChange={(e) => { const rows = [...card.cutting.rows]; rows[i] = { ...rows[i], bcs: e.target.value ? Number(e.target.value) : undefined }; patchStage('cutting', { rows }); }}>
                  <option value="">BCS</option>{BCS_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            ))}
            {card.cutting.rows.length < 3 && <button onClick={() => patchStage('cutting', { rows: [...card.cutting.rows, {}] })} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add row</button>}
            <ConsumptionEditor stage="Cutting" items={items} consumption={card.cutting.consumption} showCosts={showCosts} onChange={(rows) => patchStage('cutting', { consumption: rows })} />
          </StageCard>

          {/* Dispatch after Cutting — plain bags with no print can dispatch here */}
          <div className="glass-card p-4 flex items-center justify-between gap-3 flex-wrap no-print border-accent/30">
            <div>
              <p className="text-white font-medium text-sm">Bags ready for dispatch (after cutting)</p>
              <p className="text-muted text-xs">Plain bags with no printing can be dispatched straight after cutting.</p>
            </div>
            <button onClick={() => sendToDispatch('Bag')} disabled={!!card.bagDispatchedAt}
              className={cn('btn-primary', card.bagDispatchedAt && 'opacity-50 cursor-not-allowed')}>
              <Truck className="w-4 h-4" /> {card.bagDispatchedAt ? 'Bags Dispatched' : 'Send to Dispatch'}
            </button>
          </div>

          {/* Printing (Other) */}
          <StageCard jobKey="printing" card={card} expanded={expanded.has('printing')} onToggle={() => toggleExpand('printing')} onSetNA={(na) => setNA('printing', na)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.printing.date} onChange={(v) => patchStage('printing', { date: v })} /></Field>
              <Field label="Operator"><Txt value={card.printing.operator} onChange={(v) => patchStage('printing', { operator: v })} /></Field>
              <Field label="Input (kg)"><Num value={card.printing.inputKg} onChange={(v) => patchStage('printing', { inputKg: v })} /></Field>
              <Field label="No. of Bags"><Num value={card.printing.noOfBags} onChange={(v) => patchStage('printing', { noOfBags: v })} /></Field>
              <Field label="Colour of print"><Txt value={card.printing.colour} onChange={(v) => patchStage('printing', { colour: v })} /></Field>
              <Field label="Balance (kg)"><Num value={card.printing.balanceKg} onChange={(v) => patchStage('printing', { balanceKg: v })} /></Field>
              <Field label="Rejection (kg)"><Num value={card.printing.rejectionKg} onChange={(v) => patchStage('printing', { rejectionKg: v })} /></Field>
            </div>
            {/* Ink & thinner consumption (Other bags) — shown if set, else "Add" reveals them */}
            {(card.printing.ink != null || card.printing.thinner != null || showInkThinner) ? (
              <div className="rounded-lg border border-accent/10 p-3 space-y-2">
                <p className="label !mb-1">Material consumption</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ink (kg)"><Num value={card.printing.ink} onChange={(v) => patchStage('printing', { ink: v })} /></Field>
                  <Field label="Thinner (kg)"><Num value={card.printing.thinner} onChange={(v) => patchStage('printing', { thinner: v })} /></Field>
                </div>
                {(card.printing.ink != null || card.printing.thinner != null) && (
                  <p className="text-muted text-xs">Logged: ink {card.printing.ink ?? 0} kg · thinner {card.printing.thinner ?? 0} kg</p>
                )}
              </div>
            ) : (
              <button onClick={() => setShowInkThinner(true)} className="btn-secondary"><Plus className="w-4 h-4" /> Add Ink &amp; Thinner</button>
            )}
          </StageCard>

          {/* Dispatch after Printing */}
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

          {/* Dispatch */}
          <StageCard jobKey="dispatch" card={card} expanded={expanded.has('dispatch')} onToggle={() => toggleExpand('dispatch')} onSetNA={(na) => setNA('dispatch', na)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Date"><DateInput value={card.dispatch.date} onChange={(v) => patchStage('dispatch', { date: v })} /></Field>
              <Field label="Operator"><Txt value={card.dispatch.operator} onChange={(v) => patchStage('dispatch', { operator: v })} /></Field>
              <Field label="Bags per bale"><Num value={card.dispatch.bagsPerBale} onChange={(v) => patchStage('dispatch', { bagsPerBale: v })} placeholder="100" /></Field>
              <Field label="Pending (kg)"><Num value={card.dispatch.pendingKg} onChange={(v) => patchStage('dispatch', { pendingKg: v })} /></Field>
              <Field label="Pending (pcs)"><Num value={card.dispatch.pendingPcs} onChange={(v) => patchStage('dispatch', { pendingPcs: v })} /></Field>
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
            <ConsumptionEditor stage="Dispatch" items={items} consumption={card.dispatch.consumption} showCosts={showCosts} onChange={(rows) => patchStage('dispatch', { consumption: rows })} />
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
                <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Some consumed materials have no rate set — excluded from total.
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
