import { useState, useCallback, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Factory, Cpu, ListChecks, AlertTriangle,
  Activity, Wrench, CircleSlash, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { machinesDb, productionJobsDb, downtimeDb, rollsDb, syncRollsFromProduction } from '../lib/db';
import {
  MACHINE_TYPES, MACHINE_STATUSES, JOB_STATUSES, DOWNTIME_REASONS,
} from '../config';
import type {
  MachineType, MachineStatus, JobStatus, DowntimeReason,
} from '../config';
import type { Machine, ProductionJob, DowntimeLog, Roll } from '../types/models';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { cn } from '../lib/utils';

// ── Badge colour maps ──────────────────────────────────────────────────────────
const MACHINE_STATUS_COLORS: Record<MachineStatus, string> = {
  Running:     'bg-green-500/20 text-green-300 border-green-500/30',
  Idle:        'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Down:        'bg-red-500/20 text-red-300 border-red-500/30',
  Maintenance: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};
const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  Queued:    'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Running:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'On Hold': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Completed: 'bg-green-500/20 text-green-300 border-green-500/30',
};
const REASON_COLORS: Record<DowntimeReason, string> = {
  Breakdown:          'bg-red-500/20 text-red-300 border-red-500/30',
  Maintenance:        'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Material Shortage':'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Power Cut':        'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Changeover:         'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Other:              'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function durationLabel(start: string, end?: string) {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ═════════════════════════════════════════════════════════════════════════════
// MACHINES
// ═════════════════════════════════════════════════════════════════════════════
const emptyMachine: Omit<Machine, 'id'> = {
  name: '', code: '', type: 'Bag Making', status: 'Idle', location: '', notes: '',
  createdAt: new Date().toISOString(),
};

function MachineForm({ initial, onSave, onClose }: {
  initial: Omit<Machine, 'id'>;
  onSave: (d: Omit<Machine, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.name.trim()) { toast.error('Machine name is required'); return; }
    onSave(f);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Name *</label>
          <input className="input-field" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Bag Making Line 1" autoFocus />
        </div>
        <div>
          <label className="label">Code</label>
          <input className="input-field font-mono" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="NF-M-001" />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input-field" value={f.type} onChange={(e) => set('type', e.target.value as MachineType)}>
            {MACHINE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input-field" value={f.status} onChange={(e) => set('status', e.target.value as MachineStatus)}>
            {MACHINE_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input-field" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Bay A" />
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input-field" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Machine</button>
      </div>
    </div>
  );
}

function MachinesSection({ onChanged }: { onChanged: () => void }) {
  const [machines, setMachines] = useState<Machine[]>(() => machinesDb.getAll());
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; machine?: Machine } | null>(null);
  const reload = useCallback(() => { setMachines(machinesDb.getAll()); onChanged(); }, [onChanged]);

  function handleSave(data: Omit<Machine, 'id'>) {
    if (modal?.type === 'edit' && modal.machine) {
      machinesDb.update(modal.machine.id, data);
      toast.success('Machine updated');
    } else {
      machinesDb.create(data);
      toast.success('Machine added');
    }
    reload();
    setModal(null);
  }
  function handleDelete(id: string) {
    machinesDb.delete(id);
    toast.success('Machine deleted');
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Machine
        </button>
      </div>

      {machines.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={Cpu} title="No machines registered"
            action={{ label: 'Register First Machine', onClick: () => setModal({ type: 'add' }) }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((m) => (
            <div key={m.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{m.name}</p>
                  <p className="text-muted text-xs font-mono mt-0.5">{m.code || '—'}</p>
                </div>
                <span className={cn('badge border text-xs', MACHINE_STATUS_COLORS[m.status])}>{m.status}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="px-2 py-0.5 rounded bg-white/5 text-white/70">{m.type}</span>
                {m.location && <span>📍 {m.location}</span>}
              </div>
              {m.notes && <p className="text-muted text-xs">{m.notes}</p>}
              <div className="flex gap-1.5 pt-1 border-t border-white/5">
                <button onClick={() => setModal({ type: 'edit', machine: m })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Add Machine' : 'Edit Machine'} size="md">
          <MachineForm initial={modal.machine ?? { ...emptyMachine, createdAt: new Date().toISOString() }} onSave={handleSave} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB QUEUE  (consumes rolls → updates Materials → Rolls automatically)
// ═════════════════════════════════════════════════════════════════════════════
function genJobNo() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `JOB-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}
const emptyJob: Omit<ProductionJob, 'id'> = {
  jobNo: '', machineId: '', machineName: '', rollId: '', rollNo: '',
  bagSize: '', bagsTarget: 0, bagsProduced: 0, rollFullyUsed: false,
  status: 'Queued', orderRef: '', notes: '', createdAt: new Date().toISOString(),
};

function JobForm({ initial, machines, rolls, onSave, onClose }: {
  initial: Omit<ProductionJob, 'id'>;
  machines: Machine[];
  rolls: Roll[];
  onSave: (d: Omit<ProductionJob, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    if (!f.machineId) { toast.error('Select a machine'); return; }
    if (!f.rollId) { toast.error('Select a roll to consume'); return; }
    const machine = machines.find((m) => m.id === f.machineId);
    const roll = rolls.find((r) => r.id === f.rollId);
    onSave({
      ...f,
      jobNo: f.jobNo || genJobNo(),
      machineName: machine?.name ?? '',
      rollNo: roll?.rollNo ?? '',
      bagSize: f.bagSize || roll?.size || '',
      completedAt: f.status === 'Completed' ? (f.completedAt || new Date().toISOString()) : undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Machine *</label>
          <select className="input-field" value={f.machineId} onChange={(e) => set('machineId', e.target.value)}>
            <option value="">Select machine…</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Roll consumed *</label>
          <select className="input-field font-mono" value={f.rollId} onChange={(e) => {
            const roll = rolls.find((r) => r.id === e.target.value);
            setF((p) => ({ ...p, rollId: e.target.value, bagSize: p.bagSize || roll?.size?.split('×')[0]?.trim() || '' }));
          }}>
            <option value="">Select roll…</option>
            {rolls.map((r) => (
              <option key={r.id} value={r.id}>
                {r.rollNo} · {r.type}{r.status === 'Fully Used' ? ' (used up)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Bag Size</label>
          <input className="input-field" value={f.bagSize} onChange={(e) => set('bagSize', e.target.value)} placeholder="25 × 30" />
        </div>
        <div>
          <label className="label">Order Ref</label>
          <input className="input-field font-mono" value={f.orderRef} onChange={(e) => set('orderRef', e.target.value)} placeholder="NF-…" />
        </div>
        <div>
          <label className="label">Bags Target</label>
          <input className="input-field font-mono" type="number" min="0" value={f.bagsTarget || ''} onChange={(e) => set('bagsTarget', parseInt(e.target.value) || 0)} placeholder="12000" />
        </div>
        <div>
          <label className="label">Bags Produced</label>
          <input className="input-field font-mono" type="number" min="0" value={f.bagsProduced || ''} onChange={(e) => set('bagsProduced', parseInt(e.target.value) || 0)} placeholder="0" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input-field" value={f.status} onChange={(e) => set('status', e.target.value as JobStatus)}>
            {JOB_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-primary" checked={f.rollFullyUsed} onChange={(e) => set('rollFullyUsed', e.target.checked)} />
            <span className="text-sm text-white/80">Roll fully used up</span>
          </label>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input-field" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
      </div>
      <p className="text-muted text-xs">
        Saving updates the selected roll in <span className="text-accent">Materials → Rolls</span>: bags made are added up,
        and the roll is marked <span className="text-yellow-300">In Use</span> — or <span className="text-red-300">Fully Used</span> if checked.
      </p>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Job</button>
      </div>
    </div>
  );
}

function JobQueueSection({ onChanged }: { onChanged: () => void }) {
  const [jobs, setJobs] = useState<ProductionJob[]>(() => productionJobsDb.getAll());
  const [machines] = useState<Machine[]>(() => machinesDb.getAll());
  const [rolls, setRolls] = useState<Roll[]>(() => rollsDb.getAll());
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; job?: ProductionJob } | null>(null);

  const reload = useCallback(() => {
    syncRollsFromProduction();           // keep Materials → Rolls in sync
    setJobs(productionJobsDb.getAll());
    setRolls(rollsDb.getAll());
    onChanged();
  }, [onChanged]);

  function handleSave(data: Omit<ProductionJob, 'id'>) {
    if (modal?.type === 'edit' && modal.job) {
      productionJobsDb.update(modal.job.id, data);
      toast.success('Job updated');
    } else {
      productionJobsDb.create(data);
      toast.success('Job queued');
    }
    reload();
    setModal(null);
  }
  function handleDelete(id: string) {
    productionJobsDb.delete(id);
    toast.success('Job removed');
    reload();
  }

  const filtered = jobs.filter((j) => !statusFilter || j.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap justify-end">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-40">
          <option value="">All Statuses</option>
          {JOB_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary"
          disabled={machines.length === 0 || rolls.length === 0}
          title={machines.length === 0 ? 'Add a machine first' : rolls.length === 0 ? 'Add a roll first' : undefined}>
          <Plus className="w-4 h-4" /> New Job
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Job No.', 'Machine', 'Roll', 'Bag Size', 'Produced / Target', 'Status', ''].map((h) => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}>
                  <EmptyState icon={ListChecks} title="No jobs in the queue"
                    action={machines.length && rolls.length ? { label: 'Create First Job', onClick: () => setModal({ type: 'add' }) } : undefined} />
                </td></tr>
              ) : filtered.map((j) => {
                const pct = j.bagsTarget > 0 ? Math.min(100, Math.round((j.bagsProduced / j.bagsTarget) * 100)) : 0;
                return (
                  <tr key={j.id} className="table-row">
                    <td className="table-cell font-mono text-accent font-medium">{j.jobNo}</td>
                    <td className="table-cell text-white/80">{j.machineName}</td>
                    <td className="table-cell font-mono text-white/70">
                      {j.rollNo || '—'}
                      {j.rollFullyUsed && <span className="ml-1.5 text-[10px] text-red-300">used up</span>}
                    </td>
                    <td className="table-cell text-white/70">{j.bagSize || '—'}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-xs text-white/80 whitespace-nowrap">
                          {j.bagsProduced.toLocaleString('en-IN')} / {j.bagsTarget.toLocaleString('en-IN')}
                        </div>
                        <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={cn('badge border text-xs', JOB_STATUS_COLORS[j.status])}>{j.status}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal({ type: 'edit', job: j })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(j.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-accent/10 text-muted text-xs">{filtered.length} jobs</div>
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'New Production Job' : 'Edit Job'} size="lg">
          <JobForm
            initial={modal.job ?? { ...emptyJob, createdAt: new Date().toISOString() }}
            machines={machines}
            rolls={rolls}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DOWNTIME LOG
// ═════════════════════════════════════════════════════════════════════════════
const emptyDowntime: Omit<DowntimeLog, 'id'> = {
  machineId: '', machineName: '', reason: 'Breakdown',
  startedAt: new Date().toISOString().slice(0, 16), endedAt: '', notes: '',
  createdAt: new Date().toISOString(),
};

function DowntimeForm({ initial, machines, onSave, onClose }: {
  initial: Omit<DowntimeLog, 'id'>;
  machines: Machine[];
  onSave: (d: Omit<DowntimeLog, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (!f.machineId) { toast.error('Select a machine'); return; }
    if (!f.startedAt) { toast.error('Start time is required'); return; }
    const machine = machines.find((m) => m.id === f.machineId);
    onSave({
      ...f,
      machineName: machine?.name ?? '',
      startedAt: new Date(f.startedAt).toISOString(),
      endedAt: f.endedAt ? new Date(f.endedAt).toISOString() : undefined,
    });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Machine *</label>
          <select className="input-field" value={f.machineId} onChange={(e) => set('machineId', e.target.value)}>
            <option value="">Select machine…</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Reason</label>
          <select className="input-field" value={f.reason} onChange={(e) => set('reason', e.target.value as DowntimeReason)}>
            {DOWNTIME_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Started At *</label>
          <input className="input-field" type="datetime-local" value={f.startedAt} onChange={(e) => set('startedAt', e.target.value)} />
        </div>
        <div>
          <label className="label">Ended At</label>
          <input className="input-field" type="datetime-local" value={f.endedAt} onChange={(e) => set('endedAt', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input-field" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="What happened / action taken" />
      </div>
      <p className="text-muted text-xs">Leave “Ended At” blank while the machine is still down.</p>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Log</button>
      </div>
    </div>
  );
}

// datetime-local needs "YYYY-MM-DDTHH:mm" — convert stored ISO for editing
function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function DowntimeSection({ onChanged }: { onChanged: () => void }) {
  const [logs, setLogs] = useState<DowntimeLog[]>(() => downtimeDb.getAll());
  const [machines] = useState<Machine[]>(() => machinesDb.getAll());
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; log?: DowntimeLog } | null>(null);
  const reload = useCallback(() => { setLogs(downtimeDb.getAll()); onChanged(); }, [onChanged]);

  function handleSave(data: Omit<DowntimeLog, 'id'>) {
    if (modal?.type === 'edit' && modal.log) {
      downtimeDb.update(modal.log.id, data);
      toast.success('Downtime updated');
    } else {
      downtimeDb.create(data);
      toast.success('Downtime logged');
    }
    reload();
    setModal(null);
  }
  function handleDelete(id: string) {
    downtimeDb.delete(id);
    toast.success('Log deleted');
    reload();
  }

  const filtered = logs.filter((l) =>
    !search || l.machineName.toLowerCase().includes(search.toLowerCase()) || l.reason.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search machine or reason…" className="input-field pl-9" />
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary" disabled={machines.length === 0}
          title={machines.length === 0 ? 'Add a machine first' : undefined}>
          <Plus className="w-4 h-4" /> Log Downtime
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Machine', 'Reason', 'Started', 'Ended', 'Duration', 'Notes', ''].map((h) => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}>
                  <EmptyState icon={AlertTriangle} title="No downtime logged"
                    action={machines.length ? { label: 'Log First Downtime', onClick: () => setModal({ type: 'add' }) } : undefined} />
                </td></tr>
              ) : filtered.map((l) => {
                const ongoing = !l.endedAt;
                return (
                  <tr key={l.id} className="table-row">
                    <td className="table-cell text-white/80">{l.machineName}</td>
                    <td className="table-cell">
                      <span className={cn('badge border text-xs', REASON_COLORS[l.reason])}>{l.reason}</span>
                    </td>
                    <td className="table-cell text-white/70 text-xs">{fmtDateTime(l.startedAt)}</td>
                    <td className="table-cell text-white/70 text-xs">
                      {ongoing ? <span className="text-red-300">Ongoing</span> : fmtDateTime(l.endedAt)}
                    </td>
                    <td className={cn('table-cell font-mono text-xs', ongoing ? 'text-red-300' : 'text-white/80')}>{durationLabel(l.startedAt, l.endedAt)}</td>
                    <td className="table-cell text-muted text-xs max-w-[16rem] truncate">{l.notes || '—'}</td>
                    <td className="table-cell">
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal({ type: 'edit', log: l })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(l.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-accent/10 text-muted text-xs">{filtered.length} entries</div>
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'add' ? 'Log Downtime' : 'Edit Downtime'} size="md">
          <DowntimeForm
            initial={modal.log
              ? { ...modal.log, startedAt: toLocalInput(modal.log.startedAt), endedAt: toLocalInput(modal.log.endedAt) }
              : { ...emptyDowntime, startedAt: toLocalInput(new Date().toISOString()), createdAt: new Date().toISOString() }}
            machines={machines}
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
export function ProductionPage() {
  const [tab, setTab] = useState<'machines' | 'jobs' | 'downtime'>('jobs');
  const [tick, setTick] = useState(0);          // bump to recompute the stat cards
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const stats = useMemo(() => {
    void tick;
    const machines = machinesDb.getAll();
    const jobs = productionJobsDb.getAll();
    const downtime = downtimeDb.getAll();
    return {
      running: machines.filter((m) => m.status === 'Running').length,
      machines: machines.length,
      activeJobs: jobs.filter((j) => j.status === 'Running' || j.status === 'Queued').length,
      bagsToday: jobs.reduce((s, j) => s + (j.bagsProduced || 0), 0),
      openDowntime: downtime.filter((d) => !d.endedAt).length,
    };
  }, [tick]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Production</h1>
        <p className="text-muted text-sm mt-1">Monitor machines, the job queue, downtime, and roll consumption</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Machines Running" value={`${stats.running} / ${stats.machines}`} icon={Activity} iconColor="text-green-400" />
        <StatCard label="Active Jobs" value={stats.activeJobs} icon={ListChecks} iconColor="text-blue-400" />
        <StatCard label="Bags Produced" value={stats.bagsToday.toLocaleString('en-IN')} icon={Factory} iconColor="text-accent" mono />
        <StatCard label="Open Downtime" value={stats.openDowntime} icon={CircleSlash} iconColor="text-red-400" />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10 w-fit">
        {([
          { k: 'jobs', label: 'Job Queue', icon: ListChecks },
          { k: 'machines', label: 'Machines', icon: Cpu },
          { k: 'downtime', label: 'Downtime', icon: Wrench },
        ] as const).map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn(
              'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all',
              tab === k ? 'bg-primary text-white shadow' : 'text-muted hover:text-white'
            )}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'jobs' && <JobQueueSection onChanged={bump} />}
      {tab === 'machines' && <MachinesSection onChanged={bump} />}
      {tab === 'downtime' && <DowntimeSection onChanged={bump} />}
    </div>
  );
}
