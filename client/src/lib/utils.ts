import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IST = 'Asia/Kolkata';

export function formatIST(date: string | Date, fmt = 'dd MMM yyyy, HH:mm'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(toZonedTime(d, IST), fmt);
}

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(toZonedTime(d, IST), fmt);
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

export function stockPercentage(current: number, threshold: number): number {
  if (threshold === 0) return 100;
  return Math.min(Math.round((current / threshold) * 100), 200);
}

export function stockStatus(current: number, threshold: number): 'critical' | 'low' | 'ok' {
  const ratio = current / threshold;
  if (ratio <= 0.5) return 'critical';
  if (ratio <= 1) return 'low';
  return 'ok';
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  IN_PRODUCTION: 'In Production',
  QC_CHECK: 'QC Check',
  READY: 'Ready',
  DISPATCHED: 'Dispatched',
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  LOW_STOCK: 'Low Stock',
  OVERDUE_ORDER: 'Overdue Order',
  MACHINE_DOWN: 'Machine Down',
  PAYMENT_DEFAULT: 'Payment Default',
  DISPATCH_DELAY: 'Dispatch Delay',
  SYSTEM: 'System',
};

export const ALERT_TYPE_COLORS: Record<string, string> = {
  LOW_STOCK: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  OVERDUE_ORDER: 'text-red-400 bg-red-500/10 border-red-500/30',
  MACHINE_DOWN: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  PAYMENT_DEFAULT: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  DISPATCH_DELAY: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  SYSTEM: 'text-muted bg-white/5 border-white/10',
};
