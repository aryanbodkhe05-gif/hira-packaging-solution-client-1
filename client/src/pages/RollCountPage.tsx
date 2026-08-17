import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Trash2, Scroll, Truck, AlertTriangle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { unitRollsDb, invRollsDb } from '../lib/db';
import { useUnit } from '../context/UnitContext';
import { unitName } from '../lib/units';
import {
  DEFAULT_ROLL_TYPES, ROLL_TYPES_KEY, DEFAULT_ROLL_SIZEGM, ROLL_SIZEGM_KEY,
  DEFAULT_ROLL_GM, ROLL_GM_KEY,
} from '../config';
import type { UnitRoll } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { ListSelect } from '../components/ui/ListSelect';
import { TypeAhead, rememberTypeAhead } from '../components/ui/TypeAhead';

const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

// Add a roll made in this unit into its own stock. Roll No is typed by hand.
function AddRollForm({ onSave, onClose }: { onSave: (r: { rollNo: string; type: string; size: string; gm?: number; gWt: number; nWt: number; meter: number; avg?: number }) => void; onClose: () => void }) {
  const [rollNo, setRollNo] = useState('');
  const [type, setType] = useState('');
  const [size, setSize] = useState('');
  const [gm, setGm] = useState('');
  const [gWt, setGWt] = useState('');
  const [nWt, setNWt] = useState('');
  const [meter, setMeter] = useState('');
  const [avg, setAvg] = useState('');
  function submit() {
    if (!rollNo.trim()) { toast.error('Roll No is required'); return; }
    if (!size.trim()) { toast.error('Size is required'); return; }
    rememberTypeAhead(ROLL_SIZEGM_KEY, size, DEFAULT_ROLL_SIZEGM);
    if (gm.trim()) rememberTypeAhead(ROLL_GM_KEY, gm, DEFAULT_ROLL_GM);
    onSave({ rollNo: rollNo.trim(), type, size: size.trim(), gm: num(gm) || undefined, gWt: num(gWt), nWt: num(nWt), meter: num(meter), avg: num(avg) || undefined });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><label className="label">Roll No *</label><input className="input-field font-mono" value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="type roll no" autoFocus /></div>
        <div><label className="label">Type</label><ListSelect value={type} onChange={setType} listKey={ROLL_TYPES_KEY} defaults={DEFAULT_ROLL_TYPES} placeholder="Select type…" /></div>
        <div><label className="label">Size *</label><TypeAhead value={size} onChange={setSize} listKey={ROLL_SIZEGM_KEY} defaults={DEFAULT_ROLL_SIZEGM} placeholder="e.g. 500mm" /></div>
        <div><label className="label">GM</label><TypeAhead value={gm} onChange={setGm} listKey={ROLL_GM_KEY} defaults={DEFAULT_ROLL_GM} placeholder="e.g. 12" /></div>
        <div><label className="label">G.WT (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={gWt} onChange={(e) => setGWt(e.target.value)} /></div>
        <div><label className="label">N.WT (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={nWt} onChange={(e) => setNWt(e.target.value)} /></div>
        <div><label className="label">Meter</label><input className="input-field font-mono" type="number" min="0" step="any" value={meter} onChange={(e) => setMeter(e.target.value)} /></div>
        <div><label className="label">Avg</label><input className="input-field font-mono" type="number" min="0" step="any" value={avg} onChange={(e) => setAvg(e.target.value)} /></div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Add Roll</button>
      </div>
    </div>
  );
}

export function RollCountPage() {
  const { activeUnit } = useUnit();
  const [rolls, setRolls] = useState<UnitRoll[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recheck, setRecheck] = useState(false);   // step-1 confirm screen

  const reload = useCallback(() => {
    setRolls(unitRollsDb.getAll().filter((r) => r.unitId === activeUnit && r.status === 'in_unit'));
    setSelected(new Set());
  }, [activeUnit]);
  useEffect(() => { reload(); }, [reload]);

  function handleAdd(r: { rollNo: string; type: string; size: string; gm?: number; gWt: number; nWt: number; meter: number; avg?: number }) {
    unitRollsDb.create({ unitId: activeUnit, status: 'in_unit', createdAt: new Date().toISOString(), ...r });
    toast.success('Roll added to unit stock');
    setAddOpen(false); reload();
  }
  function handleDelete(id: string) { unitRollsDb.delete(id); toast.success('Roll removed'); reload(); }

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((p) => (p.size === rolls.length ? new Set() : new Set(rolls.map((r) => r.id))));

  const selectedRolls = useMemo(() => rolls.filter((r) => selected.has(r.id)), [rolls, selected]);

  // Step 2: on confirm, deduct from unit stock and create In-Transit rolls in Inventory.
  function doTransfer() {
    const now = new Date().toISOString();
    for (const r of selectedRolls) {
      invRollsDb.create({
        rollNo: '', type: r.type || '', size: r.size, gm: r.gm, quality: 0,
        gWt: r.gWt, nWt: r.nWt, meter: r.meter, avg: r.avg, rate: null,
        party: 'Hira Packaging', inTransit: true, fromUnitId: activeUnit, dateAdded: now.slice(0, 10),
      });
      unitRollsDb.delete(r.id);
    }
    toast.success(`${selectedRolls.length} roll${selectedRolls.length === 1 ? '' : 's'} sent to Inventory (In Transit)`);
    setRecheck(false); reload();
  }

  const totalKg = rolls.reduce((s, r) => s + (r.nWt || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-header">Roll Count — {unitName(activeUnit)}</h1>
          <p className="text-muted text-sm mt-1">Rolls made in this unit. Select rolls to transfer into Inventory (two-step: transfer → receive).</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Roll</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Rolls in Unit" value={rolls.length} icon={Scroll} iconColor="text-accent" mono />
        <StatCard label="Selected" value={selected.size} icon={Send} iconColor="text-orange-400" mono />
        <StatCard label="Total Net Wt (kg)" value={totalKg.toLocaleString('en-IN')} icon={Scroll} iconColor="text-green-400" mono />
      </div>

      {selected.size > 0 && (
        <div className="glass-card border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-white/90">{selected.size} roll{selected.size === 1 ? '' : 's'} selected for transfer to Inventory.</span>
          <button onClick={() => setRecheck(true)} className="btn-primary py-1.5"><Truck className="w-4 h-4" /> Transfer selected</button>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              <th className="table-header w-8"><input type="checkbox" className="w-4 h-4 accent-primary" checked={rolls.length > 0 && selected.size === rolls.length} onChange={toggleAll} /></th>
              {['Roll No', 'Type', 'Size', 'GM', 'G.WT', 'N.WT', 'Meter', 'Avg', 'Added', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {rolls.length === 0 ? (
                <tr><td colSpan={11}><EmptyState icon={Scroll} title="No rolls in this unit" action={{ label: 'Add Roll', onClick: () => setAddOpen(true) }} /></td></tr>
              ) : rolls.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell"><input type="checkbox" className="w-4 h-4 accent-primary" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="table-cell font-mono text-accent whitespace-nowrap">{r.rollNo || '—'}</td>
                  <td className="table-cell text-white/80">{r.type || '—'}</td>
                  <td className="table-cell text-white/70">{r.size || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.gm ?? '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.gWt || '—'}</td>
                  <td className="table-cell font-mono text-white/80">{r.nWt || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.meter || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.avg ?? '—'}</td>
                  <td className="table-cell text-muted text-xs whitespace-nowrap">{r.createdAt?.slice(0, 10)}</td>
                  <td className="table-cell"><button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <Modal open onClose={() => setAddOpen(false)} title={`Add Roll — ${unitName(activeUnit)}`} size="lg">
          <AddRollForm onSave={handleAdd} onClose={() => setAddOpen(false)} />
        </Modal>
      )}

      {/* Step 1 — recheck + warning before transfer */}
      {recheck && (
        <Modal open onClose={() => setRecheck(false)} title="Recheck rolls to transfer" size="lg">
          <div className="space-y-4">
            <p className="text-muted text-sm">These {selectedRolls.length} roll{selectedRolls.length === 1 ? '' : 's'} will leave <span className="text-white/80">{unitName(activeUnit)}</span> stock and appear in Inventory Rolls as <span className="text-orange-300">In Transit</span> until someone Receives them.</p>
            <div className="rounded-lg border border-white/10 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-muted bg-navy/40"><th className="text-left px-3 py-1.5">Roll No</th><th className="text-left px-3 py-1.5">Type</th><th className="text-left px-3 py-1.5">Size / GM</th><th className="text-left px-3 py-1.5">N.WT</th><th className="text-left px-3 py-1.5">Meter</th></tr></thead>
                <tbody>
                  {selectedRolls.map((r) => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="px-3 py-1.5 font-mono text-accent">{r.rollNo || '—'}</td>
                      <td className="px-3 py-1.5 text-white/80">{r.type || '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-white/70">{r.size || '—'} / {r.gm ?? '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-white/80">{r.nWt || '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-white/70">{r.meter || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-start gap-2 text-sm text-yellow-200/90 bg-yellow-500/10 border border-yellow-500/25 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>⚠️ Are you sure you want to transfer these {selectedRolls.length} roll{selectedRolls.length === 1 ? '' : 's'}? This deducts them from the unit and they must be Received in Inventory.</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRecheck(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={doTransfer} className="btn-primary flex-1 justify-center"><Truck className="w-4 h-4" /> Confirm Transfer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
