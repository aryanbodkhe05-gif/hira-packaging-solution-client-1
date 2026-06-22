import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Search, Download, Activity, Gauge,
  Ruler, Settings2, ListChecks, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { loomsDb, loomEntriesDb, getSettings, saveSettings } from '../lib/db';
import {
  SHIFTS, QUALITY_GRADES, LOOM_STATUSES, WIDTH_UNITS,
  LOOM_DOWNTIME_REASONS, DEFAULT_SHIFT_HOURS,
} from '../config';
import type {
  Shift, QualityGrade, LoomStatus, WidthUnit,
} from '../config';
import type { Loom, LoomEntry } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { cn, exportToCsv, genDailyId, formatDate } from '../lib/utils';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA');

const QUALITY_COLORS: Record<QualityGrade, string> = {
  'A-Grade':   'bg-green-500/20 text-green-300 border-green-500/30',
  'B-Grade':   'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Rejection': 'bg-red-500/20 text-red-300 border-red-500/30',
};
const LOOM_STATUS_COLORS: Record<LoomStatus, string> = {
  'Active':            'bg-green-500/20 text-green-300 border-green-500/30',
  'Under maintenance': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Retired':           'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function toNum(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function shiftHours(): number {
  const v = parseFloat(getSettings().loom_shift_hours ?? '');
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_SHIFT_HOURS;
}
function metersPerKg(e: Pick<LoomEntry, 'meters' | 'weightKg'>): number {
  return e.weightKg > 0 ? e.meters / e.weightKg : 0;
}
// Efficiency % = uptime fraction × speed fraction (vs the loom's max RPM capacity).
// uptime = (shift minutes − downtime) / shift minutes; speed = rpm / maxRpm (if both known).
function efficiency(e: Pick<LoomEntry, 'rpm' | 'downtimeMin'>, loom: Loom | undefined, hrs: number): number {
  const shiftMin = hrs * 60;
  const uptime = shiftMin > 0 ? Math.max(0, (shiftMin - (e.downtimeMin || 0)) / shiftMin) : 1;
  const maxRpm = loom?.maxRpm ?? 0;
  const speed = (e.rpm && maxRpm) ? Math.min(1, e.rpm / maxRpm) : 1;
  return Math.min(100, uptime * speed * 100);
}

// ═════════════════════════════════════════════════════════════════════════════
// LOOM ENTRY FORM (3A)
// ═════════════════════════════════════════════════════════════════════════════
const emptyEntry: Omit<LoomEntry, 'id'> = {
  entryId: '', date: today(), shift: 'Morning', loomNo: '', operator: '',
  width: 0, widthUnit: 'inches', meters: 0, quality: 'A-Grade', weightKg: 0,
  rollCount: 0, reedCount: undefined, rpm: undefined, downtimeMin: 0,
  downtimeReason: '', notes: '', createdAt: '', updatedAt: '',
};

function EntryForm({ initial, looms, onSave, onClose }: {
  initial: Omit<LoomEntry, 'id'>;
  looms: Loom[];
  onSave: (d: Omit<LoomEntry, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const loom = looms.find((l) => l.loomNo === f.loomNo);
  const mpk = metersPerKg(f);
  const eff = efficiency(f, loom, shiftHours());

  function submit() {
    if (!f.loomNo) { toast.error('Select a loom'); return; }
    if (!f.meters || f.meters <= 0) { toast.error('Production (meters) must be greater than 0'); return; }
    if (!f.weightKg || f.weightKg <= 0) { toast.error('Weight (kg) must be greater than 0'); return; }
    if (f.downtimeMin > 0 && !f.downtimeReason?.trim()) { toast.error('Downtime reason is required when downtime > 0'); return; }
    onSave({
      ...f,
      operator: f.operator?.trim() || '',
      downtimeReason: f.downtimeMin > 0 ? f.downtimeReason?.trim() : '',
      reedCount: f.reedCount || undefined,
      rpm: f.rpm || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Entry ID</label>
          <input className="input-field font-mono text-accent" value={f.entryId || 'auto-generated on save'} disabled readOnly />
        </div>
        <div>
          <label className="label">Date *</label>
          <input className="input-field" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div>
          <label className="label">Shift</label>
          <select className="input-field" value={f.shift} onChange={(e) => set('shift', e.target.value as Shift)}>
            {SHIFTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Loom No. *</label>
          <select className="input-field" value={f.loomNo} onChange={(e) => set('loomNo', e.target.value)}>
            <option value="">Select loom…</option>
            {looms.map((l) => <option key={l.id} value={l.loomNo}>{l.loomNo}{l.status !== 'Active' ? ` (${l.status})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Operator name</label>
          <input className="input-field" value={f.operator ?? ''} onChange={(e) => set('operator', e.target.value)} placeholder="e.g. Ramesh" />
        </div>
        <div>
          <label className="label">Quality grade</label>
          <select className="input-field" value={f.quality} onChange={(e) => set('quality', e.target.value as QualityGrade)}>
            {QUALITY_GRADES.map((q) => <option key={q}>{q}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-1">
          <label className="label">Fabric width</label>
          <input className="input-field font-mono" type="number" min="0" step="any" value={f.width || ''} onChange={(e) => set('width', toNum(e.target.value))} placeholder="0" />
        </div>
        <div className="col-span-1">
          <label className="label">Unit</label>
          <select className="input-field" value={f.widthUnit} onChange={(e) => set('widthUnit', e.target.value as WidthUnit)}>
            {WIDTH_UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Production (m) *</label>
          <input className="input-field font-mono" type="number" min="0" step="any" value={f.meters || ''} onChange={(e) => set('meters', toNum(e.target.value))} placeholder="0" />
        </div>
        <div>
          <label className="label">Weight (kg) *</label>
          <input className="input-field font-mono" type="number" min="0" step="any" value={f.weightKg || ''} onChange={(e) => set('weightKg', toNum(e.target.value))} placeholder="0" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="label">Roll count</label>
          <input className="input-field font-mono" type="number" min="0" value={f.rollCount || ''} onChange={(e) => set('rollCount', Math.round(toNum(e.target.value)))} placeholder="0" />
        </div>
        <div>
          <label className="label">Reed count</label>
          <input className="input-field font-mono" type="number" min="0" value={f.reedCount ?? ''} onChange={(e) => set('reedCount', toNum(e.target.value))} placeholder="optional" />
        </div>
        <div>
          <label className="label">RPM / speed</label>
          <input className="input-field font-mono" type="number" min="0" value={f.rpm ?? ''} onChange={(e) => set('rpm', toNum(e.target.value))} placeholder="optional" />
        </div>
        <div>
          <label className="label">Downtime (min)</label>
          <input className="input-field font-mono" type="number" min="0" value={f.downtimeMin || ''} onChange={(e) => set('downtimeMin', Math.round(toNum(e.target.value)))} placeholder="0" />
        </div>
      </div>

      {f.downtimeMin > 0 && (
        <div className="animate-fade-in">
          <label className="label">Downtime reason *</label>
          <select className="input-field" value={f.downtimeReason || ''} onChange={(e) => set('downtimeReason', e.target.value)}>
            <option value="">Select reason…</option>
            {LOOM_DOWNTIME_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="label">Notes</label>
        <textarea className="input-field min-h-[56px] resize-y" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
      </div>

      {/* Live indicators */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-navy/60 border border-accent/10">
          <p className="text-muted text-xs uppercase tracking-wide">Meters / kg</p>
          <p className="font-mono text-lg font-bold text-white mt-0.5">{mpk.toFixed(2)}</p>
        </div>
        <div className="p-3 rounded-lg bg-navy/60 border border-accent/10">
          <p className="text-muted text-xs uppercase tracking-wide">Efficiency</p>
          <p className={cn('font-mono text-lg font-bold mt-0.5', eff >= 75 ? 'text-green-300' : eff >= 50 ? 'text-yellow-300' : 'text-red-300')}>{eff.toFixed(1)}%</p>
        </div>
      </div>
      {!loom?.maxRpm && (
        <p className="text-muted text-xs">Set a max RPM capacity for this loom (Looms tab) and enter RPM above for a speed-adjusted efficiency.</p>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Entry</button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ENTRIES TAB — list view (3C)
// ═════════════════════════════════════════════════════════════════════════════
function EntriesSection({ entries, looms, openNew, onChanged }: {
  entries: LoomEntry[];
  looms: Loom[];
  openNew: boolean;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState('');
  const [loomFilter, setLoomFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; entry?: LoomEntry } | null>(null);

  const loomByNo = useMemo(() => Object.fromEntries(looms.map((l) => [l.loomNo, l])), [looms]);
  const hrs = shiftHours();

  useEffect(() => { if (openNew) setModal({ type: 'add' }); }, [openNew]);

  function handleSave(data: Omit<LoomEntry, 'id'>) {
    const now = new Date().toISOString();
    if (modal?.type === 'edit' && modal.entry) {
      loomEntriesDb.update(modal.entry.id, { ...data, updatedAt: now });
      toast.success('Entry updated');
    } else {
      const ids = loomEntriesDb.getAll().map((e) => e.entryId);
      loomEntriesDb.create({ ...data, entryId: genDailyId('LM', ids, data.date), createdAt: now, updatedAt: now });
      toast.success('Entry saved');
    }
    setModal(null);
    onChanged();
  }
  function handleDelete(id: string) {
    loomEntriesDb.delete(id);
    toast.success('Entry deleted');
    onChanged();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) =>
      (!q || e.entryId.toLowerCase().includes(q) || (e.operator ?? '').toLowerCase().includes(q)) &&
      (!loomFilter || e.loomNo === loomFilter) &&
      (!qualityFilter || e.quality === qualityFilter) &&
      (!shiftFilter || e.shift === shiftFilter) &&
      (!fromDate || e.date >= fromDate) &&
      (!toDate || e.date <= toDate)
    );
  }, [entries, search, loomFilter, qualityFilter, shiftFilter, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [search, loomFilter, qualityFilter, shiftFilter, fromDate, toDate]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleExport() {
    if (!filtered.length) { toast.error('Nothing to export'); return; }
    const rows = filtered.map((e) => ({
      'Entry ID': e.entryId, Date: e.date, Shift: e.shift, 'Loom No.': e.loomNo, Operator: e.operator ?? '',
      Width: e.width, Unit: e.widthUnit, 'Meters': e.meters, Quality: e.quality, 'Weight (kg)': e.weightKg,
      'Roll Count': e.rollCount, 'Reed Count': e.reedCount ?? '', RPM: e.rpm ?? '',
      'Downtime (min)': e.downtimeMin, 'Downtime Reason': e.downtimeReason ?? '',
      'Meters/kg': +metersPerKg(e).toFixed(2), 'Efficiency %': +efficiency(e, loomByNo[e.loomNo], hrs).toFixed(1),
      Notes: e.notes ?? '', 'Last Updated': e.updatedAt,
    }));
    exportToCsv(`loom-production-${today()}.csv`, rows);
    toast.success(`Exported ${rows.length} rows`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entry ID or operator…" className="input-field pl-9" />
        </div>
        <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary" disabled={looms.length === 0}
          title={looms.length === 0 ? 'Add a loom first (Looms tab)' : undefined}>
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="label">Loom</label>
          <select value={loomFilter} onChange={(e) => setLoomFilter(e.target.value)} className="input-field w-auto">
            <option value="">All Looms</option>
            {looms.map((l) => <option key={l.id} value={l.loomNo}>{l.loomNo}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Quality</label>
          <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} className="input-field w-auto">
            <option value="">All Grades</option>
            {QUALITY_GRADES.map((q) => <option key={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Shift</label>
          <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="input-field w-auto">
            <option value="">All Shifts</option>
            {SHIFTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input-field w-auto" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input-field w-auto" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Entry ID', 'Date', 'Loom', 'Operator', 'Meters', 'Weight', 'Quality', 'Rolls', 'Efficiency', ''].map((h) => (
                  <th key={h} className="table-header whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={10}>
                  <EmptyState icon={ListChecks} title="No loom entries yet"
                    description={looms.length ? 'Log a weaving session to start tracking output.' : 'Add a loom in the Looms tab first.'}
                    action={looms.length ? { label: 'New Loom Entry', onClick: () => setModal({ type: 'add' }) } : undefined} />
                </td></tr>
              ) : pageRows.map((e) => {
                const eff = efficiency(e, loomByNo[e.loomNo], hrs);
                return (
                  <tr key={e.id} className="table-row">
                    <td className="table-cell font-mono text-accent font-medium whitespace-nowrap">{e.entryId}</td>
                    <td className="table-cell text-white/70 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="table-cell text-white/80">{e.loomNo}</td>
                    <td className="table-cell text-white/70">{e.operator || '—'}</td>
                    <td className="table-cell font-mono text-white/80 whitespace-nowrap">{e.meters.toLocaleString('en-IN')} m</td>
                    <td className="table-cell font-mono text-white/70 whitespace-nowrap">{e.weightKg.toLocaleString('en-IN')} kg</td>
                    <td className="table-cell"><span className={cn('badge border text-xs', QUALITY_COLORS[e.quality])}>{e.quality}</span></td>
                    <td className="table-cell font-mono text-white/70">{e.rollCount}</td>
                    <td className={cn('table-cell font-mono', eff >= 75 ? 'text-green-300' : eff >= 50 ? 'text-yellow-300' : 'text-red-300')}>{eff.toFixed(1)}%</td>
                    <td className="table-cell">
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal({ type: 'edit', entry: e })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'New Loom Entry' : 'Edit Entry'} size="lg">
          <EntryForm
            initial={modal.entry ?? { ...emptyEntry, date: today() }}
            looms={looms}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LOOMS TAB — master settings (3B)
// ═════════════════════════════════════════════════════════════════════════════
const emptyLoom: Omit<Loom, 'id'> = {
  loomNo: '', model: '', maxRpm: 0, installDate: '', status: 'Active', createdAt: '', updatedAt: '',
};

function LoomForm({ initial, existing, onSave, onClose }: {
  initial: Omit<Loom, 'id'>;
  existing: Loom[];
  onSave: (d: Omit<Loom, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.loomNo.trim()) { toast.error('Loom No. is required'); return; }
    if (existing.some((l) => l.loomNo.toLowerCase() === f.loomNo.trim().toLowerCase())) {
      toast.error('A loom with this number already exists'); return;
    }
    onSave({ ...f, loomNo: f.loomNo.trim(), model: f.model?.trim() });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Loom No. *</label>
          <input className="input-field" value={f.loomNo} onChange={(e) => set('loomNo', e.target.value)} placeholder="Loom 1" autoFocus />
        </div>
        <div>
          <label className="label">Model</label>
          <input className="input-field" value={f.model ?? ''} onChange={(e) => set('model', e.target.value)} placeholder="e.g. Lohia LSL6" />
        </div>
        <div>
          <label className="label">Max RPM capacity</label>
          <input className="input-field font-mono" type="number" min="0" value={f.maxRpm || ''} onChange={(e) => set('maxRpm', toNum(e.target.value))} placeholder="e.g. 600" />
        </div>
        <div>
          <label className="label">Installation date</label>
          <input className="input-field" type="date" value={f.installDate ?? ''} onChange={(e) => set('installDate', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Status</label>
          <select className="input-field" value={f.status} onChange={(e) => set('status', e.target.value as LoomStatus)}>
            {LOOM_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Loom</button>
      </div>
    </div>
  );
}

function LoomsSection({ looms, onChanged }: { looms: Loom[]; onChanged: () => void }) {
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; loom?: Loom } | null>(null);
  const [hrs, setHrs] = useState(String(shiftHours()));

  function handleSave(data: Omit<Loom, 'id'>) {
    const now = new Date().toISOString();
    if (modal?.type === 'edit' && modal.loom) {
      loomsDb.update(modal.loom.id, { ...data, updatedAt: now });
      toast.success('Loom updated');
    } else {
      loomsDb.create({ ...data, createdAt: now, updatedAt: now });
      toast.success('Loom added');
    }
    setModal(null);
    onChanged();
  }
  function handleDelete(id: string) {
    loomsDb.delete(id);
    toast.success('Loom deleted');
    onChanged();
  }
  function saveHours() {
    const v = parseFloat(hrs);
    if (!Number.isFinite(v) || v <= 0) { toast.error('Enter valid shift hours'); return; }
    saveSettings({ loom_shift_hours: String(v) });
    toast.success('Shift hours saved');
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-end gap-2">
          <div>
            <label className="label">Shift hours (for efficiency %)</label>
            <input className="input-field font-mono w-32" type="number" min="1" step="any" value={hrs} onChange={(e) => setHrs(e.target.value)} />
          </div>
          <button onClick={saveHours} className="btn-secondary">Save</button>
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Loom</button>
      </div>

      {looms.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={Settings2} title="No looms configured"
            description="Register your looms so they appear in the entry form and drive efficiency calculations."
            action={{ label: 'Add First Loom', onClick: () => setModal({ type: 'add' }) }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {looms.map((l) => (
            <div key={l.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{l.loomNo}</p>
                  <p className="text-muted text-xs mt-0.5">{l.model || '—'}</p>
                </div>
                <span className={cn('badge border text-xs', LOOM_STATUS_COLORS[l.status])}>{l.status}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="text-muted">Max RPM <span className="font-mono text-white/80">{l.maxRpm || '—'}</span></span>
                {l.installDate && <span className="text-muted">Installed <span className="text-white/80">{formatDate(l.installDate)}</span></span>}
              </div>
              <div className="flex gap-1.5 pt-1 border-t border-white/5">
                <button onClick={() => setModal({ type: 'edit', loom: l })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(l.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Loom' : 'Edit Loom'} size="md">
          <LoomForm
            initial={modal.loom ?? { ...emptyLoom }}
            existing={modal.type === 'edit' && modal.loom ? looms.filter((l) => l.id !== modal.loom!.id) : looms}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export function LoomProductionPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'entries' | 'looms'>('entries');
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const wantNew = params.get('new') === '1';
  useEffect(() => {
    if (wantNew) { setTab('entries'); const p = new URLSearchParams(params); p.delete('new'); setParams(p, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { entries, looms } = useMemo(() => {
    void tick;
    return { entries: loomEntriesDb.getAll(), looms: loomsDb.getAll() };
  }, [tick]);

  const stats = useMemo(() => {
    const todayStr = today();
    const todayEntries = entries.filter((e) => e.date === todayStr);
    const aGrade = entries.filter((e) => e.quality === 'A-Grade').length;
    return {
      metersToday: todayEntries.reduce((s, e) => s + (e.meters || 0), 0),
      totalEntries: entries.length,
      aGradePct: entries.length ? (aGrade / entries.length) * 100 : 0,
      activeLooms: looms.filter((l) => l.status === 'Active').length,
    };
  }, [entries, looms]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Loom Production</h1>
        <p className="text-muted text-sm mt-1">Track weaving output, quality, downtime and loom efficiency</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Meters Today" value={`${stats.metersToday.toLocaleString('en-IN')} m`} icon={Ruler} iconColor="text-accent" mono />
        <StatCard label="Total Entries" value={stats.totalEntries} icon={ListChecks} iconColor="text-blue-400" mono />
        <StatCard label="A-Grade Share" value={`${stats.aGradePct.toFixed(0)}%`} icon={CheckCircle2} iconColor="text-green-400" mono />
        <StatCard label="Active Looms" value={stats.activeLooms} icon={Activity} iconColor="text-yellow-400" mono />
      </div>

      <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10 w-fit">
        {([
          { k: 'entries', label: 'Production Entries', icon: Gauge },
          { k: 'looms', label: 'Looms', icon: Settings2 },
        ] as const).map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all',
              tab === k ? 'bg-primary text-white shadow' : 'text-muted hover:text-white')}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'entries' && <EntriesSection entries={entries} looms={looms} openNew={wantNew} onChanged={bump} />}
      {tab === 'looms' && <LoomsSection looms={looms} onChanged={bump} />}
    </div>
  );
}
