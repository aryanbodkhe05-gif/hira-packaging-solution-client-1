import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Link } from 'react-router-dom';
import { Package, ShoppingCart, Truck, Clock, TrendingUp, AlertTriangle, Layers, Gauge, Percent, Plus } from 'lucide-react';
import { rollsDb, consumablesDb, ordersDb, fabricBatchesDb, fabricWastageDb, loomEntriesDb } from '../lib/db';
import { PRODUCT_TYPES } from '../config';
import { useBranding } from '../lib/branding';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { format, parseISO } from 'date-fns';

const PRODUCT_COLORS: Record<string, string> = {
  BOPP: '#3131B5', UL: '#5E5EE8', Natural: '#12B76A', Laminated: '#f59e0b',
};

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy border border-accent/30 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-mono font-bold">{p.value}</span></p>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const branding    = useBranding();
  const { user }    = useAuth();
  const rolls       = rollsDb.getAll();
  const consumables = consumablesDb.getAll();
  const orders      = ordersDb.getAll();

  const stats = useMemo(() => {
    const total      = orders.length;
    const dispatched = orders.filter((o) => o.status === 'Dispatched').length;
    const pending    = orders.filter((o) => o.status === 'Pending').length;
    const inProd     = orders.filter((o) => o.status === 'In Production').length;
    const ready      = orders.filter((o) => o.status === 'Ready').length;
    const totalKg    = orders.reduce((s, o) => s + (o.quantityKg ?? 0), 0);
    return { total, dispatched, pending, inProd, ready, totalKg };
  }, [orders]);

  // Orders per month (last 6 months)
  const monthlyOrders = useMemo(() => {
    const map: Record<string, { month: string; orders: number; kg: number }> = {};
    orders.forEach((o) => {
      const m = format(parseISO(o.createdAt), 'MMM yy');
      if (!map[m]) map[m] = { month: m, orders: 0, kg: 0 };
      map[m].orders++;
      map[m].kg += (o.quantityKg ?? 0);
    });
    return Object.values(map).slice(-6);
  }, [orders]);

  // Product type breakdown
  const productBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => { map[o.productType] = (map[o.productType] ?? 0) + 1; });
    return PRODUCT_TYPES.map((t) => ({ name: t, value: map[t] ?? 0 })).filter((x) => x.value > 0);
  }, [orders]);

  // Dispatch trend (dispatched orders per month)
  const dispatchTrend = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter((o) => o.status === 'Dispatched').forEach((o) => {
      const m = format(parseISO(o.createdAt), 'MMM yy');
      map[m] = (map[m] ?? 0) + 1;
    });
    return Object.entries(map).map(([month, dispatched]) => ({ month, dispatched })).slice(-6);
  }, [orders]);

  // KG output over time
  const kgTrend = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter((o) => o.status === 'Dispatched').forEach((o) => {
      const m = format(parseISO(o.createdAt), 'MMM yy');
      map[m] = (map[m] ?? 0) + (o.quantityKg ?? 0);
    });
    return Object.entries(map).map(([month, kg]) => ({ month, kg })).slice(-6);
  }, [orders]);

  const lowConsumables = consumables.filter((c) => c.quantity < 20);

  // ── PP Fabric + Loom today's figures ──
  const todayStr = new Date().toLocaleDateString('en-CA');
  const fabricToday = useMemo(() => {
    const batches = fabricBatchesDb.getAll().filter((b) => b.date === todayStr);
    const wastage = fabricWastageDb.getAll();
    const ids = new Set(batches.map((b) => b.id));
    const input = batches.reduce((s, b) => s + (b.uses ?? []).reduce((a, u) => a + (u.qtyKg || 0), 0), 0);
    const waste = wastage.filter((w) => ids.has(w.batchRef)).reduce((s, w) => s + (w.quantityKg || 0), 0);
    return { input, wastePct: input > 0 ? (waste / input) * 100 : 0 };
  }, [todayStr]);
  const loomMetersToday = useMemo(
    () => loomEntriesDb.getAll().filter((e) => e.date === todayStr).reduce((s, e) => s + (e.meters || 0), 0),
    [todayStr]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-header">Welcome, {user?.name ?? 'there'} 👋</h1>
        <p className="text-muted text-sm mt-1">{branding.companyName} — Operations Overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Orders"     value={stats.total}          icon={ShoppingCart}  iconColor="text-accent"   mono />
        <StatCard label="Dispatched"       value={stats.dispatched}     icon={Truck}         iconColor="text-success"  mono />
        <StatCard label="Pending"          value={stats.pending}        icon={Clock}         iconColor="text-yellow-400" mono />
        <StatCard label="In Production"    value={stats.inProd}         icon={TrendingUp}    iconColor="text-blue-400" mono />
        <StatCard label="Rolls in Stock"   value={rolls.length}         icon={Package}       iconColor="text-purple-400" mono />
        <StatCard label="Low Consumables"  value={lowConsumables.length} icon={AlertTriangle} iconColor="text-red-400"  mono />
      </div>

      {/* PP Fabric + Loom summary + quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard
          label="PP Fabric — Today's Input"
          value={`${fabricToday.input.toLocaleString('en-IN')} kg`}
          icon={Layers}
          iconColor="text-blue-400"
          mono
          trend={{ value: `${fabricToday.wastePct.toFixed(1)}% waste`, positive: fabricToday.wastePct < 5 }}
        />
        <StatCard
          label="Loom — Meters Today"
          value={`${loomMetersToday.toLocaleString('en-IN')} m`}
          icon={Gauge}
          iconColor="text-accent"
          mono
        />
        <div className="glass-card p-5 flex flex-col justify-center gap-3">
          <p className="text-muted text-xs uppercase tracking-wide flex items-center gap-2"><Percent className="w-3.5 h-3.5" /> Quick Entry</p>
          <div className="flex flex-col gap-2">
            <Link to="/pp-fabric?new=1" className="btn-primary justify-center"><Plus className="w-4 h-4" /> New PP Batch Entry</Link>
            <Link to="/loom?new=1" className="btn-secondary justify-center"><Plus className="w-4 h-4" /> New Loom Entry</Link>
          </div>
        </div>
      </div>

      {/* Low stock alert */}
      {lowConsumables.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <p className="text-orange-300 text-sm font-medium">
            Low consumables: {lowConsumables.map((c) => `${c.name} (${c.quantity} ${c.unit})`).join(' · ')}
          </p>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders per month */}
        <div className="lg:col-span-2 glass-card p-5">
          <p className="section-title mb-4">Orders per Month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyOrders} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#8888AA', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8888AA', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="orders" name="Orders" fill="#3131B5" radius={[4,4,0,0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Product type pie */}
        <div className="glass-card p-5">
          <p className="section-title mb-4">Product Type Split</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={productBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                {productBreakdown.map((entry) => (
                  <Cell key={entry.name} fill={PRODUCT_COLORS[entry.name] ?? '#8888AA'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number, n: string) => [v + ' orders', n]} contentStyle={{ background: '#1A1A70', border: '1px solid rgba(94,94,232,0.3)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {productBreakdown.map((e) => (
              <div key={e.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRODUCT_COLORS[e.name] }} />
                <span className="text-muted">{e.name}</span>
                <span className="font-mono text-white">{e.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dispatch trend */}
        <div className="glass-card p-5">
          <p className="section-title mb-4">Dispatch Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dispatchTrend} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#8888AA', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8888AA', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="dispatched" name="Dispatched" stroke="#12B76A" strokeWidth={2} dot={{ fill: '#12B76A', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* KG output */}
        <div className="glass-card p-5">
          <p className="section-title mb-4">Output (KG) per Month</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={kgTrend} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#8888AA', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8888AA', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="kg" name="KG" fill="#5E5EE8" radius={[4,4,0,0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent orders */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-accent/10">
          <p className="section-title">Recent Orders</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">Order ID</th>
                <th className="table-header">Client</th>
                <th className="table-header">Type</th>
                <th className="table-header">Size</th>
                <th className="table-header">Qty (KG)</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((o) => (
                <tr key={o.id} className="table-row">
                  <td className="table-cell font-mono text-accent text-xs">{o.orderId}</td>
                  <td className="table-cell font-medium">{o.clientName}</td>
                  <td className="table-cell">
                    <span className="badge" style={{ background: PRODUCT_COLORS[o.productType] + '22', color: PRODUCT_COLORS[o.productType], border: `1px solid ${PRODUCT_COLORS[o.productType]}44` }}>
                      {o.productType}
                    </span>
                  </td>
                  <td className="table-cell font-mono text-xs text-muted">{o.sizeDisplay}</td>
                  <td className="table-cell font-mono">{o.quantityKg?.toLocaleString('en-IN')}</td>
                  <td className="table-cell">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Dispatched':    'bg-success/20 text-success border-success/30',
    'Ready':         'bg-accent/20 text-accent border-accent/30',
    'In Production': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'QC Check':      'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'Pending':       'bg-white/10 text-white/60 border-white/10',
  };
  return <span className={`badge border ${map[status] ?? 'bg-white/10 text-muted'}`}>{status}</span>;
}
