import type { ProductType, ConsumableCategory, OrderStatus, LeadSource, LeadStatus, InvoiceStatus, POStatus, MachineType, MachineStatus, JobStatus, DowntimeReason, RollStatus, Shift, BatchStatus, WastageType, WastageAction, QualityGrade, LoomStatus, WidthUnit, Finish, JobStage, JobCardStatus, FabricType, CoatingSide, RateCategory, MakingType, CardType, DispatchType } from '../config';

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

// ── Module 13 — Job Card (Order Traveler + Live Costing) ───────────────────────
export interface RateMasterItem {
  id: string;
  name: string;
  unit: string;            // e.g. ₹/kg, ₹/pc, ₹/roll, ₹/bale
  rate: number | null;     // null => "rate not set"
  category: RateCategory;  // which stage uses it
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// One material consumed in a stage. The rate is snapshotted at entry time so
// later Rate Master edits don't retroactively change historical job costs.
export interface Consumption {
  materialId: string;
  materialName: string;
  unit: string;
  qty: number;
  rateSnapshot: number | null;  // null => rate was not set when entered
  lineCost: number;             // qty × rateSnapshot (0 when rate not set)
}

interface StageBase {
  na: boolean;                  // stage marked Not Applicable
  date?: string;
  operator?: string;
  consumption: Consumption[];
}

export interface PrintingStage extends StageBase {
  inputKg?: number;
  outputKg?: number;
  meter?: number;
  rejectionKg?: number;
  balanceKg?: number;           // BOPP cards record Balance here (not Rejection)
}

export interface MetalizeStage extends StageBase {
  metalizeInputKg?: number;
  boppInputKg?: number;
  outputKg?: number;
  outputMtr?: number;
  rejectionKg?: number;
  balanceKg?: number;
}

export interface SlittingRoll { outputKg?: number; desc?: string; core?: string; meter?: number; }
export interface SlittingStage extends StageBase {
  grossInputKg?: number;
  inputCoreKg?: number;
  rolls: SlittingRoll[];        // up to 3
  rejectionKg?: number;
  trimKg?: number;
  balanceKg?: number;
}

export interface LaminationRow { boppInKg?: number; fabricInKg?: number; meter?: number; outKg?: number; }
export interface LaminationStage extends StageBase {
  fabricSize?: string;
  fabricType?: FabricType;
  gsm?: number;
  coating?: string;
  coatingSide?: CoatingSide;
  avg?: number;
  rows: LaminationRow[];        // up to 3
  totalRoll?: number;
  balanceRoll?: number;
}

export interface CuttingRow { inputKg?: number; noOfBags?: number; bcs?: number; }
export interface CuttingStage extends StageBase {
  gusset: boolean;
  perforation: boolean;
  rows: CuttingRow[];           // up to 3
  balance?: number;
  rejectionKg?: number;
}

export interface DispatchLine { quantityKg?: number; pieces?: number; dispatchDate?: string; }
export interface DispatchStage extends StageBase {
  pendingKg?: number;
  pendingPcs?: number;
  lines: DispatchLine[];
  bagsPerBale?: number;
}

export interface JobCardHeader {
  brand: string;
  qty: number;
  size: string;
  finish: Finish;
  date: string;
}

// A finished-goods dispatch posted from a job card's dispatch point.
export interface DispatchRecord {
  id: string;
  type: DispatchType;           // 'Roll' | 'Bag'
  jobCardId: string;
  jobNo: string;
  orderRef?: string;            // linked Order.id
  orderNo?: string;
  party: string;                // customer / client
  brand: string;
  qtyKg?: number;
  qtyPieces?: number;           // bags
  qtyMeters?: number;           // rolls
  rolls?: number;
  vehicle?: string;
  date: string;                 // yyyy-mm-dd
  createdAt: string;
}

export interface JobCard {
  id: string;
  jobNo: string;                // HPS-YYYY-####
  cardType: CardType;           // 'BOPP' (full) | 'Normal' (Printing→Cutting→Dispatch)
  makingType?: MakingType;      // for BOPP: Roll | Bag
  orderRef?: string;            // linked Order.id
  orderNo?: string;             // linked Order.orderId (display)
  client?: string;              // customer, carried from the order
  rollDispatchedAt?: string;    // 1-click dispatch at roll stage
  bagDispatchedAt?: string;     // 1-click dispatch at bag stage
  header: JobCardHeader;
  printing: PrintingStage;
  metalize: MetalizeStage;
  slitting: SlittingStage;
  lamination: LaminationStage;
  cutting: CuttingStage;
  dispatch: DispatchStage;
  status: JobCardStatus;
  currentStage: JobStage;
  ratesAsOf?: string;           // when consumption rates were last snapshotted
  createdAt: string;
  updatedAt: string;
}

// ── Module 14 — Inventory (rebuilt) ────────────────────────────────────────────
// Normal rolls / fabric (bought or made). Quality is a free number (2, 2.5, …).
export interface InvRoll {
  id: string;
  rollNo: string;
  type: string;            // extensible list (UL, Natural, Lamination, UL Multi Colour, …)
  size: string;
  quality: number;
  gWt: number;             // gross weight (kg)
  nWt: number;             // net weight (kg)
  meter: number;
  dateAdded: string;       // auto-captured entry date (yyyy-mm-dd)
  balanceUsed?: boolean;   // flagged when partially consumed in production
}

// Consumables: ink, thread, thinner, solvents, etc.
export interface RawMaterial {
  id: string;
  name: string;            // from reusable item list
  unit: string;
  quantity: number;
  dateAdded: string;
}

// Incoming BOPP film raw stock (before printing).
export interface BoppFilm {
  id: string;
  filmNo: string;
  kg: number;
  meter: number;
  finish?: Finish;         // glossy / matte / metalized (optional)
  micron?: number;         // optional
  dateAdded: string;
  balanceUsed?: boolean;
}

// Archive of fully-consumed input rolls / films (moved here from stock).
export interface FinishedRoll {
  id: string;
  rollNo: string;
  type: string;
  size: string;
  quality: number;
  gWt: number;
  nWt: number;
  meter: number;
  dateAdded: string;       // when it originally entered stock
  consumedAt: string;      // when marked finished
  jobNo?: string;
  orderNo?: string;
}

export interface FinishedFilm {
  id: string;
  filmNo: string;
  kg: number;
  meter: number;
  finish?: Finish;
  micron?: number;
  dateAdded: string;
  consumedAt: string;
  jobNo?: string;
  orderNo?: string;
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
  // Production routing (Sales → Production). Making Type applies only to BOPP.
  makingType?: MakingType;             // when BOPP: 'Roll' | 'Bag'
  jobCardId?: string;                  // linked Job Card once sent to production
  notes?: string;
  billNo?: string;
  dispatchDate?: string;
  createdAt: string;
  dispatchedAt?: string;
}
