export type UserRole = 'DEVELOPER' | 'OWNER' | 'MANAGER' | 'STAFF';

// Authenticated user as returned by the backend (/api/auth/me).
export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  active?: boolean;
  createdAt?: string;
}

// Legacy localStorage user shape (kept for existing client-side seed data).
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
}

// ── Inventory ─────────────────────────────────────────────────────────────────
export interface Vendor {
  id: string;
  name: string;
  phone: string;
  contactName?: string;
}

export interface VendorMaterial {
  id: string;
  vendorId: string;
  materialId: string;
  pricePerUnit: number;
  leadTimeDays: number;
  reliability: number;
  isDefault: boolean;
  vendor: Vendor;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  supplierId?: string;
  supplier?: { id: string; name: string; phone: string } | null;
  vendorMaterials?: VendorMaterial[];
  createdAt: string;
  updatedAt: string;
}

export interface StockLog {
  id: string;
  materialId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  notes?: string;
  staffName: string;
  createdAt: string;
  material?: { name: string; unit: string };
}

// ── Orders ────────────────────────────────────────────────────────────────────
export type OrderStatus = 'RECEIVED' | 'IN_PRODUCTION' | 'QC_CHECK' | 'READY' | 'DISPATCHED';

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
}

export interface Order {
  id: string;
  orderId: string;
  clientId: string;
  client: Client;
  productType: string;
  quantity: number;
  unit: string;
  deliveryDate: string;
  status: OrderStatus;
  notes?: string;
  dispatchedAt?: string;
  readyAt?: string;
  createdAt: string;
  isOverdue?: boolean;
}

export interface OrderStats {
  pending: number;
  inProduction: number;
  dispatched: number;
  overdue: number;
  ready: number;
}

// ── Alerts ────────────────────────────────────────────────────────────────────
export type AlertType = 'LOW_STOCK' | 'OVERDUE_ORDER' | 'MACHINE_DOWN' | 'PAYMENT_DEFAULT' | 'DISPATCH_DELAY' | 'SYSTEM';
export type AlertChannel = 'WHATSAPP' | 'IN_APP' | 'BOTH';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  channel: AlertChannel;
  seen: boolean;
  sentAt: string;
}

// ── Chart data ────────────────────────────────────────────────────────────────
export interface StockChartPoint {
  date: string;
  in: number;
  out: number;
  balance: number;
}
