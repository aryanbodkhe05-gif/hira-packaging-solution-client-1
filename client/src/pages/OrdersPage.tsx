import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart, Plus, Search, Filter, RefreshCw,
  Clock, CheckCircle2, AlertTriangle, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { OrderStatusBadge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { cn, formatDate, formatNumber, ORDER_STATUS_LABELS } from '../lib/utils';
import type { Order, OrderStats, OrderStatus, Client } from '../types';

const STATUS_PIPELINE: OrderStatus[] = ['RECEIVED', 'IN_PRODUCTION', 'QC_CHECK', 'READY', 'DISPATCHED'];

function OrderRow({ order, onUpdateStatus }: { order: Order; onUpdateStatus: (o: Order) => void }) {
  return (
    <tr className="table-row">
      <td className="table-cell font-mono text-accent text-xs">{order.orderId}</td>
      <td className="table-cell">
        <div>
          <p className="text-white font-medium">{order.client.name}</p>
          <p className="text-muted text-xs">{order.client.phone}</p>
        </div>
      </td>
      <td className="table-cell">{order.productType}</td>
      <td className="table-cell font-mono">{formatNumber(order.quantity)} {order.unit}</td>
      <td className="table-cell">
        <span className={cn('font-medium text-sm', order.isOverdue ? 'text-red-400' : 'text-white/70')}>
          {formatDate(order.deliveryDate)}
        </span>
      </td>
      <td className="table-cell">
        <OrderStatusBadge status={order.status} overdue={order.isOverdue} />
      </td>
      <td className="table-cell">
        <button
          onClick={() => onUpdateStatus(order)}
          disabled={order.status === 'DISPATCHED'}
          className={cn(
            'px-2 py-1 rounded text-xs font-medium transition-colors',
            order.status !== 'DISPATCHED'
              ? 'bg-accent/10 hover:bg-accent/20 text-accent'
              : 'opacity-30 cursor-not-allowed text-muted'
          )}
        >
          Update Status
        </button>
      </td>
    </tr>
  );
}

function NewOrderForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    clientId: '', newClientName: '', productType: '',
    quantity: '', unit: 'units', deliveryDate: '', notes: '',
  });
  const [isNewClient, setIsNewClient] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/orders/clients/all').then((r) => setClients(r.data));
  }, []);

  async function submit() {
    if (!form.productType || !form.quantity || !form.deliveryDate) {
      toast.error('Please fill required fields');
      return;
    }
    setLoading(true);
    try {
      let clientId = form.clientId;
      if (isNewClient && form.newClientName) {
        const { data } = await api.post('/orders/clients', { name: form.newClientName });
        clientId = data.id;
      }
      if (!clientId) { toast.error('Please select or add a client'); return; }

      await api.post('/orders', {
        clientId,
        productType: form.productType,
        quantity: parseFloat(form.quantity),
        unit: form.unit,
        deliveryDate: form.deliveryDate,
        notes: form.notes || undefined,
      });
      toast.success('Order created!');
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to create order');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Client</label>
        <div className="flex gap-2 mb-2">
          {['existing', 'new'].map((t) => (
            <button
              key={t}
              onClick={() => setIsNewClient(t === 'new')}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors capitalize',
                isNewClient === (t === 'new') ? 'bg-primary text-white' : 'bg-white/10 text-muted hover:text-white'
              )}
            >
              {t === 'existing' ? 'Existing Client' : 'New Client'}
            </button>
          ))}
        </div>
        {isNewClient ? (
          <input className="input-field" value={form.newClientName}
            onChange={(e) => setForm({ ...form, newClientName: e.target.value })}
            placeholder="Client company name" autoFocus />
        ) : (
          <select className="input-field" value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">Select client...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div>
        <label className="label">Product Type *</label>
        <input className="input-field" value={form.productType}
          onChange={(e) => setForm({ ...form, productType: e.target.value })}
          placeholder="e.g., Corrugated Box, Poly Bag 1kg" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Quantity *</label>
          <input className="input-field font-mono" type="number" min="1"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            placeholder="0" />
        </div>
        <div>
          <label className="label">Unit</label>
          <select className="input-field" value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            {['units', 'boxes', 'rolls', 'sheets', 'kg'].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Delivery Date *</label>
        <input className="input-field" type="date" value={form.deliveryDate}
          onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input-field resize-none" rows={2} value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Special instructions..." />
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Creating...' : 'Create Order'}
        </button>
      </div>
    </div>
  );
}

function UpdateStatusModal({ order, onClose, onSuccess }: { order: Order; onClose: () => void; onSuccess: () => void }) {
  const currentIdx = STATUS_PIPELINE.indexOf(order.status);
  const [status, setStatus] = useState<OrderStatus>(
    currentIdx < STATUS_PIPELINE.length - 1 ? STATUS_PIPELINE[currentIdx + 1] : order.status
  );
  const [tracking, setTracking] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await api.patch(`/orders/${order.id}/status`, {
        status,
        trackingNumber: tracking || undefined,
      });
      toast.success(`Order ${order.orderId} updated to ${ORDER_STATUS_LABELS[status]}`);
      if (status === 'DISPATCHED') toast.success('WhatsApp notification sent to client!', { icon: '📱' });
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-white/5 rounded-lg">
        <p className="text-muted text-xs mb-1">Order</p>
        <p className="text-white font-mono font-medium">{order.orderId}</p>
        <p className="text-white/70 text-sm">{order.client.name} · {order.productType}</p>
      </div>

      <div>
        <label className="label">New Status</label>
        <div className="space-y-2">
          {STATUS_PIPELINE.slice(currentIdx + 1).map((s) => (
            <label key={s} className={cn(
              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
              status === s ? 'border-accent/50 bg-accent/10' : 'border-white/10 hover:border-white/20'
            )}>
              <input type="radio" name="status" value={s} checked={status === s}
                onChange={() => setStatus(s)} className="hidden" />
              <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center',
                status === s ? 'border-accent' : 'border-white/30')}>
                {status === s && <div className="w-2 h-2 rounded-full bg-accent" />}
              </div>
              <OrderStatusBadge status={s} />
            </label>
          ))}
        </div>
      </div>

      {status === 'DISPATCHED' && (
        <div>
          <label className="label">Tracking Number (optional)</label>
          <input className="input-field font-mono" value={tracking}
            onChange={(e) => setTracking(e.target.value)} placeholder="e.g., DTDC1234567890" />
          <p className="text-muted text-xs mt-1 flex items-center gap-1">
            📱 WhatsApp dispatch confirmation will be sent to client
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Updating...' : 'Update Status'}
        </button>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [statusUpdateOrder, setStatusUpdateOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const [ordersRes, statsRes] = await Promise.all([
        api.get(`/orders?${params}`),
        api.get('/orders/stats'),
      ]);
      setOrders(ordersRes.data.orders);
      setStats(statsRes.data);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-header">Order Management</h1>
          <p className="text-muted text-sm mt-1">Track orders from receipt to dispatch</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setNewOrderOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Received" value={stats?.pending ?? 0} icon={ShoppingCart} iconColor="text-blue-400" mono />
        <StatCard label="In Production" value={stats?.inProduction ?? 0} icon={Clock} iconColor="text-yellow-400" mono />
        <StatCard label="Ready" value={stats?.ready ?? 0} icon={CheckCircle2} iconColor="text-accent" mono />
        <StatCard label="Dispatched Today" value={stats?.dispatched ?? 0} icon={CheckCircle2} iconColor="text-success" mono />
        <StatCard label="Overdue" value={stats?.overdue ?? 0} icon={AlertTriangle} iconColor="text-red-400" mono />
      </div>

      {/* Status pipeline filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders or clients..."
            className="input-field pl-9 w-56" />
        </div>
        <button
          onClick={() => setStatusFilter('')}
          className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            !statusFilter ? 'bg-primary text-white' : 'text-muted hover:text-white hover:bg-white/10')}
        >
          All
        </button>
        {STATUS_PIPELINE.map((s) => (
          <button key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              statusFilter === s ? 'bg-primary text-white' : 'text-muted hover:text-white hover:bg-white/10')}
          >
            {ORDER_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">Order ID</th>
                <th className="table-header">Client</th>
                <th className="table-header">Product</th>
                <th className="table-header">Qty</th>
                <th className="table-header">Delivery Date</th>
                <th className="table-header">Status</th>
                <th className="table-header">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={7}>
                  <EmptyState icon={ShoppingCart} title="No orders found"
                    action={{ label: 'Create First Order', onClick: () => setNewOrderOpen(true) }} />
                </td></tr>
              ) : (
                orders.map((o) => (
                  <OrderRow key={o.id} order={o} onUpdateStatus={setStatusUpdateOrder} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-accent/10 text-muted text-xs">
          {orders.length} orders
        </div>
      </div>

      <Modal open={newOrderOpen} onClose={() => setNewOrderOpen(false)} title="Create New Order" size="md">
        <NewOrderForm onClose={() => setNewOrderOpen(false)} onSuccess={load} />
      </Modal>

      {statusUpdateOrder && (
        <Modal open onClose={() => setStatusUpdateOrder(null)} title="Update Order Status" size="sm">
          <UpdateStatusModal order={statusUpdateOrder}
            onClose={() => setStatusUpdateOrder(null)} onSuccess={load} />
        </Modal>
      )}
    </div>
  );
}
