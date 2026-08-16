import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Boxes, PackageCheck, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { invRollsDb } from '../lib/db';
import {
  DEFAULT_ROLL_TYPES, ROLL_TYPES_KEY, DEFAULT_PARTIES, PARTIES_KEY,
  DEFAULT_ROLL_SIZEGM, ROLL_SIZEGM_KEY,
} from '../config';
import type { InvRoll } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { ListSelect } from '../components/ui/ListSelect';
import { TypeAhead, rememberTypeAhead } from '../components/ui/TypeAhead';
import { formatDate, cn } from '../lib/utils';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
// Second grouping component: GM (new) with legacy `quality` fallback for old rolls.
const gmVal = (r: Pick<InvRoll, 'gm' | 'quality'>) => (r.gm ?? r.quality) || '';

// ── Bulk add: shared Type/Size/GM/Party, then N per-roll rows (G.WT/N.WT/Meter/Avg).
// Roll nos auto-sequence per size+GM group. Size is a reusable type-ahead (same fixed
// pattern as raw materials — no list bug).
interface BulkRow { gWt: string; nWt: string; meter: string; avg: string; }
function BulkRollForm({ nextNo, onSave, onClose }: {
  nextNo: (size: string, gm: number) => number;   // next running number for a size+GM group
  onSave: (rolls: Omit<InvRoll, 'id'>[]) => void; onClose: () => void;
}) {
  const [type, setType] = useState('');
  const [size, setSize] = useState('');
  const [gmText, setGmText] = useState('');
  const [party, setParty] = useState('');
  const [date, setDate] = useState(today());
  const [countText, setCountText] = useState('');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const gm = num(gmText);

  function generate() {
    if (!size.trim()) { toast.error('Enter Size first'); return; }
    const n = Math.max(0, Math.min(50, Math.floor(parseFloat(countText) || 0)));
    if (n <= 0) { toast.error('Enter how many rolls (1–50)'); return; }
    setRows(Array.from({ length: n }, () => ({ gWt: '', nWt: '', meter: '', avg: '' })));
  }
  const setRow = (i: number, k: keyof BulkRow, v: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  function submit() {
    if (!type) { toast.error('Type is required'); return; }
    if (!size.trim()) { toast.error('Size is required'); return; }
    if (rows.length === 0) { toast.error('Choose how many rolls and press Generate'); return; }
    rememberTypeAhead(ROLL_SIZEGM_KEY, size, DEFAULT_ROLL_SIZEGM);
    if (party.trim()) rememberTypeAhead(PARTIES_KEY, party, DEFAULT_PARTIES);
    const base = nextNo(size.trim(), gm);
    const rolls: Omit<InvRoll, 'id'>[] = rows.map((r, i) => ({
      rollNo: `R-${size.trim()}-${gm || '0'}-${base + i}`.replace(/\s/g, ''),
      type, size: size.trim(), gm: gm || undefined, quality: 0,
      gWt: num(r.gWt), nWt: num(r.nWt), meter: num(r.meter), avg: num(r.avg) || undefined,
      rate: null, party: party.trim() || undefined, dateAdded: date,
    }));
    onSave(rolls);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><label className="label">Type *</label><ListSelect value={type} onChange={setType} listKey={ROLL_TYPES_KEY} defaults={DEFAULT_ROLL_TYPES} placeholder="Select type…" /></div>
        <div><label className="label">Size *</label><TypeAhead value={size} onChange={setSize} listKey={ROLL_SIZEGM_KEY} defaults={DEFAULT_ROLL_SIZEGM} placeholder="e.g. 500mm" /></div>
        <div><label className="label">GM</label><input className="input-field font-mono" type="number" min="0" step="any" value={gmText} onChange={(e) => setGmText(e.target.value)} placeholder="12" /></div>
        <div><label className="label">Party Name</label><TypeAhead value={party} onChange={setParty} listKey={PARTIES_KEY} defaults={DEFAULT_PARTIES} placeholder="outside party" /></div>
        <div><label className="label">Date</label><input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div>
          <label className="label">How many rolls?</label>
          <div className="flex gap-1.5">
            <input className="input-field font-mono" type="number" min="1" max="50" value={countText} onChange={(e) => setCountText(e.target.value)} placeholder="e.g. 5" />
            <button type="button" onClick={generate} className="px-3 rounded bg-primary text-white shrink-0" title="Generate rows"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border border-accent/10 overflow-hidden">
          <div className="px-3 py-2 bg-navy/40 text-xs text-muted uppercase tracking-wide">
            {rows.length} roll{rows.length === 1 ? '' : 's'} · {size || '—'} / {gm || '—'} GM · nos R-{size || '—'}-{gm || '0'}-{nextNo(size.trim(), gm)}…
          </div>
          <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
            <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr] gap-2 text-[11px] text-muted uppercase tracking-wide px-1">
              <span>#</span><span>G.WT</span><span>N.WT</span><span>Meter</span><span>Avg</span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr] gap-2 items-center">
                <span className="text-muted text-xs font-mono">{i + 1}</span>
                <input className="input-field font-mono py-1 text-sm" type="number" min="0" step="any" value={r.gWt} onChange={(e) => setRow(i, 'gWt', e.target.value)} placeholder="G.WT" />
                <input className="input-field font-mono py-1 text-sm" type="number" min="0" step="any" value={r.nWt} onChange={(e) => setRow(i, 'nWt', e.target.value)} placeholder="N.WT" />
                <input className="input-field font-mono py-1 text-sm" type="number" min="0" step="any" value={r.meter} onChange={(e) => setRow(i, 'meter', e.target.value)} placeholder="Meter" />
                <input className="input-field font-mono py-1 text-sm" type="number" min="0" step="any" value={r.avg} onChange={(e) => setRow(i, 'avg', e.target.value)} placeholder="Avg" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save {rows.length || ''} Roll{rows.length === 1 ? '' : 's'}</button>
      </div>
    </div>
  );
}

// Single-roll edit (weights/rate/party/gm). Roll no + grouping stay as-is.
function EditRollForm({ initial, onSave, onClose }: {
  initial: InvRoll; onSave: (d: Partial<InvRoll>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const [rateText, setRateText] = useState(initial.rate == null ? '' : String(initial.rate));
  const set = (k: keyof InvRoll, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><label className="label">Roll No</label><input className="input-field font-mono bg-white/5 text-white/60" value={f.rollNo} readOnly /></div>
        <div><label className="label">Type</label><ListSelect value={f.type} onChange={(v) => set('type', v)} listKey={ROLL_TYPES_KEY} defaults={DEFAULT_ROLL_TYPES} placeholder="Select type…" /></div>
        <div><label className="label">Size</label><input className="input-field" value={f.size} onChange={(e) => set('size', e.target.value)} /></div>
        <div><label className="label">GM</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.gm ?? ''} onChange={(e) => set('gm', num(e.target.value) || undefined)} /></div>
        <div><label className="label">G.WT (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.gWt || ''} onChange={(e) => set('gWt', num(e.target.value))} /></div>
        <div><label className="label">N.WT (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.nWt || ''} onChange={(e) => set('nWt', num(e.target.value))} /></div>
        <div><label className="label">Meter</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.meter || ''} onChange={(e) => set('meter', num(e.target.value))} /></div>
        <div><label className="label">Avg</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.avg ?? ''} onChange={(e) => set('avg', num(e.target.value) || undefined)} /></div>
        <div><label className="label">Rate (₹/kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder="blank if unknown" /></div>
        <div><label className="label">Party</label><TypeAhead value={f.party ?? ''} onChange={(v) => set('party', v)} listKey={PARTIES_KEY} defaults={DEFAULT_PARTIES} placeholder="party" /></div>
        <div><label className="label">Date</label><input className="input-field" type="date" value={f.dateAdded} onChange={(e) => set('dateAdded', e.target.value)} /></div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={() => onSave({ ...f, rate: rateText.trim() === '' ? null : num(rateText) })} className="btn-primary flex-1 justify-center">Save Roll</button>
      </div>
    </div>
  );
}

export function InventoryRollsPage() {
  const [rolls, setRolls] = useState<InvRoll[]>(() => invRollsDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editRoll, setEditRoll] = useState<InvRoll | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const reload = useCallback(() => setRolls(invRollsDb.getAll()), []);

  // Group by size + GM (e.g. "500mm / 12").
  const groupKey = (r: InvRoll) => `${r.size || '—'} / ${gmVal(r) || '—'}`;

  // Next running number for a size+GM group — continues past already-received rolls
  // in that group (in-transit rolls have no number yet, so they don't count).
  const nextNo = useCallback((size: string, gm: number) => {
    const key = `${size || '—'} / ${gm || '—'}`;
    const n = rolls.filter((r) => !r.dispatched && !r.inTransit && groupKey(r) === key).length;
    return n + 1;
  }, [rolls]);

  function handleBulkSave(newRolls: Omit<InvRoll, 'id'>[]) {
    newRolls.forEach((r) => invRollsDb.create(r));
    toast.success(`${newRolls.length} roll${newRolls.length === 1 ? '' : 's'} added to stock`);
    setAddOpen(false); reload();
  }
  function handleEditSave(patch: Partial<InvRoll>) {
    if (editRoll) { invRollsDb.update(editRoll.id, patch); toast.success('Roll updated'); }
    setEditRoll(null); reload();
  }
  function handleDelete(id: string) { invRollsDb.delete(id); toast.success('Roll deleted'); reload(); }

  // Receive an in-transit roll (transferred from a unit) into inventory — with a
  // confirmation, then assign its running roll no for the size+GM group.
  function handleReceive(roll: InvRoll) {
    if (!confirm(`Receive this roll into Inventory?\n\n${roll.size || '—'} / ${gmVal(roll) || '—'} GM · N.WT ${roll.nWt || 0}kg · from ${roll.party || 'unit'}.\nA roll number will be assigned and it leaves "In Transit".`)) return;
    const rollNo = `R-${roll.size}-${gmVal(roll) || '0'}-${nextNo(roll.size, Number(gmVal(roll)) || 0)}`.replace(/\s/g, '');
    invRollsDb.update(roll.id, { inTransit: false, rollNo });
    toast.success(`Received as ${rollNo}`); reload();
  }

  const available = useMemo(() => rolls.filter((r) => !r.dispatched), [rolls]);
  const inTransit = useMemo(() => available.filter((r) => r.inTransit), [available]);
  const inStock = useMemo(() => available.filter((r) => !r.inTransit), [available]);
  const groups = useMemo(() => {
    const m = new Map<string, { count: number; kg: number }>();
    for (const r of inStock) { const k = groupKey(r); const g = m.get(k) ?? { count: 0, kg: 0 }; g.count++; g.kg += r.nWt || 0; m.set(k, g); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [inStock]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inStock.filter((r) => (activeGroup === 'all' || groupKey(r) === activeGroup) &&
      (!q || r.rollNo.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) || (r.party ?? '').toLowerCase().includes(q)));
  }, [inStock, search, activeGroup]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">Rolls</h1><p className="text-muted text-sm mt-1">Normal roll / fabric stock — bought outside or transferred from a Loom/P.P. unit</p></div>
        <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Rolls</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Rolls in Stock" value={inStock.filter((r) => !r.balanceUsed).length} icon={Boxes} iconColor="text-accent" mono />
        <StatCard label="Balance (used) Rolls" value={inStock.filter((r) => r.balanceUsed).length} icon={Boxes} iconColor="text-yellow-400" mono />
        <StatCard label="In Transit" value={inTransit.length} icon={Truck} iconColor="text-orange-400" mono />
        <StatCard label="Total Net Wt (kg)" value={inStock.reduce((s, r) => s + (r.nWt || 0), 0).toLocaleString('en-IN')} icon={Boxes} iconColor="text-green-400" mono />
      </div>

      {/* In-transit rolls awaiting Receive */}
      {inTransit.length > 0 && (
        <div className="glass-card border border-orange-500/30 bg-orange-500/5 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-2 text-sm text-orange-200/90 border-b border-orange-500/20">
            <Truck className="w-4 h-4" /> {inTransit.length} roll{inTransit.length === 1 ? '' : 's'} in transit from a unit — Receive to add into inventory with a roll number.
          </div>
          <div className="overflow-x-auto"><table className="w-full">
            <tbody>
              {inTransit.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell"><span className="badge bg-orange-500/15 text-orange-300 border border-orange-500/30 text-[10px]">In Transit</span></td>
                  <td className="table-cell text-white/80">{r.type || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.size || '—'} / {gmVal(r) || '—'} GM</td>
                  <td className="table-cell font-mono text-white/80">N.WT {r.nWt || '—'}</td>
                  <td className="table-cell text-white/70">{r.party || '—'}</td>
                  <td className="table-cell text-right">
                    <button onClick={() => handleReceive(r)} className="btn-primary py-1 text-xs"><PackageCheck className="w-3.5 h-3.5" /> Receive</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roll no, type or party…" className="input-field pl-9" />
      </div>

      {/* Size / GM group chips */}
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={() => setActiveGroup('all')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', activeGroup === 'all' ? 'bg-primary text-white border-primary' : 'bg-white/5 text-muted border-white/10 hover:text-white')}>
          All ({inStock.length})
        </button>
        {groups.map(([k, g]) => (
          <button key={k} onClick={() => setActiveGroup(k)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', activeGroup === k ? 'bg-primary text-white border-primary' : 'bg-white/5 text-white/70 border-white/10 hover:text-white')}>
            {k} · {g.count} · {g.kg.toLocaleString('en-IN')}kg
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Roll No', 'Type', 'Size', 'GM', 'G.WT', 'N.WT', 'Meter', 'Avg', 'Party', 'Rate', 'Date', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={12}><EmptyState icon={Boxes} title="No rolls in stock" action={{ label: 'Add Rolls', onClick: () => setAddOpen(true) }} /></td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className={cn('table-row', r.balanceUsed && 'bg-yellow-500/10')}>
                  <td className="table-cell font-mono text-accent whitespace-nowrap">{r.rollNo}{r.balanceUsed && <span className="ml-1.5 text-[10px] text-yellow-300">used</span>}</td>
                  <td className="table-cell text-white/80">{r.type}</td>
                  <td className="table-cell text-white/70">{r.size || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{gmVal(r) || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.gWt || '—'}</td>
                  <td className="table-cell font-mono text-white/80">{r.nWt || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.meter || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.avg ?? '—'}</td>
                  <td className="table-cell text-white/70 whitespace-nowrap">{r.party || '—'}</td>
                  <td className="table-cell font-mono whitespace-nowrap">
                    {r.rate == null
                      ? <span className="badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px]">rate not set</span>
                      : <span className="text-white/80">₹{r.rate.toLocaleString('en-IN')}</span>}
                  </td>
                  <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(r.dateAdded)}</td>
                  <td className="table-cell"><div className="flex gap-1.5">
                    <button onClick={() => setEditRoll(r)} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {addOpen && (
        <Modal open onClose={() => setAddOpen(false)} title="Add Rolls (bulk by Size + GM)" size="lg">
          <BulkRollForm nextNo={nextNo} onSave={handleBulkSave} onClose={() => setAddOpen(false)} />
        </Modal>
      )}
      {editRoll && (
        <Modal open onClose={() => setEditRoll(null)} title="Edit Roll" size="lg">
          <EditRollForm initial={editRoll} onSave={handleEditSave} onClose={() => setEditRoll(null)} />
        </Modal>
      )}
    </div>
  );
}
