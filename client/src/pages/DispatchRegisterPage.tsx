import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Search, Download, Trash2, ExternalLink, Check, X, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { dispatchesDb } from '../lib/db';
import type { DispatchRecord } from '../types/models';
import type { DispatchType } from '../config';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { formatDate, exportToCsv, cn } from '../lib/utils';

const PAGE_SIZE = 20;

// Consolidated dispatch register, fed by Job Card "Send to Dispatch".
// Reused for both Bags and Rolls via the `type` prop.
export function DispatchRegisterPage({ type }: { type: DispatchType }) {
  const nav = useNavigate();
  const [records, setRecords] = useState<DispatchRecord[]>(() => dispatchesDb.getAll());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);  // row being bill-edited
  const [billDraft, setBillDraft] = useState('');
  const reload = () => setRecords(dispatchesDb.getAll());

  const isRoll = type === 'Roll';

  function handleDelete(id: string) {
    if (!confirm('Delete this dispatch record?')) return;
    dispatchesDb.delete(id);
    toast.success('Dispatch record deleted');
    reload();
  }
  function startBillEdit(r: DispatchRecord) { setEditId(r.id); setBillDraft(r.billNo ?? ''); }
  function saveBill(id: string) {
    dispatchesDb.update(id, { billNo: billDraft.trim() || undefined });
    setEditId(null);
    toast.success('Bill No updated');
    reload();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter((r) => r.type === type)
      .filter((r) => !q || r.party.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q) ||
        r.jobNo.toLowerCase().includes(q) || (r.orderNo ?? '').toLowerCase().includes(q));
  }, [records, type, search]);

  useEffect(() => { setPage(1); }, [search]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalKg = filtered.reduce((s, r) => s + (r.qtyKg ?? 0), 0);
  const totalUnits = isRoll
    ? filtered.reduce((s, r) => s + (r.rolls ?? 0), 0)
    : filtered.reduce((s, r) => s + (r.qtyPieces ?? 0), 0);

  function handleExport() {
    if (!filtered.length) { toast.error('Nothing to export'); return; }
    const rows = filtered.map((r) => ({
      Date: r.date, 'Job No': r.jobNo, Order: r.orderNo ?? '', Party: r.party, Brand: r.brand,
      ...(isRoll ? { Rolls: r.rolls ?? 0, Meters: r.qtyMeters ?? 0 } : { Pieces: r.qtyPieces ?? 0 }),
      'Qty (kg)': r.qtyKg ?? 0, 'Bill No': r.billNo ?? '',
    }));
    exportToCsv(`dispatch-${type.toLowerCase()}s-${new Date().toLocaleDateString('en-CA')}.csv`, rows);
    toast.success(`Exported ${rows.length} rows`);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Dispatch – {type}s</h1>
        <p className="text-muted text-sm mt-1">Finished-{isRoll ? 'roll' : 'bag'} dispatches — posted from Job Card "Send to Dispatch"</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Dispatches" value={filtered.length} icon={Truck} iconColor="text-accent" mono />
        <StatCard label={isRoll ? 'Total Rolls' : 'Total Pieces'} value={totalUnits.toLocaleString('en-IN')} icon={Truck} iconColor="text-blue-400" mono />
        <StatCard label="Total Kg" value={totalKg.toLocaleString('en-IN')} icon={Truck} iconColor="text-green-400" mono />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search party, brand, job/order no…" className="input-field pl-9" />
        </div>
        <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Date', 'Job No', 'Order', 'Party', 'Brand', ...(isRoll ? ['Rolls', 'Meters'] : ['Pieces']), 'Kg', 'Bill No', ''].map((h) => (
                  <th key={h} className="table-header whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={isRoll ? 10 : 9}>
                  <EmptyState icon={Truck} title={`No ${type.toLowerCase()} dispatches yet`}
                    description={`Open a ${isRoll ? 'roll' : 'bag'} job card and click "Send to Dispatch".`} />
                </td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell text-white/70 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="table-cell font-mono text-accent whitespace-nowrap">{r.jobNo}</td>
                  <td className="table-cell font-mono text-white/60 text-xs whitespace-nowrap">{r.orderNo ?? '—'}</td>
                  <td className="table-cell text-white/90">{r.party}</td>
                  <td className="table-cell text-white/70">{r.brand || '—'}</td>
                  {isRoll && <td className="table-cell font-mono text-white/80">{(r.rolls ?? 0).toLocaleString('en-IN')}</td>}
                  {isRoll && <td className="table-cell font-mono text-white/80">{(r.qtyMeters ?? 0).toLocaleString('en-IN')}</td>}
                  {!isRoll && <td className="table-cell font-mono text-white/80">{(r.qtyPieces ?? 0).toLocaleString('en-IN')}</td>}
                  <td className="table-cell font-mono text-white/80">{(r.qtyKg ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell">
                    {editId === r.id ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={billDraft} onChange={(e) => setBillDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveBill(r.id); if (e.key === 'Escape') setEditId(null); }}
                          className="input-field font-mono py-1 text-xs w-28" placeholder="Bill No" />
                        <button onClick={() => saveBill(r.id)} className="p-1 rounded bg-primary text-white"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditId(null)} className="p-1 rounded bg-white/10 text-muted"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startBillEdit(r)} className="flex items-center gap-1 text-xs hover:text-accent transition-colors group">
                        {r.billNo
                          ? <span className="font-mono text-white/80">{r.billNo}</span>
                          : <span className="text-muted">+ Bill No</span>}
                        <Pencil className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100" />
                      </button>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1.5">
                      {r.jobCardId && (
                        <button onClick={() => nav(`/job-card/${r.jobCardId}`)} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors" title="Open job card"><ExternalLink className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>
    </div>
  );
}
