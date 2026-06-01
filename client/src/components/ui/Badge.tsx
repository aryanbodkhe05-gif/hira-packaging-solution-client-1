import { cn } from '../../lib/utils';
import type { OrderStatus } from '../../types';

const STATUS_STYLES: Record<OrderStatus, string> = {
  RECEIVED:      'status-received',
  IN_PRODUCTION: 'status-production',
  QC_CHECK:      'status-qc',
  READY:         'status-ready',
  DISPATCHED:    'status-dispatched',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED:      'Received',
  IN_PRODUCTION: 'In Production',
  QC_CHECK:      'QC Check',
  READY:         'Ready',
  DISPATCHED:    'Dispatched',
};

export function OrderStatusBadge({ status, overdue }: { status: OrderStatus; overdue?: boolean }) {
  if (overdue && status !== 'DISPATCHED') {
    return <span className="badge status-overdue">Overdue</span>;
  }
  return (
    <span className={cn('badge', STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StockStatusBadge({ current, threshold }: { current: number; threshold: number }) {
  const ratio = current / threshold;
  if (ratio <= 0.5) return <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">Critical</span>;
  if (ratio <= 1) return <span className="badge bg-orange-500/20 text-orange-400 border border-orange-500/30">Low</span>;
  return <span className="badge bg-success/20 text-success border border-success/30">OK</span>;
}
