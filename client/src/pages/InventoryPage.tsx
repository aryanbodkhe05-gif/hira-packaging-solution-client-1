import { useEffect, useState, useCallback } from 'react';
import {
  Package, Plus, ArrowDownToLine, ArrowUpFromLine,
  Search, TrendingDown, AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { StockStatusBadge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { cn, formatNumber, formatIST, timeAgo } from '../lib/utils';
import type { Material, StockLog, StockChartPoint } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockLogResponse {
  logs: StockLog[];
  total: number;
}
interface ChartResponse {
  material: Material;
  chartData: StockChartPoint[];
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card border border-accent/30 p-3 text-xs">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatNumber(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Stock log row ────────────────────────────────────────────────────────────
function StockLogRow({ log }: { log: StockLog }) {
  return (
    <tr className="table-row">
      <td className="table-cell">
        <span className={cn(
          'badge',
          log.type === 'IN'
            ? 'bg-success/20 text-success border border-success/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        )}>
          {log.type === 'IN' ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
          {log.type}
        </span>
      </td>
      <td className="table-cell font-mono font-medium">
        {log.type === 'OUT' ? '-' : '+'}{formatNumber(log.quantity)}
        {log.material && <span className="text-muted ml-1 text-xs">{log.material.unit}</span>}
      </td>
      <td className="table-cell">{log.staffName}</td>
      <td className="table-cell text-muted">{log.notes || '—'}</td>
      <td className="table-cell text-muted font-mono text-xs">{formatIST(log.createdAt)}</td>
    </tr>
  );
}

// ─── Material row ─────────────────────────────────────────────────────────────
function MaterialRow({
  material,
  onStockIn,
  onStockOut,
  onViewChart,
  expanded,
  onToggle,
}: {
  material: Material;
  onStockIn: (m: Material) => void;
  onStockOut: (m: Material) => void;
  onViewChart: (m: Material) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pct = Math.min((material.currentStock / Math.max(material.reorderThreshold, 1)) * 100, 200);
  const barColor = material.currentStock <= material.reorderThreshold * 0.5
    ? '#ef4444'
    : material.currentStock <= material.reorderThreshold
    ? '#f97316'
    : '#12B76A';

  return (
    <>
      <tr
        className={cn('table-row cursor-pointer', expanded && 'bg-white/5')}
        onClick={onToggle}
      >
        <td className="table-cell">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">{material.name}</p>
              <p className="text-muted text-xs">{material.unit}</p>
            </div>
          </div>
        </td>
        <td className="table-cell">
          <div>
            <p className="font-mono font-semibold text-white">
              {formatNumber(material.currentStock)}
              <span className="text-muted text-xs ml-1">{material.unit}</span>
            </p>
            {/* Progress bar */}
            <div className="mt-1.5 h-1.5 w-32 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        </td>
        <td className="table-cell font-mono text-muted">
          {formatNumber(material.reorderThreshold)} {material.unit}
        </td>
        <td className="table-cell">
          <StockStatusBadge current={material.currentStock} threshold={material.reorderThreshold} />
        </td>
        <td className="table-cell">
          <span className="text-white/70 text-sm">{material.supplier?.name ?? '—'}</span>
        </td>
        <td className="table-cell">
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onStockIn(material)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-success/10 hover:bg-success/20 text-success text-xs font-medium transition-colors"
              title="Stock In"
            >
              <ArrowDownToLine className="w-3 h-3" />
              In
            </button>
            <button
              onClick={() => onStockOut(material)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
              title="Stock Out"
            >
              <ArrowUpFromLine className="w-3 h-3" />
              Out
            </button>
            <button
              onClick={() => onViewChart(material)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/10 hover:bg-accent/20 text-accent text-xs font-medium transition-colors"
              title="View History"
            >
              <TrendingDown className="w-3 h-3" />
              Chart
            </button>
            <button className="text-muted hover:text-white transition-colors ml-1">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </td>
      </tr>
      {/* Vendor pricing row */}
      {expanded && material.vendorMaterials && material.vendorMaterials.length > 0 && (
        <tr>
          <td colSpan={6} className="bg-navy/40 px-8 py-3">
            <p className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">Supplier Pricing</p>
            <div className="flex gap-4 flex-wrap">
              {material.vendorMaterials.map((vm) => (
                <div key={vm.id} className="flex items-center gap-2 text-xs">
                  <span className="text-white/70 font-medium">{vm.vendor.name}</span>
                  <span className="text-muted">·</span>
                  <span className="font-mono text-accent">₹{vm.pricePerUnit}/{material.unit}</span>
                  <span className="text-muted">·</span>
                  <span className="text-white/50">{vm.leadTimeDays}d lead</span>
                  {vm.isDefault && (
                    <span className="badge bg-success/20 text-success border border-success/30 text-[10px]">Default</span>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Stock form ───────────────────────────────────────────────────────────────
function StockForm({
  material,
  type,
  onClose,
  onSuccess,
}: {
  material: Material;
  type: 'IN' | 'OUT';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [staffName, setStaffName] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!qty || !staffName) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/inventory/stock/${type.toLowerCase()}`, {
        materialId: material.id,
        quantity: parseFloat(qty),
        notes: notes || undefined,
        staffName,
      });
      toast.success(`Stock ${type === 'IN' ? 'added' : 'deducted'} for ${material.name}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-white/5 flex items-center gap-3">
        <Package className="w-5 h-5 text-accent" />
        <div>
          <p className="text-white font-medium text-sm">{material.name}</p>
          <p className="text-muted text-xs">
            Current: <span className="font-mono text-white">{formatNumber(material.currentStock)} {material.unit}</span>
          </p>
        </div>
      </div>

      <div>
        <label className="label">Quantity ({material.unit}) *</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={`Enter quantity in ${material.unit}`}
          className="input-field font-mono"
          autoFocus
        />
        {type === 'OUT' && parseFloat(qty) > material.currentStock && (
          <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Exceeds current stock ({formatNumber(material.currentStock)} {material.unit})
          </p>
        )}
      </div>

      <div>
        <label className="label">Staff Name *</label>
        <input
          type="text"
          value={staffName}
          onChange={(e) => setStaffName(e.target.value)}
          placeholder="Who is making this entry?"
          className="input-field"
        />
      </div>

      <div>
        <label className="label">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional reason or reference"
          className="input-field"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={loading || (type === 'OUT' && parseFloat(qty) > material.currentStock)}
          className={cn(
            'flex-1 justify-center font-medium px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors',
            type === 'IN'
              ? 'bg-success hover:bg-success/90 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white',
            (loading || (type === 'OUT' && parseFloat(qty) > material.currentStock)) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : type === 'IN' ? (
            <><ArrowDownToLine className="w-4 h-4" /> Add Stock</>
          ) : (
            <><ArrowUpFromLine className="w-4 h-4" /> Deduct Stock</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Chart modal ──────────────────────────────────────────────────────────────
function ChartModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const [data, setData] = useState<StockChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ChartResponse>(`/inventory/chart/${material.id}`)
      .then((res) => setData(res.data.chartData))
      .catch(() => toast.error('Failed to load chart'))
      .finally(() => setLoading(false));
  }, [material.id]);

  // Format x-axis labels
  const chartData = data.map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  return (
    <Modal open onClose={onClose} title={`${material.name} — 30-Day Stock History`} size="lg">
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#12B76A]" />
              <span className="text-muted">Stock In</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500" />
              <span className="text-muted">Stock Out</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-accent" />
              <span className="text-muted">Balance</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#8888AA', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fill: '#8888AA', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="in" name="Stock In" fill="#12B76A" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="out" name="Stock Out" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="balance" name="Balance" fill="#5E5EE8" radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 p-3 bg-white/5 rounded-lg flex gap-6 text-sm">
            <div>
              <p className="text-muted text-xs">Current Stock</p>
              <p className="font-mono font-bold text-white">{formatNumber(material.currentStock)} {material.unit}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Reorder Threshold</p>
              <p className="font-mono font-bold text-orange-400">{formatNumber(material.reorderThreshold)} {material.unit}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Default Supplier</p>
              <p className="font-medium text-white">{material.supplier?.name ?? '—'}</p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Log table ────────────────────────────────────────────────────────────────
function LogTable() {
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30', days: '30' });
      if (typeFilter) params.set('type', typeFilter);
      const { data } = await api.get<StockLogResponse>(`/inventory/logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filtered = logs.filter((l) =>
    !search ||
    l.staffName.toLowerCase().includes(search.toLowerCase()) ||
    l.notes?.toLowerCase().includes(search.toLowerCase()) ||
    l.material?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-accent/10">
        <h3 className="section-title">Stock Transactions (Last 30 Days)</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="input-field pl-8 w-44 text-xs py-1.5"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-field text-xs py-1.5 w-28"
          >
            <option value="">All Types</option>
            <option value="IN">Stock In</option>
            <option value="OUT">Stock Out</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">Type</th>
                <th className="table-header">Quantity</th>
                <th className="table-header">Staff</th>
                <th className="table-header">Notes</th>
                <th className="table-header">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted text-sm py-10">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filtered.map((log) => <StockLogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 py-3 border-t border-accent/10 text-muted text-xs">
        Showing {filtered.length} of {total} transactions
      </div>
    </div>
  );
}

// ─── Add Material modal ───────────────────────────────────────────────────────
function AddMaterialForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', unit: 'kg', currentStock: '', reorderThreshold: '' });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.name || !form.unit) { toast.error('Name and unit required'); return; }
    setLoading(true);
    try {
      await api.post('/inventory/materials', {
        name: form.name,
        unit: form.unit,
        currentStock: parseFloat(form.currentStock) || 0,
        reorderThreshold: parseFloat(form.reorderThreshold) || 100,
      });
      toast.success('Material added!');
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to add material');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Material Name *</label>
        <input
          className="input-field"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g., Paper Roll, Adhesive"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Unit *</label>
          <select
            className="input-field"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          >
            {['kg', 'litre', 'roll', 'sheet', 'unit', 'ton', 'metre'].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Initial Stock</label>
          <input
            className="input-field font-mono"
            type="number"
            min="0"
            value={form.currentStock}
            onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
            placeholder="0"
          />
        </div>
      </div>
      <div>
        <label className="label">Reorder Threshold</label>
        <input
          className="input-field font-mono"
          type="number"
          min="0"
          value={form.reorderThreshold}
          onChange={(e) => setForm({ ...form, reorderThreshold: e.target.value })}
          placeholder="100"
        />
        <p className="text-muted text-xs mt-1">Alert fires when stock drops below this value</p>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving...' : 'Add Material'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function InventoryPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'critical'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals
  const [stockModal, setStockModal] = useState<{ material: Material; type: 'IN' | 'OUT' } | null>(null);
  const [chartMaterial, setChartMaterial] = useState<Material | null>(null);
  const [addModal, setAddModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Material[]>('/inventory/materials');
      setMaterials(data);
    } catch {
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = materials.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ? true :
      filterStatus === 'critical' ? m.currentStock <= m.reorderThreshold * 0.5 :
      filterStatus === 'low' ? m.currentStock <= m.reorderThreshold : true;
    return matchSearch && matchStatus;
  });

  const lowCount = materials.filter((m) => m.currentStock <= m.reorderThreshold).length;
  const criticalCount = materials.filter((m) => m.currentStock <= m.reorderThreshold * 0.5).length;
  const totalStock = materials.reduce((acc, m) => acc + m.currentStock, 0);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-header">Inventory Tracker</h1>
          <p className="text-muted text-sm mt-1">Monitor raw material stock levels and transactions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={() => setAddModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Materials" value={materials.length} icon={Package} iconColor="text-accent" mono />
        <StatCard label="Low Stock Items" value={lowCount} icon={AlertTriangle} iconColor="text-orange-400" mono />
        <StatCard label="Critical Items" value={criticalCount} icon={AlertTriangle} iconColor="text-red-400" mono />
        <StatCard label="Total Stock Units" value={formatNumber(totalStock)} icon={TrendingDown} iconColor="text-success" />
      </div>

      {/* Low stock banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 alert-pulse">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-red-400 font-semibold text-sm">
              🚨 {criticalCount} material{criticalCount > 1 ? 's' : ''} critically low — immediate reorder required!
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">
              WhatsApp alerts have been sent to the configured group.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials..."
            className="input-field pl-9 w-56"
          />
        </div>
        {(['all', 'low', 'critical'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
              filterStatus === f
                ? 'bg-primary text-white'
                : 'text-muted hover:text-white hover:bg-white/10'
            )}
          >
            {f === 'all' ? 'All' : f === 'low' ? `Low Stock (${lowCount})` : `Critical (${criticalCount})`}
          </button>
        ))}
      </div>

      {/* Materials table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">Material</th>
                <th className="table-header">Current Stock</th>
                <th className="table-header">Reorder Level</th>
                <th className="table-header">Status</th>
                <th className="table-header">Default Supplier</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Package}
                      title="No materials found"
                      description="Add your first raw material to start tracking inventory"
                      action={{ label: 'Add Material', onClick: () => setAddModal(true) }}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((material) => (
                  <MaterialRow
                    key={material.id}
                    material={material}
                    onStockIn={(m) => setStockModal({ material: m, type: 'IN' })}
                    onStockOut={(m) => setStockModal({ material: m, type: 'OUT' })}
                    onViewChart={setChartMaterial}
                    expanded={expandedId === material.id}
                    onToggle={() => setExpandedId((id) => id === material.id ? null : material.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock log table */}
      <LogTable />

      {/* Modals */}
      {stockModal && (
        <Modal
          open
          onClose={() => setStockModal(null)}
          title={stockModal.type === 'IN' ? 'Record Stock In' : 'Record Stock Out'}
          size="sm"
        >
          <StockForm
            material={stockModal.material}
            type={stockModal.type}
            onClose={() => setStockModal(null)}
            onSuccess={load}
          />
        </Modal>
      )}

      {chartMaterial && (
        <ChartModal material={chartMaterial} onClose={() => setChartMaterial(null)} />
      )}

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add New Material" size="sm">
        <AddMaterialForm onClose={() => setAddModal(false)} onSuccess={load} />
      </Modal>
    </div>
  );
}
