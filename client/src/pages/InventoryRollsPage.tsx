import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Boxes } from 'lucide-react';
import toast from 'react-hot-toast';
import { invRollsDb } from '../lib/db';
import { DEFAULT_ROLL_TYPES, ROLL_TYPES_KEY } from '../config';
import type { InvRoll } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { ListSelect } from '../components/ui/ListSelect';
import { formatDate, cn } from '../lib/utils';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

const emptyRoll: Omit<InvRoll, 'id'> = {
  rollNo: '', type: '', size: '', quality: 0, gWt: 0, nWt: 0, meter: 0, dateAdded: today(),
};

function RollForm({ initial, onSave, onClose }: {
  initial: Omit<InvRoll, 'id'>; onSave: (d: Omit<InvRoll, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.rollNo.trim()) { toast.error('Roll No. is required'); return; }
    if (!f.type) { toast.error('Type is required'); return; }
    onSave({ ...f, rollNo: f.rollNo.trim() });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Roll No *</label><input className="input-field font-mono" value={f.rollNo} onChange={(e) => set('rollNo', e.target.value)} placeholder="R-001" autoFocus /></div>
        <div><label className="label">Type *</label><ListSelect value={f.type} onChange={(v) => set('type', v)} listKey={ROLL_TYPES_KEY} defaults={DEFAULT_ROLL_TYPES} placeholder="Select type…" /></div>
        <div><label className="label">Size</label><input className="input-field" value={f.size} onChange={(e) => set('size', e.target.value)} placeholder="500mm" /></div>
        <div><label className="label">Quality</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.quality || ''} onChange={(e) => set('quality', num(e.target.value))} placeholder="2.5" /></div>
        <div><label className="label">G.WT (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.gWt || ''} onChange={(e) => set('gWt', num(e.target.value))} /></div>
        <div><label className="label">N.WT (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.nWt || ''} onChange={(e) => set('nWt', num(e.target.value))} /></div>
        <div><label className="label">Meter</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.meter || ''} onChange={(e) => set('meter', num(e.target.value))} /></div>
        <div><label className="label">Date</label><input className="input-field" type="date" value={f.dateAdded} onChange={(e) => set('dateAdded', e.target.value)} /></div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Roll</button>
      </div>
    </div>
  );
}

export function InventoryRollsPage() {
  const [rolls, setRolls] = useState<InvRoll[]>(() => invRollsDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; roll?: InvRoll } | null>(null);
  const reload = useCallback(() => setRolls(invRollsDb.getAll()), []);

  function handleSave(data: Omit<InvRoll, 'id'>) {
    if (modal?.type === 'edit' && modal.roll) { invRollsDb.update(modal.roll.id, data); toast.success('Roll updated'); }
    else { invRollsDb.create(data); toast.success('Roll added to stock'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { invRollsDb.delete(id); toast.success('Roll deleted'); reload(); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rolls.filter((r) => !q || r.rollNo.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
  }, [rolls, search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">Rolls</h1><p className="text-muted text-sm mt-1">Normal roll / fabric stock — bought or made in factory</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Roll</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Rolls in Stock" value={rolls.filter((r) => !r.balanceUsed).length} icon={Boxes} iconColor="text-accent" mono />
        <StatCard label="Balance (used) Rolls" value={rolls.filter((r) => r.balanceUsed).length} icon={Boxes} iconColor="text-yellow-400" mono />
        <StatCard label="Total Net Wt (kg)" value={rolls.reduce((s, r) => s + (r.nWt || 0), 0).toLocaleString('en-IN')} icon={Boxes} iconColor="text-green-400" mono />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roll no or type…" className="input-field pl-9" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Roll No', 'Type', 'Size', 'Quality', 'G.WT', 'N.WT', 'Meter', 'Date', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={Boxes} title="No rolls in stock" action={{ label: 'Add First Roll', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className={cn('table-row', r.balanceUsed && 'bg-yellow-500/10')}>
                  <td className="table-cell font-mono text-accent whitespace-nowrap">{r.rollNo}{r.balanceUsed && <span className="ml-1.5 text-[10px] text-yellow-300">used</span>}</td>
                  <td className="table-cell text-white/80">{r.type}</td>
                  <td className="table-cell text-white/70">{r.size || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.quality || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.gWt || '—'}</td>
                  <td className="table-cell font-mono text-white/80">{r.nWt || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.meter || '—'}</td>
                  <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(r.dateAdded)}</td>
                  <td className="table-cell"><div className="flex gap-1.5">
                    <button onClick={() => setModal({ type: 'edit', roll: r })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Roll' : 'Edit Roll'} size="lg">
          <RollForm initial={modal.roll ?? { ...emptyRoll, dateAdded: today() }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
