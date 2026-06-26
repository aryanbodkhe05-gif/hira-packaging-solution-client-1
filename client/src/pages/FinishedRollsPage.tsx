import { useState } from 'react';
import { Archive, Layers, Boxes } from 'lucide-react';
import { finishedRollsDb, finishedFilmsDb } from '../lib/db';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { formatDate, cn } from '../lib/utils';

// Archive of input rolls / BOPP films fully consumed in production (moved here
// from stock with full detail + which job/order used them).
export function FinishedRollsPage() {
  const [tab, setTab] = useState<'rolls' | 'films'>('rolls');
  const rolls = finishedRollsDb.getAll();
  const films = finishedFilmsDb.getAll();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Finished Rolls</h1>
        <p className="text-muted text-sm mt-1">Input rolls &amp; BOPP film fully consumed in production (archived with full detail)</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Finished Rolls" value={rolls.length} icon={Boxes} iconColor="text-accent" mono />
        <StatCard label="Finished BOPP Film" value={films.length} icon={Layers} iconColor="text-blue-400" mono />
        <StatCard label="Total Net Wt (kg)" value={rolls.reduce((s, r) => s + (r.nWt || 0), 0).toLocaleString('en-IN')} icon={Archive} iconColor="text-green-400" mono />
      </div>

      <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10 w-fit">
        {([{ k: 'rolls', label: 'Finished Rolls', icon: Boxes }, { k: 'films', label: 'Finished BOPP Film', icon: Layers }] as const).map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all', tab === k ? 'bg-primary text-white shadow' : 'text-muted hover:text-white')}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'rolls' ? (
            <table className="w-full">
              <thead><tr className="border-b border-white/5">
                {['Roll No', 'Type', 'Size', 'Quality', 'G.WT', 'N.WT', 'Meter', 'Added', 'Consumed', 'Used by'].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {rolls.length === 0 ? (
                  <tr><td colSpan={10}><EmptyState icon={Archive} title="No finished rolls yet" description='Mark a roll "Finished" in a job card to archive it here.' /></td></tr>
                ) : rolls.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell font-mono text-accent whitespace-nowrap">{r.rollNo}</td>
                    <td className="table-cell text-white/80">{r.type}</td>
                    <td className="table-cell text-white/70">{r.size || '—'}</td>
                    <td className="table-cell font-mono text-white/70">{r.quality || '—'}</td>
                    <td className="table-cell font-mono text-white/70">{r.gWt || '—'}</td>
                    <td className="table-cell font-mono text-white/80">{r.nWt || '—'}</td>
                    <td className="table-cell font-mono text-white/70">{r.meter || '—'}</td>
                    <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(r.dateAdded)}</td>
                    <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(r.consumedAt)}</td>
                    <td className="table-cell font-mono text-xs text-white/60 whitespace-nowrap">{r.jobNo || '—'}{r.orderNo ? ` · ${r.orderNo}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-white/5">
                {['Film No', 'Finish', 'KG', 'Meter', 'Micron', 'Added', 'Consumed', 'Used by'].map((h) => <th key={h} className="table-header whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {films.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon={Archive} title="No finished BOPP film yet" description='Mark a film "Finished" in a job card to archive it here.' /></td></tr>
                ) : films.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell font-mono text-accent whitespace-nowrap">{r.filmNo}</td>
                    <td className="table-cell text-white/70">{r.finish ?? '—'}</td>
                    <td className="table-cell font-mono text-white/80">{r.kg || '—'}</td>
                    <td className="table-cell font-mono text-white/70">{r.meter || '—'}</td>
                    <td className="table-cell font-mono text-white/70">{r.micron ?? '—'}</td>
                    <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(r.dateAdded)}</td>
                    <td className="table-cell text-muted text-xs whitespace-nowrap">{formatDate(r.consumedAt)}</td>
                    <td className="table-cell font-mono text-xs text-white/60 whitespace-nowrap">{r.jobNo || '—'}{r.orderNo ? ` · ${r.orderNo}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
