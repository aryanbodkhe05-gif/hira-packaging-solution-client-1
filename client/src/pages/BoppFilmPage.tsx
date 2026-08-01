import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { boppFilmsDb } from '../lib/db';
import { FINISHES } from '../config';
import type { Finish } from '../config';
import type { BoppFilm } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { formatDate, cn } from '../lib/utils';

const PAGE_SIZE = 20;
const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const netWt = (f: BoppFilm) => f.nWt ?? f.kg ?? 0;

const emptyFilm: Omit<BoppFilm, 'id'> = { filmNo: '', size: '', gWt: 0, nWt: 0, kg: 0, meter: 0, finish: undefined, rate: null, dateAdded: today() };

// Inward form — mirrors the Rolls form: Size, G.WT, N.WT, Meter, Finish, Rate.
function FilmForm({ initial, onSave, onClose }: {
  initial: Omit<BoppFilm, 'id'>; onSave: (d: Omit<BoppFilm, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const [rateText, setRateText] = useState(initial.rate == null ? '' : String(initial.rate));
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.filmNo.trim()) { toast.error('Film No. is required'); return; }
    const nWt = f.nWt || 0;
    onSave({ ...f, filmNo: f.filmNo.trim(), nWt, kg: nWt, rate: rateText.trim() === '' ? null : num(rateText) });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Film No *</label><input className="input-field font-mono" value={f.filmNo} onChange={(e) => set('filmNo', e.target.value)} placeholder="F-001" autoFocus /></div>
        <div><label className="label">Size</label><input className="input-field" value={f.size ?? ''} onChange={(e) => set('size', e.target.value)} placeholder="520mm" /></div>
        <div><label className="label">Finish</label>
          <select className="input-field" value={f.finish ?? ''} onChange={(e) => set('finish', (e.target.value || undefined) as Finish | undefined)}>
            <option value="">—</option>{FINISHES.map((x) => <option key={x}>{x}</option>)}<option>Pearl</option>
          </select>
        </div>
        <div><label className="label">G.WT (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.gWt || ''} onChange={(e) => set('gWt', num(e.target.value))} /></div>
        <div><label className="label">N.WT (kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.nWt || ''} onChange={(e) => set('nWt', num(e.target.value))} /></div>
        <div><label className="label">Meter</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.meter || ''} onChange={(e) => set('meter', num(e.target.value))} /></div>
        <div><label className="label">Rate (₹/kg)</label><input className="input-field font-mono" type="number" min="0" step="any" value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder="leave blank if not known" /></div>
        <div><label className="label">Date</label><input className="input-field" type="date" value={f.dateAdded} onChange={(e) => set('dateAdded', e.target.value)} /></div>
      </div>
      {rateText.trim() === '' && (
        <p className="text-yellow-300/90 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
          Saved without a rate. This film is excluded from cost totals until you price it — never counted as ₹0.
        </p>
      )}
      <p className="text-muted text-xs">Each film carries its own rate and is costed at that rate when consumed on a job card.</p>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Film</button>
      </div>
    </div>
  );
}

export function BoppFilmPage() {
  const [films, setFilms] = useState<BoppFilm[]>(() => boppFilmsDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; film?: BoppFilm } | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const reload = useCallback(() => setFilms(boppFilmsDb.getAll()), []);

  // Group by size (e.g. "520mm"). Groups auto-appear as films are added.
  const groupKey = (f: BoppFilm) => `${f.size || '—'}`;

  function handleSave(data: Omit<BoppFilm, 'id'>) {
    if (modal?.type === 'edit' && modal.film) { boppFilmsDb.update(modal.film.id, data); toast.success('Film updated'); }
    else { boppFilmsDb.create(data); toast.success('Film added to stock'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { boppFilmsDb.delete(id); toast.success('Film deleted'); reload(); }

  const available = useMemo(() => films, [films]);
  const groups = useMemo(() => {
    const m = new Map<string, { count: number; kg: number }>();
    for (const f of available) { const k = groupKey(f); const g = m.get(k) ?? { count: 0, kg: 0 }; g.count++; g.kg += netWt(f); m.set(k, g); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [available]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return available.filter((f) => (activeGroup === 'all' || groupKey(f) === activeGroup) &&
      (!q || f.filmNo.toLowerCase().includes(q) || (f.finish ?? '').toLowerCase().includes(q)));
  }, [available, search, activeGroup]);
  // Next film-no suggestion within the active group (per-group sequence, like rolls).
  function suggestFilmNo(): string {
    if (activeGroup === 'all') return '';
    const n = available.filter((f) => groupKey(f) === activeGroup).length + 1;
    return `F-${activeGroup}-${n}`.replace(/\s/g, '');
  }
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">BOPP Film</h1><p className="text-muted text-sm mt-1">Incoming BOPP film stock — grouped by size, each film at its own rate</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Film</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Films in Stock" value={films.filter((r) => !r.balanceUsed).length} icon={Layers} iconColor="text-accent" mono />
        <StatCard label="Balance (used)" value={films.filter((r) => r.balanceUsed).length} icon={Layers} iconColor="text-yellow-400" mono />
        <StatCard label="Total Net Wt (kg)" value={films.reduce((s, r) => s + netWt(r), 0).toLocaleString('en-IN')} icon={Layers} iconColor="text-green-400" mono />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search film no or finish…" className="input-field pl-9" />
      </div>

      {/* Size group chips — each with its own running total, like Rolls */}
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={() => setActiveGroup('all')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', activeGroup === 'all' ? 'bg-primary text-white border-primary' : 'bg-white/5 text-muted border-white/10 hover:text-white')}>
          All ({available.length})
        </button>
        {groups.map(([k, g]) => (
          <button key={k} onClick={() => setActiveGroup(k)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', activeGroup === k ? 'bg-primary text-white border-primary' : 'bg-white/5 text-white/70 border-white/10 hover:text-white')}>
            {k} · {g.count} · {g.kg.toLocaleString('en-IN')}kg
          </button>
        ))}
      </div>
      {activeGroup !== 'all' && (
        <p className="text-muted text-xs">Size <span className="text-white/80 font-mono">{activeGroup}</span> — new films here get a per-group number.</p>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Film No', 'Size', 'Finish', 'G.WT', 'N.WT', 'Meter', 'Rate', 'Date', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={Layers} title="No BOPP film in stock" action={{ label: 'Add First Film', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className={cn('table-row', r.balanceUsed && 'bg-yellow-500/10')}>
                  <td className="table-cell font-mono text-accent whitespace-nowrap">{r.filmNo}{r.balanceUsed && <span className="ml-1.5 text-[10px] text-yellow-300">used</span>}</td>
                  <td className="table-cell text-white/70">{r.size || '—'}</td>
                  <td className="table-cell text-white/70">{r.finish ?? '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.gWt || '—'}</td>
                  <td className="table-cell font-mono text-white/80">{netWt(r) || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.meter || '—'}</td>
                  <td className="table-cell font-mono whitespace-nowrap">
                    {r.rate == null
                      ? <span className="badge bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-[10px]">rate not set</span>
                      : <span className="text-white/80">₹{r.rate.toLocaleString('en-IN')}</span>}
                  </td>
                  <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(r.dateAdded)}</td>
                  <td className="table-cell"><div className="flex gap-1.5">
                    <button onClick={() => setModal({ type: 'edit', film: r })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
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
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add BOPP Film' : 'Edit Film'} size="lg">
          <FilmForm initial={modal.film ?? {
            ...emptyFilm, dateAdded: today(),
            ...(activeGroup !== 'all' ? { size: activeGroup, filmNo: suggestFilmNo() } : {}),
          }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
