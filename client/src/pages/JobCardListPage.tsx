import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, ClipboardList, FileText, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { jobCardsDb } from '../lib/db';
import { JOB_STAGES, JOBCARD_STATUSES } from '../config';
import type { CardType } from '../config';
import type { JobCard } from '../types/models';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { RoleSwitcher } from '../components/ui/RoleSwitcher';
import { computeCosting, formatINR, normalizeJobCard } from '../lib/jobcard';
import { canViewCosts } from '../lib/roles';
import { formatDate, cn } from '../lib/utils';

const PAGE_SIZE = 20;

const STAGE_BADGE: Record<string, string> = {
  Printing:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Metalize:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Slitting:   'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Lamination: 'bg-green-500/20 text-green-300 border-green-500/30',
  Cutting:    'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Dispatch:   'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

export function JobCardListPage({ cardType }: { cardType?: CardType }) {
  const nav = useNavigate();
  const title = cardType === 'Normal' ? 'Normal Bag' : cardType === 'BOPP' ? 'BOPP Job Card' : 'Job Card';
  const newPath = cardType === 'Normal' ? '/job-card/new?type=Normal' : '/job-card/new';
  const [cards, setCards] = useState<JobCard[]>(() => jobCardsDb.getAll().map(normalizeJobCard));
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [, force] = useState(0);
  const showCosts = canViewCosts();

  function reload() { setCards(jobCardsDb.getAll().map(normalizeJobCard)); }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Delete this job card?')) return;
    jobCardsDb.delete(id);
    toast.success('Job card deleted');
    reload();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) =>
      (!cardType || c.cardType === cardType) &&
      (!q || c.jobNo.toLowerCase().includes(q) || c.header.brand.toLowerCase().includes(q)) &&
      (!stageFilter || c.currentStage === stageFilter) &&
      (!statusFilter || c.status === statusFilter)
    );
  }, [cards, cardType, search, stageFilter, statusFilter]);

  useEffect(() => { setPage(1); }, [search, stageFilter, statusFilter]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inProgress = cards.filter((c) => c.status === 'In Progress').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-header">{title}</h1>
          <p className="text-muted text-sm mt-1">Digital order traveler — one live card per order, machine to machine</p>
        </div>
        <RoleSwitcher onChange={() => force((n) => n + 1)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Job Cards" value={cards.length} icon={ClipboardList} iconColor="text-accent" mono />
        <StatCard label="In Progress" value={inProgress} icon={FileText} iconColor="text-yellow-400" mono />
        <StatCard label="Dispatched" value={cards.length - inProgress} icon={FileText} iconColor="text-green-400" mono />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brand or job no…" className="input-field pl-9" />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Stages</option>
          {JOB_STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Statuses</option>
          {JOBCARD_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <Link to={newPath} className="btn-primary"><Plus className="w-4 h-4" /> New {cardType === 'Normal' ? 'Normal Bag' : 'Job Card'}</Link>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Job No', 'Brand', 'Size', 'Qty', 'Finish', 'Stage', 'Created', ...(showCosts ? ['Total Cost'] : []), 'Status', ''].map((h) => (
                  <th key={h} className="table-header whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={showCosts ? 10 : 9}>
                  <EmptyState icon={ClipboardList} title="No job cards yet"
                    description="Create a digital job card to track an order through the floor."
                    action={{ label: `New ${cardType === 'Normal' ? 'Normal Bag' : 'Job Card'}`, onClick: () => nav(newPath) }} />
                </td></tr>
              ) : pageRows.map((c) => {
                const cost = computeCosting(c);
                return (
                  <tr key={c.id} className="table-row cursor-pointer" onClick={() => nav(`/job-card/${c.id}`)}>
                    <td className="table-cell font-mono text-accent font-medium whitespace-nowrap">{c.jobNo}</td>
                    <td className="table-cell text-white/90 font-medium">{c.header.brand || '—'}</td>
                    <td className="table-cell text-white/70">{c.header.size || '—'}</td>
                    <td className="table-cell font-mono text-white/70">{c.header.qty?.toLocaleString('en-IN') || '—'}</td>
                    <td className="table-cell text-white/70">{c.header.finish}</td>
                    <td className="table-cell"><span className={cn('badge border text-xs', STAGE_BADGE[c.currentStage])}>{c.currentStage}</span></td>
                    <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(c.header.date)}</td>
                    {showCosts && <td className="table-cell font-mono text-white/90 whitespace-nowrap">{formatINR(cost.totalJobCost)}</td>}
                    <td className="table-cell">
                      <span className={cn('badge border text-xs', c.status === 'Dispatched' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30')}>{c.status}</span>
                    </td>
                    <td className="table-cell">
                      <button onClick={(e) => handleDelete(e, c.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>
    </div>
  );
}
