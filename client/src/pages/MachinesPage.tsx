import { useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Cog, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { factoryMachinesDb, getList } from '../lib/db';
import { DEFAULT_MACHINE_TYPES, MACHINE_TYPES_KEY } from '../config';
import type { FactoryMachine } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { ListSelect } from '../components/ui/ListSelect';
import { cn } from '../lib/utils';

const emptyMachine: Omit<FactoryMachine, 'id'> = { name: '', type: 'Cutting/BCS', active: true, createdAt: '' };

function MachineForm({ initial, onSave, onClose }: {
  initial: Omit<FactoryMachine, 'id'>; onSave: (d: Omit<FactoryMachine, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.name.trim()) { toast.error('Machine name / number is required'); return; }
    onSave({ ...f, name: f.name.trim() });
  }
  return (
    <div className="space-y-4">
      <div><label className="label">Name / Number *</label><input className="input-field" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Cutting-1 / Loom 3" autoFocus /></div>
      <div><label className="label">Type *</label>
        <ListSelect value={f.type} onChange={(v) => set('type', v)} listKey={MACHINE_TYPES_KEY} defaults={DEFAULT_MACHINE_TYPES} placeholder="Select type…" />
      </div>
      <label className="flex items-center gap-2 text-sm text-white/80">
        <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Active (available in selectors)
      </label>
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Machine</button>
      </div>
    </div>
  );
}

export function MachinesPage() {
  const [rows, setRows] = useState<FactoryMachine[]>(() => factoryMachinesDb.getAll());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; row?: FactoryMachine } | null>(null);
  const reload = useCallback(() => setRows(factoryMachinesDb.getAll()), []);
  const types = useMemo(() => getList(MACHINE_TYPES_KEY, DEFAULT_MACHINE_TYPES), []);

  function handleSave(data: Omit<FactoryMachine, 'id'>) {
    if (modal?.type === 'edit' && modal.row) { factoryMachinesDb.update(modal.row.id, data); toast.success('Machine updated'); }
    else { factoryMachinesDb.create({ ...data, createdAt: new Date().toISOString() }); toast.success('Machine added'); }
    setModal(null); reload();
  }
  function handleDelete(id: string) { factoryMachinesDb.delete(id); toast.success('Machine deleted'); reload(); }
  function toggleActive(m: FactoryMachine) { factoryMachinesDb.update(m.id, { active: !m.active }); reload(); }

  const filtered = useMemo(() => rows.filter((m) =>
    (!search || m.name.toLowerCase().includes(search.toLowerCase())) && (!typeFilter || m.type === typeFilter)
  ), [rows, search, typeFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="page-header">Machines</h1><p className="text-muted text-sm mt-1">Your factory machines — drive the Cutting/BCS and Loom selectors</p></div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"><Plus className="w-4 h-4" /> Add Machine</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Machines" value={rows.length} icon={Cog} iconColor="text-accent" mono />
        <StatCard label="Active" value={rows.filter((m) => m.active).length} icon={Cog} iconColor="text-green-400" mono />
        <StatCard label="Cutting/BCS" value={rows.filter((m) => m.type === 'Cutting/BCS').length} icon={Cog} iconColor="text-blue-400" mono />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search machine…" className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Types</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/5">
              {['Name / Number', 'Type', 'Status', ''].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4}><EmptyState icon={Cog} title="No machines yet" description="Add the machines your factory actually has." action={{ label: 'Add First Machine', onClick: () => setModal({ type: 'add' }) }} /></td></tr>
              ) : filtered.map((m) => (
                <tr key={m.id} className="table-row">
                  <td className="table-cell text-white/90 font-medium">{m.name}</td>
                  <td className="table-cell"><span className="badge bg-white/5 border border-white/10 text-xs">{m.type}</span></td>
                  <td className="table-cell">
                    <button onClick={() => toggleActive(m)} className={cn('text-xs flex items-center gap-1', m.active ? 'text-green-300' : 'text-muted')}>
                      {m.active ? <><Check className="w-3.5 h-3.5" /> Active</> : <><X className="w-3.5 h-3.5" /> Inactive</>}
                    </button>
                  </td>
                  <td className="table-cell"><div className="flex gap-1.5">
                    <button onClick={() => setModal({ type: 'edit', row: m })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Machine' : 'Edit Machine'} size="md">
          <MachineForm initial={modal.row ?? { ...emptyMachine }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
