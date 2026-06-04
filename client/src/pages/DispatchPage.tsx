import { useState, useMemo } from 'react';
import { Truck, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ordersDb } from '../lib/db';
import { cn } from '../lib/utils';
import { EmptyState } from '../components/ui/EmptyState';

const TYPE_COLORS: Record<string, string> = {
  BOPP: '#3131B5', UL: '#5E5EE8', Natural: '#12B76A', Laminated: '#f59e0b',
};

export function DispatchPage() {
  const allOrders = ordersDb.getAll();
  const dispatched = allOrders.filter((o) => o.status === 'Dispatched');
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  const months = useMemo(() => {
    const set = new Set<string>();
    dispatched.forEach((o) => set.add(o.createdAt.slice(0, 7)));
    return [...set].sort().reverse();
  }, [dispatched]);

  const filtered = dispatched.filter((o) => {
    const ms = !search || o.clientName.toLowerCase().includes(search.toLowerCase()) ||
      o.orderId.toLowerCase().includes(search.toLowerCase()) ||
      (o.billNo ?? '').toLowerCase().includes(search.toLowerCase());
    const mm = !selectedMonth || o.createdAt.startsWith(selectedMonth);
    return ms && mm;
  });

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach((o) => {
      const m = o.createdAt.slice(0, 7);
      if (!map[m]) map[m] = [];
      map[m].push(o);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const totalKg  = filtered.reduce((s, o) => s + (o.quantityKg ?? 0), 0);
  const totalNos = filtered.reduce((s, o) => s + (o.quantityNos ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Dispatch Records</h1>
        <p className="text-muted text-sm mt-1">All dispatched orders with bill numbers</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Dispatched', value: dispatched.length, color: 'text-success' },
          { label: 'Total KG (filtered)', value: totalKg.toLocaleString('en-IN') + ' KG', color: 'text-accent' },
          { label: 'Total Nos (filtered)', value: totalNos.toLocaleString('en-IN'), color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card p-4">
            <p className="text-muted text-xs">{label}</p>
            <p className={cn('text-2xl font-bold font-mono mt-1', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, order, bill…" className="input-field pl-9 w-52" />
        </div>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="input-field w-36">
          <option value="">All Months</option>
          {months.map((m) => (
            <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMM yyyy')}</option>
          ))}
        </select>
      </div>

      {/* Month-grouped tables */}
      {grouped.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={Truck} title="No dispatched orders"
            description="Dispatch orders from the Orders page to see them here." />
        </div>
      ) : grouped.map(([month, monthOrders]) => (
        <div key={month} className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-semibold">{format(parseISO(month + '-01'), 'MMMM yyyy')}</h3>
              <span className="text-muted text-xs">{monthOrders.length} dispatches</span>
            </div>
            <div className="flex gap-4 text-xs font-mono text-muted">
              <span className="text-accent">{monthOrders.reduce((s, o) => s + (o.quantityKg ?? 0), 0).toLocaleString('en-IN')} KG</span>
              <span className="text-blue-400">{monthOrders.reduce((s, o) => s + (o.quantityNos ?? 0), 0).toLocaleString('en-IN')} Nos</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="table-header">Order ID</th>
                  <th className="table-header">Bill No.</th>
                  <th className="table-header">Client</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Size</th>
                  <th className="table-header">KG</th>
                  <th className="table-header">Nos</th>
                  <th className="table-header">Dispatch Date</th>
                </tr>
              </thead>
              <tbody>
                {monthOrders.map((o) => (
                  <tr key={o.id} className="table-row">
                    <td className="table-cell font-mono text-accent text-xs">{o.orderId}</td>
                    <td className="table-cell font-mono font-medium text-success">{o.billNo ?? '—'}</td>
                    <td className="table-cell font-medium">{o.clientName}</td>
                    <td className="table-cell">
                      <span className="badge text-xs" style={{ background: TYPE_COLORS[o.productType] + '22', color: TYPE_COLORS[o.productType], border: `1px solid ${TYPE_COLORS[o.productType]}44` }}>
                        {o.productType}
                      </span>
                    </td>
                    <td className="table-cell font-mono text-xs text-muted">{o.sizeDisplay}</td>
                    <td className="table-cell font-mono">{o.quantityKg?.toLocaleString('en-IN') ?? '—'}</td>
                    <td className="table-cell font-mono">{o.quantityNos?.toLocaleString('en-IN') ?? '—'}</td>
                    <td className="table-cell text-muted font-mono text-xs">
                      {o.dispatchDate ? format(parseISO(o.dispatchDate), 'dd MMM yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
