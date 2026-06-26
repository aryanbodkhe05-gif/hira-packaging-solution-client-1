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

const emptyFilm: Omit<BoppFilm, 'id'> = { filmNo: '', kg: 0, meter: 0, finish: undefined, micron: undefined, dateAdded: today() };

function FilmForm({ initial, onSave, onClose }: {
  initial: Omit<BoppFilm, 'id'>; onSave: (d: Omit<BoppFilm, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() { if (!f.filmNo.trim()) { toast.error('Film No. is required'); return; } onSave({ ...f, filmNo: f.filmNo.trim() }); }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Film No *</label><input className="input-field font-mono" value={f.filmNo} onChange={(e) => set('filmNo', e.target.value)} placeholder="F-001" autoFocus /></div>
        <div><label className="label">Finish</label>
          <select className="input-field" value={f.finish ?? ''} onChange={(e) => set('finish', (e.target.value || undefined) as Finish | undefined)}>
            <option value="">—</option>{FINISHES.map((x) => <option key={x}>{x}</option>)}<option>Pearl</option>
          </select>
        </div>
        <div><label className="label">KG (weight)</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.kg || ''} onChange={(e) => set('kg', num(e.target.value))} /></div>
        <div><label className="label">Meter</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.meter || ''} onChange={(e) => set('meter', num(e.target.value))} /></div>
        <div><label className="label">Micron</label><input className="input-field font-mono" type="number" min="0" step="any" value={f.micron ?? ''} onChange={(e) => set('micron', e.target.value === '' ? undefined : num(e.target.value))} placeholder="optional" /></div>
        <div><label className="label">Date</label><input className="input-field" type="date" value={f.dateAdded} onChange={(e) => set('dateAdded', e.target.value)} /></div>
      </div>
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
  const reload = useCallback(() => setFilms(boppFilmsDb.getAll()), []);

  function handleSave(data: Omit<BoppFilm, 'id'>) {
    if (modal?.type === 'edit' && modal.film) { boppFilmsDb.update(modal.film.id, data); toast.success('Film updated'); }
    else { boppFilmsDb.create(data); toast.success('Film added to stock'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { boppFilmsDb.delete(id); toast.success('Film deleted'); reload(); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return films.filter((r) => !q || r.filmNo.toLowerCase().includes(q) || (r.finish ?? '').toLowerCase().includes(q));
  }, [films, search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">BOPP Film</h1><p className="text-muted text-sm mt-1">Incoming BOPP film raw stock (before printing)</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Film</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Films in Stock" value={films.filter((r) => !r.balanceUsed).length} icon={Layers} iconColor="text-accent" mono />
        <StatCard label="Balance (used)" value={films.filter((r) => r.balanceUsed).length} icon={Layers} iconColor="text-yellow-400" mono />
        <StatCard label="Total KG" value={films.reduce((s, r) => s + (r.kg || 0), 0).toLocaleString('en-IN')} icon={Layers} iconColor="text-green-400" mono />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search film no or finish…" className="input-field pl-9" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Film No', 'Finish', 'KG', 'Meter', 'Micron', 'Date', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Layers} title="No BOPP film in stock" action={{ label: 'Add First Film', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className={cn('table-row', r.balanceUsed && 'bg-yellow-500/10')}>
                  <td className="table-cell font-mono text-accent whitespace-nowrap">{r.filmNo}{r.balanceUsed && <span className="ml-1.5 text-[10px] text-yellow-300">used</span>}</td>
                  <td className="table-cell text-white/70">{r.finish ?? '—'}</td>
                  <td className="table-cell font-mono text-white/80">{r.kg || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.meter || '—'}</td>
                  <td className="table-cell font-mono text-white/70">{r.micron ?? '—'}</td>
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
          <FilmForm initial={modal.film ?? { ...emptyFilm, dateAdded: today() }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
