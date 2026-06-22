import type { ProductType, ConsumableCategory, OrderStatus, LeadSource, LeadStatus, InvoiceStatus, POStatus, MachineType, MachineStatus, JobStatus, DowntimeReason, RollStatus, Shift, BatchStatus, WastageType, WastageAction, QualityGrade, LoomStatus, WidthUnit } from '../config';

export interface Roll {
  id: string;
  rollNo: string;
  type: ProductType;
  size: string;
  quality: string;
  meter: number;
  grossWeight: number;
  netWeight: number;
  createdAt: string;
  // ── Production consumption (auto-maintained from production jobs) ──
  status?: RollStatus;     // 'In Stock' (default) | 'In Use' | 'Fully Used'
  bagsProduced?: number;   // cumulative bags made from this roll
}

// ── Module 10 — Production ────────────────────────────────────────────────────
export interface Machine {
  id: string;
  name: string;
  code: string;            // NF-M-001
  type: MachineType;
  status: MachineStatus;
  location?: string;
  notes?: string;
  createdAt: string;
}

export interface ProductionJob {
  id: string;
  jobNo: string;           // JOB-YYYYMMDD-XXXX
  machineId: string;
  machineName: string;
  rollId?: string;         // roll being consumed
  rollNo?: string;
  bagSize: string;         // e.g. "25 × 30"
  bagsTarget: number;
  bagsProduced: number;
  rollFullyUsed: boolean;  // marks the roll as 'Fully Used' when true
  status: JobStatus;
  orderRef?: string;       // optional linked order id (NF-...)
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface DowntimeLog {
  id: string;
  machineId: string;
  machineName: string;
  reason: DowntimeReason;
  startedAt: string;
  endedAt?: string;        // empty => still down
  notes?: string;
  createdAt: string;
}

// ── Module 11 — PP Fabric (Tape) Production ───────────────────────────────────
export interface FabricBatch {
  id: string;
  batchId: string;          // HIRA-YYYYMMDD-NNN
  date: string;             // yyyy-mm-dd
  shift: Shift;
  line: string;             // e.g. "Line 3"
  ppKg: number;             // Polypropylene used
  fillerKg: number;         // Filler used
  rpKg: number;             // Recycled / reprocessed polymer
  hasColour: boolean;
  colourName?: string;      // shown only when hasColour
  colourKg: number;         // 0 when hasColour is false
  status: BatchStatus;      // Open | Closed
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FabricWastage {
  id: string;
  batchRef: string;         // FabricBatch.id
  batchLabel: string;       // HIRA-… for display
  type: WastageType;
  quantityKg: number;
  action: WastageAction;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Module 12 — Loom Production ────────────────────────────────────────────────
export interface Loom {
  id: string;
  loomNo: string;           // e.g. "Loom 1"
  model?: string;
  maxRpm: number;           // max RPM capacity — drives efficiency %
  installDate?: string;     // yyyy-mm-dd
  status: LoomStatus;       // Active | Under maintenance | Retired
  createdAt: string;
  updatedAt: string;
}

export interface LoomEntry {
  id: string;
  entryId: string;          // LM-YYYYMMDD-NNN
  date: string;             // yyyy-mm-dd
  shift: Shift;
  loomNo: string;
  operator?: string;
  width: number;            // fabric width / size
  widthUnit: WidthUnit;     // inches | mm
  meters: number;           // total meters woven
  quality: QualityGrade;
  weightKg: number;         // weight of produced roll/batch
  rollCount: number;
  reedCount?: number;
  rpm?: number;             // loom RPM if tracked
  downtimeMin: number;      // stoppage during shift
  downtimeReason?: string;  // shown when downtimeMin > 0
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Consumable {
  id: string;
  category: ConsumableCategory;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  createdAt: string;
}

// ── Module 5 — CRM ────────────────────────────────────────────────────────────
export interface Lead {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  source: LeadSource;
  productInterest?: string;
  estimatedOrderSize?: number;
  status: LeadStatus;
  notes?: string;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Module 6 — Finance ────────────────────────────────────────────────────────
export interface Invoice {
  id: string;
  invoiceNumber: string;   // INV-YYYYMMDD-XXXX
  orderId: string;
  clientName: string;
  orderDetails: string;
  sizeDisplay: string;
  quantityKg?: number;
  productType: string;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  dueDate: string;
  paidAt?: string;
  paidAmount?: number;
  status: InvoiceStatus;
  createdAt: string;
}

// ── Module 7 — Vendors ────────────────────────────────────────────────────────
export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  phone: string;
  email?: string;
  materialSupplied: string;
  rating: number;           // 1–5
  paymentTerms: string;
  pricePerUnit?: number;
  unit?: string;
  leadTimeDays?: number;
  reliability?: number;     // 1–5
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;         // PO-YYYYMMDD-XXXX
  vendorId: string;
  vendorName: string;
  material: string;
  quantity: number;
  unit: string;
  pricePerUnit?: number;
  totalAmount?: number;
  expectedDelivery: string;
  deliveredAt?: string;
  status: POStatus;
  notes?: string;
  createdAt: string;
}

// ── Module 8 — Alerts ─────────────────────────────────────────────────────────
export interface AppAlert {
  id: string;
  type: 'LOW_STOCK' | 'OVERDUE_ORDER' | 'PAYMENT_DEFAULT' | 'DISPATCH_DELAY' | 'FOLLOW_UP' | 'PO_DELAY';
  title: string;
  message: string;
  seen: boolean;
  channel: 'IN_APP' | 'WHATSAPP' | 'BOTH';
  createdAt: string;
}

export interface Order {
  id: string;
  orderId: string;          // NF-YYYYMMDD-XXXX
  clientName: string;
  productType: ProductType;
  length: number;
  width: number;
  gsm: number;
  sizeDisplay: string;      // "25 × 30 + 0.96 gm"
  quantityKg?: number;
  quantityNos?: number;
  quantityUnit: 'KG' | 'Nos' | 'Both';
  status: OrderStatus;
  notes?: string;
  billNo?: string;
  dispatchDate?: string;
  createdAt: string;
  dispatchedAt?: string;
}
